import { LightningElement, api, track } from 'lwc';
import { getTemplatesByLobAndCoverage, getTick } from 'data/rfqTemplates';
import { nextTermFromPriorEnd } from 'data/dates';

const MODE_SHOP = 'shop_market';
const START_SCRATCH = 'scratch';
const START_CLONE = 'clone';

// Per-flow copy for the locked dropdowns + renewal-path radio cards. The
// flow is derived from the launch context's `lob` + `loc`, so the same
// modal serves Personal Auto (Mavericks Household), Homeowners (also
// Mavericks Household, discriminated by LOC), and Employee Benefits
// (Acme Mfg).
// Line of Business catalog + the coverage lines that hang off each one.
// The LOC dropdown cascades from the selected LOB. Scoped to Personal
// Lines + Employee Benefits only - Commercial Lines and Life & Health
// are out of scope for this build.
const LOB_OPTIONS = [
  'Personal Lines',
  'Employee Benefits'
];

// Per-account LOB gating: some demo accounts only quote a single LOB.
// The intake modal's LOB picker filters to just the entries listed
// here (both id and name keys are honoured so a change to one field
// upstream doesn't break the guard). Accounts not listed here fall
// through to the full LOB_OPTIONS list (no restriction).
const ALLOWED_LOBS_BY_ACCOUNT = {
  '001SB00001oXwntYAC':  ['Personal Lines'],     // Mavericks Household -> PL only
  'Mavericks Household': ['Personal Lines'],
  '001EB00002pYzbMAC':   ['Employee Benefits'],  // Acme Manufacturing  -> EB only
  'Acme Manufacturing':  ['Employee Benefits']
};
const LOC_BY_LOB = {
  'Personal Lines': [
    'Personal Auto',
    'Homeowners',
    'Rental'
  ],
  'Employee Benefits': [
    'Group Medical',
    'Group Dental',
    'Group Vision',
    'Short-Term Disability',
    'Long-Term Disability'
  ]
};

// Personal Auto / Homeowners (PL) and Group Medical / Dental / Vision
// (EB) have working runtimes today. `Rental` is intentionally kept in
// the PL picker even though no runtime exists - it's the demo LOC that
// surfaces the intake modal's "no template" warning banner when picked.
// Any LOC not listed here as `false` is treated as enabled.
const LOC_ENABLED = {
  'Personal Auto': true,
  'Homeowners': true,
  'Rental': true,
  'Short-Term Disability': false,
  'Long-Term Disability': false
};

const FLOW_COPY = {
  pa: {
    lob: 'Personal Lines',
    loc: 'Personal Auto',
    priorPolicy: '2025 Mavericks Auto - Apex Mutual',
    // Structured fallback for the new Prior Policy detail card. These
    // hydrate the inputs when the user picks the incumbent option and
    // clear back to empty when they pick None / Manual Entry. The
    // `effectiveFrom/To` + `vehicleIds/driverIds` keys also drive the
    // downstream PA workspace prefill (term + roster snapshot).
    priorDetail: {
      carrier: 'Apex Mutual',
      policyNumber: 'AM-PA-2025-001-MVK',
      premium: 14850,
      // Years with the incumbent carrier, not years on the line. Apex
      // wrote this book for the first time in 2025, so the renewal being
      // shopped is the end of its first term.
      yearsOfCoverage: 1,
      // Incumbent term - the new RFQ starts the day after this
      // Effective To (n+1) and runs one year from that From date.
      effectiveFrom: '2025-10-13',
      effectiveTo: '2026-10-13',
      // Roster snapshot - ids that the workspace resolves against
      // rfqData.lineItems + drivers at hydration time. Matches the covered
      // assets and rated drivers on the policy record this renewal is
      // launched from (data/policyRecords, pol-mav-pa-2025): the two
      // commuter vehicles, with James the sole rated driver on both. The
      // renewal's story is adding a second driver, so it starts from one.
      vehicleIds: ['veh-crv', 'veh-camry'],
      driverIds: ['drv-james']
    },
    shopDetail:
      'Use the prior data to pre-fill the wizard and gather new quotes from Apex Mutual, Meridian Auto & Home, and Pinnacle Standard.',
    straightDetail: "Accept Apex Mutual's incumbent renewal terms and jump directly to the proposal."
  },
  home: {
    lob: 'Personal Lines',
    loc: 'Homeowners',
    priorPolicy: '2025 Mavericks Homeowners - Chubb',
    priorDetail: {
      carrier: 'Chubb',
      policyNumber: 'CHB-HO-2025-4421-MVK',
      premium: 4120,
      // Homeowners was the founding line in 2018, so 2025 is year eight.
      yearsOfCoverage: 8,
      // Incumbent term - the new RFQ starts the day after this
      // Effective To (n+1).
      effectiveFrom: '2025-12-01',
      effectiveTo: '2026-12-01',
      // Roster snapshot - homeRfqData ids the workspace resolves at
      // hydration time. Chubb 2025 covered the Dale Mabry primary
      // dwelling with all three scheduled items appraised in-house.
      dwellingIds: ['dwl-bayshore'],
      scheduledItemIds: ['sch-jewelry-01', 'sch-art-01', 'sch-collect-01']
    },
    shopDetail:
      'Use the prior data to pre-fill the wizard and gather new quotes from Chubb, Capitol Insurance, and Fortress Group.',
    straightDetail: "Accept Chubb's incumbent renewal terms and jump directly to the proposal."
  },
  eb: {
    lob: 'Employee Benefits',
    loc: 'Group Medical',
    priorPolicy: '2024 Acme Group Medical - UnitedHealthcare (45 Employees)',
    priorDetail: {
      carrier: 'UnitedHealthcare',
      policyNumber: 'UHC-MED-2024-ACME-45',
      premium: 548000,
      yearsOfCoverage: 1,
      // Incumbent policy term - the new RFQ starts the day after
      // this Effective To (n+1).
      effectiveFrom: '2024-01-01',
      effectiveTo: '2025-01-01',
      // Tier split from the incumbent policy (sums to the 45 EEs in the
      // policy label) - used to pre-fill Step 1 of the Guided RFQ wizard.
      headcount: {
        employeeOnly: 23,
        employeeSpouse: 9,
        employeeFamily: 9,
        employeeChildren: 4
      },
      // Incumbent UHC plan values across Medical only - used to pre-fill
      // Step 2 (Benefit Selection). Min/Max bracket the incumbent value
      // so the broker can shop a flexible range or tighten to a single
      // point. The shape mirrors the workspace's `benefits` state keyed
      // by benefit id.
      benefits: {
        // ── Medical · General Plan Information ──
        'med-ded-ind':           { included: true, min: '1750',  max: '2750',  value: '' },
        'med-ded-fam':           { included: true, min: '3500',  max: '5500',  value: '' },
        'med-pcp':               { included: true, min: '30',    max: '45',    value: '' },
        'med-oop-ind':           { included: true, min: '8000',  max: '10500', value: '' },
        'med-oop-fam':           { included: true, min: '16000', max: '21000', value: '' },
        'med-spec':              { included: true, min: '55',    max: '80',    value: '' },
        'med-virtual':           { included: true, min: '',      max: '',      value: '$20 copay' },
        // ── Medical · Outpatient Services ──
        'med-preventive':        { included: true, min: '',      max: '',      value: 'Covered in Full' },
        'med-er':                { included: true, min: '300',   max: '550',   value: '' },
        'med-urgent':            { included: true, min: '60',    max: '110',   value: '' },
        // ── Medical · Prescription Drugs ──
        'med-rx-generic':        { included: true, min: '10',    max: '15',    value: '' },
        'med-rx-preferred':      { included: true, min: '35',    max: '50',    value: '' },
        'med-rx-nonpreferred':   { included: true, min: '65',    max: '85',    value: '' }
      }
    },
    shopDetail:
      'Pre-fill the wizard from the 2024 UnitedHealthcare policy and gather new quotes from BlueCross, UnitedHealthcare, and Cigna.',
    straightDetail: "Accept UnitedHealthcare's +12% renewal indication and jump directly to Bind."
  }
};

