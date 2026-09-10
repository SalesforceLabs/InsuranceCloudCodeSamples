/**
 * data/ebCatalog - shared Employee Benefits product metadata.
 *
 * Single source of truth for the EB Root Product -> Coverage -> Benefit
 * -> Attribute hierarchy. Read by both the design-time Setup canvas
 * (c-rfq-playbook-setup + c-eb-coverage-setup + c-eb-benefit-setup) and
 * the runtime wizard (c-rfq-workspace-eb + c-eb-core-coverages +
 * c-eb-benefits-copays). Setup mutates per-attribute `includedInRfq`
 * flags via `setIncluded`; the runtime renders only attributes flagged
 * in.
 *
 * Attribute data types map to runtime input controls:
 *   - 'Currency'      single $ number input ($ prefix)
 *   - 'CurrencyRange' Min/Max $ number pair (used by Step 2 Core
 *                     Plan Coverages for deductibles / OOP / plan max)
 *   - 'Percentage'    single number input (% suffix)
 *   - 'Picklist'      <select> populated from attribute.options
 *
 * Module-state caveat: this prototype keeps `includedInRfq` as mutable
 * module-level state so Setup writes are observable by the Runtime on
 * re-render. Production code would back this with a real persistence
 * layer (CMDT, Custom Setting, or a backing SObject).
 */

// ── Constants ────────────────────────────────────────────────────
export const DATA_TYPES = Object.freeze({
  CURRENCY: 'Currency',
  CURRENCY_RANGE: 'CurrencyRange',
  PERCENTAGE: 'Percentage',
  PICKLIST: 'Picklist',
  TEXT: 'Text'
});

// Allowed values the Setup widgets can flip an attribute to. Keeps
// the picker options in sync with what the runtime can render.
// CurrencyRange is included so attributes that ship as ranges in the
// catalog (e.g. Annual Deductible) surface their current value in the
// picker AND can be flipped to / from the single-currency variant.
export const SETTABLE_DATA_TYPES = Object.freeze([
  { value: 'Text',          label: 'Text'           },
  { value: 'Currency',      label: 'Currency'       },
  { value: 'CurrencyRange', label: 'Currency Range' },
  { value: 'Percentage',    label: 'Percentage'     },
  { value: 'Picklist',      label: 'Picklist'       }
]);

// ── Level 4: Benefit Attribute palette ───────────────────────────
// Global palette of Attribute Types that any runtime Benefit x Tier
// can slot in via c-eb-benefits-copays's "+ Add attribute" picker.
// The palette's `dataType` field dictates which input control renders
// at runtime (Copay -> $ input, Coinsurance -> % input, Deductible
// Waiver -> checkbox, Waiting Period -> picklist).
//
// The palette is intentionally decoupled from catalog Benefits (Level
// 3): the same Benefit ("Urgent Care") can carry different attribute
// sets under different tiers, and the same attribute type ("Copay")
// can apply to many benefits without duplicating catalog entries.
export const ATTRIBUTE_TYPE = Object.freeze({
  COPAY:             'copay',
  COINSURANCE:       'coinsurance',
  DEDUCTIBLE:        'deductible',
  DEDUCTIBLE_WAIVER: 'deductible_waiver',
  VISIT_LIMIT:       'visit_limit',
  ANNUAL_MAXIMUM:    'annual_maximum',
  COVERAGE_LEVEL:    'coverage_level',
  WAITING_PERIOD:    'waiting_period',
  NOTES:             'notes'
});

// Global default options for the "Deductible Waiver" attribute. Some
// Benefits override with a bespoke label + option list (e.g. Emergency
// Room -> "Emergency Room Copay Waived" with a different option set).
export const DEDUCTIBLE_WAIVER_OPTIONS = Object.freeze([
  'Deductible Waived',
  'Not Waived',
  'Applies After Deductible'
]);

