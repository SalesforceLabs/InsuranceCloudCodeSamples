import { LightningElement, api, track } from 'lwc';
import {
  quotes,
  COMPARE_LAYOUT_BY_APPLICATION_ID,
  getAccountPrincipal
} from 'data/mockData';
import { formatUsDate, today } from 'data/dates';
// The comparison's attribute bands, shared with the on-screen grid so
// the PDF export renders the same rows in the same order.
import {
  PA_SECTIONS,
  HOME_SECTIONS,
  EB_PLAN_ROWS,
  EB_BENEFIT_ATTRS,
  EB_TIER_ORDER
} from 'c/quoteCompareTable';

const VIEW_GRID = 'grid';
const VIEW_EMAIL = 'email';

// Coverage vocabulary per line of coverage. Keeps the proposal copy
// honest: an auto shortlist talks about liability limits and
// physical-damage deductibles, a renters shortlist about personal
// property. Keyed on the LOC label the RFQ row carries.
const LINE_COPY = {
  'Personal Auto': {
    summaryNouns:
      'annual premium, liability limits, physical-damage deductibles, and key coverage differences',
    limitNoun: 'liability limits'
  },
  Renters: {
    summaryNouns:
      'annual premium, personal property limits, liability limits, and key coverage differences',
    limitNoun: 'personal property limits'
  },
  Homeowners: {
    summaryNouns:
      'annual premium, dwelling and personal property limits, wind/hail deductibles, and key coverage differences',
    limitNoun: 'liability limits and a higher wind/hail deductible'
  },
  Umbrella: {
    summaryNouns:
      'annual premium, excess liability limits, underlying requirements, and key coverage differences',
    limitNoun: 'excess liability limits'
  },
  'Group Medical': {
    summaryNouns:
      'annual premium, deductibles, out-of-pocket maximums, and key benefit differences',
    limitNoun: 'benefit levels'
  },
  default: {
    summaryNouns:
      'annual premium, coverage limits, deductibles, and key coverage differences',
    limitNoun: 'coverage limits'
  }
};

// Row sets c-quote-compare-table ships. 'home' covers the property
// lines (Homeowners, Renters); 'pa' covers auto and umbrella.
const COMPARE_FLOWS = new Set(['pa', 'home', 'eb']);

const COUNT_WORDS = {
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight'
};

function oxfordJoin(list) {
  const items = (list || []).filter(Boolean);
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

// "Lighthouse Casualty" + "Choice" → "Lighthouse Casualty Choice".
function planFullName(q) {
  if (!q) return '';
  return q.planName ? `${q.carrierName} ${q.planName}` : q.carrierName;
}

// Greeting noun keyed on the RFQ's line label, not the table flow.
// Umbrella shares the PA row set and Renters shares Homeowners; the
// spoken line still has to match what the broker is looking at.
const LINE_GREETING_NOUN = {
  'Personal Auto': 'personal auto quotes',
  'Group Medical': 'health quotes',
  Homeowners: 'homeowners quotes',
  Renters: 'renters quotes',
  Umbrella: 'umbrella quotes',
  'Group Dental': 'dental quotes',
  'Group Vision': 'vision quotes',
  'Group Life': 'life quotes'
};

const OFF_SCOPE_REFUSAL =
  "I'm sorry, I can only help with this comparison. Ask me about quote details, premiums, deductibles, coverage, or how these plans differ.";

function nowLabel() {
  const d = today();
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const am = h < 12 ? 'am' : 'pm';
  h = h % 12 || 12;
  return `${h}:${m} ${am}`;
}

function greetingNoun(lineLabel) {
  if (LINE_GREETING_NOUN[lineLabel]) return LINE_GREETING_NOUN[lineLabel];
  const raw = String(lineLabel || 'these').trim();
  return `${raw.toLowerCase()} quotes`;
}

function fmtMoney(n) {
  if (n == null) return '-';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  });
}

function compactName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function parseRank(value) {
  const s = String(value || '');
  const pct = s.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct) return Number(pct[1]);
  const num = s.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return num ? Number(num[1]) : Number.POSITIVE_INFINITY;
}

function ebBenefit(q, attr, tier) {
  const map = q?.benefits?.[attr];
  if (!map) return '';
  if (tier && map[tier]) return map[tier];
  return map.out_of_network || map.in_network || '';
}