// Common PA / EB carriers surfaced as a datalist so brokers can type-ahead
// without locking the input to a finite set. Names are invented, and
// deliberately the same set as the appetite-matrix catalog in
// data/lookupMockData - typing a prior carrier here should resolve to a
// market the Submission Board can actually route to, which is what lets
// it tag the incumbent row on the way out.
const COMMON_CARRIERS = [
  'Apex Mutual',
  'Lighthouse Casualty',
  'Meridian Auto & Home',
  'Pinnacle Standard',
  'Cascade Direct',
  'Northgate Mutual',
  'Harborview Health',
  'Vantage Benefits',
  'Clearwater Health',
  'Sentinel Group'
];

// Additional selectable prior policies (beyond the launch-context
// incumbent) so the broker can clone from any historical or related
// policy on file. Each carries a structured detail block that seeds the
// "Prior Policy Details" card on selection AND drives downstream
// workspace prefill:
//   PA  → vehicleIds + driverIds resolve against the account's
//          rfqData.lineItems / drivers so Step 1's roster reflects the
//          historical snapshot the broker is cloning from.
//   EB  → headcount + benefits map seeds Step 1 (Enrollment Headcount)
//          + Step 2/3 (Plan Coverages + Benefits). Benefits are scoped
//          to the LOC the prior policy actually covered (medical-only,
//          dental-only, vision-only) so the workspace's inScopeRoots
//          filter doesn't carry off-scope rows.
//   Both → effectiveFrom/To set the historical term; the workspace
//          shifts these forward by 1 year to seed the new RFQ's term
//          on the Review step.
// Each entry carries a `loc` tag so the dropdown only surfaces the
// policies that match the currently-selected Line of Coverage. The
// tag must exactly match a LOC label from LOC_BY_LOB above; entries
// without a matching LOC for the active flow are filtered out by
// `extraPriorPolicies`.
const EXTRA_PRIOR_POLICIES = {
  pa: [
    {
      value: 'lighthouse_2024',
      loc: 'Personal Auto',
      label: '2024 Mavericks Auto - Lighthouse Casualty',
      detail: {
        carrier: 'Lighthouse Casualty',
        policyNumber: 'LC-PA-2024-118-MVK',
        premium: 13990,
        yearsOfCoverage: 3,
        effectiveFrom: '2024-10-13',
        effectiveTo: '2025-10-13',
        // The CR-V was bought in 2024, taking the schedule to all three
        // household cars. Emily's RX came off the auto policy at the 2025
        // renewal, which is why the incumbent Apex term is narrower.
        vehicleIds: ['veh-crv', 'veh-camry', 'veh-lexus'],
        driverIds: ['drv-james', 'drv-emily']
      }
    },
    {
      value: 'meridian_2023',
      loc: 'Personal Auto',
      label: '2023 Mavericks Auto - Meridian Auto & Home',
      detail: {
        carrier: 'Meridian Auto & Home',
        policyNumber: 'MAH-PA-2023-007-MVK',
        premium: 13250,
        yearsOfCoverage: 2,
        effectiveFrom: '2023-10-13',
        effectiveTo: '2024-10-13',
        // Two cars on the schedule before the CR-V purchase, with James
        // and Emily the only rated drivers.
        vehicleIds: ['veh-camry', 'veh-lexus'],
        driverIds: ['drv-james', 'drv-emily']
      }
    },
    {
      value: 'northgate_umbrella_2025',
      loc: 'Personal Umbrella',
      label: '2025 Mavericks Umbrella - Northgate Mutual',
      detail: {
        carrier: 'Northgate Mutual',
        policyNumber: 'NM-UMB-2025-540-MVK',
        premium: 640,
        // Umbrella was added in 2023, so 2025 is year three.
        yearsOfCoverage: 3,
        effectiveFrom: '2025-11-15',
        effectiveTo: '2026-11-15',
        // Personal Umbrella sits over the auto policy - every household car
        // gets pulled through so coverage limits cascade, including the RX
        // that is no longer on the auto schedule.
        vehicleIds: ['veh-crv', 'veh-camry', 'veh-lexus'],
        driverIds: ['drv-james', 'drv-emily']
      }
    },
    {
      value: 'pinnacle_2022',
      loc: 'Personal Auto',
      label: '2022 Mavericks Auto - Pinnacle Standard',
      detail: {
        carrier: 'Pinnacle Standard',
        policyNumber: 'PS-PA-2022-882-MVK',
        premium: 12780,
        yearsOfCoverage: 1,
        effectiveFrom: '2022-10-13',
        effectiveTo: '2023-10-13',
        // First term placed through the agency - the Camry and the RX,
        // with James and Emily both rated.
        vehicleIds: ['veh-camry', 'veh-lexus'],
        driverIds: ['drv-james', 'drv-emily']
      }
    }
  ],
  home: [
    {
      value: 'nationwide_home_2023',
      loc: 'Homeowners',
      label: '2023 Mavericks Homeowners - Nationwide',
      detail: {
        carrier: 'Nationwide',
        policyNumber: 'NW-HO-2023-4421-MVK',
        premium: 3620,
        yearsOfCoverage: 6,
        effectiveFrom: '2023-12-01',
        effectiveTo: '2024-12-01',
        // Nationwide covered the primary dwelling; the fine art rider
        // was added separately after the 2023 renewal, so the 2023
        // snapshot only carries the ring on the schedule.
        dwellingIds: ['dwl-bayshore'],
        scheduledItemIds: ['sch-jewelry-01']
      }
    },
    {
      value: 'travelers_home_2024',
      loc: 'Homeowners',
      label: '2024 Mavericks Homeowners - Travelers',
      detail: {
        carrier: 'Travelers',
        policyNumber: 'TRV-HO-2024-4421-MVK',
        premium: 3945,
        yearsOfCoverage: 7,
        effectiveFrom: '2024-12-01',
        effectiveTo: '2025-12-01',
        dwellingIds: ['dwl-bayshore'],
        scheduledItemIds: ['sch-jewelry-01', 'sch-art-01']
      }
    }
  ],
  eb: [
    {
      value: 'uhc_med_2024',
      loc: 'Group Medical',
      label: '2024 Acme Group Medical - UnitedHealthcare (45 Employees)',
      detail: {
        carrier: 'UnitedHealthcare',
        policyNumber: 'UHC-MED-2024-ACME-45',
        premium: 548000,
        yearsOfCoverage: 1,
        effectiveFrom: '2024-01-01',
        effectiveTo: '2025-01-01',
        headcount: {
          employeeOnly: 23, employeeSpouse: 9, employeeFamily: 9, employeeChildren: 4
        },
        // UHC's PPO ran with tighter cost-sharing than BlueCross - the
        // medical-only prior policy pre-fills just the medical row set.
        benefits: {
          'med-ded-ind':         { included: true, min: '1750',  max: '2750',  value: '' },
          'med-ded-fam':         { included: true, min: '3500',  max: '5500',  value: '' },
          'med-pcp':             { included: true, min: '30',    max: '45',    value: '' },
          'med-oop-ind':         { included: true, min: '8000',  max: '10500', value: '' },
          'med-oop-fam':         { included: true, min: '16000', max: '21000', value: '' },
          'med-spec':            { included: true, min: '55',    max: '80',    value: '' },
          'med-virtual':         { included: true, min: '',      max: '',      value: '$20 copay' },
          'med-preventive':      { included: true, min: '',      max: '',      value: 'Covered in Full' },
          'med-er':              { included: true, min: '300',   max: '550',   value: '' },
          'med-urgent':          { included: true, min: '60',    max: '110',   value: '' },
          'med-rx-generic':      { included: true, min: '10',    max: '15',    value: '' },
          'med-rx-preferred':    { included: true, min: '35',    max: '50',    value: '' },
          'med-rx-nonpreferred': { included: true, min: '65',    max: '85',    value: '' }
        }
      }
    },
    {
      value: 'cigna_dental_2023',
      loc: 'Group Dental',
      label: '2023 Acme Group Dental - Cigna (40 Employees)',
      detail: {
        carrier: 'Cigna',
        policyNumber: 'CIG-DEN-2023-ACME-40',
        premium: 41200,
        yearsOfCoverage: 2,
        effectiveFrom: '2023-01-01',
        effectiveTo: '2024-01-01',
        headcount: {
          employeeOnly: 20, employeeSpouse: 8, employeeFamily: 8, employeeChildren: 4
        },
        // Dental-only - workspace's inScopeRoots filter keeps medical
        // and vision rows out when the LOC is Group Dental.
        benefits: {
          'den-ded-ind':    { included: true, min: '50',   max: '100',  value: '' },
          'den-ded-fam':    { included: true, min: '150',  max: '300',  value: '' },
          'den-max':        { included: true, min: '1500', max: '2000', value: '' },
          'den-rc-pct':     { included: true, min: '80',   max: '90',   value: '' },
          'den-wait':       { included: true, min: '',     max: '',     value: 'None' },
          'den-preventive': { included: true, min: '80',   max: '100',  value: '' },
          'den-basic':      { included: true, min: '60',   max: '80',   value: '' },
          'den-major':      { included: true, min: '40',   max: '60',   value: '' },
          'den-ortho':      { included: true, min: '50',   max: '60',   value: '' }
        }
      }
    },
    {
      value: 'vsp_vision_2025',
      loc: 'Group Vision',
      label: '2025 Acme Group Vision - VSP Vision Care (50 Employees)',
      detail: {
        carrier: 'VSP Vision Care',
        policyNumber: 'VSP-VIS-2025-ACME-50',
        premium: 18500,
        yearsOfCoverage: 3,
        effectiveFrom: '2025-01-01',
        effectiveTo: '2026-01-01',
        headcount: {
          employeeOnly: 25, employeeSpouse: 10, employeeFamily: 10, employeeChildren: 5
        },
        // Vision-only.
        benefits: {
          'vis-exam':         { included: true, min: '10',  max: '20',  value: '' },
          'vis-mat':          { included: true, min: '25',  max: '50',  value: '' },
          'vis-freq':         { included: true, min: '',    max: '',    value: '12 / 12 / 24 months' },
          'vis-routine-exam': { included: true, min: '0',   max: '25',  value: '' },
          'vis-contact-fit':  { included: true, min: '40',  max: '60',  value: '' },
          'vis-lenses':       { included: true, min: '',    max: '',    value: 'Covered in Full' },
          'vis-frames':       { included: true, min: '130', max: '200', value: '' },
          'vis-contacts':     { included: true, min: '130', max: '200', value: '' },
          'vis-enhancements': { included: true, min: '',    max: '',    value: 'Discount' }
        }
      }
    },
    {
      value: 'aetna_life_2024',
      loc: 'Group Life',
      label: '2024 Acme Group Life - Aetna (50 Employees)',
      detail: {
        carrier: 'Aetna',
        policyNumber: 'AET-LIFE-2024-ACME-50',
        premium: 96000,
        yearsOfCoverage: 2,
        effectiveFrom: '2024-01-01',
        effectiveTo: '2025-01-01',
        headcount: {
          employeeOnly: 28, employeeSpouse: 10, employeeFamily: 8, employeeChildren: 4
        }
        // Group Life isn't in the medical/dental/vision catalog - no
        // benefits prefill. Headcount + effective dates still flow.
      }
    }
  ]
};

