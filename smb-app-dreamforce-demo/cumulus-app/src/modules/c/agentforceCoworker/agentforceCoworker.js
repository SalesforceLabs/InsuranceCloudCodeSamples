import { LightningElement, api } from 'lwc';
import { getPersona } from 'data/mockData';

/**
 * c-agentforce-coworker - the full-page Agentforce Coworker landing screen
 * the org opens at /lightning/coworker?uid=... when the global-header Ask
 * pill is activated.
 *
 * Presentation only. The org's real surface streams an agent session; this
 * one renders the landing state and stops there, which is all the demo
 * needs the Ask pill to prove.
 *
 * Measured against fscee2 rather than eyeballed:
 *   - content column 800px, vertically centred in the page body
 *   - greeting  32px / weight 400 / #03234D
 *   - subline   16px / weight 400 / #022AC0
 *   - composer  1px solid #5C5C5C, radius 20px, white, 130px tall
 *   - footer    10px, disclaimer #5C5C5C, link buttons #0250D9
 *   - prompts   13px / weight 600 pills, radius 240px, 1px solid #5C5C5C
 */
export default class AgentforceCoworker extends LightningElement {
  @api personaId;

  draft = '';

  get firstName() {
    const full = getPersona(this.personaId)?.name || '';
    return full.split(' ')[0] || 'there';
  }

  get greeting() {
    return `Hi, ${this.firstName}. Let's dive in.`;
  }

  // The send affordance greys out until there is something to send, the
  // same way the org's does. Nothing is wired behind it.
  get sendClass() {
    return this.draft.trim()
      ? 'afc-send afc-send_ready'
      : 'afc-send';
  }

  handleInput(event) {
    this.draft = event.target.value;
  }
}
