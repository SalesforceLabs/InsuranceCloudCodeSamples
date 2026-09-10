import { LightningElement, track } from 'lwc';

/**
 * c-eb-policy-plan-tab - the "Plan" tab on an EB Insurance Policy record page.
 * Renders two standard related lists (Insurance Rate Plans + Insurance
 * Contribution Plans) and hosts the New Insurance Rate Plan modal.
 */

const FREQ_ABBR = {
  Monthly: 'Mo',
  Quarterly: 'Qtr',
  'Semi-Annual': 'Semi',
  Annual: 'Yr'
};

function fmtCurrency(raw) {
  if (raw == null || raw === '') return '-';
  const n = Number(String(raw).replace(/[^0-9.-]/g, ''));
  if (Number.isNaN(n)) return `$${raw}`;
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  });
}

export default class EbPolicyPlanTab extends LightningElement {
  @track ratePlans = [];
  @track showRateModal = false;

  _seq = 0;

  get ratePlanCount() {
    return this.ratePlans.length;
  }
  get ratePlanTitle() {
    return `Insurance Rate Plans (${this.ratePlanCount})`;
  }
  get contributionTitle() {
    return 'Insurance Contribution Plans (0)';
  }
  get hasRatePlans() {
    return this.ratePlans.length > 0;
  }

  get ratePlanRows() {
    return this.ratePlans.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type || '-',
      frequency: p.frequency || '-',
      premium: fmtCurrency(p.totalPremium)
    }));
  }

  // ── New Rate Plan modal ─────────────────────────────────────────
  handleNewRatePlan() {
    this.showRateModal = true;
  }

  handleModalCancel() {
    this.showRateModal = false;
  }

  handleModalCreate(event) {
    const { values, addLineItems } = event.detail || {};
    this._seq += 1;
    const freq = values?.frequency || '';
    const abbr = FREQ_ABBR[freq] || freq;
    this.ratePlans = [
      ...this.ratePlans,
      {
        id: `irp-${this._seq}`,
        name: `IRP-${String(1000 + this._seq)}`,
        type: values?.type || '',
        frequency: freq,
        abbr,
        totalPremium: values?.totalPremium || ''
      }
    ];
    this.showRateModal = false;
  }
}