function deductibleField(q, flow, text) {
  const t = text.toLowerCase();
  if (flow === 'home') {
    if (/wind|hail/.test(t)) return { key: 'windHailDeductible', label: 'Wind / hail deductible' };
    if (/all.?peril/.test(t)) return { key: 'allPerilsDeductible', label: 'All-perils deductible' };
    return { key: 'windHailDeductible', label: 'Wind / hail deductible' };
  }
  if (flow === 'eb') {
    const tier = /out.?of.?network|\boon\b/.test(t) ? 'out_of_network' : 'in_network';
    const attr = /family/.test(t) ? 'med-ded-fam' : 'med-ded-ind';
    const label =
      tier === 'out_of_network'
        ? 'Out-of-network individual deductible'
        : 'In-network individual deductible';
    return { attr, tier, label, fromBenefits: true };
  }
  if (/luxury/.test(t)) return { key: 'luxuryDeductible', label: 'Luxury-vehicle deductible' };
  if (/comprehensive|\bcomp\b/.test(t) && !/collision/.test(t)) {
    return { key: 'compDeductible', label: 'Comprehensive deductible' };
  }
  if (/collision/.test(t)) return { key: 'collisionDeductible', label: 'Collision deductible' };
  return { key: 'collisionDeductible', label: 'Collision deductible' };
}

function readMetric(q, spec) {
  if (spec.fromBenefits) return ebBenefit(q, spec.attr, spec.tier);
  return q[spec.key];
}

function quotesNamedIn(text, list) {
  const qn = compactName(text);
  if (!qn) return [];
  return list.filter((q) => {
    const full = compactName(q.carrierName);
    if (full && qn.includes(full)) return true;
    const first = compactName((q.carrierName || '').split(/\s+/)[0]);
    return first.length >= 4 && qn.includes(first);
  });
}

function lowestBy(list, readValue) {
  let best = [];
  let bestRank = Number.POSITIVE_INFINITY;
  list.forEach((q) => {
    const rank = parseRank(readValue(q));
    if (rank < bestRank) {
      bestRank = rank;
      best = [q];
    } else if (rank === bestRank) {
      best.push(q);
    }
  });
  return { quotes: best, rank: bestRank };
}

function isOffScopeQuestion(text) {
  const t = text.toLowerCase();
  if (/\b(create|build|make|generate|start|set up|setup)\b.{0,48}\bcompar/.test(t)) {
    return true;
  }
  if (/\bcompar.{0,48}\b(create|build|make|generate)\b/.test(t)) return true;
  if (/\bbind\b/.test(t)) return true;
  if (/\b(new|submit|send|open|start)\b.{0,24}\brfq\b/.test(t)) return true;
  if (/\bemail\b.{0,24}\bclient/.test(t)) return true;
  if (/\bschedule\b.{0,24}\b(meet|call|appoint)/.test(t)) return true;
  if (/\b(weather|password|recipe|sports|joke|stock market)\b/.test(t)) {
    return true;
  }
  return false;
}

function isComparisonQuestion(text, named) {
  if (named.length) return true;
  return /\b(quotes?|premiums?|prices?|costs?|cheap\w*|lowest|highest|deductibles?|coverages?|limits?|liability|carriers?|plans?|recommend\w*|best|oem|roadside|collision|comprehensive|wind|hail|oop|out-of-pocket|network|rx|copay|incumbent|expir\w*|compar\w*|versus|vs|difference|bodily|rental|forgiv\w*)\b/i.test(
    text
  );
}

function richReply({ intro, items, outro, metricLabel }) {
  return {
    isRich: true,
    intro,
    items,
    outro,
    metricLabel: metricLabel || 'Detail'
  };
}

function textReply(text) {
  return { text };
}

