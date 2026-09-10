import { LightningElement, api } from 'lwc';
import {
  quotes as ALL_QUOTES,
  TIER_LABELS_BY_APPLICATION_ID
} from 'data/mockData';
import { readForcedState } from 'c/emptyState';

function fmtMoney(n) {
  if (n == null) return '-';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  });
}

// Fallback label for a broker-named tier id that isn't in the preset
// EB_TIER_ORDER list or the per-RFQ TIER_LABELS_BY_APPLICATION_ID map.
// Titlecases underscore-delimited ids (e.g. `core_ppo` -> `Core PPO`)
// so a bare id from the compared data still surfaces something legible.
function _humanizeTierId(id) {
  return String(id || '')
    .split('_')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ')
    .trim();
}

// Section configs drive the grid. Each section is a labelled band; each row
// reads a field off every quote by `key`. The Totals section is computed in
// the component (monthly premium + delta vs the incumbent plan).
export const PA_SECTIONS = [
  {
    id: 'plan',
    label: 'Plan Information',
    rows: [
      { key: 'planName', label: 'Plan Name' },
      { key: 'policyForm', label: 'Policy Form' },
      { key: 'term', label: 'Term' },
      { key: 'planNotes', label: 'Notes' }
    ]
  },
  {
    id: 'liab',
    label: 'Liability Coverage',
    rows: [
      { key: 'bodilyInjury', label: 'Bodily Injury (BI)' },
      { key: 'propertyDamage', label: 'Property Damage (PD)' },
      { key: 'umUim', label: 'Uninsured / Underinsured Motorist' },
      { key: 'medicalPayments', label: 'Medical Payments' }
    ]
  },
  {
    id: 'phys',
    label: 'Physical Damage',
    rows: [
      { key: 'compDeductible', label: 'Comprehensive Deductible' },
      { key: 'collisionDeductible', label: 'Collision Deductible' },
      { key: 'luxuryDeductible', label: 'Luxury Vehicle Deductible (Comp / Coll)' },
      { key: 'rentalReimb', label: 'Rental Reimbursement' },
      { key: 'roadside', label: 'Roadside Assistance' }
    ]
  },
  {
    id: 'value',
    label: 'Value-Adds & Rating',
    rows: [
      { key: 'accidentForgiveness', label: 'Accident Forgiveness' },
      { key: 'oemParts', label: 'OEM Parts Guarantee' },
      { key: 'diminishingDeductible', label: 'Diminishing Deductible' },
      { key: 'amBest', label: 'AM Best Rating' }
    ]
  }
];

// Property lines (Homeowners, Renters). Mirrors the HO-3 coverage
// letters the intake wizard collects (homeRfqData.coverages), then the
// deductible row that actually separates a wind-exposed market.
export const HOME_SECTIONS = [
  {
    id: 'plan',
    label: 'Plan Information',
    rows: [
      { key: 'planName', label: 'Plan Name' },
      { key: 'policyForm', label: 'Policy Form' },
      { key: 'term', label: 'Term' },
      { key: 'planNotes', label: 'Notes' }
    ]
  },
  {
    id: 'property',
    label: 'Property Coverage',
    rows: [
      { key: 'dwellingLimit', label: 'Dwelling' },
      { key: 'otherStructures', label: 'Other Structures' },
      { key: 'personalProperty', label: 'Personal Property' },
      { key: 'lossOfUse', label: 'Loss of Use' }
    ]
  },
  {
    id: 'liab',
    label: 'Liability Coverage',
    rows: [
      { key: 'personalLiability', label: 'Personal Liability' },
      { key: 'medicalPayments', label: 'Med Pay to Others' }
    ]
  },
  {
    id: 'ded',
    label: 'Deductibles',
    rows: [
      { key: 'allPerilsDeductible', label: 'All Perils Deductible' },
      { key: 'windHailDeductible', label: 'Wind / Hail Deductible' },
      { key: 'roofSettlement', label: 'Roof Loss Settlement' }
    ]
  },
  {
    id: 'value',
    label: 'Value-Adds & Rating',
    rows: [
      { key: 'waterBackup', label: 'Water Backup' },
      { key: 'ordinanceOrLaw', label: 'Ordinance or Law' },
      { key: 'scheduledItems', label: 'Scheduled Personal Property' },
      { key: 'amBest', label: 'AM Best Rating' }
    ]
  }
];

