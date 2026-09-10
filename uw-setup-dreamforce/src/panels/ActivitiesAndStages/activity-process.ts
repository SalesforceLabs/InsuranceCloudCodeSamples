import type { ReactElement } from 'react';
import { createElement } from 'react';

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export type ProcessType =
  | 'Flow'
  | 'Integration Procedure'
  | 'Omniscript'
  | 'Agent'
  | 'Enrichment Definition'
  | 'No Process';

export interface ProcessSpec {
  type: ProcessType;
  /**
   * Human-facing name shown in the UI. Usually identical to `type`, but the
   * stored `type` key is kept stable ('No Process') while the label reads
   * 'Checklist Activity'.
   */
  label: string;
  /** Primary detail key written to actionDetails for non-Enrichment-Definition processes. */
  detailKey: 'flowName' | 'ipName' | 'omniscriptName' | 'agentName' | 'enrichmentDefinitionId' | '';
  /** Label shown above the detail input. */
  detailLabel: string;
  /** Placeholder shown inside the detail input. */
  detailPlaceholder: string;
  /** Tone applied to badges, header strips, etc. */
  tone: 'brand' | 'info' | 'success' | 'warning' | 'neutral';
  /** Colored chip background + foreground (light tints). */
  chipBg: string;
  chipFg: string;
  icon: () => ReactElement;
}

const FlowIcon = (): ReactElement =>
  createElement(
    'svg',
    { viewBox: '0 0 24 24', ...stroke },
    createElement('polyline', { points: '13 2 4 14 12 14 11 22 20 10 12 10 13 2' }),
  );

const IpIcon = (): ReactElement =>
  createElement(
    'svg',
    { viewBox: '0 0 24 24', ...stroke },
    createElement('path', {
      d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
    }),
    createElement('path', {
      d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
    }),
  );

const OmniscriptIcon = (): ReactElement =>
  createElement(
    'svg',
    { viewBox: '0 0 24 24', ...stroke },
    createElement('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
    createElement('polyline', { points: '14 2 14 8 20 8' }),
    createElement('line', { x1: '8', y1: '12', x2: '16', y2: '12' }),
    createElement('line', { x1: '8', y1: '16', x2: '13', y2: '16' }),
  );

const AgentIcon = (): ReactElement =>
  createElement(
    'svg',
    { viewBox: '0 0 24 24', ...stroke },
    createElement('circle', { cx: '12', cy: '12', r: '4' }),
    createElement('path', { d: 'M2 12h2' }),
    createElement('path', { d: 'M20 12h2' }),
    createElement('path', { d: 'M12 2v2' }),
    createElement('path', { d: 'M12 20v2' }),
    createElement('path', { d: 'M5 5l1.5 1.5' }),
    createElement('path', { d: 'M17.5 17.5L19 19' }),
    createElement('path', { d: 'M19 5l-1.5 1.5' }),
    createElement('path', { d: 'M6.5 17.5L5 19' }),
  );

const NoProcessIcon = (): ReactElement =>
  createElement(
    'svg',
    { viewBox: '0 0 24 24', ...stroke },
    createElement('circle', { cx: '12', cy: '12', r: '9' }),
    createElement('line', { x1: '5.6', y1: '5.6', x2: '18.4', y2: '18.4' }),
  );

const EnrichmentIcon = (): ReactElement =>
  createElement(
    'svg',
    { viewBox: '0 0 24 24', ...stroke },
    createElement('path', { d: 'M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z' }),
    createElement('path', { d: 'M19 13l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z' }),
  );

export const PROCESS_SPECS: Record<ProcessType, ProcessSpec> = {
  Flow: {
    type: 'Flow',
    label: 'Flow',
    detailKey: 'flowName',
    detailLabel: 'Flow Name',
    detailPlaceholder: 'Search flows…',
    tone: 'brand',
    chipBg: 'var(--slds-g-color-brand-base-95)',
    chipFg: 'var(--slds-g-color-brand-base-30)',
    icon: FlowIcon,
  },
  'Integration Procedure': {
    type: 'Integration Procedure',
    label: 'Integration Procedure',
    detailKey: 'ipName',
    detailLabel: 'Integration Procedure',
    detailPlaceholder: 'Search integration procedures…',
    tone: 'info',
    chipBg: 'var(--slds-g-color-info-container-1)',
    chipFg: 'var(--slds-g-color-on-info-container-1, var(--slds-g-color-info-1))',
    icon: IpIcon,
  },
  Omniscript: {
    type: 'Omniscript',
    label: 'Omniscript',
    detailKey: 'omniscriptName',
    detailLabel: 'Omniscript',
    detailPlaceholder: 'Search omniscripts…',
    tone: 'success',
    chipBg: 'var(--slds-g-color-success-container-1)',
    chipFg: 'var(--slds-g-color-on-success-container-1, var(--slds-g-color-success-1))',
    icon: OmniscriptIcon,
  },
  Agent: {
    type: 'Agent',
    label: 'Agent',
    detailKey: 'agentName',
    detailLabel: 'Agent',
    detailPlaceholder: 'Search agents…',
    tone: 'warning',
    chipBg: 'var(--slds-g-color-warning-container-1)',
    chipFg: 'var(--slds-g-color-on-warning-container-1, var(--slds-g-color-warning-1))',
    icon: AgentIcon,
  },
  'Enrichment Definition': {
    type: 'Enrichment Definition',
    label: 'Enrichment Definition',
    detailKey: 'enrichmentDefinitionId',
    detailLabel: 'Enrichment Definition',
    detailPlaceholder: 'Pick an enrichment definition',
    tone: 'neutral',
    chipBg: 'var(--slds-g-color-surface-container-3)',
    chipFg: 'var(--slds-g-color-on-surface-3)',
    icon: EnrichmentIcon,
  },
  'No Process': {
    type: 'No Process',
    label: 'Checklist Activity',
    detailKey: '',
    detailLabel: '',
    detailPlaceholder: '',
    tone: 'neutral',
    chipBg: 'var(--slds-g-color-surface-container-2)',
    chipFg: 'var(--slds-g-color-on-surface-2)',
    icon: NoProcessIcon,
  },
};

/**
 * Process types offered in the activity editor. `Enrichment Definition` is
 * intentionally excluded — it can no longer be picked for a new activity — but
 * its spec stays in `PROCESS_SPECS` so existing seed data keeps rendering.
 */
export const PROCESS_TYPES: ProcessType[] = [
  'Flow',
  'Integration Procedure',
  'Omniscript',
  'Agent',
  'No Process',
];

/** Pull the spec for an activity's `action` string, falling back to Flow. */
export function processSpecFor(action: string | undefined | null): ProcessSpec {
  if (action && action in PROCESS_SPECS) {
    return PROCESS_SPECS[action as ProcessType];
  }
  return PROCESS_SPECS.Flow;
}

/**
 * Display string for an activity's configured target. Hides the difference
 * between detail keys so consumers can show "→ X" without branching.
 */
export function readActivityDetail(activity: {
  action?: string;
  actionDetails?: Record<string, string>;
}): string {
  const details = activity.actionDetails ?? {};
  if (activity.action === 'Enrichment Definition') {
    // Display the name (most human readable) before falling back to the id.
    return details.enrichmentDefinitionName || details.enrichmentDefinitionId || '';
  }
  const v = Object.values(details)[0];
  return typeof v === 'string' ? v : '';
}
