import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Badge, Button, Icon, Input, Modal, Textarea, type IconName } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import { type Authentication } from '@/types/config';
import {
  PROVIDERS,
  PROVIDER_STATUSES,
  getAllProviders,
  findServiceById,
  materializeService,
  type EndpointParameter,
  type JsonSchema,
  type OpenApiDocument,
  type Provider,
  type ProviderService,
  type ProviderStatus,
} from '@/panels/IntegrationHub/providers';
import {
  AuthWizardModal,
  DccAuthWizardModal,
  DccConnectionDeployModal,
  ConnectionWizardModal,
  type ServiceSelection,
} from './ConnectWizardModal';
import '@/panels/ActivitiesAndStages/ActivitiesEntityEditor.css';
import '@/panels/LinesOfBusiness/LobActivitiesSection.css';
import '@/panels/LinesOfBusiness/LobStageManagementSection.css';
import '@/panels/RunMyDay/PlaybookWizard.css';
import '@salesforce-ux/design-system-2/dist/components/visualPicker/visualPicker.css';
import './ConnectWizard.css';
import './IntegrationsCatalog.css';

/**
 * General Setup → Integrations → Provider Catalog.
 *
 * Provider → Service → Endpoint browser over the code-seeded catalog
 * (providers.ts). Left rail lists providers with a governance status
 * badge; the right pane shows the focused provider's services, each with
 * its API contract summary, endpoint list, and a one-click Activate button
 * that launches the Connect wizard pre-seeded from the service blueprint.
 *
 * Governance is lightweight: a "Proposed" provider must be Approved
 * (→ Available) before its services can be activated; "Available" providers
 * can be Retired (→ Inactive). The status override persists to
 * config.providerStatusOverrides, keyed by provider id.
 */

/** Resolve a provider's effective status, applying any persisted override. */
function effectiveStatus(
  provider: Provider,
  overrides: Record<string, string> | undefined,
): ProviderStatus {
  const o = overrides?.[provider.id];
  if (o && (PROVIDER_STATUSES as string[]).includes(o)) {
    return o as ProviderStatus;
  }
  return provider.status;
}

interface IntegrationsCatalogSectionProps {
  /** 'catalog' (default) is the editable Provider Catalog. 'dcc-library' is a
   * read-only view scoped to Data Cloud Connector services — no add provider /
   * add service, and only DCC providers/services are shown. */
  mode?: 'catalog' | 'dcc-library';
}

