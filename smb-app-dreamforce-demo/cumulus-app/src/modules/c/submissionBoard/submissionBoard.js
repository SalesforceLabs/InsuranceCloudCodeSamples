import { LightningElement, api, track } from 'lwc';
import { carrierIdsWithQuotesForLoc } from 'data/mockData';
import { CARRIERS, CARRIER_LOC_LABELS } from 'data/lookupMockData';
import { classifyLob, classifyLobSet, compareLoc } from 'data/lines';
import { today } from 'data/dates';

// ── Canonical lifecycle statuses (mirrored from c/app so this
// component can stay decoupled from the app shell import graph).
const STATUS = Object.freeze({
  DRAFT: 'Draft',
  READY: 'Ready for Submission',
  SENT_TO_CARRIER: 'Sent to Carrier',
  QUOTES: 'Quotes Received',
  BOUND: 'Closed / Bound (Won)'
});
const STATUS_ALIASES = {
  Ready: STATUS.READY,
  Submitted: STATUS.SENT_TO_CARRIER,
  Sent: STATUS.SENT_TO_CARRIER,
  'Submitted to Market': STATUS.SENT_TO_CARRIER,
  'Closed/Bound': STATUS.BOUND
};
function normalizeStatus(status) {
  if (!status) return STATUS.DRAFT;
  return STATUS_ALIASES[status] || status;
}

// SLDS 2 Badge tone map (mirrored with c/accountRfqList).
// Blueprint: slds-badge + lightest/inverse. Soft feedback tones via
// status-badge_* → --slds-c-badge-* hooks (see submissionBoard.css).
const STATUS_BADGE_TONE = {
  // Draft carries no semantic colour in the org - neutral surface
  // wash + border-1 outline, not the lightest (white) modifier.
  [STATUS.DRAFT]: 'status-badge_neutral',
  [STATUS.READY]: 'status-badge_info',
  [STATUS.SENT_TO_CARRIER]: 'status-badge_info',
  [STATUS.QUOTES]: 'status-badge_warning',
  [STATUS.BOUND]: 'status-badge_success'
};

// Board holds only Ready for Submission RFQs. They appear the moment
// they're added to the board and drop off once Route to Carriers
// completes (status → Sent to Carrier). No status tags are rendered
// on the board itself - the RFQs tab carries the "Ready for
// Submission" badge for the same rows.
const BOARD_STATUSES = new Set([STATUS.READY]);

// Row ⋮ menu for board rows. Only Ready for Submission rows ever
// land here, so a single menu spec applies.
const BOARD_MENU_ITEMS = [
  { id: 'edit', label: 'Edit' },
  { id: 'add_loc', label: 'Add LOC' },
  { id: 'remove_from_board', label: 'Remove from Board' },
  { id: 'divider-1', isDivider: true },
  { id: 'delete', label: 'Delete' }
];

/**
 * c-submission-board - Multi-LOC bundle + carrier routing for an
 * account's saved RFQs.
 *
 * Extracted from the Path 1 prototype's Submission Board and grafted
 * onto the v02 Account Record Page as its own secondary tab. The
 * broker sees every Ready / Submitted RFQ for the account grouped
 * by Line of Coverage, bundles two or more Ready rows that share a
 * LOB, and routes the bundle to a set of carriers via a carrier x
 * LOC appetite matrix.
 *
 * Contract with the host (accountRecordPage):
 *   Props (all @api):
 *     - accountId     : SF-shaped id of the active account.
 *     - accountName   : Display name of the active account.
 *     - rfqs          : Array of RFQ rows for this account
 *                       ({ id, name, lob, status, date, ... }).
 *   Events (bubbled + composed so the app shell can catch them):
 *     - routebundle   : Broker confirmed the carrier picker.
 *                       Detail carries { accountId, accountName,
 *                       bundleId, lob, rfqIds, carrierIds,
 *                       carrierNames } - the shell then flips each
 *                       bundled RFQ row Ready -> Submitted and
 *                       broadcasts Quote Bot + Agentforce Slack
 *                       messages.
 */

// LOB (as stored on accountRfqs rows - which today holds the LOC
// label per the intake flow) -> appetite LOC id used by the shared
// CARRIERS catalog. Extend this map as EB / Umbrella / etc. get
// wired into the real app (Auto is first per the current scope).
const LOB_TO_LOC_ID = {
  'Personal Auto': 'pa',
  Auto:            'pa',
  Homeowners:      'home',
  Home:            'home',
  Umbrella:        'umbrella',
  Renters:         'renters',
  // EB rows store the LOC label in `lob` (Group Medical / Group
  // Dental / …). Keep the legacy product-LOB alias so older seed
  // rows still map somewhere on the appetite matrix.
  'Group Medical': 'medical',
  'Group Dental':  'dental',
  'Group Vision':  'vision',
  'Employee Benefits': 'medical',
  Medical:         'medical',
  Dental:          'dental',
  Vision:          'vision',
  Life:            'life'
};

function locIdForLob(lob) {
  if (!lob) return null;
  return LOB_TO_LOC_ID[lob] || null;
}


// Indicative premium used to sit on each carrier card, derived from the
// market bands in data/lookupMockData. It was removed: a pre-quote
// estimate reads as a price to anyone watching, and the routing
// decision is made on appetite and bind rate. The bands stay in the
// catalog for any surface that wants them later.

// Mock rating results returned by the QuinStreet integration flow
// configured in Setup ("Integrations & Preview" → Quote Provider 1).
// Numbers match the QuinStreet Auto RC1/RC2 Rating reference GIF the
// design team ships with the wizard - Progressive is the cheapest,
// Nationwide comes back with no quote (empty premium) so we can
// exercise the "carrier declined" affordance in the UI. Held as a
// module-level constant because a real integration would resolve
// this from the Flow API Name at runtime.
const QUINSTREET_QUOTES = [
  {
    id: 'progressive',
    name: 'Progressive',
    premium: '$938',
    paymentPlan: '$164.70 down + 5 payments',
    hasQuote: true
  },
  {
    id: 'branch',
    name: 'Branch',
    premium: '$1317.5',
    paymentPlan: '$219.58 down + 5 payments',
    hasQuote: true
  },
  {
    id: 'bristolWest',
    name: 'Bristol West',
    premium: '$1542.00',
    paymentPlan: '$376.80 down + 5 payments',
    hasQuote: true
  },
  {
    id: 'nationwide',
    name: 'Nationwide Insurance',
    premium: '$',
    paymentPlan: '',
    hasQuote: false
  }
];

export default class SubmissionBoard extends LightningElement {
  @api accountId;
  @api accountName;
  @api rfqs = [];

  @track selectedRfqIds = [];
  @track selectedCarrierIds = [];
  @track carrierModalOpen = false;
  @track ratingModalOpen = false;
  // 'board' - main table; 'routed' - legacy Bundle Routed
  // confirmation, still around for the appetite-modal fallback path.
  @track view = 'board';
  @track lastBundle = null;
  @track selectedQuoteId = null;
  @track expandedQuoteIds = [];
  @track openMenuId = null;
  @track openMenuStyle = '';

