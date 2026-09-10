import { LightningElement, api, track } from 'lwc';

/**
 * c-pa-asset-tree - tri-mode hierarchical Schedule of Vehicles.
 *
 *   mode="roster"    (Step 1) - vehicle rows + assigned-driver chips +
 *                    "+ Assign Driver" (with Create New Driver) + remove.
 *   mode="coverages" (Step 2) - Policy + Umbrella card on top, then a
 *                    3-level coverage tree: Vehicle -> Vehicle Coverages
 *                    + Assigned Drivers -> per-driver coverages.
 *   mode="review"    (Step 3) - Same hierarchy as coverages, but read-
 *                    only. Editable controls (picklists, checkboxes,
 *                    overflow menus, remove buttons, driver-picker
 *                    combobox) are suppressed and coverage values
 *                    render as static "Included / Not selected" pills
 *                    plus a text detail line. The eye/view-only
 *                    affordance on vehicle and driver rows stays so
 *                    the broker can still drill into full field
 *                    details without leaving the Review step.
 *
 * Presentational/controlled: the parent (c-rfq-workspace) owns all state
 * and applies every change dispatched from here. Review mode dispatches
 * nothing because no interactive controls are rendered.
 */

// ── Option lists (shared with the retired c-pa-coverages) ──────────────
const UMBRELLA_VALUES = ['$1,000,000', '$2,000,000', '$5,000,000'];

// Policy-level coverage values (Personal Auto umbrella policy). The broker
// checks the coverages to quote and names a single limit and/or deductible
// per coverage - markets quote against that exact value.
// Every limit on this card is a single dollar figure. Liability lines
// are NOT written as split "per person / per accident" pairs, and not
// as the "250/500" broker shorthand either - one limit reads the same
// way whichever coverage you are looking at, and matches the single
// figure the policy record these values are cloned from carries.
const LIABILITY_LIMIT_VALUES = [
  '$50,000',
  '$100,000',
  '$250,000',
  '$300,000',
  '$500,000',
  '$1,000,000'
];
const PD_LIMIT_VALUES = ['$25,000', '$50,000', '$100,000', '$250,000'];
const UM_DED_VALUES = ['$100', '$250', '$400', '$500', '$550', '$700', '$1,000', '$2,500'];

// Order + capabilities of each policy coverage row. `mandatory: true`
// rows render with the checkbox checked + disabled (broker can't opt
// out of state-required coverages); optional rows default unchecked so
// the broker explicitly opts in, and keep their value pickers disabled
// until they do - the same opt-in shape Comprehensive and Collision use
// at the vehicle level.
//
// Bodily Injury is the only compulsory line here. Property Damage and
// Uninsured Motorist are quotable options the broker elects per RFQ.
//
// Per the Auto PCM, Collision and Comprehensive live at the Vehicle
// level (see `vehicleCoverageRows` below), not at the Policy level -
// the policy card only carries the umbrella liability + UM lines.
const COVERAGE_DEFS = [
  { key: 'bi', label: 'Bodily Injury', mandatory: true, limit: true, limitValues: LIABILITY_LIMIT_VALUES },
  { key: 'pd', label: 'Property Damage', mandatory: false, limit: true, limitValues: PD_LIMIT_VALUES },
  { key: 'um', label: 'Uninsured Motorist', mandatory: false, limit: true, limitValues: LIABILITY_LIMIT_VALUES, ded: true, dedValues: UM_DED_VALUES }
];
const COMP_DED_VALUES = ['$250', '$500', '$1,000'];
const COLL_DED_VALUES = ['$500', '$1,000', '$2,500'];
const MED_PAY_VALUES = ['$1,000', '$2,500', '$5,000', 'Decline'];

function selectOptions(values, current) {
  // c-picklist renders the placeholder copy when no option matches the
  // current value, so we don't have to inject a synthetic empty entry.
  return values.map((v) => ({ value: v, label: v, selected: v === current }));
}

// Review-mode helper: normalize a single scalar coverage value to a
// trimmed string, or '' when unset, so the template can gate row
// visibility on truthiness. Review mode omits any row that lacks a
// saved value rather than rendering a placeholder.
function formatValueStrict(v) {
  return v && String(v).trim() ? String(v) : '';
}

