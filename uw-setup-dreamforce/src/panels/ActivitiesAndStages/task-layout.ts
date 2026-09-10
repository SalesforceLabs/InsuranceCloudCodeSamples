import type { ActivityInstance } from '@/types/config';

/**
 * Determine which set of conditions drives a task's "depends on" links.
 * Per spec:
 *  - Manual tasks                   → look at availabilityRules
 *  - On Stage Entry / Conditional  → look at triggerRules
 *
 * `availabilityRules` is typed as `AvailabilityRule[]` in the schema, but
 * Manual-task availability conditions store the same `{ activityId, ... }`
 * shape as triggerRules — we cast through `unknown` to read them uniformly.
 */
function dependencyConditions(task: ActivityInstance): { activityId?: number | string }[] {
  const isManual = task.trigger === 'Manual';
  const rules = isManual
    ? (task.availabilityRules as unknown as { activityId?: number | string }[] | null)
    : task.triggerRules?.conditions;
  if (!rules || !Array.isArray(rules)) return [];
  return rules;
}

/**
 * For each task, return the ids of other tasks it depends on.
 * Filters out self-references and unknown ids defensively.
 */
function dependencyIds(task: ActivityInstance, knownIds: Set<number>): number[] {
  return dependencyConditions(task)
    .map((c) => Number(c.activityId))
    .filter((id) => Number.isFinite(id) && id !== task.id && knownIds.has(id));
}

/**
 * Classify every dependency edge in the trigger graph as either a *forward*
 * edge (points to a task that runs earlier — gates this task's initial run and
 * drives column layout) or a *loop-back* edge (points to a downstream task —
 * closes a cycle, so this task re-runs on that task's outcome).
 *
 * Uses a depth-first search with grey/black coloring over the driving-rule
 * graph. An edge into a node currently on the recursion stack ("grey") is a
 * back edge → loop. Every other dependency edge is forward. DFS roots are
 * visited in ascending id order so the classification is deterministic and
 * independent of task insertion order.
 *
 * `forwardDeps` maps a task id → the ids it depends on via forward edges only;
 * `loopEdges` lists back edges as `{ fromId (downstream), toId (re-runner) }`.
 */
function classifyEdges(tasks: ActivityInstance[]): {
  forwardDeps: Map<number, number[]>;
  loopEdges: TaskEdge[];
} {
  const knownIds = new Set(tasks.map((t) => t.id));
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const forwardDeps = new Map<number, number[]>();
  const loopEdges: TaskEdge[] = [];

  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const color = new Map<number, number>();

  const visit = (taskId: number) => {
    color.set(taskId, GREY);
    const t = byId.get(taskId);
    const deps = t ? dependencyIds(t, knownIds) : [];
    const forward: number[] = [];
    for (const dep of deps) {
      const c = color.get(dep) ?? WHITE;
      if (c === GREY) {
        // `dep` is an ancestor still being resolved → this closes a cycle.
        // Record the back edge: `dep` (the later task) loops back into `taskId`.
        loopEdges.push({ fromId: dep, toId: taskId });
        continue;
      }
      forward.push(dep);
      if (c === WHITE) visit(dep);
    }
    if (forward.length > 0) forwardDeps.set(taskId, forward);
    color.set(taskId, BLACK);
  };

  for (const t of [...tasks].sort((a, b) => a.id - b.id)) {
    if ((color.get(t.id) ?? WHITE) === WHITE) visit(t.id);
  }
  return { forwardDeps, loopEdges };
}

/**
 * Compute a 1-based column index per task using `max(forwardDeps) + 1`. A task
 * with no forward dependencies — or whose Trigger is "On Stage Entry", or
 * whose Availability is "On Stage Entry" for a Manual task — lands in column 1.
 * Loop-back (downstream) references never contribute to column placement.
 */
