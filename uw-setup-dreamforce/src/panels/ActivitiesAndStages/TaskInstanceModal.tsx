import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Checkbox, Dropdown, Icon, Input, Modal, Select, Textarea } from '@/components/ui';
import type {
  ActivityInstance,
  AlertCondition,
  ReusableActivity,
  TriggerCondition,
  TriggerRules,
} from '@/types/config';
import { processSpecFor } from './activity-process';
import { ConditionRows, type ConditionEntity, type ConditionLike } from './ConditionRows';

const TRIGGER_OPERATORS = ['equals', 'not equal to', 'contains', 'starts with'];
const RESPONSES = ['Outcome', 'Status'];
const ALERT_RESPONSES = ['Outcome', 'Status'];
const ALERT_OPERATORS = ['equals', 'not equal to', 'contains', 'starts with', 'is blank', 'is not blank'];
const NO_VALUE_ALERT_OPS = new Set(['is blank', 'is not blank']);

type AvailabilityMode = 'On Stage Entry' | 'Conditional';
type TriggerMode = 'Manual' | 'On Stage Entry' | 'Conditional';

interface Props {
  open: boolean;
  /**
   * Task being edited, or `null` when creating a new task. When editing, the
   * existing instance is the source of truth for initial values.
   */
  editing: ActivityInstance | null;
  /**
   * Activity library entry that this task wraps. Fixed by the drag source /
   * edited task, or `null` when the modal was opened from the floating "New
   * task" button (in which case `activitySelectable` is true and the user
   * picks it here).
   */
  activity: ReusableActivity | null;
  /** When true the activity is chosen via the in-modal search + dropdown. */
  activitySelectable?: boolean;
  /** Activities the picker can choose from (already scoped to the LOB). */
  activityChoices?: ReusableActivity[];
  /** Called when the user picks an activity from the in-modal dropdown. */
  onActivityChange?: (activity: ReusableActivity) => void;
  /** Stages available on this configuration for the Stage picker. */
  stages?: { key: string; idx: number; name: string }[];
  /** When true the Stage is a selectable dropdown (button path); else read-only. */
  stageEditable?: boolean;
  /** Called when the user picks a stage (button path). */
  onStageChange?: (stageKey: string, stageIdx: number) => void;
  /**
   * Entity → Stage → Task universe a condition row can pull a dependency from:
   * the current entity (this config), other LOBs, and Submission. Built by
   * `buildConditionEntities`.
   */
  entities: ConditionEntity[];
  /** Entity pre-selected for a fresh condition row (defaults to current). */
  defaultEntityId?: string;
  /** Stage pre-selected for a fresh condition row (`${entityId}::${stageName}`). */
  defaultStageKey?: string;
  /** Stage key under which to persist (`{cfgId}:{stageIdx}`). */
  stageKey: string;
  /** Called with the saved instance. Caller persists. */
  onSave: (next: ActivityInstance) => void;
  onCancel: () => void;
  /** Called when the user deletes the task. Only invoked when editing. */
  onDelete?: () => void;
}

interface Draft {
  nameOverride: string;
  description: string;
  availability: AvailabilityMode;
  availabilityRules: TriggerCondition[];
  availabilityExpression: string;
  trigger: TriggerMode;
  triggerRules: TriggerCondition[];
  triggerExpression: string;
  buttonName: string;
  alertEnabled: boolean;
  alertConditions: AlertCondition[];
  alertExpression: string;
  alertShowInRequiresAttention: boolean;
  alertNotifyUser: boolean;
}

const condBoxStyle: React.CSSProperties = {
  padding: 12,
  background: 'var(--slds-g-color-surface-container-2)',
  border: '1px solid var(--slds-g-color-border-1)',
  borderRadius: 'var(--slds-g-radius-border-2)',
};

