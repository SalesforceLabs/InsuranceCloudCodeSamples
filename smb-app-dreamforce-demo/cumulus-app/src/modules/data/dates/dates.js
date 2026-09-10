/**
 * US calendar dates for every surface in the app.
 *
 * Display form is MM/DD/YYYY (zero-padded), the Salesforce US-locale
 * default. ISO calendar strings (YYYY-MM-DD) are treated as local dates
 * so they do not shift a day behind in US timezones when parsed as UTC.
 */

/* ── Demo base date ───────────────────────────────────────────────────
 * Every date-dependent calculation resolves "today" through `today()`
 * rather than reading the system clock, so the demo tells the same
 * story whichever day it is shown on. Meeting carousels, calendar
 * highlights, "live since" stamps and effective-date defaults all key
 * off this one constant.
 *
 * Deliberately NOT applied to `Date.now()` used for unique ids, cache
 * hashes, or elapsed-time maths - pinning those would collide ids and
 * freeze timers. See .cursor/rules/base-date.mdc.
 */
export const BASE_DATE_ISO = '2026-09-15';

/**
 * The base date as a fresh Date at local midnight. A new instance is
 * returned on every call because Date is mutable and several callers
 * advance it with setDate().
 */
export function today() {
  const [y, mo, d] = BASE_DATE_ISO.split('-').map(Number);
  return new Date(y, mo - 1, d);
}

/**
 * The base date as YYYY-MM-DD, for callers that only want the key.
 */
export function todayIso() {
  return BASE_DATE_ISO;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function fromIsoDay(value) {
  const m = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
}

function partsToSlash({ y, mo, d }) {
  if (!y || !mo || !d) return '';
  return `${pad2(mo)}/${pad2(d)}/${y}`;
}

function partsToIso({ y, mo, d }) {
  if (!y || !mo || !d) return '';
  return `${y}-${pad2(mo)}-${pad2(d)}`;
}

function isValidYmd(y, mo, d) {
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, mo - 1, d);
  return (
    dt.getFullYear() === y &&
    dt.getMonth() === mo - 1 &&
    dt.getDate() === d
  );
}

/**
 * Format a value as MM/DD/YYYY. Empty / unparseable inputs return ''.
 */
export function formatUsDate(value) {
  if (value == null || value === '') return '';
  const iso = fromIsoDay(value);
  if (iso) return partsToSlash(iso);

  const slash = String(value)
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    return `${pad2(slash[1])}/${pad2(slash[2])}/${slash[3]}`;
  }

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return partsToSlash({
    y: d.getFullYear(),
    mo: d.getMonth() + 1,
    d: d.getDate()
  });
}

/**
 * Same as formatUsDate, with '-' for empty / unparseable values so
 * review grids and empty cells stay aligned.
 */
export function formatUsDateOrDash(value) {
  return formatUsDate(value) || '-';
}

/**
 * Parse a typed US date (MM/DD/YYYY) or an ISO day (YYYY-MM-DD)
 * into YYYY-MM-DD. Empty / unparseable inputs return ''.
 */
export function parseToIso(value) {
  if (value == null || value === '') return '';
  const iso = fromIsoDay(value);
  if (iso && isValidYmd(iso.y, iso.mo, iso.d)) return partsToIso(iso);

  const slash = String(value)
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const mo = Number(slash[1]);
    const d = Number(slash[2]);
    const y = Number(slash[3]);
    if (isValidYmd(y, mo, d)) return partsToIso({ y, mo, d });
  }
  return '';
}

/**
 * Shift an ISO day by N calendar days using the local calendar
 * (so month and year boundaries stay correct: 10/13 + 1 = 10/14,
 * 1/31 + 1 = 2/1, 12/31 + 1 = 1/1 next year).
 */
export function addIsoDays(value, days) {
  const iso = fromIsoDay(value);
  if (!iso) return '';
  const d = new Date(iso.y, iso.mo - 1, iso.d);
  d.setDate(d.getDate() + Number(days) || 0);
  return partsToIso({
    y: d.getFullYear(),
    mo: d.getMonth() + 1,
    d: d.getDate()
  });
}

/**
 * Shift an ISO day by N calendar years, keeping month and day.
 */
export function addIsoYears(value, years) {
  const iso = fromIsoDay(value);
  if (!iso) return '';
  const d = new Date(iso.y, iso.mo - 1, iso.d);
  d.setFullYear(d.getFullYear() + (Number(years) || 0));
  return partsToIso({
    y: d.getFullYear(),
    mo: d.getMonth() + 1,
    d: d.getDate()
  });
}

/**
 * Next coverage term after an expiring policy.
 * Effective From is the calendar day after the prior Effective To
 * (n+1). Effective To is one year from that From date.
 */
export function nextTermFromPriorEnd(priorEffectiveTo) {
  const from = addIsoDays(priorEffectiveTo, 1);
  if (!from) return { from: '', to: '' };
  return { from, to: addIsoYears(from, 1) };
}
