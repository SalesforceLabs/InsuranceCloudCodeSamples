import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, Icon, PageHeader, Table, type Column } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { ActivityInstance } from '@/types/config';

export function StmDetailPanel() {
  const { id } = useParams();
  const { config } = useConfig();
  const navigate = useNavigate();
  const cfg = config.activityConfigs.find((a) => String(a.id) === id);
  if (!cfg)
    return (
      <EmptyState
        title="Configuration not found"
        action={<Button variant="neutral" onClick={() => navigate('/activities')}>Back</Button>}
      />
    );

  const activities = config.stmActivitiesData[String(cfg.id)] ?? [];

  const columns: Column<ActivityInstance>[] = [
    {
      key: 'name',
      header: 'Activity',
      render: (a) => {
        const lib = config.reusableActivities.find((r) => r.id === a.activityRefId);
        return <span style={{ fontWeight: 500 }}>{a.nameOverride || lib?.name || `Activity #${a.id}`}</span>;
      },
    },
    {
      key: 'process',
      header: 'Process',
      render: (a) => {
        const lib = config.reusableActivities.find((r) => r.id === a.activityRefId);
        return <Badge tone="info">{lib?.action ?? a.action ?? '—'}</Badge>;
      },
    },
    { key: 'avail', header: 'Availability', render: (a) => a.availability || '—' },
    { key: 'trigger', header: 'Trigger', render: (a) => a.trigger || '—' },
    {
      key: 'mandatory',
      header: 'Mandatory',
      width: '100px',
      align: 'center',
      render: (a) => (a.mandatory ? <Badge tone="warning">Required</Badge> : '—'),
    },
  ];

  return (
    <>
      <Button variant="link" iconLeading={<Icon name="arrow-left" size={14} />} onClick={() => navigate(-1)}>
        Back
      </Button>
      <div style={{ height: 12 }} />
      <PageHeader
        eyebrow="Submission Activity Configuration"
        title={cfg.name}
        subtitle={cfg.active ? 'Active' : 'Inactive'}
        icon={<Icon name="workflow" size={20} />}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <Card padding="sm">
          <div style={{ fontSize: 12, color: 'var(--slds-g-color-on-surface-2)' }}>Status</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{cfg.active ? 'Active' : 'Inactive'}</div>
        </Card>
        <Card padding="sm">
          <div style={{ fontSize: 12, color: 'var(--slds-g-color-on-surface-2)' }}>Effective From</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{cfg.effectiveFrom || '—'}</div>
        </Card>
        <Card padding="sm">
          <div style={{ fontSize: 12, color: 'var(--slds-g-color-on-surface-2)' }}>Effective To</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{cfg.effectiveTo || '—'}</div>
        </Card>
        <Card padding="sm">
          <div style={{ fontSize: 12, color: 'var(--slds-g-color-on-surface-2)' }}>Activities</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{activities.length}</div>
        </Card>
      </div>
      <Card title="Activities" padding="none">
        <Table<ActivityInstance>
          columns={columns}
          rows={activities}
          rowKey={(a) => a.id}
          empty="No activities configured for this submission stage yet."
        />
      </Card>
    </>
  );
}
