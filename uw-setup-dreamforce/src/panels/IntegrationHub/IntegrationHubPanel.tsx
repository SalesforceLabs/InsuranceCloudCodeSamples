import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Input,
  PageHeader,
  Table,
  Tabs,
  type Column,
} from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { Connection } from '@/types/config';
import {
  PROVIDERS,
  type Provider,
} from './providers';
import { ConnectionModal } from './ConnectionModal';

type Tab = 'procedures' | 'connections' | 'providers' | 'health';

export function IntegrationHubPanel() {
  const [tab, setTab] = useState<Tab>('connections');
  const [modal, setModal] = useState<{ open: boolean; editing: Connection | null }>({
    open: false,
    editing: null,
  });

  return (
    <>
      <PageHeader
        title="Integration Hub"
        icon={<Icon name="plug" size={20} />}
        subtitle="Manage external integrations, connections, providers, and health."
      />
      <Tabs
        items={[
          { id: 'procedures', label: 'Integration Procedures' },
          { id: 'connections', label: 'Connections' },
          { id: 'providers', label: 'Provider Catalog' },
          { id: 'health', label: 'Health Dashboard' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as Tab)}
      />
      <div style={{ marginTop: 16 }}>
        {tab === 'procedures' && <ProceduresTab />}
        {tab === 'connections' && (
          <ConnectionsTab
            onNew={() => setModal({ open: true, editing: null })}
            onEdit={(c) => setModal({ open: true, editing: c })}
          />
        )}
        {tab === 'providers' && <ProvidersTab onAdd={(p) => setModal({ open: true, editing: providerToConnection(p) })} />}
        {tab === 'health' && <HealthTab />}
      </div>
      <ConnectionModal
        open={modal.open}
        editing={modal.editing}
        onClose={() => setModal({ open: false, editing: null })}
      />
    </>
  );
}

function providerToConnection(p: Provider): Connection {
  return {
    id: 0,
    name: p.name,
    authType: 'API Key',
    baseUrl: '',
    status: 'Disconnected',
    providerId: p.id,
    description: p.description,
  };
}

function ProceduresTab() {
  return (
    <Card padding="md">
      <EmptyState
        icon={<Icon name="flow" size={20} />}
        title="No Integration Procedures"
        description="Define orchestration procedures that combine multiple connections into a single callable flow."
        action={
          <Button variant="brand" iconLeading={<Icon name="plus" size={14} />} disabled>
            New Procedure
          </Button>
        }
      />
    </Card>
  );
}

function ConnectionsTab({
  onNew,
  onEdit,
}: {
  onNew: () => void;
  onEdit: (c: Connection) => void;
}) {
  const { config, update } = useConfig();
  const navigate = useNavigate();
  const conns = config.connections;

  const stats = useMemo(
    () => ({
      total: conns.length,
      connected: conns.filter((c) => c.status === 'Connected').length,
      attention: conns.filter((c) => c.status === 'Needs Attention').length,
      disconnected: conns.filter((c) => c.status === 'Disconnected').length,
    }),
    [conns],
  );

  const columns: Column<Connection>[] = [
    {
      key: 'name',
      header: 'Connection',
      render: (c) => (
        <a
          href={`/integration-hub/connection/${c.id}`}
          onClick={(e) => {
            e.preventDefault();
            navigate(`/integration-hub/connection/${c.id}`);
          }}
        >
          {c.name}
        </a>
      ),
    },
    { key: 'auth', header: 'Auth Type', render: (c) => c.authType },
    { key: 'url', header: 'Base URL', render: (c) => <code>{c.baseUrl || '—'}</code> },
    {
      key: 'status',
      header: 'Status',
      render: (c) => statusBadge(c.status),
    },
    { key: 'latency', header: 'Avg Latency', render: (c) => (c.avgLatency ? `${c.avgLatency} ms` : '—') },
    { key: 'tested', header: 'Last Tested', render: (c) => c.lastTested || '—' },
    {
      key: 'actions',
      header: 'Actions',
      width: '120px',
      render: (c) => (
        <div style={{ display: 'inline-flex', gap: 4 }}>
          <Button variant="icon" aria-label="Edit" onClick={() => onEdit(c)}>
            <Icon name="edit" />
          </Button>
          <Button
            variant="icon"
            aria-label="Delete"
            onClick={() => {
              if (!confirm(`Delete connection "${c.name}"?`)) return;
              update((p) => ({ ...p, connections: p.connections.filter((x) => x.id !== c.id) }));
            }}
          >
            <Icon name="trash" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
        <StatCard label="Total Connections" value={stats.total} />
        <StatCard label="Connected" value={stats.connected} tone="success" />
        <StatCard label="Needs Attention" value={stats.attention} tone="warning" />
        <StatCard label="Disconnected" value={stats.disconnected} tone="error" />
      </div>
      <Card
        title="Connections"
        subtitle={`${conns.length} configured`}
        actions={
          <Button variant="brand" iconLeading={<Icon name="plus" size={14} />} onClick={onNew}>
            Add Connection
          </Button>
        }
        padding="none"
      >
        <Table<Connection>
          columns={columns}
          rows={conns}
          rowKey={(c) => c.id}
          empty="No connections configured yet."
        />
      </Card>
    </>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'warning' | 'error' }) {
  const color =
    tone === 'success'
      ? 'var(--slds-g-color-success-1)'
      : tone === 'warning'
        ? 'var(--slds-g-color-warning-1)'
        : tone === 'error'
          ? 'var(--slds-g-color-error-1)'
          : 'var(--slds-g-color-on-surface-1)';
  return (
    <Card padding="md">
      <div style={{ fontSize: 12, color: 'var(--slds-g-color-on-surface-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 600, color, marginTop: 8 }}>{value}</div>
    </Card>
  );
}

function ProvidersTab({ onAdd }: { onAdd: (p: Provider) => void }) {
  const [q, setQ] = useState('');

  const filtered = PROVIDERS.filter((p) => {
    if (q && !`${p.name} ${p.description}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16, marginBottom: 16 }}>
        <div style={{ width: 280 }}>
          <Input
            placeholder="Search providers"
            iconLeading={<Icon name="search" />}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            fullWidth
          />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {filtered.map((p) => (
          <Card key={p.id} padding="md">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: 'var(--slds-g-color-palette-cloud-blue-95)',
                  color: 'var(--slds-g-color-accent-3)',
                  fontWeight: 700,
                  fontSize: 13,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {p.logo}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{p.name}</div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--slds-g-color-on-surface-2)', margin: '12px 0 16px' }}>{p.description}</p>
            <Button variant="neutral" fullWidth onClick={() => onAdd(p)}>
              Add Connection
            </Button>
          </Card>
        ))}
      </div>
    </>
  );
}

function HealthTab() {
  const { config } = useConfig();
  const conns = config.connections;
  const avgLatency = conns.length
    ? Math.round(conns.reduce((sum, c) => sum + (c.avgLatency || 0), 0) / conns.length)
    : 0;
  const errors = conns.reduce((s, c) => s + (c.errors24h || 0), 0);
  const connectedPct = conns.length
    ? Math.round((conns.filter((c) => c.status === 'Connected').length / conns.length) * 100)
    : 0;

  const cols: Column<Connection>[] = [
    { key: 'name', header: 'Connection', render: (c) => c.name },
    { key: 'status', header: 'Status', render: (c) => statusBadge(c.status) },
    { key: 'latency', header: 'Latency', render: (c) => (c.avgLatency ? `${c.avgLatency} ms` : '—') },
    { key: 'errors', header: 'Errors (24h)', render: (c) => c.errors24h ?? 0 },
    { key: 'tested', header: 'Last Checked', render: (c) => c.lastTested || '—' },
  ];

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
        <StatCard label="Uptime (Connected)" value={connectedPct} />
        <StatCard label="Avg Response Time (ms)" value={avgLatency} />
        <StatCard label="Errors (24h)" value={errors} tone={errors > 0 ? 'error' : undefined} />
        <StatCard label="Total Connections" value={conns.length} />
      </div>
      <Card title="Connection Health" padding="none">
        <Table<Connection> columns={cols} rows={conns} rowKey={(c) => c.id} empty="No connections to monitor." />
      </Card>
    </>
  );
}

function statusBadge(s: string) {
  if (s === 'Connected') return <Badge tone="success">Connected</Badge>;
  if (s === 'Needs Attention') return <Badge tone="warning">Needs Attention</Badge>;
  return <Badge tone="error">Disconnected</Badge>;
}
