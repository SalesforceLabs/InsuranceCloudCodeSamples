import type { AuthType } from '@/types/config';

/**
 * Provider catalog — the read-only blueprint behind General Setup →
 * Integrations. The hierarchy mirrors how real data vendors structure
 * their APIs:
 *
 *   Provider (the vendor)
 *     └─ Service (the auth boundary — base URL + auth + API contract)
 *          └─ Endpoint (path + HTTP method + request/response schema)
 *
 * A live Connection (config.connectionInstances) authenticates to ONE
 * service and enables one-or-more of that service's endpoints. Auth lives
 * at the service level (one credential works across every endpoint);
 * HTTP method lives at the endpoint level.
 *
 * This catalog is the "hybrid" default blueprint: activating a service
 * seeds the Connect wizard with the service's base URL, auth type, and
 * endpoint contracts so the admin only has to paste credentials. Power
 * users can still save named connection templates (config.connections).
 *
 * Seeded only with the providers named in the Provider Administration doc.
 */

export type ProviderCategory =
  | 'Firmographic Data'
  | 'Property Data'
  | 'Loss History'
  | 'Credit & Financial'
  | 'Compliance & Screening'
  | 'CAT Modeling'
  | 'AI Underwriting'
  | 'Other';

export type ProviderStatus = 'Proposed' | 'Available' | 'Inactive';

/** How a service integrates: point-to-point API, a Data Cloud Connector
 * (ingests data streams into Data Cloud), or a Model Context Protocol server. */
export type ServiceType = 'P2P' | 'Data Cloud Connector' | 'MCP';

export const SERVICE_TYPES: ServiceType[] = ['P2P', 'Data Cloud Connector', 'MCP'];

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/** A minimal JSON Schema (the OpenAPI 3.0 subset this app authors). Structure
 * — field names, types, nesting, required — lives here; it's what drives the
 * enrichment field-tree and the Connect wizard's typed params. */
export interface JsonSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
  /** Object properties, keyed by field name. */
  properties?: Record<string, JsonSchema>;
  /** Names of required properties (object schemas). */
  required?: string[];
  /** Element schema (array schemas). */
  items?: JsonSchema;
  /** Semantic format hint, e.g. "date-time", "uri". */
  format?: string;
  /** Allowed values (real JSON Schema keyword; used for enumerated fields). */
  enum?: (string | number | boolean)[];
  description?: string;
  /** Illustrative value for this node. */
  example?: unknown;
  nullable?: boolean;
  /** Reference to a named schema, e.g. "#/components/schemas/Organization".
   * Resolved against spec.components.schemas by resolveSchemaRef. */
  $ref?: string;
  /** Composition keywords (OpenAPI/JSON Schema). Rendered as labeled branch
   * groups in the reference view. */
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  /** Free-form / typed additional properties on an object. */
  additionalProperties?: boolean | JsonSchema;
  /** Polymorphism hint paired with oneOf/anyOf. */
  discriminator?: { propertyName: string; mapping?: Record<string, string> };
  /** Default value for the node. */
  default?: unknown;
}

/** A resolved media type on an operation — one entry per content mime type. */
export interface EndpointMediaType {
  /** Mime type, e.g. "application/json", "application/xml". */
  mimeType: string;
  /** JSON Schema of the payload (already $ref-resolved). */
  schema?: JsonSchema;
  /** Illustrative sample, pretty-printed for display. */
  example: string;
}

/** An operation parameter (path / query / header / cookie). */
export interface EndpointParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  description?: string;
  /** JSON Schema of the parameter value (already $ref-resolved). */
  schema?: JsonSchema;
}

/** A single response, keyed by HTTP status, carrying every media type it
 * defines. `status` is the raw key ("200", "4XX", "default"). */
export interface EndpointResponse {
  status: string;
  description?: string;
  /** One entry per media type declared under this response's content. */
  content: EndpointMediaType[];
}

/** A single operation on a service. Method + path + a typed request/response
 * contract projected losslessly from the canonical OpenAPI spec.
 *
 * The rich fields (`parameters`, `requestContent`, `responses`) preserve every
 * response status and media type. The flat convenience fields
 * (`requestBody`/`responseBody`/`requestExample`/`responseExample`) are the
 * single canonical success case (request body + first 2xx JSON response) that
 * the enrichment field-tree and Connect wizard consume as a typed picker. */
export interface ServiceEndpoint {
  id: string;
  name: string;
  method: HttpMethod;
  path: string;
  description: string;
  /** Path / query / header parameters for this operation. */
  parameters: EndpointParameter[];
  /** Every request-body media type (empty when there is no request body). */
  requestContent: EndpointMediaType[];
  /** Every response, keyed by status, each with all its media types. */
  responses: EndpointResponse[];
  // ── Flat convenience projection (the canonical success case) ──────────
  /** JSON Schema of the request body (first request media type). */
  requestBody?: JsonSchema;
  /** JSON Schema of the primary success (first 2xx JSON) response body. */
  responseBody?: JsonSchema;
  /** Sample request payload for display, pretty JSON text. */
  requestExample: string;
  /** Sample response payload for display, pretty JSON text. */
  responseExample: string;
}

/** The service-level API contract — shown once when a service is picked. */
export interface ServiceContract {
  /** Human-readable rate limit, e.g. "10 req/s · 10,000/day". */
  rateLimit: string;
  /** Link to the vendor's API reference. */
  docsUrl?: string;
  /** One-line notes about versioning, environments, etc. */
  notes?: string;
}

/* ── OpenAPI 3.0 document (canonical service contract) ───────────────
 * A service's API is stored as an OpenAPI 3.0 document — this is the
 * source of truth. Everything the app reads (base URL, auth, endpoints,
 * sample bodies) is projected out of the spec by `materializeService`.
 * Fields OpenAPI has no native home for ride along as `x-` extensions:
 *   info.x-rate-limit      → contract.rateLimit
 *   info.x-notes           → contract.notes
 *   x-test-endpoint        → testEndpoint
 *   x-default-headers      → defaultHeaders
 * Each body's structure is a real JSON Schema under `content.schema`; the
 * illustrative sample rides alongside under `content.example`. The schema is
 * what drives the enrichment field-tree and the Connect wizard's typed
 * params. Each operation's `operationId` preserves the endpoint id so
 * connection instances (enabledEndpointIds) still resolve. */
export interface OpenApiInfo {
  title: string;
  description?: string;
  version: string;
  [ext: `x-${string}`]: unknown;
}

/** OpenAPI media-type object — carries the JSON Schema of the payload plus an
 * illustrative example. Both are authored (schema is the contract). */
export interface OpenApiMediaType {
  schema?: JsonSchema;
  example?: unknown;
}

/** OpenAPI parameter object (path / query / header / cookie). */
export interface OpenApiParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: JsonSchema;
}

export interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: OpenApiParameter[];
  requestBody?: {
    description?: string;
    required?: boolean;
    content?: Record<string, OpenApiMediaType>;
  };
  responses?: Record<
    string,
    { description?: string; content?: Record<string, OpenApiMediaType> }
  >;
  [ext: `x-${string}`]: unknown;
}

export interface OpenApiPathItem {
  /** Parameters shared by every operation on this path. */
  parameters?: OpenApiParameter[];
  get?: OpenApiOperation;
  post?: OpenApiOperation;
  put?: OpenApiOperation;
  delete?: OpenApiOperation;
}

