import { LightningElement, api, track } from 'lwc';
import {
  getRevenueIntelligence,
  REVENUE_DATE_RANGES,
  REVENUE_LOBS,
  REVENUE_PRODUCERS
} from 'data/revenueIntelligence';
import { formatUsDate, formatUsDateOrDash } from 'data/dates';

/**
 * c-revenue-intelligence-dashboard - org-wide macro dashboard for
 * Agency Principals + Finance teams. Five tiers:
 *   Tier 1 (KPIs): commission + revenue + receivables tiles.
 *   Tier 2: Commission by Status (donut) + Expected vs Received (grouped bar).
 *   Tier 3: Commission by LOB (h-bar) + Commission by Carrier (h-bar).
 *   Tier 4 (gated by hasBillingEnabled): Billing pipeline KPIs +
 *           Invoice Aging (stacked bar) + Monthly Revenue Trend (line).
 *   Tier 5: Producer Leaderboard + Commission Statements (tables).
 *
 * Visual language matches the existing Client 360 dashboard (Tabnext
 * aesthetic) so the org-wide and account-level surfaces feel unified.
 *
 * PROD note: charts here are hand-rolled SVG so the LWC OSS prototype
 * has no extra runtime dependency. In a Salesforce platform LWC,
 * Chart.js loaded via `lightning/platformResourceLoader` would render
 * the same shapes inside <canvas> elements; the view-model getters
 * (donutChart, groupedBarChart, lobBarChart, carrierBarChart,
 * agingStackBar, monthlyTrendChart) already return chart-ready data
 * arrays so the production port is a markup swap, not a data
 * refactor.
 */

const CHART = Object.freeze({
  donut: { size: 200, ringWidth: 30 },
  groupedBar: { width: 480, height: 220, padTop: 20, padBottom: 32, padLeft: 8, padRight: 8 },
  hBar: { width: 480, rowHeight: 32, gap: 8, labelW: 152, valueW: 64 },
  stackedBar: { width: 480, height: 56 },
  line: { width: 480, height: 220, padTop: 20, padBottom: 32, padLeft: 8, padRight: 16 }
});

export default class RevenueIntelligenceDashboard extends LightningElement {
  // ── Public API ───────────────────────────────────────────────
  // hasBillingEnabled gates Tier 1's billing KPIs and the entire
  // Tier 4 (Billing Health) section. The public default is `false`
  // (LWC rule: boolean @api properties must default to false so a
  // missing attribute coerces correctly). The internal backing field
  // starts as `true` so the prototype demo opens with the full
  // surface visible - when an App Builder admin binds the attribute,
  // the setter takes over and reflects the platform value.
  @track _hasBillingEnabled = true;
  @api
  get hasBillingEnabled() {
    return this._hasBillingEnabled;
  }
  set hasBillingEnabled(value) {
    this._hasBillingEnabled = !!value;
  }

  // ── Filters (informational in this prototype - see data module) ─
  @track selectedDateRange = 'ytd';
  @track selectedLOB = 'all';
  @track selectedProducer = 'all';
  @track _data = null;

  connectedCallback() {
    this._resolve();
  }

  _resolve() {
    this._data = getRevenueIntelligence({
      dateRange: this.selectedDateRange,
      lob: this.selectedLOB,
      producer: this.selectedProducer
    });
  }

  get hasData() {
    return !!this._data;
  }

  // ── Toolbar ──────────────────────────────────────────────────
  get dateRangeOptions() {
    return REVENUE_DATE_RANGES.slice();
  }
  get lobOptions() {
    return REVENUE_LOBS.slice();
  }
  get producerOptions() {
    return REVENUE_PRODUCERS.slice();
  }
  get dashboardAsOf() {
    return this._data
      ? `As of ${this._fmtAsOf(this._data.asOf)}`
      : '';
  }
  handleDateRangeChange(e) {
    this.selectedDateRange = e.detail.value;
    this._resolve();
  }
  handleLobChange(e) {
    this.selectedLOB = e.detail.value;
    this._resolve();
  }
  handleProducerChange(e) {
    this.selectedProducer = e.detail.value;
    this._resolve();
  }
  // Demo-only toggle so reviewers can see both billing-on / billing-off
  // states from the dashboard itself instead of needing a parent
  // attribute change.
  handleToggleBilling() {
    this._hasBillingEnabled = !this._hasBillingEnabled;
  }
  get billingToggleLabel() {
    return this._hasBillingEnabled
      ? 'Hide Billing Health'
      : 'Show Billing Health';
  }

