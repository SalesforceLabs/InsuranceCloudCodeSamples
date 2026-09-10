import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, Icon, PageHeader } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';

export function ConnectionDetailPanel() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { config, update } = useConfig();
  const conn = config.connections.find((c) => String(c.id) === id);

  if (!conn)
    return (
      <EmptyState
        title="Connection not found"
        action={<Button variant="neutral" onClick={() => navigate('/integration-hub')}>Back</Button>}
      />
    );

  const tone =
    conn.status === 'Connected'
      ? 'success'
      : conn.status === 'Needs Attention'
        ? 'warning'
        : 'error';

  return (
    <>
      <Button variant="link" iconLeading={<Icon name="arrow-left" size={14} />} onClick={() => navigate(-1)}>
        Back
      </Button>
      <div style={{ height: 12 }} />
      <PageHeader
        eyebrow="Connection"
        title={conn.name}
        subtitle={conn.description}
        icon={<Icon name="plug" size={20} />}
        actions={
          <>
            <Button variant="neutral">Test Connection</Button>
            <Button variant="neutral">Update Credentials</Button>
            <Button
              variant="destructive"
              onClick={() => {
                update((p) => ({
                  ...p,
                  connections: p.connections.map((c) =>
                    c.id === conn.id ? { ...c, status: 'Disconnected' } : c,
                  ),
                }));
              }}
            >
              Deactivate
            </Button>
          </>
        }
      />

      <Card title="General" padding="md" className="slds2-stack-mb">
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, margin: 0 }}>
          <Field label="Status">
            <Badge tone={tone}>{conn.status}</Badge>
          </Field>
          <Field label="Auth Type">{conn.authType}</Field>
          <Field label="Base URL">
            <code>{conn.baseUrl || '—'}</code>
          </Field>
          <Field label="Avg Latency">{conn.avgLatency ? `${conn.avgLatency} ms` : '—'}</Field>
          <Field label="Errors (24h)">{conn.errors24h ?? 0}</Field>
          <Field label="Last Tested">{conn.lastTested || '—'}</Field>
        </dl>
      </Card>

      <div style={{ height: 16 }} />

      <Card title="Health (Last 24 Hours)" padding="md">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <Stat label="Avg Latency" value={conn.avgLatency ? `${conn.avgLatency} ms` : '—'} />
          <Stat label="Errors" value={String(conn.errors24h ?? 0)} />
          <Stat label="Total Calls" value={String(conn.totalCalls24h ?? 0)} />
        </div>
      </Card>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt style={{ fontSize: 12, color: 'var(--slds-g-color-on-surface-2)', marginBottom: 4 }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: 14 }}>{children}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 16, borderRadius: 8, background: 'var(--slds-g-color-surface-2)' }}>
      <div style={{ fontSize: 12, color: 'var(--slds-g-color-on-surface-2)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>{value}</div>
    </div>
  );
}
