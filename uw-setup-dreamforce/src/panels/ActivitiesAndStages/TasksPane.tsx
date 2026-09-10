import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, Checkbox, Icon, Input, Modal } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type {
  ActivityInstance,
  ActivityScope,
  AvailabilityRule,
  ReusableActivity,
  StageConfig,
  TriggerCondition,
} from '@/types/config';
import { ActivityEditor } from './ActivityEditor';
import { processSpecFor } from './activity-process';
import {
  bucketByColumns,
  computeIncomingByTask,
  computeLoopEdges,
  computeSubmissionDeps,
  computeTaskEdges,
} from './task-layout';

/**
 * A task that lives outside the current stage configuration (in Submission or
 * another LOB), resolved for the "Depends on" connection tile. Carries the
 * coordinates needed to open that task's own edit modal.
 */
interface ExternalTaskRef {
  id: number;
  name: string;
  /** Owning entity label — 'Submission' or the LOB name. */
  entity: string;
  stage: string;
  stageKey: string;
  stageIdx: number;
  cfgId: number;
  instance: ActivityInstance;
}
import { TaskInstanceModal } from './TaskInstanceModal';
import { buildConditionEntities } from './ConditionRows';
import './TasksPane.css';

interface Props {
  /** The full stage configuration — the canvas spans every stage in it. */
  cfg: StageConfig;
  /** LOB this configuration is for, used to filter the activities palette. */
  lob: string;
  /** Stage currently selected in the path; drives scroll-to + spy highlight. */
  activeStage: string;
  /** Called when the canvas scrolls a different stage band into view. */
  onActiveStageChange: (stage: string) => void;
}

/** One stage's slice of the continuous canvas. */
interface Band {
  idx: number;
  name: string;
  key: string;
  tasks: ActivityInstance[];
}

interface ModalState {
  open: boolean;
  activity: ReusableActivity | null;
  editing: ActivityInstance | null;
  stageKey: string;
  stageIdx: number;
  /** When true the activity is chosen inside the modal (the floating "New
   * task" button path); when false it's fixed by the drag source / edit. */
  selectable: boolean;
  /**
   * Set when editing a task that lives in another stage configuration (reached
   * from a "Depends on" tile). The modal's stage list, condition entities and
   * persistence target are built against this config instead of the current
   * one. Null for the normal in-config path.
   */
  foreignCfg: StageConfig | null;
}

/** A task selected on the canvas, opening its view-only detail panel. */
interface SelectedTask {
  id: number;
  stageKey: string;
  stageIdx: number;
}

const CLOSED_MODAL: ModalState = {
  open: false,
  activity: null,
  editing: null,
  stageKey: '',
  stageIdx: -1,
  selectable: false,
  foreignCfg: null,
};

