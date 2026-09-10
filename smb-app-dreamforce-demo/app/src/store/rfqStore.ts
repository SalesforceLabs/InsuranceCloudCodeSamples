import { create } from 'zustand'
import { RFQDetails, Step, Quote, LineItem } from '../types'

const today = new Date().toISOString().slice(0, 10)
const nextYear = new Date(new Date().setFullYear(new Date().getFullYear() + 1))
  .toISOString()
  .slice(0, 10)
const deadline = new Date(new Date().setMonth(new Date().getMonth() + 1))
  .toISOString()
  .slice(0, 10)

function genId() {
  return Math.random().toString(36).slice(2, 9)
}

const INITIAL_RFQ_DETAILS: RFQDetails = {
  rfqId: `RFQ-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
  accountName: '',
  applicationName: '',
  isRenewal: false,
  primaryContact: '',
  contactEmail: '',
  replicateFromPolicy: '',
  useExistingData: false,
  lob: 'Property & Casualty',
  linesOfCoverage: [],
  effectiveDate: today,
  expirationDate: nextYear,
  responseDeadline: deadline,
  lineItems: [],
}

interface RFQStore {
  step: Step
  rfqDetails: RFQDetails
  selectedCarriers: string[]
  emailSubject: string
  emailBody: string
  quotes: Quote[]
  acceptedQuoteId: string | null

  // Step navigation
  setStep: (step: Step) => void

  // RFQ detail mutations
  updateRFQDetails: (patch: Partial<RFQDetails>) => void
  toggleLineOfCoverage: (coverage: string) => void
  addLineItem: (item: Omit<LineItem, 'id'>) => void
  removeLineItem: (id: string) => void
  clearLineItems: () => void

  // Step 2
  toggleCarrier: (carrierId: string) => void
  setEmailSubject: (s: string) => void
  setEmailBody: (s: string) => void

  // Step 3
  setQuotes: (quotes: Quote[]) => void
  acceptQuote: (quoteId: string) => void
}

export const useRFQStore = create<RFQStore>((set) => ({
  step: 1,
  rfqDetails: INITIAL_RFQ_DETAILS,
  selectedCarriers: [],
  emailSubject: 'RFQ — {{insured}} — {{lob}} — Effective {{effective}}',
  emailBody: `Dear {{carrier}} Underwriter,\n\nPlease find attached the Request for Quotation for {{insured}}.\n\nLine of Business: {{lob}}\nEffective Date: {{effective}}\nExpiration Date: {{expiration}}\nResponse Deadline: {{deadline}}\n\nKindly provide your best terms at your earliest convenience.\n\nBest regards,\n{{broker}}`,
  quotes: [],
  acceptedQuoteId: null,

  setStep: (step) => set({ step }),

  updateRFQDetails: (patch) =>
    set((s) => ({ rfqDetails: { ...s.rfqDetails, ...patch } })),

  toggleLineOfCoverage: (coverage) =>
    set((s) => {
      const existing = s.rfqDetails.linesOfCoverage
      const next = existing.includes(coverage)
        ? existing.filter((c) => c !== coverage)
        : [...existing, coverage]
      return { rfqDetails: { ...s.rfqDetails, linesOfCoverage: next } }
    }),

  addLineItem: (item) =>
    set((s) => ({
      rfqDetails: {
        ...s.rfqDetails,
        lineItems: [...s.rfqDetails.lineItems, { ...item, id: genId() }],
      },
    })),

  removeLineItem: (id) =>
    set((s) => ({
      rfqDetails: {
        ...s.rfqDetails,
        lineItems: s.rfqDetails.lineItems.filter((li) => li.id !== id),
      },
    })),

  clearLineItems: () =>
    set((s) => ({ rfqDetails: { ...s.rfqDetails, lineItems: [] } })),

  toggleCarrier: (carrierId) =>
    set((s) => ({
      selectedCarriers: s.selectedCarriers.includes(carrierId)
        ? s.selectedCarriers.filter((c) => c !== carrierId)
        : [...s.selectedCarriers, carrierId],
    })),

  setEmailSubject: (emailSubject) => set({ emailSubject }),
  setEmailBody: (emailBody) => set({ emailBody }),

  setQuotes: (quotes) => set({ quotes }),
  acceptQuote: (quoteId) => set({ acceptedQuoteId: quoteId }),
}))