export default class RfqIntakeModal extends LightningElement {
  @api open = false;

  // The app shell reuses a single modal instance, so nothing resets on
  // its own between opens. Seeding off the context setter gives every
  // launch a clean slate and lets the renewal path pre-commit the
  // choices the broker already made by acting on a policy row.
  @track _ctx = null;
  @api
  get context() {
    return this._ctx;
  }
  set context(value) {
    this._ctx = value || null;
    this._seedForContext();
  }

  // Start method: start from a blank slate (default) or clone the incumbent.
  @track startMode = START_SCRATCH;

  // Prior Policy is now an actionable dropdown - empty by default so the
  // user must consciously confirm the incumbent policy before continuing.
  @track priorPolicy = '';

  // Structured Prior Policy details (Substep 2.1 of the PA spec) - these
  // are surfaced as a card under the dropdown and auto-populate when the
  // user selects the incumbent option. The user can still edit any value.
  @track priorCarrier = '';
  @track priorPolicyNumber = '';
  @track priorPremium = '';
  @track priorYearsOfCoverage = '';
  // EB-only - the incumbent policy's enrolled tier split. Forwarded to the
  // Guided RFQ wizard so Step 1 (Enrollment Headcount) pre-fills with the
  // prior policy's numbers instead of starting at 0.
  @track priorHeadcount = null;
  // EB-only - the incumbent policy's benefit selection across Medical /
  // Dental / Vision. Forwarded to Step 2 so the wizard opens with every
  // benefit pre-checked and the Min/Max ranges anchored on the prior
  // values. The broker can edit any field; manual-entry clears it.
  @track priorBenefits = null;
  // Prior policy term - both LOBs forward these to the workspace so
  // Effective From defaults to the day after priorEffectiveTo (n+1)
  // and Effective To is one year from that From date. Empty when no
  // incumbent is selected.
  @track priorEffectiveFrom = '';
  @track priorEffectiveTo = '';
  // PA-only - id-arrays the workspace resolves against rfqData line
  // items + drivers to hydrate Step 1's roster from the historical
  // snapshot. Switching prior policy (e.g. from Apex 2025 to
  // Progressive 2022) swaps the roster the wizard opens with.
  @track priorVehicleIds = null;
  @track priorDriverIds = null;

