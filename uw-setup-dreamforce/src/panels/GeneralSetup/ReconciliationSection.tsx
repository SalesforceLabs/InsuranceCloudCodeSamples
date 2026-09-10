import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Badge, Button, Card, Icon, Input, Select, Toggle } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { RnAttribute, RnEntity } from '@/types/config';
import '@/panels/RunMyDay/PlaybookWizard.css';
import '@/panels/ActivitiesAndStages/ActivitiesEntityEditor.css';
import '@/panels/ActivitiesAndStages/ReusableActivityModal.css';
import '@/panels/LinesOfBusiness/LobActivitiesSection.css';
import './DocumentClassification.css';
import './Reconciliation.css';

/**
 * General Setup → Reconciliation and Normalization.
 *
 * Two-column taxonomy mirroring Document Classification: Entity (left) →
 * Fields (right). The left column is the entity list; selecting one
 * focuses it and surfaces its fields on the right. The right column's
 * heading swaps to the focused entity's name.
 *
 * Each field captures a Name, Type, and a list of canonical names —
 * alternate names the same data is known by in source documents.
 * Canonical names are entered as chips: type and press Enter (or comma)
 * to commit one; backspace on an empty input removes the trailing chip.
 */
const RECONCILIATION_AGENTS = [
  'Default Reconciliation Agent',
  'Property Reconciliation Agent',
  'General Liability Reconciliation Agent',
  'Cyber Reconciliation Agent',
];

export function ReconciliationSection() {
  return (
    <div className="dc-section">
      <ReconciliationAgentCard />
      <EntitiesAndAttributesCard />
    </div>
  );
}

const NORMALIZATION_AGENTS = [
  'Default Normalization Agent',
  'Property Normalization Agent',
  'General Liability Normalization Agent',
  'Cyber Normalization Agent',
];

// Curated prompt-template catalogs backing the two line-definition lookups.
// Free-form strings for now — the prompt registry isn't modeled here.
const LINE_SUMMARY_PROMPT_TEMPLATES = [
  'Line Summary — Standard',
  'Line Summary — Detailed',
  'Risk Narrative Summary',
  'Exposure Summary',
  'Loss History Summary',
  'Coverage Comparison Summary',
];

const LINE_RECONCILIATION_PROMPT_TEMPLATES = [
  'Line Reconciliation — Standard',
  'Line Reconciliation — Strict',
  'Source-Priority Reconciliation',
  'Most-Recent-Wins Reconciliation',
];

interface RnDraft {
  fuzzMatchingThreshold: string;
  normalizationEnabled: boolean;
  normalizationAgent: string;
  normalizationThreshold: string;
  lineDefinitionSummaryPromptTemplate: string;
  lineDefinitionReconciliationPromptTemplate: string;
}

function rnDraftFromConfig(config: ReturnType<typeof useConfig>['config']): RnDraft {
  return {
    fuzzMatchingThreshold: String(config.fuzzMatchingThreshold ?? 80),
    normalizationEnabled: config.normalizationEnabled ?? true,
    normalizationAgent: config.normalizationAgent ?? NORMALIZATION_AGENTS[0],
    normalizationThreshold: String(config.normalizationThreshold ?? 50),
    lineDefinitionSummaryPromptTemplate:
      config.lineDefinitionSummaryPromptTemplate ?? LINE_SUMMARY_PROMPT_TEMPLATES[0],
    lineDefinitionReconciliationPromptTemplate:
      config.lineDefinitionReconciliationPromptTemplate ??
      LINE_RECONCILIATION_PROMPT_TEMPLATES[0],
  };
}

/** Append a stored value to a curated list if it isn't already present, so a
 * custom value set elsewhere still shows in the lookup. */
function withStored(list: string[], stored: string): string[] {
  return stored && !list.includes(stored) ? [stored, ...list] : list;
}

/**
 * General Setup → Reconciliation & Normalization.
 *
 * A standard Salesforce-style record form: read-only field layout with a
 * single Edit button in the card header that flips every field into an input
 * and surfaces a Save / Cancel footer. Covers fuzzy matching, semantic
 * matching (normalization), and the two default line-definition prompt
 * templates.
 */
