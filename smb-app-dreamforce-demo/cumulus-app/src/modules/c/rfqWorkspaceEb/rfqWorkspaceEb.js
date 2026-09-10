import { LightningElement, api, track } from 'lwc';
import { acmeRfqData, MOCK_ACCOUNTS, quotes } from 'data/mockData';
import { formatUsDateOrDash, nextTermFromPriorEnd } from 'data/dates';
import {
  ROOT_PRODUCTS as EB_ROOT_PRODUCTS,
  getCoverages as catGetCoverages,
  getBenefitCategories as catGetBenefitCategories,
  findCoverageAttribute as catFindCoverageAttribute,
  findBenefitAttribute as catFindBenefitAttribute,
  listAllAttributes as catListAllAttributes,
  setIncluded as catSetIncluded
} from 'data/ebCatalog';

function fmtDate(iso) {
  return formatUsDateOrDash(iso);
}

// Intake moved out of the wizard into c-rfq-intake-modal. The EB Guided
// RFQ wizard is now a 4-step progression that mirrors the decoupled
// admin canvas (c-rfq-playbook-setup) - Plan Coverages (IPC macro-level
// financial caps) and Plan Benefits & Copays (IPCB clinical encounter
// cost shares) are separate milestones with distinct field scopes.
const STEP_ORDER = ['census', 'coverages', 'benefits', 'review'];
// Card titles per step - used for the "Back to {previous}" affordance so
// the EB wizard renders one step at a time, exactly like the PA flow.
const STEP_TITLES = {
  census: 'Enrollment Headcount',
  coverages: 'Core Plan Coverages',
  benefits: 'Benefits',
  review: 'Review & Publish'
};
const VALID_VIEWS = ['wizard', 'submitted'];
const MODE_STRAIGHT = 'straight_through';

// Step labels passed down to c-progress-path so the sidebar reads as a
// 4-step chronological wizard that matches the EB Health template setup
// stages 1:1 (Enrollment Headcount · Core Plan Coverages · Benefits &
// Copays · Review & Publish).
const EB_STEP_DEFS = [
  { id: 'census',    label: 'Enrollment Headcount', meta: 'Headcount tiers or CSV' },
  { id: 'coverages', label: 'Core Plan Coverages',  meta: 'Deductibles & OOP caps' },
  { id: 'benefits',  label: 'Benefits',             meta: 'Office, virtual, Rx tiers' },
  { id: 'review',    label: 'Review & Publish',     meta: 'To markets' }
];

// Manual Enrollment Headcount - the 4 standard rating tiers. The broker
// types FTE counts directly.
const HEADCOUNT_TIERS = [
  { id: 'ee', key: 'employeeOnly',     label: 'Employee' },
  { id: 'es', key: 'employeeSpouse',   label: 'Employee + Spouse' },
  { id: 'ef', key: 'employeeFamily',   label: 'Employee + Family' },
  { id: 'ec', key: 'employeeChildren', label: 'Employee + Children' }
];

// ── Inline Rate Plan configuration ───────────────────────────────
// Rate plan creation/editing happens inline in the Enrollment
// Headcount step (the old c-eb-new-rate-plan-modal popup is retired).
// These option lists feed the inline form's c-picklist dropdowns.
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
// US states - abbreviation is the stored value (matches the account's
// "City, ST" parse) and the full name is the display label.
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
// Eligible tier ids map 1:1 to HEADCOUNT_TIERS keys so a saved plan's
// tier scope drives which FTE rows surface in the headcount table.
const DEFAULT_RATE_PLAN_FORM = {
  type: '',
  geoState: '',
  frequency: '',
  currency: 'USD',
  eligibleTiers: []
};

// Target-market carriers for the Review step - health/benefits carriers.
// Incumbent (BlueCross) first; the default target set is the top three.
const MARKETS = [
  { id: 'm1', name: 'BlueCross BlueShield', metadata: 'Incumbent · renews on time', accent: '#066afe' },
  { id: 'm2', name: 'UnitedHealthcare',     metadata: 'Largest national network',   accent: '#1a4d8c' },
  { id: 'm3', name: 'Cigna',                metadata: 'Strong PPO + dental bundles', accent: '#c23934' },
  { id: 'm4', name: 'Aetna',                metadata: 'Competitive HMO pricing',     accent: '#7526e3' },
  { id: 'm5', name: 'Kaiser Permanente',    metadata: 'Integrated care · West',      accent: '#06a59a' },
  { id: 'm6', name: 'Humana',               metadata: 'Best for wellness programs',  accent: '#2e844a' },
  { id: 'm7', name: 'Anthem',               metadata: 'Fast group quotes',           accent: '#b8860b' },
  { id: 'm8', name: 'MetLife',              metadata: 'Ancillary + life specialist', accent: '#b54708' }
];

// ── Step 2/3 product hierarchy lives in data/ebCatalog (single source
// of truth shared with the Setup widgets). Per-attribute rendering and
// state collection lives in c-eb-core-coverages (Step 2) and
// c-eb-benefits-copays (Step 3); this file owns the centralized
// policyConfiguration JSON those children read + emit changes against.

// Product hierarchy moved to data/ebCatalog (single source of truth for
// both the design-time Setup widgets and this runtime wizard). The
// catalog separates Coverages (mapped to InsurancePolicyCoverage -
// macro-financial fences like deductibles + OOP) from Benefits (mapped
// to InsurancePolicyCoverageBenefit - per-encounter copays, Rx tiers,
// hardware allowances). Each attribute carries a `dataType` enum the
// child components branch on to render the right input control.
// Catalog-driven coverage / benefit shape:
//   ebCatalog.getCoverages(rootId)         -> InsurancePolicyCoverage attrs
//   ebCatalog.getBenefitCategories(rootId) -> InsurancePolicyCoverageBenefit
//                                             grouped by Benefit Category
// Each attribute carries `id`, `label`, `dataType`, `includedInRfq`, and
// for picklists, `options`.

// Maps the intake-modal Line of Coverage to the root product id that
// should render in Step 2/3. Each EB LOC reveals exactly one root.
// An unknown LOC falls back to medical (see inScopeRootIds below).
const LOC_TO_SEGMENTS = {
  'Group Medical': ['medical'],
  'Group Dental': ['dental'],
  'Group Vision': ['vision']
};

// Build the initial centralized policyConfiguration state. Keys mirror
// the standard FSC objects so downstream consumers (the submit payload,
// downstream integrations) can map straight through:
//   - InsurancePolicyCoverage         IPC macro-financial fences
//   - InsurancePolicyCoverageBenefit  IPCB per-encounter pricing
// Each entry carries the attribute's catalog metadata (rootId,
// categoryId, label, dataType) plus the runtime value fields the
// dataType-driven inputs write to.
function makeInitialConfig() {
  const cfg = {
    InsurancePolicyCoverage: {},
    InsurancePolicyCoverageBenefit: {}
  };
  for (const a of catListAllAttributes()) {
    const slot = {
      rootId: a.rootId,
      categoryId: a.categoryId || null,
      attrId: a.id,
      label: a.label,
      dataType: a.dataType,
      value: '',
      min: '',
      max: ''
    };
    if (a.scope === 'coverage') {
      cfg.InsurancePolicyCoverage[a.id] = slot;
    } else {
      cfg.InsurancePolicyCoverageBenefit[a.id] = slot;
    }
  }
  return cfg;
}

const PA_STORE_KEY = 'eb-acme-rfq-workspace';

function readInitialView() {
  if (typeof window === 'undefined') return 'wizard';
  const param = new URLSearchParams(window.location.search).get('view');
  if (param && VALID_VIEWS.includes(param)) return param;
  return 'wizard';
}

function readInitialCompleted() {
  // Seed every known step to false so the wizard always renders Step 1
  // first by default. Derived from STEP_ORDER so the shape stays in
  // lockstep with the constant.
  const base = STEP_ORDER.reduce((acc, id) => {
    acc[id] = false;
    return acc;
  }, {});
  if (typeof window === 'undefined') return base;
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  let step = params.get('step');
  if (view === 'submitted') {
    STEP_ORDER.forEach((id) => (base[id] = true));
    return base;
  }
  if (!step) return base;
  // Legacy URL alias - the wizard's combined Step 2 used to be `rules`;
  // map it onto the new Core Plan Coverages step so old bookmarks still
  // land somewhere sensible after the split.
  if (step === 'rules') step = 'coverages';
  const target = STEP_ORDER.indexOf(step);
  if (target <= 0) return base;
  STEP_ORDER.slice(0, target).forEach((id) => (base[id] = true));
  return base;
}

export default class RfqWorkspaceEb extends LightningElement {
  // `context` is fed in by the app shell when the wizard mounts inside a
  // workspace tab. Wired as a getter+setter (instead of a plain @api) so
  // we can apply the intake-modal's prior-policy prefills synchronously
  // the moment the prop arrives - avoids any connectedCallback timing
  // race when the parent reuses the same component instance.
  @api
  get context() {
    return this._context;
  }
  set context(value) {
    this._context = value;
    this._applyPriorPolicyPrefills();
  }

  _context = undefined;
  _prefillApplied = false;

  // ── Hybrid v2: LOC session strip inputs ─────────────────────────
  // `sessionTabs` is fed in by the account record page - a compact
  // roster of every RFQ tab on the same account bundle (see
  // accountRecordPage._sessionSiblingsFor). Powers the pill strip
  // that sits above the workspace layout when 2+ LOCs are open.
  @api sessionTabs = [];

  // Bundle Review: siblings' review-snapshot payloads (excluding
  // self). See accountRecordPage._siblingReviewPayloadsFor for the
  // per-account roster. Consumed by the bundle-review tab bar on
  // the Review step so brokers can inline-preview each LOC's
  // review card without leaving the current SF workspace tab.
  @api siblingReviewPayloads = [];

