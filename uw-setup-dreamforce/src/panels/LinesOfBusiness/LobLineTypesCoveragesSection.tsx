import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  Dropdown,
  DuelingPicklist,
  Icon,
  Input,
  Modal,
  Select,
  Tabs,
  Textarea,
} from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import {
  CANONICAL_ATTRIBUTE_DATA_TYPES,
  CANONICAL_CONFLICT_STRATEGIES,
  LINE_DEFINITION_TYPES,
  USER_LINE_DEFINITION_TYPES,
  type AttributeAlias,
  type CanonicalAttributeDef,
  type CanonicalConflictStrategy,
  type LineCoverageEntity,
  type LineCoverageKind,
  type RnAttributeSource,
} from '@/types/config';
import {
  SourcesTable,
  STRATEGY_HINTS,
  STRATEGY_ICONS,
  TileMenu,
} from './LobHierarchySection';
import '@/panels/ActivitiesAndStages/ActivitiesEntityEditor.css';
import '@/panels/ActivitiesAndStages/ReusableActivityModal.css';
import '@/panels/GeneralSetup/Reconciliation.css';
import './LobActivitiesSection.css';
import './LobHierarchy.css';
import './LobLineTypesCoverages.css';

/**
 * LOB → Reconciliation And Normalization → Line Definitions.
 *
 * A Run-My-Day-style tile list of canonical schema entities, filterable by a
 * Line Definition type (Line Of Business | Location | Coverage | None). The
 * list is led by the OOTB, non-deletable Line-Of-Business root (its type is
 * fixed and not editable); every other row is a user-defined definition. Only
 * Coverage definitions carry an alias table. Each entity owns a list of
 * Canonical Attribute Definitions (§11.4.4). Clicking a tile — or the New
 * Line Definition button — opens a modal with two tabs:
 *   • Details    — a 2-column standard form (fields switch on kind)
 *   • Attributes — categories nav / attribute list / attribute detail
 *
 * Attribute categories are sourced from the LOB's Categories section
 * (`enrichmentConfigs`). Category selection is optional; attributes with no
 * category surface under a synthetic "Uncategorized" nav item.
 */

const UNCATEGORIZED = '__uncategorized__';

/** Sentinel for the "all types" filter option. */
const ALL_TYPES = '__all__';

/** Badge tone per Line Definition type. */
const KIND_TONE: Record<LineCoverageKind, 'brand' | 'info' | 'success' | 'neutral'> = {
  'Line of Business': 'brand',
  'Line Item': 'neutral',
  Location: 'neutral',
  Account: 'info',
  Contact: 'success',
  'Loss History/Claims': 'neutral',
  Policy: 'success',
  Coverage: 'info',
};

/** Prompt Templates available to the AI Summary Template lookup. There is no
 * Prompt Templates entity in the schema yet — this is a curated catalog of the
 * templates the platform ships. */
const PROMPT_TEMPLATES = [
  'Line Summary — Standard',
  'Line Summary — Detailed',
  'Risk Narrative Summary',
  'Exposure Summary',
  'Loss History Summary',
  'Coverage Comparison Summary',
];

