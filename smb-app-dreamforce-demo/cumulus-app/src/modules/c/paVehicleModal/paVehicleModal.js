import { LightningElement, api } from 'lwc';

/**
 * c-pa-vehicle-modal - SLDS "Add / Edit Vehicle" dialog chrome.
 *
 * Field markup + lookup + validation live in the c-pa-vehicle-form-fields
 * subcomponent so they can be reused by c-add-asset-modal (two-step
 * picker) without duplicating the form. This component owns only the
 * modal shell + Save/Cancel routing + emit contract with the parent.
 *
 * Presentational: the parent owns `open` and the roster state. On save
 * the modal composes a normalized vehicle object and dispatches `save`;
 * the parent appends it and closes. Backdrop / X / Cancel -> `cancel`.
 */

export default class PaVehicleModal extends LightningElement {
  @api open = false;

  // When set (with an id), the modal renders in Edit mode and pre-fills
  // via the seed prop on the shared form-fields subcomponent.
  @api vehicle;

  // Vehicles surfaced in the form-fields lookup section (forwarded).
  @api availableVehicles = [];

  get isEdit() {
    return !!(this.vehicle && this.vehicle.id);
  }
  get modalTitle() {
    return this.isEdit ? 'Edit Vehicle' : 'Add Vehicle';
  }
  get saveLabel() {
    return this.isEdit ? 'Update Vehicle' : 'Save Vehicle';
  }
  // Only pass the seed to the field subcomponent when editing; add-flow
  // starts clean.
  get formSeed() {
    return this.isEdit ? this.vehicle : null;
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
    const fields = this.template.querySelector('c-pa-vehicle-form-fields');
    if (!fields) return;
    const vehicle = fields.submit();
    if (!vehicle) return; // validation surfaced inline
    const detail = this.isEdit
      ? { vehicle, id: this.vehicle.id }
      : { vehicle };
    this.dispatchEvent(new CustomEvent('save', { detail }));
    this._resetFields();
  }

  _resetFields() {
    const fields = this.template.querySelector('c-pa-vehicle-form-fields');
    if (fields) fields.reset();
  }
}
