import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dropdown, Icon } from '@/components/ui';
import type { EnrichmentFieldMapping } from '@/types/config';
import type { JsonSchema, ServiceEndpoint } from '@/panels/IntegrationHub/providers';
import './EnrichmentMappingStep.css';

/** Apex classes available to map an enrichment response in code, in lieu of
 * the visual Field Mapper table. Curated catalog, mirroring the Routing Rules
 * default-queue picker's fixed list. */
const APEX_CLASSES = [
  'PropertyEnrichmentMapper',
  'CasualtyEnrichmentMapper',
  'GenericResponseMapper',
  'CatModelResponseMapper',
  'GeocodeResponseMapper',
  'FinancialDataMapper',
];

export type MappingMode = 'fieldMapper' | 'apexClass';

interface TargetField {
  value: string;
  label: string;
}
interface TargetObject {
  label: string;
  options: TargetField[];
}

/**
 * Target objects an incoming attribute can map onto. Each incoming response
 * field can be mapped to a field on one of these Underwriting Submission
 * objects. The Field picker scopes by object, then searches within it.
 */
const TARGET_OBJECTS: TargetObject[] = [
  {
    label: 'Underwriting Submission',
    options: [
      'Name',
      'Category',
      'Stage',
      'OpportunityId',
      'LeadId',
      'ProducerId',
      'ProducerContactId',
      'AssignedUnderwriter',
      'PriorSubmission',
      'StatusOfTransaction',
      'SubmissionDate',
      'ReceivedChannel',
      'BrokerCode',
      'BrokerSubcode',
      'CarrierAccountId',
      'CarrierNAICCode',
      'ProposedEffectiveDate',
      'ProposedExpirationDate',
      'NatureOfBusiness',
      'NatureOfBusinessDescription',
      'PriorPolicy',
      'Priority',
      'Origin',
    ].map((f) => ({ value: `UnderwritingSubmission.${f}`, label: f })),
  },
  {
    label: 'Underwriting Submission LineItem',
    options: [
      'UnderwritingSubmission',
      'LineOfBusiness',
      'LineType',
      'ProductId',
      'ParentLineItem',
      'Status',
      'AssignedUnderwriter',
      'RequestedDeductible',
      'CoverageRequested',
      'RequestedLimit',
    ].map((f) => ({ value: `UnderwritingSubmissionLineItem.${f}`, label: f })),
  },
  {
    label: 'Submission LineItem Attribute (Raw)',
    options: [
      'SubmissionId',
      'SubmissionLineId',
      'AttributeName',
      'AttributeValue',
      'SourceDocument',
      'SourceDocumentContext',
      'ManualAttributeValue',
      'Source',
      'AttributeDataType',
      'ConfidenceScore',
      'ReasoningTrace',
    ].map((f) => ({
      value: `SubmissionLineItemAttributeRaw.${f}`,
      label: f,
    })),
  },
];

/** Which side of the endpoint contract the step maps: the request body
 * (inputs the definition sends) or the response body (fields it reads). */
export type MappingDirection = 'request' | 'response';

interface Props {
  /** The endpoints chosen on the Endpoint step. The left column lets the
   * user pick which one's fields the tree + rows currently show; mappings
   * are kept per endpoint. */
  endpoints: ServiceEndpoint[];
  /** Request Mapping (endpoint inputs) or Response Mapping (endpoint outputs). */
  direction: MappingDirection;
  mappings: EnrichmentFieldMapping[];
  onChange: (next: EnrichmentFieldMapping[]) => void;
  /** How the response is mapped: the visual Field Mapper table, or a single
   * Apex class. Response direction only. */
  mode?: MappingMode;
  onModeChange?: (mode: MappingMode) => void;
  /** Apex class chosen when `mode === 'apexClass'`. */
  apexClass?: string;
  onApexClassChange?: (value: string) => void;
}

/** A container node in the response tree — an object level that owns its
 * direct leaf fields plus any nested object children. */
export interface TreeNode {
  id: string;
  label: string;
  leaves: string[];
  children: TreeNode[];
}

type FilterMode = 'all' | 'mapped' | 'unmapped';

