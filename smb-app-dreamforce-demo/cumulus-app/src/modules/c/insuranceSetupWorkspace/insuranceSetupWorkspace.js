import { LightningElement, track } from 'lwc';
import { readForcedState } from 'c/emptyState';

/**
 * c-insurance-setup-workspace
 *
 * Root shell for the 5-domain Insurance Settings workspace. Pure
 * orchestration - owns the Root Product picker, the categorized left
 * nav, and the right-canvas router. Per the architecture directive, no
 * form fields or complex tables live here; every step card resolves to
 * either an existing real LWC, one of the three new stub children, or
 * an inline "Coming Soon" empty-state.
 *
 * Down: `<c-eb-* root-product={selectedRootProduct}>` - children read
 *       the rootProduct @api prop.
 * Up:   children dispatch `configurationsave` events that bubble into
 *       handleConfigurationSave, where global toasts / validation can
 *       be wired in a future pass.
 */

// ── Root Product picker options ─────────────────────────────────────
// Static for this pass - pulled from the directive's example list
// (Group Medical, Commercial Auto, SMB BOP). Mapped to ebCatalog root
// ids where one exists so child components keyed on root id continue
// to render the right data.
const ROOT_PRODUCT_OPTIONS = [
  { value: 'medical', label: 'Group Medical' },
  { value: 'commercial_auto', label: 'Commercial Auto' },
  { value: 'smb_bop', label: 'SMB BOP' }
];

// ── Component routing keys ──────────────────────────────────────────
// Each step card declares which component should render in the right
// canvas when picked. The shell's `lwc:if` branches read these keys.
// Routing key for injected/user-added steps. Picked widget cards
// route the canvas to a generic placeholder until a custom mount
// is wired for the chosen step type.
const COMP_CUSTOM_STEP = 'customStep';

// Canned step types the Add-Widget picker offers. Each entry maps
// straight into a flat widget card (icon flag + title + description).
// `kind` is a stable key for analytics / future routing; today every
// injected step lands on the same generic Coming-Soon placeholder.
// Curated short-list (3) so brokers don't drown in choices when
// extending the pipeline - every entry is RFQ-workflow adjacent.
const CANNED_STEP_TYPES = [
  {
    kind: 'claims_history',
    title: 'Claims History',
    description:
      'Pull prior loss runs and claims to surface risk patterns before quoting.',
    icon: 'document'
  },
  {
    kind: 'carrier_routing',
    title: 'Carrier Routing',
    description:
      'Pick the markets and carriers that should receive this RFQ submission.',
    icon: 'plug'
  },
  {
    kind: 'supplemental_questionnaire',
    title: 'Supplemental Questionnaire',
    description:
      'Ask coverage-specific follow-up questions before the broker submits.',
    icon: 'catalog'
  }
];

// Display Field catalog for the Edit Widget modal's Configuration
// section. Keyed by the widget `kind` (see `_kindForCard`). Mirrors
// the equivalent entries in `FLOW_BLUEPRINTS[...].stages[...].sections`
// inside c-rfq-playbook-setup so what the admin sees in the modal
// matches what the canvas Vehicles / Drivers tabs render. Only the
// `collection` widget (Asset Data Capture) ships an editable list in
// v1; other kinds resolve to an empty payload and the modal falls
// back to its generic pointer copy.
const DISPLAY_FIELD_CATALOG = {
  collection: {
    entities: [
      { value: 'vehicle', label: 'Vehicles', sfObject: 'IPA' },
      { value: 'driver',  label: 'Drivers',  sfObject: 'IPP' }
    ],
    fieldsByEntity: {
      vehicle: [
        { value: 'vin',                    label: 'VIN',                    api: 'IPA.VIN' },
        { value: 'year',                   label: 'Year',                   api: 'IPA.Year' },
        { value: 'make',                   label: 'Make',                   api: 'IPA.Make' },
        { value: 'model',                  label: 'Model',                  api: 'IPA.Model' },
        { value: 'auto_value',             label: 'Auto Value',             api: 'IPA.AutoValue' },
        { value: 'purchase_date',          label: 'Purchase Date',          api: 'IPA.PurchaseDate' },
        { value: 'annual_mileage',         label: 'Annual Mileage',         api: 'IPA.AnnualMileage' },
        { value: 'garaging_zip',           label: 'Garaging ZIP Code',      api: 'IPA.GaragingZip' },
        { value: 'anti_lock_brakes',       label: 'Anti-Lock Brakes',       api: 'IPA.AntiLockBrakes' },
        { value: 'daytime_running_lights', label: 'Daytime Running Lights', api: 'IPA.DaytimeRunningLights' }
      ],
      driver: [
        { value: 'first_name',         label: 'First Name',         api: 'IPP.FirstName' },
        { value: 'last_name',          label: 'Last Name',          api: 'IPP.LastName' },
        { value: 'date_of_birth',      label: 'Date of Birth',      api: 'IPP.DateOfBirth' },
        { value: 'gender',             label: 'Gender',             api: 'IPP.Gender' },
        { value: 'marital_status',     label: 'Marital Status',     api: 'IPP.MaritalStatus' },
        { value: 'occupation',         label: 'Occupation',         api: 'IPP.Occupation' },
        { value: 'license_status',     label: 'License Status',     api: 'IPP.LicenseStatus' },
        { value: 'license_number',     label: 'License Number',     api: 'IPP.LicenseNumber' },
        { value: 'license_state',      label: 'License State',      api: 'IPP.LicenseState' },
        { value: 'age_first_licensed', label: 'Age First Licensed', api: 'IPP.AgeFirstLicensed' }
      ]
    },
    // Sensible defaults so the modal opens with a populated list the
    // first time an admin edits Asset Data Capture. Mirrors the PCM-
    // required attributes on Vehicle + Driver.
    defaults: [
      { entityValue: 'vehicle', fieldValue: 'vin',           label: '', api: 'IPA.VIN' },
      { entityValue: 'vehicle', fieldValue: 'year',          label: '', api: 'IPA.Year' },
      { entityValue: 'vehicle', fieldValue: 'make',          label: '', api: 'IPA.Make' },
      { entityValue: 'vehicle', fieldValue: 'model',         label: '', api: 'IPA.Model' },
      { entityValue: 'driver',  fieldValue: 'first_name',    label: '', api: 'IPP.FirstName' },
      { entityValue: 'driver',  fieldValue: 'last_name',     label: '', api: 'IPP.LastName' },
      { entityValue: 'driver',  fieldValue: 'license_status',label: '', api: 'IPP.LicenseStatus' }
    ]
  }
};

// First-step sectionId per pipeline. Saving this card via the
// footer Next button flips _firstStepSavedByPart[partId] and
// unlocks the rest of the pipeline (progressive disclosure).
// Integrations has only one card so it's always "unlocked".
const FIRST_STEP_BY_PART = {
  rfq_setup: 'templates',
  comparison_table_setup: 'comp_templates',
  integrations: 'integrations'
};

// First step IN THE BUILDER (after the Landing) - used by the
// progressive-disclosure lock: while the broker sits on this step,
// every other pipeline card is locked (gray + grayscale + no
// pointer events). Advancing past it unlocks the rest. Integrations
// has no Builder/Landing split so no lock applies.
const FIRST_BUILDER_STEP_BY_PART = {
  rfq_setup: 'initialize',
  comparison_table_setup: 'comp_init'
};

const COMP_RFQ_PLAYBOOK          = 'rfqPlaybookSetup';
const COMP_PUBLISH_TEMPLATE      = 'rfqPublishTemplate';
const COMP_RFQ_TEMPLATE_LIST     = 'rfqTemplateList';
const COMP_COVERAGE_BENEFIT      = 'ebCoverageBenefit';
const COMP_QUOTE_COMPARE         = 'quoteCompareSetup';
const COMP_COMPARISON_TEMPLATE_LIST = 'comparisonTemplateList';
const COMP_EB_INTAKE             = 'ebIntakeSetup';
const COMP_EB_COMPARISON         = 'ebComparisonSetup';
const COMP_EB_INTEGRATION        = 'ebIntegrationHub';
const COMP_REVIEW_HANDOFF        = 'reviewHandoffSetup';
const COMP_COVERAGE_LIMITS       = 'coverageLimitsSetup';
const COMP_COMING_SOON           = 'comingSoon';

// ── Part + item definitions ─────────────────────────────────────────
// 3 top-level parts (not steps - these are parallel divisions of the
// RFQ Setup workspace, configurable in any order). Each part groups
// items (clickable cards) that route to a real or stub child in the
// right canvas. Coming-Soon items have been dropped per the latest
// spec; only items with a wired component live here now.
// Per-section sub-substep definitions. Today only the Product Catalog
// Definition section has 3rd-level navigation - it surfaces the 4
// hard-coded stages from c-rfq-playbook-setup's GROUP_BENEFITS/HEALTH
// blueprint so the admin can pick a stage from the workspace side
// panel (1.1.x) instead of from the playbook's internal "Steps to
// Configure" tile list (which is hidden via the playbook's embedded
// @api). Stage IDs MUST match the playbook's FLOW_BLUEPRINTS stage
// ids (rate_plan / plan_coverages / plan_benefits / review) so the
// passed-down `stage-id` resolves correctly inside the playbook.
// Substeps under the new "Configure" section - the 4 playbook stages.
// Publish was promoted to its own top-level section per spec.
// Every Configure substep is optional - the admin can ship a
// template by Initialize + Publish alone (sensible defaults flow
// through). The Configure parent section is also marked optional
// (see the rfq_setup category below) so the entire "configure stages"
// branch reads as skippable at a glance. Only Initialize + Publish
// stay mandatory.
// Per-LOB Configure substeps. The Configure step's `subSteps`
// array is resolved at render time by `_resolvedConfigureSubsteps`
// based on the broker's wizard LOB pick (bubbled up from the
// playbook via the `assignmentschange` event).
//
// - GROUP_BENEFITS (default): Rate Plan / Plan Coverages / Plan
//   Benefits / Integrations & Preview.
// - PERSONAL_LINES: Asset Data Capture / Coverage Limits /
//   Integrations & Preview. Substep ids match the
//   PL Auto blueprint stage ids inside c-rfq-playbook-setup so
//   the existing playbook stages mount as-is.
// - COMMERCIAL_LINES: falls back to GROUP_BENEFITS for now (per
//   spec - Commercial substeps not yet defined).
const CONFIGURE_SUBSTEPS_PERSONAL_LINES = [
  {
    id: 'collection',
    title: 'Asset Data Capture',
    description: 'Capture vehicle assets and assigned operators. Toggle which fields the broker sees in the runtime roster.',
    isOptional: true
  },
  {
    // Mounts the dedicated c-coverage-limits-setup component
    // (tabbed Overall / Vehicle / Driver with nested coverage →
    // attribute checkboxes) instead of routing through the
    // playbook's generic sections renderer.
    id: 'coverages',
    title: 'Coverage Limits',
    description: 'Tier coverages across the policy, per-vehicle, and per-driver scopes. Tabs map to the runtime tree levels.',
    icon: 'toggle',
    component: COMP_COVERAGE_LIMITS,
    isOptional: true
  },
  // Final substep - overrides the playbook stage with the dedicated
  // c-review-handoff-setup component via the substep-level
  // `component` override (kept unchanged per spec - "leave review &
  // send as current").
  {
    id: 'review',
    title: 'Integrations & Preview',
    description: 'Select quote providers and pick the attributes brokers see before binding.',
    icon: 'document',
    component: COMP_REVIEW_HANDOFF,
    isOptional: true
  }
];

