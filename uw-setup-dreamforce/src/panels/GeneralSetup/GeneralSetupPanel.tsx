import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ThreePanelHub, navigateHub, type HubCategory } from '@/components/ThreePanelHub';
import { openSetupAssistant } from '@/components/shell/setup-assistant-store';
import { Badge, Button, Card, Checkbox, Dropdown, DuelingPicklist, Icon, Input, Modal, Table, Tabs, Textarea, Toggle } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import {
  UNDERWRITER_AUTHORITIES,
  UNDERWRITER_ROLES,
  type RoutingRule,
  type RoutingRuleCondition,
  KPI_UNITS,
  type Field,
  type KpiUnit,
  type Persona,
  type PersonaKpi,
  type Playbook,
  type Skill,
  type SkillType,
  type SkillMapping,
  type SkillMappingCondition,
  type Underwriter,
  type UnderwriterAuthority,
  type UnderwriterRole,
} from '@/types/config';
import { ExtractionTemplatesSection } from './ExtractionTemplatesSection';
import {
  Column,
  DocumentClassificationSection,
  DocumentSummaryPromptSection,
  RowMenu,
} from './DocumentClassificationSection';
import './DocumentClassification.css';
import { ConnectionsSection } from './ConnectionsSection';
import { EmailToSubmissionPanel } from '@/panels/EmailToSubmission/EmailToSubmissionPanel';
import { SubmissionContextSection } from './SubmissionEntitySection';
import { ReconciliationNormalizationSection } from './ReconciliationSection';
import { LobActivitiesSection } from '@/panels/LinesOfBusiness/LobActivitiesSection';
import { PlaybookWizard } from '@/panels/RunMyDay/PlaybookWizard';
import '@/panels/ActivitiesAndStages/ActivitiesEntityEditor.css';
import '@/panels/ActivitiesAndStages/LobStageEditor.css';
import '@/panels/LinesOfBusiness/LobActivitiesSection.css';
import '@/panels/LinesOfBusiness/LobStageManagementSection.css';
import './GeneralSetup.css';

export function GeneralSetupPanel() {
  const { config } = useConfig();

  // Build the category list at render time. Sections that ship a `render()`
  // handle their own empty state internally — we only override here for
  // subcategories that don't have an editor of their own yet (so the user
  // gets the "step-by-step" CTA + illustration in those slots).
  const categories: HubCategory[] = useMemo(() => {
    return [
      {
        key: 'submission-ingestion',
        label: 'Email Ingestion',
        icon: 'email',
        description:
          'Turn inbound emails into submission records and route them to the right desk.',
        subcategories: [
          {
            key: 'email-to-submission',
            label: 'Email Ingestion',
            icon: 'email',
            description: 'Configure routing addresses and email-to-record settings.',
            render: () => <EmailToSubmissionPanel />,
            info: { subject: 'email-to-submission' },
          },
        ],
      },
      {
        key: 'assignment-and-routing',
        label: 'Assignment And Routing',
        icon: 'change_owner',
        description:
          'Manage the underwriters submissions can be routed to and their authority.',
        subcategories: [
          {
            key: 'queue-routing-setup',
            label: 'Queue-Based Routing Setup',
            icon: 'workflow',
            group: 'Guided Setup',
            description:
              'Step-by-step guide to configure Omni-Channel queue- and skill-based routing.',
            render: () => <QueueRoutingSetupSection />,
          },
          {
            key: 'skills',
            label: 'Skill Definition',
            icon: 'sparkles',
            group: 'Skills',
            description:
              'Define skill types and the skills within each, used to match submissions to underwriters.',
            render: () => <SkillsSection />,
          },
          {
            key: 'skill-mapping',
            label: 'Skill Mapping',
            icon: 'workflow',
            group: 'Skills',
            description:
              'Rule-based mapping that assigns a skill to a submission when its field conditions match.',
            render: () => <SkillMappingSection />,
          },
          {
            key: 'routing-rules',
            label: 'Routing Rules',
            icon: 'workflow',
            group: 'Routing',
            description:
              'Route submissions to a queue using field-based rules, with a default queue when no rule matches.',
            render: () => <RoutingRulesSection />,
          },
          {
            key: 'routing-flows',
            label: 'Routing Flows',
            icon: 'workflow',
            group: 'Routing',
            description:
              'Flows that orchestrate how submissions are routed.',
            render: () => <RoutingFlowsSection />,
          },
        ],
      },
      {
        key: 'submission-context',
        label: 'Submission Context',
        icon: 'data_mapping',
        description:
          'Salesforce context definition the extraction engine runs against.',
        subcategories: [
          {
            key: 'submission-context',
            label: 'Submission Context',
            icon: 'data_mapping',
            description:
              'Salesforce context definition the extraction engine runs against.',
            render: () => <SubmissionContextSection />,
            info: { subject: 'submission-context' },
          },
        ],
      },
      {
        key: 'activities',
        label: 'Activities',
        icon: 'task',
        description:
          'Define global activities available to every line of business in stage management.',
        subcategories: [
          {
            key: 'global-activities',
            label: 'Activities',
            icon: 'task',
            description:
              'Global activities available for use in stage management across all LOBs.',
            render: () => <LobActivitiesSection global />,
            info: { subject: 'lob-activities' },
          },
        ],
      },
      {
        key: 'document-extraction',
        label: 'Document Extraction',
        icon: 'text_template',
        description:
          'Classify uploaded documents and extract structured data with templates.',
        subcategories: [
          {
            key: 'document-classification',
            label: 'Document Classification',
            icon: 'doc',
            description:
              'Recognize ACORD forms, SOVs, loss runs, and other broker documents.',
            render: () => <DocumentClassificationSection />,
            info: { subject: 'document-classification' },
          },
          {
            key: 'extraction-templates',
            label: 'Extraction Templates',
            icon: 'workflow',
            description: 'Map fields from each document type to Submission attributes.',
            render: () => <ExtractionTemplatesSection />,
            info: { subject: 'extraction-templates' },
          },
          {
            key: 'doc-summary-prompt',
            label: 'Doc Summary Prompt',
            icon: 'doc',
            description:
              'Prompt used to generate a summary of the documents received on a submission.',
            render: () => <DocumentSummaryPromptSection />,
            info: { subject: 'document-summary-prompt' },
          },
        ],
      },
      {
        key: 'reconciliation-normalization',
        label: 'Reconciliation & Normalization',
        icon: 'aggregate',
        description:
          'Choose the normalization agent and confidence threshold used before reconciliation merges extracted values.',
        subcategories: [
          {
            key: 'reconciliation-normalization',
            label: 'Reconciliation & Normalization',
            icon: 'aggregate',
            description:
              'Choose the normalization agent and confidence threshold used before reconciliation merges extracted values.',
            render: () => <ReconciliationNormalizationSection />,
            info: { subject: 'reconciliation-normalization' },
          },
        ],
      },
      {
        key: 'integrations',
        label: 'Underwriting Integrations',
        icon: 'apex_plugin',
        description: 'Live connections configured from the provider catalog.',
        subcategories: [
          {
            key: 'connections',
            label: 'Connections',
            icon: 'apex_plugin',
            description: 'Live connections configured from the provider catalog.',
            render: () => (
              <>
                <p
                  style={{
                    margin: '0 0 var(--slds-g-spacing-4)',
                    fontSize: 'var(--slds-g-font-scale-base)',
                    color: 'var(--slds-g-color-on-surface-2)',
                  }}
                >
                  For all integrations and Provider Catalog,{' '}
                  <Link to="/integrations">click here</Link>.
                </p>
                <h3
                  style={{
                    margin: '0 0 var(--slds-g-spacing-3)',
                    fontSize: 'var(--slds-g-font-scale-2)',
                    fontWeight: 'var(--slds-g-font-weight-6)',
                    color: 'var(--slds-g-color-on-surface-3)',
                  }}
                >
                  Connections
                </h3>
                <ConnectionsSection />
              </>
            ),
            info: { subject: 'integrations-connections' },
          },
        ],
      },
      {
        key: 'underwriting-landing',
        label: 'Underwriting Landing',
        icon: 'target_mode',
        description: 'Configure the daily underwriter landing experience.',
        subcategories: [
          {
            key: 'underwriting-landing',
            label: 'Underwriting Landing',
            icon: 'target_mode',
            description: 'Configure the daily underwriter landing experience.',
            render: () => <UnderwritingLandingTabs />,
          },
        ],
      },
    ];
  }, [config]);

  return (
    <div className="gs-page">
      <header className="gs-hero">
        <div className="gs-hero__inner">
          <h1 className="gs-hero__title">General Setup</h1>
          <p className="gs-hero__subtitle">
            Configure platform-wide ingestion, extraction, integrations, and reconciliation. Pick a
            category below to dive into its sections.
          </p>
        </div>
        <Card
          className="gs-hero__assistant"
          title="Get Setup Help"
          subtitle="The Setup Assistant walks you through configuration step by step, suggests defaults, and surfaces the right page for the task you describe."
          actions={
            <Button
              variant="brand"
              iconLeading={<Icon name="sparkles" size={14} />}
              onClick={() => openSetupAssistant()}
            >
              Launch Setup Assistant
            </Button>
          }
          padding="none"
        />
      </header>
      <ThreePanelHub categoriesTitle="Categories" categories={categories} />
    </div>
  );
}

const ROUTING_RULE_OPERATORS = [
  'equals',
  'not equals',
  'contains',
  'does not contain',
  'starts with',
  'ends with',
  'is blank',
  'is not blank',
];
const ROUTING_RULE_NO_VALUE_OPS = new Set(['is blank', 'is not blank']);

/** Queues available to the Routing Rules lookup. There is no Queue entity in
 * the schema — this is a curated catalog of the queues the platform ships.
 * User-created queues (`routingQueues`) are merged on top at render time. */
const ROUTING_QUEUES = [
  'Property Underwriting',
  'Casualty Underwriting',
  'Cyber Underwriting',
  'Auto Underwriting',
  'Complex Risk Review',
  'New Business Triage',
  'Unassigned',
];

const ROUTING_FLOWS: { name: string; description: string }[] = [
  {
    name: 'Standard Submission Routing',
    description: 'Evaluates routing rules in order and assigns the submission to the first matching queue.',
  },
  {
    name: 'Complex Risk Escalation',
    description: 'Routes high-value or flagged submissions to the Complex Risk Review queue for senior underwriter attention.',
  },
  {
    name: 'New Business Triage',
    description: 'Directs new-business submissions to the triage queue for initial completeness and appetite checks.',
  },
];

/**
 * Routing Flows — General Setup → Assignment And Routing → Routing Flows.
 * A read-only catalog of the flows that orchestrate submission routing. The
 * "Add Flow" action is a placeholder that would hand off to the Flow Builder.
 */