export function ReconciliationNormalizationSection() {
  const { config, update } = useConfig();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RnDraft>(() => rnDraftFromConfig(config));
  const [error, setError] = useState<string | null>(null);

  // Re-sync the draft from config whenever we aren't actively editing.
  useEffect(() => {
    if (!editing) {
      setDraft(rnDraftFromConfig(config));
      setError(null);
    }
  }, [config, editing]);

  const enabled = editing ? draft.normalizationEnabled : config.normalizationEnabled ?? true;

  const onCancel = () => {
    setDraft(rnDraftFromConfig(config));
    setEditing(false);
    setError(null);
  };

  const onSave = () => {
    const fuzz = Number(draft.fuzzMatchingThreshold);
    if (Number.isNaN(fuzz) || fuzz < 0 || fuzz > 100) {
      setError('Fuzz Matching Similarity Score must be between 0 and 100.');
      return;
    }
    const norm = Number(draft.normalizationThreshold);
    if (draft.normalizationEnabled && (Number.isNaN(norm) || norm < 0 || norm > 100)) {
      setError('Semantic Matching Confidence Score must be between 0 and 100.');
      return;
    }
    update((p) => ({
      ...p,
      fuzzMatchingThreshold: fuzz,
      normalizationEnabled: draft.normalizationEnabled,
      normalizationAgent: draft.normalizationAgent,
      normalizationThreshold: norm,
      lineDefinitionSummaryPromptTemplate: draft.lineDefinitionSummaryPromptTemplate,
      lineDefinitionReconciliationPromptTemplate:
        draft.lineDefinitionReconciliationPromptTemplate,
    }));
    setEditing(false);
    setError(null);
  };

  const agentOptions = withStored(NORMALIZATION_AGENTS, config.normalizationAgent ?? '');
  const summaryOptions = withStored(
    LINE_SUMMARY_PROMPT_TEMPLATES,
    config.lineDefinitionSummaryPromptTemplate ?? '',
  );
  const reconOptions = withStored(
    LINE_RECONCILIATION_PROMPT_TEMPLATES,
    config.lineDefinitionReconciliationPromptTemplate ?? '',
  );

  return (
    <div className="dc-section">
      <Card
        title={<span className="dc-taxonomy-title">Reconciliation &amp; Normalization</span>}
        actions={
          editing ? (
            <span style={{ display: 'inline-flex', gap: 8 }}>
              <Button variant="neutral" onClick={onCancel}>
                Cancel
              </Button>
              <Button variant="brand" onClick={onSave}>
                Save
              </Button>
            </span>
          ) : (
            <Button
              variant="neutral"
              iconLeading={<Icon name="edit" size={14} />}
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          )
        }
        padding="md"
      >
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            columnGap: 32,
            rowGap: 20,
            margin: 0,
          }}
        >
          <RnField label="Fuzz Matching Similarity Score" editing={editing}>
            {editing ? (
              <Input
                type="number"
                min={0}
                max={100}
                value={draft.fuzzMatchingThreshold}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, fuzzMatchingThreshold: e.target.value }))
                }
                fullWidth
                aria-label="Fuzz Matching Similarity Score"
              />
            ) : (
              config.fuzzMatchingThreshold ?? 80
            )}
          </RnField>

          <RnField label="Enable Semantic Matching for Normalization" editing={editing}>
            {editing ? (
              <Toggle
                checked={draft.normalizationEnabled}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, normalizationEnabled: e.target.checked }))
                }
                label={draft.normalizationEnabled ? 'On' : 'Off'}
                aria-label="Enable Semantic Matching for Normalization"
              />
            ) : enabled ? (
              <Badge tone="success">On</Badge>
            ) : (
              <Badge>Off</Badge>
            )}
          </RnField>

          {enabled && (
            <>
              <RnField label="Semantic Matching Agent" editing={editing}>
                {editing ? (
                  <RnLookup
                    value={draft.normalizationAgent}
                    options={agentOptions}
                    onChange={(v) => setDraft((d) => ({ ...d, normalizationAgent: v }))}
                    ariaLabel="Semantic Matching Agent"
                    onView={() => alert('This will lead to the Agent page in Salesforce.')}
                  />
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                    {config.normalizationAgent || '—'}
                    <button
                      type="button"
                      className="dc-text-btn"
                      onClick={() => alert('This will lead to the Agent page in Salesforce.')}
                    >
                      View Agent
                    </button>
                  </span>
                )}
              </RnField>

              <RnField label="Semantic Matching Confidence Score" editing={editing}>
                {editing ? (
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={draft.normalizationThreshold}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, normalizationThreshold: e.target.value }))
                    }
                    fullWidth
                    aria-label="Semantic Matching Confidence Score"
                  />
                ) : (
                  config.normalizationThreshold ?? 50
                )}
              </RnField>
            </>
          )}

          <RnField label="Default Prompt Template for Line Definition Summary" editing={editing}>
            {editing ? (
              <RnLookup
                value={draft.lineDefinitionSummaryPromptTemplate}
                options={summaryOptions}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, lineDefinitionSummaryPromptTemplate: v }))
                }
                ariaLabel="Default Prompt Template for Line Definition Summary"
              />
            ) : (
              config.lineDefinitionSummaryPromptTemplate || '—'
            )}
          </RnField>

          <RnField label="Default Prompt Template for Line Definition Reconciliation" editing={editing}>
            {editing ? (
              <RnLookup
                value={draft.lineDefinitionReconciliationPromptTemplate}
                options={reconOptions}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, lineDefinitionReconciliationPromptTemplate: v }))
                }
                ariaLabel="Default Prompt Template for Line Definition Reconciliation"
              />
            ) : (
              config.lineDefinitionReconciliationPromptTemplate || '—'
            )}
          </RnField>
        </dl>

        {editing && error && (
          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid var(--slds-g-color-border-1)',
              fontSize: 12,
              color: 'var(--slds-g-color-error-1)',
            }}
          >
            {error}
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * Standard Salesforce record field. Bold sentence-case label on top, value
 * (or input, in edit mode) beneath. In read mode each field is separated by a
 * thin bottom hairline, matching the platform record detail layout. Renders
 * as a <dt>/<dd> pair inside the surrounding <dl> grid.
 */
