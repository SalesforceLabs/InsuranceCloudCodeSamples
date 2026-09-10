import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Button,
  Card,
  Checkbox,
  Icon,
  Modal,
  Select,
  Tabs,
} from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type {
  ActivityInstance,
  StageConfig,
  TransitionCondition,
  TransitionRule,
} from '@/types/config';
import { TasksPane } from './TasksPane';
import {
  ConditionRows,
  buildConditionEntities,
  type ConditionEntity,
  type ConditionLike,
} from './ConditionRows';
import {
  Column,
  NewTemplateModal,
  PROMPT_TEMPLATES,
  RowEditor,
  RowMenu,
} from '@/panels/GeneralSetup/DocumentClassificationSection';
import '@/panels/GeneralSetup/DocumentClassification.css';
import './ReusableActivityModal.css';

interface Props {
  cfg: StageConfig;
}

type SubTab = 'tasks' | 'rules';

/** Parent-Submission stage configs draw their stages from the dedicated
 * Submission Stages picklist; per-LOB configs use the shared Stage picklist. */
function stageFieldApi(cfg: StageConfig): string {
  return cfg.recordType === 'Submission' ? 'Submission_Stage__c' : 'Stage__c';
}

export function LobStageEditor({ cfg }: Props) {
  const { config, update } = useConfig();
  const [activeStage, setActiveStage] = useState<string>(() => cfg.stages[0] ?? '');
  const [subTab, setSubTab] = useState<SubTab>('tasks');
  const [manageOpen, setManageOpen] = useState(false);
  const [valuesOpen, setValuesOpen] = useState(false);

  // Re-anchor the active stage when the stages list changes underneath us
  // (drag, add, remove, or external save).
  useEffect(() => {
    if (!cfg.stages.includes(activeStage)) {
      setActiveStage(cfg.stages[0] ?? '');
    }
  }, [cfg.stages, activeStage]);

  const fieldApi = stageFieldApi(cfg);
  const stagePicklist =
    config.fields.find((f) => f.api === fieldApi)?.picklistValues ?? [];

  // ── Path mutations ──────────────────────────────────────────────
  // Apply a new ordered stage list from the Manage Stages dueling picklist.
  // `activitiesData` is keyed by stage *index* (`{cfgId}:{idx}`), so a reorder
  // or removal has to remap those buckets by stage name — otherwise tasks would
  // silently jump to whichever stage now sits at their old index. Stage-name-
  // keyed maps (prompts / summaries / transition rules) need no remap.
  const applyStages = (next: string[]) => {
    update((p) => {
      const prevStages = p.stageConfigs.find((s) => s.id === cfg.id)?.stages ?? [];
      const oldIdxByName = new Map(prevStages.map((name, i) => [name, i]));
      const activitiesData = { ...p.activitiesData };
      // Drop every existing bucket for this config, then rebuild from the new order.
      prevStages.forEach((_, i) => {
        delete activitiesData[`${cfg.id}:${i}`];
      });
      next.forEach((name, j) => {
        const oldIdx = oldIdxByName.get(name);
        if (oldIdx == null) return;
        const bucket = p.activitiesData[`${cfg.id}:${oldIdx}`];
        if (bucket) activitiesData[`${cfg.id}:${j}`] = bucket;
      });
      return {
        ...p,
        activitiesData,
        stageConfigs: p.stageConfigs.map((s) =>
          s.id === cfg.id ? { ...s, stages: next } : s,
        ),
      };
    });
  };

  // ── Stage summary prompt template ──────────────────────────────
  // Curated catalog + user-created templates, de-duped case-insensitively.
  // Mirrors the Doc Summary Prompt "Default Prompt Template" lookup so both
  // surfaces draw from the same list.
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

  const createTemplate = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (templates.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return;
    update((p) => ({
      ...p,
      documentSummaryPromptTemplates: [
        ...(p.documentSummaryPromptTemplates ?? []),
        trimmed,
      ],
    }));
  };

  const summaryTemplate = cfg.stageSummaryTemplates?.[activeStage] ?? '';
  const onSummaryTemplateChange = (value: string) => {
    update((p) => ({
      ...p,
      stageConfigs: p.stageConfigs.map((s) =>
        s.id === cfg.id
          ? {
              ...s,
              stageSummaryTemplates: value
                ? { ...(s.stageSummaryTemplates ?? {}), [activeStage]: value }
                : (() => {
                    const { [activeStage]: _drop, ...rest } = s.stageSummaryTemplates ?? {};
                    return rest;
                  })(),
            }
          : s,
      ),
    }));
  };

  // ── Tasks for the active stage (from existing activitiesData) ───
  const stageIdx = cfg.stages.indexOf(activeStage);
  const taskKey = stageIdx >= 0 ? `${cfg.id}:${stageIdx}` : null;
  const tasks: ActivityInstance[] = taskKey ? config.activitiesData[taskKey] ?? [] : [];

  // ── Rules ───────────────────────────────────────────────────────
  const rules = cfg.stageTransitionRules?.[activeStage] ?? [];
  const updateRules = (next: TransitionRule[]) => {
    update((p) => ({
      ...p,
      stageConfigs: p.stageConfigs.map((s) =>
        s.id === cfg.id
          ? {
              ...s,
              stageTransitionRules: { ...(s.stageTransitionRules ?? {}), [activeStage]: next },
            }
          : s,
      ),
    }));
  };

  return (
    <section className="lse">
      <Card padding="md" className="lse-path-card">
        <PathRow
          stages={cfg.stages}
          activeStage={activeStage}
          onSelect={setActiveStage}
          onManageStages={() => setManageOpen(true)}
        />

        {cfg.stages.length > 0 && activeStage ? (
          <div className="lse-tabs" style={{ marginTop: 'var(--slds-g-spacing-3)' }}>
            <Tabs
              active={subTab}
              onChange={(id) => setSubTab(id as SubTab)}
              items={[
                { id: 'tasks', label: 'Activity Mapping', badge: tasks.length || undefined },
                {
                  id: 'rules',
                  label: 'Stage Transition and Summary',
                  badge: rules.length || undefined,
                },
              ]}
            />

            <div className="lse-tabs__pane">
              {subTab === 'tasks' && (
                <TasksPane
                  cfg={cfg}
                  lob={cfg.recordType}
                  activeStage={activeStage}
                  onActiveStageChange={setActiveStage}
                />
              )}
              {subTab === 'rules' && (
                <>
                  <h3 className="lse-split__title">{activeStage}</h3>

                  <div className="dc-threshold dsp-default" style={{ marginBottom: 'var(--slds-g-spacing-4)' }}>
                    <div className="dc-threshold__label">Stage Summary Prompt Template</div>
                    <SummaryTemplateLookup
                      value={summaryTemplate}
                      templates={templates}
                      onChange={onSummaryTemplateChange}
                      onCreateTemplate={createTemplate}
                    />
                    <p className="dc-threshold__hint">
                      This template is used to generate the summary for the “{activeStage}” stage.
                    </p>
                  </div>

                  <RulesPane
                    rules={rules}
                    cfg={cfg}
                    stageIdx={stageIdx}
                    tasks={tasks}
                    onChange={updateRules}
                  />
                </>
              )}
            </div>
          </div>
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: 32,
              color: 'var(--slds-g-color-on-surface-1)',
            }}
          >
            Add a stage to configure its prompt, tasks, and transition rules.
          </div>
        )}
      </Card>

      <ManageStagesModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        available={stagePicklist}
        selected={cfg.stages}
        onApply={applyStages}
        onManageValues={() => {
          setManageOpen(false);
          setValuesOpen(true);
        }}
      />

      <StageValuesModal
        open={valuesOpen}
        onClose={() => setValuesOpen(false)}
        fieldApi={fieldApi}
      />
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────── */

