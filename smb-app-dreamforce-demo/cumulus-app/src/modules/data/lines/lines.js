// Line of Business / Line of Coverage vocabulary.
//
// RFQ row records historically carried a single `lob` field that in
// practice held the LINE OF COVERAGE ("Homeowners", "Renters", "Group
// Medical") on ordinary rows and the LINE OF BUSINESS ("Personal
// Lines") on bundle parents. Surfaces that show both columns derive the
// business from the coverage through `classifyLob` below rather than
// each fixture carrying a redundant second field.
//
// Membership is matched case- and whitespace-insensitively, so
// "personal auto" and "Personal Auto" both resolve.

export const LOB_CATEGORIES = {
  'Personal Lines': [
    'Personal Auto',
    'Auto',
    'Homeowners',
    'Home',
    'Renters',
    'Condo',
    'Umbrella',
    'Personal Umbrella'
  ],
  'Employee Benefits': [
    'Group Medical',
    'Medical',
    'Group Dental',
    'Dental',
    'Group Vision',
    'Vision',
    'Group Life',
    'Life',
    'Group Disability',
    'Disability',
    'STD',
    'LTD'
  ],
  'Commercial Lines': [
    'Business Auto',
    'Commercial Auto',
    'Commercial Property',
    'Property',
    'General Liability',
    'GL',
    'BOP',
    'Workers Comp',
    "Workers' Comp",
    'Workers Compensation',
    'Cyber',
    'Professional Liability',
    'E&O',
    'D&O'
  ]
};

const norm = (s) => String(s || '').trim().toLowerCase();

// The category label a single line of coverage belongs to, or '' when
// the coverage is unrecognised. A value that is already a category
// label (e.g. a bundle parent's "Personal Lines") resolves to itself,
// so callers can pass either without branching.
export function classifyLob(loc) {
  const l = norm(loc);
  if (!l) return '';
  for (const cat of Object.keys(LOB_CATEGORIES)) {
    if (norm(cat) === l) return cat;
  }
  for (const [cat, members] of Object.entries(LOB_CATEGORIES)) {
    if (members.some((m) => norm(m) === l)) return cat;
  }
  return '';
}

// Roll a set of coverages up to one label. A set that lands in a single
// category surfaces that category; a set spanning two or more is
// "Multi-line". An unrecognised member forces the raw join so nothing
// is silently mislabelled.
export function classifyLobSet(locs) {
  const list = Array.isArray(locs)
    ? locs.filter(Boolean).map((s) => String(s).trim())
    : [];
  if (list.length === 0) return '';
  const cats = new Set();
  let anyUnknown = false;
  for (const loc of list) {
    const c = classifyLob(loc);
    if (c) cats.add(c);
    else anyUnknown = true;
  }
  if (cats.size === 1 && !anyUnknown) return [...cats][0];
  if (cats.size >= 2) return 'Multi-line';
  return list.join(' + ');
}

// Canonical display order for lines of coverage, read off the category
// lists above so one vocabulary drives grouping and ordering together.
// Aliases share their canonical sibling's position, so "Auto" and
// "Personal Auto" both sort ahead of "Homeowners".
const LOC_ORDER = (() => {
  const index = new Map();
  let position = 0;
  for (const members of Object.values(LOB_CATEGORIES)) {
    for (const member of members) {
      const key = norm(member);
      if (!index.has(key)) index.set(key, position);
      position += 1;
    }
  }
  return index;
})();

// Comparator for coverage labels, for surfaces that list several lines
// of one bundle. An unrecognised coverage sorts after everything known
// and then alphabetically, so an unmapped line shows up at the end
// rather than silently leading the list.
export function compareLoc(a, b) {
  const rank = (loc) => {
    const hit = LOC_ORDER.get(norm(loc));
    return hit === undefined ? Number.MAX_SAFE_INTEGER : hit;
  };
  const diff = rank(a) - rank(b);
  if (diff !== 0) return diff;
  return String(a || '').localeCompare(String(b || ''));
}
