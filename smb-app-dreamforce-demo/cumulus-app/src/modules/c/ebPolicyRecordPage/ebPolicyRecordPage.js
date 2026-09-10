import { LightningElement, api, track } from 'lwc';

/**
 * c-eb-policy-record-page - lightweight LEX-style record page shell for an
 * Employee Benefits Insurance Policy. Hosts a Details / Related / Plan tab
 * strip; the Plan tab renders c-eb-policy-plan-tab. Entry point for the new
 * EB Insurance Rate Plan flow (?route=eb-policy-record-page).
 */

// Related leads, then Details, then the app-specific tab - the same order
// the account and P&C policy record pages use.
const TABS = [
  { id: 'related', label: 'Related' },
  { id: 'details', label: 'Details' },
  { id: 'plan', label: 'Plan' }
];

export default class EbPolicyRecordPage extends LightningElement {
  @track activeTab = 'plan';

  @api policyName = 'Acme Manufacturing - 2026 EB Policy';
  @api policyNumber = 'POL-ACME-EB-2026';
  @api lob = 'Employee Benefits';
  // Launch payload used by the "Renew Policy" header action to pre-fill the
  // Create RFQ intake modal (account, LOB/LOC, prior policy).
  @api renewContext;

  get tabs() {
    return TABS.map((t) => ({
      ...t,
      tabClass:
        t.id === this.activeTab
          ? 'eb-rp__tab eb-rp__tab_active'
          : 'eb-rp__tab',
      ariaSelected: t.id === this.activeTab ? 'true' : 'false'
    }));
  }

  get isPlanTab() {
    return this.activeTab === 'plan';
  }
  get isDetailsTab() {
    return this.activeTab === 'details';
  }
  get isRelatedTab() {
    return this.activeTab === 'related';
  }

  handleTabClick(event) {
    const id = event.currentTarget.dataset.id;
    if (id) this.activeTab = id;
  }

  // "Renew Policy" - opens the Create RFQ intake modal pre-filled
  // for this policy's account. Bubbles to the app shell, which owns the modal.
  handleRenewPolicy() {
    this.dispatchEvent(
      new CustomEvent('startrfqintake', {
        detail: { context: this.renewContext || null },
        bubbles: true,
        composed: true
      })
    );
  }
}
