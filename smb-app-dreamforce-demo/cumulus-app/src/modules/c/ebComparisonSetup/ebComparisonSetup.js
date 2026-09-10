import { LightningElement, api } from 'lwc';

/**
 * c-eb-comparison-setup
 *
 * Stub child for the "Side-by-Side Compare (new)" step under Evaluation
 * & Presentation. Distinct from the existing c-quote-compare-setup
 * (wired separately to NextGen Comparison Matrix) - this one
 * demonstrates the directive's modular contract for a fresh comparison
 * builder slot.
 *
 * Public contract:
 *   @api rootProduct          - string root id from the shell
 *   event "configurationsave" - bubbles to the shell sink
 */
export default class EbComparisonSetup extends LightningElement {
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
          stepId: 'quote_compare',
          source: 'ebComparisonSetup',
          rootProduct: this._rootProduct
        },
        bubbles: true,
        composed: true
      })
    );
  }
}
