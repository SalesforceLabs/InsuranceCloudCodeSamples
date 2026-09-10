import { LightningElement, track } from 'lwc';
import { renewalAlerts, producerPipelineKpis } from 'data/mockData';
import { formatUsDate } from 'data/dates';

// Currency formatter shared across table cells. Kept module-scoped so
// the constructor doesn't rebuild it on every mount.
const USD_FULL = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

// A row is a "big-increase" trigger for the Remarket action when the
// renewal quote is 15%+ above the expiring premium.
const BIG_INCREASE_THRESHOLD = 1.15;

const TAB_ACTION_REQUIRED = 'action-required';
const TAB_ALL_RENEWALS = 'all-renewals';

export default class RenewalWorkspace extends LightningElement {
  @track _activeTab = TAB_ACTION_REQUIRED;

  // ═════════════════════════════════════════════════════════════
  // KPI banner - mirrors the Hub's top strip so the deep-dive
  // anchors on the same headline numbers the Producer just saw.
  // ═════════════════════════════════════════════════════════════
  get kpiTiles() {
    const k = producerPipelineKpis;
    return [
      {
        id: 'renewals-30',
        label: 'Renewals (<30 Days)',
        value: String(k.renewals30),
        cls: 'rw-kpi rw-kpi--urgent'
      },
      {
        id: 'renewals-31-60',
        label: 'Renewals (31-60 Days)',
        value: String(k.renewals3160),
        cls: 'rw-kpi rw-kpi--warning'
      },
      {
        id: 'pipeline-premium',
        label: 'Pipeline Premium (120 Days)',
        value: USD_FULL.format(k.pipelinePremium),
        cls: 'rw-kpi'
      },
      {
        id: 'pipeline-commission',
        label: 'Pipeline Commission',
        value: USD_FULL.format(k.pipelineCommission),
        cls: 'rw-kpi rw-kpi--accent'
      }
    ];
  }

  // ═════════════════════════════════════════════════════════════
  // Row derivation - both tabs read from the same 120-day pipeline
  // slice so counts and cell values never drift.
  // ═════════════════════════════════════════════════════════════
  get _pipelineRows() {
    return renewalAlerts
      .filter((r) => r.daysToExpiration >= 0 && r.daysToExpiration <= 120)
      .sort((a, b) => a.daysToExpiration - b.daysToExpiration);
  }

  _decoratePipelineRow(r) {
    const ratio = r.currentPremium ? r.renewalPremium / r.currentPremium : 1;
    const pctDelta = Math.round((ratio - 1) * 100);
    const hasBigIncrease = ratio >= BIG_INCREASE_THRESHOLD;
    const flags = [];
    if (hasBigIncrease) {
      flags.push({
        key: r.id + '-flag-premium',
        label: `Premium +${pctDelta}%`,
        cls: 'rw-flag rw-flag--premium'
      });
    }
    if (r.hasOpenClaim) {
      flags.push({
        key: r.id + '-flag-claim',
        label: 'Open Claim',
        cls: 'rw-flag rw-flag--claim'
      });
    }
    // Workspace action mapping is simpler than the old hub's:
    // big-increase rows get a primary Remarket CTA, everything else
    // (open claim or clean) gets a secondary View that opens the
    // account record page for context.
    let actionLabel = 'View';
    let actionCls = 'rw-action rw-action--secondary';
    if (hasBigIncrease) {
      actionLabel = 'Remarket';
      actionCls = 'rw-action rw-action--primary';
    }
    return {
      id: r.id,
      accountId: r.accountId,
      accountName: r.accountName,
      policyType: r.policyType,
      expirationDate: formatUsDate(r.expirationDate),
      currentPremiumFmt: USD_FULL.format(r.currentPremium || 0),
      renewalPremiumFmt: USD_FULL.format(r.renewalPremium || 0),
      flags,
      hasFlags: flags.length > 0,
      actionLabel,
      actionCls
    };
  }

  get _decoratedPipelineRows() {
    return this._pipelineRows.map((r) => this._decoratePipelineRow(r));
  }

  get actionRequiredRows() {
    return this._decoratedPipelineRows.filter((r) => r.hasFlags);
  }
  get hasActionRequiredRows() {
    return this.actionRequiredRows.length > 0;
  }

