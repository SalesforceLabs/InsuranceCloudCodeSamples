import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Icon, Input, Modal } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { ActivityScope, ReusableActivity } from '@/types/config';
import { ActivityTile } from '@/panels/ActivitiesAndStages/ActivitiesEntityEditor';
import { ActivityEditor } from '@/panels/ActivitiesAndStages/ActivityEditor';
import { processSpecFor } from '@/panels/ActivitiesAndStages/activity-process';
import '@/panels/ActivitiesAndStages/ActivitiesEntityEditor.css';
import '@/panels/RunMyDay/PlaybookWizard.css';
import '@/panels/LinesOfBusiness/LobActivitiesSection.css';

/**
 * Submission-scoped Activities list. Mirrors the LOB version
 * (`LobActivitiesSection`) but filters and writes against the
 * `'Parent Submission'` scope so these are the activities that apply at
 * the submission level (not tied to any single LOB).
 */
function isSubmissionScope(scope: ActivityScope | undefined): boolean {
  // Activities created before scopes existed default to Parent Submission.
  if (!scope) return true;
  return scope === 'Parent Submission';
}

export function SubmissionActivitiesSection() {
  const { config, update } = useConfig();
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creatingId, setCreatingId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const activities = useMemo(
    () =>
      config.reusableActivities
        .filter((a) => isSubmissionScope(a.scope))
        .slice()
        .sort((a, b) => b.id - a.id),
    [config.reusableActivities],
  );

  const trimmed = query.trim().toLowerCase();
  const visible = trimmed
    ? activities.filter((a) => a.name.toLowerCase().includes(trimmed))
    : activities;

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
          scope: 'Parent Submission',
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
          <h3 className="lob-activities__title">Submission Activities</h3>
          <p className="lob-activities__sub">
            {activities.length} activit{activities.length === 1 ? 'y' : 'ies'} scoped to the
            parent Submission. Sourced from the shared Activities library.
          </p>
        </div>
      </header>

      <div className="lob-activities__toolbar">
        <Input
          placeholder="Search by name"
          iconLeading={<Icon name="search" size={14} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search submission activities by name"
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
        {activities.length === 0 ? (
          <div className="lob-activities__empty">
            <p style={{ margin: 0 }}>No submission-scoped activities yet.</p>
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
                    setOpenMenuId(next ? a.id : openMenuId === a.id ? null : openMenuId)
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
