import { LightningElement, api, track } from 'lwc';

/**
 * c-step-edit-modal
 *
 * Edit modal for a single pipeline card in c-insurance-setup-workspace.
 * The host opens/closes via the `open` flag and hydrates the modal
 * with the current card's payload via `context`. The modal owns its
 * own draft state (so cancel-then-reopen doesn't leak edits) and
 * bubbles the saved payload back on `save`.
 *
 * Payload shape (in and out):
 *   {
 *     key,          // stable card identifier (sectionId::subStepId or sectionId)
 *     sectionId,
 *     subStepId,
 *     kind,         // 'init' | 'collection' | 'coverages'
 *                   // | 'quote_comparison' | 'review' | 'publish'
 *                   // | 'custom'
 *     title,        // editable
 *     description,  // editable
 *     componentName,// derived from the kind for built-ins;
 *                   // editable string for custom widgets
 *     stepType,     // 'lwc' | 'custom' - drives read-only vs editable
 *     origin,       // 'built-in' | 'custom' - drives copy in the
 *                   // Placement section
 *     required,     // editable boolean
 *     active,       // editable boolean
 *     index,        // 0-based position in the pipeline
 *     total,        // total number of cards in the pipeline
 *     displayFields // optional [{ id, label, api }] - only meaningful
 *                   // for kind === 'collection'
 *   }
 *
 * Events:
 *   save   → { key, title, description, componentName, required, active }
 *   cancel → ()
 */
export default class StepEditModal extends LightningElement {
  // Host owns the open flag; toggling it hydrates the draft.
  _open = false;
  _context = null;

  @api
  get open() { return this._open; }
  set open(v) {
    const next = !!v;
    if (this._open === next) return;
    this._open = next;
    if (next) this._hydrateDraft();
  }

  @api
  get context() { return this._context; }
  set context(v) {
    this._context = v || null;
    // Re-hydrate if the modal is already open and the host swaps to
    // a different card mid-flight.
    if (this._open) this._hydrateDraft();
  }

  // ── Draft state ──────────────────────────────────────────────
  @track title = '';
  @track description = '';
  @track componentName = '';
  @track required = false;
  @track active = true;
  // Display Fields add-row + selection draft. `entityValue` /
  // `fieldValue` / `labelValue` drive the bottom add-row; each
  // successful add appends to `selectionDraft`.
  @track entityValue = null;
  @track fieldValue = null;
  @track labelValue = '';
  @track selectionDraft = [];
  // Active tab in the body's tabbed layout: 'details' |
  // 'configuration'. The Details tab bundles Placement +
  // Identity + Behavior (all step-metadata + toggles), and
  // Configuration hosts the widget-type-specific config sub-
  // form. Every open of the modal resets to 'details' so re-
  // entries always start at the same anchor.
  @track activeTab = 'details';

  _hydrateDraft() {
    const c = this._context || {};
    this.title = c.title || '';
    this.description = c.description || '';
    this.componentName = c.componentName || '';
    this.required = !!c.required;
    this.active = c.active !== false; // default true when unset
    // Bookend steps (Initialize / Publish) are structurally
    // mandatory and always live in the pipeline - force both
    // toggles ON regardless of what the caller passed so the
    // modal never renders them checked-off.
    if (this.isBehaviorLocked) {
      this.required = true;
      this.active = true;
    }
    // Deep-copy the display-field selection so the modal's draft
    // can mutate freely; a cancel discards edits without touching
    // the caller's state.
    const df = c.displayFields || null;
    const seed = df && Array.isArray(df.selection) ? df.selection : [];
    this.selectionDraft = seed.map((s) => ({ ...s }));
    this.entityValue = null;
    this.fieldValue = null;
    this.labelValue = '';
    // Always land on Details first so re-opens are predictable.
    this.activeTab = 'details';
  }

  // ── View-model ───────────────────────────────────────────────
  get headSub() {
    const c = this._context || {};
    if (!c.title) return 'Adjust the step\u2019s label, wiring, and behavior.';
    return `Editing \u201C${c.title}\u201D.`;
  }
  get orderLabel() {
    const c = this._context || {};
    if (typeof c.index !== 'number' || typeof c.total !== 'number') return '\u2014';
    return `${c.index + 1} of ${c.total}`;
  }
  get stepTypeLabel() {
    const type = (this._context && this._context.stepType) || 'lwc';
    if (type === 'custom') return 'Custom Component';
    return 'LWC';
  }
  get originLabel() {
    const origin = (this._context && this._context.origin) || 'built-in';
    return origin === 'custom' ? 'User-added' : 'Built-in';
  }
  // Component Name is only editable for admin-injected custom
  // widgets - the built-in substeps map to fixed platform LWCs so
  // typing a new value here would be misleading.
  get componentNameReadonly() {
    const origin = (this._context && this._context.origin) || 'built-in';
    return origin !== 'custom';
  }
  get componentNameHint() {
    if (!this.componentNameReadonly) return '';
    return 'Auto-wired for built-in steps.';
  }
  get isSaveDisabled() {
    // Guard: a step must always have a non-empty title so the
    // pipeline card never renders blank after save.
    return !this.title || !this.title.trim();
  }

