import { LightningElement, api, track } from 'lwc';
import {
  getClient360,
  getClient360Accounts,
  CLIENT360_LOB_OPTIONS
} from 'data/client360';
import {
  formatUsDate,
  formatUsDateOrDash,
  today as baseToday
} from 'data/dates';

/**
 * c-client-360-dashboard - single-pane "Client 360". KPI banner +
 * premium-history column chart + billing summary + Active Policies /
 * Upcoming Renewals / Open Cases / Claims Summary / Open Tasks tables.
 *
 * Tabnext (CRM Analytics) layout rendered with SLDS 2 tokens. Data is
 * mock for now (data/client360); the fixture documents the FSC SOQL
 * each section maps to so the Apex swap is mechanical.
 *
 * Two modes:
 *   - Embedded (default): mounted on the Account record page with
 *     `account-id` bound to the active account. Account is fixed; only
 *     the Line of Business filter shows.
 *   - Standalone: opened from the App Launcher with `standalone`. The
 *     toolbar adds an Account picker (defaults to the first account
 *     with a 360 payload) so the user can switch accounts in place.
 *
 * @api account-id  - the Account to render (embedded mode).
 * @api standalone  - render the Account picker + self-select account.
 */

// SVG chart geometry (viewBox units). Single source of truth so the
// getter math and the template axis lines agree.
const CHART = {
  width: 600,
  height: 220,
  padTop: 24, // room for the amount label above the tallest bar
  padBottom: 28, // room for the year label under the baseline
  padLeft: 8,
  padRight: 8,
  barMaxWidth: 96
};

// The premium tile spans two columns, so its chart gets its own box
// rather than sharing CHART with the detail-view trend chart.
//
// Width drives height here, and it has caught us three times now. A
// viewBox'd SVG sized `width: 100%; height: auto` renders at
// `width * viewBoxHeight / viewBoxWidth`, so height is a consequence of
// width and the only lever is this ratio: a CSS height letterboxes
// instead of growing the bars. At two columns the tile renders ~983px
// wide, so 252/840 lands the chart at ~295px, just under the 370px row
// its KPI neighbour sets. The same mapping scales the SVG text, which is
// why the width is 840 and not 600: it keeps the uniform scale near 1 so
// the labels stay on the type scale at every breakpoint.
const PREMIUM_CHART = { ...CHART, width: 840, height: 252 };

const URGENT_DAYS = 30; // renewals within this window get the urgent style

export default class Client360Dashboard extends LightningElement {
  _accountId;
  @api standalone = false;
  @track lobFilter = 'all';
  @track _selectedAccountId = null; // standalone-mode selection
  @track _data = null;

  // ── Metric detail drill-down state ──────────────────────────
  // Mirrors the TabNext reference where clicking a KPI card opens a
  // dedicated detail page. Here we render that detail view inline,
  // replacing the dashboard, so it works in embedded + standalone modes
  // without touching the host record-page tab system.
  @track _activeMetricId = null; // 'active' | 'premium' | 'commission' | 'outstanding'
  @track _detailLob = 'all'; // sidebar LOB filter (independent of dashboard filter)
  @track _detailDimension = 'lob'; // breakdown tab: 'lob' | 'policy'
  // Focus management for the dashboard ↔ detail view transition.
  // `_pendingFocus` is read once in renderedCallback then cleared so
  // we don't steal focus on unrelated re-renders (filter changes etc).
  // `_lastFocusedMetric` remembers which tile launched the detail view
  // so we can return focus to it when the user clicks Back.
  _pendingFocus = null; // 'detail' | 'tile' | null
  _lastFocusedMetric = null;
  // Visually-hidden polite live region copy. Updated when the view
  // changes so screen-reader users hear "Viewing Total Premium
  // details" / "Returned to dashboard" instead of silent context loss.
  @track _statusAnnouncement = '';

  @api
  get accountId() {
    return this._accountId;
  }
  set accountId(value) {
    this._accountId = value;
    this._resolve();
  }

  connectedCallback() {
    // Standalone mode opens on the account the broker came from, so
    // launching Client 360 while standing on an account does not swap
    // the subject out from under them. It used to take the first entry
    // in the picker unconditionally, which meant every launch showed
    // Mavericks regardless of the open account.
    //
    // The picker only lists accounts that have a payload, so an account
    // without one is not a selectable value - fall back to the first
    // entry rather than leaving the picker showing something it cannot
    // represent.
    if (this.standalone && !this._selectedAccountId) {
      const accts = getClient360Accounts();
      const fromHost = accts.some((a) => a.value === this._accountId)
        ? this._accountId
        : null;
      this._selectedAccountId =
        fromHost || (accts.length ? accts[0].value : null);
    }
    this._resolve();
  }

  // Account in scope - the picker selection when standalone, else the
  // record-page-bound id.
  get effectiveAccountId() {
    return this.standalone ? this._selectedAccountId : this._accountId;
  }

  _resolve() {
    const id = this.effectiveAccountId;
    this._data = id ? getClient360(id, this.lobFilter) : null;
  }

  get hasData() {
    return !!this._data;
  }

  // Standalone mode is its own page, so the canvas owns the surface.
  // Embedded, the host record-page panel (.sf-body-main) already owns
  // it, so the canvas drops its surface, gutter and radius instead of
  // stacking a second one inside the panel card.
  get canvasClass() {
    return this.standalone
      ? 'c360-canvas'
      : 'c360-canvas c360-canvas_embedded';
  }

  // ── Toolbar ──────────────────────────────────────────────────
  get lobOptions() {
    return CLIENT360_LOB_OPTIONS.slice();
  }
  get accountOptions() {
    return getClient360Accounts();
  }
  get selectedAccountId() {
    return this._selectedAccountId;
  }
  handleLobChange(event) {
    this.lobFilter = event.detail.value;
    this._resolve();
  }
  handleAccountChange(event) {
    this._selectedAccountId = event.detail.value;
    this._resolve();
    // Switching accounts always returns to the dashboard view.
    this._activeMetricId = null;
  }

  // ── View routing: dashboard vs metric detail ─────────────────
  get isDetailView() {
    return !!this._activeMetricId;
  }
  get isDashboardView() {
    return !this._activeMetricId;
  }

