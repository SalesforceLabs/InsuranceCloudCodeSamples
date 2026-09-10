import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  PageHeader,
  Table,
  type Column,
} from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { Playbook } from '@/types/config';
import { PlaybookWizard } from './PlaybookWizard';

export function RunMyDayPanel() {
  const { config, update } = useConfig();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

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

  const cols: Column<Playbook>[] = useMemo(
    () => [
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
      {
        key: 'role',
        header: 'Role',
        render: (p) =>
          p.role ? <Badge tone="info">{p.role}</Badge> : <span style={{ color: 'var(--slds-g-color-on-surface-1)' }}>Any role</span>,
      },
      { key: 'groups', header: 'Groups', width: '100px', render: (p) => p.groups.length },
      {
        key: 'insights',
        header: 'Insights',
        width: '100px',
        render: (p) => p.groups.reduce((s, g) => s + g.insights.length, 0),
      },
      {
        key: 'actions',
        header: 'Actions',
        width: '100px',
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
              onClick={() => {
                update((prev) => ({
                  ...prev,
                  playbooks: prev.playbooks.map((x) =>
                    x.id === p.id ? { ...x, active: !x.active } : x,
                  ),
                }));
              }}
            >
              <Icon name={p.active ? 'close' : 'check'} />
            </Button>
            <Button
              variant="icon"
              aria-label="Delete"
              onClick={() => {
                if (!confirm(`Delete playbook "${p.name}"? This cannot be undone.`)) return;
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
    ],
    [update],
  );

  return (
    <>
      <PageHeader
        title="Run My Day"
        icon={<Icon name="sun" size={20} />}
        subtitle="Configure playbooks that structure the Run My Day landing experience."
        actions={
          <Button variant="brand" iconLeading={<Icon name="plus" size={14} />} onClick={onNew}>
            New Playbook
          </Button>
        }
      />
      {config.playbooks.length === 0 ? (
        <Card padding="md">
          <EmptyState
            icon={<Icon name="layers" size={20} />}
            title="No Playbooks Yet"
            description="Create a playbook to define the Groups, Insights, and Actions on Run My Day."
            action={
              <Button variant="brand" iconLeading={<Icon name="plus" size={14} />} onClick={onNew}>
                New Playbook
              </Button>
            }
          />
        </Card>
      ) : (
        <Card padding="none">
          <Table<Playbook>
            columns={cols}
            rows={config.playbooks}
            rowKey={(p) => p.id}
            empty="No playbooks yet."
          />
        </Card>
      )}
      <PlaybookWizard open={wizardOpen} editingId={editingId} onClose={onClose} />
    </>
  );
}
