import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Checkbox, Icon, Input, Select, Textarea } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { ExtractionTemplate } from '@/types/config';
import '@/panels/RunMyDay/PlaybookWizard.css';
import '@/panels/ActivitiesAndStages/ActivitiesEntityEditor.css';
import '@/panels/LinesOfBusiness/LobActivitiesSection.css';
import '@/panels/LinesOfBusiness/LobStageManagementSection.css';

/**
 * Document Extraction → Extraction Templates section.
 * Mirrors the LOB Stage Management list: compact tiles with a Status badge
 * + kebab in the top-right and a "Doc category · Doc type" subline.
 *
 * The "+ New Extraction Template" button mounts an inline form above the
 * list (same chrome as the LOB stage / activity inline editors). Save
 * creates a shell template and stays on the hub; Save and Configure
 * (and tile clicks) open the Figma design for the field-mapping
 * experience in a new tab — there is no in-app detail page yet.
 */

const FIGMA_URL =
  'https://www.figma.com/design/Z3TQIILAR7ooadzuM7AR4u/264-Doc-Extraction?node-id=5-46683&t=bVqupHD7Nx5679Ze-0';

const openFigma = () => {
  window.open(FIGMA_URL, '_blank', 'noopener,noreferrer');
};

const MODEL_OPTIONS = [
  'Gemini 2.5',
  'Gemini 1.5 Pro',
  'GPT-4o',
  'Claude 3.5 Sonnet',
];