  // ── Widget-kind switches (drives the Configuration section) ──
  get _kind() {
    return (this._context && this._context.kind) || 'custom';
  }
  get isKindInit()            { return this._kind === 'init'; }
  get isKindCollection()      { return this._kind === 'collection'; }
  get isKindCoverages()       { return this._kind === 'coverages'; }
  get isKindQuoteComparison() { return this._kind === 'quote_comparison'; }
  get isKindReview()          { return this._kind === 'review'; }
  get isKindPublish()         { return this._kind === 'publish'; }
  get isKindCustom()          { return this._kind === 'custom'; }

  // ── Display Fields (Configuration section) view-model ────────
  // Context carries the whole payload; the modal exposes small
  // getters for the template's picklists and the existing-rows
  // list. All state (which fields are added, active entity in
  // the add-row) lives in draft state above.
  get _displayFieldsPayload() {
    return (this._context && this._context.displayFields) || null;
  }
  get hasDisplayFieldsCatalog() {
    return !!(this._displayFieldsPayload
      && Array.isArray(this._displayFieldsPayload.entities)
      && this._displayFieldsPayload.entities.length > 0);
  }
  // Set of `entityValue::fieldValue` keys already in the draft.
  // Used to (a) mark options in the Field picker as "already
  // added" via a leading check, and (b) block duplicate adds.
  get _selectedKeys() {
    const set = new Set();
    (this.selectionDraft || []).forEach((s) => {
      set.add(`${s.entityValue}::${s.fieldValue}`);
    });
    return set;
  }
  get entityOptions() {
    if (!this.hasDisplayFieldsCatalog) return [];
    return this._displayFieldsPayload.entities.map((e) => ({
      value: e.value,
      label: e.label
    }));
  }
  // Fields for the currently-picked entity, decorated with a
  // leading check when they're already in the selection draft
  // (that is how "the fields that are showing should be seen
  // selected" surfaces in a single-select `c-picklist` - the
  // check reads as "already in the display list").
  get fieldOptions() {
    if (!this.hasDisplayFieldsCatalog || !this.entityValue) return [];
    const map = this._displayFieldsPayload.fieldsByEntity || {};
    const list = map[this.entityValue] || [];
    const selected = this._selectedKeys;
    return list.map((f) => {
      const key = `${this.entityValue}::${f.value}`;
      const isAdded = selected.has(key);
      return {
        value: f.value,
        label: isAdded ? `\u2713 ${f.label}` : f.label
      };
    });
  }
  get fieldPickerDisabled() {
    return !this.entityValue;
  }
  get isAddDisplayFieldDisabled() {
    if (!this.entityValue || !this.fieldValue) return true;
    // Guard against duplicate adds - the option is still shown in
    // the picker (with the check prefix) so the admin can see the
    // field is already there, but the + button no-ops.
    return this._selectedKeys.has(`${this.entityValue}::${this.fieldValue}`);
  }
  get hasSelectionRows() {
    return (this.selectionDraft || []).length > 0;
  }
  // Decorate the draft rows with resolved entity + field labels
  // for rendering. Missing catalog entries fall back to the raw
  // value so a stale saved override still renders something.
  get selectionRows() {
    if (!this.hasDisplayFieldsCatalog) return [];
    const entities = this._displayFieldsPayload.entities;
    const map = this._displayFieldsPayload.fieldsByEntity || {};
    const entityLabelByValue = new Map(entities.map((e) => [e.value, e.label]));
    return (this.selectionDraft || []).map((s) => {
      const entityLabel = entityLabelByValue.get(s.entityValue) || s.entityValue;
      const fieldEntry = (map[s.entityValue] || []).find((f) => f.value === s.fieldValue);
      const fieldLabel = (fieldEntry && fieldEntry.label) || s.fieldValue;
      const api = s.api || (fieldEntry && fieldEntry.api) || '';
      return {
        key: `${s.entityValue}::${s.fieldValue}`,
        entityLabel,
        fieldLabel,
        api,
        label: s.label || '',
        removeAriaLabel: `Remove ${fieldLabel}`
      };
    });
  }

