import { LightningElement, api, track } from 'lwc';
import { quotes as ALL_QUOTES } from 'data/mockData';
import { classifyLob, compareLoc } from 'data/lines';

/**
 * c-account-rfq-list - Flat list of RFQs on the Account Record Page
 * "RFQs" tab. Each row shows the RFQ name, quotes-received count,
 * status pill, and an overflow (⋮) menu whose items are driven by the
 * canonical row status. The quotes-received count is plain text on
 * every row: the ⋮ menu's "Compare Quotes" item is the single way into
 * the Quote Comparison modal, so the count never reads as a link on
 * one row and static text on the next.
 *
 * @api accountId - the account this list is scoped to.
 * @api rfqs       - array of row objects ({ id, name, lob, date, status,
 *                   applicationId, bundleId }). Quote counts are matched
 *                   per RFQ by applicationId against the shared mock
 *                   `quotes`. `bundleId` is the id of the RFQ record this
 *                   row is a line of coverage under; the referenced
 *                   record renders as the expandable parent row.
 *
 * Events:
 *   - rfqselect - RFQ name link clicked (detail: { id, name, lob, status }).
 *   - rfqaction - row ⋮ menu action chosen
 *                 (detail: { id, action, quoteIds }).
 */

// Full canonical status → SLDS 2 Badge tone modifier.
// Blueprint modifiers: slds-badge + slds-badge_lightest | slds-badge_inverse.
// Soft success/warning/info tones are applied via status-badge_* classes
// that set --slds-c-badge-* hooks (no official success/warning modifiers).
const STATUS_TONE = {
  // Draft carries no semantic colour in the org - neutral surface
  // wash + border-1 outline, not the lightest (white) modifier.
  Draft: 'status-badge_neutral',
  // Ready for Submission - eligible to bundle / route. Info feedback.
  'Ready for Submission': 'status-badge_info',
  Ready: 'status-badge_info',
  // Sent to Carrier - routed via QuinStreet. Same info feedback family.
  'Sent to Carrier': 'status-badge_info',
  'Submitted to Market': 'status-badge_info',
  Submitted: 'status-badge_info',
  Sent: 'status-badge_info',
  'Quotes Received': 'status-badge_warning',
  'Closed / Bound (Won)': 'status-badge_success',
  'Closed/Bound': 'status-badge_success'
};

// Row ⋮ menu spec per canonical status. Each entry is a list of
// { id, label, isDivider? } items rendered in order. Closed statuses
// return an empty list → the ⋮ button is suppressed by `hasMenu`.
const MENU_ITEMS_BY_STATUS = {
  Draft: [
    { id: 'edit', label: 'Edit' },
    { id: 'add_loc', label: 'Add LOC' },
    { id: 'add_to_board', label: 'Add to Submission Board' },
    { id: 'divider-1', isDivider: true },
    { id: 'delete', label: 'Delete' }
  ],
  'Ready for Submission': [
    { id: 'edit', label: 'Edit' },
    { id: 'add_loc', label: 'Add LOC' },
    { id: 'remove_from_board', label: 'Remove from Board' },
    { id: 'divider-1', isDivider: true },
    { id: 'delete', label: 'Delete' }
  ],
  // Sent to Carrier - post-routing, view-only + Delete. Editing a
  // routed RFQ isn't supported yet, so the ⋮ menu only exposes the
  // destructive fallback.
  'Sent to Carrier': [
    { id: 'delete', label: 'Delete' }
  ],
  // Legacy label kept in the menu map so any pre-normalization row
  // still surfaces a menu; the alias table below folds this into
  // 'Sent to Carrier' when canonicalStatus() runs.
  'Submitted to Market': [
    { id: 'delete', label: 'Delete' }
  ],
  'Quotes Received': [
    { id: 'compare_quotes', label: 'Compare Quotes' },
    { id: 'divider-1', isDivider: true },
    { id: 'delete', label: 'Delete' }
  ],
  'Closed / Bound (Won)': []
};

