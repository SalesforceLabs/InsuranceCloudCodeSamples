import { LightningElement, api, track } from 'lwc';
import {
  SUMMARY_WIDGET_DEFS,
  METRICS_BY_TAB,
  getTemplates,
  addTemplate,
  updateTemplate,
  removeTemplate
} from 'data/comparisonTemplates';
import {
  ALL_VALUE,
  DEFAULT_SORT,
  SORT_OPTIONS,
  buildLobOptions,
  buildLocOptions,
  locIsValid,
  filterAndSort
} from 'data/templateScope';
import { formatUsDate, todayIso } from 'data/dates';

// ─────────────────────────────────────────────────────────────────────────
// c-quote-compare-setup
//
// Dashboard + 4-step Comparison Template wizard. Mounts inside the Setup
// chrome (c-agentforce-setup) when the broker picks the "Quote Compare
// Setup" sidebar item. Mirrors the visual language of c-agentforce-setup
// but configures comparison matrices, not RFQ collection templates.
//
// Template catalog (id, lob, loc, summaryWidgets, selectedMetricIds,
// ordering) lives in data/comparisonTemplates so the playbook's
// Quote Comparison stage can read the same store and render a lo-fi
// preview of what brokers will see at quote presentation time.
//
// Stages: 0 Initialize · 1 Fixed Summary Widgets · 2 Metric Selection &
// Order · 3 Logic & Publish.
// ─────────────────────────────────────────────────────────────────────────

const STEPS = ['init', 'summary', 'metrics', 'logic'];

// Scoped to Personal Lines + Group Benefits only - Commercial Lines
// is out of scope for this build.
const LOB_OPTIONS = [
  { value: 'PERSONAL_LINES', label: 'Personal Lines' },
  { value: 'GROUP_BENEFITS', label: 'Group Benefits' }
];

// Coverage options narrow on the picked LOB. Catalog surfaces Auto,
// Home/Dwelling, Medical, Dental, Vision - bucketed under their
// natural LOB so the picker stays scoped.
const LOC_OPTIONS_BY_LOB = {
  PERSONAL_LINES: [
    { value: 'AUTO', label: 'Auto' },
    { value: 'HOME', label: 'Home/Dwelling' }
  ],
  GROUP_BENEFITS: [
    { value: 'MEDICAL', label: 'Medical' },
    { value: 'DENTAL',  label: 'Dental' },
    { value: 'VISION',  label: 'Vision' }
  ]
};

// Root Product catalog keyed by `${LOB}::${LOC}` - each LOB+LOC
// pair narrows down to a specific set of technical products the
// admin can scope the comparison template against. Empty / missing
// keys surface as an empty picker (broker hasn't picked LOB+LOC
// yet, or the pair has no products wired). Demo set - extend as
// new templates come online.
const ROOT_PRODUCTS_BY_LOB_LOC = {
  'PERSONAL_LINES::AUTO': [
    { value: 'pl_auto_silver', label: 'Personal Auto Silver Template' },
    { value: 'pl_auto_gold',   label: 'Personal Auto Gold Template' }
  ],
  'PERSONAL_LINES::HOME': [
    { value: 'pl_home_base',   label: 'Personal Home Base Template' }
  ],
  'COMMERCIAL_LINES::PROPERTY': [
    { value: 'smb_bop',        label: 'SMB BOP Template' }
  ],
  'GROUP_BENEFITS::MEDICAL': [
    { value: 'gb_medical',     label: 'Group Medical Template' }
  ],
  'GROUP_BENEFITS::DENTAL': [
    { value: 'gb_dental',      label: 'Group Dental Base Template' }
  ],
  'GROUP_BENEFITS::VISION': [
    { value: 'gb_vision',      label: 'Group Vision Base Template' }
  ]
};

// SUMMARY_WIDGET_DEFS and METRICS_BY_TAB are imported from
// data/comparisonTemplates so the playbook's Quote Comparison preview
// reads the same definitions without duplication.

const AGENT_MODULES = [
  { value: 'mkt-analyst-2.4', label: 'Agentforce Market Analyst v2.4' },
  { value: 'fsc-quoting',     label: 'FSC Commercial Quoting Assistant' }
];

// Cross-read source: which fields the RFQ collection template captures
// for each LOB+LOC pair. Intentionally narrow so picking a metric outside
// this set deterministically surfaces the warning banner - e.g.,
// "Maximum Deductible" on Auto fires the alert because the RFQ template
// only collects "Minimum Deductible".
const RFQ_FIELDS_BY_LOC = {
  'PERSONAL_LINES::AUTO': new Set([
    'bodily-injury',
    'property-damage',
    'collision-deductible-min',
    'um-coverage'
  ]),
  'PERSONAL_LINES::HOME': new Set([
    'property-damage'
  ]),
  'GROUP_BENEFITS::MEDICAL': new Set([
    'office-visit-copay',
    'specialist-copay',
    'rx-tier'
  ]),
  'GROUP_BENEFITS::DENTAL': new Set([
    'office-visit-copay'
  ])
};

// Templates are sourced from data/comparisonTemplates so saves done
// here are visible to the playbook's Quote Comparison preview.

const _formatLiveSince = (iso) => formatUsDate(iso);

const _badgeForLob = (lob) => {
  switch (lob) {
    case 'PERSONAL_LINES':   return 'PERSONAL LINES';
    case 'COMMERCIAL_LINES': return 'COMMERCIAL LINES';
    case 'GROUP_BENEFITS':   return 'GROUP BENEFITS';
    default:                 return '';
  }
};

const _nameForLobLoc = (lob, loc) => {
  const lobLabel = (LOB_OPTIONS.find((o) => o.value === lob) || {}).label || '';
  const locLabel = (
    (LOC_OPTIONS_BY_LOB[lob] || []).find((o) => o.value === loc) || {}
  ).label || '';
  if (!lobLabel && !locLabel) return 'Comparison Template';
  return `${lobLabel}${locLabel ? ` - ${locLabel}` : ''} Comparison`;
};