  // Home-only - id-arrays the workspace resolves against homeRfqData
  // line items to hydrate Step 1's property + scheduled items from the
  // historical snapshot. Switching prior policy (e.g. from Chubb 2025
  // to Nationwide 2023) swaps the schedule the wizard opens with.
  @track priorDwellingIds = null;
  @track priorScheduledItemIds = null;

  // LOB / LOC are pre-filled from the launch context but editable. null =
  // "not yet overridden", so the getters fall back to the context value.
  @track _lob = null;
  @track _loc = null;

  // Optional new-policy attributes (non-mandatory). All three are
  // free-form: Opportunity is a plain text hint until the data layer
  // wires real Salesforce Opportunity lookups; effectiveFrom/To are
  // ISO date strings (YYYY-MM-DD) shown as MM/DD/YYYY in c-date-input.
  // Empty defaults so the workspace falls back to its own seeding
  // (day after priorEffectiveTo) when the broker leaves them blank.
  @track _opportunity = '';
  @track _effectiveFrom = '';
  @track _effectiveTo = '';

  // Reset to a clean intake, then apply whatever the launch context has
  // already decided. Renewals arrive with a policy attached, so the
  // start-method choice and the prior-policy pick are both settled
  // before the modal paints - we commit them here and leave the broker
  // with only the new policy term to confirm.
  _seedForContext() {
    this._lob = null;
    this._loc = null;
    this._opportunity = '';
    this._effectiveFrom = '';
    this._effectiveTo = '';
    this.startMode = START_SCRATCH;
    this.priorPolicy = '';
    this._applyPriorDetail({});

    if (!this.isRenewal) return;

    this.startMode = START_CLONE;
    this.priorPolicy = this.incumbentValue;
    this._applyPriorDetail(this._priorDetailForLoc);
  }

