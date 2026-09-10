import { useMemo, useState } from 'react';
import { Button, Dropdown, Icon, Input } from '@/components/ui';
import type { SetupConfig, StageConfig } from '@/types/config';

/**
 * Shared condition-row construct used everywhere stage-management rules gate on
 * another task: the task-instance modal (Availability + Trigger) and the stage
 * Transition Rule modal.
 *
 * Each row is split into two sections by a vertical separator:
 *  - Section 1 — a cascading Entity → Stage picker. Entity is the current LOB
 *    (the config being edited) first, then the other LOBs defined in the
 *    system, then Submission. Stage lists the stages of the chosen entity.
 *  - Section 2 — the dependency itself: Task → response (Outcome/…) → operator
 *    → value. Task options come from the stage chosen in section 1.
 *
 * Conditions still persist as `{ activityId, response, operator, value }`; the
 * entity + stage are derived from the task id (globally unique across
 * `activitiesData`) so no schema change is needed.
 */

/** Structural shape shared by TriggerCondition and TransitionCondition. */
export interface ConditionLike {
  activityId?: number | string;
  response?: string;
  operator?: string;
  value?: string;
}

interface ConditionTask {
  id: number;
  label: string;
}
interface ConditionStage {
  /** Selection identity `${entityId}::${stageName}` — not a storage key. */
  key: string;
  label: string;
  tasks: ConditionTask[];
}
export interface ConditionEntity {
  id: string;
  label: string;
  kind: 'current' | 'lob' | 'submission';
  stages: ConditionStage[];
}

/**
 * Build the Stage → Task universe a condition row can reference. Conditions are
 * restricted to the current entity (the config being edited): a submission
 * config can only reference submission tasks, an LOB config only that LOB's
 * tasks. Cross-entity references are intentionally not offered.
 */
export function buildConditionEntities(
  config: SetupConfig,
  cfg: StageConfig,
  excludeTaskId?: number,
): ConditionEntity[] {
  const nameOf = (t: { id: number; nameOverride?: string; activityRefId?: number }): string => {
    if (t.nameOverride) return t.nameOverride;
    const ref = t.activityRefId
      ? config.reusableActivities.find((a) => a.id === t.activityRefId)
      : null;
    return ref?.name || `Task #${t.id}`;
  };

  const stagesForConfigs = (configs: StageConfig[], entityId: string): ConditionStage[] => {
    const byName = new Map<string, ConditionTask[]>();
    const order: string[] = [];
    for (const sc of configs) {
      sc.stages.forEach((name, idx) => {
        if (!byName.has(name)) {
          byName.set(name, []);
          order.push(name);
        }
        const arr = byName.get(name)!;
        for (const t of config.activitiesData[`${sc.id}:${idx}`] ?? []) {
          if (excludeTaskId != null && t.id === excludeTaskId) continue;
          arr.push({ id: t.id, label: nameOf(t) });
        }
      });
    }
    return order.map((name) => ({
      key: `${entityId}::${name}`,
      label: name,
      tasks: byName.get(name)!,
    }));
  };

  // Current entity only — conditions can reference tasks within this config's
  // own stages, never another LOB's or the Submission's.
  return [
    {
      id: 'current',
      label: cfg.recordType,
      kind: 'current',
      stages: stagesForConfigs([cfg], 'current'),
    },
  ];
}

interface ConditionRowsProps {
  entities: ConditionEntity[];
  conditions: ConditionLike[];
  expression: string;
  onChange: (next: ConditionLike[]) => void;
  onExpressionChange: (next: string) => void;
  /** Operator options for the row. */
  operators: string[];
  /** Response/side options (e.g. Outcome / Status / Value). */
  responses?: string[];
  /** Operators that take no value input (e.g. is blank). */
  noValueOps?: Set<string>;
  /** Entity pre-selected for a fresh row. Defaults to the current entity. */
  defaultEntityId?: string;
  /** Stage pre-selected for a fresh row (`${entityId}::${stageName}`). */
  defaultStageKey?: string;
  /** Optional heading above the Filter Logic row. */
  label?: string;
  /** Text on the add button. */
  addLabel?: string;
}

const DEFAULT_RESPONSES = ['Outcome', 'Status'];
const NO_OPS = new Set<string>();