  // KPI tile click - drill into the metric detail view.
  handleKpiOpen(event) {
    const id = event.currentTarget?.dataset?.metric;
    if (!id) return;
    const tile = this.kpiTiles.find((t) => t.id === id);
    this._lastFocusedMetric = id;
    this._activeMetricId = id;
    this._detailLob = 'all';
    this._detailDimension = 'lob';
    this._pendingFocus = 'detail';
    this._statusAnnouncement = tile
      ? `Viewing ${tile.label} details`
      : 'Viewing metric details';
  }
  handleBackToDashboard() {
    this._activeMetricId = null;
    this._pendingFocus = 'tile';
    this._statusAnnouncement = 'Returned to Client 360 dashboard';
  }
  // Move focus across view transitions so keyboard + SR users are
  // taken to the new context (back button on drill-in, originating
  // tile on drill-out) instead of being stranded on a hidden node.
  renderedCallback() {
    if (!this._pendingFocus) return;
    const target = this._pendingFocus;
    this._pendingFocus = null;
    if (target === 'detail') {
      const back = this.template.querySelector('.c360-detail__back');
      if (back) back.focus();
    } else if (target === 'tile') {
      // The tile is now an <article>; focus the per-card menu button
      // (chevron) which is the first interactive element in tab order.
      const sel = `.c360-kpi__menu-btn[data-metric="${this._lastFocusedMetric}"]`;
      const tile = this.template.querySelector(sel);
      if (tile) tile.focus();
    }
  }
  // Detail-view live region accessor - hides empty initial state so
  // screen readers don't read placeholder text on first render.
  get statusAnnouncement() {
    return this._statusAnnouncement || '';
  }
  // Sidebar filter on the detail page. Apply/Cancel mirror the
  // reference layout - Apply commits the picklist value (already live),
  // Cancel resets the picklist back to 'all'.
  handleDetailLobChange(event) {
    this._detailLob = event.detail.value;
  }
  handleDetailApply() {
    // No-op: changes are already live via handleDetailLobChange. The
    // button is here to match the reference UX and to make filter
    // application explicit for screen-reader users.
  }
  handleDetailCancel() {
    this._detailLob = 'all';
  }
  handleDetailDimensionChange(event) {
    const dim = event.currentTarget?.dataset?.dim;
    if (dim) this._detailDimension = dim;
  }

  // ── Derived KPI figures ──────────────────────────────────────
  // Counts and totals are added up from the rows the tables below
  // render, not read from the fixture, so a tile can never disagree
  // with the list underneath it. They did disagree: Acme's Total
  // Premium showed $612K, its medical policy alone, while the Active
  // Policies table listed three policies totalling $749.2K. And
  // because the fixture numbers were account-wide constants, choosing
  // a line of business narrowed the table while every tile held its
  // old value - even though each tile names the active filter in its
  // own subtitle.
  //
  // Outstanding is invoiced minus paid, which is how the drill-down
  // already computed it, so the tile and its detail view agree.
  //
  // Prior-year figures stay in the fixture: there are no prior-year
  // rows to add up, and the premium history chart is their real source.
  get _kpis() {
    const data = this._data;
    if (!data) return {};
    const policies = data.policies || [];
    const billing = data.billing || {};
    const sum = (field) =>
      policies.reduce((total, p) => total + (Number(p[field]) || 0), 0);
    return {
      ...(data.kpis || {}),
      activePolicies: policies.length,
      totalPremium: sum('premium'),
      totalCommission: sum('commission'),
      outstandingBalance: Math.max(
        0,
        (billing.totalInvoiced || 0) - (billing.totalPaid || 0)
      )
    };
  }

  // ── Tier 1: KPI banner (Figma "metric snapshot" cards) ───────
  // Each card carries: title + meta (time, filters), value + PoP
  // change, an Expected-Range mini-chart (line+dot+range or a
  // composition/pay-bar fallback when no time-series exists),
  // a deterministic summary line, and two pill action buttons.
  // All numbers come from the fixture; nothing is fabricated.
  get kpiTiles() {
    const data = this._data;
    if (!data) return [];
    const k = this._kpis;
    const asOf = this._fmtAsOf(data.asOf);
    const lobLabel = this._currentLobLabel();
    const billing = data.billing || {};
    const policies = data.policies || [];
    const earliestRenewalDays = this._earliestRenewalDays(policies);

    // ── Active Policies ──
    const activeTile = {
      id: 'active',
      name: 'Active Policies',
      openLabel: 'View Active Policies details',
      value: String(k.activePolicies ?? 0),
      unit: 'policies',
      timeLabel: `As of ${asOf}`,
      filtersLabel: lobLabel,
      pop: null, // counts have no PoP comparison in this fixture
      summary:
        earliestRenewalDays != null
          ? `All policies active. Closest renewal in ${earliestRenewalDays} day${earliestRenewalDays === 1 ? '' : 's'}.`
          : 'All policies active.',
      chart: this._kpiChartActive(policies),
      secondaryAction: 'Renewals'
    };

    // ── Total Premium ──
    const premiumTrend = this._trend(k.totalPremium, k.premiumPrevYear, 'up-good');
    const premiumTile = {
      id: 'premium',
      name: 'Total Premium',
      openLabel: 'View Total Premium details',
      value: this._fmtCompactCurrency(k.totalPremium),
      unit: '',
      timeLabel: `YTD · ${asOf}`,
      filtersLabel: lobLabel,
      pop: this._popVm(premiumTrend),
      summary: this._premiumSummary(k, data.premiumHistory),
      chart: this._kpiChartLine(data.premiumHistory),
      secondaryAction: 'History'
    };

    // ── Total Commission ──
    const commissionTrend = this._trend(k.totalCommission, k.commissionPrevYear, 'up-good');
    const commissionSeries = [];
    if (k.commissionPrevYear != null) {
      commissionSeries.push({ year: 'Prev', amount: k.commissionPrevYear });
    }
    if (k.totalCommission != null) {
      commissionSeries.push({ year: 'Curr', amount: k.totalCommission });
    }
    const commissionTile = {
      id: 'commission',
      name: 'Total Commission',
      openLabel: 'View Total Commission details',
      value: this._fmtCompactCurrency(k.totalCommission),
      unit: '',
      timeLabel: `YTD · ${asOf}`,
      filtersLabel: lobLabel,
      pop: this._popVm(commissionTrend),
      summary: this._commissionSummary(k),
      chart: this._kpiChartLine(commissionSeries),
      secondaryAction: 'Statements'
    };

    // ── Outstanding Balance ──
    const outstandingTile = {
      id: 'outstanding',
      name: 'Outstanding Balance',
      openLabel: 'View Outstanding Balance details',
      value: this._fmtCompactCurrency(k.outstandingBalance),
      unit: '',
      timeLabel: `As of ${asOf}`,
      filtersLabel: 'Open invoices',
      pop: null, // point-in-time balance has no PoP comparison
      summary: this._outstandingSummary(billing),
      chart: this._kpiChartPayBar(billing),
      secondaryAction: 'Invoices'
    };

    return [activeTile, premiumTile, commissionTile, outstandingTile];
  }