function RoutingFlowsSection() {
  const [openBuilder, setOpenBuilder] = useState(false);

  return (
    <Card
      className="dc-taxonomy-card"
      title={<span className="dc-taxonomy-title">Routing Flows</span>}
      subtitle="Flows that orchestrate how submissions are routed to queues and underwriters."
      padding="none"
    >
      <div style={{ padding: 'var(--slds-g-spacing-4)' }}>
        <div className="lse-rules">
          <div className="lse-rules__head">
            <button
              type="button"
              className="lob-activities__new-btn"
              onClick={() => setOpenBuilder(true)}
            >
              <Icon name="plus" size={12} />
              Add Flow
            </button>
          </div>

          <div className="lse-tr-group">
            <table className="lse-tr-table">
              <thead>
                <tr>
                  <th style={{ width: 260 }}>Flow</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {ROUTING_FLOWS.map((f) => (
                  <tr key={f.name}>
                    <td>
                      <div className="lse-tr-conditions__line">
                        <a
                          href="#"
                          className="lse-tr-table__link"
                          onClick={(e) => {
                            e.preventDefault();
                            setOpenBuilder(true);
                          }}
                        >
                          {f.name}
                        </a>
                      </div>
                    </td>
                    <td>{f.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        open={openBuilder}
        onClose={() => setOpenBuilder(false)}
        size="sm"
        title="Add Flow"
        footer={
          <>
            <Button variant="neutral" onClick={() => setOpenBuilder(false)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={() => setOpenBuilder(false)}>
              Open Flow Builder
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, color: 'var(--slds-g-color-on-surface-1)' }}>
          This will open the default Flow Builder to create a new routing flow.
        </p>
      </Modal>
    </Card>
  );
}

/**
 * Queue-Based Routing Setup — General Setup → Assignment And Routing.
 * A read-only, numbered walkthrough of the Salesforce Omni-Channel queue- and
 * skill-based routing setup sequence. Each step's "Go to Setup" is a stub that
 * opens a modal naming the Setup section it would take you to.
 */
const QUEUE_ROUTING_STEPS: {
  title: string;
  setupSection: string;
  description: string;
  /**
   * When set, "Go to Setup" jumps the hub to this in-app section instead of
   * opening the external-Setup modal. `sub` is a subcategory key within the
   * Assignment And Routing category.
   */
  nav?: { cat: string; sub: string };
}[] = [
  {
    title: 'Enable Omni-Channel & Skill-Based Routing',
    setupSection: 'Setup → Omni-Channel Settings',
    description:
      'Enable Omni-Channel, then enable Skills-Based and Direct-to-Agent Routing to turn on skill matching.',
  },
  {
    title: 'Create Service Channel',
    setupSection: 'Setup → Omni-Channel → Service Channels',
    description:
      'Define which object (Case, Submission, etc.) Omni-Channel is allowed to route work items from.',
  },
  {
    title: 'Create Skill',
    setupSection: 'General Setup → Assignment And Routing → Skill Definition',
    description:
      'Define a reusable competency label (e.g. "Property", "Excess Casualty") used to match work to underwriters.',
    nav: { cat: 'assignment-and-routing', sub: 'skills' },
  },
  {
    title: 'Map Skills to Submission',
    setupSection: 'General Setup → Assignment And Routing → Skill Mapping',
    description:
      'Define the rules that determine which skills a submission requires, so routing can match it to underwriters with that expertise.',
    nav: { cat: 'assignment-and-routing', sub: 'skill-mapping' },
  },
  {
    title: 'Create Routing Configuration',
    setupSection: 'Setup → Omni-Channel → Routing Configurations',
    description:
      'Set the routing model and priority that determine how queued work items are prioritized and assigned.',
  },
  {
    title: 'Create Queue & Assign Routing Config',
    setupSection: 'Setup → Queues',
    description:
      'Create the queue and link it to a Routing Configuration so Omni-Channel can route its work.',
  },
  {
    title: 'Create Skill-Based Routing Rule',
    setupSection: 'General Setup → Assignment And Routing → Routing Rules',
    description:
      "Define the rule that matches a submission's required skills to underwriters so it routes by skill.",
    nav: { cat: 'assignment-and-routing', sub: 'routing-rules' },
  },
  {
    title: 'Create Presence Configuration',
    setupSection: 'Setup → Omni-Channel → Presence Configurations',
    description:
      "Control each underwriter's capacity — max concurrent work items and per-channel weighting.",
  },
  {
    title: 'Enable "Service Cloud User"',
    setupSection: 'Setup → Users',
    description:
      'Set the Service Cloud User license flag required before a user can receive routed work.',
  },
  {
    title: 'Create Service Resource & Assign Skill',
    setupSection: 'Setup → Service Resources',
    description:
      'Register the underwriter as a routable resource and attach the skills the routing engine matches against.',
  },
];

function QueueRoutingSetupSection() {
  const [target, setTarget] = useState<{ title: string; setupSection: string } | null>(
    null,
  );
  // Step 1 gates the rest: the remaining steps only appear once Omni-Channel &
  // Skill-Based Routing is enabled via the toggle.
  const [enabled, setEnabled] = useState(false);

  // Step 1 is the gate (rendered with a toggle); the rest follow it.
  const [gateStep, ...restSteps] = QUEUE_ROUTING_STEPS;

  return (
    <Card
      className="dc-taxonomy-card"
      title={<span className="dc-taxonomy-title">Queue-Based Routing Setup</span>}
      subtitle="Follow these steps in order to configure Omni-Channel queue- and skill-based routing."
      padding="none"
    >
      <ol className="qrs-list">
        <li className="qrs-step" key={gateStep.title}>
          <span className="qrs-step__num">1</span>
          <div className="qrs-step__body">
            <span className="qrs-step__title">{gateStep.title}</span>
            <span className="qrs-step__desc">{gateStep.description}</span>
          </div>
          <Toggle
            className="qrs-step__action"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            aria-label="Enable Omni-Channel & Skill-Based Routing"
          />
        </li>
        {enabled &&
          restSteps.map((step, i) => (
            <li className="qrs-step" key={step.title}>
              <span className="qrs-step__num">{i + 2}</span>
              <div className="qrs-step__body">
                <span className="qrs-step__title">{step.title}</span>
                <span className="qrs-step__desc">{step.description}</span>
              </div>
              <Button
                variant="neutral"
                size="sm"
                className="qrs-step__action"
                iconTrailing={<Icon name={step.nav ? 'chevron-right' : 'external-link'} size={12} />}
                onClick={() =>
                  step.nav
                    ? navigateHub(step.nav.cat, step.nav.sub)
                    : setTarget({ title: step.title, setupSection: step.setupSection })
                }
              >
                {step.nav ? 'Go to Section' : 'Go to Setup'}
              </Button>
            </li>
          ))}
      </ol>

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        size="sm"
        title="Go to Setup"
        footer={
          <Button variant="brand" onClick={() => setTarget(null)}>
            Got it
          </Button>
        }
      >
        <p style={{ margin: 0, color: 'var(--slds-g-color-on-surface-1)' }}>
          This will take you to <strong>{target?.setupSection}</strong> to configure{' '}
          <strong>{target?.title}</strong>.
        </p>
      </Modal>
    </Card>
  );
}

/**
 * Routing Rules — General Setup → Assignment And Routing → Routing Rules.
 * Rule-based routing (mirrors Skill Mapping): each rule ANDs a set of
 * Submission-field conditions and, when they match, routes the submission to a
 * queue. A default queue (mirroring the Doc Summary Prompt default template)
 * catches submissions that match no rule.
 */
function RoutingRulesSection() {
  const { config, update } = useConfig();
  const rules = config.routingRules ?? [];
  const fields = config.fields ?? [];

  // Curated catalog + user-created queues, de-duped case-insensitively.
  const queues = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const q of [...ROUTING_QUEUES, ...(config.routingQueues ?? [])]) {
      const key = q.trim().toLowerCase();
      if (!q.trim() || seen.has(key)) continue;
      seen.add(key);
      out.push(q);
    }
    return out;
  }, [config.routingQueues]);

  /** Persist a newly-created queue name (if not already known). */
  const createQueue = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (queues.some((q) => q.toLowerCase() === trimmed.toLowerCase())) return;
    update((p) => ({
      ...p,
      routingQueues: [...(p.routingQueues ?? []), trimmed],
    }));
  };

  const [modal, setModal] = useState<{ open: boolean; editingId: number | null }>({
    open: false,
    editingId: null,
  });
  const [queuePage, setQueuePage] = useState<string | null>(null);

  const fieldLabel = (api: string) => fields.find((f) => f.api === api)?.label ?? api;

  const onSave = (id: number | null, draft: Omit<RoutingRule, 'id'>) => {
    if (id == null) {
      update((p) => {
        const newId = p.nextRoutingRuleId ?? 1;
        return {
          ...p,
          routingRules: [...(p.routingRules ?? []), { id: newId, ...draft }],
          nextRoutingRuleId: newId + 1,
        };
      });
    } else {
      update((p) => ({
        ...p,
        routingRules: (p.routingRules ?? []).map((r) =>
          r.id === id ? { ...r, ...draft } : r,
        ),
      }));
    }
    setModal({ open: false, editingId: null });
  };

  const onDelete = (r: RoutingRule) => {
    if (!confirm('Delete this routing rule?')) return;
    update((p) => ({
      ...p,
      routingRules: (p.routingRules ?? []).filter((x) => x.id !== r.id),
    }));
  };

  const editing =
    modal.editingId != null
      ? rules.find((r) => r.id === modal.editingId) ?? null
      : null;

  const defaultQueue = config.routingDefaultQueue ?? '';
  const [editingDefault, setEditingDefault] = useState(false);
  const setDefaultQueue = (queue: string) =>
    update((p) => ({ ...p, routingDefaultQueue: queue }));

  return (
    <Card
      className="dc-taxonomy-card"
      title={<span className="dc-taxonomy-title">Routing Rules</span>}
      subtitle="Route submissions to a queue using field-based rules. When a submission matches a rule's conditions, it is routed to the mapped queue."
      padding="none"
    >
      <div style={{ padding: 'var(--slds-g-spacing-4)' }}>
        <div className="dc-threshold dsp-default" style={{ marginBottom: 'var(--slds-g-spacing-4)' }}>
          <div className="dc-threshold__label">Default Queue</div>
          {editingDefault ? (
            <div className="dc-threshold__edit-row">
              <div className="dsp-default__lookup">
                <QueueLookup
                  value={defaultQueue}
                  queues={queues}
                  onChange={(v) => {
                    setDefaultQueue(v);
                    setEditingDefault(false);
                  }}
                  onCreateQueue={createQueue}
                  onCancel={() => setEditingDefault(false)}
                />
              </div>
            </div>
          ) : (
            <div className="dc-threshold__edit-row">
              <span className="dc-threshold__value">
                {defaultQueue || <span className="dsp-cell__placeholder">Not set</span>}
              </span>
              <button
                type="button"
                className="dc-inline-edit"
                onClick={() => setEditingDefault(true)}
                aria-label="Edit Default Queue"
                title="Edit"
              >
                <Icon name="edit" size={14} />
              </button>
            </div>
          )}
          <p className="dc-threshold__hint">
            Submissions that don't match any routing rule are sent to this queue.
          </p>
        </div>

        <div className="lse-rules">
          <div className="lse-rules__head">
            <button
              type="button"
              className="lob-activities__new-btn"
              onClick={() => setModal({ open: true, editingId: null })}
            >
              <Icon name="plus" size={12} />
              Add Routing Rule
            </button>
          </div>

          {rules.length === 0 ? (
            <div className="lse-rules__empty">
              No routing rules yet. Click <strong>Add Routing Rule</strong> to add one.
            </div>
          ) : (
            <div className="lse-tr-group">
              <table className="lse-tr-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>#</th>
                    <th>Conditions</th>
                    <th style={{ width: 220 }}>Route To Queue</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r, idx) => {
                    const conditions = (r.conditions ?? []).filter((c) => c.field);
                    return (
                      <tr key={r.id}>
                        <td className="lse-tr-table__num">{idx + 1}</td>
                        <td>
                          {conditions.length === 0 ? (
                            <span className="lse-tr-table__empty">
                              No conditions defined
                            </span>
                          ) : (
                            <div className="lse-tr-conditions">
                              {conditions.map((c, i) => {
                                const noVal = ROUTING_RULE_NO_VALUE_OPS.has(
                                  c.operator ?? '',
                                );
                                return (
                                  <div key={i} className="lse-tr-conditions__line">
                                    <span className="lse-tr-conditions__num">
                                      {i + 1}.
                                    </span>{' '}
                                    <strong>{fieldLabel(c.field)}</strong>{' '}
                                    {c.operator ?? 'equals'}
                                    {!noVal && <strong> {c.value ?? ''}</strong>}
                                  </div>
                                );
                              })}
                              {r.expression && (
                                <div className="lse-tr-conditions__expr">
                                  Logic: {r.expression}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          {r.queue ? (
                            <div className="lse-tr-conditions__line">
                              <a
                                href="#"
                                className="lse-tr-table__link"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setQueuePage(r.queue);
                                }}
                              >
                                {r.queue}
                              </a>
                            </div>
                          ) : (
                            <span className="lse-tr-table__empty">No queue set</span>
                          )}
                        </td>
                        <td className="lse-tr-table__actions">
                          <div className="lse-tr-table__actions-inner">
                            <Button
                              variant="icon"
                              aria-label="Edit routing rule"
                              onClick={() => setModal({ open: true, editingId: r.id })}
                            >
                              <Icon name="edit" size={14} />
                            </Button>
                            <Button
                              variant="icon"
                              aria-label="Delete routing rule"
                              onClick={() => onDelete(r)}
                            >
                              <Icon name="trash" size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <RoutingRuleModal
        open={modal.open}
        editing={editing}
        fields={fields}
        queues={queues}
        onCreateQueue={createQueue}
        onCancel={() => setModal({ open: false, editingId: null })}
        onSave={(draft) => onSave(modal.editingId, draft)}
      />

      <Modal
        open={queuePage != null}
        onClose={() => setQueuePage(null)}
        size="sm"
        title="Open Queue"
        footer={
          <>
            <Button variant="neutral" onClick={() => setQueuePage(null)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={() => setQueuePage(null)}>
              Open Queue Page
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, color: 'var(--slds-g-color-on-surface-1)' }}>
          This will open the setup page for the <strong>{queuePage}</strong> queue.
        </p>
      </Modal>
    </Card>
  );
}

function RoutingRuleModal({
  open,
  editing,
  fields,
  queues,
  onCreateQueue,
  onCancel,
  onSave,
}: {
  open: boolean;
  editing: RoutingRule | null;
  fields: Field[];
  queues: string[];
  onCreateQueue: (name: string) => void;
  onCancel: () => void;
  onSave: (draft: Omit<RoutingRule, 'id'>) => void;
}) {
  const [conditions, setConditions] = useState<RoutingRuleCondition[]>([]);
  const [expression, setExpression] = useState('');
  const [queue, setQueue] = useState('');
  const [editingQueue, setEditingQueue] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConditions(
      editing?.conditions ? JSON.parse(JSON.stringify(editing.conditions)) : [],
    );
    setExpression(editing?.expression ?? '');
    setQueue(editing?.queue ?? '');
    setEditingQueue(false);
  }, [open, editing]);

  const addCondition = () =>
    setConditions((prev) => [
      ...prev,
      { field: fields[0]?.api ?? '', operator: 'equals', value: '' },
    ]);
  const updateCondition = (i: number, patch: Partial<RoutingRuleCondition>) =>
    setConditions((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeCondition = (i: number) =>
    setConditions((prev) => prev.filter((_, idx) => idx !== i));

  const valid = queue.trim().length > 0;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={editing ? 'Edit Routing Rule' : 'New Routing Rule'}
      size="lg"
      footer={
        <>
          <Button variant="neutral" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="brand"
            disabled={!valid}
            onClick={() => onSave({ conditions, expression, queue: queue.trim() })}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="lse-tr-modal">
        <div className="lse-tr-modal__divider" style={{ borderTop: 0, paddingTop: 0, marginTop: 0 }}>
          Rules
        </div>
        <p style={{ margin: 0, fontSize: 'var(--slds-g-font-scale-neg-1)', color: 'var(--slds-g-color-on-surface-1)' }}>
          The submission is routed when it matches all of the conditions below.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '120px minmax(0, 1fr)',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <span className="lse-tr-modal__label" style={{ marginBottom: 0 }}>
            Filter Logic
          </span>
          <Input
            aria-label="Filter Logic"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="e.g. (1 AND 2) OR 3"
            hint="Use row numbers, AND, OR, parentheses. Leave blank to AND all conditions."
            fullWidth
          />
        </div>

        <div className="lse-tr-modal__conds">
          {conditions.length === 0 ? (
            <div className="lse-tr-modal__empty">No conditions yet.</div>
          ) : (
            conditions.map((c, i) => {
              const noVal = ROUTING_RULE_NO_VALUE_OPS.has(c.operator);
              return (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '28px minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1.2fr) auto',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <span className="lse-tr-modal__cond-num">{i + 1}</span>
                  <Dropdown
                    aria-label="Field"
                    value={c.field}
                    onChange={(v) => updateCondition(i, { field: v })}
                    placeholder="Select field"
                    fullWidth
                    options={fields.map((f) => ({ value: f.api, label: f.label }))}
                  />
                  <Dropdown
                    aria-label="Operator"
                    value={c.operator}
                    onChange={(v) => updateCondition(i, { operator: v })}
                    fullWidth
                    options={ROUTING_RULE_OPERATORS.map((o) => ({ value: o, label: o }))}
                  />
                  {noVal ? (
                    <span className="lse-tr-modal__cond-spacer" />
                  ) : (
                    <Input
                      aria-label="Value"
                      value={c.value}
                      onChange={(e) => updateCondition(i, { value: e.target.value })}
                      placeholder="Value"
                    />
                  )}
                  <Button
                    variant="icon"
                    aria-label="Remove condition"
                    onClick={() => removeCondition(i)}
                  >
                    <Icon name="trash" size={14} />
                  </Button>
                </div>
              );
            })
          )}
          <div>
            <button
              type="button"
              className="lob-activities__new-btn"
              onClick={addCondition}
              disabled={fields.length === 0}
            >
              <Icon name="plus" size={12} />
              Add Condition
            </button>
          </div>
        </div>

        <div className="lse-tr-modal__divider">Route To Queue</div>
        <div className="lse-tr-modal__label">Queue</div>
        {editingQueue ? (
          <QueueLookup
            value={queue}
            queues={queues}
            onChange={(v) => {
              setQueue(v);
              setEditingQueue(false);
            }}
            onCreateQueue={onCreateQueue}
            onCancel={() => setEditingQueue(false)}
          />
        ) : (
          <div className="dc-threshold__edit-row">
            <span className="dc-threshold__value">
              {queue || <span className="dsp-cell__placeholder">Not set</span>}
            </span>
            <button
              type="button"
              className="dc-inline-edit"
              onClick={() => setEditingQueue(true)}
              aria-label="Select Queue"
              title="Edit"
            >
              <Icon name="edit" size={14} />
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

/**
 * Salesforce-style inline lookup for a queue. Mirrors the Doc Summary Prompt
 * `PromptTemplateLookup`: a search input + a portalled menu that filters the
 * catalog as you type, offers a "Clear selection" row, and a pinned "New
 * Queue" create action that persists the new name and auto-selects it.
 */
function QueueLookup({
  value,
  queues,
  onChange,
  onCreateQueue,
  onCancel,
}: {
  value: string;
  queues: string[];
  onChange: (v: string) => void;
  onCreateQueue: (name: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return queues;
    return queues.filter((t) => t.toLowerCase().includes(q));
  }, [queues, query]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const place = () => {
      const t = inputRef.current;
      if (!t) return;
      const r = t.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, []);

  useEffect(() => {
    // While the create modal is open, the modal owns clicks/Escape.
    if (creating) return;
    const onDocClick = (ev: MouseEvent) => {
      const target = ev.target as Node;
      const inRoot = rootRef.current?.contains(target) ?? false;
      const inMenu = menuRef.current?.contains(target) ?? false;
      if (!inRoot && !inMenu) onCancel();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onCancel();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onCancel, creating]);

  const onCreated = (name: string) => {
    onCreateQueue(name);
    setCreating(false);
    onChange(name.trim());
  };

  return (
    <div className="slds2-dropdown slds2-dropdown--full" ref={rootRef} style={{ width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <span
          style={{
            position: 'absolute',
            top: '50%',
            left: 10,
            transform: 'translateY(-50%)',
            display: 'flex',
            color: 'var(--slds-g-color-on-surface-2)',
            pointerEvents: 'none',
          }}
        >
          <Icon name="search" size={14} />
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={value || 'Search Queues…'}
          aria-label="Search queues"
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: '100%',
            minHeight: 32,
            padding: '6px 10px 6px 32px',
            fontFamily: 'var(--slds-g-font-family-base)',
            fontSize: 'var(--slds-g-font-scale-neg-1)',
            color: 'var(--slds-g-color-on-surface-1)',
            background: 'var(--slds-g-color-surface-1)',
            border: '1px solid var(--slds-g-color-accent-1)',
            borderRadius: 'var(--slds-g-radius-border-2)',
            outline: 'none',
          }}
        />
      </div>
      {rect &&
        createPortal(
          <div
            className="slds2-dropdown__menu"
            role="listbox"
            ref={menuRef}
            style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width }}
          >
            {value && (
              <div
                className="slds2-dropdown__option"
                role="option"
                aria-selected={false}
                onClick={() => onChange('')}
                style={{ color: 'var(--slds-g-color-on-surface-2)' }}
              >
                <span
                  className="slds2-dropdown__option-label"
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Icon name="close" size={13} />
                  Clear selection
                </span>
              </div>
            )}
            {matches.length === 0 ? (
              <div
                style={{
                  padding: '8px 10px',
                  fontSize: 'var(--slds-g-font-scale-neg-1)',
                  color: 'var(--slds-g-color-on-surface-3)',
                }}
              >
                No matching queues.
              </div>
            ) : (
              matches.map((t) => {
                const selected = t === value;
                return (
                  <div
                    key={t}
                    role="option"
                    aria-selected={selected}
                    className="slds2-dropdown__option"
                    onClick={() => onChange(t)}
                  >
                    <span
                      className="slds2-dropdown__option-label"
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <Icon name="users" size={13} />
                      {t}
                    </span>
                    {selected && <Icon name="check" size={13} />}
                  </div>
                );
              })
            )}
            <div
              className="slds2-dropdown__option"
              role="option"
              aria-selected={false}
              onClick={() => setCreating(true)}
              style={{
                borderTop: '1px solid var(--slds-g-color-border-1)',
                color: 'var(--slds-g-color-accent-1)',
              }}
            >
              <span
                className="slds2-dropdown__option-label"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: 'var(--slds-g-color-accent-1)',
                  fontWeight: 'var(--slds-g-font-weight-6)',
                }}
              >
                <Icon name="plus" size={13} />
                New Queue
              </span>
            </div>
          </div>,
          document.body,
        )}
      {creating && (
        <NewQueueModal
          onCancel={() => setCreating(false)}
          onSave={onCreated}
          existing={queues}
        />
      )}
    </div>
  );
}

/** Create-a-queue modal launched from the lookup's "New Queue" action. On save
 * it persists the name and auto-selects it — the standard Salesforce lookup
 * create flow. */
function NewQueueModal({
  onCancel,
  onSave,
  existing,
}: {
  onCancel: () => void;
  onSave: (name: string) => void;
  existing: string[];
}) {
  const [name, setName] = useState('');
  const trimmed = name.trim();
  const collides = existing.some((t) => t.toLowerCase() === trimmed.toLowerCase());
  const valid = trimmed.length > 0 && !collides;
  return (
    <Modal
      open
      onClose={onCancel}
      size="sm"
      title="New Queue"
      footer={
        <>
          <Button variant="neutral" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="brand" disabled={!valid} onClick={() => valid && onSave(trimmed)}>
            Save
          </Button>
        </>
      }
    >
      <Input
        label="Queue Name"
        required
        autoFocus
        value={name}
        placeholder="e.g. Excess & Surplus Underwriting"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && valid) onSave(trimmed);
        }}
        error={collides ? 'A queue with this name already exists.' : undefined}
      />
      <p
        style={{
          margin: '8px 0 0',
          fontSize: 'var(--slds-g-font-scale-neg-1)',
          color: 'var(--slds-g-color-on-surface-1)',
        }}
      >
        The new queue will be created and selected for this rule.
      </p>
    </Modal>
  );
}

/**
 * Underwriters — a standard Salesforce table of underwriters with full CRUD.
 * Each underwriter maps to a platform user (lookup) and carries the authority,
 * expertise (LOBs), and capacity fields used when routing submissions.
 */
function UnderwritersSection() {
  const { config, update } = useConfig();
  const underwriters = config.underwriters ?? [];
  const lobs = useMemo(
    () =>
      config.fields?.find((f) => f.api === 'Line_of_Business__c')?.picklistValues ??
      [],
    [config.fields],
  );

  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Underwriter | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return underwriters;
    return underwriters.filter(
      (u) =>
        u.user.toLowerCase().includes(q) ||
        u.authority.toLowerCase().includes(q) ||
        u.expertise.some((e) => e.toLowerCase().includes(q)),
    );
  }, [underwriters, query]);

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (u: Underwriter) => {
    setEditing(u);
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const onSave = (draft: Omit<Underwriter, 'id'>) => {
    if (editing) {
      const id = editing.id;
      update((prev) => ({
        ...prev,
        underwriters: (prev.underwriters ?? []).map((u) =>
          u.id === id ? { ...u, ...draft } : u,
        ),
      }));
    } else {
      update((prev) => {
        const id = prev.nextUnderwriterId ?? 1;
        return {
          ...prev,
          underwriters: [...(prev.underwriters ?? []), { id, ...draft }],
          nextUnderwriterId: id + 1,
        };
      });
    }
    closeModal();
  };

  const onDelete = (u: Underwriter) => {
    if (!confirm(`Delete underwriter "${u.user || 'Untitled'}"?`)) return;
    update((prev) => ({
      ...prev,
      underwriters: (prev.underwriters ?? []).filter((x) => x.id !== u.id),
    }));
  };

  const columns = [
    {
      key: 'user',
      header: 'User',
      render: (u: Underwriter) => (
        <a
          onClick={(e) => {
            e.preventDefault();
            openEdit(u);
          }}
          href="#"
          style={{ color: 'var(--slds-g-color-accent-1)', cursor: 'pointer' }}
        >
          {u.user || '—'}
        </a>
      ),
    },
    {
      key: 'maxTiv',
      header: 'Max TIV',
      render: (u: Underwriter) => u.maxTiv || '—',
    },
    {
      key: 'authority',
      header: 'Authority',
      width: '130px',
      render: (u: Underwriter) =>
        u.authority ? <Badge tone="info">{u.authority}</Badge> : '—',
    },
    {
      key: 'expertise',
      header: 'Expertise',
      render: (u: Underwriter) =>
        u.expertise.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {u.expertise.map((e) => (
              <Badge key={e}>{e}</Badge>
            ))}
          </div>
        ) : (
          '—'
        ),
    },
    {
      key: 'capacityThreshold',
      header: 'Capacity Threshold',
      render: (u: Underwriter) => u.capacityThreshold || '—',
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '90px',
      align: 'right' as const,
      render: (u: Underwriter) => (
        <Button variant="icon" aria-label="Delete underwriter" onClick={() => onDelete(u)}>
          <Icon name="trash" />
        </Button>
      ),
    },
  ];

  return (
    <Card
      className="uw-card"
      title="Underwriters"
      subtitle={`${underwriters.length} defined`}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--slds-g-spacing-2)' }}>
          <div style={{ width: 220 }}>
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search underwriters…"
              aria-label="Search underwriters"
              iconLeading={<Icon name="search" size={14} />}
            />
          </div>
          <Button variant="brand" iconLeading={<Icon name="plus" size={14} />} onClick={openNew}>
            New Underwriter
          </Button>
        </div>
      }
      padding="none"
    >
      <Table<Underwriter>
        columns={columns}
        rows={filtered}
        rowKey={(u) => u.id}
        empty={
          query
            ? 'No underwriters match your search.'
            : 'No underwriters yet. Click New Underwriter to add one.'
        }
      />
      <UnderwriterModal
        open={modalOpen}
        editing={editing}
        lobs={lobs}
        onClose={closeModal}
        onSave={onSave}
      />
    </Card>
  );
}

