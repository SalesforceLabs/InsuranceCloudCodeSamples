// Mock data for Documents tab - shared across Submission and Submission Line pages

export const mockDocuments = [
  {
    id: 'doc-1',
    name: 'NexGen Biologics- 2025 Acords.pdf',
    type: 'ACORD Forms',
    uploadDate: 'May 12, 2026',
    uploadedBy: 'Niki Paoloni',
    size: '2.4 MB',
    pageCount: 47,
    status: 'Analyzed',
    insights: {
      summary: 'Comprehensive ACORD application forms for commercial insurance covering Property, General Liability, Commercial Auto, and Umbrella coverage. All forms are complete with detailed risk information.',
      keyFindings: [
        'Total Insured Value: $19,526,769 across all properties',
        'Primary Operations: Pharmaceutical manufacturing and distribution',
        'Employee Count: 285 full-time employees',
        'Annual Revenue: $47.2M (2025 fiscal year)',
        'Prior Loss History: 1 claim in past 3 years ($12,500 property damage, 2022)'
      ],
      riskFactors: [
        {
          category: 'Property',
          level: 'Medium',
          description: 'High-value equipment and inventory. Fire suppression systems in place.',
          recommendation: 'Verify maintenance records for sprinkler systems and alarm monitoring'
        },
        {
          category: 'Operations',
          level: 'Low',
          description: 'Clean safety record with minimal workers comp claims',
          recommendation: 'Continue current safety program monitoring'
        },
        {
          category: 'Auto',
          level: 'Medium',
          description: '8 vehicles with mixed use (delivery and sales)',
          recommendation: 'Review driver MVRs and confirm all drivers meet underwriting criteria'
        }
      ],
      extractedData: [
        { field: 'Business Type', value: 'Pharmaceutical Manufacturing (NAICS 325412)' },
        { field: 'Years in Business', value: '12 years' },
        { field: 'Building Construction', value: 'Fire Resistive, Sprinklered' },
        { field: 'Occupancy', value: 'Manufacturing (60%), Office (30%), Warehouse (10%)' },
        { field: 'Protection Class', value: 'Class 3' }
      ],
      missingInformation: [
        'Current property inspection report (last inspection 2023)',
        'Updated Statement of Values for new warehouse expansion',
        'Driver information for 2 newly hired sales representatives'
      ]
    }
  },
  {
    id: 'doc-2',
    name: 'SOV.xls',
    type: 'Statement of Values',
    uploadDate: 'May 12, 2026',
    uploadedBy: 'Niki Paoloni',
    size: '156 KB',
    pageCount: 3,
    status: 'Analyzed',
    insights: {
      summary: 'Statement of Values spreadsheet detailing building, contents, and business income values across 3 locations. Some discrepancies noted between ACORD forms and SOV data.',
      keyFindings: [
        'Location 1 (Main Facility): $14.2M total insured value',
        'Location 2 (Distribution Center): $3.8M total insured value',
        'Location 3 (Office): $1.5M total insured value',
        'Business Income Limit: $5.0M (12 month indemnity)',
        'Equipment Breakdown Coverage included on all locations'
      ],
      riskFactors: [
        {
          category: 'Valuation',
          level: 'High',
          description: 'Values increased 18% from prior year without explanation',
          recommendation: 'Request appraisal or detailed breakdown of value increases'
        },
        {
          category: 'Data Quality',
          level: 'Medium',
          description: 'Discrepancy between ACORD and SOV for Location 2 contents value',
          recommendation: 'Clarify correct contents value - ACORD shows $3.2M, SOV shows $3.8M'
        }
      ],
      extractedData: [
        { field: 'Total Building Value', value: '$11,200,000' },
        { field: 'Total Contents Value', value: '$7,126,769' },
        { field: 'Total BI Value', value: '$5,000,000' },
        { field: 'Blanket Limit', value: 'Yes - 100% coinsurance' },
        { field: 'Valuation Basis', value: 'Replacement Cost' }
      ],
      missingInformation: [
        'Explanation for 18% value increase year-over-year',
        'Breakdown of equipment vs inventory for contents',
        'Business Income worksheet or financial statements'
      ]
    }
  },
  {
    id: 'doc-3',
    name: 'Loss Runs 2022-2025.pdf',
    type: 'Loss History',
    uploadDate: 'May 12, 2026',
    uploadedBy: 'Maria Garcia',
    size: '890 KB',
    pageCount: 12,
    status: 'Analyzed',
    insights: {
      summary: 'Three-year loss run showing minimal claims activity. One property claim in 2022 and two small general liability claims. Overall loss ratio is favorable at 8.2%.',
      keyFindings: [
        'Total Incurred Losses: $47,300 over 3 years',
        'Total Premiums: $575,000 over 3 years',
        'Loss Ratio: 8.2% (excellent)',
        'Largest Claim: $12,500 (property damage - water leak, 2022)',
        'No Workers Compensation claims filed'
      ],
      riskFactors: [
        {
          category: 'Claims Frequency',
          level: 'Low',
          description: 'Only 3 claims in 3 years indicates good risk management',
          recommendation: 'No concerns - favorable claims history supports preferred pricing'
        }
      ],
      extractedData: [
        { field: 'Property Claims', value: '1 claim - $12,500 incurred' },
        { field: 'GL Claims', value: '2 claims - $34,800 total incurred' },
        { field: 'Auto Claims', value: '0 claims' },
        { field: 'WC Claims', value: '0 claims' },
        { field: 'Open Claims', value: 'None - all claims closed' }
      ],
      missingInformation: []
    }
  },
  {
    id: 'doc-4',
    name: 'Property Inspection Report.pdf',
    type: 'Inspection Report',
    uploadDate: 'May 12, 2026',
    uploadedBy: 'David Kim',
    size: '3.8 MB',
    pageCount: 28,
    status: 'Pending Analysis',
    insights: {
      summary: 'Document uploaded but not yet analyzed by AI agent.',
      keyFindings: [],
      riskFactors: [],
      extractedData: [],
      missingInformation: []
    }
  },
  {
    id: 'doc-5',
    name: 'Certificate of Occupancy.pdf',
    type: 'Legal Document',
    uploadDate: 'May 13, 2026',
    uploadedBy: 'Sarah Chen',
    size: '245 KB',
    pageCount: 2,
    status: 'Pending Analysis',
    insights: {
      summary: 'Document uploaded but not yet analyzed by AI agent.',
      keyFindings: [],
      riskFactors: [],
      extractedData: [],
      missingInformation: []
    }
  }
];
