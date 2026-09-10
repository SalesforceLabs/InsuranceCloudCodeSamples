import { LightningElement, api, track } from 'lwc';

/**
 * c-add-asset-modal - two-step "Add Asset" dialog.
 *
 * Step 1: pick which child subject to add (Vehicle vs Driver on Auto).
 * Step 2: the corresponding form (with lookup + fields), rendered
 *         inline in the same modal shell via c-pa-vehicle-form-fields
 *         or c-pa-driver-form-fields.
 *
 * Auto-skip: if `options.length === 1` the modal mounts straight into
 * Step 2 with that single option as the picked kind, and the Back
 * button is hidden (there's nothing to go back to).
 *
 * Parent contract:
 *   @api options           - [{ id, label, description, iconPath }]
 *   @api availableVehicles - forwarded to the vehicle form-fields
 *   @api availableDrivers  - forwarded to the driver form-fields
 *   emits `save`           - { detail: { kind, record } }
 *   emits `cancel`         - closed via X / backdrop / Cancel
 */
export default class AddAssetModal extends LightningElement {
  @api open = false;
  @api availableVehicles = [];
  @api availableDrivers = [];

  _options = [];
  @api
  get options() {
    return this._options;
  }
  set options(value) {
    this._options = Array.isArray(value) ? value.slice() : [];
    // Auto-skip Step 1 when there's exactly one option to pick from -
    // going through the picker for a 1-item list is pointless friction.
    if (this._options.length === 1) {
      this._pickedKind = this._options[0].id;
      this._step = 2;
    } else {
      this._pickedKind = null;
      this._step = 1;
    }
  }

  @track _step = 1;
  @track _pickedKind = null;

  // ── Step + kind view-model ─────────────────────────────────────
  get isStep1() {
    return this._step === 1;
  }
  get isStep2() {
    return this._step === 2;
  }
  get isVehicleStep() {
    return this._step === 2 && this._pickedKind === 'vehicle';
  }
  get isDriverStep() {
    return this._step === 2 && this._pickedKind === 'driver';
  }
  // True when the user got to Step 2 via the picker (not the auto-skip
  // single-option case). Drives whether the Back button is visible.
  get canGoBack() {
    return this._step === 2 && (this._options || []).length > 1;
  }
  get modalTitle() {
    if (this._step === 1) return 'Add to RFQ';
    const opt = this._options.find((o) => o.id === this._pickedKind);
    return opt ? `Add ${opt.label}` : 'Add to RFQ';
  }
  get saveLabel() {
    const opt = this._options.find((o) => o.id === this._pickedKind);
    return opt ? `Save ${opt.label}` : 'Save';
  }
  // Decorated cards for the Step 1 picker template.
  get pickerCards() {
    return (this._options || []).map((o) => ({
      id: o.id,
      label: o.label,
      description: o.description || '',
      iconPath: o.iconPath || ''
    }));
  }

  // ── Handlers ───────────────────────────────────────────────────
  handlePickerSelect(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this._pickedKind = id;
    this._step = 2;
  }
  handleBack() {
    if (!this.canGoBack) return;
    // Reset the currently-mounted form so a subsequent revisit starts
    // clean rather than remembering the abandoned draft.
    this._resetActiveFields();
    this._pickedKind = null;
    this._step = 1;
  }
  handleCancel() {
    this._resetActiveFields();
    this.dispatchEvent(new CustomEvent('cancel'));
  }
  handleBackdrop() {
    this.handleCancel();
  }
  stopPropagation(event) {
    event.stopPropagation();
  }
  handleSave() {
    if (this._step !== 2 || !this._pickedKind) return;
    const fields = this._activeFieldsElement();
    if (!fields) return;
    const record = fields.submit();
    if (!record) return; // validation surfaced inline in the fields component
    this.dispatchEvent(
      new CustomEvent('save', {
        detail: { kind: this._pickedKind, record }
      })
    );
    this._resetActiveFields();
  }

  _activeFieldsElement() {
    if (this._pickedKind === 'vehicle') {
      return this.template.querySelector('c-pa-vehicle-form-fields');
    }
    if (this._pickedKind === 'driver') {
      return this.template.querySelector('c-pa-driver-form-fields');
    }
    return null;
  }
  _resetActiveFields() {
    const el = this._activeFieldsElement();
    if (el && typeof el.reset === 'function') el.reset();
  }
}