function UnderwriterModal({
  open,
  editing,
  lobs,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: Underwriter | null;
  lobs: string[];
  onClose: () => void;
  onSave: (draft: Omit<Underwriter, 'id'>) => void;
}) {
  const [user, setUser] = useState('');
  const [maxTiv, setMaxTiv] = useState('');
  const [authority, setAuthority] = useState<UnderwriterAuthority | ''>('');
  const [expertise, setExpertise] = useState<string[]>([]);
  const [capacityThreshold, setCapacityThreshold] = useState('');

  useEffect(() => {
    if (!open) return;
    setUser(editing?.user ?? '');
    setMaxTiv(editing?.maxTiv ?? '');
    setAuthority(editing?.authority ?? '');
    setExpertise(editing?.expertise ?? []);
    setCapacityThreshold(editing?.capacityThreshold ?? '');
  }, [open, editing]);

  const toggleExpertise = (lob: string) =>
    setExpertise((prev) =>
      prev.includes(lob) ? prev.filter((x) => x !== lob) : [...prev, lob],
    );

  const canSave = user.trim().length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Underwriter' : 'New Underwriter'}
      size="sm"
      footer={
        <>
          <Button variant="neutral" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="brand"
            disabled={!canSave}
            onClick={() =>
              onSave({
                user: user.trim(),
                maxTiv: maxTiv.trim(),
                authority,
                expertise,
                capacityThreshold: capacityThreshold.trim(),
              })
            }
          >
            Save
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--slds-g-spacing-4)' }}>
        <Input
          label="User"
          required
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder="Search users…"
          iconLeading={<Icon name="search" size={14} />}
        />
        <Input
          label="Max TIV"
          value={maxTiv}
          onChange={(e) => setMaxTiv(e.target.value)}
          placeholder="e.g. $50,000,000"
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label
            style={{
              fontSize: 'var(--slds-g-font-scale-neg-1)',
              fontWeight: 'var(--slds-g-font-weight-6)',
              color: 'var(--slds-g-color-on-surface-2)',
            }}
          >
            Authority
          </label>
          <Dropdown
            value={authority}
            onChange={(v) => setAuthority(v as UnderwriterAuthority | '')}
            placeholder="Select authority…"
            aria-label="Authority"
            options={UNDERWRITER_AUTHORITIES.map((a) => ({ value: a, label: a }))}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            style={{
              fontSize: 'var(--slds-g-font-scale-neg-1)',
              fontWeight: 'var(--slds-g-font-weight-6)',
              color: 'var(--slds-g-color-on-surface-2)',
            }}
          >
            Expertise
          </label>
          {lobs.length === 0 ? (
            <p
              style={{
                margin: 0,
                fontSize: 'var(--slds-g-font-scale-neg-1)',
                color: 'var(--slds-g-color-on-surface-1)',
              }}
            >
              No lines of business defined yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lobs.map((lob) => (
                <Checkbox
                  key={lob}
                  label={lob}
                  checked={expertise.includes(lob)}
                  onChange={() => toggleExpertise(lob)}
                />
              ))}
            </div>
          )}
        </div>
        <Input
          label="Capacity Threshold"
          type="number"
          min={0}
          step={1}
          value={capacityThreshold}
          onChange={(e) => setCapacityThreshold(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="e.g. 25"
        />
      </div>
    </Modal>
  );
}

