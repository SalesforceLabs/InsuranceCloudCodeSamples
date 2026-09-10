import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Checkbox, Dropdown, Icon, Input, Modal, Select, Textarea } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { ActivityScope, ReusableActivity } from '@/types/config';
import {
  PROCESS_SPECS,
  PROCESS_TYPES,
  processSpecFor,
  type ProcessType,
} from './activity-process';
import { optionsFor, type ProcessKind } from './process-options';
import './ReusableActivityModal.css';

interface Props {
  activity: ReusableActivity;
  onClose: () => void;
  /**
   * LOB context this editor was opened from. When provided (and not the
   * parent-Submission pseudo-LOB), a Scope field is shown letting the user
   * pick between Global (available to every LOB) and this specific LOB.
   */
  lob?: string;
  /**
   * When rendered inside a Modal, drop the panel's own border/background and
   * self-close button — the modal supplies that chrome.
   */
  embedded?: boolean;
  /**
   * Restrict the Scope picker to the current context. Used by Stage Management,
   * where a new activity can only be Global (Submission stage management) or
   * Global + the current LOB (an LOB's stage management). Left off, the picker
   * offers Global plus every available LOB (the Activities library).
   */
  restrictScope?: boolean;
}

/** Sentinel value for the Global scope option. */
const SCOPE_GLOBAL = 'global';
const SCOPE_LOB_PREFIX = 'lob:';

