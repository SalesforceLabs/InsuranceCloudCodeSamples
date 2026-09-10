/**
 * Demo Flow Step Configurations
 *
 * This file contains step-by-step configurations for the demo flow (Steps 1-9).
 * Each step defines what data should be visible and how the UI should behave.
 *
 * Configuration Structure:
 * - visibleFields: Array of field names to show in the header (other fields are hidden)
 * - fieldsWithValues: Array of field names that have actual values (others show '-')
 * - detailsFieldsWithValues: Array of field names in Details tab that have values (others show '-')
 * - showLOBSection: Boolean to show/hide Lines of Business section
 * - showSubmissionLines: Boolean to show/hide Submission Lines tab content
 * - activities: Array of activity log items
 * - pendingTasks: Array of pending tasks (can be 'agentic' or 'manual')
 * - documents: Array of documents with their status and insights
 * - emails: Array of email threads
 * - slackMessages: Array of Slack messages
 * - progressPath: Current stage and path visualization
 */

export const stepConfigurations = {
  // ============================================================================
  // STEP 1: Initial Submission Receipt
  // ============================================================================
  1: {
    submission: {
      // Header fields visibility
      visibleFields: ['id', 'broker', 'totalInsuredValue', 'priority', 'stage', 'assignedTo'],
      fieldsWithValues: ['id', 'stage', 'assignedTo'], // Only ID, Stage, and Assigned To have values, rest show '-'

      // Details tab field visibility
      detailsFieldsWithValues: ['name', 'insuredName', 'dateSubmitted', 'stage', 'assignedTo'],

      // Section visibility
      showLOBSection: false,
      showSubmissionLines: false,

      // Activities
      activities: [
        {
          id: 'act-1',
          title: 'Submission Email Received',
          description: 'NexGen Biologics Inc New Business · Sent by Niki Paoloni',
          completedBy: '',
          timestamp: '9:30 PM · May 12',
          status: 'completed' as const,
          detailsList: [
            'Sender: Niki Paoloni',
            'Subject: New Business Submission - NexGen Biologics Commercial Insurance',
          ],
        },
      ],

      // Pending Tasks
      pendingTasks: [
        {
          id: 'task-1',
          title: 'Partial Extraction',
          type: 'agentic' as const,
          assignedTo: 'Agent',
          agentName: 'Extraction Agent',
          status: 'in-progress' as const,
          agentSteps: [
            {
              id: 'step-1',
              title: 'Email Analysis',
              description: 'Analyzing email content from Niki Paoloni requesting commercial property and general liability insurance coverage for NexGen Biologics.',
              status: 'completed' as const,
              timestamp: '9:30 PM',
            },
            {
              id: 'step-2',
              title: 'Document Identification',
              description: 'Identifying documents attached to the broker email and detecting which ACORD forms each PDF contains so separate extraction requests can be spawned.',
              status: 'in-progress' as const,
              timestamp: '9:31 PM',
            },
            {
              id: 'step-3',
              title: 'Data Extraction - ACORD 125',
              description: 'Extracting key fields: Business name (NexGen Biologics Inc), Business type (Pharmaceutical Manufacturing), Years in business (12), Annual revenue ($47.2M), Employee count (285).',
              status: 'pending' as const,
            },
            {
              id: 'step-4',
              title: 'Data Extraction - ACORD 140',
              description: 'Extracting property details: 3 locations identified, Total insured value ($19.5M), Building construction (Fire Resistive), Protection class (Class 3), Sprinkler systems (Yes - all locations).',
              status: 'pending' as const,
            },
            {
              id: 'step-5',
              title: 'Data Extraction - ACORD 126',
              description: 'Processing general liability information: Coverage limits, Operations classification, Prior claims history.',
              status: 'pending' as const,
            },
            {
              id: 'step-6',
              title: 'Data Completion Check',
              description: 'Validating extracted data against required fields. Identifying missing information and inconsistencies across documents.',
              status: 'pending' as const,
            },
            {
              id: 'step-7',
              title: 'Appetite Check',
              description: 'Evaluating submission against underwriting appetite: Industry classification, Revenue size, Loss history, Geographic locations, Coverage types requested.',
              status: 'pending' as const,
            },
            {
              id: 'step-8',
              title: 'Clearance Check',
              description: 'Running automated clearance checks: Sanctions screening, Prior declination check, Reinsurance treaty alignment, Regulatory compliance verification.',
              status: 'pending' as const,
            },
          ],
        },
        {
          id: 'task-data-completion',
          title: 'Data Completion Check',
          type: 'manual' as const,
          assignedTo: 'Underwriter',
          status: 'on-hold' as const,
          description: 'This task checks the availability of values for legal entity, FEIN, business address, NAICS code, and broker contact details.',
          onHoldReason: 'Dependent on the Partial Extraction task.',
          dependentOn: 'Partial Extraction',
        },
        {
          id: 'task-appetite',
          title: 'Appetite Check',
          type: 'manual' as const,
          assignedTo: 'Underwriter',
          status: 'on-hold' as const,
          description: 'This task checks whether NAICS class, revenue, and operating states fall within the carrier\'s underwriting appetite.',
          onHoldReason: 'Dependent on the Data Completion Check.',
          dependentOn: 'Data Completion Check',
        },
        {
          id: 'task-clearance',
          title: 'Clearance Check',
          type: 'manual' as const,
          assignedTo: 'Underwriter',
          status: 'on-hold' as const,
          description: 'This task checks for duplicate submissions, producer appointment status, and prior declinations within the last 24 months.',
          onHoldReason: 'Dependent on the Data Completion Check.',
          dependentOn: 'Data Completion Check',
        },
      ],

      // Documents
      documents: [
        {
          id: 'doc-1',
          name: 'ACORD 125 + 140 - Commercial Application & Property Section.pdf',
          type: 'ACORD Forms',
          uploadDate: 'May 12, 2026',
          uploadedBy: 'Niki Paoloni',
          size: '3.9 MB',
          pageCount: 30,
          status: 'Classification in Progress' as const,
          extractionRequests: [],
          insights: {
            summary: '',
            keyFindings: [],
            riskFactors: [],
            extractedData: [],
            missingInformation: [],
          },
        },
        {
          id: 'doc-3',
          name: 'ACORD 126 - Commercial General Liability.pdf',
          type: 'ACORD Forms',
          uploadDate: 'May 12, 2026',
          uploadedBy: 'Niki Paoloni',
          size: '1.5 MB',
          pageCount: 9,
          status: 'Classification in Progress' as const,
          extractionRequests: [],
          insights: {
            summary: '',
            keyFindings: [],
            riskFactors: [],
            extractedData: [],
            missingInformation: [],
          },
        },
      ],

      // Email threads
      emails: [
        {
          id: 'email-1',
          from: 'Niki Paoloni',
          fromInitials: 'NP',
          subject: 'New Business Submission - NexGen Biologics Commercial Insurance',
          preview: 'Good morning, I am submitting a new business request for NexGen Biologics Inc. They are seeking...',
          date: '9:30 AM',
          fullDate: 'May 12, 2026',
          unread: false,
          hasAttachment: true,
          to: 'Underwriting Team',
          body: `Good morning,

I am submitting a new business request for NexGen Biologics Inc. They are seeking comprehensive commercial insurance coverage including:

• Commercial Property Insurance
• Commercial General Liability
• Business Auto (8 vehicles)

Key Details:
- Business: Pharmaceutical manufacturing and distribution
- Years in Business: 12 years
- Annual Revenue: $47.2M
- Employees: 285 full-time
- Locations: 3 facilities (California)
- Total Insured Value: $19,526,769

The insured has a clean loss history with only one small property claim in the past 3 years ($12,500). They currently have coverage with another carrier but are looking to consolidate all lines with one carrier for better service and pricing.

Attached please find:
- ACORD 125 + 140 (combined Commercial Application & Property Section)
- ACORD 126 (General Liability Section)

Please let me know if you need any additional information. The client is hoping for indication by end of next week if possible.

Best regards,
Niki Paoloni
Vanguard Insurance Partners
Direct: (555) 234-5678
npaoloni@vanguardins.com`,
          attachments: [
            'ACORD 125 + 140 - Commercial Application & Property Section.pdf',
            'ACORD 126 - Commercial General Liability.pdf',
          ],
        },
      ],

      // Slack messages
      slackMessages: [],

      // Progress path
      progressPath: {
        currentStage: 'draft',
        stages: [
          { key: 'draft', label: 'Draft', status: 'current' },
          { key: 'in-progress', label: 'In Progress', status: 'incomplete' },
          { key: 'processed', label: 'Processed', status: 'incomplete' },
        ],
      },
    },
  },

  // ============================================================================
  // STEP 2: Initial Submission Receipt (continued)
  // ============================================================================
  2: {
    submission: {
      visibleFields: ['id', 'broker', 'totalInsuredValue', 'priority', 'stage', 'assignedTo'],
      fieldsWithValues: ['id', 'stage', 'assignedTo'],

      detailsFieldsWithValues: ['name', 'insuredName', 'dateSubmitted', 'stage', 'assignedTo'],

      showLOBSection: false,
      showSubmissionLines: false,

      activities: [
        {
          id: 'act-2',
          title: 'Partial Extraction',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Agent',
          completedBy: '',
          timestamp: '9:33 PM · May 12',
          status: 'completed' as const,
          warningMessage: 'Unable to classify ACORD 126 - Commercial General Liability.pdf. Manual classification required to continue.',
          agenticSteps: [
            {
              id: 'step-1',
              title: 'Email Analysis',
              status: 'completed' as const,
              timestamp: '9:30 PM',
              details: 'Analyzed email content from Niki Paoloni requesting commercial property and general liability insurance coverage for NexGen Biologics.',
            },
            {
              id: 'step-2',
              title: 'Document Identification',
              status: 'completed' as const,
              timestamp: '9:31 PM',
              details: 'Classified ACORD 125 + 140 - Commercial Application & Property Section.pdf into 2 forms. Unable to classify ACORD 126 - Commercial General Liability.pdf — manual classification required.',
            },
            {
              id: 'step-3',
              title: 'Data Extraction - ACORD 125',
              status: 'completed' as const,
              timestamp: '9:32 PM',
              details: 'Extracted: Business name, Business type, Years in business, Annual revenue, Employee count.',
            },
            {
              id: 'step-4',
              title: 'Data Extraction - ACORD 140',
              status: 'completed' as const,
              timestamp: '9:33 PM',
              details: 'Extracted: Locations, Total insured value, Building construction, Protection class, Sprinkler systems.',
            },
          ],
        },
        {
          id: 'act-1',
          title: 'Submission Email Received',
          description: 'NexGen Biologics Inc New Business · Sent by Niki Paoloni',
          completedBy: '',
          timestamp: '9:30 PM · May 12',
          status: 'completed' as const,
          detailsList: [
            'Sender: Niki Paoloni',
            'Subject: New Business Submission - NexGen Biologics Commercial Insurance',
          ],
        },
      ],

      pendingTasks: [
        {
          id: 'task-data-completion',
          title: 'Data Completion Check',
          type: 'manual' as const,
          assignedTo: 'Underwriter',
          status: 'on-hold' as const,
          description: 'This task checks the availability of values for legal entity, FEIN, business address, NAICS code, and broker contact details.',
          onHoldReason: 'Dependent on the Partial Extraction task.',
          dependentOn: 'Partial Extraction',
        },
        {
          id: 'task-appetite',
          title: 'Appetite Check',
          type: 'manual' as const,
          assignedTo: 'Underwriter',
          status: 'on-hold' as const,
          description: 'This task checks whether NAICS class, revenue, and operating states fall within the carrier\'s underwriting appetite.',
          onHoldReason: 'Dependent on the Data Completion Check.',
          dependentOn: 'Data Completion Check',
        },
        {
          id: 'task-clearance',
          title: 'Clearance Check',
          type: 'manual' as const,
          assignedTo: 'Underwriter',
          status: 'on-hold' as const,
          description: 'This task checks for duplicate submissions, producer appointment status, and prior declinations within the last 24 months.',
          onHoldReason: 'Dependent on the Data Completion Check.',
          dependentOn: 'Data Completion Check',
        },
      ],

      documents: [
        {
          id: 'doc-1',
          name: 'ACORD 125 + 140 - Commercial Application & Property Section.pdf',
          type: 'ACORD Forms',
          uploadDate: 'May 12, 2026',
          uploadedBy: 'Niki Paoloni',
          size: '3.9 MB',
          pageCount: 30,
          status: 'Extraction Complete' as const,
          extractionRequests: [
            { id: 'EXR-1001', type: 'Commercial Application Data Extraction', status: 'Complete', createdAt: '9:31 PM' },
            { id: 'EXR-1002', type: 'Property Schedule Extraction', status: 'Complete', createdAt: '9:31 PM' },
          ],
          insights: {
            summary: 'A combined PDF containing two ACORD forms: ACORD 125 (Commercial Insurance Application) and ACORD 140 (Property Section).',
            keyFindings: [],
            riskFactors: [],
            extractedData: [],
            missingInformation: [],
          },
        },
        {
          id: 'doc-3',
          name: 'ACORD 126 - Commercial General Liability.pdf',
          type: 'ACORD Forms',
          uploadDate: 'May 12, 2026',
          uploadedBy: 'Niki Paoloni',
          size: '1.5 MB',
          pageCount: 9,
          status: 'Unable to Classify' as const,
          extractionRequests: [],
          insights: {
            summary: '',
            keyFindings: [],
            riskFactors: [],
            extractedData: [],
            missingInformation: [],
          },
        },
      ],

      emails: [
        {
          id: 'email-1',
          from: 'Niki Paoloni',
          fromInitials: 'NP',
          subject: 'New Business Submission - NexGen Biologics Commercial Insurance',
          preview: 'Good morning, I am submitting a new business request for NexGen Biologics Inc. They are seeking...',
          date: '9:30 AM',
          fullDate: 'May 12, 2026',
          unread: false,
          hasAttachment: true,
          to: 'Underwriting Team',
          body: `Good morning,

I am submitting a new business request for NexGen Biologics Inc. They are seeking comprehensive commercial insurance coverage including:

• Commercial Property Insurance
• Commercial General Liability
• Business Auto (8 vehicles)

Key Details:
- Business: Pharmaceutical manufacturing and distribution
- Years in Business: 12 years
- Annual Revenue: $47.2M
- Employees: 285 full-time
- Locations: 3 facilities (California)
- Total Insured Value: $19,526,769

The insured has a clean loss history with only one small property claim in the past 3 years ($12,500). They currently have coverage with another carrier but are looking to consolidate all lines with one carrier for better service and pricing.

Attached please find:
- ACORD 125 + 140 (combined Commercial Application & Property Section)
- ACORD 126 (General Liability Section)

Please let me know if you need any additional information. The client is hoping for indication by end of next week if possible.

Best regards,
Niki Paoloni
Vanguard Insurance Partners
Direct: (555) 234-5678
npaoloni@vanguardins.com`,
          attachments: [
            'ACORD 125 + 140 - Commercial Application & Property Section.pdf',
            'ACORD 126 - Commercial General Liability.pdf',
          ],
        },
      ],

      slackMessages: [],

      progressPath: {
        currentStage: 'draft',
        stages: [
          { key: 'draft', label: 'Draft', status: 'current' },
          { key: 'in-progress', label: 'In Progress', status: 'incomplete' },
          { key: 'processed', label: 'Processed', status: 'incomplete' },
        ],
      },
    },
  },

  // ============================================================================
  // STEP 3: Manual Classification Complete — Re-running Extraction on ACORD 126
  // ============================================================================
  3: {
    submission: {
      visibleFields: ['id', 'broker', 'totalInsuredValue', 'priority', 'stage', 'assignedTo'],
      fieldsWithValues: ['id', 'stage', 'assignedTo'],

      detailsFieldsWithValues: ['name', 'insuredName', 'dateSubmitted', 'stage', 'assignedTo'],

      showLOBSection: false,
      showSubmissionLines: false,

      activities: [
        {
          id: 'act-classify-doc',
          title: 'Classify Document',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Martha (UW Team Lead)',
          completedBy: '',
          timestamp: '9:38 PM · May 12',
          status: 'completed' as const,
          detailsList: [
            'Document: ACORD 126 - Commercial General Liability.pdf',
            'Pages 1-9 → ACORD · ACORD 126',
            'Status: Classification confirmed — extraction request created',
          ],
        },
        {
          id: 'act-2',
          title: 'Partial Extraction',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Agent',
          completedBy: '',
          timestamp: '9:33 PM · May 12',
          status: 'completed' as const,
          agenticSteps: [
            {
              id: 'step-1',
              title: 'Email Analysis',
              status: 'completed' as const,
              timestamp: '9:30 PM',
              details: 'Analyzed email content from Niki Paoloni requesting commercial property and general liability insurance coverage for NexGen Biologics.',
            },
            {
              id: 'step-2',
              title: 'Document Identification',
              status: 'completed' as const,
              timestamp: '9:31 PM',
              details: 'Classified ACORD 125 + 140 - Commercial Application & Property Section.pdf into 2 forms. Unable to classify ACORD 126 - Commercial General Liability.pdf — manual classification required.',
            },
            {
              id: 'step-3',
              title: 'Data Extraction - ACORD 125',
              status: 'completed' as const,
              timestamp: '9:32 PM',
              details: 'Extracted: Business name, Business type, Years in business, Annual revenue, Employee count.',
            },
            {
              id: 'step-4',
              title: 'Data Extraction - ACORD 140',
              status: 'completed' as const,
              timestamp: '9:33 PM',
              details: 'Extracted: Locations, Total insured value, Building construction, Protection class, Sprinkler systems.',
            },
          ],
        },
        {
          id: 'act-1',
          title: 'Submission Email Received',
          description: 'NexGen Biologics Inc New Business · Sent by Niki Paoloni',
          completedBy: '',
          timestamp: '9:30 PM · May 12',
          status: 'completed' as const,
          detailsList: [
            'Sender: Niki Paoloni',
            'Subject: New Business Submission - NexGen Biologics Commercial Insurance',
          ],
        },
      ],

      pendingTasks: [
        {
          id: 'task-partial-extraction-126',
          title: 'Partial Extraction',
          type: 'agentic' as const,
          assignedTo: 'Agent',
          agentName: 'Extraction Agent',
          status: 'in-progress' as const,
          description: 'Re-running extraction on ACORD 126 - Commercial General Liability.pdf now that the document has been manually classified. Pulling coverage limits, operations classification, and prior claims history into the submission record.',
          agentSteps: [
            {
              id: 'step-1',
              title: 'Read Manual Classification',
              status: 'completed' as const,
              timestamp: '9:38 PM',
              description: 'Loaded the manual classification — pages 1-9 of ACORD 126 - Commercial General Liability.pdf identified as ACORD 126.',
            },
            {
              id: 'step-2',
              title: 'Create Extraction Request',
              status: 'completed' as const,
              timestamp: '9:38 PM',
              description: 'Created extraction request EXR-1003 (General Liability Data Extraction) against ACORD 126 - Commercial General Liability.pdf.',
            },
            {
              id: 'step-3',
              title: 'Data Extraction - ACORD 126',
              status: 'in-progress' as const,
              timestamp: '9:39 PM',
              description: 'Extracting from ACORD 126 - Commercial General Liability.pdf: Coverage limits, Operations classification, Prior claims history.',
            },
            {
              id: 'step-4',
              title: 'Submission Record Update',
              status: 'pending' as const,
              description: 'Merging the extracted general liability fields into the submission record alongside the existing ACORD 125 and ACORD 140 data.',
            },
          ],
        },
        {
          id: 'task-data-completion',
          title: 'Data Completion Check',
          type: 'manual' as const,
          assignedTo: 'Underwriter',
          status: 'on-hold' as const,
          description: 'This task checks the availability of values for legal entity, FEIN, business address, NAICS code, and broker contact details.',
          onHoldReason: 'Dependent on the Partial Extraction task.',
          dependentOn: 'Partial Extraction',
        },
        {
          id: 'task-appetite',
          title: 'Appetite Check',
          type: 'manual' as const,
          assignedTo: 'Underwriter',
          status: 'on-hold' as const,
          description: 'This task checks whether NAICS class, revenue, and operating states fall within the carrier\'s underwriting appetite.',
          onHoldReason: 'Dependent on the Data Completion Check.',
          dependentOn: 'Data Completion Check',
        },
        {
          id: 'task-clearance',
          title: 'Clearance Check',
          type: 'manual' as const,
          assignedTo: 'Underwriter',
          status: 'on-hold' as const,
          description: 'This task checks for duplicate submissions, producer appointment status, and prior declinations within the last 24 months.',
          onHoldReason: 'Dependent on the Data Completion Check.',
          dependentOn: 'Data Completion Check',
        },
      ],

      documents: [
        {
          id: 'doc-1',
          name: 'ACORD 125 + 140 - Commercial Application & Property Section.pdf',
          type: 'ACORD Forms',
          uploadDate: 'May 12, 2026',
          uploadedBy: 'Niki Paoloni',
          size: '3.9 MB',
          pageCount: 30,
          status: 'Extraction Complete' as const,
          extractionRequests: [
            { id: 'EXR-1001', type: 'Commercial Application Data Extraction', status: 'Complete', createdAt: '9:31 PM' },
            { id: 'EXR-1002', type: 'Property Schedule Extraction', status: 'Complete', createdAt: '9:31 PM' },
          ],
          insights: {
            summary: 'A combined PDF containing two ACORD forms: ACORD 125 (Commercial Insurance Application) and ACORD 140 (Property Section).',
            keyFindings: [],
            riskFactors: [],
            extractedData: [],
            missingInformation: [],
          },
        },
        {
          id: 'doc-3',
          name: 'ACORD 126 - Commercial General Liability.pdf',
          type: 'ACORD Forms',
          uploadDate: 'May 12, 2026',
          uploadedBy: 'Niki Paoloni',
          size: '1.5 MB',
          pageCount: 9,
          status: 'Extraction in Progress' as const,
          extractionRequests: [
            { id: 'EXR-1003', type: 'General Liability Data Extraction', status: 'In Progress', createdAt: '9:38 PM' },
          ],
          insights: {
            summary: 'ACORD 126 — Commercial General Liability section of the new business submission.',
            keyFindings: [],
            riskFactors: [],
            extractedData: [],
            missingInformation: [],
          },
        },
      ],

      emails: [
        {
          id: 'email-1',
          from: 'Niki Paoloni',
          fromInitials: 'NP',
          subject: 'New Business Submission - NexGen Biologics Commercial Insurance',
          preview: 'Good morning, I am submitting a new business request for NexGen Biologics Inc. They are seeking...',
          date: '9:30 AM',
          fullDate: 'May 12, 2026',
          unread: false,
          hasAttachment: true,
          to: 'Underwriting Team',
          body: `Good morning,

I am submitting a new business request for NexGen Biologics Inc. They are seeking comprehensive commercial insurance coverage including:

• Commercial Property Insurance
• Commercial General Liability
• Business Auto (8 vehicles)

Key Details:
- Business: Pharmaceutical manufacturing and distribution
- Years in Business: 12 years
- Annual Revenue: $47.2M
- Employees: 285 full-time
- Locations: 3 facilities (California)
- Total Insured Value: $19,526,769

The insured has a clean loss history with only one small property claim in the past 3 years ($12,500). They currently have coverage with another carrier but are looking to consolidate all lines with one carrier for better service and pricing.

Attached please find:
- ACORD 125 + 140 (combined Commercial Application & Property Section)
- ACORD 126 (General Liability Section)

Please let me know if you need any additional information. The client is hoping for indication by end of next week if possible.

Best regards,
Niki Paoloni
Vanguard Insurance Partners
Direct: (555) 234-5678
npaoloni@vanguardins.com`,
          attachments: [
            'ACORD 125 + 140 - Commercial Application & Property Section.pdf',
            'ACORD 126 - Commercial General Liability.pdf',
          ],
        },
      ],

      slackMessages: [],

      progressPath: {
        currentStage: 'draft',
        stages: [
          { key: 'draft', label: 'Draft', status: 'current' },
          { key: 'in-progress', label: 'In Progress', status: 'incomplete' },
          { key: 'processed', label: 'Processed', status: 'incomplete' },
        ],
      },
    },
  },

  // ============================================================================
  // STEP 4: Qualifying Checks In Progress
  // ============================================================================
  4: {
    submission: {
      // Header fields visibility
      visibleFields: ['id', 'broker', 'totalInsuredValue', 'priority', 'stage', 'assignedTo'],
      fieldsWithValues: ['id', 'broker', 'totalInsuredValue', 'stage', 'assignedTo'],

      // Details tab field visibility - only fields required by Data Completion / Appetite / Clearance checks
      detailsFieldsWithValues: [
        'name',           // submission name (baseline)
        'insuredName',    // legal entity name (Data Completion)
        'dateSubmitted',  // baseline
        'stage',          // baseline
        'assignedTo',     // owner of qualifying checks
        'effectiveDate',  // Clearance: duplicate submission check
        'insuredState',   // Appetite: geography
        'broker',         // Data Completion + Clearance: broker info & authorization
        'brokerEmail',    // Data Completion: broker contact
        'brokerPhone',    // Data Completion: broker contact
        'totalInsuredValue', // available from extraction
      ],

      // Section visibility
      showLOBSection: false,
      showSubmissionLines: false,

      // Activities - latest at top. Reflects the full history through Step 3:
      //   Submission Email → first Partial Extraction (125+140 done, 126 unable to classify) →
      //   Classify Document (manual) → second Partial Extraction (126 now extracted).
      activities: [
        {
          id: 'act-partial-extraction-126',
          title: 'Partial Extraction',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Agent',
          completedBy: '',
          timestamp: '9:40 PM · May 12',
          status: 'completed' as const,
          agenticSteps: [
            {
              id: 'step-1',
              title: 'Read Manual Classification',
              status: 'completed' as const,
              timestamp: '9:38 PM',
              details: 'Loaded the manual classification — pages 1-9 of ACORD 126 - Commercial General Liability.pdf identified as ACORD 126.',
            },
            {
              id: 'step-2',
              title: 'Create Extraction Request',
              status: 'completed' as const,
              timestamp: '9:38 PM',
              details: 'Created extraction request EXR-1003 (General Liability Data Extraction) against ACORD 126 - Commercial General Liability.pdf.',
            },
            {
              id: 'step-3',
              title: 'Data Extraction - ACORD 126',
              status: 'completed' as const,
              timestamp: '9:39 PM',
              details: 'Extracted: Coverage limits, Operations classification, Prior claims history.',
            },
            {
              id: 'step-4',
              title: 'Submission Record Update',
              status: 'completed' as const,
              timestamp: '9:40 PM',
              details: 'Merged the extracted general liability fields into the submission record alongside the existing ACORD 125 and ACORD 140 data.',
            },
          ],
        },
        {
          id: 'act-classify-doc',
          title: 'Classify Document',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Martha (UW Team Lead)',
          completedBy: '',
          timestamp: '9:38 PM · May 12',
          status: 'completed' as const,
          detailsList: [
            'Document: ACORD 126 - Commercial General Liability.pdf',
            'Pages 1-9 → ACORD · ACORD 126',
            'Status: Classification confirmed — extraction request created',
          ],
        },
        {
          id: 'act-2',
          title: 'Partial Extraction',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Agent',
          completedBy: '',
          timestamp: '9:33 PM · May 12',
          status: 'completed' as const,
          agenticSteps: [
            {
              id: 'step-1',
              title: 'Email Analysis',
              status: 'completed' as const,
              timestamp: '9:30 PM',
              details: 'Analyzed email content from Niki Paoloni requesting commercial property and general liability insurance coverage for NexGen Biologics.',
            },
            {
              id: 'step-2',
              title: 'Document Identification',
              status: 'completed' as const,
              timestamp: '9:31 PM',
              details: 'Classified ACORD 125 + 140 - Commercial Application & Property Section.pdf into 2 forms. Unable to classify ACORD 126 - Commercial General Liability.pdf — manual classification required.',
            },
            {
              id: 'step-3',
              title: 'Data Extraction - ACORD 125',
              status: 'completed' as const,
              timestamp: '9:32 PM',
              details: 'Extracted: Business name, Business type, Years in business, Annual revenue, Employee count.',
            },
            {
              id: 'step-4',
              title: 'Data Extraction - ACORD 140',
              status: 'completed' as const,
              timestamp: '9:33 PM',
              details: 'Extracted: Locations, Total insured value, Building construction, Protection class, Sprinkler systems.',
            },
          ],
        },
        {
          id: 'act-1',
          title: 'Submission Email Received',
          description: 'NexGen Biologics Inc New Business · Sent by Niki Paoloni',
          completedBy: '',
          timestamp: '9:30 PM · May 12',
          status: 'completed' as const,
          detailsList: [
            'Sender: Niki Paoloni',
            'Subject: New Business Submission - NexGen Biologics Commercial Insurance',
          ],
        },
      ],

      // Pending Tasks - Data Completion in progress; Appetite & Clearance on hold
      pendingTasks: [
        {
          id: 'task-data-completion',
          title: 'Data Completion Check',
          type: 'manual' as const,
          assignedTo: 'Underwriter',
          status: 'in-progress' as const,
          description: 'This task checks the availability of values for legal entity, FEIN, business address, NAICS code, and broker contact details.',
          dependentOn: 'Partial Extraction',
        },
        {
          id: 'task-appetite',
          title: 'Appetite Check',
          type: 'manual' as const,
          assignedTo: 'Underwriter',
          status: 'on-hold' as const,
          description: 'This task checks whether NAICS class, revenue, and operating states fall within the carrier\'s underwriting appetite.',
          onHoldReason: 'Dependent on the Data Completion Check.',
          dependentOn: 'Data Completion Check',
        },
        {
          id: 'task-clearance',
          title: 'Clearance Check',
          type: 'manual' as const,
          assignedTo: 'Underwriter',
          status: 'on-hold' as const,
          description: 'This task checks for duplicate submissions, producer appointment status, and prior declinations within the last 24 months.',
          onHoldReason: 'Dependent on the Data Completion Check.',
          dependentOn: 'Data Completion Check',
        },
      ],

      // Documents
      documents: [
        {
          id: 'doc-1',
          name: 'ACORD 125 + 140 - Commercial Application & Property Section.pdf',
          type: 'ACORD Forms',
          uploadDate: 'May 12, 2026',
          uploadedBy: 'Niki Paoloni',
          size: '3.9 MB',
          pageCount: 30,
          status: 'Extraction Complete' as const,
          extractionRequests: [
            { id: 'EXR-1001', type: 'Commercial Application Data Extraction', status: 'Complete', createdAt: '9:31 PM' },
            { id: 'EXR-1002', type: 'Property Schedule Extraction', status: 'Complete', createdAt: '9:31 PM' },
          ],
          insights: {
            summary: 'A combined PDF containing two ACORD forms: ACORD 125 (Commercial Insurance Application) and ACORD 140 (Property Section).',
            keyFindings: [
              'Business Name: NexGen Biologics Inc',
              'NAICS Code: 325412 (Pharmaceutical Preparation Manufacturing)',
              'Years in Business: 12',
              'Annual Revenue: $47.2M',
              'Employee Count: 285 full-time',
              'Coverage Requested: Property, General Liability, Business Auto',
              '3 property locations identified — all in California',
              'Total Insured Value: $19,526,769',
              'Construction: Fire Resistive (all locations)',
              'Protection Class: 3',
              'Sprinkler systems: Yes — all locations',
              'Central station alarm monitoring: Yes',
            ],
            riskFactors: [],
            extractedData: [
              { field: 'Legal Entity', value: 'NexGen Biologics Inc' },
              { field: 'FEIN', value: '47-3829104' },
              { field: 'Business Address', value: '2400 Innovation Way, San Jose, CA 95134' },
              { field: 'Effective Date', value: '06/01/2026' },
              { field: 'Location 1 — Main Facility', value: 'San Jose, CA — $14.2M TIV' },
              { field: 'Location 2 — Distribution Center', value: 'Hayward, CA — $3.8M TIV' },
              { field: 'Location 3 — Office', value: 'San Jose, CA — $1.5M TIV' },
              { field: 'Valuation Basis', value: 'Replacement Cost' },
            ],
            missingInformation: [],
          },
        },
        {
          id: 'doc-3',
          name: 'ACORD 126 - Commercial General Liability.pdf',
          type: 'ACORD Forms',
          uploadDate: 'May 12, 2026',
          uploadedBy: 'Niki Paoloni',
          size: '1.5 MB',
          pageCount: 9,
          status: 'Extraction Complete' as const,
          extractionRequests: [
            { id: 'EXR-1003', type: 'General Liability Data Extraction', status: 'Complete', createdAt: '9:31 PM' },
          ],
          insights: {
            summary: 'ACORD 126 — Commercial General Liability section of the new business submission.',
            keyFindings: [
              'Per-Occurrence Limit Requested: $1,000,000',
              'General Aggregate Limit Requested: $2,000,000',
              'Operations Classification: Pharmaceutical Manufacturing',
              'Products/Completed Operations: Included',
              'Prior GL Claims: 2 in past 3 years ($34,800 total)',
            ],
            riskFactors: [],
            extractedData: [
              { field: 'GL Class Code', value: '50714 — Drug, Medicine, or Pharmaceutical Mfg.' },
              { field: 'Deductible', value: '$5,000 per occurrence' },
              { field: 'Retroactive Date', value: 'None — Occurrence form' },
            ],
            missingInformation: [],
          },
        },
      ],

      // Email threads
      emails: [
        {
          id: 'email-1',
          from: 'Niki Paoloni',
          fromInitials: 'NP',
          subject: 'New Business Submission - NexGen Biologics Commercial Insurance',
          preview: 'Good morning, I am submitting a new business request for NexGen Biologics Inc. They are seeking...',
          date: '9:30 AM',
          fullDate: 'May 12, 2026',
          unread: false,
          hasAttachment: true,
          to: 'Underwriting Team',
          body: `Good morning,

I am submitting a new business request for NexGen Biologics Inc. They are seeking comprehensive commercial insurance coverage including:

• Commercial Property Insurance
• Commercial General Liability
• Business Auto (8 vehicles)

Key Details:
- Business: Pharmaceutical manufacturing and distribution
- Years in Business: 12 years
- Annual Revenue: $47.2M
- Employees: 285 full-time
- Locations: 3 facilities (California)
- Total Insured Value: $19,526,769

The insured has a clean loss history with only one small property claim in the past 3 years ($12,500). They currently have coverage with another carrier but are looking to consolidate all lines with one carrier for better service and pricing.

Attached please find:
- ACORD 125 + 140 (combined Commercial Application & Property Section)
- ACORD 126 (General Liability Section)

Please let me know if you need any additional information. The client is hoping for indication by end of next week if possible.

Best regards,
Niki Paoloni
Vanguard Insurance Partners
Direct: (555) 234-5678
npaoloni@vanguardins.com`,
          attachments: [
            'ACORD 125 + 140 - Commercial Application & Property Section.pdf',
            'ACORD 126 - Commercial General Liability.pdf',
          ],
        },
      ],

      // Slack messages
      slackMessages: [],

      // Progress path
      progressPath: {
        currentStage: 'draft',
        stages: [
          { key: 'draft', label: 'Draft', status: 'current' },
          { key: 'in-progress', label: 'In Progress', status: 'incomplete' },
          { key: 'processed', label: 'Processed', status: 'incomplete' },
        ],
      },
    },
  },

  // ============================================================================
  // STEP 5: Qualifying Checks Complete — Awaiting Broker Information
  // ============================================================================
  5: {
    submission: {
      // Header fields visibility
      visibleFields: ['id', 'broker', 'totalInsuredValue', 'priority', 'stage', 'assignedTo'],
      fieldsWithValues: ['id', 'broker', 'totalInsuredValue', 'stage', 'assignedTo'],

      // Details tab field visibility
      detailsFieldsWithValues: [
        'name',
        'insuredName',
        'dateSubmitted',
        'stage',
        'assignedTo',
        'effectiveDate',
        'insuredState',
        'broker',
        'brokerEmail',
        'brokerPhone',
        'totalInsuredValue',
      ],

      // Section visibility
      showLOBSection: false,
      showSubmissionLines: false,

      // Activities - Data Completion Check just finished with a FEIN warning;
      // history below it carries forward from Steps 1-4.
      activities: [
        {
          id: 'act-data-completion',
          title: 'Data Completion Check',
          description: 'NexGen Biologics Inc New Business · Dependent Task · Completed by Martha (UW Team Lead)',
          completedBy: '',
          timestamp: '10:02 PM · May 12',
          status: 'completed' as const,
          dependentOn: 'Partial Extraction',
          warningMessage: 'FEIN not available on the submission. Broker follow-up required before Appetite and Clearance checks can proceed.',
          detailsList: [
            'Legal entity: NexGen Biologics Inc — Confirmed',
            'Business address: 2400 Innovation Way, San Jose, CA 95134 — Confirmed',
            'NAICS code: 325412 (Pharmaceutical Preparation Manufacturing) — Confirmed',
            'Producer: Niki Paoloni, Vanguard Insurance Partners — Confirmed',
            'FEIN: Not available — required to continue',
            'Status: Incomplete — broker follow-up required',
          ],
        },
        {
          id: 'act-partial-extraction-126',
          title: 'Partial Extraction',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Agent',
          completedBy: '',
          timestamp: '9:40 PM · May 12',
          status: 'completed' as const,
          agenticSteps: [
            {
              id: 'step-1',
              title: 'Read Manual Classification',
              status: 'completed' as const,
              timestamp: '9:38 PM',
              details: 'Loaded the manual classification — pages 1-9 of ACORD 126 - Commercial General Liability.pdf identified as ACORD 126.',
            },
            {
              id: 'step-2',
              title: 'Create Extraction Request',
              status: 'completed' as const,
              timestamp: '9:38 PM',
              details: 'Created extraction request EXR-1003 (General Liability Data Extraction) against ACORD 126 - Commercial General Liability.pdf.',
            },
            {
              id: 'step-3',
              title: 'Data Extraction - ACORD 126',
              status: 'completed' as const,
              timestamp: '9:39 PM',
              details: 'Extracted: Coverage limits, Operations classification, Prior claims history.',
            },
            {
              id: 'step-4',
              title: 'Submission Record Update',
              status: 'completed' as const,
              timestamp: '9:40 PM',
              details: 'Merged the extracted general liability fields into the submission record alongside the existing ACORD 125 and ACORD 140 data.',
            },
          ],
        },
        {
          id: 'act-classify-doc',
          title: 'Classify Document',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Martha (UW Team Lead)',
          completedBy: '',
          timestamp: '9:38 PM · May 12',
          status: 'completed' as const,
          detailsList: [
            'Document: ACORD 126 - Commercial General Liability.pdf',
            'Pages 1-9 → ACORD · ACORD 126',
            'Status: Classification confirmed — extraction request created',
          ],
        },
        {
          id: 'act-2',
          title: 'Partial Extraction',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Agent',
          completedBy: '',
          timestamp: '9:33 PM · May 12',
          status: 'completed' as const,
          agenticSteps: [
            {
              id: 'step-1',
              title: 'Email Analysis',
              status: 'completed' as const,
              timestamp: '9:30 PM',
              details: 'Analyzed email content from Niki Paoloni requesting commercial property and general liability insurance coverage for NexGen Biologics.',
            },
            {
              id: 'step-2',
              title: 'Document Identification',
              status: 'completed' as const,
              timestamp: '9:31 PM',
              details: 'Classified ACORD 125 + 140 - Commercial Application & Property Section.pdf into 2 forms. Unable to classify ACORD 126 - Commercial General Liability.pdf — manual classification required.',
            },
            {
              id: 'step-3',
              title: 'Data Extraction - ACORD 125',
              status: 'completed' as const,
              timestamp: '9:32 PM',
              details: 'Extracted: Business name, Business type, Years in business, Annual revenue, Employee count.',
            },
            {
              id: 'step-4',
              title: 'Data Extraction - ACORD 140',
              status: 'completed' as const,
              timestamp: '9:33 PM',
              details: 'Extracted: Locations, Total insured value, Building construction, Protection class, Sprinkler systems.',
            },
          ],
        },
        {
          id: 'act-1',
          title: 'Submission Email Received',
          description: 'NexGen Biologics Inc New Business · Sent by Niki Paoloni',
          completedBy: '',
          timestamp: '9:30 PM · May 12',
          status: 'completed' as const,
          detailsList: [
            'Sender: Niki Paoloni',
            'Subject: New Business Submission - NexGen Biologics Commercial Insurance',
          ],
        },
      ],

      // Pending Tasks - Get info from broker (pending broker response, FEIN request) +
      // Appetite & Clearance still on hold pending broker response.
      pendingTasks: [
        {
          id: 'task-broker-info',
          title: 'Get Information from Broker',
          type: 'manual' as const,
          assignedTo: 'Underwriter',
          status: 'pending' as const,
          hasDraftEmail: true,
          description: 'Data Completion Check flagged the FEIN as unavailable. Reach out to Niki Paoloni at Vanguard Insurance Partners to obtain the FEIN for NexGen Biologics Inc so the qualifying checks can continue.',
          onHoldReason: 'Awaiting broker response to FEIN request.',
        },
        {
          id: 'task-appetite',
          title: 'Appetite Check',
          type: 'manual' as const,
          assignedTo: 'Underwriter',
          status: 'on-hold' as const,
          description: 'This task checks whether NAICS class, revenue, and operating states fall within the carrier\'s underwriting appetite.',
          onHoldReason: 'Dependent on the Data Completion Check.',
          dependentOn: 'Data Completion Check',
        },
        {
          id: 'task-clearance',
          title: 'Clearance Check',
          type: 'manual' as const,
          assignedTo: 'Underwriter',
          status: 'on-hold' as const,
          description: 'This task checks for duplicate submissions, producer appointment status, and prior declinations within the last 24 months.',
          onHoldReason: 'Dependent on the Data Completion Check.',
          dependentOn: 'Data Completion Check',
        },
      ],

      // Documents — same as Step 2, all extraction complete
      documents: [
        {
          id: 'doc-1',
          name: 'ACORD 125 + 140 - Commercial Application & Property Section.pdf',
          type: 'ACORD Forms',
          uploadDate: 'May 12, 2026',
          uploadedBy: 'Niki Paoloni',
          size: '3.9 MB',
          pageCount: 30,
          status: 'Extraction Complete' as const,
          extractionRequests: [
            { id: 'EXR-1001', type: 'Commercial Application Data Extraction', status: 'Complete', createdAt: '9:31 PM' },
            { id: 'EXR-1002', type: 'Property Schedule Extraction', status: 'Complete', createdAt: '9:31 PM' },
          ],
          insights: {
            summary: 'A combined PDF containing two ACORD forms: ACORD 125 (Commercial Insurance Application) and ACORD 140 (Property Section).',
            keyFindings: [
              'Business Name: NexGen Biologics Inc',
              'NAICS Code: 325412 (Pharmaceutical Preparation Manufacturing)',
              'Years in Business: 12',
              'Annual Revenue: $47.2M',
              'Employee Count: 285 full-time',
              'Coverage Requested: Property, General Liability, Business Auto',
              '3 property locations identified — all in California',
              'Total Insured Value: $19,526,769',
              'Construction: Fire Resistive (all locations)',
              'Protection Class: 3',
              'Sprinkler systems: Yes — all locations',
              'Central station alarm monitoring: Yes',
            ],
            riskFactors: [],
            extractedData: [
              { field: 'Legal Entity', value: 'NexGen Biologics Inc' },
              { field: 'FEIN', value: '47-3829104' },
              { field: 'Business Address', value: '2400 Innovation Way, San Jose, CA 95134' },
              { field: 'Effective Date', value: '06/01/2026' },
              { field: 'Location 1 — Main Facility', value: 'San Jose, CA — $14.2M TIV' },
              { field: 'Location 2 — Distribution Center', value: 'Hayward, CA — $3.8M TIV' },
              { field: 'Location 3 — Office', value: 'San Jose, CA — $1.5M TIV' },
              { field: 'Valuation Basis', value: 'Replacement Cost' },
            ],
            missingInformation: [],
          },
        },
        {
          id: 'doc-3',
          name: 'ACORD 126 - Commercial General Liability.pdf',
          type: 'ACORD Forms',
          uploadDate: 'May 12, 2026',
          uploadedBy: 'Niki Paoloni',
          size: '1.5 MB',
          pageCount: 9,
          status: 'Extraction Complete' as const,
          extractionRequests: [
            { id: 'EXR-1003', type: 'General Liability Data Extraction', status: 'Complete', createdAt: '9:31 PM' },
          ],
          insights: {
            summary: 'ACORD 126 — Commercial General Liability section of the new business submission.',
            keyFindings: [
              'Per-Occurrence Limit Requested: $1,000,000',
              'General Aggregate Limit Requested: $2,000,000',
              'Operations Classification: Pharmaceutical Manufacturing',
              'Products/Completed Operations: Included',
              'Prior GL Claims: 2 in past 3 years ($34,800 total)',
            ],
            riskFactors: [],
            extractedData: [
              { field: 'GL Class Code', value: '50714 — Drug, Medicine, or Pharmaceutical Mfg.' },
              { field: 'Deductible', value: '$5,000 per occurrence' },
              { field: 'Retroactive Date', value: 'None — Occurrence form' },
            ],
            missingInformation: [],
          },
        },
      ],

      // Email threads
      emails: [
        {
          id: 'email-1',
          from: 'Niki Paoloni',
          fromInitials: 'NP',
          subject: 'New Business Submission - NexGen Biologics Commercial Insurance',
          preview: 'Good morning, I am submitting a new business request for NexGen Biologics Inc. They are seeking...',
          date: '9:30 AM',
          fullDate: 'May 12, 2026',
          unread: false,
          hasAttachment: true,
          to: 'Underwriting Team',
          body: `Good morning,

I am submitting a new business request for NexGen Biologics Inc. They are seeking comprehensive commercial insurance coverage including:

• Commercial Property Insurance
• Commercial General Liability
• Business Auto (8 vehicles)

Key Details:
- Business: Pharmaceutical manufacturing and distribution
- Years in Business: 12 years
- Annual Revenue: $47.2M
- Employees: 285 full-time
- Locations: 3 facilities (California)
- Total Insured Value: $19,526,769

The insured has a clean loss history with only one small property claim in the past 3 years ($12,500). They currently have coverage with another carrier but are looking to consolidate all lines with one carrier for better service and pricing.

Attached please find:
- ACORD 125 + 140 (combined Commercial Application & Property Section)
- ACORD 126 (General Liability Section)

Please let me know if you need any additional information. The client is hoping for indication by end of next week if possible.

Best regards,
Niki Paoloni
Vanguard Insurance Partners
Direct: (555) 234-5678
npaoloni@vanguardins.com`,
          attachments: [
            'ACORD 125 + 140 - Commercial Application & Property Section.pdf',
            'ACORD 126 - Commercial General Liability.pdf',
          ],
        },
      ],

      // Slack messages
      slackMessages: [],

      // Progress path - same as Step 2 (Draft current)
      progressPath: {
        currentStage: 'draft',
        stages: [
          { key: 'draft', label: 'Draft', status: 'current' },
          { key: 'in-progress', label: 'In Progress', status: 'incomplete' },
          { key: 'processed', label: 'Processed', status: 'incomplete' },
        ],
      },
    },
  },

  // ============================================================================
  // STEP 6: Broker Reply Received — FEIN Confirmed
  // ============================================================================
  6: {
    submission: {
      // Header fields visibility
      visibleFields: ['id', 'broker', 'totalInsuredValue', 'priority', 'stage', 'assignedTo'],
      fieldsWithValues: ['id', 'broker', 'totalInsuredValue', 'stage', 'assignedTo'],

      // Details tab field visibility
      detailsFieldsWithValues: [
        'name',
        'insuredName',
        'dateSubmitted',
        'stage',
        'assignedTo',
        'effectiveDate',
        'insuredState',
        'broker',
        'brokerEmail',
        'brokerPhone',
        'totalInsuredValue',
      ],

      // Section visibility
      showLOBSection: false,
      showSubmissionLines: false,

      // Activities - latest at top. Email sent (FEIN request) and the broker
      // reply (FEIN provided) are now their own activity log entries.
      activities: [
        {
          id: 'act-email-received',
          title: 'Email Received from Broker',
          description: 'NexGen Biologics Inc New Business · Inbound Email · From Niki Paoloni',
          completedBy: '',
          timestamp: '8:38 AM · May 13',
          status: 'completed' as const,
          detailsList: [
            'From: Niki Paoloni <npaoloni@vanguardins.com>',
            'To: Martha Reyes <mreyes@nexus-uw.com>',
            'Subject: Re: FEIN Needed — NexGen Biologics Inc',
            'Received: May 13, 2026 at 8:38 AM',
            'FEIN provided: 47-3829104',
            'Attachments: None',
            'Status: Reply received — Partial Extraction parsing now',
          ],
        },
        {
          id: 'act-email-sent',
          title: 'Email Sent to Broker',
          description: 'NexGen Biologics Inc New Business · Outbound Email · Sent by Martha (UW Team Lead)',
          completedBy: '',
          timestamp: '10:32 PM · May 12',
          status: 'completed' as const,
          detailsList: [
            'From: Martha Reyes <mreyes@nexus-uw.com>',
            'To: Niki Paoloni <npaoloni@vanguardins.com>',
            'Subject: FEIN Needed — NexGen Biologics Inc',
            'Sent: May 12, 2026 at 10:32 PM',
            'Request: FEIN for NexGen Biologics Inc to complete the Data Completion Check',
            'Attachments: None',
          ],
        },
        {
          id: 'act-data-completion',
          title: 'Data Completion Check',
          description: 'NexGen Biologics Inc New Business · Dependent Task · Completed by Martha (UW Team Lead)',
          completedBy: '',
          timestamp: '10:02 PM · May 12',
          status: 'completed' as const,
          dependentOn: 'Partial Extraction',
          warningMessage: 'FEIN not available on the submission. Broker follow-up required before Appetite and Clearance checks can proceed.',
          detailsList: [
            'Legal entity: NexGen Biologics Inc — Confirmed',
            'Business address: 2400 Innovation Way, San Jose, CA 95134 — Confirmed',
            'NAICS code: 325412 (Pharmaceutical Preparation Manufacturing) — Confirmed',
            'Producer: Niki Paoloni, Vanguard Insurance Partners — Confirmed',
            'FEIN: Not available — required to continue',
            'Status: Incomplete — broker follow-up required',
          ],
        },
        {
          id: 'act-partial-extraction-126',
          title: 'Partial Extraction',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Agent',
          completedBy: '',
          timestamp: '9:40 PM · May 12',
          status: 'completed' as const,
          agenticSteps: [
            {
              id: 'step-1',
              title: 'Read Manual Classification',
              status: 'completed' as const,
              timestamp: '9:38 PM',
              details: 'Loaded the manual classification — pages 1-9 of ACORD 126 - Commercial General Liability.pdf identified as ACORD 126.',
            },
            {
              id: 'step-2',
              title: 'Create Extraction Request',
              status: 'completed' as const,
              timestamp: '9:38 PM',
              details: 'Created extraction request EXR-1003 (General Liability Data Extraction) against ACORD 126 - Commercial General Liability.pdf.',
            },
            {
              id: 'step-3',
              title: 'Data Extraction - ACORD 126',
              status: 'completed' as const,
              timestamp: '9:39 PM',
              details: 'Extracted: Coverage limits, Operations classification, Prior claims history.',
            },
            {
              id: 'step-4',
              title: 'Submission Record Update',
              status: 'completed' as const,
              timestamp: '9:40 PM',
              details: 'Merged the extracted general liability fields into the submission record alongside the existing ACORD 125 and ACORD 140 data.',
            },
          ],
        },
        {
          id: 'act-classify-doc',
          title: 'Classify Document',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Martha (UW Team Lead)',
          completedBy: '',
          timestamp: '9:38 PM · May 12',
          status: 'completed' as const,
          detailsList: [
            'Document: ACORD 126 - Commercial General Liability.pdf',
            'Pages 1-9 → ACORD · ACORD 126',
            'Status: Classification confirmed — extraction request created',
          ],
        },
        {
          id: 'act-2',
          title: 'Partial Extraction',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Agent',
          completedBy: '',
          timestamp: '9:33 PM · May 12',
          status: 'completed' as const,
          agenticSteps: [
            {
              id: 'step-1',
              title: 'Email Analysis',
              status: 'completed' as const,
              timestamp: '9:30 PM',
              details: 'Analyzed email content from Niki Paoloni requesting commercial property and general liability insurance coverage for NexGen Biologics.',
            },
            {
              id: 'step-2',
              title: 'Document Identification',
              status: 'completed' as const,
              timestamp: '9:31 PM',
              details: 'Classified ACORD 125 + 140 - Commercial Application & Property Section.pdf into 2 forms. Unable to classify ACORD 126 - Commercial General Liability.pdf — manual classification required.',
            },
            {
              id: 'step-3',
              title: 'Data Extraction - ACORD 125',
              status: 'completed' as const,
              timestamp: '9:32 PM',
              details: 'Extracted: Business name, Business type, Years in business, Annual revenue, Employee count.',
            },
            {
              id: 'step-4',
              title: 'Data Extraction - ACORD 140',
              status: 'completed' as const,
              timestamp: '9:33 PM',
              details: 'Extracted: Locations, Total insured value, Building construction, Protection class, Sprinkler systems.',
            },
          ],
        },
        {
          id: 'act-1',
          title: 'Submission Email Received',
          description: 'NexGen Biologics Inc New Business · Sent by Niki Paoloni',
          completedBy: '',
          timestamp: '9:30 PM · May 12',
          status: 'completed' as const,
          detailsList: [
            'Sender: Niki Paoloni',
            'Subject: New Business Submission - NexGen Biologics Commercial Insurance',
          ],
        },
      ],

      // Pending Tasks - Partial Extraction parsing the broker reply,
      // followed by Data Completion Check waiting on its output.
      pendingTasks: [
        {
          id: 'task-partial-extraction-email',
          title: 'Partial Extraction',
          type: 'agentic' as const,
          assignedTo: 'Agent',
          agentName: 'Extraction Agent',
          status: 'in-progress' as const,
          description: 'Parsing the inbound reply from Niki Paoloni to extract the FEIN and update the submission record so the Data Completion Check can be re-run.',
          agentSteps: [
            {
              id: 'pe-step-1',
              title: 'Email Receipt Detected',
              description: 'Detected new inbound message from npaoloni@vanguardins.com on the NexGen Biologics submission thread. Subject: "Re: FEIN Needed — NexGen Biologics Inc".',
              status: 'completed' as const,
              timestamp: '8:38 AM',
            },
            {
              id: 'pe-step-2',
              title: 'Sender Verification',
              description: 'Verified sender against producer record. Niki Paoloni (Vanguard Insurance Partners, producer code VIP-4471) matches the broker on file.',
              status: 'completed' as const,
              timestamp: '8:38 AM',
            },
            {
              id: 'pe-step-3',
              title: 'Email Body Parsing',
              description: 'Tokenizing message body and stripping signature/quoted thread history. Isolating the new content from the broker.',
              status: 'completed' as const,
              timestamp: '8:39 AM',
            },
            {
              id: 'pe-step-4',
              title: 'Entity Extraction — FEIN',
              description: 'Scanning the reply for FEIN format (XX-XXXXXXX). Detected: 47-3829104.',
              status: 'in-progress' as const,
              timestamp: '8:39 AM',
            },
            {
              id: 'pe-step-5',
              title: 'FEIN Format Validation',
              description: 'Validating the extracted FEIN against the IRS 9-digit pattern and confirming it is associated with NexGen Biologics Inc.',
              status: 'pending' as const,
            },
            {
              id: 'pe-step-6',
              title: 'Update Submission Record',
              description: 'Writing the confirmed FEIN to the NexGen Biologics submission and attaching the broker email as evidence.',
              status: 'pending' as const,
            },
            {
              id: 'pe-step-7',
              title: 'Re-trigger Data Completion Check',
              description: 'Queueing the Data Completion Check for re-evaluation now that the FEIN is on the record.',
              status: 'pending' as const,
            },
          ],
        },
        {
          id: 'task-data-completion',
          title: 'Data Completion Check',
          type: 'manual' as const,
          assignedTo: 'Underwriter',
          status: 'on-hold' as const,
          description: 'This task checks the availability of values for legal entity, FEIN, business address, NAICS code, and broker contact details.',
          onHoldReason: 'Dependent on the Partial Extraction task to write the FEIN onto the submission.',
          dependentOn: 'Partial Extraction',
        },
        {
          id: 'task-appetite',
          title: 'Appetite Check',
          type: 'manual' as const,
          assignedTo: 'Underwriter',
          status: 'on-hold' as const,
          description: 'This task checks whether NAICS class, revenue, and operating states fall within the carrier\'s underwriting appetite.',
          onHoldReason: 'Dependent on the Data Completion Check.',
          dependentOn: 'Data Completion Check',
        },
        {
          id: 'task-clearance',
          title: 'Clearance Check',
          type: 'manual' as const,
          assignedTo: 'Underwriter',
          status: 'on-hold' as const,
          description: 'This task checks for duplicate submissions, producer appointment status, and prior declinations within the last 24 months.',
          onHoldReason: 'Dependent on the Data Completion Check.',
          dependentOn: 'Data Completion Check',
        },
      ],

      // Documents — same as Step 3
      documents: [
        {
          id: 'doc-1',
          name: 'ACORD 125 + 140 - Commercial Application & Property Section.pdf',
          type: 'ACORD Forms',
          uploadDate: 'May 12, 2026',
          uploadedBy: 'Niki Paoloni',
          size: '3.9 MB',
          pageCount: 30,
          status: 'Extraction Complete' as const,
          extractionRequests: [
            { id: 'EXR-1001', type: 'Commercial Application Data Extraction', status: 'Complete', createdAt: '9:31 PM' },
            { id: 'EXR-1002', type: 'Property Schedule Extraction', status: 'Complete', createdAt: '9:31 PM' },
          ],
          insights: {
            summary: 'A combined PDF containing two ACORD forms: ACORD 125 (Commercial Insurance Application) and ACORD 140 (Property Section).',
            keyFindings: [
              'Business Name: NexGen Biologics Inc',
              'NAICS Code: 325412 (Pharmaceutical Preparation Manufacturing)',
              'Years in Business: 12',
              'Annual Revenue: $47.2M',
              'Employee Count: 285 full-time',
              'Coverage Requested: Property, General Liability, Business Auto',
              '3 property locations identified — all in California',
              'Total Insured Value: $19,526,769',
              'Construction: Fire Resistive (all locations)',
              'Protection Class: 3',
              'Sprinkler systems: Yes — all locations',
              'Central station alarm monitoring: Yes',
            ],
            riskFactors: [],
            extractedData: [
              { field: 'Legal Entity', value: 'NexGen Biologics Inc' },
              { field: 'FEIN', value: '47-3829104' },
              { field: 'Business Address', value: '2400 Innovation Way, San Jose, CA 95134' },
              { field: 'Effective Date', value: '06/01/2026' },
              { field: 'Location 1 — Main Facility', value: 'San Jose, CA — $14.2M TIV' },
              { field: 'Location 2 — Distribution Center', value: 'Hayward, CA — $3.8M TIV' },
              { field: 'Location 3 — Office', value: 'San Jose, CA — $1.5M TIV' },
              { field: 'Valuation Basis', value: 'Replacement Cost' },
            ],
            missingInformation: [],
          },
        },
        {
          id: 'doc-3',
          name: 'ACORD 126 - Commercial General Liability.pdf',
          type: 'ACORD Forms',
          uploadDate: 'May 12, 2026',
          uploadedBy: 'Niki Paoloni',
          size: '1.5 MB',
          pageCount: 9,
          status: 'Extraction Complete' as const,
          extractionRequests: [
            { id: 'EXR-1003', type: 'General Liability Data Extraction', status: 'Complete', createdAt: '9:31 PM' },
          ],
          insights: {
            summary: 'ACORD 126 — Commercial General Liability section of the new business submission.',
            keyFindings: [
              'Per-Occurrence Limit Requested: $1,000,000',
              'General Aggregate Limit Requested: $2,000,000',
              'Operations Classification: Pharmaceutical Manufacturing',
              'Products/Completed Operations: Included',
              'Prior GL Claims: 2 in past 3 years ($34,800 total)',
            ],
            riskFactors: [],
            extractedData: [
              { field: 'GL Class Code', value: '50714 — Drug, Medicine, or Pharmaceutical Mfg.' },
              { field: 'Deductible', value: '$5,000 per occurrence' },
              { field: 'Retroactive Date', value: 'None — Occurrence form' },
            ],
            missingInformation: [],
          },
        },
      ],

      // Email threads - sent email to broker + reply
      emails: [
        {
          id: 'email-3',
          from: 'Niki Paoloni',
          fromInitials: 'NP',
          subject: 'Re: FEIN Needed — NexGen Biologics Inc',
          preview: 'Hi Martha, Thanks for the quick turnaround. The FEIN for NexGen Biologics Inc is 47-3829104...',
          date: '8:38 AM',
          fullDate: 'May 13, 2026',
          unread: false,
          hasAttachment: false,
          to: 'Martha (UW Team Lead)',
          body: `Hi Martha,

Thanks for the quick turnaround.

The FEIN for NexGen Biologics Inc is 47-3829104. Apologies for not including it on the original submission — let me know if you need anything else to keep things moving.

Best,
Niki Paoloni
Vanguard Insurance Partners
Direct: (555) 234-5678
npaoloni@vanguardins.com`,
          attachments: [],
        },
        {
          id: 'email-2',
          sent: true,
          from: 'Martha (UW Team Lead)',
          fromInitials: 'M',
          subject: 'FEIN Needed — NexGen Biologics Inc',
          preview: 'Hi Niki, Thanks for sending over the new business submission. We have started the Data Completion Check...',
          date: '10:32 PM',
          fullDate: 'May 12, 2026',
          unread: false,
          hasAttachment: false,
          to: 'Niki Paoloni <npaoloni@vanguardins.com>',
          body: `Hi Niki,

Thanks for sending over the new business submission for NexGen Biologics Inc. We have started the Data Completion Check and noticed the FEIN (Federal Employer Identification Number) is not on the submission.

Could you please reply with the FEIN for NexGen Biologics Inc? We need it to continue the qualifying checks and move the submission forward.

Let me know if you have any questions.

Best regards,
Martha
Underwriting Team Lead`,
          attachments: [],
        },
        {
          id: 'email-1',
          from: 'Niki Paoloni',
          fromInitials: 'NP',
          subject: 'New Business Submission - NexGen Biologics Commercial Insurance',
          preview: 'Good morning, I am submitting a new business request for NexGen Biologics Inc. They are seeking...',
          date: '9:30 AM',
          fullDate: 'May 12, 2026',
          unread: false,
          hasAttachment: true,
          to: 'Underwriting Team',
          body: `Good morning,

I am submitting a new business request for NexGen Biologics Inc. They are seeking comprehensive commercial insurance coverage including:

• Commercial Property Insurance
• Commercial General Liability
• Business Auto (8 vehicles)

Key Details:
- Business: Pharmaceutical manufacturing and distribution
- Years in Business: 12 years
- Annual Revenue: $47.2M
- Employees: 285 full-time
- Locations: 3 facilities (California)
- Total Insured Value: $19,526,769

The insured has a clean loss history with only one small property claim in the past 3 years ($12,500). They currently have coverage with another carrier but are looking to consolidate all lines with one carrier for better service and pricing.

Attached please find:
- ACORD 125 + 140 (combined Commercial Application & Property Section)
- ACORD 126 (General Liability Section)

Please let me know if you need any additional information. The client is hoping for indication by end of next week if possible.

Best regards,
Niki Paoloni
Vanguard Insurance Partners
Direct: (555) 234-5678
npaoloni@vanguardins.com`,
          attachments: [
            'ACORD 125 + 140 - Commercial Application & Property Section.pdf',
            'ACORD 126 - Commercial General Liability.pdf',
          ],
        },
      ],

      // Slack messages
      slackMessages: [],

      // Progress path - same as Step 2/3 (Draft current)
      progressPath: {
        currentStage: 'draft',
        stages: [
          { key: 'draft', label: 'Draft', status: 'current' },
          { key: 'in-progress', label: 'In Progress', status: 'incomplete' },
          { key: 'processed', label: 'Processed', status: 'incomplete' },
        ],
      },
    },
  },

  // ============================================================================
  // STEP 7: Partial Extraction (email parse) complete — re-Appetite-Check ready
  // ============================================================================
  7: {
    submission: {
      visibleFields: ['id', 'broker', 'totalInsuredValue', 'priority', 'stage', 'assignedTo'],
      fieldsWithValues: ['id', 'broker', 'totalInsuredValue', 'stage', 'assignedTo'],

      detailsFieldsWithValues: [
        'name',
        'insuredName',
        'dateSubmitted',
        'stage',
        'assignedTo',
        'effectiveDate',
        'insuredState',
        'broker',
        'brokerEmail',
        'brokerPhone',
        'totalInsuredValue',
      ],

      showLOBSection: false,
      showSubmissionLines: false,

      // Activities — Partial Extraction (FEIN parse), Data Completion, Appetite, Clearance all complete
      activities: [
        {
          id: 'act-clearance',
          title: 'Clearance Check',
          description: 'NexGen Biologics Inc New Business · Dependent Task · Completed by Martha (UW Team Lead)',
          completedBy: '',
          timestamp: '9:00 AM · May 13',
          status: 'completed' as const,
          dependentOn: 'Data Completion Check',
          detailsList: [
            'Duplicate submission check: No prior submission for NexGen Biologics Inc with effective date 06/01/2026',
            'Producer status: Vanguard Insurance Partners — Active appointment, license valid through 12/31/2026',
            'Producer code: VIP-4471 — Confirmed in system',
            'Prior decline check: No declinations on file in the last 24 months',
            'Status: Eligible to quote',
          ],
        },
        {
          id: 'act-appetite',
          title: 'Appetite Check',
          description: 'NexGen Biologics Inc New Business · Dependent Task · Completed by Martha (UW Team Lead)',
          completedBy: '',
          timestamp: '8:55 AM · May 13',
          status: 'completed' as const,
          dependentOn: 'Data Completion Check',
          detailsList: [
            'NAICS code: 325412 (Pharmaceutical Preparation Manufacturing) — On approved class list',
            'Annual revenue: $47.2M — Within target range ($10M–$250M)',
            'Years in business: 12 — Above 5-year minimum',
            'Status: Within appetite',
          ],
        },
        {
          id: 'act-data-completion',
          title: 'Data Completion Check',
          description: 'NexGen Biologics Inc New Business · Dependent Task · Completed by Martha (UW Team Lead)',
          completedBy: '',
          timestamp: '8:48 AM · May 13',
          status: 'completed' as const,
          dependentOn: 'Partial Extraction',
          detailsList: [
            'Legal entity: NexGen Biologics Inc — Confirmed',
            'FEIN: 47-3829104 — Confirmed',
            'Business address: 2400 Innovation Way, San Jose, CA 95134 — Confirmed',
            'NAICS code: 325412 (Pharmaceutical Preparation Manufacturing) — Confirmed',
            'Producer: Niki Paoloni, Vanguard Insurance Partners — Confirmed',
            'Status: Complete — ready for Appetite and Clearance checks',
          ],
        },
        {
          id: 'act-partial-extraction-email',
          title: 'Partial Extraction',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Agent',
          completedBy: '',
          timestamp: '8:46 AM · May 13',
          status: 'completed' as const,
          agenticSteps: [
            {
              id: 'pe-step-1',
              title: 'Email Receipt Detected',
              status: 'completed' as const,
              timestamp: '8:38 AM',
              details: 'Detected new inbound message from npaoloni@vanguardins.com on the NexGen Biologics submission thread. Subject: "Re: FEIN Needed — NexGen Biologics Inc".',
            },
            {
              id: 'pe-step-2',
              title: 'Sender Verification',
              status: 'completed' as const,
              timestamp: '8:38 AM',
              details: 'Verified sender against producer record. Niki Paoloni (Vanguard Insurance Partners, producer code VIP-4471) matches the broker on file.',
            },
            {
              id: 'pe-step-3',
              title: 'Email Body Parsing',
              status: 'completed' as const,
              timestamp: '8:39 AM',
              details: 'Tokenized message body and stripped signature/quoted thread history. Isolated the new content from the broker.',
            },
            {
              id: 'pe-step-4',
              title: 'Entity Extraction — FEIN',
              status: 'completed' as const,
              timestamp: '8:41 AM',
              details: 'Scanned the reply for FEIN format (XX-XXXXXXX). Detected: 47-3829104.',
            },
            {
              id: 'pe-step-5',
              title: 'FEIN Format Validation',
              status: 'completed' as const,
              timestamp: '8:43 AM',
              details: 'Validated the extracted FEIN against the IRS 9-digit pattern and confirmed it is associated with NexGen Biologics Inc.',
            },
            {
              id: 'pe-step-6',
              title: 'Update Submission Record',
              status: 'completed' as const,
              timestamp: '8:45 AM',
              details: 'Wrote the confirmed FEIN to the NexGen Biologics submission and attached the broker reply email as evidence.',
            },
            {
              id: 'pe-step-7',
              title: 'Re-trigger Data Completion Check',
              status: 'completed' as const,
              timestamp: '8:46 AM',
              details: 'Queued the Data Completion Check for re-evaluation now that the FEIN is on the record.',
            },
          ],
        },
        {
          id: 'act-email-received',
          title: 'Email Received from Broker',
          description: 'NexGen Biologics Inc · Inbound Email · From Niki Paoloni',
          completedBy: '',
          timestamp: '8:38 AM · May 13',
          status: 'completed' as const,
          detailsList: [
            'From: Niki Paoloni <npaoloni@vanguardins.com>',
            'To: Martha Reyes <mreyes@nexus-uw.com>',
            'Subject: Re: FEIN Needed — NexGen Biologics Inc',
            'Received: May 13, 2026 at 8:38 AM',
            'FEIN provided: 47-3829104',
            'Attachments: None',
            'Status: Reply received — Partial Extraction parsing now',
          ],
        },
        {
          id: 'act-email-sent',
          title: 'Email Sent to Broker',
          description: 'NexGen Biologics Inc New Business · Outbound Email · Sent by Martha (UW Team Lead)',
          completedBy: '',
          timestamp: '10:32 PM · May 12',
          status: 'completed' as const,
          detailsList: [
            'From: Martha Reyes <mreyes@nexus-uw.com>',
            'To: Niki Paoloni <npaoloni@vanguardins.com>',
            'Subject: FEIN Needed — NexGen Biologics Inc',
            'Sent: May 12, 2026 at 10:32 PM',
            'Request: FEIN for NexGen Biologics Inc to complete the Data Completion Check',
            'Attachments: None',
          ],
        },
        {
          id: 'act-partial-extraction-126',
          title: 'Partial Extraction',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Agent',
          completedBy: '',
          timestamp: '9:40 PM · May 12',
          status: 'completed' as const,
          agenticSteps: [
            {
              id: 'step-1',
              title: 'Read Manual Classification',
              status: 'completed' as const,
              timestamp: '9:38 PM',
              details: 'Loaded the manual classification — pages 1-9 of ACORD 126 - Commercial General Liability.pdf identified as ACORD 126.',
            },
            {
              id: 'step-2',
              title: 'Create Extraction Request',
              status: 'completed' as const,
              timestamp: '9:38 PM',
              details: 'Created extraction request EXR-1003 (General Liability Data Extraction) against ACORD 126 - Commercial General Liability.pdf.',
            },
            {
              id: 'step-3',
              title: 'Data Extraction - ACORD 126',
              status: 'completed' as const,
              timestamp: '9:39 PM',
              details: 'Extracted: Coverage limits, Operations classification, Prior claims history.',
            },
            {
              id: 'step-4',
              title: 'Submission Record Update',
              status: 'completed' as const,
              timestamp: '9:40 PM',
              details: 'Merged the extracted general liability fields into the submission record alongside the existing ACORD 125 and ACORD 140 data.',
            },
          ],
        },
        {
          id: 'act-classify-doc',
          title: 'Classify Document',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Martha (UW Team Lead)',
          completedBy: '',
          timestamp: '9:38 PM · May 12',
          status: 'completed' as const,
          detailsList: [
            'Document: ACORD 126 - Commercial General Liability.pdf',
            'Pages 1-9 → ACORD · ACORD 126',
            'Status: Classification confirmed — extraction request created',
          ],
        },
        {
          id: 'act-2',
          title: 'Partial Extraction',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Agent',
          completedBy: '',
          timestamp: '9:33 PM · May 12',
          status: 'completed' as const,
          agenticSteps: [
            {
              id: 'step-1',
              title: 'Email Analysis',
              status: 'completed' as const,
              timestamp: '9:30 PM',
              details: 'Analyzed email content from Niki Paoloni requesting commercial property and general liability insurance coverage for NexGen Biologics.',
            },
            {
              id: 'step-2',
              title: 'Document Identification',
              status: 'completed' as const,
              timestamp: '9:31 PM',
              details: 'Classified ACORD 125 + 140 - Commercial Application & Property Section.pdf into 2 forms. Unable to classify ACORD 126 - Commercial General Liability.pdf — manual classification required.',
            },
            {
              id: 'step-3',
              title: 'Data Extraction - ACORD 125',
              status: 'completed' as const,
              timestamp: '9:32 PM',
              details: 'Extracted: Business name, Business type, Years in business, Annual revenue, Employee count.',
            },
            {
              id: 'step-4',
              title: 'Data Extraction - ACORD 140',
              status: 'completed' as const,
              timestamp: '9:33 PM',
              details: 'Extracted: Locations, Total insured value, Building construction, Protection class, Sprinkler systems.',
            },
          ],
        },
        {
          id: 'act-1',
          title: 'Submission Email Received',
          description: 'NexGen Biologics Inc New Business · Sent by Niki Paoloni',
          completedBy: '',
          timestamp: '9:30 PM · May 12',
          status: 'completed' as const,
          detailsList: [
            'Sender: Niki Paoloni',
            'Subject: New Business Submission - NexGen Biologics Commercial Insurance',
          ],
        },
      ],

      // Pending Tasks — Complete Data Extraction (in progress); Data Reconciliation (on hold)
      pendingTasks: [
        {
          id: 'task-complete-extraction',
          title: 'Complete Data Extraction',
          type: 'agentic' as const,
          assignedTo: 'Agent',
          agentName: 'Extraction Agent',
          status: 'in-progress' as const,
          description: 'Extract data to create submission lines.',
          agentSteps: [
            {
              id: 'cde-step-1',
              title: 'Source Inventory',
              description: 'Aggregating sources for extraction: ACORD 125 + 140, ACORD 126, the original broker email, and the FEIN reply email.',
              status: 'completed' as const,
              timestamp: '9:02 AM',
            },
            {
              id: 'cde-step-2',
              title: 'Email Body Extraction',
              description: 'Parsing both broker emails for narrative coverage requests, vehicle counts, prior carrier history, and loss commentary.',
              status: 'completed' as const,
              timestamp: '9:04 AM',
            },
            {
              id: 'cde-step-3',
              title: 'ACORD 125 — Full Extraction',
              description: 'Pulling complete commercial application data: legal entity, FEIN, business address, NAICS, revenue, employee count, ownership, and operations description.',
              status: 'completed' as const,
              timestamp: '9:07 AM',
            },
            {
              id: 'cde-step-4',
              title: 'ACORD 140 — Property Schedule Extraction',
              description: 'Extracting full location schedule: 3 California facilities with construction, protection class, sprinklers, alarms, occupancy, and per-location TIV.',
              status: 'in-progress' as const,
              timestamp: '9:09 AM',
            },
            {
              id: 'cde-step-5',
              title: 'ACORD 126 — General Liability Extraction',
              description: 'Extracting per-occurrence and aggregate limits, GL class code, deductibles, products/completed operations, and prior GL claims history.',
              status: 'pending' as const,
            },
            {
              id: 'cde-step-6',
              title: 'Business Auto Schedule Extraction',
              description: 'Extracting the 8-vehicle schedule from the broker email narrative — VIN, year/make/model, garaging location, radius of operation, and assigned driver class.',
              status: 'pending' as const,
            },
            {
              id: 'cde-step-7',
              title: 'Cross-Source Field Merge',
              description: 'Merging fields extracted from email and documents into a single canonical view per coverage line.',
              status: 'pending' as const,
            },
            {
              id: 'cde-step-8',
              title: 'Create Submission Lines',
              description: 'Creating Property, General Liability, and Business Auto submission lines in Salesforce with extracted data attached.',
              status: 'pending' as const,
            },
          ],
        },
        {
          id: 'task-data-reconciliation',
          title: 'Data Reconciliation',
          type: 'agentic' as const,
          assignedTo: 'Agent',
          agentName: 'Reconciliation Agent',
          status: 'on-hold' as const,
          description: 'Identify lines of business and create submission lines.',
          onHoldReason: 'Dependent on Complete Data Extraction.',
          dependentOn: 'Complete Data Extraction',
        },
      ],

      // Documents — Complete Data Extraction is now requesting deeper extraction across both files
      documents: [
        {
          id: 'doc-1',
          name: 'ACORD 125 + 140 - Commercial Application & Property Section.pdf',
          type: 'ACORD Forms',
          uploadDate: 'May 12, 2026',
          uploadedBy: 'Niki Paoloni',
          size: '3.9 MB',
          pageCount: 30,
          status: 'Extraction in Progress' as const,
          extractionRequests: [
            { id: 'EXR-1001', type: 'Commercial Application Data Extraction', status: 'Complete', createdAt: '9:31 PM' },
            { id: 'EXR-1002', type: 'Property Schedule Extraction', status: 'Complete', createdAt: '9:31 PM' },
            { id: 'EXR-2001', type: 'Full Property Schedule Extraction', status: 'In Progress', createdAt: '9:02 AM' },
            { id: 'EXR-2002', type: 'Business Auto Schedule Extraction', status: 'In Progress', createdAt: '9:02 AM' },
          ],
          insights: {
            summary: 'A combined PDF containing two ACORD forms: ACORD 125 (Commercial Insurance Application) and ACORD 140 (Property Section).',
            keyFindings: [
              'Business Name: NexGen Biologics Inc',
              'NAICS Code: 325412 (Pharmaceutical Preparation Manufacturing)',
              'Years in Business: 12',
              'Annual Revenue: $47.2M',
              'Employee Count: 285 full-time',
              'Coverage Requested: Property, General Liability, Business Auto',
              '3 property locations identified — all in California',
              'Total Insured Value: $19,526,769',
              'Construction: Fire Resistive (all locations)',
              'Protection Class: 3',
              'Sprinkler systems: Yes — all locations',
              'Central station alarm monitoring: Yes',
            ],
            riskFactors: [],
            extractedData: [
              { field: 'Legal Entity', value: 'NexGen Biologics Inc' },
              { field: 'FEIN', value: '47-3829104' },
              { field: 'Business Address', value: '2400 Innovation Way, San Jose, CA 95134' },
              { field: 'Effective Date', value: '06/01/2026' },
              { field: 'Location 1 — Main Facility', value: 'San Jose, CA — $14.2M TIV' },
              { field: 'Location 2 — Distribution Center', value: 'Hayward, CA — $3.8M TIV' },
              { field: 'Location 3 — Office', value: 'San Jose, CA — $1.5M TIV' },
              { field: 'Valuation Basis', value: 'Replacement Cost' },
            ],
            missingInformation: [],
          },
        },
        {
          id: 'doc-3',
          name: 'ACORD 126 - Commercial General Liability.pdf',
          type: 'ACORD Forms',
          uploadDate: 'May 12, 2026',
          uploadedBy: 'Niki Paoloni',
          size: '1.5 MB',
          pageCount: 9,
          status: 'Extraction in Progress' as const,
          extractionRequests: [
            { id: 'EXR-1003', type: 'General Liability Data Extraction', status: 'Complete', createdAt: '9:31 PM' },
            { id: 'EXR-2003', type: 'Full General Liability Extraction', status: 'In Progress', createdAt: '9:02 AM' },
          ],
          insights: {
            summary: 'ACORD 126 — Commercial General Liability section of the new business submission.',
            keyFindings: [
              'Per-Occurrence Limit Requested: $1,000,000',
              'General Aggregate Limit Requested: $2,000,000',
              'Operations Classification: Pharmaceutical Manufacturing',
              'Products/Completed Operations: Included',
              'Prior GL Claims: 2 in past 3 years ($34,800 total)',
            ],
            riskFactors: [],
            extractedData: [
              { field: 'GL Class Code', value: '50714 — Drug, Medicine, or Pharmaceutical Mfg.' },
              { field: 'Deductible', value: '$5,000 per occurrence' },
              { field: 'Retroactive Date', value: 'None — Occurrence form' },
            ],
            missingInformation: [],
          },
        },
      ],

      // Email threads — same as Step 6 (FEIN flow)
      emails: [
        {
          id: 'email-3',
          from: 'Niki Paoloni',
          fromInitials: 'NP',
          subject: 'Re: FEIN Needed — NexGen Biologics Inc',
          preview: 'Hi Martha, Thanks for the quick turnaround. The FEIN for NexGen Biologics Inc is 47-3829104...',
          date: '8:38 AM',
          fullDate: 'May 13, 2026',
          unread: false,
          hasAttachment: false,
          to: 'Martha (UW Team Lead)',
          body: `Hi Martha,

Thanks for the quick turnaround.

The FEIN for NexGen Biologics Inc is 47-3829104. Apologies for not including it on the original submission — let me know if you need anything else to keep things moving.

Best,
Niki Paoloni
Vanguard Insurance Partners
Direct: (555) 234-5678
npaoloni@vanguardins.com`,
          attachments: [],
        },
        {
          id: 'email-2',
          sent: true,
          from: 'Martha (UW Team Lead)',
          fromInitials: 'M',
          subject: 'FEIN Needed — NexGen Biologics Inc',
          preview: 'Hi Niki, Thanks for sending over the new business submission. We have started the Data Completion Check...',
          date: '10:32 PM',
          fullDate: 'May 12, 2026',
          unread: false,
          hasAttachment: false,
          to: 'Niki Paoloni <npaoloni@vanguardins.com>',
          body: `Hi Niki,

Thanks for sending over the new business submission for NexGen Biologics Inc. We have started the Data Completion Check and noticed the FEIN (Federal Employer Identification Number) is not on the submission.

Could you please reply with the FEIN for NexGen Biologics Inc? We need it to continue the qualifying checks and move the submission forward.

Let me know if you have any questions.

Best regards,
Martha
Underwriting Team Lead`,
          attachments: [],
        },
        {
          id: 'email-1',
          from: 'Niki Paoloni',
          fromInitials: 'NP',
          subject: 'New Business Submission - NexGen Biologics Commercial Insurance',
          preview: 'Good morning, I am submitting a new business request for NexGen Biologics Inc. They are seeking...',
          date: '9:30 AM',
          fullDate: 'May 12, 2026',
          unread: false,
          hasAttachment: true,
          to: 'Underwriting Team',
          body: `Good morning,

I am submitting a new business request for NexGen Biologics Inc. They are seeking comprehensive commercial insurance coverage including:

• Commercial Property Insurance
• Commercial General Liability
• Business Auto (8 vehicles)

Key Details:
- Business: Pharmaceutical manufacturing and distribution
- Years in Business: 12 years
- Annual Revenue: $47.2M
- Employees: 285 full-time
- Locations: 3 facilities (California)
- Total Insured Value: $19,526,769

The insured has a clean loss history with only one small property claim in the past 3 years ($12,500). They currently have coverage with another carrier but are looking to consolidate all lines with one carrier for better service and pricing.

Attached please find:
- ACORD 125 + 140 (combined Commercial Application & Property Section)
- ACORD 126 (General Liability Section)

Please let me know if you need any additional information. The client is hoping for indication by end of next week if possible.

Best regards,
Niki Paoloni
Vanguard Insurance Partners
Direct: (555) 234-5678
npaoloni@vanguardins.com`,
          attachments: [
            'ACORD 125 + 140 - Commercial Application & Property Section.pdf',
            'ACORD 126 - Commercial General Liability.pdf',
          ],
        },
      ],

      slackMessages: [],

      progressPath: {
        currentStage: 'draft',
        stages: [
          { key: 'draft', label: 'Draft', status: 'current' },
          { key: 'in-progress', label: 'In Progress', status: 'incomplete' },
          { key: 'processed', label: 'Processed', status: 'incomplete' },
        ],
      },
    },
  },

  // ============================================================================
  // STEP 8: Complete Data Extraction done — Data Reconciliation in progress
  // ============================================================================
  8: {
    submission: {
      visibleFields: ['id', 'broker', 'totalInsuredValue', 'priority', 'stage', 'assignedTo'],
      fieldsWithValues: ['id', 'broker', 'totalInsuredValue', 'stage', 'assignedTo'],

      detailsFieldsWithValues: [
        'name',
        'insuredName',
        'dateSubmitted',
        'stage',
        'assignedTo',
        'effectiveDate',
        'insuredState',
        'broker',
        'brokerEmail',
        'brokerPhone',
        'totalInsuredValue',
      ],

      showLOBSection: false,
      showSubmissionLines: false,

      // Activities — Complete Data Extraction now logged at top, prior activities preserved
      activities: [
        {
          id: 'act-complete-extraction',
          title: 'Complete Data Extraction',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Agent',
          completedBy: '',
          timestamp: '9:18 AM · May 13',
          status: 'completed' as const,
          agenticSteps: [
            {
              id: 'cde-step-1',
              title: 'Source Inventory',
              status: 'completed' as const,
              timestamp: '9:02 AM',
              details: 'Aggregated sources for extraction: ACORD 125 + 140, ACORD 126, the original broker email, and the FEIN reply email.',
            },
            {
              id: 'cde-step-2',
              title: 'Email Body Extraction',
              status: 'completed' as const,
              timestamp: '9:04 AM',
              details: 'Parsed both broker emails for narrative coverage requests, vehicle counts, prior carrier history, and loss commentary.',
            },
            {
              id: 'cde-step-3',
              title: 'ACORD 125 — Full Extraction',
              status: 'completed' as const,
              timestamp: '9:07 AM',
              details: 'Pulled complete commercial application data: legal entity, FEIN, business address, NAICS, revenue, employee count, ownership, and operations description.',
            },
            {
              id: 'cde-step-4',
              title: 'ACORD 140 — Property Schedule Extraction',
              status: 'completed' as const,
              timestamp: '9:10 AM',
              details: 'Extracted full location schedule: 3 California facilities with construction, protection class, sprinklers, alarms, occupancy, and per-location TIV.',
            },
            {
              id: 'cde-step-5',
              title: 'ACORD 126 — General Liability Extraction',
              status: 'completed' as const,
              timestamp: '9:13 AM',
              details: 'Extracted per-occurrence and aggregate limits, GL class code, deductibles, products/completed operations, and prior GL claims history.',
            },
            {
              id: 'cde-step-6',
              title: 'Business Auto Schedule Extraction',
              status: 'completed' as const,
              timestamp: '9:15 AM',
              details: 'Extracted the 8-vehicle schedule from the broker email narrative — VIN, year/make/model, garaging location, radius of operation, and assigned driver class.',
            },
            {
              id: 'cde-step-7',
              title: 'Cross-Source Field Merge',
              status: 'completed' as const,
              timestamp: '9:17 AM',
              details: 'Merged fields extracted from email and documents into a single canonical view per coverage line.',
            },
            {
              id: 'cde-step-8',
              title: 'Persist Raw Extracted Data',
              status: 'completed' as const,
              timestamp: '9:18 AM',
              details: 'Persisted all raw extracted data and handed off to Data Reconciliation for line-of-business grouping and submission line creation.',
            },
          ],
        },
        {
          id: 'act-clearance',
          title: 'Clearance Check',
          description: 'NexGen Biologics Inc New Business · Dependent Task · Completed by Martha (UW Team Lead)',
          completedBy: '',
          timestamp: '9:00 AM · May 13',
          status: 'completed' as const,
          dependentOn: 'Data Completion Check',
          detailsList: [
            'Duplicate submission check: No prior submission for NexGen Biologics Inc with effective date 06/01/2026',
            'Producer status: Vanguard Insurance Partners — Active appointment, license valid through 12/31/2026',
            'Producer code: VIP-4471 — Confirmed in system',
            'Prior decline check: No declinations on file in the last 24 months',
            'Status: Eligible to quote',
          ],
        },
        {
          id: 'act-appetite',
          title: 'Appetite Check',
          description: 'NexGen Biologics Inc New Business · Dependent Task · Completed by Martha (UW Team Lead)',
          completedBy: '',
          timestamp: '8:55 AM · May 13',
          status: 'completed' as const,
          dependentOn: 'Data Completion Check',
          detailsList: [
            'NAICS code: 325412 (Pharmaceutical Preparation Manufacturing) — On approved class list',
            'Annual revenue: $47.2M — Within target range ($10M–$250M)',
            'Years in business: 12 — Above 5-year minimum',
            'Status: Within appetite',
          ],
        },
        {
          id: 'act-data-completion',
          title: 'Data Completion Check',
          description: 'NexGen Biologics Inc New Business · Dependent Task · Completed by Martha (UW Team Lead)',
          completedBy: '',
          timestamp: '8:48 AM · May 13',
          status: 'completed' as const,
          dependentOn: 'Partial Extraction',
          detailsList: [
            'Legal entity: NexGen Biologics Inc — Confirmed',
            'FEIN: 47-3829104 — Confirmed',
            'Business address: 2400 Innovation Way, San Jose, CA 95134 — Confirmed',
            'NAICS code: 325412 (Pharmaceutical Preparation Manufacturing) — Confirmed',
            'Producer: Niki Paoloni, Vanguard Insurance Partners — Confirmed',
            'Status: Complete — ready for Appetite and Clearance checks',
          ],
        },
        {
          id: 'act-partial-extraction-email',
          title: 'Partial Extraction',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Agent',
          completedBy: '',
          timestamp: '8:46 AM · May 13',
          status: 'completed' as const,
          agenticSteps: [
            {
              id: 'pe-step-1',
              title: 'Email Receipt Detected',
              status: 'completed' as const,
              timestamp: '8:38 AM',
              details: 'Detected new inbound message from npaoloni@vanguardins.com on the NexGen Biologics submission thread. Subject: "Re: FEIN Needed — NexGen Biologics Inc".',
            },
            {
              id: 'pe-step-2',
              title: 'Sender Verification',
              status: 'completed' as const,
              timestamp: '8:38 AM',
              details: 'Verified sender against producer record. Niki Paoloni (Vanguard Insurance Partners, producer code VIP-4471) matches the broker on file.',
            },
            {
              id: 'pe-step-3',
              title: 'Email Body Parsing',
              status: 'completed' as const,
              timestamp: '8:39 AM',
              details: 'Tokenized message body and stripped signature/quoted thread history. Isolated the new content from the broker.',
            },
            {
              id: 'pe-step-4',
              title: 'Entity Extraction — FEIN',
              status: 'completed' as const,
              timestamp: '8:41 AM',
              details: 'Scanned the reply for FEIN format (XX-XXXXXXX). Detected: 47-3829104.',
            },
            {
              id: 'pe-step-5',
              title: 'FEIN Format Validation',
              status: 'completed' as const,
              timestamp: '8:43 AM',
              details: 'Validated the extracted FEIN against the IRS 9-digit pattern and confirmed it is associated with NexGen Biologics Inc.',
            },
            {
              id: 'pe-step-6',
              title: 'Update Submission Record',
              status: 'completed' as const,
              timestamp: '8:45 AM',
              details: 'Wrote the confirmed FEIN to the NexGen Biologics submission and attached the broker reply email as evidence.',
            },
            {
              id: 'pe-step-7',
              title: 'Re-trigger Data Completion Check',
              status: 'completed' as const,
              timestamp: '8:46 AM',
              details: 'Queued the Data Completion Check for re-evaluation now that the FEIN is on the record.',
            },
          ],
        },
        {
          id: 'act-email-received',
          title: 'Email Received from Broker',
          description: 'NexGen Biologics Inc · Inbound Email · From Niki Paoloni',
          completedBy: '',
          timestamp: '8:38 AM · May 13',
          status: 'completed' as const,
          detailsList: [
            'From: Niki Paoloni <npaoloni@vanguardins.com>',
            'To: Martha Reyes <mreyes@nexus-uw.com>',
            'Subject: Re: FEIN Needed — NexGen Biologics Inc',
            'Received: May 13, 2026 at 8:38 AM',
            'FEIN provided: 47-3829104',
            'Attachments: None',
            'Status: Reply received — Partial Extraction parsing now',
          ],
        },
        {
          id: 'act-email-sent',
          title: 'Email Sent to Broker',
          description: 'NexGen Biologics Inc New Business · Outbound Email · Sent by Martha (UW Team Lead)',
          completedBy: '',
          timestamp: '10:32 PM · May 12',
          status: 'completed' as const,
          detailsList: [
            'From: Martha Reyes <mreyes@nexus-uw.com>',
            'To: Niki Paoloni <npaoloni@vanguardins.com>',
            'Subject: FEIN Needed — NexGen Biologics Inc',
            'Sent: May 12, 2026 at 10:32 PM',
            'Request: FEIN for NexGen Biologics Inc to complete the Data Completion Check',
            'Attachments: None',
          ],
        },
        {
          id: 'act-partial-extraction-126',
          title: 'Partial Extraction',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Agent',
          completedBy: '',
          timestamp: '9:40 PM · May 12',
          status: 'completed' as const,
          agenticSteps: [
            {
              id: 'step-1',
              title: 'Read Manual Classification',
              status: 'completed' as const,
              timestamp: '9:38 PM',
              details: 'Loaded the manual classification — pages 1-9 of ACORD 126 - Commercial General Liability.pdf identified as ACORD 126.',
            },
            {
              id: 'step-2',
              title: 'Create Extraction Request',
              status: 'completed' as const,
              timestamp: '9:38 PM',
              details: 'Created extraction request EXR-1003 (General Liability Data Extraction) against ACORD 126 - Commercial General Liability.pdf.',
            },
            {
              id: 'step-3',
              title: 'Data Extraction - ACORD 126',
              status: 'completed' as const,
              timestamp: '9:39 PM',
              details: 'Extracted: Coverage limits, Operations classification, Prior claims history.',
            },
            {
              id: 'step-4',
              title: 'Submission Record Update',
              status: 'completed' as const,
              timestamp: '9:40 PM',
              details: 'Merged the extracted general liability fields into the submission record alongside the existing ACORD 125 and ACORD 140 data.',
            },
          ],
        },
        {
          id: 'act-classify-doc',
          title: 'Classify Document',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Martha (UW Team Lead)',
          completedBy: '',
          timestamp: '9:38 PM · May 12',
          status: 'completed' as const,
          detailsList: [
            'Document: ACORD 126 - Commercial General Liability.pdf',
            'Pages 1-9 → ACORD · ACORD 126',
            'Status: Classification confirmed — extraction request created',
          ],
        },
        {
          id: 'act-2',
          title: 'Partial Extraction',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Agent',
          completedBy: '',
          timestamp: '9:33 PM · May 12',
          status: 'completed' as const,
          agenticSteps: [
            {
              id: 'step-1',
              title: 'Email Analysis',
              status: 'completed' as const,
              timestamp: '9:30 PM',
              details: 'Analyzed email content from Niki Paoloni requesting commercial property and general liability insurance coverage for NexGen Biologics.',
            },
            {
              id: 'step-2',
              title: 'Document Identification',
              status: 'completed' as const,
              timestamp: '9:31 PM',
              details: 'Classified ACORD 125 + 140 - Commercial Application & Property Section.pdf into 2 forms. Unable to classify ACORD 126 - Commercial General Liability.pdf — manual classification required.',
            },
            {
              id: 'step-3',
              title: 'Data Extraction - ACORD 125',
              status: 'completed' as const,
              timestamp: '9:32 PM',
              details: 'Extracted: Business name, Business type, Years in business, Annual revenue, Employee count.',
            },
            {
              id: 'step-4',
              title: 'Data Extraction - ACORD 140',
              status: 'completed' as const,
              timestamp: '9:33 PM',
              details: 'Extracted: Locations, Total insured value, Building construction, Protection class, Sprinkler systems.',
            },
          ],
        },
        {
          id: 'act-1',
          title: 'Submission Email Received',
          description: 'NexGen Biologics Inc New Business · Sent by Niki Paoloni',
          completedBy: '',
          timestamp: '9:30 PM · May 12',
          status: 'completed' as const,
          detailsList: [
            'Sender: Niki Paoloni',
            'Subject: New Business Submission - NexGen Biologics Commercial Insurance',
          ],
        },
      ],

      // Pending Tasks — Data Reconciliation now in progress
      pendingTasks: [
        {
          id: 'task-data-reconciliation',
          title: 'Data Reconciliation',
          type: 'agentic' as const,
          assignedTo: 'Agent',
          agentName: 'Reconciliation Agent',
          status: 'in-progress' as const,
          description: 'Identify lines of business and create submission lines.',
          dependentOn: 'Complete Data Extraction',
          agentSteps: [
            {
              id: 'dr-step-1',
              title: 'Load Raw Extracted Data',
              description: 'Loaded the canonical extracted dataset produced by Complete Data Extraction — covering ACORD 125, 140, 126, the broker email thread, and the Business Auto schedule.',
              status: 'completed' as const,
              timestamp: '9:20 AM',
            },
            {
              id: 'dr-step-2',
              title: 'Field Normalization',
              description: 'Standardized field formats: addresses normalized to USPS format, FEIN to XX-XXXXXXX, NAICS codes validated against the official 2022 taxonomy, and currency values to USD.',
              status: 'completed' as const,
              timestamp: '9:22 AM',
            },
            {
              id: 'dr-step-3',
              title: 'Cross-Source Conflict Resolution',
              description: 'Compared overlapping fields across sources. No conflicts detected — broker email narrative matches ACORD form values. TIV, location count, and vehicle count consistent across sources.',
              status: 'completed' as const,
              timestamp: '9:24 AM',
            },
            {
              id: 'dr-step-4',
              title: 'Identify Lines of Business',
              description: 'Identified 3 lines of business from the extracted data: Commercial Property (ACORD 125 + 140), Commercial General Liability (ACORD 126), and Business Auto (broker email schedule of 8 vehicles).',
              status: 'completed' as const,
              timestamp: '9:26 AM',
            },
            {
              id: 'dr-step-5',
              title: 'Create Property Submission Line',
              description: 'Building the Property submission line: 3 California locations, $19.5M total insured value, Fire Resistive construction, Protection Class 3, sprinklered with central station alarm.',
              status: 'in-progress' as const,
              timestamp: '9:28 AM',
            },
            {
              id: 'dr-step-6',
              title: 'Create General Liability Submission Line',
              description: 'Will create the General Liability submission line: $1M per-occurrence / $2M aggregate, GL class 50714, $5,000 deductible, products/completed operations included.',
              status: 'pending' as const,
            },
            {
              id: 'dr-step-7',
              title: 'Create Business Auto Submission Line',
              description: 'Will create the Business Auto submission line: 8 vehicles, garaging California, radius of operation and assigned driver class per the broker email schedule.',
              status: 'pending' as const,
            },
            {
              id: 'dr-step-8',
              title: 'Link Lineage and Finalize',
              description: 'Will attach source lineage to each submission line — pointing each field back to its source document or email — and mark the submission ready for underwriter review.',
              status: 'pending' as const,
            },
          ],
        },
      ],

      // Documents — extraction requests now all complete
      documents: [
        {
          id: 'doc-1',
          name: 'ACORD 125 + 140 - Commercial Application & Property Section.pdf',
          type: 'ACORD Forms',
          uploadDate: 'May 12, 2026',
          uploadedBy: 'Niki Paoloni',
          size: '3.9 MB',
          pageCount: 30,
          status: 'Extraction Complete' as const,
          extractionRequests: [
            { id: 'EXR-1001', type: 'Commercial Application Data Extraction', status: 'Complete', createdAt: '9:31 PM' },
            { id: 'EXR-1002', type: 'Property Schedule Extraction', status: 'Complete', createdAt: '9:31 PM' },
            { id: 'EXR-2001', type: 'Full Property Schedule Extraction', status: 'Complete', createdAt: '9:02 AM' },
            { id: 'EXR-2002', type: 'Business Auto Schedule Extraction', status: 'Complete', createdAt: '9:02 AM' },
          ],
          insights: {
            summary: 'A combined PDF containing two ACORD forms: ACORD 125 (Commercial Insurance Application) and ACORD 140 (Property Section).',
            keyFindings: [
              'Business Name: NexGen Biologics Inc',
              'NAICS Code: 325412 (Pharmaceutical Preparation Manufacturing)',
              'Years in Business: 12',
              'Annual Revenue: $47.2M',
              'Employee Count: 285 full-time',
              'Coverage Requested: Property, General Liability, Business Auto',
              '3 property locations identified — all in California',
              'Total Insured Value: $19,526,769',
              'Construction: Fire Resistive (all locations)',
              'Protection Class: 3',
              'Sprinkler systems: Yes — all locations',
              'Central station alarm monitoring: Yes',
            ],
            riskFactors: [],
            extractedData: [
              { field: 'Legal Entity', value: 'NexGen Biologics Inc' },
              { field: 'FEIN', value: '47-3829104' },
              { field: 'Business Address', value: '2400 Innovation Way, San Jose, CA 95134' },
              { field: 'Effective Date', value: '06/01/2026' },
              { field: 'Location 1 — Main Facility', value: 'San Jose, CA — $14.2M TIV' },
              { field: 'Location 2 — Distribution Center', value: 'Hayward, CA — $3.8M TIV' },
              { field: 'Location 3 — Office', value: 'San Jose, CA — $1.5M TIV' },
              { field: 'Valuation Basis', value: 'Replacement Cost' },
            ],
            missingInformation: [],
          },
        },
        {
          id: 'doc-3',
          name: 'ACORD 126 - Commercial General Liability.pdf',
          type: 'ACORD Forms',
          uploadDate: 'May 12, 2026',
          uploadedBy: 'Niki Paoloni',
          size: '1.5 MB',
          pageCount: 9,
          status: 'Extraction Complete' as const,
          extractionRequests: [
            { id: 'EXR-1003', type: 'General Liability Data Extraction', status: 'Complete', createdAt: '9:31 PM' },
            { id: 'EXR-2003', type: 'Full General Liability Extraction', status: 'Complete', createdAt: '9:02 AM' },
          ],
          insights: {
            summary: 'ACORD 126 — Commercial General Liability section of the new business submission.',
            keyFindings: [
              'Per-Occurrence Limit Requested: $1,000,000',
              'General Aggregate Limit Requested: $2,000,000',
              'Operations Classification: Pharmaceutical Manufacturing',
              'Products/Completed Operations: Included',
              'Prior GL Claims: 2 in past 3 years ($34,800 total)',
            ],
            riskFactors: [],
            extractedData: [
              { field: 'GL Class Code', value: '50714 — Drug, Medicine, or Pharmaceutical Mfg.' },
              { field: 'Deductible', value: '$5,000 per occurrence' },
              { field: 'Retroactive Date', value: 'None — Occurrence form' },
            ],
            missingInformation: [],
          },
        },
      ],

      // Email threads — same as Step 7 (FEIN flow)
      emails: [
        {
          id: 'email-3',
          from: 'Niki Paoloni',
          fromInitials: 'NP',
          subject: 'Re: FEIN Needed — NexGen Biologics Inc',
          preview: 'Hi Martha, Thanks for the quick turnaround. The FEIN for NexGen Biologics Inc is 47-3829104...',
          date: '8:38 AM',
          fullDate: 'May 13, 2026',
          unread: false,
          hasAttachment: false,
          to: 'Martha (UW Team Lead)',
          body: `Hi Martha,

Thanks for the quick turnaround.

The FEIN for NexGen Biologics Inc is 47-3829104. Apologies for not including it on the original submission — let me know if you need anything else to keep things moving.

Best,
Niki Paoloni
Vanguard Insurance Partners
Direct: (555) 234-5678
npaoloni@vanguardins.com`,
          attachments: [],
        },
        {
          id: 'email-2',
          sent: true,
          from: 'Martha (UW Team Lead)',
          fromInitials: 'M',
          subject: 'FEIN Needed — NexGen Biologics Inc',
          preview: 'Hi Niki, Thanks for sending over the new business submission. We have started the Data Completion Check...',
          date: '10:32 PM',
          fullDate: 'May 12, 2026',
          unread: false,
          hasAttachment: false,
          to: 'Niki Paoloni <npaoloni@vanguardins.com>',
          body: `Hi Niki,

Thanks for sending over the new business submission for NexGen Biologics Inc. We have started the Data Completion Check and noticed the FEIN (Federal Employer Identification Number) is not on the submission.

Could you please reply with the FEIN for NexGen Biologics Inc? We need it to continue the qualifying checks and move the submission forward.

Let me know if you have any questions.

Best regards,
Martha
Underwriting Team Lead`,
          attachments: [],
        },
        {
          id: 'email-1',
          from: 'Niki Paoloni',
          fromInitials: 'NP',
          subject: 'New Business Submission - NexGen Biologics Commercial Insurance',
          preview: 'Good morning, I am submitting a new business request for NexGen Biologics Inc. They are seeking...',
          date: '9:30 AM',
          fullDate: 'May 12, 2026',
          unread: false,
          hasAttachment: true,
          to: 'Underwriting Team',
          body: `Good morning,

I am submitting a new business request for NexGen Biologics Inc. They are seeking comprehensive commercial insurance coverage including:

• Commercial Property Insurance
• Commercial General Liability
• Business Auto (8 vehicles)

Key Details:
- Business: Pharmaceutical manufacturing and distribution
- Years in Business: 12 years
- Annual Revenue: $47.2M
- Employees: 285 full-time
- Locations: 3 facilities (California)
- Total Insured Value: $19,526,769

The insured has a clean loss history with only one small property claim in the past 3 years ($12,500). They currently have coverage with another carrier but are looking to consolidate all lines with one carrier for better service and pricing.

Attached please find:
- ACORD 125 + 140 (combined Commercial Application & Property Section)
- ACORD 126 (General Liability Section)

Please let me know if you need any additional information. The client is hoping for indication by end of next week if possible.

Best regards,
Niki Paoloni
Vanguard Insurance Partners
Direct: (555) 234-5678
npaoloni@vanguardins.com`,
          attachments: [
            'ACORD 125 + 140 - Commercial Application & Property Section.pdf',
            'ACORD 126 - Commercial General Liability.pdf',
          ],
        },
      ],

      slackMessages: [],

      progressPath: {
        currentStage: 'in-progress',
        stages: [
          { key: 'draft', label: 'Draft', status: 'complete' },
          { key: 'in-progress', label: 'In Progress', status: 'current' },
          { key: 'processed', label: 'Processed', status: 'incomplete' },
        ],
      },
    },
  },

  // ============================================================================
  // STEP 9: Data Reconciliation complete — Property + GL submission lines created with discrepancies
  // ============================================================================
  9: {
    submission: {
      visibleFields: ['id', 'broker', 'totalInsuredValue', 'priority', 'stage', 'assignedTo'],
      fieldsWithValues: ['id', 'broker', 'totalInsuredValue', 'stage', 'assignedTo'],

      detailsFieldsWithValues: [
        'name',
        'insuredName',
        'dateSubmitted',
        'stage',
        'assignedTo',
        'effectiveDate',
        'insuredState',
        'broker',
        'brokerEmail',
        'brokerPhone',
        'totalInsuredValue',
      ],

      // LOB tiles now live inside the Overview tab — hide the standalone LOB section
      showLOBSection: false,
      // Submission lines tab is now visible; filtered to the LOBs that materialized
      showSubmissionLines: true,
      submissionLineLOBs: ['Property', 'General Liability'],
      submissionLinesWarning: 'Data discrepancies and duplicate values were found while creating the Commercial Property and General Liability submission lines. Open each line of business below to review and resolve.',
      // Map of submission-line id → list of attribute keys that should display a warning icon
      submissionLineDiscrepancies: {
        // Commercial Property LOB
        'a01SB00001p8B5FYAU': ['Valuation'],
        // Location 1 - Chicago Warehouse
        'a01SB00001p8B6rYAE': ['Address', 'City', 'State', 'Zip'],
        // L1-B1 - Main Warehouse
        'a01SB00001p8BA5YAM': ['Year Built', 'Square Footage', 'Roof Year'],
        // Location 2 - Austin Office Campus is intentionally left clean so its
        // building children (below) demonstrate the child-error / parent-clean
        // case: the Location node carries no discrepancy of its own but expands
        // to reveal L2-B1 and L2-B2, which do.
        // L2-B1 - HQ Tower
        'a01SB00001p8BObYAM': ['Construction Type', 'Year Built', 'Stories'],
        // L2-B2 - R&D Lab Building
        'a01SB00001p8BTRYA2': ['Square Footage', 'Occupancy'],
        // General Liability LOB
        'a01SB00001pGYUTYA4': ['Premium Basis'],
      },
      // Map of submission-line id → potential duplicate line id
      // Used to mark lines that may be duplicates (only siblings at same level)
      submissionLinePotentialDuplicates: {
        // Location 3A and 3B are potential duplicates
        'a01SB00001pDUP3A': 'a01SB00001pDUP3B',
        'a01SB00001pDUP3B': 'a01SB00001pDUP3A',
        // Building L3A-B1 and L3B-B1 are potential duplicates (Manufacturing Building A)
        'a01SB00001pDUP3AB1': 'a01SB00001pDUP3BB1',
        'a01SB00001pDUP3BB1': 'a01SB00001pDUP3AB1',
        // Building L3A-B3 and L3B-B3 are potential duplicates (Distribution/Warehouse)
        'a01SB00001pDUP3AB3': 'a01SB00001pDUP3BB3',
        'a01SB00001pDUP3BB3': 'a01SB00001pDUP3AB3',
        // Equipment L3A-B1-E and L3B-B1-E are potential duplicates (Manufacturing/Production Equipment)
        'a01SB00001pDUP3AB1E': 'a01SB00001pDUP3BB1E',
        'a01SB00001pDUP3BB1E': 'a01SB00001pDUP3AB1E',
        // Location 5A and 5B are potential duplicates (identical mapped values → all rows match)
        'a01SB00001pDUP5A': 'a01SB00001pDUP5B',
        'a01SB00001pDUP5B': 'a01SB00001pDUP5A',
      },
      // Map of submission-line id → attribute key → list of candidate sources.
      // The first candidate is the active selection by default. Lines/attrs not in
      // this map fall back to a single default source derived from the LOB.
      submissionLineAttributeSources: {
        // ── Submission Parties ──
        // Account 1 — NexGen Biologics Inc
        'a01SBPARTY0ACC01': {
          'Account Name': [
            { field: 'Named Insured', value: 'NexGen Biologics Inc', source: 'ACORD 125' },
            { field: 'Insured Name', value: 'NexGen Biologics, Inc.', source: 'Email' },
          ],
          'Account Type': [
            { field: 'Applicant Type', value: 'Named Insured', source: 'ACORD 125' },
          ],
          'DBA': [
            { field: 'DBA', value: 'NexGen Bio', source: 'ACORD 125' },
          ],
          'Legal Entity': [
            { field: 'Business Type', value: 'Corporation', source: 'ACORD 125' },
            { field: 'Entity', value: 'Corporation', source: 'Email' },
          ],
          'Tax ID': [
            { field: 'FEIN', value: '84-3921004', source: 'ACORD 125' },
          ],
          'DUNS Number': [
            { field: 'D-U-N-S', value: '07-284-9931', source: 'ACORD 125' },
          ],
          'Industry': [
            { field: 'Nature of Business', value: 'Biotechnology', source: 'ACORD 125' },
            { field: 'Industry', value: 'Biotech / Life Sciences', source: 'Email' },
          ],
          'SIC Code': [
            { field: 'SIC', value: '2836', source: 'ACORD 125' },
          ],
          'NAICS Code': [
            { field: 'NAICS', value: '325414', source: 'ACORD 125' },
          ],
          'Website': [
            { field: 'Website', value: 'nexgenbio.com', source: 'Email' },
          ],
          'Billing Street': [
            { field: 'Mailing Address', value: '1450 W Fulton St', source: 'ACORD 125' },
          ],
          'Billing City': [
            { field: 'City', value: 'Chicago', source: 'ACORD 125' },
          ],
          'Billing State': [
            { field: 'State', value: 'IL', source: 'ACORD 125' },
          ],
          'Billing Zip': [
            { field: 'ZIP', value: '60607', source: 'ACORD 125' },
          ],
          'Phone': [
            { field: 'Business Phone', value: '(312) 555-0142', source: 'ACORD 125' },
          ],
          'Annual Revenue': [
            { field: 'Annual Revenue', value: '$84M', source: 'Email' },
          ],
          'Employees': [
            { field: 'No. of Employees', value: '320', source: 'ACORD 125' },
          ],
          'Year Established': [
            { field: 'Year Business Started', value: '2009', source: 'ACORD 125' },
          ],
        },
        // Account 1 → Contact — Dr. Elena Vasquez
        'a01SBPARTY0CON01': {
          'First Name': [
            { field: 'Contact First Name', value: 'Elena', source: 'ACORD 125' },
          ],
          'Last Name': [
            { field: 'Contact Last Name', value: 'Vasquez', source: 'ACORD 125' },
          ],
          'Title': [
            { field: 'Title', value: 'Chief Risk Officer', source: 'Email' },
          ],
          'Contact Role': [
            { field: 'Role', value: 'Primary Contact', source: 'Email' },
          ],
          'Email': [
            { field: 'Email', value: 'evasquez@nexgenbio.com', source: 'Email' },
          ],
          'Phone': [
            { field: 'Contact Phone', value: '(312) 555-0148', source: 'ACORD 125' },
          ],
          'Mobile': [
            { field: 'Mobile', value: '(312) 555-0199', source: 'Email' },
          ],
          'Mailing Street': [
            { field: 'Address', value: '1450 W Fulton St', source: 'ACORD 125' },
          ],
          'Mailing City': [
            { field: 'City', value: 'Chicago', source: 'ACORD 125' },
          ],
          'Mailing State': [
            { field: 'State', value: 'IL', source: 'ACORD 125' },
          ],
          'Mailing Zip': [
            { field: 'ZIP', value: '60607', source: 'ACORD 125' },
          ],
          'Preferred Contact Method': [
            { field: 'Preferred Contact', value: 'Email', source: 'Email' },
          ],
        },
        // Account 2 — Vanguard Insurance Partners
        'a01SBPARTY0ACC02': {
          'Account Name': [
            { field: 'Producer Name', value: 'Vanguard Insurance Partners', source: 'ACORD 125' },
            { field: 'Brokerage', value: 'Vanguard Insurance Partners LLC', source: 'Email' },
          ],
          'Account Type': [
            { field: 'Applicant Type', value: 'Broker', source: 'ACORD 125' },
          ],
          'DBA': [
            { field: 'DBA', value: 'Vanguard', source: 'ACORD 125' },
          ],
          'Legal Entity': [
            { field: 'Business Type', value: 'LLC', source: 'ACORD 125' },
          ],
          'Tax ID': [
            { field: 'FEIN', value: '47-1180265', source: 'ACORD 125' },
          ],
          'DUNS Number': [
            { field: 'D-U-N-S', value: '14-902-6650', source: 'ACORD 125' },
          ],
          'Industry': [
            { field: 'Nature of Business', value: 'Insurance Brokerage', source: 'ACORD 125' },
          ],
          'SIC Code': [
            { field: 'SIC', value: '6411', source: 'ACORD 125' },
          ],
          'NAICS Code': [
            { field: 'NAICS', value: '524210', source: 'ACORD 125' },
          ],
          'Website': [
            { field: 'Website', value: 'vanguardip.com', source: 'Email' },
          ],
          'Billing Street': [
            { field: 'Mailing Address', value: '200 S Wacker Dr', source: 'ACORD 125' },
          ],
          'Billing City': [
            { field: 'City', value: 'Chicago', source: 'ACORD 125' },
          ],
          'Billing State': [
            { field: 'State', value: 'IL', source: 'ACORD 125' },
          ],
          'Billing Zip': [
            { field: 'ZIP', value: '60606', source: 'ACORD 125' },
          ],
          'Phone': [
            { field: 'Business Phone', value: '(312) 555-0300', source: 'ACORD 125' },
          ],
          'Annual Revenue': [
            { field: 'Annual Revenue', value: '$52M', source: 'Email' },
          ],
          'Employees': [
            { field: 'No. of Employees', value: '140', source: 'ACORD 125' },
          ],
          'Year Established': [
            { field: 'Year Business Started', value: '1998', source: 'ACORD 125' },
          ],
        },
        // Account 2 → Contact — Niki Paoloni
        'a01SBPARTY0CON02': {
          'First Name': [
            { field: 'Contact First Name', value: 'Niki', source: 'ACORD 125' },
          ],
          'Last Name': [
            { field: 'Contact Last Name', value: 'Paoloni', source: 'ACORD 125' },
          ],
          'Title': [
            { field: 'Title', value: 'Senior Account Broker', source: 'Email' },
          ],
          'Contact Role': [
            { field: 'Role', value: 'Producing Broker', source: 'Email' },
          ],
          'Email': [
            { field: 'Email', value: 'npaoloni@vanguardip.com', source: 'Email' },
          ],
          'Phone': [
            { field: 'Contact Phone', value: '(312) 555-0312', source: 'ACORD 125' },
          ],
          'Mobile': [
            { field: 'Mobile', value: '(312) 555-0355', source: 'Email' },
          ],
          'Mailing Street': [
            { field: 'Address', value: '200 S Wacker Dr', source: 'ACORD 125' },
          ],
          'Mailing City': [
            { field: 'City', value: 'Chicago', source: 'ACORD 125' },
          ],
          'Mailing State': [
            { field: 'State', value: 'IL', source: 'ACORD 125' },
          ],
          'Mailing Zip': [
            { field: 'ZIP', value: '60606', source: 'ACORD 125' },
          ],
          'Preferred Contact Method': [
            { field: 'Preferred Contact', value: 'Phone', source: 'Email' },
          ],
        },
        // ── Shared Locations ──
        // Location 1 — Chicago HQ Warehouse
        'a01SBSHLOC01': {
          'Street Address': [
            { field: 'Location Address', value: '1450 W Fulton St', source: 'ACORD 140' },
            { field: 'Address', value: '1450 West Fulton Street', source: 'Email' },
          ],
          'City': [
            { field: 'City', value: 'Chicago', source: 'ACORD 140' },
          ],
          'State': [
            { field: 'State', value: 'IL', source: 'ACORD 140' },
          ],
          'Zip': [
            { field: 'ZIP', value: '60607', source: 'ACORD 140' },
          ],
          'Country': [
            { field: 'Country', value: 'USA', source: 'ACORD 140' },
          ],
          'Construction Type': [
            { field: 'Construction Type', value: 'Masonry Non-Combustible', source: 'ACORD 140' },
            { field: 'Construction', value: 'Non-Combustible', source: 'Email' },
          ],
          'Year Built': [
            { field: 'Year Built', value: '2004', source: 'ACORD 140' },
          ],
          'Square Footage': [
            { field: 'Building Area', value: '82,000', source: 'ACORD 140' },
          ],
          'Number of Stories': [
            { field: 'Stories', value: '2', source: 'ACORD 140' },
          ],
          'Occupancy Type': [
            { field: 'Occupancy', value: 'Warehouse', source: 'ACORD 140' },
          ],
          'Sprinklered': [
            { field: 'Sprinklered', value: 'Full', source: 'ACORD 140' },
          ],
          'Fire Alarm': [
            { field: 'Fire Alarm', value: 'Central Station', source: 'ACORD 140' },
          ],
          'Security': [
            { field: 'Security', value: '24/7 Guard', source: 'Email' },
          ],
          'Building Value': [
            { field: 'Building Value', value: '$12.5M', source: 'ACORD 140' },
          ],
        },
        // Location 2 — Austin Distribution Center
        'a01SBSHLOC02': {
          'Street Address': [
            { field: 'Location Address', value: '5600 E Ben White Blvd', source: 'ACORD 140' },
          ],
          'City': [
            { field: 'City', value: 'Austin', source: 'ACORD 140' },
          ],
          'State': [
            { field: 'State', value: 'TX', source: 'ACORD 140' },
          ],
          'Zip': [
            { field: 'ZIP', value: '78741', source: 'ACORD 140' },
          ],
          'Country': [
            { field: 'Country', value: 'USA', source: 'ACORD 140' },
          ],
          'Construction Type': [
            { field: 'Construction Type', value: 'Fire Resistive', source: 'ACORD 140' },
          ],
          'Year Built': [
            { field: 'Year Built', value: '2015', source: 'ACORD 140' },
          ],
          'Square Footage': [
            { field: 'Building Area', value: '64,000', source: 'ACORD 140' },
          ],
          'Number of Stories': [
            { field: 'Stories', value: '1', source: 'ACORD 140' },
          ],
          'Occupancy Type': [
            { field: 'Occupancy', value: 'Distribution', source: 'ACORD 140' },
          ],
          'Sprinklered': [
            { field: 'Sprinklered', value: 'Full', source: 'ACORD 140' },
          ],
          'Fire Alarm': [
            { field: 'Fire Alarm', value: 'Central Station', source: 'ACORD 140' },
          ],
          'Security': [
            { field: 'Security', value: 'Card Access', source: 'ACORD 140' },
          ],
          'Building Value': [
            { field: 'Building Value', value: '$8.2M', source: 'ACORD 140' },
          ],
        },
        // Location 3 — San Jose R&D Lab
        'a01SBSHLOC03': {
          'Street Address': [
            { field: 'Location Address', value: '2811 Zanker Rd', source: 'ACORD 140' },
          ],
          'City': [
            { field: 'City', value: 'San Jose', source: 'ACORD 140' },
          ],
          'State': [
            { field: 'State', value: 'CA', source: 'ACORD 140' },
          ],
          'Zip': [
            { field: 'ZIP', value: '95134', source: 'ACORD 140' },
          ],
          'Country': [
            { field: 'Country', value: 'USA', source: 'ACORD 140' },
          ],
          'Construction Type': [
            { field: 'Construction Type', value: 'Fire Resistive', source: 'ACORD 140' },
          ],
          'Year Built': [
            { field: 'Year Built', value: '2018', source: 'ACORD 140' },
          ],
          'Square Footage': [
            { field: 'Building Area', value: '48,000', source: 'ACORD 140' },
          ],
          'Number of Stories': [
            { field: 'Stories', value: '3', source: 'ACORD 140' },
          ],
          'Occupancy Type': [
            { field: 'Occupancy', value: 'Laboratory', source: 'ACORD 140' },
          ],
          'Sprinklered': [
            { field: 'Sprinklered', value: 'Full', source: 'ACORD 140' },
          ],
          'Fire Alarm': [
            { field: 'Fire Alarm', value: 'Central Station', source: 'ACORD 140' },
          ],
          'Security': [
            { field: 'Security', value: '24/7 Guard', source: 'ACORD 140' },
          ],
          'Building Value': [
            { field: 'Building Value', value: '$15.8M', source: 'ACORD 140' },
          ],
        },
        // L1-B1 - Main Warehouse
        'a01SB00001p8BA5YAM': {
          'Construction Type': [
            { field: 'Construction Type', value: 'Masonry Non-Combustible', source: 'ACORD 140' },
            { field: 'Construction', value: 'Non-Combustible Masonry', source: 'Email' },
            { field: 'Building Construction', value: 'Masonry', source: 'ACORD 125' },
          ],
          'Year Built': [
            { field: 'Year Built', value: '1998', source: 'ACORD 140', updated: true },
            { field: 'Year Built', value: '2002', source: 'Email' },
            { field: 'Construction Year', value: '1998', source: 'ACORD 125' },
          ],
          'Square Footage': [
            { field: 'Square Footage', value: '120,000', source: 'Email' },
            { field: 'Building Area', value: '120,000', source: 'ACORD 140', updated: true },
            { field: 'Area', value: '118,500', source: 'ACORD 125' },
          ],
          'Stories': [
            { field: 'Stories', value: '1', source: 'ACORD 140' },
            { field: 'Number of Floors', value: '1', source: 'Email' },
          ],
          'Roof Type': [
            { field: 'Roof Type', value: 'TPO Membrane', source: 'ACORD 140', updated: true },
            { field: 'Roofing', value: 'TPO', source: 'Email' },
          ],
          'Roof Year': [
            { field: 'Roof Year', value: '2018', source: 'ACORD 140' },
            { field: 'Roof Replacement', value: '2018', source: 'Email' },
            { field: 'Last Roof Update', value: '2017', source: 'ACORD 125' },
          ],
          'Occupancy': [
            { field: 'Occupancy', value: 'Warehouse/Distribution', source: 'ACORD 140' },
            { field: 'Use', value: 'Warehouse and Distribution', source: 'Email' },
            { field: 'Building Use', value: 'Warehousing', source: 'ACORD 125' },
          ],
        },
        // Location 1 - Chicago Warehouse
        'a01SB00001p8B6rYAE': {
          'Address': [
            { field: 'Address', value: '1450 W Fulton St, Chicago, IL 60607', source: 'ACORD 140', updated: true },
            { field: 'Street Address', value: '1448 W Fulton Street, Chicago, IL 60607', source: 'Email' },
            { field: 'Location', value: '1450 West Fulton St, Chicago IL 60607', source: 'ACORD 125' },
            { field: 'Street Address', value: '1450 W Fulton St, Chicago, IL 60607', source: 'Statement of Values' },
            { field: 'Street Address', value: '1450 W Fulton St', source: 'Site Survey Photo' },
          ],
          'City': [
            { field: 'City', value: 'Chicago', source: 'ACORD 140' },
            { field: 'City', value: 'Chicago', source: 'Email' },
            { field: 'City', value: 'Chicago', source: 'ACORD 125' },
            { field: 'City', value: 'Chicago', source: 'Statement of Values' },
          ],
          'State': [
            { field: 'State', value: 'IL', source: 'ACORD 140' },
            { field: 'State', value: 'Illinois', source: 'Email' },
            { field: 'State', value: 'IL', source: 'ACORD 125' },
            { field: 'State', value: 'IL', source: 'Statement of Values' },
          ],
          'Zip': [
            { field: 'Zip', value: '60607', source: 'ACORD 140' },
            { field: 'ZIP Code', value: '60612', source: 'Email' },
            { field: 'ZIP', value: '60607', source: 'ACORD 125' },
            { field: 'ZIP', value: '60607', source: 'Statement of Values' },
          ],
          'County': [
            { field: 'County', value: 'Cook', source: 'Statement of Values' },
          ],
          'Country': [
            { field: 'Country', value: 'USA', source: 'ACORD 140' },
            { field: 'Country', value: 'United States', source: 'Email' },
          ],
          'Sprinklered': [
            { field: 'Sprinklered', value: 'Yes', source: 'ACORD 140' },
            { field: 'Sprinkler System', value: 'Full Coverage', source: 'Email' },
            { field: 'Fire Suppression', value: 'Sprinklered', source: 'ACORD 125' },
            { field: 'automaticSprinkler', value: 'Full', source: 'Verisk 360' },
            { field: 'Sprinkler', value: 'Full', source: 'Statement of Values' },
          ],
          'Fire Alarm': [
            { field: 'Fire Alarm', value: 'Yes', source: 'ACORD 140' },
            { field: 'Alarm System', value: 'Central Station', source: 'Email' },
            { field: 'Fire Alarm', value: 'Central Station Monitored', source: 'ACORD 125' },
            { field: 'fireAlarmType', value: 'Central Station', source: 'Verisk 360' },
            { field: 'Alarm', value: 'Central', source: 'Statement of Values' },
          ],
          'Occupancy Type': [
            { field: 'Occupancy', value: 'Cold Storage', source: 'Statement of Values' },
          ],
          'Building Value': [
            { field: 'Bldg Value', value: '$28,640,000', source: 'Statement of Values' },
          ],
          'Contents Value': [
            { field: 'Contents Value', value: '$6,200,000', source: 'Statement of Values' },
          ],
          'Business Income Value': [
            { field: 'BI Value', value: '$4,100,000', source: 'Statement of Values' },
          ],
          'Security': [
            { field: 'Security', value: '24/7 Guard', source: 'ACORD 140' },
            { field: 'Security System', value: '24-Hour Guard Service', source: 'Email' },
          ],
          // Protection Class comes only from an enrichment API (ISO), no ACORD/email source.
          'Protection Class': [
            { field: 'isoPPC', value: '3', source: 'ISO' },
          ],
          // ── Comprehensive Verisk 360 property enrichment. Enrichment (Verisk/ISO) candidates are
          //    listed LAST in each array so that when they are stripped through line steps 1–3 the
          //    non-enrichment (doc/SoV) candidates keep stable indices and the doc/SoV source stays
          //    the selected winner (index 0). At step 4 the enrichment value appears and maps to the
          //    same canonical term IN ADDITION to the existing source (multiple sources per term).
          // Construction basics also appear on the broker's ACORD 140 Property Section
          // (construction/roof/utilities) and the Statement of Values.
          'Construction Type': [
            { field: 'Construction', value: 'Masonry NC', source: 'Statement of Values' },
            { field: 'Construction Type', value: 'Masonry Non-Combustible', source: 'ACORD 140' },
            { field: 'constructionClass', value: 'Masonry Non-Combustible', source: 'Verisk 360' },
          ],
          'Year Built': [
            { field: 'Year Built', value: '1998', source: 'Statement of Values' },
            { field: 'Year Built', value: '1998', source: 'ACORD 140' },
            { field: 'yearBuilt', value: '1998', source: 'Verisk 360' },
          ],
          'Total Building Area': [
            { field: 'Sq Ft', value: '142,000', source: 'Statement of Values' },
            { field: 'Total Building Area', value: '142,000 sq ft', source: 'ACORD 140' },
            { field: 'totalFloorArea', value: '142,000 sq ft', source: 'Verisk 360' },
          ],
          'Number of Stories': [
            { field: 'Number of Stories', value: '1', source: 'ACORD 140' },
            { field: 'numStories', value: '1', source: 'Verisk 360' },
          ],
          'Basement Type': [
            { field: 'Basement', value: 'None', source: 'ACORD 140' },
            { field: 'basementType', value: 'None', source: 'Verisk 360' },
          ],
          'Roof Type': [
            { field: 'Roof Type', value: 'Flat', source: 'ACORD 140' },
            { field: 'roofType', value: 'Flat', source: 'Verisk 360' },
          ],
          'Roof Covering': [
            { field: 'Roof Material', value: 'TPO Membrane', source: 'ACORD 140' },
            { field: 'roofCover', value: 'TPO Membrane', source: 'Verisk 360' },
          ],
          'Roof Age': [
            { field: 'Roof Updated', value: '6 years', source: 'ACORD 140' },
            { field: 'roofAge', value: '6 years', source: 'Verisk 360' },
          ],
          'Roof Condition': [
            { field: 'roofCondition', value: 'Good', source: 'Verisk 360' },
          ],
          'Building Condition': [
            { field: 'buildingCondition', value: 'Good', source: 'Verisk 360' },
          ],
          'Wiring Type': [
            { field: 'Wiring', value: 'Copper', source: 'ACORD 140' },
            { field: 'wiringType', value: 'Copper', source: 'Verisk 360' },
          ],
          'Electrical Update Year': [
            { field: 'Wiring Updated', value: '2015', source: 'ACORD 140' },
            { field: 'electricalUpdateYear', value: '2015', source: 'Verisk 360' },
          ],
          'Plumbing Type': [
            { field: 'Plumbing', value: 'Copper', source: 'ACORD 140' },
            { field: 'plumbingType', value: 'Copper', source: 'Verisk 360' },
          ],
          'Heating System': [
            { field: 'Heating', value: 'Gas-Fired Unit Heaters', source: 'ACORD 140' },
            { field: 'heatingSystem', value: 'Gas-Fired Unit Heaters', source: 'Verisk 360' },
          ],
          'HVAC Age': [
            { field: 'hvacAge', value: '8 years', source: 'Verisk 360' },
          ],
          'Exterior Wall Material': [
            { field: 'Exterior Walls', value: 'Brick', source: 'ACORD 140' },
            { field: 'wallMaterial', value: 'Brick', source: 'Verisk 360' },
          ],
          'Foundation Type': [
            { field: 'foundation', value: 'Slab', source: 'Verisk 360' },
          ],
          'Latitude': [
            { field: 'geoLat', value: '41.8866', source: 'Verisk 360' },
          ],
          'Longitude': [
            { field: 'geoLon', value: '-87.6593', source: 'Verisk 360' },
          ],
          'FEMA Flood Zone': [
            { field: 'femaFloodZone', value: 'X', source: 'Verisk 360' },
          ],
          'Distance to Coast': [
            { field: 'coastDistance', value: '687 mi', source: 'Verisk 360' },
          ],
          'Earthquake Zone': [
            { field: 'eqZone', value: 'Low', source: 'Verisk 360' },
          ],
          'Fire Station Distance': [
            { field: 'fireStationDistance', value: '0.6 mi', source: 'Verisk 360' },
          ],
          'Water Supply Type': [
            { field: 'waterSupply', value: 'Municipal', source: 'Verisk 360' },
          ],
          'Building Replacement Cost': [
            { field: 'replacementCost', value: '$18.4M', source: 'Verisk 360' },
          ],
          'Wildfire Risk Score': [
            { field: 'wildfireScore', value: '4', source: 'Verisk 360' },
          ],
          'Hail Risk Zone': [
            { field: 'hailZone', value: 'Moderate', source: 'Verisk 360' },
          ],
        },
        // L1-B2 - Loading Dock Annex
        'a01SB00001p8BGXYA2': {
          'Construction Type': [
            { field: 'Construction Type', value: 'Joisted Masonry', source: 'ACORD 140' },
            { field: 'Construction', value: 'Masonry Joisted', source: 'Email' },
          ],
          'Year Built': [
            { field: 'Year Built', value: '2005', source: 'ACORD 140' },
            { field: 'Construction Year', value: '2005', source: 'Email' },
          ],
          'Square Footage': [
            { field: 'Square Footage', value: '22,000', source: 'ACORD 140' },
            { field: 'Building Area', value: '22,000', source: 'Email' },
            { field: 'Total Area', value: '21,800', source: 'ACORD 125' },
          ],
          'Roof Type': [
            { field: 'Roof Type', value: 'Built-Up', source: 'ACORD 140' },
            { field: 'Roofing', value: 'Built-Up Roof', source: 'Email' },
          ],
          'Roof Year': [
            { field: 'Roof Year', value: '2020', source: 'ACORD 140' },
            { field: 'Roof Installed', value: '2020', source: 'Email' },
          ],
          'Occupancy': [
            { field: 'Occupancy', value: 'Loading/Shipping', source: 'ACORD 140' },
            { field: 'Use', value: 'Loading Dock & Shipping', source: 'Email' },
          ],
        },
        // Location 2 - Austin Office Campus
        'a01SB00001p85SsYAI': {
          'Address': [
            { field: 'Address', value: '500 Congress Ave, Austin, TX 78701', source: 'ACORD 140' },
            { field: 'Street Address', value: '500 Congress Avenue, Austin, Texas 78701', source: 'Email' },
            { field: 'Location', value: '500 Congress Ave, Austin TX 78701', source: 'ACORD 125' },
          ],
          'Sprinklered': [
            { field: 'Sprinklered', value: 'Yes', source: 'ACORD 140' },
            { field: 'Sprinkler System', value: 'Partial', source: 'Email' },
          ],
        },
        // L2-B1 - HQ Tower
        'a01SB00001p8BObYAM': {
          'Construction Type': [
            { field: 'Construction Type', value: 'Fire Resistive', source: 'ACORD 140' },
            { field: 'Construction', value: 'Steel Frame Fire Resistive', source: 'Email' },
          ],
          'Year Built': [
            { field: 'Year Built', value: '2010', source: 'ACORD 140' },
            { field: 'Construction Year', value: '2011', source: 'Email' },
          ],
          'Stories': [
            { field: 'Stories', value: '12', source: 'ACORD 140' },
            { field: 'Number of Floors', value: '13', source: 'Email' },
          ],
        },
        // L2-B2 - R&D Lab Building
        'a01SB00001p8BTRYA2': {
          'Square Footage': [
            { field: 'Square Footage', value: '32,000', source: 'ACORD 140' },
            { field: 'Building Area', value: '31,500', source: 'Email' },
          ],
          'Occupancy': [
            { field: 'Occupancy', value: 'Laboratory/R&D', source: 'ACORD 140' },
            { field: 'Use', value: 'Research Laboratory', source: 'Email' },
          ],
        },
        // Location 3A - San Jose Manufacturing Campus
        'a01SB00001pDUP3A': {
          'Address': [
            { field: 'Address', value: '2500 Augustine Dr, San Jose, CA 95054', source: 'ACORD 140' },
            { field: 'Street Address', value: '2500 Augustine Drive, San Jose, CA 95054', source: 'Email' },
          ],
          'Security': [
            { field: 'Security', value: '24/7 Security + CCTV', source: 'ACORD 140' },
            { field: 'Security System', value: '24-Hour Guard with Video Surveillance', source: 'Email' },
          ],
        },
        // L3A-B1 - Manufacturing Building A
        'a01SB00001pDUP3AB1': {
          'Square Footage': [
            { field: 'Square Footage', value: '145,000', source: 'ACORD 140' },
            { field: 'Building Area', value: '148,000', source: 'Email' },
            { field: 'Area', value: '145,500', source: 'ACORD 125' },
          ],
          'Year Built': [
            { field: 'Year Built', value: '2008', source: 'ACORD 140' },
            { field: 'Construction Year', value: '2007', source: 'Email' },
          ],
        },
        // Location 3B - San Jose Manufacturing Facility
        'a01SB00001pDUP3B': {
          'Address': [
            { field: 'Address', value: '2500 Augustine Drive, San Jose, California 95054', source: 'ACORD 140' },
            { field: 'Street Address', value: '2500 Augustine Dr, San Jose CA 95054', source: 'Email' },
          ],
          'Sprinklered': [
            { field: 'Sprinklered', value: 'Full System', source: 'ACORD 140' },
            { field: 'Fire Suppression', value: 'Complete Sprinkler Coverage', source: 'Email' },
          ],
        },
        // L3B-B1 - Manufacturing Facility Building A
        'a01SB00001pDUP3BB1': {
          'Square Footage': [
            { field: 'Square Footage', value: '148,000', source: 'ACORD 140' },
            { field: 'Building Area', value: '145,000', source: 'Email' },
          ],
          'Construction Type': [
            { field: 'Construction Type', value: 'Fire Resistive', source: 'ACORD 140' },
            { field: 'Construction', value: 'Fire Resistive Steel', source: 'Email' },
          ],
        },
        // General Liability LOB
        'a01SB00001pGYUTYA4': {
          'Premium Basis': [
            { field: 'Premium Basis', value: 'Payroll + Sales + Area', source: 'ACORD 126' },
            { field: 'Rating Basis', value: 'Payroll + Sales', source: 'Email' },
            { field: 'Exposure Basis', value: 'Payroll, Sales, Area', source: 'ACORD 140' },
          ],
        },
      },

      overviewLobTiles: [
        {
          name: 'Commercial Property',
          lineId: 'a01SB00001p8B5FYAU',
          stage: 'Submission Line Created',
          next: 'Resolve data discrepancies and duplicates',
          progress: 2,
          hasWarning: true,
          assignedTo: 'Manish Arya (Underwriter)',
          // Demo-anchored minutes since the demo "now" used to render relative time
          lastActivityMinutesAgo: 18,
          // Pulled from the line's Needs Attention items. >1 → "N items need attention"
          attentionItems: [
            'Conflicting street address for Location 1 - Chicago Warehouse across ACORD 140, ACORD 125, and the broker email.',
            'Year Built, Square Footage, and Roof Year on L1-B1 - Main Warehouse disagree across sources.',
            'Location 3A and 3B in San Jose appear to be duplicates and need to be merged.',
          ],
        },
        {
          name: 'General Liability',
          lineId: 'a01SB00001pGYUTYA4',
          stage: 'Submission Line Created',
          next: 'Resolve data discrepancies and duplicates',
          progress: 2,
          hasWarning: true,
          assignedTo: 'David Chen (Underwriter)',
          lastActivityMinutesAgo: 142,
          attentionItems: [
            'Premium Basis conflicts across ACORD 126, ACORD 140, and the broker email.',
          ],
        },
      ],

      activities: [
        {
          id: 'act-submission-triaged',
          title: 'Submission Triaged',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Agent',
          completedBy: '',
          timestamp: '9:44 AM · May 13',
          status: 'completed' as const,
          details: 'Submission lines were triaged and assigned to underwriters for discrepancy resolution and quoting.',
          detailsList: [
            'Commercial Property assigned to Martha (UW Team Lead)',
            'General Liability assigned to David Chen (Underwriter)',
          ],
        },
        {
          id: 'act-data-reconciliation',
          title: 'Data Reconciliation',
          description: 'NexGen Biologics Inc New Business · Dependent Task · Completed by Agent',
          completedBy: '',
          timestamp: '9:42 AM · May 13',
          status: 'completed' as const,
          dependentOn: 'Complete Data Extraction',
          warningMessage: 'Data discrepancies and duplicate values found while creating the Commercial Property and General Liability submission lines. Resolve from the respective line of business before quoting.',
          agenticSteps: [
            {
              id: 'dr-step-1',
              title: 'Load Raw Extracted Data',
              status: 'completed' as const,
              timestamp: '9:20 AM',
              details: 'Loaded the canonical extracted dataset produced by Complete Data Extraction — covering ACORD 125, 140, 126, the broker email thread, and the Business Auto narrative.',
            },
            {
              id: 'dr-step-2',
              title: 'Field Normalization',
              status: 'completed' as const,
              timestamp: '9:22 AM',
              details: 'Standardized field formats: addresses normalized to USPS format, FEIN to XX-XXXXXXX, NAICS validated against the official 2022 taxonomy, currency values to USD.',
            },
            {
              id: 'dr-step-3',
              title: 'Identify Lines of Business',
              status: 'completed' as const,
              timestamp: '9:25 AM',
              details: 'Identified 2 lines of business with sufficient data to create submission lines: Commercial Property (ACORD 125 + 140) and General Liability (ACORD 126). Business Auto could not be created — Schedule of Vehicles was not attached and the email narrative does not list VINs.',
            },
            {
              id: 'dr-step-4',
              title: 'Cross-Source Conflict Detection',
              status: 'completed' as const,
              timestamp: '9:30 AM',
              details: 'Compared overlapping fields across sources. Detected 4 discrepancies: TIV on ACORD 140 ($19,526,769) does not match the email narrative ($19,500,000); Hayward distribution center listed at 2 different street addresses across forms; effective date appears as 06/01/2026 on ACORD 125 and 06/15/2026 on ACORD 140; GL retroactive date shown twice with different values.',
            },
            {
              id: 'dr-step-5',
              title: 'Duplicate Detection',
              status: 'completed' as const,
              timestamp: '9:33 AM',
              details: 'Detected duplicate entries: Location 1 (San Jose main facility) appears on ACORD 140 twice with slightly different building values; one prior GL claim appears on ACORD 126 and again in the broker email loss commentary with mismatched paid amounts.',
            },
            {
              id: 'dr-step-6',
              title: 'Create Commercial Property Submission Line',
              status: 'completed' as const,
              timestamp: '9:37 AM',
              details: 'Created the Commercial Property submission line. Loaded 3 California locations, $19,526,769 TIV, Fire Resistive construction, Protection Class 3, sprinklered with central station alarms. Open data discrepancies attached to the line for underwriter review.',
            },
            {
              id: 'dr-step-7',
              title: 'Create General Liability Submission Line',
              status: 'completed' as const,
              timestamp: '9:40 AM',
              details: 'Created the General Liability submission line. Loaded $1M per-occurrence / $2M aggregate, GL class 50714, $5,000 deductible, products/completed operations included. Duplicate prior-claim entry flagged on the line for underwriter review.',
            },
            {
              id: 'dr-step-8',
              title: 'Link Lineage and Finalize',
              status: 'completed' as const,
              timestamp: '9:42 AM',
              details: 'Attached source lineage to every field on each submission line — pointing each value back to its source document or email — and surfaced 5 open discrepancies and 2 duplicates for resolution on the respective lines of business.',
            },
          ],
        },
        {
          id: 'act-complete-extraction',
          title: 'Complete Data Extraction',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Agent',
          completedBy: '',
          timestamp: '9:18 AM · May 13',
          status: 'completed' as const,
          agenticSteps: [
            {
              id: 'cde-step-1',
              title: 'Source Inventory',
              status: 'completed' as const,
              timestamp: '9:02 AM',
              details: 'Aggregated sources for extraction: ACORD 125 + 140, ACORD 126, the original broker email, and the FEIN reply email.',
            },
            {
              id: 'cde-step-2',
              title: 'Email Body Extraction',
              status: 'completed' as const,
              timestamp: '9:04 AM',
              details: 'Parsed both broker emails for narrative coverage requests, vehicle counts, prior carrier history, and loss commentary.',
            },
            {
              id: 'cde-step-3',
              title: 'ACORD 125 — Full Extraction',
              status: 'completed' as const,
              timestamp: '9:07 AM',
              details: 'Pulled complete commercial application data: legal entity, FEIN, business address, NAICS, revenue, employee count, ownership, and operations description.',
            },
            {
              id: 'cde-step-4',
              title: 'ACORD 140 — Property Schedule Extraction',
              status: 'completed' as const,
              timestamp: '9:10 AM',
              details: 'Extracted full location schedule: 3 California facilities with construction, protection class, sprinklers, alarms, occupancy, and per-location TIV.',
            },
            {
              id: 'cde-step-5',
              title: 'ACORD 126 — General Liability Extraction',
              status: 'completed' as const,
              timestamp: '9:13 AM',
              details: 'Extracted per-occurrence and aggregate limits, GL class code, deductibles, products/completed operations, and prior GL claims history.',
            },
            {
              id: 'cde-step-6',
              title: 'Business Auto Schedule Extraction',
              status: 'completed' as const,
              timestamp: '9:15 AM',
              details: 'Extracted the 8-vehicle schedule from the broker email narrative — VIN, year/make/model, garaging location, radius of operation, and assigned driver class.',
            },
            {
              id: 'cde-step-7',
              title: 'Cross-Source Field Merge',
              status: 'completed' as const,
              timestamp: '9:17 AM',
              details: 'Merged fields extracted from email and documents into a single canonical view per coverage line.',
            },
            {
              id: 'cde-step-8',
              title: 'Persist Raw Extracted Data',
              status: 'completed' as const,
              timestamp: '9:18 AM',
              details: 'Persisted all raw extracted data and handed off to Data Reconciliation for line-of-business grouping and submission line creation.',
            },
          ],
        },
        {
          id: 'act-clearance',
          title: 'Clearance Check',
          description: 'NexGen Biologics Inc New Business · Dependent Task · Completed by Martha (UW Team Lead)',
          completedBy: '',
          timestamp: '9:00 AM · May 13',
          status: 'completed' as const,
          dependentOn: 'Data Completion Check',
          detailsList: [
            'Duplicate submission check: No prior submission for NexGen Biologics Inc with effective date 06/01/2026',
            'Producer status: Vanguard Insurance Partners — Active appointment, license valid through 12/31/2026',
            'Producer code: VIP-4471 — Confirmed in system',
            'Prior decline check: No declinations on file in the last 24 months',
            'Status: Eligible to quote',
          ],
        },
        {
          id: 'act-appetite',
          title: 'Appetite Check',
          description: 'NexGen Biologics Inc New Business · Dependent Task · Completed by Martha (UW Team Lead)',
          completedBy: '',
          timestamp: '8:55 AM · May 13',
          status: 'completed' as const,
          dependentOn: 'Data Completion Check',
          detailsList: [
            'NAICS code: 325412 (Pharmaceutical Preparation Manufacturing) — On approved class list',
            'Annual revenue: $47.2M — Within target range ($10M–$250M)',
            'Years in business: 12 — Above 5-year minimum',
            'Status: Within appetite',
          ],
        },
        {
          id: 'act-data-completion',
          title: 'Data Completion Check',
          description: 'NexGen Biologics Inc New Business · Dependent Task · Completed by Martha (UW Team Lead)',
          completedBy: '',
          timestamp: '8:48 AM · May 13',
          status: 'completed' as const,
          dependentOn: 'Partial Extraction',
          detailsList: [
            'Legal entity: NexGen Biologics Inc — Confirmed',
            'FEIN: 47-3829104 — Confirmed',
            'Business address: 2400 Innovation Way, San Jose, CA 95134 — Confirmed',
            'NAICS code: 325412 (Pharmaceutical Preparation Manufacturing) — Confirmed',
            'Producer: Niki Paoloni, Vanguard Insurance Partners — Confirmed',
            'Status: Complete — ready for Appetite and Clearance checks',
          ],
        },
        {
          id: 'act-partial-extraction-email',
          title: 'Partial Extraction',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Agent',
          completedBy: '',
          timestamp: '8:46 AM · May 13',
          status: 'completed' as const,
          agenticSteps: [
            {
              id: 'pe-step-1',
              title: 'Email Receipt Detected',
              status: 'completed' as const,
              timestamp: '8:38 AM',
              details: 'Detected new inbound message from npaoloni@vanguardins.com on the NexGen Biologics submission thread. Subject: "Re: FEIN Needed — NexGen Biologics Inc".',
            },
            {
              id: 'pe-step-2',
              title: 'Sender Verification',
              status: 'completed' as const,
              timestamp: '8:38 AM',
              details: 'Verified sender against producer record. Niki Paoloni (Vanguard Insurance Partners, producer code VIP-4471) matches the broker on file.',
            },
            {
              id: 'pe-step-3',
              title: 'Email Body Parsing',
              status: 'completed' as const,
              timestamp: '8:39 AM',
              details: 'Tokenized message body and stripped signature/quoted thread history. Isolated the new content from the broker.',
            },
            {
              id: 'pe-step-4',
              title: 'Entity Extraction — FEIN',
              status: 'completed' as const,
              timestamp: '8:41 AM',
              details: 'Scanned the reply for FEIN format (XX-XXXXXXX). Detected: 47-3829104.',
            },
            {
              id: 'pe-step-5',
              title: 'FEIN Format Validation',
              status: 'completed' as const,
              timestamp: '8:43 AM',
              details: 'Validated the extracted FEIN against the IRS 9-digit pattern and confirmed it is associated with NexGen Biologics Inc.',
            },
            {
              id: 'pe-step-6',
              title: 'Update Submission Record',
              status: 'completed' as const,
              timestamp: '8:45 AM',
              details: 'Wrote the confirmed FEIN to the NexGen Biologics submission and attached the broker reply email as evidence.',
            },
            {
              id: 'pe-step-7',
              title: 'Re-trigger Data Completion Check',
              status: 'completed' as const,
              timestamp: '8:46 AM',
              details: 'Queued the Data Completion Check for re-evaluation now that the FEIN is on the record.',
            },
          ],
        },
        {
          id: 'act-email-received',
          title: 'Email Received from Broker',
          description: 'NexGen Biologics Inc · Inbound Email · From Niki Paoloni',
          completedBy: '',
          timestamp: '8:38 AM · May 13',
          status: 'completed' as const,
          detailsList: [
            'From: Niki Paoloni <npaoloni@vanguardins.com>',
            'To: Martha Reyes <mreyes@nexus-uw.com>',
            'Subject: Re: FEIN Needed — NexGen Biologics Inc',
            'Received: May 13, 2026 at 8:38 AM',
            'FEIN provided: 47-3829104',
            'Attachments: None',
            'Status: Reply received — Partial Extraction parsing now',
          ],
        },
        {
          id: 'act-email-sent',
          title: 'Email Sent to Broker',
          description: 'NexGen Biologics Inc New Business · Outbound Email · Sent by Martha (UW Team Lead)',
          completedBy: '',
          timestamp: '10:32 PM · May 12',
          status: 'completed' as const,
          detailsList: [
            'From: Martha Reyes <mreyes@nexus-uw.com>',
            'To: Niki Paoloni <npaoloni@vanguardins.com>',
            'Subject: FEIN Needed — NexGen Biologics Inc',
            'Sent: May 12, 2026 at 10:32 PM',
            'Request: FEIN for NexGen Biologics Inc to complete the Data Completion Check',
            'Attachments: None',
          ],
        },
        {
          id: 'act-partial-extraction-126',
          title: 'Partial Extraction',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Agent',
          completedBy: '',
          timestamp: '9:40 PM · May 12',
          status: 'completed' as const,
          agenticSteps: [
            {
              id: 'step-1',
              title: 'Read Manual Classification',
              status: 'completed' as const,
              timestamp: '9:38 PM',
              details: 'Loaded the manual classification — pages 1-9 of ACORD 126 - Commercial General Liability.pdf identified as ACORD 126.',
            },
            {
              id: 'step-2',
              title: 'Create Extraction Request',
              status: 'completed' as const,
              timestamp: '9:38 PM',
              details: 'Created extraction request EXR-1003 (General Liability Data Extraction) against ACORD 126 - Commercial General Liability.pdf.',
            },
            {
              id: 'step-3',
              title: 'Data Extraction - ACORD 126',
              status: 'completed' as const,
              timestamp: '9:39 PM',
              details: 'Extracted: Coverage limits, Operations classification, Prior claims history.',
            },
            {
              id: 'step-4',
              title: 'Submission Record Update',
              status: 'completed' as const,
              timestamp: '9:40 PM',
              details: 'Merged the extracted general liability fields into the submission record alongside the existing ACORD 125 and ACORD 140 data.',
            },
          ],
        },
        {
          id: 'act-classify-doc',
          title: 'Classify Document',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Martha (UW Team Lead)',
          completedBy: '',
          timestamp: '9:38 PM · May 12',
          status: 'completed' as const,
          detailsList: [
            'Document: ACORD 126 - Commercial General Liability.pdf',
            'Pages 1-9 → ACORD · ACORD 126',
            'Status: Classification confirmed — extraction request created',
          ],
        },
        {
          id: 'act-2',
          title: 'Partial Extraction',
          description: 'NexGen Biologics Inc New Business · Stage Task · Completed by Agent',
          completedBy: '',
          timestamp: '9:33 PM · May 12',
          status: 'completed' as const,
          agenticSteps: [
            {
              id: 'step-1',
              title: 'Email Analysis',
              status: 'completed' as const,
              timestamp: '9:30 PM',
              details: 'Analyzed email content from Niki Paoloni requesting commercial property and general liability insurance coverage for NexGen Biologics.',
            },
            {
              id: 'step-2',
              title: 'Document Identification',
              status: 'completed' as const,
              timestamp: '9:31 PM',
              details: 'Classified ACORD 125 + 140 - Commercial Application & Property Section.pdf into 2 forms. Unable to classify ACORD 126 - Commercial General Liability.pdf — manual classification required.',
            },
            {
              id: 'step-3',
              title: 'Data Extraction - ACORD 125',
              status: 'completed' as const,
              timestamp: '9:32 PM',
              details: 'Extracted: Business name, Business type, Years in business, Annual revenue, Employee count.',
            },
            {
              id: 'step-4',
              title: 'Data Extraction - ACORD 140',
              status: 'completed' as const,
              timestamp: '9:33 PM',
              details: 'Extracted: Locations, Total insured value, Building construction, Protection class, Sprinkler systems.',
            },
          ],
        },
        {
          id: 'act-1',
          title: 'Submission Email Received',
          description: 'NexGen Biologics Inc New Business · Sent by Niki Paoloni',
          completedBy: '',
          timestamp: '9:30 PM · May 12',
          status: 'completed' as const,
          detailsList: [
            'Sender: Niki Paoloni',
            'Subject: New Business Submission - NexGen Biologics Commercial Insurance',
          ],
        },
      ],

      // Two review tasks — one per LOB submission line
      pendingTasks: [
        {
          id: 'task-review-property',
          title: 'Review Submission Line for Discrepancies',
          type: 'manual' as const,
          assignedTo: 'Martha (UW Team Lead)',
          parentLabel: 'Commercial Property',
          status: 'pending' as const,
          hasMarkComplete: true,
          description: 'Review the Commercial Property submission line and resolve the data discrepancies and duplicate values flagged during reconciliation.',
        },
        {
          id: 'task-review-gl',
          title: 'Review Submission Line for Discrepancies',
          type: 'manual' as const,
          assignedTo: 'Martha (UW Team Lead)',
          parentLabel: 'General Liability',
          status: 'pending' as const,
          hasMarkComplete: true,
          description: 'Review the General Liability submission line and resolve the data discrepancies and duplicate values flagged during reconciliation.',
        },
      ],

      // Documents — same as Step 8 (extraction complete)
      documents: [
        {
          id: 'doc-1',
          name: 'ACORD 125 + 140 - Commercial Application & Property Section.pdf',
          type: 'ACORD Forms',
          uploadDate: 'May 12, 2026',
          uploadedBy: 'Niki Paoloni',
          size: '3.9 MB',
          pageCount: 30,
          status: 'Extraction Complete' as const,
          extractionRequests: [
            { id: 'EXR-1001', type: 'Commercial Application Data Extraction', status: 'Complete', createdAt: '9:31 PM' },
            { id: 'EXR-1002', type: 'Property Schedule Extraction', status: 'Complete', createdAt: '9:31 PM' },
            { id: 'EXR-2001', type: 'Full Property Schedule Extraction', status: 'Complete', createdAt: '9:02 AM' },
            { id: 'EXR-2002', type: 'Business Auto Schedule Extraction', status: 'Complete', createdAt: '9:02 AM' },
          ],
          insights: {
            summary: 'A combined PDF containing two ACORD forms: ACORD 125 (Commercial Insurance Application) and ACORD 140 (Property Section).',
            keyFindings: [
              'Business Name: NexGen Biologics Inc',
              'NAICS Code: 325412 (Pharmaceutical Preparation Manufacturing)',
              'Years in Business: 12',
              'Annual Revenue: $47.2M',
              'Employee Count: 285 full-time',
              'Coverage Requested: Property, General Liability, Business Auto',
              '3 property locations identified — all in California',
              'Total Insured Value: $19,526,769',
              'Construction: Fire Resistive (all locations)',
              'Protection Class: 3',
              'Sprinkler systems: Yes — all locations',
              'Central station alarm monitoring: Yes',
            ],
            riskFactors: [],
            extractedData: [
              { field: 'Legal Entity', value: 'NexGen Biologics Inc' },
              { field: 'FEIN', value: '47-3829104' },
              { field: 'Business Address', value: '2400 Innovation Way, San Jose, CA 95134' },
              { field: 'Effective Date', value: '06/01/2026' },
              { field: 'Location 1 — Main Facility', value: 'San Jose, CA — $14.2M TIV' },
              { field: 'Location 2 — Distribution Center', value: 'Hayward, CA — $3.8M TIV' },
              { field: 'Location 3 — Office', value: 'San Jose, CA — $1.5M TIV' },
              { field: 'Valuation Basis', value: 'Replacement Cost' },
            ],
            missingInformation: [],
          },
        },
        {
          id: 'doc-3',
          name: 'ACORD 126 - Commercial General Liability.pdf',
          type: 'ACORD Forms',
          uploadDate: 'May 12, 2026',
          uploadedBy: 'Niki Paoloni',
          size: '1.5 MB',
          pageCount: 9,
          status: 'Extraction Complete' as const,
          extractionRequests: [
            { id: 'EXR-1003', type: 'General Liability Data Extraction', status: 'Complete', createdAt: '9:31 PM' },
            { id: 'EXR-2003', type: 'Full General Liability Extraction', status: 'Complete', createdAt: '9:02 AM' },
          ],
          insights: {
            summary: 'ACORD 126 — Commercial General Liability section of the new business submission.',
            keyFindings: [
              'Per-Occurrence Limit Requested: $1,000,000',
              'General Aggregate Limit Requested: $2,000,000',
              'Operations Classification: Pharmaceutical Manufacturing',
              'Products/Completed Operations: Included',
              'Prior GL Claims: 2 in past 3 years ($34,800 total)',
            ],
            riskFactors: [],
            extractedData: [
              { field: 'GL Class Code', value: '50714 — Drug, Medicine, or Pharmaceutical Mfg.' },
              { field: 'Deductible', value: '$5,000 per occurrence' },
              { field: 'Retroactive Date', value: 'None — Occurrence form' },
            ],
            missingInformation: [],
          },
        },
      ],

      emails: [
        {
          id: 'email-3',
          from: 'Niki Paoloni',
          fromInitials: 'NP',
          subject: 'Re: FEIN Needed — NexGen Biologics Inc',
          preview: 'Hi Martha, Thanks for the quick turnaround. The FEIN for NexGen Biologics Inc is 47-3829104...',
          date: '8:38 AM',
          fullDate: 'May 13, 2026',
          unread: false,
          hasAttachment: false,
          to: 'Martha (UW Team Lead)',
          body: `Hi Martha,

Thanks for the quick turnaround.

The FEIN for NexGen Biologics Inc is 47-3829104. Apologies for not including it on the original submission — let me know if you need anything else to keep things moving.

Best,
Niki Paoloni
Vanguard Insurance Partners
Direct: (555) 234-5678
npaoloni@vanguardins.com`,
          attachments: [],
        },
        {
          id: 'email-2',
          sent: true,
          from: 'Martha (UW Team Lead)',
          fromInitials: 'M',
          subject: 'FEIN Needed — NexGen Biologics Inc',
          preview: 'Hi Niki, Thanks for sending over the new business submission. We have started the Data Completion Check...',
          date: '10:32 PM',
          fullDate: 'May 12, 2026',
          unread: false,
          hasAttachment: false,
          to: 'Niki Paoloni <npaoloni@vanguardins.com>',
          body: `Hi Niki,

Thanks for sending over the new business submission for NexGen Biologics Inc. We have started the Data Completion Check and noticed the FEIN (Federal Employer Identification Number) is not on the submission.

Could you please reply with the FEIN for NexGen Biologics Inc? We need it to continue the qualifying checks and move the submission forward.

Let me know if you have any questions.

Best regards,
Martha
Underwriting Team Lead`,
          attachments: [],
        },
        {
          id: 'email-1',
          from: 'Niki Paoloni',
          fromInitials: 'NP',
          subject: 'New Business Submission - NexGen Biologics Commercial Insurance',
          preview: 'Good morning, I am submitting a new business request for NexGen Biologics Inc. They are seeking...',
          date: '9:30 AM',
          fullDate: 'May 12, 2026',
          unread: false,
          hasAttachment: true,
          to: 'Underwriting Team',
          body: `Good morning,

I am submitting a new business request for NexGen Biologics Inc. They are seeking comprehensive commercial insurance coverage including:

• Commercial Property Insurance
• Commercial General Liability
• Business Auto (8 vehicles)

Key Details:
- Business: Pharmaceutical manufacturing and distribution
- Years in Business: 12 years
- Annual Revenue: $47.2M
- Employees: 285 full-time
- Locations: 3 facilities (California)
- Total Insured Value: $19,526,769

The insured has a clean loss history with only one small property claim in the past 3 years ($12,500). They currently have coverage with another carrier but are looking to consolidate all lines with one carrier for better service and pricing.

Attached please find:
- ACORD 125 + 140 (combined Commercial Application & Property Section)
- ACORD 126 (General Liability Section)

Please let me know if you need any additional information. The client is hoping for indication by end of next week if possible.

Best regards,
Niki Paoloni
Vanguard Insurance Partners
Direct: (555) 234-5678
npaoloni@vanguardins.com`,
          attachments: [
            'ACORD 125 + 140 - Commercial Application & Property Section.pdf',
            'ACORD 126 - Commercial General Liability.pdf',
          ],
        },
      ],

      slackMessages: [],

      progressPath: {
        currentStage: 'in-progress',
        stages: [
          { key: 'draft', label: 'Draft', status: 'complete' },
          { key: 'in-progress', label: 'In Progress', status: 'current' },
          { key: 'processed', label: 'Processed', status: 'incomplete' },
        ],
      },
    },
  },

};

