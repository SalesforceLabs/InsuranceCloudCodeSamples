import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Badge, Button, Checkbox, Icon, Input, Modal, Select } from '@/components/ui';
import type { IconName } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import {
  RN_RESOLUTION_STRATEGIES,
  RN_SOURCE_TYPES,
  type RnAttributeSource,
  type RnHierarchy,
  type RnHierarchyAttribute,
  type RnHierarchyNode,
  type RnResolutionStrategy,
  type RnSourceType,
} from '@/types/config';
import '@/panels/ActivitiesAndStages/ReusableActivityModal.css';
import '@/panels/ActivitiesAndStages/ActivitiesEntityEditor.css';
import '@/panels/GeneralSetup/DocumentClassification.css';
import '@/panels/GeneralSetup/Reconciliation.css';
import './LobActivitiesSection.css';
import './LobHierarchy.css';

interface Props {
  lob: string;
}

/**
 * LOB → Reconciliation and Normalization → Hierarchy.
 *
 * Each LOB has at most one hierarchy, auto-created on first render. Nodes
 * are authored from scratch (Name + optional effective dates) — there's no
 * base entity to inherit from anymore. The left rail is a Salesforce-style
 * tree grid (Name / Start / End columns + per-row actions); the right pane
 * lets you build attributes for the selected node, each with an alias list,
 * a duplicate-check flag, and a resolution strategy. Picking "Source
 * Priority" opens a ranked, drag-reorderable table of sources.
 */
export function LobHierarchySection({ lob }: Props) {
  const { config, update } = useConfig();

  const hierarchy = useMemo(() => {
    return (
      config.rnHierarchies.find(
        (h) =>
          h.lob === lob ||
          h.lob.toLowerCase().includes(lob.toLowerCase()) ||
          lob.toLowerCase().includes(h.lob.toLowerCase()),
      ) ?? null
    );
  }, [config.rnHierarchies, lob]);

  useEffect(() => {
    if (hierarchy) return;
    update((p) => {
      if (
        p.rnHierarchies.some(
          (h) =>
            h.lob === lob ||
            h.lob.toLowerCase().includes(lob.toLowerCase()) ||
            lob.toLowerCase().includes(h.lob.toLowerCase()),
        )
      ) {
        return p;
      }
      return {
        ...p,
        rnHierarchies: [
          ...p.rnHierarchies,
          { id: p.nextRnHierarchyId, name: `${lob} Hierarchy`, lob, nodes: [] },
        ],
        nextRnHierarchyId: p.nextRnHierarchyId + 1,
      };
    });
  }, [hierarchy, lob, update]);

  if (!hierarchy) {
    return <div className="lob-hier__empty">Setting up the hierarchy for {lob}…</div>;
  }

  return <HierarchyDetail hierarchy={hierarchy} lob={lob} />;
}

/* ── Detail (tree grid + attributes) ─────────────────────────────── */

interface DetailProps {
  hierarchy: RnHierarchy;
  lob: string;
}

/** Working draft for the Name / Start / End node form. */
interface NodeDraft {
  label: string;
  startDate: string;
  endDate: string;
}