  // Which review tab is currently active. null / 'self' = the
  // broker is looking at their own LOC (renders the local
  // accordions); any other id = a sibling from siblingReviewPayloads
  // (renders c-loc-review-panel below).
  @track activeReviewTabId = null;

  // Hash-guard for _publishReviewSnapshot so we don't spam the
  // account page with identical events on every render. Reset only
  // when the serialized snapshot changes.
  _lastReviewSnapshotHash = null;

  // Expose step defs so the workspace's <c-progress-path> binding can
  // read them without an extra import.
  ebStepDefs = EB_STEP_DEFS;

  @track view = readInitialView();
  @track completed = readInitialCompleted();

  // ── Review step: progressive-disclosure accordions ─────────────
  // Mirrors PA/Home's reviewSections model. Every section starts
  // open so a returning broker can scan the whole payload without
  // hunting; toggling collapses / reopens via handleReviewSectionToggle.
  @track reviewSections = {
    policyDetails: true,
    headcount: true,
    ratePlans: true,
    coverages: true,
    benefits: true
  };

  // Step 1 - manual Enrollment Headcount entry
  @track headcount = {
    employeeOnly: '',
    employeeSpouse: '',
    employeeFamily: '',
    employeeChildren: ''
  };

  // Steps 2 & 3 - centralized policy configuration. Two top-level
  // buckets keyed by attribute id, shaped to project straight into the
  // standard FSC objects InsurancePolicyCoverage (Step 2 Core Plan
  // Coverages) and InsurancePolicyCoverageBenefit (Step 3 Benefits &
  // Copays). Inputs in c-eb-core-coverages + c-eb-benefits-copays emit
  // a single `configchange` event that this component routes into the
  // correct bucket via handleConfigChange.
  @track policyConfiguration = makeInitialConfig();

  // Step 3 - ordered target-market selection (default = top three)
  @track selectedMarketIds = ['m1', 'm2', 'm3'];

  // Step 4 - routing strategy
  @track routingStrategy = '';

  // Step 4 - requested coverage term (effective dates), seeded from the
  // RFQ's default policy window. Mirrors the Setup "Effective Start/End"
  // fields so the broker confirms the term before submitting to markets.
  @track effectiveFrom = acmeRfqData.effectiveDate || '';
  @track effectiveTo = acmeRfqData.expirationDate || '';

  // Review → Policy Details inline edit state. Only one date field can
  // be in edit mode at a time (mirrors PA / SLDS record-detail inline
  // edit). Set to 'effectiveFrom' or 'effectiveTo' when the broker
  // clicks the matching pencil; blur/Enter clears it back to null.
  @track _editingDateField = null;

  // Step 3 (Review) - "See Base Policy" modal open state. Mirrors the
  // PA workspace pattern; only rendered when this RFQ was cloned from
  // a prior policy (hasPriorPolicy below).
  @track basePolicyModalOpen = false;

  // ── Delete-LOC confirmation modal ─────────────────────────────
  // Opened by the × affordance on any pill in the session strip.
  // `_deleteLocSession` carries the target pill's { id, locLabel,
  // warningText } while the modal is open; Confirm dispatches
  // `tabclose` (c-app listens for this and drops the tab), Cancel
  // just resets the state.
  @track _deleteLocOpen = false;
  @track _deleteLocSession = null;

  // Step 1 - Inline Rate Plan management. Replaces the old popup modal:
  // brokers create / edit rate plans directly in a "Rate Plan
  // Configuration" panel inside the Enrollment Headcount step.
  @track savedRatePlans = [];
  @track isRatePlanFormOpen = false;
  @track ratePlanForm = { ...DEFAULT_RATE_PLAN_FORM };
  // When set, the modal renders in edit mode and Save updates this
  // entry in place instead of appending a new one.
  @track editingRatePlanId = null;
  _ratePlanSeq = 0;
  // Tier Structure multi-select popover - open state + fixed-position
  // style so the menu escapes the card's overflow (mirrors c-picklist).
  @track _rpTierMenuOpen = false;
  @track _rpTierMenuStyle = '';
  // Tier ids (matching HEADCOUNT_TIERS keys) scoped across all saved
  // plans. The Enrollment Headcount table stays hidden until at least
  // one rate plan exists, then shows a row per scoped tier for FTE entry.
  @track enrollmentTierIds = [];

  // ── 2-step rate-plan modal state ─────────────────────────────────
  // Modal step (1 = Rate Plan Config, 2 = Enrollment Headcount).
  @track _ratePlanModalStep = 1;
  // Working draft of per-tier FTE values, scoped to the modal's Step 2.
  // Seeded from this.headcount on open; committed back on save so the
  // broker captures the rate plan + its FTEs in one flow.
  @track ratePlanFormHeadcount = {
    employeeOnly: '',
    employeeSpouse: '',
    employeeFamily: '',
    employeeChildren: ''
  };
  // Single-open accordion: id of the rate-plan card whose inline
  // preview is expanded, or '' when none is open. Opening a second
  // card auto-collapses the first (app-wide accordion rule).
  @track _expandedRatePlanId = '';

  applicationId = acmeRfqData.id;

  connectedCallback() {
    // Belt-and-braces: if context arrived before connect, the setter
    // already ran the prefill. If it didn't (context bound after
    // connect), apply now.
    this._applyPriorPolicyPrefills();

    // Renewal path is chosen in the Intake modal and forwarded via context.
    // Straight-Through accepts the BlueCross +12% indication and skips the
    // wizard: mark all steps complete, fire risksubmitted, show submitted.
    if (this.context?.renewalMode === MODE_STRAIGHT) {
      this.completed = STEP_ORDER.reduce((acc, id) => {
        acc[id] = true;
        return acc;
      }, {});
      this.view = 'submitted';
      Promise.resolve().then(() => {
        this.dispatchEvent(
          new CustomEvent('risksubmitted', {
            detail: {
              accountName: this.accountName,
              applicationName: this.appName,
              message:
                'Straight-through renewal initiated with BlueCross at the +12% indication. Click Compare Quotes in Slack to confirm the incumbent terms and bind.'
            },
            bubbles: true,
            composed: true
          })
        );
      });
    }
  }

  // Idempotent prefill from the intake-modal's prior-policy payload -
  // seeds Step 1 (headcount) and Step 2 (benefits) from the incumbent
  // record when the broker picked one in the modal. Inputs stay
  // editable. Guarded by `_prefillApplied` so it only runs once per
  // workspace instance even if the setter fires multiple times.
  _applyPriorPolicyPrefills() {
    if (this._prefillApplied) return;
    const ctx = this._context;
    if (!ctx) return;
    this._prefillApplied = true;

    // DEBUG - temporary trace to verify the prior-policy payload is
    // reaching this component. Remove once confirmed.
    // eslint-disable-next-line no-console
    console.log('[c-rfq-workspace-eb] applying prior-policy prefill, context =', JSON.parse(JSON.stringify(ctx)));

    // Step 1 - Enrollment Headcount.
    const priorHc = ctx.priorHeadcount;
    if (priorHc && typeof priorHc === 'object') {
      this.headcount = {
        employeeOnly:
          priorHc.employeeOnly != null ? String(priorHc.employeeOnly) : '',
        employeeSpouse:
          priorHc.employeeSpouse != null ? String(priorHc.employeeSpouse) : '',
        employeeFamily:
          priorHc.employeeFamily != null ? String(priorHc.employeeFamily) : '',
        employeeChildren:
          priorHc.employeeChildren != null
            ? String(priorHc.employeeChildren)
            : ''
      };
      // Auto-reveal the FTE table by seeding the tier ids from any
      // tier the prior policy carried a non-zero value for. Without
      // this the broker would see the empty-state hint + a disabled
      // "New Rate Plan" button (the toolbar locks when prior data
      // drives the wizard - see isPriorPolicyClone), which would
      // strand them with no way to render the headcount table.
      const seededTiers = HEADCOUNT_TIERS
        .filter((t) => {
          const v = this.headcount[t.key];
          if (v == null || v === '') return false;
          const n = Number(v);
          return !Number.isNaN(n) && n > 0;
        })
        .map((t) => t.key);
      if (seededTiers.length) {
        this.enrollmentTierIds = seededTiers;
        // Auto-seed a starter rate plan card mirroring the prior
        // policy so the broker lands on Step 1 with an IRP-1001
        // already present (editable via the pencil). Without this
        // the clone path would prefill FTEs but leave the rate-plan
        // toolbar empty, forcing the broker to recreate the plan
        // from scratch.
        this._seedRatePlanFromPrior(seededTiers);
      }
    }

    // Steps 2/3 - seed centralized policyConfiguration from the prior
    // policy's structured benefits map. Only seeds attributes inside
    // the LOC scope so a Dental-only RFQ doesn't carry Medical/Vision
    // rows in the payload. The catalog's findCoverageAttribute /
    // findBenefitAttribute route each prior id to the correct bucket.
    //
    // Each seeded attribute is also flagged includedInRfq on the
    // catalog (catSetIncluded) - the runtime + Setup canvas only
    // surface rows where that flag is true, so without it the
    // prefilled values would never render. This mirrors what the
    // broker would have done manually in the Setup canvas before
    // jumping into the wizard.
    const inScopeRoots = this.inScopeRootIds;
    const priorBenefits = ctx.priorBenefits;
    if (priorBenefits && typeof priorBenefits === 'object') {
      const nextCfg = {
        InsurancePolicyCoverage: { ...this.policyConfiguration.InsurancePolicyCoverage },
        InsurancePolicyCoverageBenefit: { ...this.policyConfiguration.InsurancePolicyCoverageBenefit }
      };
      Object.keys(priorBenefits).forEach((id) => {
        const src = priorBenefits[id] || {};
        // Only auto-include rows that actually carry a value (min,
        // max, or value). A row that the prior policy left empty
        // shouldn't surface as "in scope" by accident.
        const hasValue =
          (src.min != null && src.min !== '') ||
          (src.max != null && src.max !== '') ||
          (src.value != null && src.value !== '');
        const cov = catFindCoverageAttribute(id);
        if (cov && inScopeRoots.includes(cov.rootId)) {
          const prev = nextCfg.InsurancePolicyCoverage[id];
          if (prev) {
            nextCfg.InsurancePolicyCoverage[id] = {
              ...prev,
              min: src.min != null ? String(src.min) : '',
              max: src.max != null ? String(src.max) : '',
              value: src.value != null ? String(src.value) : ''
            };
            if (hasValue) catSetIncluded('coverage', id, true);
          }
          return;
        }
        const ben = catFindBenefitAttribute(id);
        if (ben && inScopeRoots.includes(ben.rootId)) {
          const prev = nextCfg.InsurancePolicyCoverageBenefit[id];
          if (prev) {
            nextCfg.InsurancePolicyCoverageBenefit[id] = {
              ...prev,
              min: src.min != null ? String(src.min) : '',
              max: src.max != null ? String(src.max) : '',
              value: src.value != null ? String(src.value) : ''
            };
            if (hasValue) catSetIncluded('benefit', id, true);
          }
        }
      });
      this.policyConfiguration = nextCfg;
    }

    // Step 4 - Effective From/To. Intake dates win; otherwise the
    // new term starts the day after the prior policy's Effective To
    // (n+1) and runs one year. Leaves acmeRfqData defaults intact
    // when the prior policy didn't carry dates.
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
  }

