import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Icon, Input, Modal } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { ActivityScope, ReusableActivity } from '@/types/config';
import { ActivityTile } from '@/panels/ActivitiesAndStages/ActivitiesEntityEditor';
import { ActivityEditor } from '@/panels/ActivitiesAndStages/ActivityEditor';
import { processSpecFor } from '@/panels/ActivitiesAndStages/activity-process';
import '@/panels/ActivitiesAndStages/ActivitiesEntityEditor.css';
import '@/panels/RunMyDay/PlaybookWizard.css';
import './LobActivitiesSection.css';

interface Props {
  /** LOB to scope activities to. Ignored when `global` is set. */
  lob?: string;
  /**
   * When true this section manages Global activities (scope
   * `'Lines of Submission'`) that are available to every LOB's stage
   * management. The create/edit/delete flow is otherwise identical.
   */
  global?: boolean;
}

function scopeMatches(scope: ActivityScope | undefined, lob: string): boolean {
  if (!scope || scope === 'Parent Submission') return false;
  return typeof scope === 'object' && 'lob' in scope && scope.lob === lob;
}

function isGlobalScope(scope: ActivityScope | undefined): boolean {
  return scope === 'Lines of Submission';
}

/**
 * LOB-scoped Activities list. Same source data as Setup Entities → Activities
 * (`config.reusableActivities`). Layout differences:
 *   • single-column list of tiles instead of a grid
 *   • a `+ New` button beside the search field; clicking it inserts a new
 *     activity scoped to this LOB and mounts the configure form above the
 *     existing tiles
 *   • clicking an existing tile swaps that tile in place for the configure
 *     form (the rightmost panel from Setup Entities → Activities)
 *   • each tile has a kebab menu (top-right) with Edit + Delete
 */
export function LobActivitiesSection({ lob = '', global = false }: Props) {
  const { config, update } = useConfig();
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creatingId, setCreatingId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const scopeLabel = global ? 'Global' : lob;

  const activities = useMemo(
    () =>
      // Newest first — sort by id descending so a freshly-created activity
      // (which gets the next sequential id) appears at the top of the list.
      config.reusableActivities
        .filter((a) => (global ? isGlobalScope(a.scope) : scopeMatches(a.scope, lob)))
        .slice()
        .sort((a, b) => b.id - a.id),
    [config.reusableActivities, lob, global],
  );

  const trimmed = query.trim().toLowerCase();
  const visible = trimmed
    ? activities.filter((a) => a.name.toLowerCase().includes(trimmed))
    : activities;

  // Drop a stale editor target when the activity is removed underneath us.
  useEffect(() => {
    if (editingId == null) return;
    if (!config.reusableActivities.find((a) => a.id === editingId)) {
      setEditingId(null);
    }
  }, [config.reusableActivities, editingId]);

  const editing =
    editingId != null
      ? config.reusableActivities.find((a) => a.id === editingId) ?? null
      : null;

  const onAddNew = () => {
    const newId = config.nextReusableActivityId;
    const scope: ActivityScope = global ? 'Lines of Submission' : { lob };
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

  const creating =
    creatingId != null
      ? config.reusableActivities.find((a) => a.id === creatingId) ?? null
      : null;

  const onDelete = (a: ReusableActivity) => {
    if (!confirm(`Delete activity "${a.name}"?`)) return;
    update((p) => ({
      ...p,
      reusableActivities: p.reusableActivities.filter((x) => x.id !== a.id),
    }));
    setOpenMenuId(null);
  };

  // Both create and edit open the activity form in a modal (never inline).
  const modalActivity = creating ?? editing;
  const closeModal = () => {
    setCreatingId(null);
    setEditingId(null);
  };

  return (
    <div className="lob-activities">
      <header className="lob-activities__header">
        <div>
          <h3 className="lob-activities__title">
            {global ? 'Global Activities' : `${lob} — Activities`}
          </h3>
          <p className="lob-activities__sub">
            {activities.length} activit{activities.length === 1 ? 'y' : 'ies'}{' '}
            {global ? (
              <>available to every line of business in stage management.</>
            ) : (
              <>scoped to {lob}. Sourced from the shared Activities library.</>
            )}
          </p>
        </div>
      </header>

      <div className="lob-activities__toolbar">
        <Input
          placeholder="Search by name"
          iconLeading={<Icon name="search" size={14} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={`Search ${scopeLabel} activities by name`}
          className="lob-activities__search"
        />
        <button
          type="button"
          className="lob-activities__new-btn"
          onClick={onAddNew}
        >
          <Icon name="plus" size={14} />
          New Activity
        </button>
      </div>

      <div className="lob-activities__list">
        {activities.length === 0 && !editing ? (
          <div className="lob-activities__empty">
            <p style={{ margin: 0 }}>
              {global
                ? 'No global activities yet.'
                : `No activities scoped to ${lob} yet.`}
            </p>
            <Button
              variant="brand"
              iconLeading={<Icon name="plus" size={14} />}
              onClick={onAddNew}
            >
              New Activity
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="lob-activities__empty">No activities match "{query}".</div>
        ) : (
          visible.map((a) => (
            <ActivityTile
              key={a.id}
              activity={a}
              selected={false}
              compact
              onClick={() => setEditingId(a.id)}
              titleAdornment={
                <Badge tone={processSpecFor(a.action).tone}>
                  {processSpecFor(a.action).label}
                </Badge>
              }
              actions={
                <TileMenu
                  open={openMenuId === a.id}
                  onToggle={(next) =>
                    setOpenMenuId(next ? a.id : (openMenuId === a.id ? null : openMenuId))
                  }
                  onEdit={() => {
                    setOpenMenuId(null);
                    setEditingId(a.id);
                  }}
                  onDelete={() => onDelete(a)}
                />
              }
            />
          ))
        )}
      </div>

      <Modal
        open={modalActivity != null}
        onClose={closeModal}
        title={creating ? 'New Activity' : 'Edit Activity'}
        size="md"
      >
        {modalActivity && (
          <ActivityEditor
            key={modalActivity.id}
            activity={modalActivity}
            lob={global ? undefined : lob}
            embedded
            onClose={closeModal}
          />
        )}
      </Modal>
    </div>
  );
}

interface TileMenuProps {
  open: boolean;
  onToggle: (next: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function TileMenu({ open, onToggle, onEdit, onDelete }: TileMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) {
        onToggle(false);
      }
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onToggle(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onToggle]);

  return (
    <div className="lob-tile-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="lob-tile-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Activity actions"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(!open);
        }}
      >
        <Icon name="chevron-down" size={14} />
      </button>
      {open && (
        <div className="lob-tile-menu__panel" role="menu">
          <button
            type="button"
            role="menuitem"
            className="lob-tile-menu__item"
            onClick={onEdit}
          >
            <Icon name="edit" size={14} />
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            className="lob-tile-menu__item lob-tile-menu__item--destructive"
            onClick={onDelete}
          >
            <Icon name="trash" size={14} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
