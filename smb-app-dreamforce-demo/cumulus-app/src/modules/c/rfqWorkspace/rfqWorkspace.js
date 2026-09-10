import { LightningElement, api, track } from 'lwc';
import {
  rfqData,
  MOCK_ACCOUNTS,
  drivers,
  quotes,
  ADDITIONAL_HOUSEHOLD_VEHICLES
} from 'data/mockData';
import { formatUsDateOrDash, nextTermFromPriorEnd } from 'data/dates';

function initials(name = '') {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function fmtDate(iso) {
  return formatUsDateOrDash(iso);
}

// Intake moved out of the wizard into c-rfq-intake-modal. The wizard now
// runs three steps: Vehicles & Drivers → Asset Coverages → Review & Publish.
// Driver assignment happens inline in the asset tree (roster + coverages
// modes), so it's no longer a standalone step. Coverages is asset-aware
// (Policy → Vehicle → Driver).
const STEP_ORDER = ['vehicles', 'coverages', 'review'];
// Card titles per step - used for the "Back to {previous}" affordance.
const STEP_TITLES = {
  vehicles: 'Add & Assign Assets',
  coverages: 'Configure Coverages',
  review: 'Review & Submit'
};
const VALID_VIEWS = ['wizard', 'submitted'];
const MODE_STRAIGHT = 'straight_through';

function readInitialView() {
  if (typeof window === 'undefined') return 'wizard';
  const param = new URLSearchParams(window.location.search).get('view');
  if (param && VALID_VIEWS.includes(param)) return param;
  return 'wizard';
}

function readInitialCompleted() {
  const base = {
    vehicles: false,
    coverages: false,
    review: false
  };
  if (typeof window === 'undefined') return base;
  const params = new URLSearchParams(window.location.search);
  const step = params.get('step');
  const view = params.get('view');
  if (view === 'submitted') {
    STEP_ORDER.forEach((id) => (base[id] = true));
    return base;
  }
  if (!step) return base;
  const target = STEP_ORDER.indexOf(step);
  if (target <= 0) return base;
  STEP_ORDER.slice(0, target).forEach((id) => (base[id] = true));
  return base;
}

// Pre-seeded policy limits (top of Asset Coverages - applies to the policy,
// not any single vehicle): BI, PD, UM. Sourced from the prior policy.
// Each is a single dollar figure - no split per-person/per-accident
// pairs - so every limit in the wizard reads the same way.
function seedPolicyLimits() {
  const liab = rfqData.coverages.find((c) => c.coverageKey === 'pa_liability');
  return {
    biLimit: liab?.attributes?.biLimit || '$250,000',
    pdLimit: liab?.attributes?.pdLimit || '$100,000',
    umLimit: '$100,000',
    // Personal Umbrella Liability - mandatory at the policy level.
    umbrellaLimit: '$1,000,000',
    umUmbrella: false
  };
}

// Policy coverage values asked for on the Personal Auto umbrella policy.
// Each coverage carries an include flag + a single limit and/or
// deductible - markets quote against the named value.
//
// Cloning from a prior policy copies that term's elections, mandatory
// or optional: if the prior carried Property Damage at $100,000 it
// arrives ticked at that limit. Coverages the prior declined (Uninsured
// Motorist on the Mavericks Auto term) stay off with no value. Collision
// and Comprehensive live on each vehicle, not on this card - the keys
// below are leftover review-rollup slots and stay excluded.
//
// Limits come off the prior policy's liability coverage rather than
// literals, so the renewal and the policy record can't drift apart.
//
// When `manual` is true (Start New Quote / Manual Entry), every
// limit/deductible value is left blank so the broker has to pick one
// from the dropdown - prevents bogus defaults from leaking into a
// brand-new submission.
function seedCoverageRanges(manual) {
  if (manual) {
    return {
      bi: { included: true, limit: '' },
      pd: { included: false, limit: '' },
      um: { included: false, limit: '', ded: '' },
      collision: { included: false, dedMin: '', dedMax: '' },
      comprehensive: { included: false, dedMin: '', dedMax: '' }
    };
  }
  const liab = rfqData.coverages.find((c) => c.coverageKey === 'pa_liability');
  const priorPd = liab?.attributes?.pdLimit || '';
  const priorUm = liab?.attributes?.umLimit || '';
  return {
    bi: { included: true, limit: liab?.attributes?.biLimit || '' },
    pd: { included: !!priorPd, limit: priorPd },
    um: { included: !!priorUm, limit: priorUm, ded: '' },
    collision: { included: false, dedMin: '', dedMax: '' },
    comprehensive: { included: false, dedMin: '', dedMax: '' }
  };
}

// Prior-term physical-damage coverage. Inherited vehicles copy Comp /
// Collision from this record; vehicles added mid-renewal do not.
const PHYS_COV = rfqData.coverages.find((c) => c.coverageKey === 'pa_physical');
// Medical Payments is driver-level and was carried on every rated
// driver of the prior term, so drivers inherited by a cloned renewal
// arrive with it already elected at this limit.
const MED_PAY_COV = rfqData.coverages.find(
  (c) => c.coverageKey === 'pa_med_pay'
);
const DEFAULT_MED_PAY = MED_PAY_COV?.attributes?.medPay || '$5,000';

// Normalize a raw mockData line item into the read-only vehicle row view.
function mapVehicleRow(li) {
  // Best-effort derive a ZIP from a free-form garaging address. Mock data
  // carries the full address as `garaging`; if it ends with a 5-digit
  // chunk we surface that as the structured `garagingZip` rating input.
  const garagingStr = li.attributes?.garaging || '';
  const zipMatch = garagingStr.match(/(\d{5})(?:-\d{4})?\s*$/);
  return {
    id: li.id,
    name: li.name,
    vin: li.attributes?.vin || '',
    use: li.attributes?.use || '',
    annualMileage: li.attributes?.annualMileage
      ? `${li.attributes.annualMileage.toLocaleString()} mi/yr`
      : '',
    garaging: garagingStr,
    // Substep 2.2 - surface body class + garaging ZIP as structured rating
    // inputs (the modal can edit them; mock seed rows feed them from
    // attributes.class and the trailing ZIP of the garaging address).
    bodyClass: li.attributes?.class || '',
    garagingZip: zipMatch ? zipMatch[1] : '',
    // Pre-declared roster for this vehicle (from the prior policy). Used
    // to seed the assignment map so the tree shows multi-driver vehicles.
    assignedDriverIds: Array.isArray(li.attributes?.assignedDriverIds)
      ? [...li.attributes.assignedDriverIds]
      : null
  };
}

// Normalize a raw driver into the row view.
function mapDriverRow(d) {
  return {
    ...d,
    initials: initials(d.name)
  };
}

// Pre-seeded per-vehicle coverages for the roster that came off the
// prior policy. A vehicle added mid-renewal is seeded blank by
// `appendVehicleFromForm`, not here, so Comp / Collision / deductibles
// stay untagged until the broker elects them.
//
// When `manual` is true, deductibles + rental coverage all start blank
// and unchecked so the broker has to pick from the dropdown.
//
// The cloned-from-prior path carries what the prior term actually
// covered: `pa_physical` applies to every inherited vehicle, so
// Comprehensive and Collision arrive already ticked at their
// PHYS_COV deductibles. Rental reimbursement was declined, so it
// stays off with no value.
function seedVehicleCoverages(vehicleRows, manual) {
  const out = {};
  vehicleRows.forEach((veh) => {
    const phys = manual ? null : PHYS_COV;
    const compDed = phys?.attributes?.compDed || '';
    const collDed = phys?.attributes?.collDed || '';
    out[veh.id] = {
      compDed,
      collDed,
      rentalReimb: '',
      // Per-coverage include flags - drive the row checkbox + the
      // disabled state on the value select below it. Every vehicle-
      // level coverage stays optional; these flags only say which
      // ones the prior policy already carried.
      compIncluded: !!compDed,
      collIncluded: !!collDed,
      rentalIncluded: false
    };
  });
  return out;
}

// Driver→vehicle map, taken from each driver's existing `assignedVehicleId`.
// Editable in Step 2. Manually-added drivers start unassigned.
function seedVehicleAssignments(vehicleRows, driverRows) {
  const out = {};
  // Prefer explicit per-vehicle rosters when the data declares them.
  const hasExplicit = vehicleRows.some(
    (v) => Array.isArray(v.assignedDriverIds) && v.assignedDriverIds.length
  );
  vehicleRows.forEach((veh) => {
    out[veh.id] = Array.isArray(veh.assignedDriverIds)
      ? [...veh.assignedDriverIds]
      : [];
  });
  // Legacy / manual-entry fallback: map each driver to their single
  // primary vehicle only when no vehicle declared an explicit roster.
  if (!hasExplicit) {
    driverRows.forEach((d) => {
      if (!d.assignedVehicleId) return;
      if (!out[d.assignedVehicleId]) out[d.assignedVehicleId] = [];
      if (!out[d.assignedVehicleId].includes(d.id)) {
        out[d.assignedVehicleId].push(d.id);
      }
    });
  }
  return out;
}

// Per-(vehicle, driver) coverage defaults - one entry per assigned pair
// that came off the prior policy. A driver (or a new assignment) added
// during the renewal is seeded blank by `handleAssignDriver`, not here,
// so Medical Payments is not tagged on net-new work.
//
// When `manual` is true, every value starts blank so the broker has to
// pick from the dropdown.
//
// The cloned path only pre-fills what the prior term carried for the
// drivers it inherits: Medical Payments arrives ticked at its prior
// limit, while Accidental Death Benefit and Crisis Response were
// declined so they stay off with no value.
function seedDriverCoverages(assignments, manual) {
  const out = {};
  Object.entries(assignments).forEach(([vehId, driverIds]) => {
    out[vehId] = {};
    driverIds.forEach((dId) => {
      const medPay = manual ? '' : DEFAULT_MED_PAY;
      out[vehId][dId] = {
        addBenefit: '',
        medPay,
        crisisResponse: '',
        // Per-coverage include flags - drive the row checkbox + the
        // disabled state on the value select below. Every driver-
        // level coverage stays optional; these flags only say which
        // ones the prior policy already carried.
        addIncluded: false,
        medIncluded: !!medPay,
        crisisIncluded: false
      };
    });
  });
  return out;
}

// Initial active-tab map - the "Vehicle Coverage" tab is active for every
// vehicle by default; switches to a driver tab when the user clicks one.
function seedActiveTabs(vehicleRows) {
  const out = {};
  vehicleRows.forEach((veh) => {
    out[veh.id] = 'vehicle';
  });
  return out;
}

// Target markets available for routing the RFQ. The broker selects these
// in priority order on the Market Routing step; the order drives the
// numbered badge shown on each card.
const MARKETS = [
  { id: 'm1', name: 'Regency', metadata: 'Best match · luxury auto', accent: '#b8860b' },
  { id: 'm2', name: 'Summit Insurance', metadata: 'Fast national P&C quotes', accent: '#c23934' },
  { id: 'm3', name: 'Capitol Insurance', metadata: 'Regional property specialist', accent: '#0b827c' },
  { id: 'm4', name: 'Accord Insurance', metadata: 'Commercial fleet expert', accent: '#7526e3' },
  { id: 'm5', name: 'Vanguard Insurance', metadata: 'Last quoted 12 days ago', accent: '#06a59a' },
  { id: 'm6', name: 'Apex Insurance', metadata: 'Incumbent · renews on time', accent: '#066afe' },
  { id: 'm7', name: 'Fortress Group', metadata: 'Strong home + auto bundles', accent: '#2e2e2e' },
  { id: 'm8', name: 'Forrest Partners', metadata: 'Non-standard auto niche', accent: '#b54708' }
];

export default class RfqWorkspace extends LightningElement {
  @api context;
  // In-workspace LOC session strip. Populated by the account record
  // page with all sibling RFQ tabs on the same account bundle so
  // brokers can jump between LOCs (Auto <-> Home) without leaving the
  // workspace card. Empty / single-entry lists suppress the strip.
  @api sessionTabs = [];

  // Bundle Review: sibling LOC snapshots handed down by the account
  // page. When the broker lands on the Review step and this array has
  // entries, the Review card renders a bundle-wide tab bar (self +
  // siblings) and swaps content via c-loc-review-panel for the
  // selected sibling. Empty on single-LOC bundles.
  @api siblingReviewPayloads = [];

  // Which LOC's Review the broker is currently viewing on the Review
  // step. Defaults to self's tabId (rendered inline via the existing
  // accordions). When the broker clicks a sibling pill in the Review
  // tab bar, this flips to that sibling's tabId and the card renders
  // c-loc-review-panel with the matching snapshot.
  @track activeReviewTabId = null;

  @track view = readInitialView();
  @track completed = readInitialCompleted();

  // ── Market Routing - ordered carrier selection (Step 3) ─────────
  // An array (not a Set) so the exact selection order is preserved and
  // surfaced as the numbered badge on each market card.
  @track selectedMarketIds = [];
  // Step 3 - Target Markets dropdown open state. Toggled by the
  // trigger button and closed when the broker clicks anywhere outside
  // the dropdown (see _docClickHandler in connectedCallback).
  @track _marketDropdownOpen = false;

  // ── Vehicles & Drivers - editable roster (Step 1) ───────────────
  // Seeded in connectedCallback: from the prior policy when shopping, or
  // empty for "None / Manual Entry" so the user builds the roster by hand.
  @track vehicleRows = [];
  @track driverRows = [];

  // ── Asset-level coverage state ──────────────────────────────────
  // Top-of-page (policy) limits applied across every vehicle.
  @track policyLimits = seedPolicyLimits();
  // Policy coverage ranges (include + limit/deductible min–max) for the
  // Personal Auto umbrella policy.
  @track coverageRanges = seedCoverageRanges();
  // Driver-→-vehicle assignments captured in Step 2 (seeded below).
  @track vehicleAssignments = {};
  // Per-vehicle deductibles set under each vehicle's "Vehicle Coverage" tab.
  @track vehicleCoverages = {};
  // Per-(vehicle, driver) coverage flags set under driver tabs.
  @track driverCoverages = {};
  // Retained for CSV-ingest parity; coverage editing now lives in the
  // c-pa-asset-tree expand/collapse tree rather than scoped tabs.
  @track activeTabByVehicle = {};

  // Review & Publish - natural-language routing strategy.
  @track routingStrategy = '';

  // Review & Submit - requested coverage term (effective dates), seeded
  // from the RFQ's default policy window. Mirrors the Setup "Effective
  // Start/End" fields so the broker confirms the term before submitting.
  @track effectiveFrom = rfqData.effectiveDate || '';
  @track effectiveTo = rfqData.expirationDate || '';

  // Review & Submit → Policy Details inline edit state. Only one date
  // field can be in edit mode at a time (mimics the SLDS record-detail
  // inline-edit pattern). Set to 'effectiveFrom' or 'effectiveTo' when
  // the broker clicks the matching pencil; blur/Enter clears it back
  // to null so the row snaps back to the read-only value. The Policy
  // Start / End rows are the only two rows in `quoteDetailsHighlights`
  // that carry `isEditable: true`; everything else (Application ID,
  // Application Name, Line of Coverage, Prior Policy) stays read-only.
  @track _editingDateField = null;

  // ── Schedule of Vehicles - Add Asset state ──────────────────────
  // Local toast is owned by the workspace (scoped to the wizard), so
  // the global app-level toast keeps its lifecycle for risk / policy
  // events.

  // Step 3 "See Base Policy" modal - opens when the broker clicks the
  // link CTA on Review & Submit. Only meaningful when the RFQ was
  // cloned from a prior policy (see hasPriorPolicy below).
  @track basePolicyModalOpen = false;

  // Step 3 "Assets & Coverages" panel - collapsed on first paint so
  // the Review card lands as a short summary the broker can scan,
  // and the full vehicle -> coverages -> drivers tree only unfolds
  // once they click the header. Application Details stays
  // permanently open next to it because it's a six-row grid, not a
  // hierarchy.
  @track assetsCoveragesExpanded = false;

  // ── Delete-LOC confirmation modal ─────────────────────────────
  // Opened by the × affordance on any pill in the session strip.
  // `_deleteLocSession` carries the target pill's { id, locLabel,
  // warningText } while the modal is open; Confirm dispatches
  // `tabclose` (c-app listens for this and drops the tab), Cancel
  // just resets the state.
  @track _deleteLocOpen = false;
  @track _deleteLocSession = null;

  // Progressive-disclosure state for the Review step's accordion. Each
  // key mirrors the `open` attribute on the corresponding <details>
  // element (kept in sync via handleReviewSectionToggle) so other
  // getters / future features (e.g. "expand all" or a print view) can
  // read + drive it. All sections open on first paint so the broker
  // sees the full LOC review at a glance when they click a bundle
  // review tab - they can still collapse individual sections
  // manually.
  @track reviewSections = {
    policyDetails: true,
    // Post-redesign the Review card collapses Schedule of Vehicles +
    // Schedule of Drivers + Policy Coverages into a single unified
    // "Assets & Coverages" accordion whose body is the read-only
    // c-pa-asset-tree (mode="review"). The legacy keys stay in the
    // map (they're `open` bindings for the old <details> elements)
    // so we don't introduce a wave of undefined-state renders across
    // sibling components / snapshots; they're just no longer wired
    // up in this template.
    assetsCoverages: true,
    vehicles: true,
    drivers: true,
    coverages: true
  };

  // ── Add Vehicle / Create Driver / Remove Driver modals ───────────
  // addAssetModalOpen drives the new two-step Add Asset picker modal
  // used by the root-level "Add Vehicle" button. The existing vehicle /
  // driver modals stay for the Edit and per-vehicle "Create New
  // Driver" paths, which don't need the picker step.
  @track addAssetModalOpen = false;
  @track addVehicleModalOpen = false;
  // When set, the vehicle modal opens in Edit mode prefilled from this row.
  @track editingVehicle = null;
  @track addDriverModalOpen = false;
  @track removeDriverModal = {
    open: false,
    vehicleId: null,
    driverId: null,
    driverName: '',
    vehicleName: '',
    otherVehicleNames: []
  };
  // Remembers which vehicle a freshly-created driver auto-assigns to.
  _pendingDriverVehicleId = null;

  _marketDocClickHandler = null;

  applicationId = rfqData.id;

  connectedCallback() {
    // Seed the roster. "None / Manual Entry" starts blank so the broker
    // adds vehicles + drivers via the buttons; otherwise pre-load from
    // the prior policy. When the intake modal forwards a roster snapshot
    // (priorVehicleIds + priorDriverIds - newer per-prior-policy
    // structure introduced in the modal), use that subset so swapping
    // prior policies (e.g. Apex 2025 → Progressive 2022) actually
    // reshapes the wizard. Falls back to the full rfqData fleet for
    // legacy direct launches that don't pass roster ids.
    const manual = this.isManualEntry;
    const ctx = this.context || {};
    const vehicleSource = manual
      ? []
      : this._resolvePriorVehicles(ctx.priorVehicleIds);
    const driverSource = manual
      ? []
      : this._resolvePriorDrivers(ctx.priorDriverIds);
    const vehicleRows = vehicleSource.map(mapVehicleRow);
    const driverRows = driverSource.map(mapDriverRow);
    this.vehicleRows = vehicleRows;
    this.driverRows = driverRows;

    // Step 3 - Effective From/To. Precedence:
    //   1. Intake-modal pick (ctx.effectiveFrom / ctx.effectiveTo) -
    //      whatever the broker entered in the Create RFQ form. These
    //      are the source of truth and override every fallback.
    //   2. Day after the prior policy's Effective To (n+1), with a
    //      one-year term, when the broker cloned but didn't pick
    //      custom dates.
    //   3. rfqData defaults (already seeded into the @track props).
    if (ctx.effectiveFrom) {
      this.effectiveFrom = ctx.effectiveFrom;
    } else if (ctx.priorEffectiveTo) {
      this.effectiveFrom = nextTermFromPriorEnd(ctx.priorEffectiveTo).from;
    }
    if (ctx.effectiveTo) {
      this.effectiveTo = ctx.effectiveTo;
    } else if (ctx.priorEffectiveTo) {
      this.effectiveTo = nextTermFromPriorEnd(ctx.priorEffectiveTo).to;
    }
    const assignments = seedVehicleAssignments(vehicleRows, driverRows);
    this.vehicleAssignments = assignments;
    // Re-seed coverages with the manual-entry flag in scope. Manual
    // entry leaves every value blank so the broker has to pick; the
    // cloned path keeps the prior-policy-shaped defaults.
    this.coverageRanges = seedCoverageRanges(manual);
    this.vehicleCoverages = seedVehicleCoverages(vehicleRows, manual);
    this.driverCoverages = seedDriverCoverages(assignments, manual);
    this.activeTabByVehicle = seedActiveTabs(vehicleRows);

    // The renewal path is now chosen in the Intake modal and forwarded via
    // context. Straight-Through skips the wizard entirely: mark every step
    // complete, fire risksubmitted (which pops the Slack drawer with the
    // Compare Quotes action), and drop straight into the submitted view.
    if (this.context?.renewalMode === MODE_STRAIGHT) {
      this.completed = {
        vehicles: true,
        coverages: true,
        review: true
      };
      this.view = 'submitted';
      Promise.resolve().then(() => {
        this.dispatchEvent(
          new CustomEvent('risksubmitted', {
            detail: {
              accountName: this.accountName,
              applicationName: this.appName,
              message:
                'Straight-through renewal initiated with Apex Mutual. Click Compare Quotes in Slack to review the incumbent terms and bind.'
            },
            bubbles: true,
            composed: true
          })
        );
      });
    }
  }

  // Resolve the intake modal's priorVehicleIds against rfqData.lineItems
  // so each prior policy can carry its own roster snapshot (e.g. the 2024
  // Lighthouse policy covered all three household cars, while the 2025
  // Apex policy covers only the two James drives). Falls back to the full
  // fleet when ids weren't supplied (legacy direct-launch context).
  _resolvePriorVehicles(ids) {
    if (!Array.isArray(ids)) return rfqData.lineItems;
    const map = new Map(rfqData.lineItems.map((li) => [li.id, li]));
    return ids.map((id) => map.get(id)).filter(Boolean);
  }

  // Same shape for drivers.
  _resolvePriorDrivers(ids) {
    if (!Array.isArray(ids)) return drivers;
    const map = new Map(drivers.map((d) => [d.id, d]));
    return ids.map((id) => map.get(id)).filter(Boolean);
  }

  // ── View flags ───────────────────────────────────────────────────
  get isWizard() {
    return this.view === 'wizard';
  }
  get isSubmitted() {
    return this.view === 'submitted';
  }

  // ── Step flags (one true at a time while in the wizard) ─────────
  get isOnVehiclesStep() {
    return !this.completed.vehicles && this.isWizard;
  }
  get isOnCoveragesStep() {
    return (
      this.completed.vehicles &&
      !this.completed.coverages &&
      this.isWizard
    );
  }
  // Review is the terminal wizard step, so it stays rendered once
  // Vehicles + Coverages are done. Deliberately does NOT test
  // `!completed.review`: `_saveRfqToBundle` marks review complete so
  // the sidebar / session pill read "Ready" while keeping
  // view === 'wizard', so gating on it collapsed every step template
  // and left <main class="workspace"> empty on any already-saved LOC
  // tab the broker came back to (e.g. after a sibling LOC is deleted
  // and c-app activates this tab).
  get isOnReviewStep() {
    return (
      this.completed.vehicles &&
      this.completed.coverages &&
      this.isWizard
    );
  }

  // ── Section CSS classes (halo the current step) ─────────────────
  get vehiclesSectionClass() {
    return this.isOnVehiclesStep ? 'block is-current' : 'block';
  }
  get coveragesSectionClass() {
    return this.isOnCoveragesStep ? 'block is-current' : 'block';
  }

  get activeStep() {
    return STEP_ORDER.find((id) => !this.completed[id]) || 'review';
  }

  // ── "Go to previous" affordance (one step renders at a time) ────
  get hasPreviousStep() {
    return STEP_ORDER.indexOf(this.activeStep) > 0;
  }

  get previousStepLabel() {
    const idx = STEP_ORDER.indexOf(this.activeStep);
    return idx > 0 ? STEP_TITLES[STEP_ORDER[idx - 1]] : '';
  }

  handleGoPrevious() {
    const idx = STEP_ORDER.indexOf(this.activeStep);
    if (idx > 0) this.goToStep(STEP_ORDER[idx - 1]);
  }

  get readyToSubmit() {
    return this.completed.vehicles && this.completed.coverages;
  }

  get submitDisabled() {
    return !this.readyToSubmit;
  }

  get submitLabel() {
    if (this.readyToSubmit) return 'Submit to Markets';
    const remaining = STEP_ORDER.slice(0, 2).filter(
      (id) => !this.completed[id]
    ).length;
    return `Complete ${remaining} step${remaining === 1 ? '' : 's'} to submit`;
  }

  // ── Account / app / context derivation ──────────────────────────
  get appName() {
    return this.context?.applicationName || rfqData.applicationName;
  }

  get account() {
    const id = this.context?.accountId || rfqData.accountId;
    return MOCK_ACCOUNTS.find((a) => a.id === id) || rfqData.account;
  }

  get accountName() {
    return this.context?.accountName || this.account?.name || rfqData.account?.name;
  }

  get accountIndustry() {
    return this.account?.industry || rfqData.account?.industry;
  }

  get effectiveLabel() {
    return fmtDate(rfqData.effectiveDate);
  }

  get deadlineLabel() {
    return fmtDate(rfqData.responseDeadline);
  }

  get launchedFromAccount() {
    return !!this.context?.launchedFromAccount;
  }

  get breadcrumbItems() {
    const items = [
      { label: 'Accounts', href: '#accounts', isLink: true },
      { label: this.accountName, href: '#account', isLink: true },
      { label: this.context?.tabLabel || 'New RFQ', href: null, isLink: false }
    ];
    return items.map((item, idx) => ({
      ...item,
      key: `crumb-${idx}`,
      hasSeparator: idx < items.length - 1,
      linkClass: item.isLink ? 'sf-breadcrumb-link' : 'sf-breadcrumb-current'
    }));
  }

  // ── Step 1: Vehicles & Drivers (pre-loaded, or built manually) ──
  // Manual entry = blank vehicle + driver roster on Step 1. Two signals
  // can flip us into manual mode:
  //   1. context.startMode === 'scratch' - the intake modal's "Start
  //      New Quote" radio (the new path).
  //   2. context.priorPolicyValue === 'none' - the legacy "None /
  //      Manual Entry" prior-policy option (kept for back-compat with
  //      flows that don't pass startMode).
  // Either signal short-circuits the rfqData.lineItems pre-load below.
  get isManualEntry() {
    return (
      this.context?.startMode === 'scratch' ||
      this.context?.priorPolicyValue === 'none'
    );
  }

  get vehicleView() {
    return this.vehicleRows;
  }

  get driverView() {
    return this.driverRows;
  }

  get vehiclesCount() {
    return this.vehicleRows.length;
  }

  get driversCount() {
    return this.driverRows.length;
  }

  get participantsLabel() {
    return `${this.vehiclesCount} vehicle${this.vehiclesCount === 1 ? '' : 's'} + ${this.driversCount} driver${this.driversCount === 1 ? '' : 's'} matched`;
  }

  // Schedule-of-Vehicles subtitle. From-scratch keeps a generic add
  // prompt; pre-loaded names the source policy (label + number) so
  // the broker can see where the roster was imported from. (CSV
  // bulk-import copy was retired when the upload capability was
  // removed.)
  get scheduleSubtitle() {
    if (this.isManualEntry) {
      return 'Add vehicles and drivers one at a time to build the schedule.';
    }
    const label =
      this.context?.priorPolicy || rfqData.priorPolicyLabel || 'the prior policy';
    const parts = [label];
    // Prefer a captured policy number (intake flow); fall back to the
    // source policy ID (direct-launch context).
    const num = this.context?.priorPolicyNumber;
    const id = this.context?.priorPolicyId;
    if (num) parts.push(`Policy #${num}`);
    else if (id) parts.push(`ID ${id}`);
    const term = this.context?.priorPolicyTerm;
    if (term) parts.push(`Term ${term}`);
    return `Imported from ${parts.join(' · ')}.`;
  }

  // Prior Policy Details - the incumbent policy this RFQ was created from.
  // Surfaced on the Review & Submit step so the broker sees the baseline.
  // Pulls from the intake context, with sensible fallbacks for direct entry.
  get priorPolicyDetails() {
    const ctx = this.context || {};
    const label = ctx.priorPolicy || rfqData.priorPolicyLabel || '';

    // Carrier - explicit, else the segment after the em/en dash in the label.
    let carrier = ctx.priorCarrier;
    if (!carrier && label) {
      const segs = label.split(/[-–-]/);
      carrier = segs.length > 1 ? segs[segs.length - 1].trim() : label.trim();
    }

    const number = ctx.priorPolicyNumber || ctx.priorPolicyId || '-';

    // Annual premium - intake value, else the incumbent quote for this app.
    let premiumNum = null;
    if (ctx.priorPremium != null && ctx.priorPremium !== '') {
      const n = Number(ctx.priorPremium);
      if (!Number.isNaN(n)) premiumNum = n;
    }
    if (premiumNum == null) {
      const appId = ctx.applicationId || rfqData.id;
      const inc = (quotes || []).find(
        (q) => q.incumbent && q.applicationId === appId
      );
      if (inc && inc.annualPremium != null) premiumNum = inc.annualPremium;
    }
    const premium =
      premiumNum != null
        ? premiumNum.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
          })
        : '-';

    // Fourth field - Years of Coverage when known, else the policy Term.
    let fourthLabel = 'Policy Term';
    let fourthValue = ctx.priorPolicyTerm || '-';
    if (ctx.priorYearsOfCoverage != null && ctx.priorYearsOfCoverage !== '') {
      const y = Number(ctx.priorYearsOfCoverage);
      fourthLabel = 'Years of Coverage';
      fourthValue = `${ctx.priorYearsOfCoverage} year${y === 1 ? '' : 's'}`;
    }

    return {
      carrier: carrier || '-',
      number,
      premium,
      fourthLabel,
      fourthValue
    };
  }

  // Step 3 - "See Base Policy" CTA visibility. The link only renders
  // when this RFQ was cloned from a prior policy; from-scratch flows
  // have nothing to surface.
  get hasPriorPolicy() {
    return !this.isManualEntry;
  }

  // Drives the "See Base Policy" CTA that sits under the Policy
  // Details grid. Derived from the highlights rather than recomputing
  // `hasPriorPolicy && priorLabel`, so the CTA can never appear
  // without the Prior Policy row it refers to.
  get showBasePolicyCta() {
    return this.quoteDetailsHighlights.some((h) => h.showBasePolicyLink);
  }

  // Global kill-switch for the Agentforce Summary card on the Review
  // step. Set to false to hide the card across all flows (markup +
  // styles stay so we can flip back later). When toggled on, the
  // card surfaces the exec-summary highlights + the "See Base Policy"
  // link CTA at the bottom.
  get showAgentforceSummary() {
    return false;
  }

  // Sibling kill-switch for the Agentforce Routing block on the
  // Review step (purple "Describe your routing strategy" panel).
  // Same pattern as showAgentforceSummary - markup + styles stay
  // intact so the panel can be flipped back on without re-authoring.
  get showAgentforceRouting() {
    return false;
  }

  // Step 3 - Agentforce Summary highlights. Replaces the previous
  // free-text paragraphs with a scannable executive-style key/value
  // list. All values are derived from existing getters so this stays
  // in sync with whatever the broker captures on Steps 1-2. Effective
  // From / Effective To come straight from the intake modal
  // (ctx.effectiveFrom / ctx.effectiveTo) and are the source of truth
  // for the requested term - no editable inputs on this step.
  get agentforceHighlights() {
    return [
      { key: 'account', label: 'Account', value: this.accountName },
      {
        key: 'product',
        label: 'Product',
        value: this.context?.loc || 'Personal Auto'
      },
      {
        key: 'effectiveFrom',
        label: 'Effective From',
        value: this._fmtReviewDate(this.effectiveFrom)
      },
      {
        key: 'effectiveTo',
        label: 'Effective To',
        value: this._fmtReviewDate(this.effectiveTo)
      },
      { key: 'schedule', label: 'Schedule', value: this.participantsLabel },
      {
        key: 'coverages',
        label: 'Coverages',
        value: this.reviewCoverageSummary
      },
      {
        key: 'umbrella',
        label: 'Umbrella',
        value: this.policyLimits?.umbrellaLimit || '-'
      }
    ];
  }

  _fmtReviewDate(iso) {
    return formatUsDateOrDash(iso);
  }

  // ── Quote Details / Application Details (Review step) ───────────
  // The key/value grid that anchors the top of the Review card's
  // "Application Details" panel. Rendered from a single flat array
  // (no fan-out) so the template is a one-liner: `for:each` and let
  // each item's own flags decide whether to draw a pencil, an inline
  // date input, or a "See Base Policy" affordance.
  //
  // Row shape:
  //   { key, label, value,                (always present)
  //     isEditable,                       true only for date rows
  //     isEditing,                        true when this row's field
  //                                       is the current inline-edit
  //                                       target (pencil clicked)
  //     dateField,                        which @track property to
  //                                       write back to on change
  //                                       ('effectiveFrom' | 'effectiveTo')
  //     dateInputValue,                   ISO yyyy-mm-dd for the
  //                                       <input type="date"> bound
  //                                       value (raw, not formatted)
  //     showBasePolicyLink }              true only for Prior Policy
  //
  // Row order groups the three least-mutable identity fields
  // (Application ID + Application Name + Line of Coverage) on the
  // first grid line, so the broker's eye lands on "what is this
  // RFQ" first. The mutable term-window rows (Policy Start / End)
  // follow on the second line so the pencil affordances cluster
  // together. Optional Prior Policy tails at the end.
  get quoteDetailsHighlights() {
    const ctx = this.context || {};
    const priorLabel =
      ctx.priorPolicy || rfqData.priorPolicyLabel || '';
    // Cached once so all four date-row branches (label/value + input
    // binding) resolve against the same tracked state read.
    const editingField = this._editingDateField;
    const out = [
      {
        key: 'applicationId',
        label: 'Application ID',
        value: this.applicationId || '-',
        isEditable: false,
        isEditing: false,
        dateField: '',
        dateInputValue: '',
        showBasePolicyLink: false
      },
      {
        key: 'applicationName',
        label: 'Application Name',
        value: this.appName || '-',
        isEditable: false,
        isEditing: false,
        dateField: '',
        dateInputValue: '',
        showBasePolicyLink: false
      },
      {
        key: 'loc',
        label: 'Line of Coverage',
        value: ctx.loc || 'Personal Auto',
        isEditable: false,
        isEditing: false,
        dateField: '',
        dateInputValue: '',
        showBasePolicyLink: false
      },
      {
        key: 'policyStart',
        label: 'Policy Start',
        value: this._fmtReviewDate(this.effectiveFrom),
        // Inline pencil-edit target. `isEditing` flips true when the
        // broker clicks the pencil - the template then swaps the
        // read-only text span for an <input type="date">. Blur / Enter
        // clears `_editingDateField` back to null and the row snaps
        // back to the formatted read-only value.
        isEditable: true,
        isEditing: editingField === 'effectiveFrom',
        dateField: 'effectiveFrom',
        dateInputValue: this.effectiveFrom || '',
        showBasePolicyLink: false
      },
      {
        key: 'policyEnd',
        label: 'Policy End',
        value: this._fmtReviewDate(this.effectiveTo),
        isEditable: true,
        isEditing: editingField === 'effectiveTo',
        dateField: 'effectiveTo',
        dateInputValue: this.effectiveTo || '',
        showBasePolicyLink: false
      }
    ];
    // Prior Policy is only included when this RFQ was cloned from an
    // incumbent. Empty / from-scratch flows drop the row entirely so
    // the highlights grid stays tidy.
    if (this.hasPriorPolicy && priorLabel) {
      out.push({
        key: 'priorPolicy',
        label: 'Prior Policy',
        value: priorLabel,
        isEditable: false,
        isEditing: false,
        dateField: '',
        dateInputValue: '',
        showBasePolicyLink: true
      });
    }
    return out;
  }

  // ── Inline pencil-edit for Policy Start / Policy End ─────────────
  // Handler set for the pencil-in-row edit affordance on the two
  // date rows in `quoteDetailsHighlights`. The pattern:
  //   1. Broker clicks the pencil button → handleEditPolicyDate reads
  //      `data-field` off the button and sets `_editingDateField` to
  //      that field name. The row's `isEditing` flag flips true on
  //      the next render, the template swaps to <input type="date">.
  //   2. Broker types or picks a date → handlePolicyDateChange reads
  //      the input value + `data-field` and writes it back to the
  //      matching @track property (`effectiveFrom` / `effectiveTo`).
  //   3. Broker blurs the input OR presses Enter → handlePolicyDateBlur
  //      (or handlePolicyDateKeydown on Enter) clears
  //      `_editingDateField` to null, collapsing the row back to its
  //      read-only text state. Escape also cancels without persisting
  //      any half-typed value beyond what the browser committed on
  //      the last onchange, which matches the SLDS record-detail
  //      inline-edit ergonomics.
  handleEditPolicyDate(event) {
    const field = event?.currentTarget?.dataset?.field;
    if (field !== 'effectiveFrom' && field !== 'effectiveTo') return;
    this._editingDateField = field;
    // The freshly-rendered <input type="date"> carries the native
    // `autofocus` attribute + we back it up with a post-render
    // querySelector-based focus so the broker can start typing
    // immediately. lwc:ref can't be used here because it requires a
    // static string identifier - our two edit targets share the same
    // template branch (one date input at a time), so a plain query
    // is the simplest way to grab the live element.
    requestAnimationFrame(() => {
      const input =
        this.template &&
        this.template.querySelector(
          `.quote-details__date-input[data-field="${field}"]`
        );
      if (input && typeof input.focus === 'function') {
        input.focus();
      }
    });
  }

  handlePolicyDateChange(event) {
    const field = event?.currentTarget?.dataset?.field;
    const value = event?.detail?.value ?? event?.target?.value ?? '';
    if (field === 'effectiveFrom') {
      this.effectiveFrom = value;
    } else if (field === 'effectiveTo') {
      this.effectiveTo = value;
    }
  }

  // Commit-on-blur: clears the edit-mode flag so the row collapses
  // back to formatted text. The value itself was already written on
  // the last onchange, so there's nothing else to persist here.
  handlePolicyDateBlur() {
    this._editingDateField = null;
  }

  // Enter also commits + exits edit mode (keyboard partner to blur).
  // Escape cancels the current edit without wiping the value that
  // was already committed via handlePolicyDateChange; the broker can
  // re-open the pencil to fix a mistake if needed.
  handlePolicyDateKeydown(event) {
    const key = event?.key || event?.detail?.key;
    if (key === 'Enter' || key === 'Escape') {
      event.preventDefault();
      this._editingDateField = null;
    }
  }

  // ── Assets & Coverages panel expand / collapse ───────────────────
  // The header is the click target (chevron + title), matching the
  // accordion semantics c-pa-asset-tree already uses for its own
  // Policy-Level Coverages card. The pencil sitting in the same
  // header stops propagation so editing never doubles as a toggle.
  get assetsCoveragesChevronClass() {
    return this.assetsCoveragesExpanded
      ? 'review-panel__chevron is-open'
      : 'review-panel__chevron';
  }

  get assetsCoveragesAriaExpanded() {
    return this.assetsCoveragesExpanded ? 'true' : 'false';
  }

  toggleAssetsCoverages() {
    this.assetsCoveragesExpanded = !this.assetsCoveragesExpanded;
  }

  handleAssetsCoveragesKeydown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggleAssetsCoverages();
    }
  }

  // ── Pencil on the Assets & Coverages panel header ────────────────
  // Jumps back to Step 1 (Vehicles & Drivers) so the broker can edit
  // the roster + assignments + coverages. Step 1 is the earliest
  // point where the tree data is authored; the broker walks forward
  // from there, and goToStep preserves everything they've already
  // captured. The Assets & Coverages wrapper used to be a <details>
  // accordion, so stopPropagation + preventDefault were required to
  // keep the pencil click from also toggling the summary. The
  // wrapper is now a flat <section>, but we keep both defensively so
  // a stray ancestor listener (form submit, bubbling toggle on a
  // future refactor) can't hijack the click.
  handleEditAssetsCoverages(event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.goToStep('vehicles');
  }

  // Year / Make / Model rows for the Quote Details Vehicles table.
  // Mirrors the parsing logic used by paAssetTree._parseVehicleName -
  // first token is the year when it's 4 digits, second is the make,
  // remainder is the model.
  get quoteDetailsVehicles() {
    return (this.vehicleRows || []).map((v) => {
      const parts = String(v.name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      let year = '-';
      let make = '-';
      let model = '-';
      if (parts.length) {
        if (/^\d{4}$/.test(parts[0])) {
          year = parts[0];
          if (parts[1]) make = parts[1];
          if (parts.length > 2) model = parts.slice(2).join(' ');
        } else {
          make = parts[0];
          if (parts.length > 1) model = parts.slice(1).join(' ');
        }
      }
      return { id: v.id, year, make, model };
    });
  }

  // First Name / Last Name / DOB rows for the Quote Details Drivers
  // table. Split on first whitespace so multi-word last names stay
  // grouped (e.g. "Maria van Buren" -> firstName "Maria", lastName
  // "van Buren"). DOB reuses _fmtReviewDate for consistent formatting.
  get quoteDetailsDrivers() {
    return (this.driverRows || []).map((d) => {
      const full = String(d.name || '').trim();
      const idx = full.indexOf(' ');
      const firstName = idx === -1 ? full : full.slice(0, idx);
      const lastName = idx === -1 ? '' : full.slice(idx + 1).trim();
      return {
        id: d.id,
        firstName: firstName || '-',
        lastName: lastName || '-',
        dobDisplay: this._fmtReviewDate(d.dob)
      };
    });
  }

  // ── Review section open-state getters (legacy) ─────────────────
  // The Policy Details + Assets & Coverages sections used to render
  // as <details> accordions and drove their `open={...}` bindings
  // through these getters. The Review card was flattened to plain
  // always-visible sections, so the two getters that backed those
  // accordions (`isPolicyDetailsOpen`, `isAssetsCoveragesOpen`) +
  // the toggle handler that mirrored the DOM state back into
  // `reviewSections` are gone. The keys themselves are kept on the
  // @track state (see connectedCallback / reviewSections
  // declaration) so any lingering downstream reads
  // (loc-review-panel snapshots, print export, etc.) don't hit
  // undefined - they still resolve `true` from the initializer.
  get isVehiclesSectionOpen() {
    return this.reviewSections?.vehicles === true;
  }
  get isDriversSectionOpen() {
    return this.reviewSections?.drivers === true;
  }
  get isCoveragesSectionOpen() {
    return this.reviewSections?.coverages === true;
  }

  // Count labels for the accordion summaries. Singular / plural swap
  // so "1 Vehicle" / "2 Vehicles" reads naturally. Falls back to
  // 0 rather than "-" because these sections wouldn't render if the
  // upstream step was skipped.
  get vehicleCountLabel() {
    const n = (this.vehicleRows || []).length;
    return `${n} Vehicle${n === 1 ? '' : 's'}`;
  }
  get driverCountLabel() {
    const n = (this.driverRows || []).length;
    return `${n} Driver${n === 1 ? '' : 's'}`;
  }

  // High-level rollup for the Policy Details snapshot - LOC name +
  // effective range. Previously drove the collapsed accordion meta
  // line, but the accordion was flattened; the getter is kept
  // because buildReviewSnapshot still forwards it to
  // c-loc-review-panel (siblings' Review payloads reuse this
  // rollup as their `policyDetails.summary`). Falls back to just
  // the LOC when either date is missing.
  get policyDetailsSummary() {
    const loc = this.context?.loc || 'Personal Auto';
    if (this.effectiveFrom && this.effectiveTo) {
      return `${loc} · ${this.effectiveFrom} to ${this.effectiveTo}`;
    }
    return loc;
  }

  // Coverage rollup for the Policy Coverages summary line. Counts
  // included coverages (BI / PD / UM / Collision / Comprehensive
  // per seedCoverageRanges) so the broker can see how many are on
  // without expanding.
  get coverageSectionSummary() {
    const cr = this.coverageRanges || {};
    const included = Object.keys(cr).filter(
      (k) => cr[k]?.included !== false
    ).length;
    return `${included} Coverage${included === 1 ? '' : 's'} included`;
  }

  // Human-readable coverage lines for the expanded Policy Coverages
  // section. Uses the same key order as seedCoverageRanges so the
  // list is stable regardless of hash iteration. Each row surfaces
  // included/excluded status; the captured limit and deductible are
  // appended when they carry data so the broker can verify what was
  // asked for on Step 2. Collision and Comprehensive still carry the
  // legacy min/max band shape, so both are handled.
  get reviewPolicyCoverages() {
    const cr = this.coverageRanges || {};
    const spec = [
      { key: 'bi', label: 'Bodily Injury' },
      { key: 'pd', label: 'Property Damage' },
      { key: 'um', label: 'Uninsured / Underinsured Motorist' },
      { key: 'collision', label: 'Collision' },
      { key: 'comprehensive', label: 'Comprehensive' }
    ];
    return spec.map(({ key, label }) => {
      const row = cr[key] || {};
      const included = row.included !== false;
      const parts = [];
      if (row.limit) {
        parts.push(`Limit ${row.limit}`);
      } else if (row.limitMin || row.limitMax) {
        parts.push(
          `Limit ${row.limitMin || '-'} - ${row.limitMax || '-'}`
        );
      }
      if (row.ded) {
        parts.push(`Deductible ${row.ded}`);
      } else if (row.dedMin || row.dedMax) {
        parts.push(
          `Deductible ${row.dedMin || '-'} - ${row.dedMax || '-'}`
        );
      }
      return {
        key,
        label,
        included,
        statusLabel: included ? 'Included' : 'Not selected',
        rowClass: included
          ? 'review-cov review-cov--on'
          : 'review-cov review-cov--off',
        detailLine: included ? parts.join(' · ') : ''
      };
    });
  }

  // ── Bundle Review: snapshot publishing ────────────────────────
  // Build a normalized snapshot of this LOC's Review payload so the
  // account page can hand it to sibling workspaces for inline
  // rendering under the Review tab bar. The shape is intentionally
  // symmetric with c-rfq-workspace-home's snapshot (differing only
  // in the asset arrays keyed by locKind) so c-loc-review-panel can
  // render either one from a single template. See the shape docs at
  // the top of c-loc-review-panel.
  buildReviewSnapshot() {
    const ctx = this.context || {};
    const vehicles = this.quoteDetailsVehicles || [];
    const drivers = this.quoteDetailsDrivers || [];
    const coverages = this.reviewPolicyCoverages || [];
    const highlights = this.quoteDetailsHighlights || [];
    const hasContent =
      vehicles.length > 0 ||
      drivers.length > 0 ||
      coverages.some((c) => c.included);
    return {
      tabId: ctx.rfqId || null,
      locKind: 'auto',
      locLabel: ctx.loc || 'Personal Auto',
      application: this.appName,
      insured: this.accountName,
      status: this.completed?.review ? 'Ready' : 'Draft',
      policyDetails: {
        loc: ctx.loc || 'Personal Auto',
        effectiveFrom: this.effectiveFrom || '',
        effectiveTo: this.effectiveTo || '',
        summary: this.policyDetailsSummary,
        highlights
      },
      vehicles,
      drivers,
      // Home-only arrays kept empty so consumers can iterate safely
      // regardless of locKind.
      dwellings: [],
      homeowners: [],
      scheduledItems: [],
      coverages,
      counts: {
        vehicles: this.vehicleCountLabel,
        drivers: this.driverCountLabel,
        coverages: this.coverageSectionSummary
      },
      hasContent
    };
  }

  // Publish the snapshot to the account page. Hash-guarded so we
  // don't spam events on every render; only fires when the
  // serialized payload actually differs from the last dispatch.
  _publishReviewSnapshot() {
    const snap = this.buildReviewSnapshot();
    if (!snap.tabId) return;
    let hash;
    try {
      hash = JSON.stringify(snap);
    } catch (e) {
      hash = String(Date.now());
    }
    if (hash === this._lastReviewSnapshotHash) return;
    this._lastReviewSnapshotHash = hash;
    this.dispatchEvent(
      new CustomEvent('reviewsnapshot', {
        detail: { tabId: snap.tabId, snapshot: snap },
        bubbles: true,
        composed: true
      })
    );
  }

  renderedCallback() {
    // Publish after render so downstream getters (vehicleCountLabel,
    // reviewPolicyCoverages, etc.) reflect the latest state. Hash
    // check inside _publishReviewSnapshot prevents feedback loops
    // when the account page pushes sibling payloads back down.
    this._publishReviewSnapshot();
  }

  // ── Bundle Review tab bar ─────────────────────────────────────
  // Self entry for the tab bar. Uses the same shape as sibling
  // snapshots so the getter below can concatenate cleanly.
  get _selfReviewTabDescriptor() {
    const ctx = this.context || {};
    return {
      id: ctx.rfqId || 'self',
      locLabel: ctx.loc || 'Personal Auto',
      status: this.completed?.review ? 'Ready' : 'In progress',
      isSelf: true
    };
  }

  // Tab-bar rows. Self first, then siblings in tab-strip order.
  // Each entry carries: id, num (1-based position), locLabel,
  // isActive (matches activeReviewTabId), and a css className
  // string. Never returns fewer than 1 entry.
  get bundleReviewTabs() {
    const self = this._selfReviewTabDescriptor;
    const siblings = (this.siblingReviewPayloads || []).map((p) => ({
      id: p.tabId,
      locLabel: p.locLabel,
      status: p.status === 'Ready' ? 'Ready' : (p.hasContent ? 'In progress' : 'Not started'),
      isSelf: false,
      payload: p
    }));
    // Order by the bundle roster the session strip renders instead of
    // hoisting self to the front, so both strips agree on sequence and
    // on each badge number. `sessionTabs[].id`, `self.id`, and every
    // payload's `tabId` are all the workspace tab id (app.js assigns
    // it to context.rfqId at creation), so they join directly.
    const pool = [self, ...siblings];
    const order = (this.sessionTabs || []).map((s) => s.id);
    const byId = new Map(pool.map((t) => [t.id, t]));
    const ordered = order.map((id) => byId.get(id)).filter(Boolean);
    const rest = pool.filter((t) => !order.includes(t.id));
    const all = ordered.length ? [...ordered, ...rest] : pool;
    // Route the highlight through isReviewingSelf so a stale
    // activeReviewTabId (sibling LOC deleted while previewed) falls
    // back to self instead of leaving no pill selected.
    const active = this.isReviewingSelf ? self.id : this.activeReviewTabId;
    return all.map((t, i) => {
      const isActive = t.id === active;
      const isDone = t.status === 'Ready';
      const parts = ['p15-sess', 'bundle-review-tab'];
      if (isActive) parts.push('is-active');
      if (isDone) parts.push('is-done');
      else if (t.status === 'In progress') parts.push('is-inprogress');
      else parts.push('is-notstarted');
      return {
        ...t,
        isActive,
        isDone,
        className: parts.join(' ')
      };
    });
  }

  // Show the tab bar only when there's an actual bundle in play.
  get showBundleReviewTabs() {
    return this.bundleReviewTabs.length > 1;
  }

  // True when the broker is looking at their own LOC's Review (or
  // hasn't picked a sibling yet). Drives the lwc:if that swaps
  // between local accordions and c-loc-review-panel. Self-heals if
  // activeReviewTabId points to a sibling that's since been closed:
  // we treat that as "back to self" so the card doesn't render blank.
  get isReviewingSelf() {
    const selfId = this._selfReviewTabDescriptor.id;
    if (!this.activeReviewTabId || this.activeReviewTabId === selfId) return true;
    const known = (this.siblingReviewPayloads || []).some(
      (p) => p.tabId === this.activeReviewTabId
    );
    return !known;
  }

  // Snapshot payload for the currently-selected sibling tab, if any.
  get activeSiblingPayload() {
    if (this.isReviewingSelf) return null;
    return (this.siblingReviewPayloads || []).find(
      (p) => p.tabId === this.activeReviewTabId
    );
  }

  handleReviewTabClick(event) {
    // Bound to both onclick and onkeydown so mouse + keyboard both
    // work. On keydown, gate to Enter/Space (the accessible pattern
    // for role="tab" tabindex="0") so tab-nav keys don't trip it.
    if (event?.type === 'keydown') {
      const key = event.key;
      if (key !== 'Enter' && key !== ' ' && key !== 'Spacebar') return;
      event.preventDefault();
    }
    const id = event?.currentTarget?.dataset?.tabId;
    if (!id) return;
    const selfId = this._selfReviewTabDescriptor.id;
    // Clicking self clears the override so isReviewingSelf becomes
    // true again and the local accordions render.
    this.activeReviewTabId = id === selfId ? null : id;
  }

  openBasePolicyModal() {
    this.basePolicyModalOpen = true;
  }

  closeBasePolicyModal() {
    this.basePolicyModalOpen = false;
  }

  handleBasePolicyBackdrop() {
    this.closeBasePolicyModal();
  }

  stopBasePolicyPropagation(event) {
    event.stopPropagation();
  }

  // Copy + status pill adapt to the manual-entry vs pre-loaded path.
  get vehiclesIntro() {
    return this.isManualEntry
      ? 'Manual entry - add the vehicles and drivers for this RFQ using the buttons below.'
      : 'Pre-loaded from the 2025 Apex Mutual policy. Edit per-row if anything has changed.';
  }

  get participantsStatusLabel() {
    const prefix = this.isManualEntry ? 'Manual entry' : 'Pre-loaded';
    return `${prefix} · ${this.participantsLabel}`;
  }

  get hasNoVehicles() {
    return this.vehicleRows.length === 0;
  }

  get hasNoDrivers() {
    return this.driverRows.length === 0;
  }

  // Need at least one vehicle and one driver before leaving Step 1.
  get canContinueVehicles() {
    return this.vehicleRows.length > 0 && this.driverRows.length > 0;
  }

  get continueVehiclesDisabled() {
    return !this.canContinueVehicles;
  }

  // ── Add Asset (global tree action) ───────────────────────────────
  // Root-level "Add Vehicle" opens the two-step picker modal. Step 1
  // asks which child subject to add (Vehicle vs Driver on Auto);
  // Step 2 is the appropriate form. `handleAddAssetModalSave` routes
  // the emitted record to the existing append helpers based on kind.
  handleAddAsset() {
    this.addAssetModalOpen = true;
  }

  // Legacy alias - preserves existing call sites that expect the old
  // "Add Vehicle" name. Routes through the picker modal.
  handleAddVehicle() {
    this.handleAddAsset();
  }

  // Vehicle-level child subject kinds forwarded to c-pa-asset-tree.
  // PA today has one entry (Driver); when the list grows to 2+ the
  // tree's per-vehicle "Add New Driver" menu will surface a picker
  // step. Same shape as `assetPickerOptions` below so both can share
  // the eventual picker UI.
  get vehicleChildKinds() {
    return [
      {
        id: 'driver',
        label: 'Driver',
        description: 'Assign a driver to this vehicle.',
        iconPath:
          'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'
      }
    ];
  }

  // Picker options for the root-level Add Asset modal. Per the Auto
  // PCM, the Auto root has ONE first-level subject: Vehicle. Driver
  // is a second-level subject nested under Vehicle (surfaced via the
  // per-vehicle "Add New Driver" menu action + vehicleChildKinds
  // above), NOT a sibling of Vehicle. When the list has a single
  // entry the picker modal auto-skips Step 1 and mounts straight
  // into the Vehicle form. Home / EB will contribute their own
  // parallel entries here when they reactivate.
  get assetPickerOptions() {
    return [
      {
        id: 'vehicle',
        label: 'Vehicle',
        description:
          'Add a car, truck, motorcycle, or other vehicle to the RFQ.',
        // Simple car silhouette (Material-style path)
        iconPath:
          'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11C5.84 5 5.29 5.42 5.08 6.01L3 12v8a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h12v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.04 3H5.81l1.04-3zM19 17H5v-5h14v5z'
      }
    ];
  }

  handleAddAssetModalCancel() {
    this.addAssetModalOpen = false;
  }

  handleAddAssetModalSave(event) {
    const { kind, record } = event.detail || {};
    if (kind === 'vehicle' && record) {
      this.appendVehicleFromForm(record);
    } else if (kind === 'driver' && record) {
      // Root-level driver adds land on the household roster without an
      // implicit vehicle assignment - the broker can assign later from
      // the per-vehicle popover if needed.
      this._pendingDriverVehicleId = null;
      this.handleDriverModalSave({ detail: { driver: record } });
    }
    this.addAssetModalOpen = false;
  }

  // Overflow menu → Edit Vehicle: open the modal prefilled from the row.
  handleEditVehicleRequest(event) {
    const { vehicleId } = event.detail || {};
    const row = this.vehicleRows.find((v) => v.id === vehicleId);
    if (!row) return;
    this.editingVehicle = { ...row };
    this.addVehicleModalOpen = true;
  }

  handleVehicleModalCancel() {
    this.addVehicleModalOpen = false;
    this.editingVehicle = null;
  }

  handleVehicleModalSave(event) {
    const vehicle = event?.detail?.vehicle;
    const id = event?.detail?.id;
    if (vehicle && id) {
      this.updateVehicleFromForm(id, vehicle);
    } else if (vehicle) {
      this.appendVehicleFromForm(vehicle);
    }
    this.addVehicleModalOpen = false;
    this.editingVehicle = null;
  }

  // Update an existing vehicle row in place (Edit mode). Assignment +
  // coverage maps are keyed by id, so they're untouched.
  updateVehicleFromForm(id, vehicle) {
    this.vehicleRows = this.vehicleRows.map((row) =>
      row.id === id
        ? {
            ...row,
            name: vehicle.name || row.name,
            vin: vehicle.vin || 'Pending',
            use: vehicle.use || row.use,
            annualMileage: vehicle.annualMileage || row.annualMileage,
            bodyClass: vehicle.bodyClass || '',
            garagingZip: vehicle.garagingZip || ''
          }
        : row
    );
  }

  // Append a single vehicle (from the modal) and keep the assignment +
  // coverage maps in sync so Steps 2-3 immediately render the new asset.
  appendVehicleFromForm(vehicle) {
    const id = `veh-new-${Date.now()}`;
    const row = {
      id,
      name: vehicle.name || 'New Vehicle (Pending Details)',
      vin: vehicle.vin || 'Pending',
      use: vehicle.use || 'Commute',
      annualMileage: vehicle.annualMileage || 'Mileage TBD',
      garaging: '',
      // Substep 2.2 additions
      bodyClass: vehicle.bodyClass || '',
      garagingZip: vehicle.garagingZip || ''
    };
    this.vehicleRows = [...this.vehicleRows, row];
    // Newly added vehicles are net-new (never came from the prior
    // policy). Comp / Collision stay untagged and deductibles stay
    // empty until the broker elects them - they do not inherit the
    // prior term's physical-damage elections.
    this.vehicleCoverages = {
      ...this.vehicleCoverages,
      [id]: {
        compDed: '',
        collDed: '',
        rentalReimb: '',
        compIncluded: false,
        collIncluded: false,
        rentalIncluded: false
      }
    };
    this.vehicleAssignments = { ...this.vehicleAssignments, [id]: [] };
    this.activeTabByVehicle = { ...this.activeTabByVehicle, [id]: 'vehicle' };
  }

  // ── Assign / Create / Remove driver (asset-tree flows) ───────────
  // Assign an existing driver to a vehicle: append to the assignment
  // bucket and seed the (vehicle, driver) coverage row.
  handleAssignDriver(event) {
    const { vehicleId, driverId } = event.detail || {};
    if (!vehicleId || !driverId) return;
    const current = this.vehicleAssignments[vehicleId] || [];
    if (current.includes(driverId)) return;
    this.vehicleAssignments = {
      ...this.vehicleAssignments,
      [vehicleId]: [...current, driverId]
    };
    const vehBucket = { ...(this.driverCoverages[vehicleId] || {}) };
    if (!vehBucket[driverId]) {
      // New (vehicle, driver) pair - including an inherited driver
      // assigned to a newly added vehicle. Medical Payments stays
      // untagged; only pairs cloned from the prior term carry it.
      vehBucket[driverId] = {
        addBenefit: '',
        medPay: '',
        crisisResponse: '',
        addIncluded: false,
        medIncluded: false,
        crisisIncluded: false
      };
    }
    this.driverCoverages = { ...this.driverCoverages, [vehicleId]: vehBucket };
  }

  // "+ Create New Driver" picked inside a vehicle's assign popover -
  // remember which vehicle to auto-assign to, then open the modal.
  handleCreateDriverRequest(event) {
    this._pendingDriverVehicleId = event.detail?.vehicleId || null;
    this.addDriverModalOpen = true;
  }

  handleDriverModalCancel() {
    this._pendingDriverVehicleId = null;
    this.addDriverModalOpen = false;
  }

  // Create the new driver, add to the roster, then auto-assign to the
  // vehicle whose popover launched the flow.
  handleDriverModalSave(event) {
    const driver = event?.detail?.driver;
    const vehicleId = this._pendingDriverVehicleId;
    const veh = this.vehicleRows.find((v) => v.id === vehicleId);
    if (driver) {
      const id = `drv-new-${Date.now()}`;
      const row = mapDriverRow({
        id,
        name: driver.name || 'New Driver',
        dl: driver.dl || 'Pending',
        // Substep 2.3 - DOB (optional) carried from the modal.
        dob: driver.dob || '',
        assignedVehicleId: vehicleId || null,
        assignedVehicle: veh?.name || 'Unassigned'
      });
      this.driverRows = [...this.driverRows, row];
      if (vehicleId) {
        this.handleAssignDriver({ detail: { vehicleId, driverId: id } });
      }
    }
    this._pendingDriverVehicleId = null;
    this.addDriverModalOpen = false;
  }

  get pendingDriverVehicleName() {
    const veh = this.vehicleRows.find(
      (v) => v.id === this._pendingDriverVehicleId
    );
    return veh?.name || '';
  }

  // Vehicles surfaced in the Add Vehicle modal's lookup section -
  // the account's full asset catalog (RFQ default + additional
  // household catalog) minus anything already on this RFQ. Matched
  // by VIN so a freshly-added "Pending" VIN doesn't hide a legitimate
  // catalog entry.
  get availableVehiclesForLookup() {
    const onRfq = new Set(
      this.vehicleRows.map((r) => (r.vin || '').toUpperCase())
    );
    const catalog = [
      ...(rfqData.lineItems || []).filter((li) => li.itemType === 'vehicle'),
      ...ADDITIONAL_HOUSEHOLD_VEHICLES
    ];
    return catalog.filter(
      (li) => !onRfq.has(((li.attributes || {}).vin || '').toUpperCase())
    );
  }

  // Drivers surfaced in the Add Driver modal's lookup section - the full
  // household roster minus anyone already on this RFQ. On the Mavericks
  // renewal that means Joseph and Emily, since the expiring policy rates
  // James alone. Matched on id first, then DL number as a fallback.
  get availableDriversForLookup() {
    const onRfqIds = new Set(this.driverRows.map((d) => d.id));
    const onRfqDls = new Set(
      this.driverRows.map((d) => (d.dl || '').toUpperCase())
    );
    return drivers.filter(
      (d) => !onRfqIds.has(d.id) && !onRfqDls.has((d.dl || '').toUpperCase())
    );
  }

  // Delete a whole asset (vehicle) from the schedule - prunes its
  // assignment bucket and every coverage entry. Drivers stay on the
  // roster (they may be assigned to other vehicles).
  handleRemoveVehicleRequest(event) {
    const { vehicleId } = event.detail || {};
    if (!vehicleId) return;
    this.vehicleRows = this.vehicleRows.filter((v) => v.id !== vehicleId);

    const nextAssign = { ...this.vehicleAssignments };
    delete nextAssign[vehicleId];
    this.vehicleAssignments = nextAssign;

    const nextCov = { ...this.vehicleCoverages };
    delete nextCov[vehicleId];
    this.vehicleCoverages = nextCov;

    const nextDriverCov = { ...this.driverCoverages };
    delete nextDriverCov[vehicleId];
    this.driverCoverages = nextDriverCov;

    const nextTabs = { ...this.activeTabByVehicle };
    delete nextTabs[vehicleId];
    this.activeTabByVehicle = nextTabs;

  }

  // X on a driver chip → open the context-aware confirm modal. Surface
  // any other vehicles the driver is also assigned to.
  handleRemoveDriverRequest(event) {
    const { vehicleId, driverId } = event.detail || {};
    if (!vehicleId || !driverId) return;
    const driver = this.driverRows.find((d) => d.id === driverId);
    const veh = this.vehicleRows.find((v) => v.id === vehicleId);
    const otherVehicleNames = this.vehicleRows
      .filter(
        (v) =>
          v.id !== vehicleId &&
          (this.vehicleAssignments[v.id] || []).includes(driverId)
      )
      .map((v) => v.name);
    this.removeDriverModal = {
      open: true,
      vehicleId,
      driverId,
      driverName: driver?.name || 'this driver',
      vehicleName: veh?.name || 'this vehicle',
      otherVehicleNames
    };
  }

  handleRemoveDriverModalCancel() {
    this.removeDriverModal = { ...this.removeDriverModal, open: false };
  }

  // Unassign from this vehicle only - drop from the assignment bucket
  // and prune the (vehicle, driver) coverage row.
  handleRemoveDriverUnassign() {
    const { vehicleId, driverId } = this.removeDriverModal;
    if (vehicleId && driverId) {
      const bucket = (this.vehicleAssignments[vehicleId] || []).filter(
        (id) => id !== driverId
      );
      this.vehicleAssignments = {
        ...this.vehicleAssignments,
        [vehicleId]: bucket
      };
      const cov = { ...this.driverCoverages };
      if (cov[vehicleId]) {
        cov[vehicleId] = { ...cov[vehicleId] };
        delete cov[vehicleId][driverId];
        this.driverCoverages = cov;
      }
    }
    this.removeDriverModal = { ...this.removeDriverModal, open: false };
  }

  // Delete from the policy roster - unassign everywhere and remove the
  // driver row + every (vehicle, driver) coverage entry.
  handleRemoveDriverDelete() {
    const { driverId } = this.removeDriverModal;
    if (driverId) {
      this.driverRows = this.driverRows.filter((d) => d.id !== driverId);
      const nextAssign = {};
      Object.entries(this.vehicleAssignments).forEach(([vId, ids]) => {
        nextAssign[vId] = (ids || []).filter((id) => id !== driverId);
      });
      this.vehicleAssignments = nextAssign;
      const nextCov = {};
      Object.entries(this.driverCoverages).forEach(([vId, bucket]) => {
        const copy = { ...(bucket || {}) };
        delete copy[driverId];
        nextCov[vId] = copy;
      });
      this.driverCoverages = nextCov;
    }
    this.removeDriverModal = { ...this.removeDriverModal, open: false };
  }

  disconnectedCallback() {
    this._unbindMarketDocClick();
  }

  _bindMarketDocClick() {
    if (this._marketDocClickHandler) return;
    this._marketDocClickHandler = () => {
      // Any click that bubbles up to document closes the dropdown.
      // Clicks inside the dropdown stop propagation (see the wrapping
      // div in the template), so this only fires for outside clicks.
      this._marketDropdownOpen = false;
      this._unbindMarketDocClick();
    };
    document.addEventListener('click', this._marketDocClickHandler);
  }

  _unbindMarketDocClick() {
    if (!this._marketDocClickHandler) return;
    document.removeEventListener('click', this._marketDocClickHandler);
    this._marketDocClickHandler = null;
  }

  handleAddDriver() {
    const id = `drv-manual-${Date.now()}`;
    const n = this.driverRows.length + 1;
    const row = mapDriverRow({
      id,
      name: `New Driver ${n}`,
      dl: 'Pending',
      assignedVehicleId: null,
      assignedVehicle: 'Unassigned'
    });
    this.driverRows = [...this.driverRows, row];
  }

  confirmVehicles() {
    if (!this.canContinueVehicles) return;
    this.completed = { ...this.completed, vehicles: true };
  }

  // ── Step 2: Asset Coverages (Policy → Vehicle → Driver) ─────────
  // c-pa-asset-tree (coverages mode) dispatches three event kinds; each
  // is a shallow merge into the matching state slice so the child stays
  // a controlled view.
  handlePolicyLimitsChange(event) {
    const { key, value } = event.detail || {};
    if (!key) return;
    this.policyLimits = { ...this.policyLimits, [key]: value };
  }

  // Include toggle or a limit/deductible value changed on a policy
  // coverage. `field` ∈ included | limit | ded.
  handleCoverageRangeChange(event) {
    const { key, field, value } = event.detail || {};
    if (!key || !field) return;
    this.coverageRanges = {
      ...this.coverageRanges,
      [key]: { ...(this.coverageRanges[key] || {}), [field]: value }
    };
  }

  handleVehicleCoverageChange(event) {
    const { vehicleId, key, value } = event.detail || {};
    if (!vehicleId || !key) return;
    const current = this.vehicleCoverages[vehicleId] || {};
    this.vehicleCoverages = {
      ...this.vehicleCoverages,
      [vehicleId]: { ...current, [key]: value }
    };
  }

  handleDriverCoverageChange(event) {
    const { vehicleId, driverId, key, value } = event.detail || {};
    if (!vehicleId || !driverId || !key) return;
    const vehBucket = { ...(this.driverCoverages[vehicleId] || {}) };
    vehBucket[driverId] = { ...(vehBucket[driverId] || {}), [key]: value };
    this.driverCoverages = {
      ...this.driverCoverages,
      [vehicleId]: vehBucket
    };
  }

  confirmCoverages() {
    this.completed = {
      ...this.completed,
      vehicles: true,
      coverages: true
    };
  }

  // ── Step 3: Review & Publish ────────────────────────────────────
  // Target Markets dropdown (replaces the old card grid). Same
  // priority-order semantics: clicking a row appends to the end of
  // selectedMarketIds; unchecking removes it. The dropdown's checkbox
  // list keeps the broker scanning a tight vertical list rather than
  // a 4-col card wall.
  get marketOptions() {
    return MARKETS.map((m) => {
      const idx = this.selectedMarketIds.indexOf(m.id);
      const selected = idx !== -1;
      return {
        id: m.id,
        name: m.name,
        metadata: m.metadata,
        initial: m.name.charAt(0),
        selected,
        order: selected ? idx + 1 : null,
        optionClass: selected
          ? 'market-dropdown__option is-selected'
          : 'market-dropdown__option',
        logoStyle: `background: ${m.accent};`
      };
    });
  }

  // Dropdown open/closed state, plus chevron + ARIA helpers.
  get marketDropdownOpen() {
    return this._marketDropdownOpen;
  }
  get marketDropdownExpanded() {
    return this._marketDropdownOpen ? 'true' : 'false';
  }
  get marketDropdownChevronClass() {
    return this._marketDropdownOpen
      ? 'market-dropdown__chevron is-open'
      : 'market-dropdown__chevron';
  }
  // Trigger button label - empty state, single selection, or ordered
  // priority list (e.g. "1. Regency · 2. Summit Insurance"). Truncates
  // in CSS via ellipsis if the selection grows long.
  get marketDropdownTriggerLabel() {
    if (!this.selectedMarketIds.length) {
      return 'Choose target markets';
    }
    return this.selectedMarketIds
      .map((id, idx) => {
        const m = MARKETS.find((x) => x.id === id);
        return m ? `${idx + 1}. ${m.name}` : null;
      })
      .filter(Boolean)
      .join(' · ');
  }

  get selectedMarketCount() {
    return this.selectedMarketIds.length;
  }

  get hasSelectedMarkets() {
    return this.selectedMarketIds.length > 0;
  }

  // Ordered, human-readable list of the chosen markets (for the submit
  // hint + the submitted "Sent to" line).
  get selectedMarketsLabel() {
    if (!this.selectedMarketIds.length) return 'No markets selected yet';
    return this.selectedMarketIds
      .map((id) => MARKETS.find((m) => m.id === id)?.name)
      .filter(Boolean)
      .join(' · ');
  }

  get marketSelectHint() {
    const n = this.selectedMarketIds.length;
    if (!n) return 'Pick carriers from the list - the order you check them sets the send priority.';
    return `${n} market${n === 1 ? '' : 's'} selected · sent in the numbered order.`;
  }

  // Toggle a market in/out of the ordered selection. Reads from
  // event.target.dataset.id so the same handler works for both the
  // legacy click-card path (kept for back-compat) and the new
  // checkbox change path.
  toggleMarketSelection(event) {
    const src = event.target || event.currentTarget;
    const id = src.dataset?.id || event.currentTarget?.dataset?.id;
    if (!id) return;
    if (this.selectedMarketIds.includes(id)) {
      this.selectedMarketIds = this.selectedMarketIds.filter((x) => x !== id);
    } else {
      this.selectedMarketIds = [...this.selectedMarketIds, id];
    }
  }

  // Toggle the dropdown panel. Outside-clicks close it via the
  // doc-click handler installed in connectedCallback.
  handleMarketDropdownToggle(event) {
    event.stopPropagation();
    this._marketDropdownOpen = !this._marketDropdownOpen;
    if (this._marketDropdownOpen) {
      this._bindMarketDocClick();
    } else {
      this._unbindMarketDocClick();
    }
  }

  // Keeps clicks inside the dropdown (trigger button, panel rows,
  // checkboxes) from bubbling up to the doc-click handler that would
  // otherwise immediately close the panel.
  stopMarketDropdownPropagation(event) {
    event.stopPropagation();
  }

  get reviewCoverageSummary() {
    const cr = this.coverageRanges || {};
    const included = Object.keys(cr).filter((k) => cr[k]?.included !== false)
      .length;
    return `${included} coverage${included === 1 ? '' : 's'} included · Umbrella ${this.policyLimits.umbrellaLimit}`;
  }

  // Final JSON payload - the asset-level hierarchy (Policy → Vehicle →
  // Driver) that markets receive. Mirrors the SLDS-shaped UI exactly.
  buildAssetPayload() {
    return {
      policy: { ...this.policyLimits, coverageRanges: { ...this.coverageRanges } },
      vehicles: this.vehicleRows.map((veh) => ({
        id: veh.id,
        name: veh.name,
        coverage: this.vehicleCoverages[veh.id] || {},
        drivers: (this.vehicleAssignments[veh.id] || []).map((dId) => {
          const d = this.driverRows.find((x) => x.id === dId);
          return {
            id: dId,
            name: d?.name || dId,
            coverage: this.driverCoverages[veh.id]?.[dId] || {}
          };
        })
      }))
    };
  }

  updateRoutingStrategy(event) {
    this.routingStrategy = event.target.value;
  }

  // Save the captured RFQ into the account's submission bundle.
  //
  // Historically the Review page's primary CTA was "Submit to Markets"
  // and routing happened in-line here. Under the Multi-LOC model the
  // broker instead saves the RFQ as "Ready" and picks carriers from the
  // Submission Board (so multiple lines of coverage for the same
  // account can be bundled into a single carrier package). Both Review
  // footer CTAs share this helper - one then reopens the intake modal
  // for another LOC, the other pivots the account page to the board.
  //
  // The risksubmitted event still bubbles up so the app shell can flip
  // the RFQ row Draft -> Ready and surface a toast + Slack broadcast.
  _saveRfqToBundle() {
    this.completed = {
      ...this.completed,
      vehicles: true,
      coverages: true,
      review: true
    };
    this.dispatchEvent(
      new CustomEvent('risksubmitted', {
        detail: {
          // Identify which RFQ row to flip. `rfqId` is set upstream by
          // the app shell (matches the workspace-tab id + accountRfqs
          // row id) so the shell can update the exact row without
          // guessing.
          rfqId: this.context?.rfqId || null,
          accountId: this.context?.accountId || null,
          accountName: this.accountName,
          applicationName: this.appName,
          lob: this.context?.lob || null,
          loc: this.context?.loc || null,
          routingStrategy: this.routingStrategy || null,
          effectiveFrom: this.effectiveFrom || null,
          effectiveTo: this.effectiveTo || null,
          // New status the shell should apply to the RFQ row. Not
          // wired as "Submitted" any more - carriers are picked on
          // the Submission Board.
          newStatus: 'Ready for Submission',
          // Asset-level payload - carriers eventually see policy
          // limits, then a structured per-vehicle/per-driver
          // coverage tree.
          assetPayload: this.buildAssetPayload()
        },
        bubbles: true,
        composed: true
      })
    );
    // Keep the workspace on the Review view. Earlier iterations flipped
    // to a "Saved to submission bundle" interstitial here, but with the
    // fork CTAs living directly on Review the interstitial became an
    // empty panel - the account page navigates away to the target
    // (Submission Board or intake modal) via the fork's second call
    // (handleProceedToBoard / handleAddAnotherLoc). Backtracking to
    // this workspace tab lands the broker on Review with the fork
    // buttons still visible, which is the intended state.
    requestAnimationFrame(() => {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // Legacy alias: earlier iterations had a single "Save & Continue" CTA
  // on Review that saved the RFQ and dropped the broker on an
  // interstitial. The Review fork now branches directly (see
  // `handleOpenAddLob` / `handleSaveToBoard`), but keep this shim so
  // external call sites don't break.
  submitToMarkets() {
    this._saveRfqToBundle();
  }

  // Review page's ghost CTA: "+ Add Another Line of Coverage".
  // Persists the current RFQ into the bundle (Draft -> Ready) and
  // reopens the Create RFQ intake modal at the app shell so the broker
  // can start a fresh LOC RFQ for the same account without hopping
  // through an interstitial.
  handleOpenAddLob() {
    this._saveRfqToBundle();
    this.handleAddAnotherLoc();
  }

  // Review page's primary CTA: "Add to Submission Board". Persists the
  // current RFQ into the bundle (Draft -> Ready) and pivots the account
  // page's secondary tabs to the Submission Board so the broker can
  // pick Ready RFQs and route to markets.
  handleSaveToBoard() {
    this._saveRfqToBundle();
    this.handleProceedToBoard();
  }

  // Post-save recovery CTAs (interstitial, only visible if the broker
  // navigates back to the workspace tab after a save). "Add Another
  // Line of Coverage" reopens the intake modal; "Proceed to Submission
  // Board" jumps to the board tab. Same targets as the Review fork
  // above, but without the save (the RFQ was already saved).
  //
  // Hybrid "Add Another LOC" contract (matches Path 3 prototype):
  //   • The current tab stays in the workspace tab bar in its Ready
  //     state (Draft->Ready happened in `_saveRfqToBundle` above).
  //   • Intake modal opens PRE-FILLED for the same account +
  //     Line of Business + policy term the broker just used, so all
  //     they have to pick is a DIFFERENT Line of Coverage (e.g.,
  //     Personal Auto -> Homeowners on a Personal Lines bundle) and
  //     confirm.
  //   • On Continue, `c/app` spawns a fresh workspace tab for the
  //     new LOC. Both tabs are visible at once - broker toggles
  //     between them to keep quoting the account.
  //   • `isAddingLoc` + `sourceLocLabel` are hints for downstream
  //     UI (modal copy, tab label) so the broker sees "adding
  //     Homeowners to Mavericks Household" instead of a generic
  //     "Create RFQ" prompt.
  handleAddAnotherLoc() {
    // Rule: one open flow per LOC on an account. Hand the intake
    // modal every LOC already represented on this bundle (siblings
    // + self) so the picker can hide them - filtering only the
    // source LOC left room for a duplicate Homeowners / Auto tab.
    const ownLoc =
      this.context?.loc || this.context?.locLabel || 'Personal Auto';
    const occupiedLocLabels = Array.from(
      new Set(
        [
          ...(Array.isArray(this.sessionTabs)
            ? this.sessionTabs.map((s) => s.locLabel)
            : []),
          ownLoc
        ].filter(Boolean)
      )
    );
    this.dispatchEvent(
      new CustomEvent('startrfqintake', {
        detail: {
          context: {
            launchedFromAccount: true,
            accountId: this.context?.accountId || null,
            accountName: this.accountName,
            recordOwner: this.context?.recordOwner || null,
            // Prefills - carry the current session's LOB + policy
            // term into the intake modal so the broker doesn't
            // re-enter what they just picked.
            lob: this.context?.lob || null,
            effectiveFrom: this.effectiveFrom || '',
            effectiveTo: this.effectiveTo || '',
            // Hybrid-path metadata.
            isAddingLoc: true,
            sourceRfqId: this.context?.rfqId || null,
            sourceLocLabel: ownLoc,
            occupiedLocLabels
          }
        },
        bubbles: true,
        composed: true
      })
    );
  }

  handleProceedToBoard() {
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: {
          route: 'account-record-page',
          context: {
            accountId: this.context?.accountId || null,
            activeTab: 'submission-board'
          }
        },
        bubbles: true,
        composed: true
      })
    );
  }

  // ── In-workspace LOC session strip ──────────────────────────────
  // The account record page hands us the full list of sibling RFQ
  // tabs on the same account bundle (via @api sessionTabs). We only
  // surface the strip once the bundle actually has 2+ LOCs so
  // single-LOC workspaces stay uncluttered.
  get showSessionStrip() {
    return Array.isArray(this.sessionTabs) && this.sessionTabs.length > 1;
  }

  // Precompute the class + a11y payload for the template so the
  // markup stays declarative and doesn't have to build class strings
  // inline. Each pill carries its 1-based position (rendered inside
  // the number badge) and the state class its tint comes from.
  get sessionTabDisplay() {
    if (!Array.isArray(this.sessionTabs)) return [];
    return this.sessionTabs.map((s, i) => {
      // `slds-pill` opts each LOC into the SLDS 2 pill blueprint
      // (Salesforce Lightning Design System · Pills). The `p15-sess`
      // hook layers our LOC-specific chrome (num badge + two-line
      // body + remove) on top so screen readers, tooling, and any
      // real SLDS 2 CSS baseline still recognise these as pills.
      let className = 'slds-pill p15-sess';
      if (s.isActive) className += ' slds-is-selected is-active';
      // Status is its own channel, independent of selection. `is-done`
      // stays the Ready hook the existing CSS keys off; the other two
      // states carry their own modifier so each can take its SLDS 2
      // feedback colour on the badge and the subtitle.
      const statusLabel = s.status || (s.isDone ? 'Ready' : 'Not started');
      const isReady = statusLabel === 'Ready';
      if (isReady) className += ' is-done';
      else if (statusLabel === 'In progress') className += ' is-inprogress';
      else className += ' is-notstarted';
      return {
        id: s.id,
        locLabel: s.locLabel,
        isActive: !!s.isActive,
        isDone: isReady,
        ariaSelected: s.isActive ? 'true' : 'false',
        // WAI-ARIA tab wiring: the pill <li> needs a stable DOM id so
        // aria-labelledby on the workspace panel can name it back. We
        // also expose aria-controls pointing at the single visible
        // workspace panel id (there's exactly one <main> per
        // c-rfq-workspace instance, so all pills point at the same id).
        tabDomId: `p15-sess-tab-${s.id}`,
        panelDomId: this._workspacePanelDomId,
        // Every sibling LOC pill carries a × delete affordance. The
        // flag is defensive: the "Add LOC" pill (if / when one is
        // reintroduced) would ship with showClose:false so brokers
        // can't fire a delete on it.
        showClose: true,
        className
      };
    });
  }

  // Stable panel DOM id for the workspace <main>. Keyed off the active
  // session so aria-labelledby stays in sync when the broker swaps
  // LOCs (each session gets its own tab pill; the panel just re-uses
  // whichever pill is currently `is-active`).
  get _workspacePanelDomId() {
    return `p15-panel-${this.activeSessionId || 'root'}`;
  }
  get workspacePanelId() {
    return this._workspacePanelDomId;
  }
  // Only expose the tabpanel role + labelling when the session strip
  // is actually rendered - a tabpanel without a corresponding tab in
  // the DOM would be an invalid ARIA pairing. LWC drops attrs bound
  // to undefined, so single-LOC accounts render <main> with no
  // role/aria-labelledby (its own <h1>/<h2> still name the content).
  get workspacePanelRole() {
    return this.showSessionStrip ? 'tabpanel' : undefined;
  }
  get workspacePanelLabelledBy() {
    return this.showSessionStrip && this.activeSessionId
      ? `p15-sess-tab-${this.activeSessionId}`
      : undefined;
  }

  // Broker clicked a sibling LOC pill. Fire `switchsession` with the
  // tab id and let the account record page flip the active SF tab
  // (same code path as clicking the tab in the top strip). No local
  // state to mutate here - our own visibility flips via
  // `.sf-shell-body_hidden` on the panel wrapper.
  handleSessionClick(event) {
    const id = event?.currentTarget?.dataset?.id;
    if (!id) return;
    this.dispatchEvent(
      new CustomEvent('switchsession', {
        detail: { tabId: id },
        bubbles: true,
        composed: true
      })
    );
  }

  // ── Delete-LOC (× on a session pill) ──────────────────────────
  // stopPropagation is critical: the × button lives inside the pill
  // <li>, whose own onclick fires handleSessionClick (which would
  // swap to the LOC we're about to delete). Both stopPropagation
  // and preventDefault run before we touch state so the pill click
  // never resolves.
  //
  // The warning banner is only accurate when the deleted pill is
  // the currently active LOC (we only own our own vehicleRows /
  // driverRows locally - sibling data is not shipped across
  // workspace instances). For sibling pills we fall back to a
  // generic "may contain saved data" copy.
  handleDeleteLocClick(event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const id = event?.currentTarget?.dataset?.id;
    if (!id) return;
    const tab = (this.sessionTabs || []).find((t) => t.id === id);
    if (!tab) return;
    const activeId = (this.sessionTabs || []).find((t) => t.isActive)?.id;
    const isActive = id === activeId;
    let warningText = null;
    if (isActive) {
      const summary = this._computeDeleteContentSummary();
      if (summary) {
        warningText =
          `You've already added ${summary} to this line of coverage. Deleting it will remove that data from this RFQ.`;
      }
    } else {
      warningText =
        'This line of coverage may contain saved data that will be removed.';
    }
    this._deleteLocSession = {
      id,
      locLabel: tab.locLabel || 'this LOC',
      warningText
    };
    this._deleteLocOpen = true;
  }

  handleDeleteLocCancel() {
    this._deleteLocOpen = false;
    this._deleteLocSession = null;
  }

  handleDeleteLocConfirm() {
    const target = this._deleteLocSession;
    if (target?.id) {
      this.dispatchEvent(
        new CustomEvent('tabclose', {
          detail: { tabId: target.id },
          bubbles: true,
          composed: true
        })
      );
    }
    this._deleteLocOpen = false;
    this._deleteLocSession = null;
  }

  stopDeleteLocPropagation(event) {
    event.stopPropagation();
  }

  // Modal header text mirrors the SLDS destructive-confirm pattern:
  // Delete "<LOC name>"? - names the target so the broker can
  // double-check before committing.
  get _deleteLocHeading() {
    const label = this._deleteLocSession?.locLabel || '';
    return `Delete "${label}"?`;
  }

  get _deleteLocWarningText() {
    return this._deleteLocSession?.warningText || '';
  }

  // Content-summary "gist" for the delete-LOC warning banner. Reads
  // the same tracked arrays the review card / progress-path use to
  // know if the RFQ has captured data. Dimensions with a zero count
  // are omitted so the banner never enumerates empty state; if all
  // dimensions are zero we return '' and the caller skips the
  // banner entirely.
  _computeDeleteContentSummary() {
    const v = (this.vehicleRows || []).length;
    const d = (this.driverRows || []).length;
    const parts = [];
    if (v > 0) parts.push(`${v} vehicle${v === 1 ? '' : 's'}`);
    if (d > 0) parts.push(`${d} driver${d === 1 ? '' : 's'}`);
    if (!parts.length) return '';
    return parts.join(' and ');
  }

  // "Line of Coverage" label for the interstitial meta block. Prefers
  // the launch context's LOC (e.g. "Personal Auto"), falls back to
  // the RFQ's LOB, then a hard-coded PA label as a last resort.
  get interstitialLocLabel() {
    return (
      this.context?.loc ||
      this.context?.lob ||
      'Personal Auto'
    );
  }

  // Effective range for the interstitial meta block. Both dates come
  // from the intake modal; render "-" when either is missing so the
  // row doesn't read as an implied blank.
  get interstitialEffectiveLabel() {
    if (!this.effectiveFrom || !this.effectiveTo) return '-';
    return `${this.effectiveFrom} - ${this.effectiveTo}`;
  }

  handleReturnToDashboard() {
    const returnRoute = this.launchedFromAccount
      ? 'account-record-page'
      : 'run-my-day';
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: { route: returnRoute },
        bubbles: true,
        composed: true
      })
    );
  }

  // Progress-path navigation - re-open a previously completed step. Steps
  // after the target revert to incomplete so the user re-confirms forward;
  // all captured data (rows, assignments, coverages) is preserved.
  handleStepSelect(event) {
    this.goToStep(event.detail?.stepId);
  }

  // Contextual prompt hand-off from any inline c-agentforce-inline-chat
  // bubbling up. Opens the docked side panel pre-seeded with the user's
  // message + the originating record's context.
  handleLaunchAgentforce(event) {
    const panel = this.refs && this.refs.agentforcePanel;
    if (panel && typeof panel.startContextualChat === 'function') {
      panel.startContextualChat(event.detail || {});
    }
  }

  // Re-open `target` step: mark earlier steps complete and everything from
  // `target` onward incomplete so only that one step renders. Captured
  // data (rows, assignments, coverages) is preserved.
  goToStep(target) {
    const idx = STEP_ORDER.indexOf(target);
    if (idx < 0) return;
    const next = {};
    STEP_ORDER.forEach((id, i) => {
      next[id] = i < idx;
    });
    this.completed = next;
    if (this.view !== 'wizard') this.view = 'wizard';
    requestAnimationFrame(() => {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  handleBreadcrumbClick(event) {
    event.preventDefault();
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: { route: 'account-record-page' },
        bubbles: true,
        composed: true
      })
    );
  }

  // "Save as Draft" - the split-out first half of the old "Save Draft
  // & Close" action. In this mock-driven prototype there is no real
  // persistence layer, so we just surface a toast confirming that the
  // draft is saved and leave the broker on the current step.
  // Saving a draft is a quiet action - no toast. Toasts are reserved
  // for submission, routing to carriers, and sending the proposal
  // email.
  handleSaveAsDraft() {}

  // "Close" - the split-out second half. Bounces the broker back to
  // where they came from (Account Record Page or Run My Day) without
  // implying that the draft was persisted, since "Save as Draft" is
  // now a separate CTA.
  handleClose() {
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: { route: this.launchedFromAccount ? 'account-record-page' : 'run-my-day' },
        bubbles: true,
        composed: true
      })
    );
  }
}