// Legacy aliases the seed / older mock rows still emit. Kept as a
// belt-and-suspenders map so a stray "Ready" row from an unmigrated
// path still lights up the right menu. Post-route rows now roll up
// into "Sent to Carrier" - the QuinStreet rating flow is the only
// path that produces them today.
const STATUS_ALIASES = {
  Ready: 'Ready for Submission',
  Submitted: 'Sent to Carrier',
  Sent: 'Sent to Carrier',
  'Submitted to Market': 'Sent to Carrier',
  'Closed/Bound': 'Closed / Bound (Won)'
};

function canonicalStatus(status) {
  if (!status) return 'Draft';
  return STATUS_ALIASES[status] || status;
}

export default class AccountRfqList extends LightningElement {
  @api accountId;

  // Rows arrive from the shell. Quote counts on a routed RFQ climb as
  // carriers respond; the count and status badge simply re-render at
  // their new values, with no highlight on the changed cell.
  @api rfqs = [];

  @track openMenuId = null;
  @track openMenuStyle = '';
  // Ids of the RFQ records whose lines of coverage are currently
  // expanded. Auto-expanded on first render (see renderedCallback) so
  // brokers see the lines without a hunt-and-click.
  @track expandedBundleIds = [];

  _docClickHandler = null;
  _dismissHandler = null;
  _autoExpandedOnce = false;

  connectedCallback() {
    // Close the row menu on any outside click.
    this._docClickHandler = (e) => {
      if (!this.openMenuId) return;
      const root = this.template.querySelector('.arl');
      if (root && !root.contains(e.target)) this._closeMenu();
    };
    document.addEventListener('click', this._docClickHandler, true);

    // The menu is position:fixed, so dismiss it on scroll/resize to avoid
    // it floating out of place.
    this._dismissHandler = () => {
      if (this.openMenuId) this._closeMenu();
    };
    window.addEventListener('scroll', this._dismissHandler, true);
    window.addEventListener('resize', this._dismissHandler, true);
  }

  disconnectedCallback() {
    if (this._docClickHandler) {
      document.removeEventListener('click', this._docClickHandler, true);
      this._docClickHandler = null;
    }
    if (this._dismissHandler) {
      window.removeEventListener('scroll', this._dismissHandler, true);
      window.removeEventListener('resize', this._dismissHandler, true);
      this._dismissHandler = null;
    }
  }

  _closeMenu() {
    this.openMenuId = null;
    this.openMenuStyle = '';
  }

