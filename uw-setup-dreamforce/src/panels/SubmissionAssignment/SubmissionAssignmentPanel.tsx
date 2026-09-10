import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Icon,
  Input,
  Modal,
  PageHeader,
  Table,
  type Column,
} from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { AssignmentRule } from '@/types/config';

export function SubmissionAssignmentPanel() {
  const { config, update } = useConfig();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [active, setActive] = useState(false);

  const cols: Column<AssignmentRule>[] = [
    {
      key: 'name',
      header: 'Rule Name',
      render: (r) => (
        <a
          href={`/submission-assignment/${r.id}`}
          onClick={(e) => {
            e.preventDefault();
            navigate(`/submission-assignment/${r.id}`);
          }}
        >
          {r.name}
        </a>
      ),
    },
    {
      key: 'active',
      header: 'Active',
      width: '90px',
      render: (r) => (r.active ? <Badge tone="success">Yes</Badge> : <Badge>No</Badge>),
    },
    { key: 'created', header: 'Created By', render: (r) => r.createdBy ?? '—' },
    { key: 'createdOn', header: 'Created On', render: (r) => r.createdOn ?? '—' },
    {
      key: 'actions',
      header: 'Actions',
      width: '90px',
      render: (r) => (
        <Button
          variant="icon"
          aria-label="Delete"
          onClick={() => {
            if (!confirm(`Delete rule "${r.name}"?`)) return;
            update((p) => ({ ...p, assignmentRules: p.assignmentRules.filter((x) => x.id !== r.id) }));
          }}
        >
          <Icon name="trash" />
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Setup"
        title="Submission Assignment Rules"
        icon={<Icon name="users" size={20} />}
        subtitle="Automatically route submissions to users or queues based on criteria."
      />
      <Card
        title="All Rules"
        subtitle={`${config.assignmentRules.length} defined`}
        actions={
          <Button variant="brand" iconLeading={<Icon name="plus" size={14} />} onClick={() => setOpen(true)}>
            New Rule
          </Button>
        }
        padding="none"
      >
        <Table<AssignmentRule>
          columns={cols}
          rows={config.assignmentRules}
          rowKey={(r) => r.id}
          empty="No rules defined yet."
        />
      </Card>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New Assignment Rule"
        footer={
          <>
            <Button variant="neutral" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              disabled={!name.trim()}
              onClick={() => {
                update((p) => ({
                  ...p,
                  assignmentRules: [
                    ...p.assignmentRules,
                    {
                      id: p.nextAssignmentRuleId,
                      name: name.trim(),
                      active,
                      createdBy: 'Admin User',
                      createdOn: new Date().toLocaleString(),
                      entries: [],
                    },
                  ],
                  nextAssignmentRuleId: p.nextAssignmentRuleId + 1,
                }));
                setName('');
                setActive(false);
                setOpen(false);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input label="Rule Name" required value={name} onChange={(e) => setName(e.target.value)} />
          <Checkbox label="Active" checked={active} onChange={(e) => setActive(e.target.checked)} />
        </div>
      </Modal>
    </>
  );
}
