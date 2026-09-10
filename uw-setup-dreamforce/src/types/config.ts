export type FieldType =
  | 'Text'
  | 'Number'
  | 'Currency'
  | 'Date'
  | 'Date/Time'
  | 'Boolean'
  | 'Picklist'
  | 'Multi-Select Picklist'
  | 'Percent'
  | 'Phone'
  | 'Email'
  | 'URL'
  | 'Long Text Area';

export interface Field {
  id: number;
  label: string;
  api: string;
  type: FieldType;
  required: boolean;
  description: string;
  picklistValues: string[];
}

export type ActionType = 'Flow' | 'Integration Procedure' | 'Apex' | 'Manual';

/**
 * Where this activity belongs in the WYSIWYG entity tree:
 *   - 'Parent Submission'    → top-level submission record
 *   - 'Lines of Submission'  → applies to every LOB (default)
 *   - { lob: 'Property' }    → scoped to a single LOB
 * Activity instances created before scopes existed are treated as
 * 'Parent Submission' by default.
 */
export type ActivityScope =
  | 'Parent Submission'
  | 'Lines of Submission'
  | { lob: string };

export interface ReusableActivity {
  id: number;
  name: string;
  description: string;
  action: ActionType | string;
  /**
   * Per-process-type detail bag. Keys depend on `action`:
   *   - Flow                  → { flowName }
   *   - Integration Procedure → { ipName }
   *   - Omniscript            → { omniscriptName }
   *   - Agent                 → { agentName }
   *   - Enrichment Definition → { lob, categoryId, enrichmentDefinitionId, enrichmentDefinitionName }
   */
  actionDetails: Record<string, string>;
  scope?: ActivityScope;
  /** When true, this activity can be picked when an underwriter creates a task
   * ad hoc at run time (not just when pre-configured on a stage). */
  runtimeTaskCreation?: boolean;
}

export interface ActivityConfig {
  id: number;
  name: string;
  active: boolean;
  effectiveFrom: string;
  effectiveTo: string;
}

/**
 * Transition rule attached to a stage. Two shapes coexist for backward
 * compatibility:
 *   • Legacy flat shape — `{ field, operator, value }`. Older configs
 *     stored a single ANDed list of generic field comparisons.
 *   • Current shape — `{ id, toStage, trigger, conditions, expression }`.
 *     Each rule advances to a named target stage, runs as Manual or
 *     Automated, and is gated by an array of task-outcome conditions
 *     combined with an optional filter-logic expression.
 *
 * Both shapes use string keys so legacy data still loads; consumers
 * narrow on the discriminator they care about.
 */
export interface TransitionRule {
  id?: number;
  toStage?: string;
  trigger?: 'Manual' | 'Automated' | string;
  conditions?: TransitionCondition[];
  /** Optional filter logic expression — e.g. "(1 AND 2) OR 3". When
   * empty, the conditions are ANDed. */
  expression?: string;
  // ── Legacy flat shape ──
  field?: string;
  operator?: string;
  value?: string;
}

export interface TransitionCondition {
  /** ID of the task instance under this stage. */
  activityId?: number | string;
  /** Which side of the task to test — Outcome or Value. */
  response?: 'Outcome' | 'Value' | string;
  operator?: string;
  value?: string;
}

export interface StageConfig {
  id: number;
  name: string;
  object: string;
  recordType: string;
  picklist: string;
  stages: string[];
  active: boolean;
  effectiveFrom: string;
  effectiveTo: string;
  /** Configuration-level free-form prompt that applies across all stages. */
  prompt?: string;
  /** Per-stage free-form prompt. Keyed by stage name so reorders don't break refs. */
  stagePrompts?: Record<string, string>;
  /** Per-stage summary prompt template name. Same key strategy as stagePrompts. */
  stageSummaryTemplates?: Record<string, string>;
  /** Per-stage transition rules (ANDed). Same key strategy as stagePrompts. */
  stageTransitionRules?: Record<string, TransitionRule[]>;
}

export interface AvailabilityRule {
  field?: string;
  operator?: string;
  value?: string;
}

export interface TriggerCondition {
  activityId: number;
  response: string;
  operator: string;
  value: string;
}

export interface TriggerRules {
  stageKey: string;
  conditions: TriggerCondition[];
  expression: string;
}

/** A single alert condition. Unlike a TriggerCondition it references no other
 * task — it is evaluated against the current task's own outcome, so it carries
 * only the response side + operator + value. */
export interface AlertCondition {
  response: string;
  operator: string;
  value: string;
}

/** Runtime alert configuration for a task instance. When `enabled`, the task
 * raises a runtime alert whenever its outcome matches the conditions, surfacing
 * in the "Requires Attention" section and/or notifying the assigned user. */
export interface TaskAlertConfig {
  enabled: boolean;
  conditions: AlertCondition[];
  expression: string;
  showInRequiresAttention: boolean;
  notifyUser: boolean;
}

export interface ActivityInstance {
  id: number;
  activityRefId?: number;
  nameOverride?: string;
  /** Task-level description. Seeded from the referenced activity but editable
   * per instance; shown as the task tile subline. */
  description?: string;
  action?: string;
  actionDetails?: Record<string, string>;
  availability: 'On Stage Entry' | 'Conditional' | string;
  /**
   * When `availability === 'Conditional'`, this is the list of
   * conditions that gate visibility. Stored as the legacy
   * `AvailabilityRule[]` for backward-compat; conditions can also
   * carry the same `{ activityId, response, operator, value }` shape
   * `TriggerCondition` uses.
   */
  availabilityRules: AvailabilityRule[] | null;
  /** Optional filter-logic expression for availability conditions
   * (e.g. "(1 AND 2) OR 3"). When empty, conditions are ANDed. */
  availabilityExpression?: string;
  trigger: 'Manual' | 'On Stage Entry' | 'Conditional' | string;
  triggerRules: TriggerRules | null;
  /**
   * Re-entry (loop-back) conditions: when present, the task is re-triggered
   * after its initial run whenever these conditions hold — typically keyed off
   * a later task's outcome (e.g. A runs on stage change, B runs after A, then A
   * re-runs when B's outcome matches). Always conditional. Isolated from
   * `triggerRules` so it never participates in column layout; the canvas draws
   * it as a distinct amber feedback edge. Null/absent when re-entry is off.
   */
  reentryRules?: TriggerRules | null;
  mandatory: boolean;
  buttonName?: string;
  /** Runtime alert configuration. Absent/`enabled: false` when no alert is set. */
  alert?: TaskAlertConfig;
}