function instanceToDraft(inst: ActivityInstance | null, lib: ReusableActivity | null): Draft {
  if (!inst) {
    return {
      nameOverride: lib?.name ?? '',
      description: lib?.description ?? '',
      availability: 'On Stage Entry',
      availabilityRules: [],
      availabilityExpression: '',
      trigger: 'On Stage Entry',
      triggerRules: [],
      triggerExpression: '',
      buttonName: '',
      alertEnabled: false,
      alertConditions: [],
      alertExpression: '',
      alertShowInRequiresAttention: false,
      alertNotifyUser: false,
    };
  }
  const avail = (inst.availability === 'Conditional' ? 'Conditional' : 'On Stage Entry') as AvailabilityMode;
  const trig = (inst.trigger === 'Conditional'
    ? 'Conditional'
    : inst.trigger === 'Manual'
      ? 'Manual'
      : 'On Stage Entry') as TriggerMode;
  return {
    nameOverride: inst.nameOverride ?? lib?.name ?? '',
    description: inst.description ?? lib?.description ?? '',
    availability: avail,
    availabilityRules: Array.isArray(inst.availabilityRules)
      ? (inst.availabilityRules as TriggerCondition[])
      : [],
    availabilityExpression: inst.availabilityExpression ?? '',
    trigger: trig,
    triggerRules: inst.triggerRules?.conditions ?? [],
    triggerExpression: inst.triggerRules?.expression ?? '',
    buttonName: inst.buttonName ?? '',
    alertEnabled: !!inst.alert?.enabled,
    alertConditions: inst.alert?.conditions ?? [],
    alertExpression: inst.alert?.expression ?? '',
    alertShowInRequiresAttention: !!inst.alert?.showInRequiresAttention,
    alertNotifyUser: !!inst.alert?.notifyUser,
  };
}

