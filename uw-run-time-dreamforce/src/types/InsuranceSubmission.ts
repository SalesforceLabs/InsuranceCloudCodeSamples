export interface InsuranceSubmission {
  id: string;
  name: string;
  status: 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'In Progress';
  submissionDate: string;
  effectiveDate: string;
  expirationDate: string;
  policyType: string;
  insuredName: string;
  insuredAddress: string;
  totalPremium: number;
  coverageAmount: number;
  underwriter: string;
  underwriterId: string;
  broker: string;
  brokerId: string;
  riskScore: number;
  notes: string;
  createdDate: string;
  lastModifiedDate: string;
  createdBy: string;
  lastModifiedBy: string;
  isNew?: boolean;
  // Additional fields from Salesforce org
  accountId?: string;
  annualRevenue?: number | null;
  boundPremium?: number | null;
  brokerEmail?: string;
  brokerPhone?: string;
  carrierPortalUrl?: string | null;
  carrier?: string | null;
  commissionRate?: number | null;
  coverageTypes?: string | null;
  dateSubmitted?: string | null;
  insuredState?: string | null;
  isBound?: boolean;
  isRenewal?: boolean;
  lineOfBusiness?: string;
  numberOfEmployees?: number | null;
  opportunityId?: string | null;
  priority?: 'High' | 'Medium' | 'Low' | null;
  quotedPremium?: number | null;
  requestedPremium?: number;
  stage?: string;
  totalInsuredValue?: number;
  underwritingNotes?: string;
}

export interface RelatedDocument {
  id: string;
  name: string;
  type: string;
  uploadDate: string;
  size: string;
  uploadedBy: string;
}

export interface ActivityHistory {
  id: string;
  type: 'Note' | 'Email' | 'Call' | 'Task' | 'Status Change';
  subject: string;
  description: string;
  date: string;
  user: string;
}

export interface InsuranceSubmissionLine {
  id: string;
  name: string;
  insuranceSubmissionId: string;
  lineType: 'LOB' | 'Location' | 'Building' | 'Coverage' | 'Equipment / Contents' | 'Premise / Operation' | 'Class Code' | 'Endorsement' | 'Exclusion' | 'Vehicle' | 'Driver' | 'Account' | 'Contact';
  lineOfBusiness?: string;
  parentLineId?: string | null;
  sequenceNumber?: number | null;
  status: 'Active' | 'Inactive' | 'Pending';
  stage?: string | null;
  owner?: string | null;
  coverageLimit?: number | null;
  deductible?: number | null;
  premiumAllocation?: number | null;
  insuredValue?: number | null;
  sublimit?: number | null;
  description?: string | null;
  lineAttributes?: string | null;
  createdDate: string;
  lastModifiedDate: string;
}