  // ── Behavior lock (bookend steps) ────────────────────────────
  // Initialize + Publish are the RFQ pipeline's mandatory
  // bookends. Both toggles below stay ON and read-only for those
  // cards so the admin can't accidentally break the flow's
  // preconditions or its terminal handoff.
  get isBehaviorLocked() {
    return this._kind === 'init' || this._kind === 'publish';
  }
  // Separate hooks per checkbox so we can peel them apart later
  // (e.g. if Publish becomes optional in a variant flow).
  get requiredDisabled() { return this.isBehaviorLocked; }
  get activeDisabled()   { return this.isBehaviorLocked; }
  get behaviorLockedHint() {
    if (this._kind === 'init') {
      return 'Initialize is a required, always-on step of every RFQ pipeline.';
    }
    if (this._kind === 'publish') {
      return 'Publish is a required, always-on step of every RFQ pipeline.';
    }
    return '';
  }

  // ── Tab-strip view-model (body layout) ───────────────────────
  // The body renders as two tabs: Details (Placement + Identity
  // + Behavior, i.e. all step-metadata + toggles) and
  // Configuration (widget-type-specific sub-form). Getters below
  // drive both the `lwc:if` on each tab's content and the
  // active-state class on each tab button.
  get isDetailsTab()       { return this.activeTab === 'details'; }
  get isConfigurationTab() { return this.activeTab === 'configuration'; }
  get detailsTabClass()       { return this._tabCls('details'); }
  get configurationTabClass() { return this._tabCls('configuration'); }
  _tabCls(tab) {
    return this.activeTab === tab
      ? 'sem__tab sem__tab_active'
      : 'sem__tab';
  }
  handleTabSelect(event) {
    const tab = event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.tab
      : null;
    if (!tab) return;
    this.activeTab = tab;
  }

  // ── Input handlers ───────────────────────────────────────────
  handleTitleInput(event)         { this.title = event.target.value; }
  handleDescriptionInput(event)   { this.description = event.target.value; }
  handleComponentNameInput(event) { this.componentName = event.target.value; }
  handleRequiredToggle(event) {
    // Guard against an early click landing before the `disabled`
    // attribute has propagated to the DOM on locked bookends.
    if (this.requiredDisabled) return;
    this.required = !!event.target.checked;
  }
  handleActiveToggle(event) {
    if (this.activeDisabled) return;
    this.active = !!event.target.checked;
  }

  // ── Display Fields handlers ──────────────────────────────────
  handleDisplayEntityChange(event) {
    const v = (event.detail && event.detail.value) || null;
    this.entityValue = v;
    // Fields are entity-scoped - clearing entity clears field.
    this.fieldValue = null;
  }
  handleDisplayFieldChange(event) {
    const v = (event.detail && event.detail.value) || null;
    this.fieldValue = v;
  }
  handleDisplayLabelInput(event) {
    this.labelValue = event.target.value;
  }
  handleAddDisplayField() {
    if (this.isAddDisplayFieldDisabled) return;
    const payload = this._displayFieldsPayload;
    if (!payload) return;
    const list = payload.fieldsByEntity[this.entityValue] || [];
    const fieldEntry = list.find((f) => f.value === this.fieldValue);
    const api = (fieldEntry && fieldEntry.api) || '';
    this.selectionDraft = [
      ...this.selectionDraft,
      {
        entityValue: this.entityValue,
        fieldValue: this.fieldValue,
        label: this.labelValue || '',
        api
      }
    ];
    // Reset the field + label pickers so the admin can rapid-add
    // more within the same entity; keep the entity value so they
    // don't have to re-pick it on each round.
    this.fieldValue = null;
    this.labelValue = '';
  }
  handleRemoveDisplayField(event) {
    const key = event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.key
      : null;
    if (!key) return;
    this.selectionDraft = (this.selectionDraft || []).filter(
      (s) => `${s.entityValue}::${s.fieldValue}` !== key
    );
  }

  // ── Dismiss + save ───────────────────────────────────────────
  handleBackdropClick() { this._dismiss(); }
  handleCancel()        { this._dismiss(); }
  handleDialogClick(event) { event.stopPropagation(); }
  handleKeydown(event) {
    if (event.key === 'Escape') this._dismiss();
  }
  handleSave() {
    if (this.isSaveDisabled) return;
    const c = this._context || {};
    const detail = {
      key: c.key,
      title: this.title.trim(),
      description: this.description,
      componentName: this.componentName,
      required: this.required,
      active: this.active
    };
    // Only emit the display-fields draft when the widget kind
    // actually surfaces the picker - keeps the payload clean for
    // kinds that don't own display fields.
    if (this.hasDisplayFieldsCatalog) {
      detail.displayFields = (this.selectionDraft || []).map((s) => ({ ...s }));
    }
    this.dispatchEvent(
      new CustomEvent('save', {
        detail,
        bubbles: true,
        composed: true
      })
    );
  }
  _dismiss() {
    this.dispatchEvent(
      new CustomEvent('cancel', { bubbles: true, composed: true })
    );
  }
}