  // Shared per-row decorator - takes a raw RFQ row and folds in the
  // quote-count, badge tone, and ⋮ menu shape. Every row in the table
  // is a real RFQ record, so parents, lines of coverage and
  // standalones all come through here unchanged. RFQs on the
  // Submission Board carry status "Ready for Submission" (set on Add
  // to Board), so the badge here matches that stage until Route to
  // Carriers flips them to Sent to Carrier.
  _decorateRfqRow(rfq) {
    const canonicalRowStatus = canonicalStatus(rfq.status);
    const appId = rfq.applicationId;
    // Quotes actually on file. This is what Compare Quotes opens, so
    // the menu stays keyed to it.
    const filedQuotes = appId
      ? ALL_QUOTES.filter((q) => q.applicationId === appId).length
      : 0;
    // A freshly routed RFQ carries a live count that climbs as carriers
    // respond. It wins over the filed total so the column tracks those
    // arrivals instead of jumping straight to the seeded number.
    const quotes = Number.isFinite(rfq.quoteCount)
      ? rfq.quoteCount
      : filedQuotes;
    const isMenuOpen = this.openMenuId === rfq.id;
    const tone =
      STATUS_TONE[canonicalRowStatus] ||
      STATUS_TONE[rfq.status] ||
      'slds-badge_lightest';

    // Compare Quotes keys off the count the row actually shows, so a
    // row whose quotes arrived from a live routing offers it just like
    // a seeded one. Rows created during the session carry no
    // applicationId; the modal falls back to the line's seeded quote
    // set (see handleRfqAction in c-account-record-page), so the action
    // always opens something.
    const baseMenu = MENU_ITEMS_BY_STATUS[canonicalRowStatus] || [];
    const kept = baseMenu.filter(
      (item) => item.isDivider || item.id !== 'compare_quotes' || quotes > 0
    );
    // Dropping an item can strand its divider at the top or bottom of
    // the menu, where it renders as a rule with nothing on one side.
    const menuItems = kept
      .filter(
        (item, i) =>
          !item.isDivider ||
          (kept.slice(0, i).some((x) => !x.isDivider) &&
            kept.slice(i + 1).some((x) => !x.isDivider))
      )
      .map((item, idx) =>
        item.isDivider
          ? { ...item, key: `${rfq.id}-div-${idx}` }
          : { ...item, key: `${rfq.id}-${item.id}` }
      );
    const hasMenu = menuItems.length > 0;

    return {
      id: rfq.id,
      name: rfq.name,
      lob: rfq.lob,
      // `rfq.lob` holds the LINE OF COVERAGE on an ordinary row; the
      // business it rolls up to is derived (see data/lines) so the two
      // columns can be shown separately. Bundle parents render both
      // cells empty from the template instead.
      locLabel: rfq.lob || '',
      lobLabel: classifyLob(rfq.lob),
      date: rfq.date,
      status: canonicalRowStatus,
      badgeClass: `slds-badge ${tone}`,
      quotesLabel: `${quotes} Quote${quotes === 1 ? '' : 's'}`,
      actionsLabel: `Show actions for ${rfq.name}`,
      hasQuotes: quotes > 0,
      menuItems,
      hasMenu,
      menuOpen: isMenuOpen,
      menuStyle: isMenuOpen ? this.openMenuStyle : '',
      menuBtnAria: isMenuOpen ? 'true' : 'false'
    };
  }

  get _rows() {
    return Array.isArray(this.rfqs) ? this.rfqs : [];
  }

  // ── Lines of coverage, grouped by parent record ───────────────
  // A line of coverage points at its parent RFQ record through
  // `bundleId` (stamped by the Add-Another-LOC flow in
  // c-app.handleIntakeContinue). Unlike the Submission Board - which
  // only surfaces a parent when every line is Ready for Submission -
  // the RFQs tab always groups them, regardless of status, so brokers
  // see the whole flow's history in one place. A `bundleId` that
  // resolves to no record on this account is ignored so the orphaned
  // row still renders on its own rather than disappearing.
  get _locsByParentId() {
    const rows = this._rows;
    const knownIds = new Set(rows.map((r) => r.id));
    const byParent = {};
    for (const rfq of rows) {
      const parentId = rfq.bundleId;
      if (!parentId || parentId === rfq.id || !knownIds.has(parentId)) {
        continue;
      }
      if (!byParent[parentId]) byParent[parentId] = [];
      byParent[parentId].push(rfq);
    }
    // Order the lines of coverage rather than leaving them in the order
    // Add-Another-LOC happened to mint them in. A household bundle reads
    // Personal Auto then Homeowners regardless of which the broker
    // started from, and the parent's "2 LOCs · ..." summary is built off
    // this same list so the label and the rows cannot disagree.
    for (const parentId of Object.keys(byParent)) {
      byParent[parentId].sort((a, b) => compareLoc(a.lob, b.lob));
    }
    return byParent;
  }