function slugify(s: string): string {
  return s
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function resolveEnrichmentLob(target: string, available: string[]): string | null {
  if (available.length === 0) return null;
  const exact = available.find((l) => l === target);
  if (exact) return exact;
  const contains = available.find((l) =>
    l.toLowerCase().includes(target.toLowerCase()),
  );
  if (contains) return contains;
  return available.find((l) => target.toLowerCase().includes(l.toLowerCase())) ?? null;
}

interface Props {
  lob: string;
  /** Submission-scoped variant: collapses to the single root entity that
   * represents the parent Submission — no Line Type / Coverage tabs, no add,
   * no search. Used by the Submission Settings hub. */
  submissionMode?: boolean;
}

export function LobLineTypesCoveragesSection({ lob, submissionMode = false }: Props) {
  const { config, update } = useConfig();
  const [modalEntity, setModalEntity] = useState<LineCoverageEntity | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<LineCoverageKind | typeof ALL_TYPES>(ALL_TYPES);

  const allEntities = useMemo(
    () =>
      (config.lineCoverageEntities ?? [])
        .filter((e) => e.lob === lob)
        .slice()
        .sort((a, b) => a.label.localeCompare(b.label)),
    [config.lineCoverageEntities, lob],
  );

  // The LOB-root entity is the OOTB "Line Of Business" definition. If none has
  // been persisted yet, synthesize one for display — it is materialized on
  // first edit. It sorts to the top of the combined list.
  const rootEntity = useMemo<LineCoverageEntity>(
    () =>
      allEntities.find((e) => e.isLobRoot) ??
      lobRootEntity(lob, config.nextLineCoverageEntityId ?? 1),
    [allEntities, lob, config.nextLineCoverageEntityId],
  );
  const userEntities = useMemo(() => allEntities.filter((e) => !e.isLobRoot), [allEntities]);

  // Single combined list, sorted by type, then alphabetically within each type.
  // The OOTB Line-of-Business root therefore leads the list.
  const combined = useMemo<LineCoverageEntity[]>(() => {
    const rank: Record<LineCoverageKind, number> = {
      'Line of Business': 0,
      'Line Item': 1,
      Location: 2,
      Account: 3,
      Contact: 4,
      Policy: 5,
      'Loss History/Claims': 6,
      Coverage: 7,
    };
    return [rootEntity, ...userEntities].sort((a, b) => {
      // The OOTB scope root always leads, regardless of its kind.
      if (a.isLobRoot) return -1;
      if (b.isLobRoot) return 1;
      return rank[a.kind] - rank[b.kind] || a.label.localeCompare(b.label);
    });
  }, [rootEntity, userEntities]);

  const trimmed = query.trim().toLowerCase();
  const visible = submissionMode
    ? [rootEntity]
    : combined
        .filter((e) => (typeFilter === ALL_TYPES ? true : e.kind === typeFilter))
        .filter((e) => (trimmed ? e.label.toLowerCase().includes(trimmed) : true));

  const categoryOptions = useMemo(() => {
    const lobs = config.enrichmentConfigs.map((c) => c.lob);
    const resolved = resolveEnrichmentLob(lob, lobs);
    const cfg = resolved
      ? config.enrichmentConfigs.find((c) => c.lob === resolved)
      : null;
    return (cfg?.categories ?? []).map((c) => c.name);
  }, [config.enrichmentConfigs, lob]);

  const onNew = () => {
    setModalEntity(null);
    setModalOpen(true);
  };
  const onOpen = (e: LineCoverageEntity) => {
    setModalEntity(e);
    setModalOpen(true);
  };
  const onClose = () => {
    setModalOpen(false);
    setModalEntity(null);
  };

  const onSave = (draft: LineCoverageEntity, nextAttrId: number) => {
    update((prev) => {
      const existing = prev.lineCoverageEntities ?? [];
      const isNew = !existing.some((e) => e.id === draft.id);
      return {
        ...prev,
        lineCoverageEntities: isNew
          ? [...existing, draft]
          : existing.map((e) => (e.id === draft.id ? draft : e)),
        nextLineCoverageEntityId: Math.max(
          prev.nextLineCoverageEntityId ?? 1,
          draft.id + 1,
        ),
        nextCanonicalAttributeId: Math.max(
          prev.nextCanonicalAttributeId ?? 1,
          nextAttrId,
        ),
      };
    });
    onClose();
  };

  const onDelete = (e: LineCoverageEntity) => {
    if (!confirm(`Delete "${e.label}"? This removes its ${e.attributes.length} attribute${e.attributes.length === 1 ? '' : 's'}.`))
      return;
    update((prev) => ({
      ...prev,
      lineCoverageEntities: (prev.lineCoverageEntities ?? []).filter(
        (x) => x.id !== e.id,
      ),
    }));
  };

  return (
    <div className="lob-activities">
      <header className="lob-activities__header">
        <div>
          <h3 className="lob-activities__title">
            {submissionMode ? 'Submission Attributes' : `${lob} — Line Definitions`}
          </h3>
          <p className="lob-activities__sub">
            {submissionMode
              ? 'Canonical attributes carried on the parent Submission record.'
              : `${combined.length} line definition${combined.length === 1 ? '' : 's'} for ${lob}. Define the lines, locations and named coverages — and the canonical attributes they carry.`}
          </p>
        </div>
      </header>

      {!submissionMode && (
        <div className="lob-activities__toolbar">
          <Input
            placeholder="Search by name"
            iconLeading={<Icon name="search" size={14} />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={`Search ${lob} line definitions by name`}
            className="lob-activities__search"
          />
          <Dropdown
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as LineCoverageKind | typeof ALL_TYPES)}
            aria-label="Filter by type"
            className="ltc-type-filter"
            fullWidth={false}
            options={[
              { value: ALL_TYPES, label: 'All types' },
              ...LINE_DEFINITION_TYPES.map((t) => ({ value: t, label: t })),
            ]}
          />
          <button type="button" className="lob-activities__new-btn" onClick={onNew}>
            <Icon name="plus" size={14} />
            New Line Definition
          </button>
        </div>
      )}

      <div className="lob-activities__list">
        {visible.length === 0 ? (
          <div className="lob-activities__empty">
            {trimmed || typeFilter !== ALL_TYPES ? (
              <p style={{ margin: 0 }}>No line definitions match your filters.</p>
            ) : (
              <>
                <p style={{ margin: 0 }}>No line definitions for {lob} yet.</p>
                <Button
                  variant="brand"
                  iconLeading={<Icon name="plus" size={14} />}
                  onClick={onNew}
                >
                  New Line Definition
                </Button>
              </>
            )}
          </div>
        ) : (
          visible.map((e) => (
            <EntityTile
              key={e.id}
              entity={e}
              menuOpen={openMenuId === e.id}
              onMenuToggle={(next) =>
                setOpenMenuId(next ? e.id : openMenuId === e.id ? null : openMenuId)
              }
              onClick={() => onOpen(e)}
              onDelete={e.isLobRoot ? undefined : () => onDelete(e)}
            />
          ))
        )}
      </div>

      {modalOpen && (
        <EntityModal
          lob={lob}
          hideLobField={lob === 'Submission'}
          entity={modalEntity}
          defaultKind="Line Item"
          categoryOptions={categoryOptions}
          seedEntityId={config.nextLineCoverageEntityId ?? 1}
          seedAttrId={config.nextCanonicalAttributeId ?? 1}
          onClose={onClose}
          onSave={onSave}
        />
      )}
    </div>
  );
}

