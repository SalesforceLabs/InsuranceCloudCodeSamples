import { useEffect, useMemo, useState } from 'react';
import { Card, Icon, Select, Table, type Column } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { ReusableActivity } from '@/types/config';
import { processSpecFor } from '@/panels/ActivitiesAndStages/activity-process';
import '@/panels/LinesOfBusiness/LobActivitiesSection.css';
import './DocumentClassification.css';
import './SubmissionEntity.css';

/**
 * Type of Salesforce entity surfaced under General Setup → Submission
 * Entities. Each maps to an `actionDetails` key on `ReusableActivity`,
 * plus a sourceUrl for the "Go to …" CTA at the top.
 */
export type EntityKind =
  | 'Flow'
  | 'Integration Procedure'
  | 'Omniscript'
  | 'Agent'
  | 'Submission Context';

interface Props {
  kind: EntityKind;
}

interface UsageRow {
  /** Where the entity is referenced (Activity, Field Mapping, etc). */
  surface: string;
  /** Name of the parent (activity name, mapping name, etc). */
  parent: string;
  /** Optional secondary label — usually the LOB or stage. */
  scope?: string;
}

interface EntityRow {
  name: string;
  usages: UsageRow[];
}

const KIND_META: Record<
  EntityKind,
  {
    /** Heading + tile label used on the page. */
    title: string;
    /** Plural form for empty state copy. */
    plural: string;
    /** Subtitle copy. */
    description: string;
    /** Salesforce target the "Go to" CTA should point at. */
    salesforceLabel: string;
    /** Field on actionDetails that holds the entity name. */
    detailKey: string;
    /** Activity-process action type that owns this entity. Submission
     * Context isn't owned by an action — it sources usages purely from
     * extraUsages, so this can be empty there. */
    action:
      | 'Flow'
      | 'Integration Procedure'
      | 'Omniscript'
      | 'Agent'
      | null;
    /** Hard-coded extra usages outside of activities — populated below. */
    extraUsages: UsageRow[];
    /** Optional named entities to seed when no activity references any. */
    seededEntities?: string[];
  }
> = {
  Flow: {
    title: 'Flows',
    plural: 'flows',
    description:
      'Flows currently referenced by underwriting activities. Manage the flows themselves in Salesforce Setup.',
    salesforceLabel: 'Go to Flows',
    detailKey: 'flowName',
    action: 'Flow',
    extraUsages: [
      {
        surface: 'Submission Assignment Rule',
        parent: 'High-Value Submissions',
        scope: 'Property',
      },
    ],
  },
  'Integration Procedure': {
    title: 'Integration Procedures',
    plural: 'Integration Procedures',
    description:
      'Integration Procedures used by activities and enrichment definitions. Edit the IPs themselves in OmniStudio.',
    salesforceLabel: 'Go to Integration Procedures',
    detailKey: 'ipName',
    action: 'Integration Procedure',
    extraUsages: [
      {
        surface: 'Enrichment Definition',
        parent: 'Property Risk Lookup',
        scope: 'Property',
      },
      {
        surface: 'Reconciliation Connection',
        parent: 'Verisk PolicyDecisions',
        scope: 'Verisk',
      },
    ],
  },
  Omniscript: {
    title: 'Omniscripts',
    plural: 'Omniscripts',
    description:
      'Omniscripts referenced from underwriting activities. Manage the scripts themselves in OmniStudio.',
    salesforceLabel: 'Go to Omniscripts',
    detailKey: 'omniscriptName',
    action: 'Omniscript',
    extraUsages: [
      {
        surface: 'Field Mapping',
        parent: 'Submission Intake Mapping',
        scope: 'Property',
      },
    ],
  },
  Agent: {
    title: 'Agents',
    plural: 'agents',
    description:
      'Agentforce agents reachable from underwriting flows. Manage the agents themselves in Agentforce.',
    salesforceLabel: 'Go to Agentforce',
    detailKey: 'agentName',
    action: 'Agent',
    extraUsages: [
      {
        surface: 'Reconciliation',
        parent: 'Default Reconciliation Agent',
        scope: 'All LOBs',
      },
    ],
  },
  'Submission Context': {
    title: 'Submission Context',
    plural: 'context definitions',
    description:
      'Salesforce context definitions that downstream extraction, reconciliation, and activities run against.',
    salesforceLabel: 'Go to Context Definition',
    detailKey: '',
    action: null,
    extraUsages: [
      {
        surface: 'Document Classification',
        parent: 'ACORD Forms Classifier',
        scope: 'All LOBs',
      },
      {
        surface: 'Extraction Template',
        parent: 'ACORD 125 Extraction',
        scope: 'ACORD',
      },
      {
        surface: 'Reconciliation',
        parent: 'Property Hierarchy',
        scope: 'Property',
      },
    ],
    seededEntities: ['Submission Context'],
  },
};

