import { LightningElement, api } from 'lwc';

/**
 * c-pa-driver-modal - "Add New Driver to Household" dialog chrome.
 *
 * Field markup + lookup + validation live in the c-pa-driver-form-fields
 * subcomponent so they can be reused by c-add-asset-modal (two-step
 * picker) without duplicating the form. This component owns only the
 * modal shell + Save/Cancel routing + emit contract with the parent.
 *
 * Launched from a vehicle's assign popover ("+ Create New Driver"). On
 * save it composes a normalized driver and dispatches `save`; the parent
 * adds it to the roster and auto-assigns to the launching vehicle.
 */
export default class PaDriverModal extends LightningElement {
  @api open = false;
  @api vehicleName = '';

  // Drivers surfaced in the form-fields lookup section (forwarded).
  @api availableDrivers = [];

  get hasVehicle() {
    return !!this.vehicleName;
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
    const fields = this.template.querySelector('c-pa-driver-form-fields');
    if (!fields) return;
    const driver = fields.submit();
    if (!driver) return;
    this.dispatchEvent(new CustomEvent('save', { detail: { driver } }));
    this._resetFields();
  }

  _resetFields() {
    const fields = this.template.querySelector('c-pa-driver-form-fields');
    if (fields) fields.reset();
  }
}
