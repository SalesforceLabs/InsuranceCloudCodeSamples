import { Carrier, Quote, SubjectivityItem } from '../types'

export const MOCK_ACCOUNTS = [
  { id: 'a1', name: 'CaptiveAgentAccountTest1', industry: 'Insurance', city: 'New York, NY' },
  { id: 'a2', name: 'CloudBridge Inc.', industry: 'Technology', city: 'Austin, TX' },
  { id: 'a3', name: 'Acme Manufacturing', industry: 'Manufacturing', city: 'Cincinnati, OH' },
  { id: 'a4', name: 'Bluebird Logistics LLC', industry: 'Transportation', city: 'Memphis, TN' },
  { id: 'a5', name: 'Coastal Restaurants Group', industry: 'Restaurant', city: 'Tampa, FL' },
  { id: 'a6', name: 'Evergreen Apartments LP', industry: 'Real Estate', city: 'Seattle, WA' },
]

export const LOB_OPTIONS = [
  'Property & Casualty',
  'Commercial Auto',
  'Commercial Property',
  'General Liability',
  'Workers Compensation',
]

export const COVERAGE_LINES = [
  { id: 'commercial-auto', label: 'Commercial Auto' },
  { id: 'commercial-property', label: 'Commercial Property' },
  { id: 'general-liability', label: 'General Liability' },
  { id: 'workers-comp', label: "Workers' Compensation" },
  { id: 'cyber', label: 'Cyber Liability' },
  { id: 'umbrella', label: 'Commercial Umbrella' },
]

export const LINE_ITEM_PRODUCT_TYPES = [
  { id: 'auto', label: 'Auto', category: 'InsuredItem' },
  { id: 'auto-gold', label: 'Auto - Gold', category: 'InsuredItem' },
  { id: 'vehicle', label: 'Vehicle', category: 'InsuredItem' },
  { id: 'bodily-injury', label: 'Bodily Injury & Property Damage', category: 'Coverage' },
  { id: 'medical-payments', label: 'Medical Payments', category: 'Coverage' },
  { id: 'location', label: 'Location', category: 'InsuredItem' },
  { id: 'building', label: 'Building', category: 'InsuredItem' },
  { id: 'equipment', label: 'Equipment', category: 'InsuredItem' },
]

export const CARRIERS: Carrier[] = [
  {
    id: 'chubb',
    name: 'Chubb',
    code: 'chubb',
    initials: 'C',
    color: '#0070d2',
    lob: ['Property & Casualty'],
    amBest: 'A++',
  },
  {
    id: 'travelers',
    name: 'Travelers',
    code: 'trav',
    initials: 'T',
    color: '#c23934',
    lob: ['Property & Casualty'],
    amBest: 'A+',
  },
  {
    id: 'cna',
    name: 'CNA',
    code: 'cna',
    initials: 'CNA',
    color: '#2e844a',
    lob: ['Property & Casualty', 'Commercial Auto'],
    amBest: 'A',
  },
  {
    id: 'hartford',
    name: 'The Hartford',
    code: 'hig',
    initials: 'H',
    color: '#7c3aed',
    lob: ['Property & Casualty', 'Workers Compensation'],
    amBest: 'A+',
  },
  {
    id: 'zurich',
    name: 'Zurich',
    code: 'zuri',
    initials: 'Z',
    color: '#ea7600',
    lob: ['Commercial Property', 'General Liability'],
    amBest: 'A+',
  },
  {
    id: 'liberty',
    name: 'Liberty Mutual',
    code: 'libm',
    initials: 'LM',
    color: '#00a1e0',
    lob: ['Property & Casualty', 'Commercial Auto'],
    amBest: 'A',
  },
]

const nextYear = new Date(new Date().setFullYear(new Date().getFullYear() + 1))
  .toISOString()
  .slice(0, 10)

export const MOCK_QUOTES: Quote[] = [
  {
    id: 'q3',
    carrierId: 'hartford',
    carrierName: 'The Hartford',
    status: 'received',
    annualPremium: 18200,
    bldgContents: undefined,
    businessIncome: undefined,
    aopDed: '$2,500',
    windHailDed: undefined,
    exclusions: undefined,
    validUntil: nextYear,
    isBestPremium: false,
  },
  {
    id: 'q2',
    carrierId: 'travelers',
    carrierName: 'Travelers',
    status: 'received',
    annualPremium: 16800,
    bldgContents: undefined,
    businessIncome: undefined,
    aopDed: '$1,000',
    windHailDed: undefined,
    exclusions: 0,
    validUntil: nextYear,
    isBestPremium: true,
  },
  {
    id: 'q1',
    carrierId: 'chubb',
    carrierName: 'Chubb',
    status: 'pending',
    annualPremium: 0,
    bldgContents: undefined,
    businessIncome: undefined,
    aopDed: undefined,
    windHailDed: undefined,
    exclusions: undefined,
    validUntil: nextYear,
    isBestPremium: false,
  },
]

// Extended quote detail for the pricing-table comparison view
export interface QuoteDetail {
  quoteId: string
  liabilityLimit: string
  propertyDeductible: string
  businessIncome: string
  cyberAddon: string
}

export const QUOTE_DETAILS: QuoteDetail[] = [
  {
    quoteId: 'q3',
    liabilityLimit: '$1,000,000',
    propertyDeductible: '$2,500',
    businessIncome: 'Actual Loss Sustained',
    cyberAddon: 'Not Included',
  },
  {
    quoteId: 'q2',
    liabilityLimit: '$1,000,000',
    propertyDeductible: '$1,000',
    businessIncome: '12 Months',
    cyberAddon: 'Included ($50k)',
  },
  {
    quoteId: 'q1',
    liabilityLimit: '--',
    propertyDeductible: '--',
    businessIncome: '--',
    cyberAddon: '--',
  },
]

export const SUBJECTIVITIES: SubjectivityItem[] = [
  { id: 's1', label: 'Signed ACORD application', checked: false },
  { id: 's2', label: 'Loss runs (5 years)', checked: false },
  { id: 's3', label: 'Building inspection report', checked: false },
  { id: 's4', label: 'Proof of sprinkler maintenance', checked: false },
  { id: 's5', label: 'Certificate of insurance for prior carrier', checked: false },
]

export const PAYMENT_FREQUENCIES = ['Annual', 'Semi-Annual', 'Quarterly', 'Monthly']
