import { LightningElement, api, track } from 'lwc';

/**
 * c-pa-vehicle-form-fields - bare vehicle form (lookup + fields).
 *
 * Presentational fieldset extracted from c-pa-vehicle-modal so the same
 * form can be hosted in either:
 *   - c-pa-vehicle-modal          (standalone chrome for Add / Edit)
 *   - c-add-asset-modal           (two-step picker + form chrome)
 *
 * Parents own the modal chrome + Save/Cancel + open/close state; this
 * component just owns the field state and validation. Parents call
 * @api submit() to try to save; on success it returns the normalized
 * vehicle record and dispatches a `save` event. Validation errors
 * surface inline and no event fires.
 */

const USE_OPTIONS = ['Commute', 'Pleasure', 'Business'];
const BODY_CLASS_OPTIONS = ['Sedan', 'SUV', 'Truck', 'Wagon', 'Sports Car', 'Minivan'];

export default class PaVehicleFormFields extends LightningElement {
  // Optional prefill for edit paths. Setting seed after mount rehydrates
  // the fields. Null/undefined leaves whatever the broker has typed.
  _seed = null;
  @api
  get seed() {
    return this._seed;
  }
  set seed(value) {
    this._seed = value;
    if (value) {
      this._hydrateFromSeed(value);
    }
  }

  // Vehicles surfaced in the top-of-form lookup section. Parent
  // computes this as catalog-minus-rows-by-VIN so duplicates are
  // excluded. Empty array hides the lookup entirely.
  @api availableVehicles = [];

  @track year = '';
  @track make = '';
  @track model = '';
  @track vin = '';
  @track use = 'Commute';
  @track mileage = '';
  @track bodyClass = 'Sedan';
  @track garagingZip = '';
  @track showErrors = false;

  // ── Lookup state ────────────────────────────────────────────────
  @track searchOpen = false;
  @track searchQuery = '';
  @track _lookupSelectedId = null;
  @track _activeIndex = -1;

  connectedCallback() {
    if (this._seed) this._hydrateFromSeed(this._seed);
  }

  // ── Public API for the parent modal ─────────────────────────────
  // Called by the parent's Save button; validates + returns the
  // normalized vehicle record, or null when validation fails.
  @api
  submit() {
    if (!this.year || !this.make.trim() || !this.model.trim()) {
      this.showErrors = true;
      return null;
    }
    const miles = parseInt(String(this.mileage).replace(/[^0-9]/g, ''), 10);
    const annualMileage = Number.isFinite(miles)
      ? `${miles.toLocaleString()} mi/yr`
      : 'Mileage TBD';
    return {
      name: `${this.year} ${this.make.trim()} ${this.model.trim()}`.trim(),
      vin: this.vin.trim() || 'Pending',
      use: this.use,
      annualMileage,
      bodyClass: this.bodyClass,
      garagingZip: this.garagingZip.trim()
    };
  }

  // Called by the parent's Cancel / X / backdrop handlers to blow
  // away every field back to defaults.
  @api
  reset() {
    this.year = '';
    this.make = '';
    this.model = '';
    this.vin = '';
    this.use = 'Commute';
    this.mileage = '';
    this.bodyClass = 'Sedan';
    this.garagingZip = '';
    this.showErrors = false;
    this.searchOpen = false;
    this.searchQuery = '';
    this._lookupSelectedId = null;
    this._activeIndex = -1;
  }

  _hydrateFromSeed(v) {
    // Row stores name as "YYYY Make Model…" - split it back apart.
    const parts = (v.name || '').trim().split(/\s+/);
    if (parts.length && /^\d{4}$/.test(parts[0])) {
      this.year = parts[0];
      this.make = parts[1] || '';
      this.model = parts.slice(2).join(' ');
    } else {
      this.year = '';
      this.make = '';
      this.model = v.name || '';
    }
    this.vin = v.vin && v.vin !== 'Pending' ? v.vin : '';
    this.use = v.use || 'Commute';
    const miles = String(v.annualMileage || '').replace(/[^0-9]/g, '');
    this.mileage = miles || '';
    this.bodyClass = v.bodyClass || 'Sedan';
    this.garagingZip = v.garagingZip || '';
    this.showErrors = false;
  }

  // ── Field view-model ────────────────────────────────────────────
  get useOptions() {
    return USE_OPTIONS.map((v) => ({ value: v, label: v, selected: v === this.use }));
  }
  get bodyClassOptions() {
    return BODY_CLASS_OPTIONS.map((v) => ({
      value: v,
      label: v,
      selected: v === this.bodyClass
    }));
  }
  get yearError() { return this.showErrors && !this.year; }
  get makeError() { return this.showErrors && !this.make.trim(); }
  get modelError() { return this.showErrors && !this.model.trim(); }
  get yearClass() { return this._fieldClass(this.yearError); }
  get makeClass() { return this._fieldClass(this.makeError); }
  get modelClass() { return this._fieldClass(this.modelError); }
  _fieldClass(hasError) {
    return hasError
      ? 'slds-form-element slds-has-error'
      : 'slds-form-element';
  }

