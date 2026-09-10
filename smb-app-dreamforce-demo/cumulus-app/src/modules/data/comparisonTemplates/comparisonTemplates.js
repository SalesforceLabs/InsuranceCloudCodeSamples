import { todayIso } from 'data/dates';
/**
 * data/comparisonTemplates - shared catalog for Comparison Templates.
 *
 * Single source of truth read by both the design-time wizard
 * (c-quote-compare-setup) and the RFQ playbook's Quote Comparison
 * stage (c-rfq-playbook-setup). Saving a template in the wizard
 * persists the full configuration (summary widgets + selected metric
 * ids + ordering) so the playbook can render a lo-fi preview of what
 * the broker will actually see at quote presentation time.
 *
 * Module-state caveat: keeps templates as mutable module-level state
 * so writes from the wizard are observable by the playbook on
 * re-render. Production code would back this with a real persistence
 * layer.
 */

// ── Stage 1 catalog - fixed summary widgets (pinned KPI cards) ────
export const SUMMARY_WIDGET_DEFS = Object.freeze([
  { id: 'carrier',    label: 'Carrier Identity',        desc: 'Carrier name + logo'                            },
  { id: 'premium',    label: 'Standard Premium',        desc: 'Annualised premium across all coverages'        },
  { id: 'effective',  label: 'Effective Date',          desc: 'Policy start (and end if bound) dates'          },
  { id: 'commission', label: 'Broker Commission / Fee', desc: 'Producer commission % and flat-fee components'  }
]);

// ── Stage 2 catalog - body fields keyed by data architecture tab ──
// IPC = Insurance Policy Coverages, IPCB = Insurance Policy Coverage
// Benefits (IPCA equivalents). Mirrors the playbook's expected field
// names so the preview labels read consistently with what the broker
// captured at intake.
export const METRICS_BY_TAB = Object.freeze({
  ipc: [
    { id: 'bodily-injury',             label: 'Bodily Injury Limit',     dataType: 'currency',
      detail: 'Per-person / per-accident limits',
      help:   'Maximum payout for injuries the insured is liable for.' },
    { id: 'property-damage',           label: 'Property Damage Limit',   dataType: 'currency',
      detail: 'Per-accident limit',
      help:   'Maximum payout for damage to other parties\u2019 property.' },
    { id: 'collision-deductible-min',  label: 'Minimum Deductible',      dataType: 'currency',
      detail: 'Lower price boundary',
      help:   'Floor of the deductible range exposed to the broker.' },
    { id: 'collision-deductible-max',  label: 'Maximum Deductible',      dataType: 'currency',
      detail: 'Upper price boundary',
      help:   'Ceiling of the deductible range exposed to the broker.' },
    { id: 'comp-deductible',           label: 'Comprehensive Deductible', dataType: 'currency',
      detail: 'Per-claim deductible',
      help:   'Deductible applied to non-collision claims (theft, glass).' },
    { id: 'um-coverage',               label: 'Uninsured Motorist',      dataType: 'currency',
      detail: 'Per-person / per-accident limits',
      help:   'Coverage when the at-fault party is uninsured.' },
    { id: 'pip-coverage',              label: 'Personal Injury Protection', dataType: 'currency',
      detail: 'Statutory PIP minimum',
      help:   'Medical-payment coverage required in PIP states.' }
  ],
  ipcb: [
    { id: 'office-visit-copay',    label: 'Office Visit Copay',     dataType: 'currency',
      detail: 'Primary care fixed copay',
      help:   'Flat fee paid per primary-care visit.' },
    { id: 'specialist-copay',      label: 'Specialist Copay',       dataType: 'currency',
      detail: 'In-network specialist fixed copay',
      help:   'Flat fee paid per specialist visit.' },
    { id: 'rx-tier',               label: 'Prescription Tier',      dataType: 'picklist',
      detail: '4 active values',
      help:   'Tiered drug formulary the plan exposes.' },
    { id: 'er-copay',              label: 'Emergency Room Copay',   dataType: 'currency',
      detail: 'Per-visit ER copay',
      help:   'Flat fee paid per emergency-room visit.' },
    { id: 'inpatient-coinsurance', label: 'Inpatient Coinsurance',  dataType: 'picklist',
      detail: '5 active values',
      help:   'Percent share after the deductible for inpatient stays.' }
  ]
});

// Flat label lookup for body-field labels (used by the playbook
// preview to resolve ordering ids → broker-facing names).
const METRIC_LABEL_BY_ID = (() => {
  const out = {};
  for (const tab of Object.keys(METRICS_BY_TAB)) {
    for (const m of METRICS_BY_TAB[tab]) {
      out[m.id] = m.label;
    }
  }
  return out;
})();

export function getMetricLabel(id) {
  return METRIC_LABEL_BY_ID[id] || id;
}
export function getSummaryWidgetLabel(id) {
  const def = SUMMARY_WIDGET_DEFS.find((w) => w.id === id);
  return def ? def.label : id;
}

