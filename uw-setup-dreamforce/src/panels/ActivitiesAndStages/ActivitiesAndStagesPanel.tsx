import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  Icon,
  PageHeader,
  Table,
  Tabs,
  type Column,
} from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { ActivityConfig, StageConfig } from '@/types/config';
import { ActivitiesEntityEditor } from './ActivitiesEntityEditor';
import { StmModal } from './StmModal';
import { ScModal } from './ScModal';

type Tab = 'activities' | 'stages';

export function ActivitiesAndStagesPanel() {
  const { config } = useConfig();
  const [tab, setTab] = useState<Tab>('activities');
  const [stmModal, setStmModal] = useState<{ open: boolean; editing: ActivityConfig | null }>({
    open: false,
    editing: null,
  });
  const [scModal, setScModal] = useState<{ open: boolean; editing: StageConfig | null }>({
    open: false,
    editing: null,
  });

  return (
    <>
      <PageHeader
        title="Activities and Stages"
        icon={<Icon name="workflow" size={20} />}
        subtitle="Configure reusable activities and assign them to submission and line-of-business stages."
      />
      <Tabs
        items={[
          { id: 'activities', label: 'Activities', badge: config.reusableActivities.length },
          { id: 'stages', label: 'Stage Management' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as Tab)}
      />
      <div style={{ marginTop: 16 }}>
        {tab === 'activities' ? (
          <ActivitiesEntityEditor />
        ) : (
          <StagesTab
            onNewStm={() => setStmModal({ open: true, editing: null })}
            onEditStm={(a) => setStmModal({ open: true, editing: a })}
            onNewSc={() => setScModal({ open: true, editing: null })}
            onEditSc={(a) => setScModal({ open: true, editing: a })}
          />
        )}
      </div>
      <StmModal
        open={stmModal.open}
        editing={stmModal.editing}
        onClose={() => setStmModal({ open: false, editing: null })}
      />
      <ScModal
        open={scModal.open}
        editing={scModal.editing}
        onClose={() => setScModal({ open: false, editing: null })}
      />
    </>
  );
}

function StagesTab({
  onNewStm,
  onEditStm,
  onNewSc,
  onEditSc,
}: {
  onNewStm: () => void;
  onEditStm: (a: ActivityConfig) => void;
  onNewSc: () => void;
  onEditSc: (a: StageConfig) => void;
}) {
  const { config, update } = useConfig();
  const navigate = useNavigate();

  const stmCols: Column<ActivityConfig>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (a) => (
        <a
          href={`/activities/stm/${a.id}`}
          onClick={(e) => {
            e.preventDefault();
            navigate(`/activities/stm/${a.id}`);
          }}
        >
          {a.name}
        </a>
      ),
    },
    { key: 'active', header: 'Active', width: '90px', render: (a) => (a.active ? <Badge tone="success">Yes</Badge> : <Badge>No</Badge>) },
    { key: 'effFrom', header: 'Effective From', width: '140px', render: (a) => a.effectiveFrom || '—' },
    { key: 'effTo', header: 'Effective To', width: '140px', render: (a) => a.effectiveTo || '—' },
    {
      key: 'actions',
      header: 'Actions',
      width: '120px',
      render: (a) => (
        <div style={{ display: 'inline-flex', gap: 4 }}>
          <Button variant="icon" aria-label="Edit" onClick={() => onEditStm(a)}>
            <Icon name="edit" />
          </Button>
          <Button
            variant="icon"
            aria-label="Delete"
            onClick={() => {
              if (!confirm(`Delete configuration "${a.name}"?`)) return;
              update((p) => ({ ...p, activityConfigs: p.activityConfigs.filter((x) => x.id !== a.id) }));
            }}
          >
            <Icon name="trash" />
          </Button>
        </div>
      ),
    },
  ];

  const scCols: Column<StageConfig>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (a) => (
        <a
          href={`/activities/lob/${a.id}`}
          onClick={(e) => {
            e.preventDefault();
            navigate(`/activities/lob/${a.id}`);
          }}
        >
          {a.name}
        </a>
      ),
    },
    { key: 'lob', header: 'Line of Business', render: (a) => a.recordType || '—' },
    { key: 'active', header: 'Active', width: '90px', render: (a) => (a.active ? <Badge tone="success">Yes</Badge> : <Badge>No</Badge>) },
    { key: 'effFrom', header: 'Effective From', width: '140px', render: (a) => a.effectiveFrom || '—' },
    { key: 'effTo', header: 'Effective To', width: '140px', render: (a) => a.effectiveTo || '—' },
    {
      key: 'actions',
      header: 'Actions',
      width: '120px',
      render: (a) => (
        <div style={{ display: 'inline-flex', gap: 4 }}>
          <Button variant="icon" aria-label="Edit" onClick={() => onEditSc(a)}>
            <Icon name="edit" />
          </Button>
          <Button
            variant="icon"
            aria-label="Delete"
            onClick={() => {
              if (!confirm(`Delete configuration "${a.name}"?`)) return;
              update((p) => ({ ...p, stageConfigs: p.stageConfigs.filter((x) => x.id !== a.id) }));
            }}
          >
            <Icon name="trash" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Card
        title="Submission Activity Configurations"
        subtitle={`${config.activityConfigs.length} configuration${config.activityConfigs.length === 1 ? '' : 's'}`}
        actions={
          <Button variant="brand" iconLeading={<Icon name="plus" size={14} />} onClick={onNewStm}>
            New
          </Button>
        }
        padding="none"
      >
        <Table<ActivityConfig>
          columns={stmCols}
          rows={config.activityConfigs}
          rowKey={(a) => a.id}
          empty="No submission configurations yet."
        />
      </Card>
      <Card
        title="Line Of Business Activity Configuration"
        subtitle={`${config.stageConfigs.length} configuration${config.stageConfigs.length === 1 ? '' : 's'}`}
        actions={
          <Button variant="brand" iconLeading={<Icon name="plus" size={14} />} onClick={onNewSc}>
            New
          </Button>
        }
        padding="none"
      >
        <Table<StageConfig>
          columns={scCols}
          rows={config.stageConfigs}
          rowKey={(a) => a.id}
          empty="No line of business configurations yet."
        />
      </Card>
    </div>
  );
}
