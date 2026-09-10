import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  Icon,
  Input,
  Modal,
  Table,
  Textarea,
  Toggle,
  type Column,
} from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { EmailToSubmissionSettings, RoutingAddress } from '@/types/config';
import '@/panels/ActivitiesAndStages/ActivitiesEntityEditor.css';
import '@/panels/LinesOfBusiness/LobActivitiesSection.css';
import '@/panels/LinesOfBusiness/LobStageManagementSection.css';
import './EmailToSubmission.css';

const OWNER_KINDS: ('User' | 'Queue')[] = ['User', 'Queue'];

const ROUTING_TYPE_OPTIONS = [
  'Create New Submission',
  'Attach to Existing Submission',
  'Manual Review',
];

const UNAUTHORIZED_SENDER_ACTIONS: EmailToSubmissionSettings['unauthorizedSenderAction'][] = [
  'Discard',
  'Bounce',
];
const OVER_RATE_LIMIT_ACTIONS: EmailToSubmissionSettings['overRateLimitAction'][] = [
  'Discard',
  'Bounce',
  'Requeue',
];

const DEFAULT_SETTINGS: EmailToSubmissionSettings = {
  enabled: false,
  saveAttachmentsAsFiles: true,
  deleteDuplicateAttachments: true,
  saveRepliesAsDrafts: true,
  autoUpdateMessageStatus: true,
  notifyExternalSenderOnErrors: true,
  setCaseSourceToEmail: true,
  unauthorizedSenderAction: 'Bounce',
  overRateLimitAction: 'Requeue',
  defaultOwnerKind: 'User',
  defaultOwner: '',
};

