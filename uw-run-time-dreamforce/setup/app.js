// ── Navigation ──────────────────────────────────────────────

function toggle(id) {
  document.getElementById('children-' + id).classList.toggle('open');
  document.getElementById('chev-' + id).classList.toggle('open');
}

function selectItem(el, panelId) {
  if (panelId) {
    window.location.hash = '/' + panelId;
  }
}

document.querySelector('.nav-search input').addEventListener('input', function () {
  const q = this.value.toLowerCase().trim();
  document.querySelectorAll('.nav-node').forEach(node => {
    const text = node.querySelector('.nav-row span').textContent.toLowerCase();
    node.style.display = (!q || text.includes(q)) ? '' : 'none';
  });
});

// ── Shared util ──────────────────────────────────────────────

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[+m - 1]} ${+d}, ${y}`;
}

// ── Persistence helpers ──────────────────────────────────────

async function persistFields() {
  setFields(fields);
  setNextFieldId(nextFieldId);
  await saveConfig();
}

async function persistSc() {
  setStageConfigs(stageConfigs);
  setNextStageConfigId(nextScId);
  await saveConfig();
}

// ── Default Integration Connections ──────────────────────────

const DEFAULT_CONNECTIONS = [
  {
    id: 1,
    name: 'Verisk Property Analytics',
    provider: 'Verisk',
    type: 'REST API',
    status: 'Active',
    authType: 'API Key',
    baseUrl: 'https://api.verisk.com/property/v2',
    environment: 'production',
    lastSync: '2026-06-08T14:30:00Z',
    description: 'Commercial property risk assessment and construction data'
  },
  {
    id: 2,
    name: 'Verisk Underwriting Data',
    provider: 'Verisk',
    type: 'REST API',
    status: 'Active',
    authType: 'OAuth 2.0',
    baseUrl: 'https://api.verisk.com/underwriting/v3',
    environment: 'production',
    lastSync: '2026-06-08T13:45:00Z',
    description: 'Claims history and loss cost data'
  },
  {
    id: 3,
    name: 'D&B Business Credit',
    provider: 'Dun & Bradstreet',
    type: 'REST API',
    status: 'Active',
    authType: 'API Key',
    baseUrl: 'https://api.dnb.com/v1/credit',
    environment: 'production',
    lastSync: '2026-06-08T15:10:00Z',
    description: 'Business credit scores and financial health metrics'
  },
  {
    id: 4,
    name: 'D&B Firmographic Data',
    provider: 'Dun & Bradstreet',
    type: 'REST API',
    status: 'Active',
    authType: 'API Key',
    baseUrl: 'https://api.dnb.com/v1/company',
    environment: 'production',
    lastSync: '2026-06-08T14:50:00Z',
    description: 'Company demographics, industry classification, and employee count'
  },
  {
    id: 5,
    name: 'D&B Risk Insights',
    provider: 'Dun & Bradstreet',
    type: 'REST API',
    status: 'Active',
    authType: 'OAuth 2.0',
    baseUrl: 'https://api.dnb.com/v1/risk',
    environment: 'production',
    lastSync: '2026-06-08T12:20:00Z',
    description: 'Business failure risk and payment trends'
  },
  {
    id: 6,
    name: 'CoreLogic Property Intelligence',
    provider: 'CoreLogic',
    type: 'REST API',
    status: 'Active',
    authType: 'API Key',
    baseUrl: 'https://api.corelogic.com/property/v1',
    environment: 'production',
    lastSync: '2026-06-08T16:00:00Z',
    description: 'Property characteristics, valuations, and hazard data'
  },
  {
    id: 7,
    name: 'CoreLogic Natural Hazard Risk',
    provider: 'CoreLogic',
    type: 'REST API',
    status: 'Active',
    authType: 'OAuth 2.0',
    baseUrl: 'https://api.corelogic.com/hazard/v2',
    environment: 'production',
    lastSync: '2026-06-08T15:35:00Z',
    description: 'Flood, earthquake, wildfire risk assessments'
  },
  {
    id: 8,
    name: 'LexisNexis Business Reports',
    provider: 'LexisNexis',
    type: 'REST API',
    status: 'Active',
    authType: 'API Key',
    baseUrl: 'https://api.lexisnexis.com/business/v1',
    environment: 'production',
    lastSync: '2026-06-08T11:15:00Z',
    description: 'Business verification and ownership data'
  },
  {
    id: 9,
    name: 'LexisNexis Claims History',
    provider: 'LexisNexis',
    type: 'REST API',
    status: 'Inactive',
    authType: 'Basic Auth',
    baseUrl: 'https://sandbox.lexisnexis.com/claims/v1',
    environment: 'sandbox',
    lastSync: '2026-06-05T09:30:00Z',
    description: 'Historical liability claims and litigation records'
  },
  {
    id: 10,
    name: 'Verisk ISO Rating',
    provider: 'Verisk',
    type: 'REST API',
    status: 'Active',
    authType: 'API Key',
    baseUrl: 'https://api.verisk.com/iso/v1',
    environment: 'production',
    lastSync: '2026-06-08T14:00:00Z',
    description: 'ISO fire protection ratings and public protection classifications'
  }
];

// ── Default Enrichment Configurations ────────────────────────

const DEFAULT_ENRICHMENT_CONFIGS = [
  {
    id: 1,
    lob: 'Commercial Property',
    active: true,
    categories: [
      {
        id: 'property-characteristics',
        name: 'Property Characteristics',
        fields: [
          { name: 'Building Construction Type', type: 'Picklist' },
          { name: 'Year Built', type: 'Number' },
          { name: 'Total Building Square Footage', type: 'Number' },
          { name: 'Number of Stories', type: 'Number' },
          { name: 'Basement Type', type: 'Picklist' },
          { name: 'Roof Type', type: 'Picklist' },
          { name: 'Roof Covering Material', type: 'Picklist' },
          { name: 'Roof Age', type: 'Number' },
          { name: 'Roof Condition', type: 'Picklist' },
          { name: 'Overall Building Condition', type: 'Picklist' },
          { name: 'Wiring Type', type: 'Picklist' },
          { name: 'Electrical System Updated Year', type: 'Number' },
          { name: 'Plumbing Type', type: 'Picklist' },
          { name: 'Heating System Type', type: 'Picklist' },
          { name: 'HVAC Age', type: 'Number' },
          { name: 'Exterior Wall Material', type: 'Picklist' },
          { name: 'Foundation Type', type: 'Picklist' }
        ]
      },
      {
        id: 'location-cat-exposure',
        name: 'Location & CAT Exposure',
        fields: [
          { name: 'Property Address', type: 'Text' },
          { name: 'Latitude', type: 'Number' },
          { name: 'Longitude', type: 'Number' },
          { name: 'FEMA Flood Zone', type: 'Text' },
          { name: 'Flood Zone Panel Number', type: 'Text' },
          { name: 'Base Flood Elevation (BFE)', type: 'Number' },
          { name: 'Building First Floor Elevation', type: 'Number' },
          { name: 'Distance to Coast', type: 'Number' },
          { name: 'Distance to Major Water Body', type: 'Number' },
          { name: 'Earthquake Zone', type: 'Picklist' },
          { name: 'Peak Ground Acceleration (PGA)', type: 'Number' },
          { name: 'Probable Maximum Loss (PML) - EQ', type: 'Percent' },
          { name: 'Soil Liquefaction Risk', type: 'Picklist' },
          { name: 'Wildfire Hazard Severity Zone', type: 'Picklist' },
          { name: 'Wildfire Risk Score', type: 'Number' },
          { name: 'Distance to Fire Station', type: 'Number' },
          { name: 'Tornado Risk Zone', type: 'Picklist' },
          { name: 'Hurricane Wind Zone', type: 'Picklist' },
          { name: 'Hail Risk Zone', type: 'Picklist' },
          { name: 'Windstorm Deductible Required', type: 'Boolean' },
          { name: 'Aggregate Annual Loss (AAL)', type: 'Currency' },
          { name: 'Total Insured Value (TIV)', type: 'Currency' }
        ]
      },
      {
        id: 'fire-protection-response',
        name: 'Fire Protection & Response',
        fields: [
          { name: 'ISO Public Protection Class (PPC)', type: 'Number' },
          { name: 'Fire Hydrant Distance', type: 'Number' },
          { name: 'Number of Hydrants within 1000 ft', type: 'Number' },
          { name: 'Water Supply Type', type: 'Picklist' },
          { name: 'Water Supply Capacity (GPM)', type: 'Number' },
          { name: 'Fire Department Type', type: 'Picklist' },
          { name: 'Fire Station Response Time', type: 'Number' },
          { name: 'Automatic Sprinkler System', type: 'Picklist' },
          { name: 'Sprinkler System Type', type: 'Picklist' },
          { name: 'Sprinkler Coverage Percentage', type: 'Percent' },
          { name: 'Sprinkler System Install Date', type: 'Date' },
          { name: 'Sprinkler System Last Inspection', type: 'Date' },
          { name: 'Fire Alarm System', type: 'Picklist' },
          { name: 'Fire Alarm Monitoring Type', type: 'Picklist' },
          { name: 'Smoke Detection System', type: 'Boolean' },
          { name: 'Fire Extinguishers', type: 'Boolean' },
          { name: 'Fire Suppression System (Kitchen)', type: 'Picklist' },
          { name: 'Emergency Exit Lighting', type: 'Boolean' }
        ]
      },
      {
        id: 'occupancy-operations',
        name: 'Occupancy & Operations',
        fields: [
          { name: 'Primary Occupancy Type', type: 'Picklist' },
          { name: 'Specific Operations Description', type: 'Long Text Area' },
          { name: 'ISO Classification Code', type: 'Text' },
          { name: 'Percentage of Building - Office', type: 'Percent' },
          { name: 'Percentage of Building - Manufacturing', type: 'Percent' },
          { name: 'Percentage of Building - Warehouse', type: 'Percent' },
          { name: 'Combustible Loading', type: 'Picklist' },
          { name: 'Hazardous Materials Present', type: 'Boolean' },
          { name: 'Hazardous Materials Description', type: 'Long Text Area' },
          { name: 'Maximum Storage Height', type: 'Number' },
          { name: 'Hours of Operation', type: 'Text' },
          { name: 'Number of Shifts', type: 'Number' },
          { name: '24-Hour Watchman/Security', type: 'Boolean' },
          { name: 'Burglar Alarm System', type: 'Picklist' },
          { name: 'Security Camera System', type: 'Boolean' }
        ]
      },
      {
        id: 'claims-history',
        name: 'Claims History',
        fields: [
          { name: 'Number of Claims (5 years)', type: 'Number' },
          { name: 'Total Incurred Losses (5 years)', type: 'Currency' },
          { name: 'Number of Fire Claims', type: 'Number' },
          { name: 'Number of Water Damage Claims', type: 'Number' },
          { name: 'Number of Theft Claims', type: 'Number' },
          { name: 'Number of Wind/Hail Claims', type: 'Number' },
          { name: 'Largest Single Claim Amount', type: 'Currency' },
          { name: 'Most Recent Claim Date', type: 'Date' },
          { name: 'Most Recent Claim Description', type: 'Long Text Area' },
          { name: 'Claim Frequency (per $1M TIV)', type: 'Number' },
          { name: 'Claim Severity Average', type: 'Currency' },
          { name: 'Industry Average Claim Frequency', type: 'Number' },
          { name: 'Industry Average Claim Severity', type: 'Currency' },
          { name: 'Open Claims Count', type: 'Number' },
          { name: 'Subrogation Recoveries', type: 'Currency' }
        ]
      },
      {
        id: 'valuation-itv',
        name: 'Valuation & Insurance-to-Value',
        fields: [
          { name: 'Building Replacement Cost', type: 'Currency' },
          { name: 'Contents/PP&E Replacement Cost', type: 'Currency' },
          { name: 'Business Income Annual Value', type: 'Currency' },
          { name: 'Business Income Indemnity Period', type: 'Number' },
          { name: 'Extra Expense Value', type: 'Currency' },
          { name: 'Total Insured Value (TIV)', type: 'Currency' },
          { name: 'Building Insurance Amount', type: 'Currency' },
          { name: 'Contents Insurance Amount', type: 'Currency' },
          { name: 'BI/EE Insurance Amount', type: 'Currency' },
          { name: 'Insurance-to-Value Ratio (Building)', type: 'Percent' },
          { name: 'Insurance-to-Value Ratio (Total)', type: 'Percent' },
          { name: 'Coinsurance Penalty Potential', type: 'Currency' }
        ]
      },
      {
        id: 'building-code-compliance',
        name: 'Building Code & Compliance',
        fields: [
          { name: 'Building Code Year', type: 'Number' },
          { name: 'ADA Compliance Status', type: 'Picklist' },
          { name: 'Asbestos Present', type: 'Boolean' },
          { name: 'Lead Paint Present', type: 'Boolean' },
          { name: 'Underground Storage Tanks', type: 'Boolean' },
          { name: 'Radon Mitigation System', type: 'Boolean' },
          { name: 'Fire Code Compliance', type: 'Picklist' },
          { name: 'Occupancy Permit Current', type: 'Boolean' },
          { name: 'Recent Building Violations', type: 'Number' },
          { name: 'Renovations in Last 5 Years', type: 'Boolean' }
        ]
      }
    ]
  },
  {
    id: 2,
    lob: 'General Liability',
    active: true,
    categories: [
      {
        id: 'business-operations-exposure',
        name: 'Business Operations & Exposure',
        fields: [
          { name: 'Legal Business Name', type: 'Text' },
          { name: 'DBA (Doing Business As)', type: 'Text' },
          { name: 'Legal Entity Type', type: 'Picklist' },
          { name: 'Federal Tax ID (EIN)', type: 'Text' },
          { name: 'DUNS Number', type: 'Text' },
          { name: 'Years in Business', type: 'Number' },
          { name: 'Years Under Current Management', type: 'Number' },
          { name: 'Primary SIC Code', type: 'Text' },
          { name: 'Primary NAICS Code', type: 'Text' },
          { name: 'Business Description', type: 'Long Text Area' },
          { name: 'Annual Gross Revenue', type: 'Currency' },
          { name: 'Annual Payroll', type: 'Currency' },
          { name: 'Number of Full-Time Employees', type: 'Number' },
          { name: 'Number of Part-Time Employees', type: 'Number' },
          { name: 'Total Employee Count', type: 'Number' },
          { name: 'Products Manufactured', type: 'Long Text Area' },
          { name: 'Annual Product Sales', type: 'Currency' },
          { name: 'Services Provided', type: 'Long Text Area' },
          { name: 'Annual Service Revenue', type: 'Currency' },
          { name: 'Installation Services Provided', type: 'Boolean' },
          { name: 'Percentage Work On-Site', type: 'Percent' },
          { name: 'Percentage Work Off-Site', type: 'Percent' },
          { name: 'Subcontractors Used', type: 'Boolean' },
          { name: 'Annual Subcontractor Costs', type: 'Currency' }
        ]
      },
      {
        id: 'gl-claims-history',
        name: 'GL Claims History',
        fields: [
          { name: 'Number of GL Claims (5 years)', type: 'Number' },
          { name: 'Total GL Incurred (5 years)', type: 'Currency' },
          { name: 'Number of Bodily Injury Claims', type: 'Number' },
          { name: 'Number of Property Damage Claims', type: 'Number' },
          { name: 'Number of Products Liability Claims', type: 'Number' },
          { name: 'Number of Completed Ops Claims', type: 'Number' },
          { name: 'Largest GL Claim Amount', type: 'Currency' },
          { name: 'Most Recent GL Claim Date', type: 'Date' },
          { name: 'Most Recent GL Claim Description', type: 'Long Text Area' },
          { name: 'GL Claim Frequency Rate', type: 'Number' },
          { name: 'Industry Average GL Frequency', type: 'Number' },
          { name: 'Open GL Claims Count', type: 'Number' }
        ]
      },
      {
        id: 'safety-programs-osha',
        name: 'Safety Programs & OSHA',
        fields: [
          { name: 'Written Safety Program', type: 'Boolean' },
          { name: 'Safety Director/Officer', type: 'Boolean' },
          { name: 'Regular Safety Training', type: 'Picklist' },
          { name: 'New Employee Safety Orientation', type: 'Boolean' },
          { name: 'PPE Program', type: 'Boolean' },
          { name: 'Machine Guarding Program', type: 'Boolean' },
          { name: 'Lockout/Tagout Program', type: 'Boolean' },
          { name: 'Hazard Communication Program', type: 'Boolean' },
          { name: 'Emergency Action Plan', type: 'Boolean' },
          { name: 'OSHA 300 Log Maintained', type: 'Boolean' },
          { name: 'OSHA Inspections (5 years)', type: 'Number' },
          { name: 'OSHA Violations (5 years)', type: 'Number' },
          { name: 'OSHA Serious Violations', type: 'Number' },
          { name: 'OSHA Violations Abated', type: 'Boolean' },
          { name: 'DART Rate (Days Away/Restricted)', type: 'Number' },
          { name: 'TRIR (Total Recordable Incident Rate)', type: 'Number' }
        ]
      },
      {
        id: 'workers-comp-experience',
        name: 'Workers Compensation Experience',
        fields: [
          { name: 'Experience Modification Rate (EMR)', type: 'Number' },
          { name: 'EMR Effective Date', type: 'Date' },
          { name: 'Prior Year EMR', type: 'Number' },
          { name: 'EMR Trend', type: 'Picklist' },
          { name: 'Number of WC Claims (5 years)', type: 'Number' },
          { name: 'Total WC Incurred (5 years)', type: 'Currency' },
          { name: 'Number of Lost Time Claims', type: 'Number' },
          { name: 'Number of Medical Only Claims', type: 'Number' },
          { name: 'Largest WC Claim Amount', type: 'Currency' },
          { name: 'Return to Work Program', type: 'Boolean' },
          { name: 'WC Claim Frequency Rate', type: 'Number' },
          { name: 'Industry Average EMR', type: 'Number' },
          { name: 'Open WC Claims Count', type: 'Number' },
          { name: 'WC Coverage Current', type: 'Boolean' }
        ]
      },
      {
        id: 'financial-stability-credit',
        name: 'Financial Stability & Credit',
        fields: [
          { name: 'D&B Credit Rating', type: 'Text' },
          { name: 'D&B Credit Rating Score', type: 'Number' },
          { name: 'D&B Credit Risk Level', type: 'Picklist' },
          { name: 'D&B PAYDEX Score', type: 'Number' },
          { name: 'D&B Financial Stress Score', type: 'Number' },
          { name: 'D&B Failure Score', type: 'Number' },
          { name: 'D&B Delinquency Score', type: 'Percent' },
          { name: 'Annual Revenue (D&B)', type: 'Currency' },
          { name: 'Number of Employees (D&B)', type: 'Number' },
          { name: 'Years in Business (D&B)', type: 'Number' },
          { name: 'Out of Business Score', type: 'Percent' },
          { name: 'Public Records - Liens', type: 'Number' },
          { name: 'Public Records - Judgments', type: 'Number' },
          { name: 'Public Records - Bankruptcies', type: 'Number' },
          { name: 'Trade Payment Experiences', type: 'Number' },
          { name: 'Average Days to Pay', type: 'Number' },
          { name: 'Revenue Growth Rate (3 yr)', type: 'Percent' },
          { name: 'Financial Statement Available', type: 'Boolean' }
        ]
      },
      {
        id: 'products-liability-exposure',
        name: 'Products Liability Exposure',
        fields: [
          { name: 'Products Sold Annually (Units)', type: 'Number' },
          { name: 'Products Sold - Dollar Volume', type: 'Currency' },
          { name: 'Product Categories', type: 'Picklist' },
          { name: 'Product Testing Program', type: 'Boolean' },
          { name: 'Product Recalls (5 years)', type: 'Number' },
          { name: 'Product Warranty Period', type: 'Text' },
          { name: 'Product Instructions/Warnings', type: 'Boolean' },
          { name: 'FDA Regulated Products', type: 'Boolean' },
          { name: 'UL Listed/Certified Products', type: 'Boolean' },
          { name: 'Product Shelf Life', type: 'Text' },
          { name: 'Export Sales Percentage', type: 'Percent' },
          { name: 'Product Liability Limit Purchased', type: 'Currency' }
        ]
      },
      {
        id: 'contractual-operations-risk',
        name: 'Contractual & Operations Risk',
        fields: [
          { name: 'Percentage Work via Written Contract', type: 'Percent' },
          { name: 'Hold Harmless Agreements Signed', type: 'Boolean' },
          { name: 'Additional Insured Required by Contract', type: 'Boolean' },
          { name: 'Waiver of Subrogation Required', type: 'Boolean' },
          { name: 'Maximum Contract Size', type: 'Currency' },
          { name: 'Government Contracts', type: 'Boolean' },
          { name: 'Professional Services Provided', type: 'Boolean' },
          { name: 'Pollution Exposure', type: 'Picklist' },
          { name: 'Liquor Liability Exposure', type: 'Boolean' },
          { name: 'Employee Benefits Liability', type: 'Boolean' }
        ]
      }
    ]
  }
];

// ── Submission Object Fields ─────────────────────────────────

const DEFAULT_FIELDS = [
  { id: 1,  label: 'Submission Name',     api: 'Name',                   type: 'Text',                 required: true,  description: 'Unique name / reference number for the submission.', picklistValues: [] },
  { id: 2,  label: 'Broker',              api: 'Broker__c',              type: 'Text',                 required: true,  description: 'Name or ID of the broker submitting on behalf of the insured.', picklistValues: [] },
  { id: 3,  label: 'Carrier',             api: 'Carrier__c',             type: 'Text',                 required: true,  description: 'Target insurance carrier for this submission.', picklistValues: [] },
  { id: 4,  label: 'Submission Status',   api: 'Submission_Status__c',   type: 'Picklist',             required: true,  description: 'Current status of the submission in the workflow.', picklistValues: ['Draft','Submitted','Under Review','Quoted','Bound','Declined','Withdrawn'] },
  { id: 5,  label: 'Line of Business',    api: 'Line_of_Business__c',    type: 'Picklist',             required: true,  description: 'Insurance line being placed.', picklistValues: ['General Liability','Property','Cyber',"Workers' Compensation",'Professional Liability','Umbrella','Auto'] },
  { id: 6,  label: 'Insured Name',        api: 'Insured_Name__c',        type: 'Text',                 required: true,  description: 'Legal name of the insured entity.', picklistValues: [] },
  { id: 7,  label: 'Insured State',       api: 'Insured_State__c',       type: 'Picklist',             required: false, description: 'State of domicile for the insured.', picklistValues: ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'] },
  { id: 8,  label: 'Effective Date',      api: 'Effective_Date__c',      type: 'Date',                 required: true,  description: 'Policy effective date requested by the insured.', picklistValues: [] },
  { id: 9,  label: 'Expiration Date',     api: 'Expiration_Date__c',     type: 'Date',                 required: false, description: 'Policy expiration / renewal date.', picklistValues: [] },
  { id: 10, label: 'Date Submitted',      api: 'Date_Submitted__c',      type: 'Date/Time',            required: false, description: 'Timestamp when the submission was sent to the carrier.', picklistValues: [] },
  { id: 11, label: 'Requested Premium',   api: 'Requested_Premium__c',   type: 'Currency',             required: false, description: 'Target or estimated premium amount requested.', picklistValues: [] },
  { id: 12, label: 'Quoted Premium',      api: 'Quoted_Premium__c',      type: 'Currency',             required: false, description: 'Premium as quoted by the carrier.', picklistValues: [] },
  { id: 13, label: 'Bound Premium',       api: 'Bound_Premium__c',       type: 'Currency',             required: false, description: 'Final bound premium.', picklistValues: [] },
  { id: 14, label: 'Total Insured Value', api: 'Total_Insured_Value__c', type: 'Currency',             required: false, description: 'Total value of assets being insured.', picklistValues: [] },
  { id: 15, label: 'Commission Rate',     api: 'Commission_Rate__c',     type: 'Percent',              required: false, description: 'Broker commission percentage on this submission.', picklistValues: [] },
  { id: 16, label: 'Number of Employees', api: 'Number_of_Employees__c', type: 'Number',              required: false, description: 'Headcount of the insured entity.', picklistValues: [] },
  { id: 17, label: 'Annual Revenue',      api: 'Annual_Revenue__c',      type: 'Currency',             required: false, description: 'Reported annual revenue of the insured.', picklistValues: [] },
  { id: 18, label: 'Is Renewal',          api: 'Is_Renewal__c',          type: 'Boolean',              required: false, description: 'Indicates whether this is a renewal of an existing policy.', picklistValues: [] },
  { id: 19, label: 'Is Bound',            api: 'Is_Bound__c',            type: 'Boolean',              required: false, description: 'True once the submission has been bound into a policy.', picklistValues: [] },
  { id: 20, label: 'Priority',            api: 'Priority__c',            type: 'Picklist',             required: false, description: 'Internal priority flag for queue management.', picklistValues: ['Low','Medium','High','Urgent'] },
  { id: 21, label: 'Coverage Types',      api: 'Coverage_Types__c',      type: 'Multi-Select Picklist',required: false, description: 'All coverage types included in this submission.', picklistValues: ['Occurrence','Claims-Made','Per Location','Per Project','Blanket'] },
  { id: 22, label: 'Broker Email',        api: 'Broker_Email__c',        type: 'Email',                required: false, description: 'Primary email address of the broker contact.', picklistValues: [] },
  { id: 23, label: 'Broker Phone',        api: 'Broker_Phone__c',        type: 'Phone',                required: false, description: 'Direct phone number for the broker.', picklistValues: [] },
  { id: 24, label: 'Carrier Portal URL',  api: 'Carrier_Portal_URL__c',  type: 'URL',                  required: false, description: 'Link to the carrier submission portal for this record.', picklistValues: [] },
  { id: 25, label: 'Underwriting Notes',  api: 'Underwriting_Notes__c',  type: 'Long Text Area',       required: false, description: 'Free-form notes from the underwriter during review.', picklistValues: [] },
  { id: 26, label: 'Stages',              api: 'Stage__c',               type: 'Picklist',             required: false, description: 'Master list of underwriting stages.', picklistValues: ['New Submission', 'Initial Review', 'Risk Assessment', 'Underwriting', 'Quote Preparation', 'Quote Issued', 'Negotiation', 'Bound', 'Declined', 'Withdrawn'] },
];

// Will be loaded from API
let fields      = DEFAULT_FIELDS;
let nextFieldId = 27;

// Returns only picklist-type fields for a given object name
function getPicklistFields(objectName) {
  if (objectName === 'Submission') {
    return fields.filter(f => f.type === 'Picklist' || f.type === 'Multi-Select Picklist');
  }
  return [];
}

// ── Object Management: render fields table ───────────────────

function renderFieldsTable() {
  const tbody = document.getElementById('fields-tbody');
  tbody.innerHTML = '';
  fields.forEach(f => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-check"><input type="checkbox" /></td>
      <td><a href="#" onclick="openFieldModal(${f.id}); return false;">${esc(f.label)}</a></td>
      <td><code>${esc(f.api)}</code></td>
      <td><span class="badge-type">${esc(f.type)}</span></td>
      <td class="desc">${esc(f.description)}</td>
      <td>${f.required ? '<span class="badge-active">Yes</span>' : '<span class="badge-inactive">No</span>'}</td>
      <td class="col-action">
        ${rowMenuBtn(`onclick="openRowMenu(this,[{label:'Edit',action:()=>openFieldModal(${f.id})},{label:'Delete',action:()=>deleteField(${f.id}),danger:true}]);event.stopPropagation()"`)}
      </td>`;
    tbody.appendChild(tr);
  });
  document.getElementById('field-count').textContent = fields.length + ' fields';
}