/* ── Tile ─────────────────────────────────────────────────────────── */

function EntityTile({
  entity,
  menuOpen,
  onMenuToggle,
  onClick,
  onDelete,
}: {
  entity: LineCoverageEntity;
  menuOpen: boolean;
  onMenuToggle: (next: boolean) => void;
  onClick: () => void;
  onDelete?: () => void;
}) {
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
          onDelete={
            onDelete
              ? () => {
                  onMenuToggle(false);
                  onDelete();
                }
              : undefined
          }
        />
      </div>
      <div className="act-tile__name">
        <span className="act-tile__name-text">{entity.label}</span>
        <span className="ltc-tile__type">
          <Badge tone={KIND_TONE[entity.kind]}>{entity.kind}</Badge>
        </span>
      </div>
      <div className="act-tile__desc">
        {entity.attributes.length} attribute{entity.attributes.length === 1 ? '' : 's'}
        {(() => {
          const names = (entity.aliases ?? []).map((a) => a.name).filter(Boolean);
          return names.length > 0 ? ` · Also known as ${names.join(', ')}` : '';
        })()}
      </div>
    </div>
  );
}

/* ── Modal ────────────────────────────────────────────────────────── */

/** The single, non-deletable OOTB root entity representing the scope itself.
 * For an LOB its kind is "Line of Business"; for the parent Submission it is a
 * "Line Item". Its label is the scope name. */
