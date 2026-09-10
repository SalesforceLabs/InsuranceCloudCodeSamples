import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Dropdown, DuelingPicklist, Icon, Input, Modal, Textarea } from '@/components/ui';
import type { IconName } from '@/components/ui/Icon';
import { useConfig } from '@/data/ConfigContext';
import type {
  AuthType,
  Authentication,
  ConnectionHeader,
  ConnectionInstance,
  ConnectionUsageType,
} from '@/types/config';
import { CONNECTION_USAGE_TYPES } from '@/types/config';
import {
  CATEGORIES,
  PROVIDERS,
  findServiceById,
  type JsonSchema,
  type Provider,
  type ProviderCategory,
  type ProviderService,
  type ServiceEndpoint,
} from '@/panels/IntegrationHub/providers';
import { ServiceReferenceView } from './IntegrationsCatalogSection';
import './ConnectWizard.css';
import './IntegrationsCatalog.css';

/** A service to authenticate against, identified by provider + service id. */
export interface ServiceSelection {
  providerId: string;
  serviceId: string;
}

/* ─────────────────────────────────────────────────────────────────────
 * The integrations flow is split in two:
 *
 *   Flow 1 · AuthWizardModal        — authenticate to a service. View the
 *                                     contract, enter credentials, test.
 *                                     On success it hands off to Flow 2.
 *   Flow 2 · ConnectionWizardModal  — with a service already authenticated,
 *                                     pick + test individual endpoints and
 *                                     save a Connection bound to the auth.
 *
 * Flow 2 can run independently (Add Connection on an authenticated service,
 * or from the Connections list) without re-running Flow 1.
 * ──────────────────────────────────────────────────────────────────── */

interface CredentialField {
  key: string;
  label: string;
  type?: 'text' | 'password';
  placeholder?: string;
  hint?: string;
}

function fieldsFor(authType: string | AuthType): CredentialField[] {
  switch (authType) {
    case 'OAuth 2.0':
      return [
        { key: 'clientId', label: 'Client ID', placeholder: 'e.g. abc123-client' },
        {
          key: 'clientSecret',
          label: 'Client Secret',
          type: 'password',
          placeholder: 'Paste your client secret',
        },
        {
          key: 'tokenUrl',
          label: 'Token URL',
          placeholder: 'https://provider.com/oauth/token',
          hint: 'OAuth 2.0 token endpoint used to mint access tokens.',
        },
        { key: 'scope', label: 'Scope (optional)', placeholder: 'read write' },
      ];
    case 'API Key':
      return [
        {
          key: 'apiKey',
          label: 'API Key',
          type: 'password',
          placeholder: 'Paste your API key',
          hint: 'Sent on the header named in the service contract.',
        },
      ];
    case 'Basic Auth':
      return [
        { key: 'username', label: 'Username', placeholder: 'svc-account' },
        {
          key: 'password',
          label: 'Password',
          type: 'password',
          placeholder: 'Account password',
        },
      ];
    case 'JWT':
      return [
        {
          key: 'jwt',
          label: 'JWT',
          type: 'password',
          placeholder: 'Paste a signed JWT',
          hint: 'A signed JWT will be sent on the Authorization header.',
        },
      ];
    case 'None':
    default:
      return [];
  }
}

