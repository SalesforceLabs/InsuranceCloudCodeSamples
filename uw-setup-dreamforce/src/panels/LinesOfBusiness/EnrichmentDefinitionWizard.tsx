import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Icon, Input, Modal, Select, Textarea } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type {
  ConnectionInstance,
  EnrichmentAliasMapping,
  EnrichmentDefinition,
  EnrichmentFieldMapping,
} from '@/types/config';
import {
  PROVIDERS,
  findServiceById,
  type Provider,
  type ServiceEndpoint,
} from '@/panels/IntegrationHub/providers';
import { EnrichmentMappingStep, type MappingMode } from './EnrichmentMappingStep';
import { EnrichmentAliasStep } from './EnrichmentAliasStep';
import { EndpointTab, ReviewEndpointDetail } from '@/panels/GeneralSetup/ConnectWizardModal';
import './EnrichmentDefinitionWizard.css';

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `category-${Date.now()}`
  );
}

/** Resolve a target LOB label to the closest available one. LOB labels drift
 * across entities (e.g. "Commercial Property" vs "Property"), so fall back to
 * a case-insensitive substring match in either direction. */
function resolveLob(target: string, available: string[]): string | null {
  if (available.length === 0) return null;
  const exact = available.find((l) => l === target);
  if (exact) return exact;
  const t = target.toLowerCase();
  return (
    available.find((l) => l.toLowerCase().includes(t)) ??
    available.find((l) => t.includes(l.toLowerCase())) ??
    null
  );
}

/** Fallback when no enrichment config exists for the LOB yet. Mirrors the
 * Property categories shipped in the seed. */
const FALLBACK_CATEGORIES = [
  'Property Characteristics',
  'Location & CAT Exposure',
  'Fire Protection & Response',
  'Occupancy & Operations',
  'Claims History',
  'Valuation & Insurance-to-Value',
  'Building Code & Compliance',
];