export function EmailToSubmissionPanel() {
  const { config, update, loaded } = useConfig();
  const settings = config.emailToSubmission ?? DEFAULT_SETTINGS;
  const addresses = config.routingAddresses ?? [];

  // Routing-form modal state.
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // The General tile edits a local draft that Save commits. The enable toggle
  // (its own tile) persists immediately since it gates the rest of the form.
  const [draft, setDraft] = useState<EmailToSubmissionSettings>(settings);
  useEffect(() => {
    setDraft(config.emailToSubmission ?? DEFAULT_SETTINGS);
  }, [loaded]);

  const editingAddress =
    editingId != null ? addresses.find((a) => a.id === editingId) ?? null : null;

  const setEnabled = (value: boolean) => {
    update((p) => ({
      ...p,
      emailToSubmission: { ...(p.emailToSubmission ?? DEFAULT_SETTINGS), enabled: value },
    }));
    setDraft((d) => ({ ...d, enabled: value }));
  };
  const setSetting = <K extends keyof EmailToSubmissionSettings>(
    key: K,
    value: EmailToSubmissionSettings[K],
  ) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const generalDirty =
    JSON.stringify({ ...draft, enabled: false }) !==
    JSON.stringify({ ...settings, enabled: false });

  const saveGeneral = () => {
    update((p) => ({
      ...p,
      emailToSubmission: { ...draft, enabled: p.emailToSubmission?.enabled ?? draft.enabled },
    }));
  };

  const onDelete = (a: RoutingAddress) => {
    if (!confirm(`Delete routing address "${a.displayName || a.emailAddress}"?`)) return;
    update((p) => ({
      ...p,
      routingAddresses: (p.routingAddresses ?? []).filter((x) => x.id !== a.id),
    }));
    setOpenMenuId(null);
  };

  const openEdit = (a: RoutingAddress) => {
    setOpenMenuId(null);
    setEditingId(a.id);
    setFormOpen(true);
  };

  const routingColumns: Column<RoutingAddress>[] = [
    {
      key: 'displayName',
      header: 'Display Name',
      render: (a) => (
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            openEdit(a);
          }}
          style={{ fontWeight: 600, color: 'var(--slds-g-color-accent-1)' }}
        >
          {a.displayName || a.emailAddress || 'Untitled routing address'}
        </a>
      ),
    },
    {
      key: 'emailAddress',
      header: 'Email Address',
      render: (a) => a.emailAddress || '—',
    },
    {
      key: 'routingType',
      header: 'Routing Type',
      render: (a) => a.routingType || '—',
    },
    {
      key: 'actions',
      header: '',
      width: '52px',
      align: 'right',
      render: (a) => (
        <TileMenu
          open={openMenuId === a.id}
          onToggle={(next) =>
            setOpenMenuId(next ? a.id : openMenuId === a.id ? null : openMenuId)
          }
          onEdit={() => openEdit(a)}
          onDelete={() => onDelete(a)}
        />
      ),
    },
  ];

  return (
    <div className="ets-stack">
      <div className="ets-enable-row">
        <div>
          <div className="ets-enable-row__label">Enable Email-to-Submission</div>
          <p className="ets-help" style={{ marginTop: 2 }}>
            Turn this on to activate the rest of the settings below.
          </p>
        </div>
        <Toggle
          checked={settings.enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          label={settings.enabled ? 'On' : 'Off'}
        />
      </div>

      {!settings.enabled && (
        <div className="ets-notice" role="note" style={{ marginBottom: 0 }}>
          <Icon name="help" size={14} />
          <span>
            After you enable Email-to-Submission, you will need to update its
            settings.
          </span>
        </div>
      )}

      <Section
        title="General"
        footer={
          <Button
            variant="brand"
            onClick={saveGeneral}
            disabled={!settings.enabled || !generalDirty}
          >
            Save
          </Button>
        }
      >
        <Subsection title="Preferences">
          <div className="ets-checklist">
            <Checkbox
              label="Save attachments as Salesforce Files"
              checked={draft.saveAttachmentsAsFiles}
              onChange={(e) =>
                setSetting('saveAttachmentsAsFiles', e.target.checked)
              }
              disabled={!settings.enabled}
            />
            <Checkbox
              label="Delete duplicate email attachments"
              checked={draft.deleteDuplicateAttachments}
              onChange={(e) =>
                setSetting('deleteDuplicateAttachments', e.target.checked)
              }
              disabled={!settings.enabled}
            />
            <Checkbox
              label="Save email replies as drafts"
              checked={draft.saveRepliesAsDrafts}
              onChange={(e) =>
                setSetting('saveRepliesAsDrafts', e.target.checked)
              }
              disabled={!settings.enabled}
            />
            <Checkbox
              label="Auto-update email message status"
              checked={draft.autoUpdateMessageStatus}
              onChange={(e) =>
                setSetting('autoUpdateMessageStatus', e.target.checked)
              }
              disabled={!settings.enabled}
            />
            <Checkbox
              label="Notify external sender on processing errors"
              checked={draft.notifyExternalSenderOnErrors}
              onChange={(e) =>
                setSetting('notifyExternalSenderOnErrors', e.target.checked)
              }
              disabled={!settings.enabled}
            />
            <Checkbox
              label="Set case source to email"
              checked={draft.setCaseSourceToEmail}
              onChange={(e) =>
                setSetting('setCaseSourceToEmail', e.target.checked)
              }
              disabled={!settings.enabled}
            />
          </div>
        </Subsection>

        <Subsection title="Sender & Rate-Limit Handling">
          <div className="ets-inline-field">
            <span className="ets-field__label">Unauthorized Sender Action</span>
            <div
              className="ets-radio-inline"
              role="radiogroup"
              aria-label="Unauthorized Sender Action"
            >
              {UNAUTHORIZED_SENDER_ACTIONS.map((action) => (
                <label className="ets-radio ets-radio--inline" key={action}>
                  <input
                    type="radio"
                    name="ets-unauthorized-action"
                    checked={draft.unauthorizedSenderAction === action}
                    onChange={() =>
                      setSetting('unauthorizedSenderAction', action)
                    }
                    disabled={!settings.enabled}
                  />
                  <span>{action}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="ets-inline-field">
            <span className="ets-field__label">Over Email Rate Limit Action</span>
            <div
              className="ets-radio-inline"
              role="radiogroup"
              aria-label="Over Email Rate Limit Action"
            >
              {OVER_RATE_LIMIT_ACTIONS.map((action) => (
                <label className="ets-radio ets-radio--inline" key={action}>
                  <input
                    type="radio"
                    name="ets-rate-limit-action"
                    checked={draft.overRateLimitAction === action}
                    onChange={() => setSetting('overRateLimitAction', action)}
                    disabled={!settings.enabled}
                  />
                  <span>{action}</span>
                </label>
              ))}
            </div>
          </div>
        </Subsection>

        <Subsection title="Default Incident/Submission Owner">
          <div className="ets-inline-field">
            <div
              className="ets-radio-inline"
              role="radiogroup"
              aria-label="Default incident/submission owner"
            >
              {OWNER_KINDS.map((kind) => (
                <label className="ets-radio ets-radio--inline" key={kind}>
                  <input
                    type="radio"
                    name="ets-default-owner-kind"
                    checked={draft.defaultOwnerKind === kind}
                    onChange={() => setSetting('defaultOwnerKind', kind)}
                    disabled={!settings.enabled}
                  />
                  <span>{kind}</span>
                </label>
              ))}
            </div>
            <Input
              value={draft.defaultOwner}
              onChange={(e) => setSetting('defaultOwner', e.target.value)}
              placeholder={
                draft.defaultOwnerKind === 'Queue'
                  ? 'Search queues…'
                  : 'Search users…'
              }
              disabled={!settings.enabled}
              aria-label={
                draft.defaultOwnerKind === 'Queue'
                  ? 'Default queue'
                  : 'Default user'
              }
              fullWidth
            />
          </div>
        </Subsection>
      </Section>

      <Section
        title="Routing Addresses"
        actions={
          <button
            type="button"
            className="lob-activities__new-btn"
            disabled={!settings.enabled}
            onClick={(e) => {
              e.stopPropagation();
              setEditingId(null);
              setFormOpen(true);
            }}
          >
            <Icon name="plus" size={12} />
            New
          </button>
        }
      >
        <div className="ets-routing-table">
          <Table<RoutingAddress>
            columns={routingColumns}
            rows={addresses}
            rowKey={(a) => a.id}
            empty="No email addresses defined."
          />
        </div>
      </Section>

      <RoutingAddressModal
        open={formOpen}
        editing={editingAddress}
        onClose={() => {
          setFormOpen(false);
          setEditingId(null);
        }}
      />
    </div>
  );
}

/* ── Section / Subsection ────────────────────────────────────────── */

interface SectionProps {
  title: string;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}
function Section({ title, actions, footer, children }: SectionProps) {
  return (
    <Card
      title={<span className="ets-section-title">{title}</span>}
      actions={actions}
      footer={footer}
      padding="md"
    >
      {children}
    </Card>
  );
}

interface SubsectionProps {
  title: string;
  children: React.ReactNode;
}
function Subsection({ title, children }: SubsectionProps) {
  return (
    <section className="ets-subsection">
      <h4 className="ets-subsection__title">{title}</h4>
      {children}
    </section>
  );
}

/* ── Record-form section / row (single-column, label-left) ───────── */

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ets-fs">
      <h4 className="ets-fs__title">{title}</h4>
      <div className="ets-fs__body">{children}</div>
    </section>
  );
}

interface FormRowProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}
function FormRow({ label, required, hint, children }: FormRowProps) {
  return (
    <div className="ets-fr">
      <div className="ets-fr__label">
        {required && (
          <span className="ets-fr__required" aria-hidden="true">
            *{' '}
          </span>
        )}
        {label}
      </div>
      <div className="ets-fr__control">
        {children}
        {hint && <p className="ets-fr__hint">{hint}</p>}
      </div>
    </div>
  );
}

