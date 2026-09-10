import { today } from 'data/dates';
/**
 * Mock Connect API client.
 *
 * Mirrors the endpoints the engineering team outlined for FSC Insurance:
 *   GET    /services/data/v60.0/connect/insurance/applications
 *   POST   /services/data/v60.0/connect/insurance/applications
 *   GET    /services/data/v60.0/connect/insurance/applications/{id}/quotes
 *   POST   /services/data/v60.0/connect/insurance/applications/{id}/compare
 *
 * Every function returns a Promise so screens can render real skeleton states.
 * To wire up production: swap the bodies for `fetch()` calls - DTOs are already
 * shaped per `model/insurancePolicy.js`.
 */

import {
  rfqData,
  acmeRfqData,
  quotes,
  census,
  MOCK_ACCOUNTS,
  COVERAGE_CATALOG,
  ITEM_TYPES
} from 'data/mockData';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function uid(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

// In-memory store so created records survive across calls. Both the
// Mavericks PA application and the Acme EB application are pre-seeded so
// bindPolicy() can resolve account/name metadata for either flow.
const store = {
  applications: [rfqData, acmeRfqData],
  policies: [],
  policyCoverages: [],
  policyParticipants: []
};

// ───────────────────────────────────────────────────────────────
// GET /connect/insurance/applications
// ───────────────────────────────────────────────────────────────
export async function listInsuranceApplications({ accountId, status } = {}) {
  await sleep(400);
  let results = store.applications.slice();
  if (accountId) results = results.filter((a) => a.accountId === accountId);
  if (status) results = results.filter((a) => a.status === status);
  return results;
}

// ───────────────────────────────────────────────────────────────
// POST /connect/insurance/applications
// Creates the InsuranceApplication + stages IPC / IPP records.
// ───────────────────────────────────────────────────────────────
export async function createInsuranceApplication(payload) {
  await sleep(700);
  const id = uid('app');
  const app = {
    id,
    applicationName: payload.applicationName || 'New RFQ',
    accountId: payload.accountId,
    lob: payload.lob,
    status: 'Draft',
    effectiveDate: payload.effectiveDate,
    expirationDate: payload.expirationDate,
    responseDeadline: payload.responseDeadline,
    lineItems: (payload.lineItems || []).map((li) => ({ ...li, id: uid('li') })),
    coverages: (payload.coverages || []).map((c) => ({ ...c, id: uid('cov') })),
    participants: (payload.participants || []).map((p) => ({ ...p, id: uid('ipp') }))
  };
  store.applications.push(app);
  return { applicationId: id, application: app };
}

// ───────────────────────────────────────────────────────────────
// GET /connect/insurance/applications/{id}/quotes
// ───────────────────────────────────────────────────────────────
export async function listQuotes({ applicationId }) {
  await sleep(600);
  return quotes.filter((q) => q.applicationId === applicationId);
}

// ───────────────────────────────────────────────────────────────
// POST /connect/insurance/applications/{id}/compare
// Returns quotes ordered with the Agentforce-recommended carrier first.
// ───────────────────────────────────────────────────────────────
export async function compareQuotes({ applicationId }) {
  await sleep(900);
  const eligible = quotes.filter((q) => q.applicationId === applicationId);
  const recommended = eligible.find((q) => q.aiRecommendation?.bestValue);
  const ordered = recommended
    ? [recommended, ...eligible.filter((q) => q.id !== recommended.id)]
    : eligible;
  return {
    applicationId,
    quotes: ordered,
    recommendation: recommended
      ? {
          quoteId: recommended.id,
          carrierName: recommended.carrierName,
          confidence: recommended.aiRecommendation.confidence,
          reason: recommended.aiRecommendation.reason
        }
      : null
  };
}

// ───────────────────────────────────────────────────────────────
// POST /connect/insurance/applications/{id}/bind
// Converts the accepted CarrierQuote into an InsurancePolicy with
// status "In Force". Mirrors the Record-Triggered Flow that fires on
// Salesforce when a quote → policy state transition happens.
// ───────────────────────────────────────────────────────────────
export async function bindPolicy({
  applicationId,
  quoteId,
  subjectivities: clearedSubjectivities = [],
  paymentFrequency = 'annual',
  paymentMethod = 'ach',
  additionalInsureds = [],
  certificateHolders = [],
  notes = ''
}) {
  await sleep(1500);
  const q = quotes.find((x) => x.id === quoteId);
  const app = store.applications.find((a) => a.id === applicationId) || rfqData;
  const policyNumber = `MR-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`;
  const policy = {
    id: uid('pol'),
    policyNumber,
    accountId: app.accountId,
    accountName: app.account?.name,
    lobCode: 'auto',
    carrierId: q?.carrierId,
    carrierName: q?.carrierName,
    effectiveDate: app.effectiveDate,
    expirationDate: app.expirationDate,
    status: 'In Force',
    totalPremium: q?.annualPremium || 0,
    paymentFrequency,
    paymentMethod,
    additionalInsureds,
    certificateHolders,
    notes,
    subjectivitiesCleared: clearedSubjectivities.filter((s) => s.checked).length,
    boundAt: today().toISOString()
  };
  store.policies.push(policy);
  // Flip the source application to a Bound state too.
  if (app) app.status = 'Bound';
  return { policy };
}

// ───────────────────────────────────────────────────────────────
// Census parsing - simulates an OCR + match call.
// ───────────────────────────────────────────────────────────────
export async function parseCensusFile(/* file */) {
  await sleep(2000);
  return { employees: census, parsedCount: census.length };
}

// ───────────────────────────────────────────────────────────────
// Account / catalog lookups
// ───────────────────────────────────────────────────────────────
export async function searchAccounts(term = '') {
  await sleep(150);
  const q = term.trim().toLowerCase();
  if (!q) return MOCK_ACCOUNTS.slice(0, 5);
  return MOCK_ACCOUNTS.filter(
    (a) => a.name.toLowerCase().includes(q) || a.city.toLowerCase().includes(q)
  );
}

export function getCoverageCatalog() {
  return COVERAGE_CATALOG;
}

export function getItemTypes() {
  return ITEM_TYPES;
}