export interface AssignmentRule {
  id: number;
  name: string;
  active: boolean;
  createdBy?: string;
  createdOn?: string;
  entries?: AssignmentRuleEntry[];
}

export interface AssignmentRuleEntry {
  id: number;
  sortOrder: number;
  criteria: { field: string; operator: string; value: string }[];
  user?: string;
  noReassign?: boolean;
  emailTemplate?: string;
  predefinedTeams?: string[];
}

export type ConnectionStatus = 'Connected' | 'Disconnected' | 'Needs Attention';
export type AuthType = 'OAuth 2.0' | 'API Key' | 'Basic Auth' | 'JWT' | 'None';
export const AUTH_TYPES: AuthType[] = [
  'OAuth 2.0',
  'API Key',
  'Basic Auth',
  'JWT',
  'None',
];
export type AuthenticationStatus =
  | 'Authenticated'
  | 'Unauthenticated'
  | 'Needs Attention';

/** A request header carried on a connection. Editable in the wizard;
 * seeded from the service blueprint's defaultHeaders. */
export interface ConnectionHeader {
  name: string;
  value: string;
}

/**
 * A saved authentication to ONE provider service. This is the output of
 * Flow 1 (the Authentication wizard): the credentials + transport settings
 * that prove access to a service. One Authentication can back many
 * Connections (Flow 2) — auth is the reusable boundary.
 *
 * Lives under config.authentications, keyed by numeric id.
 */
export interface Authentication {
  id: number;
  /** Optional label; defaults to "<Provider> — <Service>". */
  name?: string;
  providerId: string;
  /** Catalog service this authenticates to (providers.ts ProviderService.id). */
  serviceId: string;
  authType: AuthType | string;
  baseUrl: string;
  /** Path the Test step hits to verify the credentials. */
  testEndpoint?: string;
  /**
   * Free-form key/value bag of credentials. Don't render values back; we
   * only persist them so the demo round-trips.
   */
  credentials?: Record<string, string>;
  /** Request headers sent on every call. Seeded from the service blueprint. */
  headers?: ConnectionHeader[];
  /** Request timeout in ms. */
  timeoutMs?: number;
  /** Retry budget for failed requests. */
  maxRetries?: number;
  status: AuthenticationStatus | string;
  lastTested?: string;
  avgLatency?: number;
}

/** Result of testing a single endpoint in the Connection wizard. */
export interface EndpointTestResult {
  ok: boolean;
  latency: number;
  testedAt: string;
}

/** Who a connection is provisioned for — drives downstream routing. */
export type ConnectionUsageType = 'Underwriter' | 'FSC';
export const CONNECTION_USAGE_TYPES: ConnectionUsageType[] = ['Underwriter', 'FSC'];

export interface Connection {
  id: number;
  name: string;
  authType: AuthType | string;
  baseUrl: string;
  status: ConnectionStatus | string;
  avgLatency?: number;
  errors24h?: number;
  totalCalls24h?: number;
  lastTested?: string;
  providerId?: string;
  /** Catalog service this template targets (providers.ts ProviderService.id). */
  serviceId?: string;
  description?: string;
  /** Endpoint used by the "Test" action to verify the connection. */
  testEndpoint?: string;
}

/**
 * A live connection created by running the Connect wizard against a
 * Connection Template. Holds the user-entered credentials and run-time
 * status. Lives under config.connectionInstances and is what
 * Integrations → Connections lists.
 */
export interface ConnectionInstance {
  id: number;
  /** The Authentication (Flow 1 output) this connection is bound to.
   * Credentials + transport live on the auth; the connection only owns
   * its endpoint selection. Optional for backward compat with pre-split
   * instances that carried their own credentials. */
  authId?: number;
  /** The Connection (template) this instance was launched from. */
  templateId: number;
  /** Snapshot of the template name + provider at create time. */
  name: string;
  providerId?: string;
  /** Catalog service this connection authenticates to (providers.ts
   * ProviderService.id). Auth is service-level, so one credential set
   * works across every enabled endpoint. */
  serviceId?: string;
  /** Who this connection is provisioned for (Underwriter | FSC). */
  usageType?: ConnectionUsageType;
  /** Data categories this connection covers (Firmographic Data, Property
   * Data, …). Set on the connection, not per-endpoint. */
  categories?: import('@/panels/IntegrationHub/providers').ProviderCategory[];
  /** Named Credential the connection authenticates through. P2P connections
   * reference a pre-provisioned Named Credential instead of collecting
   * credentials inline. */
  namedCredential?: string;
  /** Endpoints (providers.ts ServiceEndpoint.id) this connection is
   * allowed to call. A connection authenticates once and fans out to
   * many of its service's endpoints. */
  enabledEndpointIds?: string[];
  /** Per-endpoint test results, keyed by ServiceEndpoint.id. Recorded when
   * the admin tests an individual endpoint in the Connection wizard. */
  endpointTests?: Record<string, EndpointTestResult>;
  /** Request headers sent on every call. Seeded from the service
   * blueprint, editable in the wizard. Legacy — headers now live on the
   * Authentication; kept for backward compat. */
  headers?: ConnectionHeader[];
  authType: AuthType | string;
  baseUrl: string;
  testEndpoint?: string;
  /**
   * Free-form key/value bag of credentials. Legacy — credentials now live
   * on the Authentication; kept for backward compat with pre-split data.
   */
  credentials?: Record<string, string>;
  /** Request timeout in ms (Authentication step). Legacy — now on the auth. */
  timeoutMs?: number;
  /** Retry budget for failed requests. Legacy — now on the auth. */
  maxRetries?: number;
  status: ConnectionStatus | string;
  lastTested?: string;
  avgLatency?: number;
  errors24h?: number;
  totalCalls24h?: number;
  usedBy?: string[];
  /** Data Cloud Connector connections carry a developer name + target
   * Dataspace instead of endpoint selection. Connection "type" itself is
   * derived from the bound service (providers.ts ProviderService.type). */
  developerName?: string;
  dataspace?: string;
}

export type EnrichmentFieldType =
  | 'Text'
  | 'Number'
  | 'Currency'
  | 'Percent'
  | 'Boolean'
  | 'Date'
  | 'Picklist'
  | 'Long Text Area';

export interface EnrichmentField {
  name: string;
  type: EnrichmentFieldType | string;
}

/**
 * Attribute Category (per-LOB) — PRD §11.4.3. `name` remains the canonical
 * identifier consumed elsewhere (Line Types & Coverages category options,
 * enrichment definitions), so it is kept in sync with `label` on save. The
 * remaining fields are the metadata surfaced by the Categories tile/modal.
 */
