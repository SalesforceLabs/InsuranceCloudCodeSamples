import { LightningElement, api } from 'lwc';

/**
 * c-eb-intake-setup
 *
 * Stub child mounted under "Asset Data Capture" in the Insurance Setup
 * Workspace. Ships as a structural scaffold so the modular shell can
 * route to it today; full intake-config UI lands in a follow-up pass.
 *
 * Public contract (per workspace directive):
 *   @api rootProduct        - string root id passed down from the shell
 *   event "configurationsave" - bubbles up to the shell's
 *                               handleConfigurationSave sink
 */
export default class EbIntakeSetup extends LightningElement {
  _rootProduct = null;

  @api
  get rootProduct() {
    return this._rootProduct;
  }
  set rootProduct(value) {
    this._rootProduct = value || null;
  }

  // Friendly label for the empty-state copy. Mirrors the picker labels
  // in c-insurance-setup-workspace so the admin sees a consistent name.
  get rootProductLabel() {
    switch (this._rootProduct) {
      case 'medical':         return 'Group Medical';
      case 'commercial_auto': return 'Commercial Auto';
      case 'smb_bop':         return 'SMB BOP';
      default:                return '';
    }
  }
  get hasRootProduct() {
    return !!this._rootProduct;
  }

  handlePlaceholderSave() {
    this.dispatchEvent(
      new CustomEvent('configurationsave', {
        detail: {
          stepId: 'asset_data',
          source: 'ebIntakeSetup',
          rootProduct: this._rootProduct
        },
        bubbles: true,
        composed: true
      })
    );
  }
}
