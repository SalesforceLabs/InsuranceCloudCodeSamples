import { LightningElement, api } from 'lwc';

/**
 * c-hom-homeowner-modal - SLDS "Add / Edit Homeowner" dialog chrome.
 *
 * Field markup + lookup + validation live in the c-hom-homeowner-form-fields
 * subcomponent so they can be reused by c-hom-add-asset-modal (two-step
 * picker). This component owns only the modal shell + Save/Cancel
 * routing + emit contract with the parent.
 *
 * Presentational: the parent owns `open` and the roster state. On save
 * the modal composes a normalized homeowner record and dispatches `save`;
 * the parent appends/updates and closes. Backdrop / X / Cancel -> `cancel`.
 *
 * The workspace uses this component for the EDIT path only. The ADD
 * path runs through c-hom-add-asset-modal.
 */
export default class HomHomeownerModal extends LightningElement {
  @api open = false;

  // When set (with an id), the modal renders in Edit mode and pre-fills
  // via the `seed` prop on the shared form-fields subcomponent.
  @api homeowner;

  // Homeowners surfaced in the form-fields lookup section (forwarded).
  @api availableHomeowners = [];

  get isEdit() {
    return !!(this.homeowner && this.homeowner.id);
  }
  get modalTitle() {
    return this.isEdit ? 'Edit Homeowner' : 'Add Homeowner';
  }
  get saveLabel() {
    return this.isEdit ? 'Update Homeowner' : 'Save Homeowner';
  }
  // Only pass the seed to the field subcomponent when editing; the
  // add-flow starts clean.
  get formSeed() {
    return this.isEdit ? this.homeowner : null;
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
    const fields = this.template.querySelector('c-hom-homeowner-form-fields');
    if (!fields) return;
    const homeowner = fields.submit();
    if (!homeowner) return; // validation surfaced inline
    const detail = this.isEdit
      ? { homeowner, id: this.homeowner.id }
      : { homeowner };
    this.dispatchEvent(new CustomEvent('save', { detail }));
    this._resetFields();
  }

  _resetFields() {
    const fields = this.template.querySelector('c-hom-homeowner-form-fields');
    if (fields) fields.reset();
  }
}
