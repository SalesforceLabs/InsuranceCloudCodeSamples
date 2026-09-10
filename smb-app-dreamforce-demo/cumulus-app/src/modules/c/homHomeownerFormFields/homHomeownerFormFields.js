import { LightningElement, api, track } from 'lwc';

/**
 * c-hom-homeowner-form-fields - bare Named Insured form (lookup + fields).
 *
 * Presentational fieldset for the Named Insured (IPP) subject in the
 * HO-3 PCM. Hosted by:
 *   - c-hom-homeowner-modal   (standalone chrome for Edit)
 *   - c-hom-add-asset-modal   (two-step picker: Property vs Homeowner)
 *
 * Same @api contract as c-hom-dwelling-form-fields:
 *   @api seed              - optional record to prefill on Edit
 *   @api availableHomeowners - catalog surfaced in the top-of-form lookup
 *   @api submit()          - validate + return { record } or null
 *   @api reset()           - clear every field back to defaults
 *
 * Fields track the HO-3 PCM Named Insured attribute list plus a Role
 * picklist (Named Insured / Co-Insured) so a household can carry more
 * than one insured party.
 */

const ROLE_OPTIONS = ['Named Insured', 'Co-Insured'];
const MARITAL_OPTIONS = [
  'Single',
  'Married',
  'Domestic Partnership',
  'Widowed',
  'Divorced',
  'Separated'
];
const CARRIER_OPTIONS = [
  'Chubb',
  'Nationwide',
  'Travelers',
  'Allstate',
  'State Farm',
  'Liberty Mutual',
  'USAA',
  'Progressive',
  'None (First-Time Buyer)'
];

function toOptions(values, current) {
  return values.map((v) => ({ value: v, label: v, selected: v === current }));
}

export default class HomHomeownerFormFields extends LightningElement {
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

  @api availableHomeowners = [];

  // ── Field state ─────────────────────────────────────────────────
  @track firstName = '';
  @track lastName = '';
  @track dob = '';
  @track maritalStatus = 'Married';
  @track priorCarrier = '';
  @track role = 'Named Insured';
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
  @api
  submit() {
    if (!this.firstName.trim() || !this.lastName.trim() || !this.dob) {
      this.showErrors = true;
      return null;
    }
    const firstName = this.firstName.trim();
    const lastName = this.lastName.trim();
    return {
      id: this._lookupSelectedId || null,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      dob: this.dob,
      maritalStatus: this.maritalStatus,
      priorCarrier: this.priorCarrier,
      role: this.role
    };
  }

  @api
  reset() {
    this.firstName = '';
    this.lastName = '';
    this.dob = '';
    this.maritalStatus = 'Married';
    this.priorCarrier = '';
    this.role = 'Named Insured';
    this.showErrors = false;
    this.searchOpen = false;
    this.searchQuery = '';
    this._lookupSelectedId = null;
    this._activeIndex = -1;
  }

  _hydrateFromSeed(v) {
    // Accept either a raw participant row (workspace shape) or a
    // catalog record (`attributes` block).
    const a = v.attributes || v;

    // Prefer explicit firstName / lastName, fall back to splitting a
    // combined `name` string on the first whitespace.
    if (a.firstName || a.lastName) {
      this.firstName = a.firstName || '';
      this.lastName = a.lastName || '';
    } else if (v.name) {
      const full = String(v.name).trim();
      const idx = full.indexOf(' ');
      this.firstName = idx === -1 ? full : full.slice(0, idx);
      this.lastName = idx === -1 ? '' : full.slice(idx + 1).trim();
    } else {
      this.firstName = '';
      this.lastName = '';
    }
    this.dob = a.dob || '';
    this.maritalStatus = a.maritalStatus || 'Married';
    this.priorCarrier = a.priorCarrier || '';
    this.role = a.role === 'Co-Insured' ? 'Co-Insured' : 'Named Insured';
    this.showErrors = false;
  }

  // ── Field view-model ────────────────────────────────────────────
  get roleOptions() {
    return toOptions(ROLE_OPTIONS, this.role);
  }
  get maritalOptions() {
    return toOptions(MARITAL_OPTIONS, this.maritalStatus);
  }
  get carrierOptions() {
    return toOptions(CARRIER_OPTIONS, this.priorCarrier);
  }
  get firstNameError() {
    return this.showErrors && !this.firstName.trim();
  }
  get lastNameError() {
    return this.showErrors && !this.lastName.trim();
  }
  get dobError() {
    return this.showErrors && !this.dob;
  }
  get firstNameClass() {
    return this._fieldClass(this.firstNameError);
  }
  get lastNameClass() {
    return this._fieldClass(this.lastNameError);
  }
  get dobClass() {
    return this._fieldClass(this.dobError);
  }
  _fieldClass(hasError) {
    return hasError
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

  // ── Lookup ──────────────────────────────────────────────────────
  get showLookup() {
    return !this._seed && (this.availableHomeowners || []).length > 0;
  }
  get hasLookupSelection() {
    return !!this._lookupSelectedId;
  }
  get lookupTriggerLabel() {
    if (!this._lookupSelectedId) return 'Search existing homeowners...';
    const picked = (this.availableHomeowners || []).find(
      (d) => d.id === this._lookupSelectedId
    );
    return picked ? picked.name : 'Search existing homeowners...';
  }
  get lookupTriggerClass() {
    return this.hasLookupSelection
      ? 'hom-lookup__trigger is-selected'
      : 'hom-lookup__trigger';
  }
  get selectedHomeownerName() {
    if (!this._lookupSelectedId) return '';
    const picked = (this.availableHomeowners || []).find(
      (d) => d.id === this._lookupSelectedId
    );
    return picked ? picked.name : '';
  }
  get lookupResults() {
    const q = (this.searchQuery || '').trim().toLowerCase();
    const records = this.availableHomeowners || [];
    const filtered = q
      ? records.filter((v) => {
          const a = v.attributes || {};
          const hay = [v.name, a.role, a.priorCarrier, a.maritalStatus]
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
          metaLabel: [a.role || 'Homeowner', a.priorCarrier]
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
      return 'No additional homeowners on file for this account.';
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
    this.firstName = '';
    this.lastName = '';
    this.dob = '';
    this.maritalStatus = 'Married';
    this.priorCarrier = '';
    this.role = 'Named Insured';
    this.showErrors = false;
  }
  _selectLookupById(id) {
    const picked = (this.availableHomeowners || []).find((d) => d.id === id);
    if (!picked) return;
    this._hydrateFromSeed(picked);
    this._lookupSelectedId = id;
    this.searchOpen = false;
    this._activeIndex = -1;
  }
}