export interface EnrichmentCategory {
  id: string;
  name: string;
  fields: EnrichmentField[];
  label?: string;
  developerName?: string;
  description?: string;
  displayOrder?: number;
  source?: 'OOTB' | 'User-defined';
}

export interface EnrichmentConfig {
  id: number;
  lob: string;
  active: boolean;
  categories: EnrichmentCategory[];
}

export type IntegrationProcedureStepType =
  | 'HTTP Action'
  | 'Remote Action'
  | 'Set Values'
  | 'Conditional Block'
  | 'Try/Catch Block'
  | 'Loop Block'
  | 'Cache Block'
  | 'Response Action';

export interface IntegrationProcedureStep {
  id: number;
  name: string;
  type: IntegrationProcedureStepType | string;
  description: string;
}

export interface IntegrationProcedure {
  id: number;
  name: string;
  procName: string;
  versionLabel: string;
  description: string;
  lob: string;
  provider: string;
  active: boolean;
  lastModified: string;
  invocationMode: string;
  steps: IntegrationProcedureStep[];
}

export interface EnrichmentDefinition {
  id: number;
  name: string;
  lob: string;
  categoryId: string;
  categoryName: string;
  integrationProcedureName: string;
  active: boolean;
  lastModified: string;
  /** Free-form summary shown on the tile + later wizard steps. */
  description?: string;
  /** ConnectionInstance ids the definition will fan out to in one call.
   * A definition now binds to a single connection, so this holds at most
   * one id (kept as an array for backward compat). */
  connectionInstanceIds?: number[];
  /** The single ServiceEndpoint (providers.ts ServiceEndpoint.id) this
   * definition calls on its bound connection. Kept for backward compat; the
   * definition may now call several endpoints — see `endpointIds`. */
  endpointId?: string;
  /** ServiceEndpoint ids this definition includes, chosen via the checkboxes
   * on the Endpoint step. `endpointId` mirrors the first entry for compat. */
  endpointIds?: string[];
  /** How step 2 resolves the response into fields: the visual Field Mapper
   * table, or a single Apex class that does the mapping in code. */
  mappingMode?: 'fieldMapper' | 'apexClass';
  /** When `mappingMode === 'apexClass'`, the Apex class chosen to map the
   * response. */
  apexClass?: string;
  /** Request Mapping: each row maps an endpoint request field (left) to an
   * object field that sources its value (right). Rows are namespaced by
   * endpoint id (`endpointId::path`) so per-endpoint mappings stay distinct. */
  requestMappings?: EnrichmentFieldMapping[];
  /** Response (field-level) mapping: each row maps an enrichment field (left)
   * to a dot-path in the API response (right). Rows are namespaced by endpoint
   * id (`endpointId::path::name|value`) for per-endpoint mappings. */
  fieldMappings?: EnrichmentFieldMapping[];
  /** Alias mapping: each incoming response attribute name is registered as an
   * alias on a canonical attribute of a line definition (§ Alias Creation). */
  aliasMappings?: EnrichmentAliasMapping[];
}

/** Registers an incoming response attribute name as an alias on a canonical
 * attribute. The target is reached by picking a LOB, a line definition
 * (`LineCoverageEntity`), then one of its canonical attributes. */
export interface EnrichmentAliasMapping {
  /** Incoming response leaf path — the source attribute name stored as alias. */
  sourcePath: string;
  /** LOB whose line definitions the alias targets. */
  lob: string;
  /** `LineCoverageEntity` id (the line definition) owning the attribute. */
  entityId: number;
  /** Canonical attribute id (within the entity) the alias is added to. */
  attributeId: number;
}

export interface EnrichmentFieldMapping {
  /** Name of the enrichment field as it appears under the chosen
   * category in the LOB's Enrichment Fields. */
  fieldName: string;
  /** Dot-separated path into the unified API response (e.g.
   * `location.building.age`). */
  apiPath: string;
}

export interface RmdGroup {
  id: number;
  name: string;
  api: string;
  icon: string;
  order: number;
}

export interface RmdInsight {
  id: number;
  name: string;
  api: string;
  description: string;
  capabilityType: 'calculated' | 'flow' | string;
  capabilityValue: string;
  order: number;
}

export interface RmdAction {
  id: number;
  name: string;
  api: string;
  description?: string;
  type?: string;
}

export interface PlaybookInsight {
  libraryId: number | null;
  name: string;
  api: string;
  description: string;
  capabilityType: 'calculated' | 'flow' | string;
  capabilityValue: string;
  order: number;
  snoozeEnabled: boolean;
  dismissEnabled: boolean;
  actions: RmdAction[];
}

export interface PlaybookGroup {
  libraryId: number | null;
  name: string;
  api: string;
  icon: string;
  order: number;
  insights: PlaybookInsight[];
}

export type UnderwriterRole =
  | 'Junior Underwriter'
  | 'Underwriter'
  | 'Senior Underwriter'
  | 'Underwriter Team Lead'
  | 'Underwriting Manager';

export const UNDERWRITER_ROLES: UnderwriterRole[] = [
  'Junior Underwriter',
  'Underwriter',
  'Senior Underwriter',
  'Underwriter Team Lead',
  'Underwriting Manager',
];

export interface Playbook {
  id: number;
  name: string;
  api: string;
  description: string;
  role?: UnderwriterRole | '';
  active: boolean;
  groups: PlaybookGroup[];
}

/**
 * A KPI card on a persona's Run My Day landing. Up to 5 per persona.
 */
export interface PersonaKpi {
  id: number;
  name: string;
  description: string;
  /** Data source for the KPI value, as `object.field` (free-form). */
  source: string;
  /** Goal / category grouping, e.g. "Risk Quality & Profitability". */
  category?: string;
  /** Human-readable formula, e.g. "(Quoted Premium / Technical Premium) × 100". */
  formula?: string;
  /** How often the value refreshes, e.g. "Monthly". */
  refreshFrequency?: string;
  /** Display unit for the value. */
  unit?: KpiUnit;
  /** RAG thresholds shown as badges in the dashboard. */
  thresholdGreen?: string;
  thresholdYellow?: string;
  thresholdRed?: string;
  /** New KPIs save as Draft until an Underwriter Administrator activates them. */
  status?: KpiStatus;
}

export type KpiStatus = 'Draft' | 'Active';

export type KpiUnit = 'Percent (%)' | 'Currency' | 'Count' | 'Ratio' | 'Days';

