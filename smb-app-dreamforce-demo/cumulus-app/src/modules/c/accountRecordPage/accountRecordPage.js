import { LightningElement, api, track } from 'lwc';
import {
  slackData,
  MOCK_ACCOUNTS,
  currentUser,
  getPersona,
  quotes as ALL_QUOTES,
  QUOTE_APP_BY_LOC_ID,
  quoteIdsForCarriers
} from 'data/mockData';
import { getClient360 } from 'data/client360';

function initials(name = '') {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Two mock accounts side-by-side in the workspace tab strip. Each account
// drives its own Highlights Panel + Salesforce URL bar + Guided RFQ launch
// payload. Switching tabs swaps the active account in place.
//
// NOTE: Both accounts are owned by the same broker (Elena Rostova) - we're
// simulating a single-producer "Run My Day" book of business so every
// owner-facing field is consistent across the app shell.
const ACCOUNTS = {
  '001SB00001oXwntYAC': {
    id: '001SB00001oXwntYAC',
    name: 'Mavericks Household',
    ownerName: 'Elena Rostova',
    industry: 'Personal Lines',
    fields: [
      { id: 'type', label: 'Type', value: 'Customer - Direct' },
      { id: 'phone', label: 'Phone', value: '(813) 555-0198' },
      { id: 'website', label: 'Website', value: 'N/A' },
      { id: 'owner', label: 'Account Owner', value: 'Elena Rostova', isOwner: true }
    ],
    launch: {
      lob: 'Personal Lines',
      loc: 'Personal Auto',
      priorPolicy: '2025 Mavericks Auto - Apex Mutual',
      priorPolicyId: 'AM-PA-2025-001-MVK',
      priorPolicyTerm: 'Oct 13, 2025 - Oct 13, 2026'
    }
  },
  '001EB00002pYzbMAC': {
    id: '001EB00002pYzbMAC',
    name: 'Acme Manufacturing',
    ownerName: 'Elena Rostova',
    industry: 'Manufacturing',
    fields: [
      { id: 'type', label: 'Type', value: 'Customer - Direct' },
      { id: 'phone', label: 'Phone', value: '(312) 555-8821' },
      { id: 'website', label: 'Website', value: 'www.acmecorp.com' },
      { id: 'owner', label: 'Account Owner', value: 'Elena Rostova', isOwner: true }
    ],
    launch: {
      lob: 'Employee Benefits',
      loc: 'Group Medical',
      priorPolicy: '2024 Acme Group Medical - UnitedHealthcare (45 Employees)'
    }
  },
  'a-whitfield': {
    id: 'a-whitfield',
    name: 'Whitfield Household',
    ownerName: 'Elena Rostova',
    industry: 'Personal Lines',
    fields: [
      { id: 'type', label: 'Type', value: 'Customer - Direct' },
      { id: 'phone', label: 'Phone', value: '(941) 555-0142' },
      { id: 'website', label: 'Website', value: 'N/A' },
      { id: 'owner', label: 'Account Owner', value: 'Elena Rostova', isOwner: true }
    ],
    launch: {
      lob: 'Personal Lines',
      loc: 'Personal Auto',
      priorPolicy: '2025 Whitfield Auto - Gulfstream Mutual',
      priorPolicyId: 'POL-WHIT-AUTO-2025',
      priorPolicyTerm: 'Oct 1, 2025 - Oct 1, 2026'
    }
  },
  'a-bluebird': {
    id: 'a-bluebird',
    name: 'Bluebird Logistics',
    ownerName: 'Elena Rostova',
    industry: 'Transportation',
    fields: [
      { id: 'type', label: 'Type', value: 'Customer - Direct' },
      { id: 'phone', label: 'Phone', value: '(901) 555-3370' },
      { id: 'website', label: 'Website', value: 'www.bluebirdlogistics.com' },
      { id: 'owner', label: 'Account Owner', value: 'Elena Rostova', isOwner: true }
    ],
    launch: {
      lob: 'Commercial Lines',
      loc: 'Commercial Auto',
      priorPolicy: '2025 Bluebird Fleet - Great Lakes Casualty',
      priorPolicyId: 'POL-BLUE-CA-2025',
      priorPolicyTerm: 'Jan 1, 2025 - Jan 1, 2026'
    }
  }
};

// The Insurance Policies list stores the coverage line in its `lob`
// column ("Personal Auto", "Homeowners", ...), which is what the RFQ
// intake modal calls a Line of Coverage. Rows whose value isn't a LOC
// the modal offers (e.g. Acme's "Employee Benefits", Bluebird's
// "Workers Compensation") fall back to the account's launch default.
const POLICY_LINE_TO_LOC = {
  'Personal Auto': 'Personal Auto',
  Homeowners: 'Homeowners',
  'Group Medical': 'Group Medical',
  'Group Dental': 'Group Dental',
  'Group Vision': 'Group Vision'
};

// Which compare-grid row set a line of coverage reads best in. The
// grid ships three: 'pa' (liability + physical damage), 'home'
// (property + policy coverages) and 'eb' (benefit tiers). Property
// lines share the 'home' set - a renters comparison wants personal
// property and loss of use, not vehicles.
const COMPARE_FLOW_BY_LOC = {
  'Personal Auto': 'pa',
  Homeowners: 'home',
  Renters: 'home',
  Umbrella: 'pa',
  'Group Medical': 'eb',
  'Group Dental': 'eb',
  'Group Vision': 'eb',
  'Group Life': 'eb'
};

// Accounts that have a full record page behind them. This no longer
// decides the tab strip - see _openAccountIds for that - it seeds the
// record-body fallbacks so the highlights panel always has an account
// to render even before the broker opens one.
const ACCOUNT_ORDER = ['001SB00001oXwntYAC', '001EB00002pYzbMAC'];

// Stable workspace-tab IDs for each account. Composed once and reused as
// keys for the workspace tab strip + the activeWorkspaceTabId comparator.
const TAB_ID_BY_ACCOUNT = {
  '001SB00001oXwntYAC': 'account-mavericks',
  '001EB00002pYzbMAC': 'account-acme',
  'a-whitfield': 'account-whitfield',
  'a-bluebird': 'account-bluebird'
};
// Stable tab id for the Setup workspace tab - opened from the App
// Launcher → Setup link. Lives alongside the account / RFQ tabs so the
// broker can switch back to any other tab without losing setup state.
// How long the notification tray lingers after the last carrier has
// answered, before it closes and hands the page back.
const NOTIF_AUTOCLOSE_MS = 1500;

const SETUP_TAB_ID = 'tab-setup';
const REVENUE_TAB_ID = 'tab-revenue-intelligence';
const DASHBOARDS_TAB_ID = 'tab-dashboards';
// Stable tab id for the standalone Client 360 dashboard - opened from
// the App Launcher. Mirrors the Setup tab pattern exactly.
const CLIENT360_TAB_ID = 'tab-client360';
// Stable tab id for the "Home" workspace tab (Run My Day). Home is
// always present in the tab strip (like Recently Viewed) and its
// panel mounts c-run-my-day inline so the SF workspace chrome
// (Mavericks / Acme / RFQ tabs) stays intact when the broker clicks
// Home. Must match HOME_TAB_ID in c-app to survive URL persistence.
const HOME_TAB_ID = 'tab-home';
// Stable tab id for the org's Setup home, reached from the global-header
// gear menu. Separate from SETUP_TAB_ID so the App Launcher → Setup
// workspace (c-agentforce-setup) keeps its own state and tab pill.
const SETUP_HOME_TAB_ID = 'tab-setup-home';
// Stable tab id for the Agentforce Coworker landing page, opened from the
// global-header Ask pill. The org routes Ask to /lightning/coworker, which
// lands as its own workspace tab rather than a docked panel, so the demo
// mirrors that with a tab of its own.
const COWORKER_TAB_ID = 'tab-coworker';

// SLDS 2 standard object icon per workspace-tab `kind`. Keyed off the
// `kind` stamp every entry group in `workspaceTabs` already carries, so
// the strip and its glyphs cannot drift apart. Setup is absent on
// purpose: its gear is a utility icon and the template branches on
// `isSetup` before it ever consults this map.
const TAB_ICON_BY_KIND = {
  account: 'account',
  rfq: 'quotes',
  policy: 'policy',
  client360: 'customer360',
  revenue: 'forecasts',
  dashboards: 'dashboard',
  meeting: 'event',
  coworker: 'agentforce'
};

// Stamps the icon branch flags onto a tab row. The flags are mutually
// exclusive so the template can use one plain `lwc:if` per glyph, which
// is the only way to vary raw SVG across a `for:each` in LWC. Entity
// tabs share one `_object` class because the strip paints every object
// glyph the same flat grey; there is no per-entity hue here.
function withTabIcon(tab) {
  const icon = tab.isSetup ? '' : TAB_ICON_BY_KIND[tab.kind] || '';
  // The Agentforce sparkle is a utility glyph, not an entity badge, so it
  // opts out of the flat-grey `_object` wash and keeps the brand tint the
  // org paints on its Ask tab.
  // standard:default takes the same wash, so the branch keys off "not
  // Setup" rather than "has a mapped glyph".
  let iconClass = 'sf-tab-icon';
  if (icon === 'agentforce') iconClass = 'sf-tab-icon sf-tab-icon_agentforce';
  else if (!tab.isSetup) iconClass = 'sf-tab-icon sf-tab-icon_object';
  return {
    ...tab,
    iconClass,
    isIconAccount: icon === 'account',
    isIconQuotes: icon === 'quotes',
    isIconPolicy: icon === 'policy',
    isIconCustomer360: icon === 'customer360',
    isIconForecasts: icon === 'forecasts',
    isIconDashboard: icon === 'dashboard',
    isIconEvent: icon === 'event',
    isIconAgentforce: icon === 'agentforce',
    isIconFallback: !icon && !tab.isSetup
  };
}

// Setup Menu rows that carry a leading glyph. `tone` selects the fill
// class; `disc` rows render the glyph in white on a filled circle.
const SETUP_MENU_PRIMARY = [
  { id: 'setup', label: 'Setup', glyph: 'gear', tone: 'cloud' },
  { id: 'salesforce-go', label: 'Salesforce Go', glyph: 'gear', tone: 'teal' },
  {
    id: 'your-account',
    label: 'Your Account',
    glyph: 'account',
    tone: 'neutral'
  },
  {
    id: 'agentforce-vibes',
    label: 'Agentforce Vibes',
    glyph: 'code',
    tone: 'disc'
  },
  { id: 'web-console', label: 'Web Console', glyph: 'code', tone: 'disc' }
];

// Rows below the divider. No leading glyph, shorter row height.
const SETUP_MENU_SECONDARY = [
  { id: 'edit-page', label: 'Edit Page' },
  { id: 'edit-object', label: 'Edit Object' }
];

const ACCOUNT_BY_TAB_ID = Object.fromEntries(
  Object.entries(TAB_ID_BY_ACCOUNT).map(([k, v]) => [v, k])
);

// ── Rate Plan management (Account → Policies → Rate Plans) ───────
// Source of truth for the Insurance Rate Plans data table on the
// account record. Previously the same surface lived inside the EB RFQ
// Enrollment Headcount step; it has been moved here so the broker sees
// every rate plan for the account, regardless of which RFQ created it.
const RATE_PLAN_TYPE_OPTIONS = [
  'Fully Insured Health',
  'Per Person Per Month',
  'Per Employee Per Month',
  'Per Member Per Month',
  'Flat',
  'Benefit Volume',
  'Covered Payroll Volume',
  'Fully Insured Equivalent'
];
const RATE_PLAN_FREQUENCY_OPTIONS = [
  'Monthly',
  'Quarterly',
  'Semi-Annual',
  'Annual'
];
const RATE_PLAN_CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'MXN', label: 'MXN - Mexican Peso' }
];
const RATE_PLAN_GEO_STATES = [
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' }, { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' }, { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' }, { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' }, { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' }, { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' }, { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' }, { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' }, { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' }
];
// Eligible tier ids map 1:1 to the EB Enrollment Headcount tier keys.
const RATE_PLAN_TIER_DEFS = [
  { id: 'employeeOnly',     label: 'Employee'             },
  { id: 'employeeSpouse',   label: 'Employee + Spouse'    },
  { id: 'employeeFamily',   label: 'Employee + Family'    },
  { id: 'employeeChildren', label: 'Employee + Children'  }
];
const DEFAULT_RATE_PLAN_FORM = {
  type: '',
  geoState: '',
  frequency: '',
  currency: 'USD',
  eligibleTiers: []
};
// Per-account seed rate plans so the data table on Policies surfaces
// realistic prior records without depending on the RFQ flow having
// created any. The EB account (Acme) has the catalog Group Medical
// rate plans the broker would already see in their org.
const SEED_RATE_PLANS_BY_ACCOUNT = {
  '001EB00002pYzbMAC': [
    {
      id: 'irp-acme-1001',
      name: 'IRP-1001',
      type: 'Fully Insured Health',
      geoState: 'OH',
      frequency: 'Monthly',
      currency: 'USD',
      eligibleTiers: ['employeeOnly', 'employeeSpouse', 'employeeFamily', 'employeeChildren']
    },
    {
      id: 'irp-acme-1002',
      name: 'IRP-1002',
      type: 'Per Employee Per Month',
      geoState: 'OH',
      frequency: 'Monthly',
      currency: 'USD',
      eligibleTiers: ['employeeOnly', 'employeeSpouse']
    },
    {
      id: 'irp-acme-1003',
      name: 'IRP-1003',
      type: 'Flat',
      geoState: 'OH',
      frequency: 'Annual',
      currency: 'USD',
      eligibleTiers: ['employeeOnly']
    }
  ]
};