// ============================================================================
// STEP 10: Pricing & Quoting — discrepancies resolved, quote generation
// Built from Step 9's submission: the two "Review Submission Line for
// Discrepancies" tasks are now completed activities, the LOB tiles carry no
// alerts, Needs Attention is empty (no warning/error activities), and a new
// manual "Generate Quote" task is queued. Stage advances to Pricing and Quoting.
// Assigned dynamically so it can reference Step 9 without duplicating its data.
// ============================================================================
(stepConfigurations as any)[10] = (() => {
  const s9 = (stepConfigurations as any)[9].submission;
  return {
    submission: {
      ...s9,
      submissionLinesWarning: undefined,
      overviewLobTiles: s9.overviewLobTiles.map((tile: any) => ({
        ...tile,
        stage: 'Pricing and Quoting',
        next: 'Generate quote',
        hasWarning: false,
        attentionItems: [],
      })),
      activities: [
        {
          id: 'act-review-property-complete',
          title: 'Review Submission Line for Discrepancies',
          description: 'Commercial Property · Manual Task · Completed by Martha (UW Team Lead)',
          completedBy: '',
          timestamp: '10:14 AM · May 13',
          status: 'completed' as const,
          details: 'Reviewed the Commercial Property submission line and resolved all flagged data discrepancies and duplicate values.',
        },
        {
          id: 'act-review-gl-complete',
          title: 'Review Submission Line for Discrepancies',
          description: 'General Liability · Manual Task · Completed by Martha (UW Team Lead)',
          completedBy: '',
          timestamp: '10:09 AM · May 13',
          status: 'completed' as const,
          details: 'Reviewed the General Liability submission line and resolved all flagged data discrepancies and duplicate values.',
        },
        ...s9.activities.map((a: any) =>
          a.id === 'act-data-reconciliation' ? { ...a, warningMessage: undefined } : a
        ),
      ],
      pendingTasks: [
        {
          id: 'task-generate-quote',
          title: 'Generate Quote',
          type: 'manual' as const,
          assignedTo: 'Martha (UW Team Lead)',
          status: 'pending' as const,
          hasRunTask: true,
          runTaskLabel: 'Generate Quote',
          description: 'All data discrepancies and duplicates have been resolved on the Commercial Property and General Liability submission lines. Generate the quote to move the submission into pricing.',
        },
      ],
      progressPath: {
        currentStage: 'pricing-quoting',
        stages: [
          { key: 'draft', label: 'Draft', status: 'complete' },
          { key: 'in-progress', label: 'In Progress', status: 'complete' },
          { key: 'pricing-quoting', label: 'Pricing and Quoting', status: 'current' },
          { key: 'processed', label: 'Processed', status: 'incomplete' },
        ],
      },
    },
  };
})();

export type DemoStepConfig = typeof stepConfigurations;