export function ActivityEditor({
  activity,
  onClose,
  lob,
  embedded = false,
  restrictScope = false,
}: Props) {
  const { config, update } = useConfig();
  const [draft, setDraft] = useState<ReusableActivity>(activity);

  // Sync the draft if the parent swaps the activity beneath us (different tile clicked).
  useEffect(() => {
    setDraft(activity);
  }, [activity]);

  const action = (processSpecFor(draft.action).type) as ProcessType;
  const spec = PROCESS_SPECS[action];

  // Scope drives where the activity can be used. Global activities are usable
  // for both Submission and LOB stage management; an LOB-scoped activity is
  // usable only inside that LOB's stage management. The Activities library
  // offers Global plus every LOB on the Submission Line_of_Business__c
  // picklist; Stage Management (`restrictScope`) narrows the choice to the
  // context it was opened from — Global only for Submission, Global + the
  // current LOB otherwise.
  const allLobs = useMemo(
    () =>
      config.fields.find((f) => f.api === 'Line_of_Business__c')?.picklistValues ?? [],
    [config.fields],
  );
  const contextLob = lob && lob !== 'Submission' ? lob : null;
  const scopeLobs = restrictScope ? (contextLob ? [contextLob] : []) : allLobs;

  const scopeValue =
    draft.scope && typeof draft.scope === 'object' && 'lob' in draft.scope
      ? `${SCOPE_LOB_PREFIX}${draft.scope.lob}`
      : SCOPE_GLOBAL;

  const scopeOptions = useMemo(
    () => [
      {
        value: SCOPE_GLOBAL,
        label: 'Global',
        description: 'Usable for Submission or any LOB stage management',
      },
      ...scopeLobs.map((l) => ({
        value: `${SCOPE_LOB_PREFIX}${l}`,
        label: l,
        description: `Usable only in ${l} stage management`,
      })),
    ],
    [restrictScope, contextLob, allLobs],
  );

  const setScope = (v: string) => {
    setField(
      'scope',
      v === SCOPE_GLOBAL ? 'Lines of Submission' : { lob: v.slice(SCOPE_LOB_PREFIX.length) },
    );
  };

  const persist = (next: ReusableActivity) => {
    setDraft(next);
    update((prev) => ({
      ...prev,
      reusableActivities: prev.reusableActivities.map((a) =>
        a.id === next.id ? next : a,
      ),
    }));
  };

  const setField = <K extends keyof ReusableActivity>(k: K, v: ReusableActivity[K]) => {
    persist({ ...draft, [k]: v });
  };

  // External-link modal state for the "View" button next to the
  // process picker. The view target is whichever option is selected;
  // the modal is purely a placeholder for the eventual deep link.
  const [externalOpen, setExternalOpen] = useState(false);

  const setProcess = (next: ProcessType) => {
    if (next === action) return;
    // Reset actionDetails to a clean shape for the new process so we don't
    // leak stale keys (e.g. flowName lingering after switching to IP).
    const cleanDetails =
      next === 'Enrichment Definition' || next === 'No Process'
        ? {}
        : { [PROCESS_SPECS[next].detailKey]: '' };
    persist({ ...draft, action: next, actionDetails: cleanDetails });
  };

  const setDetailValue = (value: string) => {
    persist({
      ...draft,
      actionDetails: { ...draft.actionDetails, [spec.detailKey]: value },
    });
  };

  const onDelete = () => {
    if (!confirm(`Delete activity "${draft.name}"?`)) return;
    update((prev) => ({
      ...prev,
      reusableActivities: prev.reusableActivities.filter((a) => a.id !== draft.id),
    }));
    onClose();
  };

  return (
    <div
      className={
        embedded ? 'act-editor-panel act-editor-panel--embedded' : 'rmdw-config-panel act-editor-panel'
      }
    >
      {!embedded && (
        <button
          type="button"
          className="rmdw-cp-close"
          onClick={onClose}
          aria-label="Close editor"
          title="Close editor"
        >
          <Icon name="close" size={16} />
        </button>
      )}

      <div className="act-editor-panel__body">
        {!embedded && (
          <header className="act-col-header">
            <h4 className="act-col-title">{draft.name || 'Untitled activity'}</h4>
          </header>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input
          label="Activity Name"
          required
          value={draft.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="e.g. Clearance Check"
          fullWidth
        />
        <Textarea
          label="Description"
          rows={2}
          value={draft.description}
          onChange={(e) => setField('description', e.target.value)}
          placeholder="What does this activity do?"
          fullWidth
        />

        <div className="slds2-field slds2-field--full">
          <label className="slds2-field__label">
            Scope
            <span className="slds2-field__required" aria-hidden="true"> *</span>
          </label>
          <Dropdown
            value={scopeValue}
            onChange={setScope}
            options={scopeOptions}
            aria-label="Scope"
            fullWidth
          />
        </div>

        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--slds-g-color-on-surface-2)',
              marginBottom: 8,
            }}
          >
            Process
          </div>
          <div className="ream-process-grid" role="radiogroup" aria-label="Process type">
            {PROCESS_TYPES.map((t) => {
              const s = PROCESS_SPECS[t];
              const Glyph = s.icon;
              const selected = action === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`ream-process-card${selected ? ' ream-process-card--selected' : ''}`}
                  onClick={() => setProcess(t)}
                >
                  <span
                    className="ream-process-card__icon"
                    style={{ background: s.chipBg, color: s.chipFg }}
                  >
                    <Glyph />
                  </span>
                  <span className="ream-process-card__body">
                    <span className="ream-process-card__title">{s.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {action !== 'No Process' && (
          <div className="ream-detail">
            <div className="ream-detail__head">Configuration</div>
            {action === 'Enrichment Definition' ? (
              <EnrichmentDefinitionDetails
                scope={draft.scope}
                details={draft.actionDetails}
                onChange={(next) =>
                  persist({ ...draft, actionDetails: next })
                }
              />
            ) : (
              <ProcessLookup
                kind={action as ProcessKind}
                label={spec.detailLabel}
                value={draft.actionDetails[spec.detailKey] ?? ''}
                onChange={setDetailValue}
                onView={() => setExternalOpen(true)}
              />
            )}
          </div>
        )}

        <Checkbox
          label="Make available for run time task creation"
          hint="Underwriters can add this activity as a task ad hoc while working a submission."
          checked={draft.runtimeTaskCreation ?? false}
          onChange={(e) => setField('runtimeTaskCreation', e.target.checked)}
        />

        </div>
      </div>

      <div className="act-editor-panel__footer">
        {embedded ? (
          <Button variant="neutral" onClick={onClose}>
            Cancel
          </Button>
        ) : (
          <Button
            variant="destructive"
            onClick={onDelete}
            iconLeading={<Icon name="trash" size={14} />}
          >
            Delete Activity
          </Button>
        )}
        <Button variant="brand" onClick={onClose}>
          Save
        </Button>
      </div>

      <Modal
        open={externalOpen}
        onClose={() => setExternalOpen(false)}
        title="Open in Salesforce"
        size="sm"
        footer={
          <>
            <Button variant="neutral" onClick={() => setExternalOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={() => setExternalOpen(false)}>
              Continue
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: 'var(--slds-g-font-scale-base)' }}>
          This will launch the configured {action} in a new tab.
        </p>
      </Modal>
    </div>
  );
}

interface ProcessLookupProps {
  kind: ProcessKind;
  label: string;
  value: string;
  onChange: (next: string) => void;
  onView: () => void;
}

/**
 * Standard Salesforce lookup: a search input that filters the record list as
 * you type and shows matches in a portal-mounted dropdown. Once a record is
 * picked it collapses to a pill (record name + clear button); clicking the
 * clear button re-opens the search. Options come from the same hard-coded
 * registry the old combobox used (`optionsFor(kind)`).
 */
function ProcessLookup({ kind, label, value, onChange, onView }: ProcessLookupProps) {
  const options = optionsFor(kind);
  const knownValues = options.map((o) => o.value);
  // Preserve an unknown persisted value (e.g. copied from another org) as a
  // synthetic option so the pill still shows something meaningful.
  const allOptions =
    value && !knownValues.includes(value)
      ? [{ value, label: value }, ...options]
      : options;
  const selectedOption = allOptions.find((o) => o.value === value) ?? null;

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
  const matches = q
    ? allOptions.filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          ('description' in o && (o.description ?? '').toLowerCase().includes(q)),
      )
    : allOptions;

  const commit = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  };

  const clear = () => {
    onChange('');
    setQuery('');
    setOpen(true);
    // Focus the freshly-revealed input on the next frame.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <div className="ream-lookup" ref={ref}>
      <label className="slds2-field__label" htmlFor="process-lookup-input">
        {label}
      </label>
      {selectedOption ? (
        <div className="ream-lookup__pill">
          <span className="ream-lookup__pill-icon" aria-hidden="true">
            <Icon name="search" size={12} />
          </span>
          <span className="ream-lookup__pill-label" title={selectedOption.label}>
            {selectedOption.label}
          </span>
          <button
            type="button"
            className="ream-lookup__pill-view"
            aria-label={`View ${selectedOption.label}`}
            title="View in Salesforce"
            onClick={onView}
          >
            <Icon name="external-link" size={12} />
          </button>
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
            id="process-lookup-input"
            ref={inputRef}
            type="text"
            className="ream-lookup__input"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
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
      {open && !selectedOption && menuRect &&
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
                  key={o.value}
                  role="option"
                  aria-selected={false}
                  className="ream-lookup__option"
                  onClick={() => commit(o.value)}
                >
                  <span className="ream-lookup__option-icon" aria-hidden="true">
                    <Icon name="search" size={12} />
                  </span>
                  <span className="ream-lookup__option-body">
                    <span className="ream-lookup__option-label">{o.label}</span>
                    {'description' in o && o.description && (
                      <span className="ream-lookup__option-desc">{o.description}</span>
                    )}
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

interface EDDetailsProps {
  scope: ActivityScope | undefined;
  details: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

/**
 * Map an activity scope to an enrichment-config LOB. The two systems use
 * different LOB labels (the Submission picklist has "Property", the
 * enrichment configs ship "Commercial Property"), so we accept the closest
 * match either direction. Parent-Submission scope falls back to the first
 * enrichment LOB so the editor still works at the submission level.
 */
function resolveEnrichmentLob(scope: ActivityScope | undefined, available: string[]): string {
  if (available.length === 0) return '';
  if (scope && typeof scope === 'object' && 'lob' in scope) {
    const target = scope.lob;
    const exact = available.find((l) => l === target);
    if (exact) return exact;
    const enrichmentSubstring = available.find((l) =>
      l.toLowerCase().includes(target.toLowerCase()),
    );
    if (enrichmentSubstring) return enrichmentSubstring;
    const submissionSubstring = available.find((l) =>
      target.toLowerCase().includes(l.toLowerCase()),
    );
    if (submissionSubstring) return submissionSubstring;
  }
  return available[0];
}

function EnrichmentDefinitionDetails({ scope, details, onChange }: EDDetailsProps) {
  const { config } = useConfig();

  const lobs = useMemo(
    () => config.enrichmentConfigs.map((c) => c.lob).filter(Boolean),
    [config.enrichmentConfigs],
  );

  // LOB is derived from the activity's scope, not picked by the user.
  const lob = useMemo(() => resolveEnrichmentLob(scope, lobs), [scope, lobs]);

  const categories = useMemo(() => {
    const cfg = config.enrichmentConfigs.find((c) => c.lob === lob);
    return cfg?.categories ?? [];
  }, [config.enrichmentConfigs, lob]);
  const categoryId =
    categories.find((c) => c.id === details.categoryId)?.id ?? (categories[0]?.id ?? '');

  const matchingDefs = useMemo(
    () =>
      config.enrichmentDefinitions.filter(
        (d) => d.lob === lob && (!categoryId || d.categoryId === categoryId),
      ),
    [config.enrichmentDefinitions, lob, categoryId],
  );
  const definitionId =
    matchingDefs.find((d) => String(d.id) === details.enrichmentDefinitionId)?.id ??
    (matchingDefs[0]?.id ?? null);
  const definition = matchingDefs.find((d) => d.id === definitionId) ?? null;

  // Reconcile actionDetails any time the resolved LOB or picks change so the
  // persisted data stays in sync with what the user sees.
  useEffect(() => {
    const next = {
      lob,
      categoryId,
      enrichmentDefinitionId: definitionId != null ? String(definitionId) : '',
      enrichmentDefinitionName: definition?.name ?? '',
    };
    if (
      next.lob !== details.lob ||
      next.categoryId !== details.categoryId ||
      next.enrichmentDefinitionId !== details.enrichmentDefinitionId ||
      next.enrichmentDefinitionName !== details.enrichmentDefinitionName
    ) {
      onChange(next);
    }
  }, [lob, categoryId, definitionId, definition, details, onChange]);

  const onCategoryChange = (v: string) => {
    const firstDef =
      config.enrichmentDefinitions.find(
        (d) => d.lob === lob && (!v || d.categoryId === v),
      ) ?? null;
    onChange({
      lob,
      categoryId: v,
      enrichmentDefinitionId: firstDef ? String(firstDef.id) : '',
      enrichmentDefinitionName: firstDef?.name ?? '',
    });
  };
  const onDefinitionChange = (v: string) => {
    const def = config.enrichmentDefinitions.find((d) => String(d.id) === v) ?? null;
    onChange({
      lob,
      categoryId,
      enrichmentDefinitionId: v,
      enrichmentDefinitionName: def?.name ?? '',
    });
  };

  if (lobs.length === 0) {
    return (
      <div style={{ fontSize: 13, color: 'var(--slds-g-color-on-surface-1)' }}>
        No enrichment LOBs configured. Define some in Data Enrichment first.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ScopeLobIndicator scope={scope} resolved={lob} />
      {categories.length === 0 ? (
        <Select label="Category" required disabled value="">
          <option>No categories defined for this LOB</option>
        </Select>
      ) : (
        <Select
          label="Category"
          required
          value={categoryId}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      )}
      {matchingDefs.length === 0 ? (
        <Select label="Enrichment Definition" required disabled value="">
          <option>No enrichment definitions match this LOB and category</option>
        </Select>
      ) : (
        <Select
          label="Enrichment Definition"
          required
          value={definitionId != null ? String(definitionId) : ''}
          onChange={(e) => onDefinitionChange(e.target.value)}
        >
          {matchingDefs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}

function ScopeLobIndicator({
  scope,
  resolved,
}: {
  scope: ActivityScope | undefined;
  resolved: string;
}) {
  // Show how the LOB was resolved so the mapping is visible (especially when
  // the names differ between the picklist and the enrichment configs).
  const fromScope = scope && typeof scope === 'object' && 'lob' in scope ? scope.lob : null;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '8px 10px',
        background: 'var(--slds-g-color-surface-container-2)',
        border: '1px solid var(--slds-g-color-border-1)',
        borderRadius: 'var(--slds-g-radius-border-1)',
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: 'var(--slds-g-color-on-surface-1)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontWeight: 600,
        }}
      >
        Line of Business
      </span>
      <span style={{ fontSize: 13, color: 'var(--slds-g-color-on-surface-3)', fontWeight: 500 }}>
        {resolved}
        {fromScope && fromScope !== resolved && (
          <span
            style={{
              fontSize: 12,
              color: 'var(--slds-g-color-on-surface-1)',
              fontWeight: 400,
              marginLeft: 6,
            }}
          >
            (from “{fromScope}”)
          </span>
        )}
        {!fromScope && (
          <span
            style={{
              fontSize: 12,
              color: 'var(--slds-g-color-on-surface-1)',
              fontWeight: 400,
              marginLeft: 6,
            }}
          >
            (default for Parent Submission)
          </span>
        )}
      </span>
    </div>
  );
}