// EB compare bands are derived at runtime from the tiers present in each
// quote's `benefits` map. The three constants below drive that derivation:
//   EB_PLAN_ROWS     - plan-level rows (never tier-scoped)
//   EB_BENEFIT_ATTRS - canonical list of benefit attributes shown once
//                      per tier band that has data
//   EB_TIER_ORDER    - canonical ordering of tier ids so bands render
//                      In-Network first, then Out-of-Network, etc.
export const EB_PLAN_ROWS = [
  { key: 'planName',    label: 'Plan Name' },
  { key: 'fundingType', label: 'Funding Type' },
  { key: 'planType',    label: 'Plan Type' },
  { key: 'networkType', label: 'Network Type' },
  { key: 'planNotes',   label: 'Notes' }
];

// Keys mirror data/ebCatalog COVERAGES_BY_ROOT.medical +
// BENEFIT_CATEGORIES_BY_ROOT.medical so the comparison table's
// attribute list stays in lock-step with the RFQ Benefits screen.
// Labels also mirror the catalog's ("Office Visit: PCP" etc.).
// Rows with no data across any (quote, tier) drop out of the
// benefit-first layout via the existing emptiness rule, so a
// growing catalog naturally hides absent attrs.
export const EB_BENEFIT_ATTRS = [
  // Core coverages (Step 2 in the RFQ) - the "policy shape" numbers.
  { key: 'med-ded-ind',         label: 'Annual Deductible: Individual' },
  { key: 'med-ded-fam',         label: 'Annual Deductible: Family' },
  { key: 'med-oop-ind',         label: 'Annual Out-of-Pocket Limit: Individual' },
  { key: 'med-oop-fam',         label: 'Annual Out-of-Pocket Limit: Family' },
  { key: 'med-coinsurance-pct', label: 'Coinsurance %' },
  // Physician Services
  { key: 'med-pcp',             label: 'Office Visit: PCP' },
  { key: 'med-spec',            label: 'Office Visit: Specialist' },
  { key: 'med-virtual',         label: 'Virtual Care Copay' },
  // Preventive Services
  { key: 'med-preventive',      label: 'Preventive Care' },
  { key: 'med-preventive-coins', label: 'Preventive Coinsurance' },
  // Emergency Services
  { key: 'med-er',              label: 'Emergency Room' },
  { key: 'med-urgent',          label: 'Urgent Care' },
  // Outpatient Services
  { key: 'med-inpatient',       label: 'Inpatient Hospital' },
  { key: 'med-outpatient',      label: 'Outpatient Surgery' },
  { key: 'med-lab',             label: 'Lab + Imaging' },
  { key: 'med-complex-imaging', label: 'Complex Imaging' },
  // Hospital (Inpatient/Outpatient) coinsurance
  { key: 'med-hospital-coinsurance', label: 'Hospital Coinsurance' },
  // Chiropractic Services
  { key: 'med-chiro',           label: 'Chiropractic Care' },
  { key: 'med-acupuncture',     label: 'Acupuncture' },
  // Prescription Drugs
  { key: 'med-rx-generic',      label: 'Generic Drugs (Tier 1)' },
  { key: 'med-rx-preferred',    label: 'Preferred Brand Drugs (Tier 2)' },
  { key: 'med-rx-nonpreferred', label: 'Non-Preferred Brand Drugs (Tier 3)' },
  { key: 'med-rx-specialty',    label: 'Specialty Drugs (Tier 4)' }
];

// Canonical tier ordering. Kept in sync with the Benefits step's
// TIER_OPTIONS (c-eb-benefits-copays); duplicated here so the compare
// table doesn't reach into a sibling component's module.
export const EB_TIER_ORDER = [
  { id: 'in_network',        label: 'In-Network' },
  { id: 'out_of_network',    label: 'Out-of-Network' },
  { id: 'preferred_network', label: 'Preferred Network' },
  { id: 'tier_1',            label: 'Tier 1' },
  { id: 'tier_2',            label: 'Tier 2' },
  { id: 'tier_3',            label: 'Tier 3' }
];

