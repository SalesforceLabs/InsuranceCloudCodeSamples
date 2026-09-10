import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui';
import {
  closeSetupAssistant,
  getSetupAssistantState,
  subscribeSetupAssistant,
  type AssistantContext,
  type AssistantMessage,
} from './setup-assistant-store';
import './SetupAssistantPanel.css';

/**
 * Setup Assistant — slide-in panel ported from the legacy Setup's
 * agent-chat. Drives a scripted, multi-turn conversation with option
 * chips, Salesforce-record cards, and a natural-language → formula
 * "condition" card. Visuals are rebuilt against SLDS 2 tokens.
 */

interface OptionDef {
  label: string;
  value: string;
}

interface RecordField {
  label: string;
  value: string;
}

interface RecordCard {
  icon?: string;
  title: string;
  fields: RecordField[];
}

interface ConditionMapping {
  from: string;
  to: string;
}

interface ConditionCard {
  naturalLanguage: string;
  formula: string;
  mappings: ConditionMapping[];
}

interface ScriptMessage extends AssistantMessage {
  conditionCard?: ConditionCard;
}

interface RenderedMessage extends ScriptMessage {
  id: number;
  /** True after the user picks an option — disables the chips. */
  optionsLocked?: boolean;
  /** Which option label the user chose. */
  selectedOption?: string;
}