// Demo matcher over the quotes currently on the grid. Not an LLM: keyword
// plus carrier-name lookup, then a broker-voiced answer from that data.
function answerFromComparison(text, list, flow) {
  if (!list.length) {
    return textReply(
      'There are no quotes on this comparison yet. Open a market response to compare, then ask me again.'
    );
  }
  if (isOffScopeQuestion(text)) return textReply(OFF_SCOPE_REFUSAL);

  const named = quotesNamedIn(text, list);
  if (!isComparisonQuestion(text, named)) return textReply(OFF_SCOPE_REFUSAL);

  const t = text.toLowerCase();
  const recommended =
    list.find((q) => q.aiRecommendation?.bestValue) ||
    list.find((q) => q.recommended);

  if (/\b(recommend\w*|best value|best quote|which should i|what would you pick)\b/.test(t)) {
    if (!recommended) {
      return textReply(
        `I do not have a best-value pick on this comparison. ${summarizeGrid(list)}`
      );
    }
    const reason = recommended.aiRecommendation?.reason;
    return textReply(
      reason
        ? `${planFullName(recommended)} is the recommended option at ${fmtMoney(recommended.annualPremium)} a year. ${reason}`
        : `${planFullName(recommended)} is the recommended option at ${fmtMoney(recommended.annualPremium)} a year.`
    );
  }

  if (
    /\b(deductibles?|wind|hail|collision|comprehensive|luxury|out.?of.?network|\boon\b)\b/.test(t) &&
    !/\b(premium|price|cost)\b/.test(t)
  ) {
    const spec = deductibleField(list[0], flow, t);
    const pool = named.length ? named : list;
    const { quotes: lowest } = lowestBy(pool, (q) => readMetric(q, spec));
    if (!lowest.length || parseRank(readMetric(lowest[0], spec)) === Number.POSITIVE_INFINITY) {
      return textReply(
        `I do not see ${spec.label.toLowerCase()} on these quotes. Ask me about premium, coverage, or a named carrier instead.`
      );
    }
    return richReply({
      intro: `${lowest.length === 1 ? 'This quote has' : 'These quotes share'} the lowest ${spec.label.toLowerCase()}:`,
      metricLabel: spec.label,
      items: lowest.map((q, i) => ({
        id: `d${i}`,
        quote: planFullName(q),
        value: readMetric(q, spec) || '-'
      })),
      outro: recommended
        ? `${planFullName(recommended)} is still the recommended option at ${fmtMoney(recommended.annualPremium)} a year.`
        : 'Ask me about a named carrier if you want the rest of that column.'
    });
  }

  if (/\b(cheap\w*|lowest|least expensive|best price)\b/.test(t)) {
    const pool = named.length ? named : list;
    const cheap = pool.reduce(
      (lo, q) => (q.annualPremium < lo.annualPremium ? q : lo),
      pool[0]
    );
    const next = pool
      .filter((q) => q.id !== cheap.id)
      .sort((a, b) => a.annualPremium - b.annualPremium)[0];
    const warn =
      cheap.aiRecommendation?.bestValue === false
        ? ' That plan is not the recommended pick on coverage.'
        : '';
    const follow =
      recommended && recommended.id !== cheap.id
        ? ` ${planFullName(recommended)} is the recommended option at ${fmtMoney(recommended.annualPremium)}.`
        : next
          ? ` Next is ${planFullName(next)} at ${fmtMoney(next.annualPremium)}.`
          : '';
    return textReply(
      `${planFullName(cheap)} is the lowest annual premium at ${fmtMoney(cheap.annualPremium)}.${warn}${follow}`
    );
  }

  if (/\boem\b/.test(t)) {
    const yes = list.filter((q) => /^yes/i.test(String(q.oemParts || '')));
    if (!yes.length) {
      return textReply('None of the quotes on this comparison include an OEM parts guarantee.');
    }
    return richReply({
      intro: 'These quotes include OEM parts:',
      metricLabel: 'OEM parts',
      items: yes.map((q, i) => ({
        id: `o${i}`,
        quote: planFullName(q),
        value: q.oemParts
      })),
      outro: `${planFullName(yes[0])} is one option; ask me about premium if you want the cost trade-off.`
    });
  }

  const namedCarriers = [...new Set(named.map((q) => q.carrierId))];
  if (namedCarriers.length >= 2) {
    const groups = namedCarriers.map((id) => named.filter((q) => q.carrierId === id));
    const lines = groups.map((g) => {
      const q = g.slice().sort((a, b) => a.annualPremium - b.annualPremium)[0];
      return `${planFullName(q)} at ${fmtMoney(q.annualPremium)}`;
    });
    return textReply(
      `On this comparison: ${lines.join('; ')}. Ask me about deductibles or coverage if you want the rest of those columns.`
    );
  }

  if (named.length) {
    const byPrem = named.slice().sort((a, b) => a.annualPremium - b.annualPremium);
    return richReply({
      intro:
        byPrem.length === 1
          ? `${planFullName(byPrem[0])} is on this comparison:`
          : `${byPrem[0].carrierName} has ${byPrem.length} quotes on this comparison:`,
      metricLabel: 'Annual premium',
      items: byPrem.map((q, i) => ({
        id: `c${i}`,
        quote: planFullName(q),
        value: fmtMoney(q.annualPremium)
      })),
      outro: columnOutro(byPrem[0], flow)
    });
  }

  if (/\b(coverage|limit|liability|bodily|dwelling|oop|out-of-pocket)\b/.test(t)) {
    return textReply(coverageSummary(list, flow, recommended));
  }

  return textReply(
    `${summarizeGrid(list)}${
      recommended
        ? ` ${planFullName(recommended)} is the recommended option.`
        : ''
    } Ask me about a specific carrier, premium, or deductible.`
  );
}

function summarizeGrid(list) {
  const cheap = list.reduce(
    (lo, q) => (q.annualPremium < lo.annualPremium ? q : lo),
    list[0]
  );
  const names = [...new Set(list.map((q) => q.carrierName))];
  return `This comparison has ${list.length} quotes from ${oxfordJoin(names)}. Lowest premium is ${planFullName(cheap)} at ${fmtMoney(cheap.annualPremium)}.`;
}