  // Auto-create a starter rate plan card (IRP-1001) from the prior
  // policy when the clone path runs. Mirrors what `handleRatePlanSave`
  // would produce if the broker opened the modal manually + saved
  // with sensible defaults. The broker can edit (pencil) or preview
  // (chevron) the seeded card just like a manually-created one.
  _seedRatePlanFromPrior(eligibleTiers) {
    // Idempotency: a re-fire of _applyPriorPolicyPrefills shouldn't
    // duplicate cards. The outer _prefillApplied guard already
    // protects this, but a second sanity check here costs nothing.
    if (this.savedRatePlans.length > 0) return;
    this._ratePlanSeq += 1;
    this.savedRatePlans = [
      ...this.savedRatePlans,
      {
        id: `irp-${this._ratePlanSeq}`,
        name: `IRP-${String(1000 + this._ratePlanSeq)}`,
        type: 'Fully Insured Health',
        frequency: 'Annual',
        geoState: this.ratePlanGeoState || '',
        currency: this.ratePlanCurrency || 'USD',
        eligibleTiers: eligibleTiers.slice()
      }
    ];
  }

  // ── View flags ──────────────────────────────────────────────────
  get isWizard() {
    return this.view === 'wizard';
  }
  get isSubmitted() {
    return this.view === 'submitted';
  }

  // ── Step flags ──────────────────────────────────────────────────
  // 4-step EB flow: census → coverages → benefits → review. Each gate
  // checks all earlier steps have been completed and the wizard isn't
  // showing the post-submit view.
  get isOnCensusStep() {
    return !this.completed.census && this.isWizard;
  }
  get isOnCoveragesStep() {
    return (
      this.completed.census &&
      !this.completed.coverages &&
      this.isWizard
    );
  }
  get isOnBenefitsStep() {
    return (
      this.completed.census &&
      this.completed.coverages &&
      !this.completed.benefits &&
      this.isWizard
    );
  }
  // Terminal step - stays rendered after `_saveRfqToBundle` marks
  // every step complete (view stays 'wizard'), so a saved LOC tab
  // still paints its Review card instead of an empty workspace body.
  // Same gate as c-rfq-workspace.
  get isOnReviewStep() {
    return (
      this.completed.census &&
      this.completed.coverages &&
      this.completed.benefits &&
      this.isWizard
    );
  }

