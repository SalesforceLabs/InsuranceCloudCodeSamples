import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Icon,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { StageConfig } from '@/types/config';
import { LobStageEditor } from './LobStageEditor';
import './LobStageEditor.css';

export function ScDetailPanel() {
  const { id } = useParams();
  const { config } = useConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const cfg = config.stageConfigs.find((a) => String(a.id) === id);

  // Use browser history so the user lands back on whichever list they
  // opened the configuration from. Fall back to the `?from=` query (or
  // /activities) for cold loads where there is no history.
  const fallback = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const from = params.get('from');
    if (from && from.startsWith('/')) return from;
    return '/activities';
  }, [location.search]);
  const onBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  if (!cfg)
    return (
      <EmptyState
        title="Configuration not found"
        action={<Button variant="neutral" onClick={onBack}>Back</Button>}
      />
    );

  const isSubmission = cfg.recordType === 'Submission';
  const crumbs: Array<{ label: string; to?: string }> = isSubmission
    ? [
        { label: 'Submission Settings', to: '/submission-settings' },
        { label: 'Stage Management' },
      ]
    : [
        { label: 'Lines Of Business', to: '/lines-of-business' },
        { label: cfg.recordType || '—' },
        { label: 'Stage Management' },
      ];

  return (
    <>
      <nav
        aria-label="Breadcrumb"
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 6,
          marginBottom: 12,
          fontSize: 'var(--slds-g-font-scale-neg-1)',
          color: 'var(--slds-g-color-on-surface-1)',
        }}
      >
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {c.to && !last ? (
                <a
                  onClick={() => navigate(c.to!)}
                  style={{
                    color: 'var(--slds-g-color-accent-1)',
                    cursor: 'pointer',
                    textDecoration: 'none',
                  }}
                >
                  {c.label}
                </a>
              ) : (
                <span
                  style={{
                    color: last
                      ? 'var(--slds-g-color-on-surface-3)'
                      : 'var(--slds-g-color-on-surface-1)',
                    fontWeight: last ? 'var(--slds-g-font-weight-6)' : undefined,
                  }}
                >
                  {c.label}
                </span>
              )}
              {!last && (
                <span aria-hidden="true" style={{ color: 'var(--slds-g-color-on-surface-1)' }}>
                  ›
                </span>
              )}
            </span>
          );
        })}
      </nav>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <Button
          variant="icon"
          aria-label="Back"
          title="Back"
          onClick={onBack}
        >
          <Icon name="arrow-left" size={16} />
        </Button>
        <h1
          style={{
            margin: 0,
            fontSize: 'var(--slds-g-font-scale-3)',
            fontWeight: 'var(--slds-g-font-weight-6)',
            color: 'var(--slds-g-color-on-surface-3)',
            lineHeight: 1.25,
            wordBreak: 'break-word',
          }}
        >
          {cfg.name}
        </h1>
      </div>

      <GeneralSection cfg={cfg} />

      <LobStageEditor cfg={cfg} />
    </>
  );
}

interface GeneralDraft {
  name: string;
  recordType: string;
  effectiveFrom: string;
  effectiveTo: string;
  active: boolean;
  prompt: string;
}

function draftFromCfg(cfg: StageConfig): GeneralDraft {
  return {
    name: cfg.name,
    recordType: cfg.recordType,
    effectiveFrom: cfg.effectiveFrom,
    effectiveTo: cfg.effectiveTo,
    active: cfg.active,
    prompt: cfg.prompt ?? '',
  };
}

/**
 * Salesforce-style editable General section. Read-only with an Edit button
 * by default; entering edit mode swaps each field for its input and shows
 * a sticky Save / Cancel footer. Saving validates Name and writes through
 * `useConfig().update`; Cancel discards the draft.
 */
