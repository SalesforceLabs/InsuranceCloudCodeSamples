import { LightningElement, api, track } from 'lwc';
import {
  currentUser,
  MOCK_ACCOUNTS,
  PERSONAS,
  getPersona
} from 'data/mockData';

// Stable workspace-tab IDs for each account - duplicated from
// c-account-record-page so the search dropdown can resolve a click
// to the right tab without importing the host component. Update both
// places in lock-step if the mapping changes.
const TAB_ID_BY_ACCOUNT = {
  '001SB00001oXwntYAC': 'account-mavericks',
  '001EB00002pYzbMAC': 'account-acme',
  'a-whitfield': 'account-whitfield',
  'a-bluebird': 'account-bluebird'
};

// SLDS 2 display density. Toggling between Comfy and Compact flips a
// [data-density] attribute on <html> which switches the density-aware
// styling hooks (--slds-g-spacing-var-*, --slds-g-font-scale-var-*,
// --slds-g-font-lineheight-var-base) across the app.
const DENSITY_KEY = 'atlas-display-density';

function readInitialDensity() {
  if (typeof window === 'undefined') return 'comfy';
  try {
    return window.localStorage.getItem(DENSITY_KEY) === 'compact'
      ? 'compact'
      : 'comfy';
  } catch (e) {
    return 'comfy';
  }
}

function applyDensity(value) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-density', value);
  try {
    window.localStorage.setItem(DENSITY_KEY, value);
  } catch (e) {
    /* ignore quota / private-mode errors */
  }
}

export default class TopNav extends LightningElement {
  @api route;
  @api slackOpen = false;
  // Runtime RFQ tabs the host (c-app) has open. Surfaced in the
  // search dropdown's "Digital Experiences" section so the broker
  // can hop back into an in-flight RFQ even when Setup has taken
  // over the tab strip. Shape: [{ id, label, type, accountId, ... }]
  @api openRfqTabs = [];
  // Persona routing (Profile-based Home assignment demo). Parent
  // (c-app) owns the source of truth; the nav renders the avatar +
  // "Switch persona" menu and bubbles `personachange` on pick.
  @api activePersonaId;
  @track density = readInitialDensity();
  @track searchOpen = false;
  @track searchQuery = '';
  @track personaMenuOpen = false;

  connectedCallback() {
    // Reflect the persisted choice the moment the nav mounts so the
    // app boots in the user's last-chosen density.
    applyDensity(this.density);
  }

  // ── Persona menu (demo Profile-based Home assignment) ────────
  // Avatar in the utility bar doubles as the persona menu opener.
  // Falls back to the mockData currentUser when the parent hasn't
  // pushed a persona id yet (defensive; app.js always sets one).
  get _persona() {
    return getPersona(this.activePersonaId) || getPersona(currentUser.personaId);
  }
  get initials() {
    return this._persona.initials;
  }
  get personaName() {
    return this._persona.name;
  }
  get personaAvatarTitle() {
    return `${this._persona.name} - ${this._persona.profileLabel}. Switch persona.`;
  }
  get avatarStyle() {
    // Persona avatarColor overrides the default gradient so the
    // switch is visible at a glance.
    return `background: ${this._persona.avatarColor};`;
  }
  get personaMenuClass() {
    return this.personaMenuOpen
      ? 'tn-persona-menu is-open'
      : 'tn-persona-menu';
  }
  get personaOptions() {
    return PERSONAS.map((p) => ({
      id: p.id,
      name: p.name,
      profileLabel: p.profileLabel,
      initials: p.initials,
      isActive: p.id === this._persona.id,
      cls: p.id === this._persona.id
        ? 'tn-persona-option is-active'
        : 'tn-persona-option',
      avatarStyle: `background: ${p.avatarColor};`
    }));
  }

  handlePersonaToggle(event) {
    event.stopPropagation();
    this.personaMenuOpen = !this.personaMenuOpen;
  }
  handlePersonaScrim() {
    this.personaMenuOpen = false;
  }
  handlePersonaPick(event) {
    const id = event.currentTarget.dataset.personaId;
    this.personaMenuOpen = false;
    if (!id || id === this._persona.id) return;
    this.dispatchEvent(
      new CustomEvent('personachange', {
        detail: { personaId: id },
        bubbles: true,
        composed: true
      })
    );
  }