export function computeTaskColumns(tasks: ActivityInstance[]): Map<number, number> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const { forwardDeps } = classifyEdges(tasks);
  const memo = new Map<number, number>();

  const columnOf = (taskId: number): number => {
    if (memo.has(taskId)) return memo.get(taskId)!;
    const t = byId.get(taskId);
    if (!t) return 1;

    const isManual = t.trigger === 'Manual';
    const usingConditional = isManual
      ? t.availability === 'Conditional'
      : t.trigger === 'Conditional';

    const deps = usingConditional ? forwardDeps.get(taskId) ?? [] : [];
    if (deps.length === 0) {
      memo.set(taskId, 1);
      return 1;
    }
    // forwardDeps is acyclic by construction, so this recursion terminates.
    const col = Math.max(...deps.map(columnOf)) + 1;
    memo.set(taskId, col);
    return col;
  };

  for (const t of tasks) columnOf(t.id);
  return memo;
}

/**
 * Bucket tasks into ordered columns based on the result of computeTaskColumns.
 * Returns columns indexed from 0; column 0 is the "first" column (col=1).
 */
export function bucketByColumns(tasks: ActivityInstance[]): ActivityInstance[][] {
  const cols = computeTaskColumns(tasks);
  const max = tasks.reduce((m, t) => Math.max(m, cols.get(t.id) ?? 1), 1);
  const out: ActivityInstance[][] = Array.from({ length: max }, () => []);
  for (const t of tasks) {
    const c = cols.get(t.id) ?? 1;
    out[c - 1].push(t);
  }
  return out;
}

/**
 * Edges for the canvas connectors: every dependency referenced in the task's
 * driving rule set becomes an edge. Self-references and unknown ids are
 * filtered out.
 */
export interface TaskEdge {
  fromId: number;
  toId: number;
}

export function computeTaskEdges(tasks: ActivityInstance[]): TaskEdge[] {
  const { forwardDeps } = classifyEdges(tasks);
  const edges: TaskEdge[] = [];
  for (const [toId, deps] of forwardDeps) {
    for (const fromId of deps) edges.push({ fromId, toId });
  }
  return edges;
}

/**
 * Loop-back edges, derived purely from trigger logic: a trigger condition that
 * references a *downstream* task (one that runs later) closes a cycle, so the
 * referencing task re-runs on that task's outcome. Detected as DFS back edges
 * in `classifyEdges`, they never affect column placement — the canvas renders
 * them as distinct amber feedback arcs. `fromId` is the downstream trigger
 * source, `toId` is the task that loops back (re-runs). De-duplicated so a
 * task with two conditions on the same downstream task yields one arc.
 */
export function computeLoopEdges(tasks: ActivityInstance[]): TaskEdge[] {
  const { loopEdges } = classifyEdges(tasks);
  const seen = new Set<string>();
  const out: TaskEdge[] = [];
  for (const e of loopEdges) {
    const key = `${e.fromId}:${e.toId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

/**
 * Map each task id to the list of task ids it directly depends on via forward
 * (gating) edges only. Used by the canvas to render per-target dependency-count
 * badges and to compute the "fade unrelated" highlight when a badge is clicked.
 * Loop-back references are excluded — they carry their own amber junction.
 */
export function computeIncomingByTask(
  tasks: ActivityInstance[],
): Map<number, number[]> {
  return classifyEdges(tasks).forwardDeps;
}

/**
 * Cross-configuration dependencies: for each task, the ids it depends on that
 * live *outside* this config's own task set — i.e. parent-Submission tasks
 * referenced through the condition builder's "Submission" scope. These never
 * appear as on-canvas connectors (their source tile isn't here), so the canvas
 * surfaces them as a per-task "connection bubble" instead.
 */
export function computeSubmissionDeps(
  tasks: ActivityInstance[],
  submissionIds: Set<number>,
): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (const t of tasks) {
    const deps = dependencyConditions(t)
      .map((c) => Number(c.activityId))
      .filter((id) => Number.isFinite(id) && id !== t.id && submissionIds.has(id));
    if (deps.length > 0) out.set(t.id, Array.from(new Set(deps)));
  }
  return out;
}