export default class AccountRecordPage extends LightningElement {
  @track dropdownOpen = false;
  @track launcherOpen = false;
  // App Launcher → Dashboards opens a Setup-lookalike landing page
  // (c-dashboards-home) as its own workspace tab, with launch tiles
  // for Run my day, Client 360, and Revenue Intelligence.
  @track dashboardsOpen = false;
  // Setup view replaces the record body when the broker picks Setup from
  // the App Launcher. Mirrors the way Lightning sub-routes the Setup tree
  // inside the workspace.
  @track setupOpen = false;
  // Standalone Client 360 dashboard view, opened from the App Launcher.
  // Same lifecycle as setupOpen.
  @track client360Open = false;
  // Revenue Intelligence dashboard view, opened from the App Launcher.
  // Same lifecycle as setupOpen / client360Open.
  @track revenueOpen = false;
  // Home (Run My Day) workspace tab body. Always kept in the DOM so
  // switching between Home and an account tab is instantaneous and
  // c-run-my-day preserves its internal state (selected card, meeting
  // popover, etc.) across tab switches. Visibility is driven by
  // homePanelClass, not by unmounting.
  @track homeOpen = true;
  // Related is the landing tab: the renewal story starts from the account's
  // Insurance Policies list, so the broker lands on what's attached to this
  // household rather than on its field detail.
  @track activeTab = 'related';
  // Last tab announced via `rfqlistviewed`. Not tracked - it is written
  // from renderedCallback purely to make that announcement fire once
  // per tab change rather than on every render.
  _announcedTab = null;
  // Local fallback selection when the parent shell doesn't drive
  // activeWorkspaceTabId (e.g. the account page is rendered standalone).
  @track _localActiveTabId = HOME_TAB_ID;
  // Account ids with an open workspace tab. Empty on load so the strip
  // reads Home only; the activeWorkspaceTabId setter appends an account
  // the first time the broker lands on its record.
  @track _openAccountIds = [];
  _docClickHandler = null;

  // ── Public API (driven by app shell) ────────────────────────────
  // Extra workspace tabs to render alongside the two account tabs.
  // Each entry: { id, label, type: 'rfq-pa'|'rfq-eb', context, accountId? }
  @api rfqTabs = [];

  // Props forwarded from c-app down to the inline c-run-my-day inside
  // the Home workspace tab panel. Kept as pass-through @api on this
  // component so c-app can stay the single source of truth for persona
  // + bound-account context without needing to know that RMD now lives
  // inside the SF shell instead of at the top-level route.
  @api personaId;
  @api boundAccountIds = [];
  @api rmdTab;

  // Open Meeting Playbook workspace tabs, owned by c-app. Each entry is
  // `{ id, meetingId, label }`; this component renders one strip pill
  // and one mounted c-meeting-center panel per entry. Matches the org,
  // where a playbook is a record with its own console tab rather than
  // a panel borrowed from Home.
  @api meetingTabs = [];

  // Currently active workspace tab id. When set by the parent it
  // overrides the internal fallback above, so the parent can pivot
  // between account tabs and rfq tabs from a single source of truth.
  //
  // The setter side-effects `setupOpen = true` whenever the parent
  // pivots to the Setup tab (e.g., a hard refresh restoring
  // ?tab=tab-setup from the URL). Without this, the Setup tab
  // wouldn't appear in the tab strip on refresh - workspaceTabs
  // only emits the Setup entry when setupOpen is true.
  //
  // @track on the backing field guarantees re-renders even when
  // the side-effect (setupOpen toggle) doesn't fire for
  // non-setup tab values.
  @track _activeWorkspaceTabId;

  // ── Salesforce-shell global search ────────────────────────
  // The sf-search input in the brown shell banner opens a
  // dropdown labelled "Digital Experiences" listing accounts +
  // currently-open runtime RFQ / Policy tabs. Clicking a result
  // routes the workspace tab and auto-closes Setup (via the
  // existing setupOpen auto-clear in activeWorkspaceTabId setter).
  @track sfSearchOpen = false;
  @track sfSearchQuery = '';

  // ── Global-header Agentforce Ask pill ─────────────────────
  // Ask routes to the Coworker landing page, which lives in its own
  // workspace tab. This flag is the tab's presence in the strip; the
  // pill's aria-expanded reads `isCoworkerActive` so it only claims to
  // be expanded while that tab is the one on screen.
  @track coworkerOpen = false;

  // ── Global-header gear → "Setup Menu" popover ─────────────
  // Owned here because the gear lives in the shell banner. Picking
  // "Setup" routes to SETUP_HOME_TAB_ID; every other row is a stub that
  // reports itself through the shared toast.
  @track setupMenuOpen = false;
  @track setupHomeOpen = false;
  @track notificationsOpen = false;
  @track bellRinging = false;

  // Forwarded straight through to c-run-my-day, which reads its
  // meetings from the data module rather than from a prop. A change
  // here is what prompts it to re-read after one is booked.
  @api rmdMeetingsRevision = 0;
  @api rmdFocusDateKey;
  @api rmdHighlightMeetingId;

  // Notification records for the global-header tray, owned by the app
  // shell. The setter watches for growth rather than diffing ids: the
  // shell only ever prepends, so a longer list means something just
  // arrived and the bell should play its arrival beat.
  @api
  get notifications() {
    return this._notifications;
  }
  set notifications(value) {
    const next = Array.isArray(value) ? value : [];
    const grew = next.length > (this._notifications || []).length;
    this._notifications = next;
    if (grew) this._playBellBeat();
  }
  _notifications = [];

  // True from the moment a routed bundle's carriers start answering
  // until the last one is in. The tray rides that window open, so the
  // broker watches the responses land instead of finding a badge after
  // the fact, and the page is handed back once the market has spoken.
  @api
  get quotesArriving() {
    return this._quotesArriving;
  }
  set quotesArriving(value) {
    const next = Boolean(value);
    const was = this._quotesArriving;
    this._quotesArriving = next;
    if (next === was) return;
    this._clearNotifAutoClose();
    if (next) {
      // Fresh arrival window - auto-open again even if the broker
      // took over the previous one.
      this._notifHeldByUser = false;
      this.notificationsOpen = true;
      return;
    }
    // Last carrier is in. Do not yank the tray shut if the broker
    // opened or closed it themselves during the window: a reopen
    // just before this flip used to get auto-closed 1.5s later.
    if (this._notifHeldByUser) return;
    // Hold the final notification on screen for a beat before
    // closing, or the item the broker was reading vanishes the
    // instant it appears.
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this._notifAutoCloseTimer = setTimeout(() => {
      this._notifAutoCloseTimer = null;
      if (this._notifHeldByUser) return;
      this.notificationsOpen = false;
    }, NOTIF_AUTOCLOSE_MS);
  }
  _quotesArriving = false;
  _notifAutoCloseTimer = null;
  _notifHeldByUser = false;

  // The shell bumps this when a client-reply notification lands. A
  // rise opens the tray and holds it, so the reply is the thing on
  // screen rather than a badge the broker has to notice.
  @api
  get clientReplySignal() {
    return this._clientReplySignal;
  }
  set clientReplySignal(value) {
    const next = Number(value) || 0;
    const grew = next > (this._clientReplySignal || 0);
    this._clientReplySignal = next;
    if (!grew) return;
    this._clearNotifAutoClose();
    this._notifHeldByUser = true;
    this.notificationsOpen = true;
  }
  _clientReplySignal = 0;

  // The tray is an unread inbox. Quote-arrival rows stay in the shell
  // record as read history, but they do not compete with a new reply
  // when the tray opens.
  get notificationTrayItems() {
    return (this.notifications || []).filter((n) => n.unread);
  }

  // Any deliberate open/close outranks the pending auto-close, so the
  // tray is never pulled shut under a broker who just opened it.
  _clearNotifAutoClose() {
    if (this._notifAutoCloseTimer) {
      clearTimeout(this._notifAutoCloseTimer);
      this._notifAutoCloseTimer = null;
    }
  }

  // Bell click, scrim, Escape, or opening a row: the broker has taken
  // the tray, so the arrival window must not auto-close it later.
  _holdNotifTray() {
    this._notifHeldByUser = true;
    this._clearNotifAutoClose();
  }

  _pendingTrayFocus = false;

  // ── Right-hand record column ──────────────────────────────
  @api
  get activeWorkspaceTabId() {
    return this._activeWorkspaceTabId;
  }
  set activeWorkspaceTabId(value) {
    this._activeWorkspaceTabId = value;
    // Landing on an account record is what puts its pill in the strip.
    // Once added it stays for the session, mirroring a console tab the
    // broker would have to close by hand.
    const landedAccountId = ACCOUNT_BY_TAB_ID[value];
    if (landedAccountId && !this._openAccountIds.includes(landedAccountId)) {
      this._openAccountIds = [...this._openAccountIds, landedAccountId];
    }
    if (value === SETUP_TAB_ID) {
      this.setupOpen = true;
    } else if (this.setupOpen) {
      // Navigating away from Setup (e.g. via the global search
      // dropdown picking an account / runtime RFQ) closes the Setup
      // tab so the original tab strip comes back. State inside the
      // Setup workspace is preserved at the module level - re-opening
      // Setup from the App Launcher restores wherever the admin was.
      this.setupOpen = false;
    }
    if (value === SETUP_HOME_TAB_ID) {
      this.setupHomeOpen = true;
    } else if (this.setupHomeOpen) {
      this.setupHomeOpen = false;
    }
    if (value === CLIENT360_TAB_ID) {
      this.client360Open = true;
    }
    if (value === REVENUE_TAB_ID) {
      this.revenueOpen = true;
    }
    if (value === DASHBOARDS_TAB_ID) {
      this.dashboardsOpen = true;
    }
    if (value === COWORKER_TAB_ID) {
      this.coworkerOpen = true;
    }
  }

  // Map of accountId → RFQ history rows. Drives the data table inside
  // the "RFQs" record-page tab.
  @api accountRfqs = {};

  // Mirrors the app shell's Slack drawer open state. The "Slack Channel"
  // sidebar card starts already connected, so the live #acct-broker-team
  // conversation is visible from first paint without needing the right
  // drawer to be opened once. Opening the drawer keeps the latch set, so
  // dismissing it never reverts the card to the not-connected empty state.
  _slackOpen = false;
  @track _slackActivated = true;

  @api
  get slackOpen() {
    return this._slackOpen;
  }
  set slackOpen(value) {
    this._slackOpen = value;
    if (value) this._slackActivated = true;
  }

  get slackActive() {
    return this._slackActivated;
  }

  get slackChannelName() {
    return slackData.channelName;
  }

  // Most-recent messages, condensed for the compact sidebar chat panel.
  get slackMessages() {
    const msgs = slackData.messages || [];
    return msgs.slice(-5).map((m) => {
      const isAgent = m.avatarType === 'bot' || m.sender === 'Agentforce';
      return {
        key: m.id,
        name: m.sender,
        time: m.timestamp,
        text: m.text,
        initials: isAgent ? 'AI' : initials(m.sender),
        avatarClass: isAgent
          ? 'sf-slack-msg-avatar is-agent'
          : 'sf-slack-msg-avatar'
      };
    });
  }

  get slackComposePlaceholder() {
    return `Message ${slackData.channelName}`;
  }

  // Filtered RFQ list for the currently-displayed account, ready to be
  // forwarded straight to <c-account-rfq-list>.
  get currentAccountRfqs() {
    return this.accountRfqs?.[this.activeAccountId] || [];
  }

  // ── Derived state ───────────────────────────────────────────────
  get effectiveActiveTabId() {
    return this.activeWorkspaceTabId || this._localActiveTabId;
  }

  // The account currently shown in the highlights panel - derived from
  // the active workspace tab id when it points at an account tab,
  // otherwise the previously-active account (so switching to an RFQ tab
  // and back keeps the same account).
  // Deliberately not @track. It is written from renderedCallback, and a
  // reactive write there would schedule another render. Nothing reads it
  // in the same pass that writes it: the write only happens while an
  // account tab is active, and in that case activeAccountId resolves from
  // the tab id directly rather than from this fallback. The seed keeps
  // the first paint defined.
  _lastAccountTabId = TAB_ID_BY_ACCOUNT[ACCOUNT_ORDER[0]];

  // Bundle-Review store: each c-rfq-workspace* publishes its normalized
  // review snapshot up here via `reviewsnapshot` events. Keyed by
  // tabId (== rfq id) so we can hand back siblings-only slices to
  // each open workspace via the `sibling-review-payloads` prop. Used
  // by c-loc-review-panel on the Review step to render a bundle-wide
  // tab bar without leaving the current SF workspace tab.
  @track bundleReviewSnapshots = {};

  // Pure. The template reads this through account-id and transitively
  // through get account(), so it must not write component state.
  get activeAccountId() {
    const tabId = this.effectiveActiveTabId;
    if (ACCOUNT_BY_TAB_ID[tabId]) return ACCOUNT_BY_TAB_ID[tabId];
    return ACCOUNT_BY_TAB_ID[this._lastAccountTabId] || ACCOUNT_ORDER[0];
  }

  get account() {
    return ACCOUNTS[this.activeAccountId];
  }

  // True when an account workspace tab is active - drives whether the
  // record body renders. RFQ workspace tabs render the wizard instead.
  get isAccountTabActive() {
    return !!ACCOUNT_BY_TAB_ID[this.effectiveActiveTabId];
  }

  // Hide the highlights panel + body when an RFQ tab is active, but
  // leave it in the DOM so re-activating the account tab is instant
  // (no remount).
  get accountBodyClass() {
    return this.isAccountTabActive
      ? 'sf-shell-body sf-shell-body_active'
      : 'sf-shell-body sf-shell-body_hidden';
  }

