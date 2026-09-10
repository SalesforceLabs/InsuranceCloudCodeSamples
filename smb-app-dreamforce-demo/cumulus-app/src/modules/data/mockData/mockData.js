/**
 * Central mock data store. Every screen reads from here, every "API" in
 * `api.js` returns subsets of these records. Replace by wiring the API client
 * to real Apex/Connect endpoints without touching any component.
 */

import { POLICY_TARGET } from 'data/insurancePolicy';
import { formatUsDate, today } from 'data/dates';
import { getClient360 } from 'data/client360';

// ─────────────────────────────────────────────────────────────────────────────
// PERSONAS - demo stand-in for Salesforce Profile-based Home assignment.
//
// In a production org, each Profile (Producer, Agency Principal, Finance)
// would have its own Lightning App Home page assigned via Setup, plus
// dynamic component visibility rules and Report/Dashboard folder sharing
// controlling which widgets and datasets a user can see. In this
// prototype we compress those levers into three concepts on each persona:
//
//   • homeVariant   - which Run My Day layout the user gets
//                     ('renewals' | 'revenue' | 'tabbed')
//   • capabilities  - what widgets/data the shell should mount
//                     (seeRenewalsOps, seeAgencyRevenue, seeBilling)
//   • profileLabel  - the equivalent Salesforce Profile, for demo copy
//
// The active persona is switched at runtime via `setActivePersona(id)`
// (called from c-top-nav's persona menu). `currentUser` is mutated in
// place so existing importers that read fields on demand
// (avatar initials, greetings, message authorship) reflect the new
// identity without needing to re-import.
// ─────────────────────────────────────────────────────────────────────────────
export const PERSONAS = [
  {
    id: 'producer',
    name: 'Elena Rostova',
    role: 'Producer',
    profileLabel: 'Producer / Account Manager',
    initials: 'ER',
    avatarColor: '#066afe',
    homeVariant: 'renewals',
    homeTitle: 'Renewal Management',
    homeEyebrow: 'Run my day',
    capabilities: {
      seeRenewalsOps: true,
      seeAgencyRevenue: false,
      seeBilling: false
    }
  },
  {
    id: 'principal',
    name: 'Priya Shah',
    role: 'Agency Principal',
    profileLabel: 'Agency Principal',
    initials: 'PS',
    avatarColor: '#7c3aed',
    homeVariant: 'tabbed',
    homeTitle: 'Agency Command Center',
    homeEyebrow: 'Run my day',
    capabilities: {
      seeRenewalsOps: true,
      seeAgencyRevenue: true,
      seeBilling: true
    }
  },
  {
    id: 'finance',
    name: 'Marcus Chen',
    role: 'Finance Lead',
    profileLabel: 'Finance / Ops',
    initials: 'MC',
    avatarColor: '#0f7f4f',
    homeVariant: 'revenue',
    homeTitle: 'Revenue & Commission',
    homeEyebrow: 'Run my day',
    capabilities: {
      seeRenewalsOps: false,
      seeAgencyRevenue: true,
      seeBilling: true
    }
  }
];

export const DEFAULT_PERSONA_ID = 'producer';