export function IntegrationsCatalogSection({
  mode = 'catalog',
}: IntegrationsCatalogSectionProps = {}) {
  const { config, update } = useConfig();
  const isLibrary = mode === 'dcc-library';
  // Merge seeded + custom providers (minus any the user deleted) so newly-added
  // providers/services show up and removed ones stay gone. In library mode,
  // keep only Data Cloud Connector services (and providers that have one);
  // the catalog conversely hides DCC-only providers so Bridge FT lives solely
  // in the library.
  const providers = useMemo(() => {
    const hidden = new Set(config.hiddenProviderIds ?? []);
    const isDcc = (s: ProviderService) => s.type === 'Data Cloud Connector';
    return getAllProviders()
      .filter((p) => !hidden.has(p.id))
      .map((p) => ({
        ...p,
        services: p.services.filter((s) => (isLibrary ? isDcc(s) : !isDcc(s))),
      }))
      .filter((p) => p.services.length > 0);
    // customProviders / hiddenProviderIds drive the output; re-derive on change.
  }, [config.customProviders, config.hiddenProviderIds, isLibrary]);
  const [focusedId, setFocusedId] = useState<string>(
    () => providers[0]?.id ?? '',
  );
  // Flow 1 (Authenticate) target service, and Flow 2 (Connection) target auth.
  const [authService, setAuthService] = useState<ServiceSelection | null>(null);
  // Data Cloud Connector services route to the dedicated data-stream wizard.
  const authServiceIsDcc =
    findServiceById(authService?.serviceId)?.service.type ===
    'Data Cloud Connector';
  const [connectAuthId, setConnectAuthId] = useState<number | null>(null);
  // P2P "Connect": open the connection wizard seeded to this service.
  const [connectService, setConnectService] = useState<ServiceSelection | null>(
    null,
  );
  // Re-authenticate an existing authentication (Flow 1 in edit mode).
  const [reauthAuth, setReauthAuth] = useState<Authentication | null>(null);
  // Deploy a Data Cloud connection on an authenticated DCC service.
  const [deployAuth, setDeployAuth] = useState<Authentication | null>(null);
  // Service whose tile dropdown menu is open.
  const [openMenuServiceId, setOpenMenuServiceId] = useState<string | null>(
    null,
  );
  // Add-Provider modal + New/Edit-Service wizard.
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  // Provider being edited in the Add-Provider modal (null = creating new).
  const [editingProviderId, setEditingProviderId] = useState<string | null>(
    null,
  );
  // Provider row whose dropdown menu is open.
  const [openMenuProviderId, setOpenMenuProviderId] = useState<string | null>(
    null,
  );
  // Service whose read-only OpenAPI reference modal is open (P2P tile click).
  const [viewServiceId, setViewServiceId] = useState<string | null>(null);
  // "Add new specification" import modal (upload / URL / paste an OpenAPI doc).
  const [specModalOpen, setSpecModalOpen] = useState(false);
  const [providerQuery, setProviderQuery] = useState('');
  const [serviceQuery, setServiceQuery] = useState('');

  const overrides = config.providerStatusOverrides;
  const instances = config.connectionInstances ?? [];
  const authentications = config.authentications ?? [];

  const focused = useMemo(
    () => providers.find((p) => p.id === focusedId) ?? providers[0],
    [providers, focusedId],
  );
  const focusedStatus = focused
    ? effectiveStatus(focused, overrides)
    : 'Inactive';

  // The authentication (if any) for a given service id.
  const authForService = (serviceId: string) =>
    authentications.find((a) => a.serviceId === serviceId);
  // Count of connections built on a given service.
  const connCountForService = (serviceId: string) =>
    instances.filter((i) => i.serviceId === serviceId).length;

  // Deactivate removes the authentication and every connection bound to it.
  const onDeactivate = (auth: Authentication) => {
    const boundCount = instances.filter((i) => i.authId === auth.id).length;
    const message = boundCount
      ? `Deactivate "${auth.name}"? This also deletes ${boundCount} connection${boundCount === 1 ? '' : 's'} built on it.`
      : `Deactivate "${auth.name}"?`;
    if (!confirm(message)) return;
    update((p) => ({
      ...p,
      authentications: (p.authentications ?? []).filter((a) => a.id !== auth.id),
      connectionInstances: (p.connectionInstances ?? []).filter(
        (i) => i.authId !== auth.id,
      ),
    }));
    setOpenMenuServiceId(null);
  };

  // Disconnect flips the authentication back to Unauthenticated and marks its
  // connections Disconnected — without deleting anything (unlike Deactivate).
  const onDisconnect = (auth: Authentication) => {
    if (!confirm(`Disconnect "${auth.name}"?`)) return;
    update((p) => ({
      ...p,
      authentications: (p.authentications ?? []).map((a) =>
        a.id === auth.id ? { ...a, status: 'Unauthenticated' } : a,
      ),
      connectionInstances: (p.connectionInstances ?? []).map((i) =>
        i.authId === auth.id ? { ...i, status: 'Disconnected' } : i,
      ),
    }));
    setOpenMenuServiceId(null);
  };

  // Persist a provider (create or edit). New providers append a standalone
  // custom entry; editing writes/updates a custom entry keyed by the existing
  // id whose metadata shadows the seeded provider (getAllProviders merges it),
  // preserving any services already overlaid on it.
  const onSaveProvider = (provider: Provider) => {
    update((p) => {
      const list = p.customProviders ?? [];
      const existing = list.find((c) => c.id === provider.id);
      if (existing) {
        return {
          ...p,
          customProviders: list.map((c) =>
            c.id === provider.id
              ? { ...provider, services: existing.services }
              : c,
          ),
        };
      }
      return { ...p, customProviders: [...list, provider] };
    });
    setFocusedId(provider.id);
    setProviderModalOpen(false);
    setEditingProviderId(null);
  };

  // Delete a provider. Standalone custom providers are removed from
  // customProviders; seeded providers (which live in code) are recorded in
  // hiddenProviderIds so the catalog filters them out.
  const onDeleteProvider = (provider: Provider) => {
    const svcCount = provider.services.length;
    const message = svcCount
      ? `Delete "${provider.name}" and its ${svcCount} service${svcCount === 1 ? '' : 's'}?`
      : `Delete "${provider.name}"?`;
    if (!confirm(message)) return;
    const isSeeded = PROVIDERS.some((s) => s.id === provider.id);
    update((p) => ({
      ...p,
      customProviders: (p.customProviders ?? []).filter(
        (c) => c.id !== provider.id,
      ),
      hiddenProviderIds: isSeeded
        ? Array.from(new Set([...(p.hiddenProviderIds ?? []), provider.id]))
        : p.hiddenProviderIds,
    }));
    setOpenMenuProviderId(null);
    setFocusedId((cur) => (cur === provider.id ? '' : cur));
  };

  // Add an imported spec as a new service on the focused provider. Services
  // live in an overlay custom entry keyed by provider id; getAllProviders
  // appends it to the (possibly seeded) provider's service list.
  const onImportService = (service: ProviderService) => {
    if (!focused) return;
    const providerId = focused.id;
    update((p) => {
      const list = p.customProviders ?? [];
      const existing = list.find((c) => c.id === providerId);
      if (existing) {
        return {
          ...p,
          customProviders: list.map((c) =>
            c.id === providerId
              ? { ...c, services: [...c.services, service] }
              : c,
          ),
        };
      }
      // Seeded provider with no overlay yet — create one carrying its metadata.
      const overlay: Provider = {
        id: focused.id,
        name: focused.name,
        description: focused.description,
        status: focused.status,
        logo: focused.logo,
        logoUrl: focused.logoUrl,
        fallbackColor: focused.fallbackColor,
        services: [service],
      };
      return { ...p, customProviders: [...list, overlay] };
    });
    setSpecModalOpen(false);
  };

  const visibleProviders = useMemo(() => {
    const q = providerQuery.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter((p) => p.name.toLowerCase().includes(q));
  }, [providers, providerQuery]);

  const visibleServices = useMemo(() => {
    const list = focused?.services ?? [];
    const q = serviceQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s) => s.name.toLowerCase().includes(q));
  }, [focused, serviceQuery]);

  return (
    <div className="ic-split">
      <aside className="ic-providers">
        <header className="ic-providers__head">
          <h4 className="ic-providers__title">Providers</h4>
          <span className="ic-providers__sub">
            {providers.length} provider{providers.length === 1 ? '' : 's'}{' '}
            {isLibrary ? 'in the library.' : 'in the catalog.'}
          </span>
        </header>
        <div className="lob-activities__toolbar">
          <Input
            placeholder="Search by name"
            iconLeading={<Icon name="search" size={14} />}
            value={providerQuery}
            onChange={(e) => setProviderQuery(e.target.value)}
            aria-label="Search providers by name"
            className="lob-activities__search"
          />
          {!isLibrary && (
            <button
              type="button"
              className="lob-activities__new-btn"
              onClick={() => {
                setEditingProviderId(null);
                setProviderModalOpen(true);
              }}
            >
              <Icon name="plus" size={14} />
              New Provider
            </button>
          )}
        </div>
        <div className="ic-providers__list">
          {visibleProviders.length === 0 ? (
            <div className="lob-activities__empty">
              No providers match "{providerQuery}".
            </div>
          ) : (
            visibleProviders.map((p) => (
              <ProviderRow
                key={p.id}
                provider={p}
                focused={focusedId === p.id}
                showMenu={!isLibrary}
                menuOpen={openMenuProviderId === p.id}
                onMenuToggle={(next) =>
                  setOpenMenuProviderId(
                    next
                      ? p.id
                      : openMenuProviderId === p.id
                        ? null
                        : openMenuProviderId,
                  )
                }
                onClick={() => setFocusedId(p.id)}
                onEdit={() => {
                  setOpenMenuProviderId(null);
                  setEditingProviderId(p.id);
                  setProviderModalOpen(true);
                }}
                onDelete={() => onDeleteProvider(p)}
              />
            ))
          )}
        </div>
      </aside>

      <div className="ic-detail">
        {focused && (
          <>
            <header className="ic-detail__head">
              <div className="ic-detail__title-row">
                <ProviderLogo provider={focused} />
                <div style={{ flex: 1 }}>
                  <h3 className="ic-detail__title">{focused.name}</h3>
                </div>
              </div>
            </header>

            <div className="lob-activities__toolbar">
              <Input
                placeholder="Search by name"
                iconLeading={<Icon name="search" size={14} />}
                value={serviceQuery}
                onChange={(e) => setServiceQuery(e.target.value)}
                aria-label="Search services by name"
                className="lob-activities__search"
              />
              {!isLibrary && (
                <button
                  type="button"
                  className="lob-activities__new-btn"
                  onClick={() => setSpecModalOpen(true)}
                >
                  <Icon name="plus" size={14} />
                  Add new specification
                </button>
              )}
            </div>

            <div className="ic-services">
              {focused.services.length === 0 ? (
                <div className="lob-activities__empty">
                  <p style={{ margin: 0 }}>
                    {isLibrary
                      ? 'No connectors available for this provider.'
                      : 'No services available for this provider.'}
                  </p>
                </div>
              ) : visibleServices.length === 0 ? (
                <div className="lob-activities__empty">
                  No services match "{serviceQuery}".
                </div>
              ) : null}
              {visibleServices.map((svc) => {
                const auth = authForService(svc.id);
                return (
                  <ServiceCard
                    key={svc.id}
                    service={svc}
                    canActivate={focusedStatus === 'Available'}
                    auth={auth}
                    connectionCount={connCountForService(svc.id)}
                    menuOpen={openMenuServiceId === svc.id}
                    onMenuToggle={(next) =>
                      setOpenMenuServiceId(
                        next
                          ? svc.id
                          : openMenuServiceId === svc.id
                            ? null
                            : openMenuServiceId,
                      )
                    }
                    onOpen={() => setViewServiceId(svc.id)}
                    onConnect={() =>
                      setConnectService({
                        providerId: focused.id,
                        serviceId: svc.id,
                      })
                    }
                    onAuthenticate={() =>
                      setAuthService({
                        providerId: focused.id,
                        serviceId: svc.id,
                      })
                    }
                    onAddConnection={() => {
                      setOpenMenuServiceId(null);
                      if (auth) setConnectAuthId(auth.id);
                    }}
                    onDeploy={() => {
                      setOpenMenuServiceId(null);
                      if (auth) setDeployAuth(auth);
                    }}
                    onReauthenticate={() => {
                      setOpenMenuServiceId(null);
                      // DCC re-auth relaunches the same 3-step Connect flow.
                      if (!auth) return;
                      setAuthService({
                        providerId: focused.id,
                        serviceId: svc.id,
                      });
                    }}
                    onDisconnect={() => auth && onDisconnect(auth)}
                    onDeactivate={() => auth && onDeactivate(auth)}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Flow 1 — authenticate; on success hand off into Flow 2. Data Cloud
          Connector services use a dedicated data-stream wizard instead. */}
      <AuthWizardModal
        open={authService != null && !authServiceIsDcc}
        service={authService}
        onClose={() => setAuthService(null)}
        onAuthenticated={(authId) => {
          setAuthService(null);
          setConnectAuthId(authId);
        }}
      />

      {/* Flow 1b — Data Cloud Connector authentication (3-step). */}
      <DccAuthWizardModal
        open={authService != null && authServiceIsDcc}
        service={authService}
        onClose={() => setAuthService(null)}
        onAuthenticated={() => setAuthService(null)}
      />

      {/* Flow 1 (edit) — re-authenticate an existing authentication. */}
      <AuthWizardModal
        open={reauthAuth != null}
        existingAuth={reauthAuth}
        onClose={() => setReauthAuth(null)}
      />

      {/* Flow 2 — build a connection on an authenticated service. */}
      <ConnectionWizardModal
        open={connectAuthId != null}
        authId={connectAuthId}
        onClose={() => setConnectAuthId(null)}
      />

      {/* P2P Connect — open the connection wizard seeded to a catalog service. */}
      <ConnectionWizardModal
        open={connectService != null}
        presetService={connectService}
        onClose={() => setConnectService(null)}
      />

      {/* Flow 2b — deploy a Data Cloud connection on an authenticated DCC service. */}
      {deployAuth && (
        <DccConnectionDeployModal
          open={deployAuth != null}
          auth={deployAuth}
          onClose={() => setDeployAuth(null)}
        />
      )}

      {/* New / Edit provider. */}
      <AddProviderModal
        open={providerModalOpen}
        existingIds={providers.map((p) => p.id)}
        editingProvider={
          editingProviderId
            ? providers.find((p) => p.id === editingProviderId)
            : undefined
        }
        onClose={() => {
          setProviderModalOpen(false);
          setEditingProviderId(null);
        }}
        onSave={onSaveProvider}
      />

      {/* Read-only OpenAPI reference for a service (tile click). */}
      <ServiceReferenceModal
        open={viewServiceId != null}
        service={focused?.services.find((s) => s.id === viewServiceId)}
        providerName={focused?.name ?? ''}
        onClose={() => setViewServiceId(null)}
      />

      {/* Add new specification — import an OpenAPI doc as a new service. */}
      <AddSpecModal
        open={specModalOpen}
        providerName={focused?.name ?? ''}
        existingServiceIds={providers.flatMap((p) =>
          p.services.map((s) => s.id),
        )}
        onClose={() => setSpecModalOpen(false)}
        onImport={onImportService}
      />
    </div>
  );
}

/* ── Add Provider modal ──────────────────────────────────────────── */

/** Slugify a provider name into a stable-ish id, disambiguated against
 * existing ids so overlays don't collide with unrelated new providers. */
function makeProviderId(name: string, taken: string[]): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'provider';
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

interface AddProviderModalProps {
  open: boolean;
  existingIds: string[];
  /** When set, the modal edits this provider instead of creating one. */
  editingProvider?: Provider;
  onClose: () => void;
  onSave: (provider: Provider) => void;
}

function AddProviderModal({
  open,
  existingIds,
  editingProvider,
  onClose,
  onSave,
}: AddProviderModalProps) {
  const isEdit = editingProvider != null;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editingProvider) {
      setName(editingProvider.name);
      setDescription(editingProvider.description ?? '');
    } else {
      setName('');
      setDescription('');
    }
  }, [open, editingProvider]);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      alert('Provider Name is required.');
      return;
    }
    const initials =
      trimmed
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('') || trimmed.slice(0, 2).toUpperCase();
    onSave({
      ...(editingProvider ?? {}),
      id: editingProvider
        ? editingProvider.id
        : makeProviderId(trimmed, existingIds),
      name: trimmed,
      description: description.trim(),
      status: editingProvider?.status ?? 'Available',
      logo: editingProvider?.logo ?? initials,
      services: editingProvider?.services ?? [],
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Provider' : 'New Provider'}
      size="sm"
      footer={
        <>
          <span style={{ flex: 1 }} />
          <Button variant="neutral" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="brand" onClick={save}>
            {isEdit ? 'Save Provider' : 'New Provider'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input
          label="Provider Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Verisk Analytics"
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What data or capability does this provider offer?"
        />
      </div>
    </Modal>
  );
}

/* ── Add specification modal (import an OpenAPI doc as a service) ───── */

/** Slugify a service name into a stable-ish id, disambiguated against the
 * ids already in use so an imported spec never collides with another. */
function makeServiceId(name: string, taken: string[]): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'service';
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** Parse + shallow-validate an OpenAPI 3.0 JSON document. Returns the parsed
 * document, or throws an Error with a human-readable message. */
function parseOpenApiSpec(text: string): OpenApiDocument {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('The specification is empty.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(
      'Could not parse as JSON. Paste or upload an OpenAPI 3.0 JSON document (YAML is not supported).',
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The specification must be a JSON object.');
  }
  const doc = parsed as Record<string, unknown>;
  if (typeof doc.openapi !== 'string' || !doc.openapi.startsWith('3.')) {
    throw new Error('Missing or unsupported "openapi" version (expected 3.x).');
  }
  if (!doc.paths || typeof doc.paths !== 'object') {
    throw new Error('The specification has no "paths".');
  }
  return parsed as OpenApiDocument;
}

type SpecSource = 'upload' | 'url' | 'paste';

interface AddSpecModalProps {
  open: boolean;
  providerName: string;
  existingServiceIds: string[];
  onClose: () => void;
  onImport: (service: ProviderService) => void;
}

function AddSpecModal({
  open,
  providerName,
  existingServiceIds,
  onClose,
  onImport,
}: AddSpecModalProps) {
  const [source, setSource] = useState<SpecSource>('upload');
  const [fileName, setFileName] = useState('');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSource('upload');
    setFileName('');
    setText('');
    setUrl('');
    setError(null);
    setLoading(false);
  }, [open]);

  const buildService = (spec: OpenApiDocument): ProviderService => {
    const name = spec.info?.title?.trim() || fileName.replace(/\.\w+$/, '') || 'Imported Service';
    const description = spec.info?.description?.trim() ?? '';
    const id = makeServiceId(name, existingServiceIds);
    return materializeService(id, name, description, 'P2P', spec);
  };

  const importText = (raw: string) => {
    try {
      const spec = parseOpenApiSpec(raw);
      onImport(buildService(spec));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not import the specification.');
    }
  };

  const onFile = (file: File) => {
    setError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ''));
    reader.onerror = () => setError('Could not read the file.');
    reader.readAsText(file);
  };

  const onImportClick = async () => {
    setError(null);
    if (source === 'url') {
      const trimmed = url.trim();
      if (!trimmed) {
        setError('Enter a URL to the specification.');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(trimmed);
        if (!res.ok) throw new Error(`Request failed (${res.status}).`);
        const body = await res.text();
        importText(body);
      } catch (e) {
        setError(
          e instanceof Error
            ? `Could not fetch the specification: ${e.message}`
            : 'Could not fetch the specification.',
        );
      } finally {
        setLoading(false);
      }
      return;
    }
    // upload + paste both resolve to the buffered text.
    if (!text.trim()) {
      setError(
        source === 'upload'
          ? 'Choose a specification file to upload.'
          : 'Paste a specification to import.',
      );
      return;
    }
    importText(text);
  };

  const SOURCES: { value: SpecSource; label: string; hint: string; icon: IconName }[] = [
    { value: 'upload', label: 'Upload file', hint: 'Choose an OpenAPI 3.0 JSON file from your device.', icon: 'upload' },
    { value: 'url', label: 'URL', hint: 'Fetch the specification from a public URL.', icon: 'external-link' },
    { value: 'paste', label: 'Paste spec', hint: 'Paste the OpenAPI 3.0 JSON directly.', icon: 'doc' },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Add new specification${providerName ? ` · ${providerName}` : ''}`}
      size="md"
      footer={
        <>
          <span style={{ flex: 1 }} />
          <Button variant="neutral" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="brand" onClick={onImportClick} disabled={loading}>
            {loading ? 'Importing…' : 'Import Specification'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          role="radiogroup"
          aria-label="Specification source"
          className="ic-vpicker"
        >
          {SOURCES.map((s) => {
            const id = `ic-spec-${s.value}`;
            return (
              <span key={s.value} className="slds-visual-picker">
                <input
                  type="radio"
                  id={id}
                  name="ic-spec-source"
                  value={s.value}
                  checked={source === s.value}
                  onChange={() => {
                    setSource(s.value);
                    setError(null);
                  }}
                />
                <label htmlFor={id}>
                  <span className="slds-visual-picker__figure slds-visual-picker__text">
                    <span className="ic-vpicker__content">
                      <span className="ic-vpicker__glyph">
                        <Icon name={s.icon} size={20} />
                      </span>
                      <span className="ic-vpicker__lines">
                        <span className="slds-text-heading_small">{s.label}</span>
                        <span className="ic-vpicker__hint">{s.hint}</span>
                      </span>
                    </span>
                  </span>
                  <span className="slds-icon_container slds-visual-picker__text-check">
                    <Icon name="check" size={12} />
                  </span>
                </label>
              </span>
            );
          })}
        </div>

        {source === 'upload' && (
          <div className="ic-spec__upload">
            <label className="ic-spec__file-btn">
              <Icon name="upload" size={14} />
              Upload file
              <input
                type="file"
                accept=".json,application/json"
                className="ic-spec__file-input"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                  e.currentTarget.value = '';
                }}
              />
            </label>
            {fileName ? (
              <span className="ic-spec__file-name">
                <Icon name="doc" size={14} />
                {fileName}
              </span>
            ) : (
              <span className="ic-spec__file-hint">
                Accepts an OpenAPI 3.0 JSON file.
              </span>
            )}
          </div>
        )}

        {source === 'url' && (
          <Input
            label="Specification URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.example.com/openapi.json"
          />
        )}

        {source === 'paste' && (
          <Textarea
            label="OpenAPI 3.0 JSON"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            spellCheck={false}
            className="ic-spec__code"
            placeholder='{\n  "openapi": "3.0.0",\n  "info": { "title": "My API" },\n  "paths": { }\n}'
          />
        )}

        {error && <p className="ic-spec__error">{error}</p>}
      </div>
    </Modal>
  );
}

/* ── Service reference modal (read-only OpenAPI view) ────────────────
 * Opened by clicking a service tile. Renders the service's canonical
 * OpenAPI 3.0 spec as a Swagger/Redoc-style reference: an info header
 * (servers / security / rate limit / docs), then one expandable row per
 * operation with its request and response examples. */

interface ServiceReferenceModalProps {
  open: boolean;
  service?: ProviderService;
  providerName: string;
  onClose: () => void;
}

function ServiceReferenceModal({
  open,
  service,
  providerName,
  onClose,
}: ServiceReferenceModalProps) {
  if (!open || !service) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${service.name}${providerName ? ` · ${providerName}` : ''}`}
      size="lg"
      footer={
        <>
          <span style={{ flex: 1 }} />
          <Button variant="neutral" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <ServiceReferenceView service={service} />
    </Modal>
  );
}

