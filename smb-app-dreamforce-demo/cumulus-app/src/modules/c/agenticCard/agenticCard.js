import { LightningElement, api, track } from 'lwc';

/**
 * c-agentic-card - SLDS 2 "Agentic Card" pattern.
 *
 * Anatomy (per the SLDS 2 - Agentic Experiences Figma file):
 *   1. Header   : title + overflow menu (inline row)
 *   2. AI pill  : "This content is AI generated" with sparkle + info
 *   3. Freshness: timestamp + regenerate icon
 *   4. Body     : slot for caller content (prose + CTAs)
 *   5. Feedback : thumbs up / thumbs down / more
 *   6. Sources  : toggle header + expandable list of source rows
 *
 * Sources API - the card accepts either shape:
 *   - `sources-count={n}`               : count-only footer (chevron toggles a bubble event)
 *   - `sources={[{ id, label, type, href? }]}` : full list rendered in the expanded state
 *
 * Variants via @api variant:
 *   - 'standalone' (default) - full elevated card surface
 *   - 'nested'      - flush-mounted inside another card (no shadow, soft tint)
 *   - 'banner'      - horizontal layout for full-bleed top-of-page banners
 */
export default class AgenticCard extends LightningElement {
  @api title = 'Agentforce Summary';
  @api aiLabel = 'This content is AI generated';
  @api timestamp;
  @api sourcesCount = 0;
  @api sources;
  @api defaultSourcesOpen = false;
  @api hideFeedback = false;
  @api hideMenu = false;
  @api hideRefresh = false;
  @api variant = 'standalone';

  @track feedback = null;
  @track _sourcesOpen;

  connectedCallback() {
    // Seed the expanded state from the @api default the first time we mount.
    // Callers can then flip it interactively via the chevron; we keep the
    // toggle local (parents that need to know listen to the `sources` event).
    // HTML boolean attributes (e.g. `default-sources-open` with no value)
    // reach LWC as the empty string, so we treat presence-as-truthy.
    if (this._sourcesOpen === undefined) {
      const v = this.defaultSourcesOpen;
      this._sourcesOpen = v === true || v === '' || v === 'true';
    }
  }

  get hostClass() {
    return `ac ac-${this.variant}`;
  }

  get feedbackUpAriaPressed() {
    return this.feedback === 'up' ? 'true' : 'false';
  }

  get feedbackDownAriaPressed() {
    return this.feedback === 'down' ? 'true' : 'false';
  }

  get thumbsUpClass() {
    const base = 'slds-button slds-button_icon slds-button_icon-x-small ac-thumb';
    return this.feedback === 'up' ? `${base} is-active` : base;
  }

  get thumbsDownClass() {
    const base = 'slds-button slds-button_icon slds-button_icon-x-small ac-thumb';
    return this.feedback === 'down' ? `${base} is-active` : base;
  }

  get showFeedback() {
    return !this.hideFeedback;
  }

  get showMenu() {
    return !this.hideMenu;
  }

  get showRefresh() {
    return !this.hideRefresh;
  }

  // Whether to render the sources block at all. Show when either a count
  // is provided OR a non-empty array is passed in.
  get hasSources() {
    return this._hasSourcesArray || Number(this.sourcesCount) > 0;
  }

  get _hasSourcesArray() {
    return Array.isArray(this.sources) && this.sources.length > 0;
  }

  // Prefer the array length as the source-of-truth count when an array
  // is passed; fall back to the explicit count when the caller only
  // wants the chevron affordance without a list.
  get resolvedSourcesCount() {
    if (this._hasSourcesArray) return this.sources.length;
    return Number(this.sourcesCount) || 0;
  }

  get showSourcesList() {
    return this._hasSourcesArray && this._sourcesOpen;
  }

  get sourcesAriaExpanded() {
    return this._sourcesOpen ? 'true' : 'false';
  }

  get sourcesChevronClass() {
    return this._sourcesOpen
      ? 'ac-sources-toggle__chev is-open'
      : 'ac-sources-toggle__chev';
  }

  // Decorate each source row with a 1-based index for the leading badge
  // (the reference SVG shows "1", "2", "3" as a citation-style counter).
  get sourcesRows() {
    if (!this._hasSourcesArray) return [];
    return this.sources.map((s, i) => ({
      id: s.id ?? `${s.label}-${i}`,
      index: i + 1,
      label: s.label,
      type: s.type || 'Source',
      href: s.href || null
    }));
  }

  handleThumbUp() {
    this.feedback = this.feedback === 'up' ? null : 'up';
    this.dispatchEvent(
      new CustomEvent('feedback', { detail: { value: this.feedback } })
    );
  }

  handleThumbDown() {
    this.feedback = this.feedback === 'down' ? null : 'down';
    this.dispatchEvent(
      new CustomEvent('feedback', { detail: { value: this.feedback } })
    );
  }

  handleRefresh() {
    this.dispatchEvent(new CustomEvent('refresh'));
  }

  toggleSources() {
    this._sourcesOpen = !this._sourcesOpen;
    this.dispatchEvent(
      new CustomEvent('sources', { detail: { open: this._sourcesOpen } })
    );
  }
}
