import { LightningElement, track } from 'lwc';
import { formatUsDate, today, todayIso } from 'data/dates';

// ─────────────────────────────────────────────────────────────────────────
// URL persistence helpers (hard-refresh continuity) ───────────────────────
// The wizard's open + step state mirrors to `?wizard=open&wstep=<n>` so a
// refresh mid-wizard returns the admin to the same step. Content state
// (LOB/Coverage/attribute config) is in-memory and intentionally NOT
// restored - restoring half-typed form data on refresh would surprise.

function _readInitialWizardOpen() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('wizard') === 'open';
}
function _readInitialWizardStep() {
  if (typeof window === 'undefined') return 0;
  const raw = new URLSearchParams(window.location.search).get('wstep');
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return 0;
  // STEPS has 3 entries (define, configure, assign) - clamp to 0..2.
  return Math.max(0, Math.min(2, n));
}
function _readInitialLob() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('lob') || null;
}
function _readInitialCoverage() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('cov') || null;
}

// ─────────────────────────────────────────────────────────────────────────
// c-agentforce-setup
//
// Mock of the Salesforce Setup → Agentforce Meeting Concierge Setup page.
// Three layers live in this single component:
//
//   1. Setup page  - sidebar nav + playbook tiles + "New Playbook" CTA.
//   2. Wizard      - 3-step modal launched from "New Playbook":
//                     a) Template picker  (Start from scratch / Annual
//                        Review / Prospecting)
//                     b) Define your Playbook (form + meeting stages)
//                     c) Configure Components (per-stage component tiles
//                        + detail panel)
//   3. Assign & Activate is stubbed as Step 3 of the wizard so the stepper
//      reads correctly; the actual config UI isn't in the brief.
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_STAGES = [
  {
    id: 'census',
    title: 'Census & Data Gathering',
    desc: 'Collect roster data, prior policies, and risk context.'
  },
  {
    id: 'plan_design',
    title: 'Plan Design & Rules',
    desc: 'Configure product models, deductibles, and contribution splits.'
  },
  {
    id: 'quote_review',
    title: 'Quote Review & Publish',
    desc: 'Compare market quotes and generate the client proposal.'
  }
];

const STEPS = ['define', 'configure', 'assign'];

// Stage 0 Initialization combobox sources. Coverage options are filtered
// by the selected LOB; only the documented (LOB, Coverage) pairs have a
// real flow in c-rfq-playbook-setup - everything else lands on the
// "No flow defined" canvas placeholder.
// Scoped to Personal Lines + Group Benefits only - Commercial Lines
// is out of scope for this build.
const LOB_OPTIONS = [
  { value: 'PERSONAL_LINES', label: 'Personal Lines' },
  { value: 'GROUP_BENEFITS', label: 'Group Benefits' }
];
const COVERAGE_OPTIONS_BY_LOB = {
  PERSONAL_LINES: [
    { value: 'AUTO', label: 'Auto' },
    { value: 'HOME', label: 'Home/Dwelling' }
  ],
  GROUP_BENEFITS: [
    { value: 'HEALTH', label: 'Health' }
  ]
};

// Seed playbooks shown on the RFQ Setup landing page. These are the
// canonical RFQ templates a broker org runs day-to-day; each one is
// pinned to a Root Product in the PCM and tagged with a version +
// the date that version went live so admins can see template
// recency at a glance from the setup list.
// `lob` + `coverage` are the picker value codes (see LOB_OPTIONS /
// COVERAGE_OPTIONS_BY_LOB) so the Initialize step can detect when a
// template already exists for the selected pair and surface the
// edit-or-clone prompt.
// Each seed carries `liveSince` (effective start) AND
// `effectiveEndDate` (planned termination). The Publish-step warning
// uses the end date to decide whether a freshly-published version
// would overlap and therefore deactivate the current one. Inactive
// records keep an end date too so historical tenure stays readable
// in audit/version-history views.
// Empty by default - the Setup page opens with no pre-existing
// templates so the admin starts from a clean canvas. Templates are
// created via the "+ New Template" flow and appended to the runtime
// `playbooks` @track array.
const SEED_PLAYBOOKS = [];

