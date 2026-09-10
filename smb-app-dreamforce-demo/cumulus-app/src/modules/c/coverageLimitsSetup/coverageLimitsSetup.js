import { LightningElement, api, track } from 'lwc';

/**
 * c-coverage-limits-setup
 *
 * Tabbed Coverage Limits configurator for the Personal Lines
 * (Auto) Configure step. Renders three parallel c-attribute-picker
 * instances (group-mode="tree") - one per level of the policy
 * hierarchy:
 *
 *   Overall Coverages  - policy-level coverages (off Root):
 *                         Bodily Injury, Property Damage, UM/UIM
 *   Vehicle            - coverages off the Vehicle (IPA):
 *                         Collision, Comprehensive
 *   Driver             - coverages off the Driver (IPP):
 *                         Medical Payments
 *
 * Each parent row is a COVERAGE (Bodily Injury, Collision …) with a
 * tri-state checkbox that cascades to its ATTRIBUTES (Limit,
 * Deductible …). Per-tab bulk control (select-all) comes from the
 * shared picker.
 *
 * Coverage catalog mirrors `docs/pcm-catalog.md` for the Auto
 * product - extend / replace as PCM evolves.
 */

const TABS = [
  { id: 'overall', label: 'Overall Coverages' },
  { id: 'vehicle', label: 'Vehicle' },
  { id: 'driver',  label: 'Driver' }
];

// Day-zero every coverage attribute is selected - the picker's
// "Select All by default; Show all not opened by default" rule
// means the admin sees an all-checked collapsed summary on first
// render and unticks what they don't want.
const _attr = (id, label) => ({ id, label, isSelected: true });
// Every coverage tree starts fully-collapsed neutral: the picker
// itself owns expand state after mount, so we only seed the shape.
const _cov = (id, name, attributes) => ({ id, name, attributes });

const SEED = {
  overall: [
    _cov('bi', 'Bodily Injury Liability', [_attr('bi-limit', 'Limit')]),
    _cov('pd', 'Property Damage Liability', [_attr('pd-limit', 'Limit')]),
    _cov('um', 'UM / UIM', [_attr('um-limit', 'Limit')])
  ],
  vehicle: [
    _cov('collision', 'Collision', [
      _attr('collision-limit', 'Limit'),
      _attr('collision-deductible', 'Deductible')
    ]),
    _cov('comprehensive', 'Comprehensive', [
      _attr('comp-limit', 'Limit'),
      _attr('comp-deductible', 'Deductible')
    ])
  ],
  driver: [
    _cov('med-pay', 'Medical Payments', [_attr('medpay-limit', 'Limit')])
  ]
};

export default class CoverageLimitsSetup extends LightningElement {
  @api selectedRootProduct;

  @track activeTab = 'overall';
  @track overallCoverages = SEED.overall.map((c) => ({ ...c, attributes: [...c.attributes] }));
  @track vehicleCoverages = SEED.vehicle.map((c) => ({ ...c, attributes: [...c.attributes] }));
  @track driverCoverages  = SEED.driver.map((c)  => ({ ...c, attributes: [...c.attributes] }));

  // ── Tabs ──────────────────────────────────────────────────────
  get tabsView() {
    return TABS.map((t) => ({
      ...t,
      isActive: this.activeTab === t.id,
      cls: this.activeTab === t.id
        ? 'cls-tabs__btn cls-tabs__btn_active'
        : 'cls-tabs__btn',
      ariaSelected: String(this.activeTab === t.id),
      tabIndex: this.activeTab === t.id ? '0' : '-1'
    }));
  }
  get isOverallActive() { return this.activeTab === 'overall'; }
  get isVehicleActive() { return this.activeTab === 'vehicle'; }
  get isDriverActive()  { return this.activeTab === 'driver'; }

  // ── c-attribute-picker view-model (tree mode) ───────────────
  // Coverage → picker's `{ id, label, children: [{ id, label }] }`
  // shape. Ownership of expand/collapse and tri-state parent
  // rendering moves into the picker.
  get overallPickerAttributes() { return this._toPickerAttrs(this.overallCoverages); }
  get vehiclePickerAttributes() { return this._toPickerAttrs(this.vehicleCoverages); }
  get driverPickerAttributes()  { return this._toPickerAttrs(this.driverCoverages); }

  get overallSelectedIds() { return this._selectedLeafIds(this.overallCoverages); }
  get vehicleSelectedIds() { return this._selectedLeafIds(this.vehicleCoverages); }
  get driverSelectedIds()  { return this._selectedLeafIds(this.driverCoverages); }

  _toPickerAttrs(list) {
    return list.map((cov) => ({
      id: cov.id,
      label: cov.name,
      children: (cov.attributes || []).map((a) => ({ id: a.id, label: a.label }))
    }));
  }
  _selectedLeafIds(list) {
    const out = [];
    for (const cov of list) {
      for (const a of (cov.attributes || [])) if (a.isSelected) out.push(a.id);
    }
    return out;
  }

  _slotForTab(tabId) {
    if (tabId === 'vehicle') return 'vehicleCoverages';
    if (tabId === 'driver')  return 'driverCoverages';
    return 'overallCoverages';
  }

  // ── Handlers ──────────────────────────────────────────────────
  handleTabClick(event) {
    const id = event.currentTarget.dataset.id;
    if (!id || id === this.activeTab) return;
    this.activeTab = id;
  }
  handleTabKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.handleTabClick(event);
  }

  // Toggle a single leaf. Cascades naturally to the parent's
  // tri-state via the picker's own decorator on re-render.
  handleAttrPickerToggle(event) {
    const { id, isChecked } = event.detail || {};
    if (!id) return;
    const slot = this._slotForTab(this.activeTab);
    this[slot] = this[slot].map((cov) => ({
      ...cov,
      attributes: cov.attributes.map((a) =>
        a.id !== id ? a : { ...a, isSelected: !!isChecked }
      )
    }));
    this._emit();
  }

  // Bulk toggle from either the header select-all or a parent-row
  // (tree parent) click. Either way, the detail carries the exact
  // set of leaf ids to flip, so we don't need to distinguish.
  handleAttrPickerSelectAll(event) {
    const { isChecked, ids } = event.detail || {};
    if (!Array.isArray(ids) || ids.length === 0) return;
    const idSet = new Set(ids);
    const slot = this._slotForTab(this.activeTab);
    this[slot] = this[slot].map((cov) => ({
      ...cov,
      attributes: cov.attributes.map((a) =>
        !idSet.has(a.id) ? a : { ...a, isSelected: !!isChecked }
      )
    }));
    this._emit();
  }

  _emit() {
    this.dispatchEvent(
      new CustomEvent('configurationsave', {
        detail: {
          kind: 'coverageLimits',
          overall: this.overallCoverages,
          vehicle: this.vehicleCoverages,
          driver:  this.driverCoverages
        },
        bubbles: true,
        composed: true
      })
    );
  }
}