function pluralizeCount(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

// Coverages-step (and Review) row chips. A coverage counts once the
// broker has included it - the deductible/limit may still be empty.
// Rows with nothing included read as outstanding work rather than
// "0 coverages", which is how a vehicle or driver added mid-renewal
// should look next to an inherited one that already carries elections.
function coverageCountLabel(count) {
  return count > 0
    ? pluralizeCount(count, 'coverage')
    : 'No coverages configured';
}

function vehicleSummaryLabel(driverCount, coverageCount, coveragesMode) {
  if (!coveragesMode) {
    return driverCount === 0
      ? 'No drivers assigned'
      : pluralizeCount(driverCount, 'driver');
  }
  if (coverageCount === 0) return 'No coverages configured';
  return `${pluralizeCount(driverCount, 'driver')}. ${pluralizeCount(
    coverageCount,
    'coverage'
  )}`;
}

export default class PaAssetTree extends LightningElement {
  @api mode = 'roster';
  @api vehicles = [];
  @api drivers = [];
  @api assignments = {};
  @api policyLimits = {};
  // Policy coverage ranges (include flag + min/max for limit & deductible).
  @api coverageRanges = {};
  @api vehicleCoverages = {};
  @api driverCoverages = {};

  // Child subject kinds mountable under a vehicle. The parent
  // (rfq-workspace) passes `[{ id: 'driver', label, description, iconPath }]`
  // for Auto today. Future-proofing hook: when this list grows to 2+
  // entries, `handleVehicleRowAction('add_new_driver')` would surface
  // an inline picker step before firing `createdriverrequest`. For a
  // single-item list (today's PA case) the event fires immediately
  // with the sole kind id preserved so the workspace can route to
  // the right form when new kinds land.
  @api vehicleChildKinds = [];

  // Which vehicle's assign popover is open (one at a time).
  // Drivers checked (but not yet assigned) in the open assign popover -
  // enables multi-select before a single "Assign (N)" confirm.
  // Which vehicle's overflow (row action) menu is open (one at a time).
  @track openMenuVehicleId = null;
  // Single-open accordion state for coverages mode. Everything is
  // collapsed by default (null); opening one node closes the rest.
  @track openVehicleId = null;
  @track openDriverKey = null;
  // Policy-Level Coverages card - collapsed by default, like the vehicle
  // rows, so the whole coverages step reads as a consistent accordion.
  @track policyExpanded = false;
  // Read-only view modal (eye icon on vehicle / driver rows).
  @track viewOpen = false;
  @track viewKind = 'vehicle';
  @track viewHeading = '';
  @track viewSubtitle = '';
  @track viewFields = [];
  @track viewSummary = '';

  _docClickHandler = null;

  connectedCallback() {
    this._docClickHandler = this.handleDocClick.bind(this);
    document.addEventListener('click', this._docClickHandler);
    // Review mode is a read-only snapshot of the coverages hierarchy, so
    // every node lands open by default - hiding captured data behind
    // chevrons would defeat the purpose of the review card. The Policy
    // header defaults to expanded here; vehicle + driver expand states
    // are forced open inside the `tree` getter (see the `isReview`
    // overrides on vehExpanded / drvExpanded there) so we don't lose
    // the single-open accordion semantics on coverages mode (Step 2).
    if (this.isReview) {
      this.policyExpanded = true;
    }
  }

  disconnectedCallback() {
    if (this._docClickHandler) {
      document.removeEventListener('click', this._docClickHandler);
    }
  }

  get isCoverages() {
    return this.mode === 'coverages';
  }

  // Read-only tri-mode gate. Review is the new Step-3 mode; it renders
  // the exact same tree hierarchy as coverages mode (chevrons, section
  // pills, policy card, per-vehicle/per-driver coverage rows) but with
  // every editable control (picklists, checkboxes, overflow menu,
  // remove/assign controls) suppressed. Coverage values render as
  // static "Included / Not selected" pills + a text detail line.
  get isReview() {
    return this.mode === 'review';
  }

  // Convenience combined gate: any mode that renders the coverages-
  // style hierarchical body (expandable chevrons, Policy-Level
  // Coverages card on top, Vehicle Coverages + Assigned Drivers +
  // Driver Coverages sub-sections). Used everywhere the
  // template needs to say "render tree layout" regardless of whether
  // the broker is editing or reviewing.
  get isCoveragesOrReview() {
    return this.isCoverages || this.isReview;
  }

  // Roster mode (Step 1) owns all structural edits - add/delete vehicle,
  // assign/create/remove driver. Now strict: coverages AND review both
  // suppress the roster affordances (driver chips w/ remove button,
  // overflow row-action menu, driver-picker combobox). Previously this
  // was defined as `!== 'coverages'` which would have wrongly returned
  // true for the new 'review' mode.
  get isRoster() {
    return this.mode === 'roster';
  }

  get hasVehicles() {
    return Array.isArray(this.vehicles) && this.vehicles.length > 0;
  }

  // ── Umbrella view (coverages mode) ──────────────────────────────
  get policyView() {
    const p = this.policyLimits || {};
    return {
      umbrellaOptions: selectOptions(UMBRELLA_VALUES, p.umbrellaLimit),
      umUmbrella: !!p.umUmbrella
    };
  }

  // ── Policy coverage values (Personal Auto umbrella policy) ──────
  // Each row: an include checkbox + a single select for the limit
  // and/or deductible. Order/capabilities come from COVERAGE_DEFS.
  //
  // The `roLimitDisplay` / `roDedDisplay` / `hasRoValue` fields are
  // review-mode read-outs of the same data. In review mode the
  // template renders plain text (no picklist chips, no checkbox) and
  // gates each row on `hasRoValue` so unvalued or unincluded
  // coverages don't render at all.
  get policyCoverageRows() {
    const cr = this.coverageRanges || {};
    return COVERAGE_DEFS.map((def) => {
      const r = cr[def.key] || {};
      // Mandatory rows are always included - the checkbox renders
      // checked + disabled so the broker can't opt out of state-
      // required coverages. Optional rows respect the workspace's
      // include flag (default off until the broker opts in).
      const included = def.mandatory ? true : r.included === true;
      const roLimitDisplay = def.limit ? formatValueStrict(r.limit) : '';
      const roDedDisplay = def.ded ? formatValueStrict(r.ded) : '';
      // Rows carrying both a limit and a deductible (Uninsured
      // Motorist) qualify for review-mode rendering when either is
      // filled; the template hides the other group cleanly.
      const hasLimitFilled = !!(def.limit && roLimitDisplay);
      const hasDedFilled = !!(def.ded && roDedDisplay);
      const hasRoValue = included && (hasLimitFilled || hasDedFilled);
      return {
        key: def.key,
        label: def.label,
        mandatory: !!def.mandatory,
        included,
        hasLimit: !!def.limit,
        hasDed: !!def.ded,
        // Explicit values so c-picklist can drive its selected state
        // and surface the placeholder when the broker hasn't picked.
        limit: r.limit || '',
        ded: r.ded || '',
        limitOptions: def.limit ? selectOptions(def.limitValues, r.limit) : [],
        dedOptions: def.ded ? selectOptions(def.dedValues, r.ded) : [],
        // Opted-out rows lock their pickers, matching Comprehensive
        // and Collision at the vehicle level.
        disabled: !included,
        rowClass: included
          ? 'pa-asset-tree__cov-range'
          : 'pa-asset-tree__cov-range is-excluded',
        // Review-mode read-outs. Empty when unset so the template's
        // hasRoValue / hasLimitFilled / hasDedFilled gates can drop
        // the row (or a single sub-group) entirely.
        roLimitDisplay,
        roDedDisplay,
        hasLimitFilled,
        hasDedFilled,
        hasRoValue
      };
    });
  }

  // Review-mode filter: rows that were both included AND have at
  // least one complete range captured. Template's <for:each> in the
  // review branch iterates this list so the DOM stays free of
  // unincluded / empty coverages. Coverages mode (Step 2) keeps
  // iterating over the full `policyCoverageRows` set so every row
  // (including unchecked, still-empty ones) surfaces its picklist.
  get visiblePolicyCoverageRowsForReview() {
    return this.policyCoverageRows.filter((r) => r.hasRoValue);
  }

  // Section-level gate for the Policy-Level Coverages card in review
  // mode. When true (coverages mode always, or review mode with at
  // least one row worth showing) the card renders; otherwise the
  // whole card is suppressed so the review summary reflects only
  // what the broker actually captured.
  get showPolicyCard() {
    if (this.isCoverages) return true;
    if (this.isReview) return this.visiblePolicyCoverageRowsForReview.length > 0;
    return false;
  }

  // ── Decorated tree ──────────────────────────────────────────────
  //
  // `coverages` here is a boolean flag that toggles the hierarchical
  // body under each vehicle (Vehicle Coverages + Assigned Drivers +
  // per-driver coverages). It's true in both `coverages` and `review`
  // modes because review mode paints the exact same tree - just with
  // interactive controls swapped for read-only text (see the ro*
  // fields on each row descriptor and the `isReview` branches in the
  // template).
  get tree() {
    const driverById = new Map((this.drivers || []).map((d) => [d.id, d]));
    const coverages = this.isCoverages || this.isReview;
    return (this.vehicles || []).map((veh, idx) => {
      const driverIds = (this.assignments && this.assignments[veh.id]) || [];
      const assignedDrivers = driverIds
        .map((id) => driverById.get(id))
        .filter(Boolean);
      const isPending = !veh.vin || veh.vin === 'Pending';
      // Review mode forces every vehicle open so the whole captured
      // hierarchy paints without a chevron gate. Coverages mode keeps
      // its single-open accordion (only `openVehicleId` is expanded).
      const vehExpanded = this.isReview
        ? true
        : this.openVehicleId === veh.id;
      const vehCov = (this.vehicleCoverages && this.vehicleCoverages[veh.id]) || {};

      // Vehicle-level coverages (Comprehensive, Collision). Computed
      // outside the return object so we can also derive review-mode
      // filter + section-gate values from the same list.
      const vehicleCoverageRows = [
        {
          key: 'comp',
          label: 'Comprehensive',
          // Vehicle-level coverages are all opt-in per vehicle, so
          // none are flagged mandatory here. The checkbox renders
          // enabled + unchecked until the broker opts in.
          mandatory: false,
          valueKey: 'compDed',
          includedKey: 'compIncluded',
          included: vehCov.compIncluded === true,
          valueLabel: 'Deductible',
          value: vehCov.compDed || '',
          options: selectOptions(COMP_DED_VALUES, vehCov.compDed),
          inputId: `${veh.id}-compDed`,
          rowClass:
            vehCov.compIncluded === true
              ? 'pa-asset-tree__cov-row'
              : 'pa-asset-tree__cov-row is-excluded',
          disabled: vehCov.compIncluded !== true,
          // Review-mode read-out: plain-text captured value (empty
          // when unset). Paired with `hasRoValue` so the review
          // template can drop rows that were unchecked OR checked
          // but never valued.
          roValueDisplay: formatValueStrict(vehCov.compDed),
          hasRoValue:
            vehCov.compIncluded === true &&
            !!formatValueStrict(vehCov.compDed)
        },
        {
          key: 'coll',
          label: 'Collision',
          mandatory: false,
          valueKey: 'collDed',
          includedKey: 'collIncluded',
          included: vehCov.collIncluded === true,
          valueLabel: 'Deductible',
          value: vehCov.collDed || '',
          options: selectOptions(COLL_DED_VALUES, vehCov.collDed),
          inputId: `${veh.id}-collDed`,
          rowClass:
            vehCov.collIncluded === true
              ? 'pa-asset-tree__cov-row'
              : 'pa-asset-tree__cov-row is-excluded',
          disabled: vehCov.collIncluded !== true,
          roValueDisplay: formatValueStrict(vehCov.collDed),
          hasRoValue:
            vehCov.collIncluded === true &&
            !!formatValueStrict(vehCov.collDed)
        }
      ];
      const visibleVehicleCoverageRowsForReview = vehicleCoverageRows.filter(
        (r) => r.hasRoValue
      );
      const hasAnyVisibleVehicleCoverages =
        visibleVehicleCoverageRowsForReview.length > 0;
      const configuredVehicleCoverageCount = vehicleCoverageRows.filter(
        (r) => r.included === true
      ).length;

      return {
        key: veh.id || `veh-${idx}`,
        id: veh.id,
        name: veh.name || 'New Vehicle (Pending Details)',
        meta: this.composeVehicleMeta(veh),
        statusLabel: 'Draft',
        // Only newly-added vehicles carry a badge ("Draft"); pre-loaded
        // rows render no status tag to keep the tree uncluttered.
        isDraft: isPending,
        statusClass: 'pa-asset-tree__status is-draft',
        driverChipLabel: vehicleSummaryLabel(
          assignedDrivers.length,
          configuredVehicleCoverageCount,
          this.isCoveragesOrReview
        ),
        hasDrivers: assignedDrivers.length > 0,
        // Expand/collapse (coverages mode only).
        expanded: vehExpanded,
        chevronClass: vehExpanded
          ? 'pa-asset-tree__chevron is-open'
          : 'pa-asset-tree__chevron',
        showBody: coverages && vehExpanded,
        // Overflow (row action) menu.
        menuOpen: this.openMenuVehicleId === veh.id,
        // Vehicle coverages (Level 2a) - rendered as 1 row per coverage
        // (checkbox + name + value select). Each row's `included` flag
        // drives both the checkbox state and the disabled state on the
        // value select, mirroring the Policy-Level Coverages pattern.
        vehicleCoverageRows,
        // Review-only filter + section-level gate. Coverages mode
        // still iterates `vehicleCoverageRows` (full list, unchecked
        // rows included) so the Step-2 edit surface is untouched.
        visibleVehicleCoverageRowsForReview,
        hasAnyVisibleVehicleCoverages,
        showVehicleCoveragesSection:
          this.isCoverages || hasAnyVisibleVehicleCoverages,
        // Contextual record passed to c-agentforce-inline-chat so the
        // mock AI replies can quote this exact vehicle's data back to
        // the broker.
        chatContext: (() => {
          const parsed = this._parseVehicleName(veh.name);
          return {
            vehicleId: veh.id,
            year: parsed.year !== '-' ? parsed.year : '',
            make: parsed.make !== '-' ? parsed.make : '',
            model: parsed.model !== '-' ? parsed.model : '',
            driver:
              (assignedDrivers[0] && assignedDrivers[0].name) ||
              'the assigned driver',
            deductibles: {
              collision: vehCov.collDed || null,
              comprehensive: vehCov.compDed || null
            }
          };
        })(),
        drivers: assignedDrivers.map((d) => {
          const drvKey = `${veh.id}:${d.id}`;
          // Same rationale as `vehExpanded`: review mode forces every
          // driver open so the Level-3 Driver Coverages rows
          // paint without a chevron gate. Coverages mode preserves
          // its single-open accordion behavior.
          const drvExpanded = this.isReview
            ? true
            : this.openDriverKey === drvKey;
          const cov =
            (this.driverCoverages &&
              this.driverCoverages[veh.id] &&
              this.driverCoverages[veh.id][d.id]) ||
            {};
          // Driver-specific coverages - same row-per-coverage layout
          // as the vehicle coverages above. Each row exposes a
          // checkbox + the per-coverage select, with the select
          // disabled when the checkbox is off. Per the Auto PCM,
          // Medical Payments is the sole driver-level coverage.
          const coverageRows = [
            {
              key: 'med',
              label: 'Medical Payments',
              mandatory: false,
              valueKey: 'medPay',
              includedKey: 'medIncluded',
              included: cov.medIncluded === true,
              valueLabel: 'Limit',
              value: cov.medPay || '',
              options: selectOptions(MED_PAY_VALUES, cov.medPay),
              inputId: `${veh.id}-${d.id}-medPay`,
              rowClass:
                cov.medIncluded === true
                  ? 'pa-asset-tree__cov-row'
                  : 'pa-asset-tree__cov-row is-excluded',
              disabled: cov.medIncluded !== true,
              // Review-mode read-out: plain-text captured value
              // (empty when unset) + `hasRoValue` gate so the review
              // template can skip unchecked / unvalued rows entirely.
              roValueDisplay: formatValueStrict(cov.medPay),
              hasRoValue:
                cov.medIncluded === true && !!formatValueStrict(cov.medPay)
            }
          ];
          const visibleDriverCoverageRowsForReview = coverageRows.filter(
            (r) => r.hasRoValue
          );
          const hasAnyVisibleDriverCoverages =
            visibleDriverCoverageRowsForReview.length > 0;
          const configuredDriverCoverageCount = coverageRows.filter(
            (r) => r.included === true
          ).length;
          return {
            key: drvKey,
            id: d.id,
            name: d.name,
            initials: d.initials || (d.name ? d.name.charAt(0) : '?'),
            dl: d.dl || 'Pending',
            expanded: drvExpanded,
            chevronClass: drvExpanded
              ? 'pa-asset-tree__chevron pa-asset-tree__chevron_sm is-open'
              : 'pa-asset-tree__chevron pa-asset-tree__chevron_sm',
            // Coverages mode always paints the Driver-Specific
            // Coverages sub-card when the driver is expanded; review
            // mode adds an extra gate so drivers with zero captured
            // driver-level coverages don't paint an empty section.
            showCoverage:
              coverages &&
              drvExpanded &&
              (this.isCoverages || hasAnyVisibleDriverCoverages),
            coverageRows,
            visibleDriverCoverageRowsForReview,
            hasAnyVisibleDriverCoverages,
            coverageChipLabel: coverageCountLabel(
              configuredDriverCoverageCount
            )
          };
        })
      };
    });
  }

  composeVehicleMeta(veh) {
    const parts = [];
    if (veh.vin) parts.push(`VIN ${veh.vin}`);
    if (veh.use) parts.push(veh.use);
    if (veh.annualMileage) parts.push(veh.annualMileage);
    return parts.join(' · ');
  }

  // Title/row click target reads as interactive whenever the row is
  // expandable - true in both coverages (Step 2) and review (Step 3)
  // modes. Roster mode leaves it non-clickable because there's no
  // body underneath to reveal.
  get vehBodyClass() {
    return this.isCoveragesOrReview
      ? 'pa-asset-tree__veh-body pa-asset-tree__veh-body_clickable'
      : 'pa-asset-tree__veh-body';
  }

  // ── Read-only view modal (eye icon) ─────────────────────────────
  handleViewVehicle(event) {
    event.stopPropagation();
    const id = event.currentTarget.dataset.vehicleId;
    const veh = (this.vehicles || []).find((v) => v.id === id);
    if (!veh) return;
    const { year, make, model } = this._parseVehicleName(veh.name);
    this.viewKind = 'vehicle';
    this.viewHeading = veh.name || 'Vehicle';
    this.viewSubtitle = 'Vehicle';
    // Mirrors the Add / Edit Vehicle form fields exactly.
    this.viewFields = [
      { label: 'Year', value: year },
      { label: 'Make', value: make },
      { label: 'Model', value: model },
      { label: 'VIN', value: veh.vin || '-' },
      { label: 'Primary Use', value: veh.use || '-' },
      { label: 'Annual Mileage', value: this._formatMileage(veh.annualMileage) },
      { label: 'Body Class', value: veh.bodyClass || '-' },
      { label: 'Garaging ZIP Code', value: veh.garagingZip || '-' }
    ];
    this.viewSummary = '';
    this.viewOpen = true;
  }

  handleViewDriver(event) {
    event.stopPropagation();
    const id = event.currentTarget.dataset.driverId;
    const d = (this.drivers || []).find((x) => x.id === id);
    if (!d) return;
    const { first, last } = this._parseDriverName(d.name);
    this.viewKind = 'driver';
    this.viewHeading = d.name || 'Driver';
    this.viewSubtitle = 'Driver';
    // Mirrors the Add New Driver form fields exactly.
    this.viewFields = [
      { label: 'First Name', value: first },
      { label: 'Last Name', value: last },
      { label: 'License State', value: d.licenseState || '-' },
      { label: 'License Number', value: d.dl || '-' },
      { label: 'Date of Birth', value: this._formatDob(d.dob) }
    ];
    this.viewSummary = '';
    this.viewOpen = true;
  }

  handleViewClose() {
    this.viewOpen = false;
  }

  // Split a vehicle name ("2024 Honda CR-V EX-L") into Year / Make / Model.
  _parseVehicleName(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
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
    return { year, make, model };
  }

  // Split a driver name ("James Mavericks") into First / Last.
  _parseDriverName(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    const first = parts.length ? parts[0] : '-';
    const last = parts.length > 1 ? parts.slice(1).join(' ') : '-';
    return { first, last };
  }

  _formatMileage(m) {
    if (m == null || m === '') return '-';
    if (typeof m === 'string') return m;
    return `${m.toLocaleString('en-US')} mi/yr`;
  }
  _formatDob(dob) {
    if (!dob) return '-';
    const parts = String(dob).split('-');
    if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`;
    return dob;
  }
  // ── Policy card expand / collapse ───────────────────────────────
  get policyChevronClass() {
    return this.policyExpanded
      ? 'pa-asset-tree__chevron is-open'
      : 'pa-asset-tree__chevron';
  }
  get policyAriaExpanded() {
    return this.policyExpanded ? 'true' : 'false';
  }
  togglePolicy() {
    this.policyExpanded = !this.policyExpanded;
  }
  handlePolicyKeydown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.togglePolicy();
    }
  }

  // ── Expand / collapse (single-open accordion) ───────────────────
  toggleVehicle(event) {
    // The whole row title is also wired to this handler, so ignore it
    // in roster mode (roster rows aren't expandable). Coverages AND
    // review both surface an expandable body underneath the vehicle
    // row, so both should respond to the click.
    if (!this.isCoveragesOrReview) return;
    const id = event.currentTarget.dataset.vehicleId;
    if (!id) return;
    // Open this vehicle (closing any other) or collapse it if already open.
    this.openVehicleId = this.openVehicleId === id ? null : id;
    // Collapse any open driver - its parent vehicle may have just closed.
    this.openDriverKey = null;
  }

  toggleDriver(event) {
    const key = event.currentTarget.dataset.driverKey;
    if (!key) return;
    // Open this driver (closing any other) or collapse it if already open.
    this.openDriverKey = this.openDriverKey === key ? null : key;
  }

  // ── Overflow row-action menu ────────────────────────────────────
  toggleVehicleMenu(event) {
    event.stopPropagation();
    const id = event.currentTarget.dataset.vehicleId;
    this.openMenuVehicleId = this.openMenuVehicleId === id ? null : id;
  }

  // Unified handler for the overflow-menu actions. Routes by the
  // item's data-action value; all of them bubble up to the parent
  // (rfqWorkspace).
  handleVehicleRowAction(event) {
    event.stopPropagation();
    const { vehicleId, action } = event.currentTarget.dataset;
    if (!vehicleId || !action) return;
    this.openMenuVehicleId = null;
    switch (action) {
      case 'add_new_driver': {
        // Kind defaults to 'driver' - the only vehicle-level child in
        // the PA blueprint today. When vehicleChildKinds grows to 2+
        // entries (e.g. Driver + Passenger), the workspace will drive
        // a picker step; for now, fire immediately with the single
        // available kind id so payload shape stays forward-compatible.
        const kinds = Array.isArray(this.vehicleChildKinds)
          ? this.vehicleChildKinds
          : [];
        const kind = kinds.length ? kinds[0].id : 'driver';
        this.dispatchEvent(
          new CustomEvent('createdriverrequest', {
            detail: { vehicleId, kind },
            bubbles: true,
            composed: true
          })
        );
        break;
      }
      case 'edit_vehicle':
        this.dispatchEvent(
          new CustomEvent('editvehiclerequest', {
            detail: { vehicleId },
            bubbles: true,
            composed: true
          })
        );
        break;
      case 'delete_vehicle':
        this.dispatchEvent(
          new CustomEvent('removevehiclerequest', {
            detail: { vehicleId },
            bubbles: true,
            composed: true
          })
        );
        break;
      default:
        break;
    }
  }

  handleDocClick() {
    // Any click outside a popover trigger/menu closes it. Trigger clicks
    // call stopPropagation so they don't reach here.
    if (this.openMenuVehicleId !== null) {
      this.openMenuVehicleId = null;
    }
  }

  stopPropagation(event) {
    event.stopPropagation();
  }

  // Keyboard partner for handleVehicleRowAction - Enter and Space
  // activate the overflow-menu items so they match native <button>
  // keyboard semantics (WCAG 2.1.1). Each <li role="menuitem"> is
  // tabindex=0 in the template.
  handleVehicleRowKeydown(event) {
    if (
      event.key === 'Enter' ||
      event.key === ' ' ||
      event.key === 'Spacebar'
    ) {
      event.preventDefault();
      this.handleVehicleRowAction(event);
    }
  }

  handleRemoveDriverClick(event) {
    event.stopPropagation();
    const { vehicleId, driverId } = event.currentTarget.dataset;
    if (!vehicleId || !driverId) return;
    this.dispatchEvent(
      new CustomEvent('removedriverrequest', {
        detail: { vehicleId, driverId },
        bubbles: true,
        composed: true
      })
    );
  }

  // ── Coverage changes (coverages mode) ───────────────────────────
  handlePolicyChange(event) {
    const key = event.target.dataset.key;
    if (!key) return;
    const value =
      event.target.type === 'checkbox'
        ? !!event.target.checked
        : event.target.value;
    this.dispatchEvent(
      new CustomEvent('policychange', {
        detail: { key, value },
        bubbles: true,
        composed: true
      })
    );
  }

  // Toggle whether a policy coverage is included in the RFQ.
  handleCoverageInclude(event) {
    const key = event.target.dataset.key;
    if (!key) return;
    this.dispatchEvent(
      new CustomEvent('coveragerangechange', {
        detail: { key, field: 'included', value: !!event.target.checked },
        bubbles: true,
        composed: true
      })
    );
  }

  // Update a policy coverage's limit or deductible. `field` is one of
  // limit | ded. Reads `event.detail.value` because the selects are
  // c-picklist (custom combobox) - the data attributes remain on the
  // host element.
  handleCoverageRange(event) {
    const key = event.currentTarget.dataset.coverage;
    const field = event.currentTarget.dataset.field;
    if (!key || !field) return;
    this.dispatchEvent(
      new CustomEvent('coveragerangechange', {
        detail: { key, field, value: event.detail.value },
        bubbles: true,
        composed: true
      })
    );
  }

  handleVehicleCovChange(event) {
    const { vehicleId, key } = event.currentTarget.dataset;
    if (!vehicleId || !key) return;
    this.dispatchEvent(
      new CustomEvent('vehiclecovchange', {
        detail: { vehicleId, key, value: event.detail.value },
        bubbles: true,
        composed: true
      })
    );
  }

  // Per-coverage include checkbox on a vehicle row. Routes through
  // the existing `vehiclecovchange` event with `key: <prefix>Included`
  // so the workspace's handler can store the flag alongside the value
  // in the same bucket without a new event channel.
  handleVehicleCovInclude(event) {
    const { vehicleId, key } = event.target.dataset;
    if (!vehicleId || !key) return;
    this.dispatchEvent(
      new CustomEvent('vehiclecovchange', {
        detail: { vehicleId, key, value: !!event.target.checked },
        bubbles: true,
        composed: true
      })
    );
  }

  handleDriverSelect(event) {
    const { vehicleId, driverId, key } = event.currentTarget.dataset;
    if (!vehicleId || !driverId || !key) return;
    this.dispatchEvent(
      new CustomEvent('drivercovchange', {
        detail: { vehicleId, driverId, key, value: event.detail.value },
        bubbles: true,
        composed: true
      })
    );
  }

  // Per-coverage include checkbox on a driver row. Same routing pattern
  // as the vehicle one above - reuses `drivercovchange` with a typed
  // include-key.
  handleDriverCovInclude(event) {
    const { vehicleId, driverId, key } = event.target.dataset;
    if (!vehicleId || !driverId || !key) return;
    this.dispatchEvent(
      new CustomEvent('drivercovchange', {
        detail: { vehicleId, driverId, key, value: !!event.target.checked },
        bubbles: true,
        composed: true
      })
    );
  }
}
