import { LightningElement, api, track } from 'lwc';
import { readForcedState } from 'c/emptyState';

/**
 * c-review-handoff-setup
 *
 * Admin-persona "Integrations & Preview" surface for the RFQ
 * Setup Workspace's Configure step. Two tabs:
 *
 *   1. Quote Provider Selection (default)
 *      - Accordion of InsQuoteProvider cards (one open at a time).
 *      - Account Id + Flow API Name are typeahead lookups.
 *      - Per-provider carriers selected via info-icon modal.
 *
 *   2. Runtime Preview Display (layout builder)
 *
 * Public contract:
 *   @api selectedRootProduct
 *   event "configurationsave"
 */

const TABS = [
  { id: 'providers', label: 'Quote Provider Selection' },
  { id: 'preview', label: 'Runtime Preview Display' }
];

const AVAILABLE_CARRIERS = [
  { id: 'apex-mutual', name: 'Apex Mutual' },
  { id: 'pinnacle-standard', name: 'Pinnacle Standard' },
  { id: 'harbor-shield', name: 'Harbor Shield Mutual' },
  { id: 'crestline-assurance', name: 'Crestline Assurance' },
  { id: 'northwind-uw', name: 'Northwind Underwriters' },
  { id: 'meridian-bound', name: 'Meridian Bound Insurance' }
];

// Fictitious account + flow catalogs for the typeahead lookups.
const ACCOUNT_OPTIONS = [
  { id: 'acct-acme', label: 'Acme' },
  { id: 'acct-horizon', label: 'Horizon Unlimited' },
  { id: 'acct-east-group', label: 'East Group' },
  { id: 'acct-pacific', label: 'Pacific Bank LLC' },
  { id: 'acct-college', label: 'College Capital' },
  { id: 'acct-bay', label: 'Bay Information Materials Inc' }
];

const FLOW_OPTIONS = [
  { id: 'flow-quinstreet', label: 'BIB Quinstreet Home Mock' },
  { id: 'flow-boldpenguin', label: 'BIB BoldPenguin Home Mock' },
  { id: 'flow-harbor', label: 'BIB Harbor Shield Auto Mock' },
  { id: 'flow-crestline', label: 'BIB Crestline Assurance Mock' },
  { id: 'flow-northwind', label: 'BIB Northwind UW Mock' },
  { id: 'flow-meridian', label: 'BIB Meridian Bound Mock' }
];

let _qpSeq = 2;
const _newProvider = (overrides = {}) => ({
  id: `qp-${++_qpSeq}`,
  name: '',
  accountName: '',
  flowApiName: '',
  isActive: true,
  additionalInfoJson: '',
  selectedCarrierIds: [],
  ...overrides
});

export default class ReviewHandoffSetup extends LightningElement {
  @api selectedRootProduct;

  @track activeTab = 'providers';

  // Demo-state override for the SLDS 2 empty/error surface.
  // Set via `?forceEmpty=rhs@<code>` (or a bare `?forceEmpty=<code>`).
  // The value is one of the official illustration codes.
  _forcedState = readForcedState('rhs');
  get hasForcedState() {
    return Boolean(this._forcedState);
  }
  get forcedStateName() {
    return this._forcedState;
  }
  get forcedStateTitle() {
    const map = {
      'error:appconnection': 'Quote provider service is unreachable',
      'error:connectionissue': 'Can’t load Integrations & Preview',
      'error:recoverable': 'Something went wrong loading providers',
      'error:unrecoverable': 'We hit an unexpected problem',
      'accessissues:request': 'You don’t have access to Integrations & Preview',
      'accessissues:limit': 'Integration limit reached',
      'success:new': 'No quote providers configured yet'
    };
    return map[this._forcedState] || '';
  }
  get forcedStateDescription() {
    const map = {
      'error:appconnection': 'The quote provider registry didn’t respond. Check the integration health page, then reload this step.',
      'error:connectionissue': 'We couldn’t reach the setup service. Check your connection, then try again.',
      'error:recoverable': 'The provider list failed to load. Try again in a moment.',
      'error:unrecoverable': 'Something broke while loading this step. Refresh the page or contact your admin.',
      'accessissues:request': 'Ask your Salesforce admin for the Manage Insurance Setup permission set to configure providers.',
      'accessissues:limit': 'This org has hit its integration quota. Remove an unused provider or contact your admin.',
      'success:new': 'Add one or more InsQuoteProvider destinations here so runtime quoting can route to them.'
    };
    return map[this._forcedState] || '';
  }
  get forcedStateCtaLabel() {
    const map = {
      'error:appconnection': 'Retry',
      'error:connectionissue': 'Retry',
      'error:recoverable': 'Try again',
      'error:unrecoverable': 'Reload',
      'success:new': 'Add quote provider'
    };
    return map[this._forcedState] || '';
  }
  get hasForcedStateCta() {
    return Boolean(this.forcedStateCtaLabel);
  }