/* ── Row action menu ─────────────────────────────────────────────── */

interface TileMenuProps {
  open: boolean;
  onToggle: (next: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}
function TileMenu({ open, onToggle, onEdit, onDelete }: TileMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDocClick = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) onToggle(false);
    };
    const onKey = (ev: globalThis.KeyboardEvent) => {
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
        aria-label="Routing address actions"
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

/* ── Routing-address modal ───────────────────────────────────────── */

interface RoutingAddressModalProps {
  open: boolean;
  editing: RoutingAddress | null;
  onClose: () => void;
}

function emptyDraft(): Omit<RoutingAddress, 'id'> {
  return {
    emailAddress: '',
    displayName: '',
    routingType: '',
    assigneeType: 'User',
    assignee: '',
    priority: '',
    origin: '',
    acceptEmailsFrom: '',
  };
}

function RoutingAddressModal({
  open,
  editing,
  onClose,
}: RoutingAddressModalProps) {
  const { update } = useConfig();
  const [draft, setDraft] = useState<Omit<RoutingAddress, 'id'>>(emptyDraft());
  const [saveAndNew, setSaveAndNew] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const { id, ...rest } = editing;
      setDraft(rest);
    } else {
      setDraft(emptyDraft());
    }
  }, [open, editing?.id]);

  const set = <K extends keyof Omit<RoutingAddress, 'id'>>(
    key: K,
    value: Omit<RoutingAddress, 'id'>[K],
  ) => setDraft((d) => ({ ...d, [key]: value }));

  const valid =
    draft.emailAddress.trim().length > 0 && draft.routingType.trim().length > 0;

  const onSave = () => {
    update((p) => {
      if (editing) {
        return {
          ...p,
          routingAddresses: (p.routingAddresses ?? []).map((a) =>
            a.id === editing.id ? { ...editing, ...draft } : a,
          ),
        };
      }
      const newId = p.nextRoutingAddressId ?? 1;
      return {
        ...p,
        routingAddresses: [
          ...(p.routingAddresses ?? []),
          { id: newId, ...draft },
        ],
        nextRoutingAddressId: newId + 1,
      };
    });
    if (saveAndNew) {
      setSaveAndNew(false);
      setDraft(emptyDraft());
    } else {
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        editing
          ? `Edit Routing Address — ${editing.displayName || editing.emailAddress}`
          : 'New Routing Address'
      }
      size="md"
      footer={
        <>
          <Button variant="neutral" onClick={onClose}>
            Cancel
          </Button>
          <span style={{ flex: 1 }} />
          <Button
            variant="neutral"
            disabled={!valid}
            onClick={() => {
              setSaveAndNew(true);
              onSave();
            }}
          >
            Save & New
          </Button>
          <Button variant="brand" disabled={!valid} onClick={onSave}>
            Save
          </Button>
        </>
      }
    >
      <p className="ets-help" style={{ marginBottom: 16 }}>
        Configure how emails delivered to this address are routed for submission
        processing.
      </p>
      <div className="ets-record-form">
        <FormSection title="Routing Information">
          <FormRow label="Email Address" required>
            <Input
              value={draft.emailAddress}
              onChange={(e) => set('emailAddress', e.target.value)}
              placeholder="broker@example.com"
              aria-label="Email Address"
              fullWidth
            />
          </FormRow>
          <FormRow label="Display Name">
            <Input
              value={draft.displayName}
              onChange={(e) => set('displayName', e.target.value)}
              placeholder="A short label for this routing address"
              aria-label="Display Name"
              fullWidth
            />
          </FormRow>
          <FormRow label="Routing Type" required>
            <Dropdown
              value={draft.routingType}
              onChange={(v) => set('routingType', v)}
              options={ROUTING_TYPE_OPTIONS.map((o) => ({ value: o, label: o }))}
              placeholder="Select a routing type"
              aria-label="Routing Type"
              fullWidth
            />
          </FormRow>
        </FormSection>

        <FormSection title="Assignment">
          <FormRow label="Assignee Type">
            <div className="ets-inline-field">
              <div
                className="ets-radio-inline"
                role="radiogroup"
                aria-label="Assignee Type"
              >
                {OWNER_KINDS.map((kind) => (
                  <label className="ets-radio ets-radio--inline" key={kind}>
                    <input
                      type="radio"
                      name="ets-assignee-type"
                      checked={draft.assigneeType === kind}
                      onChange={() => set('assigneeType', kind)}
                    />
                    <span>{kind}</span>
                  </label>
                ))}
              </div>
              <Input
                value={draft.assignee}
                onChange={(e) => set('assignee', e.target.value)}
                placeholder={
                  draft.assigneeType === 'Queue' ? 'Select a queue' : 'Select a user'
                }
                iconTrailing={<Icon name="search" size={14} />}
                aria-label={draft.assigneeType === 'Queue' ? 'Queue' : 'User'}
                fullWidth
              />
            </div>
          </FormRow>
          <FormRow label="Priority">
            <Input
              value={draft.priority}
              onChange={(e) => set('priority', e.target.value)}
              aria-label="Priority"
              fullWidth
            />
          </FormRow>
          <FormRow label="Origin">
            <Input
              value={draft.origin}
              onChange={(e) => set('origin', e.target.value)}
              aria-label="Origin"
              fullWidth
            />
          </FormRow>
        </FormSection>

        <FormSection title="Email Settings">
          <FormRow label="Accept Emails From" hint="Comma-separated list of senders or domains.">
            <Textarea
              rows={3}
              value={draft.acceptEmailsFrom}
              onChange={(e) => set('acceptEmailsFrom', e.target.value)}
              placeholder="user@example.com, example.com"
              aria-label="Accept Emails From"
              fullWidth
            />
          </FormRow>
        </FormSection>
      </div>
    </Modal>
  );
}