export function TasksPane({ cfg, lob, activeStage, onActiveStageChange }: Props) {
  const { config, update } = useConfig();

  const bands: Band[] = useMemo(
    () =>
      cfg.stages.map((name, idx) => {
        const key = `${cfg.id}:${idx}`;
        return { idx, name, key, tasks: config.activitiesData[key] ?? [] };
      }),
    [cfg.id, cfg.stages, config.activitiesData],
  );

  // The full task universe across every stage. Cross-stage dependencies
  // resolve against this set so connectors can cross band boundaries.
  const allTasks = useMemo(() => bands.flatMap((b) => b.tasks), [bands]);

  // Parent-Submission stage configs only surface Global activities (scope
  // 'Lines of Submission') in their palette — no submission-scoped rows.
  const globalOnly = lob === 'Submission';

  const lobActivities = useMemo(() => {
    // Parent-Submission stage configs carry recordType 'Submission' and show
    // only Global activities. LOB configs pull from activities scoped to their
    // matching { lob }, plus Global activities (available to every LOB).
    if (globalOnly) {
      return config.reusableActivities.filter(
        (a) => a.scope === 'Lines of Submission',
      );
    }
    return config.reusableActivities.filter(
      (a) =>
        a.scope === 'Lines of Submission' ||
        (a.scope && typeof a.scope === 'object' && 'lob' in a.scope && a.scope.lob === lob),
    );
  }, [config.reusableActivities, lob, globalOnly]);

  const [modal, setModal] = useState<ModalState>(CLOSED_MODAL);
  // The task whose view-only detail panel is flown in from the right. Clicking a
  // tile selects it (highlighting its connectors); the panel's Edit button opens
  // the editable TaskInstanceModal. Stored by id + stage coordinates so the panel
  // reads live from config (edits reflect back after a save).
  const [selected, setSelected] = useState<SelectedTask | null>(null);
  // Id of the activity being created/edited in the "Add activity" modal, which
  // hosts the same form as Stages and Activities → New Activity. New activities
  // are written to the shared library, so they surface there automatically.
  const [activityModalId, setActivityModalId] = useState<number | null>(null);

  const selectedTask = useMemo(() => {
    if (!selected) return null;
    return (config.activitiesData[selected.stageKey] ?? []).find((t) => t.id === selected.id) ?? null;
  }, [selected, config.activitiesData]);

  // Resolver spanning every stage configuration, so the view panel can label a
  // condition's referenced task and locate the stage transition it gates on
  // (the task may live in this config, another LOB, or Submission).
  const taskInfoById = useMemo(() => {
    const m = new Map<number, { name: string; entity: string; stage: string }>();
    for (const sc of config.stageConfigs) {
      const entity = sc.recordType === 'Submission' ? 'Submission' : sc.recordType;
      sc.stages.forEach((stage, idx) => {
        for (const t of config.activitiesData[`${sc.id}:${idx}`] ?? []) {
          if (m.has(t.id)) continue;
          const name =
            t.nameOverride ||
            config.reusableActivities.find((a) => a.id === t.activityRefId)?.name ||
            `Task #${t.id}`;
          m.set(t.id, { name, entity, stage });
        }
      });
    }
    return m;
  }, [config.stageConfigs, config.activitiesData, config.reusableActivities]);

  const activityModalEntry = useMemo(
    () =>
      activityModalId != null
        ? config.reusableActivities.find((a) => a.id === activityModalId) ?? null
        : null,
    [activityModalId, config.reusableActivities],
  );

  const onAddActivity = () => {
    const newId = config.nextReusableActivityId;
    // Submission stage configs list only Global activities, so a new activity
    // created here must be Global to remain visible in the palette.
    const scope: ActivityScope = globalOnly ? 'Lines of Submission' : { lob };
    update((p) => ({
      ...p,
      reusableActivities: [
        ...p.reusableActivities,
        {
          id: newId,
          name: 'New Activity',
          description: '',
          action: 'Flow',
          actionDetails: { flowName: '' },
          scope,
        },
      ],
      nextReusableActivityId: p.nextReusableActivityId + 1,
    }));
    setActivityModalId(newId);
  };

  // Tasks that live outside the current stage configuration — in Submission or
  // in another LOB. A dependency on one of these has no on-canvas source tile,
  // so it surfaces in the task's "Depends on" tile instead of as a connector.
  // Each carries the coordinates needed to open its own edit modal.
  const externalTaskById = useMemo(() => {
    const nameFor = (t: ActivityInstance): string => {
      if (t.nameOverride) return t.nameOverride;
      const ref = t.activityRefId
        ? config.reusableActivities.find((a) => a.id === t.activityRefId)
        : null;
      return ref?.name || `Task #${t.id}`;
    };
    const m = new Map<number, ExternalTaskRef>();
    for (const sc of config.stageConfigs) {
      if (sc.id === cfg.id) continue;
      const entity = sc.recordType === 'Submission' ? 'Submission' : sc.recordType;
      sc.stages.forEach((stageName, idx) => {
        const stageKey = `${sc.id}:${idx}`;
        for (const t of config.activitiesData[stageKey] ?? []) {
          if (m.has(t.id)) continue;
          m.set(t.id, {
            id: t.id,
            name: nameFor(t),
            entity,
            stage: stageName,
            stageKey,
            stageIdx: idx,
            cfgId: sc.id,
            instance: t,
          });
        }
      });
    }
    return m;
  }, [config.stageConfigs, config.activitiesData, config.reusableActivities, cfg.id]);

  // Entity → Stage → Task universe a condition row can draw a dependency from:
  // the current entity (this config), other LOBs, and Submission. A condition
  // on an earlier stage's task gates this task's first run; a condition on a
  // later stage's task closes a loop (this task re-runs on that task's outcome).
  // The current stage is the default for a fresh condition.
  // The config the open modal operates on — the current one, or a foreign
  // config when editing a dependency reached from a "Depends on" tile.
  const modalCfg = modal.foreignCfg ?? cfg;

  const modalEntities = useMemo(() => {
    if (!modal.open) return [];
    return buildConditionEntities(config, modalCfg, modal.editing?.id);
  }, [modal.open, modal.editing?.id, config, modalCfg]);

  const defaultStageKey =
    modal.stageIdx >= 0 ? `current::${modalCfg.stages[modal.stageIdx]}` : undefined;

  // Dropping a palette activity opens the same modal as the "New Activity
  // Mapping" button — activity + stage both editable — but prefilled with the
  // dragged activity and the stage it was dropped onto.
  const onDropPaletteItem = (activityId: number, stageKey: string, stageIdx: number) => {
    const activity = config.reusableActivities.find((a) => a.id === activityId);
    if (!activity) return;
    setModal({ open: true, activity, editing: null, stageKey, stageIdx, selectable: true, foreignCfg: null });
  };

  // Floating "New task" button: opens the same modal but with the activity
  // selectable and the stage unselected (the user picks both inside the modal).
  const onNewTask = () => {
    setModal({ open: true, activity: null, editing: null, stageKey: '', stageIdx: -1, selectable: true, foreignCfg: null });
  };

  // The "+" on a palette item opens the same New Activity Mapping modal with
  // the activity prefilled; the stage is still chosen inside the modal.
  const onAddMapping = (activity: ReusableActivity) => {
    setModal({ open: true, activity, editing: null, stageKey: '', stageIdx: -1, selectable: true, foreignCfg: null });
  };

  const onEditTask = (stageKey: string, stageIdx: number, task: ActivityInstance) => {
    const activity = config.reusableActivities.find((a) => a.id === task.activityRefId) ?? null;
    setModal({ open: true, activity, editing: task, stageKey, stageIdx, selectable: true, foreignCfg: null });
  };

  // Open the edit modal for a task that lives in another stage configuration
  // (reached from a "Depends on" tile). Persistence + condition context are
  // built against that task's own config.
  const onEditExternalTask = (ref: ExternalTaskRef) => {
    const foreignCfg = config.stageConfigs.find((s) => s.id === ref.cfgId);
    if (!foreignCfg) return;
    const activity =
      config.reusableActivities.find((a) => a.id === ref.instance.activityRefId) ?? null;
    setModal({
      open: true,
      activity,
      editing: ref.instance,
      stageKey: ref.stageKey,
      stageIdx: ref.stageIdx,
      selectable: false,
      foreignCfg,
    });
  };

  const stageOptions = useMemo(() => {
    const src = modal.foreignCfg ?? cfg;
    return src.stages.map((name, idx) => ({ key: `${src.id}:${idx}`, idx, name }));
  }, [modal.foreignCfg, cfg]);

  const onRemoveTask = (stageKey: string, taskId: number) => {
    if (!confirm('Remove this task from the stage?')) return;
    update((p) => ({
      ...p,
      activitiesData: {
        ...p.activitiesData,
        [stageKey]: (p.activitiesData[stageKey] ?? []).filter((t) => t.id !== taskId),
      },
    }));
  };

  const onSaveTask = (next: ActivityInstance) => {
    const stageKey = modal.stageKey;
    update((p) => {
      const existing = p.activitiesData[stageKey] ?? [];
      const idx = existing.findIndex((t) => t.id === next.id);
      const updated =
        idx >= 0 ? existing.map((t, i) => (i === idx ? next : t)) : [...existing, next];
      return {
        ...p,
        activitiesData: { ...p.activitiesData, [stageKey]: updated },
      };
    });
    setModal(CLOSED_MODAL);
  };

  return (
    <div className="tp">
      <Palette
        activities={lobActivities}
        lob={lob}
        globalOnly={globalOnly}
        onAddActivity={onAddActivity}
        onEditActivity={setActivityModalId}
        onAddMapping={onAddMapping}
      />
      <Canvas
        bands={bands}
        allTasks={allTasks}
        reusableActivities={config.reusableActivities}
        externalTaskById={externalTaskById}
        activeStage={activeStage}
        onActiveStageChange={onActiveStageChange}
        selectedTaskId={selectedTask ? selected!.id : null}
        onSelectTask={(stageKey, stageIdx, task) =>
          setSelected({ id: task.id, stageKey, stageIdx })
        }
        onClearSelection={() => setSelected(null)}
        onEditExternalTask={onEditExternalTask}
        onRemoveTask={onRemoveTask}
        onDropPaletteItem={onDropPaletteItem}
        onNewTask={onNewTask}
      />

      {selectedTask && selected && (
        <TaskViewPanel
          task={selectedTask}
          activity={config.reusableActivities.find((a) => a.id === selectedTask.activityRefId)}
          stageName={cfg.stages[selected.stageIdx] ?? ''}
          taskInfoById={taskInfoById}
          onEdit={() => {
            onEditTask(selected.stageKey, selected.stageIdx, selectedTask);
            setSelected(null);
          }}
          onClose={() => setSelected(null)}
        />
      )}

      {activityModalEntry && (
        <Modal open onClose={() => setActivityModalId(null)} size="lg">
          <div className="tp-activity-modal">
            <ActivityEditor
              activity={activityModalEntry}
              onClose={() => setActivityModalId(null)}
              lob={lob}
              restrictScope
            />
          </div>
        </Modal>
      )}

      {modal.open && (
        <TaskInstanceModal
          open={modal.open}
          editing={modal.editing}
          activity={modal.activity}
          activitySelectable={modal.selectable}
          activityChoices={lobActivities}
          onActivityChange={(a) => setModal((m) => ({ ...m, activity: a }))}
          stages={stageOptions}
          stageEditable={modal.selectable}
          onStageChange={(key, idx) =>
            setModal((m) => ({ ...m, stageKey: key, stageIdx: idx }))
          }
          entities={modalEntities}
          defaultEntityId="current"
          defaultStageKey={defaultStageKey}
          stageKey={modal.stageKey}
          onSave={onSaveTask}
          onCancel={() => setModal(CLOSED_MODAL)}
          onDelete={
            modal.editing
              ? () => {
                  const id = modal.editing!.id;
                  const stageKey = modal.stageKey;
                  update((p) => ({
                    ...p,
                    activitiesData: {
                      ...p.activitiesData,
                      [stageKey]: (p.activitiesData[stageKey] ?? []).filter((t) => t.id !== id),
                    },
                  }));
                  setModal(CLOSED_MODAL);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

/* ─── Canvas ─────────────────────────────────────────────────────── */

interface CanvasProps {
  bands: Band[];
  allTasks: ActivityInstance[];
  reusableActivities: ReusableActivity[];
  externalTaskById: Map<number, ExternalTaskRef>;
  activeStage: string;
  onActiveStageChange: (stage: string) => void;
  /** Task whose detail panel is open; drives the connector highlight. */
  selectedTaskId: number | null;
  /** Clicking a tile selects it (opens the view panel + lights its lines). */
  onSelectTask: (stageKey: string, stageIdx: number, t: ActivityInstance) => void;
  /** Clicking empty canvas clears the selection. */
  onClearSelection: () => void;
  onEditExternalTask: (ref: ExternalTaskRef) => void;
  onRemoveTask: (stageKey: string, id: number) => void;
  onDropPaletteItem: (activityId: number, stageKey: string, stageIdx: number) => void;
  onNewTask: () => void;
}

interface RenderedEdge {
  d: string;
  from: { x: number; y: number };
  arrow: { x: number; y: number; up?: boolean };
  fromId: number;
  toId: number;
  kind: 'trigger' | 'loop';
}

function Canvas({
  bands,
  allTasks,
  reusableActivities,
  externalTaskById,
  activeStage,
  onActiveStageChange,
  selectedTaskId,
  onSelectTask,
  onClearSelection,
  onEditExternalTask,
  onRemoveTask,
  onDropPaletteItem,
  onNewTask,
}: CanvasProps) {
  const edges = useMemo(() => computeTaskEdges(allTasks), [allTasks]);
  // Loop-back edges, derived purely from trigger logic: a trigger condition
  // pointing at a downstream task closes a cycle. Rendered as amber feedback
  // arcs; never affect column layout.
  const loopEdges = useMemo(() => computeLoopEdges(allTasks), [allTasks]);
  const incomingByTask = useMemo(() => computeIncomingByTask(allTasks), [allTasks]);
  const externalDeps = useMemo(
    () => computeSubmissionDeps(allTasks, new Set(externalTaskById.keys())),
    [allTasks, externalTaskById],
  );

  const canvasRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const taskRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const bandRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  // Tracks the stage the canvas is currently scrolled to, so we can tell a
  // user scroll (update the path) apart from a path click (scroll the canvas).
  const spyStageRef = useRef(activeStage);
  // While a path click is animating the canvas, suppress the scroll-spy so the
  // bands it passes through don't hijack the selection mid-flight.
  const suppressSpyRef = useRef<number | null>(null);

  const [edgePaths, setEdgePaths] = useState<RenderedEdge[]>([]);
  const [svgSize, setSvgSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [dropBandIdx, setDropBandIdx] = useState<number | null>(null);
  // Scroll room below the last band so the max scroll position lands with the
  // penultimate stage's bottom edge (the last stage's top) at the canvas top —
  // i.e. the last stage fills the canvas from the top, no over-scroll past it.
  // Sized to `canvasHeight - lastBandHeight`; clamps to 0 when the last band is
  // taller than the canvas, so natural scrolling reveals all of its content.
  const [tailSpacer, setTailSpacer] = useState(0);

  // Recompute connector geometry whenever the layout or viewport changes.
  // Routing is orthogonal and vertical: exit the source's bottom edge, run to
  // a horizontal "merge lane" just above the target's top edge, then across to
  // the target's center. All edges into one task share a lane and meet at one
  // junction. Cross-stage edges use the same routing, so a stage-2 task's
  // connector simply runs down through the demarcation into stage 1.
  useLayoutEffect(() => {
    const recompute = () => {
      const cols = columnsRef.current;
      if (!cols) return;
      const cRect = cols.getBoundingClientRect();
      setSvgSize({ w: cols.scrollWidth, h: cols.scrollHeight });

      const nextEdges: RenderedEdge[] = [];

      // Forward trigger edges and loop-back edges share the tile's top/bottom
      // edges, so we split their attachment points: trigger lines anchor 25%
      // left of center, loop lines 25% right of center. This keeps a feedback
      // pair (A → B forward, B → A loop) from overlapping.
      for (const e of edges) {
        const fromEl = taskRefs.current.get(e.fromId);
        const toEl = taskRefs.current.get(e.toId);
        if (!fromEl || !toEl) continue;
        const fr = fromEl.getBoundingClientRect();
        const tr = toEl.getBoundingClientRect();
        const x1 = fr.left + fr.width / 2 - cRect.left - fr.width * 0.25;
        const y1 = fr.bottom - cRect.top;
        const targetTop = tr.top - cRect.top;
        const x2 = tr.left + tr.width / 2 - cRect.left - tr.width * 0.25;
        const arrowY = targetTop - 6;
        const laneY = targetTop - 20;
        // Clamp the corner radius to half the horizontal travel so a nearly-
        // vertical edge (target directly below its source) doesn't force the
        // merge-lane segment to double back on itself and kink. At dx → 0 the
        // arcs collapse and the path is a clean straight drop.
        const r = Math.min(6, Math.abs(x2 - x1) / 2);
        const goingRight = x2 >= x1;
        const c1x = goingRight ? x1 + r : x1 - r;
        const c2x = goingRight ? x2 - r : x2 + r;
        const sweep1 = goingRight ? 0 : 1;
        const sweep2 = goingRight ? 1 : 0;
        const d = [
          `M ${x1} ${y1}`,
          `L ${x1} ${laneY - r}`,
          `A ${r} ${r} 0 0 ${sweep1} ${c1x} ${laneY}`,
          `L ${c2x} ${laneY}`,
          `A ${r} ${r} 0 0 ${sweep2} ${x2} ${laneY + r}`,
          `L ${x2} ${arrowY}`,
        ].join(' ');
        nextEdges.push({
          d,
          from: { x: x1, y: y1 },
          arrow: { x: x2, y: arrowY },
          fromId: e.fromId,
          toId: e.toId,
          kind: 'trigger',
        });
      }

      // Loop edges run back from the later task (source) into the task that
      // re-runs (target). Routed orthogonally with the same rounded corners as
      // the trigger connectors, but mirrored: the source exits its top edge,
      // the run drops into a horizontal lane just below the target, then turns
      // up into the target's bottom edge (arrow points up). Both ends anchor
      // 25% right of center so the loop clears the trigger lines, which sit 25%
      // left of center.
      for (const e of loopEdges) {
        const fromEl = taskRefs.current.get(e.fromId);
        const toEl = taskRefs.current.get(e.toId);
        if (!fromEl || !toEl) continue;
        const fr = fromEl.getBoundingClientRect();
        const tr = toEl.getBoundingClientRect();
        const x1 = fr.left + fr.width / 2 - cRect.left + fr.width * 0.25;
        const y1 = fr.top - cRect.top;
        const targetBottom = tr.bottom - cRect.top;
        const x2 = tr.left + tr.width / 2 - cRect.left + tr.width * 0.25;
        const arrowY = targetBottom + 6;
        const laneY = targetBottom + 20;
        const r = Math.min(6, Math.abs(x2 - x1) / 2);
        const goingRight = x2 >= x1;
        const c1x = goingRight ? x1 + r : x1 - r;
        const c2x = goingRight ? x2 - r : x2 + r;
        // Sweep flags are inverted relative to the downward trigger routing
        // because this path travels upward.
        const sweep1 = goingRight ? 1 : 0;
        const sweep2 = goingRight ? 0 : 1;
        const d = [
          `M ${x1} ${y1}`,
          `L ${x1} ${laneY + r}`,
          `A ${r} ${r} 0 0 ${sweep1} ${c1x} ${laneY}`,
          `L ${c2x} ${laneY}`,
          `A ${r} ${r} 0 0 ${sweep2} ${x2} ${laneY - r}`,
          `L ${x2} ${arrowY}`,
        ].join(' ');
        nextEdges.push({
          d,
          from: { x: x1, y: y1 },
          arrow: { x: x2, y: arrowY, up: true },
          fromId: e.fromId,
          toId: e.toId,
          kind: 'loop',
        });
      }

      setEdgePaths(nextEdges);

      // Tail spacer = canvas height minus the last band's height, so the
      // furthest scroll seats the last stage at the top of the canvas.
      const canvas = canvasRef.current;
      const lastBand = bands.length ? bandRefs.current.get(bands[bands.length - 1].idx) : null;
      if (canvas && lastBand) {
        const room = canvas.clientHeight - lastBand.getBoundingClientRect().height;
        setTailSpacer(Math.max(0, Math.round(room)));
      } else {
        setTailSpacer(0);
      }
    };
    recompute();
    const canvas = canvasRef.current;
    canvas?.addEventListener('scroll', recompute, { passive: true });
    window.addEventListener('resize', recompute);
    return () => {
      canvas?.removeEventListener('scroll', recompute);
      window.removeEventListener('resize', recompute);
    };
  }, [edges, loopEdges, bands]);

  // Scroll-spy: as the user scrolls, report the band that owns the top of the
  // viewport so the stage path highlights it. Suppressed during the
  // programmatic scroll a path click triggers (spyStageRef already matches).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onScroll = () => {
      if (suppressSpyRef.current != null) return;
      const cTop = canvas.getBoundingClientRect().top;
      let best = bands[0]?.name ?? '';
      for (const b of bands) {
        const el = bandRefs.current.get(b.idx);
        if (!el) continue;
        if (el.getBoundingClientRect().top - cTop <= 56) best = b.name;
      }
      if (best && best !== spyStageRef.current) {
        spyStageRef.current = best;
        onActiveStageChange(best);
      }
    };
    canvas.addEventListener('scroll', onScroll, { passive: true });
    return () => canvas.removeEventListener('scroll', onScroll);
  }, [bands, onActiveStageChange]);

  // Click-to-scroll: when the active stage changes from outside (a path
  // click), bring that band to the top of the canvas.
  useLayoutEffect(() => {
    if (spyStageRef.current === activeStage) return;
    const idx = bands.find((b) => b.name === activeStage)?.idx;
    if (idx == null) return;
    const el = bandRefs.current.get(idx);
    const canvas = canvasRef.current;
    if (!el || !canvas) return;
    spyStageRef.current = activeStage;
    if (suppressSpyRef.current != null) window.clearTimeout(suppressSpyRef.current);
    suppressSpyRef.current = window.setTimeout(() => {
      suppressSpyRef.current = null;
    }, 500);
    canvas.scrollTop += el.getBoundingClientRect().top - canvas.getBoundingClientRect().top - 8;
  }, [activeStage, bands]);

  // When a task is selected, light every connector that touches it — both the
  // connectors flowing out of it and those flowing into it. The lit nodes are
  // the selected task plus whatever sits at the far end of each lit edge;
  // everything else dims.
  const highlight = useMemo(() => {
    if (selectedTaskId == null) return null;
    const litEdges = new Set<number>();
    const litNodes = new Set<number>([selectedTaskId]);
    edgePaths.forEach((p, i) => {
      if (p.fromId !== selectedTaskId && p.toId !== selectedTaskId) return;
      litEdges.add(i);
      litNodes.add(p.fromId);
      litNodes.add(p.toId);
    });
    return { edges: litEdges, nodes: litNodes };
  }, [selectedTaskId, edgePaths]);

  const onBandDragOver = (e: React.DragEvent, idx: number) => {
    if (e.dataTransfer.types.includes('application/x-activity-id')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      if (dropBandIdx !== idx) setDropBandIdx(idx);
    }
  };
  const onBandDrop = (e: React.DragEvent, band: Band) => {
    const id = e.dataTransfer.getData('application/x-activity-id');
    setDropBandIdx(null);
    if (!id) return;
    e.preventDefault();
    onDropPaletteItem(Number(id), band.key, band.idx);
  };

  const hasTasks = allTasks.length > 0;

  return (
    <div
      ref={canvasRef}
      className="tp-canvas"
      onClick={(e) => {
        // Any click on empty canvas space clears the selected task. Task tiles
        // select themselves (handled on the tile); reaching here off a non-tile
        // target means "empty".
        if (!(e.target as HTMLElement).closest('.tp-task')) {
          onClearSelection();
        }
      }}
    >
      <button
        type="button"
        className="tp-canvas__new-task"
        onClick={(e) => {
          e.stopPropagation();
          onNewTask();
        }}
        title="Add a new activity mapping"
      >
        <Icon name="plus" size={14} />
        New Activity Mapping
      </button>

      {!hasTasks && (
        <div className="tp-canvas__empty">
          Drag an activity from the palette onto a stage to add it as a task.
        </div>
      )}

      <div ref={columnsRef} className="tp-canvas__columns">
        {edgePaths.length > 0 && svgSize.w > 0 && svgSize.h > 0 && (
          <svg
            className="tp-canvas__edges"
            aria-hidden="true"
            width={svgSize.w}
            height={svgSize.h}
            viewBox={`0 0 ${svgSize.w} ${svgSize.h}`}
          >
            {edgePaths.map((p, i) => {
              const lit = highlight != null && highlight.edges.has(i);
              const dim = highlight != null && !lit;
              // Loop-back (call-back) edges render with the same style as
              // forward connectors — no separate amber/dashed treatment.
              const cls = [
                'tp-edge',
                lit ? 'tp-edge--focused' : '',
                dim ? 'tp-edge--dim' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <g key={i} className={cls}>
                  <path className="tp-edge__line" d={p.d} />
                  <polygon
                    className="tp-edge-arrow"
                    points={
                      p.arrow.up
                        ? `${p.arrow.x},${p.arrow.y - 5} ${p.arrow.x - 4},${p.arrow.y + 1} ${p.arrow.x + 4},${p.arrow.y + 1}`
                        : `${p.arrow.x},${p.arrow.y + 5} ${p.arrow.x - 4},${p.arrow.y - 1} ${p.arrow.x + 4},${p.arrow.y - 1}`
                    }
                  />
                </g>
              );
            })}
          </svg>
        )}
        {bands.map((band) => {
          const cols = bucketByColumns(band.tasks);
          const isActive = band.name === activeStage;
          return (
            <div
              key={band.idx}
              ref={(el) => {
                if (el) bandRefs.current.set(band.idx, el);
                else bandRefs.current.delete(band.idx);
              }}
              className={[
                'tp-band',
                isActive ? 'tp-band--active' : '',
                dropBandIdx === band.idx ? 'tp-band--drop' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onDragOver={(e) => onBandDragOver(e, band.idx)}
              onDragLeave={(e) => {
                if (e.currentTarget === e.target) setDropBandIdx(null);
              }}
              onDrop={(e) => onBandDrop(e, band)}
            >
              <div className="tp-band__header">
                <div className="tp-band__heading">
                  <div className="tp-band__title-row">
                    <span className="tp-band__index">{band.idx + 1}</span>
                    <span className="tp-band__name">{band.name}</span>
                  </div>
                  <span className="tp-band__count">
                    {band.tasks.length} {band.tasks.length === 1 ? 'task' : 'tasks'}
                  </span>
                </div>
              </div>
              {band.tasks.length === 0 ? (
                <div className="tp-band__empty">
                  Drag an activity here to add it to "{band.name}".
                </div>
              ) : (
                <div className="tp-band__levels">
                  {cols.map((col, ci) => (
                    <div
                      key={ci}
                      className="tp-canvas__col"
                      data-stagger={ci % 2 === 1 ? 'true' : 'false'}
                    >
                      {col.map((t) => {
                        const dim = highlight != null && !highlight.nodes.has(t.id);
                        return (
                          <TaskCard
                            key={t.id}
                            task={t}
                            activity={reusableActivities.find((a) => a.id === t.activityRefId)}
                            dim={dim}
                            selected={selectedTaskId === t.id}
                            onSelect={() => onSelectTask(band.key, band.idx, t)}
                            onRemove={() => onRemoveTask(band.key, t.id)}
                            refCallback={(el) => {
                              if (el) taskRefs.current.set(t.id, el);
                              else taskRefs.current.delete(t.id);
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {tailSpacer > 0 && (
          <div className="tp-band__tail" style={{ height: tailSpacer }} aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

interface TaskCardProps {
  task: ActivityInstance;
  activity: ReusableActivity | undefined;
  dim?: boolean;
  selected?: boolean;
  onSelect: () => void;
  onRemove: () => void;
  refCallback: (el: HTMLDivElement | null) => void;
}

function TaskCard({
  task,
  activity,
  dim,
  selected,
  onSelect,
  onRemove,
  refCallback,
}: TaskCardProps) {
  const isManual = task.trigger === 'Manual';
  const isConditional = task.availability === 'Conditional';
  const description =
    task.description || activity?.description || '';
  return (
    <div
      ref={refCallback}
      className={[
        'tp-task',
        isConditional ? 'tp-task--conditional' : 'tp-task--stage-change',
        dim ? 'tp-task--dim' : '',
        selected ? 'tp-task--selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="tp-task__head">
        <span className="tp-task__name">
          {task.nameOverride || activity?.name || `Task #${task.id}`}
        </span>
        {isManual && <span className="tp-task__manual-badge">Manual</span>}
        <button
          type="button"
          className="tp-task__remove"
          aria-label="Remove task"
          title="Remove task"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Icon name="close" size={12} />
        </button>
      </div>
      {description && <div className="tp-task__desc">{description}</div>}
    </div>
  );
}

/* ─── Task view panel ────────────────────────────────────────────── */

interface TaskViewPanelProps {
  task: ActivityInstance;
  activity: ReusableActivity | undefined;
  stageName: string;
  /** Resolves a referenced task's id to its name + owning entity/stage, so a
   * condition can be shown as a "Stage Transition › Rule" pair. */
  taskInfoById: Map<number, { name: string; entity: string; stage: string }>;
  onEdit: () => void;
  onClose: () => void;
}

/** Read-only detail panel that flies in from the right when a task tile is
 * selected on the canvas. Mirrors the fields of TaskInstanceModal without any
 * inputs; the Edit button hands off to that modal. */
function TaskViewPanel({
  task,
  activity,
  stageName,
  taskInfoById,
  onEdit,
  onClose,
}: TaskViewPanelProps) {
  const spec = processSpecFor(activity?.action);
  const Glyph = spec.icon;
  const name = task.nameOverride || activity?.name || `Task #${task.id}`;
  const description = task.description || activity?.description || '';
  const availConds = (task.availabilityRules ?? []) as (AvailabilityRule & Partial<TriggerCondition>)[];
  const trigConds = task.triggerRules?.conditions ?? [];
  const alert = task.alert;

  // Render a condition as a single "Rule" string (the task-outcome comparison).
  const condRule = (c: AvailabilityRule & Partial<TriggerCondition>): string => {
    if (c.activityId != null) {
      const info = taskInfoById.get(Number(c.activityId));
      return `${info?.name ?? `Task #${c.activityId}`} · ${c.response ?? 'Outcome'} ${
        c.operator ?? ''
      } ${c.value ?? ''}`.trim();
    }
    return `${c.field ?? ''} ${c.operator ?? ''} ${c.value ?? ''}`.trim();
  };

  return (
    <aside className="tp-view" role="dialog" aria-label={`Task details: ${name}`}>
      <div className="tp-view__header">
        <div className="tp-view__title-wrap">
          <span
            className="tp-view__chip"
            style={{ background: spec.chipBg, color: spec.chipFg }}
          >
            <span className="tp-view__chip-icon" aria-hidden="true">
              <Glyph />
            </span>
            {spec.label}
          </span>
          <span className="tp-view__title">{name}</span>
        </div>
        <div className="tp-view__header-actions">
          <Button
            variant="brand"
            iconLeading={<Icon name="edit" size={14} />}
            onClick={onEdit}
          >
            Edit
          </Button>
          <button
            type="button"
            className="tp-view__close"
            aria-label="Close"
            title="Close"
            onClick={onClose}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>

      <div className="tp-view__body">
        {activity && (
          <ViewField label="Activity">
            <span className="tp-view__value">{activity.name}</span>
            {activity.description && (
              <span className="tp-view__value-sub">{activity.description}</span>
            )}
          </ViewField>
        )}

        <ViewField label="Stage">
          <span className="tp-view__value">{stageName || '—'}</span>
        </ViewField>

        <ViewField label="Display Name">
          <span className="tp-view__value">{name}</span>
        </ViewField>

        {description && (
          <ViewField label="Description">
            <span className="tp-view__value">{description}</span>
          </ViewField>
        )}

        <div className="tp-view__divider" />

        <ViewField label="Availability">
          <span className="tp-view__value">
            {task.availability === 'Conditional' ? 'Conditional' : 'On Stage Entry'}
          </span>
          {task.availability === 'Conditional' &&
            (availConds.length === 0 ? (
              <span className="tp-view__value-sub">No conditions set.</span>
            ) : (
              <div className="tp-view__cond-table" role="table">
                <div className="tp-view__cond-head" role="row">
                  <span role="columnheader">Rules</span>
                </div>
                {availConds.map((c, i) => (
                  <div key={i} className="tp-view__cond-row" role="row">
                    <span role="cell">{condRule(c)}</span>
                  </div>
                ))}
              </div>
            ))}
        </ViewField>

        <ViewField label="Trigger">
          <span className="tp-view__value">
            {task.trigger === 'Conditional'
              ? 'Conditional'
              : task.trigger === 'Manual'
                ? 'Manual'
                : 'On Stage Entry'}
          </span>
          {task.trigger === 'Conditional' &&
            (trigConds.length === 0 ? (
              <span className="tp-view__value-sub">No conditions set.</span>
            ) : (
              <div className="tp-view__cond-table" role="table">
                <div className="tp-view__cond-head" role="row">
                  <span role="columnheader">Rules</span>
                </div>
                {trigConds.map((c, i) => (
                  <div key={i} className="tp-view__cond-row" role="row">
                    <span role="cell">{condRule(c)}</span>
                  </div>
                ))}
              </div>
            ))}
          {task.trigger === 'Manual' && task.buttonName && (
            <span className="tp-view__value-sub">Button: {task.buttonName}</span>
          )}
        </ViewField>

        <ViewField label="Mandatory">
          <span className="tp-view__value">{task.mandatory ? 'Yes' : 'No'}</span>
        </ViewField>

        {alert?.enabled && (
          <>
            <div className="tp-view__divider" />
            <ViewField label="Alert">
              <span className="tp-view__value">Shows alerts at runtime</span>
              {alert.conditions.length > 0 && (
                <ul className="tp-view__conds">
                  {alert.conditions.map((c, i) => (
                    <li key={i} className="tp-view__cond">
                      {`${c.response} ${c.operator} ${c.value}`.trim()}
                    </li>
                  ))}
                </ul>
              )}
              {alert.showInRequiresAttention && (
                <span className="tp-view__value-sub">In "Requires Attention"</span>
              )}
              {alert.notifyUser && <span className="tp-view__value-sub">Notifies user</span>}
            </ViewField>
          </>
        )}
      </div>
    </aside>
  );
}

function ViewField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="tp-view__field">
      <span className="tp-view__label">{label}</span>
      {children}
    </div>
  );
}

/* ─── Palette ────────────────────────────────────────────────────── */

interface PaletteProps {
  activities: ReusableActivity[];
  lob: string;
  /** Submission-scoped canvases list only Global activities: no scope filters
   * and the palette is titled "Global Activities". */
  globalOnly: boolean;
  onAddActivity: () => void;
  onEditActivity: (id: number) => void;
  /** Opens the New Activity Mapping modal prefilled with this activity. */
  onAddMapping: (activity: ReusableActivity) => void;
}

function Palette({ activities, lob, globalOnly, onAddActivity, onEditActivity, onAddMapping }: PaletteProps) {
  const [query, setQuery] = useState('');
  // Scope filter toggles. Both on by default; the palette shows the union of
  // whatever's checked. LOB config canvases only ever mix Global + this LOB.
  const [showGlobal, setShowGlobal] = useState(true);
  const [showLob, setShowLob] = useState(true);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activities.filter((a) => {
      if (!globalOnly) {
        const isGlobal = a.scope === 'Lines of Submission';
        if (isGlobal ? !showGlobal : !showLob) return false;
      }
      if (q && !a.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [activities, query, showGlobal, showLob, globalOnly]);

  return (
    <div className="tp-palette" aria-label="Activities palette">
      <div className="tp-palette__head">
        <span className="tp-palette__title">
          {globalOnly ? 'Global Activities' : 'Activities'}
        </span>
        <span className="tp-palette__sub">
          {filtered.length}
          {filtered.length !== activities.length ? ` of ${activities.length}` : ''}
          {globalOnly ? '' : ` · ${lob}`}
        </span>
        <button
          type="button"
          className="tp-palette__new"
          onClick={onAddActivity}
          aria-label="New activity"
          title="New activity"
        >
          <Icon name="plus" size={14} />
          New
        </button>
      </div>

      <div className="tp-palette__body">
        <div className="tp-palette__search">
          <Input
            placeholder="Search by name"
            iconLeading={<Icon name="search" size={12} />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            fullWidth
            aria-label="Search activities"
          />
        </div>
        {!globalOnly && (
          <div className="tp-palette__filters">
            <Checkbox
              label="Global"
              checked={showGlobal}
              onChange={(e) => setShowGlobal(e.target.checked)}
            />
            <Checkbox
              label={lob}
              checked={showLob}
              onChange={(e) => setShowLob(e.target.checked)}
            />
          </div>
        )}
        {activities.length > 0 && filtered.length > 0 && (
          <p className="tp-palette__hint">
            Drag an activity onto a stage, or click <Icon name="plus" size={11} /> to add it.
          </p>
        )}
        <div className="tp-palette__list">
          {activities.length === 0 ? (
            <div className="tp-palette__empty">
              {globalOnly
                ? 'No global activities defined yet. Add some in the Activities tab first.'
                : `No activities defined for ${lob}. Add some in the Activities tab first.`}
            </div>
          ) : filtered.length === 0 ? (
            <div className="tp-palette__empty">No activities match your filters.</div>
          ) : (
            filtered.map((a) => (
              <PaletteItem
                key={a.id}
                activity={a}
                onEdit={() => onEditActivity(a.id)}
                onAddMapping={() => onAddMapping(a)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface PaletteItemProps {
  activity: ReusableActivity;
  onEdit: () => void;
  onAddMapping: () => void;
}

function PaletteItem({ activity, onEdit, onAddMapping }: PaletteItemProps) {
  return (
    <div
      className="tp-palette__item"
      draggable
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit();
        }
      }}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('application/x-activity-id', String(activity.id));
        e.dataTransfer.setData('text/plain', activity.name);
      }}
      title={activity.name}
    >
      <div className="tp-palette__row">
        <div className="tp-palette__text">
          <span className="tp-palette__name">{activity.name}</span>
          <span className="tp-palette__scope">{scopeSubline(activity.scope)}</span>
        </div>
        <button
          type="button"
          className="tp-palette__add"
          aria-label={`Add ${activity.name} to a stage`}
          title="Add to a stage"
          onClick={(e) => {
            e.stopPropagation();
            onAddMapping();
          }}
        >
          <Icon name="plus" size={13} />
        </button>
      </div>
    </div>
  );
}

/** One-line scope descriptor for a palette item: "Global" for
 * cross-LOB activities, else the LOB the activity is scoped to. */
function scopeSubline(scope: ReusableActivity['scope']): string {
  if (scope === 'Lines of Submission') return 'Global';
  if (scope && typeof scope === 'object' && 'lob' in scope) return scope.lob;
  if (scope === 'Parent Submission') return 'Submission';
  return 'Global';
}
