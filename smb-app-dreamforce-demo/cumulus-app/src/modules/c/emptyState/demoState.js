/**
 * Demo-state helper for the SLDS 2 empty/error states.
 *
 * The prototype is mock-data driven, so most real load / network / save
 * failures never happen. To demo the SLDS 2 states without a real
 * backend, surfaces can call `readForcedState(surface)` which parses
 * `?forceEmpty=` from the URL and returns an official illustration
 * name (`set:symbol`) when a match is found.
 *
 * Accepted URL formats:
 *   ?forceEmpty=error:recoverable
 *     → applies to every surface that calls readForcedState.
 *   ?forceEmpty=rhs@error:appconnection
 *     → applies only to the surface with key `rhs`.
 *   ?forceEmpty=rhs@error:appconnection,isw@success:new
 *     → per-surface overrides (comma-separated). A bare code (no `@`)
 *       in the list applies to any surface that isn't matched by a
 *       scoped entry.
 *
 * The set of accepted codes matches the LDS Empty State catalog.
 */

import { ILLUSTRATION_CODES } from '../../../assets/illustrations/slds2/illustrations.js';

const CODES = new Set(ILLUSTRATION_CODES);

function isValidCode(code) {
  return typeof code === 'string' && CODES.has(code);
}

export function readForcedState(surface) {
  if (typeof window === 'undefined') return null;

  let raw;
  try {
    raw = new URLSearchParams(window.location.search).get('forceEmpty');
  } catch (_) {
    return null;
  }
  if (!raw) return null;

  let fallback = null;
  const entries = raw.split(',').map((s) => s.trim()).filter(Boolean);

  for (const entry of entries) {
    if (entry.includes('@')) {
      const at = entry.indexOf('@');
      const scope = entry.slice(0, at).trim();
      const code = entry.slice(at + 1).trim();
      if (scope === surface && isValidCode(code)) return code;
    } else if (isValidCode(entry)) {
      fallback = entry;
    }
  }

  return fallback;
}
