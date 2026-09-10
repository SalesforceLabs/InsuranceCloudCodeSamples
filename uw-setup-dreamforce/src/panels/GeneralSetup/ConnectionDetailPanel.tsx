import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Table,
  type Column,
} from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { ConnectionInstance } from '@/types/config';
import { PROVIDERS, findServiceById } from '@/panels/IntegrationHub/providers';
import {
  ConnectionWizardModal,
  DataStreamsPanel,
  DccConnectionEditModal,
} from './ConnectWizardModal';
import './ConnectionDetail.css';

/**
 * Integration Hub → Connection detail page.
 *
 * Mirrors the LOB Stage Configuration pattern: eyebrow back link + tight
 * header + a stack of Cards. Sections, top to bottom:
 *   • General (base URL, auth, named credential, test endpoint, timeout,
 *     retries, circuit breaker, notes)
 *   • Health (Last 24 Hours) — 4 stat cards including a sparkline
 *   • Used By — table of references
 *   • Recent Activity — log table
 */
function goBack(navigate: ReturnType<typeof useNavigate>, fallback = '/general-setup') {
  if (window.history.length > 1) navigate(-1);
  else navigate(fallback);
}

export function ConnectionDetailPanel() {
  const { id } = useParams();
  const { config } = useConfig();
  const navigate = useNavigate();
  const instance = useMemo(
    () =>
      (config.connectionInstances ?? []).find((c) => String(c.id) === id) ??
      null,
    [config.connectionInstances, id],
  );

  if (!instance) {
    return (
      <EmptyState
        title="Connection not found"
        action={
          <Button variant="neutral" onClick={() => goBack(navigate)}>
            Back
          </Button>
        }
      />
    );
  }

  return <Detail instance={instance} />;
}

