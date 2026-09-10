import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useDemoFlow } from '@/contexts/DemoFlowContext';
import EmailComposerModal from '@/components/Email/EmailComposerModal';

const ASSET_PREFIX = process.env.NEXT_PUBLIC_PAGES_BASE_PATH || '';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  href?: string;
}

const notificationsByStep: Record<number, NotificationItem[]> = {
  1: [
    {
      id: 'notif-nexgen-1',
      title: 'New submission received',
      body: 'NexGen Biologics Inc New Business was received from email and assigned to you.',
      time: 'Just now',
      unread: true,
      href: '/submissions/a00SB00001ARehdYAD',
    },
  ],
};

// ── Underwriter Assistant ───────────────────────────────────────────────────
// Slide-in Agentforce panel ported from the Setup app's Setup Assistant
// (UW-Setup-V2). The SLDS 2 token-driven CSS there is rebuilt here as inline
// styles against the runtime palette. Drives a scripted, multi-turn
// conversation with option chips and Salesforce-record cards.
interface AssistantRecord {
  title: string;
  fields: { label: string; value: string }[];
}
interface AssistantNavAction {
  label: string;
  resolve: 'attributes' | 'duplicates';
  lineId: string;
}
interface AssistantEmailDraft {
  activity: string;
  to: string;
  subject: string;
  body: string;
}
interface ScriptMsg {
  role: 'agent' | 'user';
  text: string;
  delay?: number;
  record?: AssistantRecord;
  navAction?: AssistantNavAction;
  emailDraft?: AssistantEmailDraft;
}
interface RenderedMsg extends ScriptMsg {
  id: number;
  emailSent?: boolean;
  emailTo?: string;
  emailSubject?: string;
  emailBody?: string;
}

const PROPERTY_LINE_ID = 'a01SB00001p8B5FYAU';
const GL_LINE_ID = 'a01SB00001pGYUTYA4';

// Transcribed from agent-script.md (6 turns: orient → read → redirect → act). Each turn is advanced
// by a suggestion chip carrying the exact prompt; user messages are rendered as those chips.
const ASSISTANT_SCRIPT: ScriptMsg[] = [
  {
    role: 'agent',
    delay: 400,
    text: `Hi Martha — I'm your **Underwriter Assistant**. I've got the full context on this submission. Where would you like to start?`,
  },
  { role: 'user', text: 'Give me the picture on this one.' },
  {
    role: 'agent',
    delay: 1000,
    text: `**NexGen Biologics Inc — New Business**, submitted by Niki Paoloni (Vanguard Insurance Partners). Pharmaceutical manufacturer, NAICS 325412, ~$47.2M revenue, TIV ~$19.5M. Effective 06/01/2026. Stage **In Progress**.\n\nTwo submission lines were created — **Commercial Property** (Manish Arya) and **General Liability** (David Chen). Both created lines have discrepancies to resolve before quoting.`,
    record: {
      title: 'NexGen Biologics Inc New Business',
      fields: [
        { label: 'Broker', value: 'Niki Paoloni · Vanguard Insurance Partners' },
        { label: 'Industry', value: 'Pharmaceutical mfg · NAICS 325412' },
        { label: 'Annual Revenue', value: '~$47.2M' },
        { label: 'Total Insured Value', value: '~$19.5M' },
        { label: 'Effective Date', value: '06/01/2026' },
        { label: 'Lines', value: 'Commercial Property, General Liability (Business Auto skipped)' },
      ],
    },
  },
  { role: 'user', text: 'What needs my attention right now?' },
  {
    role: 'agent',
    delay: 1000,
    text: `Two things:\n\n1. Resolve the discrepancies on the **Commercial Property** line — the Chicago Warehouse address conflict (address, city, state, ZIP), plus a **duplicate San Jose location pair**.\n2. Resolve the **Premium Basis** conflict on the **General Liability** line.`,
  },
  { role: 'user', text: 'Where did the Chicago Warehouse address come from? Something looks off.' },
  {
    role: 'agent',
    delay: 1000,
    text: `The address is **1450 W Fulton St** on ACORD 140, ACORD 125, and the Statement of Values, but the **broker email** says **1448 W Fulton Street** — and the email's ZIP is **60612** where the others say **60607**. That's the flagged conflict on **Location 1 – Chicago Warehouse**.\n\nTo pick the value to keep, open **Resolve Attribute Mapping** on the Property line.`,
    navAction: { label: 'Resolve Attribute Mapping', resolve: 'attributes', lineId: PROPERTY_LINE_ID },
  },
  { role: 'user', text: 'Compare the GL Premium Basis across the sources.' },
  {
    role: 'agent',
    delay: 1000,
    text: `- **ACORD 126** — "Payroll + Sales + Area"\n- **Broker email** — "Payroll + Sales"\n- **ACORD 140** — "Payroll, Sales, Area"\n\nThat's the flagged conflict on the **General Liability** line — resolve it from **Resolve Attribute Mapping** on that line.`,
    navAction: { label: 'Resolve Attribute Mapping', resolve: 'attributes', lineId: GL_LINE_ID },
  },
  { role: 'user', text: 'Are the San Jose locations really duplicates?' },
  {
    role: 'agent',
    delay: 1000,
    text: `Reconciliation flagged **Location 3A – San Jose Manufacturing Campus** and **Location 3B – San Jose Manufacturing Facility** — same address (**2500 Augustine Dr**) with overlapping buildings (Manufacturing Building A, Warehouse & Distribution). There's a second pair in **Austin** (Location 5A – Austin Distribution Center / Location 5B – Austin Warehouse Facility).\n\nYou can merge them from **Resolve Duplicates** on the Property line.`,
    navAction: { label: 'Resolve Duplicates', resolve: 'duplicates', lineId: PROPERTY_LINE_ID },
  },
  { role: 'user', text: 'Draft an email to Niki to confirm the Chicago Warehouse address.' },
  {
    role: 'agent',
    delay: 1000,
    text: `Here's a draft — review and edit it, then approve to send. Nothing is written until you approve.`,
    emailDraft: {
      activity: 'Request Additional Information',
      to: 'Niki Paoloni (Vanguard Insurance Partners)',
      subject: 'NexGen Biologics — confirm Chicago Warehouse address',
      body: `Hi Niki — the submission has two different addresses for the Chicago Warehouse (Location 1). Your email lists 1448 W Fulton Street, ZIP 60612, while the ACORD forms and the Statement of Values show 1450 W Fulton St, ZIP 60607. Can you confirm which is correct?\n\nThanks,\nMartha`,
    },
  },
  {
    role: 'agent',
    delay: 900,
    text: `Sent. Recorded **Request Additional Information** — you're the recorded actor. It's in the Tasks panel and Activity Log now.`,
  },
];

