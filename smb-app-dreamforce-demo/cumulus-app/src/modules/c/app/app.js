import { LightningElement, track } from 'lwc';
import {
  renewalAlerts,
  runMyDayMeetings,
  PERSONAS,
  DEFAULT_PERSONA_ID,
  getPersona,
  setActivePersona,
  addRunMyDayMeeting,
  seedCompanionMeetings,
  registerMeetingPrep,
  buildProposalReviewPrep,
  getAccountPrincipal,
  toDateKey,
  quoteIdsForCarriers,
  QUOTE_APP_BY_LOC_ID
} from 'data/mockData';
import { formatUsDate, today } from 'data/dates';

const PERSONA_IDS = PERSONAS.map((p) => p.id);

function readInitialPersonaId() {
  if (typeof window === 'undefined') return DEFAULT_PERSONA_ID;
  const id = new URLSearchParams(window.location.search).get('persona');
  return id && PERSONA_IDS.includes(id) ? id : DEFAULT_PERSONA_ID;
}

// `?rmdTab=` restores the active Run My Day sub-tab for personas whose
// homeVariant is 'tabbed' (Agency Principal). Producer / Finance homes
// don't render the tabstrip so the param is ignored for them.
const RMD_TABS = ['renewals', 'revenue'];
function readInitialRmdTab() {
  if (typeof window === 'undefined') return null;
  const id = new URLSearchParams(window.location.search).get('rmdTab');
  return id && RMD_TABS.includes(id) ? id : null;
}

const ROUTES = {
  ACCOUNT_RECORD_PAGE: 'account-record-page',
  RUN_MY_DAY: 'run-my-day',
  MEETING_CENTER: 'meeting-center',
  RFQ_WORKSPACE: 'rfq-workspace',
  EB_POLICY_RECORD_PAGE: 'eb-policy-record-page',
  RENEWAL_WORKSPACE: 'renewal-workspace'
};

// ── Canonical RFQ lifecycle statuses (single source of truth) ──
// Display-name strings are stored directly on accountRfqs rows so
// downstream views (RFQs tab, Submission Board, workspace tabs)
// render them without translation. Legacy aliases created before
// the full-name migration ('Ready', 'Submitted', 'Closed/Bound',
// 'Sent') are normalized on read via `normalizeRfqStatus`.
export const RFQ_STATUS = Object.freeze({
  DRAFT: 'Draft',
  READY: 'Ready for Submission',
  SENT_TO_CARRIER: 'Sent to Carrier',
  QUOTES: 'Quotes Received',
  BOUND: 'Closed / Bound (Won)'
});

// Map short/legacy status strings (used by earlier prototypes +
// mock seeds) to their canonical full-name equivalents. Anything
// not in this map is passed through unchanged. `Submitted to Market`
// is the previous label for post-route RFQs and now folds into
// `Sent to Carrier`.
const LEGACY_STATUS_ALIASES = Object.freeze({
  Ready: RFQ_STATUS.READY,
  Submitted: RFQ_STATUS.SENT_TO_CARRIER,
  Sent: RFQ_STATUS.SENT_TO_CARRIER,
  'Submitted to Market': RFQ_STATUS.SENT_TO_CARRIER,
  'Closed/Bound': RFQ_STATUS.BOUND
});

// Gap between simulated carrier responses, timed from the moment the
// RFQs tab opens. The first response lands three seconds in, which
// leaves the "Sent to Carrier" row on screen long enough to read
// before it changes, and still settles the board while the broker is
// looking at it.
const QUOTE_ARRIVAL_MS = 3000;

// Delay before the client answers an emailed proposal. Matches the
// carrier-response cadence so both inbound events feel like one system.
const CLIENT_REPLY_MS = 3000;

export function normalizeRfqStatus(status) {
  if (!status) return RFQ_STATUS.DRAFT;
  return LEGACY_STATUS_ALIASES[status] || status;
}

// Statuses that appear on the Submission Board. Draft rows live on
// the RFQs tab only; Sent-to-Carrier rows drop off the board once the
// broker picks a quote in the rating screen; Closed statuses drop off
// once the RFQ is bound.
const BOARD_VISIBLE_STATUSES = new Set([
  RFQ_STATUS.READY,
  RFQ_STATUS.QUOTES
]);


// Stable workspace-tab IDs for the two static account tabs (kept in sync
// with c-account-record-page so the parent and child agree on which tab
// is active without round-tripping through props).
const ACCOUNT_TAB_IDS = {
  '001SB00001oXwntYAC': 'account-mavericks',
  '001EB00002pYzbMAC': 'account-acme',
  'a-whitfield': 'account-whitfield',
  'a-bluebird': 'account-bluebird'
};
// Mirrors c-account-record-page so the URL persistence layer knows
// which tab id signals the Setup screen.
const SETUP_TAB_ID = 'tab-setup';
// Mirrors c-account-record-page: the org Setup home reached from the
// global-header gear menu.
const SETUP_HOME_TAB_ID = 'tab-setup-home';
// Mirrors c-account-record-page so URL persistence + the Home-pill
// click-through in c-home-tab-strip can point at the Home workspace
// tab that lives inside the SF shell.
const HOME_TAB_ID = 'tab-home';
// Legacy `?tab=tab-meeting-center` deep-links predate per-meeting tabs,
// when Meeting Center was a single screen rather than one tab per
// playbook. Kept as a matcher so old bookmarks still open a meeting -
// they resolve to the first meeting on the carousel.
const LEGACY_MEETING_CENTER_TAB_ID = 'tab-meeting-center';
// Workspace-tab id for an open Meeting Playbook. Mirrors the org, where
// each playbook is its own console tab keyed by record id.
function meetingTabId(meetingId) {
  return `meeting-${meetingId}`;
}
// Tabs that survive a hard refresh - written to the URL so the broker
// returns to them after refresh. Dynamic RFQ tabs (rfq-<timestamp>)
// are session-scoped and intentionally excluded since the tab itself
// is gone after refresh.
const PERSISTABLE_TAB_IDS = new Set([
  ...Object.values(ACCOUNT_TAB_IDS),
  SETUP_TAB_ID,
  SETUP_HOME_TAB_ID,
  HOME_TAB_ID
]);

function readInitialRoute() {
  // Salesforce Account Record Page is the new default entry - the
  // broker lands inside their CRM environment and triggers the
  // Guided RFQ via the Quick Action dropdown.
  if (typeof window === 'undefined') return ROUTES.ACCOUNT_RECORD_PAGE;
  const param = new URLSearchParams(window.location.search).get('route');
  // Legacy shim: `?route=run-my-day` used to mount a standalone RMD
  // page that unmounted the SF shell. RMD now lives inside the SF
  // shell as the Home workspace tab, so we coerce the legacy route
  // to the account-record-page and rely on readInitialActiveTab()
  // below to activate Home on first render.
  if (param === ROUTES.RUN_MY_DAY) return ROUTES.ACCOUNT_RECORD_PAGE;
  // Same shim for Meeting Center - it used to render as a top-level
  // route that swapped out the whole SF shell. A meeting is now a
  // record with its own workspace tab inside the shell, seeded by
  // readInitialMeetingId() and activated by readInitialActiveTab().
  if (param === ROUTES.MEETING_CENTER) return ROUTES.ACCOUNT_RECORD_PAGE;
  if (param && Object.values(ROUTES).includes(param)) return param;
  return ROUTES.ACCOUNT_RECORD_PAGE;
}

// `?tab=<id>` restores the active workspace tab on hard refresh so
// the broker lands back on the same screen (account tab or the
// Setup tab). We only honour ids in PERSISTABLE_TAB_IDS - dynamic
// RFQ tabs don't survive refresh, so an unknown id falls back to
// the default.
function readInitialActiveTab() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  // Route-driven coercions take precedence over `?tab=`, so a stale
  // link like `?tab=tab-home&route=run-my-day` still lands on Home.
  const routeParam = params.get('route');
  if (routeParam === ROUTES.RUN_MY_DAY) return HOME_TAB_ID;
  // A meeting deep-link activates that meeting's own tab, seeded
  // alongside it by readInitialMeetingId().
  const meetingId = readInitialMeetingId();
  if (meetingId) return meetingTabId(meetingId);
  const id = params.get('tab');
  if (id && PERSISTABLE_TAB_IDS.has(id)) return id;
  return null;
}

// Meeting Playbook deep-link. `?route=meeting-center&meeting=<id>` opens
// that playbook's workspace tab on load; `?route=meeting-center` with no
// id (and the legacy `?tab=tab-meeting-center`) falls back to the first
// meeting on the carousel so old bookmarks still resolve to something.
function readInitialMeetingId() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const wantsMeeting =
    params.get('route') === ROUTES.MEETING_CENTER ||
    params.get('tab') === LEGACY_MEETING_CENTER_TAB_ID;
  if (!wantsMeeting) return null;
  const id = params.get('meeting');
  if (id && runMyDayMeetings.some((m) => m.id === id)) return id;
  return runMyDayMeetings[0]?.id || null;
}

// Turns a meeting deep-link into the one open meeting tab the shell
// starts with. Empty on a normal load - meeting tabs are otherwise
// only created by clicking a carousel card.
function _seedMeetingTabs() {
  const id = readInitialMeetingId();
  if (!id) return [];
  const meeting = runMyDayMeetings.find((m) => m.id === id);
  return meeting ? [{ id: meetingTabId(id), meetingId: id, label: meeting.name }] : [];
}

function readInitialSlack() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('slack') === 'open';
}

// `?demo=1` (the hub's "Start demo" CTA) turns on the presentation
// overlay: a synthetic pointer plus a translucent hotspot on every
// click. Any truthy value except an explicit "0"/"false" opts in, so
// richer forms like `?demo=acme-eb` also light it up once scripted
// autoplay scripts exist.
function readInitialDemoMode() {
  if (typeof window === 'undefined') return false;
  const v = new URLSearchParams(window.location.search).get('demo');
  if (v === null) return false;
  return v !== '0' && v !== 'false';
}