export interface OpenApiDocument {
  openapi: string;
  info: OpenApiInfo;
  servers?: { url: string; description?: string }[];
  paths: Record<string, OpenApiPathItem>;
  components?: {
    securitySchemes?: Record<string, unknown>;
    schemas?: Record<string, JsonSchema>;
  };
  security?: Record<string, string[]>[];
  externalDocs?: { url: string; description?: string };
  [ext: `x-${string}`]: unknown;
}

/** A provider service — the authentication boundary. One credential set
 * works across every endpoint under it.
 *
 * `spec` is canonical; the flat fields below (baseUrl, authType,
 * testEndpoint, defaultHeaders, contract, endpoints) are a materialized
 * projection of it, refreshed by `getAllProviders`. Read them freely, but
 * author changes through `spec` (or the flat authoring form + buildSpec). */
export interface ProviderService {
  id: string;
  name: string;
  description: string;
  /** Integration style. Defaults to 'P2P' when omitted. Data Cloud Connector
   * services authenticate through a dedicated data-stream wizard. */
  type?: ServiceType;
  /** Canonical OpenAPI 3.0 contract — the source of truth for this service. */
  spec: OpenApiDocument;
  // ── Derived projection (read-only; recomputed from `spec`) ──────────
  baseUrl: string;
  /** Auth method for this service (per-service, not per-endpoint). */
  authType: AuthType;
  /** Path the Test step hits to verify reachability. */
  testEndpoint: string;
  /** Default request headers seeded into new connections. */
  defaultHeaders?: { name: string; value: string }[];
  contract: ServiceContract;
  endpoints: ServiceEndpoint[];
}

/** The ergonomic authoring shape for one endpoint — flat request/response
 * bodies + samples. Seeds and the Service wizard author this; buildServiceSpec
 * expands it into a full OpenAPI operation, and materializeService projects it
 * back into the richer ServiceEndpoint. Authors may also supply `parameters`
 * and multiple response statuses via `extraResponses` when they need the
 * fidelity, but the common path is just one request + one 200 response. */
export interface FlatEndpoint {
  id: string;
  name: string;
  method: HttpMethod;
  path: string;
  description: string;
  parameters?: OpenApiParameter[];
  requestBody?: JsonSchema;
  responseBody?: JsonSchema;
  requestExample: string;
  responseExample: string;
  /** Additional non-200 responses (errors, async, etc.) authored inline. */
  extraResponses?: {
    status: string;
    description?: string;
    schema?: JsonSchema;
    example?: string;
  }[];
}

/** The ergonomic authoring shape — a service without its (derived) spec, whose
 * endpoints use the flat FlatEndpoint form. Seed literals are authored this way
 * and normalized to a spec-backed ProviderService by `attachSpec`. The Service
 * wizard also builds this shape and calls `buildServiceSpec` to produce the
 * canonical spec on save. */
export type FlatService = Omit<ProviderService, 'spec' | 'endpoints'> & {
  endpoints: FlatEndpoint[];
};

export interface Provider {
  id: string;
  name: string;
  description: string;
  /** Vendor governance lifecycle. Only "Available" providers can be
   * activated; "Proposed" providers must be approved first. */
  status: ProviderStatus;
  /** Why this provider was added — surfaced in the catalog detail. */
  justification?: string;
  /** Short fallback shown when the remote logo fails to load. */
  logo: string;
  /** Remote logo URL — Clearbit's public Logo API by domain. */
  logoUrl?: string;
  /** Background color for the fallback (initials) logo tile. */
  fallbackColor?: string;
  /** Services this provider exposes (the blueprint behind connections). */
  services: ProviderService[];
}

/** A provider authored in flat form — its services carry the ergonomic
 * FlatService shape (no derived `spec`). Seed literals and custom providers
 * persisted to config use this; `normalizeProvider` attaches specs. */
export type FlatProvider = Omit<Provider, 'services'> & {
  services: FlatService[];
};

/* ── OpenAPI bridge ──────────────────────────────────────────────────
 * buildServiceSpec (flat → OpenAPI) and materializeService (OpenAPI →
 * derived flat projection) are inverses over the fields this app models,
 * so a service round-trips losslessly. These are the single canonical
 * implementation — the Service wizard and the seed normalizer both use
 * them, so there is exactly one place the mapping lives. */

const SPEC_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE'];

