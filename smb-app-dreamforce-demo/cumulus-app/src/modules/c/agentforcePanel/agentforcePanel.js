import { LightningElement, api, track } from 'lwc';

// ─────────────────────────────────────────────────────────────────────────
// c-agentforce-panel
//
// Reusable docked-right Agentforce chat panel. Mounted once at the
// workspace level, and once at the app shell for the global-header Ask
// pill. The parent invokes `startContextualChat({ message, context,
// contextId })` to open it pre-seeded with a user prompt plus the
// originating record's context. Mock replies quote the context fields
// (year / make / model / driver / deductibles) back so the conversation
// reads like a record-aware AI session. Passing no context opens the
// global mode, which answers at book-of-business level instead.
//
// Public API:
//   @api startContextualChat({ message, context, contextId })
//        Opens the panel, resets the thread, appends the user message,
//        and schedules a mock contextual reply.
//   @api close()
//        Programmatically dismiss the panel.
//
// Internal: standard chat state (chatMessages / chatInput / agentTyping)
// plus `currentContext` so replies can quote the launched record.
// ─────────────────────────────────────────────────────────────────────────

const REPLY_DELAY_MS = 700;

const TEMPLATES = [
  {
    test: /(industry|average|typical|common).*(deductible|collision|coll)/i,
    reply: (c) =>
      `Based on market data for a ${c.year} ${c.make} ${c.model}, the most common collision deductible selected by drivers with similar profiles to ${c.driver} is $500. I can apply that to this vehicle if you'd like.`
  },
  {
    test: /(comprehensive|comp).*(deductible)/i,
    reply: (c) =>
      `For a ${c.year} ${c.make} ${c.model}, comprehensive deductibles cluster around $250 for low-incident drivers like ${c.driver}. Anything higher saves roughly 8% on premium.`
  },
  {
    test: /(rental|loaner|reimbursement)/i,
    reply: (c) => {
      const r = c.deductibles && c.deductibles.rental;
      const value = r ? `$${r}/day` : 'the configured rate';
      return `Rental Reimbursement is currently set to ${value} on the ${c.make} ${c.model}. Most carriers cap this at $50/day for a class-equivalent loaner.`;
    }
  },
  {
    test: /(carrier|market|quote|premium)/i,
    reply: (c) =>
      `For a ${c.year} ${c.make} ${c.model} with ${c.driver} as primary driver, top markets in this region are Progressive and Travelers. I can pull live quotes whenever you're ready.`
  },
  {
    test: /(driver|incident|claim|history)/i,
    reply: (c) =>
      `${c.driver} has a clean driving record on file. That keeps premiums in the favorable band for the ${c.year} ${c.make} ${c.model}.`
  }
];

const FALLBACK = (c) =>
  `I have full context on the ${c.year} ${c.make} ${c.model} (driver: ${c.driver}). Ask me about deductibles, coverages, driver history, or carrier comparisons for this vehicle.`;

// Launches from the global-header Ask pill carry no record, so none of the
// templates above can run: they would interpolate `undefined` for every
// vehicle field. These answer at book-of-business level instead, matching
// what the org's Agentforce Coworker does when opened outside a record.
const GLOBAL_TEMPLATES = [
  {
    test: /(renew|expir|lapse)/i,
    reply: () =>
      'Six policies renew in the next 30 days. Cumulus Coffee Roasters and Northwind Traders are the two largest by premium, and neither has a renewal quote on file yet. I can start those for you.'
  },
  {
    test: /(rfq|quote|market|carrier|submission)/i,
    reply: () =>
      'Four RFQs are awaiting carrier response and two have quotes ready to compare. The oldest has been open nine days. I can open the comparison for the two that are ready.'
  },
  {
    test: /(summar|overview|brief|account|client)/i,
    reply: () =>
      'This account holds three active policies across Commercial Auto, Property, and Workers Comp, totalling $184K in annual premium. Loss ratio is running at 38%, which sits in the favorable band, and one claim is still open from March.'
  },
  {
    test: /(claim|loss|incident)/i,
    reply: () =>
      'One claim is open on this account, filed in March against the Property policy, with $12K reserved and nothing paid out yet. No other losses have been reported in the last 12 months.'
  },
  {
    test: /(task|today|priorit|schedul|meeting|day)/i,
    reply: () =>
      'Today you have three client meetings and five tasks due, two of them overdue. Both overdue items are certificate requests, so they are quick wins if you want to clear them first.'
  }
];

const GLOBAL_FALLBACK = () =>
  'I can help across your whole book. Ask me about upcoming renewals, open RFQs and carrier quotes, an account summary, claims activity, or what needs your attention today.';

