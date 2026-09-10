import { LightningElement, api, track } from 'lwc';
import { getCoverages, getRootProduct } from 'data/ebCatalog';

/**
 * c-eb-core-coverages - runtime Step 2 (Core Plan Coverages).
 *
 * Mounted inside c-rfq-workspace-eb when the wizard is on the
 * 'coverages' step. Driven by the shared ebCatalog: renders one
 * accordion segment per in-scope root product (medical/dental/vision
 * filtered by LOC), and inside each segment one input row per
 * coverage attribute the Setup canvas flagged as included in RFQ.
 *
 * The runtime no longer offers a per-row include toggle - that
 * decision lives upstream in c-eb-coverage-setup. Each row renders the
 * input control matching its `dataType`:
 *   - 'CurrencyRange' -> side-by-side Min/Max $ inputs
 *   - 'Currency'      -> single $ input
 *   - 'Percentage'    -> number input with % suffix
 *   - 'Picklist'      -> native <select>
 *
 * @api inScopeRootIds - string[] of root ids drawn from the wizard's
 *                       LOC scope (defaults to all three).
 * @api coverageState  - { [attrId]: { value, min, max } } slice of
 *                       the parent's policyConfiguration.
 *
 * Events:
 *   - configchange  detail { scope: 'coverage', attrId, field, value }
 */
export default class EbCoreCoverages extends LightningElement {
  _inScopeRootIds = ['medical'];
  _coverageState = {};
  @track _expandedRootId = 'medical';
  // Coverage-level include gate: `{ medical: true, dental: true, ... }`.
  // Auto-seeded to `true` for every id in `inScopeRootIds` when the
  // prop lands, so the broker arrives with the active LOC's coverages
  // already unlocked. Unchecking one disables every attribute input
  // under that segment without dropping the values the broker (or a
  // prior-policy clone) already entered.
  @track _rootIncluded = {};

  @api
  get inScopeRootIds() {
    return this._inScopeRootIds;
  }
  set inScopeRootIds(v) {
    const next = Array.isArray(v) && v.length ? v.slice() : ['medical'];
    this._inScopeRootIds = next;
    if (!next.includes(this._expandedRootId)) {
      this._expandedRootId = next[0];
    }
    // Reconcile the include map: keep prior on/off decisions for
    // still-in-scope roots, add newly-in-scope roots as `true`, drop
    // roots that fell out of scope.
    const nextIncluded = {};
    for (const id of next) {
      nextIncluded[id] = id in this._rootIncluded ? this._rootIncluded[id] : true;
    }
    this._rootIncluded = nextIncluded;
  }

  @api
  get coverageState() {
    return this._coverageState;
  }
  set coverageState(v) {
    this._coverageState = v && typeof v === 'object' ? v : {};
  }

  // ── View-model: one accordion segment per in-scope root. ────────
  // Each segment header carries its own include checkbox. Attribute
  // rows no longer carry a checkbox - their inputs are enabled iff
  // the parent coverage is checked.
  get segments() {
    return this._inScopeRootIds
      .map((id) => {
        const root = getRootProduct(id) || { id, label: id };
        const attrs = getCoverages(id);
        if (!attrs.length) return null;
        const expanded = id === this._expandedRootId;
        const included = !!this._rootIncluded[id];
        return {
          id: root.id,
          label: root.label,
          iconPath: root.iconPath,
          expanded,
          ariaExpanded: String(expanded),
          chevronCls: expanded ? 'ecv-seg__chev is-open' : 'ecv-seg__chev',
          included,
          ariaChecked: String(included),
          // Accessible name for the in-header include checkbox (no
          // visible text label - the visible cue is the segment
          // title next to it).
          includeLabel: `Include ${root.label} in RFQ`,
          rows: attrs.map((a) => this._decorateRow(a, id))
        };
      })
      .filter(Boolean);
  }

  get hasSegments() {
    return this.segments.length > 0;
  }