  // Human label for the dashboard's current LOB filter, displayed in
  // the card meta line. Lives next to the time so the user has full
  // scope context without opening the toolbar.
  _currentLobLabel() {
    if (!this.lobFilter || this.lobFilter === 'all') {
      return 'All lines of business';
    }
    return this.lobFilter;
  }

  // Days until the earliest active-policy renewal. Used in the Active
  // Policies card summary so the snapshot tells the broker something
  // actionable instead of just restating the count.
  _earliestRenewalDays(policies) {
    if (!policies || !policies.length) return null;
    const sorted = policies
      .filter((p) => p.expirationDate)
      .slice()
      .sort((a, b) => a.expirationDate.localeCompare(b.expirationDate));
    if (!sorted.length) return null;
    const days = this._daysUntil(sorted[0].expirationDate);
    return days != null && days >= 0 ? days : null;
  }

  // Premium card summary - combines the YoY swing with the dominant
  // carrier from the most recent year, using only fixture data.
  _premiumSummary(k, history) {
    const trend = this._trend(k.totalPremium, k.premiumPrevYear, 'up-good');
    const last = history && history.length ? history[history.length - 1] : null;
    const swing = trend ? `${trend.text}` : 'No prior-year comparison.';
    const yearLabel = last ? ` from ${last.year - 1} to ${last.year}` : '';
    return `Premium is ${swing}${yearLabel}.`;
  }

  // Commission card summary - surfaces the scale of the swing in
  // absolute dollars so the broker can read the chart at a glance.
  _commissionSummary(k) {
    if (k.totalCommission == null || k.commissionPrevYear == null) {
      return 'Commission tracked from posted policies.';
    }
    const delta = k.totalCommission - k.commissionPrevYear;
    const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    if (dir === 'flat') {
      return `Commission held flat at ${this._fmtCompactCurrency(k.totalCommission)} year over year.`;
    }
    const abs = this._fmtCompactCurrency(Math.abs(delta));
    return `Commission ${dir} ${abs} year over year on the same book.`;
  }

  // Outstanding card summary - overdue count drives the message;
  // avg-days-to-pay is included as the secondary signal.
  _outstandingSummary(b) {
    const overdue = b.overdueCount ?? 0;
    const avg = b.avgDaysToPay ?? 0;
    if (overdue === 0) {
      return `All invoices current. Average ${avg} day${avg === 1 ? '' : 's'} to pay.`;
    }
    return `${overdue} overdue invoice${overdue === 1 ? '' : 's'}. Average ${avg} day${avg === 1 ? '' : 's'} to pay.`;
  }

  // Map the existing `_trend` chip output to the Figma's PoP row,
  // splitting the percentage and the period descriptor so they can
  // be styled independently (accent-colored % + muted period).
  _popVm(trend) {
    if (!trend) return null;
    return {
      pct: trend.text.replace(' YoY', ''),
      period: 'vs prior period',
      cls: `c360-kpi__pop-pct ${trend.cls.replace('c360-trend ', 'c360-pop_')}`,
      // Re-expose the SR text from the trend chip so we don't lose
      // the better/worse hint that color alone can't carry.
      srText: trend.srText
    };
  }

  // ── KPI mini-chart VM helpers ────────────────────────────────
  // Three chart types per the Figma "Expected Range" pattern:
  //   - line  : time-series with line, dot, and range band
  //   - comp  : composition stacked bar (no time-series available)
  //   - pay   : paid-vs-outstanding stacked bar (billing card)
  // All three share the 280×88 plot dims so cards stay uniform.
  static get KPI_CHART() {
    return {
      width: 280,
      height: 88,
      padTop: 8,
      padBottom: 4,
      padLeft: 4,
      // Reserves the right gutter for the dot plus the end-value label,
      // which is left-anchored and would otherwise run past the viewBox
      // edge and be clipped. Sized for the widest label the compact
      // currency formatter emits at this scale ("$15.5K", ~33 units).
      padRight: 48,
      yAxisWidth: 25,
      xAxisHeight: 30
    };
  }

  // Time-series line chart - used by Premium (4-year) and Commission
  // (2-point prev/curr). Falls back to an empty VM when no points.
  _kpiChartLine(series) {
    const G = Client360Dashboard.KPI_CHART;
    if (!series || series.length === 0) {
      return { isEmpty: true };
    }

    const max = Math.max(...series.map((d) => Number(d.amount) || 0));
    const min = Math.min(...series.map((d) => Number(d.amount) || 0));
    // Pad the visual y-range so the line never touches the top/baseline.
    const lo = max === min ? Math.max(0, min - 1) : Math.max(0, min - (max - min) * 0.15);
    const hi = max === min ? max + 1 : max + (max - min) * 0.15;

    const plotLeft = G.padLeft;
    const plotRight = G.width - G.padRight;
    const plotTop = G.padTop;
    const plotBottom = G.height - G.padBottom;
    const plotW = plotRight - plotLeft;
    const plotH = plotBottom - plotTop;

    const xAt = (i) => {
      if (series.length === 1) return plotLeft + plotW * 0.5;
      return plotLeft + (i / (series.length - 1)) * plotW;
    };
    const yAt = (v) => plotBottom - ((v - lo) / (hi - lo)) * plotH;

    const points = series.map((d, i) => ({
      x: xAt(i),
      y: yAt(Number(d.amount) || 0),
      raw: Number(d.amount) || 0,
      year: String(d.year)
    }));
    const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');

    // Range band: highlights the current period (the rightmost
    // segment between the last two points). Uses brand-base-95 so
    // it whispers rather than shouts.
    const last = points[points.length - 1];
    const prev = points.length > 1 ? points[points.length - 2] : last;
    const rangeBand = {
      x: prev.x,
      y: plotTop,
      width: Math.max(0, last.x - prev.x),
      height: plotH
    };

    // Y-axis labels (top + bottom).
    const yTopLabel = this._fmtCompactCurrency(hi);
    const yBotLabel = this._fmtCompactCurrency(lo);

    // X-axis labels - first and last data point years only (matches
    // the 2-label pattern in the Figma).
    const xLeftLabel = points[0].year;
    const xRightLabel = points[points.length - 1].year;

    return {
      isEmpty: false,
      isLine: true,
      width: G.width,
      height: G.height,
      plotLeft,
      plotRight,
      plotTop,
      plotBottom,
      polyline,
      rangeBand,
      // The SVG is deliberately stretched to fill its slot
      // (preserveAspectRatio="none"), which distorts anything with
      // intrinsic proportions - a circle renders as an ellipse and text
      // comes out horizontally smeared, ~1.8x at the width this tile
      // gets. So the dot and the end-value label are HTML pinned by
      // percentage instead: percentages resolve against the same
      // stretched box, so they land on the right spot while the shapes
      // and glyphs keep their own proportions. The px offsets live in
      // CSS transforms for the same reason.
      lastDot: {
        style: `left:${((last.x / G.width) * 100).toFixed(3)}%;` +
          `top:${((last.y / G.height) * 100).toFixed(3)}%`
      },
      lastLabel: {
        style: `left:${((last.x / G.width) * 100).toFixed(3)}%;` +
          `top:${((last.y / G.height) * 100).toFixed(3)}%`,
        text: this._fmtCompactCurrency(last.raw)
      },
      yTopLabel,
      yBotLabel,
      xLeftLabel,
      xRightLabel,
      a11y: `Trend from ${xLeftLabel} to ${xRightLabel}, ending at ${this._fmtCompactCurrency(last.raw)}.`
    };
  }

