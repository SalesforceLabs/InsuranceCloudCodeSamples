import { LightningElement, api } from 'lwc';
import { ILLUSTRATIONS } from '../../../assets/illustrations/slds2/illustrations.js';

export { readForcedState } from './demoState.js';

/**
 * c-empty-state
 *
 * Container for the SLDS 2 Empty State pattern. Mirrors the platform
 * `lightning-empty-state` API so pages read like the design-system
 * documentation: pass an `illustration-name` in the form `set:symbol`,
 * a `title`, and put the required description in the default slot.
 *
 * Anatomy (docs): illustration (optional) + title (optional) +
 * description (required) + button(s) (optional).
 *
 * Illustrations come exclusively from the official SLDS 2 Cosmos set
 * bundled in `src/assets/illustrations/slds2`. Unknown names render
 * without an illustration; no lookalike art is ever fabricated.
 */
export default class EmptyState extends LightningElement {
  _illustrationName;
  _size = 'medium';

  @api title;
  @api alternativeText;

  @api
  get illustrationName() {
    return this._illustrationName;
  }
  set illustrationName(value) {
    this._illustrationName = value ? String(value).trim().toLowerCase() : undefined;
  }

  @api
  get size() {
    return this._size;
  }
  set size(value) {
    const next = value ? String(value).toLowerCase() : 'medium';
    this._size = ['medium', 'small', 'x-small'].includes(next) ? next : 'medium';
  }

  get illustrationSrc() {
    if (!this._illustrationName) return undefined;
    return ILLUSTRATIONS[this._illustrationName];
  }

  get showIllustration() {
    return this._size !== 'x-small' && Boolean(this.illustrationSrc);
  }

  get hostClass() {
    return `es es_size-${this._size}`;
  }

  get illustrationClass() {
    return `es__illustration es__illustration_${this._size}`;
  }

  get illustrationAlt() {
    return this.alternativeText || '';
  }

  get illustrationAriaHidden() {
    // Illustrations are decorative unless the caller supplies alt text.
    return this.alternativeText ? undefined : 'true';
  }
}