  // Workspace tabs rendered between "Recently Viewed | ..." and the rest.
  // The active tab gets the brand blue underline via .sf-tab_active.
  // Combines the static account tabs with any dynamically-added RFQ tabs
  // pushed in by the app shell.
  get workspaceTabs() {
    const active = this.effectiveActiveTabId;
    // Account tabs are opened, not pinned: the strip starts with Home
    // only, and a record joins it the first time the broker actually
    // navigates there (meeting-card link, global search, RFQ launch).
    // ACCOUNT_ORDER still backs the record body, so it stays populated.
    const accountEntries = this._openAccountIds.map((id) => {
      const a = ACCOUNTS[id];
      const tabId = TAB_ID_BY_ACCOUNT[id];
      const isActive = tabId === active;
      return {
        id: tabId,
        accountId: id,
        type: 'account',
        label: a.name,
        className: isActive ? 'sf-tab sf-tab_active' : 'sf-tab sf-tab_static',
        isActive,
        showCloseBtn: false,
        kind: 'account'
      };
    });
    const rfqEntries = (this.rfqTabs || []).map((t) => {
      const isActive = t.id === active;
      const isPolicy = t.type === 'policy';
      const acct = ACCOUNTS[t.accountId] || null;
      const renewContext =
        isPolicy && acct
          ? {
              launchedFromAccount: true,
              accountId: acct.id,
              accountName: acct.name,
              recordOwner: acct.ownerName,
              lob: acct.launch.lob,
              loc: acct.launch.loc,
              priorPolicy: acct.launch.priorPolicy,
              priorPolicyId: acct.launch.priorPolicyId,
              priorPolicyTerm: acct.launch.priorPolicyTerm
            }
          : null;
      // The P&C policy page's "New Request For Quote" header action opens the
      // same trimmed intake modal as the policy row action: the broker has
      // already named the policy, so `isRenewal` drops the start-method radios
      // and the prior-policy picker, and the line of coverage follows the
      // policy's own line rather than the account default.
      const policyLine = t.context?.policyLob || '';
      const renewalContext = renewContext
        ? {
            ...renewContext,
            loc: POLICY_LINE_TO_LOC[policyLine] || renewContext.loc,
            isRenewal: true,
            renewalOfPolicyId: t.id,
            renewalPolicyNumber: t.context?.policyNumber || ''
          }
        : null;
      // Hybrid session-tab affordance: mark a tab "done" once its
      // RFQ row on the account has moved past Draft (Ready / Submitted /
      // Sent / Closed / Bound). Done tabs get a leading checkmark in
      // the template + a subtle .sf-tab_done modifier so brokers can
      // read the strip like a session timeline - "Auto: done, Home:
      // active" - even while both panels stay editable.
      const isDone = !isPolicy && this._isTabDone(t);
      const baseClass = isActive ? 'sf-tab sf-tab_active' : 'sf-tab sf-tab_static';
      const className = isDone ? `${baseClass} sf-tab_done` : baseClass;
      // In-workspace LOC session strip: hand each RFQ panel a compact
      // list of sibling RFQs on the same account bundle so the
      // c-rfq-workspace* component can render a "Personal Auto |
      // Home | + Add LOC" toggle above its layout grid. Policy tabs
      // don't participate - the strip is bundle-scoped.
      const sessionTabs = isPolicy ? [] : this._sessionSiblingsFor(t.accountId, active);
      // Bundle Review: hand each RFQ workspace the *sibling* review
      // snapshots on the same account so it can render a Review tab
      // bar and swap layouts inline via c-loc-review-panel. Own
      // snapshot is excluded - each workspace renders its own live
      // Review content locally, not from a stored snapshot.
      const siblingReviewPayloads = isPolicy
        ? []
        : this._siblingReviewPayloadsFor(t.accountId, t.id);
      return {
        id: t.id,
        accountId: t.accountId || null,
        type: t.type, // 'rfq-pa' | 'rfq-eb' | 'rfq-home' | 'policy'
        label: t.label || (isPolicy ? 'Insurance Policy' : 'New RFQ'),
        className,
        isActive,
        isDone,
        showCloseBtn: true,
        kind: isPolicy ? 'policy' : 'rfq',
        context: t.context,
        isRfqPa: t.type === 'rfq-pa',
        isRfqEb: t.type === 'rfq-eb',
        isRfqHome: t.type === 'rfq-home',
        isPolicy,
        policyName: t.context?.policyName || t.label,
        policyNumber: t.context?.policyNumber || '',
        policyLob: t.context?.policyLob || '',
        // Employee Benefits keeps the rate-plan record page; every P&C line
        // opens the FSC-style page whose Policy UI tab renders the covered
        // asset / coverage / participant hierarchy.
        isEbPolicy: isPolicy && t.context?.policyLob === 'Employee Benefits',
        // Row from the Insurance Policies list, so a policy without a
        // hand-authored fixture still renders a coherent record page.
        policySeed: isPolicy ? t.context?.policySeed || null : null,
        renewContext,
        renewalContext,
        sessionTabs,
        siblingReviewPayloads,
        panelClass: isActive
          ? 'sf-shell-body sf-shell-body_active'
          : 'sf-shell-body sf-shell-body_hidden'
      };
    });
    // Setup tab - surfaces only when the App Launcher → Setup link
    // has been clicked. Shows the RFQ Setup workspace inside a normal
    // tab so the broker can switch back to any account / RFQ tab
    // without losing setup state.
    const setupEntries = this.setupOpen
      ? [
          {
            id: SETUP_TAB_ID,
            type: 'setup',
            label: 'Setup',
            className:
              active === SETUP_TAB_ID
                ? 'sf-tab sf-tab_active'
                : 'sf-tab sf-tab_static',
            isActive: active === SETUP_TAB_ID,
            showCloseBtn: true,
            kind: 'setup'
          }
        ]
      : [];

    // Meeting Playbook tabs - one per meeting opened from the Run My
    // Day carousel. Closable, like RFQ tabs, and labelled with the
    // playbook name the way the org labels its record tabs.
    const meetingEntries = (this.meetingTabs || []).map((t) => {
      const isActive = t.id === active;
      return {
        id: t.id,
        type: 'meeting',
        meetingId: t.meetingId,
        label: t.label,
        className: isActive ? 'sf-tab sf-tab_active' : 'sf-tab sf-tab_static',
        isActive,
        showCloseBtn: true,
        kind: 'meeting'
      };
    });

    // Standalone Client 360 tab - surfaces only after the App Launcher
    // → Client 360 link is clicked. Same chrome as the Setup tab.
    const client360Entries = this.client360Open
      ? [
          {
            id: CLIENT360_TAB_ID,
            type: 'client360',
            label: 'Client 360',
            className:
              active === CLIENT360_TAB_ID
                ? 'sf-tab sf-tab_active'
                : 'sf-tab sf-tab_static',
            isActive: active === CLIENT360_TAB_ID,
            showCloseBtn: true,
            kind: 'client360'
          }
        ]
      : [];

    // Standalone Revenue Intelligence tab - surfaces after the App
    // Launcher → Revenue Intelligence link is clicked. Same chrome.
    const revenueEntries = this.revenueOpen
      ? [
          {
            id: REVENUE_TAB_ID,
            type: 'revenue',
            label: 'Revenue Intelligence',
            className:
              active === REVENUE_TAB_ID
                ? 'sf-tab sf-tab_active'
                : 'sf-tab sf-tab_static',
            isActive: active === REVENUE_TAB_ID,
            showCloseBtn: true,
            kind: 'revenue'
          }
        ]
      : [];

    // Dashboards landing tab - surfaces after the App Launcher →
    // Dashboards link is clicked. Same chrome as the Setup tab.
    const dashboardsEntries = this.dashboardsOpen
      ? [
          {
            id: DASHBOARDS_TAB_ID,
            type: 'dashboards',
            label: 'Dashboards',
            className:
              active === DASHBOARDS_TAB_ID
                ? 'sf-tab sf-tab_active'
                : 'sf-tab sf-tab_static',
            isActive: active === DASHBOARDS_TAB_ID,
            showCloseBtn: true,
            kind: 'dashboards'
          }
        ]
      : [];

    // Agentforce Coworker tab - surfaces after the global-header Ask
    // pill is clicked. The org labels this tab "Ask: <first prompt>" once
    // a thread exists; on the landing state it is just "Ask".
    const coworkerEntries = this.coworkerOpen
      ? [
          {
            id: COWORKER_TAB_ID,
            type: 'coworker',
            label: 'Ask',
            className:
              active === COWORKER_TAB_ID
                ? 'sf-tab sf-tab_active'
                : 'sf-tab sf-tab_static',
            isActive: active === COWORKER_TAB_ID,
            showCloseBtn: true,
            kind: 'coworker'
          }
        ]
      : [];

    // When Setup is open it takes over the entire tab strip - every
    // other workspace tab + the two static (Digital Experiences Home /
    // Recently Viewed) tabs are hidden so the broker only sees the
    // Setup pill with its gear icon. Closing the Setup tab restores
    // every tab below; the underlying state (account / RFQ / policy
    // tabs) is preserved, just not rendered while setup is active.
    if (this.setupOpen && setupEntries.length) {
      return setupEntries.map((t) => withTabIcon({ ...t, isSetup: true }));
    }
    return [
      ...accountEntries,
      ...rfqEntries,
      ...meetingEntries,
      ...setupEntries.map((t) => ({ ...t, isSetup: true })),
      ...client360Entries,
      ...revenueEntries,
      ...dashboardsEntries,
      ...coworkerEntries
    ].map(withTabIcon);
  }

  // True when the Setup tab is open AND it's the active focus, so the
  // template can hide the two static placeholder tabs that always
  // render above the workspaceTabs loop in the strip.
  get isSetupMode() {
    return this.setupOpen;
  }

  // Session-tab "done" join helper. Looks up the RFQ row on
  // `accountRfqs` and returns true once its status has moved beyond
  // Draft. Wrapped in a helper so `workspaceTabs` reads clean and
  // future statuses (e.g., Quoted, Bound) can be added in one place.
  _isTabDone(tab) {
    if (!tab || !tab.accountId || !tab.id) return false;
    const rows = this.accountRfqs?.[tab.accountId];
    if (!Array.isArray(rows)) return false;
    const row = rows.find((r) => r.id === tab.id);
    if (!row) return false;
    // Draft = still in-flight; anything else means the broker has
    // committed the RFQ to the bundle / market / policy lifecycle
    // and the workspace tab reads as a completed session.
    return row.status && row.status !== 'Draft';
  }

  // Build the in-workspace LOC session strip payload for a given
  // account. Returns siblings only (all RFQ tabs for the account,
  // including the currently active one), with the short LOC label
  // the pill should show. Policy tabs are excluded - the strip is
  // scoped to the bundle-in-progress, not to closed policies. The
  // caller decides whether to render the strip (typically only when
  // length > 1) so this helper stays simple.
  _sessionSiblingsFor(accountId, activeTabId) {
    if (!accountId) return [];
    const siblings = (this.rfqTabs || []).filter(
      (t) => t.accountId === accountId && t.type !== 'policy'
    );
    return siblings.map((t) => {
      // Status comes off the same published review snapshot the
      // bundle-review tab bar reads, so a pill reports what the LOC
      // actually holds rather than whether it happens to be the
      // selected tab. Self publishes its own snapshot from
      // renderedCallback, so every pill in the strip resolves.
      const snapshot = this.bundleReviewSnapshots?.[t.id];
      const isDone = this._isTabDone(t);
      let status = 'Not started';
      if (isDone || snapshot?.status === 'Ready') status = 'Ready';
      else if (snapshot?.hasContent) status = 'In progress';
      return {
        id: t.id,
        locLabel: this._locLabelForTab(t),
        isActive: t.id === activeTabId,
        isDone,
        status
      };
    });
  }

  // Bundle Review sibling payloads. Returns snapshots for every RFQ
  // tab on the account *except* the caller's own (self renders its
  // live Review locally). If a sibling hasn't published a snapshot
  // yet (e.g., broker just opened its tab but hasn't touched it), we
  // synthesize a stub with just the LOC label so the Review tab bar
  // can still show it as "Not yet reviewed" instead of dropping it.
  _siblingReviewPayloadsFor(accountId, selfTabId) {
    if (!accountId) return [];
    const rfqSiblings = (this.rfqTabs || []).filter(
      (t) => t.accountId === accountId && t.type !== 'policy' && t.id !== selfTabId
    );
    return rfqSiblings.map((t) => {
      const stored = this.bundleReviewSnapshots?.[t.id];
      if (stored) return stored;
      // Fallback stub: enough shape for c-loc-review-panel to render
      // an empty-state card. locKind is inferred from tab.type so the
      // panel can still pick the right layout scaffold.
      const locKind =
        t.type === 'rfq-home' ? 'home'
        : t.type === 'rfq-eb' ? 'eb'
        : 'auto';
      return {
        tabId: t.id,
        locKind,
        locLabel: this._locLabelForTab(t),
        application: t.label || '',
        insured: '',
        status: 'Draft',
        policyDetails: {
          loc: this._locLabelForTab(t),
          effectiveFrom: '',
          effectiveTo: '',
          summary: '',
          highlights: []
        },
        vehicles: [],
        drivers: [],
        dwellings: [],
        homeowners: [],
        scheduledItems: [],
        coverages: [],
        counts: {},
        hasContent: false
      };
    });
  }

