import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Checkbox, Icon, Input, Modal } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type {
  ActivityInstance,
  SetupConfig,
  StageConfig,
} from '@/types/config';
import '@/panels/RunMyDay/PlaybookWizard.css';
import '@/panels/ActivitiesAndStages/ActivitiesEntityEditor.css';
import '@/panels/LinesOfBusiness/LobActivitiesSection.css';
import '@/panels/LinesOfBusiness/LobStageManagementSection.css';

/**
 * Stage configurations scoped to the parent Submission level. Mirrors the
 * LOB version (`LobStageManagementSection`) but pins `recordType` to the
 * special `'Submission'` value so these configs sit alongside per-LOB
 * configurations without polluting any single LOB list.
 */
const SUBMISSION_RECORD_TYPE = 'Submission';

function backTo(): string {
  const params = new URLSearchParams({
    cat: 'stages-and-activities',
    sub: 'stage-management',
  });
  return `/submission-settings?${params.toString()}`;
}

/**
 * Deep-clone a stage configuration into a brand-new one, copying every stage,
 * prompt, transition rule and task instance. Task instance ids are remapped so
 * the copy is independent, and every intra-config reference (task-outcome
 * conditions on availability / trigger / re-entry rules, plus transition-rule
 * conditions) is rewritten to the new ids. References that point at tasks in
 * *other* configurations are left untouched. Returns the next `SetupConfig`
 * and the new config's id via `out`.
 */
export interface StageDraft {
  name: string;
  active: boolean;
  effectiveFrom: string;
  effectiveTo: string;
}

export function cloneStageConfig(
  prev: SetupConfig,
  sourceId: number,
  draft: StageDraft,
  out: { id: number },
): SetupConfig {
  const source = prev.stageConfigs.find((c) => c.id === sourceId);
  if (!source) return prev;

  const newCfgId = prev.nextStageConfigId;
  out.id = newCfgId;

  // Remap every task instance id belonging to this config first, so condition
  // references can be rewritten in a second pass.
  const idMap = new Map<string, number>();
  let nextTaskId = prev.nextActivityId;
  source.stages.forEach((_stage, idx) => {
    const tasks = prev.activitiesData[`${sourceId}:${idx}`] ?? [];
    tasks.forEach((t) => {
      idMap.set(String(t.id), nextTaskId);
      nextTaskId += 1;
    });
  });

  const remapId = (activityId: number | string | undefined) => {
    if (activityId == null) return activityId;
    const mapped = idMap.get(String(activityId));
    return mapped ?? activityId;
  };

  const cloneTask = (t: ActivityInstance): ActivityInstance => {
    const copy: ActivityInstance = JSON.parse(JSON.stringify(t));
    copy.id = idMap.get(String(t.id))!;
    if (copy.availabilityRules) {
      copy.availabilityRules = copy.availabilityRules.map((r) =>
        'activityId' in r
          ? { ...r, activityId: remapId((r as { activityId?: number | string }).activityId) }
          : r,
      );
    }
    if (copy.triggerRules) {
      copy.triggerRules = {
        ...copy.triggerRules,
        conditions: copy.triggerRules.conditions.map((c) => ({
          ...c,
          activityId: remapId(c.activityId) as number,
        })),
      };
    }
    if (copy.reentryRules) {
      copy.reentryRules = {
        ...copy.reentryRules,
        conditions: copy.reentryRules.conditions.map((c) => ({
          ...c,
          activityId: remapId(c.activityId) as number,
        })),
      };
    }
    return copy;
  };

  const newActivitiesData: Record<string, ActivityInstance[]> = {};
  source.stages.forEach((_stage, idx) => {
    const tasks = prev.activitiesData[`${sourceId}:${idx}`] ?? [];
    newActivitiesData[`${newCfgId}:${idx}`] = tasks.map(cloneTask);
  });

  // Deep-clone transition rules and remap their condition task references.
  const newTransitionRules = source.stageTransitionRules
    ? Object.fromEntries(
        Object.entries(source.stageTransitionRules).map(([stage, rules]) => [
          stage,
          rules.map((r) => ({
            ...JSON.parse(JSON.stringify(r)),
            conditions: (r.conditions ?? []).map((c) => ({
              ...c,
              activityId: remapId(c.activityId),
            })),
          })),
        ]),
      )
    : undefined;

  const cloned: StageConfig = {
    ...JSON.parse(JSON.stringify(source)),
    id: newCfgId,
    name: draft.name.trim(),
    active: draft.active,
    effectiveFrom: draft.effectiveFrom,
    effectiveTo: draft.effectiveTo,
    stageTransitionRules: newTransitionRules,
  };

  return {
    ...prev,
    stageConfigs: [...prev.stageConfigs, cloned],
    nextStageConfigId: prev.nextStageConfigId + 1,
    activitiesData: { ...prev.activitiesData, ...newActivitiesData },
    nextActivityId: nextTaskId,
  };
}

