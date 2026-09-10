import { LightningElement, api, track } from 'lwc';

/**
 * c-eb-new-rate-plan-modal - "New Insurance Rate Plan" creation dialog for the
 * EB Insurance Policy → Plan tab AND the EB Quoting Workspace census step.
 * Pure presentational SLDS markup (this app has no lightning-* base
 * components), so comboboxes are native <select> styled as SLDS,
 * currency/search fields are .slds-input with affixes, and the Insurance
 * Policy is a read-only resolved-lookup pill.
 *
 * @api open          - controls render (resets the form each time it opens).
 * @api policyLabel   - context-driven "Insurance Policy" prefill (e.g. the RFQ
 *                      application name when launched from the census step).
 * @api geoState      - context-driven "Geo State" prefill.
 * @api currencyIso   - context-driven "Currency ISO Code" prefill (default USD).
 * @api headcount     - { employeeOnly, employeeSpouse, employeeChildren,
 *                       employeeFamily } prefill for the Enrollment Headcount
 *                      block.
 *
 * Events:
 *   - cancel - Cancel / backdrop / X clicked.
 *   - create - Save or Save & Add Line Items
 *              (detail: { values, addLineItems }).
 */

const FREQUENCY_OPTIONS = ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual'];

const TYPE_OPTIONS = [
  'Fully Insured Health',
  'Per Person Per Month',
  'Per Employee Per Month',
  'Per Member Per Month',
  'Flat',
  'Benefit Volume',
  'Covered Payroll Volume',
  'Fully Insured Equivalent'
];

// Eligible tiers a broker can include in the rate plan. The id is the
// stable key used in `fields.eligibleTiers` (and to map to the per-tier
// headcount fields), `label` is the display text, and `hcKey` is the
// matching field on the modal's headcount block.
const ELIGIBLE_TIER_DEFS = [
  { id: 'employeeOnly',     label: 'Employee Only',       hcKey: 'hcEmployeeOnly'     },
  { id: 'employeeSpouse',   label: 'Employee & Spouse',   hcKey: 'hcEmployeeSpouse'   },
  { id: 'employeeChildren', label: 'Employee & Children', hcKey: 'hcEmployeeChildren' },
  { id: 'employeeFamily',   label: 'Employee & Family',   hcKey: 'hcEmployeeFamily'   }
];

const DEFAULT_FIELDS = {
  insurancePolicy: '1111',
  type: '',
  frequency: '',
  // Eligible Tiers - multi-select. Broker picks which tiers participate
  // in this rate plan; the FTE-per-tier table only shows rows for the
  // selected ids.
  eligibleTiers: [],
  // Per-tier FTE counts. Populated by the table that appears once
  // type + frequency + at least one eligible tier are chosen.
  hcEmployeeOnly: '',
  hcEmployeeSpouse: '',
  hcEmployeeChildren: '',
  hcEmployeeFamily: ''
};

export default class EbNewRatePlanModal extends LightningElement {
  _open = false;
  @track fields = { ...DEFAULT_FIELDS };
  // Eligible Tiers is rendered as a multi-select combobox; tracks
  // whether the menu is open so the trigger can flip its chevron.
  @track _tierMenuOpen = false;
  // Inline style for the open menu - positioned fixed to the viewport
  // so it escapes the modal body's `overflow: auto` clipping.
  @track _tierMenuStyle = '';

  // Contextual prefill (optional). `geoState` + `currencyIso` are
  // retained for backwards compatibility but no longer surface in the
  // trimmed modal - kept to avoid breaking callers that still pass them.
  @api policyLabel;
  @api geoState;
  @api currencyIso;
  @api headcount;

  @api
  get open() {
    return this._open;
  }
  set open(value) {
    const next = !!value;
    // Reset to a clean form every time the dialog is (re)opened,
    // merging any context-driven prefill over the defaults.
    if (next && !this._open) {
      this.fields = { ...DEFAULT_FIELDS, ...this._prefillFromContext() };
      this._resetTierMenu();
    }
    this._open = next;
  }