export default class QuoteCompareSetup extends LightningElement {
  // ── Public API (embedded mode) ─────────────────────────────
  // When the workspace hosts the wizard inline (Comparison Setup
  // part), it sets `embedded` so the component hides its dashboard
  // and wizard modal chrome, and reads `activeWizardStep` to render
  // a specific wizard panel inline. The workspace's footer drives
  // navigation; this component just renders the requested panel.
  _embedded = false;
  _activeWizardStep = null;
  _embeddingHydrated = false;
  _seededNewEmbeddedDefaults = false;

  @api
  get embedded() {
    return this._embedded;
  }
  set embedded(value) {
    this._embedded = !!value;
    if (this._embedded) {
      this.wizardOpen = true;
      this._hydrateFromEditingTemplateIfReady();
    }
  }
  // True when the host workspace's `.isw-canvas__crumb` already
  // shows the active step's title - so each wizard panel should
  // suppress its own `qcs-wizard__panel-title` h3 to avoid the
  // "double header" effect. Exception: on the two live-preview
  // stages (summary, metrics) the wizard owns its own title row
  // (title + live-preview toggle side-by-side on the same
  // horizontal axis) so the h3 must render even when embedded;
  // the outer workspace suppresses its own crumb H2 for these
  // steps in tandem (see insuranceSetupWorkspace.showStepCrumb).
  get showPanelTitle() {
    if (!this._embedded || this._wizardOnly) return true;
    return this.isStepSummary || this.isStepMetrics;
  }
  @api
  get activeWizardStep() {
    return this._activeWizardStep;
  }
  set activeWizardStep(value) {
    const next = value || null;
    this._activeWizardStep = next;
    if (!next) return;
    const idx = STEPS.indexOf(next);
    if (idx === -1) return;
    if (idx === this.wizardStepIdx) return;
    this.wizardStepIdx = idx;
  }
  // @api template-id-prop wires through to the existing internal
  // `editingTemplateId` @track field via a side-channel name to avoid
  // an @api/@track collision on the same identifier.
  @api
  get templateIdProp() {
    return this._incomingTemplateId || null;
  }
  set templateIdProp(value) {
    const next = value || null;
    if (this._incomingTemplateId === next) return;
    this._incomingTemplateId = next;
    if (this._embedded) {
      this._hydrateFromEditingTemplateIfReady();
    }
  }
  _incomingTemplateId = null;

  // Host-owned dashboard mode. A host that already renders its own
  // Comparison Templates dashboard (c-setup-home mounts
  // c-comparison-template-list) sets `wizard-only` so the built-in
  // tile grid drops out and this component contributes nothing but
  // the wizard modal, stepper, footer and publish path included.
  // Unlike `embedded`, no step state is handed over. It opens on a
  // fresh + New wizard at mount and bubbles `wizardclose` when the
  // admin dismisses it, so the host can unmount and re-read the
  // catalog.
  _wizardOnly = false;
  @api
  get wizardOnly() {
    return this._wizardOnly;
  }
  set wizardOnly(value) {
    this._wizardOnly = !!value;
  }

  connectedCallback() {
    if (this._wizardOnly) this.handleNewTemplate();
  }

  // ── Embedded-mode gating ───────────────────────────────────
  get isEmbedded() {
    return this._embedded;
  }
  get isDashboardVisible() {
    return !this._embedded && !this._wizardOnly;
  }
  // `embedded` and `wizardOnly` answer two different questions.
  // `embedded` = "am I an overlay or page content"; `wizardOnly` =
  // "who owns the stepper, footer and close affordance". The
  // workspace mount sets embedded alone and supplies its own crumb +
  // footer, so this component contributes only the step body. The
  // Setup mount sets both: page content, but nothing around it, so
  // the stepper and footer have to stay.
  get isHostChromeOwner() {
    return this._embedded && !this._wizardOnly;
  }
  // Stepper column + Cancel / Previous / Next footer.
  get showWizardChrome() {
    return !this.isHostChromeOwner;
  }
  // Backdrop + "New Comparison Template" title bar with the X. Only
  // the overlay presentation carries these.
  get showModalChrome() {
    return !this._embedded;
  }
  // The org's inline chrome: a "Back to Templates" link at the top of
  // the right panel. The step name is not repeated here; the panel
  // title below already carries it.
  get showCanvasHead() {
    return this._embedded && this._wizardOnly;
  }
  get wizardRole() {
    return this._embedded ? null : 'dialog';
  }
  get wizardAriaModal() {
    return this._embedded ? null : 'true';
  }
  get wizardLabelledBy() {
    return this._embedded ? null : 'qcs-wizard-title';
  }
  get wizardWrapperClass() {
    return this._embedded
      ? 'qcs-wizard qcs-wizard_embedded'
      : 'qcs-wizard qcs-wizard_open';
  }
  get wizardContainerClass() {
    if (!this._embedded) return 'qcs-wizard__container';
    const base = 'qcs-wizard__container qcs-wizard__container_embedded';
    return this._wizardOnly ? `${base} qcs-wizard__container_card` : base;
  }
  get wizardBodyClass() {
    return this.isHostChromeOwner
      ? 'qcs-wizard__body qcs-wizard__body_embedded'
      : 'qcs-wizard__body';
  }

  _hydrateFromEditingTemplateIfReady() {
    // Hydrate state from the editing record exactly once per id flip
    // so the workspace's stepwise navigation doesn't reset edits
    // every time the @api setter fires.
    const id = this._incomingTemplateId;
    if (!id) {
      // + New flow inside embedded mode - keep defaults but flag as
      // "wizard open" so the panels render. Seed day-zero all-checked
      // once (guarded so the admin's unchecks aren't wiped on every
      // downstream re-render of the workspace).
      this.editingTemplateId = null;
      this._embeddingHydrated = false;
      if (!this._seededNewEmbeddedDefaults) {
        const allIds = this._allMetricIds();
        this.selectedMetricIds = allIds.slice();
        this.ordering = allIds.slice();
        this._seededNewEmbeddedDefaults = true;
      }
      return;
    }
    if (this._embeddingHydrated && this.editingTemplateId === id) return;
    const tpl = this.templates.find((t) => t.id === id)
      || (typeof getTemplates === 'function' ? getTemplates().find((t) => t.id === id) : null);
    if (!tpl) return;
    this.editingTemplateId = id;
    this.wizardLob = tpl.lob || null;
    this.wizardLoc = tpl.loc || null;
    this.wizardRootProduct = tpl.rootProduct || null;
    this.templateMode = null;
    this.summaryWidgets = { ...(tpl.summaryWidgets || {
      carrier: true,
      premium: true,
      effective: true,
      commission: true
    }) };
    this.metricsTab = 'ipc';
    this.selectedMetricIds = (tpl.selectedMetricIds || []).slice();
    this.ordering = (tpl.ordering || []).slice();
    this.columnLimit = tpl.columnLimit ?? 2;
    this.agentforceOn = !!tpl.agentforceOn;
    this.agentforceModule = tpl.agentforceModule || null;
    this._embeddingHydrated = true;
  }

