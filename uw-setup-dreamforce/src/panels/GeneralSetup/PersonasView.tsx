import { useMemo, useState } from 'react';
import { Badge, Button, Icon, Table, type Column } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { Playbook, UnderwriterRole } from '@/types/config';
import { PlaybookWizard } from '@/panels/RunMyDay/PlaybookWizard';

interface Props {
  /**
   * The role this view filters on. `null` matches playbooks where no role is
   * set — the "Any role" bucket.
   */
  personaRole: UnderwriterRole | null;
  /** Display label for the persona (used in headings and the New button). */
  personaLabel: string;
}

export function PersonasView({ personaRole, personaLabel }: Props) {
  const { config, update } = useConfig();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const playbooks = useMemo(
    () =>
      config.playbooks.filter((p) =>
        personaRole == null ? !p.role : p.role === personaRole,
      ),
    [config.playbooks, personaRole],
  );

  const onNew = () => {
    setEditingId(null);
    setWizardOpen(true);
  };
  const onEdit = (id: number) => {
    setEditingId(id);
    setWizardOpen(true);
  };
  const onClose = () => {
    setWizardOpen(false);
    setEditingId(null);
  };

  const cols: Column<Playbook>[] = [
    {
      key: 'name',
      header: 'Configuration Name',
      render: (p) => (
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onEdit(p.id);
          }}
          style={{ fontWeight: 500 }}
        >
          {p.name}
        </a>
      ),
    },
    { key: 'api', header: 'API Name', render: (p) => <code>{p.api}</code> },
    { key: 'groups', header: 'Groups', width: '90px', render: (p) => p.groups.length },
    {
      key: 'insights',
      header: 'Insights',
      width: '90px',
      render: (p) => p.groups.reduce((s, g) => s + g.insights.length, 0),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '90px',
      render: (p) =>
        p.groups.reduce(
          (s, g) => s + g.insights.reduce((s2, i) => s2 + (i.actions?.length ?? 0), 0),
          0,
        ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      render: (p) =>
        p.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>,
    },
    {
      key: 'menu',
      header: '',
      width: '120px',
      render: (p) => (
        <div style={{ display: 'inline-flex', gap: 4 }}>
          <Button variant="icon" aria-label="Edit" onClick={() => onEdit(p.id)}>
            <Icon name="edit" />
          </Button>
          <Button
            variant="icon"
            aria-label={p.active ? 'Deactivate' : 'Activate'}
            onClick={() =>
              update((prev) => ({
                ...prev,
                playbooks: prev.playbooks.map((x) =>
                  x.id === p.id ? { ...x, active: !x.active } : x,
                ),
              }))
            }
          >
            <Icon name={p.active ? 'close' : 'check'} />
          </Button>
          <Button
            variant="icon"
            aria-label="Delete"
            onClick={() => {
              if (!confirm(`Delete playbook "${p.name}"?`)) return;
              update((prev) => ({
                ...prev,
                playbooks: prev.playbooks.filter((x) => x.id !== p.id),
              }));
            }}
          >
            <Icon name="trash" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 'var(--slds-g-font-scale-2)',
              fontWeight: 'var(--slds-g-font-weight-6)',
              color: 'var(--slds-g-color-on-surface-3)',
            }}
          >
            {personaLabel}
          </h3>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 'var(--slds-g-font-scale-base)',
              color: 'var(--slds-g-color-on-surface-1)',
            }}
          >
            {playbooks.length} playbook{playbooks.length === 1 ? '' : 's'}
            {personaRole == null
              ? ' applied across every role'
              : ` scoped to ${personaLabel}`}
          </p>
        </div>
        <Button
          variant="brand"
          iconLeading={<Icon name="plus" size={14} />}
          onClick={onNew}
        >
          New Playbook
        </Button>
      </header>

      {playbooks.length === 0 ? (
        <div
          style={{
            border: '1px dashed var(--slds-g-color-border-1)',
            borderRadius: 'var(--slds-g-radius-border-2)',
            padding: '40px 20px',
            textAlign: 'center',
            color: 'var(--slds-g-color-on-surface-1)',
          }}
        >
          <p style={{ margin: 0, marginBottom: 12 }}>
            No playbooks for {personaLabel} yet.
          </p>
          <Button variant="brand" iconLeading={<Icon name="plus" size={14} />} onClick={onNew}>
            New Playbook
          </Button>
        </div>
      ) : (
        <Table<Playbook>
          columns={cols}
          rows={playbooks}
          rowKey={(p) => p.id}
          empty="No playbooks."
        />
      )}

      <PlaybookWizard open={wizardOpen} editingId={editingId} onClose={onClose} />
    </div>
  );
}
