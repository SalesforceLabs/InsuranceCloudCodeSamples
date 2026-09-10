import { LightningElement, api, track } from 'lwc';

/**
 * c-rfq-template-wizard
 *
 * Self-contained "+ New RFQ Template" wizard. Owns the modal chrome,
 * the step sequence and the publish handoff, so a host only has to
 * mount it with the scope the pre-builder modal captured and listen
 * for one terminal event.
 *
 * The step bodies are the existing builder components, unchanged:
 *   Initialize + stages - c-rfq-playbook-setup
 *   Publish             - c-rfq-publish-template
 *
 * The rail drives the playbook through the same `embedded` + `stage-id`
 * contract c-insurance-setup-workspace uses: the playbook's own "Steps
 * to Configure" list stays suppressed and each rail card pushes its
 * stage id down, so one mount serves every configure step.
 *
 * Public contract, mirroring c-quote-compare-setup:
 *   @api seededLob / seededLoc - scope from c-template-init-modal
 *   @api embedded              - render inline as Setup canvas content
 *                                instead of a centred overlay
 *   event "configurationsave"  - bubbled from c-rfq-publish-template
 *                                once the record is written
 *   event "wizardclose"        - admin dismissed; nothing was written
 */

// The rail is Initialize + one card per playbook stage + Publish, so
// the pipeline follows whatever flow the scope resolves to rather than
// a hardcoded length. Copy for the stages the org ships lives here;
// any other stage falls back to its own blueprint title.
const STAGE_COPY = {
  collection: {
    label: 'Schedule of Vehicles',
    sub: 'Capture the assets and participants, and toggle which fields the broker sees in the runtime roster.'
  },
  coverages: {
    label: 'Policy Coverages',
    sub: 'Tier coverages across the policy, per-vehicle, and per-driver scopes. Tabs map to the runtime tree levels.'
  },
  quote_comparison: {
    label: 'Integrations And Preview',
    sub: 'Configure quote providers and preview how Quote Details surface for the broker.'
  },
  review: {
    label: 'Market Routing',
    sub: 'Route the request to markets, and wire the quote summary and carrier hand-off the broker sends at submission.'
  }
};

// The order the org lists those stages in, which differs from the
// blueprint's own order for the last two.
const STAGE_ORDER = ['collection', 'coverages', 'review', 'quote_comparison'];

const INITIALIZE_CARD = {
  id: 'initialize',
  label: 'Initialize',
  sub: 'Select the Root Product to scope this RFQ template and preview its hierarchy.'
};
const PUBLISH_CARD = {
  id: 'publish',
  label: 'Publish',
  sub: 'Assign version + validity, then activate the template for producers.'
};

// Scope vocabulary, matching c-template-init-modal's option values.
const LOB_LABELS = {
  PERSONAL_LINES: 'Personal Lines',
  GROUP_BENEFITS: 'Group Benefits'
};
const LOC_LABELS = {
  AUTO: 'Auto',
  HOME: 'Home/Dwelling',
  MEDICAL: 'Medical',
  DENTAL: 'Dental',
  VISION: 'Vision'
};
const LOB_BADGES = {
  PERSONAL_LINES: 'PERSONAL LINES',
  GROUP_BENEFITS: 'GROUP BENEFITS'
};
// data/rfqTemplates stores every Group Benefits sub-line under the
// HEALTH coverage code, which is what the broker intake modal resolves
// "Group Medical" to. Personal Lines codes pass straight through.
const CATALOG_COVERAGE = {
  AUTO: 'AUTO',
  HOME: 'HOME',
  MEDICAL: 'HEALTH',
  DENTAL: 'HEALTH',
  VISION: 'HEALTH'
};

export default class RfqTemplateWizard extends LightningElement {
  _seededLob = null;
  _seededLoc = null;
  _embedded = false;

  // Presentation only. Unlike c-quote-compare-setup's `embedded`, no
  // chrome ownership is handed over: this wizard always draws its own
  // stepper and footer, because the only inline host (c-setup-home)
  // supplies neither.
  @api
  get embedded() {
    return this._embedded;
  }
  set embedded(value) {
    this._embedded = !!value;
  }

  @api
  get seededLob() {
    return this._seededLob;
  }
  set seededLob(value) {
    this._seededLob = value || null;
  }

  @api
  get seededLoc() {
    return this._seededLoc;
  }
  set seededLoc(value) {
    this._seededLoc = value || null;
  }

  @track stepIdx = 0;
  // Mirrored out of the playbook's assignmentschange payload. Gates
  // Initialize's Next and is what the Publish form stamps onto the
  // record.
  @track rootProduct = null;
  // Stage descriptors for the flow the scope resolved to, mirrored out
  // of the same payload. Drives the middle of the step rail.
  @track stages = [];
  // Mirrored out of the Publish form's validitychange payload so the
  // footer can disable Save until version + both dates are filled.
  @track canPublish = false;