  // ── Dashboard state ────────────────────────────────────────
  // Sourced from data/comparisonTemplates so wizard saves are
  // visible to the playbook's Quote Comparison preview. Kept as
  // @track so dashboard tile getters re-evaluate after each mutation.
  @track templates = getTemplates();
  @track filterLob = ALL_VALUE;
  @track filterLoc = ALL_VALUE;
  @track sortBy = DEFAULT_SORT;
  sortOptions = SORT_OPTIONS;
  @track openMenuId = null;

  // ── Wizard state ───────────────────────────────────────────
  @track wizardOpen = false;
  @track wizardStepIdx = 0;
  // Set when the wizard was opened via a tile's "Edit" action - holds
  // the template id being edited so publish updates it in place instead
  // of creating a new template. Null for the "New Template" flow.
  @track editingTemplateId = null;
  // Stage 0
  @track wizardLob = null;
  @track wizardLoc = null;
  // Selected Root Product - third step in the LOB → LOC → Root
  // Product cascade. Locked (disabled) until both wizardLob and
  // wizardLoc are picked; clearing either parent resets this back
  // to null so the cascade can't leave orphaned downstream data.
  @track wizardRootProduct = null;

  // ── Seeded LOB / LOC from the workspace's pre-builder modal ──
  // Same pattern as c-rfq-playbook-setup - the workspace captures
  // LOB+LOC up front via the "+ New Template" modal and threads
  // them in. Setters write into wizardLob / wizardLoc so the
  // existing cascade (rootProductOptions, isRootProductDisabled,
  // nextDisabled) keeps working. The Initialize panel uses
  // `hideWizardPickers` to drop the LOB+LOC pickers in favor of
  // a compact summary chip.
  _seededLob = null;
  _seededLoc = null;
  @api
  get seededLob() { return this._seededLob; }
  set seededLob(v) {
    const next = v || null;
    if (this._seededLob === next) return;
    this._seededLob = next;
    if (next && this.wizardLob !== next) {
      this.wizardLob = next;
    }
  }
  @api
  get seededLoc() { return this._seededLoc; }
  set seededLoc(v) {
    const next = v || null;
    if (this._seededLoc === next) return;
    this._seededLoc = next;
    if (next && this.wizardLoc !== next) {
      this.wizardLoc = next;
    }
  }
  get hideWizardPickers() {
    return !!(this._seededLob && this._seededLoc);
  }
  get showWizardPickers() {
    return !this.hideWizardPickers;
  }
  get seededLobLabel() {
    const opt = (this.lobOptions || []).find((o) => o.value === this.wizardLob);
    return opt ? opt.label : '';
  }
  get seededLocLabel() {
    const opt = (this.locOptions || []).find((o) => o.value === this.wizardLoc);
    return opt ? opt.label : '';
  }
  @track templateMode = null;
  // Stage 1 - toggle map. Day-zero for a new template pre-selects
  // every summary widget so the admin sees the full catalog and
  // unchecks what they do not want (matches "Select All by
  // default; Show all not opened by default" rule across every
  // c-attribute-picker consumer).
  @track summaryWidgets = {
    carrier: true,
    premium: true,
    effective: true,
    commission: true
  };
  // Stage 2
  @track metricsTab = 'ipc';
  // Stored as a plain array so LWC reactivity is straightforward
  // (Set instances aren't deeply tracked). Day-zero for a new
  // template pre-selects every metric across both tabs; the admin
  // clicks Show all in the picker to reveal the list and unchecks
  // what they don't want.
  @track selectedMetricIds = [];
  @track ordering = [];
  // Stage 3
  @track columnLimit = 2;
  @track agentforceOn = false;
  @track agentforceModule = null;

  // Live-preview toggle - independent state per wizard stage so
  // toggling the preview on Fixed Summary Widgets doesn't force it
  // on for Metric Selection & Order (and vice versa). Both default
  // to off - admin opts in when they want to see "how brokers see
  // this template"; keeps the editor surface uncluttered by
  // default. `_currentLivePreviewOn` selects the active-stage
  // value; the toggle handler + label getters delegate through it.
  @track livePreviewSummaryOn = false;
  @track livePreviewMetricsOn = false;