const CONFIGURE_SUBSTEPS = [
  {
    id: 'rate_plan',
    title: 'Rate Plan Selection',
    description: 'Define base rate tiers and census enrollment parameters.',
    isOptional: true
  },
  {
    id: 'plan_coverages',
    title: 'Plan Coverages',
    description: 'Configure individual/family deductibles and out-of-pocket maximums.',
    isOptional: true
  },
  {
    id: 'plan_benefits',
    title: 'Plan Benefits',
    description: 'Map copay tiers for doctor visits, specialist care, and facility services.',
    isOptional: true
  },
  {
    // Renamed (Review and Send → Broker Review & Handoff →
    // Integrations & Preview) to keep the label aligned with what
    // the surface actually configures: downstream integrations
    // plus the runtime preview the broker sees before binding.
    // Mounts c-review-handoff-setup via the substep-level
    // `component` override (see activeComponent getter) instead of
    // routing through c-rfq-playbook-setup like its siblings.
    id: 'review',
    title: 'Integrations & Preview',
    description:
      'Select quote providers and pick the attributes brokers see before binding.',
    icon: 'document',
    component: COMP_REVIEW_HANDOFF,
    isOptional: true
  }
];

const CATEGORIES = [
  {
    id: 'rfq_setup',
    label: 'RFQ setup',
    description:
      'Build product hierarchy, configure coverages and benefits, and publish RFQ templates brokers use to collect submissions.',
    steps: [
      // Templates is rendered as a separate full-width Landing
      // View (above the workspace shell) - NOT a pipeline card.
      // activeStepId === 'templates' is the landing marker. Picking
      // a tile or "+ New" routes into the Initialize step via the
      // workspace's handleRfqTemplate* event handlers, which is
      // when the pipeline + detail Builder View appears.
      // ── 1. Initialize ────────────────────────────────────
      // Mounts the playbook with no active stage so the admin sees
      // the Root Product picker + Product Hierarchy preview.
      {
        id: 'initialize',
        title: 'Initialize',
        description: 'Select the Root Product to scope this RFQ template and preview its hierarchy.',
        icon: 'catalog',
        component: COMP_RFQ_PLAYBOOK
      },
      // ── 2. Configure ─────────────────────────────────────
      // Mounts the playbook with stage routing driven by the 4
      // substeps below. Picker is hidden so each substep config
      // takes the full panel width. Whole section is optional -
      // sensible defaults carry through so the admin can jump
      // straight from Initialize to Publish.
      {
        id: 'configure',
        title: 'Configure',
        description: 'Walk through rate plans, coverages, benefits, and review.',
        icon: 'toggle',
        component: COMP_RFQ_PLAYBOOK,
        subSteps: CONFIGURE_SUBSTEPS,
        isOptional: true
      },
      // ── 3. Publish ───────────────────────────────────────
      // Mounts c-rfq-publish-template - version + validity form +
      // activation toggle.
      {
        id: 'publish',
        title: 'Publish',
        description: 'Assign version + validity, then activate the template for producers.',
        icon: 'document',
        component: COMP_PUBLISH_TEMPLATE
      }
    ]
  },
  {
    id: 'comparison_table_setup',
    label: 'Comparison table setup',
    description:
      'Pin summary widgets and arrange body fields for the side-by-side broker comparison view.',
    steps: [
      // Templates is rendered as a separate full-width Landing
      // View (above the workspace shell) - NOT a pipeline card.
      // activeStepId === 'comp_templates' is the landing marker;
      // picking a tile or "+ New" routes into comp_init via the
      // workspace's handleComparisonTemplate* event handlers.
      // ── 1. Initialize ────────────────────────────────────
      {
        id: 'comp_init',
        title: 'Initialize',
        description: 'Pick Line of Business + Coverage to scope the comparison template.',
        icon: 'compare',
        component: COMP_QUOTE_COMPARE
      },
      // ── 2. Fixed Summary Widgets ─────────────────────────
      {
        id: 'comp_summary',
        title: 'Fixed Summary Widgets',
        description: 'Pin the KPI widgets that anchor the top of the broker view.',
        icon: 'compare',
        component: COMP_QUOTE_COMPARE
      },
      // ── 3. Metric Selection & Order ──────────────────────
      {
        id: 'comp_metrics',
        title: 'Metric Selection & Order',
        description: 'Pick body fields and set the broker display sequence.',
        icon: 'compare',
        component: COMP_QUOTE_COMPARE
      },
      // ── 4. Logic & Publish ───────────────────────────────
      {
        id: 'comp_logic',
        title: 'Logic & Publish',
        description: 'Column limits, Agentforce module, and Save & Activate.',
        icon: 'compare',
        component: COMP_QUOTE_COMPARE
      }
      // 'Side-by-Side Compare (new)' / c-eb-comparison-setup was
      // removed per spec. The component files stay in the repo as
      // dormant scaffolding so reintroducing the entry is a single
      // CATEGORIES insertion.
    ]
  },
  {
    id: 'integrations',
    label: 'Integrations',
    description:
      'Connect to data providers and carriers, manage credentials, and monitor endpoint health.',
    // Temporarily disabled - Provider & Carrier Catalog is not ready
    // for this release. Card renders greyed out and ignores clicks;
    // flip back to false (or remove the flag) when ready to ship.
    disabled: true,
    steps: [
      {
        id: 'integrations',
        title: 'Provider & Carrier Catalog',
        description:
          'Auth credentials and endpoint URLs for third-party carriers and providers.',
        icon: 'plug',
        component: COMP_EB_INTEGRATION
      }
    ]
  }
];

export default class InsuranceSetupWorkspace extends LightningElement {
  // ── Global state ────────────────────────────────────────────
  // Two-level navigation model. `activePartId` picks which top-level
  // part owns the canvas (RFQ setup / Comparison table / Integrations);
  // `activeStepId` picks the sub-section inside that part. The Root
  // Product picker was retired in the latest spec - `selectedRootProduct`
  // is now seeded to 'medical' so the wired Group Medical flow
  // (rfqPlaybookSetup → GROUP_BENEFITS/HEALTH, EB Coverage/Benefit)
  // lights up by default. The state primitive stays so child
  // components keyed on root id keep working unchanged.
  @track selectedRootProduct = 'medical';
  // Sidebar + Widget Sub-Steps navigation model.
  //   activePartId   - top-level category (left sidebar selection).
  //                    Always set; defaults to the first active
  //                    category so the canvas has scope on first
  //                    paint.
  //   activeStepId   - null when the canvas is showing the widget
  //                    grid of sub-steps for the active category;
  //                    set when the user has drilled INTO a step
  //                    and the canvas is rendering the config UI.
  //   activeSubStepId- optional 3rd-level pointer for sections that
  //                    expose substeps (RFQ Setup's "Configure"
  //                    surfaces Rate Plan / Plan Coverages / …).
  //                    Each widget card carries both the sectionId
  //                    AND subStepId so a single click sets both
  //                    state slots together.
  @track activePartId = 'rfq_setup';
  // Seed to the active part's first step (Templates dashboard) so
  // the broker lands on the landing view immediately and the
  // progressive-disclosure lock fires on first paint. Matches the
  // auto-select behavior of _selectPart for category switches.
  @track activeStepId = 'templates';
  // ── Add-Widget picker (Pipeline Flow Builder injection) ─────
  // Opens when the broker clicks a [+] insert-node between two
  // pipeline cards. The selected step type is appended to the
  // per-category `injectedWidgets` map and merged into the canvas
  // pipeline at the requested array index.
  @track addPickerOpen = false;
  @track addPickerIndex = null;
  // Per-category injected widgets, keyed by partId. Each entry is a
  // fully-formed widget shape (the same as a card produced by
  // `_widgetCardEntry`) plus `insertIndex`. Splice order = addition
  // order so later inserts can land relative to earlier ones (e.g.
  // adding A at 3 then B at 3 pushes A to 4 as the broker expects).
  @track injectedWidgets = {};
  // Per-card kebab menu (Edit / Move up / Move down / Delete) on the
  // pipeline. Holds the `key` (sectionId::subStepId or sectionId) of
  // the card whose menu is open, or null. Only one menu is open at a
  // time so opening another auto-closes the previous.
  @track openStepMenuKey = null;
  // Per-part order override for pipeline cards. Populated the first
  // time the admin reorders any card in a part (via the kebab
  // menu's Move up / Move down actions) and thereafter drives the
  // effective card order. Keyed by partId, value is an array of card
  // keys in the desired display order. Missing entry → natural
  // order from `_widgetCardEntry` + injectedWidgets splicing.
  @track stepOrder = {};
  // Per-part removal list. Populated whenever the admin deletes a
  // built-in substep via the kebab menu. Injected widgets are
  // removed directly from `injectedWidgets` instead. Keyed by
  // partId, value is an array of card keys to filter out.
  @track removedStepKeys = {};
  // Per-card overrides captured through the Edit Widget modal.
  // Keyed by card key; each value is a partial patch layered on
  // top of the natural card properties (title / description /
  // required / active / componentName). Missing fields fall back
  // to the built-in defaults so an edit never has to touch every
  // property.
  @track stepOverrides = {};

  // ── Edit Widget modal state ─────────────────────────────────
  // Opened from the pipeline card's kebab "Edit" action. The
  // modal owns its own draft; we just pass the current card as
  // `context` and receive the saved patch back on `save`.
  @track editModalOpen = false;
  @track editModalContext = null;

  // Broker's effective LOB pick - bubbled up from
  // c-rfq-playbook-setup via the `assignmentschange` event when
  // the wizard LOB picker changes. Drives the per-LOB Configure
  // substep list (`_resolvedConfigureSubsteps`).
  @track _brokerLob = null;
  // Editing context - set when the admin clicks Edit on a tile so the
  // wizard can re-hydrate from the saved template; null for the
  // + New Template flow.
  @track editingRfqTemplateId = null;
  @track editingComparisonTemplateId = null;