  handleInput(event) {
    const field = event.target.dataset.field;
    if (field) this[field] = event.target.value;
  }
  handlePicklist(event) {
    const field = event.currentTarget.dataset.field;
    if (field) this[field] = event.detail.value;
  }

  // ── Lookup: view-model ────────────────────────────────────────
  get showLookup() {
    return !this._seed && (this.availableVehicles || []).length > 0;
  }
  get hasLookupSelection() {
    return !!this._lookupSelectedId;
  }
  get lookupTriggerLabel() {
    if (!this._lookupSelectedId) return 'Search existing vehicles...';
    const picked = (this.availableVehicles || []).find(
      (v) => v.id === this._lookupSelectedId
    );
    return picked ? picked.name : 'Search existing vehicles...';
  }
  get selectedVehicleName() {
    if (!this._lookupSelectedId) return '';
    const picked = (this.availableVehicles || []).find(
      (v) => v.id === this._lookupSelectedId
    );
    return picked ? picked.name : '';
  }
  get lookupTriggerClass() {
    return this.hasLookupSelection
      ? 'pvm-lookup__trigger is-selected'
      : 'pvm-lookup__trigger';
  }
  get lookupResults() {
    const q = (this.searchQuery || '').trim().toLowerCase();
    const records = this.availableVehicles || [];
    const filtered = q
      ? records.filter((v) => {
          const a = v.attributes || {};
          const hay = [v.name, a.year, a.make, a.model, a.vin, a.use]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return hay.includes(q);
        })
      : records;
    return filtered
      .slice()
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .map((v, i) => {
        const isActive = i === this._activeIndex;
        const isSelected = v.id === this._lookupSelectedId;
        const a = v.attributes || {};
        let cls = 'pvm-lookup__result';
        if (isActive) cls += ' is-active';
        if (isSelected) cls += ' is-selected';
        return {
          id: v.id,
          displayName: v.name || '',
          vinLabel: a.vin || 'Pending VIN',
          useLabel: a.use || 'Use TBD',
          ariaSelected: isSelected ? 'true' : 'false',
          isSelected,
          cls
        };
      });
  }
  get hasLookupResults() {
    return this.lookupResults.length > 0;
  }
  get lookupEmptyCopy() {
    if (!this.searchQuery) {
      return 'No additional vehicles on file for this account.';
    }
    return `No matches for "${this.searchQuery}".`;
  }

  // ── Lookup: handlers ──────────────────────────────────────────
  handleSearchToggle() {
    this.searchOpen = !this.searchOpen;
    if (this.searchOpen) {
      Promise.resolve().then(() => {
        const el = this.template.querySelector('.pvm-lookup__input');
        if (el) el.focus();
      });
    } else {
      this._activeIndex = -1;
    }
  }
  handleSearchScrim() {
    this.searchOpen = false;
    this._activeIndex = -1;
  }
  handleSearchInput(event) {
    this.searchQuery = event.target.value || '';
    this._activeIndex = -1;
  }
  handleSearchKey(event) {
    const key = event.key;
    if (key === 'Escape') {
      event.preventDefault();
      this.handleSearchScrim();
      return;
    }
    const results = this.lookupResults;
    if (!results.length) return;
    if (key === 'ArrowDown') {
      event.preventDefault();
      this._activeIndex = (this._activeIndex + 1) % results.length;
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      this._activeIndex =
        this._activeIndex <= 0 ? results.length - 1 : this._activeIndex - 1;
    } else if (key === 'Enter') {
      const i = this._activeIndex >= 0 ? this._activeIndex : 0;
      event.preventDefault();
      this._selectLookupById(results[i].id);
    }
  }
  handleLookupSelection(event) {
    const id = event.currentTarget.dataset.id;
    if (id) this._selectLookupById(id);
  }
  handleClearLookup(event) {
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    this._lookupSelectedId = null;
    this.searchQuery = '';
    this.searchOpen = false;
    this._activeIndex = -1;
    this.year = '';
    this.make = '';
    this.model = '';
    this.vin = '';
    this.use = 'Commute';
    this.mileage = '';
    this.bodyClass = 'Sedan';
    this.garagingZip = '';
    this.showErrors = false;
  }
  _selectLookupById(id) {
    const picked = (this.availableVehicles || []).find((v) => v.id === id);
    if (!picked) return;
    const a = picked.attributes || {};
    this.year = a.year != null ? String(a.year) : '';
    this.make = a.make || '';
    this.model = a.model || '';
    this.vin = a.vin && a.vin !== 'Pending' ? a.vin : '';
    this.use = a.use || 'Commute';
    this.mileage = a.annualMileage != null ? String(a.annualMileage) : '';
    this.bodyClass = a.class || 'Sedan';
    const zipMatch = (a.garaging || '').match(/(\d{5})(?!.*\d{5})/);
    this.garagingZip = zipMatch ? zipMatch[1] : '';
    this._lookupSelectedId = id;
    this.showErrors = false;
    this.searchOpen = false;
    this._activeIndex = -1;
  }
}
