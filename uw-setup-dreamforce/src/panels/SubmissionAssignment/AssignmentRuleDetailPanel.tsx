import { useNavigate, useParams } from 'react-router-dom';
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
import type { AssignmentRuleEntry } from '@/types/config';

export function AssignmentRuleDetailPanel() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { config, update } = useConfig();
  const rule = config.assignmentRules.find((r) => String(r.id) === id);

  if (!rule)
    return (
      <EmptyState
        title="Rule not found"
        action={<Button variant="neutral" onClick={() => navigate('/submission-assignment')}>Back</Button>}
      />
    );

  const entries = rule.entries ?? [];

  const cols: Column<AssignmentRuleEntry>[] = [
    { key: 'order', header: 'Sort', width: '70px', render: (e) => e.sortOrder },
    {
      key: 'criteria',
      header: 'Criteria',
      render: (e) =>
        e.criteria.length > 0
          ? e.criteria.map((c) => `${c.field} ${c.operator} ${c.value}`).join(' AND ')
          : '—',
    },
    { key: 'user', header: 'Assigned To', render: (e) => e.user || '—' },
    {
      key: 'actions',
      header: 'Actions',
      width: '90px',
      render: (e) => (
        <Button
          variant="icon"
          aria-label="Delete"
          onClick={() => {
            update((p) => ({
              ...p,
              assignmentRules: p.assignmentRules.map((r) =>
                r.id === rule.id ? { ...r, entries: (r.entries ?? []).filter((x) => x.id !== e.id) } : r,
              ),
            }));
          }}
        >
          <Icon name="trash" />
        </Button>
      ),
    },
  ];

  return (
    <>
      <Button
        variant="link"
        iconLeading={<Icon name="arrow-left" size={14} />}
        onClick={() => navigate(-1)}
      >
        Back
      </Button>
      <div style={{ height: 12 }} />
      <PageHeader
        eyebrow="Submission Assignment Rule"
        title={rule.name}
        icon={<Icon name="users" size={20} />}
        actions={<Badge tone={rule.active ? 'success' : 'neutral'}>{rule.active ? 'Active' : 'Inactive'}</Badge>}
      />
      <Card title="Rule Detail" padding="md" className="slds2-stack-mb">
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, margin: 0 }}>
          <DField label="Rule Name">{rule.name}</DField>
          <DField label="Active">{rule.active ? 'Yes' : 'No'}</DField>
          <DField label="Created By">{rule.createdBy ?? '—'}</DField>
          <DField label="Created On">{rule.createdOn ?? '—'}</DField>
        </dl>
      </Card>
      <div style={{ height: 16 }} />
      <Card
        title="Rule Entries"
        subtitle={`${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`}
        actions={
          <Button
            variant="brand"
            iconLeading={<Icon name="plus" size={14} />}
            onClick={() => navigate(`/submission-assignment/${rule.id}/entry/new`)}
          >
            New Entry
          </Button>
        }
        padding="none"
      >
        <Table<AssignmentRuleEntry>
          columns={cols}
          rows={entries}
          rowKey={(e) => e.id}
          empty="No rule entries specified."
        />
      </Card>
    </>
  );
}

function DField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt style={{ fontSize: 12, color: 'var(--slds-g-color-on-surface-2)', marginBottom: 4 }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: 14 }}>{children}</dd>
    </div>
  );
}