  // ── Pre-builder LOB/LOC capture modal ──────────────────────
  // The "+ New Template" CTA on the landing dashboards opens this
  // modal first. The picks are stored as `_seededRfqLob/Loc` /
  // `_seededCompareLob/Loc` and threaded into the builder
  // children so the Initialize panel can skip the LOB+LOC pickers
  // (those choices are already made) and jump straight to the
  // filtered Root Product picker.
  @track _templateInitModalOpen = false;
  @track _templateInitModalKind = 'rfq'; // 'rfq' | 'compare'
  @track _seededRfqLob = null;
  @track _seededRfqLoc = null;
  @track _seededCompareLob = null;
  @track _seededCompareLoc = null;

  // Template-friendly accessors for the underscore-prefixed
  // tracking fields above. LWC templates only resolve top-level
  // identifiers by name, so these getters keep the markup readable
  // while preserving the underscore-as-private convention in JS.
  get templateInitModalOpen() { return this._templateInitModalOpen; }
  get templateInitModalKind() { return this._templateInitModalKind; }
  get seededRfqLob() { return this._seededRfqLob; }
  get seededRfqLoc() { return this._seededRfqLoc; }
  get seededCompareLob() { return this._seededCompareLob; }
  get seededCompareLoc() { return this._seededCompareLoc; }
  // 3rd-level navigation for sections that expose sub-substeps.
  // Defaults to null so initial paint lands on the playbook's
  // default view (Product Hierarchy when a Root Product is picked,
  // otherwise the picker) instead of jumping straight into a stage's
  // config before the admin has picked a root. The user clicks a
  // substep in the side panel to opt into a specific stage.
  @track activeSubStepId = null;

  // ── Picker options (passed to c-picklist) ───────────────────
  get rootProductOptions() {
    return ROOT_PRODUCT_OPTIONS.map((o) => ({ ...o }));
  }

  // ── Gating ──────────────────────────────────────────────────
  // The Root Product picker was retired, so the workspace can never
  // be in a locked state today. These getters stay (and always return
  // unlocked) so the rest of the view-model and template don't need
  // to change - if a picker comes back later, only this block flips.
  get isLocked() {
    return false;
  }
  get isRootProductMissing() {
    return false;
  }
  get navContainerClass() {
    return 'isw-nav';
  }

  // ── Filtered parts (drop empty + Coming-Soon-only parts) ────
  // Source-of-truth list with Coming-Soon items filtered out and any
  // part that ends up with zero wired sections dropped. Read by both
  // the part-level nav (.partsView) and the in-canvas section nav
  // (.activePartView) so they stay in sync.
  get _activeParts() {
    return CATEGORIES
      .map((cat) => ({
        ...cat,
        steps: cat.steps.filter((s) => s.component !== COMP_COMING_SOON)
      }))
      .filter((cat) => cat.steps.length > 0);
  }

  // ── Top-level Parts nav (left column of the workspace) ──────
  // Just the 3 part headers - clicking one opens its panel in the
  // canvas with an internal sub-nav. Decorated with active / disabled
  // flags + the SVG icon keys used by the template.
  get partsView() {
    return this._activeParts.map((p) => {
      // A part is disabled when the workspace is locked OR when the
      // part itself opted out via `disabled: true` in CATEGORIES.
      // Disabled parts render greyed out, ignore clicks, and stay
      // out of the keyboard tab order.
      const isDisabled = this.isLocked || !!p.disabled;
      const isActive = !isDisabled && this.activePartId === p.id;
      return {
        id: p.id,
        label: p.label,
        description: p.description || '',
        sectionCount: p.steps.length,
        isActive,
        isDisabled,
        ariaPressed: isActive ? 'true' : 'false',
        ariaDisabled: isDisabled ? 'true' : 'false',
        tabIndex: isDisabled ? '-1' : '0',
        cls: [
          'isw-part',
          isActive ? 'is-active' : '',
          isDisabled ? 'is-disabled' : ''
        ]
          .filter(Boolean)
          .join(' '),
        isIconRfq:     p.id === 'rfq_setup',
        isIconCompare: p.id === 'comparison_table_setup',
        isIconPlug:    p.id === 'integrations'
      };
    });
  }

  // ── Sidebar (categories) ────────────────────────────────────
  // Decorated category items for the left sidebar nav. Each
  // surfaces the SVG icon flag, disabled / active state, ARIA
  // attributes, and the composed class string the template binds.
  get sidebarItems() {
    return this._activeParts.map((p) => {
      const isDisabled = !!p.disabled;
      const isActive = !isDisabled && this.activePartId === p.id;
      return {
        id: p.id,
        label: p.label,
        description: p.description || '',
        isActive,
        isDisabled,
        ariaPressed: isActive ? 'true' : 'false',
        ariaDisabled: isDisabled ? 'true' : 'false',
        tabIndex: isDisabled ? '-1' : '0',
        cls: [
          'isw-side__item',
          isActive ? 'is-active' : '',
          isDisabled ? 'is-disabled' : ''
        ]
          .filter(Boolean)
          .join(' '),
        isIconRfq:     p.id === 'rfq_setup',
        isIconCompare: p.id === 'comparison_table_setup',
        isIconPlug:    p.id === 'integrations'
      };
    });
  }

  // ── Canvas view-mode ────────────────────────────────────────
  // Widget grid renders when a category is picked but no step has
  // been drilled into; otherwise the config UI renders for the
  // active step (with a "Back to <Category>" breadcrumb).
  get isShowingWidgetGrid() {
    return !!this.activePartId && !this.activeStepId;
  }
  // Wrapper the template reads so the SLDS 2 empty pane hides when
  // a forced demo state (`?forceEmpty=isw@<code>`) is active.
  get showPickStepEmpty() {
    return this.isShowingWidgetGrid && !this.hasForcedState;
  }
  get isShowingStepDetail() {
    return !!this.activePartId && !!this.activeStepId;
  }
  // Active widget cards for the canvas grid. Sections with subSteps
  // (RFQ Setup's "Configure") are flattened - the parent disappears
  // and its substeps surface as siblings so the broker reaches
  // "Plan Coverages" with one click instead of two.
  // Per-LOB Configure substep resolver. Returns the right substep
  // list based on the broker's wizard LOB pick (bubbled up via
  // handlePlaybookAssignmentsChange). Falls back to the default
  // Group Benefits substeps when nothing has been picked yet.
  get _resolvedConfigureSubsteps() {
    if (this._brokerLob === 'PERSONAL_LINES') {
      return CONFIGURE_SUBSTEPS_PERSONAL_LINES;
    }
    // COMMERCIAL_LINES + GROUP_BENEFITS (and the null pre-pick
    // case) all use the Group Medical-shaped pipeline for now.
    return CONFIGURE_SUBSTEPS;
  }

  get activeCategoryWidgets() {
    const part = this.activePart;
    if (!part) return [];
    let widgets = [];
    for (const s of part.steps) {
      // Configure substeps swap based on the broker's wizard LOB
      // pick. Other steps use their declared subSteps as-is.
      const effectiveSubSteps =
        s.id === 'configure'
          ? this._resolvedConfigureSubsteps
          : s.subSteps;
      const hasSubSteps =
        Array.isArray(effectiveSubSteps) && effectiveSubSteps.length > 0;
      if (hasSubSteps) {
        for (const ss of effectiveSubSteps) {
          widgets.push(
            this._widgetCardEntry({
              sectionId: s.id,
              subStepId: ss.id,
              title: ss.title,
              description: ss.description || '',
              icon: ss.icon || s.icon,
              isOptional: !!ss.isOptional && !s.isOptional
            })
          );
        }
      } else {
        widgets.push(
          this._widgetCardEntry({
            sectionId: s.id,
            subStepId: null,
            title: s.title,
            description: s.description || '',
            icon: s.icon,
            isOptional: !!s.isOptional
          })
        );
      }
    }
    // Splice in any user-injected widgets from the Add-Widget picker.
    // Addition-order matters here: each insert lands at its stored
    // insertIndex relative to the list AS IT EXISTED at insert time,
    // so iterating in the original order replays the broker's intent
    // (later inserts can sit at the same insertIndex without shifting
    // earlier ones onto each other's slot).
    const injected = this.injectedWidgets[part.id] || [];
    injected.forEach((w) => {
      const { insertIndex, ...widget } = w;
      const at = Math.min(Math.max(insertIndex, 0), widgets.length);
      widgets = [...widgets.slice(0, at), widget, ...widgets.slice(at)];
    });

    // Apply the admin's Move up / Move down ordering. When a
    // stepOrder exists for this part we reorder by it; any newly-
    // added widgets whose key isn't yet in the order are appended so
    // they stay visible. Missing = natural order.
    const partId = part.id;
    const orderList = this.stepOrder[partId];
    if (Array.isArray(orderList) && orderList.length) {
      const byKey = new Map(widgets.map((w) => [w.key, w]));
      const seen = new Set();
      const ordered = [];
      orderList.forEach((k) => {
        const w = byKey.get(k);
        if (w) {
          ordered.push(w);
          seen.add(k);
        }
      });
      widgets.forEach((w) => {
        if (!seen.has(w.key)) ordered.push(w);
      });
      widgets = ordered;
    }
    // Apply the admin's Delete removals. Built-in substeps stay in
    // config but get filtered here so the pipeline reflects the
    // action.
    const removedList = this.removedStepKeys[partId] || [];
    if (removedList.length) {
      const removedSet = new Set(removedList);
      widgets = widgets.filter((w) => !removedSet.has(w.key));
    }

    // Layer the admin's Edit Widget modal patches on top of the
    // natural card properties. Each override is a partial object
    // keyed by card key; only the fields present in the patch are
    // touched, everything else falls through to the underlying
    // built-in / injected definition.
    widgets = widgets.map((w) => {
      const patch = this.stepOverrides[w.key];
      if (!patch) return w;
      return {
        ...w,
        ...(patch.title != null ? { title: patch.title } : {}),
        ...(patch.description != null ? { description: patch.description } : {})
      };
    });

    // Enrich each card with per-tile kebab-menu state. Every action
    // is active by default; boundary rules (Move up at top, Move
    // down at bottom) still self-disable the corresponding buttons.
    // Injected widgets are tagged so downstream handlers can pick
    // the right removal path (drop from `injectedWidgets` vs. add
    // to `removedStepKeys`).
    return widgets.map((w, idx) => {
      const isInjected = !!(w.sectionId && w.sectionId.startsWith('custom-'));
      const canMoveUp = idx > 0;
      const canMoveDown = idx < widgets.length - 1;
      // Initialize + Publish are structural bookends of every
      // pipeline; hide (not just disable) their Move up / Move
      // down actions so the kebab menu on those cards only surfaces
      // meaningful actions.
      const isBookend =
        w.sectionId === 'initialize' || w.sectionId === 'publish';
      const showMoveUp = !isBookend && canMoveUp;
      const showMoveDown = !isBookend && canMoveDown;
      const isMenuOpen = this.openStepMenuKey === w.key;
      // Append `is-menu-open` to the widget's class list so the CSS
      // can lift its `overflow: hidden` while the dropdown is
      // visible - otherwise the menu would clip against the card's
      // rounded bottom edge.
      const cls = isMenuOpen ? `${w.cls} is-menu-open` : w.cls;
      return {
        ...w,
        cls,
        isInjected,
        canEdit: true,
        canMoveUp,
        canMoveDown,
        canDelete: true,
        editDisabled: false,
        moveUpDisabled: !canMoveUp,
        moveDownDisabled: !canMoveDown,
        deleteDisabled: false,
        showMoveUp,
        showMoveDown,
        isMenuOpen,
        menuAriaLabel: `More actions for ${w.title}`,
        menuBtnClass: isMenuOpen
          ? 'isw-widget__more is-open'
          : 'isw-widget__more'
      };
    });
  }