  // Snapshot handler. Each c-rfq-workspace* fires `reviewsnapshot`
  // with `{ tabId, snapshot }` on every renderedCallback (hash-guarded
  // upstream so we don't get storms). We store keyed by tabId. The
  // rfqEntries getter re-runs whenever bundleReviewSnapshots changes,
  // so downstream siblingReviewPayloads props stay live.
  handleReviewSnapshot(event) {
    const detail = event?.detail || {};
    const tabId = detail.tabId;
    const snapshot = detail.snapshot;
    if (!tabId || !snapshot) return;
    const prev = this.bundleReviewSnapshots?.[tabId];
    // Reference-equality is fine as a cheap gate; workspaces already
    // do a JSON hash upstream so the incoming snapshot object is a
    // fresh reference only when the payload actually changed.
    if (prev === snapshot) return;
    this.bundleReviewSnapshots = {
      ...this.bundleReviewSnapshots,
      [tabId]: snapshot
    };
  }

  // Compact LOC pill label. Prefers the intake context's `loc` (what
  // the broker actually picked in the modal) and falls back to a
  // type-based map so the strip stays readable even if context is
  // missing.
  _locLabelForTab(tab) {
    const fromContext =
      tab?.context?.loc && !Array.isArray(tab.context.loc)
        ? String(tab.context.loc)
        : null;
    if (fromContext) return fromContext;
    if (tab?.type === 'rfq-pa') return 'Personal Auto';
    if (tab?.type === 'rfq-home') return 'Homeowners';
    if (tab?.type === 'rfq-eb') return 'Group Medical';
    return tab?.label || 'RFQ';
  }

  // Setup panel - mirrors the .sf-shell-body active/hidden pattern the
  // RFQ + policy panels use so all tabs share the same hide/show CSS.
  get setupPanelClass() {
    return this.effectiveActiveTabId === SETUP_TAB_ID
      ? 'sf-shell-body sf-shell-body_active'
      : 'sf-shell-body sf-shell-body_hidden';
  }
  get setupHomePanelClass() {
    return this.effectiveActiveTabId === SETUP_HOME_TAB_ID
      ? 'sf-shell-body sf-shell-body_active'
      : 'sf-shell-body sf-shell-body_hidden';
  }

  // Setup home brings its own context bar, so the workspace tab strip
  // stands down while it is the active tab.
  get isSetupHomeMode() {
    return (
      this.setupHomeOpen && this.effectiveActiveTabId === SETUP_HOME_TAB_ID
    );
  }

  // Inside Setup the org's global search targets Setup itself.
  get sfSearchPlaceholder() {
    return this.isSetupHomeMode ? 'Search Setup' : 'Search...';
  }

  get setupMenuPrimaryItems() {
    return SETUP_MENU_PRIMARY.map((item) => ({
      ...item,
      isGear: item.glyph === 'gear',
      isAccount: item.glyph === 'account',
      isCode: item.glyph === 'code',
      iconClass: `sf-setup-menu__icon sf-setup-menu__icon_${item.tone}`
    }));
  }

  get setupMenuSecondaryItems() {
    return SETUP_MENU_SECONDARY;
  }

  get setupGearClass() {
    return this.setupMenuOpen
      ? 'sf-gear-btn sf-gear-btn_open'
      : 'sf-gear-btn';
  }

  get client360PanelClass() {
    return this.effectiveActiveTabId === CLIENT360_TAB_ID
      ? 'sf-shell-body sf-shell-body_active'
      : 'sf-shell-body sf-shell-body_hidden';
  }
  get revenuePanelClass() {
    return this.effectiveActiveTabId === REVENUE_TAB_ID
      ? 'sf-shell-body sf-shell-body_active'
      : 'sf-shell-body sf-shell-body_hidden';
  }
  get dashboardsPanelClass() {
    return this.effectiveActiveTabId === DASHBOARDS_TAB_ID
      ? 'sf-shell-body sf-shell-body_active'
      : 'sf-shell-body sf-shell-body_hidden';
  }
  get coworkerPanelClass() {
    return this.effectiveActiveTabId === COWORKER_TAB_ID
      ? 'sf-shell-body sf-shell-body_active'
      : 'sf-shell-body sf-shell-body_hidden';
  }
  // Drives the Ask pill's aria-expanded. Open-but-backgrounded reads as
  // collapsed, because from the pill's point of view the surface it opens
  // is not the one currently on screen.
  get isCoworkerActive() {
    return this.coworkerOpen && this.effectiveActiveTabId === COWORKER_TAB_ID;
  }
  // Home panel visibility - active when the Home workspace tab is the
  // effective active tab, hidden otherwise (same pattern as Dashboards).
  get homePanelClass() {
    return this.effectiveActiveTabId === HOME_TAB_ID
      ? 'sf-shell-body sf-shell-body_active'
      : 'sf-shell-body sf-shell-body_hidden';
  }

  // One mounted panel per open Meeting Playbook tab. Every panel stays
  // mounted and toggles visibility through sf-shell-body_*, the same
  // way RFQ workspaces do, so pivoting to an account and back keeps the
  // broker's place in the prep they were reading.
  get meetingPanels() {
    const active = this.effectiveActiveTabId;
    return (this.meetingTabs || []).map((t) => ({
      ...t,
      panelClass:
        t.id === active
          ? 'sf-shell-body sf-shell-body_active'
          : 'sf-shell-body sf-shell-body_hidden'
    }));
  }
  get isHomeActive() {
    return this.effectiveActiveTabId === HOME_TAB_ID;
  }
  // Class for the Home pill in the .sf-tabs strip. Mirrors the
  // account-tab active/inactive pattern (see workspaceTabs.className)
  // so the Home pill picks up the brand-blue underline when it's the
  // active workspace tab.
  get homeTabClass() {
    return this.isHomeActive
      ? 'sf-tab sf-tab_link sf-tab_home sf-tab_active'
      : 'sf-tab sf-tab_link sf-tab_home sf-tab_static';
  }
  // Bound to the standalone dashboard's @api standalone - a literal
  // true so the child renders its Account picker (a bare boolean
  // attribute would coerce to '' / falsy).
  get client360Standalone() {
    return true;
  }

  // The for-each in the template needs the rfq panels separately so each
  // workspace-tab content area can be rendered with its own wizard.
  // What the console tab strip renders. `workspaceTabs` stays one entry
  // per LOC because that is what mounts the panels - each LOC is its own
  // c-rfq-workspace* instance, and that is how a bundle keeps per-LOC
  // wizard state alive while the broker moves between lines.
  //
  // The strip is a different question. A bundle is ONE request for quote,
  // so it gets one tab; the in-workspace pill strip is what moves between
  // its lines. Without this collapse, adding a second LOC pushed a second
  // console tab and the broker saw two identical "New RFQ - 2026..." tabs
  // for what is a single RFQ.
  //
  // Grouped by account, matching `_sessionSiblingsFor` - the pill strip
  // already treats every open RFQ tab on an account as one bundle, and the
  // two strips have to agree on what a bundle is or they contradict
  // each other.
  get workspaceTabStrip() {
    const out = [];
    const groupIndexByAccount = new Map();

    this.workspaceTabs.forEach((t) => {
      const key = t.kind === 'rfq' && t.accountId ? t.accountId : null;
      if (key === null) {
        out.push(t);
        return;
      }
      const at = groupIndexByAccount.get(key);
      if (at === undefined) {
        groupIndexByAccount.set(key, out.length);
        out.push({ ...t, bundleTabIds: [t.id] });
        return;
      }
      // Fold this LOC into the account's existing strip entry.
      const head = out[at];
      const members = [...head.bundleTabIds, t.id];
      out[at] = {
        ...head,
        bundleTabIds: members,
        // Clicking the tab should land on the LOC the broker was last on,
        // so the active member wins the entry's id.
        id: t.isActive ? t.id : head.id,
        isActive: head.isActive || t.isActive,
        // The tick means "this RFQ is done", so every line has to be.
        isDone: head.isDone && t.isDone,
        // Keep the first LOC's label: it is the line the bundle started
        // from, and the pill strip inside spells out the rest.
        label: head.label
      };
    });

    return out.map((t) => {
      if (!t.bundleTabIds || t.bundleTabIds.length < 2) return t;
      const base = t.isActive ? 'sf-tab sf-tab_active' : 'sf-tab sf-tab_static';
      return { ...t, className: t.isDone ? `${base} sf-tab_done` : base };
    });
  }

  get rfqPanelEntries() {
    return this.workspaceTabs.filter((t) => t.kind === 'rfq');
  }
  // Policy record-page panels (one per open policy tab).
  get policyPanelEntries() {
    return this.workspaceTabs.filter((t) => t.kind === 'policy');
  }

  // URL bar mirrors the Salesforce Lightning record URL pattern.
  get accountUrl() {
    return `preetiorg2.test1.lightning.pc-rnd.force.com/lightning/r/Account/${this.activeAccountId}/view`;
  }

  // Reference payload - matches the brief verbatim per account. The wizard
  // routes to c-rfq-workspace (PA), c-rfq-workspace-home (Homeowners) or
  // c-rfq-workspace-eb (EB) based on lob + loc.
  get launchPayload() {
    const a = this.account;
    return {
      launchedFromAccount: true,
      accountId: a.id,
      accountName: a.name,
      recordOwner: a.ownerName,
      lob: a.launch.lob,
      loc: a.launch.loc,
      priorPolicy: a.launch.priorPolicy,
      priorPolicyId: a.launch.priorPolicyId,
      priorPolicyTerm: a.launch.priorPolicyTerm
    };
  }

  // ── Workspace tab interactions ──────────────────────────────────
  handleAccountTabClick(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    // Clicking an account tab is treated as a workspace-tab activate so
    // the parent shell can keep the source-of-truth in one place.
    this._localActiveTabId = id;
    this.dispatchEvent(
      new CustomEvent('tabactivate', {
        detail: { tabId: id },
        bubbles: true,
        composed: true
      })
    );
  }

  // In-workspace LOC session strip -> SF tab activation. The strip
  // inside c-rfq-workspace* dispatches `switchsession` with the
  // sibling tab id when a broker clicks a LOC pill. We flip the
  // active SF tab through the same code path as
  // `handleAccountTabClick` so the panel-visibility (sf-shell-body
  // active/hidden) toggles and the sibling workspace's own
  // c-progress-path becomes visible with its prior state intact.
  handleSwitchSession(event) {
    const id = event?.detail?.tabId;
    if (!id) return;
    this._localActiveTabId = id;
    this.dispatchEvent(
      new CustomEvent('tabactivate', {
        detail: { tabId: id },
        bubbles: true,
        composed: true
      })
    );
  }

  handleTabClose(event) {
    event.preventDefault();
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    // Setup is a locally-owned tab - close it here so the app shell
    // doesn't have to know about a tab it never opened.
    if (id === SETUP_TAB_ID) {
      this._closeSetupTab();
      return;
    }
    if (id === CLIENT360_TAB_ID) {
      this._closeClient360Tab();
      return;
    }
    if (id === REVENUE_TAB_ID) {
      this._closeRevenueTab();
      return;
    }
    if (id === DASHBOARDS_TAB_ID) {
      this._closeDashboardsTab();
      return;
    }
    if (id === COWORKER_TAB_ID) {
      this._closeCoworkerTab();
      return;
    }
    // One strip tab can stand for a whole bundle, so closing it closes
    // every LOC in it rather than leaving orphaned panels with no tab to
    // reach them by. The shell removes one at a time and re-picks where
    // to land after each, so the last removal decides the landing spot.
    const entry = this.workspaceTabStrip.find((t) => t.id === id);
    const ids =
      entry && entry.bundleTabIds && entry.bundleTabIds.length > 1
        ? entry.bundleTabIds
        : [id];
    ids.forEach((tabId) => {
      this.dispatchEvent(
        new CustomEvent('tabclose', {
          detail: { tabId },
          bubbles: true,
          composed: true
        })
      );
    });
  }

  get dropdownClass() {
    return this.dropdownOpen
      ? 'slds-dropdown-trigger slds-dropdown-trigger_click slds-is-open'
      : 'slds-dropdown-trigger slds-dropdown-trigger_click';
  }

  get dropdownAriaExpanded() {
    return this.dropdownOpen ? 'true' : 'false';
  }

  get secondaryTabs() {
    // Related leads, then Details, then the app-specific tabs - the same
    // order the Insurance Policy record page uses.
    const tabs = [
      { id: 'related', label: 'Related' },
      { id: 'details', label: 'Details' },
      { id: 'policies', label: 'Policies' },
      { id: 'rfqs', label: 'RFQList' },
      { id: 'submission-board', label: 'Submission Board' },
      { id: 'client360', label: 'Client 360' }
    ];
    return tabs.map((t) => {
      const active = t.id === this.activeTab;
      return {
        ...t,
        tabDomId: `sf-record-tab-${t.id}`,
        panelId: `sf-record-panel-${t.id}`,
        selected: active ? 'true' : 'false',
        tabIndex: active ? 0 : -1,
        className: active ? 'sf-record-tab is-active' : 'sf-record-tab'
      };
    });
  }

  // Both sides of every tab/panel idref pair are bound expressions so
  // LWC leaves them untouched; a static id would be rewritten on one
  // side only and break the association.
  get relatedTabDomId() {
    return 'sf-record-tab-related';
  }
  get detailsTabDomId() {
    return 'sf-record-tab-details';
  }
  get rfqsTabDomId() {
    return 'sf-record-tab-rfqs';
  }
  get submissionBoardTabDomId() {
    return 'sf-record-tab-submission-board';
  }
  get client360TabDomId() {
    return 'sf-record-tab-client360';
  }
  get relatedPanelId() {
    return 'sf-record-panel-related';
  }
  get detailsPanelId() {
    return 'sf-record-panel-details';
  }
  get rfqsPanelId() {
    return 'sf-record-panel-rfqs';
  }
  get submissionBoardPanelId() {
    return 'sf-record-panel-submission-board';
  }
  get client360PanelId() {
    return 'sf-record-panel-client360';
  }

