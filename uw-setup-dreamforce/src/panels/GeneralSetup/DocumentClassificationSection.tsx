import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Card, Icon, Input, Modal, Table } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { DocumentCategory } from '@/types/config';
import '@/panels/LinesOfBusiness/LobActivitiesSection.css';
import './DocumentClassification.css';

/** Prompt Templates available to the Doc Summary Prompt lookup. There is no
 * Prompt Templates entity in the schema yet — this is a curated catalog of the
 * summary templates the platform ships. User-created templates
 * (`documentSummaryPromptTemplates`) are merged on top at render time. */
export const PROMPT_TEMPLATES = [
  'Document Summary — Standard',
  'Document Summary — Detailed',
  'ACORD Extraction Summary',
  'SOV Summary',
  'Loss Run Summary',
  'Risk Narrative Summary',
  'Coverage Comparison Summary',
];

/** Types can repeat across categories, so key per-type prompts by both. */
function summaryPromptKey(category: string, type: string): string {
  return `${category}::${type}`;
}

/**
 * Doc Summary Prompt — a 30:70 two-column editor mirroring Document
 * Classification. The left column lists Document Categories; selecting one
 * reveals a two-column table on the right (Doc Type → Prompt Template). Each
 * prompt-template cell is a Salesforce-style inline-edit lookup: a pencil
 * surfaces on hover and swaps the cell for a searchable prompt-template
 * lookup. Selections persist to `documentSummaryPrompts`, keyed by
 * `category::type`.
 */