export function SubmissionEntitySection({ kind }: Props) {
  const { config } = useConfig();
  const meta = KIND_META[kind];

  const rows = useMemo<EntityRow[]>(() => {
    const byName = new Map<string, UsageRow[]>();

    // Walk every reusable activity and bucket usages by entity name.
    // Skipped for kinds without an associated action (e.g. Submission
    // Context) — those rely on seededEntities + extraUsages.
    if (meta.action) {
      config.reusableActivities.forEach((a) => {
        const spec = processSpecFor(a.action);
        if (spec.type !== meta.action) return;
        const name = (a.actionDetails?.[meta.detailKey] ?? '').trim();
        if (!name) return;
        const list = byName.get(name) ?? [];
        list.push({
          surface: 'Activity',
          parent: a.name || 'Untitled activity',
          scope: scopeLabel(a),
        });
        byName.set(name, list);
      });
    }

    // Pre-seed any always-present entities so the table is never empty.
    meta.seededEntities?.forEach((name) => {
      if (!byName.has(name)) byName.set(name, []);
    });

    // Add the demo-only extra usages so the page feels lived-in. When the
    // kind has an action, route extras under a seeded entity name; when
    // there's no action (Submission Context), point everything at the
    // single seeded entity so the demo reads as one definition reused
    // across surfaces.
    meta.extraUsages.forEach((u) => {
      let name: string;
      if (!meta.action) {
        name = meta.seededEntities?.[0] ?? u.parent;
      } else if (
        u.parent &&
        /\b(Procedure|Lookup|Mapping|Intake|Risk)\b/i.test(u.parent)
      ) {
        name = seedEntityName(meta.action, u.parent);
      } else {
        name = u.parent;
      }
      const list = byName.get(name) ?? [];
      list.push(u);
      byName.set(name, list);
    });

    return Array.from(byName.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, usages]) => ({ name, usages }));
  }, [config.reusableActivities, kind, meta]);

  const cols: Column<EntityRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (r) => (
        <a
          className="se-link"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            alert(`This will lead to the ${kind} page in Salesforce.`);
          }}
        >
          {r.name}
        </a>
      ),
    },
  ];

  return (
    <div className="se-section">
      <header className="se-head">
        <div>
          <h3 className="se-title">{meta.title}</h3>
          <p className="se-sub">{meta.description}</p>
        </div>
        <button
          type="button"
          className="lob-activities__new-btn"
          onClick={() => alert(`This will lead to the ${kind} page in Salesforce.`)}
        >
          <Icon name="trending-up" size={12} />
          {meta.salesforceLabel}
        </button>
      </header>

      <Card padding="none">
        <Table<EntityRow>
          columns={cols}
          rows={rows}
          rowKey={(r) => r.name}
          empty={`No ${meta.plural} are referenced yet.`}
        />
      </Card>
    </div>
  );
}

/* Curated context-definition suggestions offered in the selector. The
 * stored value is appended if it isn't already one of these. */
const SUBMISSION_CONTEXTS = [
  'Submission Context',
  'Property Submission Context',
  'Casualty Submission Context',
  'Marine Submission Context',
];

/**
 * General Setup → Submission Context.
 *
 * A selectable card mirroring the Normalization Agent selector: read-only
 * value with an inline Edit → Select, plus a "Go to Context" button that
 * links out to the Salesforce context definition.
 */
export function SubmissionContextSection() {
  const { config, update } = useConfig();
  const stored = config.submissionContext ?? '';
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(stored || SUBMISSION_CONTEXTS[0]);

  useEffect(() => {
    if (!editing) {
      setValue(stored || SUBMISSION_CONTEXTS[0]);
    }
  }, [stored, editing]);

  const onSave = () => {
    update((p) => ({ ...p, submissionContext: value }));
    setEditing(false);
  };

  const onCancel = () => {
    setValue(stored || SUBMISSION_CONTEXTS[0]);
    setEditing(false);
  };

  const options =
    SUBMISSION_CONTEXTS.includes(stored) || stored === ''
      ? SUBMISSION_CONTEXTS
      : [stored, ...SUBMISSION_CONTEXTS];

  return (
    <div className="dc-section">
      <Card padding="md">
        <div className="dc-threshold">
          <div className="dc-threshold__label">Submission Context Definition</div>
          {editing ? (
            <div className="dc-threshold__edit-row">
              <Select
                value={value}
                onChange={(e) => setValue(e.target.value)}
                options={options.map((c) => ({ value: c, label: c }))}
                aria-label="Submission Context Definition"
              />
              <button
                type="button"
                className="dc-inline-edit"
                onClick={onSave}
                aria-label="Save"
                title="Save"
              >
                <Icon name="check" size={14} />
              </button>
              <button
                type="button"
                className="dc-inline-edit"
                onClick={onCancel}
                aria-label="Cancel"
                title="Cancel"
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          ) : (
            <div className="dc-threshold__edit-row">
              <span className="dc-threshold__value">{stored || '—'}</span>
              <button
                type="button"
                className="dc-inline-edit"
                onClick={() => setEditing(true)}
                aria-label="Edit Submission Context Definition"
                title="Edit"
              >
                <Icon name="edit" size={14} />
              </button>
              <button
                type="button"
                className="dc-text-btn"
                onClick={() =>
                  alert('This will lead to the Context Definition page in Salesforce.')
                }
              >
                Go to Context
              </button>
            </div>
          )}
          <p className="dc-threshold__hint">
            The Salesforce context definition downstream extraction,
            reconciliation, and activities run against.
          </p>
        </div>
      </Card>
    </div>
  );
}

function scopeLabel(a: ReusableActivity): string | undefined {
  const s = a.scope;
  if (!s) return undefined;
  if (s === 'Parent Submission') return 'Parent Submission';
  if (typeof s === 'object' && 'lob' in s) return s.lob;
  return undefined;
}

/** Cheap seeder so the demo "extra" usages don't reuse activity names. */
function seedEntityName(
  action: 'Flow' | 'Integration Procedure' | 'Omniscript' | 'Agent',
  parent: string,
): string {
  const base = parent.replace(/\s+/g, '');
  switch (action) {
    case 'Flow':
      return `${base}Flow`;
    case 'Integration Procedure':
      return `${base}IP`;
    case 'Omniscript':
      return `${base}OS`;
    case 'Agent':
      return `${base}Agent`;
  }
}
