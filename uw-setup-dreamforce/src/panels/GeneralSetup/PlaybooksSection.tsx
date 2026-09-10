import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Icon, Input } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { Playbook } from '@/types/config';
import { PlaybookWizard } from '@/panels/RunMyDay/PlaybookWizard';
import '@/panels/ActivitiesAndStages/ActivitiesEntityEditor.css';
import '@/panels/LinesOfBusiness/LobActivitiesSection.css';
import '@/panels/LinesOfBusiness/LobStageManagementSection.css';

/**
 * General Setup → Run My Day → Playbooks.
 *
 * Mirrors the LOB Activities list — compact tiles with a Status Badge
 * and kebab in the top-right. Newest-first. The "+ New Playbook"
 * button (and clicking any tile) launches the existing PlaybookWizard
 * portal, where the full create/edit flow lives.
 */
export function PlaybooksSection() {
  const { config, update } = useConfig();
  const [query, setQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [wizard, setWizard] = useState<{ open: boolean; editingId: number | null }>({
    open: false,
    editingId: null,
  });

  const playbooks = useMemo(
    () => config.playbooks.slice().sort((a, b) => b.id - a.id),
    [config.playbooks],
  );
  const trimmed = query.trim().toLowerCase();
  const visible = trimmed
    ? playbooks.filter((p) => p.name.toLowerCase().includes(trimmed))
    : playbooks;

  const onDelete = (p: Playbook) => {
    if (!confirm(`Delete playbook "${p.name}"?`)) return;
    update((prev) => ({
      ...prev,
      playbooks: prev.playbooks.filter((x) => x.id !== p.id),
    }));
    setOpenMenuId(null);
  };

  return (
    <div className="lob-activities">
      <header className="lob-activities__header">
        <div>
          <h3 className="lob-activities__title">Playbooks</h3>
          <p className="lob-activities__sub">
            {playbooks.length} playbook{playbooks.length === 1 ? '' : 's'} configured. Each
            playbook curates the daily Run My Day experience for a persona.
          </p>
        </div>
      </header>

      <div className="lob-activities__toolbar">
        <Input
          placeholder="Search by name"
          iconLeading={<Icon name="search" size={14} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search playbooks by name"
          className="lob-activities__search"
        />
        <button
          type="button"
          className="lob-activities__new-btn"
          onClick={() => setWizard({ open: true, editingId: null })}
        >
          <Icon name="plus" size={14} />
          New Playbook
        </button>
      </div>

      <div className="lob-activities__list">
        {playbooks.length === 0 ? (
          <div className="lob-activities__empty">
            <p style={{ margin: 0 }}>No playbooks yet.</p>
            <Button
              variant="brand"
              iconLeading={<Icon name="plus" size={14} />}
              onClick={() => setWizard({ open: true, editingId: null })}
            >
              New Playbook
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="lob-activities__empty">No playbooks match "{query}".</div>
        ) : (
          visible.map((p) => (
            <PlaybookTile
              key={p.id}
              playbook={p}
              onOpen={() => setWizard({ open: true, editingId: p.id })}
              menuOpen={openMenuId === p.id}
              onMenuToggle={(next) =>
                setOpenMenuId(next ? p.id : openMenuId === p.id ? null : openMenuId)
              }
              onEdit={() => {
                setOpenMenuId(null);
                setWizard({ open: true, editingId: p.id });
              }}
              onDelete={() => onDelete(p)}
            />
          ))
        )}
      </div>

      <PlaybookWizard
        open={wizard.open}
        editingId={wizard.editingId}
        onClose={() => setWizard({ open: false, editingId: null })}
      />
    </div>
  );
}

interface TileProps {
  playbook: Playbook;
  onOpen: () => void;
  menuOpen: boolean;
  onMenuToggle: (next: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function PlaybookTile({
  playbook,
  onOpen,
  menuOpen,
  onMenuToggle,
  onEdit,
  onDelete,
}: TileProps) {
  const groupCount = playbook.groups.length;
  const insightCount = playbook.groups.reduce(
    (s, g) => s + g.insights.length,
    0,
  );
  return (
    <div
      className="act-tile act-tile--compact lob-stage-tile"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="act-tile__actions">
        <div className="lob-stage-tile__actions">
          <Badge tone="info">
            <Icon name="users" size={12} />
            <span style={{ marginLeft: 4 }}>{playbook.role || 'Any role'}</span>
          </Badge>
          {playbook.active ? (
            <Badge tone="success">Active</Badge>
          ) : (
            <Badge>Inactive</Badge>
          )}
          <TileMenu
            open={menuOpen}
            onToggle={onMenuToggle}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      </div>
      <div className="act-tile__name">
        <span className="act-tile__name-text">
          {playbook.name || 'Untitled playbook'}
        </span>
      </div>
      <div className="lob-stage-tile__sub">
        {groupCount} Group{groupCount === 1 ? '' : 's'} · {insightCount} Insight
        {insightCount === 1 ? '' : 's'}
      </div>
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
    const onKey = (ev: globalThis.KeyboardEvent) => {
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
        aria-label="Playbook actions"
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