const SCRIPT: ScriptMessage[] = [
  {
    role: 'agent',
    delay: 600,
    text: `Hello! I'm your Underwriting Setup Assistant. I can help you configure various aspects of your underwriting system.\n\nWhat would you like to set up today?`,
    options: [
      { label: 'Set Up Activities', value: 'activities' },
      { label: 'Set Up Email Ingestion', value: 'email' },
      { label: 'Set Up Integrations', value: 'integrations' },
      { label: 'Set Up Document Ingestion', value: 'documents' },
    ],
  },
  { role: 'user', text: 'Set Up Activities' },
  {
    role: 'agent',
    delay: 800,
    text: `Great choice! Activity Management is the foundation of your underwriting workflow.\n\nWhat type of underwriting activities would you like to configure?`,
    options: [
      { label: 'Commercial Property', value: 'commercial' },
      { label: 'Auto Insurance', value: 'auto' },
      { label: 'Workers Compensation', value: 'workers-comp' },
      { label: 'Custom Configuration', value: 'custom' },
    ],
  },
  { role: 'user', text: 'Commercial Property' },
  {
    role: 'agent',
    delay: 1000,
    text: `Perfect! I'll help you set up a complete Activity Management system for Commercial Property underwriting.\n\nLet me analyze your requirements and create a comprehensive plan...`,
  },
  {
    role: 'agent',
    delay: 1500,
    text: `I've created a plan for your Commercial Property underwriting workflow.\n\n**Configuration Overview:**\n\n**5 Stages:**\n1. Submission Review\n2. Property Inspection\n3. Risk Assessment\n4. Underwriting Decision\n5. Quote Generation\n\n**11 Activities Required:**\n- Loss History Review (Integration Procedure)\n- Property Valuation Check (Integration Procedure)\n- Compliance Document Verification (Flow)\n- Occupancy Classification (Omniscript)\n- Hazard Analysis (Flow)\n- D&B Credit Check (Integration Procedure)\n- Risk Score Calculation (Integration Procedure)\n- Underwriter Review (Omniscript)\n- Approval Workflow (Flow)\n- Quote Generation (Integration Procedure)\n- Broker Notification (Flow)\n\n**Approach:**\nI'll guide you through configuring each stage one at a time, creating the necessary Salesforce processes (Flows, Integration Procedures) and Activities as we go.\n\nShall we proceed with this plan?`,
    options: [
      { label: "Yes, let's start", value: 'yes' },
      { label: 'Modify the plan', value: 'modify' },
      { label: 'Show more details', value: 'details' },
    ],
  },
  { role: 'user', text: "Yes, let's start" },
  {
    role: 'agent',
    delay: 800,
    text: `Perfect! Let's begin with **Stage 1: Submission Review**\n\nThis stage handles initial document collection and validation when a submission first arrives.\n\n**Activities needed for this stage:**\n1. Loss History Review — Retrieves 5-year loss history\n2. Property Valuation Check — Validates property value\n3. Compliance Document Verification — Checks required documents\n\nLet's start by creating the first activity: **Loss History Review**\n\nThis activity needs an Integration Procedure to call an external service (like ISO or Verisk) to retrieve loss history data.\n\nShould I help you create the Integration Procedure first?`,
    options: [
      { label: 'Yes, create the Integration Procedure', value: 'yes' },
      { label: 'I already have one', value: 'have' },
      { label: 'Skip this activity', value: 'skip' },
    ],
  },
  { role: 'user', text: 'Yes, create the Integration Procedure' },
  {
    role: 'agent',
    delay: 800,
    text: `Great! I'll create an Integration Procedure for retrieving loss history.\n\n**Creating Integration Procedure...**\n\n**Thinking through the design:**\n- Input: Property Address, Policy Holder Name, Date Range\n- External Service: ISO ClaimSearch API\n- Output: List of claims with dates, amounts, and types\n- Error Handling: Return empty list if service unavailable`,
  },
  {
    role: 'agent',
    delay: 1500,
    text: `I'm configuring the Integration Procedure with the following elements:\n\n**Step 1:** Set Values — Prepare request parameters\n**Step 2:** HTTP Action — Call ISO ClaimSearch API\n**Step 3:** Transform Data — Parse JSON response\n**Step 4:** Set Values — Map to Salesforce fields\n**Step 5:** Response Action — Return structured data`,
  },
  {
    role: 'agent',
    delay: 1500,
    text: `Integration Procedure created successfully:`,
    record: {
      icon: '⚡',
      title: 'CProp_LossHistory_IP',
      fields: [
        { label: 'Name', value: 'CProp_LossHistory_IP' },
        { label: 'Type', value: 'Integration Procedure' },
        { label: 'Sub Type', value: 'REST' },
        { label: 'Language', value: 'English' },
        { label: 'Is Active', value: 'Yes' },
        { label: 'Created Date', value: '5/19/2026, 11:45 AM' },
      ],
    },
  },
  {
    role: 'agent',
    delay: 800,
    text: `Now that we have the Integration Procedure, let's create the **Loss History Review** activity in your Activities library.\n\nThis activity will reference the Integration Procedure we just created.\n\n**Activity Configuration:**\n- Name: Loss History Review\n- Description: Retrieves and analyzes 5-year loss history for the property\n- Process Type: Integration Procedure\n- Process: CProp_LossHistory_IP\n\nCreating activity...`,
  },
  {
    role: 'agent',
    delay: 1200,
    text: `Activity created successfully:`,
    record: {
      icon: '📋',
      title: 'Loss History Review',
      fields: [
        { label: 'Activity Name', value: 'Loss History Review' },
        { label: 'Type', value: 'Integration Procedure' },
        { label: 'Process Name', value: 'CProp_LossHistory_IP' },
        {
          label: 'Description',
          value: 'Retrieves and analyzes 5-year loss history for the property',
        },
        { label: 'Created Date', value: '5/19/2026, 11:46 AM' },
      ],
    },
  },
  {
    role: 'agent',
    delay: 800,
    text: `Excellent! Now let's configure how this activity will be used in **Stage 1: Submission Review**\n\n**Configuration Options:**\n\n**Availability:** When should this activity be available?\n- On Stage Change (automatic when entering stage)\n- Manual (underwriter decides when to run)\n- Conditional (based on submission data)\n\n**Trigger:** When should it execute?\n- Automatic (runs immediately when available)\n- Manual (underwriter clicks to execute)\n- Conditional (based on rules)\n\n**Mandatory:** Should this activity be required before moving to the next stage?\n\nFor Loss History Review, I recommend:\n- Availability: On Stage Change\n- Trigger: Automatic\n- Mandatory: Yes\n\nBut you might want to add a condition. For example, only retrieve loss history for properties above a certain value, or only for certain policy types.\n\nWould you like to add a conditional rule for when this activity should appear?`,
    options: [
      { label: 'Yes, add a condition', value: 'yes' },
      { label: 'No, make it always available', value: 'no' },
      { label: 'Show examples first', value: 'examples' },
    ],
  },
  { role: 'user', text: 'Yes, add a condition' },
  {
    role: 'agent',
    delay: 800,
    text: `Great! Let's add a condition for when Loss History Review should be available.\n\nYou can describe the condition in plain language, and I'll translate it to a Salesforce formula.\n\n**Examples:**\n- "Only when property value exceeds 1 million dollars"\n- "When the building age is greater than 50 years or property type is high-rise"\n- "Only for renewal policies, not new business"\n\nWhat condition would you like to apply?`,
  },
  {
    role: 'user',
    delay: 1500,
    text: 'Only when property value exceeds 2 million dollars and the building has had a prior claim',
  },
  {
    role: 'agent',
    delay: 1500,
    text: `I understand your condition. Let me translate it to a Salesforce formula:`,
    conditionCard: {
      naturalLanguage:
        'Only when property value exceeds 2 million dollars and the building has had a prior claim',
      formula: '(Property_Value__c > 2000000) AND (Has_Prior_Claims__c = TRUE)',
      mappings: [
        {
          from: 'property value exceeds 2 million dollars',
          to: 'Property_Value__c > 2000000',
        },
        { from: 'building has had a prior claim', to: 'Has_Prior_Claims__c = TRUE' },
      ],
    },
    options: [
      { label: 'Yes, apply this condition', value: 'yes' },
      { label: 'No, let me rewrite it', value: 'rewrite' },
    ],
  },
  { role: 'user', text: 'Yes, apply this condition' },
  {
    role: 'agent',
    delay: 800,
    text: `Condition applied successfully!\n\n**Activity Configuration Summary:**`,
    record: {
      icon: '⚙️',
      title: 'Loss History Review — Stage Assignment',
      fields: [
        { label: 'Activity', value: 'Loss History Review' },
        { label: 'Stage', value: 'Submission Review' },
        { label: 'Availability', value: 'Conditional' },
        {
          label: 'Availability Rule',
          value: '(Property_Value__c > 2000000) AND (Has_Prior_Claims__c = TRUE)',
        },
        { label: 'Trigger', value: 'Automatic' },
        { label: 'Mandatory', value: 'Yes' },
      ],
    },
  },
  {
    role: 'agent',
    delay: 800,
    text: `Perfect! We've completed the first activity for Stage 1.\n\n**Progress Update:**\n\n✅ Stage 1: Submission Review\n  ✅ Loss History Review (configured with conditions)\n  ⏳ Property Valuation Check (pending)\n  ⏳ Compliance Document Verification (pending)\n\n⏳ Stage 2: Property Inspection (not started)\n⏳ Stage 3: Risk Assessment (not started)\n⏳ Stage 4: Underwriting Decision (not started)\n⏳ Stage 5: Quote Generation (not started)\n\nWhat would you like to do next?`,
    options: [
      { label: 'Continue with Stage 1 activities', value: 'continue' },
      { label: 'Create the Compliance Verification Flow', value: 'flow' },
      { label: 'Review configuration so far', value: 'review' },
      { label: 'Skip to Stage 2', value: 'stage2' },
    ],
  },
  { role: 'user', text: 'Review what we created' },
  {
    role: 'agent',
    delay: 1000,
    text: `Here's a complete summary of your Commercial Property underwriting configuration so far.\n\n**Salesforce Processes:**\n✅ CProp_LossHistory_IP (Integration Procedure)\n\n**Activities Library:**\n✅ Loss History Review\n\n**Stage 1 Configuration:**\n- Loss History Review — Conditional availability\n\n**Next Steps:**\n1. Continue building Stage 1 activities\n2. Create remaining Salesforce processes\n3. Configure Stages 2–5\n4. Test with a sample submission\n\nThank you for using the Setup Assistant.`,
  },
];

