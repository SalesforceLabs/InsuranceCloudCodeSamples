import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Icon, Input, Modal } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { ActivityScope, ReusableActivity } from '@/types/config';
import { processSpecFor, readActivityDetail } from './activity-process';
import { ActivityEditor } from './ActivityEditor';
import '@/panels/RunMyDay/PlaybookWizard.css';
import '@/panels/DataEnrichment/EnrichmentFieldsEditor.css';
import './ActivitiesEntityEditor.css';

/**
 * The entity tree is a static list:
 *   Parent Submission         ← selectable
 *   ── Lines of Submission ── ← heading only, not selectable
 *     Property
 *     General Liability
 *     ... (LOBs from Line_of_Business__c picklist)
 *
 * Selectable items act as navigation focus. Switching focus changes which
 * Activities are shown in the middle column. Activity tiles open the editor
 * on the right.
 */
type EntityNode =
  | { kind: 'parent-submission' }
  | { kind: 'lob'; lob: string };

type EntityRow = { kind: 'heading'; label: string } | { kind: 'item'; node: EntityNode };

function entityKey(node: EntityNode): string {
  if (node.kind === 'lob') return `lob:${node.lob}`;
  return node.kind;
}

function entityLabel(node: EntityNode): string {
  if (node.kind === 'parent-submission') return 'Parent Submission';
  return node.lob;
}

function activityScopeMatches(scope: ActivityScope | undefined, node: EntityNode): boolean {
  // Activities without an explicit scope default to Parent Submission so the
  // existing seed / older instances still appear somewhere.
  const effective: ActivityScope = scope ?? 'Parent Submission';
  if (node.kind === 'parent-submission') return effective === 'Parent Submission';
  return typeof effective === 'object' && 'lob' in effective && effective.lob === node.lob;
}

function defaultScopeFor(node: EntityNode): ActivityScope {
  if (node.kind === 'parent-submission') return 'Parent Submission';
  return { lob: node.lob };
}

export function ActivitiesEntityEditor() {
  const { config, update } = useConfig();
  const lobs = useMemo(() => {
    const f = config.fields.find((x) => x.api === 'Line_of_Business__c');
    return f?.picklistValues ?? [];
  }, [config.fields]);

  const entities: EntityNode[] = useMemo(
    () => [
      { kind: 'parent-submission' },
      ...lobs.map<EntityNode>((lob) => ({ kind: 'lob', lob })),
    ],
    [lobs],
  );

  // Visual rows include a non-clickable heading above the LOBs.
  const entityRows: EntityRow[] = useMemo(() => {
    const rows: EntityRow[] = [
      { kind: 'item', node: { kind: 'parent-submission' } },
    ];
    if (lobs.length > 0) {
      rows.push({ kind: 'heading', label: 'Lines of Submission' });
      lobs.forEach((lob) => rows.push({ kind: 'item', node: { kind: 'lob', lob } }));
    }
    return rows;
  }, [lobs]);

  // Default focus: Parent Submission.
  const [focusKey, setFocusKey] = useState<string>(() => entityKey(entities[0] ?? { kind: 'parent-submission' }));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creatingId, setCreatingId] = useState<number | null>(null);

  // Re-anchor focus if the LOB picklist changes underneath us.
  useEffect(() => {
    if (!entities.find((e) => entityKey(e) === focusKey)) {
      setFocusKey(entityKey(entities[0] ?? { kind: 'parent-submission' }));
    }
  }, [entities, focusKey]);

  const focused = entities.find((e) => entityKey(e) === focusKey) ?? entities[0];
  const filteredActivities = useMemo(
    () => config.reusableActivities.filter((a) => activityScopeMatches(a.scope, focused)),
    [config.reusableActivities, focused],
  );

  // Drop a stale editor target when the activity is removed or moves out of scope.
  useEffect(() => {
    if (editingId == null) return;
    const exists = config.reusableActivities.find((a) => a.id === editingId);
    if (!exists || !activityScopeMatches(exists.scope, focused)) {
      setEditingId(null);
    }
  }, [config.reusableActivities, editingId, focused]);

  const onClickActivity = (id: number) => {
    setEditingId((curr) => (curr === id ? null : id));
  };

  const onAddActivity = () => {
    const scope = defaultScopeFor(focused);
    const newId = config.nextReusableActivityId;
    update((p) => ({
      ...p,
      reusableActivities: [
        ...p.reusableActivities,
        {
          id: newId,
          name: 'New Activity',
          description: '',
          action: 'Flow',
          actionDetails: { flowName: '' },
          scope,
        },
      ],
      nextReusableActivityId: p.nextReusableActivityId + 1,
    }));
    setCreatingId(newId);
  };

  const editing = editingId != null ? config.reusableActivities.find((a) => a.id === editingId) ?? null : null;
  const creating =
    creatingId != null ? config.reusableActivities.find((a) => a.id === creatingId) ?? null : null;

  return (
    <div
      className={[
        'rmdw-step2',
        'act-entity-editor',
        editing ? 'act-entity-editor--with-panel' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ minHeight: 480 }}
    >
      <EntityColumn
        rows={entityRows}
        focusKey={focusKey}
        countFor={(e) =>
          config.reusableActivities.filter((a) => activityScopeMatches(a.scope, e)).length
        }
        onSelect={setFocusKey}
      />
      <ActivitiesColumn
        focused={focused}
        activities={filteredActivities}
        editingId={editingId}
        onClickActivity={onClickActivity}
        onAddActivity={onAddActivity}
      />
      {editing && <ActivityEditor activity={editing} onClose={() => setEditingId(null)} />}

      <Modal
        open={creating != null}
        onClose={() => setCreatingId(null)}
        title="New Activity"
        size="md"
      >
        {creating && (
          <ActivityEditor
            key={`new-${creating.id}`}
            activity={creating}
            embedded
            lob={focused.kind === 'lob' ? focused.lob : undefined}
            onClose={() => setCreatingId(null)}
          />
        )}
      </Modal>
    </div>
  );
}

