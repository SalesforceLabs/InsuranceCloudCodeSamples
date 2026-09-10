import type {
  AssistantContext,
  AssistantMessage,
} from './setup-assistant-store';

/**
 * Subject keys identify a single subcategory inside Setup. Keep these stable
 * — the store dedupes by `AssistantContext.id` so reopening the same
 * subject doesn't replay the script.
 */
export type AssistantSubject =
  // General Setup
  | 'email-to-submission'
  | 'submission-assignment-rules'
  | 'document-classification'
  | 'document-summary-prompt'
  | 'submission-context'
  | 'extraction-templates'
  | 'reconciliation-entities'
  | 'reconciliation-normalization'
  // Submission Settings (parent-Submission level analogues of the LOB
  // sections, plus the General Setup reconciliation entry).
  | 'submission-activities'
  | 'submission-stage-management'
  | 'integrations-health'
  | 'integrations-connections'
  | 'integrations-catalog'
  | 'integrations-dcc-library'
  | 'playbooks'
  // Lines of Business — these resolve generically from the LOB name.
  | 'lob-activities'
  | 'lob-stage-management'
  | 'lob-enrichment-fields'
  | 'lob-enrichment-definitions'
  | 'lob-rn-categories'
  | 'lob-hierarchy'
  | 'lob-line-types-coverages';

interface SubjectMeta {
  title: string;
  /** First line the agent says when launched in default ("Ask") mode. */
  intro: string;
}

const SUBJECTS: Record<AssistantSubject, SubjectMeta> = {
  'email-to-submission': {
    title: 'Email-to-Submission',
    intro:
      "**Email-to-Submission** watches inbound mail addressed to your routing addresses, parses sender, subject, and attachments, and creates a Submission record from each.\n\nUse this to let brokers email new business and renewals straight into Salesforce without filling out a portal form. You'll define one routing address per inbox you want to watch (typically one per LOB) and decide who owns the resulting submissions.",
  },
  'submission-assignment-rules': {
    title: 'Submission Assignment Rules',
    intro:
      'Assignment rules decide which underwriter or queue gets a new submission, based on the values on the record (state, line of business, premium band, etc).\n\nRules run top-to-bottom; the first match wins. Use them to balance workload across desks or to route by specialization.',
  },
  'document-classification': {
    title: 'Document Classification',
    intro:
      'Document Classification tags each uploaded file with a category and document type so the right extraction template runs against it.\n\nCategories group related types (e.g. "ACORD" → ACORD 125, 126, 127). Set a global confidence threshold below which classification falls back to manual review.',
  },
  'document-summary-prompt': {
    title: 'Doc Summary Prompt',
    intro:
      'The Doc Summary Prompt drives the natural-language summary generated for the set of documents received on a submission.\n\nWrite it as an instruction to the model — what to highlight (insured, exposures, key coverages, notable gaps), how long the summary should be, and the tone. It runs once the documents are classified and extracted.',
  },
  'submission-context': {
    title: 'Submission Context',
    intro:
      "The Submission Context Definition is the Salesforce data graph (Submission + child objects) the extraction engine writes against. It tells the model which fields are available to populate from a parsed document.\n\nYou normally won't author one here — Submission Context Definitions live in central Salesforce setup and are referenced from this list.",
  },
  'extraction-templates': {
    title: 'Extraction Templates',
    intro:
      'An Extraction Template tells the LLM how to read a specific document type and which Submission fields to populate from it.\n\nTemplates are scoped to one document category + type pair, pick a model (e.g. Gemini 2.5), and carry a per-template confidence score threshold for auto-apply vs. review.',
  },
  'reconciliation-entities': {
    title: 'Entities and Fields',
    intro:
      'Entities are the conceptual building blocks the reconciliation agent works with — Insured, Location, Building, Coverage, etc.\n\nEach entity exposes a list of fields with optional aliases that the agent uses to merge values from different broker submissions, ACORD forms, and SOVs into one canonical record.',
  },
  'reconciliation-normalization': {
    title: 'Reconciliation & Normalization',
    intro:
      'Normalization turns raw extracted values into a canonical, comparable form before reconciliation merges them — e.g. mapping "GL", "General Liability", and "Gen Liab" to one value.\n\nPick the Agentforce agent that performs normalization and set a confidence threshold below which a normalized value is routed for manual review.',
  },
  'submission-activities': {
    title: 'Submission Activities',
    intro:
      "Submission Activities are the reusable units of work scoped to the parent Submission object — Clearance Check, Sender Verification, OFAC screen, etc.\n\nUnlike LOB activities, these run regardless of which line of business the submission lands on. Define them once here; reference them from any submission-level Stage Configuration.",
  },
  'submission-stage-management': {
    title: 'Submission Stage Management',
    intro:
      'A Submission Stage Configuration defines the workflow that runs at the parent Submission level — clearance, triage, intake — before the record is routed into an LOB-specific path.\n\nEach configuration owns an ordered list of stages with tasks, transition rules, and per-stage prompts.',
  },
  'integrations-health': {
    title: 'Integrations Health',
    intro:
      'The Health view rolls up uptime, latency, and 24-hour error counts for every connection you have running.\n\nUse it to spot a degraded provider before it surfaces as failed enrichment runs in the workbench.',
  },
  'integrations-connections': {
    title: 'Connections',
    intro:
      'Connections are the live, credentialed instances of a provider template — your sandbox key for ISO ClaimSearch, your production token for D&B, etc.\n\nEnrichment Definitions and Activities reference connections by id, so creating one here is what makes a provider usable from elsewhere in the app.',
  },
  'integrations-catalog': {
    title: 'Provider Catalog',
    intro:
      'The Provider Catalog is the curated list of data and rating providers Setup ships templates for.\n\nTemplates pre-fill base URL, auth type, and sample request shape so you can stand up a new connection without writing the contract from scratch.',
  },
  'integrations-dcc-library': {
    title: 'Data Cloud Connector Catalog',
    intro:
      'The Data Cloud Connector Catalog lists the packaged connectors that ingest external data streams into Data Cloud.\n\nBrowse a connector to review its data streams, authenticate it, and deploy it into a Dataspace — the catalog is curated, so you authenticate and deploy from it rather than add your own.',
  },
  playbooks: {
    title: 'Play Books',
    intro:
      'A Playbook is the day-one experience for a given underwriter role: which insight groups they see, which actions are one click away, and how those are ordered.\n\nPlaybooks are scoped to a role (e.g. Junior Underwriter, Underwriting Manager) and become active when the user lands on Run My Day.',
  },
  'lob-activities': {
    title: 'Activities',
    intro:
      'Activities are the reusable units of work scoped to this LOB — Loss Run review, Property Valuation, Compliance Check, etc.\n\nEach activity wraps a Salesforce process (Flow, Integration Procedure, Omniscript, Agent, or Enrichment Definition) so it can be dropped onto any stage of any configuration. Define them once here; reference them everywhere.',
  },
  'lob-stage-management': {
    title: 'Stage Management',
    intro:
      'A Stage Configuration defines the workflow underwriters follow for a submission — the ordered list of stages, which tasks fire on each, and the conditions that move a record forward.\n\nYou can have multiple configurations (e.g. one for new business, one for renewal) and pick which one applies based on submission criteria.',
  },
  'lob-enrichment-fields': {
    title: 'Enrichment Fields',
    intro:
      'Enrichment Fields are the data points the platform can ask third-party providers to fill in for a submission — building age, NAICS code, hazard score, and so on.\n\nGroup them by category (Property, Business, Hazard, etc) so they can be requested as a bundle and mapped together to provider responses.',
  },
  'lob-enrichment-definitions': {
    title: 'Enrichment Definitions',
    intro:
      'An Enrichment Definition wires a category of enrichment fields to one or more provider Connections, then maps the unified API response onto each field.\n\nOnce defined, it can be referenced from an Activity to auto-fill enrichment data on the submission.',
  },
  'lob-rn-categories': {
    title: 'Categories',
    intro:
      'Categories group the data points reconciliation normalizes for this LOB — Property, Business, Hazard, and so on.\n\nThey share the same category list as Enrichment Fields, so anything you add here shows up there too. Field behaviour for reconciliation will evolve independently.',
  },
  'lob-hierarchy': {
    title: 'Hierarchy',
    intro:
      'The Hierarchy describes how records nest for reconciliation — e.g. Insured > Location > Building > Coverage.\n\nYou build nodes from scratch and give each one attributes with a resolution strategy (Most Common, Most Recent, Always Flag, or a ranked Source Priority list) plus a duplicate-check flag.',
  },
  'lob-line-types-coverages': {
    title: 'Line Types and Coverages',
    intro:
      'Line types and coverage templates capture the standard limits, deductibles, and defaulted values that apply across submissions.\n\nUse them to seed new quotes with sensible starting values instead of building each coverage from scratch.',
  },
};