  // ── Tier 1: KPI tiles ────────────────────────────────────────
  get kpiTiles() {
    if (!this._data) return [];
    const k = this._data.kpiMetrics || {};
    const tiles = [
      {
        id: 'commission',
        label: 'Total Commission Earned',
        value: this._fmtCompactCurrency(k.totalCommissionEarned),
        trend: this._trend(k.totalCommissionEarned, k.totalCommissionEarnedPrevYear, 'up-good')
      },
      {
        id: 'expected',
        label: 'Expected Revenue',
        value: this._fmtCompactCurrency(k.expectedRevenue),
        trend: this._trend(k.expectedRevenue, k.expectedRevenuePrevYear, 'up-good')
      }
    ];
    if (this.hasBillingEnabled) {
      tiles.push(
        {
          id: 'receivables',
          label: 'Outstanding Receivables',
          value: this._fmtCompactCurrency(k.outstandingReceivables),
          // Down is good for AR - paying faster shrinks the balance.
          trend: this._trend(k.outstandingReceivables, k.outstandingReceivablesPrevYear, 'down-good')
        },
        {
          id: 'payments',
          label: 'Total Payments Collected',
          value: this._fmtCompactCurrency(k.totalPaymentsCollected),
          trend: this._trend(k.totalPaymentsCollected, k.totalPaymentsCollectedPrevYear, 'up-good')
        }
      );
    }
    return tiles;
  }
  get kpiGridClass() {
    return this.hasBillingEnabled
      ? 'rid-kpis rid-kpis_4'
      : 'rid-kpis rid-kpis_2';
  }

  // ── Tier 2a: Commission by Status (donut) ────────────────────
  // Returns segments with cumulative arc geometry so the template can
  // render each slice as a single <circle> with a stroke-dasharray
  // trick - no path math in the template.
  get donutChart() {
    const rows = (this._data && this._data.commissionByStatus) || [];
    const G = CHART.donut;
    const r = (G.size - G.ringWidth) / 2;
    const cx = G.size / 2;
    const cy = G.size / 2;
    const circumference = 2 * Math.PI * r;
    const total = rows.reduce((s, x) => s + (Number(x.value) || 0), 0);
    if (total === 0) return { hasData: false };
    const colorPool = [
      'var(--slds-g-color-accent-1, #066afe)',
      'var(--slds-g-color-warning-base-70, #e4a201)',
      'var(--slds-g-color-error-1, #b60554)',
      'var(--slds-g-color-on-surface-1, #5c5c5c)',
      'var(--slds-g-color-success-1, #056764)'
    ];
    let offset = 0;
    const segments = rows.map((row, i) => {
      const value = Number(row.value) || 0;
      const pct = value / total;
      const length = pct * circumference;
      const gap = circumference - length;
      const dashOffset = circumference - offset;
      offset += length;
      return {
        id: row.id || `seg-${i}`,
        label: row.label,
        value,
        valueDisplay: this._fmtCurrency(value),
        pct: Math.round(pct * 1000) / 10, // 1 decimal
        pctDisplay: `${Math.round(pct * 100)}%`,
        color: colorPool[i % colorPool.length],
        dashArray: `${length} ${gap}`,
        dashOffset
      };
    });
    return {
      hasData: true,
      size: G.size,
      cx,
      cy,
      r,
      strokeWidth: G.ringWidth,
      circumference,
      total,
      totalDisplay: this._fmtCompactCurrency(total),
      segments,
      a11y: `Commission by status: ${segments
        .map((s) => `${s.label} ${s.pctDisplay}`)
        .join(', ')}.`
    };
  }

