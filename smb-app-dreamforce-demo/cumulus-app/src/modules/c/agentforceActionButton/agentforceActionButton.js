import { LightningElement, api } from 'lwc';

/**
 * c-agentforce-action-button - SLDS 2 "Agentforce assisted action" pill.
 *
 * Anatomy (per the SLDS 2 Agentic Experiences Figma):
 *   1. Sparkle glyph (AI provenance mark, brand blue)
 *   2. Action label (brand blue, semibold)
 *   3. Vertical divider
 *   4. Caret-down trigger (opens an actions menu)
 *
 * Events:
 *   - 'action' : fires when the main pill is clicked
 *   - 'menu'   : fires when the caret is clicked. Detail includes a
 *                computed `open` flag so parents can toggle a menu.
 *
 * @api props:
 *   - label       (default "Agentforce assisted action")
 *   - expandable  (default true) - shows the caret-down split
 *   - menuOpen    - set true while the parent menu is visible (drives
 *                   aria-expanded for accessibility)
 *   - disabled    - disables both segments
 */
export default class AgentforceActionButton extends LightningElement {
  @api label = 'Agentforce assisted action';
  @api expandable = true;
  @api menuOpen = false;
  @api disabled = false;

  get hostClass() {
    const base = 'afa';
    return this.expandable ? `${base} ${base}_split` : base;
  }

  get menuLabel() {
    return `${this.label} options`;
  }

  // LWC serializes booleans into HTML; aria-expanded must be "true"/"false".
  get menuOpenAttr() {
    return this.menuOpen ? 'true' : 'false';
  }

  handleAction(event) {
    event.preventDefault();
    if (this.disabled) return;
    this.dispatchEvent(
      new CustomEvent('action', { bubbles: true, composed: true })
    );
  }

  handleMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    if (this.disabled) return;
    this.dispatchEvent(
      new CustomEvent('menu', {
        detail: { open: !this.menuOpen },
        bubbles: true,
        composed: true
      })
    );
  }
}
