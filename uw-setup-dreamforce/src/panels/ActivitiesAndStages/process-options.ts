/**
 * Hard-coded option lists for the Activity editor's process picker.
 * These stand in for the live Salesforce registry until the real APIs
 * are wired up. The "value" is the underlying record name as it would
 * be saved on the activity; the "label" is the display string.
 */

export interface ProcessOption {
  value: string;
  label: string;
  /** Optional description shown beneath each option / on hover. */
  description?: string;
}

export const FLOW_OPTIONS: ProcessOption[] = [
  {
    value: 'Submission_Intake_Flow',
    label: 'Submission Intake Flow',
    description: 'Routes inbound submissions to the right desk.',
  },
  {
    value: 'Clearance_Check_Flow',
    label: 'Clearance Check Flow',
    description: 'Runs broker / insured clearance against existing records.',
  },
  {
    value: 'Quote_Followup_Flow',
    label: 'Quote Follow-up Flow',
    description: 'Schedules nudges for quotes nearing expiration.',
  },
  {
    value: 'Renewal_Expiring_Flow',
    label: 'Renewal Expiring Flow',
    description: 'Surfaces renewals 60 days from expiration.',
  },
  {
    value: 'Loss_Run_Review_Flow',
    label: 'Loss Run Review Flow',
    description: 'Walks the underwriter through loss-run analysis.',
  },
  {
    value: 'Compliance_Check_Flow',
    label: 'Compliance Check Flow',
    description: 'Runs OFAC + sanctions checks on the insured.',
  },
];

export const INTEGRATION_PROCEDURE_OPTIONS: ProcessOption[] = [
  {
    value: 'Verisk_PolicyDecisions_Lookup',
    label: 'Verisk PolicyDecisions Lookup',
    description: 'Pulls prior-claim history and policy decisions.',
  },
  {
    value: 'CoreLogic_RCT_Estimate',
    label: 'CoreLogic RCT Estimate',
    description: 'Computes the replacement cost for a property.',
  },
  {
    value: 'DnB_Direct_Plus_Lookup',
    label: 'D&B Direct+ Lookup',
    description: 'Returns business credit and firmographic data.',
  },
  {
    value: 'LexisNexis_Identity_Verify',
    label: 'LexisNexis Identity Verify',
    description: 'Verifies an insured identity in real time.',
  },
  {
    value: 'Mapbox_Address_Geocode',
    label: 'Mapbox Address Geocode',
    description: 'Geocodes a property address to lat/long.',
  },
  {
    value: 'Experian_Business_IQ',
    label: 'Experian Business IQ',
    description: 'Returns commercial credit risk indicators.',
  },
];

export const OMNISCRIPT_OPTIONS: ProcessOption[] = [
  {
    value: 'Property_SubmissionIntake',
    label: 'Property — Submission Intake',
    description: 'Guided intake form for property submissions.',
  },
  {
    value: 'GeneralLiability_SubmissionIntake',
    label: 'General Liability — Submission Intake',
    description: 'Guided intake form for general liability submissions.',
  },
  {
    value: 'Property_QuoteReview',
    label: 'Property — Quote Review',
    description: 'Step-by-step quote approval workflow.',
  },
  {
    value: 'LossRun_Capture',
    label: 'Loss Run Capture',
    description: 'Walks underwriter through historical loss capture.',
  },
  {
    value: 'Underwriter_Decision',
    label: 'Underwriter Decision',
    description: 'Captures decline / accept / refer reasoning.',
  },
];

export const AGENT_OPTIONS: ProcessOption[] = [
  {
    value: 'Submission_Triage_Agent',
    label: 'Submission Triage Agent',
    description: 'Auto-triages new submissions into the right queue.',
  },
  {
    value: 'Risk_Summarizer_Agent',
    label: 'Risk Summarizer Agent',
    description: 'Summarizes risk reports into a brief.',
  },
  {
    value: 'Renewal_Recommendation_Agent',
    label: 'Renewal Recommendation Agent',
    description: 'Suggests renewal actions per portfolio rules.',
  },
  {
    value: 'Document_Reviewer_Agent',
    label: 'Document Reviewer Agent',
    description: 'Reviews submitted documents for completeness.',
  },
  {
    value: 'Compliance_Sentry_Agent',
    label: 'Compliance Sentry Agent',
    description: 'Flags compliance issues during underwriting.',
  },
];

export type ProcessKind =
  | 'Flow'
  | 'Integration Procedure'
  | 'Omniscript'
  | 'Agent';

export function optionsFor(kind: ProcessKind): ProcessOption[] {
  switch (kind) {
    case 'Flow':
      return FLOW_OPTIONS;
    case 'Integration Procedure':
      return INTEGRATION_PROCEDURE_OPTIONS;
    case 'Omniscript':
      return OMNISCRIPT_OPTIONS;
    case 'Agent':
      return AGENT_OPTIONS;
  }
}