export function ExtractionTemplatesSection() {
  const { config, update } = useConfig();
  const [query, setQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const templates = useMemo(
    () =>
      (config.extractionTemplates ?? [])
        .slice()
        .sort((a, b) => b.id - a.id),
    [config.extractionTemplates],
  );

  const trimmed = query.trim().toLowerCase();
  const visible = trimmed
    ? templates.filter((t) => t.name.toLowerCase().includes(trimmed))
    : templates;

  const onDelete = (t: ExtractionTemplate) => {
    if (!confirm(`Delete extraction template "${t.name}"?`)) return;
    update((p) => ({
      ...p,
      extractionTemplates: (p.extractionTemplates ?? []).filter((x) => x.id !== t.id),
    }));
    setOpenMenuId(null);
  };

  const createTemplate = (draft: TemplateDraft): number => {
    let newId = 0;
    update((p) => {
      newId = p.nextExtractionTemplateId ?? 1;
      const next: ExtractionTemplate = {
        id: newId,
        name: draft.name.trim(),
        description: draft.description.trim(),
        model: draft.model,
        confidenceScoreThreshold: draft.confidenceScoreThreshold,
        documentCategory: draft.documentCategory,
        documentType: draft.documentType,
        active: draft.active,
      };
      return {
        ...p,
        extractionTemplates: [...(p.extractionTemplates ?? []), next],
        nextExtractionTemplateId: newId + 1,
      };
    });
    return newId;
  };

  return (
    <div className="lob-activities">
      <header className="lob-activities__header">
        <div>
          <h3 className="lob-activities__title">Extraction Templates</h3>
          <p className="lob-activities__sub">
            {templates.length} template{templates.length === 1 ? '' : 's'} configured. Each
            template maps a document category and type to a model and confidence threshold.
          </p>
        </div>
      </header>

      <div className="lob-activities__toolbar">
        <Input
          placeholder="Search by name"
          iconLeading={<Icon name="search" size={14} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search extraction templates by name"
          className="lob-activities__search"
        />
        <button
          type="button"
          className="lob-activities__new-btn"
          onClick={() => setCreating(true)}
          disabled={creating}
        >
          <Icon name="plus" size={14} />
          New Extraction Template
        </button>
      </div>

      <div className="lob-activities__list">
        {creating && (
          <NewTemplateForm
            onCancel={() => setCreating(false)}
            onSave={(draft) => {
              createTemplate(draft);
              setCreating(false);
            }}
            onSaveAndConfigure={(draft) => {
              createTemplate(draft);
              setCreating(false);
              openFigma();
            }}
          />
        )}

        {templates.length === 0 && !creating ? (
          <div className="lob-activities__empty">
            <p style={{ margin: 0 }}>No extraction templates configured yet.</p>
            <Button
              variant="brand"
              iconLeading={<Icon name="plus" size={14} />}
              onClick={() => setCreating(true)}
            >
              New Extraction Template
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="lob-activities__empty">No templates match "{query}".</div>
        ) : (
          visible.map((t) => (
            <TemplateTile
              key={t.id}
              template={t}
              onOpen={openFigma}
              menuOpen={openMenuId === t.id}
              onMenuToggle={(next) =>
                setOpenMenuId(next ? t.id : openMenuId === t.id ? null : openMenuId)
              }
              onEdit={() => {
                setOpenMenuId(null);
                openFigma();
              }}
              onDelete={() => onDelete(t)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface TileProps {
  template: ExtractionTemplate;
  onOpen: () => void;
  menuOpen: boolean;
  onMenuToggle: (next: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function TemplateTile({
  template,
  onOpen,
  menuOpen,
  onMenuToggle,
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
          {template.active ? (
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
        <span className="act-tile__name-text">{template.name || 'Untitled template'}</span>
      </div>
      <div className="lob-stage-tile__sub">
        {template.documentCategory || '—'} · {template.documentType || '—'}
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
        aria-label="Template actions"
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

interface TemplateDraft {
  name: string;
  description: string;
  model: string;
  confidenceScoreThreshold: number;
  documentCategory: string;
  documentType: string;
  active: boolean;
}

interface NewFormProps {
  onCancel: () => void;
  onSave: (draft: TemplateDraft) => void;
  onSaveAndConfigure: (draft: TemplateDraft) => void;
}

function NewTemplateForm({ onCancel, onSave, onSaveAndConfigure }: NewFormProps) {
  const { config } = useConfig();
  const taxonomy = config.documentTaxonomy ?? [];
  const categoryOptions = taxonomy.map((c) => c.name);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [model, setModel] = useState(MODEL_OPTIONS[0]);
  const [threshold, setThreshold] = useState('50');
  const [category, setCategory] = useState(categoryOptions[0] ?? '');
  const initialDocType =
    taxonomy.find((c) => c.name === categoryOptions[0])?.types[0] ?? '';
  const [docType, setDocType] = useState(initialDocType);
  const [active, setActive] = useState(true);

  const docTypeOptions =
    taxonomy.find((c) => c.name === category)?.types ?? [];
  // Reset doc type if the user picks a category that doesn't include the
  // currently selected type, or when the taxonomy changes underneath us.
  useEffect(() => {
    if (docTypeOptions.length === 0) {
      if (docType !== '') setDocType('');
      return;
    }
    if (!docTypeOptions.includes(docType)) setDocType(docTypeOptions[0]);
  }, [docTypeOptions, docType]);

  const numericThreshold = Number(threshold);
  const validThreshold =
    threshold !== '' &&
    !Number.isNaN(numericThreshold) &&
    numericThreshold >= 0 &&
    numericThreshold <= 100;
  const valid = name.trim().length > 0 && validThreshold;

  const draft: TemplateDraft = {
    name: name.trim(),
    description: description.trim(),
    model,
    confidenceScoreThreshold: numericThreshold,
    documentCategory: category,
    documentType: docType,
    active,
  };

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
          <h4 className="act-col-title">New Extraction Template</h4>
        </header>

        <div className="ext-form__section-head">Details</div>
        <div className="ext-form__row">
          <Input
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. ACORD 125 Extraction"
            fullWidth
          />
          <Textarea
            label="Description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this template extract?"
            fullWidth
          />
        </div>
        <div className="ext-form__row">
          <Select
            label="Model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            options={MODEL_OPTIONS.map((m) => ({ value: m, label: m }))}
          />
          <Input
            label="Confidence Score Threshold"
            type="number"
            min={0}
            max={100}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            hint="Score below which the extraction needs to be manually reviewed"
            error={
              !validThreshold && threshold !== ''
                ? 'Enter a value between 0 and 100.'
                : undefined
            }
            fullWidth
          />
        </div>

        <div className="ext-form__section-head">Classification</div>
        <div className="ext-form__row">
          <Select
            label="Document Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={
              categoryOptions.length === 0
                ? [{ value: '', label: 'No categories defined' }]
                : categoryOptions.map((c) => ({ value: c, label: c }))
            }
            disabled={categoryOptions.length === 0}
          />
          <Select
            label="Document Type"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            options={
              docTypeOptions.length === 0
                ? [{ value: '', label: 'No types defined' }]
                : docTypeOptions.map((d) => ({ value: d, label: d }))
            }
            disabled={docTypeOptions.length === 0}
          />
        </div>
        {(categoryOptions.length === 0 || docTypeOptions.length === 0) && (
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 'var(--slds-g-font-scale-neg-1)',
              color: 'var(--slds-g-color-on-surface-1)',
            }}
          >
            Define categories and types under{' '}
            <strong>Document Classification</strong> to populate these lists.
          </p>
        )}

        <div style={{ marginTop: 12 }}>
          <Checkbox
            label="Active"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
        </div>
      </div>

      <div className="act-editor-panel__footer">
        <Button variant="neutral" onClick={onCancel}>
          Cancel
        </Button>
        <span style={{ display: 'inline-flex', gap: 8 }}>
          <Button variant="neutral" disabled={!valid} onClick={() => onSave(draft)}>
            Save
          </Button>
          <Button
            variant="brand"
            disabled={!valid}
            onClick={() => onSaveAndConfigure(draft)}
          >
            Save and Configure
          </Button>
        </span>
      </div>
    </div>
  );
}