/**
 * c-quote-compare-table - rich plan-by-plan comparison grid.
 *
 * Columns are the quotes passed in `quoteIds` (order preserved); each column
 * header shows the carrier, plan name, status tag, the annual premium hero,
 * the delta vs the incumbent plan, and a few summary stats. Rows are grouped
 * into labelled section bands (Plan Information / In-Network / Out-of-Network
 * / Totals for EB; Plan / Liability / Physical Damage / Value-Adds / Totals
 * for PA). The recommended (best-value) column is highlighted.
 */
export default class QuoteCompareTable extends LightningElement {
  @api quoteIds = [];
  @api flow = 'pa';
  // Quote ids the broker has ticked for the proposal. Owned by the
  // host (c-quote-comparison-modal) so its Select all control and its
  // footer count stay in sync with the per-column toggles here. The
  // grid is a controlled component - it never mutates this itself.
  @api pickedIds = [];
  // 'benefit-first' - each attribute is its own header, with one row
  //                   per tier underneath (mirrors the Benefits step's
  //                   attribute-group layout). Default so EB compare
  //                   reads tier-segregated per benefit, matching the
  //                   RFQ Benefits screen.
  // 'tier-first'    - each selected tier is its own band; the earlier
  //                   Acme layout, kept as an explicit opt-in for RFQs
  //                   that need the tier-band grouping instead.
  @api compareLayout = 'benefit-first';

  get isEbFlow() {
    return this.flow === 'eb';
  }
  // Property lines share one row set - a renters comparison wants
  // personal property and loss of use, not vehicles.
  get isHomeFlow() {
    return this.flow === 'home';
  }
  get isBenefitFirst() {
    return this.isEbFlow && this.compareLayout === 'benefit-first';
  }

  get resolvedQuotes() {
    const byId = new Map(ALL_QUOTES.map((q) => [q.id, q]));
    return (this.quoteIds || []).map((id) => byId.get(id)).filter(Boolean);
  }

  get hasQuotes() {
    return this.resolvedQuotes.length > 0;
  }

  // ── Forced empty/error state for demos (`?forceEmpty=qct@<code>`).
  _forcedState = readForcedState('qct');
  get hasForcedState() {
    return Boolean(this._forcedState);
  }
  get forcedStateName() {
    return this._forcedState;
  }
  get forcedStateTitle() {
    const map = {
      'error:recoverable': 'Couldn’t load quotes',
      'error:connectionissue': 'Can’t reach the quotes service',
      'error:appconnection': 'Carrier connection unavailable',
      'noresults:filter': 'No quotes match your filters',
      'noresults:search': 'No quotes match your search',
      'success:new': 'No quotes to compare yet'
    };
    return map[this._forcedState] || 'No quotes selected';
  }
  get forcedStateDescription() {
    const map = {
      'error:recoverable': 'The quote grid failed to load. Try again in a moment.',
      'error:connectionissue': 'We couldn’t reach the quotes service. Check your connection, then retry.',
      'error:appconnection': 'One or more carriers didn’t respond. Retry, or exclude that carrier.',
      'noresults:filter': 'Try widening the tier or coverage filter to see more quotes.',
      'noresults:search': 'Try a shorter search or clear your filters.',
      'success:new': 'Quotes appear here once carriers return them for this RFQ.'
    };
    return map[this._forcedState] || 'Select at least two quotes on the RFQ to compare them side-by-side.';
  }
  get forcedStateCtaLabel() {
    const map = {
      'error:recoverable': 'Retry',
      'error:connectionissue': 'Retry',
      'error:appconnection': 'Retry'
    };
    return map[this._forcedState] || '';
  }
  get hasForcedStateCta() {
    return Boolean(this.forcedStateCtaLabel);
  }
  get showEmptyState() {
    return !this.hasQuotes || this.hasForcedState;
  }
  get emptyIllustration() {
    // Prefer the forced code if present; otherwise use `success:new`
    // for the natural "no quotes yet" case.
    return this._forcedState || 'success:new';
  }