interface Props {
  open: boolean;
  lob: string;
  /** Pass an existing definition to edit; null for create. */
  editing?: EnrichmentDefinition | null;
  onClose: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const STEP_LABELS = [
  'Define',
  'Endpoint',
  'Request Mapping',
  'Response Mapping',
  'Alias Creation',
  'Activate',
] as const;

/**
 * LOB → Enrichment Definitions wizard. Step 1 captures name +
 * description and lets the user pick the single configured connection
 * this definition calls, grouped by provider in a catalog. Step 2 lists
 * that connection's endpoints (mirroring the Connection wizard's Review
 * screen — Input/Output parameters + generated Apex action) and the user
 * picks the single endpoint the definition invokes.
 *
 * Step 3 maps each response attribute's name + value onto object fields;
 * step 4 (Alias Creation) registers each response attribute name as an
 * alias on a canonical attribute of a line definition. Step 5 (Activate)
 * is a placeholder; saving is enabled once the definition has a name.
 */
export function EnrichmentDefinitionWizard({
  open,
  lob,
  editing,
  onClose,
}: Props) {
  const { config, update } = useConfig();
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [selectedConnectionId, setSelectedConnectionId] = useState<number | null>(
    null,
  );
  const [selectedEndpointIds, setSelectedEndpointIds] = useState<string[]>([]);
  const [requestMappings, setRequestMappings] = useState<EnrichmentFieldMapping[]>(
    [],
  );
  const [mappings, setMappings] = useState<EnrichmentFieldMapping[]>([]);
  const [aliasMappings, setAliasMappings] = useState<EnrichmentAliasMapping[]>([]);
  const [mappingMode, setMappingMode] = useState<MappingMode>('fieldMapper');
  const [apexClass, setApexClass] = useState('');

  // Enrichment definitions call point-to-point services, so the picker
  // only surfaces configured P2P connections — Data Cloud Connector
  // instances and any connection that isn't live are excluded.
  const allConnections = useMemo(
    () =>
      (config.connectionInstances ?? []).filter(
        (c) =>
          c.status === 'Connected' &&
          findServiceById(c.serviceId)?.service?.type !==
            'Data Cloud Connector',
      ),
    [config.connectionInstances],
  );

  // Category options pulled from this LOB's enrichment config. Fall back
  // to a static list when no config exists yet so the picker is still
  // populated.
  const categoryOptions = useMemo(() => {
    const cfg = config.enrichmentConfigs.find(
      (c) =>
        c.lob === lob ||
        c.lob.toLowerCase().includes(lob.toLowerCase()) ||
        lob.toLowerCase().includes(c.lob.toLowerCase()),
    );
    const fromCfg = cfg?.categories.map((c) => c.name) ?? [];
    return fromCfg.length > 0 ? fromCfg : FALLBACK_CATEGORIES;
  }, [config.enrichmentConfigs, lob]);

  // Reset on open. Edit mode prefills, create mode starts blank.
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setName(editing?.name ?? '');
    setDescription(editing?.description ?? '');
    setCategory(editing?.categoryName ?? categoryOptions[0] ?? '');
    setSelectedConnectionId(editing?.connectionInstanceIds?.[0] ?? null);
    setSelectedEndpointIds(
      editing?.endpointIds ??
        (editing?.endpointId ? [editing.endpointId] : []),
    );
    setRequestMappings(editing?.requestMappings ?? []);
    setMappings(editing?.fieldMappings ?? []);
    setAliasMappings(editing?.aliasMappings ?? []);
    setMappingMode(editing?.mappingMode ?? 'fieldMapper');
    setApexClass(editing?.apexClass ?? '');
  }, [open, editing?.id, categoryOptions]);

  // Line definitions across all LOBs — the alias targets in step 3. The LOB
  // dropdown is driven by the LOBs that actually own line definitions (not the
  // Submission picklist), since LOB labels drift between the two — e.g. line
  // definitions live under "Property" while this definition's LOB may be
  // "Commercial Property". The default target LOB is resolved to the closest
  // configured entity LOB so its definitions surface immediately.
  const allEntities = useMemo(
    () => config.lineCoverageEntities ?? [],
    [config.lineCoverageEntities],
  );
  const lobOptions = useMemo(() => {
    const fromEntities = Array.from(new Set(allEntities.map((e) => e.lob)));
    return fromEntities.length > 0 ? fromEntities : [lob];
  }, [allEntities, lob]);
  const defaultAliasLob = useMemo(
    () => resolveLob(lob, lobOptions) ?? lobOptions[0] ?? lob,
    [lob, lobOptions],
  );

  // Resolve the picked connection → its service → available endpoints.
  const selectedConnection = useMemo(
    () => allConnections.find((c) => c.id === selectedConnectionId) ?? null,
    [allConnections, selectedConnectionId],
  );
  // Only the endpoints the connection actually enabled — not every
  // endpoint the underlying service exposes.
  const endpoints = useMemo<ServiceEndpoint[]>(() => {
    const all =
      findServiceById(selectedConnection?.serviceId)?.service?.endpoints ?? [];
    const ids = selectedConnection?.enabledEndpointIds;
    return ids ? all.filter((e) => ids.includes(e.id)) : all;
  }, [selectedConnection]);

  // The endpoints the definition includes, in the connection's own order.
  const selectedEndpoints = useMemo<ServiceEndpoint[]>(
    () => endpoints.filter((e) => selectedEndpointIds.includes(e.id)),
    [endpoints, selectedEndpointIds],
  );

  const selectConnection = (id: number) => {
    setSelectedConnectionId(id);
    // Auto-include the endpoint when the connection exposes exactly one, so
    // the review + downstream steps agree without an extra click.
    const conn = allConnections.find((c) => c.id === id);
    const all = findServiceById(conn?.serviceId)?.service?.endpoints ?? [];
    const ids = conn?.enabledEndpointIds;
    const eps = ids ? all.filter((e) => ids.includes(e.id)) : all;
    setSelectedEndpointIds(eps.length === 1 ? [eps[0].id] : []);
  };

  const toggleEndpoint = (id: string) => {
    setSelectedEndpointIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const endpointValid = selectedEndpointIds.length > 0;
  // Step 1 (Define) needs name + category + a chosen connection; the
  // endpoints are picked on step 2. Saving requires both.
  const defineValid =
    name.trim().length > 0 &&
    category.trim().length > 0 &&
    selectedConnectionId != null;
  const detailsValid = defineValid && endpointValid;
  const stepCanAdvance =
    step === 1 ? defineValid : step === 2 ? endpointValid : true;

  const onSave = () => {
    update((p) => {
      const list = p.enrichmentDefinitions;
      const ids = selectedConnectionId != null ? [selectedConnectionId] : [];
      const endpointIds = selectedEndpointIds;
      const endpointId = selectedEndpointIds[0] ?? undefined;
      const lastModified = new Date().toISOString().slice(0, 10);
      const categoryId = slugify(category);
      if (editing) {
        return {
          ...p,
          enrichmentDefinitions: list.map((d) =>
            d.id === editing.id
              ? {
                  ...d,
                  name: name.trim(),
                  description: description.trim(),
                  categoryId,
                  categoryName: category,
                  connectionInstanceIds: ids,
                  endpointId,
                  endpointIds,
                  mappingMode,
                  apexClass: mappingMode === 'apexClass' ? apexClass : '',
                  requestMappings,
                  fieldMappings: mappings,
                  aliasMappings,
                  lastModified,
                }
              : d,
          ),
        };
      }
      const newId = p.nextEnrichmentDefinitionId;
      const next: EnrichmentDefinition = {
        id: newId,
        name: name.trim(),
        description: description.trim(),
        lob,
        categoryId,
        categoryName: category,
        integrationProcedureName: '',
        active: false,
        lastModified,
        connectionInstanceIds: ids,
        endpointId,
        endpointIds,
        mappingMode,
        apexClass: mappingMode === 'apexClass' ? apexClass : '',
        requestMappings,
        fieldMappings: mappings,
        aliasMappings,
      };
      return {
        ...p,
        enrichmentDefinitions: [next, ...list],
        nextEnrichmentDefinitionId: newId + 1,
      };
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        editing ? `Edit Enrichment Definition — ${editing.name}` : 'New Enrichment Definition'
      }
      size="lg"
      footer={
        <>
          {step > 1 && (
            <Button variant="neutral" onClick={() => setStep((s) => (s - 1) as Step)}>
              Back
            </Button>
          )}
          <span style={{ flex: 1 }} />
          <Button variant="neutral" onClick={onClose}>
            Cancel
          </Button>
          {step < 6 ? (
            <Button
              variant="brand"
              disabled={!stepCanAdvance}
              onClick={() => setStep((s) => (s + 1) as Step)}
            >
              Next
            </Button>
          ) : (
            <Button variant="brand" disabled={!detailsValid} onClick={onSave}>
              Save
            </Button>
          )}
        </>
      }
    >
      <div className="ed-wizard">
        <ol className="cw-steps" aria-label="Enrichment definition steps">
          {STEP_LABELS.map((label, idx) => {
            const n = (idx + 1) as Step;
            const state = step === n ? 'active' : step > n ? 'done' : 'todo';
            return (
              <li key={label} className={`cw-step cw-step--${state}`}>
                <span className="cw-step__num">
                  {state === 'done' ? <Icon name="check" size={12} /> : n}
                </span>
                <span className="cw-step__label">{label}</span>
              </li>
            );
          })}
        </ol>

        <div className="cw-content">
          {step === 1 && (
            <div className="cw-body">
              <div className="cw-form">
                <div className="cw-form__row">
                  <Input
                    label="Name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Property Risk Lookup"
                    fullWidth
                  />
                  <Select
                    label="Category"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    options={categoryOptions.map((c) => ({ value: c, label: c }))}
                  />
                </div>
                <Textarea
                  label="Description"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this enrichment definition do?"
                  fullWidth
                />
              </div>

              <ConnectionPicker
                allConnections={allConnections}
                selectedId={selectedConnectionId}
                onSelect={selectConnection}
              />
            </div>
          )}

          {step === 2 && (
            <div className="cw-body">
              <EndpointReviewStep
                connection={selectedConnection}
                endpoints={endpoints}
                selectedEndpointIds={selectedEndpointIds}
                onToggleEndpoint={toggleEndpoint}
              />
            </div>
          )}

          {step === 3 && (
            <div className="cw-body">
              <EnrichmentMappingStep
                endpoints={selectedEndpoints}
                direction="request"
                mappings={requestMappings}
                onChange={setRequestMappings}
              />
            </div>
          )}

          {step === 4 && (
            <div className="cw-body">
              <EnrichmentMappingStep
                endpoints={selectedEndpoints}
                direction="response"
                mappings={mappings}
                onChange={setMappings}
                mode={mappingMode}
                onModeChange={setMappingMode}
                apexClass={apexClass}
                onApexClassChange={setApexClass}
              />
            </div>
          )}

          {step === 5 && (
            <div className="cw-body">
              <EnrichmentAliasStep
                endpoints={selectedEndpoints}
                entities={allEntities}
                lobs={lobOptions}
                defaultLob={defaultAliasLob}
                mappings={aliasMappings}
                onChange={setAliasMappings}
              />
            </div>
          )}

          {step === 6 && (
            <div className="cw-body">
              <p className="cw-hint">
                Activate — coming next. Final review and the toggle that
                flips this definition live.
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ── Connection picker (single-select) ─────────────────────────────── */

interface PickerProps {
  allConnections: ConnectionInstance[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

/**
 * Single-select connection picker laid out like the new-service modal:
 * a Provider rail on the left and that provider's connection list on the
 * right. Picking a connection here advances to the Endpoint step, where
 * the endpoint contract is reviewed.
 */
function ConnectionPicker({ allConnections, selectedId, onSelect }: PickerProps) {
  const selected = useMemo(
    () => allConnections.find((c) => c.id === selectedId) ?? null,
    [allConnections, selectedId],
  );

  // Group connections by providerId, then drive the rail from those
  // groups (so empty providers don't show up). Preserve catalog order.
  const groups = useMemo(() => {
    const byProvider = new Map<string, ConnectionInstance[]>();
    allConnections.forEach((c) => {
      const key = c.providerId ?? '__other__';
      const list = byProvider.get(key) ?? [];
      list.push(c);
      byProvider.set(key, list);
    });
    const ordered: { id: string; provider: Provider | null; items: ConnectionInstance[] }[] = [];
    PROVIDERS.forEach((p) => {
      const items = byProvider.get(p.id);
      if (items && items.length > 0) ordered.push({ id: p.id, provider: p, items });
    });
    const other = byProvider.get('__other__');
    if (other && other.length > 0)
      ordered.push({ id: '__other__', provider: null, items: other });
    return ordered;
  }, [allConnections]);

  // Focus the provider that owns the current selection, else the first.
  const selectedProviderId = selected?.providerId ?? '__other__';
  const [focusedId, setFocusedId] = useState<string | null>(
    () => (selected ? selectedProviderId : groups[0]?.id ?? null),
  );
  useEffect(() => {
    if (groups.length === 0) {
      if (focusedId !== null) setFocusedId(null);
      return;
    }
    if (!groups.some((g) => g.id === focusedId)) setFocusedId(groups[0].id);
  }, [groups, focusedId]);

  // On edit, focus the provider that owns the pre-selected connection so
  // the picker opens with that provider (and its highlighted tile) shown.
  useEffect(() => {
    if (selected && groups.some((g) => g.id === selectedProviderId)) {
      setFocusedId(selectedProviderId);
    }
  }, [selectedId]);

  const focused = groups.find((g) => g.id === focusedId) ?? null;

  // On edit (a connection is already bound when the picker mounts), collapse
  // the catalog to just the chosen connection; "Change" reopens the browser.
  // A fresh pick keeps the catalog open so the user can keep browsing.
  const [browsing, setBrowsing] = useState(() => selectedId == null);

  const showCatalog = !selected || browsing;

  return (
    <div className="ed-picker ed-picker--single">
      {selected && (
        <div className="ed-picker__selected">
          <span className="ed-picker__selected-label">Selected connection</span>
          <div className="ed-picker__selected-chip">
            <span className="ed-picker__selected-name">{selected.name}</span>
            <Badge>{String(selected.authType)}</Badge>
            <span className="ed-pane__row-url">{selected.baseUrl}</span>
            {!browsing && (
              <Button
                variant="neutral"
                size="sm"
                onClick={() => setBrowsing(true)}
                style={{ marginLeft: 'auto' }}
              >
                Change
              </Button>
            )}
          </div>
        </div>
      )}

      {showCatalog && (
        <p className="cw-hint" style={{ marginBottom: 8 }}>
          Choose a connection this enrichment definition calls. Only
          point-to-point connections appear here.
        </p>
      )}

      {!showCatalog ? null : allConnections.length === 0 ? (
        <div className="cw-empty">
          No live connections configured yet. Add one under Integrations →
          Connections.
        </div>
      ) : (
        <div className="cw-catalog">
          <div className="cw-catalog__providers">
            <div className="cw-catalog__col-label">Providers</div>
            <div className="cw-catalog__provider-list">
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`cw-provider-row${
                    focusedId === g.id ? ' cw-provider-row--focus' : ''
                  }`}
                  onClick={() => setFocusedId(g.id)}
                >
                  <ProviderTag provider={g.provider} />
                  <span className="cw-provider-row__body">
                    <span className="cw-provider-row__name">
                      {g.provider?.name ?? 'Other'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="cw-catalog__templates">
            <div className="cw-catalog__col-label">
              {focused
                ? `${focused.provider?.name ?? 'Other'} · Connections`
                : 'Connections'}
            </div>
            {!focused || focused.items.length === 0 ? (
              <div className="cw-catalog__empty">
                No connections for this provider.
              </div>
            ) : (
              focused.items.map((c) => {
                const categories = connCategories(c);
                const isSelected = selectedId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`cw-template-tile${
                      isSelected ? ' cw-template-tile--selected' : ''
                    }`}
                    onClick={() => onSelect(c.id)}
                    aria-pressed={isSelected}
                  >
                    <span className="cw-template-tile__head">
                      <span className="cw-template-tile__name">{c.name}</span>
                    </span>
                    {categories.length > 0 && (
                      <span className="cw-tile-categories">
                        {categories.map((cat) => (
                          <Badge key={cat} tone="neutral">
                            {cat}
                          </Badge>
                        ))}
                      </span>
                    )}
                    <span className="cw-svc-meta">{c.baseUrl}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Data categories a connection covers, stored on the connection itself. */
function connCategories(c: ConnectionInstance): string[] {
  return c.categories ?? [];
}

/* ── Step 2: Endpoint review ───────────────────────────────────────── */

interface EndpointReviewProps {
  connection: ConnectionInstance | null;
  endpoints: ServiceEndpoint[];
  selectedEndpointIds: string[];
  onToggleEndpoint: (id: string) => void;
}

/**
 * Mirrors the Connection wizard's Review screen: a vertical list of the
 * connection's endpoints on the left, each with a checkbox to include it in
 * the definition, and the focused endpoint's Input/Output parameters +
 * generated Apex action on the right. The checked endpoints flow into the
 * request/response mapping steps.
 */
function EndpointReviewStep({
  connection,
  endpoints,
  selectedEndpointIds,
  onToggleEndpoint,
}: EndpointReviewProps) {
  const service = findServiceById(connection?.serviceId)?.service ?? null;
  // Focus (for the detail pane) is tracked locally; it's independent of which
  // endpoints are checked for inclusion.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  useEffect(() => {
    if (endpoints.length === 0) {
      if (focusedId !== null) setFocusedId(null);
      return;
    }
    if (!endpoints.some((e) => e.id === focusedId)) setFocusedId(endpoints[0].id);
  }, [endpoints, focusedId]);

  const activeEndpoint =
    endpoints.find((e) => e.id === focusedId) ?? endpoints[0] ?? null;

  if (!connection) {
    return (
      <div className="cw-empty">Pick a connection on the previous step.</div>
    );
  }

  return (
    <div className="cw-conn">
      <div className="cw-conn__top">
        <div className="cw-conn__auth-note">
          <Icon name="check" size={12} />
          <strong>{connection.name}</strong>
          {service ? ` · ${service.name}` : ''} · {String(connection.authType)}
        </div>
      </div>
      <p className="cw-hint">
        Select the endpoints this definition includes, then review each
        endpoint's input and output parameters before mapping.
      </p>
      <div className="cw-vtabs">
        <div
          className="cw-vtabs__list"
          role="tablist"
          aria-orientation="vertical"
        >
          {endpoints.length === 0 ? (
            <div className="cw-empty" style={{ padding: 8 }}>
              This connection exposes no endpoints.
            </div>
          ) : (
            endpoints.map((ep) => (
              <EndpointTab
                key={ep.id}
                endpoint={ep}
                active={activeEndpoint?.id === ep.id}
                enabled={selectedEndpointIds.includes(ep.id)}
                selectable
                onToggle={() => onToggleEndpoint(ep.id)}
                onSelect={() => setFocusedId(ep.id)}
              />
            ))
          )}
        </div>
        <div className="cw-vpane" role="tabpanel">
          {activeEndpoint ? (
            <ReviewEndpointDetail
              endpoint={activeEndpoint}
              baseUrl={connection.baseUrl}
              serviceName={service?.name ?? connection.name}
            />
          ) : (
            <div className="cw-empty">
              This connection exposes no endpoints to review.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ProviderTagProps {
  provider: Provider | null;
}
function ProviderTag({ provider }: ProviderTagProps) {
  return (
    <span
      className="ed-pane__provider-tag"
      style={
        provider?.fallbackColor
          ? { background: provider.fallbackColor, color: '#fff' }
          : undefined
      }
      aria-hidden="true"
    >
      {provider?.logo ?? '?'}
    </span>
  );
}