  // Composition stacked bar - used by Active Policies. Splits the
  // current count by `policy.type` so each segment represents a real
  // policy from the fixture. No fabricated time-series.
  _kpiChartActive(policies) {
    const G = Client360Dashboard.KPI_CHART;
    if (!policies || !policies.length) {
      return { isEmpty: true };
    }
    // Bucket by `type` (Personal Auto, Group Medical, etc.).
    const buckets = new Map();
    policies.forEach((p) => {
      const key = p.type || 'Other';
      const entry = buckets.get(key) || { label: key, count: 0 };
      entry.count += 1;
      buckets.set(key, entry);
    });
    const total = policies.length;
    const segments = Array.from(buckets.values()).map((b, i) => ({
      id: `${b.label}-${i}`,
      label: b.label,
      count: b.count,
      pct: (b.count / total) * 100,
      barStyle: `width: ${(b.count / total) * 100}%;`
    }));
    return {
      isEmpty: false,
      isComposition: true,
      width: G.width,
      height: G.height,
      title: 'Composition by type',
      segments,
      total,
      a11y: `Composition by type: ${segments.map((s) => `${s.count} ${s.label}`).join(', ')}.`
    };
  }

  // Paid-vs-outstanding stacked bar - used by Outstanding Balance.
  // Computes percentages from real billing fields; if invoiced is 0
  // the chart degrades to an empty state.
  _kpiChartPayBar(b) {
    const G = Client360Dashboard.KPI_CHART;
    const invoiced = Number(b && b.totalInvoiced) || 0;
    const paid = Number(b && b.totalPaid) || 0;
    if (invoiced <= 0) {
      return { isEmpty: true };
    }
    const outstanding = Math.max(0, invoiced - paid);
    const paidPct = Math.min(100, (paid / invoiced) * 100);
    const outstandingPct = Math.max(0, 100 - paidPct);
    return {
      isEmpty: false,
      isPayBar: true,
      width: G.width,
      height: G.height,
      paidPct,
      outstandingPct,
      paidStyle: `width: ${paidPct}%;`,
      outstandingStyle: `width: ${outstandingPct}%;`,
      paidLabel: `${this._fmtCompactCurrency(paid)} paid`,
      outstandingLabel: `${this._fmtCompactCurrency(outstanding)} outstanding`,
      paidPctLabel: `${Math.round(paidPct)}%`,
      outstandingPctLabel: `${Math.round(outstandingPct)}%`,
      a11y: `${Math.round(paidPct)}% paid, ${Math.round(outstandingPct)}% outstanding.`
    };
  }

  // ── Tier 2a: Premium History column chart ────────────────────
  // Returns a fully-computed view model so the template is dumb SVG.
  // Zero baseline, single accent color, ascending years (SLDS Charts).
  get premiumChart() {
    const series = this._data ? this._data.premiumHistory : [];
    if (!series.length) return { hasData: false, bars: [] };

    const G = PREMIUM_CHART;
    const max = Math.max(...series.map((d) => d.amount), 1);
    const plotTop = G.padTop;
    const baseline = G.height - G.padBottom;
    const plotHeight = baseline - plotTop;
    const plotLeft = G.padLeft;
    const plotWidth = G.width - G.padLeft - G.padRight;
    const slot = plotWidth / series.length;
    const barW = Math.min(G.barMaxWidth, slot * 0.5);

    const bars = series.map((d) => {
      const h = max > 0 ? (d.amount / max) * plotHeight : 0;
      const x = plotLeft + slot * series.indexOf(d) + (slot - barW) / 2;
      const y = baseline - h;
      const cx = x + barW / 2;
      return {
        key: `bar-${d.year}`,
        x,
        y,
        width: barW,
        height: Math.max(h, 1),
        labelX: cx,
        amountY: y - 6, // amount sits just above the bar
        yearY: baseline + 18, // year sits just below the baseline
        year: String(d.year),
        amount: this._fmtCompactCurrency(d.amount),
        a11y: `${d.year}: ${this._fmtCurrency(d.amount)}`
      };
    });

    // 4 horizontal grid lines at 25/50/75/100% of the plot.
    const gridLines = [0.25, 0.5, 0.75, 1].map((p, i) => ({
      key: `grid-${i}`,
      x1: plotLeft,
      x2: plotLeft + plotWidth,
      y: baseline - plotHeight * p
    }));

    return { hasData: true, bars, gridLines, baseline, plotLeft, plotWidth };
  }

  // ── Tier 2b: Billing summary metric rows ─────────────────────
  get billingSummary() {
    const b = this._data ? this._data.billing : {};
    return [
      { id: 'invoiced', label: 'Total Invoiced', value: this._fmtCurrency(b.totalInvoiced) },
      { id: 'paid', label: 'Total Paid', value: this._fmtCurrency(b.totalPaid) },
      { id: 'overdue', label: 'Overdue Invoices', value: String(b.overdueCount ?? 0) },
      { id: 'avgdays', label: 'Avg Days to Pay', value: `${b.avgDaysToPay ?? 0} days` }
    ];
  }