  // Real empty state: no providers configured (rare in prototype, but
  // possible if the broker deletes them all).
  get hasNoProviders() {
    return !this.quoteProviders || this.quoteProviders.length === 0;
  }

  // Hide the primary panels whenever a forced empty/error state is
  // active, so the SLDS 2 empty-state takes over the surface.
  get showPreviewPanel() {
    return this.isPreviewTab && !this.hasForcedState;
  }
  get showProviderPanel() {
    return this.isProviderTab && !this.hasForcedState;
  }

  @track previewConfig = {
    quote: {
      policyStartDate: true,
      policyEndDate: true,
      linesOfCoverage: true,
      priorPolicy: true
    },
    lob: {
      vehicleAssets: true,
      drivers: true,
      ratePlan: true
    }
  };

  // Two seeded providers; accordion keeps only one expanded.
  @track quoteProviders = [
    _newProvider({
      id: 'qp-1',
      name: 'Quinstreet',
      accountName: 'Acme',
      flowApiName: 'BIB Quinstreet Home Mock',
      isActive: true,
      additionalInfoJson: '',
      selectedCarrierIds: ['apex-mutual', 'pinnacle-standard']
    }),
    _newProvider({
      id: 'qp-2',
      name: 'BoldPenguin',
      accountName: 'Horizon Unlimited',
      flowApiName: 'BIB BoldPenguin Home Mock',
      isActive: true,
      additionalInfoJson: '',
      selectedCarrierIds: ['harbor-shield']
    })
  ];

  @track expandedProviderId = 'qp-1';

  @track carrierModalProviderId = null;
  @track carrierModalDraftIds = [];

  // Active typeahead: { providerId, kind: 'account'|'flow' } | null
  @track openLookup = null;
  @track lookupQuery = '';

  // ── Tabs ─────────────────────────────────────────────────────
  get tabsView() {
    return TABS.map((t) => ({
      ...t,
      isActive: this.activeTab === t.id,
      cls:
        this.activeTab === t.id
          ? 'rhs-tabs__btn rhs-tabs__btn_active'
          : 'rhs-tabs__btn',
      ariaSelected: String(this.activeTab === t.id),
      tabIndex: this.activeTab === t.id ? '0' : '-1'
    }));
  }
  get isPreviewTab() {
    return this.activeTab === 'preview';
  }
  get isProviderTab() {
    return this.activeTab === 'providers';
  }

  handleTabClick(event) {
    const id = event.currentTarget.dataset.id;
    if (!id || id === this.activeTab) return;
    this.activeTab = id;
    this._closeLookup();
  }

  handleTabKeydown(event) {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const idx = TABS.findIndex((t) => t.id === this.activeTab);
    let next = idx;
    if (event.key === 'ArrowLeft') next = (idx - 1 + TABS.length) % TABS.length;
    if (event.key === 'ArrowRight') next = (idx + 1) % TABS.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = TABS.length - 1;
    this.activeTab = TABS[next].id;
    this._closeLookup();
    requestAnimationFrame(() => {
      const btn = this.template.querySelector(
        `.rhs-tabs__btn[data-id="${this.activeTab}"]`
      );
      if (btn) btn.focus();
    });
  }