  // Set when the broker opens the rating modal so Cancel + Next know
  // which RFQs to transition, independent of the live selectedRfqIds
  // (the board keeps its checkboxes lit behind the overlay).
  _pendingRoutedRfqIds = [];
  _pendingRoutedLob = '';
  // Tracks which Hybrid bundle parent rows are currently expanded on
  // the board. Auto-expanded on first render (see renderedCallback)
  // so the broker doesn't have to click twice to see what's inside.
  @track expandedBundleIds = [];

  _bundleCounter = 1;
  _autoExpandedOnce = false;
  _docClickHandler = null;
  _dismissHandler = null;
  _keydownHandler = null;
  _focusRatingModal = false;

  connectedCallback() {
    this._docClickHandler = (e) => {
      if (!this.openMenuId) return;
      const root = this.template.querySelector('.sb-root');
      if (root && !root.contains(e.target)) this._closeMenu();
    };
    document.addEventListener('click', this._docClickHandler, true);
    this._dismissHandler = () => {
      if (this.openMenuId) this._closeMenu();
    };
    window.addEventListener('scroll', this._dismissHandler, true);
    window.addEventListener('resize', this._dismissHandler, true);
    // Escape closes the rating overlay. Bound at the document level
    // because focus can sit on the modal container itself, which
    // wouldn't bubble a keydown through the board's own subtree.
    this._keydownHandler = (e) => {
      if (e.key !== 'Escape' || !this.ratingModalOpen) return;
      this._closeRatingModal();
    };
    document.addEventListener('keydown', this._keydownHandler, true);
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
    if (this._keydownHandler) {
      document.removeEventListener('keydown', this._keydownHandler, true);
      this._keydownHandler = null;
    }
  }

  _closeMenu() {
    this.openMenuId = null;
    this.openMenuStyle = '';
  }

  // Ids of the RFQ records that own lines of coverage. Each renders as
  // a bundle parent row rather than a routable row of its own, so it is
  // excluded from the board's row set; routing targets its lines.
  get _locParentIds() {
    const set = new Set();
    for (const r of this.rfqs || []) {
      if (r.bundleId) set.add(r.bundleId);
    }
    return set;
  }

  // ── Row filtering ──────────────────────────────────────────
  // Board-visible = Ready for Submission only. Draft stays on the
  // RFQs tab; Sent to Carrier / Quotes / Bound never appear here.
  // Every board row is therefore routable.
  get boardRfqs() {
    const parentIds = this._locParentIds;
    return (this.rfqs || []).filter(
      (r) =>
        !parentIds.has(r.id) && BOARD_STATUSES.has(normalizeStatus(r.status))
    );
  }
  // Alias kept for callers that used to distinguish "visible" from
  // "routable". With only Ready on the board, every board row is
  // bundleable.
  get bundleableRfqs() {
    return this.boardRfqs;
  }

  // ── Hybrid bundles (Add Another LOC lineage) ──────────────
  // Rows created via the "+ Add Another Line of Coverage" flow on
  // the Review screen carry a `bundleId` holding the id of their
  // parent RFQ record (assigned in c/app handleIntakeContinue), so
  // `bundleName` is that record's own name. Bundles where every
  // child is on the board (Ready for Submission) render as
  // expandable parent rows above the LOB sections; partial bundles
  // (some Draft) stay hidden as a unit until the last sibling is
  // added to the board.
  //
  // Shape returned:
  //   [{
  //     bundleId, bundleName,
  //     children: [row...],           // all rows with this bundleId
  //     readyChildren: [row...],      // children on the board
  //     isFullyReady: bool,           // every child on the board
  //     childCount, readyCount
  //   }, ...]
  //
  // Order: newest bundle first (matches how rows are prepended to
  // accountRfqs; keeps the just-created bundle visible up top).
  get _bundleIndex() {
    const rows = this.rfqs || [];
    const nameById = {};
    for (const r of rows) nameById[r.id] = r.name;
    const byId = {};
    const order = [];
    for (const r of rows) {
      const bId = r.bundleId;
      if (!bId) continue;
      if (!byId[bId]) {
        byId[bId] = {
          bundleId: bId,
          bundleName: nameById[bId] || 'Multi-LOC Bundle',
          children: [],
          readyChildren: []
        };
        order.push(bId);
      }
      byId[bId].children.push(r);
      if (BOARD_STATUSES.has(normalizeStatus(r.status))) {
        byId[bId].readyChildren.push(r);
      }
    }
    return order.map((bId) => {
      const entry = byId[bId];
      // Same coverage order the RFQs tab uses, so a bundle reads
      // Personal Auto then Homeowners on both surfaces. This also fixes
      // the order carriers are assigned in on routing, since
      // `selectedRfqIds` is filled from `children`.
      entry.children.sort((a, b) => compareLoc(a.lob, b.lob));
      entry.readyChildren.sort((a, b) => compareLoc(a.lob, b.lob));
      const childCount = entry.children.length;
      const readyCount = entry.readyChildren.length;
      return {
        ...entry,
        childCount,
        readyCount,
        // A bundle only surfaces as a routable parent once every
        // sibling has landed on the board (Draft rows still pending
        // Save & Continue keep the parent hidden per the
        // "partial-bundle-visibility" UX rule).
        isFullyReady: childCount >= 2 && readyCount === childCount
      };
    });
  }

  // Ready-only bundles - the ones that get their own expandable
  // parent row at the top of the board.
  get readyBundles() {
    return this._bundleIndex.filter((b) => b.isFullyReady);
  }

  get hasReadyBundles() {
    return this.readyBundles.length > 0;
  }

  // Set of rfqIds that belong to a Ready bundle. Used to strip
  // those rows out of the LOB sections below (they render inside
  // the bundle parent instead).
  get _readyBundleRfqIds() {
    const set = new Set();
    for (const b of this.readyBundles) {
      for (const c of b.children) set.add(c.id);
    }
    return set;
  }

  // All Ready for Submission rows on the board. Retained as
  // `readyRfqs` for callers that historically distinguished
  // Ready-canonical rows; with only Ready on the board this set
  // matches `boardRfqs`.
  get readyRfqs() {
    return this.boardRfqs;
  }

  get hasBundleableRfqs() {
    return this.boardRfqs.length > 0;
  }

  // Rows that render in the LOB sections. Excludes any row that
  // belongs to a fully-Ready Hybrid bundle (those live inside the
  // bundle parent above). Partial-bundle Ready rows DO appear here
  // so brokers can still route them individually if they choose.
  get standaloneBundleableRfqs() {
    const inReadyBundle = this._readyBundleRfqIds;
    return this.boardRfqs.filter((r) => !inReadyBundle.has(r.id));
  }