/**
 * Request / Response mapping. Columns:
 *   0. Endpoint  — the endpoints picked on the Endpoint step; selecting one
 *                  swaps the tree + rows to that endpoint's own fields, and
 *                  each endpoint keeps its own mappings.
 *   1. Tree      — the request/response JSON structure (objects as nodes,
 *                  with a mapped/total count per subtree).
 *   2. Attribute — each field under the selected node.
 *   3. Field     — the object field it maps to.
 *
 * Response direction splits each response leaf into an Attribute Name + an
 * Attribute Value row; Request direction is a single row per input field.
 */
export function EnrichmentMappingStep({
  endpoints,
  direction,
  mappings,
  onChange,
  mode = 'fieldMapper',
  onModeChange,
  apexClass = '',
  onApexClassChange,
}: Props) {
  const isResponse = direction === 'response';

  const [activeEndpointId, setActiveEndpointId] = useState<string>('');
  // Keep the active endpoint valid as the selection set changes.
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

  const tree = useMemo(
    () =>
      buildTree(
        isResponse ? activeEndpoint?.responseBody : activeEndpoint?.requestBody,
      ),
    [isResponse, activeEndpoint?.responseBody, activeEndpoint?.requestBody],
  );

  const mapByName = useMemo(
    () => new Map(mappings.map((m) => [m.fieldName, m.apiPath])),
    [mappings],
  );

  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [treeSearch, setTreeSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [fieldSearch, setFieldSearch] = useState('');

  // Default the selection to the root node once the tree is known.
  useEffect(() => {
    if (tree) setSelectedNodeId(tree.id);
  }, [tree]);

  const selectedNode = useMemo(
    () => (tree ? findNode(tree, selectedNodeId) ?? tree : null),
    [tree, selectedNodeId],
  );

  const setAttribute = (fieldName: string, value: string) => {
    const idx = mappings.findIndex((m) => m.fieldName === fieldName);
    if (idx === -1) {
      onChange([...mappings, { fieldName, apiPath: value }]);
      return;
    }
    const next = mappings.slice();
    next[idx] = { ...next[idx], apiPath: value };
    onChange(next);
  };

  // Per-endpoint value lookups. Single-endpoint definitions fall back to the
  // legacy un-namespaced keys so previously-saved mappings still surface.
  const legacy = endpoints.length <= 1;
  const reqVal = (f: string) =>
    mapByName.get(reqKey(epId, f)) ?? (legacy ? mapByName.get(f) ?? '' : '');
  const nameVal = (f: string) =>
    mapByName.get(nameKey(epId, f)) ??
    (legacy ? mapByName.get(`${f}::name`) ?? '' : '');
  const valueVal = (f: string) =>
    mapByName.get(valueKey(epId, f)) ??
    (legacy ? mapByName.get(`${f}::value`) ?? mapByName.get(f) ?? '' : '');

  const modeBar = isResponse ? (
    <div className="emap-mode">
      <span className="emap-mode__label">Map using</span>
      <div className="emap-mode__toggle" role="group" aria-label="Mapping method">
        <button
          type="button"
          className={`emap-mode__opt${mode === 'fieldMapper' ? ' emap-mode__opt--active' : ''}`}
          onClick={() => onModeChange?.('fieldMapper')}
        >
          Field Mapper
        </button>
        <button
          type="button"
          className={`emap-mode__opt${mode === 'apexClass' ? ' emap-mode__opt--active' : ''}`}
          onClick={() => onModeChange?.('apexClass')}
        >
          Apex Class
        </button>
      </div>
    </div>
  ) : null;

  if (isResponse && mode === 'apexClass') {
    return (
      <div className="emap-step">
        {modeBar}
        <div className="emap-apex">
          <label className="emap-apex__label" htmlFor="emap-apex-class">
            Apex Class
          </label>
          <Dropdown
            value={apexClass}
            onChange={(v) => onApexClassChange?.(v)}
            placeholder="Select an Apex class"
            aria-label="Apex class"
            options={APEX_CLASSES.map((c) => ({ value: c, label: c }))}
            fullWidth={false}
          />
          <p className="emap-apex__hint">
            The selected Apex class maps the endpoint response to enrichment
            fields in code. No field-level mapping table is needed.
          </p>
        </div>
      </div>
    );
  }

  const rootLabel = isResponse ? 'Response' : 'Request';
  const nounPlural = isResponse ? 'response fields' : 'request fields';

  const endpointColumn = (
    <aside className="emap__endpoints" aria-label="Endpoints">
      <div className="emap__tree-head">Endpoint</div>
      <div className="emap__endpoint-list">
        {endpoints.length === 0 ? (
          <div className="emap__endpoint-empty">
            No endpoints selected on the previous step.
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
      <div className="emap-step">
        {modeBar}
        <div className="emap emap--with-endpoints">
          {endpointColumn}
          <div className="emap__empty" style={{ gridColumn: '2 / -1' }}>
            {activeEndpoint
              ? `The selected endpoint has no ${nounPlural} to map.`
              : `Select an endpoint on the previous step to map its ${nounPlural}.`}
          </div>
        </div>
      </div>
    );
  }

  // A leaf is mapped when its slot(s) point at a field — both name and value
  // for a response leaf, or the single source for a request leaf.
  const leafMapped = (f: string) =>
    isResponse
      ? nameVal(f).trim().length > 0 && valueVal(f).trim().length > 0
      : reqVal(f).trim().length > 0;

  // Filter the attribute column by the mapped/unmapped chips + local search.
  const nodeFields = (selectedNode?.leaves ?? []).filter((f) => {
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

  // Counts scope to the selected node's own fields (the level being shown),
  // not the whole tree — and the chips double as filters over those rows.
  const nodeLeaves = selectedNode?.leaves ?? [];
  const totalCount = nodeLeaves.length;
  const mappedCount = nodeLeaves.filter(leafMapped).length;

  return (
    <div className="emap-step">
      {modeBar}
      <div className="emap emap--with-endpoints">
      {/* ── Column 0: endpoint selector ─────────────────────────────── */}
      {endpointColumn}

      {/* ── Column 1: node tree ─────────────────────────────────────── */}
      <aside className="emap__tree" aria-label={`${rootLabel} structure`}>
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

      {/* ── Columns 2 + 3: attribute → field ────────────────────────── */}
      <section className="emap__detail" aria-label={`${rootLabel} mapping`}>
        <header className="emap__detail-head">
          <span className="emap__detail-icon">
            <Icon name="workflow" size={16} />
          </span>
          <h4 className="emap__detail-title">
            {selectedNode?.id ? selectedNode.label : rootLabel}
          </h4>
          <span className="emap__detail-path">
            {selectedNode?.id || 'root'}
          </span>
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
              Mapped ({mappedCount})
            </button>
            <button
              type="button"
              className={`emap__chip${filter === 'unmapped' ? ' emap__chip--active' : ''}`}
              onClick={() => setFilter('unmapped')}
            >
              Unmapped ({totalCount - mappedCount})
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
          <span>{isResponse ? 'Attribute' : 'Request Field'}</span>
          <span />
          <span>{isResponse ? 'Field' : 'Maps From'}</span>
        </div>

        <div className="emap__rows">
          {nodeFields.length === 0 ? (
            <div className="emap__empty">
              {selectedNode?.leaves.length
                ? 'No fields match the current filter.'
                : 'This node has no direct fields — pick a child node.'}
            </div>
          ) : isResponse ? (
            nodeFields.map((f) => (
              <div className="emap-attr" key={f}>
                <div className="emap-row">
                  <div className="emap-row__attr">
                    <span className="emap-row__attr-icon">Aa</span>
                    <span className="emap-row__attr-main">
                      <span className="emap-row__attr-name" title={f}>
                        {leafLabel(f)}
                      </span>
                      <span className="emap-row__attr-qual">Attribute Name</span>
                    </span>
                  </div>
                  <div className="emap-row__arrow">
                    <Icon name="arrow-up" size={14} />
                  </div>
                  <div className="emap-row__editor">
                    <FieldPicker
                      value={nameVal(f)}
                      ariaLabel={`Map ${leafLabel(f)} attribute name to a field`}
                      onChange={(v) => setAttribute(nameKey(epId, f), v)}
                    />
                  </div>
                </div>
                <div className="emap-row emap-row--sub">
                  <div className="emap-row__attr emap-row__attr--sub">
                    <span className="emap-row__connector" aria-hidden="true" />
                    <span className="emap-row__attr-main">
                      <span className="emap-row__attr-name" title={f}>
                        {leafLabel(f)}
                      </span>
                      <span className="emap-row__attr-qual">Attribute Value</span>
                    </span>
                  </div>
                  <div className="emap-row__arrow">
                    <Icon name="arrow-up" size={14} />
                  </div>
                  <div className="emap-row__editor">
                    <FieldPicker
                      value={valueVal(f)}
                      ariaLabel={`Map ${leafLabel(f)} attribute value to a field`}
                      onChange={(v) => setAttribute(valueKey(epId, f), v)}
                    />
                  </div>
                </div>
              </div>
            ))
          ) : (
            nodeFields.map((f) => (
              <div className="emap-attr" key={f}>
                <div className="emap-row">
                  <div className="emap-row__attr">
                    <span className="emap-row__attr-icon">Aa</span>
                    <span className="emap-row__attr-main">
                      <span className="emap-row__attr-name" title={f}>
                        {leafLabel(f)}
                      </span>
                      <span className="emap-row__attr-qual">Request Field</span>
                    </span>
                  </div>
                  <div className="emap-row__arrow">
                    <Icon name="arrow-up" size={14} />
                  </div>
                  <div className="emap-row__editor">
                    <FieldPicker
                      value={reqVal(f)}
                      ariaLabel={`Source ${leafLabel(f)} request field from a field`}
                      onChange={(v) => setAttribute(reqKey(epId, f), v)}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
      </div>
    </div>
  );
}

/* ── Field picker — SLDS search-with-scope combobox ────────────────── */

const ALL_SCOPE = '__all__';

/** Look up the object + field labels for a stored `Object.Field` value. */
function describeValue(value: string): { object: string; field: string } | null {
  for (const obj of TARGET_OBJECTS) {
    const hit = obj.options.find((o) => o.value === value);
    if (hit) return { object: obj.label, field: hit.label };
  }
  return null;
}

interface FieldPickerProps {
  value: string;
  ariaLabel: string;
  onChange: (value: string) => void;
}

/**
 * Salesforce search-with-scope control: a scope selector (the target Object,
 * or "All") joined to a search field that filters the fields within scope.
 * Opening either segment shows the matching fields grouped by object; picking
 * one stores its `Object.Field` value.
 */
function FieldPicker({ value, ariaLabel, onChange }: FieldPickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scope, setScope] = useState<string>(ALL_SCOPE);
  const [query, setQuery] = useState('');
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );

  const selected = useMemo(() => describeValue(value), [value]);

  // Default the scope to the selected value's object so reopening lands there.
  useEffect(() => {
    if (selected) setScope(selected.object);
  }, [selected]);

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

  // Objects in scope, each carrying only the fields matching the query.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TARGET_OBJECTS.filter(
      (obj) => scope === ALL_SCOPE || obj.label === scope,
    )
      .map((obj) => ({
        label: obj.label,
        options: obj.options.filter((o) => o.label.toLowerCase().includes(q)),
      }))
      .filter((obj) => obj.options.length > 0);
  }, [scope, query]);

  const pick = (v: string) => {
    onChange(v);
    setMenuOpen(false);
    setScopeOpen(false);
    setQuery('');
  };

  const scopeLabel = scope === ALL_SCOPE ? 'Select' : scope;

  return (
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
          value={menuOpen ? query : selected ? selected.field : ''}
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
            aria-label="Clear selected field"
            title="Clear"
            onClick={() => {
              onChange('');
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
                  <span>All Objects</span>
                  {scope === ALL_SCOPE && <Icon name="check" size={12} />}
                </button>
                {TARGET_OBJECTS.map((obj) => (
                  <button
                    key={obj.label}
                    type="button"
                    role="option"
                    aria-selected={scope === obj.label}
                    className={`emap-fp__option${scope === obj.label ? ' emap-fp__option--selected' : ''}`}
                    onClick={() => {
                      setScope(obj.label);
                      setScopeOpen(false);
                      setMenuOpen(true);
                    }}
                  >
                    <span>{obj.label}</span>
                    {scope === obj.label && <Icon name="check" size={12} />}
                  </button>
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="emap-fp__empty">No fields match “{query}”.</div>
            ) : (
              results.map((obj) => (
                <div key={obj.label} className="emap-fp__group">
                  <div className="emap-fp__group-label">{obj.label}</div>
                  {obj.options.map((o) => {
                    const isSel = o.value === value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        role="option"
                        aria-selected={isSel}
                        className={`emap-fp__option${isSel ? ' emap-fp__option--selected' : ''}`}
                        onClick={() => pick(o.value)}
                      >
                        <span className="emap-fp__option-label">{o.label}</span>
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
  );
}

/* ── Tree column rows (recursive) ──────────────────────────────────── */

export interface TreeRowsProps {
  node: TreeNode;
  depth: number;
  search: string;
  expanded: Record<string, boolean>;
  selectedId: string;
  /** True when the given leaf path is considered mapped — drives the
   * per-node (mapped/total) count. */
  isLeafMapped: (leaf: string) => boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}

export function TreeRows({
  node,
  depth,
  search,
  expanded,
  selectedId,
  isLeafMapped,
  onToggle,
  onSelect,
}: TreeRowsProps) {
  if (search && !nodeMatches(node, search)) return null;

  const leaves = subtreeLeaves(node);
  const mapped = leaves.filter(isLeafMapped).length;
  const hasChildren = node.children.length > 0;
  const isOpen = expanded[node.id] ?? true;

  return (
    <>
      <div
        className={`emap-node${selectedId === node.id ? ' emap-node--selected' : ''}`}
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        <button
          type="button"
          className="emap-node__twist"
          onClick={() => hasChildren && onToggle(node.id)}
          aria-label={isOpen ? 'Collapse' : 'Expand'}
          disabled={!hasChildren}
        >
          {hasChildren && (
            <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={12} />
          )}
        </button>
        <button
          type="button"
          className="emap-node__label"
          onClick={() => onSelect(node.id)}
        >
          <span className="emap-node__name">
            {node.id ? node.label : 'Response'}
          </span>
          <span className="emap-node__count">
            ({mapped}/{leaves.length})
          </span>
        </button>
      </div>
      {hasChildren &&
        isOpen &&
        node.children.map((child) => (
          <TreeRows
            key={child.id}
            node={child}
            depth={depth + 1}
            search={search}
            expanded={expanded}
            selectedId={selectedId}
            isLeafMapped={isLeafMapped}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}

/* ── Schema → tree helpers ─────────────────────────────────────────── */

/** Walk a JSON Schema of the response body into a tree of object nodes.
 * Nested object schemas become child nodes; arrays of objects flatten
 * through their `items` schema with a `[]` marker; scalars (and scalar
 * arrays) become leaves. Returns null when the schema isn't an object. */
export function buildTree(schema?: JsonSchema): TreeNode | null {
  if (!schema || schema.type !== 'object' || !schema.properties) return null;
  return buildNode(schema, '', 'Response');
}

function buildNode(schema: JsonSchema, path: string, label: string): TreeNode {
  const node: TreeNode = { id: path, label, leaves: [], children: [] };
  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    const childPath = path ? `${path}.${key}` : key;
    if (prop.type === 'array') {
      const item = prop.items;
      if (item && item.type === 'object' && item.properties) {
        node.children.push(buildNode(item, `${childPath}[]`, `${key}[]`));
      } else {
        node.leaves.push(`${childPath}[]`);
      }
    } else if (prop.type === 'object' && prop.properties) {
      node.children.push(buildNode(prop, childPath, key));
    } else {
      node.leaves.push(childPath);
    }
  }
  return node;
}

export function subtreeLeaves(node: TreeNode): string[] {
  return [...node.leaves, ...node.children.flatMap(subtreeLeaves)];
}

export function findNode(node: TreeNode, id: string): TreeNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const hit = findNode(child, id);
    if (hit) return hit;
  }
  return null;
}

function nodeMatches(node: TreeNode, search: string): boolean {
  if (node.label.toLowerCase().includes(search)) return true;
  if (node.leaves.some((l) => l.toLowerCase().includes(search))) return true;
  return node.children.some((c) => nodeMatches(c, search));
}

/** Last segment of a dot-path — the field's own name. */
export function leafLabel(path: string): string {
  const seg = path.split('.').pop() ?? path;
  return seg;
}

/* Mapping keys are namespaced by endpoint id so each endpoint keeps its own
 * mappings. A response leaf maps to two object fields — its attribute name and
 * its value; a request leaf maps to a single source field. */
function nameKey(epId: string, path: string): string {
  return `${epId}::${path}::name`;
}
function valueKey(epId: string, path: string): string {
  return `${epId}::${path}::value`;
}
function reqKey(epId: string, path: string): string {
  return `${epId}::${path}::req`;
}
