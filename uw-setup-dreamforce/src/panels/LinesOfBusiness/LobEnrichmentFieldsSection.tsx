import { useMemo, useRef, useState } from 'react';
import { Button, Icon, Input, Modal, Textarea } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { EnrichmentCategory, EnrichmentConfig } from '@/types/config';
import { TileMenu } from './LobHierarchySection';
import '@/panels/ActivitiesAndStages/ActivitiesEntityEditor.css';
import '@/panels/GeneralSetup/Reconciliation.css';
import './LobActivitiesSection.css';
import './LobLineTypesCoverages.css';

/**
 * LOB → Reconciliation And Normalization → Categories.
 *
 * Attribute Categories (PRD §11.4.3) as a tile list + modal form, mirroring
 * Line Types and Coverages. Each category is a per-LOB grouping of canonical
 * attributes (Valuation, Construction, Protection, …). The tile opens a modal
 * with the §11.4.3 fields: Label, Developer Name, Description, Display Order,
 * Source. `name` stays the canonical key (kept in sync with `label`) since
 * downstream consumers — the Line Types & Coverages category picker and
 * enrichment definitions — key on it. Existing categories are shown in the new
 * format by deriving missing metadata from `name`; the derived values persist
 * on first save.
 */

interface Props {
  lob: string;
  /** Submission-scoped variant: labels the scope as the parent Submission
   * instead of a line of business. Used by the Submission Settings hub. */
  submissionMode?: boolean;
}

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

/** Display view of a category with §11.4.3 metadata filled in. */
function catLabel(c: EnrichmentCategory): string {
  return c.label?.trim() || c.name;
}
function catDevName(c: EnrichmentCategory): string {
  return c.developerName?.trim() || slugify(c.name);
}
function catSource(c: EnrichmentCategory): 'OOTB' | 'User-defined' {
  return c.source ?? 'OOTB';
}