  // Raw at-risk alerts (same flag logic as actionRequiredRows) passed
  // straight to c-renewal-alert, which owns the card chrome + the
  // "Start Renewal RFQ" CTA. The Action Required tab renders these as
  // actionable cards rather than a table so the broker can launch an
  // RFQ inline; the All Renewals tab keeps the compact table read.
  get atRiskAlerts() {
    return this._pipelineRows.filter((r) => {
      const ratio = r.currentPremium ? r.renewalPremium / r.currentPremium : 1;
      return ratio >= BIG_INCREASE_THRESHOLD || !!r.hasOpenClaim;
    });
  }
  get hasAtRiskAlerts() {
    return this.atRiskAlerts.length > 0;
  }

  // Lighter shape for the All Renewals tab - just enough to give the
  // broker an at-a-glance pipeline read without the risk-flag chrome.
  get allRenewalsRows() {
    return this._pipelineRows.map((r) => ({
      id: r.id,
      accountId: r.accountId,
      accountName: r.accountName,
      policyType: r.policyType,
      expirationDate: formatUsDate(r.expirationDate),
      premiumFmt: USD_FULL.format(r.currentPremium || 0)
    }));
  }
  get hasAllRenewalsRows() {
    return this.allRenewalsRows.length > 0;
  }

  // ═════════════════════════════════════════════════════════════
  // Header + tabstrip
  // ═════════════════════════════════════════════════════════════
  get pipelineCountLabel() {
    const n = this._pipelineRows.length;
    const noun = n === 1 ? 'renewal' : 'renewals';
    return `${n} ${noun} in the pipeline · ${this.actionRequiredRows.length} flagged for action`;
  }

  get tabs() {
    const flagged = this.actionRequiredRows.length;
    const total = this.allRenewalsRows.length;
    return [
      {
        id: TAB_ACTION_REQUIRED,
        label: 'Action Required (At-Risk)',
        count: flagged,
        cls: this._tabCls(TAB_ACTION_REQUIRED),
        selected: this._activeTab === TAB_ACTION_REQUIRED ? 'true' : 'false'
      },
      {
        id: TAB_ALL_RENEWALS,
        label: 'All Renewals',
        count: total,
        cls: this._tabCls(TAB_ALL_RENEWALS),
        selected: this._activeTab === TAB_ALL_RENEWALS ? 'true' : 'false'
      }
    ];
  }
  _tabCls(id) {
    return id === this._activeTab ? 'rw-tab rw-tab--active' : 'rw-tab';
  }

  get showActionRequired() {
    return this._activeTab === TAB_ACTION_REQUIRED;
  }
  get showAllRenewals() {
    return this._activeTab === TAB_ALL_RENEWALS;
  }

  // ═════════════════════════════════════════════════════════════
  // Handlers - dispatch the same navigate CustomEvent contract the
  // shell already listens for.
  // ═════════════════════════════════════════════════════════════
  handleTabClick(event) {
    const tabId = event.currentTarget.dataset.tabId;
    if (tabId === TAB_ACTION_REQUIRED || tabId === TAB_ALL_RENEWALS) {
      this._activeTab = tabId;
    }
  }

  handleOpenAccount(event) {
    event.preventDefault();
    const accountId = event.currentTarget.dataset.accountId;
    if (!accountId) return;
    this._navigate({ route: 'account-record-page', accountId });
  }

  // "Start Renewal RFQ" from a c-renewal-alert card. Forward the full
  // alert as flat context so app.js can route to the correct LOB
  // wizard (isEbFlow/isHomeFlow key off context.lob / context.loc).
  handleStartRenewal(event) {
    const alert = event.detail?.alert;
    if (!alert) return;
    this._navigate({ route: 'rfq-workspace', context: { ...alert } });
  }

  // Account-name link on a card - detail carries the accountId.
  handleAlertOpenAccount(event) {
    const accountId = event.detail?.accountId;
    if (!accountId) return;
    this._navigate({ route: 'account-record-page', accountId });
  }
  handleAction(event) {
    const accountId = event.currentTarget.dataset.accountId;
    if (!accountId) return;
    this._navigate({ route: 'account-record-page', accountId });
  }
  handleBackToHub() {
    this._navigate({ route: 'run-my-day' });
  }
  _navigate(detail) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail,
      bubbles: true,
      composed: true
    }));
  }
}
