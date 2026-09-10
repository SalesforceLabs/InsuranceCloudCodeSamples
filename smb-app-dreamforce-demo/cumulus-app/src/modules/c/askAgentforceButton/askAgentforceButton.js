import { LightningElement, api } from 'lwc';

/**
 * c-ask-agentforce-button - the Agentforce "Ask" pill from the Lightning
 * global header.
 *
 * Ported from `sentos_common-ask-agentforce-button` as it renders in the
 * fscee2 org, where it sits in the global header immediately right of the
 * global search box and its tooltip reads "Ask Agentforce Coworker".
 *
 * Org behaviour, measured rather than assumed: activating it opens a fresh
 * Agentforce Coworker session with an empty composer that takes focus. It
 * carries no record context - pressed from an Account record it still opened
 * a new session whose composer was empty, so this raises `ask` with no
 * payload and the shell opens an empty thread.
 *
 * Events:
 *   - 'ask' : fires when the pill is activated by pointer or keyboard.
 *
 * @api props:
 *   - label    (default "Ask")
 *   - tooltip  (default "Ask Agentforce Coworker")
 *   - expanded whether the surface this opens is currently showing
 *
 * @api methods:
 *   - focusPill() returns focus here when that surface closes.
 */
export default class AskAgentforceButton extends LightningElement {
  @api label = 'Ask';
  @api tooltip = 'Ask Agentforce Coworker';
  @api expanded = false;

  // Spelled out rather than bound straight from the boolean so the attribute
  // is always present as "true"/"false" instead of being dropped when false.
  get ariaExpanded() {
    return this.expanded ? 'true' : 'false';
  }

  @api
  focusPill() {
    const btn = this.template.querySelector('.ask__btn');
    if (btn) btn.focus();
  }

  handleClick() {
    this.dispatchEvent(new CustomEvent('ask', { bubbles: true, composed: true }));
  }
}