  // ── Unified table rows (single flat parent-child table) ──────
  // Every row is a real RFQ record. Emits three row shapes:
  //   • Bundle parent (isBundleParent) - a record that owns at least
  //     one line of coverage. Occupies the same five columns as every
  //     other row so parent and child cells stay on one grid; it owns
  //     the toggle button.
  //   • Bundle child (isBundleChild) - a line of coverage, rendered
  //     directly under its parent when expanded.
  //   • Standalone (isStandalone) - a record with no lines of
  //     coverage. Renders an empty toggle cell.
  get unifiedRows() {
    const locsByParentId = this._locsByParentId;
    const out = [];
    for (const rfq of this._rows) {
      const locs = locsByParentId[rfq.id];
      if (locs) {
        const isExpanded = this.expandedBundleIds.includes(rfq.id);
        const lobsLabel = Array.from(
          new Set(locs.map((c) => c.lob).filter(Boolean))
        ).join(' + ');
        out.push({
          ...this._decorateRfqRow(rfq),
          key: `bundle-${rfq.id}`,
          isBundleParent: true,
          bundleId: rfq.id,
          bundleName: rfq.name,
          childSummary: `${locs.length} LOC${
            locs.length === 1 ? '' : 's'
          } · ${lobsLabel}`,
          isExpanded,
          // aria-expanded drives the CSS rotation of the SVG chevron
          // (0° collapsed → 90° expanded), same anatomy the Submission
          // Board uses so both tables read identically.
          expandAria: isExpanded ? 'true' : 'false',
          parentCls: isExpanded
            ? 'arl__parent-row is-expanded'
            : 'arl__parent-row'
        });
        if (isExpanded) {
          for (const c of locs) {
            out.push({
              key: `child-${c.id}`,
              isBundleChild: true,
              ...this._decorateRfqRow(c)
            });
          }
        }
        continue;
      }
      // Rendered under its parent above, so skip the flat pass.
      if (locsByParentId[rfq.bundleId]) continue;
      out.push({
        key: `stand-${rfq.id}`,
        isStandalone: true,
        ...this._decorateRfqRow(rfq)
      });
    }
    return out;
  }

  get hasRows() {
    return this._rows.length > 0;
  }

  get countLabel() {
    const n = this._rows.length;
    return `${n} ${n === 1 ? 'item' : 'items'}`;
  }

  // Auto-expand freshly-visible parents once so the broker sees
  // the lines of coverage without a hunt-and-click. renderedCallback
  // fires every render, but the guard keeps this to one shot per
  // component lifetime.
  renderedCallback() {
    if (this._autoExpandedOnce) return;
    const ids = Object.keys(this._locsByParentId);
    if (!ids.length) return;
    // Merge in anything the broker has already toggled during this
    // render (belt-and-suspenders - normally empty on first paint).
    const merged = Array.from(new Set([...this.expandedBundleIds, ...ids]));
    if (merged.length !== this.expandedBundleIds.length) {
      this.expandedBundleIds = merged;
    }
    this._autoExpandedOnce = true;
  }

  handleBundleExpandToggle(event) {
    event.preventDefault();
    event.stopPropagation();
    const bundleId = event.currentTarget.dataset.id;
    if (!bundleId) return;
    const set = new Set(this.expandedBundleIds);
    if (set.has(bundleId)) set.delete(bundleId);
    else set.add(bundleId);
    this.expandedBundleIds = [...set];
  }

  // ── Handlers ────────────────────────────────────────────────────
  handleNameClick(event) {
    event.preventDefault();
    const id = event.currentTarget.dataset.id;
    const row = (this.rfqs || []).find((r) => r.id === id);
    if (!row) return;
    this.dispatchEvent(
      new CustomEvent('rfqselect', {
        detail: { id, name: row.name, lob: row.lob, status: row.status },
        bubbles: true,
        composed: true
      })
    );
  }

  handleMenuToggle(event) {
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    if (this.openMenuId === id) {
      this._closeMenu();
      return;
    }
    // Anchor the fixed-position menu to the trigger (right-aligned), so it
    // escapes the record card's overflow:hidden clip.
    const rect = event.currentTarget.getBoundingClientRect();
    const right = Math.max(8, Math.round(window.innerWidth - rect.right));
    const top = Math.round(rect.bottom);
    this.openMenuStyle = `top: ${top}px; right: ${right}px; left: auto;`;
    this.openMenuId = id;
  }

  handleMenuAction(event) {
    event.preventDefault();
    event.stopPropagation();
    const { id, action } = event.currentTarget.dataset;
    this._closeMenu();
    if (!id || !action) return;
    this.dispatchEvent(
      new CustomEvent('rfqaction', {
        detail: { id, action, quoteIds: [] },
        bubbles: true,
        composed: true
      })
    );
  }
}