function readInitialContext() {
  if (typeof window === 'undefined') return null;
  const key = new URLSearchParams(window.location.search).get('context');
  if (!key) return null;
  return renewalAlerts.find((a) => a.id === key) || null;
}

// Deep-link: ?compare=open opens the Quote Comparison modal on load.
// Optional &flow=pa|eb (defaults from the launch context, else PA).
// Special value `?compare=nova` is a demo shortcut that opens the
// Nova Health Inc. EB RFQ (rfq-nova-001) which is the only RFQ that
// opts into the benefit-first compare layout.
function readInitialCompareParam() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('compare') || '';
}
function readInitialCompare() {
  const v = readInitialCompareParam();
  return v === 'open' || v === 'nova';
}

// When a broker deep-links `?tab=<account-tab>&compare=open&flow=<pa|eb>`
// there's no explicit `?context=` to lean on, so we route to that
// account's canonical RFQ for the requested flow. Without this table
// the modal would fall through to a Mavericks PA fallback and, on an
// EB URL, render an empty grid because EB attributes don't match PA
// quote data.
const DEFAULT_COMPARE_BY_TAB = {
  'account-acme': {
    eb: {
      applicationId: 'rfq-acme-001',
      applicationName: 'Acme Manufacturing - 2026 Group Medical Renewal',
      accountName: 'Acme Manufacturing',
      accountId: '001EB00002pYzbMAC',
      flow: 'eb',
      locLabel: 'Group Medical'
    }
  },
  'account-mavericks': {
    pa: {
      applicationId: 'rfq-mavericks-001',
      applicationName: 'Mavericks Household - Personal Auto',
      accountName: 'Mavericks Household',
      accountId: '001SB00001oXwntYAC',
      flow: 'pa',
      locLabel: 'Personal Auto'
    }
  }
};

function readInitialCompareContext() {
  if (!readInitialCompare()) return null;
  const compareParam = readInitialCompareParam();
  if (compareParam === 'nova') {
    // Preset context for the benefit-first layout demo.
    return {
      applicationId: 'rfq-nova-001',
      applicationName: 'Nova Health Inc. - Group Medical',
      accountName: 'Nova Health Inc.',
      accountId: '001EB00003rTvXWAM',
      flow: 'eb',
      locLabel: 'Group Medical'
    };
  }
  const flow = new URLSearchParams(window.location.search).get('flow');
  const ctx = readInitialContext();
  if (ctx) {
    const isEb = ctx.lob === 'eb' || ctx.lob === 'Employee Benefits';
    return {
      applicationId: ctx.applicationId || ctx.id,
      applicationName: ctx.applicationName,
      accountName: ctx.accountName,
      accountId: ctx.accountId,
      flow: flow || (isEb ? 'eb' : 'pa'),
      locLabel: ctx.loc || ctx.locLabel || (isEb ? 'Group Medical' : 'Personal Auto')
    };
  }
  // Fall back to the active tab's canonical RFQ. If `?flow=` is set,
  // prefer that flow; otherwise pick the account's only registered
  // flow (Acme = EB, Mavericks = PA). Last-resort fallback stays the
  // Mavericks PA compare so `?compare=open` alone still works.
  const tab = readInitialActiveTab();
  const tabMap = tab && DEFAULT_COMPARE_BY_TAB[tab];
  if (tabMap) {
    const flowKey = flow && tabMap[flow] ? flow : Object.keys(tabMap)[0];
    return tabMap[flowKey];
  }
  return {
    applicationId: 'rfq-mavericks-001',
    applicationName: 'Mavericks Household - Personal Auto',
    accountName: 'Mavericks Household',
    accountId: '001SB00001oXwntYAC',
    flow: flow || 'pa',
    locLabel: 'Personal Auto'
  };
}

export default class App extends LightningElement {
  @track route = readInitialRoute();
  @track slackOpen = readInitialSlack();
  @track rfqContext = readInitialContext();
  @track boundAccountIds = [];

  // ── Persona / Home routing ────────────────────────────────────
  // Persona drives which Run My Day home layout mounts and which
  // widgets (renewals ops vs. agency revenue) are gated on. Seed
  // the mockData `currentUser` object so avatar/name reads elsewhere
  // in the app stay consistent from first paint.
  @track activePersonaId = (() => {
    const id = readInitialPersonaId();
    setActivePersona(id);
    return id;
  })();
  @track rmdTab = readInitialRmdTab();

  get activePersona() {
    return getPersona(this.activePersonaId);
  }

  // ── Workspace tab management (Salesforce Console mock) ────────
  // openRfqTabs: dynamic RFQ workspace tabs added by the user via the
  // Intake modal's "Save & Continue". The two account tabs are static
  // and rendered by c-account-record-page directly. activeWorkspaceTabId
  // is the SOURCE OF TRUTH for which workspace tab the user is on.
  @track openRfqTabs = [];
  // Initialised from `?tab=` so hard-refresh restores the screen the
  // broker was on. Falls back to Home (Run My Day) when the URL doesn't
  // pin one - the demo opens on the broker's day, and account tabs only
  // enter the strip once a record is actually opened.
  @track activeWorkspaceTabId = readInitialActiveTab() || HOME_TAB_ID;

  // openMeetingTabs: dynamic Meeting Playbook workspace tabs, one per
  // meeting the broker opened from the Run My Day carousel. The org
  // treats a playbook as a first-class record - clicking a carousel
  // card navigates to /lightning/r/MeetingPlaybook/<id>/view, which the
  // console opens as its own primary tab beside the account tabs - so
  // these are siblings of openRfqTabs rather than a Home sub-route.
  @track openMeetingTabs = _seedMeetingTabs();

  // ── RFQ history per account (drives the Account Record Page →
  // RFQs tab data table). Seed = the single bound historical RFQ
  // each account already has on file. New Drafts are appended as the
  // user runs the Intake modal's "Save & Continue".
  @track accountRfqs = {
    '001SB00001oXwntYAC': [
      // The single Ready row, and therefore the only row the Submission
      // Board renders. Standalone - it carries no `bundleId` because
      // there is no bundle parent for it to belong to.
      {
        id: 'rfq-mav-renters-2026',
        name: '2026 Mavericks Renters - Office Space',
        lob: 'Renters',
        date: 'Today',
        status: RFQ_STATUS.READY,
        applicationId: 'rfq-mavericks-002'
      }
    ],
    '001EB00002pYzbMAC': [
      {
        id: 'rfq-acme-2026-life',
        name: '2026 Group Life',
        lob: 'Life',
        date: 'Yesterday',
        status: RFQ_STATUS.SENT_TO_CARRIER,
        applicationId: 'rfq-acme-001'
      },
      {
        id: 'rfq-acme-2025',
        name: '2025 Dental & Vision',
        lob: 'Employee Benefits',
        date: '09/01/2024',
        status: RFQ_STATUS.BOUND,
        applicationId: 'rfq-acme-001'
      }
    ]
  };

  // ── Async Quote Comparison Modal state ────────────────────────
  @track quoteModalOpen = readInitialCompare();
  @track quoteModalContext = readInitialCompareContext();
  // Specific quote ids to compare (checked rows in the RFQ table). Empty
  // → the modal grid shows every quote for the application.
  @track quoteModalQuoteIds = [];

  get quoteModalQuoteIdList() {
    return this.quoteModalQuoteIds;
  }

  // ── RFQ Intake Modal state ────────────────────────────────────
  @track intakeModalOpen = false;
  @track intakeContext = null;

  // Presentation overlay for demo runs. Read once at construction and
  // persisted through _syncUrl so in-app navigation never drops it
  // mid-demo.
  @track demoMode = readInitialDemoMode();

  // Records for the global-header notification tray. Newest first.
  // Distinct from the toast: the toast confirms the action the broker
  // just took, these are the carrier responses that arrive afterwards.
  @track notifications = [];
  _quoteArrivalTimers = [];
  // A routed bundle waiting for the RFQs tab to open before its
  // carriers start responding. See handleRouteBundle.
  _pendingQuoteArrivals = null;
  // Open from the first carrier response to the last. The record page
  // rides this window to hold the notification tray open, so the
  // responses are watched as they land.
  @track quoteArrivalsActive = false;
  // Bumped when a client-reply notification is prepended. The record
  // page treats a rise as "open the tray now" so the reply is on
  // screen instead of hiding behind a badge.
  @track clientReplySignal = 0;

  // ── Client reply to an emailed proposal ───────────────────────
  @track clientReplyOpen = false;
  @track clientReply = null;
  _clientReplyTimer = null;
  // Bumped whenever a meeting is booked. Forwarded to c-run-my-day so
  // it re-reads runMyDayMeetings; see handleScheduleMeeting.
  @track rmdMeetingsRevision = 0;
  @track rmdFocusDateKey = null;
  @track rmdHighlightMeetingId = null;