function columnOutro(q, flow) {
  if (flow === 'home') {
    return `Wind / hail deductible is ${q.windHailDeductible || '-'} and the dwelling limit is ${q.dwellingLimit || '-'}.`;
  }
  if (flow === 'eb') {
    const inn = ebBenefit(q, 'med-ded-ind', 'in_network') || q.inDedInd || q.deductible;
    const oon = ebBenefit(q, 'med-ded-ind', 'out_of_network') || q.oonDedInd;
    return `In-network individual deductible is ${inn || '-'}${oon ? `; out-of-network is ${oon}` : ''}.`;
  }
  return `Bodily injury is ${q.bodilyInjury || '-'} and collision deductible is ${q.collisionDeductible || '-'}.`;
}

function coverageSummary(list, flow, recommended) {
  if (flow === 'home') {
    const lead = recommended || list[0];
    return `${planFullName(lead)} quotes the dwelling at ${lead.dwellingLimit || '-'} with a ${lead.windHailDeductible || '-'} wind / hail deductible. Ask me about another carrier to compare those limits.`;
  }
  if (flow === 'eb') {
    const lead = recommended || list[0];
    const inn = ebBenefit(lead, 'med-ded-ind', 'in_network') || lead.inDedInd;
    const oop = ebBenefit(lead, 'med-oop-ind', 'in_network') || lead.inOopInd;
    return `${planFullName(lead)} has a ${inn || '-'} in-network individual deductible and a ${oop || '-'} in-network out-of-pocket max. Ask me about another plan to compare those figures.`;
  }
  const lead = recommended || list[0];
  return `${planFullName(lead)} quotes ${lead.bodilyInjury || '-'} bodily injury and ${lead.umUim || '-'} UM/UIM. Ask me about another carrier to compare those limits.`;
}

/**
 * c-quote-comparison-modal - opens straight into the side-by-side plan
 * comparison grid (every plan the markets returned for this application).
 * There is no tile/card picker and no manual-compare step: the grid IS the
 * comparison. Selecting a plan routes to the Email-to-Client proposal view.
 */
export default class QuoteComparisonModal extends LightningElement {
  @api applicationId;
  @api applicationName;
  @api accountName;
  @api accountId;
  // 'pa' | 'eb' - forwarded into <c-quote-compare-table> to swap its
  // section/row set.
  @api flow = 'pa';
  // Line of coverage the compared RFQ was submitted on ('Personal
  // Auto', 'Renters', 'Homeowners', 'Group Medical', ...). Drives
  // the agent greeting noun and every coverage noun in the proposal.
  @api lineLabel = 'Personal Auto';
  // Optional subset of quote ids to compare (checked rows in the RFQ
  // table). Empty → compare every quote for the application.
  @api selectedQuoteIds = [];

  @track innerView = VIEW_GRID;
  // Quote ids ticked for the proposal. Multi-select: the broker can send
  // one carrier or the whole shortlist in a single email, so this is an
  // array rather than a single accepted id.
  @track pickedQuoteIds = [];
  // In-modal preview of the attached comparison PDF. Lives inside this
  // dialog rather than stacking a second slds-modal (SLDS: one modal).
  @track pdfPreviewOpen = false;

  // Contextual insurance-agent chat - docks to the right of the grid
  // when the broker hits "Ask an Agent". Greeting is line-aware;
  // refreshed every time the modal opens.
  @track isAgentforceOpen = false;
  @track chatMessages = [];
  @track chatInput = '';
  // Toggle that surfaces the three-dot typing indicator while the
  // agent reply is composing.
  @track agentTyping = false;
  _chatTimers = [];

  // Re-derive the entry view each time the modal opens (the element stays
  // mounted at the app shell; only `open` toggles its visibility).
  _open = false;
  @api
  get open() {
    return this._open;
  }
  set open(value) {
    const wasOpen = this._open;
    this._open = value;
    if (value && !wasOpen) {
      this.innerView = VIEW_GRID;
      this.pickedQuoteIds = [];
      this.pdfPreviewOpen = false;
      // Reset the chat state every time the modal re-opens. The
      // greeting starts only when the chat panel itself is opened
      // (handleAskAgentforce), not on modal mount, so brokers who don't
      // open the panel never see the timers fire.
      this._cancelChatPlayback();
      this.chatMessages = [];
      this.agentTyping = false;
      this.chatInput = '';
      this.isAgentforceOpen = false;
    }
  }

  // Row set the child grid renders. Only the flows the grid actually
  // ships are passed through; anything unrecognised falls back to 'pa'
  // rather than rendering an empty grid.
  get effectiveFlow() {
    return COMPARE_FLOWS.has(this.flow) ? this.flow : 'pa';
  }