  handleRecordTabKeydown(event) {
    const ids = this.secondaryTabs.map((t) => t.id);
    const current = ids.indexOf(this.activeTab);
    let next = current;
    if (event.key === 'ArrowLeft') next = (current - 1 + ids.length) % ids.length;
    else if (event.key === 'ArrowRight') next = (current + 1) % ids.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = ids.length - 1;
    else return;

    event.preventDefault();
    this.activeTab = ids[next];
    Promise.resolve().then(() => {
      this.template
        .querySelector(`.sf-record-tab[data-id="${ids[next]}"]`)
        ?.focus();
    });
  }

  get isRelatedTab() {
    return this.activeTab === 'related';
  }
  get isDetailsTab() {
    return this.activeTab === 'details';
  }
  get isRfqsTab() {
    return this.activeTab === 'rfqs';
  }

  // Second record column, as in the org. Scoped to the two stock
  // record tabs: RFQList, Submission Board and Client 360 are
  // full-bleed workspace surfaces that need the whole grid.
  get showRelatedSidebar() {
    return this.isRelatedTab || this.isDetailsTab;
  }

  get bodyGridClass() {
    return this.showRelatedSidebar
      ? 'sf-body-grid'
      : 'sf-body-grid sf-body-grid_single';
  }

  handlePulsePrompt() {}

  // Neither remaining account carries a mock opportunity, so the
  // Opportunities related list renders its empty state alongside
  // Contacts, Cases and Partners.
  get relatedOpportunities() {
    return [];
  }

  get hasRelatedOpportunities() {
    return this.relatedOpportunities.length > 0;
  }

  get relatedOppCountLabel() {
    return `(${this.relatedOpportunities.length})`;
  }

  get _detailsBlob() {
    const byAccount = {
      '001SB00001oXwntYAC': {
        description:
          'Multi-generational household on Tampa Bay. Cross-sold from a standalone Auto policy to a three-line Personal Lines bundle, ninth year as a client.',
        billingLines: [
          '4208 N Dale Mabry Hwy',
          'Tampa, FL 33611',
          'United States'
        ],
        shippingLines: ['Same as billing address'],
        parentAccount: '-',
        rating: 'Warm',
        ownership: 'Private (Household)'
      },
      '001EB00002pYzbMAC': {
        description:
          'Mid-market manufacturer. Renewal LOB is Employee Benefits with a 45-employee census; producer team is co-selling Property.',
        billingLines: [
          '3400 W Fullerton Ave',
          'Chicago, IL 60647',
          'United States'
        ],
        shippingLines: [
          '11500 S Cottage Grove Ave',
          'Chicago, IL 60628',
          'United States'
        ],
        parentAccount: '-',
        rating: 'Hot',
        ownership: 'Private'
      },
      'a-whitfield': {
        description:
          'Coastal Sarasota household. Auto renewal is driven by a newly licensed teen driver and a third vehicle added mid-term; no umbrella in force.',
        billingLines: [
          '1809 Bayshore Point Dr',
          'Sarasota, FL 34236',
          'United States'
        ],
        shippingLines: ['Same as billing address'],
        parentAccount: '-',
        rating: 'Warm',
        ownership: 'Private (Household)'
      },
      'a-bluebird': {
        description:
          'Regional freight carrier running a 24-unit fleet out of Memphis. Experience mod moved to 1.24 after two lost-time injuries; no telematics in place.',
        billingLines: [
          '2250 Channel Ave',
          'Memphis, TN 38113',
          'United States'
        ],
        shippingLines: ['Same as billing address'],
        parentAccount: '-',
        rating: 'Hot',
        ownership: 'Private'
      }
    };
    return byAccount[this.activeAccountId] || {};
  }

  get detailsInfoFields() {
    const acc = this.account;
    if (!acc) return [];
    const b = this._detailsBlob;
    return [
      { id: 'name', label: 'Account Name', value: acc.name || '-' },
      ...(acc.fields || []).map((f) => ({
        id: f.id,
        label: f.label,
        value: f.value
      })),
      { id: 'parent', label: 'Parent Account', value: b.parentAccount || '-' },
      { id: 'rating', label: 'Rating', value: b.rating || '-' },
      { id: 'ownership', label: 'Ownership', value: b.ownership || '-' }
    ];
  }

  get detailsDescription() {
    return this._detailsBlob.description || '';
  }

  get detailsAddresses() {
    const b = this._detailsBlob;
    return [
      { id: 'billing', label: 'Billing Address', lines: (b.billingLines || []).map((v, i) => ({ id: `b-${i}`, value: v })) },
      { id: 'shipping', label: 'Shipping Address', lines: (b.shippingLines || []).map((v, i) => ({ id: `s-${i}`, value: v })) }
    ];
  }
  get isSubmissionBoardTab() {
    return this.activeTab === 'submission-board';
  }
  get isPoliciesTab() {
    return this.activeTab === 'policies';
  }
  get isClient360Tab() {
    return this.activeTab === 'client360';
  }

  // Resolve the active account's display name for the Submission
  // Board (it uses it in copy + the routed confirmation).
  get activeAccountName() {
    return this.account?.name || '';
  }

  // Policies related list - each account carries its in-force policy.
  // Opening one launches a new workspace tab with the policy record page
  // (Plan tab flow + "Renew Policy" action).
  // Insurance Policies related list. The column set mirrors the FSC
  // `All Insurance Policies` list view - policy number as the linked
  // identity field, then expiration, premium, status. Values stay
  // specific to this SMB book rather than FSC's picklist vocabulary.
  // The related list renders dates and premiums as plain strings, in the
  // MM/DD/YYYY and $0,000 forms the hand-written rows below already use.
  // Parsed off the ISO parts rather than through Date, so the day cannot
  // shift by one on a timezone behind UTC.
  _fmtListDate(iso) {
    const [y, m, d] = String(iso || '').split('-');
    return y && m && d ? `${m}/${d}/${y}` : '';
  }
  _fmtListMoney(amount) {
    const n = Number(amount);
    return Number.isFinite(n) ? `$${n.toLocaleString('en-US')}` : '';
  }

  get accountPolicies() {
    // Accounts with a Client 360 payload read their policies from it, so
    // this related list and the dashboard's Active Policies table cannot
    // disagree. They did: Mavericks listed only the Personal Auto line
    // here, on the reasoning that it is the policy the story turns on
    // and the rest belonged to the Client 360 book view, while the
    // dashboard counted all three. A related list titled "Insurance
    // Policies" that omits two of an account's three policies is a
    // straightforward misstatement, whichever surface is read first.
    const fromBook = getClient360(this.activeAccountId)?.policies;
    if (fromBook?.length) {
      return fromBook.map((p) => ({
        id: p.id,
        name: p.name,
        number: p.number,
        // This column carries the line of coverage, which the fixture
        // holds as `type`; its `lob` is the broader category.
        lob: p.type,
        expiration: this._fmtListDate(p.expirationDate),
        premium: this._fmtListMoney(p.premium),
        status: p.status
      }));
    }

    // Accounts with no Client 360 payload keep their own rows.
    const byAccount = {
      'a-whitfield': [
        {
          id: 'pol-whit-pa-2026',
          name: 'Whitfield Household - 2026 Personal Auto Policy',
          number: 'POL-WHIT-AUTO-2026',
          lob: 'Personal Auto',
          expiration: '10/15/2026',
          premium: '$3,140',
          status: 'Active'
        },
        {
          id: 'pol-whit-ho-2026',
          name: 'Whitfield Household - 2026 Homeowners Policy',
          number: 'POL-WHIT-HO-2026',
          lob: 'Homeowners',
          expiration: '09/22/2026',
          premium: '$6,660',
          status: 'Active'
        }
      ],
      'a-bluebird': [
        {
          id: 'pol-blue-ca-2026',
          name: 'Bluebird Logistics - 2026 Commercial Auto Policy',
          number: 'POL-BLUE-CA-2026',
          lob: 'Commercial Auto',
          expiration: '01/01/2027',
          premium: '$342,000',
          status: 'Active'
        },
        {
          id: 'pol-blue-im-2026',
          name: 'Bluebird Logistics - 2026 Inland Marine Policy',
          number: 'POL-BLUE-IM-2026',
          lob: 'Inland Marine',
          expiration: '09/15/2026',
          premium: '$28,000',
          status: 'Active'
        },
        {
          id: 'pol-blue-wc-2026',
          name: 'Bluebird Logistics - 2026 Workers Comp Policy',
          number: 'POL-BLUE-WC-2026',
          lob: 'Workers Compensation',
          expiration: '01/01/2027',
          premium: '$117,000',
          status: 'Active'
        }
      ]
    };
    // FSC's list view sorts ascending on the Name field, which on
    // InsurancePolicy is the policy number. Each row then carries the
    // state for its own ⋮ row menu, mirroring the RFQs tab.
    return (byAccount[this.activeAccountId] || [])
      .slice()
      .sort((a, b) => a.number.localeCompare(b.number))
      .map((p) => {
        const menuOpen = this.openPolicyMenuId === p.id;
        return {
          ...p,
          actionsLabel: `Show actions for ${p.number}`,
          menuOpen,
          menuStyle: menuOpen ? this.openPolicyMenuStyle : '',
          menuBtnAria: menuOpen ? 'true' : 'false'
        };
      });
  }
  // ⋮ row menu on the Insurance Policies list. Fixed-positioned like the
  // RFQ list's so it escapes the record card's overflow clip.
  @track openPolicyMenuId = null;
  @track openPolicyMenuStyle = '';

  get hasPolicies() {
    return this.accountPolicies.length > 0;
  }
  get policiesCountLabel() {
    const n = this.accountPolicies.length;
    return `${n} ${n === 1 ? 'item' : 'items'}`;
  }

  // ── Rate Plans related list (Insurance Rate Plans data table) ────
  // Stored per-account so switching tabs doesn't bleed plans between
  // accounts. Lazily hydrated from SEED_RATE_PLANS_BY_ACCOUNT on first
  // read and then locally editable for the session.
  @track _ratePlansByAccount = {};
  @track isRatePlanFormOpen = false;
  @track ratePlanForm = { ...DEFAULT_RATE_PLAN_FORM };
  @track editingRatePlanId = null;
  _ratePlanSeq = 1100;
  // Tier Structure multi-select popover state.
  @track _rpTierMenuOpen = false;
  @track _rpTierMenuStyle = '';