  // ── Dashboard tile decorators ──────────────────────────────
  get hasTemplates() {
    return this.templates.length > 0;
  }
  get filteredTemplates() {
    return filterAndSort(this.templates, {
      lob: this.filterLob,
      loc: this.filterLoc,
      sortBy: this.sortBy
    });
  }
  get hasVisibleTiles() {
    return this.filteredTemplates.length > 0;
  }
  get visibleCount() {
    return this.filteredTemplates.length;
  }
  get totalCount() {
    return this.templates.length;
  }
  get lobFilterOptions() {
    return buildLobOptions(this.templates);
  }
  get locFilterOptions() {
    return buildLocOptions(this.templates, this.filterLob);
  }
  handleFilterLob(event) {
    this.filterLob = event.detail.value;
    this._syncLocFilter();
  }
  handleFilterLoc(event) {
    this.filterLoc = event.detail.value;
  }
  handleFilterSort(event) {
    this.sortBy = event.detail.value;
  }
  handleClearFilters() {
    this.filterLob = ALL_VALUE;
    this.filterLoc = ALL_VALUE;
    this.sortBy = DEFAULT_SORT;
  }
  _syncLocFilter() {
    if (!locIsValid(this.templates, this.filterLob, this.filterLoc)) {
      this.filterLoc = ALL_VALUE;
    }
  }
  _refreshCatalog() {
    this.templates = getTemplates();
    if (!this.templates.length) {
      this.filterLob = ALL_VALUE;
      this.filterLoc = ALL_VALUE;
      this.sortBy = DEFAULT_SORT;
      return;
    }
    this._syncLocFilter();
  }
  get templateTiles() {
    return this.filteredTemplates.map((t) => {
      const isOpen = this.openMenuId === t.id;
      const isActive = !!t.isActive;
      const liveSinceLabel = _formatLiveSince(t.liveSince);
      const metaParts = [];
      if (t.version) metaParts.push(t.version);
      if (liveSinceLabel) metaParts.push(`Live since ${liveSinceLabel}`);
      return {
        ...t,
        initial: t.name.charAt(0),
        isOpen,
        isActive,
        activateLabel: isActive ? 'Deactivate' : 'Activate',
        statusBadge: isActive ? 'ACTIVE' : 'INACTIVE',
        metaLine: metaParts.join(' \u00b7 '),
        // `is-menu-open` lifts the tile (and its dropdown) above the
        // click-outside scrim so menu items stay clickable - the hover
        // transform / inactive opacity otherwise trap the menu in a
        // lower stacking context behind the scrim.
        tileClass: [
          'qcs-template',
          isActive ? '' : 'is-inactive',
          isOpen ? 'is-menu-open' : ''
        ]
          .filter(Boolean)
          .join(' '),
        statusBadgeClass: isActive
          ? 'qcs-template__status is-active'
          : 'qcs-template__status is-inactive',
        moreBtnClass: isOpen
          ? 'qcs-template__more is-open'
          : 'qcs-template__more'
      };
    });
  }

  // ── Dashboard handlers ─────────────────────────────────────
  handleToggleTemplateMenu(event) {
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    this.openMenuId = this.openMenuId === id ? null : id;
  }
  handleCloseMenu() {
    this.openMenuId = null;
  }
  handleActivateTemplate(event) {
    const id = event.currentTarget.dataset.id;
    const current = this.templates.find((t) => t.id === id);
    if (!current) return;
    updateTemplate(id, { isActive: !current.isActive });
    this._refreshCatalog();
    this.openMenuId = null;
  }
  handleEditTemplate(event) {
    const id = event.currentTarget.dataset.id;
    const tpl = this.templates.find((t) => t.id === id);
    this.openMenuId = null;
    if (!tpl) return;
    // Open the wizard pre-seeded with the template's full config so
    // the admin can refine summary widgets / metric selection /
    // ordering and publish updates the record in place.
    this.editingTemplateId = id;
    this.wizardOpen = true;
    this.wizardStepIdx = 0;
    this.wizardLob = tpl.lob || null;
    this.wizardLoc = tpl.loc || null;
    this.wizardRootProduct = tpl.rootProduct || null;
    this.templateMode = null;
    this.summaryWidgets = { ...(tpl.summaryWidgets || {
      carrier: true,
      premium: true,
      effective: true,
      commission: true
    }) };
    this.metricsTab = 'ipc';
    this.selectedMetricIds = (tpl.selectedMetricIds || []).slice();
    this.ordering = (tpl.ordering || []).slice();
    this.columnLimit = tpl.columnLimit ?? 2;
    this.agentforceOn = !!tpl.agentforceOn;
    this.agentforceModule = tpl.agentforceModule || null;
    // Surface intent to a host app as well.
    this.dispatchEvent(
      new CustomEvent('templateedit', {
        detail: { id },
        bubbles: true,
        composed: true
      })
    );
  }
  handleDeleteTemplate(event) {
    const id = event.currentTarget.dataset.id;
    removeTemplate(id);
    this._refreshCatalog();
    if (this.editingTemplateId === id) this.editingTemplateId = null;
    this.openMenuId = null;
  }
  handleCloneTemplate(event) {
    const id = event.currentTarget.dataset.id;
    const src = this.templates.find((t) => t.id === id);
    if (!src) return;
    const today = todayIso();
    addTemplate({
      ...src,
      id: `${src.id}-copy-${Date.now()}`,
      name: `${src.name} (Copy)`,
      version: 'v0.1',
      liveSince: today,
      isActive: false
    });
    this._refreshCatalog();
    this.openMenuId = null;
  }

  // ── Wizard open/close ──────────────────────────────────────
  handleNewTemplate() {
    this.wizardOpen = true;
    this.wizardStepIdx = 0;
    this.editingTemplateId = null;
    // A host that pre-captured the scope in the LOB/LOC modal keeps it;
    // the standalone dashboard button passes no seeds and starts blank.
    this.wizardLob = this._seededLob || null;
    this.wizardLoc = this._seededLoc || null;
    this.wizardRootProduct = null;
    this.templateMode = null;
    this.summaryWidgets = {
      carrier: true,
      premium: true,
      effective: true,
      commission: true
    };
    this.metricsTab = 'ipc';
    // Day-zero for a new template pre-selects every metric across
    // both tabs so the admin sees the full catalog and unchecks
    // what they don't want, per the scalable-attribute-list plan.
    const allIds = this._allMetricIds();
    this.selectedMetricIds = allIds.slice();
    this.ordering = allIds.slice();
    this.columnLimit = 2;
    this.agentforceOn = false;
    this.agentforceModule = null;
  }

  // Flat list of every metric id (ipc first, then ipcb) - used to
  // seed day-zero all-checked when a new template is opened.
  _allMetricIds() {
    const out = [];
    for (const tab of Object.keys(METRICS_BY_TAB)) {
      for (const m of METRICS_BY_TAB[tab]) out.push(m.id);
    }
    return out;
  }
  _metricIdsForTab(tab) {
    return (METRICS_BY_TAB[tab] || []).map((m) => m.id);
  }
  handleWizardClose() {
    this.wizardOpen = false;
    this.editingTemplateId = null;
    if (!this._wizardOnly) return;
    this.dispatchEvent(
      new CustomEvent('wizardclose', { bubbles: true, composed: true })
    );
  }

  get wizardTitle() {
    return this.editingTemplateId
      ? 'Edit Comparison Template'
      : 'New Comparison Template';
  }