  // First cell + one per column - used for the section band colspan.
  get colSpan() {
    return this.resolvedQuotes.length + 1;
  }

  // Agentforce best-value pick among the compared plans - drives the
  // corner summary (eyebrow + bold "Best Quote" + bulleted reasoning +
  // "Ask an Agent" CTA) and the marked column.
  get recommendation() {
    const best = this.resolvedQuotes.find((q) => q.aiRecommendation?.bestValue);
    if (!best) return null;
    const rec = best.aiRecommendation || {};
    const bullets = Array.isArray(rec.bullets)
      ? rec.bullets.map((text, i) => ({ id: `b${i}`, text }))
      : null;
    return {
      carrierName: best.carrierName,
      planName: best.planName || '',
      reason: rec.reason,
      bullets,
      hasBullets: !!(bullets && bullets.length)
    };
  }

  // Bubbled to the parent (c-quote-comparison-modal) so it can open the
  // docked Agentforce chat panel without the table having to know about
  // its sibling.
  handleAskAgent() {
    this.dispatchEvent(
      new CustomEvent('askagent', { bubbles: true, composed: true })
    );
  }

  // Incumbent annual premium - the delta baseline. Prefer an incumbent in the
  // compared set, else fall back to the application's incumbent plan.
  get incumbentPremium() {
    const inSet = this.resolvedQuotes.find((q) => q.incumbent);
    if (inSet) return inSet.annualPremium;
    const appId = this.resolvedQuotes[0]?.applicationId;
    const appIncumbent = ALL_QUOTES.find(
      (q) => q.applicationId === appId && q.incumbent
    );
    return appIncumbent ? appIncumbent.annualPremium : null;
  }

  // Per-flow summary stats shown under each premium hero.
  summaryStats(q) {
    if (this.isEbFlow) {
      return [
        { id: 'a', label: 'Employees quoted', value: '50' },
        {
          id: 'b',
          label: 'Est. enrolled',
          value: q.employeesEnrolled != null ? String(q.employeesEnrolled) : '-'
        },
        { id: 'c', label: 'Effective', value: 'Jan 1, 2026' }
      ];
    }
    if (this.isHomeFlow) {
      return [
        { id: 'a', label: 'Dwelling', value: '$685K' },
        { id: 'b', label: 'Scheduled items', value: '3' },
        { id: 'c', label: 'Effective', value: 'Dec 1, 2026' }
      ];
    }
    return [
      { id: 'a', label: 'Vehicles', value: '10' },
      { id: 'b', label: 'Drivers', value: '5' },
      { id: 'c', label: 'Effective', value: 'Oct 13, 2026' }
    ];
  }

  deltaFor(q) {
    const base = this.incumbentPremium;
    if (q.incumbent) return { label: 'Incumbent plan', cls: 'qct-delta is-flat' };
    if (base == null) return null;
    const diff = q.annualPremium - base;
    if (diff === 0) return { label: 'Same as incumbent', cls: 'qct-delta is-flat' };
    const abs = fmtMoney(Math.abs(diff));
    return diff < 0
      ? { label: `${abs} / yr lower`, cls: 'qct-delta is-down' }
      : { label: `${abs} / yr higher`, cls: 'qct-delta is-up' };
  }

  statusTag(q) {
    if (q.incumbent) return { label: 'Incumbent', cls: 'qct-tag is-incumbent' };
    if (q.aiRecommendation?.bestValue)
      return { label: 'Recommended', cls: 'qct-tag is-reco' };
    return { label: 'Quoted', cls: 'qct-tag is-quoted' };
  }