export function TaskInstanceModal({
  open,
  editing,
  activity,
  activitySelectable = false,
  activityChoices = [],
  onActivityChange,
  stages = [],
  stageEditable = false,
  onStageChange,
  entities,
  defaultEntityId,
  defaultStageKey,
  stageKey,
  onSave,
  onCancel,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState<Draft>(() => instanceToDraft(editing, activity));
  // Track whether the user has typed a custom display name, so an activity
  // pick (button path) can seed the name without clobbering a manual edit.
  const nameTouched = useRef(false);
  // Same for the description — an activity pick seeds it unless the user edited.
  const descTouched = useRef(false);

  useEffect(() => {
    if (open) {
      setDraft(instanceToDraft(editing, activity));
      nameTouched.current = false;
      descTouched.current = false;
    }
    // Intentionally excludes `activity`: re-picking the activity in the button
    // path must not reset the rest of the draft. Name seeding is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const spec = activity ? processSpecFor(activity.action) : null;
  const Glyph = spec?.icon;

  const stageValid = !stageEditable || stageKey !== '';

  const onSubmit = () => {
    if (!activity) return;
    const id = editing?.id ?? Date.now();
    const buildRules = (
      conds: TriggerCondition[],
      expression: string,
    ): TriggerRules => ({
      stageKey,
      conditions: conds.filter((c) => c.activityId),
      expression,
    });
    const next: ActivityInstance = {
      id,
      activityRefId: activity.id,
      nameOverride: draft.nameOverride.trim() || activity.name,
      description: draft.description.trim() || undefined,
      availability: draft.availability,
      availabilityRules:
        draft.availability === 'Conditional'
          ? draft.availabilityRules.filter((c) => c.activityId)
          : null,
      availabilityExpression:
        draft.availability === 'Conditional'
          ? draft.availabilityExpression
          : undefined,
      trigger: draft.trigger,
      triggerRules:
        draft.trigger === 'Conditional'
          ? buildRules(draft.triggerRules, draft.triggerExpression)
          : null,
      // Loops are derived from trigger conditions now — never write reentryRules.
      reentryRules: null,
      mandatory: editing?.mandatory ?? false,
      buttonName: draft.trigger === 'Manual' ? draft.buttonName.trim() : undefined,
      alert: draft.alertEnabled
        ? {
            enabled: true,
            conditions: draft.alertConditions.filter((c) => c.value.trim() || NO_VALUE_ALERT_OPS.has(c.operator)),
            expression: draft.alertExpression,
            showInRequiresAttention: draft.alertShowInRequiresAttention,
            notifyUser: draft.alertNotifyUser,
          }
        : undefined,
    };
    onSave(next);
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={editing ? 'Edit Task' : 'Add Task to Stage'}
      size="lg"
      footer={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            width: '100%',
          }}
        >
          {editing && onDelete ? (
            <Button
              variant="destructive"
              onClick={() => {
                if (!confirm(`Delete "${draft.nameOverride || 'this task'}" from the stage?`)) return;
                onDelete();
              }}
              iconLeading={<Icon name="trash" size={14} />}
            >
              Delete Task
            </Button>
          ) : (
            <span />
          )}
          <span style={{ display: 'inline-flex', gap: 8 }}>
            <Button variant="neutral" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="brand"
              onClick={onSubmit}
              disabled={!draft.nameOverride.trim() || !activity || !stageValid}
            >
              Save
            </Button>
          </span>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Activity — a searchable dropdown when opened from the "New task"
         * button, or a read-only reference chip when set by the drag / edit. */}
        {activitySelectable ? (
          <ActivityPicker
            activities={activityChoices}
            selected={activity}
            onSelect={(a) => {
              onActivityChange?.(a);
              if (!nameTouched.current) set('nameOverride', a.name);
              if (!descTouched.current) set('description', a.description ?? '');
            }}
          />
        ) : activity && spec && Glyph ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              background: 'var(--slds-g-color-surface-container-2)',
              border: '1px solid var(--slds-g-color-border-1)',
              borderRadius: 'var(--slds-g-radius-border-2)',
              minWidth: 0,
            }}
          >
            <span
              style={{
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 'var(--slds-g-radius-border-pill)',
                background: spec.chipBg,
                color: spec.chipFg,
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                lineHeight: 1.4,
              }}
            >
              <span
                aria-hidden="true"
                style={{ display: 'inline-flex', width: 12, height: 12 }}
              >
                <Glyph />
              </span>
              {spec.label}
            </span>
            <span
              style={{
                fontWeight: 500,
                fontSize: 13,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {activity.name}
            </span>
            {activity.description && (
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--slds-g-color-on-surface-1)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                · {activity.description}
              </span>
            )}
          </div>
        ) : null}

        {/* Core fields — 2-column grid: Stage | Display Name, Description spans. */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 20,
          }}
        >
          {/* Stage — read-only when the stage is fixed (drag / edit); a picker
           * when the modal was opened from the floating "New task" button. */}
          {stageEditable ? (
            <Select
              label="Stage"
              required
              value={stageKey}
              onChange={(e) => {
                const s = stages.find((x) => x.key === e.target.value);
                if (s) onStageChange?.(s.key, s.idx);
                else onStageChange?.('', -1);
              }}
            >
              <option value="">— Select a stage —</option>
              {stages.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              label="Stage"
              value={stages.find((s) => s.key === stageKey)?.name ?? ''}
              readOnly
              disabled
              fullWidth
            />
          )}

          {/* Display Name */}
          <Input
            label="Display Name"
            required
            value={draft.nameOverride}
            onChange={(e) => {
              nameTouched.current = true;
              set('nameOverride', e.target.value);
            }}
            placeholder="Name shown for this task in the runtime"
            fullWidth
          />

          {/* Description — seeded from the activity, editable per task. */}
          <div style={{ gridColumn: '1 / -1' }}>
            <Textarea
              label="Description"
              value={draft.description}
              onChange={(e) => {
                descTouched.current = true;
                set('description', e.target.value);
              }}
              placeholder="Describe what this task does"
              rows={2}
              hint="Autofilled from the activity — edit to override for this task."
              fullWidth
            />
          </div>
        </div>

        {/* Availability */}
        <SectionDivider>Availability</SectionDivider>
        <RadioRow
          name="availability"
          value={draft.availability}
          options={['On Stage Entry', 'Conditional'] as AvailabilityMode[]}
          onChange={(v) => set('availability', v as AvailabilityMode)}
        />
        {draft.availability === 'Conditional' && (
          <div style={condBoxStyle}>
            <ConditionRows
              entities={entities}
              conditions={draft.availabilityRules as ConditionLike[]}
              expression={draft.availabilityExpression}
              operators={TRIGGER_OPERATORS}
              responses={RESPONSES}
              defaultEntityId={defaultEntityId}
              defaultStageKey={defaultStageKey}
              onChange={(next) => set('availabilityRules', next as TriggerCondition[])}
              onExpressionChange={(next) => set('availabilityExpression', next)}
              label="Available when"
            />
          </div>
        )}

        {/* Trigger */}
        <SectionDivider>Trigger</SectionDivider>
        <RadioRow
          name="trigger"
          value={draft.trigger}
          options={['Manual', 'On Stage Entry', 'Conditional'] as TriggerMode[]}
          onChange={(v) => set('trigger', v as TriggerMode)}
        />
        {draft.trigger === 'Conditional' && (
          <>
            <div style={condBoxStyle}>
              <ConditionRows
                entities={entities}
                conditions={draft.triggerRules as ConditionLike[]}
                expression={draft.triggerExpression}
                operators={TRIGGER_OPERATORS}
                responses={RESPONSES}
                defaultEntityId={defaultEntityId}
                defaultStageKey={defaultStageKey}
                onChange={(next) => set('triggerRules', next as TriggerCondition[])}
                onExpressionChange={(next) => set('triggerExpression', next)}
                label="Triggered when"
              />
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: 'var(--slds-g-color-on-surface-1)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 6,
              }}
            >
              <span style={{ flexShrink: 0, marginTop: 1 }}>
                <Icon name="refresh" size={12} />
              </span>
              <span>
                Reference an earlier task to gate this task's first run. Reference a
                later task and it becomes a loop — this task re-runs on that task's
                outcome, shown as an amber feedback arc on the canvas.
              </span>
            </p>
          </>
        )}
        {draft.trigger === 'Manual' && (
          <Input
            label="Button Name"
            value={draft.buttonName}
            onChange={(e) => set('buttonName', e.target.value)}
            placeholder="e.g. Run Task"
            fullWidth
          />
        )}

        {/* Configure Alert */}
        <SectionDivider>Configure Alert</SectionDivider>
        <Checkbox
          checked={draft.alertEnabled}
          onChange={(e) => set('alertEnabled', e.target.checked)}
          label="Show alerts at runtime"
        />
        {draft.alertEnabled && (
          <div style={condBoxStyle}>
            <AlertConditionRows
              conditions={draft.alertConditions}
              expression={draft.alertExpression}
              onChange={(next) => set('alertConditions', next)}
              onExpressionChange={(next) => set('alertExpression', next)}
            />
            <div
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: '1px solid var(--slds-g-color-border-1)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <Checkbox
                checked={draft.alertShowInRequiresAttention}
                onChange={(e) => set('alertShowInRequiresAttention', e.target.checked)}
                label="Show in 'Requires Attention' section"
              />
              <Checkbox
                checked={draft.alertNotifyUser}
                onChange={(e) => set('alertNotifyUser', e.target.checked)}
                label="Notify User"
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

interface AlertConditionRowsProps {
  conditions: AlertCondition[];
  expression: string;
  onChange: (next: AlertCondition[]) => void;
  onExpressionChange: (next: string) => void;
}

/** Alert conditions gate on the current task's own outcome, so — unlike the
 * shared ConditionRows — there is no Entity → Stage → Task picker. Each row is
 * just response → operator → value. */
function AlertConditionRows({
  conditions,
  expression,
  onChange,
  onExpressionChange,
}: AlertConditionRowsProps) {
  const addRow = () =>
    onChange([
      ...conditions,
      { response: ALERT_RESPONSES[0], operator: ALERT_OPERATORS[0], value: '' },
    ]);
  const updateRow = (idx: number, patch: Partial<AlertCondition>) =>
    onChange(conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  const removeRow = (idx: number) => onChange(conditions.filter((_, i) => i !== idx));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--slds-g-color-on-surface-2)' }}>
        Alert Conditions
      </div>

      {/* Filter Logic — empty means the conditions are ANDed. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '120px minmax(0, 1fr)',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--slds-g-color-on-surface-2)' }}>
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
          No conditions yet. Add one to raise an alert on this task's outcome.
        </div>
      )}

      {conditions.map((c, i) => {
        const noVal = NO_VALUE_ALERT_OPS.has(c.operator);
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
            <div
              style={{
                flex: '1 1 0',
                minWidth: 0,
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 0.9fr) minmax(0, 1.1fr)',
                gap: 8,
              }}
            >
              <Input
                value={c.response}
                onChange={(e) => updateRow(i, { response: e.target.value })}
                aria-label="Outcome"
                placeholder="Outcome"
                fullWidth
              />
              <Dropdown
                value={c.operator}
                onChange={(v) => updateRow(i, { operator: v })}
                aria-label="Operator"
                options={ALERT_OPERATORS.map((op) => ({ value: op, label: op }))}
              />
              {noVal ? (
                <span />
              ) : (
                <Input
                  value={c.value}
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
          Add condition
        </Button>
      </div>
    </div>
  );
}

/* ─── Helpers ─── */

/** One-line scope descriptor: "Global" for cross-LOB activities, the LOB name
 * for LOB-scoped ones, else "Submission". */
function scopeSubline(scope: ReusableActivity['scope']): string {
  if (scope === 'Lines of Submission') return 'Global';
  if (scope && typeof scope === 'object' && 'lob' in scope) return scope.lob;
  if (scope === 'Parent Submission') return 'Submission';
  return 'Global';
}

interface ActivityPickerProps {
  activities: ReusableActivity[];
  selected: ReusableActivity | null;
  onSelect: (a: ReusableActivity) => void;
}

/** Searchable activity dropdown for the "New task" path. The trigger looks
 * like a Select; the open menu shows each activity by name with its scope as a
 * subline. A search field filters the list. Selection can be left blank. */
function ActivityPicker({ activities, selected, onSelect }: ActivityPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    const place = () => {
      const t = triggerRef.current;
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? activities.filter((a) => a.name.toLowerCase().includes(q)) : activities;
  }, [activities, query]);

  return (
    <div className="tim-activity-picker" ref={ref}>
      <label className="slds2-field__label" htmlFor="tim-activity-trigger">
        Activity
      </label>
      <button
        id="tim-activity-trigger"
        type="button"
        className="tim-activity-picker__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={
            selected ? 'tim-activity-picker__value' : 'tim-activity-picker__placeholder'
          }
        >
          {selected ? selected.name : '— Select an activity (optional) —'}
        </span>
        {selected && (
          <span className="tim-activity-picker__value-scope">{scopeSubline(selected.scope)}</span>
        )}
        <Icon name="chevron-down" size={14} />
      </button>
      {open &&
        rect &&
        createPortal(
          <div
            className="tim-activity-picker__menu"
            role="listbox"
            ref={menuRef}
            style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width }}
          >
            <div className="tim-activity-picker__search">
              <Input
                placeholder="Search activities"
                iconLeading={<Icon name="search" size={12} />}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                fullWidth
                aria-label="Search activities"
                autoFocus
              />
            </div>
            <div className="tim-activity-picker__list">
              {filtered.length === 0 ? (
                <div className="tim-activity-picker__empty">No activities match.</div>
              ) : (
                filtered.map((a) => {
                  const isSel = selected?.id === a.id;
                  return (
                    <div
                      key={a.id}
                      role="option"
                      aria-selected={isSel}
                      className={[
                        'tim-activity-picker__option',
                        isSel ? 'tim-activity-picker__option--selected' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => {
                        onSelect(a);
                        setOpen(false);
                      }}
                    >
                      <span className="tim-activity-picker__option-name">{a.name}</span>
                      <span className="tim-activity-picker__option-scope">
                        {scopeSubline(a.scope)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function SectionDivider({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--slds-g-color-on-surface-2)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      <span>{children}</span>
      <span
        style={{
          flex: 1,
          height: 1,
          background: 'var(--slds-g-color-border-1)',
        }}
      />
    </div>
  );
}

function RadioRow<V extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: V;
  options: readonly V[];
  onChange: (v: V) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {options.map((opt) => (
        <label
          key={opt}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--slds-g-color-on-surface-1)',
          }}
        >
          <input
            type="radio"
            name={name}
            checked={value === opt}
            onChange={() => onChange(opt)}
          />
          {opt}
        </label>
      ))}
    </div>
  );
}