function normalizeAssistantPrompt(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[.,!?;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// The script is authored as one linear walkthrough, but the assistant should answer whichever fixed
// prompt the user picks, in any order. Derive an intro block + a prompt→response map from it: leading
// agent turns are the intro, and each user turn keys the agent turn(s) that follow it.
const ASSISTANT_INTRO: ScriptMsg[] = [];
const ASSISTANT_PROMPTS: { prompt: string; key: string; responses: ScriptMsg[] }[] = [];
(() => {
  let cur: { prompt: string; key: string; responses: ScriptMsg[] } | null = null;
  ASSISTANT_SCRIPT.forEach((msg) => {
    if (msg.role === 'user') {
      cur = { prompt: msg.text, key: normalizeAssistantPrompt(msg.text), responses: [] };
      ASSISTANT_PROMPTS.push(cur);
    } else if (!cur) {
      ASSISTANT_INTRO.push(msg);
    } else {
      cur.responses.push(msg);
    }
  });
})();
const ASSISTANT_PROMPT_MAP: Record<string, ScriptMsg[]> = Object.fromEntries(
  ASSISTANT_PROMPTS.map((p) => [p.key, p.responses]),
);
// Agent turns that follow the email draft — played only after Approve & Send.
const ASSISTANT_EMAIL_FOLLOWUP: ScriptMsg[] = (() => {
  const idx = ASSISTANT_SCRIPT.findIndex((m) => m.emailDraft);
  if (idx < 0) return [];
  const rest: ScriptMsg[] = [];
  for (let i = idx + 1; i < ASSISTANT_SCRIPT.length && ASSISTANT_SCRIPT[i].role !== 'user'; i += 1) {
    rest.push(ASSISTANT_SCRIPT[i]);
  }
  return rest;
})();
const ASSISTANT_FALLBACK = "I'm sorry, I didn't quite understand that.";

function formatAssistantText(raw: string): string {
  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

/** SLDS Standard "agent_astro" glyph, inlined from the SLDS sprite. */
function AstroMark({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 1000 1000" width={size} height={size} aria-hidden="true" focusable="false" style={{ display: 'block' }}>
      <path
        fill="currentColor"
        d="M569 521c-10 0-20 2-27 5l-29 6-13 1h-2a96 96 0 01-12-1c-18-3-29-7-29-7q-12-4.5-27-6c-56-6-81 16-82 20s5 57 9 65a35 35 0 0018 16c6 3 57 8 74 5s20-8 25-17c3-6 11-35 16-52 1-3 1-10 9-10 8 1 8 7 9 11a588 588 0 0015 52c5 9 7 15 24 17 18 3 69-1 75-4 6-2 13-7 18-15 4-8 11-61 10-65s-25-26-81-22zm175-166a282 282 0 00-54-54 46 46 0 0037-45 46 46 0 00-46-46 46 46 0 00-42 61 320 320 0 00-105-30 321 321 0 00-172 29 46 46 0 00-43-60 46 46 0 00-46 46c0 23 16 41 37 45-58 44-99 108-108 181a258 258 0 0054 192 307 307 0 00245 116c150 0 279-103 297-243a258 258 0 00-54-192M500 711c-113 0-204-76-204-170 0-28 8-56 24-80a81 81 0 006 22 21 21 0 0029 10 22 22 0 0010-29c-3-6-10-25 7-39a185 185 0 0064 40c48 15 84 6 85 6a22 22 0 0015-15c3-7 1-15-4-20-24-29-35-49-40-62 97 14 116 93 117 97a21 21 0 0025 16c12-2 19-14 17-26-3-14-11-34-25-54 48 31 79 80 79 134 0 94-92 170-205 170"
      />
    </svg>
  );
}

function UnderwriterAssistantPanel({
  isOpen,
  onClose,
  onNavigate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (resolve: 'attributes' | 'duplicates', lineId: string) => void;
}) {
  const [messages, setMessages] = useState<RenderedMsg[]>([]);
  const [typing, setTyping] = useState(false);
  // True when it's the user's turn (intro/response finished) — gates the input + suggestion chips.
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState('');
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);
  const startedRef = useRef(false);
  const hydratedRef = useRef(false);
  // Agent turns queued after an email draft, played on Approve & Send.
  const emailQueueRef = useRef<ScriptMsg[]>([]);

  // GlobalHeader remounts on every navigation, so the conversation is persisted to sessionStorage
  // and restored here — a redirect button can navigate away and the chat resumes when reopened.
  useEffect(() => {
    try {
      sessionStorage.removeItem('uw_assistant_convo'); // discard legacy conversations
      sessionStorage.removeItem('uw_assistant_convo_v2');
      const raw = sessionStorage.getItem('uw_assistant_convo_v3');
      if (raw) {
        const parsed = JSON.parse(raw) as { messages: RenderedMsg[] };
        if (parsed.messages && parsed.messages.length) {
          setMessages(parsed.messages);
          idRef.current = parsed.messages.reduce((mx, m) => Math.max(mx, m.id), 0);
          startedRef.current = true;
          setReady(true);
        }
      }
    } catch {
      // ignore
    }
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      if (messages.length) sessionStorage.setItem('uw_assistant_convo_v3', JSON.stringify({ messages }));
    } catch {
      // ignore
    }
  }, [messages]);

  // Render a list of agent messages one after another (typing indicator + per-message delay). Stops
  // at an email draft to wait for Approve & Send; re-enables the input when the list is exhausted.
  const renderAgentQueue = (msgs: ScriptMsg[], i = 0) => {
    if (i >= msgs.length) {
      setReady(true);
      return;
    }
    const msg = msgs[i];
    setReady(false);
    setTyping(true);
    timeoutRef.current = setTimeout(() => {
      setTyping(false);
      idRef.current += 1;
      const id = idRef.current;
      setMessages((prev) => [...prev, { ...msg, id }]);
      if (msg.emailDraft) {
        emailQueueRef.current = msgs.slice(i + 1);
        setReady(true); // user may keep asking; the draft's Approve button plays the follow-up
        return;
      }
      renderAgentQueue(msgs, i + 1);
    }, msg.delay ?? 700);
  };

  // Start the conversation the first time the panel opens (unless a persisted one was restored).
  useEffect(() => {
    if (isOpen && !startedRef.current) {
      startedRef.current = true;
      renderAgentQueue(ASSISTANT_INTRO);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  // Answer whichever fixed prompt the user posts, in any order. Unknown prompts get a generic reply.
  const onSend = (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || typing) return;
    idRef.current += 1;
    setMessages((prev) => [...prev, { role: 'user', text, id: idRef.current }]);
    setInput('');
    setReady(false);
    const responses = ASSISTANT_PROMPT_MAP[normalizeAssistantPrompt(text)];
    if (responses && responses.length) {
      renderAgentQueue(responses);
    } else {
      renderAgentQueue([{ role: 'agent', delay: 600, text: ASSISTANT_FALLBACK }]);
    }
  };

  const onApproveEmail = (id: number) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, emailSent: true } : m)));
    const followUp = emailQueueRef.current.length ? emailQueueRef.current : ASSISTANT_EMAIL_FOLLOWUP;
    emailQueueRef.current = [];
    renderAgentQueue(followUp);
  };

  // "Edit" opens the shared EmailComposerModal (the same one the "Get information from broker" task
  // uses in Step 5), pre-filled with this draft. Sending from the composer persists the edits and
  // completes the send (same follow-up as the inline Approve & Send).
  const [composerMsgId, setComposerMsgId] = useState<number | null>(null);
  const composerMsg = composerMsgId != null ? messages.find((m) => m.id === composerMsgId) : null;

  const resetConversation = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    try {
      sessionStorage.removeItem('uw_assistant_convo_v3');
    } catch {
      // ignore
    }
    idRef.current = 0;
    emailQueueRef.current = [];
    setMessages([]);
    setReady(false);
    setInput('');
    setTyping(false);
    renderAgentQueue(ASSISTANT_INTRO);
  };

  return (
    <>
    <aside
      role="dialog"
      aria-label="Underwriter Assistant"
      aria-hidden={!isOpen}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'min(52.5vw, 690px)',
        minWidth: '570px',
        backgroundColor: 'white',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid #e5e5e5',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 280ms cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: isOpen ? 'auto' : 'none',
        zIndex: 2000,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '14px 20px',
          background: 'linear-gradient(135deg, #5867E8 0%, #0176D3 100%)',
          color: 'white',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.18)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AstroMark size={22} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 600, lineHeight: 1.3 }}>Underwriter Assistant</div>
            <div style={{ fontSize: '12px', opacity: 0.9, lineHeight: 1.3 }}>Powered by Agentforce</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={resetConversation}
            aria-label="New chat"
            title="New chat"
            style={{
              width: '32px',
              height: '32px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: 'rgba(255,255,255,0.16)',
              color: 'white',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.28)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.16)';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Underwriter Assistant"
            title="Close"
            style={{
              width: '32px',
              height: '32px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: 'rgba(255,255,255,0.16)',
              color: 'white',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.28)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.16)';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        ref={bodyRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          backgroundColor: 'white',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {messages.map((m) => (
          <AssistantMessageRow
            key={m.id}
            message={m}
            onNavigate={onNavigate}
            onApproveEmail={onApproveEmail}
            onEdit={setComposerMsgId}
          />
        ))}
        {typing && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#5867E8',
                color: 'white',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AstroMark size={20} />
            </div>
            <div
              style={{
                display: 'inline-flex',
                gap: '4px',
                padding: '10px 14px',
                backgroundColor: '#f3f3f3',
                border: '1px solid #e5e5e5',
                borderRadius: '12px 12px 12px 4px',
              }}
            >
              <span className="uw-asst-dot" />
              <span className="uw-asst-dot" style={{ animationDelay: '0.15s' }} />
              <span className="uw-asst-dot" style={{ animationDelay: '0.3s' }} />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '14px 20px',
          backgroundColor: 'white',
          borderTop: '1px solid #e5e5e5',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            ref={inputRef}
            type="text"
            placeholder={!ready ? 'Thinking…' : 'Ask me anything…'}
            disabled={!ready}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            style={{
              flex: 1,
              padding: '8px 12px',
              backgroundColor: !ready ? '#f3f3f3' : 'white',
              border: '1px solid #e5e5e5',
              borderRadius: '4px',
              fontSize: '13px',
              color: '#2e2e2e',
              opacity: !ready ? 0.6 : 1,
            }}
          />
          <button
            type="button"
            disabled={!ready || !input.trim()}
            onClick={() => onSend()}
            aria-label="Send"
            style={{
              width: '36px',
              height: '36px',
              backgroundColor: '#0176D3',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              opacity: !ready || !input.trim() ? 0.45 : 1,
              cursor: !ready || !input.trim() ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="m22 2-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>

      <style jsx>{`
        .uw-asst-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #939393;
          display: inline-block;
          animation: uw-asst-bounce 1.4s infinite;
        }
        @keyframes uw-asst-bounce {
          0%,
          60%,
          100% {
            transform: translateY(0);
            opacity: 0.4;
          }
          30% {
            transform: translateY(-6px);
            opacity: 1;
          }
        }
      `}</style>
    </aside>
    {composerMsg?.emailDraft && (
      <EmailComposerModal
        isOpen
        onClose={() => setComposerMsgId(null)}
        defaultTo={composerMsg.emailTo ?? composerMsg.emailDraft.to}
        defaultSubject={composerMsg.emailSubject ?? composerMsg.emailDraft.subject}
        defaultBody={composerMsg.emailBody ?? composerMsg.emailDraft.body}
        onSend={(email) => {
          const id = composerMsg.id;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id ? { ...m, emailTo: email.to, emailSubject: email.subject, emailBody: email.body } : m,
            ),
          );
          setComposerMsgId(null);
          onApproveEmail(id);
        }}
      />
    )}
    </>
  );
}