  // Column headers (one per quote).
  get columns() {
    const picked = new Set(this.pickedIds || []);
    return this.resolvedQuotes.map((q) => {
      const isBest = !!q.aiRecommendation?.bestValue;
      const isPicked = picked.has(q.id);
      const selectClass = [
        'qct-select',
        isBest ? 'is-best' : '',
        isPicked ? 'is-picked' : ''
      ]
        .filter(Boolean)
        .join(' ');
      return {
        id: q.id,
        carrierName: q.carrierName,
        planName: q.planName || '',
        logoInitial: q.carrierName.charAt(0),
        logoStyle: `background:${q.carrierAccent}`,
        premium: fmtMoney(q.annualPremium),
        delta: this.deltaFor(q),
        tag: this.statusTag(q),
        stats: this.summaryStats(q),
        isBest,
        showReco: isBest,
        headClass: isBest ? 'qct-col-head is-best' : 'qct-col-head',
        cellClass: isBest ? 'qct-cell is-best' : 'qct-cell',
        isPicked,
        selectClass,
        selectLabel: isPicked ? 'Selected' : 'Select',
        ariaPressed: isPicked ? 'true' : 'false'
      };
    });
  }

  // ── Tier bands (EB only) ────────────────────────────────────────
  // Union of tier ids present across every compared quote's `benefits`
  // map. Preset ids from EB_TIER_ORDER (in_network, out_of_network,
  // etc.) render in canonical order first, then broker-named custom
  // ids (from a new RFQ that opts into per-RFQ tier naming) render in
  // insertion order. Tiers with zero data across all compared quotes
  // drop out entirely so no empty band renders.
  get tierBands() {
    if (!this.isEbFlow) return [];
    const present = new Set();
    const insertionOrder = [];
    for (const q of this.resolvedQuotes) {
      const benefits = q.benefits || {};
      for (const attr of Object.keys(benefits)) {
        const perTier = benefits[attr] || {};
        for (const tierId of Object.keys(perTier)) {
          if (!present.has(tierId)) {
            present.add(tierId);
            insertionOrder.push(tierId);
          }
        }
      }
    }
    const knownIds = new Set(EB_TIER_ORDER.map((t) => t.id));
    const customLabels = this._customTierLabels();
    const knownBands = EB_TIER_ORDER
      .filter((t) => present.has(t.id))
      .map((t) => ({ id: t.id, label: t.label }));
    const customBands = insertionOrder
      .filter((id) => !knownIds.has(id))
      .map((id) => ({ id, label: customLabels[id] || _humanizeTierId(id) }));
    return [...knownBands, ...customBands];
  }

  // Per-RFQ tier-label lookup. Populated on the mockData side via
  // TIER_LABELS_BY_APPLICATION_ID for RFQs whose carriers report
  // broker-named tiers (e.g. rfq-nova-001 -> { core_ppo: 'Core PPO' }).
  _customTierLabels() {
    const appId = this.resolvedQuotes[0]?.applicationId;
    if (!appId) return {};
    return (TIER_LABELS_BY_APPLICATION_ID || {})[appId] || {};
  }

  // ── Sections (EB is dynamic; PA is still static) ────────────────
  get sections() {
    if (this.isEbFlow) return this._ebSections();
    return this._staticSections(this.isHomeFlow ? HOME_SECTIONS : PA_SECTIONS);
  }

  _staticSections(defs) {
    const cols = this.resolvedQuotes;
    const mapRows = (rows) =>
      rows.map((def) => ({
        key: def.key,
        label: def.label,
        labelClass: 'qct-row-label',
        cells: cols.map((q) => this._planCell(q, def.key))
      }));
    return [
      ...defs.map((s) => ({
        id: s.id,
        label: s.label,
        rows: mapRows(s.rows)
      })),
      { id: 'totals', label: 'Totals', rows: this._totalsRows(cols) }
    ];
  }

  _ebSections() {
    return this.isBenefitFirst
      ? this._ebBenefitFirstSections()
      : this._ebTierFirstSections();
  }

  // Current default: one band per tier, each band lists every canonical
  // attribute. Preserves the Acme compare layout.
  _ebTierFirstSections() {
    const cols = this.resolvedQuotes;
    const planRows = EB_PLAN_ROWS.map((def) => ({
      key: def.key,
      label: def.label,
      labelClass: 'qct-row-label',
      cells: cols.map((q) => this._planCell(q, def.key))
    }));
    const tierBandSections = this.tierBands.map((tier) => ({
      id: `tier-${tier.id}`,
      label: tier.label,
      rows: EB_BENEFIT_ATTRS.map((attr) => ({
        key: `${attr.key}::${tier.id}`,
        label: attr.label,
        labelClass: 'qct-row-label',
        cells: cols.map((q) => this._benefitCell(q, attr.key, tier.id))
      }))
    }));
    return [
      { id: 'plan', label: 'Plan Information', rows: planRows },
      ...tierBandSections,
      { id: 'totals', label: 'Totals', rows: this._totalsRows(cols) }
    ];
  }