export const KPI_UNITS: KpiUnit[] = [
  'Percent (%)',
  'Currency',
  'Count',
  'Ratio',
  'Days',
];

/**
 * Underwriter persona used to scope the Underwriting Landing (Run My Day +
 * List Report) configuration. Each persona maps to an underwriter role.
 */
export interface Persona {
  id: number;
  name: string;
  /** Lookup to the underwriter role this persona represents. */
  role: UnderwriterRole | '';
  /** KPI cards shown in this persona's List Report. */
  kpis?: PersonaKpi[];
  nextKpiId?: number;
  /** Global Run My Day playbook selected for this persona. */
  playbookId?: number | null;
  /**
   * Submission field `api` names chosen as columns for this persona's List
   * Report table, in display order. Selected via a dueling picklist from the
   * Submission object's fields (`config.fields`).
   */
  listReportColumns?: string[];
}

export interface RnAttribute {
  id: number;
  name: string;
  /**
   * Field type. Optional for backward compat with existing seed data;
   * defaults to 'Text' in the editor when missing.
   */
  type?: RnAttributeType;
  /**
   * Alternate names this field is known by in source documents/data —
   * used by reconciliation to map incoming values onto this canonical
   * field. Edited via a chip-style input.
   */
  canonicalNames?: string[];
}

export const RN_ATTRIBUTE_TYPES = [
  'Text',
  'Number',
  'Currency',
  'Percent',
  'Date',
  'Boolean',
  'Picklist',
] as const;
export type RnAttributeType = (typeof RN_ATTRIBUTE_TYPES)[number];

export interface RnEntity {
  id: number;
  name: string;
  attributes: RnAttribute[];
}

export interface RnCoverage {
  id: number;
  name: string;
  baseEntityId: number;
  values: Record<string, string>;
}

export type RnNodeKind = 'entity' | 'coverage';

/** Legacy strategy set — retained for the deprecated Reconciliation panels
 * and existing seed data. New hierarchy attributes use
 * {@link RnResolutionStrategy}. */
export type ResolutionStrategy =
  | 'First Match'
  | 'Last Match'
  | 'Highest Confidence'
  | 'Manual Review'
  | 'Merge';
export const RESOLUTION_STRATEGIES: ResolutionStrategy[] = [
  'First Match',
  'Last Match',
  'Highest Confidence',
  'Manual Review',
  'Merge',
];

/** Strategy used to resolve an attribute across multiple incoming sources. */
export type RnResolutionStrategy =
  | 'Most Common'
  | 'Most Recent'
  | 'Always Flag'
  | 'Source Priority';
export const RN_RESOLUTION_STRATEGIES: RnResolutionStrategy[] = [
  'Most Common',
  'Most Recent',
  'Always Flag',
  'Source Priority',
];

/** Where a value can be sourced from when ranking by Source Priority. */
export type RnSourceType = 'Document' | 'Email' | 'Enrichment';
export const RN_SOURCE_TYPES: RnSourceType[] = ['Document', 'Email', 'Enrichment'];

/** One ranked source in a Source-Priority list. The `type` selects which
 * source-specific fields apply: Document → docCategory + docType (wired to
 * Document Classification's taxonomy); Enrichment → an Enrichment Definition;
 * Email → no further selection. */
export interface RnAttributeSource {
  id: number;
  type: RnSourceType;
  /** Document source — values mirror Document Classification's taxonomy. */
  docCategory?: string;
  docType?: string;
  /** Enrichment source — points at an EnrichmentDefinition. */
  enrichmentDefinitionId?: string;
  enrichmentDefinitionName?: string;
}

export interface RnHierarchyAttribute {
  /** Stable id within a node's attribute list. Optional for legacy seed
   * rows that were keyed by name only. */
  id?: number;
  /** Display name of the attribute. */
  name: string;
  /** Normalization category, sourced from the LOB Categories section. */
  category?: string;
  /** Alternate names this attribute is known by in source data. */
  aliases?: string[];
  /** Strategy used when resolving conflicts across sources. Stored as a
   * string so legacy values survive; the editor coerces unknowns to a
   * sensible default. */
  strategy: RnResolutionStrategy | string;
  /** Whether this attribute participates in duplicate detection. */
  duplicationCheck: boolean;
  /** Ranked sources — only meaningful when strategy is "Source Priority". */
  sources?: RnAttributeSource[];
}

export interface RnHierarchyNode {
  id: number;
  /** Legacy base-entity link. New nodes are authored from scratch and omit
   * these. */
  kind?: RnNodeKind;
  refId?: number;
  label: string;
  /** Optional effective-date window for the node. */
  startDate?: string;
  endDate?: string;
  children: RnHierarchyNode[];
  /** Attributes authored on this node (no longer inherited from an entity). */
  attributes?: RnHierarchyAttribute[];
}

export interface RnHierarchy {
  id: number;
  name: string;
  lob: string;
  nodes: RnHierarchyNode[];
}

/** Hierarchy (v2) — LOB-scoped, tile-listed like Line Types & Coverages.
 * Replaces the auto-created single `RnHierarchy` per LOB. Details carry a
 * name, effective-date window, and active flag; the tree is authored under
 * the Hierarchy tab (reusing the node/attribute shapes). */
export interface HierarchyConfig {
  id: number;
  lob: string;
  name: string;
  startDate?: string;
  endDate?: string;
  active?: boolean;
  nodes: RnHierarchyNode[];
}

/* ── Line Types & Coverages ──────────────────────────────────────────
 * LOB-scoped canonical schema authored under
 * Lines of Business → Reconciliation And Normalization → Line Types and
 * Coverages. Each entity is either a Line Type (§11.4.2 of the R&N PRD) or a
 * Coverage Definition (§11.4.5). Both own a list of Canonical Attribute
 * Definitions (§11.4.4). */

/** The type of a Line Definition. "Line of Business" is reserved for the single
 * OOTB root entity per LOB (non-deletable, type not editable); user-defined
 * definitions are any of the remaining types. Only "Coverage" carries aliases. */
export type LineCoverageKind =
  | 'Line Item'
  | 'Location'
  | 'Account'
  | 'Contact'
  | 'Line of Business'
  | 'Loss History/Claims'
  | 'Policy'
  | 'Coverage';

/** All Line Definition types, used for the type filter. */
export const LINE_DEFINITION_TYPES: LineCoverageKind[] = [
  'Line Item',
  'Location',
  'Account',
  'Contact',
  'Line of Business',
  'Loss History/Claims',
  'Policy',
  'Coverage',
];

