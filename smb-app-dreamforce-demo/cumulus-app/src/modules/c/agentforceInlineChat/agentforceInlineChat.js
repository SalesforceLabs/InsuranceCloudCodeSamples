import { LightningElement, api } from 'lwc';

// ─────────────────────────────────────────────────────────────────────────
// c-agentforce-inline-chat
//
// Lightweight contextual prompt launcher. Sits inline at the bottom of a
// record (e.g. each vehicle block on the PA coverages tree). It does NOT
// own a chat thread. Submitting a message dispatches a bubbling, composed
// `launchagentforce` event that the docked side panel (c-agentforce-panel,
// mounted at the workspace level) catches and hands off to its own
// conversation surface.
//
// Public API:
//   @api contextId      - stable host record id (e.g. vehicle id)
//   @api recordContext  - full payload to ship with the launch event so
//                          the docked panel can quote the exact record
//   @api placeholder    - optional override for the pill's placeholder
//
// Emits:
//   launchagentforce - { message, context, contextId }
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_PLACEHOLDER =
  'Agentforce is an AI Agent that can answer your support questions about this vehicle';

export default class AgentforceInlineChat extends LightningElement {
  @api contextId;
  @api recordContext;
  @api placeholder = DEFAULT_PLACEHOLDER;

  chatInput = '';

  get isSendDisabled() {
    return !this.chatInput || this.chatInput.trim().length === 0;
  }

  handleInput(event) {
    this.chatInput = event.target.value;
  }

  handleSubmit(event) {
    if (event && event.preventDefault) event.preventDefault();
    const message = this.chatInput.trim();
    if (!message) return;
    this.dispatchEvent(
      new CustomEvent('launchagentforce', {
        bubbles: true,
        composed: true,
        detail: {
          message,
          context: this.recordContext || {},
          contextId: this.contextId || null
        }
      })
    );
    // Reset the input so the pill is ready for the next prompt as soon as
    // the broker returns from the side panel.
    this.chatInput = '';
  }
}
