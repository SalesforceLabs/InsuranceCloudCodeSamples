/**
 * data/client360 - mock fixtures for the Client 360 dashboard
 * (c-client-360-dashboard), embedded on the Account record page.
 *
 * This is a vibe-coded prototype with no Apex / no live org, so the
 * dashboard reads from these per-account fixtures. Every section below
 * names the Financial Services Cloud (FSC) source object + the SOQL
 * the production controller would run, so swapping in a real
 * `Client360Controller.getDashboard(accountId)` later is mechanical:
 * keep the returned shape, replace the fixture lookup.
 *
 * Returned shape (per account):
 *   {
 *     asOf,                // ISO timestamp - single reading time for
 *                          //   the whole dashboard (tiles + chart sync)
 *     kpis: { premiumPrevYear, commissionPrevYear },
 *     premiumHistory: [{ year, amount }],   // ascending by year
 *     billing: { totalInvoiced, totalPaid, overdueCount, avgDaysToPay },
 *     policies:  [ ...InsurancePolicy rows ],
 *     renewals:  [ ...InsurancePolicy rows expiring <= 90d ],
 *     cases:     [ ...Case rows, IsClosed = false ],
 *     claims:    [ ...Claim rows ],
 *     tasks:     [ ...Task rows, Status != Completed ]
 *   }
 */

import { BASE_DATE_ISO } from 'data/dates';

// Single "as of" reading time for the whole dashboard. In prod this is
// the max LastModifiedDate across the queried records (or now()); here
// it tracks the demo base date so every "days until renewal" figure
// counts from the same today the rest of the app uses.
const AS_OF = `${BASE_DATE_ISO}T09:00:00Z`;

// ── KPI logic (FSC) ──────────────────────────────────────────────
// Active Policies  → COUNT(InsurancePolicy) WHERE NameInsuredId = :id
//                      AND IsActive = true
// Total Premium    → SUM(PremiumAmount)  (P&C) / SUM(TermAmount) (EB)
//                      WHERE NameInsuredId = :id AND IsActive = true
// Total Commission → SUM(CommissionAmount) WHERE NameInsuredId = :id
//                      AND IsActive = true
// Outstanding Bal. → SUM(Invoice.Balance) WHERE BillingAccountId = :id
//                      AND Status != 'Paid'   (billing Epic gated)
//
// Those four are NOT stored below. The dashboard adds them up from the
// `policies` and `billing` rows in `c-client-360-dashboard`'s `_kpis`
// getter, which is the fixture equivalent of the aggregate queries
// above. They used to be their own fields and drifted from the rows
// they were meant to summarise - Acme's Total Premium carried its
// medical premium alone while three policies were listed - so the rows
// are the single source of truth and each policy carries the
// `commission` the aggregate needs.
//
// Only the prior-year figures are stored, because no prior-year rows
// exist to add up.

const ACME_ID = '001EB00002pYzbMAC';
const MAVERICKS_ID = '001SB00001oXwntYAC';

// Account options for the standalone dashboard's Account picker. Only
// the accounts this fixture actually has a 360 payload for are listed
// (a real controller would query every account the user can see).
const ACCOUNT_LABELS = {
  [MAVERICKS_ID]: 'Mavericks Household',
  [ACME_ID]: 'Acme Manufacturing'
};