  // ── Flow derivation (PA / Home / EB) ─────────────────────────────
  // Read the EFFECTIVE LOB + LOC (picker values first, then launch
  // context) so the prior-policy list, incumbent value, and flow copy
  // all follow the broker's current pick - not the LOB/LOC the account
  // was launched with. Without this, switching from a PA account's
  // "Personal Lines" default to "Employee Benefits" left the dropdown
  // listing PA prior policies (e.g. "Mavericks Auto - Apex Mutual"
  // inside a Group Medical RFQ). Home vs PA share the "Personal Lines"
  // LOB, so the Home discriminator keys off LOC.
  get isEb() {
    const lob = this._lob || this.context?.lob;
    return lob === 'Employee Benefits' || lob === 'eb';
  }
  get isHome() {
    if (this.isEb) return false;
    const loc = this._loc || this.context?.loc;
    return loc === 'Homeowners' || loc === 'home';
  }
  get flowCopy() {
    if (this.isEb) return FLOW_COPY.eb;
    if (this.isHome) return FLOW_COPY.home;
    return FLOW_COPY.pa;
  }

  // ── Locked, context-driven dropdown values ──────────────────────
  get accountName() {
    return this.context?.accountName || 'Account';
  }

  // Modal heading - dynamic so the hybrid "Add Another LOC" path
  // signals intent clearly ("Add Line of Coverage to Mavericks
  // Household") instead of the generic "Create RFQ" copy. Falls
  // back to the plain title everywhere else so the fresh intake
  // flow is unchanged.
  get modalTitle() {
    if (this.context?.isAddingLoc) {
      const account = this.accountName;
      return `Add Line of Coverage to ${account}`;
    }
    if (this.isRenewal) return 'New Request For Quote';
    return 'Create RFQ';
  }

  get modalSubtitle() {
    if (this.isRenewal) {
      // The prior-policy picker is gone on this path, so the subtitle
      // carries the "which policy am I renewing" signal instead.
      const number = this.renewalPolicyNumber;
      return number
        ? `Renewing ${number}. Confirm the new policy term to continue.`
        : 'Confirm the new policy term to continue.';
    }
    if (!this.context?.isAddingLoc) return '';
    const source = this.context?.sourceLocLabel || 'the existing RFQ';
    return `${source} is saved to the bundle. Pick the next Line of Coverage to open in a new tab.`;
  }

  // Hybrid "Add Another LOC" flag used by the template to strip the
  // modal down to just Account (locked pill) + Line of Business
  // (locked picklist) + Line of Coverage (the one thing the broker
  // actually picks). Everything else - Opportunity, Effective
  // From/To, start-method radios, Prior Policy - is context the
  // broker already committed to on the source RFQ, so we don't
  // re-ask. Fresh intake flow keeps all fields visible.
  get isAddingLoc() {
    return !!this.context?.isAddingLoc;
  }

  // Renewal path - launched from a policy's New Request For Quote action.
  // The policy the broker acted on IS the answer to "how do you want to
  // start?" and "which prior policy?", so both controls come out and
  // the account, line of business and line of coverage are all read
  // only. The new policy term is the only thing left to decide.
  get isRenewal() {
    return !!this.context?.isRenewal;
  }
  get renewalPolicyNumber() {
    return this.context?.renewalPolicyNumber || '';
  }

  get showOpportunityField() {
    return !this.isAddingLoc && !this.isRenewal;
  }
  // Effective From / To stay editable on the renewal path - they're the
  // point of the screen there.
  get showTermFields() {
    return !this.isAddingLoc;
  }
  get showStartModeFields() {
    return !this.isAddingLoc && !this.isRenewal;
  }
  get showPriorPolicyPicker() {
    return this.isClone && !this.isRenewal;
  }
  get lobDisabled() {
    return this.isAddingLoc || this.isRenewal;
  }
  get locDisabled() {
    return this.isRenewal;
  }
  // Which LOBs the current account is allowed to quote. Absent
  // accounts (or unrecognized ids/names) fall through to the full
  // LOB_OPTIONS list.
  get allowedLobs() {
    const id = this.context?.accountId;
    const name = this.context?.accountName;
    return (
      ALLOWED_LOBS_BY_ACCOUNT[id] ||
      ALLOWED_LOBS_BY_ACCOUNT[name] ||
      LOB_OPTIONS
    );
  }
  // Pre-filled LOB from the launch context, overridable by the dropdown.
  // If the raw value (context / _lob / flow default) isn't in the
  // account's allowed set, coerce to the first allowed LOB so the
  // picker never shows a value the account can't quote.
  get lobLabel() {
    const raw = this._lob || this.context?.lob || this.flowCopy.lob;
    const allowed = this.allowedLobs;
    return allowed.includes(raw) ? raw : allowed[0];
  }
  // Pre-filled LOC from context, overridable. Cascades from the LOB - if a
  // LOB switch leaves the prior LOC invalid we fall back to that LOB's first.
  //
  // Hybrid "Add Another LOC" path: `context.isAddingLoc` forces a blank
  // starting value so the broker can't accidentally re-pick the source
  // session's LOC. The picker itself excludes the source LOC below
  // (see locOptions) so the only choices are LOCs they haven't quoted
  // for this account yet.
  get locLabel() {
    if (this._loc) return this._loc;
    if (this.context?.isAddingLoc) return '';
    const loc = this.context?.loc;
    const ctxLoc = Array.isArray(loc) ? loc.join(' + ') : loc;
    return ctxLoc || this.flowCopy.loc;
  }

  get lobOptions() {
    const current = this.lobLabel;
    // Only surface LOBs the current account is allowed to quote. If
    // the account has just one allowed LOB, the picker becomes a
    // single-item dropdown; the field stays visible but there's
    // nothing else to pick.
    const values = this.allowedLobs;
    return values.map((v) => ({ value: v, label: v, selected: v === current }));
  }

