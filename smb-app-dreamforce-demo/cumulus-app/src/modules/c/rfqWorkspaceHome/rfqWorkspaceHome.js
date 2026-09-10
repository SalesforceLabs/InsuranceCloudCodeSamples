import { LightningElement, api, track } from 'lwc';
import {
  homeRfqData,
  MOCK_ACCOUNTS,
  quotes,
  ADDITIONAL_HOUSEHOLD_DWELLINGS,
  ADDITIONAL_HOUSEHOLD_SCHEDULED_ITEMS,
  ADDITIONAL_HOUSEHOLD_HOMEOWNERS
} from 'data/mockData';
import { formatUsDateOrDash, nextTermFromPriorEnd } from 'data/dates';

// c-rfq-workspace-home
//
// Homeowners RFQ wizard - the third LOB workspace alongside c-rfq-workspace
// (Personal Auto) and c-rfq-workspace-eb (Employee Benefits). Mirrors PA's
// 3-step shape retitled for HO:
//   1. Property & Contents   - dwelling roster + scheduled personal property
//   2. Configure Coverages   - HO property coverages + policy coverages
//   3. Review & Submit       - market routing + submit
//
// Reuses the shared shell primitives (c-progress-path, c-toast,
// c-agentforce-panel, market dropdown pattern) exactly as PA does. Local
// state mirrors PA's controlled-view contract: children (asset tree,
// modals, coverage setup) render from the workspace's tracked state and
// dispatch typed events back for the workspace to apply.

function fmtDate(iso) {
  return formatUsDateOrDash(iso);
}

const STEP_ORDER = ['property', 'coverages', 'review'];
const STEP_TITLES = {
  property: 'Property & Contents',
  coverages: 'Configure Coverages',
  review: 'Review & Submit'
};
const HOME_STEP_DEFS = [
  { id: 'property',  label: 'Property & Contents', meta: 'Dwelling & Scheduled Items' },
  { id: 'coverages', label: 'Policy Coverages',    meta: 'Limits & Deductibles' },
  { id: 'review',    label: 'Market Routing',      meta: 'Review & Submit' }
];
const VALID_VIEWS = ['wizard', 'submitted'];
const MODE_STRAIGHT = 'straight_through';
function readInitialView() {
  if (typeof window === 'undefined') return 'wizard';
  const param = new URLSearchParams(window.location.search).get('view');
  if (param && VALID_VIEWS.includes(param)) return param;
  return 'wizard';
}