  // ── Quote providers (accordion) ──────────────────────────────
  get providersView() {
    const canRemove = this.quoteProviders.length > 1;
    return this.quoteProviders.map((qp, i) => {
      const count = (qp.selectedCarrierIds || []).length;
      const isExpanded = this.expandedProviderId === qp.id;
      const accountOpen =
        this.openLookup &&
        this.openLookup.providerId === qp.id &&
        this.openLookup.kind === 'account';
      const flowOpen =
        this.openLookup &&
        this.openLookup.providerId === qp.id &&
        this.openLookup.kind === 'flow';
      const name = qp.name && qp.name.trim() ? qp.name.trim() : '';
      const headerLabel = name
        ? `Quote Provider ${i + 1} (${name})`
        : `Quote Provider ${i + 1}`;
      return {
        ...qp,
        headerLabel,
        nameId: `${qp.id}-name`,
        accountId: `${qp.id}-account`,
        flowId: `${qp.id}-flow`,
        jsonId: `${qp.id}-json`,
        hasAccount: !!(qp.accountName && qp.accountName.trim()),
        hasFlow: !!(qp.flowApiName && qp.flowApiName.trim()),
        selectedCarrierCount: count,
        hasSelectedCarriers: count > 0,
        canRemove,
        removeDisabled: !canRemove,
        isExpanded,
        ariaExpanded: String(isExpanded),
        cardClass: isExpanded ? 'rhs-qp-card is-expanded' : 'rhs-qp-card',
        chevronClass: isExpanded
          ? 'rhs-qp-card__chevron is-open'
          : 'rhs-qp-card__chevron',
        accountLookupOpen: accountOpen,
        flowLookupOpen: flowOpen,
        accountResults: accountOpen ? this._filterOptions(ACCOUNT_OPTIONS) : [],
        flowResults: flowOpen ? this._filterOptions(FLOW_OPTIONS) : [],
        hasAccountResults: accountOpen
          ? this._filterOptions(ACCOUNT_OPTIONS).length > 0
          : false,
        hasFlowResults: flowOpen
          ? this._filterOptions(FLOW_OPTIONS).length > 0
          : false,
        lookupQuery: accountOpen || flowOpen ? this.lookupQuery : ''
      };
    });
  }

  handleToggleProvider(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this._closeLookup();
    // Accordion: clicking the open panel collapses it; otherwise
    // open the clicked panel and close every sibling.
    this.expandedProviderId = this.expandedProviderId === id ? null : id;
  }

  handleRemoveQuoteProvider(event) {
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    if (!id || this.quoteProviders.length <= 1) return;
    this.quoteProviders = this.quoteProviders.filter((p) => p.id !== id);
    if (this.expandedProviderId === id) {
      this.expandedProviderId = this.quoteProviders[0]
        ? this.quoteProviders[0].id
        : null;
    }
    if (this.carrierModalProviderId === id) {
      this._closeCarrierModal();
    }
    this._closeLookup();
    this._emitSaved();
  }

  // Empty-state CTA. Adds a fresh, unexpanded provider row so the
  // broker can start editing immediately.
  handleAddQuoteProvider() {
    const p = _newProvider();
    this.quoteProviders = [...this.quoteProviders, p];
    this.expandedProviderId = p.id;
    this._emitSaved();
  }

  handleProviderFieldChange(event) {
    const id = event.target.dataset.id;
    const field = event.target.dataset.field;
    if (!id || !field) return;
    const value = event.target.value;
    this.quoteProviders = this.quoteProviders.map((p) =>
      p.id === id ? { ...p, [field]: value } : p
    );
    this._emitSaved();
  }

  handleProviderActiveToggle(event) {
    const id = event.target.dataset.id;
    if (!id) return;
    const checked = !!event.target.checked;
    this.quoteProviders = this.quoteProviders.map((p) =>
      p.id === id ? { ...p, isActive: checked } : p
    );
    this._emitSaved();
  }

  // ── Lookups (Account Id / Flow API Name) ─────────────────────
  _filterOptions(catalog) {
    const q = (this.lookupQuery || '').trim().toLowerCase();
    if (!q) return catalog.slice();
    return catalog.filter((o) => o.label.toLowerCase().includes(q));
  }

  handleOpenAccountLookup(event) {
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this.openLookup = { providerId: id, kind: 'account' };
    this.lookupQuery = '';
  }

  handleOpenFlowLookup(event) {
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this.openLookup = { providerId: id, kind: 'flow' };
    this.lookupQuery = '';
  }

  handleLookupQueryInput(event) {
    this.lookupQuery = event.target.value || '';
  }

  handleLookupScrim() {
    this._closeLookup();
  }

  handleSelectAccount(event) {
    event.stopPropagation();
    const providerId = event.currentTarget.dataset.providerId;
    const label = event.currentTarget.dataset.label;
    if (!providerId || !label) return;
    this.quoteProviders = this.quoteProviders.map((p) =>
      p.id === providerId ? { ...p, accountName: label } : p
    );
    this._closeLookup();
    this._emitSaved();
  }

  handleSelectFlow(event) {
    event.stopPropagation();
    const providerId = event.currentTarget.dataset.providerId;
    const label = event.currentTarget.dataset.label;
    if (!providerId || !label) return;
    this.quoteProviders = this.quoteProviders.map((p) =>
      p.id === providerId ? { ...p, flowApiName: label } : p
    );
    this._closeLookup();
    this._emitSaved();
  }