export const ATTRIBUTE_TYPES = Object.freeze([
  { id: 'copay',             label: 'Copay',             dataType: DATA_TYPES.CURRENCY   },
  { id: 'coinsurance',       label: 'Coinsurance',       dataType: DATA_TYPES.PERCENTAGE },
  { id: 'deductible',        label: 'Deductible',        dataType: DATA_TYPES.CURRENCY   },
  { id: 'deductible_waiver', label: 'Deductible Waiver', dataType: DATA_TYPES.PICKLIST,
    options: DEDUCTIBLE_WAIVER_OPTIONS.slice()
  },
  { id: 'visit_limit',       label: 'Visit Limit',       dataType: 'Number'              },
  { id: 'annual_maximum',    label: 'Annual Maximum',    dataType: DATA_TYPES.CURRENCY   },
  { id: 'coverage_level',    label: 'Coverage Level',    dataType: DATA_TYPES.PICKLIST,
    options: [
      'Covered in Full',
      'No Charge',
      '100% Covered',
      'Covered after Deductible',
      'After Deductible & Coinsurance'
    ]
  },
  { id: 'waiting_period',    label: 'Waiting Period',    dataType: DATA_TYPES.PICKLIST,
    options: ['None', '30 days', '60 days', '90 days', '6 months', '12 months']
  },
  { id: 'notes',             label: 'Notes',             dataType: DATA_TYPES.TEXT       }
]);

export function getAttributeType(id) {
  return ATTRIBUTE_TYPES.find((a) => a.id === id) || null;
}

// Inline SVG paths for the segment icons (kept here so the catalog is
// self-contained and the runtime/setup components don't reach back into
// rfqWorkspaceEb internals for them).
const ICON_PATHS = {
  medical:
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z',
  dental:
    'M12 2C7 2 4 5 4 9c0 3 1 5 2 7 1 2 2 6 3 6s1-3 2-5 2-2 2 0 1 5 2 5 2-4 3-6 2-4 2-7c0-4-3-7-8-7zm0 4c2 0 4 1 4 3 0 1-1 2-2 2s-1-1-2-1-1 1-2 1-2-1-2-2c0-2 2-3 4-3z',
  vision:
    'M12 4.5C7 4.5 2.7 7.6 1 12c1.7 4.4 6 7.5 11 7.5s9.3-3.1 11-7.5c-1.7-4.4-6-7.5-11-7.5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'
};

// ── Root Products ────────────────────────────────────────────────
export const ROOT_PRODUCTS = [
  { id: 'medical', label: 'Medical', iconPath: ICON_PATHS.medical },
  { id: 'dental',  label: 'Dental',  iconPath: ICON_PATHS.dental  },
  { id: 'vision',  label: 'Vision',  iconPath: ICON_PATHS.vision  }
];