interface BuildOptions {
  subject: AssistantSubject;
  /** When provided, prefixes the title (e.g. "Property — Activities"). */
  scope?: string;
  /**
   * `'ask'` plays the descriptive intro; `'steps'` opens with a placeholder
   * line saying the agent will walk through configuration. The two flows
   * dedupe under different ids so the user can switch between them.
   */
  mode: 'ask' | 'steps';
}

/**
 * Build an `AssistantContext` for a specific subcategory + mode. The store
 * keys on `id` to dedupe back-to-back opens, so any change in subject,
 * scope, or mode produces a new conversation play.
 */
export function buildAssistantContext({
  subject,
  scope,
  mode,
}: BuildOptions): AssistantContext {
  const meta = SUBJECTS[subject];
  const title = scope ? `${scope} — ${meta.title}` : meta.title;
  const id = `${subject}:${scope ?? '_'}:${mode}`;
  const script: AssistantMessage[] =
    mode === 'ask'
      ? [
          {
            role: 'agent',
            delay: 400,
            text: meta.intro,
          },
          {
            role: 'agent',
            delay: 800,
            text: `Want me to walk through how to configure ${meta.title}?`,
            options: [
              { label: 'Yes, show me the steps', value: 'steps' },
              { label: 'Not now', value: 'no' },
            ],
          },
        ]
      : [
          {
            role: 'agent',
            delay: 400,
            text: `Agent will show steps to configure this specific entity — **${meta.title}**.`,
          },
        ];
  return {
    id,
    title,
    subtitle: 'Powered by Agentforce',
    script,
  };
}
