import { LightningElement, api, track } from 'lwc';

// c-hom-scheduled-item-modal - SLDS Add / Edit Scheduled Personal
// Property dialog. Self-contained (chrome + form + lookup).
//
// Scheduled items (jewelry, fine art, collectibles, cameras, firearms)
// carry a category + description + appraised value with the appraisal
// metadata attached. Every item lands under a dwelling (parentId is
// forwarded through the workspace's `pendingScheduledDwellingId`).

const CATEGORY_OPTIONS = [
  'Jewelry',
  'Fine Art',
  'Collectibles',
  'Watches',
  'Cameras',
  'Firearms',
  'Silverware',
  'Musical Instruments',
  'Other'
];

function toOptions(values, current) {
  return values.map((v) => ({ value: v, label: v, selected: v === current }));
}

export default class HomScheduledItemModal extends LightningElement {
  @api open = false;
  @api dwellingName = '';

  _item = null;
  @api
  get item() {
    return this._item;
  }
  set item(value) {
    this._item = value;
    if (value) {
      this._hydrateFromSeed(value);
    } else {
      this._resetFields(false);
    }
  }

  @api availableItems = [];

  @track name = '';
  @track category = 'Jewelry';
  @track description = '';
  @track appraisedValue = '';
  @track appraisalDate = '';
  @track appraisedBy = '';
  @track showErrors = false;

  @track searchOpen = false;
  @track searchQuery = '';
  @track _lookupSelectedId = null;
  @track _activeIndex = -1;

  get isEdit() {
    return !!(this._item && this._item.id);
  }
  get hasDwelling() {
    return !!this.dwellingName;
  }
  get modalTitle() {
    return this.isEdit ? 'Edit Scheduled Item' : 'Add Scheduled Item';
  }
  get saveLabel() {
    return this.isEdit ? 'Update Item' : 'Save Item';
  }

  handleCancel() {
    this._resetFields();
    this.dispatchEvent(new CustomEvent('cancel'));
  }

  handleBackdrop() {
    this.handleCancel();
  }

  stopPropagation(event) {
    event.stopPropagation();
  }

  handleSave() {
    const item = this._buildItem();
    if (!item) return;
    this.dispatchEvent(new CustomEvent('save', { detail: { item } }));
    this._resetFields();
  }

  _buildItem() {
    if (!this.name.trim() || !this.appraisedValue) {
      this.showErrors = true;
      return null;
    }
    const value = Number(
      String(this.appraisedValue).replace(/[^0-9.]/g, '')
    );
    return {
      id: this._lookupSelectedId || null,
      name: this.name.trim(),
      category: this.category,
      description: this.description.trim(),
      appraisedValue: Number.isFinite(value) && value > 0 ? value : 0,
      appraisalDate: this.appraisalDate,
      appraisedBy: this.appraisedBy.trim()
    };
  }

  _resetFields(resetSeed = true) {
    this.name = '';
    this.category = 'Jewelry';
    this.description = '';
    this.appraisedValue = '';
    this.appraisalDate = '';
    this.appraisedBy = '';
    this.showErrors = false;
    this.searchOpen = false;
    this.searchQuery = '';
    this._lookupSelectedId = null;
    this._activeIndex = -1;
    if (resetSeed) this._item = null;
  }

  _hydrateFromSeed(v) {
    const a = v.attributes || v;
    this.name = v.name || '';
    this.category = a.category || 'Jewelry';
    this.description = a.description || '';
    const val = a.appraisedValue || v.insuredValue || '';
    this.appraisedValue = val ? String(val) : '';
    this.appraisalDate = a.appraisalDate || '';
    this.appraisedBy = a.appraisedBy || '';
    this.showErrors = false;
  }

  get categoryOptions() {
    return toOptions(CATEGORY_OPTIONS, this.category);
  }
  get nameError() {
    return this.showErrors && !this.name.trim();
  }
  get valueError() {
    return this.showErrors && !this.appraisedValue;
  }
  get nameClass() {
    return this._fieldClass(this.nameError);
  }
  get valueClass() {
    return this._fieldClass(this.valueError);
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
    return !this.isEdit && (this.availableItems || []).length > 0;
  }
  get hasLookupSelection() {
    return !!this._lookupSelectedId;
  }
  get lookupTriggerLabel() {
    if (!this._lookupSelectedId) return 'Search existing items...';
    const picked = (this.availableItems || []).find(
      (d) => d.id === this._lookupSelectedId
    );
    return picked ? picked.name : 'Search existing items...';
  }
  get lookupTriggerClass() {
    return this.hasLookupSelection
      ? 'hom-lookup__trigger is-selected'
      : 'hom-lookup__trigger';
  }
  get selectedItemName() {
    if (!this._lookupSelectedId) return '';
    const picked = (this.availableItems || []).find(
      (d) => d.id === this._lookupSelectedId
    );
    return picked ? picked.name : '';
  }
  get lookupResults() {
    const q = (this.searchQuery || '').trim().toLowerCase();
    const records = this.availableItems || [];
    const filtered = q
      ? records.filter((v) => {
          const a = v.attributes || {};
          const hay = [v.name, a.category, a.description, a.appraisedBy]
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
          metaLabel: [
            a.category,
            a.appraisedValue
              ? Number(a.appraisedValue).toLocaleString('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 0
                })
              : null
          ]
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
      return 'No additional scheduled items on file for this account.';
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
    this._resetFields();
  }
  _selectLookupById(id) {
    const picked = (this.availableItems || []).find((d) => d.id === id);
    if (!picked) return;
    this._hydrateFromSeed(picked);
    this._lookupSelectedId = id;
    this.searchOpen = false;
    this._activeIndex = -1;
  }
}