  // ── Wizard navigation ──────────────────────────────────────
  get currentStep() {
    return STEPS[this.wizardStepIdx];
  }
  get isStepInit()    { return this.currentStep === 'init'; }
  get isStepSummary() { return this.currentStep === 'summary'; }
  get isStepMetrics() { return this.currentStep === 'metrics'; }
  get isStepLogic()   { return this.currentStep === 'logic'; }

  // ── Live preview pane (Stage 1 + Stage 2) ──────────────────
  // Sticky top-of-panel schematic so the admin can see which fields
  // anchor as Highlights (pinned KPI cards) vs scroll-through Body
  // Fields as they toggle summary widgets and metric ordering. Pure
  // read-only - derives entirely from existing summaryWidgets /
  // selectedMetricIds / ordering state. No data-model changes.
  // Stage 1 (Fixed Summary Widgets) shows Highlights in detail and
  // collapses Body Fields to a pill; Stage 2 (Metric Selection &
  // Order) inverts. Whichever stage is active gets the region it
  // actually edits rendered fully, and the other region as a chip.
  get canShowPreview() {
    return this.isStepSummary || this.isStepMetrics;
  }
  // Resolves the currently-active stage's live-preview flag so the
  // shared toggle + preview markup can stay stage-agnostic. Any
  // stage that doesn't own a preview reads as false (defensive).
  get _currentLivePreviewOn() {
    if (this.isStepSummary) return this.livePreviewSummaryOn;
    if (this.isStepMetrics) return this.livePreviewMetricsOn;
    return false;
  }
  get showPreview() {
    return this.canShowPreview && this._currentLivePreviewOn;
  }
  // Stage-scoped preview flags used by each stage's own preview
  // slot (see quoteCompareSetup.html). Rendering the preview inside
  // the stage template - rather than as a shared block above the
  // main panel - lets each stage's toggle drive its own preview
  // independently.
  get showSummaryPreview() {
    return this.isStepSummary && this.livePreviewSummaryOn;
  }
  get showMetricsPreview() {
    return this.isStepMetrics && this.livePreviewMetricsOn;
  }
  get showPreviewToggle() { return this.canShowPreview; }
  get livePreviewChecked() { return this._currentLivePreviewOn; }
  get livePreviewLabel() {
    return this._currentLivePreviewOn ? 'Live preview on' : 'Live preview off';
  }
  get livePreviewToggleClass() {
    return this._currentLivePreviewOn
      ? 'qcs-live-toggle__switch is-on'
      : 'qcs-live-toggle__switch';
  }
  get livePreviewAriaChecked() { return String(this._currentLivePreviewOn); }
  // Which preview region renders in full detail. Each stage owns
  // one region and only surfaces the other as a compact chip.
  get showHighlightsDetail() { return this.isStepSummary; }
  get showBodyDetail()       { return this.isStepMetrics; }
  // Chip copy for the collapsed region on the opposite side.
  get highlightsChipCount() {
    return SUMMARY_WIDGET_DEFS
      .filter((w) => !!this.summaryWidgets[w.id])
      .length;
  }
  get bodyChipCount() {
    return (this.selectedMetricIds || []).length;
  }
  get highlightsChipLabel() {
    const n = this.highlightsChipCount;
    return `${n} widget${n === 1 ? '' : 's'} pinned`;
  }
  get bodyChipLabel() {
    const n = this.bodyChipCount;
    return `${n} metric${n === 1 ? '' : 's'} scrolling`;
  }
  get panelClass() {
    return this.canShowPreview
      ? 'qcs-wizard__panel qcs-wizard__panel_split'
      : 'qcs-wizard__panel';
  }
  handleLivePreviewToggle() {
    if (this.isStepSummary) {
      this.livePreviewSummaryOn = !this.livePreviewSummaryOn;
    } else if (this.isStepMetrics) {
      this.livePreviewMetricsOn = !this.livePreviewMetricsOn;
    }
  }
  // Highlights row - always 4 slots so the layout doesn't reflow as
  // the admin enables/disables widgets. Filled slots carry the widget
  // label; empty slots render as dashed placeholders.
  get previewHighlights() {
    const filled = SUMMARY_WIDGET_DEFS
      .filter((w) => !!this.summaryWidgets[w.id])
      .slice(0, 4)
      .map((w, i) => ({
        slotIdx: i,
        label: w.label,
        cls: 'qcs-preview__hl is-filled'
      }));
    while (filled.length < 4) {
      filled.push({
        slotIdx: filled.length,
        label: '',
        cls: 'qcs-preview__hl is-empty'
      });
    }
    return filled;
  }
  // Body fields - ordered metric ids (filtered to the selected set),
  // resolved to labels from the per-tab catalog so brokers see what
  // the comparison body will actually render.
  get previewBodyFields() {
    const selected = new Set(this.selectedMetricIds || []);
    const byId = {};
    for (const tab of Object.keys(METRICS_BY_TAB)) {
      for (const m of METRICS_BY_TAB[tab]) {
        byId[m.id] = m.label;
      }
    }
    // `ordering` is the source of truth for body order; fall back to
    // `selectedMetricIds` insertion order when ordering is sparse.
    const order = (this.ordering && this.ordering.length)
      ? this.ordering
      : (this.selectedMetricIds || []);
    return order
      .filter((id) => selected.has(id))
      .map((id) => ({
        id,
        label: byId[id] || id,
        cls: 'qcs-preview__row'
      }));
  }
  get previewBodyEmpty() {
    return this.previewBodyFields.length === 0;
  }

  // Wizard sidebar - one numbered step per STEPS entry, so the rail's
  // numbering maps 1:1 onto wizardStepIdx and handleNext / nextDisabled
  // / isStepSummary / isStepMetrics need no branch changes.
  get wizardSteps() {
    const idx = this.wizardStepIdx;
    const stepFor = (id) => STEPS.indexOf(id);

    const steps = [
      { id: 'init',    label: 'Initialize',               sub: 'LOB & Coverage' },
      { id: 'summary', label: 'Fixed Summary Widgets',    sub: 'Pinned metrics' },
      { id: 'metrics', label: 'Metric Selection & Order', sub: 'Tree + ordering' },
      { id: 'logic',   label: 'Logic & Publish',          sub: 'Agentforce & guardrails' }
    ];

    return steps.map((s, i) => {
      const stepIdx = stepFor(s.id);
      const isActive = idx === stepIdx;
      const isDone = idx > stepIdx;

      return {
        ...s,
        index: i + 1,
        stepIdx,
        isActive,
        isDone,
        ariaCurrent: isActive ? 'step' : null,
        cls: isActive
          ? 'qcs-wizard__nav-step is-active'
          : isDone
            ? 'qcs-wizard__nav-step is-done'
            : 'qcs-wizard__nav-step',
        markCls: isActive
          ? 'qcs-wizard__nav-mark is-active'
          : isDone
            ? 'qcs-wizard__nav-mark is-done'
            : 'qcs-wizard__nav-mark'
      };
    });
  }

