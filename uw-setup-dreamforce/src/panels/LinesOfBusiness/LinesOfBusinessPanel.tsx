import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ThreePanelHub, type HubCategory, type HubSubcategory } from '@/components/ThreePanelHub';
import { openSetupAssistant } from '@/components/shell/setup-assistant-store';
import { Button, Card, Icon, Input, Modal, Textarea } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { IconName } from '@/components/ui';
import { LobStageManagementSection } from './LobStageManagementSection';
import { LobRnCategoriesSection } from './LobEnrichmentFieldsSection';
import { LobEnrichmentDefinitionsSection } from './LobEnrichmentDefinitionsSection';
// Deprecated legacy hierarchy editor — hidden from the hub but kept for now.
// import { LobHierarchySection } from './LobHierarchySection';
import { LobHierarchyV2Section } from './LobHierarchyV2Section';
import { LobLineTypesCoveragesSection } from './LobLineTypesCoveragesSection';
import './LinesOfBusiness.css';

/**
 * Lines of Business hub. Each LOB picklist value (sourced from
 * `Line_of_Business__c.picklistValues`) becomes a top-level card on the
 * landing grid. Selecting a card opens the working view; the per-card
 * kebab supports Edit (rename + reassign icon) and Delete.
 */
function lobKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

const LOB_ICONS: Record<string, IconName> = {
  'general liability': 'shield',
  'property': 'briefcase',
  'commercial property': 'briefcase',
  'cyber': 'plug',
};

/** Curated set of SLDS icons offered when creating or editing an LOB. Names
 * verified against Icon.tsx (inlined from @salesforce-ux/icons). */
const LOB_ICON_CHOICES: IconName[] = [
  'travel_and_places',
  'anchor',
  'target_mode',
  'locker_service',
  'proposition',
  'company',
  'partner_fund_request',
  'identified_guest',
  'wellness',
  'heart',
  'policy',
];

function resolveLobIcon(
  name: string,
  meta: Record<string, { icon?: string }> | undefined,
): IconName {
  const stored = meta?.[name]?.icon as IconName | undefined;
  if (stored && LOB_ICON_CHOICES.includes(stored)) return stored;
  return LOB_ICONS[name.toLowerCase()] ?? 'layers';
}

function SectionPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <header>
        <h3
          style={{
            margin: 0,
            fontSize: 'var(--slds-g-font-scale-2)',
            fontWeight: 'var(--slds-g-font-weight-6)',
            color: 'var(--slds-g-color-on-surface-3)',
          }}
        >
          {title}
        </h3>
        <p
          style={{
            margin: '4px 0 0',
            fontSize: 'var(--slds-g-font-scale-base)',
            color: 'var(--slds-g-color-on-surface-1)',
          }}
        >
          {description}
        </p>
      </header>
      <div
        style={{
          border: '1px dashed var(--slds-g-color-border-1)',
          borderRadius: 'var(--slds-g-radius-border-2)',
          padding: '40px 20px',
          textAlign: 'center',
          color: 'var(--slds-g-color-on-surface-1)',
          fontSize: 'var(--slds-g-font-scale-base)',
        }}
      >
        Coming soon.
      </div>
    </div>
  );
}

function buildSubcategories(lob: string): HubSubcategory[] {
  return [
    {
      key: `${lobKey(lob)}-rn-categories`,
      label: 'Attribute Categories',
      group: 'Line Of Business Definition',
      description: 'Normalization categories for this LOB.',
      render: () => <LobRnCategoriesSection lob={lob} />,
      info: { subject: 'lob-rn-categories', scope: lob, uploadCsv: true },
    },
    {
      key: `${lobKey(lob)}-line-types-coverages`,
      label: 'Line Definitions',
      group: 'Line Of Business Definition',
      description: 'Line definitions and coverage templates for this LOB.',
      render: () => <LobLineTypesCoveragesSection lob={lob} />,
      info: {
        subject: 'lob-line-types-coverages',
        scope: lob,
        uploadCsv: true,
      },
    },
    {
      key: `${lobKey(lob)}-hierarchy-v2`,
      label: 'Hierarchy',
      group: 'Line Of Business Definition',
      description: 'Reconciliation hierarchies for this LOB.',
      render: () => <LobHierarchyV2Section lob={lob} />,
      info: { subject: 'lob-hierarchy', scope: lob },
    },
    // Deprecated legacy single-hierarchy editor — hidden from the hub but kept
    // for now. Restore this entry (and the LobHierarchySection import) to re-expose.
    // {
    //   key: `${lobKey(lob)}-hierarchy`,
    //   label: 'Hierarchy [Deprecated]',
    //   group: 'Reconciliation And Normalization',
    //   description: 'Legacy single-hierarchy editor. Use Hierarchy instead.',
    //   render: () => <LobHierarchySection lob={lob} />,
    //   info: { subject: 'lob-hierarchy', scope: lob },
    // },
    {
      key: `${lobKey(lob)}-stage-management`,
      label: 'Stage Management',
      group: 'Stage Management',
      description: 'Stage configurations and transitions for this LOB.',
      render: () => <LobStageManagementSection lob={lob} />,
      info: { subject: 'lob-stage-management', scope: lob },
    },
    {
      key: `${lobKey(lob)}-enrichment-definitions`,
      label: 'Enrichment Definitions',
      group: 'Data Enrichment',
      description: 'Reusable enrichments tied to this LOB.',
      render: () => <LobEnrichmentDefinitionsSection lob={lob} />,
      info: { subject: 'lob-enrichment-definitions', scope: lob },
    },
  ];
}