  get locOptions() {
    const current = this.locLabel;
    // No fallback for out-of-list current values: we removed some LOCs
    // (Personal Umbrella, Group Life) from the roadmap entirely, so we
    // don't want a stale selection to leak them back into the picker.
    // If `current` isn't in the base list the trigger just falls back
    // to placeholder text until the user picks a valid option.
    const values = LOC_BY_LOB[this.lobLabel] || [];
    // Rule: one open flow per LOC on an account. Prefer the full
    // occupiedLocLabels list (every sibling already on the bundle);
    // fall back to occupiedLocs (legacy key from older callers) or
    // sourceLocLabel alone. Case-insensitive match so "Homeowners" /
    // "homeowners" both get filtered.
    const occupiedRaw = Array.isArray(this.context?.occupiedLocLabels)
      ? this.context.occupiedLocLabels
      : Array.isArray(this.context?.occupiedLocs)
        ? this.context.occupiedLocs
        : this.context?.isAddingLoc && this.context?.sourceLocLabel
          ? [this.context.sourceLocLabel]
          : [];
    const occupied = new Set(
      occupiedRaw
        .filter(Boolean)
        .map((v) => String(v).trim().toLowerCase())
    );
    return values
      .filter((v) => !occupied.has(String(v).trim().toLowerCase()))
      .map((v) => {
        // Default to enabled for LOCs we haven't gated. Only the
        // roadmap-only entries appear in LOC_ENABLED with false.
        const gate = LOC_ENABLED[v];
        return {
          value: v,
          label: v,
          selected: v === current,
          disabled: gate === false
        };
      });
  }

  handleLobChange(event) {
    this._lob = event.detail.value;
    // Reset the coverage line to the first valid option for the new LOB.
    const next = LOC_BY_LOB[this._lob] || [];
    this._loc = next[0] || '';
    // Clear any prior-policy selection from the old LOB - the
    // dropdown options just swapped to a different flow's list, so
    // a leftover value (e.g. PA's `travelers_2025`) would either no
    // longer match or, worse, render with a stale flow's label.
    this.priorPolicy = '';
    this._applyPriorDetail({});
  }

  handleLocChange(event) {
    this._loc = event.detail.value;
    // Hybrid "Add Another LOC" path hides the start-method radios, so
    // startMode would sit on its blank-slate default and the LOC would
    // open with no roster and empty limits. The household already holds
    // an in-force policy for the coverage being added, so adopt the
    // clone default the moment the LOC is known - the same seeding
    // _reset does on the renewal path, deferred to here because that is
    // when the LOC becomes known. A LOC with no incumbent on file still
    // falls through to the blank slate.
    if (this.isAddingLoc) {
      if (this._incumbentInScope) {
        this.startMode = START_CLONE;
        this.priorPolicy = this.incumbentValue;
        this._applyPriorDetail(this._priorDetailForLoc);
      } else {
        this.startMode = START_SCRATCH;
        this.priorPolicy = '';
        this._applyPriorDetail({});
      }
      return;
    }
    // If the previously-selected prior policy is no longer in scope
    // for the new LOC, clear it so the dropdown doesn't render a
    // stale value (or worse, leak a different-LOC carrier label into
    // the detail card). The recompute of priorPolicyOptions runs
    // through the LOC filter + incumbent-scope guard.
    if (this.priorPolicy) {
      const stillInScope = this.priorPolicyOptions.some(
        (o) => o.value === this.priorPolicy
      );
      if (!stillInScope) {
        this.priorPolicy = '';
        this._applyPriorDetail({});
        return;
      }
    }
    // If the incumbent is still selected, re-seed the detail card from
    // the LOC's specific prior policy so the carrier label / policy
    // number / premium / headcount / benefits reflect the new coverage
    // scope.
    if (this.priorPolicy === this.incumbentValue) {
      this._applyPriorDetail(this._priorDetailForLoc);
    }
  }

  // ── Optional new-policy attributes ──────────────────────────────
  // Template-friendly accessors for the underscore-tracked fields.
  // Effective dates fall back to whatever the launch context supplied
  // (e.g., the "Add Another LOC" hybrid path forwards the previous
  // session's policy term so the broker doesn't re-enter it). Once
  // the broker touches the field, the private tracked value wins.
  get opportunity()    { return this._opportunity; }
  get effectiveFrom()  {
    return this._effectiveFrom || this.context?.effectiveFrom || '';
  }
  get effectiveTo()    {
    return this._effectiveTo || this.context?.effectiveTo || '';
  }

  handleOpportunityInput(event) {
    this._opportunity = (event.target.value || '').trim();
  }
  handleEffectiveFromChange(event) {
    this._effectiveFrom = event.detail?.value ?? event.target.value ?? '';
  }
  handleEffectiveToChange(event) {
    this._effectiveTo = event.detail?.value ?? event.target.value ?? '';
  }

  // Optional per-LOC override of the flow-default prior policy. Falls
  // back to the flow default if a LOC has no override entry. Currently
  // every EB LOC uses the flow default; the hook is retained so a future
  // LOC-specific incumbent (e.g. a Dental-only seed) can plug in without
  // refactoring the call sites.
  get _priorOverride() {
    const map = this.flowCopy?.priorDetailByLoc;
    return map ? map[this.locLabel] : null;
  }
  get priorPolicyLabel() {
    if (this.context?.priorPolicy) return this.context.priorPolicy;
    return this._priorOverride?.priorPolicy || this.flowCopy.priorPolicy;
  }
  get _priorDetailForLoc() {
    return this._priorOverride?.priorDetail || this.flowCopy.priorDetail || {};
  }

  // The incumbent policy carries a flow-specific value so the same modal
  // works for PA (Apex Mutual), Homeowners (Chubb) and EB (BlueCross).
  get incumbentValue() {
    if (this.isEb) return 'bluecross_2025';
    if (this.isHome) return 'chubb_home_2025';
    return 'travelers_2025';
  }

  // Flow-specific extra prior policies (beyond the launch-context
  // incumbent), filtered to the currently-selected Line of Coverage.
  // Each fixture carries a `loc` tag that must match the active LOC
  // label exactly. Untagged entries (legacy fixtures) fall through to
  // every LOC so we don't accidentally hide them during the rollout.
  get extraPriorPolicies() {
    let pool;
    if (this.isEb) pool = EXTRA_PRIOR_POLICIES.eb;
    else if (this.isHome) pool = EXTRA_PRIOR_POLICIES.home;
    else pool = EXTRA_PRIOR_POLICIES.pa;
    const loc = this.locLabel;
    return pool.filter((p) => !p.loc || p.loc === loc);
  }