/** Types a user may assign to a definition — excludes the OOTB-only
 * "Line of Business" root type. */
export const USER_LINE_DEFINITION_TYPES: LineCoverageKind[] = [
  'Line Item',
  'Location',
  'Account',
  'Contact',
  'Loss History/Claims',
  'Policy',
  'Coverage',
];

export type CanonicalAttributeDataType =
  | 'Currency'
  | 'Text'
  | 'Integer'
  | 'Decimal'
  | 'Date'
  | 'Picklist'
  | 'Boolean';
export const CANONICAL_ATTRIBUTE_DATA_TYPES: CanonicalAttributeDataType[] = [
  'Currency',
  'Text',
  'Integer',
  'Decimal',
  'Date',
  'Picklist',
  'Boolean',
];

export type CanonicalConflictStrategy =
  | 'Most Common'
  | 'Source Priority'
  | 'Most Recent';
export const CANONICAL_CONFLICT_STRATEGIES: CanonicalConflictStrategy[] = [
  'Most Common',
  'Source Priority',
  'Most Recent',
];

export type CanonicalSource = 'OOTB' | 'User-defined';

/** A structured alias row for a Canonical Attribute Definition. `name` is the
 * alternate name; `attr1`–`attr3` are additional attributes to be defined later. */
export interface AttributeAlias {
  id: number;
  name: string;
  attr1?: string;
  attr2?: string;
  attr3?: string;
}

/** Canonical Attribute Definition (§11.4.4). Lives on its owning
 * Line Type / Coverage entity; keyed within that entity by `developerName`. */
export interface CanonicalAttributeDef {
  id: number;
  developerName: string;
  label: string;
  dataType: CanonicalAttributeDataType;
  /** Attribute Category name, sourced from the LOB Categories section
   * (`enrichmentConfigs`). Optional — unset means "Uncategorized". */
  category?: string;
  description?: string;
  /** Type-specific validation, stored as free text (e.g. `{ "min": 0 }`). */
  validationRules?: string;
  isRequired?: boolean;
  /** Always route this attribute for manual review at run time, regardless of
   * whether a value was resolved. */
  alwaysMarkForReview?: boolean;
  conflictStrategy?: CanonicalConflictStrategy;
  /** Alternate names this attribute is known by in source data. Each alias
   * carries a name plus three additional attributes (defined later). */
  aliases?: AttributeAlias[];
  /** Whether this attribute participates in duplicate detection. */
  duplicationCheck?: boolean;
  /** Ranked sources — only meaningful when `conflictStrategy` is
   * "Source Priority". Reuses the hierarchy attribute's source shape. */
  sources?: RnAttributeSource[];
  /** Cross-LOB bridge key (§10.9). */
  commonKey?: string;
  displayOrder?: number;
}

/** A Line Type or Coverage entity, scoped to one LOB. */
export interface LineCoverageEntity {
  id: number;
  lob: string;
  kind: LineCoverageKind;
  /** Marks the single, non-deletable OOTB root entity that represents the LOB
   * itself. Its kind is fixed to "Line of Business" and its label to the LOB
   * name; the type is not editable. */
  isLobRoot?: boolean;
  developerName: string;
  label: string;
  description?: string;
  source?: CanonicalSource;
  active?: boolean;
  /** Line Type only — allowed parent line-type developer names (§11.4.2). */
  allowedParentTypes?: string[];
  /** Line Type only — allowed child line-type developer names. */
  allowedChildTypes?: string[];
  /** Line Type only — AI summary/match prompt template. */
  aiMatchPromptTemplate?: string;
  /** Coverage only — whether this is a sub-coverage (§11.4.5). */
  isSubCoverage?: boolean;
  /** Coverage only — parent Coverage developer name when `isSubCoverage`. */
  parentCoverage?: string;
  /** Coverage only — alternate names this coverage is known by. */
  aliases?: AttributeAlias[];
  /** Canonical Attribute Definitions owned by this entity. */
  attributes: CanonicalAttributeDef[];
}