  // Which compare-table layout to render. Looks up the RFQ's
  // applicationId in a small mockData map; RFQs not registered fall
  // back to the app-wide default ('benefit-first' - each benefit
  // attribute is a header with its tiers as indented sub-rows,
  // matching the RFQ Benefits screen). Only EB flows honour the
  // benefit-first variant on the child - PA is unaffected.
  get compareLayout() {
    const map = COMPARE_LAYOUT_BY_APPLICATION_ID || {};
    return map[this.applicationId] || 'benefit-first';
  }

  get isGridView() {
    return this.innerView === VIEW_GRID;
  }

  get isEmailView() {
    return this.innerView === VIEW_EMAIL;
  }

  // The grid is full-width; the email proposal reads better at large.
  get modalClass() {
    const size = this.isGridView ? 'slds-modal_full' : 'slds-modal_large';
    return `slds-modal ${size} slds-fade-in-open`;
  }

  get accountLabel() {
    return this.accountName || 'Mavericks Household';
  }

  get modalTitle() {
    if (this.isEmailView) {
      const picked = this.pickedQuotes;
      if (picked.length === 1) {
        return `Email Proposal · ${picked[0].carrierName}`;
      }
      if (picked.length > 1) {
        return `Email Proposal · ${picked.length} quotes`;
      }
      return `Email Proposal · ${this.accountLabel}`;
    }
    return `Compare Market Responses: ${this.accountLabel} - ${this.lineLabel}`;
  }

  // Every plan quote for this application - the grid columns.
  get allEligibleIds() {
    return quotes
      .filter((q) => q.applicationId === this.applicationId)
      .map((q) => q.id);
  }

  // Grid columns: the checked subset when provided, otherwise every plan.
  get gridQuoteIds() {
    return this.selectedQuoteIds && this.selectedQuoteIds.length
      ? this.selectedQuoteIds
      : this.allEligibleIds;
  }

  // ── Selection (one or many quotes for the proposal) ─────────────
  // Resolved in grid-column order so the email lists carriers in the
  // same left-to-right order the broker just compared them in.
  get pickedQuotes() {
    const picked = new Set(this.pickedQuoteIds || []);
    return this.gridQuoteIds
      .filter((id) => picked.has(id))
      .map((id) => quotes.find((q) => q.id === id))
      .filter(Boolean);
  }

  get pickedCount() {
    return this.pickedQuotes.length;
  }

  get hasPicked() {
    return this.pickedCount > 0;
  }

  get nothingPicked() {
    return this.pickedCount === 0;
  }

  get isAllPicked() {
    const total = this.gridQuoteIds.length;
    return total > 0 && this.pickedCount === total;
  }

  get selectAllLabel() {
    return this.isAllPicked ? 'Clear all' : 'Select all';
  }

  get selectionSummary() {
    const total = this.gridQuoteIds.length;
    if (!this.pickedCount) {
      return `No quotes selected · ${total} in this comparison`;
    }
    // The noun agrees with the total, not the picked count - it is the
    // seven that are being counted from ("1 of 7 quotes selected").
    const noun = total === 1 ? 'quote' : 'quotes';
    return `${this.pickedCount} of ${total} ${noun} selected`;
  }

  // Lead carrier for the proposal header and the recommendation line:
  // the AI-recommended quote when it is in the selection, else the
  // left-most ticked column.
  get primaryQuote() {
    const picked = this.pickedQuotes;
    if (!picked.length) return null;
    return picked.find((q) => q.aiRecommendation?.bestValue) || picked[0];
  }

  get emailView() {
    const picked = this.pickedQuotes;
    const lead = this.primaryQuote;
    if (!lead) return null;

    // The proposal goes to the account's own principal contact. This
    // used to be hardcoded to James Mavericks, so a Whitfield or Acme
    // proposal was addressed to the Mavericks named insured.
    const principal = getAccountPrincipal(this.accountId);

    const names = picked.map((q) => q.carrierName);
    const carriersDisplay = oxfordJoin(names);
    const isSingle = picked.length === 1;
    const line = this.lineLabel || 'Personal Auto';
    const copy = LINE_COPY[line] || LINE_COPY.default;

    const subject = `Your 2026 ${this.accountLabel} ${line} renewal options`;

    return {
      carriersDisplay,
      isSingle,
      count: picked.length,
      recipientName: principal?.name || this.accountLabel,
      recipientEmail: principal?.email || '',
      subject,
      // One stable filename regardless of how many carriers made the
      // shortlist - the old name encoded the carrier count, so the
      // attachment renamed itself as the broker changed their picks.
      attachmentName: 'QuoteComparison.pdf',
      body: this._buildProposalBody(picked, lead, copy, line)
    };
  }

  get pdfPreviewTitle() {
    return this.emailView?.attachmentName || 'QuoteComparison.pdf';
  }

  get pdfPreviewAriaExpanded() {
    return this.pdfPreviewOpen ? 'true' : 'false';
  }