function lobRootEntity(lob: string, id: number): LineCoverageEntity {
  return {
    id,
    lob,
    kind: lob === 'Submission' ? 'Line Item' : 'Line of Business',
    isLobRoot: true,
    developerName: slugify(lob),
    label: lob,
    description: '',
    source: 'OOTB',
    active: true,
    allowedParentTypes: [],
    allowedChildTypes: [],
    aiMatchPromptTemplate: '',
    isSubCoverage: false,
    parentCoverage: '',
    attributes: [],
  };
}

function blankEntity(lob: string, id: number, kind: LineCoverageKind): LineCoverageEntity {
  return {
    id,
    lob,
    kind,
    developerName: '',
    label: '',
    description: '',
    source: 'User-defined',
    active: true,
    allowedParentTypes: [],
    allowedChildTypes: [],
    aiMatchPromptTemplate: '',
    isSubCoverage: false,
    parentCoverage: '',
    attributes: [],
  };
}

interface EntityModalProps {
  lob: string;
  /** Hide the read-only Line of Business field (parent-Submission scope). */
  hideLobField?: boolean;
  entity: LineCoverageEntity | null;
  defaultKind: LineCoverageKind;
  categoryOptions: string[];
  seedEntityId: number;
  seedAttrId: number;
  onClose: () => void;
  onSave: (draft: LineCoverageEntity, nextAttrId: number) => void;
}

function EntityModal({
  lob,
  hideLobField,
  entity,
  defaultKind,
  categoryOptions,
  seedEntityId,
  seedAttrId,
  onClose,
  onSave,
}: EntityModalProps) {
  const [tab, setTab] = useState('details');
  const [draft, setDraft] = useState<LineCoverageEntity>(
    () => entity ?? blankEntity(lob, seedEntityId, defaultKind),
  );
  // Local attribute-id allocator, seeded from the config counter.
  const attrIdRef = useRef(seedAttrId);
  const [devNameDirty, setDevNameDirty] = useState(!!entity);

  const patch = (p: Partial<LineCoverageEntity>) => setDraft((d) => ({ ...d, ...p }));

  const setLabel = (label: string) => {
    if (!devNameDirty) {
      patch({ label, developerName: slugify(label) });
    } else {
      patch({ label });
    }
  };

  const valid = draft.label.trim().length > 0;

  const commitSave = () => {
    if (!valid) return;
    const finalDraft: LineCoverageEntity = {
      ...draft,
      label: draft.label.trim(),
      developerName: (draft.developerName.trim() || slugify(draft.label)).trim(),
    };
    onSave(finalDraft, attrIdRef.current);
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      className="ltc-modal"
      title={
        draft.isLobRoot
          ? `Edit ${entity?.label ?? lob}`
          : entity
            ? `Edit ${entity.label}`
            : 'New Line Definition'
      }
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
          {
            id: 'attributes',
            label: 'Attributes',
            badge: draft.attributes.length || undefined,
          },
        ]}
        active={tab}
        onChange={setTab}
      />
      <div className="ltc-modal__body">
        {tab === 'details' ? (
          <DetailsForm
            lob={lob}
            hideLobField={hideLobField}
            draft={draft}
            patch={patch}
            setLabel={setLabel}
            onDevNameChange={(v) => {
              setDevNameDirty(true);
              patch({ developerName: v });
            }}
          />
        ) : (
          <AttributesTab
            draft={draft}
            categoryOptions={categoryOptions}
            allocId={() => attrIdRef.current++}
            setAttributes={(attributes) => patch({ attributes })}
          />
        )}
      </div>
    </Modal>
  );
}