// ── Coverage attributes (mapped to InsurancePolicyCoverage) ──────
// Macro-financial fences: deductibles, OOP maxes, plan maximums, R&C
// percent, waiting periods. Rendered in Step 2 (Core Plan Coverages).
//
// Mirrors the PA Coverages pattern: each attribute carries a
// `mandatory` flag that drives the runtime checkbox state.
//   - mandatory: true   -> checkbox checked + disabled in the
//     runtime (broker cannot opt out). `includedInRfq` defaults
//     true since these are always in scope.
//   - mandatory: false  -> checkbox renders enabled + unchecked
//     until the broker opts in (or the prior-policy prefill auto-
//     includes it because the incumbent carried a value). The
//     value inputs disable when the checkbox is unchecked.
//
// Network + Plan Year are flagged mandatory across all three roots -
// every group plan needs them captured. Everything else is optional.
const COVERAGES_BY_ROOT = {
  medical: [
    // Plan-shape attrs (Medical PPO PCM §3.2). Network selection is
    // handled via the Network Tier chip picker on the Benefits step
    // (c-eb-benefits-copays), so it doesn't need a Core-Coverages row.
    // Plan Year is captured elsewhere in the RFQ header (effective
    // dates) and doesn't need to appear as a per-coverage attribute.
    //
    // `attributeLabel` names the L4 Attribute Type the row's input is
    // capturing. Rendered as a small subtitle under the Benefit label
    // so the (L3 Benefit -> L4 Attribute -> L5 Data Type) relationship
    // is explicit in the runtime UI.
    { id: 'med-ded-ind',         label: 'Annual Deductible: Individual',            attributeLabel: 'Deductible',         dataType: DATA_TYPES.CURRENCY_RANGE, mandatory: false, includedInRfq: false },
    { id: 'med-ded-fam',         label: 'Annual Deductible: Family',                attributeLabel: 'Deductible',         dataType: DATA_TYPES.CURRENCY_RANGE, mandatory: false, includedInRfq: false },
    { id: 'med-oop-ind',         label: 'Annual Out-of-Pocket Limit: Individual',   attributeLabel: 'Out-of-Pocket Limit',dataType: DATA_TYPES.CURRENCY_RANGE, mandatory: false, includedInRfq: false },
    { id: 'med-oop-fam',         label: 'Annual Out-of-Pocket Limit: Family',       attributeLabel: 'Out-of-Pocket Limit',dataType: DATA_TYPES.CURRENCY_RANGE, mandatory: false, includedInRfq: false },
    { id: 'med-coinsurance-pct', label: 'Coinsurance %',                            attributeLabel: 'Coinsurance',        dataType: DATA_TYPES.PERCENTAGE,     mandatory: false, includedInRfq: false }
  ],
  dental: [
    // Network + Plan Year removed - see medical block above for the
    // rationale (tier picker + RFQ-header effective dates cover them).
    { id: 'den-ded-ind',  label: 'Annual Deductible: Individual',  attributeLabel: 'Deductible',           dataType: DATA_TYPES.CURRENCY_RANGE, mandatory: false, includedInRfq: false },
    { id: 'den-ded-fam',  label: 'Annual Deductible: Family',      attributeLabel: 'Deductible',           dataType: DATA_TYPES.CURRENCY_RANGE, mandatory: false, includedInRfq: false },
    { id: 'den-max',      label: 'Annual Plan Maximum',            attributeLabel: 'Plan Maximum',         dataType: DATA_TYPES.CURRENCY_RANGE, mandatory: false, includedInRfq: false },
    { id: 'den-rc-pct',   label: 'Reasonable & Customary Percent', attributeLabel: 'R&C Percent',          dataType: DATA_TYPES.PERCENTAGE,     mandatory: false, includedInRfq: false },
    { id: 'den-wait',     label: 'Waiting Period',                 attributeLabel: 'Waiting Period',       dataType: DATA_TYPES.PICKLIST,       mandatory: false, includedInRfq: false,
      options: ['None', '30 days', '60 days', '90 days', '6 months', '12 months'] }
  ],
  vision: [
    // Network + Plan Year removed - see medical block above.
    { id: 'vis-exam-freq',  label: 'Exam Frequency',    attributeLabel: 'Exam Frequency',    dataType: DATA_TYPES.PICKLIST, mandatory: false, includedInRfq: false,
      options: ['12 months', '24 months', 'Custom'] },
    { id: 'vis-lens-freq',  label: 'Lens Frequency',    attributeLabel: 'Lens Frequency',    dataType: DATA_TYPES.PICKLIST, mandatory: false, includedInRfq: false,
      options: ['12 months', '24 months', 'Custom'] },
    { id: 'vis-frame-freq', label: 'Frame Frequency',   attributeLabel: 'Frame Frequency',   dataType: DATA_TYPES.PICKLIST, mandatory: false, includedInRfq: false,
      options: ['12 months', '24 months', 'Custom'] },
    { id: 'vis-frames',   label: 'Frame Allowance',        attributeLabel: 'Allowance',        dataType: DATA_TYPES.CURRENCY, mandatory: false, includedInRfq: false },
    { id: 'vis-contacts', label: 'Contact Lens Allowance', attributeLabel: 'Allowance',        dataType: DATA_TYPES.CURRENCY, mandatory: false, includedInRfq: false },
    { id: 'vis-mat-ded',  label: 'Materials Deductible',   attributeLabel: 'Deductible',       dataType: DATA_TYPES.CURRENCY, mandatory: false, includedInRfq: false }
  ]
};