/** Clone popover — same fields as the New form, prefilled from the source
 * (name defaults to "Copy of {source}"). Copies every stage, prompt,
 * transition rule and task on save. */
export function CloneStageConfigModal({
  source,
  onCancel,
  onSave,
}: {
  source: StageConfig | null;
  onCancel: () => void;
  onSave: (draft: StageDraft) => void;
}) {
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    if (!source) return;
    setName(`Copy of ${source.name}`);
    setActive(source.active);
    setFrom(source.effectiveFrom ?? '');
    setTo(source.effectiveTo ?? '');
  }, [source]);

  const valid = name.trim().length > 0;
  const draft: StageDraft = {
    name: name.trim(),
    active,
    effectiveFrom: from,
    effectiveTo: to,
  };

  return (
    <Modal
      open={!!source}
      onClose={onCancel}
      title="Clone Stage Configuration"
      footer={
        <>
          <Button variant="neutral" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="brand" disabled={!valid} onClick={() => onSave(draft)}>
            Clone
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--slds-g-font-scale-neg-1)',
            color: 'var(--slds-g-color-on-surface-1)',
          }}
        >
          Copies every stage, prompt, transition rule and task from{' '}
          <strong>{source?.name}</strong> into a new configuration.
        </p>
        <Input
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          fullWidth
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input
            label="Effective From"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            label="Effective To"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <Checkbox
          label="Active"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
      </div>
    </Modal>
  );
}

