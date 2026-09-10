import { LightningElement, api } from 'lwc';

/**
 * SLDS 2 doctype icon (SLDS Files blueprint - `slds-icon-doctype-*`).
 *
 * The blueprint renders these from the doctype sprite:
 *
 *   <svg><use xlink:href="/assets/icons/doctype-sprite/svg/symbols.svg#pdf"/></svg>
 *
 * This app ships no SLDS icon assets and its components render into
 * native shadow roots, so the sprite is unreachable on both counts. The
 * artwork is inlined instead, taken verbatim from the design system's
 * own `doctype/pdf.svg` and `doctype/excel.svg` so the fills, the
 * folded corner and the lettering match the real icons rather than
 * approximating them.
 *
 * Each icon keeps the doctype keyline: a 56x64 vertical rectangle with
 * the earflap drawn without a gap, per the doctype anatomy.
 */
export default class DoctypeIcon extends LightningElement {
  /** 'PDF' | 'XLS'. Anything else renders nothing. */
  @api kind;

  get normalized() {
    return String(this.kind || '').trim().toUpperCase();
  }

  get isPdf() {
    return this.normalized === 'PDF';
  }

  get isXls() {
    return this.normalized === 'XLS' || this.normalized === 'XLSX';
  }

  // The file name beside the icon already carries the extension, so the
  // glyph is decorative. The label is still exposed for the cases where
  // a name is truncated to the point the extension is lost.
  get label() {
    if (this.isPdf) return 'PDF document';
    if (this.isXls) return 'Spreadsheet';
    return '';
  }
}
