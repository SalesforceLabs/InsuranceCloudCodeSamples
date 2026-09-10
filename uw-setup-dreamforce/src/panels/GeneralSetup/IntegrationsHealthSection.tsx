import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Card, Table, type Column } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { ConnectionInstance } from '@/types/config';
import { PROVIDERS } from '@/panels/IntegrationHub/providers';
import './IntegrationsHealth.css';

/**
 * Integrations → Health.
 *
 * Top KPI strip + a Connection Health table with one row per live
 * connection instance. The right-hand Trend column renders a small
 * sparkline; values are deterministic per connection id so the demo
 * doesn't churn between renders.
 */
export function IntegrationsHealthSection() {
  const { config } = useConfig();
  const navigate = useNavigate();

  const instances = useMemo(
    () => (config.connectionInstances ?? []).slice().sort((a, b) => a.id - b.id),
    [config.connectionInstances],
  );

  const stats = useMemo(() => {
    const total = instances.length;
    const connected = instances.filter((c) => c.status === 'Connected').length;
    const avgLatency = (() => {
      const known = instances
        .map((c) => c.avgLatency)
        .filter((v): v is number => typeof v === 'number');
      if (known.length === 0) return 0;
      return Math.round(known.reduce((s, v) => s + v, 0) / known.length);
    })();
    const errors = instances.reduce((s, c) => s + (c.errors24h ?? 0), 0);
    const uptimePct = total > 0 ? Math.round((connected / total) * 100) : 0;
    return { total, connected, avgLatency, errors, uptimePct };
  }, [instances]);

  const columns: Column<ConnectionInstance>[] = [
    {
      key: 'connection',
      header: 'Connection',
      render: (c) => (
        <div className="ih-name">
          <ProviderTag providerId={c.providerId} />
          <a
            className="ih-link"
            href={`/general-setup/connection/${c.id}`}
            onClick={(e) => {
              e.preventDefault();
              navigate(`/general-setup/connection/${c.id}`);
            }}
          >
            {c.name}
          </a>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      render: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: 'latency',
      header: 'Avg Latency (24h)',
      width: '160px',
      render: (c) =>
        c.avgLatency != null ? `${c.avgLatency} ms` : <span className="ih-empty">—</span>,
    },
    {
      key: 'errors',
      header: 'Errors (24h)',
      width: '120px',
      render: (c) => `${c.errors24h ?? 0} errors`,
    },
    {
      key: 'lastChecked',
      header: 'Last Checked',
      width: '180px',
      render: (c) => c.lastTested ?? <span className="ih-empty">—</span>,
    },
  ];

  return (
    <div className="ih-section">
      <div className="ih-stats">
        <KpiCard
          value={`${stats.uptimePct}%`}
          label="Uptime (Connected)"
          tone="neutral"
        />
        <KpiCard
          value={`${stats.avgLatency} ms`}
          label="Avg Response Time"
          tone="neutral"
        />
        <KpiCard
          value={`${stats.errors}`}
          label="Errors (24h)"
          tone={stats.errors > 0 ? 'error' : 'success'}
        />
        <KpiCard
          value={`${stats.total}`}
          label="Total Connections"
          tone="neutral"
        />
      </div>

      <Card padding="none">
        <Table<ConnectionInstance>
          columns={columns}
          rows={instances}
          rowKey={(c) => c.id}
          empty="No connections to monitor yet."
        />
      </Card>
    </div>
  );
}

interface KpiProps {
  value: string;
  label: string;
  tone: 'neutral' | 'success' | 'warning' | 'error';
}
function KpiCard({ value, label, tone }: KpiProps) {
  return (
    <div className={`ih-kpi ih-kpi--${tone}`}>
      <div className={`ih-kpi__value ih-kpi__value--${tone}`}>{value}</div>
      <div className="ih-kpi__label">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'Connected') return <Badge tone="success">Connected</Badge>;
  if (status === 'Needs Attention') return <Badge tone="warning">Needs Attention</Badge>;
  return <Badge>Disconnected</Badge>;
}

function ProviderTag({ providerId }: { providerId?: string }) {
  const provider = PROVIDERS.find((p) => p.id === providerId);
  if (!provider) return null;
  return (
    <span
      className="ih-provider-tag"
      style={
        provider.fallbackColor
          ? { background: provider.fallbackColor, color: '#fff' }
          : undefined
      }
      aria-hidden="true"
      title={provider.name}
    >
      {provider.logo}
    </span>
  );
}

/** Tiny deterministic sparkline. Bars per row keyed off the connection
 * id, so the chart looks consistent across renders without any state. */
function Sparkline({ seed, healthy }: { seed: number; healthy: boolean }) {
  const bars = useMemo(() => generateBars(seed), [seed]);
  const max = Math.max(...bars);
  return (
    <svg viewBox={`0 0 ${bars.length * 4} 36`} className="ih-spark" aria-hidden="true">
      {bars.map((v, i) => {
        const h = Math.max(2, (v / max) * 32);
        return (
          <rect
            key={i}
            x={i * 4}
            y={36 - h}
            width={3}
            height={h}
            rx={1}
            fill={
              healthy
                ? 'var(--slds-g-color-success-1)'
                : 'var(--slds-g-color-error-1)'
            }
          />
        );
      })}
    </svg>
  );
}

function generateBars(seed: number): number[] {
  // Cheap LCG so each connection gets a stable but varied bar set.
  let s = seed * 9301 + 49297;
  const out: number[] = [];
  for (let i = 0; i < 32; i++) {
    s = (s * 1103515245 + 12345) % 2147483648;
    out.push((s % 80) + 10);
  }
  return out;
}
