import { LightningElement, api } from 'lwc';

/**
 * c-hom-dwelling-modal - SLDS "Add / Edit Dwelling" dialog chrome.
 *
 * Field markup + lookup + validation live in the c-hom-dwelling-form-fields
 * subcomponent so they can be reused by c-hom-add-asset-modal (two-step
 * picker) without duplicating the form. This component owns only the
 * modal shell + Save/Cancel routing + emit contract with the parent.
 *
 * Presentational: the parent owns `open` and the roster state. On save
 * the modal composes a normalized dwelling object and dispatches `save`;
 * the parent appends/updates and closes. Backdrop / X / Cancel -> `cancel`.
 *
 * The workspace uses this component for the EDIT path only. The ADD
 * path now runs through c-hom-add-asset-modal (Property vs Homeowner
 * picker) which mounts the same c-hom-dwelling-form-fields inline.
 */
export default class HomDwellingModal extends LightningElement {
  @api open = false;

  // When set (with an id), the modal renders in Edit mode and pre-fills
  // via the `seed` prop on the shared form-fields subcomponent.
  @api dwelling;

  // Dwellings surfaced in the form-fields lookup section (forwarded).
  @api availableDwellings = [];

  get isEdit() {
    return !!(this.dwelling && this.dwelling.id);
  }
  get modalTitle() {
    return this.isEdit ? 'Edit Property' : 'Add Property';
  }
  get saveLabel() {
    return this.isEdit ? 'Update Property' : 'Save Property';
  }
  // Only pass the seed to the field subcomponent when editing; the
  // add-flow starts clean.
  get formSeed() {
    return this.isEdit ? this.dwelling : null;
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
    const fields = this.template.querySelector('c-hom-dwelling-form-fields');
    if (!fields) return;
    const dwelling = fields.submit();
    if (!dwelling) return; // validation surfaced inline
    const detail = this.isEdit
      ? { dwelling, id: this.dwelling.id }
      : { dwelling };
    this.dispatchEvent(new CustomEvent('save', { detail }));
    this._resetFields();
  }

  _resetFields() {
    const fields = this.template.querySelector('c-hom-dwelling-form-fields');
    if (fields) fields.reset();
  }
}