  // ── Tier 3: Active Policies ──────────────────────────────────
  get activePolicies() {
    const rows = this._data ? this._data.policies : [];
    return rows
      .slice()
      .sort((a, b) => a.expirationDate.localeCompare(b.expirationDate))
      .map((p) => ({
        ...p,
        effectiveDisplay: this._fmtDate(p.effectiveDate),
        expirationDisplay: this._fmtDate(p.expirationDate),
        premiumDisplay: this._fmtCurrency(p.premium),
        statusClass: this._statusClass(p.status)
      }));
  }
  get hasPolicies() {
    return this.activePolicies.length > 0;
  }

  // ── Tier 4a: Upcoming Renewals (next 120 days) ───────────────
  get upcomingRenewals() {
    const rows = this._data ? this._data.renewals : [];
    return rows
      .slice()
      .sort((a, b) => a.expirationDate.localeCompare(b.expirationDate))
      .map((r) => {
        const days = this._daysUntil(r.expirationDate);
        const urgent = days != null && days <= URGENT_DAYS;
        return {
          ...r,
          expirationDisplay: this._fmtDate(r.expirationDate),
          premiumDisplay: this._fmtCurrency(r.premium),
          rowClass: urgent ? 'c360-row c360-row_urgent' : 'c360-row'
        };
      });
  }
  get hasRenewals() {
    return this.upcomingRenewals.length > 0;
  }

  // ── Tier 4b: Open Cases ──────────────────────────────────────
  get openCases() {
    const rows = this._data ? this._data.cases : [];
    return rows.map((c) => ({
      ...c,
      createdDisplay: this._fmtDate(c.createdDate),
      priorityClass: this._priorityClass(c.priority)
    }));
  }
  get hasCases() {
    return this.openCases.length > 0;
  }

  // ── Tier 5a: Claims Summary ──────────────────────────────────
  get claims() {
    const rows = this._data ? this._data.claims : [];
    return rows
      .slice()
      .sort((a, b) => b.lossDate.localeCompare(a.lossDate))
      .map((c) => ({
        ...c,
        estimatedDisplay: this._fmtCurrency(c.estimatedAmount),
        actualDisplay: this._fmtCurrency(c.actualAmount),
        lossDisplay: this._fmtDate(c.lossDate),
        statusClass: this._statusClass(c.status)
      }));
  }
  get hasClaims() {
    return this.claims.length > 0;
  }
  get claimsCount() {
    return this.claims.length;
  }
  get claimsTotalPaid() {
    const total = this.claims.reduce((s, c) => s + (Number(c.actualAmount) || 0), 0);
    return this._fmtCurrency(total);
  }

  // ── Tier 5b: Open Tasks ──────────────────────────────────────
  get tasks() {
    const rows = this._data ? this._data.tasks : [];
    return rows
      .slice()
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((t) => ({
        ...t,
        dueDisplay: this._fmtDate(t.dueDate),
        priorityClass: this._priorityClass(t.priority)
      }));
  }
  get hasTasks() {
    return this.tasks.length > 0;
  }