  // ── Tier 2b: Expected vs Received (grouped bar) ──────────────
  get groupedBarChart() {
    const rows = (this._data && this._data.expectedVsReceived) || [];
    const G = CHART.groupedBar;
    if (!rows.length) return { hasData: false };
    const max = this._niceRoundMax(
      Math.max(
        ...rows.map((r) => Math.max(Number(r.expected) || 0, Number(r.received) || 0)),
        0
      )
    );
    const plotTop = G.padTop;
    const plotBottom = G.height - G.padBottom;
    const plotH = plotBottom - plotTop;
    const plotLeft = G.padLeft;
    const plotRight = G.width - G.padRight;
    const plotW = plotRight - plotLeft;
    const slotW = plotW / rows.length;
    const groupGap = slotW * 0.18;
    const groupW = slotW - groupGap;
    const barW = groupW / 2;

    const bars = rows.flatMap((row, i) => {
      const slotX = plotLeft + slotW * i + groupGap / 2;
      const exp = Number(row.expected) || 0;
      const rec = Number(row.received) || 0;
      const expH = (exp / max) * plotH;
      const recH = (rec / max) * plotH;
      return [
        {
          id: `${row.id}-expected`,
          group: row.id,
          period: row.period,
          series: 'Expected',
          x: slotX,
          y: plotBottom - expH,
          w: barW,
          h: expH,
          value: this._fmtCompactCurrency(exp),
          cls: 'rid-gbar__bar rid-gbar__bar_expected',
          a11y: `${row.period} expected: ${this._fmtCurrency(exp)}`
        },
        {
          id: `${row.id}-received`,
          group: row.id,
          period: row.period,
          series: 'Received',
          x: slotX + barW,
          y: plotBottom - recH,
          w: barW,
          h: recH,
          value: this._fmtCompactCurrency(rec),
          cls: 'rid-gbar__bar rid-gbar__bar_received',
          a11y: `${row.period} received: ${this._fmtCurrency(rec)}`
        }
      ];
    });

    const gridlines = [0.25, 0.5, 0.75, 1].map((p, i) => ({
      id: `g-${i}`,
      x1: plotLeft,
      x2: plotRight,
      y: plotBottom - plotH * p
    }));

    const xTicks = rows.map((r, i) => ({
      id: r.id,
      label: r.period,
      x: plotLeft + slotW * i + slotW / 2,
      y: plotBottom + 16
    }));

    return {
      hasData: true,
      width: G.width,
      height: G.height,
      bars,
      gridlines,
      xTicks,
      legend: [
        { id: 'expected', label: 'Expected', cls: 'rid-legend__dot rid-legend__dot_expected' },
        { id: 'received', label: 'Received', cls: 'rid-legend__dot rid-legend__dot_received' }
      ],
      a11y: 'Expected vs received commission by quarter'
    };
  }

  // ── Tier 3a + 3b: Horizontal bar charts ──────────────────────
  get lobBarChart() {
    return this._buildHorizontalBar(
      this._data && this._data.commissionByLob,
      'Commission by Line of Business'
    );
  }
  get carrierBarChart() {
    return this._buildHorizontalBar(
      this._data && this._data.commissionByCarrier,
      'Commission by Carrier'
    );
  }
  _buildHorizontalBar(rows, a11y) {
    rows = rows || [];
    if (!rows.length) return { hasData: false };
    const max = Math.max(...rows.map((r) => Number(r.value) || 0), 1);
    const sorted = rows
      .slice()
      .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
    const items = sorted.map((r) => {
      const v = Number(r.value) || 0;
      const pct = Math.max(2, Math.round((v / max) * 100));
      return {
        id: r.id,
        label: r.label,
        value: v,
        valueDisplay: this._fmtCompactCurrency(v),
        barStyle: `width: ${pct}%;`,
        a11y: `${r.label}: ${this._fmtCurrency(v)}`
      };
    });
    return {
      hasData: true,
      items,
      a11y: `${a11y}: ${items.length} categories`
    };
  }

  // ── Tier 4a: Billing pipeline mini-KPIs ──────────────────────
  get billingPipelineTiles() {
    const b = (this._data && this._data.billingPipeline) || {};
    return [
      { id: 'scheduled', label: 'Scheduled', value: this._fmtCompactCurrency(b.scheduled) },
      { id: 'billed', label: 'Billed', value: this._fmtCompactCurrency(b.billed) },
      { id: 'pending', label: 'Pending', value: this._fmtCompactCurrency(b.pending) },
      {
        id: 'next',
        label: 'Next Billing Date',
        value: b.nextBillingDate ? this._fmtDate(b.nextBillingDate) : '-'
      }
    ];
  }

  // ── Tier 4b: Invoice Aging (stacked bar) ─────────────────────
  // One horizontal bar segmented by aging bucket with side legend.
  get agingStackBar() {
    const rows = (this._data && this._data.invoiceAging) || [];
    if (!rows.length) return { hasData: false };
    const total = rows.reduce((s, r) => s + (Number(r.value) || 0), 0);
    if (total === 0) return { hasData: false };
    const colorCls = {
      current: 'rid-stack__seg_current',
      '1-30': 'rid-stack__seg_30',
      '31-60': 'rid-stack__seg_60',
      '90plus': 'rid-stack__seg_90'
    };
    const segments = rows.map((r, i) => {
      const v = Number(r.value) || 0;
      const pct = (v / total) * 100;
      return {
        id: r.id || `seg-${i}`,
        bucket: r.bucket,
        value: v,
        valueDisplay: this._fmtCompactCurrency(v),
        pctDisplay: `${Math.round(pct)}%`,
        widthStyle: `width: ${pct}%;`,
        cls: `rid-stack__seg ${colorCls[r.id] || ''}`
      };
    });
    return {
      hasData: true,
      total,
      totalDisplay: this._fmtCurrency(total),
      segments,
      a11y: `Invoice aging by bucket: ${segments
        .map((s) => `${s.bucket} ${s.pctDisplay}`)
        .join(', ')}.`
    };
  }