  // ── Step routing ───────────────────────────────────────────
  // Step 0 is Initialize, the last step is Publish, and everything
  // between is one playbook stage.
  get _stageCards() {
    const stages = this.stages || [];
    // A flow the org does not describe end to end keeps its own stage
    // order, since STAGE_ORDER has nothing to say about those stages.
    const covered =
      stages.length > 0 && stages.every((s) => STAGE_ORDER.includes(s.id));
    const ordered = covered
      ? STAGE_ORDER.map((id) => stages.find((s) => s.id === id)).filter(Boolean)
      : stages;
    return ordered.map((s) => {
      const copy = STAGE_COPY[s.id] || {};
      return {
        id: s.id,
        stageId: s.id,
        label: copy.label || s.title || s.id,
        sub: copy.sub || s.desc || ''
      };
    });
  }
  get _cards() {
    return [INITIALIZE_CARD, ...this._stageCards, PUBLISH_CARD];
  }
  get _publishIdx() {
    return this._cards.length - 1;
  }
  get isStepInitialize() {
    return this.stepIdx === 0;
  }
  get isStepPublish() {
    return this.stepIdx === this._publishIdx;
  }
  // Every stage step drives the same playbook mount through its
  // `stage-id` contract; Initialize clears it so the playbook falls
  // back to the Root Product picker and hierarchy preview.
  get activeStageId() {
    const card = this._cards[this.stepIdx];
    return card && card.stageId ? card.stageId : '';
  }
  // One mount for the whole pipeline so stepping back and forth keeps
  // the admin's stage config. Panes hide rather than unmount.
  get isPlaybookHidden() {
    return this.isStepPublish;
  }
  get isPublishHidden() {
    return !this.isStepPublish;
  }
  // Same rule the workspace applies: the picker belongs to Initialize,
  // and each stage gets the full width for its config.
  get playbookHidePicker() {
    return !this.isStepInitialize;
  }

  get wizardTitle() {
    return 'New RFQ Template';
  }

  // ── Presentation ───────────────────────────────────────────
  // Backdrop + title bar with the X. Inline content carries neither.
  get showModalChrome() {
    return !this._embedded;
  }
  // The org's inline chrome: a "Back to Templates" link and the
  // active step name at the top of the right panel.
  get showCanvasHead() {
    return this._embedded;
  }
  get wizardRole() {
    return this._embedded ? null : 'dialog';
  }
  get wizardAriaModal() {
    return this._embedded ? null : 'true';
  }
  get wizardLabelledBy() {
    return this._embedded ? null : 'rtw-wizard-title';
  }
  get wizardWrapperClass() {
    return this._embedded ? 'rtw-wizard rtw-wizard_embedded' : 'rtw-wizard';
  }
  get wizardContainerClass() {
    return this._embedded
      ? 'rtw-wizard__container rtw-wizard__container_embedded'
      : 'rtw-wizard__container';
  }
  get currentStepLabel() {
    const card = this._cards[this.stepIdx];
    return card ? card.label : '';
  }
  // The panel repeats the step name in modal mode only; inline, the
  // canvas head above it already carries the name.
  get showPanelTitle() {
    return this.showModalChrome;
  }
  get panelTitle() {
    if (this.isStepInitialize) return 'Initialize RFQ Template';
    if (this.isStepPublish) return 'Publish RFQ Template';
    return this.currentStepLabel;
  }

  get wizardSteps() {
    const idx = this.stepIdx;
    const cards = this._cards;
    const last = cards.length - 1;
    return cards.map((card, i) => {
      const isActive = idx === i;
      return {
        ...card,
        key: card.id,
        stepIdx: i,
        hasConnector: i < last,
        // Every step past Initialize reads from the Root Product, so
        // they stay locked until one is picked.
        isLocked: i > 0 && !this.rootProduct,
        ariaCurrent: isActive ? 'step' : null,
        cls: isActive
          ? 'rtw-wizard__nav-step is-active'
          : 'rtw-wizard__nav-step'
      };
    });
  }

  // ── Footer ─────────────────────────────────────────────────
  get showPrevious() {
    return this.stepIdx > 0;
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
    return this.isStepPublish;
  }
  get nextLabel() {
    return this.isFinalStep ? 'Save & Activate Template' : 'Save & Next';
  }
  get nextDisabled() {
    if (this.isStepInitialize) return !this.rootProduct;
    if (this.isStepPublish) return !this.canPublish;
    return false;
  }

  // ── Publish payload ────────────────────────────────────────
  // Scope + name for the record the Publish form writes. Without this
  // the form falls back to the Group Benefits defaults it has always
  // used, which would mislabel a Personal Lines template.
  get newTemplateDefaults() {
    const lob = this._seededLob;
    const loc = this._seededLoc;
    if (!lob || !loc) return null;
    return {
      name: `${LOB_LABELS[lob] || lob} - ${LOC_LABELS[loc] || loc} RFQ`,
      lob,
      coverage: CATALOG_COVERAGE[loc] || loc,
      badge: LOB_BADGES[lob] || ''
    };
  }

  // ── Handlers ───────────────────────────────────────────────
  handleAssignmentsChange(event) {
    const assignments = (event.detail && event.detail.assignments) || {};
    this.rootProduct = assignments.rootProduct || null;
    this.stages = Array.isArray(assignments.stages) ? assignments.stages : [];
    // A flow swap can leave the admin past the end of the new, shorter
    // pipeline.
    if (this.stepIdx > this._publishIdx) this.stepIdx = this._publishIdx;
  }

  handleStepPick(event) {
    const idx = Number(event.currentTarget.dataset.idx);
    if (Number.isNaN(idx) || idx === this.stepIdx) return;
    if (idx > 0 && !this.rootProduct) return;
    this.stepIdx = idx;
  }

  handleValidityChange(event) {
    this.canPublish = !!(event.detail && event.detail.canPublish);
  }

  handleNext() {
    if (this.nextDisabled) return;
    if (this.isFinalStep) {
      const form = this.refs && this.refs.publishForm;
      if (form && typeof form.save === 'function') form.save();
      return;
    }
    this.stepIdx += 1;
  }

  handlePrevious() {
    if (!this.showPrevious) return;
    this.stepIdx -= 1;
  }

  handleClose() {
    this.dispatchEvent(
      new CustomEvent('wizardclose', { bubbles: true, composed: true })
    );
  }

  handleKeydown(event) {
    if (event.key === 'Escape') this.handleClose();
  }
}