  get pdfPreviewMeta() {
    const line = this.lineLabel || 'Personal Auto';
    const stamp = formatUsDate(today());
    return `${this.accountLabel} · ${line} · ${stamp}`;
  }

  // ── PDF sheet ───────────────────────────────────────────────────
  // The attachment reads as a spreadsheet export of the comparison:
  // attributes down the first column, one column per shortlisted
  // carrier, grouped by the same bands the on-screen grid uses. The
  // section definitions are imported from c-quote-compare-table rather
  // than restated here, so the sheet cannot drift from the grid.
  //
  // Carries no Agentforce content - no recommendation column, no
  // insight rows. It is the raw comparison a broker would hand to a
  // client, and the AI read stays in the app.

  // Column headers: one per picked quote, so two picks give two
  // columns and five give five.
  get pdfCarrierColumns() {
    return this.pickedQuotes.map((q) => ({
      id: q.id,
      name: planFullName(q)
    }));
  }

  // Attribute bands for the active flow. EB benefit attributes are
  // tier-scoped, so each tier present across the picked quotes becomes
  // its own band, mirroring the grid's tier bands.
  get _pdfSectionDefs() {
    const flow = this.effectiveFlow;
    if (flow === 'home') return HOME_SECTIONS;
    if (flow !== 'eb') return PA_SECTIONS;

    const tiers = this._pdfEbTiers();
    return [
      { id: 'plan', label: 'Plan Information', rows: EB_PLAN_ROWS },
      ...tiers.map((t) => ({
        id: `tier-${t.id}`,
        label: t.label,
        rows: EB_BENEFIT_ATTRS.map((a) => ({
          key: a.key,
          label: a.label,
          tierId: t.id
        }))
      }))
    ];
  }

  // Tiers with data on at least one picked quote, canonical ids first.
  _pdfEbTiers() {
    const present = [];
    for (const q of this.pickedQuotes) {
      const benefits = q.benefits || {};
      for (const attr of Object.keys(benefits)) {
        for (const tierId of Object.keys(benefits[attr] || {})) {
          if (!present.includes(tierId)) present.push(tierId);
        }
      }
    }
    const known = EB_TIER_ORDER.filter((t) => present.includes(t.id));
    const knownIds = new Set(EB_TIER_ORDER.map((t) => t.id));
    const custom = present
      .filter((id) => !knownIds.has(id))
      .map((id) => ({ id, label: id }));
    return [...known, ...custom];
  }

  // A cell's display value. Quote fixtures already hold display-ready
  // strings, so this only has to reach the tier-nested EB shape and
  // dash out anything absent.
  _pdfCellValue(q, def) {
    const raw = def.tierId
      ? q.benefits?.[def.key]?.[def.tierId]
      : q[def.key];
    if (raw == null || raw === '') return '-';
    return String(raw);
  }

  get pdfSheetSections() {
    const cols = this.pickedQuotes;
    if (!cols.length) return [];

    const premium = {
      id: 'premium',
      label: 'Premium',
      rows: [
        {
          key: 'annualPremium',
          label: 'Annual Premium',
          rowClass: 'qm-pdf__row qm-pdf__row_total',
          cells: cols.map((q) => ({
            id: `annualPremium-${q.id}`,
            value: fmtMoney(q.annualPremium)
          }))
        }
      ]
    };

    const bands = this._pdfSectionDefs.map((section) => ({
      id: section.id,
      label: section.label,
      rows: section.rows
        .map((def) => ({
          key: `${section.id}-${def.key}${def.tierId || ''}`,
          label: def.label,
          rowClass: 'qm-pdf__row',
          cells: cols.map((q) => ({
            id: `${section.id}-${def.key}-${q.id}`,
            value: this._pdfCellValue(q, def)
          }))
        }))
        // A row every carrier leaves blank is noise on a printed
        // sheet, so it drops out the way it does on the grid.
        .filter((row) => row.cells.some((c) => c.value !== '-'))
    }));

    return [premium, ...bands.filter((s) => s.rows.length > 0)];
  }

