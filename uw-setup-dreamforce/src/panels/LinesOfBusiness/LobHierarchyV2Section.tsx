import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Badge, Button, Checkbox, Icon, Input, Modal, Tabs } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { HierarchyConfig, LineCoverageEntity, RnHierarchyNode } from '@/types/config';
import { TileMenu } from './LobHierarchySection';
import '@/panels/ActivitiesAndStages/ActivitiesEntityEditor.css';
import '@/panels/GeneralSetup/Reconciliation.css';
import './LobActivitiesSection.css';
import './LobHierarchy.css';
import './LobLineTypesCoverages.css';

/**
 * LOB → Reconciliation And Normalization → Hierarchy (v2).
 *
 * Replaces the single auto-created hierarchy per LOB with a tile list of
 * named hierarchies — mirroring Line Types and Coverages. Clicking a tile or
 * New opens a two-tab modal:
 *   • Details    — Name, Line of Business (read-only), Start/End Date, Active
 *   • Hierarchy  — the tree builder (wired up in a follow-up)
 */

interface Props {
  lob: string;
}

export function LobHierarchyV2Section({ lob }: Props) {
  const { config, update } = useConfig();
  const [modalEntity, setModalEntity] = useState<HierarchyConfig | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  const entities = useMemo(
    () =>
      (config.hierarchyConfigs ?? [])
        .filter((h) => h.lob === lob)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [config.hierarchyConfigs, lob],
  );

  const trimmed = query.trim().toLowerCase();
  const visible = trimmed
    ? entities.filter((h) => h.name.toLowerCase().includes(trimmed))
    : entities;

  const onNew = () => {
    setModalEntity(null);
    setModalOpen(true);
  };
  const onOpen = (h: HierarchyConfig) => {
    setModalEntity(h);
    setModalOpen(true);
  };
  const onClose = () => {
    setModalOpen(false);
    setModalEntity(null);
  };

  const onSave = (draft: HierarchyConfig) => {
    update((prev) => {
      const existing = prev.hierarchyConfigs ?? [];
      const isNew = !existing.some((h) => h.id === draft.id);
      return {
        ...prev,
        hierarchyConfigs: isNew
          ? [...existing, draft]
          : existing.map((h) => (h.id === draft.id ? draft : h)),
        nextHierarchyConfigId: Math.max(
          prev.nextHierarchyConfigId ?? 1,
          draft.id + 1,
        ),
      };
    });
    onClose();
  };

  const onDelete = (h: HierarchyConfig) => {
    if (!confirm(`Delete hierarchy "${h.name}"?`)) return;
    update((prev) => ({
      ...prev,
      hierarchyConfigs: (prev.hierarchyConfigs ?? []).filter((x) => x.id !== h.id),
    }));
  };

  return (
    <div className="lob-activities">
      <header className="lob-activities__header">
        <div>
          <h3 className="lob-activities__title">{lob} — Hierarchy</h3>
          <p className="lob-activities__sub">
            {entities.length} hierarch{entities.length === 1 ? 'y' : 'ies'} for {lob}.
            Define the reconciliation hierarchies and the nodes they carry.
          </p>
        </div>
      </header>

      <div className="lob-activities__toolbar">
        <Input
          placeholder="Search by name"
          iconLeading={<Icon name="search" size={14} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={`Search ${lob} hierarchies by name`}
          className="lob-activities__search"
        />
        <button type="button" className="lob-activities__new-btn" onClick={onNew}>
          <Icon name="plus" size={14} />
          New Hierarchy
        </button>
      </div>

      <div className="lob-activities__list">
        {entities.length === 0 ? (
          <div className="lob-activities__empty">
            <p style={{ margin: 0 }}>No hierarchies for {lob} yet.</p>
            <Button
              variant="brand"
              iconLeading={<Icon name="plus" size={14} />}
              onClick={onNew}
            >
              New Hierarchy
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="lob-activities__empty">No hierarchies match "{query}".</div>
        ) : (
          visible.map((h) => (
            <HierarchyTile
              key={h.id}
              entity={h}
              menuOpen={openMenuId === h.id}
              onMenuToggle={(next) =>
                setOpenMenuId(next ? h.id : openMenuId === h.id ? null : openMenuId)
              }
              onClick={() => onOpen(h)}
              onDelete={() => onDelete(h)}
            />
          ))
        )}
      </div>

      {modalOpen && (
        <HierarchyModal
          lob={lob}
          entity={modalEntity}
          seedId={config.nextHierarchyConfigId ?? 1}
          onClose={onClose}
          onSave={onSave}
        />
      )}
    </div>
  );
}

/* ── Tile ─────────────────────────────────────────────────────────── */

function HierarchyTile({
  entity,
  menuOpen,
  onMenuToggle,
  onClick,
  onDelete,
}: {
  entity: HierarchyConfig;
  menuOpen: boolean;
  onMenuToggle: (next: boolean) => void;
  onClick: () => void;
  onDelete: () => void;
}) {
  const nodeCount = Math.max(0, countNodes(entity.nodes) - 1);
  return (
    <div
      className="act-tile act-tile--compact"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="act-tile__actions">
        <TileMenu
          open={menuOpen}
          onToggle={onMenuToggle}
          onEdit={() => {
            onMenuToggle(false);
            onClick();
          }}
          onDelete={() => {
            onMenuToggle(false);
            onDelete();
          }}
        />
      </div>
      <div className="act-tile__name">
        <span className="act-tile__name-text">{entity.name}</span>
        <Badge tone={entity.active === false ? 'neutral' : 'success'}>
          {entity.active === false ? 'Inactive' : 'Active'}
        </Badge>
      </div>
      <div className="act-tile__desc">
        {nodeCount} node{nodeCount === 1 ? '' : 's'}
      </div>
    </div>
  );
}

/* ── Modal ────────────────────────────────────────────────────────── */

/** Reserved id for the undeletable root node of every hierarchy tree. */
const ROOT_ID = 0;

function makeRoot(name: string): RnHierarchyNode {
  return { id: ROOT_ID, label: name.trim() || 'Root', children: [] };
}

/** Ensure the tree has exactly one top-level root node. Legacy hierarchies
 * (or freshly-created ones) may have an empty `nodes` array — wrap them. */
function withRoot(h: HierarchyConfig): HierarchyConfig {
  const root = h.nodes.find((n) => n.id === ROOT_ID);
  if (root && h.nodes.length === 1) return h;
  if (root) {
    // A root plus stray top-level siblings — fold the siblings under root.
    const strays = h.nodes.filter((n) => n.id !== ROOT_ID);
    return { ...h, nodes: [{ ...root, children: [...root.children, ...strays] }] };
  }
  return { ...h, nodes: [{ ...makeRoot(h.name), children: h.nodes }] };
}

function blankHierarchy(lob: string, id: number): HierarchyConfig {
  return {
    id,
    lob,
    name: '',
    startDate: '',
    endDate: '',
    active: true,
    nodes: [makeRoot('Root')],
  };
}

interface HierarchyModalProps {
  lob: string;
  entity: HierarchyConfig | null;
  seedId: number;
  onClose: () => void;
  onSave: (draft: HierarchyConfig) => void;
}

function HierarchyModal({ lob, entity, seedId, onClose, onSave }: HierarchyModalProps) {
  const [tab, setTab] = useState('details');
  const [draft, setDraft] = useState<HierarchyConfig>(
    () => withRoot(entity ?? blankHierarchy(lob, seedId)),
  );

  const patch = (p: Partial<HierarchyConfig>) => setDraft((d) => ({ ...d, ...p }));

  const setNodes = (nodes: RnHierarchyNode[]) => setDraft((d) => ({ ...d, nodes }));

  const valid = draft.name.trim().length > 0;

  // Keep the tree's root node labelled with the hierarchy name — except in the
  // parent-Submission scope, where the root represents the Submission itself.
  const rootLabel = lob === 'Submission' ? 'Submission' : draft.name.trim() || 'Root';
  const nodes =
    draft.nodes[0]?.id === ROOT_ID && draft.nodes[0].label !== rootLabel
      ? [{ ...draft.nodes[0], label: rootLabel }, ...draft.nodes.slice(1)]
      : draft.nodes;

  const commitSave = () => {
    if (!valid) return;
    onSave({ ...draft, name: draft.name.trim(), nodes });
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={entity ? `Edit ${entity.name}` : 'New Hierarchy'}
      footer={
        <>
          <Button variant="neutral" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="brand" disabled={!valid} onClick={commitSave}>
            Save
          </Button>
        </>
      }
    >
      <Tabs
        items={[
          { id: 'details', label: 'Details' },
          { id: 'structure', label: 'Structure', badge: countNodes(nodes) - 1 || undefined },
        ]}
        active={tab}
        onChange={setTab}
      />
      <div className="ltc-modal__body">
        {tab === 'details' ? (
          <DetailsForm lob={lob} draft={draft} patch={patch} />
        ) : (
          <StructureTab lob={lob} nodes={nodes} onChange={setNodes} />
        )}
      </div>
    </Modal>
  );
}

/* ── Details tab ──────────────────────────────────────────────────── */

interface DetailsFormProps {
  lob: string;
  draft: HierarchyConfig;
  patch: (p: Partial<HierarchyConfig>) => void;
}

function DetailsForm({ lob, draft, patch }: DetailsFormProps) {
  return (
    <div className="ltc-form">
      <div className="ltc-form__grid">
        <Input
          label="Name"
          required
          value={draft.name}
          placeholder="e.g. Property Reconciliation Hierarchy"
          onChange={(e) => patch({ name: e.target.value })}
        />
        <Input label="Line of Business" value={lob} readOnly disabled />
        <Input
          label="Start Date"
          type="date"
          value={draft.startDate ?? ''}
          onChange={(e) => patch({ startDate: e.target.value })}
        />
        <Input
          label="End Date"
          type="date"
          value={draft.endDate ?? ''}
          onChange={(e) => patch({ endDate: e.target.value })}
        />
        <div className="ltc-form__check">
          <Checkbox
            label="Active"
            checked={draft.active ?? true}
            onChange={(e) => patch({ active: e.target.checked })}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Structure tab (tree canvas + read-only detail) ──────────────── */

interface StructureTabProps {
  lob: string;
  nodes: RnHierarchyNode[];
  onChange: (next: RnHierarchyNode[]) => void;
}

function StructureTab({ lob, nodes, onChange }: StructureTabProps) {
  const { config } = useConfig();
  const [selectedId, setSelectedId] = useState<number>(ROOT_ID);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  // The node we're adding children under + the anchor to position the
  // popover beside its "Add Child" trigger. Null when closed.
  const [addUnder, setAddUnder] = useState<{
    parentId: number;
    anchor: { top: number; left: number; width: number };
  } | null>(null);
  // Drag-to-reparent state: the node being dragged and the node currently
  // hovered as a drop target.
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropId, setDropId] = useState<number | null>(null);

  // Line Types & Coverages available for this LOB (labels can drift, so
  // match loosely — falls back to all entities when nothing scopes cleanly).
  const entities = useMemo(() => {
    const all = config.lineCoverageEntities ?? [];
    const scoped = all.filter(
      (e) =>
        e.lob === lob ||
        e.lob.toLowerCase().includes(lob.toLowerCase()) ||
        lob.toLowerCase().includes(e.lob.toLowerCase()),
    );
    return (scoped.length > 0 ? scoped : all)
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [config.lineCoverageEntities, lob]);

  const entityById = useMemo(() => {
    const m = new Map<number, LineCoverageEntity>();
    entities.forEach((e) => m.set(e.id, e));
    return m;
  }, [entities]);

  useEffect(() => {
    if (!findNode(nodes, selectedId)) setSelectedId(ROOT_ID);
  }, [nodes, selectedId]);

  const selectedNode = findNode(nodes, selectedId);
  const selectedEntity =
    selectedNode?.refId != null ? entityById.get(selectedNode.refId) ?? null : null;

  const toggleCollapse = (id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addChild = (parentId: number, e: LineCoverageEntity) => {
    const child: RnHierarchyNode = {
      id: nextNodeId(nodes),
      kind: e.kind === 'Coverage' ? 'coverage' : 'entity',
      refId: e.id,
      label: e.label,
      children: [],
    };
    onChange(addChildNodes(nodes, parentId, [child]));
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(parentId);
      return next;
    });
  };

  const removeNodeById = (id: number) => {
    if (id === ROOT_ID) return;
    if (!confirm('Remove this node and any children?')) return;
    onChange(removeNodeTree(nodes, id));
  };

  /** Whether dropping `dragId` onto `targetId` is a legal move. */
  const canDropOn = (targetId: number): boolean => {
    if (dragId == null) return false;
    if (dragId === targetId || dragId === ROOT_ID) return false;
    return !isSelfOrDescendant(nodes, dragId, targetId);
  };

  const handleDrop = (targetId: number) => {
    if (dragId != null && canDropOn(targetId)) {
      onChange(moveNode(nodes, dragId, targetId));
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    }
    setDragId(null);
    setDropId(null);
  };

  return (
    <div className="lob-hier__split">
      <aside className="lob-hier__tree lob-hierv2-tree">
        <div className="lob-hier__pane-head">
          <div className="lob-hier__col-label">Structure</div>
        </div>
        <div className="lob-hier__rows" role="tree">
          {nodes.map((n) => (
            <HierNodeRows
              key={n.id}
              node={n}
              depth={0}
              selectedId={selectedId}
              collapsed={collapsed}
              onSelect={setSelectedId}
              onToggle={toggleCollapse}
              onAddChild={(parentId, anchor) => setAddUnder({ parentId, anchor })}
              onRemove={removeNodeById}
              dragId={dragId}
              dropId={dropId}
              canDropOn={canDropOn}
              onDragStartNode={setDragId}
              onDragEnterNode={setDropId}
              onDropNode={handleDrop}
              onDragEndNode={() => {
                setDragId(null);
                setDropId(null);
              }}
            />
          ))}
        </div>
      </aside>

      <div className="lob-hier__attrs">
        {!selectedNode ? (
          <div className="lob-hier__empty">Select a node to view its details.</div>
        ) : selectedNode.id === ROOT_ID ? (
          <div className="lob-hier__empty">
            This is the hierarchy root. Use <strong>Add Child</strong> on any node
            to build out the structure from Line Types and Coverages.
          </div>
        ) : selectedEntity ? (
          <EntityReadonly entity={selectedEntity} />
        ) : (
          <div className="lob-hier__empty">
            The Line Type / Coverage this node points to is no longer available.
          </div>
        )}
      </div>

      {addUnder != null && (
        <AddChildPopover
          entities={entities}
          parentLabel={findNode(nodes, addUnder.parentId)?.label ?? 'Node'}
          anchor={addUnder.anchor}
          onClose={() => setAddUnder(null)}
          onAdd={(e) => addChild(addUnder.parentId, e)}
        />
      )}
    </div>
  );
}

/* ── Structure tree rows ─────────────────────────────────────────── */

interface HierNodeRowsProps {
  node: RnHierarchyNode;
  depth: number;
  selectedId: number;
  collapsed: Set<number>;
  onSelect: (id: number) => void;
  onToggle: (id: number) => void;
  onAddChild: (id: number, anchor: { top: number; left: number; width: number }) => void;
  onRemove: (id: number) => void;
  dragId: number | null;
  dropId: number | null;
  canDropOn: (targetId: number) => boolean;
  onDragStartNode: (id: number) => void;
  onDragEnterNode: (id: number | null) => void;
  onDropNode: (targetId: number) => void;
  onDragEndNode: () => void;
}

function HierNodeRows({
  node,
  depth,
  selectedId,
  collapsed,
  onSelect,
  onToggle,
  onAddChild,
  onRemove,
  dragId,
  dropId,
  canDropOn,
  onDragStartNode,
  onDragEnterNode,
  onDropNode,
  onDragEndNode,
}: HierNodeRowsProps) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.id);
  const focused = selectedId === node.id;
  const isDragging = dragId === node.id;
  const isDropTarget = dropId === node.id && canDropOn(node.id);
  const draggable = node.id !== ROOT_ID;
  return (
    <>
      <div
        className={[
          'dc-row',
          focused ? 'dc-row--focus' : '',
          isDragging ? 'dc-row--dragging' : '',
          isDropTarget ? 'dc-row--drop' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="treeitem"
        aria-selected={focused}
        aria-expanded={hasChildren ? !isCollapsed : undefined}
        style={{ paddingLeft: 10 + depth * 18 }}
        draggable={draggable}
        onDragStart={(e) => {
          if (!draggable) return;
          e.stopPropagation();
          e.dataTransfer.effectAllowed = 'move';
          onDragStartNode(node.id);
        }}
        onDragOver={(e) => {
          if (dragId == null) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = canDropOn(node.id) ? 'move' : 'none';
        }}
        onDragEnter={(e) => {
          if (dragId == null) return;
          e.stopPropagation();
          onDragEnterNode(node.id);
        }}
        onDrop={(e) => {
          if (dragId == null) return;
          e.preventDefault();
          e.stopPropagation();
          onDropNode(node.id);
        }}
        onDragEnd={onDragEndNode}
        onClick={() => onSelect(node.id)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(node.id);
          }
        }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="lob-hier__gtoggle"
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
            aria-expanded={!isCollapsed}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
          >
            <Icon name={isCollapsed ? 'chevron-right' : 'chevron-down'} size={14} />
          </button>
        ) : (
          <span className="lob-hier__gtoggle lob-hier__gtoggle--leaf" />
        )}
        <span className="dc-row__label">{node.label}</span>
        <HierNodeMenu
          ariaLabel={`${node.label} actions`}
          canRemove={node.id !== ROOT_ID}
          onAddChild={(anchor) => onAddChild(node.id, anchor)}
          onRemove={() => onRemove(node.id)}
        />
      </div>
      {hasChildren &&
        !isCollapsed &&
        node.children.map((c) => (
          <HierNodeRows
            key={c.id}
            node={c}
            depth={depth + 1}
            selectedId={selectedId}
            collapsed={collapsed}
            onSelect={onSelect}
            onToggle={onToggle}
            onAddChild={onAddChild}
            onRemove={onRemove}
            dragId={dragId}
            dropId={dropId}
            canDropOn={canDropOn}
            onDragStartNode={onDragStartNode}
            onDragEnterNode={onDragEnterNode}
            onDropNode={onDropNode}
            onDragEndNode={onDragEndNode}
          />
        ))}
    </>
  );
}