/** Stage Values — full CRUD over the Submission `Stage__c` picklist,
 * mirroring the Document Category experience under General Setup. Renames
 * and deletes cascade to every stage configuration that references the
 * stage by name (including the stage-name-keyed prompt / rule maps). Reached
 * from the "Manage stage values" link inside the Manage Stages dueling picklist. */
function StageValuesModal({
  open,
  onClose,
  fieldApi,
}: {
  open: boolean;
  onClose: () => void;
  fieldApi: string;
}) {
  const { config, update } = useConfig();
  const stageField = config.fields.find((f) => f.api === fieldApi);
  const stages = stageField?.picklistValues ?? [];

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [newStage, setNewStage] = useState('');

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setAdding(false);
      setNewStage('');
    }
  }, [open]);

  const setPicklist = (next: string[]) => {
    update((p) => ({
      ...p,
      fields: p.fields.map((f) =>
        f.api === fieldApi ? { ...f, picklistValues: next } : f,
      ),
    }));
  };

  const onAdd = () => {
    const name = newStage.trim();
    if (!name) return;
    if (stages.some((s) => s.toLowerCase() === name.toLowerCase())) {
      alert(`A stage named "${name}" already exists.`);
      return;
    }
    setPicklist([...stages, name]);
    setNewStage('');
    setAdding(false);
  };

  const onRename = (orig: string) => {
    const name = draft.trim();
    if (!name) {
      setEditing(null);
      return;
    }
    if (
      stages.some((s) => s !== orig && s.toLowerCase() === name.toLowerCase())
    ) {
      alert(`A stage named "${name}" already exists.`);
      return;
    }
    // Rename the picklist value and cascade to every stage configuration that
    // references it by name (stages array + name-keyed prompt / rule maps).
    update((p) => ({
      ...p,
      fields: p.fields.map((f) =>
        f.api === fieldApi
          ? { ...f, picklistValues: f.picklistValues.map((v) => (v === orig ? name : v)) }
          : f,
      ),
      stageConfigs: p.stageConfigs.map((sc) => {
        if (!sc.stages.includes(orig)) return sc;
        const rekey = <T,>(m?: Record<string, T>): Record<string, T> | undefined => {
          if (!m || !(orig in m)) return m;
          const { [orig]: moved, ...rest } = m;
          return { ...rest, [name]: moved };
        };
        return {
          ...sc,
          stages: sc.stages.map((s) => (s === orig ? name : s)),
          stagePrompts: rekey(sc.stagePrompts),
          stageSummaryTemplates: rekey(sc.stageSummaryTemplates),
          stageTransitionRules: rekey(sc.stageTransitionRules),
        };
      }),
    }));
    setEditing(null);
  };

  const onDelete = (name: string) => {
    const usedBy = config.stageConfigs.filter((sc) => sc.stages.includes(name));
    const extra = usedBy.length
      ? ` It is currently used in ${usedBy.length} stage configuration${
          usedBy.length === 1 ? '' : 's'
        } and will be removed from ${usedBy.length === 1 ? 'it' : 'them'}.`
      : '';
    if (!confirm(`Delete stage "${name}"?${extra}`)) return;
    update((p) => ({
      ...p,
      fields: p.fields.map((f) =>
        f.api === fieldApi
          ? { ...f, picklistValues: f.picklistValues.filter((v) => v !== name) }
          : f,
      ),
      stageConfigs: p.stageConfigs.map((sc) =>
        sc.stages.includes(name)
          ? { ...sc, stages: sc.stages.filter((s) => s !== name) }
          : sc,
      ),
    }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manage Stage Values"
      size="md"
      footer={
        <Button variant="brand" onClick={onClose}>
          Done
        </Button>
      }
    >
      <p className="lse-split__hint" style={{ marginTop: 0 }}>
        These stages come from the <strong>{stageField?.label ?? 'Stage'}</strong> picklist
        and are available to every stage configuration.
      </p>
      <Column
        title="Stage"
        count={stages.length}
        onAdd={() => {
          setAdding(true);
          setNewStage('');
        }}
      >
        {adding && (
          <div className="dc-row dc-row--editing">
            <RowEditor
              placeholder="Stage name"
              value={newStage}
              onChange={setNewStage}
              onCommit={onAdd}
              onCancel={() => {
                setAdding(false);
                setNewStage('');
              }}
            />
          </div>
        )}
        {stages.length === 0 && !adding ? (
          <div className="dc-empty">No stages yet. Add one to get started.</div>
        ) : (
          stages.map((s) => {
            const isEditing = editing === s;
            const startEdit = () => {
              setDraft(s);
              setEditing(s);
            };
            return (
              <div
                key={s}
                className={['dc-row', isEditing ? 'dc-row--editing' : ''].filter(Boolean).join(' ')}
                onDoubleClick={() => {
                  if (!isEditing) startEdit();
                }}
              >
                {isEditing ? (
                  <RowEditor
                    value={draft}
                    onChange={setDraft}
                    onCommit={() => onRename(s)}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <>
                    <span className="dc-row__label">{s}</span>
                    <RowMenu
                      ariaLabel={`${s} actions`}
                      onEdit={(e) => {
                        e.stopPropagation();
                        startEdit();
                      }}
                      onDelete={(e) => {
                        e.stopPropagation();
                        onDelete(s);
                      }}
                    />
                  </>
                )}
              </div>
            );
          })
        )}
      </Column>
    </Modal>
  );
}

/* ────────────────────────────────────────────────────────────────── */

interface PathRowProps {
  stages: string[];
  activeStage: string;
  onSelect: (s: string) => void;
  onManageStages: () => void;
}

/** Read-only stage path — equal-width chevrons spanning the full width. Click a
 * chevron to select its stage. Add / remove / reorder all live in the Manage
 * Stages dueling picklist (no in-path drag or delete). */
function PathRow({ stages, activeStage, onSelect, onManageStages }: PathRowProps) {
  return (
    <div className="lse-path-row">
      {stages.length === 0 ? (
        <div className="lse-path__empty">
          No stages yet — click Manage Stages to add some.
        </div>
      ) : (
        <div className="lse-path" role="tablist" aria-label="Stages">
          {stages.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={s === activeStage}
              className="lse-path__chevron"
              data-active={s === activeStage}
              onClick={() => onSelect(s)}
            >
              <span className="lse-path__chevron-label">{s}</span>
            </button>
          ))}
        </div>
      )}

      <div className="lse-path__add-wrap">
        <Button
          variant="neutral"
          iconLeading={<Icon name="settings" size={14} />}
          onClick={onManageStages}
        >
          Manage Stages
        </Button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */

interface ManageStagesModalProps {
  open: boolean;
  onClose: () => void;
  /** Every stage value defined on the picklist. */
  available: string[];
  /** Stages currently on this configuration, in order. */
  selected: string[];
  /** Persist the new ordered selection to the configuration. */
  onApply: (next: string[]) => void;
  /** Open the picklist-value CRUD modal. */
  onManageValues: () => void;
}

/**
 * Manage Stages — Salesforce-standard dueling (dual-listbox) picklist. The left
 * box lists available stage values not yet on the configuration; the right box
 * lists the selected stages in order. Move buttons transfer highlighted values
 * between boxes; Up / Down reorder the selected box. Nothing persists until Save.
 */
function ManageStagesModal({
  open,
  onClose,
  available,
  selected,
  onApply,
  onManageValues,
}: ManageStagesModalProps) {
  const [chosen, setChosen] = useState<string[]>(selected);
  const [availHi, setAvailHi] = useState<Set<string>>(() => new Set());
  const [chosenHi, setChosenHi] = useState<Set<string>>(() => new Set());

  // Reset the working copy every time the modal opens (or the config changes
  // underneath it, e.g. a picklist value was renamed via Manage Stage Values).
  useEffect(() => {
    if (open) {
      setChosen(selected);
      setAvailHi(new Set());
      setChosenHi(new Set());
    }
  }, [open, selected]);

  // Available = picklist values not already chosen, in picklist order.
  const availList = useMemo(
    () => available.filter((v) => !chosen.includes(v)),
    [available, chosen],
  );

  const toggle = (
    set: Set<string>,
    setSet: (s: Set<string>) => void,
    value: string,
  ) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setSet(next);
  };

  const moveRight = () => {
    if (availHi.size === 0) return;
    // Preserve picklist order for the newly-added values.
    const added = available.filter((v) => availHi.has(v));
    setChosen([...chosen, ...added]);
    setAvailHi(new Set());
  };

  const moveLeft = () => {
    if (chosenHi.size === 0) return;
    setChosen(chosen.filter((v) => !chosenHi.has(v)));
    setChosenHi(new Set());
  };

  const move = (dir: -1 | 1) => {
    if (chosenHi.size === 0) return;
    const next = [...chosen];
    const order = dir === 1 ? [...next.keys()].reverse() : [...next.keys()];
    for (const i of order) {
      const target = i + dir;
      if (target < 0 || target >= next.length) continue;
      if (!chosenHi.has(next[i]) || chosenHi.has(next[target])) continue;
      [next[i], next[target]] = [next[target], next[i]];
    }
    setChosen(next);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manage Stages"
      size="lg"
      footer={
        <>
          <Button variant="neutral" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="brand"
            onClick={() => {
              onApply(chosen);
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="lse-dual__head">
        <p className="lse-split__hint" style={{ margin: 0 }}>
          Choose which stages appear on this configuration and set their order.
        </p>
        <button type="button" className="lse-add-pop__manage" onClick={onManageValues}>
          <Icon name="settings" size={12} />
          Manage stage values
        </button>
      </div>

      <div className="lse-dual">
        <div className="lse-dual__col">
          <div className="lse-dual__label">Available</div>
          <ul className="lse-dual__box" role="listbox" aria-label="Available stages">
            {availList.length === 0 ? (
              <li className="lse-dual__empty">All stages selected</li>
            ) : (
              availList.map((v) => (
                <li
                  key={v}
                  role="option"
                  aria-selected={availHi.has(v)}
                  className={`lse-dual__item${availHi.has(v) ? ' lse-dual__item--hi' : ''}`}
                  onClick={() => toggle(availHi, setAvailHi, v)}
                  onDoubleClick={() => {
                    setChosen([...chosen, v]);
                    setAvailHi((s) => {
                      const n = new Set(s);
                      n.delete(v);
                      return n;
                    });
                  }}
                >
                  {v}
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="lse-dual__move">
          <button
            type="button"
            className="lse-dual__btn"
            aria-label="Add to selected"
            title="Add"
            disabled={availHi.size === 0}
            onClick={moveRight}
          >
            <Icon name="arrow-left" size={14} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <button
            type="button"
            className="lse-dual__btn"
            aria-label="Remove from selected"
            title="Remove"
            disabled={chosenHi.size === 0}
            onClick={moveLeft}
          >
            <Icon name="arrow-left" size={14} />
          </button>
        </div>

        <div className="lse-dual__col">
          <div className="lse-dual__label">Selected</div>
          <ul className="lse-dual__box" role="listbox" aria-label="Selected stages">
            {chosen.length === 0 ? (
              <li className="lse-dual__empty">No stages selected</li>
            ) : (
              chosen.map((v) => (
                <li
                  key={v}
                  role="option"
                  aria-selected={chosenHi.has(v)}
                  className={`lse-dual__item${chosenHi.has(v) ? ' lse-dual__item--hi' : ''}`}
                  onClick={() => toggle(chosenHi, setChosenHi, v)}
                >
                  {v}
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="lse-dual__move">
          <button
            type="button"
            className="lse-dual__btn"
            aria-label="Move up"
            title="Move up"
            disabled={chosenHi.size === 0}
            onClick={() => move(-1)}
          >
            <Icon name="chevron-down" size={14} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <button
            type="button"
            className="lse-dual__btn"
            aria-label="Move down"
            title="Move down"
            disabled={chosenHi.size === 0}
            onClick={() => move(1)}
          >
            <Icon name="chevron-down" size={14} />
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ────────────────────────────────────────────────────────────────── */

/**
 * Standard Salesforce lookup for the Stage Summary Prompt Template: a search
 * input that filters templates as you type in a portal-mounted dropdown; once a
 * template is picked it collapses to a pill (name + clear button). The dropdown
 * also offers "New Prompt Template", reusing the same create modal as the Doc
 * Summary Prompt lookup.
 */
function SummaryTemplateLookup({
  value,
  templates,
  onChange,
  onCreateTemplate,
}: {
  value: string;
  templates: string[];
  onChange: (v: string) => void;
  onCreateTemplate: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );

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
    if (!open || creating) return;
    const onDocClick = (ev: MouseEvent) => {
      const target = ev.target as Node;
      const inTrigger = ref.current?.contains(target) ?? false;
      const inMenu = menuRef.current?.contains(target) ?? false;
      if (!inTrigger && !inMenu) setOpen(false);
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
  }, [open, creating]);

  const q = query.trim().toLowerCase();
  const matches = q ? templates.filter((t) => t.toLowerCase().includes(q)) : templates;

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
  const onCreated = (name: string) => {
    onCreateTemplate(name);
    setCreating(false);
    commit(name.trim());
  };

  return (
    <div className="ream-lookup" ref={ref}>
      {value ? (
        <div className="ream-lookup__pill">
          <span className="ream-lookup__pill-icon" aria-hidden="true">
            <Icon name="doc" size={12} />
          </span>
          <span className="ream-lookup__pill-label" title={value}>
            {value}
          </span>
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
            aria-label="Search prompt templates"
            placeholder="Search Prompt Templates…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
        </div>
      )}
      {open &&
        !value &&
        menuRect &&
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
              <div className="ream-lookup__empty">No matching templates.</div>
            ) : (
              matches.map((t) => (
                <div
                  key={t}
                  role="option"
                  aria-selected={false}
                  className="ream-lookup__option"
                  onClick={() => commit(t)}
                >
                  <span className="ream-lookup__option-icon" aria-hidden="true">
                    <Icon name="doc" size={12} />
                  </span>
                  <span className="ream-lookup__option-body">
                    <span className="ream-lookup__option-label">{t}</span>
                  </span>
                </div>
              ))
            )}
            <div
              role="option"
              aria-selected={false}
              className="ream-lookup__option"
              onClick={() => setCreating(true)}
              style={{ borderTop: '1px solid var(--slds-g-color-border-1)' }}
            >
              <span className="ream-lookup__option-icon" aria-hidden="true">
                <Icon name="plus" size={12} />
              </span>
              <span className="ream-lookup__option-body">
                <span
                  className="ream-lookup__option-label"
                  style={{
                    color: 'var(--slds-g-color-accent-1)',
                    fontWeight: 'var(--slds-g-font-weight-6)',
                  }}
                >
                  New Prompt Template
                </span>
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

/* ── Transition Rules ─────────────────────────────────────────── */

const STRING_OPERATORS = [
  'equals',
  'not equals',
  'contains',
  'does not contain',
  'starts with',
  'ends with',
  'is blank',
  'is not blank',
];
const NO_VALUE_OPS = new Set(['is blank', 'is not blank']);
const TRIGGERS: Array<'Manual' | 'Automated'> = ['Manual', 'Automated'];

interface RulesPaneProps {
  rules: TransitionRule[];
  cfg: StageConfig;
  stageIdx: number;
  tasks: ActivityInstance[];
  onChange: (next: TransitionRule[]) => void;
}

/** Per-stage transition rules — grouped by target stage, each rule has
 * its own trigger + condition list + filter logic. Mirrors the legacy
 * Stage Transition Rules layout under Activities and Stages → Stage
 * Management → LOB Activity Configuration. */
function RulesPane({ rules, cfg, stageIdx, tasks, onChange }: RulesPaneProps) {
  const { config } = useConfig();
  const [modal, setModal] = useState<{
    open: boolean;
    editingId: number | null;
    presetToStage?: string;
  }>({ open: false, editingId: null });

  const otherStages = useMemo(
    () => cfg.stages.filter((_, i) => i !== stageIdx),
    [cfg.stages, stageIdx],
  );

  const entities = useMemo(
    () => buildConditionEntities(config, cfg),
    [config, cfg],
  );

  // Resolve a condition's task id back to its full Entity · Stage · Task path,
  // so a rule referencing a task in another LOB/stage reads as more than a raw
  // id. Falls back gracefully when the task can't be located.
  const condLocation = useMemo(() => {
    const m = new Map<
      string,
      { entity: string; stage: string; task: string }
    >();
    for (const e of entities)
      for (const s of e.stages)
        for (const t of s.tasks)
          if (!m.has(String(t.id)))
            m.set(String(t.id), { entity: e.label, stage: s.label, task: t.label });
    return m;
  }, [entities]);

  // Resolve the display name for a task instance (mirrors the activity
  // tile resolver — falls back to the reusable activity's name when the
  // instance doesn't override it).
  const taskLabel = (t: ActivityInstance, idx: number): string => {
    if (t.activityRefId) {
      const ref = config.reusableActivities.find((a) => a.id === t.activityRefId);
      const overridden = (t as { nameOverride?: string }).nameOverride;
      return overridden || ref?.name || `Task ${idx + 1}`;
    }
    return (t as { name?: string }).name || `Task ${idx + 1}`;
  };

  const fromStage = cfg.stages[stageIdx] ?? `Stage ${stageIdx + 1}`;

  // Normalize a rule's trigger to one of the two groups (legacy rules with no
  // trigger read as Manual).
  const groupOf = (r: TransitionRule): 'Manual' | 'Automated' =>
    r.trigger === 'Automated' ? 'Automated' : 'Manual';

  // Bucket rules by trigger (Manual vs Automated), preserving original order
  // within each group.
  const groups = useMemo(() => {
    const map = new Map<'Manual' | 'Automated', { rule: TransitionRule; idx: number }[]>();
    map.set('Manual', []);
    map.set('Automated', []);
    rules.forEach((r, idx) => {
      map.get(groupOf(r))!.push({ rule: r, idx });
    });
    return map;
  }, [rules]);

  // A given target stage may appear once per group (once Manual, once
  // Automated), never twice within the same group.
  const findDuplicate = (
    toStage: string,
    trigger: 'Manual' | 'Automated',
    exceptId: number,
  ) =>
    rules.some(
      (r) =>
        (r.id ?? -1) !== exceptId &&
        (r.toStage ?? '') === toStage &&
        groupOf(r) === trigger,
    );

  const onSaveRule = (id: number | null, draft: TransitionRule) => {
    const trigger: 'Manual' | 'Automated' =
      draft.trigger === 'Automated' ? 'Automated' : 'Manual';
    if (findDuplicate(draft.toStage ?? '', trigger, id ?? -1)) return;
    if (id == null) {
      const newId =
        rules.reduce((m, r) => (r.id && r.id > m ? r.id : m), 0) + 1;
      onChange([...rules, { ...draft, id: newId }]);
    } else {
      onChange(rules.map((r) => (r.id === id ? { ...r, ...draft } : r)));
    }
    setModal({ open: false, editingId: null });
  };

  const onDeleteRule = (idx: number) => {
    if (!confirm('Delete this transition rule?')) return;
    onChange(rules.filter((_, i) => i !== idx));
  };

  // Reorder within the Automated group only; Manual rows keep their slots in
  // the underlying array. `fromPos`/`toPos` are positions among Automated rows.
  const onReorderAutomated = (fromPos: number, toPos: number) => {
    if (fromPos === toPos) return;
    const slots = rules.map((_, i) => i).filter((i) => groupOf(rules[i]) === 'Automated');
    const order = [...slots];
    const [moved] = order.splice(fromPos, 1);
    order.splice(toPos, 0, moved);
    const next = [...rules];
    slots.forEach((slot, k) => {
      next[slot] = rules[order[k]];
    });
    onChange(next);
  };

  // Checkbox-driven reorder for the Automated table. A rule is identified by
  // its id (falling back to array index for legacy rows). Move up / Move down
  // are enabled only when exactly one Automated row is checked.
  const ruleKey = (rule: TransitionRule, idx: number): number => rule.id ?? idx;
  const [selectedKeys, setSelectedKeys] = useState<Set<number>>(() => new Set());
  const toggleSelect = (key: number) =>
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const automatedItems = groups.get('Automated') ?? [];
  const soleKey = selectedKeys.size === 1 ? [...selectedKeys][0] : null;
  const selectedAutoPos =
    soleKey != null
      ? automatedItems.findIndex(({ rule, idx }) => ruleKey(rule, idx) === soleKey)
      : -1;
  const canMoveUp = selectedAutoPos > 0;
  const canMoveDown = selectedAutoPos >= 0 && selectedAutoPos < automatedItems.length - 1;
  const moveSelected = (dir: -1 | 1) => {
    if (selectedAutoPos < 0) return;
    const to = selectedAutoPos + dir;
    if (to < 0 || to >= automatedItems.length) return;
    onReorderAutomated(selectedAutoPos, to);
  };

  // Renders the condition-summary cell shared by both group tables.
  const renderRuleCell = (rule: TransitionRule) => {
    const conditions = (rule.conditions ?? []).filter((c) => c.activityId);
    if (conditions.length === 0) {
      return <span className="lse-tr-table__empty">No conditions defined</span>;
    }
    return (
      <div className="lse-tr-conditions">
        {conditions.map((c, i) => {
          const loc = condLocation.get(String(c.activityId));
          const taskIdx = tasks.findIndex((t) => String(t.id) === String(c.activityId));
          const tName =
            loc?.task ??
            (taskIdx >= 0 ? taskLabel(tasks[taskIdx], taskIdx) : `Task ${c.activityId}`);
          const noVal = NO_VALUE_OPS.has(c.operator ?? '');
          return (
            <div key={i} className="lse-tr-conditions__line">
              <span className="lse-tr-conditions__num">{i + 1}.</span>{' '}
              {loc && (
                <>
                  <span className="lse-tr-conditions__ctx">{loc.entity}</span> ·{' '}
                  <span className="lse-tr-conditions__ctx">{loc.stage}</span> ·{' '}
                </>
              )}
              <strong>{tName}</strong> · <em>{c.response ?? 'Outcome'}</em>{' '}
              {c.operator ?? 'equals'}
              {!noVal && <strong> {c.value ?? ''}</strong>}
            </div>
          );
        })}
        {rule.expression && (
          <div className="lse-tr-conditions__expr">Logic: {rule.expression}</div>
        )}
      </div>
    );
  };

  return (
    <div className="lse-rules">
      <div className="lse-rules__head">
        <button
          type="button"
          className="lob-activities__new-btn"
          onClick={() => setModal({ open: true, editingId: null })}
        >
          <Icon name="plus" size={12} />
          Add Transition
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="lse-rules__empty">
          No transition rules yet. Click <strong>Add Transition</strong> to add one.
        </div>
      ) : (
        (['Automated', 'Manual'] as const).map((group) => {
          const items = groups.get(group) ?? [];
          if (items.length === 0) return null;
          const conditional = group === 'Automated';
          return (
            <div key={group} className="lse-tr-group">
              <div className="lse-tr-group__head">
                <div className="lse-tr-group__title">{group}</div>
                {conditional && (
                  <div className="lse-tr-group__actions">
                    <Button
                      variant="neutral"
                      size="sm"
                      iconLeading={<Icon name="arrow-up" size={13} />}
                      disabled={!canMoveUp}
                      onClick={() => moveSelected(-1)}
                    >
                      Move up
                    </Button>
                    <Button
                      variant="neutral"
                      size="sm"
                      iconLeading={
                        <Icon name="arrow-up" size={13} style={{ transform: 'rotate(180deg)' }} />
                      }
                      disabled={!canMoveDown}
                      onClick={() => moveSelected(1)}
                    >
                      Move down
                    </Button>
                  </div>
                )}
              </div>
              <table className="lse-tr-table">
                <thead>
                  <tr>
                    {conditional && <th style={{ width: 130 }}>Execution Order</th>}
                    <th style={{ width: '38%' }}>Transition</th>
                    <th>Rule</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(({ rule, idx }, position) => {
                    const toStage = rule.toStage || '— No target —';
                    const key = ruleKey(rule, idx);
                    return (
                      <tr key={rule.id ?? idx}>
                        {conditional && (
                          <td className="lse-tr-table__order">
                            <span className="lse-tr-table__order-inner">
                              <Checkbox
                                checked={selectedKeys.has(key)}
                                onChange={() => toggleSelect(key)}
                                aria-label={`Select execution order row ${position + 1}`}
                              />
                              <span className="lse-tr-table__num">{position + 1}</span>
                            </span>
                          </td>
                        )}
                        <td>
                          <div className="lse-tr-transition">
                            <span>{fromStage}</span>
                            <Icon
                              name="arrow-left"
                              size={13}
                              style={{ transform: 'rotate(180deg)' }}
                            />
                            <span>{toStage}</span>
                          </div>
                        </td>
                        <td>{renderRuleCell(rule)}</td>
                        <td className="lse-tr-table__actions">
                          <div className="lse-tr-table__actions-inner">
                            <Button
                              variant="icon"
                              aria-label="Edit rule"
                              onClick={() =>
                                setModal({ open: true, editingId: rule.id ?? idx })
                              }
                            >
                              <Icon name="edit" size={14} />
                            </Button>
                            <Button
                              variant="icon"
                              aria-label="Delete rule"
                              onClick={() => onDeleteRule(idx)}
                            >
                              <Icon name="trash" size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })
      )}

      <TransitionRuleModal
        open={modal.open}
        rule={
          modal.editingId != null
            ? rules.find(
                (r, i) => r.id === modal.editingId || i === modal.editingId,
              ) ?? null
            : null
        }
        otherStages={otherStages}
        entities={entities}
        defaultStageKey={
          stageIdx >= 0 ? `current::${cfg.stages[stageIdx]}` : undefined
        }
        presetToStage={modal.presetToStage}
        isDuplicate={findDuplicate}
        onCancel={() => setModal({ open: false, editingId: null })}
        onSave={(draft) => onSaveRule(modal.editingId, draft)}
      />
    </div>
  );
}

interface TransitionRuleModalProps {
  open: boolean;
  rule: TransitionRule | null;
  otherStages: string[];
  entities: ConditionEntity[];
  defaultStageKey?: string;
  presetToStage?: string;
  isDuplicate: (
    toStage: string,
    trigger: 'Manual' | 'Automated',
    exceptId: number,
  ) => boolean;
  onCancel: () => void;
  onSave: (draft: TransitionRule) => void;
}

function TransitionRuleModal({
  open,
  rule,
  otherStages,
  entities,
  defaultStageKey,
  presetToStage,
  isDuplicate,
  onCancel,
  onSave,
}: TransitionRuleModalProps) {
  const [toStage, setToStage] = useState('');
  const [trigger, setTrigger] = useState<'Manual' | 'Automated'>('Manual');
  const [conditions, setConditions] = useState<TransitionCondition[]>([]);
  const [expression, setExpression] = useState('');

  useEffect(() => {
    if (!open) return;
    setToStage(rule?.toStage ?? presetToStage ?? '');
    setTrigger((rule?.trigger as 'Manual' | 'Automated') ?? 'Manual');
    setConditions(
      rule?.conditions
        ? JSON.parse(JSON.stringify(rule.conditions))
        : [],
    );
    setExpression(rule?.expression ?? '');
  }, [open, rule?.id, presetToStage]);

  const duplicate =
    toStage.trim().length > 0 && isDuplicate(toStage, trigger, rule?.id ?? -1);
  const duplicateMsg = duplicate
    ? `A ${trigger} transition to "${toStage}" already exists. Edit the existing row instead of creating a new one.`
    : undefined;
  const valid = toStage.trim().length > 0 && !duplicate;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={rule ? 'Edit Transition Rule' : 'New Transition Rule'}
      size="lg"
      footer={
        <>
          <Button variant="neutral" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="brand"
            disabled={!valid}
            onClick={() =>
              onSave({
                id: rule?.id,
                toStage,
                trigger,
                conditions,
                expression,
              })
            }
          >
            Save
          </Button>
        </>
      }
    >
      <div className="lse-tr-modal">
        <div className="lse-tr-modal__row">
          <Select
            label="Transition To"
            required
            error={duplicateMsg}
            value={toStage}
            onChange={(e) => setToStage(e.target.value)}
            options={[
              { value: '', label: '— Select target stage —' },
              ...otherStages.map((s) => ({ value: s, label: s })),
            ]}
            fullWidth
          />
          <div>
            <div className="lse-tr-modal__label">Trigger</div>
            <div className="lse-tr-modal__radios">
              {TRIGGERS.map((t) => (
                <label key={t} className="lse-tr-modal__radio">
                  <input
                    type="radio"
                    name="tr-trigger"
                    checked={trigger === t}
                    onChange={() => setTrigger(t)}
                  />
                  <span>{t}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="lse-tr-modal__divider">Transition Conditions</div>

        <ConditionRows
          entities={entities}
          conditions={conditions as ConditionLike[]}
          expression={expression}
          operators={STRING_OPERATORS}
          responses={['Outcome', 'Value']}
          noValueOps={NO_VALUE_OPS}
          defaultStageKey={defaultStageKey}
          onChange={(next) => setConditions(next as TransitionCondition[])}
          onExpressionChange={setExpression}
          addLabel="Add Condition"
        />
      </div>
    </Modal>
  );
}
