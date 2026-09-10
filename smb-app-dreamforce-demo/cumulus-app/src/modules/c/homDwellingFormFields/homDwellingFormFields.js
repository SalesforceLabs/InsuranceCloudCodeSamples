import { LightningElement, api, track } from 'lwc';

/**
 * c-hom-dwelling-form-fields - bare dwelling form (lookup + fields).
 *
 * Presentational fieldset extracted from c-hom-dwelling-modal so the
 * same form can be hosted in either:
 *   - c-hom-dwelling-modal   (standalone chrome for Edit)
 *   - c-hom-add-asset-modal  (two-step picker: Property vs Homeowner)
 *
 * Parents own the modal chrome + Save/Cancel + open/close state; this
 * component just owns the field state and validation. Parents call
 * @api submit() to try to save; on success it returns the normalized
 * dwelling record. Validation errors surface inline and null is returned.
 *
 * Mirrors the c-pa-vehicle-form-fields contract exactly so the two
 * flows feel identical to their host modals.
 */

const CONSTRUCTION_OPTIONS = [
  'Masonry',
  'Frame',
  'Superior Construction',
  'Mixed / Other'
];
const ROOF_OPTIONS = [
  'Asphalt Shingle',
  'Tile',
  'Metal',
  'Slate',
  'Flat / Membrane',
  'Wood Shake'
];
const OCCUPANCY_OPTIONS = [
  'Primary Residence',
  'Secondary / Seasonal',
  'Rental (Long-Term)',
  'Rental (Short-Term)',
  'Vacant'
];
const PROTECTION_CLASS_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

function toOptions(values, current) {
  return values.map((v) => ({ value: v, label: v, selected: v === current }));
}

export default class HomDwellingFormFields extends LightningElement {
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

  // Dwellings surfaced in the top-of-form lookup. Parent computes this
  // as catalog-minus-rows so duplicates are excluded. Empty array hides
  // the lookup entirely.
  @api availableDwellings = [];

  // ── Field state ─────────────────────────────────────────────────
  @track addressLine = '';
  @track city = '';
  @track state = 'FL';
  @track zip = '';
  @track yearBuilt = '';
  @track sqFt = '';
  @track construction = 'Masonry';
  @track roofType = 'Asphalt Shingle';
  @track roofYear = '';
  @track occupancy = 'Primary Residence';
  @track replacementCost = '';
  @track protectionClass = '3';
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
  // Called by the parent's Save button. Validates + returns the
  // normalized dwelling record, or null when validation fails.
  @api
  submit() {
    if (
      !this.addressLine.trim() ||
      !this.city.trim() ||
      !this.zip.trim() ||
      !this.yearBuilt
    ) {
      this.showErrors = true;
      return null;
    }
    const addressLine = this.addressLine.trim();
    const city = this.city.trim();
    const state = this.state.trim();
    const zip = this.zip.trim();
    const address = `${addressLine}, ${city}, ${state} ${zip}`;
    const rc = Number(String(this.replacementCost).replace(/[^0-9.]/g, ''));
    const sqFt = Number(String(this.sqFt).replace(/[^0-9.]/g, ''));
    return {
      // Preserve catalog id when the broker picked an existing dwelling
      // so the workspace can keep the lookup exclusion accurate.
      id: this._lookupSelectedId || null,
      name: address,
      address,
      addressLine,
      city,
      state,
      zip,
      yearBuilt: Number(this.yearBuilt) || this.yearBuilt,
      construction: this.construction,
      roofType: this.roofType,
      roofYear: Number(this.roofYear) || '',
      sqFt: Number.isFinite(sqFt) && sqFt > 0 ? sqFt : this.sqFt,
      occupancy: this.occupancy,
      replacementCost: Number.isFinite(rc) && rc > 0 ? rc : 0,
      protectionClass: this.protectionClass
    };
  }

  // Called by the parent's Cancel / X / backdrop handlers to blow
  // away every field back to defaults.
  @api
  reset() {
    this.addressLine = '';
    this.city = '';
    this.state = 'FL';
    this.zip = '';
    this.yearBuilt = '';
    this.sqFt = '';
    this.construction = 'Masonry';
    this.roofType = 'Asphalt Shingle';
    this.roofYear = '';
    this.occupancy = 'Primary Residence';
    this.replacementCost = '';
    this.protectionClass = '3';
    this.showErrors = false;
    this.searchOpen = false;
    this.searchQuery = '';
    this._lookupSelectedId = null;
    this._activeIndex = -1;
  }

