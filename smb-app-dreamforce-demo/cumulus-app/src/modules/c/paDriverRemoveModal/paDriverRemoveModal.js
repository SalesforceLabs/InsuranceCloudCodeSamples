import { LightningElement, api } from 'lwc';

/**
 * c-pa-driver-remove-modal - context-aware "remove driver" confirm.
 *
 * Clicking the X on a driver chip opens this. If the driver is also on
 * other vehicles, those are surfaced so the broker understands the blast
 * radius before choosing Unassign (this vehicle only) vs Delete (whole
 * policy roster).
 */
export default class PaDriverRemoveModal extends LightningElement {
  @api open = false;
  @api driverName = '';
  @api vehicleName = '';
  @api otherVehicleNames = [];

  get isShared() {
    return Array.isArray(this.otherVehicleNames) && this.otherVehicleNames.length > 0;
  }

  get otherVehicleItems() {
    return (this.otherVehicleNames || []).map((name, i) => ({
      key: `ov-${i}`,
      name
    }));
  }

  handleCancel() {
    this.dispatchEvent(new CustomEvent('cancel'));
  }

  handleBackdrop() {
    this.handleCancel();
  }

  stopPropagation(event) {
    event.stopPropagation();
  }

  handleUnassign() {
    this.dispatchEvent(new CustomEvent('unassign'));
  }

  handleDelete() {
    this.dispatchEvent(new CustomEvent('delete'));
  }
}