  // Scrim gate for the per-card kebab menu - a single fixed overlay
  // handles outside-click dismissal for whichever tile has its menu
  // open, so each card doesn't need to render its own scrim.
  get hasOpenStepMenu() {
    return this.openStepMenuKey !== null;
  }
  // Picker view-model - a fixed catalog the modal renders as
  // selectable rows. Surfaces the same icon flags the canvas cards
  // use so previewing the type's identity reads consistently.
  get pickerTypes() {
    return CANNED_STEP_TYPES.map((t) => ({
      ...t,
      isIconCatalog: t.icon === 'catalog',
      isIconToggle:  t.icon === 'toggle',
      isIconCompare: t.icon === 'compare',
      isIconPlug:    t.icon === 'plug',
      isIconDoc:     t.icon === 'document'
    }));
  }
  _widgetCardEntry({ sectionId, subStepId, title, description, icon, isOptional }) {
    const key = subStepId ? `${sectionId}::${subStepId}` : sectionId;
    const iconKey = icon || sectionId;
    // Active when this card's (sectionId, subStepId) pair matches the
    // currently-drilled step - drives the lit-up state on the
    // pipeline card AND the detail-pane mount on the right.
    const isActive =
      this.activeStepId === sectionId &&
      (this.activeSubStepId || null) === (subStepId || null);
    // Progressive-disclosure lock - non-Initialize cards are
    // locked ONLY while the broker is sitting on the Builder's
    // first step (Initialize for RFQ, comp_init for Comparison).
    // Advancing past it via Next or any other pipeline card
    // unlocks the rest; clicking back into Initialize re-locks
    // them. Lock key is FIRST_BUILDER_STEP_BY_PART (NOT
    // FIRST_STEP_BY_PART, which is the Landing marker used for
    // Cancel/Back navigation).
    const builderFirstId = FIRST_BUILDER_STEP_BY_PART[this.activePartId];
    const isFirstStep = !!builderFirstId &&
      sectionId === builderFirstId && !subStepId;
    const firstStepIsActive = !!builderFirstId &&
      this.activeStepId === builderFirstId && !this.activeSubStepId;
    const isLocked = !isFirstStep && firstStepIsActive;
    const classes = ['isw-widget'];
    if (isActive) classes.push('is-active');
    if (isLocked) classes.push('is-locked');
    return {
      key,
      sectionId,
      subStepId,
      title,
      description,
      isOptional,
      isActive,
      isLocked,
      tabIndex: isLocked ? '-1' : '0',
      cls: classes.join(' '),
      // Icon dispatch - fall back to the doc icon when the step's
      // own `icon` field doesn't match a known glyph below.
      isIconTemplates: iconKey === 'document' && sectionId.includes('templates'),
      isIconCatalog:   iconKey === 'catalog',
      isIconToggle:    iconKey === 'toggle',
      isIconCompare:   iconKey === 'compare',
      isIconPlug:      iconKey === 'plug',
      isIconDoc:       iconKey === 'document'
    };
  }
  // True whenever a pipeline card has been picked and the detail
  // pane is rendering that step's config UI; false renders the
  // empty-state placeholder in the right pane.
  get isStepSelected() {
    return !!this.activeStepId;
  }
  // ── Pipeline Flow Builder ────────────────────────────────────
  // The canvas renders the active category's widgets as a vertical
  // pipeline: card → insert-node → card → insert-node → card …
  // Each insert-node sits between two cards (positions 1..N-1, N-1
  // total for N cards) and reveals a + button on hover so the
  // broker can inject a new step exactly at that array index.
  //
  // pipelineNodes interleaves the source widget list with
  // connector / insert-node entries so the template can iterate a
  // single array and switch render branches on
  // `isCard` | `isConnector` | `isInsert`.
  //
  // Gap rendering rule: every between-card gap is a plain
  // connector line. No trailing [+] insert-node.
  get pipelineNodes() {
    const widgets = this.activeCategoryWidgets;
    if (!widgets.length) return [];
    const out = [];
    widgets.forEach((w, idx) => {
      out.push({
        key: `card::${w.key}`,
        isCard: true,
        isConnector: false,
        isInsert: false,
        card: w
      });
      // Between-card gaps render as plain connector lines.
      if (idx < widgets.length - 1) {
        out.push({
          key: `gap::${idx + 1}`,
          isCard: false,
          isConnector: true,
          isInsert: false,
          insertIndex: idx + 1
        });
      }
    });
    // Tail [+] insert-node removed - pipeline ends on the last card.
    return out;
  }
  // ── Per-card kebab menu (Edit / Move up / Move down / Delete) ──
  // Toggle the menu for a single card. Uses `card.key` (unique per
  // sectionId::subStepId pair) so the same click closes an already-
  // open menu. stopPropagation keeps the underlying card body from
  // also activating.
  handleToggleStepMenu(event) {
    event.stopPropagation();
    const key = event.currentTarget.dataset.key;
    if (!key) return;
    this.openStepMenuKey = this.openStepMenuKey === key ? null : key;
  }
  handleCloseStepMenu() {
    this.openStepMenuKey = null;
  }
  // The anchor wraps the kebab + dropdown inside the clickable card
  // body; a click on the anchor's empty space (padding around the
  // menu, gap between items) must not bubble up and activate the
  // parent card.
  handleStepMenuAnchorClick(event) {
    event.stopPropagation();
  }
  // Edit = open the Edit Widget modal with the current card as
  // context. The modal exposes structural metadata (order, type,
  // component name), editable identity (title / description),
  // behaviour toggles (required / active), and a widget-type-
  // specific configuration section. Saved patches land in
  // `stepOverrides[key]` and merge into `activeCategoryWidgets`.
  handleEditStep(event) {
    event.stopPropagation();
    this.openStepMenuKey = null;
    const key = event.currentTarget.dataset.key;
    if (!key) return;
    const merged = this.activeCategoryWidgets;
    const idx = merged.findIndex((w) => w.key === key);
    if (idx < 0) return;
    const card = merged[idx];
    this.editModalContext = this._buildEditContext(card, idx, merged.length);
    this.editModalOpen = true;
  }
  handleEditModalCancel() {
    this.editModalOpen = false;
    this.editModalContext = null;
  }
  handleEditModalSave(event) {
    const patch = event.detail || {};
    const key = patch.key;
    if (key) {
      // Persist a minimal patch keyed by card key. Only string /
      // boolean fields land here in v1 - widget-type-specific
      // config (display fields, integrations, etc.) still lives
      // on the canvas surfaces owned by each step.
      this.stepOverrides = {
        ...this.stepOverrides,
        [key]: {
          title: patch.title,
          description: patch.description,
          componentName: patch.componentName,
          required: patch.required,
          active: patch.active,
          // Only overwrite `displayFields` when the modal actually
          // returned one - kinds without a catalog entry emit
          // undefined here so we don't blow away a prior save with
          // a stale `undefined`.
          ...(Array.isArray(patch.displayFields)
            ? { displayFields: patch.displayFields }
            : {})
        }
      };
    }
    this.editModalOpen = false;
    this.editModalContext = null;
  }
  // Build the payload the modal hydrates from. Resolves the
  // widget's `kind` (used to pick the widget-type-specific config
  // section inside the modal) and infers the platform-owned
  // Component Name for built-in substeps so the admin sees which
  // LWC actually renders the step at runtime.
  _buildEditContext(card, index, total) {
    const kind = this._kindForCard(card);
    const origin = card.isInjected ? 'custom' : 'built-in';
    const componentName = card.isInjected
      ? ((this.stepOverrides[card.key] || {}).componentName || '')
      : this._builtInComponentName(card);
    const patch = this.stepOverrides[card.key] || {};
    return {
      key: card.key,
      sectionId: card.sectionId,
      subStepId: card.subStepId,
      kind,
      title: card.title,
      description: card.description,
      componentName,
      stepType: card.isInjected ? 'custom' : 'lwc',
      origin,
      required: patch.required != null ? patch.required : false,
      active: patch.active != null ? patch.active : true,
      index,
      total,
      displayFields: this._displayFieldsPayload(card)
    };
  }
  // Coarse widget-kind resolver - matches the switches inside the
  // Edit Widget modal's Configuration section. Falls back to
  // 'custom' for admin-injected widgets so they hit the generic
  // "no additional settings yet" branch.
  _kindForCard(card) {
    if (card.isInjected) return 'custom';
    const sid = card.sectionId || '';
    const ss = card.subStepId || '';
    if (sid === 'initialize') return 'init';
    if (sid === 'publish') return 'publish';
    if (ss === 'collection') return 'collection';
    if (ss === 'coverages') return 'coverages';
    if (ss === 'quote_comparison') return 'quote_comparison';
    if (ss === 'review') return 'review';
    // Group Benefits substep ids
    if (ss === 'rate_plan' || ss === 'plan_coverages' || ss === 'plan_benefits') {
      return 'coverages';
    }
    return 'custom';
  }
  // Best-effort Component Name for the built-in substeps. In a
  // real deployment this would come from FLOW_BLUEPRINTS; the map
  // below is a stand-in so the modal can surface the wiring the
  // admin should expect at deploy.
  _builtInComponentName(card) {
    const ss = card.subStepId || '';
    const sid = card.sectionId || '';
    if (sid === 'initialize')                       return 'c/rfqPlaybookSetup';
    if (sid === 'publish')                          return 'c/rfqPublishSetup';
    if (ss === 'collection')                        return 'c/assetDataCaptureSetup';
    if (ss === 'coverages')                         return 'c/coverageLimitsSetup';
    if (ss === 'quote_comparison')                  return 'c/quoteCompareSetup';
    if (ss === 'review')                            return 'c/reviewHandoffSetup';
    if (ss === 'rate_plan')                         return 'c/ebRatePlanSetup';
    if (ss === 'plan_coverages')                    return 'c/ebCoverageSetup';
    if (ss === 'plan_benefits')                     return 'c/ebBenefitSetup';
    return '';
  }
  // Display-field payload surfaced to the Edit Widget modal's
  // Configuration section. For widget kinds registered in
  // `DISPLAY_FIELD_CATALOG` (v1: `collection`), returns the entity
  // + fields-by-entity dictionaries plus the current selection -
  // either the admin-saved override or the catalog defaults. Kinds
  // without a catalog entry return an empty payload, which the
  // modal renders as its generic pointer copy instead of a picker.
  _displayFieldsPayload(card) {
    const kind = this._kindForCard(card);
    const catalog = DISPLAY_FIELD_CATALOG[kind];
    if (!catalog) return null;
    const patch = this.stepOverrides[card.key] || {};
    const saved = Array.isArray(patch.displayFields) ? patch.displayFields : null;
    // Deep-copy the selection so the modal can mutate its own
    // draft without leaking into `stepOverrides` before save.
    const selection = (saved || catalog.defaults || []).map((s) => ({ ...s }));
    return {
      entities: catalog.entities.map((e) => ({
        value: e.value,
        label: e.label
      })),
      fieldsByEntity: Object.keys(catalog.fieldsByEntity).reduce((acc, k) => {
        acc[k] = catalog.fieldsByEntity[k].map((f) => ({ ...f }));
        return acc;
      }, {}),
      selection
    };
  }