  _hydrateFromSeed(v) {
    // The workspace row shape carries `address` as a full string; the
    // catalog shape carries a structured `attributes` block. Detect
    // whichever is present.
    const a = v.attributes || v;
    this.addressLine = a.addressLine || '';
    this.city = a.city || '';
    this.state = a.state || 'FL';
    this.zip = a.zip || '';
    this.yearBuilt = a.yearBuilt != null ? String(a.yearBuilt) : '';
    this.sqFt = a.sqFt != null ? String(a.sqFt) : '';
    this.construction = a.construction || 'Masonry';
    this.roofType = a.roofType || 'Asphalt Shingle';
    this.roofYear = a.roofYear != null ? String(a.roofYear) : '';
    this.occupancy = a.occupancy || 'Primary Residence';
    const rc = a.replacementCost || v.insuredValue || '';
    this.replacementCost = rc ? String(rc) : '';
    this.protectionClass = a.protectionClass || '3';
    this.showErrors = false;

    if (!this.addressLine && v.address) {
      const parts = String(v.address).split(',').map((s) => s.trim());
      if (parts.length >= 3) {
        this.addressLine = parts[0];
        this.city = parts[1];
        const [state, zip] = parts[2].split(/\s+/);
        this.state = state || this.state;
        this.zip = zip || this.zip;
      }
    }
  }

  // ── Field view-model ────────────────────────────────────────────
  get constructionOptions() {
    return toOptions(CONSTRUCTION_OPTIONS, this.construction);
  }
  get roofOptions() {
    return toOptions(ROOF_OPTIONS, this.roofType);
  }
  get occupancyOptions() {
    return toOptions(OCCUPANCY_OPTIONS, this.occupancy);
  }
  get protectionClassOptions() {
    return toOptions(PROTECTION_CLASS_OPTIONS, this.protectionClass);
  }
  get addressError() {
    return this.showErrors && !this.addressLine.trim();
  }
  get cityError() {
    return this.showErrors && !this.city.trim();
  }
  get zipError() {
    return this.showErrors && !this.zip.trim();
  }
  get yearBuiltError() {
    return this.showErrors && !this.yearBuilt;
  }
  get addressClass() {
    return this._fieldClass(this.addressError);
  }
  get cityClass() {
    return this._fieldClass(this.cityError);
  }
  get zipClass() {
    return this._fieldClass(this.zipError);
  }
  get yearBuiltClass() {
    return this._fieldClass(this.yearBuiltError);
  }
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

  // ── Lookup ──────────────────────────────────────────────────────
  get showLookup() {
    return !this._seed && (this.availableDwellings || []).length > 0;
  }
  get hasLookupSelection() {
    return !!this._lookupSelectedId;
  }
  get lookupTriggerLabel() {
    if (!this._lookupSelectedId) return 'Search existing dwellings...';
    const picked = (this.availableDwellings || []).find(
      (d) => d.id === this._lookupSelectedId
    );
    return picked ? picked.name : 'Search existing dwellings...';
  }
  get lookupTriggerClass() {
    return this.hasLookupSelection
      ? 'hom-lookup__trigger is-selected'
      : 'hom-lookup__trigger';
  }
  get selectedDwellingName() {
    if (!this._lookupSelectedId) return '';
    const picked = (this.availableDwellings || []).find(
      (d) => d.id === this._lookupSelectedId
    );
    return picked ? picked.name : '';
  }
  get lookupResults() {
    const q = (this.searchQuery || '').trim().toLowerCase();
    const records = this.availableDwellings || [];
    const filtered = q
      ? records.filter((v) => {
          const a = v.attributes || {};
          const hay = [
            v.name,
            a.addressLine,
            a.city,
            a.state,
            a.zip,
            a.occupancy
          ]
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
        let cls = 'hom-lookup__result';
        if (isActive) cls += ' is-active';
        if (isSelected) cls += ' is-selected';
        return {
          id: v.id,
          displayName: v.name || '',
          metaLabel: [a.yearBuilt ? `Built ${a.yearBuilt}` : null, a.occupancy]
            .filter(Boolean)
            .join(' · '),
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
      return 'No additional dwellings on file for this account.';
    }
    return `No matches for "${this.searchQuery}".`;
  }

  handleSearchToggle() {
    this.searchOpen = !this.searchOpen;
    if (this.searchOpen) {
      Promise.resolve().then(() => {
        const el = this.template.querySelector('.hom-lookup__input');
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
    this.addressLine = '';
    this.city = '';
    this.state = 'FL';
    this.zip = '';
    this.yearBuilt = '';
    this.sqFt = '';
    this.construction = 'Masonry';
    this.roofType = 'Asphalt Shingle';
    this.roofYear = '';
    this.occupancy = 'Primary Residence';
    this.replacementCost = '';
    this.protectionClass = '3';
    this.showErrors = false;
  }
  _selectLookupById(id) {
    const picked = (this.availableDwellings || []).find((d) => d.id === id);
    if (!picked) return;
    this._hydrateFromSeed(picked);
    this._lookupSelectedId = id;
    this.searchOpen = false;
    this._activeIndex = -1;
  }
}