// Tomorrow's ISO date (YYYY-MM-DD) - the earliest start date that keeps
// the current version live while the new one waits its turn. Lives at
// module-level so date math stays consistent across getters.
const _tomorrowISO = () => {
  const d = today();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

// Pretty-prints an ISO date (YYYY-MM-DD) as MM/DD/YYYY for the
// "Live since" meta on each template tile. Centralised so the
// playbookTiles getter stays clean.
const _formatLiveSince = (iso) => formatUsDate(iso);

export default class AgentforceSetup extends LightningElement {
  // ── Setup page ──────────────────────────────────────────────
  @track playbooks = [...SEED_PLAYBOOKS];

  // Tracks which playbook tile's kebab menu is currently open. Only one
  // menu can be open at a time; clicking the scrim or another action
  // closes it. Null when no menu is open.
  @track openMenuId = null;

  // Which sidebar item drives the main panel content. On v4 the only
  // selectable Feature Settings entry is the new Insurance Setup
  // Workspace - the legacy 'concierge' (RFQ Setup) and 'quote-compare'
  // entries were removed per the v4 spec and live on in v3 / preview
  // v01 for reference. Items outside the Feature Settings group
  // (Meetings, Einstein) stay decorative.
  @track activeSidebarItem = 'insurance-setup';

  // ── Wizard state ────────────────────────────────────────────
  // Initialised from `?wizard=open&wstep=<n>` so a hard refresh
  // mid-wizard lands the admin back on the same step instead of
  // dumping them on the template list. The wizard's CONTENT
  // (LOB/Coverage/attribute config) is in-memory and not
  // restored - only the navigation state (open + step index).
  @track wizardOpen = _readInitialWizardOpen();
  @track wizardStepIdx = _readInitialWizardStep();
  // Set when the wizard was opened via a tile's "Edit" action - holds
  // the playbook id being edited so commit updates it in place instead
  // of creating a new template. Null for the "New Template" flow.
  @track editingPlaybookId = null;

  // Stage 0: Initialization - Line of Business + Line of Coverage drive
  // the dynamic canvas in c-rfq-playbook-setup. Name / developer name /
  // description are derived from these on commit.
  // Initialised from URL so a refresh mid-wizard restores the picked
  // flow context alongside the step index - without these, restoring
  // the Configure/Publish step would dump the admin on an empty
  // canvas.
  @track lob = _readInitialLob();
  @track coverage = _readInitialCoverage();
  // When a template already exists for the picked LOB+Coverage, the admin
  // must commit to 'edit' or 'clone' before advancing. Null until chosen.
  @track templateMode = null;
  @track playbookName = '';
  @track developerName = '';
  @track playbookDesc = '';
  @track stages = DEFAULT_STAGES.map((s) => ({ ...s }));

  // Configure-step state - full assignments payload reported by
  // c-rfq-playbook-setup whenever the admin toggles an attribute or flips
  // a Stage 4 integration switch.
  @track playbookAssignments = {
    lob: null,
    coverage: null,
    attrs: {},
    reviewConfig: { agentforce: false, slack: false, slackChannel: 'account' }
  };

  // Stage 3 Publish - versioning + validity window + status toggle.
  // Templates are versioned PCM records with an effective date range;
  // this is the metadata the admin captures before activating.
  @track versionName = '';
  // Tracks whether the admin has hand-edited the version name. While
  // false, the version stays auto-suggested (v1.0 from scratch, then
  // v2.0, v3.0 … as versions accrue for the same LOB/Coverage pair);
  // once the admin types, we stop overwriting their value.
  _versionEdited = false;
  @track effectiveStartDate = '';
  @track effectiveEndDate = '';
  @track templateStatus = 'draft'; // 'draft' | 'active'

  // ── Setup page actions ──────────────────────────────────────
  handleClose() {
    this.dispatchEvent(new CustomEvent('close'));
  }

  // ── Playbook tile kebab menu ────────────────────────────────
  // Toggle the 3-dot menu for a specific tile. stopPropagation so the
  // click doesn't fall through to the scrim and immediately re-close
  // the menu we just opened.
  handleToggleMenu(event) {
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    this.openMenuId = this.openMenuId === id ? null : id;
  }
  // Click on the invisible scrim closes any open menu - gives admins
  // a click-anywhere-to-dismiss affordance without us reaching outside
  // the component for a document listener.
  handleCloseMenu() {
    this.openMenuId = null;
  }
  // Activate / Deactivate flips the playbook's isActive flag. The
  // menu item label is computed from the current state in the
  // playbookTiles getter.
  handleActivatePlaybook(event) {
    const id = event.currentTarget.dataset.id;
    this.playbooks = this.playbooks.map((p) =>
      p.id === id ? { ...p, isActive: !p.isActive } : p
    );
    this.openMenuId = null;
  }
  // Edit opens the wizard pre-seeded with the template's LOB + Coverage
  // (and current status/version) in edit mode, so the admin reconfigures
  // the existing record. Commit updates it in place rather than creating
  // a new one. Also bubbles a playbookedit event for any host that wants
  // to react.
  handleEditPlaybook(event) {
    const id = event.currentTarget.dataset.id;
    const pb = this.playbooks.find((p) => p.id === id);
    this.openMenuId = null;
    if (!pb) return;
    this.editingPlaybookId = id;
    this.wizardOpen = true;
    this.wizardStepIdx = 0;
    this.lob = pb.lob || null;
    this.coverage = pb.coverage || null;
    this.templateMode = null;
    this.playbookName = pb.name || '';
    this.developerName = '';
    this.playbookDesc = '';
    this.stages = DEFAULT_STAGES.map((s) => ({ ...s }));
    this.playbookAssignments = {
      lob: pb.lob || null,
      coverage: pb.coverage || null,
      attrs: {},
      reviewConfig: { agentforce: false, slack: false, slackChannel: 'account' }
    };
    // Editing an existing record shows its own version - treat as
    // hand-set so the auto-suggester doesn't overwrite it.
    this.versionName = pb.version || '';
    this._versionEdited = true;
    // Pre-fill the active window so the admin sees their current
    // tenure and can adjust the end date in place.
    this.effectiveStartDate = pb.liveSince || '';
    this.effectiveEndDate = pb.effectiveEndDate || '';
    this.templateStatus = pb.isActive ? 'active' : 'draft';
    this.dispatchEvent(
      new CustomEvent('playbookedit', {
        detail: { id },
        bubbles: true,
        composed: true
      })
    );
  }
  // Delete removes the template from the list. If the wizard happens to
  // be editing this record, clear the edit context too.
  handleDeletePlaybook(event) {
    const id = event.currentTarget.dataset.id;
    this.playbooks = this.playbooks.filter((p) => p.id !== id);
    if (this.editingPlaybookId === id) this.editingPlaybookId = null;
    this.openMenuId = null;
  }
  // Clone duplicates a template as a fresh draft: new id, "(Copy)"
  // suffix on the name, version bumped to v0.1 so the admin can edit
  // + version-up before activating, today stamped as the live date,
  // status reset to inactive so the clone has to be explicitly
  // activated. Slots the new tile right after the source tile.
  handleClonePlaybook(event) {
    const id = event.currentTarget.dataset.id;
    const idx = this.playbooks.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const src = this.playbooks[idx];
    const today = todayIso();
    const clone = {
      ...src,
      id: `${src.id}-copy-${Date.now()}`,
      name: `${src.name} (Copy)`,
      version: 'v0.1',
      liveSince: today,
      isActive: false
    };
    const next = [...this.playbooks];
    next.splice(idx + 1, 0, clone);
    this.playbooks = next;
    this.openMenuId = null;
  }

  handleNewPlaybook() {
    this.wizardOpen = true;
    this.wizardStepIdx = 0;
    this.editingPlaybookId = null;
    this.lob = null;
    this.coverage = null;
    this.templateMode = null;
    this.playbookName = '';
    this.developerName = '';
    this.playbookDesc = '';
    this.stages = DEFAULT_STAGES.map((s) => ({ ...s }));
    this.playbookAssignments = {
      lob: null,
      coverage: null,
      attrs: {},
      reviewConfig: { agentforce: false, slack: false, slackChannel: 'account' }
    };
    // Preload the auto-suggested version (v1.0 from scratch) but let
    // the admin override it on the Publish step.
    this._versionEdited = false;
    this.versionName = this.suggestedVersionName;
    this.effectiveStartDate = '';
    this.effectiveEndDate = '';
    this.templateStatus = 'draft';
  }

  // ── Sidebar nav ───────────────────────────────────────────
  // `selectable: true` flags items that swap the main panel; the
  // others are decorative for now (Meetings, Einstein) and don't
  // respond to clicks.
  get sidebarSections() {
    return [
      {
        id: 'feature-settings',
        label: 'Feature Settings',
        items: [
          // v4 consolidates every Feature Setting under the new
          // RFQ Setup workspace (3 parts: RFQ setup, Comparison table
          // setup, Integrations). The legacy 'concierge'
          // (old RFQ Setup) and 'quote-compare' entries were removed
          // here on v4; they remain reachable on v3 / preview v01.
          // Both legacy flows stay wired inside the new workspace via
          // c-rfq-playbook-setup and c-quote-compare-setup mounts.
          { id: 'insurance-setup', label: 'RFQ Setup', selectable: true }
        ]
      },
      {
        id: 'sales',
        label: 'Sales',
        items: [
          { id: 'meetings', label: 'Meetings' },
          { id: 'einstein',  label: 'Einstein Activity Capture' }
        ]
      }
    ];
  }

  get sidebarSectionsDecorated() {
    return this.sidebarSections.map((s) => ({
      ...s,
      items: s.items.map((i) => {
        const isActive = i.selectable && i.id === this.activeSidebarItem;
        return {
          ...i,
          isActive,
          cls: isActive
            ? 'afs-setup__nav-item is-active'
            : 'afs-setup__nav-item'
        };
      })
    }));
  }

  // Sidebar click - only swap when the picked item is one of the
  // wired Feature Settings entries. Decorative items no-op so the
  // sidebar doesn't navigate to a blank panel.
  handleSidebarSelect(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    // v4 whitelist - only 'insurance-setup' is selectable now. The
    // old 'concierge' and 'quote-compare' ids are intentionally
    // unreachable; their view-flag getters and lwc:if blocks remain
    // as dormant unreachable code so reintroducing the entries is a one-line
    // restore of this guard + the sidebar entries above.
    if (id !== 'insurance-setup') return;
    this.activeSidebarItem = id;
  }

  // Body-class hooks for the main panel `lwc:if` switches.
  get isRfqSetupView()         { return this.activeSidebarItem === 'concierge'; }
  get isQuoteCompareView()     { return this.activeSidebarItem === 'quote-compare'; }
  // Insurance Settings - mounts c-insurance-setup-workspace, the new
  // 5-domain shell.
  get isInsuranceSetupView()   { return this.activeSidebarItem === 'insurance-setup'; }

  // Decorate the playbook tiles with a status pill.
  get hasPlaybooks() {
    return this.playbooks.length > 0;
  }

  get playbookTiles() {
    return this.playbooks.map((p) => {
      const isOpen = this.openMenuId === p.id;
      const isActive = !!p.isActive;
      const liveSinceLabel = _formatLiveSince(p.liveSince);
      // Compact horizontal metadata line - Root Product · Version ·
      // Live since Aug 12, 2026. Replaces the old 3-row stacked
      // dl so the tile reads as a slim summary instead of a tall
      // key/value table.
      const metaParts = [];
      if (p.rootProduct) metaParts.push(p.rootProduct);
      if (p.version) metaParts.push(p.version);
      if (liveSinceLabel) metaParts.push(`Live since ${liveSinceLabel}`);
      return {
        ...p,
        initial: p.name.charAt(0),
        isOpen,
        isActive,
        activateLabel: isActive ? 'Deactivate' : 'Activate',
        statusBadge: isActive ? 'ACTIVE' : 'INACTIVE',
        liveSinceLabel,
        metaLine: metaParts.join(' · '),
        // Tile dims and the badge tone shifts to indicate inactive
        // status so admins can spot stale templates at a glance.
        // `is-menu-open` lifts the tile (and its dropdown) above the
        // click-outside scrim so menu items stay clickable - the tile's
        // hover transform / inactive opacity otherwise trap the menu in
        // a lower stacking context behind the scrim.
        tileClass: [
          'afs-setup__playbook',
          isActive ? '' : 'is-inactive',
          isOpen ? 'is-menu-open' : ''
        ]
          .filter(Boolean)
          .join(' '),
        statusBadgeClass: isActive
          ? 'afs-setup__playbook-status is-active'
          : 'afs-setup__playbook-status is-inactive',
        moreBtnClass: isOpen
          ? 'afs-setup__playbook-more is-open'
          : 'afs-setup__playbook-more'
      };
    });
  }

  // ── Wizard state ────────────────────────────────────────────
  // Class strings are namespaced under afs-* to avoid overriding the
  // global SLDS modal/backdrop classes (slds/no-slds-class-overrides).
  // The wizard's centering, animation, and z-index live in CSS scoped
  // to .afs-wizard / .afs-backdrop.
  get wizardOpenClass() {
    return this.wizardOpen
      ? 'afs-wizard afs-wizard_open'
      : 'afs-wizard';
  }
  get wizardBackdropClass() {
    return this.wizardOpen
      ? 'afs-backdrop afs-backdrop_open'
      : 'afs-backdrop';
  }

  get currentStep() {
    return STEPS[this.wizardStepIdx];
  }
  get isDefineStep()    { return this.currentStep === 'define'; }
  get isConfigureStep() { return this.currentStep === 'configure'; }
  get isAssignStep()    { return this.currentStep === 'assign'; }

  get wizardTitle() {
    const slug = this._templateSlug();
    const verb = this.editingPlaybookId ? 'Edit' : 'New';
    return slug ? `${verb} Template: ${slug}` : `${verb} Template`;
  }

  _templateSlug() {
    if (!this.lob || !this.coverage) return '';
    const lobLabel = (LOB_OPTIONS.find((o) => o.value === this.lob) || {}).label || '';
    const covLabel =
      ((COVERAGE_OPTIONS_BY_LOB[this.lob] || []).find((o) => o.value === this.coverage) || {})
        .label || '';
    return [lobLabel, covLabel].filter(Boolean).join(' - ');
  }

  // ── Stage 0: Initialization combobox state ─────────────────
  get lobOptions() {
    return LOB_OPTIONS.map((o) => ({ ...o, selected: this.lob === o.value }));
  }
  get coverageOptions() {
    const list = COVERAGE_OPTIONS_BY_LOB[this.lob] || [];
    return list.map((o) => ({ ...o, selected: this.coverage === o.value }));
  }
  get isLobEmpty()      { return !this.lob; }
  get isCoverageEmpty() { return !this.coverage; }

  handleLobChange(event) {
    this.lob = event.detail.value || null;
    // Coverage options change with LOB; clear stale selection and the
    // edit/clone choice so the prompt re-evaluates for the new pair.
    this.coverage = null;
    this.templateMode = null;
    this._refreshSuggestedVersion();
  }
  handleCoverageChange(event) {
    this.coverage = event.detail.value || null;
    this.templateMode = null;
    this._refreshSuggestedVersion();
  }

  // ── Existing-template prompt (edit vs. create-new-version) ──
  // Resolved match for the picked LOB+Coverage - null when the pair
  // is incomplete or no template exists. Centralised so the prompt,
  // warning, and commit paths all read from one source.
  get existingPlaybook() {
    if (!this.lob || !this.coverage) return null;
    return this.playbooks.find(
      (p) => p.lob === this.lob && p.coverage === this.coverage
    ) || null;
  }
  get hasExistingTemplateForPair() {
    // Edit mode already targets a specific record, so don't double-pop
    // the prompt for its own pair. Mirrors the gate in quoteCompareSetup.
    if (this.editingPlaybookId) return false;
    return !!this.existingPlaybook;
  }

  // Auto-suggested version name for a brand-new template. "From
  // scratch" (no existing template for the LOB/Coverage pair) is v1.0;
  // each subsequent version for the same pair bumps the major
  // (v2.0, v3.0, …). Major is derived from the highest existing
  // version on that pair so the sequence is stable.
  get suggestedVersionName() {
    if (!this.lob || !this.coverage) return 'v1.0';
    const matches = this.playbooks.filter(
      (p) => p.lob === this.lob && p.coverage === this.coverage
    );
    let maxMajor = 0;
    for (const p of matches) {
      const m = /v(\d+)/i.exec(p.version || '');
      if (m) maxMajor = Math.max(maxMajor, parseInt(m[1], 10));
    }
    return `v${maxMajor + 1}.0`;
  }

  // Refresh the auto-suggested version unless the admin has typed their
  // own. Called whenever the LOB/Coverage pair (and thus the existing
  // version count) changes.
  _refreshSuggestedVersion() {
    if (this._versionEdited) return;
    this.versionName = this.suggestedVersionName;
  }
  get existingPlaybookName() {
    return this.existingPlaybook ? this.existingPlaybook.name : '';
  }
  get existingPlaybookIsActive() {
    return !!(this.existingPlaybook && this.existingPlaybook.isActive);
  }
  // Surfaces the active-version warning under the prompt tiles - only
  // when the admin opted into Create-new-version on top of an active
  // record (the only case where the next-day rule applies).
  get showVersionWarning() {
    return this.templateMode === 'clone' && this.existingPlaybookIsActive;
  }
  // Tomorrow as ISO + a human label - used by the prompt banner as a
  // fallback "earliest non-overlapping start" hint when the current
  // version has no planned end date.
  get tomorrowISO() {
    return _tomorrowISO();
  }
  get tomorrowLabel() {
    return _formatLiveSince(this.tomorrowISO);
  }
  // Tenure descriptors for the current (existing) version so banners
  // can name what's on the line. Falls back gracefully when end-date
  // metadata is missing on legacy seeds.
  get existingPlaybookVersionLabel() {
    if (!this.existingPlaybook) return '';
    return this.existingPlaybook.version || '';
  }
  get existingPlaybookLiveSinceLabel() {
    if (!this.existingPlaybook) return '';
    return _formatLiveSince(this.existingPlaybook.liveSince);
  }
  get existingPlaybookEndLabel() {
    if (!this.existingPlaybook) return '';
    return _formatLiveSince(this.existingPlaybook.effectiveEndDate);
  }
  get existingPlaybookHasEnd() {
    return !!(this.existingPlaybook && this.existingPlaybook.effectiveEndDate);
  }
  // Overlap rule - the older version is deactivated on publish if and
  // only if the new version's Effective Start Date falls before the
  // current version's Effective End Date (i.e., the two windows would
  // otherwise overlap). Versions without an end date fall back to
  // the conservative "tomorrow-or-later" rule.
  get versionWillDeactivateOld() {
    if (!this.showVersionWarning) return false;
    if (!this.effectiveStartDate) return true;
    if (this.existingPlaybookHasEnd) {
      return this.effectiveStartDate <= this.existingPlaybook.effectiveEndDate;
    }
    return this.effectiveStartDate < this.tomorrowISO;
  }
  // Stage-3 contextual note: names the current version + its tenure
  // window, then describes the outcome based on the chosen start
  // date (overlap → deactivate vs hand-over → stays live until).
  get publishVersionNote() {
    if (!this.showVersionWarning) return '';
    const name = this.existingPlaybookName;
    const version = this.existingPlaybookVersionLabel;
    const liveSince = this.existingPlaybookLiveSinceLabel;
    const endLabel = this.existingPlaybookEndLabel;
    // Compose the "Current: <name> <version> (Mon D, YYYY → Mon D,
    // YYYY)" preamble so every variant of the note starts the admin
    // off with the exact record on the line.
    const versionPart = version ? ` ${version}` : '';
    const tenurePart = endLabel
      ? ` (live ${liveSince} → ${endLabel})`
      : liveSince
        ? ` (live since ${liveSince})`
        : '';
    const preamble = `Current version: ${name}${versionPart}${tenurePart}.`;
    if (this.versionWillDeactivateOld) {
      const reason = this.existingPlaybookHasEnd
        ? `Your new start date falls before ${endLabel}, so ${name}${versionPart} will be deactivated when this version is published.`
        : `Set an Effective Start Date of ${this.tomorrowLabel} or later to keep ${name}${versionPart} live until then. Otherwise it will be deactivated when this version is published.`;
      return `${preamble} ${reason}`;
    }
    const startLabel = _formatLiveSince(this.effectiveStartDate);
    return `${preamble} Your new version starts on ${startLabel}, so ${name}${versionPart} stays active until then.`;
  }
  // Severity flip for the Publish-step banner - warning when publishing
  // will silently deactivate the older active version, info when the
  // chosen Effective Start Date keeps it live until the handover.
  get publishVersionBannerClass() {
    return this.versionWillDeactivateOld
      ? 'afs-banner afs-banner_warning'
      : 'afs-banner afs-banner_info';
  }
  get publishVersionBannerRole() {
    return this.versionWillDeactivateOld ? 'alert' : 'status';
  }
  get editTileClass() {
    return this.templateMode === 'edit' ? 'afs-tile is-active' : 'afs-tile';
  }
  get cloneTileClass() {
    return this.templateMode === 'clone' ? 'afs-tile is-active' : 'afs-tile';
  }
  handleModeChoice(event) {
    const mode = event.currentTarget.dataset.mode;
    this.templateMode = mode === 'edit' || mode === 'clone' ? mode : null;
  }

  get wizardSteps() {
    // The inner sidebar shows three top-level steps. We're past the
    // template picker once we get here. Each step carries a short
    // subtitle for the "RFQ Progress" sidebar card.
    const defs = [
      { id: 'define',    index: 1, label: 'Initialize', sub: 'LOB & Coverage' },
      { id: 'configure', index: 2, label: 'Configure',  sub: 'Stages, Fields & Integrations' },
      { id: 'assign',    index: 3, label: 'Publish',    sub: 'Assignment & Activation' }
    ];
    return defs.map((d) => {
      const isActive = this.currentStep === d.id;
      const stepIdx = STEPS.indexOf(d.id);
      const isDone = this.wizardStepIdx > stepIdx;
      return {
        ...d,
        isActive,
        isDone,
        // Surfaces aria-current="step" to screen readers on the active
        // step; falsy on all others so the attribute is omitted.
        ariaCurrent: isActive ? 'step' : null,
        cls: isActive
          ? 'afs-wizard__nav-step is-active'
          : isDone
            ? 'afs-wizard__nav-step is-done'
            : 'afs-wizard__nav-step',
        markCls: isActive
          ? 'afs-wizard__nav-mark is-active'
          : isDone
            ? 'afs-wizard__nav-mark is-done'
            : 'afs-wizard__nav-mark'
      };
    });
  }

  get nextDisabled() {
    // Stage 0: Initialization - LOB AND Coverage must both be picked
    // before the admin can move into the canvas. Root Product moved
    // to the Configure step (renders above the Product Hierarchy
    // stage) so the admin can scope it in the context of the canvas.
    if (this.isDefineStep) {
      if (!this.lob || !this.coverage) return true;
      // If a template already exists for the pair, force the admin to
      // pick edit-or-clone before proceeding.
      if (this.hasExistingTemplateForPair && !this.templateMode) return true;
      return false;
    }
    if (this.isAssignStep) {
      // Block the publish CTA until every required field is filled
      // and the dates are coherent - the inline error message on the
      // end date stays, but the gate stops half-baked templates from
      // shipping. The disabled CTA + inline required-field markers
      // are the only signal the admin needs - no banner restates it.
      return this.isPublishIncomplete;
    }
    return false;
  }

  // ── Publish-step required-fields gate ───────────────────────
  // Disables the "Publish Template" / "Save Changes" CTA via
  // `nextDisabled` until all version metadata is captured. Inline
  // <abbr class="slds-required">*</abbr> markers on each field
  // already announce which inputs are required.
  get isPublishIncomplete() {
    if (!this.versionName) return true;
    if (!this.effectiveStartDate) return true;
    if (!this.effectiveEndDate) return true;
    if (this.isEndBeforeStart) return true;
    return false;
  }

  // ── Define step inputs ──────────────────────────────────────
  handleNameChange(event)      { this.playbookName = event.target.value; }
  handleDeveloperChange(event) { this.developerName = event.target.value; }
  handleDescChange(event)      { this.playbookDesc = event.target.value; }

  get nameCount()    { return `${this.playbookName.length}/100`; }
  get devCount()     { return `${this.developerName.length}/100`; }
  get descCount()    { return `${this.playbookDesc.length}/100`; }

  // ── Configure step ──────────────────────────────────────────
  // The new c-rfq-playbook-setup builder owns its own UI state (active
  // stage, drag highlights, view popover). The wizard just listens for
  // assignment updates so it can persist them on Save & Next.
  handleAssignmentsChange(event) {
    const a = event.detail && event.detail.assignments;
    if (a) this.playbookAssignments = a;
  }

  // ── Wizard navigation ───────────────────────────────────────
  handleWizardClose() {
    this.wizardOpen = false;
    this.editingPlaybookId = null;
  }

  handleNext() {
    if (this.nextDisabled) return;
    if (this.wizardStepIdx === STEPS.length - 1) {
      // Final step - persist the new playbook and close the wizard.
      this.commitPlaybook();
      this.wizardOpen = false;
      return;
    }
    this.wizardStepIdx += 1;
  }

  handlePrevious() {
    if (this.wizardStepIdx === 0) return;
    this.wizardStepIdx -= 1;
  }

  commitPlaybook() {
    // Edit mode - update the existing record in place (status, version,
    // active window, and the LOB/Coverage scope) and keep its identity/
    // name/badge.
    if (this.editingPlaybookId) {
      const id = this.editingPlaybookId;
      this.playbooks = this.playbooks.map((p) =>
        p.id === id
          ? {
              ...p,
              lob: this.lob || p.lob,
              coverage: this.coverage || p.coverage,
              version: this.versionName || p.version,
              liveSince: this.effectiveStartDate || p.liveSince,
              effectiveEndDate:
                this.effectiveEndDate || p.effectiveEndDate || '',
              isActive: this.templateStatus === 'active'
            }
          : p
      );
      this.editingPlaybookId = null;
      return;
    }
    // Create-new-version mode - inherit the existing record's identity
    // (name, lob/coverage, badge, root product) so the new record reads
    // as the next version of the same template. If the new version
    // starts before the current version's effective end date, the
    // older record is deactivated on publish (overlap rule surfaced
    // in the warning copy).
    if (this.templateMode === 'clone' && this.existingPlaybook) {
      const src = this.existingPlaybook;
      const today = todayIso();
      const deactivateOld = this.versionWillDeactivateOld;
      const newPb = {
        ...src,
        id: `pb-${Date.now()}`,
        version: this.versionName || src.version,
        liveSince: this.effectiveStartDate || today,
        effectiveEndDate: this.effectiveEndDate || '',
        isActive: this.templateStatus === 'active'
      };
      const idx = this.playbooks.findIndex((p) => p.id === src.id);
      const next = this.playbooks.map((p) =>
        p.id === src.id && deactivateOld ? { ...p, isActive: false } : p
      );
      // Slot the new version directly after its predecessor so the list
      // visually pairs them.
      next.splice(idx + 1, 0, newPb);
      this.playbooks = next;
      return;
    }
    const slug = this._templateSlug();
    const name = slug ? `${slug} Template` : 'Untitled Template';
    const desc = slug
      ? `RFQ template for ${slug.toLowerCase()}.`
      : 'Custom template.';
    const newPb = {
      id: `pb-${Date.now()}`,
      name,
      desc,
      badge: 'CUSTOM',
      version: this.versionName || 'v1.0',
      liveSince: this.effectiveStartDate || '',
      effectiveEndDate: this.effectiveEndDate || '',
      isActive: this.templateStatus === 'active'
    };
    this.playbooks = [newPb, ...this.playbooks];
  }

  // The template-step "Next" label, and the rest of the steps use the
  // standard Save & Next pattern from the brief.
  get primaryActionLabel() {
    if (this.isAssignStep) {
      return this.editingPlaybookId ? 'Save Changes' : 'Publish Template';
    }
    return 'Save & Next';
  }

  get showPrevious() {
    return this.wizardStepIdx > 0;
  }

  // ── Stage 3 Publish - version + validity window ──────────
  // Templates are versioned PCM records; the admin tags each one with
  // a human-readable version name and the effective date range during
  // which brokers can launch it. End-before-start triggers an inline
  // validation message but doesn't block typing.
  get isEndBeforeStart() {
    if (!this.effectiveStartDate || !this.effectiveEndDate) return false;
    return this.effectiveEndDate < this.effectiveStartDate;
  }
  get versioningSummary() {
    if (!this.versionName && !this.effectiveStartDate && !this.effectiveEndDate) {
      return 'Stamp this template with a version name and active window before publishing.';
    }
    const parts = [];
    if (this.versionName) parts.push(this.versionName);
    if (this.effectiveStartDate && this.effectiveEndDate) {
      parts.push(`${this.effectiveStartDate} → ${this.effectiveEndDate}`);
    } else if (this.effectiveStartDate) {
      parts.push(`from ${this.effectiveStartDate}`);
    } else if (this.effectiveEndDate) {
      parts.push(`until ${this.effectiveEndDate}`);
    }
    return parts.join(' · ');
  }

  handleVersionNameChange(event) {
    // Mark as hand-edited so the auto-suggested version stops
    // overwriting the admin's value.
    this._versionEdited = true;
    this.versionName = event.target.value || '';
  }
  handleStartDateChange(event) {
    this.effectiveStartDate = event.detail?.value ?? event.target.value ?? '';
  }
  handleEndDateChange(event) {
    this.effectiveEndDate = event.detail?.value ?? event.target.value ?? '';
  }

  // ── Stage 3 Publish - Activation toggle ───────────────────
  get isTemplateActive() {
    return this.templateStatus === 'active';
  }
  get templateStatusLabel() {
    return this.isTemplateActive ? 'Active' : 'Draft';
  }
  get templateStatusTrackClass() {
    return this.isTemplateActive
      ? 'afs-toggle__track is-on'
      : 'afs-toggle__track';
  }
  handleTemplateStatusToggle() {
    this.templateStatus = this.isTemplateActive ? 'draft' : 'active';
  }

  // ── URL sync (hard-refresh continuity for the wizard) ───────
  // Mirrors `wizardOpen` + `wizardStepIdx` + `lob` + `coverage`
  // to the URL so a refresh mid-wizard keeps the admin on the
  // same step with the same flow context. Uses
  // history.replaceState so no browser history pollution.

  // One-shot flag set when the URL-restored step index had to be
  // clamped back to Initialize because LOB/Coverage were missing.
  // Surfaced as an info banner inside the Initialize panel until the
  // admin dismisses it; cleared by `handleDismissRestoreBanner`.
  @track wasRestoreClamped = false;

  connectedCallback() {
    // If the URL restored the wizard to Configure/Publish but
    // the flow context is incomplete (e.g., URL was tampered
    // with), clamp back to Initialize so the admin lands on the
    // form that can capture LOB + Coverage. Surface the clamp to
    // the admin via the dismissable restore banner so they aren't
    // mystified by a bookmark landing them on Step 1.
    if (this.wizardOpen && this.wizardStepIdx > 0 && (!this.lob || !this.coverage)) {
      this.wizardStepIdx = 0;
      this.wasRestoreClamped = true;
    }
  }

  handleDismissRestoreBanner() {
    this.wasRestoreClamped = false;
  }

  // Runs after every render so any state change picks it up
  // automatically - same pattern as c-app.
  renderedCallback() {
    this._syncWizardUrl();
  }

  _syncWizardUrl() {
    if (typeof window === 'undefined' || !window.history) return;
    const url = new URL(window.location.href);
    const params = url.searchParams;

    if (this.wizardOpen) {
      params.set('wizard', 'open');
      // Only write the step when it's non-zero so the URL stays
      // clean for the Initialize step (the default landing).
      if (this.wizardStepIdx > 0) {
        params.set('wstep', String(this.wizardStepIdx));
      } else {
        params.delete('wstep');
      }
      // Persist the picked flow so restore lands on the same
      // canvas/publish content instead of an empty form.
      if (this.lob) {
        params.set('lob', this.lob);
      } else {
        params.delete('lob');
      }
      if (this.coverage) {
        params.set('cov', this.coverage);
      } else {
        params.delete('cov');
      }
    } else {
      params.delete('wizard');
      params.delete('wstep');
      params.delete('lob');
      params.delete('cov');
    }

    const qs = params.toString();
    const next = `${url.pathname}${qs ? `?${qs}` : ''}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) {
      window.history.replaceState(null, '', next);
    }
  }
}