  get showPrevious() {
    return this.wizardStepIdx > 0;
  }
  // The canvas footer holds Previous on step one as a disabled control
  // so the button set does not reflow as the admin steps through.
  get showPreviousSlot() {
    return this.showCanvasHead || this.showPrevious;
  }
  get previousDisabled() {
    return !this.showPrevious;
  }
  get isFinalStep() {
    return this.wizardStepIdx === STEPS.length - 1;
  }
  get nextLabel() {
    if (this.isFinalStep) {
      return this.editingTemplateId ? 'Save Changes' : 'Save & Activate Template';
    }
    return 'Save & Next';
  }
  get nextDisabled() {
    if (this.isStepInit) {
      // LOB → LOC → Root Product cascade - all three are required
      // before the broker can advance past Initialize. Each one
      // gates the next picker via the cascading disabled state.
      if (!this.wizardLob || !this.wizardLoc || !this.wizardRootProduct) {
        return true;
      }
      return false;
    }
    if (this.isStepMetrics) {
      // Require at least one metric so the comparison matrix isn't empty.
      return this.selectedMetricIds.length === 0;
    }
    return false;
  }

  handleNext() {
    if (this.nextDisabled) return;
    if (this.isFinalStep) {
      this._publishTemplate();
      return;
    }
    this.wizardStepIdx += 1;
  }
  handlePrevious() {
    if (this.wizardStepIdx === 0) return;
    this.wizardStepIdx -= 1;
  }

  // Exposed so the embedding workspace footer's primary CTA can
  // fire the wizard's publish/save on the final step. Delegates to
  // the shared handleNext path so enable/disable + publish rules
  // stay a single source of truth; no-ops off the final step so a
  // stray call from the host can't accidentally advance the wizard.
  @api
  save() {
    if (!this.isFinalStep) return;
    this.handleNext();
  }

  // ── Stage 0 ────────────────────────────────────────────────
  get lobOptions() {
    return LOB_OPTIONS.map((o) => ({
      ...o,
      selected: this.wizardLob === o.value
    }));
  }
  get locOptions() {
    if (!this.wizardLob) return [];
    return (LOC_OPTIONS_BY_LOB[this.wizardLob] || []).map((o) => ({
      ...o,
      selected: this.wizardLoc === o.value
    }));
  }
  get isLobEmpty() { return !this.wizardLob; }
  get isLocEmpty() { return !this.wizardLoc; }
  get isLocDisabled() { return !this.wizardLob; }
  // Third step in the cascade - Root Product options narrow on
  // the LOB+LOC pair via ROOT_PRODUCTS_BY_LOB_LOC.
  get rootProductOptions() {
    if (!this.wizardLob || !this.wizardLoc) return [];
    const key = `${this.wizardLob}::${this.wizardLoc}`;
    return (ROOT_PRODUCTS_BY_LOB_LOC[key] || []).map((o) => ({
      ...o,
      selected: this.wizardRootProduct === o.value
    }));
  }
  get isRootProductDisabled() {
    return !this.wizardLoc || !this.wizardLob;
  }

  // Resolved match for the picked LOB+Coverage pair - central source
  // for the prompt, warning, and publish-time deactivation.
  get existingTemplate() {
    if (!this.wizardLob || !this.wizardLoc) return null;
    return this.templates.find(
      (t) => t.lob === this.wizardLob && t.loc === this.wizardLoc
    ) || null;
  }
  get hasExistingTemplateForPair() {
    // In edit mode the admin is already committed to a specific record,
    // so don't surface the edit-or-clone prompt for its own pair.
    if (this.editingTemplateId) return false;
    return !!this.existingTemplate;
  }
  get existingTemplateName() {
    return this.existingTemplate ? this.existingTemplate.name : '';
  }
  get existingTemplateIsActive() {
    return !!(this.existingTemplate && this.existingTemplate.isActive);
  }
  // Surfaces the active-version warning under the prompt tiles - only
  // when the admin opted into Create-new-version on top of an active
  // record. Quote Compare Setup has no future-start date field, so
  // publishing here always deactivates the old version.
  get showVersionWarning() {
    return this.templateMode === 'clone' && this.existingTemplateIsActive;
  }
  get editTileClass() {
    return this.templateMode === 'edit'
      ? 'qcs-tile is-active'
      : 'qcs-tile';
  }
  get cloneTileClass() {
    return this.templateMode === 'clone'
      ? 'qcs-tile is-active'
      : 'qcs-tile';
  }

  handleLobChange(event) {
    this.wizardLob = event.detail.value || null;
    // LOB → LOC → Root Product cascade. Changing the LOB clears
    // every downstream selection so the picker can't carry stale
    // dependents (LOC narrows on LOB; Root Product narrows on the
    // LOB+LOC pair).
    this.wizardLoc = null;
    this.wizardRootProduct = null;
    this.templateMode = null;
  }
  handleLocChange(event) {
    this.wizardLoc = event.detail.value || null;
    // Reset Root Product - its options key off `${LOB}::${LOC}` so
    // a new LOC invalidates the previous Root Product selection.
    this.wizardRootProduct = null;
    this.templateMode = null;
  }
  handleRootProductChange(event) {
    this.wizardRootProduct = event.detail.value || null;
    // Notify the host workspace that scoping is complete so it can
    // unlock the rest of the pipeline (the workspace's progressive-
    // disclosure lock already unlocks on Next; this event lets
    // future consumers react sooner if they want).
    if (this.wizardRootProduct) {
      this.dispatchEvent(
        new CustomEvent('initialized', {
          detail: {
            lob: this.wizardLob,
            loc: this.wizardLoc,
            rootProduct: this.wizardRootProduct
          },
          bubbles: true,
          composed: true
        })
      );
    }
  }
  handleModeChoice(event) {
    const mode = event.currentTarget.dataset.mode;
    this.templateMode = mode === 'edit' || mode === 'clone' ? mode : null;
  }