  get censusSectionClass() {
    return this.isOnCensusStep ? 'block is-current' : 'block';
  }
  get coveragesSectionClass() {
    return this.isOnCoveragesStep ? 'block is-current' : 'block';
  }
  get benefitsSectionClass() {
    return this.isOnBenefitsStep ? 'block is-current' : 'block';
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
    return (
      this.completed.census &&
      this.completed.coverages &&
      this.completed.benefits
    );
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

  // ── Account / context derivation ────────────────────────────────
  get appName() {
    return this.context?.applicationName || acmeRfqData.applicationName;
  }

  get account() {
    const id = this.context?.accountId || acmeRfqData.accountId;
    return MOCK_ACCOUNTS.find((a) => a.id === id) || acmeRfqData.account;
  }

  get accountName() {
    return this.context?.accountName || this.account?.name || acmeRfqData.account?.name;
  }

  // Global kill-switch for the Agentforce Summary card on the Review
  // step. False hides it across all flows; markup + styles stay so
  // we can flip back later.
  get showAgentforceSummary() {
    return false;
  }

  // LOC chosen in the Intake modal - surfaced in the Step 3 banner so
  // the Agentforce summary names the product line ("Group Dental"
  // renewal vs. "Group Medical" renewal).
  get locLabel() {
    return this.context?.loc || 'Group Medical';
  }

  // ── Quote Details (Review step) ─────────────────────────────────
  // Always-visible read-only summary card that replaces the standalone
  // Prior Policy Details + editable Coverage Period blocks (which the
  // broker had no reason to edit on Step 3 - they're captured in the
  // intake modal). Pulls Policy Start/End from the effective tracks,
  // LOC from the launch context, Prior Policy from the cloned-from
  // intake label. The Rate Plans subsection is a flattened per-tier
  // rollup of `ratePlanStatusItems` so each plan reads as a grouped
  // header row + N tier rows.
  get hasPriorPolicy() {
    return this.isPriorPolicyClone || !!this.context?.priorPolicy;
  }
  get quoteDetailsHighlights() {
    const ctx = this.context || {};
    const priorLabel = ctx.priorPolicy || acmeRfqData.priorPolicyLabel || '';
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
        value: this.locLabel,
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

  // Inline pencil-edit for Policy Start / Policy End on Review.
  handleEditPolicyDate(event) {
    const field = event?.currentTarget?.dataset?.field;
    if (field !== 'effectiveFrom' && field !== 'effectiveTo') return;
    this._editingDateField = field;
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

  handlePolicyDateBlur() {
    this._editingDateField = null;
  }

  handlePolicyDateKeydown(event) {
    const key = event?.key || event?.detail?.key;
    if (key === 'Enter' || key === 'Escape') {
      event.preventDefault();
      this._editingDateField = null;
    }
  }

  // Section pencils on Review → jump back to the step that authored
  // that content (census owns headcount + rate plans).
  handleEditHeadcount(event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.goToStep('census');
  }

  handleEditRatePlans(event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.goToStep('census');
  }

  handleEditCoverages(event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.goToStep('coverages');
  }

  handleEditBenefits(event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.goToStep('benefits');
  }

  // Flatten ratePlanStatusItems into per-tier rows. The first row of
  // each plan carries the Plan Type + Frequency in the dedicated
  // columns; subsequent rows leave those columns blank so the table
  // reads as a grouped list (one plan per group, N tier rows under it).
  get quoteDetailsRatePlans() {
    const out = [];
    for (const plan of this.ratePlanStatusItems || []) {
      // ratePlanStatusItems doesn't carry the raw plan.type/frequency
      // directly; resolve them off the underlying savedRatePlans entry.
      const raw = (this.savedRatePlans || []).find((p) => p.id === plan.id);
      const planType = raw?.type || '-';
      const frequency = raw?.frequency || '-';
      const tiers = plan.tierRows || [];
      if (!tiers.length) {
        out.push({
          id: `${plan.id}-empty`,
          planType,
          frequency,
          tier: '-',
          count: '-'
        });
        continue;
      }
      tiers.forEach((t, idx) => {
        out.push({
          id: t.id || `${plan.id}-${idx}`,
          planType: idx === 0 ? planType : '',
          frequency: idx === 0 ? frequency : '',
          tier: t.label,
          count: t.value
        });
      });
    }
    return out;
  }
  get hasQuoteDetailsRatePlans() {
    return this.quoteDetailsRatePlans.length > 0;
  }
  _fmtReviewDate(iso) {
    return formatUsDateOrDash(iso);
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

  get effectiveLabel() {
    return fmtDate(acmeRfqData.effectiveDate);
  }

  // ── Inline Rate Plan configuration - contextual prefill ──────────
  // Geo State parsed from the account's "City, ST" string (mock data
  // stores city + state in one field). Falls back to '' when absent.
  get ratePlanGeoState() {
    const city = this.account?.city || '';
    const parts = String(city).split(',');
    if (parts.length < 2) return '';
    return parts[parts.length - 1].trim();
  }
  // Currency default - USD for every account in this prototype.
  get ratePlanCurrency() {
    return 'USD';
  }

  // c-picklist option lists.
  get rpTypeOptions() {
    return RATE_PLAN_TYPE_OPTIONS.map((v) => ({ value: v, label: v }));
  }
  get rpFrequencyOptions() {
    return RATE_PLAN_FREQUENCY_OPTIONS.map((v) => ({ value: v, label: v }));
  }
  get rpGeoStateOptions() {
    return RATE_PLAN_GEO_STATES.map((s) => ({ value: s.value, label: s.label }));
  }
  get rpCurrencyOptions() {
    return RATE_PLAN_CURRENCY_OPTIONS.map((c) => ({
      value: c.value,
      label: c.label
    }));
  }
  // Current field values bound to each c-picklist.
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

  // ── Tier Structure (SLDS 2 multi-select combobox) ────────────────
  get rpTierTriggerLabel() {
    if (!this.ratePlanForm.eligibleTiers.length) return 'Select tiers…';
    return HEADCOUNT_TIERS.filter((t) =>
      this.ratePlanForm.eligibleTiers.includes(t.key)
    )
      .map((t) => t.label)
      .join(', ');
  }
  get rpTierTriggerCls() {
    return this._rpTierMenuOpen
      ? 'eb-rate__multi-trigger is-open'
      : 'eb-rate__multi-trigger';
  }
  get rpTierValueCls() {
    return this.ratePlanForm.eligibleTiers.length
      ? 'eb-rate__multi-value'
      : 'eb-rate__multi-value is-placeholder';
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
    return HEADCOUNT_TIERS.map((t) => {
      const selected = this.ratePlanForm.eligibleTiers.includes(t.key);
      return {
        id: t.key,
        label: t.label,
        selected,
        ariaSelected: selected ? 'true' : 'false',
        cls: selected
          ? 'eb-rate__multi-item is-selected'
          : 'eb-rate__multi-item'
      };
    });
  }
  get hasRpTiers() {
    return this.ratePlanForm.eligibleTiers.length > 0;
  }

  // Save gating - all four picklists + at least one tier.
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

  // ── Modal title / save-label flip on edit ───────────────────────
  get rpModalTitle() {
    return this.editingRatePlanId
      ? 'Edit Rate Plan'
      : 'Rate Plan Configuration';
  }
  get rpSaveLabel() {
    return this.editingRatePlanId ? 'Update Plan' : 'Save Plan';
  }

  // ── Modal stepper (Step 1 = Config, Step 2 = Headcount) ─────────
  get modalIsStep1() {
    return this._ratePlanModalStep === 1;
  }
  get modalIsStep2() {
    return this._ratePlanModalStep === 2;
  }
  // Class for the <li> wrappers of each step in the modal's SLDS 2
  // progress indicator. Just the state qualifier - the parent
  // `.eb-rp-modal__progress` scopes the descendant CSS so the items
  // don't need a base class themselves. Step 1 advances current ->
  // done once the broker moves to Step 2. Step 2 is upcoming until
  // it becomes current.
  get step1ItemClass() {
    return this.modalIsStep1 ? 'is-current' : 'is-done';
  }
  get step2ItemClass() {
    return this.modalIsStep2 ? 'is-current' : '';
  }
  // Editable FTE rows scoped to the modal's working tier selection -
  // mirrors the shape of headcountRows but reads from the in-flight
  // draft so Step 2 stays in sync with whatever the broker toggled in
  // Step 1's Tier Structure picker.
  get ratePlanFormHeadcountRows() {
    return HEADCOUNT_TIERS.filter((t) =>
      this.ratePlanForm.eligibleTiers.includes(t.key)
    ).map((t) => ({
      id: t.id,
      key: t.key,
      label: t.label,
      value: this.ratePlanFormHeadcount[t.key] || ''
    }));
  }
  get ratePlanFormHasHeadcountRows() {
    return this.ratePlanFormHeadcountRows.length > 0;
  }
  get ratePlanFormHeadcountTotal() {
    return HEADCOUNT_TIERS.filter((t) =>
      this.ratePlanForm.eligibleTiers.includes(t.key)
    ).reduce((sum, t) => {
      const n = Number(this.ratePlanFormHeadcount[t.key]);
      return sum + (Number.isNaN(n) ? 0 : n);
    }, 0);
  }

  // ── Rate-plan cards (post-save) ──────────────────────────────────
  // Replaces the old teal "rate plan selected" banner. One SLDS card
  // per saved plan with an Edit pencil + a Preview chevron that
  // inline-expands the card to show the full config + per-tier FTE
  // breakdown for this plan's scope.
  get hasRatePlan() {
    return this.savedRatePlans.length > 0;
  }
  get ratePlanStatusItems() {
    return this.savedRatePlans.map((p) => {
      const tierRows = HEADCOUNT_TIERS.filter((t) =>
        p.eligibleTiers.includes(t.key)
      ).map((t) => ({
        id: `${p.id}-${t.id}`,
        label: t.label,
        value: this.headcount[t.key] || '0'
      }));
      const tierLabel = tierRows.map((r) => r.label).join(', ');
      const metaParts = [p.type, p.frequency, this._geoStateLabel(p.geoState)]
        .filter(Boolean)
        .join(' · ');
      const expanded = this._expandedRatePlanId === p.id;
      const planTotal = tierRows.reduce((sum, r) => {
        const n = Number(r.value);
        return sum + (Number.isNaN(n) ? 0 : n);
      }, 0);
      return {
        id: p.id,
        name: p.name,
        meta: tierLabel ? `${metaParts} - ${tierLabel}` : metaParts,
        expanded,
        toggleLabel: expanded ? 'Hide preview' : 'Preview',
        toggleChevronClass: expanded
          ? 'eb-rp-card__toggle-chev is-open'
          : 'eb-rp-card__toggle-chev',
        cardClass: expanded ? 'eb-rp-card is-expanded' : 'eb-rp-card',
        // Field rows for the inline preview - readable key/value
        // pairs for everything captured in Step 1.
        previewFields: [
          { id: `${p.id}-type`, label: 'Plan Type', value: p.type || '-' },
          { id: `${p.id}-freq`, label: 'Frequency', value: p.frequency || '-' },
          { id: `${p.id}-geo`, label: 'Geo State', value: this._geoStateLabel(p.geoState) || '-' },
          { id: `${p.id}-cur`, label: 'Currency', value: p.currency || '-' }
        ],
        tierRows,
        planTotal
      };
    });
  }
  _geoStateLabel(value) {
    const m = RATE_PLAN_GEO_STATES.find((s) => s.value === value);
    return m ? m.label : value || '';
  }
  handleToggleRatePlanPreview(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    // Single-open: tapping the already-expanded card collapses it,
    // tapping any other card auto-closes the prior one.
    this._expandedRatePlanId = this._expandedRatePlanId === id ? '' : id;
  }

  get deadlineLabel() {
    return fmtDate(acmeRfqData.responseDeadline);
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

  // ── Step 1: Enrollment Headcount (manual entry · optional CSV auto-fill) ──
  // The table only surfaces once a rate plan is created; rows are scoped
  // to the eligible tiers the broker selected in the New Rate Plan modal.
  get showEnrollmentTable() {
    return this.enrollmentTierIds.length > 0;
  }
  get showEnrollmentEmptyState() {
    return this.enrollmentTierIds.length === 0;
  }

  // True when the broker came in via Intake → "Clone from Prior
  // Policy" AND actual prior data was forwarded. Drives the
  // toolbar lock below - when the prior policy is the source of
  // truth, New Rate Plan is disabled so the broker doesn't create
  // a redundant rate-plan scope on top of the seeded one.
  get isPriorPolicyClone() {
    const ctx = this._context;
    if (!ctx) return false;
    if (ctx.startMode !== 'clone') return false;
    return !!ctx.priorHeadcount || !!ctx.priorBenefits;
  }
  // Disable binding for the Step 1 New Rate Plan button. Only locks
  // while the modal is open so a stray click can't double-launch it.
  // The previous prior-policy-clone lock was removed - brokers
  // commonly want to layer additional plans on top of a cloned one
  // (e.g. add an HSA plan alongside the cloned PPO), so cloning
  // should not gate New Rate Plan.
  get newRatePlanDisabled() {
    return this.isRatePlanFormOpen;
  }
  // Editable FTE rows bound to the headcount state object - filtered to
  // the selected eligible tiers.
  get headcountRows() {
    return HEADCOUNT_TIERS.filter((t) =>
      this.enrollmentTierIds.includes(t.key)
    ).map((t) => ({
      id: t.id,
      key: t.key,
      label: t.label,
      value: this.headcount[t.key]
    }));
  }

  // Running total of the four tiers (blank inputs count as 0).
  get calculatedTotal() {
    return HEADCOUNT_TIERS.reduce((sum, t) => {
      const n = Number(this.headcount[t.key]);
      return sum + (Number.isNaN(n) ? 0 : n);
    }, 0);
  }
  get hasHeadcount() {
    return this.calculatedTotal > 0;
  }
  get continueCensusDisabled() {
    return this.calculatedTotal === 0;
  }
  get continueCensusClass() {
    return this.continueCensusDisabled ? 'continue is-disabled' : 'continue';
  }

  // Derived rating-tier summary consumed downstream (review step + payload).
  get headcountSummary() {
    return HEADCOUNT_TIERS.map((t) => {
      const n = Number(this.headcount[t.key]);
      return { id: t.id, tier: t.label, count: Number.isNaN(n) ? 0 : n };
    });
  }
  get totalEmployees() {
    return this.calculatedTotal;
  }
  get tierCount() {
    return this.headcountSummary.filter((t) => t.count > 0).length;
  }

  handleHeadcountInput(event) {
    const key = event.currentTarget.dataset.key;
    if (!key) return;
    this.headcount = { ...this.headcount, [key]: event.currentTarget.value };
  }

  confirmCensus() {
    if (this.continueCensusDisabled) return;
    this.completed = { ...this.completed, census: true };
  }

  // ── Step 2: Medical / Dental / Vision Benefit Selection ─────────
  // LOC-aware visibility - only the product segment matching the
  // intake-modal Line of Coverage renders. Unmapped LOCs fall back to
  // ['medical'] (single-root) so the wizard stays usable without
  // silently exposing all three roots.
  // LOC-driven scope: which root product is eligible for this RFQ.
  // Always returns a 1-element array (one root per EB LOC).
  // `inScopeSegmentIds` is the legacy alias kept for backwards
  // compatibility with downstream consumers.
  get inScopeRootIds() {
    const loc = this.context?.loc;
    return LOC_TO_SEGMENTS[loc] || ['medical'];
  }
  get inScopeSegmentIds() {
    return this.inScopeRootIds;
  }

  // Catalog-derived flat lists of attributes that are (a) in LOC scope
  // and (b) flagged includedInRfq by the Setup widget. These power the
  // step gating + Step 4 summary readouts.
  get _includedCoverageAttrs() {
    const roots = this.inScopeRootIds;
    return roots.flatMap((id) =>
      catGetCoverages(id)
        .filter((a) => a.includedInRfq)
        .map((a) => ({ ...a, rootId: id }))
    );
  }
  get _includedBenefitAttrs() {
    const roots = this.inScopeRootIds;
    return roots.flatMap((id) =>
      catGetBenefitCategories(id).flatMap((cat) =>
        cat.attributes
          .filter((a) => a.includedInRfq)
          .map((a) => ({ ...a, rootId: id, categoryId: cat.id, categoryLabel: cat.label }))
      )
    );
  }

  // Slot getters passed into c-eb-core-coverages /
  // c-eb-benefits-copays. They expose only the `{ value, min, max }`
  // triple per attribute so the children stay decoupled from the
  // catalog metadata fields.
  get coverageState() {
    const src = this.policyConfiguration.InsurancePolicyCoverage || {};
    const out = {};
    Object.keys(src).forEach((k) => {
      const s = src[k];
      out[k] = { value: s.value, min: s.min, max: s.max };
    });
    return out;
  }
  get benefitState() {
    const src = this.policyConfiguration.InsurancePolicyCoverageBenefit || {};
    const out = {};
    Object.keys(src).forEach((k) => {
      const s = src[k];
      out[k] = { value: s.value, min: s.min, max: s.max };
    });
    return out;
  }

  // Central input handler for both children. Routes `configchange`
  // events into the matching InsurancePolicyCoverage or
  // InsurancePolicyCoverageBenefit slot using shallow-immutable
  // updates so LWC's reactive tracking fires.
  handleConfigChange(event) {
    const { scope, attrId, field, value } = event.detail || {};
    if (!attrId) return;
    const bucket =
      scope === 'coverage'
        ? 'InsurancePolicyCoverage'
        : scope === 'benefit'
          ? 'InsurancePolicyCoverageBenefit'
          : null;
    if (!bucket) return;
    const prevBucket = this.policyConfiguration[bucket] || {};
    // Upsert semantics: seed an empty slot when this attrId hasn't been
    // seen before. Needed for tiered benefit keys (`attrId::tierId`)
    // that only exist once the broker touches them.
    const prevSlot = prevBucket[attrId] || {};
    const nextField = field || 'value';
    this.policyConfiguration = {
      ...this.policyConfiguration,
      [bucket]: {
        ...prevBucket,
        [attrId]: { ...prevSlot, [nextField]: value }
      }
    };
  }

  // ── Counts (used by Step 4 summary + continue-row hints) ────────
  // A slot is "configured" when the broker has entered any value/min/
  // max - i.e. moved beyond the default empty state.
  _isSlotConfigured(slot) {
    if (!slot) return false;
    return (
      (slot.value != null && String(slot.value).trim() !== '') ||
      (slot.min != null && String(slot.min).trim() !== '') ||
      (slot.max != null && String(slot.max).trim() !== '')
    );
  }
  get configuredCoverageCount() {
    const cfg = this.policyConfiguration.InsurancePolicyCoverage || {};
    return this._includedCoverageAttrs.filter((a) =>
      this._isSlotConfigured(cfg[a.id])
    ).length;
  }
  get configuredBenefitCount() {
    const cfg = this.policyConfiguration.InsurancePolicyCoverageBenefit || {};
    return this._includedBenefitAttrs.filter((a) =>
      this._isSlotConfigured(cfg[a.id])
    ).length;
  }
  // Combined total for the Step 4 summary pill ("X configured").
  get selectedBenefitCount() {
    return this.configuredCoverageCount + this.configuredBenefitCount;
  }
  get selectedBenefitsBadge() {
    const n = this.selectedBenefitCount;
    return n === 0 ? 'Not Configured' : `${n} Configured`;
  }
  get selectedBenefitsPillClass() {
    return this.selectedBenefitCount === 0
      ? 'eb-bnf-pill'
      : 'eb-bnf-pill is-selected';
  }

  // ── Step 2 (Core Plan Coverages) continue-row state ─────────────
  // Setup controls which attributes are in scope; the runtime
  // continue button is always enabled so the broker can proceed with
  // the Setup defaults if they don't need to adjust ranges.
  get continueCoveragesDisabled() {
    return false;
  }
  get continueCoveragesClass() {
    return 'continue';
  }

  // ── Step 3 (Benefits & Copays) continue-row state ───────────────
  get continueBenefitsClass() {
    return 'continue';
  }

  // ── Step 4 summary copy ─────────────────────────────────────────
  // Per-root one-liner of the configured attribute counts, used by
  // the Agentforce summary body and the review checklist.
  get medicalPlanSummary() {
    const total = this.selectedBenefitCount;
    if (total === 0) return 'No coverages or benefits configured yet';
    const cov = this.policyConfiguration.InsurancePolicyCoverage || {};
    const ben = this.policyConfiguration.InsurancePolicyCoverageBenefit || {};
    return this.inScopeRootIds
      .map((rid) => {
        const root = EB_ROOT_PRODUCTS.find((r) => r.id === rid);
        const label = root ? root.label : rid;
        const covCount = catGetCoverages(rid)
          .filter((a) => a.includedInRfq)
          .filter((a) => this._isSlotConfigured(cov[a.id])).length;
        const benCount = catGetBenefitCategories(rid)
          .flatMap((c) => c.attributes.filter((a) => a.includedInRfq))
          .filter((a) => this._isSlotConfigured(ben[a.id])).length;
        return `${label}: ${covCount + benCount}`;
      })
      .join(' · ');
  }

  get rulesSummary() {
    return this.medicalPlanSummary;
  }

  // Prior Policy Details - the incumbent group medical policy this RFQ was
  // created from. Surfaced on Review & Publish so the broker sees the baseline.
  get priorPolicyDetails() {
    const ctx = this.context || {};
    const label = ctx.priorPolicy || acmeRfqData.priorPolicyLabel || '';

    let carrier = ctx.priorCarrier;
    if (!carrier && label) {
      const segs = label.split(/[-–·-]/);
      carrier = segs.length > 1 ? segs[segs.length - 1].trim() : label.trim();
    }

    const number = ctx.priorPolicyNumber || ctx.priorPolicyId || '-';

    let premiumNum = null;
    if (ctx.priorPremium != null && ctx.priorPremium !== '') {
      const n = Number(ctx.priorPremium);
      if (!Number.isNaN(n)) premiumNum = n;
    }
    if (premiumNum == null) {
      const appId = ctx.applicationId || acmeRfqData.id;
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

    let fourthLabel = 'Policy Term';
    let fourthValue = ctx.priorPolicyTerm || '-';
    if (ctx.priorYearsOfCoverage != null && ctx.priorYearsOfCoverage !== '') {
      const y = Number(ctx.priorYearsOfCoverage);
      fourthLabel = 'Years of Coverage';
      fourthValue = `${ctx.priorYearsOfCoverage} year${y === 1 ? '' : 's'}`;
    }

    return { carrier: carrier || '-', number, premium, fourthLabel, fourthValue };
  }

  // Advance from Core Plan Coverages → Benefits & Copays. Always
  // enabled - the Setup widget controls which attributes are in scope,
  // and the runtime continue-row hint reports configuration progress
  // so the broker can proceed with the Setup defaults if they prefer.
  confirmCoverages() {
    this.completed = {
      ...this.completed,
      census: true,
      coverages: true
    };
  }
  // Advance from Benefits & Copays → Review & Publish. No gate - the
  // benefits milestone is optional, so we always allow proceeding once
  // earlier steps are complete.
  confirmBenefits() {
    this.completed = {
      ...this.completed,
      census: true,
      coverages: true,
      benefits: true
    };
  }

  // ── Step 3: Review & Submit ─────────────────────────────────────
  // Market cards decorated with selection state. `order` is the 1-based
  // position in the ordered selection array → shown in the numbered badge.
  get marketCards() {
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
        cardClass: selected ? 'market-card is-selected' : 'market-card',
        logoStyle: `background: ${m.accent};`
      };
    });
  }

  get hasSelectedMarkets() {
    return this.selectedMarketIds.length > 0;
  }

  // Ordered, human-readable list of the chosen markets (submit hint +
  // the submitted "Sent to" line).
  get selectedMarketsLabel() {
    if (!this.selectedMarketIds.length) return 'No markets selected yet';
    return this.selectedMarketIds
      .map((id) => MARKETS.find((m) => m.id === id)?.name)
      .filter(Boolean)
      .join(' · ');
  }

  get marketSelectHint() {
    const n = this.selectedMarketIds.length;
    if (!n) return 'Click carriers in priority order to build your target set.';
    return `${n} market${n === 1 ? '' : 's'} selected · sent in the numbered order.`;
  }

  // Toggle a market in/out of the ordered selection - push appends to the
  // end (preserving send order); re-click removes it.
  toggleMarketSelection(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    if (this.selectedMarketIds.includes(id)) {
      this.selectedMarketIds = this.selectedMarketIds.filter((x) => x !== id);
    } else {
      this.selectedMarketIds = [...this.selectedMarketIds, id];
    }
  }

  // Keyboard activation (Enter / Space) for the clickable card divs.
  handleMarketKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') {
      return;
    }
    event.preventDefault();
    this.toggleMarketSelection(event);
  }

  updateRoutingStrategy(event) {
    this.routingStrategy = event.target.value;
  }

  // ── Rate Plan modal - open (new) / open (edit) / close ──────────
  // "New Rate Plan" → blank form prefilled with the account geo state
  // + policy currency. Opens the SLDS 2 modal in create mode at Step 1
  // (Rate Plan Config). Step 2 (Enrollment Headcount) draft is seeded
  // from any FTEs the broker may have already captured.
  handleNewRatePlan() {
    this.editingRatePlanId = null;
    this.ratePlanForm = {
      ...DEFAULT_RATE_PLAN_FORM,
      geoState: this.ratePlanGeoState || '',
      currency: this.ratePlanCurrency || 'USD'
    };
    this.ratePlanFormHeadcount = { ...this.headcount };
    this._ratePlanModalStep = 1;
    this._resetRpTierMenu();
    this.isRatePlanFormOpen = true;
  }

  // ── Prior Rate Plan quick-fill (cross-LOC) ──────────────────────
  // When the broker chained EB LOCs via "Add Another Line of
  // Coverage" (e.g., Group Medical → Group Dental), the census step
  // on the new LOC would otherwise force them to re-enter the same
  // rate-plan config (type, geo state, frequency, tier scope) they
  // just captured. Sibling EB workspaces publish their raw
  // savedRatePlans through the review snapshot pipeline, so we can
  // pull the most-recently-created plan and offer it as a one-click
  // seed here. The broker still lands on Step 1 and can tweak
  // anything before Save creates a fresh IRP-* record on this LOC.

  // All plans from sibling EB LOCs, in cross-LOC creation order
  // (oldest sibling first, each sibling's own plans in save order).
  // We can't get a true wall-clock timestamp from the snapshot, so
  // "last created" = last plan in the last sibling that has plans.
  get _priorEbRatePlans() {
    const siblings = (this.siblingReviewPayloads || []).filter(
      (s) => s && s.locKind === 'eb' && Array.isArray(s.ratePlansRaw)
    );
    const flat = [];
    siblings.forEach((s) => {
      s.ratePlansRaw.forEach((p) => {
        flat.push({ ...p, sourceLocLabel: s.locLabel || 'Prior LOC' });
      });
    });
    return flat;
  }
  // Most recent prior plan across sibling EB LOCs (or null if none).
  // The button below is gated on this being non-null.
  get priorRatePlan() {
    const plans = this._priorEbRatePlans;
    return plans.length > 0 ? plans[plans.length - 1] : null;
  }
  get hasPriorRatePlan() {
    return !!this.priorRatePlan;
  }
  // Tooltip / aria hint so the broker knows *which* prior plan is
  // about to be seeded before they click. Falls back to a generic
  // label if the sibling didn't publish a name yet.
  get priorRatePlanTitle() {
    const p = this.priorRatePlan;
    if (!p) return '';
    const label = p.name || 'prior rate plan';
    const from = p.sourceLocLabel ? ` from ${p.sourceLocLabel}` : '';
    return `Seed a new plan from ${label}${from}`;
  }

  // Prior-plan quick-fill → same modal as New Rate Plan, but with
  // the config pre-filled from the newest sibling EB plan. Editing
  // id stays null so Save appends a fresh plan (never mutates the
  // sibling record). Broker still walks through Step 1 → Step 2
  // and can adjust anything (frequency, currency, tier scope) that
  // differs for this LOC.
  handleAddPriorRatePlan() {
    const p = this.priorRatePlan;
    if (!p) return;
    this.editingRatePlanId = null;
    this.ratePlanForm = {
      type: p.type || '',
      geoState: p.geoState || this.ratePlanGeoState || '',
      frequency: p.frequency || '',
      currency: p.currency || this.ratePlanCurrency || 'USD',
      eligibleTiers: (p.eligibleTiers || []).slice()
    };
    this.ratePlanFormHeadcount = { ...this.headcount };
    this._ratePlanModalStep = 1;
    this._resetRpTierMenu();
    this.isRatePlanFormOpen = true;
  }

  // Card pencil → reopen the modal in edit mode at Step 1 with the
  // selected plan's values pre-loaded. Save updates in place.
  handleEditRatePlan(event) {
    const id = event.currentTarget.dataset.id;
    const plan = this.savedRatePlans.find((p) => p.id === id);
    if (!plan) return;
    this.editingRatePlanId = id;
    this.ratePlanForm = {
      type: plan.type,
      geoState: plan.geoState,
      frequency: plan.frequency,
      currency: plan.currency,
      eligibleTiers: plan.eligibleTiers.slice()
    };
    this.ratePlanFormHeadcount = { ...this.headcount };
    this._ratePlanModalStep = 1;
    this._resetRpTierMenu();
    this.isRatePlanFormOpen = true;
  }

  handleRatePlanFormCancel() {
    this.isRatePlanFormOpen = false;
    this.editingRatePlanId = null;
    this.ratePlanForm = { ...DEFAULT_RATE_PLAN_FORM };
    this._ratePlanModalStep = 1;
    this._resetRpTierMenu();
  }

  // ── Modal step navigation ───────────────────────────────────────
  handleRatePlanFormNext() {
    if (this.rpSaveDisabled) return;
    this._ratePlanModalStep = 2;
  }
  handleRatePlanFormBack() {
    this._ratePlanModalStep = 1;
  }
  handleRatePlanFormHeadcountInput(event) {
    const key = event.currentTarget.dataset.key;
    if (!key) return;
    this.ratePlanFormHeadcount = {
      ...this.ratePlanFormHeadcount,
      [key]: event.currentTarget.value
    };
  }

  // Backdrop click on the modal closes it; clicks inside the modal
  // container call this to keep the close from firing.
  stopRatePlanModalPropagation(event) {
    event.stopPropagation();
  }

  // c-picklist change handlers (single-selects).
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

  // ── Tier Structure multi-select ──────────────────────────────────
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
  // Anchor the fixed-position menu to the trigger's viewport rect so it
  // escapes the card's overflow. Flips upward + caps height when tight.
  _positionRpTierMenu() {
    const trigger = this.template.querySelector('.eb-rate__multi-trigger');
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

  // ── Save / Update ────────────────────────────────────────────────
  // Appends a new plan, or - when reopened via the inline pencil -
  // updates the entry in place. Either way, recompute the tier union
  // → unlock the FTE table, close the modal, refresh the inline status
  // banner. The Account → Policies → Rate Plans data table is the
  // long-term home for these records; this surface only shows the
  // most recent ones inline so the broker has a glanceable receipt.
  handleRatePlanSave() {
    if (this.rpSaveDisabled) return;
    const f = this.ratePlanForm;
    const tiers = f.eligibleTiers.slice();
    const wasEditing = !!this.editingRatePlanId;

    if (wasEditing) {
      this.savedRatePlans = this.savedRatePlans.map((p) =>
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
      this.savedRatePlans = [
        ...this.savedRatePlans,
        {
          id: `irp-${this._ratePlanSeq}`,
          name: `IRP-${String(1000 + this._ratePlanSeq)}`,
          type: f.type,
          geoState: f.geoState,
          frequency: f.frequency,
          currency: f.currency,
          eligibleTiers: tiers
        }
      ];
    }

    // Recompute the union of tier ids across every saved plan - this
    // drives which FTE rows render in the inline card preview + the
    // modal's Step 2 table on next open.
    const union = new Set();
    this.savedRatePlans.forEach((p) =>
      p.eligibleTiers.forEach((t) => union.add(t))
    );
    this.enrollmentTierIds = Array.from(union);

    // Commit the modal's Step 2 FTE draft into the top-level state so
    // the outer wizard's "Proceed" gate (continueCensusDisabled) sees
    // the broker's headcount entries. Save is allowed even when every
    // tier is 0 - the broker can come back via Edit to fill them in.
    this.headcount = { ...this.headcount, ...this.ratePlanFormHeadcount };

    this.isRatePlanFormOpen = false;
    this.editingRatePlanId = null;
    this.ratePlanForm = { ...DEFAULT_RATE_PLAN_FORM };
    this._ratePlanModalStep = 1;
    this._resetRpTierMenu();

  }

  // Consolidated JSON payload for the Review & Submit step. Projects
  // policyConfiguration into two FSC-shaped arrays so downstream
  // consumers can map straight to InsurancePolicyCoverage (IPC) and
  // InsurancePolicyCoverageBenefit (IPCB). Only emits rows the Setup
  // canvas flagged includedInRfq AND whose root product is in LOC
  // scope, with `medicalBenefitSelection` retained as a legacy alias
  // for clients that already consume the flat list.
  get ebPayload() {
    const inScopeRoots = this.inScopeRootIds;
    const cov = this.policyConfiguration.InsurancePolicyCoverage || {};
    const ben = this.policyConfiguration.InsurancePolicyCoverageBenefit || {};

    const insurancePolicyCoverage = this._includedCoverageAttrs.map((a) => {
      const s = cov[a.id] || {};
      const row = {
        rootProduct: a.rootId,
        attrId: a.id,
        label: a.label,
        dataType: a.dataType
      };
      if (a.dataType === 'CurrencyRange') {
        row.min = s.min;
        row.max = s.max;
      } else {
        row.value = s.value;
      }
      return row;
    });

    const insurancePolicyCoverageBenefit = this._includedBenefitAttrs.map(
      (a) => {
        const s = ben[a.id] || {};
        const row = {
          rootProduct: a.rootId,
          categoryId: a.categoryId,
          categoryLabel: a.categoryLabel,
          attrId: a.id,
          label: a.label,
          dataType: a.dataType
        };
        if (a.dataType === 'CurrencyRange') {
          row.min = s.min;
          row.max = s.max;
        } else {
          row.value = s.value;
        }
        return row;
      }
    );

    return {
      headcountSummary: this.headcountSummary,
      totalEmployees: this.totalEmployees,
      // FSC-aligned buckets
      InsurancePolicyCoverage: insurancePolicyCoverage,
      InsurancePolicyCoverageBenefit: insurancePolicyCoverageBenefit,
      // Legacy alias - flat list of every emitted row across both
      // buckets, tagged with its source segment for downstream consumers
      // that still read `medicalBenefitSelection`.
      medicalBenefitSelection: [
        ...insurancePolicyCoverage.filter((r) =>
          inScopeRoots.includes(r.rootProduct)
        ).map((r) => ({
          segment: r.rootProduct,
          subsection: 'coverages',
          id: r.attrId,
          label: r.label,
          ...(r.min != null || r.max != null
            ? { min: r.min, max: r.max }
            : { value: r.value })
        })),
        ...insurancePolicyCoverageBenefit
          .filter((r) => inScopeRoots.includes(r.rootProduct))
          .map((r) => ({
            segment: r.rootProduct,
            subsection: r.categoryId,
            id: r.attrId,
            label: r.label,
            ...(r.min != null || r.max != null
              ? { min: r.min, max: r.max }
              : { value: r.value })
          }))
      ]
    };
  }

  submitToMarkets() {
    this.completed = STEP_ORDER.reduce((acc, id) => {
      acc[id] = true;
      return acc;
    }, {});
    const baseMsg = 'Census and Medical Plan Design submitted. Agentforce will notify you via Slack when quotes return.';
    const msg = this.routingStrategy
      ? `${baseMsg} Routing strategy: ${this.routingStrategy}`
      : baseMsg;
    this.dispatchEvent(
      new CustomEvent('risksubmitted', {
        detail: {
          accountName: this.accountName,
          applicationName: this.appName,
          routingStrategy: this.routingStrategy || null,
          effectiveFrom: this.effectiveFrom || null,
          effectiveTo: this.effectiveTo || null,
          payload: this.ebPayload,
          message: msg
        },
        bubbles: true,
        composed: true
      })
    );
    this.view = 'submitted';
    requestAnimationFrame(() => {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // ── Navigation ──────────────────────────────────────────────────
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
  // after the target revert to incomplete; captured data is preserved.
  handleStepSelect(event) {
    this.goToStep(event.detail?.stepId);
  }

  // Re-open `target` step: mark earlier steps complete and everything from
  // `target` onward incomplete so only that one step renders. Captured
  // data (census, rules, plan) is preserved.
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

  // "Save as Draft" - see rfqWorkspace.js for the split rationale.
  // Emits a toast; the broker stays on the current step.
  // Saving a draft is a quiet action - no toast. Toasts are reserved
  // for submission, routing to carriers, and sending the proposal
  // email.
  handleSaveAsDraft() {}

  // "Close" - the second half of the old "Save Draft & Close" CTA.
  handleClose() {
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: {
          route: this.launchedFromAccount ? 'account-record-page' : 'run-my-day'
        },
        bubbles: true,
        composed: true
      })
    );
  }

  // ══════════════════════════════════════════════════════════════
  // Review-step accordion + bundle-review plumbing (parity with the
  // PA + Home workspaces). Everything below powers the Hybrid v2
  // Review pane: progressive-disclosure accordions, an inline
  // Review tab bar for sibling LOCs on the same bundle, and the
  // two-button fork footer that saves the RFQ to the bundle and
  // routes the broker to the next action.
  // ══════════════════════════════════════════════════════════════

  // ── Accordion open-state getters ────────────────────────────────
  // Individual getters back the `open={…}` binding on each
  // <details> so LWC can push initial state (all sections open) and
  // updates flow the other way via handleReviewSectionToggle.
  get isPolicyDetailsOpen() {
    return this.reviewSections?.policyDetails === true;
  }
  get isHeadcountSectionOpen() {
    return this.reviewSections?.headcount === true;
  }
  get isRatePlansSectionOpen() {
    return this.reviewSections?.ratePlans === true;
  }
  get isCoveragesSectionOpen() {
    return this.reviewSections?.coverages === true;
  }
  get isBenefitsSectionOpen() {
    return this.reviewSections?.benefits === true;
  }

  handleReviewSectionToggle(event) {
    const el = event?.currentTarget || event?.target;
    const section = el?.dataset?.section;
    if (!section) return;
    const isOpen = el?.open === true;
    if (this.reviewSections?.[section] === isOpen) return;
    this.reviewSections = {
      ...this.reviewSections,
      [section]: isOpen
    };
  }

  // ── Accordion summary labels ────────────────────────────────────
  // Rollup strings for the collapsed summary line. Kept singular /
  // plural aware so "1 Tier" reads correctly next to "3 Tiers".

  // Application Details - LOC + effective range.
  get policyDetailsSummary() {
    const loc = this.locLabel;
    if (this.effectiveFrom && this.effectiveTo) {
      return `${loc} · ${this.effectiveFrom} to ${this.effectiveTo}`;
    }
    return loc;
  }

  // Enrollment Headcount - total FTEs across tiers.
  get headcountSummaryLabel() {
    const n = this.totalEmployees || 0;
    const tiers = this.tierCount || 0;
    if (!n) return 'Not entered';
    return `${n} FTE${n === 1 ? '' : 's'} · ${tiers} tier${tiers === 1 ? '' : 's'}`;
  }

  // Rate Plans - count of saved plans (not the flattened per-tier
  // roster the details table renders).
  get ratePlansCountLabel() {
    const n = (this.savedRatePlans || []).length;
    return `${n} Rate Plan${n === 1 ? '' : 's'}`;
  }

  // Core Plan Coverages - IPC macro-financial attributes flagged
  // includedInRfq for this RFQ.
  get coverageAttrCountLabel() {
    const n = (this._includedCoverageAttrs || []).length;
    return `${n} Coverage${n === 1 ? '' : 's'} included`;
  }

  // Benefits & Copays - IPCB per-encounter attributes flagged
  // includedInRfq. Grouped by category on the roster below.
  get benefitAttrCountLabel() {
    const n = (this._includedBenefitAttrs || []).length;
    return `${n} Benefit${n === 1 ? '' : 's'} configured`;
  }

  // ── Review roster rows (flat + grouped, human-readable) ─────────
  // Coverage + benefit rosters merge catalog metadata with the live
  // policyConfiguration slot so min/max/value actually render. Only
  // valued / selected attrs are included. Ranges use an en-dash
  // ("min – max") to match PA review formatting.
  get reviewCoverageRows() {
    const cov = this.policyConfiguration.InsurancePolicyCoverage || {};
    return (this._includedCoverageAttrs || [])
      .map((a) => {
        const slot = cov[a.id] || {};
        const value = this._fmtReviewAttrValue(a, slot);
        if (value == null) return null;
        return {
          id: a.id,
          label: a.label,
          value,
          rootId: a.rootId
        };
      })
      .filter(Boolean);
  }
  get reviewBenefitRows() {
    const ben = this.policyConfiguration.InsurancePolicyCoverageBenefit || {};
    return (this._includedBenefitAttrs || [])
      .map((a) => {
        const slot = ben[a.id] || {};
        const value = this._fmtReviewAttrValue(a, slot);
        if (value == null) return null;
        const catLabel = a.categoryLabel || this._catLabel(a.categoryId);
        return {
          id: `${a.categoryId || 'ncat'}-${a.id}`,
          label: a.label,
          value,
          categoryId: a.categoryId || null,
          categoryLabel: catLabel
        };
      })
      .filter(Boolean);
  }

  // Parent → child groups for Review panels (rate plan → tiers,
  // product root → coverage attrs, benefit category → attrs).
  get reviewRatePlanGroups() {
    const out = [];
    for (const plan of this.ratePlanStatusItems || []) {
      const raw = (this.savedRatePlans || []).find((p) => p.id === plan.id);
      const planType = raw?.type || 'Rate Plan';
      const frequency = raw?.frequency || '';
      const title = frequency ? `${planType} · ${frequency}` : planType;
      const tiers = (plan.tierRows || [])
        .filter((t) => t && (t.value != null && t.value !== ''))
        .map((t, idx) => ({
          id: t.id || `${plan.id}-${idx}`,
          label: t.label,
          value: String(t.value)
        }));
      out.push({
        id: plan.id,
        title,
        rows: tiers
      });
    }
    return out.filter((g) => g.rows.length > 0);
  }
  get reviewCoverageGroups() {
    const groups = new Map();
    for (const row of this.reviewCoverageRows) {
      const key = row.rootId || 'other';
      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          title: this._rootLabel(key),
          rows: []
        });
      }
      groups.get(key).rows.push(row);
    }
    return Array.from(groups.values());
  }
  get reviewBenefitGroups() {
    const groups = new Map();
    for (const row of this.reviewBenefitRows) {
      const key = row.categoryId || row.categoryLabel || 'other';
      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          title: row.categoryLabel || key,
          rows: []
        });
      }
      groups.get(key).rows.push(row);
    }
    return Array.from(groups.values());
  }
  get hasReviewCoverageGroups() {
    return this.reviewCoverageGroups.length > 0;
  }
  get hasReviewBenefitGroups() {
    return this.reviewBenefitGroups.length > 0;
  }
  get hasReviewRatePlanGroups() {
    return this.reviewRatePlanGroups.length > 0;
  }
  get hasReviewHeadcountRows() {
    return this.reviewHeadcountRows.length > 0;
  }

  // Headcount roster - one row per active tier. Zero-count tiers
  // are dropped so the review shows what was actually entered.
  get reviewHeadcountRows() {
    return (this.headcountSummary || [])
      .filter((t) => (Number(t.count) || 0) > 0)
      .map((t) => ({
        id: t.id,
        label: t.label,
        value: String(t.count)
      }));
  }

  // Format a coverage/benefit attr for Review. Returns null when the
  // attr has no broker-entered value so callers can omit empty rows.
  // Ranges render as "min – max" (U+2013 en dash) to match PA.
  _fmtReviewAttrValue(a, slot = {}) {
    const min = slot.min ?? a?.min;
    const max = slot.max ?? a?.max;
    const v = slot.value ?? a?.value;
    const hasMin = min != null && min !== '';
    const hasMax = max != null && max !== '';
    if (a?.dataType === 'CurrencyRange' || hasMin || hasMax) {
      if (!hasMin && !hasMax) return null;
      if (hasMin && hasMax) return `${min} – ${max}`;
      return hasMin ? String(min) : String(max);
    }
    if (v == null || v === '') return null;
    if (typeof v === 'boolean') return v ? 'Included' : 'Excluded';
    return String(v);
  }

  _rootLabel(rootId) {
    const map = {
      medical: 'Medical',
      dental: 'Dental',
      vision: 'Vision'
    };
    return map[rootId] || rootId;
  }

  // Human-readable label for a benefit category id. Falls back to
  // the id itself so unknown categories still show something.
  _catLabel(catId) {
    for (const rootId of this.inScopeRootIds || []) {
      const cats = catGetBenefitCategories(rootId) || [];
      const hit = cats.find((c) => c.id === catId);
      if (hit) return hit.label;
    }
    return catId;
  }

  // ── Snapshot publishing (Bundle Review) ─────────────────────────
  // Build a normalized snapshot of this LOC's Review payload so the
  // account page can hand it to sibling workspaces for inline
  // rendering under the Review tab bar. Shape matches
  // c-loc-review-panel's contract; EB fills in the EB-specific
  // arrays and leaves auto/home arrays empty.
  buildReviewSnapshot() {
    const ctx = this.context || {};
    const highlights = this.quoteDetailsHighlights || [];
    const headcount = this.reviewHeadcountRows;
    const ratePlans = this.quoteDetailsRatePlans || [];
    const ebCoverages = this.reviewCoverageRows;
    const ebBenefits = this.reviewBenefitRows;
    const hasContent =
      headcount.length > 0 ||
      ratePlans.length > 0 ||
      ebCoverages.length > 0 ||
      ebBenefits.length > 0;
    return {
      tabId: ctx.rfqId || null,
      locKind: 'eb',
      locLabel: this.locLabel,
      application: this.appName,
      insured: this.accountName,
      status: this.completed?.review ? 'Ready' : 'Draft',
      policyDetails: {
        loc: this.locLabel,
        effectiveFrom: this.effectiveFrom || '',
        effectiveTo: this.effectiveTo || '',
        summary: this.policyDetailsSummary,
        highlights
      },
      // Auto + Home shapes kept empty so consumers can iterate safely
      // regardless of locKind.
      vehicles: [],
      drivers: [],
      dwellings: [],
      homeowners: [],
      scheduledItems: [],
      // EB-specific arrays.
      headcount,
      ratePlans,
      // Raw savedRatePlans configs, published so a sibling EB LOC can
      // seed a "Add Prior Rate Plan" quick-fill. Not consumed by the
      // review panel (which uses the flattened `ratePlans` view); this
      // key is a private-ish channel between EB workspaces on the same
      // bundle. Shallow-clone each entry so downstream mutation can't
      // reach back into this LOC's state.
      ratePlansRaw: (this.savedRatePlans || []).map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        geoState: p.geoState,
        frequency: p.frequency,
        currency: p.currency,
        eligibleTiers: (p.eligibleTiers || []).slice()
      })),
      ebCoverages,
      ebBenefits,
      // Legacy coverages array unused for EB (locReviewPanel skips
      // it when isEb). Keep the key so the shape stays symmetric.
      coverages: [],
      counts: {
        headcount: this.headcountSummaryLabel,
        ratePlans: this.ratePlansCountLabel,
        ebCoverages: this.coverageAttrCountLabel,
        ebBenefits: this.benefitAttrCountLabel
      },
      hasContent
    };
  }

  // Fire the snapshot up to the account page. Hash-guarded so we
  // don't spam events on every render - only re-dispatch when the
  // serialized payload actually differs. Silently no-ops if we
  // don't have a stable rfqId yet (e.g., mid-mount).
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
    // Publish after each render so downstream getters
    // (headcountSummary, quoteDetailsRatePlans, etc.) reflect
    // the latest state. Hash check inside _publishReviewSnapshot
    // prevents feedback loops when the account page pushes sibling
    // payloads back down.
    this._publishReviewSnapshot();
  }

  // ── Bundle Review tab bar ────────────────────────────────────────
  // Self entry for the tab bar. Same shape as sibling snapshots so
  // the getter below can concatenate cleanly.
  get _selfReviewTabDescriptor() {
    const ctx = this.context || {};
    return {
      id: ctx.rfqId || 'self',
      locLabel: this.locLabel,
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
      status:
        p.status === 'Ready'
          ? 'Ready'
          : (p.hasContent ? 'In progress' : 'Not started'),
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
  // activeReviewTabId points to a sibling that's since been closed.
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

  // ── LOC session strip (top of workspace) ────────────────────────
  // Only surfaces when the bundle has 2+ LOCs so single-LOC
  // workspaces stay uncluttered.
  get showSessionStrip() {
    return Array.isArray(this.sessionTabs) && this.sessionTabs.length > 1;
  }

  // Precompute className + a11y payload for the template so the
  // markup stays declarative. Each pill carries its 1-based position
  // (in the number badge) and the state class its tint comes from.
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
        // WAI-ARIA tab wiring - mirrors Auto/Home so SR users get a
        // consistent tab→panel relationship as they chain LOCs.
        tabDomId: `p15-sess-tab-${s.id}`,
        panelDomId: this._workspacePanelDomId,
        // Every sibling LOC pill carries a × delete affordance. Flag
        // is defensive so a future "Add LOC" trailing pill can opt
        // out with showClose:false.
        showClose: true,
        className
      };
    });
  }

  // Tabpanel plumbing (see rfqWorkspace.js for rationale). Undefined
  // when the session strip isn't rendered so LWC drops role/labelledby
  // on single-LOC accounts.
  get _workspacePanelDomId() {
    return `p15-panel-${this.activeSessionId || 'root'}`;
  }
  get workspacePanelId() {
    return this._workspacePanelDomId;
  }
  get workspacePanelRole() {
    return this.showSessionStrip ? 'tabpanel' : undefined;
  }
  get workspacePanelLabelledBy() {
    return this.showSessionStrip && this.activeSessionId
      ? `p15-sess-tab-${this.activeSessionId}`
      : undefined;
  }

  // Broker clicked a sibling LOC pill. Fire `switchsession` with
  // the tab id and let the account record page flip the active SF
  // tab (same code path as clicking the tab in the top strip).
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
  // the currently active LOC (we only own our own headcount /
  // savedRatePlans locally). For sibling pills we fall back to a
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

  get _deleteLocHeading() {
    const label = this._deleteLocSession?.locLabel || '';
    return `Delete "${label}"?`;
  }

  get _deleteLocWarningText() {
    return this._deleteLocSession?.warningText || '';
  }

  // Content-summary "gist" for the delete-LOC warning banner. EB
  // tracks headcount (per-tier FTE counts on the census) and
  // savedRatePlans (plan selections carried into the wizard). Zero
  // dimensions are omitted; if every dimension is zero we return ''
  // and the caller skips the banner entirely.
  _computeDeleteContentSummary() {
    const hc = this.headcount || {};
    const totalEmployees =
      (Number(hc.employeeOnly) || 0) +
      (Number(hc.employeeSpouse) || 0) +
      (Number(hc.employeeFamily) || 0) +
      (Number(hc.employeeChildren) || 0);
    const planCount = (this.savedRatePlans || []).length;
    const parts = [];
    if (totalEmployees > 0) {
      parts.push(
        `${totalEmployees} employee${totalEmployees === 1 ? '' : 's'} on the census`
      );
    }
    if (planCount > 0) {
      parts.push(`${planCount} plan${planCount === 1 ? '' : 's'} selected`);
    }
    if (!parts.length) return '';
    return parts.join(', ');
  }

  // ── Fork CTAs on the Review step ────────────────────────────────
  // Save this RFQ into the account bundle (Draft -> Ready) and
  // dispatch `risksubmitted` so the app shell can flip the RFQ row
  // and surface a toast. The workspace stays on the Review step -
  // the fork CTAs navigate the broker onward (either the Submission
  // Board or the Add Another LOC intake modal).
  _saveRfqToBundle() {
    // Mark every wizard step complete so the sidebar reads Ready.
    this.completed = STEP_ORDER.reduce((acc, id) => {
      acc[id] = true;
      return acc;
    }, {});
    this.dispatchEvent(
      new CustomEvent('risksubmitted', {
        detail: {
          rfqId: this.context?.rfqId || null,
          accountId: this.context?.accountId || null,
          accountName: this.accountName,
          applicationName: this.appName,
          lob: this.context?.lob || null,
          loc: this.locLabel,
          routingStrategy: this.routingStrategy || null,
          effectiveFrom: this.effectiveFrom || null,
          effectiveTo: this.effectiveTo || null,
          // Instructs the app shell to flip this row to Ready for
          // Submission (not Submitted - carriers are picked on the
          // Submission Board).
          newStatus: 'Ready for Submission',
          payload: this.ebPayload
        },
        bubbles: true,
        composed: true
      })
    );
    // Keep the workspace on Review; the fork CTAs handle navigation.
    requestAnimationFrame(() => {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // Review page's ghost CTA: "+ Add Another Line of Coverage".
  // Persists the current RFQ into the bundle and reopens the Create
  // RFQ intake modal at the app shell so the broker can start a
  // fresh LOC RFQ for the same account.
  handleOpenAddLob() {
    this._saveRfqToBundle();
    this.handleAddAnotherLoc();
  }

  // Review page's primary CTA: "Add to Submission Board". Persists
  // the current RFQ into the bundle and pivots the account page's
  // secondary tabs to the Submission Board so the broker can route.
  handleSaveToBoard() {
    this._saveRfqToBundle();
    this.handleProceedToBoard();
  }

  // Legacy alias - earlier iterations had a single "Submit to
  // Markets" CTA on Review. The Review fork now branches directly
  // (see handleOpenAddLob / handleSaveToBoard), but keep this shim
  // so any external call sites still work.
  submitToMarkets() {
    this._saveRfqToBundle();
    this.handleProceedToBoard();
  }

  // Hybrid "Add Another LOC" - open the intake modal pre-filled for
  // the same account + Line of Business + policy term the broker
  // just used, with an isAddingLoc flag so the modal strips down to
  // just the LOC picker. Fires `startrfqintake` up to c/app.
  handleAddAnotherLoc() {
    // Rule: one open flow per LOC on an account. Hand the intake
    // modal every LOC already represented on this bundle so the
    // picker can hide them all (not just the source LOC).
    const ownLoc = this.locLabel || this.context?.loc || 'Group Medical';
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
            lob: this.context?.lob || null,
            effectiveFrom: this.effectiveFrom || '',
            effectiveTo: this.effectiveTo || '',
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
}
