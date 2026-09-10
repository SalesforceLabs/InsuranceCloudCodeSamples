/**
 * data/revenueIntelligence - mock fixtures for the
 * `c-revenue-intelligence-dashboard` org-wide macro dashboard.
 *
 * No live org / no Apex wiring - same prototype contract as
 * data/client360. Every dataset below names the FSC/AGF source object
 * and SOQL the production controller would run, so swapping in a real
 * `RevenueIntelligenceController.getOrgDashboard()` later is mechanical.
 *
 * Returned shape (single org-wide payload):
 *   {
 *     asOf,                 // ISO timestamp - single reading time
 *     kpiMetrics: { totalCommissionEarned, expectedRevenue,
 *                   outstandingReceivables, totalPaymentsCollected,
 *                   prevYear ... },
 *     billingPipeline: { scheduled, billed, pending, nextBillingDate },
 *     commissionByStatus:  [{ id, label, value }],            // donut
 *     expectedVsReceived:  [{ id, period, expected, received }], // grouped bar
 *     commissionByLob:     [{ id, label, value }],            // horiz bar
 *     commissionByCarrier: [{ id, label, value }],            // horiz bar
 *     invoiceAging:        [{ id, bucket, value }],           // stacked bar
 *     monthlyRevenueTrend: [{ id, month, revenue }],          // line
 *     producerData:        [{ id, name, totalCommission,
 *                             policyCount, avgCommissionPct }],
 *     commissionStatements:[{ id, carrier, date, totalCommission,
 *                             basis, status }],
 *     dateRanges, lobs, producers  // global filter options
 *   }
 */

import { BASE_DATE_ISO } from 'data/dates';

// Reading time tracks the demo base date - see data/dates.
const AS_OF = `${BASE_DATE_ISO}T09:00:00Z`;

// ── KPI sources (FSC + AGF) ─────────────────────────────────────
// totalCommissionEarned   → SUM(CommissionLineItem.Amount) YTD
// expectedRevenue         → SUM(InsurancePolicy.CommissionAmount)
//                              for policies effective in fiscal year
// outstandingReceivables  → SUM(Invoice.Balance) WHERE Status != 'Paid'
//                              AND BillingAccount IN producer accounts
// totalPaymentsCollected  → SUM(Payment.Amount) YTD

const KPI_METRICS = {
  totalCommissionEarned: 487500,
  expectedRevenue: 612000,
  outstandingReceivables: 89400,
  totalPaymentsCollected: 398100,
  // YoY priors drive the trend chip on each KPI tile.
  totalCommissionEarnedPrevYear: 442000,
  expectedRevenuePrevYear: 548000,
  outstandingReceivablesPrevYear: 72100,
  totalPaymentsCollectedPrevYear: 369700
};

const BILLING_PIPELINE = {
  scheduled: 612000, // policies bound, billing not yet generated
  billed: 487500, // invoices issued
  pending: 124500, // invoices issued but not yet paid
  nextBillingDate: '2026-07-15'
};

// CommissionLineItem grouped by Status - drives the donut chart.
// Sums tie back to totalCommissionEarned (Paid + Pending + Disputed
// + Reversed = total recognized).
const COMMISSION_BY_STATUS = [
  { id: 'paid', label: 'Paid', value: 398100 },
  { id: 'pending', label: 'Pending', value: 67400 },
  { id: 'disputed', label: 'Disputed', value: 14600 },
  { id: 'reversed', label: 'Reversed', value: 7400 }
];

// CommissionLineItem grouped by FiscalQuarter - Expected (from policy
// terms) vs Received (from posted commission). Gap = revenue leakage.
const EXPECTED_VS_RECEIVED = [
  { id: 'q1', period: 'Q1', expected: 142000, received: 138400 },
  { id: 'q2', period: 'Q2', expected: 161000, received: 154200 },
  { id: 'q3', period: 'Q3', expected: 158000, received: 149300 },
  { id: 'q4', period: 'Q4', expected: 151000, received: 45600 } // YTD; Q4 in progress
];

// CommissionLineItem grouped by InsurancePolicy.LineOfBusiness.
const COMMISSION_BY_LOB = [
  { id: 'cpc', label: 'Commercial P&C', value: 218400 },
  { id: 'eb', label: 'Employee Benefits', value: 156200 },
  { id: 'pl', label: 'Personal Lines', value: 78900 },
  { id: 'spec', label: 'Specialty', value: 34000 }
];

// CommissionLineItem grouped by InsurancePolicy.CarrierAccountId.
const COMMISSION_BY_CARRIER = [
  { id: 'bcbs', label: 'BlueCross BlueShield', value: 124300 },
  { id: 'aetna', label: 'Aetna', value: 89400 },
  { id: 'cigna', label: 'Cigna', value: 71200 },
  { id: 'hartford', label: 'The Hartford', value: 68900 },
  { id: 'travelers', label: 'Travelers', value: 56400 },
  { id: 'chubb', label: 'Chubb', value: 42300 },
  { id: 'apex', label: 'Apex Mutual', value: 35000 }
];

// Invoice.AgeBucket - Current / 1-30 / 31-60 / 61-90 / 90+ days.
// Stacked-bar chart renders these as one stacked bar (the spec calls
// for: Current, 1-30, 31-60, 90+ - combine 61-90 + 90+ into one
// "90+ days" bucket for the visualization).
const INVOICE_AGING = [
  { id: 'current', bucket: 'Current', value: 41200 },
  { id: '1-30', bucket: '1-30 days', value: 26800 },
  { id: '31-60', bucket: '31-60 days', value: 14400 },
  { id: '90plus', bucket: '90+ days', value: 7000 }
];