function readInitialCompleted() {
  const base = { property: false, coverages: false, review: false };
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

// Pre-seeded HO coverages A-F. Each carries an include flag, a single
// limit, and (for every coverage except Other Structures) a deductible.
// Other Structures rides the dwelling deductible, so it is limit-only.
//
// When `manual` is true (Start New Quote), every value is left blank so
// the broker has to pick from the dropdown - prevents a bogus prior
// value from leaking into a brand-new submission. On a renewal each
// value mirrors the expiring term, matching the HO coverages seeded in
// data/mockData (cov-ho-a through cov-ho-f).
function seedCoverageRanges(manual) {
  if (manual) {
    return {
      dwelling:         { included: true, limit: '', ded: '' },
      otherStructures:  { included: true, limit: '' },
      personalProperty: { included: true, limit: '', ded: '' },
      lossOfUse:        { included: true, limit: '', ded: '' },
      liability:        { included: true, limit: '', ded: '' },
      medPay:           { included: true, limit: '', ded: '' }
    };
  }
  return {
    dwelling:         { included: true, limit: '$685,000', ded: '$2,500' },
    otherStructures:  { included: true, limit: '$68,500' },
    personalProperty: { included: true, limit: '$342,500', ded: '$2,500' },
    lossOfUse:        { included: true, limit: '$137,000', ded: '$2,500' },
    liability:        { included: true, limit: '$500,000', ded: '$0' },
    medPay:           { included: true, limit: '$5,000',   ded: '$0' }
  };
}

// Read-only view - dwelling row shape used by c-hom-asset-tree.
function mapDwellingRow(li) {
  const a = li.attributes || {};
  const summaryParts = [];
  if (a.yearBuilt) summaryParts.push(`Built ${a.yearBuilt}`);
  if (a.sqFt) summaryParts.push(`${a.sqFt.toLocaleString()} sq ft`);
  if (a.construction) summaryParts.push(a.construction);
  return {
    id: li.id,
    name: li.name,
    address: [a.addressLine, a.city, a.state, a.zip].filter(Boolean).join(', '),
    yearBuilt: a.yearBuilt || '',
    construction: a.construction || '',
    roofType: a.roofType || '',
    roofYear: a.roofYear || '',
    sqFt: a.sqFt || '',
    stories: a.stories || '',
    occupancy: a.occupancy || '',
    replacementCost: a.replacementCost || 0,
    protectionClass: a.protectionClass || '',
    distanceToCoast: a.distanceToCoast || '',
    distanceToFireStation: a.distanceToFireStation || '',
    alarmSystem: a.alarmSystem || '',
    priorLosses: a.priorLosses ?? '',
    summary: summaryParts.join(' · ')
  };
}

function mapScheduledItemRow(li) {
  const a = li.attributes || {};
  return {
    id: li.id,
    name: li.name,
    category: a.category || '',
    description: a.description || '',
    appraisedValue: a.appraisedValue || li.insuredValue || 0,
    appraisalDate: a.appraisalDate || '',
    appraisedBy: a.appraisedBy || '',
    parentId: li.parentId || null
  };
}

// Named Insured participant row - shape consumed by both c-hom-asset-tree
// and c-hom-homeowner-form-fields (via the `seed` @api prop).
function mapHomeownerRow(p) {
  const first = p.firstName || (p.name || '').split(' ')[0] || '';
  const last =
    p.lastName ||
    (p.name || '').split(' ').slice(1).join(' ') ||
    '';
  return {
    id: p.id,
    name: p.name || `${first} ${last}`.trim(),
    firstName: first,
    lastName: last,
    dob: p.dob || '',
    maritalStatus: p.maritalStatus || '',
    priorCarrier: p.priorCarrier || '',
    role: p.role || 'Named Insured'
  };
}

// Target markets - reused from the PA workspace so the broker sees the
// same routing surface across LOBs (order preserved as before, but
// carriers tilt toward home/property specialists first).
const MARKETS = [
  { id: 'm1', name: 'Chubb', metadata: 'Best match · high-value homes', accent: '#0250d9' },
  { id: 'm3', name: 'Capitol Insurance', metadata: 'Regional property specialist', accent: '#0b827c' },
  { id: 'm7', name: 'Fortress Group', metadata: 'Strong home + auto bundles', accent: '#2e2e2e' },
  { id: 'm5', name: 'Vanguard Insurance', metadata: 'Last quoted 12 days ago', accent: '#06a59a' },
  { id: 'm2', name: 'Summit Insurance', metadata: 'Fast national P&C quotes', accent: '#c23934' },
  { id: 'm6', name: 'Apex Insurance', metadata: 'Household P&C incumbent', accent: '#066afe' },
  { id: 'm8', name: 'Forrest Partners', metadata: 'Non-standard property niche', accent: '#b54708' }
];

export default class RfqWorkspaceHome extends LightningElement {
  @api context;
  // In-workspace LOC session strip. Populated by the account record
  // page with all sibling RFQ tabs on the same account bundle so
  // brokers can jump between LOCs (Auto <-> Home) without leaving
  // the workspace card. Empty / single-entry lists suppress the strip.
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

  // ── Step defs surfaced on c-progress-path ─────────────────────
  homeStepDefs = HOME_STEP_DEFS;

  @track view = readInitialView();
  @track completed = readInitialCompleted();

  // ── Market Routing ─────────────────────────────────────────────
  @track selectedMarketIds = [];
  @track _marketDropdownOpen = false;

  // ── Property & Contents state ──────────────────────────────────
  @track dwellingRows = [];
  @track scheduledItemRows = [];
  // Named Insured (IPP) roster - the Homeowner subject in the HO-3 PCM.
  // Seeded from homeRfqData.participants (insured roles) and edited
  // via the Add Asset picker + the standalone edit modal.
  @track homeownerRows = [];

  // ── Coverage state ─────────────────────────────────────────────
  @track coverageRanges = seedCoverageRanges();

  // Progressive-disclosure state for the Review step's accordion.
  // Matches c-rfq-workspace's Review card: Application Details stays
  // open because it's a short key/value grid rather than a hierarchy,
  // and every roster / coverage section is collapsed on first paint so
  // the card lands as a scannable summary the broker unfolds one
  // section at a time. Keys map 1:1 to <details data-section=".."> in
  // the template, and the broker's own toggles flow back through
  // handleReviewSectionToggle.
  @track reviewSections = {
    policyDetails: true,
    dwellings: false,
    homeowners: false,
    scheduledItems: false,
    coverages: false
  };

  // Review - natural-language routing strategy.
  @track routingStrategy = '';

  // Review - effective term.
  @track effectiveFrom = homeRfqData.effectiveDate || '';
  @track effectiveTo = homeRfqData.expirationDate || '';

  // Review → Policy Details inline edit state. Only one date field can
  // be in edit mode at a time (mirrors the SLDS record-detail inline-
  // edit pattern used by the Personal Auto workspace). Set to
  // 'effectiveFrom' or 'effectiveTo' when the broker clicks the
  // matching pencil; blur/Enter clears it back to null so the row
  // snaps back to the read-only value. Policy Start / End are the only
  // two rows in `quoteDetailsHighlights` carrying `isEditable: true`.
  @track _editingDateField = null;

  // Local toast.

  // See Base Policy modal.
  @track basePolicyModalOpen = false;

  // ── Delete-LOC confirmation modal ─────────────────────────────
  // Opened by the × affordance on any pill in the session strip.
  // `_deleteLocSession` carries the target pill's { id, locLabel,
  // warningText } while the modal is open; Confirm dispatches
  // `tabclose` (c-app listens for this and drops the tab), Cancel
  // just resets the state.
  @track _deleteLocOpen = false;
  @track _deleteLocSession = null;

  // ── Modal state ────────────────────────────────────────────────
  // Two-step "Add Asset" picker - the root-level entry point for both
  // Property (dwelling) and Homeowner (Named Insured) subjects.
  @track addAssetModalOpen = false;
  // Standalone Edit modals - opened from a row's overflow menu.
  @track dwellingModalOpen = false;
  @track editingDwelling = null;
  @track scheduledItemModalOpen = false;
  @track editingScheduledItem = null;
  @track homeownerModalOpen = false;
  @track editingHomeowner = null;
  _pendingScheduledDwellingId = null;

  _marketDocClickHandler = null;

  applicationId = homeRfqData.id;

  connectedCallback() {
    const manual = this.isManualEntry;
    const ctx = this.context || {};
    const dwellingSource = manual
      ? []
      : this._resolvePriorDwellings(ctx.priorDwellingIds);
    const scheduledSource = manual
      ? []
      : this._resolvePriorScheduledItems(ctx.priorScheduledItemIds);
    this.dwellingRows = dwellingSource.map(mapDwellingRow);
    this.scheduledItemRows = scheduledSource.map(mapScheduledItemRow);
    // Named Insured roster - blank on manual entry so the broker adds
    // the household homeowners via the Add Asset picker; otherwise
    // seed from the prior policy's participant list.
    this.homeownerRows = manual ? [] : this._resolvePriorHomeowners();

    // Effective term precedence mirrors PA:
    //   1. Intake modal pick (ctx.effectiveFrom / To).
    //   2. Day after the prior policy's Effective To (n+1), one year.
    //   3. homeRfqData defaults (already tracked).
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

    // Re-seed coverage state with the manual-entry flag in scope.
    this.coverageRanges = seedCoverageRanges(manual);

    // Straight-through path - skip the wizard, dispatch risksubmitted.
    if (this.context?.renewalMode === MODE_STRAIGHT) {
      this.completed = { property: true, coverages: true, review: true };
      this.view = 'submitted';
      Promise.resolve().then(() => {
        this.dispatchEvent(
          new CustomEvent('risksubmitted', {
            detail: {
              accountName: this.accountName,
              applicationName: this.appName,
              message:
                'Straight-through renewal initiated with Chubb. Click Compare Quotes in Slack to review the incumbent terms and bind.'
            },
            bubbles: true,
            composed: true
          })
        );
      });
    }
  }

  disconnectedCallback() {
    this._unbindMarketDocClick();
  }

  // Resolve intake priorDwellingIds against homeRfqData.lineItems so each
  // prior policy can carry its own snapshot. Falls back to the full
  // default fleet when no ids were supplied.
  _resolvePriorDwellings(ids) {
    const dwellings = (homeRfqData.lineItems || []).filter(
      (li) => li.itemType === 'dwelling'
    );
    if (!Array.isArray(ids)) return dwellings;
    const map = new Map(dwellings.map((li) => [li.id, li]));
    return ids.map((id) => map.get(id)).filter(Boolean);
  }

  _resolvePriorScheduledItems(ids) {
    const items = (homeRfqData.lineItems || []).filter(
      (li) => li.itemType === 'scheduledItem'
    );
    if (!Array.isArray(ids)) return items;
    const map = new Map(items.map((li) => [li.id, li]));
    return ids.map((id) => map.get(id)).filter(Boolean);
  }

  // Filter homeRfqData.participants to the insured roles (Named Insured
  // + Co-Insured) - the Producer row is a broker/agent contact, not a
  // policy homeowner, so it's excluded from the wizard roster.
  _resolvePriorHomeowners() {
    const insuredRoles = new Set(['Named Insured', 'Co-Insured']);
    return (homeRfqData.participants || [])
      .filter((p) => insuredRoles.has(p.role))
      .map(mapHomeownerRow);
  }

  // ── View flags ─────────────────────────────────────────────────
  get isWizard() {
    return this.view === 'wizard';
  }
  get isSubmitted() {
    return this.view === 'submitted';
  }

  // ── Step flags (one true at a time) ────────────────────────────
  get isOnPropertyStep() {
    return !this.completed.property && this.isWizard;
  }
  get isOnCoveragesStep() {
    return (
      this.completed.property && !this.completed.coverages && this.isWizard
    );
  }
  // Terminal step - stays rendered after `_saveRfqToBundle` flips
  // completed.review to true (which keeps view === 'wizard'), so a
  // saved LOC tab still paints its Review card instead of an empty
  // workspace body. Same gate as c-rfq-workspace.
  get isOnReviewStep() {
    return (
      this.completed.property &&
      this.completed.coverages &&
      this.isWizard
    );
  }

  get propertySectionClass() {
    return this.isOnPropertyStep ? 'block is-current' : 'block';
  }
  get coveragesSectionClass() {
    return this.isOnCoveragesStep ? 'block is-current' : 'block';
  }

  get activeStep() {
    return STEP_ORDER.find((id) => !this.completed[id]) || 'review';
  }

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

  // ── Account / context derivation ───────────────────────────────
  get appName() {
    return this.context?.applicationName || homeRfqData.applicationName;
  }

  get account() {
    const id = this.context?.accountId || homeRfqData.accountId;
    return MOCK_ACCOUNTS.find((a) => a.id === id) || homeRfqData.account;
  }

  get accountName() {
    return (
      this.context?.accountName ||
      this.account?.name ||
      homeRfqData.account?.name
    );
  }

  get effectiveLabel() {
    return fmtDate(homeRfqData.effectiveDate);
  }

  get deadlineLabel() {
    return fmtDate(homeRfqData.responseDeadline);
  }

  get launchedFromAccount() {
    return !!this.context?.launchedFromAccount;
  }

  // ── Manual-entry vs cloned-from-prior ──────────────────────────
  get isManualEntry() {
    return (
      this.context?.startMode === 'scratch' ||
      this.context?.priorPolicyValue === 'none'
    );
  }

  get dwellingsCount() {
    return this.dwellingRows.length;
  }

  get scheduledItemsCount() {
    return this.scheduledItemRows.length;
  }

  get homeownersCount() {
    return this.homeownerRows.length;
  }

  get hasNoDwellings() {
    return this.dwellingRows.length === 0;
  }

  get hasNoHomeowners() {
    return this.homeownerRows.length === 0;
  }

  // Only the dwelling is mandatory to leave step 1. Homeowners and
  // scheduled items remain optional here and can be captured later in
  // the flow (or filled in from a linked prior policy).
  get canContinueProperty() {
    return this.dwellingRows.length > 0;
  }

  get continuePropertyDisabled() {
    return !this.canContinueProperty;
  }

  get scheduleSubtitle() {
    if (this.isManualEntry) {
      return 'Add the primary dwelling for this RFQ, then attach any scheduled personal property (jewelry, art, collectibles) as separate line items.';
    }
    const label =
      this.context?.priorPolicy ||
      homeRfqData.priorPolicyLabel ||
      'the prior policy';
    return `Imported from ${label}. Edit per-row if anything has changed at renewal.`;
  }

  // ── Dwellings surfaced in the Add Dwelling modal lookup ────────
  get availableDwellingsForLookup() {
    const onRfq = new Set(this.dwellingRows.map((r) => r.id));
    const catalog = [
      ...(homeRfqData.lineItems || []).filter(
        (li) => li.itemType === 'dwelling'
      ),
      ...ADDITIONAL_HOUSEHOLD_DWELLINGS
    ];
    return catalog.filter((li) => !onRfq.has(li.id));
  }

  get availableScheduledItemsForLookup() {
    const onRfqIds = new Set(this.scheduledItemRows.map((r) => r.id));
    const catalog = [
      ...(homeRfqData.lineItems || []).filter(
        (li) => li.itemType === 'scheduledItem'
      ),
      ...ADDITIONAL_HOUSEHOLD_SCHEDULED_ITEMS
    ];
    return catalog.filter((li) => !onRfqIds.has(li.id));
  }

  // Homeowners surfaced in the Add Homeowner lookup - the account's
  // additional adult members minus anyone already on this RFQ. Matched
  // by id first so a freshly-added ad-hoc homeowner without a catalog
  // entry doesn't hide a legitimate lookup candidate.
  get availableHomeownersForLookup() {
    const onRfqIds = new Set(this.homeownerRows.map((r) => r.id));
    return ADDITIONAL_HOUSEHOLD_HOMEOWNERS.filter(
      (p) => !onRfqIds.has(p.id)
    );
  }

  // ── Add Asset picker options (Property vs Homeowner) ─────────────
  // Per HO-3 PCM: Property (IPA) + Named Insured (IPP) are parallel
  // Level-1 subjects, so both are first-class picker entries. Scheduled
  // personal property stays a child of Dwelling and is added from a
  // dwelling row's overflow menu, not from the root picker.
  get assetPickerOptions() {
    return [
      {
        id: 'property',
        label: 'Property',
        description:
          'Add a dwelling to the schedule (primary residence, secondary, or rental).',
        // House glyph (Material-style).
        iconPath: 'M12 3l9 8h-3v9h-4v-6h-4v6H6v-9H3l9-8z'
      },
      {
        id: 'homeowner',
        label: 'Homeowner',
        description:
          'Add a named insured to the policy - Name, DOB, Marital Status, Prior Carrier.',
        // Person glyph (Material-style).
        iconPath:
          'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'
      }
    ];
  }

  // ── Add Asset (root-level picker) ─────────────────────────────────
  handleAddAsset() {
    this.addAssetModalOpen = true;
  }

  // Router for the two-step picker's save event - dispatches by kind
  // to the existing dwelling / homeowner append helpers so the rest
  // of the workspace stays unchanged.
  handleAddAssetModalSave(event) {
    const { kind, record } = event.detail || {};
    if (kind === 'property' && record) {
      this._appendDwellingFromForm(record);
    } else if (kind === 'homeowner' && record) {
      this._appendHomeownerFromForm(record);
    }
    this.addAssetModalOpen = false;
  }

  handleAddAssetModalCancel() {
    this.addAssetModalOpen = false;
  }

  // ── Add / Edit Dwelling ────────────────────────────────────────
  // Retained for legacy call sites; the primary entry point is now the
  // Add Asset picker above. The dwelling standalone modal is still used
  // for the row overflow "Edit Property" action.
  handleAddDwelling() {
    this.editingDwelling = null;
    this.dwellingModalOpen = true;
  }

  handleEditDwellingRequest(event) {
    const { dwellingId } = event.detail || {};
    const row = this.dwellingRows.find((d) => d.id === dwellingId);
    if (!row) return;
    this.editingDwelling = { ...row };
    this.dwellingModalOpen = true;
  }

  handleDwellingModalCancel() {
    this.dwellingModalOpen = false;
    this.editingDwelling = null;
  }

  handleDwellingModalSave(event) {
    const dwelling = event?.detail?.dwelling;
    const id = event?.detail?.id;
    if (dwelling && id) {
      this._updateDwellingFromForm(id, dwelling);
    } else if (dwelling) {
      this._appendDwellingFromForm(dwelling);
    }
    this.dwellingModalOpen = false;
    this.editingDwelling = null;
  }

  _updateDwellingFromForm(id, dwelling) {
    this.dwellingRows = this.dwellingRows.map((row) =>
      row.id === id
        ? {
            ...row,
            name: dwelling.name || row.name,
            address: dwelling.address || row.address,
            yearBuilt: dwelling.yearBuilt || row.yearBuilt,
            construction: dwelling.construction || row.construction,
            roofType: dwelling.roofType || row.roofType,
            roofYear: dwelling.roofYear || row.roofYear,
            sqFt: dwelling.sqFt || row.sqFt,
            stories: dwelling.stories || row.stories,
            occupancy: dwelling.occupancy || row.occupancy,
            replacementCost:
              dwelling.replacementCost != null
                ? dwelling.replacementCost
                : row.replacementCost,
            protectionClass: dwelling.protectionClass || row.protectionClass,
            summary: dwelling.summary || row.summary
          }
        : row
    );
  }

  _appendDwellingFromForm(dwelling) {
    // Preserve catalog id when the broker picks from the lookup so
    // subsequent lookups continue to exclude it correctly.
    const id = dwelling.id || `dwl-new-${Date.now()}`;
    const row = {
      id,
      name: dwelling.name || dwelling.address || 'New Dwelling (Pending Details)',
      address: dwelling.address || '',
      yearBuilt: dwelling.yearBuilt || '',
      construction: dwelling.construction || '',
      roofType: dwelling.roofType || '',
      roofYear: dwelling.roofYear || '',
      sqFt: dwelling.sqFt || '',
      stories: dwelling.stories || '',
      occupancy: dwelling.occupancy || 'Primary Residence',
      replacementCost: dwelling.replacementCost || 0,
      protectionClass: dwelling.protectionClass || '',
      distanceToCoast: dwelling.distanceToCoast || '',
      distanceToFireStation: dwelling.distanceToFireStation || '',
      alarmSystem: dwelling.alarmSystem || '',
      priorLosses: dwelling.priorLosses ?? '',
      summary: dwelling.summary || ''
    };
    this.dwellingRows = [...this.dwellingRows, row];
  }

  handleRemoveDwellingRequest(event) {
    const { dwellingId } = event.detail || {};
    if (!dwellingId) return;
    this.dwellingRows = this.dwellingRows.filter((d) => d.id !== dwellingId);
    // Prune any scheduled items that had been attached to this dwelling.
    this.scheduledItemRows = this.scheduledItemRows.filter(
      (s) => s.parentId !== dwellingId
    );
  }

  // ── Add / Edit Scheduled Personal Property ─────────────────────
  handleAddScheduledItem(event) {
    this._pendingScheduledDwellingId =
      event?.detail?.dwellingId ||
      (this.dwellingRows[0] && this.dwellingRows[0].id) ||
      null;
    this.editingScheduledItem = null;
    this.scheduledItemModalOpen = true;
  }

  handleEditScheduledItemRequest(event) {
    const { itemId } = event.detail || {};
    const row = this.scheduledItemRows.find((s) => s.id === itemId);
    if (!row) return;
    this._pendingScheduledDwellingId = row.parentId || null;
    this.editingScheduledItem = { ...row };
    this.scheduledItemModalOpen = true;
  }

  handleScheduledItemModalCancel() {
    this.scheduledItemModalOpen = false;
    this.editingScheduledItem = null;
    this._pendingScheduledDwellingId = null;
  }

  handleScheduledItemModalSave(event) {
    const item = event?.detail?.item;
    if (!item) {
      this.scheduledItemModalOpen = false;
      return;
    }
    if (this.editingScheduledItem && this.editingScheduledItem.id) {
      this._updateScheduledItem(this.editingScheduledItem.id, item);
    } else {
      this._appendScheduledItem(item, this._pendingScheduledDwellingId);
    }
    this.scheduledItemModalOpen = false;
    this.editingScheduledItem = null;
    this._pendingScheduledDwellingId = null;
  }

  _appendScheduledItem(item, parentId) {
    const id = item.id || `sch-new-${Date.now()}`;
    const row = {
      id,
      name: item.name || 'New Scheduled Item',
      category: item.category || '',
      description: item.description || '',
      appraisedValue: item.appraisedValue || 0,
      appraisalDate: item.appraisalDate || '',
      appraisedBy: item.appraisedBy || '',
      parentId: parentId || null
    };
    this.scheduledItemRows = [...this.scheduledItemRows, row];
  }

  _updateScheduledItem(id, item) {
    this.scheduledItemRows = this.scheduledItemRows.map((row) =>
      row.id === id
        ? {
            ...row,
            name: item.name || row.name,
            category: item.category || row.category,
            description: item.description || row.description,
            appraisedValue:
              item.appraisedValue != null
                ? item.appraisedValue
                : row.appraisedValue,
            appraisalDate: item.appraisalDate || row.appraisalDate,
            appraisedBy: item.appraisedBy || row.appraisedBy
          }
        : row
    );
  }

  handleRemoveScheduledItemRequest(event) {
    const { itemId } = event.detail || {};
    if (!itemId) return;
    this.scheduledItemRows = this.scheduledItemRows.filter(
      (s) => s.id !== itemId
    );
  }

  get pendingScheduledDwellingName() {
    const dwl = this.dwellingRows.find(
      (d) => d.id === this._pendingScheduledDwellingId
    );
    return dwl?.name || '';
  }

  // ── Add / Edit Homeowner (Named Insured) ───────────────────────
  handleAddHomeowner() {
    this.editingHomeowner = null;
    this.homeownerModalOpen = true;
  }

  handleEditHomeownerRequest(event) {
    const { homeownerId } = event.detail || {};
    const row = this.homeownerRows.find((h) => h.id === homeownerId);
    if (!row) return;
    this.editingHomeowner = { ...row };
    this.homeownerModalOpen = true;
  }

  handleHomeownerModalCancel() {
    this.homeownerModalOpen = false;
    this.editingHomeowner = null;
  }

  handleHomeownerModalSave(event) {
    const homeowner = event?.detail?.homeowner;
    const id = event?.detail?.id;
    if (homeowner && id) {
      this._updateHomeownerFromForm(id, homeowner);
    } else if (homeowner) {
      this._appendHomeownerFromForm(homeowner);
    }
    this.homeownerModalOpen = false;
    this.editingHomeowner = null;
  }

  _appendHomeownerFromForm(homeowner) {
    // Preserve catalog id when the broker picked from the lookup so
    // subsequent lookups continue to exclude it correctly.
    const id = homeowner.id || `p-new-${Date.now()}`;
    const first = homeowner.firstName || '';
    const last = homeowner.lastName || '';
    const row = {
      id,
      firstName: first,
      lastName: last,
      name: homeowner.name || `${first} ${last}`.trim() || 'New Homeowner',
      dob: homeowner.dob || '',
      maritalStatus: homeowner.maritalStatus || '',
      priorCarrier: homeowner.priorCarrier || '',
      role: homeowner.role || 'Named Insured'
    };
    this.homeownerRows = [...this.homeownerRows, row];
  }

  _updateHomeownerFromForm(id, homeowner) {
    this.homeownerRows = this.homeownerRows.map((row) =>
      row.id === id
        ? {
            ...row,
            firstName: homeowner.firstName || row.firstName,
            lastName: homeowner.lastName || row.lastName,
            name:
              homeowner.name ||
              `${homeowner.firstName || row.firstName} ${
                homeowner.lastName || row.lastName
              }`.trim(),
            dob: homeowner.dob || row.dob,
            maritalStatus: homeowner.maritalStatus || row.maritalStatus,
            priorCarrier:
              homeowner.priorCarrier != null
                ? homeowner.priorCarrier
                : row.priorCarrier,
            role: homeowner.role || row.role
          }
        : row
    );
  }

  handleRemoveHomeownerRequest(event) {
    const { homeownerId } = event.detail || {};
    if (!homeownerId) return;
    this.homeownerRows = this.homeownerRows.filter(
      (h) => h.id !== homeownerId
    );
  }

  // ── Step 1 - confirm ───────────────────────────────────────────
  confirmProperty() {
    if (!this.canContinueProperty) return;
    this.completed = { ...this.completed, property: true };
  }

  // ── Step 2 - coverage handlers ─────────────────────────────────
  handleCoverageRangeChange(event) {
    const { key, field, value } = event.detail || {};
    if (!key || !field) return;
    this.coverageRanges = {
      ...this.coverageRanges,
      [key]: { ...(this.coverageRanges[key] || {}), [field]: value }
    };
  }

  confirmCoverages() {
    this.completed = {
      ...this.completed,
      property: true,
      coverages: true
    };
  }

  // ── Step 3 - target markets dropdown ───────────────────────────
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
  get marketDropdownTriggerLabel() {
    if (!this.selectedMarketIds.length) return 'Choose target markets';
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
  get selectedMarketsLabel() {
    if (!this.selectedMarketIds.length) return 'No markets selected yet';
    return this.selectedMarketIds
      .map((id) => MARKETS.find((m) => m.id === id)?.name)
      .filter(Boolean)
      .join(' · ');
  }
  get marketSelectHint() {
    const n = this.selectedMarketIds.length;
    if (!n)
      return 'Pick carriers from the list - the order you check them sets the send priority.';
    return `${n} market${n === 1 ? '' : 's'} selected · sent in the numbered order.`;
  }

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

  handleMarketDropdownToggle(event) {
    event.stopPropagation();
    this._marketDropdownOpen = !this._marketDropdownOpen;
    if (this._marketDropdownOpen) this._bindMarketDocClick();
    else this._unbindMarketDocClick();
  }

  stopMarketDropdownPropagation(event) {
    event.stopPropagation();
  }

  _bindMarketDocClick() {
    if (this._marketDocClickHandler) return;
    this._marketDocClickHandler = () => {
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

  // ── Review derived views ───────────────────────────────────────
  _fmtReviewDate(iso) {
    return formatUsDateOrDash(iso);
  }

  // Row shape mirrors the Personal Auto workspace so the Review step
  // reads the same across lines of coverage:
  //   { key, label, value,            (always present)
  //     isEditable,                   true only for the date rows
  //     isEditing,                    true when this row is the current
  //                                   inline-edit target
  //     dateField,                    'effectiveFrom' | 'effectiveTo'
  //     dateInputValue,               raw ISO yyyy-mm-dd for the input
  //     showBasePolicyLink }          true only for Prior Policy
  //
  // The three identity rows (Application ID / Application Name / Line
  // of Coverage) lead so the broker's eye lands on "what is this RFQ"
  // first; the mutable term-window rows follow so the two pencils
  // cluster together.
  get quoteDetailsHighlights() {
    const ctx = this.context || {};
    const priorLabel =
      ctx.priorPolicy || homeRfqData.priorPolicyLabel || '';
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
        value: ctx.loc || 'Homeowners',
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
  // Pencil click sets `_editingDateField`, which flips the row's
  // `isEditing` flag and swaps the read-only text for an
  // <input type="date">. Change writes straight back to the tracked
  // property; blur / Enter / Escape collapses the row back to text.
  handleEditPolicyDate(event) {
    const field = event?.currentTarget?.dataset?.field;
    if (field !== 'effectiveFrom' && field !== 'effectiveTo') return;
    this._editingDateField = field;
    // lwc:ref needs a static identifier and both date rows share one
    // template branch, so the freshly-rendered input is grabbed by
    // query on the next frame to back up the native `autofocus`.
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

  // ── Section pencils on the Review accordions ─────────────────────
  // Each pencil jumps back to the step that authors that section's
  // data, so the broker can correct it and walk forward again -
  // goToStep preserves everything already captured. The buttons live
  // inside <summary> elements, so every handler stops the click from
  // also toggling its parent <details> open/closed.
  _editSection(event, stepId) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.goToStep(stepId);
  }

  handleEditDwellings(event) {
    this._editSection(event, 'property');
  }

  handleEditHomeowners(event) {
    this._editSection(event, 'property');
  }

  handleEditScheduledItems(event) {
    this._editSection(event, 'property');
  }

  handleEditPolicyCoverages(event) {
    this._editSection(event, 'coverages');
  }

  get quoteDetailsDwellings() {
    return this.dwellingRows.map((d) => ({
      id: d.id,
      address: d.address || d.name,
      yearBuilt: d.yearBuilt || '-',
      construction: d.construction || '-',
      replacementCostDisplay:
        typeof d.replacementCost === 'number' && d.replacementCost > 0
          ? d.replacementCost.toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0
            })
          : '-'
    }));
  }

  get quoteDetailsScheduledItems() {
    return this.scheduledItemRows.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category || '-',
      appraisedDisplay:
        typeof s.appraisedValue === 'number' && s.appraisedValue > 0
          ? s.appraisedValue.toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0
            })
          : '-'
    }));
  }

  get quoteDetailsHomeowners() {
    return this.homeownerRows.map((h) => ({
      id: h.id,
      firstName: h.firstName || '-',
      lastName: h.lastName || '-',
      dobDisplay: this._fmtReviewDate(h.dob),
      maritalStatus: h.maritalStatus || '-',
      priorCarrier: h.priorCarrier || '-',
      role: h.role || 'Named Insured'
    }));
  }

  get hasHomeownersForReview() {
    return this.homeownerRows.length > 0;
  }

  get hasScheduledItemsForReview() {
    return this.scheduledItemRows.length > 0;
  }

  // ── Review accordion (progressive disclosure) ──────────────────
  // Individual open-state getters back the `open={...}` binding on
  // each <details> element so LWC can push the initial state
  // (Application Details open by default) and updates flow the other way
  // via handleReviewSectionToggle.
  get isPolicyDetailsOpen() {
    return this.reviewSections?.policyDetails === true;
  }
  get isDwellingsSectionOpen() {
    return this.reviewSections?.dwellings === true;
  }
  get isHomeownersSectionOpen() {
    return this.reviewSections?.homeowners === true;
  }
  get isScheduledItemsSectionOpen() {
    return this.reviewSections?.scheduledItems === true;
  }
  get isCoveragesSectionOpen() {
    return this.reviewSections?.coverages === true;
  }

  // Count labels for the accordion summaries. Singular / plural swap
  // so "1 Dwelling" / "2 Dwellings" reads naturally. Zero-safe -
  // sections with empty rosters still render their count for
  // transparency.
  get dwellingCountLabel() {
    const n = (this.dwellingRows || []).length;
    return `${n} Dwelling${n === 1 ? '' : 's'}`;
  }
  get homeownerCountLabel() {
    const n = (this.homeownerRows || []).length;
    return `${n} Homeowner${n === 1 ? '' : 's'}`;
  }
  get scheduledItemsCountLabel() {
    const n = (this.scheduledItemRows || []).length;
    return `${n} Item${n === 1 ? '' : 's'}`;
  }

  // High-level rollup for the Application Details summary line - LOC name
  // + effective range so the collapsed section still reads as useful
  // context. Falls back to just the LOC when either date is missing.
  get policyDetailsSummary() {
    const loc = this.context?.loc || 'Homeowners';
    if (this.effectiveFrom && this.effectiveTo) {
      return `${loc} · ${this._fmtReviewDate(this.effectiveFrom)} to ${this._fmtReviewDate(this.effectiveTo)}`;
    }
    return loc;
  }

  // Included-coverage count for the Policy Coverages summary line.
  // Counts anything that isn't explicitly `included: false` so
  // endorsements (waterBackup / serviceLine) surface once opted in.
  get coverageSectionSummary() {
    const cr = this.coverageRanges || {};
    const included = Object.keys(cr).filter(
      (k) => cr[k]?.included !== false
    ).length;
    return `${included} Coverage${included === 1 ? '' : 's'} included`;
  }

  // Human-readable coverage lines for the expanded Policy Coverages
  // section. Order mirrors seedCoverageRanges so the list is stable:
  // property coverages A-D first, then the two policy-level lines.
  get reviewPolicyCoverages() {
    const cr = this.coverageRanges || {};
    const spec = [
      { key: 'dwelling', label: 'Dwelling' },
      { key: 'otherStructures', label: 'Other Structures' },
      { key: 'personalProperty', label: 'Personal Property' },
      { key: 'lossOfUse', label: 'Loss of Use' },
      { key: 'liability', label: 'Personal Liability' },
      { key: 'medPay', label: 'Med Pay to Others' }
    ];
    return spec.map(({ key, label }) => {
      const row = cr[key] || {};
      const included = row.included !== false;
      const parts = [];
      if (row.limit) {
        parts.push(`Limit ${row.limit}`);
      }
      if (row.ded) {
        parts.push(`Deductible ${row.ded}`);
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

  // Native <details>/<summary> gives us keyboard-toggle + a11y for
  // free. Mirror the open state into reviewSections on the browser-
  // driven `toggle` event so LWC's reactive world stays in sync
  // with the DOM.
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

  // ── Bundle Review: snapshot publishing ────────────────────────
  // Symmetric with rfqWorkspace.buildReviewSnapshot(). Consumer is
  // c-loc-review-panel, which switches its layout on locKind. See
  // the shape docs at the top of that component.
  buildReviewSnapshot() {
    const ctx = this.context || {};
    const dwellings = this.quoteDetailsDwellings || [];
    const homeowners = this.quoteDetailsHomeowners || [];
    const scheduledItems = this.quoteDetailsScheduledItems || [];
    const coverages = this.reviewPolicyCoverages || [];
    const highlights = this.quoteDetailsHighlights || [];
    const hasContent =
      dwellings.length > 0 ||
      homeowners.length > 0 ||
      scheduledItems.length > 0 ||
      coverages.some((c) => c.included);
    return {
      tabId: ctx.rfqId || null,
      locKind: 'home',
      locLabel: ctx.loc || 'Homeowners',
      application: this.appName,
      insured: this.accountName,
      status: this.completed?.review ? 'Ready' : 'Draft',
      policyDetails: {
        loc: ctx.loc || 'Homeowners',
        effectiveFrom: this.effectiveFrom || '',
        effectiveTo: this.effectiveTo || '',
        summary: this.policyDetailsSummary,
        highlights
      },
      // Auto-only arrays kept empty so consumers can iterate safely
      // regardless of locKind.
      vehicles: [],
      drivers: [],
      dwellings,
      homeowners,
      scheduledItems,
      coverages,
      counts: {
        dwellings: this.dwellingCountLabel,
        homeowners: this.homeownerCountLabel,
        scheduledItems: this.scheduledItemsCountLabel,
        coverages: this.coverageSectionSummary
      },
      hasContent
    };
  }

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
    this._publishReviewSnapshot();
  }

  // ── Bundle Review tab bar ─────────────────────────────────────
  // Symmetric with rfqWorkspace's implementation. See that file for
  // architecture notes; the only difference here is self's
  // locLabel defaults to 'Homeowners' and completed flag reads from
  // the Home wizard's step state.
  get _selfReviewTabDescriptor() {
    const ctx = this.context || {};
    return {
      id: ctx.rfqId || 'self',
      locLabel: ctx.loc || 'Homeowners',
      status: this.completed?.review ? 'Ready' : 'In progress',
      isSelf: true
    };
  }

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

  get showBundleReviewTabs() {
    return this.bundleReviewTabs.length > 1;
  }

  get isReviewingSelf() {
    const selfId = this._selfReviewTabDescriptor.id;
    if (!this.activeReviewTabId || this.activeReviewTabId === selfId) return true;
    const known = (this.siblingReviewPayloads || []).some(
      (p) => p.tabId === this.activeReviewTabId
    );
    return !known;
  }

  get activeSiblingPayload() {
    if (this.isReviewingSelf) return null;
    return (this.siblingReviewPayloads || []).find(
      (p) => p.tabId === this.activeReviewTabId
    );
  }

  handleReviewTabClick(event) {
    if (event?.type === 'keydown') {
      const key = event.key;
      if (key !== 'Enter' && key !== ' ' && key !== 'Spacebar') return;
      event.preventDefault();
    }
    const id = event?.currentTarget?.dataset?.tabId;
    if (!id) return;
    const selfId = this._selfReviewTabDescriptor.id;
    this.activeReviewTabId = id === selfId ? null : id;
  }

  get reviewCoverageSummary() {
    const cr = this.coverageRanges || {};
    const included = Object.keys(cr).filter(
      (k) => cr[k]?.included !== false
    ).length;
    // The dwelling stands in for the property deductible in the summary
    // line - it is the figure a broker quotes when asked "what's the
    // deductible on this house?".
    return `${included} coverage${
      included === 1 ? '' : 's'
    } included · Dwelling ${
      cr.dwelling?.limit || '-'
    } · Deductible ${cr.dwelling?.ded || '-'}`;
  }

  // ── Base Policy modal ──────────────────────────────────────────
  // True when any Application Details row carries the base-policy
  // link, so the CTA renders once under the grid rather than inside the
  // Prior Policy cell. Mirrors c-rfq-workspace.
  get showBasePolicyCta() {
    return this.quoteDetailsHighlights.some((h) => h.showBasePolicyLink);
  }

  get hasPriorPolicy() {
    return !this.isManualEntry;
  }

  get priorPolicyDetails() {
    const ctx = this.context || {};
    const label = ctx.priorPolicy || homeRfqData.priorPolicyLabel || '';
    let carrier = ctx.priorCarrier;
    if (!carrier && label) {
      const segs = label.split(/[-–-]/);
      carrier = segs.length > 1 ? segs[segs.length - 1].trim() : label.trim();
    }
    const number = ctx.priorPolicyNumber || ctx.priorPolicyId || '-';

    let premiumNum = null;
    if (ctx.priorPremium != null && ctx.priorPremium !== '') {
      const n = Number(ctx.priorPremium);
      if (!Number.isNaN(n)) premiumNum = n;
    }
    if (premiumNum == null) {
      const appId = ctx.applicationId || homeRfqData.id;
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

    return {
      carrier: carrier || '-',
      number,
      premium,
      fourthLabel,
      fourthValue
    };
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

  // ── Submit ─────────────────────────────────────────────────────
  buildAssetPayload() {
    return {
      policy: {
        coverageRanges: { ...this.coverageRanges }
      },
      dwellings: this.dwellingRows.map((d) => ({
        id: d.id,
        name: d.name,
        address: d.address,
        replacementCost: d.replacementCost,
        yearBuilt: d.yearBuilt,
        construction: d.construction,
        roofType: d.roofType,
        sqFt: d.sqFt,
        scheduledItems: this.scheduledItemRows
          .filter((s) => s.parentId === d.id)
          .map((s) => ({
            id: s.id,
            name: s.name,
            category: s.category,
            appraisedValue: s.appraisedValue
          }))
      })),
      // Named Insured (IPP) subject - siblings of Property in the HO-3
      // PCM. Markets receive the full homeowner block alongside the
      // property schedule.
      homeowners: this.homeownerRows.map((h) => ({
        id: h.id,
        firstName: h.firstName,
        lastName: h.lastName,
        name: h.name,
        dob: h.dob,
        maritalStatus: h.maritalStatus,
        priorCarrier: h.priorCarrier,
        role: h.role || 'Named Insured'
      }))
    };
  }

  updateRoutingStrategy(event) {
    this.routingStrategy = event.target.value;
  }

  // Persists the current RFQ into the account bundle (Draft ->
  // Ready) and pins the workspace on the Saved-to-Bundle interstitial.
  // Shared entry point for the Review page's fork actions
  // (handleOpenAddLob / handleSaveToBoard) so bundle bookkeeping
  // stays in one place. Mirrors the pattern in c-rfq-workspace so
  // both LOC variants surface identical status on the RFQ list +
  // Submission Board.
  _saveRfqToBundle() {
    this.completed = {
      ...this.completed,
      property: true,
      coverages: true,
      review: true
    };
    this.dispatchEvent(
      new CustomEvent('risksubmitted', {
        detail: {
          rfqId: this.context?.rfqId || null,
          accountId: this.context?.accountId || null,
          accountName: this.accountName,
          applicationName: this.appName,
          lob: this.context?.lob || null,
          loc: this.context?.loc || null,
          routingStrategy: this.routingStrategy || null,
          effectiveFrom: this.effectiveFrom || null,
          effectiveTo: this.effectiveTo || null,
          // Draft -> Ready for Submission. Carriers are picked on the
          // Submission Board, not from Review any more.
          newStatus: 'Ready for Submission',
          assetPayload: this.buildAssetPayload()
        },
        bubbles: true,
        composed: true
      })
    );
    // Keep the workspace on the Review view. The fork CTAs on Review
    // navigate the account page to the next destination (Submission
    // Board or intake modal) via the fork's second call, so the
    // Saved-to-Bundle interstitial is no longer the right landing
    // state - it just pinned the workspace tab to an empty panel.
    requestAnimationFrame(() => {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // Legacy alias for external callers that still use the pre-fork
  // "submit to markets" name. Reroutes to the bundle save so no
  // wiring in the app shell needs to change.
  submitToMarkets() {
    this._saveRfqToBundle();
  }

  // Review page's ghost CTA: "+ Add Another Line of Coverage".
  // Persists the current RFQ into the bundle (Draft -> Ready) and
  // reopens the intake modal at the app shell in "add a LOC" mode.
  handleOpenAddLob() {
    this._saveRfqToBundle();
    this.handleAddAnotherLoc();
  }

  // Review page's primary CTA: "Add to Submission Board". Persists
  // the current RFQ into the bundle (Draft -> Ready) and pivots the
  // account page's secondary tabs to the Submission Board.
  handleSaveToBoard() {
    this._saveRfqToBundle();
    this.handleProceedToBoard();
  }

  // Navigate the app shell to the Submission Board tab on the
  // owning account. Used by handleSaveToBoard and by the Saved-to-
  // Bundle interstitial's "Proceed" button when it's wired up later.
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

  handleStepSelect(event) {
    this.goToStep(event.detail?.stepId);
  }

  handleLaunchAgentforce(event) {
    const panel = this.refs && this.refs.agentforcePanel;
    if (panel && typeof panel.startContextualChat === 'function') {
      panel.startContextualChat(event.detail || {});
    }
  }

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
          route: this.launchedFromAccount
            ? 'account-record-page'
            : 'run-my-day'
        },
        bubbles: true,
        composed: true
      })
    );
  }

  // ── In-workspace LOC session strip ──────────────────────────────
  // The account record page hands us the full list of sibling RFQ
  // tabs on the same account bundle (via @api sessionTabs). Only
  // surface the strip once the bundle has 2+ LOCs so single-LOC
  // workspaces stay uncluttered.
  get showSessionStrip() {
    return Array.isArray(this.sessionTabs) && this.sessionTabs.length > 1;
  }

  // Each pill carries its 1-based position (rendered inside the
  // number badge) and the state class its tint comes from. Mirrors
  // the shape used in c-rfq-workspace so both variants render
  // identical strips.
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
        // WAI-ARIA tab wiring - mirror Auto workspace so a11y is
        // consistent when the broker chains Home + Auto + EB.
        tabDomId: `p15-sess-tab-${s.id}`,
        panelDomId: this._workspacePanelDomId,
        // Every sibling LOC pill carries a × delete affordance. The
        // flag is defensive: if the strip is later extended with an
        // "Add LOC" trailing pill, it will ship with showClose:false
        // so the delete gesture stays scoped to real LOCs.
        showClose: true,
        className
      };
    });
  }

  // Tabpanel plumbing (see rfqWorkspace.js for rationale). Bound to
  // undefined when the session strip isn't rendered so LWC drops
  // role/aria-labelledby on single-LOC accounts.
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
  // the currently active LOC (we only own our own dwellingRows /
  // scheduledItemRows / homeownerRows locally). For sibling pills
  // we fall back to a generic "may contain saved data" copy.
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

  // Content-summary "gist" for the delete-LOC warning banner. Reads
  // the same tracked arrays the review card / progress-path use to
  // know if the RFQ has captured data. Zero dimensions are omitted;
  // if every dimension is zero we return '' and the caller skips the
  // banner entirely (no "0 dwellings, 0 scheduled items" noise).
  _computeDeleteContentSummary() {
    const d = (this.dwellingRows || []).length;
    const s = (this.scheduledItemRows || []).length;
    const h = (this.homeownerRows || []).length;
    const parts = [];
    if (d > 0) parts.push(`${d} dwelling${d === 1 ? '' : 's'}`);
    if (s > 0) parts.push(`${s} scheduled item${s === 1 ? '' : 's'}`);
    if (h > 0) parts.push(`${h} homeowner${h === 1 ? '' : 's'}`);
    if (!parts.length) return '';
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
    return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  }

  // Trailing "+ Add LOC" pill on the session strip. Fires the same
  // startrfqintake payload the Auto workspace uses so the intake
  // modal opens in "add another line of coverage" mode with the
  // current account + policy term prefilled.
  handleAddAnotherLoc() {
    // Rule: one open flow per LOC on an account. Hand the intake
    // modal every LOC already represented on this bundle so the
    // picker can hide them all (not just the source LOC).
    const ownLoc =
      this.context?.loc || this.context?.locLabel || 'Homeowners';
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
}