interface EntityColumnProps {
  rows: EntityRow[];
  focusKey: string;
  countFor: (e: EntityNode) => number;
  onSelect: (k: string) => void;
}

function EntityColumn({ rows, focusKey, countFor, onSelect }: EntityColumnProps) {
  const itemCount = rows.filter((r) => r.kind === 'item').length;
  return (
    <div className="rmdw-prev-col act-entity-col">
      <header className="act-col-header">
        <h4 className="act-col-title">Entity</h4>
        <span className="act-col-sub">
          {itemCount} {itemCount === 1 ? 'option' : 'options'}
        </span>
      </header>
      {rows.map((row, i) => {
        if (row.kind === 'heading') {
          return (
            <div key={`heading-${i}`} className="act-entity-heading">
              {row.label}
            </div>
          );
        }
        const k = entityKey(row.node);
        const focused = focusKey === k;
        const label = entityLabel(row.node);
        const count = countFor(row.node);
        return (
          <div
            key={k}
            className={[
              'rmdw-prev-item',
              focused ? 'rmdw-prev-item--focus' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(k)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                onSelect(k);
              }
            }}
          >
            <span style={{ flex: 1, fontWeight: 500 }}>{label}</span>
            <span style={{ fontSize: 11, color: 'var(--slds-g-color-on-surface-1)' }}>{count}</span>
          </div>
        );
      })}
    </div>
  );
}

interface ActivitiesColumnProps {
  focused: EntityNode;
  activities: ReusableActivity[];
  editingId: number | null;
  onClickActivity: (id: number) => void;
  onAddActivity: () => void;
}

function ActivitiesColumn({
  focused,
  activities,
  editingId,
  onClickActivity,
  onAddActivity,
}: ActivitiesColumnProps) {
  const [query, setQuery] = useState('');

  // Reset the search when the user navigates to a different entity.
  useEffect(() => {
    setQuery('');
  }, [entityKey(focused)]);

  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? activities.filter((a) => a.name.toLowerCase().includes(trimmed))
    : activities;

  const subtitle = trimmed
    ? `${filtered.length} of ${activities.length} match · ${entityLabel(focused)}`
    : `for ${entityLabel(focused)}`;

  return (
    <div className="rmdw-prev-col act-activities-col">
      <header className="act-col-header">
        <h4 className="act-col-title">Activities</h4>
        <span className="act-col-sub">{subtitle}</span>
      </header>
      <div className="act-activities-col__search">
        <Input
          placeholder="Search by name"
          iconLeading={<Icon name="search" size={14} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          fullWidth
          aria-label="Search activities by name"
        />
      </div>
      <div className="act-activities-col__scroll">
        {activities.length === 0 ? (
          <div className="rmdw-prev-empty">No activities for this entity yet.</div>
        ) : filtered.length === 0 ? (
          <div className="rmdw-prev-empty">No activities match "{query}".</div>
        ) : (
          filtered.map((a) => (
            <ActivityTile
              key={a.id}
              activity={a}
              selected={editingId === a.id}
              onClick={() => onClickActivity(a.id)}
            />
          ))
        )}
        <button type="button" className="rmdw-prev-add" onClick={onAddActivity}>
          + Add Activity
        </button>
      </div>
    </div>
  );
}

interface ActivityTileProps {
  activity: ReusableActivity;
  selected: boolean;
  onClick: () => void;
  /** Optional content rendered in the top-right corner (e.g. kebab menu). */
  actions?: ReactNode;
  /**
   * Optional content rendered to the immediate right of the activity title
   * in compact mode (e.g. a process-type badge). Ignored unless `compact`. */
  titleAdornment?: ReactNode;
  /**
   * When true, the tile drops the in-body process chip and the target line,
   * removes its resting border, and reveals a fill on hover. Used by the
   * LOB Activities section where the process type is shown as a badge
   * inline with the title and only the kebab menu lives in the corner.
   */
  compact?: boolean;
}

export function ActivityTile({
  activity,
  selected,
  onClick,
  actions,
  titleAdornment,
  compact,
}: ActivityTileProps) {
  const spec = processSpecFor(activity.action);
  const target = readActivityDetail(activity);
  const Glyph = spec.icon;
  return (
    <div
      className={[
        'act-tile',
        compact ? 'act-tile--compact' : '',
        selected ? 'act-tile--selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          onClick();
        }
      }}
    >
      {actions && <div className="act-tile__actions">{actions}</div>}
      {!compact && (
        <span className="act-tile__chip" style={{ background: spec.chipBg, color: spec.chipFg }}>
          <Glyph />
          {spec.label}
        </span>
      )}
      <div className="act-tile__name">
        <span className="act-tile__name-text">{activity.name || 'Untitled activity'}</span>
        {compact && titleAdornment}
      </div>
      {activity.description && <div className="act-tile__desc">{activity.description}</div>}
      {!compact &&
        (target ? (
          <div className="act-tile__target">
            <code>{target}</code>
          </div>
        ) : (
          <div className="act-tile__target act-tile__target--empty">No target configured</div>
        ))}
    </div>
  );
}