// ── Benefit categories (mapped to InsurancePolicyCoverageBenefit) ─
// Per-encounter pricing: copays, percentage coverage tiers, picklists.
// Rendered in Step 3 (Benefits & Copays).
//
// Every benefit attribute is opt-in - the runtime renders all rows
// with an include checkbox (same UX as Step 2 Core Plan Coverages),
// and the value input enables once the broker checks the box. The
// prior-policy clone path auto-includes any attr the incumbent
// carried a value for via the existing catSetIncluded() call in
// _applyPriorPolicyPrefills. No benefit attrs are flagged mandatory.
//
// Per-Benefit composition fields (Step 3 renderer):
//   layout          'cost-slots' | 'native' (default 'native')
//                    - 'cost-slots' emits N Select+Value cost pairs
//                      (Copay $ / Coinsurance %), plus optional
//                      Deductible / Deductible Waiver / Limit / Notes
//                      attribute rows. Attribute rows are stacked
//                      vertically so each is its own line-item.
//                    - 'native' emits one input per tier driven by the
//                      benefit's own `dataType`. Keeps Dental / Vision
//                      benefits (currency / percentage / picklist inputs)
//                      rendering as they always have.
//   costSlots       1 | 2 (default 1) - only meaningful when
//                    layout === 'cost-slots'. Set to 2 for Benefits that
//                    accept both Copay + Coinsurance in parallel (Urgent
//                    Care / Lab + Imaging / Complex Imaging in the mockup).
//   showsDeductible boolean (default true when layout === 'cost-slots')
//   showsWaiver     boolean (default true when layout === 'cost-slots')
//   showsLimit      boolean (default true when layout === 'cost-slots')
//   showsNotes      DEPRECATED - Notes was removed from the Benefits
//                    step. Any lingering true values are ignored.
//   waiverLabel     string  (default 'Deductible Waiver')
//   waiverOptions   string[] (default DEDUCTIBLE_WAIVER_OPTIONS)
const BENEFIT_CATEGORIES_BY_ROOT = {
  medical: [
    {
      id: 'physician_services',
      label: 'Physician Services',
      attributes: [
        { id: 'med-pcp',     label: 'Office Visit: PCP',        dataType: DATA_TYPES.CURRENCY, includedInRfq: false,
          layout: 'cost-slots' },
        { id: 'med-spec',    label: 'Office Visit: Specialist', dataType: DATA_TYPES.CURRENCY, includedInRfq: false,
          layout: 'cost-slots' },
        { id: 'med-virtual', label: 'Office Visit: Virtual',    dataType: DATA_TYPES.CURRENCY, includedInRfq: false,
          layout: 'cost-slots' }
      ]
    },
    {
      id: 'preventive_services',
      label: 'Preventive Services',
      attributes: [
        { id: 'med-preventive', label: 'Preventive Care', dataType: DATA_TYPES.CURRENCY, includedInRfq: false,
          layout: 'cost-slots' },
        // Preventive Coinsurance kept as native (raw % input) since
        // downstream (quoteCompareTable / mockData / playbook setup)
        // reference this id. Not part of the mockup's Copay/Coinsurance
        // pattern.
        { id: 'med-preventive-coins', label: 'Preventive Coinsurance', dataType: DATA_TYPES.PERCENTAGE, includedInRfq: false }
      ]
    },
    {
      id: 'emergency_services',
      label: 'Emergency Services',
      attributes: [
        { id: 'med-er',     label: 'Emergency Room', dataType: DATA_TYPES.CURRENCY, includedInRfq: false,
          layout: 'cost-slots',
          waiverLabel: 'Emergency Room Copay Waived',
          waiverOptions: ['Copay Waived If Admitted', 'Not Waived'] },
        { id: 'med-urgent', label: 'Urgent Care',    dataType: DATA_TYPES.CURRENCY, includedInRfq: false,
          layout: 'cost-slots', costSlots: 2, showsWaiver: false }
      ]
    },
    {
      id: 'outpatient_services',
      label: 'Outpatient Services',
      attributes: [
        { id: 'med-inpatient',       label: 'Inpatient Hospital', dataType: DATA_TYPES.CURRENCY, includedInRfq: false,
          layout: 'cost-slots', showsWaiver: false },
        { id: 'med-outpatient',      label: 'Outpatient Surgery', dataType: DATA_TYPES.CURRENCY, includedInRfq: false,
          layout: 'cost-slots', showsWaiver: false },
        { id: 'med-lab',             label: 'Lab + Imaging',      dataType: DATA_TYPES.CURRENCY, includedInRfq: false,
          layout: 'cost-slots', costSlots: 2, showsWaiver: false },
        { id: 'med-complex-imaging', label: 'Complex Imaging',    dataType: DATA_TYPES.CURRENCY, includedInRfq: false,
          layout: 'cost-slots', costSlots: 2, showsWaiver: false }
      ]
    },
    {
      // Hospital coinsurance row called out in the Medical PPO PCM
      // §3.3 (sits between Outpatient Services and Prescription Drugs
      // in the screenshot). Single coinsurance attr covers both
      // Inpatient + Outpatient. Stays on the 'native' layout since it's
      // a straight percentage capture, not a Copay/Coinsurance choice.
      id: 'hospital_services',
      label: 'Hospital (Inpatient/Outpatient)',
      attributes: [
        { id: 'med-hospital-coinsurance', label: 'Coinsurance', dataType: DATA_TYPES.PERCENTAGE, includedInRfq: false }
      ]
    },
    {
      id: 'chiropractic_services',
      label: 'Chiropractic Services',
      attributes: [
        { id: 'med-chiro',       label: 'Chiropractic Care', dataType: DATA_TYPES.CURRENCY, includedInRfq: false,
          layout: 'cost-slots', showsWaiver: false },
        { id: 'med-acupuncture', label: 'Acupuncture',       dataType: DATA_TYPES.CURRENCY, includedInRfq: false,
          layout: 'cost-slots', showsWaiver: false }
      ]
    },
    {
      // Prescription tiers are typically flat copays per tier so we
      // keep them on cost-slots but suppress the waiver / notes columns
      // to keep the row compact.
      id: 'prescription_drugs',
      label: 'Prescription Drugs',
      attributes: [
        { id: 'med-rx-generic',      label: 'Generic Drugs (Tier 1)',             dataType: DATA_TYPES.CURRENCY, includedInRfq: false,
          layout: 'cost-slots', showsWaiver: false },
        { id: 'med-rx-preferred',    label: 'Preferred Brand Drugs (Tier 2)',     dataType: DATA_TYPES.CURRENCY, includedInRfq: false,
          layout: 'cost-slots', showsWaiver: false },
        { id: 'med-rx-nonpreferred', label: 'Non-Preferred Brand Drugs (Tier 3)', dataType: DATA_TYPES.CURRENCY, includedInRfq: false,
          layout: 'cost-slots', showsWaiver: false },
        { id: 'med-rx-specialty',    label: 'Specialty Drugs (Tier 4)',           dataType: DATA_TYPES.CURRENCY, includedInRfq: false,
          layout: 'cost-slots', showsWaiver: false },
        // PCM §3.3 - simplified Generic / Brand / Specialty trio in
        // addition to the 4-tier model above. Specialty as % matches
        // common carrier behavior; the 4-tier currency rows stay for
        // back-compat. Left on 'native' so the percentage-only spec
        // stays a plain % input.
        { id: 'med-rx-generic-copay',         label: 'Generic Copay',          dataType: DATA_TYPES.CURRENCY,   includedInRfq: false },
        { id: 'med-rx-brand-copay',           label: 'Brand Copay',            dataType: DATA_TYPES.CURRENCY,   includedInRfq: false },
        { id: 'med-rx-specialty-coinsurance', label: 'Specialty Coinsurance',  dataType: DATA_TYPES.PERCENTAGE, includedInRfq: false }
      ]
    }
  ],
  dental: [
    {
      id: 'diagnostic_preventive',
      label: 'Diagnostic & Preventive Services',
      attributes: [
        { id: 'den-preventive', label: 'Preventive Services', dataType: DATA_TYPES.PERCENTAGE, includedInRfq: false },
        { id: 'den-basic',      label: 'Basic Services',      dataType: DATA_TYPES.PERCENTAGE, includedInRfq: false },
        // PCM §4.3 - waiting period picklist on Basic Services.
        { id: 'den-basic-waiting-period', label: 'Basic Services Waiting Period', dataType: DATA_TYPES.PICKLIST, includedInRfq: false,
          options: ['None', '30 days', '60 days', '90 days', '6 months', '12 months'] }
      ]
    },
    {
      id: 'major_services',
      label: 'Major Services',
      attributes: [
        { id: 'den-major',       label: 'Major Services',       dataType: DATA_TYPES.PERCENTAGE, includedInRfq: false },
        { id: 'den-endodontic',  label: 'Endodontic Treatment', dataType: DATA_TYPES.PERCENTAGE, includedInRfq: false },
        { id: 'den-periodontic', label: 'Periodontic Treatment',dataType: DATA_TYPES.PERCENTAGE, includedInRfq: false },
        // PCM §4.3 - waiting period picklist on Major Services.
        { id: 'den-major-waiting-period', label: 'Major Services Waiting Period', dataType: DATA_TYPES.PICKLIST, includedInRfq: false,
          options: ['None', '30 days', '60 days', '90 days', '6 months', '12 months'] }
      ]
    },
    {
      id: 'orthodontia',
      label: 'Orthodontia Services',
      attributes: [
        { id: 'den-ortho',          label: 'Orthodontia Coverage',   dataType: DATA_TYPES.PERCENTAGE, includedInRfq: false },
        { id: 'den-ortho-lifetime', label: 'Lifetime Plan Maximum',  dataType: DATA_TYPES.CURRENCY,   includedInRfq: false }
      ]
    }
  ],
  vision: [
    // ── PCM §5.3 - per-benefit categories (Eye Exam / Frames /
    //    Lenses / Contacts) added 2026-06-29. Each carries the
    //    copay / allowance plus its own frequency so the runtime
    //    Step 3 renders one collapsible section per benefit type,
    //    matching the screenshot.
    {
      id: 'eye_exam',
      label: 'Eye Exam',
      attributes: [
        { id: 'vis-eye-exam-copay', label: 'Copay',     dataType: DATA_TYPES.CURRENCY, includedInRfq: false },
        { id: 'vis-eye-exam-freq',  label: 'Frequency', dataType: DATA_TYPES.PICKLIST, includedInRfq: false,
          options: ['12 months', '24 months', 'Custom'] }
      ]
    },
    {
      id: 'frames',
      label: 'Frames',
      attributes: [
        { id: 'vis-frames-allowance', label: 'Allowance', dataType: DATA_TYPES.CURRENCY, includedInRfq: false },
        { id: 'vis-frames-freq',      label: 'Frequency', dataType: DATA_TYPES.PICKLIST, includedInRfq: false,
          options: ['12 months', '24 months', 'Custom'] }
      ]
    },
    {
      id: 'lenses',
      label: 'Lenses',
      attributes: [
        { id: 'vis-lenses-copay', label: 'Copay',     dataType: DATA_TYPES.CURRENCY, includedInRfq: false },
        { id: 'vis-lenses-freq',  label: 'Frequency', dataType: DATA_TYPES.PICKLIST, includedInRfq: false,
          options: ['12 months', '24 months', 'Custom'] }
      ]
    },
    {
      id: 'contacts',
      label: 'Contacts',
      attributes: [
        { id: 'vis-contacts-allowance', label: 'Allowance', dataType: DATA_TYPES.CURRENCY, includedInRfq: false },
        { id: 'vis-contacts-freq',      label: 'Frequency', dataType: DATA_TYPES.PICKLIST, includedInRfq: false,
          options: ['12 months', '24 months', 'Custom'] }
      ]
    },
    // ── Legacy macro-categories - kept for back-compat with any
    //    prior-policy data still referencing the existing ids.
    {
      id: 'vision_services',
      label: 'Vision Services',
      attributes: [
        { id: 'vis-exam',          label: 'Exam Copay',                   dataType: DATA_TYPES.CURRENCY, includedInRfq: false },
        { id: 'vis-routine-exam',  label: 'Routine Eye Exam',             dataType: DATA_TYPES.CURRENCY, includedInRfq: false },
        { id: 'vis-contact-fit',   label: 'Contact Lens Fit & Follow-up', dataType: DATA_TYPES.CURRENCY, includedInRfq: false }
      ]
    },
    {
      id: 'hardware_materials',
      label: 'Hardware & Materials',
      attributes: [
        { id: 'vis-mat',          label: 'Materials Copay',         dataType: DATA_TYPES.CURRENCY, includedInRfq: false },
        { id: 'vis-lenses',       label: 'Standard Lenses',         dataType: DATA_TYPES.PICKLIST, includedInRfq: false,
          options: ['Covered in Full', 'Covered after Copay', 'Member Responsibility'] },
        { id: 'vis-enhancements', label: 'Lens Enhancements',       dataType: DATA_TYPES.PICKLIST, includedInRfq: false,
          options: ['Covered', 'Discount', 'Member Responsibility'] },
        { id: 'vis-freq',         label: 'Frequency (Exam/Lens/Frame)', dataType: DATA_TYPES.PICKLIST, includedInRfq: false,
          options: ['12 / 12 / 12 months', '12 / 12 / 24 months', '12 / 24 / 24 months', 'Custom'] }
      ]
    }
  ]
};