// ── Object Management: field modal ──────────────────────────

let editingPicklistValues = [];

function openFieldModal(id) {
  editingPicklistValues = [];
  document.getElementById('edit-id').value = id || '';
  document.getElementById('modal-title').textContent = id ? 'Edit Field' : 'New Field';
  document.getElementById('picklist-values').innerHTML = '';

  if (id) {
    const f = fields.find(x => x.id === id);
    document.getElementById('f-label').value = f.label;
    document.getElementById('f-api').value = f.api;
    document.getElementById('f-type').value = f.type;
    document.getElementById('f-required').checked = f.required;
    document.getElementById('f-description').value = f.description;
    editingPicklistValues = [...f.picklistValues];
  } else {
    document.getElementById('f-label').value = '';
    document.getElementById('f-api').value = '';
    document.getElementById('f-type').value = 'Text';
    document.getElementById('f-required').checked = false;
    document.getElementById('f-description').value = '';
  }

  renderPicklistValues();
  onTypeChange();
  document.getElementById('field-modal').classList.remove('hidden');
}

// keep old name as alias so HTML onclick still works
function openModal(id) { openFieldModal(id); }

function closeModal() {
  document.getElementById('field-modal').classList.add('hidden');
}

function overlayClick(e) {
  if (e.target === document.getElementById('field-modal')) closeModal();
}

function onTypeChange() {
  const type = document.getElementById('f-type').value;
  document.getElementById('picklist-section').classList.toggle('hidden',
    type !== 'Picklist' && type !== 'Multi-Select Picklist');
}

function autoApiName() {
  if (document.getElementById('edit-id').value) return;
  const label = document.getElementById('f-label').value;
  document.getElementById('f-api').value =
    label.trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '') + '__c';
}

function addPicklistValue() {
  const input = document.getElementById('picklist-input');
  const val = input.value.trim();
  if (!val || editingPicklistValues.includes(val)) { input.value = ''; return; }
  editingPicklistValues.push(val);
  input.value = '';
  renderPicklistValues();
}

document.getElementById('picklist-input').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); addPicklistValue(); }
});

function removePicklistValue(idx) {
  editingPicklistValues.splice(idx, 1);
  renderPicklistValues();
}

function renamePicklistValue(idx, newVal) {
  editingPicklistValues[idx] = newVal;
}