  // Move up / down. Works uniformly across built-in substeps AND
  // injected widgets by rewriting the per-part `stepOrder` array of
  // card keys. The `activeCategoryWidgets` getter honours this
  // override when computing the effective render order.
  handleMoveStepUp(event) {
    this._moveStep(event, -1);
  }
  handleMoveStepDown(event) {
    this._moveStep(event, +1);
  }
  _moveStep(event, delta) {
    event.stopPropagation();
    this.openStepMenuKey = null;
    const key = event.currentTarget.dataset.key;
    const partId = this.activePartId;
    if (!key || !partId) return;
    // Effective order = whatever `activeCategoryWidgets` currently
    // shows (which already reflects any prior overrides). Swap the
    // clicked card with its neighbour by index.
    const currentKeys = this.activeCategoryWidgets.map((w) => w.key);
    const idx = currentKeys.indexOf(key);
    if (idx < 0) return;
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= currentKeys.length) return;
    const nextKeys = [...currentKeys];
    [nextKeys[idx], nextKeys[targetIdx]] = [nextKeys[targetIdx], nextKeys[idx]];
    this.stepOrder = { ...this.stepOrder, [partId]: nextKeys };
  }

  // Delete a card. Injected widgets are removed from `injectedWidgets`
  // so they never rehydrate. Built-in substeps are recorded in
  // `removedStepKeys[partId]` so `activeCategoryWidgets` filters them
  // out. Either way, the removed card also drops out of any
  // stepOrder override so it doesn't linger in that state.
  handleDeleteStep(event) {
    event.stopPropagation();
    this.openStepMenuKey = null;
    const key = event.currentTarget.dataset.key;
    const partId = this.activePartId;
    if (!key || !partId) return;
    const merged = this.activeCategoryWidgets;
    const card = merged.find((w) => w.key === key);
    if (!card) return;

    if (card.isInjected) {
      const list = this.injectedWidgets[partId] || [];
      this.injectedWidgets = {
        ...this.injectedWidgets,
        [partId]: list.filter((w) => w.sectionId !== card.sectionId)
      };
    } else {
      const list = this.removedStepKeys[partId] || [];
      if (!list.includes(key)) {
        this.removedStepKeys = {
          ...this.removedStepKeys,
          [partId]: [...list, key]
        };
      }
    }

    // Purge the deleted key from the order override so future moves
    // don't try to swap a ghost entry back into the list.
    const order = this.stepOrder[partId];
    if (Array.isArray(order) && order.includes(key)) {
      this.stepOrder = {
        ...this.stepOrder,
        [partId]: order.filter((k) => k !== key)
      };
    }

    // If the deleted card was active, drop the selection so the
    // detail pane falls back to its default empty state.
    if (this.activeStepId === card.sectionId) {
      this.activeStepId = null;
      this.activeSubStepId = null;
    }
  }

  // ── Add-Widget picker ────────────────────────────────────────
  // Click [+] insert-node → opens the modal picker, remembering
  // which array index the broker wants to inject at.
  handleAddWidgetClick(event) {
    event.stopPropagation();
    const raw = event.currentTarget.dataset.insertIndex;
    const insertIndex = parseInt(raw, 10);
    if (Number.isNaN(insertIndex)) return;
    this.addPickerIndex = insertIndex;
    this.addPickerOpen = true;
  }
  handlePickerBackdrop(event) {
    // Backdrop click closes; in-modal clicks bubble up but the
    // dialog stops propagation explicitly so they don't dismiss.
    if (event.target === event.currentTarget) {
      this._closePicker();
    }
  }
  handlePickerStop(event) {
    event.stopPropagation();
  }
  handlePickerClose() {
    this._closePicker();
  }
  handlePickerKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.handlePickerSelect(event);
  }
  handlePickerSelect(event) {
    const kind = event.currentTarget.dataset.kind;
    const type = CANNED_STEP_TYPES.find((t) => t.kind === kind);
    if (!type || this.addPickerIndex === null) return;
    const partId = this.activePartId;
    if (!partId) return;
    // Unique per-instance id so the broker can drop the same kind
    // (e.g. two Document Upload steps) into the same pipeline
    // without sectionId collisions.
    const sectionId = `custom-${type.kind}-${Date.now()}`;
    const entry = this._widgetCardEntry({
      sectionId,
      subStepId: null,
      title: type.title,
      description: type.description,
      icon: type.icon,
      isOptional: false
    });
    entry.insertIndex = this.addPickerIndex;
    const list = this.injectedWidgets[partId] || [];
    this.injectedWidgets = {
      ...this.injectedWidgets,
      [partId]: [...list, entry]
    };
    this._closePicker();
  }
  _closePicker() {
    this.addPickerOpen = false;
    this.addPickerIndex = null;
  }

  // Friendly "Back to <Category>" label for the breadcrumb above the
  // step config UI. Falls back to a generic copy if no part is set.
  get backToWidgetsLabel() {
    return this.activePart
      ? `Back to ${this.activePart.label}`
      : 'Back';
  }
  // Friendly title of the currently-drilled step. Resolved by walking
  // the active category's steps + substeps and matching the active
  // (stepId, subStepId) pair; falls through to the injected-widgets
  // list when the step id starts with the custom prefix.
  get activeStepTitle() {
    const part = this.activePart;
    if (!part || !this.activeStepId) return '';
    if (this.isCustomInjectedStep) {
      const custom = this._resolvedCustomWidget;
      if (custom) return custom.title;
    }
    const section = part.steps.find((s) => s.id === this.activeStepId);
    if (!section) return '';
    if (this.activeSubStepId && Array.isArray(section.subSteps)) {
      const ss = section.subSteps.find((x) => x.id === this.activeSubStepId);
      if (ss) return ss.title;
    }
    return section.title;
  }
  // ── Custom (injected) step resolution ────────────────────────
  get isCustomInjectedStep() {
    return !!this.activeStepId && this.activeStepId.startsWith('custom-');
  }
  get _resolvedCustomWidget() {
    if (!this.isCustomInjectedStep) return null;
    const list = this.injectedWidgets[this.activePartId] || [];
    return list.find((w) => w.sectionId === this.activeStepId) || null;
  }
  get customStepDescription() {
    const c = this._resolvedCustomWidget;
    return c ? c.description : '';
  }

  // ── Active part resolution (canvas-level) ───────────────────
  get activePart() {
    if (!this.activePartId) return null;
    return this._activeParts.find((p) => p.id === this.activePartId) || null;
  }
  get hasActivePart() {
    return !!this.activePart;
  }
  get activePartLabel() {
    return this.activePart ? this.activePart.label : '';
  }
  get activePartDescription() {
    return this.activePart ? this.activePart.description || '' : '';
  }
  // Active part's label - parts are categories (not numbered steps),
  // so we don't surface a number prefix on the panel header anymore.
  // The kept getter (returning '') keeps the template's binding alive
  // in case we re-introduce a marker later.
  get activePartNumber() {
    return '';
  }

  // Sections inside the active part - numbered as steps (1, 2, 3, …)
  // ONLY when the part has multiple sections. A single-section part
  // (Comparison table setup, Integrations) reads as "the one setup
  // area" and gets no number prefix - calling it "step 1" implies a
  // sequence that doesn't exist. Sub-substeps under a multi-step
  // section keep their "<step>.<sub>" numbering.
  //
  // SLDS 2 Progress Indicator states tracked per row:
  //   isActive  - current focus (filled circle + halo + bold text)
  //   isDone    - past step (filled circle + checkmark, no halo)
  //   otherwise - future step (outlined circle + grey text)
  // Done state derives from _currentNavIndex so the stepper reflects
  // the linear walk through sections + substeps.
  get activePartSections() {
    const part = this.activePart;
    if (!part) return [];
    // Sections flagged `noNumber: true` (e.g. the Templates dashboard)
    // are excluded from the numbered stepper sequence so the
    // remaining 1, 2, 3 numbering reads as Initialize / Configure /
    // Publish even when the dashboard sits above them in the nav.
    const numberedSteps = part.steps.filter((s) => !s.noNumber);
    const showSectionNumbers = numberedSteps.length > 1;
    const numberedIndexById = new Map(
      numberedSteps.map((s, idx) => [s.id, idx + 1])
    );
    const navPoints = this._navPoints;
    const currentIdx = this._currentNavIndex;
    return part.steps.map((s) => {
      const isActive = this.activeStepId === s.id;
      // Section's 1-based index excludes non-numbered (dashboard)
      // sections so Initialize / Configure / Publish stay 1, 2, 3.
      const sectionIndex = numberedIndexById.get(s.id) || 0;
      const sectionNumber = showSectionNumbers && !s.noNumber
        ? String(sectionIndex)
        : '';
      const hasNumber = !!sectionNumber;
      const hasSubSteps = Array.isArray(s.subSteps) && s.subSteps.length > 0;
      const showSubSteps = isActive && hasSubSteps;

      // Section is "done" once the user has walked past the LAST
      // nav point that belongs to this section.
      const lastIdxForSection = (() => {
        let last = -1;
        for (let k = 0; k < navPoints.length; k++) {
          if (navPoints[k].sectionId === s.id) last = k;
        }
        return last;
      })();
      const isDone = currentIdx > -1
        && lastIdxForSection > -1
        && currentIdx > lastIdxForSection
        && !isActive;

      const decoratedSubSteps = hasSubSteps
        ? s.subSteps.map((ss, j) => {
            const ssActive = isActive && this.activeSubStepId === ss.id;
            // Substep is "done" once the user has walked past its
            // nav point (only meaningful while parent section
            // is/was active).
            const ssIdx = navPoints.findIndex(
              (p) => p.sectionId === s.id && p.subStepId === ss.id
            );
            const ssDone = currentIdx > -1
              && ssIdx > -1
              && currentIdx > ssIdx
              && !ssActive;
            // SLDS convention: mandatory steps carry no annotation,
            // optional steps get an "Optional" badge next to the
            // title. Substeps INHERIT the badge from their parent
            // section - if the section is already marked optional,
            // every substep is implicitly optional too, so we drop
            // the per-row badge to avoid visual repetition. The
            // underlying `ss.isOptional` data stays intact in case a
            // single substep needs to opt INTO optional while its
            // parent stays mandatory.
            const showOptionalTag = !!ss.isOptional && !s.isOptional;
            return {
              ...ss,
              number: `${sectionIndex}.${j + 1}`,
              isActive: ssActive,
              isDone: ssDone,
              isOptional: showOptionalTag,
              ariaPressed: ssActive ? 'true' : 'false',
              tabIndex: '0',
              cls: [
                'isw-substep',
                ssActive ? 'is-active' : '',
                ssDone ? 'is-done' : '',
                showOptionalTag ? 'isw-substep_optional' : ''
              ]
                .filter(Boolean)
                .join(' ')
            };
          })
        : [];
      return {
        ...s,
        number: sectionNumber,
        hasNumber,
        showSubSteps,
        decoratedSubSteps,
        isActive,
        isDone,
        // Same convention for parent sections - surface an
        // "Optional" badge when the section itself is skip-able.
        isOptional: !!s.isOptional,
        ariaPressed: isActive ? 'true' : 'false',
        tabIndex: '0',
        cls: [
          'isw-section',
          isActive ? 'is-active' : '',
          isDone ? 'is-done' : '',
          hasNumber ? '' : 'isw-section_no-number',
          s.isOptional ? 'isw-section_optional' : ''
        ]
          .filter(Boolean)
          .join(' ')
      };
    });
  }

  // ── Active section resolution (detail-level) ────────────────
  get activeStep() {
    if (!this.activeStepId) return null;
    const part = this.activePart;
    if (!part) return null;
    return part.steps.find((s) => s.id === this.activeStepId) || null;
  }
  get hasActiveStep() {
    return !!this.activeStep;
  }
  get activeComponent() {
    // Substep-level `component` overrides the parent step's, so a
    // single substep (e.g. Broker Review & Handoff) can route to a
    // different mount than its siblings without forking the parent
    // step into its own top-level entry.
    //
    // For the Configure section the substep list is RESOLVED per
    // LOB (`_resolvedConfigureSubsteps`) - PL Auto's substeps live
    // in CONFIGURE_SUBSTEPS_PERSONAL_LINES, not on the static
    // CATEGORIES entry. We have to consult the resolved list here
    // so PL-only `component` overrides (e.g. Coverage Limits →
    // c-coverage-limits-setup) actually resolve.
    if (!this.activeStep) return null;
    const subSteps =
      this.activeStepId === 'configure'
        ? (this._resolvedConfigureSubsteps || [])
        : (this.activeStep.subSteps || []);
    const sub = this.activeSubStepId
      ? subSteps.find((s) => s.id === this.activeSubStepId)
      : null;
    return (sub && sub.component) || this.activeStep.component;
  }

  // Boolean getters per component key - keep `lwc:if` branches in the
  // template trivial (no expression evaluation).
  get isCompRfqPlaybook()    { return this.activeComponent === COMP_RFQ_PLAYBOOK; }
  get isCompCoverageBenefit(){ return this.activeComponent === COMP_COVERAGE_BENEFIT; }
  get isCompQuoteCompare()   { return this.activeComponent === COMP_QUOTE_COMPARE; }
  // Mounted in the Landing View for Comparison setup. Mirrors the
  // RFQ pattern (isCompRfqTemplateListMount → isTemplatesSection)
  // - keys off activeStepId since the comp_templates step entry
  // no longer exists in CATEGORIES (Landing isn't a pipeline card).
  get isCompComparisonTemplateList() { return this.isCompTemplatesSection; }
  get isCompEbIntake()       { return this.activeComponent === COMP_EB_INTAKE; }
  get isCompEbComparison()   { return this.activeComponent === COMP_EB_COMPARISON; }
  get isCompEbIntegration()  { return this.activeComponent === COMP_EB_INTEGRATION; }
  get isCompReviewHandoff()  { return this.activeComponent === COMP_REVIEW_HANDOFF; }
  get isCompCoverageLimits() { return this.activeComponent === COMP_COVERAGE_LIMITS; }
  get isCompComingSoon()     { return this.activeComponent === COMP_COMING_SOON; }

  // Empty state - only when no part is open. Two cases:
  //   1. Locked (no Root Product picked) → "Pick a Root Product"
  //   2. Unlocked but no part active (shouldn't happen since unlock
  //      auto-selects the first part, but harmless fallback).
  get showCanvasIdle() {
    return !this.hasActivePart;
  }
  get idleTitle() {
    return this.isLocked
      ? 'Pick a Root Product'
      : 'Pick a part to configure';
  }
  get idleSub() {
    return this.isLocked
      ? 'Choose a Root Product above to unlock the parts and load the workspace.'
      : 'Pick one of the parts on the left to open its configuration panel.';
  }

  // ── Forced empty/error state for demoing the SLDS 2 surface ──
  // `?forceEmpty=isw@<code>` (or a bare `?forceEmpty=<code>`).
  _forcedState = readForcedState('isw');
  get hasForcedState() {
    return Boolean(this._forcedState);
  }
  get forcedStateName() {
    return this._forcedState;
  }
  get forcedStateTitle() {
    const map = {
      'error:recoverable': 'Something went wrong loading Setup',
      'error:connectionissue': 'Can’t reach the setup service',
      'error:unrecoverable': 'We hit an unexpected problem',
      'error:appconnection': 'Setup metadata service is unreachable',
      'accessissues:request': 'You don’t have access to Setup',
      'accessissues:limit': 'This workspace hit a plan limit',
      'accessissues:deleted': 'This step no longer exists',
      'success:new': 'No steps configured for this Root Product',
      'noresults:filter': 'No steps match these filters',
      'noresults:search': 'No steps match your search',
      'maintenance:planned': 'Setup is being upgraded'
    };
    return map[this._forcedState] || '';
  }
  get forcedStateDescription() {
    const map = {
      'error:recoverable': 'The pipeline failed to load. Try again in a moment.',
      'error:connectionissue': 'We couldn’t reach the setup service. Check your connection, then try again.',
      'error:unrecoverable': 'Refresh the page or contact your admin if this keeps happening.',
      'error:appconnection': 'The Salesforce metadata layer didn’t respond. Retry, or check integration health.',
      'accessissues:request': 'Ask your admin for the Insurance Setup Administrator permission set.',
      'accessissues:limit': 'This org has reached its playbook limit. Delete an unused playbook to add another.',
      'accessissues:deleted': 'Someone deleted the step you were looking at. Pick another step from the pipeline.',
      'success:new': 'Pick a Root Product above and start adding steps to the pipeline.',
      'noresults:filter': 'Try clearing the persona or LOB filters to see more steps.',
      'noresults:search': 'Try a shorter query or check for typos.',
      'maintenance:planned': 'Setup is briefly unavailable while we roll out a scheduled update.'
    };
    return map[this._forcedState] || '';
  }
  get forcedStateCtaLabel() {
    const map = {
      'error:recoverable': 'Try again',
      'error:connectionissue': 'Retry',
      'error:appconnection': 'Retry',
      'error:unrecoverable': 'Reload',
      'noresults:filter': 'Clear filters',
      'noresults:search': 'Clear search'
    };
    return map[this._forcedState] || '';
  }
  get hasForcedStateCta() {
    return Boolean(this.forcedStateCtaLabel);
  }

  // Header copy for the canvas - read off the active step so the right
  // panel always names the step the admin is configuring. Stub
  // children carry their own headers, so the shell suppresses its
  // header when one of them is mounted to avoid duplicate titles.
  get showActiveHeader() {
    if (!this.hasActiveStep) return false;
    if (this.isCompEbIntake) return false;
    if (this.isCompEbComparison) return false;
    if (this.isCompEbIntegration) return false;
    return true;
  }
  get activeTitle()       { return this.activeStep ? this.activeStep.title : ''; }
  get activeDescription() { return this.activeStep ? this.activeStep.description : ''; }
  // Pass-through helper so the rfqPlaybookSetup mount can pick up the
  // currently-selected root and key its EB widgets on it.
  get activeRootProductAsList() {
    return this.selectedRootProduct ? [this.selectedRootProduct] : [];
  }

  // Root Product → (LOB, Coverage) mapping for the rfqPlaybookSetup
  // mount. Only Group Medical maps to a documented flow blueprint
  // (GROUP_BENEFITS / HEALTH); the other two roots intentionally fall
  // through to nulls so rfqPlaybookSetup renders its own "No flow
  // defined" placeholder rather than a half-loaded canvas. Centralised
  // here so a future copy/rename of the root values lands in one
  // place.
  get playbookLob() {
    if (this.selectedRootProduct === 'medical') return 'GROUP_BENEFITS';
    return null;
  }
  get playbookCoverage() {
    if (this.selectedRootProduct === 'medical') return 'HEALTH';
    return null;
  }
  // What stage id to pass down to c-rfq-playbook-setup. Returns
  // empty (so the playbook shows its default Product Hierarchy /
  // picker view) on the Initialize section, and on the Configure
  // section when no substep is picked yet. On Configure with a
  // substep active, maps 1:1 to the playbook's FLOW_BLUEPRINTS
  // stage ids (rate_plan / plan_coverages / plan_benefits / review).
  get effectiveStageId() {
    if (this.activeStepId !== 'configure') return '';
    if (!this.activeSubStepId) return '';
    return this.activeSubStepId;
  }

  // Section-level routing - drives which child component the canvas
  // mounts and how the playbook is configured per section.
  // ── Landing ↔ Builder mode switch ────────────────────────────
  // The right area of the workspace shell renders one of two
  // views: a full-width Landing (template tiles + New CTA) when
  // no template is being edited, or the existing 2-col Builder
  // (pipeline + config) when one is. Mode is derived from
  // activeStepId: the 'templates' / 'comp_templates' markers mean
  // Landing; every other step value means Builder.
  get isLandingMode() {
    return this.isTemplatesSection || this.isCompTemplatesSection;
  }
  get isBuilderMode() {
    return !!this.activeStepId && !this.isLandingMode;
  }
  get landingTitle() {
    return this.activePartId === 'comparison_table_setup'
      ? 'Comparison Templates'
      : 'RFQ Templates';
  }
  get landingSub() {
    return this.activePartId === 'comparison_table_setup'
      ? 'Pick an existing comparison template to edit, or create a new one.'
      : 'Pick an existing RFQ template to edit, or create a new one.';
  }
  get isTemplatesSection()  { return this.activeStepId === 'templates'; }
  get isInitializeSection() { return this.activeStepId === 'initialize'; }
  get isConfigureSection()  { return this.activeStepId === 'configure'; }
  get isPublishSection()    { return this.activeStepId === 'publish'; }
  // True when the admin is anywhere inside the inline RFQ wizard
  // (Initialize / Configure / Publish) so the workspace can route
  // Cancel back to the Templates dashboard instead of dismissing.
  get isInsideRfqWizard() {
    return this.isInitializeSection
      || this.isConfigureSection
      || this.isPublishSection;
  }
  // Comparison setup section routing.
  get isCompTemplatesSection() { return this.activeStepId === 'comp_templates'; }
  get isCompInitSection()      { return this.activeStepId === 'comp_init'; }
  get isCompSummarySection()   { return this.activeStepId === 'comp_summary'; }
  get isCompMetricsSection()   { return this.activeStepId === 'comp_metrics'; }
  get isCompLogicSection()     { return this.activeStepId === 'comp_logic'; }
  get isInsideComparisonWizard() {
    return this.isCompInitSection
      || this.isCompSummarySection
      || this.isCompMetricsSection
      || this.isCompLogicSection;
  }
  // Map workspace section id → c-quote-compare-setup wizard step
  // key ('init', 'summary', 'metrics', 'logic'). Drives the
  // activeWizardStep @api on the embedded mount.
  get effectiveComparisonWizardStep() {
    switch (this.activeStepId) {
      case 'comp_init':    return 'init';
      case 'comp_summary': return 'summary';
      case 'comp_metrics': return 'metrics';
      case 'comp_logic':   return 'logic';
      default:             return null;
    }
  }
  // Templates dashboards are the "screen zero" for each flow - they
  // render full-canvas with no side nav or wizard footer so the
  // tile grid + "+ New Template" CTA read as the landing experience.
  // The wizard chrome (side nav + Previous/Proceed footer) only
  // appears once the admin enters the wizard via "+ New" or Edit.
  get isOnDashboard() {
    return this.isTemplatesSection || this.isCompTemplatesSection;
  }
  // Suppress the outer .isw-canvas__crumb H2 for the two Comparison
  // Template stages that render their own title row inline with a
  // live-preview toggle (Fixed Summary Widgets, Metric Selection &
  // Order). Without this the same title appears twice - once here
  // as the crumb H2, once inside the wizard as the h3 - and the
  // toggle floats a row below its title. See
  // quoteCompareSetup.showPanelTitle for the paired condition.
  get showStepCrumb() {
    if (this.isCompQuoteCompare) {
      const s = this.effectiveComparisonWizardStep;
      if (s === 'summary' || s === 'metrics') return false;
    }
    return true;
  }
  // When the active part has only one section AND that section has
  // no substeps, the left side-panel nav would just echo a single
  // item - wasted column. Skip it and let the mounted component
  // fill the canvas width; the component's own header carries the
  // section context. Also skipped when the admin is on a Templates
  // dashboard so it reads as a clean screen-zero.
  get showSectionsNav() {
    if (this.isOnDashboard) return false;
    const sections = this.activePartSections;
    if (sections.length > 1) return true;
    if (sections.length === 1 && sections[0].showSubSteps) return true;
    if (sections.length === 1 && Array.isArray(sections[0].subSteps)
      && sections[0].subSteps.length > 0) return true;
    return false;
  }
  get panelBodyClass() {
    return this.showSectionsNav
      ? 'isw-panel__body'
      : 'isw-panel__body isw-panel__body_full';
  }
  // Panel header now always renders - it carries the part label on
  // the left and the close X on the right, so it doubles as a
  // navigation surface even on Templates dashboards where the side
  // nav is hidden.
  get showPanelHead() {
    return true;
  }
  // Cancel / Previous / Proceed footer is wizard-specific. On a
  // Templates dashboard the tile actions (+ New, Edit, Activate,
  // etc.) drive navigation, so suppress the footer entirely.
  get showWorkspaceFooter() {
    return !this.isOnDashboard;
  }
  // Playbook mounts for both Initialize (picker + hierarchy) and
  // Configure (substep stage routing). Publish mounts the dedicated
  // publish-template component; Templates mounts the dashboard.
  get isCompRfqPlaybookMount() {
    // Initialize + Configure both route through c-rfq-playbook-setup,
    // EXCEPT when the active substep has its own component override
    // (e.g. the renamed "Broker Review & Handoff" substep mounts
    // c-review-handoff-setup instead). Without this guard both mounts
    // would render simultaneously when the review substep is active.
    if (this.isCompReviewHandoff) return false;
    if (this.isCompCoverageLimits) return false;
    return this.isInitializeSection || this.isConfigureSection;
  }
  get isCompPublishMount() {
    return this.isPublishSection;
  }
  get isCompRfqTemplateListMount() {
    return this.isTemplatesSection;
  }
  // Picker visibility - visible only on Initialize (where the user
  // picks the Root Product). On Configure / Publish the selection
  // already persists in the playbook's internal state.
  get hidePlaybookPicker() {
    return !this.isInitializeSection;
  }

  // ── Handlers ────────────────────────────────────────────────
  handleRootProductChange(event) {
    const next = (event.detail && event.detail.value) || null;
    this.selectedRootProduct = next;
    // Unlocking with no active part pre-selects the first part + its
    // first section so the canvas isn't an empty void. If a part was
    // already active, keep it.
    if (next && !this.activePartId) {
      const firstPart = this._activeParts[0];
      if (firstPart) {
        this.activePartId = firstPart.id;
        this.activeStepId = firstPart.steps[0] ? firstPart.steps[0].id : null;
      }
    }
  }

  // ── Sidebar nav (categories) ────────────────────────────────
  // Click a category in the left sidebar → switch active category
  // AND reset the canvas to the widget grid (activeStepId=null).
  handleSidebarClick(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this._selectPart(id);
  }
  handleSidebarKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this._selectPart(id);
  }

  // ── Canvas widget grid → step config ─────────────────────────
  // Click a widget card on the canvas → drill into its config UI.
  // Each card carries `data-section-id` AND (optionally)
  // `data-sub-step-id` so one handler updates both state slots
  // whether the card represents a top-level section or a flattened
  // substep (e.g. "Plan Coverages" under Configure).
  handleWidgetStepClick(event) {
    const sectionId = event.currentTarget.dataset.sectionId;
    if (!sectionId) return;
    const subStepId = event.currentTarget.dataset.subStepId || null;
    // Progressive-disclosure guard - locked cards (everything past
    // the first step until the part is saved) are no-ops here even
    // though CSS already pointer-events: none them. Defense in depth
    // also covers keyboard activation via Enter / Space.
    if (
      this._isCardLocked(sectionId, subStepId) &&
      !this._isFirstStepOfActivePart(sectionId, subStepId)
    ) {
      return;
    }
    this.activeStepId = sectionId;
    this.activeSubStepId = subStepId;
  }
  _isFirstStepOfActivePart(sectionId, subStepId) {
    // "First step" here means the Builder's first step (Initialize /
    // comp_init) - the one card that's never locked even when the
    // progressive-disclosure rule is active. NOT the FIRST_STEP_BY_PART
    // landing marker (that's for Cancel routing).
    return (
      sectionId === FIRST_BUILDER_STEP_BY_PART[this.activePartId] &&
      !subStepId
    );
  }
  _isCardLocked(sectionId, subStepId) {
    // Mirror the rule in _widgetCardEntry - non-Initialize cards
    // lock ONLY while the Builder's first step is the active one.
    const builderFirstId = FIRST_BUILDER_STEP_BY_PART[this.activePartId];
    if (!builderFirstId) return false;
    const isFirstStep = sectionId === builderFirstId && !subStepId;
    const firstStepIsActive = this.activeStepId === builderFirstId &&
      !this.activeSubStepId;
    return !isFirstStep && firstStepIsActive;
  }
  handleWidgetStepKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.handleWidgetStepClick(event);
  }

  // ── Detail-pane action row: Cancel / Previous / Next ─────────
  // Next advances to the next visible card in the pipeline.
  // Previous goes one step back. Leaving the first card auto-
  // unlocks the rest (lock logic is purely "is the first step the
  // active one"). Cancel drops the broker back to the first card.
  get isFooterNextDisabled() {
    // On the Comparison wizard's final step the primary CTA is the
    // wizard save (not step navigation), so it's always actionable -
    // the wizard itself gates publish via its own validation. All
    // other steps keep the "advance to next card" rule.
    if (this.isCompLogicSection) return false;
    return !this.activePartId || !this._nextVisibleCardKey;
  }
  get isFooterPreviousDisabled() {
    return !this.activePartId || !this._previousVisibleCardKey;
  }
  get footerNextLabel() {
    // Comparison wizard's Stage 3 folds the wizard's Save CTA into
    // this footer button (replacing the disabled Next). Label mirrors
    // the wizard's own nextLabel getter for edit vs new flows.
    if (this.isCompLogicSection) {
      return this.editingComparisonTemplateId
        ? 'Save Changes'
        : 'Save & Activate Template';
    }
    return 'Next';
  }
  // Card immediately after the active one in the pipeline. Null
  // when the active card is already the last visible card.
  get _nextVisibleCardKey() {
    const widgets = this.activeCategoryWidgets;
    if (!widgets.length) return null;
    const idx = this._activeWidgetIndex(widgets);
    if (idx === -1 || idx >= widgets.length - 1) return null;
    return widgets[idx + 1];
  }
  // Card immediately before the active one in the pipeline. Null
  // when the active card is the first (Templates) - Previous is
  // disabled there because there's nowhere earlier to go.
  get _previousVisibleCardKey() {
    const widgets = this.activeCategoryWidgets;
    if (!widgets.length) return null;
    const idx = this._activeWidgetIndex(widgets);
    if (idx <= 0) return null;
    return widgets[idx - 1];
  }
  _activeWidgetIndex(widgets) {
    const activeKey = this.activeSubStepId
      ? `${this.activeStepId}::${this.activeSubStepId}`
      : this.activeStepId;
    return activeKey
      ? widgets.findIndex((w) => w.key === activeKey)
      : -1;
  }
  handleFooterNext() {
    if (this.isFooterNextDisabled) return;
    // Comparison wizard's Stage 3: the primary CTA is Save & Activate
    // (or Save Changes when editing). Delegate to the embedded
    // wizard's @api save(); it fires the same publish path the
    // legacy in-panel button did, and its own configurationsave event
    // still routes us back to the Templates dashboard via
    // handleConfigurationSave.
    if (this.isCompLogicSection) {
      const wizard = this.refs && this.refs.compareWizard;
      if (wizard && typeof wizard.save === 'function') {
        wizard.save();
      }
      return;
    }
    const next = this._nextVisibleCardKey;
    if (!next) return;
    this.activeStepId = next.sectionId;
    this.activeSubStepId = next.subStepId || null;
  }
  handleFooterPrevious() {
    if (this.isFooterPreviousDisabled) return;
    const prev = this._previousVisibleCardKey;
    if (!prev) return;
    this.activeStepId = prev.sectionId;
    this.activeSubStepId = prev.subStepId || null;
  }
  handleFooterCancel() {
    // Drop the active selection back to the first step (Templates /
    // comp_templates / integrations). Re-locks the rest of the
    // pipeline since the lock rule keys off "first step is active".
    this.activeStepId = FIRST_STEP_BY_PART[this.activePartId] || null;
    this.activeSubStepId = null;
  }


  // Top-level part click - open the part panel and auto-select its
  // first section. Skip if locked or already on this part (idempotent).
  handlePartClick(event) {
    if (this.isLocked) return;
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    if (this.activePartId === id) return;
    this._selectPart(id);
  }
  handlePartKeydown(event) {
    if (this.isLocked) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this._selectPart(id);
  }
  _selectPart(partId) {
    const part = this._activeParts.find((p) => p.id === partId);
    if (!part) return;
    // Honour the per-part `disabled` flag so a stale URL or
    // programmatic select can't jump the user into a part that's
    // visually greyed out.
    if (part.disabled) return;
    this.activePartId = part.id;
    // Auto-land on the first step (Initialize / comp_init /
    // integrations) so the broker sees the progressive-disclosure
    // gate immediately instead of an empty detail pane.
    const firstId = FIRST_STEP_BY_PART[part.id];
    this.activeStepId = firstId || null;
    this.activeSubStepId = null;
  }

  // Sub-section click inside the active part panel - kept the legacy
  // handleStepClick name to minimise template churn. Also primes the
  // 3rd-level activeSubStepId to the section's first sub-substep so
  // sections that expose substeps (e.g. Product Catalog Definition)
  // land on a meaningful default.
  handleStepClick(event) {
    if (this.isLocked) return;
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this._selectSection(id);
  }
  handleStepKeydown(event) {
    if (this.isLocked) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this._selectSection(id);
  }
  _selectSection(sectionId) {
    this.activeStepId = sectionId;
    // Don't auto-pick a substep - let the user choose explicitly.
    // The right panel falls back to the playbook's default view
    // (Product Hierarchy if a Root Product is picked, picker
    // otherwise) until the admin clicks a substep.
    this.activeSubStepId = null;
  }

  // Sub-substep click (3rd-level nav inside Product Catalog Definition).
  // Pushed down to c-rfq-playbook-setup via the `stage-id` @api so the
  // playbook's right config panel renders the picked stage.
  handleSubStepClick(event) {
    if (this.isLocked) return;
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this.activeSubStepId = id;
  }
  handleSubStepKeydown(event) {
    if (this.isLocked) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this.activeSubStepId = id;
  }

  // ── Footer navigation (Previous · Cancel · Proceed) ───────
  // Walks the active part's sections + their substeps as a single
  // linear sequence so the admin can step through the whole part
  // without clicking individual rows in the side panel. Cancel
  // bubbles a `workspacecancel` event the host can wire to its own
  // close / dismiss behaviour.

  // Linear list of nav points across the active part - flattens
  // sections that have substeps into one entry per substep, and
  // sections without substeps into a single section-level entry.
  get _navPoints() {
    const part = this.activePart;
    if (!part) return [];
    const points = [];
    for (const s of part.steps) {
      if (Array.isArray(s.subSteps) && s.subSteps.length > 0) {
        for (const ss of s.subSteps) {
          points.push({ sectionId: s.id, subStepId: ss.id });
        }
      } else {
        points.push({ sectionId: s.id, subStepId: null });
      }
    }
    return points;
  }
  get _currentNavIndex() {
    const points = this._navPoints;
    return points.findIndex(
      (p) =>
        p.sectionId === this.activeStepId &&
        // Substep match: equal OR both nullish (no substep on this section)
        (p.subStepId === this.activeSubStepId ||
          (!p.subStepId && !this._sectionHasSubSteps(p.sectionId)))
    );
  }
  _sectionHasSubSteps(sectionId) {
    const part = this.activePart;
    if (!part) return false;
    const s = part.steps.find((x) => x.id === sectionId);
    return !!(s && Array.isArray(s.subSteps) && s.subSteps.length > 0);
  }

  get canGoPrevious() {
    // idx === -1 means "no substep selected yet" - there's nothing
    // before that, so Previous stays disabled.
    return this._currentNavIndex > 0;
  }
  get canProceed() {
    const idx = this._currentNavIndex;
    const points = this._navPoints;
    if (points.length === 0) return false;
    // Initial state - no substep picked yet but the section has
    // substeps. Proceed should advance to the section's first nav
    // point (handled in handleProceed).
    if (idx === -1) return true;
    return idx < points.length - 1;
  }
  // Disabled-state mirrors for the template (LWC button disabled
  // attribute reads true/false from these).
  get previousDisabled() {
    return !this.canGoPrevious;
  }
  get proceedDisabled() {
    return !this.canProceed;
  }

  handlePrevious() {
    if (!this.canGoPrevious) return;
    const next = this._navPoints[this._currentNavIndex - 1];
    if (!next) return;
    this._applyNavPoint(next);
  }
  handleProceed() {
    if (!this.canProceed) return;
    const idx = this._currentNavIndex;
    // idx === -1 → no substep selected yet (initial state). Land on
    // the first nav point belonging to the active section so the
    // admin steps into 1.1 (or whatever the section's first substep
    // is) instead of jumping past it.
    let next;
    if (idx === -1) {
      next = this._navPoints.find((p) => p.sectionId === this.activeStepId)
        || this._navPoints[0];
    } else {
      next = this._navPoints[idx + 1];
    }
    if (!next) return;
    this._applyNavPoint(next);
  }
  handleCancel() {
    // Cancel from anywhere inside an inline wizard returns the admin
    // to that wizard's dashboard section instead of dismissing the
    // workspace, so existing context is preserved while discarding
    // current wizard state.
    if (this.isInsideRfqWizard) {
      this.editingRfqTemplateId = null;
      this.activeStepId = 'templates';
      this.activeSubStepId = null;
      return;
    }
    if (this.isInsideComparisonWizard) {
      this.editingComparisonTemplateId = null;
      this.activeStepId = 'comp_templates';
      this.activeSubStepId = null;
      return;
    }
    this.dispatchEvent(
      new CustomEvent('workspacecancel', {
        bubbles: true,
        composed: true
      })
    );
  }

  // ── RFQ Templates dashboard ↔ wizard bridge ────────────────
  // The Templates dashboard (c-rfq-template-list) bubbles
  // `templatepick` (Edit) and `templatenew` (+ New). The workspace
  // seeds editing context and walks the admin into the first wizard
  // section (Initialize).
  handleRfqTemplatePick(event) {
    const id = (event && event.detail && event.detail.id) || null;
    this.editingRfqTemplateId = id;
    // Edit flow reads LOB/LOC from the saved template - clear any
    // stale seeds from a prior + New so the playbook hydrates from
    // template state, not the leftover modal picks.
    this._seededRfqLob = null;
    this._seededRfqLoc = null;
    this.activeStepId = 'initialize';
    this.activeSubStepId = null;
  }
  handleRfqTemplateNew() {
    // + New now opens the pre-builder modal first. After
    // Continue, _handleTemplateInitContinue switches the
    // workspace into builder mode with the picked LOB/LOC seeded.
    this._templateInitModalKind = 'rfq';
    this._templateInitModalOpen = true;
  }

  // ── Comparison Templates dashboard ↔ wizard bridge ─────────
  handleComparisonTemplatePick(event) {
    const id = (event && event.detail && event.detail.id) || null;
    this.editingComparisonTemplateId = id;
    this._seededCompareLob = null;
    this._seededCompareLoc = null;
    this.activeStepId = 'comp_init';
    this.activeSubStepId = null;
  }
  handleComparisonTemplateNew() {
    this._templateInitModalKind = 'compare';
    this._templateInitModalOpen = true;
  }

  // ── Pre-builder LOB/LOC modal ──────────────────────────────
  handleTemplateInitContinue(event) {
    const detail = (event && event.detail) || {};
    const lob = detail.lob || null;
    const loc = detail.loc || null;
    if (this._templateInitModalKind === 'compare') {
      this.editingComparisonTemplateId = null;
      this._seededCompareLob = lob;
      this._seededCompareLoc = loc;
      this.activeStepId = 'comp_init';
    } else {
      this.editingRfqTemplateId = null;
      this._seededRfqLob = lob;
      this._seededRfqLoc = loc;
      this.activeStepId = 'initialize';
    }
    this.activeSubStepId = null;
    this._templateInitModalOpen = false;
  }
  handleTemplateInitCancel() {
    this._templateInitModalOpen = false;
  }
  _applyNavPoint(point) {
    this.activeStepId = point.sectionId;
    // Keep activeSubStepId aligned: explicit value when the new
    // section has substeps, falls back to its first substep otherwise.
    if (point.subStepId) {
      this.activeSubStepId = point.subStepId;
    } else if (!this._sectionHasSubSteps(point.sectionId)) {
      // section without substeps - leave activeSubStepId alone so
      // a later return to Product Catalog Definition restores the
      // last picked substep there.
    }
  }

  // Uniform sink for child `configurationsave` events. Per the
  // directive, this is the single hook for global toasts / validation;
  // re-dispatches so any host (e.g. agentforceSetup) can listen.
  // Side-effect: after a successful Publish the workspace routes the
  // admin back to the Templates dashboard so they immediately see
  // their saved template in the tile grid.
  // c-rfq-playbook-setup bubbles `assignmentschange` whenever the
  // broker mutates the playbook's wizard pick (LOB / LOC / Root
  // Product). Pull the effective LOB so we can swap the Configure
  // substep list to the right per-LOB shape.
  handlePlaybookAssignmentsChange(event) {
    const detail = (event && event.detail) || {};
    const assignments = detail.assignments || {};
    const nextLob = assignments.lob || null;
    if (this._brokerLob !== nextLob) {
      this._brokerLob = nextLob;
    }
  }

  handleConfigurationSave(event) {
    const detail = (event && event.detail) || {};
    if (detail.source === 'rfqPublishTemplate') {
      this.editingRfqTemplateId = null;
      this.activeStepId = 'templates';
      this.activeSubStepId = null;
    } else if (detail.source === 'quoteCompareSetup') {
      this.editingComparisonTemplateId = null;
      this.activeStepId = 'comp_templates';
      this.activeSubStepId = null;
    }
    this.dispatchEvent(
      new CustomEvent('configurationsave', {
        detail: {
          ...detail,
          rootProduct: detail.rootProduct || this.selectedRootProduct,
          activeStepId: this.activeStepId
        },
        bubbles: true,
        composed: true
      })
    );
  }
}