  // ── Handlers ────────────────────────────────────────────────
  handleSegmentToggle(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this._expandedRootId = this._expandedRootId === id ? '' : id;
  }
  handleSegmentKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.handleSegmentToggle(event);
  }

  handleRangeInput(event) {
    this._emit(
      event.currentTarget.dataset.attr,
      event.currentTarget.dataset.field, // 'min' | 'max'
      event.currentTarget.value
    );
  }
  handleSingleInput(event) {
    this._emit(
      event.currentTarget.dataset.attr,
      'value',
      event.currentTarget.value
    );
  }
  handleSelectChange(event) {
    this._emit(
      event.currentTarget.dataset.attr,
      'value',
      event.currentTarget.value
    );
  }

  // Coverage-level include: flip the gate for the whole segment.
  // Reassigns the map wholesale so LWC picks up the change (nested
  // mutations on a @track POJO don't always trigger re-render).
  handleRootIncludeToggle(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this._rootIncluded = {
      ...this._rootIncluded,
      [id]: !!event.currentTarget.checked
    };
  }
  // Absorb clicks on the header-checkbox label so ticking it doesn't
  // also collapse/expand the segment (the header itself is a button).
  stopPropagation(event) {
    event.stopPropagation();
  }

  // ── Internal ────────────────────────────────────────────────
  _emit(attrId, field, value) {
    if (!attrId) return;
    this.dispatchEvent(
      new CustomEvent('configchange', {
        detail: { scope: 'coverage', attrId, field, value },
        bubbles: true,
        composed: true
      })
    );
  }

  _decorateRow(a, rootId) {
    const s = this._coverageState[a.id] || {};
    const isRange = a.dataType === 'CurrencyRange';
    const isCurrency = a.dataType === 'Currency';
    const isPercent = a.dataType === 'Percentage';
    const isPicklist = a.dataType === 'Picklist';
    // Runtime input state is now driven purely by the parent
    // coverage's include gate. Mandatory attributes still surface
    // an asterisk on the label (via labelClass) so the broker knows
    // Setup marked them required for RFQ submission.
    const mandatory = !!a.mandatory;
    const rootIncluded = !!this._rootIncluded[rootId];
    const valueDisabled = !rootIncluded;
    // L4 Attribute + L5 Data Type disclosure. Rendered as a small
    // subtitle under the Benefit label so the broker sees which
    // Attribute Type each Benefit is capturing (e.g. Annual
    // Deductible: Individual -> Deductible / Currency Range).
    const attributeLabel = a.attributeLabel || a.label;
    const dataTypeLabel = _dataTypeLabel(a.dataType);
    const attrSubtitle = attributeLabel + ' \u00b7 ' + dataTypeLabel;
    return {
      id: a.id,
      label: a.label,
      attrSubtitle,
      dataType: a.dataType,
      mandatory,
      valueDisabled,
      rowClass: rootIncluded ? 'ecv-row' : 'ecv-row is-excluded',
      labelClass: mandatory ? 'ecv-row__label is-required' : 'ecv-row__label',
      isRange,
      isCurrency,
      isPercent,
      isPicklist,
      min: s.min != null ? String(s.min) : '',
      max: s.max != null ? String(s.max) : '',
      value: s.value != null ? String(s.value) : '',
      options: isPicklist
        ? (a.options || []).map((opt) => ({
            value: opt,
            label: opt,
            selected: opt === (s.value || '')
          }))
        : []
    };
  }
}

// Human label for the small "attribute type / data type" subtitle.
function _dataTypeLabel(dataType) {
  switch (dataType) {
    case 'Currency':      return 'Currency ($)';
    case 'CurrencyRange': return 'Currency Range ($)';
    case 'Percentage':    return 'Percentage (%)';
    case 'Picklist':      return 'Picklist';
    case 'Text':          return 'Text';
    default:              return dataType || '';
  }
}