export function LobRnCategoriesSection({ lob, submissionMode = false }: Props) {
  const scopeLabel = submissionMode ? 'Submission' : lob;
  const { config, update } = useConfig();
  const [modalCat, setModalCat] = useState<EnrichmentCategory | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const lobs = useMemo(
    () => config.enrichmentConfigs.map((c) => c.lob),
    [config.enrichmentConfigs],
  );
  const resolvedLob = useMemo(() => resolveEnrichmentLob(lob, lobs), [lob, lobs]);
  const cfg = useMemo<EnrichmentConfig | null>(
    () =>
      resolvedLob
        ? config.enrichmentConfigs.find((c) => c.lob === resolvedLob) ?? null
        : null,
    [config.enrichmentConfigs, resolvedLob],
  );

  // Attribute categories are shared across the parent Submission and every LOB:
  // create or edit one anywhere and it is available everywhere. The visible list
  // is the union of categories across all scopes, deduped by id; writes are
  // mirrored to every scope (see onSave / onDelete) so downstream pickers stay in
  // sync while each scope keeps its own per-category `fields`.
  const sharedCategories = useMemo(() => {
    const byId = new Map<string, EnrichmentCategory>();
    for (const c of config.enrichmentConfigs) {
      for (const cat of c.categories) {
        if (!byId.has(cat.id)) byId.set(cat.id, cat);
      }
    }
    return Array.from(byId.values());
  }, [config.enrichmentConfigs]);

  const categories = useMemo(() => {
    const list = sharedCategories.slice();
    return list.sort((a, b) => {
      const oa = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
      const ob = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
      if (oa !== ob) return oa - ob;
      return catLabel(a).localeCompare(catLabel(b));
    });
  }, [sharedCategories]);

  const trimmed = query.trim().toLowerCase();
  const visible = trimmed
    ? categories.filter(
        (c) =>
          catLabel(c).toLowerCase().includes(trimmed) ||
          catDevName(c).toLowerCase().includes(trimmed),
      )
    : categories;

  // Either no config exists for this LOB, or the picklist mapping found
  // nothing usable. Offer a one-click Initialize to bootstrap a row.
  if (!cfg) {
    return (
      <div className="lob-activities">
        <header className="lob-activities__header">
          <div>
            <h3 className="lob-activities__title">{scopeLabel} — Attribute Categories</h3>
            <p className="lob-activities__sub">
              {resolvedLob
                ? `No category config found for ${scopeLabel}.`
                : `Categories not configured for ${scopeLabel} yet.`}
            </p>
          </div>
        </header>
        <div className="lob-activities__empty">
          <p style={{ margin: 0 }}>Nothing to configure yet.</p>
          <Button
            variant="brand"
            iconLeading={<Icon name="plus" size={14} />}
            onClick={() =>
              update((p) => ({
                ...p,
                enrichmentConfigs: [
                  ...p.enrichmentConfigs,
                  {
                    id: p.nextEnrichmentConfigId,
                    lob,
                    active: true,
                    categories: sharedCategories.map((c) => ({ ...c, fields: [] })),
                  },
                ],
                nextEnrichmentConfigId: p.nextEnrichmentConfigId + 1,
              }))
            }
          >
            Initialize categories for {scopeLabel}
          </Button>
        </div>
      </div>
    );
  }

  const onNew = () => {
    setModalCat(null);
    setModalOpen(true);
  };
  const onOpen = (c: EnrichmentCategory) => {
    setModalCat(c);
    setModalOpen(true);
  };
  const onClose = () => {
    setModalOpen(false);
    setModalCat(null);
  };

  // Upsert into every scope so the category is available everywhere. When a
  // scope already has this category, preserve its own `fields`; otherwise add it
  // with an empty field list.
  const onSave = (draft: EnrichmentCategory) => {
    update((prev) => ({
      ...prev,
      enrichmentConfigs: prev.enrichmentConfigs.map((c) => {
        const has = c.categories.some((x) => x.id === draft.id);
        return {
          ...c,
          categories: has
            ? c.categories.map((x) =>
                x.id === draft.id ? { ...draft, fields: x.fields } : x,
              )
            : [...c.categories, { ...draft, fields: draft.fields ?? [] }],
        };
      }),
    }));
    onClose();
  };

  const onDelete = (c: EnrichmentCategory) => {
    if (
      !confirm(
        `Delete category "${catLabel(c)}"? It will be removed from every Submission and LOB.`,
      )
    )
      return;
    update((prev) => ({
      ...prev,
      enrichmentConfigs: prev.enrichmentConfigs.map((cfgX) => ({
        ...cfgX,
        categories: cfgX.categories.filter((x) => x.id !== c.id),
      })),
    }));
  };

  return (
    <div className="lob-activities">
      <header className="lob-activities__header">
        <div>
          <h3 className="lob-activities__title">{scopeLabel} — Attribute Categories</h3>
          <p className="lob-activities__sub">
            {categories.length} categor{categories.length === 1 ? 'y' : 'ies'} for {scopeLabel}. Group
            canonical attributes for workbench display and completeness tracking.
          </p>
        </div>
      </header>

      <div className="lob-activities__toolbar">
        <Input
          placeholder="Search by name"
          iconLeading={<Icon name="search" size={14} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={`Search ${scopeLabel} categories by name`}
          className="lob-activities__search"
        />
        <button type="button" className="lob-activities__new-btn" onClick={onNew}>
          <Icon name="plus" size={14} />
          New Category
        </button>
      </div>

      <div className="lob-activities__list">
        {categories.length === 0 ? (
          <div className="lob-activities__empty">
            <p style={{ margin: 0 }}>No categories for {scopeLabel} yet.</p>
            <Button variant="brand" iconLeading={<Icon name="plus" size={14} />} onClick={onNew}>
              New Category
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="lob-activities__empty">No categories match "{query}".</div>
        ) : (
          visible.map((c) => (
            <CategoryTile
              key={c.id}
              category={c}
              menuOpen={openMenuId === c.id}
              onMenuToggle={(next) =>
                setOpenMenuId(next ? c.id : openMenuId === c.id ? null : openMenuId)
              }
              onClick={() => onOpen(c)}
              onDelete={() => onDelete(c)}
            />
          ))
        )}
      </div>

      {modalOpen && (
        <CategoryModal
          category={modalCat}
          siblings={sharedCategories}
          onClose={onClose}
          onSave={onSave}
        />
      )}
    </div>
  );
}

/* ── Tile ─────────────────────────────────────────────────────────── */

function CategoryTile({
  category,
  menuOpen,
  onMenuToggle,
  onClick,
  onDelete,
}: {
  category: EnrichmentCategory;
  menuOpen: boolean;
  onMenuToggle: (next: boolean) => void;
  onClick: () => void;
  onDelete: () => void;
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
          onDelete={() => {
            onMenuToggle(false);
            onDelete();
          }}
        />
      </div>
      <div className="act-tile__name">
        <span className="act-tile__name-text">{catLabel(category)}</span>
      </div>
      {category.description?.trim() && (
        <div className="act-tile__desc">{category.description.trim()}</div>
      )}
    </div>
  );
}

/* ── Modal ────────────────────────────────────────────────────────── */

function blankCategory(siblings: EnrichmentCategory[]): EnrichmentCategory {
  const maxOrder = siblings.reduce((m, c) => Math.max(m, c.displayOrder ?? 0), 0);
  return {
    id: '',
    name: '',
    label: '',
    developerName: '',
    description: '',
    displayOrder: maxOrder + 1,
    source: 'User-defined',
    fields: [],
  };
}

interface CategoryModalProps {
  category: EnrichmentCategory | null;
  siblings: EnrichmentCategory[];
  onClose: () => void;
  onSave: (draft: EnrichmentCategory) => void;
}

function CategoryModal({ category, siblings, onClose, onSave }: CategoryModalProps) {
  // Normalize an existing category into the full §11.4.3 shape for editing.
  const [draft, setDraft] = useState<EnrichmentCategory>(() =>
    category
      ? {
          ...category,
          label: catLabel(category),
          developerName: catDevName(category),
          source: catSource(category),
        }
      : blankCategory(siblings),
  );
  const [devNameDirty, setDevNameDirty] = useState(!!category?.developerName);

  const patch = (p: Partial<EnrichmentCategory>) => setDraft((d) => ({ ...d, ...p }));

  const setLabel = (label: string) => {
    if (!devNameDirty) patch({ label, developerName: slugify(label) });
    else patch({ label });
  };

  const trimmedLabel = (draft.label ?? '').trim();
  const collides = siblings.some(
    (c) => c.id !== category?.id && catLabel(c).toLowerCase() === trimmedLabel.toLowerCase(),
  );
  const valid = trimmedLabel.length > 0 && !collides;

  const commitSave = () => {
    if (!valid) return;
    const label = trimmedLabel;
    const developerName = (draft.developerName ?? '').trim() || slugify(label);
    let id = category?.id ?? '';
    if (!id) {
      id = developerName || slugify(label);
      let n = 1;
      while (siblings.some((c) => c.id === id)) id = `${developerName || slugify(label)}-${++n}`;
    }
    onSave({
      ...draft,
      id,
      label,
      developerName,
      name: label,
      description: (draft.description ?? '').trim(),
      source: draft.source ?? 'User-defined',
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      className="ltc-modal"
      title={category ? `Edit ${catLabel(category)}` : 'New Category'}
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
      <div className="ltc-modal__body">
        <div className="ltc-form">
          <div className="ltc-form__grid">
            <Input
              label="Label"
              required
              value={draft.label ?? ''}
              placeholder="e.g. Valuation"
              onChange={(e) => setLabel(e.target.value)}
              error={collides ? 'Another category already uses this name.' : undefined}
            />
            <Input
              label="Display Order"
              type="number"
              value={String(draft.displayOrder ?? 0)}
              onChange={(e) =>
                patch({ displayOrder: Number.parseInt(e.target.value, 10) || 0 })
              }
            />
            <Input
              label="Developer Name"
              value={draft.developerName ?? ''}
              placeholder="valuation"
              onChange={(e) => {
                setDevNameDirty(true);
                patch({ developerName: e.target.value });
              }}
            />
            <div className="ltc-form__full">
              <Textarea
                label="Description"
                value={draft.description ?? ''}
                rows={2}
                placeholder="What this category groups (e.g. value-related attributes for rating and pricing)."
                onChange={(e) => patch({ description: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