  get isCompact() {
    return this.density === 'compact';
  }
  get densityLabel() {
    return this.isCompact ? 'Compact' : 'Comfy';
  }
  get densityTitle() {
    return `Display density: ${this.densityLabel} - click to switch`;
  }

  toggleDensity() {
    this.density = this.isCompact ? 'comfy' : 'compact';
    applyDensity(this.density);
  }

  goHome() {
    this.dispatchEvent(
      new CustomEvent('navigate', { detail: { route: 'run-my-day' } })
    );
  }

  toggleSlack() {
    this.dispatchEvent(new CustomEvent('toggleslack'));
  }

  // ── Search dropdown ─────────────────────────────────────────
  // Surfaces a single "Digital Experiences" results section that
  // mixes accounts (jump straight to the record page) with the
  // currently-open runtime RFQ tabs (jump back into the in-flight
  // wizard). Clicking a result bubbles `searchnavigate` to c-app,
  // which sets activeWorkspaceTabId - accountRecordPage's setter
  // auto-closes Setup so the original tab strip reappears.
  get searchPanelClass() {
    return this.searchOpen
      ? 'tn-search-panel is-open'
      : 'tn-search-panel';
  }
  get searchButtonClass() {
    return this.searchOpen ? 'icon-btn is-open' : 'icon-btn';
  }
  get _normalizedQuery() {
    return (this.searchQuery || '').trim().toLowerCase();
  }
  get _accountResults() {
    return MOCK_ACCOUNTS
      .filter((a) => TAB_ID_BY_ACCOUNT[a.id]) // only accounts we can actually open
      .map((a) => ({
        id: TAB_ID_BY_ACCOUNT[a.id],
        kind: 'account',
        label: a.name,
        meta: [a.industry, a.city].filter(Boolean).join(' \u00b7 '),
        sort: a.name.toLowerCase()
      }));
  }
  get _rfqResults() {
    return (this.openRfqTabs || []).map((t) => {
      // Map account id back to its display name so the meta line
      // tells the broker which book the RFQ belongs to.
      const acct = MOCK_ACCOUNTS.find((a) => a.id === t.accountId);
      const kindLabel = t.type === 'policy' ? 'Policy' : 'RFQ';
      const acctLabel = acct ? acct.name : '';
      return {
        id: t.id,
        kind: 'rfq',
        label: t.label || 'Untitled RFQ',
        meta: [kindLabel, acctLabel].filter(Boolean).join(' \u00b7 '),
        sort: (t.label || '').toLowerCase()
      };
    });
  }
  get searchResults() {
    const q = this._normalizedQuery;
    const all = [...this._accountResults, ...this._rfqResults];
    const filtered = q
      ? all.filter(
          (r) =>
            r.label.toLowerCase().includes(q) ||
            r.meta.toLowerCase().includes(q)
        )
      : all;
    // Stable alphabetical sort - keeps Accounts and RFQs interleaved
    // by name so the broker scans by what they know, not by type.
    // Decorate with kindIs* booleans so the template switches icons
    // without doing string comparison inside lwc:if (not supported).
    return filtered
      .sort((a, b) => a.sort.localeCompare(b.sort))
      .map((r) => ({
        ...r,
        kindIsAccount: r.kind === 'account',
        kindIsRfq: r.kind === 'rfq'
      }));
  }
  get hasSearchResults() {
    return this.searchResults.length > 0;
  }
  get searchEmptyCopy() {
    return this._normalizedQuery
      ? `No matches for "${this.searchQuery}"`
      : 'No accounts or open RFQs yet.';
  }

  handleSearchToggle(event) {
    event.stopPropagation();
    this.searchOpen = !this.searchOpen;
    if (this.searchOpen) {
      // Defer focus to the next tick so the input has mounted.
      // eslint-disable-next-line @lwc/lwc/no-async-operation
      Promise.resolve().then(() => {
        const input = this.template.querySelector('.tn-search__input');
        if (input) input.focus();
      });
    }
  }
  handleSearchScrim() {
    this.searchOpen = false;
  }
  handleSearchInput(event) {
    this.searchQuery = event.target.value || '';
  }
  handleSearchKey(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.searchOpen = false;
    }
  }
  handleResultPick(event) {
    const tabId = event.currentTarget.dataset.tabId;
    if (!tabId) return;
    this.searchOpen = false;
    this.searchQuery = '';
    this.dispatchEvent(
      new CustomEvent('searchnavigate', {
        detail: { tabId },
        bubbles: true,
        composed: true
      })
    );
  }
}
