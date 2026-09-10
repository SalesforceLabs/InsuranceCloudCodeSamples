import {
  DEFAULT_CONFIG,
  type ActivityInstance,
  type SetupConfig,
  type TriggerCondition,
} from '@/types/config';

const ENDPOINT = '/api/setup/config';

/**
 * Loops used to live in a separate `reentryRules` rule set. They're now derived
 * purely from trigger logic — a trigger condition that points at a downstream
 * task is auto-detected as a loop-back. Fold any legacy `reentryRules` a task
 * carries into its `triggerRules` so nothing is lost, then drop `reentryRules`.
 * Idempotent: tasks with no `reentryRules` pass through untouched.
 */
function migrateReentry(task: ActivityInstance): ActivityInstance {
  const reentry = task.reentryRules;
  if (!reentry || !Array.isArray(reentry.conditions) || reentry.conditions.length === 0) {
    if (reentry == null) return task;
    return { ...task, reentryRules: null };
  }
  const existing = task.triggerRules?.conditions ?? [];
  const seen = new Set(existing.map((c) => Number(c.activityId)));
  const merged: TriggerCondition[] = [...existing];
  for (const c of reentry.conditions) {
    const id = Number(c.activityId);
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(c);
  }
  return {
    ...task,
    trigger: 'Conditional',
    triggerRules: {
      stageKey: task.triggerRules?.stageKey ?? reentry.stageKey ?? '',
      conditions: merged,
      expression: task.triggerRules?.expression ?? '',
    },
    reentryRules: null,
  };
}

function migrateActivitiesData(
  data: Record<string, ActivityInstance[]> | undefined,
): Record<string, ActivityInstance[]> {
  if (!data) return {};
  const out: Record<string, ActivityInstance[]> = {};
  for (const [key, tasks] of Object.entries(data)) {
    out[key] = Array.isArray(tasks) ? tasks.map(migrateReentry) : tasks;
  }
  return out;
}

// In dev, the Vite middleware serves the live config from disk at ENDPOINT.
// A static build (GitHub Pages) has no such endpoint — the build step copies
// data/setup/config.json into the output dir, so read it from there instead,
// resolved against the deploy base path. Saves are no-ops on the static host.
const SOURCE = import.meta.env.PROD ? `${import.meta.env.BASE_URL}config.json` : ENDPOINT;

export async function loadConfig(): Promise<SetupConfig> {
  try {
    const res = await fetch(SOURCE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Partial<SetupConfig>;
    const merged = { ...DEFAULT_CONFIG, ...data } as SetupConfig;
    return {
      ...merged,
      activitiesData: migrateActivitiesData(merged.activitiesData),
      stmActivitiesData: migrateActivitiesData(merged.stmActivitiesData),
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingConfig: SetupConfig | null = null;

export async function saveConfig(config: SetupConfig): Promise<void> {
  pendingConfig = config;
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    const toSave = pendingConfig;
    saveTimer = null;
    pendingConfig = null;
    if (!toSave) return;
    try {
      await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSave),
      });
    } catch (err) {
      console.error('Failed to save config', err);
    }
  }, 200);
}
