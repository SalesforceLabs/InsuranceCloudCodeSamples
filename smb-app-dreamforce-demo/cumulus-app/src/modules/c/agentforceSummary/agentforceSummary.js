import { LightningElement, api, track } from 'lwc';

/**
 * c-agentforce-summary - SLDS 2 "Top recommendations" Agentforce panel.
 *
 * Anatomy (per the SLDS 2 Agentic Experiences Figma):
 *   1. Panel header   : title + info icon (left) + overflow menu (right)
 *   2. Recommendation cards (one per item) :
 *        a. Lavender AI tag with sparkle + meta info
 *        b. Title + description
 *        c. Optional key/value field rows
 *        d. Per-card Accept / Reject actions
 *   3. Footer actions : "Apply selected" (brand) + "Reset all" (neutral)
 *
 * @api props:
 *   - panelTitle      (default "Top recommendations")
 *   - infoTitle       - tooltip text for the header info icon
 *   - tagLabel        (default "AI generated") - label inside each card's pill
 *   - applyLabel / resetLabel - footer button text
 *   - showMenu        (default true) - header overflow trigger
 *   - hasInfo         (default true) - header info icon
 *   - recommendations - array of:
 *        { id: string, title: string, description?: string,
 *          fields?: [{ label, value }], status?: 'pending'|'accepted'|'rejected' }
 *
 * Events:
 *   - applyselected         - detail: { ids: string[] } (accepted recs)
 *   - resetall              - clears local state
 *   - recommendationaction  - detail: { id, action: 'accept'|'reject' }
 *   - menu                  - header overflow click
 */
export default class AgentforceSummary extends LightningElement {
  @api panelTitle = 'Top recommendations';
  @api infoTitle = 'AI-generated coverage recommendations based on this account.';
  @api tagLabel = 'AI generated';
  @api applyLabel = 'Apply selected';
  @api resetLabel = 'Reset all';
  @api showMenu = true;
  @api hasInfo = true;

  // Internal mirror of `status` per recommendation so the parent doesn't
  // have to manage selection state to render the panel.
  @track _statusById = {};

  _recommendations = [];

  @api
  get recommendations() {
    return this._recommendations;
  }
  set recommendations(value) {
    this._recommendations = Array.isArray(value) ? value : [];
    // Seed initial status from the incoming model - preserves any
    // pre-accepted recs the parent passed in.
    const next = {};
    this._recommendations.forEach((rec) => {
      next[rec.id] = rec.status || 'pending';
    });
    this._statusById = next;
  }

  // ── View model for the template ─────────────────────────────────
  get cards() {
    return this._recommendations.map((rec) => {
      const status = this._statusById[rec.id] || 'pending';
      const isAccepted = status === 'accepted';
      const isRejected = status === 'rejected';
      return {
        ...rec,
        hasFields: Array.isArray(rec.fields) && rec.fields.length > 0,
        itemClass: this._cardClass(status),
        acceptClass: this._actionClass('accept', isAccepted),
        rejectClass: this._actionClass('reject', isRejected),
        acceptPressed: isAccepted ? 'true' : 'false',
        rejectPressed: isRejected ? 'true' : 'false'
      };
    });
  }

  get applyDisabled() {
    return !Object.values(this._statusById).some((s) => s === 'accepted');
  }

  // ── Event handlers ──────────────────────────────────────────────
  handleCardAction(event) {
    const { id, action } = event.currentTarget.dataset;
    if (!id || !action) return;

    // Toggle: clicking an already-active state clears it.
    const current = this._statusById[id] || 'pending';
    const next = current === action ? 'pending' : action;
    this._statusById = { ...this._statusById, [id]: next };

    this.dispatchEvent(
      new CustomEvent('recommendationaction', {
        detail: { id, action: next, status: next },
        bubbles: true,
        composed: true
      })
    );
  }

  handleApply() {
    const ids = Object.keys(this._statusById).filter(
      (id) => this._statusById[id] === 'accepted'
    );
    this.dispatchEvent(
      new CustomEvent('applyselected', {
        detail: { ids },
        bubbles: true,
        composed: true
      })
    );
  }

  handleReset() {
    const cleared = {};
    this._recommendations.forEach((rec) => (cleared[rec.id] = 'pending'));
    this._statusById = cleared;
    this.dispatchEvent(
      new CustomEvent('resetall', { bubbles: true, composed: true })
    );
  }

  handleMenu(event) {
    event.preventDefault();
    this.dispatchEvent(
      new CustomEvent('menu', { bubbles: true, composed: true })
    );
  }

  // ── Class helpers ───────────────────────────────────────────────
  _cardClass(status) {
    let cls = 'afs__card';
    if (status === 'accepted') cls += ' afs__card_accepted';
    else if (status === 'rejected') cls += ' afs__card_rejected';
    return cls;
  }

  _actionClass(kind, isActive) {
    const tone = kind === 'accept' ? 'afs__act_accept' : 'afs__act_reject';
    let cls = `afs__act ${tone}`;
    if (isActive) cls += ' afs__act_active';
    return cls;
  }
}