interface LobFormState {
  /** Original name when editing — null when creating. */
  original: string | null;
  /** Current draft. */
  open: boolean;
}

export function LinesOfBusinessPanel() {
  const { config, update } = useConfig();
  const location = useLocation();
  const [form, setForm] = useState<LobFormState>({ original: null, open: false });
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);

  const initialFocus = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const lob = params.get('lob');
    if (!lob) return null;
    const section = params.get('section');
    return {
      categoryKey: lob,
      subcategoryKey: section ?? undefined,
    };
  }, [location.search]);

  const lobs = useMemo(
    () =>
      config.fields.find((f) => f.api === 'Line_of_Business__c')?.picklistValues ?? [],
    [config.fields],
  );

  const categories: HubCategory[] = useMemo(
    () =>
      lobs.map((lob) => {
        return {
        key: lobKey(lob),
        label: lob,
        icon: resolveLobIcon(lob, config.lobMeta),
        description: `Setup scoped to the ${lob} line of business.`,
        subcategories: buildSubcategories(lob),
        cardActions: (
          <LobCardMenu
            open={openMenuKey === lobKey(lob)}
            onToggle={(next) =>
              setOpenMenuKey(next ? lobKey(lob) : openMenuKey === lobKey(lob) ? null : openMenuKey)
            }
            onEdit={() => {
              setOpenMenuKey(null);
              setForm({ original: lob, open: true });
            }}
            onDelete={() => {
              setOpenMenuKey(null);
              if (
                !confirm(
                  `Delete LOB "${lob}"? This removes the picklist value and its stored icon. Existing data scoped to ${lob} stays in place but will no longer surface in this hub.`,
                )
              )
                return;
              update((prev) => {
                const fields = prev.fields.map((f) => {
                  if (f.api !== 'Line_of_Business__c') return f;
                  return {
                    ...f,
                    picklistValues: (f.picklistValues ?? []).filter((v) => v !== lob),
                  };
                });
                const meta = { ...(prev.lobMeta ?? {}) };
                delete meta[lob];
                return { ...prev, fields, lobMeta: meta };
              });
            }}
          />
        ),
        };
      }),
    [lobs, openMenuKey, config, update],
  );

  const onSubmit = (draft: LobDraft) => {
    const name = draft.name.trim();
    if (!name) return;
    const editing = form.original;
    update((prev) => {
      const fields = prev.fields.map((f) => {
        if (f.api !== 'Line_of_Business__c') return f;
        const values = f.picklistValues ?? [];
        let nextValues: string[];
        if (editing) {
          nextValues = values.map((v) => (v === editing ? name : v));
          if (!nextValues.includes(name)) nextValues = [...nextValues, name];
        } else {
          nextValues = values.includes(name) ? values : [...values, name];
        }
        return { ...f, picklistValues: nextValues };
      });
      const meta = { ...(prev.lobMeta ?? {}) };
      if (editing && editing !== name) delete meta[editing];
      meta[name] = {
        icon: draft.icon,
        apiName: draft.apiName.trim(),
        description: draft.description.trim(),
      };
      return { ...prev, fields, lobMeta: meta };
    });
    setForm({ original: null, open: false });
  };

  return (
    <div className="lob-page">
      <header className="lob-hero">
        <div className="lob-hero__inner">
          <h1 className="lob-hero__title">Lines of Business</h1>
          <p className="lob-hero__subtitle">
            Configure each line of business — activities and stages, enrichment, reconciliation —
            from one place. Pick an LOB to drill into its sections.
          </p>
        </div>
        <Card
          className="lob-hero__assistant"
          title="Get Setup Help"
          subtitle="The Setup Assistant walks you through configuring a line of business, picks reasonable defaults, and points to the section you need next."
          actions={
            <Button
              variant="brand"
              iconLeading={<Icon name="sparkles" size={14} />}
              onClick={() => openSetupAssistant()}
            >
              Launch Setup Assistant
            </Button>
          }
          padding="none"
        />
      </header>
      <ThreePanelHub
        categoriesTitle="Lines of Business"
        categories={categories}
        initialFocus={initialFocus}
        addCard={{
          key: 'add-lob',
          label: 'Add Line of Business',
          description: 'Register a new LOB picklist value.',
          onClick: () => setForm({ original: null, open: true }),
        }}
        categoriesAction={{
          label: 'New Line of Business',
          icon: 'plus',
          onClick: () => setForm({ original: null, open: true }),
        }}
      />
      <LobFormModal
        open={form.open}
        editing={form.original}
        editingIcon={
          form.original ? resolveLobIcon(form.original, config.lobMeta) : null
        }
        editingMeta={form.original ? config.lobMeta?.[form.original] ?? null : null}
        existingNames={lobs}
        onClose={() => setForm({ original: null, open: false })}
        onSave={onSubmit}
      />
      {lobs.length === 0 && (
        <div className="lob-page__empty-hint" role="note">
          <Icon name="help" size={14} /> No LOB picklist values yet — use{' '}
          <button
            type="button"
            className="lob-page__empty-link"
            onClick={() => setForm({ original: null, open: true })}
          >
            Add Line of Business
          </button>{' '}
          to create one.
        </div>
      )}
    </div>
  );
}