  // LOC the launch-context incumbent represents. Used to hide the
  // incumbent option when the broker pivots LOC away from the launched
  // one (e.g. Acme launches into Group Medical; if the broker switches
  // to Group Dental, the medical incumbent is no longer relevant).
  get _incumbentLoc() {
    return this.context?.loc || this.flowCopy?.loc || '';
  }
  get _incumbentInScope() {
    return !this._incumbentLoc || this._incumbentLoc === this.locLabel;
  }

  // Options for the actionable Prior Policy dropdown: the launch-context
  // incumbent (when in scope and not already represented in the extras
  // list) followed by the LOC-scoped historical / related policies on
  // file.
  get priorPolicyOptions() {
    const extras = this.extraPriorPolicies.map((p) => ({
      value: p.value,
      label: p.label,
      selected: this.priorPolicy === p.value
    }));
    const opts = [];
    const incumbentLabel = this.priorPolicyLabel;
    const incumbentMatchesExtra = extras.some((o) => o.label === incumbentLabel);
    if (this._incumbentInScope && !incumbentMatchesExtra) {
      opts.push({
        value: this.incumbentValue,
        label: incumbentLabel,
        selected: this.priorPolicy === this.incumbentValue
      });
    }
    return opts.concat(extras);
  }

  get isPriorPolicyEmpty() {
    return !this.priorPolicy;
  }

  // Human-readable label for the selected prior policy, forwarded in the
  // continue payload so downstream views keep showing a friendly string.
  get selectedPriorPolicyLabel() {
    const opt = this.priorPolicyOptions.find((o) => o.value === this.priorPolicy);
    return opt ? opt.label : '';
  }

  handlePriorPolicyChange(event) {
    this.priorPolicy = event.detail.value;
    if (this.priorPolicy === this.incumbentValue) {
      // Seed the detail card from the LOC-specific incumbent data
      // (falls back to the flow default for LOCs without an override).
      // The incumbent also seeds Step 1 (headcount) + Step 2 (benefits)
      // for EB, and Step 1 (roster) for PA.
      this._applyPriorDetail(this._priorDetailForLoc);
    } else {
      // One of the extra prior policies - seed the detail card from its
      // structured record. Extras now also carry their own scoped
      // headcount/benefits (EB) or roster snapshot (PA), so picking
      // any historical policy fully prefills the wizard.
      const extra = this.extraPriorPolicies.find(
        (p) => p.value === this.priorPolicy
      );
      this._applyPriorDetail((extra && extra.detail) || {});
    }
  }

  // Hydrate every prior-policy-derived field from a structured detail
  // block. Empty fields clear cleanly. Used by both the incumbent and
  // extra prior-policy paths so the two branches stay in sync.
  _applyPriorDetail(d) {
    this.priorCarrier = d.carrier || '';
    this.priorPolicyNumber = d.policyNumber || '';
    this.priorPremium = d.premium != null ? String(d.premium) : '';
    this.priorYearsOfCoverage =
      d.yearsOfCoverage != null ? String(d.yearsOfCoverage) : '';
    this.priorHeadcount = d.headcount ? { ...d.headcount } : null;
    this.priorBenefits = d.benefits ? { ...d.benefits } : null;
    this.priorEffectiveFrom = d.effectiveFrom || '';
    this.priorEffectiveTo = d.effectiveTo || '';
    // New term starts the day after the IN-FORCE policy's Effective To,
    // not after whichever prior policy was picked. The dropdown chooses
    // which past policy to copy the roster and coverages from; it does
    // not change which term is being written, which is always the
    // upcoming one. Deriving from the selection instead backdated the
    // whole application - picking the 2024 Travelers homeowners policy
    // wrote a 2025-26 term while every other line sat in 2026-27.
    if (d.effectiveTo) {
      const inForceEnd = this._priorDetailForLoc?.effectiveTo || d.effectiveTo;
      const term = nextTermFromPriorEnd(inForceEnd);
      this._effectiveFrom = term.from;
      this._effectiveTo = term.to;
    }
    this.priorVehicleIds = Array.isArray(d.vehicleIds)
      ? d.vehicleIds.slice()
      : null;
    this.priorDriverIds = Array.isArray(d.driverIds)
      ? d.driverIds.slice()
      : null;
    this.priorDwellingIds = Array.isArray(d.dwellingIds)
      ? d.dwellingIds.slice()
      : null;
    this.priorScheduledItemIds = Array.isArray(d.scheduledItemIds)
      ? d.scheduledItemIds.slice()
      : null;
  }

  // ── Prior Policy detail card ────────────────────────────────────
  // Renders only when an actual prior policy is selected. "None / Manual
  // Entry" has no incumbent record, so the detail card stays hidden.
  get showPriorPolicyDetail() {
    return this.isClone && !!this.priorPolicy;
  }
  get priorPolicyEditable() {
    // Both incumbent and manual entry are editable - incumbent just
    // seeds the values; the broker can still tweak them.
    return true;
  }

  get carrierOptions() {
    return COMMON_CARRIERS.map((c) => ({ value: c, label: c }));
  }

  // ── Read-only summary display formatting ────────────────────────
  get priorCarrierDisplay() {
    return this.priorCarrier || '-';
  }
  get priorPolicyNumberDisplay() {
    return this.priorPolicyNumber || '-';
  }
  get priorPremiumDisplay() {
    if (this.priorPremium === '' || this.priorPremium == null) return '-';
    const n = Number(this.priorPremium);
    if (Number.isNaN(n)) return '-';
    return `$${n.toLocaleString('en-US')}`;
  }
  get priorYearsDisplay() {
    if (this.priorYearsOfCoverage === '' || this.priorYearsOfCoverage == null)
      return '-';
    const n = Number(this.priorYearsOfCoverage);
    if (Number.isNaN(n)) return this.priorYearsOfCoverage;
    return `${n} ${n === 1 ? 'year' : 'years'}`;
  }