interface HierNodeMenuProps {
  ariaLabel: string;
  canRemove: boolean;
  onAddChild: (anchor: { top: number; left: number; width: number }) => void;
  onRemove: () => void;
}
function HierNodeMenu({ ariaLabel, canRemove, onAddChild, onRemove }: HierNodeMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDocClick = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) setOpen(false);
    };
    const onKey = (ev: globalThis.KeyboardEvent) => {
      if (ev.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="dc-row__menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="dc-row__menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <Icon name="chevron-down" size={14} />
      </button>
      {open && (
        <div className="dc-row__menu-panel" role="menu">
          <button
            type="button"
            role="menuitem"
            className="dc-row__menu-item"
            onClick={(e) => {
              setOpen(false);
              const trigger = ref.current?.querySelector('.dc-row__menu-trigger');
              const r = (trigger ?? (e.currentTarget as HTMLElement)).getBoundingClientRect();
              onAddChild({ top: r.bottom + 4, left: r.left, width: r.width });
            }}
          >
            <Icon name="plus" size={14} />
            Add Child
          </button>
          {canRemove && (
            <button
              type="button"
              role="menuitem"
              className="dc-row__menu-item dc-row__menu-item--destructive"
              onClick={() => {
                setOpen(false);
                onRemove();
              }}
            >
              <Icon name="trash" size={14} />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Add-child popover (searchable Line Type / Coverage picker) ──── */

interface AddChildPopoverProps {
  entities: LineCoverageEntity[];
  parentLabel: string;
  anchor: { top: number; left: number; width: number };
  onClose: () => void;
  onAdd: (e: LineCoverageEntity) => void;
}
function AddChildPopover({ entities, parentLabel, anchor, onClose, onAdd }: AddChildPopoverProps) {
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) onClose();
    };
    const onKey = (ev: globalThis.KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const trimmed = query.trim().toLowerCase();
  const visible = trimmed
    ? entities.filter(
        (e) =>
          e.label.toLowerCase().includes(trimmed) ||
          e.developerName.toLowerCase().includes(trimmed),
      )
    : entities;

  // Sit above the modal overlay (z-index 6000) like the enrichment combo.
  const left = Math.min(anchor.left, window.innerWidth - 660);
  return createPortal(
    <div
      className="lob-hierv2-pop"
      role="dialog"
      aria-label="Add child nodes"
      ref={ref}
      style={{ position: 'fixed', top: anchor.top, left, zIndex: 6100 }}
    >
      <div className="lob-hierv2-pop__title">Adding to {parentLabel}</div>
      <div className="lob-hierv2-pop__search">
        <Input
          placeholder="Search line types and coverages"
          iconLeading={<Icon name="search" size={14} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search line types and coverages"
          autoFocus
        />
      </div>
      <div className="lob-hierv2-pop__list">
        {visible.length === 0 ? (
          <div className="lob-hier__empty" style={{ padding: 12 }}>
            {entities.length === 0
              ? 'No Line Types or Coverages defined for this LOB yet.'
              : `Nothing matches "${query}".`}
          </div>
        ) : (
          visible.map((e) => {
            const aliasNames =
              e.kind === 'Coverage'
                ? (e.aliases ?? []).map((a) => a.name).filter(Boolean)
                : [];
            return (
            <div key={e.id} className="lob-hierv2-pop__item">
              <div className="lob-hierv2-pop__item-body">
                <span className="lob-hierv2-pop__item-label">{e.label}</span>
                <span className="lob-hierv2-pop__item-sub">
                  {e.kind}
                  {aliasNames.length > 0
                    ? ` · Also known as ${aliasNames.join(', ')}`
                    : ''}
                </span>
              </div>
              <button
                type="button"
                className="lob-hierv2-pop__add"
                aria-label={`Add ${e.label}`}
                title={`Add ${e.label}`}
                onClick={() => onAdd(e)}
              >
                <Icon name="plus" size={14} />
              </button>
            </div>
            );
          })
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ── Read-only detail column ─────────────────────────────────────── */

function EntityReadonly({ entity }: { entity: LineCoverageEntity }) {
  const attrs = entity.attributes ?? [];
  return (
    <div className="lob-hierv2-ro">
      <header className="lob-hierv2-ro__head">
        <div className="lob-hier__col-label" style={{ padding: 0 }}>
          {entity.kind}
        </div>
        <h4 className="lob-hier__attrs-title">{entity.label}</h4>
        <p className="lob-hier__attrs-sub">
          {entity.developerName}
          {entity.active === false ? ' · Inactive' : ''}
        </p>
      </header>

      {entity.description && (
        <div className="lob-hierv2-ro__field">
          <div className="lob-hier__field-label">Description</div>
          <p className="lob-hierv2-ro__text">{entity.description}</p>
        </div>
      )}

      <div className="lob-hierv2-ro__field">
        <div className="lob-hier__field-label">
          Attributes ({attrs.length})
        </div>
        {attrs.length === 0 ? (
          <p className="lob-hierv2-ro__text lob-hierv2-ro__text--muted">
            No attributes defined on this {entity.kind.toLowerCase()}.
          </p>
        ) : (
          <div className="ltc-attrs__list lob-activities__list">
            {attrs.map((a) => {
              const aliases = a.aliases ?? [];
              return (
                <div
                  key={a.id}
                  className="act-tile act-tile--compact act-tile--static"
                >
                  <div className="act-tile__name">
                    <span className="act-tile__name-text">
                      {a.label || <em>Untitled attribute</em>}
                    </span>
                    <Badge tone="brand">{a.conflictStrategy ?? 'Most Common'}</Badge>
                  </div>
                  {aliases.length > 0 && (
                    <div className="act-tile__desc">
                      Also known as {aliases.join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Tree helpers ────────────────────────────────────────────────── */

function countNodes(nodes: RnHierarchyNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children), 0);
}

function findNode(nodes: RnHierarchyNode[], id: number): RnHierarchyNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const child = findNode(n.children, id);
    if (child) return child;
  }
  return null;
}

function nextNodeId(nodes: RnHierarchyNode[]): number {
  let max = 0;
  const walk = (list: RnHierarchyNode[]) => {
    list.forEach((n) => {
      if (n.id > max) max = n.id;
      walk(n.children);
    });
  };
  walk(nodes);
  return max + 1;
}

function addChildNodes(
  nodes: RnHierarchyNode[],
  parentId: number,
  children: RnHierarchyNode[],
): RnHierarchyNode[] {
  return nodes.map((n) =>
    n.id === parentId
      ? { ...n, children: [...n.children, ...children] }
      : { ...n, children: addChildNodes(n.children, parentId, children) },
  );
}

function removeNodeTree(nodes: RnHierarchyNode[], id: number): RnHierarchyNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => ({ ...n, children: removeNodeTree(n.children, id) }));
}

/** True when `maybeAncestorId` is the node itself or one of its ancestors of
 * `id` — used to reject drops that would create a cycle. */
function isSelfOrDescendant(
  nodes: RnHierarchyNode[],
  ancestorId: number,
  candidateId: number,
): boolean {
  const subtree = findNode(nodes, ancestorId);
  if (!subtree) return false;
  return findNode([subtree], candidateId) != null;
}

/** Detach `nodeId` and re-attach it as the last child of `targetId`. Returns
 * the original tree unchanged when the move is illegal (self, descendant, or
 * missing target). */
function moveNode(
  nodes: RnHierarchyNode[],
  nodeId: number,
  targetId: number,
): RnHierarchyNode[] {
  if (nodeId === targetId || nodeId === ROOT_ID) return nodes;
  const moving = findNode(nodes, nodeId);
  if (!moving) return nodes;
  // Cannot drop a node into its own subtree.
  if (isSelfOrDescendant(nodes, nodeId, targetId)) return nodes;
  const detached = removeNodeTree(nodes, nodeId);
  return addChildNodes(detached, targetId, [moving]);
}