  get readyCount() {
    return this.readyRfqs.length;
  }

  get readyCountLabel() {
    const n = this.readyCount;
    return `${n} Ready`;
  }

  // ── Bundling state ─────────────────────────────────────────
  get hasSelectedRfqs() {
    return this.selectedRfqIds.length > 0;
  }
  get noSelectedRfqs() {
    return !this.hasSelectedRfqs;
  }

  // Locks the bundle's LOB to whichever Ready RFQ the broker
  // picked first. Cross-LOB rows get disabled until the broker
  // clears the selection - UNLESS a Hybrid bundle is in the mix,
  // in which case the multi-LOC lock takes over and the same-LOB
  // rule is bypassed (see activeHybridBundleId).
  get activeBundleLob() {
    if (!this.selectedRfqIds.length) return null;
    // Hybrid bundles are inherently multi-LOC, so we suppress the
    // same-LOB lock when the current selection sits inside one.
    if (this.activeHybridBundleId) return null;
    const first = this.bundleableRfqs.find(
      (r) => r.id === this.selectedRfqIds[0]
    );
    return first ? first.lob || null : null;
  }
  // Hybrid bundle currently anchoring the selection. When set, any
  // row outside this bundle is disabled - bundles route as a
  // package, mixing with standalones would blur the mental model.
  // Only FULLY-READY bundles count as anchors here; partial-bundle
  // Ready rows fall back to the same-LOB rule so they can still be
  // combined with same-LOB standalone RFQs ad-hoc. If the selection
  // doesn't touch a Ready bundle, this is null and the same-LOB rule
  // takes over.
  get activeHybridBundleId() {
    const readyBundleIdSet = new Set(this.readyBundles.map((b) => b.bundleId));
    for (const id of this.selectedRfqIds) {
      const r = this.bundleableRfqs.find((x) => x.id === id);
      if (r?.bundleId && readyBundleIdSet.has(r.bundleId)) return r.bundleId;
    }
    return null;
  }

  // Stable CTA label. Selection state is carried by the row
  // checkboxes themselves rather than being counted back in copy, so
  // the button always reads exactly "Submit to carriers".
  get bundleCtaLabel() {
    return 'Submit to carriers';
  }

  // ── Grouped view-model ─────────────────────────────────────
  // Build the LOB-grouped structure the template renders. Each
  // group carries a header (LOB + counts), a per-section select-all,
  // and decorated rows with isSelected / isDisabled / disabledHint
  // flags so the template stays logic-free.
  //
  // Note: rows that belong to a fully-Ready Hybrid bundle are
  // filtered out at the source (standaloneBundleableRfqs) - those
  // render inside the expandable bundle parent above the LOB
  // sections. Rows from partial bundles still appear here as flat
  // standalone entries with their normal status pill.
  get rfqGroups() {
    const groups = {};
    const order = [];
    for (const r of this.standaloneBundleableRfqs) {
      const lob = r.lob || 'Unknown';
      if (!groups[lob]) {
        groups[lob] = [];
        order.push(lob);
      }
      groups[lob].push(r);
    }
    const activeLob = this.activeBundleLob;
    const activeBundle = this.activeHybridBundleId;
    return order.map((lob) => {
      const items = groups[lob];
      const rows = items.map((r) => this._decorateBoardRow(r, {
        activeLob,
        activeBundle,
        lob,
        rowCls: 'sb-row'
      }));
      const selectableInGroup = rows.filter((r) => !r.isDisabled);
      const selectedInGroup = selectableInGroup.filter((r) => r.isSelected);
      const allSelected =
        selectableInGroup.length > 0 &&
        selectedInGroup.length === selectableInGroup.length;
      // Count Ready rows for the section eyebrow. Board only holds
      // Ready for Submission, so this is just the group size.
      const readyCount = items.length;
      const countParts = readyCount
        ? [`${readyCount} Ready`]
        : ['0 Ready'];
      const isActive = activeLob === lob;
      const isMuted = !!activeLob && !isActive;
      return {
        id: `sb-lob-${lob.replace(/\s+/g, '-').toLowerCase()}`,
        lob,
        rows,
        allSelected,
        showSelectAll: selectableInGroup.length > 1,
        countLabel: countParts.join(' · '),
        sectionCls: [
          'sb-lob-section',
          isActive ? 'is-active-bundle' : '',
          isMuted ? 'is-muted-bundle' : ''
        ].filter(Boolean).join(' ')
      };
    });
  }

  // Shared row decoration used by both LOB-section rows and Hybrid
  // bundle child rows. Handles the disable rules (Hybrid-bundle
  // lock and same-LOB lock only - every board row is routable
  // regardless of canonical status), the status pill class, and
  // the unified board ⋮ menu spec.
  _decorateBoardRow(r, {
    activeLob,
    activeBundle,
    lob = null,
    rowCls = 'sb-row',
    extraDisable = null
  }) {
    const canonical = normalizeStatus(r.status);
    const isSelected = this.selectedRfqIds.includes(r.id);
    let isDisabled = false;
    let disabledHint = '';
    if (extraDisable) {
      isDisabled = !!extraDisable.isDisabled;
      disabledHint = extraDisable.disabledHint || '';
    } else if (activeBundle) {
      isDisabled = !r.bundleId || r.bundleId !== activeBundle;
      if (isDisabled) {
        disabledHint = 'A Hybrid bundle is selected. Clear it to pick standalone RFQs.';
      }
    } else if (lob != null && activeLob && activeLob !== lob && !isSelected) {
      isDisabled = true;
      disabledHint = `Different LOB - clear the ${activeLob} selection first`;
    }
    const menuItems = BOARD_MENU_ITEMS.map((item, idx) =>
      item.isDivider
        ? { ...item, key: `${r.id}-div-${idx}` }
        : { ...item, key: `${r.id}-${item.id}` }
    );
    const hasMenu = menuItems.length > 0;
    const isMenuOpen = this.openMenuId === r.id;
    return {
      ...r,
      // `r.lob` has always held the LINE OF COVERAGE on an ordinary
      // row; the business it belongs to is derived (see data/lines) so
      // the two columns can be shown separately.
      locLabel: r.lob || '',
      lobLabel: classifyLob(r.lob),
      canonicalStatus: canonical,
      statusLabel: canonical,
      isSelected,
      isDisabled,
      // Every board row is checkbox-enabled - the board holds only
      // pre-routed RFQs and the rule is "stay here until routed",
      // so there's no status-based reason to gate the affordance.
      // Bundle / LOB locks still disable specific rows when the
      // broker's current selection is anchored elsewhere.
      showCheckbox: true,
      checkboxDisabled: isDisabled,
      disabledHint,
      rowCls: [
        rowCls,
        isSelected ? 'is-selected' : '',
        isDisabled ? 'is-disabled' : ''
      ].filter(Boolean).join(' '),
      statusCls: [
        'slds-badge',
        STATUS_BADGE_TONE[canonical] || 'slds-badge_lightest'
      ].join(' '),
      menuItems,
      hasMenu,
      menuOpen: isMenuOpen,
      menuStyle: isMenuOpen ? this.openMenuStyle : '',
      menuBtnAria: isMenuOpen ? 'true' : 'false'
    };
  }