// ── Accessors ────────────────────────────────────────────────────
export function getRootProducts() {
  return ROOT_PRODUCTS.slice();
}

export function getRootProduct(rootId) {
  return ROOT_PRODUCTS.find((r) => r.id === rootId) || null;
}

export function getCoverages(rootId) {
  return (COVERAGES_BY_ROOT[rootId] || []).slice();
}

export function getBenefitCategories(rootId) {
  return (BENEFIT_CATEGORIES_BY_ROOT[rootId] || []).slice();
}

// Flat list across all roots - handy for tabsets that need to render
// "every benefit category whose parent root is currently selected".
// Returns `{ rootId, rootLabel, id, label, attributes }` rows.
export function getAllBenefitCategories(activeRootIds) {
  const roots =
    Array.isArray(activeRootIds) && activeRootIds.length
      ? ROOT_PRODUCTS.filter((r) => activeRootIds.includes(r.id))
      : ROOT_PRODUCTS;
  return roots.flatMap((r) =>
    (BENEFIT_CATEGORIES_BY_ROOT[r.id] || []).map((c) => ({
      rootId: r.id,
      rootLabel: r.label,
      id: c.id,
      label: c.label,
      attributes: c.attributes.slice()
    }))
  );
}

// Lookup helpers used by the runtime to project state into payloads.
export function findCoverageAttribute(attrId) {
  for (const rootId of Object.keys(COVERAGES_BY_ROOT)) {
    const match = COVERAGES_BY_ROOT[rootId].find((a) => a.id === attrId);
    if (match) return { rootId, attribute: match };
  }
  return null;
}

