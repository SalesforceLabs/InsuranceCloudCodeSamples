import { LightningElement, api, track } from 'lwc';

/**
 * c-insight-accordion - single expandable insight card.
 *
 * Supports two modes:
 *  - Uncontrolled: parent doesn't set `open`; component tracks its
 *    own `_open` state (seeded from `defaultOpen`). Toggling flips
 *    that internal flag.
 *  - Controlled: parent sets `open={bool}` and listens to the
 *    `toggle` event to coordinate siblings (used by c-run-my-day
 *    to enforce the app-wide "no two accordions open at the same
 *    level" rule).
 */
export default class InsightAccordion extends LightningElement {
  @api insight;
  @api defaultOpen = false;
  @track _open;
  _openControlled = false;

  @api
  get open() {
    return this._openControlled ? this._open : !!this._open;
  }
  set open(value) {
    this._openControlled = true;
    this._open = !!value;
  }

  connectedCallback() {
    // If the parent never wired `open`, honour defaultOpen so we
    // stay backward compatible for single-instance callers.
    if (!this._openControlled) {
      this._open = this.defaultOpen;
    }
  }

  get openAttr() {
    return this._open ? 'true' : 'false';
  }

  get cardClass() {
    return this._open ? 'card is-open' : 'card';
  }

  get severityDotClass() {
    const sev = this.insight?.severity || 'low';
    return `dot dot-${sev}`;
  }

  toggle() {
    const wasOpen = !!this._open;
    // Uncontrolled mode owns its own state; controlled mode defers
    // to the parent, which reacts to the `toggle` event and pushes
    // the new `open` value back down through the @api setter.
    if (!this._openControlled) {
      this._open = !wasOpen;
    }
    this.dispatchEvent(
      new CustomEvent('toggle', {
        detail: {
          insightId: this.insight?.id,
          wasOpen,
          nextOpen: !wasOpen
        },
        bubbles: true,
        composed: true
      })
    );
  }

  // Keyboard activation for the role="button" header so the accordion
  // is operable via Enter / Space, not just mouse clicks.
  handleHeaderKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') {
      return;
    }
    event.preventDefault();
    this.toggle();
  }

  handleScheduleCall(event) {
    event.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('action', {
        detail: { kind: 'schedule-call', insightId: this.insight?.id },
        bubbles: true,
        composed: true
      })
    );
  }

  handleSendEmail(event) {
    event.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('action', {
        detail: { kind: 'send-ai-email', insightId: this.insight?.id },
        bubbles: true,
        composed: true
      })
    );
  }
}