  // ── Hybrid bundle view-model (parent + child rows) ────────
  // Decorates every fully-Ready bundle with the expander state,
  // parent-row selection flags, and child rows shaped like LOB
  // rows so the template can reuse the .sb-row anatomy. Only
  // returns bundles whose every child is Ready; partial bundles
  // stay hidden per the visibility rule.
  get hybridBundleGroups() {
    const activeBundle = this.activeHybridBundleId;
    const activeLob = this.activeBundleLob;
    return this.readyBundles.map((b) => {
      const isExpanded = this.expandedBundleIds.includes(b.bundleId);
      const isActive = activeBundle === b.bundleId;
      // Any other selection state (a different bundle or a
      // standalone LOB lock) mutes this parent so the broker can't
      // mix contexts. Clearing the selection wakes it back up.
      const isMuted =
        (!!activeBundle && activeBundle !== b.bundleId) ||
        (!isActive && !!activeLob);
      const isFullyChecked =
        b.children.every((c) => this.selectedRfqIds.includes(c.id));
      const isPartiallyChecked =
        !isFullyChecked &&
        b.children.some((c) => this.selectedRfqIds.includes(c.id));
      const lobList = Array.from(
        new Set(b.children.map((c) => c.lob).filter(Boolean))
      );
      const lobsLabel = lobList.join(' + ');
      // Child rows use the same decoration shape as LOB rows so
      // the template can share the row markup. Every board row is
      // routable per the pre-routing visibility rule, so the only
      // disable reasons here are cross-bundle / standalone-vs-
      // bundle conflicts driven by the current selection.
      const rows = b.children.map((r) => {
        let bundleDisable = null;
        if (activeBundle && activeBundle !== b.bundleId) {
          bundleDisable = {
            isDisabled: true,
            disabledHint: 'Another bundle is selected. Clear it first.'
          };
        } else if (!activeBundle && activeLob) {
          bundleDisable = {
            isDisabled: !this.selectedRfqIds.includes(r.id),
            disabledHint: 'A standalone selection is active. Clear it first.'
          };
        }
        return this._decorateBoardRow(r, {
          activeLob,
          activeBundle,
          lob: null,
          rowCls: 'sb-row sb-row_bundle-child',
          extraDisable: bundleDisable
        });
      });
      return {
        bundleId: b.bundleId,
        bundleName: b.bundleName,
        lobsLabel,
        countLabel: `${b.readyCount} Ready`,
        childSummary: `${b.childCount} LOCs · ${lobsLabel}`,
        rows,
        isExpanded,
        isFullyChecked,
        isPartiallyChecked,
        // SLDS tree-grid expander state - `expandAria` drives the
        // aria-expanded attribute (which the CSS uses to rotate the
        // chevron 90° into a "chevrondown" state); `expandLabel`
        // carries the human-readable action.
        expandAria: isExpanded ? 'true' : 'false',
        expandLabel: isExpanded ? 'Collapse bundle' : 'Expand bundle',
        parentDisabled:
          !!activeBundle && activeBundle !== b.bundleId
            ? true
            : !!activeLob && !isActive,
        parentCls: [
          'sb-bundle',
          isExpanded ? 'is-expanded' : '',
          isActive ? 'is-active-bundle' : '',
          isMuted ? 'is-muted-bundle' : ''
        ].filter(Boolean).join(' ')
      };
    });
  }

  // ── Unified table rows (single flat parent-child table) ────
  // The board renders every board-visible RFQ inside a single
  // <table>. Rows come in three flavors:
  //   1. Bundle parent row (bundleParent=true) - one per fully-
  //      Ready Hybrid bundle. Renders an expand caret + a bundle-
  //      wide select-all checkbox + a colspan cell with the
  //      bundle name and child summary.
  //   2. Bundle child row (bundleChild=true) - rendered directly
  //      under its parent when the parent is expanded. Uses the
  //      standard per-row anatomy with a subtle indent so the
  //      parent-child relationship reads visually.
  //   3. Standalone row (standalone=true) - any board-visible RFQ
  //      that isn't part of a fully-Ready Hybrid bundle. Rendered
  //      as a flat row in the same table.
  // No LOB sub-tables and no per-row ⋮ menu - a clean unified
  // list per the visual guidance.
  get unifiedRows() {
    const bundles = this.hybridBundleGroups;
    const readyBundleIdSet = new Set(this.readyBundles.map((b) => b.bundleId));
    const out = [];
    // Bundle parent + (optional) child rows.
    for (const b of bundles) {
      out.push({
        key: `bundle-${b.bundleId}`,
        isBundleParent: true,
        bundleParentCls: b.isExpanded
          ? 'sb-tr sb-tr_bundle is-expanded'
          : 'sb-tr sb-tr_bundle',
        bundleId: b.bundleId,
        bundleName: b.bundleName,
        childSummary: b.childSummary,
        expandAria: b.expandAria,
        expandLabel: b.expandLabel,
        isExpanded: b.isExpanded,
        isFullyChecked: b.isFullyChecked,
        parentDisabled: b.parentDisabled
      });
      if (b.isExpanded) {
        for (const c of b.rows) {
          out.push({
            key: `child-${c.id}`,
            isBundleChild: true,
            ...c
          });
        }
      }
    }
    // Standalone rows - anything not inside a fully-Ready bundle.
    for (const r of this.standaloneBundleableRfqs) {
      if (r.bundleId && readyBundleIdSet.has(r.bundleId)) continue;
      const activeLob = this.activeBundleLob;
      const activeBundle = this.activeHybridBundleId;
      const decorated = this._decorateBoardRow(r, {
        activeLob,
        activeBundle,
        lob: r.lob,
        rowCls: 'sb-tr sb-tr_standalone'
      });
      out.push({
        key: `stand-${r.id}`,
        isStandalone: true,
        ...decorated
      });
    }
    return out;
  }

  get hasUnifiedRows() {
    return this.unifiedRows.length > 0;
  }

  // Auto-expand freshly-visible bundles once so the broker sees
  // what's inside without a hunt-and-click. renderedCallback fires
  // every render, but the guard keeps it a one-shot per bundle.
  renderedCallback() {
    // `indeterminate` is a property with no attribute equivalent, so a
    // partial carrier selection has to be pushed onto the element after
    // every render. This sits above the one-shot guard below on purpose.
    const selectAll = this.template.querySelector(
      '[data-select-all-carriers]'
    );
    if (selectAll) {
      const picked = this._pickedCarrierCount;
      selectAll.indeterminate =
        picked > 0 && picked < this._selectableCarrierIds.length;
    }

    if (this._focusRatingModal && this.ratingModalOpen) {
      const container = this.template.querySelector(
        '.sb-rating-modal__container'
      );
      if (container) {
        this._focusRatingModal = false;
        container.focus();
      }
    }
    if (this._autoExpandedOnce) return;
    const ids = this.readyBundles.map((b) => b.bundleId);
    if (!ids.length) return;
    this._autoExpandedOnce = true;
    this.expandedBundleIds = ids;
  }