  // ── Stage 1 ────────────────────────────────────────────────
  // Feeds the shared c-attribute-picker on the Fixed Summary Widgets
  // step. Each widget is a { id, label } row; the picker owns show-
  // all/hide, select-all, and search - we just persist selection.
  get summaryPickerAttributes() {
    return SUMMARY_WIDGET_DEFS.map((w) => ({ id: w.id, label: w.label }));
  }
  get summaryPickerSelectedIds() {
    return SUMMARY_WIDGET_DEFS
      .filter((w) => !!this.summaryWidgets[w.id])
      .map((w) => w.id);
  }

  handleSummaryPickerToggle(event) {
    const { id, isChecked } = event.detail || {};
    if (!id) return;
    this.summaryWidgets = {
      ...this.summaryWidgets,
      [id]: !!isChecked
    };
  }
  handleSummaryPickerSelectAll(event) {
    const { isChecked, ids } = event.detail || {};
    if (!Array.isArray(ids) || ids.length === 0) return;
    const next = { ...this.summaryWidgets };
    for (const id of ids) next[id] = !!isChecked;
    this.summaryWidgets = next;
  }

  // ── Stage 2 ────────────────────────────────────────────────
  get metricsTabs() {
    return [
      { id: 'ipc',  label: 'Policy & Coverage Level (IPC)',
        cls: this.metricsTab === 'ipc'
          ? 'qcs-tab is-active'
          : 'qcs-tab',
        ariaSelected: this.metricsTab === 'ipc' ? 'true' : 'false' },
      { id: 'ipcb', label: 'Benefits & Attributes (IPCB / IPCA)',
        cls: this.metricsTab === 'ipcb'
          ? 'qcs-tab is-active'
          : 'qcs-tab',
        ariaSelected: this.metricsTab === 'ipcb' ? 'true' : 'false' }
    ];
  }

  // c-attribute-picker props (per-tab). The picker owns row
  // rendering, search, select-all, expand/collapse, and reorder
  // mechanics; we just hand it the tab's catalog + our controlled
  // selection state.
  get currentTabAttributes() {
    return METRICS_BY_TAB[this.metricsTab] || [];
  }
  // Selection scoped to the active tab - so the picker's `N of M`
  // counter reads within-tab (never mixing ipc + ipcb totals).
  get currentTabSelectedIds() {
    const scope = new Set(this._metricIdsForTab(this.metricsTab));
    return this.selectedMetricIds.filter((id) => scope.has(id));
  }
  // Ordering scoped to the active tab so up/down arrows only reorder
  // within this tab's frame. Cross-tab ordering is maintained by the
  // full `this.ordering` array, which we splice back into on write.
  get currentTabOrdering() {
    const scope = new Set(this._metricIdsForTab(this.metricsTab));
    return this.ordering.filter((id) => scope.has(id));
  }

  get selectedMetricCount() {
    return this.ordering.length;
  }

  handleMetricsTabSelect(event) {
    const id = event.currentTarget.dataset.id;
    if (id !== 'ipc' && id !== 'ipcb') return;
    this.metricsTab = id;
  }