export function SetupAssistantPanel() {
  const initialState = getSetupAssistantState();
  const [isOpen, setIsOpen] = useState<boolean>(initialState.open);
  const [context, setContext] = useState<AssistantContext | null>(initialState.context);
  const [messages, setMessages] = useState<RenderedMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [cursor, setCursor] = useState(0);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  // The active script is the contextual one when set, otherwise the default
  // long activity-setup conversation.
  const activeScript = useMemo<ScriptMessage[]>(
    () => (context?.script ? context.script : SCRIPT),
    [context],
  );

  useEffect(() => {
    return subscribeSetupAssistant((next) => {
      setIsOpen(next.open);
      setContext(next.context);
    });
  }, []);

  // Reset and replay the conversation whenever the active script changes
  // (initial open, or a new contextual `Ask` click). We key on the
  // context.id (or the literal 'default' marker) so back-to-back opens for
  // the same subject don't replay.
  const playKey = isOpen ? context?.id ?? '__default__' : null;
  const lastPlayKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen) {
      // When closing, leave the messages alone so the next open with the
      // same context shows where the conversation ended.
      return;
    }
    if (lastPlayKeyRef.current === playKey) return;
    lastPlayKeyRef.current = playKey;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setMessages([]);
    setCursor(0);
    setTyping(false);
    advance(0, activeScript);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey]);

  // Auto-scroll to the bottom when new content lands.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  const advance = (idx: number, script: ScriptMessage[] = activeScript) => {
    if (idx >= script.length) return;
    const msg = script[idx];
    const delay = msg.delay ?? (msg.role === 'agent' ? 700 : 400);
    if (msg.role === 'agent') setTyping(true);
    timeoutRef.current = setTimeout(() => {
      setTyping(false);
      idRef.current += 1;
      const id = idRef.current;
      setMessages((prev) => [...prev, { ...msg, id }]);
      const next = idx + 1;
      setCursor(next);
      // Auto-advance only if the message is not waiting for a user choice.
      if (!msg.options && next < script.length) {
        advance(next, script);
      }
    }, delay);
  };

  const onPickOption = (id: number, label: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, optionsLocked: true, selectedOption: label } : m)),
    );
    advance(cursor);
  };

  const onClose = () => {
    closeSetupAssistant();
  };

  // Render an empty container even when closed so the slide animation
  // has something to translate.
  return (
    <aside
      className={`sa-panel${isOpen ? ' sa-panel--open' : ''}`}
      aria-hidden={!isOpen}
      aria-label="Setup Assistant"
      role="dialog"
    >
      <header className="sa-panel__header">
        <div className="sa-panel__header-left">
          <div className="sa-panel__avatar" aria-hidden="true">
            <AgentforceMark />
          </div>
          <div className="sa-panel__header-text">
            <div className="sa-panel__title">{context?.title ?? 'Setup Assistant'}</div>
            <div className="sa-panel__subtitle">
              {context?.subtitle ?? 'Powered by Agentforce'}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="sa-panel__close"
          onClick={onClose}
          aria-label="Close Setup Assistant"
          title="Close"
        >
          <Icon name="close" size={16} />
        </button>
      </header>

      <div className="sa-panel__body" ref={bodyRef}>
        {messages.map((m) => (
          <MessageRow key={m.id} message={m} onPick={onPickOption} />
        ))}
        {typing && (
          <div className="sa-msg sa-msg--agent">
            <div className="sa-msg__avatar">
              <AgentforceMark />
            </div>
            <div className="sa-msg__content">
              <div className="sa-typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="sa-panel__footer">
        <div className="sa-panel__input-wrap">
          <input
            type="text"
            className="sa-panel__input"
            placeholder="Ask me anything..."
            disabled
          />
          <button type="button" className="sa-panel__send" disabled aria-label="Send">
            <SendGlyph />
          </button>
        </div>
      </footer>
    </aside>
  );
}

interface MessageRowProps {
  message: RenderedMessage;
  onPick: (id: number, label: string) => void;
}

function MessageRow({ message, onPick }: MessageRowProps) {
  const isAgent = message.role === 'agent';
  return (
    <div className={`sa-msg sa-msg--${isAgent ? 'agent' : 'user'}`}>
      <div className="sa-msg__avatar">
        {isAgent ? <AgentforceMark /> : <UserGlyph />}
      </div>
      <div className="sa-msg__content">
        <div
          className="sa-msg__bubble"
          dangerouslySetInnerHTML={{ __html: formatMessageText(message.text) }}
        />
        {message.record && <RecordCardView record={message.record} />}
        {message.conditionCard && <ConditionCardView condition={message.conditionCard} />}
        {message.options && (
          <div className="sa-options">
            {message.options.map((opt) => {
              const selected = message.selectedOption === opt.label;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={[
                    'sa-option',
                    selected ? 'sa-option--selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={message.optionsLocked}
                  onClick={() => onPick(message.id, opt.label)}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}
        {isAgent && (
          <div className="sa-feedback">
            <button className="sa-feedback__btn" type="button" title="Good response">
              <ThumbsUpGlyph />
            </button>
            <button className="sa-feedback__btn" type="button" title="Bad response">
              <ThumbsDownGlyph />
            </button>
            <button className="sa-feedback__btn" type="button" title="Copy response">
              <CopyGlyph />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RecordCardView({ record }: { record: RecordCard }) {
  return (
    <div className="sa-record">
      <div className="sa-record__head">
        <div className="sa-record__title">{record.title}</div>
      </div>
      {record.fields.map((f, i) => (
        <div className="sa-record__field" key={i}>
          <div className="sa-record__label">{f.label}</div>
          <div className="sa-record__value">{f.value}</div>
        </div>
      ))}
      <button type="button" className="sa-record__view">
        View
      </button>
    </div>
  );
}

function ConditionCardView({ condition }: { condition: ConditionCard }) {
  return (
    <div className="sa-record sa-record--condition">
      <div className="sa-cond__label">Your Natural Language Condition</div>
      <div className="sa-cond__nl">"{condition.naturalLanguage}"</div>
      <div className="sa-cond__label">Translated to Salesforce Formula</div>
      <div className="sa-cond__formula">{condition.formula}</div>
      {condition.mappings.length > 0 && (
        <>
          <div className="sa-cond__label">Field Mappings</div>
          <div className="sa-cond__mappings">
            {condition.mappings.map((m, i) => (
              <div className="sa-cond__mapping" key={i}>
                "{m.from}" → <code>{m.to}</code>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function formatMessageText(raw: string): string {
  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

/** SLDS Standard "agent_astro" icon, inlined from the SLDS sprite so we
 * don't depend on an external CDN. Renders as the canonical white glyph
 * on a tinted background (handled by the surrounding avatar's bg). */
function AgentforceMark() {
  return (
    <svg
      viewBox="0 0 1000 1000"
      className="sa-astro"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M569 521c-10 0-20 2-27 5l-29 6-13 1h-2a96 96 0 01-12-1c-18-3-29-7-29-7q-12-4.5-27-6c-56-6-81 16-82 20s5 57 9 65a35 35 0 0018 16c6 3 57 8 74 5s20-8 25-17c3-6 11-35 16-52 1-3 1-10 9-10 8 1 8 7 9 11a588 588 0 0015 52c5 9 7 15 24 17 18 3 69-1 75-4 6-2 13-7 18-15 4-8 11-61 10-65s-25-26-81-22zm175-166a282 282 0 00-54-54 46 46 0 0037-45 46 46 0 00-46-46 46 46 0 00-42 61 320 320 0 00-105-30 321 321 0 00-172 29 46 46 0 00-43-60 46 46 0 00-46 46c0 23 16 41 37 45-58 44-99 108-108 181a258 258 0 0054 192 307 307 0 00245 116c150 0 279-103 297-243a258 258 0 00-54-192M500 711c-113 0-204-76-204-170 0-28 8-56 24-80a81 81 0 006 22 21 21 0 0029 10 22 22 0 0010-29c-3-6-10-25 7-39a185 185 0 0064 40c48 15 84 6 85 6a22 22 0 0015-15c3-7 1-15-4-20-24-29-35-49-40-62 97 14 116 93 117 97a21 21 0 0025 16c12-2 19-14 17-26-3-14-11-34-25-54 48 31 79 80 79 134 0 94-92 170-205 170"
      />
    </svg>
  );
}

function UserGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
    </svg>
  );
}

function SendGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="m22 2-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

function ThumbsUpGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function ThumbsDownGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
    </svg>
  );
}

function CopyGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
