import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dropdown, Icon } from '@/components/ui';
import type { EnrichmentAliasMapping, LineCoverageEntity } from '@/types/config';
import type { ServiceEndpoint } from '@/panels/IntegrationHub/providers';
import {
  buildTree,
  findNode,
  leafLabel,
  TreeRows,
} from './EnrichmentMappingStep';
import './EnrichmentMappingStep.css';
import './EnrichmentAliasStep.css';

interface Props {
  /** The endpoints chosen on the Endpoint step. The left column picks which
   * one's response shape drives the tree + attribute columns; aliases are
   * kept per endpoint. */
  endpoints: ServiceEndpoint[];
  /** Every line definition across LOBs — the alias targets. */
  entities: LineCoverageEntity[];
  /** LOB options for the target selector. */
  lobs: string[];
  /** LOB this definition belongs to — the default target LOB. */
  defaultLob: string;
  mappings: EnrichmentAliasMapping[];
  onChange: (next: EnrichmentAliasMapping[]) => void;
}

type FilterMode = 'all' | 'mapped' | 'unmapped';

/** Alias source paths are namespaced by endpoint id so each endpoint keeps
 * its own aliases; single-endpoint definitions fall back to bare paths. */
function nsPath(epId: string, path: string): string {
  return `${epId}::${path}`;
}

/**
 * Alias Creation. Same shape as Response Mapping — an endpoint-selector
 * column, a node tree, then attribute → canonical-attribute rows: each
 * incoming response attribute name is registered as an alias on a canonical
 * attribute of a line definition. The target is reached by picking a LOB, then
 * a split selector (line definition scope on the left, a category-grouped
 * canonical-attribute search on the right).
 */
