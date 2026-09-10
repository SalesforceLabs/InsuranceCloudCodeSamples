import { LightningElement, api, track } from 'lwc';
import { getPolicyRecord } from 'data/policyRecords';

/**
 * c-insurance-policy-record-page - LEX-style record page for a P&C
 * Insurance Policy, modelled on the standard `InsurancePolicy` page in an FSC
 * org running the Insurance Brokerage app.
 *
 * Tab strip carries the three tabs the renewal story turns on. The rest of
 * the FSC strip (Split Mgmt, Ins Pol Transactions, Billing) is dropped -
 * nothing in this flow reads them.
 *
 *   - Details   - the seven field sections (Policy, Direct Billing, Agency
 *                 Billing, Carrier, Payment, Renewal, Additional).
 *   - Related   - the related lists, empty ones collapsed to a header row.
 *   - Policy UI - "Insurance Policy Structure", the policy hierarchy grid
 *                 (policy > coverages > covered asset > asset coverages +
 *                 driver participant).
 *
 * Employee Benefits policies keep their own page (c-eb-policy-record-page)
 * because the EB story is a rate-plan flow, not a covered-asset hierarchy.
 */

const TABS = [
  { id: 'related', label: 'Related' },
  { id: 'details', label: 'Details' },
  { id: 'policyui', label: 'Policy UI' }
];

// Indentation per hierarchy level in the structure grid. The step is the
// shared SLDS spacing hook every parent-child tree in the app nests by, so
// this grid, the bundle tables, and the asset trees all step in unison.
const INDENT_STEP = 'var(--slds-g-spacing-6, 2rem)';

export default class InsurancePolicyRecordPage extends LightningElement {
  @api policyId;
  @api policyName;
  @api policyNumber;
  @api lob;
  @api accountId;
  // Row from the account's Insurance Policies list. Seeds the fallback
  // record for policies with no hand-authored fixture.
  @api policySeed;
  // Launch payload for the "New Request For Quote" header action. Carries
  // `isRenewal`, so the intake modal opens in its trimmed renewal form -
  // the policy the broker is acting on already answers "which prior policy".
  @api renewContext;

  // The hierarchy is the point of this page, so it opens on Policy UI with
  // every parent expanded rather than making the broker drill in.
  @track activeTab = 'policyui';
  @track expandedIds = [];
  @track dropdownOpen = false;

  connectedCallback() {
    this.expandedIds = this._parentIds(this.record.structure);
    // Close the overflow menu on any outside click so it can't be stranded
    // open when the broker clicks elsewhere on the record.
    this._docClickHandler = (e) => {
      if (!this.dropdownOpen) return;
      const trigger = this.template.querySelector('.action-dropdown');
      if (trigger && !trigger.contains(e.target)) this.dropdownOpen = false;
    };
    document.addEventListener('click', this._docClickHandler);
  }

  disconnectedCallback() {
    if (this._docClickHandler) {
      document.removeEventListener('click', this._docClickHandler);
      this._docClickHandler = null;
    }
  }

  get record() {
    return getPolicyRecord(this.policyId, {
      ...(this.policySeed || {}),
      name: this.policyName,
      number: this.policyNumber,
      lob: this.lob,
      accountId: this.accountId
    });
  }

  // ── Header ──────────────────────────────────────────────────────
  get displayName() {
    return this.record.name || this.policyName || 'Insurance Policy';
  }
  get highlights() {
    return this.record.highlights || [];
  }
  get statusLabel() {
    return this.record.status || 'Active';
  }

  get dropdownClass() {
    return this.dropdownOpen
      ? 'slds-dropdown-trigger slds-dropdown-trigger_click slds-is-open'
      : 'slds-dropdown-trigger slds-dropdown-trigger_click';
  }
  get dropdownAriaExpanded() {
    return this.dropdownOpen ? 'true' : 'false';
  }
  toggleDropdown(event) {
    event.stopPropagation();
    this.dropdownOpen = !this.dropdownOpen;
  }

  // ── Tab strip ───────────────────────────────────────────────────
  get tabs() {
    return TABS.map((t) => ({
      ...t,
      tabClass: t.id === this.activeTab ? 'sf-record-tab is-active' : 'sf-record-tab',
      ariaSelected: t.id === this.activeTab ? 'true' : 'false'
    }));
  }