  // ── Metric detail (drill-down) view-model ────────────────────
  // Builds the per-metric detail view consumed by the isDetailView
  // template. Modeled after the TabNext-on-Local renderMetricDetailPage
  // (header → value card → trend → breakdown → records). Sourced
  // entirely from existing fixtures (no fabricated rows): when a real
  // per-row split doesn't exist (e.g. commission), we surface a
  // "aggregate only" note instead of inventing data.
  get metricDetail() {
    if (!this._activeMetricId || !this._data) return null;
    const id = this._activeMetricId;
    const k = this._kpis;
    const asOf = `As of ${this._fmtAsOf(this._data.asOf)}`;
    const lob = this._detailLob;

    // Filter the policies + renewals + billing the same way the
    // dashboard's LOB filter does, but using the detail-page sidebar
    // selection so the two filters are independent.
    const policiesAll = this._data.policies || [];
    const policiesFiltered = policiesAll.filter((p) => lob === 'all' || p.lob === lob);

    if (id === 'premium') {
      const yoy = this._trend(k.totalPremium, k.premiumPrevYear, 'up-good');
      const deltas = [
        { id: 'pp', label: 'vs. prior period', chip: yoy },
        { id: 'yoy', label: 'year over year', chip: yoy }
      ];
      const premiumBreakdown = this._buildBreakdown('premium', policiesFiltered, 'premium');
      this._attachChart(premiumBreakdown, {
        metricLabel: 'Total Premium',
        yAxisTitle: 'Premium',
        formatY: (v) => this._fmtCompactCurrency(v)
      });
      return {
        id,
        title: 'Total Premium',
        asOf,
        value: this._fmtCompactCurrency(k.totalPremium),
        unit: '',
        valueBadge: 'Value',
        deltas,
        trend: {
          hasData: this.premiumChart.hasData,
          ariaLabel: 'Premium by calendar year',
          chart: this.premiumChart,
          insight: `${this._data.premiumHistory?.length ? this._data.premiumHistory.length : 0}-year premium history. The most recent period totaled ${this._fmtCurrency(k.totalPremium)}.`
        },
        breakdown: premiumBreakdown,
        records: this._buildRecords('policies', policiesFiltered),
        recordsTitle: 'Premium Detail Records (Active Policies)',
        recordsEmpty: 'No active policies for the selected line of business.'
      };
    }

    if (id === 'commission') {
      const yoy = this._trend(k.totalCommission, k.commissionPrevYear, 'up-good');
      const deltas = [
        { id: 'pp', label: 'vs. prior period', chip: yoy },
        { id: 'yoy', label: 'year over year', chip: yoy }
      ];
      // 2-bar prior-vs-current using the same bar-chart geometry as
      // the existing premium chart so the visual language stays
      // consistent. Only real data points are used (no extrapolation).
      const series = [];
      if (k.commissionPrevYear != null) {
        series.push({ year: 'Prior year', amount: k.commissionPrevYear });
      }
      if (k.totalCommission != null) {
        series.push({ year: 'Current', amount: k.totalCommission });
      }
      const chart = this._buildBarChart(series);
      return {
        id,
        title: 'Total Commission',
        asOf,
        value: this._fmtCompactCurrency(k.totalCommission),
        unit: '',
        valueBadge: 'Value',
        deltas,
        trend: {
          hasData: chart.hasData,
          ariaLabel: 'Commission, prior year vs current',
          chart,
          insight: `Commission totaled ${this._fmtCurrency(k.totalCommission)}, vs ${this._fmtCurrency(k.commissionPrevYear)} the prior year.`
        },
        breakdown: {
          hasData: false,
          chartTitle: 'Total Commission by Policy',
          chart: { hasData: false },
          note: 'Commission is reported in aggregate. Per-policy commission is not available in this fixture.'
        },
        records: { headers: [], rows: [], hasData: false },
        recordsTitle: 'Commission Detail Records',
        recordsEmpty: 'Per-policy commission is not available in this fixture.'
      };
    }

    if (id === 'active') {
      // Count metric - no YoY, no monetary trend. The "trend" slot
      // shows a per-LOB count breakdown instead so the page still
      // carries a chart-class visualization.
      const activeBreakdown = this._buildBreakdown('active', policiesFiltered, 'count');
      this._attachChart(activeBreakdown, {
        metricLabel: 'Active Policies',
        yAxisTitle: 'Policies',
        formatY: (v) => String(Math.round(v))
      });
      return {
        id,
        title: 'Active Policies',
        asOf,
        value: String(k.activePolicies ?? 0),
        unit: 'policies',
        valueBadge: 'Count',
        deltas: [],
        trend: {
          hasData: false,
          note: 'Historical policy counts are not tracked in this fixture. Use the breakdown below for the current composition.'
        },
        breakdown: activeBreakdown,
        records: this._buildRecords('policies', policiesFiltered),
        recordsTitle: 'Active Policies',
        recordsEmpty: 'No active policies for the selected line of business.'
      };
    }

    if (id === 'outstanding') {
      const b = this._data.billing || {};
      // Outstanding is point-in-time - no trend, no YoY. The breakdown
      // surfaces the billing summary as the primary explanatory view.
      // Records table keeps the full mixed-unit billing summary
      // (counts + days) since a table can show heterogeneous rows the
      // chart can't.
      const billingRows = [
        { id: 'invoiced', label: 'Total Invoiced', value: this._fmtCurrency(b.totalInvoiced) },
        { id: 'paid', label: 'Total Paid', value: this._fmtCurrency(b.totalPaid) },
        {
          id: 'outstanding',
          label: 'Outstanding',
          value: this._fmtCurrency(Math.max(0, (b.totalInvoiced || 0) - (b.totalPaid || 0)))
        },
        { id: 'overdue', label: 'Overdue Invoices', value: String(b.overdueCount ?? 0) },
        { id: 'avgdays', label: 'Avg Days to Pay', value: `${b.avgDaysToPay ?? 0} days` }
      ];
      const outstandingBreakdown = this._buildBillingBreakdown(null, b);
      this._attachChart(outstandingBreakdown, {
        metricLabel: 'Billing',
        dimensionLabelOverride: 'Status',
        yAxisTitle: 'Amount',
        formatY: (v) => this._fmtCompactCurrency(v)
      });
      return {
        id,
        title: 'Outstanding Balance',
        asOf,
        value: this._fmtCompactCurrency(k.outstandingBalance),
        unit: '',
        valueBadge: 'Balance',
        deltas: [],
        trend: {
          hasData: false,
          note: 'Outstanding balance is a point-in-time reading; no historical trend is tracked.'
        },
        breakdown: outstandingBreakdown,
        records: {
          hasData: true,
          rows: billingRows.map((r) => ({
            id: r.id,
            label: r.label,
            valueDisplay: r.value
          }))
        },
        recordsTitle: 'Billing Summary',
        recordsEmpty: 'No billing data on file.'
      };
    }

    return null;
  }

  // Build a breakdown VM for the outstanding-balance metric - 3 $
  // bars (Invoiced / Paid / Outstanding) so they share a Y-axis.
  // The previous version mixed currency + count + days rows, which
  // can't be plotted on a single scale. Count + avg-days now move to
  // the records table where they belong.
  _buildBillingBreakdown(billingRowsLegacy, billing) {
    const b = billing || {};
    const invoiced = Number(b.totalInvoiced) || 0;
    const paid = Number(b.totalPaid) || 0;
    const outstanding = Math.max(0, invoiced - paid);
    const rows = [
      {
        id: 'invoiced',
        label: 'Invoiced',
        value: this._fmtCurrency(invoiced),
        valueRaw: invoiced
      },
      {
        id: 'paid',
        label: 'Paid',
        value: this._fmtCurrency(paid),
        valueRaw: paid
      },
      {
        id: 'outstanding',
        label: 'Outstanding',
        value: this._fmtCurrency(outstanding),
        valueRaw: outstanding
      }
    ];
    return {
      hasData: rows.some((r) => r.valueRaw > 0),
      hasTabs: false,
      tabs: [],
      rows
    };
  }

  // Detail-view sidebar LOB picklist - reuses the dashboard options.
  get detailLobOptions() {
    return CLIENT360_LOB_OPTIONS.slice();
  }
  get detailLobValue() {
    return this._detailLob;
  }
  // Records table dispatch - `premium` and `active` show the policies
  // table; everything else falls through to the generic label/value
  // table (used by the outstanding-balance billing summary).
  get isMetricPolicies() {
    return (
      this._activeMetricId === 'premium' || this._activeMetricId === 'active'
    );
  }

  // Build a generic bar chart VM in the same shape as `premiumChart`
  // so the template can reuse the existing SVG block. Used by the
  // commission detail (prior vs current) - keeps a single code path
  // for chart geometry.
  _buildBarChart(series) {
    if (!series || !series.length) return { hasData: false, bars: [] };
    const max = Math.max(...series.map((d) => d.amount), 1);
    const plotTop = CHART.padTop;
    const baseline = CHART.height - CHART.padBottom;
    const plotHeight = baseline - plotTop;
    const plotLeft = CHART.padLeft;
    const plotWidth = CHART.width - CHART.padLeft - CHART.padRight;
    const slot = plotWidth / series.length;
    const barW = Math.min(CHART.barMaxWidth, slot * 0.5);

    const bars = series.map((d, i) => {
      const h = max > 0 ? (d.amount / max) * plotHeight : 0;
      const x = plotLeft + slot * i + (slot - barW) / 2;
      const y = baseline - h;
      const cx = x + barW / 2;
      return {
        key: `bar-${i}-${d.year}`,
        x,
        y,
        width: barW,
        height: Math.max(h, 1),
        labelX: cx,
        amountY: y - 6,
        yearY: baseline + 18,
        year: String(d.year),
        amount: this._fmtCompactCurrency(d.amount),
        a11y: `${d.year}: ${this._fmtCurrency(d.amount)}`
      };
    });

    const gridLines = [0.25, 0.5, 0.75, 1].map((p, i) => ({
      key: `grid-${i}`,
      x1: plotLeft,
      x2: plotLeft + plotWidth,
      y: baseline - plotHeight * p
    }));

    return { hasData: true, bars, gridLines, baseline, plotLeft, plotWidth };
  }