function AssistantMessageRow({
  message,
  onNavigate,
  onApproveEmail,
  onEdit,
}: {
  message: RenderedMsg;
  onNavigate: (resolve: 'attributes' | 'duplicates', lineId: string) => void;
  onApproveEmail: (id: number) => void;
  onEdit: (id: number) => void;
}) {
  const isAgent = message.role === 'agent';
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexDirection: isAgent ? 'row' : 'row-reverse' }}>
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '2px',
          backgroundColor: isAgent ? '#5867E8' : '#16325c',
          color: 'white',
        }}
      >
        {isAgent ? (
          <AstroMark size={20} />
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
          </svg>
        )}
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          alignItems: isAgent ? 'flex-start' : 'flex-end',
        }}
      >
        <div
          style={{
            fontSize: '13px',
            lineHeight: 1.55,
            color: isAgent ? '#2e2e2e' : 'white',
            backgroundColor: isAgent ? '#f7f8fc' : '#0176D3',
            border: isAgent ? '1px solid #e8eaf3' : 'none',
            borderRadius: isAgent ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
            padding: '10px 14px',
            wordWrap: 'break-word',
            maxWidth: '100%',
          }}
          dangerouslySetInnerHTML={{ __html: formatAssistantText(message.text) }}
        />
        {message.record && (
          <div
            style={{
              width: '100%',
              backgroundColor: 'white',
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              padding: '14px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#001e5b',
                paddingBottom: '8px',
                borderBottom: '1px solid #e5e5e5',
              }}
            >
              {message.record.title}
            </div>
            {message.record.fields.map((f, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontSize: '11px', color: '#5c5c5c', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                  {f.label}
                </div>
                <div style={{ fontSize: '13px', color: '#2e2e2e', lineHeight: 1.4 }}>{f.value}</div>
              </div>
            ))}
          </div>
        )}
        {message.emailDraft && (
          <div
            style={{
              width: '100%',
              backgroundColor: 'white',
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              padding: '14px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#5867E8',
                paddingBottom: '8px',
                borderBottom: '1px solid #e5e5e5',
              }}
            >
              <AstroMark size={14} />
              {message.emailDraft.activity}
            </div>
            {[
              { label: 'To', value: message.emailTo ?? message.emailDraft.to },
              { label: 'Subject', value: message.emailSubject ?? message.emailDraft.subject },
            ].map((f) => (
              <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontSize: '11px', color: '#5c5c5c', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                  {f.label}
                </div>
                <div style={{ fontSize: '13px', color: '#2e2e2e', lineHeight: 1.4 }}>{f.value}</div>
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ fontSize: '11px', color: '#5c5c5c', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                Body
              </div>
              <div style={{ fontSize: '13px', color: '#2e2e2e', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {message.emailBody ?? message.emailDraft.body}
              </div>
            </div>
            {message.emailSent ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#2E844A',
                  paddingTop: '8px',
                  borderTop: '1px solid #e5e5e5',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
                Sent
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid #e5e5e5' }}>
                <button
                  type="button"
                  onClick={() => onEdit(message.id)}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: 'white',
                    border: '1px solid #c9c9c9',
                    borderRadius: '4px',
                    color: '#001e5b',
                    fontSize: '12px',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onApproveEmail(message.id)}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: '#0176D3',
                    border: '1px solid #0176D3',
                    borderRadius: '4px',
                    color: 'white',
                    fontSize: '12px',
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Approve &amp; Send
                </button>
              </div>
            )}
          </div>
        )}
        {message.navAction && (
          <button
            type="button"
            onClick={() => onNavigate(message.navAction!.resolve, message.navAction!.lineId)}
            style={{
              alignSelf: 'flex-start',
              padding: '9px 14px',
              backgroundColor: 'white',
              border: '1px solid #0176D3',
              borderRadius: '6px',
              color: '#0176D3',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#eef4ff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
            }}
          >
            {message.navAction.label}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default function GlobalHeader() {
  const router = useRouter();
  const { currentStep, goToStep } = useDemoFlow();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  // Runtime-generated notifications pushed from pages (e.g. enrichment completion on the
  // submission-line page). Kept separate from the per-step catalog above.
  const [runtimeItems, setRuntimeItems] = useState<NotificationItem[]>([]);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // GlobalHeader remounts on navigation; the assistant's open state rides along in sessionStorage so
  // the panel stays open across in-app navigation (including when a redirect chip opens a modal).
  useEffect(() => {
    try {
      if (sessionStorage.getItem('uw_assistant_open') === '1') setAssistantOpen(true);
    } catch {
      // ignore
    }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem('uw_assistant_open', assistantOpen ? '1' : '0');
    } catch {
      // ignore
    }
  }, [assistantOpen]);

  const onAssistantNavigate = (resolve: 'attributes' | 'duplicates', lineId: string) => {
    // Keep the panel open across the navigation (its open state rides along in sessionStorage); the
    // resolution modal renders at a higher z-index, so it opens above the panel rather than closing it.
    router.push(`/submission-lines/${lineId}?resolve=${resolve}`);
  };

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem('uw_runtime_notification');
      if (stored) setRuntimeItems([JSON.parse(stored)]);
    } catch {
      // ignore
    }
  }, []);

  // Listen for runtime notifications dispatched by pages and open the panel to surface them.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as (NotificationItem & { remove?: boolean }) | undefined;
      if (!detail) return;
      if (detail.remove) {
        setRuntimeItems((prev) => prev.filter((n) => n.id !== detail.id));
        return;
      }
      setRuntimeItems((prev) => (prev.some((n) => n.id === detail.id) ? prev : [detail, ...prev]));
      setReadIds((prev) => {
        const next = new Set(prev);
        next.delete(detail.id);
        return next;
      });
      setOpen(true);
    };
    window.addEventListener('uw-runtime-notification', handler);
    return () => window.removeEventListener('uw-runtime-notification', handler);
  }, []);

  // On the landing page (`/`), always surface the NexGen "new submission" notification regardless of
  // the persisted demo step — the landing page is where the user should be alerted to a new arrival.
  // Submission detail pages keep the per-step notification model.
  const onListPage = router.pathname === '/';
  const baseItems = mounted ? notificationsByStep[currentStep] || [] : [];
  const stepItems = mounted && onListPage
    ? (() => {
        const merged = [...baseItems];
        const landingDefaults = notificationsByStep[1] || [];
        landingDefaults.forEach((n) => {
          if (!merged.some((existing) => existing.id === n.id)) merged.unshift(n);
        });
        return merged;
      })()
    : baseItems;
  // Runtime notifications (e.g. enrichment completion) always sit on top of the step catalog.
  const items = mounted
    ? [...runtimeItems.filter((r) => !stepItems.some((s) => s.id === r.id)), ...stepItems]
    : stepItems;
  const unreadCount = items.filter((n) => n.unread && !readIds.has(n.id)).length;

  useEffect(() => {
    if (!mounted) return;
    const sessionKey = `notif-shown-step-${currentStep}`;
    const onListPage = router.pathname === '/';
    if (onListPage && unreadCount > 0 && !sessionStorage.getItem(sessionKey)) {
      const timer = setTimeout(() => {
        setOpen(true);
        sessionStorage.setItem(sessionKey, '1');
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [mounted, currentStep, router.pathname, unreadCount]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleItemClick = (n: NotificationItem) => {
    setReadIds((prev) => new Set(prev).add(n.id));
    setOpen(false);
    if (n.id === 'notif-nexgen-1') {
      goToStep(1);
    }
    if (n.href) router.push(n.href);
  };

  return (
    <div
      style={{
        backgroundColor: '#001e5b',
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
      }}
    >
      {/* Left: Product name (links back to landing) */}
      <div
        onClick={() => router.push('/')}
        role="link"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            router.push('/');
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer'
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '4px',
            backgroundColor: '#0176D3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 700,
            fontSize: '13px',
            letterSpacing: '0.5px',
          }}
        >
          UW
        </div>
        <span style={{ color: 'white', fontSize: '16px', fontWeight: 600, letterSpacing: '0.2px' }}>
          Agentic Insurance Underwriting
        </span>
      </div>

      {/* Right: Underwriter Assistant + Notification + Settings + profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
        <button
          onClick={() => setAssistantOpen((v) => !v)}
          title="Underwriter Assistant"
          aria-label="Underwriter Assistant"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: assistantOpen ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!assistantOpen) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.16)';
          }}
          onMouseLeave={(e) => {
            if (!assistantOpen) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
          }}
        >
          <AstroMark size={20} />
        </button>
        <button
          ref={buttonRef}
          onClick={() => setOpen((v) => !v)}
          title="Notifications"
          style={{
            position: 'relative',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: open ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!open) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.16)';
          }}
          onMouseLeave={(e) => {
            if (!open) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6V11a6.002 6.002 0 00-4.5-5.81V4.5a1.5 1.5 0 10-3 0v.69A6.002 6.002 0 006 11v5l-2 2v1h16v-1l-2-2z" />
          </svg>
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                minWidth: '16px',
                height: '16px',
                borderRadius: '8px',
                backgroundColor: '#ea001e',
                color: 'white',
                fontSize: '10px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                border: '2px solid #001e5b',
                boxSizing: 'content-box',
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div
            ref={panelRef}
            style={{
              position: 'absolute',
              top: '44px',
              right: 0,
              width: '380px',
              maxHeight: '480px',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 1100,
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid #e5e5e5',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#001e5b', margin: 0 }}>
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span style={{ fontSize: '12px', color: '#5c5c5c' }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {items.length === 0 ? (
                <div
                  style={{
                    padding: '32px 16px',
                    textAlign: 'center',
                    fontSize: '13px',
                    color: '#939393',
                  }}
                >
                  No new notifications
                </div>
              ) : (
                items.map((n) => {
                  const isUnread = n.unread && !readIds.has(n.id);
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleItemClick(n)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px 16px',
                        border: 'none',
                        borderBottom: '1px solid #f3f3f3',
                        backgroundColor: isUnread ? '#f4f9ff' : 'white',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = isUnread ? '#e8f1fb' : '#fafafa';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = isUnread ? '#f4f9ff' : 'white';
                      }}
                    >
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: '#5867E8',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                            <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                          </svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '2px',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: isUnread ? 600 : 500,
                                color: '#001e5b',
                              }}
                            >
                              {n.title}
                            </span>
                            <span style={{ fontSize: '11px', color: '#939393', flexShrink: 0 }}>
                              {n.time}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#5c5c5c', lineHeight: '16px' }}>
                            {n.body}
                          </div>
                        </div>
                        {isUnread && (
                          <div
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: '#0176D3',
                              flexShrink: 0,
                              marginTop: '6px',
                            }}
                          />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        <button
          onClick={() => window.open(`${ASSET_PREFIX}/setup/index.html`, '_blank', 'noopener,noreferrer')}
          title="Setup"
          aria-label="Open setup"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: 'rgba(255,255,255,0.08)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.16)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54A.484.484 0 0014 2h-4c-.25 0-.46.18-.49.42l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.63 8.48c-.13.22-.07.49.12.61l2.03 1.58c-.05.3-.07.62-.07.93 0 .31.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.3.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.27.42.51.42h4c.25 0 .46-.18.49-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.49-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
          </svg>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#16325c',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            M
          </div>
          <span style={{ color: 'white', fontSize: '13px', fontWeight: 500 }}>Martha</span>
        </div>
      </div>
      <UnderwriterAssistantPanel isOpen={assistantOpen} onClose={() => setAssistantOpen(false)} onNavigate={onAssistantNavigate} />
    </div>
  );
}
