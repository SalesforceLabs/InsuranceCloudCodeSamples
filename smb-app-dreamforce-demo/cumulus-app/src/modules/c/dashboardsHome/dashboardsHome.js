import { LightningElement } from 'lwc';
import { currentUser, getPersona } from 'data/mockData';

/**
 * c-dashboards-home - a Setup-lookalike landing page that gathers the
 * three analytics surfaces (Run my day, Client 360, Revenue
 * Intelligence) into one place as launch tiles. Opened from the App
 * Launcher → Dashboards as its own workspace tab.
 *
 * Persona gating: the tile catalog is filtered by the active persona's
 * capabilities (demo stand-in for Salesforce Dashboard/Report Folder
 * sharing). Producers / Account Managers do not see the Revenue tile
 * at all - simulating "folder shared only with the Executive public
 * group". Principals + Finance see the full set.
 *
 * The component stays presentational: each tile click dispatches a
 * `dashboardopen` event ({ detail: { id } }) that the host
 * (c-account-record-page) maps to the existing open* handlers, so the
 * actual dashboards still open in their own workspace tabs / routes.
 * The chrome close button dispatches `close`.
 */
export default class DashboardsHome extends LightningElement {
  get _persona() {
    // Falls back to the mockData currentUser (kept in sync by
    // setActivePersona()) so we don't need an @api plumb from
    // c-account-record-page just for this gate.
    return getPersona(currentUser.personaId);
  }

  get _capabilities() {
    return this._persona.capabilities || {};
  }

  get tiles() {
    const catalog = [
      {
        id: 'run-my-day',
        label: 'Run my day',
        meta: 'Daily cockpit',
        description:
          "Today's meetings, your action queue, and renewal alerts in one prioritized view.",
        // Visual variant drives the tile's accent + preview glyph.
        variant: 'rid-tile_runmyday',
        // Every persona lands on Run My Day, so no capability gate.
        visible: true
      },
      {
        id: 'client360',
        label: 'Client 360',
        meta: 'Account analytics',
        description:
          'Single-pane view of policies, premium, commission, claims, billing, and tasks per account.',
        variant: 'rid-tile_client360',
        visible: true
      },
      {
        id: 'revenue',
        label: 'Revenue Intelligence',
        // Meta doubles as the folder-sharing story - visible only
        // to personas whose capabilities include seeAgencyRevenue.
        meta: 'Executive folder',
        description:
          'Commissions, revenue leakage, producer leaderboard, and billing health across the book.',
        variant: 'rid-tile_revenue',
        visible: !!this._capabilities.seeAgencyRevenue
      }
    ];
    return catalog.filter((t) => t.visible);
  }

  get tilesDecorated() {
    return this.tiles.map((t) => ({
      ...t,
      cls: `dh-tile ${t.variant}`,
      openLabel: `Open ${t.label}`,
      isRunMyDay: t.id === 'run-my-day',
      isClient360: t.id === 'client360',
      isRevenue: t.id === 'revenue'
    }));
  }

  handleTileClick(event) {
    const id = event.currentTarget?.dataset?.id;
    if (!id) return;
    this.dispatchEvent(
      new CustomEvent('dashboardopen', {
        detail: { id },
        bubbles: true,
        composed: true
      })
    );
  }

  handleClose() {
    this.dispatchEvent(new CustomEvent('close'));
  }
}