/** Map an AuthType to an OpenAPI securityScheme object (undefined = None). */
function authTypeToSecurityScheme(
  authType: AuthType,
  baseUrl: string,
  testEndpoint: string,
): Record<string, unknown> | undefined {
  switch (authType) {
    case 'OAuth 2.0':
      return {
        type: 'oauth2',
        flows: {
          clientCredentials: {
            tokenUrl: `${baseUrl}${testEndpoint || '/token'}`,
            scopes: {},
          },
        },
      };
    case 'API Key':
      return { type: 'apiKey', in: 'header', name: 'X-Api-Key' };
    case 'Basic Auth':
      return { type: 'http', scheme: 'basic' };
    case 'JWT':
      return { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' };
    default:
      return undefined;
  }
}

/** Best-effort reverse of authTypeToSecurityScheme. */
function securitySchemeToAuthType(scheme: unknown): AuthType {
  if (!scheme || typeof scheme !== 'object') return 'None';
  const s = scheme as Record<string, unknown>;
  if (s.type === 'oauth2') return 'OAuth 2.0';
  if (s.type === 'apiKey') return 'API Key';
  if (s.type === 'http') {
    if (s.scheme === 'basic') return 'Basic Auth';
    if (s.scheme === 'bearer') return 'JWT';
  }
  return 'None';
}

/** Parse a sample-JSON string into a value for use as an OpenAPI `example`.
 * Falls back to the raw string when it isn't valid JSON. */
function sampleToExample(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

/** Serialize an example value back to the pretty-printed sample string. */
function exampleToSample(example: unknown): string {
  if (example === undefined) return '';
  if (typeof example === 'string') return example;
  try {
    return JSON.stringify(example, null, 2);
  } catch {
    return '';
  }
}

/** Infer a JSON Schema from an example value. Bootstraps a real schema for
 * every seed endpoint (and any authored sample) without hand-writing it:
 * object → properties (all required); array → items from the first element;
 * scalars → typed leaf with a `format` hint for date-like strings. */
export function inferSchema(value: unknown): JsonSchema {
  if (value === null || value === undefined) return { type: 'null', nullable: true };
  if (Array.isArray(value)) {
    return {
      type: 'array',
      items: value.length > 0 ? inferSchema(value[0]) : {},
    };
  }
  switch (typeof value) {
    case 'object': {
      const entries = Object.entries(value as Record<string, unknown>);
      const properties: Record<string, JsonSchema> = {};
      for (const [k, v] of entries) properties[k] = inferSchema(v);
      return {
        type: 'object',
        properties,
        required: entries.map(([k]) => k),
      };
    }
    case 'number':
      return { type: Number.isInteger(value) ? 'integer' : 'number' };
    case 'boolean':
      return { type: 'boolean' };
    default: {
      const s = value as string;
      const schema: JsonSchema = { type: 'string' };
      if (/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(s)) {
        schema.format = s.includes('T') ? 'date-time' : 'date';
      }
      return schema;
    }
  }
}

/** Infer a JSON Schema from a sample-JSON string. Returns undefined for empty
 * or unparseable input. */
function schemaFromSample(text: string): JsonSchema | undefined {
  const value = sampleToExample(text);
  if (value === undefined) return undefined;
  return inferSchema(value);
}

/** Resolve a "#/components/schemas/Name" reference against a spec's component
 * registry. Returns the referenced schema, or undefined when it can't be
 * resolved (unknown name / external ref). */
function lookupRef($ref: string, spec: OpenApiDocument): JsonSchema | undefined {
  const m = /^#\/components\/schemas\/(.+)$/.exec($ref);
  if (!m) return undefined;
  return spec.components?.schemas?.[m[1]];
}

/** Recursively inline every local $ref in a schema against the spec's
 * component registry, so consumers (field-tree, params) never see a bare ref.
 * Guards against cyclic component graphs via a `seen` ref set — a repeat ref
 * collapses to a `{ description }` stub rather than recursing forever. Foreign
 * or unresolvable refs are left as a `{ $ref }` leaf the UI can label. */
function resolveSchemaRef(
  schema: JsonSchema | undefined,
  spec: OpenApiDocument,
  seen: Set<string> = new Set(),
): JsonSchema | undefined {
  if (!schema) return schema;
  if (schema.$ref) {
    if (seen.has(schema.$ref)) {
      const name = schema.$ref.split('/').pop();
      return { description: `Recursive reference to ${name}.` };
    }
    const target = lookupRef(schema.$ref, spec);
    if (!target) return { $ref: schema.$ref };
    return resolveSchemaRef(target, spec, new Set(seen).add(schema.$ref));
  }
  const out: JsonSchema = { ...schema };
  if (schema.properties) {
    const props: Record<string, JsonSchema> = {};
    for (const [k, v] of Object.entries(schema.properties)) {
      props[k] = resolveSchemaRef(v, spec, seen) ?? v;
    }
    out.properties = props;
  }
  if (schema.items) out.items = resolveSchemaRef(schema.items, spec, seen);
  if (schema.oneOf) {
    out.oneOf = schema.oneOf.map((s) => resolveSchemaRef(s, spec, seen) ?? s);
  }
  if (schema.anyOf) {
    out.anyOf = schema.anyOf.map((s) => resolveSchemaRef(s, spec, seen) ?? s);
  }
  if (schema.allOf) {
    out.allOf = schema.allOf.map((s) => resolveSchemaRef(s, spec, seen) ?? s);
  }
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    out.additionalProperties =
      resolveSchemaRef(schema.additionalProperties, spec, seen) ??
      schema.additionalProperties;
  }
  return out;
}

/** Project one media-type map into resolved EndpointMediaType rows, one per
 * mime type, with $refs inlined and examples pretty-printed. */
function projectContent(
  content: Record<string, OpenApiMediaType> | undefined,
  spec: OpenApiDocument,
): EndpointMediaType[] {
  if (!content) return [];
  return Object.entries(content).map(([mimeType, media]) => ({
    mimeType,
    schema: resolveSchemaRef(media.schema, spec),
    example: exampleToSample(media.example),
  }));
}

/** True when a status key denotes a 2xx success ("200", "201", "2XX"). */
function isSuccessStatus(status: string): boolean {
  return /^2/.test(status);
}

/** Flat authoring shape → canonical OpenAPI 3.0 document. The endpoint id is
 * stored as the operationId so connection instances resolve after a
 * round-trip. */
export function buildServiceSpec(svc: FlatService): OpenApiDocument {
  const paths: Record<string, OpenApiPathItem> = {};
  for (const ep of svc.endpoints) {
    const method = ep.method.toLowerCase() as keyof OpenApiPathItem;
    // OpenAPI keys operations by path→method, so two endpoints sharing the same
    // method + path would collapse into one (the later silently overwrites the
    // earlier). Disambiguate by suffixing the path so every authored endpoint
    // survives into the spec; warn so the source data can be corrected.
    let path = ep.path.trim() || '/';
    if (paths[path]?.[method]) {
      const original = path;
      let n = 2;
      while (paths[`${original}#${n}`]?.[method]) n += 1;
      path = `${original}#${n}`;
      if (typeof console !== 'undefined') {
        console.warn(
          `[providers] Duplicate ${ep.method} ${original} in service "${svc.id}" (endpoint "${ep.id}") — remapped to ${path}. Give endpoints distinct paths.`,
        );
      }
    }
    const op: OpenApiOperation = {
      operationId: ep.id,
      summary: ep.name || undefined,
      description: ep.description || undefined,
    };
    if (ep.parameters && ep.parameters.length > 0) {
      op.parameters = ep.parameters;
    }
    const reqExample = sampleToExample(ep.requestExample);
    const reqSchema = ep.requestBody ?? schemaFromSample(ep.requestExample);
    if (reqSchema !== undefined || reqExample !== undefined) {
      const media: OpenApiMediaType = {};
      if (reqSchema !== undefined) media.schema = reqSchema;
      if (reqExample !== undefined) media.example = reqExample;
      op.requestBody = { content: { 'application/json': media } };
    }
    const resExample = sampleToExample(ep.responseExample);
    const resSchema = ep.responseBody ?? schemaFromSample(ep.responseExample);
    const resMedia: OpenApiMediaType = {};
    if (resSchema !== undefined) resMedia.schema = resSchema;
    if (resExample !== undefined) resMedia.example = resExample;
    const responses: NonNullable<OpenApiOperation['responses']> = {
      '200': {
        description: 'OK',
        ...(resSchema !== undefined || resExample !== undefined
          ? { content: { 'application/json': resMedia } }
          : {}),
      },
    };
    for (const extra of ep.extraResponses ?? []) {
      const media: OpenApiMediaType = {};
      if (extra.schema !== undefined) media.schema = extra.schema;
      const ex = sampleToExample(extra.example ?? '');
      if (ex !== undefined) media.example = ex;
      responses[extra.status] = {
        description: extra.description,
        ...(media.schema !== undefined || media.example !== undefined
          ? { content: { 'application/json': media } }
          : {}),
      };
    }
    op.responses = responses;
    paths[path] = { ...(paths[path] ?? {}), [method]: op };
  }

  const scheme = authTypeToSecurityScheme(
    svc.authType,
    svc.baseUrl,
    svc.testEndpoint,
  );

  const info: OpenApiInfo = {
    title: svc.name || 'Untitled Service',
    version: '1.0.0',
  };
  if (svc.description) info.description = svc.description;
  if (svc.contract?.rateLimit) info['x-rate-limit'] = svc.contract.rateLimit;
  if (svc.contract?.notes) info['x-notes'] = svc.contract.notes;

  const doc: OpenApiDocument = {
    openapi: '3.0.0',
    info,
    servers: [{ url: svc.baseUrl || '' }],
    paths,
  };
  if (svc.contract?.docsUrl) doc.externalDocs = { url: svc.contract.docsUrl };
  if (svc.testEndpoint) doc['x-test-endpoint'] = svc.testEndpoint;
  if (svc.defaultHeaders && svc.defaultHeaders.length > 0) {
    doc['x-default-headers'] = svc.defaultHeaders;
  }
  if (scheme) {
    doc.components = { securitySchemes: { default: scheme } };
    doc.security = [{ default: [] }];
  }
  return doc;
}

/** Project a service's canonical spec into the derived flat fields the app
 * reads (baseUrl, authType, endpoints, …). The inverse of buildServiceSpec. */
export function materializeService(
  id: string,
  name: string,
  description: string,
  type: ServiceType | undefined,
  spec: OpenApiDocument,
): ProviderService {
  const info = spec.info ?? ({} as OpenApiInfo);
  const server0 = spec.servers?.[0];
  const schemes = spec.components?.securitySchemes ?? {};
  const firstScheme = Object.values(schemes)[0];
  const rateLimit =
    typeof info['x-rate-limit'] === 'string'
      ? (info['x-rate-limit'] as string)
      : 'Not specified';
  const notes =
    typeof info['x-notes'] === 'string' ? (info['x-notes'] as string) : undefined;
  const docsUrl = spec.externalDocs?.url;
  const testEndpoint =
    typeof spec['x-test-endpoint'] === 'string'
      ? (spec['x-test-endpoint'] as string)
      : '';
  const defaultHeaders = Array.isArray(spec['x-default-headers'])
    ? (spec['x-default-headers'] as { name: string; value: string }[])
    : undefined;

  const endpoints: ServiceEndpoint[] = [];
  let i = 0;
  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    // Path-level parameters apply to every operation on the path.
    const sharedParams = Array.isArray(pathItem.parameters)
      ? pathItem.parameters
      : [];
    for (const method of SPEC_METHODS) {
      const op = pathItem[method.toLowerCase() as keyof OpenApiPathItem] as
        | OpenApiOperation
        | undefined;
      if (!op || typeof op !== 'object' || Array.isArray(op)) continue;
      i += 1;

      // Parameters — path-level then operation-level, $ref-resolved.
      const rawParams = [
        ...sharedParams,
        ...(Array.isArray(op.parameters) ? op.parameters : []),
      ];
      const parameters: EndpointParameter[] = rawParams.map((p) => ({
        name: p.name,
        in: p.in,
        required: p.in === 'path' ? true : !!p.required,
        description: p.description,
        schema: resolveSchemaRef(p.schema, spec),
      }));

      // Request body — every media type.
      const requestContent = projectContent(op.requestBody?.content, spec);

      // Responses — every status, every media type. Preserve declaration order.
      const responses: EndpointResponse[] = Object.entries(
        op.responses ?? {},
      ).map(([status, res]) => ({
        status,
        description: res?.description,
        content: projectContent(res?.content, spec),
      }));

      // Flat convenience projection: first request media type, and the first
      // 2xx response's JSON media type (or its first media type).
      const primaryReq = requestContent[0];
      const successRes =
        responses.find((r) => isSuccessStatus(r.status)) ?? responses[0];
      const successMedia =
        successRes?.content.find((c) => c.mimeType === 'application/json') ??
        successRes?.content[0];

      endpoints.push({
        id: op.operationId || `${id}-ep-${i}`,
        name: op.summary || op.operationId || path,
        method,
        path,
        description: op.description ?? '',
        parameters,
        requestContent,
        responses,
        requestBody: primaryReq?.schema,
        responseBody: successMedia?.schema,
        requestExample: primaryReq?.example ?? '',
        responseExample: successMedia?.example ?? '',
      });
    }
  }

  return {
    id,
    name,
    description,
    type,
    spec,
    baseUrl: server0?.url ?? '',
    authType: securitySchemeToAuthType(firstScheme),
    testEndpoint,
    defaultHeaders,
    contract: {
      rateLimit,
      docsUrl: docsUrl || undefined,
      notes: notes || undefined,
    },
    endpoints,
  };
}

