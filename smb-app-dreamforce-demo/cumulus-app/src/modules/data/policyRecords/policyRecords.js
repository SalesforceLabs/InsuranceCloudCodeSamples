/**
 * data/policyRecords - FSC-shaped Insurance Policy records for the policy
 * record page (c-insurance-policy-record-page).
 *
 * The shape mirrors the standard `InsurancePolicy` record page in an FSC org
 * with the Insurance Brokerage app: a highlights panel, the seven Details
 * field sections, the Related tab's related lists, and the "Policy UI" tab's
 * Insurance Policy Structure grid (industries_insurance_policyadmin-
 * insurance-policy-details), which renders the policy hierarchy as
 *
 *   Insurance Policy
 *     ├── policy-level Insurance Policy Coverages
 *     └── Insurance Policy Asset
 *           ├── asset-level Insurance Policy Coverages
 *           └── Insurance Policy Participant
 *
 * Amounts are authored so every parent equals the sum of its children and the
 * policy root equals the term premium - the grid is read aloud in the demo.
 */

const USD = (n) =>
  `USD ${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const ZERO = USD(0);

/** Policy-level coverage node. */
const coverage = (id, label, category, amount) => ({
  id,
  label,
  product: label,
  kind: 'coverage',
  category,
  standardAmount: USD(amount),
  termAmount: USD(amount),
  standardTax: ZERO,
  termTax: ZERO
});

/**
 * Driver participant node. Per the Auto product model the app builds
 * renewals against (c-pa-asset-tree, c-coverage-limits-setup), Medical
 * Payments is the one coverage that hangs off the driver rather than the
 * policy or the vehicle, so a participant rolls up its own coverages.
 * The Product column carries the person's name only - the org Details
 * grid does not prefix a "Rated Driver" role label.
 */
const participant = (id, label, role, amount, children) => ({
  id,
  label,
  product: role,
  kind: 'participant',
  standardAmount: USD(amount),
  termAmount: USD(amount),
  standardTax: ZERO,
  termTax: ZERO,
  children
});

/** Covered-asset node; `amount` must equal the sum of its coverage children. */
const asset = (id, label, amount, children) => ({
  id,
  label,
  product: label,
  kind: 'asset',
  standardAmount: USD(amount),
  termAmount: USD(amount),
  standardTax: ZERO,
  termTax: ZERO,
  children
});

// ── 2025 Mavericks Auto (the policy being renewed) ────────────────────
// Apex Mutual's first term on this book. Two commuter vehicles garaged at
// 4208 N Dale Mabry Hwy with James rated on both, matching the prior-policy
// roster snapshot in c-rfq-intake-modal (vehicleIds/driverIds).
//
// This record is the single source for the policy across the page and the
// renewal it launches, so the figures below are the ones the intake modal's
// `priorDetail` carries: premium 14,850 on a 10/13/2025 - 10/13/2026 term.
//
// Premium roll-up: 7,240 policy-level + 4,285 CR-V + 3,325 Camry = 14,850.
const MAVERICKS_PA_2025 = {
  id: 'pol-mav-pa-2025',
  name: '2025 Mavericks Auto',
  policyNumber: 'AM-PA-2025-001-MVK',
  objectLabel: 'Insurance Policy',
  lob: 'Personal Lines',
  loc: 'Personal Auto',
  carrier: 'Apex Mutual',
  status: 'Active',
  accountId: '001SB00001oXwntYAC',

  // Compact-layout fields for the highlights panel. Six fits the strip on
  // one row at the org's 32px field gutters; Expected Revenue and Billing
  // Type live on in the Agency Billing and Carrier detail sections.
  highlights: [
    { id: 'h-num', label: 'Policy Number', value: 'AM-PA-2025-001-MVK' },
    { id: 'h-status', label: 'Status', value: 'Active' },
    { id: 'h-from', label: 'Effective From Date', value: '10/13/2025' },
    { id: 'h-to', label: 'Effective To Date', value: '10/13/2026' },
    { id: 'h-prem', label: 'Premium Amount', value: 'USD 14,850.00' },
    { id: 'h-freq', label: 'Premium Frequency', value: 'Annual' }
  ],

  detailSections: [
    {
      id: 'sec-policy',
      title: 'Policy Details',
      fields: [
        { id: 'f1', label: 'Policy Name', value: '2025 Mavericks Auto' },
        { id: 'f2', label: 'Policy Number', value: 'AM-PA-2025-001-MVK' },
        { id: 'f3', label: 'Named Insured', value: 'Mavericks Household', isLink: true },
        { id: 'f4', label: 'Status', value: 'Active' },
        { id: 'f5', label: 'Line of Business', value: 'Personal Lines' },
        { id: 'f6', label: 'Line of Coverage', value: 'Personal Auto' },
        { id: 'f7', label: 'Product', value: 'Personal Auto' },
        { id: 'f8', label: 'Policy Type', value: 'New Business' },
        { id: 'f9', label: 'Effective From Date', value: '10/13/2025' },
        { id: 'f10', label: 'Effective To Date', value: '10/13/2026' },
        { id: 'f11', label: 'Premium Amount', value: 'USD 14,850.00' },
        { id: 'f12', label: 'Premium Frequency', value: 'Annual' },
        { id: 'f13', label: 'Currency', value: 'USD - U.S. Dollar' },
        { id: 'f14', label: 'Owner', value: 'Elena Rostova', isLink: true }
      ]
    },
    {
      id: 'sec-direct',
      title: 'Direct Billing - Amounts',
      // Agency-billed policy, so the direct-bill ledger stays at zero.
      fields: [
        { id: 'd1', label: 'Standard Premium', value: 'USD 0.00' },
        { id: 'd2', label: 'Term Premium', value: 'USD 0.00' },
        { id: 'd3', label: 'Standard Tax', value: 'USD 0.00' },
        { id: 'd4', label: 'Term Tax', value: 'USD 0.00' },
        { id: 'd5', label: 'Standard Fee', value: 'USD 0.00' },
        { id: 'd6', label: 'Term Fee', value: 'USD 0.00' }
      ]
    },
    {
      id: 'sec-agency',
      title: 'Agency Billing - Amounts',
      fields: [
        { id: 'a1', label: 'Standard Premium', value: 'USD 14,850.00' },
        { id: 'a2', label: 'Term Premium', value: 'USD 14,850.00' },
        { id: 'a3', label: 'Standard Tax', value: 'USD 0.00' },
        { id: 'a4', label: 'Term Tax', value: 'USD 0.00' },
        { id: 'a5', label: 'Standard Fee', value: 'USD 0.00' },
        { id: 'a6', label: 'Term Fee', value: 'USD 0.00' },
        { id: 'a7', label: 'Commission Rate', value: '12.00%' },
        { id: 'a8', label: 'Commission Amount', value: 'USD 1,782.00' }
      ]
    },
    {
      id: 'sec-carrier',
      title: 'Carrier Information',
      fields: [
        { id: 'c1', label: 'Billing Carrier Account', value: 'Apex Mutual', isLink: true },
        { id: 'c2', label: 'Writing Carrier Account', value: 'Apex Mutual', isLink: true },
        { id: 'c3', label: 'Carrier Policy Number', value: 'AM-PA-2025-001-MVK' },
        { id: 'c4', label: 'Producer', value: 'Elena Rostova', isLink: true },
        { id: 'c5', label: 'Broker of Record', value: 'Atlas Insurance Partners' },
        { id: 'c6', label: 'Billing Type', value: 'Agency Bill' }
      ]
    },
    {
      id: 'sec-payment',
      title: 'Payment Details',
      fields: [
        { id: 'p1', label: 'Payment Method', value: 'ACH Direct Debit' },
        { id: 'p2', label: 'Payment Plan', value: 'Annual - Paid in Full' },
        { id: 'p3', label: 'Invoice Number', value: 'INV-2025-10-4471' },
        { id: 'p4', label: 'Paid Amount', value: 'USD 14,850.00' },
        { id: 'p5', label: 'Balance Due', value: 'USD 0.00' },
        { id: 'p6', label: 'Next Payment Date', value: '' }
      ]
    },
    {
      id: 'sec-renewal',
      title: 'Renewal Details',
      fields: [
        { id: 'r1', label: 'Renewal Status', value: 'In Progress' },
        { id: 'r2', label: 'Renewal Type', value: 'Shopped' },
        { id: 'r3', label: 'Expiration Date', value: '10/13/2026' },
        { id: 'r4', label: 'Days to Expiration', value: '46' },
        { id: 'r5', label: 'Quoted Renewal Premium', value: 'USD 18,120.00' },
        { id: 'r6', label: 'Renewal Change', value: '+22.0%' },
        {
          id: 'r7',
          label: 'Renewal Submission',
          value: '2026 Mavericks Personal Auto Renewal',
          isLink: true
        },
        { id: 'r8', label: 'Auto-Renew', value: 'No' }
      ]
    },
    {
      id: 'sec-additional',
      title: 'Additional Details',
      fields: [
        {
          id: 'x1',
          label: 'Description',
          value:
            'Household personal auto program covering two commuter vehicles garaged at 4208 N Dale Mabry Hwy, Tampa, FL 33611.',
          isWide: true
        },
        { id: 'x2', label: 'Policy Form', value: 'PP 00 01 (ACORD 90)' },
        { id: 'x3', label: 'Source System', value: 'Atlas Broker Platform' },
        { id: 'x4', label: 'Created By', value: 'Elena Rostova, 10/06/2025' },
        { id: 'x5', label: 'Last Modified By', value: 'Elena Rostova, 08/28/2026' }
      ]
    }
  ],

  relatedLists: [
    {
      id: 'rl-derived',
      title: 'Derived Policies',
      count: 1,
      icon: 'policy',
      columns: [
        { id: 'c1', label: 'Policy Number' },
        { id: 'c2', label: 'Policy Type' },
        { id: 'c3', label: 'Premium Amount' }
      ],
      rows: [
        {
          id: 'dp-1',
          cells: [
            { id: 'v1', value: 'AM-PA-2026-001-MVK', isLink: true },
            { id: 'v2', value: 'Renewal Quote' },
            { id: 'v3', value: 'USD 18,120.00' }
          ]
        }
      ],
      showViewAll: true
    },
    { id: 'rl-surcharges', title: 'Insurance Policy Surcharges', count: 0, icon: 'surcharge' },
    { id: 'rl-rateplans', title: 'Insurance Rate Plans', count: 0, icon: 'rateplan' },
    { id: 'rl-claims', title: 'Claims', count: 0, icon: 'claim' },
    {
      id: 'rl-coverages',
      // 9 coverage records: 3 at the policy, 2 per vehicle, 1 per driver.
      // Same set the Policy UI structure grid walks.
      title: 'Insurance Policy Coverages',
      count: 9,
      icon: 'coverage',
      columns: [
        { id: 'c1', label: 'Name' },
        { id: 'c2', label: 'Coverage Name' },
        { id: 'c3', label: 'Category' }
      ],
      rows: [
        {
          id: 'ipc-1',
          cells: [
            { id: 'v1', value: 'IPC-00000101', isLink: true },
            { id: 'v2', value: 'Bodily Injury' },
            { id: 'v3', value: 'Liability' }
          ]
        },
        {
          id: 'ipc-2',
          cells: [
            { id: 'v1', value: 'IPC-00000102', isLink: true },
            { id: 'v2', value: 'Property Damage' },
            { id: 'v3', value: 'Liability' }
          ]
        },
        {
          id: 'ipc-3',
          cells: [
            { id: 'v1', value: 'IPC-00000103', isLink: true },
            { id: 'v2', value: 'Uninsured Motorist' },
            { id: 'v3', value: 'Liability' }
          ]
        },
        {
          id: 'ipc-4',
          cells: [
            { id: 'v1', value: 'IPC-00000104', isLink: true },
            { id: 'v2', value: 'Comprehensive' },
            { id: 'v3', value: 'Physical Damage' }
          ]
        },
        {
          id: 'ipc-5',
          cells: [
            { id: 'v1', value: 'IPC-00000105', isLink: true },
            { id: 'v2', value: 'Collision' },
            { id: 'v3', value: 'Physical Damage' }
          ]
        }
      ],
      showViewAll: true
    }
  ],

  // "Policy UI" tab - Insurance Policy Structure.
  structureColumns: [
    { id: 'sc-item', label: 'Policy Line Item', isItem: true },
    { id: 'sc-product', label: 'Product' },
    { id: 'sc-start', label: 'Effective Start Date' },
    { id: 'sc-end', label: 'Effective End Date' },
    { id: 'sc-std', label: 'Total Standard Amount', isAmount: true },
    { id: 'sc-term', label: 'Total Term Amount', isAmount: true },
    { id: 'sc-stdtax', label: 'Standard Tax', isAmount: true },
    { id: 'sc-termtax', label: 'Term Tax', isAmount: true }
  ],

  structure: [
    {
      id: 'pol-root',
      label: '2025 Mavericks Auto',
      product: 'Personal Auto',
      kind: 'policy',
      start: '10/13/2025',
      end: '10/13/2026',
      standardAmount: USD(14850),
      termAmount: USD(14850),
      standardTax: ZERO,
      termTax: ZERO,
      // Coverage placement follows the Auto product model the renewal is
      // built against: Bodily Injury / Property Damage / Uninsured Motorist
      // at the policy, Comprehensive / Collision at the vehicle, Medical
      // Payments at the driver.
      children: [
        coverage('cov-bi', 'Bodily Injury', 'Liability', 4120),
        coverage('cov-pd', 'Property Damage', 'Liability', 2180),
        coverage('cov-um', 'Uninsured Motorist', 'Liability', 940),
        // James is the only rated driver on the expiring term, on both
        // vehicles. Adding a second driver is the change the renewal
        // introduces, so the prior policy has to start from one.
        asset('ast-crv', '2024 Honda CR-V EX-L', 4285, [
          coverage('cov-crv-comp', 'Comprehensive', 'Physical Damage', 1520),
          coverage('cov-crv-coll', 'Collision', 'Physical Damage', 2240),
          participant('ipp-crv-james', 'IPP-00000001', 'James Mavericks', 525, [
            coverage('cov-crv-mp', 'Medical Payments', 'Medical', 525)
          ])
        ]),
        asset('ast-camry', '2021 Toyota Camry SE', 3325, [
          coverage('cov-cam-comp', 'Comprehensive', 'Physical Damage', 1140),
          coverage('cov-cam-coll', 'Collision', 'Physical Damage', 1660),
          participant('ipp-cam-james', 'IPP-00000002', 'James Mavericks', 525, [
            coverage('cov-cam-mp', 'Medical Payments', 'Medical', 525)
          ])
        ])
      ]
    }
  ]
};

const RECORDS = {
  'pol-mav-pa-2025': MAVERICKS_PA_2025
};

/**
 * Minimal record for any policy row that has no hand-authored fixture, so
 * every row in the Insurance Policies related list still opens a coherent
 * page instead of an empty shell.
 */
function fallbackRecord(seed = {}) {
  const name = seed.name || 'Insurance Policy';
  const number = seed.number || seed.policyNumber || '';
  const premium = seed.premium || '';
  return {
    id: seed.id || 'pol-unknown',
    name,
    policyNumber: number,
    objectLabel: 'Insurance Policy',
    lob: seed.lob || '',
    loc: seed.lob || '',
    carrier: seed.carrier || '',
    status: seed.status || 'Active',
    accountId: seed.accountId || null,
    // Same six fields the hand-authored records carry, so every policy page
    // reads with one highlights strip.
    highlights: [
      { id: 'h-num', label: 'Policy Number', value: number },
      { id: 'h-status', label: 'Status', value: seed.status || 'Active' },
      { id: 'h-from', label: 'Effective From Date', value: '' },
      { id: 'h-to', label: 'Effective To Date', value: seed.expiration || '' },
      { id: 'h-prem', label: 'Premium Amount', value: premium },
      { id: 'h-freq', label: 'Premium Frequency', value: 'Annual' }
    ],
    detailSections: [
      {
        id: 'sec-policy',
        title: 'Policy Details',
        fields: [
          { id: 'f1', label: 'Policy Name', value: name },
          { id: 'f2', label: 'Policy Number', value: number },
          { id: 'f3', label: 'Status', value: seed.status || 'Active' },
          { id: 'f4', label: 'Line of Coverage', value: seed.lob || '' },
          { id: 'f5', label: 'Effective To Date', value: seed.expiration || '' },
          { id: 'f6', label: 'Premium Amount', value: premium }
        ]
      }
    ],
    relatedLists: [
      { id: 'rl-derived', title: 'Derived Policies', count: 0, icon: 'policy' },
      { id: 'rl-claims', title: 'Claims', count: 0, icon: 'claim' },
      { id: 'rl-coverages', title: 'Insurance Policy Coverages', count: 0, icon: 'coverage' }
    ],
    structureColumns: MAVERICKS_PA_2025.structureColumns,
    structure: [
      {
        id: 'pol-root',
        label: name,
        product: seed.lob || '',
        kind: 'policy',
        start: '',
        end: seed.expiration || '',
        standardAmount: premium,
        termAmount: premium,
        standardTax: '',
        termTax: '',
        children: []
      }
    ]
  };
}

/**
 * Resolve a policy record by id. `seed` is the row from the account's
 * Insurance Policies list, used to build a coherent fallback when the policy
 * has no hand-authored fixture.
 */
export function getPolicyRecord(policyId, seed) {
  return RECORDS[policyId] || fallbackRecord({ ...seed, id: policyId });
}

export function hasPolicyRecord(policyId) {
  return Boolean(RECORDS[policyId]);
}