/**
 * Underwriting Landing — a persona master list on the left; Run My Day and
 * List Report are configured per persona in the two tabs on the right.
 */
function UnderwritingLandingTabs() {
  const { config, update } = useConfig();
  const personas = config.personas ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(
    personas[0]?.id ?? null,
  );
  const [tab, setTab] = useState<'run-my-day' | 'list-report'>('run-my-day');
  const [addOpen, setAddOpen] = useState(false);

  const selected =
    personas.find((p) => p.id === selectedId) ?? personas[0] ?? null;

  const onCreate = (name: string, role: UnderwriterRole | '') => {
    update((prev) => {
      const id = prev.nextPersonaId ?? 1;
      const persona: Persona = { id, name, role };
      setSelectedId(id);
      return {
        ...prev,
        personas: [...(prev.personas ?? []), persona],
        nextPersonaId: id + 1,
      };
    });
    setAddOpen(false);
  };

  return (
    <div style={{ display: 'flex', gap: 'var(--slds-g-spacing-4)', minHeight: 320 }}>
      <div
        style={{
          flex: '0 0 220px',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--slds-g-spacing-2)',
          borderRight: '1px solid var(--slds-g-color-border-1)',
          paddingRight: 'var(--slds-g-spacing-4)',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 'var(--slds-g-font-scale-neg-1)',
            fontWeight: 'var(--slds-g-font-weight-6)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--slds-g-color-on-surface-1)',
          }}
        >
          Personas
        </h3>
        {personas.length === 0 ? (
          <p
            style={{
              margin: 0,
              fontSize: 'var(--slds-g-font-scale-neg-1)',
              color: 'var(--slds-g-color-on-surface-1)',
            }}
          >
            No personas yet.
          </p>
        ) : (
          personas.map((p) => {
            const active = selected?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                className={`tph__md-master-item${active ? ' tph__md-master-item--selected' : ''}`}
                onClick={() => setSelectedId(p.id)}
              >
                <span className="tph__md-master-item-label">{p.name}</span>
                {p.role && (
                  <span className="tph__md-master-item-desc">{p.role}</span>
                )}
              </button>
            );
          })
        )}
        <button
          type="button"
          className="lob-activities__new-btn"
          style={{ alignSelf: 'flex-start', marginTop: 'var(--slds-g-spacing-1)' }}
          onClick={() => setAddOpen(true)}
        >
          <Icon name="plus" size={14} />
          Add Persona
        </button>
      </div>

      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        {selected ? (
          <>
            <Tabs
              items={[
                { id: 'run-my-day', label: 'Run My Day' },
                { id: 'list-report', label: 'List Report' },
              ]}
              active={tab}
              onChange={(id) => setTab(id as 'run-my-day' | 'list-report')}
            />
            <div style={{ paddingTop: 'var(--slds-g-spacing-4)' }}>
              {tab === 'run-my-day' ? (
                <RunMyDayLayout persona={selected} />
              ) : (
                <ListReportLayout persona={selected} />
              )}
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--slds-g-color-on-surface-1)' }}>
            Add a persona to configure its Run My Day and List Report.
          </div>
        )}
      </div>

      <PersonaModal open={addOpen} onClose={() => setAddOpen(false)} onCreate={onCreate} />
    </div>
  );
}

const MAX_KPIS = 5;

/**
 * Per-persona Run My Day layout: selects one of the globally-defined Run My Day
 * playbooks. (KPI cards now live under the List Report tab.)
 */