const DATA = {
  // ════════════════════════════════════════════════════════════
  // Mavericks Household - Personal Lines (Personal Auto)
  // ════════════════════════════════════════════════════════════
  [MAVERICKS_ID]: {
    asOf: AS_OF,
    kpis: {
      // Current-period totals are added up from `policies` below:
      // Apex auto $14,850 + Northgate umbrella $640 + Chubb home
      // $4,120 = the "$19.6K across 3 policies" figure the renewal
      // alerts, attrition row, and both meeting preps quote.
      premiumPrevYear: 18575, // 2024 total - drives the YoY trend chip
      commissionPrevYear: 2786
    },
    // ── Premium History (FSC) ──────────────────────────────────
    // InsurancePolicy WHERE NameInsuredId = :id, grouped by
    // CALENDAR_YEAR(EffectiveDate); SUM(PremiumAmount) per year.
    // Sourced from the prior-policy carriers in rfqIntakeModal.js.
    // Five terms of steady single-digit growth is what makes the +22%
    // auto renewal read as loss-driven rather than trend-driven.
    premiumHistory: [
      { year: 2021, amount: 15300 }, // Progressive auto + Nationwide home
      { year: 2022, amount: 16020 }, // Progressive auto + home
      { year: 2023, amount: 17510 }, // Meridian auto + home, umbrella added
      { year: 2024, amount: 18575 }, // Lighthouse 13,990 + 3,945 + 640
      { year: 2025, amount: 19610 } // Apex 14,850 + Chubb 4,120 + 640
    ],
    // ── Billing Summary (FSC, billing Epic gated) ──────────────
    // Invoice WHERE BillingAccountId = :id.
    //
    // Invoiced runs $1,240 above the $19,610 of annual premium because
    // adding Joseph mid-term (see the open case below) raised an
    // endorsement, and that invoice is the outstanding balance. It has
    // gone past terms, which is why one invoice is overdue on a
    // household that otherwise settles inside two weeks: an
    // endorsement bill arriving off the normal renewal cycle is the
    // one a client overlooks.
    billing: {
      totalInvoiced: 20850,
      totalPaid: 19610,
      overdueCount: 1,
      avgDaysToPay: 12
    },
    // ── Active Policies table (FSC) ────────────────────────────
    // InsurancePolicy WHERE NameInsuredId = :id AND IsActive = true,
    // ORDER BY ExpirationDate ASC.
    //
    // `commission` is the broker's share, ~15% on personal lines, and
    // is what the Total Commission tile adds up. Each carrier here
    // writes the line it is on per the CARRIERS appetite catalog: the
    // umbrella sits with Northgate Mutual, a home and umbrella market,
    // rather than an auto-only one.
    policies: [
      {
        // Also the key the hand-authored policy record page is filed
        // under in data/policyRecords, so opening this row from the
        // account's Insurance Policies list lands on the real record
        // rather than falling back to the list row.
        id: 'pol-mav-pa-2025',
        name: '2025 Mavericks Auto',
        number: 'AM-PA-2025-001-MVK',
        type: 'Personal Auto',
        lob: 'Personal Lines',
        effectiveDate: '2025-10-13',
        expirationDate: '2026-10-13',
        premium: 14850,
        commission: 2228,
        status: 'Active',
        carrier: 'Apex Mutual'
      },
      {
        id: 'pol-mav-umb-2025',
        name: '2025 Mavericks Umbrella',
        number: 'NM-UMB-2025-540-MVK',
        type: 'Personal Umbrella',
        lob: 'Personal Lines',
        effectiveDate: '2025-11-15',
        expirationDate: '2026-11-15',
        premium: 640,
        commission: 96,
        status: 'Active',
        carrier: 'Northgate Mutual'
      },
      {
        id: 'pol-mav-home-2025',
        name: '2025 Mavericks Homeowners',
        number: 'CH-HO-2025-118-MVK',
        type: 'Homeowners',
        lob: 'Personal Lines',
        effectiveDate: '2025-12-01',
        expirationDate: '2026-12-01',
        premium: 4120,
        commission: 618,
        status: 'Active',
        carrier: 'Chubb'
      }
    ],
    // ── Upcoming Renewals (FSC) ────────────────────────────────
    // InsurancePolicy WHERE NameInsuredId = :id AND IsActive = true
    //   AND ExpirationDate = NEXT_N_DAYS:120, ORDER BY ExpirationDate.
    // All three lines land in the window, which is what makes the
    // "review all three together" ask on the auto call reasonable.
    renewals: [
      {
        id: 'pol-mav-pa-2025',
        name: '2025 Mavericks Auto',
        expirationDate: '2026-10-13',
        premium: 14850,
        lob: 'Personal Lines',
        producer: 'Elena Rostova'
      },
      {
        id: 'pol-mav-umb-2025',
        name: '2025 Mavericks Umbrella',
        expirationDate: '2026-11-15',
        premium: 640,
        lob: 'Personal Lines',
        producer: 'Elena Rostova'
      },
      {
        id: 'pol-mav-home-2025',
        name: '2025 Mavericks Homeowners',
        expirationDate: '2026-12-01',
        premium: 4120,
        lob: 'Personal Lines',
        producer: 'Elena Rostova'
      }
    ],
    // ── Open Cases (FSC) ───────────────────────────────────────
    // Case WHERE AccountId = :id AND IsClosed = false,
    //   ORDER BY Priority DESC, CreatedDate DESC.
    cases: [
      {
        id: 'case-mav-1',
        number: '00012841',
        subject: 'Add Joseph Mavericks as a named driver',
        priority: 'High',
        status: 'Working',
        createdDate: '2026-08-28',
        owner: 'Elena Rostova'
      },
      {
        id: 'case-mav-2',
        number: '00012799',
        subject: 'ID cards request - full vehicle schedule',
        priority: 'Medium',
        status: 'Working',
        createdDate: '2026-08-19',
        owner: 'Dana Cole'
      },
      // The endorsement invoice behind the outstanding balance.
      {
        id: 'case-mav-3',
        number: '00012863',
        subject: 'Endorsement invoice query - added driver premium',
        priority: 'Medium',
        status: 'New',
        createdDate: '2026-09-02',
        owner: 'Dana Cole'
      },
      {
        id: 'case-mav-4',
        number: '00012744',
        subject: 'Scheduled jewellery appraisal update',
        priority: 'Low',
        status: 'Escalated',
        createdDate: '2026-07-30',
        owner: 'Elena Rostova'
      }
    ],
    // ── Claims Summary (FSC) ───────────────────────────────────
    // Claim WHERE AccountId = :id, ORDER BY LossDate DESC.
    claims: [
      // The open Wind/Hail comprehensive loss on the auto policy. Still
      // awaiting an adjuster reserve, which is why Apex is holding the
      // renewal indication high and why the SLA row is escalated.
      {
        id: 'clm-mav-1',
        name: 'CLM-2026-0431',
        type: 'Wind/Hail',
        status: 'In Review',
        severity: 'Moderate',
        estimatedAmount: 8400,
        actualAmount: 0,
        lossDate: '2026-04-14'
      },
      // The at-fault loss inside the expiring term. Together with the open
      // Wind/Hail claim it is the loss half of the +22% renewal; adding
      // Joseph as a rated driver is the other half.
      {
        id: 'clm-mav-2',
        name: 'CLM-2025-0908',
        type: 'Collision',
        status: 'Closed',
        severity: 'Major',
        estimatedAmount: 18500,
        actualAmount: 17250,
        lossDate: '2025-11-14'
      },
      // A glass-only comprehensive claim, settled at the deductible and
      // outside the three-year rating window. It is here so the loss
      // history is not read as two claims of equal weight: this one is
      // noise, and the +22% renewal rests on the other two.
      {
        id: 'clm-mav-3',
        name: 'CLM-2023-0614',
        type: 'Glass',
        status: 'Closed',
        severity: 'Minor',
        estimatedAmount: 720,
        actualAmount: 470,
        lossDate: '2023-06-09'
      }
    ],
    // ── Open Tasks (FSC) ───────────────────────────────────────
    // Task WHERE AccountId = :id AND Status != 'Completed',
    //   ORDER BY ActivityDate ASC.
    tasks: [
      {
        id: 'tsk-mav-1',
        subject: 'Call re: umbrella limit increase',
        dueDate: '2026-09-08',
        priority: 'High',
        status: 'Not Started',
        assignedTo: 'Elena Rostova'
      },
      {
        id: 'tsk-mav-2',
        subject: 'Send renewal proposal',
        dueDate: '2026-09-18',
        priority: 'Normal',
        status: 'In Progress',
        assignedTo: 'Elena Rostova'
      },
      {
        id: 'tsk-mav-3',
        subject: 'Confirm garaging address change',
        dueDate: '2026-09-11',
        priority: 'Low',
        status: 'Not Started',
        assignedTo: 'Dana Cole'
      },
      {
        id: 'tsk-mav-4',
        subject: 'Chase the overdue endorsement invoice',
        dueDate: '2026-09-16',
        priority: 'High',
        status: 'Not Started',
        assignedTo: 'Dana Cole'
      },
      {
        id: 'tsk-mav-5',
        subject: 'Request adjuster reserve on the Wind/Hail claim',
        dueDate: '2026-09-22',
        priority: 'Normal',
        status: 'In Progress',
        assignedTo: 'Elena Rostova'
      }
    ]
  },

  // ════════════════════════════════════════════════════════════
  // Acme Manufacturing - Employee Benefits (Group Medical)
  // ════════════════════════════════════════════════════════════
  [ACME_ID]: {
    asOf: AS_OF,
    kpis: {
      // Prior-year figures are account-wide, matching the 2024 row of
      // the history below, so the Total Premium tile's YoY compares
      // like with like. They were medical-only while the tile's own
      // total is every active policy, which showed the account up 37%
      // year over year when the real move is 10%.
      premiumPrevYear: 678500,
      commissionPrevYear: 33925
    },
    // EB premium history = SUM(TermAmount) per CALENDAR_YEAR(EffectiveDate),
    // across all three lines rather than medical alone. Four terms near
    // medical trend, then the 2025 bundle jump BlueCross is now quoting
    // a further +12% on top of. The medical component is still the
    // $612K the renewal alerts and Slack threads quote; the rest is
    // dental and life.
    premiumHistory: [
      { year: 2021, amount: 593000 }, // medical 478,000
      { year: 2022, amount: 621900 }, // medical 502,000
      { year: 2023, amount: 648800 }, // medical 524,000
      { year: 2024, amount: 678500 }, // medical 548,000 (UnitedHealthcare)
      { year: 2025, amount: 749200 } // medical 612,000 (BlueCross bundle)
    ],
    // Invoiced against all three lines, not medical alone, so the
    // outstanding balance reads as a share of what was actually billed.
    billing: {
      totalInvoiced: 749200,
      totalPaid: 730750,
      overdueCount: 1,
      avgDaysToPay: 23
    },
    // Terms run to late 2026. They previously expired 2026-01-01 and
    // 2026-03-01, both of which are behind the demo's base date of
    // 2026-09-15, so all three rows claimed to be Active on policies
    // that had already lapsed and Upcoming Renewals listed a renewal
    // in the past. Medical now ends Sep 20 2026, the date its renewal
    // alert carries.
    policies: [
      {
        id: 'pol-acme-med-2025',
        name: '2025 Acme Group Medical',
        number: 'BC-MED-2025-4410-ACM',
        type: 'Group Medical',
        lob: 'Employee Benefits',
        effectiveDate: '2025-09-20',
        expirationDate: '2026-09-20',
        premium: 612000,
        commission: 30600, // ~5% EB commission
        status: 'Active',
        carrier: 'BlueCross BlueShield'
      },
      {
        id: 'pol-acme-den-2025',
        name: '2025 Acme Group Dental',
        number: 'CG-DEN-2025-2087-ACM',
        type: 'Group Dental',
        lob: 'Employee Benefits',
        effectiveDate: '2025-11-01',
        expirationDate: '2026-11-01',
        premium: 41200,
        commission: 2060,
        status: 'Active',
        carrier: 'Cigna'
      },
      {
        id: 'pol-acme-life-2025',
        name: '2025 Acme Group Life',
        number: 'AE-LIF-2025-0663-ACM',
        type: 'Group Life',
        lob: 'Employee Benefits',
        effectiveDate: '2025-12-01',
        expirationDate: '2026-12-01',
        premium: 96000,
        commission: 4800,
        status: 'Active',
        carrier: 'Aetna'
      }
    ],
    // All three now fall inside the 120-day window, which is what makes
    // the "renew the benefits programme as one package" ask reasonable.
    renewals: [
      {
        id: 'pol-acme-med-2025',
        name: '2025 Acme Group Medical',
        expirationDate: '2026-09-20',
        premium: 612000,
        lob: 'Employee Benefits',
        producer: 'Elena Rostova'
      },
      {
        id: 'pol-acme-den-2025',
        name: '2025 Acme Group Dental',
        expirationDate: '2026-11-01',
        premium: 41200,
        lob: 'Employee Benefits',
        producer: 'Priya Nair'
      },
      {
        id: 'pol-acme-life-2025',
        name: '2025 Acme Group Life',
        expirationDate: '2026-12-01',
        premium: 96000,
        lob: 'Employee Benefits',
        producer: 'Elena Rostova'
      }
    ],
    cases: [
      {
        id: 'case-acme-1',
        number: '00012990',
        subject: 'Open enrollment portal access for 4 new hires',
        priority: 'High',
        status: 'New',
        createdDate: '2026-06-14',
        owner: 'Elena Rostova'
      },
      {
        id: 'case-acme-2',
        number: '00012955',
        subject: 'Dental network question - orthodontia coverage',
        priority: 'Medium',
        status: 'Working',
        createdDate: '2026-06-08',
        owner: 'Priya Nair'
      },
      {
        id: 'case-acme-3',
        number: '00013012',
        subject: 'Overdue medical invoice - premium reconciliation',
        priority: 'High',
        status: 'Working',
        createdDate: '2026-08-24',
        owner: 'Dana Cole'
      },
      {
        id: 'case-acme-4',
        number: '00012908',
        subject: 'Add Group Life beneficiary designations for 6 employees',
        priority: 'Low',
        status: 'New',
        createdDate: '2026-07-11',
        owner: 'Priya Nair'
      }
    ],
    // EB claim experience is what BlueCross is quoting the +12% medical
    // renewal off, so the large claimant sits alongside a routine one.
    claims: [
      {
        id: 'clm-acme-1',
        name: 'CLM-2026-0117',
        type: 'Group Medical',
        status: 'Paid',
        severity: 'Major',
        estimatedAmount: 84000,
        actualAmount: 78400,
        lossDate: '2026-02-03'
      },
      {
        id: 'clm-acme-2',
        name: 'CLM-2026-0342',
        type: 'Group Dental',
        status: 'In Review',
        severity: 'Minor',
        estimatedAmount: 3100,
        actualAmount: 0,
        lossDate: '2026-05-12'
      },
      // A second large medical claimant in the same experience period.
      // Two of these rather than one is what moves a 50-life group from
      // "bad luck" to a loss ratio BlueCross can price off, so it is
      // the evidence behind the +12% ask.
      {
        id: 'clm-acme-3',
        name: 'CLM-2026-0508',
        type: 'Group Medical',
        status: 'In Review',
        severity: 'Major',
        estimatedAmount: 52000,
        actualAmount: 0,
        lossDate: '2026-06-21'
      },
      {
        id: 'clm-acme-4',
        name: 'CLM-2025-1184',
        type: 'Group Life',
        status: 'Paid',
        severity: 'Major',
        estimatedAmount: 50000,
        actualAmount: 50000,
        lossDate: '2025-12-19'
      }
    ],
    tasks: [
      {
        id: 'tsk-acme-1',
        subject: 'Prep BlueCross +12% renewal counter',
        dueDate: '2026-06-18',
        priority: 'High',
        status: 'In Progress',
        assignedTo: 'Elena Rostova'
      },
      {
        id: 'tsk-acme-2',
        subject: 'Schedule open enrollment kickoff',
        dueDate: '2026-06-23',
        priority: 'High',
        status: 'Not Started',
        assignedTo: 'Elena Rostova'
      },
      {
        id: 'tsk-acme-3',
        subject: 'Collect updated census file',
        dueDate: '2026-06-26',
        priority: 'Normal',
        status: 'Not Started',
        assignedTo: 'Priya Nair'
      },
      {
        id: 'tsk-acme-4',
        subject: 'Review dental utilization report',
        dueDate: '2026-07-05',
        priority: 'Low',
        status: 'Not Started',
        assignedTo: 'Priya Nair'
      }
    ]
  }
};