  // Hydrate + return the rate plans for the active account, falling
  // back to the per-account seed when the account hasn't been touched
  // in this session.
  get accountRatePlans() {
    const id = this.activeAccountId;
    if (!id) return [];
    if (!(id in this._ratePlansByAccount)) {
      this._ratePlansByAccount[id] = (SEED_RATE_PLANS_BY_ACCOUNT[id] || []).map(
        (p) => ({ ...p, eligibleTiers: p.eligibleTiers.slice() })
      );
    }
    return this._ratePlansByAccount[id];
  }
  get hasRatePlans() {
    return this.accountRatePlans.length > 0;
  }
  get ratePlansCountLabel() {
    const n = this.accountRatePlans.length;
    return `${n} ${n === 1 ? 'item' : 'items'}`;
  }
  // Display rows - expands tier ids to readable labels and resolves
  // geo state abbreviations to the full state name.
  get ratePlanRows() {
    return this.accountRatePlans.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      frequency: p.frequency,
      geoState: this._geoStateLabel(p.geoState),
      tierStructure: RATE_PLAN_TIER_DEFS.filter((t) =>
        p.eligibleTiers.includes(t.id)
      )
        .map((t) => t.label)
        .join(', ')
    }));
  }
  _geoStateLabel(value) {
    const m = RATE_PLAN_GEO_STATES.find((s) => s.value === value);
    return m ? m.label : value || '-';
  }

  // Inline form - title + save-label flip on edit.
  get rpFormTitle() {
    return this.editingRatePlanId
      ? 'Edit Rate Plan'
      : 'Rate Plan Configuration';
  }
  get rpSaveLabel() {
    return this.editingRatePlanId ? 'Update Plan' : 'Save Plan';
  }

  // c-picklist option lists.
  get rpTypeOptions() {
    return RATE_PLAN_TYPE_OPTIONS.map((v) => ({ value: v, label: v }));
  }
  get rpFrequencyOptions() {
    return RATE_PLAN_FREQUENCY_OPTIONS.map((v) => ({ value: v, label: v }));
  }
  get rpGeoStateOptions() {
    return RATE_PLAN_GEO_STATES.slice();
  }
  get rpCurrencyOptions() {
    return RATE_PLAN_CURRENCY_OPTIONS.slice();
  }
  get rpFieldType() {
    return this.ratePlanForm.type;
  }
  get rpFieldGeoState() {
    return this.ratePlanForm.geoState;
  }
  get rpFieldFrequency() {
    return this.ratePlanForm.frequency;
  }
  get rpFieldCurrency() {
    return this.ratePlanForm.currency;
  }

  // Tier Structure multi-select (SLDS 2 combobox + listbox).
  get rpTierTriggerLabel() {
    if (!this.ratePlanForm.eligibleTiers.length) return 'Select tiers…';
    return RATE_PLAN_TIER_DEFS.filter((t) =>
      this.ratePlanForm.eligibleTiers.includes(t.id)
    )
      .map((t) => t.label)
      .join(', ');
  }
  get rpTierTriggerCls() {
    return this._rpTierMenuOpen
      ? 'sf-rp__multi-trigger is-open'
      : 'sf-rp__multi-trigger';
  }
  get rpTierValueCls() {
    return this.ratePlanForm.eligibleTiers.length
      ? 'sf-rp__multi-value'
      : 'sf-rp__multi-value is-placeholder';
  }
  get rpTierMenuAriaExpanded() {
    return this._rpTierMenuOpen ? 'true' : 'false';
  }
  get isRpTierMenuOpen() {
    return this._rpTierMenuOpen;
  }
  get rpTierMenuStyle() {
    return this._rpTierMenuStyle;
  }
  get rpTierMenuItems() {
    return RATE_PLAN_TIER_DEFS.map((t) => {
      const selected = this.ratePlanForm.eligibleTiers.includes(t.id);
      return {
        id: t.id,
        label: t.label,
        selected,
        ariaSelected: selected ? 'true' : 'false',
        cls: selected
          ? 'sf-rp__multi-item is-selected'
          : 'sf-rp__multi-item'
      };
    });
  }
  get hasRpTiers() {
    return this.ratePlanForm.eligibleTiers.length > 0;
  }
  get rpSaveDisabled() {
    const f = this.ratePlanForm;
    return !(
      f.type &&
      f.geoState &&
      f.frequency &&
      f.currency &&
      this.hasRpTiers
    );
  }

  // ── Handlers ────────────────────────────────────────────────────
  handleNewRatePlan() {
    this.editingRatePlanId = null;
    this.ratePlanForm = {
      ...DEFAULT_RATE_PLAN_FORM,
      geoState: this._accountDefaultGeoState(),
      currency: 'USD'
    };
    this._resetRpTierMenu();
    this.isRatePlanFormOpen = true;
  }
  handleEditRatePlan(event) {
    const id = event.currentTarget.dataset.id;
    const plan = this.accountRatePlans.find((p) => p.id === id);
    if (!plan) return;
    this.editingRatePlanId = id;
    this.ratePlanForm = {
      type: plan.type,
      geoState: plan.geoState,
      frequency: plan.frequency,
      currency: plan.currency,
      eligibleTiers: plan.eligibleTiers.slice()
    };
    this._resetRpTierMenu();
    this.isRatePlanFormOpen = true;
  }
  handleRatePlanFormCancel() {
    this.isRatePlanFormOpen = false;
    this.editingRatePlanId = null;
    this.ratePlanForm = { ...DEFAULT_RATE_PLAN_FORM };
    this._resetRpTierMenu();
  }
  handleRpTypeChange(event) {
    this.ratePlanForm = { ...this.ratePlanForm, type: event.detail.value };
  }
  handleRpGeoStateChange(event) {
    this.ratePlanForm = { ...this.ratePlanForm, geoState: event.detail.value };
  }
  handleRpFrequencyChange(event) {
    this.ratePlanForm = { ...this.ratePlanForm, frequency: event.detail.value };
  }
  handleRpCurrencyChange(event) {
    this.ratePlanForm = { ...this.ratePlanForm, currency: event.detail.value };
  }
  handleRpTierToggle(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    const has = this.ratePlanForm.eligibleTiers.includes(id);
    this.ratePlanForm = {
      ...this.ratePlanForm,
      eligibleTiers: has
        ? this.ratePlanForm.eligibleTiers.filter((x) => x !== id)
        : [...this.ratePlanForm.eligibleTiers, id]
    };
  }
  handleRpTierMenuToggle() {
    if (this._rpTierMenuOpen) {
      this._rpTierMenuOpen = false;
      return;
    }
    this._rpTierMenuOpen = true;
    this._positionRpTierMenu();
  }
  handleRpTierMenuScrim() {
    this._rpTierMenuOpen = false;
  }
  _resetRpTierMenu() {
    this._rpTierMenuOpen = false;
    this._rpTierMenuStyle = '';
  }
  // Fixed-position so the menu escapes the policies-tab scroll container.
  _positionRpTierMenu() {
    const trigger = this.template.querySelector('.sf-rp__multi-trigger');
    if (!trigger || typeof window === 'undefined') {
      this._rpTierMenuStyle = '';
      return;
    }
    const r = trigger.getBoundingClientRect();
    const gap = 4;
    const margin = 8;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const maxH = 288;
    const spaceBelow = vh - r.bottom;
    const spaceAbove = r.top;
    const openUp = spaceBelow < Math.min(maxH, 180) && spaceAbove > spaceBelow;
    let s = `position:fixed;left:${Math.round(r.left)}px;width:${Math.round(
      r.width
    )}px;right:auto;`;
    if (openUp) {
      const avail = Math.max(120, Math.min(maxH, spaceAbove - gap - margin));
      s += `bottom:${Math.round(vh - r.top + gap)}px;top:auto;max-height:${Math.round(
        avail
      )}px;`;
    } else {
      const avail = Math.max(120, Math.min(maxH, spaceBelow - gap - margin));
      s += `top:${Math.round(r.bottom + gap)}px;bottom:auto;max-height:${Math.round(
        avail
      )}px;`;
    }
    this._rpTierMenuStyle = s;
  }
  handleRatePlanSave() {
    if (this.rpSaveDisabled) return;
    const f = this.ratePlanForm;
    const tiers = f.eligibleTiers.slice();
    const wasEditing = !!this.editingRatePlanId;
    const id = this.activeAccountId;
    const current = this.accountRatePlans;

    let next;
    if (wasEditing) {
      next = current.map((p) =>
        p.id === this.editingRatePlanId
          ? {
              ...p,
              type: f.type,
              geoState: f.geoState,
              frequency: f.frequency,
              currency: f.currency,
              eligibleTiers: tiers
            }
          : p
      );
    } else {
      this._ratePlanSeq += 1;
      next = [
        ...current,
        {
          id: `irp-${id}-${this._ratePlanSeq}`,
          name: `IRP-${String(this._ratePlanSeq)}`,
          type: f.type,
          geoState: f.geoState,
          frequency: f.frequency,
          currency: f.currency,
          eligibleTiers: tiers
        }
      ];
    }
    this._ratePlansByAccount = {
      ...this._ratePlansByAccount,
      [id]: next
    };

    this.isRatePlanFormOpen = false;
    this.editingRatePlanId = null;
    this.ratePlanForm = { ...DEFAULT_RATE_PLAN_FORM };
    this._resetRpTierMenu();

  }
  // Best-effort default geo state per account. Acme's HQ field already
  // reads "HQ - Chicago" so we hard-map known accounts; anything else
  // returns empty and the broker picks manually.
  _accountDefaultGeoState() {
    const map = {
      '001EB00002pYzbMAC': 'OH',
      '001SB00001oXwntYAC': 'FL'
    };
    return map[this.activeAccountId] || '';
  }

  // Open the policy as a NEW Salesforce console workspace tab (like RFQ
  // tabs) rather than replacing the whole app - the app shell pushes the
  // tab and mounts c-eb-policy-record-page inside it.
  handlePolicyOpen(event) {
    event.preventDefault();
    const ds = event.currentTarget.dataset;
    if (!ds.id) return;
    // Forward the whole list row so the record page can fall back to it for
    // policies that have no hand-authored fixture in data/policyRecords.
    const row = this.accountPolicies.find((p) => p.id === ds.id) || null;
    this.dispatchEvent(
      new CustomEvent('openpolicytab', {
        detail: {
          id: ds.id,
          name: ds.name,
          number: ds.number,
          lob: ds.lob,
          accountId: this.activeAccountId,
          seed: row
            ? {
                id: row.id,
                name: row.name,
                number: row.number,
                lob: row.lob,
                expiration: row.expiration,
                premium: row.premium,
                status: row.status
              }
            : null
        },
        bubbles: true,
        composed: true
      })
    );
  }

  _closePolicyMenu() {
    this.openPolicyMenuId = null;
    this.openPolicyMenuStyle = '';
  }

  handlePolicyMenuToggle(event) {
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    if (this.openPolicyMenuId === id) {
      this._closePolicyMenu();
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const right = Math.max(8, Math.round(window.innerWidth - rect.right));
    const top = Math.round(rect.bottom);
    this.openPolicyMenuStyle = `top: ${top}px; right: ${right}px; left: auto;`;
    this.openPolicyMenuId = id;
  }

  // New Request For Quote opens the same SLDS Intake modal the Create RFQ
  // quick action does, but flagged as a renewal so the modal drops the
  // start-method radios and the prior-policy picker - the broker already
  // picked the policy by acting on its row.
  handlePolicyMenuAction(event) {
    event.preventDefault();
    event.stopPropagation();
    const ds = event.currentTarget.dataset;
    this._closePolicyMenu();
    if (ds.action !== 'create-renewal' || !ds.id) return;
    this.dispatchEvent(
      new CustomEvent('startrfqintake', {
        detail: {
          context: {
            ...this.launchPayload,
            isRenewal: true,
            renewalOfPolicyId: ds.id,
            renewalPolicyNumber: ds.number || '',
            loc: POLICY_LINE_TO_LOC[ds.lob] || this.launchPayload.loc
          }
        },
        bubbles: true,
        composed: true
      })
    );
  }

  selectTab(event) {
    const id = event.currentTarget.dataset.id;
    if (id) this.activeTab = id;
  }

  // ── App Launcher ────────────────────────────────────────────────
  // List of apps + Setup. Mirrors the Salesforce App Launcher: a grid of
  // installed apps with "Setup" surfaced at the top as a quick action.
  get launcherClass() {
    return this.launcherOpen
      ? 'sf-app-launcher-popover is-open'
      : 'sf-app-launcher-popover';
  }
  get launcherItems() {
    const apps = [
      { id: 'sales',              label: 'Sales',              meta: 'Pipeline and forecast',          accent: '#066afe' },
      { id: 'service',            label: 'Service',            meta: 'Cases, knowledge, channels',     accent: '#032d60' },
      { id: 'marketing',          label: 'Marketing',          meta: 'Campaigns and journeys',         accent: '#fe9339' },
      { id: 'financial-services', label: 'Financial Services', meta: 'Wealth, banking, advisory',      accent: '#04844b' },
      { id: 'commerce',           label: 'Commerce',           meta: 'Storefronts and order mgmt.',    accent: '#8e1da3' },
      { id: 'data-cloud',         label: 'Data Cloud',         meta: 'Unified customer data',          accent: '#5867e8' }
    ];
    return apps.map((a) => ({
      ...a,
      initial: a.label.charAt(0),
      style: `--app-tile-accent: ${a.accent}`
    }));
  }

  // Anchor links in the launcher are placeholders - swallow the click.
  preventDefault(event) {
    event.preventDefault();
  }

  toggleLauncher(event) {
    event.stopPropagation();
    this.launcherOpen = !this.launcherOpen;
    if (this.launcherOpen) {
      // Position the (fixed) popover under the launcher button. We do
      // this after the next frame so the popover element exists in the
      // shadow DOM by the time we measure.
      requestAnimationFrame(() => this.positionLauncherPopover());
    }
  }

  handleLauncherKeydown(event) {
    if (event.key !== 'Escape' || !this.launcherOpen) return;
    event.preventDefault();
    event.stopPropagation();
    this.launcherOpen = false;
    // Escape returns focus to the trigger so the dismiss does not
    // strand the tab ring at the top of the document.
    const btn = this.template.querySelector('.sf-tab-launcher');
    if (btn) btn.focus();
  }

  positionLauncherPopover() {
    const btn = this.template.querySelector('.sf-tab-launcher');
    const pop = this.template.querySelector('.sf-app-launcher-popover');
    if (!btn || !pop) return;
    const r = btn.getBoundingClientRect();
    pop.style.top = `${r.bottom + 6}px`;
    pop.style.left = `${r.left}px`;
  }

  // Dormant. The App Launcher row that called this was removed once the
  // gear menu became the single way into Setup (see openSetupHome). Kept
  // alongside the SETUP_TAB_ID workspace so restoring the entry is a
  // one-line template change.
  openSetup(event) {
    event.preventDefault();
    event.stopPropagation();
    this.launcherOpen = false;
    this.setupOpen = true;
    // Activate the new Setup tab so the broker lands on it immediately,
    // but the other tabs stay alive in the strip so they can switch back.
    this._localActiveTabId = SETUP_TAB_ID;
    this.dispatchEvent(
      new CustomEvent('tabactivate', {
        detail: { tabId: SETUP_TAB_ID },
        bubbles: true,
        composed: true
      })
    );
  }

  handleSetupClose() {
    this._closeSetupTab();
  }

  // ── Setup Menu (global-header gear) ────────────────────────────
  // ── Global-header bell ────────────────────────────────────
  // The shell owns the notification records; this component owns
  // whether the tray is showing and replays the arrival beat on the
  // bell. `_seenNotificationCount` tracks how many records the bell
  // has already reacted to, so the ring/pop fires on genuinely new
  // arrivals rather than on every unrelated re-render.
  get hasUnreadNotifications() {
    return this.unreadNotificationCount > 0;
  }

  get unreadNotificationCount() {
    return (this.notifications || []).filter((n) => n.unread).length;
  }

  get notifBellClass() {
    const base = this.notificationsOpen
      ? 'sf-bell-btn sf-bell-btn_open'
      : 'sf-bell-btn';
    return this.bellRinging ? `${base} sf-bell-btn_ring` : base;
  }

  get notifBadgeClass() {
    return this.bellRinging
      ? 'sf-bell-btn__badge sf-bell-btn__badge_pop'
      : 'sf-bell-btn__badge';
  }

  get notifBellLabel() {
    const n = this.unreadNotificationCount;
    if (!n) return 'Notifications';
    return `Notifications, ${n} unread`;
  }

  handleNotificationsToggle(event) {
    event.preventDefault();
    event.stopPropagation();
    this._holdNotifTray();
    const opening = !this.notificationsOpen;
    this.notificationsOpen = opening;
    this._pendingTrayFocus = opening;
    if (!opening) this._focusBell();
  }

  // Fired by the scrim (click anywhere outside the tray), the tray's
  // own close button, and Escape.
  handleNotificationsDismiss(event) {
    if (event) event.stopPropagation();
    this._holdNotifTray();
    this.notificationsOpen = false;
    this._focusBell();
  }

  handleNotificationsMarkAllRead() {
    this.dispatchEvent(
      new CustomEvent('notificationsread', { bubbles: true, composed: true })
    );
  }

  handleNotificationOpen(event) {
    this._holdNotifTray();
    this.notificationsOpen = false;
    this.dispatchEvent(
      new CustomEvent('notificationopen', {
        detail: { id: event.detail?.id },
        bubbles: true,
        composed: true
      })
    );
  }

  // Ring the bell and pop the counter for one beat. The class is
  // swapped back off so the next arrival re-triggers the animation
  // instead of the browser treating it as already-running.
  _playBellBeat() {
    if (this._bellBeatTimer) clearTimeout(this._bellBeatTimer);
    this.bellRinging = true;
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this._bellBeatTimer = setTimeout(() => {
      this.bellRinging = false;
      this._bellBeatTimer = null;
    }, 700);
  }

  _focusBell() {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    Promise.resolve().then(() => {
      const btn = this.template.querySelector('.sf-bell-btn');
      if (btn) btn.focus();
    });
  }

  handleSetupMenuToggle(event) {
    event.preventDefault();
    event.stopPropagation();
    this.setupMenuOpen = !this.setupMenuOpen;
  }

  handleSetupMenuDismiss(event) {
    if (event) event.stopPropagation();
    this.setupMenuOpen = false;
    this._focusSetupGear();
  }

  handleSetupMenuScrim() {
    this.setupMenuOpen = false;
  }

  handleSetupMenuKeydown(event) {
    if (event.key !== 'Escape' || !this.setupMenuOpen) return;
    event.stopPropagation();
    this.setupMenuOpen = false;
    this._focusSetupGear();
  }

  handleSetupMenuPick(event) {
    event.preventDefault();
    event.stopPropagation();
    const id = event.currentTarget.dataset.item;
    this.setupMenuOpen = false;

    if (id === 'setup') {
      this.openSetupHome();
      return;
    }

    const row =
      SETUP_MENU_PRIMARY.find((i) => i.id === id) ||
      SETUP_MENU_SECONDARY.find((i) => i.id === id);
    this._focusSetupGear();
  }

  _focusSetupGear() {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    Promise.resolve().then(() => {
      const btn = this.template.querySelector('.sf-gear-btn');
      if (btn) btn.focus();
    });
  }

  // Setup Menu → Setup. Opens the org's Setup home as its own workspace
  // tab, mirroring openSetup.
  openSetupHome() {
    this.launcherOpen = false;
    this.setupHomeOpen = true;
    this._localActiveTabId = SETUP_HOME_TAB_ID;
    this.dispatchEvent(
      new CustomEvent('tabactivate', {
        detail: { tabId: SETUP_HOME_TAB_ID },
        bubbles: true,
        composed: true
      })
    );
  }

  handleSetupHomeClose() {
    this._closeSetupHomeTab();
  }

  _closeSetupHomeTab() {
    this.setupHomeOpen = false;
    if (this.effectiveActiveTabId === SETUP_HOME_TAB_ID) {
      const fallback = HOME_TAB_ID;
      this._localActiveTabId = fallback;
      this.dispatchEvent(
        new CustomEvent('tabactivate', {
          detail: { tabId: fallback },
          bubbles: true,
          composed: true
        })
      );
    }
  }

  // App Launcher → Client 360. Opens the standalone dashboard as its
  // own workspace tab (mirrors openSetup).
  openClient360(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.launcherOpen = false;
    this.client360Open = true;
    this._localActiveTabId = CLIENT360_TAB_ID;
    this.dispatchEvent(
      new CustomEvent('tabactivate', {
        detail: { tabId: CLIENT360_TAB_ID },
        bubbles: true,
        composed: true
      })
    );
  }

  handleClient360Close() {
    this._closeClient360Tab();
  }

  _closeClient360Tab() {
    this.client360Open = false;
    if (this.effectiveActiveTabId === CLIENT360_TAB_ID) {
      const fallback = HOME_TAB_ID;
      this._localActiveTabId = fallback;
      this.dispatchEvent(
        new CustomEvent('tabactivate', {
          detail: { tabId: fallback },
          bubbles: true,
          composed: true
        })
      );
    }
  }

  // App Launcher → Revenue Intelligence. Opens the org-wide
  // dashboard as its own workspace tab (mirrors openSetup +
  // openClient360).
  openRevenue(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.launcherOpen = false;
    // Persona capability gate - simulates Dashboard/Report Folder
    // sharing. Producers/AMs never see the Revenue tile in the
    // Dashboards launcher, but a stale deep-link (?tab=tab-revenue-
    // intelligence) or a direct call from elsewhere could still hit
    // this open handler. Bail here so the executive canvas stays
    // locked to Principal / Finance.
    const persona = getPersona(currentUser.personaId);
    if (!persona?.capabilities?.seeAgencyRevenue) {
      // Silently declined - the tile is absent for these personas, so a
      // toast would be explaining a button they cannot see.
      return;
    }
    this.revenueOpen = true;
    this._localActiveTabId = REVENUE_TAB_ID;
    this.dispatchEvent(
      new CustomEvent('tabactivate', {
        detail: { tabId: REVENUE_TAB_ID },
        bubbles: true,
        composed: true
      })
    );
  }

  handleRevenueClose() {
    this._closeRevenueTab();
  }

  _closeRevenueTab() {
    this.revenueOpen = false;
    if (this.effectiveActiveTabId === REVENUE_TAB_ID) {
      const fallback = HOME_TAB_ID;
      this._localActiveTabId = fallback;
      this.dispatchEvent(
        new CustomEvent('tabactivate', {
          detail: { tabId: fallback },
          bubbles: true,
          composed: true
        })
      );
    }
  }

  // Home (Run My Day) - a workspace tab inside the SF shell (mirrors
  // openDashboards). The RMD content mounts inline in the Home panel
  // (see homePanelClass) so activating Home keeps every other
  // workspace tab (Mavericks, Acme, RFQ tabs, ...) in the strip. We
  // deliberately DO NOT dispatch a top-level `navigate` route swap
  // here - that would unmount the SF shell entirely and land the
  // broker on a standalone RMD, which loses the workspace tab strip.
  openRunMyDay(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.launcherOpen = false;
    this._localActiveTabId = HOME_TAB_ID;
    this.dispatchEvent(
      new CustomEvent('tabactivate', {
        detail: { tabId: HOME_TAB_ID },
        bubbles: true,
        composed: true
      })
    );
  }

  // Keyboard activation for the Home tab pill (Enter / Space).
  handleHomeTabKey(event) {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      this.openRunMyDay(event);
    }
  }

  // App Launcher → Dashboards. Opens the Setup-lookalike landing page
  // (c-dashboards-home) as its own workspace tab (mirrors openSetup).
  openDashboards(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.launcherOpen = false;
    this.dashboardsOpen = true;
    this._localActiveTabId = DASHBOARDS_TAB_ID;
    this.dispatchEvent(
      new CustomEvent('tabactivate', {
        detail: { tabId: DASHBOARDS_TAB_ID },
        bubbles: true,
        composed: true
      })
    );
  }

  handleDashboardsClose() {
    this._closeDashboardsTab();
  }

  // c-meeting-center bubbles `close` when the broker explicitly
  // dismisses the segment. The playbook owns a workspace tab now, so
  // "close" means "go back to where I opened this from" - Home. The
  // tab itself stays open; the strip's own X is what closes it.
  handleMeetingCenterClose() {
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: { route: 'run-my-day' },
        bubbles: true,
        composed: true
      })
    );
  }

  _closeDashboardsTab() {
    this.dashboardsOpen = false;
    if (this.effectiveActiveTabId === DASHBOARDS_TAB_ID) {
      const fallback = HOME_TAB_ID;
      this._localActiveTabId = fallback;
      this.dispatchEvent(
        new CustomEvent('tabactivate', {
          detail: { tabId: fallback },
          bubbles: true,
          composed: true
        })
      );
    }
  }

  // Tile click inside the Dashboards landing page - route to the
  // matching dashboard. Each opens in its own tab / route; the
  // Dashboards tab stays in the strip so the user can return.
  handleDashboardOpen(event) {
    const id = event && event.detail ? event.detail.id : null;
    if (id === 'run-my-day') {
      this.openRunMyDay();
    } else if (id === 'client360') {
      this.openClient360();
    } else if (id === 'revenue') {
      this.openRevenue();
    }
  }

  // Drop the Setup tab from the strip and switch focus back to the
  // most recently-active account tab.
  _closeSetupTab() {
    this.setupOpen = false;
    if (this.effectiveActiveTabId === SETUP_TAB_ID) {
      const fallback = HOME_TAB_ID;
      this._localActiveTabId = fallback;
      this.dispatchEvent(
        new CustomEvent('tabactivate', {
          detail: { tabId: fallback },
          bubbles: true,
          composed: true
        })
      );
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────
  connectedCallback() {
    // Close the dropdown/launcher on any outside click so menus don't get
    // stranded open when the user clicks elsewhere on the record page.
    this._docClickHandler = (e) => {
      if (this.dropdownOpen) {
        const trigger = this.template.querySelector('.action-dropdown');
        if (trigger && !trigger.contains(e.target)) {
          this.dropdownOpen = false;
        }
      }
      if (this.launcherOpen) {
        const launcher = this.template.querySelector('.sf-app-launcher-wrap');
        if (launcher && !launcher.contains(e.target)) {
          this.launcherOpen = false;
        }
      }
      if (this.openPolicyMenuId) {
        const list = this.template.querySelector('.sf-policies');
        if (list && !list.contains(e.target)) this._closePolicyMenu();
      }
    };
    document.addEventListener('click', this._docClickHandler, true);

    // The policy row menu is position:fixed, so dismiss it on
    // scroll/resize rather than let it float away from its trigger.
    this._policyMenuDismissHandler = () => {
      if (this.openPolicyMenuId) this._closePolicyMenu();
    };
    window.addEventListener('scroll', this._policyMenuDismissHandler, true);
    window.addEventListener('resize', this._policyMenuDismissHandler, true);

    // Escape must close the tray even when auto-open left focus on the
    // bell (or the RFQs tab). The popover's own onkeydown never sees
    // those keypresses because the dialog is not focused.
    this._notifKeyHandler = (e) => {
      if (e.key !== 'Escape' || !this.notificationsOpen) return;
      if (e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      this.handleNotificationsDismiss();
    };
    document.addEventListener('keydown', this._notifKeyHandler, true);
  }

  renderedCallback() {
    // Remembering which account tab was last active is a side effect, so
    // it runs once the render has committed. Doing it inside
    // activeAccountId made a template read mutate tracked state, which
    // LWC reports on every pass.
    const tabId = this.effectiveActiveTabId;
    if (ACCOUNT_BY_TAB_ID[tabId]) this._lastAccountTabId = tabId;

    // Announce the RFQs tab coming into view. This is what releases a
    // routed bundle's carrier responses: they used to begin the moment
    // the bundle was sent, so a broker who took a few seconds to
    // navigate here found the quotes already in and the row already
    // reading "Quotes Received". Held until the list is on screen, the
    // sequence is always watched from "Sent to Carrier" onwards.
    //
    // Announced from here rather than the tab click handler because
    // three separate paths set activeTab (click, arrow-key nav, and an
    // external context hand-off), and a missed path would leave the
    // bundle waiting forever.
    if (this.activeTab !== this._announcedTab) {
      this._announcedTab = this.activeTab;
      if (this.activeTab === 'rfqs') {
        this.dispatchEvent(
          new CustomEvent('rfqlistviewed', {
            detail: { accountId: this.account?.id || null },
            bubbles: true,
            composed: true
          })
        );
      }
    }

    if (this._pendingTrayFocus && this.notificationsOpen) {
      this._pendingTrayFocus = false;
      const tray = this.template.querySelector('c-notification-tray');
      if (tray && typeof tray.focusPanel === 'function') tray.focusPanel();
    }
  }

  disconnectedCallback() {
    if (this._bellBeatTimer) {
      clearTimeout(this._bellBeatTimer);
      this._bellBeatTimer = null;
    }
    this._clearNotifAutoClose();
    if (this._notifKeyHandler) {
      document.removeEventListener('keydown', this._notifKeyHandler, true);
      this._notifKeyHandler = null;
    }
    if (this._docClickHandler) {
      document.removeEventListener('click', this._docClickHandler, true);
      this._docClickHandler = null;
    }
    if (this._policyMenuDismissHandler) {
      window.removeEventListener(
        'scroll',
        this._policyMenuDismissHandler,
        true
      );
      window.removeEventListener(
        'resize',
        this._policyMenuDismissHandler,
        true
      );
      this._policyMenuDismissHandler = null;
    }
    this._detachSfSearchDocClick();
  }

  // ── Handlers ───────────────────────────────────────────────────
  toggleDropdown(event) {
    event.stopPropagation();
    this.dropdownOpen = !this.dropdownOpen;
  }

  handleAction(event) {
    event.preventDefault();
    event.stopPropagation();
    const action = event.currentTarget.dataset.action;
    this.dropdownOpen = false;
    if (action !== 'start-rfq') return;
    // The Quick Action no longer routes straight into the wizard. It opens
    // the standard SLDS Intake modal at the app shell; the wizard tab only
    // opens after the modal's "Save & Continue".
    this.dispatchEvent(
      new CustomEvent('startrfqintake', {
        detail: { context: this.launchPayload },
        bubbles: true,
        composed: true
      })
    );
  }

  // Selecting an existing RFQ from the data table inside the "RFQs" tab.
  // Emits a distinct event so the app shell can decide how to surface the
  // RFQ - typically by opening / focusing a workspace tab for that RFQ
  // rather than re-running the intake modal flow.
  handleRfqRowSelect(event) {
    const { id, name, lob, status } = event.detail || {};
    if (!id) return;
    this.dispatchEvent(
      new CustomEvent('openrfqtab', {
        detail: {
          rfqId: id,
          rfqName: name,
          rfqStatus: status,
          rfqLob: lob,
          context: { ...this.launchPayload, rfqId: id, rfqName: name }
        },
        bubbles: true,
        composed: true
      })
    );
  }

  // Row-level action from the RFQs data table + Submission Board ⋮
  // menus. `compare_quotes` is expanded here into an
  // `openquotecompare` payload targeting the account-scoped quote
  // comparison modal; every other action is left to bubble up to
  // the app shell's `onrfqaction` listener, which owns the
  // accountRfqs mutations (Add to Board / Remove from Board /
  // Delete / Edit / Add LOC).
  // Which quote set the comparison grid should open. Only an
  // application that actually has quotes on file is usable, so a row
  // pointing at an empty one (or at none at all) resolves to a seeded
  // set instead of rendering an empty grid.
  //
  // The fallback is chosen by line of coverage, not just by EB vs P&C:
  // a Renters comparison filled from the auto set would label its
  // columns "Standard Auto" and leave every property row blank, so
  // property lines borrow the homeowners quotes instead.
  _compareApplicationId(row, isEb, locLabel) {
    // A routed row records the line it went out under, which decides
    // the quote set directly.
    const routed = row?.quoteLocId
      ? QUOTE_APP_BY_LOC_ID[row.quoteLocId]
      : null;
    if (routed) return routed;
    const PROPERTY_LOCS = new Set(['Homeowners', 'Renters']);
    const fallback = isEb
      ? 'rfq-acme-001'
      : PROPERTY_LOCS.has(locLabel)
        ? 'rfq-mavericks-home-001'
        : 'rfq-mavericks-001';
    const own = row?.applicationId;
    if (!own) return fallback;
    const hasFiled = ALL_QUOTES.some((q) => q.applicationId === own);
    return hasFiled ? own : fallback;
  }

  // Grid columns for the comparison. A row whose quotes arrived from a
  // routing gets one column per carrier that answered, so the grid's
  // width matches the count the row advertises instead of showing every
  // plan in the seeded set. Anything else falls through to the event's
  // own selection (empty means "every quote for the application").
  _compareQuoteIds(row, fromEvent) {
    const carriers = row?.quoteCarrierIds;
    if (Array.isArray(carriers) && carriers.length && row?.quoteLocId) {
      const ids = quoteIdsForCarriers(row.quoteLocId, carriers);
      if (ids.length) return ids;
    }
    return Array.isArray(fromEvent) ? fromEvent : [];
  }

  handleRfqAction(event) {
    const { id, action, quoteIds } = event.detail || {};
    if (action !== 'compare_quotes') return;
    const a = this.account;
    const isEb = a?.launch?.lob === 'Employee Benefits';
    const row = (this.currentAccountRfqs || []).find((r) => r.id === id);
    const locLabel =
      row?.lob &&
      row.lob !== 'Employee Benefits' &&
      row.lob !== 'P&C' &&
      row.lob !== 'Life'
        ? row.lob
        : isEb
          ? 'Group Medical'
          : 'Personal Auto';
    this.dispatchEvent(
      new CustomEvent('openquotecompare', {
        detail: {
          rfqId: id,
          quoteIds: this._compareQuoteIds(row, quoteIds),
          // The row's own application wins, so a Homeowners RFQ opens
          // the homeowners quote set and an auto RFQ opens the auto
          // one. Rows created in-session carry no applicationId, and
          // some seeded ones point at an application with no quotes on
          // file (Renters), so both fall back to the line's seeded set
          // rather than opening the comparison grid empty.
          applicationId: this._compareApplicationId(row, isEb, locLabel),
          applicationName: `${a.name} - ${locLabel}`,
          accountName: a.name,
          accountId: a.id,
          // Row set the compare grid renders. Derived from the row's
          // line of coverage, not from the account, so each RFQ is
          // compared on the attributes that matter to its line.
          flow: COMPARE_FLOW_BY_LOC[locLabel] || (isEb ? 'eb' : 'pa'),
          // The compared RFQ's line of coverage. The modal echoes it in
          // the grid header and in the proposal copy so a Renters
          // comparison never reads as an auto renewal.
          locLabel
        },
        bubbles: true,
        composed: true
      })
    );
  }

  // Forward navigate / policy / risk events from the wizard panels up to
  // the app shell so it can update toasts / Slack drawer / bound state.
  // A wizard-issued "back to account" navigate is translated into a
  // workspace-tab activation so the Account tab regains focus while the
  // wizard tab stays open in the background.
  handleWizardNavigate(event) {
    const route = event.detail?.route;
    if (route === 'account-record-page') {
      // Resolve which account tab to focus - prefer the account the
      // wizard was launched from, fall back to whatever's currently
      // shown in the highlights panel.
      const sourceAccountId = event.detail?.context?.accountId;
      const accountTabId =
        TAB_ID_BY_ACCOUNT[sourceAccountId] || this._lastAccountTabId;
      this._localActiveTabId = accountTabId;
      // Honor an explicit secondary-tab request from the wizard (e.g.
      // the Saved-to-Bundle interstitial asking us to open the
      // Submission Board). Falls through to whatever tab was
      // previously active if omitted.
      const desiredTab = event.detail?.context?.activeTab;
      if (desiredTab) {
        this.activeTab = desiredTab;
      }
      this.dispatchEvent(
        new CustomEvent('tabactivate', {
          detail: { tabId: accountTabId },
          bubbles: true,
          composed: true
        })
      );
      return;
    }
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: event.detail,
        bubbles: true,
        composed: true
      })
    );
  }
  handleWizardPolicyBound(event) {
    this.dispatchEvent(
      new CustomEvent('policybound', {
        detail: event.detail,
        bubbles: true,
        composed: true
      })
    );
  }
  handleWizardRiskSubmitted(event) {
    this.dispatchEvent(
      new CustomEvent('risksubmitted', {
        detail: event.detail,
        bubbles: true,
        composed: true
      })
    );
  }

  // Submission Board asked us to surface a toast (e.g. the
  // "RFQ has been submitted to <carriers>" confirmation fired the
  // moment Route to Carriers is clicked). Re-emit so the app shell's
  // handleChildToast drives the shared c-toast.
  handleBoardToast(event) {
    this.dispatchEvent(
      new CustomEvent('toast', {
        detail: event.detail,
        bubbles: true,
        composed: true
      })
    );
  }

  // Submission Board routed a bundle to carriers - re-emit up so
  // the app shell can flip statuses on accountRfqs + broadcast the
  // Quote Bot / Agentforce Slack pair.
  handleRouteBundle(event) {
    this.dispatchEvent(
      new CustomEvent('routebundle', {
        detail: event.detail,
        bubbles: true,
        composed: true
      })
    );
  }

  // Broker picked a quote on the QuinStreet rating screen - pass
  // the detail up so the app shell can flip the routed RFQs to
  // "Sent to Carrier" and toast a confirmation.
  handleRatingComplete(event) {
    this.dispatchEvent(
      new CustomEvent('ratingcomplete', {
        detail: event.detail,
        bubbles: true,
        composed: true
      })
    );
  }

  // ── Salesforce-shell search - view-model + handlers ──────────
  get _sfNormalizedQuery() {
    return (this.sfSearchQuery || '').trim().toLowerCase();
  }
  get _sfAccountResults() {
    // Accounts that have a workspace-tab id are tappable; the
    // others (Sunrise / Bluebird / Coastal) currently don't have
    // a routed tab so they're filtered out. Wire their tab ids in
    // TAB_ID_BY_ACCOUNT to expose them here too.
    return MOCK_ACCOUNTS
      .filter((a) => TAB_ID_BY_ACCOUNT[a.id])
      .map((a) => ({
        id: TAB_ID_BY_ACCOUNT[a.id],
        kind: 'account',
        isAccount: true,
        isRfq: false,
        markClass: 'sf-search-result-mark sf-search-result-mark_account',
        label: a.name,
        meta: [a.industry, a.city].filter(Boolean).join(' \u00b7 '),
        sort: a.name.toLowerCase()
      }));
  }
  get _sfRfqResults() {
    return (this.rfqTabs || []).map((t) => {
      const acct = MOCK_ACCOUNTS.find((a) => a.id === t.accountId);
      const kindLabel = t.type === 'policy' ? 'Policy' : 'RFQ';
      const acctLabel = acct ? acct.name : '';
      return {
        id: t.id,
        kind: 'rfq',
        isAccount: false,
        isRfq: true,
        markClass: 'sf-search-result-mark sf-search-result-mark_quotes',
        label: t.label || 'Untitled RFQ',
        meta: [kindLabel, acctLabel].filter(Boolean).join(' \u00b7 '),
        sort: (t.label || '').toLowerCase()
      };
    });
  }
  get sfSearchResults() {
    const q = this._sfNormalizedQuery;
    const all = [...this._sfAccountResults, ...this._sfRfqResults];
    const filtered = q
      ? all.filter(
          (r) =>
            r.label.toLowerCase().includes(q) ||
            r.meta.toLowerCase().includes(q)
        )
      : all;
    return filtered.sort((a, b) => a.sort.localeCompare(b.sort));
  }
  get hasSfSearchResults() {
    return this.sfSearchResults.length > 0;
  }
  get sfSearchEmptyCopy() {
    return this._sfNormalizedQuery
      ? `No matches for "${this.sfSearchQuery}"`
      : 'No accounts or open RFQs yet.';
  }

  handleSfSearchFocus() {
    this._openSfSearch();
  }
  handleSfSearchInput(event) {
    this.sfSearchQuery = event.target.value || '';
    this._openSfSearch();
  }
  handleSfSearchKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this._closeSfSearch();
    }
  }
  handleSfSearchResultPick(event) {
    const tabId = event.currentTarget.dataset.tabId;
    if (!tabId) return;
    this._closeSfSearch();
    this.sfSearchQuery = '';
    // Route the workspace tab - accountRecordPage's
    // activeWorkspaceTabId setter auto-closes Setup if it's open,
    // so jumping from Setup to an account tab restores the
    // original tab strip.
    this._localActiveTabId = tabId;
    this.dispatchEvent(
      new CustomEvent('tabactivate', {
        detail: { tabId },
        bubbles: true,
        composed: true
      })
    );
  }
  handleSfSearchResultKey(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.handleSfSearchResultPick(event);
  }

  // ── Agentforce Ask (global header) ─────────────────────────────
  // The org routes Ask to /lightning/coworker, which opens the Agentforce
  // Coworker landing page as its own workspace tab - not a docked panel.
  // Re-clicking the pill while the tab already exists just re-focuses it,
  // which is what the org does too.
  handleAskAgentforce() {
    this._closeSfSearch();
    this.coworkerOpen = true;
    this._localActiveTabId = COWORKER_TAB_ID;
    this.dispatchEvent(
      new CustomEvent('tabactivate', {
        detail: { tabId: COWORKER_TAB_ID },
        bubbles: true,
        composed: true
      })
    );
  }

  // Closing the Coworker tab falls back to the first account tab and
  // returns focus to the pill, so a keyboard user lands back where they
  // started instead of at the top of the document.
  _closeCoworkerTab() {
    this.coworkerOpen = false;
    if (this.effectiveActiveTabId === COWORKER_TAB_ID) {
      const fallback = HOME_TAB_ID;
      this._localActiveTabId = fallback;
      this.dispatchEvent(
        new CustomEvent('tabactivate', {
          detail: { tabId: fallback },
          bubbles: true,
          composed: true
        })
      );
    }
    const button = this.refs && this.refs.askButton;
    if (button && typeof button.focusPill === 'function') {
      button.focusPill();
    }
  }
  // Dismiss rides a document listener rather than a scrim: .sf-search is
  // transformed, so it is the containing block for `position: fixed`
  // descendants and a scrim nested inside it can only ever cover the
  // 400x32 control. Attached on open and torn down on close so the
  // handler never outlives the panel.
  _openSfSearch() {
    this.sfSearchOpen = true;
    if (this._sfSearchDocClick) return;
    this._sfSearchDocClick = (event) => {
      // At document level `event.target` is retargeted to the host, so
      // composedPath is the only reliable inside-the-search test. Keeping
      // the whole .sf-search subtree as "inside" is what lets a result row
      // run its own handler instead of being dismissed out from under it.
      const search = this.template.querySelector('.sf-search');
      const path =
        typeof event.composedPath === 'function' ? event.composedPath() : [];
      if (search && path.indexOf(search) !== -1) return;
      this._closeSfSearch();
    };
    document.addEventListener('click', this._sfSearchDocClick, true);
  }
  _closeSfSearch() {
    this.sfSearchOpen = false;
    this._detachSfSearchDocClick();
  }
  _detachSfSearchDocClick() {
    if (!this._sfSearchDocClick) return;
    document.removeEventListener('click', this._sfSearchDocClick, true);
    this._sfSearchDocClick = null;
  }
}