interface LobCardMenuProps {
  open: boolean;
  onToggle: (next: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function LobCardMenu({ open, onToggle, onEdit, onDelete }: LobCardMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDocClick = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) onToggle(false);
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
    <div className="lob-card-menu" ref={ref}>
      <button
        type="button"
        className="lob-card-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Line of business actions"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(!open);
        }}
      >
        <Icon name="chevron-down" size={14} />
      </button>
      {open && (
        <div className="lob-card-menu__panel" role="menu">
          <button
            type="button"
            role="menuitem"
            className="lob-card-menu__item"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Icon name="edit" size={14} />
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            className="lob-card-menu__item lob-card-menu__item--destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
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

interface LobDraft {
  name: string;
  apiName: string;
  description: string;
  icon: IconName;
}

interface LobMeta {
  icon?: string;
  apiName?: string;
  description?: string;
}

interface LobFormModalProps {
  open: boolean;
  editing: string | null;
  editingIcon: IconName | null;
  editingMeta: LobMeta | null;
  existingNames: string[];
  onClose: () => void;
  onSave: (draft: LobDraft) => void;
}

/** Derive a default API Name from a label: "Commercial Property" → "Commercial_Property__c". */
function deriveApiName(label: string): string {
  const core = label
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return core ? `${core}__c` : '';
}

function LobFormModal({
  open,
  editing,
  editingIcon,
  editingMeta,
  existingNames,
  onClose,
  onSave,
}: LobFormModalProps) {
  const [name, setName] = useState('');
  const [apiName, setApiName] = useState('');
  const [apiTouched, setApiTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<IconName>(LOB_ICON_CHOICES[0]);

  useEffect(() => {
    if (!open) return;
    setName(editing ?? '');
    setApiName(editingMeta?.apiName ?? (editing ? deriveApiName(editing) : ''));
    setApiTouched(!!editingMeta?.apiName);
    setDescription(editingMeta?.description ?? '');
    setIcon((editingIcon as IconName | null) ?? LOB_ICON_CHOICES[0]);
  }, [open, editing, editingIcon, editingMeta]);

  const trimmed = name.trim();
  const collidesWithOther = existingNames.some(
    (n) => n.toLowerCase() === trimmed.toLowerCase() && n !== editing,
  );
  const valid = trimmed.length > 0 && !collidesWithOther;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit Line of Business · ${editing}` : 'Add Line of Business'}
      footer={
        <>
          <Button variant="neutral" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="brand"
            disabled={!valid}
            onClick={() => onSave({ name: trimmed, apiName, description, icon })}
          >
            Save
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input
          label="Label"
          required
          value={name}
          placeholder="e.g. Cyber"
          onChange={(e) => {
            const next = e.target.value;
            setName(next);
            // Keep the API Name in sync until the user edits it directly.
            if (!apiTouched) setApiName(deriveApiName(next));
          }}
          error={collidesWithOther ? 'Another LOB already uses this name.' : undefined}
        />
        <Input
          label="API Name"
          value={apiName}
          placeholder="e.g. Cyber__c"
          onChange={(e) => {
            setApiTouched(true);
            setApiName(e.target.value);
          }}
        />
        <Textarea
          label="Description"
          value={description}
          rows={3}
          placeholder="What this line of business covers"
          onChange={(e) => setDescription(e.target.value)}
        />
        <div>
          <div className="lob-form__icon-label">Icon</div>
          <div className="lob-form__icon-grid" role="radiogroup" aria-label="Pick an icon">
            {LOB_ICON_CHOICES.map((name) => {
              const selected = icon === name;
              return (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={[
                    'lob-form__icon-tile',
                    selected ? 'lob-form__icon-tile--selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setIcon(name)}
                  aria-label={name}
                  title={name}
                >
                  <Icon name={name} size={20} />
                </button>
              );
            })}
          </div>
        </div>
        {!editing && (
          <p
            style={{
              margin: 0,
              fontSize: 'var(--slds-g-font-scale-neg-1)',
              color: 'var(--slds-g-color-on-surface-1)',
            }}
          >
            Added as a new value on the Submission <code>Line_of_Business__c</code> picklist.
          </p>
        )}
      </div>
    </Modal>
  );
}
