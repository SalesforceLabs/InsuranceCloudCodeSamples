/**
 * data/templateScope - shared LOB / LOC labels, option builders, and
 * filter+sort for the RFQ and Comparison template dashboards.
 *
 * Catalogs store codes (`PERSONAL_LINES`, `AUTO`, `HEALTH`). RFQ rows
 * use `coverage`; Comparison rows use `loc`. Labels match the
 * template-init modal / Comparison wizard so dashboard filters read
 * the same as the create flow.
 */

export const ALL_VALUE = '__all__';
export const DEFAULT_SORT = 'name';

export const SORT_OPTIONS = Object.freeze([
  { value: 'name', label: 'Name A-Z' },
  { value: 'lob', label: 'Line of Business' },
  { value: 'loc', label: 'Line of Coverage' },
  { value: 'newest', label: 'Newest' }
]);

const LOB_LABELS = {
  PERSONAL_LINES: 'Personal Lines',
  GROUP_BENEFITS: 'Group Benefits',
  COMMERCIAL_LINES: 'Commercial Lines',
  LIFE_HEALTH: 'Life & Health'
};

const LOC_LABELS = {
  AUTO: 'Auto',
  HOME: 'Home/Dwelling',
  UMBRELLA: 'Personal Umbrella',
  RENTAL: 'Rental',
  RENTERS: 'Renters',
  MOTORCYCLE: 'Motorcycle',
  WATERCRAFT: 'Watercraft / Boat',
  COMMERCIAL_AUTO: 'Commercial Auto',
  GL: 'General Liability',
  PROPERTY: 'Commercial Property',
  WC: "Workers' Compensation",
  BOP: 'Business Owners Policy (BOP)',
  CYBER: 'Cyber Liability',
  HEALTH: 'Group Medical',
  MEDICAL: 'Medical',
  DENTAL: 'Dental',
  VISION: 'Vision',
  LIFE: 'Group Life',
  STD: 'Short-Term Disability',
  LTD: 'Long-Term Disability',
  TERM_LIFE: 'Term Life',
  WHOLE_LIFE: 'Whole Life',
  IND_HEALTH: 'Individual Health',
  CRITICAL_ILLNESS: 'Critical Illness'
};

export function isAll(value) {
  return !value || value === ALL_VALUE;
}

export function locCode(template) {
  if (!template) return '';
  return String(template.loc || template.coverage || '').trim();
}

function _prettify(code) {
  return String(code)
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function labelForLob(code) {
  if (!code) return '';
  return LOB_LABELS[code] || _prettify(code);
}

export function labelForLoc(code) {
  if (!code) return '';
  return LOC_LABELS[code] || _prettify(code);
}

function _uniqueSorted(codes, labelFn) {
  const seen = new Map();
  for (const code of codes) {
    if (!code || seen.has(code)) continue;
    seen.set(code, labelFn(code));
  }
  return [...seen.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
}

function _allOption() {
  return { value: ALL_VALUE, label: 'All' };
}

export function buildLobOptions(templates) {
  const list = Array.isArray(templates) ? templates : [];
  return [_allOption(), ..._uniqueSorted(list.map((t) => t.lob), labelForLob)];
}

export function buildLocOptions(templates, lob) {
  const list = Array.isArray(templates) ? templates : [];
  const scoped = isAll(lob) ? list : list.filter((t) => t.lob === lob);
  return [_allOption(), ..._uniqueSorted(scoped.map(locCode), labelForLoc)];
}

export function locIsValid(templates, lob, loc) {
  if (isAll(loc)) return true;
  return buildLocOptions(templates, lob).some((o) => o.value === loc);
}

function _compareTemplates(a, b, sortBy) {
  const nameCmp = (a.name || '').localeCompare(b.name || '', undefined, {
    sensitivity: 'base'
  });
  const lobCmp = labelForLob(a.lob).localeCompare(labelForLob(b.lob), undefined, {
    sensitivity: 'base'
  });
  const locCmp = labelForLoc(locCode(a)).localeCompare(
    labelForLoc(locCode(b)),
    undefined,
    { sensitivity: 'base' }
  );
  if (sortBy === 'lob') return lobCmp || locCmp || nameCmp;
  if (sortBy === 'loc') return locCmp || lobCmp || nameCmp;
  if (sortBy === 'newest') {
    const da = a.liveSince || '';
    const db = b.liveSince || '';
    return db.localeCompare(da) || nameCmp;
  }
  return nameCmp;
}

export function filterAndSort(templates, query = {}) {
  const list = Array.isArray(templates) ? templates : [];
  const lob = query.lob;
  const loc = query.loc;
  const sortBy = query.sortBy || DEFAULT_SORT;
  const filtered = list.filter((t) => {
    if (!isAll(lob) && t.lob !== lob) return false;
    if (!isAll(loc) && locCode(t) !== loc) return false;
    return true;
  });
  return filtered.slice().sort((a, b) => _compareTemplates(a, b, sortBy));
}