// Map each policy/renewal row's LOB to the dashboard filter values.
function matchesLob(row, lob) {
  if (!lob || lob === 'all') return true;
  return row.lob === lob;
}

/**
 * Resolve the full dashboard payload for an account. `lob` filters the
 * Active Policies + Upcoming Renewals tables only; KPI tiles, the
 * premium chart, and the other tables stay account-wide (per spec).
 *
 * @param {string} accountId
 * @param {string} [lob='all']  'all' | 'Personal Lines' | 'Employee Benefits'
 * @returns {object|null}
 */
export function getClient360(accountId, lob = 'all') {
  const base = DATA[accountId];
  if (!base) return null;
  return {
    ...base,
    policies: base.policies.filter((p) => matchesLob(p, lob)),
    renewals: base.renewals.filter((r) => matchesLob(r, lob))
  };
}

// LOB options for the dashboard filter picklist. 'all' first (default).
export const CLIENT360_LOB_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Lines of Business' },
  { value: 'Personal Lines', label: 'Personal Lines' },
  { value: 'Employee Benefits', label: 'Employee Benefits' }
]);

// Selectable accounts for the standalone dashboard's Account picker -
// only those with a 360 payload in this fixture. Ordered to match the
// account tab strip (Mavericks first). The default selection is the
// first entry.
export function getClient360Accounts() {
  return [MAVERICKS_ID, ACME_ID].map((id) => ({
    value: id,
    label: ACCOUNT_LABELS[id]
  }));
}
