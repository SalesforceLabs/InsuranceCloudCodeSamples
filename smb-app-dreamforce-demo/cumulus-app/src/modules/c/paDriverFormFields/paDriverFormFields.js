import { LightningElement, api, track } from 'lwc';

/**
 * c-pa-driver-form-fields - bare driver form (lookup + fields).
 *
 * Presentational fieldset extracted from c-pa-driver-modal so the same
 * form can be hosted in either:
 *   - c-pa-driver-modal          (standalone chrome for the per-vehicle
 *                                  Create-Driver flow)
 *   - c-add-asset-modal          (two-step picker + form chrome)
 *
 * Parents own the modal chrome + Save/Cancel + open/close state; this
 * component just owns the field state and validation. Parents call
 * @api submit() to try to save; on success it returns the normalized
 * driver record. Validation errors surface inline and null is
 * returned.
 */

export default class PaDriverFormFields extends LightningElement {
  // Drivers surfaced in the top-of-form lookup section. Parent computes
  // this as roster-minus-rows-by-id-or-DL so duplicates are excluded.
  // Empty array hides the lookup entirely.
  @api availableDrivers = [];

  @track firstName = '';
  @track lastName = '';
  @track licenseState = '';
  @track licenseNumber = '';
  @track dob = '';
  @track showErrors = false;

  // ── Lookup state ────────────────────────────────────────────────
  @track searchOpen = false;
  @track searchQuery = '';
  @track _lookupSelectedId = null;
  @track _activeIndex = -1;

  // ── Public API for the parent modal ─────────────────────────────
  @api
  submit() {
    if (!this.firstName.trim() || !this.lastName.trim()) {
      this.showErrors = true;
      return null;
    }
    const state = this.licenseState.trim().toUpperCase();
    const num = this.licenseNumber.trim();
    const dl = state || num ? `${state}-${num}`.replace(/^-|-$/g, '') : 'Pending';
    return {
      name: `${this.firstName.trim()} ${this.lastName.trim()}`,
      dl,
      dob: this.dob || ''
    };
  }

  @api
  reset() {
    this.firstName = '';
    this.lastName = '';
    this.licenseState = '';
    this.licenseNumber = '';
    this.dob = '';
    this.showErrors = false;
    this.searchOpen = false;
    this.searchQuery = '';
    this._lookupSelectedId = null;
    this._activeIndex = -1;
  }

  // ── Field view-model ────────────────────────────────────────────
  get firstNameError() { return this.showErrors && !this.firstName.trim(); }
  get lastNameError() { return this.showErrors && !this.lastName.trim(); }
  get firstNameClass() {
    return this.firstNameError
      ? 'slds-form-element slds-has-error'
      : 'slds-form-element';
  }
  get lastNameClass() {
    return this.lastNameError
      ? 'slds-form-element slds-has-error'
      : 'slds-form-element';
  }

  handleInput(event) {
    const field =
      event.currentTarget.dataset.field || event.target.dataset.field;
    if (!field) return;
    const value =
      event.detail && 'value' in event.detail
        ? event.detail.value
        : event.target.value;
    this[field] = value;
  }
  handlePicklist(event) {
    const field = event.currentTarget.dataset.field;
    if (field) this[field] = event.detail.value;
  }

  // ── Lookup: view-model ────────────────────────────────────────
  get showLookup() {
    return (this.availableDrivers || []).length > 0;
  }
  get hasLookupSelection() {
    return !!this._lookupSelectedId;
  }
  get lookupTriggerLabel() {
    if (!this._lookupSelectedId) {
      return 'Search existing household drivers...';
    }
    const picked = (this.availableDrivers || []).find(
      (d) => d.id === this._lookupSelectedId
    );
    return picked ? picked.name : 'Search existing household drivers...';
  }
  get lookupTriggerClass() {
    return this.hasLookupSelection
      ? 'pdm-lookup__trigger is-selected'
      : 'pdm-lookup__trigger';
  }
  get lookupResults() {
    const q = (this.searchQuery || '').trim().toLowerCase();
    const records = this.availableDrivers || [];
    const filtered = q
      ? records.filter((d) => {
          const hay = [d.name, d.dl, d.licenseState]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return hay.includes(q);
        })
      : records;
    return filtered
      .slice()
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .map((d, i) => {
        const isActive = i === this._activeIndex;
        const isSelected = d.id === this._lookupSelectedId;
        const parts = [];
        if (d.dl) parts.push(`DL ${d.dl}`);
        if (d.licenseState) parts.push(d.licenseState);
        let cls = 'pdm-lookup__result';
        if (isActive) cls += ' is-active';
        if (isSelected) cls += ' is-selected';
        return {
          id: d.id,
          displayName: d.name || '',
          subline: parts.join(' \u00b7 '),
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
      return 'No additional household drivers on file.';
    }
    return `No matches for "${this.searchQuery}".`;
  }

  // ── Lookup: handlers ──────────────────────────────────────────
  handleSearchToggle() {
    this.searchOpen = !this.searchOpen;
    if (this.searchOpen) {
      Promise.resolve().then(() => {
        const el = this.template.querySelector('.pdm-lookup__input');
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
    this.firstName = '';
    this.lastName = '';
    this.licenseState = '';
    this.licenseNumber = '';
    this.dob = '';
    this.showErrors = false;
  }
  _selectLookupById(id) {
    const picked = (this.availableDrivers || []).find((d) => d.id === id);
    if (!picked) return;
    const [first, ...rest] = (picked.name || '').trim().split(/\s+/);
    this.firstName = first || '';
    this.lastName = rest.join(' ') || '';
    this.licenseState = (picked.licenseState || '').toUpperCase();
    this.licenseNumber = picked.dl || '';
    this.dob = picked.dob || '';
    this._lookupSelectedId = id;
    this.showErrors = false;
    this.searchOpen = false;
    this._activeIndex = -1;
  }
}