function RunMyDayLayout({ persona }: { persona: Persona }) {
  const { config, update } = useConfig();
  const [pbWizardOpen, setPbWizardOpen] = useState(false);
  const [pbWizardEditingId, setPbWizardEditingId] = useState<number | null>(null);
  // Id the wizard will assign to a playbook it creates, so we can auto-select
  // it once the wizard closes.
  const pendingNewPlaybookId = useRef<number | null>(null);

  const playbooks = config.playbooks ?? [];
  const selectedPlaybook =
    persona.playbookId != null
      ? playbooks.find((p) => p.id === persona.playbookId) ?? null
      : null;

  const patchPersona = (patch: (p: Persona) => Persona) =>
    update((prev) => ({
      ...prev,
      personas: (prev.personas ?? []).map((p) =>
        p.id === persona.id ? patch(p) : p,
      ),
    }));

  const onSelectPlaybook = (value: string) =>
    patchPersona((p) => ({ ...p, playbookId: value ? Number(value) : null }));

  const openEditWizard = () => {
    if (!selectedPlaybook) return;
    setPbWizardEditingId(selectedPlaybook.id);
    setPbWizardOpen(true);
  };

  const openCreateWizard = () => {
    pendingNewPlaybookId.current = config.nextPlaybookId;
    setPbWizardEditingId(null);
    setPbWizardOpen(true);
  };

  const closeWizard = () => setPbWizardOpen(false);

  // When the create-wizard actually saves, the new playbook shows up in config
  // (the wizard's update() lands on a later render than its onClose). Adopt it
  // for this persona as soon as it appears. If the user cancels, the id never
  // materializes and nothing is adopted.
  useEffect(() => {
    const created = pendingNewPlaybookId.current;
    if (created == null) return;
    if ((config.playbooks ?? []).some((p) => p.id === created)) {
      pendingNewPlaybookId.current = null;
      patchPersona((p) => ({ ...p, playbookId: created }));
    }
  }, [config.playbooks]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--slds-g-spacing-6)' }}>
      <section>
        <SectionHeading
          title="Playbook"
          sub="Select a playbook defined in the global Run My Day."
        />
        <div
          style={{
            marginTop: 'var(--slds-g-spacing-3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--slds-g-spacing-3)',
          }}
        >
          <div style={{ maxWidth: 360 }}>
            <PlaybookLookup
              playbooks={playbooks}
              value={persona.playbookId ?? null}
              onChange={(id) => onSelectPlaybook(id != null ? String(id) : '')}
              onCreateNew={openCreateWizard}
            />
          </div>
          {selectedPlaybook && (
            <div
              className="act-tile act-tile--compact lob-stage-tile"
              role="button"
              tabIndex={0}
              style={{ cursor: 'pointer' }}
              onClick={openEditWizard}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openEditWizard();
                }
              }}
            >
              <div className="act-tile__actions">
                <div className="lob-stage-tile__actions">
                  <Badge tone="info">
                    <Icon name="users" size={12} />
                    <span style={{ marginLeft: 4 }}>
                      {selectedPlaybook.role || 'Any role'}
                    </span>
                  </Badge>
                  {selectedPlaybook.active ? (
                    <Badge tone="success">Active</Badge>
                  ) : (
                    <Badge>Inactive</Badge>
                  )}
                </div>
              </div>
              <div className="act-tile__name">
                <span className="act-tile__name-text">
                  {selectedPlaybook.name || 'Untitled playbook'}
                </span>
              </div>
              <div className="lob-stage-tile__sub">
                {selectedPlaybook.groups.length} Group
                {selectedPlaybook.groups.length === 1 ? '' : 's'} ·{' '}
                {selectedPlaybook.groups.reduce((s, g) => s + g.insights.length, 0)} Insight
                {selectedPlaybook.groups.reduce((s, g) => s + g.insights.length, 0) === 1
                  ? ''
                  : 's'}
              </div>
            </div>
          )}
        </div>
      </section>

      <PlaybookWizard
        open={pbWizardOpen}
        editingId={pbWizardEditingId}
        onClose={closeWizard}
      />
    </div>
  );
}

/**
 * Per-persona List Report layout: the KPI cards (up to 5) moved out of Run My
 * Day, followed by a Submission table whose columns are chosen and ordered via
 * a dueling picklist over the Submission object's fields.
 */
function ListReportLayout({ persona }: { persona: Persona }) {
  const { config, update } = useConfig();
  const [kpiOpen, setKpiOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<PersonaKpi | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);

  const kpis = persona.kpis ?? [];
  const atLimit = kpis.length >= MAX_KPIS;
  const fields = config.fields ?? [];
  const columns = persona.listReportColumns ?? [];

  const patchPersona = (patch: (p: Persona) => Persona) =>
    update((prev) => ({
      ...prev,
      personas: (prev.personas ?? []).map((p) =>
        p.id === persona.id ? patch(p) : p,
      ),
    }));

  const openNewKpi = () => {
    setEditingKpi(null);
    setKpiOpen(true);
  };
  const openEditKpi = (kpi: PersonaKpi) => {
    setEditingKpi(kpi);
    setKpiOpen(true);
  };
  const closeKpiModal = () => {
    setKpiOpen(false);
    setEditingKpi(null);
  };

  const onSaveKpi = (values: Omit<PersonaKpi, 'id'>) => {
    if (editingKpi) {
      const id = editingKpi.id;
      patchPersona((p) => ({
        ...p,
        kpis: (p.kpis ?? []).map((k) =>
          k.id === id ? { ...k, ...values } : k,
        ),
      }));
    } else {
      patchPersona((p) => {
        const nextKpiId = p.nextKpiId ?? 1;
        const kpi: PersonaKpi = { id: nextKpiId, ...values };
        return {
          ...p,
          kpis: [...(p.kpis ?? []), kpi],
          nextKpiId: nextKpiId + 1,
        };
      });
    }
    closeKpiModal();
  };

  const onDeleteKpi = (id: number) =>
    patchPersona((p) => ({ ...p, kpis: (p.kpis ?? []).filter((k) => k.id !== id) }));

  const setColumns = (next: string[]) =>
    patchPersona((p) => ({ ...p, listReportColumns: next }));

  const columnOptions = useMemo(
    () => fields.map((f) => ({ value: f.api, label: f.label || f.api })),
    [fields],
  );
  const selectedFields = useMemo(
    () =>
      columns
        .map((api) => fields.find((f) => f.api === api))
        .filter((f): f is (typeof fields)[number] => !!f),
    [columns, fields],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--slds-g-spacing-6)' }}>
      <section>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 'var(--slds-g-spacing-3)',
          }}
        >
          <SectionHeading
            title="Key Performance Indicators"
            sub={`${kpis.length} of ${MAX_KPIS} cards`}
          />
          <button
            type="button"
            className="lob-activities__new-btn"
            onClick={openNewKpi}
            disabled={atLimit}
            title={atLimit ? `Maximum of ${MAX_KPIS} KPI cards reached` : undefined}
            style={atLimit ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          >
            <Icon name="plus" size={14} />
            New KPI
          </button>
        </div>
        {kpis.length === 0 ? (
          <div
            style={{
              border: '1px dashed var(--slds-g-color-border-1)',
              borderRadius: 'var(--slds-g-radius-border-2)',
              padding: '32px 20px',
              textAlign: 'center',
              color: 'var(--slds-g-color-on-surface-1)',
            }}
          >
            No KPI cards yet. Click New KPI to add one (up to {MAX_KPIS}).
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 'var(--slds-g-spacing-3)',
            }}
          >
            {kpis.map((k) => (
              <div
                key={k.id}
                role="button"
                tabIndex={0}
                onClick={() => openEditKpi(k)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openEditKpi(k);
                  }
                }}
                style={{
                  position: 'relative',
                  border: '1px solid var(--slds-g-color-border-1)',
                  borderRadius: 'var(--slds-g-radius-border-3)',
                  background: 'var(--slds-g-color-surface-1)',
                  padding: 'var(--slds-g-spacing-4)',
                  cursor: 'pointer',
                }}
              >
                <button
                  type="button"
                  className="tph__col-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteKpi(k.id);
                  }}
                  aria-label={`Delete ${k.name}`}
                  title="Delete KPI"
                  style={{ position: 'absolute', top: 6, right: 6 }}
                >
                  <Icon name="trash" size={12} />
                </button>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 4,
                    paddingRight: 20,
                  }}
                >
                  <Badge tone={(k.status ?? 'Draft') === 'Active' ? 'success' : 'neutral'}>
                    {k.status ?? 'Draft'}
                  </Badge>
                  {k.category && (
                    <span
                      style={{
                        fontSize: 'var(--slds-g-font-scale-neg-2)',
                        color: 'var(--slds-g-color-on-surface-2)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {k.category}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 'var(--slds-g-font-scale-2)',
                    fontWeight: 'var(--slds-g-font-weight-6)',
                    color: 'var(--slds-g-color-on-surface-3)',
                    marginBottom: 4,
                  }}
                >
                  {k.name}
                </div>
                {k.description && (
                  <div
                    style={{
                      fontSize: 'var(--slds-g-font-scale-neg-1)',
                      color: 'var(--slds-g-color-on-surface-1)',
                      lineHeight: 1.4,
                    }}
                  >
                    {k.description}
                  </div>
                )}
                {(k.formula || k.source) && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 'var(--slds-g-font-scale-neg-2)',
                      fontFamily: k.formula ? 'var(--slds-g-font-family-monospace)' : undefined,
                      color: 'var(--slds-g-color-on-surface-2)',
                    }}
                  >
                    {k.formula || k.source}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 'var(--slds-g-spacing-3)',
          }}
        >
          <SectionHeading
            title="Submission List"
            sub="The Submission columns shown in this persona's list report."
          />
          <button
            type="button"
            className="dc-inline-edit"
            onClick={() => setColumnsOpen(true)}
            disabled={fields.length === 0}
            aria-label="Select and order columns"
            title="Select columns"
            style={fields.length === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          >
            <Icon name="settings" size={16} />
          </button>
        </div>

        {fields.length === 0 ? (
          <div
            style={{
              border: '1px dashed var(--slds-g-color-border-1)',
              borderRadius: 'var(--slds-g-radius-border-2)',
              padding: '24px 20px',
              textAlign: 'center',
              color: 'var(--slds-g-color-on-surface-1)',
            }}
          >
            No Submission fields defined yet. Add fields under Object Management first.
          </div>
        ) : selectedFields.length === 0 ? (
          <div
            style={{
              border: '1px dashed var(--slds-g-color-border-1)',
              borderRadius: 'var(--slds-g-radius-border-2)',
              padding: '24px 20px',
              textAlign: 'center',
              color: 'var(--slds-g-color-on-surface-1)',
            }}
          >
            No columns selected. Use the{' '}
            <Icon name="settings" size={13} style={{ verticalAlign: 'middle' }} /> button to choose
            columns.
          </div>
        ) : (
          <Table
            columns={selectedFields.map((f) => ({
              key: f.api,
              header: f.label || f.api,
              render: () => (
                <span style={{ color: 'var(--slds-g-color-on-surface-1)' }}>—</span>
              ),
            }))}
            rows={[]}
            rowKey={() => 'row'}
            bordered
            empty="Submission records appear here at runtime."
          />
        )}
      </section>

      <KpiModal
        open={kpiOpen}
        editing={editingKpi}
        fields={fields}
        onClose={closeKpiModal}
        onSave={onSaveKpi}
      />
      <Modal
        open={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        title="Select Columns"
        size="md"
        footer={
          <Button variant="brand" onClick={() => setColumnsOpen(false)}>
            Done
          </Button>
        }
      >
        <p
          style={{
            margin: '0 0 var(--slds-g-spacing-4)',
            fontSize: 'var(--slds-g-font-scale-neg-1)',
            color: 'var(--slds-g-color-on-surface-1)',
          }}
        >
          Move fields into Selected Columns and order them to set the list report layout.
        </p>
        <DuelingPicklist
          options={columnOptions}
          selected={columns}
          onChange={setColumns}
          leftLabel="Available Columns"
          rightLabel="Selected Columns"
        />
      </Modal>
    </div>
  );
}

/**
 * Salesforce-style lookup for selecting a global Run My Day playbook. Mirrors the
 * standard SLDS lookup: a search input with a results menu, an inline
 * "New Playbook" action, and a selected "pill" with a clear button. Reuses the
 * portalled `slds2-dropdown__menu` styling (loaded via the Dropdown component).
 */