function renderPicklistValues() {
  const ul = document.getElementById('picklist-values');
  ul.innerHTML = '';
  editingPicklistValues.forEach((val, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <input class="picklist-value-input" type="text" value="${esc(val)}"
        oninput="renamePicklistValue(${idx}, this.value)"
        onblur="renamePicklistValue(${idx}, this.value)" />
      <button type="button" onclick="removePicklistValue(${idx})" title="Remove">×</button>`;
    ul.appendChild(li);
  });
}

function saveField() {
  const label = document.getElementById('f-label').value.trim();
  const api   = document.getElementById('f-api').value.trim();
  const type  = document.getElementById('f-type').value;
  if (!label || !api) { alert('Field Label and API Name are required.'); return; }

  const id = document.getElementById('edit-id').value;
  const record = {
    label, api, type,
    required: document.getElementById('f-required').checked,
    description: document.getElementById('f-description').value.trim(),
    picklistValues: [...editingPicklistValues],
  };

  if (id) {
    const idx = fields.findIndex(x => x.id === parseInt(id));
    fields[idx] = { id: parseInt(id), ...record };
  } else {
    fields.push({ id: nextFieldId++, ...record });
  }

  persistFields();
  closeModal();
  renderFieldsTable();
}

function deleteField(id) {
  const f = fields.find(x => x.id === id);
  if (!confirm(`Delete field "${f.label}"?`)) return;
  fields = fields.filter(x => x.id !== id);
  persistFields();
  renderFieldsTable();
}

// ── Submission Activity Configurations ────────────────

let activityConfigs = [];
let nextStmId = 1;

async function persistStm() {
  setActivityConfigs(activityConfigs);
  setNextActivityConfigId(nextStmId);
  await saveConfig();
}

function renderStmTable() {
  const tbody = document.getElementById('stm-tbody');
  tbody.innerHTML = '';

  if (activityConfigs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">No activity configurations yet. Click <strong>New</strong> to create one.</td></tr>`;
  } else {
    activityConfigs.forEach(stm => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="col-check"><input type="checkbox" /></td>
        <td><a href="#" onclick="openStmDetail(${stm.id}); return false;">${esc(stm.name)}</a></td>
        <td>${stm.active ? '<span class="badge-active">Active</span>' : '<span class="badge-inactive">Inactive</span>'}</td>
        <td>${fmtDate(stm.effectiveFrom)}</td>
        <td>${fmtDate(stm.effectiveTo)}</td>
        <td class="col-action">
          ${rowMenuBtn(`onclick="openRowMenu(this,[{label:'Open',action:()=>openStmDetail(${stm.id})},{label:'Delete',action:()=>deleteStmRecord(${stm.id}),danger:true}]);event.stopPropagation()"`)}
        </td>`;
      tbody.appendChild(tr);
    });
  }

  document.getElementById('stm-count').textContent =
    activityConfigs.length + (activityConfigs.length === 1 ? ' item' : ' items');
}

function openStmModal(id) {
  document.getElementById('stm-edit-id').value = id || '';
  document.getElementById('stm-modal-title').textContent =
    id ? 'Edit Activity Configuration' : 'New Activity Configuration';

  if (id) {
    const stm = activityConfigs.find(x => x.id === id);
    document.getElementById('stm-name').value = stm.name;
    document.getElementById('stm-active').checked = stm.active;
    document.getElementById('stm-eff-from').value = stm.effectiveFrom;
    document.getElementById('stm-eff-to').value = stm.effectiveTo;
  } else {
    document.getElementById('stm-name').value = '';
    document.getElementById('stm-active').checked = false;
    document.getElementById('stm-eff-from').value = '';
    document.getElementById('stm-eff-to').value = '';
  }

  document.getElementById('stm-modal').classList.remove('hidden');
}

function closeStmModal() {
  document.getElementById('stm-modal').classList.add('hidden');
}

function stmOverlayClick(e) {
  if (e.target === document.getElementById('stm-modal')) closeStmModal();
}

async function saveStmRecord() {
  const name = document.getElementById('stm-name').value.trim();

  if (!name) { alert('Name is required.'); return; }

  const id = document.getElementById('stm-edit-id').value;
  const record = {
    name,
    active: document.getElementById('stm-active').checked,
    effectiveFrom: document.getElementById('stm-eff-from').value,
    effectiveTo: document.getElementById('stm-eff-to').value,
  };

  if (id) {
    const idx = activityConfigs.findIndex(x => x.id === parseInt(id));
    activityConfigs[idx] = { id: parseInt(id), ...record };
  } else {
    activityConfigs.push({ id: nextStmId++, ...record });
  }

  await persistStm();
  closeStmModal();
  renderStmTable();

  // If we're on the detail page, re-render it
  if (detailStmId === parseInt(id)) {
    renderStmDetail();
  }
}

async function deleteStmRecord(id) {
  const stm = activityConfigs.find(x => x.id === id);
  if (!confirm(`Delete "${stm.name}"?`)) return;
  activityConfigs = activityConfigs.filter(x => x.id !== id);
  await persistStm();
  renderStmTable();
}

// ── Submission Activity Configuration Detail ─────────────────

let detailStmId = null;

function openStmDetail(id) {
  window.location.hash = `/activity-config/${id}`;
}

function backToActivityManagement() {
  window.location.hash = `/activity-management`;
}

function _showStmDetail(id) {
  detailStmId = id;

  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  document.getElementById('panel-stm-detail').classList.remove('hidden');
  document.querySelectorAll('.nav-row').forEach(r => r.classList.remove('active'));

  // expand nav to show Activity Management
  if (!document.getElementById('children-insurance').classList.contains('open')) toggle('insurance');
  if (!document.getElementById('children-underwriting').classList.contains('open')) toggle('underwriting');

  renderStmDetail();
}

function renderStmDetail() {
  const stm = activityConfigs.find(x => x.id === detailStmId);
  if (!stm) return;

  document.getElementById('stm-detail-title').textContent = stm.name;
  renderStmGeneralSection(stm);
  renderStmSummarySection(stm);
  renderStmActivities(stm);
}

function renderStmGeneralSection(stm) {
  const el = document.getElementById('stm-general-section');

  el.innerHTML = `
    <div class="sf-section-header" onclick="toggleSfSection('general-fields')">
      <svg class="sf-section-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="m9 18 6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="sf-section-title">General</span>
    </div>
    <div id="general-fields" class="sf-detail-grid">
      <div class="sf-detail-field">
        <div class="sf-detail-label">Name</div>
        <div class="sf-detail-value-row">
          <div class="sf-detail-value sf-editable" onclick="editInline(this, 'text', ${stm.id}, 'name', '${esc(stm.name)}')">${esc(stm.name)}</div>
          <button class="sf-edit-icon" onclick="editInline(event.target.closest('.sf-detail-field').querySelector('.sf-detail-value'), 'text', ${stm.id}, 'name', '${esc(stm.name)}'); event.stopPropagation();" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="sf-detail-field">
        <div class="sf-detail-label">Active</div>
        <div class="sf-detail-value-row">
          <div class="sf-detail-value sf-editable" onclick="editInline(this, 'checkbox', ${stm.id}, 'active', ${stm.active})">${stm.active ? '<span class="badge-active">Active</span>' : '<span class="badge-inactive">Inactive</span>'}</div>
          <button class="sf-edit-icon" onclick="editInline(event.target.closest('.sf-detail-field').querySelector('.sf-detail-value'), 'checkbox', ${stm.id}, 'active', ${stm.active}); event.stopPropagation();" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="sf-detail-field">
        <div class="sf-detail-label">Effective From</div>
        <div class="sf-detail-value-row">
          <div class="sf-detail-value sf-editable" onclick="editInline(this, 'date', ${stm.id}, 'effectiveFrom', '${stm.effectiveFrom || ''}')">${fmtDate(stm.effectiveFrom)}</div>
          <button class="sf-edit-icon" onclick="editInline(event.target.closest('.sf-detail-field').querySelector('.sf-detail-value'), 'date', ${stm.id}, 'effectiveFrom', '${stm.effectiveFrom || ''}'); event.stopPropagation();" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="sf-detail-field">
        <div class="sf-detail-label">Effective To</div>
        <div class="sf-detail-value-row">
          <div class="sf-detail-value sf-editable" onclick="editInline(this, 'date', ${stm.id}, 'effectiveTo', '${stm.effectiveTo || ''}')">${fmtDate(stm.effectiveTo) || '—'}</div>
          <button class="sf-edit-icon" onclick="editInline(event.target.closest('.sf-detail-field').querySelector('.sf-detail-value'), 'date', ${stm.id}, 'effectiveTo', '${stm.effectiveTo || ''}'); event.stopPropagation();" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>`;
}

async function editInline(element, inputType, stmId, field, currentValue) {
  if (element.querySelector('input, textarea')) return; // Already editing

  const originalHtml = element.innerHTML;
  let inputHtml = '';

  if (inputType === 'text') {
    inputHtml = `<input type="text" class="sf-inline-input" value="${esc(currentValue)}" />`;
  } else if (inputType === 'date') {
    inputHtml = `<input type="date" class="sf-inline-input" value="${currentValue}" />`;
  } else if (inputType === 'checkbox') {
    inputHtml = `<input type="checkbox" class="sf-inline-checkbox" ${currentValue ? 'checked' : ''} />`;
  } else if (inputType === 'textarea') {
    inputHtml = `<textarea class="sf-inline-textarea" rows="4">${esc(currentValue)}</textarea>`;
  }

  element.innerHTML = inputHtml;
  const input = element.querySelector('input, textarea');
  input.focus();

  const save = async () => {
    let newValue;
    if (inputType === 'checkbox') {
      newValue = input.checked;
    } else {
      newValue = input.value;
    }

    const stm = activityConfigs.find(x => x.id === stmId);
    if (!stm) return;

    if (field === 'prompt') {
      stmSummaryData[stmId] = newValue;
      persistStmSummary();
    } else {
      stm[field] = newValue;
      await persistStm();
    }

    renderStmDetail();
  };

  const cancel = () => {
    element.innerHTML = originalHtml;
  };

  input.addEventListener('blur', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && inputType !== 'textarea') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      cancel();
    }
  });
}

function toggleSfSection(sectionId) {
  const section = document.getElementById(sectionId);
  const header = event.currentTarget;
  const chevron = header.querySelector('.sf-section-chevron');

  if (section.style.display === 'none') {
    section.style.display = 'grid';
    chevron.style.transform = 'rotate(90deg)';
  } else {
    section.style.display = 'none';
    chevron.style.transform = 'rotate(0deg)';
  }
}

// ── Submission-level Summary Prompt ──────────────────────────
// stored as { stmId: prompt }

const STM_SUMMARY_DEFAULT =
  'Summarise the submission across all lines of business, including key coverage types, insured entities, total premium amounts, and overall risk profile. Keep it concise — 2 to 3 sentences.';

let stmSummaryData = JSON.parse(localStorage.getItem('uw_stm_summary')) || {};

function persistStmSummary() {
  localStorage.setItem('uw_stm_summary', JSON.stringify(stmSummaryData));
}

function renderStmSummarySection(stm) {
  const el = document.getElementById('stm-summary-section');
  const prompt = stmSummaryData[stm.id] || '';

  el.innerHTML = `
    <div class="sf-section-header" onclick="toggleSfSection('summary-fields')">
      <svg class="sf-section-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="m9 18 6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="sf-section-title">Submission Line Summary</span>
    </div>
    <div id="summary-fields" class="sf-detail-grid" style="grid-template-columns: 1fr;">
      <div class="sf-detail-field">
        <div class="sf-detail-label">Prompt</div>
        <div class="sf-detail-value-row">
          <div class="sf-detail-value sf-editable" style="white-space: pre-wrap;" onclick="editInline(this, 'textarea', ${stm.id}, 'prompt', \`${(prompt || '').replace(/`/g, '\\`')}\`)">${prompt ? esc(prompt) : '—'}</div>
          <button class="sf-edit-icon" onclick="editInline(event.target.closest('.sf-detail-field').querySelector('.sf-detail-value'), 'textarea', ${stm.id}, 'prompt', \`${(prompt || '').replace(/`/g, '\\`')}\`); event.stopPropagation();" title="Edit prompt">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>`;
}

function openStmSummaryModal(stmId) {
  const prompt = stmSummaryData[stmId] || STM_SUMMARY_DEFAULT;
  document.getElementById('stm-summary-stm-id').value = stmId;
  document.getElementById('stm-summary-prompt').value = prompt;
  document.getElementById('stm-summary-modal').classList.remove('hidden');
}

function closeStmSummaryModal() {
  document.getElementById('stm-summary-modal').classList.add('hidden');
}

function saveStmSummaryModal() {
  const stmId   = parseInt(document.getElementById('stm-summary-stm-id').value);
  const prompt = document.getElementById('stm-summary-prompt').value.trim();
  stmSummaryData[stmId] = prompt;
  persistStmSummary();
  closeStmSummaryModal();

  // Re-render the general section which includes the prompt
  const stm = activityConfigs.find(x => x.id === stmId);
  if (stm) {
    renderStmGeneralSection(stm);
  }
}

// ── Submission-level Activities ──────────────────────────────
// stored as { stmId: [ {id, name, action, actionDetails, trigger, mandatory, conditions} ] }

let stmActivitiesData = {};
let nextStmActivityId = 1;

async function persistStmActivities() {
  setStmActivitiesData(stmActivitiesData);
  setNextStmActivityId(nextStmActivityId);
  await saveConfig();
}

function getStmActivities(stmId) {
  return stmActivitiesData[stmId] || [];
}

function renderStmActivities(stm) {
  const container = document.getElementById('stm-activity-content');
  container.innerHTML = '';

  const acts = getStmActivities(stm.id);

  // Create card container with white background
  const card = document.createElement('div');
  card.style.cssText = 'background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden;';

  // Create header with Tasks title and New Task button horizontally aligned
  const header = document.createElement('div');
  header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #e5e5e5;';
  header.innerHTML = `
    <h3 style="font-size: 16px; font-weight: 600; color: #080707; margin: 0;">Tasks</h3>
    <button class="btn-new" onclick="openStmActivityModal(${stm.id}, null)">New Task</button>
  `;
  card.appendChild(header);

  // Create content area
  const content = document.createElement('div');
  content.style.cssText = 'padding: 0;';

  if (acts.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'act-empty';
    empty.style.cssText = 'padding: 40px 20px; text-align: center; color: #706E6B; font-size: 14px;';
    empty.textContent = 'No tasks yet. Click New Task to add one.';
    content.appendChild(empty);
  } else {
    const tableWrap = document.createElement('div');
    tableWrap.className = 'activities-table-wrap';
    const tbody = document.createElement('tbody');
    tbody.id = `stm-act-tbody-${stm.id}`;

    acts.forEach((a, pos) => {
      tbody.appendChild(buildStmActivityRow(a, pos, stm.id));
    });

    const table = document.createElement('table');
    table.className = 'slds-table';
    table.innerHTML = `<thead><tr>
      <th>Name</th>
      <th>Process</th>
      <th>Availability</th>
      <th>Trigger</th>
      <th>Mandatory</th>
      <th>Actions</th>
    </tr></thead>`;
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    content.appendChild(tableWrap);
  }

  card.appendChild(content);
  container.appendChild(card);
}

function buildStmActivityRow(a, pos, stmId) {
  const trigger = a.trigger || 'Manual';
  const trigBadge = trigger === 'Conditional'
    ? buildConditionalBadge(a.triggerRules, `stm-${stmId}`, 'Trigger Conditions')
    : `<span class="badge-trigger">${esc(trigger)}</span>`;

  const processCell = buildProcessCell(a);

  const tr = document.createElement('tr');
  tr.dataset.actId = a.id;
  tr.dataset.stmId = stmId;
  tr.innerHTML = `
    <td><a href="#" onclick="openStmActivityModal(${stmId}, ${a.id}); return false;">${esc(a.name)}</a></td>
    <td>${processCell}</td>
    <td>${trigBadge}</td>
    <td>${a.mandatory ? '<span class="badge-mandatory">Mandatory</span>' : '—'}</td>
    <td class="col-action">
      ${rowMenuBtn(`onclick="openRowMenu(this,[{label:'Edit',action:()=>openStmActivityModal(${stmId},${a.id})},{label:'Delete',action:()=>deleteStmActivity(${stmId},${a.id}),danger:true}]);event.stopPropagation()"`)}
    </td>`;
  return tr;
}

function openStmActivityModal(stmId, actId) {
  const acts = getStmActivities(stmId);
  const act  = actId ? acts.find(a => a.id === actId) : null;

  document.getElementById('act-edit-id').value   = actId || '';
  document.getElementById('act-stage-key').value = `stm-${stmId}`;
  document.getElementById('activity-modal-title').textContent = act ? 'Edit Activity' : 'New Activity';

  document.getElementById('act-name').value    = act?.name   || '';
  document.getElementById('act-action').value  = act?.action || '';
  document.getElementById('act-mandatory').checked = act?.mandatory || false;

  // action details
  onActionTypeChange(act?.actionDetails || {});

  // hide availability section for submission-level activities
  const availWrapGroup = document.getElementById('act-availability-rules-wrap').closest('.form-group');
  if (availWrapGroup) availWrapGroup.style.display = 'none';

  // Find and hide the availability radio group
  const availRadioGroups = document.querySelectorAll('[name="act-availability"]');
  if (availRadioGroups.length > 0) {
    const availFormGroup = availRadioGroups[0].closest('.form-group');
    if (availFormGroup) availFormGroup.style.display = 'none';
  }

  // trigger
  const trigger = act?.trigger || 'Manual';
  document.querySelectorAll('[name="act-trigger"]').forEach(r => {
    r.checked = r.value === trigger;
  });
  const trigInst = `stm-act-trig-${stmId}-${actId || 'new'}`;
  rulesInstances[trigInst] = act?.triggerRules
    ? JSON.parse(JSON.stringify(act.triggerRules))
    : { stageKey: `stm-${stmId}`, conditions: [], expression: '' };
  const trigWrap = document.getElementById('act-trigger-rules-wrap');
  if (trigger === 'Conditional') {
    trigWrap.classList.remove('hidden');
    setTimeout(() => createRulesModule('act-trigger-rules', trigInst, `stm-${stmId}`), 0);
  } else {
    trigWrap.classList.add('hidden');
  }

  document.getElementById('activity-modal').classList.remove('hidden');
}

async function deleteStmActivity(stmId, actId) {
  const act = stmActivitiesData[stmId]?.find(a => a.id === actId);
  if (!confirm(`Delete activity "${act?.name}"?`)) return;
  stmActivitiesData[stmId] = stmActivitiesData[stmId].filter(a => a.id !== actId);
  await persistStmActivities();
  const stm = activityConfigs.find(x => x.id === stmId);
  renderStmActivities(stm);
}

// ── Stage Configurations ─────────────────────────────────────

let stageConfigs = [];
let nextScId     = 1;

function renderScTable() {
  const tbody = document.getElementById('sc-tbody');
  tbody.innerHTML = '';

  if (stageConfigs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-row">No stage configurations yet. Click <strong>New</strong> to create one.</td></tr>`;
  } else {
    stageConfigs.forEach(sc => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="col-check"><input type="checkbox" /></td>
        <td><a href="#" onclick="openScDetail(${sc.id}); return false;">${esc(sc.name)}</a></td>
        <td>${esc(sc.recordType) || '—'}</td>
        <td>${sc.active ? '<span class="badge-active">Active</span>' : '<span class="badge-inactive">Inactive</span>'}</td>
        <td>${fmtDate(sc.effectiveFrom)}</td>
        <td>${fmtDate(sc.effectiveTo)}</td>
        <td class="col-action">
          ${rowMenuBtn(`onclick="openRowMenu(this,[{label:'Open',action:()=>openScDetail(${sc.id})},{label:'Delete',action:()=>deleteScRecord(${sc.id}),danger:true}]);event.stopPropagation()"`)}
        </td>`;
      tbody.appendChild(tr);
    });
  }

  document.getElementById('sc-count').textContent =
    stageConfigs.length + (stageConfigs.length === 1 ? ' item' : ' items');
}

function openScModal(id) {
  document.getElementById('sc-edit-id').value = id || '';
  document.getElementById('sc-modal-title').textContent =
    id ? 'Edit Stage Configuration' : 'New Stage Configuration';

  if (id) {
    const sc = stageConfigs.find(x => x.id === id);
    document.getElementById('sc-name').value        = sc.name;
    document.getElementById('sc-record-type').value = sc.recordType || '';
    document.getElementById('sc-active').checked    = sc.active;
    document.getElementById('sc-eff-from').value    = sc.effectiveFrom;
    document.getElementById('sc-eff-to').value      = sc.effectiveTo;
  } else {
    document.getElementById('sc-name').value        = '';
    document.getElementById('sc-record-type').value = '';
    document.getElementById('sc-active').checked    = false;
    document.getElementById('sc-eff-from').value    = '';
    document.getElementById('sc-eff-to').value      = '';
  }

  document.getElementById('sc-modal').classList.remove('hidden');
}

function closeScModal() {
  document.getElementById('sc-modal').classList.add('hidden');
}

function scOverlayClick(e) {
  if (e.target === document.getElementById('sc-modal')) closeScModal();
}

function saveScRecord() {
  const name       = document.getElementById('sc-name').value.trim();
  const recordType = document.getElementById('sc-record-type').value;

  if (!name)       { alert('Name is required.'); return; }
  if (!recordType) { alert('Line of Business is required.'); return; }

  const id = document.getElementById('sc-edit-id').value;
  const existing = id ? stageConfigs.find(x => x.id === parseInt(id)) : null;
  const record = {
    name,
    object:        'Submission',
    recordType,
    picklist:      'Stages',
    stages:        existing?.stages || [],
    active:        document.getElementById('sc-active').checked,
    effectiveFrom: document.getElementById('sc-eff-from').value,
    effectiveTo:   document.getElementById('sc-eff-to').value,
  };

  if (id) {
    const idx = stageConfigs.findIndex(x => x.id === parseInt(id));
    stageConfigs[idx] = { id: parseInt(id), ...record };
  } else {
    stageConfigs.push({ id: nextScId++, ...record });
  }

  persistSc();
  closeScModal();
  renderScTable();
  if (detailScId && parseInt(id) === detailScId) {
    const updated = stageConfigs.find(x => x.id === detailScId);
    document.getElementById('sc-detail-title').textContent = updated.name;
    renderGeneralSection(updated);
  }
}

function deleteScRecord(id) {
  const sc = stageConfigs.find(x => x.id === id);
  if (!confirm(`Delete "${sc.name}"?`)) return;
  stageConfigs = stageConfigs.filter(x => x.id !== id);
  persistSc();
  renderScTable();
}

// ── Stage Config Detail Page ─────────────────────────────────

const SECTIONS = [
  { id: 'activities',    label: 'Tasks' },
  { id: 'transitions',   label: 'Stage Transition Rules' },
  { id: 'stage-updates', label: 'Submission Line Stage Summary' },
  { id: 'next-best',     label: 'Next Best Actions' },
];

let detailScId = null;
let activeStageIdx = 0;

function openScDetail(id) {
  window.location.hash = `/stage-config/${id}`;
}

function backToScList() {
  window.location.hash = `/activity-management`;
}

function _showScDetail(id) {
  detailScId = id;
  activeStageIdx = 0;

  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  document.getElementById('panel-sc-detail').classList.remove('hidden');
  document.querySelectorAll('.nav-row').forEach(r => r.classList.remove('active'));

  // expand nav to show Activity Management
  if (!document.getElementById('children-insurance').classList.contains('open')) toggle('insurance');
  if (!document.getElementById('children-underwriting').classList.contains('open')) toggle('underwriting');

  renderScDetail();
}

function _showActivityManagement() {
  detailScId = null;
  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  document.getElementById('panel-activity-management').classList.remove('hidden');

  document.querySelectorAll('.nav-row').forEach(r => r.classList.remove('active'));
  const activityNavRow = document.querySelector('[onclick*="activity-management"]');
  if (activityNavRow) activityNavRow.classList.add('active');

  // Initialize tabs - default to Activities tab
  document.querySelectorAll('#panel-activity-management .integration-hub-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('#panel-activity-management .integration-tab-content').forEach(content => {
    content.classList.remove('active');
  });

  // Show Activities tab by default
  const activitiesTab = document.querySelector('#panel-activity-management .integration-hub-tab:first-child');
  const activitiesContent = document.getElementById('activity-mgmt-tab-activities');
  if (activitiesTab) activitiesTab.classList.add('active');
  if (activitiesContent) activitiesContent.classList.add('active');

  // Render appropriate content
  if (typeof renderActivitiesLibraryTable === 'function') {
    renderActivitiesLibraryTable();
  }
  renderStmTable();
  renderScTable();
}

// ── Hash-based routing ────────────────────────────────────────

function router() {
  if (!appInitialized) {
    console.log('Router called but app not initialized yet');
    return;
  }

  const hash = window.location.hash; // e.g. #/stage-config/3
  console.log('Router running with hash:', hash);

  const connMatch = hash.match(/^#\/connection\/(\d+)$/);
  if (connMatch) {
    const id = parseInt(connMatch[1]);
    _showConnectionDetail(id);
    return;
  }

  const stmMatch = hash.match(/^#\/activity-config\/(\d+)$/);
  if (stmMatch) {
    const id = parseInt(stmMatch[1]);
    _showStmDetail(id);
    return;
  }

  const scMatch = hash.match(/^#\/stage-config\/(\d+)$/);
  if (scMatch) {
    const id = parseInt(scMatch[1]);
    _showScDetail(id);
    return;
  }

  if (hash === '#/activity-management') {
    _showActivityManagement();
    return;
  }

  if (hash === '#/integration-hub') {
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('panel-integration-hub').classList.remove('hidden');
    document.querySelectorAll('.nav-row').forEach(r => r.classList.remove('active'));
    const intNavRow = document.querySelector('[onclick*="integration-hub"]');
    if (intNavRow) intNavRow.classList.add('active');
    renderConnectionsTable();
    if (typeof renderIntegrationProcedures === 'function') renderIntegrationProcedures();
    return;
  }

  const ipMatch = hash.match(/^#\/integration-procedure\/(\d+)$/);
  if (ipMatch) {
    const id = parseInt(ipMatch[1]);
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('panel-integration-procedure-detail').classList.remove('hidden');
    document.querySelectorAll('.nav-row').forEach(r => r.classList.remove('active'));
    const intNavRow = document.querySelector('[onclick*="integration-hub"]');
    if (intNavRow) intNavRow.classList.add('active');
    if (typeof renderIntegrationProcedureDetail === 'function') renderIntegrationProcedureDetail(id);
    return;
  }

  const enrichmentMatch = hash.match(/^#\/enrichment-config\/(\d+)$/);
  if (enrichmentMatch) {
    const id = parseInt(enrichmentMatch[1]);
    _showEnrichmentConfigDetail(id);
    return;
  }

  if (hash === '#/data-enrichment') {
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('panel-data-enrichment').classList.remove('hidden');
    document.querySelectorAll('.nav-row').forEach(r => r.classList.remove('active'));
    const dataNavRow = document.querySelector('[onclick*="data-enrichment"]');
    if (dataNavRow) dataNavRow.classList.add('active');
    renderEnrichmentConfigsList();
    return;
  }

  if (hash === '#/run-my-day') {
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('panel-run-my-day').classList.remove('hidden');
    document.querySelectorAll('.nav-row').forEach(r => r.classList.remove('active'));
    const rmdNavRow = document.querySelector('[onclick*="run-my-day"]');
    if (rmdNavRow) rmdNavRow.classList.add('active');
    renderPlaybooksList();
    return;
  }

  if (hash === '#/document-extraction') {
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('panel-document-extraction').classList.remove('hidden');
    document.querySelectorAll('.nav-row').forEach(r => r.classList.remove('active'));
    const docNavRow = document.querySelector('[onclick*="document-extraction"]');
    if (docNavRow) docNavRow.classList.add('active');
    return;
  }

  if (hash === '#/reconciliation-normalization') {
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('panel-reconciliation-normalization').classList.remove('hidden');
    document.querySelectorAll('.nav-row').forEach(r => r.classList.remove('active'));
    const rnNavRow = document.querySelector('[onclick*="reconciliation-normalization"]');
    if (rnNavRow) rnNavRow.classList.add('active');
    if (typeof renderReconciliationNormalization === 'function') renderReconciliationNormalization();
    return;
  }

  const rnHierMatch = hash.match(/^#\/rn-hierarchy\/(\d+)$/);
  if (rnHierMatch) {
    const id = parseInt(rnHierMatch[1]);
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('panel-rn-hierarchy-detail').classList.remove('hidden');
    document.querySelectorAll('.nav-row').forEach(r => r.classList.remove('active'));
    const rnNavRow = document.querySelector('[onclick*="reconciliation-normalization"]');
    if (rnNavRow) rnNavRow.classList.add('active');
    if (typeof renderRnHierarchyDetail === 'function') renderRnHierarchyDetail(id);
    return;
  }

  if (hash === '#/email-to-submission') {
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('panel-email-to-submission').classList.remove('hidden');
    document.querySelectorAll('.nav-row').forEach(r => r.classList.remove('active'));
    const emailNavRow = document.querySelector('[onclick*="email-to-submission"]');
    if (emailNavRow) emailNavRow.classList.add('active');
    return;
  }

  if (hash === '#/email-routing-form') {
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('panel-email-routing-form').classList.remove('hidden');
    document.querySelectorAll('.nav-row').forEach(r => r.classList.remove('active'));
    const emailNavRow = document.querySelector('[onclick*="email-to-submission"]');
    if (emailNavRow) emailNavRow.classList.add('active');
    return;
  }

  if (hash === '#/submission-assignment') {
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('panel-submission-assignment').classList.remove('hidden');
    document.querySelectorAll('.nav-row').forEach(r => r.classList.remove('active'));
    const assignNavRow = document.querySelector('[onclick*="submission-assignment"]');
    if (assignNavRow) assignNavRow.classList.add('active');
    renderAssignmentRules();
    return;
  }

  if (hash.startsWith('#/assignment-rule-detail/')) {
    const id = parseInt(hash.split('/')[2]);
    currentRuleId = id;
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('panel-assignment-rule-detail').classList.remove('hidden');
    document.querySelectorAll('.nav-row').forEach(r => r.classList.remove('active'));
    const assignNavRow = document.querySelector('[onclick*="submission-assignment"]');
    if (assignNavRow) assignNavRow.classList.add('active');
    renderAssignmentRuleDetail();
    return;
  }

  if (hash.startsWith('#/rule-entry-form/')) {
    const id = parseInt(hash.split('/')[2]);
    currentRuleId = id;
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('panel-rule-entry-form').classList.remove('hidden');
    document.querySelectorAll('.nav-row').forEach(r => r.classList.remove('active'));
    const assignNavRow = document.querySelector('[onclick*="submission-assignment"]');
    if (assignNavRow) assignNavRow.classList.add('active');
    renderRuleEntryForm();
    return;
  }

  if (hash === '#/object-management') {
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('panel-object-management').classList.remove('hidden');
    document.querySelectorAll('.nav-row').forEach(r => r.classList.remove('active'));
    const objNavRow = document.querySelector('[onclick*="object-management"]');
    if (objNavRow) objNavRow.classList.add('active');
    return;
  }

  // default: show activity management if no hash
  if (!hash || hash === '#/' || hash === '#') {
    window.location.hash = '#/activity-management';
    return;
  }

  // if unknown hash, hide all panels
  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
}

// ── Document Extraction ──────────────────────────────────────

function toggleDocumentAI() {
  const checkbox = document.getElementById('doc-ai-enabled');
  const status = document.getElementById('doc-ai-status');

  if (checkbox.checked) {
    status.textContent = 'Enabled';
    status.style.color = 'var(--sf-text)';
  } else {
    status.textContent = 'Disabled';
    status.style.color = 'var(--sf-text-muted)';
  }
}

function createExtractionTemplate() {
  alert('Create Extraction Template\n\nThis would open a wizard to:\n- Define document type\n- Configure field mappings\n- Set extraction rules\n- Test with sample documents');
}

// ── Email to Submission ──────────────────────────────────────

function toggleEmailToSubmission() {
  const checkbox = document.getElementById('email-to-submission-enabled');
  const allCheckboxes = document.querySelectorAll('.email-setting-checkbox');

  if (checkbox.checked) {
    // Enable all other checkboxes
    allCheckboxes.forEach(cb => {
      cb.disabled = false;
    });
    alert('Email-to-Submission has been enabled. You can now configure routing addresses.');
  } else {
    // Disable all other checkboxes
    allCheckboxes.forEach(cb => {
      cb.disabled = true;
    });
  }
}

function editEmailSettings() {
  alert('Edit Email Settings\n\nThis would open a form to modify:\n- Email-to-Submission enable/disable\n- Notification preferences\n- Email format settings\n- Threading options');
}

function openRoutingAddressForm() {
  window.location.hash = '/email-routing-form';
}

function saveRoutingAddress() {
  const name = document.getElementById('routing-name').value;
  const email = document.getElementById('routing-email').value;

  if (!name || !email) {
    alert('Please fill in all required fields');
    return;
  }

  alert('Routing address saved successfully!\n\nName: ' + name + '\nEmail: ' + email);
  window.location.hash = '/email-to-submission';
}

function cancelRoutingAddress() {
  if (confirm('Discard changes and return to Email-to-Submission settings?')) {
    window.location.hash = '/email-to-submission';
  }
}

// ── Submission Assignment Rules ──────────────────────────────

let assignmentRules = [];
let nextAssignmentId = 1;

async function persistAssignment() {
  setAssignmentRules(assignmentRules);
  setNextAssignmentRuleId(nextAssignmentId);
  await saveConfig();
}

function renderAssignmentRules() {
  const tbody = document.getElementById('assignment-rules-tbody');
  tbody.innerHTML = '';

  assignmentRules.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <a href="#" onclick="renameAssignmentRule(${r.id}); return false;">Rename</a>
        <span style="color:#ccc;margin:0 6px;">|</span>
        <a href="#" onclick="deleteAssignmentRule(${r.id}); return false;">Del</a>
      </td>
      <td><a href="#" onclick="viewRuleEntries(${r.id}); return false;">${esc(r.name)}</a></td>
      <td><input type="checkbox" ${r.active ? 'checked' : ''} onchange="toggleAssignmentRule(${r.id}, this.checked)" /></td>
      <td>${esc(r.createdBy)}</td>
      <td>${fmtDate(r.createdOn)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function newAssignmentRule() {
  const name = prompt('Enter rule name:');
  if (!name) return;

  assignmentRules.push({
    id: nextAssignmentId++,
    name: name,
    active: false,
    createdBy: 'Admin User',
    createdOn: new Date().toISOString().split('T')[0]
  });
  persistAssignment();
  renderAssignmentRules();
}

function renameAssignmentRule(id) {
  const r = assignmentRules.find(x => x.id === id);
  if (!r) return;
  const name = prompt('Enter new name:', r.name);
  if (name) {
    r.name = name;
    persistAssignment();
    renderAssignmentRules();
  }
}

function deleteAssignmentRule(id) {
  if (!confirm('Delete this assignment rule?')) return;
  assignmentRules = assignmentRules.filter(x => x.id !== id);
  persistAssignment();
  renderAssignmentRules();
}

function toggleAssignmentRule(id, checked) {
  // Only one rule can be active at a time
  if (checked) {
    assignmentRules.forEach(r => r.active = false);
  }
  const r = assignmentRules.find(x => x.id === id);
  if (r) r.active = checked;
  persistAssignment();
  renderAssignmentRules();
}

let currentRuleId = null;

function viewRuleEntries(id) {
  currentRuleId = id;
  window.location.hash = '/assignment-rule-detail/' + id;
}

function renderAssignmentRuleDetail() {
  const r = assignmentRules.find(x => x.id === currentRuleId);
  if (!r) return;

  document.getElementById('assignment-rule-breadcrumb').textContent = r.name;
  document.getElementById('assignment-rule-title').textContent = r.name;
  document.getElementById('rule-detail-name').textContent = r.name;
  document.getElementById('rule-detail-active').innerHTML = r.active ? '<span class="badge-success">Active</span>' : '—';
  document.getElementById('rule-detail-created').textContent = `${r.createdBy}, ${fmtDate(r.createdOn)}, 3:31 PM`;
  document.getElementById('rule-detail-modified').textContent = `${r.createdBy}, ${fmtDate(r.createdOn)}, 3:31 PM`;
}

function editRuleDetail() {
  const r = assignmentRules.find(x => x.id === currentRuleId);
  if (!r) return;

  const name = prompt('Rule name:', r.name);
  if (name) {
    r.name = name;
    persistAssignment();
    renderAssignmentRuleDetail();
  }
}

function openRuleEntryWizard() {
  const r = assignmentRules.find(x => x.id === currentRuleId);
  if (!r) return;
  window.location.hash = '/rule-entry-form/' + currentRuleId;
}

function backToRuleDetail() {
  if (currentRuleId) {
    window.location.hash = '/assignment-rule-detail/' + currentRuleId;
  } else {
    window.location.hash = '/submission-assignment';
  }
}

function renderRuleEntryForm() {
  const r = assignmentRules.find(x => x.id === currentRuleId);
  if (!r) return;

  document.getElementById('rule-entry-rule-name').textContent = r.name;
  document.getElementById('rule-entry-breadcrumb-rule').textContent = r.name;
}

function saveRuleEntry() {
  alert('Rule entry would be saved. This would:\n\n• Validate all required fields\n• Save the criteria and assignment logic\n• Return to the rule detail page\n• Show the new entry in the Rule Entries list');
  backToRuleDetail();
}

window.addEventListener('hashchange', router);

function renderScDetail() {
  const sc = stageConfigs.find(x => x.id === detailScId);
  if (!sc) return;

  const stages = sc.stages || [];

  document.getElementById('sc-detail-title').textContent = sc.name;
  renderGeneralSection(sc);
  renderScSummarySection(sc);

  // stage sidebar — rebuild nav label row with Add Stages button
  const stageNav = document.querySelector('.sc-stage-nav');
  let navLabelRow = document.getElementById('sc-stage-nav-label-row');
  if (!navLabelRow) {
    const labelEl = stageNav.querySelector('.sc-stage-nav-label');
    navLabelRow = document.createElement('div');
    navLabelRow.id = 'sc-stage-nav-label-row';
    navLabelRow.className = 'sc-stage-nav-label-row';
    labelEl.replaceWith(navLabelRow);
    navLabelRow.innerHTML = `<span class="sc-stage-nav-label" style="margin:0;">Stages</span>`;
  }
  let addBtn = navLabelRow.querySelector('.sc-stage-add-btn');
  if (addBtn) addBtn.remove();
  const btn = document.createElement('button');
  btn.className = 'sc-stage-add-btn btn-new';
  btn.textContent = 'Add';
  btn.onclick = () => openAddStagesModal(detailScId);
  navLabelRow.appendChild(btn);

  const ul = document.getElementById('sc-stage-list');
  ul.innerHTML = '';
  if (stages.length === 0) {
    ul.innerHTML = '<li style="padding:10px 16px;font-size:12px;color:#706E6B;">No stages yet.<br>Click Add to add stages.</li>';
  } else {
    stages.forEach((stage, idx) => {
      const li = document.createElement('li');
      li.className = 'sc-stage-item' + (idx === activeStageIdx ? ' active' : '');
      li.dataset.idx = idx;
      li.draggable = true;
      li.innerHTML = `
        <span class="sc-stage-drag" title="Drag to reorder">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <circle cx="9"  cy="5"  r="1.5" fill="currentColor"/>
            <circle cx="15" cy="5"  r="1.5" fill="currentColor"/>
            <circle cx="9"  cy="12" r="1.5" fill="currentColor"/>
            <circle cx="15" cy="12" r="1.5" fill="currentColor"/>
            <circle cx="9"  cy="19" r="1.5" fill="currentColor"/>
            <circle cx="15" cy="19" r="1.5" fill="currentColor"/>
          </svg>
        </span>
        <span class="sc-stage-num">${idx + 1}</span>
        <span class="sc-stage-name">${esc(stage)}</span>
        <button class="sc-stage-remove-btn" onclick="removeStage(${detailScId}, ${idx})" title="Remove stage">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>`;
      li.onclick = (e) => {
        if (e.target.closest('.sc-stage-drag')) return;
        selectStage(idx);
      };
      ul.appendChild(li);
    });
    setTimeout(() => initStageDrag(sc), 0);
  }

  renderStageContent(stages);
}

// ── Add Stages Modal ──────────────────────────────────────────

function removeStage(scId, idx) {
  const sc = stageConfigs.find(x => x.id === scId);
  if (!confirm(`Remove stage "${sc.stages[idx]}" from this configuration?`)) return;
  sc.stages.splice(idx, 1);
  if (activeStageIdx >= sc.stages.length) activeStageIdx = Math.max(0, sc.stages.length - 1);
  persistSc();
  renderScDetail();
}

function getStagesPicklistValues() {
  const f = fields.find(f => f.label === 'Stages');
  return f ? f.picklistValues : [];
}

function openAddStagesModal(scId) {
  const sc = stageConfigs.find(x => x.id === scId);
  const allStages = getStagesPicklistValues();
  const existing  = new Set(sc.stages || []);

  document.getElementById('add-stages-modal').dataset.scId = scId;

  const list = document.getElementById('add-stages-list');
  list.innerHTML = '';

  if (allStages.length === 0) {
    list.innerHTML = '<p class="form-hint">No stages defined. Add values to the "Stages" picklist field first.</p>';
  } else {
    allStages.forEach(stage => {
      const alreadyAdded = existing.has(stage);
      const item = document.createElement('label');
      item.className = 'stage-checklist-item' + (alreadyAdded ? ' disabled' : '');
      item.innerHTML = `
        <input type="checkbox" value="${esc(stage)}" ${alreadyAdded ? 'checked disabled' : ''} />
        <span>${esc(stage)}</span>
        ${alreadyAdded ? '<span style="margin-left:auto;font-size:11px;color:var(--sf-text-muted);">Already added</span>' : ''}`;
      list.appendChild(item);
    });
  }

  document.getElementById('add-stages-modal').classList.remove('hidden');
}

function closeAddStagesModal() {
  document.getElementById('add-stages-modal').classList.add('hidden');
}

function saveAddStages() {
  const modal = document.getElementById('add-stages-modal');
  const scId  = parseInt(modal.dataset.scId);
  const sc    = stageConfigs.find(x => x.id === scId);

  const selected = [...modal.querySelectorAll('input[type=checkbox]:not([disabled]):checked')]
    .map(cb => cb.value);

  if (selected.length === 0) { closeAddStagesModal(); return; }

  sc.stages = [...(sc.stages || []), ...selected];
  persistSc();
  closeAddStagesModal();
  renderScDetail();
}

function renderGeneralSection(sc) {
  const el = document.getElementById('sc-general-section');
  el.innerHTML = `
    <div class="sf-section-header" onclick="toggleSfSection('sc-general-fields')">
      <svg class="sf-section-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="m9 18 6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="sf-section-title">General</span>
    </div>
    <div id="sc-general-fields" class="sf-detail-grid">
      <div class="sf-detail-field">
        <div class="sf-detail-label">Line of Business</div>
        <div class="sf-detail-value-row">
          <div class="sf-detail-value sf-editable" onclick="editScInline(this, 'text', ${sc.id}, 'recordType', '${esc(sc.recordType || '')}')">${esc(sc.recordType) || '—'}</div>
          <button class="sf-edit-icon" onclick="editScInline(event.target.closest('.sf-detail-field').querySelector('.sf-detail-value'), 'text', ${sc.id}, 'recordType', '${esc(sc.recordType || '')}'); event.stopPropagation();" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="sf-detail-field">
        <div class="sf-detail-label">Active</div>
        <div class="sf-detail-value-row">
          <div class="sf-detail-value sf-editable" onclick="editScInline(this, 'checkbox', ${sc.id}, 'active', ${sc.active})">${sc.active ? '<span class="badge-active">Active</span>' : '<span class="badge-inactive">Inactive</span>'}</div>
          <button class="sf-edit-icon" onclick="editScInline(event.target.closest('.sf-detail-field').querySelector('.sf-detail-value'), 'checkbox', ${sc.id}, 'active', ${sc.active}); event.stopPropagation();" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="sf-detail-field">
        <div class="sf-detail-label">Effective From</div>
        <div class="sf-detail-value-row">
          <div class="sf-detail-value sf-editable" onclick="editScInline(this, 'date', ${sc.id}, 'effectiveFrom', '${sc.effectiveFrom || ''}')">${fmtDate(sc.effectiveFrom)}</div>
          <button class="sf-edit-icon" onclick="editScInline(event.target.closest('.sf-detail-field').querySelector('.sf-detail-value'), 'date', ${sc.id}, 'effectiveFrom', '${sc.effectiveFrom || ''}'); event.stopPropagation();" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="sf-detail-field">
        <div class="sf-detail-label">Effective To</div>
        <div class="sf-detail-value-row">
          <div class="sf-detail-value sf-editable" onclick="editScInline(this, 'date', ${sc.id}, 'effectiveTo', '${sc.effectiveTo || ''}')">${fmtDate(sc.effectiveTo) || '—'}</div>
          <button class="sf-edit-icon" onclick="editScInline(event.target.closest('.sf-detail-field').querySelector('.sf-detail-value'), 'date', ${sc.id}, 'effectiveTo', '${sc.effectiveTo || ''}'); event.stopPropagation();" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>`;
}

async function editScInline(element, inputType, scId, field, currentValue) {
  if (element.querySelector('input, textarea')) return;

  const originalHtml = element.innerHTML;
  let inputHtml = '';

  if (inputType === 'text') {
    inputHtml = `<input type="text" class="sf-inline-input" value="${esc(currentValue)}" />`;
  } else if (inputType === 'date') {
    inputHtml = `<input type="date" class="sf-inline-input" value="${currentValue}" />`;
  } else if (inputType === 'checkbox') {
    inputHtml = `<input type="checkbox" class="sf-inline-checkbox" ${currentValue ? 'checked' : ''} />`;
  } else if (inputType === 'textarea') {
    inputHtml = `<textarea class="sf-inline-textarea" rows="4">${esc(currentValue)}</textarea>`;
  }

  element.innerHTML = inputHtml;
  const input = element.querySelector('input, textarea');
  input.focus();

  const save = async () => {
    let newValue;
    if (inputType === 'checkbox') {
      newValue = input.checked;
    } else {
      newValue = input.value;
    }

    const sc = stageConfigs.find(x => x.id === scId);
    if (!sc) return;

    if (field === 'prompt') {
      scSummaryData[scId] = newValue;
      persistScSummary();
    } else {
      sc[field] = newValue;
      await persistSc();
    }

    renderScDetail();
  };

  const cancel = () => {
    element.innerHTML = originalHtml;
  };

  input.addEventListener('blur', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && inputType !== 'textarea') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      cancel();
    }
  });
}

function selectStage(idx) {
  activeStageIdx = idx;
  document.querySelectorAll('.sc-stage-item').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
  const sc = stageConfigs.find(x => x.id === detailScId);
  renderStageContent(sc.stages || []);
}

let _stageDragSrc = null;

function initStageDrag(sc) {
  const ul = document.getElementById('sc-stage-list');
  if (!ul) return;

  ul.querySelectorAll('.sc-stage-item').forEach(li => {
    li.addEventListener('dragstart', e => {
      _stageDragSrc = li;
      li.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      ul.querySelectorAll('.sc-stage-item').forEach(l => l.classList.remove('drag-over'));
    });
    li.addEventListener('dragover', e => {
      e.preventDefault();
      ul.querySelectorAll('.sc-stage-item').forEach(l => l.classList.remove('drag-over'));
      if (li !== _stageDragSrc) li.classList.add('drag-over');
    });
    li.addEventListener('drop', e => {
      e.preventDefault();
      if (!_stageDragSrc || _stageDragSrc === li) return;
      const fromIdx = parseInt(_stageDragSrc.dataset.idx);
      const toIdx   = parseInt(li.dataset.idx);
      const [moved] = sc.stages.splice(fromIdx, 1);
      sc.stages.splice(toIdx, 0, moved);
      persistSc();
      activeStageIdx = toIdx;
      renderScDetail();
    });
  });
}

// stageMetaData keyed by "scId:stageIdx" → { sla, owner }
let stageMetaData = JSON.parse(localStorage.getItem('uw_stage_meta')) || {};

function persistStageMeta() {
  localStorage.setItem('uw_stage_meta', JSON.stringify(stageMetaData));
}

function stageMetaKey(scId, stageIdx) {
  return `${scId}:${stageIdx}`;
}

function renderStageContent(stages) {
  const container = document.getElementById('sc-stage-content');
  const stageName = stages[activeStageIdx] || '';

  container.innerHTML = '';
  if (!stageName) return;

  // stage name heading with expand/collapse all
  const heading = document.createElement('div');
  heading.className = 'stage-content-heading';
  heading.innerHTML = `
    <span class="stage-content-label">${esc(stageName)}</span>
    <button class="stage-expand-btn" id="stage-expand-btn-${activeStageIdx}"
      onclick="toggleAllAccordions(${activeStageIdx})">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M5 15l7-7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Expand All
    </button>`;
  container.appendChild(heading);

  // SLA / Owner card
  container.appendChild(buildStageMetaCard(detailScId, activeStageIdx));

  // accordion sections
  SECTIONS.forEach(sec => {
    const wrap = document.createElement('div');
    wrap.className = 'accordion';
    wrap.innerHTML = `
      <div class="accordion-header" onclick="toggleAccordion('${sec.id}-${activeStageIdx}')">
        <div class="accordion-header-left">
          <svg class="accordion-chevron" id="achev-${sec.id}-${activeStageIdx}" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="m9 18 6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="accordion-title">${esc(sec.label)}</span>
        </div>
      </div>
      <div class="accordion-body" id="abody-${sec.id}-${activeStageIdx}"></div>`;
    container.appendChild(wrap);
  });
}

// ── Owner search-select data ─────────────────────────────────
const OWNER_OPTIONS = {
  contacts: [
    { id: 'c1', name: 'Alice Johnson',   role: 'Senior Underwriter' },
    { id: 'c2', name: 'Brian Patel',     role: 'Underwriting Manager' },
    { id: 'c3', name: 'Carmen Ruiz',     role: 'Risk Analyst' },
    { id: 'c4', name: 'David Chen',      role: 'Broker Liaison' },
    { id: 'c5', name: 'Elena Vasquez',   role: 'Claims Specialist' },
  ],
  queues: [
    { id: 'q1', name: 'Underwriting Team',        desc: 'All underwriters' },
    { id: 'q2', name: 'High-Risk Review Queue',   desc: 'Complex submissions' },
    { id: 'q3', name: 'Renewals Queue',           desc: 'Renewal submissions' },
    { id: 'q4', name: 'Broker Support Queue',     desc: 'Broker-initiated requests' },
  ],
};

function positionOwnerDropdown() {
  const wrap = document.getElementById('sla-owner-wrap');
  const drop = document.getElementById('sla-owner-dropdown');
  const rect = wrap.getBoundingClientRect();
  drop.style.top   = (rect.bottom + 2) + 'px';
  drop.style.left  = rect.left + 'px';
  drop.style.width = rect.width + 'px';
}

function filterOwnerDropdown() {
  const q = document.getElementById('sla-owner').value.toLowerCase();
  renderOwnerDropdown(q);
  positionOwnerDropdown();
  document.getElementById('sla-owner-dropdown').classList.remove('hidden');
}

function openOwnerDropdown() {
  const q = document.getElementById('sla-owner').value.toLowerCase();
  renderOwnerDropdown(q);
  positionOwnerDropdown();
  document.getElementById('sla-owner-dropdown').classList.remove('hidden');
}

function renderOwnerDropdown(q) {
  const drop = document.getElementById('sla-owner-dropdown');
  drop.onclick = e => e.stopPropagation();
  drop.innerHTML = '';

  const matchedContacts = OWNER_OPTIONS.contacts.filter(c =>
    !q || c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q));
  const matchedQueues = OWNER_OPTIONS.queues.filter(qu =>
    !q || qu.name.toLowerCase().includes(q) || qu.desc.toLowerCase().includes(q));

  if (matchedContacts.length) {
    const lbl = document.createElement('div');
    lbl.className = 'owner-dropdown-group-label';
    lbl.textContent = 'Contacts';
    drop.appendChild(lbl);
    matchedContacts.forEach(c => {
      const item = document.createElement('div');
      item.className = 'owner-dropdown-item';
      item.innerHTML = `<span>${esc(c.name)}</span><span class="owner-dropdown-item-type">${esc(c.role)}</span>`;
      item.onclick = () => selectOwner(c.id, c.name, 'Contact');
      drop.appendChild(item);
    });
  }

  if (matchedQueues.length) {
    const lbl = document.createElement('div');
    lbl.className = 'owner-dropdown-group-label';
    lbl.textContent = 'Queues';
    drop.appendChild(lbl);
    matchedQueues.forEach(qu => {
      const item = document.createElement('div');
      item.className = 'owner-dropdown-item';
      item.innerHTML = `<span>${esc(qu.name)}</span><span class="owner-dropdown-item-type">${esc(qu.desc)}</span>`;
      item.onclick = () => selectOwner(qu.id, qu.name, 'Queue');
      drop.appendChild(item);
    });
  }

  if (!matchedContacts.length && !matchedQueues.length) {
    drop.innerHTML = '<div class="owner-dropdown-item" style="color:var(--sf-text-muted);cursor:default;">No matches</div>';
  }
}

function selectOwner(id, name, type) {
  document.getElementById('sla-owner').value    = name;
  document.getElementById('sla-owner-id').value = id;
  document.getElementById('sla-owner-type').value = type;
  document.getElementById('sla-owner-clear').classList.remove('hidden');
  document.getElementById('sla-owner-dropdown').classList.add('hidden');
}

function clearOwner() {
  document.getElementById('sla-owner').value     = '';
  document.getElementById('sla-owner-id').value  = '';
  document.getElementById('sla-owner-type').value = '';
  document.getElementById('sla-owner-clear').classList.add('hidden');
}

document.addEventListener('click', function(e) {
  const wrap = document.getElementById('sla-owner-wrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('sla-owner-dropdown')?.classList.add('hidden');
  }
});

function buildStageMetaCard(scId, stageIdx) {
  const key  = stageMetaKey(scId, stageIdx);
  const meta = stageMetaData[key] || {};
  const sla   = meta.sla        || '';
  const owner = meta.ownerName  || '';
  const ownerType = meta.ownerType || '';

  const slaDisplay = sla ? `${esc(sla)} hrs` : '—';
  const ownerDisplay = owner ? `${esc(owner)} (${esc(ownerType)})` : '—';

  const card = document.createElement('div');
  card.className = 'stage-meta-card';
  card.id = `stage-meta-card-${stageIdx}`;
  card.innerHTML = `
    <div class="sf-detail-grid" style="grid-template-columns: 1fr 1fr;">
      <div class="sf-detail-field">
        <div class="sf-detail-label">SLA</div>
        <div class="sf-detail-value sf-editable" onclick="editStageMetaInline(this, 'text', ${scId}, ${stageIdx}, 'sla', '${esc(sla)}')">${slaDisplay}</div>
      </div>
      <div class="sf-detail-field">
        <div class="sf-detail-label">Owner</div>
        <div class="sf-detail-value sf-editable" onclick="editStageMetaInline(this, 'text', ${scId}, ${stageIdx}, 'owner', '${esc(owner)}')">${ownerDisplay}</div>
      </div>
    </div>`;
  return card;
}

async function editStageMetaInline(element, inputType, scId, stageIdx, field, currentValue) {
  if (element.querySelector('input')) return;

  const originalHtml = element.innerHTML;
  const key = stageMetaKey(scId, stageIdx);
  const meta = stageMetaData[key] || {};

  if (field === 'owner') {
    // Create owner search dropdown
    const dropdownId = `inline-owner-dropdown-${stageIdx}`;
    element.innerHTML = `
      <div class="owner-search-wrap">
        <div class="owner-search-input-row" style="display: flex; align-items: center; gap: 4px; background: white; border: 1px solid #1589EE; border-radius: 4px; padding: 4px 8px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/>
            <path d="m16.5 16.5 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <input type="text" class="sf-inline-input" style="border: none; box-shadow: none; padding: 0; flex: 1;" placeholder="Search contacts or queues…" value="${esc(currentValue)}" autocomplete="off" />
        </div>
      </div>`;

    // Create dropdown as portal (appended to body)
    const dropdown = document.createElement('div');
    dropdown.id = dropdownId;
    dropdown.className = 'owner-dropdown';
    dropdown.style.cssText = 'position: fixed; z-index: 10000; background: white; border: 1px solid #c9c9c9; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); max-height: 200px; overflow-y: auto;';
    document.body.appendChild(dropdown);

    const input = element.querySelector('input');
    const inputRow = element.querySelector('.owner-search-input-row');

    // Position dropdown below input
    const positionDropdown = () => {
      const rect = inputRow.getBoundingClientRect();
      dropdown.style.top = (rect.bottom + 2) + 'px';
      dropdown.style.left = rect.left + 'px';
      dropdown.style.width = rect.width + 'px';
    };

    let selectedOwner = { id: meta.ownerId || '', name: currentValue, type: meta.ownerType || '' };

    const renderDropdown = (query) => {
      const q = query.toLowerCase();
      dropdown.innerHTML = '';

      const matchedContacts = OWNER_OPTIONS.contacts.filter(c =>
        !q || c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q));
      const matchedQueues = OWNER_OPTIONS.queues.filter(qu =>
        !q || qu.name.toLowerCase().includes(q) || qu.desc.toLowerCase().includes(q));

      if (matchedContacts.length) {
        const lbl = document.createElement('div');
        lbl.className = 'owner-dropdown-group-label';
        lbl.textContent = 'Contacts';
        dropdown.appendChild(lbl);
        matchedContacts.forEach(c => {
          const item = document.createElement('div');
          item.className = 'owner-dropdown-item';
          item.innerHTML = `<span>${esc(c.name)}</span><span class="owner-dropdown-item-type">${esc(c.role)}</span>`;
          item.onclick = (e) => {
            e.stopPropagation();
            selectedOwner = { id: c.id, name: c.name, type: 'Contact' };
            input.value = c.name;
            dropdown.style.display = 'none';
          };
          dropdown.appendChild(item);
        });
      }

      if (matchedQueues.length) {
        const lbl = document.createElement('div');
        lbl.className = 'owner-dropdown-group-label';
        lbl.textContent = 'Queues';
        dropdown.appendChild(lbl);
        matchedQueues.forEach(qu => {
          const item = document.createElement('div');
          item.className = 'owner-dropdown-item';
          item.innerHTML = `<span>${esc(qu.name)}</span><span class="owner-dropdown-item-type">${esc(qu.desc)}</span>`;
          item.onclick = (e) => {
            e.stopPropagation();
            selectedOwner = { id: qu.id, name: qu.name, type: 'Queue' };
            input.value = qu.name;
            dropdown.style.display = 'none';
          };
          dropdown.appendChild(item);
        });
      }

      if (!matchedContacts.length && !matchedQueues.length) {
        dropdown.innerHTML = '<div class="owner-dropdown-item" style="color:var(--sf-text-muted);cursor:default;">No matches</div>';
      }
    };

    input.focus();
    positionDropdown();
    renderDropdown(input.value);
    dropdown.style.display = 'block';

    input.addEventListener('input', () => {
      positionDropdown();
      renderDropdown(input.value);
      dropdown.style.display = 'block';
    });

    const save = async () => {
      if (!stageMetaData[key]) stageMetaData[key] = {};
      stageMetaData[key].ownerName = selectedOwner.name;
      stageMetaData[key].ownerType = selectedOwner.type;
      stageMetaData[key].ownerId = selectedOwner.id;

      persistStageMeta();

      dropdown.remove();
      const oldCard = document.getElementById(`stage-meta-card-${stageIdx}`);
      if (oldCard) oldCard.replaceWith(buildStageMetaCard(scId, stageIdx));
    };

    const cancel = () => {
      dropdown.remove();
      element.innerHTML = originalHtml;
    };

    input.addEventListener('blur', () => {
      setTimeout(save, 200);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        save();
      } else if (e.key === 'Escape') {
        cancel();
      }
    });

    document.addEventListener('click', function closeDropdown(e) {
      if (!element.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
        document.removeEventListener('click', closeDropdown);
      }
    });
  } else {
    // SLA field - simple text input
    let inputHtml = `<input type="text" class="sf-inline-input" value="${esc(currentValue)}" />`;
    element.innerHTML = inputHtml;
    const input = element.querySelector('input');
    input.focus();

    const save = async () => {
      const newValue = input.value.trim();

      if (!stageMetaData[key]) stageMetaData[key] = {};
      stageMetaData[key].sla = newValue;

      persistStageMeta();

      const oldCard = document.getElementById(`stage-meta-card-${stageIdx}`);
      if (oldCard) oldCard.replaceWith(buildStageMetaCard(scId, stageIdx));
    };

    const cancel = () => {
      element.innerHTML = originalHtml;
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        save();
      } else if (e.key === 'Escape') {
        cancel();
      }
    });
  }
}

function openStageMetaModal(scId, stageIdx) {
  const sc     = stageConfigs.find(x => x.id === scId);
  const stages = sc?.stages || [];
  const key    = stageMetaKey(scId, stageIdx);
  const meta = stageMetaData[key] || {};

  document.getElementById('sla-stage-key').value    = key;
  document.getElementById('stage-meta-modal-title').textContent = stages[stageIdx] || 'Edit Stage';
  document.getElementById('sla-value').value         = meta.sla || '';

  // restore owner search field
  document.getElementById('sla-owner').value      = meta.ownerName  || '';
  document.getElementById('sla-owner-id').value   = meta.ownerId    || '';
  document.getElementById('sla-owner-type').value = meta.ownerType  || '';
  const clearBtn = document.getElementById('sla-owner-clear');
  if (meta.ownerName) clearBtn.classList.remove('hidden');
  else clearBtn.classList.add('hidden');
  document.getElementById('sla-owner-dropdown').classList.add('hidden');

  document.getElementById('stage-meta-modal').classList.remove('hidden');
}

function closeStageMetaModal() {
  document.getElementById('stage-meta-modal').classList.add('hidden');
}

function saveStageMetaModal() {
  const key      = document.getElementById('sla-stage-key').value;
  const sla      = document.getElementById('sla-value').value.trim();
  const ownerName = document.getElementById('sla-owner').value.trim();
  const ownerId   = document.getElementById('sla-owner-id').value;
  const ownerType = document.getElementById('sla-owner-type').value;

  stageMetaData[key] = { sla, ownerName, ownerId, ownerType };
  persistStageMeta();
  closeStageMetaModal();

  const [scId, stageIdx] = key.split(':').map(Number);
  const oldCard = document.getElementById(`stage-meta-card-${stageIdx}`);
  if (oldCard) oldCard.replaceWith(buildStageMetaCard(scId, stageIdx));
}

function toggleAccordion(key) {
  const body  = document.getElementById('abody-' + key);
  const chev  = document.getElementById('achev-' + key);
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  chev.classList.toggle('open', !isOpen);

  // lazy-render section content when opened
  if (!isOpen) {
    if (key.startsWith('activities-')) {
      renderActivities(detailScId, parseInt(key.replace('activities-', '')));
    } else if (key.startsWith('transitions-')) {
      renderTransitions(detailScId, parseInt(key.replace('transitions-', '')));
    } else if (key.startsWith('stage-updates-')) {
      renderStageUpdatesSection(detailScId, parseInt(key.replace('stage-updates-', '')));
    }
  }

  // sync expand/collapse button label for this stage
  syncExpandBtn(activeStageIdx);
}

function toggleAllAccordions(stageIdx) {
  const anyOpen = SECTIONS.some(sec =>
    document.getElementById(`abody-${sec.id}-${stageIdx}`)?.classList.contains('open')
  );
  const shouldOpen = !anyOpen;

  SECTIONS.forEach(sec => {
    const body = document.getElementById(`abody-${sec.id}-${stageIdx}`);
    const chev = document.getElementById(`achev-${sec.id}-${stageIdx}`);
    if (!body) return;
    body.classList.toggle('open', shouldOpen);
    chev.classList.toggle('open', shouldOpen);
    if (shouldOpen && sec.id === 'activities') {
      renderActivities(detailScId, stageIdx);
    }
    if (shouldOpen && sec.id === 'transitions') {
      renderTransitions(detailScId, stageIdx);
    }
    if (shouldOpen && sec.id === 'stage-updates') {
      renderStageUpdatesSection(detailScId, stageIdx);
    }
  });

  syncExpandBtn(stageIdx);
}

function syncExpandBtn(stageIdx) {
  const btn = document.getElementById(`stage-expand-btn-${stageIdx}`);
  if (!btn) return;
  const anyOpen = SECTIONS.some(sec =>
    document.getElementById(`abody-${sec.id}-${stageIdx}`)?.classList.contains('open')
  );
  btn.innerHTML = anyOpen
    ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M19 9l-7 7-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
       </svg> Collapse All`
    : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M5 15l7-7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
       </svg> Expand All`;
}

// ── Activities ───────────────────────────────────────────────

let activitiesData = {};
// keyed by "scId:stageIdx" → [ {id, name, action, actionDetails, trigger, mandatory, conditions, expression} ]

let nextActivityId = 1;

async function persistActivities() {
  setActivitiesData(activitiesData);
  setNextActivityId(nextActivityId);
  await saveConfig();
}

function activitiesKey(scId, stageIdx) { return `${scId}:${stageIdx}`; }

function getActivities(scId, stageIdx) {
  return activitiesData[activitiesKey(scId, stageIdx)] || [];
}

// ── Render activities inside accordion body ──────────────────

function renderActivities(scId, stageIdx) {
  const bodyId = `abody-activities-${stageIdx}`;
  const body = document.getElementById(bodyId);
  if (!body) return;

  const acts = getActivities(scId, stageIdx);
  const key  = activitiesKey(scId, stageIdx);

  body.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'activities-wrap';

  const addBtn = document.createElement('div');
  addBtn.style.cssText = 'display:flex;justify-content:flex-end;';
  addBtn.innerHTML = `<button class="btn-new" onclick="openActivityModal(${scId}, 'sc-${scId}:${stageIdx}', null)">New Task</button>`;
  wrap.appendChild(addBtn);

  if (acts.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'act-empty';
    empty.textContent = 'No tasks yet. Click New Task to add one.';
    wrap.appendChild(empty);
  } else {
    const tableWrap = document.createElement('div');
    tableWrap.className = 'activities-table-wrap';
    const tbody = document.createElement('tbody');
    tbody.id = `act-tbody-${key.replace(':','-')}`;

    acts.forEach((a, pos) => {
      tbody.appendChild(buildActivityRow(a, pos, key));
    });

    const table = document.createElement('table');
    table.className = 'slds-table';
    table.innerHTML = `<thead><tr>
      <th>Name</th>
      <th>Process</th>
      <th>Availability</th>
      <th>Trigger</th>
      <th>Mandatory</th>
      <th>Actions</th>
    </tr></thead>`;
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    wrap.appendChild(tableWrap);

  }

  body.appendChild(wrap);
}

function buildProcessCell(a) {
  if (!a.action) return '<span style="color:var(--sf-text-muted)">—</span>';
  const detail = formatActionDetail(a);
  if (!detail || detail === '—') {
    return `<span class="badge-type">${esc(a.action)}</span>`;
  }
  const lines = [detail];
  const tooltipData = JSON.stringify({ title: a.action, lines }).replace(/"/g, '&quot;');
  return `<span class="badge-type" style="cursor:default;"
    data-tooltip='${tooltipData}'
    onmouseenter="showActTooltip(event, this)"
    onmouseleave="hideActTooltip()">${esc(a.action)}</span>`;
}

function buildConditionalBadge(rulesData, stageKey, title) {
  const conditions = rulesData?.conditions?.filter(c => c.activityId) || [];

  // Handle different stageKey formats
  let stageActs = [];
  if (stageKey.startsWith('stm-')) {
    // GLOBAL Submission Activity Configuration - show ONLY tasks from THIS config (isolated)
    const stmId = parseInt(stageKey.replace('stm-', ''));
    stageActs = getStmActivities(stmId) || [];
  } else if (stageKey.startsWith('sc-')) {
    // LOB-SPECIFIC Line Of Business Activity Configuration
    // Show: ALL global tasks + ALL tasks from this LOB config
    const cleanKey = stageKey.replace('sc-', '');
    const [scId, stageIdx] = cleanKey.split(':').map(Number);

    // 1. Get ALL global tasks from ALL Submission Activity Configurations
    const allActivityConfigs = activityConfigs || [];
    allActivityConfigs.forEach(config => {
      const globalTasks = getStmActivities(config.id) || [];
      stageActs = stageActs.concat(globalTasks);
    });

    // 2. Get ALL stage-level tasks from this LOB configuration (stages only, not submission-level)
    if (scId != null) {
      // Add tasks from all stages in this LOB config
      const currentStageConfig = stageConfigs.find(sc => sc.id === scId);
      if (currentStageConfig && currentStageConfig.stages) {
        currentStageConfig.stages.forEach((stage, stgIdx) => {
          const stageTasks = getActivities(scId, stgIdx) || [];
          stageActs = stageActs.concat(stageTasks);
        });
      }
    }
  } else {
    // Backward compatibility
    const [scId, stageIdx] = stageKey.split(':').map(Number);
    stageActs = getActivities(scId, stageIdx) || [];
  }

  if (!conditions.length) {
    return `<span class="badge-trigger" style="background:#EEF4FF;color:#3A3DB1;">Conditional</span>`;
  }

  const lines = conditions.map((c, i) => {
    const act = stageActs.find(a => a.id == c.activityId);
    let actLabel = `Task ${c.activityId}`;

    if (act) {
      // Resolve task name from activity reference
      if (act.activityRefId) {
        const activity = getActivityById(act.activityRefId);
        actLabel = act.nameOverride || activity?.name || 'Unknown Task';
      } else {
        actLabel = act.name || `Task ${c.activityId}`;
      }
    }

    const val = NO_VALUE_OPS.has(c.operator) ? '' : ` ${c.value || ''}`;
    return `${i + 1}. ${actLabel} · ${c.response || 'Outcome'} ${c.operator}${val}`;
  });

  const tooltipData = JSON.stringify({ title, lines }).replace(/"/g, '&quot;');
  return `<span class="badge-trigger cond-badge-hover" style="background:#EEF4FF;color:#3A3DB1;cursor:default;"
    data-tooltip='${tooltipData}'
    onmouseenter="showActTooltip(event, this)"
    onmouseleave="hideActTooltip()">Conditional</span>`;
}

function buildActivityRow(a, pos, key) {
  const detail = formatActionDetail(a);
  const availability = a.availability || 'On Stage Change';
  const trigger      = a.trigger      || 'Manual';

  const availBadge = availability === 'Conditional'
    ? buildConditionalBadge(a.availabilityRules, key, 'Availability Conditions')
    : `<span class="badge-trigger">${esc(availability)}</span>`;

  const trigBadge = trigger === 'Conditional'
    ? buildConditionalBadge(a.triggerRules, key, 'Trigger Conditions')
    : `<span class="badge-trigger">${esc(trigger)}</span>`;

  const processCell = buildProcessCell(a);

  const tr = document.createElement('tr');
  tr.dataset.actId = a.id;
  tr.dataset.key   = key;
  tr.innerHTML = `
    <td><a href="#" onclick="openActivityModal('${key}', ${a.id}); return false;">${esc(a.name)}</a></td>
    <td>${processCell}</td>
    <td>${availBadge}</td>
    <td>${trigBadge}</td>
    <td>${a.mandatory ? '<span class="badge-mandatory">Mandatory</span>' : '—'}</td>
    <td class="col-action">
      ${rowMenuBtn(`onclick="openRowMenu(this,[{label:'Edit',action:()=>openActivityModal('${key}',${a.id})},{label:'Delete',action:()=>deleteActivity('${key}',${a.id}),danger:true}]);event.stopPropagation()"`)}
    </td>`;
  return tr;
}

function buildPreCondCell(conditions, stageKey) {
  if (!conditions.length) return '<span style="color:var(--sf-text-muted)">—</span>';

  // Handle different stageKey formats
  let stageActs = [];
  if (stageKey) {
    if (stageKey.startsWith('stm-')) {
      const stmId = parseInt(stageKey.replace('stm-', ''));
      stageActs = getStmActivities(stmId) || [];
    } else if (stageKey.startsWith('sc-')) {
      const cleanKey = stageKey.replace('sc-', '');
      const [scId, stageIdx] = cleanKey.split(':').map(Number);
      stageActs = getActivities(scId, stageIdx) || [];
    } else {
      const [scId, stageIdx] = stageKey.split(':').map(Number);
      stageActs = (scId != null) ? getActivities(scId, stageIdx) : [];
    }
  }

  const lines = conditions.map((c, i) => {
    const act = stageActs.find(a => a.id == c.activityId);
    let label = c.activityId ? `Task ${c.activityId}` : '?';

    if (act) {
      // Resolve task name from activity reference
      if (act.activityRefId) {
        const activity = getActivityById(act.activityRefId);
        label = act.nameOverride || activity?.name || 'Unknown Task';
      } else {
        label = act.name || `Task ${c.activityId}`;
      }
    }

    const val = NO_VALUE_OPS.has(c.operator) ? '' : ` ${esc(c.value || '')}`;
    return `${i + 1}. ${esc(label)} · ${esc(c.response || 'Outcome')} ${esc(c.operator)}${val}`;
  });

  const tooltipData = JSON.stringify({ title: 'Pre-conditions', lines }).replace(/"/g, '&quot;');
  return `<span class="act-tooltip-trigger"
    data-tooltip='${tooltipData}'
    onmouseenter="showActTooltip(event, this)"
    onmouseleave="hideActTooltip()">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
      <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
    View
  </span>`;
}

// ── Drag-and-drop reorder ─────────────────────────────────────

let _dragSrc = null;

function initDrag(key) {
  const tbodyId = `act-tbody-${key.replace(':','-')}`;
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  tbody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('dragstart', e => {
      _dragSrc = tr;
      tr.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    tr.addEventListener('dragend', () => {
      tr.classList.remove('dragging');
      tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over'));
    });
    tr.addEventListener('dragover', e => {
      e.preventDefault();
      tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over'));
      if (tr !== _dragSrc) tr.classList.add('drag-over');
    });
    tr.addEventListener('drop', e => {
      e.preventDefault();
      if (_dragSrc && _dragSrc !== tr) {
        const [scId, stageIdx] = key.split(':').map(Number);
        const acts = activitiesData[key];

        // find indices
        const fromId = parseInt(_dragSrc.dataset.actId);
        const toId   = parseInt(tr.dataset.actId);
        const fromIdx = acts.findIndex(a => a.id === fromId);
        const toIdx   = acts.findIndex(a => a.id === toId);

        // reorder
        const [moved] = acts.splice(fromIdx, 1);
        acts.splice(toIdx, 0, moved);

        persistActivities();
        renderActivities(scId, stageIdx);
      }
    });
  });
}

function formatActionDetail(a) {
  if (!a.actionDetails) return '—';
  const d = a.actionDetails;
  if (a.action === 'Flow')                  return d.flowName  || '—';
  if (a.action === 'Integration Procedure') return d.ipName    || '—';
  if (a.action === 'Omniscript')            return [d.osType, d.osSubType].filter(Boolean).join(' / ') || '—';
  if (a.action === 'Agent')                 return d.agentName || '—';
  return '—';
}

// ── Activity Modal ───────────────────────────────────────────

function openActivityModal(stageKey, actId) {
  const [scId, stageIdx] = stageKey.split(':').map(Number);
  const acts = getActivities(scId, stageIdx);
  const act  = actId ? acts.find(a => a.id === actId) : null;

  document.getElementById('act-edit-id').value   = actId || '';
  document.getElementById('act-stage-key').value = stageKey;
  document.getElementById('activity-modal-title').textContent = act ? 'Edit Activity' : 'New Activity';

  document.getElementById('act-name').value    = act?.name   || '';
  document.getElementById('act-action').value  = act?.action || '';
  document.getElementById('act-mandatory').checked = act?.mandatory || false;

  // action details
  onActionTypeChange(act?.actionDetails || {});

  // availability
  const availability = act?.availability || 'On Stage Change';
  document.querySelectorAll('[name="act-availability"]').forEach(r => {
    r.checked = r.value === availability;
  });
  const availInst = `act-avail-${stageKey}-${actId || 'new'}`;
  rulesInstances[availInst] = act?.availabilityRules
    ? JSON.parse(JSON.stringify(act.availabilityRules))
    : { stageKey, conditions: [], expression: '' };
  const availWrap = document.getElementById('act-availability-rules-wrap');
  if (availability === 'Conditional') {
    availWrap.classList.remove('hidden');
    setTimeout(() => createRulesModule('act-availability-rules', availInst, stageKey), 0);
  } else {
    availWrap.classList.add('hidden');
  }

  // trigger
  const trigger = act?.trigger || 'Manual';
  document.querySelectorAll('[name="act-trigger"]').forEach(r => {
    r.checked = r.value === trigger;
  });
  const trigInst = `act-trig-${stageKey}-${actId || 'new'}`;
  rulesInstances[trigInst] = act?.triggerRules
    ? JSON.parse(JSON.stringify(act.triggerRules))
    : { stageKey, conditions: [], expression: '' };
  const trigWrap = document.getElementById('act-trigger-rules-wrap');
  if (trigger === 'Conditional') {
    trigWrap.classList.remove('hidden');
    setTimeout(() => createRulesModule('act-trigger-rules', trigInst, stageKey), 0);
  } else {
    trigWrap.classList.add('hidden');
  }

  document.getElementById('activity-modal').classList.remove('hidden');
}

function onAvailabilityChange() {
  const stageKey = document.getElementById('act-stage-key').value;
  const actId    = document.getElementById('act-edit-id').value;
  const val      = document.querySelector('[name="act-availability"]:checked')?.value;
  const wrap     = document.getElementById('act-availability-rules-wrap');
  if (val === 'Conditional') {
    wrap.classList.remove('hidden');
    const inst = `act-avail-${stageKey}-${actId || 'new'}`;
    if (!rulesInstances[inst]) rulesInstances[inst] = { stageKey, conditions: [], expression: '' };
    setTimeout(() => createRulesModule('act-availability-rules', inst, stageKey), 0);
  } else {
    wrap.classList.add('hidden');
  }
}

function onTriggerChange() {
  const stageKey = document.getElementById('act-stage-key').value;
  const actId    = document.getElementById('act-edit-id').value;
  const val      = document.querySelector('[name="act-trigger"]:checked')?.value;
  const wrap     = document.getElementById('act-trigger-rules-wrap');
  const buttonNameWrap = document.getElementById('act-button-name-wrap');

  // Show/hide button name field for Manual trigger
  if (val === 'Manual') {
    buttonNameWrap.style.display = 'block';
    const buttonNameInput = document.getElementById('act-button-name');
    if (!buttonNameInput.value) {
      buttonNameInput.value = 'Run Task';
    }
  } else {
    buttonNameWrap.style.display = 'none';
  }

  if (val === 'Conditional') {
    wrap.classList.remove('hidden');
    // Check if this is a submission-level activity
    if (stageKey.startsWith('stm-')) {
      const stmId = stageKey.replace('stm-', '');
      const inst = `stm-act-trig-${stmId}-${actId || 'new'}`;
      if (!rulesInstances[inst]) rulesInstances[inst] = { stageKey, conditions: [], expression: '' };
      setTimeout(() => createRulesModule('act-trigger-rules', inst, stageKey), 0);
    } else {
      const inst = `act-trig-${stageKey}-${actId || 'new'}`;
      if (!rulesInstances[inst]) rulesInstances[inst] = { stageKey, conditions: [], expression: '' };
      setTimeout(() => createRulesModule('act-trigger-rules', inst, stageKey), 0);
    }
  } else {
    wrap.classList.add('hidden');
  }

  // Update preview
  if (typeof updateActivityPreview === 'function') {
    updateActivityPreview();
  }
}

function closeActivityModal() {
  document.getElementById('activity-modal').classList.add('hidden');
}

function onActionTypeChange(existingDetails) {
  const action = document.getElementById('act-action').value;
  const details = existingDetails || {};
  const wrap = document.getElementById('act-action-details');

  const ACTION_CONFIGS = {
    'Flow': [
      { id: 'flowName', label: 'Flow API Name', placeholder: 'e.g. Submission_Underwriting_Flow', type: 'search' },
      { id: 'inputVars', label: 'Input Variables', placeholder: 'e.g. recordId={!Submission.Id}', type: 'text' },
    ],
    'Integration Procedure': [
      { id: 'ipName',    label: 'Integration Procedure Name', placeholder: 'e.g. Submission_FetchCarrierQuote', type: 'search' },
      { id: 'inputJson', label: 'Input JSON Key',             placeholder: 'e.g. submissionId',                 type: 'text' },
    ],
    'Omniscript': [
      { id: 'osType',     label: 'OmniScript Type',    placeholder: 'e.g. Submission',      type: 'text' },
      { id: 'osSubType',  label: 'OmniScript SubType', placeholder: 'e.g. UnderwriteReview', type: 'text' },
      { id: 'osLanguage', label: 'Language',            placeholder: 'e.g. English',          type: 'text' },
    ],
    'Agent': [
      { id: 'agentName',  label: 'Agent Name',   placeholder: 'e.g. Underwriting Copilot', type: 'search' },
      { id: 'agentTopic', label: 'Topic',         placeholder: 'e.g. RiskAssessment',       type: 'text' },
      { id: 'agentInput', label: 'Input Context', placeholder: 'e.g. {!Submission.Id}',     type: 'text' },
    ],
  };

  if (!action || !ACTION_CONFIGS[action]) {
    wrap.innerHTML = `<p class="form-hint">Choose a Process type above to configure details.</p>`;
    return;
  }

  const gridPairs = ACTION_CONFIGS[action];
  const html = `<div class="form-row" style="flex-wrap:wrap;">` +
    gridPairs.map(cfg => {
      const val = esc(details[cfg.id] || '');
      if (cfg.type === 'select') {
        const opts = cfg.options.map(o => `<option ${o === (details[cfg.id] || '') ? 'selected' : ''}>${o}</option>`).join('');
        return `<div class="form-group">
          <label>${cfg.label}</label>
          <select id="actd-${cfg.id}" onchange="setActionDetail('${cfg.id}', this.value)">
            ${opts}
          </select>
        </div>`;
      }
      if (cfg.type === 'search') {
        return `<div class="form-group">
          <label>${cfg.label}</label>
          <div class="action-detail-search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/>
              <path d="m16.5 16.5 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <input type="text" id="actd-${cfg.id}" value="${val}"
              placeholder="${cfg.placeholder}"
              oninput="setActionDetail('${cfg.id}', this.value)" />
          </div>
        </div>`;
      }
      return `<div class="form-group">
        <label>${cfg.label}</label>
        <input type="text" id="actd-${cfg.id}" value="${val}"
          placeholder="${cfg.placeholder || ''}"
          oninput="setActionDetail('${cfg.id}', this.value)" />
      </div>`;
    }).join('') + `</div>`;

  wrap.innerHTML = html;
}

// Temp store for action details being edited
let _actDetailBuf = {};
function setActionDetail(key, val) { _actDetailBuf[key] = val; }

async function saveActivity() {
  const name        = document.getElementById('act-name').value.trim();
  const action      = document.getElementById('act-action').value;
  const availability = document.querySelector('[name="act-availability"]:checked')?.value || 'On Stage Change';
  const trigger     = document.querySelector('[name="act-trigger"]:checked')?.value || 'Manual';
  const mandatory   = document.getElementById('act-mandatory').checked;
  const stageKey    = document.getElementById('act-stage-key').value;
  const actId       = document.getElementById('act-edit-id').value;

  if (!name)   { alert('Name is required.');   return; }
  if (!action) { alert('Process is required.');  return; }

  // collect action details from DOM
  const actionDetails = {};
  document.querySelectorAll('[id^="actd-"]').forEach(el => {
    const key = el.id.replace('actd-', '');
    actionDetails[key] = el.value;
  });

  // Check if this is a submission-level activity (stm-X) or stage-level activity (scId:stageIdx)
  if (stageKey.startsWith('stm-')) {
    // Submission-level activity
    const stmId = parseInt(stageKey.replace('stm-', ''));
    const trigInst = `stm-act-trig-${stmId}-${actId || 'new'}`;
    const triggerRules = trigger === 'Conditional' ? getRulesData(trigInst) : null;

    const record = { name, action, actionDetails, trigger, triggerRules, mandatory };

    if (!stmActivitiesData[stmId]) stmActivitiesData[stmId] = [];

    if (actId) {
      const idx = stmActivitiesData[stmId].findIndex(a => a.id === parseInt(actId));
      stmActivitiesData[stmId][idx] = { id: parseInt(actId), ...record };
    } else {
      stmActivitiesData[stmId].push({ id: nextStmActivityId++, ...record });
    }

    await persistStmActivities();
    closeActivityModal();
    const stm = activityConfigs.find(x => x.id === stmId);
    renderStmActivities(stm);
  } else {
    // Stage-level activity
    const availInst      = `act-avail-${stageKey}-${actId || 'new'}`;
    const availabilityRules = availability === 'Conditional' ? getRulesData(availInst) : null;

    const trigInst   = `act-trig-${stageKey}-${actId || 'new'}`;
    const triggerRules = trigger === 'Conditional' ? getRulesData(trigInst) : null;

    const record = { name, action, actionDetails, availability, availabilityRules, trigger, triggerRules, mandatory };

    const [scId, stageIdx] = stageKey.split(':').map(Number);
    if (!activitiesData[stageKey]) activitiesData[stageKey] = [];

    if (actId) {
      const idx = activitiesData[stageKey].findIndex(a => a.id === parseInt(actId));
      activitiesData[stageKey][idx] = { id: parseInt(actId), ...record };
    } else {
      activitiesData[stageKey].push({ id: nextActivityId++, ...record });
    }

    await persistActivities();
    closeActivityModal();
    renderActivities(scId, stageIdx);
  }
}

async function deleteActivity(stageKey, actId) {
  const act = activitiesData[stageKey]?.find(a => a.id === actId);
  if (!confirm(`Delete activity "${act?.name}"?`)) return;
  activitiesData[stageKey] = activitiesData[stageKey].filter(a => a.id !== actId);
  await persistActivities();
  const [scId, stageIdx] = stageKey.split(':').map(Number);
  renderActivities(scId, stageIdx);
}

// ── Rules Module ─────────────────────────────────────────────

const NO_VALUE_OPS = new Set(['is blank', 'is not blank']);

const STRING_OPERATORS = ['equals', 'not equals', 'contains', 'does not contain', 'starts with', 'ends with', 'is blank', 'is not blank'];

// Each rules instance: { stageKey, conditions: [{activityId, response, operator, value}], expression }
let rulesInstances = {};

function createRulesModule(containerId, instanceId, stageKey) {
  if (!rulesInstances[instanceId]) {
    rulesInstances[instanceId] = { stageKey: stageKey || '', conditions: [], expression: '' };
  } else if (stageKey) {
    rulesInstances[instanceId].stageKey = stageKey;
  }
  const container = document.getElementById(containerId);
  if (!container) return;

  const div = document.createElement('div');
  div.className = 'rules-module';
  div.id = 'rm-' + instanceId;
  container.innerHTML = '';
  container.appendChild(div);

  renderRulesModule(instanceId);
}

function renderRulesModule(instanceId) {
  const inst = rulesInstances[instanceId];
  const root = document.getElementById('rm-' + instanceId);
  if (!root) return;

  root.innerHTML = `
    <div class="rules-module-header">
      <span class="rules-module-title">Conditions</span>
    </div>
    <div class="rules-module-body">
      <div class="rules-expression-row">
        <span class="rules-expression-label">Filter Logic</span>
        <input class="rules-expression-input" id="rm-expr-${instanceId}"
          value="${esc(inst.expression)}"
          placeholder="e.g. (1 AND 2) OR 3"
          oninput="rulesInstances['${instanceId}'].expression = this.value" />
        <span class="rules-expression-hint">Use row numbers, AND, OR, parentheses</span>
      </div>
      <div class="rules-conditions" id="rm-rows-${instanceId}"></div>
      <button class="rules-add-btn" onclick="addRuleRow('${instanceId}')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Add Condition
      </button>
    </div>`;

  renderRuleRows(instanceId);
}

function renderRuleRows(instanceId) {
  const inst = rulesInstances[instanceId];
  const container = document.getElementById('rm-rows-' + instanceId);
  if (!container) return;
  container.innerHTML = '';

  // resolve activities for this instance's stageKey
  const stageKey = inst.stageKey || '';
  let stageActs = [];

  if (stageKey.startsWith('stm-')) {
    // GLOBAL Submission Activity Configuration - show ONLY tasks from THIS config (isolated)
    const stmId = parseInt(stageKey.replace('stm-', ''));
    stageActs = getStmActivities(stmId) || [];
  } else if (stageKey.startsWith('sc-')) {
    // LOB-SPECIFIC Line Of Business Activity Configuration
    // Show: ALL global tasks + ALL tasks from this LOB config
    const cleanKey = stageKey.replace('sc-', '');
    const [skScId, skStageIdx] = cleanKey.split(':').map(Number);

    // 1. Get ALL global tasks from ALL Submission Activity Configurations
    const allActivityConfigs = activityConfigs || [];
    allActivityConfigs.forEach(config => {
      const globalTasks = getStmActivities(config.id) || [];
      stageActs = stageActs.concat(globalTasks);
    });

    // 2. Get ALL stage-level tasks from this LOB configuration (stages only, not submission-level)
    if (skScId != null) {
      // Add tasks from all stages in this LOB config
      const currentStageConfig = stageConfigs.find(sc => sc.id === skScId);
      if (currentStageConfig && currentStageConfig.stages) {
        currentStageConfig.stages.forEach((stage, stageIdx) => {
          const stageTasks = getActivities(skScId, stageIdx) || [];
          stageActs = stageActs.concat(stageTasks);
        });
      }
    }
  } else if (stageKey) {
    // Backward compatibility (old format without prefix)
    const [skScId, skStageIdx] = stageKey.split(':').map(Number);
    stageActs = (skScId != null) ? (getActivities(skScId, skStageIdx) || []) : [];
  }

  inst.conditions.forEach((cond, idx) => {
    const noVal = NO_VALUE_OPS.has(cond.operator);
    const actOpts = stageActs.map((a, i) => {
      // Resolve task name from activity reference or use name directly
      let taskName = a.name || '—';
      if (a.activityRefId) {
        const activity = getActivityById(a.activityRefId);
        taskName = a.nameOverride || activity?.name || 'Unknown Task';
      }
      return `<option value="${a.id}" ${cond.activityId == a.id ? 'selected' : ''}>${esc((i + 1) + '. ' + taskName)}</option>`;
    }).join('');
    const noActivities = stageActs.length === 0;

    const responseOpts = ['Outcome', 'Value'].map(r =>
      `<option ${cond.response === r ? 'selected' : ''}>${r}</option>`).join('');

    const opOpts = STRING_OPERATORS.map(op =>
      `<option ${cond.operator === op ? 'selected' : ''}>${op}</option>`).join('');

    const valueCell = noVal
      ? `<span style="flex:1.5;min-width:0;"></span>`
      : `<input class="rule-value" id="rv-val-${instanceId}-${idx}"
           type="text" placeholder="Value"
           value="${esc(cond.value || '')}"
           oninput="rulesInstances['${instanceId}'].conditions[${idx}].value = this.value" />`;

    const row = document.createElement('div');
    row.className = 'rule-row';
    row.id = `rm-row-${instanceId}-${idx}`;
    row.innerHTML = `
      <span class="rule-row-num">${idx + 1}</span>

      <select class="rule-operator" id="rv-act-${instanceId}-${idx}"
        onchange="onRuleActivityChange('${instanceId}', ${idx})">
        <option value="">— Task —</option>
        ${noActivities ? '<option disabled>No tasks in this stage</option>' : actOpts}
      </select>

      <select class="rule-operator" id="rv-resp-${instanceId}-${idx}"
        onchange="rulesInstances['${instanceId}'].conditions[${idx}].response = this.value">
        ${responseOpts}
      </select>

      <select class="rule-operator" id="rv-op-${instanceId}-${idx}"
        onchange="onRuleOperatorChange('${instanceId}', ${idx})">
        ${opOpts}
      </select>

      ${valueCell}

      <button class="rule-delete-btn" onclick="deleteRuleRow('${instanceId}', ${idx})" title="Remove">×</button>`;

    container.appendChild(row);
  });
}

function onRuleActivityChange(instanceId, idx) {
  const sel = document.getElementById(`rv-act-${instanceId}-${idx}`);
  rulesInstances[instanceId].conditions[idx].activityId = sel.value ? parseInt(sel.value) : '';

  // Update preview if it exists
  if (typeof updateActivityPreview === 'function') {
    updateActivityPreview();
  }
}

function onRuleOperatorChange(instanceId, idx) {
  const op = document.getElementById(`rv-op-${instanceId}-${idx}`).value;
  rulesInstances[instanceId].conditions[idx].operator = op;
  renderRuleRows(instanceId);
}

function addRuleRow(instanceId) {
  rulesInstances[instanceId].conditions.push({ activityId: '', response: 'Outcome', operator: 'equals', value: '' });
  renderRuleRows(instanceId);

  // Update preview if it exists
  if (typeof updateActivityPreview === 'function') {
    updateActivityPreview();
  }
}

function deleteRuleRow(instanceId, idx) {
  rulesInstances[instanceId].conditions.splice(idx, 1);
  renderRuleRows(instanceId);

  // Update preview if it exists
  if (typeof updateActivityPreview === 'function') {
    updateActivityPreview();
  }
}

function getRulesData(instanceId) {
  return rulesInstances[instanceId] || { conditions: [], expression: '' };
}

// ── Transition Rules ─────────────────────────────────────────
// stored as { "scId:stageIdx": [ {id, toStage, ifFalse, rulesData} ] }

let transitionRules = JSON.parse(localStorage.getItem('uw_tr_rules')) || {};
let nextTrId = parseInt(localStorage.getItem('uw_next_tr_id')) || 1;

function persistTrRules() {
  localStorage.setItem('uw_tr_rules', JSON.stringify(transitionRules));
  localStorage.setItem('uw_next_tr_id', nextTrId);
}

function trKey(scId, stageIdx) { return `${scId}:${stageIdx}`; }
function getTrRules(scId, stageIdx) { return transitionRules[trKey(scId, stageIdx)] || []; }

// lazy-render hook called from toggleAccordion
function renderTransitions(scId, stageIdx) {
  const bodyId = `abody-transitions-${stageIdx}`;
  const body = document.getElementById(bodyId);
  if (!body) return;

  const sc     = stageConfigs.find(x => x.id === scId);
  const stages = sc?.stages || [];
  const key    = trKey(scId, stageIdx);
  const rules   = getTrRules(scId, stageIdx);

  body.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:12px;padding:16px 18px;';

  // add button
  const addRow = document.createElement('div');
  addRow.style.cssText = 'display:flex;justify-content:flex-end;';
  addRow.innerHTML = `<button class="btn-new" onclick="openTrModal('${key}', null)">New Rule</button>`;
  wrap.appendChild(addRow);

  if (rules.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'tr-empty';
    empty.textContent = 'No transition rules yet. Click New Rule to add one.';
    wrap.appendChild(empty);
  } else {
    // group by toStage
    const groups = {};
    rules.forEach(r => {
      if (!groups[r.toStage]) groups[r.toStage] = [];
      groups[r.toStage].push(r);
    });

    Object.entries(groups).forEach(([toStage, groupRules]) => {
      wrap.appendChild(buildTrGroup(toStage, groupRules, stages, stageIdx, key));
    });
  }

  body.appendChild(wrap);
}

function buildTrGroup(toStage, groupRules, stages, stageIdx, key) {
  const currentStageName = stages[stageIdx] || `Stage ${stageIdx + 1}`;
  const group = document.createElement('div');
  group.className = 'tr-group';
  group.dataset.toStage = toStage;

  const header = document.createElement('div');
  header.className = 'tr-group-header';
  header.innerHTML = `
    <div class="tr-group-title">
      <span>${esc(currentStageName)}</span>
      <span class="tr-group-arrow">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span>${esc(toStage)}</span>
    </div>
    <div class="tr-group-actions">
      <button class="row-action-btn" onclick="openTrModal('${key}', null, '${esc(toStage)}')">Add Rule</button>
    </div>`;
  group.appendChild(header);

  const tableWrap = document.createElement('div');
  tableWrap.style.cssText = 'overflow-x:auto;';

  const tbody = document.createElement('tbody');
  tbody.className = 'tr-rule-list';
  tbody.dataset.key = key;
  tbody.dataset.toStage = toStage;

  groupRules.forEach((r, idx) => {
    tbody.appendChild(buildTrRow(r, idx, key));
  });

  const table = document.createElement('table');
  table.className = 'slds-table';
  table.innerHTML = `<thead><tr>
    <th style="width:28px"></th>
    <th style="width:36px">#</th>
    <th>Transition Conditions</th>
    <th style="width:120px">Trigger</th>
    <th style="width:100px">Actions</th>
  </tr></thead>`;
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  group.appendChild(tableWrap);

  setTimeout(() => initTrDrag(tbody, key), 0);
  return group;
}

function buildTrRow(r, idx, key) {
  const [scId, stageIdx] = key.split(':').map(Number);
  const stageActs = getActivities(scId, stageIdx);
  const conditions = r.rulesData?.conditions?.filter(c => c.activityId) || [];
  const expr = r.rulesData?.expression || '';

  let condHtml = '<span style="color:var(--sf-text-muted);font-style:italic;">No conditions defined</span>';
  if (conditions.length) {
    const lines = conditions.map((c, i) => {
      const act = stageActs.find(a => a.id == c.activityId);
      let actLabel = `Task ${c.activityId}`;

      if (act) {
        // Resolve task name from activity reference
        if (act.activityRefId) {
          const activity = getActivityById(act.activityRefId);
          actLabel = act.nameOverride || activity?.name || 'Unknown Task';
        } else {
          actLabel = act.name || `Task ${c.activityId}`;
        }
      }

      const val = NO_VALUE_OPS.has(c.operator) ? '' : ` <strong>${esc(c.value || '')}</strong>`;
      return `<div>${i + 1}. ${esc(actLabel)} · <em>${esc(c.response || 'Outcome')}</em> ${esc(c.operator)}${val}</div>`;
    }).join('');
    const exprLine = expr
      ? `<div style="margin-top:4px;font-size:11px;color:var(--sf-text-muted);">Logic: ${esc(expr)}</div>`
      : '';
    condHtml = lines + exprLine;
  }

  const tr = document.createElement('tr');
  tr.className = 'tr-row';
  tr.draggable = true;
  tr.dataset.trId = r.id;
  tr.innerHTML = `
    <td class="tr-drag-handle" title="Drag to reorder">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <circle cx="9"  cy="5"  r="1.5" fill="currentColor"/>
        <circle cx="15" cy="5"  r="1.5" fill="currentColor"/>
        <circle cx="9"  cy="12" r="1.5" fill="currentColor"/>
        <circle cx="15" cy="12" r="1.5" fill="currentColor"/>
        <circle cx="9"  cy="19" r="1.5" fill="currentColor"/>
        <circle cx="15" cy="19" r="1.5" fill="currentColor"/>
      </svg>
    </td>
    <td class="act-pos-cell" style="font-size:11px;font-weight:700;color:var(--sf-text-muted);text-align:center;">${idx + 1}</td>
    <td><div class="tr-row-conditions">${condHtml}</div></td>
    <td><span class="badge-trigger">${esc(r.trigger || 'Manual')}</span></td>
    <td class="col-action">
      ${rowMenuBtn(`onclick="openRowMenu(this,[{label:'Edit',action:()=>openTrModal('${key}',${r.id})},{label:'Delete',action:()=>deleteTrRule('${key}',${r.id}),danger:true}]);event.stopPropagation()"`)}
    </td>`;
  return tr;
}

// ── Transition drag-and-drop ──────────────────────────────────

let _trDragSrc = null;

function initTrDrag(list, key) {
  list.querySelectorAll('tr.tr-row').forEach(row => {
    row.addEventListener('dragstart', e => {
      _trDragSrc = row;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      list.querySelectorAll('tr.tr-row').forEach(r => r.classList.remove('drag-over'));
    });
    row.addEventListener('dragover', e => {
      e.preventDefault();
      list.querySelectorAll('tr.tr-row').forEach(r => r.classList.remove('drag-over'));
      if (row !== _trDragSrc) row.classList.add('drag-over');
    });
    row.addEventListener('drop', e => {
      e.preventDefault();
      if (!_trDragSrc || _trDragSrc === row) return;

      const fromId = parseInt(_trDragSrc.dataset.trId);
      const toId   = parseInt(row.dataset.trId);
      const rules  = transitionRules[key];
      const fromIdx = rules.findIndex(r => r.id === fromId);
      const toIdx   = rules.findIndex(r => r.id === toId);

      // only allow drag within same toStage group
      if (rules[fromIdx].toStage !== rules[toIdx].toStage) return;

      const [moved] = rules.splice(fromIdx, 1);
      rules.splice(toIdx, 0, moved);
      persistTrRules();

      const [scId, stageIdx] = key.split(':').map(Number);
      renderTransitions(scId, stageIdx);
    });
  });
}

// ── Transition Rule Modal ─────────────────────────────────────

function openTrModal(stageKey, trId, presetToStage) {
  const [scId, stageIdx] = stageKey.split(':').map(Number);
  const sc     = stageConfigs.find(x => x.id === scId);
  const stages = sc?.stages || [];
  const rules  = getTrRules(scId, stageIdx);
  const rule    = trId ? rules.find(r => r.id === trId) : null;

  document.getElementById('tr-edit-id').value    = trId || '';
  document.getElementById('tr-stage-key').value  = stageKey;
  document.getElementById('tr-modal-title').textContent = rule ? 'Edit Transition Rule' : 'New Transition Rule';

  // populate target stage dropdown (all stages except current)
  const sel = document.getElementById('tr-to-stage');
  sel.innerHTML = '<option value="">— Select target stage —</option>';
  stages.forEach((s, i) => {
    if (i === stageIdx) return;
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  });
  sel.value = rule?.toStage || presetToStage || '';

  // trigger radio
  document.querySelectorAll('[name="tr-trigger"]').forEach(r => {
    r.checked = r.value === (rule?.trigger || 'Manual');
  });

  // rules module
  const instId = `tr-${stageKey}-${trId || 'new'}`;
  rulesInstances[instId] = rule?.rulesData
    ? JSON.parse(JSON.stringify(rule.rulesData))
    : { stageKey, conditions: [], expression: '' };
  setTimeout(() => createRulesModule('tr-rules-mount', instId, stageKey), 0);

  document.getElementById('tr-modal').classList.remove('hidden');
}

function closeTrModal() {
  document.getElementById('tr-modal').classList.add('hidden');
}

function saveTrRule() {
  const stageKey = document.getElementById('tr-stage-key').value;
  const trId     = document.getElementById('tr-edit-id').value;
  const toStage  = document.getElementById('tr-to-stage').value;

  if (!toStage) { alert('Please select a target stage.'); return; }

  const instId   = `tr-${stageKey}-${trId || 'new'}`;
  const rulesData = getRulesData(instId);

  const trigger  = document.querySelector('[name="tr-trigger"]:checked')?.value || 'Manual';

  const record = { toStage, trigger, rulesData };

  if (!transitionRules[stageKey]) transitionRules[stageKey] = [];

  if (trId) {
    const idx = transitionRules[stageKey].findIndex(r => r.id === parseInt(trId));
    transitionRules[stageKey][idx] = { id: parseInt(trId), ...record };
  } else {
    transitionRules[stageKey].push({ id: nextTrId++, ...record });
  }

  persistTrRules();
  closeTrModal();
  const [scId, stageIdx] = stageKey.split(':').map(Number);
  renderTransitions(scId, stageIdx);
}

function deleteTrRule(stageKey, trId) {
  const rule = transitionRules[stageKey]?.find(r => r.id === trId);
  if (!confirm(`Delete this transition rule to "${rule?.toStage}"?`)) return;
  transitionRules[stageKey] = transitionRules[stageKey].filter(r => r.id !== trId);
  persistTrRules();
  const [scId, stageIdx] = stageKey.split(':').map(Number);
  renderTransitions(scId, stageIdx);
}

// ── Submission-level Summary (per SC) ────────────────────────
// stored as { scId: prompt }

const SC_SUMMARY_DEFAULT =
  'Summarise the insurance being requested in this submission, including the line of business, coverage types, insured entity, requested premium, and effective dates. Keep it concise — 2 to 3 sentences.';

let scSummaryData = JSON.parse(localStorage.getItem('uw_sc_summary')) || {};

function persistScSummary() {
  localStorage.setItem('uw_sc_summary', JSON.stringify(scSummaryData));
}

function renderScSummarySection(sc) {
  const el = document.getElementById('sc-summary-section');
  const prompt = scSummaryData[sc.id] || '';

  el.innerHTML = `
    <div class="sf-section-header" onclick="toggleSfSection('sc-summary-fields')">
      <svg class="sf-section-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="m9 18 6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="sf-section-title">Submission Line Summary</span>
    </div>
    <div id="sc-summary-fields" class="sf-detail-grid" style="grid-template-columns: 1fr;">
      <div class="sf-detail-field">
        <div class="sf-detail-label">Prompt</div>
        <div class="sf-detail-value-row">
          <div class="sf-detail-value sf-editable" style="white-space: pre-wrap;" onclick="editScInline(this, 'textarea', ${sc.id}, 'prompt', \`${(prompt || '').replace(/`/g, '\\`')}\`)">${prompt ? esc(prompt) : '—'}</div>
          <button class="sf-edit-icon" onclick="editScInline(event.target.closest('.sf-detail-field').querySelector('.sf-detail-value'), 'textarea', ${sc.id}, 'prompt', \`${(prompt || '').replace(/`/g, '\\`')}\`); event.stopPropagation();" title="Edit prompt">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>`;
}

function openScSummaryModal(scId) {
  const prompt = scSummaryData[scId] || SC_SUMMARY_DEFAULT;
  document.getElementById('sc-summary-sc-id').value = scId;
  document.getElementById('sc-summary-prompt').value = prompt;
  document.getElementById('sc-summary-modal').classList.remove('hidden');
}

function closeScSummaryModal() {
  document.getElementById('sc-summary-modal').classList.add('hidden');
}

function saveScSummaryModal() {
  const scId   = parseInt(document.getElementById('sc-summary-sc-id').value);
  const prompt = document.getElementById('sc-summary-prompt').value.trim();
  scSummaryData[scId] = prompt;
  persistScSummary();
  closeScSummaryModal();
  const sc = stageConfigs.find(x => x.id === scId);
  renderScSummarySection(sc);
}

// ── Stage Updates (per stage) ─────────────────────────────────
// stored as { "scId:stageIdx": prompt }

const STAGE_UPDATES_DEFAULT =
  'Summarise the most recent actions taken at this stage, such as documents uploaded, carrier responses received, underwriter notes added, or status changes made in the last 7 days.';

let stageUpdatesData = JSON.parse(localStorage.getItem('uw_stage_updates')) || {};

function persistStageUpdates() {
  localStorage.setItem('uw_stage_updates', JSON.stringify(stageUpdatesData));
}

function stageUpdatesKey(scId, stageIdx) { return `${scId}:${stageIdx}`; }

function renderStageUpdatesSection(scId, stageIdx) {
  const bodyId = `abody-stage-updates-${stageIdx}`;
  const body = document.getElementById(bodyId);
  if (!body) return;

  const key    = stageUpdatesKey(scId, stageIdx);
  const prompt = stageUpdatesData[key] || '';

  body.innerHTML = `
    <div class="sf-detail-field">
      <div class="sf-detail-label">Prompt</div>
      <div class="sf-detail-value-row">
        <div class="sf-detail-value sf-editable" style="white-space: pre-wrap;" onclick="editStageUpdatesInline(this, ${scId}, ${stageIdx}, \`${(prompt || '').replace(/`/g, '\\`')}\`)">${prompt ? esc(prompt) : '—'}</div>
        <button class="sf-edit-icon" onclick="editStageUpdatesInline(event.target.closest('.sf-detail-field').querySelector('.sf-detail-value'), ${scId}, ${stageIdx}, \`${(prompt || '').replace(/`/g, '\\`')}\`); event.stopPropagation();" title="Edit prompt">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>`;
}

async function editStageUpdatesInline(element, scId, stageIdx, currentValue) {
  if (element.querySelector('textarea')) return;

  const originalHtml = element.innerHTML;
  const key = stageUpdatesKey(scId, stageIdx);

  const textarea = document.createElement('textarea');
  textarea.className = 'sf-inline-textarea';
  textarea.rows = 4;
  textarea.value = currentValue;
  textarea.style.whiteSpace = 'pre-wrap';

  element.innerHTML = '';
  element.appendChild(textarea);
  textarea.focus();

  const save = async () => {
    const newValue = textarea.value.trim();
    stageUpdatesData[key] = newValue;
    persistStageUpdates();
    renderStageUpdatesSection(scId, stageIdx);
  };

  const cancel = () => {
    element.innerHTML = originalHtml;
  };

  textarea.addEventListener('blur', save);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  });
}

function openStageUpdatesModal(key) {
  const prompt = stageUpdatesData[key] || STAGE_UPDATES_DEFAULT;
  document.getElementById('su-stage-key').value   = key;
  document.getElementById('su-prompt').value      = prompt;
  document.getElementById('su-modal').classList.remove('hidden');
}

function closeStageUpdatesModal() {
  document.getElementById('su-modal').classList.add('hidden');
}

function saveStageUpdatesModal() {
  const key    = document.getElementById('su-stage-key').value;
  const prompt = document.getElementById('su-prompt').value.trim();
  stageUpdatesData[key] = prompt;
  persistStageUpdates();
  closeStageUpdatesModal();
  const [scId, stageIdx] = key.split(':').map(Number);
  renderStageUpdatesSection(scId, stageIdx);
}

// ── Activity tooltip ─────────────────────────────────────────

function showActTooltip(e, el) {
  const data = JSON.parse(el.dataset.tooltip);
  const tip  = document.getElementById('act-tooltip');

  let html = `<div class="act-tooltip-popup-title">${esc(data.title)}</div>`;
  html += data.lines.map(line => {
    const parts = line.match(/^(\d+)\.\s(.+)$/);
    if (parts) {
      return `<div class="act-tooltip-popup-row">
        <span class="act-tooltip-popup-num">${parts[1]}</span>
        <span>${esc(parts[2])}</span>
      </div>`;
    }
    return `<div class="act-tooltip-popup-row"><span>${esc(line)}</span></div>`;
  }).join('');

  tip.innerHTML = html;
  tip.classList.remove('hidden');
  positionTooltip(e, tip);
}

function positionTooltip(e, tip) {
  const margin = 10;
  tip.style.left = '0px';
  tip.style.top  = '0px';
  const rect = tip.getBoundingClientRect();
  let x = e.clientX + margin;
  let y = e.clientY + margin;
  if (x + rect.width  > window.innerWidth)  x = e.clientX - rect.width  - margin;
  if (y + rect.height > window.innerHeight) y = e.clientY - rect.height - margin;
  tip.style.left = x + 'px';
  tip.style.top  = y + 'px';
}

function hideActTooltip() {
  document.getElementById('act-tooltip').classList.add('hidden');
}

// ── Row action dropdown ──────────────────────────────────────
// items: [{ label, action, danger? }]

function openRowMenu(triggerEl, items) {
  const menu = document.getElementById('row-action-menu');
  menu.innerHTML = '';

  items.forEach((item, i) => {
    if (item === 'divider') {
      const d = document.createElement('div');
      d.className = 'row-action-menu-divider';
      menu.appendChild(d);
      return;
    }
    const el = document.createElement('div');
    el.className = 'row-action-menu-item' + (item.danger ? ' danger' : '');
    el.textContent = item.label;
    el.onclick = () => { closeRowMenu(); item.action(); };
    menu.appendChild(el);
  });

  menu.classList.remove('hidden');

  const rect = triggerEl.getBoundingClientRect();
  const menuW = 160;
  let left = rect.right - menuW;
  let top  = rect.bottom + 2;
  if (left < 4) left = 4;
  if (top + 200 > window.innerHeight) top = rect.top - 4;
  menu.style.left = left + 'px';
  menu.style.top  = top  + 'px';

  // close on next outside click
  setTimeout(() => document.addEventListener('click', _rowMenuOutside, { once: true }), 0);
}

function _rowMenuOutside(e) {
  const menu = document.getElementById('row-action-menu');
  if (!menu.contains(e.target)) closeRowMenu();
}

function closeRowMenu() {
  document.getElementById('row-action-menu').classList.add('hidden');
  document.removeEventListener('click', _rowMenuOutside);
}

// Shared trigger button HTML (three-dot vertical)
function rowMenuBtn(onclickAttr) {
  return `<button class="row-action-trigger" ${onclickAttr} title="Actions">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="5"  r="1.5" fill="currentColor"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
      <circle cx="12" cy="19" r="1.5" fill="currentColor"/>
    </svg>
  </button>`;
}

// ── Integration Hub ──────────────────────────────────────────

let connections = [];
let nextConnId = 1;

// ── Data Enrichment ──────────────────────────────────────────
let enrichmentConfigs = [];
let nextEnrichmentId = 1;

async function persistEnrichmentConfigs() {
  setEnrichmentConfigs(enrichmentConfigs);
  setNextEnrichmentConfigId(nextEnrichmentId);
  await saveConfig();
}

function renderEnrichmentConfigsList() {
  const container = document.getElementById('enrichment-tab-data');

  if (enrichmentConfigs.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 80px 20px; color: #706E6B;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style="margin: 0 auto 16px; opacity: 0.3;">
          <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">No Enrichment Data Configurations</div>
        <div style="font-size: 14px; margin-bottom: 16px;">Create enrichment configurations to define data structures per Line of Business.</div>
        <button class="btn-new" onclick="openEnrichmentConfigModal(null)">New</button>
      </div>`;
    return;
  }

  const configCount = enrichmentConfigs.length;
  const configLabel = configCount === 1 ? 'configuration' : 'configurations';

  container.innerHTML = `
    <div class="list-view" style="background: transparent;">
      <div class="list-header" style="background: #fff; border: 1px solid var(--sf-border); border-radius: 6px 6px 0 0; margin-bottom: 0;">
        <div class="list-header-left">
          <h1 class="list-title">Enrichment Data</h1>
          <span class="list-count" id="enrichment-count">${configCount} ${configLabel}</span>
        </div>
        <button class="btn-new" onclick="openEnrichmentConfigModal(null)">New</button>
      </div>
      <div class="table-wrap" style="background: #fff; border: 1px solid var(--sf-border); border-top: none; border-radius: 0 0 6px 6px;">
        <table class="slds-table">
          <thead>
            <tr>
              <th class="col-check"><input type="checkbox" /></th>
              <th>Line of Business</th>
              <th>Categories</th>
              <th>Total Fields</th>
              <th>Status</th>
              <th class="col-action">Actions</th>
            </tr>
          </thead>
          <tbody id="enrichment-configs-tbody"></tbody>
        </table>
      </div>
    </div>`;

  const tbody = document.getElementById('enrichment-configs-tbody');
  enrichmentConfigs.forEach(config => {
    const categoryCount = config.categories.length;
    const fieldCount = config.categories.reduce((sum, cat) => sum + cat.fields.length, 0);

    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="col-check"><input type="checkbox" /></td>
      <td><a href="#/enrichment-config/${config.id}">${esc(config.lob)}</a></td>
      <td>${categoryCount}</td>
      <td>${fieldCount}</td>
      <td>${config.active ? '<span class="badge-active">Active</span>' : '<span class="badge-inactive">Inactive</span>'}</td>
      <td class="col-action">
        ${rowMenuBtn(`onclick="openRowMenu(this,[{label:'View',action:()=>window.location.hash='#/enrichment-config/${config.id}'},{label:'Edit',action:()=>openEnrichmentConfigModal(${config.id})}]);event.stopPropagation()"`)}
      </td>`;
    tbody.appendChild(row);
  });
}

function _showEnrichmentConfigDetail(id) {
  const config = enrichmentConfigs.find(c => c.id === id);
  if (!config) {
    alert('Enrichment configuration not found');
    window.location.hash = '#/data-enrichment';
    return;
  }

  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  document.getElementById('panel-enrichment-config-detail').classList.remove('hidden');
  document.querySelectorAll('.nav-row').forEach(r => r.classList.remove('active'));
  const dataNavRow = document.querySelector('[onclick*="data-enrichment"]');
  if (dataNavRow) dataNavRow.classList.add('active');

  renderEnrichmentConfigDetail(config);
}

function openEnrichmentConfigModal(id) {
  alert('Edit functionality coming soon');
}

function openAddCategoryModal(configId) {
  const config = enrichmentConfigs.find(c => c.id === configId);
  if (!config) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width: 500px;">
      <div class="modal-header">
        <h2 class="modal-title">Add Category</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
      </div>
      <div class="modal-body">
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 13px; font-weight: 600; color: #080707; margin-bottom: 6px;">Category Name</label>
          <input type="text" id="new-category-name" placeholder="e.g., Valuation" style="width: 100%; padding: 8px 12px; border: 1px solid #c9c9c9; border-radius: 4px; font-size: 14px;">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn-new" onclick="saveNewCategory(${configId})">Add Category</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('new-category-name').focus();
}

async function saveNewCategory(configId) {
  const name = document.getElementById('new-category-name').value.trim();
  if (!name) {
    alert('Please enter a category name');
    return;
  }

  const config = enrichmentConfigs.find(c => c.id === configId);
  if (!config) return;

  const newId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  config.categories.push({
    id: newId,
    name: name,
    fields: []
  });

  await persistEnrichmentConfigs();
  document.querySelector('.modal-overlay').remove();
  renderEnrichmentConfigDetail(config);
}

function openAddFieldModal(configId, categoryId) {
  const config = enrichmentConfigs.find(c => c.id === configId);
  if (!config) return;

  const category = config.categories.find(cat => cat.id === categoryId);
  if (!category) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width: 500px;">
      <div class="modal-header">
        <h2 class="modal-title">Add Field to ${esc(category.name)}</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
      </div>
      <div class="modal-body">
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 13px; font-weight: 600; color: #080707; margin-bottom: 6px;">Field Name</label>
          <input type="text" id="new-field-name" placeholder="e.g., Market Value" style="width: 100%; padding: 8px 12px; border: 1px solid #c9c9c9; border-radius: 4px; font-size: 14px;">
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 13px; font-weight: 600; color: #080707; margin-bottom: 6px;">Field Type</label>
          <select id="new-field-type" style="width: 100%; padding: 8px 12px; border: 1px solid #c9c9c9; border-radius: 4px; font-size: 14px;">
            <option value="Text">Text</option>
            <option value="Number">Number</option>
            <option value="Currency">Currency</option>
            <option value="Percent">Percent</option>
            <option value="Boolean">Boolean</option>
            <option value="Date">Date</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn-new" onclick="saveNewField(${configId}, '${categoryId}')">Add Field</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('new-field-name').focus();
}

async function saveNewField(configId, categoryId) {
  const name = document.getElementById('new-field-name').value.trim();
  const type = document.getElementById('new-field-type').value;

  if (!name) {
    alert('Please enter a field name');
    return;
  }

  const config = enrichmentConfigs.find(c => c.id === configId);
  if (!config) return;

  const category = config.categories.find(cat => cat.id === categoryId);
  if (!category) return;

  category.fields.push({
    name: name,
    type: type
  });

  await persistEnrichmentConfigs();
  document.querySelector('.modal-overlay').remove();
  renderEnrichmentConfigDetail(config);
}

function editEnrichmentField(configId, categoryId, fieldIdx) {
  alert('Edit field functionality coming soon');
}

async function deleteEnrichmentField(configId, categoryId, fieldIdx) {
  if (!confirm('Are you sure you want to delete this field?')) return;

  const config = enrichmentConfigs.find(c => c.id === configId);
  if (!config) return;

  const category = config.categories.find(cat => cat.id === categoryId);
  if (!category) return;

  category.fields.splice(fieldIdx, 1);

  await persistEnrichmentConfigs();
  renderEnrichmentConfigDetail(config);
}

// Track the active category in the master/detail layout. Reset whenever we
// land on a fresh config; default to the first category if none selected.
let enrichmentActiveCategoryId = null;

function renderEnrichmentConfigDetail(config) {
  const panel = document.getElementById('panel-enrichment-config-detail');

  if (!enrichmentActiveCategoryId || !config.categories.some(c => c.id === enrichmentActiveCategoryId)) {
    enrichmentActiveCategoryId = config.categories[0]?.id || null;
  }
  const activeCategory = config.categories.find(c => c.id === enrichmentActiveCategoryId) || null;

  const listItems = config.categories.length === 0
    ? `<div class="rn-empty">No categories yet. Click <strong>Add Category</strong> to create one.</div>`
    : config.categories.map(cat => {
        const active = cat.id === enrichmentActiveCategoryId;
        const count = (cat.fields || []).length;
        return `
          <div class="rn-list-item ${active ? 'active' : ''}" onclick="selectEnrichmentCategory(${config.id}, '${esc(cat.id)}')">
            <div class="rn-list-item-text">
              <span class="rn-list-name">${esc(cat.name)}</span>
              <span class="rn-list-meta">${count} field${count === 1 ? '' : 's'}</span>
            </div>
          </div>`;
      }).join('');

  const detailHtml = !activeCategory
    ? `<div class="rn-empty rn-empty-large">Select a category from the list, or create a new one.</div>`
    : (() => {
        const fields = activeCategory.fields || [];
        const tableHtml = fields.length === 0
          ? `<div class="rn-empty">No fields defined yet. Click <strong>Add Field</strong> to create one.</div>`
          : `
            <table class="slds-table rn-attr-table">
              <thead>
                <tr>
                  <th>Field Name</th>
                  <th>Type</th>
                  <th class="col-action">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${fields.map((field, idx) => `
                  <tr>
                    <td>${esc(field.name)}</td>
                    <td><span style="background: #f3f3f3; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #706E6B;">${esc(field.type)}</span></td>
                    <td class="col-action">
                      ${rowMenuBtn(`onclick="openRowMenu(this,[{label:'Edit',action:()=>editEnrichmentField(${config.id},'${activeCategory.id}',${idx})},{label:'Delete',action:()=>deleteEnrichmentField(${config.id},'${activeCategory.id}',${idx}),danger:true}]);event.stopPropagation()"`)}
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>`;
        return `
          <div class="rn-detail-header">
            <div class="rn-detail-title">
              <h2>${esc(activeCategory.name)}</h2>
            </div>
          </div>
          <div class="rn-attr-section">
            <div class="rn-attr-section-header">
              <h3>Fields</h3>
              <button class="btn-new" onclick="openAddFieldModal(${config.id}, '${activeCategory.id}')">Add Field</button>
            </div>
            ${tableHtml}
          </div>`;
      })();

  panel.innerHTML = `
    <div class="rn-page" style="max-width: 1400px;">
      <div style="margin-bottom: 12px;">
        <a href="#/data-enrichment" style="color: #0176D3; text-decoration: none; font-size: 14px;">← Back to Enrichment Configurations</a>
      </div>
      <div class="rn-page-header" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
        <div>
          <h1>${esc(config.lob)}</h1>
          <p>Enrichment Data Configuration</p>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <button class="btn-new" onclick="openAddCategoryModal(${config.id})">Add Category</button>
          <span class="badge-${config.active ? 'active' : 'inactive'}">${config.active ? 'Active' : 'Inactive'}</span>
        </div>
      </div>
      <div class="rn-md">
        <div class="rn-md-list">
          <div class="rn-md-list-header">
            <h2>Categories</h2>
          </div>
          <div class="rn-md-list-items">${listItems}</div>
        </div>
        <div class="rn-md-detail">${detailHtml}</div>
      </div>
    </div>`;
}

function selectEnrichmentCategory(configId, categoryId) {
  enrichmentActiveCategoryId = categoryId;
  const config = enrichmentConfigs.find(c => c.id === configId);
  if (config) renderEnrichmentConfigDetail(config);
}

async function persistConnections() {
  setConnections(connections);
  setNextConnectionId(nextConnId);
  await saveConfig();
}

function switchEnrichmentTab(tabName) {
  // Update tab buttons - only within data enrichment panel
  const enrichmentPanel = document.getElementById('panel-data-enrichment');
  enrichmentPanel.querySelectorAll('.integration-hub-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  event.target.classList.add('active');

  // Update tab content
  document.getElementById('enrichment-tab-data').classList.remove('active');
  document.getElementById('enrichment-tab-definition').classList.remove('active');
  document.getElementById(`enrichment-tab-${tabName}`).classList.add('active');

  if (tabName === 'definition' && typeof renderEnrichmentDefinitions === 'function') {
    renderEnrichmentDefinitions();
  }
}

function switchIntegrationTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.integration-hub-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  event.target.classList.add('active');

  // Update tab content
  document.querySelectorAll('.integration-tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`integration-tab-${tabName}`).classList.add('active');

  // Load provider catalog if switching to that tab
  if (tabName === 'provider-catalog') {
    renderProviderCatalog();
  }

  // Load health dashboard if switching to that tab
  if (tabName === 'health') {
    renderHealthDashboard();
  }
}

function renderConnectionsTable() {
  const tbody = document.getElementById('connections-tbody');
  tbody.innerHTML = '';

  // Update stats
  const totalCount = connections.length;
  const connectedCount = connections.filter(c => c.status === 'Connected').length;
  const attentionCount = connections.filter(c => c.status === 'Needs Attention').length;
  const disconnectedCount = connections.filter(c => c.status === 'Disconnected').length;

  document.getElementById('total-connections').textContent = totalCount;
  document.getElementById('connected-count').textContent = connectedCount;
  document.getElementById('attention-count').textContent = attentionCount;
  document.getElementById('disconnected-count').textContent = disconnectedCount;
  document.getElementById('connections-list-count').textContent =
    `${totalCount} connection${totalCount === 1 ? '' : 's'}`;

  if (connections.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-row">No connections yet. Click <strong>+ Add Connection</strong> to create one.</td></tr>`;
    return;
  }

  connections.forEach(conn => {
    const tr = document.createElement('tr');

    // Generate logo from first letters of name
    const logoLetters = conn.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const logoColor = getLogoColor(conn.name);

    let statusBadge = '';
    if (conn.status === 'Connected') {
      statusBadge = '<span class="badge-connected">Connected</span>';
    } else if (conn.status === 'Disconnected') {
      statusBadge = '<span class="badge-disconnected">Disconnected</span>';
    } else if (conn.status === 'Needs Attention') {
      statusBadge = '<span class="badge-attention">Needs Attention</span>';
    }

    const lastTested = conn.lastTested || new Date().toISOString().split('T')[0] + ' ' + new Date().toTimeString().substring(0, 8);

    tr.innerHTML = `
      <td>
        <div class="connection-name-cell">
          <div class="connection-logo" style="background: ${logoColor};">${logoLetters}</div>
          <a href="#" onclick="openConnectionDetail(${conn.id}); return false;">${esc(conn.name)}</a>
        </div>
      </td>
      <td>${esc(conn.authType)}</td>
      <td style="font-family: monospace; font-size: 12px;">${esc(conn.baseUrl)}</td>
      <td>${statusBadge}</td>
      <td>${conn.latency ? conn.latency + ' ms' : '—'}</td>
      <td>${esc(conn.usedBy || 'None')}</td>
      <td style="font-size: 12px;">${lastTested}</td>
      <td class="col-action">
        ${rowMenuBtn(`onclick="openRowMenu(this,[{label:'Edit',action:()=>openConnectionModal(${conn.id})},{label:'Test Connection',action:()=>testConnection(${conn.id})},'divider',{label:'Delete',action:()=>deleteConnection(${conn.id}),danger:true}]);event.stopPropagation()"`)}
      </td>`;

    tbody.appendChild(tr);
  });
}

function getLogoColor(name) {
  const colors = ['#0176D3', '#E74C3C', '#9B59B6', '#F39C12', '#16A085', '#2980B9', '#E67E22', '#8E44AD'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function openConnectionModal(id) {
  // For new connections, use the wizard with no provider
  if (!id) {
    openConnectionWizard(null);
    return;
  }

  // For editing existing connections, use the old modal
  document.getElementById('conn-edit-id').value = id;
  document.getElementById('connection-modal-title').textContent = 'Edit Connection';

  const conn = connections.find(x => x.id === id);
  document.getElementById('conn-name').value = conn.name;
  document.getElementById('conn-auth-type').value = conn.authType;
  document.getElementById('conn-base-url').value = conn.baseUrl;
  document.getElementById('conn-status').value = conn.status;

  document.getElementById('connection-modal').classList.remove('hidden');
}

function closeConnectionModal() {
  document.getElementById('connection-modal').classList.add('hidden');
}

function connectionOverlayClick(e) {
  if (e.target === document.getElementById('connection-modal')) closeConnectionModal();
}

function saveConnection() {
  const name = document.getElementById('conn-name').value.trim();
  const authType = document.getElementById('conn-auth-type').value;
  const baseUrl = document.getElementById('conn-base-url').value.trim();

  if (!name) { alert('Connection Name is required.'); return; }
  if (!authType) { alert('Auth Type is required.'); return; }
  if (!baseUrl) { alert('Base URL is required.'); return; }

  const id = document.getElementById('conn-edit-id').value;
  const record = {
    name,
    authType,
    baseUrl,
    status: document.getElementById('conn-status').value,
    lastTested: new Date().toISOString().split('T')[0] + ' ' + new Date().toTimeString().substring(0, 8)
  };

  if (id) {
    const idx = connections.findIndex(x => x.id === parseInt(id));
    const existingConn = connections[idx];
    // Preserve system-calculated fields
    connections[idx] = {
      id: parseInt(id),
      ...record,
      latency: existingConn.latency,
      usedBy: existingConn.usedBy
    };
  } else {
    // New connection - initialize system-calculated fields
    connections.push({
      id: nextConnId++,
      ...record,
      latency: null,
      usedBy: null
    });
  }

  persistConnections();
  closeConnectionModal();
  renderConnectionsTable();
}

function deleteConnection(id) {
  const conn = connections.find(x => x.id === id);
  if (!confirm(`Delete connection "${conn.name}"?`)) return;
  connections = connections.filter(x => x.id !== id);
  persistConnections();
  renderConnectionsTable();
}

function testConnection(id) {
  const conn = connections.find(x => x.id === id);
  alert(`Testing connection to ${conn.name}...\n\nThis would perform a live test of the connection.`);
}

// ── Provider Catalog ──────────────────────────────────────────

const PROVIDERS = [
  {
    id: 1,
    name: 'Verisk LOCATION',
    category: 'Property',
    description: 'Building data, replacement cost estimation, and property characteristics for underwriting.',
    logo: 'VL',
    logoColor: '#4A148C',
    connected: true
  },
  {
    id: 2,
    name: 'HazardHub',
    category: 'Hazard',
    description: 'Address-level hazard risk scores on wildfires, floods, earthquakes, and more for property risk assessment.',
    logo: 'HH',
    logoColor: '#E65100',
    connected: true
  },
  {
    id: 3,
    name: 'Dun & Bradstreet',
    category: 'Business Data',
    description: 'Company search, firmographic data, credit scores, and business verification for commercial underwriting.',
    logo: 'D&B',
    logoColor: '#0176D3',
    connected: false
  },
  {
    id: 4,
    name: 'Zoominfo',
    category: 'Business Data',
    description: 'Detailed and extensive technographic, firmographic, and contact data for business intelligence.',
    logo: 'ZI',
    logoColor: '#6A1B9A',
    connected: false
  },
  {
    id: 5,
    name: 'LexisNexis HCMAD',
    category: 'Identity',
    description: 'Identity verification, fraud detection, and loss history for property and casualty underwriting.',
    logo: 'LN',
    logoColor: '#C62828',
    connected: false
  },
  {
    id: 6,
    name: 'LexisNexis CLUE',
    category: 'Property',
    description: 'Comprehensive Loss Underwriting Exchange — claims history for property and auto risks.',
    logo: 'LC',
    logoColor: '#C62828',
    connected: false
  },
  {
    id: 7,
    name: 'Cape Analytics',
    category: 'Property',
    description: 'AI-powered property intelligence from aerial and satellite imagery — roof, siding, hazards, and more.',
    logo: 'CA',
    logoColor: '#00838F',
    connected: false
  },
  {
    id: 8,
    name: 'Ferris Digital',
    category: 'Credit',
    description: 'Address, Property, Title, Business, and Credit validation for data enrichment and decisioning.',
    logo: 'FD',
    logoColor: '#558B2F',
    connected: false
  },
  {
    id: 9,
    name: 'Transition TruthScan',
    category: 'Geospatial',
    description: 'Precise property, land use, distance to features, and territorial assignment data for pricing.',
    logo: 'TT',
    logoColor: '#0176D3',
    connected: false
  },
  {
    id: 10,
    name: 'CoreLogic',
    category: 'Property',
    description: 'Unified property, tax, hazard, and location insights for commercial and residential underwriting attributes.',
    logo: 'CL',
    logoColor: '#1565C0',
    connected: false
  },
  {
    id: 11,
    name: 'ISO Ratemaker Rating Services',
    category: 'Rating',
    description: 'Actuarial and statistical data, experience rating, classification ratings, and customizable rating factors.',
    logo: 'ISO',
    logoColor: '#6D4C41',
    connected: false
  },
  {
    id: 12,
    name: 'Navistone',
    category: 'Geospatial',
    description: 'Capture postal codes and locations insights for risk, pricing, and underwriting decisions.',
    logo: 'NS',
    logoColor: '#EF6C00',
    connected: false
  },
  {
    id: 13,
    name: 'Custom Integration',
    category: 'BYOI (LOAD API)',
    description: 'Connect to any API via Named Credentials. Manually configure endpoints, authentication, and mapping.',
    logo: 'CI',
    logoColor: '#757575',
    connected: false
  }
];

let filteredProviders = [...PROVIDERS];

function renderProviderCatalog() {
  const grid = document.getElementById('provider-catalog-grid');
  if (!grid) return;

  grid.innerHTML = '';

  filteredProviders.forEach(provider => {
    const card = document.createElement('div');
    card.className = 'provider-card';
    card.onclick = () => openProviderDetail(provider.id);

    const statusClass = provider.connected ? 'connected' : 'not-connected';
    const statusText = provider.connected ? 'Connected' : 'Not connected';
    const buttonHTML = provider.connected
      ? '<button class="provider-card-btn outline" onclick="event.stopPropagation(); manageProvider(' + provider.id + ')">Manage</button>'
      : '<button class="provider-card-btn" onclick="event.stopPropagation(); addProvider(' + provider.id + ')">Connect</button>';

    card.innerHTML = `
      <div class="provider-card-header">
        <div class="provider-logo" style="background: ${provider.logoColor};">${provider.logo}</div>
        <div class="provider-card-title-wrap">
          <div class="provider-card-title">${esc(provider.name)}</div>
          <div class="provider-card-category">${esc(provider.category)}</div>
        </div>
      </div>
      <div class="provider-card-description">${esc(provider.description)}</div>
      <div class="provider-card-footer">
        <div class="provider-card-status ${statusClass}">${statusText}</div>
        ${buttonHTML}
      </div>
    `;

    grid.appendChild(card);
  });
}

function filterProviders(category) {
  // Update active filter chip
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.classList.remove('active');
  });
  event.target.classList.add('active');

  // Filter providers
  if (category === 'all') {
    filteredProviders = [...PROVIDERS];
  } else {
    filteredProviders = PROVIDERS.filter(p => p.category === category);
  }

  renderProviderCatalog();
}

function searchProviders() {
  const query = document.getElementById('provider-search-input').value.toLowerCase().trim();

  if (!query) {
    filteredProviders = [...PROVIDERS];
  } else {
    filteredProviders = PROVIDERS.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query)
    );
  }

  renderProviderCatalog();
}

function openProviderDetail(id) {
  const provider = PROVIDERS.find(p => p.id === id);
  alert(`Provider Detail: ${provider.name}\n\nCategory: ${provider.category}\nStatus: ${provider.connected ? 'Connected' : 'Not Connected'}\n\nThis would open the provider detail page with documentation, endpoints, and configuration options.`);
}

function addProvider(id) {
  const provider = PROVIDERS.find(p => p.id === id);
  openConnectionWizard(provider);
}

function manageProvider(id) {
  const provider = PROVIDERS.find(p => p.id === id);
  alert(`Manage Provider: ${provider.name}\n\nThis would show:\n- Current connections\n- Usage statistics\n- Configuration settings\n- API documentation`);
}

// ── Connection Wizard ─────────────────────────────────────────

let wizardCurrentStep = 1;
let wizardProvider = null;

function openConnectionWizard(provider) {
  wizardProvider = provider;
  wizardCurrentStep = 1;

  // Set title based on whether provider is specified
  if (provider) {
    document.getElementById('wizard-title').textContent = `Connect to ${provider.name}`;
    document.getElementById('wizard-provider-id').value = provider.id;

    // Pre-fill Step 1 with provider defaults
    document.getElementById('wizard-connection-name').value = provider.name + ' Production';
    document.getElementById('wizard-base-url').value = getProviderBaseUrl(provider);
    document.getElementById('wizard-test-endpoint').value = '/health';
  } else {
    document.getElementById('wizard-title').textContent = 'New Connection';
    document.getElementById('wizard-provider-id').value = '';

    // Clear Step 1 fields
    document.getElementById('wizard-connection-name').value = '';
    document.getElementById('wizard-base-url').value = '';
    document.getElementById('wizard-test-endpoint').value = '';
  }

  document.getElementById('wizard-notes').value = '';

  // Update Step 2 banner
  const authBanner = document.getElementById('wizard-auth-banner');
  if (provider) {
    authBanner.textContent = 'API Key — Detected from provider template';
  } else {
    authBanner.textContent = 'API Key — Standard authentication method';
  }

  // Reset Step 2
  document.getElementById('wizard-subscriber-id').value = '';
  document.getElementById('wizard-api-key').value = '';
  document.getElementById('wizard-timeout').value = '5000';
  document.getElementById('wizard-max-retries').value = '3';
  document.getElementById('wizard-permission-set').value = 'default';

  // Reset test result
  document.getElementById('wizard-test-result').classList.add('hidden');
  document.getElementById('wizard-test-result').innerHTML = '';

  // Show modal and reset to step 1
  document.getElementById('connection-wizard-modal').classList.remove('hidden');
  updateWizardStep(1);
}

function getProviderBaseUrl(provider) {
  const urls = {
    'Verisk LOCATION': 'https://api.verisk.com/location/v2',
    'HazardHub': 'https://api.hazardhub.com/v1',
    'Dun & Bradstreet': 'https://plus.dnb.com/v1',
    'Zoominfo': 'https://api.zoominfo.com/v1',
  };
  return urls[provider.name] || 'https://api.provider.com/v1';
}

function closeWizard() {
  document.getElementById('connection-wizard-modal').classList.add('hidden');
  wizardCurrentStep = 1;
  wizardProvider = null;
}

function wizardOverlayClick(e) {
  if (e.target === document.getElementById('connection-wizard-modal')) closeWizard();
}

function updateWizardStep(step) {
  wizardCurrentStep = step;

  // Update step indicators
  for (let i = 1; i <= 3; i++) {
    const indicator = document.getElementById(`wizard-step-indicator-${i}`);
    indicator.classList.remove('active', 'completed');

    if (i < step) {
      indicator.classList.add('completed');
    } else if (i === step) {
      indicator.classList.add('active');
    }

    // Update connector
    if (i < 3) {
      const connector = document.getElementById(`wizard-connector-${i}`);
      connector.classList.toggle('completed', i < step);
    }
  }

  // Update step content
  for (let i = 1; i <= 3; i++) {
    const content = document.getElementById(`wizard-step-${i}`);
    content.classList.toggle('active', i === step);
  }

  // Update buttons
  const backBtn = document.getElementById('wizard-back-btn');
  const nextBtn = document.getElementById('wizard-next-btn');
  const saveWithoutTestBtn = document.getElementById('wizard-save-without-test-btn');
  const testBtn = document.getElementById('wizard-test-btn');

  backBtn.style.display = step > 1 ? 'block' : 'none';

  if (step === 3) {
    nextBtn.style.display = 'none';
    saveWithoutTestBtn.style.display = 'inline-block';
    testBtn.style.display = 'inline-block';
  } else {
    nextBtn.style.display = 'inline-block';
    saveWithoutTestBtn.style.display = 'none';
    testBtn.style.display = 'none';
  }
}

function wizardNext() {
  // Validate current step
  if (wizardCurrentStep === 1) {
    const name = document.getElementById('wizard-connection-name').value.trim();
    const url = document.getElementById('wizard-base-url').value.trim();

    if (!name) {
      alert('Connection Name is required.');
      return;
    }
    if (!url) {
      alert('Base URL is required.');
      return;
    }
  } else if (wizardCurrentStep === 2) {
    const subscriberId = document.getElementById('wizard-subscriber-id').value.trim();
    const apiKey = document.getElementById('wizard-api-key').value.trim();

    if (!subscriberId) {
      alert('Subscriber ID is required.');
      return;
    }
    if (!apiKey) {
      alert('API Key is required.');
      return;
    }
  }

  // Move to next step
  if (wizardCurrentStep < 3) {
    updateWizardStep(wizardCurrentStep + 1);
  }
}

function wizardBack() {
  if (wizardCurrentStep > 1) {
    updateWizardStep(wizardCurrentStep - 1);
  }
}

function wizardTestConnection() {
  const resultDiv = document.getElementById('wizard-test-result');
  resultDiv.classList.remove('hidden', 'success', 'error');

  // Get connection name for display
  const connectionName = document.getElementById('wizard-connection-name').value.trim() || 'the endpoint';

  // Show loading state
  resultDiv.innerHTML = '<div class="wizard-test-result-title">Testing connection...</div>';

  // Simulate API call
  setTimeout(() => {
    const success = Math.random() > 0.3; // 70% success rate

    if (success) {
      resultDiv.classList.add('success');
      resultDiv.innerHTML = `
        <div class="wizard-test-result-title">
          ✓ Connection Successful
        </div>
        <div class="wizard-test-result-details">
          Successfully connected to ${esc(connectionName)}.<br>
          Response time: ${Math.floor(Math.random() * 200 + 150)}ms<br>
          Status: 200 OK
        </div>
      `;
    } else {
      resultDiv.classList.add('error');
      resultDiv.innerHTML = `
        <div class="wizard-test-result-title">
          ✗ Connection Failed
        </div>
        <div class="wizard-test-result-details">
          Unable to connect to ${esc(connectionName)}.<br>
          Error: Invalid API credentials (401 Unauthorized)<br>
          Please check your Subscriber ID and API Key.
        </div>
      `;
    }
  }, 1500);
}

function wizardSaveWithoutTest() {
  if (!confirm('Are you sure you want to save without testing?\n\nThe connection may not work if the configuration is incorrect.')) {
    return;
  }
  wizardSave();
}

function wizardSave() {
  const name = document.getElementById('wizard-connection-name').value.trim();
  const baseUrl = document.getElementById('wizard-base-url').value.trim();
  const testEndpoint = document.getElementById('wizard-test-endpoint').value.trim();
  const notes = document.getElementById('wizard-notes').value.trim();

  // Create new connection
  const newConnection = {
    id: nextConnId++,
    name,
    authType: 'API Key',
    baseUrl,
    testEndpoint,
    notes,
    status: 'Connected',
    latency: Math.floor(Math.random() * 200 + 150),
    usedBy: '0 activities',
    lastTested: new Date().toISOString().split('T')[0] + ' ' + new Date().toTimeString().substring(0, 8),
    timeout: document.getElementById('wizard-timeout').value,
    maxRetries: document.getElementById('wizard-max-retries').value,
  };

  connections.push(newConnection);
  persistConnections();

  // Update provider to connected
  wizardProvider.connected = true;

  closeWizard();
  renderConnectionsTable();
  renderProviderCatalog();

  alert(`✓ Connection created successfully!\n\n"${name}" is now connected and ready to use.`);
}

// ── Health Dashboard ──────────────────────────────────────────

function renderHealthDashboard() {
  // Calculate stats
  const totalConnections = connections.length;
  const connectedCount = connections.filter(c => c.status === 'Connected').length;
  const uptimePercent = totalConnections > 0 ? Math.round((connectedCount / totalConnections) * 100) : 0;

  // Calculate average response time
  const latencies = connections
    .filter(c => c.latency)
    .map(c => c.latency);
  const avgLatency = latencies.length > 0
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : 0;

  // Mock errors in 24h
  const totalErrors = Math.floor(Math.random() * 20);

  // Update stats
  document.getElementById('health-uptime').textContent = uptimePercent + '%';
  document.getElementById('health-avg-response').textContent = avgLatency + ' ms';
  document.getElementById('health-errors-24h').textContent = totalErrors;
  document.getElementById('health-total-conn').textContent = totalConnections;

  // Render connection health table
  renderHealthConnectionsTable();
}

function renderHealthConnectionsTable() {
  const tbody = document.getElementById('health-connections-tbody');
  tbody.innerHTML = '';

  if (connections.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No connections to monitor.</td></tr>';
    return;
  }

  connections.forEach(conn => {
    const tr = document.createElement('tr');

    const logoLetters = conn.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const logoColor = getLogoColor(conn.name);

    let statusBadge = '';
    if (conn.status === 'Connected') {
      statusBadge = '<span class="badge-connected">Connected</span>';
    } else if (conn.status === 'Disconnected') {
      statusBadge = '<span class="badge-disconnected">Disconnected</span>';
    } else if (conn.status === 'Needs Attention') {
      statusBadge = '<span class="badge-attention">Needs Attention</span>';
    }

    const latencyDisplay = conn.latency ? conn.latency + ' ms' : '—';
    const errorsCount = conn.status === 'Needs Attention' ? Math.floor(Math.random() * 15 + 1) : 0;

    const trendCanvasId = `health-trend-${conn.id}`;

    tr.innerHTML = `
      <td>
        <div class="connection-logo-mini" style="background: ${logoColor};">${logoLetters}</div>
      </td>
      <td><a href="#" onclick="openConnectionDetail(${conn.id}); return false;">${esc(conn.name)}</a></td>
      <td>${statusBadge}</td>
      <td>${latencyDisplay}</td>
      <td>${errorsCount > 0 ? errorsCount + ' errors' : '0 errors'}</td>
      <td>
        <canvas id="${trendCanvasId}" class="health-trend-chart" width="80" height="30"></canvas>
      </td>
      <td style="font-size: 12px;">${conn.lastTested || '—'}</td>
    `;

    tbody.appendChild(tr);

    // Draw trend chart
    setTimeout(() => drawHealthTrendChart(trendCanvasId, conn), 0);
  });
}

function drawHealthTrendChart(canvasId, conn) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  // Generate mock trend data (12 data points)
  const data = [];
  for (let i = 0; i < 12; i++) {
    if (conn.status === 'Connected') {
      data.push(Math.random() * 0.3 + 0.7); // 0.7-1.0 range (good)
    } else if (conn.status === 'Needs Attention') {
      data.push(Math.random() * 0.4 + 0.4); // 0.4-0.8 range (warning)
    } else {
      data.push(Math.random() * 0.3); // 0-0.3 range (error)
    }
  }

  const barWidth = width / data.length;

  // Determine color based on status
  let color;
  if (conn.status === 'Connected') {
    color = '#2196F3'; // Blue
  } else if (conn.status === 'Needs Attention') {
    color = '#FF9800'; // Orange
  } else {
    color = '#F44336'; // Red
  }

  ctx.fillStyle = color;

  data.forEach((val, i) => {
    const barHeight = val * height;
    const x = i * barWidth;
    const y = height - barHeight;
    ctx.fillRect(x, y, barWidth - 1, barHeight);
  });
}

// ── Connection Detail Page ───────────────────────────────────

let detailConnId = null;

function openConnectionDetail(id) {
  window.location.hash = `/connection/${id}`;
}

function backToIntegrationHub() {
  window.location.hash = `/integration-hub`;
}

function _showConnectionDetail(id) {
  detailConnId = id;
  const conn = connections.find(x => x.id === id);
  if (!conn) return;

  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  document.getElementById('panel-connection-detail').classList.remove('hidden');
  document.querySelectorAll('.nav-row').forEach(r => r.classList.remove('active'));

  // expand nav to show Integration Hub
  if (!document.getElementById('children-brokerage').classList.contains('open')) toggle('brokerage');
  if (!document.getElementById('children-underwriting').classList.contains('open')) toggle('underwriting');

  renderConnectionDetail(conn);
}

function renderConnectionDetail(conn) {
  // Header
  const logoLetters = conn.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  const logoColor = getLogoColor(conn.name);

  const logoEl = document.getElementById('conn-detail-logo');
  logoEl.textContent = logoLetters;
  logoEl.style.background = logoColor;

  document.getElementById('conn-detail-title').textContent = conn.name;

  let statusBadgeHTML = '';
  if (conn.status === 'Connected') {
    statusBadgeHTML = '<span class="badge-connected">Connected</span>';
  } else if (conn.status === 'Disconnected') {
    statusBadgeHTML = '<span class="badge-disconnected">Disconnected</span>';
  } else if (conn.status === 'Needs Attention') {
    statusBadgeHTML = '<span class="badge-attention">Needs Attention</span>';
  }
  document.getElementById('conn-detail-status').innerHTML = statusBadgeHTML;

  // General Section
  renderConnectionGeneral(conn);

  // Health Section
  renderConnectionHealth(conn);

  // Used By Section
  renderConnectionUsedBy(conn);

  // Recent Activity Section
  renderConnectionRecentActivity(conn);
}

function renderConnectionGeneral(conn) {
  const grid = document.getElementById('conn-general-grid');

  const fields = [
    { label: 'Base URL', value: `<code>${esc(conn.baseUrl)}</code>` },
    { label: 'Auth Type', value: esc(conn.authType) },
    { label: 'Named Credential', value: '<code>NC_' + esc(conn.name.replace(/\s+/g, '_')) + '</code>' },
    { label: 'Test Endpoint', value: '<code>/health</code>' },
    { label: 'Timeout', value: (conn.timeout || 5000) + ' ms' },
    { label: 'Max Retries', value: conn.maxRetries || '3' },
    { label: 'Circuit Breaker', value: conn.circuitBreaker || 'Closed' },
    { label: 'Rate Limit', value: conn.rateLimit || 'No notes' },
  ];

  grid.innerHTML = fields.map(f => `
    <div class="connection-general-field">
      <div class="connection-general-label">${f.label}</div>
      <div class="connection-general-value">${f.value}</div>
    </div>
  `).join('');
}

function renderConnectionHealth(conn) {
  // Mock health data
  const avgLatency = conn.latency || Math.floor(Math.random() * 300 + 150);
  const errors = Math.floor(Math.random() * 5);
  const totalCalls = Math.floor(Math.random() * 100 + 400);

  document.getElementById('health-avg-latency').textContent = avgLatency + ' ms';
  document.getElementById('health-errors').textContent = errors;
  document.getElementById('health-total-calls').textContent = totalCalls;

  // Draw simple latency chart
  drawLatencyChart();
}

function drawLatencyChart() {
  const canvas = document.getElementById('latency-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Generate mock latency data (24 data points for 24 hours)
  const data = [];
  for (let i = 0; i < 24; i++) {
    data.push(Math.floor(Math.random() * 150 + 100));
  }

  const max = Math.max(...data) * 1.1; // Add 10% padding at top
  const min = Math.min(...data) * 0.9; // Add 10% padding at bottom
  const range = max - min;

  const padding = 10;
  const chartHeight = height - padding * 2;
  const chartWidth = width - padding * 2;
  const pointSpacing = chartWidth / (data.length - 1);

  // Draw trend line
  ctx.strokeStyle = '#0176D3';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();

  data.forEach((val, i) => {
    const x = padding + i * pointSpacing;
    const normalizedVal = (val - min) / range;
    const y = height - padding - (normalizedVal * chartHeight);

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();

  // Draw fill area under the line
  ctx.lineTo(width - padding, height - padding);
  ctx.lineTo(padding, height - padding);
  ctx.closePath();
  ctx.fillStyle = 'rgba(1, 118, 211, 0.1)';
  ctx.fill();

  // Draw data points
  ctx.fillStyle = '#0176D3';
  data.forEach((val, i) => {
    const x = padding + i * pointSpacing;
    const normalizedVal = (val - min) / range;
    const y = height - padding - (normalizedVal * chartHeight);

    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function renderConnectionUsedBy(conn) {
  const tbody = document.getElementById('used-by-tbody');

  // Mock "used by" data
  const usedByData = [
    { activity: 'Company Lookup', stage: 'Enrichment', type: 'Engine' },
    { activity: 'Credit Check', stage: 'Enrichment', type: 'Engine' },
  ];

  if (usedByData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-row">This connection is not currently used by any activities.</td></tr>';
  } else {
    tbody.innerHTML = usedByData.map(item => `
      <tr>
        <td>${esc(item.activity)}</td>
        <td><span class="badge-type">${esc(item.stage)}</span></td>
        <td>${esc(item.type)}</td>
      </tr>
    `).join('');
  }

  document.getElementById('used-by-count').textContent = usedByData.length;
}

function renderConnectionRecentActivity(conn) {
  const tbody = document.getElementById('recent-activity-tbody');

  // Mock recent activity data
  const now = new Date();
  const activities = [];

  for (let i = 0; i < 5; i++) {
    const time = new Date(now - i * 3600000); // each hour back
    const timeStr = time.toTimeString().substring(0, 8);
    const status = Math.random() > 0.2 ? 'success' : 'error';
    const latency = Math.floor(Math.random() * 300 + 150);
    const callers = ['Engine', 'Engine', 'Engine', 'HealthCheck'];
    const endpoints = ['GET /v1/search', 'GET /v1/data/company', 'GET /v1/search', 'POST /v1/search', 'GET /health'];

    activities.push({
      time: timeStr,
      status,
      latency: latency + ' ms',
      caller: callers[Math.floor(Math.random() * callers.length)],
      endpoint: endpoints[Math.floor(Math.random() * endpoints.length)]
    });
  }

  tbody.innerHTML = activities.map(act => `
    <tr>
      <td>${act.time}</td>
      <td><span class="status-${act.status}">${act.status === 'success' ? '200' : '400'}</span></td>
      <td>${act.latency}</td>
      <td><span class="badge-type">${esc(act.caller)}</span></td>
      <td style="font-family: monospace; font-size: 12px;">${esc(act.endpoint)}</td>
    </tr>
  `).join('');
}

function editConnectionGeneral() {
  openConnectionModal(detailConnId);
}

function testConnectionDetail() {
  const conn = connections.find(x => x.id === detailConnId);
  alert(`Testing connection to ${conn.name}...\n\nConnection successful!\nLatency: ${conn.latency || 234}ms`);
}

function updateCredentialsDetail() {
  alert('Update Credentials modal would open here.\n\nThis would allow updating OAuth tokens, API keys, or other authentication credentials.');
}

function deactivateConnectionDetail() {
  const conn = connections.find(x => x.id === detailConnId);
  if (!confirm(`Deactivate connection "${conn.name}"?\n\nThis will prevent any activities from using this connection.`)) return;
  conn.status = 'Disconnected';
  persistConnections();
  renderConnectionDetail(conn);
}

// ── Initialize app with config from API ─────────────────────

let appInitialized = false;

async function initializeApp() {
  console.log('initializeApp starting...');
  const config = await loadConfig();
  console.log('Config loaded:', config);

  fields = config.fields.length > 0 ? config.fields : DEFAULT_FIELDS;
  nextFieldId = config.nextFieldId || 27;

  reusableActivities = config.reusableActivities || [];
  nextReusableActivityId = config.nextReusableActivityId || 1;

  activityConfigs = config.activityConfigs || [];
  nextStmId = config.nextActivityConfigId || 1;

  stageConfigs = config.stageConfigs || [];
  nextScId = config.nextStageConfigId || 1;

  assignmentRules = config.assignmentRules || [];
  nextAssignmentId = config.nextAssignmentRuleId || 1;

  connections = config.connections && config.connections.length > 0 ? config.connections : DEFAULT_CONNECTIONS;
  nextConnId = config.nextConnectionId || 11;

  enrichmentConfigs = config.enrichmentConfigs && config.enrichmentConfigs.length > 0 ? config.enrichmentConfigs : DEFAULT_ENRICHMENT_CONFIGS;
  nextEnrichmentId = config.nextEnrichmentConfigId || 3;

  playbooks = config.playbooks || [];
  nextPlaybookId = config.nextPlaybookId || 1;
  rmdGroupLibrary = config.rmdGroupLibrary || DEFAULT_RMD_GROUP_LIBRARY;
  nextRmdGroupId = config.nextRmdGroupId || (DEFAULT_RMD_GROUP_LIBRARY.length + 1);
  rmdInsightLibrary = config.rmdInsightLibrary || [];
  nextRmdInsightId = config.nextRmdInsightId || 1;
  rmdActionLibrary = config.rmdActionLibrary || [];
  nextRmdActionId = config.nextRmdActionId || 1;

  rnEntities = config.rnEntities || [];
  nextRnEntityId = config.nextRnEntityId || 1;
  rnCoverages = config.rnCoverages || [];
  nextRnCoverageId = config.nextRnCoverageId || 1;
  rnHierarchies = config.rnHierarchies || [];
  nextRnHierarchyId = config.nextRnHierarchyId || 1;

  integrationProcedures = (config.integrationProcedures && config.integrationProcedures.length > 0)
    ? config.integrationProcedures
    : DEFAULT_INTEGRATION_PROCEDURES;
  nextIntegrationProcedureId = config.nextIntegrationProcedureId || (DEFAULT_INTEGRATION_PROCEDURES.length + 1);

  enrichmentDefinitions = (config.enrichmentDefinitions && config.enrichmentDefinitions.length > 0)
    ? config.enrichmentDefinitions
    : DEFAULT_ENRICHMENT_DEFINITIONS;
  nextEnrichmentDefinitionId = config.nextEnrichmentDefinitionId || (DEFAULT_ENRICHMENT_DEFINITIONS.length + 1);

  activitiesData = config.activitiesData || {};
  nextActivityId = config.nextActivityId || 1;

  stmActivitiesData = config.stmActivitiesData || {};
  nextStmActivityId = config.nextStmActivityId || 1;

  renderFieldsTable();
  renderStmTable();
  renderScTable();
  renderConnectionsTable();
  // renderRoutingAddresses(); // TODO: function not implemented yet
  renderAssignmentRules();

  console.log('App initialization complete, calling router');
  appInitialized = true;
  router();
}

initializeApp();