export interface SetupConfig {
  fields: Field[];
  nextFieldId: number;
  reusableActivities: ReusableActivity[];
  nextReusableActivityId: number;
  activityConfigs: ActivityConfig[];
  nextActivityConfigId: number;
  stageConfigs: StageConfig[];
  nextStageConfigId: number;
  assignmentRules: AssignmentRule[];
  nextAssignmentRuleId: number;
  connections: Connection[];
  nextConnectionId: number;
  activitiesData: Record<string, ActivityInstance[]>;
  stmActivitiesData: Record<string, ActivityInstance[]>;
  nextActivityId: number;
  nextStmActivityId: number;
  enrichmentConfigs: EnrichmentConfig[];
  nextEnrichmentConfigId: number;
  enrichmentDefinitions: EnrichmentDefinition[];
  nextEnrichmentDefinitionId: number;
  integrationProcedures: IntegrationProcedure[];
  nextIntegrationProcedureId: number;
  rmdGroupLibrary: RmdGroup[];
  nextRmdGroupId: number;
  rmdInsightLibrary: RmdInsight[];
  nextRmdInsightId: number;
  rmdActionLibrary: RmdAction[];
  nextRmdActionId: number;
  playbooks: Playbook[];
  nextPlaybookId: number;
  rnEntities: RnEntity[];
  nextRnEntityId: number;
  rnCoverages: RnCoverage[];
  nextRnCoverageId: number;
  rnHierarchies: RnHierarchy[];
  nextRnHierarchyId: number;
  /** Hierarchy (v2) — LOB-scoped, tile-listed hierarchies. Optional for
   * backward compat with existing config files. */
  hierarchyConfigs?: HierarchyConfig[];
  nextHierarchyConfigId?: number;
  /** Line Types & Coverages — LOB-scoped canonical schema entities.
   * Optional for backward compat with existing config files. */
  lineCoverageEntities?: LineCoverageEntity[];
  nextLineCoverageEntityId?: number;
  nextCanonicalAttributeId?: number;
  /**
   * Per-LOB UI metadata (e.g. the icon shown on the LOB hub landing card).
   * Keyed by the picklist value itself. Renaming an LOB requires migrating
   * the keys here too. Values are optional — missing entries fall back to
   * the LOB-name → icon heuristic in LinesOfBusinessPanel.
   */
  lobMeta?: Record<
    string,
    { icon?: string; apiName?: string; source?: string; description?: string }
  >;
  extractionTemplates?: ExtractionTemplate[];
  nextExtractionTemplateId?: number;
  /**
   * Document Classification — global confidence threshold (0–100). Documents
   * classified with confidence below this value are routed for manual review.
   */
  /** Saved authentications to provider services (Flow 1 output). Each is
   * the reusable credential boundary a Connection binds to. */
  authentications?: Authentication[];
  nextAuthenticationId?: number;
  /** Live connections created from connection templates via the Connect
   * wizard. Optional for backward compat with existing seed data. */
  connectionInstances?: ConnectionInstance[];
  nextConnectionInstanceId?: number;
  /**
   * Governance overrides for the code-seeded provider catalog
   * (providers.ts). Keyed by provider id. The catalog ships each provider
   * with a default status; approving a "Proposed" provider or retiring one
   * writes the new status here so it survives reload. Values are
   * `ProviderStatus` strings ('Proposed' | 'Available' | 'Inactive').
   */
  providerStatusOverrides?: Record<string, string>;
  /**
   * User-authored providers and services, layered on top of the code-seeded
   * catalog (providers.ts) at runtime via setCustomProviders(). A custom entry
   * whose id matches a seeded provider appends its services to that provider;
   * a new id is a standalone provider. Authored under General Setup →
   * Integrations → Provider Catalog ("Add Provider" / "New Service").
   */
  customProviders?: import('@/panels/IntegrationHub/providers').Provider[];
  /**
   * Ids of seeded catalog providers the user has deleted. getAllProviders()
   * still merges them (they live in code), so the catalog UI filters these
   * out. Custom (standalone) providers are removed from customProviders
   * outright and don't need to be listed here.
   */
  hiddenProviderIds?: string[];
  documentClassificationThreshold?: number;
  /**
   * Prompt used to generate a natural-language summary of the documents
   * received on a submission. Free-form text authored under Document
   * Extraction → Doc Summary Prompt.
   */
  documentSummaryPrompt?: string;
  /**
   * Per-document-type summary prompt templates. Keyed by
   * `${categoryName}::${type}` (types can repeat across categories, so the
   * category prefix keeps keys unique). Values are prompt-template names from
   * the curated catalog. Authored under Document Extraction → Doc Summary
   * Prompt as a two-column (Doc Category → Doc Type / Prompt Template) editor.
   */
  documentSummaryPrompts?: Record<string, string>;
  /**
   * User-created prompt-template names, surfaced alongside the curated
   * catalog in the Doc Summary Prompt lookup. Created inline via the lookup's
   * "New Prompt Template" action. Kept as plain names since there is no
   * Prompt Templates entity modeled yet.
   */
  documentSummaryPromptTemplates?: string[];
  /**
   * Prompt template applied when a document type has no per-type template
   * assigned in `documentSummaryPrompts`. A name from the same catalog the
   * Doc Summary Prompt lookup draws from. Authored inline above the
   * category / prompt-template columns.
   */
  documentSummaryDefaultTemplate?: string;
  /**
   * Agentforce agent that drives reconciliation across submission lines.
   * Free-form string for now (the agent registry isn't modeled here);
   * the editor offers a curated set of suggestions.
   */
  reconciliationAgent?: string;
  /**
   * Agentforce agent that performs normalization of extracted values into
   * canonical form. Free-form string like `reconciliationAgent`; the editor
   * offers a curated set of suggestions.
   */
  normalizationAgent?: string;
  /**
   * Whether AI-based normalization of extracted attributes is active. When
   * off, the normalization settings (agent + confidence score) are hidden.
   */
  normalizationEnabled?: boolean;
  /**
   * Confidence score (0–100) below which a normalized value is routed for
   * manual review. Mirrors `documentClassificationThreshold`.
   */
  normalizationThreshold?: number;
  /**
   * Similarity score (0–100) used by fuzzy matching during reconciliation.
   * Always available, independent of the semantic-matching (normalization)
   * toggle. Mirrors `normalizationThreshold`.
   */
  fuzzMatchingThreshold?: number;
  /**
   * Default prompt template used to generate the AI summary for a line
   * definition. Free-form string; the editor offers a curated set of
   * suggestions (a lookup to the prompt-template catalog).
   */
  lineDefinitionSummaryPromptTemplate?: string;
  /**
   * Default prompt template used to reconcile a line definition's attributes
   * across sources. Free-form string like `lineDefinitionSummaryPromptTemplate`.
   */
  lineDefinitionReconciliationPromptTemplate?: string;
  /**
   * Salesforce context definition downstream extraction, reconciliation, and
   * activities run against. Free-form string like `reconciliationAgent`; the
   * editor offers a curated set of suggestions.
   */
  submissionContext?: string;
  /**
   * Parent-child taxonomy used by document classification + extraction
   * templates. Categories own a list of types; types are unique within a
   * category but can repeat across categories. Categories with zero types
   * are allowed (they just won't match anything).
   */
  documentTaxonomy?: DocumentCategory[];
  /**
   * Email-to-Submission global settings + routing addresses. Each setting
   * is optional with a sensible default in DEFAULT_CONFIG so old config
   * files continue to load.
   */
  emailToSubmission?: EmailToSubmissionSettings;
  routingAddresses?: RoutingAddress[];
  nextRoutingAddressId?: number;
  /**
   * Underwriter personas that scope the Underwriting Landing (Run My Day +
   * List Report) configuration. Optional for backward compat with existing
   * config files.
   */
  personas?: Persona[];
  nextPersonaId?: number;
  /**
   * Underwriter records surfaced under General Setup → Assignment And Routing →
   * Underwriters. Each maps to a platform user and carries the authority /
   * capacity attributes used by assignment routing. Optional for backward
   * compat with existing config files.
   */
  underwriters?: Underwriter[];
  nextUnderwriterId?: number;
  /**
   * Territory-based assignment decision tables surfaced under General Setup →
   * Assignment And Routing → Territory Based Rules. The user selects the active
   * table; its rows map geographies to underwriters. Optional for backward
   * compat with existing config files.
   */
  territoryDecisionTables?: TerritoryDecisionTable[];
  nextTerritoryTableId?: number;
  /** Id of the decision table currently selected for territory routing. */
  territoryDecisionTableId?: number | null;
  /**
   * Broker Tiers config surfaced under General Setup → Assignment And Routing →
   * Broker Tiers. `brokers` and `brokerTierDecisionTables` are the lookup
   * sources; `brokerTierConfigs` maps a broker to a tiering decision table.
   * Optional for backward compat with existing config files.
   */
  brokers?: Broker[];
  nextBrokerId?: number;
  brokerTierDecisionTables?: BrokerTierDecisionTable[];
  nextBrokerTierTableId?: number;
  /** Id of the decision table used as the default broker tier. */
  brokerTierDefaultTableId?: number | null;
  brokerTierConfigs?: BrokerTierConfig[];
  nextBrokerTierConfigId?: number;
  /** User-defined broker tiers (name + description + field conditions). */
  brokerTierDefinitions?: BrokerTierDefinition[];
  nextBrokerTierDefinitionId?: number;
  /**
   * Skills taxonomy surfaced under General Setup → Assignment And Routing →
   * Skills. `skillTypes` is the parent list; each `skill` references a
   * `skillTypes[].id` via `skillTypeId`. Optional for backward compat with
   * existing config files.
   */
  skillTypes?: SkillType[];
  nextSkillTypeId?: number;
  skills?: Skill[];
  nextSkillId?: number;
  /**
   * Rule-based skill mappings surfaced under General Setup → Assignment And
   * Routing → Skill Mapping. Each mapping ANDs a set of field conditions and,
   * when they match, maps the submission to a skill (via `skillTypeId` /
   * `skillId`). Optional for backward compat with existing config files.
   */
  skillMappings?: SkillMapping[];
  nextSkillMappingId?: number;
  /**
   * Rule-based routing surfaced under General Setup → Assignment And Routing →
   * Routing Rules. Each rule ANDs a set of Submission field conditions and,
   * when they match, routes the submission to a queue. `routingQueues` holds
   * user-created queue names (merged with the curated catalog); when no rule
   * matches, `routingDefaultQueue` is used. Optional for backward compat.
   */
  routingRules?: RoutingRule[];
  nextRoutingRuleId?: number;
  routingQueues?: string[];
  routingDefaultQueue?: string;
}