  // Build a partial field overlay from the @api prefill props. The
  // Insurance Policy pill is locked to the launch context; the FTE
  // values for any non-zero census tiers flow in so the table - once
  // revealed - already shows what the broker captured upstream.
  _prefillFromContext() {
    const overlay = {};
    if (this.policyLabel) overlay.insurancePolicy = String(this.policyLabel);
    const hc = this.headcount || {};
    const num = (v) =>
      v === 0 || v === '0' || (v && String(v).trim() !== '') ? String(v) : '';
    overlay.hcEmployeeOnly = num(hc.employeeOnly);
    overlay.hcEmployeeSpouse = num(hc.employeeSpouse);
    overlay.hcEmployeeChildren = num(hc.employeeChildren);
    overlay.hcEmployeeFamily = num(hc.employeeFamily);
    return overlay;
  }

  // ── Picklist option getters ─────────────────────────────────────
  get frequencyOptions() {
    return this._withPlaceholder(FREQUENCY_OPTIONS, this.fields.frequency);
  }
  get typeOptions() {
    return this._withPlaceholder(TYPE_OPTIONS, this.fields.type);
  }
  get isFrequencyEmpty() {
    return !this.fields.frequency;
  }
  get isTypeEmpty() {
    return !this.fields.type;
  }
  // Current values passed to the c-picklist dropdowns.
  get fieldType() {
    return this.fields.type;
  }
  get fieldFrequency() {
    return this.fields.frequency;
  }

  // ── Eligible Tiers (SLDS 2 multi-select combobox) ──────────────
  // Trigger label is comma-joined selected labels or the placeholder.
  get eligibleTierTriggerLabel() {
    if (!this.fields.eligibleTiers.length) return 'Select tiers…';
    return ELIGIBLE_TIER_DEFS.filter((t) =>
      this.fields.eligibleTiers.includes(t.id)
    )
      .map((t) => t.label)
      .join(', ');
  }
  get eligibleTierValueCls() {
    return this.fields.eligibleTiers.length
      ? 'eb-rate__multi-value'
      : 'eb-rate__multi-value is-placeholder';
  }
  get eligibleTierTriggerCls() {
    return this._tierMenuOpen
      ? 'eb-rate__multi-trigger is-open'
      : 'eb-rate__multi-trigger';
  }
  get tierMenuAriaExpanded() {
    return this._tierMenuOpen ? 'true' : 'false';
  }
  get isTierMenuOpen() {
    return this._tierMenuOpen;
  }
  get tierMenuStyle() {
    return this._tierMenuStyle;
  }
  // View-model for each menu item - `selected` drives the checkbox
  // state and `aria-selected` on the option row.
  get eligibleTierMenuItems() {
    return ELIGIBLE_TIER_DEFS.map((t) => {
      const selected = this.fields.eligibleTiers.includes(t.id);
      return {
        id: t.id,
        label: t.label,
        selected,
        ariaSelected: selected ? 'true' : 'false',
        cls: selected
          ? 'eb-rate__multi-item is-selected'
          : 'eb-rate__multi-item'
      };
    });
  }
  get hasEligibleTiers() {
    return this.fields.eligibleTiers.length > 0;
  }

  // ── Field value pass-throughs ───────────────────────────────────
  get insurancePolicy() {
    return this.fields.insurancePolicy;
  }

  // ── Headcount table (revealed after required selections) ────────
  // Only renders rows for the selected eligible tiers, in canonical
  // (catalog) order so the broker sees a consistent layout no matter
  // the order they ticked the chips.
  get showHeadcountTable() {
    return !!this.fields.type && !!this.fields.frequency && this.hasEligibleTiers;
  }
  get headcountTierRows() {
    return ELIGIBLE_TIER_DEFS.filter((t) =>
      this.fields.eligibleTiers.includes(t.id)
    ).map((t) => ({
      id: t.id,
      label: t.label,
      hcKey: t.hcKey,
      value: this.fields[t.hcKey] || ''
    }));
  }
  // Sum only across the selected (eligible) tiers - tiers not in scope
  // for this rate plan don't roll up into the total.
  get hcTotal() {
    return ELIGIBLE_TIER_DEFS.filter((t) =>
      this.fields.eligibleTiers.includes(t.id)
    ).reduce((sum, t) => {
      const n = Number(this.fields[t.hcKey]);
      return sum + (Number.isNaN(n) ? 0 : n);
    }, 0);
  }