  @track toastMessage = (() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('toast') || '';
  })();
  @track toastKind = 'success';
  // Toast policy: only three moments raise one - an RFQ reaching the
  // Submission Board (submission), routing that bundle to carriers, and
  // emailing the proposal. Everything else confirms itself on screen.
  // See .cursor/rules/toast-notifications.mdc.
  @track toastVisible = (() => {
    if (typeof window === 'undefined') return false;
    return !!new URLSearchParams(window.location.search).get('toast');
  })();

  // ── Derived getters used by the modal binding ─────────────────
  get quoteModalApplicationId() {
    return this.quoteModalContext?.applicationId || 'rfq-apex-001';
  }

  get quoteModalApplicationName() {
    return this.quoteModalContext?.applicationName || 'Apex Logistics RFQ';
  }

  get quoteModalAccountName() {
    return this.quoteModalContext?.accountName || 'Apex Logistics';
  }

  get quoteModalAccountId() {
    return this.quoteModalContext?.accountId || null;
  }

  get quoteModalFlow() {
    return this.quoteModalContext?.flow || 'pa';
  }

  // Line of coverage the compared RFQ was submitted on. Drives the
  // compare grid's line chip and the proposal copy, so a Renters RFQ
  // never reads as an auto renewal.
  get quoteModalLineLabel() {
    return this.quoteModalContext?.locLabel || 'Personal Auto';
  }

  get intakeModalContext() {
    return this.intakeContext;
  }

  get boundAccountIdsArray() {
    return this.boundAccountIds;
  }

  get isRunMyDay() {
    return this.route === ROUTES.RUN_MY_DAY;
  }
  // Meeting Center is no longer a top-level route - each playbook is a
  // record with its own workspace tab inside the shell. The getter is
  // retained as a compat shim (always false) in case any downstream
  // still checks it.
  get isMeetingCenter() {
    return false;
  }
  // Deep-dive renewals workspace launched from the Producer Hub CTA.
  // Direct URL entry supported via `?route=renewal-workspace`.
  get isRenewalWorkspace() {
    return this.route === ROUTES.RENEWAL_WORKSPACE;
  }
  // RFQ workspace as a top-level route is now reserved for direct URL
  // entry (?route=rfq-workspace) - the launched-from-account flow opens
  // the wizard inside a workspace tab on the Account Record Page.
  get isRfqWorkspace() {
    return (
      this.route === ROUTES.RFQ_WORKSPACE && !this.rfqContext?.launchedFromAccount
    );
  }
  get isAccountRecordPage() {
    return (
      this.route === ROUTES.ACCOUNT_RECORD_PAGE ||
      (this.route === ROUTES.RFQ_WORKSPACE && this.rfqContext?.launchedFromAccount)
    );
  }
  // EB Insurance Policy record page (Plan tab flow) - direct URL entry.
  get isEbPolicyRecordPage() {
    return this.route === ROUTES.EB_POLICY_RECORD_PAGE;
  }
  // Detect EB by the launch payload - accept either the human-readable
  // "Employee Benefits" string or the lowercase code "eb" for robustness.
  get isEbFlow() {
    const lob = this.rfqContext?.lob;
    return lob === 'Employee Benefits' || lob === 'eb';
  }
  // Home shares the "Personal Lines" LOB with PA, so key off the LOC.
  get isHomeFlow() {
    if (this.isEbFlow) return false;
    const loc = this.rfqContext?.loc;
    return loc === 'Homeowners' || loc === 'home';
  }
  get isPaWorkspace() {
    return this.isRfqWorkspace && !this.isEbFlow && !this.isHomeFlow;
  }
  get isEbWorkspace() {
    return this.isRfqWorkspace && this.isEbFlow;
  }
  get isHomeWorkspace() {
    return this.isRfqWorkspace && this.isHomeFlow;
  }
  // True when the user is inside the Salesforce-native shell flow -
  // either on the Account Record Page itself or inside a wizard that
  // was launched from it. These routes already ship a full workspace
  // tab strip (with a functional Home pill), so they don't get the
  // top-level Home strip.
  get isSalesforceShellFlow() {
    return this.isAccountRecordPage || this.isEbPolicyRecordPage;
  }
  // Legacy gate for the retired Atlas top nav. Kept as an alias so
  // any downstream code still referencing it keeps compiling; the
  // template now mounts c-home-tab-strip via showHomeTabStrip.
  get showAtlasTopNav() {
    return !this.isSalesforceShellFlow;
  }
  // Every non-SF-shell route (Run My Day, Renewals Workspace, RFQ
  // Workspace, Meeting Center, ...) gets the lightweight Home tab
  // strip so the broker always has a one-click way back to Home.
  // On the Account Record Page + EB Policy record page the workspace
  // tab strip already provides that affordance, so we skip it there
  // to avoid a redundant chrome row above the existing tabs.
  get showHomeTabStrip() {
    return !this.isSalesforceShellFlow;
  }

  // Pass-through helpers for the Account Record Page workspace-tab API.
  get accountRfqTabs() {
    return this.openRfqTabs;
  }

  get accountMeetingTabs() {
    return this.openMeetingTabs;
  }

  // The meeting whose tab is active, if any. Written to the URL so a
  // refresh reopens the same playbook.
  get _activeMeetingId() {
    const tab = this.openMeetingTabs.find(
      (t) => t.id === this.activeWorkspaceTabId
    );
    return tab ? tab.meetingId : null;
  }

  // ── Navigation / shell ────────────────────────────────────────
  handleNavigate(event) {
    let next = event.detail?.route;
    // Legacy shim: `route: 'run-my-day'` used to swap the top-level
    // route and mount a standalone RMD, unmounting the SF shell +
    // workspace tab strip. RMD now lives inside the SF shell as the
    // Home workspace tab, so we transform the request to (a) route
    // into the account-record-page shell and (b) activate the Home
    // tab so RMD is what the broker sees. c-home-tab-strip (on
    // non-shell routes) and any legacy `navigate({route:'run-my-day'})`
    // caller both funnel through this single shim.
    if (next === ROUTES.RUN_MY_DAY) {
      this.route = ROUTES.ACCOUNT_RECORD_PAGE;
      this.activeWorkspaceTabId = HOME_TAB_ID;
      this.rfqContext = null;
      return;
    }
    // Meeting Playbook - the RMD carousel card fires
    // `navigate({ route: 'meeting-center', meetingId })`. Matching the
    // org, the playbook opens as its own workspace tab rather than
    // taking over the Home panel, so the broker can pivot to an
    // account and back with the meeting still open.
    if (next === ROUTES.MEETING_CENTER) {
      this.route = ROUTES.ACCOUNT_RECORD_PAGE;
      this.rfqContext = null;
      this._openMeetingTab(event.detail?.meetingId);
      return;
    }
    if (next && Object.values(ROUTES).includes(next)) {
      this.route = next;
      if (event.detail?.context) {
        this.rfqContext = event.detail.context;
      } else if (next !== ROUTES.RFQ_WORKSPACE) {
        this.rfqContext = null;
      }
      // When a specific account is targeted (e.g. an account-name link on
      // a renewal alert), activate that account's console tab so the
      // record page lands on the right account's starting point.
      const accountId = event.detail?.accountId;
      if (accountId && ACCOUNT_TAB_IDS[accountId]) {
        this.activeWorkspaceTabId = ACCOUNT_TAB_IDS[accountId];
      }
    }
  }

  // Opens (or re-focuses) the workspace tab for a Meeting Playbook.
  // A missing / unknown id falls back to the first meeting so the
  // legacy `route=meeting-center` deep-link still lands somewhere.
  _openMeetingTab(meetingId) {
    const meeting =
      runMyDayMeetings.find((m) => m.id === meetingId) || runMyDayMeetings[0];
    if (!meeting) return;
    const tabId = meetingTabId(meeting.id);
    if (!this.openMeetingTabs.some((t) => t.id === tabId)) {
      this.openMeetingTabs = [
        ...this.openMeetingTabs,
        { id: tabId, meetingId: meeting.id, label: meeting.name }
      ];
    }
    this.activeWorkspaceTabId = tabId;
  }

  // ── Workspace tab events from c-account-record-page ───────────
  handleWorkspaceTabActivate(event) {
    const tabId = event.detail?.tabId;
    if (!tabId) return;
    this.activeWorkspaceTabId = tabId;
  }

  // Global search picked a result from the "Digital Experiences"
  // dropdown - switch the workspace tab to the chosen account / RFQ
  // / policy id. accountRecordPage's activeWorkspaceTabId setter
  // auto-closes Setup when the new id isn't the Setup tab, so the
  // original tab strip comes back without any explicit close call.
  handleSearchNavigate(event) {
    const tabId = event.detail?.tabId;
    if (!tabId) return;
    this.activeWorkspaceTabId = tabId;
  }

  handleWorkspaceTabClose(event) {
    const tabId = event.detail?.tabId;
    if (!tabId) return;
    // Meeting tabs close independently of the RFQ list below; closing
    // the active one falls back to Home, which is where the broker
    // opened the meeting from.
    if (this.openMeetingTabs.some((t) => t.id === tabId)) {
      this.openMeetingTabs = this.openMeetingTabs.filter((t) => t.id !== tabId);
      if (this.activeWorkspaceTabId === tabId) {
        this.activeWorkspaceTabId = HOME_TAB_ID;
      }
      return;
    }
    const idx = this.openRfqTabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;
    // Grab the closing tab's account so we can prefer to land on a
    // sibling LOC in the same bundle instead of bouncing the broker
    // all the way out to the account record page below.
    const closingTab = this.openRfqTabs[idx];
    const closingAccountId = closingTab?.accountId || null;
    const next = this.openRfqTabs.filter((t) => t.id !== tabId);
    this.openRfqTabs = next;
    // If the broker just closed the tab they were viewing, we need
    // somewhere sensible to land. Priority order:
    //   1. Another open RFQ workspace tab on the SAME account bundle
    //      (a sibling LOC - closing Homeowners lands on Personal Auto
    //      on the same household, at whichever step that workspace
    //      was last on since the sibling LWC instance stays mounted
    //      and just toggled hidden ↔ active via sf-shell-body_*).
    //   2. Any other open RFQ workspace tab (different account).
    //   3. The account record page tab as a last-resort fallback.
    if (this.activeWorkspaceTabId === tabId) {
      const sameAccountSibling = closingAccountId
        ? next.find((t) => t.accountId === closingAccountId)
        : null;
      if (sameAccountSibling) {
        this.activeWorkspaceTabId = sameAccountSibling.id;
      } else if (next.length > 0) {
        this.activeWorkspaceTabId = next[0].id;
      } else {
        this.activeWorkspaceTabId = HOME_TAB_ID;
      }
    }
  }

  // ── RFQ Intake modal flow ─────────────────────────────────────
  // 1) Quick Action → open the modal over the Account Record Page.
  handleStartRfqIntake(event) {
    this.intakeContext = event.detail?.context || null;
    this.intakeModalOpen = true;
  }

  // 2) Cancel → dismiss, leave the user on the Account Record Page.
  handleIntakeCancel() {
    this.intakeModalOpen = false;
  }

  // 3) Save & Continue → close the modal, simulate opening a new
  //    workspace tab, and mount the Guided RFQ wizard inside it.
  //    The Account tab stays open in DOM so switching back is instant
  //    and the wizard tab keeps its internal state across switches.
  handleIntakeContinue(event) {
    const { renewalMode, context } = event.detail || {};
    // DEBUG - verify the modal is forwarding priorHeadcount/priorBenefits.
    // eslint-disable-next-line no-console
    console.log('[app] handleIntakeContinue context =', JSON.parse(JSON.stringify(context || {})));
    const base = context || this.intakeContext || {};
    this.intakeModalOpen = false;
    const isEb = base.lob === 'Employee Benefits' || base.lob === 'eb';
    // Home shares the "Personal Lines" LOB with PA, so key off LOC.
    const isHome = !isEb && (base.loc === 'Homeowners' || base.loc === 'home');
    let type;
    if (isEb) type = 'rfq-eb';
    else if (isHome) type = 'rfq-home';
    else type = 'rfq-pa';

    // Rule: one open flow per LOC on an account. If a sibling tab
    // for this LOC is already open, activate it instead of spawning
    // a duplicate (covers the picker filter being bypassed or a
    // fresh intake on an account that already has that LOC open).
    const accountId = base.accountId || null;
    if (accountId) {
      const incomingKey = this._locKeyFor({ type, context: base });
      // Skip the uniqueness check when we couldn't resolve a LOC key
      // (e.g. legacy rfq-eb tabs with no context.loc) - an empty key
      // must not collide every EB sibling into one bucket.
      const existing =
        incomingKey &&
        (this.openRfqTabs || []).find(
          (t) =>
            t.accountId === accountId &&
            this._locKeyFor(t) === incomingKey
        );
      if (existing) {
        // Switching tabs is self-evident on screen, so it does not
        // toast - see the toast policy above.
        this.activeWorkspaceTabId = existing.id;
        return;
      }
    }

    let tabLabel;
    if (isEb) {
      const ebLoc = base.loc || 'Group Medical';
      tabLabel = `New RFQ - 2026 ${ebLoc}`;
    } else if (isHome) {
      tabLabel = 'New RFQ - 2026 Homeowners';
    } else {
      tabLabel = 'New RFQ - 2026 Renewal';
    }
    const tabId = `rfq-${Date.now()}`;
    // tabId doubles as the RFQ row id on the account. Piping it into
    // the wizard's context lets the wizard emit `rfqId` on submit so
    // this shell can flip the exact row Draft -> Ready without any
    // fuzzy lookup by account + status.
    const tabContext = {
      ...base,
      renewalMode: renewalMode || 'shop_market',
      launchedFromAccount: true,
      rfqId: tabId,
      tabLabel
    };
    const newTab = {
      id: tabId,
      type,
      label: tabContext.tabLabel,
      accountId,
      context: tabContext
    };
    this.openRfqTabs = [...this.openRfqTabs, newTab];
    this.activeWorkspaceTabId = tabId;
    // Keep the legacy rfqContext + route in sync for any downstream
    // consumers that still inspect them (e.g. the Slack drawer or the
    // standalone wizard route).
    this.rfqContext = tabContext;

    // Append a matching Draft row to this account's RFQ history so the
    // Account Record Page → RFQs tab reflects the freshly-launched RFQ.
    if (accountId) {
      // Store the LOC label in `lob` (same contract as Personal Lines:
      // Personal Auto / Homeowners). For EB that means Group Medical /
      // Group Dental / … so bundle children stay distinct on the RFQs
      // tab and Submission Board. Never collapse to the product LOB
      // string "Employee Benefits" here.
      let lobLabel;
      if (isEb) lobLabel = tabContext.loc || 'Group Medical';
      else if (isHome) lobLabel = 'Homeowners';
      else lobLabel = tabContext.loc || 'Personal Auto';

      // ── Bundle formation (Hybrid "Add Another LOC") ────────────
      // When the intake was launched via "+ Add Another Line of
      // Coverage" from a workspace's Review, the source RFQ hands us
      // its rfqId in `base.sourceRfqId`. A line of coverage points at
      // its parent RFQ record through `bundleId`, so there are three
      // cases:
      //   (a) The source is itself a line of coverage (3rd+ LOC in
      //       the same session) → join the same parent.
      //   (b) The source already owns lines of coverage → it IS the
      //       parent, so the new Draft just points at it.
      //   (c) The source is standalone → mint a real parent RFQ
      //       record and move the source under it, so both LOCs hang
      //       off a record the row menus can act on.
      // Rows without a bundleId are standalone and continue to
      // render as top-level entries on the Submission Board.
      let bundleId = null;
      let parentRow = null;
      let updatedPrevRows = null;
      const isAddingLoc = !!base.isAddingLoc;
      const sourceRfqId = base.sourceRfqId || null;
      if (isAddingLoc && sourceRfqId) {
        const prevRows = this.accountRfqs[accountId] || [];
        const sourceRow = prevRows.find((r) => r.id === sourceRfqId);
        if (sourceRow) {
          if (sourceRow.bundleId) {
            bundleId = sourceRow.bundleId;
          } else if (prevRows.some((r) => r.bundleId === sourceRow.id)) {
            bundleId = sourceRow.id;
          } else {
            const parentId = `rfq-bundle-${Date.now()}`;
            bundleId = parentId;
            parentRow = {
              id: parentId,
              name: this._deriveBundleName(sourceRow, base),
              // Parent rows carry the product LOB; their lines of
              // coverage carry the LOC label.
              lob: isEb ? 'Employee Benefits' : 'Personal Lines',
              date: 'Today',
              status: 'Draft'
            };
            updatedPrevRows = prevRows.map((r) =>
              r.id === sourceRfqId ? { ...r, bundleId } : r
            );
          }
        }
      }

      const draftRow = {
        id: tabId,
        name: this._deriveRfqRowName(tabContext, { isEb, isHome }),
        lob: lobLabel,
        date: 'Today',
        status: 'Draft',
        // Carried from the intake so downstream surfaces know who is
        // currently on risk. The Submission Board's appetite matrix
        // reads these to tag the incumbent row "Current carrier";
        // both are absent on a from-scratch RFQ with no prior policy.
        ...(tabContext.priorCarrier
          ? { priorCarrier: tabContext.priorCarrier }
          : {}),
        ...(tabContext.priorPolicy
          ? { priorPolicy: tabContext.priorPolicy }
          : {}),
        // Only present when this row is a line of coverage under a
        // parent RFQ; absent for standalone RFQs. Downstream
        // (Submission Board, Account RFQ list) treats a missing
        // bundleId as "not bundled".
        ...(bundleId ? { bundleId } : {})
      };
      const prev = updatedPrevRows || this.accountRfqs[accountId] || [];
      this.accountRfqs = {
        ...this.accountRfqs,
        // Newest first so the Draft row appears at the top of the
        // list; a freshly-minted parent leads its own lines.
        [accountId]: parentRow
          ? [parentRow, draftRow, ...prev]
          : [draftRow, ...prev]
      };
    }
  }

  // Canonical LOC key for "one open flow per LOC" uniqueness.
  // Prefers context.loc, then falls back to the workspace tab type so
  // older tabs without a loc string still collide correctly with a
  // freshly-picked Homeowners / Personal Auto LOC. EB must NOT map
  // the product LOB ("Employee Benefits" / "eb") onto Group Medical -
  // that wrongly blocked Group Dental as a duplicate. When only the
  // tab type is known (no loc), return '' so uniqueness can't false-
  // positive across distinct EB LOCs.
  _locKeyFor(tabOrStub) {
    const raw =
      tabOrStub?.context?.loc ||
      tabOrStub?.context?.locLabel ||
      null;
    if (raw && !Array.isArray(raw)) {
      const s = String(raw).trim().toLowerCase();
      if (s === 'home' || s === 'homeowners') return 'homeowners';
      if (s === 'personal auto' || s === 'auto' || s === 'pa') {
        return 'personal auto';
      }
      // Product LOB strings are not LOC keys - ignore them so callers
      // fall through to context.loc / explicit Group* labels.
      if (s === 'employee benefits' || s === 'eb') return '';
      return s;
    }
    if (tabOrStub?.type === 'rfq-home') return 'homeowners';
    if (tabOrStub?.type === 'rfq-pa') return 'personal auto';
    // rfq-eb without a loc cannot safely default to Group Medical.
    return '';
  }

  // Pretty-print a LOC key (or raw loc label) for duplicate-flow toasts.
  _displayLocForKey(key, fallbackLoc) {
    const k = String(key || '').trim().toLowerCase();
    if (k === 'homeowners') return 'Homeowners';
    if (k === 'personal auto') return 'Personal Auto';
    if (k === 'group medical') return 'Group Medical';
    if (k === 'group dental') return 'Group Dental';
    if (k === 'group vision') return 'Group Vision';
    if (fallbackLoc) return String(fallbackLoc);
    if (!k) return 'this';
    // Title-case unknown keys ("group life" → "Group Life").
    return k.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // True when a row / launch payload belongs to the Employee Benefits
  // product family. Accepts the product LOB string and any Group*
  // LOC label stored in the row's `lob` field after the EB LOC fix.
  _isEbLob(lobOrLoc) {
    const s = String(lobOrLoc || '').trim().toLowerCase();
    if (!s) return false;
    if (s === 'employee benefits' || s === 'eb') return true;
    return s.startsWith('group ');
  }

  // Derive a friendly display name for the parent RFQ record a Hybrid
  // bundle mints. Both the RFQs tab and the Submission Board render it
  // on the expandable parent row. Preference order:
  //   1. Extract the year prefix from the source row's name
  //      ("2026 Auto Renewal" → "2026 {Account} Renewal Bundle").
  //   2. Fallback to "{Account} Multi-LOC Bundle".
  _deriveBundleName(sourceRow, base) {
    const account = this._accountNameForBase(base);
    const srcName = sourceRow?.name || '';
    const yearMatch = srcName.match(/^(\d{4})/);
    if (yearMatch && account) {
      return `${yearMatch[1]} ${account} Renewal Bundle`;
    }
    if (account) return `${account} Multi-LOC Bundle`;
    return 'Multi-LOC Bundle';
  }

  // Best-effort account-name lookup for bundle labels. Prefer the
  // launch context (broker just came from the account page so it's
  // populated), fall back to any known display name for the id.
  _accountNameForBase(base) {
    if (base?.accountName) return base.accountName;
    // The account tab labels are the canonical display names in this
    // mock shell. Try to look one up by the incoming accountId.
    const id = base?.accountId;
    if (!id) return '';
    // ACCOUNT_TAB_IDS maps accountId → tabId (e.g. 'account-mavericks').
    // The tab labels live on the account-record-page component, but a
    // couple of common ones are inlined below for parity.
    if (id === '001SB00001oXwntYAC') return 'Mavericks Household';
    if (id === '001EB00002pYzbMAC') return 'Acme Corp';
    if (id === 'a-whitfield') return 'Whitfield Household';
    if (id === 'a-bluebird') return 'Bluebird Logistics';
    return '';
  }

  // Derive a friendly row name for the freshly-created RFQ. Prefers the
  // captured prior policy reference, falls back to a generic 2026
  // renewal label per the lob/loc.
  //
  // Legacy callers passed the second arg as a boolean `isEb`; the newer
  // shape (used by handleIntakeContinue after the Home addition) passes
  // `{ isEb, isHome }`. Both are supported so existing call sites don't
  // have to change.
  _deriveRfqRowName(context, flowFlags) {
    let isEb = false;
    let isHome = false;
    if (typeof flowFlags === 'boolean') {
      isEb = flowFlags;
    } else if (flowFlags && typeof flowFlags === 'object') {
      isEb = !!flowFlags.isEb;
      isHome = !!flowFlags.isHome;
    }
    if (context?.priorPolicy) {
      // "2025 Mavericks Auto - Travelers" → "2026 Mavericks Auto Renewal"
      const yearMatch = context.priorPolicy.match(/^(\d{4})/);
      if (yearMatch) {
        const nextYear = String(Number(yearMatch[1]) + 1);
        const restAfterYear = context.priorPolicy
          .slice(yearMatch[0].length)
          .replace(/\s*[--].*$/, '')
          .trim();
        if (restAfterYear) return `${nextYear} ${restAfterYear} Renewal`;
      }
    }
    if (isEb) return `2026 ${context?.loc || 'Group Medical'}`;
    if (isHome) return '2026 Homeowners Renewal';
    return '2026 Auto Renewal';
  }

  // 4) "Open RFQ" from the data table inside the RFQs tab - re-open
  //    or focus an existing wizard tab without going through the modal.
  handleOpenRfqTab(event) {
    const { rfqId, rfqName, rfqLob, context } = event.detail || {};
    if (!rfqId) return;
    const existing = this.openRfqTabs.find((t) => t.id === rfqId);
    if (existing) {
      this.activeWorkspaceTabId = existing.id;
      return;
    }
    const isEb =
      this._isEbLob(rfqLob) ||
      this._isEbLob(context?.lob) ||
      this._isEbLob(context?.loc);
    // Home shares "Personal Lines" with PA, so key off the RFQ row's
    // lob field (which stores the LOC label for personal lines) or
    // the launch context's loc.
    const isHome =
      !isEb &&
      (rfqLob === 'Homeowners' ||
        context?.loc === 'Homeowners' ||
        context?.loc === 'home');
    // Prefer the row's LOC (stored in `lob` for both PL and EB) so a
    // Group Dental reopen doesn't inherit the account launch default
    // of Group Medical from launchPayload.
    const locFromRow =
      rfqLob &&
      rfqLob !== 'Employee Benefits' &&
      rfqLob !== 'P&C' &&
      rfqLob !== 'Life'
        ? rfqLob
        : null;
    const tabContext = {
      ...(context || {}),
      launchedFromAccount: true,
      renewalMode: 'shop_market',
      // Preserve the RFQ row id so the wizard can flip Draft -> Ready
      // through the risksubmitted handler below (mirrors the fresh
      // intake path).
      rfqId,
      tabLabel: rfqName || 'RFQ',
      ...(locFromRow ? { loc: locFromRow } : {}),
      ...(isEb ? { lob: 'Employee Benefits' } : {})
    };
    let type;
    if (isEb) type = 'rfq-eb';
    else if (isHome) type = 'rfq-home';
    else type = 'rfq-pa';
    const newTab = {
      id: rfqId,
      type,
      label: rfqName || 'RFQ',
      accountId: context?.accountId || null,
      context: tabContext
    };
    this.openRfqTabs = [...this.openRfqTabs, newTab];
    this.activeWorkspaceTabId = rfqId;
    this.rfqContext = tabContext;
  }

  // ── Persona switch (from c-top-nav's persona menu) ───────────
  // Demo stand-in for Salesforce Profile-based Home assignment.
  // When the user picks a new persona: seed mockData.currentUser,
  // reset the Run My Day sub-tab so a Principal doesn't linger on
  // Agency Revenue after switching to Producer, and land on the
  // persona-correct Run My Day so the switch feels like logging in
  // as a different user.
  handlePersonaChange(event) {
    const id = event.detail?.personaId;
    if (!id || !PERSONA_IDS.includes(id) || id === this.activePersonaId) return;
    setActivePersona(id);
    this.activePersonaId = id;
    this.rmdTab = null;
    this.route = ROUTES.RUN_MY_DAY;
  }

  // Run My Day's inner tabstrip (Principal only) bubbles this when
  // the user switches between "My Renewals" and "Agency Revenue".
  handleRmdTabChange(event) {
    const id = event.detail?.tab;
    if (RMD_TABS.includes(id)) this.rmdTab = id;
  }

  handleToggleSlack() {
    this.slackOpen = !this.slackOpen;
  }

  handleCloseSlack() {
    this.slackOpen = false;
  }

  handleRiskSubmitted(event) {
    const {
      accountName,
      accountId,
      rfqId,
      message,
      newStatus
    } = event.detail || {};

    // Flip the matching RFQ row's status in the account's bundle
    // (Draft -> Ready for Submission) so the Account Record Page's
    // RFQs list + the Submission Board reflect the freshly-saved
    // LOC. Falls back to the first Draft row for the account if the
    // wizard didn't supply an rfqId (belt + braces for legacy
    // callers). `newStatus` is normalized so short aliases from
    // legacy wizards ("Ready" / "Submitted") coerce to the full
    // canonical display names.
    const targetStatus = normalizeRfqStatus(newStatus || RFQ_STATUS.READY);
    if (accountId && this.accountRfqs?.[accountId]) {
      const rows = this.accountRfqs[accountId];
      let flipped = false;
      const nextRows = rows.map((r) => {
        if (flipped) return r;
        const matchesId = rfqId && r.id === rfqId;
        const matchesFallback = !rfqId && normalizeRfqStatus(r.status) === RFQ_STATUS.DRAFT;
        if (matchesId || matchesFallback) {
          flipped = true;
          return { ...r, status: targetStatus };
        }
        return r;
      });
      if (flipped) {
        this.accountRfqs = {
          ...this.accountRfqs,
          [accountId]: nextRows
        };
      }
    }

    // Only the submit-to-markets paths toast. Saving to the bundle
    // (newStatus === 'Ready for Submission') hands the broker straight
    // to the Add-Another-LOC modal, whose own subtitle already reads
    // "<LOC> is saved to the bundle" - a toast over it repeats copy
    // that is on screen.
    if (!newStatus && message) {
      this.toastMessage = message;
      this.toastKind = 'success';
      this.toastVisible = true;
    }

    // Slack is intentionally silent for the save-to-bundle path
    // (newStatus === 'Ready'). It only fires when the RFQ is actually
    // submitted to markets - either via the Submission Board's
    // Route-to-Carriers confirm (handleRouteBundle), the interstitial's
    // "Submit to Markets" shortcut (handleSubmitToMarkets), or the
    // legacy EB / Home wizards that still emit risksubmitted without
    // a newStatus payload (submit-to-markets direct).
    const isLegacySubmitToMarkets = !newStatus;
    if (isLegacySubmitToMarkets) {
      this.slackOpen = true;
      const drawer = this.template.querySelector('c-slack-drawer');
      if (drawer && typeof drawer.pushMessage === 'function') {
        drawer.pushMessage({
          author: 'Quote Bot',
          avatarColor: '#066afe',
          body: `*RFQ submitted to markets* - ${accountName || 'Account'} · Agentforce is routing to the target market set.`
        });
        setTimeout(() => {
          const stillThere = this.template.querySelector('c-slack-drawer');
          if (stillThere && typeof stillThere.pushMessage === 'function') {
            stillThere.pushMessage({
              author: 'Agentforce',
              avatarColor: '#7c3aed',
              body: 'Submission package generated · ACORD attached · carriers are reviewing now.'
            });
          }
        }, 700);
      }
      setTimeout(() => { this.slackOpen = false; }, 6000);
    }
    setTimeout(() => { this.toastVisible = false; }, 4500);
  }

  // Submission Board routed a bundle of Ready RFQs to the
  // configured carrier accounts. Flip each bundled RFQ row Ready
  // → Sent to Carrier so it drops off the board, then surface a
  // single SLDS 2 toast confirming the submission. Slack drawer is
  // intentionally NOT opened here - the journey ends on the toast.
  handleRouteBundle(event) {
    const { accountId, rfqIds, carrierNames, carrierIds, locIds } =
      event.detail || {};
    const carriers =
      Array.isArray(carrierNames) && carrierNames.length ? carrierNames : [];
    const routedCarrierIds =
      Array.isArray(carrierIds) && carrierIds.length ? carrierIds : [];
    // Fallback line for a routing that arrived without a per-line
    // breakdown. A bundle can span several lines, so this is only ever
    // right for a standalone RFQ.
    const routedLocId =
      Array.isArray(locIds) && locIds.length ? locIds[0] : null;
    // The board splits the broker's selection per line (a Home + Auto
    // bundle routed to every offered market goes to three auto markets
    // and three property markets, not four of each). Keyed by RFQ so
    // each line carries only the markets it was actually sent to.
    const assignments = Array.isArray(event.detail?.assignments)
      ? event.detail.assignments
      : [];
    const assignedByRfq = new Map(assignments.map((a) => [a.rfqId, a]));
    const routed = [];

    if (accountId && Array.isArray(rfqIds) && rfqIds.length && this.accountRfqs?.[accountId]) {
      const set = new Set(rfqIds);
      this.accountRfqs = {
        ...this.accountRfqs,
        [accountId]: this.accountRfqs[accountId].map((r) => {
          if (!set.has(r.id)) return r;
          const assigned = assignedByRfq.get(r.id);
          const lineCarrierIds = assigned?.carrierIds?.length
            ? assigned.carrierIds
            : routedCarrierIds;
          const lineCarrierNames = assigned?.carrierNames?.length
            ? assigned.carrierNames
            : carriers;
          const lineLocId = assigned?.locId || routedLocId;
          routed.push({
            id: r.id,
            name: r.name,
            locId: lineLocId,
            carrierIds: lineCarrierIds,
            carrierNames: lineCarrierNames
          });
          // quoteCount pins the RFQs tab to "No quotes yet" for the
          // moment the bundle leaves. Without it the row would fall
          // back to its seeded quote total and read as though the
          // market had already answered.
          //
          // quoteCarrierIds fills in as carriers answer, and is what
          // Compare Quotes turns into grid columns, so the grid shows
          // exactly the markets that responded. The line is recorded
          // alongside it because that decides which quote set applies -
          // this row's own line, not the bundle's first.
          return {
            ...r,
            status: RFQ_STATUS.SENT_TO_CARRIER,
            quoteCount: 0,
            quoteCarrierIds: [],
            quoteLocId: lineLocId
          };
        })
      };
    }

    const carriersDisplay = carriers.length
      ? carriers.join(', ')
      : 'the configured carriers';
    this.toastMessage = `RFQ has been submitted to ${carriersDisplay}. We'll update you once the quotes are received`;
    this.toastKind = 'success';
    this.toastVisible = true;

    // Slack drawer intentionally NOT opened on Route to Carriers -
    // the SLDS 2 toast (with a modal-style backdrop) is the only
    // journey-end affordance. Slack channel activity is still
    // available on demand from the channel card on the record page.
    setTimeout(() => { this.toastVisible = false; }, 5000);

    // Held rather than started here. The responses only begin once the
    // broker opens the RFQs tab, so the sequence is always watched from
    // the beginning: the row reads "Sent to Carrier" on arrival, then
    // flips to "Quotes Received" as each carrier answers. Starting on
    // send meant a broker who took a few seconds to navigate found the
    // quotes already in.
    this._pendingQuoteArrivals = { accountId, routed };
  }

  // The RFQs tab came into view. Release any routed bundle that is
  // waiting to hear back from its carriers.
  handleRfqListViewed(event) {
    const pending = this._pendingQuoteArrivals;
    if (!pending) return;
    const accountId = event.detail?.accountId;
    if (accountId && accountId !== pending.accountId) return;
    this._pendingQuoteArrivals = null;
    this._startQuoteArrivals(pending);
  }

  // ── Simulated carrier responses ───────────────────────────
  // The toast promises an update once quotes are received; this is
  // that update. Carriers answer one at a time, and each response
  // lands a notification in the global-header tray, bumps the RFQ's
  // quote count and moves it Sent to Carrier → Quotes Received.
  // One response per line-and-market pair, because that is what was
  // sent: a bundle routed to three auto markets and three property
  // markets is six answers, three against each line, not three shared
  // between them. Each line keeps its own running count, so the auto
  // row can read "2 of 3" while the homeowners row still reads "1 of 3".
  //
  // Pairs are interleaved by round rather than draining one line before
  // starting the next, so both rows fill in together the way a real
  // market would answer.
  _startQuoteArrivals({ accountId, routed }) {
    this._clearQuoteArrivals();
    if (!accountId || !routed.length) return;

    const lines = routed.map((r) => ({
      rfqId: r.id,
      rfqLabel: r.name,
      names: r.carrierNames?.length ? r.carrierNames : ['The market'],
      ids: Array.isArray(r.carrierIds) ? r.carrierIds : []
    }));
    const rounds = Math.max(...lines.map((l) => l.names.length));
    const pairs = [];
    for (let round = 0; round < rounds; round += 1) {
      for (const line of lines) {
        if (round >= line.names.length) continue;
        pairs.push({
          rfqId: line.rfqId,
          rfqLabel: line.rfqLabel,
          carrier: line.names[round],
          carrierId: line.ids[round] || null,
          received: round + 1,
          total: line.names.length
        });
      }
    }
    if (!pairs.length) return;

    this.quoteArrivalsActive = true;
    pairs.forEach((pair, i) => {
      // eslint-disable-next-line @lwc/lwc/no-async-operation
      const timer = setTimeout(() => {
        this._applyQuoteArrival({
          accountId,
          ...pair,
          isLast: i === pairs.length - 1
        });
      }, QUOTE_ARRIVAL_MS * (i + 1));
      this._quoteArrivalTimers.push(timer);
    });
  }

  _applyQuoteArrival({
    accountId,
    rfqId,
    carrier,
    carrierId,
    received,
    total,
    rfqLabel,
    isLast
  }) {
    const rows = this.accountRfqs?.[accountId];
    if (rows) {
      this.accountRfqs = {
        ...this.accountRfqs,
        [accountId]: rows.map((r) =>
          r.id === rfqId
            ? {
                ...r,
                status: RFQ_STATUS.QUOTES,
                quoteCount: received,
                quoteCarrierIds: carrierId
                  ? [...(r.quoteCarrierIds || []), carrierId]
                  : r.quoteCarrierIds || []
              }
            : r
        )
      };
    }

    // The window closes on the last response across every routed line,
    // which is the record page's cue to hand the notification tray back.
    if (isLast) this.quoteArrivalsActive = false;

    // One running row per RFQ. A carrier answering is an update to
    // "N of M for this line", so the earlier row for the same RFQ is
    // replaced rather than stacked - six arrivals across two lines
    // leave two rows in the tray, not six.
    const runningId = `quote-${accountId}-${rfqId}`;
    this.notifications = [
      {
        id: `${runningId}-${received}`,
        runningId,
        title: `${received} of ${total} quotes received`,
        body: `${carrier} responded to your RFQ ${rfqLabel}.`,
        timestamp: Date.now(),
        unread: true,
        accountId,
        rfqId
      },
      ...this.notifications.filter((n) => n.runningId !== runningId)
    ];
  }

  // The quote ids for one line, narrowed to the carriers it was routed
  // to in this session. Returns an empty list when the line has not
  // been routed here, which leaves the caller on its own default.
  _routedQuoteIds(applicationId, accountId) {
    if (!applicationId || !accountId) return [];
    const rows = this.accountRfqs?.[accountId];
    if (!Array.isArray(rows)) return [];
    const row = rows.find(
      (r) =>
        r.quoteLocId &&
        QUOTE_APP_BY_LOC_ID[r.quoteLocId] === applicationId &&
        Array.isArray(r.quoteCarrierIds) &&
        r.quoteCarrierIds.length
    );
    return row ? quoteIdsForCarriers(row.quoteLocId, row.quoteCarrierIds) : [];
  }

  _clearQuoteArrivals() {
    this._quoteArrivalTimers.forEach((t) => clearTimeout(t));
    this._quoteArrivalTimers = [];
    this._pendingQuoteArrivals = null;
    this.quoteArrivalsActive = false;
  }

  handleNotificationsRead() {
    this.notifications = this.notifications.map((n) =>
      n.unread ? { ...n, unread: false } : n
    );
  }

  handleNotificationOpen(event) {
    const id = event.detail?.id;
    if (!id) return;
    const hit = this.notifications.find((n) => n.id === id);
    this.notifications = this.notifications.map((n) =>
      n.id === id ? { ...n, unread: false } : n
    );
    // A client reply carries its message with it, so activating the
    // notification reads the mail rather than just clearing a badge.
    if (hit?.reply) {
      // The comparison modal is usually still sitting on its sent
      // confirmation. Close it rather than stacking a second dialog on
      // top, so the reply is the only thing on screen.
      this.quoteModalOpen = false;
      this.clientReply = hit.reply;
      this.clientReplyOpen = true;
    }
  }

  handleClientReplyClose() {
    this.clientReplyOpen = false;
  }

  // Invite confirmed in the reply modal. Seat the meeting on Run My Day
  // and confirm it, so the broker's next stop already has the call on
  // it. c-run-my-day reads runMyDayMeetings straight from the data
  // module and stays mounted, so the revision bump below is what makes
  // it re-read; without it the new meeting would only appear after some
  // unrelated render.
  handleScheduleMeeting(event) {
    const d = event.detail || {};
    if (!d.dateKey) return;
    const attendee = d.attendee || 'the client';
    const account = d.accountName || attendee;
    const booked = addRunMyDayMeeting({
      name: `Proposal review - ${account}`,
      dateKey: d.dateKey,
      startTime: d.startTime,
      endTime: d.endTime,
      relatedRecord: account,
      accountId: d.accountId || null,
      lineLabel: d.lineLabel || null,
      eventSubject: d.subject || `Proposal review - ${account}`
    });
    if (!booked) return;

    // Give the booked meeting a brief of its own. Without this it has no
    // entry in meetingPrepById and falls back to whichever playbook the
    // account resolves to - a renewal brief, when this meeting is a
    // proposal review the client has already replied to.
    registerMeetingPrep(
      booked.id,
      buildProposalReviewPrep({
        meetingId: booked.id,
        accountId: d.accountId || null,
        accountName: account,
        attendee: d.attendee || null,
        leadCarrier: d.leadCarrier || null,
        lineLabel: d.lineLabel || null,
        startTime: d.startTime,
        subject: d.subject
      })
    );

    seedCompanionMeetings(booked.dateKey);

    this.rmdFocusDateKey = booked.dateKey;
    this.rmdHighlightMeetingId = booked.id;
    this.rmdMeetingsRevision += 1;
    this.activeWorkspaceTabId = HOME_TAB_ID;
    this.clientReplyOpen = false;
    // The booked meeting animates into the Run My Day carousel, which
    // is the confirmation - no toast.
  }

  // ── Client response to an emailed proposal ────────────────────
  // The Quote Comparison modal just sent a proposal. The client answers
  // a beat later, through the same tray the carrier quotes use, so the
  // broker's inbound work all arrives in one place.
  handleProposalSent(event) {
    const d = event.detail || {};
    this._clearClientReply();

    // The send is the broker's own action and needs no follow-up, so it
    // confirms as a toast and the modal closes behind it. It used to
    // land on an in-modal success panel, which left a dialog sitting
    // over the record with nothing to do on it.
    this.quoteModalOpen = false;
    const recipient = d.recipientName || 'the client';
    this.toastMessage = `Proposal emailed to ${recipient}. We'll let you know when they respond.`;
    this.toastKind = 'success';
    this.toastVisible = true;
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    setTimeout(() => { this.toastVisible = false; }, 4500);

    const reply = this._buildClientReply(d);
    if (!reply) return;

    // Quote-arrival rows are spent once a proposal has gone out. Mark
    // them read now so the tray that opens on the reply only has that
    // one unread item in it.
    this.notifications = this.notifications.map((n) =>
      n.unread ? { ...n, unread: false } : n
    );

    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this._clientReplyTimer = setTimeout(() => {
      this._clientReplyTimer = null;
      this.notifications = [
        {
          id: `client-reply-${Date.now()}`,
          title: `${d.recipientName || 'The client'} replied to your proposal`,
          body: `Re: ${d.subject || 'your proposal'}`,
          timestamp: Date.now(),
          unread: true,
          accountId: d.accountId || null,
          actionLabel: 'See email reply',
          reply
        },
        ...this.notifications
      ];
      this.clientReplySignal += 1;
    }, CLIENT_REPLY_MS);
  }

  // The reply itself. Written here rather than in the modal because the
  // shell knows who the broker is, and the copy is addressed to them.
  _buildClientReply(d) {
    const name = d.recipientName || '';
    if (!name) return null;
    const firstName = name.split(' ')[0];
    const broker = (this.activePersona?.name || '').split(' ')[0] || 'there';
    const line = d.lineLabel || 'policy';
    const lead = d.leadCarrier || 'the recommended option';
    return {
      fromName: name,
      fromEmail: d.recipientEmail || '',
      fromInitials: name
        .split(' ')
        .map((p) => p.charAt(0))
        .join('')
        .slice(0, 2)
        .toUpperCase(),
      subject: `Re: ${d.subject || 'Your renewal options'}`,
      receivedLabel: 'Just now',
      // The scheduling step opens its datepicker here: the client asked
      // about "tomorrow morning" relative to the day they wrote, so the
      // reply's own date is the useful starting point.
      receivedDateKey: toDateKey(today()),
      accountName: d.accountName || '',
      accountId: d.accountId || null,
      // Carried so the meeting booked off this reply can name the
      // carrier the client picked and the line it applies to.
      leadCarrier: d.leadCarrier || null,
      lineLabel: d.lineLabel || null,
      paragraphs: [
        { key: 'p1', text: `Hi ${broker},` },
        {
          key: 'p2',
          text:
            `Thanks for turning this around so quickly. I went through the ` +
            `comparison and ${lead} looks closest to what we need - the ` +
            `coverage difference matters more to us than the premium gap.`
        },
        {
          key: 'p3',
          text:
            `Two things before we bind: can you confirm the deductible ` +
            `applies per claim rather than annually, and can we move the ` +
            `effective date to line up with our other ${line} renewal?`
        },
        {
          key: 'p4',
          text: `Happy to jump on a call tomorrow morning if that is easier.`
        },
        { key: 'p5', text: `Thanks,` },
        { key: 'p6', text: firstName }
      ],
      quotedSubject: d.subject || '',
      quotedSentLabel: 'a few moments ago'
    };
  }

  _clearClientReply() {
    if (this._clientReplyTimer) {
      clearTimeout(this._clientReplyTimer);
      this._clientReplyTimer = null;
    }
  }

  // Broker picked a quote on the QuinStreet rating screen after
  // clicking Route to Carriers. Each routed RFQ transitions to
  // "Sent to Carrier" (which drops it off the Submission Board via
  // BOARD_VISIBLE_STATUSES) and we toast the carrier the broker
  // selected. Event detail:
  //   { accountId, accountName, rfqIds: string[], selectedCarrier,
  //     lob }
  handleRatingComplete(event) {
    const { accountId, rfqIds, selectedCarrier } = event.detail || {};
    if (
      !accountId ||
      !Array.isArray(rfqIds) ||
      !rfqIds.length ||
      !this.accountRfqs?.[accountId]
    ) {
      return;
    }
    // Route through the shared status setter so any per-row side
    // effects (menu items, timestamps, etc.) stay consistent with
    // the other lifecycle transitions. No per-row toast - we fire
    // one summary toast for the whole batch below.
    for (const id of rfqIds) {
      this._setRfqStatus(accountId, id, RFQ_STATUS.SENT_TO_CARRIER);
    }
    // No toast: selecting a quote is not one of the three moments that
    // earn one. The status pills on the board carry the transition.
  }

  // Row-level lifecycle actions coming from the RFQs tab (⋮ menu) and
  // the Submission Board (⋮ menu). Centralized here so both surfaces
  // stay in sync on Draft ↔ Ready ↔ Sent to Carrier ↔ Quotes ↔ Bound
  // transitions. `compare_quotes` is forwarded from
  // c-account-record-page as a separate `openquotecompare` event and
  // does NOT come through here. Supported actions:
  //   • edit               - open (or focus) the RFQ workspace tab
  //   • add_loc            - open Intake modal in Add-Another-LOC mode
  //   • add_to_board       - Draft → Ready for Submission
  //   • remove_from_board  - Ready for Submission → Draft
  //   • delete             - drop the row from accountRfqs and close
  //                          any matching workspace tab
  handleRfqAction(event) {
    const { id, action } = event.detail || {};
    if (!id || !action) return;
    // Locate the row + its owning account.
    let accountId = null;
    let row = null;
    for (const [aid, rows] of Object.entries(this.accountRfqs || {})) {
      const match = (rows || []).find((r) => r.id === id);
      if (match) {
        accountId = aid;
        row = match;
        break;
      }
    }
    if (!row || !accountId) return;

    switch (action) {
      case 'edit':
        this.handleOpenRfqTab({
          detail: {
            rfqId: id,
            rfqName: row.name,
            rfqLob: row.lob,
            context: {
              accountId,
              loc: row.lob,
              lob: this._isEbLob(row.lob)
                ? 'Employee Benefits'
                : undefined
            }
          }
        });
        return;
      case 'add_loc':
        this._openAddAnotherLoc(accountId, row);
        return;
      case 'add_to_board':
        this._setRfqStatus(accountId, id, RFQ_STATUS.READY, {
          message: `${row.name || 'RFQ'} added to the Submission Board.`
        });
        return;
      case 'remove_from_board':
        this._setRfqStatus(accountId, id, RFQ_STATUS.DRAFT);
        return;
      case 'delete':
        this._deleteRfqRow(accountId, id, row);
        return;
      default:
        return;
    }
  }

  // Immutably swap a single RFQ row's status. Emits a toast so the
  // broker sees the transition confirmed on both the RFQs tab and
  // the Submission Board.
  _setRfqStatus(accountId, rfqId, nextStatus, { message, kind } = {}) {
    const rows = this.accountRfqs?.[accountId];
    if (!Array.isArray(rows)) return;
    const idx = rows.findIndex((r) => r.id === rfqId);
    if (idx === -1) return;
    const nextRows = rows.slice();
    nextRows[idx] = { ...rows[idx], status: nextStatus };
    this.accountRfqs = { ...this.accountRfqs, [accountId]: nextRows };
    if (message) {
      this.toastMessage = message;
      this.toastKind = kind || 'success';
      this.toastVisible = true;
      setTimeout(() => { this.toastVisible = false; }, 4000);
    }
  }

  // Remove an RFQ row entirely; also close any open workspace tab
  // for the same RFQ so we don't leave orphan tabs behind.
  _deleteRfqRow(accountId, rfqId, row) {
    const rows = this.accountRfqs?.[accountId];
    if (!Array.isArray(rows)) return;
    this.accountRfqs = {
      ...this.accountRfqs,
      [accountId]: rows.filter((r) => r.id !== rfqId)
    };
    const openTab = (this.openRfqTabs || []).find((t) => t.id === rfqId);
    if (openTab) {
      // Reuse the existing tab-close handler so tab activation
      // fallback / sibling-LOC promotion behaves consistently.
      this.handleWorkspaceTabClose({ detail: { tabId: rfqId } });
    }
    // No toast: the row disappearing is the confirmation.
  }

  // Open the RFQ Intake modal in Add-Another-LOC mode, seeded from
  // the row's account so the picker filters occupied LOCs correctly.
  // Emits `occupiedLocLabels` (display LOC strings) - the same
  // contract workspace "Add Another LOC" already uses. Legacy
  // `occupiedLocs` keying was never read by c-rfq-intake-modal.
  _openAddAnotherLoc(accountId, row) {
    const occupiedLocLabels = (this.accountRfqs?.[accountId] || [])
      .map((r) => r.lob)
      .filter(Boolean);
    const isEb = this._isEbLob(row?.lob);
    this.intakeContext = {
      accountId,
      accountName: this._accountNameForBase({ accountId }),
      lob: isEb ? 'Employee Benefits' : 'Personal Lines',
      isAddingLoc: true,
      occupiedLocLabels,
      sourceRfqId: row?.id || null,
      sourceLocLabel: row?.lob || null
    };
    this.intakeModalOpen = true;
  }

  handleToastDismiss() {
    this.toastVisible = false;
  }

  // Generic toast request from child components (e.g. EB Plan tab).
  handleChildToast(event) {
    const { message, kind } = event.detail || {};
    this.toastMessage = message || 'Done.';
    this.toastKind = kind || 'success';
    this.toastVisible = true;
    setTimeout(() => { this.toastVisible = false; }, 4500);
  }

  handleSlackAction(event) {
    const { actionId, applicationId } = event.detail || {};
    if (actionId !== 'open_compare_modal') return;
    if (applicationId === 'rfq-acme-001') {
      this.quoteModalContext = {
        applicationId: 'rfq-acme-001',
        applicationName: 'Acme Manufacturing - Group Medical',
        accountName: 'Acme Manufacturing',
        accountId: '001EB00002pYzbMAC',
        flow: 'eb',
        locLabel: 'Group Medical'
      };
    } else if (applicationId === 'rfq-mavericks-001') {
      this.quoteModalContext = {
        applicationId: 'rfq-mavericks-001',
        applicationName: 'Mavericks Household - Personal Auto',
        accountName: 'Mavericks Household',
        accountId: '001SB00001oXwntYAC',
        flow: 'pa',
        locLabel: 'Personal Auto'
      };
    } else if (applicationId === 'rfq-mavericks-home-001') {
      this.quoteModalContext = {
        applicationId: 'rfq-mavericks-home-001',
        applicationName: 'Mavericks Household - Homeowners',
        accountName: 'Mavericks Household',
        accountId: '001SB00001oXwntYAC',
        flow: 'home',
        locLabel: 'Homeowners'
      };
    } else {
      this.quoteModalContext = this.rfqContext
        ? { ...this.rfqContext, flow: this.isEbFlow ? 'eb' : 'pa' }
        : {
            applicationId: 'rfq-mavericks-001',
            applicationName: 'Mavericks Household - Personal Auto',
            accountName: 'Mavericks Household',
            accountId: '001SB00001oXwntYAC',
            flow: 'pa',
            locLabel: 'Personal Auto'
          };
    }
    // Scope the grid to the markets this line was actually routed to.
    // Left empty, the Slack entry point opens every quote on file for
    // the line, which on a multi-line bundle means columns for markets
    // the line was never submitted to.
    this.quoteModalQuoteIds = this._routedQuoteIds(
      this.quoteModalContext?.applicationId,
      this.quoteModalContext?.accountId
    );
    this.quoteModalOpen = true;
    this.slackOpen = false;
  }

  // "Compare Quotes" from the Account Record Page RFQs table - open the
  // shared Quote Comparison modal scoped to that RFQ's account + flow.
  // Open an Insurance Policy as a new console workspace tab. The Account
  // Record Page shell mounts c-insurance-policy-record-page for P&C lines and
  // c-eb-policy-record-page for Employee Benefits.
  handleOpenPolicyTab(event) {
    const d = event.detail || {};
    if (!d.id) return;
    const existing = this.openRfqTabs.find((t) => t.id === d.id);
    if (existing) {
      this.activeWorkspaceTabId = existing.id;
      return;
    }
    const newTab = {
      id: d.id,
      type: 'policy',
      label: d.name || 'Insurance Policy',
      accountId: d.accountId || null,
      context: {
        policyName: d.name,
        policyNumber: d.number,
        policyLob: d.lob,
        policySeed: d.seed || null
      }
    };
    this.openRfqTabs = [...this.openRfqTabs, newTab];
    this.activeWorkspaceTabId = d.id;
  }

  handleOpenQuoteCompare(event) {
    const d = event.detail || {};
    this.quoteModalQuoteIds = Array.isArray(d.quoteIds) ? d.quoteIds : [];
    this.quoteModalContext = {
      applicationId: d.applicationId,
      applicationName: d.applicationName,
      accountName: d.accountName,
      accountId: d.accountId,
      flow: d.flow,
      locLabel: d.locLabel
    };
    this.quoteModalOpen = true;
  }

  handleQuoteModalClose() {
    this.quoteModalOpen = false;
  }

  handlePolicyBound(event) {
    const { policy, accountId, accountName } = event.detail || {};
    if (!policy) return;

    // Modal was the source - close it first.
    this.quoteModalOpen = false;

    // No toast: binding is confirmed by the bound-policy state on the
    // record, and it is not one of the three moments that toast.

    if (accountId && !this.boundAccountIds.includes(accountId)) {
      this.boundAccountIds = [...this.boundAccountIds, accountId];
    }

    // Slack broadcast - Quote Bot announcement + Agentforce follow-up.
    this.slackOpen = true;
    const drawer = this.template.querySelector('c-slack-drawer');
    if (drawer && typeof drawer.pushMessage === 'function') {
      const premiumLabel = `$${(policy.totalPremium || 0).toLocaleString()}`;
      const commission = Math.round((policy.totalPremium || 0) * 0.12);
      drawer.pushMessage({
        author: 'Quote Bot',
        avatarColor: '#066afe',
        body: `*New policy bound* - ${accountName || 'Account'} · Commercial Auto · ${policy.carrierName} · ${premiumLabel}/yr · Effective ${formatUsDate(policy.effectiveDate)} → ${formatUsDate(policy.expirationDate)}`
      });
      setTimeout(() => {
        const stillThere = this.template.querySelector('c-slack-drawer');
        if (stillThere && typeof stillThere.pushMessage === 'function') {
          stillThere.pushMessage({
            author: 'Agentforce',
            avatarColor: '#7c3aed',
            body: `Premium volume +${premiumLabel} · Commission earned ~$${commission.toLocaleString()} (12%) · ${policy.policyNumber} added to *Active Policies*.`
          });
        }
      }, 800);
    }
    setTimeout(() => {
      this.slackOpen = false;
    }, 5500);
  }

  // ── URL sync (hard-refresh persistence) ───────────────────────
  // Centralised query-string mirror so hitting refresh keeps the
  // broker on the same top-level screen. We push canonical state
  // (route + active workspace tab + slack/compare/context flags)
  // into the URL via `history.replaceState` after every render so
  // it stays in sync without polluting browser history.
  //
  // Scope: navigation/screen state only. Mid-wizard form data and
  // transient modals (intake, etc.) are deliberately not persisted
  // - restoring them mid-flow on refresh would be surprising.
  renderedCallback() {
    this._syncUrl();
  }

  disconnectedCallback() {
    this._clearQuoteArrivals();
    this._clearClientReply();
  }

  _syncUrl() {
    if (typeof window === 'undefined' || !window.history) return;
    const url = new URL(window.location.href);
    const params = url.searchParams;

    // Route - omit when it's the default so the URL stays clean. A
    // focused meeting tab is written as `route=meeting-center` plus the
    // playbook id, and takes precedence over the top-level route param
    // because the top-level route is always account-record-page while a
    // meeting is open.
    const activeMeetingId = this._activeMeetingId;
    if (activeMeetingId) {
      params.set('route', ROUTES.MEETING_CENTER);
      params.set('meeting', activeMeetingId);
    } else {
      params.delete('meeting');
      if (this.route && this.route !== ROUTES.ACCOUNT_RECORD_PAGE) {
        params.set('route', this.route);
      } else {
        params.delete('route');
      }
    }

    // Active workspace tab - only persist ids that survive a
    // refresh (account tabs + Setup). Dynamic RFQ tabs are
    // session-scoped, so writing their ids would leave dangling
    // references after a refresh. Meeting tabs carry their own
    // `meeting` param above, so they're excluded here too.
    if (
      !activeMeetingId &&
      this.activeWorkspaceTabId &&
      this.activeWorkspaceTabId !== HOME_TAB_ID &&
      PERSISTABLE_TAB_IDS.has(this.activeWorkspaceTabId)
    ) {
      params.set('tab', this.activeWorkspaceTabId);
    } else {
      params.delete('tab');
    }

    // Demo overlay - sticky for the whole session so every deep-link
    // written during a demo keeps the hotspots on.
    if (this.demoMode) {
      params.set('demo', '1');
    } else {
      params.delete('demo');
    }

    // Slack drawer.
    if (this.slackOpen) {
      params.set('slack', 'open');
    } else {
      params.delete('slack');
    }

    // Quote Comparison modal.
    if (this.quoteModalOpen) {
      params.set('compare', 'open');
      // Carry the picked flow so refresh restores it.
      if (this.quoteModalContext?.flow) {
        params.set('flow', this.quoteModalContext.flow);
      }
    } else {
      params.delete('compare');
      params.delete('flow');
    }

    // Renewal alert context - used by deep-links and refresh to
    // restore "which alert the broker was triaging".
    if (this.rfqContext?.id) {
      params.set('context', this.rfqContext.id);
    } else {
      params.delete('context');
    }

    // Persona - omit when it's the default so the URL stays clean
    // for the vast majority of demo runs (Producer / Elena Rostova).
    if (this.activePersonaId && this.activePersonaId !== DEFAULT_PERSONA_ID) {
      params.set('persona', this.activePersonaId);
    } else {
      params.delete('persona');
    }

    // Run My Day sub-tab (Principal only). Only persist on the
    // Run My Day route - other routes don't render the tabstrip so
    // leaving the param around would be misleading.
    if (this.rmdTab && this.route === ROUTES.RUN_MY_DAY) {
      params.set('rmdTab', this.rmdTab);
    } else {
      params.delete('rmdTab');
    }

    const qs = params.toString();
    const next = `${url.pathname}${qs ? `?${qs}` : ''}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) {
      window.history.replaceState(null, '', next);
    }
  }
}