  // Proposal copy. Shaped around the shortlist: an opening that names
  // the carriers, a middle paragraph that positions the recommended /
  // cheapest / incumbent options against each other, then the ask.
  // Every coverage noun comes from LINE_COPY so a Renters proposal
  // talks about personal property rather than liability limits.
  _buildProposalBody(picked, lead, copy, line) {
    const names = picked.map((q) => q.carrierName);
    const countWord = COUNT_WORDS[picked.length] || String(picked.length);
    const optionNoun = picked.length === 1 ? 'option' : 'options';
    const openLine = `We reviewed your upcoming ${line} renewal and shortlisted ${countWord} ${optionNoun} from ${oxfordJoin(
      names
    )}.`;

    const cheapest = picked.reduce(
      (lo, q) => (q.annualPremium < lo.annualPremium ? q : lo),
      picked[0]
    );
    const incumbent = picked.find((q) => q.incumbent);
    const used = new Set([lead.id]);
    const sentences = [
      `${planFullName(lead)} provides the strongest balance of coverage and value and is our recommended option.`
    ];

    const tail = [];
    if (cheapest && !used.has(cheapest.id)) {
      used.add(cheapest.id);
      tail.push(
        `${planFullName(cheapest)} has the lowest annual premium but lower ${copy.limitNoun}`
      );
    }
    const rest = picked.filter((q) => !used.has(q.id));
    if (rest.length) {
      const familiar = incumbent && !used.has(incumbent.id) ? incumbent : null;
      const others = familiar ? [familiar] : rest;
      const label = oxfordJoin(others.map(planFullName));
      const verb = others.length === 1 ? 'provides' : 'provide';
      tail.push(
        `${label} ${verb} a ${familiar ? 'familiar, ' : ''}balanced alternative`
      );
    }
    if (tail.length === 1) {
      sentences.push(`${tail[0]}.`);
    } else if (tail.length > 1) {
      sentences.push(`${tail[0]}, while ${tail.slice(1).join(', ')}.`);
    }

    const middle = `The attached ${
      picked.length === 1 ? 'proposal' : 'proposals'
    } and side-by-side comparison summarize ${copy.summaryNouns}. ${sentences.join(
      ' '
    )}`;

    return `Hi James,\n\n${openLine}\n\n${middle}\n\nPlease review the ${optionNoun} before our renewal meeting. We can walk through the trade-offs and confirm the policy that best fits your needs.\n\nRegards,\nElena`;
  }

  // ── Handlers ────────────────────────────────────────────────────
  // Per-column toggle from the grid. Additive: ticking a second column
  // keeps the first, so a shortlist can go out in one email.
  handleQuoteToggle(event) {
    const quoteId = event.detail?.quoteId;
    if (!quoteId) return;
    const next = new Set(this.pickedQuoteIds || []);
    if (next.has(quoteId)) {
      next.delete(quoteId);
    } else {
      next.add(quoteId);
    }
    this.pickedQuoteIds = Array.from(next);
  }

  // Header control: all-or-nothing across every compared column.
  handleToggleSelectAll() {
    this.pickedQuoteIds = this.isAllPicked ? [] : [...this.gridQuoteIds];
  }