export function DocumentSummaryPromptSection() {
  const { config, update } = useConfig();
  const taxonomy = config.documentTaxonomy ?? [];
  const prompts = config.documentSummaryPrompts ?? {};
  const [focusedName, setFocusedName] = useState<string | null>(
    () => taxonomy[0]?.name ?? null,
  );

  // Curated catalog + user-created templates, de-duped case-insensitively.
  const templates = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of [...PROMPT_TEMPLATES, ...(config.documentSummaryPromptTemplates ?? [])]) {
      const key = t.trim().toLowerCase();
      if (!t.trim() || seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
    return out;
  }, [config.documentSummaryPromptTemplates]);

  /** Persist a newly-created template name (if not already known). */
  const createTemplate = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const exists = templates.some((t) => t.toLowerCase() === trimmed.toLowerCase());
    if (exists) return;
    update((p) => ({
      ...p,
      documentSummaryPromptTemplates: [
        ...(p.documentSummaryPromptTemplates ?? []),
        trimmed,
      ],
    }));
  };

  // Re-anchor focus if the focused category disappears.
  useEffect(() => {
    if (focusedName != null && !taxonomy.find((c) => c.name === focusedName)) {
      setFocusedName(taxonomy[0]?.name ?? null);
    }
  }, [taxonomy, focusedName]);

  const focused = useMemo(
    () => taxonomy.find((c) => c.name === focusedName) ?? null,
    [taxonomy, focusedName],
  );

  const setPrompt = (type: string, template: string) => {
    if (!focused) return;
    const key = summaryPromptKey(focused.name, type);
    update((p) => {
      const next = { ...(p.documentSummaryPrompts ?? {}) };
      if (template) next[key] = template;
      else delete next[key];
      return { ...p, documentSummaryPrompts: next };
    });
  };

  const defaultTemplate = config.documentSummaryDefaultTemplate ?? '';
  const [editingDefault, setEditingDefault] = useState(false);
  const setDefaultTemplate = (template: string) => {
    update((p) => ({ ...p, documentSummaryDefaultTemplate: template }));
  };

  return (
    <div className="lob-activities">
      <header className="lob-activities__header">
        <div>
          <h3 className="lob-activities__title">Doc Summary Prompt</h3>
          <p className="lob-activities__sub">
            Assign the prompt template used to summarize each document type.
            Pick a category on the left, then set a template per type.
          </p>
        </div>
      </header>

      <div className="dc-threshold dsp-default">
        <div className="dc-threshold__label">Default Prompt Template</div>
        {editingDefault ? (
          <div className="dc-threshold__edit-row">
            <div className="dsp-default__lookup">
              <PromptTemplateLookup
                value={defaultTemplate}
                templates={templates}
                onChange={(v) => {
                  setDefaultTemplate(v);
                  setEditingDefault(false);
                }}
                onCreateTemplate={createTemplate}
                onCancel={() => setEditingDefault(false)}
              />
            </div>
          </div>
        ) : (
          <div className="dc-threshold__edit-row">
            <span className="dc-threshold__value">
              {defaultTemplate || <span className="dsp-cell__placeholder">Not set</span>}
            </span>
            <button
              type="button"
              className="dc-inline-edit"
              onClick={() => setEditingDefault(true)}
              aria-label="Edit Default Prompt Template"
              title="Edit"
            >
              <Icon name="edit" size={14} />
            </button>
          </div>
        )}
        <p className="dc-threshold__hint">
          This template will be used when no prompt template is assigned to a document type.
        </p>
      </div>

      <div className="dsp">
        <div className="dsp__left">
          <div className="dsp__head">Doc Category</div>
          <div className="dsp__list">
            {taxonomy.length === 0 ? (
              <div className="dsp-empty">No document categories configured yet.</div>
            ) : (
              taxonomy.map((c) => {
                const isFocused = focusedName === c.name;
                return (
                  <div
                    key={c.name}
                    className={['dc-row', isFocused ? 'dc-row--focus' : '']
                      .filter(Boolean)
                      .join(' ')}
                    role="button"
                    tabIndex={0}
                    onClick={() => setFocusedName(c.name)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        setFocusedName(c.name);
                      }
                    }}
                  >
                    <span className="dc-row__label">{c.name}</span>
                    <span className="dc-row__count">{c.types.length}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="dsp__right">
          <div className="dsp__head">Doc Summary Prompt</div>
          {!focused ? (
            <div className="dsp-empty">Select a category to assign prompt templates.</div>
          ) : (
            <Table
              columns={[
                {
                  key: 'type',
                  header: 'Doc Type',
                  width: '40%',
                  render: (t: string) => <span className="dsp-cell--type">{t}</span>,
                },
                {
                  key: 'prompt',
                  header: 'Prompt Template',
                  render: (t: string) => (
                    <DspPromptCell
                      type={t}
                      template={prompts[summaryPromptKey(focused.name, t)] ?? ''}
                      templates={templates}
                      onChange={(v) => setPrompt(t, v)}
                      onCreateTemplate={createTemplate}
                    />
                  ),
                },
              ]}
              rows={focused.types}
              rowKey={(t) => t}
              empty={`No document types in ${focused.name}.`}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** Prompt-template cell: read view (value + hover pencil) ↔ inline lookup. */
function DspPromptCell({
  type,
  template,
  templates,
  onChange,
  onCreateTemplate,
}: {
  type: string;
  template: string;
  templates: string[];
  onChange: (v: string) => void;
  onCreateTemplate: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="dsp-cell--prompt">
      {editing ? (
        <PromptTemplateLookup
          value={template}
          templates={templates}
          onChange={(v) => {
            onChange(v);
            setEditing(false);
          }}
          onCreateTemplate={onCreateTemplate}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <span className="dsp-cell__value">
            {template || <span className="dsp-cell__placeholder">—</span>}
          </span>
          <button
            type="button"
            className="dsp-cell__edit"
            onClick={() => setEditing(true)}
            aria-label={`Edit prompt template for ${type}`}
            title="Edit"
          >
            <Icon name="edit" size={13} />
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Salesforce-style inline lookup for a prompt template. Opens immediately on
 * mount (the cell is already in edit mode), filters the catalog as you type,
 * and commits on pick. A pinned "New Prompt Template" action at the bottom of
 * the menu opens a create modal, then auto-selects the new template — the
 * standard SLDS lookup create flow. Clicking outside or pressing Escape
 * cancels. Reuses the portalled `slds2-dropdown__menu` styling.
 */
export function PromptTemplateLookup({
  value,
  templates,
  onChange,
  onCreateTemplate,
  onCancel,
}: {
  value: string;
  templates: string[];
  onChange: (v: string) => void;
  onCreateTemplate: (name: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => t.toLowerCase().includes(q));
  }, [templates, query]);

  // Focus the input as soon as the cell enters edit mode.
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Position the portalled menu under the input and keep it anchored.
  useEffect(() => {
    const place = () => {
      const t = inputRef.current;
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
  }, []);

  useEffect(() => {
    // While the create modal is open, don't treat clicks/Escape as a cancel of
    // the lookup — the modal owns those interactions.
    if (creating) return;
    const onDocClick = (ev: MouseEvent) => {
      const target = ev.target as Node;
      const inRoot = rootRef.current?.contains(target) ?? false;
      const inMenu = menuRef.current?.contains(target) ?? false;
      if (!inRoot && !inMenu) onCancel();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onCancel();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onCancel, creating]);

  const onCreated = (name: string) => {
    onCreateTemplate(name);
    setCreating(false);
    onChange(name.trim());
  };

  return (
    <div className="slds2-dropdown slds2-dropdown--full" ref={rootRef} style={{ width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <span
          style={{
            position: 'absolute',
            top: '50%',
            left: 10,
            transform: 'translateY(-50%)',
            display: 'flex',
            color: 'var(--slds-g-color-on-surface-2)',
            pointerEvents: 'none',
          }}
        >
          <Icon name="search" size={14} />
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={value || 'Search Prompt Templates…'}
          aria-label="Search prompt templates"
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: '100%',
            minHeight: 32,
            padding: '6px 10px 6px 32px',
            fontFamily: 'var(--slds-g-font-family-base)',
            fontSize: 'var(--slds-g-font-scale-neg-1)',
            color: 'var(--slds-g-color-on-surface-1)',
            background: 'var(--slds-g-color-surface-1)',
            border: '1px solid var(--slds-g-color-accent-1)',
            borderRadius: 'var(--slds-g-radius-border-2)',
            outline: 'none',
          }}
        />
      </div>
      {rect &&
        createPortal(
          <div
            className="slds2-dropdown__menu"
            role="listbox"
            ref={menuRef}
            style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width }}
          >
            {value && (
              <div
                className="slds2-dropdown__option"
                role="option"
                aria-selected={false}
                onClick={() => onChange('')}
                style={{ color: 'var(--slds-g-color-on-surface-2)' }}
              >
                <span
                  className="slds2-dropdown__option-label"
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Icon name="close" size={13} />
                  Clear selection
                </span>
              </div>
            )}
            {matches.length === 0 ? (
              <div
                style={{
                  padding: '8px 10px',
                  fontSize: 'var(--slds-g-font-scale-neg-1)',
                  color: 'var(--slds-g-color-on-surface-3)',
                }}
              >
                No matching templates.
              </div>
            ) : (
              matches.map((t) => {
                const selected = t === value;
                return (
                  <div
                    key={t}
                    role="option"
                    aria-selected={selected}
                    className="slds2-dropdown__option"
                    onClick={() => onChange(t)}
                  >
                    <span
                      className="slds2-dropdown__option-label"
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <Icon name="doc" size={13} />
                      {t}
                    </span>
                    {selected && <Icon name="check" size={13} />}
                  </div>
                );
              })
            )}
            <div
              className="slds2-dropdown__option"
              role="option"
              aria-selected={false}
              onClick={() => setCreating(true)}
              style={{
                borderTop: '1px solid var(--slds-g-color-border-1)',
                color: 'var(--slds-g-color-accent-1)',
              }}
            >
              <span
                className="slds2-dropdown__option-label"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: 'var(--slds-g-color-accent-1)',
                  fontWeight: 'var(--slds-g-font-weight-6)',
                }}
              >
                <Icon name="plus" size={13} />
                New Prompt Template
              </span>
            </div>
          </div>,
          document.body,
        )}
      {creating && (
        <NewTemplateModal
          onCancel={() => setCreating(false)}
          onSave={onCreated}
          existing={templates}
        />
      )}
    </div>
  );
}

/** Create-a-template modal launched from the lookup's "New Prompt Template"
 * action. On save it persists the name and auto-selects it — the standard
 * Salesforce lookup create flow. */
export function NewTemplateModal({
  onCancel,
  onSave,
  existing,
}: {
  onCancel: () => void;
  onSave: (name: string) => void;
  existing: string[];
}) {
  const [name, setName] = useState('');
  const trimmed = name.trim();
  const collides = existing.some((t) => t.toLowerCase() === trimmed.toLowerCase());
  const valid = trimmed.length > 0 && !collides;
  return (
    <Modal
      open
      onClose={onCancel}
      size="sm"
      title="New Prompt Template"
      footer={
        <>
          <Button variant="neutral" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="brand" disabled={!valid} onClick={() => valid && onSave(trimmed)}>
            Save
          </Button>
        </>
      }
    >
      <Input
        label="Template Name"
        required
        autoFocus
        value={name}
        placeholder="e.g. Property Risk Summary"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && valid) onSave(trimmed);
        }}
        error={collides ? 'A template with this name already exists.' : undefined}
      />
      <p
        style={{
          margin: '8px 0 0',
          fontSize: 'var(--slds-g-font-scale-neg-1)',
          color: 'var(--slds-g-color-on-surface-1)',
        }}
      >
        The new template will be created and selected for this document type.
      </p>
    </Modal>
  );
}

/**
 * Document Classification configuration.
 *
 * Two cards:
 *   1. **Settings** — global confidence threshold (0–100). Score below this
 *      routes the document to manual classification.
 *   2. **Taxonomy** — two-column layout. Left column lists Document
 *      Categories (parent), right column lists Document Types under the
 *      focused category. Add/rename/delete on either column. Reused by
 *      Extraction Templates (DOCUMENT_CATEGORIES + types) when available.
 */
export function DocumentClassificationSection() {
  return (
    <div className="dc-section">
      <ThresholdCard />
      <TaxonomyCard />
    </div>
  );
}

function ThresholdCard() {
  const { config, update } = useConfig();
  const stored = config.documentClassificationThreshold ?? 50;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(stored));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) {
      setValue(String(stored));
      setError(null);
    }
  }, [stored, editing]);

  const onSave = () => {
    const numeric = Number(value);
    if (Number.isNaN(numeric) || numeric < 0 || numeric > 100) {
      setError('Enter a value between 0 and 100.');
      return;
    }
    update((p) => ({ ...p, documentClassificationThreshold: numeric }));
    setEditing(false);
    setError(null);
  };

  const onCancel = () => {
    setValue(String(stored));
    setEditing(false);
    setError(null);
  };

  return (
    <Card padding="md">
      <div className="dc-threshold">
        <div className="dc-threshold__label">Classification Confidence Score</div>
        {editing ? (
          <div className="dc-threshold__edit-row">
            <Input
              type="number"
              min={0}
              max={100}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              error={error ?? undefined}
              aria-label="Classification Confidence Score"
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
            <span className="dc-threshold__value">{stored}</span>
            <button
              type="button"
              className="dc-inline-edit"
              onClick={() => setEditing(true)}
              aria-label="Edit Classification Confidence Score"
              title="Edit"
            >
              <Icon name="edit" size={14} />
            </button>
          </div>
        )}
        <p className="dc-threshold__hint">
          Score below which a classification will be routed for manual classification.
        </p>
      </div>
    </Card>
  );
}