/** Authority tier an underwriter is granted. */
export const UNDERWRITER_AUTHORITIES = ['Low', 'Medium', 'High', 'Executive'] as const;
export type UnderwriterAuthority = (typeof UNDERWRITER_AUTHORITIES)[number];

/**
 * An underwriter available for submission assignment. `user` is a lookup to a
 * platform user (stored as the display name for now — there is no user entity
 * modeled here). `expertise` holds LOB picklist values from
 * `Line_of_Business__c`.
 */
export interface Underwriter {
  id: number;
  user: string;
  maxTiv: string;
  authority: UnderwriterAuthority | '';
  expertise: string[];
  capacityThreshold: string;
}

/**
 * A single row of a Territory Assignment decision table. The input conditions
 * are three geography columns — `country`, `state`, `zip` — of which one or
 * more may be filled; the output result is the assigned `underwriter`.
 */
export interface TerritoryRule {
  id: number;
  country: string;
  state: string;
  zip: string;
  underwriter: string;
}

/**
 * A standard Salesforce decision table used for territory-based assignment.
 * Selected under General Setup → Assignment And Routing → Territory Based Rules.
 */
export interface TerritoryDecisionTable {
  id: number;
  name: string;
  description?: string;
  rows: TerritoryRule[];
  nextRowId: number;
}

/**
 * A single row of a Broker Tier decision table. The input condition (e.g. a
 * written-premium band) maps to an output `tier`.
 */
export interface BrokerTierRule {
  id: number;
  condition: string;
  tier: string;
}

/**
 * A standard Salesforce decision table that assigns a broker tier. Selected as
 * the default tiering table and referenced per-broker under General Setup →
 * Assignment And Routing → Broker Tiers.
 */
export interface BrokerTierDecisionTable {
  id: number;
  name: string;
  description?: string;
  rows: BrokerTierRule[];
  nextRowId: number;
}

/**
 * A broker record. Detail fields drive the two-column Salesforce record layout
 * shown in the Broker Tiers "View Details" modal. `name` is the brokerage firm.
 */
export interface Broker {
  id: number;
  name: string;
  firm: string;
  title: string;
  email: string;
  phone: string;
  licenseNumber: string;
  segment: string;
  region: string;
  city: string;
  state: string;
  status: string;
  writtenPremium: string;
}

/**
 * A row of the Broker Tiers table — maps a broker to the decision table used to
 * tier it. Both are lookups (nullable until the row is filled in).
 */
export interface BrokerTierConfig {
  id: number;
  brokerId: number | null;
  decisionTableId: number | null;
}

export interface BrokerTierCondition {
  /** Submission field API name. */
  field: string;
  operator: string;
  value: string;
}

/**
 * A broker tier the user defines under General Setup → Assignment And Routing →
 * Broker Tiers. A submission is placed in the tier when its field conditions
 * match. Mirrors the Skill Mapping shape but the outcome is the tier itself
 * (name + description) rather than a lookup.
 */
export interface BrokerTierDefinition {
  id: number;
  name: string;
  description: string;
  conditions: BrokerTierCondition[];
  /** Custom filter logic over condition row numbers (e.g. "(1 AND 2) OR 3").
   * Empty means all conditions are ANDed. */
  expression?: string;
}

export interface EmailToSubmissionSettings {
  /** Master switch — gates the rest of the settings. */
  enabled: boolean;
  // Preferences
  saveAttachmentsAsFiles: boolean;
  deleteDuplicateAttachments: boolean;
  saveRepliesAsDrafts: boolean;
  autoUpdateMessageStatus: boolean;
  notifyExternalSenderOnErrors: boolean;
  setCaseSourceToEmail: boolean;
  // Sender & rate-limit handling
  unauthorizedSenderAction: 'Discard' | 'Bounce';
  overRateLimitAction: 'Discard' | 'Bounce' | 'Requeue';
  // Default owner for created incidents/submissions
  defaultOwnerKind: 'User' | 'Queue';
  defaultOwner: string;
}

export interface RoutingAddress {
  id: number;
  // Routing Information
  emailAddress: string;
  displayName: string;
  routingType: string;
  // Assignment
  assigneeType: 'User' | 'Queue';
  assignee: string;
  priority: string;
  origin: string;
  // Email Settings
  acceptEmailsFrom: string;
}

export interface DocumentCategory {
  /** Display name; uniqueness is enforced case-insensitively. */
  name: string;
  types: string[];
}

/** A skill category (parent). Skills are grouped under a skill type. */
export interface SkillType {
  id: number;
  name: string;
  developerName: string;
}

/** A skill belonging to a skill type. */
export interface Skill {
  id: number;
  skillTypeId: number;
  name: string;
  developerName: string;
  description: string;
}

