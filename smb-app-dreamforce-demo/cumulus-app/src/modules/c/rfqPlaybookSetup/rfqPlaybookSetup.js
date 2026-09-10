import { LightningElement, api, track } from 'lwc';
import { ROOT_PRODUCTS as EB_ROOT_PRODUCTS } from 'data/ebCatalog';
import {
  SUMMARY_WIDGET_DEFS,
  getTemplatesByLobAndCoverage,
  getTemplateById,
  getMetricLabel,
  getTick as getComparisonTemplatesTick
} from 'data/comparisonTemplates';

// LOB + LOC scoping options for the Initialize stage. Mirrors the
// Comparison Setup wizard's pattern so the two flows feel
// consistent - pick LOB, then LOC narrows on that LOB, then the
// Root Product picker below scopes to the matching catalog.
// Scoped to Personal Lines + Group Benefits only - Commercial Lines
// is out of scope for this build. The COMMERCIAL_LINES::PROPERTY
// blueprint stays in FLOW_BLUEPRINTS in case legacy data references
// it, but the picker no longer surfaces it.
const WIZARD_LOB_OPTIONS = [
  { value: 'PERSONAL_LINES', label: 'Personal Lines' },
  { value: 'GROUP_BENEFITS', label: 'Group Benefits' }
];
const WIZARD_LOC_OPTIONS_BY_LOB = {
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

// ─────────────────────────────────────────────────────────────────────────
// c-rfq-playbook-setup (Template Builder)
//
// Renders the Configure step body of the RFQ Template wizard. The flow is
// fully driven by the Stage 0 (Initialization) selections:
//
//   @api lob       - 'PERSONAL_LINES' | 'COMMERCIAL_LINES' | 'GROUP_BENEFITS'
//   @api coverage  - 'AUTO' | 'HOME' | 'PROPERTY' | 'HEALTH'
//
// Only two LOB×Coverage pairs ship with a real flow today
// (PERSONAL_LINES::AUTO and GROUP_BENEFITS::HEALTH); everything else lands
// on an empty-canvas placeholder.
//
// Right-panel layering (top-down):
//
//   default        - read-only product hierarchy mind-map auto-mounted
//                    the moment a Root Product is picked. Replaced
//                    in-place when the admin clicks any stage tile,
//                    restored when no stage is active.
//   per-stage      - one of three contextual variants keyed off the
//                    active stage's `kind`:
//                       `sections`        - tabset of SF-object groups
//                                           (IPA / IPP / IPC / IPCA /
//                                           IPCB) with checkbox-style
//                                           attribute selection + eye-
//                                           icon preview of read-only
//                                           PCM metadata
//                       `quoteComparison` - optional Quote Comparison
//                                           stage; admin links an
//                                           independent comparison
//                                           template
//                       `review`          - non-PCM integration toggles
//                                           (Agentforce Quote Summary +
//                                           Slack Integration scope)
//
// Attribute definitions are PCM-owned (Data Type, Required by Product,
// Help Text are dictated by the Product Catalog and therefore rendered
// read-only). Admins can only toggle which attributes the broker should
// capture, and optionally add ad-hoc custom fields via the "Add new
// Attribute/Field" trap door at the bottom of the panel.
//
// Emits:
//   assignmentschange -
//     { assignments: { lob, coverage, attrs, reviewConfig, customFields } }
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_DISPLAY_TYPE = 'text';

// Mock Salesforce Object Manager catalog - what the admin sees in
// the "+ Add Custom Object" modal. Standard + custom mixed for
// realism; in a real org these come from EntityDefinition + a
// FilterableObjects screen.
const SF_OBJECTS_CATALOG = [
  { apiName: 'Account',                label: 'Account',                  isStandard: true  },
  { apiName: 'Contact',                label: 'Contact',                  isStandard: true  },
  { apiName: 'Opportunity',            label: 'Opportunity',              isStandard: true  },
  { apiName: 'Lead',                   label: 'Lead',                     isStandard: true  },
  { apiName: 'Case',                   label: 'Case',                     isStandard: true  },
  { apiName: 'Vehicle_Addon__c',       label: 'Vehicle Addon',            isStandard: false },
  { apiName: 'Broker_Notes__c',        label: 'Broker Notes',             isStandard: false },
  { apiName: 'Risk_Score__c',          label: 'Risk Score',               isStandard: false },
  { apiName: 'Telematics_Data__c',     label: 'Telematics Data',          isStandard: false },
  { apiName: 'Policy_Endorsement__c',  label: 'Policy Endorsement',       isStandard: false }
];

// Hierarchy-row tone palette + kind labels (mirrors the Visualize legend
// in PCM Setup). Used to color each node card and the legend chips.
const HIERARCHY_KINDS = [
  { kind: 'bundle',         tone: 'electric-blue', label: 'Bundle' },
  { kind: 'classification', tone: 'purple',        label: 'Classification' },
  { kind: 'product',        tone: 'cloud-blue',    label: 'Product' },
  { kind: 'coverage',       tone: 'teal',          label: 'Coverage' },
  { kind: 'attrGroup',      tone: 'orange',        label: 'Attribute Group' },
  { kind: 'attribute',      tone: 'yellow',        label: 'Attribute' }
];
const HIERARCHY_TONES = HIERARCHY_KINDS.reduce((acc, k) => {
  acc[k.kind] = k.tone;
  return acc;
}, {});
const HIERARCHY_KIND_LABELS = HIERARCHY_KINDS.reduce((acc, k) => {
  acc[k.kind] = k.label;
  return acc;
}, {});

// FLOW_BLUEPRINTS: the single source of truth for the canvas + right
// panel. Keyed by `${LOB}::${COVERAGE}`. Only the two documented paths
// ship; lookups against any other pair return undefined and render the
// empty-canvas placeholder.
const FLOW_BLUEPRINTS = {
  'GROUP_BENEFITS::HEALTH': {
    label: 'Group Benefits - Health',
    hierarchy: {
      kind: 'bundle',
      label: 'FamilyHealth - Standard',
      children: [
        {
          kind: 'classification',
          label: 'Member',
          children: [
            {
              kind: 'product',
              label: 'Member Medical',
              children: [
                { kind: 'coverage', label: 'In-Network Coverage' },
                { kind: 'coverage', label: 'Out-of-Network Coverage' }
              ]
            }
          ]
        }
      ]
    },
    // EB Health is now a 4-stage flow - the legacy combined
    // "Coverages & Benefits" stage was split into two distinct steps:
    //   • plan_coverages - IPC macro-level financial caps
    //     (Deductibles + OOP limits)
    //   • plan_benefits  - IPCB clinical encounter cost shares
    //     (Office Visits / Specialist / Virtual Care)
    // This mirrors the decoupled lifecycle the broker now sees in
    // c-rfq-workspace-eb, where the runtime sidebar exposes Core Plan
    // Coverages and Benefits & Copays as separate wizard milestones.
    stages: [
      {
        id: 'rate_plan',
        kind: 'sections',
        iconKind: 'groups',
        title: 'Rate Plan Selection',
        desc: 'Define base rate tiers and census enrollment parameters.',
        isMandatory: true,
        isCompleted: true,
        // Two-tab layout: the parent Rate Plan record (header-level
        // attributes like Frequency + Rate Plan Type) and the child
        // Rate Plan Line records (one row per tier with its enrollment
        // count + carrier rate). Tabs render via c-rfq-playbook-setup's
        // standard tabset so the admin can flip between the two scopes
        // without leaving the stage.
        sections: [
          {
            id: 'rate_plan_header',
            sfObject: 'InsuranceRatePlan',
            label: 'Rate Plan',
            attributes: [
              { id: 'rp-frequency', label: 'Frequency',      displayType: 'picklist' },
              { id: 'rp-type',      label: 'Rate Plan Type', displayType: 'picklist' }
            ]
          },
          {
            id: 'rate_plan_line',
            sfObject: 'InsuranceRatePlanLine',
            label: 'Rate Plan Line',
            attributes: [
              { id: 'rpl-tier',       label: 'Tier',             displayType: 'picklist' },
              { id: 'rpl-enrollment', label: 'Enrollment Count', displayType: 'range'    },
              { id: 'rpl-rate',       label: 'Rate',             displayType: 'currency' }
            ]
          }
        ]
      },
      {
        id: 'plan_coverages',
        kind: 'sections',
        iconKind: 'slider',
        title: 'Plan Coverages',
        desc: 'Configure individual/family deductibles and out-of-pocket maximums.',
        // Optional - brokers can ship a plan with just Rate Plan +
        // Benefits & Copays if the carrier doesn't require macro-level
        // IPC caps on this product. The admin can remove the widget
        // from the canvas just like Plan Benefits & Copays.
        isMandatory: false,
        isCompleted: false,
        sections: [
          {
            id: 'ipc',
            sfObject: 'IPC',
            label: 'Insurance Policy Coverages',
            attributes: [
              { id: 'deductible_ind', label: 'Annual Deductible: Individual',           displayType: 'currency' },
              { id: 'deductible_fam', label: 'Annual Deductible: Family',               displayType: 'currency' },
              { id: 'oop_max_ind',    label: 'Annual Out-of-Pocket Limit: Individual',  displayType: 'currency' },
              { id: 'oop_max_fam',    label: 'Annual Out-of-Pocket Limit: Family',      displayType: 'currency' }
            ]
          }
        ]
      },
      {
        id: 'plan_benefits',
        kind: 'sections',
        iconKind: 'form',
        title: 'Plan Benefits',
        desc: 'Map copay tiers for doctor visits, specialist care, and facility services.',
        isMandatory: false,
        isCompleted: false,
        sections: [
          {
            id: 'ipcb',
            sfObject: 'IPCB',
            label: 'Insurance Policy Coverage Benefits',
            attributes: [
              { id: 'copay_pcp',           label: 'Office Visit: PCP',         displayType: 'currency' },
              { id: 'copay_specialist',    label: 'Office Visit: Specialist',  displayType: 'currency' },
              { id: 'copay_virtual',       label: 'Office Visit: Virtual Care', displayType: 'picklist' },
              { id: 'benefit_preventive',  label: 'Preventive Care Services',  displayType: 'picklist' }
            ]
          }
        ]
      },
      {
        // Optional Quote Comparison stage - admin links an independent
        // comparison template so the broker sees a side-by-side
        // matrix at quote presentation time. Same blueprint shape as
        // the PERSONAL_LINES::AUTO blueprint's equivalent stage, so
        // c-rfq-playbook-setup renders Variant D when this stage is
        // active.
        id: 'quote_comparison',
        kind: 'quoteComparison',
        iconKind: 'table',
        title: 'Quote Comparison',
        desc: 'Link a comparison template to surface a side-by-side broker matrix.',
        isCompleted: false
      },
      {
        id: 'review',
        kind: 'review',
        iconKind: 'slider',
        title: 'Review and Send',
        desc: 'Validate configuration guardrails, link Slack, and activate pipeline.',
        isMandatory: true,
        isCompleted: false
      }
    ]
  },
  'PERSONAL_LINES::AUTO': {
    label: 'Personal Lines - Auto',
    hierarchy: {
      kind: 'bundle',
      label: 'AutoSilver',
      children: [
        {
          kind: 'classification',
          label: 'Auto',
          children: [
            {
              kind: 'product',
              label: 'Vehicle',
              children: [
                { kind: 'coverage', label: 'Liability' },
                { kind: 'coverage', label: 'Collision' },
                { kind: 'coverage', label: 'Comprehensive' }
              ]
            }
          ]
        },
        {
          kind: 'classification',
          label: 'Driver',
          children: [
            {
              kind: 'product',
              label: 'Operator',
              children: [
                { kind: 'coverage', label: 'Personal Injury Protection' },
                { kind: 'coverage', label: 'Uninsured Motorist' }
              ]
            }
          ]
        }
      ]
    },
    stages: [
      {
        // Design-time stage that drives the runtime "Schedule of
        // Vehicles" roster - the broker view (c-pa-asset-tree
        // mode="roster", future c-pa-vehicle-roster) renders
        // vehicles + their nested drivers from this stage's two
        // sections. Attributes carrying a `runtimeFlagKey` drive
        // the flat runtimeConfig map exposed alongside the nested
        // `attrs` assignments in _emit() so the runtime can toggle
        // per-field visibility without walking the blueprint tree.
        id: 'collection',
        kind: 'sections',
        iconKind: 'form',
        title: 'Asset Data Capture',
        desc: 'Capture vehicle assets and assigned operators. Toggle which fields the broker sees in the runtime roster.',
        isCompleted: true,
        // Vehicle (IPA) + Driver (IPP) attribute lists pulled
        // verbatim from docs/pcm-catalog.md §2.1 (Auto Root).
        // `isRequired` is the PCM-asserted required flag (mirrors
        // the "req" column in the catalog table); the rendering
        // layer treats Required by Product as PCM-owned + read-only.
        // `runtimeFlagKey` tags the fields the runtime config map
        // exposes for per-template visibility toggles.
        sections: [
          {
            id: 'ipa',
            sfObject: 'IPA',
            label: 'Vehicles',
            attributes: [
              { id: 'vin',                     label: 'VIN',                       displayType: 'picklist', isRequired: true,  runtimeFlagKey: 'showVIN' },
              { id: 'year',                    label: 'Year',                      displayType: 'range',    isRequired: true },
              { id: 'make',                    label: 'Make',                      displayType: 'picklist', isRequired: true },
              { id: 'model',                   label: 'Model',                     displayType: 'picklist', isRequired: true },
              { id: 'auto-value',              label: 'Auto Value',                displayType: 'range' },
              { id: 'purchase-date',           label: 'Purchase Date',             displayType: 'picklist' },
              { id: 'annual-mileage',          label: 'Annual Mileage',            displayType: 'range',    runtimeFlagKey: 'showMileage' },
              { id: 'garaging-zip',            label: 'Garaging ZIP Code',         displayType: 'picklist' },
              { id: 'anti-lock-brakes',        label: 'Anti-Lock Brakes',          displayType: 'picklist' },
              { id: 'daytime-running-lights',  label: 'Daytime Running Lights',    displayType: 'picklist' }
            ]
          },
          {
            id: 'ipp',
            sfObject: 'IPP',
            label: 'Drivers',
            attributes: [
              { id: 'first-name',         label: 'First Name',         displayType: 'picklist', isRequired: true },
              { id: 'last-name',          label: 'Last Name',          displayType: 'picklist', isRequired: true },
              { id: 'date-of-birth',      label: 'Date of Birth',      displayType: 'picklist', isRequired: true },
              { id: 'gender',             label: 'Gender',             displayType: 'picklist' },
              { id: 'marital-status',     label: 'Marital Status',     displayType: 'picklist' },
              { id: 'occupation',         label: 'Occupation',         displayType: 'picklist' },
              { id: 'license-status',     label: 'License Status',     displayType: 'picklist', isRequired: true },
              { id: 'license-number',     label: 'License Number',     displayType: 'picklist', isRequired: true, runtimeFlagKey: 'showLicense' },
              { id: 'license-state',      label: 'License State',      displayType: 'picklist' },
              { id: 'age-first-licensed', label: 'Age First Licensed', displayType: 'range' }
            ]
          }
        ]
      },
      {
        // 3-tier coverage configurator - section labels are
        // intentionally semantic ("Global Limits" / "Per-Vehicle
        // Coverages" / "Per-Driver Coverages") rather than the
        // underlying SF object names (IPC / IPCA / IPCP) so the
        // tab strip stays short, doesn't truncate on small
        // viewports, and mirrors the runtime tree's tiering:
        //   Policy-Level (IPC)        -> Global Limits
        //   Vehicle-Scoped (IPCA)     -> Per-Vehicle Coverages
        //   Driver-Scoped (IPCP)      -> Per-Driver Coverages
        // sfObject stays as the technical anchor for PCM lookups
        // and the publish/export contract.
        id: 'coverages',
        kind: 'sections',
        iconKind: 'slider',
        title: 'Coverage Limits',
        desc: 'Tier coverages across the policy, per-vehicle, and per-driver scopes. Tabs map to the runtime tree levels.',
        isCompleted: true,
        sections: [
          {
            id: 'ipc',
            sfObject: 'IPC',
            label: 'Global Limits',
            attributes: [
              { id: 'bodily-injury',   label: 'Bodily Injury Limit',      displayType: 'range' },
              { id: 'property-damage', label: 'Property Damage Limit',    displayType: 'range' },
              { id: 'uninsured',       label: 'Uninsured Motorist Limit', displayType: 'range' }
            ]
          },
          {
            // `renderMode: 'instances'` flips this section's tab body
            // from a flat checklist into a stack of collapsible
            // accordions - one per "vehicle slot" - to convey that the
            // coverage attributes ticked here apply on a per-vehicle
            // basis at runtime. The attribute toggles themselves remain
            // template-level (shared across every accordion) so the
            // emit payload stays a single flat map. An "Apply to All"
            // affordance above the accordions activates every
            // attribute in the section in one click.
            id: 'ipca',
            sfObject: 'IPCA',
            label: 'Vehicle Coverages',
            renderMode: 'instances',
            instanceCount: 3,
            instanceLabelTemplate: 'Vehicle {n}',
            attributes: [
              { id: 'comprehensive-ded', label: 'Comprehensive Deductible', displayType: 'range' },
              { id: 'collision-ded',     label: 'Collision Deductible',     displayType: 'range' },
              { id: 'rental',            label: 'Rental Reimbursement',     displayType: 'range' }
            ]
          },
          {
            id: 'ipcp',
            sfObject: 'IPCP',
            label: 'Driver Coverages',
            renderMode: 'instances',
            instanceCount: 3,
            instanceLabelTemplate: 'Driver {n}',
            attributes: [
              { id: 'add',          label: 'Accidental Death & Dismemberment', displayType: 'range' },
              { id: 'med-pay',      label: 'Medical Payments',                 displayType: 'range' },
              { id: 'crisis-resp',  label: 'Crisis Response',                  displayType: 'picklist' }
            ]
          }
        ]
      },
      {
        id: 'quote_comparison',
        kind: 'quoteComparison',
        iconKind: 'table',
        title: 'Quote Comparison',
        desc: 'Map side-by-side evaluation matrices and match template fields.',
        isCompleted: false
      },
      {
        id: 'review',
        kind: 'review',
        iconKind: 'slider',
        title: 'Review and Send',
        desc: 'Validate configuration guardrails, link Slack, and activate pipeline.',
        isCompleted: false
      }
    ]
  },
  // ── Personal Lines :: Home (HO-3) ─────────────────────────
  // Source of truth: docs/pcm-catalog.md §1. Hierarchy mirrors
  // Property (IPA) coverages A-D + the two policy-level coverages
  // (E. Personal Liability / F. Med Pay to Others) that branch
  // off Root rather than Property. The collection stage hosts the
  // full Property + Named Insured (IPP) attribute lists.
  'PERSONAL_LINES::HOME': {
    label: 'Personal Lines - Home',
    hierarchy: {
      kind: 'bundle',
      label: 'Home Root (HO-3)',
      children: [
        {
          kind: 'classification',
          label: 'Property',
          children: [
            {
              kind: 'product',
              label: 'Dwelling',
              children: [
                { kind: 'coverage', label: 'A. Dwelling' },
                { kind: 'coverage', label: 'B. Other Structures' },
                { kind: 'coverage', label: 'C. Personal Property' },
                { kind: 'coverage', label: 'D. Loss of Use' }
              ]
            }
          ]
        },
        {
          kind: 'classification',
          label: 'Named Insured',
          children: [
            {
              kind: 'product',
              label: 'Policy-Level',
              children: [
                { kind: 'coverage', label: 'E. Personal Liability' },
                { kind: 'coverage', label: 'F. Med Pay to Others' }
              ]
            }
          ]
        }
      ]
    },
    stages: [
      {
        // Property (IPA) + Named Insured (IPP) attributes pulled
        // verbatim from docs/pcm-catalog.md §1.1 (Home HO-3).
        id: 'collection',
        kind: 'sections',
        iconKind: 'form',
        title: 'Asset Data Capture',
        desc: 'Capture the insured property and the named insured. Toggle which fields the broker sees in the runtime intake.',
        isCompleted: true,
        sections: [
          {
            id: 'ipa',
            sfObject: 'IPA',
            label: 'Property',
            attributes: [
              { id: 'property-street',       label: 'Property Street',         displayType: 'picklist', isRequired: true },
              { id: 'property-city',         label: 'Property City',           displayType: 'picklist', isRequired: true },
              { id: 'property-state',        label: 'Property State',          displayType: 'picklist', isRequired: true },
              { id: 'property-zip',          label: 'Property ZIP',            displayType: 'picklist', isRequired: true },
              { id: 'dwelling-usage',        label: 'Dwelling Usage',          displayType: 'picklist' },
              { id: 'occupancy-type',        label: 'Occupancy Type',          displayType: 'picklist' },
              { id: 'dwelling-type',         label: 'Dwelling Type',           displayType: 'picklist', isRequired: true },
              { id: 'year-built',            label: 'Year Built',              displayType: 'range' },
              { id: 'square-footage',        label: 'Square Footage',          displayType: 'range' },
              { id: 'stories',               label: 'Stories',                 displayType: 'range' },
              { id: 'replacement-cost-value',label: 'Replacement Cost Value',  displayType: 'range' },
              { id: 'construction-type',     label: 'Construction Type',       displayType: 'picklist' },
              { id: 'roof-type',             label: 'Roof Type',               displayType: 'picklist' },
              { id: 'roof-age',              label: 'Roof Age',                displayType: 'range' },
              { id: 'foundation',            label: 'Foundation',              displayType: 'picklist' },
              { id: 'pool',                  label: 'Pool',                    displayType: 'picklist' },
              { id: 'number-of-occupants',   label: 'Number of Occupants',     displayType: 'range' }
            ]
          },
          {
            id: 'ipp',
            sfObject: 'IPP',
            label: 'Named Insured',
            attributes: [
              { id: 'name',           label: 'Name',           displayType: 'picklist', isRequired: true },
              { id: 'dob',            label: 'Date of Birth',  displayType: 'picklist', isRequired: true },
              { id: 'marital-status', label: 'Marital Status', displayType: 'picklist' },
              { id: 'prior-carrier',  label: 'Prior Carrier',  displayType: 'picklist' }
            ]
          }
        ]
      },
      // Coverages, Quote Comparison and Review stages mirror the
      // Auto blueprint's shape so the PL Home pipeline renders the
      // same downstream steps. Coverage Limits is overridden at the
      // workspace level (substep `component: COMP_COVERAGE_LIMITS`)
      // which currently renders the Auto coverage tabs - a Home
      // variant is a future iteration.
      {
        id: 'coverages',
        kind: 'sections',
        iconKind: 'slider',
        title: 'Coverage Limits',
        desc: 'Tier coverages across the dwelling and policy-level scopes.',
        isCompleted: true,
        sections: [
          {
            id: 'ipc',
            sfObject: 'IPC',
            label: 'Policy-Level Coverages',
            attributes: [
              { id: 'personal-liability', label: 'Personal Liability Limit', displayType: 'range' },
              { id: 'med-pay-others',     label: 'Med Pay to Others Limit',  displayType: 'range' }
            ]
          },
          {
            id: 'ipca',
            sfObject: 'IPCA',
            label: 'Dwelling Coverages',
            attributes: [
              { id: 'dwelling-limit',         label: 'A. Dwelling Limit + Deductible', displayType: 'range' },
              { id: 'other-structures',       label: 'B. Other Structures Limit',      displayType: 'range' },
              { id: 'personal-property',      label: 'C. Personal Property Limit + Deductible', displayType: 'range' },
              { id: 'loss-of-use',            label: 'D. Loss of Use Limit',           displayType: 'range' }
            ]
          }
        ]
      },
      {
        id: 'quote_comparison',
        kind: 'quoteComparison',
        iconKind: 'table',
        title: 'Quote Comparison',
        desc: 'Map side-by-side evaluation matrices and match template fields.',
        isCompleted: false
      },
      {
        id: 'review',
        kind: 'review',
        iconKind: 'slider',
        title: 'Review and Send',
        desc: 'Validate configuration guardrails, link Slack, and activate pipeline.',
        isCompleted: false
      }
    ]
  },

  // ── Group Benefits - Medical PPO ─────────────────────────────────
  // First-class blueprint (no longer aliased to HEALTH). Hierarchy +
  // attribute lists captured verbatim from the Medical PPO PCM
  // diagram (docs/pcm-catalog.md §3). Stage shape mirrors the EB
  // 5-step pipeline: rate_plan -> plan_coverages -> plan_benefits
  // -> quote_comparison -> review (matches CONFIGURE_SUBSTEPS in
  // c-insurance-setup-workspace's GB branch).
  'GROUP_BENEFITS::MEDICAL': {
    label: 'Group Benefits - Medical PPO',
    hierarchy: {
      kind: 'bundle',
      label: 'Medical PPO Root',
      children: [
        {
          kind: 'classification',
          label: 'Member',
          children: [
            { kind: 'product', label: 'Member (IPP)', children: [] }
          ]
        },
        {
          kind: 'classification',
          label: 'Plan',
          children: [
            {
              kind: 'product',
              label: 'Medical PPO',
              children: [
                { kind: 'coverage', label: 'Preventive Care' },
                { kind: 'coverage', label: 'Primary Care' },
                { kind: 'coverage', label: 'Specialist' },
                { kind: 'coverage', label: 'Emergency Services' },
                { kind: 'coverage', label: 'Hospital (Inpatient/Outpatient)' },
                { kind: 'coverage', label: 'Prescription Drugs' }
              ]
            }
          ]
        }
      ]
    },
    stages: [
      {
        id: 'rate_plan',
        kind: 'sections',
        iconKind: 'groups',
        title: 'Rate Plan Selection',
        desc: 'Define base rate tiers and census enrollment parameters.',
        isMandatory: true,
        isCompleted: true,
        sections: [
          {
            id: 'rate_plan_header',
            sfObject: 'InsuranceRatePlan',
            label: 'Rate Plan',
            attributes: [
              { id: 'rp-frequency', label: 'Frequency',      displayType: 'picklist' },
              { id: 'rp-type',      label: 'Rate Plan Type', displayType: 'picklist' }
            ]
          },
          {
            id: 'rate_plan_line',
            sfObject: 'InsuranceRatePlanLine',
            label: 'Rate Plan Line',
            attributes: [
              { id: 'rpl-tier',       label: 'Tier',             displayType: 'picklist' },
              { id: 'rpl-enrollment', label: 'Enrollment Count', displayType: 'range'    },
              { id: 'rpl-rate',       label: 'Rate',             displayType: 'currency' }
            ]
          }
        ]
      },
      {
        id: 'plan_coverages',
        kind: 'sections',
        iconKind: 'slider',
        title: 'Plan Coverages',
        desc: 'Plan-level rating attributes - network, deductibles, OOP maxes, and coinsurance.',
        isMandatory: false,
        isCompleted: false,
        sections: [
          {
            id: 'ipc',
            sfObject: 'IPC',
            label: 'Medical PPO',
            attributes: [
              { id: 'med-deductible-ind',   label: 'Annual Deductible: Individual',           displayType: 'currency' },
              { id: 'med-deductible-fam',   label: 'Annual Deductible: Family',               displayType: 'currency' },
              { id: 'med-oop-ind',          label: 'Annual Out-of-Pocket Limit: Individual',  displayType: 'currency' },
              { id: 'med-oop-fam',          label: 'Annual Out-of-Pocket Limit: Family',      displayType: 'currency' },
              { id: 'med-coinsurance-pct',  label: 'Coinsurance %',                           displayType: 'percentage' }
            ]
          }
        ]
      },
      {
        id: 'plan_benefits',
        kind: 'sections',
        iconKind: 'form',
        title: 'Plan Benefits',
        desc: 'Per-visit cost-sharing rows beneath the Medical PPO coverage.',
        isMandatory: false,
        isCompleted: false,
        sections: [
          {
            id: 'preventive_care',
            sfObject: 'IPCB',
            label: 'Preventive Care',
            attributes: [
              { id: 'med-preventive-coins', label: 'Coinsurance', displayType: 'percentage' }
            ]
          },
          {
            id: 'primary_care',
            sfObject: 'IPCB',
            label: 'Primary Care',
            attributes: [
              { id: 'med-primary-copay',       label: 'Copay',       displayType: 'currency' },
              { id: 'med-primary-coinsurance', label: 'Coinsurance', displayType: 'percentage' }
            ]
          },
          {
            id: 'specialist',
            sfObject: 'IPCB',
            label: 'Specialist',
            attributes: [
              { id: 'med-specialist-copay',       label: 'Copay',       displayType: 'currency' },
              { id: 'med-specialist-coinsurance', label: 'Coinsurance', displayType: 'percentage' }
            ]
          },
          {
            id: 'emergency_services',
            sfObject: 'IPCB',
            label: 'Emergency Services',
            attributes: [
              { id: 'med-emergency-copay',       label: 'Copay',       displayType: 'currency' },
              { id: 'med-emergency-coinsurance', label: 'Coinsurance', displayType: 'percentage' }
            ]
          },
          {
            id: 'hospital',
            sfObject: 'IPCB',
            label: 'Hospital (Inpatient/Outpatient)',
            attributes: [
              { id: 'med-hospital-coinsurance', label: 'Coinsurance', displayType: 'percentage' }
            ]
          },
          {
            id: 'prescription_drugs',
            sfObject: 'IPCB',
            label: 'Prescription Drugs',
            attributes: [
              { id: 'med-rx-generic-copay',         label: 'Generic Copay',        displayType: 'currency' },
              { id: 'med-rx-brand-copay',           label: 'Brand Copay',          displayType: 'currency' },
              { id: 'med-rx-specialty-coinsurance', label: 'Specialty Coinsurance', displayType: 'percentage' }
            ]
          }
        ]
      },
      {
        id: 'quote_comparison',
        kind: 'quoteComparison',
        iconKind: 'table',
        title: 'Quote Comparison',
        desc: 'Link a comparison template to surface a side-by-side broker matrix.',
        isCompleted: false
      },
      {
        id: 'review',
        kind: 'review',
        iconKind: 'slider',
        title: 'Review and Send',
        desc: 'Validate configuration guardrails, link Slack, and activate pipeline.',
        isMandatory: true,
        isCompleted: false
      }
    ]
  },

  // ── Group Benefits - Dental DPPO ─────────────────────────────────
  // Hierarchy + attribute lists captured verbatim from the Dental
  // DPPO PCM diagram (docs/pcm-catalog.md §4). Same 5-stage shape as
  // Medical PPO so the GB CONFIGURE_SUBSTEPS substep list keeps
  // resolving.
  'GROUP_BENEFITS::DENTAL': {
    label: 'Group Benefits - Dental DPPO',
    hierarchy: {
      kind: 'bundle',
      label: 'Dental DPPO Root',
      children: [
        {
          kind: 'classification',
          label: 'Member',
          children: [
            { kind: 'product', label: 'Member (IPP)', children: [] }
          ]
        },
        {
          kind: 'classification',
          label: 'Plan',
          children: [
            {
              kind: 'product',
              label: 'Dental DPPO',
              children: [
                { kind: 'coverage', label: 'Preventive & Diagnostic' },
                { kind: 'coverage', label: 'Basic Services' },
                { kind: 'coverage', label: 'Major Services' },
                { kind: 'coverage', label: 'Orthodontia' }
              ]
            }
          ]
        }
      ]
    },
    stages: [
      {
        id: 'rate_plan',
        kind: 'sections',
        iconKind: 'groups',
        title: 'Rate Plan Selection',
        desc: 'Define base rate tiers and census enrollment parameters.',
        isMandatory: true,
        isCompleted: true,
        sections: [
          {
            id: 'rate_plan_header',
            sfObject: 'InsuranceRatePlan',
            label: 'Rate Plan',
            attributes: [
              { id: 'rp-frequency', label: 'Frequency',      displayType: 'picklist' },
              { id: 'rp-type',      label: 'Rate Plan Type', displayType: 'picklist' }
            ]
          },
          {
            id: 'rate_plan_line',
            sfObject: 'InsuranceRatePlanLine',
            label: 'Rate Plan Line',
            attributes: [
              { id: 'rpl-tier',       label: 'Tier',             displayType: 'picklist' },
              { id: 'rpl-enrollment', label: 'Enrollment Count', displayType: 'range'    },
              { id: 'rpl-rate',       label: 'Rate',             displayType: 'currency' }
            ]
          }
        ]
      },
      {
        id: 'plan_coverages',
        kind: 'sections',
        iconKind: 'slider',
        title: 'Plan Coverages',
        desc: 'Plan-level rating attributes - network, annual maximum, and deductible.',
        isMandatory: false,
        isCompleted: false,
        sections: [
          {
            id: 'ipc',
            sfObject: 'IPC',
            label: 'Dental DPPO',
            attributes: [
              { id: 'den-annual-max',  label: 'Annual Maximum',  displayType: 'currency' },
              { id: 'den-deductible',  label: 'Deductible',      displayType: 'currency' }
            ]
          }
        ]
      },
      {
        id: 'plan_benefits',
        kind: 'sections',
        iconKind: 'form',
        title: 'Plan Benefits',
        desc: '3-tier industry standard (Preventive / Basic / Major) plus Orthodontia.',
        isMandatory: false,
        isCompleted: false,
        sections: [
          {
            id: 'preventive_diagnostic',
            sfObject: 'IPCB',
            label: 'Preventive & Diagnostic',
            attributes: [
              { id: 'den-preventive-coinsurance', label: 'Coinsurance', displayType: 'percentage' }
            ]
          },
          {
            id: 'basic_services',
            sfObject: 'IPCB',
            label: 'Basic Services',
            attributes: [
              { id: 'den-basic-coinsurance',     label: 'Coinsurance',     displayType: 'percentage' },
              { id: 'den-basic-waiting-period',  label: 'Waiting Period',  displayType: 'picklist' }
            ]
          },
          {
            id: 'major_services',
            sfObject: 'IPCB',
            label: 'Major Services',
            attributes: [
              { id: 'den-major-coinsurance',     label: 'Coinsurance',     displayType: 'percentage' },
              { id: 'den-major-waiting-period',  label: 'Waiting Period',  displayType: 'picklist' }
            ]
          },
          {
            id: 'orthodontia',
            sfObject: 'IPCB',
            label: 'Orthodontia',
            attributes: [
              { id: 'den-ortho-coinsurance',      label: 'Coinsurance',       displayType: 'percentage' },
              { id: 'den-ortho-lifetime-max',     label: 'Lifetime Maximum',  displayType: 'currency' }
            ]
          }
        ]
      },
      {
        id: 'quote_comparison',
        kind: 'quoteComparison',
        iconKind: 'table',
        title: 'Quote Comparison',
        desc: 'Link a comparison template to surface a side-by-side broker matrix.',
        isCompleted: false
      },
      {
        id: 'review',
        kind: 'review',
        iconKind: 'slider',
        title: 'Review and Send',
        desc: 'Validate configuration guardrails, link Slack, and activate pipeline.',
        isMandatory: true,
        isCompleted: false
      }
    ]
  },

  // ── Group Benefits - Vision Plan ─────────────────────────────────
  // Hierarchy + attribute lists captured verbatim from the Vision
  // Plan PCM diagram (docs/pcm-catalog.md §5). Same 5-stage shape as
  // Medical PPO / Dental DPPO.
  'GROUP_BENEFITS::VISION': {
    label: 'Group Benefits - Vision Plan',
    hierarchy: {
      kind: 'bundle',
      label: 'Vision Plan Root',
      children: [
        {
          kind: 'classification',
          label: 'Member',
          children: [
            { kind: 'product', label: 'Member (IPP)', children: [] }
          ]
        },
        {
          kind: 'classification',
          label: 'Plan',
          children: [
            {
              kind: 'product',
              label: 'Vision Plan',
              children: [
                { kind: 'coverage', label: 'Eye Exam' },
                { kind: 'coverage', label: 'Frames' },
                { kind: 'coverage', label: 'Lenses' },
                { kind: 'coverage', label: 'Contacts' }
              ]
            }
          ]
        }
      ]
    },
    stages: [
      {
        id: 'rate_plan',
        kind: 'sections',
        iconKind: 'groups',
        title: 'Rate Plan Selection',
        desc: 'Define base rate tiers and census enrollment parameters.',
        isMandatory: true,
        isCompleted: true,
        sections: [
          {
            id: 'rate_plan_header',
            sfObject: 'InsuranceRatePlan',
            label: 'Rate Plan',
            attributes: [
              { id: 'rp-frequency', label: 'Frequency',      displayType: 'picklist' },
              { id: 'rp-type',      label: 'Rate Plan Type', displayType: 'picklist' }
            ]
          },
          {
            id: 'rate_plan_line',
            sfObject: 'InsuranceRatePlanLine',
            label: 'Rate Plan Line',
            attributes: [
              { id: 'rpl-tier',       label: 'Tier',             displayType: 'picklist' },
              { id: 'rpl-enrollment', label: 'Enrollment Count', displayType: 'range'    },
              { id: 'rpl-rate',       label: 'Rate',             displayType: 'currency' }
            ]
          }
        ]
      },
      {
        id: 'plan_coverages',
        kind: 'sections',
        iconKind: 'slider',
        title: 'Plan Coverages',
        desc: 'Plan-level rating attributes - network, plan year, and exam / lens / frame frequencies.',
        isMandatory: false,
        isCompleted: false,
        sections: [
          {
            id: 'ipc',
            sfObject: 'IPC',
            label: 'Vision Plan',
            attributes: [
              { id: 'vis-exam-freq',      label: 'Exam Frequency',  displayType: 'picklist' },
              { id: 'vis-lens-freq',      label: 'Lens Frequency',  displayType: 'picklist' },
              { id: 'vis-frame-freq',     label: 'Frame Frequency', displayType: 'picklist' }
            ]
          }
        ]
      },
      {
        id: 'plan_benefits',
        kind: 'sections',
        iconKind: 'form',
        title: 'Plan Benefits',
        desc: 'Per-benefit cost-sharing for exam, frames, lenses, and contacts.',
        isMandatory: false,
        isCompleted: false,
        sections: [
          {
            id: 'eye_exam',
            sfObject: 'IPCB',
            label: 'Eye Exam',
            attributes: [
              { id: 'vis-eye-exam-copay',  label: 'Copay',     displayType: 'currency' },
              { id: 'vis-eye-exam-freq',   label: 'Frequency', displayType: 'picklist' }
            ]
          },
          {
            id: 'frames',
            sfObject: 'IPCB',
            label: 'Frames',
            attributes: [
              { id: 'vis-frames-allowance', label: 'Allowance', displayType: 'currency' },
              { id: 'vis-frames-freq',      label: 'Frequency', displayType: 'picklist' }
            ]
          },
          {
            id: 'lenses',
            sfObject: 'IPCB',
            label: 'Lenses',
            attributes: [
              { id: 'vis-lenses-copay',  label: 'Copay',     displayType: 'currency' },
              { id: 'vis-lenses-freq',   label: 'Frequency', displayType: 'picklist' }
            ]
          },
          {
            id: 'contacts',
            sfObject: 'IPCB',
            label: 'Contacts',
            attributes: [
              { id: 'vis-contacts-allowance', label: 'Allowance', displayType: 'currency' },
              { id: 'vis-contacts-freq',      label: 'Frequency', displayType: 'picklist' }
            ]
          }
        ]
      },
      {
        id: 'quote_comparison',
        kind: 'quoteComparison',
        iconKind: 'table',
        title: 'Quote Comparison',
        desc: 'Link a comparison template to surface a side-by-side broker matrix.',
        isCompleted: false
      },
      {
        id: 'review',
        kind: 'review',
        iconKind: 'slider',
        title: 'Review and Send',
        desc: 'Validate configuration guardrails, link Slack, and activate pipeline.',
        isMandatory: true,
        isCompleted: false
      }
    ]
  }
};

// Comparison templates available to link from the optional Quote
// Comparison stage. Keyed by `${LOB}::${COVERAGE}` so the combobox only
// Comparison templates are sourced from data/comparisonTemplates so
// saves made in c-quote-compare-setup surface here without a manual
// catalog sync. The shared module's getTemplatesByLobAndCoverage
// handles coverage aliasing (HEALTH → MEDICAL + DENTAL).

// Root Product catalog - the canonical top-level PCM Product records
// each Bundle derives from. Keyed by `${LOB}::${COVERAGE}` so only the
// roots relevant to the active flow are offered. Renders as a select
// in the canvas head; the picked label overrides the canned bundle
// name in the Stage 1 hierarchy tree.
const ROOT_PRODUCT_OPTIONS_BY_COVERAGE = {
  'PERSONAL_LINES::AUTO': [
    { value: 'AUTO_ROOT',         label: 'Auto Root' },
    { value: 'AUTO_BUNDLE_ROOT',  label: 'Auto Bundle Root' },
    { value: 'MULTI_CAR_ROOT',    label: 'Multi-Car Root' }
  ],
  'PERSONAL_LINES::HOME': [
    { value: 'HOME_ROOT',     label: 'Home Root' },
    { value: 'DWELLING_ROOT', label: 'Dwelling Root' },
    { value: 'RENTERS_ROOT',  label: 'Renters Root' }
  ],
  'COMMERCIAL_LINES::PROPERTY': [
    { value: 'PROPERTY_ROOT',            label: 'Property Root' },
    { value: 'COMMERCIAL_PROPERTY_ROOT', label: 'Commercial Property Root' }
  ],
  'GROUP_BENEFITS::HEALTH': [
    { value: 'FAMILY_PLAN_ROOT',   label: 'Family Plan Root' },
    { value: 'PPO_ROOT',           label: 'PPO Root' }
  ],
  // Alias - the host workspace seeds coverage as 'HEALTH' for the
  // wired Group Medical flow, but the new wizard LOB/LOC pickers
  // use 'MEDICAL' (the more precise label since GB also has
  // Dental / Vision LOCs). Both keys point at the same option
  // list so the Root Product picker filters correctly regardless
  // of which path supplied the LOC value.
  'GROUP_BENEFITS::MEDICAL': [
    { value: 'MEDICAL_PPO_ROOT',   label: 'Medical PPO Root' },
    { value: 'PPO_ROOT',           label: 'PPO Root' },
    { value: 'FAMILY_PLAN_ROOT',   label: 'Family Plan Root' }
  ],
  'GROUP_BENEFITS::DENTAL': [
    { value: 'DENTAL_DPPO_ROOT',   label: 'Dental DPPO Root' },
    { value: 'GROUP_DENTAL_ROOT',  label: 'Group Dental Root' }
  ],
  'GROUP_BENEFITS::VISION': [
    { value: 'VISION_PLAN_ROOT',   label: 'Vision Plan Root' },
    { value: 'GROUP_VISION_ROOT',  label: 'Group Vision Root' }
  ]
};

// Active root product id per EB Root Product. Each EB Root Product
// resolves to exactly one of the three Group Benefits roots (medical,
// dental, or vision). Drives both the Plan Coverages / Plan Benefits
// tabsets and the Stage 1 hierarchy mind-map so the design-time and
// runtime structures agree.
const EB_HEALTH_ROOTS_BY_ROOT_PRODUCT = {
  MEDICAL_PPO_ROOT:   ['medical'],
  FAMILY_PLAN_ROOT:   ['medical'],
  PPO_ROOT:           ['medical'],
  DENTAL_DPPO_ROOT:   ['dental'],
  GROUP_DENTAL_ROOT:  ['dental'],
  VISION_PLAN_ROOT:   ['vision'],
  GROUP_VISION_ROOT:  ['vision']
};

const SLACK_CHANNEL_OPTIONS = [
  { value: 'account',     label: 'Account' },
  { value: 'opportunity', label: 'Opportunity' },
  { value: 'new-rfq',     label: 'New for RFQ' }
];

const _defaultReviewConfig = () => ({
  agentforce: false,
  slack: false,
  slackChannel: 'account'
});

export default class RfqPlaybookSetup extends LightningElement {
  // ── Public API ─────────────────────────────────────────────
  _lob = null;
  _coverage = null;

  @api
  get lob() {
    return this._lob;
  }
  set lob(v) {
    const next = v || null;
    if (this._lob === next) return;
    this._lob = next;
    this._resetForFlowChange();
  }

  @api
  get coverage() {
    return this._coverage;
  }
  set coverage(v) {
    const next = v || null;
    if (this._coverage === next) return;
    this._coverage = next;
    this._resetForFlowChange();
  }

  // Embedded mode - when true, the playbook hides its built-in
  // "Steps to Configure" tile list (left column .rps-canvas) and
  // expects the host to drive stage selection via the `stageId`
  // @api setter below. Used by c-insurance-setup-workspace so the
  // workspace side panel can render the stages as 3rd-level
  // sub-substeps (1.1.x) instead of duplicating them inside the
  // playbook.
  @api embedded = false;

  // True when the host workspace already shows the active step's
  // title in its own crumb (insuranceSetupWorkspace's
  // `.isw-canvas__crumb`) - so the playbook should suppress its
  // own per-stage title h4 to avoid the "double header" effect.
  // Description (`rps-config__sub`) still renders.
  get showStageTitle() {
    return !this.embedded;
  }

  // Host can explicitly hide the Root Product picker (e.g., the
  // workspace hides it on substeps past the first one so each stage
  // config gets the full canvas width). When unset, the picker
  // visibility falls back to isRootProductPickerVisible's default
  // behaviour (always visible).
  @api hidePicker = false;

  // Host-controlled active stage. When the workspace clicks a
  // sub-substep, it pushes the stage id here and we mirror it into
  // the internal `activeComponentId` so the right config panel
  // renders the right stage's content. Guarded against echoing the
  // same value (no-op) and against falsy values (default to null).
  _stageIdFromHost = null;
  @api
  get stageId() {
    return this._stageIdFromHost;
  }
  set stageId(v) {
    const next = v || null;
    if (this._stageIdFromHost === next) return;
    this._stageIdFromHost = next;
    // Both set + clear flow through here so the host can flip back to
    // the playbook's default view (Product Hierarchy if a Root Product
    // is picked, else the "Pick a Root Product" empty state) by
    // passing an empty / null stageId.
    this.activeComponentId = next;
  }

  // Renders the "Steps to Configure" tile list only in standalone
  // mode. Embedded hosts render their own stage nav.
  get isStagesListVisible() {
    return !this.embedded;
  }
  // Picker is visible by default - admins can see/change the Root
  // Product without losing context. The host can opt out via the
  // `hide-picker` @api (workspace hides it on substeps past the
  // first one so each stage's config takes the full canvas width).
  get isRootProductPickerVisible() {
    if (this.hidePicker) return false;
    return true;
  }
  // The left column always renders when the picker is visible. In
  // embedded mode the column drops the stages list (handled by
  // isStagesListVisible) but still shows the picker.
  get isGridLeftVisible() {
    return this.isRootProductPickerVisible || this.isStagesListVisible;
  }
  // CSS modifier - switches .rps-grid from side-by-side flex to a
  // vertical stack in embedded mode so the picker sits ON TOP of
  // the hierarchy / stage config below it (instead of beside it).
  get gridClass() {
    return this.embedded ? 'rps-grid rps-grid_stacked' : 'rps-grid';
  }
  // Hint copy under the Root Product picker. Standalone mode points at
  // the stages tile list directly below; embedded mode references the
  // host's side-panel sub-substep nav instead so the copy stays
  // accurate regardless of where stages are rendered.
  get rootProductHint() {
    // Embedded inside the workspace - the host already provides
    // its own guidance (active step crumb, locked pipeline cards)
    // so the inline hint is redundant. Return empty to suppress
    // the span entirely (the HTML gates on hasRootProductHint).
    return this.embedded
      ? ''
      : 'Pick a Root Product to unlock the stages below.';
  }
  get hasRootProductHint() {
    return !!this.rootProductHint;
  }

  // Root Product picker state. Lives in the canvas head so the admin
  // scopes the canonical PCM root in the context of the canvas; the
  // picked label overrides the FLOW_BLUEPRINTS hierarchy root label
  // (e.g., 'Auto Bundle Root' instead of the canned 'AutoSilver').
  @track rootProduct = null;

  // Wizard-style LOB + LOC scoping pickers - sit above the Root
  // Product picker on the Initialize stage. Independent of the
  // flow-driving lob/coverage @api props (which the workspace
  // controls today); they're cosmetic scoping fields that read as
  // the broker's explicit "Line of Business → Line of Coverage"
  // funnel into the Root Product picker. Future work: filter
  // Root Product options to match the picked LOB+LOC.
  @track wizardLob = null;
  @track wizardLoc = null;

  // ── Seeded LOB / LOC from the workspace's pre-builder modal ──
  // When the admin clicks "+ New Template" the workspace captures
  // LOB + LOC in a modal up front, then threads them in via these
  // props so the Initialize panel can skip showing the LOB+LOC
  // pickers (those picks are already made) and jump straight to
  // the filtered Root Product picker. The setters write into the
  // existing wizardLob / wizardLoc fields so every downstream
  // getter that already reads from those (flow blueprint,
  // rootProductOptions, isRootProductLocked, etc.) keeps working.
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
      // Defer the emit so we don't dispatch events inside a
      // property-setter / render cycle (LWC re-render race).
      this._scheduleSeededEmit();
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
      this._scheduleSeededEmit();
    }
  }
  _scheduleSeededEmit() {
    if (this._seededEmitQueued) return;
    this._seededEmitQueued = true;
    Promise.resolve().then(() => {
      this._seededEmitQueued = false;
      // Reseed the canvas `stageIds` from whatever flow the seeded
      // wizard picks now resolve to. Without this the canvas stays
      // on the stageIds it had when the @api lob/coverage props were
      // last set (often empty for non-Group-Medical roots), so even
      // though _flow is correct, currentStages is empty and the
      // host-pushed stage-id has nothing to render against.
      //
      // We deliberately don't call the full _resetForFlowChange
      // because that wipes `activeComponentId` - which the host's
      // stage-id @api setter may have just populated in the same
      // microtask, and clobbering it would leave the right panel
      // blank.
      if (typeof this._seedStageIds === 'function') this._seedStageIds();
      if (typeof this._emit === 'function') this._emit();
    });
  }
  // True when both LOB and LOC arrived from the workspace modal -
  // the Initialize panel uses this to hide its in-panel LOB+LOC
  // pickers in favor of a compact summary line.
  get hideWizardPickers() {
    return !!(this._seededLob && this._seededLoc);
  }
  // Inverse - convenient for `lwc:if` in the template.
  get showWizardPickers() {
    return !this.hideWizardPickers;
  }
  // Friendly labels for the summary chip when picks are seeded.
  get seededLobLabel() {
    const opt = (this.wizardLobOptions || []).find(
      (o) => o.value === this.wizardLob
    );
    return opt ? opt.label : '';
  }
  get seededLocLabel() {
    const opt = (this.wizardLocOptions || []).find(
      (o) => o.value === this.wizardLoc
    );
    return opt ? opt.label : '';
  }

  // EB Root Product scope is now derived from the picked Root Product
  // via ebActiveRootIds - see EB_HEALTH_ROOTS_BY_ROOT_PRODUCT. Group
  // Medical Root bundles M+D+V; other roots stay medical-only.

  // ── Internal state ─────────────────────────────────────────
  // Per-attribute config bucket. Keyed by `${stageId}::${sectionId}::${attrId}`
  // so attribute ids can safely collide across SF-object sections.
  // Only `isActive` is exercised by the new tab UI; `isRequired` /
  // `displayType` / `defaultValue` remain in the shape for forward
  // compatibility but are no longer surfaced as inputs (Required by
  // Product is dictated by PCM and read-only).
  @track attrsByStage = {};
  @track activeComponentId = null;
  @track reviewConfig = _defaultReviewConfig();
  // Optional Quote Comparison stage - admin picks an independent
  // comparison template to wire into the RFQ flow. Null = unlinked.
  @track linkedComparisonTemplate = null;

  // Tabset state - remembers which SF-object tab the admin had open
  // on each stage so navigating away + back lands on the same tab.
  // Shape: { [stageId]: sectionId }.
  @track activeTabBySection = {};
  // Per-stage / per-section / per-slot accordion open-or-closed state
  // for sections whose blueprint declares renderMode:'instances'.
  // Shape: { [stageId]: { [sectionId]: { [slotIdx: number]: boolean } } }.
  // Missing entries are treated as `open` so admins land on a
  // fully-expanded view the first time they hit an instance section.
  @track openSlotsByStage = {};

  // Custom fields the admin attached to a tab via the inline picklist
  // or the custom-field modal. Shape:
  //   { [stageId]: { [sectionId]: [{ id, label, displayType,
  //                                   isCustom: true }] } }
  @track customFieldsByStage = {};
  // Custom OBJECT sections the admin pulled in via the
  // "+ Add Custom Object" modal. Each section becomes a new tab in
  // the active stage's tabset. Shape:
  //   { [stageId]: [{ id, label, apiName, isCustom: true,
  //                    attributes: [] }] }
  @track customSectionsByStage = {};

  // Modal open flags.
  @track isAddObjectModalOpen = false;     // Object Manager modal
  // "+ Add ⌄" menu in the tab strip - currently surfaces the
  // "Add Custom Object" action; built as a menu so we can add more
  // tab-scope actions later without restructuring.
  @track isAddMenuOpen = false;

  // Tab overflow state - drives the "More" popover that replaces the
  // old "+ Add" trigger at the trailing edge of the tab strip. The
  // strip is fixed width; tabs that don't fit roll into this menu.
  @track _visibleTabCount = 999;
  @track _moreTabsOpen = false;
  _lastTabsSig = '';
  _tabsResizeObserver = null;

  // Canvas widget composition. `stageIds` is the ordered list of
  // stage IDs currently rendered as widget tiles. The preset stays
  // immutable in FLOW_BLUEPRINTS - `stageIds` is the admin's
  // remove/add layer on top. Seeded from the preset on flow change.
  @track stageIds = [];
  // Floating "+ Add Widget" picker open flag.
  @track isAddWidgetOpen = false;
  // Per-tile kebab menu (Edit / Move up / Move down / Delete). Holds
  // the id of the stage whose menu is currently open, or null. Only
  // one menu is open at a time so opening another one auto-closes
  // the previous.
  @track openStageMenuId = null;

  // ── Viewport (zoom + pan) for the Stage 1 hierarchy ────────
  // Figma-style: wheel zooms (cursor-anchored), drag pans. Reset
  // returns to 100% centered. Bounds keep zoom in a usable range.
  @track zoom = 1;
  @track panX = 0;
  @track panY = 0;
  @track isPanning = false;
  ZOOM_MIN = 0.4;
  ZOOM_MAX = 2;
  ZOOM_STEP = 0.1;
  _panStartX = 0;
  _panStartY = 0;
  _panOriginX = 0;
  _panOriginY = 0;
  _canvasEl = null;
  _wheelBound = null;
  _moveBound = null;
  _upBound = null;

  // ── Lifecycle ──────────────────────────────────────────────
  _resetForFlowChange() {
    this.attrsByStage = {};
    this.activeComponentId = null;
    this.reviewConfig = _defaultReviewConfig();
    this.linkedComparisonTemplate = null;
    this.activeTabBySection = {};
    this.openSlotsByStage = {};
    this.customFieldsByStage = {};
    this.customSectionsByStage = {};
    this.isAddObjectModalOpen = false;
    this.isAddMenuOpen = false;
    this.openStageMenuId = null;
    // Reseed the widget composition from the new preset and close
    // any open "+ Add Widget" picker so the canvas reads as freshly
    // initialised for the new flow.
    this._seedStageIds();
    this.isAddWidgetOpen = false;
    // Root Product is scoped per LOB+Coverage, so clearing on flow
    // change forces the admin to re-pick from the new catalog.
    this.rootProduct = null;
    this._resetView();
    this._emit();
  }

  // Seed `stageIds` from the resolved flow preset, preserving the
  // canonical order shipped in FLOW_BLUEPRINTS. Called on flow
  // change so each (LOB, Coverage) lands on its full default
  // widget composition. No-op when no flow resolves.
  _seedStageIds() {
    this.stageIds = this._flow ? this._flow.stages.map((s) => s.id) : [];
  }

  // First (kind === 'hierarchy') and last (kind === 'review') stages
  // are the canonical RFQ bookends - they cannot be removed from the
  // canvas and never appear in the "+ Add Widget" picker.
  _isMandatoryStage(stage) {
    // Blueprints can flag any stage `isMandatory: true` to lock it on
    // the canvas (no × button, hidden from the "+ Add Widget" picker).
    // Review and Send is always mandatory by kind so older blueprints
    // without the flag stay correct. EB Health uses the explicit flag
    // to mark Rate Plan Selection + Plan Coverages as mandatory too,
    // while keeping Plan Benefits & Copays optional.
    if (!stage) return false;
    if (stage.isMandatory === true) return true;
    return stage.kind === 'review';
  }

  renderedCallback() {
    const canvas = this.template.querySelector('.rps-tree-canvas');
    if (canvas !== this._canvasEl) {
      this._detachWheel();
      this._canvasEl = canvas;
      if (canvas) {
        this._wheelBound = (e) => this._handleWheel(e);
        // Non-passive so we can preventDefault and stop the page from
        // scrolling while the user zooms inside the viewport.
        canvas.addEventListener('wheel', this._wheelBound, { passive: false });
      }
    }

    // Tab strip overflow: reset the visible cap whenever the tab
    // set changes (different stage, custom object added/removed) and
    // let _adjustTabsOverflow shrink it down to what fits.
    this._setupTabsResizeObserver();
    const tabs = this.currentTabs;
    const sig = tabs.map((t) => t.id).join('|') + ':' + tabs.length;
    if (sig !== this._lastTabsSig) {
      this._lastTabsSig = sig;
      this._visibleTabCount = tabs.length || 999;
      // Close the popover if the new tab set means it's irrelevant.
      this._moreTabsOpen = false;
    }
    this._adjustTabsOverflow();
  }

  disconnectedCallback() {
    this._detachWheel();
    this._detachPanWindowListeners();
    if (this._tabsResizeObserver) {
      this._tabsResizeObserver.disconnect();
      this._tabsResizeObserver = null;
    }
  }

  _setupTabsResizeObserver() {
    if (this._tabsResizeObserver) return;
    if (typeof window === 'undefined' || !window.ResizeObserver) return;
    const strip = this.template.querySelector('.rps-tabs');
    if (!strip) return;
    this._tabsResizeObserver = new ResizeObserver(() => {
      // Reset to total - renderedCallback will shrink again if needed.
      const total = this.currentTabs.length;
      if (total > 0 && this._visibleTabCount !== total) {
        this._visibleTabCount = total;
      }
    });
    this._tabsResizeObserver.observe(strip);
  }

  // Iteratively shrink the visible tab count until the strip fits.
  // Each setState triggers another render+measure cycle; converges
  // in a few frames because shrinking by one only frees a few px.
  _adjustTabsOverflow() {
    const strip = this.template.querySelector('.rps-tabs');
    if (!strip) return;
    const total = this.currentTabs.length;
    if (total === 0) return;
    if (this._visibleTabCount > total) {
      this._visibleTabCount = total;
      return;
    }
    if (
      strip.scrollWidth > strip.clientWidth + 1 &&
      this._visibleTabCount > 1
    ) {
      this._visibleTabCount = this._visibleTabCount - 1;
    }
  }

  _detachWheel() {
    if (this._canvasEl && this._wheelBound) {
      this._canvasEl.removeEventListener('wheel', this._wheelBound);
    }
    this._wheelBound = null;
  }
  _detachPanWindowListeners() {
    if (this._moveBound) window.removeEventListener('mousemove', this._moveBound);
    if (this._upBound) window.removeEventListener('mouseup', this._upBound);
    this._moveBound = null;
    this._upBound = null;
  }

  _resetView() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
  }

  // Cursor-anchored zoom: keep the world point under the cursor
  // stationary while scaling. transform-origin is center so we work
  // in cursor-vs-center coordinates.
  _handleWheel(event) {
    event.preventDefault();
    const oldZoom = this.zoom;
    // Exponential factor for smooth trackpad + wheel feel.
    const factor = Math.exp(-event.deltaY * 0.0015);
    const newZoom = Math.max(this.ZOOM_MIN, Math.min(this.ZOOM_MAX, oldZoom * factor));
    if (newZoom === oldZoom) return;
    const rect = this._canvasEl.getBoundingClientRect();
    const mx = event.clientX - rect.left - rect.width / 2;
    const my = event.clientY - rect.top - rect.height / 2;
    const worldX = (mx - this.panX) / oldZoom;
    const worldY = (my - this.panY) / oldZoom;
    this.zoom = newZoom;
    this.panX = mx - worldX * newZoom;
    this.panY = my - worldY * newZoom;
  }

  handlePanStart(event) {
    if (event.button !== 0) return;
    // Skip pan if the user clicked on the floating toolbar so its
    // buttons remain interactive.
    if (event.target && event.target.closest && event.target.closest('.rps-tree-toolbar')) return;
    this.isPanning = true;
    this._panStartX = event.clientX;
    this._panStartY = event.clientY;
    this._panOriginX = this.panX;
    this._panOriginY = this.panY;
    this._moveBound = (e) => this._handlePanMove(e);
    this._upBound = () => this._handlePanEnd();
    window.addEventListener('mousemove', this._moveBound);
    window.addEventListener('mouseup', this._upBound);
    event.preventDefault();
  }
  _handlePanMove(event) {
    if (!this.isPanning) return;
    this.panX = this._panOriginX + (event.clientX - this._panStartX);
    this.panY = this._panOriginY + (event.clientY - this._panStartY);
  }
  _handlePanEnd() {
    this.isPanning = false;
    this._detachPanWindowListeners();
  }

  handleZoomIn() {
    this.zoom = Math.min(this.ZOOM_MAX, this.zoom + this.ZOOM_STEP);
  }
  handleZoomOut() {
    this.zoom = Math.max(this.ZOOM_MIN, this.zoom - this.ZOOM_STEP);
  }
  handleResetView() {
    this._resetView();
  }

  get treeTransformStyle() {
    return `transform: translate(${this.panX}px, ${this.panY}px) scale(${this.zoom}); transform-origin: center center;`;
  }
  get zoomPercent() {
    return `${Math.round(this.zoom * 100)}%`;
  }
  get canvasClass() {
    return this.isPanning ? 'rps-tree-canvas is-panning' : 'rps-tree-canvas';
  }
  get isZoomInDisabled() {
    return this.zoom >= this.ZOOM_MAX;
  }
  get isZoomOutDisabled() {
    return this.zoom <= this.ZOOM_MIN;
  }

  // ── Resolved flow ──────────────────────────────────────────
  // Drives the Product Hierarchy preview, the stages list, the
  // runtime config projection - every consumer that needs to know
  // "what flow are we configuring?" Reads through _effectiveLob /
  // _effectiveCoverage so the wizard pick wins over the host seed.
  get _flow() {
    const lob = this._effectiveLob;
    const cov = this._effectiveCoverage;
    if (!lob || !cov) return null;
    return FLOW_BLUEPRINTS[`${lob}::${cov}`] || null;
  }
  // ── Runtime config projection ──────────────────────────────
  // Walks the active flow's blueprint and produces a flat
  // { [runtimeFlagKey]: boolean } map keyed by the active state of
  // each attribute. Only stages currently on the canvas (i.e. present
  // in `stageIds`) contribute - if the admin removed the stage, none
  // of its flags should reach the runtime. Attributes the admin
  // hasn't explicitly toggled fall back to the blueprint's `isActive`
  // seed so the runtime sees a deterministic value either way.
  //
  // Consumed downstream via the `runtimeConfig` field on the
  // assignmentschange event payload - the runtime broker roster
  // (c-pa-asset-tree / future c-pa-vehicle-roster) reads this map as
  // its activeTemplateConfig prop without having to walk the nested
  // assignments tree.
  get runtimeConfig() {
    const config = {};
    const stages = (this._flow && this._flow.stages) || [];
    const activeStageIds = new Set(this.stageIds || []);
    stages.forEach((stage) => {
      if (!activeStageIds.has(stage.id)) return;
      if (stage.kind !== 'sections') return;
      (stage.sections || []).forEach((section) => {
        (section.attributes || []).forEach((attr) => {
          if (!attr.runtimeFlagKey) return;
          // attrsByStage is a flat composite-key bucket
          // (`${stage}::${section}::${attr}` -> { isActive, ... }),
          // not a nested-by-stage map - use _bucketKey to look it up.
          const entry =
            this.attrsByStage[this._bucketKey(stage.id, section.id, attr.id)];
          const isActive =
            entry && Object.prototype.hasOwnProperty.call(entry, 'isActive')
              ? !!entry.isActive
              : !!attr.isActive;
          config[attr.runtimeFlagKey] = isActive;
        });
      });
    });
    return config;
  }
  get hasSelection() {
    return !!(this._effectiveLob && this._effectiveCoverage);
  }
  get hasFlow() {
    return !!this._flow;
  }
  get noFlowMessage() {
    if (!this.hasSelection) {
      return 'Pick a Line of Business and a Line of Coverage in Stage 0 to load the canvas.';
    }
    return 'No flow defined for this Line of Business + Coverage combination yet.';
  }
  get flowLabel() {
    return this._flow ? this._flow.label : '';
  }

  // ── Root Product picker (canvas head) ──────────────────────
  // Options derive from the current LOB+Coverage pair. Empty array
  // when either is missing (the parent gates Configure entry on those
  // two, so by the time c-rfq-playbook-setup mounts, options exist).
  // Source of truth for downstream rendering - flow blueprint
  // lookup, Product Hierarchy preview, stages list, runtime
  // config, emit payload, template matching, etc. Prefers the
  // broker's wizard pick so the playbook actually swaps content
  // when LOB/LOC change; falls back to the host workspace's
  // seeded `_lob` / `_coverage` so the pre-seeded Group Medical
  // demo flow still works when nothing's been manually picked.
  //
  // NOTE: the Root Product picker LOCK (isRootProductLocked /
  // rootProductOptions) deliberately uses `wizardLob` /
  // `wizardLoc` STRICTLY (no fallback) so the picker stays
  // disabled until the broker actively picks LOB + LOC.
  get _effectiveLob() {
    return this.wizardLob || this._lob || null;
  }
  get _effectiveCoverage() {
    return this.wizardLoc || this._coverage || null;
  }
  get rootProductOptions() {
    // STRICT wizard-only - the picker is locked when wizardLob /
    // wizardLoc are missing, so options being empty here is OK
    // (broker can't open the picker anyway).
    if (!this.wizardLob || !this.wizardLoc) return [];
    const key = `${this.wizardLob}::${this.wizardLoc}`;
    const list = ROOT_PRODUCT_OPTIONS_BY_COVERAGE[key] || [];
    return list.map((o) => ({
      ...o,
      selected: this.rootProduct === o.value
    }));
  }
  // Cascade gate for the Root Product picker - locked until both
  // the wizard LOB and the wizard LOC are picked. STRICTLY wizard-
  // only (no fallback to the host workspace seed) so the broker
  // can't bypass the cascade by relying on a pre-seeded LOB.
  get isRootProductLocked() {
    return !this.wizardLob || !this.wizardLoc;
  }
  get isRootProductEmpty() {
    return !this.rootProduct;
  }
  // Alias used by the gating UI (tiles + banner hint). Same value as
  // isRootProductEmpty but named for the gating context so the
  // template + CSS read clearly.
  get isRootProductMissing() {
    return !this.rootProduct;
  }
  // Banner card gets an accent border + drop-shadow while the
  // Root Product is unpicked, dropping back to a quiet card after
  // the admin commits a selection.
  get rootProductBannerClass() {
    return this.isRootProductMissing
      ? 'rps-root-product rps-root-product_active'
      : 'rps-root-product';
  }
  // Human-readable label for the picked Root Product - overrides the
  // canned FLOW_BLUEPRINTS bundle label in the Stage 1 hierarchy tree.
  get _rootProductLabel() {
    const lob = this._effectiveLob;
    const cov = this._effectiveCoverage;
    if (!lob || !cov || !this.rootProduct) return '';
    const key = `${lob}::${cov}`;
    const list = ROOT_PRODUCT_OPTIONS_BY_COVERAGE[key] || [];
    const match = list.find((o) => o.value === this.rootProduct);
    return match ? match.label : '';
  }
  handleRootProductChange(event) {
    this.rootProduct = event.detail.value || null;
    // If the admin clears the Root Product, drop the active stage so
    // the right panel falls back to the empty state and gating reads
    // consistently across the canvas + config.
    if (!this.rootProduct) {
      this.activeComponentId = null;
    }
    this._emit();
  }

  // ── Wizard LOB + LOC scoping pickers ────────────────────────
  get wizardLobOptions() {
    return WIZARD_LOB_OPTIONS.map((o) => ({
      ...o,
      selected: this.wizardLob === o.value
    }));
  }
  get wizardLocOptions() {
    if (!this.wizardLob) return [];
    return (WIZARD_LOC_OPTIONS_BY_LOB[this.wizardLob] || []).map((o) => ({
      ...o,
      selected: this.wizardLoc === o.value
    }));
  }
  get isWizardLocDisabled() {
    return !this.wizardLob;
  }
  handleWizardLobChange(event) {
    this.wizardLob = event.detail.value || null;
    // LOB -> LOC -> Root Product cascade. Changing LOB clears
    // every downstream selection so the picker can't carry stale
    // dependents (LOC narrows on LOB; Root Product narrows on the
    // LOB+LOC pair via ROOT_PRODUCT_OPTIONS_BY_COVERAGE).
    this.wizardLoc = null;
    this.rootProduct = null;
    // Wizard picks feed `_effectiveLob` / `_effectiveCoverage`,
    // which `_flow` reads - so the canvas `stageIds` need to
    // re-derive to match the new flow. Without this the stage
    // tile list (and the host-driven stage-id routing in
    // embedded mode) stay on the previous flow's stages.
    this._seedStageIds();
    this._emit();
  }
  handleWizardLocChange(event) {
    this.wizardLoc = event.detail.value || null;
    // Reset Root Product - its options key off `${LOB}::${LOC}` so
    // a new LOC invalidates the previous Root Product selection.
    this.rootProduct = null;
    this._seedStageIds();
    this._emit();
  }

  @api
  get assignments() {
    return {
      // Emit the EFFECTIVE LOB/Coverage so the host workspace
      // sees the broker's wizard pick (not just the seeded value).
      // The workspace uses this to swap pipeline substeps based on
      // LOB.
      lob: this._effectiveLob,
      coverage: this._effectiveCoverage,
      rootProduct: this.rootProduct,
      stageIds: this.stageIds,
      stages: this.stageDescriptors,
      attrs: this.attrsByStage,
      reviewConfig: this.reviewConfig,
      linkedComparisonTemplate: this.linkedComparisonTemplate
    };
  }

  // Title + description for each stage on the canvas, so a host that
  // hides the built-in stage list (embedded mode) can label its own
  // nav without duplicating FLOW_BLUEPRINTS.
  get stageDescriptors() {
    return this.currentStages.map((s) => ({
      id: s.id,
      title: s.title,
      desc: s.desc
    }));
  }

  // ── Canvas (left) view model ───────────────────────────────
  // Resolves the admin-curated widget composition: filters the
  // preset by `stageIds` and orders the result by `stageIds` so
  // remove/add operations land where expected.
  get currentStages() {
    if (!this._flow) return [];
    const byId = new Map(this._flow.stages.map((s) => [s.id, s]));
    return this.stageIds.map((id) => byId.get(id)).filter(Boolean);
  }

  get canvasBlocks() {
    const gated = this.isRootProductMissing;
    const stages = this.currentStages;
    return stages.map((s, idx) => {
      const isActive = this.activeComponentId === s.id;
      const isMandatory = this._isMandatoryStage(s);
      // Removability gates on: (a) not a mandatory bookend, and
      // (b) Root Product is picked so the canvas isn't in its
      // pre-gated state.
      const canRemove = !isMandatory && !gated;
      // Neighbour lookups drive the Move up / Move down enablement.
      // A stage can only swap with a non-mandatory neighbour so the
      // bookends (Initialize / Publish) stay pinned in place. Mandatory
      // stages themselves stay locked - neither direction is allowed.
      const prev = idx > 0 ? stages[idx - 1] : null;
      const next = idx < stages.length - 1 ? stages[idx + 1] : null;
      const canMoveUp =
        !gated && !isMandatory && !!prev && !this._isMandatoryStage(prev);
      const canMoveDown =
        !gated && !isMandatory && !!next && !this._isMandatoryStage(next);
      const isMenuOpen = this.openStageMenuId === s.id;
      const k = s.iconKind || 'default';
      const cls = ['rps-block'];
      if (isActive) cls.push('is-active');
      if (gated) cls.push('is-disabled');
      if (isMenuOpen) cls.push('is-menu-open');
      // Status pills were removed from the canvas card; the blueprint
      // still carries `isCompleted` so downstream consumers (e.g. the
      // wizard's progress summary) can read it from `assignments`,
      // but it no longer drives any per-card chrome.
      return {
        ...s,
        // Sequential step number rendered as a circle marker in the
        // top-left of each tile (mirrors the substep numbering used
        // elsewhere in the workspace). 1-based for human reading.
        number: idx + 1,
        isActive,
        isDisabled: gated,
        isMandatory,
        canRemove,
        canEdit: !gated,
        canMoveUp,
        canMoveDown,
        // Buttons are disabled via the native attribute; `disabled` on
        // the boolean prop is easier to bind than juggling `aria-*`.
        editDisabled: gated,
        moveUpDisabled: !canMoveUp,
        moveDownDisabled: !canMoveDown,
        deleteDisabled: !canRemove,
        isMenuOpen,
        menuAriaLabel: `More actions for ${s.title}`,
        menuBtnClass: isMenuOpen
          ? 'rps-block__more is-open'
          : 'rps-block__more',
        removeAriaLabel: `Remove ${s.title} widget`,
        tabIndex: gated ? '-1' : '0',
        cls: cls.join(' '),
        isGroups: k === 'groups',
        isForm: k === 'form',
        isSlider: k === 'slider',
        isSearch: k === 'search',
        isGuide: k === 'guide',
        isLocation: k === 'location',
        isTable: k === 'table'
      };
    });
  }

  // Scrim gate for the per-tile kebab menu. One flag drives a single
  // overlay across the canvas so an outside click closes whichever
  // menu happens to be open without every tile rendering its own
  // scrim.
  get hasOpenStageMenu() {
    return this.openStageMenuId !== null;
  }

  // Widgets in the catalog (current flow preset) that are NOT yet
  // on the canvas and aren't mandatory bookends. Drives the
  // "+ Add Widget" picker. Each row carries the same iconKind
  // booleans as canvasBlocks so the picker can render the same
  // glyphs as the tiles for visual continuity.
  get availableWidgets() {
    if (!this._flow) return [];
    const onCanvas = new Set(this.stageIds);
    return this._flow.stages
      .filter((s) => !onCanvas.has(s.id) && !this._isMandatoryStage(s))
      .map((s) => {
        const k = s.iconKind || 'default';
        return {
          id: s.id,
          title: s.title,
          desc: s.desc,
          isGroups: k === 'groups',
          isForm: k === 'form',
          isSlider: k === 'slider',
          isSearch: k === 'search',
          isGuide: k === 'guide',
          isLocation: k === 'location',
          isTable: k === 'table'
        };
      });
  }
  get hasAvailableWidgets() {
    return this.availableWidgets.length > 0;
  }
  // The "+ Add Widget" trigger is rendered as long as the admin
  // has (a) a resolved flow and (b) picked a Root Product. When
  // every catalog widget is already on the canvas the trigger
  // stays visible but reads as disabled - admins can see the
  // affordance always exists; the disabled state communicates
  // there's nothing to add right now.
  get isAddWidgetTriggerVisible() {
    return this.hasFlow && !this.isRootProductMissing;
  }
  get isAddWidgetDisabled() {
    return !this.hasAvailableWidgets;
  }
  get addWidgetTriggerClass() {
    const cls = ['rps-add-widget'];
    if (this.isAddWidgetOpen) cls.push('rps-add-widget_open');
    if (this.isAddWidgetDisabled) cls.push('rps-add-widget_disabled');
    return cls.join(' ');
  }
  get addWidgetTriggerTitle() {
    return this.isAddWidgetDisabled
      ? 'All available widgets are already on the canvas'
      : 'Add a widget to this template';
  }

  // ── Config panel (right) view model ────────────────────────
  get hasActiveComponent() {
    return !!this.activeComponentId;
  }

  get activeStage() {
    return this.currentStages.find((s) => s.id === this.activeComponentId) || null;
  }

  // Default right-panel view - the read-only hierarchy mind-map
  // auto-mounts once a Root Product is picked and stays mounted any
  // time no specific stage tile is active. Clicking a stage tile in
  // the canvas swaps in that stage's variant; removing the active
  // tile (or never picking one) restores this default.
  get showHierarchyDefault() {
    return this.hasFlow && !this.isRootProductMissing && !this.hasActiveComponent;
  }
  // Empty state for the right panel - shown while a flow is loaded
  // but no Root Product has been picked yet, so there's nothing to
  // visualise. Replaces the legacy "No stage selected" empty state.
  get showRightPanelEmpty() {
    // Skip the right-panel "Pick a Root Product" empty state in
    // embedded mode - the host already shows its own guidance and
    // the playbook's left-column picker tells the admin what to do
    // next. Surfacing a second prompt on the right is redundant.
    if (this.embedded) return false;
    return this.hasFlow && this.isRootProductMissing;
  }
  get isActiveSections() {
    const s = this.activeStage;
    return !!(s && s.kind === 'sections');
  }

  // ── EB Health flow helpers ─────────────────────────────────
  // True when this canvas is configuring the EB Group Health
  // blueprint. Gates the Medical/Dental/Vision root-product chip
  // strip + the per-stage swap to c-eb-coverage-setup /
  // c-eb-benefit-setup (which replace the generic checklist for
  // those two stages only).
  get isEbHealthFlow() {
    const lob = this._effectiveLob;
    const cov = this._effectiveCoverage;
    // Accept both `HEALTH` (legacy host-seeded coverage code) and
    // `MEDICAL` (the wizard picker code) as the same blueprint.
    return lob === 'GROUP_BENEFITS' && (cov === 'HEALTH' || cov === 'MEDICAL');
  }
  // Active root product id for the picked EB Root Product. Each EB
  // Root Product resolves to exactly one root (medical / dental /
  // vision). Falls back to medical when the picklist is empty or
  // unmapped so the canvas always has something to render.
  get ebActiveRootIds() {
    const ids = EB_HEALTH_ROOTS_BY_ROOT_PRODUCT[this.rootProduct];
    return Array.isArray(ids) && ids.length ? ids.slice() : ['medical'];
  }
  // Read-only snapshot passed down to both EB Setup widgets so they
  // render in lock-step with each other AND with the Stage 1
  // hierarchy mind-map (see _activeHierarchy).
  get ebSelectedRootIds() {
    return this.ebActiveRootIds;
  }
  get isActiveEbPlanCoverages() {
    return this.isEbHealthFlow && this.activeComponentId === 'plan_coverages';
  }
  get isActiveEbPlanBenefits() {
    return this.isEbHealthFlow && this.activeComponentId === 'plan_benefits';
  }
  // The standard checklist/tabset branch in the right panel only
  // renders when neither EB Setup widget is active.
  get showStandardSections() {
    return (
      this.isActiveSections &&
      !this.isActiveEbPlanCoverages &&
      !this.isActiveEbPlanBenefits
    );
  }

  get isActiveReview() {
    const s = this.activeStage;
    return !!(s && s.kind === 'review');
  }
  get isActiveQuoteComparison() {
    const s = this.activeStage;
    return !!(s && s.kind === 'quoteComparison');
  }

  // ── Quote Comparison stage view-model ──────────────────────
  // Combobox options filter to templates scoped to the active flow so
  // the admin can't accidentally wire a Group-Medical comparison into
  // a Personal-Auto RFQ template. Reading getComparisonTemplatesTick
  // wires the getter to the shared module's reactivity tick so
  // wizard saves immediately surface here.
  get comparisonTemplateOptions() {
    // Tick read forces a recompute when the shared catalog mutates.
    /* eslint-disable-next-line no-unused-vars */
    const tick = getComparisonTemplatesTick();
    const lob = this._effectiveLob;
    const cov = this._effectiveCoverage;
    if (!lob || !cov) return [];
    const list = getTemplatesByLobAndCoverage(lob, cov);
    return list.map((t) => ({
      value: t.id,
      label: t.name,
      selected: this.linkedComparisonTemplate === t.id
    }));
  }
  get hasComparisonTemplateOptions() {
    return this.comparisonTemplateOptions.length > 0;
  }
  get isLinkedComparisonEmpty() {
    return !this.linkedComparisonTemplate;
  }
  // Friendly label for the picked template - surfaced as a small
  // confirmation line beneath the combobox.
  get linkedComparisonTemplateLabel() {
    if (!this.linkedComparisonTemplate) return '';
    const match = this.comparisonTemplateOptions.find(
      (o) => o.value === this.linkedComparisonTemplate
    );
    return match ? match.label : '';
  }
  // Orphan-link guard - the admin previously picked a comparison
  // template that is no longer present in the current LOB+Coverage
  // catalogue (e.g., the template was deleted or scope changed).
  // True when a link is stored but doesn't resolve to any option in
  // `comparisonTemplateOptions`. Drives the warning banner that asks
  // the admin to pick a replacement.
  get isLinkedComparisonOrphaned() {
    if (!this.linkedComparisonTemplate) return false;
    return !this.comparisonTemplateOptions.some(
      (o) => o.value === this.linkedComparisonTemplate
    );
  }
  handleLinkedComparisonChange(event) {
    this.linkedComparisonTemplate = event.detail.value || null;
    this._emit();
  }

  // ── Linked template preview ────────────────────────────────
  // Lo-fi schematic of the broker-facing comparison layout so the
  // admin can sanity-check what the linked template renders without
  // leaving the RFQ flow. All getters read from the shared module so
  // wizard edits update this view on next render.
  get linkedTemplateData() {
    /* eslint-disable-next-line no-unused-vars */
    const tick = getComparisonTemplatesTick();
    if (!this.linkedComparisonTemplate) return null;
    return getTemplateById(this.linkedComparisonTemplate);
  }
  get hasLinkedTemplate() {
    return !!this.linkedTemplateData;
  }
  // Highlights row - always 4 fixed slots so the schematic doesn't
  // reflow as the admin toggles widgets in the wizard. Filled slots
  // carry the widget label; empty slots render as dashed placeholders.
  get linkedPreviewHighlights() {
    const tpl = this.linkedTemplateData;
    if (!tpl) return [];
    const widgets = tpl.summaryWidgets || {};
    const filled = SUMMARY_WIDGET_DEFS
      .filter((w) => !!widgets[w.id])
      .slice(0, 4)
      .map((w, i) => ({
        slotIdx: i,
        label: w.label,
        cls: 'rps-compare-preview__hl is-filled'
      }));
    while (filled.length < 4) {
      filled.push({
        slotIdx: filled.length,
        label: '',
        cls: 'rps-compare-preview__hl is-empty'
      });
    }
    return filled;
  }
  // Body fields - ordered metric ids (filtered to the selected set),
  // resolved to labels from the shared metric catalog.
  get linkedPreviewBodyFields() {
    const tpl = this.linkedTemplateData;
    if (!tpl) return [];
    const selected = new Set(tpl.selectedMetricIds || []);
    const order = (tpl.ordering && tpl.ordering.length)
      ? tpl.ordering
      : (tpl.selectedMetricIds || []);
    return order
      .filter((id) => selected.has(id))
      .map((id) => ({
        id,
        label: getMetricLabel(id),
        cls: 'rps-compare-preview__row'
      }));
  }
  get linkedPreviewBodyEmpty() {
    return this.hasLinkedTemplate && this.linkedPreviewBodyFields.length === 0;
  }

  // Stage 1 - recursive product hierarchy decorated for the mind-map
  // tree view. LWC templates can't truly recurse, so we flatten to fixed
  // children arrays (lvl1 / lvl2 / lvl3) at decoration time.
  _decorateTreeNode(node, idPath) {
    const meta = HIERARCHY_KINDS.find((k) => k.kind === node.kind) || {};
    const tone = meta.tone || 'default';
    const kindLabel = meta.label || node.kind;
    return {
      id: idPath,
      kindChipClass: `rps-tree__kind rps-tone_${tone}`,
      kind: node.kind,
      tone,
      label: node.label,
      kindLabel,
      iconClass: `rps-tree__icon rps-tree__icon_${tone}`,
      nodeClass: `rps-tree__node rps-tree__node_${node.kind}`,
      groupClass: `rps-tree__group rps-tree__group_${node.kind}`
    };
  }

  // EB Health gets a dynamic hierarchy built from the active root
  // product (each EB Root Product resolves to exactly one of medical /
  // dental / vision) so the mind-map stays in lock-step with the Plan
  // Coverages / Plan Benefits tabsets. Other blueprints (PA, etc.)
  // still read from their canned _flow.hierarchy.
  get _ebHierarchy() {
    const ROOT_LABEL_BY_ID = {
      medical: 'Member Medical',
      dental: 'Member Dental',
      vision: 'Member Vision'
    };
    const products = this.ebActiveRootIds.map((id) => ({
      kind: 'product',
      label: ROOT_LABEL_BY_ID[id] || id,
      children: [
        { kind: 'coverage', label: 'In-Network Coverage' },
        { kind: 'coverage', label: 'Out-of-Network Coverage' }
      ]
    }));
    return {
      kind: 'bundle',
      label: this._rootProductLabel || 'Group Benefits',
      children: [
        { kind: 'classification', label: 'Member', children: products }
      ]
    };
  }
  get _activeHierarchy() {
    if (this.isEbHealthFlow) return this._ebHierarchy;
    return this._flow ? this._flow.hierarchy : null;
  }

  get hierarchyRoot() {
    const active = this._activeHierarchy;
    if (!active) return null;
    // Override the canned bundle name (e.g., 'AutoSilver') with the
    // Root Product the admin picked back in Stage 0, so the tree's
    // top node mirrors the wizard's product selection. Falls back to
    // the blueprint label if no selection flowed through.
    const overrideLabel = this._rootProductLabel;
    const root = overrideLabel ? { ...active, label: overrideLabel } : active;
    return this._decorateTreeNode(root, 'h-0');
  }

  // Level-1 groups: each entry is the child node + its own (level-2)
  // children, etc. Fixed-depth so the HTML can render with three nested
  // for:each blocks (LWC has no native template recursion).
  get hierarchyLvl1() {
    const root = this._activeHierarchy;
    if (!root) return [];
    return (root.children || []).map((c1, i1) => {
      const node1 = this._decorateTreeNode(c1, `h-1-${i1}`);
      node1.hasChildren = !!(c1.children && c1.children.length);
      node1.children = (c1.children || []).map((c2, i2) => {
        const node2 = this._decorateTreeNode(c2, `h-2-${i1}-${i2}`);
        node2.hasChildren = !!(c2.children && c2.children.length);
        node2.children = (c2.children || []).map((c3, i3) => {
          const node3 = this._decorateTreeNode(c3, `h-3-${i1}-${i2}-${i3}`);
          node3.hasChildren = false;
          node3.children = [];
          return node3;
        });
        return node2;
      });
      return node1;
    });
  }

  get hierarchyHasChildren() {
    return this.hierarchyLvl1.length > 0;
  }

  // Legend chips above the tree - only kinds actually used in the flow.
  // Stages 2 & 3 - header subtitle ("Configure Data Collection Fields" /
  // "Configure Coverage Limits") derived from the stage title.
  get configSubheading() {
    const s = this.activeStage;
    if (!s) return '';
    // Stage-aware copy that maps to the spec examples.
    if (s.id === 'collection' || s.id === 'rate-plan') {
      return 'Configure Data Collection Fields';
    }
    if (s.id === 'coverages') {
      return 'Configure Coverage Limits';
    }
    return `${s.title} - Field Configuration`;
  }

  get configHelperCopy() {
    const s = this.activeStage;
    if (s && s.id === 'coverages') {
      return 'Tick the coverage attributes the broker will configure during this stage. Field rules (Data Type, Min/Max, Required by Product) are PCM-owned - use the eye icon to preview.';
    }
    return 'Tick the standard-object attributes the broker should capture during this stage. Field rules are read-only (PCM-owned) - use the eye icon to preview.';
  }

  // ── Stages 2 & 3 - Tabset model ────────────────────────────
  // The right panel renders the active stage's `sections` as a tabset
  // (one tab per SF object). Custom fields the admin added land INSIDE
  // an existing tab (not as their own tab) so the panel reads as a
  // single PCM scope with optional ad-hoc augmentation.

  // Source-of-truth list of tabs for the active stage. Always pulled
  // from the FLOW_BLUEPRINTS sections - custom fields are NOT tabs.
  // Standard sections from FLOW_BLUEPRINTS + custom sections the
  // admin pulled in via the "+ Add Custom Object" modal. The full
  // merged list backs both `currentTabs` (for the tablist) and
  // `_activeSection` (for the active tab's content).
  get _allSections() {
    const stage = this.activeStage;
    if (!stage || stage.kind !== 'sections') return [];
    const standard = (stage.sections || []).map((s) => ({ ...s, isCustom: false }));
    const custom = (this.customSectionsByStage[stage.id] || []).map((s) => ({
      ...s,
      isCustom: true,
      attributes: s.attributes || []
    }));
    return [...standard, ...custom];
  }

  get currentTabs() {
    const sections = this._allSections;
    if (!sections.length) return [];
    const activeId = this.activeSectionId;
    return sections.map((sec) => {
      const isActive = sec.id === activeId;
      const cls = ['rps-tab'];
      if (isActive) cls.push('is-active');
      if (sec.isCustom) cls.push('is-custom');
      // Active tab gets a "_fit" <li> modifier so it sizes to its
      // label (no shrink). Inactive tabs share the remaining row
      // and truncate with ellipsis - matches the SLDS 2 tab pattern
      // where the focus state owns the row.
      const liCls = isActive
        ? 'rps-tabs__li rps-tabs__li_fit'
        : 'rps-tabs__li rps-tabs__li_shrink';
      return {
        id: sec.id,
        label: sec.label,
        isActive,
        isCustom: !!sec.isCustom,
        cls: cls.join(' '),
        liCls
      };
    });
  }

  // Class hook for the "+ Add ⌄" trigger so we can flip the
  // aria-expanded + visual open state in CSS.
  get addMenuBtnClass() {
    return this.isAddMenuOpen
      ? 'rps-tab-add rps-tab-add_open'
      : 'rps-tab-add';
  }

  // ── Tab overflow ("More" popover) ──────────────────────────
  // The strip is fixed-width; tabs that don't fit collapse into the
  // trailing "More" popover (see _adjustTabsOverflow + the ResizeObserver
  // set up in renderedCallback). Replaces the old "+ Add" trigger so
  // overflow is the only thing that lives in that slot.
  get visibleTabs() {
    return this.currentTabs.slice(0, this._visibleTabCount);
  }
  get overflowTabs() {
    return this.currentTabs.slice(this._visibleTabCount);
  }
  get hasOverflowTabs() {
    return this.overflowTabs.length > 0;
  }
  // Highlight the More button when the active tab is in overflow so
  // the broker can still see their selection state.
  get moreTabsBtnCls() {
    const inOverflow = this.overflowTabs.some((t) => t.isActive);
    const base = inOverflow ? 'rps-tabs__more is-active' : 'rps-tabs__more';
    return this._moreTabsOpen ? `${base} is-open` : base;
  }
  get moreTabsAriaExpanded() {
    return this._moreTabsOpen ? 'true' : 'false';
  }
  get isMoreTabsOpen() {
    return this._moreTabsOpen;
  }
  get moreTabsMenuItems() {
    return this.overflowTabs.map((t) => ({
      id: t.id,
      label: t.label,
      cls: t.isActive ? 'rps-tabs__more-item is-active' : 'rps-tabs__more-item'
    }));
  }

  handleMoreTabsToggle(event) {
    if (event) event.stopPropagation();
    this._moreTabsOpen = !this._moreTabsOpen;
  }
  handleMoreTabsScrim() {
    this._moreTabsOpen = false;
  }
  handleMoreTabSelect(event) {
    // Delegate to the standard tab handler so the active-tab map +
    // preview/menu reset logic stays in one place. The menu-item
    // button carries `data-id` just like a real tab.
    this.handleTabSelect(event);
    this._moreTabsOpen = false;
  }

  // Currently-active tab id for the active stage. Defaults to the
  // first section (standard or custom) when the admin hasn't picked
  // a tab yet.
  get activeSectionId() {
    const sections = this._allSections;
    if (!sections.length) return null;
    const stage = this.activeStage;
    const stored = stage && this.activeTabBySection[stage.id];
    if (stored && sections.some((s) => s.id === stored)) return stored;
    return sections[0].id;
  }

  // Currently-active section object (used to look up attributes +
  // pass section metadata to the row decorator).
  get _activeSection() {
    const id = this.activeSectionId;
    if (!id) return null;
    return this._allSections.find((s) => s.id === id) || null;
  }

  get isActiveTabCustom() {
    const sec = this._activeSection;
    return !!(sec && sec.isCustom);
  }
  // Empty-state guard: true when the active tab is a custom-object
  // tab that has no standard PCM attributes (admin just added the
  // object; needs to add fields via the picklist below).
  get activeTabIsEmpty() {
    const sec = this._activeSection;
    if (!sec) return false;
    const stage = this.activeStage;
    const customCount =
      (((this.customFieldsByStage[stage.id] || {})[sec.id]) || []).length;
    const standardCount = (sec.attributes || []).length;
    return (standardCount + customCount) === 0;
  }

  // Lightweight view-model for the active tab: id + label + the
  // derived isChecked flag. Merges standard FLOW_BLUEPRINTS
  // attributes (first) with admin-added custom fields (appended,
  // marked isCustom). Row rendering itself lives inside
  // c-attribute-picker; this getter feeds Apply-to-All + the picker
  // adapter getters below.
  get activeTabAttrs() {
    const stage = this.activeStage;
    const sec = this._activeSection;
    if (!stage || !sec) return [];
    const decorate = (a, isCustom) => ({
      id: a.id,
      label: a.label,
      stageId: stage.id,
      sectionId: sec.id,
      isCustom,
      isChecked: this._attrState(stage.id, sec.id, a).isActive
    });
    const standardRows = (sec.attributes || []).map((a) => decorate(a, false));
    const customList =
      ((this.customFieldsByStage[stage.id] || {})[sec.id]) || [];
    const customRows = customList.map((a) => decorate(a, true));
    return [...standardRows, ...customRows];
  }

  // ── c-attribute-picker view-model ────────────────────────────
  // Minimal row shape the shared picker expects: id + label + an
  // optional badge for custom fields. The picker owns rendering,
  // select-all, search, and expand/collapse.
  get activeTabPickerAttributes() {
    const stage = this.activeStage;
    const sec = this._activeSection;
    if (!stage || !sec) return [];
    const standardRows = (sec.attributes || []).map((a) => ({
      id: a.id,
      label: a.label
    }));
    const customList =
      ((this.customFieldsByStage[stage.id] || {})[sec.id]) || [];
    const customRows = customList.map((a) => ({
      id: a.id,
      label: a.label,
      badge: 'Custom'
    }));
    return [...standardRows, ...customRows];
  }
  // Selection = ids where the persisted state has isActive true.
  get activeTabPickerSelectedIds() {
    return this.activeTabAttrs.filter((a) => a.isChecked).map((a) => a.id);
  }
  // Gate on the flat-checklist branch - hides the picker entirely
  // when the tab has no attributes so the empty-state copy above
  // stands on its own.
  get activeTabHasAttrs() {
    return this.activeTabPickerAttributes.length > 0;
  }

  // ── Instance-mode (accordion) rendering ─────────────────────
  // True when the active tab's section declares renderMode:'instances'
  // (today: Vehicle Coverages, Driver Coverages). Drives the
  // template-side branch in rfqPlaybookSetup.html that swaps the
  // flat checklist for an Apply-to-All button + N accordions.
  get isActiveSectionInstanceMode() {
    const sec = this._activeSection;
    return !!(sec && sec.renderMode === 'instances');
  }
  // For instance-mode sections only: returns one slot object per
  // instance the section declares (e.g. "Vehicle 1/2/3"). Every slot
  // wraps the same shared checklist from `activeTabAttrs` - toggles
  // are template-level so checking a coverage in one accordion
  // checks it in all of them. The per-slot dimension is purely a
  // visualisation pattern to convey that the runtime broker view
  // will render this checklist once per actual vehicle / driver.
  get activeTabInstanceSlots() {
    const sec = this._activeSection;
    const stage = this.activeStage;
    if (!stage || !sec || sec.renderMode !== 'instances') return [];
    const count = Math.max(1, sec.instanceCount || 1);
    const labelTemplate = sec.instanceLabelTemplate || '{n}';
    // Single-open accordion: only one slot per section is expanded at
    // a time. Schema:
    //   undefined -> implicit default (slot 0 open)
    //   number    -> that slot idx is open
    //   -1        -> all slots collapsed
    const openIdxRaw = (this.openSlotsByStage[stage.id] || {})[sec.id];
    const activeIdx = openIdxRaw == null ? 0 : openIdxRaw;
    const attrs = this.activeTabAttrs;
    const slots = [];
    for (let i = 0; i < count; i += 1) {
      const isOpen = activeIdx === i;
      slots.push({
        slotIdx: i,
        slotKey: `${stage.id}::${sec.id}::${i}`,
        label: labelTemplate.replace('{n}', String(i + 1)),
        isOpen,
        // The Apply-to-All affordance lives at the bottom of the
        // first slot only - the admin configures instance #1, then
        // propagates that config to every other instance.
        isFirstSlot: i === 0,
        // SLDS-style chevron rotates 90° when expanded - keyed on a
        // class so the template can stay logic-free.
        cls: isOpen ? 'rps-accordion is-open' : 'rps-accordion',
        chevronCls: isOpen
          ? 'rps-accordion__chev is-open'
          : 'rps-accordion__chev',
        // dataset values pre-stringified so the template can hand
        // them straight to the click handler.
        stageData: stage.id,
        sectionData: sec.id,
        slotData: String(i),
        attrs
      });
    }
    return slots;
  }
  // Toggle one accordion. Single-open per section (app-wide rule):
  // tapping the currently-open slot collapses everything; tapping
  // any other slot promotes it (auto-closing the prior).
  // openSlotsByStage[stageId][sectionId] holds a number (open idx)
  // or -1 for "all collapsed".
  handleToggleAccordion(event) {
    const stageId = event.currentTarget.dataset.stage;
    const sectionId = event.currentTarget.dataset.section;
    const slotIdx = parseInt(event.currentTarget.dataset.slot, 10);
    if (!stageId || !sectionId || Number.isNaN(slotIdx)) return;
    const byStage = this.openSlotsByStage[stageId] || {};
    const prevOpen = byStage[sectionId];
    // First tap tracks index 0 as the implicit default open.
    const currentOpen = prevOpen == null ? 0 : prevOpen;
    const nextOpen = currentOpen === slotIdx ? -1 : slotIdx;
    this.openSlotsByStage = {
      ...this.openSlotsByStage,
      [stageId]: {
        ...byStage,
        [sectionId]: nextOpen
      }
    };
  }
  // Gate for "Apply to All": only actionable once the admin has
  // ticked at least one coverage for the asset/participant. Disabled
  // (and a no-op) by default so an empty section can't be propagated.
  get applyToAllDisabled() {
    return !this.activeTabAttrs.some((a) => a.isChecked);
  }
  // "Apply to All" - once the admin has selected at least one
  // coverage, this rolls the whole section's coverage set ON for
  // every instance in one shot (a fast "all vehicles carry these"
  // action). Batches the bucket-key writes into a single
  // attrsByStage update so listeners only see one `assignmentschange`
  // event. Guarded so it never fires from an empty section.
  handleApplyToAll() {
    if (this.applyToAllDisabled) return;
    const sec = this._activeSection;
    const stage = this.activeStage;
    if (!stage || !sec) return;
    const all = [
      ...(sec.attributes || []),
      ...(((this.customFieldsByStage[stage.id] || {})[sec.id]) || [])
    ];
    if (all.length === 0) return;
    const nextBucket = { ...this.attrsByStage };
    all.forEach((a) => {
      const def = this._findAttrDef(stage.id, sec.id, a.id);
      if (!def) return;
      const current = this._attrState(stage.id, sec.id, def);
      nextBucket[this._bucketKey(stage.id, sec.id, a.id)] = {
        ...current,
        isActive: true
      };
    });
    this.attrsByStage = nextBucket;
    this._emit();
  }

  // SF Object Manager rows shown in the "+ Add Custom Object" modal.
  // Filters out objects already pulled into the active stage so the
  // same object can't become two tabs in the same stage.
  get availableSfObjects() {
    const stage = this.activeStage;
    if (!stage) return [];
    const addedApiNames = new Set(
      (this.customSectionsByStage[stage.id] || []).map((s) => s.apiName)
    );
    return SF_OBJECTS_CATALOG.filter((o) => !addedApiNames.has(o.apiName)).map((o) => ({
      ...o,
      initial: o.label.charAt(0).toUpperCase(),
      badgeLabel: o.isStandard ? 'Standard' : 'Custom',
      badgeClass: o.isStandard
        ? 'rps-obj-row__badge rps-obj-row__badge_standard'
        : 'rps-obj-row__badge rps-obj-row__badge_custom'
    }));
  }

  // Stage 4 - integration toggles.
  get isAgentforceOn() {
    return !!(this.reviewConfig && this.reviewConfig.agentforce);
  }
  get isSlackOn() {
    return !!(this.reviewConfig && this.reviewConfig.slack);
  }
  get slackChannelOptions() {
    return SLACK_CHANNEL_OPTIONS.map((o) => ({
      ...o,
      selected: this.reviewConfig.slackChannel === o.value
    }));
  }

  // ── Handlers ───────────────────────────────────────────────
  handleBlockClick(event) {
    if (!this.hasFlow) return;
    // Stage tiles are gated until the admin picks a Root Product.
    // Short-circuit clicks/keys so the right panel can't enter a
    // half-configured state.
    if (this.isRootProductMissing) return;
    const id = event.currentTarget.dataset.id;
    const stages = this.currentStages;
    if (id && stages.some((s) => s.id === id)) {
      this.activeComponentId = id;
      // Reset viewport whenever the active stage changes so the user
      // sees the new content fitted from a known 100% / centered state.
      this._resetView();
      // Close the tab Add menu when navigating away so each stage
      // entry starts from a clean state.
      this.isAddMenuOpen = false;
    }
  }

  // ── Per-tile kebab menu (Edit / Move up / Move down / Delete) ──
  // Opening a menu closes whichever one was open before so only one
  // is ever visible at a time. stopPropagation keeps the underlying
  // tile from also activating.
  handleToggleStageMenu(event) {
    if (event) event.stopPropagation();
    if (this.isRootProductMissing) return;
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this.openStageMenuId = this.openStageMenuId === id ? null : id;
  }
  handleCloseStageMenu() {
    this.openStageMenuId = null;
  }
  // The menu anchor wraps the kebab button + dropdown inside the
  // clickable stage tile. Any click that lands on the anchor's empty
  // space (padding around the menu, gap between items) must NOT bubble
  // up to the parent <li>, otherwise the tile would activate while the
  // user was aiming at the menu.
  handleStageMenuAnchorClick(event) {
    event.stopPropagation();
  }

  // Edit = activate the tile's config in the right panel. Same
  // behaviour as clicking the tile body, so we just forward to
  // `handleBlockClick` (its currentTarget also carries data-id).
  handleEditStage(event) {
    event.stopPropagation();
    this.openStageMenuId = null;
    this.handleBlockClick(event);
  }

  // Move up / down swap the tile with its immediate neighbour in
  // stageIds. Guarded so mandatory bookends stay pinned and gated
  // (no Root Product) canvases can't reorder either.
  handleMoveStageUp(event) {
    this._moveStage(event, -1);
  }
  handleMoveStageDown(event) {
    this._moveStage(event, +1);
  }
  _moveStage(event, delta) {
    event.stopPropagation();
    this.openStageMenuId = null;
    if (!this.hasFlow) return;
    if (this.isRootProductMissing) return;
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    const idx = this.stageIds.indexOf(id);
    if (idx < 0) return;
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= this.stageIds.length) return;
    const flowStages = this._flow.stages || [];
    const self = flowStages.find((s) => s.id === id);
    const neighbour = flowStages.find((s) => s.id === this.stageIds[targetIdx]);
    // Refuse to move a mandatory stage or to swap into a mandatory
    // slot - keeps Initialize / Publish pinned at the bookends.
    if (this._isMandatoryStage(self)) return;
    if (this._isMandatoryStage(neighbour)) return;
    const next = [...this.stageIds];
    [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
    this.stageIds = next;
    this._emit();
  }

  // Remove a non-mandatory widget tile from the canvas. Refuses
  // mandatory bookends, GCs any per-stage state (attributes, tab
  // selection, custom fields/sections), and falls back to the
  // first mandatory (hierarchy) stage if the removed widget was
  // active. stopPropagation so the click doesn't also activate
  // the parent tile.
  handleRemoveStage(event) {
    event.stopPropagation();
    this.openStageMenuId = null;
    if (!this.hasFlow) return;
    if (this.isRootProductMissing) return;
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    const stage = (this._flow.stages || []).find((s) => s.id === id);
    if (!stage || this._isMandatoryStage(stage)) return;
    // Drop from the canvas composition.
    this.stageIds = this.stageIds.filter((sid) => sid !== id);
    // GC per-stage state so a future re-add lands on a clean slate.
    if (this.attrsByStage[id]) {
      const next = { ...this.attrsByStage };
      delete next[id];
      this.attrsByStage = next;
    }
    if (this.activeTabBySection[id]) {
      const next = { ...this.activeTabBySection };
      delete next[id];
      this.activeTabBySection = next;
    }
    if (this.customFieldsByStage[id]) {
      const next = { ...this.customFieldsByStage };
      delete next[id];
      this.customFieldsByStage = next;
    }
    if (this.customSectionsByStage[id]) {
      const next = { ...this.customSectionsByStage };
      delete next[id];
      this.customSectionsByStage = next;
    }
    // If the removed widget was active, fall back to the default
    // right-panel view (the hierarchy mind-map) by clearing the active
    // stage. The panel never goes blank - `showHierarchyDefault` takes
    // over the moment `activeComponentId` is null.
    if (this.activeComponentId === id) {
      this.activeComponentId = null;
      this._resetView();
    }
    this._emit();
  }

  // ── "+ Add Widget" picker ────────────────────────────────
  // Toggle the floating picker. stopPropagation so the scrim
  // doesn't immediately re-close it.
  handleToggleAddWidget(event) {
    if (event) event.stopPropagation();
    if (this.isRootProductMissing) return;
    // Disabled state - no widgets left in the catalog to add.
    // Bail without toggling so the picker doesn't open empty.
    if (this.isAddWidgetDisabled) return;
    this.isAddWidgetOpen = !this.isAddWidgetOpen;
  }
  handleCloseAddWidget() {
    this.isAddWidgetOpen = false;
  }
  // Add a catalog widget to the canvas. Inserts immediately before
  // the trailing mandatory (review) stage so "Review and Send"
  // stays pinned at the end. Falls back to append if no trailing
  // mandatory is present (defensive - every shipped flow has one).
  handleAddWidget(event) {
    if (!this.hasFlow) return;
    if (this.isRootProductMissing) return;
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    const stage = (this._flow.stages || []).find((s) => s.id === id);
    if (!stage || this._isMandatoryStage(stage)) return;
    if (this.stageIds.includes(id)) return; // single-instance guard
    const next = [...this.stageIds];
    // Find the trailing mandatory bookend (review) and insert just
    // before it; if not present, append.
    let insertAt = next.length;
    for (let i = next.length - 1; i >= 0; i -= 1) {
      const sid = next[i];
      const s = this._flow.stages.find((x) => x.id === sid);
      if (s && s.kind === 'review') {
        insertAt = i;
        break;
      }
    }
    next.splice(insertAt, 0, id);
    this.stageIds = next;
    this.isAddWidgetOpen = false;
    this._emit();
  }

  handleBlockKey(event) {
    if (!this.hasFlow) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.handleBlockClick(event);
  }

  // ── Tabset (Stages 2 & 3) ──────────────────────────────────
  handleTabSelect(event) {
    const stage = this.activeStage;
    if (!stage) return;
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    const valid = (stage.sections || []).some((s) => s.id === id);
    if (!valid) return;
    this.activeTabBySection = {
      ...this.activeTabBySection,
      [stage.id]: id
    };
    // Switching tabs closes the tab Add menu so each tab loads in a
    // clean state.
    this.isAddMenuOpen = false;
  }

  // ── c-attribute-picker event handlers ─────────────────────
  // Every write resolves stage + section from the current tab so
  // the picker itself stays context-free. Bulk writes on select-all
  // collapse into a single attrsByStage update so downstream
  // consumers only see one assignmentschange event.
  handleAttrPickerToggle(event) {
    const { id, isChecked } = event.detail || {};
    if (!id) return;
    const stage = this.activeStage;
    const sec = this._activeSection;
    if (!stage || !sec) return;
    this._patchAttr(stage.id, sec.id, id, { isActive: !!isChecked });
  }
  handleAttrPickerSelectAll(event) {
    const { isChecked, ids } = event.detail || {};
    if (!Array.isArray(ids) || ids.length === 0) return;
    const stage = this.activeStage;
    const sec = this._activeSection;
    if (!stage || !sec) return;
    this._bulkPatchAttrs(stage.id, sec.id, ids, { isActive: !!isChecked });
  }

  // ── Add Custom Object modal ───────────────────────────────
  handleOpenAddObjectModal() {
    // Close the tab Add menu when the modal opens so we don't stack
    // floating UI on top of each other.
    this.isAddMenuOpen = false;
    this.isAddObjectModalOpen = true;
  }
  handleCloseAddObjectModal() {
    this.isAddObjectModalOpen = false;
  }

  // ── Tab strip "+ Add ⌄" menu ────────────────────────────────
  // Houses tab-scope add actions (currently "Add Custom Object").
  // Built as a menu so future tab-level actions can land here
  // without restructuring the tab strip.
  handleToggleAddMenu(event) {
    if (event) event.stopPropagation();
    this.isAddMenuOpen = !this.isAddMenuOpen;
  }
  handleCloseAddMenu() {
    this.isAddMenuOpen = false;
  }
  handleAddCustomObject(event) {
    const apiName = event.currentTarget.dataset.api;
    if (!apiName) return;
    const def = SF_OBJECTS_CATALOG.find((o) => o.apiName === apiName);
    if (!def) return;
    const stage = this.activeStage;
    if (!stage) return;
    const newSection = {
      id: `custom-sec-${apiName}-${Date.now()}`,
      label: def.label,
      apiName: def.apiName,
      isCustom: true,
      attributes: []
    };
    const list = this.customSectionsByStage[stage.id] || [];
    this.customSectionsByStage = {
      ...this.customSectionsByStage,
      [stage.id]: [...list, newSection]
    };
    // Make the new tab active so the admin lands on it after picking.
    this.activeTabBySection = {
      ...this.activeTabBySection,
      [stage.id]: newSection.id
    };
    this.isAddObjectModalOpen = false;
    this._emit();
  }
  // Remove a custom-object tab + GC any field state attached to it.
  handleRemoveCustomSection(event) {
    event.stopPropagation();
    const stageId = event.currentTarget.dataset.stage;
    const sectionId = event.currentTarget.dataset.section;
    if (!stageId || !sectionId) return;
    const list = (this.customSectionsByStage[stageId] || []).filter((s) => s.id !== sectionId);
    this.customSectionsByStage = {
      ...this.customSectionsByStage,
      [stageId]: list
    };
    // Drop any custom fields + attr state scoped to the removed tab.
    const byStage = { ...(this.customFieldsByStage[stageId] || {}) };
    delete byStage[sectionId];
    this.customFieldsByStage = {
      ...this.customFieldsByStage,
      [stageId]: byStage
    };
    const prefix = `${stageId}::${sectionId}::`;
    const cleanedAttrs = {};
    Object.keys(this.attrsByStage).forEach((k) => {
      if (!k.startsWith(prefix)) cleanedAttrs[k] = this.attrsByStage[k];
    });
    this.attrsByStage = cleanedAttrs;
    // If we were on this tab, fall back to the first remaining tab.
    if (this.activeTabBySection[stageId] === sectionId) {
      const next = { ...this.activeTabBySection };
      delete next[stageId];
      this.activeTabBySection = next;
    }
    this._emit();
  }
  handleAgentforceToggle(event) {
    this.reviewConfig = {
      ...this.reviewConfig,
      agentforce: !!event.target.checked
    };
    this._emit();
  }

  handleSlackToggle(event) {
    this.reviewConfig = {
      ...this.reviewConfig,
      slack: !!event.target.checked
    };
    this._emit();
  }

  handleSlackChannelChange(event) {
    const value = event.detail.value;
    const valid = SLACK_CHANNEL_OPTIONS.some((o) => o.value === value);
    this.reviewConfig = {
      ...this.reviewConfig,
      slackChannel: valid ? value : 'account'
    };
    this._emit();
  }

  // Stage 4 deep links - fired when the admin wants to jump out of the
  // template builder into the integration's own configuration surface
  // (Agentforce Builder / Slack admin). In a real org these would
  // navigate to the respective Setup pages; here we just bubble a
  // CustomEvent so a parent host can route it.
  handleGoToAgentforceBuilder() {
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: { target: 'agentforce-builder' },
        bubbles: true,
        composed: true
      })
    );
  }
  handleGoToSlackConfig() {
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: { target: 'slack-config' },
        bubbles: true,
        composed: true
      })
    );
  }

  // ── Internals ─────────────────────────────────────────────
  // The bucket key bakes in stageId AND sectionId so the same attribute
  // id can live in multiple SF-object sections without collision.
  _bucketKey(stageId, sectionId, attrId) {
    return `${stageId}::${sectionId}::${attrId}`;
  }

  _attrState(stageId, sectionId, attrDef) {
    if (!attrDef) {
      return {
        isActive: false,
        isRequired: false,
        displayType: DEFAULT_DISPLAY_TYPE,
        defaultValue: ''
      };
    }
    const bucket = this.attrsByStage || {};
    const raw = bucket[this._bucketKey(stageId, sectionId, attrDef.id)];
    if (raw && typeof raw === 'object') {
      return {
        isActive: !!raw.isActive,
        isRequired: !!raw.isRequired,
        displayType: raw.displayType || attrDef.displayType || DEFAULT_DISPLAY_TYPE,
        defaultValue: raw.defaultValue || ''
      };
    }
    // Day-zero for a real attribute def with no persisted state:
    // active by default. Matches the "Select All by default; Show
    // all not opened by default" rule for every c-attribute-picker
    // consumer - admins see an all-checked collapsed summary and
    // untick what they don't want.
    return {
      isActive: true,
      isRequired: false,
      displayType: attrDef.displayType || DEFAULT_DISPLAY_TYPE,
      defaultValue: ''
    };
  }

  _findAttrDef(stageId, sectionId, attrId) {
    // Custom fields live INSIDE a standard section's tab in the new
    // model (customFieldsByStage[stageId][sectionId]) - check there
    // first; fall back to the standard FLOW_BLUEPRINTS attributes.
    const customForSec =
      ((this.customFieldsByStage[stageId] || {})[sectionId]) || [];
    const custom = customForSec.find((f) => f.id === attrId);
    if (custom) return custom;
    const stage = this.currentStages.find((s) => s.id === stageId);
    if (!stage || !stage.sections) return null;
    const sec = stage.sections.find((x) => x.id === sectionId);
    if (!sec) return null;
    return sec.attributes.find((a) => a.id === attrId) || null;
  }

  _patchAttr(stageId, sectionId, attrId, patch) {
    const def = this._findAttrDef(stageId, sectionId, attrId);
    if (!def) return;
    const current = this._attrState(stageId, sectionId, def);
    const next = { ...current, ...patch };
    const key = this._bucketKey(stageId, sectionId, attrId);
    this.attrsByStage = {
      ...this.attrsByStage,
      [key]: next
    };
    this._emit();
  }

  // Apply the same patch to a batch of attribute ids in one shot.
  // Skips ids that don't resolve to a def (defensive against stale
  // custom fields). Fires a single assignmentschange event.
  _bulkPatchAttrs(stageId, sectionId, attrIds, patch) {
    if (!Array.isArray(attrIds) || attrIds.length === 0) return;
    const bucket = { ...this.attrsByStage };
    let dirty = false;
    for (const attrId of attrIds) {
      const def = this._findAttrDef(stageId, sectionId, attrId);
      if (!def) continue;
      const current = this._attrState(stageId, sectionId, def);
      const key = this._bucketKey(stageId, sectionId, attrId);
      bucket[key] = { ...current, ...patch };
      dirty = true;
    }
    if (!dirty) return;
    this.attrsByStage = bucket;
    this._emit();
  }

  _emit() {
    this.dispatchEvent(
      new CustomEvent('assignmentschange', {
        detail: {
          assignments: {
            lob: this._effectiveLob,
            coverage: this._effectiveCoverage,
            rootProduct: this.rootProduct,
            // Ordered widget composition the admin shipped - the
            // parent template (c-agentforce-setup) can persist this
            // alongside the per-stage attribute config so the
            // canvas re-renders the same way on Edit.
            stageIds: this.stageIds,
            stages: this.stageDescriptors,
            attrs: this.attrsByStage,
            // Flat, runtime-ready projection of `attrs` keyed by
            // `runtimeFlagKey` (e.g. { showVIN, showMileage,
            // showLicense, showIncidents }). The broker roster reads
            // this directly as its activeTemplateConfig prop so it
            // never has to walk the nested attrs tree.
            runtimeConfig: this.runtimeConfig,
            reviewConfig: this.reviewConfig,
            customFields: this.customFieldsByStage,
            customSections: this.customSectionsByStage,
            linkedComparisonTemplate: this.linkedComparisonTemplate
          }
        }
      })
    );
  }
}