interface ServiceReferenceViewProps {
  service: ProviderService;
  /** When provided, each operation in the left rail gets a checkbox and this
   * set drives its checked state — turning the read-only reference into an
   * endpoint picker (used by the connection wizard's Select Endpoints step). */
  selectedEndpointIds?: string[];
  onToggleEndpoint?: (id: string) => void;
}

/** The OpenAPI reference body — view switch, info header, and the operations
 * list/detail split. Rendered inside the read-only service modal and, with
 * selection props, inside the connection wizard's Select Endpoints step. */
export function ServiceReferenceView({
  service,
  selectedEndpointIds,
  onToggleEndpoint,
}: ServiceReferenceViewProps) {
  const selectable = !!onToggleEndpoint;
  // Top-level view: the field-tree UI ('structured') or the raw OpenAPI
  // document ('json'). Selected endpoint (left rail) and, within it, the
  // selected response status (responses sub-rail). All reset per service.
  const [viewMode, setViewMode] = useState<'structured' | 'json'>('structured');
  const [selectedEpId, setSelectedEpId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  useEffect(() => {
    const first = service.endpoints[0];
    setViewMode('structured');
    setSelectedEpId(first?.id ?? '');
    setSelectedStatus(first?.responses[0]?.status ?? '');
  }, [service.id]);

  // Selecting an endpoint resets the request + response sub-rails to their
  // first entries.
  const selectEndpoint = (ep: ProviderService['endpoints'][number]) => {
    setSelectedEpId(ep.id);
    setSelectedStatus(ep.responses[0]?.status ?? '');
  };
  const selectedEp =
    service.endpoints.find((e) => e.id === selectedEpId) ??
    service.endpoints[0];
  const selectedRes =
    selectedEp?.responses.find((r) => r.status === selectedStatus) ??
    selectedEp?.responses[0];

  const spec = service.spec;
  const securitySchemeName = Object.keys(
    spec.components?.securitySchemes ?? {},
  )[0];
  const isDcc = service.type === 'Data Cloud Connector';

  return (
      <div className="ic-svc__details">
        {/* Top-level view switch — Structured field tree ↔ raw OpenAPI JSON. */}
        <div className="ic-ref__viewbar">
          <div
            className="iws-layout-toggle"
            role="tablist"
            aria-label="Reference view"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'structured'}
              className={`iws-layout-toggle__btn${
                viewMode === 'structured' ? ' iws-layout-toggle__btn--active' : ''
              }`}
              onClick={() => setViewMode('structured')}
            >
              Structured
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'json'}
              className={`iws-layout-toggle__btn${
                viewMode === 'json' ? ' iws-layout-toggle__btn--active' : ''
              }`}
              onClick={() => setViewMode('json')}
            >
              JSON
            </button>
          </div>
          <Badge tone="brand" outline>
            OpenAPI {spec.openapi}
          </Badge>
        </div>

        {viewMode === 'json' ? (
          <JsonHighlight value={spec} />
        ) : (
          <>
        <div className="ic-svc-modal__head">
          <div style={{ minWidth: 0 }}>
            {service.description && (
              <p className="ic-svc__desc">{service.description}</p>
            )}
          </div>
        </div>

        {/* Info header — servers / auth / rate limit / version. */}
        <dl className="ic-svc__meta">
          <div className="ic-svc__cell">
            <dt>Server</dt>
            <dd className="ic-mono">{service.baseUrl || '—'}</dd>
          </div>
          <div className="ic-svc__cell">
            <dt>Security</dt>
            <dd>
              {service.authType}
              {securitySchemeName ? ` (${securitySchemeName})` : ''}
            </dd>
          </div>
          <div className="ic-svc__cell">
            <dt>Rate Limit</dt>
            <dd>{service.contract.rateLimit}</dd>
          </div>
          <div className="ic-svc__cell">
            <dt>Version</dt>
            <dd>{spec.info.version}</dd>
          </div>
        </dl>

        {service.contract.notes && (
          <p className="ic-svc__notes">{service.contract.notes}</p>
        )}
        {service.contract.docsUrl && (
          <a
            className="ic-svc__docs"
            href={service.contract.docsUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="doc" size={14} />
            API reference
          </a>
        )}

        {/* Operations — 2-column: endpoint list (left) / detail (right). */}
        <div className="ic-ref__ops">
          <h4 className="ic-ref__ops-title">
            {isDcc ? 'Data Streams' : 'Operations'} ({service.endpoints.length})
          </h4>
          {service.endpoints.length === 0 ? (
            <div className="lob-activities__empty" style={{ margin: 0 }}>
              No {isDcc ? 'data streams' : 'operations'} defined.
            </div>
          ) : (
            <div className="cw-vtabs">
              <div
                className="cw-vtabs__list"
                role="tablist"
                aria-orientation="vertical"
                aria-label={isDcc ? 'Data streams' : 'Operations'}
              >
                {service.endpoints.map((ep) => {
                  const checked = selectedEndpointIds?.includes(ep.id) ?? false;
                  return (
                    <div
                      key={ep.id}
                      className={`cw-vtab${
                        ep.id === selectedEp?.id ? ' cw-vtab--active' : ''
                      }${selectable && checked ? ' cw-vtab--on' : ''}`}
                    >
                      {selectable && (
                        <label
                          className="cw-vtab__check"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggleEndpoint?.(ep.id)}
                          />
                        </label>
                      )}
                      <button
                        type="button"
                        className="cw-vtab__btn"
                        role="tab"
                        aria-selected={ep.id === selectedEp?.id}
                        onClick={() => selectEndpoint(ep)}
                      >
                        <span
                          className={`cw-method cw-method--${ep.method.toLowerCase()}`}
                        >
                          {ep.method}
                        </span>
                        <span className="cw-vtab__name">{ep.name}</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {selectedEp && (
                <div className="cw-vpane" role="tabpanel">
                  <div className="cw-epd">
                    <div className="cw-epd__head">
                      <span
                        className={`cw-method cw-method--${selectedEp.method.toLowerCase()}`}
                      >
                        {selectedEp.method}
                      </span>
                      <span className="ic-ref__op-path">{selectedEp.path}</span>
                    </div>
                    {selectedEp.description && (
                      <p className="ic-ref__op-desc">{selectedEp.description}</p>
                    )}

                    {selectedEp.parameters.length > 0 && (
                      <ParametersBlock parameters={selectedEp.parameters} />
                    )}

                    {selectedEp.requestContent.length > 0 && (
                      <section className="ic-ref__section">
                        <h5 className="ic-ref__section-title">Request body</h5>
                        {selectedEp.requestContent.map((media) => (
                          <MediaBlock
                            key={`${selectedEp.id}:req:${media.mimeType}`}
                            mimeType={media.mimeType}
                            schema={media.schema}
                          />
                        ))}
                      </section>
                    )}

                    <section className="ic-ref__section">
                      <h5 className="ic-ref__section-title">Responses</h5>
                      {selectedEp.responses.length === 0 ? (
                        <p className="ic-ref__op-desc" style={{ margin: 0 }}>
                          No responses defined.
                        </p>
                      ) : (
                        <div className="cw-vtabs ic-ref__resp-vtabs">
                          {/* Left — response status selector (Salesforce left nav). */}
                          <div
                            className="cw-vtabs__list"
                            role="tablist"
                            aria-orientation="vertical"
                            aria-label="Response status"
                          >
                            {selectedEp.responses.map((res) => (
                              <div
                                key={res.status}
                                className={`cw-vtab${
                                  res.status === selectedRes?.status
                                    ? ' cw-vtab--active'
                                    : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  className="cw-vtab__btn"
                                  role="tab"
                                  aria-selected={res.status === selectedRes?.status}
                                  onClick={() => setSelectedStatus(res.status)}
                                >
                                  <span
                                    className={`ic-ref__status ic-ref__status--${statusTone(
                                      res.status,
                                    )}`}
                                  >
                                    {res.status}
                                  </span>
                                  {res.description && (
                                    <span className="cw-vtab__name">
                                      {res.description}
                                    </span>
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Right — selected response's schema. */}
                          <div className="cw-vpane" role="tabpanel">
                            <div className="ic-ref__resp-body">
                              {!selectedRes ||
                              selectedRes.content.length === 0 ? (
                                <p
                                  className="ic-ref__op-desc"
                                  style={{ margin: 0 }}
                                >
                                  No response body.
                                </p>
                              ) : (
                                selectedRes.content.map((media) => (
                                  <MediaBlock
                                    key={`${selectedEp.id}:res:${selectedRes.status}:${media.mimeType}`}
                                    mimeType={media.mimeType}
                                    schema={media.schema}
                                  />
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
          </>
        )}
      </div>
  );
}

/** Success/redirect/client-error/server-error tone for a status-code key. */
function statusTone(
  status: string,
): 'success' | 'info' | 'warning' | 'error' | 'neutral' {
  const first = status.trim()[0];
  if (first === '2') return 'success';
  if (first === '3') return 'info';
  if (first === '4') return 'warning';
  if (first === '5') return 'error';
  return 'neutral';
}

/** The parameters table for an operation — path / query / header rows. */
function ParametersBlock({
  parameters,
}: {
  parameters: EndpointParameter[];
}) {
  return (
    <section className="ic-ref__section">
      <h5 className="ic-ref__section-title">Parameters</h5>
      <div className="ic-schema">
        <ul className="ic-schema__fields">
          {parameters.map((p) => (
            <li key={`${p.in}:${p.name}`} className="ic-schema__field">
              <div className="ic-schema__row">
                <span className="ic-schema__name">{p.name}</span>
                <span className="ic-ref__param-in">{p.in}</span>
                {p.required && (
                  <span className="ic-schema__required">required</span>
                )}
                {p.schema && (
                  <span className="ic-schema__type">
                    {schemaTypeLabel(p.schema)}
                  </span>
                )}
              </div>
              {p.description && (
                <p className="ic-schema__desc">{p.description}</p>
              )}
              {p.schema?.enum && p.schema.enum.length > 0 && (
                <div className="ic-schema__enum">
                  {p.schema.enum.map((v) => (
                    <span key={String(v)} className="ic-schema__enum-val">
                      {String(v)}
                    </span>
                  ))}
                </div>
              )}
              {p.schema && <SchemaMeta schema={p.schema} />}
              {p.schema && hasChildren(p.schema) && (
                <SchemaChildren schema={p.schema} />
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* Syntax-highlighted, read-only JSON. Tokenizes the pretty-printed text with a
 * single regex pass and wraps each token in a span so keys, strings, numbers,
 * booleans, and null get distinct colors against a light surface. */
function JsonHighlight({ value }: { value: unknown }) {
  const text = JSON.stringify(value, null, 2);
  // Match, in order: string keys (followed by a colon), plain strings,
  // numbers, and the literals true/false/null.
  const tokenRe =
    /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b)|(\bnull\b)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = tokenRe.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    let cls = 'ic-json__str';
    if (m[1]) cls = 'ic-json__key';
    else if (m[2]) cls = 'ic-json__str';
    else if (m[3]) cls = 'ic-json__num';
    else if (m[4]) cls = 'ic-json__bool';
    else if (m[5]) cls = 'ic-json__null';
    parts.push(
      <span key={i} className={cls}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
    i += 1;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <pre className="ic-json ic-ref__spec-json">{parts}</pre>;
}

/* One media type (request or response), rendered as its JSON Schema field
 * tree. The mime type is shown so multiple content types read distinctly.
 * No example JSON — the raw spec's samples live under the top-level JSON view. */
interface MediaBlockProps {
  mimeType: string;
  schema?: JsonSchema;
}

function MediaBlock({ mimeType, schema }: MediaBlockProps) {
  return (
    <div className="ic-ref__schema">
      <span className="ic-ref__schema-label">
        <span className="ic-ref__schema-mime">{mimeType}</span>
      </span>
      {schema ? (
        <div className="ic-schema">
          <SchemaTree schema={schema} />
        </div>
      ) : (
        <p className="ic-ref__op-desc" style={{ margin: 0 }}>
          No schema.
        </p>
      )}
    </div>
  );
}

/* Visual field-tree render of a JSON Schema (Swagger "Model" style). Each
 * property is a row: name · type (with format/enum/nullable hints), a
 * required marker, and its description. Objects and arrays nest their
 * children under an indented rail. */

/** Short name of a "#/components/schemas/Name" ref (or the raw ref). */
function refName($ref: string): string {
  return $ref.split('/').pop() || $ref;
}

/** Human-readable type label for a schema node, incl. array, format, ref,
 * and composition keywords. */
function schemaTypeLabel(schema: JsonSchema): string {
  if (schema.$ref) return `$ref → ${refName(schema.$ref)}`;
  if (schema.oneOf) return `oneOf (${schema.oneOf.length})`;
  if (schema.anyOf) return `anyOf (${schema.anyOf.length})`;
  if (schema.allOf) return `allOf (${schema.allOf.length})`;
  const base = schema.type ?? 'any';
  if (base === 'array') {
    const item = schema.items ? schemaTypeLabel(schema.items) : 'any';
    return `array<${item}>`;
  }
  const suffix = schema.nullable ? ' · nullable' : '';
  if (schema.format) return `${base} · ${schema.format}${suffix}`;
  return `${base}${suffix}`;
}

/** Render a scalar example/default value compactly for annotation display. */
function formatScalar(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v === null) return 'null';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

/** The example / default annotations for a schema node, shown after its
 * description so the field tree carries the same detail as the raw spec. */
function SchemaMeta({ schema }: { schema: JsonSchema }) {
  const items: { key: string; val: string }[] = [];
  if (schema.example !== undefined) {
    items.push({ key: 'example', val: formatScalar(schema.example) });
  }
  if (schema.default !== undefined) {
    items.push({ key: 'default', val: formatScalar(schema.default) });
  }
  if (items.length === 0) return null;
  return (
    <div className="ic-schema__meta">
      {items.map((it) => (
        <span key={it.key} className="ic-schema__meta-item">
          <span className="ic-schema__meta-key">{it.key}</span>
          <span className="ic-schema__meta-val">{it.val}</span>
        </span>
      ))}
    </div>
  );
}

/** True when a schema has nested structure worth expanding into child rows. */
function hasChildren(schema: JsonSchema): boolean {
  return !!(
    schema.properties ||
    schema.oneOf ||
    schema.anyOf ||
    schema.allOf ||
    (schema.type === 'array' && schema.items && hasChildren(schema.items)) ||
    (schema.additionalProperties &&
      typeof schema.additionalProperties === 'object')
  );
}

function SchemaTree({ schema }: { schema: JsonSchema }) {
  // Unwrap a top-level array so its object items render as a field list, but
  // call out that the payload is an array (and what each element is).
  if (schema.type === 'array' && schema.items) {
    return (
      <div className="ic-schema__array-root">
        <span className="ic-schema__array-tag">
          <span className="ic-schema__array-badge">Array</span>
          <span className="ic-schema__array-note">
            payload is a list of {schemaTypeLabel(schema.items)}
          </span>
        </span>
        <SchemaTree schema={schema.items} />
      </div>
    );
  }
  if (schema.properties) {
    const required = new Set(schema.required ?? []);
    const entries = Object.entries(schema.properties);
    if (entries.length === 0) {
      return <p className="ic-schema__empty">No fields.</p>;
    }
    return (
      <ul className="ic-schema__fields">
        {entries.map(([name, prop]) => (
          <SchemaField
            key={name}
            name={name}
            schema={prop}
            required={required.has(name)}
          />
        ))}
      </ul>
    );
  }
  // Composition / scalar / ref root — show a single unnamed leaf that expands.
  return (
    <ul className="ic-schema__fields">
      <SchemaField name="(value)" schema={schema} required={false} />
    </ul>
  );
}

/** The nested child rows for a schema: object properties, array-of-object
 * item properties, composition branches, or a free-form additionalProperties
 * value. Returns null when there's nothing to nest. */
function SchemaChildren({ schema }: { schema: JsonSchema }) {
  // Composition — render each branch under a labeled group.
  const branches = schema.oneOf
    ? { label: 'oneOf', list: schema.oneOf }
    : schema.anyOf
      ? { label: 'anyOf', list: schema.anyOf }
      : schema.allOf
        ? { label: 'allOf', list: schema.allOf }
        : null;
  if (branches) {
    return (
      <ul className="ic-schema__nested">
        {branches.list.map((branch, i) => (
          <li key={i} className="ic-schema__field">
            <div className="ic-schema__row">
              <span className="ic-schema__branch">
                {branches.label} #{i + 1}
              </span>
              <span className="ic-schema__type">{schemaTypeLabel(branch)}</span>
            </div>
            {hasChildren(branch) && <SchemaChildren schema={branch} />}
          </li>
        ))}
      </ul>
    );
  }

  // Object (directly, or as array items).
  const obj =
    schema.type === 'array' && schema.items?.properties
      ? schema.items
      : schema.properties
        ? schema
        : undefined;
  if (obj?.properties) {
    const requiredSet = new Set(obj.required ?? []);
    return (
      <ul className="ic-schema__nested">
        {Object.entries(obj.properties).map(([childName, childSchema]) => (
          <SchemaField
            key={childName}
            name={childName}
            schema={childSchema}
            required={requiredSet.has(childName)}
          />
        ))}
      </ul>
    );
  }

  // Free-form / typed map.
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    return (
      <ul className="ic-schema__nested">
        <SchemaField
          name="*"
          schema={schema.additionalProperties}
          required={false}
        />
      </ul>
    );
  }
  return null;
}

function SchemaField({
  name,
  schema,
  required,
}: {
  name: string;
  schema: JsonSchema;
  required: boolean;
}) {
  return (
    <li className="ic-schema__field">
      <div className="ic-schema__row">
        <span className="ic-schema__name">{name}</span>
        {required && <span className="ic-schema__required">required</span>}
        <span className="ic-schema__type">{schemaTypeLabel(schema)}</span>
      </div>
      {schema.description && (
        <p className="ic-schema__desc">{schema.description}</p>
      )}
      {schema.enum && schema.enum.length > 0 && (
        <div className="ic-schema__enum">
          {schema.enum.map((v) => (
            <span key={String(v)} className="ic-schema__enum-val">
              {String(v)}
            </span>
          ))}
        </div>
      )}
      <SchemaMeta schema={schema} />
      {hasChildren(schema) && <SchemaChildren schema={schema} />}
    </li>
  );
}

/* ── Provider rail row ───────────────────────────────────────────── */

interface ProviderRowProps {
  provider: Provider;
  focused: boolean;
  showMenu: boolean;
  menuOpen: boolean;
  onMenuToggle: (next: boolean) => void;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ProviderRow({
  provider,
  focused,
  showMenu,
  menuOpen,
  onMenuToggle,
  onClick,
  onEdit,
  onDelete,
}: ProviderRowProps) {
  return (
    <div
      className={`ic-provider-row${focused ? ' ic-provider-row--focus' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <ProviderLogo provider={provider} small />
      <span className="ic-provider-row__body">
        <span className="ic-provider-row__name">{provider.name}</span>
      </span>
      {showMenu && (
        <span className="ic-provider-row__meta">
          <ProviderMenu
            open={menuOpen}
            onToggle={onMenuToggle}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </span>
      )}
    </div>
  );
}

/* ── Provider row action menu (Edit / Delete) ────────────────────── */

interface ProviderMenuProps {
  open: boolean;
  onToggle: (next: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ProviderMenu({ open, onToggle, onEdit, onDelete }: ProviderMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDocClick = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) {
        onToggle(false);
      }
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onToggle(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onToggle]);

  return (
    <div className="lob-tile-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="lob-tile-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Provider actions"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(!open);
        }}
      >
        <Icon name="chevron-down" size={14} />
      </button>
      {open && (
        <div className="lob-tile-menu__panel" role="menu">
          <button
            type="button"
            role="menuitem"
            className="lob-tile-menu__item"
            onClick={onEdit}
          >
            <Icon name="edit" size={14} />
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            className="lob-tile-menu__item lob-tile-menu__item--destructive"
            onClick={onDelete}
          >
            <Icon name="trash" size={14} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Service card ────────────────────────────────────────────────── */

interface ServiceCardProps {
  service: ProviderService;
  canActivate: boolean;
  auth?: Authentication;
  connectionCount: number;
  menuOpen: boolean;
  onMenuToggle: (next: boolean) => void;
  /** Tile click — opens the read-only OpenAPI reference modal. */
  onOpen: () => void;
  onConnect: () => void;
  onAuthenticate: () => void;
  onAddConnection: () => void;
  onDeploy: () => void;
  onReauthenticate: () => void;
  onDisconnect: () => void;
  onDeactivate: () => void;
}

function ServiceCard({
  service,
  canActivate,
  auth,
  connectionCount,
  menuOpen,
  onMenuToggle,
  onOpen,
  onConnect,
  onAuthenticate,
  onAddConnection,
  onDeploy,
  onReauthenticate,
  onDisconnect,
  onDeactivate,
}: ServiceCardProps) {
  const authenticated = auth?.status === 'Authenticated';
  const isDcc = service.type === 'Data Cloud Connector';
  return (
    <div
      className="act-tile act-tile--compact lob-stage-tile ic-svc-tile"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="act-tile__actions">
        <div className="lob-stage-tile__actions">
          <Badge tone="brand" outline>
            {service.type ?? 'P2P'}
          </Badge>
          {isDcc ? (
            <>
              {authenticated ? (
                <Badge tone="success">Authenticated</Badge>
              ) : (
                <Badge>Not Connected</Badge>
              )}
              {authenticated ? (
                <ServiceMenu
                  open={menuOpen}
                  isDcc={isDcc}
                  onToggle={onMenuToggle}
                  onAddConnection={onAddConnection}
                  onDeploy={onDeploy}
                  onReauthenticate={onReauthenticate}
                  onDisconnect={onDisconnect}
                  onDeactivate={onDeactivate}
                />
              ) : (
                <Button
                  variant="brand"
                  size="sm"
                  disabled={!canActivate}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAuthenticate();
                  }}
                >
                  Activate
                </Button>
              )}
            </>
          ) : (
            // P2P is just a published API spec — the only action is Connect,
            // which opens the connection wizard seeded to this service.
            <Button
              variant="brand"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onConnect();
              }}
            >
              Connect
            </Button>
          )}
        </div>
      </div>

      <div className="act-tile__name">
        <span className="act-tile__name-text">{service.name}</span>
      </div>
      <div className="lob-stage-tile__sub">
        {connectionCount > 0
          ? `${connectionCount} connection${connectionCount === 1 ? '' : 's'} · `
          : ''}
        {service.endpoints.length}{' '}
        {service.type === 'Data Cloud Connector'
          ? `data stream${service.endpoints.length === 1 ? '' : 's'}`
          : `endpoint${service.endpoints.length === 1 ? '' : 's'}`}{' '}
        · {service.authType}
      </div>
      <p className="ic-svc-tile__desc">{service.description}</p>
    </div>
  );
}

/* ── Service tile action menu (authenticated services) ───────────── */

function ServiceMenu({
  open,
  isDcc,
  onToggle,
  onAddConnection,
  onDeploy,
  onReauthenticate,
  onDisconnect,
  onDeactivate,
}: {
  open: boolean;
  isDcc: boolean;
  onToggle: (next: boolean) => void;
  onAddConnection: () => void;
  onDeploy: () => void;
  onReauthenticate: () => void;
  onDisconnect: () => void;
  onDeactivate: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDocClick = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) {
        onToggle(false);
      }
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onToggle(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onToggle]);

  return (
    <div className="lob-tile-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="lob-tile-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Service actions"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(!open);
        }}
      >
        <Icon name="chevron-down" size={14} />
      </button>
      {open && (
        <div className="lob-tile-menu__panel" role="menu">
          {isDcc ? (
            <button
              type="button"
              role="menuitem"
              className="lob-tile-menu__item"
              onClick={onDeploy}
            >
              <Icon name="upload" size={14} />
              Deploy
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="lob-tile-menu__item"
              onClick={onAddConnection}
            >
              <Icon name="plus" size={14} />
              New Connection
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="lob-tile-menu__item"
            onClick={onReauthenticate}
          >
            <Icon name="refresh" size={14} />
            Reauthenticate
          </button>
          {isDcc ? (
            <button
              type="button"
              role="menuitem"
              className="lob-tile-menu__item lob-tile-menu__item--destructive"
              onClick={onDisconnect}
            >
              <Icon name="close" size={14} />
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="lob-tile-menu__item lob-tile-menu__item--destructive"
              onClick={onDeactivate}
            >
              <Icon name="close" size={14} />
              Deactivate
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Logo (shared) ───────────────────────────────────────────────── */

function ProviderLogo({
  provider,
  small,
}: {
  provider: Provider;
  small?: boolean;
}) {
  const [imageOk, setImageOk] = useState(true);
  const useFallback = !(provider.logoUrl && imageOk);
  return (
    <span
      className={[
        'ic-provider-row__logo',
        small ? '' : 'ic-detail__logo',
        useFallback ? 'ic-provider-row__logo--fallback' : '',
      ]
        .filter(Boolean)
        .join(' ')}
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
      {provider.logoUrl && imageOk ? (
        <img
          src={provider.logoUrl}
          alt=""
          onError={() => setImageOk(false)}
          loading="lazy"
        />
      ) : (
        provider.logo
      )}
    </span>
  );
}