function RnField({
  label,
  editing,
  children,
}: {
  label: string;
  editing: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: editing ? 4 : 2,
        minWidth: 0,
        ...(editing
          ? null
          : {
              paddingBottom: 8,
              borderBottom: '1px solid var(--slds-g-color-border-1)',
            }),
      }}
    >
      <dt
        style={{
          margin: 0,
          fontSize: 'var(--slds-g-font-scale-neg-1)',
          fontWeight: 700,
          color: 'var(--slds-g-color-on-surface-3)',
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          margin: 0,
          fontSize: 'var(--slds-g-font-scale-base)',
          color: 'var(--slds-g-color-on-surface-3)',
        }}
      >
        {children}
      </dd>
    </div>
  );
}

/**
 * Standard Salesforce lookup: a search input that filters the option list as
 * you type and shows matches in a portal-mounted dropdown. Once a value is
 * picked it collapses to a pill (name + optional View link + clear button);
 * clearing re-opens the search. Reuses the `.ream-lookup` styling shared with
 * the activity process lookup.
 */
function RnLookup({
  value,
  options,
  onChange,
  ariaLabel,
  onView,
}: {
  value: string;
  options: string[];
  onChange: (next: string) => void;
  ariaLabel: string;
  onView?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuRect, setMenuRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setMenuRect(null);
      return;
    }
    const place = () => {
      const t = ref.current;
      if (!t) return;
      const r = t.getBoundingClientRect();
      setMenuRect({ top: r.bottom + 4, left: r.left, width: r.width });
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

  const q = query.trim().toLowerCase();
  const matches = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;

  const commit = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  };

  const clear = () => {
    onChange('');
    setQuery('');
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <div className="ream-lookup" ref={ref}>
      {value ? (
        <div className="ream-lookup__pill">
          <span className="ream-lookup__pill-icon" aria-hidden="true">
            <Icon name="search" size={12} />
          </span>
          <span className="ream-lookup__pill-label" title={value}>
            {value}
          </span>
          {onView && (
            <button
              type="button"
              className="ream-lookup__pill-view"
              aria-label={`View ${value}`}
              title="View in Salesforce"
              onClick={onView}
            >
              <Icon name="external-link" size={12} />
            </button>
          )}
          <button
            type="button"
            className="ream-lookup__pill-clear"
            aria-label="Clear selection"
            title="Clear selection"
            onClick={clear}
          >
            <Icon name="close" size={12} />
          </button>
        </div>
      ) : (
        <div className="ream-lookup__input-wrap">
          <span className="ream-lookup__input-icon" aria-hidden="true">
            <Icon name="search" size={14} />
          </span>
          <input
            ref={inputRef}
            type="text"
            className="ream-lookup__input"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-label={ariaLabel}
            placeholder="Search…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
        </div>
      )}
      {open && !value && menuRect &&
        createPortal(
          <div
            className="ream-lookup__menu"
            role="listbox"
            ref={menuRef}
            style={{
              position: 'fixed',
              top: menuRect.top,
              left: menuRect.left,
              width: menuRect.width,
            }}
          >
            {matches.length === 0 ? (
              <div className="ream-lookup__empty">No matching records.</div>
            ) : (
              matches.map((o) => (
                <div
                  key={o}
                  role="option"
                  aria-selected={false}
                  className="ream-lookup__option"
                  onClick={() => commit(o)}
                >
                  <span className="ream-lookup__option-icon" aria-hidden="true">
                    <Icon name="search" size={12} />
                  </span>
                  <span className="ream-lookup__option-body">
                    <span className="ream-lookup__option-label">{o}</span>
                  </span>
                </div>
              ))
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

function ReconciliationAgentCard() {
  const { config, update } = useConfig();
  const stored = config.reconciliationAgent ?? '';
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(stored || RECONCILIATION_AGENTS[0]);

  useEffect(() => {
    if (!editing) {
      setValue(stored || RECONCILIATION_AGENTS[0]);
    }
  }, [stored, editing]);

  const onSave = () => {
    update((p) => ({ ...p, reconciliationAgent: value }));
    setEditing(false);
  };

  const onCancel = () => {
    setValue(stored || RECONCILIATION_AGENTS[0]);
    setEditing(false);
  };

  // Allow custom values typed in edit mode by appending the stored value
  // if it isn't already in the curated list.
  const options = RECONCILIATION_AGENTS.includes(stored) || stored === ''
    ? RECONCILIATION_AGENTS
    : [stored, ...RECONCILIATION_AGENTS];

  return (
    <Card padding="md">
      <div className="dc-threshold">
        <div className="dc-threshold__label">Reconciliation Agent</div>
        {editing ? (
          <div className="dc-threshold__edit-row">
            <Select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              options={options.map((a) => ({ value: a, label: a }))}
              aria-label="Reconciliation Agent"
            />
            <button
              type="button"
              className="dc-inline-edit"
              onClick={onSave}
              aria-label="Save"
              title="Save"
            >
              <Icon name="check" size={14} />
            </button>
            <button
              type="button"
              className="dc-inline-edit"
              onClick={onCancel}
              aria-label="Cancel"
              title="Cancel"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ) : (
          <div className="dc-threshold__edit-row">
            <span className="dc-threshold__value">{stored || '—'}</span>
            <button
              type="button"
              className="dc-inline-edit"
              onClick={() => setEditing(true)}
              aria-label="Edit Reconciliation Agent"
              title="Edit"
            >
              <Icon name="edit" size={14} />
            </button>
            <button
              type="button"
              className="dc-text-btn"
              onClick={() =>
                alert('This will lead to the Agent page in Salesforce.')
              }
            >
              View Agent
            </button>
          </div>
        )}
        <p className="dc-threshold__hint">
          The Agentforce agent that performs reconciliation across submission lines.
        </p>
      </div>
    </Card>
  );
}


function EntitiesAndAttributesCard() {
  const { config, update } = useConfig();
  const entities = config.rnEntities;

  const [focusedId, setFocusedId] = useState<number | null>(
    () => entities[0]?.id ?? null,
  );
  const [editingEntityId, setEditingEntityId] = useState<number | null>(null);
  const [entityDraft, setEntityDraft] = useState('');
  const [addingEntity, setAddingEntity] = useState(false);
  const [newEntityName, setNewEntityName] = useState('');

  // Re-anchor focus if the focused entity disappears (rename / delete /
  // external save).
  useEffect(() => {
    if (focusedId != null && !entities.find((e) => e.id === focusedId)) {
      setFocusedId(entities[0]?.id ?? null);
    }
  }, [entities, focusedId]);

  const focused = useMemo(
    () => entities.find((e) => e.id === focusedId) ?? null,
    [entities, focusedId],
  );

  const onAddEntity = () => {
    const name = newEntityName.trim();
    if (!name) return;
    if (entities.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
      alert(`An entity named "${name}" already exists.`);
      return;
    }
    let newId = 0;
    update((p) => {
      newId = p.nextRnEntityId;
      return {
        ...p,
        rnEntities: [{ id: newId, name, attributes: [] }, ...p.rnEntities],
        nextRnEntityId: p.nextRnEntityId + 1,
      };
    });
    setFocusedId(newId);
    setNewEntityName('');
    setAddingEntity(false);
  };

  const onRenameEntity = (entity: RnEntity) => {
    const name = entityDraft.trim();
    if (!name) {
      setEditingEntityId(null);
      return;
    }
    if (
      entities.some(
        (e) => e.id !== entity.id && e.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      alert(`An entity named "${name}" already exists.`);
      return;
    }
    update((p) => ({
      ...p,
      rnEntities: p.rnEntities.map((e) =>
        e.id === entity.id ? { ...e, name } : e,
      ),
    }));
    setEditingEntityId(null);
  };

  const onDeleteEntity = (entity: RnEntity) => {
    if (!confirm(`Delete entity "${entity.name}"? Its attributes will be removed too.`))
      return;
    update((p) => ({
      ...p,
      rnEntities: p.rnEntities.filter((e) => e.id !== entity.id),
    }));
  };

  return (
    <Card
      className="dc-taxonomy-card"
      title={<span className="dc-taxonomy-title">Entities and Attributes</span>}
      subtitle="Define the canonical entities reconciliation works against, and the attributes each entity exposes."
      padding="none"
    >
      <div className="dc-taxonomy rn-taxonomy">
        <div className="dc-col">
          <header className="dc-col__head">
            <div className="dc-col__title-block">
              <h4 className="dc-col__title">Entity</h4>
              <span className="dc-col__sub">
                {entities.length} {entities.length === 1 ? 'entity' : 'entities'}
                {entities.length > 0 ? ' · Double click to edit' : ''}
              </span>
            </div>
            <button
              type="button"
              className="dc-col__add"
              onClick={() => {
                setAddingEntity(true);
                setNewEntityName('');
              }}
            >
              <Icon name="plus" size={14} />
              Add
            </button>
          </header>
          <div className="dc-col__list">
            {addingEntity && (
              <div className="dc-row dc-row--editing">
                <RowEditor
                  placeholder="Entity name"
                  value={newEntityName}
                  onChange={setNewEntityName}
                  onCommit={onAddEntity}
                  onCancel={() => {
                    setAddingEntity(false);
                    setNewEntityName('');
                  }}
                />
              </div>
            )}
            {entities.length === 0 && !addingEntity ? (
              <div className="dc-empty">No entities yet. Add one to get started.</div>
            ) : (
              entities.map((e) => {
                const isFocused = focusedId === e.id;
                const isEditing = editingEntityId === e.id;
                const startEdit = () => {
                  setEntityDraft(e.name);
                  setEditingEntityId(e.id);
                };
                return (
                  <div
                    key={e.id}
                    className={[
                      'dc-row',
                      isFocused ? 'dc-row--focus' : '',
                      isEditing ? 'dc-row--editing' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (!isEditing) setFocusedId(e.id);
                    }}
                    onDoubleClick={() => {
                      if (!isEditing) startEdit();
                    }}
                    onKeyDown={(ev) => {
                      if (isEditing) return;
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        setFocusedId(e.id);
                      }
                    }}
                  >
                    {isEditing ? (
                      <RowEditor
                        value={entityDraft}
                        onChange={setEntityDraft}
                        onCommit={() => onRenameEntity(e)}
                        onCancel={() => setEditingEntityId(null)}
                      />
                    ) : (
                      <>
                        <span className="dc-row__label">{e.name}</span>
                        <span className="dc-row__count">{e.attributes.length}</span>
                        <RowMenu
                          ariaLabel={`${e.name} actions`}
                          onEdit={(ev) => {
                            ev.stopPropagation();
                            setEntityDraft(e.name);
                            setEditingEntityId(e.id);
                          }}
                          onDelete={(ev) => {
                            ev.stopPropagation();
                            onDeleteEntity(e);
                          }}
                        />
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="dc-col rn-fields-col">
          {focused ? (
            <FieldsPane entity={focused} />
          ) : (
            <div className="dc-empty">
              Select an entity on the left to manage its attributes.
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

interface FieldsPaneProps {
  entity: RnEntity;
}

function FieldsPane({ entity }: FieldsPaneProps) {
  const { update } = useConfig();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // Reset transient UI state when the focused entity changes.
  useEffect(() => {
    setCreating(false);
    setEditingFieldId(null);
    setOpenMenuId(null);
    setQuery('');
  }, [entity.id]);

  const fields = useMemo(
    () => entity.attributes.slice().sort((a, b) => b.id - a.id),
    [entity.attributes],
  );
  const trimmed = query.trim().toLowerCase();
  const visible = trimmed
    ? fields.filter((f) => f.name.toLowerCase().includes(trimmed))
    : fields;

  const persistFields = (next: RnAttribute[]) => {
    update((p) => ({
      ...p,
      rnEntities: p.rnEntities.map((e) =>
        e.id === entity.id ? { ...e, attributes: next } : e,
      ),
    }));
  };

  const onCreate = (draft: FieldDraft): number => {
    let newId = 0;
    update((p) => {
      // Allocate from the entity's own id space (use the largest existing
      // attribute id + 1; no global counter exists for RN attributes).
      const all = p.rnEntities.flatMap((e) =>
        e.attributes.map((a) => a.id),
      );
      newId = all.length > 0 ? Math.max(...all) + 1 : 1;
      return {
        ...p,
        rnEntities: p.rnEntities.map((e) =>
          e.id === entity.id
            ? {
                ...e,
                attributes: [
                  {
                    id: newId,
                    name: draft.name.trim(),
                    type: 'Text',
                    canonicalNames: draft.canonicalNames,
                  },
                  ...e.attributes,
                ],
              }
            : e,
        ),
      };
    });
    return newId;
  };

  const onSaveEdit = (id: number, draft: FieldDraft) => {
    persistFields(
      entity.attributes.map((a) =>
        a.id === id
          ? {
              ...a,
              name: draft.name.trim(),
              type: 'Text',
              canonicalNames: draft.canonicalNames,
            }
          : a,
      ),
    );
    setEditingFieldId(null);
  };

  const onDelete = (a: RnAttribute) => {
    if (!confirm(`Delete attribute "${a.name}"?`)) return;
    persistFields(entity.attributes.filter((x) => x.id !== a.id));
    setOpenMenuId(null);
  };

  return (
    <div className="rn-fields">
      <header className="rn-fields__head">
        <div>
          <h4 className="rn-fields__title">{entity.name} — Attributes</h4>
          <p className="rn-fields__sub">
            {fields.length} attribute{fields.length === 1 ? '' : 's'} on {entity.name}.
          </p>
        </div>
      </header>

      <div className="lob-activities__toolbar">
        <Input
          placeholder="Search by name"
          iconLeading={<Icon name="search" size={14} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={`Search ${entity.name} attributes by name`}
          className="lob-activities__search"
        />
        <button
          type="button"
          className="lob-activities__new-btn"
          onClick={() => setCreating(true)}
          disabled={creating}
        >
          <Icon name="plus" size={14} />
          New Attribute
        </button>
      </div>

      <div className="lob-activities__list">
        {creating && (
          <FieldForm
            mode="create"
            onCancel={() => setCreating(false)}
            onSave={(draft) => {
              onCreate(draft);
              setCreating(false);
            }}
          />
        )}

        {fields.length === 0 && !creating ? (
          <div className="lob-activities__empty">
            <p style={{ margin: 0 }}>No attributes on {entity.name} yet.</p>
            <Button
              variant="brand"
              iconLeading={<Icon name="plus" size={14} />}
              onClick={() => setCreating(true)}
            >
              New Attribute
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="lob-activities__empty">No attributes match "{query}".</div>
        ) : (
          visible.map((a) =>
            editingFieldId === a.id ? (
              <FieldForm
                key={a.id}
                mode="edit"
                initial={{
                  name: a.name,
                  canonicalNames: a.canonicalNames ?? [],
                }}
                onCancel={() => setEditingFieldId(null)}
                onSave={(draft) => onSaveEdit(a.id, draft)}
              />
            ) : (
              <FieldTile
                key={a.id}
                attribute={a}
                onOpen={() => setEditingFieldId(a.id)}
                menuOpen={openMenuId === a.id}
                onMenuToggle={(next) =>
                  setOpenMenuId(next ? a.id : openMenuId === a.id ? null : openMenuId)
                }
                onEdit={() => {
                  setOpenMenuId(null);
                  setEditingFieldId(a.id);
                }}
                onDelete={() => onDelete(a)}
              />
            ),
          )
        )}
      </div>
    </div>
  );
}

interface FieldTileProps {
  attribute: RnAttribute;
  onOpen: () => void;
  menuOpen: boolean;
  onMenuToggle: (next: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function FieldTile({
  attribute,
  onOpen,
  menuOpen,
  onMenuToggle,
  onEdit,
  onDelete,
}: FieldTileProps) {
  const canonicalNames = attribute.canonicalNames ?? [];
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
          <FieldMenu
            open={menuOpen}
            onToggle={onMenuToggle}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      </div>
      <div className="act-tile__name">
        <span className="act-tile__name-text">
          {attribute.name || 'Untitled attribute'}
        </span>
      </div>
      {canonicalNames.length === 0 ? (
        <div className="lob-stage-tile__sub">No alias</div>
      ) : (
        <div className="rn-tile__canonical">
          {canonicalNames.map((c, i) => (
            <Badge key={`${c}-${i}`}>{c}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

interface FieldDraft {
  name: string;
  canonicalNames: string[];
}

interface FieldFormProps {
  mode: 'create' | 'edit';
  initial?: FieldDraft;
  onCancel: () => void;
  onSave: (draft: FieldDraft) => void;
}

function FieldForm({ mode, initial, onCancel, onSave }: FieldFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [chips, setChips] = useState<string[]>(initial?.canonicalNames ?? []);

  const valid = name.trim().length > 0;

  return (
    <div className="rmdw-config-panel act-editor-panel">
      <button
        type="button"
        className="rmdw-cp-close"
        onClick={onCancel}
        aria-label="Close form"
        title="Close form"
      >
        <Icon name="close" size={16} />
      </button>

      <div className="act-editor-panel__body">
        <header className="act-col-header">
          <h4 className="act-col-title">
            {mode === 'create' ? 'New Attribute' : name || 'Untitled attribute'}
          </h4>
        </header>

        <Input
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Insured Name"
          fullWidth
        />
        <ChipInput
          label="Alias"
          hint="Alternate names this field is known by. Type and press Enter to add."
          chips={chips}
          onChange={setChips}
        />
      </div>

      <div className="act-editor-panel__footer">
        <Button variant="neutral" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="brand"
          disabled={!valid}
          onClick={() => onSave({ name: name.trim(), canonicalNames: chips })}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

interface ChipInputProps {
  label: string;
  hint?: string;
  chips: string[];
  onChange: (next: string[]) => void;
}

function ChipInput({ label, hint, chips, onChange }: ChipInputProps) {
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
      <div
        className="rn-chip-field__box"
        onClick={() => inputRef.current?.focus()}
      >
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

interface RowEditorProps {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

function RowEditor({
  value,
  placeholder,
  onChange,
  onCommit,
  onCancel,
}: RowEditorProps) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <div className="dc-row__editor" onClick={(e) => e.stopPropagation()}>
      <input
        ref={ref}
        className="dc-row__input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <button
        type="button"
        className="dc-row__icon-btn"
        aria-label="Save"
        title="Save"
        onClick={onCommit}
      >
        <Icon name="check" size={14} />
      </button>
      <button
        type="button"
        className="dc-row__icon-btn"
        aria-label="Cancel"
        title="Cancel"
        onClick={onCancel}
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}

interface RowMenuProps {
  ariaLabel: string;
  onEdit: (ev: React.MouseEvent) => void;
  onDelete: (ev: React.MouseEvent) => void;
}

function RowMenu({ ariaLabel, onEdit, onDelete }: RowMenuProps) {
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
              onEdit(e);
            }}
          >
            <Icon name="edit" size={14} />
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            className="dc-row__menu-item dc-row__menu-item--destructive"
            onClick={(e) => {
              setOpen(false);
              onDelete(e);
            }}
          >
            <Icon name="trash" size={14} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

interface FieldMenuProps {
  open: boolean;
  onToggle: (next: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function FieldMenu({ open, onToggle, onEdit, onDelete }: FieldMenuProps) {
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
