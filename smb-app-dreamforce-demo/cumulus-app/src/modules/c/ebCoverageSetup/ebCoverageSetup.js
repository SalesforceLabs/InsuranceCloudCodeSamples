import { LightningElement, api, track } from 'lwc';
import {
  getCoverages,
  getRootProduct,
  setIncluded,
  setDataType,
  SETTABLE_DATA_TYPES
} from 'data/ebCatalog';

/**
 * c-eb-coverage-setup - design-time widget for EB Plan Coverages.
 *
 * Mounted inside c-rfq-playbook-setup when the GROUP_BENEFITS::HEALTH
 * blueprint is loaded and the admin is on the Plan Coverages stage.
 * Renders a native tabset (one tab per selected Root Product) and, for
 * each root, a grid row per coverage attribute: name + data-type chip
 * + "Include in RFQ" checkbox. Toggles mutate the shared ebCatalog
 * `includedInRfq` flag so the runtime wizard renders only attributes
 * the admin scoped in.
 *
 * @api selectedRootIds - string[] of root product ids in scope
 *                        (e.g. ['medical', 'dental']).
 */
export default class EbCoverageSetup extends LightningElement {
  _selectedRootIds = ['medical'];
  @track _activeRootId = 'medical';
  // Bump to force re-render of the rows after a checkbox toggle.
  @track _tick = 0;

  @api
  get selectedRootIds() {
    return this._selectedRootIds;
  }
  set selectedRootIds(v) {
    const next = Array.isArray(v) && v.length ? v.slice() : ['medical'];
    this._selectedRootIds = next;
    // If the previously-active root just got deselected, fall back to
    // the first still-in-scope root.
    if (!next.includes(this._activeRootId)) {
      this._activeRootId = next[0];
    }
  }

  // ── View-model ──────────────────────────────────────────────
  get rootTabs() {
    return this._selectedRootIds.map((id) => {
      const r = getRootProduct(id);
      const label = r ? r.label : id;
      const isActive = id === this._activeRootId;
      return {
        id,
        label,
        cls: isActive ? 'eb-cs__tab eb-cs__tab_active' : 'eb-cs__tab',
        ariaSelected: isActive ? 'true' : 'false',
        tabIndex: isActive ? '0' : '-1'
      };
    });
  }

  get activeRootRows() {
    // Reading `_tick` keeps this getter reactive to setIncluded mutations
    // (the catalog itself is not @track-able from this component).
    this._tick;
    const list = getCoverages(this._activeRootId);
    return list.map((a) => ({
      id: a.id,
      label: a.label,
      dataType: a.dataType,
      includedInRfq: a.includedInRfq,
      // Pre-computed UI hint shown under the picker. Helps the admin
      // understand what control the runtime will render.
      hint: hintForDataType(a.dataType)
    }));
  }

  // Static option list for the Data Type c-picklist. Same shape for
  // every row, so the menu opens with native SLDS 2 chrome instead of
  // the OS-native (Apple/Windows) dark dropdown a native <select>
  // falls back to. `value={a.dataType}` on the picklist drives the
  // selected state per-row.
  get dataTypeOptions() {
    return SETTABLE_DATA_TYPES.slice();
  }

  get activeRootIsEmpty() {
    return this.activeRootRows.length === 0;
  }

  // ── Handlers ────────────────────────────────────────────────
  handleTabClick(event) {
    const id = event.currentTarget.dataset.id;
    if (id && this._selectedRootIds.includes(id)) {
      this._activeRootId = id;
    }
  }

  handleIncludeToggle(event) {
    const attrId = event.currentTarget.dataset.attr;
    const flag = !!event.currentTarget.checked;
    if (!attrId) return;
    setIncluded('coverage', attrId, flag);
    // Force the rows getter to re-evaluate.
    this._tick = this._tick + 1;
  }

  // Design-time data-type picker - flips the coverage attribute's
  // `dataType` in the shared catalog so both Setup and Runtime
  // re-render with the new control (Text / Currency / CurrencyRange
  // / Percentage / Picklist). c-picklist forwards the new value in
  // event.detail.value; data-attr lives on the host element.
  handleDataTypeChange(event) {
    const attrId = event.currentTarget.dataset.attr;
    const value = event.detail && event.detail.value;
    if (!attrId || !value) return;
    setDataType('coverage', attrId, value);
    this._tick = this._tick + 1;
  }
}

function hintForDataType(dt) {
  switch (dt) {
    case 'CurrencyRange':
      return 'Min/Max $ pair';
    case 'Currency':
      // "Single $ amount" hint removed per spec - the Currency data
      // type stands on its own without an explanatory hint.
      return '';
    case 'Percentage':
      return 'Percentage (0–100%)';
    case 'Picklist':
      return 'Pick from list';
    default:
      return dt;
  }
}