  // ── Selection handlers ─────────────────────────────────────
  handleRfqToggle(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    // Every board row is routable per the pre-routing visibility
    // rule, so any board-visible row can enter selectedRfqIds.
    // Bundle / LOB locks still block the toggle when the current
    // selection is anchored to a different bundle or LOB.
    const row = this.boardRfqs.find((r) => r.id === id);
    if (!row) return;
    const currentlySelected = this.selectedRfqIds.includes(id);
    if (!currentlySelected) {
      const activeBundle = this.activeHybridBundleId;
      if (activeBundle) {
        if (!row.bundleId || row.bundleId !== activeBundle) return;
      } else if (row.bundleId) {
        // First bundle click - allowed; the bundle lock kicks in
        // on subsequent selections.
      } else {
        const lockedLob = this.activeBundleLob;
        if (lockedLob && row.lob !== lockedLob) return;
      }
    }
    const set = new Set(this.selectedRfqIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    this.selectedRfqIds = [...set];
  }

  // Parent-bundle checkbox on a fully-Ready Hybrid bundle. Toggles
  // ALL of that bundle's children in one shot. If the bundle is
  // currently blocked by a competing selection (a different bundle
  // or a same-LOB lock), we no-op - the row is also rendered as
  // disabled so this is defence-in-depth.
  handleBundleToggle(event) {
    const bundleId = event.currentTarget.dataset.bundleId;
    if (!bundleId) return;
    const bundle = this.readyBundles.find((b) => b.bundleId === bundleId);
    if (!bundle) return;
    const active = this.activeHybridBundleId;
    if (active && active !== bundleId) return;
    if (!active && this.activeBundleLob) return;
    const set = new Set(this.selectedRfqIds);
    const childIds = bundle.children.map((c) => c.id);
    const allIn = childIds.every((id) => set.has(id));
    if (allIn) {
      for (const id of childIds) set.delete(id);
    } else {
      for (const id of childIds) set.add(id);
    }
    this.selectedRfqIds = [...set];
  }

  // Expand / collapse the child list under a bundle parent row.
  // Selection state is orthogonal to expand state - collapsing
  // doesn't clear the checkbox, it just hides the child rows.
  handleBundleExpandToggle(event) {
    const bundleId = event.currentTarget.dataset.bundleId;
    if (!bundleId) return;
    const set = new Set(this.expandedBundleIds);
    if (set.has(bundleId)) set.delete(bundleId);
    else set.add(bundleId);
    this.expandedBundleIds = [...set];
  }

  handleLobSelectAll(event) {
    const lob = event.currentTarget.dataset.lob;
    if (!lob) return;
    const groupRows = this.bundleableRfqs.filter((r) => r.lob === lob);
    if (!groupRows.length) return;
    const set = new Set(this.selectedRfqIds);
    const allCurrentlyIn = groupRows.every((r) => set.has(r.id));
    if (allCurrentlyIn) {
      for (const r of groupRows) set.delete(r.id);
    } else {
      const active = this.activeBundleLob;
      if (active && active !== lob) {
        set.clear();
      }
      for (const r of groupRows) set.add(r.id);
    }
    this.selectedRfqIds = [...set];
  }

  // ── Row ⋮ menu ─────────────────────────────────────────────
  // Mirrors the RFQs-tab menu but only surfaces the actions
  // permitted on the board per canonical status. Emits the same
  // `rfqaction` event upstream so the app shell can mutate
  // accountRfqs centrally (Draft ↔ Ready ↔ Sent to Carrier ↔
  // Quotes ↔ Closed / Delete).
  handleMenuToggle(event) {
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    if (this.openMenuId === id) {
      this._closeMenu();
      return;
    }
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

  // ── Route to Carriers CTA ──────────────────────────────────
  // The footer CTA opens the QuinStreet rating results as a modal
  // over the board - the carrier appetite matrix modal is skipped
  // because Setup's Integrations & Preview step already defines
  // which quote provider (and via that provider, which downstream
  // carriers) fulfils the routing. The old modal handlers below are
  // kept as unreachable code so a future flow (e.g. a non-QuinStreet
  // provider that still needs a broker-side picker) can restore
  // them without rewriting the pipeline.
  //
  // Dummy stand-ins for the carrier accounts configured in Setup →
  // Integrations & Preview. A real org would resolve these from the
  // selected quote-provider connection; until that wiring lands we
  // pick a credible, category-appropriate short-list per parent LOB
  // and toast the configured names so the broker sees realistic copy.
  //
  // Keys must match the category labels emitted by `classifyLobSet`
  // (see data/lines).
  static CARRIER_ACCOUNTS_BY_CATEGORY = {
    'Personal Lines': [
      'Progressive',
      'Travelers',
      'Nationwide',
      'Liberty Mutual',
      'Safeco'
    ],
    'Employee Benefits': [
      'UnitedHealthcare',
      'Aetna',
      'Cigna',
      'Anthem BlueCross',
      'MetLife'
    ],
    'Commercial Lines': [
      'Travelers',
      'The Hartford',
      'Chubb',
      'Liberty Mutual',
      'CNA'
    ]
  };
  // Fallback list for Multi-line bundles / unknown LOBs. Kept short
  // and deliberately neutral so the toast still reads cleanly.
  static CONFIGURED_ACCOUNT_NAMES = [
    'Pacific Underwriters',
    'Summit Mutual'
  ];

  // Resolve the carrier account short-list for a given routed
  // set. `childLobs` is an array of raw child LOB strings from the
  // routed rows; we classify into a category and look up.
  static _carriersForRouted(childLobs) {
    const category = classifyLobSet(childLobs);
    const map = SubmissionBoard.CARRIER_ACCOUNTS_BY_CATEGORY;
    if (category && map[category]) return [...map[category]];
    return [...SubmissionBoard.CONFIGURED_ACCOUNT_NAMES];
  }

  // Route to Carriers CTA → the carrier appetite matrix. The broker
  // picks which carriers receive the selection there, and
  // handleConfirmRoute does the actual routing. Columns on the matrix
  // are derived from the LOCs the selection spans (bundleLocIds), so
  // a Renters row shows a Renters column, an Auto row shows Auto, and
  // an Auto + Home selection shows both.
  handleOpenCarrierModal() {
    if (this.noSelectedRfqs) return;
    this.selectedCarrierIds = [];
    this.carrierModalOpen = true;
  }

  handleCloseCarrierModal() {
    this.carrierModalOpen = false;
  }
  handleModalBackdrop(event) {
    if (event.target === event.currentTarget) {
      this.handleCloseCarrierModal();
    }
  }
  handleModalStop(event) {
    event.stopPropagation();
  }

  // Unique LOC ids the bundle spans (in insertion order). Drives
  // the matrix columns + the appetite-coverage check per carrier.
  // Multi-LOC bundles produce >1 entry; a same-LOB bundle where
  // every row is Personal Auto collapses to ['pa'].
  get bundleLocIds() {
    const ordered = [];
    for (const id of this.selectedRfqIds) {
      const r = this.bundleableRfqs.find((x) => x.id === id);
      if (!r) continue;
      const locId = locIdForLob(r.lob);
      if (locId && !ordered.includes(locId)) ordered.push(locId);
    }
    return ordered;
  }

  // Carriers that can actually answer on ONE line, as opposed to the
  // union `carrierCards` renders for the whole bundle. Routing a
  // Home + Auto bundle to every card would otherwise submit the auto
  // line to a property-only market: the union is four carriers, but
  // only three of them write auto and only three write home.
  //
  // Mirrors `carrierCards`' two-step narrowing (appetite, then markets
  // with a quote on file) including its escape hatch, so a line with no
  // seeded quotes still routes somewhere rather than silently dropping
  // every carrier the broker picked.
  _carrierIdsForLoc(locId) {
    if (!locId) return [];
    const inAppetite = CARRIERS.filter((c) =>
      (Array.isArray(c.appetite) ? c.appetite : []).includes(locId)
    );
    const quotable = new Set(carrierIdsWithQuotesForLoc(locId));
    const withQuotes = inAppetite.filter((c) => quotable.has(c.id));
    return (withQuotes.length ? withQuotes : inAppetite).map((c) => c.id);
  }

  // The carrier currently on risk for the bundle being routed. RFQs
  // created from a prior policy carry `priorCarrier` (the structured
  // field the intake captures); `priorPolicy` is the free-text label
  // it came from (e.g. "2025 Mavericks Auto - Apex Mutual") and is
  // only a fallback. Returns null for a from-scratch RFQ, which is
  // why the tag is absent on new business rather than guessed at.
  //
  // Matching on name is good enough because the intake's carrier
  // type-ahead is seeded from this same catalog. A real
  // implementation would persist a carrier id on the RFQ.
  get incumbentCarrierId() {
    const priorText = this.selectedRfqIds
      .map((id) => {
        const r = this.bundleableRfqs.find((x) => x.id === id);
        if (!r) return '';
        return r.priorCarrier || r.priorPolicy || '';
      })
      .filter(Boolean)
      .join(' | ')
      .toLowerCase();
    if (!priorText) return null;
    const hit = CARRIERS.find((c) =>
      priorText.includes(String(c.name).toLowerCase())
    );
    return hit ? hit.id : null;
  }

  // One selectable card per carrier, narrowed to the markets that
  // actually write the bundled lines - routing an auto bundle should
  // only offer auto carriers, so appetite is a filter rather than a
  // column of dashes on carriers the broker can't use.
  //
  // Appetite filters on ANY bundled line, not all of them, so a market
  // that writes only one line of a two-line bundle still earns a card
  // and reports "1 of 2 lines". That partial coverage is the primary
  // thing separating one card from another, alongside how fast the
  // market responds. The per-line breakdown only renders on multi-line
  // bundles, where it actually varies.
  //
  // The incumbent sorts to the top: a renewal conversation starts
  // from whether the current market still wants the risk, so it
  // should be the first card the broker sees rather than something
  // they hunt for alphabetically.
  get carrierCards() {
    const bundleLocs = this.bundleLocIds;
    const incumbentId = this.incumbentCarrierId;
    // A bundle with no rows selected can't be appetite-filtered, so
    // fall back to the whole catalog instead of an empty matrix.
    const inAppetite = bundleLocs.length
      ? CARRIERS.filter((c) =>
          (Array.isArray(c.appetite) ? c.appetite : []).some((locId) =>
            bundleLocs.includes(locId)
          )
        )
      : [...CARRIERS];
    // Narrow again to carriers that can actually return a quote on the
    // bundled lines. Without this the broker could route to a market
    // with no quotes on file, and the comparison grid would come back
    // a column short of the count the RFQ row advertises.
    const quotable = new Set(
      bundleLocs.flatMap((locId) => carrierIdsWithQuotesForLoc(locId))
    );
    const withQuotes = inAppetite.filter((c) => quotable.has(c.id));
    // EB carriers have no quotes seeded against them yet, so the
    // restriction would empty the picker and block routing outright.
    // Until that data exists the unrestricted list stands in.
    const offered = withQuotes.length ? withQuotes : inAppetite;

    const ordered = incumbentId
      ? [
          ...offered.filter((c) => c.id === incumbentId),
          ...offered.filter((c) => c.id !== incumbentId)
        ]
      : offered;
    // Per-line coverage only earns space when the bundle spans more
    // than one line; on a standalone routing it is a constant.
    const showCoverage = bundleLocs.length > 1;

    return ordered.map((c) => {
      const appetite = Array.isArray(c.appetite) ? c.appetite : [];
      // Only the lines this market actually writes get a pill. A struck
      // -through pill for a line it declines reads as a coverage the
      // broker lost rather than one that was never on offer, and the
      // "N of M lines" stat below already carries the shortfall.
      const coveredLines = bundleLocs
        .filter((locId) => appetite.includes(locId))
        .map((locId) => ({
          key: `${c.id}-${locId}`,
          label: CARRIER_LOC_LABELS[locId] || locId
        }));
      const coveredCount = coveredLines.length;
      const totalLocs = bundleLocs.length;
      const isFullCover = totalLocs > 0 && coveredCount === totalLocs;
      const isNoCover = coveredCount === 0;
      const isSelected = this.selectedCarrierIds.includes(c.id);
      const isIncumbent = c.id === incumbentId;
      return {
        id: c.id,
        name: c.name,
        initial: c.initial,
        logoStyle: `background:${c.logoColor}`,
        // Whole number; the stat term carries the % sign.
        bindRateLabel:
          typeof c.bindSuccessRate === 'number'
            ? String(c.bindSuccessRate)
            : 'Not published',
        // The pill row sits in the head's flex gap, so it has to be
        // absent rather than empty when a carrier earns no pill.
        hasTags: isIncumbent,
        showCoverage,
        coveredLines,
        // Pills need BOTH conditions: a multi-line bundle (on a single
        // line every card would show the same lone pill) and at least
        // one covered line, since a no-cover market now yields none and
        // an empty <ul> would still take the row's gap.
        showLinePills: showCoverage && coveredLines.length > 0,
        coverageLabel: totalLocs
          ? `${coveredCount} of ${totalLocs} lines`
          : '-',
        coverageTone: [
          'sb-card__stat-value',
          isNoCover ? 'is-none' : isFullCover ? 'is-full' : 'is-partial'
        ].join(' '),
        isNoCover,
        isFullCover,
        isSelected,
        isIncumbent,
        checkboxId: `sb-carrier-pick-${c.id}`,
        selectLabel: `Route this bundle to ${c.name}`,
        cardCls: [
          'sb-card',
          isSelected ? 'is-selected' : '',
          isNoCover ? 'is-no-cover' : ''
        ].filter(Boolean).join(' ')
      };
    });
  }

  // Carriers the broker can actually pick. No-cover cards are inert, so
  // Select All must not count or tick them - otherwise the header would
  // claim "3 of 4" and never reach a fully-checked state.
  get _selectableCarrierIds() {
    return this.carrierCards.filter((c) => !c.isNoCover).map((c) => c.id);
  }

  get _pickedCarrierCount() {
    const selectable = this._selectableCarrierIds;
    return this.selectedCarrierIds.filter((id) => selectable.includes(id))
      .length;
  }

  get allCarriersSelected() {
    const total = this._selectableCarrierIds.length;
    return total > 0 && this._pickedCarrierCount === total;
  }

  get carrierSelectionSummary() {
    return `${this._pickedCarrierCount} of ${this._selectableCarrierIds.length} selected`;
  }

  // Routing to every market is a deliberate choice, not the default, so
  // this only ever reflects what the broker has ticked. Nothing seeds
  // it selected on open.
  handleSelectAllCarriers(event) {
    this.selectedCarrierIds = event.target.checked
      ? this._selectableCarrierIds
      : [];
  }

  get cannotConfirmRoute() {
    return this.selectedCarrierIds.length === 0;
  }

  _toggleCarrier(id) {
    const card = this.carrierCards.find((r) => r.id === id);
    if (card && card.isNoCover) return;
    const set = new Set(this.selectedCarrierIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    this.selectedCarrierIds = [...set];
  }

  // Clicking anywhere on the row toggles it - the whole row is a
  // convenient hit target in a wide matrix.
  handleCarrierToggle(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this._toggleCarrier(id);
  }

  // The pick cell hosts a real checkbox, which owns the keyboard and
  // screen-reader semantics for the row. Its own click is stopped
  // from bubbling (see handleCarrierPickClick) so the row handler
  // above doesn't immediately undo the state change it just made.
  handleCarrierCheckbox(event) {
    const id = event.target.dataset.id;
    if (!id) return;
    this._toggleCarrier(id);
  }

  handleCarrierPickClick(event) {
    event.stopPropagation();
  }

  handleConfirmRoute() {
    if (this.cannotConfirmRoute) return;
    const routedRfqIds = [...this.selectedRfqIds];
    const routedCarrierIds = [...this.selectedCarrierIds];
    const rfqSet = new Set(routedRfqIds);
    const bundledRfqs = this.bundleableRfqs
      .filter((r) => rfqSet.has(r.id))
      .map((r) => ({ ...r }));
    const bundledCarriers = routedCarrierIds.map((id, idx) => {
      const c = CARRIERS.find((x) => x.id === id) || { id };
      return { ...c, order: idx + 1 };
    });
    // Split the one selection into what each line was actually
    // submitted to. The picker offers the union of the bundled lines,
    // so "Select All" on a Home + Auto bundle means "every market that
    // writes either line" - not "every market writes both". Narrowing
    // per line here is what lets the quote count, the notifications and
    // the comparison grid all name the right markets downstream.
    const assignments = bundledRfqs.map((r) => {
      const locId = locIdForLob(r.lob);
      const eligible = new Set(this._carrierIdsForLoc(locId));
      const forLine = eligible.size
        ? routedCarrierIds.filter((id) => eligible.has(id))
        : [...routedCarrierIds];
      return {
        rfqId: r.id,
        rfqName: r.name,
        lob: r.lob,
        locId,
        carrierIds: forLine,
        carrierNames: forLine.map(
          (id) => CARRIERS.find((x) => x.id === id)?.name || id
        )
      };
    });
    const bundleId = `BR-${String(this._bundleCounter).padStart(3, '0')}`;
    this._bundleCounter += 1;
    // If this routing came from a Hybrid bundle (activeHybridBundleId
    // set), surface the bundle name so the routed-confirmation view
    // + Slack broadcast can name the multi-LOC package instead of a
    // bare "Personal Auto" LOB. For pure standalone routings we fall
    // back to the LOB string.
    const activeHybrid = this.activeHybridBundleId;
    const hybridEntry = activeHybrid
      ? this.readyBundles.find((b) => b.bundleId === activeHybrid)
      : null;
    const routedLobLabel = hybridEntry
      ? hybridEntry.lobsLabel
      : (this.activeBundleLob || '');
    const bundleDisplayName = hybridEntry
      ? hybridEntry.bundleName
      : null;
    this.lastBundle = {
      bundleId,
      account: this.accountName,
      accountId: this.accountId,
      lob: routedLobLabel,
      hybridBundleId: activeHybrid,
      hybridBundleName: bundleDisplayName,
      rfqs: bundledRfqs,
      carriers: bundledCarriers,
      routedAt: today().toISOString()
    };

    // Ask the host to flip each bundled RFQ Ready -> Submitted and
    // fire the Slack broadcast. The board itself is a controlled
    // component - it never mutates the incoming rfqs list directly.
    this.dispatchEvent(
      new CustomEvent('routebundle', {
        detail: {
          accountId: this.accountId,
          accountName: this.accountName,
          bundleId,
          lob: routedLobLabel,
          // Hybrid-bundle metadata: null for standalone routings.
          // The app shell uses this to enrich Slack messages ("Auto
          // + Homeowners renewal for Mavericks Household" vs the
          // bare "Personal Auto RFQ").
          hybridBundleId: activeHybrid,
          hybridBundleName: bundleDisplayName,
          rfqIds: routedRfqIds,
          carrierIds: routedCarrierIds,
          carrierNames: bundledCarriers.map((c) => c.name || c.id),
          locIds: this.bundleLocIds,
          // Per-line breakdown of the same routing. `carrierIds` above
          // stays the flat union for the toast and the confirmation
          // view; anything that has to be right per line reads this.
          assignments
        },
        bubbles: true,
        composed: true
      })
    );

    this.selectedRfqIds = [];
    this.selectedCarrierIds = [];
    this.carrierModalOpen = false;
    // Stay on the board. The routed rows flip to Sent to Carrier and
    // drop off on their own, and the app shell's toast ("RFQ has been
    // submitted to <carriers>") is the journey end.
    this._restoreBoardFocus();
  }

  // ── Routed-view flags + view-model ─────────────────────────
  get isBoardView() {
    return this.view === 'board';
  }
  get isRoutedView() {
    return this.view === 'routed' && !!this.lastBundle;
  }

  // ── Rating modal (QuinStreet Auto RC1/RC2) ─────────────────
  // Title matches the design GIF verbatim. Long-term this can be
  // driven by the Flow API Name configured on the Setup provider
  // (e.g. "BIB Quinstreet Home Mock") - for now the mock always
  // renders Auto RC1/RC2 regardless of the routed LOB.
  get ratingScreenTitle() {
    return 'QuinStreet Auto RC1/RC2 Rating';
  }

  get ratingQuoteRows() {
    return QUINSTREET_QUOTES.map((q) => {
      const isSelected = this.selectedQuoteId === q.id;
      const isExpanded = this.expandedQuoteIds.includes(q.id);
      // Details are derived from the quote itself rather than a
      // separate payload - the mock carries no per-coverage
      // breakdown, so we surface what the rating call did return
      // and say so plainly when the carrier declined.
      const detailRows = q.hasQuote
        ? [
            { key: `${q.id}-premium`, label: 'Total premium', value: q.premium },
            {
              key: `${q.id}-plan`,
              label: 'Payment plan',
              value: q.paymentPlan || 'Paid in full'
            },
            { key: `${q.id}-term`, label: 'Term', value: '6 months' }
          ]
        : [];
      return {
        ...q,
        isSelected,
        showPaymentPlan: !!q.paymentPlan,
        detailsId: `sb-rating-details-${q.id}`,
        detailsExpanded: isExpanded,
        detailsAria: isExpanded ? 'true' : 'false',
        detailsLabel: isExpanded ? 'Hide details' : 'Show details',
        detailRows,
        showDetailRows: isExpanded && q.hasQuote,
        showNoQuoteNote: isExpanded && !q.hasQuote,
        rowCls: isSelected
          ? 'sb-rating__row is-selected'
          : 'sb-rating__row'
      };
    });
  }

  get nextDisabled() {
    return !this.selectedQuoteId;
  }

  handleQuoteSelect(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this.selectedQuoteId = id;
  }

  // Expands an inline breakdown inside the card. Stops propagation
  // so the click doesn't fall through the wrapping <label> and
  // select the quote's radio as a side effect.
  handleShowQuoteDetails(event) {
    event.preventDefault();
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    const set = new Set(this.expandedQuoteIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    this.expandedQuoteIds = [...set];
  }

  handleRatingCancel() {
    this._closeRatingModal();
  }

  // Clicks that land on the overlay itself (not the dialog chrome)
  // dismiss, matching the appetite modal's backdrop behaviour.
  handleRatingBackdrop(event) {
    if (event.target === event.currentTarget) this._closeRatingModal();
  }

  _closeRatingModal() {
    this.ratingModalOpen = false;
    this.selectedQuoteId = null;
    this.expandedQuoteIds = [];
    this._pendingRoutedRfqIds = [];
    this._pendingRoutedLob = '';
    this._restoreBoardFocus();
  }

  // Return focus to the CTA that opened the overlay so keyboard
  // users don't get dumped back at the top of the document.
  _restoreBoardFocus() {
    Promise.resolve().then(() => {
      const cta = this.template.querySelector('.sb-foot__actions .sb-btn_brand');
      if (cta && !cta.disabled) cta.focus();
    });
  }

  handleRatingNext() {
    if (this.nextDisabled) return;
    const carrier = QUINSTREET_QUOTES.find((q) => q.id === this.selectedQuoteId);
    const rfqIds = [...this._pendingRoutedRfqIds];
    this.dispatchEvent(
      new CustomEvent('ratingcomplete', {
        detail: {
          accountId: this.accountId,
          accountName: this.accountName,
          rfqIds,
          selectedCarrier: carrier ? carrier.name : '',
          lob: this._pendingRoutedLob
        },
        bubbles: true,
        composed: true
      })
    );
    // Reset local state. The rows disappear from the board on their
    // own once the host flips them to Sent to Carrier (which drops
    // them out of BOARD_STATUSES).
    this.ratingModalOpen = false;
    this.selectedRfqIds = [];
    this.selectedQuoteId = null;
    this.expandedQuoteIds = [];
    this._pendingRoutedRfqIds = [];
    this._pendingRoutedLob = '';
  }

  get bundleId() {
    return this.lastBundle ? this.lastBundle.bundleId : '';
  }
  get bundleRfqCount() {
    return this.lastBundle ? this.lastBundle.rfqs.length : 0;
  }
  get bundleCarrierCount() {
    return this.lastBundle ? this.lastBundle.carriers.length : 0;
  }
  get bundleTitle() {
    if (!this.lastBundle) return '';
    const n = this.bundleCarrierCount;
    return `${this.bundleId} sent to ${n} carrier${n === 1 ? '' : 's'}`;
  }
  get bundleSubtitle() {
    if (!this.lastBundle) return '';
    const n = this.bundleRfqCount;
    const plural = n === 1 ? '' : 's';
    // Prefer the Hybrid bundle name in the copy so brokers see the
    // multi-LOC framing ("Auto + Homeowners") instead of the bare
    // LOB list. Falls back to LOB for pure standalone routings.
    const hybridName = this.lastBundle.hybridBundleName;
    if (hybridName) {
      return `${hybridName} (${n} LOC${plural}) for ${this.lastBundle.account} ${n === 1 ? 'is' : 'are'} now with the carrier markets. Agentforce will notify you via Slack as quotes come back.`;
    }
    const lob = this.lastBundle.lob;
    const lobLabel = lob ? `${lob} ` : '';
    return `Your ${n} ${lobLabel}RFQ${plural} for ${this.lastBundle.account} ${n === 1 ? 'is' : 'are'} now with the carrier markets. Agentforce will notify you via Slack as quotes come back.`;
  }
  get bundleLob() {
    return this.lastBundle ? this.lastBundle.lob : '';
  }
  get bundleRoutedAtDisplay() {
    if (!this.lastBundle) return '';
    try {
      const d = new Date(this.lastBundle.routedAt);
      const time = d.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit'
      });
      return `Just routed · ${time}`;
    } catch (e) {
      return '';
    }
  }
  get bundleRfqRows() {
    if (!this.lastBundle) return [];
    return this.lastBundle.rfqs.map((r) => ({
      id: r.id,
      name: r.name,
      lob: r.lob
    }));
  }
  get bundleCarrierCards() {
    if (!this.lastBundle) return [];
    return this.lastBundle.carriers.map((c) => ({
      id: c.id,
      name: c.name || c.id,
      initial: c.initial || (c.name ? c.name.charAt(0) : '?'),
      order: c.order,
      logoStyle: c.logoColor ? `background:${c.logoColor}` : ''
    }));
  }

  // Post-route: go back to the board so the broker can see the
  // status pills flip Submitted on the bundled rows.
  handleBackToBoard() {
    this.view = 'board';
    this.lastBundle = null;
  }
}