// ── Templates ─────────────────────────────────────────────────────
// Each template carries its full wizard config so the playbook can
// reconstruct the broker-facing layout without coupling to the
// wizard component's internal state.
const _seedTemplate = (overrides) => ({
  // identity / scoping
  id: '',
  name: '',
  lob: '',
  loc: '',
  badge: '',
  // versioning / publish
  version: 'v0.1',
  liveSince: todayIso(),
  isActive: true,
  // wizard config
  // Every widget defaults on. A caller that omits `summaryWidgets`
  // has no persisted preference for these keys, so we opt the admin
  // in on their behalf and let them untick what they do not want.
  // See .cursor/rules/attribute-picker-defaults.mdc. A partial
  // default would open the picker at 3 of 4 and the wizard's
  // hydrate fallback could not catch it, because the record would
  // still carry a truthy `summaryWidgets` object.
  summaryWidgets: {
    carrier: true,
    premium: true,
    effective: true,
    commission: true
  },
  selectedMetricIds: [],
  ordering: [],
  columnLimit: 2,
  agentforceOn: false,
  agentforceModule: null,
  ...overrides
});

// Day-zero catalog ships two published templates so Comparison Setup
// opens on a populated dashboard, and so the `linkedComparisonTemplate`
// pointers on the Personal Auto and Group Medical records in
// data/rfqTemplates resolve. Their summaryWidgets / selectedMetricIds
// are saved wizard output, not new-template defaults, so a partial
// selection here is expected; Add New still starts all-checked.
// Deleting both through the dashboard empties the catalog and restores
// the "no templates configured" empty state.
let _templates = [
  _seedTemplate({
    id: 'tpl-pa-cmp',
    name: 'Personal Auto Comparison Template',
    lob: 'PERSONAL_LINES',
    loc: 'AUTO',
    badge: 'PERSONAL LINES',
    version: 'v1.4',
    liveSince: '2026-09-02',
    summaryWidgets: {
      carrier: true,
      premium: true,
      effective: true,
      commission: false
    },
    selectedMetricIds: [
      'bodily-injury',
      'property-damage',
      'collision-deductible-min',
      'um-coverage'
    ],
    ordering: [
      'bodily-injury',
      'property-damage',
      'collision-deductible-min',
      'um-coverage'
    ]
  }),
  _seedTemplate({
    id: 'tpl-gm-cmp',
    name: 'Group Medical Comparison Template',
    lob: 'GROUP_BENEFITS',
    loc: 'MEDICAL',
    badge: 'GROUP BENEFITS',
    version: 'v2.0',
    liveSince: '2026-07-18',
    summaryWidgets: {
      carrier: true,
      premium: true,
      effective: true,
      commission: true
    },
    selectedMetricIds: [
      'office-visit-copay',
      'specialist-copay',
      'rx-tier'
    ],
    ordering: [
      'office-visit-copay',
      'specialist-copay',
      'rx-tier'
    ]
  })
];

// Reactivity tick - child components that depend on the catalog can
// read `getTick()` in a getter to force a recompute after a mutation.
let _tick = 0;
export function getTick() {
  return _tick;
}
function _bump() {
  _tick += 1;
}

// ── Accessors ─────────────────────────────────────────────────────
export function getTemplates() {
  return _templates.map((t) => _clone(t));
}

export function getTemplateById(id) {
  if (!id) return null;
  const t = _templates.find((x) => x.id === id);
  return t ? _clone(t) : null;
}

// The playbook scopes its picker to the active LOB+Coverage flow.
// Coverage codes diverge slightly between the wizard (MEDICAL,
// DENTAL) and the playbook (HEALTH = MEDICAL ∪ DENTAL), so the
// resolver expands HEALTH into both child loc codes.
const COVERAGE_ALIASES = {
  'GROUP_BENEFITS::HEALTH': ['MEDICAL', 'DENTAL']
};

export function getTemplatesByLobAndCoverage(lob, coverage) {
  if (!lob || !coverage) return [];
  const key = `${lob}::${coverage}`;
  const allowedLocs = COVERAGE_ALIASES[key] || [coverage];
  return _templates
    .filter((t) => t.lob === lob && allowedLocs.includes(t.loc))
    .map((t) => _clone(t));
}

// ── Mutations ─────────────────────────────────────────────────────
export function addTemplate(partial) {
  const next = _seedTemplate({
    id: partial.id || `tpl-${Date.now()}`,
    ...partial
  });
  _templates = [..._templates, next];
  _bump();
  return _clone(next);
}

export function updateTemplate(id, patch) {
  if (!id) return null;
  let updated = null;
  _templates = _templates.map((t) => {
    if (t.id !== id) return t;
    updated = { ...t, ...patch, id: t.id };
    return updated;
  });
  if (updated) _bump();
  return updated ? _clone(updated) : null;
}

export function removeTemplate(id) {
  if (!id) return false;
  const before = _templates.length;
  _templates = _templates.filter((t) => t.id !== id);
  const changed = _templates.length !== before;
  if (changed) _bump();
  return changed;
}

// Cloning so callers can't accidentally mutate module state by
// editing the returned object in place.
function _clone(t) {
  return {
    ...t,
    summaryWidgets: { ...(t.summaryWidgets || {}) },
    selectedMetricIds: (t.selectedMetricIds || []).slice(),
    ordering: (t.ordering || []).slice()
  };
}