  // ── Graph-table column chart (Figma "graph table") ──────────
  // Generic helper that turns a list of {id, label, value, valueRaw}
  // rows into a column-chart VM in a fixed 480×200 SVG coordinate
  // system: 5 Y-axis ticks at nice-rounded steps, 4 gridlines, evenly
  // spaced bars with value labels above each, plus X/Y axis titles.
  // Used by the metric-detail breakdown card so every metric shows
  // its dimension data in the same column-chart shape.
  _buildGraphTable(rows, opts) {
    const W = 480;
    const H = 200;
    const padTop = 18; // room for the value label above the tallest bar
    const padBottom = 4;
    const plotH = H - padTop - padBottom;

    if (!rows || !rows.length) return { hasData: false };

    const numericValues = rows.map((r) => Number(r.valueRaw) || 0);
    const rawMax = Math.max(...numericValues, 0);
    if (rawMax === 0) return { hasData: false };

    const niceMax = this._niceRoundMax(rawMax);
    const fmt = opts && opts.formatY ? opts.formatY : (v) => String(Math.round(v));

    // Y-axis tick labels, top→bottom (matches the visual order on the
    // axis) so the template can iterate them flexbox-stacked.
    const yTicks = [1, 0.75, 0.5, 0.25, 0].map((p, i) => ({
      id: `yt-${i}`,
      label: fmt(niceMax * p)
    }));

    // 4 dashed horizontal gridlines (at 25/50/75/100% of plot height)
    // plus an implicit baseline drawn by .c360-gt__axis below.
    const gridlines = [0.25, 0.5, 0.75, 1].map((p, i) => ({
      id: `g-${i}`,
      x1: 0,
      x2: W,
      y: padTop + plotH * (1 - p)
    }));

    const slotW = W / rows.length;
    // Bar width: 55% of slot, capped at 56px so 1-2 column charts
    // don't end up with comically wide bars.
    const barW = Math.min(56, slotW * 0.55);

    const bars = rows.map((r, i) => {
      const v = Number(r.valueRaw) || 0;
      const h = (v / niceMax) * plotH;
      const x = slotW * i + (slotW - barW) / 2;
      const y = padTop + plotH - h;
      return {
        id: r.id,
        x,
        y: Math.max(padTop, y),
        w: barW,
        h: Math.max(0, h),
        labelX: x + barW / 2,
        labelY: Math.max(padTop, y) - 4,
        label: r.label,
        value: r.value,
        a11y: `${r.label}: ${r.value}`
      };
    });

    return {
      hasData: true,
      width: W,
      height: H,
      yTicks,
      gridlines,
      yAxisTitle: (opts && opts.yAxisTitle) || '',
      xAxisTitle: (opts && opts.xAxisTitle) || '',
      title: (opts && opts.title) || '',
      bars,
      a11y: (opts && opts.a11y) || `${rows.length} columns`
    };
  }

  // Compose chart + chartTitle on a breakdown VM. Centralises the
  // "Total {metric} by {dimension}" title pattern + the per-dim X-axis
  // title so each metric branch in metricDetail stays one-liner-clean.
  _attachChart(breakdown, opts) {
    if (!breakdown) return breakdown;
    const metricLabel = (opts && opts.metricLabel) || 'Metric';
    // Active tab carries the human "by X" dimension label; commission
    // and outstanding skip the picker so we accept an override.
    const activeTab = breakdown.tabs && breakdown.tabs.find((t) => t.active);
    const dimLabel =
      (opts && opts.dimensionLabelOverride) ||
      (activeTab && activeTab.label) ||
      'Category';
    const chartTitle = `${metricLabel} by ${dimLabel}`;
    if (!breakdown.hasData || !breakdown.rows) {
      breakdown.chartTitle = chartTitle;
      breakdown.chart = { hasData: false };
      return breakdown;
    }
    breakdown.chartTitle = chartTitle;
    breakdown.chart = this._buildGraphTable(breakdown.rows, {
      title: chartTitle,
      xAxisTitle: dimLabel,
      yAxisTitle: (opts && opts.yAxisTitle) || '',
      formatY: opts && opts.formatY,
      a11y: `${chartTitle}, ${breakdown.rows.length} columns`
    });
    return breakdown;
  }

  // Round a raw max upward to a "nice" number (1, 2, 5 × 10^n) so
  // the Y-axis labels read as round figures instead of e.g. 612000.
  _niceRoundMax(value) {
    if (value <= 0) return 1;
    const exp = Math.floor(Math.log10(value));
    const norm = value / Math.pow(10, exp);
    let nice;
    if (norm <= 1) nice = 1;
    else if (norm <= 2) nice = 2;
    else if (norm <= 5) nice = 5;
    else nice = 10;
    return nice * Math.pow(10, exp);
  }