export function getPersona(id) {
  return PERSONAS.find((p) => p.id === id) || PERSONAS[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// CURRENT USER - the producer/broker we're simulating. Seeded to the
// default persona (Elena Rostova / Producer). Mutated in place by
// setActivePersona() so consumers that read fields on demand pick up
// the new identity without touching import bindings.
// ─────────────────────────────────────────────────────────────────────────────
export const currentUser = {
  ...toUserShape(getPersona(DEFAULT_PERSONA_ID))
};

function toUserShape(persona) {
  return {
    id: `u-${persona.id}`,
    name: persona.name,
    role: persona.role,
    initials: persona.initials,
    avatarColor: persona.avatarColor,
    personaId: persona.id
  };
}

export function setActivePersona(id) {
  const persona = getPersona(id);
  const next = toUserShape(persona);
  Object.keys(currentUser).forEach((k) => delete currentUser[k]);
  Object.assign(currentUser, next);
  return persona;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN A - RUN MY DAY
// ─────────────────────────────────────────────────────────────────────────────
//
// Meetings feed the carousel + calendar-popover picker on Run My Day.
// Each row carries the classic broker fields (`title`, `account`,
// `time`, `location`, `prepStatus`) plus a few extras the new layout
// needs: `dateKey` (YYYY-MM-DD, computed relative to today so the
// demo always has "today / tomorrow / day after" content), `desc`
// (one-line teaser), `status` (lowercase state for badge chip), and
// `isCurrent` (visually highlights the meeting currently on the clock).
// The legacy `c-meeting-card` component still reads the original
// fields; the new inline carousel reads all of them.
function _rmdDateKey(offsetDays) {
  const d = today();
  d.setDate(d.getDate() + (offsetDays || 0));
  return (
    d.getFullYear() +
    '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0')
  );
}

export const upcomingMeetings = [
  {
    id: 'm1',
    owner: 'Elena Rostova',
    dateKey: _rmdDateKey(0),
    title: 'Sunrise Insurance Agency Visit',
    account: 'Sunrise Agency',
    accountId: 'a-sunrise',
    time: '10:00 AM',
    type: 'In-Person',
    prepStatus: 'Prep In Progress',
    status: 'prep in progress',
    location: 'Sunrise HQ - 4th St',
    desc: 'On-site walk-through - loss-control review and Q3 book strategy.',
    focus: 'Retain'
  },
  {
    id: 'm2',
    owner: 'Elena Rostova',
    dateKey: _rmdDateKey(0),
    title: 'Quarterly Business Review',
    account: 'Meridian Fleet Logistics',
    accountId: 'a-meridian',
    time: '12:30 PM',
    type: 'Video',
    prepStatus: 'Prep Ready',
    status: 'prep ready',
    location: 'Zoom',
    desc: 'Rebalance commercial auto exposure and preview renewal marketing plan.',
    focus: 'Retain',
    isCurrent: true
  },
  {
    id: 'm3',
    owner: 'Elena Rostova',
    dateKey: _rmdDateKey(0),
    title: 'Renewal Strategy - Acme Mfg',
    account: 'Acme Manufacturing',
    accountId: 'a-acme',
    time: '2:00 PM',
    type: 'Phone',
    prepStatus: 'Prep Ready',
    status: 'prep ready',
    location: 'Call',
    desc: 'Group medical renewal read-through with HR - 50 lives, three tiers.',
    focus: 'Retain'
  },
  {
    id: 'm4',
    owner: 'Elena Rostova',
    dateKey: _rmdDateKey(0),
    title: 'New Carrier Onboarding - Chubb',
    account: 'Chubb',
    accountId: 'a-chubb',
    time: '4:00 PM',
    type: 'Video',
    prepStatus: 'Prep In Progress',
    status: 'prep in progress',
    location: 'Teams',
    desc: 'Appetite alignment on restaurant occupancies and AOP deductibles.',
    focus: 'Grow'
  },
  // Prospect touch on the calendar - surfaces in the "overdue" badge
  // demo so the reviewer sees the state variety without redesigning
  // the layout.
  {
    id: 'm5',
    owner: 'Elena Rostova',
    dateKey: _rmdDateKey(0),
    title: 'Mavericks Household Renewal Prep',
    account: 'Mavericks Household',
    accountId: '001SB00001oXwntYAC',
    time: '8:00 AM',
    type: 'Phone',
    prepStatus: 'Overdue',
    status: 'overdue',
    location: 'Call',
    desc: 'Auto renewal in 42 days - confirm garaging and vehicle list.',
    focus: 'Retain'
  },
  {
    id: 'm6',
    owner: 'Elena Rostova',
    dateKey: _rmdDateKey(1),
    title: 'Bluebird Logistics - Book Review',
    account: 'Bluebird Logistics',
    accountId: 'a-bluebird',
    time: '10:00 AM',
    type: 'Video',
    prepStatus: 'Prep In Progress',
    status: 'prep in progress',
    location: 'Zoom',
    desc: 'Commercial auto loss ratio at 83% - plan mitigation before renewal.',
    focus: 'Retain'
  },
  {
    id: 'm7',
    owner: 'Elena Rostova',
    dateKey: _rmdDateKey(1),
    title: 'Heritage Brokers - Referral Follow-up',
    account: 'Heritage Brokers',
    accountId: 'a-heritage',
    time: '2:00 PM',
    type: 'Phone',
    prepStatus: 'Prep Ready',
    status: 'prep ready',
    location: 'Call',
    desc: 'Introduce Jennifer Adams referral - mid-sized construction manufacturer.',
    focus: 'Grow'
  },
  {
    id: 'm8',
    owner: 'Elena Rostova',
    dateKey: _rmdDateKey(2),
    title: 'Coastal Restaurants - Loss Control Walk',
    account: 'Coastal Restaurants',
    accountId: 'a-coastal',
    time: '9:00 AM',
    type: 'In-Person',
    prepStatus: 'Prep Ready',
    status: 'prep ready',
    location: 'On-site - 3 locations',
    desc: 'Fire prevention walk-through with underwriter and franchisee.',
    focus: 'Service'
  },
  {
    id: 'm9',
    owner: 'Elena Rostova',
    dateKey: _rmdDateKey(2),
    title: 'Anchor & Co. - QBR',
    account: 'Anchor & Co.',
    accountId: 'a-anchor',
    time: '1:00 PM',
    type: 'Video',
    prepStatus: 'Prep In Progress',
    status: 'prep in progress',
    location: 'Teams',
    desc: 'Book has been down 9% YoY - targeted re-engagement conversation.',
    focus: 'Grow'
  }
];

export const actionItems = {
  fullyReady: 0,
  checked: 3,
  completed: 2,
  approved: 4,
  pendingReview: 5,
  needsAttention: 1
};

// Renewal alerts surfaced on Run My Day. The IDs line up with rfqData /
// MOCK_ACCOUNTS so the RFQ workspace can resolve the records on handoff.
export const renewalAlerts = [
  {
    id: 'mavericks-pa-2026',
    owner: 'Elena Rostova',
    type: 'Renewal Alert',
    accountId: '001SB00001oXwntYAC',
    accountName: 'Mavericks Household',
    // Derived from expirationDate against the 09/15 base date - the two
    // had drifted apart and this field is what the hub renders.
    daysToExpiration: 28,
    expirationDate: 'Oct 13, 2026',
    policyType: 'Personal Auto',
    lob: 'pc',
    loc: 'std_auto',
    priorPolicy: '2025 Mavericks Auto - Apex Mutual',
    priorPolicyId: 'POL-MAV-AUTO-2025',
    priorPolicyTerm: 'Oct 13, 2025 - Oct 13, 2026',
    fleetSummary: '2 vehicles · 1 rated driver · $59K insured value',
    premium: '$14,850',
    currentPremium: 14850,
    renewalPremium: 18120,
    premiumIncreasePct: 22,
    hasOpenClaim: true,
    claimType: 'Wind/Hail',
    claimStatus: 'Open',
    claimSummary: 'Open Wind/Hail Claim - filed Apr 2026, under review',
    // Decision-critical "why" moved up from L3 so the broker can act on
    // the card without opening Client 360 first. Rendered as chips.
    riskFlags: ['22% Premium Spike', 'Open Wind/Hail Claim'],
    applicationName: 'Mavericks Household - 2026 Personal Auto Renewal'
  },
  {
    id: 'acme-eb-2026',
    owner: 'Elena Rostova',
    type: 'Renewal Alert',
    accountId: '001EB00002pYzbMAC',
    accountName: 'Acme Manufacturing',
    daysToExpiration: 60,
    expirationDate: 'Sep 20, 2026',
    policyType: 'Group Medical',
    lob: 'eb',
    loc: 'medical',
    priorPolicy: '50-employee group medical · BlueCross PPO',
    priorPolicyId: 'pol-acme-medical-2025',
    fleetSummary: '50 employees · 3 tiers · BlueCross PPO',
    premium: '$612,000',
    currentPremium: 612000,
    renewalPremium: 648000,
    premiumIncreasePct: 6,
    hasOpenClaim: true,
    claimType: 'High-Cost Claimant',
    claimStatus: 'Open',
    claimSummary: 'Open High-Cost Claimant driving loss-ratio pressure',
    riskFlags: ['Open High-Cost Claim'],
    applicationName: 'Acme Manufacturing - 2026 Group Medical Renewal'
  },
  {
    // 38 days out with a 22% renewal jump - the 5th in-window at-risk
    // renewal on Elena's book. Same account as today's QBR meeting
    // (a-meridian) so the hub, meetings, and workspace stay coherent.
    id: 'meridian-comm-auto-2026',
    owner: 'Elena Rostova',
    type: 'Renewal Alert',
    accountId: 'a-meridian',
    accountName: 'Meridian Fleet Logistics',
    daysToExpiration: 38,
    expirationDate: 'Aug 29, 2026',
    policyType: 'Commercial Auto',
    lob: 'pc',
    loc: 'comm_auto',
    priorPolicy: '2025 Meridian Commercial Auto - Apex Mutual',
    priorPolicyId: 'POL-MER-CA-2025',
    fleetSummary: '18 tractors · 26 trailers · 34 named drivers',
    premium: '$92,000',
    currentPremium: 92000,
    renewalPremium: 112000,
    premiumIncreasePct: 22,
    hasOpenClaim: false,
    riskFlags: ['22% Premium Spike'],
    applicationName: 'Meridian Fleet Logistics - 2026 Commercial Auto Renewal'
  },
  {
    // Demo entry point for the benefit-first compare layout. Opens
    // rfq-nova-001 whose quotes carry broker-named tier ids
    // (core_ppo / wide_ppo / preferred_rx).
    id: 'nova-eb-2026',
    owner: 'Elena Rostova',
    type: 'Renewal Alert',
    accountId: '001EB00003rTvXWAM',
    accountName: 'Nova Health Inc.',
    daysToExpiration: 90,
    expirationDate: 'Oct 20, 2026',
    policyType: 'Group Medical',
    lob: 'eb',
    loc: 'medical',
    priorPolicy: '30-employee group medical · BlueCross Core',
    priorPolicyId: 'pol-nova-medical-2025',
    fleetSummary: '30 employees · Core / Wide PPO · Preferred Rx',
    premium: '$384,000',
    currentPremium: 384000,
    renewalPremium: 402000,
    premiumIncreasePct: 5,
    hasOpenClaim: false,
    applicationName: 'Nova Health Inc. - 2026 Group Medical Renewal',
    applicationId: 'rfq-nova-001'
  },
  {
    // 18 days out with a >15% renewal jump - trips the Remarket
    // action path.
    id: 'sunrise-bop-2026',
    owner: 'Elena Rostova',
    type: 'Renewal Alert',
    accountId: 'a-sunrise',
    accountName: 'Sunrise Agency',
    daysToExpiration: 18,
    expirationDate: 'Aug 9, 2026',
    policyType: 'BOP',
    lob: 'pc',
    loc: 'bop',
    priorPolicy: '2025 Sunrise BOP - Apex Mutual',
    priorPolicyId: 'POL-SUN-BOP-2025',
    fleetSummary: 'Multi-location BOP · $2M GL / $1M property',
    premium: '$14,800',
    currentPremium: 14800,
    renewalPremium: 18060,
    premiumIncreasePct: 22,
    hasOpenClaim: false,
    riskFlags: ['22% Premium Spike'],
    applicationName: 'Sunrise Agency - 2026 BOP Renewal'
  },
  {
    // 25 days out with an open claim - trips the Contact Client
    // action path even though the premium delta is modest.
    id: 'bluebird-comm-auto-2026',
    owner: 'Elena Rostova',
    type: 'Renewal Alert',
    accountId: 'a-bluebird',
    accountName: 'Bluebird Logistics',
    daysToExpiration: 25,
    expirationDate: 'Aug 16, 2026',
    policyType: 'Commercial Auto',
    lob: 'pc',
    loc: 'comm_auto',
    priorPolicy: '2025 Bluebird Commercial Auto - Progressive',
    priorPolicyId: 'POL-BLU-CA-2025',
    fleetSummary: '14 tractors · 22 trailers · 30 named drivers',
    premium: '$78,400',
    currentPremium: 78400,
    renewalPremium: 84900,
    premiumIncreasePct: 8,
    hasOpenClaim: true,
    claimType: 'Liability',
    claimStatus: 'Open',
    claimSummary: 'Open Liability Claim - at-fault collision, Q1 2026',
    riskFlags: ['Open Liability Claim'],
    applicationName: 'Bluebird Logistics - 2026 Commercial Auto Renewal'
  },
  {
    // Overdue: 12 days past expiration. Shows in the Overdue list.
    id: 'coastal-wc-2026',
    owner: 'Elena Rostova',
    type: 'Renewal Alert',
    accountId: 'a-coastal',
    accountName: 'Coastal Restaurants Group',
    daysToExpiration: -12,
    expirationDate: 'Jul 11, 2026',
    policyType: "Workers' Comp",
    lob: 'pc',
    loc: 'workers_comp',
    priorPolicy: "2025 Coastal Workers' Comp - Travelers",
    priorPolicyId: 'POL-COA-WC-2025',
    fleetSummary: '4 restaurants · 88 W-2 employees',
    premium: '$46,200',
    currentPremium: 46200,
    renewalPremium: 47100,
    premiumIncreasePct: 2,
    hasOpenClaim: false,
    applicationName: "Coastal Restaurants Group - 2026 Workers' Comp Renewal"
  },
  {
    // Same household as the auto renewal, 33 days behind it. The
    // umbrella is the line the household coverage review is really
    // about: still at the $1M limit it was written at, now sitting
    // over two newly added drivers.
    id: 'mavericks-umbrella-2025',
    owner: 'Elena Rostova',
    type: 'Renewal Alert',
    accountId: '001SB00001oXwntYAC',
    accountName: 'Mavericks Household',
    daysToExpiration: 75,
    expirationDate: 'Nov 15, 2026',
    policyType: 'Personal Umbrella',
    lob: 'pc',
    loc: 'umbrella',
    priorPolicy: '2025 Mavericks Umbrella - Northgate Mutual',
    priorPolicyId: 'POL-MAV-UMB-2025',
    priorPolicyTerm: 'Nov 15, 2025 - Nov 15, 2026',
    fleetSummary: '$1M personal umbrella liability',
    premium: '$640',
    currentPremium: 640,
    renewalPremium: 660,
    premiumIncreasePct: 3,
    hasOpenClaim: false,
    applicationName: 'Mavericks Household - 2026 Umbrella Renewal'
  }
];

// Hardcoded KPI headline values for the Producer pipeline strip.
// Extracted out of the component so a demo curator can tweak the
// numbers without touching the LWC.
export const producerPipelineKpis = {
  renewals30: 12,
  renewals3160: 24,
  pipelinePremium: 450000,
  pipelineCommission: 67500
};

// Static LOB breakdown for the "Renewals by Line of Business" donut.
// Not derived from `renewalAlerts` because the donut represents the
// broader 120-day pipeline, not just the 7 at-risk rows we show in
// the table.
export const renewalsByLob = [
  { id: 'pa',  label: 'Personal Auto',   count: 4, color: '#066afe' },
  { id: 'gm',  label: 'Group Medical',   count: 3, color: '#7c3aed' },
  { id: 'bop', label: 'BOP',             count: 2, color: '#0b827c' },
  { id: 'wc',  label: "Workers' Comp",   count: 2, color: '#dd7a01' },
  { id: 'ca',  label: 'Commercial Auto', count: 1, color: '#b60554' }
];

export const actionCategories = [
  { id: 'retain', label: 'Retain', count: 6, icon: '◐' },
  { id: 'grow', label: 'Grow', count: 4, icon: '↑' },
  { id: 'service', label: 'Service & C', count: 9, icon: '◇' },
  { id: 'ai', label: 'AI-Powered', count: 3, icon: '✨' }
];

export const atRiskAgencies = {
  productionDropOff: {
    id: 'production-dropoff',
    title: 'Production Drop-Off',
    summary: '3 agencies down YoY across Property & Auto books.',
    severity: 'high',
    rows: [
      {
        agency: 'Sunrise Agency',
        bookSize: '$2.4M',
        yoyChange: '-22%',
        topLines: 'Auto, BOP',
        lastTouch: '38d ago'
      },
      {
        agency: 'Heritage Brokers',
        bookSize: '$1.1M',
        yoyChange: '-14%',
        topLines: 'Property',
        lastTouch: '21d ago'
      },
      {
        agency: 'Anchor & Co.',
        bookSize: '$760K',
        yoyChange: '-9%',
        topLines: 'WC, GL',
        lastTouch: '54d ago'
      }
    ]
  },
  lossRatioSpikes: {
    id: 'loss-ratio-spikes',
    title: 'Loss Ratio Spikes',
    summary: '2 accounts crossed 75% loss ratio in the last quarter.',
    severity: 'medium',
    rows: [
      {
        agency: 'Coastal Restaurants',
        bookSize: '$880K',
        yoyChange: '78% LR',
        topLines: 'Property',
        lastTouch: '12d ago'
      },
      {
        agency: 'Bluebird Logistics',
        bookSize: '$1.6M',
        yoyChange: '83% LR',
        topLines: 'Commercial Auto',
        lastTouch: '8d ago'
      }
    ]
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN A · RUN MY DAY - ACTION ITEMS CATALOG
//
// This drives the new Action Items rework (metrics split → category
// tabstrip → 3-column body). Each category owns a set of "cards", each
// card owns a set of "rows" (the nested items that render as tiles in
// the right-hand column). Cards can carry an `alert` flag which lights
// up the vertical-nav indicator dot.
//
// The insurance vertical taxonomy:
//   • Retain  - attrition risk, contact-cadence gap, renewals in window
//   • Grow    - coverage gaps to close, aging referral follow-up
//   • Service - aging claims / service cases, endorsement backlog
//   • Comply  - COI expirations, agency E&O and license renewals
//
// Every row sits on one of the two accounts the running user owns, so the
// row actions resolve: `openAccount` and `viewCase` land on a record page
// that exists, and `startRenewal` opens an RFQ against a real account. The
// one exception is the agency's own E&O renewal, which is Elena's agency
// rather than a client and so carries the `agency-self` id.
//
// No category sets `badgeCount`. The badges and the greeting's alert total
// are summed from the rows below, so the number in the banner always equals
// what the groups actually contain.
// ─────────────────────────────────────────────────────────────────────────────
export const runMyDayCategories = [
  {
    id: 'retain',
    label: 'Retain',
    icon: 'users',
    cards: [
      {
        id: 'attrition-risk',
        title: 'Accounts at Attrition Risk',
        summary:
          'Accounts on your book with elevated churn signals - proactive outreach recommended.',
        alertLong:
          'These accounts are flagged as at-risk based on premium trend, claims activity, and time since last touch. Review the items below and take proactive outreach to address needs and protect the renewal.',
        updated: 'Today at 6:00 AM',
        rows: [
          {
            id: 'attr-mavericks',
            name: 'Mavericks Household',
            accountId: '001SB00001oXwntYAC',
            detail:
              '$19.6K annual premium · Auto renewal up 22% · Open Wind/Hail claim · Last contact 38 days ago',
            actions: [
              { label: 'Draft call talking points', kind: 'default', action: 'draftCall' },
              { label: 'Draft email', kind: 'default', action: 'draftEmail' },
              { label: 'Schedule meeting', kind: 'primary', action: 'scheduleMeeting' },
              { label: 'Dismiss', kind: 'dismiss', action: 'dismiss' }
            ]
          },
          {
            id: 'attr-acme',
            name: 'Acme Manufacturing',
            accountId: '001EB00002pYzbMAC',
            detail:
              '$612K group medical · BlueCross asking 12% against experience supporting 4-6% · Open high-cost claimant',
            actions: [
              { label: 'Draft call talking points', kind: 'default', action: 'draftCall' },
              { label: 'Draft email', kind: 'default', action: 'draftEmail' },
              { label: 'Schedule meeting', kind: 'primary', action: 'scheduleMeeting' },
              { label: 'Dismiss', kind: 'dismiss', action: 'dismiss' }
            ]
          }
        ]
      },
      {
        id: 'upcoming-renewals',
        title: 'Renewals in the Next 45 Days',
        summary:
          'Policies on your book that expire inside 45 days, with the rate pressure and open issues that should shape the outreach.',
        alertLong:
          'Four policies on your book expire inside 45 days. Mavericks Auto is indicated 22% up with an open Wind/Hail claim, Acme medical is carrying a 12% BlueCross ask against 4-6% experience, Whitfield homeowners is 38 days out on a $2.5M coastal dwelling, and Bluebird inland marine still has an unendorsed schedule.',
        updated: 'Today at 6:00 AM',
        rows: [
          {
            id: 'renew-mavericks-auto',
            name: 'Mavericks Household - Personal Auto',
            accountId: '001SB00001oXwntYAC',
            detail:
              '28 days to expiration · $14,850 expiring · Auto renewal up 22% · 2 vehicles · Open Wind/Hail claim',
            actions: [
              { label: 'Start renewal RFQ', kind: 'primary', action: 'startRenewal' },
              { label: 'Draft email', kind: 'default', action: 'draftEmail' },
              { label: 'Dismiss', kind: 'dismiss', action: 'dismiss' }
            ]
          },
          {
            id: 'renew-acme-medical',
            name: 'Acme Manufacturing - Group Medical',
            accountId: '001EB00002pYzbMAC',
            detail:
              '33 days to expiration · $612K group medical · BlueCross asking 12% against experience supporting 4-6% · 50 employees, 3 tiers · Open high-cost claimant',
            actions: [
              { label: 'Start renewal RFQ', kind: 'primary', action: 'startRenewal' },
              { label: 'Draft email', kind: 'default', action: 'draftEmail' },
              { label: 'Dismiss', kind: 'dismiss', action: 'dismiss' }
            ]
          },
          {
            id: 'renew-whitfield-home',
            name: 'Whitfield Household - Homeowners',
            accountId: 'a-whitfield',
            detail:
              '38 days to expiration · $6,660 expiring · $2.5M dwelling on Siesta Key · Wind deductible still at 2% · Last contact 54 days ago',
            actions: [
              { label: 'Start renewal RFQ', kind: 'primary', action: 'startRenewal' },
              { label: 'Draft email', kind: 'default', action: 'draftEmail' },
              { label: 'Dismiss', kind: 'dismiss', action: 'dismiss' }
            ]
          },
          {
            id: 'renew-bluebird-marine',
            name: 'Bluebird Logistics - Inland Marine',
            accountId: 'a-bluebird',
            detail:
              '44 days to expiration · $28K inland marine · 15 scheduled items · 3 units added mid-term without endorsement · Schedule last refreshed 18 months ago',
            actions: [
              { label: 'Start renewal RFQ', kind: 'primary', action: 'startRenewal' },
              { label: 'Draft email', kind: 'default', action: 'draftEmail' },
              { label: 'Dismiss', kind: 'dismiss', action: 'dismiss' }
            ]
          }
        ]
      },
      {
        id: 'contact-gap',
        title: 'Contact Cadence Gap',
        summary: 'Accounts that have fallen outside their expected contact cadence.',
        alertLong:
          'These accounts have fallen outside the expected contact cadence for their tier. Reach out to re-engage before the renewal window opens.',
        updated: 'Today at 6:00 AM',
        rows: [
          {
            id: 'gap-mavericks',
            name: 'Mavericks Household',
            accountId: '001SB00001oXwntYAC',
            detail: '38 days since last touch · Expected cadence is 30 days',
            actions: [
              { label: 'Draft call talking points', kind: 'default', action: 'draftCall' },
              { label: 'Schedule meeting', kind: 'primary', action: 'scheduleMeeting' },
              { label: 'Dismiss', kind: 'dismiss', action: 'dismiss' }
            ]
          }
        ]
      },
      {
        id: 'client-milestones',
        title: 'Client Milestones This Week',
        summary: 'Milestones on your accounts within the next 14 days.',
        alertLong:
          'Reach out on these milestones - a well-timed touch strengthens the relationship and reduces attrition risk.',
        updated: 'Today at 6:00 AM',
        rows: [
          {
            id: 'ms-mavericks-anniversary',
            name: 'Mavericks Household',
            accountId: '001SB00001oXwntYAC',
            detail: 'Ninth year as a client in 5 days · $19.6K across 3 policies',
            actions: [
              { label: 'Draft congrats email', kind: 'default', action: 'draftEmail' },
              { label: 'Dismiss', kind: 'dismiss', action: 'dismiss' }
            ]
          },
          {
            id: 'ms-acme-anniversary',
            name: 'Acme Manufacturing',
            accountId: '001EB00002pYzbMAC',
            detail: 'Business anniversary in 11 days · Cincinnati plant opened 1998',
            actions: [
              { label: 'Draft congrats email', kind: 'default', action: 'draftEmail' },
              { label: 'Dismiss', kind: 'dismiss', action: 'dismiss' }
            ]
          }
        ]
      },
      // Figma-parity card (Retention Alert Details) - drives the deep-drill
      // view: SLA-exceeded warning chip + chevron caret rows + "View More"
      // footer. Kept at the tail of Retain so the default selection is still
      // "Accounts at Attrition Risk".
      {
        id: 'retention-alert-details',
        title: 'Retention Alert Details',
        summary:
          'Open retention signals on your accounts, ranked by how close they sit to the renewal date.',
        alertLong:
          'Both accounts on your book carry an unresolved retention signal inside the renewal window. The Mavericks Wind/Hail claim is past its action SLA and sits inside the auto rating period; the Acme census corrections are blocking the BlueCross re-rate.',
        updated: 'Today at 6:00 AM',
        rows: [
          {
            id: 'rad-mavericks-claim',
            name: 'Mavericks Household',
            accountId: '001SB00001oXwntYAC',
            escalation: 'SLA Exceeded',
            detail:
              'Open Wind/Hail claim from April is unresolved 6 days past the action SLA, and it is inside the auto rating period 42 days from renewal.',
            actions: [
              { label: 'Open client record', kind: 'primary', action: 'openAccount' },
              { label: 'Draft outreach email', kind: 'default', action: 'draftEmail' },
              { label: 'Dismiss', kind: 'dismiss', action: 'dismiss' }
            ]
          },
          {
            id: 'rad-acme-census',
            name: 'Acme Manufacturing',
            accountId: '001EB00002pYzbMAC',
            detail:
              'Two census rows are missing date of birth, which blocks the BlueCross re-rate and holds the whole three-way comparison.',
            actions: [
              { label: 'Open client record', kind: 'primary', action: 'openAccount' },
              { label: 'Draft outreach email', kind: 'default', action: 'draftEmail' },
              { label: 'Dismiss', kind: 'dismiss', action: 'dismiss' }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'grow',
    label: 'Grow',
    icon: 'growth',
    cards: [
      {
        id: 'coverage-gaps',
        title: 'Coverage Gaps to Close',
        summary: 'Uncovered exposure on your accounts that can be written this quarter.',
        alertLong:
          'These are identified gaps between what your accounts are exposed to and what they currently carry. Each one is a growth opportunity that also reduces a future claim dispute.',
        updated: 'Today at 6:00 AM',
        hasAlert: true,
        rows: [
          {
            id: 'gap-mavericks-umbrella',
            name: 'Mavericks Household - Umbrella Limit',
            accountId: '001SB00001oXwntYAC',
            badges: [{ label: 'Attention Needed', kind: 'attention' }],
            detail:
              'Two drivers were added mid-term, but the umbrella has stayed at $1M since inception. Household liability exposure now exceeds the limit.',
            actions: [
              { label: 'Draft outreach email', kind: 'default', action: 'draftEmail' },
              { label: 'Schedule meeting', kind: 'primary', action: 'scheduleMeeting' },
              { label: 'Dismiss', kind: 'dismiss', action: 'dismiss' }
            ]
          },
          {
            id: 'gap-mavericks-schedule',
            name: 'Mavericks Household - Scheduled Property',
            accountId: '001SB00001oXwntYAC',
            badges: [{ label: 'Attention Needed', kind: 'attention' }],
            detail:
              'Scheduled personal property has not been refreshed in three years. Items have been added without appraisal and two on the schedule were sold.',
            actions: [
              { label: 'Draft outreach email', kind: 'default', action: 'draftEmail' },
              { label: 'Schedule meeting', kind: 'primary', action: 'scheduleMeeting' },
              { label: 'Dismiss', kind: 'dismiss', action: 'dismiss' }
            ]
          },
          {
            id: 'gap-acme-ancillary',
            name: 'Acme Manufacturing - Dental & Vision',
            accountId: '001EB00002pYzbMAC',
            badges: [{ label: 'Attention Needed', kind: 'attention' }],
            detail:
              'Acme carries medical and Life/AD&D but no dental or vision. Quoting ancillary alongside the 1/1 medical renewal is the lowest-friction window all year.',
            actions: [
              { label: 'Draft outreach email', kind: 'default', action: 'draftEmail' },
              { label: 'Schedule meeting', kind: 'primary', action: 'scheduleMeeting' },
              { label: 'Dismiss', kind: 'dismiss', action: 'dismiss' }
            ]
          }
        ]
      },
      {
        id: 'aging-referrals',
        title: 'Aging Referral Follow-Up',
        summary:
          'Referrals from your accounts that have not been contacted within the follow-up SLA.',
        alertLong:
          'These referrals came from your own accounts and have gone unactioned past the follow-up SLA. Make contact now before the prospect cools or is claimed elsewhere.',
        updated: 'Today at 6:00 AM',
        hasAlert: true,
        rows: [
          {
            id: 'ref-mavericks',
            name: 'Referral from Mavericks Household',
            accountId: '001SB00001oXwntYAC',
            badges: [{ label: 'Attention Needed', kind: 'attention' }],
            detail:
              'James Mavericks referred a neighbour for a homeowners and auto bundle 7 days ago. Unactioned, past the follow-up SLA.',
            actions: [
              { label: 'Draft intro email', kind: 'default', action: 'draftEmail' },
              { label: 'Draft call talking points', kind: 'default', action: 'draftCall' },
              { label: 'Schedule meeting', kind: 'primary', action: 'scheduleMeeting' },
              { label: 'Dismiss', kind: 'dismiss', action: 'dismiss' }
            ]
          },
          {
            id: 'ref-acme',
            name: 'Referral from Acme Manufacturing',
            accountId: '001EB00002pYzbMAC',
            badges: [{ label: 'Attention Needed', kind: 'attention' }],
            detail:
              'Acme HR referred a supplier in the same industrial park for a workers compensation review 18 days ago. Still unactioned.',
            actions: [
              { label: 'Draft intro email', kind: 'default', action: 'draftEmail' },
              { label: 'Draft call talking points', kind: 'default', action: 'draftCall' },
              { label: 'Schedule meeting', kind: 'primary', action: 'scheduleMeeting' },
              { label: 'Dismiss', kind: 'dismiss', action: 'dismiss' }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'service',
    label: 'Service',
    icon: 'chat',
    cards: [
      {
        id: 'aging-cases',
        title: 'Aging Service Cases',
        summary: 'Open service cases beyond firm SLA.',
        alertLong:
          'These open service cases have exceeded the firm SLA. Take immediate action to resolve and communicate status to the client.',
        updated: 'Today at 6:00 AM',
        hasAlert: true,
        rows: [
          {
            id: 'case-mavericks-claim',
            name: 'Mavericks Household - Wind/Hail Claim',
            accountId: '001SB00001oXwntYAC',
            detail: 'Open 6 days past SLA · Awaiting adjuster reserve figure',
            escalation: '⚠ SLA Exceeded',
            actions: [
              { label: 'View case', kind: 'primary', action: 'viewCase' },
              { label: 'Draft status email', kind: 'default', action: 'draftEmail' }
            ]
          }
        ]
      },
      {
        id: 'endorsement-backlog',
        title: 'Endorsement Backlog',
        summary: 'Endorsement requests awaiting carrier confirmation.',
        alertLong:
          'These endorsement requests are pending carrier confirmation. Nudge the carrier or the client where you have the ball.',
        updated: 'Today at 6:00 AM',
        rows: [
          {
            id: 'endo-mavericks-drivers',
            name: 'Mavericks Household - Driver Add',
            accountId: '001SB00001oXwntYAC',
            detail:
              'Joseph Mavericks added as a named driver · Waiting on carrier re-rate · 4 days aged',
            actions: [
              { label: 'Nudge carrier', kind: 'primary', action: 'draftEmail' },
              { label: 'View case', kind: 'default', action: 'viewCase' }
            ]
          },
          {
            id: 'endo-acme-census',
            name: 'Acme Manufacturing - Census Correction',
            accountId: '001EB00002pYzbMAC',
            detail:
              '2 of 50 rows missing date of birth · Waiting on client HR · 3 days aged',
            actions: [
              { label: 'Nudge client', kind: 'primary', action: 'draftEmail' },
              { label: 'View case', kind: 'default', action: 'viewCase' }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'comply',
    label: 'Comply',
    icon: 'shield',
    cards: [
      {
        id: 'coi-expiring',
        title: 'Client COI Expiring',
        summary: 'Certificates of insurance expiring within 30 days.',
        alertLong:
          'These certificates of insurance expire within the next 30 days. Regenerate and re-send to keep clients in compliance.',
        updated: 'Today at 6:00 AM',
        hasAlert: true,
        rows: [
          {
            id: 'coi-acme-gl',
            name: 'Acme Manufacturing - GL COI',
            accountId: '001EB00002pYzbMAC',
            detail:
              'COI expires in 8 days · Required by two plant customers · 14-day action SLA already passed',
            escalation: '⚠ SLA Exceeded',
            actions: [
              { label: 'Generate new COI', kind: 'primary', action: 'draftEmail' },
              { label: 'Open client record', kind: 'default', action: 'openAccount' }
            ]
          }
        ]
      },
      {
        id: 'agency-comply',
        title: 'Agency Compliance Renewals',
        summary: 'E&O policy and producer license renewals coming due.',
        alertLong:
          'Your agency has E&O and producer licensing tasks coming due. Complete these to keep the book compliant with state regulators.',
        updated: 'Today at 6:00 AM',
        rows: [
          {
            id: 'agy-eo',
            name: 'Agency E&O Policy Renewal',
            accountId: 'agency-self',
            badges: [{ label: 'Agency', kind: 'hni' }],
            detail: 'Renews in 21 days · Current carrier: Hiscox',
            actions: [
              { label: 'Start renewal RFQ', kind: 'primary', action: 'startRenewal' },
              { label: 'View policy', kind: 'default', action: 'openAccount' }
            ]
          }
        ]
      }
    ]
  }
];

// Live category counts (derived so the tab pills and vertical-nav
// badges never drift from the underlying card catalog).
export function getRunMyDayCategoryCounts() {
  const counts = {};
  let total = 0;
  runMyDayCategories.forEach((cat) => {
    const rowSum = cat.cards.reduce(
      (sum, c) => sum + (c.itemCount ?? (c.rows?.length || 0)),
      0
    );
    const n = cat.badgeCount != null ? cat.badgeCount : rowSum;
    counts[cat.id] = n;
    total += n;
  });
  counts.all = total;
  return counts;
}

// Advisor Home greeting (runtime_industries_runmyday:greetingBanner).
// The greeting no longer carries its own name or alert count. Both are
// derived at render time - the name from the active persona, the count from
// the sum of the mounted group badges - so the banner cannot contradict the
// avatar beside it or the badges beneath it.

// Advisor Home meeting carousel (runtime_industries_meetingengagement:
// meetingCarousel). The org carousel is not driven by Events - it lists
// MeetingPlaybook records whose Event falls on the selected day, so a
// bare calendar entry never surfaces. Each card exposes the playbook
// name, its status, the event's time range, and three record links:
// organizer, related record, event. `upcomingMeetings` above keeps the
// richer broker fields the Meeting Center screens need; this catalog is
// only what the carousel renders.
// Every meeting sits on one of the two accounts Elena owns, so each card's
// Related Record link and the Meeting Playbook breadcrumb both land on a
// record page that actually exists in this app.
// Today's carousel deliberately spreads across three different clients
// rather than stacking two meetings on one household: a personal-lines
// household, a commercial SMB, and the group-benefits account. The
// Mavericks playbooks below are still wired in meetingPrepById, so
// putting either card back is a one-entry change here.
export const runMyDayMeetings = [
  {
    id: 'mp-whitfield-auto-renewal',
    name: 'Personal Auto Renewal Review - Whitfield Household',
    status: 'In Prep',
    dateKey: _rmdDateKey(0),
    startTime: '10:00 AM',
    endTime: '11:00 AM',
    organizer: 'Elena Rostova',
    relatedRecord: 'Whitfield Household',
    accountId: 'a-whitfield',
    eventSubject: 'Whitfield Household - 2026 Personal Auto Renewal'
  },
  {
    id: 'mp-bluebird-fleet',
    name: 'Fleet & Workers Comp Renewal - Bluebird Logistics',
    status: 'Prep Complete',
    dateKey: _rmdDateKey(0),
    startTime: '12:30 PM',
    endTime: '1:30 PM',
    organizer: 'Elena Rostova',
    relatedRecord: 'Bluebird Logistics',
    accountId: 'a-bluebird',
    eventSubject: 'Bluebird Logistics - 2026 Fleet & WC Renewal'
  },
  {
    id: 'mp-acme-renewal',
    name: 'Group Medical Renewal Strategy - Acme Manufacturing',
    status: 'In Session',
    dateKey: _rmdDateKey(0),
    startTime: '2:00 PM',
    endTime: '3:00 PM',
    organizer: 'Elena Rostova',
    relatedRecord: 'Acme Manufacturing',
    accountId: '001EB00002pYzbMAC',
    eventSubject: 'Acme Manufacturing - 1/1 Group Medical Renewal'
  }
];

// Persona-scoped metrics for the Action Items header. Producers see
// their own task queue; Principals see the entire agency roll-up.
// (In a production org this would be a report subscription filtered by
// the running user's role hierarchy.)
export const runMyDayMetricsByPersona = {
  producer: {
    total: 9,
    carried: 3,
    completed: 2,
    pending: 4,
    overdue: 1,
    dueToday: 5,
    slaAtRisk: 1,
    agents: 3,
    agentTasksCompleted: 15
  },
  principal: {
    total: 42,
    carried: 11,
    completed: 8,
    pending: 18,
    overdue: 5,
    dueToday: 19,
    slaAtRisk: 4,
    agents: 5,
    agentTasksCompleted: 71
  },
  finance: {
    total: 14,
    carried: 4,
    completed: 3,
    pending: 6,
    overdue: 2,
    dueToday: 5,
    slaAtRisk: 2,
    agents: 3,
    agentTasksCompleted: 21
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN A · RUN MY DAY - AGENT OBSERVABILITY
//
// The "Agent Observability" node in the vertical nav opens a mini
// analytics view instead of a card list. The `agents` array populates
// the middle column as selectable cards; picking one (or the entry
// itself) reveals the sub-tab body (Analytics / Optimization / Health).
// The chart data is intentionally simple so the LWC template can render
// inline SVG without a chart library.
// ─────────────────────────────────────────────────────────────────────────────
export const runMyDayAgents = [
  {
    id: 'agent-renewals',
    name: 'Renewal Prep Agent',
    summary: 'Assembles renewal marketing packets and drafts client narrative from prior policy.'
  },
  {
    id: 'agent-service',
    name: 'Client Service Agent',
    summary: 'Triages inbound cases, routes to the correct AM, and drafts status updates.'
  },
  {
    id: 'agent-comply',
    name: 'Compliance Agent',
    summary: 'Monitors COI, E&O and licensing horizons - creates tasks before SLA is at risk.'
  }
];

export const runMyDayAgentAnalytics = {
  conversationVolume: [
    { id: 'agent-renewals', label: 'Renewal Prep', value: 1247 },
    { id: 'agent-service', label: 'Client Service', value: 2891 },
    { id: 'agent-comply', label: 'Compliance', value: 892 }
  ],
  resolutionRates: [
    { id: 'agent-renewals', label: 'Renewal Prep', pct: 90 },
    { id: 'agent-service', label: 'Client Service', pct: 80 },
    { id: 'agent-comply', label: 'Compliance', pct: 95 }
  ],
  optimization: [
    {
      id: 'opt-prompts',
      title: 'Prompt tuning suggestions',
      detail: 'Recommended prompt improvements based on the last 30 days of conversations.'
    },
    {
      id: 'opt-flow',
      title: 'Flow optimization',
      detail: 'Suggested flow changes to reduce human handoffs and improve first-touch resolution.'
    }
  ],
  health: [
    {
      id: 'hlth-status',
      title: 'Agent status',
      detail: 'Real-time availability and uptime for each deployed agent.'
    },
    {
      id: 'hlth-latency',
      title: 'Latency metrics',
      detail: 'Average and P95 response time by agent - trailing 24 hours.'
    }
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN B - MEETING CENTER
// ─────────────────────────────────────────────────────────────────────────────
// ── Meeting prep payloads, one per playbook ──────────────────────────
// The Meeting Playbook page reads whichever payload matches the meeting the
// broker clicked, so the prep brief, discussion guide, and follow-up recap
// always describe the account named in the breadcrumb. Every figure here is
// the same one `renewalAlerts` and the RFQ workspaces use for that policy,
// so opening the renewal from the playbook shows matching numbers.

// Client Summary bullets carry inline citation markers the way the org's
// generated summary does, so a bullet is a label plus an ordered run of
// segments rather than one string. A segment's second element is the
// source number it cites; omit it for plain prose. The label separator
// is baked into the first segment because template whitespace either
// side of a `for:each` is collapsed away before it reaches the DOM.
function _bullet(id, label, segments) {
  return {
    id,
    label,
    parts: segments.map(([text, sup], i) => ({
      id: `${id}-p${i}`,
      text: i === 0 ? ` - ${text}` : text,
      sup: sup || null
    }))
  };
}

const _mavericksAutoPrep = {
  meetingId: 'mp-mavericks-auto-renewal',
  agency: 'Mavericks Household',
  draftCreatedAt: '2026-05-26T08:14:00Z',
  draft: {
    intro:
      "This 10:00 AM call with James Mavericks is the renewal conversation on the household's 2025 Personal Auto, which expires October 13. Apex Mutual has come back 22% up, and a driver was added mid-term - James's father Joseph, 74, who now drives the Camry - so the increase needs explaining before it needs defending.",
    bookAtAGlance: [
      '$14,850 expiring premium, $18,120 on the Apex Mutual renewal indication - a 22% increase.',
      'Two vehicles on the policy, $59K of insured value, led by a 2024 Honda CR-V EX-L at $36.5K.',
      'The at-fault collision closed at $17,250 in November, the only paid loss this term.',
      'Open Wind/Hail claim filed April 2026 is still under review and sits inside the rating period.',
      'Multi-line household - $19.6K of annual premium across auto, homeowners, and umbrella.'
    ],
    whyItMatters:
      'A 22% jump on a multi-line household is a churn signal, not just a rating event. Three things drive it: a 74-year-old newly rated on the schedule, the at-fault collision that closed at $17,250 in November, and the open Wind/Hail claim Apex has not reserved yet. Most of that is explainable and some of it is negotiable. Shopping the market before the call gives James a comparison rather than an ultimatum, and protects the homeowners and umbrella lines that renew behind this one.',
    openerCopy:
      'Open on the new driver rather than the premium - it frames the increase as a life-stage change the household already knows about. Bring the market comparison out second, and only discuss the open claim once the alternatives are on the table.'
  },
  sources: [
    { id: 'src-mav-prior',  label: '2025 Mavericks Auto - Apex Mutual policy',  type: 'Prior policy',        href: '#' },
    { id: 'src-mav-claim',  label: 'Wind/Hail claim file (filed Apr 2026)',     type: 'Claim record',        href: '#' },
    { id: 'src-mav-claim2', label: 'Collision claim file (closed Nov 2025)',    type: 'Claim record',        href: '#' },
    { id: 'src-mav-mvr',    label: 'MVR pull - Joseph Mavericks',               type: 'Driver record',       href: '#' },
    { id: 'src-mav-book',   label: 'Mavericks Household book snapshot',         type: 'Revenue Intelligence', href: '#' }
  ],
  summary: {
    metrics: [
      { id: 'mm-1', label: 'Renewal Change', value: '+22%', delta: 'vs expiring', dir: 'up' },
      { id: 'mm-2', label: 'Household Premium', value: '$19.6K', delta: '3 policies' },
      { id: 'mm-3', label: 'Days to Expiry', value: '42', delta: 'Oct 13, 2026' }
    ],
    keyConcerns: [
      'Renewal is up 22% ($14,850 to $18,120) on a three-policy household.',
      'Open Wind/Hail claim from April 2026 is still unresolved and affects the rating.',
      'The at-fault collision closed at $17,250 in November, inside the current term.',
      'Joseph (74) was added mid-term - the household has not seen the rating impact yet.',
      'Last contact was 38 days ago, outside our 30-day cadence for this tier.'
    ],
    talkingPoints: [
      'Lead with the new driver so the increase reads as expected, not arbitrary.',
      'Present the market comparison before discussing the open claim.',
      'Confirm which vehicles Joseph should be rated on - keeping him off the CR-V is the single biggest lever.',
      'Flag that homeowners and umbrella renew next - offer to review all three together.'
    ]
  },
  agentforceActions: [
    {
      id: 'aa1',
      label: 'Shop the renewal across the market',
      detail: 'Builds an RFQ from the expiring policy and the two added drivers.',
      checked: true
    },
    {
      id: 'aa2',
      label: 'Summarise the open Wind/Hail claim',
      detail: 'Pulls the adjuster notes and current reserve into a one-paragraph brief.',
      checked: false
    },
    {
      id: 'aa3',
      label: 'Model the premium without the new drivers',
      detail: 'Isolates how much of the 22% is the added drivers and how much is loss experience.',
      checked: false
    }
  ],
  prepTasks: [
    {
      id: 't1',
      task: 'Pull MVRs for both added drivers',
      owner: 'Elena Rostova',
      role: 'Account Manager',
      status: 'Completed'
    },
    {
      id: 't2',
      task: 'Request claim status update from adjuster',
      owner: 'James Field',
      role: 'Producer',
      status: 'In Progress'
    },
    {
      id: 't3',
      task: 'Build market comparison for the renewal',
      owner: 'Agentforce',
      role: 'AI Assistant',
      status: 'Ready for Review'
    },
    {
      id: 't4',
      task: 'Confirm garaging address for the Camry',
      owner: 'Mavericks Household',
      role: 'Customer',
      status: 'Pending'
    },
    {
      id: 't5',
      task: 'Re-underwrite with both drivers rated',
      owner: 'Underwriting',
      role: 'Carrier',
      status: 'Blocked'
    }
  ],
  documents: [
    {
      id: 'mdoc-1',
      name: '2025 Mavericks Auto - Apex Mutual.pdf',
      kind: 'PDF',
      meta: '1.2 MB · Added Jul 18 by Elena Rostova'
    },
    {
      id: 'mdoc-2',
      name: 'Wind-Hail claim file - Apr 2026.pdf',
      kind: 'PDF',
      meta: '640 KB · Added Jul 20 by Elena Rostova'
    },
    {
      id: 'mdoc-3',
      name: 'Mavericks renewal comparison.xlsx',
      kind: 'XLS',
      meta: '310 KB · Added Jul 22 by Agentforce'
    }
  ],
  preMeeting: {
    updatedAt: 'Last updated at 8:14 AM by Agentforce.',
    lead: 'James Mavericks, 52, $19.6K household premium, 3 policies in force',
    bullets: [
      _bullet('mav-auto-sb1', 'Coverage', [
        ['Three policies in force: 2025 Personal Auto', '1'],
        [' ($14,850 expiring, renews October 13), with Homeowners', '2'],
        [' and Personal Umbrella', '3'],
        [
          ' renewing inside the same window. Two vehicles rated across $59K of insured value, led by a 2024 Honda CR-V EX-L',
          '4'
        ],
        [' and a 2021 Toyota Camry SE', '5'],
        ['.']
      ]),
      _bullet('mav-auto-sb2', 'Renewal Context', [
        ['Apex Mutual returned the renewal 22% up at $18,120', '6'],
        ['. Joseph Mavericks was added as a named driver mid-term', '7'],
        [
          ' and the carrier re-rate has been outstanding four days, so the household has not seen the rating impact yet.'
        ]
      ]),
      _bullet('mav-auto-sb2b', 'Loss Experience', [
        ['Two losses this term. The at-fault collision closed at $17,250 in November', '11'],
        [
          ', and the Wind/Hail claim filed in April is still open with no adjuster reserve',
          '9'
        ],
        ['. Both sit inside the rating period Apex priced the renewal off.']
      ]),
      _bullet('mav-auto-sb3', 'Sentiment', [
        [
          'Ninth year as a client and no service complaints logged this term, but the auto has moved carriers three times in four years - Apex is only in its first term. Values keeping the three lines together more than the auto price on its own.',
          '8'
        ]
      ]),
      _bullet('mav-auto-sb4', 'Risk Sensitivity', [
        ['Price-sensitive on auto, and asked at the last check-in', '8'],
        [
          ' to see alternatives before anything is bound. Unwilling to reduce umbrella limits to fund a saving.'
        ]
      ]),
      _bullet('mav-auto-sb5', 'Producer Priority', [
        ['Split the 22% into the added drivers and the loss experience', '9'],
        [' before presenting the market comparison', '10'],
        [
          ', and protect the homeowners and umbrella lines renewing behind this one.'
        ]
      ])
    ],
    citedSources: [
      { id: 'mac-1',  n: 1,  name: '2025 Personal Auto - Mavericks Household', type: 'Policy' },
      { id: 'mac-2',  n: 2,  name: 'Homeowners - 4208 N Dale Mabry Hwy',       type: 'Policy' },
      { id: 'mac-3',  n: 3,  name: 'Personal Umbrella - Mavericks Household',  type: 'Policy' },
      { id: 'mac-4',  n: 4,  name: '2024 Honda CR-V EX-L',                     type: 'Insured Vehicle' },
      { id: 'mac-5',  n: 5,  name: '2021 Toyota Camry SE',                     type: 'Insured Vehicle' },
      { id: 'mac-6',  n: 6,  name: 'Apex Mutual renewal indication - $18,120',  type: 'Renewal Quote' },
      { id: 'mac-7',  n: 7,  name: 'Driver addition - Joseph Mavericks',       type: 'Policy Change Request' },
      { id: 'mac-8',  n: 8,  name: 'Q1 Household Coverage Check-In',           type: 'Interaction Summary' },
      { id: 'mac-9',  n: 9,  name: 'Wind/Hail claim - filed Apr 2026',         type: 'Claim' },
      { id: 'mac-10', n: 10, name: 'Mavericks renewal market comparison',      type: 'Quote Comparison' },
      { id: 'mac-11', n: 11, name: 'Collision claim - closed Nov 2025',        type: 'Claim' }
    ],
    references: [
      { id: 'mar-1', name: 'James Mavericks',    type: 'Contact' },
      { id: 'mar-2', name: 'Emily Mavericks',    type: 'Contact' },
      { id: 'mar-3', name: 'Mavericks Household', type: 'Account' }
    ],
    tasksCompleted: 1,
    tasksTotal: 5,
    tasks: [
      {
        id: 'mav-auto-t1',
        name: 'Pull MVRs for both added drivers',
        owner: 'Elena Rostova',
        ownerInitials: 'ER',
        dueDate: 'Aug 26, 2026',
        status: 'Completed'
      },
      {
        id: 'mav-auto-t2',
        name: 'Request claim status update from adjuster',
        owner: 'James Field',
        ownerInitials: 'JF',
        dueDate: 'Aug 27, 2026',
        status: 'In Progress'
      },
      {
        id: 'mav-auto-t3',
        name: 'Build market comparison for the renewal',
        owner: 'Agentforce',
        ownerInitials: 'AF',
        dueDate: 'Aug 28, 2026',
        status: 'Ready for Review'
      },
      {
        id: 'mav-auto-t4',
        name: 'Confirm garaging address for the Camry',
        owner: 'Mavericks Household',
        ownerInitials: 'MH',
        dueDate: 'Aug 31, 2026',
        status: 'Pending'
      },
      {
        id: 'mav-auto-t5',
        name: 'Re-underwrite with both drivers rated',
        owner: 'Underwriting',
        ownerInitials: 'UW',
        dueDate: 'Sep 1, 2026',
        status: 'Blocked'
      }
    ],
    brief: {
      sections: [
        {
          id: 'mav-auto-bs1',
          heading: 'Since Last Meeting',
          body: 'Last contact was the Q1 household coverage check-in on July 25, 2026 - 38 days ago, outside the 30-day cadence for this tier. James confirmed then that Joseph would be added to the auto policy, and asked to be shown alternatives before any increase is bound. No other commitments were carried out of that call.'
        },
        {
          id: 'mav-auto-bs2',
          heading: 'Policies in Force',
          body: 'Personal Auto: $14,850 expiring premium, renews October 13, 2026. Personal Umbrella renews November 15 and Homeowners December 1, both inside the same window, with umbrella still at the $1M limit it was written at. Household premium totals $19.6K across the three lines - $14,850 auto, $4,120 homeowners, $640 umbrella. Two vehicles rated on auto against $59K of insured value, led by a 2024 Honda CR-V EX-L at $36.5K, both garaged at 4208 N Dale Mabry Hwy, Tampa. James was the only rated driver before the mid-term addition.'
        },
        {
          id: 'mav-auto-bs3',
          heading: "What's Changed",
          body: 'Apex Mutual returned the renewal at $18,120, a 22% increase on the expiring premium. Joseph Mavericks was added as a named driver during the term and the carrier re-rate has been outstanding four days. The term also carries two losses: the at-fault collision, which closed at $17,250 in November, and the Wind/Hail claim filed in April 2026, which is still under review with no reserve figure available yet.'
        }
      ],
      suggestedAgenda: [
        'Confirm which household members are now driving which vehicles.',
        'Split the 22% increase into the added driver and the two losses on the term.',
        'Present the three-carrier market comparison at matching limits.',
        'Offer to pull the homeowners and umbrella reviews into one household session.'
      ],
      meetingPriorities: [
        'Explain the rating impact of the added driver before defending the premium.',
        'Hold the bind decision until the Wind/Hail claim has a reserve figure.',
        'Protect the homeowners and umbrella lines renewing behind this one.'
      ]
    }
  },
  discussionGuide: {
    createdAt: '2026-05-26T09:52:00Z',
    intro:
      'Sixty minutes with James. The first half explains where the 22% came from; the market comparison only comes out once he understands the added driver and the two losses are doing most of the work.',
    topics: [
      {
        id: 'dg-1',
        window: '0-10 min',
        title: 'Reconnect and confirm the household',
        prompt:
          'Acknowledge the 38-day gap. Confirm Joseph is driving regularly and which vehicle he uses.'
      },
      {
        id: 'dg-2',
        window: '10-25 min',
        title: 'Walk through the renewal increase',
        prompt:
          'Split the 22% into the two new drivers and the open claim. Show him the number he would have seen without either.'
      },
      {
        id: 'dg-3',
        window: '25-40 min',
        title: 'Present the market comparison',
        prompt:
          'Three carriers, same limits. Position Apex staying competitive on the bundle even where auto alone is not.'
      },
      {
        id: 'dg-4',
        window: '40-55 min',
        title: 'Offer the full household review',
        prompt:
          'Homeowners and umbrella renew behind this. Offer to review all three now rather than three separate calls.'
      },
      {
        id: 'dg-5',
        window: '55-60 min',
        title: 'Confirm next steps',
        prompt:
          'Agree whether to bind Apex or go to market, and name a date for the umbrella conversation.'
      }
    ]
  },
  sessionNotes: {
    prompt:
      'Join video and voice calls. Capture audio or type notes from your device.',
    placeholder:
      'Type your notes here. Agentforce folds them into the follow-up summary when the meeting wraps.'
  },
  followUp: {
    createdAt: '2026-05-26T11:12:00Z',
    recap:
      'James accepted the driver explanation without much pushback once he saw the premium modelled without Joseph. He wants the market shopped anyway, and asked us to keep Apex in the comparison because he values the bundle. He also asked to move the umbrella conversation forward rather than waiting for its own renewal.',
    decisions: [
      'Shop the auto renewal across the market, with Apex Mutual included in the comparison.',
      'Joseph stays rated - primary on the Camry, occasional on the CR-V.',
      'Umbrella and homeowners review pulled forward into a single household session.',
      'Hold the bind decision until the open Wind/Hail claim has a reserve figure.'
    ]
  }
};

const _mavericksUmbrellaPrep = {
  meetingId: 'mp-mavericks-umbrella',
  agency: 'Mavericks Household',
  draftCreatedAt: '2026-05-26T08:40:00Z',
  draft: {
    intro:
      "This 12:30 session is the household coverage review James asked to pull forward off the morning auto call. It covers the 2026 Umbrella and Homeowners renewals together, and the question underneath both is whether $1M of umbrella still fits a household with two new drivers on the auto policy.",
    bookAtAGlance: [
      'Umbrella and Homeowners both renew inside the same window as the auto policy.',
      'Two added drivers materially change the household liability profile.',
      'Current umbrella limit has not been revisited since the policy was first written.',
      'Household carries $19.6K of annual premium across all three lines.'
    ],
    whyItMatters:
      'Adding drivers to a household is the single most common trigger for an underinsured umbrella, and this household has not had its limit reviewed since inception. Reviewing all three lines in one session also consolidates three renewal conversations into one, which is what James asked for on the morning call.',
    openerCopy:
      'Open by connecting back to the auto call - he already accepts that the household risk profile changed. Move from that directly into the umbrella limit rather than starting with the homeowners schedule.'
  },
  sources: [
    { id: 'src-umb-policy', label: '2025 Mavericks Umbrella policy',            type: 'Prior policy',   href: '#' },
    { id: 'src-hom-policy', label: '2025 Mavericks Homeowners policy',          type: 'Prior policy',   href: '#' },
    { id: 'src-umb-notes',  label: 'Auto renewal call notes (this morning)',    type: 'Meeting notes',  href: '#' },
    { id: 'src-umb-sched',  label: 'Scheduled personal property inventory',     type: 'Schedule',       href: '#' }
  ],
  summary: {
    metrics: [
      { id: 'um-1', label: 'Umbrella Limit', value: '$1M', delta: 'Not reviewed since inception' },
      { id: 'um-2', label: 'Lines in Review', value: '2', delta: 'Umbrella + Homeowners' },
      { id: 'um-3', label: 'Household Premium', value: '$19.6K', delta: '3 policies' }
    ],
    keyConcerns: [
      'Umbrella limit has never been revisited, and the household just added two drivers.',
      'Homeowners scheduled-property inventory is out of date.',
      'Three renewals landing in the same window risks three separate conversations.',
      'Auto renewal outcome is still open, which affects the underlying limits umbrella sits over.'
    ],
    talkingPoints: [
      'Tie the umbrella limit question directly to the two new drivers.',
      'Walk the scheduled-property list and confirm what has been added or sold.',
      'Show the cost of moving from $1M to $2M of umbrella - it is usually less than expected.',
      'Confirm underlying auto and homeowners limits meet the umbrella carrier floor.'
    ]
  },
  agentforceActions: [
    {
      id: 'aa1',
      label: 'Price umbrella at $2M and $3M',
      detail: 'Quotes both step-ups against the current underlying limits.',
      checked: true
    },
    {
      id: 'aa2',
      label: 'Refresh the scheduled property inventory',
      detail: 'Flags items on the schedule with no appraisal in the last three years.',
      checked: true
    },
    {
      id: 'aa3',
      label: 'Check underlying limit compliance',
      detail: 'Verifies auto and homeowners meet the umbrella carrier minimums.',
      checked: false
    }
  ],
  prepTasks: [
    {
      id: 't1',
      task: 'Pull current umbrella and homeowners declarations',
      owner: 'Elena Rostova',
      role: 'Account Manager',
      status: 'Completed'
    },
    {
      id: 't2',
      task: 'Quote umbrella at $2M and $3M',
      owner: 'Agentforce',
      role: 'AI Assistant',
      status: 'Completed'
    },
    {
      id: 't3',
      task: 'Reconcile scheduled property against appraisals',
      owner: 'James Field',
      role: 'Producer',
      status: 'Completed'
    },
    {
      id: 't4',
      task: 'Confirm any home improvements since last renewal',
      owner: 'Mavericks Household',
      role: 'Customer',
      status: 'Completed'
    }
  ],
  documents: [
    {
      id: 'mdoc-1',
      name: '2025 Mavericks Umbrella - declarations.pdf',
      kind: 'PDF',
      meta: '780 KB · Added Jul 19 by Elena Rostova'
    },
    {
      id: 'mdoc-2',
      name: '2025 Mavericks Homeowners - declarations.pdf',
      kind: 'PDF',
      meta: '1.1 MB · Added Jul 19 by Elena Rostova'
    },
    {
      id: 'mdoc-3',
      name: 'Umbrella step-up pricing.xlsx',
      kind: 'XLS',
      meta: '220 KB · Added Jul 23 by Agentforce'
    }
  ],
  preMeeting: {
    updatedAt: 'Last updated at 8:40 AM by Agentforce.',
    lead: 'James Mavericks, 52, $19.6K household premium, 2 lines in review',
    bullets: [
      _bullet('mav-umb-sb1', 'Coverage', [
        ['Personal Umbrella', '1'],
        [' at a $1M limit sitting over Homeowners', '2'],
        [' and the 2025 Personal Auto', '3'],
        ['. The umbrella limit has not been revisited since the policy was written.']
      ]),
      _bullet('mav-umb-sb2', 'Renewal Context', [
        [
          'Both lines renew inside the same window as the auto policy, and James asked on this morning\u2019s auto call',
          '4'
        ],
        [
          ' to pull the household review forward rather than take three separate renewal conversations.'
        ]
      ]),
      _bullet('mav-umb-sb3', 'Sentiment', [
        [
          'Already accepts that the household risk profile changed - Joseph was added as a named driver',
          '5'
        ],
        [
          ' during the auto term. Receptive to a limit increase framed against that rather than against price.'
        ]
      ]),
      _bullet('mav-umb-sb4', 'Risk Sensitivity', [
        ['Two added drivers materially raise the household liability exposure', '5'],
        ['. The scheduled personal property inventory', '6'],
        [
          ' has not been reconciled against appraisals since the last renewal, so the homeowners side is more likely under-scheduled than over.'
        ]
      ]),
      _bullet('mav-umb-sb5', 'Producer Priority', [
        [
          'Confirm the underlying auto and homeowners limits still meet the umbrella carrier floor before walking the $2M and $3M step-ups',
          '7'
        ],
        ['.']
      ])
    ],
    citedSources: [
      { id: 'muc-1', n: 1, name: 'Personal Umbrella - Mavericks Household',      type: 'Policy' },
      { id: 'muc-2', n: 2, name: 'Homeowners - 4208 N Dale Mabry Hwy',           type: 'Policy' },
      { id: 'muc-3', n: 3, name: '2025 Personal Auto - Mavericks Household',     type: 'Policy' },
      { id: 'muc-4', n: 4, name: 'Personal Auto Renewal Review - Mavericks Household', type: 'Meeting Playbook' },
      { id: 'muc-5', n: 5, name: 'Driver addition - Joseph Mavericks',            type: 'Policy Change Request' },
      { id: 'muc-6', n: 6, name: 'Scheduled personal property inventory',        type: 'Property Schedule' },
      { id: 'muc-7', n: 7, name: 'Umbrella step-up pricing - $2M / $3M',         type: 'Quote Comparison' }
    ],
    references: [
      { id: 'mur-1', name: 'James Mavericks',     type: 'Contact' },
      { id: 'mur-2', name: 'Emily Mavericks',     type: 'Contact' },
      { id: 'mur-3', name: 'Mavericks Household', type: 'Account' }
    ],
    tasksCompleted: 4,
    tasksTotal: 4,
    tasks: [
      {
        id: 'mav-umb-t1',
        name: 'Pull current umbrella and homeowners declarations',
        owner: 'Elena Rostova',
        ownerInitials: 'ER',
        dueDate: 'Aug 26, 2026',
        status: 'Completed'
      },
      {
        id: 'mav-umb-t2',
        name: 'Quote umbrella at $2M and $3M',
        owner: 'Agentforce',
        ownerInitials: 'AF',
        dueDate: 'Aug 27, 2026',
        status: 'Completed'
      },
      {
        id: 'mav-umb-t3',
        name: 'Reconcile scheduled property against appraisals',
        owner: 'James Field',
        ownerInitials: 'JF',
        dueDate: 'Aug 27, 2026',
        status: 'Completed'
      },
      {
        id: 'mav-umb-t4',
        name: 'Confirm any home improvements since last renewal',
        owner: 'Mavericks Household',
        ownerInitials: 'MH',
        dueDate: 'Aug 28, 2026',
        status: 'Completed'
      }
    ],
    brief: {
      sections: [
        {
          id: 'mav-umb-bs1',
          heading: 'Since Last Meeting',
          body: 'This session was created off this morning\u2019s Personal Auto renewal call. James accepted that adding Joseph changed the household risk profile, asked for the umbrella and homeowners reviews to be pulled forward rather than run separately, and left the auto bind decision open pending the Wind/Hail claim reserve.'
        },
        {
          id: 'mav-umb-bs2',
          heading: 'Policies in Force',
          body: 'Personal Umbrella: $1M limit, unchanged since inception, $640 expiring, renews November 15, 2026. Homeowners: 4208 N Dale Mabry Hwy, Tampa, $4,120 expiring, renews December 1, 2026, with a scheduled personal property list last reconciled at the prior renewal. Personal Auto: $14,850 expiring against a $18,120 renewal indication, renews October 13, 2026. Household premium totals $19.6K across the three lines.'
        },
        {
          id: 'mav-umb-bs3',
          heading: "What's Changed",
          body: 'Two named drivers were added to the auto policy during the term, which raises the liability exposure the umbrella sits over. Step-up pricing at $2M and $3M is quoted and ready for review. The scheduled property reconciliation found two items sold and one ring never added to the schedule.'
        }
      ],
      suggestedAgenda: [
        'Pick up from the morning auto call and the changed household risk profile.',
        'Review the $1M umbrella limit against the two added drivers.',
        'Walk the homeowners scheduled-property list for additions and disposals.',
        'Confirm underlying auto and homeowners limits meet the umbrella carrier floor.'
      ],
      meetingPriorities: [
        'Show the incremental cost of $2M and $3M against the new-driver exposure.',
        'Flag every scheduled item with no appraisal in the last three years.',
        'Agree to move all three household lines onto one combined annual review.'
      ]
    }
  },
  discussionGuide: {
    createdAt: '2026-05-26T12:05:00Z',
    intro:
      'Sixty minutes across two lines. Umbrella first while the morning auto conversation is still fresh, then the homeowners schedule, then one combined set of next steps.',
    topics: [
      {
        id: 'dg-1',
        window: '0-10 min',
        title: 'Pick up from the auto call',
        prompt:
          'He already accepts the household risk changed. Use that as the opening for the umbrella limit.'
      },
      {
        id: 'dg-2',
        window: '10-25 min',
        title: 'Umbrella limit review',
        prompt:
          'Show $1M against the new driver profile, then the cost to move to $2M and $3M.'
      },
      {
        id: 'dg-3',
        window: '25-40 min',
        title: 'Homeowners schedule walkthrough',
        prompt:
          'Confirm additions, disposals, and any improvements. Flag items with stale appraisals.'
      },
      {
        id: 'dg-4',
        window: '40-55 min',
        title: 'Underlying limit compliance',
        prompt:
          'Confirm auto and homeowners still satisfy the umbrella carrier floor after the auto renewal.'
      },
      {
        id: 'dg-5',
        window: '55-60 min',
        title: 'Confirm next steps',
        prompt:
          'One decision per line, and confirm he wants all three renewals handled together going forward.'
      }
    ]
  },
  sessionNotes: {
    prompt:
      'Join video and voice calls. Capture audio or type notes from your device.',
    placeholder:
      'Type your notes here. Agentforce folds them into the follow-up summary when the meeting wraps.'
  },
  followUp: {
    createdAt: '2026-05-26T13:40:00Z',
    recap:
      'James moved to $2M of umbrella once he saw the incremental cost against the new-driver exposure. The homeowners schedule needed more correction than expected - two items sold, one ring never added. He confirmed he wants all three household renewals reviewed in a single annual session from now on.',
    decisions: [
      'Umbrella increasing from $1M to $2M at renewal.',
      'Two scheduled items removed, one ring to be added pending appraisal.',
      'All three household lines move to a single combined annual review.',
      'Homeowners renewal held until the appraisal on the added ring is back.'
    ]
  }
};

const _acmeMedicalPrep = {
  meetingId: 'mp-acme-renewal',
  agency: 'Acme Manufacturing',
  draftCreatedAt: '2026-05-26T09:05:00Z',
  draft: {
    intro:
      "This 2:00 PM session is the 1/1 group medical renewal strategy for Acme Manufacturing's 50 employees. BlueCross has sent a 12% renewal indication against a loss ratio that supports 4-6%, so the meeting is about whether to negotiate or go to market.",
    bookAtAGlance: [
      '$612K expiring premium on a 50-employee BlueCross PPO, renewal indication $648K.',
      'BlueCross opened at 12% - well above the 4-6% the loss experience supports.',
      'One open high-cost claimant is driving most of the loss-ratio pressure.',
      'Census validated at 48 of 50 rows; 2 rows need date-of-birth correction.'
    ],
    whyItMatters:
      "The gap between the 12% ask and the 4-6% the experience supports is the whole negotiation. BlueCross is the incumbent with the strongest network match for Acme's Cincinnati footprint, so the goal is leverage rather than replacement - a credible three-way bake-off against UHC and Cigna is what moves their number. The open high-cost claimant is the one fact that justifies part of their position, so it needs addressing directly rather than avoided.",
    openerCopy:
      'Open on the loss ratio and what it supports, not on the 12%. Establishing the defensible range first makes the bake-off read as diligence rather than a threat to move the business.'
  },
  sources: [
    { id: 'src-acme-prior',  label: '2025 Acme Medical - BlueCross (50 employees)', type: 'Prior policy',   href: '#' },
    { id: 'src-acme-census', label: 'Acme 50-employee census',                      type: 'Census file',    href: '#' },
    { id: 'src-acme-claims', label: 'High-cost claimant summary',                   type: 'Claims report',  href: '#' },
    { id: 'src-acme-slack',  label: 'Slack thread - Acme group medical RFQ',        type: 'Slack conversation', href: '#' }
  ],
  summary: {
    metrics: [
      { id: 'am-1', label: 'Renewal Indication', value: '+12%', delta: 'Experience supports 4-6%', dir: 'up' },
      { id: 'am-2', label: 'Expiring Premium', value: '$612K', delta: '50 employees' },
      { id: 'am-3', label: 'Markets Quoting', value: '3', delta: 'BlueCross, UHC, Cigna' }
    ],
    keyConcerns: [
      'BlueCross opened at 12% against a loss ratio supporting 4-6%.',
      'One open high-cost claimant accounts for most of the loss-ratio pressure.',
      'Two census rows still need date-of-birth correction before quotes are final.',
      'BlueCard PPO is the only network with full coverage of the Cincinnati census.'
    ],
    talkingPoints: [
      'Establish the 4-6% defensible range from the loss experience before naming the 12%.',
      'Present the three-way bake-off as diligence, not as leaving BlueCross.',
      'Address the high-cost claimant directly - it justifies part of their ask, not all of it.',
      'Confirm plan designs to be quoted: Base HMO, Buy-up PPO, and HDHP.'
    ]
  },
  agentforceActions: [
    {
      id: 'aa1',
      label: 'Submit the three-way RFQ',
      detail: 'Sends the validated census to BlueCross, UHC, and Cigna.',
      checked: true
    },
    {
      id: 'aa2',
      label: 'Model the renewal without the high-cost claimant',
      detail: 'Isolates how much of the 12% that single claimant explains.',
      checked: true
    },
    {
      id: 'aa3',
      label: 'Check network adequacy by census ZIP',
      detail: 'Compares each carrier network against all 50 employee ZIP codes.',
      checked: false
    }
  ],
  prepTasks: [
    {
      id: 't1',
      task: 'Validate the 50-employee census',
      owner: 'Elena Rostova',
      role: 'Account Manager',
      status: 'Completed'
    },
    {
      id: 't2',
      task: 'Pull high-cost claimant reserve figure',
      owner: 'James Field',
      role: 'Producer',
      status: 'In Progress'
    },
    {
      id: 't3',
      task: 'Build the three-way plan comparison',
      owner: 'Agentforce',
      role: 'AI Assistant',
      status: 'Ready for Review'
    },
    {
      id: 't4',
      task: 'Correct 2 census rows missing date of birth',
      owner: 'Acme Manufacturing',
      role: 'Customer',
      status: 'Pending'
    },
    {
      id: 't5',
      task: 'Confirm BlueCross will re-rate on corrected census',
      owner: 'Underwriting',
      role: 'Carrier',
      status: 'Blocked'
    }
  ],
  documents: [
    {
      id: 'mdoc-1',
      name: '2025 Acme Medical - BlueCross.pdf',
      kind: 'PDF',
      meta: '2.1 MB · Added Jul 15 by Elena Rostova'
    },
    {
      id: 'mdoc-2',
      name: 'Acme census - 50 employees.xlsx',
      kind: 'XLS',
      meta: '95 KB · Added Jul 16 by Elena Rostova'
    },
    {
      id: 'mdoc-3',
      name: 'Three-way plan comparison.xlsx',
      kind: 'XLS',
      meta: '480 KB · Added Jul 24 by Agentforce'
    }
  ],
  preMeeting: {
    updatedAt: 'Last updated at 9:05 AM by Agentforce.',
    lead: 'Acme Manufacturing, 50 employees, $612K expiring premium, Cincinnati',
    bullets: [
      _bullet('acme-sb1', 'Coverage', [
        ['2025 group medical with BlueCross', '1'],
        [
          ' on a BlueCard PPO, 50 enrolled employees across three tiers, $612K expiring premium. Life and AD&D sits alongside it with MetLife',
          '2'
        ],
        ['. Both renew 1/1.']
      ]),
      _bullet('acme-sb2', 'Renewal Context', [
        ['BlueCross opened at 12%, a $648K indication', '3'],
        [', against loss experience', '4'],
        [' that supports 4-6%. One open high-cost claimant', '5'],
        [' accounts for most of the loss-ratio pressure.']
      ]),
      _bullet('acme-sb3', 'Sentiment', [
        ['The benefits team is not looking to leave BlueCross - the BlueCard network', '6'],
        [' is the only one with full coverage of the Cincinnati census', '7'],
        ['. They want a defensible counter, not a carrier change.']
      ]),
      _bullet('acme-sb4', 'Data Readiness', [
        ['Census validated at 48 of 50 rows', '7'],
        [
          '; two rows still need date-of-birth correction before any quote is final. UHC and Cigna are staged to quote on the corrected file',
          '8'
        ],
        ['.']
      ]),
      _bullet('acme-sb5', 'Producer Priority', [
        [
          'Establish the 4-6% range from the loss experience before naming the 12%, so the three-way bake-off',
          '8'
        ],
        [' reads as diligence rather than a threat to move the business.']
      ])
    ],
    citedSources: [
      { id: 'acc-1', n: 1, name: '2025 Acme Medical - BlueCross',                type: 'Policy' },
      { id: 'acc-2', n: 2, name: '2025 Acme Life / AD&D - MetLife',              type: 'Policy' },
      { id: 'acc-3', n: 3, name: 'BlueCross renewal indication - $648K',         type: 'Renewal Quote' },
      { id: 'acc-4', n: 4, name: 'Acme loss experience - trailing 12 months',    type: 'Claims Report' },
      { id: 'acc-5', n: 5, name: 'High-cost claimant summary',                   type: 'Claims Report' },
      { id: 'acc-6', n: 6, name: 'BlueCard PPO network adequacy',                type: 'Network Analysis' },
      { id: 'acc-7', n: 7, name: 'Acme census - 50 employees',                   type: 'Census File' },
      { id: 'acc-8', n: 8, name: 'Three-way plan comparison - BlueCross, UHC, Cigna', type: 'Quote Comparison' },
      { id: 'acc-9', n: 9, name: 'Slack thread - Acme group medical RFQ',        type: 'Slack Conversation' }
    ],
    references: [
      { id: 'acr-1', name: 'Acme Manufacturing',                    type: 'Account' },
      { id: 'acr-2', name: 'Acme Manufacturing - Census Correction', type: 'Case' },
      { id: 'acr-3', name: 'Acme Manufacturing - GL COI',           type: 'Case' }
    ],
    tasksCompleted: 1,
    tasksTotal: 5,
    tasks: [
      {
        id: 'acme-t1',
        name: 'Validate the 50-employee census',
        owner: 'Elena Rostova',
        ownerInitials: 'ER',
        dueDate: 'Aug 25, 2026',
        status: 'Completed'
      },
      {
        id: 'acme-t2',
        name: 'Pull high-cost claimant reserve figure',
        owner: 'James Field',
        ownerInitials: 'JF',
        dueDate: 'Aug 27, 2026',
        status: 'In Progress'
      },
      {
        id: 'acme-t3',
        name: 'Build the three-way plan comparison',
        owner: 'Agentforce',
        ownerInitials: 'AF',
        dueDate: 'Aug 28, 2026',
        status: 'Ready for Review'
      },
      {
        id: 'acme-t4',
        name: 'Correct 2 census rows missing date of birth',
        owner: 'Acme Manufacturing',
        ownerInitials: 'AM',
        dueDate: 'Aug 31, 2026',
        status: 'Pending'
      },
      {
        id: 'acme-t5',
        name: 'Confirm BlueCross will re-rate on corrected census',
        owner: 'Underwriting',
        ownerInitials: 'UW',
        dueDate: 'Sep 2, 2026',
        status: 'Blocked'
      }
    ],
    brief: {
      sections: [
        {
          id: 'acme-bs1',
          heading: 'Since Last Meeting',
          body: 'The renewal kickoff on August 12 set the three-way market strategy and the plan designs to quote. HR agreed to return the two corrected census rows, and the Slack RFQ thread has been running since. No decisions were carried out of that call beyond the designs in scope.'
        },
        {
          id: 'acme-bs2',
          heading: 'Plan and Funding',
          body: 'BlueCross BlueCard PPO, fully insured, 50 enrolled across three tiers. Expiring premium $612K against a $648K renewal indication. Plan designs in scope for quoting: Base HMO, Buy-up PPO, and HDHP. UHC and Cigna are staged against the same census. Life and AD&D with MetLife at $48.5K renews on the same 1/1 date.'
        },
        {
          id: 'acme-bs3',
          heading: "What's Changed",
          body: 'BlueCross moved from an informal 8-10% signal to a formal 12% indication. One high-cost claimant remains open and is the single largest contributor to the loss ratio. Two census rows are still missing date of birth, which blocks final quotes from all three carriers and the BlueCross re-rate behind them.'
        }
      ],
      suggestedAgenda: [
        'Walk the loss experience and the 4-6% range it supports.',
        'Name the 12% indication and the gap it leaves against that range.',
        'Review the three-way bake-off across Base HMO, Buy-up PPO, and HDHP.',
        'Address the high-cost claimant and what part of the ask it justifies.'
      ],
      meetingPriorities: [
        'Agree the counter to BlueCross before the session ends.',
        'Name an owner and a date for the two census corrections.',
        'Confirm BlueCross will re-rate once the corrected census lands.'
      ]
    }
  },
  discussionGuide: {
    createdAt: '2026-05-26T13:55:00Z',
    intro:
      'Sixty minutes with the Acme benefits team. Establish the defensible rate range first, then the bake-off, and only then the high-cost claimant - in that order the claimant reads as one input rather than the headline.',
    topics: [
      {
        id: 'dg-1',
        window: '0-10 min',
        title: 'Frame the loss experience',
        prompt:
          'Walk the loss ratio and state the 4-6% range it supports before mentioning the 12% ask.'
      },
      {
        id: 'dg-2',
        window: '10-25 min',
        title: 'The BlueCross indication',
        prompt:
          'Name the 12% and the gap. Be clear BlueCross remains the strongest network match for Cincinnati.'
      },
      {
        id: 'dg-3',
        window: '25-40 min',
        title: 'Three-way bake-off',
        prompt:
          'UHC and Cigna against the incumbent on Base HMO, Buy-up PPO, and HDHP.'
      },
      {
        id: 'dg-4',
        window: '40-55 min',
        title: 'The high-cost claimant',
        prompt:
          'Show the renewal modelled with and without. Concede the part of their ask it justifies.'
      },
      {
        id: 'dg-5',
        window: '55-60 min',
        title: 'Confirm next steps',
        prompt:
          'Agree the counter to BlueCross and name an owner for the two census corrections.'
      }
    ]
  },
  sessionNotes: {
    prompt:
      'Join video and voice calls. Capture audio or type notes from your device.',
    placeholder:
      'Type your notes here. Agentforce folds them into the follow-up summary when the meeting wraps.'
  },
  followUp: {
    createdAt: '2026-05-26T15:20:00Z',
    recap:
      'The team agreed to counter BlueCross at 6% and let the three-way bake-off run in parallel rather than as a threat. They accepted that the high-cost claimant justifies part of the ask but not 12%. HR owns the two census corrections and will return them within the week, and BlueCross has agreed to re-rate once they land.',
    decisions: [
      'Counter BlueCross at 6%, with the UHC and Cigna quotes running in parallel.',
      'Plan designs to quote: Base HMO, Buy-up PPO, and HDHP.',
      'HR to correct the two census rows missing date of birth within the week.',
      'BlueCross to re-rate on the corrected census before any bind decision.'
    ]
  }
};

const _whitfieldAutoPrep = {
  meetingId: 'mp-whitfield-auto-renewal',
  agency: 'Whitfield Household',
  draftCreatedAt: '2026-09-01T08:14:00Z',
  draft: {
    intro:
      "This 10:00 AM call with Daniel Whitfield is the renewal conversation on the household's 2026 Personal Auto, which expires October 15. Gulfstream Mutual has come back 19% up, but Chloe was licensed in May and a third vehicle joined the policy in June - so most of the increase is explainable before it needs defending.",
    bookAtAGlance: [
      '$3,140 expiring premium, $3,730 on the Gulfstream Mutual renewal indication - a 19% increase.',
      'Three vehicles rated: Subaru Outback, Ford F-150, and a Hyundai Ioniq 5 added in June.',
      'Chloe Whitfield was licensed in May 2026 and is rated as an occasional driver on the Outback.',
      'No personal umbrella behind $9.8K of household premium, now with a teen driver on the policy.'
    ],
    whyItMatters:
      'A newly licensed driver and a third vehicle account for most of the 19%, which makes this a conversation the household can follow rather than one it has to accept. The risk is not the increase - it is the direct-writer quote Daniel already has in hand, which is $600 cheaper on auto alone because it ignores the homeowners credit. Putting both options side by side at matching limits is what keeps the account, and the teen driver finally makes the umbrella gap a concrete conversation instead of a theoretical one.',
    openerCopy:
      "Open on Chloe's license and the Ioniq 5, because those are changes the household made on purpose and already knows about. Bring the market comparison out second, at matching limits rather than headline price, and raise the umbrella gap only once the auto decision is settled."
  },
  sources: [
    { id: 'src-whit-prior', label: '2025 Whitfield Auto - Gulfstream Mutual policy', type: 'Prior policy',         href: '#' },
    { id: 'src-whit-claim', label: 'Collision claim file (closed Feb 2026)',         type: 'Claim record',         href: '#' },
    { id: 'src-whit-mvr',   label: 'MVR pull - Chloe Whitfield',                     type: 'Driver record',        href: '#' },
    { id: 'src-whit-book',  label: 'Whitfield Household book snapshot',              type: 'Revenue Intelligence', href: '#' }
  ],
  summary: {
    metrics: [
      { id: 'wm-1', label: 'Renewal Change', value: '+19%', delta: 'vs expiring', dir: 'up' },
      { id: 'wm-2', label: 'Household Premium', value: '$9.8K', delta: '2 policies' },
      { id: 'wm-3', label: 'Days to Expiry', value: '44', delta: 'Oct 15, 2026' }
    ],
    keyConcerns: [
      'Renewal is up 19% ($3,140 to $3,730) on a two-policy household.',
      'A direct writer has quoted $600 below on auto alone, and Daniel has the number already.',
      'No personal umbrella sits behind the household now that a teen driver is rated.',
      'The at-fault collision from February 2026 closed at $8,400 and is still inside the rating period.'
    ],
    talkingPoints: [
      "Lead with Chloe's license and the Ioniq 5 so the increase reads as expected, not arbitrary.",
      'Put the direct-writer quote side by side at matching limits, not headline price.',
      'Use the teen driver to make the case for a $1M umbrella now rather than at homeowners renewal.',
      'Confirm whether the F-150 should move to pleasure use and be re-rated.'
    ]
  },
  agentforceActions: [
    {
      id: 'wa1',
      label: 'Shop the renewal across the market',
      detail: 'Builds an RFQ from the expiring policy, the added driver, and the third vehicle.',
      checked: true
    },
    {
      id: 'wa2',
      label: 'Rebuild the direct-writer quote at matching limits',
      detail: 'Restates the competitor number with our limits and the homeowners credit applied.',
      checked: false
    },
    {
      id: 'wa3',
      label: 'Model the premium without Chloe and the Ioniq 5',
      detail: 'Isolates how much of the 19% is the new driver and how much is the third vehicle.',
      checked: false
    }
  ],
  prepTasks: [
    {
      id: 'wt1',
      task: 'Pull MVR for Chloe Whitfield',
      owner: 'Elena Rostova',
      role: 'Account Manager',
      status: 'Completed'
    },
    {
      id: 'wt2',
      task: 'Price a $1M personal umbrella with the teen driver rated',
      owner: 'Agentforce',
      role: 'AI Assistant',
      status: 'Completed'
    },
    {
      id: 'wt3',
      task: 'Build three-carrier comparison at matching limits',
      owner: 'Agentforce',
      role: 'AI Assistant',
      status: 'Ready for Review'
    },
    {
      id: 'wt4',
      task: 'Confirm Ioniq 5 garaging address and annual mileage',
      owner: 'Whitfield Household',
      role: 'Customer',
      status: 'Pending'
    },
    {
      id: 'wt5',
      task: 'Re-rate with the F-150 moved to pleasure use',
      owner: 'Underwriting',
      role: 'Carrier',
      status: 'Blocked'
    }
  ],
  documents: [
    {
      id: 'wdoc-1',
      name: '2025 Whitfield Auto - Gulfstream Mutual.pdf',
      kind: 'PDF',
      meta: '1.1 MB · Added Aug 19 by Elena Rostova'
    },
    {
      id: 'wdoc-2',
      name: 'Collision claim file - Feb 2026.pdf',
      kind: 'PDF',
      meta: '580 KB · Added Aug 21 by Elena Rostova'
    },
    {
      id: 'wdoc-3',
      name: 'Whitfield renewal comparison.xlsx',
      kind: 'XLS',
      meta: '295 KB · Added Aug 28 by Agentforce'
    }
  ],
  preMeeting: {
    updatedAt: 'Last updated at 8:14 AM by Agentforce.',
    lead: 'Daniel Whitfield, 46, $9.8K household premium, 2 policies in force',
    bullets: [
      _bullet('whit-auto-sb1', 'Coverage', [
        ['Two policies in force: 2026 Personal Auto', '1'],
        [' ($3,140 expiring, renews October 15) and Homeowners', '2'],
        [
          ' on the Siesta Key residence. Three vehicles rated - a 2023 Subaru Outback',
          '3'
        ],
        [', a 2025 Hyundai Ioniq 5', '4'],
        [' added in June, and a 2019 Ford F-150', '5'],
        ['. No personal umbrella on the household.']
      ]),
      _bullet('whit-auto-sb2', 'Renewal Context', [
        ['Gulfstream Mutual returned the renewal 19% up at $3,730', '6'],
        ['. Chloe Whitfield was licensed in May and added as an occasional driver', '7'],
        [
          ' on the Outback, and the Ioniq 5 joined the policy a month later, so two rating changes land in the same term.'
        ]
      ]),
      _bullet('whit-auto-sb3', 'Sentiment', [
        [
          'Four years with Gulfstream across both lines and no service complaints logged this term. Reads the household as a single bill rather than two policies.',
          '9'
        ]
      ]),
      _bullet('whit-auto-sb4', 'Risk Sensitivity', [
        ['Holding a direct-writer quote $600 below on auto alone', '10'],
        [
          ', and raised it at the last check-in. The quote drops the homeowners credit and carries lower liability limits, which has not been pointed out yet.'
        ]
      ]),
      _bullet('whit-auto-sb5', 'Producer Priority', [
        ['Separate the new driver and the third vehicle from the closed collision claim', '8'],
        [' before the market comparison', '10'],
        [
          ' comes out, then close the umbrella gap while a teen driver makes the case for it.'
        ]
      ])
    ],
    citedSources: [
      { id: 'wac-1',  n: 1,  name: '2026 Personal Auto - Whitfield Household',      type: 'Policy' },
      { id: 'wac-2',  n: 2,  name: 'Homeowners - 4118 Siesta Key Dr',               type: 'Policy' },
      { id: 'wac-3',  n: 3,  name: '2023 Subaru Outback Premium',                   type: 'Insured Vehicle' },
      { id: 'wac-4',  n: 4,  name: '2025 Hyundai Ioniq 5 SEL',                      type: 'Insured Vehicle' },
      { id: 'wac-5',  n: 5,  name: '2019 Ford F-150 XLT',                           type: 'Insured Vehicle' },
      { id: 'wac-6',  n: 6,  name: 'Gulfstream Mutual renewal indication - $3,730', type: 'Renewal Quote' },
      { id: 'wac-7',  n: 7,  name: 'Driver addition - Chloe Whitfield',             type: 'Policy Change Request' },
      { id: 'wac-8',  n: 8,  name: 'Collision claim - closed Feb 2026',             type: 'Claim' },
      { id: 'wac-9',  n: 9,  name: 'Q2 Household Coverage Check-In',                type: 'Interaction Summary' },
      { id: 'wac-10', n: 10, name: 'Direct writer quote - auto only',               type: 'Competitor Quote' }
    ],
    references: [
      { id: 'war-1', name: 'Daniel Whitfield',    type: 'Contact' },
      { id: 'war-2', name: 'Erin Whitfield',      type: 'Contact' },
      { id: 'war-3', name: 'Whitfield Household', type: 'Account' }
    ],
    tasksCompleted: 2,
    tasksTotal: 5,
    tasks: [
      {
        id: 'whit-auto-t1',
        name: 'Pull MVR for Chloe Whitfield',
        owner: 'Elena Rostova',
        ownerInitials: 'ER',
        dueDate: 'Sep 2, 2026',
        status: 'Completed'
      },
      {
        id: 'whit-auto-t2',
        name: 'Price a $1M personal umbrella with the teen driver rated',
        owner: 'Agentforce',
        ownerInitials: 'AF',
        dueDate: 'Sep 2, 2026',
        status: 'Completed'
      },
      {
        id: 'whit-auto-t3',
        name: 'Build three-carrier comparison at matching limits',
        owner: 'Agentforce',
        ownerInitials: 'AF',
        dueDate: 'Sep 3, 2026',
        status: 'Ready for Review'
      },
      {
        id: 'whit-auto-t4',
        name: 'Confirm Ioniq 5 garaging address and annual mileage',
        owner: 'Whitfield Household',
        ownerInitials: 'WH',
        dueDate: 'Sep 4, 2026',
        status: 'Pending'
      },
      {
        id: 'whit-auto-t5',
        name: 'Re-rate with the F-150 moved to pleasure use',
        owner: 'Underwriting',
        ownerInitials: 'UW',
        dueDate: 'Sep 8, 2026',
        status: 'Blocked'
      }
    ],
    brief: {
      sections: [
        {
          id: 'whit-auto-bs1',
          heading: 'Since Last Meeting',
          body: 'Last contact was the Q2 household coverage check-in on July 9, 2026 - 54 days ago. Daniel confirmed then that Chloe had passed her test and that the Ioniq 5 had replaced the second family car, and he mentioned a direct-writer quote he had been sent. He asked to see how it compared before the October renewal. No other commitments were carried out of that call.'
        },
        {
          id: 'whit-auto-bs2',
          heading: 'Policies in Force',
          body: 'Personal Auto: $3,140 expiring premium, renews October 15, 2026. Homeowners on 4118 Siesta Key Dr, Sarasota renews the following February. Household premium totals $9.8K across the two lines, with a multi-policy credit applied on both. Three vehicles rated on auto - 2023 Subaru Outback Premium, 2025 Hyundai Ioniq 5 SEL, and 2019 Ford F-150 XLT. No personal umbrella has ever been written on this household.'
        },
        {
          id: 'whit-auto-bs3',
          heading: "What's Changed",
          body: 'Gulfstream Mutual returned the renewal at $3,730, a 19% increase on the expiring premium. Chloe Whitfield was licensed in May 2026 and added as an occasional driver on the Outback, and the Ioniq 5 was added in June as a third rated vehicle. The at-fault collision from February 2026 closed at $8,400 and remains inside the rating period. The direct-writer quote Daniel is holding excludes the homeowners credit and carries lower liability limits.'
        }
      ],
      suggestedAgenda: [
        'Confirm which household members are driving which of the three vehicles.',
        'Split the 19% increase into the new driver, the third vehicle, and the closed claim.',
        'Compare the direct-writer quote against our renewal at matching limits.',
        'Make the case for a $1M personal umbrella now that a teen driver is rated.'
      ],
      meetingPriorities: [
        "Explain the rating impact of Chloe's license and the Ioniq 5 before defending the premium.",
        'Neutralise the direct-writer quote by restating it at matching limits.',
        'Close the umbrella gap while the teen driver makes the need concrete.'
      ]
    }
  },
  discussionGuide: {
    createdAt: '2026-09-01T09:52:00Z',
    intro:
      'Sixty minutes with Daniel. The first half explains where the 19% came from; the competitor quote only gets addressed once he can see that the new driver and the third vehicle are doing most of the work.',
    topics: [
      {
        id: 'wdg-1',
        window: '0-10 min',
        title: 'Reconnect and confirm the household',
        prompt:
          'Acknowledge the 54-day gap. Confirm Chloe is driving the Outback and that the Ioniq 5 replaced the second family car.'
      },
      {
        id: 'wdg-2',
        window: '10-25 min',
        title: 'Walk through the renewal increase',
        prompt:
          'Split the 19% into the new driver, the third vehicle, and the closed claim. Show him the number he would have seen without the first two.'
      },
      {
        id: 'wdg-3',
        window: '25-40 min',
        title: 'Address the direct-writer quote',
        prompt:
          'Restate the competitor number at our limits and with the homeowners credit applied. Let the gap close itself rather than arguing the headline.'
      },
      {
        id: 'wdg-4',
        window: '40-55 min',
        title: 'Make the umbrella case',
        prompt:
          'A teen driver behind $9.8K of household premium and no umbrella. Price $1M and frame it against the collision claim they have already had.'
      },
      {
        id: 'wdg-5',
        window: '55-60 min',
        title: 'Confirm next steps',
        prompt:
          'Agree whether to bind Gulfstream or go to market, and whether the umbrella goes out with the renewal.'
      }
    ]
  },
  sessionNotes: {
    prompt:
      'Join video and voice calls. Capture audio or type notes from your device.',
    placeholder:
      'Type your notes here. Agentforce folds them into the follow-up summary when the meeting wraps.'
  },
  followUp: {
    createdAt: '2026-09-01T11:12:00Z',
    recap:
      'Daniel dropped the direct-writer comparison as soon as he saw it restated at matching limits without the homeowners credit. He accepted the driver and vehicle explanation, but still wants the renewal shopped so he can see the market for himself. The umbrella landed better than expected once it was framed against the collision they had already had, and he asked for it to be quoted alongside the renewal rather than at homeowners time.',
    decisions: [
      'Shop the auto renewal across the market, with Gulfstream Mutual included in the comparison.',
      'Chloe stays rated as an occasional driver on the Outback.',
      '$1M personal umbrella to be quoted alongside the renewal, not deferred to February.',
      'F-150 to be re-rated on pleasure use before any bind decision.'
    ]
  }
};

const _bluebirdFleetPrep = {
  meetingId: 'mp-bluebird-fleet',
  agency: 'Bluebird Logistics',
  draftCreatedAt: '2026-09-01T07:40:00Z',
  draft: {
    intro:
      'This 12:30 PM call with Renee Alvarez is the renewal strategy session on the 2026 fleet and workers comp program, which expires November 1. Great Lakes Casualty has come back 18% up at $575K, and the experience mod moving from 0.98 to 1.24 explains the workers comp half of that on its own.',
    bookAtAGlance: [
      '$487K expiring program across commercial auto, workers comp, and general liability.',
      '$575K on the Great Lakes Casualty renewal indication - an 18% increase.',
      'Experience mod climbed from 0.98 to 1.24 after two lost-time injuries in the term.',
      '18 power units and 24 employees, with no telematics and no formal return-to-work programme.'
    ],
    whyItMatters:
      'The workers comp increase is arithmetic rather than a carrier decision, and saying so early moves the conversation from negotiation to remediation. The mod is what it is until the loss experience rolls off, but there is a credit story available in telematics and a return-to-work programme that nobody has offered yet. Commercial auto is a different problem: two at-fault losses and a slipping DOT safety score make it the line worth marketing, while workers comp is the line worth keeping in place so the mod recovery lands with the incumbent.',
    openerCopy:
      'Open on the mod worksheet, not the premium. Renee is operational and will accept a number she can trace. Bring the loss-control package out as the path back to a credit, and separate the commercial auto decision from the workers comp one so the two do not get traded against each other.'
  },
  sources: [
    { id: 'src-bb-lossrun', label: 'Loss runs 2023-2026 - all lines',            type: 'Loss run',             href: '#' },
    { id: 'src-bb-mod',     label: 'Experience rating worksheet (mod 1.24)',     type: 'Loss rating',          href: '#' },
    { id: 'src-bb-dot',     label: 'FMCSA safety profile - Unsafe Driving',      type: 'Safety record',        href: '#' },
    { id: 'src-bb-book',    label: 'Bluebird Logistics book snapshot',           type: 'Revenue Intelligence', href: '#' }
  ],
  summary: {
    metrics: [
      { id: 'bm-1', label: 'Renewal Change', value: '+18%', delta: 'vs expiring', dir: 'up' },
      { id: 'bm-2', label: 'Program Premium', value: '$487K', delta: '3 lines' },
      { id: 'bm-3', label: 'Days to Expiry', value: '61', delta: 'Nov 1, 2026' }
    ],
    keyConcerns: [
      'Experience mod moved from 0.98 to 1.24, which drives the workers comp increase on its own.',
      'Two at-fault auto losses totalling $214K incurred sit inside the experience period.',
      'DOT Unsafe Driving BASIC has slipped to the 68th percentile and is drawing carrier scrutiny.',
      'No telematics and no return-to-work programme, so there is no credit story on the table yet.'
    ],
    talkingPoints: [
      'Open on the mod worksheet so the workers comp increase reads as arithmetic.',
      'Present telematics and return-to-work as the documented path back to a credit.',
      'Market commercial auto; hold workers comp with Great Lakes to protect the mod recovery.',
      'Confirm the two owner-operators\u2019 status before the census goes to market.'
    ]
  },
  agentforceActions: [
    {
      id: 'ba1',
      label: 'Market commercial auto only',
      detail: 'Builds an RFQ on the fleet schedule and loss runs, leaving workers comp in place.',
      checked: true
    },
    {
      id: 'ba2',
      label: 'Model the mod recovery over three years',
      detail: 'Projects the premium path as the two lost-time claims roll out of the experience period.',
      checked: true
    },
    {
      id: 'ba3',
      label: 'Draft the loss-control credit proposal',
      detail: 'Packages telematics and return-to-work into a schedule-credit ask with expected impact.',
      checked: false
    }
  ],
  prepTasks: [
    {
      id: 'bt1',
      task: 'Pull three-year loss runs on all three lines',
      owner: 'Elena Rostova',
      role: 'Account Manager',
      status: 'Completed'
    },
    {
      id: 'bt2',
      task: 'Verify the experience mod worksheet with the rating bureau',
      owner: 'James Field',
      role: 'Producer',
      status: 'Completed'
    },
    {
      id: 'bt3',
      task: 'Build the telematics and return-to-work credit proposal',
      owner: 'Agentforce',
      role: 'AI Assistant',
      status: 'Completed'
    },
    {
      id: 'bt4',
      task: 'Confirm driver roster and owner-operator status',
      owner: 'Bluebird Logistics',
      role: 'Customer',
      status: 'Completed'
    }
  ],
  documents: [
    {
      id: 'bdoc-1',
      name: '2026 Bluebird program summary - Great Lakes.pdf',
      kind: 'PDF',
      meta: '1.8 MB · Added Aug 20 by Elena Rostova'
    },
    {
      id: 'bdoc-2',
      name: 'Experience rating worksheet - mod 1.24.pdf',
      kind: 'PDF',
      meta: '410 KB · Added Aug 24 by Elena Rostova'
    },
    {
      id: 'bdoc-3',
      name: 'Bluebird loss-control proposal.xlsx',
      kind: 'XLS',
      meta: '520 KB · Added Aug 27 by Agentforce'
    }
  ],
  preMeeting: {
    updatedAt: 'Last updated at 7:40 AM by Agentforce.',
    lead: 'Renee Alvarez, Operations Director, $487K program premium, 3 lines in force',
    bullets: [
      _bullet('bb-fleet-sb1', 'Program', [
        ['Three lines in force: Commercial Auto', '1'],
        [' at $318K, Workers Compensation', '2'],
        [' at $121K, and General Liability', '3'],
        [
          ' at $48K, all renewing November 1. Eighteen power units on the fleet schedule',
          '8'
        ],
        [' and 24 employees on the census.']
      ]),
      _bullet('bb-fleet-sb2', 'Renewal Context', [
        ['Great Lakes Casualty returned the program 18% up at $575K', '5'],
        ['. The experience mod moved from 0.98 to 1.24', '4'],
        [
          ' on the current worksheet, which accounts for the workers comp share of the increase without any judgement rating applied.'
        ]
      ]),
      _bullet('bb-fleet-sb3', 'Loss Drivers', [
        ['Two lost-time injuries and two at-fault auto losses in the term', '6'],
        [
          ', $214K incurred on the auto side. The Unsafe Driving BASIC has slipped to the 68th percentile',
          '7'
        ],
        [', which is what carriers are reacting to first.']
      ]),
      _bullet('bb-fleet-sb4', 'Sentiment', [
        [
          'Seven years with Great Lakes across the whole program and no coverage disputes. Renee is operational rather than price-led and will accept a number she can trace to a worksheet.',
          '9'
        ]
      ]),
      _bullet('bb-fleet-sb5', 'Producer Priority', [
        ['Market commercial auto on the fleet schedule and loss runs', '1'],
        [
          ', hold workers comp with the incumbent so the mod recovery lands there, and put the telematics and return-to-work package on the table as the documented credit ask.'
        ]
      ])
    ],
    citedSources: [
      { id: 'bbc-1', n: 1, name: '2026 Commercial Auto - Bluebird Logistics',        type: 'Policy' },
      { id: 'bbc-2', n: 2, name: '2026 Workers Compensation - Bluebird Logistics',   type: 'Policy' },
      { id: 'bbc-3', n: 3, name: '2026 General Liability - Bluebird Logistics',      type: 'Policy' },
      { id: 'bbc-4', n: 4, name: 'Experience rating worksheet - mod 1.24',           type: 'Loss Rating' },
      { id: 'bbc-5', n: 5, name: 'Great Lakes Casualty renewal indication - $575K',  type: 'Renewal Quote' },
      { id: 'bbc-6', n: 6, name: 'Loss runs 2023-2026 - all lines',                  type: 'Loss Run' },
      { id: 'bbc-7', n: 7, name: 'FMCSA safety profile - Unsafe Driving BASIC',      type: 'Safety Record' },
      { id: 'bbc-8', n: 8, name: 'Fleet schedule - 18 power units',                  type: 'Equipment Schedule' },
      { id: 'bbc-9', n: 9, name: 'Q2 Fleet Safety Review',                           type: 'Interaction Summary' }
    ],
    references: [
      { id: 'bbr-1', name: 'Renee Alvarez',      type: 'Contact' },
      { id: 'bbr-2', name: 'Tom Ficarra',        type: 'Contact' },
      { id: 'bbr-3', name: 'Bluebird Logistics', type: 'Account' }
    ],
    tasksCompleted: 4,
    tasksTotal: 4,
    tasks: [
      {
        id: 'bb-fleet-t1',
        name: 'Pull three-year loss runs on all three lines',
        owner: 'Elena Rostova',
        ownerInitials: 'ER',
        dueDate: 'Aug 24, 2026',
        status: 'Completed'
      },
      {
        id: 'bb-fleet-t2',
        name: 'Verify the experience mod worksheet with the rating bureau',
        owner: 'James Field',
        ownerInitials: 'JF',
        dueDate: 'Aug 26, 2026',
        status: 'Completed'
      },
      {
        id: 'bb-fleet-t3',
        name: 'Build the telematics and return-to-work credit proposal',
        owner: 'Agentforce',
        ownerInitials: 'AF',
        dueDate: 'Aug 27, 2026',
        status: 'Completed'
      },
      {
        id: 'bb-fleet-t4',
        name: 'Confirm driver roster and owner-operator status',
        owner: 'Bluebird Logistics',
        ownerInitials: 'BL',
        dueDate: 'Aug 28, 2026',
        status: 'Completed'
      }
    ],
    brief: {
      sections: [
        {
          id: 'bb-fleet-bs1',
          heading: 'Since Last Meeting',
          body: 'Last contact was the Q2 fleet safety review on August 6, 2026 - 26 days ago, inside the cadence for this tier. Renee walked through both lost-time injuries and agreed in principle that a return-to-work programme was overdue. Tom Ficarra was named as the internal owner for safety. Prep on this renewal is complete: all four preparation tasks closed ahead of the call.'
        },
        {
          id: 'bb-fleet-bs2',
          heading: 'Program in Force',
          body: 'Commercial Auto: $318K expiring, 18 power units and 22 rated drivers. Workers Compensation: $121K expiring across a 24-employee census, class-rated on local trucking and warehouse codes. General Liability: $48K expiring. All three renew November 1, 2026 with Great Lakes Casualty, which has held the whole program for seven years. Program premium totals $487K.'
        },
        {
          id: 'bb-fleet-bs3',
          heading: "What's Changed",
          body: 'Great Lakes Casualty returned the program at $575K, an 18% increase. The experience modifier moved from 0.98 to 1.24 following two lost-time injuries, a warehouse lift strain and a backing incident. Two at-fault auto losses in the term carry $214K incurred. The FMCSA Unsafe Driving BASIC has slipped to the 68th percentile. No telematics is installed on the fleet and no formal return-to-work programme is in place, so no schedule credit has been requested.'
        }
      ],
      suggestedAgenda: [
        'Walk the experience mod worksheet line by line before discussing premium.',
        'Separate the commercial auto decision from the workers comp decision.',
        'Present the telematics and return-to-work package as the credit ask.',
        'Agree the marketing scope and the census corrections needed before it goes out.'
      ],
      meetingPriorities: [
        'Establish the workers comp increase as arithmetic, traceable to the mod worksheet.',
        'Hold workers comp with Great Lakes so the mod recovery lands with the incumbent.',
        'Secure commitment to telematics and return-to-work as the documented credit path.'
      ]
    }
  },
  discussionGuide: {
    createdAt: '2026-09-01T09:20:00Z',
    intro:
      'Sixty minutes with Renee and Tom. The mod worksheet comes first because it removes the argument; the rest of the hour is about what Bluebird can change before November and what we take to market.',
    topics: [
      {
        id: 'bdg-1',
        window: '0-10 min',
        title: 'Reconnect and confirm the safety owner',
        prompt:
          'Pick up from the August fleet safety review. Confirm Tom owns safety internally and that both injured employees are back at work.'
      },
      {
        id: 'bdg-2',
        window: '10-25 min',
        title: 'Walk the experience mod worksheet',
        prompt:
          'Show the move from 0.98 to 1.24 claim by claim. Establish that the workers comp increase is arithmetic before any premium discussion.'
      },
      {
        id: 'bdg-3',
        window: '25-40 min',
        title: 'Split the two decisions',
        prompt:
          'Commercial auto goes to market on the fleet schedule and loss runs. Workers comp stays put so the mod recovery lands with Great Lakes.'
      },
      {
        id: 'bdg-4',
        window: '40-55 min',
        title: 'Present the loss-control credit ask',
        prompt:
          'Telematics on all 18 units plus a written return-to-work programme, packaged as a schedule-credit request with expected impact.'
      },
      {
        id: 'bdg-5',
        window: '55-60 min',
        title: 'Confirm next steps',
        prompt:
          'Agree the marketing scope, who owns the census corrections, and a date for the telematics decision.'
      }
    ]
  },
  sessionNotes: {
    prompt:
      'Join video and voice calls. Capture audio or type notes from your device.',
    placeholder:
      'Type your notes here. Agentforce folds them into the follow-up summary when the meeting wraps.'
  },
  followUp: {
    createdAt: '2026-09-01T13:35:00Z',
    recap:
      'Renee accepted the workers comp increase once the mod worksheet was walked claim by claim, and agreed that marketing that line would only reset the relationship without changing the number. Commercial auto is going to market. Telematics landed as an operational decision rather than an insurance one, and Tom will scope installation across all 18 units. Both agreed the return-to-work programme has to be written before the credit ask carries any weight.',
    decisions: [
      'Market commercial auto only; workers comp stays with Great Lakes through the mod recovery.',
      'Telematics to be scoped across all 18 power units, with Tom Ficarra owning installation.',
      'Written return-to-work programme to be drafted before the schedule-credit ask goes in.',
      'Census corrections to be returned before the commercial auto submission goes out.'
    ]
  }
};

// Keyed by the playbook the broker clicked on Home.
// The Mavericks playbooks stay mapped even though neither is on today's
// carousel, so an older `?meeting=mp-mavericks-*` link still resolves.
export const meetingPrepById = {
  'mp-whitfield-auto-renewal': _whitfieldAutoPrep,
  'mp-bluebird-fleet': _bluebirdFleetPrep,
  'mp-acme-renewal': _acmeMedicalPrep,
  'mp-mavericks-auto-renewal': _mavericksAutoPrep,
  'mp-mavericks-umbrella': _mavericksUmbrellaPrep
};

// The playbook to fall back on when a meeting has no prep of its own -
// chosen by the account the meeting is against, never by position. This
// map is the reason a booked meeting describes the right client: the
// lookup below used to end in `|| _whitfieldAutoPrep`, so every meeting
// the broker scheduled during a session - and both `mp-dummy-*`
// companions - opened with Daniel Whitfield's brief regardless of whose
// account it sat on.
// Each of these accounts carries a single line, so the account on its own
// identifies the playbook. Mavericks is deliberately absent: it is the one
// multi-line household in the demo, so its fallback has to consider the line
// too and is resolved by MAVERICKS_LINE_PREP below. Listing it here is what
// made a Homeowners meeting open the auto renewal playbook.
const ACCOUNT_DEFAULT_PREP = {
  '001EB00002pYzbMAC': _acmeMedicalPrep,
  'a-whitfield': _whitfieldAutoPrep,
  'a-bluebird': _bluebirdFleetPrep
};

// The Mavericks playbooks that exist, by the line they are written about.
// Homeowners, Personal Umbrella and Renters have no renewal playbook of their
// own, so they fall through to a generated brief built against the right line
// rather than borrowing the auto one.
const MAVERICKS_LINE_PREP = {
  'Personal Auto': _mavericksAutoPrep,
  Household: _mavericksUmbrellaPrep
};

// The person a proposal is emailed to, whose reply comes back, and who
// is named in the resulting meeting's brief. One entry per account so
// those three surfaces cannot disagree - the email recipient used to be
// hardcoded to James Mavericks on every account.
export const ACCOUNT_PRINCIPALS = {
  '001SB00001oXwntYAC': {
    name: 'James Mavericks',
    email: 'james.mavericks@example.com',
    initials: 'JM',
    descriptor: 'James Mavericks, 52, $19.6K household premium, 3 policies in force',
    accountLabel: 'Mavericks Household',
    others: ['Emily Mavericks']
  },
  'a-whitfield': {
    name: 'Daniel Whitfield',
    email: 'daniel.whitfield@example.com',
    initials: 'DW',
    descriptor: 'Daniel Whitfield, 46, $9.8K household premium, 2 policies in force',
    accountLabel: 'Whitfield Household',
    others: ['Erin Whitfield']
  },
  '001EB00002pYzbMAC': {
    name: 'Marco Diaz',
    email: 'marco.diaz@acmemfg.example.com',
    initials: 'MD',
    descriptor: 'Marco Diaz, HR Director, $612K expiring premium, 50 employees',
    accountLabel: 'Acme Manufacturing',
    others: []
  },
  'a-bluebird': {
    name: 'Renee Alvarez',
    email: 'renee.alvarez@bluebirdlogistics.example.com',
    initials: 'RA',
    descriptor: 'Renee Alvarez, Operations Director, $487K program premium, 3 lines in force',
    accountLabel: 'Bluebird Logistics',
    others: []
  }
};

export function getAccountPrincipal(accountId) {
  return ACCOUNT_PRINCIPALS[accountId] || null;
}

// Prep built during the session for meetings the broker books off a
// client reply. Keyed by the new `mp-scheduled-*` id, which by
// definition is not in `meetingPrepById`.
const _runtimePrepById = {};

export function registerMeetingPrep(meetingId, prep) {
  if (!meetingId || !prep) return null;
  _runtimePrepById[meetingId] = prep;
  return prep;
}

export function getMeetingPrep(meetingId, accountId) {
  if (meetingId && _runtimePrepById[meetingId]) {
    return _runtimePrepById[meetingId];
  }
  if (meetingPrepById[meetingId]) return meetingPrepById[meetingId];

  // Resolve by account, taking the id off the carousel row when the
  // caller did not pass one (deep-links carry only `?meeting=`).
  const row = runMyDayMeetings.find((m) => m.id === meetingId);
  const acct = accountId || row?.accountId;

  // Mavericks carries four lines, so the account alone does not say which
  // renewal the broker is walking into. Classify the meeting the same way the
  // Slack channel does, so both surfaces agree on what the meeting is about.
  if (acct === MAVERICKS_ACCOUNT_ID) {
    const line = mavericksMeetingLine(row || { id: meetingId });
    if (MAVERICKS_LINE_PREP[line]) return MAVERICKS_LINE_PREP[line];
    return buildProposalReviewPrep({
      meetingId,
      accountId: acct,
      accountName: row?.relatedRecord || 'Mavericks Household',
      lineLabel: line,
      startTime: row?.startTime,
      subject: row?.eventSubject
    });
  }

  if (ACCOUNT_DEFAULT_PREP[acct]) return ACCOUNT_DEFAULT_PREP[acct];

  // Last resort for an account with no playbook: a generated brief that
  // at least names the right client. c-meeting-center reads the prep
  // shape without guarding every branch, so this must be a full object.
  return buildProposalReviewPrep({
    meetingId,
    accountId: acct,
    accountName: row?.relatedRecord || 'this account'
  });
}

function _prepDate(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return String(iso);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[m - 1]} ${d}, ${y}`;
}

function _money(n) {
  if (!Number.isFinite(n)) return null;
  return `$${n.toLocaleString('en-US')}`;
}

function _compactMoney(n) {
  if (!Number.isFinite(n)) return null;
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n}`;
}

// A meeting booked off a client reply is a different conversation from
// the renewal playbooks above: the comparison has already gone out, the
// client has read it, and they came back with questions. So the brief is
// generated from the account's own book rather than reusing a renewal
// playbook whose copy is about presenting an increase.
//
// Everything account-specific comes from the account's Client 360 book
// and its principal contact, so the same builder produces a correct
// brief for any of the four accounts.
// What the proposal review is actually about, per line of coverage.
//
// The line used to appear only as a word substituted into otherwise identical
// copy, so a Homeowners review and an Auto review asked the same question
// ('does the deductible apply per claim or annually') and carried the same
// tasks. Each entry below is the coverage question that genuinely holds up a
// bind on that line, and the work that answers it.
const PROPOSAL_REVIEW_BY_LINE = {
  'Personal Auto': {
    coverageQuestion: 'whether the collision deductible applies per vehicle or once per occurrence',
    coverageTopic: 'Collision deductible',
    coveragePrompt:
      'Read the per-vehicle wording straight off the quote so there is no ambiguity at first loss.',
    coverageTask: 'Confirm the collision deductible basis in the quote',
    verifyTask: 'Check every rated vehicle and driver carried across to the quote',
    coverageNote: 'the collision deductible and the rated driver schedule are what the comparison turned on',
    stallRisk:
      'A vehicle or driver that did not carry across reprices the policy after bind, so the schedule has to be checked against the quote before the date is agreed.'
  },
  Homeowners: {
    coverageQuestion:
      'whether the wind and hail deductible is a flat amount or a percentage of the dwelling limit',
    coverageTopic: 'Wind and hail deductible',
    coveragePrompt:
      'Read the percentage off the quote and convert it to dollars against the dwelling limit, so the number is concrete rather than abstract.',
    coverageTask: 'Confirm the wind and hail deductible basis in the quote',
    verifyTask: 'Check the dwelling limit against the replacement-cost estimate',
    coverageNote: 'the dwelling limit and the wind and hail deductible are what the comparison turned on',
    stallRisk:
      'A percentage wind and hail deductible reads small until it is converted against the dwelling limit, so put the dollar figure on the table before asking for a decision.'
  },
  'Personal Umbrella': {
    coverageQuestion:
      'whether the underlying auto and homeowners limits still satisfy the carrier attachment point',
    coverageTopic: 'Underlying limits',
    coveragePrompt:
      'Read the required underlying limits off the quote and check them against what the auto and homeowners policies actually carry today.',
    coverageTask: 'Confirm the required underlying limits in the quote',
    verifyTask: 'Check the underlying auto and homeowners limits against the attachment point',
    coverageNote: 'the attachment point and the underlying limits are what the comparison turned on',
    stallRisk:
      'An umbrella written over underlying limits that do not meet the attachment point leaves a gap exactly where the client believes they are covered, so the underlying limits have to be confirmed before bind.'
  },
  Renters: {
    coverageQuestion: 'whether personal property is settled at replacement cost or actual cash value',
    coverageTopic: 'Personal property settlement',
    coveragePrompt:
      'Read the settlement basis off the quote, because replacement cost and actual cash value pay very differently on the same loss.',
    coverageTask: 'Confirm the personal-property settlement basis in the quote',
    verifyTask: 'Check the personal-property limit against the contents schedule',
    coverageNote: 'the personal-property limit and its settlement basis are what the comparison turned on',
    stallRisk:
      'Actual cash value on contents pays materially less than replacement cost on the same loss, so the basis has to be stated plainly before a decision.'
  },
  'Group Medical': {
    coverageQuestion: 'whether the deductible accumulates per employee or per family',
    coverageTopic: 'Deductible accumulation',
    coveragePrompt:
      'Read the per-employee versus per-family wording off the quote, then show what it means for a family of four.',
    coverageTask: 'Confirm the deductible accumulation basis in the quote',
    verifyTask: 'Reconcile the census against the current enrollment file',
    coverageNote:
      'the deductible accumulation basis and the census the rate is held against are what the comparison turned on',
    stallRisk:
      'The rate is held against the census as filed, so any headcount change before the effective date reopens the premium.'
  },
  'Group Dental': {
    coverageQuestion: 'whether the annual maximum resets on the plan year or the member anniversary',
    coverageTopic: 'Annual maximum',
    coveragePrompt:
      'Read the reset wording off the quote so employees are told the right month.',
    coverageTask: 'Confirm the annual maximum reset basis in the quote',
    verifyTask: 'Check the waiting periods on major services',
    coverageNote:
      'the annual maximum and the waiting periods on major services are what the comparison turned on',
    stallRisk:
      'A member-anniversary reset changes what an employee can claim in the first year, so it has to be settled before it reaches the enrollment material.'
  }
};

// For a line with no entry above. Keeps the generic deductible question the
// builder shipped with, so an unmapped line still reads as a coherent review.
const PROPOSAL_REVIEW_DEFAULT = {
  coverageQuestion: 'whether the deductible applies per claim or annually',
  coverageTopic: 'Deductible basis',
  coveragePrompt:
    'Read the per-claim wording straight from the quote so there is no ambiguity later.',
  coverageTask: 'Confirm the deductible basis in the quote',
  verifyTask: 'Prepare the bind request',
  coverageNote: null,
  stallRisk: null
};

export function buildProposalReviewPrep(ctx = {}) {
  const {
    meetingId,
    accountId,
    accountName,
    attendee,
    leadCarrier,
    lineLabel,
    startTime,
    subject
  } = ctx;

  const principal = getAccountPrincipal(accountId);
  const client = attendee || principal?.name || 'the client';
  const first = client.split(' ')[0];
  const account = accountName || principal?.accountLabel || 'the account';
  const carrier = leadCarrier || 'the recommended carrier';
  // When no carrier has been selected yet - prep generated for a meeting that
  // never went through the proposal flow - `carrier` is a placeholder phrase
  // rather than a name. These forms keep it readable in the three positions
  // where a bare lowercase phrase reads as an unresolved token: the start of a
  // sentence, a standalone title, and a filename.
  const carrierCap = carrier.charAt(0).toUpperCase() + carrier.slice(1);
  const carrierQuote = leadCarrier ? `${leadCarrier} quote` : 'Recommended carrier quote';
  const carrierQuoteDoc = leadCarrier ? `${leadCarrier} quote.pdf` : 'Recommended carrier quote.pdf';
  // The placeholder already carries its own article, so `the ${carrier}` would
  // read "the the recommended carrier". Use this wherever the phrase needs a
  // definite article in front of it.
  const theCarrier = leadCarrier ? `the ${leadCarrier}` : carrier;
  const line = lineLabel || 'Personal Auto';
  const when = startTime ? `${startTime} ` : '';

  const book = accountId ? getClient360(accountId) : null;
  const policies = book?.policies || [];
  // Added up from the policy rows, the same way the Client 360 tiles
  // do, so the brief and the dashboard cannot quote different totals
  // for the same account.
  const premium = policies.reduce(
    (total, p) => total + (Number(p.premium) || 0),
    0
  );
  const policyCount = policies.length;
  const nextRenewal = (book?.renewals || [])[0];
  const openClaim = (book?.claims || []).find((c) => c.status !== 'Closed');
  const bookLabel = _compactMoney(premium);

  const at = (n) => `${meetingId || 'mp-review'}-${n}`;

  // The two questions come from the reply the broker just read, so the brief
  // opens on them rather than on the comparison. The first is the coverage
  // question that line actually turns on; the second is named against the
  // account's own next renewal rather than a generic 'other <line> renewal'.
  const spec = PROPOSAL_REVIEW_BY_LINE[line] || PROPOSAL_REVIEW_DEFAULT;
  const topic = spec.coverageTopic;
  const topicLower = topic.toLowerCase();
  const q1 = spec.coverageQuestion;
  const q2 = nextRenewal
    ? `whether the effective date can move to line up with ${nextRenewal.name}`
    : 'whether the effective date can move to line up with the rest of the account';

  const bookAtAGlance = [
    `${carrierCap} is the option ${first} picked out of the comparison, on coverage rather than price.`,
    `${first} has two open questions before binding: ${q1}, and ${q2}.`,
    bookLabel && policyCount
      ? `${bookLabel} of annual premium across ${policyCount} ${policyCount === 1 ? 'line' : 'lines'} on this account.`
      : `${account} is the account of record for this submission.`,
    nextRenewal
      ? `Closest renewal is ${nextRenewal.name} on ${_prepDate(nextRenewal.expirationDate)}.`
      : 'No other renewal falls inside the effective-date window.',
    openClaim
      ? `${openClaim.type} claim ${openClaim.name} is still ${String(openClaim.status).toLowerCase()} and travels with the policy.`
      : 'No open claims on the account to disclose at bind.'
  ].filter(Boolean);

  return {
    meetingId: meetingId || 'mp-review',
    agency: account,
    draftCreatedAt: today().toISOString(),
    draft: {
      intro:
        `This ${when}call with ${client} is the proposal review on the ${line} ` +
        `submission, not a presentation - ${first} has already read the ` +
        `comparison and come back naming ${carrier} as the closest fit. The ` +
        `reply raises two things that have to be answered before anything ` +
        `binds: ${q1}, and ${q2}.`,
      bookAtAGlance,
      whyItMatters:
        `${first} has effectively pre-selected a carrier, so this call is ` +
        `about clearing the two conditions attached to that choice rather ` +
        `than re-opening the comparison. Both are answerable from the quote ` +
        `documents. Get them settled on the call and the submission binds ` +
        `on ${carrier}; leave either open and the decision slips past the ` +
        `effective date` +
        (bookLabel
          ? `, with ${bookLabel} of account premium exposed to a gap.`
          : '.'),
      openerCopy:
        `Open by confirming ${carrier} rather than re-walking the options - ` +
        `${first} has already made that call. Take the ${topicLower} question ` +
        `first because it is a straight read from the quote, then the ` +
        `effective date, which is the one that needs a carrier confirmation.`
    },
    sources: [
      {
        id: at('src-1'),
        label: subject ? `Proposal sent - ${subject}` : `${line} proposal - ${account}`,
        type: 'Sent proposal',
        href: '#'
      },
      { id: at('src-2'), label: `${client} reply`, type: 'Inbound email', href: '#' },
      { id: at('src-3'), label: carrierQuote, type: 'Carrier quote', href: '#' },
      { id: at('src-4'), label: `${account} book snapshot`, type: 'Client 360', href: '#' }
    ],
    summary: {
      metrics: [
        { id: at('mm-1'), label: 'Lead Carrier', value: carrierCap, delta: 'client selected' },
        {
          id: at('mm-2'),
          label: 'Account Premium',
          value: bookLabel || '-',
          delta: policyCount ? `${policyCount} ${policyCount === 1 ? 'line' : 'lines'}` : ''
        },
        { id: at('mm-3'), label: 'Open Questions', value: '2', delta: 'before bind' }
      ],
      keyConcerns: [
        `${topic} is unconfirmed - ${first} asked ${q1}.`,
        nextRenewal
          ? `Effective date may need to move to align with ${nextRenewal.name}.`
          : 'Effective date may need to move to align with the rest of the account.',
        openClaim
          ? `${openClaim.type} claim ${openClaim.name} is open and has to be disclosed at bind.`
          : `No open claims, so nothing blocks the bind on the loss side.`,
        spec.stallRisk ||
          `${carrierCap} was chosen on coverage, so any premium renegotiation risks the reason for the choice.`
      ],
      talkingPoints: [
        `Confirm ${carrier} up front so the call starts from the decision, not the comparison.`,
        `Read the ${topicLower} straight from the quote rather than describing it.`,
        `Treat the effective date as a carrier question and commit to a same-day answer.`,
        'Close by naming what happens next and who owns it.'
      ]
    },
    agentforceActions: [
      {
        id: at('aa1'),
        label: `Pull the ${topicLower} from the quote`,
        detail: `Locates the ${topicLower} wording in ${theCarrier} quote and quotes it verbatim.`,
        checked: true
      },
      {
        id: at('aa2'),
        label: 'Check the effective-date alignment',
        detail: nextRenewal
          ? `Compares the requested date against ${nextRenewal.name}.`
          : 'Compares the requested date against the rest of the account.',
        checked: false
      },
      {
        id: at('aa3'),
        label: 'Draft the bind request',
        detail: `Pre-fills ${theCarrier} bind request so it can go out on the call.`,
        checked: false
      }
    ],
    prepTasks: [
      {
        id: at('t1'),
        task: spec.coverageTask,
        owner: 'James Field',
        role: 'Producer',
        status: 'Completed'
      },
      {
        id: at('t2'),
        task: `Ask ${carrier} to confirm the revised effective date`,
        owner: 'Elena Rostova',
        role: 'Account Manager',
        status: 'In Progress'
      },
      {
        id: at('t3'),
        task: spec.verifyTask,
        owner: 'Agentforce',
        role: 'AI Assistant',
        status: 'Ready for Review'
      }
    ],
    documents: [
      {
        id: at('doc-1'),
        name: 'QuoteComparison.pdf',
        kind: 'PDF',
        meta: `Sent to ${client}`
      },
      {
        id: at('doc-2'),
        name: carrierQuoteDoc,
        kind: 'PDF',
        meta: 'Carrier document'
      }
    ],
    preMeeting: {
      updatedAt: 'Generated by Agentforce from the client reply.',
      lead:
        principal?.descriptor ||
        `${client}${bookLabel ? `, ${bookLabel} account premium` : ''}${
          policyCount ? `, ${policyCount} ${policyCount === 1 ? 'policy' : 'policies'} in force` : ''
        }`,
      bullets: [
        _bullet(at('sb1'), 'Decision', [
          [`${first} named ${carrier}`, '3'],
          [
            ` as the closest fit out of the comparison we sent`,
            '1'
          ],
          ['. The choice was made on coverage, not premium.']
        ]),
        spec.coverageNote &&
          _bullet(at('sb-cov'), 'Coverage', [
            [`On ${line}, ${spec.coverageNote}`, '3'],
            ['. That is the figure to have in front of you before the call.']
          ]),
        _bullet(at('sb2'), 'Open Questions', [
          [`The reply`, '2'],
          [
            ` asks ${q1}, and ${q2}. Both are answerable before the call ends.`
          ]
        ]),
        _bullet(at('sb3'), 'Account', [
          [
            bookLabel && policyCount
              ? `${account} carries ${bookLabel} across ${policyCount} ${
                  policyCount === 1 ? 'line' : 'lines'
                }`
              : `${account} is the account of record`,
            '4'
          ],
          [
            openClaim
              ? `, with the ${openClaim.type} claim still open and disclosable at bind.`
              : `, with no open claims to disclose at bind.`
          ]
        ])
      ].filter(Boolean),
      citedSources: [
        {
          id: at('cs-1'),
          n: 1,
          name: subject || `${line} proposal - ${account}`,
          type: 'Sent proposal'
        },
        { id: at('cs-2'), n: 2, name: `${client} reply`, type: 'Inbound email' },
        { id: at('cs-3'), n: 3, name: carrierQuote, type: 'Carrier quote' },
        { id: at('cs-4'), n: 4, name: `${account} book`, type: 'Client 360' }
      ],
      references: [
        { id: at('ref-1'), name: client, type: 'Contact' },
        ...(principal?.others || []).map((n, i) => ({
          id: at(`ref-o${i}`),
          name: n,
          type: 'Contact'
        })),
        { id: at('ref-2'), name: account, type: 'Account' }
      ],
      tasksCompleted: 1,
      tasksTotal: 3,
      tasks: [
        {
          id: at('pt1'),
          name: spec.coverageTask,
          owner: 'James Field',
          ownerInitials: 'JF',
          dueDate: 'Before the call',
          status: 'Completed'
        },
        {
          id: at('pt2'),
          name: `Ask ${carrier} to confirm the revised effective date`,
          owner: 'Elena Rostova',
          ownerInitials: 'ER',
          dueDate: 'Before the call',
          status: 'In Progress'
        },
        {
          id: at('pt3'),
          name: spec.verifyTask,
          owner: 'Agentforce',
          ownerInitials: 'AF',
          dueDate: 'On the call',
          status: 'Ready for Review'
        }
      ],
      brief: {
        sections: [
          {
            id: at('bs1'),
            heading: 'Where This Stands',
            body:
              `The ${line} comparison went out to ${client} and has been read. ` +
              `${first} replied naming ${carrier} as the closest fit, saying the ` +
              `coverage difference mattered more than the premium gap. ` +
              (spec.coverageNote
                ? `On this line ${spec.coverageNote}. `
                : '') +
              `Two conditions came with that: ${q1}, and ${q2}. Nothing has ` +
              `been bound yet.`
          },
          {
            id: at('bs2'),
            heading: 'Account at a Glance',
            body: policies.length
              ? `${account} carries ${bookLabel} of annual premium across ` +
                `${policyCount} ${policyCount === 1 ? 'line' : 'lines'}: ` +
                policies
                  .map(
                    (p) =>
                      `${p.type || p.lob} with ${p.carrier}${
                        p.premium ? ` at ${_money(p.premium) || p.premium}` : ''
                      }`
                  )
                  .join(', ') +
                `.` +
                (nextRenewal
                  ? ` The closest renewal is ${
                      nextRenewal.name
                    } on ${_prepDate(nextRenewal.expirationDate)}, which is what the effective-date question is about.`
                  : '')
              : `${account} has no other lines in force, so the effective date ` +
                `is a scheduling question rather than an alignment one.`
          },
          {
            id: at('bs3'),
            heading: 'What Could Stall This',
            body:
              `${carrierCap} was chosen for its coverage, so reopening premium ` +
              `risks the basis of the decision. The effective-date change is ` +
              `the only item that needs the carrier, which makes it the ` +
              `critical path` +
              (openClaim
                ? `. The open ${openClaim.type} claim (${openClaim.name}) also has to be disclosed at bind and could affect the final terms.`
                : `. With no open claims there is nothing else outstanding on the loss side.`) +
              (spec.stallRisk ? ` ${spec.stallRisk}` : '')
          }
        ],
        suggestedAgenda: [
          `Confirm ${carrier} as the selected option`,
          `Answer the ${topicLower} question from the quote`,
          'Agree the effective date and who confirms it with the carrier',
          'Set the bind date and the next step'
        ],
        meetingPriorities: [
          `Leave the call with ${carrier} confirmed and both questions answered.`,
          'Do not reopen the comparison unless the client does.',
          'Commit to a same-day answer on anything that needs the carrier.'
        ]
      }
    },
    discussionGuide: {
      createdAt: today().toISOString(),
      intro:
        `A short call - ${first} has already decided. The job is to close the ` +
        `two open questions and set a bind date, in that order.`,
      topics: [
        {
          id: at('dg-1'),
          window: '0-5 min',
          title: `Confirm ${carrier}`,
          prompt: `Restate the choice back to ${first} and check nothing has changed since the reply.`
        },
        {
          id: at('dg-2'),
          window: '5-15 min',
          title: topic,
          prompt: spec.coveragePrompt
        },
        {
          id: at('dg-3'),
          window: '15-25 min',
          title: 'Effective date',
          prompt: nextRenewal
            ? `Work back from ${nextRenewal.name} and agree the date to put to the carrier.`
            : 'Agree the date to put to the carrier and who owns confirming it.'
        },
        {
          id: at('dg-4'),
          window: '25-30 min',
          title: 'Bind and next steps',
          prompt: 'Name the bind date, what you owe them, and by when.'
        }
      ]
    },
    sessionNotes: {
      prompt: 'Join video and voice calls. Capture audio or type notes from your device.',
      placeholder:
        'Type your notes here. Agentforce folds them into the follow-up summary when the meeting wraps.'
    },
    followUp: {
      createdAt: today().toISOString(),
      recap:
        `${first} confirmed ${carrier} on the call once the ${topicLower} read ` +
        `as quoted. The effective date is the only open item and needs the ` +
        `carrier to confirm before the bind request goes in.`,
      decisions: [
        `Bind with ${carrier} on the coverage as quoted.`,
        `${topic} confirmed from the quote wording.`,
        nextRenewal
          ? `Effective date to be aligned with ${nextRenewal.name}, subject to carrier confirmation.`
          : 'Effective date to be confirmed with the carrier.',
        'Bind request to go in as soon as the date is confirmed.'
      ]
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN C - RFQ INTAKE (Mavericks Household · Personal Auto)
// ─────────────────────────────────────────────────────────────────────────────
export const rfqData = {
  id: 'rfq-mavericks-001',
  applicationName: 'Mavericks Household - 2026 Personal Auto Renewal',
  accountId: '001SB00001oXwntYAC',
  account: {
    id: '001SB00001oXwntYAC',
    name: 'Mavericks Household',
    industry: 'Personal Lines',
    city: 'Tampa, FL',
      ownerName: 'Elena Rostova'
  },
  lob: 'pc',
  loc: 'std_auto',
  priorPolicyLabel: '2025 Mavericks Auto - Apex Mutual',
  status: 'Draft',
  effectiveDate: '2026-10-13',
  expirationDate: '2027-10-13',
  responseDeadline: '2026-09-25',
  lineItems: [
    {
      id: 'veh-crv',
      itemType: 'vehicle',
      name: '2024 Honda CR-V EX-L',
      insuredValue: 36500,
      parentId: null,
      attributes: {
        year: 2024,
        make: 'Honda',
        model: 'CR-V EX-L',
        vin: '1HGRM4H51RA012876',
        class: 'SUV',
        use: 'Commute',
        annualMileage: 12000,
        garaging: '4208 N Dale Mabry Hwy, Tampa, FL 33611',
        assignedDriverIds: ['drv-james']
      }
    },
    {
      id: 'veh-camry',
      itemType: 'vehicle',
      name: '2021 Toyota Camry SE',
      insuredValue: 22800,
      parentId: null,
      attributes: {
        year: 2021,
        make: 'Toyota',
        model: 'Camry SE',
        vin: '4T1G11AK7MU456321',
        class: 'Sedan',
        use: 'Commute',
        annualMileage: 14500,
        garaging: '4208 N Dale Mabry Hwy, Tampa, FL 33611',
        assignedDriverIds: ['drv-james']
      }
    },
    {
      id: 'veh-lexus',
      itemType: 'vehicle',
      name: '2022 Lexus RX 350',
      insuredValue: 48000,
      parentId: null,
      attributes: {
        year: 2022,
        make: 'Lexus',
        model: 'RX 350',
        vin: '2T2BZMCA4NC445566',
        class: 'SUV',
        use: 'Pleasure',
        annualMileage: 6000,
        garaging: '4208 N Dale Mabry Hwy, Tampa, FL 33611',
        assignedDriverIds: ['drv-emily']
      }
    }
  ],
  coverages: [
    {
      id: 'cov-pa-liab',
      coverageKey: 'pa_liability',
      code: 'PP 00 01',
      formCode: 'ACORD 90',
      appliesToItemId: POLICY_TARGET,
      attributes: { biLimit: '$250,000', pdLimit: '$100,000' }
    },
    {
      id: 'cov-pa-physical',
      coverageKey: 'pa_physical',
      code: 'PP 03 13',
      formCode: 'ACORD 90',
      appliesToItemId: 'veh-all',
      attributes: { compDed: '$500', collDed: '$1,000' }
    },
    {
      // Driver-level coverage. Carried on every rated driver of the
      // prior term, so a cloned renewal pre-fills it for the drivers
      // it inherits - a driver added during the renewal starts blank.
      id: 'cov-pa-med-pay',
      coverageKey: 'pa_med_pay',
      code: 'PP 03 03',
      formCode: 'ACORD 90',
      appliesToItemId: 'drv-all',
      attributes: { medPay: '$5,000' }
    }
  ],
  participants: [
    {
      id: 'p-insured',
      policyId: null,
      role: 'Named Insured',
      accountId: '001SB00001oXwntYAC',
      contactId: null,
      name: 'James Mavericks'
    },
    {
      id: 'p-producer',
      policyId: null,
      role: 'Producer',
      accountId: null,
      contactId: 'c-james-field',
      name: 'Elena Rostova'
    }
  ]
};

// LOB visual pickers shown on the intake screen
export const lobOptions = [
  {
    value: 'auto',
    title: 'Commercial Auto (Fleet)',
    description: 'Fleet vehicles, drivers, physical damage, hired & non-owned auto',
    accent: '#066afe'
  },
  {
    value: 'home',
    title: 'Home',
    description: 'Homeowners, dwelling, contents & liability',
    accent: '#7c3aed'
  }
];

// Two-tier LOB / LOC catalog backing the Step 0 intake router.
// `multi` controls whether the LOC sub-picker is single-select (P&C) or
// multi-select (Employee Benefits - Medical/Dental/Vision/Life often bundled).
export const lobCatalog = {
  pc: {
    value: 'pc',
    label: 'Property & Casualty',
    description: 'Fleet, property, casualty & personal lines',
    accent: '#066afe',
    multi: false,
    locs: [
      { value: 'auto',     label: 'Commercial Auto (Fleet)', meta: 'Fleet · drivers · physical damage' },
      { value: 'home',     label: 'Homeowners',              meta: 'Dwelling · contents · liability' },
      { value: 'std_auto', label: 'Personal Auto',           meta: 'Personal auto · single driver' }
    ]
  },
  eb: {
    value: 'eb',
    label: 'Employee Benefits',
    description: 'Group medical, dental, vision & life programs',
    accent: '#7c3aed',
    multi: true,
    locs: [
      { value: 'medical', label: 'Medical',    meta: 'Group medical plans · PPO / HMO / HDHP' },
      { value: 'dental',  label: 'Dental',     meta: 'PPO + HMO dental tiers' },
      { value: 'vision',  label: 'Vision',     meta: 'Voluntary vision rider' },
      { value: 'life_ad', label: 'Life/AD&D',  meta: 'Basic + voluntary life / AD&D' }
    ]
  }
};

// Mocked prior-policy records used by the Step 0 replicate-lookup. Each entry
// is scoped to a LOB + (one or more) LOC so the dropdown only surfaces options
// the user can actually clone.
export const priorPolicies = [
  {
    id: 'pol-meridian-auto-2025',
    lob: 'pc',
    locs: ['auto'],
    label: '2025 Apex Logistics Fleet - Travelers',
    accountName: 'Apex Logistics',
    carrier: 'Travelers',
    carrierId: 'travelers',
    premium: '$18,200',
    effectivePeriod: '2025-07-01 → 2026-07-01'
  },
  {
    id: 'pol-sunrise-home-2025',
    lob: 'pc',
    locs: ['home'],
    label: '2025 Sunrise HQ Homeowners - Chubb',
    accountName: 'Sunrise Agency',
    carrier: 'Chubb',
    carrierId: 'chubb',
    premium: '$3,840',
    effectivePeriod: '2025-04-01 → 2026-04-01'
  },
  {
    id: 'pol-mavericks-home-2025',
    lob: 'pc',
    locs: ['home'],
    label: '2025 Mavericks Homeowners - Chubb',
    accountName: 'Mavericks Household',
    carrier: 'Chubb',
    carrierId: 'chubb',
    premium: '$4,120',
    effectivePeriod: '2025-12-01 → 2026-12-01'
  },
  {
    id: 'pol-coastal-stdauto-2025',
    lob: 'pc',
    locs: ['std_auto'],
    label: '2025 Coastal - Standalone Auto - Nationwide',
    accountName: 'Coastal Restaurants Group',
    carrier: 'Nationwide',
    carrierId: 'nationwide',
    premium: '$1,420',
    effectivePeriod: '2025-09-01 → 2026-09-01'
  },
  {
    id: 'pol-acme-medical-2025',
    lob: 'eb',
    locs: ['medical'],
    label: '2025 Acme Corp Group Medical - BlueCross',
    accountName: 'Acme Manufacturing',
    carrier: 'BlueCross',
    carrierId: 'bluecross',
    premium: '$612,000',
    effectivePeriod: '2025-01-01 → 2026-01-01'
  },
  {
    id: 'pol-acme-life-2025',
    lob: 'eb',
    locs: ['life_ad'],
    label: '2025 Acme Corp Life / AD&D - MetLife',
    accountName: 'Acme Manufacturing',
    carrier: 'MetLife',
    carrierId: 'metlife',
    premium: '$48,500',
    effectivePeriod: '2025-01-01 → 2026-01-01'
  }
];

// 7 employees revealed after the simulated census parse
export const census = [
  { id: 'e1', name: 'Aaron Patel', age: 34, role: 'GM - Tampa Bay', zip: '33606', dependents: 2 },
  { id: 'e2', name: 'Brianna Cho', age: 29, role: 'Sous Chef', zip: '33606', dependents: 0 },
  { id: 'e3', name: 'Carlos Mendes', age: 41, role: 'Driver - Unit 04', zip: '33611', dependents: 3 },
  { id: 'e4', name: 'Devon Walker', age: 37, role: 'Operations Lead', zip: '33602', dependents: 1 },
  { id: 'e5', name: 'Esther Liu', age: 26, role: 'Floor Manager', zip: '33606', dependents: 0 },
  { id: 'e6', name: 'Frank Romero', age: 52, role: 'Head Chef', zip: '33609', dependents: 4 },
  { id: 'e7', name: 'Gianna Stamos', age: 31, role: 'Asst. Driver', zip: '33611', dependents: 2 }
];

// 50-employee mocked EB census loaded when "Shop Market + EB" is chosen in
// Step 0. Salary bands and tier coverage drive premium estimates downstream.
export const ebCensus = (() => {
  const firstNames = [
    'Aaron','Brianna','Carlos','Devon','Esther','Frank','Gianna','Hiro','Imani','Jasper',
    'Kira','Luis','Maya','Noah','Olivia','Priya','Quincy','Reema','Sasha','Tomás',
    'Uma','Victor','Wren','Xiomara','Yusuf','Zoë','Adriana','Bryce','Camille','Dylan',
    'Elena','Felix','Gemma','Harlan','Iris','Joaquín','Kenji','Lila','Mateo','Nadia',
    'Oren','Paloma','Quinn','Rafael','Simone','Tobias','Ursula','Vivek','Wyatt','Yara'
  ];
  const lastNames = [
    'Patel','Cho','Mendes','Walker','Liu','Romero','Stamos','Tanaka','Okafor','Bell',
    'Nguyen','Garza','Schmidt','Reyes','Ortega','Park','Brennan','Khan','Voss','Hahn',
    'Iyer','Cole','Marsh','Diaz','Sato','Beck','Lopez','Holm','Greer','Park',
    'Daw','Singh','Lund','Bates','Faro','Hill','Vega','Quinn','Roe','Cain',
    'Bose','Mata','Lee','Lake','Wells','Trent','Falk','Hess','Yates','Mora'
  ];
  const roles = [
    'CNC Operator','Assembler','Quality Inspector','Maintenance Tech','Shipping Lead',
    'Logistics Coordinator','Plant Supervisor','HR Generalist','Payroll Specialist',
    'Accountant','Buyer / Planner','Process Engineer','Safety Officer','EHS Manager',
    'Forklift Operator','Welder','Press Operator','Materials Handler','Toolmaker',
    'Production Lead'
  ];
  const tiers = ['EE Only', 'EE + Spouse', 'EE + Child(ren)', 'Family'];
  const salaryBands = ['<$50k', '$50 - 75k', '$75 - 100k', '$100 - 150k', '$150k+'];
  const zips = ['45202','45203','45204','45205','45206','45207'];
  const out = [];
  for (let i = 0; i < 50; i++) {
    const first = firstNames[i % firstNames.length];
    const last = lastNames[(i * 7) % lastNames.length];
    const tier = tiers[i % tiers.length];
    out.push({
      id: `eb-${String(i + 1).padStart(3, '0')}`,
      name: `${first} ${last}`,
      age: 24 + ((i * 11) % 38),
      role: roles[i % roles.length],
      department: i % 3 === 0 ? 'Operations' : i % 3 === 1 ? 'Production' : 'Support',
      zip: zips[i % zips.length],
      tier,
      dependents: tier === 'EE Only' ? 0 : tier === 'EE + Spouse' ? 1 : tier === 'EE + Child(ren)' ? 2 : 3,
      salaryBand: salaryBands[i % salaryBands.length]
    });
  }
  return out;
})();

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN C - BIND POLICY (Step 4)
// ─────────────────────────────────────────────────────────────────────────────
export const subjectivities = [
  { id: 'subj-sign', label: 'Sign Application (ACORD 90)',               required: true, default: false },
  { id: 'subj-eft',  label: 'Set up EFT / Recurring Payment',            required: true, default: false },
  { id: 'subj-mvr',  label: 'Confirm Driver Roster and Vehicle Assignments', required: true, default: false },
  { id: 'subj-disc', label: 'Acknowledge UM/UIM + Stacking Disclosures', required: true, default: false }
];

export const paymentFrequencies = [
  { id: 'annual',    label: 'Annual',      periods: 1,  surcharge: 0.0,  description: 'Pay once · 0% surcharge' },
  { id: 'semi',      label: 'Semi-Annual', periods: 2,  surcharge: 0.01, description: 'Two payments · 1% surcharge' },
  { id: 'quarterly', label: 'Quarterly',   periods: 4,  surcharge: 0.015, description: 'Four payments · 1.5% surcharge' },
  { id: 'monthly',   label: 'Monthly',     periods: 12, surcharge: 0.025, description: 'Twelve payments · 2.5% surcharge' }
];

export const paymentMethods = [
  { id: 'ach',     label: 'ACH Bank Transfer' },
  { id: 'card',    label: 'Credit Card' },
  { id: 'check',   label: 'Check' }
];

export const defaultAdditionalInsureds = [
  { id: 'ai-1', name: 'Sunrise Industrial Park LLC', relationship: 'Property Landlord' }
];

export const defaultCertificateHolders = [];

// The Mavericks household: three people, one car each.
//
// Only James is rated on the expiring 2025 Apex policy, and he carries both
// the CR-V and the Camry there (see data/policyRecords, pol-mav-pa-2025).
// Joseph is James's father, who now drives the Camry - adding him as a
// second rated driver is the change the 2026 renewal introduces, so he is
// deliberately absent from every prior-policy roster snapshot.
export const drivers = [
  {
    id: 'drv-james',
    name: 'James Mavericks',
    age: 52,
    dob: '1974-04-12',
    dl: 'FL-J412-MVK',
    licenseState: 'FL',
    assignedVehicleId: 'veh-crv',
    assignedVehicle: '2024 Honda CR-V EX-L',
    yearsExperience: 34
  },
  {
    id: 'drv-joseph',
    name: 'Joseph Mavericks',
    age: 74,
    dob: '1952-03-08',
    dl: 'FL-J308-MVK',
    licenseState: 'FL',
    role: 'Parent',
    assignedVehicleId: 'veh-camry',
    assignedVehicle: '2021 Toyota Camry SE',
    yearsExperience: 55
  },
  {
    id: 'drv-emily',
    name: 'Emily Mavericks',
    age: 49,
    dob: '1976-08-25',
    dl: 'FL-E908-MVK',
    licenseState: 'FL',
    assignedVehicleId: 'veh-lexus',
    assignedVehicle: '2022 Lexus RX 350',
    yearsExperience: 31
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// ADDITIONAL HOUSEHOLD VEHICLES - on file for the Mavericks account but
// NOT on the default RFQ roster. Surface only through the Add Vehicle
// modal lookup so the broker can pull an existing asset into the active
// RFQ without retyping every field. Shapes match rfqData.lineItems[*]
// exactly so the modal lookup handler can map fields without translation.
//
// There is no driver equivalent: the household is exactly three people
// (see `drivers` above), so the Add Driver lookup draws from that roster.
// ─────────────────────────────────────────────────────────────────────────────
export const ADDITIONAL_HOUSEHOLD_VEHICLES = [
  {
    id: 'veh-cat-outback-21',
    itemType: 'vehicle',
    name: '2021 Subaru Outback Premium',
    insuredValue: 28400,
    parentId: null,
    attributes: {
      year: 2021,
      make: 'Subaru',
      model: 'Outback Premium',
      vin: '4S4BSANC5M3210456',
      class: 'Wagon',
      use: 'Pleasure',
      annualMileage: 6000,
      garaging: '4208 N Dale Mabry Hwy, Tampa, FL 33611',
      assignedDriverIds: []
    }
  },
  {
    id: 'veh-cat-tacoma-19',
    itemType: 'vehicle',
    name: '2019 Toyota Tacoma TRD Off-Road',
    insuredValue: 32800,
    parentId: null,
    attributes: {
      year: 2019,
      make: 'Toyota',
      model: 'Tacoma TRD Off-Road',
      vin: '3TMCZ5AN8KM215789',
      class: 'Truck',
      use: 'Business',
      annualMileage: 14500,
      garaging: '4208 N Dale Mabry Hwy, Tampa, FL 33611',
      assignedDriverIds: []
    }
  },
  {
    id: 'veh-cat-q5-24',
    itemType: 'vehicle',
    name: '2024 Audi Q5 Premium Plus',
    insuredValue: 48900,
    parentId: null,
    attributes: {
      year: 2024,
      make: 'Audi',
      model: 'Q5 Premium Plus',
      vin: 'WA1BNAFY8R2008312',
      class: 'SUV',
      use: 'Commute',
      annualMileage: 11000,
      garaging: '4208 N Dale Mabry Hwy, Tampa, FL 33611',
      assignedDriverIds: []
    }
  },
  {
    id: 'veh-cat-mustang-18',
    itemType: 'vehicle',
    name: '2018 Ford Mustang GT',
    insuredValue: 22500,
    parentId: null,
    attributes: {
      year: 2018,
      make: 'Ford',
      model: 'Mustang GT',
      vin: '1FA6P8CF1J5187224',
      class: 'Sports Car',
      use: 'Pleasure',
      annualMileage: 4200,
      garaging: '4208 N Dale Mabry Hwy, Tampa, FL 33611',
      assignedDriverIds: []
    }
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN C-EB - RFQ INTAKE (Acme Manufacturing · Group Medical)
// Parallel to rfqData. The EB wizard imports this directly; the PA wizard
// imports rfqData. c-app routes to the right workspace based on context.lob.
// ─────────────────────────────────────────────────────────────────────────────
export const acmeRfqData = {
  id: 'rfq-acme-001',
  applicationName: 'Acme Manufacturing - 2026 Group Medical Renewal',
  accountId: '001EB00002pYzbMAC',
  account: {
    id: '001EB00002pYzbMAC',
    name: 'Acme Manufacturing',
    industry: 'Manufacturing',
    city: 'Chicago, IL',
      ownerName: 'Elena Rostova'
  },
  lob: 'eb',
  loc: 'medical',
  priorPolicyLabel: '2025 Acme Medical - BlueCross (50 Employees)',
  employeeCount: 50,
  status: 'Draft',
  effectiveDate: '2026-01-01',
  expirationDate: '2027-01-01',
  responseDeadline: '2025-11-15'
};

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN C-HOME - RFQ INTAKE (Mavericks Household · Homeowners)
// Parallel to rfqData / acmeRfqData. The Home wizard imports this directly.
// Line items model the dwelling (parent) + scheduled personal property
// children (jewelry, art, collectibles). HO coverages sit on the policy
// and a separate physical-damage row carries the all-perils + wind/hail
// deductibles (Tampa is a wind-exposed market).
// ─────────────────────────────────────────────────────────────────────────────
export const homeRfqData = {
  id: 'rfq-mavericks-home-001',
  applicationName: 'Mavericks Household - 2026 Homeowners Renewal',
  accountId: '001SB00001oXwntYAC',
  account: {
    id: '001SB00001oXwntYAC',
    name: 'Mavericks Household',
    industry: 'Personal Lines',
    city: 'Tampa, FL',
      ownerName: 'Elena Rostova'
  },
  lob: 'pc',
  loc: 'home',
  priorPolicyLabel: '2025 Mavericks Homeowners - Chubb',
  status: 'Draft',
  effectiveDate: '2026-12-01',
  expirationDate: '2027-12-01',
  responseDeadline: '2026-11-13',
  lineItems: [
    {
      id: 'dwl-bayshore',
      itemType: 'dwelling',
      name: '4208 N Dale Mabry Hwy, Tampa, FL 33611',
      insuredValue: 685000,
      parentId: null,
      attributes: {
        addressLine: '4208 N Dale Mabry Hwy',
        city: 'Tampa',
        state: 'FL',
        zip: '33611',
        yearBuilt: 2004,
        construction: 'Masonry',
        roofType: 'Tile',
        roofYear: 2019,
        sqFt: 3450,
        stories: 2,
        occupancy: 'Primary Residence',
        replacementCost: 685000,
        protectionClass: '3',
        distanceToCoast: '1.2 mi',
        distanceToFireStation: '0.8 mi',
        alarmSystem: 'Monitored - burglar + fire',
        priorLosses: 0
      }
    },
    {
      id: 'sch-jewelry-01',
      itemType: 'scheduledItem',
      name: "Emily's Engagement Ring",
      insuredValue: 24500,
      parentId: 'dwl-bayshore',
      attributes: {
        category: 'Jewelry',
        description: '2.1ct round diamond, platinum setting',
        appraisedValue: 24500,
        appraisalDate: '2024-03-10',
        appraisedBy: 'Continental Jewelers'
      }
    },
    {
      id: 'sch-art-01',
      itemType: 'scheduledItem',
      name: 'Framed Original - "Tampa Bay Sunrise"',
      insuredValue: 8200,
      parentId: 'dwl-bayshore',
      attributes: {
        category: 'Fine Art',
        description: 'Oil on canvas, D. Rivera (2018)',
        appraisedValue: 8200,
        appraisalDate: '2023-11-02',
        appraisedBy: 'Bay Fine Art Appraisals'
      }
    },
    {
      id: 'sch-collect-01',
      itemType: 'scheduledItem',
      name: 'Autographed Baseball Collection',
      insuredValue: 6400,
      parentId: 'dwl-bayshore',
      attributes: {
        category: 'Collectibles',
        description: '12 authenticated baseballs (PSA / JSA)',
        appraisedValue: 6400,
        appraisalDate: '2024-08-18',
        appraisedBy: 'PSA Authentication'
      }
    }
  ],
  coverages: [
    {
      id: 'cov-ho-a',
      coverageKey: 'ho_dwelling',
      code: 'HO 00 03',
      formCode: 'ACORD 80',
      appliesToItemId: 'dwl-bayshore',
      attributes: { limit: '$685,000' }
    },
    {
      id: 'cov-ho-b',
      coverageKey: 'ho_other_structures',
      code: 'HO 00 03',
      formCode: 'ACORD 80',
      appliesToItemId: 'dwl-bayshore',
      attributes: { limit: '$68,500' }
    },
    {
      id: 'cov-ho-c',
      coverageKey: 'ho_personal_property',
      code: 'HO 00 03',
      formCode: 'ACORD 80',
      appliesToItemId: 'dwl-bayshore',
      attributes: { limit: '$342,500' }
    },
    {
      id: 'cov-ho-d',
      coverageKey: 'ho_loss_of_use',
      code: 'HO 00 03',
      formCode: 'ACORD 80',
      appliesToItemId: 'dwl-bayshore',
      attributes: { limit: '$137,000' }
    },
    {
      id: 'cov-ho-e',
      coverageKey: 'ho_liability',
      code: 'HO 00 03',
      formCode: 'ACORD 80',
      appliesToItemId: POLICY_TARGET,
      attributes: { limit: '$500,000' }
    },
    {
      id: 'cov-ho-f',
      coverageKey: 'ho_med_pay',
      code: 'HO 00 03',
      formCode: 'ACORD 80',
      appliesToItemId: POLICY_TARGET,
      attributes: { limit: '$5,000' }
    },
    {
      id: 'cov-ho-deductibles',
      coverageKey: 'ho_deductibles',
      code: 'HO DED',
      formCode: 'ACORD 80',
      appliesToItemId: 'dwl-bayshore',
      attributes: { allPerilsDed: '$2,500', windHailDed: '2%' }
    }
  ],
  participants: [
    {
      id: 'p-insured-home',
      policyId: null,
      role: 'Named Insured',
      accountId: '001SB00001oXwntYAC',
      contactId: null,
      name: 'James Mavericks',
      // HO-3 PCM Named Insured attributes: DOB / Marital Status /
      // Prior Carrier are surfaced in the homeowner form and Review
      // step's Quote Details table.
      firstName: 'James',
      lastName: 'Mavericks',
      dob: '1974-04-12',
      maritalStatus: 'Married',
      priorCarrier: 'Chubb'
    },
    {
      id: 'p-coinsured-home',
      policyId: null,
      role: 'Co-Insured',
      accountId: '001SB00001oXwntYAC',
      contactId: null,
      name: 'Emily Mavericks',
      firstName: 'Emily',
      lastName: 'Mavericks',
      dob: '1976-08-25',
      maritalStatus: 'Married',
      priorCarrier: 'Chubb'
    },
    {
      id: 'p-producer-home',
      policyId: null,
      role: 'Producer',
      accountId: null,
      contactId: 'c-james-field',
      name: 'Elena Rostova'
    }
  ]
};

// Additional adult household members on file for the Mavericks account
// but NOT on the default HO RFQ named-insured list. Surface only through
// the Add Homeowner form's lookup so the broker can pull an existing
// household member into the active RFQ without retyping every field.
// Shapes match homeRfqData.participants (insured entries) so the modal
// lookup handlers can map fields without translation.
export const ADDITIONAL_HOUSEHOLD_HOMEOWNERS = [
  {
    id: 'p-cat-joseph',
    name: 'Joseph Mavericks',
    attributes: {
      firstName: 'Joseph',
      lastName: 'Mavericks',
      dob: '1952-03-08',
      maritalStatus: 'Widowed',
      priorCarrier: 'State Farm',
      role: 'Co-Insured'
    }
  }
];

// Additional dwellings on file for the Mavericks account but NOT on the
// default HO RFQ roster. Surface only through the Add Dwelling modal's
// lookup so the broker can pull an existing property into the active
// RFQ (secondary home, rental, etc.) without retyping every field.
// Shapes match homeRfqData.lineItems entries so the modal lookup can
// map fields without translation.
export const ADDITIONAL_HOUSEHOLD_DWELLINGS = [
  {
    id: 'dwl-cat-siesta',
    itemType: 'dwelling',
    name: '812 Beach Road, Siesta Key, FL 34242',
    insuredValue: 940000,
    parentId: null,
    attributes: {
      addressLine: '812 Beach Road',
      city: 'Siesta Key',
      state: 'FL',
      zip: '34242',
      yearBuilt: 2012,
      construction: 'Frame',
      roofType: 'Metal',
      roofYear: 2020,
      sqFt: 2800,
      stories: 2,
      occupancy: 'Secondary / Seasonal',
      replacementCost: 940000,
      protectionClass: '5',
      distanceToCoast: '0.1 mi',
      distanceToFireStation: '1.5 mi',
      alarmSystem: 'Monitored - burglar',
      priorLosses: 1
    }
  },
  {
    id: 'dwl-cat-brandon',
    itemType: 'dwelling',
    name: '1055 Oakhurst Ln, Brandon, FL 33511',
    insuredValue: 315000,
    parentId: null,
    attributes: {
      addressLine: '1055 Oakhurst Ln',
      city: 'Brandon',
      state: 'FL',
      zip: '33511',
      yearBuilt: 1998,
      construction: 'Masonry',
      roofType: 'Asphalt Shingle',
      roofYear: 2016,
      sqFt: 1850,
      stories: 1,
      occupancy: 'Rental (Long-Term)',
      replacementCost: 315000,
      protectionClass: '4',
      distanceToCoast: '18 mi',
      distanceToFireStation: '1.1 mi',
      alarmSystem: 'None',
      priorLosses: 0
    }
  }
];

// Scheduled personal property items on file for the Mavericks account
// but not attached to the default HO RFQ. Surfaced in the Add Scheduled
// Item modal's lookup so the broker can pull a previously-appraised
// item onto the active RFQ.
export const ADDITIONAL_HOUSEHOLD_SCHEDULED_ITEMS = [
  {
    id: 'sch-cat-watch-01',
    itemType: 'scheduledItem',
    name: "James's Rolex Submariner",
    insuredValue: 12800,
    parentId: null,
    attributes: {
      category: 'Watches',
      description: 'Ref. 126610LN, purchased 2022',
      appraisedValue: 12800,
      appraisalDate: '2024-05-04',
      appraisedBy: 'Continental Jewelers'
    }
  },
  {
    id: 'sch-cat-cameras-01',
    itemType: 'scheduledItem',
    name: 'Photography Kit - Leica',
    insuredValue: 9600,
    parentId: null,
    attributes: {
      category: 'Cameras',
      description: 'Leica Q3 + 3 lenses',
      appraisedValue: 9600,
      appraisalDate: '2024-06-22',
      appraisedBy: 'B&H Insurance Appraisals'
    }
  },
  {
    id: 'sch-cat-firearms-01',
    itemType: 'scheduledItem',
    name: 'Vintage Firearm - Colt 1911',
    insuredValue: 4300,
    parentId: null,
    attributes: {
      category: 'Firearms',
      description: '1943 issue, matching serials',
      appraisedValue: 4300,
      appraisalDate: '2023-09-14',
      appraisedBy: 'Turnbull Restoration'
    }
  }
];

// 50-employee roster for the Acme EB Step 2 census upload. Two rows are
// intentionally created with `dob: null` (indices 12 and 37 - John Doe and
// Jane Smith) so the validation loop has something to surface: "48 Rows
// Validated. 2 Rows Require Attention."
export const acmeCensus = (() => {
  const firstNames = [
    'Aaron','Brianna','Carlos','Devon','Esther','Frank','Gianna','Hiro','Imani','Jasper',
    'Kira','Luis','John','Maya','Noah','Olivia','Priya','Quincy','Reema','Sasha',
    'Tomás','Uma','Victor','Wren','Xiomara','Yusuf','Zoë','Adriana','Bryce','Camille',
    'Dylan','Elena','Felix','Gemma','Harlan','Iris','Joaquín','Jane','Lila','Mateo',
    'Nadia','Oren','Paloma','Quinn','Rafael','Simone','Tobias','Ursula','Vivek','Yara'
  ];
  const lastNames = [
    'Patel','Cho','Mendes','Walker','Liu','Romero','Stamos','Tanaka','Okafor','Bell',
    'Nguyen','Garza','Doe','Reyes','Ortega','Park','Brennan','Khan','Voss','Hahn',
    'Iyer','Cole','Marsh','Diaz','Sato','Beck','Lopez','Holm','Greer','Park',
    'Daw','Singh','Lund','Bates','Faro','Hill','Vega','Smith','Roe','Cain',
    'Bose','Mata','Lee','Lake','Wells','Trent','Falk','Hess','Yates','Mora'
  ];
  const roles = [
    'CNC Operator','Assembler','Quality Inspector','Maintenance Tech','Shipping Lead',
    'Logistics Coordinator','Plant Supervisor','HR Generalist','Payroll Specialist',
    'Accountant','Buyer / Planner','Process Engineer','Safety Officer','EHS Manager',
    'Forklift Operator','Welder','Press Operator','Materials Handler','Toolmaker',
    'Production Lead'
  ];
  const tiers = ['EE Only', 'EE + Spouse', 'EE + Child(ren)', 'Family'];
  const salaryBands = ['<$50k', '$50 - 75k', '$75 - 100k', '$100 - 150k', '$150k+'];
  const zips = ['45202','45203','45204','45205','45206','45207'];
  const out = [];
  for (let i = 0; i < 50; i++) {
    const first = firstNames[i];
    const last = lastNames[i];
    const tier = tiers[i % tiers.length];
    // Intentionally leave dob null for two rows so the validation loop has
    // something to surface. Indices line up with John Doe + Jane Smith.
    const missingDob = i === 12 || i === 37;
    const ageOffset = (i * 11) % 38;
    const birthYear = 1985 + ageOffset;
    const birthMonth = String((i % 12) + 1).padStart(2, '0');
    const birthDay = String((i % 27) + 1).padStart(2, '0');
    out.push({
      id: `eb-${String(i + 1).padStart(3, '0')}`,
      employeeId: `EMP-${String(2000 + i).padStart(5, '0')}`,
      name: `${first} ${last}`,
      dob: missingDob ? null : `${birthYear}-${birthMonth}-${birthDay}`,
      gender: i % 2 === 0 ? 'F' : 'M',
      zip: zips[i % zips.length],
      tier,
      salaryBand: salaryBands[i % salaryBands.length],
      role: roles[i % roles.length],
      dependents: tier === 'EE Only' ? 0 : tier === 'EE + Spouse' ? 1 : tier === 'EE + Child(ren)' ? 2 : 3
    });
  }
  return out;
})();

// 4-item bind checklist for the EB Acme flow.
export const acmeSubjectivities = [
  { id: 'subj-master', label: 'Generate Master Application (5500)',     required: true, default: false },
  { id: 'subj-oe',     label: 'Initiate Open Enrollment Portal',         required: true, default: false },
  { id: 'subj-soa',    label: 'Confirm Summary of Benefits & Coverage',  required: true, default: false },
  { id: 'subj-eft',    label: 'Set up Group EFT / Recurring Premium',    required: true, default: false }
];

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN C - QUOTE COMPARISON
// Plan-by-plan grid. Each carrier returns multiple plan options, so the
// side-by-side comparison renders one column per plan. Each object carries
// both the legacy card fields (used by the picker cards) and the rich-grid
// fields grouped into Plan Information / In-Network / Out-of-Network / Totals.
//   PA  → applicationId 'rfq-mavericks-001' (Apex Mutual is the incumbent)
//   EB  → applicationId 'rfq-acme-001'      (BlueCross is the incumbent)
// ─────────────────────────────────────────────────────────────────────────────
export const quotes = [
  // ════════ PA - Mavericks Household · Personal Auto (3 carriers / 5 plans) ════
  // Carriers here must write the line in the CARRIERS catalog's appetite,
  // because the Submission Board only routes to markets that do. Lighthouse
  // Casualty is property-only and used to carry two auto plans, which put a
  // market the auto line could never be submitted to into its comparison.
  // Lighthouse still holds the household's 2024 auto policy in the intake's
  // prior-policy history; it has since withdrawn from the line.
  {
    id: 'q-apex-standard',
    applicationId: 'rfq-mavericks-001',
    carrierId: 'apex',
    carrierName: 'Apex Mutual',
    carrierAccent: '#5c5c5c',
    status: 'expiring',
    incumbent: true,
    recommended: true,
    annualPremium: 14850,
    amBest: 'A',
    validUntil: '2026-10-13',
    // Plan Information
    planName: 'Standard Auto',
    policyForm: 'Personal Auto (PP 00 01)',
    term: '12 months',
    planNotes: 'Current expiring policy',
    // Liability
    bodilyInjury: '$250,000',
    propertyDamage: '$100,000',
    umUim: '$250,000',
    medicalPayments: '$5,000',
    // Physical damage
    compDeductible: '$500',
    collisionDeductible: '$1,000',
    luxuryDeductible: '$2,500 / $2,500',
    rentalReimb: '$30/day · $900 max',
    roadside: 'Not included',
    // Value-adds
    accidentForgiveness: 'No',
    oemParts: 'No',
    diminishingDeductible: 'No',
    aiRecommendation: null
  },
  {
    id: 'q-apex-premier',
    applicationId: 'rfq-mavericks-001',
    carrierId: 'apex',
    carrierName: 'Apex Mutual',
    carrierAccent: '#5c5c5c',
    status: 'received',
    annualPremium: 18120,
    amBest: 'A',
    validUntil: '2026-09-30',
    planName: 'Premier Auto',
    policyForm: 'Personal Auto (PP 00 01)',
    term: '12 months',
    planNotes: 'Apex buy-up with richer limits',
    bodilyInjury: '$300,000',
    propertyDamage: '$100,000',
    umUim: '$300,000',
    medicalPayments: '$10,000',
    compDeductible: '$250',
    collisionDeductible: '$500',
    luxuryDeductible: '$1,000 / $1,000',
    rentalReimb: '$50/day · $1,500 max',
    roadside: 'Included',
    accidentForgiveness: 'Yes - after 1 year',
    oemParts: 'Yes - vehicles < 5 yrs',
    diminishingDeductible: 'Yes',
    aiRecommendation: null
  },
  {
    id: 'q-meridian-value',
    applicationId: 'rfq-mavericks-001',
    carrierId: 'meridian',
    carrierName: 'Meridian Auto & Home',
    carrierAccent: '#b54708',
    status: 'received',
    annualPremium: 12950,
    amBest: 'A-',
    validUntil: '2026-09-30',
    planName: 'Value Auto',
    policyForm: 'Personal Auto (PP 00 01)',
    term: '12 months',
    planNotes: 'Lowest price; reduced limits - not recommended',
    bodilyInjury: '$100,000',
    propertyDamage: '$100,000',
    umUim: '$100,000',
    medicalPayments: '$2,500',
    compDeductible: '$1,000',
    collisionDeductible: '$1,000',
    luxuryDeductible: '$5,000 / $5,000',
    rentalReimb: 'Not included',
    roadside: 'Not included',
    accidentForgiveness: 'No',
    oemParts: 'Yes - vehicles < 3 yrs',
    diminishingDeductible: 'No',
    aiRecommendation: {
      bestValue: false,
      confidence: 0.46,
      reason:
        'Lowest price, but reduces bodily-injury and UM limits below the household\'s prior standards and carries a $5,000 deductible on the Lexus RX 350. Not recommended.'
    }
  },
  {
    id: 'q-pinnacle-standard',
    applicationId: 'rfq-mavericks-001',
    carrierId: 'pinnacle',
    carrierName: 'Pinnacle Standard',
    carrierAccent: '#0b5cab',
    status: 'received',
    recommended: true,
    annualPremium: 15100,
    amBest: 'A++',
    validUntil: '2026-09-30',
    planName: 'Standard',
    policyForm: 'Personal Auto (PP 00 01)',
    term: '12 months',
    planNotes: 'Best value - matches incumbent liability, ~17% under the Apex renewal',
    bodilyInjury: '$250,000',
    propertyDamage: '$100,000',
    umUim: '$250,000',
    medicalPayments: '$5,000',
    compDeductible: '$500',
    collisionDeductible: '$1,000',
    luxuryDeductible: '$2,500 / $2,500',
    rentalReimb: '$40/day · $1,200 max',
    roadside: 'Included',
    accidentForgiveness: 'Yes - after 3 years',
    oemParts: 'No',
    diminishingDeductible: 'No',
    aiRecommendation: {
      bestValue: true,
      confidence: 0.88,
      reason:
        'Best value. Matches the incumbent liability limits on the strongest balance sheet in the set (A++), at roughly 17% under the Apex renewal and within 2% of the expiring premium despite a 74-year-old newly rated on the schedule. Meridian is cheaper but cuts bodily-injury and UM below the household\'s prior standards.',
      bullets: [
        'Holds the prior $250,000 liability and UM limits, unlike the cheaper Meridian quote',
        'Roughly 17% under the Apex renewal, and within 2% of the expiring premium',
        'A++ rated - the strongest carrier financial strength in the comparison',
        'Trade-off to raise with the client: $1,000 collision deductible and no OEM parts'
      ]
    }
  },
  {
    id: 'q-pinnacle-signature',
    applicationId: 'rfq-mavericks-001',
    carrierId: 'pinnacle',
    carrierName: 'Pinnacle Standard',
    carrierAccent: '#0b5cab',
    status: 'received',
    annualPremium: 16800,
    amBest: 'A++',
    validUntil: '2026-09-30',
    planName: 'Signature',
    policyForm: 'Personal Auto (PP 00 01)',
    term: '12 months',
    planNotes: 'Premium tier with agreed-value option',
    bodilyInjury: '$500,000',
    propertyDamage: '$250,000',
    umUim: '$500,000',
    medicalPayments: '$10,000',
    compDeductible: '$250',
    collisionDeductible: '$500',
    luxuryDeductible: '$1,000 / $1,000',
    rentalReimb: '$75/day · $2,250 max',
    roadside: 'Included + concierge',
    accidentForgiveness: 'Yes - immediately',
    oemParts: 'Yes - all vehicles',
    diminishingDeductible: 'Yes',
    aiRecommendation: null
  },

  // ════════ HO - Mavericks Household · Homeowners (3 markets / 4 plans) ════
  // Plus the expiring Chubb policy, which is the renewal baseline rather than
  // a market response - Chubb is the incumbent and is not a routable market in
  // the CARRIERS catalog. Pinnacle Standard (auto-only) and Travelers (absent
  // from the catalog) used to quote here and were dropped for the same reason
  // Lighthouse was dropped from the auto set above.
  // Quotes against homeRfqData: 4208 N Dale Mabry Hwy, Tampa FL - $685,000
  // masonry dwelling, tile roof (2019), 1.2 mi to coast, $39,100 of
  // scheduled personal property. Chubb is the expiring carrier
  // (homeRfqData.priorPolicyLabel), so it carries `incumbent: true` and
  // sets the delta baseline. Tampa is wind-exposed, so the wind/hail
  // deductible is the row that separates the market.
  {
    id: 'q-ho-chubb-masterpiece',
    applicationId: 'rfq-mavericks-home-001',
    carrierId: 'chubb',
    carrierName: 'Chubb',
    carrierAccent: '#03234d',
    status: 'expiring',
    incumbent: true,
    recommended: true,
    annualPremium: 7940,
    amBest: 'A++',
    validUntil: '2026-12-01',
    // Plan Information
    planName: 'Masterpiece HO-3',
    policyForm: 'Homeowners (HO 00 03)',
    term: '12 months',
    planNotes: 'Current expiring policy',
    // Property coverage
    dwellingLimit: '$685,000',
    otherStructures: '$68,500',
    personalProperty: '$342,500',
    lossOfUse: '$137,000',
    // Liability
    personalLiability: '$500,000',
    medicalPayments: '$5,000',
    // Deductibles
    allPerilsDeductible: '$2,500',
    windHailDeductible: '2% ($13,700)',
    roofSettlement: 'Replacement cost',
    // Value-adds
    waterBackup: '$10,000',
    ordinanceOrLaw: '10% of Dwelling',
    scheduledItems: '$39,100 scheduled',
    aiRecommendation: null
  },
  {
    id: 'q-ho-apex-select',
    applicationId: 'rfq-mavericks-home-001',
    carrierId: 'apex',
    carrierName: 'Apex Mutual',
    carrierAccent: '#5c5c5c',
    status: 'received',
    annualPremium: 7410,
    amBest: 'A',
    validUntil: '2026-11-20',
    planName: 'Homeowners Select',
    policyForm: 'Homeowners (HO 00 03)',
    term: '12 months',
    planNotes: 'Matches expiring limits at a lower premium',
    dwellingLimit: '$685,000',
    otherStructures: '$68,500',
    personalProperty: '$342,500',
    lossOfUse: '$137,000',
    personalLiability: '$500,000',
    medicalPayments: '$5,000',
    allPerilsDeductible: '$2,500',
    windHailDeductible: '2% ($13,700)',
    roofSettlement: 'Replacement cost',
    waterBackup: '$10,000',
    ordinanceOrLaw: '10% of Dwelling',
    scheduledItems: '$39,100 scheduled',
    aiRecommendation: null
  },
  {
    id: 'q-ho-apex-premier',
    applicationId: 'rfq-mavericks-home-001',
    carrierId: 'apex',
    carrierName: 'Apex Mutual',
    carrierAccent: '#5c5c5c',
    status: 'received',
    annualPremium: 8760,
    amBest: 'A',
    validUntil: '2026-11-20',
    planName: 'Homeowners Premier',
    policyForm: 'Homeowners (HO 00 03)',
    term: '12 months',
    planNotes: 'Buy-up: extended replacement cost, 1% wind/hail',
    dwellingLimit: '$822,000 (120% extended)',
    otherStructures: '$82,200',
    personalProperty: '$411,000',
    lossOfUse: '$164,400',
    personalLiability: '$1,000,000',
    medicalPayments: '$10,000',
    allPerilsDeductible: '$1,000',
    windHailDeductible: '1% ($8,220)',
    roofSettlement: 'Replacement cost',
    waterBackup: '$50,000',
    ordinanceOrLaw: '25% of Dwelling',
    scheduledItems: '$39,100 scheduled + blanket',
    aiRecommendation: null
  },
  {
    id: 'q-ho-lighthouse-coastal',
    applicationId: 'rfq-mavericks-home-001',
    carrierId: 'lighthouse',
    carrierName: 'Lighthouse Casualty',
    carrierAccent: '#0b827c',
    status: 'received',
    recommended: true,
    annualPremium: 6980,
    amBest: 'A+',
    validUntil: '2026-11-30',
    planName: 'Coastal Choice',
    policyForm: 'Homeowners (HO 00 03)',
    term: '12 months',
    planNotes: 'Best value - holds expiring limits, halves the wind/hail deductible',
    dwellingLimit: '$685,000',
    otherStructures: '$68,500',
    personalProperty: '$342,500',
    lossOfUse: '$137,000',
    personalLiability: '$500,000',
    medicalPayments: '$5,000',
    allPerilsDeductible: '$1,000',
    windHailDeductible: '1% ($6,850)',
    roofSettlement: 'Replacement cost',
    waterBackup: '$25,000',
    ordinanceOrLaw: '25% of Dwelling',
    scheduledItems: '$39,100 scheduled',
    aiRecommendation: {
      bestValue: true,
      confidence: 0.94,
      reason:
        'Best value. Holds every expiring limit on the Dale Mabry dwelling while cutting the all-perils deductible to $1,000 and halving the wind/hail deductible to 1%, which is the exposure that matters 1.2 miles off the coast - at roughly 12% below the expiring premium.',
      bullets: [
        'Most Competitive Cost-to-Coverage Ratio',
        'Holds every expiring limit with no reduction',
        'Wind/hail deductible halved to 1% - $6,850 instead of $13,700 out of pocket',
        'Roughly 12% below the expiring premium - best in class for value'
      ]
    }
  },
  {
    id: 'q-ho-meridian-value',
    applicationId: 'rfq-mavericks-home-001',
    carrierId: 'meridian',
    carrierName: 'Meridian Auto & Home',
    carrierAccent: '#0250d9',
    status: 'received',
    annualPremium: 6540,
    amBest: 'A-',
    validUntil: '2026-11-15',
    planName: 'Value Home',
    policyForm: 'Homeowners (HO 00 03)',
    term: '12 months',
    planNotes: 'Lowest premium - trades down liability and wind/hail',
    dwellingLimit: '$685,000',
    otherStructures: '$54,800',
    personalProperty: '$274,000',
    lossOfUse: '$102,750',
    personalLiability: '$300,000',
    medicalPayments: '$1,000',
    allPerilsDeductible: '$5,000',
    windHailDeductible: '5% ($34,250)',
    roofSettlement: 'Actual cash value after 10 yrs',
    waterBackup: 'Not included',
    ordinanceOrLaw: 'Not included',
    scheduledItems: 'Ring only ($24,500)',
    aiRecommendation: null
  },

  // ════════ EB - Acme Manufacturing · Group Medical (3 carriers / 8 plans) ════
  {
    id: 'q-bcbs-ppo500',
    applicationId: 'rfq-acme-001',
    carrierId: 'bluecross',
    carrierName: 'BlueCross BlueShield',
    carrierAccent: '#066afe',
    status: 'received',
    annualPremium: 648000,
    amBest: 'A',
    validUntil: '2026-01-01',
    employeesEnrolled: 46,
    // Plan Information
    planName: 'Blue PPO Buy-Up $500',
    fundingType: 'Fully Insured',
    planType: 'PPO',
    networkType: 'BlueCard PPO',
    planNotes: 'Richest BlueCross option',
    // Legacy picker fields
    plan: 'PPO',
    deductible: '$500',
    copay: '$20 / $40',
    oopMax: '$3,000',
    network: 'BlueCard PPO',
    // In-Network
    inDedInd: '$500',
    inDedFam: '$1,000',
    inOopInd: '$3,000',
    inOopFam: '$6,000',
    inCoinsurance: '10%',
    inInpatient: '10% after deductible',
    inOutpatientSurgery: '10% after deductible',
    inEr: '$250 copay + 10%',
    inUrgentCare: '$50 copay',
    inLab: '10% after deductible',
    inXray: '10% after deductible',
    inImaging: '10% after deductible',
    rxTiers: '$10 / $35 / $60 / 25%',
    rxDeductible: '$0',
    // Out-of-Network
    oonDedInd: '$1,500',
    oonDedFam: '$3,000',
    oonOopInd: '$6,000',
    oonOopFam: '$12,000',
    oonCoinsurance: '30%',
    ucrLevel: '150% of Medicare',
    // Canonical benefit map (tier-keyed). Consumed by c-quote-compare-table.
    // Flat inX / oonX fields above are deprecated and kept only for legacy
    // readers - see benefits[attrId][tierId] below for the source of truth.
    benefits: {
      // Keys mirror data/ebCatalog medical ids so this table's
      // rows align with the RFQ Benefits & Copays screen.
      'med-ded-ind':              { in_network: '$500',   out_of_network: '$1,500' },
      'med-ded-fam':              { in_network: '$1,000', out_of_network: '$3,000' },
      'med-oop-ind':              { in_network: '$3,000', out_of_network: '$6,000' },
      'med-oop-fam':              { in_network: '$6,000', out_of_network: '$12,000' },
      'med-coinsurance-pct':      { in_network: '10%',    out_of_network: '30%' },
      'med-pcp':                  { in_network: '$20 copay' },
      'med-spec':                 { in_network: '$40 copay' },
      'med-virtual':              { in_network: '$0 copay' },
      'med-preventive':           { in_network: 'Covered in Full' },
      'med-preventive-coins':     { in_network: '0%' },
      'med-er':                   { in_network: '$250 copay + 10%' },
      'med-urgent':               { in_network: '$50 copay' },
      'med-inpatient':            { in_network: '10% after deductible' },
      'med-outpatient':           { in_network: '10% after deductible' },
      'med-lab':                  { in_network: '10% after deductible' },
      'med-complex-imaging':      { in_network: '10% after deductible' },
      'med-hospital-coinsurance': { in_network: '10%',    out_of_network: '30%' },
      'med-rx-generic':           { in_network: '$10 copay' },
      'med-rx-preferred':         { in_network: '$35 copay' },
      'med-rx-nonpreferred':      { in_network: '$60 copay' },
      'med-rx-specialty':         { in_network: '25% coinsurance' }
    },
    aiRecommendation: null
  },
  {
    id: 'q-bcbs-ppo1500',
    applicationId: 'rfq-acme-001',
    carrierId: 'bluecross',
    carrierName: 'BlueCross BlueShield',
    carrierAccent: '#066afe',
    status: 'expiring',
    incumbent: true,
    recommended: true,
    annualPremium: 612000,
    amBest: 'A',
    validUntil: '2026-01-01',
    employeesEnrolled: 47,
    planName: 'Blue PPO Base $1,500',
    fundingType: 'Fully Insured',
    planType: 'PPO',
    networkType: 'BlueCard PPO',
    planNotes: 'Incumbent - current plan',
    plan: 'PPO',
    deductible: '$1,500',
    copay: '$25 / $50',
    oopMax: '$6,000',
    network: 'BlueCard PPO',
    inDedInd: '$1,500',
    inDedFam: '$3,000',
    inOopInd: '$6,000',
    inOopFam: '$12,000',
    inCoinsurance: '20%',
    inInpatient: '20% after deductible',
    inOutpatientSurgery: '20% after deductible',
    inEr: '$350 copay + 20%',
    inUrgentCare: '$60 copay',
    inLab: '20% after deductible',
    inXray: '20% after deductible',
    inImaging: '20% after deductible',
    rxTiers: '$15 / $45 / $75 / 30%',
    rxDeductible: '$0',
    oonDedInd: '$3,000',
    oonDedFam: '$6,000',
    oonOopInd: '$12,000',
    oonOopFam: '$24,000',
    oonCoinsurance: '40%',
    ucrLevel: '150% of Medicare',
    // Canonical benefit map (tier-keyed). Also seeded with a
    // `preferred_network` tier on the highlighted attrs so the
    // multi-tier UI shows in the demo.
    benefits: {
      // ebCatalog-aligned keys; preferred_network tier retained
      // from the multi-tier demo seed.
      'med-ded-ind':              { in_network: '$1,500', out_of_network: '$3,000',  preferred_network: '$1,000' },
      'med-ded-fam':              { in_network: '$3,000', out_of_network: '$6,000',  preferred_network: '$2,000' },
      'med-oop-ind':              { in_network: '$6,000', out_of_network: '$12,000', preferred_network: '$4,500' },
      'med-oop-fam':              { in_network: '$12,000',out_of_network: '$24,000', preferred_network: '$9,000' },
      'med-coinsurance-pct':      { in_network: '20%',    out_of_network: '40%',     preferred_network: '15%' },
      'med-pcp':                  { in_network: '$25 copay',                          preferred_network: '$15 copay' },
      'med-spec':                 { in_network: '$50 copay',                          preferred_network: '$30 copay' },
      'med-virtual':              { in_network: '$0 copay' },
      'med-preventive':           { in_network: 'Covered in Full' },
      'med-preventive-coins':     { in_network: '0%' },
      'med-er':                   { in_network: '$350 copay + 20%',                   preferred_network: '$250 copay + 15%' },
      'med-urgent':               { in_network: '$60 copay',                          preferred_network: '$40 copay' },
      'med-inpatient':            { in_network: '20% after deductible' },
      'med-outpatient':           { in_network: '20% after deductible' },
      'med-lab':                  { in_network: '20% after deductible' },
      'med-complex-imaging':      { in_network: '20% after deductible' },
      'med-hospital-coinsurance': { in_network: '20%',    out_of_network: '40%',      preferred_network: '15%' },
      'med-rx-generic':           { in_network: '$15 copay' },
      'med-rx-preferred':         { in_network: '$45 copay' },
      'med-rx-nonpreferred':      { in_network: '$75 copay' },
      'med-rx-specialty':         { in_network: '30% coinsurance' }
    },
    aiRecommendation: {
      bestValue: true,
      confidence: 0.91,
      reason:
        'BlueCross is the incumbent carrier with the strongest network match for Acme\'s Cincinnati footprint. Their 4% renewal beats the straight-through 12% indication, and the BlueCard PPO covers every ZIP code in the census.',
      bullets: [
        'Most Competitive Cost-to-Coverage Ratio',
        'Lowest premium among national PPO options, saving approx. $92,000 annually from last year',
        'Lowest deductible and out-of-pocket max, ensuring less financial burden on employees',
        'Superior Coverage & Access - 100/0 co-insurance after deductible, best in class',
        'Tiered Rx coverage includes specialty drugs at competitive rates',
        'BlueCard PPO covers every ZIP code in the census'
      ]
    }
  },
  {
    id: 'q-bcbs-hsa2500',
    applicationId: 'rfq-acme-001',
    carrierId: 'bluecross',
    carrierName: 'BlueCross BlueShield',
    carrierAccent: '#066afe',
    status: 'received',
    annualPremium: 561000,
    amBest: 'A',
    validUntil: '2026-01-01',
    employeesEnrolled: 44,
    planName: 'Blue HSA $2,500',
    fundingType: 'Fully Insured',
    planType: 'HSA',
    networkType: 'BlueCard PPO',
    planNotes: 'HSA-qualified; employer HSA seed available',
    plan: 'HSA',
    deductible: '$2,500',
    copay: 'Deductible then 20%',
    oopMax: '$5,000',
    network: 'BlueCard PPO',
    inDedInd: '$2,500',
    inDedFam: '$5,000',
    inOopInd: '$5,000',
    inOopFam: '$10,000',
    inCoinsurance: '20%',
    inInpatient: '20% after deductible',
    inOutpatientSurgery: '20% after deductible',
    inEr: '20% after deductible',
    inUrgentCare: '20% after deductible',
    inLab: '20% after deductible',
    inXray: '20% after deductible',
    inImaging: '20% after deductible',
    rxTiers: 'Deductible, then $10 / $40 / $70',
    rxDeductible: 'Combined w/ medical',
    oonDedInd: '$5,000',
    oonDedFam: '$10,000',
    oonOopInd: '$10,000',
    oonOopFam: '$20,000',
    oonCoinsurance: '40%',
    ucrLevel: '150% of Medicare',
    benefits: {
      // HSA plan - most cost-sharing is after deductible, so PCP /
      // Specialist copays don't apply until the deductible is met.
      'med-ded-ind':              { in_network: '$2,500', out_of_network: '$5,000' },
      'med-ded-fam':              { in_network: '$5,000', out_of_network: '$10,000' },
      'med-oop-ind':              { in_network: '$5,000', out_of_network: '$10,000' },
      'med-oop-fam':              { in_network: '$10,000',out_of_network: '$20,000' },
      'med-coinsurance-pct':      { in_network: '20%',    out_of_network: '40%' },
      'med-pcp':                  { in_network: '20% after deductible' },
      'med-spec':                 { in_network: '20% after deductible' },
      'med-virtual':              { in_network: '20% after deductible' },
      'med-preventive':           { in_network: 'Covered in Full' },
      'med-preventive-coins':     { in_network: '0%' },
      'med-er':                   { in_network: '20% after deductible' },
      'med-urgent':               { in_network: '20% after deductible' },
      'med-inpatient':            { in_network: '20% after deductible' },
      'med-outpatient':           { in_network: '20% after deductible' },
      'med-lab':                  { in_network: '20% after deductible' },
      'med-complex-imaging':      { in_network: '20% after deductible' },
      'med-hospital-coinsurance': { in_network: '20%',    out_of_network: '40%' },
      'med-rx-generic':           { in_network: 'Deductible, then $10 copay' },
      'med-rx-preferred':         { in_network: 'Deductible, then $40 copay' },
      'med-rx-nonpreferred':      { in_network: 'Deductible, then $70 copay' },
      'med-rx-specialty':         { in_network: 'Deductible, then 25% coinsurance' }
    },
    aiRecommendation: null
  },
  {
    id: 'q-uhc-choice1000',
    applicationId: 'rfq-acme-001',
    carrierId: 'uhc',
    carrierName: 'UnitedHealthcare',
    carrierAccent: '#1a4d8c',
    status: 'received',
    recommended: true,
    annualPremium: 638400,
    amBest: 'A+',
    validUntil: '2026-01-01',
    employeesEnrolled: 45,
    planName: 'Choice Plus PPO $1,000',
    fundingType: 'Fully Insured',
    planType: 'PPO',
    networkType: 'Choice Plus',
    planNotes: 'Broad national network',
    plan: 'PPO',
    deductible: '$1,000',
    copay: '$25 / $50',
    oopMax: '$5,000',
    network: 'Choice Plus',
    inDedInd: '$1,000',
    inDedFam: '$2,000',
    inOopInd: '$5,000',
    inOopFam: '$10,000',
    inCoinsurance: '20%',
    inInpatient: '20% after deductible',
    inOutpatientSurgery: '20% after deductible',
    inEr: '$300 copay + 20%',
    inUrgentCare: '$50 copay',
    inLab: 'No charge',
    inXray: '20% after deductible',
    inImaging: '20% after deductible',
    rxTiers: '$15 / $45 / $80 / 25%',
    rxDeductible: '$150 (Rx)',
    oonDedInd: '$2,500',
    oonDedFam: '$5,000',
    oonOopInd: '$10,000',
    oonOopFam: '$20,000',
    oonCoinsurance: '40%',
    ucrLevel: '140% of Medicare',
    // Also seeded with a `preferred_network` tier so the multi-tier
    // UI shows in the demo alongside q-bcbs-ppo1500.
    benefits: {
      // ebCatalog-aligned keys; preferred_network tier retained
      // from the multi-tier demo seed.
      'med-ded-ind':              { in_network: '$1,000', out_of_network: '$2,500',  preferred_network: '$750' },
      'med-ded-fam':              { in_network: '$2,000', out_of_network: '$5,000',  preferred_network: '$1,500' },
      'med-oop-ind':              { in_network: '$5,000', out_of_network: '$10,000', preferred_network: '$3,500' },
      'med-oop-fam':              { in_network: '$10,000',out_of_network: '$20,000', preferred_network: '$7,000' },
      'med-coinsurance-pct':      { in_network: '20%',    out_of_network: '40%',     preferred_network: '10%' },
      'med-pcp':                  { in_network: '$25 copay',                          preferred_network: '$15 copay' },
      'med-spec':                 { in_network: '$50 copay',                          preferred_network: '$30 copay' },
      'med-virtual':              { in_network: '$0 copay' },
      'med-preventive':           { in_network: 'Covered in Full' },
      'med-preventive-coins':     { in_network: '0%' },
      'med-er':                   { in_network: '$300 copay + 20%',                   preferred_network: '$200 copay + 10%' },
      'med-urgent':               { in_network: '$50 copay',                          preferred_network: '$30 copay' },
      'med-inpatient':            { in_network: '20% after deductible' },
      'med-outpatient':           { in_network: '20% after deductible' },
      'med-lab':                  { in_network: 'No charge' },
      'med-complex-imaging':      { in_network: '20% after deductible' },
      'med-hospital-coinsurance': { in_network: '20%',    out_of_network: '40%',      preferred_network: '10%' },
      'med-rx-generic':           { in_network: '$15 copay' },
      'med-rx-preferred':         { in_network: '$45 copay' },
      'med-rx-nonpreferred':      { in_network: '$80 copay' },
      'med-rx-specialty':         { in_network: '25% coinsurance' }
    },
    aiRecommendation: null
  },
  {
    id: 'q-uhc-hsa2500',
    applicationId: 'rfq-acme-001',
    carrierId: 'uhc',
    carrierName: 'UnitedHealthcare',
    carrierAccent: '#1a4d8c',
    status: 'received',
    annualPremium: 588000,
    amBest: 'A+',
    validUntil: '2026-01-01',
    employeesEnrolled: 43,
    planName: 'Choice HSA $2,500',
    fundingType: 'Fully Insured',
    planType: 'HSA',
    networkType: 'Choice Plus',
    planNotes: 'HSA-qualified',
    plan: 'HSA',
    deductible: '$2,500',
    copay: 'Deductible then 20%',
    oopMax: '$5,500',
    network: 'Choice Plus',
    inDedInd: '$2,500',
    inDedFam: '$5,000',
    inOopInd: '$5,500',
    inOopFam: '$11,000',
    inCoinsurance: '20%',
    inInpatient: '20% after deductible',
    inOutpatientSurgery: '20% after deductible',
    inEr: '20% after deductible',
    inUrgentCare: '20% after deductible',
    inLab: '20% after deductible',
    inXray: '20% after deductible',
    inImaging: '20% after deductible',
    rxTiers: 'Deductible, then $10 / $45 / $80',
    rxDeductible: 'Combined w/ medical',
    oonDedInd: '$5,000',
    oonDedFam: '$10,000',
    oonOopInd: '$11,000',
    oonOopFam: '$22,000',
    oonCoinsurance: '40%',
    ucrLevel: '140% of Medicare',
    benefits: {
      'med-ded-ind':              { in_network: '$2,500', out_of_network: '$5,000' },
      'med-ded-fam':              { in_network: '$5,000', out_of_network: '$10,000' },
      'med-oop-ind':              { in_network: '$5,500', out_of_network: '$11,000' },
      'med-oop-fam':              { in_network: '$11,000',out_of_network: '$22,000' },
      'med-coinsurance-pct':      { in_network: '20%',    out_of_network: '40%' },
      'med-pcp':                  { in_network: '20% after deductible' },
      'med-spec':                 { in_network: '20% after deductible' },
      'med-virtual':              { in_network: '20% after deductible' },
      'med-preventive':           { in_network: 'Covered in Full' },
      'med-preventive-coins':     { in_network: '0%' },
      'med-er':                   { in_network: '20% after deductible' },
      'med-urgent':               { in_network: '20% after deductible' },
      'med-inpatient':            { in_network: '20% after deductible' },
      'med-outpatient':           { in_network: '20% after deductible' },
      'med-lab':                  { in_network: '20% after deductible' },
      'med-complex-imaging':      { in_network: '20% after deductible' },
      'med-hospital-coinsurance': { in_network: '20%',    out_of_network: '40%' },
      'med-rx-generic':           { in_network: 'Deductible, then $10 copay' },
      'med-rx-preferred':         { in_network: 'Deductible, then $45 copay' },
      'med-rx-nonpreferred':      { in_network: 'Deductible, then $80 copay' },
      'med-rx-specialty':         { in_network: 'Deductible, then 25% coinsurance' }
    },
    aiRecommendation: null
  },
  {
    id: 'q-cigna-oap1500',
    applicationId: 'rfq-acme-001',
    carrierId: 'cigna',
    carrierName: 'Cigna',
    carrierAccent: '#c23934',
    status: 'received',
    annualPremium: 654600,
    amBest: 'A',
    validUntil: '2026-01-01',
    employeesEnrolled: 42,
    planName: 'OAP $1,500',
    fundingType: 'Fully Insured',
    planType: 'OAP',
    networkType: 'Open Access Plus',
    planNotes: 'No referrals required',
    plan: 'OAP',
    deductible: '$1,500',
    copay: '$30 / $60',
    oopMax: '$6,000',
    network: 'Open Access Plus',
    inDedInd: '$1,500',
    inDedFam: '$3,000',
    inOopInd: '$6,000',
    inOopFam: '$12,000',
    inCoinsurance: '20%',
    inInpatient: '20% after deductible',
    inOutpatientSurgery: '20% after deductible',
    inEr: '$350 copay + 20%',
    inUrgentCare: '$60 copay',
    inLab: 'No charge',
    inXray: '20% after deductible',
    inImaging: '20% after deductible',
    rxTiers: '$15 / $50 / $85 / 30%',
    rxDeductible: '$0',
    oonDedInd: '$3,000',
    oonDedFam: '$6,000',
    oonOopInd: '$12,000',
    oonOopFam: '$24,000',
    oonCoinsurance: '40%',
    ucrLevel: 'MRC 1 (110%)',
    benefits: {
      'med-ded-ind':              { in_network: '$1,500', out_of_network: '$3,000' },
      'med-ded-fam':              { in_network: '$3,000', out_of_network: '$6,000' },
      'med-oop-ind':              { in_network: '$6,000', out_of_network: '$12,000' },
      'med-oop-fam':              { in_network: '$12,000',out_of_network: '$24,000' },
      'med-coinsurance-pct':      { in_network: '20%',    out_of_network: '40%' },
      'med-pcp':                  { in_network: '$30 copay' },
      'med-spec':                 { in_network: '$60 copay' },
      'med-virtual':              { in_network: '$0 copay' },
      'med-preventive':           { in_network: 'Covered in Full' },
      'med-preventive-coins':     { in_network: '0%' },
      'med-er':                   { in_network: '$350 copay + 20%' },
      'med-urgent':               { in_network: '$60 copay' },
      'med-inpatient':            { in_network: '20% after deductible' },
      'med-outpatient':           { in_network: '20% after deductible' },
      'med-lab':                  { in_network: 'No charge' },
      'med-complex-imaging':      { in_network: '20% after deductible' },
      'med-hospital-coinsurance': { in_network: '20%',    out_of_network: '40%' },
      'med-rx-generic':           { in_network: '$15 copay' },
      'med-rx-preferred':         { in_network: '$50 copay' },
      'med-rx-nonpreferred':      { in_network: '$85 copay' },
      'med-rx-specialty':         { in_network: '30% coinsurance' }
    },
    aiRecommendation: null
  },
  {
    id: 'q-cigna-oaphra',
    applicationId: 'rfq-acme-001',
    carrierId: 'cigna',
    carrierName: 'Cigna',
    carrierAccent: '#c23934',
    status: 'received',
    recommended: true,
    annualPremium: 624000,
    amBest: 'A',
    validUntil: '2026-01-01',
    employeesEnrolled: 44,
    planName: 'OAP HRA $2,000',
    fundingType: 'Fully Insured',
    planType: 'HRA',
    networkType: 'Open Access Plus',
    planNotes: 'Employer-funded HRA $1,000',
    plan: 'HRA',
    deductible: '$2,000',
    copay: '$30 / $60',
    oopMax: '$5,500',
    network: 'Open Access Plus',
    inDedInd: '$2,000',
    inDedFam: '$4,000',
    inOopInd: '$5,500',
    inOopFam: '$11,000',
    inCoinsurance: '20%',
    inInpatient: '20% after deductible',
    inOutpatientSurgery: '20% after deductible',
    inEr: '$300 copay + 20%',
    inUrgentCare: '$50 copay',
    inLab: 'No charge',
    inXray: '20% after deductible',
    inImaging: '20% after deductible',
    rxTiers: '$15 / $50 / $85 / 30%',
    rxDeductible: '$0',
    oonDedInd: '$4,000',
    oonDedFam: '$8,000',
    oonOopInd: '$11,000',
    oonOopFam: '$22,000',
    oonCoinsurance: '40%',
    ucrLevel: 'MRC 1 (110%)',
    benefits: {
      'med-ded-ind':              { in_network: '$2,000', out_of_network: '$4,000' },
      'med-ded-fam':              { in_network: '$4,000', out_of_network: '$8,000' },
      'med-oop-ind':              { in_network: '$5,500', out_of_network: '$11,000' },
      'med-oop-fam':              { in_network: '$11,000',out_of_network: '$22,000' },
      'med-coinsurance-pct':      { in_network: '20%',    out_of_network: '40%' },
      'med-pcp':                  { in_network: '$30 copay' },
      'med-spec':                 { in_network: '$60 copay' },
      'med-virtual':              { in_network: '$0 copay' },
      'med-preventive':           { in_network: 'Covered in Full' },
      'med-preventive-coins':     { in_network: '0%' },
      'med-er':                   { in_network: '$300 copay + 20%' },
      'med-urgent':               { in_network: '$50 copay' },
      'med-inpatient':            { in_network: '20% after deductible' },
      'med-outpatient':           { in_network: '20% after deductible' },
      'med-lab':                  { in_network: 'No charge' },
      'med-complex-imaging':      { in_network: '20% after deductible' },
      'med-hospital-coinsurance': { in_network: '20%',    out_of_network: '40%' },
      'med-rx-generic':           { in_network: '$15 copay' },
      'med-rx-preferred':         { in_network: '$50 copay' },
      'med-rx-nonpreferred':      { in_network: '$85 copay' },
      'med-rx-specialty':         { in_network: '30% coinsurance' }
    },
    aiRecommendation: null
  },
  {
    id: 'q-cigna-hsa3000',
    applicationId: 'rfq-acme-001',
    carrierId: 'cigna',
    carrierName: 'Cigna',
    carrierAccent: '#c23934',
    status: 'received',
    annualPremium: 543000,
    amBest: 'A',
    validUntil: '2026-01-01',
    employeesEnrolled: 40,
    planName: 'OAP HSA $3,000',
    fundingType: 'Fully Insured',
    planType: 'HSA',
    networkType: 'Open Access Plus',
    planNotes: 'Lowest premium; HSA-qualified',
    plan: 'HSA',
    deductible: '$3,000',
    copay: 'Deductible then 30%',
    oopMax: '$6,000',
    network: 'Open Access Plus',
    inDedInd: '$3,000',
    inDedFam: '$6,000',
    inOopInd: '$6,000',
    inOopFam: '$12,000',
    inCoinsurance: '30%',
    inInpatient: '30% after deductible',
    inOutpatientSurgery: '30% after deductible',
    inEr: '30% after deductible',
    inUrgentCare: '30% after deductible',
    inLab: '30% after deductible',
    inXray: '30% after deductible',
    inImaging: '30% after deductible',
    rxTiers: 'Deductible, then $10 / $50 / $90',
    rxDeductible: 'Combined w/ medical',
    oonDedInd: '$6,000',
    oonDedFam: '$12,000',
    oonOopInd: '$12,000',
    oonOopFam: '$24,000',
    oonCoinsurance: '50%',
    ucrLevel: 'MRC 1 (110%)',
    benefits: {
      'med-ded-ind':              { in_network: '$3,000', out_of_network: '$6,000' },
      'med-ded-fam':              { in_network: '$6,000', out_of_network: '$12,000' },
      'med-oop-ind':              { in_network: '$6,000', out_of_network: '$12,000' },
      'med-oop-fam':              { in_network: '$12,000',out_of_network: '$24,000' },
      'med-coinsurance-pct':      { in_network: '30%',    out_of_network: '50%' },
      'med-pcp':                  { in_network: '30% after deductible' },
      'med-spec':                 { in_network: '30% after deductible' },
      'med-virtual':              { in_network: '30% after deductible' },
      'med-preventive':           { in_network: 'Covered in Full' },
      'med-preventive-coins':     { in_network: '0%' },
      'med-er':                   { in_network: '30% after deductible' },
      'med-urgent':               { in_network: '30% after deductible' },
      'med-inpatient':            { in_network: '30% after deductible' },
      'med-outpatient':           { in_network: '30% after deductible' },
      'med-lab':                  { in_network: '30% after deductible' },
      'med-complex-imaging':      { in_network: '30% after deductible' },
      'med-hospital-coinsurance': { in_network: '30%',    out_of_network: '50%' },
      'med-rx-generic':           { in_network: 'Deductible, then $10 copay' },
      'med-rx-preferred':         { in_network: 'Deductible, then $50 copay' },
      'med-rx-nonpreferred':      { in_network: 'Deductible, then $90 copay' },
      'med-rx-specialty':         { in_network: 'Deductible, then 25% coinsurance' }
    },
    aiRecommendation: null
  },

  // ════════ EB - Nova Health Inc. · Group Medical (3 carriers / 3 plans) ════
  // Demo RFQ that opts into the benefit-first compare layout via
  // COMPARE_LAYOUT_BY_APPLICATION_ID. Uses broker-named tier ids
  // (core_ppo / wide_ppo / preferred_rx) whose display labels come
  // from TIER_LABELS_BY_APPLICATION_ID below. `benefits` is the sole
  // source of tier-scoped data - no legacy inX / oonX flat fields.
  {
    id: 'q-nova-bcbs-core',
    applicationId: 'rfq-nova-001',
    carrierId: 'bluecross',
    carrierName: 'BlueCross BlueShield',
    carrierAccent: '#066afe',
    status: 'received',
    annualPremium: 384000,
    amBest: 'A',
    validUntil: '2026-04-01',
    employeesEnrolled: 28,
    planName: 'Blue Core PPO $1,000',
    fundingType: 'Fully Insured',
    planType: 'PPO',
    networkType: 'BlueCard PPO',
    planNotes: 'Custom-tier layout demo (Nova Health)',
    benefits: {
      // ebCatalog-aligned keys; broker-named tier ids
      // (core_ppo / wide_ppo / preferred_rx) preserved per
      // the custom-tier layout demo.
      'med-ded-ind':          { core_ppo: '$1,000', wide_ppo: '$2,500' },
      'med-ded-fam':          { core_ppo: '$2,000', wide_ppo: '$5,000' },
      'med-oop-ind':          { core_ppo: '$4,000', wide_ppo: '$8,000' },
      'med-oop-fam':          { core_ppo: '$8,000', wide_ppo: '$16,000' },
      'med-coinsurance-pct':  { core_ppo: '15%',    wide_ppo: '30%' },
      'med-pcp':              { core_ppo: '$20 copay', wide_ppo: '$40 copay' },
      'med-spec':             { core_ppo: '$40 copay', wide_ppo: '$70 copay' },
      'med-virtual':          { core_ppo: '$0 copay' },
      'med-preventive':       { core_ppo: 'Covered in Full' },
      'med-preventive-coins': { core_ppo: '0%' },
      'med-er':               { core_ppo: '$250 copay + 15%', wide_ppo: '$400 copay + 30%' },
      'med-urgent':           { core_ppo: '$45 copay',        wide_ppo: '$90 copay' },
      'med-rx-generic':       { preferred_rx: '$10 copay' },
      'med-rx-preferred':     { preferred_rx: '$35 copay' },
      'med-rx-nonpreferred':  { preferred_rx: '$60 copay' },
      'med-rx-specialty':     { preferred_rx: '25% coinsurance' }
    },
    aiRecommendation: {
      bestValue: true,
      confidence: 0.87,
      reason:
        'BlueCore PPO carries the lowest premium among the three quotes and its Preferred Rx tier keeps drug costs predictable for Nova\'s largely on-prescription workforce.',
      bullets: [
        'Lowest annual premium of the three ($384K vs $412K / $402K)',
        'Preferred Rx tier: $0 deductible, tiered copays',
        'Wide PPO fallback for out-of-area employees'
      ]
    }
  },
  {
    id: 'q-nova-uhc-connect',
    applicationId: 'rfq-nova-001',
    carrierId: 'uhc',
    carrierName: 'UnitedHealthcare',
    carrierAccent: '#1a4d8c',
    status: 'received',
    annualPremium: 412000,
    amBest: 'A+',
    validUntil: '2026-04-01',
    employeesEnrolled: 30,
    planName: 'UHC Connect PPO $1,500',
    fundingType: 'Fully Insured',
    planType: 'PPO',
    networkType: 'Choice Plus',
    planNotes: 'Custom-tier layout demo (Nova Health)',
    benefits: {
      'med-ded-ind':          { core_ppo: '$1,500', wide_ppo: '$3,000' },
      'med-ded-fam':          { core_ppo: '$3,000', wide_ppo: '$6,000' },
      'med-oop-ind':          { core_ppo: '$5,000', wide_ppo: '$10,000' },
      'med-oop-fam':          { core_ppo: '$10,000',wide_ppo: '$20,000' },
      'med-coinsurance-pct':  { core_ppo: '20%',    wide_ppo: '40%' },
      'med-pcp':              { core_ppo: '$25 copay', wide_ppo: '$50 copay' },
      'med-spec':             { core_ppo: '$50 copay', wide_ppo: '$85 copay' },
      'med-virtual':          { core_ppo: '$0 copay' },
      'med-preventive':       { core_ppo: 'Covered in Full' },
      'med-preventive-coins': { core_ppo: '0%' },
      'med-er':               { core_ppo: '$300 copay + 20%', wide_ppo: '$450 copay + 40%' },
      'med-urgent':           { core_ppo: '$50 copay',        wide_ppo: '$100 copay' },
      'med-rx-generic':       { preferred_rx: '$15 copay' },
      'med-rx-preferred':     { preferred_rx: '$45 copay' },
      'med-rx-nonpreferred':  { preferred_rx: '$80 copay' },
      'med-rx-specialty':     { preferred_rx: '30% coinsurance' }
    },
    aiRecommendation: null
  },
  {
    id: 'q-nova-cigna-open',
    applicationId: 'rfq-nova-001',
    carrierId: 'cigna',
    carrierName: 'Cigna',
    carrierAccent: '#c23934',
    status: 'received',
    annualPremium: 402000,
    amBest: 'A',
    validUntil: '2026-04-01',
    employeesEnrolled: 29,
    planName: 'Cigna Open Access $1,250',
    fundingType: 'Fully Insured',
    planType: 'OAP',
    networkType: 'Open Access Plus',
    planNotes: 'Custom-tier layout demo (Nova Health)',
    benefits: {
      'med-ded-ind':          { core_ppo: '$1,250', wide_ppo: '$2,750' },
      'med-ded-fam':          { core_ppo: '$2,500', wide_ppo: '$5,500' },
      'med-oop-ind':          { core_ppo: '$4,500', wide_ppo: '$9,000' },
      'med-oop-fam':          { core_ppo: '$9,000', wide_ppo: '$18,000' },
      'med-coinsurance-pct':  { core_ppo: '20%',    wide_ppo: '35%' },
      'med-pcp':              { core_ppo: '$25 copay', wide_ppo: '$45 copay' },
      'med-spec':             { core_ppo: '$50 copay', wide_ppo: '$80 copay' },
      'med-virtual':          { core_ppo: '$0 copay' },
      'med-preventive':       { core_ppo: 'Covered in Full' },
      'med-preventive-coins': { core_ppo: '0%' },
      'med-er':               { core_ppo: '$275 copay + 20%', wide_ppo: '$425 copay + 35%' },
      'med-urgent':           { core_ppo: '$55 copay',        wide_ppo: '$95 copay' },
      'med-rx-generic':       { preferred_rx: '$12 copay' },
      'med-rx-preferred':     { preferred_rx: '$40 copay' },
      'med-rx-nonpreferred':  { preferred_rx: '$70 copay' },
      'med-rx-specialty':     { preferred_rx: '28% coinsurance' }
    },
    aiRecommendation: null
  }
];

// Per-RFQ tier-label lookup. Applies when a compared quote's
// applicationId maps to a set of broker-named tier ids that aren't in
// the preset EB_TIER_ORDER list on c-quote-compare-table. Absent
// entries fall through to a titlecased id ("core_ppo" → "Core PPO").
export const TIER_LABELS_BY_APPLICATION_ID = {
  'rfq-nova-001': {
    core_ppo:     'Core PPO',
    wide_ppo:     'Wide PPO',
    preferred_rx: 'Preferred Rx'
  }
};

// Which compare-table layout each RFQ opts into. Absent RFQs default
// to 'benefit-first' (each benefit attribute is its own header with
// tier sub-rows underneath - matches the RFQ Benefits screen). Set an
// entry to 'tier-first' to opt an RFQ into the legacy layout where
// each tier is its own section band with all attributes listed under
// it. The Nova entry is redundant with today's default but is kept
// pinned as documentation of the demo RFQ's intended layout.
export const COMPARE_LAYOUT_BY_APPLICATION_ID = {
  'rfq-nova-001': 'benefit-first'
};

// Top-of-page narrative stats for the Compare screen.
export const marketStats = {
  totalMarketsApproached: 9,
  quotesReceived: 9,
  shortlistedCount: 3,
  queuedCount: 0
};

// ─────────────────────────────────────────────────────────────────────────────
// SLACK DRAWER - shared #acct-broker-team channel
// Both account narratives flow into the same channel. Each async msg_*_quote_ready
// system notification carries its own applicationId on the action button so the
// modal knows which RFQ to open.
// ─────────────────────────────────────────────────────────────────────────────
export const slackData = {
  channelName: '#acct-broker-team',
  members: ['James Field', 'Shelly Taylor', 'Marcus Vance', 'Elena Rostova', 'Agentforce'],
  messages: [
    // ── Mavericks Personal Auto narrative ──
    {
      id: 'msg_001',
      timestamp: '9:42 AM',
      sender: 'James Field',
      role: 'Producer',
      avatarType: 'user',
      text: '📋 Mavericks Household auto renewal is up in 42 days. James wants to add his father Joseph to the policy as a second rated driver. Apex Mutual wants a 9% increase. Worth shopping.'
    },
    {
      id: 'msg_002',
      timestamp: '9:46 AM',
      sender: 'Elena Rostova',
      role: 'Account Manager',
      avatarType: 'user',
      text: "💻 On it. I'll launch the Guided RFQ from the Mavericks Account and route to Meridian Auto & Home and Pinnacle Standard alongside Apex Mutual. Pre-fill from the 2025 dec page should carry both vehicles + James as the rated driver forward."
    },
    {
      id: 'msg_003',
      timestamp: '9:51 AM',
      sender: 'Agentforce',
      role: 'AI Assistant',
      avatarType: 'bot',
      isSystemAlert: true,
      text: '⚡ [Automated System Notification]: Mavericks Personal Auto RFQ submitted to 3 markets. Recommended carrier set: Apex Mutual (incumbent), Meridian Auto & Home, Pinnacle Standard. Expected response window: 4 - 24 hours.'
    },
    {
      id: 'msg_quote_ready',
      timestamp: 'Just Now',
      sender: 'System Notification',
      role: 'Automated Alert',
      avatarType: 'bot',
      isSystemAlert: true,
      text: '⚡ 3 Markets have responded to the Mavericks RFQ.',
      actionButton: {
        label: 'Compare Quotes',
        actionId: 'open_compare_modal',
        applicationId: 'rfq-mavericks-001'
      }
    },
    // ── Acme Manufacturing Group Medical narrative ──
    {
      id: 'msg_acme_001',
      timestamp: '11:08 AM',
      sender: 'James Field',
      role: 'Producer',
      avatarType: 'user',
      text: "📋 Acme Manufacturing's group medical is up 1/1. BlueCross sent a 12% renewal indication - way above the 4 - 6% trend the loss ratio supports. I'm going to shop the market against UHC and Cigna and bring back a 3-way bake-off for the broker meeting."
    },
    {
      id: 'msg_acme_002',
      timestamp: '11:14 AM',
      sender: 'Agentforce',
      role: 'AI Assistant',
      avatarType: 'bot',
      isSystemAlert: true,
      text: '⚡ [Automated System Notification]: Acme Manufacturing Group Medical RFQ submitted to 3 markets. 50-employee census validated. Plan designs: Base HMO, Buy-up PPO, HDHP. Expected response window: 24 - 48 hours.'
    },
    {
      id: 'msg_acme_quote_ready',
      timestamp: 'Just Now',
      sender: 'System Notification',
      role: 'Automated Alert',
      avatarType: 'bot',
      isSystemAlert: true,
      text: '⚡ 3 Markets have responded to the Acme Manufacturing Medical RFQ.',
      actionButton: {
        label: 'Compare Quotes',
        actionId: 'open_compare_modal',
        applicationId: 'rfq-acme-001'
      }
    }
  ]
};

const MAVERICKS_ACCOUNT_ID = '001SB00001oXwntYAC';
const MAVERICKS_SLACK_MEMBERS = [
  'Elena Rostova',
  'Priya Shah',
  'James Field',
  'Broker Agent'
];

// Every line the household carries, with the pattern that identifies it in a
// meeting's line label, name, or event subject. Tested independently rather
// than as one alternation, so a subject naming two lines is recognisable as a
// household review instead of silently resolving to whichever branch matched
// first. Order is only the order the labels read back in.
const MAVERICKS_LINE_PATTERNS = [
  ['Personal Auto', /\bauto\b|\bvehicles?\b/],
  ['Homeowners', /\bhome\s?owners?\b|\bhome\b|\bdwelling\b/],
  ['Personal Umbrella', /\bumbrella\b/],
  ['Renters', /\brenters?\b|\brental\b/]
];

// One entry per thread this channel knows how to hold, keyed by the line the
// meeting resolves to.
//
// Personal Umbrella and Renters are deliberately absent. Neither has a single
// carrier response anywhere in the mock data, and the Renters RFQ is still at
// 'Ready for Submission', so a quote thread for either would contradict the
// account's own Submission Board. A meeting on one of those lines alone gets
// no channel at all, the same as a non-Mavericks meeting. A meeting that
// covers one of them *alongside* another line is a household review and lands
// on 'Household' below.
const MAVERICKS_SLACK_BY_LINE = {
  'Personal Auto': {
    stage: 'quoted',
    applicationId: 'rfq-mavericks-001',
    marketCount: 3,
    markets: 'Apex Mutual, Meridian Auto & Home, and Pinnacle Standard',
    renewalNote: 'renews October 13 on $14,850 of expiring premium, and Apex Mutual came back up 22%',
    claimsQuestion:
      'Before we make a recommendation, which carrier is generally strongest on auto claim settlements for this risk? Price matters, but claims service will drive the client conversation.',
    claimsInsight:
      'The internal claims-service scorecard currently favors Apex Mutual for this auto profile, with Pinnacle Standard close behind on settlement consistency. Compare response time, repair-network access, and settlement consistency alongside premium. Keep the open wind and hail auto claim in the final recommendation.'
  },
  Homeowners: {
    stage: 'quoted',
    applicationId: 'rfq-mavericks-home-001',
    marketCount: 3,
    markets: 'Apex Mutual, Lighthouse Casualty, and Meridian Auto & Home',
    renewalNote: 'renews December 1 on $4,120 of expiring premium, inside the same window as the auto policy',
    claimsQuestion:
      'Before we make a recommendation, which carrier handles property losses best on a household like this one? Deductible treatment will matter more to James than a small premium difference.',
    claimsInsight:
      'The internal claims-service scorecard currently favors Lighthouse Casualty for complex property losses, with Apex Mutual also scoring well on settlement consistency. Compare deductible handling and catastrophe response alongside premium, and note the wind and hail deductible is a percentage of the dwelling limit on every quote in the set.'
  },
  // A review spanning more than one line, or a Mavericks meeting that names no
  // line at all. Talks about the renewal calendar and the umbrella limit,
  // which is what those sessions are actually for, and claims no single
  // line's carrier count because there isn't one to claim.
  Household: {
    stage: 'household'
  }
};

/**
 * Which thread a Mavericks meeting should show.
 *
 * An explicit `lineLabel` wins outright - it is set from the compare modal's
 * locLabel and carried through the proposal and booking chain, so it is the
 * only signal that was actually chosen rather than inferred. Otherwise the
 * meeting's own text is searched, and naming two or more lines resolves to a
 * household review rather than to either line on its own.
 */
function mavericksMeetingLine(meeting = {}) {
  const linesIn = (text) => {
    const haystack = String(text || '').toLowerCase();
    return MAVERICKS_LINE_PATTERNS.filter(([, pattern]) => pattern.test(haystack)).map(
      ([label]) => label
    );
  };

  const labelled = linesIn(meeting.lineLabel);
  if (labelled.length === 1) return labelled[0];
  if (labelled.length > 1) return 'Household';

  const matched = linesIn([meeting.name, meeting.eventSubject, meeting.id].filter(Boolean).join(' '));
  return matched.length === 1 ? matched[0] : 'Household';
}

const MAVERICKS_SLACK_LINE_IDS = {
  'Personal Auto': 'personal-auto',
  Homeowners: 'homeowners',
  Household: 'household'
};

// Elena and Priya carry explicit swatches so they stay distinguishable if a
// headshot ever fails to load; see src/assets/avatars.
function _mavericksSender(who) {
  if (who === 'priya') {
    return {
      sender: 'Priya Shah',
      role: 'Principal / Finance',
      avatarType: 'user',
      avatarColor: '#7c3aed'
    };
  }
  if (who === 'elena') {
    return {
      sender: 'Elena Rostova',
      role: 'Account Manager',
      avatarType: 'user',
      avatarColor: '#066afe'
    };
  }
  if (who === 'james') {
    return { sender: 'James Field', role: 'Producer', avatarType: 'user' };
  }
  return {
    sender: 'Broker Agent',
    role: 'Brokerage Assistant',
    avatarType: 'bot',
    isSystemAlert: true
  };
}

// A single-line renewal that has actually been to market: notice, RFQ,
// claims-service question, then the comparison the meeting reviews.
function _mavericksQuotedThread(line, lineId, config) {
  return [
    {
      id: `mavericks-${lineId}-renewal`,
      timestamp: '9:08 AM',
      ..._mavericksSender('priya'),
      text: `I saw the Mavericks ${line} policy ${config.renewalNote}. Are we ready to start the market review?`
    },
    {
      id: `mavericks-${lineId}-start`,
      timestamp: '9:11 AM',
      ..._mavericksSender('elena'),
      text: `Yes, I got the update. I will start the ${line} renewal quote and keep the account team posted here.`
    },
    {
      id: `mavericks-${lineId}-rfq`,
      timestamp: '9:18 AM',
      ..._mavericksSender('agent'),
      text: `${line} RFQ submitted to ${config.marketCount} carriers. Markets: ${config.markets}.`
    },
    {
      id: `mavericks-${lineId}-claims-question`,
      timestamp: '9:24 AM',
      ..._mavericksSender('james'),
      text: config.claimsQuestion
    },
    {
      id: `mavericks-${lineId}-claims-insight`,
      timestamp: '9:27 AM',
      ..._mavericksSender('agent'),
      text: `Claims insight ready. ${config.claimsInsight}`
    },
    {
      id: `mavericks-${lineId}-quotes`,
      timestamp: '10:02 AM',
      ..._mavericksSender('agent'),
      text: `${config.marketCount} of ${config.marketCount} carrier responses received for the Mavericks ${line} RFQ. The quote comparison is ready for review.`,
      actionButton: {
        label: 'Compare Quotes',
        actionId: 'open_compare_modal',
        applicationId: config.applicationId
      }
    }
  ];
}

// A review spanning more than one line. There is no single RFQ behind it, so
// this thread stays on the renewal calendar and the umbrella limit rather than
// quoting a carrier count, and offers no comparison to open.
function _mavericksHouseholdThread(lineId) {
  return [
    {
      id: `mavericks-${lineId}-calendar`,
      timestamp: '9:08 AM',
      ..._mavericksSender('priya'),
      text: 'All three Mavericks lines renew inside the same window this year. Are we reviewing them together rather than one call at a time?'
    },
    {
      id: `mavericks-${lineId}-start`,
      timestamp: '9:11 AM',
      ..._mavericksSender('elena'),
      text: 'Yes. James asked for one household session, so I am pulling the auto, umbrella, and homeowners reviews into a single agenda.'
    },
    {
      id: `mavericks-${lineId}-schedule`,
      timestamp: '9:18 AM',
      ..._mavericksSender('agent'),
      text: 'Renewal calendar posted. Personal Auto renews October 13 on $14,850, Personal Umbrella November 15 on $640, and Homeowners December 1 on $4,120. Household premium totals $19.6K across the three lines.'
    },
    {
      id: `mavericks-${lineId}-umbrella-question`,
      timestamp: '9:24 AM',
      ..._mavericksSender('james'),
      text: 'Two drivers went onto the auto policy mid-term. Does $1M of umbrella still fit this household, or do we need to walk in with a higher limit?'
    },
    {
      id: `mavericks-${lineId}-umbrella-insight`,
      timestamp: '9:27 AM',
      ..._mavericksSender('agent'),
      text: 'Exposure review ready. The umbrella has stayed at the $1M limit it was written at while household liability has grown, so the limit is the open question in this session. Northgate Mutual is the incumbent, and any limit change should follow the auto outcome rather than lead it.'
    }
  ];
}

/**
 * Account-level Slack thread for a Mavericks meeting, scoped to the line of
 * coverage that meeting is about. The global Slack drawer keeps its shared
 * agency channel; this factory only powers Meeting Center.
 *
 * Returns null - which renders the disconnected card - for a non-Mavericks
 * meeting, and for a meeting on a line this channel holds no thread for.
 */
export function getMeetingSlackData(meeting) {
  if (!meeting) return null;
  if (meeting.accountId !== MAVERICKS_ACCOUNT_ID) return null;

  const line = mavericksMeetingLine(meeting);
  const config = MAVERICKS_SLACK_BY_LINE[line];
  if (!config) return null;

  const lineId = MAVERICKS_SLACK_LINE_IDS[line];
  const scheduledDate = formatUsDate(meeting.dateKey);
  const scheduledFor = meeting.startTime
    ? `${meeting.startTime}${scheduledDate ? ` on ${scheduledDate}` : ''}`
    : 'the confirmed time';
  const reviewLabel = config.stage === 'household' ? 'Household coverage' : line;

  const messages =
    config.stage === 'household'
      ? _mavericksHouseholdThread(lineId)
      : _mavericksQuotedThread(line, lineId, config);

  return {
    channelName: '#mavericks-account-team',
    members: MAVERICKS_SLACK_MEMBERS,
    messages: [
      ...messages,
      {
        id: `mavericks-${lineId}-meeting-${meeting.id || 'current'}`,
        timestamp: 'Just Now',
        ..._mavericksSender('agent'),
        text: `Meeting scheduled. ${reviewLabel} review with James Mavericks is set for ${scheduledFor}.`
      }
    ]
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PORTED FROM force-app/main/default/lwc/rfqConstants/rfqConstants.js
// Kept verbatim so the catalog stays the source of truth for the data model.
// ─────────────────────────────────────────────────────────────────────────────
export const ITEM_TYPES = {
  location: {
    key: 'location',
    label: 'Location',
    lob: ['property'],
    fields: [
      { key: 'name', label: 'Location Name', type: 'text', required: true },
      { key: 'address', label: 'Address', type: 'text', required: true },
      { key: 'protectionClass', label: 'Protection Class', type: 'select' }
    ]
  },
  building: {
    key: 'building',
    label: 'Building',
    lob: ['property'],
    fields: [
      { key: 'name', label: 'Building Name', type: 'text', required: true },
      { key: 'value', label: 'Building Value', type: 'number', required: true, isMoney: true },
      { key: 'construction', label: 'Construction Type', type: 'select' },
      { key: 'occupancy', label: 'Occupancy', type: 'select' }
    ]
  },
  equipment: {
    key: 'equipment',
    label: 'Equipment',
    lob: ['property', 'auto'],
    fields: [
      { key: 'name', label: 'Equipment Name', type: 'text', required: true },
      { key: 'value', label: 'Replacement Value', type: 'number', required: true, isMoney: true }
    ]
  },
  vehicle: {
    key: 'vehicle',
    label: 'Vehicle',
    lob: ['auto'],
    fields: [
      { key: 'name', label: 'Vehicle Description', type: 'text', required: true },
      { key: 'year', label: 'Year', type: 'number', required: true },
      { key: 'make', label: 'Make', type: 'text', required: true },
      { key: 'model', label: 'Model', type: 'text', required: true },
      { key: 'vin', label: 'VIN', type: 'text' },
      { key: 'value', label: 'Stated Value', type: 'number', isMoney: true, required: true }
    ]
  }
};

export const COVERAGE_CATALOG = {
  cgl: {
    key: 'cgl',
    name: 'Commercial General Liability',
    code: 'CG 00 01',
    form: 'ACORD 125',
    applicableTo: [POLICY_TARGET]
  },
  umbrella: {
    key: 'umbrella',
    name: 'Commercial Umbrella / Excess',
    code: 'CU 00 01',
    form: 'ACORD 131',
    applicableTo: [POLICY_TARGET]
  },
  cyber: {
    key: 'cyber',
    name: 'Cyber Liability',
    code: 'CYB 1001',
    form: 'ACORD 125',
    applicableTo: [POLICY_TARGET]
  },
  workers_comp: {
    key: 'workers_comp',
    name: "Workers' Compensation",
    code: 'WC 00 00',
    form: 'ACORD 130',
    applicableTo: [POLICY_TARGET]
  },
  auto_liability: {
    key: 'auto_liability',
    name: 'Auto Liability',
    code: 'CA 00 01',
    form: 'ACORD 137',
    applicableTo: ['vehicle', POLICY_TARGET]
  },
  auto_physical: {
    key: 'auto_physical',
    name: 'Physical Damage - Comp & Collision',
    code: 'CA 00 20',
    form: 'ACORD 137',
    applicableTo: ['vehicle']
  },
  hired_nonowned: {
    key: 'hired_nonowned',
    name: 'Hired & Non-Owned Auto',
    code: 'CA 20 01',
    form: 'ACORD 137',
    applicableTo: [POLICY_TARGET]
  },
  pa_liability: {
    key: 'pa_liability',
    name: 'Personal Auto Liability',
    code: 'PP 00 01',
    form: 'ACORD 90',
    applicableTo: [POLICY_TARGET]
  },
  pa_physical: {
    key: 'pa_physical',
    name: 'Personal Auto · Comp & Collision',
    code: 'PP 03 13',
    form: 'ACORD 90',
    applicableTo: ['vehicle']
  }
};

export const MOCK_ACCOUNTS = [
  { id: '001SB00001oXwntYAC', name: 'Mavericks Household', industry: 'Personal Lines', city: 'Tampa, FL' },
  { id: '001EB00002pYzbMAC', name: 'Acme Manufacturing', industry: 'Manufacturing', city: 'Cincinnati, OH' },
  { id: 'a-whitfield', name: 'Whitfield Household', industry: 'Personal Lines', city: 'Sarasota, FL' },
  { id: 'a-sunrise', name: 'Sunrise Agency', industry: 'Brokerage', city: 'Phoenix, AZ' },
  { id: 'a-bluebird', name: 'Bluebird Logistics', industry: 'Transportation', city: 'Memphis, TN' },
  { id: 'a-coastal', name: 'Coastal Restaurants Group', industry: 'Restaurant', city: 'Tampa, FL' }
];

// The subset of MOCK_ACCOUNTS that has a real record page, and therefore
// a workspace tab, in this app. These four are the demo's whole cast -
// every meeting, renewal and insight row points at one of them, so the
// broker can click any account name anywhere and land on a record.
// The remaining `a-*` rows are catalog-only names used for search
// results; rendering them as links would dead-end, so callers gate on
// this set before turning an account name into an anchor.
export const RECORD_PAGE_ACCOUNT_IDS = [
  '001SB00001oXwntYAC',
  '001EB00002pYzbMAC',
  'a-whitfield',
  'a-bluebird'
];

export function accountHasRecordPage(accountId) {
  return RECORD_PAGE_ACCOUNT_IDS.includes(accountId);
}

// Book a meeting onto the Run My Day carousel. `runMyDayMeetings` is
// read straight from this module by c-run-my-day rather than passed in
// as a prop, so a push here is all it takes to seat the meeting - but
// the component stays mounted, so the shell also has to bump a
// revision prop to make it re-read. See c/app handleScheduleMeeting.
export function addRunMyDayMeeting(meeting) {
  if (!meeting || !meeting.dateKey) return null;
  const record = {
    id: meeting.id || `mp-scheduled-${Date.now()}`,
    status: 'In Prep',
    organizer: currentUser.name,
    ...meeting
  };
  runMyDayMeetings.unshift(record);
  return record;
}

function minutesFromDisplay(value) {
  const m = String(value || '')
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return 0;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3].toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

function slotsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// Fill the booked day so Run My Day still looks like a working calendar
// after the broker picks a final-meeting date. Today's carousel already
// has three seeded meetings, so this no-ops there. A future date that
// only has the freshly booked `mp-scheduled-*` row gets two companion
// meetings that miss the booked slot.
export function seedCompanionMeetings(dateKey) {
  if (!dateKey) return [];
  const onDay = runMyDayMeetings.filter((m) => m.dateKey === dateKey);
  const seeded = onDay.filter(
    (m) =>
      !String(m.id).startsWith('mp-scheduled-') &&
      !String(m.id).startsWith('mp-dummy-')
  );
  if (seeded.length >= 2) return [];
  if (onDay.some((m) => String(m.id).startsWith(`mp-dummy-${dateKey}`))) {
    return [];
  }

  const occupied = onDay.map((m) => ({
    start: minutesFromDisplay(m.startTime),
    end: minutesFromDisplay(m.endTime)
  }));

  const candidates = [
    ['8:00 AM', '8:30 AM'],
    ['11:30 AM', '12:00 PM'],
    ['4:00 PM', '4:30 PM']
  ];
  const templates = [
    {
      suffix: '1',
      name: 'Personal Auto Renewal Review - Whitfield Household',
      relatedRecord: 'Whitfield Household',
      accountId: 'a-whitfield',
      eventSubject: 'Whitfield Household - 2026 Personal Auto Renewal'
    },
    {
      suffix: '2',
      name: 'Fleet & Workers Comp Renewal - Bluebird Logistics',
      relatedRecord: 'Bluebird Logistics',
      accountId: 'a-bluebird',
      eventSubject: 'Bluebird Logistics - 2026 Fleet & WC Renewal'
    }
  ];

  const added = [];
  let ci = 0;
  templates.forEach((tpl) => {
    while (ci < candidates.length) {
      const [startTime, endTime] = candidates[ci];
      ci += 1;
      const start = minutesFromDisplay(startTime);
      const end = minutesFromDisplay(endTime);
      const clash = occupied.some((o) =>
        slotsOverlap(start, end, o.start, o.end)
      );
      if (clash) continue;
      const record = {
        id: `mp-dummy-${dateKey}-${tpl.suffix}`,
        status: 'In Prep',
        organizer: currentUser.name,
        dateKey,
        startTime,
        endTime,
        name: tpl.name,
        relatedRecord: tpl.relatedRecord,
        accountId: tpl.accountId,
        eventSubject: tpl.eventSubject
      };
      runMyDayMeetings.push(record);
      occupied.push({ start, end });
      added.push(record);
      break;
    }
  });
  return added;
}

// ISO day key (YYYY-MM-DD), the form `runMyDayMeetings.dateKey` and the
// Run My Day calendar both use.
export function toDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return (
    d.getFullYear() +
    '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0')
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quote-set resolution
//
// Routing simulates carrier responses, so a routed RFQ's quote count is
// whatever the simulation produced. The comparison grid, though, can only
// render quotes that exist in `quotes` above. These helpers keep the two in
// agreement: routing offers only carriers that can return a quote, and the
// grid renders exactly the carriers that answered.
// ─────────────────────────────────────────────────────────────────────────────

// Which seeded quote set a line of coverage compares against. Renters and
// Umbrella have no set of their own and borrow the homeowners quotes, so
// their property attributes populate instead of reading as auto plans.
export const QUOTE_APP_BY_LOC_ID = Object.freeze({
  pa: 'rfq-mavericks-001',
  home: 'rfq-mavericks-home-001',
  renters: 'rfq-mavericks-home-001',
  umbrella: 'rfq-mavericks-home-001',
  medical: 'rfq-acme-001',
  dental: 'rfq-acme-001',
  vision: 'rfq-acme-001',
  life: 'rfq-acme-001'
});

// Carrier ids with at least one quote on file for a line. The Submission
// Board narrows its carrier picker to these so every carrier the broker
// routes to can come back as a real column.
export function carrierIdsWithQuotesForLoc(locId) {
  const appId = QUOTE_APP_BY_LOC_ID[locId];
  if (!appId) return [];
  return [
    ...new Set(
      quotes
        .filter((q) => q.applicationId === appId)
        .map((q) => q.carrierId)
    )
  ];
}

// One quote per carrier, in the order the carriers responded. Carriers
// often have several plans on file; the grid takes the first so its column
// count matches the row's quote count rather than multiplying by plan.
//
// The incumbent's expiring policy lives in this same set, so a carrier that
// is also the incumbent has two entries and the expiring one comes first.
// The grid is showing what each market came back with, so prefer an actual
// response: otherwise the renewal on the board reads at last year's premium
// and the market's real number never appears. The expiring row is still the
// delta baseline in c-quoteCompareTable, which finds it by application
// rather than needing it as a column.
export function quoteIdsForCarriers(locId, carrierIds) {
  const appId = QUOTE_APP_BY_LOC_ID[locId];
  if (!appId || !Array.isArray(carrierIds)) return [];
  const picked = [];
  for (const carrierId of carrierIds) {
    const onFile = quotes.filter(
      (q) => q.applicationId === appId && q.carrierId === carrierId
    );
    const hit = onFile.find((q) => q.status !== 'expiring') || onFile[0];
    if (hit && !picked.includes(hit.id)) picked.push(hit.id);
  }
  return picked;
}