function PlaybookLookup({
  playbooks,
  value,
  onChange,
  onCreateNew,
}: {
  playbooks: Playbook[];
  value: number | null;
  onChange: (id: number | null) => void;
  onCreateNew: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const selected = value != null ? playbooks.find((p) => p.id === value) ?? null : null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return playbooks;
    return playbooks.filter((p) => p.name.toLowerCase().includes(q));
  }, [playbooks, query]);

  useEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    const place = () => {
      const t = inputRef.current;
      if (!t) return;
      const r = t.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (ev: MouseEvent) => {
      const target = ev.target as Node;
      const inRoot = rootRef.current?.contains(target) ?? false;
      const inMenu = menuRef.current?.contains(target) ?? false;
      if (!inRoot && !inMenu) setOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (id: number) => {
    onChange(id);
    setQuery('');
    setOpen(false);
  };

  if (selected) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          minHeight: 32,
          padding: '4px 8px 4px 10px',
          background: 'var(--slds-g-color-surface-1)',
          border: '1px solid var(--slds-g-color-border-2)',
          borderRadius: 'var(--slds-g-radius-border-2)',
        }}
      >
        <Icon name="briefcase" size={13} />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 'var(--slds-g-font-scale-neg-1)',
            color: 'var(--slds-g-color-on-surface-1)',
          }}
        >
          {selected.name || 'Untitled playbook'}
        </span>
        <button
          type="button"
          className="tph__col-close"
          onClick={() => onChange(null)}
          aria-label="Clear playbook"
          title="Clear selection"
        >
          <Icon name="close" size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="slds2-dropdown slds2-dropdown--full" ref={rootRef}>
      <div style={{ position: 'relative' }}>
        <span
          style={{
            position: 'absolute',
            top: '50%',
            left: 10,
            transform: 'translateY(-50%)',
            display: 'flex',
            color: 'var(--slds-g-color-on-surface-2)',
            pointerEvents: 'none',
          }}
        >
          <Icon name="search" size={14} />
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Search Playbooks…"
          aria-label="Search playbooks"
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          style={{
            width: '100%',
            minHeight: 32,
            padding: '6px 10px 6px 32px',
            fontFamily: 'var(--slds-g-font-family-base)',
            fontSize: 'var(--slds-g-font-scale-neg-1)',
            color: 'var(--slds-g-color-on-surface-1)',
            background: 'var(--slds-g-color-surface-1)',
            border: `1px solid ${open ? 'var(--slds-g-color-accent-1)' : 'var(--slds-g-color-border-2)'}`,
            borderRadius: 'var(--slds-g-radius-border-2)',
            outline: 'none',
          }}
        />
      </div>
      {open &&
        rect &&
        createPortal(
          <div
            className="slds2-dropdown__menu"
            role="listbox"
            ref={menuRef}
            style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width }}
          >
            {matches.length === 0 ? (
              <div
                style={{
                  padding: '8px 10px',
                  fontSize: 'var(--slds-g-font-scale-neg-1)',
                  color: 'var(--slds-g-color-on-surface-3)',
                }}
              >
                No matching playbooks.
              </div>
            ) : (
              matches.map((p) => (
                <div
                  key={p.id}
                  role="option"
                  aria-selected={false}
                  className="slds2-dropdown__option"
                  onClick={() => pick(p.id)}
                >
                  <span
                    className="slds2-dropdown__option-label"
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <Icon name="briefcase" size={13} />
                    {p.name || 'Untitled playbook'}
                  </span>
                </div>
              ))
            )}
            <div
              className="slds2-dropdown__option"
              role="option"
              aria-selected={false}
              onClick={() => {
                setOpen(false);
                setQuery('');
                onCreateNew();
              }}
              style={{
                marginTop: 2,
                borderTop: '1px solid var(--slds-g-color-border-2)',
                paddingTop: 8,
                color: 'var(--slds-g-color-accent-1)',
              }}
            >
              <span
                className="slds2-dropdown__option-label"
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <Icon name="plus" size={13} />
                New Playbook
              </span>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/**
 * Skills — General Setup → Assignment And Routing → Skills.
 *
 * Two-column taxonomy mirroring Document Classification's Document Categories:
 * the left column lists Skill Types (Name, Developer Name); selecting one
 * reveals its Skills (Name, Developer Name, Description) on the right. Each
 * column's Add button opens a modal with Cancel / Save / Save and New. Rows
 * carry a kebab menu for Edit / Delete.
 */
function SkillsSection() {
  const { config, update } = useConfig();
  const skillTypes = config.skillTypes ?? [];
  const skills = config.skills ?? [];

  const [focusedId, setFocusedId] = useState<number | null>(
    () => skillTypes[0]?.id ?? null,
  );

  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<SkillType | null>(null);
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);

  // Re-anchor focus if the focused skill type disappears (delete).
  useEffect(() => {
    if (focusedId != null && !skillTypes.find((t) => t.id === focusedId)) {
      setFocusedId(skillTypes[0]?.id ?? null);
    }
  }, [skillTypes, focusedId]);

  const focused = useMemo(
    () => skillTypes.find((t) => t.id === focusedId) ?? null,
    [skillTypes, focusedId],
  );
  const focusedSkills = useMemo(
    () => (focused ? skills.filter((s) => s.skillTypeId === focused.id) : []),
    [skills, focused],
  );

  const saveType = (draft: Omit<SkillType, 'id'>) => {
    if (editingType) {
      const id = editingType.id;
      update((p) => ({
        ...p,
        skillTypes: (p.skillTypes ?? []).map((t) =>
          t.id === id ? { ...t, ...draft } : t,
        ),
      }));
    } else {
      update((p) => {
        const id = p.nextSkillTypeId ?? 1;
        setFocusedId(id);
        return {
          ...p,
          skillTypes: [...(p.skillTypes ?? []), { id, ...draft }],
          nextSkillTypeId: id + 1,
        };
      });
    }
  };

  const deleteType = (t: SkillType) => {
    if (
      !confirm(`Delete skill type "${t.name || 'Untitled'}"? Its skills will be removed too.`)
    )
      return;
    update((p) => ({
      ...p,
      skillTypes: (p.skillTypes ?? []).filter((x) => x.id !== t.id),
      skills: (p.skills ?? []).filter((s) => s.skillTypeId !== t.id),
    }));
  };

  const saveSkill = (draft: Omit<Skill, 'id' | 'skillTypeId'>) => {
    if (editingSkill) {
      const id = editingSkill.id;
      update((p) => ({
        ...p,
        skills: (p.skills ?? []).map((s) => (s.id === id ? { ...s, ...draft } : s)),
      }));
    } else {
      if (!focused) return;
      const skillTypeId = focused.id;
      update((p) => {
        const id = p.nextSkillId ?? 1;
        return {
          ...p,
          skills: [...(p.skills ?? []), { id, skillTypeId, ...draft }],
          nextSkillId: id + 1,
        };
      });
    }
  };

  const deleteSkill = (s: Skill) => {
    if (!confirm(`Delete skill "${s.name || 'Untitled'}"?`)) return;
    update((p) => ({
      ...p,
      skills: (p.skills ?? []).filter((x) => x.id !== s.id),
    }));
  };

  return (
    <Card
      className="dc-taxonomy-card"
      title={<span className="dc-taxonomy-title">Skill Definition</span>}
      subtitle="Define the skill types and the skills within each. Skills are used to match submissions to underwriters with the right expertise."
      padding="none"
    >
      <div className="dc-taxonomy">
        <Column
          title="Skill Type"
          count={skillTypes.length}
          onAdd={() => {
            setEditingType(null);
            setTypeModalOpen(true);
          }}
        >
          {skillTypes.length === 0 ? (
            <div className="dc-empty">No skill types yet. Add one to get started.</div>
          ) : (
            skillTypes.map((t) => {
              const isFocused = focusedId === t.id;
              return (
                <div
                  key={t.id}
                  className={['dc-row', isFocused ? 'dc-row--focus' : '']
                    .filter(Boolean)
                    .join(' ')}
                  role="button"
                  tabIndex={0}
                  onClick={() => setFocusedId(t.id)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      setFocusedId(t.id);
                    }
                  }}
                >
                  <span className="dc-row__label">{t.name || 'Untitled'}</span>
                  <RowMenu
                    ariaLabel={`${t.name || 'Skill type'} actions`}
                    onEdit={(e) => {
                      e.stopPropagation();
                      setEditingType(t);
                      setTypeModalOpen(true);
                    }}
                    onDelete={(e) => {
                      e.stopPropagation();
                      deleteType(t);
                    }}
                  />
                </div>
              );
            })
          )}
        </Column>

        <Column
          title="Skills"
          subtitle={
            focused ? `Skills under ${focused.name}` : 'Pick a skill type on the left'
          }
          count={focusedSkills.length}
          disabled={!focused}
          onAdd={() => {
            if (!focused) return;
            setEditingSkill(null);
            setSkillModalOpen(true);
          }}
        >
          {!focused ? (
            <div className="dc-empty">Select a skill type to manage its skills.</div>
          ) : focusedSkills.length === 0 ? (
            <div className="dc-empty">No skills yet for this skill type.</div>
          ) : (
            focusedSkills.map((s) => (
              <div
                key={s.id}
                className="dc-row"
                style={{ cursor: 'default', alignItems: 'flex-start' }}
              >
                <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                  <span className="dc-row__label">{s.name || 'Untitled'}</span>
                  {s.description && (
                    <p
                      style={{
                        margin: '2px 0 0',
                        fontSize: 'var(--slds-g-font-scale-neg-1)',
                        color: 'var(--slds-g-color-on-surface-1)',
                        lineHeight: 1.4,
                        whiteSpace: 'normal',
                      }}
                    >
                      {s.description}
                    </p>
                  )}
                </div>
                <RowMenu
                  ariaLabel={`${s.name || 'Skill'} actions`}
                  onEdit={(e) => {
                    e.stopPropagation();
                    setEditingSkill(s);
                    setSkillModalOpen(true);
                  }}
                  onDelete={(e) => {
                    e.stopPropagation();
                    deleteSkill(s);
                  }}
                />
              </div>
            ))
          )}
        </Column>
      </div>

      <SkillTypeModal
        open={typeModalOpen}
        editing={editingType}
        onClose={() => setTypeModalOpen(false)}
        onSave={saveType}
      />
      <SkillModal
        open={skillModalOpen}
        editing={editingSkill}
        onClose={() => setSkillModalOpen(false)}
        onSave={saveSkill}
      />
    </Card>
  );
}

/** Auto-derive a Salesforce-style Developer Name from a label. */
function toDeveloperName(label: string): string {
  return label
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^([0-9])/, 'X$1');
}

function SkillTypeModal({
  open,
  editing,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: SkillType | null;
  onClose: () => void;
  onSave: (draft: Omit<SkillType, 'id'>) => void;
}) {
  const [name, setName] = useState('');
  const [developerName, setDeveloperName] = useState('');
  const [devEdited, setDevEdited] = useState(false);

  const reset = () => {
    setName('');
    setDeveloperName('');
    setDevEdited(false);
  };

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setDeveloperName(editing?.developerName ?? '');
    setDevEdited(!!editing);
  }, [open, editing]);

  const canSave = name.trim().length > 0;
  const collect = (): Omit<SkillType, 'id'> => ({
    name: name.trim(),
    developerName: (developerName.trim() || toDeveloperName(name)) ,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Skill Type' : 'New Skill Type'}
      size="sm"
      footer={
        <>
          <Button variant="neutral" onClick={onClose}>
            Cancel
          </Button>
          {!editing && (
            <Button
              variant="neutral"
              disabled={!canSave}
              onClick={() => {
                onSave(collect());
                reset();
              }}
            >
              Save &amp; New
            </Button>
          )}
          <Button
            variant="brand"
            disabled={!canSave}
            onClick={() => {
              onSave(collect());
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--slds-g-spacing-4)' }}>
        <Input
          label="Name"
          required
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!devEdited) setDeveloperName(toDeveloperName(e.target.value));
          }}
          placeholder="e.g. Industry Expertise"
        />
        <Input
          label="Developer Name"
          value={developerName}
          onChange={(e) => {
            setDevEdited(true);
            setDeveloperName(e.target.value);
          }}
          placeholder="e.g. Industry_Expertise"
        />
      </div>
    </Modal>
  );
}

function SkillModal({
  open,
  editing,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: Skill | null;
  onClose: () => void;
  onSave: (draft: Omit<Skill, 'id' | 'skillTypeId'>) => void;
}) {
  const [name, setName] = useState('');
  const [developerName, setDeveloperName] = useState('');
  const [description, setDescription] = useState('');
  const [devEdited, setDevEdited] = useState(false);

  const reset = () => {
    setName('');
    setDeveloperName('');
    setDescription('');
    setDevEdited(false);
  };

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setDeveloperName(editing?.developerName ?? '');
    setDescription(editing?.description ?? '');
    setDevEdited(!!editing);
  }, [open, editing]);

  const canSave = name.trim().length > 0;
  const collect = (): Omit<Skill, 'id' | 'skillTypeId'> => ({
    name: name.trim(),
    developerName: developerName.trim() || toDeveloperName(name),
    description: description.trim(),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Skill' : 'New Skill'}
      size="sm"
      footer={
        <>
          <Button variant="neutral" onClick={onClose}>
            Cancel
          </Button>
          {!editing && (
            <Button
              variant="neutral"
              disabled={!canSave}
              onClick={() => {
                onSave(collect());
                reset();
              }}
            >
              Save &amp; New
            </Button>
          )}
          <Button
            variant="brand"
            disabled={!canSave}
            onClick={() => {
              onSave(collect());
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--slds-g-spacing-4)' }}>
        <Input
          label="Name"
          required
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!devEdited) setDeveloperName(toDeveloperName(e.target.value));
          }}
          placeholder="e.g. Habitational Property"
        />
        <Input
          label="Developer Name"
          value={developerName}
          onChange={(e) => {
            setDevEdited(true);
            setDeveloperName(e.target.value);
          }}
          placeholder="e.g. Habitational_Property"
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this skill represents"
          rows={3}
        />
      </div>
    </Modal>
  );
}