  get isRelatedTab() {
    return this.activeTab === 'related';
  }
  get isDetailsTab() {
    return this.activeTab === 'details';
  }
  get isPolicyUiTab() {
    return this.activeTab === 'policyui';
  }
  handleTabClick(event) {
    const id = event.currentTarget.dataset.id;
    if (id) this.activeTab = id;
  }

  // ── Details tab ─────────────────────────────────────────────────
  get detailSections() {
    return (this.record.detailSections || []).map((s) => ({
      ...s,
      fields: (s.fields || []).map((f) => ({
        ...f,
        // Blank values render as the standard Salesforce em-space placeholder.
        displayValue: f.value === '' || f.value == null ? '-' : f.value,
        fieldClass: f.isWide ? 'ipr-det__field ipr-det__field_wide' : 'ipr-det__field'
      }))
    }));
  }

  // ── Related tab ─────────────────────────────────────────────────
  get relatedLists() {
    return (this.record.relatedLists || []).map((rl) => {
      const rows = rl.rows || [];
      return {
        ...rl,
        countLabel: `(${rl.count})`,
        hasRows: rows.length > 0,
        rows,
        columns: rl.columns || [],
        iconClass: `ipr-rl__icon ipr-rl__icon_${rl.icon || 'policy'}`,
        actionsLabel: `Show actions for ${rl.title}`
      };
    });
  }

  // ── Policy UI tab - Insurance Policy Structure ───────────────────
  get structureColumns() {
    return this.record.structureColumns || [];
  }

  /**
   * Depth-first flatten of the policy hierarchy into grid rows, skipping the
   * children of collapsed parents. Indentation and the toggle affordance are
   * precomputed here because LWC templates can't evaluate expressions.
   */
  get structureRows() {
    const rows = [];
    const walk = (nodes, level) => {
      (nodes || []).forEach((node) => {
        const children = node.children || [];
        const hasChildren = children.length > 0;
        const isExpanded = hasChildren && this.expandedIds.includes(node.id);
        rows.push({
          id: node.id,
          label: node.label,
          product: node.product || '',
          start: node.start || '',
          end: node.end || '',
          standardAmount: node.standardAmount || '',
          termAmount: node.termAmount || '',
          standardTax: node.standardTax || '',
          termTax: node.termTax || '',
          level,
          hasChildren,
          isExpanded,
          indentStyle: `padding-left: calc(${INDENT_STEP} * ${level - 1});`,
          rowClass: `ipr-tree__row ipr-tree__row_${node.kind || 'coverage'}`,
          toggleClass: isExpanded
            ? 'ipr-tree__toggle ipr-tree__toggle_open'
            : 'ipr-tree__toggle',
          toggleLabel: `${isExpanded ? 'Collapse' : 'Expand'} ${node.label}`,
          ariaExpanded: isExpanded ? 'true' : 'false'
        });
        if (isExpanded) walk(children, level + 1);
      });
    };
    walk(this.record.structure, 1);
    return rows;
  }

  handleToggleNode(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this.expandedIds = this.expandedIds.includes(id)
      ? this.expandedIds.filter((x) => x !== id)
      : [...this.expandedIds, id];
  }

  get allExpanded() {
    const parents = this._parentIds(this.record.structure);
    return parents.length > 0 && parents.every((id) => this.expandedIds.includes(id));
  }
  get expandAllLabel() {
    return this.allExpanded ? 'Collapse All' : 'Expand All';
  }

  handleToggleAll() {
    this.expandedIds = this.allExpanded ? [] : this._parentIds(this.record.structure);
  }

  /** Ids of every node that has children, at any depth. */
  _parentIds(nodes) {
    const ids = [];
    const walk = (list) => {
      (list || []).forEach((n) => {
        if (n.children && n.children.length) {
          ids.push(n.id);
          walk(n.children);
        }
      });
    };
    walk(nodes);
    return ids;
  }

  // ── Header actions ──────────────────────────────────────────────
  handleCreateRenewal() {
    this.dropdownOpen = false;
    this.dispatchEvent(
      new CustomEvent('startrfqintake', {
        detail: { context: this.renewContext || null },
        bubbles: true,
        composed: true
      })
    );
  }
}