  // Opt-in via @api compareLayout='benefit-first': one Benefits band
  // that alternates attribute-header rows (full-width label spanning
  // every column) with one indented tier sub-row per selected tier.
  // Mirrors the Benefits step's attribute-group layout.
  _ebBenefitFirstSections() {
    const cols = this.resolvedQuotes;
    const tiers = this.tierBands;
    const planRows = EB_PLAN_ROWS.map((def) => ({
      key: def.key,
      label: def.label,
      labelClass: 'qct-row-label',
      cells: cols.map((q) => this._planCell(q, def.key))
    }));

    const benefitsRows = [];
    for (const attr of EB_BENEFIT_ATTRS) {
      // Skip attrs with no data across any (quote, tier) - keeps the
      // list dense so the broker isn't scrolling past empty groups.
      const anyValue = tiers.some((tier) =>
        cols.some((q) => q.benefits?.[attr.key]?.[tier.id] != null)
      );
      if (!anyValue) continue;
      benefitsRows.push({
        key: `hdr-${attr.key}`,
        isAttrHeader: true,
        label: attr.label
      });
      for (const tier of tiers) {
        benefitsRows.push({
          key: `${attr.key}::${tier.id}`,
          label: tier.label,
          labelClass: 'qct-row-label qct-row-label_tier',
          cells: cols.map((q) => this._benefitCell(q, attr.key, tier.id))
        });
      }
    }

    return [
      { id: 'plan',     label: 'Plan Information', rows: planRows },
      { id: 'benefits', label: 'Benefits',         rows: benefitsRows },
      { id: 'totals',   label: 'Totals',           rows: this._totalsRows(cols) }
    ];
  }

  // ── Cell view-model helpers ─────────────────────────────────────
  _planCell(q, key) {
    const raw = q[key];
    const isBest = !!q.aiRecommendation?.bestValue;
    return {
      id: `${q.id}-${key}`,
      value: raw == null || raw === '' ? '-' : raw,
      check: isBest,
      cellClass: isBest
        ? 'qct-cell qct-value is-best'
        : 'qct-cell qct-value'
    };
  }
  _benefitCell(q, attrKey, tierId) {
    const raw = q.benefits?.[attrKey]?.[tierId];
    const isBest = !!q.aiRecommendation?.bestValue;
    return {
      id: `${q.id}-${attrKey}-${tierId}`,
      value: raw == null || raw === '' ? '-' : raw,
      check: isBest,
      cellClass: isBest
        ? 'qct-cell qct-value is-best'
        : 'qct-cell qct-value'
    };
  }
  _totalsRows(cols) {
    return [
      {
        key: 'monthly',
        label: 'Monthly Premium',
        labelClass: 'qct-row-label',
        cells: cols.map((q) => this._totalsCell(q, Math.round(q.annualPremium / 12)))
      },
      {
        key: 'annual',
        label: 'Annual Premium',
        labelClass: 'qct-row-label',
        cells: cols.map((q) => this._totalsCell(q, q.annualPremium))
      }
    ];
  }
  _totalsCell(q, amount) {
    const isBest = !!q.aiRecommendation?.bestValue;
    return {
      id: `${q.id}-${amount}`,
      value: fmtMoney(amount),
      check: isBest,
      cellClass: isBest
        ? 'qct-cell qct-value qct-total is-best'
        : 'qct-cell qct-value qct-total'
    };
  }

  // Per-column toggle. Multi-select: the host adds or removes the id
  // from `pickedIds` and the column re-renders in its new state.
  handleSelect(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this.dispatchEvent(new CustomEvent('quotetoggle', { detail: { quoteId: id } }));
  }

  handleBack() {
    this.dispatchEvent(new CustomEvent('back'));
  }
}