/** Coerce a numeric input string to a number, falling back when blank/NaN. */
function parseNumeric(v: string, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function nowStamp(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

/** Salesforce-style developer name: alnum + underscores, no leading digit. */
function toDevName(label: string): string {
  const base = label
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, '_$1');
  return base || 'Connection';
}

/* Data Cloud Connector data-stream categories — mirrors the P2P endpoints
 * preview (left list + right detail). Detail content is a placeholder. */
const DATA_STREAM_GROUPS = [
  'Data Stream Bundles',
  'Data Lake Objects',
  'Data Transforms',
] as const;

export function DataStreamsPanel({ showSyncStatus = false }: { showSyncStatus?: boolean }) {
  const [active, setActive] = useState<string>(DATA_STREAM_GROUPS[0]);
  return (
    <div className="cw-contract">
      <div
        className="cw-contract__title"
        style={
          showSyncStatus
            ? { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
            : undefined
        }
      >
        <span>Data Kit</span>
        {showSyncStatus && (
          <Button
            variant="neutral"
            size="sm"
            iconLeading={<Icon name="refresh" size={13} />}
          >
            Sync Status
          </Button>
        )}
      </div>
      <div className="cw-vtabs">
        <div className="cw-vtabs__list" role="tablist" aria-orientation="vertical">
          {DATA_STREAM_GROUPS.map((g) => (
            <div
              key={g}
              className={`cw-vtab${active === g ? ' cw-vtab--active' : ''}`}
            >
              <button
                type="button"
                className="cw-vtab__btn"
                role="tab"
                aria-selected={active === g}
                onClick={() => setActive(g)}
              >
                <span className="cw-vtab__name">{g}</span>
              </button>
            </div>
          ))}
        </div>
        <div className="cw-vpane" role="tabpanel">
          <p className="cw-contract__notes">{active} details go here</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * Flow 1 · Authentication wizard
 * ═════════════════════════════════════════════════════════════════ */

interface AuthWizardProps {
  open: boolean;
  /** Service to authenticate to. Required unless editing an existing auth. */
  service?: ServiceSelection | null;
  /** Existing authentication opened for edit / re-authentication. */
  existingAuth?: Authentication | null;
  onClose: () => void;
  /** Called after a successful save with the saved authentication id — the
   * catalog uses this to hand off into the Connection wizard. */
  onAuthenticated?: (authId: number) => void;
}

type AuthStep = 0 | 1 | 2;

export function AuthWizardModal({
  open,
  service,
  existingAuth,
  onClose,
  onAuthenticated,
}: AuthWizardProps) {
  const { config, update } = useConfig();

  const serviceId = existingAuth?.serviceId ?? service?.serviceId ?? '';
  const resolved = useMemo(() => findServiceById(serviceId), [serviceId]);
  const activeProvider = resolved?.provider;
  const activeService = resolved?.service;

  const [step, setStep] = useState<AuthStep>(0);
  const [activeEndpointId, setActiveEndpointId] = useState<string>('');
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [headers, setHeaders] = useState<ConnectionHeader[]>([]);
  const [timeoutMs, setTimeoutMs] = useState('5000');
  const [maxRetries, setMaxRetries] = useState('3');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    { ok: boolean; latency: number; message: string } | null
  >(null);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setActiveEndpointId(activeService?.endpoints[0]?.id ?? '');
    setTesting(false);
    setTestResult(null);
    if (existingAuth) {
      setCreds(existingAuth.credentials ?? {});
      setHeaders(existingAuth.headers ?? activeService?.defaultHeaders ?? []);
      setTimeoutMs(String(existingAuth.timeoutMs ?? 5000));
      setMaxRetries(String(existingAuth.maxRetries ?? 3));
    } else {
      setCreds({});
      setHeaders(activeService?.defaultHeaders?.map((h) => ({ ...h })) ?? []);
      setTimeoutMs('5000');
      setMaxRetries('3');
    }
  }, [open, existingAuth?.id, serviceId]);

  const authType = activeService?.authType ?? 'API Key';
  const fields = useMemo(() => fieldsFor(authType), [authType]);
  const credsValid = useMemo(() => {
    if (authType === 'None') return true;
    return fields.every(
      (f) => f.key === 'scope' || (creds[f.key]?.trim().length ?? 0) > 0,
    );
  }, [authType, fields, creds]);

  const runTest = () => {
    setTesting(true);
    setTestResult(null);
    window.setTimeout(() => {
      const latency = 120 + Math.floor(Math.random() * 280);
      const ok = Math.random() > 0.1;
      const url = `${activeService?.baseUrl ?? ''}${activeService?.testEndpoint ?? ''}`;
      setTestResult({
        ok,
        latency,
        message: ok
          ? `${url} authenticated in ${latency} ms.`
          : 'Authentication failed. Check the credentials and try again.',
      });
      setTesting(false);
    }, 500);
  };

  const onSave = (launchConnection: boolean) => {
    if (!activeService || !activeProvider) return;
    const cleanHeaders = headers.filter((h) => h.name.trim().length > 0);
    const stamp = nowStamp();
    const savedId = existingAuth
      ? existingAuth.id
      : (config.nextAuthenticationId ?? 1);

    update((p) => {
      const list = p.authentications ?? [];
      const base: Authentication = {
        id: savedId,
        name:
          existingAuth?.name ?? `${activeProvider.name} — ${activeService.name}`,
        providerId: activeProvider.id,
        serviceId: activeService.id,
        authType: activeService.authType,
        baseUrl: activeService.baseUrl,
        testEndpoint: activeService.testEndpoint,
        credentials: creds,
        headers: cleanHeaders,
        timeoutMs: parseNumeric(timeoutMs, 5000),
        maxRetries: parseNumeric(maxRetries, 3),
        status: testResult?.ok ? 'Authenticated' : 'Unauthenticated',
        lastTested: testResult ? stamp : existingAuth?.lastTested,
        avgLatency: testResult?.ok ? testResult.latency : existingAuth?.avgLatency,
      };
      return {
        ...p,
        authentications: existingAuth
          ? list.map((a) => (a.id === savedId ? base : a))
          : [base, ...list],
        nextAuthenticationId: existingAuth
          ? p.nextAuthenticationId
          : savedId + 1,
      };
    });

    if (launchConnection) onAuthenticated?.(savedId);
    onClose();
  };

  const stepLabels = ['Service Details', 'Credentials', 'Test'] as const;
  const canAdvance =
    step === 0 ? !!activeService : step === 1 ? credsValid : !!testResult;

  const title = existingAuth
    ? `Re-authenticate — ${existingAuth.name}`
    : `Authenticate — ${activeService?.name ?? ''}`;

  return (
    <WizardShell
      open={open}
      onClose={onClose}
      title={title}
      steps={stepLabels}
      step={step}
      footer={
        <>
          {step > 0 && (
            <Button variant="neutral" onClick={() => setStep((s) => (s - 1) as AuthStep)}>
              Back
            </Button>
          )}
          <span style={{ flex: 1 }} />
          <Button variant="neutral" onClick={onClose}>
            Cancel
          </Button>
          {step < 2 ? (
            <Button
              variant="brand"
              disabled={!canAdvance}
              onClick={() => setStep((s) => (s + 1) as AuthStep)}
            >
              Next
            </Button>
          ) : onAuthenticated && !existingAuth ? (
            <>
              <Button
                variant="neutral"
                disabled={!testResult?.ok}
                onClick={() => onSave(false)}
              >
                Save Authentication
              </Button>
              <Button
                variant="brand"
                disabled={!testResult?.ok}
                onClick={() => onSave(true)}
              >
                Save & Add Connection
              </Button>
            </>
          ) : (
            <Button
              variant="brand"
              disabled={!existingAuth && !testResult?.ok}
              onClick={() => onSave(false)}
            >
              Save Authentication
            </Button>
          )}
        </>
      }
    >
      {step === 0 && activeService && activeProvider && (
        <div className="cw-body">
          <p className="cw-hint">
            Authenticate once to {activeProvider.name} · {activeService.name}. The
            credentials you enter here are shared by every endpoint and every
            connection built on this service.
          </p>
          <div className="cw-contract">
            <div className="cw-contract__title">API Contract</div>
            <dl className="cw-contract__grid">
              <ContractField label="Base URL" mono value={activeService.baseUrl} />
              <ContractField label="Auth" value={activeService.authType} />
              <ContractField
                label="Rate Limit"
                value={activeService.contract.rateLimit}
              />
              <ContractField
                label="Test Endpoint"
                mono
                value={activeService.testEndpoint}
              />
            </dl>
            {activeService.contract.notes && (
              <p className="cw-contract__notes">{activeService.contract.notes}</p>
            )}
          </div>
          {activeService.endpoints.length > 0 && (
            <div className="cw-contract">
              <div className="cw-contract__title">
                Endpoints ({activeService.endpoints.length})
              </div>
              <div className="cw-vtabs">
                <div
                  className="cw-vtabs__list"
                  role="tablist"
                  aria-orientation="vertical"
                >
                  {activeService.endpoints.map((ep) => (
                    <div
                      key={ep.id}
                      className={`cw-vtab${
                        activeEndpointId === ep.id ? ' cw-vtab--active' : ''
                      }`}
                    >
                      <button
                        type="button"
                        className="cw-vtab__btn"
                        role="tab"
                        aria-selected={activeEndpointId === ep.id}
                        onClick={() => setActiveEndpointId(ep.id)}
                      >
                        <span
                          className={`cw-method cw-method--${ep.method.toLowerCase()}`}
                        >
                          {ep.method}
                        </span>
                        <span className="cw-vtab__name">{ep.name}</span>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="cw-vpane" role="tabpanel">
                  <ReadOnlyEndpointDetail
                    endpoint={
                      activeService.endpoints.find(
                        (e) => e.id === activeEndpointId,
                      ) ?? activeService.endpoints[0]
                    }
                    baseUrl={activeService.baseUrl}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 1 && activeService && (
        <CredentialsPane
          service={activeService}
          fields={fields}
          creds={creds}
          onCred={(k, v) => setCreds((c) => ({ ...c, [k]: v }))}
          headers={headers}
          onHeaders={setHeaders}
          timeoutMs={timeoutMs}
          onTimeout={setTimeoutMs}
          maxRetries={maxRetries}
          onMaxRetries={setMaxRetries}
        />
      )}

      {step === 2 && activeService && (
        <div className="cw-body">
          <p className="cw-hint">
            Run a one-shot request against{' '}
            <code>
              {activeService.baseUrl}
              {activeService.testEndpoint}
            </code>{' '}
            to confirm the credentials before saving.
          </p>
          <div className="cw-test-row">
            <Button
              variant="brand"
              onClick={runTest}
              disabled={testing}
              iconLeading={<Icon name="trending-up" size={14} />}
            >
              {testing ? 'Testing…' : testResult ? 'Test Again' : 'Test Authentication'}
            </Button>
            {testResult && (
              <Badge tone={testResult.ok ? 'success' : 'error'}>
                {testResult.ok ? 'Success' : 'Failed'}
              </Badge>
            )}
          </div>
          {testResult ? (
            <p
              className={`cw-test-msg ${
                testResult.ok ? 'cw-test-msg--ok' : 'cw-test-msg--bad'
              }`}
            >
              {testResult.message}
            </p>
          ) : (
            !testing && (
              <p className="cw-test-msg">Click "Test Authentication" to continue.</p>
            )
          )}
          {testResult?.ok && onAuthenticated && !existingAuth && (
            <div className="cw-auth-done">
              <div className="cw-auth-done__title">
                <Icon name="check" size={14} />
                Connection works
              </div>
              <p className="cw-auth-done__body">
                This service is authenticated and ready to use. Choose{' '}
                <strong>Save Authentication</strong> to finish now and add
                connections later, or <strong>Save &amp; Add Connection</strong>{' '}
                to configure a connection right away.
              </p>
            </div>
          )}
        </div>
      )}
    </WizardShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * Flow 1b · Data Cloud Connector authentication wizard
 *
 * Data Cloud Connector services ingest data streams into Data Cloud rather
 * than exposing point-to-point endpoints, so they get their own 3-step flow:
 * review the data streams, enter Client ID / Client Secret, then test. The
 * Test step offers Save and Save & Deploy — the Deploy flow is not wired yet.
 * ═════════════════════════════════════════════════════════════════ */

interface DccAuthWizardProps {
  open: boolean;
  service?: ServiceSelection | null;
  onClose: () => void;
  onAuthenticated?: (authId: number) => void;
}

export function DccAuthWizardModal({
  open,
  service,
  onClose,
  onAuthenticated,
}: DccAuthWizardProps) {
  const { config, update } = useConfig();

  const serviceId = service?.serviceId ?? '';
  const resolved = useMemo(() => findServiceById(serviceId), [serviceId]);
  const activeProvider = resolved?.provider;
  const activeService = resolved?.service;

  const [step, setStep] = useState<AuthStep>(0);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    { ok: boolean; latency: number; message: string } | null
  >(null);
  // Deploy sub-modal (Dataspace lookup) launched from "Save and Deploy".
  const [deployOpen, setDeployOpen] = useState(false);
  const [dataspace, setDataspace] = useState('');
  const [deployName, setDeployName] = useState('');
  const [deployDevName, setDeployDevName] = useState('');
  const [deployUsageType, setDeployUsageType] = useState<ConnectionUsageType>(
    CONNECTION_USAGE_TYPES[0],
  );

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setClientId('');
    setClientSecret('');
    setTesting(false);
    setTestResult(null);
    setDeployOpen(false);
    setDataspace('');
    setDeployName('');
    setDeployDevName('');
    setDeployUsageType(CONNECTION_USAGE_TYPES[0]);
  }, [open, serviceId]);

  const credsValid = clientId.trim().length > 0 && clientSecret.trim().length > 0;

  const runTest = () => {
    setTesting(true);
    setTestResult(null);
    window.setTimeout(() => {
      const latency = 120 + Math.floor(Math.random() * 280);
      const ok = Math.random() > 0.1;
      const url = `${activeService?.baseUrl ?? ''}${activeService?.testEndpoint ?? ''}`;
      setTestResult({
        ok,
        latency,
        message: ok
          ? `${url} authenticated in ${latency} ms.`
          : 'Authentication failed. Check the credentials and try again.',
      });
      setTesting(false);
    }, 500);
  };

  const onSave = () => {
    if (!activeService || !activeProvider) return;
    const stamp = nowStamp();
    const savedId = config.nextAuthenticationId ?? 1;
    update((p) => {
      const list = p.authentications ?? [];
      const base: Authentication = {
        id: savedId,
        name: `${activeProvider.name} — ${activeService.name}`,
        providerId: activeProvider.id,
        serviceId: activeService.id,
        authType: activeService.authType,
        baseUrl: activeService.baseUrl,
        testEndpoint: activeService.testEndpoint,
        credentials: { clientId, clientSecret },
        headers: activeService.defaultHeaders?.map((h) => ({ ...h })) ?? [],
        timeoutMs: 5000,
        maxRetries: 3,
        status: testResult?.ok ? 'Authenticated' : 'Unauthenticated',
        lastTested: testResult ? stamp : undefined,
        avgLatency: testResult?.ok ? testResult.latency : undefined,
      };
      return {
        ...p,
        authentications: [base, ...list],
        nextAuthenticationId: savedId + 1,
      };
    });
    onAuthenticated?.(savedId);
    onClose();
  };

  // "Save and Deploy" — persist the auth AND create a Data Cloud connection
  // bound to it (Name + Developer Name + Dataspace, no endpoint selection).
  const onDeploy = () => {
    if (!activeService || !activeProvider) return;
    const stamp = nowStamp();
    const authId = config.nextAuthenticationId ?? 1;
    const connId = config.nextConnectionInstanceId ?? 1;
    update((p) => {
      const auths = p.authentications ?? [];
      const auth: Authentication = {
        id: authId,
        name: `${activeProvider.name} — ${activeService.name}`,
        providerId: activeProvider.id,
        serviceId: activeService.id,
        authType: activeService.authType,
        baseUrl: activeService.baseUrl,
        testEndpoint: activeService.testEndpoint,
        credentials: { clientId, clientSecret },
        headers: activeService.defaultHeaders?.map((h) => ({ ...h })) ?? [],
        timeoutMs: 5000,
        maxRetries: 3,
        status: testResult?.ok ? 'Authenticated' : 'Unauthenticated',
        lastTested: testResult ? stamp : undefined,
        avgLatency: testResult?.ok ? testResult.latency : undefined,
      };
      const conns = p.connectionInstances ?? [];
      const conn: ConnectionInstance = {
        id: connId,
        authId,
        templateId: 0,
        name: deployName.trim() || `${activeService.name} Connection`,
        developerName: deployDevName.trim() || toDevName(deployName || activeService.name),
        dataspace,
        usageType: deployUsageType,
        providerId: activeProvider.id,
        serviceId: activeService.id,
        authType: activeService.authType,
        baseUrl: activeService.baseUrl,
        testEndpoint: activeService.testEndpoint,
        status: testResult?.ok ? 'Connected' : 'Needs Attention',
        lastTested: testResult ? stamp : undefined,
        errors24h: 0,
        totalCalls24h: 0,
        usedBy: [],
      };
      return {
        ...p,
        authentications: [auth, ...auths],
        nextAuthenticationId: authId + 1,
        connectionInstances: [conn, ...conns],
        nextConnectionInstanceId: connId + 1,
      };
    });
    setDeployOpen(false);
    onAuthenticated?.(authId);
    onClose();
  };

  const stepLabels = ['Data Streams', 'Authentication', 'Test'] as const;
  const canAdvance = step === 0 ? true : step === 1 ? credsValid : !!testResult;

  return (
    <>
    <WizardShell
      open={open && !deployOpen}
      onClose={onClose}
      title={`Authenticate — ${activeService?.name ?? ''}`}
      steps={stepLabels}
      step={step}
      footer={
        <>
          {step > 0 && (
            <Button variant="neutral" onClick={() => setStep((s) => (s - 1) as AuthStep)}>
              Back
            </Button>
          )}
          <span style={{ flex: 1 }} />
          <Button variant="neutral" onClick={onClose}>
            Cancel
          </Button>
          {step < 2 ? (
            <Button
              variant="brand"
              disabled={!canAdvance}
              onClick={() => setStep((s) => (s + 1) as AuthStep)}
            >
              Next
            </Button>
          ) : (
            <>
              <Button variant="neutral" disabled={!testResult?.ok} onClick={onSave}>
                Save
              </Button>
              <Button
                variant="brand"
                disabled={!testResult?.ok}
                onClick={() => setDeployOpen(true)}
              >
                Save and Deploy
              </Button>
            </>
          )}
        </>
      }
    >
      {step === 0 && (
        <div className="cw-body">
          <p className="cw-hint">
            Review the data streams this connector ingests into Data Cloud.
          </p>
          <DataStreamsPanel />
        </div>
      )}

      {step === 1 && (
        <div className="cw-body">
          <p className="cw-hint">
            Enter the OAuth 2.0 client credentials for {activeService?.name}. These
            are shared across every data stream on this connector.
          </p>
          <div className="cw-io-grid">
            <Input
              label="Client ID"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="e.g. abc123-client"
            />
            <Input
              label="Client Secret"
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="Paste your client secret"
            />
          </div>
        </div>
      )}

      {step === 2 && activeService && (
        <div className="cw-body">
          <p className="cw-hint">
            Run a one-shot request against{' '}
            <code>
              {activeService.baseUrl}
              {activeService.testEndpoint}
            </code>{' '}
            to confirm the credentials before saving.
          </p>
          <div className="cw-test-row">
            <Button
              variant="brand"
              onClick={runTest}
              disabled={testing}
              iconLeading={<Icon name="trending-up" size={14} />}
            >
              {testing ? 'Testing…' : testResult ? 'Test Again' : 'Test Authentication'}
            </Button>
            {testResult && (
              <Badge tone={testResult.ok ? 'success' : 'error'}>
                {testResult.ok ? 'Success' : 'Failed'}
              </Badge>
            )}
          </div>
          {testResult ? (
            <p
              className={`cw-test-msg ${
                testResult.ok ? 'cw-test-msg--ok' : 'cw-test-msg--bad'
              }`}
            >
              {testResult.message}
            </p>
          ) : (
            !testing && (
              <p className="cw-test-msg">Click "Test Authentication" to continue.</p>
            )
          )}
        </div>
      )}
    </WizardShell>

    {/* Deploy — pick the Dataspace the data streams deploy into. */}
    <DccDeployModal
      open={deployOpen}
      title="Deploy Data Cloud Connector"
      confirmLabel="Deploy"
      name={deployName}
      developerName={deployDevName}
      dataspace={dataspace}
      usageType={deployUsageType}
      onNameChange={setDeployName}
      onDeveloperNameChange={setDeployDevName}
      onUsageTypeChange={setDeployUsageType}
      onDataspaceChange={setDataspace}
      onClose={() => setDeployOpen(false)}
      onConfirm={onDeploy}
    />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * Data Cloud Connector deploy / edit modal
 *
 * The large modal that captures a Data Cloud connection's Name, Developer
 * Name, and Dataspace plus the Data Kit preview. Shared by the DCC auth
 * wizard's "Save and Deploy" and the Connection detail page's "Edit
 * Connection" so both surfaces stay identical.
 * ═════════════════════════════════════════════════════════════════ */

const DATASPACES = ['default', 'Underwriting', 'Claims', 'Marketing'];

/* Pre-provisioned Named Credentials a P2P connection can authenticate
 * through. In a real org these come from Setup → Named Credentials. */
const NAMED_CREDENTIALS = [
  'UW_DataProviders_NC',
  'UW_Firmographics_NC',
  'UW_PropertyData_NC',
  'UW_LossHistory_NC',
  'UW_Compliance_NC',
];

interface DccDeployModalProps {
  open: boolean;
  title: string;
  confirmLabel: string;
  name: string;
  developerName: string;
  dataspace: string;
  usageType: ConnectionUsageType;
  onNameChange: (v: string) => void;
  onDeveloperNameChange: (v: string) => void;
  onDataspaceChange: (v: string) => void;
  onUsageTypeChange: (v: ConnectionUsageType) => void;
  onClose: () => void;
  onConfirm: () => void;
}

function DccDeployModal({
  open,
  title,
  confirmLabel,
  name,
  developerName,
  dataspace,
  usageType,
  onNameChange,
  onDeveloperNameChange,
  onDataspaceChange,
  onUsageTypeChange,
  onClose,
  onConfirm,
}: DccDeployModalProps) {
  const valid = name.trim().length > 0 && dataspace.length > 0;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <>
          <span style={{ flex: 1 }} />
          <Button variant="neutral" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="brand" disabled={!valid} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="cw-body">
        <p className="cw-hint">
          Name this connection and choose the Data Cloud Dataspace these data
          streams deploy into.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            alignItems: 'start',
          }}
        >
          <Input
            label="Name"
            required
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Bridge FT Transactions"
          />
          <Input
            label="Developer Name"
            value={developerName}
            onChange={(e) => onDeveloperNameChange(e.target.value)}
            placeholder={toDevName(name || 'Connection')}
          />
          <div>
            <label className="slds2-field-label">Dataspace</label>
            <Dropdown
              value={dataspace}
              onChange={onDataspaceChange}
              options={DATASPACES.map((d) => ({ value: d, label: d }))}
              placeholder="Select a Dataspace"
              fullWidth
            />
          </div>
          <div>
            <label className="slds2-field-label">Usage Type</label>
            <Dropdown
              value={usageType}
              onChange={(v) => onUsageTypeChange(v as ConnectionUsageType)}
              options={CONNECTION_USAGE_TYPES.map((u) => ({ value: u, label: u }))}
              fullWidth
            />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <DataStreamsPanel />
        </div>
      </div>
    </Modal>
  );
}

/* Public wrapper — opens the deploy modal for an existing Data Cloud
 * connection so the Connection detail page's "Edit Connection" launches the
 * same surface as the auth wizard's Deploy step, saving back in place. */
export function DccConnectionEditModal({
  open,
  connection,
  onClose,
}: {
  open: boolean;
  connection: ConnectionInstance;
  onClose: () => void;
}) {
  const { update } = useConfig();
  const [name, setName] = useState(connection.name);
  const [developerName, setDeveloperName] = useState(
    connection.developerName ?? '',
  );
  const [dataspace, setDataspace] = useState(connection.dataspace ?? '');
  const [usageType, setUsageType] = useState<ConnectionUsageType>(
    connection.usageType ?? CONNECTION_USAGE_TYPES[0],
  );

  useEffect(() => {
    if (!open) return;
    setName(connection.name);
    setDeveloperName(connection.developerName ?? '');
    setDataspace(connection.dataspace ?? '');
    setUsageType(connection.usageType ?? CONNECTION_USAGE_TYPES[0]);
  }, [open, connection.id]);

  const onConfirm = () => {
    update((p) => ({
      ...p,
      connectionInstances: (p.connectionInstances ?? []).map((c) =>
        c.id === connection.id
          ? {
              ...c,
              name: name.trim() || c.name,
              developerName:
                developerName.trim() || toDevName(name || c.name),
              dataspace,
              usageType,
            }
          : c,
      ),
    }));
    onClose();
  };

  return (
    <DccDeployModal
      open={open}
      title="Edit Connection"
      confirmLabel="Save"
      name={name}
      developerName={developerName}
      dataspace={dataspace}
      usageType={usageType}
      onNameChange={setName}
      onDeveloperNameChange={setDeveloperName}
      onDataspaceChange={setDataspace}
      onUsageTypeChange={setUsageType}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

/* Public wrapper — deploy a NEW Data Cloud connection on an already
 * authenticated service. Launched from the service tile's "Deploy" action so
 * it mirrors the auth wizard's Save-and-Deploy step. */
export function DccConnectionDeployModal({
  open,
  auth,
  onClose,
}: {
  open: boolean;
  auth: Authentication;
  onClose: () => void;
}) {
  const { config, update } = useConfig();
  const [name, setName] = useState('');
  const [developerName, setDeveloperName] = useState('');
  const [dataspace, setDataspace] = useState('');
  const [usageType, setUsageType] = useState<ConnectionUsageType>(
    CONNECTION_USAGE_TYPES[0],
  );

  useEffect(() => {
    if (!open) return;
    setName('');
    setDeveloperName('');
    setDataspace('');
    setUsageType(CONNECTION_USAGE_TYPES[0]);
  }, [open, auth.id]);

  const onConfirm = () => {
    const connId = config.nextConnectionInstanceId ?? 1;
    update((p) => {
      const conns = p.connectionInstances ?? [];
      const conn: ConnectionInstance = {
        id: connId,
        authId: auth.id,
        templateId: 0,
        name: name.trim() || `${auth.name ?? 'Data Cloud'} Connection`,
        developerName:
          developerName.trim() || toDevName(name || auth.name || 'Connection'),
        dataspace,
        usageType,
        providerId: auth.providerId,
        serviceId: auth.serviceId,
        authType: auth.authType,
        baseUrl: auth.baseUrl,
        testEndpoint: auth.testEndpoint,
        status: auth.status === 'Authenticated' ? 'Connected' : 'Needs Attention',
        lastTested: auth.lastTested,
        errors24h: 0,
        totalCalls24h: 0,
        usedBy: [],
      };
      return {
        ...p,
        connectionInstances: [conn, ...conns],
        nextConnectionInstanceId: connId + 1,
      };
    });
    onClose();
  };

  return (
    <DccDeployModal
      open={open}
      title="Deploy Data Cloud Connector"
      confirmLabel="Deploy"
      name={name}
      developerName={developerName}
      dataspace={dataspace}
      usageType={usageType}
      onNameChange={setName}
      onDeveloperNameChange={setDeveloperName}
      onDataspaceChange={setDataspace}
      onUsageTypeChange={setUsageType}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * Flow 2 · Connection wizard
 * ═════════════════════════════════════════════════════════════════ */

interface ConnectionWizardProps {
  open: boolean;
  /** Authentication this connection binds to. Pre-set by the catalog
   * hand-off and the "Add Connection" button on an authenticated service. */
  authId?: number | null;
  /** Existing connection opened for edit. */
  existingConnection?: ConnectionInstance | null;
  /** When true (Connections list "New Connection"), the wizard opens with a
   * step 1 that lets the admin pick the connection style (P2P vs Data Cloud
   * Connector) before choosing a service. */
  withAuthPicker?: boolean;
  /** Provider Catalog "Connect": open pre-seeded to a specific service,
   * starting at Details with that service selected. No auth is preset — if the
   * service isn't authenticated yet, credentials are collected inline. */
  presetService?: ServiceSelection | null;
  onClose: () => void;
}

type ConnStepKey =
  | 'type'
  | 'details'
  | 'credentials'
  | 'auth-test'
  | 'select'
  | 'review'
  | 'deploy';

const CONN_STEP_LABELS: Record<ConnStepKey, string> = {
  type: 'Connection Type',
  details: 'Details',
  credentials: 'Credentials',
  'auth-test': 'Authenticate',
  select: 'Select Endpoints',
  review: 'Review',
  deploy: 'Deploy',
};

/** Connection styles the New Connection wizard can create. */
type ConnKind = 'P2P' | 'Data Cloud Connector';

export function ConnectionWizardModal({
  open,
  authId,
  existingConnection,
  withAuthPicker,
  presetService,
  onClose,
}: ConnectionWizardProps) {
  const { config, update } = useConfig();
  const authentications = config.authentications ?? [];

  // Step 1 (Connections-list entry only): P2P vs Data Cloud Connector. This
  // gates which catalog services the Details step offers and whether the tail
  // of the wizard is endpoint selection (P2P) or a deploy step (Data Cloud).
  const [connKind, setConnKind] = useState<ConnKind>('P2P');

  const [selectedService, setSelectedService] = useState<ServiceSelection | null>(
    null,
  );
  const [connStep, setConnStep] = useState(0);
  const [name, setName] = useState('');
  const [usageType, setUsageType] = useState<ConnectionUsageType>(
    CONNECTION_USAGE_TYPES[0],
  );
  const [categories, setCategories] = useState<ProviderCategory[]>([]);
  const [namedCredential, setNamedCredential] = useState('');
  const [enabledIds, setEnabledIds] = useState<string[]>([]);
  const [activeEndpointId, setActiveEndpointId] = useState<string>('');

  // Credential sub-state — only exercised when the chosen service isn't
  // authenticated yet, in which case the wizard folds in the provider-catalog
  // Authenticate steps (Credentials + Test) before endpoint selection.
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [headers, setHeaders] = useState<ConnectionHeader[]>([]);
  const [timeoutMs, setTimeoutMs] = useState('5000');
  const [maxRetries, setMaxRetries] = useState('3');
  const [authTesting, setAuthTesting] = useState(false);
  const [authTestResult, setAuthTestResult] = useState<
    { ok: boolean; latency: number; message: string } | null
  >(null);

  // Deploy sub-state — only exercised on the Data Cloud Connector branch,
  // whose tail is a deploy step (Dataspace + developer name) instead of
  // endpoint selection.
  const [dataspace, setDataspace] = useState('');
  const [developerName, setDeveloperName] = useState('');

  const resolved = findServiceById(selectedService?.serviceId);
  const service = resolved?.service ?? null;
  const provider = resolved?.provider ?? null;

  // Existing (successful) authentication for the chosen service, if any.
  const boundAuth = useMemo(() => {
    if (existingConnection) {
      return authentications.find((a) => a.id === existingConnection.authId) ?? null;
    }
    if (!selectedService) return null;
    return (
      authentications.find(
        (a) =>
          a.serviceId === selectedService.serviceId && a.status === 'Authenticated',
      ) ?? null
    );
  }, [authentications, selectedService, existingConnection]);

  // Only the Data Cloud Connector branch folds in inline authentication. P2P
  // connections authenticate through a pre-provisioned Named Credential picked
  // in the Details step, so they never collect credentials in the wizard.
  const needsAuth =
    connKind === 'Data Cloud Connector' &&
    !!service &&
    !boundAuth &&
    !existingConnection;

  const authType = service?.authType ?? 'API Key';
  const credFields = useMemo(() => fieldsFor(authType), [authType]);
  const credsValid = useMemo(() => {
    if (authType === 'None') return true;
    return credFields.every(
      (f) => f.key === 'scope' || (creds[f.key]?.trim().length ?? 0) > 0,
    );
  }, [authType, credFields, creds]);

  // The Connections-list entry point opens with a Connection Type step that
  // gates the whole flow; the catalog / edit / auth-preset entry points skip
  // it (their kind is implied by the chosen service).
  const withTypePicker = withAuthPicker && !existingConnection && authId == null;
  const isDcc = connKind === 'Data Cloud Connector';

  // Dynamic step list — the Data Cloud branch ends in a Deploy step; the P2P
  // branch ends in Select Endpoints + Test. Unauthenticated services fold in
  // Credentials + Authenticate steps ported from the provider-catalog flow.
  const stepKeys = useMemo<ConnStepKey[]>(() => {
    const head: ConnStepKey[] = withTypePicker ? ['type', 'details'] : ['details'];
    const auth: ConnStepKey[] = needsAuth ? ['credentials', 'auth-test'] : [];
    const tail: ConnStepKey[] = isDcc ? ['deploy'] : ['select', 'review'];
    return [...head, ...auth, ...tail];
  }, [withTypePicker, needsAuth, isDcc]);
  const stepLabels = useMemo(
    () => stepKeys.map((k) => CONN_STEP_LABELS[k]),
    [stepKeys],
  );
  const currentKey = stepKeys[connStep] ?? 'details';

  useEffect(() => {
    if (!open) return;
    setAuthTesting(false);
    setAuthTestResult(null);
    setCreds({});
    setHeaders([]);
    setTimeoutMs('5000');
    setMaxRetries('3');
    setDataspace('');
    setDeveloperName('');
    if (existingConnection) {
      const svc = findServiceById(existingConnection.serviceId)?.service;
      const ids = existingConnection.enabledEndpointIds ?? [];
      setSelectedService(
        existingConnection.serviceId
          ? {
              providerId: existingConnection.providerId ?? '',
              serviceId: existingConnection.serviceId,
            }
          : null,
      );
      setConnKind(
        svc?.type === 'Data Cloud Connector' ? 'Data Cloud Connector' : 'P2P',
      );
      setConnStep(0);
      setName(existingConnection.name);
      setUsageType(existingConnection.usageType ?? CONNECTION_USAGE_TYPES[0]);
      setCategories(existingConnection.categories ?? []);
      setNamedCredential(existingConnection.namedCredential ?? '');
      setEnabledIds(ids);
      setActiveEndpointId(ids[0] ?? svc?.endpoints[0]?.id ?? '');
      setDataspace(existingConnection.dataspace ?? '');
      setDeveloperName(existingConnection.developerName ?? '');
    } else if (authId != null) {
      // Catalog hand-off: an authenticated service is preset via authId → the
      // Details step is already answered, so jump straight to endpoints.
      const presetAuth = authentications.find((a) => a.id === authId);
      const svc = findServiceById(presetAuth?.serviceId)?.service;
      setSelectedService(
        presetAuth
          ? { providerId: presetAuth.providerId, serviceId: presetAuth.serviceId }
          : null,
      );
      setConnKind(
        svc?.type === 'Data Cloud Connector' ? 'Data Cloud Connector' : 'P2P',
      );
      setConnStep(1);
      setName(presetAuth?.name ?? '');
      setUsageType(CONNECTION_USAGE_TYPES[0]);
      setCategories([]);
      setNamedCredential('');
      setEnabledIds([]);
      setActiveEndpointId(svc?.endpoints[0]?.id ?? '');
    } else if (presetService) {
      // Provider Catalog "Connect": open on Details with the service selected.
      const svc = findServiceById(presetService.serviceId)?.service;
      setSelectedService(presetService);
      setConnKind(
        svc?.type === 'Data Cloud Connector' ? 'Data Cloud Connector' : 'P2P',
      );
      setConnStep(0);
      setName('');
      setUsageType(CONNECTION_USAGE_TYPES[0]);
      setCategories([]);
      setNamedCredential('');
      setEnabledIds([]);
      setActiveEndpointId(svc?.endpoints[0]?.id ?? '');
    } else {
      setSelectedService(null);
      setConnKind('P2P');
      setConnStep(0);
      setName('');
      setUsageType(CONNECTION_USAGE_TYPES[0]);
      setCategories([]);
      setNamedCredential('');
      setEnabledIds([]);
      setActiveEndpointId('');
    }
  }, [open, existingConnection?.id, authId, presetService?.serviceId]);

  // Multiple endpoints can be selected per connection — toggle each on/off.
  const toggle = (id: string) =>
    setEnabledIds((curr) =>
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id],
    );

  // Pick a catalog service in the Details step — reset endpoint + credential
  // state for the newly chosen service. Seed default headers only when the
  // service still needs authentication.
  const selectService = (providerId: string, serviceId: string) => {
    const svc = findServiceById(serviceId)?.service;
    const authed = authentications.find(
      (a) => a.serviceId === serviceId && a.status === 'Authenticated',
    );
    setSelectedService({ providerId, serviceId });
    setEnabledIds([]);
    setActiveEndpointId(svc?.endpoints[0]?.id ?? '');
    setCreds({});
    setHeaders(authed ? [] : svc?.defaultHeaders?.map((h) => ({ ...h })) ?? []);
    setTimeoutMs('5000');
    setMaxRetries('3');
    setAuthTestResult(null);
    setName((curr) => (curr.trim() ? curr : authed?.name ?? svc?.name ?? ''));
  };

  const runAuthTest = () => {
    setAuthTesting(true);
    setAuthTestResult(null);
    window.setTimeout(() => {
      const latency = 120 + Math.floor(Math.random() * 280);
      const ok = Math.random() > 0.1;
      const url = `${service?.baseUrl ?? ''}${service?.testEndpoint ?? ''}`;
      setAuthTestResult({
        ok,
        latency,
        message: ok
          ? `${url} authenticated in ${latency} ms.`
          : 'Authentication failed. Check the credentials and try again.',
      });
      setAuthTesting(false);
    }, 500);
  };

  const nameValid = name.trim().length > 0;
  // P2P connections authenticate through a Named Credential chosen here, so it
  // is required to advance; the Data Cloud branch authenticates downstream.
  const detailsValid =
    !!service && nameValid && (isDcc || namedCredential.trim().length > 0);
  const deployValid = dataspace.trim().length > 0;
  const authOk = !needsAuth || !!authTestResult?.ok;
  const canSave = isDcc
    ? !!service && nameValid && deployValid && authOk
    : !!service && nameValid && enabledIds.length > 0 && authOk;

  const selectedEndpoints = useMemo(
    () => service?.endpoints.filter((e) => enabledIds.includes(e.id)) ?? [],
    [service, enabledIds],
  );

  const onSave = () => {
    if (!service || !provider) return;
    const stamp = nowStamp();
    const cleanHeaders = headers.filter((h) => h.name.trim().length > 0);

    update((p) => {
      let auths = p.authentications ?? [];
      let nextAuthId = p.nextAuthenticationId ?? 1;
      let boundAuthId = boundAuth?.id ?? null;

      // Unauthenticated path — persist a new Authentication from the folded-in
      // credential steps, then bind the connection to it.
      if (needsAuth) {
        boundAuthId = nextAuthId;
        const newAuth: Authentication = {
          id: nextAuthId,
          name: `${provider.name} — ${service.name}`,
          providerId: provider.id,
          serviceId: service.id,
          authType: service.authType,
          baseUrl: service.baseUrl,
          testEndpoint: service.testEndpoint,
          credentials: creds,
          headers: cleanHeaders,
          timeoutMs: parseNumeric(timeoutMs, 5000),
          maxRetries: parseNumeric(maxRetries, 3),
          status: 'Authenticated',
          lastTested: stamp,
          avgLatency: authTestResult?.ok ? authTestResult.latency : undefined,
        };
        auths = [newAuth, ...auths];
        nextAuthId = nextAuthId + 1;
      }

      const list = p.connectionInstances ?? [];
      // Data Cloud connections deploy once authenticated; P2P connections are
      // Connected on save (there is no per-endpoint test step anymore).
      const status: ConnectionInstance['status'] = isDcc
        ? authOk
          ? 'Connected'
          : 'Needs Attention'
        : 'Connected';

      const shared = isDcc
        ? {
            developerName:
              developerName.trim() ||
              toDevName(name || service.name),
            dataspace,
            enabledEndpointIds: undefined,
            endpointTests: undefined,
          }
        : {
            enabledEndpointIds: enabledIds,
            endpointTests: undefined,
          };

      if (existingConnection) {
        const merged: ConnectionInstance = {
          ...existingConnection,
          authId: boundAuthId ?? existingConnection.authId,
          name: name.trim(),
          usageType,
          categories,
          namedCredential: isDcc ? undefined : namedCredential.trim() || undefined,
          providerId: provider.id,
          serviceId: service.id,
          authType: service.authType,
          baseUrl: service.baseUrl,
          testEndpoint: service.testEndpoint,
          status,
          lastTested: stamp,
          ...shared,
        };
        return {
          ...p,
          authentications: auths,
          nextAuthenticationId: nextAuthId,
          connectionInstances: list.map((i) =>
            i.id === existingConnection.id ? merged : i,
          ),
        };
      }

      const newId = p.nextConnectionInstanceId ?? 1;
      const next: ConnectionInstance = {
        id: newId,
        authId: boundAuthId ?? undefined,
        templateId: 0,
        name: name.trim(),
        usageType,
        categories,
        namedCredential: isDcc ? undefined : namedCredential.trim() || undefined,
        providerId: provider.id,
        serviceId: service.id,
        authType: service.authType,
        baseUrl: service.baseUrl,
        testEndpoint: service.testEndpoint,
        status,
        lastTested: stamp,
        avgLatency: undefined,
        errors24h: 0,
        totalCalls24h: 0,
        usedBy: [],
        ...shared,
      };
      return {
        ...p,
        authentications: auths,
        nextAuthenticationId: nextAuthId,
        connectionInstances: [next, ...list],
        nextConnectionInstanceId: newId + 1,
      };
    });
    onClose();
  };

  const title = existingConnection
    ? `Edit Connection — ${name || existingConnection.name}`
    : 'New Connection';

  const isSelectStep = currentKey === 'select';
  const isReviewStep = currentKey === 'review';
  const stepEndpoints = isReviewStep
    ? selectedEndpoints
    : service?.endpoints ?? [];
  const activeEndpoint =
    stepEndpoints.find((e) => e.id === activeEndpointId) ??
    stepEndpoints[0] ??
    null;

  const stepValid: Record<ConnStepKey, boolean> = {
    type: true,
    details: detailsValid,
    credentials: credsValid,
    'auth-test': !!authTestResult?.ok,
    select: enabledIds.length > 0,
    review: true,
    deploy: deployValid,
  };
  const nextDisabled = !stepValid[currentKey];
  const isLast = connStep === stepKeys.length - 1;
  // Catalog path skips Details, so it isn't reachable via Back either.
  const minStep = authId != null && !existingConnection ? 1 : 0;

  const goNext = () => {
    if (currentKey === 'select') {
      setActiveEndpointId((curr) =>
        selectedEndpoints.some((e) => e.id === curr)
          ? curr
          : selectedEndpoints[0]?.id ?? '',
      );
    }
    setConnStep((s) => Math.min(s + 1, stepKeys.length - 1));
  };

  return (
    <WizardShell
      open={open}
      onClose={onClose}
      title={title}
      steps={stepLabels}
      step={connStep}
      footer={
        <>
          <span style={{ flex: 1 }} />
          <Button variant="neutral" onClick={onClose}>
            Cancel
          </Button>
          {connStep > minStep && (
            <Button
              variant="neutral"
              onClick={() => setConnStep((s) => Math.max(s - 1, minStep))}
            >
              Back
            </Button>
          )}
          {!isLast ? (
            <Button variant="brand" disabled={nextDisabled} onClick={goNext}>
              Next
            </Button>
          ) : (
            <Button variant="brand" disabled={!canSave} onClick={onSave}>
              {isDcc ? 'Deploy Connection' : 'Save Connection'}
            </Button>
          )}
        </>
      }
    >
      {currentKey === 'type' ? (
        <ConnKindPane
          value={connKind}
          onChange={(k) => {
            if (k === connKind) return;
            setConnKind(k);
            // Drop any service picked under the previous kind so the Details
            // step starts clean against the new service filter.
            setSelectedService(null);
            setName('');
            setNamedCredential('');
            setEnabledIds([]);
            setActiveEndpointId('');
            setCreds({});
            setHeaders([]);
            setAuthTestResult(null);
            setDataspace('');
            setDeveloperName('');
          }}
        />
      ) : currentKey === 'details' ? (
        <DetailsPane
          authentications={authentications}
          name={name}
          onName={setName}
          usageType={usageType}
          onUsageType={setUsageType}
          categories={categories}
          onCategories={setCategories}
          namedCredential={namedCredential}
          onNamedCredential={setNamedCredential}
          selectedService={selectedService}
          onSelectService={selectService}
          connKind={connKind}
        />
      ) : currentKey === 'credentials' && service ? (
        <CredentialsPane
          service={service}
          fields={credFields}
          creds={creds}
          onCred={(k, v) => setCreds((c) => ({ ...c, [k]: v }))}
          headers={headers}
          onHeaders={setHeaders}
          timeoutMs={timeoutMs}
          onTimeout={setTimeoutMs}
          maxRetries={maxRetries}
          onMaxRetries={setMaxRetries}
        />
      ) : currentKey === 'auth-test' && service ? (
        <AuthTestPane
          service={service}
          testing={authTesting}
          result={authTestResult}
          onTest={runAuthTest}
        />
      ) : currentKey === 'deploy' && service ? (
        <div className="cw-body">
          <div className="cw-conn__auth-note">
            <Icon name="check" size={12} />
            <strong>{name || service.name}</strong> · {provider?.name} ·{' '}
            {service.name} · {service.authType}
          </div>
          <p className="cw-hint">
            Choose the Data Cloud Dataspace these data streams deploy into.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
              alignItems: 'start',
            }}
          >
            <Input
              label="Developer Name"
              value={developerName}
              onChange={(e) => setDeveloperName(e.target.value)}
              placeholder={toDevName(name || service.name)}
            />
            <div>
              <label className="slds2-field-label">Dataspace</label>
              <Dropdown
                value={dataspace}
                onChange={setDataspace}
                options={DATASPACES.map((d) => ({ value: d, label: d }))}
                placeholder="Select a Dataspace"
                fullWidth
              />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <DataStreamsPanel />
          </div>
        </div>
      ) : !service ? (
        <div className="cw-body">
          <div className="cw-empty">Select a service to continue.</div>
        </div>
      ) : isSelectStep ? (
        <div className="cw-conn">
          <div className="cw-conn__top">
            <div className="cw-conn__auth-note">
              <Icon name="check" size={12} />
              <strong>{name || service.name}</strong> · {provider?.name} ·{' '}
              {service.name} · {service.authType}
            </div>
          </div>
          <p className="cw-hint">
            Select the endpoints this connection will call.
          </p>
          <ServiceReferenceView
            service={service}
            selectedEndpointIds={enabledIds}
            onToggleEndpoint={toggle}
          />
        </div>
      ) : (
        <div className="cw-conn">
          <div className="cw-conn__top">
            <div className="cw-conn__auth-note">
              <Icon name="check" size={12} />
              <strong>{name || service.name}</strong> · {provider?.name} ·{' '}
              {service.name} · {service.authType}
            </div>
          </div>
          <p className="cw-hint">
            Review the input and output parameters generated for each selected
            endpoint.
          </p>
          <div className="cw-vtabs">
            <div className="cw-vtabs__list" role="tablist" aria-orientation="vertical">
              {stepEndpoints.length === 0 ? (
                <div className="cw-empty" style={{ padding: 8 }}>
                  No endpoints selected.
                </div>
              ) : (
                stepEndpoints.map((ep) => (
                  <EndpointTab
                    key={ep.id}
                    endpoint={ep}
                    active={activeEndpoint?.id === ep.id}
                    enabled={enabledIds.includes(ep.id)}
                    selectable={false}
                    onToggle={() => toggle(ep.id)}
                    onSelect={() => setActiveEndpointId(ep.id)}
                  />
                ))
              )}
            </div>
            <div className="cw-vpane" role="tabpanel">
              {activeEndpoint ? (
                <ReviewEndpointDetail
                  endpoint={activeEndpoint}
                  baseUrl={service.baseUrl}
                  serviceName={service.name}
                />
              ) : (
                <div className="cw-empty">
                  Select endpoints in the previous step to review them.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </WizardShell>
  );
}

/* Folded-in Authenticate step — mirrors the provider-catalog auth test. */
function AuthTestPane({
  service,
  testing,
  result,
  onTest,
}: {
  service: ProviderService;
  testing: boolean;
  result: { ok: boolean; latency: number; message: string } | null;
  onTest: () => void;
}) {
  return (
    <div className="cw-body">
      <p className="cw-hint">
        Run a one-shot request against{' '}
        <code>
          {service.baseUrl}
          {service.testEndpoint}
        </code>{' '}
        to confirm the credentials before selecting endpoints.
      </p>
      <div className="cw-test-row">
        <Button
          variant="brand"
          onClick={onTest}
          disabled={testing}
          iconLeading={<Icon name="trending-up" size={14} />}
        >
          {testing ? 'Testing…' : result ? 'Test Again' : 'Test Authentication'}
        </Button>
        {result && (
          <Badge tone={result.ok ? 'success' : 'error'}>
            {result.ok ? 'Success' : 'Failed'}
          </Badge>
        )}
      </div>
      {result ? (
        <p
          className={`cw-test-msg ${
            result.ok ? 'cw-test-msg--ok' : 'cw-test-msg--bad'
          }`}
        >
          {result.message}
        </p>
      ) : (
        !testing && (
          <p className="cw-test-msg">Click "Test Authentication" to continue.</p>
        )
      )}
    </div>
  );
}

/* ── Flow 2 · Connection Type step (P2P vs Data Cloud Connector) ─── */

const CONN_KINDS: {
  kind: ConnKind;
  title: string;
  desc: string;
  icon: IconName;
}[] = [
  {
    kind: 'P2P',
    title: 'Point-to-Point',
    desc: 'Authenticate to a service and call its REST endpoints directly. Best for real-time lookups and enrichment.',
    icon: 'plug',
  },
  {
    kind: 'Data Cloud Connector',
    title: 'Data Cloud Connector',
    desc: 'Ingest provider data streams into Data Cloud and deploy them into a Dataspace. Best for bulk / batch data.',
    icon: 'database',
  },
];

function ConnKindPane({
  value,
  onChange,
}: {
  value: ConnKind;
  onChange: (v: ConnKind) => void;
}) {
  return (
    <div className="cw-body">
      <p className="cw-hint" style={{ marginBottom: 8 }}>
        Choose how this connection integrates. This sets which services you can
        pick from and the steps that follow.
      </p>
      <div className="cw-kind-grid">
        {CONN_KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            className={`cw-kind-tile${
              value === k.kind ? ' cw-kind-tile--selected' : ''
            }`}
            onClick={() => onChange(k.kind)}
            aria-pressed={value === k.kind}
          >
            <span className="cw-kind-tile__icon">
              <Icon name={k.icon} size={20} />
            </span>
            <span className="cw-kind-tile__body">
              <span className="cw-kind-tile__title">{k.title}</span>
              <span className="cw-kind-tile__desc">{k.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Flow 2 · Details step (name + service catalog picker) ───────── */

function DetailsPane({
  authentications,
  name,
  onName,
  usageType,
  onUsageType,
  categories,
  onCategories,
  namedCredential,
  onNamedCredential,
  selectedService,
  onSelectService,
  connKind,
}: {
  authentications: Authentication[];
  name: string;
  onName: (v: string) => void;
  usageType: ConnectionUsageType;
  onUsageType: (v: ConnectionUsageType) => void;
  categories: ProviderCategory[];
  onCategories: (v: ProviderCategory[]) => void;
  namedCredential: string;
  onNamedCredential: (v: string) => void;
  selectedService: ServiceSelection | null;
  onSelectService: (providerId: string, serviceId: string) => void;
  connKind: ConnKind;
}) {
  // Only offer services matching the chosen connection style: Data Cloud
  // Connector services on the DC branch, everything else (P2P / MCP) on the
  // P2P branch. Providers with no matching service are dropped.
  const matchesKind = (s: ProviderService) => {
    const isDccSvc = s.type === 'Data Cloud Connector';
    return connKind === 'Data Cloud Connector' ? isDccSvc : !isDccSvc;
  };
  const providers = useMemo(
    () =>
      PROVIDERS.map((p) => ({
        ...p,
        services: p.services.filter(matchesKind),
      })).filter((p) => p.services.length > 0),
    [connKind],
  );

  const selectedProviderId = selectedService?.providerId ?? null;
  const [focusProviderId, setFocusProviderId] = useState<string | null>(null);
  useEffect(() => {
    setFocusProviderId(selectedProviderId ?? providers[0]?.id ?? null);
  }, [selectedProviderId, providers.length]);

  const focused =
    providers.find((p) => p.id === focusProviderId) ?? providers[0] ?? null;

  return (
    <div className="cw-body">
      <div className="cw-form__row">
        <Input
          label="Connection Name"
          required
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="e.g. D&B Firmographics — Production"
          fullWidth
        />

        <div>
          <label className="slds2-field-label">Usage Type</label>
          <Dropdown
            value={usageType}
            onChange={(v) => onUsageType(v as ConnectionUsageType)}
            options={CONNECTION_USAGE_TYPES.map((u) => ({ value: u, label: u }))}
            fullWidth
          />
        </div>

        {connKind !== 'Data Cloud Connector' && (
          <div>
            <label className="slds2-field-label">Named Credential</label>
            <Dropdown
              value={namedCredential}
              onChange={onNamedCredential}
              options={NAMED_CREDENTIALS.map((c) => ({ value: c, label: c }))}
              placeholder="Select a Named Credential"
              fullWidth
            />
          </div>
        )}
      </div>

      <div>
        <label className="slds2-field-label">Data Categories</label>
        <DuelingPicklist
          options={CATEGORIES.map((c) => ({ value: c, label: c }))}
          selected={categories}
          onChange={(next) => onCategories(next as ProviderCategory[])}
          leftLabel="Available"
          rightLabel="Selected"
        />
      </div>

      <div>
        <p className="cw-hint" style={{ marginBottom: 8 }}>
          {connKind === 'Data Cloud Connector'
            ? "Choose a service to connect to. Already-authenticated services reuse their credentials; for others you'll enter credentials next."
            : 'Choose a service to connect to. This connection authenticates through the Named Credential selected above.'}
        </p>
        {providers.length === 0 ? (
          <div className="cw-empty">No services are available in the catalog.</div>
        ) : (
          <div className="cw-catalog">
            <div className="cw-catalog__providers">
              <div className="cw-catalog__col-label">Providers</div>
              <div className="cw-catalog__provider-list">
                {providers.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    className={`cw-provider-row${
                      focused?.id === provider.id ? ' cw-provider-row--focus' : ''
                    }`}
                    onClick={() => setFocusProviderId(provider.id)}
                  >
                    <ProviderRailLogo provider={provider} />
                    <span className="cw-provider-row__body">
                      <span className="cw-provider-row__name">{provider.name}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="cw-catalog__templates">
              <div className="cw-catalog__col-label">
                {focused ? `${focused.name} · Services` : 'Services'}
              </div>
              {!focused || focused.services.length === 0 ? (
                <div className="cw-catalog__empty">
                  No services for this provider.
                </div>
              ) : (
                focused.services.map((svc) => {
                  const isSelected = selectedService?.serviceId === svc.id;
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      className={`cw-template-tile${
                        isSelected ? ' cw-template-tile--selected' : ''
                      }`}
                      onClick={() => onSelectService(focused.id, svc.id)}
                    >
                      <span className="cw-template-tile__head">
                        <span className="cw-template-tile__name">{svc.name}</span>
                      </span>
                      <span className="cw-svc-meta">
                        {svc.endpoints.length} endpoints · {svc.authType}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* Provider rail logo with a remote-image fallback to initials — remote
 * logo URLs can 404 / be CORS-blocked, so swap to the fallback on error. */
function ProviderRailLogo({ provider }: { provider: Provider }) {
  const [imageOk, setImageOk] = useState(true);
  const useFallback = !(provider.logoUrl && imageOk);
  return (
    <span
      className="cw-provider-row__logo"
      style={
        useFallback && provider.fallbackColor
          ? {
              background: provider.fallbackColor,
              borderColor: provider.fallbackColor,
              color: '#fff',
            }
          : undefined
      }
      aria-hidden="true"
    >
      {useFallback ? (
        provider.logo
      ) : (
        <img
          src={provider.logoUrl}
          alt=""
          onError={() => setImageOk(false)}
          loading="lazy"
        />
      )}
    </span>
  );
}

/* ── Flow 2 · endpoint vertical tab + detail ─────────────────────── */

export function EndpointTab({
  endpoint,
  active,
  enabled,
  selectable,
  onToggle,
  onSelect,
}: {
  endpoint: ServiceEndpoint;
  active: boolean;
  enabled: boolean;
  selectable: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  return (
    <div
      className={`cw-vtab${active ? ' cw-vtab--active' : ''}${
        enabled ? ' cw-vtab--on' : ''
      }`}
    >
      {selectable && (
        <label className="cw-vtab__check" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={enabled} onChange={onToggle} />
        </label>
      )}
      <button
        type="button"
        className="cw-vtab__btn"
        role="tab"
        aria-selected={active}
        onClick={onSelect}
      >
        <span className={`cw-method cw-method--${endpoint.method.toLowerCase()}`}>
          {endpoint.method}
        </span>
        <span className="cw-vtab__name">{endpoint.name}</span>
      </button>
    </div>
  );
}

/* Review-step detail — mirrors the Salesforce External Services "Review
 * Actions" screen: the generated Apex action, its Input Parameters (from the
 * request contract) and Output Parameters (keyed by HTTP response code, from
 * the response contract), plus the generated Apex class. No test step. */
export function ReviewEndpointDetail({
  endpoint,
  baseUrl,
  serviceName,
}: {
  endpoint: ServiceEndpoint;
  baseUrl: string;
  serviceName: string;
}) {
  const inputs = useMemo(
    () => [
      ...endpoint.parameters.map((p) => ({
        name: p.name,
        type: p.schema ? inferType(p.schema) : 'String',
      })),
      ...paramsFromSchema(endpoint.requestBody),
    ],
    [endpoint.parameters, endpoint.requestBody],
  );
  const outputs = useMemo(
    () => outputsFromSchema(endpoint.responseBody, serviceName),
    [endpoint.responseBody, serviceName],
  );
  const apexClass = `ExternalService.${toApexName(serviceName)}`;
  const apexMethod = `${toActionName(endpoint.name)}(input)`;

  return (
    <div className="cw-epd">
      <div className="cw-epd__head">
        <span className={`cw-method cw-method--${endpoint.method.toLowerCase()}`}>
          {endpoint.method}
        </span>
        <div className="cw-epd__title-block">
          <span className="cw-epd__name">{toActionName(endpoint.name)}</span>
          <code className="cw-epd__path">
            {baseUrl}
            {endpoint.path}
          </code>
        </div>
      </div>
      {endpoint.description && <p className="cw-ep__desc">{endpoint.description}</p>}
      <div className="cw-params cw-params--cols">
        <div className="cw-params__group">
          <div className="cw-params__label">Input Parameters</div>
          {inputs.length === 0 ? (
            <div className="cw-params__empty">No input parameters.</div>
          ) : (
            <ul className="cw-params__list">
              {inputs.map((p) => (
                <li key={p.name} className="cw-param">
                  <span className="cw-param__name">{p.name}</span>
                  <span className="cw-param__type">Type: {p.type}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="cw-params__group">
          <div className="cw-params__label">Output Parameters</div>
          <ul className="cw-params__list">
            {outputs.map((o) => (
              <li key={o.code} className="cw-param">
                <span className="cw-param__name">{o.code}</span>
                <span className="cw-param__desc">{o.label}</span>
                <span className="cw-param__type">Type: {o.type}</span>
              </li>
            ))}
          </ul>
          <div className="cw-apex">
            <span className="cw-param__name">Apex Class</span>
            <code className="cw-apex__code">
              {apexClass}.{apexMethod}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Derive a flat parameter list (name + display type) from the request body's
 * JSON Schema. Empty when the schema isn't an object. */
function paramsFromSchema(
  schema?: JsonSchema,
): { name: string; type: string }[] {
  if (!schema || schema.type !== 'object' || !schema.properties) return [];
  return Object.entries(schema.properties).map(([name, prop]) => ({
    name,
    type: inferType(prop),
  }));
}

/** Build the External-Services-style output parameter list: a 200 OK response
 * typed against the generated response DTO, plus a default String response. */
function outputsFromSchema(
  schema: JsonSchema | undefined,
  serviceName: string,
): { code: string; label: string; type: string }[] {
  const dto = `${toApexName(serviceName)}_ResponseDTO`;
  let okType = 'String';
  if (schema?.type === 'array') okType = `List of ${dto}`;
  else if (schema?.type === 'object') okType = dto;
  return [
    { code: '200', label: 'OK', type: okType },
    { code: 'default', label: 'Default response', type: 'String' },
  ];
}

/** Infer a display type name from a property's JSON Schema. */
function inferType(schema: JsonSchema): string {
  switch (schema.type) {
    case 'array': {
      const inner = schema.items ? inferType(schema.items) : 'Object';
      return `List of ${inner}`;
    }
    case 'integer':
      return 'Integer';
    case 'number':
      return 'Decimal';
    case 'boolean':
      return 'Boolean';
    case 'object':
      return 'Object';
    default:
      return 'String';
  }
}

/** PascalCase, alphanumeric-only name used for the generated Apex class. */
function toApexName(name: string): string {
  const parts = name.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/);
  const pascal = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
  return pascal || 'ExternalService';
}

/** camelCase action/method name, e.g. "Company Lookup" → "companyLookupAPI". */
function toActionName(name: string): string {
  const pascal = toApexName(name);
  return `${pascal.charAt(0).toLowerCase()}${pascal.slice(1)}API`;
}

/* Read-only endpoint detail — request/response only, no enable/test.
 * Used by the auth wizard's Service Details step to preview the contract. */
function ReadOnlyEndpointDetail({
  endpoint,
  baseUrl,
}: {
  endpoint: ServiceEndpoint;
  baseUrl: string;
}) {
  return (
    <div className="cw-epd">
      <div className="cw-epd__head">
        <span className={`cw-method cw-method--${endpoint.method.toLowerCase()}`}>
          {endpoint.method}
        </span>
        <div className="cw-epd__title-block">
          <span className="cw-epd__name">{endpoint.name}</span>
          <code className="cw-epd__path">
            {baseUrl}
            {endpoint.path}
          </code>
        </div>
      </div>
      <p className="cw-ep__desc">{endpoint.description}</p>
      <div className="cw-schema-grid">
        <div className="cw-schema">
          <div className="cw-schema__label">Request</div>
          <pre className="cw-schema__code">{endpoint.requestExample}</pre>
        </div>
        <div className="cw-schema">
          <div className="cw-schema__label">Response</div>
          <pre className="cw-schema__code">{endpoint.responseExample}</pre>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * Shared credentials pane (used by Flow 1)
 * ═════════════════════════════════════════════════════════════════ */

function CredentialsPane({
  service,
  fields,
  creds,
  onCred,
  headers,
  onHeaders,
  timeoutMs,
  onTimeout,
  maxRetries,
  onMaxRetries,
}: {
  service: ProviderService;
  fields: CredentialField[];
  creds: Record<string, string>;
  onCred: (key: string, value: string) => void;
  headers: ConnectionHeader[];
  onHeaders: (next: ConnectionHeader[]) => void;
  timeoutMs: string;
  onTimeout: (v: string) => void;
  maxRetries: string;
  onMaxRetries: (v: string) => void;
}) {
  const setHeader = (idx: number, patch: Partial<ConnectionHeader>) =>
    onHeaders(headers.map((h, i) => (i === idx ? { ...h, ...patch } : h)));
  const removeHeader = (idx: number) =>
    onHeaders(headers.filter((_, i) => i !== idx));
  const addHeader = () => onHeaders([...headers, { name: '', value: '' }]);

  return (
    <div className="cw-body">
      <p className="cw-hint">
        {service.name} authenticates with <strong>{service.authType}</strong>.
        Credentials are shared across every endpoint and connection built on
        this service.
      </p>
      {fields.length === 0 ? (
        <div className="cw-empty">
          No credentials are required for this authentication type.
        </div>
      ) : (
        <div className="cw-creds">
          {fields.map((f) => (
            <Input
              key={f.key}
              label={f.label}
              type={f.type === 'password' ? 'password' : 'text'}
              value={creds[f.key] ?? ''}
              onChange={(e) => onCred(f.key, e.target.value)}
              placeholder={f.placeholder}
              hint={f.hint}
              fullWidth
            />
          ))}
        </div>
      )}

      <div className="cw-headers">
        <div className="cw-headers__head">
          <span className="cw-headers__title">Request Headers</span>
          <button type="button" className="cw-headers__add" onClick={addHeader}>
            <Icon name="plus" size={12} />
            Add Header
          </button>
        </div>
        {headers.length === 0 ? (
          <div className="cw-empty">No request headers.</div>
        ) : (
          <div className="cw-headers__grid">
            {headers.map((h, i) => (
              <div key={i} className="cw-headers__row">
                <Input
                  aria-label="Header name"
                  placeholder="Header"
                  value={h.name}
                  onChange={(e) => setHeader(i, { name: e.target.value })}
                  fullWidth
                />
                <Input
                  aria-label="Header value"
                  placeholder="Value"
                  value={h.value}
                  onChange={(e) => setHeader(i, { value: e.target.value })}
                  fullWidth
                />
                <button
                  type="button"
                  className="cw-headers__remove"
                  aria-label="Remove header"
                  onClick={() => removeHeader(i)}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="cw-form__row">
        <Input
          label="Timeout (ms)"
          type="number"
          min={0}
          value={timeoutMs}
          onChange={(e) => onTimeout(e.target.value)}
          fullWidth
        />
        <Input
          label="Max Retries"
          type="number"
          min={0}
          value={maxRetries}
          onChange={(e) => onMaxRetries(e.target.value)}
          fullWidth
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * Shared modal shell — optional left stepper + scrollable body
 * ═════════════════════════════════════════════════════════════════ */

function WizardShell({
  open,
  onClose,
  title,
  steps,
  step,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  steps?: readonly string[];
  step?: number;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="lg" footer={footer}>
      <div className="cw">
        {steps && (
          <ol className="cw-steps" aria-label="Steps">
            {steps.map((label, idx) => {
              const state =
                step === idx ? 'active' : (step ?? 0) > idx ? 'done' : 'todo';
              return (
                <li key={label} className={`cw-step cw-step--${state}`}>
                  <span className="cw-step__num">
                    {state === 'done' ? <Icon name="check" size={12} /> : idx + 1}
                  </span>
                  <span className="cw-step__label">{label}</span>
                </li>
              );
            })}
          </ol>
        )}
        <div className="cw-content">{children}</div>
      </div>
    </Modal>
  );
}

/* ── Shared bits ─────────────────────────────────────────────────── */

function ContractField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="cw-contract__field">
      <dt>{label}</dt>
      <dd className={mono ? 'cw-mono' : ''}>{value}</dd>
    </div>
  );
}