  // Footer CTA - carries the whole selection into the compose view.
  handleEmailToClient() {
    if (!this.hasPicked) return;
    this.innerView = VIEW_EMAIL;
    requestAnimationFrame(() => {
      const body = this.template.querySelector('.slds-modal__content');
      if (body && typeof body.scrollTo === 'function') {
        body.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  handleSendEmail() {
    this.pdfPreviewOpen = false;
    // Tell the shell what went out. It closes this modal, toasts the
    // confirmation, then schedules the client's reply into the
    // notification tray, so the broker sees the response arrive the
    // same way carrier quotes do.
    const v = this.emailView;
    if (!v) return;
    this.dispatchEvent(
      new CustomEvent('proposalsent', {
        detail: {
          accountId: this.accountId,
          accountName: this.accountLabel,
          recipientName: v.recipientName,
          recipientEmail: v.recipientEmail,
          subject: v.subject,
          carriersDisplay: v.carriersDisplay,
          leadCarrier: this.primaryQuote?.carrierName || '',
          lineLabel: this.lineLabel || ''
        },
        bubbles: true,
        composed: true
      })
    );
  }

  // Back to the grid keeps the ticked columns so the broker can adjust
  // the shortlist rather than rebuild it.
  handleBackToCompare() {
    this.pdfPreviewOpen = false;
    this.innerView = VIEW_GRID;
  }

  handleOpenPdfPreview(event) {
    event.preventDefault();
    event.stopPropagation();
    this.pdfPreviewOpen = true;
    // Stacked dialog, so focus has to follow it or Escape and the tab
    // order stay behind in the compose view. renderedCallback does the
    // move once the section actually exists.
    this._focusPdfDialog = true;
  }

  handleClosePdfPreview(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.pdfPreviewOpen = false;
  }

  renderedCallback() {
    if (!this._focusPdfDialog) return;
    const dialog = this.template.querySelector('[data-pdf-dialog]');
    if (!dialog) return;
    this._focusPdfDialog = false;
    dialog.focus();
  }

  // Escape while focus is still in the comparison modal - the eye button
  // that opens the preview lives there, so this fires when the broker
  // hits Escape without having moved focus into the preview yet.
  handleModalKeydown(event) {
    if (event.key !== 'Escape') return;
    if (this.pdfPreviewOpen) {
      event.stopPropagation();
      this.pdfPreviewOpen = false;
    }
  }

  // Escape inside the stacked preview closes only the preview, leaving
  // the compose view and its half-written email untouched underneath.
  handlePdfKeydown(event) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    this.pdfPreviewOpen = false;
  }

  // ── Contextual insurance-agent chat ─────────────────────────────
  // Layout flag: the grid container becomes 2-of-3 width when the chat
  // panel is docked open; otherwise it spans the full body.
  // Grid view hands its vertical scroll to the comparison table, so the
  // body is a fixed frame rather than a scroller. The email views keep
  // the body as the scroller, since their content is plain flow.
  get contentClass() {
    const base = 'slds-modal__content slds-p-around_medium';
    return this.isGridView ? `${base} qm-content_grid` : base;
  }

  get gridColClass() {
    return this.isAgentforceOpen
      ? 'qm-grid-col qm-grid-col_split'
      : 'qm-grid-col';
  }
  // View-model for the message stream - one decorated entry per message
  // with author-aware classes so the template stays declarative.
  get chatBubbles() {
    return this.chatMessages.map((m) => ({
      ...m,
      rowClass:
        m.author === 'agent'
          ? 'qm-chat__row qm-chat__row_agent'
          : 'qm-chat__row qm-chat__row_user',
      bubbleClass:
        m.author === 'agent'
          ? 'qm-chat__bubble qm-chat__bubble_agent'
          : 'qm-chat__bubble qm-chat__bubble_user',
      isAgent: m.author === 'agent',
      isUser: m.author === 'user',
      isRich: !!m.isRich,
      metricLabel: m.metricLabel || 'Detail'
    }));
  }

  get isSendDisabled() {
    return !this.chatInput.trim();
  }

  handleAskAgentforce() {
    const opening = !this.isAgentforceOpen;
    this.isAgentforceOpen = opening;
    if (opening) {
      this._playSeedConversation();
    } else {
      this._cancelChatPlayback();
    }
  }
  handleCloseAgentforce() {
    this.isAgentforceOpen = false;
    this._cancelChatPlayback();
  }

  // Greeting only. The fake Q&A transcript is gone; the broker types
  // next. Timers are tracked so closing the panel mid-flight cancels
  // the pending greeting (and any in-flight reply).
  _playSeedConversation() {
    this._cancelChatPlayback();
    this.chatMessages = [];
    this.agentTyping = false;
    this._chatTimers = [];
    const greet = {
      id: 'm1',
      author: 'agent',
      text: `Hi, I'm your insurance agent. Ask me anything about ${greetingNoun(this.lineLabel)}.`,
      time: nowLabel()
    };
    this._chatTimers.push(
      setTimeout(() => {
        this.chatMessages = [greet];
        this._scrollChatToBottom();
      }, 400)
    );
  }

  _cancelChatPlayback() {
    if (Array.isArray(this._chatTimers)) {
      this._chatTimers.forEach((t) => clearTimeout(t));
    }
    this._chatTimers = [];
    this.agentTyping = false;
  }

  disconnectedCallback() {
    this._cancelChatPlayback();
  }
  handleChatInput(event) {
    this.chatInput = event.target.value;
  }
  handleChatKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.handleSendChat();
    }
  }
  handleSendChat() {
    const text = this.chatInput.trim();
    if (!text) return;
    const userMsg = {
      id: `m-${Date.now()}`,
      author: 'user',
      text,
      time: nowLabel()
    };
    this.chatMessages = [...this.chatMessages, userMsg];
    this.chatInput = '';
    this._scrollChatToBottom();
    this.agentTyping = true;
    this._scrollChatToBottom();
    const list = this.gridQuoteIds
      .map((id) => quotes.find((q) => q.id === id))
      .filter(Boolean);
    const reply = answerFromComparison(text, list, this.effectiveFlow);
    this._chatTimers.push(
      setTimeout(() => {
        this.agentTyping = false;
        this.chatMessages = [
          ...this.chatMessages,
          {
            id: `${userMsg.id}-r`,
            author: 'agent',
            time: nowLabel(),
            ...reply
          }
        ];
        this._scrollChatToBottom();
      }, 1100)
    );
  }
  _scrollChatToBottom() {
    requestAnimationFrame(() => {
      const body = this.template.querySelector('.qm-chat__body');
      if (body) body.scrollTop = body.scrollHeight;
    });
  }

  handleClose() {
    this.pdfPreviewOpen = false;
    this.dispatchEvent(new CustomEvent('close'));
  }

  handleBackdrop() {
    if (this.pdfPreviewOpen) {
      this.pdfPreviewOpen = false;
      return;
    }
    this.dispatchEvent(new CustomEvent('close'));
  }

  // Stop bubble inside the modal panel so a click on the body never
  // triggers the backdrop's close handler.
  handlePanelClick(event) {
    event.stopPropagation();
  }
}