function GeneralSection({ cfg }: { cfg: StageConfig }) {
  const { config, update } = useConfig();
  const [editing, setEditing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [promptCollapsed, setPromptCollapsed] = useState(false);
  const [draft, setDraft] = useState<GeneralDraft>(() => draftFromCfg(cfg));
  const [error, setError] = useState<string | null>(null);

  // If the underlying record changes (e.g. someone else saved, or we navigate
  // to a different config) and we aren't actively editing, reset the draft.
  useEffect(() => {
    if (!editing) {
      setDraft(draftFromCfg(cfg));
      setError(null);
    }
  }, [cfg, editing]);

  const lobOptions =
    config.fields.find((f) => f.api === 'Line_of_Business__c')?.picklistValues ?? [];

  const onCancel = () => {
    setDraft(draftFromCfg(cfg));
    setEditing(false);
    setError(null);
  };

  const onSave = () => {
    const name = draft.name.trim();
    if (!name) {
      setError('Name is required.');
      return;
    }
    update((p) => ({
      ...p,
      stageConfigs: p.stageConfigs.map((s) =>
        s.id === cfg.id
          ? {
              ...s,
              name,
              recordType: draft.recordType,
              effectiveFrom: draft.effectiveFrom,
              effectiveTo: draft.effectiveTo,
              active: draft.active,
              prompt: draft.prompt.trim() ? draft.prompt : undefined,
            }
          : s,
      ),
    }));
    setEditing(false);
    setError(null);
  };

  const onToggleCollapsed = () => {
    // Collapsing while in edit mode would hide the form mid-edit; bail out.
    if (editing) return;
    setCollapsed((c) => !c);
  };

  return (
    <>
      <Card
        title={
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            aria-controls="general-section-body"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'transparent',
              border: 'none',
              padding: 0,
              margin: 0,
              cursor: editing ? 'default' : 'pointer',
              font: 'inherit',
              color: 'inherit',
              fontWeight: 'inherit',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'inline-flex',
                transition: 'transform 120ms ease',
                transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                color: 'var(--slds-g-color-on-surface-1)',
              }}
            >
              <Icon name="chevron-down" size={14} />
            </span>
            <span>General</span>
          </button>
        }
        actions={
          editing ? (
            <span style={{ display: 'inline-flex', gap: 8 }}>
              <Button variant="neutral" onClick={onCancel}>
                Cancel
              </Button>
              <Button variant="brand" onClick={onSave}>
                Save
              </Button>
            </span>
          ) : (
            <Button
              variant="neutral"
              iconLeading={<Icon name="edit" size={14} />}
              onClick={() => {
                setCollapsed(false);
                setEditing(true);
              }}
            >
              Edit
            </Button>
          )
        }
        padding={collapsed ? 'none' : 'md'}
      >
        {collapsed ? null : (
        <>
        <dl
          id="general-section-body"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            columnGap: 32,
            rowGap: 20,
            margin: 0,
          }}
        >
          <SfField label="Name" required={editing}>
            {editing ? (
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Commercial Property V1"
                fullWidth
                aria-label="Name"
              />
            ) : (
              cfg.name
            )}
          </SfField>
          <SfField label="Line of Business">
            {editing ? (
              <Select
                value={draft.recordType}
                onChange={(e) => setDraft((d) => ({ ...d, recordType: e.target.value }))}
                aria-label="Line of Business"
              >
                {lobOptions.length === 0 && <option value="">No LOBs configured</option>}
                {lobOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            ) : (
              cfg.recordType || '—'
            )}
          </SfField>
          <SfField label="Start Date">
            {editing ? (
              <Input
                type="date"
                value={draft.effectiveFrom}
                onChange={(e) => setDraft((d) => ({ ...d, effectiveFrom: e.target.value }))}
                fullWidth
                aria-label="Start Date"
              />
            ) : (
              formatDate(cfg.effectiveFrom)
            )}
          </SfField>
          <SfField label="End Date">
            {editing ? (
              <Input
                type="date"
                value={draft.effectiveTo}
                onChange={(e) => setDraft((d) => ({ ...d, effectiveTo: e.target.value }))}
                fullWidth
                aria-label="End Date"
              />
            ) : (
              formatDate(cfg.effectiveTo)
            )}
          </SfField>
          <SfField label="Active">
            {editing ? (
              <Checkbox
                checked={draft.active}
                onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
                label={draft.active ? 'Active' : 'Inactive'}
              />
            ) : cfg.active ? (
              <Badge tone="success">Active</Badge>
            ) : (
              <Badge>Inactive</Badge>
            )}
          </SfField>
        </dl>

        <section
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid var(--slds-g-color-border-1)',
          }}
        >
          <h3 style={{ margin: 0 }}>
            <button
              type="button"
              onClick={() => setPromptCollapsed((c) => !c)}
              aria-expanded={!promptCollapsed}
              aria-controls="summary-prompt-body"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: 0,
                margin: 0,
                cursor: 'pointer',
                font: 'inherit',
                textAlign: 'left',
                fontSize: 'var(--slds-g-font-scale-1)',
                fontWeight: 'var(--slds-g-font-weight-6)',
                color: 'var(--slds-g-color-on-surface-3)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-flex',
                  transition: 'transform 120ms ease',
                  transform: promptCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  color: 'var(--slds-g-color-on-surface-1)',
                }}
              >
                <Icon name="chevron-down" size={14} />
              </span>
              <span>Summary Prompt Template</span>
            </button>
          </h3>

          {!promptCollapsed && (
            <div id="summary-prompt-body" style={{ marginTop: 8 }}>
              <p
                style={{
                  margin: '0 0 12px',
                  fontSize: 'var(--slds-g-font-scale-neg-1)',
                  color: 'var(--slds-g-color-on-surface-1)',
                  lineHeight: 1.4,
                }}
              >
                Instructions the AI uses to generate the overall summary for this
                configuration. This prompt applies across every stage — individual
                stages can add their own stage-level prompt on top of it.
              </p>

              <SfField label="Prompt">
                {editing ? (
                  <Textarea
                    value={draft.prompt}
                    onChange={(e) => setDraft((d) => ({ ...d, prompt: e.target.value }))}
                    rows={4}
                    placeholder="e.g. Summarize the submission's key exposures, coverage requests, and any outstanding underwriting questions…"
                    fullWidth
                    aria-label="Summary Prompt Template"
                  />
                ) : cfg.prompt ? (
                  <span style={{ whiteSpace: 'pre-wrap' }}>{cfg.prompt}</span>
                ) : (
                  'No summary prompt set.'
                )}
              </SfField>
            </div>
          )}
        </section>

        {editing && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 8,
              marginTop: 24,
              paddingTop: 16,
              borderTop: '1px solid var(--slds-g-color-border-1)',
            }}
          >
            {error && (
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--slds-g-color-error-1)',
                  marginRight: 'auto',
                }}
              >
                {error}
              </span>
            )}
            <Button variant="neutral" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="brand" onClick={onSave}>
              Save
            </Button>
          </div>
        )}
        </>
        )}
      </Card>
      <div style={{ height: 12 }} />
    </>
  );
}

/**
 * SLDS-style read-only field: muted uppercase label on top, value beneath.
 * Renders as <dt>/<dd> inside the surrounding <dl> grid for accessibility.
 */
function SfField({
  label,
  required,
  fullWidth,
  children,
}: {
  label: string;
  required?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 0,
        ...(fullWidth ? { gridColumn: '1 / -1' } : null),
      }}
    >
      <dt
        style={{
          margin: 0,
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--slds-g-color-on-surface-2)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
        {required && (
          <span style={{ color: 'var(--slds-g-color-error-1)', marginLeft: 2 }} aria-hidden="true">
            *
          </span>
        )}
      </dt>
      <dd
        style={{
          margin: 0,
          fontSize: 14,
          color: 'var(--slds-g-color-on-surface-1)',
          minHeight: 20,
          wordBreak: 'break-word',
        }}
      >
        {children}
      </dd>
    </div>
  );
}

function formatDate(value: string | undefined | null): string {
  if (!value) return '—';
  // Treat YYYY-MM-DD literally — no timezone shifts.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