  // ── Start-method radio state ────────────────────────────────────
  get isScratch() {
    return this.startMode === START_SCRATCH;
  }
  get isClone() {
    return this.startMode === START_CLONE;
  }
  get modeScratchClass() {
    return this.isScratch ? 'renewal-radio is-selected' : 'renewal-radio';
  }
  get modeCloneClass() {
    return this.isClone ? 'renewal-radio is-selected' : 'renewal-radio';
  }

  handleStartModeChange(event) {
    const v = event.target.value;
    if (v !== START_SCRATCH && v !== START_CLONE) return;
    this.startMode = v;
    if (v === START_SCRATCH) {
      // Blank slate - clear any cloned prior-policy prefill so the wizard
      // opens empty and the broker enters headcount + benefits manually.
      this.priorPolicy = '';
      this._applyPriorDetail({});
    }
  }

  // The Account Name renders as a record link (SLDS resolved-lookup pill).
  // In this prototype the parent Account Record Page already sits behind the
  // modal, so the link is a no-op rather than a hard navigation.
  handleAccountClick(event) {
    event.preventDefault();
  }

  // True when at least one active RFQ template matches the current LOB + LOC
  // selection. Consulted by both the disabled state of Save & Continue and
  // the inline warning banner in the HTML. getTick() is invoked so the getter
  // re-runs when the templates catalog mutates (e.g. someone publishes a
  // template in another tab while the modal is open).
  get hasMatchingTemplate() {
    getTick();
    if (!this.lobLabel || !this.locLabel) return false;
    return (
      getTemplatesByLobAndCoverage(this.lobLabel, this.locLabel).length > 0
    );
  }

  // Drives the lwc:if for the "no template" warning banner. Only surfaces
  // once both LOB and LOC are set (they're always set with defaults today,
  // but keeping the guard makes the getter safe if defaults ever change).
  get showNoTemplateWarning() {
    return !!this.lobLabel && !!this.locLabel && !this.hasMatchingTemplate;
  }

  // Scratch can proceed immediately once a matching LOB+LOC template exists;
  // cloning also requires a prior policy first.
  get submitDisabled() {
    if (!this.hasMatchingTemplate) return true;
    // Hybrid "Add Another LOC" - the broker must pick a LOC before we
    // spawn the second workspace tab. Without this guard they could
    // hit Continue on the empty picker and land in a broken tab.
    if (this.context?.isAddingLoc && !this.locLabel) return true;
    return this.isClone && this.isPriorPolicyEmpty;
  }

  // ── Footer actions ──────────────────────────────────────────────
  handleCancel() {
    this.dispatchEvent(new CustomEvent('cancel'));
  }

  handleContinue() {
    // Guard: when cloning, the user must select a prior policy first.
    if (this.submitDisabled) return;
    // Hand the captured context (LOB / LOC / Prior Policy / renewal path)
    // up to the app shell, which simulates opening the Guided RFQ workspace
    // tab and mounts the wizard at the new Step 1.
    // Coerce premium / years to numbers when present so downstream
    // consumers don't have to re-parse. Empty strings stay empty.
    const premiumNum = this.priorPremium === '' ? '' : Number(this.priorPremium);
    const yearsNum =
      this.priorYearsOfCoverage === '' ? '' : Number(this.priorYearsOfCoverage);
    this.dispatchEvent(
      new CustomEvent('continue', {
        detail: {
          // Renewal-path cards are gone - every intake now creates an RFQ.
          renewalMode: MODE_SHOP,
          startMode: this.startMode,
          context: {
            ...(this.context || {}),
            startMode: this.startMode,
            lob: this.lobLabel,
            loc: this.locLabel,
            // Optional new-policy attributes (empty when broker left
            // them blank; workspace falls back to its own seeding).
            // effectiveFrom/To use the getter so the hybrid Add-LOC
            // path forwards the previous session's policy term when
            // the broker doesn't override it in this modal.
            opportunity: this._opportunity || '',
            effectiveFrom: this.effectiveFrom || '',
            effectiveTo: this.effectiveTo || '',
            priorPolicy: this.selectedPriorPolicyLabel,
            priorPolicyValue: this.priorPolicy,
            // Substep 2.1 - structured prior-policy details
            priorCarrier: this.priorCarrier,
            priorPolicyNumber: this.priorPolicyNumber,
            priorPremium: premiumNum,
            priorYearsOfCoverage: yearsNum,
            // EB only - Step 1 (headcount) + Step 2 (benefits) of the
            // wizard pre-fill from these. Both stay null on the "start
            // from scratch" / manual-entry path.
            priorHeadcount: this.priorHeadcount
              ? { ...this.priorHeadcount }
              : null,
            priorBenefits: this.priorBenefits
              ? { ...this.priorBenefits }
              : null,
            // Prior term - both LOBs use these to seed the Review
            // step's Effective From/To. Workspace shifts forward by
            // one year so the new RFQ defaults to the next renewal.
            priorEffectiveFrom: this.priorEffectiveFrom || '',
            priorEffectiveTo: this.priorEffectiveTo || '',
            // PA only - id-arrays the workspace resolves against
            // rfqData.lineItems + drivers so Step 1's roster reflects
            // the historical snapshot the broker is cloning from.
            priorVehicleIds: this.priorVehicleIds
              ? this.priorVehicleIds.slice()
              : null,
            priorDriverIds: this.priorDriverIds
              ? this.priorDriverIds.slice()
              : null,
            // Home only - id-arrays the workspace resolves against
            // homeRfqData.lineItems so Step 1's property + scheduled
            // items reflect the historical snapshot.
            priorDwellingIds: this.priorDwellingIds
              ? this.priorDwellingIds.slice()
              : null,
            priorScheduledItemIds: this.priorScheduledItemIds
              ? this.priorScheduledItemIds.slice()
              : null
          }
        }
      })
    );
  }

  // Backdrop / outer-region click closes the modal (standard SLDS behavior).
  handleBackdrop() {
    this.handleCancel();
  }
  stopPropagation(event) {
    event.stopPropagation();
  }
}