  handleClearAccount(event) {
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this.quoteProviders = this.quoteProviders.map((p) =>
      p.id === id ? { ...p, accountName: '' } : p
    );
    this._closeLookup();
    this._emitSaved();
  }

  handleClearFlow(event) {
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this.quoteProviders = this.quoteProviders.map((p) =>
      p.id === id ? { ...p, flowApiName: '' } : p
    );
    this._closeLookup();
    this._emitSaved();
  }

  _closeLookup() {
    this.openLookup = null;
    this.lookupQuery = '';
  }

  // ── Carriers modal ───────────────────────────────────────────
  get isCarrierModalOpen() {
    return !!this.carrierModalProviderId;
  }

  get carrierModalSubtitle() {
    const qp = this.quoteProviders.find(
      (p) => p.id === this.carrierModalProviderId
    );
    if (!qp) return 'Select carriers for this quote provider.';
    const label = qp.name && qp.name.trim() ? qp.name.trim() : 'this quote provider';
    return `Select carriers available for ${label}.`;
  }

  get carrierModalList() {
    const selected = new Set(this.carrierModalDraftIds);
    return AVAILABLE_CARRIERS.map((c) => ({
      ...c,
      isSelected: selected.has(c.id)
    }));
  }

  handleOpenCarriersModal(event) {
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    const qp = this.quoteProviders.find((p) => p.id === id);
    if (!qp) return;
    this._closeLookup();
    this.carrierModalProviderId = id;
    this.carrierModalDraftIds = [...(qp.selectedCarrierIds || [])];
  }

  handleCloseCarriersModal() {
    this._closeCarrierModal();
  }

  handleCarrierModalBackdrop() {
    this._closeCarrierModal();
  }

  stopPropagation(event) {
    event.stopPropagation();
  }

  handleCarrierDraftToggle(event) {
    const id = event.target.dataset.id;
    if (!id) return;
    const checked = !!event.target.checked;
    const next = new Set(this.carrierModalDraftIds);
    if (checked) next.add(id);
    else next.delete(id);
    this.carrierModalDraftIds = Array.from(next);
  }

  handleSaveCarriersModal() {
    const providerId = this.carrierModalProviderId;
    if (!providerId) return;
    const draft = [...this.carrierModalDraftIds];
    this.quoteProviders = this.quoteProviders.map((p) =>
      p.id === providerId ? { ...p, selectedCarrierIds: draft } : p
    );
    this._closeCarrierModal();
    this._emitSaved();
  }

  _closeCarrierModal() {
    this.carrierModalProviderId = null;
    this.carrierModalDraftIds = [];
  }

  // ── LOB filtering ────────────────────────────────────────────
  get isAutoLine() {
    return (
      this.selectedRootProduct === 'commercial_auto' ||
      this.selectedRootProduct === 'pl_auto'
    );
  }
  get isGroupBenefits() {
    return this.selectedRootProduct === 'medical';
  }
  get hasNoLobMatch() {
    return !this.isAutoLine && !this.isGroupBenefits;
  }

  get quotePolicyStart()  { return this.previewConfig.quote.policyStartDate; }
  get quotePolicyEnd()    { return this.previewConfig.quote.policyEndDate; }
  get quoteCoverages()    { return this.previewConfig.quote.linesOfCoverage; }
  get quotePriorPolicy()  { return this.previewConfig.quote.priorPolicy; }
  get lobVehicleAssets()  { return this.previewConfig.lob.vehicleAssets; }
  get lobDrivers()        { return this.previewConfig.lob.drivers; }
  get lobRatePlan()       { return this.previewConfig.lob.ratePlan; }

  handlePreviewToggle(event) {
    const group = event.target.dataset.group;
    const key   = event.target.dataset.key;
    if (!group || !key) return;
    const checked = !!event.target.checked;
    this.previewConfig = {
      ...this.previewConfig,
      [group]: { ...this.previewConfig[group], [key]: checked }
    };
    this._emitSaved();
  }

  _emitSaved() {
    this.dispatchEvent(
      new CustomEvent('configurationsave', {
        detail: {
          kind: 'reviewHandoff',
          previewConfig: this.previewConfig,
          quoteProviders: this.quoteProviders
        },
        bubbles: true,
        composed: true
      })
    );
  }
}
