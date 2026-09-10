import { todayIso } from 'data/dates';
/**
 * data/rfqTemplates - shared catalog for RFQ Templates.
 *
 * Single source of truth read by c-rfq-template-list (the Templates
 * section dashboard in the workspace) and written by the workspace's
 * Publish step (c-rfq-publish-template). Mirrors the shape of
 * data/comparisonTemplates so the two surfaces feel consistent.
 *
 * Module-state caveat: keeps templates as mutable module-level state
 * so writes from the Publish form are observable by the dashboard on
 * re-render. Production code would back this with a real persistence
 * layer.
 */

const _seedTemplate = (overrides) => ({
  // identity / scoping
  id: '',
  name: '',
  lob: '',
  coverage: '',
  rootProduct: '',
  badge: '',
  // versioning / publish
  version: 'v0.1',
  liveSince: todayIso(),
  effectiveEndDate: '',
  isActive: true,
  // linked comparison template id from data/comparisonTemplates (null
  // when the template doesn't surface a side-by-side comparison stage)
  linkedComparisonTemplate: null,
  ...overrides
});

let _templates = [
  _seedTemplate({
    id: 'rfq-gm-2026',
    name: 'Group Medical RFQ - 2026',
    lob: 'GROUP_BENEFITS',
    coverage: 'HEALTH',
    rootProduct: 'medical',
    badge: 'GROUP BENEFITS',
    version: 'v1.0',
    liveSince: '2026-04-12',
    effectiveEndDate: '2026-12-31',
    isActive: true,
    linkedComparisonTemplate: 'tpl-gm-cmp'
  }),
  // Personal Auto and Homeowners ship with active RFQ templates so the
  // intake modal's "no template" warning banner does NOT surface for the
  // default (Personal Lines + Personal Auto) selection. Newer coverages
  // such as "Rental" (also in Personal Lines) intentionally have no
  // seeded template, which lets the intake modal demonstrate the
  // template-missing error state.
  _seedTemplate({
    id: 'rfq-pa-2026',
    name: 'Personal Auto RFQ - 2026',
    lob: 'PERSONAL_LINES',
    coverage: 'AUTO',
    rootProduct: 'auto',
    badge: 'PERSONAL LINES',
    version: 'v1.0',
    liveSince: '2026-04-12',
    effectiveEndDate: '2026-12-31',
    isActive: true,
    linkedComparisonTemplate: 'tpl-pa-cmp'
  }),
  _seedTemplate({
    id: 'rfq-ho-2026',
    name: 'Homeowners RFQ - 2026',
    lob: 'PERSONAL_LINES',
    coverage: 'HOME',
    rootProduct: 'home',
    badge: 'PERSONAL LINES',
    version: 'v1.0',
    liveSince: '2026-04-12',
    effectiveEndDate: '2026-12-31',
    isActive: true,
    linkedComparisonTemplate: null
  }),
  _seedTemplate({
    id: 'rfq-cp-2026',
    name: 'Commercial Property RFQ - 2026',
    lob: 'COMMERCIAL_LINES',
    coverage: 'PROPERTY',
    rootProduct: 'property',
    badge: 'COMMERCIAL LINES',
    version: 'v1.0',
    liveSince: '2026-05-20',
    effectiveEndDate: '2026-12-31',
    isActive: true,
    linkedComparisonTemplate: null
  }),
  _seedTemplate({
    id: 'rfq-tl-2026',
    name: 'Term Life RFQ - 2026',
    lob: 'LIFE_HEALTH',
    coverage: 'TERM_LIFE',
    rootProduct: 'term_life',
    badge: 'LIFE & HEALTH',
    version: 'v0.9',
    liveSince: '2026-03-01',
    effectiveEndDate: '2026-12-31',
    isActive: true,
    linkedComparisonTemplate: null
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

// LOB / Coverage code resolution. The intake modal and setup
// workspace use friendly display labels (e.g. "Employee Benefits",
// "Group Medical + Dental + Vision") while the template catalog
// stores canonical codes ("GROUP_BENEFITS", "HEALTH"). These maps
// keep the two surfaces in sync and let the modal resolve which
// saved templates match the broker's picked LOB+LOC pair.
const LOB_CODE_BY_LABEL = {
  'Personal Lines':    'PERSONAL_LINES',
  'Commercial Lines':  'COMMERCIAL_LINES',
  'Employee Benefits': 'GROUP_BENEFITS',
  'Life & Health':     'LIFE_HEALTH'
};
const COVERAGE_CODE_BY_LABEL = {
  // Personal Lines
  'Personal Auto':              'AUTO',
  'Homeowners':                 'HOME',
  'Personal Umbrella':          'UMBRELLA',
  'Rental':                     'RENTAL',
  'Renters':                    'RENTERS',
  'Motorcycle':                 'MOTORCYCLE',
  'Watercraft / Boat':          'WATERCRAFT',
  // Commercial Lines
  'Commercial Auto':            'COMMERCIAL_AUTO',
  'General Liability':          'GL',
  'Commercial Property':        'PROPERTY',
  "Workers' Compensation":      'WC',
  'Business Owners Policy (BOP)': 'BOP',
  'Cyber Liability':            'CYBER',
  // Employee Benefits - all collapse onto HEALTH today since the
  // GROUP_BENEFITS playbook covers Medical / Dental / Vision under
  // a single coverage code. Tighten if/when the catalog splits.
  'Group Medical + Dental + Vision': 'HEALTH',
  'Group Medical':                   'HEALTH',
  'Group Dental':                    'HEALTH',
  'Group Vision':                    'HEALTH',
  'Group Life':                      'LIFE',
  'Short-Term Disability':           'STD',
  'Long-Term Disability':            'LTD',
  // Life & Health
  'Term Life':         'TERM_LIFE',
  'Whole Life':        'WHOLE_LIFE',
  'Individual Health': 'IND_HEALTH',
  'Critical Illness':  'CRITICAL_ILLNESS'
};

export function resolveLobCode(label) {
  if (!label) return null;
  return LOB_CODE_BY_LABEL[label] || null;
}
export function resolveCoverageCode(label) {
  if (!label) return null;
  return COVERAGE_CODE_BY_LABEL[label] || null;
}

// Filters the catalog to templates whose scope matches the picked
// LOB+coverage pair AND are currently active. Accepts either
// display labels (resolved through the maps above) or raw codes
// - whichever the caller has handy. Returns shallow clones so the
// caller can't mutate module state.
export function getTemplatesByLobAndCoverage(lobOrLabel, coverageOrLabel) {
  if (!lobOrLabel || !coverageOrLabel) return [];
  const lob = LOB_CODE_BY_LABEL[lobOrLabel] || lobOrLabel;
  const coverage =
    COVERAGE_CODE_BY_LABEL[coverageOrLabel] || coverageOrLabel;
  return _templates
    .filter(
      (t) => t.lob === lob && t.coverage === coverage && t.isActive
    )
    .map((t) => _clone(t));
}

// ── Mutations ─────────────────────────────────────────────────────
export function addTemplate(partial) {
  const next = _seedTemplate({
    id: partial.id || `rfq-${Date.now()}`,
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
  return { ...t };
}