  // ── Save gating ─────────────────────────────────────────────────
  // Required = Type + Frequency + at least one Eligible Tier.
  get requiredComplete() {
    return !!this.fields.type && !!this.fields.frequency && this.hasEligibleTiers;
  }
  get saveDisabled() {
    return !this.requiredComplete;
  }
  get saveAddDisabled() {
    return !this.requiredComplete;
  }

  _withPlaceholder(values, current) {
    return values.map((v) => ({
      value: v,
      label: v,
      selected: v === current
    }));
  }

  // ── Handlers ────────────────────────────────────────────────────
  handleFieldChange(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) return;
    this.fields = { ...this.fields, [field]: event.currentTarget.value };
  }

  handleEligibleTierToggle(event) {
    // Toggle is wired to both the trigger's hidden inputs and the
    // menu's checkboxes - both carry the tier id on `data-id`.
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    const has = this.fields.eligibleTiers.includes(id);
    this.fields = {
      ...this.fields,
      eligibleTiers: has
        ? this.fields.eligibleTiers.filter((x) => x !== id)
        : [...this.fields.eligibleTiers, id]
    };
  }

  // c-picklist change handlers for the single-select dropdowns.
  handleTypeChange(event) {
    this.fields = { ...this.fields, type: event.detail.value };
  }
  handleFrequencyChange(event) {
    this.fields = { ...this.fields, frequency: event.detail.value };
  }

  handleTierMenuToggle() {
    if (this._tierMenuOpen) {
      this._tierMenuOpen = false;
      return;
    }
    this._tierMenuOpen = true;
    this._positionTierMenu();
  }
  handleTierMenuScrim() {
    this._tierMenuOpen = false;
  }
  // Reset the open state every time the modal is closed so re-opening
  // doesn't pop the menu back into view.
  _resetTierMenu() {
    this._tierMenuOpen = false;
    this._tierMenuStyle = '';
  }

  // Anchor the fixed-position menu to the trigger's viewport rect so it
  // escapes the modal body's overflow clipping. Flips upward + caps its
  // height when there isn't room below.
  _positionTierMenu() {
    const trigger = this.template.querySelector('.eb-rate__multi-trigger');
    if (!trigger || typeof window === 'undefined') {
      this._tierMenuStyle = '';
      return;
    }
    const r = trigger.getBoundingClientRect();
    const gap = 4;
    const margin = 8;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const maxH = 288;
    const spaceBelow = vh - r.bottom;
    const spaceAbove = r.top;
    const openUp = spaceBelow < Math.min(maxH, 180) && spaceAbove > spaceBelow;
    let s = `position:fixed;left:${Math.round(r.left)}px;width:${Math.round(
      r.width
    )}px;right:auto;`;
    if (openUp) {
      const avail = Math.max(120, Math.min(maxH, spaceAbove - gap - margin));
      s += `bottom:${Math.round(vh - r.top + gap)}px;top:auto;max-height:${Math.round(
        avail
      )}px;`;
    } else {
      const avail = Math.max(120, Math.min(maxH, spaceBelow - gap - margin));
      s += `top:${Math.round(r.bottom + gap)}px;bottom:auto;max-height:${Math.round(
        avail
      )}px;`;
    }
    this._tierMenuStyle = s;
  }

  handleCancel() {
    this.dispatchEvent(new CustomEvent('cancel'));
  }

  handleBackdrop() {
    this.handleCancel();
  }

  stopPropagation(event) {
    event.stopPropagation();
  }

  handleSave() {
    if (this.saveDisabled) return;
    this._emitCreate(false);
  }

  handleSaveAddLineItems() {
    if (this.saveAddDisabled) return;
    this._emitCreate(true);
  }

  _emitCreate(addLineItems) {
    // Bundle the per-tier headcount alongside the rest of the form. The
    // headcount map carries every tier so downstream consumers can
    // detect changes, but `eligibleTiers` flags which subset actually
    // applies to this rate plan.
    const headcount = {
      employeeOnly: this.fields.hcEmployeeOnly,
      employeeSpouse: this.fields.hcEmployeeSpouse,
      employeeChildren: this.fields.hcEmployeeChildren,
      employeeFamily: this.fields.hcEmployeeFamily,
      total: this.hcTotal
    };
    this.dispatchEvent(
      new CustomEvent('create', {
        detail: {
          values: {
            ...this.fields,
            eligibleTiers: this.fields.eligibleTiers.slice(),
            headcount
          },
          addLineItems
        }
      })
    );
  }
}
