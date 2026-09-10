import { LightningElement, api } from 'lwc';

/**
 * c-eb-integration-hub
 *
 * Stub child for the "Provider & Carrier Catalog" step under the
 * Integration Hub domain. Ships as a scaffold so the shell can route
 * the entire Integration Hub category today; provider auth, mapping,
 * and webhook sub-views land in follow-ups.
 *
 * Public contract:
 *   @api rootProduct          - string root id from the shell
 *   event "configurationsave" - bubbles to the shell sink
 */
export default class EbIntegrationHub extends LightningElement {
  _rootProduct = null;

  @api
  get rootProduct() {
    return this._rootProduct;
  }
  set rootProduct(value) {
    this._rootProduct = value || null;
  }

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
          stepId: 'integrations',
          source: 'ebIntegrationHub',
          rootProduct: this._rootProduct
        },
        bubbles: true,
        composed: true
      })
    );
  }
}