function Detail({ instance }: { instance: ConnectionInstance }) {
  const navigate = useNavigate();
  const { config, update } = useConfig();
  const [editing, setEditing] = useState(false);
  const provider = PROVIDERS.find((p) => p.id === instance.providerId);
  const resolved = findServiceById(instance.serviceId);
  const service = resolved?.service;
  const isDcc = service?.type === 'Data Cloud Connector';
  // Credentials + transport live on the bound Authentication; fall back to
  // the instance's own fields for pre-split legacy connections.
  const auth = (config.authentications ?? []).find(
    (a) => a.id === instance.authId,
  );
  const baseUrl = auth?.baseUrl ?? instance.baseUrl;
  const authType = auth?.authType ?? instance.authType;
  const testEndpoint = auth?.testEndpoint ?? instance.testEndpoint;
  const credentials = auth?.credentials ?? instance.credentials;
  const timeoutMs = auth?.timeoutMs ?? instance.timeoutMs;
  const maxRetries = auth?.maxRetries ?? instance.maxRetries;
  const enabledEndpoints = useMemo(() => {
    if (!service) return [];
    const ids = instance.enabledEndpointIds;
    return service.endpoints.filter((e) => !ids || ids.includes(e.id));
  }, [service, instance.enabledEndpointIds]);
  const namedCredential =
    credentials?.namedCredential ||
    (credentials && Object.keys(credentials).length > 0
      ? Object.values(credentials)[0]?.toString().slice(0, 16)
      : '') ||
    '—';
  const isConnected = instance.status === 'Connected';

  const onDisconnect = () => {
    if (!confirm(`Delete connection "${instance.name}"?`)) return;
    update((p) => ({
      ...p,
      connectionInstances: (p.connectionInstances ?? []).filter(
        (x) => x.id !== instance.id,
      ),
    }));
    goBack(navigate);
  };

  return (
    <div className="cd-page">
      {/* Eyebrow back link — mirrors the screenshot's "< INTEGRATION HUB". */}
      <button
        type="button"
        className="cd-eyebrow"
        onClick={() => goBack(navigate)}
      >
        <Icon name="chevron-left" size={12} />
        <span>BACK</span>
      </button>

      <header className="cd-header">
        <div className="cd-header__title-block">
          {provider && (
            <span
              className="cd-provider-logo"
              style={
                provider.fallbackColor
                  ? { background: provider.fallbackColor, color: '#fff' }
                  : undefined
              }
              aria-hidden="true"
            >
              {provider.logoUrl ? (
                <img src={provider.logoUrl} alt="" loading="lazy" />
              ) : (
                provider.logo
              )}
            </span>
          )}
          <h1 className="cd-header__title">{instance.name}</h1>
          <span className="cd-status">
            <span
              className={`cd-status__dot cd-status__dot--${
                isConnected
                  ? 'connected'
                  : instance.status === 'Needs Attention'
                    ? 'warn'
                    : 'off'
              }`}
            />
            {instance.status}
          </span>
        </div>
        <div className="cd-header__actions">
          <Button
            variant="neutral"
            iconLeading={<Icon name="edit" size={14} />}
            onClick={() => setEditing(true)}
          >
            Edit Connection
          </Button>
          <Button variant="destructive" onClick={onDisconnect}>
            Disconnect
          </Button>
        </div>
      </header>

      {isDcc ? (
        <>
          <Card className="cd-card" title="General" padding="md">
            <dl className="cd-grid">
              <Field label="Name" value={instance.name} />
              <Field
                label="Developer Name"
                mono
                value={instance.developerName || '—'}
              />
              <Field label="Data Space" value={instance.dataspace || '—'} />
              <Field label="Usage Type" value={instance.usageType || '—'} />
              <Field
                label="Data Categories"
                value={
                  instance.categories && instance.categories.length > 0 ? (
                    <span className="cd-cats">
                      {instance.categories.map((c) => (
                        <Badge key={c}>{c}</Badge>
                      ))}
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
            </dl>
          </Card>

          <Card className="cd-card" title="Data Kit" padding="md">
            <DataStreamsPanel showSyncStatus />
          </Card>
        </>
      ) : (
        <>
          <Card className="cd-card" title="General" padding="md">
            <dl className="cd-grid">
              <Field
                label="Service"
                value={
                  service
                    ? `${resolved?.provider.name} · ${service.name}`
                    : instance.name
                }
              />
              <Field label="Base URL" mono value={baseUrl} />
              <Field label="Usage Type" value={instance.usageType || '—'} />
              <Field
                label="Data Categories"
                value={
                  instance.categories && instance.categories.length > 0 ? (
                    <span className="cd-cats">
                      {instance.categories.map((c) => (
                        <Badge key={c}>{c}</Badge>
                      ))}
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
              <Field label="Auth Type" value={String(authType)} />
              <Field label="Authentication" value={auth?.name ?? namedCredential} />
              <Field label="Named Credential" mono value={namedCredential} />
              <Field label="Test Endpoint" mono value={testEndpoint || '—'} />
              <Field label="Timeout" value={`${timeoutMs ?? 5000} ms`} />
              <Field label="Max Retries" value={`${maxRetries ?? 3}`} />
              <Field
                label="Circuit Breaker"
                value={
                  <Badge tone={isConnected ? 'success' : 'neutral'}>
                    {isConnected ? 'Closed' : 'Open'}
                  </Badge>
                }
              />
            </dl>
          </Card>

          {enabledEndpoints.length > 0 && (
            <Card
              className="cd-card"
              title={`Endpoints (${enabledEndpoints.length})`}
              padding="md"
            >
              <ul className="cd-endpoints">
                {enabledEndpoints.map((ep) => (
                  <li key={ep.id} className="cd-endpoint">
                    <span
                      className={`cw-method cw-method--${ep.method.toLowerCase()}`}
                    >
                      {ep.method}
                    </span>
                    <span className="cd-endpoint__name">{ep.name}</span>
                    <code className="cd-mono cd-endpoint__path">
                      {baseUrl}
                      {ep.path}
                    </code>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      <Card className="cd-card" title="Health (Last 24 Hours)" padding="md">
        <div className="cd-health">
          <HealthStat
            tone="success"
            value={`${instance.avgLatency ?? '—'}`}
            unit="ms"
            label="Avg Latency"
          />
          <HealthStat
            tone="success"
            value={`${instance.errors24h ?? 0}`}
            label="Errors"
          />
          <HealthStat
            tone="neutral"
            value={`${instance.totalCalls24h ?? 0}`}
            label="Total Calls"
          />
          <div className="cd-health__stat cd-health__stat--chart">
            <Sparkline />
            <div className="cd-health__label">Latency Trend</div>
          </div>
        </div>
      </Card>

      <Card
        className="cd-card"
        title={`Used By (${USED_BY.length} reference${USED_BY.length === 1 ? '' : 's'})`}
        padding="none"
      >
        <Table<UsedByRow>
          columns={USED_BY_COLUMNS}
          rows={USED_BY}
          rowKey={(r) => r.id}
          empty="Not referenced anywhere yet."
        />
      </Card>

      <Card className="cd-card" title="Recent Activity" padding="none">
        <Table<ActivityRow>
          columns={RECENT_COLUMNS}
          rows={RECENT_ACTIVITY}
          rowKey={(r) => r.id}
          empty="No recent activity."
        />
      </Card>

      {isDcc ? (
        <DccConnectionEditModal
          open={editing}
          connection={instance}
          onClose={() => setEditing(false)}
        />
      ) : (
        <ConnectionWizardModal
          open={editing}
          existingConnection={instance}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

interface FieldProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}
function Field({ label, value, mono }: FieldProps) {
  return (
    <div className="cd-field">
      <dt>{label}</dt>
      <dd className={mono ? 'cd-field__mono' : ''}>{value}</dd>
    </div>
  );
}

interface HealthStatProps {
  tone: 'success' | 'neutral' | 'error';
  value: string;
  unit?: string;
  label: string;
}
function HealthStat({ tone, value, unit, label }: HealthStatProps) {
  return (
    <div className={`cd-health__stat cd-health__stat--${tone}`}>
      <div className="cd-health__value">
        <span className="cd-health__num">{value}</span>
        {unit && <span className="cd-health__unit">{unit}</span>}
      </div>
      <div className="cd-health__label">{label}</div>
    </div>
  );
}

/** Demo sparkline — 24 bars representing latency over 24 hours. */
function Sparkline() {
  const bars = SPARKLINE_BARS;
  const max = Math.max(...bars);
  return (
    <svg viewBox={`0 0 ${bars.length * 6} 60`} className="cd-sparkline" aria-hidden="true">
      {bars.map((v, i) => {
        const h = Math.max(2, (v / max) * 56);
        return (
          <rect
            key={i}
            x={i * 6}
            y={60 - h}
            width={4}
            height={h}
            rx={1}
            fill="var(--slds-g-color-accent-1)"
          />
        );
      })}
    </svg>
  );
}

const SPARKLINE_BARS = [
  18, 22, 14, 30, 26, 20, 24, 33, 41, 28, 35, 39, 22, 18, 15, 27, 31, 24, 38,
  44, 26, 19, 23, 30,
];

interface UsedByRow {
  id: string;
  activity: string;
  stage: string;
  usage: string;
}
const USED_BY: UsedByRow[] = [
  { id: 'a', activity: 'Company Lookup', stage: 'Enrichment', usage: 'Engine' },
  { id: 'b', activity: 'Credit Check', stage: 'Enrichment', usage: 'Engine' },
];
const USED_BY_COLUMNS: Column<UsedByRow>[] = [
  { key: 'activity', header: 'Activity Name', render: (r) => r.activity },
  {
    key: 'stage',
    header: 'Stage',
    render: (r) => <a className="cd-link">{r.stage}</a>,
  },
  { key: 'usage', header: 'Usage Type', render: (r) => r.usage },
];

interface ActivityRow {
  id: string;
  time: string;
  status: string;
  ok: boolean;
  latency: string;
  caller: string;
  endpoint: string;
}
const RECENT_ACTIVITY: ActivityRow[] = [
  { id: '1', time: '09:14:22', status: '200', ok: true, latency: '234 ms', caller: 'Engine', endpoint: 'GET /v1/match' },
  { id: '2', time: '09:13:58', status: '200', ok: true, latency: '198 ms', caller: 'Engine', endpoint: 'GET /v1/data/company' },
  { id: '3', time: '09:12:04', status: '200', ok: true, latency: '267 ms', caller: 'Engine', endpoint: 'GET /v1/match' },
  { id: '4', time: '09:10:31', status: '200', ok: true, latency: '212 ms', caller: 'Engine', endpoint: 'POST /v1/search' },
  { id: '5', time: '08:55:12', status: '429', ok: false, latency: '45 ms', caller: 'Engine', endpoint: 'GET /v1/match' },
];
const RECENT_COLUMNS: Column<ActivityRow>[] = [
  { key: 'time', header: 'Time', render: (r) => r.time, width: '110px' },
  {
    key: 'status',
    header: 'Status',
    width: '110px',
    render: (r) => (
      <span
        className={`cd-status-pill cd-status-pill--${r.ok ? 'ok' : 'bad'}`}
      >
        <Icon name={r.ok ? 'check' : 'close'} size={12} />
        {r.status}
      </span>
    ),
  },
  { key: 'latency', header: 'Latency', render: (r) => r.latency, width: '110px' },
  {
    key: 'caller',
    header: 'Caller',
    width: '120px',
    render: (r) => <a className="cd-link">{r.caller}</a>,
  },
  {
    key: 'endpoint',
    header: 'Endpoint',
    render: (r) => <code className="cd-mono">{r.endpoint}</code>,
  },
];