export function EnrichmentAliasStep({
  endpoints,
  entities,
  lobs,
  defaultLob,
  mappings,
  onChange,
}: Props) {
  const [activeEndpointId, setActiveEndpointId] = useState<string>('');
  useEffect(() => {
    if (endpoints.length === 0) {
      if (activeEndpointId !== '') setActiveEndpointId('');
      return;
    }
    if (!endpoints.some((e) => e.id === activeEndpointId)) {
      setActiveEndpointId(endpoints[0].id);
    }
  }, [endpoints, activeEndpointId]);

  const activeEndpoint =
    endpoints.find((e) => e.id === activeEndpointId) ?? endpoints[0] ?? null;
  const epId = activeEndpoint?.id ?? '';
  const legacy = endpoints.length <= 1;
  // Store paths namespaced when multiple endpoints exist; keep them bare for a
  // single-endpoint definition so previously-saved aliases still resolve.
  const toStored = (path: string) => (legacy ? path : nsPath(epId, path));

  const tree = useMemo(
    () => buildTree(activeEndpoint?.responseBody),
    [activeEndpoint?.responseBody],
  );

  // An incoming attribute can be aliased onto multiple canonical terms, so
  // group the flat mapping list by its source path into an ordered list of
  // targets per attribute.
  const targetsBySource = useMemo(() => {
    const m = new Map<string, EnrichmentAliasMapping[]>();
    for (const row of mappings) {
      const list = m.get(row.sourcePath) ?? [];
      list.push(row);
      m.set(row.sourcePath, list);
    }
    return m;
  }, [mappings]);

  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [treeSearch, setTreeSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [fieldSearch, setFieldSearch] = useState('');
  // How many canonical-term rows to render per attribute. Grows when the user
  // clicks "+"; never shrinks below the number of stored targets (or 1).
  const [rowsWanted, setRowsWanted] = useState<Record<string, number>>({});

  useEffect(() => {
    if (tree) setSelectedNodeId(tree.id);
  }, [tree]);

  const selectedNode = useMemo(
    () => (tree ? findNode(tree, selectedNodeId) ?? tree : null),
    [tree, selectedNodeId],
  );

  const leafMapped = (path: string) => targetsBySource.has(toStored(path));

  // Replace the target at `targetIdx` for `sourcePath`. Passing null removes
  // that one target row (keeping the others) while leaving at least the empty
  // slot the user is editing.
  const setMapping = (
    barePath: string,
    targetIdx: number,
    next: { lob: string; entityId: number; attributeId: number } | null,
  ) => {
    const sourcePath = toStored(barePath);
    const current = mappings.filter((m) => m.sourcePath === sourcePath);
    const others = mappings.filter((m) => m.sourcePath !== sourcePath);
    const updated = current.slice();
    if (!next) {
      updated.splice(targetIdx, 1);
    } else {
      const row: EnrichmentAliasMapping = { sourcePath, ...next };
      if (targetIdx >= updated.length) updated.push(row);
      else updated[targetIdx] = row;
    }
    // Preserve original ordering: rebuild by walking the source list and
    // splicing this attribute's updated targets back where it first appeared.
    const firstIdx = mappings.findIndex((m) => m.sourcePath === sourcePath);
    if (firstIdx === -1) {
      onChange([...others, ...updated]);
      return;
    }
    const next2: EnrichmentAliasMapping[] = [];
    let inserted = false;
    for (const m of mappings) {
      if (m.sourcePath === sourcePath) {
        if (!inserted) {
          next2.push(...updated);
          inserted = true;
        }
      } else {
        next2.push(m);
      }
    }
    if (!inserted) next2.push(...updated);
    onChange(next2);
  };

  const addTargetRow = (sourcePath: string, currentRows: number) =>
    setRowsWanted((p) => ({ ...p, [sourcePath]: currentRows + 1 }));

  const removeTargetRow = (
    sourcePath: string,
    targetIdx: number,
    currentRows: number,
  ) => {
    setMapping(sourcePath, targetIdx, null);
    setRowsWanted((p) => ({ ...p, [sourcePath]: Math.max(currentRows - 1, 1) }));
  };

  const endpointColumn = (
    <aside className="emap__endpoints" aria-label="Endpoints">
      <div className="emap__tree-head">Endpoint</div>
      <div className="emap__endpoint-list">
        {endpoints.length === 0 ? (
          <div className="emap__endpoint-empty">
            No endpoints selected on the Endpoint step.
          </div>
        ) : (
          endpoints.map((ep) => {
            const active = ep.id === epId;
            return (
              <button
                key={ep.id}
                type="button"
                className={`emap__endpoint${active ? ' emap__endpoint--active' : ''}`}
                onClick={() => setActiveEndpointId(ep.id)}
                aria-pressed={active}
              >
                <span className={`cw-method cw-method--${ep.method.toLowerCase()}`}>
                  {ep.method}
                </span>
                <span className="emap__endpoint-name">{ep.name}</span>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );

  if (!tree) {
    return (
      <div className="emap emap--alias emap--with-endpoints">
        {endpointColumn}
        <div className="emap__empty" style={{ gridColumn: '2 / -1' }}>
          {activeEndpoint
            ? 'The selected endpoint has no response fields to alias.'
            : 'Select an endpoint on the Endpoint step to alias its response fields.'}
        </div>
      </div>
    );
  }

  const nodeLeaves = selectedNode?.leaves ?? [];
  const totalCount = nodeLeaves.length;
  const mappedCount = nodeLeaves.filter(leafMapped).length;

  const nodeFields = nodeLeaves.filter((f) => {
    const mapped = leafMapped(f);
    if (filter === 'mapped' && !mapped) return false;
    if (filter === 'unmapped' && mapped) return false;
    if (
      fieldSearch &&
      !leafLabel(f).toLowerCase().includes(fieldSearch.toLowerCase()) &&
      !f.toLowerCase().includes(fieldSearch.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="emap emap--alias emap--with-endpoints">
      {/* ── Column 0: endpoint selector ─────────────────────────────── */}
      {endpointColumn}

      {/* ── Column 1: node tree ─────────────────────────────────────── */}
      <aside className="emap__tree" aria-label="Response structure">
        <div className="emap__tree-head">Node</div>
        <div className="emap__search">
          <Icon name="search" size={14} />
          <input
            className="emap__search-input"
            value={treeSearch}
            placeholder="Search…"
            onChange={(e) => setTreeSearch(e.target.value)}
          />
        </div>
        <div className="emap__tree-body">
          <TreeRows
            node={tree}
            depth={0}
            search={treeSearch.trim().toLowerCase()}
            expanded={expanded}
            selectedId={selectedNodeId}
            isLeafMapped={leafMapped}
            onToggle={(id) =>
              setExpanded((p) => ({ ...p, [id]: !(p[id] ?? true) }))
            }
            onSelect={setSelectedNodeId}
          />
        </div>
      </aside>

      {/* ── Columns 2 + 3: attribute → canonical attribute ──────────── */}
      <section className="emap__detail" aria-label="Alias creation">
        <header className="emap__detail-head">
          <span className="emap__detail-icon">
            <Icon name="anchor" size={16} />
          </span>
          <h4 className="emap__detail-title">
            {selectedNode?.id ? selectedNode.label : 'Response'}
          </h4>
          <span className="emap__detail-path">{selectedNode?.id || 'root'}</span>
        </header>

        <div className="emap__toolbar">
          <div className="emap__chips" role="group" aria-label="Filter">
            <button
              type="button"
              className={`emap__chip${filter === 'all' ? ' emap__chip--active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({totalCount})
            </button>
            <button
              type="button"
              className={`emap__chip${filter === 'mapped' ? ' emap__chip--active' : ''}`}
              onClick={() => setFilter('mapped')}
            >
              Aliased ({mappedCount})
            </button>
            <button
              type="button"
              className={`emap__chip${filter === 'unmapped' ? ' emap__chip--active' : ''}`}
              onClick={() => setFilter('unmapped')}
            >
              Unaliased ({totalCount - mappedCount})
            </button>
          </div>
          <div className="emap__search emap__search--inline">
            <Icon name="search" size={14} />
            <input
              className="emap__search-input"
              value={fieldSearch}
              placeholder="Search…"
              onChange={(e) => setFieldSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="emap__cols-head">
          <span>Attribute</span>
          <span />
          <span>Add As Alias To</span>
        </div>

        <div className="emap__rows">
          {nodeFields.length === 0 ? (
            <div className="emap__empty">
              {nodeLeaves.length
                ? 'No fields match the current filter.'
                : 'This node has no direct fields — pick a child node.'}
            </div>
          ) : (
            nodeFields.map((f) => {
              const targets = targetsBySource.get(toStored(f)) ?? [];
              // Render one row per stored target; "+" adds an extra empty slot
              // via rowsWanted. Always keep at least one row, and let empty
              // rows be removed back down to that single remaining row.
              const rowCount = Math.max(
                targets.length,
                rowsWanted[f] ?? 1,
                1,
              );
              return (
                <div className="emap-attr" key={f}>
                  {Array.from({ length: rowCount }).map((_, ti) => {
                    const isLast = ti === rowCount - 1;
                    return (
                      <div className="emap-row" key={ti}>
                        <div
                          className={`emap-row__attr${ti === 0 ? '' : ' emap-row__attr--empty'}`}
                        >
                          {ti === 0 ? (
                            <>
                              <span className="emap-row__attr-icon">Aa</span>
                              <span className="emap-row__attr-main">
                                <span className="emap-row__attr-name" title={f}>
                                  {leafLabel(f)}
                                </span>
                                <span className="emap-row__attr-qual">
                                  Attribute Name
                                </span>
                              </span>
                            </>
                          ) : (
                            <span className="ealias-row__cont" aria-hidden="true" />
                          )}
                        </div>
                        <div className="emap-row__arrow">
                          <Icon name="arrow-up" size={14} />
                        </div>
                        <div className="emap-row__editor ealias-row__editor">
                          <AliasPicker
                            value={targets[ti] ?? null}
                            entities={entities}
                            lobs={lobs}
                            defaultLob={defaultLob}
                            ariaLabel={`Alias ${leafLabel(f)} to a canonical attribute`}
                            onChange={(next) => setMapping(f, ti, next)}
                          />
                          <div className="ealias-row__controls">
                            {rowCount > 1 && (
                              <button
                                type="button"
                                className="ealias-iconbtn"
                                aria-label="Remove canonical attribute"
                                title="Remove canonical attribute"
                                onClick={() => removeTargetRow(f, ti, rowCount)}
                              >
                                <Icon name="close" size={14} />
                              </button>
                            )}
                            {isLast && (
                              <button
                                type="button"
                                className="ealias-iconbtn"
                                aria-label="Add another canonical term"
                                title="Add another canonical term"
                                onClick={() => addTargetRow(f, rowCount)}
                              >
                                <Icon name="plus" size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

/* ── Alias picker — LOB dropdown + line-definition-scoped attribute search ─ */

const ALL_SCOPE = '__all__';

interface AliasValue {
  lob: string;
  entityId: number;
  attributeId: number;
}

interface AliasPickerProps {
  value: EnrichmentAliasMapping | null;
  entities: LineCoverageEntity[];
  lobs: string[];
  defaultLob: string;
  ariaLabel: string;
  onChange: (next: AliasValue | null) => void;
}

/**
 * Resolves the alias target to display labels. The line definition (entity)
 * is the scope; the canonical attribute is the picked value.
 */
function describe(
  value: EnrichmentAliasMapping | null,
  entities: LineCoverageEntity[],
): { entityLabel: string; attrLabel: string } | null {
  if (!value) return null;
  const entity = entities.find((e) => e.id === value.entityId);
  if (!entity) return null;
  const attr = entity.attributes.find((a) => a.id === value.attributeId);
  if (!attr) return null;
  return { entityLabel: entity.label, attrLabel: attr.label || 'Untitled' };
}

function AliasPicker({
  value,
  entities,
  lobs,
  defaultLob,
  ariaLabel,
  onChange,
}: AliasPickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lob, setLob] = useState<string>(value?.lob ?? defaultLob);
  const [scope, setScope] = useState<string>(
    value ? String(value.entityId) : ALL_SCOPE,
  );
  const [query, setQuery] = useState('');
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );

  const selected = useMemo(() => describe(value, entities), [value, entities]);

  // Track an externally-set value (edit mode) into the LOB + scope state so
  // reopening lands on the right line definition.
  useEffect(() => {
    if (value) {
      setLob(value.lob);
      setScope(String(value.entityId));
    }
  }, [value]);

  // Line definitions in the chosen LOB — the scope options.
  const lobEntities = useMemo(
    () =>
      entities
        .filter((e) => e.lob === lob)
        .slice()
        .sort((a, b) => a.label.localeCompare(b.label)),
    [entities, lob],
  );

  const open = scopeOpen || menuOpen;

  useEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    const place = () => {
      const t = rootRef.current;
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
      const inRoot = rootRef.current?.contains(target) ?? false;
      const inMenu = menuRef.current?.contains(target) ?? false;
      if (!inRoot && !inMenu) {
        setScopeOpen(false);
        setMenuOpen(false);
      }
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setScopeOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Canonical attributes in scope, grouped by their attribute category. When
  // no line definition is scoped, every definition in the LOB contributes and
  // each option carries its line-definition name to disambiguate.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const inScope = lobEntities.filter(
      (e) => scope === ALL_SCOPE || String(e.id) === scope,
    );
    const showEntity = scope === ALL_SCOPE;
    const byCategory = new Map<
      string,
      { entityId: number; entityLabel: string; attributeId: number; label: string }[]
    >();
    for (const e of inScope) {
      for (const a of e.attributes) {
        if (q && !(a.label || '').toLowerCase().includes(q)) continue;
        const cat = a.category?.trim() || 'Uncategorized';
        const list = byCategory.get(cat) ?? [];
        list.push({
          entityId: e.id,
          entityLabel: e.label,
          attributeId: a.id,
          label: a.label || 'Untitled',
        });
        byCategory.set(cat, list);
      }
    }
    return { showEntity, entries: Array.from(byCategory.entries()) };
  }, [lobEntities, scope, query]);

  const pick = (entityId: number, attributeId: number) => {
    onChange({ lob, entityId, attributeId });
    setMenuOpen(false);
    setScopeOpen(false);
    setQuery('');
  };

  const changeLob = (nextLob: string) => {
    setLob(nextLob);
    setScope(ALL_SCOPE);
    setQuery('');
    if (value) onChange(null);
  };

  const scopeEntity = lobEntities.find((e) => String(e.id) === scope) ?? null;
  const scopeLabel = scope === ALL_SCOPE ? 'Select' : scopeEntity?.label ?? 'Select';

  return (
    <div className="ealias-editor">
      <Dropdown
        value={lob}
        onChange={changeLob}
        aria-label="Target line of business"
        placeholder="Select LOB"
        options={lobs.map((l) => ({ value: l, label: l }))}
        fullWidth
      />

      <div className="emap-fp" ref={rootRef}>
        <button
          type="button"
          className="emap-fp__scope"
          aria-haspopup="listbox"
          aria-expanded={scopeOpen}
          onClick={() => {
            setScopeOpen((v) => !v);
            setMenuOpen(false);
          }}
          title={scopeLabel}
        >
          <span className="emap-fp__scope-label">{scopeLabel}</span>
          <Icon name="chevron-down" size={12} />
        </button>
        <div className="emap-fp__search">
          <input
            className="emap-fp__search-input"
            value={menuOpen ? query : selected ? selected.attrLabel : ''}
            placeholder="Search…"
            aria-label={ariaLabel}
            onFocus={() => {
              setMenuOpen(true);
              setScopeOpen(false);
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setMenuOpen(true);
            }}
          />
          {selected && !menuOpen ? (
            <button
              type="button"
              className="emap-fp__clear"
              aria-label="Clear alias target"
              title="Clear"
              onClick={() => {
                onChange(null);
                setQuery('');
                setScope(ALL_SCOPE);
              }}
            >
              <Icon name="close" size={14} />
            </button>
          ) : (
            <Icon name="search" size={14} />
          )}
        </div>

        {open &&
          rect &&
          createPortal(
            <div
              className="emap-fp__menu"
              role="listbox"
              ref={menuRef}
              style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width }}
            >
              {scopeOpen ? (
                <div className="emap-fp__group">
                  <button
                    type="button"
                    role="option"
                    aria-selected={scope === ALL_SCOPE}
                    className={`emap-fp__option${scope === ALL_SCOPE ? ' emap-fp__option--selected' : ''}`}
                    onClick={() => {
                      setScope(ALL_SCOPE);
                      setScopeOpen(false);
                      setMenuOpen(true);
                    }}
                  >
                    <span>All line definitions</span>
                    {scope === ALL_SCOPE && <Icon name="check" size={12} />}
                  </button>
                  {lobEntities.length === 0 ? (
                    <div className="emap-fp__empty">
                      No line definitions for {lob}.
                    </div>
                  ) : (
                    lobEntities.map((e) => {
                      const isSel = String(e.id) === scope;
                      return (
                        <button
                          key={e.id}
                          type="button"
                          role="option"
                          aria-selected={isSel}
                          className={`emap-fp__option${isSel ? ' emap-fp__option--selected' : ''}`}
                          onClick={() => {
                            setScope(String(e.id));
                            setScopeOpen(false);
                            setMenuOpen(true);
                          }}
                        >
                          <span className="ealias-line-opt">
                            <span className="ealias-line-opt__name">{e.label}</span>
                            <span className="ealias-line-opt__type">{e.kind}</span>
                          </span>
                          {isSel && <Icon name="check" size={12} />}
                        </button>
                      );
                    })
                  )}
                </div>
              ) : groups.entries.length === 0 ? (
                <div className="emap-fp__empty">
                  {lobEntities.length === 0
                    ? `No line definitions for ${lob}.`
                    : `No canonical attributes match “${query}”.`}
                </div>
              ) : (
                groups.entries.map(([cat, items]) => (
                  <div key={cat} className="emap-fp__group">
                    <div className="emap-fp__group-label">{cat}</div>
                    {items.map((it) => {
                      const isSel =
                        value?.entityId === it.entityId &&
                        value?.attributeId === it.attributeId;
                      return (
                        <button
                          key={`${it.entityId}:${it.attributeId}`}
                          type="button"
                          role="option"
                          aria-selected={isSel}
                          className={`emap-fp__option${isSel ? ' emap-fp__option--selected' : ''}`}
                          onClick={() => pick(it.entityId, it.attributeId)}
                        >
                          <span className="emap-fp__option-label">
                            {it.label}
                            {groups.showEntity && (
                              <span className="ealias-opt-qual"> · {it.entityLabel}</span>
                            )}
                          </span>
                          {isSel && <Icon name="check" size={12} />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>,
            document.body,
          )}
      </div>
    </div>
  );
}