/* ── Skill Mapping ────────────────────────────────────────────── */

const SKILL_MAP_OPERATORS = [
  'equals',
  'not equals',
  'contains',
  'does not contain',
  'starts with',
  'ends with',
  'is blank',
  'is not blank',
];
const SKILL_MAP_NO_VALUE_OPS = new Set(['is blank', 'is not blank']);

/** Rule-based mapping from Submission field conditions to a skill. Mirrors
 * the Stage Management → Transition Rules layout, but conditions test
 * Submission fields (not tasks) and the outcome is a Skill Type + Skill. */
function SkillMappingSection() {
  const { config, update } = useConfig();
  const mappings = config.skillMappings ?? [];
  const skillTypes = config.skillTypes ?? [];
  const skills = config.skills ?? [];
  const fields = config.fields ?? [];

  const [modal, setModal] = useState<{ open: boolean; editingId: number | null }>({
    open: false,
    editingId: null,
  });

  const fieldLabel = (api: string) =>
    fields.find((f) => f.api === api)?.label ?? api;
  const skillTypeName = (id: number | null) =>
    id == null ? '' : skillTypes.find((t) => t.id === id)?.name ?? '';
  const skillName = (id: number | null) =>
    id == null ? '' : skills.find((s) => s.id === id)?.name ?? '';

  const onSave = (id: number | null, draft: Omit<SkillMapping, 'id'>) => {
    if (id == null) {
      update((p) => {
        const newId = p.nextSkillMappingId ?? 1;
        return {
          ...p,
          skillMappings: [...(p.skillMappings ?? []), { id: newId, ...draft }],
          nextSkillMappingId: newId + 1,
        };
      });
    } else {
      update((p) => ({
        ...p,
        skillMappings: (p.skillMappings ?? []).map((m) =>
          m.id === id ? { ...m, ...draft } : m,
        ),
      }));
    }
    setModal({ open: false, editingId: null });
  };

  const onDelete = (m: SkillMapping) => {
    if (!confirm('Delete this skill mapping?')) return;
    update((p) => ({
      ...p,
      skillMappings: (p.skillMappings ?? []).filter((x) => x.id !== m.id),
    }));
  };

  const editing =
    modal.editingId != null
      ? mappings.find((m) => m.id === modal.editingId) ?? null
      : null;

  return (
    <Card
      className="dc-taxonomy-card"
      title={<span className="dc-taxonomy-title">Skill Mapping</span>}
      subtitle="Map submissions to a skill using field-based rules. When a submission matches a rule's conditions, the mapped skill is applied."
      padding="none"
    >
      <div style={{ padding: 'var(--slds-g-spacing-4)' }}>
        <div className="lse-rules">
          <div className="lse-rules__head">
            <button
              type="button"
              className="lob-activities__new-btn"
              onClick={() => setModal({ open: true, editingId: null })}
            >
              <Icon name="plus" size={12} />
              Add Mapping
            </button>
          </div>

          {mappings.length === 0 ? (
            <div className="lse-rules__empty">
              No skill mappings yet. Click <strong>Add Mapping</strong> to add one.
            </div>
          ) : (
            <div className="lse-tr-group">
              <table className="lse-tr-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>#</th>
                    <th>Conditions</th>
                    <th style={{ width: 180 }}>Skill Category</th>
                    <th style={{ width: 180 }}>Mapped Skill</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((m, idx) => {
                    const conditions = (m.conditions ?? []).filter((c) => c.field);
                    return (
                      <tr key={m.id}>
                        <td className="lse-tr-table__num">{idx + 1}</td>
                        <td>
                          {conditions.length === 0 ? (
                            <span className="lse-tr-table__empty">
                              No conditions defined
                            </span>
                          ) : (
                            <div className="lse-tr-conditions">
                              {conditions.map((c, i) => {
                                const noVal = SKILL_MAP_NO_VALUE_OPS.has(
                                  c.operator ?? '',
                                );
                                return (
                                  <div key={i} className="lse-tr-conditions__line">
                                    <span className="lse-tr-conditions__num">
                                      {i + 1}.
                                    </span>{' '}
                                    <strong>{fieldLabel(c.field)}</strong>{' '}
                                    {c.operator ?? 'equals'}
                                    {!noVal && <strong> {c.value ?? ''}</strong>}
                                  </div>
                                );
                              })}
                              {m.expression && (
                                <div className="lse-tr-conditions__expr">
                                  Logic: {m.expression}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          {skillTypeName(m.skillTypeId) ? (
                            <div className="lse-tr-conditions__line">
                              {skillTypeName(m.skillTypeId)}
                            </div>
                          ) : (
                            <span className="lse-tr-table__empty">—</span>
                          )}
                        </td>
                        <td>
                          {m.skillId != null ? (
                            <div className="lse-tr-conditions__line">
                              <strong>{skillName(m.skillId)}</strong>
                            </div>
                          ) : (
                            <span className="lse-tr-table__empty">No skill mapped</span>
                          )}
                        </td>
                        <td className="lse-tr-table__actions">
                          <div className="lse-tr-table__actions-inner">
                            <Button
                              variant="icon"
                              aria-label="Edit mapping"
                              onClick={() =>
                                setModal({ open: true, editingId: m.id })
                              }
                            >
                              <Icon name="edit" size={14} />
                            </Button>
                            <Button
                              variant="icon"
                              aria-label="Delete mapping"
                              onClick={() => onDelete(m)}
                            >
                              <Icon name="trash" size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <SkillMappingModal
        open={modal.open}
        editing={editing}
        fields={fields}
        skillTypes={skillTypes}
        skills={skills}
        onCancel={() => setModal({ open: false, editingId: null })}
        onSave={(draft) => onSave(modal.editingId, draft)}
      />
    </Card>
  );
}

function SkillMappingModal({
  open,
  editing,
  fields,
  skillTypes,
  skills,
  onCancel,
  onSave,
}: {
  open: boolean;
  editing: SkillMapping | null;
  fields: Field[];
  skillTypes: SkillType[];
  skills: Skill[];
  onCancel: () => void;
  onSave: (draft: Omit<SkillMapping, 'id'>) => void;
}) {
  const [conditions, setConditions] = useState<SkillMappingCondition[]>([]);
  const [expression, setExpression] = useState('');
  const [skillTypeId, setSkillTypeId] = useState<number | null>(null);
  const [skillId, setSkillId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setConditions(
      editing?.conditions ? JSON.parse(JSON.stringify(editing.conditions)) : [],
    );
    setExpression(editing?.expression ?? '');
    setSkillTypeId(editing?.skillTypeId ?? null);
    setSkillId(editing?.skillId ?? null);
  }, [open, editing]);

  const skillOptions = useMemo(
    () =>
      skillTypeId == null
        ? []
        : skills.filter((s) => s.skillTypeId === skillTypeId),
    [skills, skillTypeId],
  );

  const addCondition = () =>
    setConditions((prev) => [
      ...prev,
      { field: fields[0]?.api ?? '', operator: 'equals', value: '' },
    ]);
  const updateCondition = (i: number, patch: Partial<SkillMappingCondition>) =>
    setConditions((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    );
  const removeCondition = (i: number) =>
    setConditions((prev) => prev.filter((_, idx) => idx !== i));

  const valid = skillId != null;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={editing ? 'Edit Skill Mapping' : 'New Skill Mapping'}
      size="lg"
      footer={
        <>
          <Button variant="neutral" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="brand"
            disabled={!valid}
            onClick={() => onSave({ conditions, expression, skillTypeId, skillId })}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="lse-tr-modal">
        <div className="lse-tr-modal__divider" style={{ borderTop: 0, paddingTop: 0, marginTop: 0 }}>
          Rules
        </div>
        <p style={{ margin: 0, fontSize: 'var(--slds-g-font-scale-neg-1)', color: 'var(--slds-g-color-on-surface-1)' }}>
          The mapping applies when a submission matches all of the conditions below.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '120px minmax(0, 1fr)',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <span className="lse-tr-modal__label" style={{ marginBottom: 0 }}>
            Filter Logic
          </span>
          <Input
            aria-label="Filter Logic"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="e.g. (1 AND 2) OR 3"
            hint="Use row numbers, AND, OR, parentheses. Leave blank to AND all conditions."
            fullWidth
          />
        </div>

        <div className="lse-tr-modal__conds">
          {conditions.length === 0 ? (
            <div className="lse-tr-modal__empty">No conditions yet.</div>
          ) : (
            conditions.map((c, i) => {
              const noVal = SKILL_MAP_NO_VALUE_OPS.has(c.operator);
              return (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '28px minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1.2fr) auto',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <span className="lse-tr-modal__cond-num">{i + 1}</span>
                  <Dropdown
                    aria-label="Field"
                    value={c.field}
                    onChange={(v) => updateCondition(i, { field: v })}
                    placeholder="Select field"
                    fullWidth
                    options={fields.map((f) => ({ value: f.api, label: f.label }))}
                  />
                  <Dropdown
                    aria-label="Operator"
                    value={c.operator}
                    onChange={(v) => updateCondition(i, { operator: v })}
                    fullWidth
                    options={SKILL_MAP_OPERATORS.map((o) => ({ value: o, label: o }))}
                  />
                  {noVal ? (
                    <span className="lse-tr-modal__cond-spacer" />
                  ) : (
                    <Input
                      aria-label="Value"
                      value={c.value}
                      onChange={(e) => updateCondition(i, { value: e.target.value })}
                      placeholder="Value"
                    />
                  )}
                  <Button
                    variant="icon"
                    aria-label="Remove condition"
                    onClick={() => removeCondition(i)}
                  >
                    <Icon name="trash" size={14} />
                  </Button>
                </div>
              );
            })
          )}
          <div>
            <button
              type="button"
              className="lob-activities__new-btn"
              onClick={addCondition}
              disabled={fields.length === 0}
            >
              <Icon name="plus" size={12} />
              Add Condition
            </button>
          </div>
        </div>

        <div className="lse-tr-modal__divider">Map Skill</div>
        <div className="lse-tr-modal__row">
          <div>
            <div className="lse-tr-modal__label">Skill Type</div>
            <Dropdown
              aria-label="Skill Type"
              value={skillTypeId == null ? '' : String(skillTypeId)}
              onChange={(v) => {
                setSkillTypeId(v === '' ? null : Number(v));
                setSkillId(null);
              }}
              placeholder="Select skill type"
              fullWidth
              options={skillTypes.map((t) => ({ value: String(t.id), label: t.name }))}
            />
          </div>
          <div>
            <div className="lse-tr-modal__label">Skill</div>
            <Dropdown
              aria-label="Skill"
              value={skillId == null ? '' : String(skillId)}
              onChange={(v) => setSkillId(v === '' ? null : Number(v))}
              placeholder={skillTypeId == null ? 'Select a skill type first' : 'Select skill'}
              disabled={skillTypeId == null}
              fullWidth
              options={skillOptions.map((s) => ({ value: String(s.id), label: s.name }))}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function SectionHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <h3
        style={{
          margin: 0,
          fontSize: 'var(--slds-g-font-scale-2)',
          fontWeight: 'var(--slds-g-font-weight-6)',
          color: 'var(--slds-g-color-on-surface-3)',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          margin: '4px 0 0',
          fontSize: 'var(--slds-g-font-scale-base)',
          color: 'var(--slds-g-color-on-surface-1)',
        }}
      >
        {sub}
      </p>
    </div>
  );
}

function KpiModal({
  open,
  editing,
  fields,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: PersonaKpi | null;
  fields: Field[];
  onClose: () => void;
  onSave: (values: Omit<PersonaKpi, 'id'>) => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [source, setSource] = useState('');
  const [formula, setFormula] = useState('');
  const [refreshFrequency, setRefreshFrequency] = useState('');
  const [unit, setUnit] = useState<KpiUnit>('Percent (%)');
  const [description, setDescription] = useState('');
  const [thresholdGreen, setThresholdGreen] = useState('');
  const [thresholdYellow, setThresholdYellow] = useState('');
  const [thresholdRed, setThresholdRed] = useState('');

  // Load the KPI being edited (or clear) whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setCategory(editing?.category ?? '');
    setSource(editing?.source ?? '');
    setFormula(editing?.formula ?? '');
    setRefreshFrequency(editing?.refreshFrequency ?? '');
    setUnit(editing?.unit ?? 'Percent (%)');
    setDescription(editing?.description ?? '');
    setThresholdGreen(editing?.thresholdGreen ?? '');
    setThresholdYellow(editing?.thresholdYellow ?? '');
    setThresholdRed(editing?.thresholdRed ?? '');
  }, [open, editing]);

  const canSave = name.trim().length > 0;

  const clear = () => {
    setName('');
    setCategory('');
    setSource('');
    setFormula('');
    setRefreshFrequency('');
    setUnit('Percent (%)');
    setDescription('');
    setThresholdGreen('');
    setThresholdYellow('');
    setThresholdRed('');
  };

  const collect = (): Omit<PersonaKpi, 'id'> => ({
    name: name.trim(),
    description: description.trim(),
    source: source.trim(),
    category: category.trim(),
    formula: formula.trim(),
    refreshFrequency: refreshFrequency.trim(),
    unit,
    thresholdGreen: thresholdGreen.trim(),
    thresholdYellow: thresholdYellow.trim(),
    thresholdRed: thresholdRed.trim(),
    status: editing?.status ?? 'Draft',
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit KPI' : 'Define a New KPI'}
      size="lg"
      footer={
        <>
          <Button variant="neutral" onClick={clear}>
            Clear
          </Button>
          <Button variant="brand" disabled={!canSave} onClick={() => onSave(collect())}>
            {editing ? 'Save' : 'Save as Draft'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--slds-g-spacing-5)' }}>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--slds-g-font-scale-neg-1)',
            color: 'var(--slds-g-color-on-surface-1)',
          }}
        >
          New KPIs are saved as <strong>Draft</strong> until an Underwriter Administrator activates
          them.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 'var(--slds-g-spacing-4)',
          }}
        >
          <Input
            label="KPI Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rate Adequacy"
          />
          <Input
            label="Goal / Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Risk Quality & Profitability"
          />
          <Input
            label="Data Source (object.field)"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="e.g. Policy__c.Premium_Amount__c"
          />
          <Input
            label="Refresh Frequency"
            value={refreshFrequency}
            onChange={(e) => setRefreshFrequency(e.target.value)}
            placeholder="e.g. Monthly"
          />
        </div>

        <FormulaEditor
          label="Formula"
          value={formula}
          onChange={setFormula}
          fields={fields}
          placeholder="e.g. (Submission__c.Quoted_Premium__c / Submission__c.Technical_Premium__c) * 100"
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: '50%' }}>
          <label
            style={{
              fontSize: 'var(--slds-g-font-scale-neg-1)',
              fontWeight: 'var(--slds-g-font-weight-6)',
              color: 'var(--slds-g-color-on-surface-2)',
            }}
          >
            Unit
          </label>
          <Dropdown
            value={unit}
            onChange={(v) => setUnit(v as KpiUnit)}
            aria-label="Unit"
            options={KPI_UNITS.map((u) => ({ value: u, label: u }))}
          />
        </div>

        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this KPI measures"
          rows={2}
        />

        <div>
          <div
            style={{
              fontSize: 'var(--slds-g-font-scale-neg-1)',
              fontWeight: 'var(--slds-g-font-weight-6)',
              color: 'var(--slds-g-color-on-surface-2)',
              marginBottom: 'var(--slds-g-spacing-1)',
            }}
          >
            Thresholds{' '}
            <span
              style={{
                fontWeight: 'var(--slds-g-font-weight-4)',
                color: 'var(--slds-g-color-on-surface-1)',
              }}
            >
              (shown as badges in the dashboard)
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 'var(--slds-g-spacing-4)',
            }}
          >
            <ThresholdField
              color="var(--slds-g-color-success-1)"
              label="Green (on target)"
              value={thresholdGreen}
              onChange={setThresholdGreen}
              placeholder="e.g. ≥95%"
            />
            <ThresholdField
              color="var(--slds-g-color-warning-1)"
              label="Yellow (at risk)"
              value={thresholdYellow}
              onChange={setThresholdYellow}
              placeholder="e.g. 85–94%"
            />
            <ThresholdField
              color="var(--slds-g-color-error-1)"
              label="Red (off target)"
              value={thresholdRed}
              onChange={setThresholdRed}
              placeholder="e.g. <85%"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ThresholdField({
  color,
  label,
  value,
  onChange,
  placeholder,
}: {
  color: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 'var(--slds-g-font-scale-neg-1)',
          fontWeight: 'var(--slds-g-font-weight-6)',
          color,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 'var(--slds-g-radius-border-circle)',
            background: color,
          }}
        />
        {label}
      </span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
    </div>
  );
}

const OBJECT_API = 'Submission__c';
const FORMULA_FUNCTIONS: { token: string; detail: string }[] = [
  { token: 'SUM', detail: 'Sum of values' },
  { token: 'AVG', detail: 'Average of values' },
  { token: 'MIN', detail: 'Minimum value' },
  { token: 'MAX', detail: 'Maximum value' },
  { token: 'COUNT', detail: 'Count of records' },
  { token: 'ROUND', detail: 'Round to n places' },
  { token: 'ABS', detail: 'Absolute value' },
];

interface FormulaSuggestion {
  /** Text inserted into the formula. */
  token: string;
  /** Primary label shown in the menu. */
  label: string;
  /** Secondary muted text (field type or function description). */
  detail: string;
  kind: 'field' | 'function';
}

/**
 * Formula input with `object.field` type-ahead. As the user types an identifier
 * fragment (letters/digits/`_`/`.`) the caret-anchored token is matched against
 * the Submission field catalog + a small function set; picking a suggestion
 * replaces just that fragment, leaving operators and surrounding text intact.
 * The menu is portalled (fixed position) so it escapes the modal's overflow —
 * same pattern as PlaybookLookup.
 */
function FormulaEditor({
  label,
  value,
  onChange,
  fields,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  fields: Field[];
  placeholder?: string;
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const catalog = useMemo<FormulaSuggestion[]>(() => {
    const fieldTokens = fields.map((f) => ({
      token: `${OBJECT_API}.${f.api}`,
      label: `${OBJECT_API}.${f.api}`,
      detail: f.label ? `${f.label} · ${f.type}` : f.type,
      kind: 'field' as const,
    }));
    const fnTokens = FORMULA_FUNCTIONS.map((fn) => ({
      token: `${fn.token}(`,
      label: `${fn.token}( )`,
      detail: fn.detail,
      kind: 'function' as const,
    }));
    return [...fieldTokens, ...fnTokens];
  }, [fields]);

  // The identifier fragment immediately before the caret, if any.
  const fragment = (() => {
    const ta = taRef.current;
    if (!ta) return '';
    const upto = value.slice(0, ta.selectionStart ?? value.length);
    const m = upto.match(/[A-Za-z0-9_.]*$/);
    return m ? m[0] : '';
  })();

  const matches = useMemo(() => {
    const q = fragment.trim().toLowerCase();
    if (!q) return [];
    return catalog.filter((s) => s.token.toLowerCase().includes(q)).slice(0, 8);
  }, [catalog, fragment]);

  const place = () => {
    const ta = taRef.current;
    if (!ta) return;
    const r = ta.getBoundingClientRect();
    setRect({ top: r.bottom + 4, left: r.left, width: r.width });
  };

  useEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [fragment]);

  const maybeOpen = () => {
    const ta = taRef.current;
    if (!ta) return;
    const upto = value.slice(0, ta.selectionStart ?? value.length);
    const m = upto.match(/[A-Za-z0-9_.]*$/);
    const frag = m ? m[0] : '';
    setOpen(frag.trim().length > 0);
  };

  const applySuggestion = (s: FormulaSuggestion) => {
    const ta = taRef.current;
    const caret = ta?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const start = before.search(/[A-Za-z0-9_.]*$/);
    const next = before.slice(0, start) + s.token + after;
    onChange(next);
    setOpen(false);
    // Restore caret to just after the inserted token on the next tick.
    const pos = start + s.token.length;
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open || matches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      applySuggestion(matches[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onDocClick = (ev: MouseEvent) => {
      const t = ev.target as Node;
      if (taRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label
        style={{
          fontSize: 'var(--slds-g-font-scale-neg-1)',
          fontWeight: 'var(--slds-g-font-weight-6)',
          color: 'var(--slds-g-color-on-surface-2)',
        }}
      >
        {label}
      </label>
      <Textarea
        ref={taRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          maybeOpen();
        }}
        onKeyDown={onKeyDown}
        onKeyUp={maybeOpen}
        onClick={maybeOpen}
        onFocus={maybeOpen}
        placeholder={placeholder}
        rows={2}
        style={{ fontFamily: 'var(--slds-g-font-family-monospace)' }}
      />
      <span
        style={{
          fontSize: 'var(--slds-g-font-scale-neg-2)',
          color: 'var(--slds-g-color-on-surface-1)',
        }}
      >
        Reference fields as <code>{OBJECT_API}.Field__c</code>. Type to autocomplete; ↑↓ to
        navigate, Enter to insert.
      </span>
      {open &&
        matches.length > 0 &&
        rect &&
        createPortal(
          <div
            ref={menuRef}
            className="slds2-dropdown__menu"
            style={{
              position: 'fixed',
              top: rect.top,
              left: rect.left,
              width: rect.width,
              maxHeight: 260,
              overflowY: 'auto',
              zIndex: 9999,
            }}
          >
            {matches.map((s, i) => (
              <button
                key={s.token}
                type="button"
                className={`slds2-dropdown__option${i === active ? ' slds2-dropdown__option--selected' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  applySuggestion(s);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  width: '100%',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--slds-g-font-family-monospace)',
                    fontSize: 'var(--slds-g-font-scale-neg-1)',
                    color: 'var(--slds-g-color-on-surface-3)',
                  }}
                >
                  {s.label}
                </span>
                <span
                  style={{
                    fontSize: 'var(--slds-g-font-scale-neg-2)',
                    color: 'var(--slds-g-color-on-surface-1)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.detail}
                </span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

function PersonaModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, role: UnderwriterRole | '') => void;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<UnderwriterRole | ''>('');

  const reset = () => {
    setName('');
    setRole('');
  };
  const handleClose = () => {
    reset();
    onClose();
  };

  const canSave = name.trim().length > 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="New Persona"
      size="sm"
      footer={
        <>
          <Button variant="neutral" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="brand"
            disabled={!canSave}
            onClick={() => {
              onCreate(name.trim(), role);
              reset();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--slds-g-spacing-4)' }}>
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Senior Property Underwriter"
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label
            style={{
              fontSize: 'var(--slds-g-font-scale-neg-1)',
              fontWeight: 'var(--slds-g-font-weight-6)',
              color: 'var(--slds-g-color-on-surface-2)',
            }}
          >
            Role
          </label>
          <Dropdown
            value={role}
            onChange={(v) => setRole(v as UnderwriterRole | '')}
            placeholder="Select a role…"
            aria-label="Role"
            options={UNDERWRITER_ROLES.map((r) => ({ value: r, label: r }))}
          />
        </div>
      </div>
    </Modal>
  );
}
