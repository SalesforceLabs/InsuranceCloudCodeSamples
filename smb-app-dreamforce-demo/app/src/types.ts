export interface LineItem {
  id: string
  name: string
  type: string        // e.g. "VEHICLE", "AUTOGOLD", "AUTSILVER"
  insuredValue: number
  coverages: string[]
}

export interface Carrier {
  id: string
  name: string
  code: string
  initials: string
  color: string       // avatar background color
  lob: string[]       // e.g. ["Property & Casualty"]
  amBest?: string
}

export interface Quote {
  id: string
  carrierId: string
  carrierName: string
  status: 'received' | 'pending' | 'declined' | 'stale'
  annualPremium: number
  bldgContents?: number
  businessIncome?: number
  aopDed?: string
  windHailDed?: string
  exclusions?: number
  validUntil: string   // ISO date string
  isBestPremium?: boolean
}

export interface SubjectivityItem {
  id: string
  label: string
  checked: boolean
}

export interface RFQDetails {
  rfqId: string
  accountName: string
  applicationName: string
  isRenewal: boolean
  primaryContact: string
  contactEmail: string
  replicateFromPolicy: string
  useExistingData: boolean
  lob: string
  linesOfCoverage: string[]
  effectiveDate: string
  expirationDate: string
  responseDeadline: string
  lineItems: LineItem[]
}

export type Step = 1 | 2 | 3 | 4