function HierarchyDetail({ hierarchy, lob }: DetailProps) {
  const { update } = useConfig();
  const [selectedId, setSelectedId] = useState<number | null>(
    () => hierarchy.nodes[0]?.id ?? null,
  );
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  // Node form. `parentId` is the node we add a child under ('root' for a
  // top-level node); `editId` is set when editing an existing node.
  const [nodeForm, setNodeForm] = useState<
    | { mode: 'add'; parentId: number | 'root' }
    | { mode: 'edit'; editId: number }
    | null
  >(null);

  useEffect(() => {
    if (selectedId == null) return;
    if (!findNode(hierarchy.nodes, selectedId)) {
      setSelectedId(hierarchy.nodes[0]?.id ?? null);
    }
  }, [hierarchy.nodes, selectedId]);

  const selectedNode = selectedId ? findNode(hierarchy.nodes, selectedId) : null;

  const writeNodes = (next: RnHierarchyNode[]) => {
    update((p) => ({
      ...p,
      rnHierarchies: p.rnHierarchies.map((h) =>
        h.id === hierarchy.id ? { ...h, nodes: next } : h,
      ),
    }));
  };

  const commitNode = (draft: NodeDraft) => {
    const label = draft.label.trim();
    if (!label || !nodeForm) return;
    const clean: Pick<RnHierarchyNode, 'label' | 'startDate' | 'endDate'> = {
      label,
      startDate: draft.startDate || undefined,
      endDate: draft.endDate || undefined,
    };
    if (nodeForm.mode === 'edit') {
      writeNodes(
        mapNode(hierarchy.nodes, nodeForm.editId, (n) => ({ ...n, ...clean })),
      );
    } else {
      const node: RnHierarchyNode = {
        id: nextNodeId(hierarchy.nodes),
        ...clean,
        children: [],
        attributes: [],
      };
      if (nodeForm.parentId === 'root') {
        writeNodes([...hierarchy.nodes, node]);
      } else {
        const parentId = nodeForm.parentId;
        writeNodes(addChild(hierarchy.nodes, parentId, node));
        setCollapsed((prev) => {
          const next = new Set(prev);
          next.delete(parentId);
          return next;
        });
      }
      setSelectedId(node.id);
    }
    setNodeForm(null);
  };

  const onRemoveNode = (id: number) => {
    if (!confirm('Remove this node and any children?')) return;
    writeNodes(removeNode(hierarchy.nodes, id));
  };

  const toggleCollapse = (id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateAttributes = (next: RnHierarchyAttribute[]) => {
    if (selectedId == null) return;
    writeNodes(mapNode(hierarchy.nodes, selectedId, (n) => ({ ...n, attributes: next })));
  };

  const editTarget =
    nodeForm?.mode === 'edit' ? findNode(hierarchy.nodes, nodeForm.editId) : null;

  return (
    <div className="lob-hier">
      <header className="lob-hier__head">
        <div className="lob-hier__head-titles">
          <h3 className="lob-hier__title">{hierarchy.lob} — Hierarchy</h3>
          <p className="lob-hier__sub">
            Build the reconciliation tree from scratch. Add nodes, then give
            each one attributes with a resolution strategy.
          </p>
        </div>
      </header>

      <div className="lob-hier__split">
        <aside className="lob-hier__tree">
          <div className="lob-hier__pane-head">
            <div className="lob-hier__col-label">Hierarchy</div>
            <button
              type="button"
              className="lob-hier__text-btn"
              onClick={() => setNodeForm({ mode: 'add', parentId: 'root' })}
            >
              <Icon name="plus" size={12} />
              Add Node
            </button>
          </div>
          {hierarchy.nodes.length === 0 ? (
            <div className="lob-hier__empty">
              No nodes yet. Click <strong>Add Node</strong> to start.
            </div>
          ) : (
            <div className="lob-hier__rows" role="tree">
              {hierarchy.nodes.map((n) => (
                <NodeRows
                  key={n.id}
                  node={n}
                  depth={0}
                  selectedId={selectedId}
                  collapsed={collapsed}
                  onSelect={setSelectedId}
                  onToggle={toggleCollapse}
                  onAddChild={(id) => setNodeForm({ mode: 'add', parentId: id })}
                  onEdit={(id) => setNodeForm({ mode: 'edit', editId: id })}
                  onRemove={onRemoveNode}
                />
              ))}
            </div>
          )}
        </aside>

        <div className="lob-hier__attrs">
          {!selectedNode ? (
            <div className="lob-hier__empty">Select a node to manage its attributes.</div>
          ) : (
            <AttributesPane node={selectedNode} lob={lob} onChange={updateAttributes} />
          )}
        </div>
      </div>

      <NodeFormModal
        open={nodeForm != null}
        mode={nodeForm?.mode === 'edit' ? 'edit' : 'add'}
        initial={
          editTarget
            ? {
                label: editTarget.label,
                startDate: editTarget.startDate ?? '',
                endDate: editTarget.endDate ?? '',
              }
            : undefined
        }
        onClose={() => setNodeForm(null)}
        onSave={commitNode}
      />
    </div>
  );
}

/* ── Tree-grid rows ──────────────────────────────────────────────── */

interface NodeRowsProps {
  node: RnHierarchyNode;
  depth: number;
  selectedId: number | null;
  collapsed: Set<number>;
  onSelect: (id: number) => void;
  onToggle: (id: number) => void;
  onAddChild: (id: number) => void;
  onEdit: (id: number) => void;
  onRemove: (id: number) => void;
}

function NodeRows({
  node,
  depth,
  selectedId,
  collapsed,
  onSelect,
  onToggle,
  onAddChild,
  onEdit,
  onRemove,
}: NodeRowsProps) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.id);
  const focused = selectedId === node.id;
  return (
    <>
      <div
        className={['dc-row', focused ? 'dc-row--focus' : ''].filter(Boolean).join(' ')}
        role="treeitem"
        aria-selected={focused}
        aria-expanded={hasChildren ? !isCollapsed : undefined}
        style={{ paddingLeft: 10 + depth * 18 }}
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
        <NodeMenu
          ariaLabel={`${node.label} actions`}
          onEdit={() => onEdit(node.id)}
          onAddChild={() => onAddChild(node.id)}
          onRemove={() => onRemove(node.id)}
        />
      </div>
      {hasChildren &&
        !isCollapsed &&
        node.children.map((c) => (
          <NodeRows
            key={c.id}
            node={c}
            depth={depth + 1}
            selectedId={selectedId}
            collapsed={collapsed}
            onSelect={onSelect}
            onToggle={onToggle}
            onAddChild={onAddChild}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        ))}
    </>
  );
}