function defaultTaxonomy(): DocumentCategory[] {
  return [];
}

function TaxonomyCard() {
  const { config, update } = useConfig();
  const taxonomy = config.documentTaxonomy ?? defaultTaxonomy();
  const [focusedName, setFocusedName] = useState<string | null>(
    () => taxonomy[0]?.name ?? null,
  );
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [catDraft, setCatDraft] = useState('');
  const [editingType, setEditingType] = useState<string | null>(null);
  const [typeDraft, setTypeDraft] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [addingType, setAddingType] = useState(false);
  const [newType, setNewType] = useState('');

  // Re-anchor focus if the focused category disappears (rename / delete).
  useEffect(() => {
    if (focusedName != null && !taxonomy.find((c) => c.name === focusedName)) {
      setFocusedName(taxonomy[0]?.name ?? null);
    }
  }, [taxonomy, focusedName]);

  const focused = useMemo(
    () => taxonomy.find((c) => c.name === focusedName) ?? null,
    [taxonomy, focusedName],
  );

  const persistTaxonomy = (next: DocumentCategory[]) => {
    update((p) => ({ ...p, documentTaxonomy: next }));
  };

  const onAddCategory = () => {
    const name = newCategory.trim();
    if (!name) return;
    if (taxonomy.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      alert(`A category named "${name}" already exists.`);
      return;
    }
    persistTaxonomy([{ name, types: [] }, ...taxonomy]);
    setFocusedName(name);
    setNewCategory('');
    setAddingCategory(false);
  };

  const onRenameCategory = (orig: string) => {
    const name = catDraft.trim();
    if (!name) {
      setEditingCat(null);
      return;
    }
    if (
      taxonomy.some(
        (c) => c.name !== orig && c.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      alert(`A category named "${name}" already exists.`);
      return;
    }
    persistTaxonomy(
      taxonomy.map((c) => (c.name === orig ? { ...c, name } : c)),
    );
    if (focusedName === orig) setFocusedName(name);
    setEditingCat(null);
  };

  const onDeleteCategory = (name: string) => {
    if (
      !confirm(
        `Delete category "${name}"? Its document types will be removed too.`,
      )
    )
      return;
    persistTaxonomy(taxonomy.filter((c) => c.name !== name));
  };

  const onAddType = () => {
    if (!focused) return;
    const t = newType.trim();
    if (!t) return;
    if (focused.types.some((x) => x.toLowerCase() === t.toLowerCase())) {
      alert(`"${t}" already exists in this category.`);
      return;
    }
    persistTaxonomy(
      taxonomy.map((c) =>
        c.name === focused.name ? { ...c, types: [t, ...c.types] } : c,
      ),
    );
    setNewType('');
    setAddingType(false);
  };

  const onRenameType = (orig: string) => {
    if (!focused) return;
    const t = typeDraft.trim();
    if (!t) {
      setEditingType(null);
      return;
    }
    if (
      focused.types.some(
        (x) => x !== orig && x.toLowerCase() === t.toLowerCase(),
      )
    ) {
      alert(`"${t}" already exists in this category.`);
      return;
    }
    persistTaxonomy(
      taxonomy.map((c) =>
        c.name === focused.name
          ? { ...c, types: c.types.map((x) => (x === orig ? t : x)) }
          : c,
      ),
    );
    setEditingType(null);
  };

  const onDeleteType = (t: string) => {
    if (!focused) return;
    if (!confirm(`Delete document type "${t}"?`)) return;
    persistTaxonomy(
      taxonomy.map((c) =>
        c.name === focused.name
          ? { ...c, types: c.types.filter((x) => x !== t) }
          : c,
      ),
    );
  };

  return (
    <Card
      className="dc-taxonomy-card"
      title={<span className="dc-taxonomy-title">Document Taxonomy</span>}
      subtitle="Define the document categories the classifier supports, and the types within each. Extraction templates pick from this list."
      padding="none"
    >
      <div className="dc-taxonomy">
        <Column
          title="Document Category"
          count={taxonomy.length}
          onAdd={() => {
            setAddingCategory(true);
            setNewCategory('');
          }}
        >
          {addingCategory && (
            <div className="dc-row dc-row--editing">
              <RowEditor
                placeholder="Category name"
                value={newCategory}
                onChange={setNewCategory}
                onCommit={onAddCategory}
                onCancel={() => {
                  setAddingCategory(false);
                  setNewCategory('');
                }}
              />
            </div>
          )}
          {taxonomy.length === 0 && !addingCategory ? (
            <div className="dc-empty">No categories yet. Add one to get started.</div>
          ) : (
            taxonomy.map((c) => {
              const isFocused = focusedName === c.name;
              const isEditing = editingCat === c.name;
              const startEdit = () => {
                setCatDraft(c.name);
                setEditingCat(c.name);
              };
              return (
                <div
                  key={c.name}
                  className={[
                    'dc-row',
                    isFocused ? 'dc-row--focus' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!isEditing) setFocusedName(c.name);
                  }}
                  onDoubleClick={() => {
                    if (!isEditing) startEdit();
                  }}
                  onKeyDown={(ev) => {
                    if (isEditing) return;
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      setFocusedName(c.name);
                    }
                  }}
                >
                  {isEditing ? (
                    <RowEditor
                      value={catDraft}
                      onChange={setCatDraft}
                      onCommit={() => onRenameCategory(c.name)}
                      onCancel={() => setEditingCat(null)}
                    />
                  ) : (
                    <>
                      <span className="dc-row__label">{c.name}</span>
                      <span className="dc-row__count">{c.types.length}</span>
                      <RowMenu
                        ariaLabel={`${c.name} actions`}
                        onEdit={(e) => {
                          e.stopPropagation();
                          startEdit();
                        }}
                        onDelete={(e) => {
                          e.stopPropagation();
                          onDeleteCategory(c.name);
                        }}
                      />
                    </>
                  )}
                </div>
              );
            })
          )}
        </Column>

        <Column
          title="Document Type"
          subtitle={
            focused
              ? `Types under ${focused.name} · Double click to edit`
              : 'Pick a category on the left'
          }
          count={focused?.types.length ?? 0}
          disabled={!focused}
          onAdd={() => {
            if (!focused) return;
            setAddingType(true);
            setNewType('');
          }}
        >
          {addingType && (
            <div className="dc-row dc-row--editing">
              <RowEditor
                placeholder="Document type name"
                value={newType}
                onChange={setNewType}
                onCommit={onAddType}
                onCancel={() => {
                  setAddingType(false);
                  setNewType('');
                }}
              />
            </div>
          )}
          {!focused ? (
            <div className="dc-empty">Select a category to manage its types.</div>
          ) : focused.types.length === 0 && !addingType ? (
            <div className="dc-empty">No types yet for this category.</div>
          ) : (
            focused.types.map((t) => {
              const isEditing = editingType === t;
              const startEdit = () => {
                setTypeDraft(t);
                setEditingType(t);
              };
              return (
                <div
                  key={t}
                  className={['dc-row', isEditing ? 'dc-row--editing' : ''].filter(Boolean).join(' ')}
                  role={isEditing ? undefined : 'button'}
                  tabIndex={isEditing ? -1 : 0}
                  onDoubleClick={() => {
                    if (!isEditing) startEdit();
                  }}
                  onKeyDown={(ev) => {
                    if (isEditing) return;
                    if (ev.key === 'Enter') {
                      ev.preventDefault();
                      startEdit();
                    }
                  }}
                >
                  {isEditing ? (
                    <RowEditor
                      value={typeDraft}
                      onChange={setTypeDraft}
                      onCommit={() => onRenameType(t)}
                      onCancel={() => setEditingType(null)}
                    />
                  ) : (
                    <>
                      <span className="dc-row__label">{t}</span>
                      <RowMenu
                        ariaLabel={`${t} actions`}
                        onEdit={(e) => {
                          e.stopPropagation();
                          startEdit();
                        }}
                        onDelete={(e) => {
                          e.stopPropagation();
                          onDeleteType(t);
                        }}
                      />
                    </>
                  )}
                </div>
              );
            })
          )}
        </Column>
      </div>
    </Card>
  );
}

interface ColumnProps {
  title: string;
  subtitle?: string;
  count: number;
  disabled?: boolean;
  onAdd: () => void;
  children: React.ReactNode;
}

export function Column({ title, subtitle, count, disabled, onAdd, children }: ColumnProps) {
  const defaultSub = `${count} ${count === 1 ? 'item' : 'items'}${
    count > 0 ? ' · Double click to edit' : ''
  }`;
  return (
    <div className={['dc-col', disabled ? 'dc-col--disabled' : ''].filter(Boolean).join(' ')}>
      <header className="dc-col__head">
        <div className="dc-col__title-block">
          <h4 className="dc-col__title">{title}</h4>
          <span className="dc-col__sub">{subtitle ?? defaultSub}</span>
        </div>
        <button
          type="button"
          className="dc-col__add"
          onClick={onAdd}
          disabled={disabled}
        >
          <Icon name="plus" size={14} />
          Add
        </button>
      </header>
      <div className="dc-col__list">{children}</div>
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

export function RowEditor({ value, placeholder, onChange, onCommit, onCancel }: RowEditorProps) {
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

export function RowMenu({ ariaLabel, onEdit, onDelete }: RowMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDocClick = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) setOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => {
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