/* ── Details tab ──────────────────────────────────────────────────── */

interface DetailsFormProps {
  lob: string;
  hideLobField?: boolean;
  draft: LineCoverageEntity;
  patch: (p: Partial<LineCoverageEntity>) => void;
  setLabel: (v: string) => void;
  onDevNameChange: (v: string) => void;
}

function DetailsForm({
  lob,
  hideLobField,
  draft,
  patch,
  setLabel,
  onDevNameChange,
}: DetailsFormProps) {
  const isCoverage = draft.kind === 'Coverage';
  const isRoot = !!draft.isLobRoot;

  return (
    <div className="ltc-form">
      <div className="ltc-form__grid">
        {isRoot ? (
          <Input label="Type" value={draft.kind} readOnly disabled />
        ) : (
          <Select
            label="Type"
            value={draft.kind}
            onChange={(e) => patch({ kind: e.target.value as LineCoverageKind })}
          >
            {USER_LINE_DEFINITION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        )}
        {!hideLobField && (
          <Input label="Line of Business" value={lob} readOnly disabled />
        )}
        <Input
          label="Label"
          required
          value={draft.label}
          readOnly={isRoot}
          disabled={isRoot}
          placeholder={isCoverage ? 'e.g. Ordinance & Law' : 'e.g. Building'}
          onChange={(e) => setLabel(e.target.value)}
        />
        <Input
          label="Developer Name"
          value={draft.developerName}
          placeholder={isCoverage ? 'ordinance_and_law' : 'Building'}
          onChange={(e) => onDevNameChange(e.target.value)}
        />
        <div className="ltc-form__full">
          <Textarea
            label="Description"
            value={draft.description ?? ''}
            rows={2}
            placeholder="What this represents. Used by semantic matching as context."
            onChange={(e) => patch({ description: e.target.value })}
          />
        </div>

        {!isCoverage && (
          <div className="ltc-form__full">
            <div className="ltc-form__label">AI Summary Template</div>
            <Dropdown
              value={draft.aiMatchPromptTemplate ?? ''}
              onChange={(v) => patch({ aiMatchPromptTemplate: v })}
              aria-label="AI Summary Template"
              placeholder="Select a prompt template"
              fullWidth
              options={[
                { value: '', label: '— None —' },
                ...PROMPT_TEMPLATES.map((t) => ({ value: t, label: t })),
              ]}
            />
          </div>
        )}

        <div className="ltc-form__check">
          <Checkbox
            label="Active"
            checked={draft.active ?? true}
            onChange={(e) => patch({ active: e.target.checked })}
          />
        </div>

        {isCoverage && (
          <>
            <div className="ltc-form__full">
              <AliasTable
                aliases={draft.aliases ?? []}
                onChange={(aliases) => patch({ aliases })}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Attributes tab ───────────────────────────────────────────────── */

interface AttributesTabProps {
  draft: LineCoverageEntity;
  categoryOptions: string[];
  allocId: () => number;
  setAttributes: (next: CanonicalAttributeDef[]) => void;
}

function AttributesTab({
  draft,
  categoryOptions,
  allocId,
  setAttributes,
}: AttributesTabProps) {
  const attrs = draft.attributes;

  // Left-nav categories are derived from the categories actually used by the
  // attributes, ordered by the RN category order, then any strays, then the
  // synthetic Uncategorized bucket.
  const navCategories = useMemo(() => {
    const used = new Set(
      attrs.map((a) => (a.category && a.category.trim() ? a.category : UNCATEGORIZED)),
    );
    const ordered: string[] = [];
    for (const c of categoryOptions) if (used.has(c)) ordered.push(c);
    for (const c of used) {
      if (c !== UNCATEGORIZED && !ordered.includes(c)) ordered.push(c);
    }
    ordered.push(UNCATEGORIZED);
    return ordered;
  }, [attrs, categoryOptions]);

  const [selectedCat, setSelectedCat] = useState<string>(
    () => navCategories[0] ?? UNCATEGORIZED,
  );
  const [selectedAttrId, setSelectedAttrId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // Keep the selected category valid as attributes come and go.
  useEffect(() => {
    if (!navCategories.includes(selectedCat)) {
      setSelectedCat(navCategories[0] ?? UNCATEGORIZED);
    }
  }, [navCategories, selectedCat]);

  const attrIn = (a: CanonicalAttributeDef, cat: string) =>
    cat === UNCATEGORIZED ? !a.category || !a.category.trim() : a.category === cat;

  const visibleAttrs = attrs.filter((a) => attrIn(a, selectedCat));

  const selectedAttr = selectedAttrId != null
    ? attrs.find((a) => a.id === selectedAttrId) ?? null
    : null;

  const catCount = (cat: string) => attrs.filter((a) => attrIn(a, cat)).length;

  const onNewAttr = () => {
    const id = allocId();
    const next: CanonicalAttributeDef = {
      id,
      developerName: '',
      label: '',
      dataType: 'Text',
      category: selectedCat === UNCATEGORIZED ? '' : selectedCat,
      conflictStrategy: 'Most Common',
      isRequired: false,
    };
    setAttributes([...attrs, next]);
    setSelectedAttrId(id);
  };

  const onPatchAttr = (id: number, p: Partial<CanonicalAttributeDef>) => {
    setAttributes(attrs.map((a) => (a.id === id ? { ...a, ...p } : a)));
  };

  const onDeleteAttr = (id: number) => {
    setAttributes(attrs.filter((a) => a.id !== id));
    if (selectedAttrId === id) setSelectedAttrId(null);
  };

  const catLabel = (c: string) => (c === UNCATEGORIZED ? 'Uncategorized' : c);

  return (
    <div className="ltc-attrs">
      {/* Section 1 — category nav + attribute list */}
      <div className="ltc-attrs__browse">
        {/* Salesforce base vertical navigation */}
        <nav className="ltc-vnav" aria-label="Attribute categories">
          <div className="ltc-vnav__title">Categories</div>
          <ul className="ltc-vnav__list">
            {navCategories.map((c) => {
              const active = selectedCat === c;
              return (
                <li key={c} className="ltc-vnav__item">
                  <button
                    type="button"
                    className={[
                      'ltc-vnav__link',
                      active ? 'ltc-vnav__link--active' : '',
                      c === UNCATEGORIZED ? 'ltc-vnav__link--uncat' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setSelectedCat(c)}
                  >
                    <span className="ltc-vnav__label">{catLabel(c)}</span>
                    <span className="ltc-vnav__count">{catCount(c)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ltc-attrs__col ltc-attrs__mid">
          <div className="ltc-attrs__col-head">
            <span>Attributes</span>
            <button type="button" className="ltc-attrs__add" onClick={onNewAttr}>
              <Icon name="plus" size={14} />
              New
            </button>
          </div>
          <div className="ltc-attrs__list lob-activities__list">
            {visibleAttrs.length === 0 ? (
              <div className="ltc-attrs__empty">No attributes here yet.</div>
            ) : (
              visibleAttrs.map((a) => {
                const aliases = a.aliases ?? [];
                return (
                  <div
                    key={a.id}
                    className={[
                      'act-tile',
                      'act-tile--compact',
                      selectedAttrId === a.id ? 'act-tile--selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedAttrId(a.id)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        setSelectedAttrId(a.id);
                      }
                    }}
                  >
                    <div className="act-tile__actions">
                      <TileMenu
                        open={openMenuId === a.id}
                        onToggle={(next) =>
                          setOpenMenuId(next ? a.id : openMenuId === a.id ? null : openMenuId)
                        }
                        onEdit={() => {
                          setOpenMenuId(null);
                          setSelectedAttrId(a.id);
                        }}
                        onDelete={() => {
                          setOpenMenuId(null);
                          onDeleteAttr(a.id);
                        }}
                      />
                    </div>
                    <div className="act-tile__name">
                      <span className="act-tile__name-text">
                        {a.label || <em>Untitled attribute</em>}
                      </span>
                      <Badge tone="brand">{a.conflictStrategy ?? 'Most Common'}</Badge>
                    </div>
                    {aliases.length > 0 && (
                      <div className="act-tile__desc">
                        Also known as{' '}
                        {aliases
                          .map((al) => al.name)
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Section 2 — attribute detail (only once an attribute is picked) */}
      {selectedAttr && (
        <div className="ltc-attrs__detail-section">
          <AttributeDetail
            key={selectedAttr.id}
            attr={selectedAttr}
            lob={draft.lob}
            categoryOptions={categoryOptions}
            onPatch={(p) => onPatchAttr(selectedAttr.id, p)}
            onDelete={() => onDeleteAttr(selectedAttr.id)}
            onClose={() => setSelectedAttrId(null)}
          />
        </div>
      )}
    </div>
  );
}

interface AttributeDetailProps {
  attr: CanonicalAttributeDef;
  lob: string;
  categoryOptions: string[];
  onPatch: (p: Partial<CanonicalAttributeDef>) => void;
  onDelete: () => void;
  onClose: () => void;
}

function AttributeDetail({
  attr,
  lob,
  categoryOptions,
  onPatch,
  onDelete,
  onClose,
}: AttributeDetailProps) {
  const [devNameDirty, setDevNameDirty] = useState(!!attr.developerName);
  const strategy: CanonicalConflictStrategy = attr.conflictStrategy ?? 'Most Common';
  return (
    <div className="ltc-attr-form">
      <div className="ltc-attrs__col-head ltc-attr-form__head">
        <span>Attribute Details</span>
        <button
          type="button"
          className="ltc-attr-form__close"
          aria-label="Close attribute details"
          onClick={onClose}
        >
          <Icon name="close" size={14} />
        </button>
      </div>
      <div className="ltc-attr-form__fields">
        <Input
          label="Label"
          value={attr.label}
          placeholder="e.g. Building Value"
          onChange={(e) => {
            const label = e.target.value;
            if (!devNameDirty) onPatch({ label, developerName: slugify(label) });
            else onPatch({ label });
          }}
        />
        <Input
          label="Developer Name"
          value={attr.developerName}
          placeholder="Building_Value"
          onChange={(e) => {
            setDevNameDirty(true);
            onPatch({ developerName: e.target.value });
          }}
        />
        <Select
          label="Data Type"
          value={attr.dataType}
          onChange={(e) =>
            onPatch({ dataType: e.target.value as CanonicalAttributeDef['dataType'] })
          }
        >
          {CANONICAL_ATTRIBUTE_DATA_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select
          label="Category"
          hint="Optional — from Line Of Business Definition → Attribute Categories"
          value={attr.category ?? ''}
          onChange={(e) => onPatch({ category: e.target.value })}
        >
          <option value="">— Uncategorized —</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Textarea
          label="Description"
          value={attr.description ?? ''}
          rows={2}
          placeholder="Human-readable description. Used by semantic matching."
          onChange={(e) => onPatch({ description: e.target.value })}
        />
        <AliasTable
          aliases={attr.aliases ?? []}
          onChange={(aliases) => onPatch({ aliases })}
        />
        <Checkbox
          label="Required Attribute (Will be flagged at run time if value not available)"
          checked={!!attr.isRequired}
          onChange={(e) => onPatch({ isRequired: e.target.checked })}
        />
        <Checkbox
          label="Always mark for review"
          checked={!!attr.alwaysMarkForReview}
          onChange={(e) => onPatch({ alwaysMarkForReview: e.target.checked })}
        />
        <div>
          <div className="ltc-form__label">Resolution Strategy</div>
          <div className="ream-process-grid" role="radiogroup" aria-label="Resolution strategy">
            {CANONICAL_CONFLICT_STRATEGIES.map((s) => {
              const selected = strategy === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`ream-process-card${selected ? ' ream-process-card--selected' : ''}`}
                  onClick={() => onPatch({ conflictStrategy: s })}
                >
                  <span
                    className="ream-process-card__icon"
                    style={{
                      background: 'var(--slds-g-color-brand-base-95)',
                      color: 'var(--slds-g-color-accent-1)',
                    }}
                  >
                    <Icon name={STRATEGY_ICONS[s as keyof typeof STRATEGY_ICONS]} size={12} />
                  </span>
                  <span className="ream-process-card__body">
                    <span className="ream-process-card__title">{s}</span>
                    <span className="ream-process-card__sub">
                      {STRATEGY_HINTS[s as keyof typeof STRATEGY_HINTS]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {strategy === 'Source Priority' && (
          <SourcesTable
            lob={lob}
            sources={attr.sources ?? []}
            onChange={(sources: RnAttributeSource[]) => onPatch({ sources })}
          />
        )}
      </div>
      <div className="ltc-attr-form__footer">
        <Button
          variant="destructive"
          iconLeading={<Icon name="trash" size={14} />}
          onClick={onDelete}
        >
          Delete Attribute
        </Button>
        <div className="ltc-attr-form__footer-actions">
          <Button variant="neutral" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="brand" onClick={onClose}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

interface AliasTableProps {
  aliases: AttributeAlias[];
  onChange: (next: AttributeAlias[]) => void;
}

function AliasTable({ aliases, onChange }: AliasTableProps) {
  const nextId = () => aliases.reduce((max, a) => Math.max(max, a.id), 0) + 1;

  const addRow = () => {
    onChange([...aliases, { id: nextId(), name: '' }]);
  };
  const setRow = (id: number, patch: Partial<AttributeAlias>) => {
    onChange(aliases.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };
  const removeRow = (id: number) => {
    onChange(aliases.filter((a) => a.id !== id));
  };

  return (
    <div className="ltc-alias">
      <div className="ltc-alias__head">
        <span className="slds2-field__label">Alias</span>
        <button type="button" className="lob-hier__text-btn" onClick={addRow}>
          <Icon name="plus" size={12} />
          Add Alias
        </button>
      </div>
      {aliases.length === 0 ? (
        <div className="lob-hier__empty">
          No aliases yet. Add alternate names this attribute is known by.
        </div>
      ) : (
        <div className="ltc-alias-table">
          <div className="ltc-alias-row ltc-alias-row--head">
            <span>Name</span>
            <span>Attr 1</span>
            <span>Attr 2</span>
            <span>Attr 3</span>
            <span />
          </div>
          {aliases.map((a) => (
            <div key={a.id} className="ltc-alias-row">
              <Input
                value={a.name}
                aria-label="Alias name"
                placeholder="e.g. Property City"
                onChange={(e) => setRow(a.id, { name: e.target.value })}
              />
              <Input
                value={a.attr1 ?? ''}
                aria-label="Attribute 1"
                onChange={(e) => setRow(a.id, { attr1: e.target.value })}
              />
              <Input
                value={a.attr2 ?? ''}
                aria-label="Attribute 2"
                onChange={(e) => setRow(a.id, { attr2: e.target.value })}
              />
              <Input
                value={a.attr3 ?? ''}
                aria-label="Attribute 3"
                onChange={(e) => setRow(a.id, { attr3: e.target.value })}
              />
              <button
                type="button"
                className="lob-hier__src-grip ltc-alias-remove"
                aria-label="Remove alias"
                title="Remove alias"
                onClick={() => removeRow(a.id)}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