let _seq = 0;

export default class AgentforcePanel extends LightningElement {
  // ── State ──────────────────────────────────────────────────
  @track isOpen = false;
  @track chatMessages = [];
  @track chatInput = '';
  @track agentTyping = false;
  @track currentContext = null;

  _replyTimer = null;

  disconnectedCallback() {
    this._clearTimer();
  }

  // ── Public API ─────────────────────────────────────────────
  @api
  startContextualChat(payload) {
    const { message, context } = payload || {};
    this.currentContext = context || {};
    this.chatMessages = [];
    this.agentTyping = false;
    this.chatInput = '';
    this._clearTimer();
    this.isOpen = true;
    if (message) {
      this._appendMessage({ isUser: true, text: message });
      this._scheduleReply(message);
    }
    // Snap focus to the panel's input after the slide-in animation kicks
    // off so the broker can continue the thread without reaching for the
    // mouse.
    Promise.resolve().then(() => {
      const input = this.template.querySelector('.afp-pill__input');
      if (input) input.focus();
    });
  }

  @api
  close() {
    this._close();
  }

  // ── Computed view-model ────────────────────────────────────
  get panelClass() {
    return this.isOpen ? 'afp afp_open' : 'afp';
  }
  get backdropClass() {
    return this.isOpen ? 'afp__backdrop afp__backdrop_open' : 'afp__backdrop';
  }
  get isSendDisabled() {
    return !this.chatInput || this.chatInput.trim().length === 0;
  }
  get contextLabel() {
    const c = this.currentContext || {};
    const parts = [c.year, c.make, c.model].filter(Boolean);
    return parts.length ? parts.join(' ') : 'Agentforce';
  }
  get hasMessages() {
    return this.chatMessages.length > 0;
  }
  get messageRows() {
    return this.chatMessages.map((m) => ({
      ...m,
      cls: m.isUser ? 'afp-msg afp-msg_user' : 'afp-msg afp-msg_agent'
    }));
  }

  // ── Handlers ───────────────────────────────────────────────
  handleInput(event) {
    this.chatInput = event.target.value;
  }

  handleSubmit(event) {
    if (event && event.preventDefault) event.preventDefault();
    const message = this.chatInput.trim();
    if (!message) return;
    this._appendMessage({ isUser: true, text: message });
    this.chatInput = '';
    this._scheduleReply(message);
  }

  handleClose() {
    this._close();
  }

  handleBackdropClick() {
    this._close();
  }

  handleKeydown(event) {
    if (event.key === 'Escape') this._close();
  }

  // Swallow clicks inside the panel itself so they don't bubble to the
  // backdrop dismiss handler.
  handlePanelClick(event) {
    event.stopPropagation();
  }

  // ── Internals ──────────────────────────────────────────────
  // Every dismiss route - close button, backdrop, Escape, and the public
  // close() - lands here, so the one dispatch covers them all. Deliberately
  // non-bubbling: the launcher binds it on this element, and `close` is a
  // common enough event name that letting it travel risks colliding with an
  // unrelated onclose on an ancestor.
  _close() {
    const wasOpen = this.isOpen;
    this._clearTimer();
    this.isOpen = false;
    this.agentTyping = false;
    if (wasOpen) {
      this.dispatchEvent(new CustomEvent('close', { bubbles: false }));
    }
  }

  _clearTimer() {
    if (this._replyTimer) {
      clearTimeout(this._replyTimer);
      this._replyTimer = null;
    }
  }

  _appendMessage({ isUser, text }) {
    _seq += 1;
    this.chatMessages = [
      ...this.chatMessages,
      { id: `afp-${_seq}`, isUser: !!isUser, text, ts: Date.now() }
    ];
  }

  _scheduleReply(userText) {
    this.agentTyping = true;
    this._clearTimer();
    this._replyTimer = setTimeout(() => {
      const c = this.currentContext || {};
      // make + model are the fields every record-aware template reads, so
      // their presence is what decides which reply table can run at all.
      const recordAware = !!(c.make && c.model);
      const table = recordAware ? TEMPLATES : GLOBAL_TEMPLATES;
      const fallback = recordAware ? FALLBACK : GLOBAL_FALLBACK;
      const tmpl = table.find((t) => t.test.test(userText));
      const reply = tmpl ? tmpl.reply(c) : fallback(c);
      this.agentTyping = false;
      this._appendMessage({ isUser: false, text: reply });
      this._replyTimer = null;
    }, REPLY_DELAY_MS);
  }
}