export function ConditionRows({
  entities,
  conditions,
  expression,
  onChange,
  onExpressionChange,
  operators,
  responses = DEFAULT_RESPONSES,
  noValueOps = NO_OPS,
  defaultEntityId = 'current',
  defaultStageKey,
  label,
  addLabel = 'Add condition',
}: ConditionRowsProps) {
  // Map a task id back to the entity + stage that owns it, so an existing
  // condition opens with its cascade already pointing at the right place.
  const taskLocation = useMemo(() => {
    const m = new Map<number, { entityId: string; stageKey: string }>();
    for (const e of entities)
      for (const s of e.stages)
        for (const t of s.tasks) if (!m.has(t.id)) m.set(t.id, { entityId: e.id, stageKey: s.key });
    return m;
  }, [entities]);

  // Per-row Entity/Stage selection for rows whose task isn't chosen yet.
  const [pending, setPending] = useState<Record<number, { entityId?: string; stageKey?: string }>>(
    {},
  );

  const rowLocation = (idx: number, c: ConditionLike) => {
    const fromTask = c.activityId ? taskLocation.get(Number(c.activityId)) : undefined;
    const entityId =
      fromTask?.entityId ?? pending[idx]?.entityId ?? defaultEntityId ?? entities[0]?.id ?? 'current';
    const entity = entities.find((e) => e.id === entityId) ?? entities[0];
    const stageKey =
      fromTask?.stageKey ??
      pending[idx]?.stageKey ??
      (entityId === (defaultEntityId ?? 'current') ? defaultStageKey : undefined) ??
      entity?.stages[0]?.key ??
      '';
    return { entityId, entity, stageKey };
  };

  const blankCondition = (): ConditionLike => ({
    activityId: 0,
    response: responses[0],
    operator: operators[0],
    value: '',
  });

  const addRow = () => onChange([...conditions, blankCondition()]);
  const updateRow = (idx: number, patch: Partial<ConditionLike>) =>
    onChange(conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  const removeRow = (idx: number) => {
    onChange(conditions.filter((_, i) => i !== idx));
    setPending((p) => {
      const next: Record<number, { entityId?: string; stageKey?: string }> = {};
      for (const [k, v] of Object.entries(p)) {
        const ki = Number(k);
        if (ki < idx) next[ki] = v;
        else if (ki > idx) next[ki - 1] = v;
      }
      return next;
    });
  };
  const setRowStage = (idx: number, stageKey: string) => {
    setPending((p) => ({ ...p, [idx]: { entityId: p[idx]?.entityId, stageKey } }));
    updateRow(idx, { activityId: 0 });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {label && (
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--slds-g-color-on-surface-2)' }}>
          {label}
        </div>
      )}

      {/* Filter Logic — empty means the conditions are ANDed. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '120px minmax(0, 1fr)',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <span
          style={{ fontSize: 12, fontWeight: 600, color: 'var(--slds-g-color-on-surface-2)' }}
        >
          Filter Logic
        </span>
        <Input
          value={expression}
          onChange={(e) => onExpressionChange(e.target.value)}
          placeholder="e.g. (1 AND 2) OR 3"
          hint="Use row numbers, AND, OR, parentheses. Leave blank to AND all conditions."
          fullWidth
        />
      </div>

      {conditions.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--slds-g-color-on-surface-1)' }}>
          No conditions yet. Add one to depend on another task.
        </div>
      )}

      {conditions.map((c, i) => {
        const { entity, stageKey } = rowLocation(i, c);
        const stage = entity?.stages.find((s) => s.key === stageKey);
        const noVal = noValueOps.has(c.operator ?? '');
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 20,
                flexShrink: 0,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--slds-g-color-on-surface-1)',
                textAlign: 'center',
              }}
            >
              {i + 1}
            </span>

            {/* Section 1 — Stage (within the current entity). */}
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <Dropdown
                value={stageKey}
                onChange={(v) => setRowStage(i, v)}
                aria-label="Stage"
                placeholder="— No stages —"
                disabled={!entity || entity.stages.length === 0}
                fullWidth
                options={
                  entity && entity.stages.length > 0
                    ? entity.stages.map((s) => ({ value: s.key, label: s.label }))
                    : []
                }
              />
            </div>

            {/* Vertical separator between the two sections. */}
            <span
              aria-hidden="true"
              style={{
                alignSelf: 'stretch',
                width: 1,
                flexShrink: 0,
                background: 'var(--slds-g-color-border-1)',
              }}
            />

            {/* Section 2 — Task → response → operator → value. */}
            <div
              style={{
                flex: '1.6 1 0',
                minWidth: 0,
                display: 'grid',
                gridTemplateColumns:
                  'minmax(0, 1.3fr) minmax(0, 0.9fr) minmax(0, 0.9fr) minmax(0, 1.1fr)',
                gap: 8,
              }}
            >
              <Dropdown
                value={String(c.activityId ?? '')}
                onChange={(v) => updateRow(i, { activityId: v ? Number(v) : 0 })}
                aria-label="Task"
                placeholder={stage && stage.tasks.length > 0 ? '— Select task —' : '— No tasks —'}
                disabled={!stage || stage.tasks.length === 0}
                options={(stage?.tasks ?? []).map((o) => ({
                  value: String(o.id),
                  label: o.label,
                }))}
              />
              <Input
                value={c.response ?? ''}
                onChange={(e) => updateRow(i, { response: e.target.value })}
                aria-label="Outcome"
                placeholder="Outcome"
                fullWidth
              />
              <Dropdown
                value={c.operator ?? operators[0]}
                onChange={(v) => updateRow(i, { operator: v })}
                aria-label="Operator"
                options={operators.map((op) => ({ value: op, label: op }))}
              />
              {noVal ? (
                <span />
              ) : (
                <Input
                  value={c.value ?? ''}
                  onChange={(e) => updateRow(i, { value: e.target.value })}
                  placeholder="Value"
                  fullWidth
                />
              )}
            </div>

            <Button variant="icon" aria-label="Remove condition" onClick={() => removeRow(i)}>
              <Icon name="trash" size={14} />
            </Button>
          </div>
        );
      })}

      <div>
        <Button variant="link" iconLeading={<Icon name="plus" size={12} />} onClick={addRow}>
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