/** A single condition in a skill mapping rule. `field` is a Submission field
 * API name; conditions in a rule are ANDed. */
export interface SkillMappingCondition {
  /** Submission field API name. */
  field: string;
  operator: string;
  value: string;
}

/** A single condition in a routing rule. `field` is a Submission field API
 * name; conditions in a rule are ANDed (or combined via `expression`). */
export interface RoutingRuleCondition {
  /** Submission field API name. */
  field: string;
  operator: string;
  value: string;
}

/**
 * A routing rule the user defines under General Setup → Assignment And Routing
 * → Routing Rules. When a submission matches the rule's conditions, it is
 * routed to `queue`. Mirrors the Skill Mapping shape, but the outcome is a
 * queue name rather than a skill lookup.
 */
export interface RoutingRule {
  id: number;
  conditions: RoutingRuleCondition[];
  /** Custom filter logic over condition row numbers (e.g. "(1 AND 2) OR 3").
   * Empty means all conditions are ANDed. */
  expression?: string;
  /** Queue the submission is routed to when the rule matches. */
  queue: string;
}

/** A rule that maps a submission to a skill when its conditions match. */
export interface SkillMapping {
  id: number;
  conditions: SkillMappingCondition[];
  /** Custom filter logic over condition row numbers (e.g. "(1 AND 2) OR 3").
   * Empty means all conditions are ANDed. */
  expression?: string;
  /** Skill this mapping applies. Both may be null until configured. */
  skillTypeId: number | null;
  skillId: number | null;
}

export interface ExtractionTemplate {
  id: number;
  name: string;
  description: string;
  /** LLM model used for extraction (e.g. "Gemini 2.5"). */
  model: string;
  /** 0–100. Scores below this require manual review. */
  confidenceScoreThreshold: number;
  /** Top-level document category (e.g. "ACORD"). */
  documentCategory: string;
  /** Specific document type within the category (e.g. "ACORD 125"). */
  documentType: string;
  active?: boolean;
}

export const DEFAULT_CONFIG: SetupConfig = {
  fields: [],
  nextFieldId: 1,
  reusableActivities: [],
  nextReusableActivityId: 1,
  activityConfigs: [],
  nextActivityConfigId: 1,
  stageConfigs: [],
  nextStageConfigId: 1,
  assignmentRules: [],
  nextAssignmentRuleId: 1,
  connections: [],
  nextConnectionId: 1,
  activitiesData: {},
  stmActivitiesData: {},
  nextActivityId: 1,
  nextStmActivityId: 1,
  enrichmentConfigs: [],
  nextEnrichmentConfigId: 1,
  enrichmentDefinitions: [],
  nextEnrichmentDefinitionId: 1,
  integrationProcedures: [],
  nextIntegrationProcedureId: 1,
  rmdGroupLibrary: [],
  nextRmdGroupId: 1,
  rmdInsightLibrary: [],
  nextRmdInsightId: 1,
  rmdActionLibrary: [],
  nextRmdActionId: 1,
  playbooks: [],
  nextPlaybookId: 1,
  rnEntities: [],
  nextRnEntityId: 1,
  rnCoverages: [],
  nextRnCoverageId: 1,
  rnHierarchies: [],
  nextRnHierarchyId: 1,
  hierarchyConfigs: [],
  nextHierarchyConfigId: 1,
  lineCoverageEntities: [],
  nextLineCoverageEntityId: 1,
  nextCanonicalAttributeId: 1,
  lobMeta: {},
  extractionTemplates: [],
  nextExtractionTemplateId: 1,
  authentications: [],
  nextAuthenticationId: 1,
  connectionInstances: [],
  nextConnectionInstanceId: 1,
  providerStatusOverrides: {},
  customProviders: [],
  hiddenProviderIds: [],
  documentClassificationThreshold: 50,
  documentSummaryPrompt: '',
  documentSummaryPrompts: {},
  documentSummaryPromptTemplates: [],
  documentSummaryDefaultTemplate: '',
  reconciliationAgent: 'Default Reconciliation Agent',
  normalizationAgent: 'Default Normalization Agent',
  normalizationEnabled: true,
  normalizationThreshold: 50,
  fuzzMatchingThreshold: 80,
  lineDefinitionSummaryPromptTemplate: 'Line Summary — Standard',
  lineDefinitionReconciliationPromptTemplate: 'Line Reconciliation — Standard',
  submissionContext: 'Submission Context',
  emailToSubmission: {
    enabled: false,
    saveAttachmentsAsFiles: true,
    deleteDuplicateAttachments: true,
    saveRepliesAsDrafts: true,
    autoUpdateMessageStatus: true,
    notifyExternalSenderOnErrors: true,
    setCaseSourceToEmail: true,
    unauthorizedSenderAction: 'Bounce',
    overRateLimitAction: 'Requeue',
    defaultOwnerKind: 'User',
    defaultOwner: '',
  },
  routingAddresses: [],
  nextRoutingAddressId: 1,
  documentTaxonomy: [
    {
      name: 'ACORD',
      types: ['ACORD 125', 'ACORD 126', 'ACORD 127', 'ACORD 140'],
    },
    { name: 'SOV', types: ['Statement of Values'] },
    { name: 'Loss Run', types: ['Carrier Loss Run', 'Broker Loss Summary'] },
    { name: 'Carrier Submission', types: ['Carrier Submission Cover'] },
    { name: 'Other', types: ['Generic'] },
  ],
  personas: [
    { id: 1, name: 'Junior Underwriter', role: 'Junior Underwriter' },
    { id: 2, name: 'Underwriter', role: 'Underwriter' },
    { id: 3, name: 'Senior Underwriter', role: 'Senior Underwriter' },
  ],
  nextPersonaId: 4,
  underwriters: [],
  nextUnderwriterId: 1,
  territoryDecisionTables: [],
  nextTerritoryTableId: 1,
  territoryDecisionTableId: null,
  brokers: [],
  nextBrokerId: 1,
  brokerTierDecisionTables: [],
  nextBrokerTierTableId: 1,
  brokerTierDefaultTableId: null,
  brokerTierConfigs: [],
  nextBrokerTierConfigId: 1,
  brokerTierDefinitions: [],
  nextBrokerTierDefinitionId: 1,
  skillTypes: [],
  nextSkillTypeId: 1,
  skills: [],
  nextSkillId: 1,
  skillMappings: [],
  nextSkillMappingId: 1,
  routingRules: [],
  nextRoutingRuleId: 1,
  routingQueues: [],
  routingDefaultQueue: '',
};