  // Group policy rows by Line of Business (or by Policy name) and
  // return a uniform breakdown VM with relative bar widths so the
  // template can render either dimension with the same markup.
  _buildBreakdown(metricId, rows, valueMode) {
    const dim = this._detailDimension; // 'lob' | 'policy'
    // Toggle-button-group pattern (not ARIA tabs) - tabs would
    // require aria-controls + arrow-key roving tabindex + tabpanel
    // wiring; aria-pressed gives accurate state semantics with the
    // same simple click-to-toggle UX.
    const tabs = [
      {
        id: 'lob',
        label: 'Line of Business',
        active: dim === 'lob',
        ariaPressed: dim === 'lob' ? 'true' : 'false',
        cls: dim === 'lob' ? 'c360-bd__tab c360-bd__tab_active' : 'c360-bd__tab'
      },
      {
        id: 'policy',
        label: 'Policy',
        active: dim === 'policy',
        ariaPressed: dim === 'policy' ? 'true' : 'false',
        cls: dim === 'policy' ? 'c360-bd__tab c360-bd__tab_active' : 'c360-bd__tab'
      }
    ];

    if (!rows || !rows.length) {
      return { hasData: false, hasTabs: true, tabs, rows: [] };
    }

    // Aggregate by the active dimension.
    let groups;
    if (dim === 'lob') {
      const map = new Map();
      rows.forEach((r) => {
        const key = r.lob || 'Other';
        const entry = map.get(key) || { label: key, sum: 0, count: 0 };
        entry.sum += Number(r.premium) || 0;
        entry.count += 1;
        map.set(key, entry);
      });
      groups = Array.from(map.entries()).map(([id, v]) => ({
        id,
        label: v.label,
        sum: v.sum,
        count: v.count
      }));
    } else {
      groups = rows.map((r) => ({
        id: r.id,
        label: r.name,
        sum: Number(r.premium) || 0,
        count: 1
      }));
    }

    const useCount = valueMode === 'count';
    const max = Math.max(
      1,
      ...groups.map((g) => (useCount ? g.count : g.sum))
    );
    const breakdownRows = groups
      .slice()
      .sort((a, b) => (useCount ? b.count - a.count : b.sum - a.sum))
      .map((g) => {
        const raw = useCount ? g.count : g.sum;
        const pct = Math.max(2, Math.round((raw / max) * 100));
        return {
          id: g.id,
          label: g.label,
          value: useCount
            ? `${g.count} ${g.count === 1 ? 'policy' : 'policies'}`
            : this._fmtCurrency(g.sum),
          // Numeric value drives the column-chart Y-scale; the string
          // `value` above is just for accessible labels & legends.
          valueRaw: raw,
          // Inline style consumed by the template (LWC allows
          // attribute-bound style strings the same way the host shell
          // does for its app-launcher tile marks).
          barStyle: `width: ${pct}%;`
        };
      });

    return {
      hasData: true,
      hasTabs: true,
      tabs,
      rows: breakdownRows
    };
  }

  // Build a records table VM. Today only the policies dataset is
  // wired up (premium + active metrics). Outstanding builds its own
  // billing-rows table inline (see metricDetail).
  _buildRecords(kind, rows) {
    if (kind !== 'policies') {
      return { hasData: false, headers: [], rows: [] };
    }
    if (!rows || !rows.length) {
      return { hasData: false, headers: [], rows: [] };
    }
    const headers = [
      { id: 'name', label: 'Policy Name', num: false },
      { id: 'type', label: 'Type', num: false },
      { id: 'lob', label: 'Line of Business', num: false },
      { id: 'eff', label: 'Effective', num: false },
      { id: 'exp', label: 'Expiration', num: false },
      { id: 'prem', label: 'Premium', num: true },
      { id: 'status', label: 'Status', num: false },
      { id: 'carrier', label: 'Carrier', num: false }
    ];
    const sorted = rows
      .slice()
      .sort((a, b) => a.expirationDate.localeCompare(b.expirationDate));
    const out = sorted.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      lob: p.lob,
      effectiveDisplay: this._fmtDate(p.effectiveDate),
      expirationDisplay: this._fmtDate(p.expirationDate),
      premiumDisplay: this._fmtCurrency(p.premium),
      status: p.status,
      statusClass: this._statusClass(p.status),
      carrier: p.carrier
    }));
    return { hasData: true, headers, rows: out };
  }

  // ── Formatters ───────────────────────────────────────────────
  _fmtCurrency(n) {
    const num = Number(n);
    if (Number.isNaN(num)) return '-';
    return num.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    });
  }
  // Compact form for KPI tiles + bar labels ($612K, $15.5K).
  _fmtCompactCurrency(n) {
    const num = Number(n);
    if (Number.isNaN(num)) return '-';
    if (num === 0) return '$0';
    const abs = Math.abs(num);
    if (abs >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (abs >= 1000) {
      const k = num / 1000;
      return `$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
    }
    return `$${num}`;
  }
  _fmtDate(iso) {
    return formatUsDateOrDash(iso);
  }
  _fmtAsOf(iso) {
    return formatUsDate(iso);
  }
  _daysUntil(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const today = this._data ? new Date(this._data.asOf) : baseToday();
    return Math.round((d.getTime() - today.getTime()) / 86400000);
  }

  // Trend chip view-model. `goodDir` = 'up-good' (increase is better)
  // or 'down-good'. Returns icon path + text + accessible word; color
  // is decorative only (icon + word carry the meaning).
  _trend(curr, prev, goodDir) {
    if (curr == null || prev == null || prev === 0) return null;
    const delta = ((curr - prev) / prev) * 100;
    const rounded = Math.round(delta * 10) / 10;
    let dir = 'flat';
    if (rounded > 0) dir = 'up';
    else if (rounded < 0) dir = 'down';
    const better =
      dir === 'flat'
        ? 'no change'
        : (dir === 'up') === (goodDir === 'up-good')
          ? 'better'
          : 'worse';
    const sign = rounded > 0 ? '+' : '';
    const cls =
      better === 'better'
        ? 'c360-trend c360-trend_better'
        : better === 'worse'
          ? 'c360-trend c360-trend_worse'
          : 'c360-trend c360-trend_flat';
    // Triangle up / down / right glyph paths (12x12 viewBox).
    const icon =
      dir === 'up'
        ? 'M6 2l4 7H2z'
        : dir === 'down'
          ? 'M6 10L2 3h8z'
          : 'M2 6h6l-2-2m2 2l-2 2';
    return {
      cls,
      icon,
      text: `${sign}${rounded}% YoY`,
      srText: `${better}`
    };
  }

  // Map a status string to the existing SLDS pill recipe variants.
  _statusClass(status) {
    const s = (status || '').toLowerCase();
    if (s === 'active' || s === 'paid' || s === 'closed') {
      return 'c360-pill c360-pill_success';
    }
    if (s === 'in review' || s === 'working' || s === 'in progress' || s === 'open') {
      return 'c360-pill c360-pill_info';
    }
    return 'c360-pill';
  }
  _priorityClass(priority) {
    const p = (priority || '').toLowerCase();
    if (p === 'high') return 'c360-pill c360-pill_warning';
    if (p === 'low') return 'c360-pill';
    return 'c360-pill c360-pill_info';
  }
}
