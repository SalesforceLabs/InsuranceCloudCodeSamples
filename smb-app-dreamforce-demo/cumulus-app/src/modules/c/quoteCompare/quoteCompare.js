import { LightningElement, api, track } from 'lwc';
import { compareQuotes } from 'data/api';
import { formatUsDateOrDash } from 'data/dates';

function fmtMoney(n) {
  if (n == null) return '-';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  });
}

function fmtDate(iso) {
  return formatUsDateOrDash(iso);
}

const VIEW_RECOMMENDED = 'recommended';
const VIEW_ALL = 'all';

export default class QuoteCompare extends LightningElement {
  @api applicationId = 'rfq-mavericks-001';
  @api applicationName = 'Mavericks Household - 2026 Personal Auto Renewal';
  // 'pa' | 'eb' - controls which dl rows are rendered and whether the
  // Export to Spreadsheet utility row appears.
  @api flow = 'pa';

  @track loading = true;
  @track quotes = [];

  // ── View state ──────────────────────────────────────────────────
  // 'recommended' (default, AI-curated 3) | 'all' (every market).
  @track currentView = VIEW_RECOMMENDED;
  // Manual multi-select compare (All Markets view only).
  @track isManualCompareMode = false;
  @track selectedCompareIds = [];

  async connectedCallback() {
    try {
      const result = await compareQuotes({ applicationId: this.applicationId });
      this.quotes = result.quotes;
    } finally {
      this.loading = false;
    }
  }

  get isEbFlow() {
    return this.flow === 'eb';
  }

  // ── View flags ──────────────────────────────────────────────────
  get isRecommendedView() {
    return this.currentView === VIEW_RECOMMENDED;
  }
  get isAllView() {
    return this.currentView === VIEW_ALL;
  }

  // ── Quote sets ──────────────────────────────────────────────────
  // AI-curated set: explicit `recommended` flags, falling back to the
  // best-value pick(s), then the first three so EB (no flags) still works.
  get recommendedQuotes() {
    const flagged = this.quotes.filter((q) => q.recommended);
    if (flagged.length) return flagged;
    const best = this.quotes.filter((q) => q.aiRecommendation?.bestValue);
    if (best.length) return best;
    return this.quotes.slice(0, 3);
  }

  get recommendedIds() {
    return this.recommendedQuotes.map((q) => q.id);
  }

  get displayedQuotes() {
    return this.isRecommendedView ? this.recommendedQuotes : this.quotes;
  }

  // ── Tab bar ─────────────────────────────────────────────────────
  get tabs() {
    return [
      {
        id: VIEW_RECOMMENDED,
        label: 'Agentforce Recommended',
        count: this.recommendedQuotes.length,
        isRecommended: true,
        className:
          'qc-tab' + (this.isRecommendedView ? ' is-active' : ''),
        ariaSelected: this.isRecommendedView ? 'true' : 'false'
      },
      {
        id: VIEW_ALL,
        label: 'All Markets',
        count: this.quotes.length,
        isRecommended: false,
        className: 'qc-tab' + (this.isAllView ? ' is-active' : ''),
        ariaSelected: this.isAllView ? 'true' : 'false'
      }
    ];
  }

  get recommendedBannerText() {
    return `Agentforce analyzed ${this.quotes.length} quotes based on your client's prior limits and selected these ${this.recommendedQuotes.length} as the strongest options.`;
  }

  // ── Manual compare header ───────────────────────────────────────
  get compareSelectedLabel() {
    return `Compare Selected (${this.selectedCompareIds.length})`;
  }
  get compareSelectedDisabled() {
    return this.selectedCompareIds.length < 2;
  }

  // ── Card view models ────────────────────────────────────────────
  get cardData() {
    const manual = this.isManualCompareMode && this.isAllView;
    return this.displayedQuotes.map((q) => {
      const bestValue = !!q.aiRecommendation?.bestValue;
      const isChecked = this.selectedCompareIds.includes(q.id);

      let cardClass = 'q-card';
      if (bestValue) cardClass += ' is-best';
      if (manual) cardClass += ' is-selectable';
      if (manual && isChecked) cardClass += ' is-checked';

      return {
        ...q,
        bestValue,
        isChecked,
        showCheckbox: manual,
        checkboxId: `qc-check-${q.id}`,
        cardClass,
        formattedPremium: fmtMoney(q.annualPremium),
        validUntilLabel: fmtDate(q.validUntil),
        logoInitial: q.carrierName.charAt(0),
        logoStyle: `background:${q.carrierAccent}`,
        recoTimestamp: bestValue ? 'Today at 9:33 AM' : null
      };
    });
  }

  // ── Tab handlers ────────────────────────────────────────────────
  handleTab(event) {
    const id = event.currentTarget.dataset.id;
    if (id !== VIEW_RECOMMENDED && id !== VIEW_ALL) return;
    this.currentView = id;
    // Leaving/entering a view always resets manual compare.
    this.isManualCompareMode = false;
    this.selectedCompareIds = [];
  }

  // ── Select -> Bind ──────────────────────────────────────────────
  handleSelect(event) {
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this.dispatchEvent(new CustomEvent('bind', { detail: { quoteId: id } }));
  }

  // ── View Details (recommended) -> open table with the 3 reco quotes ─
  handleViewDetails(event) {
    event.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('comparequotes', {
        detail: { quoteIds: this.recommendedIds }
      })
    );
  }

  // ── Manual compare (All Markets) ────────────────────────────────
  handleCompareManually() {
    this.isManualCompareMode = true;
    this.selectedCompareIds = [];
  }

  handleCancelManual() {
    this.isManualCompareMode = false;
    this.selectedCompareIds = [];
  }

  handleToggleCheck(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    if (this.selectedCompareIds.includes(id)) {
      this.selectedCompareIds = this.selectedCompareIds.filter((x) => x !== id);
    } else {
      this.selectedCompareIds = [...this.selectedCompareIds, id];
    }
  }

  handleCompareSelected() {
    if (this.selectedCompareIds.length < 2) return;
    this.dispatchEvent(
      new CustomEvent('comparequotes', {
        detail: { quoteIds: [...this.selectedCompareIds] }
      })
    );
  }

  handleExportSpreadsheet() {
    // Stub - would call a real Connect API endpoint in production.
    // eslint-disable-next-line no-console
    console.log('[stub] Export to Spreadsheet', this.displayedQuotes.map((q) => q.id));
  }
}
