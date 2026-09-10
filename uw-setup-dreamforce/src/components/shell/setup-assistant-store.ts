/**
 * Tiny pub-sub for the global Setup Assistant slide-in panel. Mounts once
 * in the Layout so any button can open it without prop-drilling.
 *
 * The assistant supports two modes:
 *   • Default — opened from the app-header agent_astro button. Plays the
 *     long, scripted activity-setup conversation that lives in the panel.
 *   • Contextual — opened with an `AssistantContext`. Replaces the panel's
 *     header title + initial conversation with a section-specific intro.
 *     Used by the per-subcategory "Ask" button on the hub and by the
 *     empty-state "Show step-by-step process" CTA.
 */

export interface AssistantOption {
  label: string;
  value: string;
}

export interface AssistantRecordCard {
  /** Optional emoji-style icon shown next to the title (legacy field). */
  icon?: string;
  title: string;
  fields: { label: string; value: string }[];
}

export interface AssistantMessage {
  role: 'agent' | 'user';
  text: string;
  /** Delay (ms) before this message lands. Defaults to 700ms for agent
   *  turns and 400ms for user turns when omitted. */
  delay?: number;
  options?: AssistantOption[];
  record?: AssistantRecordCard;
}

export interface AssistantContext {
  /** Stable id — used to dedupe back-to-back open calls for the same
   *  subject and to drive the panel's reset effect. */
  id: string;
  /** Optional title override for the panel header (e.g. "Email-to-Submission"). */
  title?: string;
  /** Optional subtitle override for the panel header. */
  subtitle?: string;
  /** Initial scripted messages to seed the conversation with. */
  script: AssistantMessage[];
}

interface AssistantState {
  open: boolean;
  context: AssistantContext | null;
}

type Listener = (state: AssistantState) => void;

let state: AssistantState = { open: false, context: null };
const listeners = new Set<Listener>();

function emit() {
  for (const fn of listeners) fn(state);
}

export function getSetupAssistantState(): AssistantState {
  return state;
}

export function subscribeSetupAssistant(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Open the panel. Pass an `AssistantContext` to play a section-specific
 * intro instead of the default scripted conversation. Calling without args
 * resets to the default conversation.
 */
export function openSetupAssistant(context: AssistantContext | null = null) {
  state = { open: true, context };
  emit();
}

export function closeSetupAssistant() {
  if (!state.open) return;
  state = { ...state, open: false };
  emit();
}

export function toggleSetupAssistant() {
  state = { ...state, open: !state.open };
  emit();
}
