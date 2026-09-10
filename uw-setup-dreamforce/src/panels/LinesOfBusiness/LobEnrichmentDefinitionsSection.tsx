import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Icon, Input } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { EnrichmentDefinition } from '@/types/config';
import { EnrichmentDefinitionWizard } from './EnrichmentDefinitionWizard';
import '@/panels/ActivitiesAndStages/ActivitiesEntityEditor.css';
import './LobActivitiesSection.css';
import './LobStageManagementSection.css';

interface Props {
  lob: string;
}

/**
 * LOB → Data Enrichment → Enrichment Definitions.
 *
 * Compact-tile list (like LOB Activities) of enrichment definitions
 * scoped to the current LOB. "+ New Enrichment Definition" launches the
 * wizard; clicking a tile opens it in edit mode.
 */
export function LobEnrichmentDefinitionsSection({ lob }: Props) {
  const { config, update } = useConfig();
  const [query, setQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const definitions = useMemo(
    () =>
      config.enrichmentDefinitions
        .filter(
          (d) =>
            d.lob === lob ||
            d.lob.toLowerCase().includes(lob.toLowerCase()) ||
            lob.toLowerCase().includes(d.lob.toLowerCase()),
        )
        .slice()
        .sort((a, b) => b.id - a.id),
    [config.enrichmentDefinitions, lob],
  );

  const trimmed = query.trim().toLowerCase();
  const visible = trimmed
    ? definitions.filter((d) => d.name.toLowerCase().includes(trimmed))
    : definitions;

  const editing = editingId
    ? config.enrichmentDefinitions.find((d) => d.id === editingId) ?? null
    : null;

  const onDelete = (d: EnrichmentDefinition) => {
    if (!confirm(`Delete enrichment definition "${d.name}"?`)) return;
    update((p) => ({
      ...p,
      enrichmentDefinitions: p.enrichmentDefinitions.filter((x) => x.id !== d.id),
    }));
    setOpenMenuId(null);
  };

  return (
    <div className="lob-activities">
      <header className="lob-activities__header">
        <div>
          <h3 className="lob-activities__title">{lob} — Enrichment Definitions</h3>
          <p className="lob-activities__sub">
            {definitions.length} definition{definitions.length === 1 ? '' : 's'} for {lob}.
            Each definition fans out to one or more configured connections.
          </p>
        </div>
      </header>

      <div className="lob-activities__toolbar">
        <Input
          placeholder="Search by name"
          iconLeading={<Icon name="search" size={14} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={`Search ${lob} enrichment definitions by name`}
          className="lob-activities__search"
        />
        <button
          type="button"
          className="lob-activities__new-btn"
          onClick={() => {
            setEditingId(null);
            setWizardOpen(true);
          }}
        >
          <Icon name="plus" size={14} />
          New Enrichment Definition
        </button>
      </div>

      <div className="lob-activities__list">
        {definitions.length === 0 ? (
          <div className="lob-activities__empty">
            <p style={{ margin: 0 }}>No enrichment definitions for {lob} yet.</p>
            <Button
              variant="brand"
              iconLeading={<Icon name="plus" size={14} />}
              onClick={() => {
                setEditingId(null);
                setWizardOpen(true);
              }}
            >
              New Enrichment Definition
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="lob-activities__empty">No definitions match "{query}".</div>
        ) : (
          visible.map((d) => (
            <DefinitionTile
              key={d.id}
              definition={d}
              connectionCount={d.connectionInstanceIds?.length ?? 0}
              menuOpen={openMenuId === d.id}
              onMenuToggle={(next) =>
                setOpenMenuId(next ? d.id : openMenuId === d.id ? null : openMenuId)
              }
              onOpen={() => {
                setEditingId(d.id);
                setWizardOpen(true);
              }}
              onEdit={() => {
                setOpenMenuId(null);
                setEditingId(d.id);
                setWizardOpen(true);
              }}
              onDelete={() => onDelete(d)}
            />
          ))
        )}
      </div>

      <EnrichmentDefinitionWizard
        open={wizardOpen}
        lob={lob}
        editing={editing}
        onClose={() => {
          setWizardOpen(false);
          setEditingId(null);
        }}
      />
    </div>
  );
}

interface TileProps {
  definition: EnrichmentDefinition;
  connectionCount: number;
  menuOpen: boolean;
  onMenuToggle: (next: boolean) => void;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function DefinitionTile({
  definition,
  connectionCount,
  menuOpen,
  onMenuToggle,
  onOpen,
  onEdit,
  onDelete,
}: TileProps) {
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
          {definition.active ? (
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
          {definition.name || 'Untitled definition'}
        </span>
      </div>
      <div className="lob-stage-tile__sub">
        {connectionCount} Connection{connectionCount === 1 ? '' : 's'}
        {definition.description ? ` · ${definition.description}` : ''}
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
      if (ref.current && !ref.current.contains(ev.target as Node)) onToggle(false);
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
        aria-label="Definition actions"
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