  // ── Tier 4c: Monthly Revenue Trend (line chart) ──────────────
  get monthlyTrendChart() {
    const rows = (this._data && this._data.monthlyRevenueTrend) || [];
    const G = CHART.line;
    if (!rows.length) return { hasData: false };
    const max = this._niceRoundMax(Math.max(...rows.map((r) => Number(r.revenue) || 0), 0));
    const plotTop = G.padTop;
    const plotBottom = G.height - G.padBottom;
    const plotH = plotBottom - plotTop;
    const plotLeft = G.padLeft;
    const plotRight = G.width - G.padRight;
    const plotW = plotRight - plotLeft;
    const stepX = rows.length > 1 ? plotW / (rows.length - 1) : 0;

    const points = rows.map((r, i) => {
      const v = Number(r.revenue) || 0;
      const x = plotLeft + stepX * i;
      const y = plotBottom - (v / max) * plotH;
      return {
        id: r.id || `p-${i}`,
        x,
        y,
        month: r.month,
        value: v,
        valueDisplay: this._fmtCompactCurrency(v),
        a11y: `${r.month}: ${this._fmtCurrency(v)}`
      };
    });
    const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
    const areaPath = `M ${plotLeft},${plotBottom} L ${points
      .map((p) => `${p.x},${p.y}`)
      .join(' L ')} L ${plotRight},${plotBottom} Z`;

    const gridlines = [0.25, 0.5, 0.75, 1].map((p, i) => ({
      id: `g-${i}`,
      x1: plotLeft,
      x2: plotRight,
      y: plotBottom - plotH * p
    }));

    return {
      hasData: true,
      width: G.width,
      height: G.height,
      polyline,
      areaPath,
      points,
      gridlines,
      xTicks: points.map((p) => ({
        id: `xt-${p.id}`,
        label: p.month,
        x: p.x,
        y: plotBottom + 16
      })),
      baselineY: plotBottom,
      a11y: 'Monthly revenue trend, year to date'
    };
  }

  // ── Tier 5: Tables ───────────────────────────────────────────
  get producerRows() {
    const rows = (this._data && this._data.producerData) || [];
    return rows.slice().map((p) => ({
      ...p,
      totalCommissionDisplay: this._fmtCurrency(p.totalCommission),
      avgCommissionDisplay: `${p.avgCommissionPct.toFixed(1)}%`
    }));
  }
  get statementRows() {
    const rows = (this._data && this._data.commissionStatements) || [];
    return rows
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((s) => ({
        ...s,
        totalCommissionDisplay: this._fmtCurrency(s.totalCommission),
        dateDisplay: this._fmtDate(s.date),
        statusClass: this._statusClass(s.status)
      }));
  }
  get hasProducers() {
    return this.producerRows.length > 0;
  }
  get hasStatements() {
    return this.statementRows.length > 0;
  }

  // ── Helpers ──────────────────────────────────────────────────
  _fmtCurrency(n) {
    const num = Number(n);
    if (Number.isNaN(num)) return '-';
    return num.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    });
  }
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
  // Trend chip - same shape Client 360 uses so the visual language
  // stays consistent. `goodDir` flips the better/worse semantic for
  // metrics where down is positive (receivables).
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
        ? 'rid-trend rid-trend_better'
        : better === 'worse'
          ? 'rid-trend rid-trend_worse'
          : 'rid-trend rid-trend_flat';
    const icon =
      dir === 'up'
        ? 'M6 2l4 7H2z'
        : dir === 'down'
          ? 'M6 10L2 3h8z'
          : 'M2 6h6l-2-2m2 2l-2 2';
    return { cls, icon, text: `${sign}${rounded}% YoY`, srText: better };
  }
  _statusClass(status) {
    const s = (status || '').toLowerCase();
    if (s === 'paid') return 'rid-pill rid-pill_success';
    if (s === 'pending') return 'rid-pill rid-pill_info';
    if (s === 'disputed') return 'rid-pill rid-pill_warning';
    return 'rid-pill';
  }
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
}