/** Normalize a flat-authored service (seed or user draft) into a spec-backed
 * ProviderService: build its canonical spec, then re-materialize so the
 * derived fields are exactly what the spec projects. */
export function attachSpec(svc: FlatService): ProviderService {
  const spec = buildServiceSpec(svc);
  return materializeService(svc.id, svc.name, svc.description, svc.type, spec);
}

export const CATEGORIES: ProviderCategory[] = [
  'Firmographic Data',
  'Property Data',
  'Loss History',
  'Credit & Financial',
  'Compliance & Screening',
  'CAT Modeling',
  'AI Underwriting',
  'Other',
];

export const PROVIDER_STATUSES: ProviderStatus[] = [
  'Proposed',
  'Available',
  'Inactive',
];

/** Seed catalog, authored in flat form. Normalized to spec-backed providers
 * in `PROVIDERS` below (each service gets its canonical OpenAPI document). */
const SEED_PROVIDERS: FlatProvider[] = [
  {
    id: 'dnb',
    name: 'Dun & Bradstreet',
    description: 'Business credit, firmographics, financials, and risk insights.',
    status: 'Available',
    justification:
      'Primary source of firmographic and credit data for clearance and appetite checks across all commercial LOBs.',
    logo: 'DB',
    logoUrl: 'https://logo.clearbit.com/dnb.com',
    fallbackColor: '#8E63D8',
    services: [
      {
        id: 'dnb-direct-plus',
        name: 'D&B Direct+',
        description:
          'Firmographics, principals, and corporate linkage by DUNS number.',
        baseUrl: 'https://plus.dnb.com',
        authType: 'OAuth 2.0',
        testEndpoint: '/v2/token',
        defaultHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        contract: {
          rateLimit: '5 req/s · 25,000/day',
          docsUrl: 'https://directplus.documentation.dnb.com',
          notes: 'OAuth 2.0 client-credentials. Tokens expire after 24h.',
        },
        endpoints: [
          {
            id: 'dnb-firmographics',
            name: 'Firmographics',
            method: 'GET',
            path: '/v1/data/duns/{duns}',
            description:
              'Returns the Company Information data block for a DUNS: legal name, address, employees, activity codes.',
            parameters: [
              {
                name: 'duns',
                in: 'path',
                required: true,
                description: '9-digit D-U-N-S Number.',
                schema: { type: 'string' },
              },
              {
                name: 'blockIDs',
                in: 'query',
                required: true,
                description:
                  'Comma-separated data blocks and levels to return.',
                schema: { type: 'string', example: 'companyinfo_L2_v1' },
              },
              {
                name: 'orderReason',
                in: 'query',
                required: false,
                description: 'Numeric permissible-use / order-reason code.',
                schema: { type: 'string', example: '6332' },
              },
            ],
            extraResponses: [
              {
                status: '404',
                description: 'DUNS not found.',
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        errorCode: { type: 'string' },
                        errorMessage: { type: 'string' },
                      },
                    },
                  },
                },
                example:
                  '{\n  "error": {\n    "errorCode": "10001",\n    "errorMessage": "DUNS not found."\n  }\n}',
              },
            ],
            responseBody: {
              type: 'object',
              required: ['transactionDetail', 'organization'],
              properties: {
                transactionDetail: {
                  type: 'object',
                  properties: {
                    transactionID: { type: 'string' },
                    transactionTimestamp: { type: 'string', format: 'date-time' },
                  },
                },
                organization: {
                  type: 'object',
                  required: ['duns', 'primaryName'],
                  properties: {
                    duns: { type: 'string' },
                    primaryName: { type: 'string' },
                    registeredName: { type: 'string' },
                    businessEntityType: {
                      type: 'object',
                      properties: {
                        dnbCode: { type: 'integer' },
                        description: { type: 'string' },
                      },
                    },
                    primaryAddress: {
                      type: 'object',
                      properties: {
                        addressLocality: {
                          type: 'object',
                          properties: { name: { type: 'string' } },
                        },
                        addressRegion: {
                          type: 'object',
                          properties: { abbreviatedName: { type: 'string' } },
                        },
                        postalCode: { type: 'string' },
                        addressCountry: {
                          type: 'object',
                          properties: { isoAlpha2Code: { type: 'string' } },
                        },
                      },
                    },
                    numberOfEmployees: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          value: { type: 'integer' },
                          informationScopeDescription: { type: 'string' },
                          reliabilityDescription: { type: 'string' },
                        },
                      },
                    },
                    primaryIndustryCode: {
                      type: 'object',
                      properties: {
                        usSicV4: { type: 'string' },
                        usSicV4Description: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
            requestExample: '',
            responseExample:
              '{\n  "transactionDetail": {\n    "transactionID": "rrt-0e9c1b...",\n    "transactionTimestamp": "2026-06-01T14:22:05.000Z"\n  },\n  "organization": {\n    "duns": "804735132",\n    "primaryName": "Apex Logistics Corp",\n    "registeredName": "Apex Logistics Corporation",\n    "businessEntityType": { "dnbCode": 451, "description": "Corporation" },\n    "primaryAddress": {\n      "addressLocality": { "name": "Oakland" },\n      "addressRegion": { "abbreviatedName": "CA" },\n      "postalCode": "94607",\n      "addressCountry": { "isoAlpha2Code": "US" }\n    },\n    "numberOfEmployees": [\n      { "value": 420, "informationScopeDescription": "Consolidated", "reliabilityDescription": "Actual" }\n    ],\n    "primaryIndustryCode": { "usSicV4": "4731", "usSicV4Description": "Arrangement of transportation of freight" }\n  }\n}',
          },
          {
            id: 'dnb-match',
            name: 'Cleanse & Match',
            method: 'GET',
            path: '/v1/match/cleanseMatch',
            description:
              'Resolves a name + address to candidate DUNS records with confidence codes and match grades.',
            requestBody: {
              type: 'object',
              required: ['name', 'countryISOAlpha2Code'],
              properties: {
                name: { type: 'string', description: 'Business name to match.' },
                streetAddressLine1: { type: 'string' },
                addressLocality: {
                  type: 'string',
                  description: 'City.',
                },
                addressRegion: {
                  type: 'string',
                  description: 'State / province.',
                },
                postalCode: { type: 'string' },
                countryISOAlpha2Code: {
                  type: 'string',
                  description: 'ISO 3166-1 alpha-2 country code.',
                  example: 'US',
                },
              },
            },
            responseBody: {
              type: 'object',
              properties: {
                matchCandidates: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['duns', 'confidenceCode'],
                    properties: {
                      duns: { type: 'string' },
                      organization: {
                        type: 'object',
                        properties: { primaryName: { type: 'string' } },
                      },
                      confidenceCode: {
                        type: 'integer',
                        description: '1 (low) – 10 (high) match confidence.',
                      },
                      matchGrade: {
                        type: 'string',
                        description: 'Per-component match grade string.',
                      },
                      matchDataProfile: {
                        type: 'object',
                        properties: {
                          matchGradeComponentsCount: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
            requestExample:
              '{\n  "name": "Apex Logistics",\n  "streetAddressLine1": "1200 Harbor Blvd",\n  "addressLocality": "Oakland",\n  "addressRegion": "CA",\n  "countryISOAlpha2Code": "US"\n}',
            responseExample:
              '{\n  "matchCandidates": [\n    {\n      "duns": "804735132",\n      "organization": { "primaryName": "Apex Logistics Corp" },\n      "confidenceCode": 10,\n      "matchGrade": "AAAAAAAAAA",\n      "matchDataProfile": { "matchGradeComponentsCount": 10 }\n    }\n  ]\n}',
          },
          {
            id: 'dnb-financials',
            name: 'Company Financials',
            method: 'GET',
            path: '/v1/data/duns/{duns}/financials',
            description:
              'Financial Strength Insight block — revenue, net worth, and D&B financial-strength indicators.',
            requestBody: {
              type: 'object',
              required: ['duns', 'blockIDs'],
              properties: {
                duns: { type: 'string', description: 'Path parameter — DUNS.' },
                blockIDs: {
                  type: 'string',
                  example: 'financialstrengthinsight_L2_v1',
                },
              },
            },
            responseBody: {
              type: 'object',
              properties: {
                organization: {
                  type: 'object',
                  properties: {
                    duns: { type: 'string' },
                    financialStrengthInsight: {
                      type: 'object',
                      properties: {
                        yearlyRevenue: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              value: { type: 'number' },
                              currency: { type: 'string' },
                            },
                          },
                        },
                        netWorth: {
                          type: 'object',
                          properties: {
                            value: { type: 'number' },
                            currency: { type: 'string' },
                          },
                        },
                        financialCondition: {
                          type: 'object',
                          properties: {
                            dnbCode: { type: 'integer' },
                            description: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            requestExample:
              '{\n  "duns": "804735132",\n  "blockIDs": "financialstrengthinsight_L2_v1"\n}',
            responseExample:
              '{\n  "organization": {\n    "duns": "804735132",\n    "financialStrengthInsight": {\n      "yearlyRevenue": [ { "value": 58200000, "currency": "USD" } ],\n      "netWorth": { "value": 12400000, "currency": "USD" },\n      "financialCondition": { "dnbCode": 12251, "description": "Strong" }\n    }\n  }\n}',
          },
        ],
      },
      {
        id: 'dnb-credit',
        name: 'D&B Credit',
        description: 'Commercial credit scores and delinquency predictors.',
        baseUrl: 'https://plus.dnb.com',
        authType: 'OAuth 2.0',
        testEndpoint: '/v2/token',
        contract: {
          rateLimit: '5 req/s · 10,000/day',
          notes: 'Shares the Direct+ OAuth token.',
        },
        endpoints: [
          {
            id: 'dnb-credit-score',
            name: 'Credit Score',
            method: 'GET',
            path: '/v1/data/duns/{duns}',
            description:
              'Company Financial Health block — D&B Rating, PAYDEX, and Failure/Delinquency scores.',
            requestBody: {
              type: 'object',
              required: ['duns', 'blockIDs'],
              properties: {
                duns: { type: 'string', description: 'Path parameter — DUNS.' },
                blockIDs: {
                  type: 'string',
                  example: 'dnbassessment_L2_v1',
                },
              },
            },
            responseBody: {
              type: 'object',
              properties: {
                organization: {
                  type: 'object',
                  properties: {
                    duns: { type: 'string' },
                    dnbAssessment: {
                      type: 'object',
                      properties: {
                        standardRating: {
                          type: 'object',
                          properties: {
                            rating: {
                              type: 'string',
                              description: 'D&B Rating, e.g. "3A2".',
                            },
                          },
                        },
                        paydexScore: {
                          type: 'object',
                          properties: {
                            value: {
                              type: 'integer',
                              description: '1–100 payment-behavior score.',
                            },
                          },
                        },
                        failureScore: {
                          type: 'object',
                          properties: {
                            classScore: {
                              type: 'integer',
                              description: '1 (lowest risk) – 5 (highest risk).',
                            },
                            nationalPercentile: { type: 'integer' },
                          },
                        },
                        delinquencyScore: {
                          type: 'object',
                          properties: {
                            classScore: { type: 'integer' },
                            nationalPercentile: { type: 'integer' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            requestExample:
              '{\n  "duns": "804735132",\n  "blockIDs": "dnbassessment_L2_v1"\n}',
            responseExample:
              '{\n  "organization": {\n    "duns": "804735132",\n    "dnbAssessment": {\n      "standardRating": { "rating": "3A2" },\n      "paydexScore": { "value": 78 },\n      "failureScore": { "classScore": 2, "nationalPercentile": 41 },\n      "delinquencyScore": { "classScore": 2, "nationalPercentile": 46 }\n    }\n  }\n}',
          },
        ],
      },
    ],
  },
  {
    id: 'verisk',
    name: 'Verisk',
    description: 'Property analytics, catastrophe scores, and policy decisioning.',
    status: 'Available',
    justification:
      'Catastrophe and property risk scoring for Commercial Property risk assessment.',
    logo: 'V',
    logoUrl: 'https://logo.clearbit.com/verisk.com',
    fallbackColor: '#E78B3F',
    services: [
      {
        id: 'verisk-policydecisions',
        name: 'PolicyDecisions',
        description:
          'Prior policy, prefill, and property characteristics at point of quote.',
        baseUrl: 'https://api.verisk.com/policydecisions/v1',
        authType: 'API Key',
        testEndpoint: '/ping',
        defaultHeaders: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'X-Api-Key', value: '{API_Key}' },
        ],
        contract: {
          rateLimit: '20 req/s · 50,000/day',
          docsUrl: 'https://developer.verisk.com',
          notes: 'API key passed on the X-Api-Key header.',
        },
        endpoints: [
          {
            id: 'verisk-prefill',
            name: 'Property Prefill',
            method: 'POST',
            path: '/prefill',
            description:
              'Returns property characteristics (roof, construction, year built).',
            requestExample:
              '{\n  "address": "1200 Harbor Blvd, Oakland, CA 94607"\n}',
            responseExample:
              '{\n  "yearBuilt": 1998,\n  "constructionType": "Masonry",\n  "roofType": "Built-up",\n  "squareFootage": 24500\n}',
          },
          {
            id: 'verisk-catscore',
            name: 'Catastrophe Score',
            method: 'POST',
            path: '/catastrophe/score',
            description: 'Wildfire, flood, and wind exposure scores for a location.',
            requestExample:
              '{\n  "latitude": 37.795,\n  "longitude": -122.279,\n  "perils": ["wildfire", "flood", "wind"]\n}',
            responseExample:
              '{\n  "wildfireScore": 62,\n  "floodZone": "X",\n  "windPool": false\n}',
          },
        ],
      },
    ],
  },
  {
    id: 'iso',
    name: 'ISO',
    description: 'Insurance bureau loss costs, territory definitions, and class codes.',
    status: 'Available',
    justification:
      'Bureau loss costs and class codes for accurate commercial GL and WC pricing.',
    logo: 'IS',
    logoUrl: 'https://logo.clearbit.com/verisk.com',
    fallbackColor: '#3F6FB0',
    services: [
      {
        id: 'iso-losscosts',
        name: 'ISO Loss Costs',
        description:
          'CGL loss costs, territory definitions, and class codes for GL pricing.',
        baseUrl: 'https://api.verisk.com/iso/v1',
        authType: 'API Key',
        testEndpoint: '/health',
        defaultHeaders: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'X-API-Key', value: '{API_Key}' },
          { name: 'X-Client-Version', value: '1.0' },
        ],
        contract: {
          rateLimit: '10 req/s · 3,000/day',
          docsUrl: 'https://www.verisk.com/insurance/products/iso-electronic-rating-content/',
          notes: 'Loss costs are filed per state and effective date.',
        },
        endpoints: [
          {
            id: 'iso-losscost-lookup',
            name: 'Loss Cost Lookup',
            method: 'POST',
            path: '/losscosts',
            description:
              'Returns the filed loss cost for a class code in a territory.',
            requestExample:
              '{\n  "state": "CA",\n  "classCode": "44400",\n  "effectiveDate": "2026-01-01"\n}',
            responseExample:
              '{\n  "territory": "CA",\n  "class_code": "44400",\n  "loss_cost": 1.42,\n  "basis": "Per $1000 payroll",\n  "effective_date": "2026-01-01"\n}',
          },
          {
            id: 'iso-territory',
            name: 'Territory Definition',
            method: 'GET',
            path: '/territories/{state}',
            description: 'Territory boundaries and codes for a state.',
            requestExample: '{\n  "state": "CA"\n}',
            responseExample:
              '{\n  "state": "CA",\n  "territories": [\n    { "code": "001", "description": "San Francisco County" }\n  ]\n}',
          },
        ],
      },
    ],
  },
  {
    id: 'corelogic',
    name: 'CoreLogic',
    description: 'Property intelligence including replacement cost and COPE data.',
    status: 'Available',
    justification:
      'Replacement cost (RCV) and COPE property attributes for Commercial Property valuation.',
    logo: 'CL',
    logoUrl: 'https://logo.clearbit.com/corelogic.com',
    fallbackColor: '#3FA66B',
    services: [
      {
        id: 'corelogic-property',
        name: 'Property Intelligence',
        description: 'RCV estimates, COPE attributes, and catastrophe scores.',
        baseUrl: 'https://api.corelogic.com/property/v2',
        authType: 'OAuth 2.0',
        testEndpoint: '/oauth/token',
        defaultHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        contract: {
          rateLimit: '10 req/s · 2,000/day',
          docsUrl: 'https://developer.corelogic.com',
          notes: 'OAuth 2.0 client-credentials with 1h token TTL.',
        },
        endpoints: [
          {
            id: 'corelogic-clip',
            name: 'Resolve Property (CLIP)',
            method: 'GET',
            path: '/property/v2/properties/search',
            description:
              'Resolves an address to a CoreLogic CLIP (property identifier) — the key every other property call is keyed on.',
            requestBody: {
              type: 'object',
              required: ['streetAddress', 'zipCode'],
              properties: {
                streetAddress: { type: 'string' },
                city: { type: 'string' },
                state: { type: 'string' },
                zipCode: { type: 'string' },
              },
            },
            responseBody: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['clip'],
                    properties: {
                      clip: {
                        type: 'string',
                        description: 'CoreLogic Integrated Property number.',
                      },
                      addressMatchType: { type: 'string' },
                      formattedAddress: { type: 'string' },
                    },
                  },
                },
              },
            },
            requestExample:
              '{\n  "streetAddress": "1200 Harbor Blvd",\n  "city": "Oakland",\n  "state": "CA",\n  "zipCode": "94607"\n}',
            responseExample:
              '{\n  "items": [\n    {\n      "clip": "8451072310",\n      "addressMatchType": "EXACT",\n      "formattedAddress": "1200 HARBOR BLVD, OAKLAND, CA 94607"\n    }\n  ]\n}',
          },
          {
            id: 'corelogic-buildings',
            name: 'Property Detail (Buildings)',
            method: 'GET',
            path: '/property/v2/properties/{clip}/buildings',
            description:
              'Physical building characteristics — construction, roof, size, and year built — for a CLIP.',
            requestBody: {
              type: 'object',
              required: ['clip'],
              properties: {
                clip: { type: 'string', description: 'Path parameter — CLIP.' },
              },
            },
            responseBody: {
              type: 'object',
              properties: {
                clip: { type: 'string' },
                buildings: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      yearBuilt: { type: 'integer' },
                      effectiveYearBuilt: { type: 'integer' },
                      livingAreaSquareFeet: { type: 'integer' },
                      constructionType: {
                        type: 'string',
                        enum: [
                          'FRAME',
                          'MASONRY',
                          'STEEL',
                          'CONCRETE',
                          'MIXED',
                        ],
                      },
                      numberOfStories: { type: 'number' },
                      roof: {
                        type: 'object',
                        properties: {
                          typeCode: { type: 'string' },
                          coverCode: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
            requestExample: '{\n  "clip": "8451072310"\n}',
            responseExample:
              '{\n  "clip": "8451072310",\n  "buildings": [\n    {\n      "yearBuilt": 1998,\n      "effectiveYearBuilt": 2005,\n      "livingAreaSquareFeet": 24500,\n      "constructionType": "MASONRY",\n      "numberOfStories": 2,\n      "roof": { "typeCode": "BUILT_UP", "coverCode": "TAR_GRAVEL" }\n    }\n  ]\n}',
          },
          {
            id: 'corelogic-rcv',
            name: 'Replacement Cost (RCT)',
            method: 'POST',
            path: '/rcv/v3/valuations',
            description:
              'Reconstruction-cost valuation (RCT Express) for a structure by CLIP or address.',
            requestBody: {
              type: 'object',
              required: ['clip'],
              properties: {
                clip: { type: 'string' },
                squareFootage: { type: 'integer' },
                constructionType: {
                  type: 'string',
                  enum: ['FRAME', 'MASONRY', 'STEEL', 'CONCRETE'],
                },
                condition: {
                  type: 'string',
                  enum: ['EXCELLENT', 'GOOD', 'AVERAGE', 'FAIR', 'POOR'],
                },
              },
            },
            responseBody: {
              type: 'object',
              properties: {
                clip: { type: 'string' },
                replacementCost: {
                  type: 'object',
                  properties: {
                    totalCost: { type: 'number' },
                    costPerSquareFoot: { type: 'number' },
                    currency: { type: 'string' },
                  },
                },
                valuationDate: { type: 'string', format: 'date' },
              },
            },
            requestExample:
              '{\n  "clip": "8451072310",\n  "squareFootage": 24500,\n  "constructionType": "MASONRY",\n  "condition": "GOOD"\n}',
            responseExample:
              '{\n  "clip": "8451072310",\n  "replacementCost": {\n    "totalCost": 7320000,\n    "costPerSquareFoot": 298.78,\n    "currency": "USD"\n  },\n  "valuationDate": "2026-06-01"\n}',
          },
        ],
      },
    ],
  },
  {
    id: 'lexisnexis',
    name: 'LexisNexis',
    description: 'Identity verification, loss history, and OFAC/sanctions screening.',
    status: 'Available',
    justification:
      'Loss history (C.L.U.E.) and OFAC screening for clearance and compliance.',
    logo: 'LN',
    logoUrl: 'https://logo.clearbit.com/lexisnexis.com',
    fallbackColor: '#3F8AD0',
    services: [
      {
        id: 'lexisnexis-risk',
        name: 'Risk Solutions',
        description: 'Loss history and sanctions/OFAC screening.',
        baseUrl: 'https://api.lexisnexisrisk.com/v1',
        authType: 'API Key',
        testEndpoint: '/status',
        defaultHeaders: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'apikey', value: '{API_Key}' },
        ],
        contract: {
          rateLimit: '15 req/s · 20,000/day',
          docsUrl: 'https://risk.lexisnexis.com/developers',
          notes: 'FCRA-regulated data; permissible purpose required.',
        },
        endpoints: [
          {
            id: 'lexisnexis-clue',
            name: 'Loss History (C.L.U.E.)',
            method: 'POST',
            path: '/clue/commercial',
            description: 'Prior loss runs for a business at an address.',
            requestExample:
              '{\n  "businessName": "Apex Logistics Corp",\n  "address": "1200 Harbor Blvd, Oakland, CA"\n}',
            responseExample:
              '{\n  "losses": [\n    { "date": "2024-03-12", "type": "Property", "amount": 48200 }\n  ],\n  "totalIncurred": 48200\n}',
          },
          {
            id: 'lexisnexis-ofac',
            name: 'OFAC Screening',
            method: 'POST',
            path: '/screening/ofac',
            description: 'Sanctions/OFAC watchlist match for an entity.',
            requestExample:
              '{\n  "name": "Apex Logistics Corp",\n  "country": "US"\n}',
            responseExample:
              '{\n  "matched": false,\n  "score": 0,\n  "lists": []\n}',
          },
        ],
      },
    ],
  },
  {
    id: 'google-maps',
    name: 'Google Maps',
    description: 'Geocoding, places, and street-level imagery.',
    status: 'Available',
    justification:
      'Address geocoding and standardization for property location resolution.',
    logo: 'G',
    logoUrl: 'https://logo.clearbit.com/google.com',
    fallbackColor: '#E94235',
    services: [
      {
        id: 'gmaps-platform',
        name: 'Maps Platform',
        description: 'Geocoding and place lookup.',
        baseUrl: 'https://maps.googleapis.com/maps/api',
        authType: 'API Key',
        testEndpoint: '/geocode/json',
        defaultHeaders: [],
        contract: {
          rateLimit: '50 req/s · 100,000/day',
          docsUrl: 'https://developers.google.com/maps/documentation',
          notes: 'API key passed as the `key` query parameter.',
        },
        endpoints: [
          {
            id: 'gmaps-geocode',
            name: 'Geocode',
            method: 'GET',
            path: '/geocode/json',
            description: 'Convert an address to latitude/longitude.',
            requestExample:
              '{\n  "address": "1200 Harbor Blvd, Oakland, CA",\n  "key": "{API_Key}"\n}',
            responseExample:
              '{\n  "results": [\n    { "geometry": { "location": { "lat": 37.795, "lng": -122.279 } }, "formatted_address": "1200 Harbor Blvd, Oakland, CA 94607" }\n  ],\n  "status": "OK"\n}',
          },
          {
            id: 'gmaps-places',
            name: 'Place Details',
            method: 'GET',
            path: '/place/details/json',
            description: 'Details for a place by place_id.',
            requestExample:
              '{\n  "place_id": "ChIJ-aBcD",\n  "key": "{API_Key}"\n}',
            responseExample:
              '{\n  "result": { "name": "Apex Logistics", "business_status": "OPERATIONAL" },\n  "status": "OK"\n}',
          },
        ],
      },
    ],
  },
  {
    id: 'rms',
    name: 'RMS',
    description: 'Catastrophe risk modeling for natural perils.',
    status: 'Available',
    justification:
      'Probabilistic catastrophe loss modeling for portfolio and large-property risk.',
    logo: 'R',
    logoUrl: 'https://logo.clearbit.com/rms.com',
    fallbackColor: '#D44A6E',
    services: [
      {
        id: 'rms-riskmodeler',
        name: 'Risk Modeler',
        description: 'Modeled average annual loss and exceedance probabilities.',
        baseUrl: 'https://api.rms.com/riskmodeler/v1',
        authType: 'API Key',
        testEndpoint: '/health',
        defaultHeaders: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Authorization', value: 'Bearer {API_Key}' },
        ],
        contract: {
          rateLimit: '5 req/s · 5,000/day',
          docsUrl: 'https://developer.rms.com',
          notes: 'Modeling jobs are asynchronous; poll for results.',
        },
        endpoints: [
          {
            id: 'rms-aal',
            name: 'Average Annual Loss',
            method: 'POST',
            path: '/locations/analyze',
            description: 'AAL and return-period losses for a location.',
            requestExample:
              '{\n  "latitude": 37.795,\n  "longitude": -122.279,\n  "tiv": 7320000,\n  "peril": "EQ"\n}',
            responseExample:
              '{\n  "aal": 18420,\n  "returnPeriods": { "100": 412000, "250": 980000 }\n}',
          },
        ],
      },
    ],
  },
  {
    id: 'hazardhub',
    name: 'HazardHub',
    description: 'Property hazard scores: crime, natural catastrophe, and environmental.',
    status: 'Available',
    justification:
      'Granular property hazard and crime scores for Data Enrichment in Commercial Property.',
    logo: 'HH',
    logoUrl: 'https://logo.clearbit.com/hazardhub.com',
    fallbackColor: '#E0A100',
    services: [
      {
        id: 'hazardhub-api',
        name: 'HazardHub API',
        description: 'Crime, neighborhood, and natural-catastrophe hazard scores.',
        baseUrl: 'https://api.hazardhub.com/v1',
        authType: 'API Key',
        testEndpoint: '/ping',
        defaultHeaders: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'X-API-Key', value: '{API_Key}' },
        ],
        contract: {
          rateLimit: '20 req/s · 5,000/day',
          docsUrl: 'https://hazardhub.com/api-docs',
          notes: 'Scores returned on a 0–100 scale (higher = more hazard).',
        },
        endpoints: [
          {
            id: 'hazardhub-crime',
            name: 'Crime & Neighborhood',
            method: 'GET',
            path: '/crime',
            description:
              'FBI-sourced crime indices and neighborhood risk scores.',
            requestExample:
              '{\n  "latitude": 37.795,\n  "longitude": -122.279\n}',
            responseExample:
              '{\n  "property_crime_index": 71,\n  "violent_crime_index": 54,\n  "neighborhood_risk": "Moderate"\n}',
          },
          {
            id: 'hazardhub-natcat',
            name: 'NatCat Risk Score',
            method: 'GET',
            path: '/natcat',
            description:
              'Composite natural-catastrophe risk (wildfire, flood, wind, quake).',
            requestExample:
              '{\n  "latitude": 37.795,\n  "longitude": -122.279\n}',
            responseExample:
              '{\n  "wildfire": 62,\n  "flood": 18,\n  "wind": 33,\n  "earthquake": 77,\n  "composite": 64\n}',
          },
        ],
      },
    ],
  },
  {
    id: 'planck',
    name: 'Planck',
    description: 'AI-generated business insights from open-web and digital sources.',
    status: 'Proposed',
    justification:
      'Evaluating AI-sourced business insights to reduce manual research at clearance.',
    logo: 'PL',
    logoUrl: 'https://logo.clearbit.com/planckdata.com',
    fallbackColor: '#5B6CF0',
    services: [
      {
        id: 'planck-insights',
        name: 'Business Insights',
        description:
          'AI-derived operations, exposures, and risk signals for a business.',
        baseUrl: 'https://api.planckdata.com/v1',
        authType: 'OAuth 2.0',
        testEndpoint: '/health',
        defaultHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        contract: {
          rateLimit: '10 req/s · 8,000/day',
          docsUrl: 'https://docs.planckdata.com',
          notes: 'OAuth 2.0; insights returned with confidence scores.',
        },
        endpoints: [
          {
            id: 'planck-insights-lookup',
            name: 'Insights Lookup',
            method: 'POST',
            path: '/insights',
            description:
              'Operations, employee count, and exposure signals for a business.',
            requestExample:
              '{\n  "businessName": "Apex Logistics Corp",\n  "address": "1200 Harbor Blvd, Oakland, CA",\n  "lineOfBusiness": "General Liability"\n}',
            responseExample:
              '{\n  "operations": ["Freight trucking", "Warehousing"],\n  "hasCommercialCooking": false,\n  "employeeCount": 410,\n  "confidence": 0.88\n}',
          },
        ],
      },
    ],
  },
  {
    id: 'bridge-ft',
    name: 'Bridge FT',
    description: 'Financial-transaction data streams ingested through Data Cloud.',
    status: 'Available',
    justification:
      'Streams financial-transaction data into Data Cloud for enrichment and reconciliation.',
    logo: 'BF',
    fallbackColor: '#2E7D6B',
    services: [
      {
        id: 'bridge-ft-dcc',
        name: 'Bridge FT DCC',
        description:
          'Data Cloud Connector ingesting Bridge FT financial-transaction data streams.',
        baseUrl: 'https://api.bridgeft.com/v2',
        type: 'Data Cloud Connector',
        authType: 'OAuth 2.0',
        testEndpoint: '/health',
        defaultHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        contract: {
          rateLimit: '10 req/s · 20,000/day',
          docsUrl: 'https://docs.bridgeft.com',
          notes: 'Data Cloud Connector; ingests data streams into Data Cloud.',
        },
        endpoints: [
          {
            id: 'bridge-ft-transactions',
            name: 'Transactions Stream',
            method: 'GET',
            path: '/transactions',
            description:
              'Financial-transaction records streamed into a Data Cloud DLO.',
            requestExample: '{\n  "accountId": "acct_10482",\n  "since": "2026-01-01"\n}',
            responseExample:
              '{\n  "transactions": [\n    { "id": "txn_88213", "amount": 4200.00, "type": "credit", "postedAt": "2026-01-04" }\n  ]\n}',
          },
        ],
      },
    ],
  },
];

/** Normalize a flat-authored provider into a spec-backed one: every service
 * gets its canonical OpenAPI document (and re-materialized derived fields).
 * Services already carrying a `spec` are re-materialized from it so the
 * spec stays authoritative even for persisted custom entries. */
export function normalizeProvider(p: FlatProvider | Provider): Provider {
  return {
    ...p,
    services: p.services.map((s) => {
      const withSpec = s as Partial<ProviderService>;
      if (withSpec.spec) {
        return materializeService(s.id, s.name, s.description, s.type, withSpec.spec);
      }
      return attachSpec(s as FlatService);
    }),
  };
}

/** The seeded catalog, spec-normalized. Source of truth for lookups. */
export const PROVIDERS: Provider[] = SEED_PROVIDERS.map(normalizeProvider);

/**
 * User-authored providers/services from config.customProviders, synced into
 * this module by ConfigContext so the pure lookups below (used app-wide) can
 * resolve them without threading config through every call site.
 *
 * A custom entry whose id matches a seeded provider is treated as an *overlay*:
 * its services are appended to the seeded provider (this is how "New Service"
 * on a seeded provider persists). Custom entries with a new id are standalone
 * providers.
 */
let CUSTOM_PROVIDERS: Provider[] = [];

export function setCustomProviders(list: Provider[] | undefined): void {
  // Custom entries persisted to config may be flat (older) or spec-backed;
  // normalize so downstream code always sees derived fields + a spec.
  CUSTOM_PROVIDERS = (list ?? []).map(normalizeProvider);
}

/** The seeded catalog merged with any custom providers/services.
 *
 * An overlay service whose id matches a seeded service *replaces* it (this is
 * how editing a seeded service persists); an overlay service with a new id is
 * appended. Custom entries with a new provider id are standalone providers. */
export function getAllProviders(): Provider[] {
  const merged = PROVIDERS.map((p) => ({ ...p, services: [...p.services] }));
  const standalone: Provider[] = [];
  for (const custom of CUSTOM_PROVIDERS) {
    const idx = merged.findIndex((m) => m.id === custom.id);
    if (idx >= 0) {
      // Overlay: the custom entry's metadata (name/category/description/
      // status/logo) shadows the seeded provider so edits persist; its
      // services merge in — replacing seeded services by id, appending new.
      const seeded = merged[idx];
      const services = [...seeded.services];
      for (const svc of custom.services) {
        const si = services.findIndex((s) => s.id === svc.id);
        if (si >= 0) services[si] = svc;
        else services.push(svc);
      }
      merged[idx] = { ...seeded, ...custom, services };
    } else {
      standalone.push({ ...custom, services: [...custom.services] });
    }
  }
  return [...merged, ...standalone];
}

/** Flat lookup helpers. */
export function findProvider(id?: string): Provider | undefined {
  return getAllProviders().find((p) => p.id === id);
}

export function findService(
  providerId?: string,
  serviceId?: string,
): ProviderService | undefined {
  return findProvider(providerId)?.services.find((s) => s.id === serviceId);
}

/** Service lookup by service id alone (service ids are unique across the
 * catalog), returning the owning provider too. */
export function findServiceById(
  serviceId?: string,
): { provider: Provider; service: ProviderService } | undefined {
  if (!serviceId) return undefined;
  for (const provider of getAllProviders()) {
    const service = provider.services.find((s) => s.id === serviceId);
    if (service) return { provider, service };
  }
  return undefined;
}