interface NodeMenuProps {
  ariaLabel: string;
  onEdit: () => void;
  onAddChild: () => void;
  onRemove: () => void;
}
function NodeMenu({ ariaLabel, onEdit, onAddChild, onRemove }: NodeMenuProps) {
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
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            <Icon name="edit" size={14} />
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            className="dc-row__menu-item"
            onClick={() => {
              setOpen(false);
              onAddChild();
            }}
          >
            <Icon name="plus" size={14} />
            Add Child Node
          </button>
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
            Remove Node
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Attribute tile kebab menu (Edit / Delete) ───────────────────── */

interface TileMenuProps {
  open: boolean;
  onToggle: (next: boolean) => void;
  onEdit: () => void;
  /** Omit to hide the Delete action (e.g. non-deletable rows). */
  onDelete?: () => void;
}
export function TileMenu({ open, onToggle, onEdit, onDelete }: TileMenuProps) {
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
        aria-label="Attribute actions"
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
          {onDelete && (
            <button
              type="button"
              role="menuitem"
              className="lob-tile-menu__item lob-tile-menu__item--destructive"
              onClick={onDelete}
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

/* ── Node form modal ─────────────────────────────────────────────── */

interface NodeFormModalProps {
  open: boolean;
  mode: 'add' | 'edit';
  initial?: NodeDraft;
  onClose: () => void;
  onSave: (draft: NodeDraft) => void;
}
function NodeFormModal({ open, mode, initial, onClose, onSave }: NodeFormModalProps) {
  const [label, setLabel] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!open) return;
    setLabel(initial?.label ?? '');
    setStartDate(initial?.startDate ?? '');
    setEndDate(initial?.endDate ?? '');
  }, [open, initial]);

  const valid = label.trim().length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit Node' : 'Add Node'}
      size="sm"
      footer={
        <>
          <Button variant="neutral" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="brand"
            disabled={!valid}
            onClick={() => onSave({ label: label.trim(), startDate, endDate })}
          >
            {mode === 'edit' ? 'Save' : 'Add'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input
          label="Name"
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Location"
          fullWidth
        />
        <div style={{ display: 'flex', gap: 12 }}>
          <Input
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            fullWidth
          />
          <Input
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            fullWidth
          />
        </div>
      </div>
    </Modal>
  );
}

/* ── Attributes pane (right column) ──────────────────────────────── */

interface AttributesPaneProps {
  node: RnHierarchyNode;
  lob: string;
  onChange: (next: RnHierarchyAttribute[]) => void;
}
function AttributesPane({ node, lob, onChange }: AttributesPaneProps) {
  const { config } = useConfig();
  const attrs = node.attributes ?? [];
  const [editing, setEditing] = useState<RnHierarchyAttribute | 'new' | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | string | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

  // Categories come from the LOB Categories section (shared with Enrichment
  // Fields via `enrichmentConfigs`).
  const categories = useMemo(() => {
    const lobs = config.enrichmentConfigs.map((c) => c.lob);
    const resolved = resolveCategoryLob(lob, lobs);
    const cfg = resolved
      ? config.enrichmentConfigs.find((c) => c.lob === resolved)
      : null;
    return (cfg?.categories ?? []).map((c) => c.name);
  }, [config.enrichmentConfigs, lob]);

  // Group attributes by category for the expandable sections. Category order
  // follows the configured category list; any leftover (uncategorized or
  // stale) attributes fall into a trailing "Uncategorized" group.
  const grouped = useMemo(() => {
    const buckets = new Map<string, RnHierarchyAttribute[]>();
    for (const a of attrs) {
      const cat = a.category && a.category.trim() ? a.category : UNCATEGORIZED;
      const list = buckets.get(cat);
      if (list) list.push(a);
      else buckets.set(cat, [a]);
    }
    const order = [...categories, UNCATEGORIZED];
    return [...buckets.entries()]
      .sort(([a], [b]) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib);
      });
  }, [attrs, categories]);

  const toggleCat = (cat: string) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Close any open editor when the selected node changes under us.
  useEffect(() => {
    setEditing(null);
  }, [node.id]);

  const onSave = (draft: RnHierarchyAttribute) => {
    if (editing === 'new') {
      onChange([...attrs, { ...draft, id: nextAttrId(attrs) }]);
    } else if (editing) {
      onChange(attrs.map((a) => (a.id === editing.id ? { ...draft, id: editing.id } : a)));
    }
    setEditing(null);
  };

  const onDelete = (a: RnHierarchyAttribute) => {
    if (!confirm(`Delete attribute "${a.name}"?`)) return;
    onChange(attrs.filter((x) => x !== a));
  };

  return (
    <>
      <header className="lob-hier__attrs-head">
        <div>
          <div className="lob-hier__col-label">Attributes</div>
          <h4 className="lob-hier__attrs-title">{node.label}</h4>
          <p className="lob-hier__attrs-sub">
            {attrs.length} attribute{attrs.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          className="lob-hier__text-btn"
          onClick={() => setEditing('new')}
        >
          <Icon name="plus" size={12} />
          New Attribute
        </button>
      </header>

      {attrs.length === 0 ? (
        <div className="lob-hier__empty">
          No attributes yet. Click <strong>New Attribute</strong> to add one.
        </div>
      ) : (
        <div className="lob-hier__cats">
          {grouped.map(([cat, list]) => {
            const open = !collapsedCats.has(cat);
            return (
              <section
                key={cat}
                className={[
                  'lob-hier__cat',
                  open ? 'lob-hier__cat--open' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <h4 className="lob-hier__cat-head">
                  <button
                    type="button"
                    className="lob-hier__cat-toggle"
                    aria-expanded={open}
                    onClick={() => toggleCat(cat)}
                  >
                    <span className="lob-hier__cat-chevron" aria-hidden="true">
                      <Icon name="chevron-down" size={14} />
                    </span>
                    <span className="lob-hier__cat-title">{cat}</span>
                  </button>
                </h4>
                {open && (
                  <div className="lob-hier__cat-body lob-activities__list">
                    {list.map((a, i) => {
                      const key = a.id ?? `${a.name}-${i}`;
                      return (
                        <div
                          key={key}
                          className="act-tile act-tile--compact"
                          role="button"
                          tabIndex={0}
                          onClick={() => setEditing(a)}
                          onKeyDown={(ev) => {
                            if (ev.key === 'Enter' || ev.key === ' ') {
                              ev.preventDefault();
                              setEditing(a);
                            }
                          }}
                        >
                          <div className="act-tile__actions">
                            <TileMenu
                              open={openMenuId === key}
                              onToggle={(next) =>
                                setOpenMenuId(
                                  next ? key : openMenuId === key ? null : openMenuId,
                                )
                              }
                              onEdit={() => {
                                setOpenMenuId(null);
                                setEditing(a);
                              }}
                              onDelete={() => {
                                setOpenMenuId(null);
                                onDelete(a);
                              }}
                            />
                          </div>
                          <div className="act-tile__name">
                            <span className="act-tile__name-text">{a.name}</span>
                            <Badge tone="brand">{normalizeStrategy(a.strategy)}</Badge>
                            {a.duplicationCheck && (
                              <Badge tone="success">Dup check</Badge>
                            )}
                          </div>
                          {(a.aliases ?? []).length > 0 && (
                            <div className="act-tile__desc">
                              Also known as {(a.aliases ?? []).join(', ')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <AttributeFormModal
        open={editing != null}
        lob={lob}
        categories={categories}
        existingNames={attrs
          .filter((a) => editing !== 'new' && editing != null ? a.id !== editing.id : true)
          .map((a) => a.name.toLowerCase())}
        initial={editing && editing !== 'new' ? editing : undefined}
        onClose={() => setEditing(null)}
        onSave={onSave}
      />
    </>
  );
}

/* ── Attribute form modal ────────────────────────────────────────── */

interface AttributeFormModalProps {
  open: boolean;
  lob: string;
  categories: string[];
  existingNames: string[];
  initial?: RnHierarchyAttribute;
  onClose: () => void;
  onSave: (draft: RnHierarchyAttribute) => void;
}
function AttributeFormModal({
  open,
  lob,
  categories,
  existingNames,
  initial,
  onClose,
  onSave,
}: AttributeFormModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);
  const [dupCheck, setDupCheck] = useState(false);
  const [strategy, setStrategy] = useState<RnResolutionStrategy>('Most Common');
  const [sources, setSources] = useState<RnAttributeSource[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setCategory(initial?.category ?? '');
    setAliases(initial?.aliases ?? []);
    setDupCheck(initial?.duplicationCheck ?? false);
    setStrategy(normalizeStrategy(initial?.strategy));
    setSources(initial?.sources ?? []);
  }, [open, initial]);

  const trimmed = name.trim();
  const collides = existingNames.includes(trimmed.toLowerCase());
  const valid = trimmed.length > 0 && !collides && category.trim().length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? `Edit Attribute · ${initial.name}` : 'New Attribute'}
      size={strategy === 'Source Priority' ? 'lg' : 'md'}
      footer={
        <>
          <Button variant="neutral" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="brand"
            disabled={!valid}
            onClick={() =>
              onSave({
                name: trimmed,
                category,
                aliases,
                duplicationCheck: dupCheck,
                strategy,
                // Only persist sources when they're meaningful.
                sources: strategy === 'Source Priority' ? sources : undefined,
              })
            }
          >
            Save
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Insured Name"
          error={collides ? 'Another attribute already uses this name.' : undefined}
          fullWidth
        />
        <Select
          label="Category"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          hint={
            categories.length === 0
              ? 'No categories defined yet — add them in the Categories section.'
              : undefined
          }
        >
          <option value="">— Select a category —</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <ChipInput
          label="Alias"
          hint="Alternate names this attribute is known by. Type and press Enter to add."
          chips={aliases}
          onChange={setAliases}
        />
        <Checkbox
          label="Include in duplicate check"
          checked={dupCheck}
          onChange={(e) => setDupCheck(e.target.checked)}
        />
        <div>
          <div className="lob-hier__field-label">Resolution Strategy</div>
          <div className="ream-process-grid" role="radiogroup" aria-label="Resolution strategy">
            {RN_RESOLUTION_STRATEGIES.map((s) => {
              const selected = strategy === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`ream-process-card${selected ? ' ream-process-card--selected' : ''}`}
                  onClick={() => setStrategy(s)}
                >
                  <span
                    className="ream-process-card__icon"
                    style={{
                      background: 'var(--slds-g-color-brand-base-95)',
                      color: 'var(--slds-g-color-accent-1)',
                    }}
                  >
                    <Icon name={STRATEGY_ICONS[s]} size={12} />
                  </span>
                  <span className="ream-process-card__body">
                    <span className="ream-process-card__title">{s}</span>
                    <span className="ream-process-card__sub">{STRATEGY_HINTS[s]}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {strategy === 'Source Priority' && (
          <SourcesTable lob={lob} sources={sources} onChange={setSources} />
        )}
      </div>
    </Modal>
  );
}

/* ── Source-priority table ───────────────────────────────────────── */

interface SourcesTableProps {
  lob: string;
  sources: RnAttributeSource[];
  onChange: (next: RnAttributeSource[]) => void;
}
export function SourcesTable({ lob, sources, onChange }: SourcesTableProps) {
  const { config } = useConfig();
  const dragIndex = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const enrichmentDefs = useMemo(() => {
    const all = config.enrichmentDefinitions;
    const scoped = all.filter(
      (d) =>
        d.lob === lob ||
        d.lob.toLowerCase().includes(lob.toLowerCase()) ||
        lob.toLowerCase().includes(d.lob.toLowerCase()),
    );
    return scoped.length > 0 ? scoped : all;
  }, [config.enrichmentDefinitions, lob]);

  const addSource = () => {
    onChange([
      ...sources,
      { id: nextSourceId(sources), type: 'Document' },
    ]);
  };

  const setSource = (id: number, patch: Partial<RnAttributeSource>) => {
    onChange(sources.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeSource = (id: number) => {
    onChange(sources.filter((s) => s.id !== id));
  };

  const onDrop = (target: number) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    setOverIndex(null);
    if (from == null || from === target) return;
    const next = sources.slice();
    const [moved] = next.splice(from, 1);
    next.splice(target, 0, moved);
    onChange(next);
  };

  return (
    <div className="lob-hier__sources">
      <div className="lob-hier__sources-head">
        <span className="lob-hier__col-label" style={{ padding: 0 }}>
          Source Priority
        </span>
        <button type="button" className="lob-hier__text-btn" onClick={addSource}>
          <Icon name="plus" size={12} />
          Add Source
        </button>
      </div>
      {sources.length === 0 ? (
        <div className="lob-hier__empty">
          No sources yet. Add sources in priority order — the first match wins.
        </div>
      ) : (
        <div className="lob-hier__src-table">
          <div className="lob-hier__src-row lob-hier__src-row--head">
            <span />
            <span>Source Type</span>
            <span>Source</span>
            <span />
          </div>
          {sources.map((s, i) => (
            <div
              key={s.id}
              className={[
                'lob-hier__src-row',
                overIndex === i ? 'lob-hier__src-row--over' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onDragOver={(e) => {
                e.preventDefault();
                setOverIndex(i);
              }}
              onDrop={() => onDrop(i)}
            >
              <button
                type="button"
                className="lob-hier__src-grip"
                aria-label="Drag to reorder"
                title="Drag to reorder"
                draggable
                onDragStart={() => {
                  dragIndex.current = i;
                }}
                onDragEnd={() => {
                  dragIndex.current = null;
                  setOverIndex(null);
                }}
              >
                <Icon name="grip" size={16} />
              </button>
              <Select
                value={s.type}
                aria-label="Source type"
                onChange={(e) =>
                  setSource(s.id, {
                    type: e.target.value as RnSourceType,
                    // Reset source-specific fields when the type changes.
                    docCategory: undefined,
                    docType: undefined,
                    enrichmentDefinitionId: undefined,
                    enrichmentDefinitionName: undefined,
                  })
                }
                options={RN_SOURCE_TYPES.map((t) => ({ value: t, label: t }))}
              />
              <div className="lob-hier__src-detail">
                {s.type === 'Document' ? (
                  <DocumentSource source={s} onChange={(patch) => setSource(s.id, patch)} />
                ) : s.type === 'Enrichment' ? (
                  <EnrichmentSourceCombo
                    defs={enrichmentDefs}
                    value={s.enrichmentDefinitionId ?? ''}
                    onChange={(id, label) =>
                      setSource(s.id, {
                        enrichmentDefinitionId: id,
                        enrichmentDefinitionName: label,
                      })
                    }
                  />
                ) : (
                  <span className="lob-hier__src-muted">
                    Uses the submitting email — no further selection.
                  </span>
                )}
              </div>
              <button
                type="button"
                className="lob-hier__icon-btn lob-hier__icon-btn--destructive"
                aria-label="Remove source"
                title="Remove source"
                onClick={() => removeSource(s.id)}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Document source — Doc Category + Doc Type, wired to Document
 * Classification's taxonomy. */
function DocumentSource({
  source,
  onChange,
}: {
  source: RnAttributeSource;
  onChange: (patch: Partial<RnAttributeSource>) => void;
}) {
  const { config } = useConfig();
  const taxonomy = config.documentTaxonomy ?? [];
  const category = taxonomy.find((c) => c.name === source.docCategory) ?? null;
  return (
    <div className="lob-hier__src-doc">
      <Select
        value={source.docCategory ?? ''}
        aria-label="Document category"
        onChange={(e) =>
          onChange({ docCategory: e.target.value || undefined, docType: undefined })
        }
      >
        <option value="">— Category —</option>
        {taxonomy.map((c) => (
          <option key={c.name} value={c.name}>
            {c.name}
          </option>
        ))}
      </Select>
      <Select
        value={source.docType ?? ''}
        aria-label="Document type"
        disabled={!category}
        onChange={(e) => onChange({ docType: e.target.value || undefined })}
      >
        <option value="">{category ? '— Type —' : 'Pick a category'}</option>
        {(category?.types ?? []).map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** Enrichment source — a definition picker styled like the Activity
 * "Process" selection combobox (portal menu, label + description rows). */
function EnrichmentSourceCombo({
  defs,
  value,
  onChange,
}: {
  defs: { id: number; name: string; lob: string; categoryName: string }[];
  value: string;
  onChange: (id: string, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    const place = () => {
      const t = triggerRef.current;
      if (!t) return;
      const r = t.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (ev: MouseEvent) => {
      const target = ev.target as Node;
      const inTrigger = ref.current?.contains(target) ?? false;
      const inMenu = menuRef.current?.contains(target) ?? false;
      if (!inTrigger && !inMenu) setOpen(false);
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

  const selected = defs.find((d) => String(d.id) === value) ?? null;

  return (
    <div className="ream-process-combo" ref={ref}>
      <button
        type="button"
        className="ream-process-combo__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={
            selected ? 'ream-process-combo__value' : 'ream-process-combo__placeholder'
          }
        >
          {selected ? selected.name : '— Select definition —'}
        </span>
        <Icon name="chevron-down" size={14} />
      </button>
      {open &&
        rect &&
        createPortal(
          <div
            className="ream-process-combo__menu"
            role="listbox"
            ref={menuRef}
            style={{
              position: 'fixed',
              top: rect.top,
              left: rect.left,
              width: rect.width,
              // Sit above the modal overlay (z-index 6000); the combo's own
              // CSS z-index (30) would otherwise hide it behind the modal.
              zIndex: 6100,
            }}
          >
            {defs.length === 0 && (
              <div className="ream-process-combo__empty">No enrichment definitions.</div>
            )}
            {defs.map((d) => {
              const isSel = String(d.id) === value;
              return (
                <div
                  key={d.id}
                  role="option"
                  aria-selected={isSel}
                  className={[
                    'ream-process-combo__option',
                    isSel ? 'ream-process-combo__option--selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    onChange(String(d.id), d.name);
                    setOpen(false);
                  }}
                >
                  <span className="ream-process-combo__option-body">
                    <span className="ream-process-combo__option-label">{d.name}</span>
                    <span className="ream-process-combo__option-desc">
                      {d.lob} · {d.categoryName}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

/* ── Chip input (alias list) ─────────────────────────────────────── */

interface ChipInputProps {
  label: string;
  hint?: string;
  chips: string[];
  onChange: (next: string[]) => void;
}
export function ChipInput({ label, hint, chips, onChange }: ChipInputProps) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    if (chips.some((c) => c.toLowerCase() === v.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...chips, v]);
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && draft === '' && chips.length > 0) {
      e.preventDefault();
      onChange(chips.slice(0, -1));
    }
  };

  return (
    <div className="rn-chip-field">
      <div className="rn-chip-field__label">{label}</div>
      <div className="rn-chip-field__box" onClick={() => inputRef.current?.focus()}>
        {chips.map((c, i) => (
          <span key={`${c}-${i}`} className="rn-chip">
            {c}
            <button
              type="button"
              className="rn-chip__remove"
              aria-label={`Remove ${c}`}
              title={`Remove ${c}`}
              onClick={(ev) => {
                ev.stopPropagation();
                onChange(chips.filter((_, idx) => idx !== i));
              }}
            >
              <Icon name="close" size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="rn-chip-field__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          placeholder={chips.length === 0 ? 'Type and press Enter…' : ''}
        />
      </div>
      {hint && <p className="rn-chip-field__hint">{hint}</p>}
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────── */

/** Bucket label for attributes with no (or a stale) category. */
const UNCATEGORIZED = 'Uncategorized';

function normalizeStrategy(s: RnResolutionStrategy | string | undefined): RnResolutionStrategy {
  return s && (RN_RESOLUTION_STRATEGIES as string[]).includes(s)
    ? (s as RnResolutionStrategy)
    : 'Most Common';
}

export const STRATEGY_ICONS: Record<RnResolutionStrategy, IconName> = {
  'Most Common': 'users',
  'Most Recent': 'trending-up',
  'Always Flag': 'shield',
  'Source Priority': 'layers',
};

export const STRATEGY_HINTS: Record<RnResolutionStrategy, string> = {
  'Most Common': 'Pick the value seen most often',
  'Most Recent': 'Pick the latest value',
  'Always Flag': 'Always send for review',
  'Source Priority': 'First matching source wins',
};

/** Resolve the LOB picklist label to an enrichment-config LOB (labels can
 * drift, e.g. "Property" vs "Commercial Property"). Mirrors the matcher in
 * LobEnrichmentFieldsSection. */
function resolveCategoryLob(target: string, available: string[]): string | null {
  if (available.length === 0) return null;
  const exact = available.find((l) => l === target);
  if (exact) return exact;
  const sub = available.find((l) => l.toLowerCase().includes(target.toLowerCase()));
  if (sub) return sub;
  return available.find((l) => target.toLowerCase().includes(l.toLowerCase())) ?? null;
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

function nextAttrId(attrs: RnHierarchyAttribute[]): number {
  return attrs.reduce((m, a) => Math.max(m, a.id ?? 0), 0) + 1;
}

function nextSourceId(sources: RnAttributeSource[]): number {
  return sources.reduce((m, s) => Math.max(m, s.id), 0) + 1;
}

function addChild(
  nodes: RnHierarchyNode[],
  parentId: number,
  child: RnHierarchyNode,
): RnHierarchyNode[] {
  return nodes.map((n) =>
    n.id === parentId
      ? { ...n, children: [...n.children, child] }
      : { ...n, children: addChild(n.children, parentId, child) },
  );
}

function removeNode(nodes: RnHierarchyNode[], id: number): RnHierarchyNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => ({ ...n, children: removeNode(n.children, id) }));
}

function mapNode(
  nodes: RnHierarchyNode[],
  id: number,
  fn: (n: RnHierarchyNode) => RnHierarchyNode,
): RnHierarchyNode[] {
  return nodes.map((n) =>
    n.id === id ? fn(n) : { ...n, children: mapNode(n.children, id, fn) },
  );
}