// CommissionLineItem grouped by CALENDAR_MONTH(PostedDate). YTD trend.
const MONTHLY_REVENUE_TREND = [
  { id: 'm-1', month: 'Jan', revenue: 38400 },
  { id: 'm-2', month: 'Feb', revenue: 41200 },
  { id: 'm-3', month: 'Mar', revenue: 58800 },
  { id: 'm-4', month: 'Apr', revenue: 49600 },
  { id: 'm-5', month: 'May', revenue: 64300 },
  { id: 'm-6', month: 'Jun', revenue: 45600 }
];

// User (Producer) joined to CommissionLineItem aggregates.
const PRODUCER_DATA = [
  {
    id: 'prod-jfield',
    name: 'Elena Rostova',
    totalCommission: 178300,
    policyCount: 42,
    avgCommissionPct: 9.2
  },
  {
    id: 'prod-dcole',
    name: 'Dana Cole',
    totalCommission: 124600,
    policyCount: 31,
    avgCommissionPct: 8.5
  },
  {
    id: 'prod-pnair',
    name: 'Priya Nair',
    totalCommission: 96200,
    policyCount: 28,
    avgCommissionPct: 7.9
  },
  {
    id: 'prod-mrivera',
    name: 'Marco Rivera',
    totalCommission: 58400,
    policyCount: 19,
    avgCommissionPct: 7.1
  },
  {
    id: 'prod-skim',
    name: 'Sara Kim',
    totalCommission: 30000,
    policyCount: 11,
    avgCommissionPct: 6.4
  }
];

// CommissionStatement headers received from carriers. Records the
// reconciliation status against expected commission for the period.
const COMMISSION_STATEMENTS = [
  {
    id: 'stmt-bcbs-2026-06',
    carrier: 'BlueCross BlueShield',
    date: '2026-06-15',
    totalCommission: 30600,
    basis: 'Premium · Tiered',
    status: 'Paid'
  },
  {
    id: 'stmt-cigna-2026-06',
    carrier: 'Cigna',
    date: '2026-06-12',
    totalCommission: 14200,
    basis: 'Premium · Flat 5%',
    status: 'Paid'
  },
  {
    id: 'stmt-aetna-2026-06',
    carrier: 'Aetna',
    date: '2026-06-08',
    totalCommission: 18900,
    basis: 'Premium · Tiered',
    status: 'Pending'
  },
  {
    id: 'stmt-hartford-2026-05',
    carrier: 'The Hartford',
    date: '2026-05-28',
    totalCommission: 21400,
    basis: 'Written premium',
    status: 'Paid'
  },
  {
    id: 'stmt-travelers-2026-05',
    carrier: 'Travelers',
    date: '2026-05-22',
    totalCommission: 12100,
    basis: 'Written premium',
    status: 'Disputed'
  },
  {
    id: 'stmt-chubb-2026-05',
    carrier: 'Chubb',
    date: '2026-05-15',
    totalCommission: 9600,
    basis: 'Written premium',
    status: 'Paid'
  }
];

// Global filter option lists - driven by the dashboard toolbar.
const DATE_RANGES = Object.freeze([
  { value: 'ytd', label: 'Year to Date' },
  { value: 'q', label: 'This Quarter' },
  { value: 'm', label: 'This Month' },
  { value: 'rolling-12', label: 'Last 12 Months' },
  { value: 'last-year', label: 'Last Year' }
]);

const LOBS = Object.freeze([
  { value: 'all', label: 'All Lines of Business' },
  { value: 'cpc', label: 'Commercial P&C' },
  { value: 'eb', label: 'Employee Benefits' },
  { value: 'pl', label: 'Personal Lines' },
  { value: 'spec', label: 'Specialty' }
]);

const PRODUCERS = Object.freeze([
  { value: 'all', label: 'All Producers' },
  { value: 'prod-jfield', label: 'Elena Rostova' },
  { value: 'prod-dcole', label: 'Dana Cole' },
  { value: 'prod-pnair', label: 'Priya Nair' },
  { value: 'prod-mrivera', label: 'Marco Rivera' },
  { value: 'prod-skim', label: 'Sara Kim' }
]);

/**
 * Single accessor for the dashboard payload. Filters are currently
 * informational (the fixture is org-wide and pre-aggregated); when
 * Apex lands, the controller takes the filter triplet and returns the
 * filtered aggregates.
 *
 * @param {object} [filters]
 * @param {string} [filters.dateRange='ytd']
 * @param {string} [filters.lob='all']
 * @param {string} [filters.producer='all']
 */
export function getRevenueIntelligence(filters = {}) {
  return {
    asOf: AS_OF,
    filters: {
      dateRange: filters.dateRange || 'ytd',
      lob: filters.lob || 'all',
      producer: filters.producer || 'all'
    },
    kpiMetrics: { ...KPI_METRICS },
    billingPipeline: { ...BILLING_PIPELINE },
    commissionByStatus: COMMISSION_BY_STATUS.slice(),
    expectedVsReceived: EXPECTED_VS_RECEIVED.slice(),
    commissionByLob: COMMISSION_BY_LOB.slice(),
    commissionByCarrier: COMMISSION_BY_CARRIER.slice(),
    invoiceAging: INVOICE_AGING.slice(),
    monthlyRevenueTrend: MONTHLY_REVENUE_TREND.slice(),
    producerData: PRODUCER_DATA.slice(),
    commissionStatements: COMMISSION_STATEMENTS.slice()
  };
}

export const REVENUE_DATE_RANGES = DATE_RANGES;
export const REVENUE_LOBS = LOBS;
export const REVENUE_PRODUCERS = PRODUCERS;