export function SubmissionStageManagementSection() {
  const { config, update } = useConfig();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [cloneTarget, setCloneTarget] = useState<StageConfig | null>(null);

  const configs = useMemo(
    () => config.stageConfigs.filter((c) => c.recordType === SUBMISSION_RECORD_TYPE),
    [config.stageConfigs],
  );

  const trimmed = query.trim().toLowerCase();
  const visible = trimmed
    ? configs.filter((c) => c.name.toLowerCase().includes(trimmed))
    : configs;

  const taskCountFor = (cfg: StageConfig): number => {
    let n = 0;
    cfg.stages.forEach((_stage, idx) => {
      const key = `${cfg.id}:${idx}`;
      n += (config.activitiesData[key] ?? []).length;
    });
    return n;
  };

  const onDelete = (cfg: StageConfig) => {
    if (!confirm(`Delete stage configuration "${cfg.name}"?`)) return;
    update((p) => ({
      ...p,
      stageConfigs: p.stageConfigs.filter((c) => c.id !== cfg.id),
    }));
    setOpenMenuId(null);
  };

  const onCloneSave = (draft: StageDraft) => {
    if (!cloneTarget) return;
    const out = { id: 0 };
    update((p) => cloneStageConfig(p, cloneTarget.id, draft, out));
    setCloneTarget(null);
  };

  const createConfig = (draft: {
    name: string;
    active: boolean;
    effectiveFrom: string;
    effectiveTo: string;
  }): number => {
    let newId = 0;
    update((p) => {
      newId = p.nextStageConfigId;
      const next: StageConfig = {
        id: newId,
        name: draft.name.trim(),
        object: 'Submission',
        recordType: SUBMISSION_RECORD_TYPE,
        picklist: 'Stages',
        stages: [],
        active: draft.active,
        effectiveFrom: draft.effectiveFrom,
        effectiveTo: draft.effectiveTo,
      };
      return {
        ...p,
        stageConfigs: [...p.stageConfigs, next],
        nextStageConfigId: p.nextStageConfigId + 1,
      };
    });
    return newId;
  };

  return (
    <div className="lob-activities">
      <header className="lob-activities__header">
        <div>
          <h3 className="lob-activities__title">Submission — Stage Management</h3>
          <p className="lob-activities__sub">
            {configs.length} configuration{configs.length === 1 ? '' : 's'} at the parent
            Submission level.
          </p>
        </div>
      </header>

      <div className="lob-activities__toolbar">
        <Input
          placeholder="Search by name"
          iconLeading={<Icon name="search" size={14} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search submission stage configurations by name"
          className="lob-activities__search"
        />
        <button
          type="button"
          className="lob-activities__new-btn"
          onClick={() => setCreating(true)}
          disabled={creating}
        >
          <Icon name="plus" size={14} />
          New Stage Configuration
        </button>
      </div>

      <div className="lob-activities__list">
        {creating && (
          <NewStageConfigForm
            onCancel={() => setCreating(false)}
            onSave={(draft) => {
              createConfig(draft);
              setCreating(false);
            }}
            onSaveAndConfigure={(draft) => {
              const id = createConfig(draft);
              setCreating(false);
              if (id > 0)
                navigate(
                  `/submission-settings/stage-config/${id}?from=${encodeURIComponent(backTo())}`,
                );
            }}
          />
        )}

        {configs.length === 0 && !creating ? (
          <div className="lob-activities__empty">
            <p style={{ margin: 0 }}>No submission-level stage configurations yet.</p>
            <Button
              variant="brand"
              iconLeading={<Icon name="plus" size={14} />}
              onClick={() => setCreating(true)}
            >
              New Stage Configuration
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="lob-activities__empty">No configurations match "{query}".</div>
        ) : (
          visible.map((c) => (
            <StageConfigTile
              key={c.id}
              cfg={c}
              taskCount={taskCountFor(c)}
              onOpen={() =>
                navigate(`/submission-settings/stage-config/${c.id}?from=${encodeURIComponent(backTo())}`)
              }
              menuOpen={openMenuId === c.id}
              onMenuToggle={(next) =>
                setOpenMenuId(next ? c.id : openMenuId === c.id ? null : openMenuId)
              }
              onEdit={() => {
                setOpenMenuId(null);
                navigate(`/submission-settings/stage-config/${c.id}?from=${encodeURIComponent(backTo())}`);
              }}
              onClone={() => {
                setOpenMenuId(null);
                setCloneTarget(c);
              }}
              onDelete={() => onDelete(c)}
            />
          ))
        )}
      </div>

      <CloneStageConfigModal
        source={cloneTarget}
        onCancel={() => setCloneTarget(null)}
        onSave={onCloneSave}
      />
    </div>
  );
}

interface TileProps {
  cfg: StageConfig;
  taskCount: number;
  onOpen: () => void;
  menuOpen: boolean;
  onMenuToggle: (next: boolean) => void;
  onClone: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function StageConfigTile({
  cfg,
  taskCount,
  onOpen,
  menuOpen,
  onMenuToggle,
  onEdit,
  onClone,
  onDelete,
}: TileProps) {
  const stageCount = cfg.stages.length;
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
          {cfg.active ? (
            <Badge tone="success">Active</Badge>
          ) : (
            <Badge>Inactive</Badge>
          )}
          <TileMenu
            open={menuOpen}
            onToggle={onMenuToggle}
            onEdit={onEdit}
            onClone={onClone}
            onDelete={onDelete}
          />
        </div>
      </div>
      <div className="act-tile__name">
        <span className="act-tile__name-text">{cfg.name || 'Untitled configuration'}</span>
      </div>
      <div className="lob-stage-tile__sub">
        {stageCount} Stage{stageCount === 1 ? '' : 's'} · {taskCount} Task
        {taskCount === 1 ? '' : 's'}
      </div>
    </div>
  );
}

interface TileMenuProps {
  open: boolean;
  onToggle: (next: boolean) => void;
  onEdit: () => void;
  onClone: () => void;
  onDelete: () => void;
}

function TileMenu({ open, onToggle, onEdit, onClone, onDelete }: TileMenuProps) {
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
        aria-label="Stage configuration actions"
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
            className="lob-tile-menu__item"
            onClick={onClone}
          >
            <Icon name="layers" size={14} />
            Clone
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

interface NewFormProps {
  onCancel: () => void;
  onSave: (draft: StageDraft) => void;
  onSaveAndConfigure: (draft: StageDraft) => void;
}

function NewStageConfigForm({
  onCancel,
  onSave,
  onSaveAndConfigure,
}: NewFormProps) {
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState('');

  const valid = name.trim().length > 0;
  const draft: StageDraft = {
    name: name.trim(),
    active,
    effectiveFrom: from,
    effectiveTo: to,
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
          <h4 className="act-col-title">New Stage Configuration</h4>
          <span className="act-col-sub">
            Scoped to the parent <strong>Submission</strong> object.
          </span>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Submission V1"
            fullWidth
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Input
              label="Effective From"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <Input
              label="Effective To"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
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