export function findBenefitAttribute(attrId) {
  for (const rootId of Object.keys(BENEFIT_CATEGORIES_BY_ROOT)) {
    const cats = BENEFIT_CATEGORIES_BY_ROOT[rootId];
    for (const cat of cats) {
      const match = cat.attributes.find((a) => a.id === attrId);
      if (match) return { rootId, categoryId: cat.id, attribute: match };
    }
  }
  return null;
}

/**
 * Toggle the `includedInRfq` flag on a single attribute. Mutates the
 * module-local catalog (prototype convenience - see top-of-file note).
 * @param {('coverage'|'benefit')} scope
 * @param {string} attrId
 * @param {boolean} flag
 * @returns {boolean} true if the attribute was found and updated
 */
export function setIncluded(scope, attrId, flag) {
  const next = !!flag;
  if (scope === 'coverage') {
    const hit = findCoverageAttribute(attrId);
    if (!hit) return false;
    hit.attribute.includedInRfq = next;
    return true;
  }
  if (scope === 'benefit') {
    const hit = findBenefitAttribute(attrId);
    if (!hit) return false;
    hit.attribute.includedInRfq = next;
    return true;
  }
  return false;
}

/**
 * Flip the `dataType` on a single attribute (Text / Currency /
 * Percentage / Picklist). Mutates the module-local catalog so both
 * the Setup widgets and the Runtime children pick up the change on
 * re-render. No-op if the attribute isn't found.
 * @param {('coverage'|'benefit')} scope
 * @param {string} attrId
 * @param {string} dataType
 * @returns {boolean}
 */
export function setDataType(scope, attrId, dataType) {
  if (!dataType) return false;
  const hit =
    scope === 'coverage'
      ? findCoverageAttribute(attrId)
      : scope === 'benefit'
        ? findBenefitAttribute(attrId)
        : null;
  if (!hit) return false;
  hit.attribute.dataType = dataType;
  return true;
}

// Iterates every attribute (across both scopes) and emits the seed
// shape used by the runtime to build its policyConfiguration map.
export function listAllAttributes() {
  const out = [];
  for (const rootId of Object.keys(COVERAGES_BY_ROOT)) {
    for (const a of COVERAGES_BY_ROOT[rootId]) {
      out.push({ scope: 'coverage', rootId, categoryId: null, ...a });
    }
  }
  for (const rootId of Object.keys(BENEFIT_CATEGORIES_BY_ROOT)) {
    for (const cat of BENEFIT_CATEGORIES_BY_ROOT[rootId]) {
      for (const a of cat.attributes) {
        out.push({ scope: 'benefit', rootId, categoryId: cat.id, ...a });
      }
    }
  }
  return out;
}