  // c-attribute-picker events - each writes back into the flat
  // selectedMetricIds / ordering arrays we persist. We keep ordering
  // in lock-step with the selection so the display sequence stays
  // stable and re-hydrates cleanly on template edit.
  handleAttrPickerToggle(event) {
    const { id, isChecked } = event.detail || {};
    if (!id) return;
    const set = new Set(this.selectedMetricIds);
    if (isChecked) {
      set.add(id);
      if (!this.ordering.includes(id)) this.ordering = [...this.ordering, id];
    } else {
      set.delete(id);
      this.ordering = this.ordering.filter((x) => x !== id);
    }
    this.selectedMetricIds = [...set];
  }
  handleAttrPickerSelectAll(event) {
    const { isChecked, ids } = event.detail || {};
    if (!Array.isArray(ids) || ids.length === 0) return;
    const set = new Set(this.selectedMetricIds);
    let order = [...this.ordering];
    if (isChecked) {
      for (const id of ids) {
        set.add(id);
        if (!order.includes(id)) order.push(id);
      }
    } else {
      for (const id of ids) set.delete(id);
      order = order.filter((x) => !ids.includes(x));
    }
    this.selectedMetricIds = [...set];
    this.ordering = order;
  }
  handleAttrPickerReorder(event) {
    const { id, direction } = event.detail || {};
    if (!id) return;
    const idx = this.ordering.indexOf(id);
    if (idx < 0) return;
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= this.ordering.length) return;
    const next = [...this.ordering];
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    this.ordering = next;
  }
  handleAttrPickerReorderMove(event) {
    // The picker gives us the new tab-scoped ordering after a drag.
    // Merge it back into the flat cross-tab ordering by replacing
    // just this tab's slice.
    const { order } = event.detail || {};
    if (!Array.isArray(order)) return;
    const scope = new Set(this._metricIdsForTab(this.metricsTab));
    const otherTabOrder = this.ordering.filter((id) => !scope.has(id));
    this.ordering = [...order, ...otherTabOrder];
  }
  // ── Stage 3 ────────────────────────────────────────────────
  // Options for the c-picklist combobox. The trailing "(Default)" tag
  // on 2 is inlined into the label because c-picklist renders a single
  // line per option; the section subtitle above the control still
  // carries the fuller "show every quote received" explanation.
  get columnLimitOptions() {
    return [
      { value: '2', label: '2 (Default)' },
      { value: '3', label: '3' },
      { value: '4', label: '4' },
      { value: '5', label: '5' },
      { value: 'all', label: 'All quotes received' }
    ];
  }
  get columnLimitValue() {
    return String(this.columnLimit);
  }
  get agentModuleOptions() {
    return AGENT_MODULES.map((m) => ({
      ...m,
      selected: this.agentforceModule === m.value
    }));
  }
  get isAgentModuleEmpty() {
    return !this.agentforceModule;
  }

  // Cross-read warning - any picked metric not present in
  // RFQ_FIELDS_BY_LOC[lob::loc] surfaces in the alert. Labels are
  // resolved from the metric defs so the banner reads as the same
  // copy the broker just clicked.
  get crossReadMismatches() {
    if (!this.wizardLob || !this.wizardLoc) return [];
    const key = `${this.wizardLob}::${this.wizardLoc}`;
    const allowed = RFQ_FIELDS_BY_LOC[key] || new Set();
    const all = [...METRICS_BY_TAB.ipc, ...METRICS_BY_TAB.ipcb];
    const byId = new Map(all.map((m) => [m.id, m]));
    return this.selectedMetricIds
      .filter((id) => !allowed.has(id))
      .map((id) => (byId.get(id) || {}).label || id);
  }
  get hasCrossReadWarning() {
    return this.crossReadMismatches.length > 0;
  }
  get crossReadMismatchCopy() {
    const list = this.crossReadMismatches;
    if (!list.length) return '';
    if (list.length === 1) return list[0];
    if (list.length === 2) return `${list[0]} and ${list[1]}`;
    return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
  }
  // Compact 2-line-safe subject for the Configuration-alert banner
  // (Stage 3). Older copy enumerated every mismatched attribute
  // inline, which blew past 3 lines once the broker selected 4+
  // attributes; brokers just need to know how many need fixing +
  // the CTA. Full list stays available via the RFQ Setup deep
  // link in the banner's action button.
  get crossReadMismatchSubject() {
    const n = this.crossReadMismatches.length;
    if (n === 0) return '';
    if (n === 1) return '1 selected attribute is';
    return `${n} selected attributes are`;
  }

  handleColumnLimitChange(event) {
    const value = event.detail && event.detail.value;
    if (value === 'all') {
      this.columnLimit = 'all';
      return;
    }
    const parsed = Number.parseInt(value, 10);
    if (parsed >= 2 && parsed <= 5) this.columnLimit = parsed;
  }
  handleAgentforceToggle() {
    this.agentforceOn = !this.agentforceOn;
    if (!this.agentforceOn) this.agentforceModule = null;
  }
  handleAgentModuleChange(event) {
    this.agentforceModule = event.detail.value || null;
  }

  // Cross-read banner action - bubble an intent the host shell can
  // route to RFQ Setup. We don't navigate from here so the host stays
  // in control of routing and sidebar state.
  handleOpenRfqSetup() {
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: { target: 'rfq-setup', reason: 'cross-read-fix' },
        bubbles: true,
        composed: true
      })
    );
  }

  // ── Publish ────────────────────────────────────────────────
  // Builds the shared payload (summary widgets + selected metrics +
  // ordering + stage 3 settings) so the playbook's Quote Comparison
  // preview can render the same broker-facing layout off the saved
  // record. Re-routes all mutations through data/comparisonTemplates
  // so both surfaces read the same source of truth.
  _emitSaved(id) {
    this.dispatchEvent(
      new CustomEvent('configurationsave', {
        detail: {
          stepId: 'comp_logic',
          source: 'quoteCompareSetup',
          id: id || null,
          lob: this.wizardLob,
          loc: this.wizardLoc
        },
        bubbles: true,
        composed: true
      })
    );
  }
  _wizardConfigPayload() {
    return {
      summaryWidgets: { ...this.summaryWidgets },
      selectedMetricIds: this.selectedMetricIds.slice(),
      ordering: this.ordering.slice(),
      columnLimit: this.columnLimit,
      agentforceOn: this.agentforceOn,
      agentforceModule: this.agentforceModule
    };
  }
  _publishTemplate() {
    let savedId = null;
    // Edit mode - update the existing record in place, persisting the
    // full wizard config alongside identity fields so the playbook
    // preview reflects every change the admin just made.
    if (this.editingTemplateId) {
      savedId = this.editingTemplateId;
      updateTemplate(savedId, {
        lob: this.wizardLob,
        loc: this.wizardLoc,
        badge: _badgeForLob(this.wizardLob),
        ...this._wizardConfigPayload()
      });
      this._refreshCatalog();
      this.editingTemplateId = null;
      if (!this._embedded) this.wizardOpen = false;
      this._emitSaved(savedId);
      return;
    }
    const today = todayIso();
    // Create-new-version mode - clone the source's identity, then
    // overlay the new wizard config so the new version differs in
    // configuration but not in scope. Active predecessors are
    // deactivated to avoid two live versions for the same scope.
    if (this.templateMode === 'clone' && this.existingTemplate) {
      const src = this.existingTemplate;
      if (src.isActive) {
        updateTemplate(src.id, { isActive: false });
      }
      const created = addTemplate({
        ...src,
        id: `tpl-${Date.now()}`,
        version: this._bumpVersion(src.version),
        liveSince: today,
        isActive: true,
        ...this._wizardConfigPayload()
      });
      savedId = (created && created.id) || null;
      this._refreshCatalog();
      if (!this._embedded) this.wizardOpen = false;
      this._emitSaved(savedId);
      return;
    }
    const created = addTemplate({
      id: `tpl-${Date.now()}`,
      name: _nameForLobLoc(this.wizardLob, this.wizardLoc) + ' Template',
      lob: this.wizardLob,
      loc: this.wizardLoc,
      badge: _badgeForLob(this.wizardLob),
      version: 'v0.1',
      liveSince: today,
      isActive: true,
      ...this._wizardConfigPayload()
    });
    savedId = (created && created.id) || null;
    this._refreshCatalog();
    if (!this._embedded) this.wizardOpen = false;
    this._emitSaved(savedId);
  }

  // Bump "vMAJOR.MINOR" by one minor; non-matching strings fall back to
  // appending " (new)" so we never produce duplicate-looking labels.
  _bumpVersion(prev) {
    const m = /^v(\d+)\.(\d+)$/i.exec(prev || '');
    if (!m) return prev ? `${prev} (new)` : 'v1.0';
    const major = parseInt(m[1], 10);
    const minor = parseInt(m[2], 10) + 1;
    return `v${major}.${minor}`;
  }
}
