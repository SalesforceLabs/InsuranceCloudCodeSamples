import { InsuranceSubmissionLine } from '@/types/InsuranceSubmission';

export const mockSubmissionLines: InsuranceSubmissionLine[] = [
  // Property LOB
  {
    id: 'a01SB00001p8B5FYAU',
    name: 'Commercial Property LOB',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'LOB',
    lineOfBusiness: 'Property',
    parentLineId: null,
    sequenceNumber: 1,
    status: 'Active',
    stage: null,
    coverageLimit: 40000000,
    deductible: null,
    premiumAllocation: 285000,
    insuredValue: 42500000,
    sublimit: null,
    description: null,
    lineAttributes: 'Policy Form: CP 00 10, Cause of Loss: Special Form, Valuation: Replacement Cost, Coinsurance: 90%',
    owner: 'Manish Arya (Underwriter)',
    createdDate: '2026-05-09T16:56:50.000Z',
    lastModifiedDate: '2026-05-09T16:56:50.000Z'
  },
  // Location 1 - Chicago Warehouse
  {
    id: 'a01SB00001p8B6rYAE',
    name: 'Location 1 - Chicago Warehouse',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Location',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001p8B5FYAU',
    sequenceNumber: 1,
    status: 'Active',
    stage: null,
    coverageLimit: 28000000,
    deductible: null,
    premiumAllocation: 185000,
    insuredValue: 28000000,
    sublimit: null,
    description: null,
    lineAttributes: 'Address: 1450 W Fulton St, City: Chicago, State: IL, Zip: 60607, County: Cook, Country: USA, Sprinklered: Yes, Fire Alarm: Yes, Security: 24/7 Guard, Occupancy Type: Cold Storage, Building Value: $28.64M, Contents Value: $6.2M, Business Income Value: $4.1M, Protection Class: 3, Construction Type: Masonry Non-Combustible, Year Built: 1998, Total Building Area: 142000 sq ft, Number of Stories: 1, Basement Type: None, Roof Type: Flat, Roof Covering: TPO Membrane, Roof Age: 6 years, Roof Condition: Good, Building Condition: Good, Wiring Type: Copper, Electrical Update Year: 2015, Plumbing Type: Copper, Heating System: Gas-Fired Unit Heaters, HVAC Age: 8 years, Exterior Wall Material: Brick, Foundation Type: Slab, Latitude: 41.8866, Longitude: -87.6593, FEMA Flood Zone: X, Distance to Coast: 687 mi, Earthquake Zone: Low, Fire Station Distance: 0.6 mi, Water Supply Type: Municipal, Building Replacement Cost: $18.4M, Wildfire Risk Score: 4, Hail Risk Zone: Moderate',
    createdDate: '2026-05-09T16:56:51.000Z',
    lastModifiedDate: '2026-05-09T16:56:51.000Z'
  },
  // L1 - Blanket Location Coverage
  {
    id: 'a01SB00001p8B8TYAU',
    name: 'L1 - Blanket Location Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001p8B6rYAE',
    sequenceNumber: 1,
    status: 'Active',
    stage: null,
    coverageLimit: 28000000,
    deductible: 50000,
    premiumAllocation: 15000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage Form: Blanket, Perils: Special Form, Deductible Type: Per Occurrence, Wind/Hail Deductible: 2% TIV',
    createdDate: '2026-05-09T16:56:53.000Z',
    lastModifiedDate: '2026-05-09T16:56:53.000Z'
  },
  // L1-B1 - Main Warehouse
  {
    id: 'a01SB00001p8BA5YAM',
    name: 'L1-B1 - Main Warehouse',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Building',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001p8B6rYAE',
    sequenceNumber: 2,
    status: 'Active',
    stage: null,
    coverageLimit: 18000000,
    deductible: 25000,
    premiumAllocation: 110000,
    insuredValue: 18000000,
    sublimit: null,
    description: null,
    lineAttributes: 'Construction Type: Masonry Non-Combustible, Year Built: 1998, Square Footage: 120000, Stories: 1, Roof Type: TPO Membrane, Roof Year: 2018, Occupancy: Warehouse/Distribution',
    createdDate: '2026-05-09T16:56:54.000Z',
    lastModifiedDate: '2026-05-09T16:56:54.000Z'
  },
  // L1-B1 - Building Coverage
  {
    id: 'a01SB00001p8BBhYAM',
    name: 'L1-B1 - Building Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001p8BA5YAM',
    sequenceNumber: 1,
    status: 'Active',
    stage: null,
    coverageLimit: 18000000,
    deductible: 25000,
    premiumAllocation: 90000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Building, Valuation: Replacement Cost, Agreed Value: Yes, Ordinance or Law: 10%',
    createdDate: '2026-05-09T16:56:55.000Z',
    lastModifiedDate: '2026-05-09T16:56:55.000Z'
  },
  // L1-B1 - Business Personal Property
  {
    id: 'a01SB00001p8BEvYAM',
    name: 'L1-B1 - Business Personal Property',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Equipment / Contents',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001p8BA5YAM',
    sequenceNumber: 2,
    status: 'Active',
    stage: null,
    coverageLimit: 4500000,
    deductible: 25000,
    premiumAllocation: 20000,
    insuredValue: 4500000,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Business Personal Property, Valuation: ACV, Peak Season Increase: 25%, Contents Type: Inventory + Equipment',
    createdDate: '2026-05-09T16:56:56.000Z',
    lastModifiedDate: '2026-05-09T16:56:56.000Z'
  },
  // L1-B2 - Loading Dock Annex
  {
    id: 'a01SB00001p8BGXYA2',
    name: 'L1-B2 - Loading Dock Annex',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Building',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001p8B6rYAE',
    sequenceNumber: 3,
    status: 'Active',
    stage: null,
    coverageLimit: 3500000,
    deductible: 25000,
    premiumAllocation: 45000,
    insuredValue: 3500000,
    sublimit: null,
    description: null,
    lineAttributes: 'Construction Type: Joisted Masonry, Year Built: 2005, Square Footage: 22000, Stories: 1, Roof Type: Built-Up, Roof Year: 2020, Occupancy: Loading/Shipping',
    createdDate: '2026-05-09T16:56:58.000Z',
    lastModifiedDate: '2026-05-09T16:56:58.000Z'
  },
  // L1-B2 - Building Coverage
  {
    id: 'a01SB00001p8BI9YAM',
    name: 'L1-B2 - Building Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001p8BGXYA2',
    sequenceNumber: 1,
    status: 'Active',
    stage: null,
    coverageLimit: 3500000,
    deductible: 25000,
    premiumAllocation: 30000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Building, Valuation: Replacement Cost, Agreed Value: No, Ordinance or Law: 10%',
    createdDate: '2026-05-09T16:56:59.000Z',
    lastModifiedDate: '2026-05-09T16:56:59.000Z'
  },
  // L1-B2 - Loading Equipment
  {
    id: 'a01SB00001p8BJlYAM',
    name: 'L1-B2 - Loading Equipment',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Equipment / Contents',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001p8BGXYA2',
    sequenceNumber: 2,
    status: 'Active',
    stage: null,
    coverageLimit: 800000,
    deductible: 10000,
    premiumAllocation: 15000,
    insuredValue: 800000,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Equipment, Valuation: Replacement Cost, Equipment Type: Dock Levelers + Conveyors, Breakdown Coverage: Yes',
    createdDate: '2026-05-09T16:57:00.000Z',
    lastModifiedDate: '2026-05-09T16:57:00.000Z'
  },
  // Location 2 - Austin Office Campus
  {
    id: 'a01SB00001p85SsYAI',
    name: 'Location 2 - Austin Office Campus',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Location',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001p8B5FYAU',
    sequenceNumber: 2,
    status: 'Active',
    stage: null,
    coverageLimit: 14500000,
    deductible: null,
    premiumAllocation: 100000,
    insuredValue: 14500000,
    sublimit: null,
    description: null,
    lineAttributes: 'Address: 500 Congress Ave, City: Austin, State: TX, Zip: 78701, Country: USA, Sprinklered: Yes, Fire Alarm: Yes, Security: Card Access + CCTV',
    createdDate: '2026-05-09T16:57:01.000Z',
    lastModifiedDate: '2026-05-09T16:57:01.000Z'
  },
  // L2 - Blanket Location Coverage
  {
    id: 'a01SB00001p8BMzYAM',
    name: 'L2 - Blanket Location Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001p85SsYAI',
    sequenceNumber: 1,
    status: 'Active',
    stage: null,
    coverageLimit: 14500000,
    deductible: 25000,
    premiumAllocation: 10000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage Form: Blanket, Perils: Special Form, Deductible Type: Per Occurrence, Flood Exclusion: Yes, Earthquake Exclusion: Yes',
    createdDate: '2026-05-09T16:57:03.000Z',
    lastModifiedDate: '2026-05-09T16:57:03.000Z'
  },
  // L2-B1 - HQ Tower
  {
    id: 'a01SB00001p8BObYAM',
    name: 'L2-B1 - HQ Tower',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Building',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001p85SsYAI',
    sequenceNumber: 2,
    status: 'Active',
    stage: null,
    coverageLimit: 8000000,
    deductible: 25000,
    premiumAllocation: 55000,
    insuredValue: 8000000,
    sublimit: null,
    description: null,
    lineAttributes: 'Construction Type: Fire Resistive, Year Built: 2010, Square Footage: 85000, Stories: 12, Roof Type: Built-Up, Roof Year: 2022, Occupancy: Office, LEED Certified: Gold',
    createdDate: '2026-05-09T16:57:04.000Z',
    lastModifiedDate: '2026-05-09T16:57:04.000Z'
  },
  // L2-B1 - Building Coverage
  {
    id: 'a01SB00001p8BQDYA2',
    name: 'L2-B1 - Building Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001p8BObYAM',
    sequenceNumber: 1,
    status: 'Active',
    stage: null,
    coverageLimit: 8000000,
    deductible: 25000,
    premiumAllocation: 40000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Building, Valuation: Replacement Cost, Agreed Value: Yes, Ordinance or Law: 25%, Glass Coverage: Full',
    createdDate: '2026-05-09T16:57:05.000Z',
    lastModifiedDate: '2026-05-09T16:57:05.000Z'
  },
  // L2-B1 - Office Contents
  {
    id: 'a01SB00001p8BRpYAM',
    name: 'L2-B1 - Office Contents',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Equipment / Contents',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001p8BObYAM',
    sequenceNumber: 2,
    status: 'Active',
    stage: null,
    coverageLimit: 1500000,
    deductible: 10000,
    premiumAllocation: 15000,
    insuredValue: 1500000,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Business Personal Property, Valuation: Replacement Cost, Contents Type: Furniture + IT + Tenant Improvements, Data Backup: Offsite',
    createdDate: '2026-05-09T16:57:06.000Z',
    lastModifiedDate: '2026-05-09T16:57:06.000Z'
  },
  // L2-B2 - R&D Lab Building
  {
    id: 'a01SB00001p8BTRYA2',
    name: 'L2-B2 - R&D Lab Building',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Building',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001p85SsYAI',
    sequenceNumber: 3,
    status: 'Active',
    stage: null,
    coverageLimit: 4200000,
    deductible: 25000,
    premiumAllocation: 30000,
    insuredValue: 4200000,
    sublimit: null,
    description: null,
    lineAttributes: 'Construction Type: Masonry Non-Combustible, Year Built: 2015, Square Footage: 32000, Stories: 3, Roof Type: EPDM, Occupancy: Laboratory/R&D, HVAC: Cleanroom Grade',
    createdDate: '2026-05-09T16:57:07.000Z',
    lastModifiedDate: '2026-05-09T16:57:07.000Z'
  },
  // L2-B2 - Building Coverage
  {
    id: 'a01SB00001p8BV3YAM',
    name: 'L2-B2 - Building Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001p8BTRYA2',
    sequenceNumber: 1,
    status: 'Active',
    stage: null,
    coverageLimit: 4200000,
    deductible: 25000,
    premiumAllocation: 20000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Building, Valuation: Replacement Cost, Agreed Value: Yes, Ordinance or Law: 15%, Mechanical Breakdown: Included',
    createdDate: '2026-05-09T16:57:09.000Z',
    lastModifiedDate: '2026-05-09T16:57:09.000Z'
  },
  // L2-B2 - Lab Equipment
  {
    id: 'a01SB00001p8AnWYAU',
    name: 'L2-B2 - Lab Equipment',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Equipment / Contents',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001p8BTRYA2',
    sequenceNumber: 2,
    status: 'Active',
    stage: null,
    coverageLimit: 2800000,
    deductible: 15000,
    premiumAllocation: 10000,
    insuredValue: 2800000,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Equipment, Valuation: Replacement Cost, Equipment Type: Lab Instruments + Servers + Cleanroom, Breakdown Coverage: Yes, Transit Coverage: Yes',
    createdDate: '2026-05-09T16:57:10.000Z',
    lastModifiedDate: '2026-05-09T16:57:10.000Z'
  },
  // L2-B3 - Parking Structure
  {
    id: 'a01SB00001p8BWfYAM',
    name: 'L2-B3 - Parking Structure',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Building',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001p85SsYAI',
    sequenceNumber: 4,
    status: 'Active',
    stage: null,
    coverageLimit: 2300000,
    deductible: 25000,
    premiumAllocation: 15000,
    insuredValue: 2300000,
    sublimit: null,
    description: null,
    lineAttributes: 'Construction Type: Fire Resistive, Year Built: 2011, Square Footage: 95000, Stories: 5, Roof Type: Open Deck, Occupancy: Parking Structure, EV Charging: 20 Stations',
    createdDate: '2026-05-09T16:57:11.000Z',
    lastModifiedDate: '2026-05-09T16:57:11.000Z'
  },
  // L2-B3 - Building Coverage
  {
    id: 'a01SB00001p8BYHYA2',
    name: 'L2-B3 - Building Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001p8BWfYAM',
    sequenceNumber: 1,
    status: 'Active',
    stage: null,
    coverageLimit: 2300000,
    deductible: 25000,
    premiumAllocation: 15000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Building, Valuation: Replacement Cost, Agreed Value: No, Ordinance or Law: 10%, Collapse Coverage: Yes',
    createdDate: '2026-05-09T16:57:13.000Z',
    lastModifiedDate: '2026-05-09T16:57:13.000Z'
  },
  // General Liability LOB
  {
    id: 'a01SB00001pGYUTYA4',
    name: 'General Liability LOB',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'LOB',
    lineOfBusiness: 'General Liability',
    parentLineId: null,
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 5000000,
    deductible: null,
    premiumAllocation: 185000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Policy Form: CG 00 01, Coverage Basis: Occurrence, Policy Term: Annual, Premium Basis: Payroll + Sales + Area',
    owner: 'David Chen (Underwriter)',
    createdDate: '2026-05-11T06:41:12.000Z',
    lastModifiedDate: '2026-05-11T06:41:12.000Z'
  },
  // Premises Operations Coverage
  {
    id: 'a01SB00001pGYW5YAO',
    name: 'Premises Operations Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'General Liability',
    parentLineId: 'a01SB00001pGYUTYA4',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 5000000,
    deductible: 10000,
    premiumAllocation: 95000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Premises & Operations, Each Occurrence: $1M, General Aggregate: $2M, Per Location Aggregate: Yes',
    createdDate: '2026-05-11T06:41:14.000Z',
    lastModifiedDate: '2026-05-11T06:41:14.000Z'
  },
  // Each Occurrence Limit
  {
    id: 'a01SB00001pGYXhYAO',
    name: 'Each Occurrence Limit',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'General Liability',
    parentLineId: 'a01SB00001pGYW5YAO',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 1000000,
    deductible: null,
    premiumAllocation: 40000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Limit Type: Per Occurrence, Coverage Trigger: Occurrence, Defense Costs: Outside Limits',
    createdDate: '2026-05-11T06:41:17.000Z',
    lastModifiedDate: '2026-05-11T06:41:17.000Z'
  },
  // General Aggregate Limit
  {
    id: 'a01SB00001pGYZJYA4',
    name: 'General Aggregate Limit',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'General Liability',
    parentLineId: 'a01SB00001pGYW5YAO',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 2000000,
    deductible: null,
    premiumAllocation: 35000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Limit Type: Aggregate, Coverage Trigger: Occurrence, Applies Per: Policy Period',
    createdDate: '2026-05-11T06:41:19.000Z',
    lastModifiedDate: '2026-05-11T06:41:19.000Z'
  },
  // Products/Completed Operations Aggregate
  {
    id: 'a01SB00001pGQ5WYAW',
    name: 'Products/Completed Operations Aggregate',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'General Liability',
    parentLineId: 'a01SB00001pGYW5YAO',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 2000000,
    deductible: null,
    premiumAllocation: 20000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Limit Type: Aggregate, Coverage: Products & Completed Operations, Extended Period: 60 months',
    createdDate: '2026-05-11T06:41:21.000Z',
    lastModifiedDate: '2026-05-11T06:41:21.000Z'
  },
  // Location 1 - Chicago Manufacturing Facility (GL)
  {
    id: 'a01SB00001pGYavYAG',
    name: 'Location 1 - Chicago Manufacturing Facility',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Location',
    lineOfBusiness: 'General Liability',
    parentLineId: 'a01SB00001pGYUTYA4',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 2000000,
    deductible: null,
    premiumAllocation: 110000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Address: 1450 W Fulton St, City: Chicago, State: IL, Zip: 60607, Facility Type: Manufacturing, Square Footage: 142000, Number of Employees: 120, Annual Visitors: 2500',
    createdDate: '2026-05-11T06:41:24.000Z',
    lastModifiedDate: '2026-05-11T06:41:24.000Z'
  },
  // L1 - Premise/Operation - Building A Manufacturing
  {
    id: 'a01SB00001pGYcXYAW',
    name: 'L1 - Premise/Operation - Building A Manufacturing',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Premise / Operation',
    lineOfBusiness: 'General Liability',
    parentLineId: 'a01SB00001pGYavYAG',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 1000000,
    deductible: 10000,
    premiumAllocation: 70000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Operation Type: Manufacturing, Payroll: $4.2M, Square Footage: 120000, Hazard Class: Moderate, Safety Program: Yes, 24/7 Operations: Yes',
    createdDate: '2026-05-11T06:41:26.000Z',
    lastModifiedDate: '2026-05-11T06:41:26.000Z'
  },
  // L1-A - Class Code 91805 - Electronic Components Mfg
  {
    id: 'a01SB00001pGYe9YAG',
    name: 'L1-A - Class Code 91805 - Electronic Components Mfg',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Class Code',
    lineOfBusiness: 'General Liability',
    parentLineId: 'a01SB00001pGYcXYAW',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 1000000,
    deductible: null,
    premiumAllocation: 55000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Class Code: 91805, Description: Electronic Components Manufacturing, Rate Basis: Payroll, Exposure: $3.5M, Rate: $1.57 per $100',
    createdDate: '2026-05-11T06:41:29.000Z',
    lastModifiedDate: '2026-05-11T06:41:29.000Z'
  },
  // L1-A - Coverage - Bodily Injury & Property Damage
  {
    id: 'a01SB00001pGYflYAG',
    name: 'L1-A - Coverage - Bodily Injury & Property Damage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'General Liability',
    parentLineId: 'a01SB00001pGYcXYAW',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 1000000,
    deductible: 10000,
    premiumAllocation: 15000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Bodily Injury & Property Damage, Per Occurrence: $1M, Per Location Aggregate: $2M, Medical Payments: $5K',
    createdDate: '2026-05-11T06:41:31.000Z',
    lastModifiedDate: '2026-05-11T06:41:31.000Z'
  },
  // L1 - Premise/Operation - Warehouse
  {
    id: 'a01SB00001pGSIcYAO',
    name: 'L1 - Premise/Operation - Warehouse',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Premise / Operation',
    lineOfBusiness: 'General Liability',
    parentLineId: 'a01SB00001pGYavYAG',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 1000000,
    deductible: 10000,
    premiumAllocation: 40000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Operation Type: Warehousing, Payroll: $700K, Square Footage: 22000, Hazard Class: Low, Forklift Operations: Yes, Loading Operations: Yes',
    createdDate: '2026-05-11T06:41:34.000Z',
    lastModifiedDate: '2026-05-11T06:41:34.000Z'
  },
  // L1-W - Class Code 92104 - Warehousing
  {
    id: 'a01SB00001pGYizYAG',
    name: 'L1-W - Class Code 92104 - Warehousing',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Class Code',
    lineOfBusiness: 'General Liability',
    parentLineId: 'a01SB00001pGSIcYAO',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 1000000,
    deductible: null,
    premiumAllocation: 30000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Class Code: 92104, Description: Warehousing & Storage, Rate Basis: Square Footage, Exposure: 22000 sq ft, Rate: $0.35 per sq ft',
    createdDate: '2026-05-11T06:41:36.000Z',
    lastModifiedDate: '2026-05-11T06:41:36.000Z'
  },
  // L1-W - Coverage - Bodily Injury & Property Damage
  {
    id: 'a01SB00001pGYkbYAG',
    name: 'L1-W - Coverage - Bodily Injury & Property Damage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'General Liability',
    parentLineId: 'a01SB00001pGSIcYAO',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 1000000,
    deductible: 10000,
    premiumAllocation: 10000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Bodily Injury & Property Damage, Per Occurrence: $1M, Per Location Aggregate: $2M, Loading/Unloading Operations: Covered',
    createdDate: '2026-05-11T06:41:39.000Z',
    lastModifiedDate: '2026-05-11T06:41:39.000Z'
  },
  // Location 2 - Austin Retail Store (GL)
  {
    id: 'a01SB00001pGYmDYAW',
    name: 'Location 2 - Austin Retail Store',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Location',
    lineOfBusiness: 'General Liability',
    parentLineId: 'a01SB00001pGYUTYA4',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 1000000,
    deductible: null,
    premiumAllocation: 45000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Address: 500 Congress Ave, City: Austin, State: TX, Zip: 78701, Facility Type: Retail, Square Footage: 8500, Number of Employees: 25, Annual Visitors: 125000',
    createdDate: '2026-05-11T06:41:41.000Z',
    lastModifiedDate: '2026-05-11T06:41:41.000Z'
  },
  // L2 - Premise/Operation - Retail Sales Floor
  {
    id: 'a01SB00001pGYnpYAG',
    name: 'L2 - Premise/Operation - Retail Sales Floor',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Premise / Operation',
    lineOfBusiness: 'General Liability',
    parentLineId: 'a01SB00001pGYmDYAW',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 1000000,
    deductible: 5000,
    premiumAllocation: 45000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Operation Type: Retail Sales, Annual Sales: $2.8M, Square Footage: 8500, Hazard Class: Low, Public Access: High, Parking Lot: Customer Access',
    createdDate: '2026-05-11T06:41:43.000Z',
    lastModifiedDate: '2026-05-11T06:41:43.000Z'
  },
  // L2 - Class Code 95132 - Retail Electronics Store
  {
    id: 'a01SB00001pGYfmYAG',
    name: 'L2 - Class Code 95132 - Retail Electronics Store',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Class Code',
    lineOfBusiness: 'General Liability',
    parentLineId: 'a01SB00001pGYnpYAG',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 1000000,
    deductible: null,
    premiumAllocation: 35000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Class Code: 95132, Description: Retail Store - Electronics, Rate Basis: Sales, Exposure: $2.8M, Rate: $0.92 per $1000 sales',
    createdDate: '2026-05-11T06:41:46.000Z',
    lastModifiedDate: '2026-05-11T06:41:46.000Z'
  },
  // L2 - Coverage - Bodily Injury & Property Damage
  {
    id: 'a01SB00001pGYpRYAW',
    name: 'L2 - Coverage - Bodily Injury & Property Damage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'General Liability',
    parentLineId: 'a01SB00001pGYnpYAG',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 1000000,
    deductible: 5000,
    premiumAllocation: 10000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Bodily Injury & Property Damage, Per Occurrence: $1M, Per Location Aggregate: $2M, Premises Medical: $10K, Slip & Fall: Covered',
    createdDate: '2026-05-11T06:41:48.000Z',
    lastModifiedDate: '2026-05-11T06:41:48.000Z'
  },
  // Products Liability Coverage
  {
    id: 'a01SB00001pGYvtYAG',
    name: 'Products Liability Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'General Liability',
    parentLineId: 'a01SB00001pGYUTYA4',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 2000000,
    deductible: 25000,
    premiumAllocation: 30000,
    insuredValue: null,
    sublimit: 500000,
    description: null,
    lineAttributes: 'Coverage: Products & Completed Operations, Aggregate Limit: $2M, Per Claim: $500K, Extended Reporting: 60 months, Territory: Worldwide excluding USA/Canada',
    createdDate: '2026-05-11T06:41:51.000Z',
    lastModifiedDate: '2026-05-11T06:41:51.000Z'
  },
  // Products Aggregate Limit
  {
    id: 'a01SB00001pGZ3xYAG',
    name: 'Products Aggregate Limit',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'General Liability',
    parentLineId: 'a01SB00001pGYvtYAG',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 2000000,
    deductible: null,
    premiumAllocation: 20000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Limit Type: Products Aggregate, Coverage Period: Annual, Reinstated: No, Retroactive Date: None',
    createdDate: '2026-05-11T06:41:53.000Z',
    lastModifiedDate: '2026-05-11T06:41:53.000Z'
  },
  // Products Per Claim Limit
  {
    id: 'a01SB00001pGZ5ZYAW',
    name: 'Products Per Claim Limit',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'General Liability',
    parentLineId: 'a01SB00001pGYvtYAG',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 500000,
    deductible: null,
    premiumAllocation: 10000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Limit Type: Per Claim, Applies To: Each Product Liability Claim, Defense Costs: Outside Limits',
    createdDate: '2026-05-11T06:41:56.000Z',
    lastModifiedDate: '2026-05-11T06:41:56.000Z'
  },
  // Additional Insured - Landlords
  {
    id: 'a01SB00001pGZ7BYAW',
    name: 'Additional Insured - Landlords',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Endorsement',
    lineOfBusiness: 'General Liability',
    parentLineId: 'a01SB00001pGYUTYA4',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: null,
    deductible: null,
    premiumAllocation: 2500,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Endorsement: CG 20 11, Description: Additional Insured - Managers or Lessors of Premises, Status: Primary, Blanket: Yes',
    createdDate: '2026-05-11T06:41:58.000Z',
    lastModifiedDate: '2026-05-11T06:41:58.000Z'
  },
  // Additional Insured - Vendors
  {
    id: 'a01SB00001pGZ8nYAG',
    name: 'Additional Insured - Vendors',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Endorsement',
    lineOfBusiness: 'General Liability',
    parentLineId: 'a01SB00001pGYUTYA4',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: null,
    deductible: null,
    premiumAllocation: 1500,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Endorsement: CG 20 15, Description: Additional Insured - Vendors, Status: Primary and Non-Contributory, Schedule: Per Contract',
    createdDate: '2026-05-11T06:42:01.000Z',
    lastModifiedDate: '2026-05-11T06:42:01.000Z'
  },
  // Waiver of Subrogation
  {
    id: 'a01SB00001pGSQgYAO',
    name: 'Waiver of Subrogation',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Endorsement',
    lineOfBusiness: 'General Liability',
    parentLineId: 'a01SB00001pGYUTYA4',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: null,
    deductible: null,
    premiumAllocation: 1000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Endorsement: CG 24 04, Description: Waiver of Transfer of Rights of Recovery Against Others To Us, Applies To: Blanket - All Contracts',
    createdDate: '2026-05-11T06:42:03.000Z',
    lastModifiedDate: '2026-05-11T06:42:03.000Z'
  },
  // Professional Liability Exclusion
  {
    id: 'a01SB00001pGYmEYAW',
    name: 'Professional Liability Exclusion',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Exclusion',
    lineOfBusiness: 'General Liability',
    parentLineId: 'a01SB00001pGYUTYA4',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: null,
    deductible: null,
    premiumAllocation: null,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Exclusion: Professional Services, Description: Excludes liability arising from rendering or failure to render professional services, Applies To: All Insureds',
    createdDate: '2026-05-11T06:42:05.000Z',
    lastModifiedDate: '2026-05-11T06:42:05.000Z'
  },
  // Pollution Exclusion
  {
    id: 'a01SB00001pGZAPYA4',
    name: 'Pollution Exclusion',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Exclusion',
    lineOfBusiness: 'General Liability',
    parentLineId: 'a01SB00001pGYUTYA4',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: null,
    deductible: null,
    premiumAllocation: null,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Exclusion: CG 21 49, Description: Total Pollution Exclusion with Hostile Fire Exception, Applies To: All Locations',
    createdDate: '2026-05-11T06:42:08.000Z',
    lastModifiedDate: '2026-05-11T06:42:08.000Z'
  },
  // Commercial Auto LOB
  {
    id: 'a01SB00001pCAUTOLOB',
    name: 'Commercial Auto LOB',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'LOB',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: null,
    sequenceNumber: 3,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 3000000,
    deductible: null,
    premiumAllocation: 285000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Policy Form: CA 00 01, Coverage Territory: USA, Policy Type: Fleet, Total Vehicles: 8, Total Drivers: 5',
    createdDate: '2026-05-11T08:15:20.000Z',
    lastModifiedDate: '2026-05-11T08:15:20.000Z'
  },
  // Vehicle 1 - 2023 Ford F-150
  {
    id: 'a01SB00001pCAV00001',
    name: 'Vehicle 1 - 2023 Ford F-150',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Vehicle',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAUTOLOB',
    sequenceNumber: 1,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: null,
    deductible: null,
    premiumAllocation: 32000,
    insuredValue: 45000,
    sublimit: null,
    description: null,
    lineAttributes: 'VIN: 1FTEW1EP5PKF12345, Year: 2023, Make: Ford, Model: F-150, Body Type: Pickup, GVW: 6500 lbs, Use: Service/Repair, Radius: Local (50 mi), Garaging Zip: 60607',
    createdDate: '2026-05-11T08:15:22.000Z',
    lastModifiedDate: '2026-05-11T08:15:22.000Z'
  },
  // V1 - Liability Coverage
  {
    id: 'a01SB00001pCAV00001L',
    name: 'V1 - Liability Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAV00001',
    sequenceNumber: 1,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 1000000,
    deductible: null,
    premiumAllocation: 8500,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Liability, Combined Single Limit: $1M, Symbol: 7 (Specific), Bodily Injury: Included, Property Damage: Included',
    createdDate: '2026-05-11T08:15:23.000Z',
    lastModifiedDate: '2026-05-11T08:15:23.000Z'
  },
  // V1 - Comprehensive Coverage
  {
    id: 'a01SB00001pCAV00001C',
    name: 'V1 - Comprehensive Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAV00001',
    sequenceNumber: 2,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 45000,
    deductible: 500,
    premiumAllocation: 3200,
    insuredValue: 45000,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Comprehensive, ACV Basis, Deductible: $500, Glass: Full Coverage',
    createdDate: '2026-05-11T08:15:24.000Z',
    lastModifiedDate: '2026-05-11T08:15:24.000Z'
  },
  // V1 - Collision Coverage
  {
    id: 'a01SB00001pCAV00001X',
    name: 'V1 - Collision Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAV00001',
    sequenceNumber: 3,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 45000,
    deductible: 1000,
    premiumAllocation: 5500,
    insuredValue: 45000,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Collision, ACV Basis, Deductible: $1,000',
    createdDate: '2026-05-11T08:15:25.000Z',
    lastModifiedDate: '2026-05-11T08:15:25.000Z'
  },
  // Vehicle 2 - 2022 Freightliner M2
  {
    id: 'a01SB00001pCAV00002',
    name: 'Vehicle 2 - 2022 Freightliner M2',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Vehicle',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAUTOLOB',
    sequenceNumber: 2,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: null,
    deductible: null,
    premiumAllocation: 48000,
    insuredValue: 125000,
    sublimit: null,
    description: null,
    lineAttributes: 'VIN: 3ALACWDC2NDHE6789, Year: 2022, Make: Freightliner, Model: M2 106, Body Type: Box Truck, GVW: 26000 lbs, Use: Delivery, Radius: Intermediate (200 mi), Garaging Zip: 60607',
    createdDate: '2026-05-11T08:15:26.000Z',
    lastModifiedDate: '2026-05-11T08:15:26.000Z'
  },
  // V2 - Liability Coverage
  {
    id: 'a01SB00001pCAV00002L',
    name: 'V2 - Liability Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAV00002',
    sequenceNumber: 1,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 1000000,
    deductible: null,
    premiumAllocation: 15000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Liability, Combined Single Limit: $1M, Symbol: 7, Bodily Injury: Included, Property Damage: Included',
    createdDate: '2026-05-11T08:15:27.000Z',
    lastModifiedDate: '2026-05-11T08:15:27.000Z'
  },
  // V2 - Comprehensive Coverage
  {
    id: 'a01SB00001pCAV00002C',
    name: 'V2 - Comprehensive Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAV00002',
    sequenceNumber: 2,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 125000,
    deductible: 1000,
    premiumAllocation: 8500,
    insuredValue: 125000,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Comprehensive, ACV Basis, Deductible: $1,000',
    createdDate: '2026-05-11T08:15:28.000Z',
    lastModifiedDate: '2026-05-11T08:15:28.000Z'
  },
  // V2 - Collision Coverage
  {
    id: 'a01SB00001pCAV00002X',
    name: 'V2 - Collision Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAV00002',
    sequenceNumber: 3,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 125000,
    deductible: 2500,
    premiumAllocation: 12000,
    insuredValue: 125000,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Collision, ACV Basis, Deductible: $2,500',
    createdDate: '2026-05-11T08:15:29.000Z',
    lastModifiedDate: '2026-05-11T08:15:29.000Z'
  },
  // V2 - Cargo Coverage
  {
    id: 'a01SB00001pCAV00002G',
    name: 'V2 - Cargo Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAV00002',
    sequenceNumber: 4,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 100000,
    deductible: 2500,
    premiumAllocation: 12500,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Cargo, Limit: $100K per load, Deductible: $2,500, Commodity: General Freight',
    createdDate: '2026-05-11T08:15:30.000Z',
    lastModifiedDate: '2026-05-11T08:15:30.000Z'
  },
  // Vehicle 3 - 2021 Chevrolet Silverado 1500
  {
    id: 'a01SB00001pCAV00003',
    name: 'Vehicle 3 - 2021 Chevrolet Silverado 1500',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Vehicle',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAUTOLOB',
    sequenceNumber: 3,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: null,
    deductible: null,
    premiumAllocation: 28000,
    insuredValue: 38000,
    sublimit: null,
    description: null,
    lineAttributes: 'VIN: 1GCUDDED7MZ123456, Year: 2021, Make: Chevrolet, Model: Silverado 1500, Body Type: Pickup, GVW: 7000 lbs, Use: Service/Repair, Radius: Local (50 mi), Garaging Zip: 60612',
    createdDate: '2026-05-11T08:15:31.000Z',
    lastModifiedDate: '2026-05-11T08:15:31.000Z'
  },
  // V3 - Liability Coverage
  {
    id: 'a01SB00001pCAV00003L',
    name: 'V3 - Liability Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAV00003',
    sequenceNumber: 1,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 1000000,
    deductible: null,
    premiumAllocation: 7500,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Liability, Combined Single Limit: $1M, Symbol: 7',
    createdDate: '2026-05-11T08:15:32.000Z',
    lastModifiedDate: '2026-05-11T08:15:32.000Z'
  },
  // V3 - Comprehensive Coverage
  {
    id: 'a01SB00001pCAV00003C',
    name: 'V3 - Comprehensive Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAV00003',
    sequenceNumber: 2,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 38000,
    deductible: 500,
    premiumAllocation: 2800,
    insuredValue: 38000,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Comprehensive, ACV Basis, Deductible: $500',
    createdDate: '2026-05-11T08:15:33.000Z',
    lastModifiedDate: '2026-05-11T08:15:33.000Z'
  },
  // V3 - Collision Coverage
  {
    id: 'a01SB00001pCAV00003X',
    name: 'V3 - Collision Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAV00003',
    sequenceNumber: 3,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 38000,
    deductible: 1000,
    premiumAllocation: 4800,
    insuredValue: 38000,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Collision, ACV Basis, Deductible: $1,000',
    createdDate: '2026-05-11T08:15:34.000Z',
    lastModifiedDate: '2026-05-11T08:15:34.000Z'
  },
  // Vehicle 4 - 2024 Ford Transit 350
  {
    id: 'a01SB00001pCAV00004',
    name: 'Vehicle 4 - 2024 Ford Transit 350',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Vehicle',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAUTOLOB',
    sequenceNumber: 4,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: null,
    deductible: null,
    premiumAllocation: 35000,
    insuredValue: 52000,
    sublimit: null,
    description: null,
    lineAttributes: 'VIN: 1FBAX2CM6PKA98765, Year: 2024, Make: Ford, Model: Transit 350, Body Type: Cargo Van, GVW: 9500 lbs, Use: Delivery, Radius: Local (50 mi), Garaging Zip: 60607',
    createdDate: '2026-05-11T08:15:35.000Z',
    lastModifiedDate: '2026-05-11T08:15:35.000Z'
  },
  // V4 - Liability Coverage
  {
    id: 'a01SB00001pCAV00004L',
    name: 'V4 - Liability Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAV00004',
    sequenceNumber: 1,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 1000000,
    deductible: null,
    premiumAllocation: 9500,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Liability, Combined Single Limit: $1M, Symbol: 7',
    createdDate: '2026-05-11T08:15:36.000Z',
    lastModifiedDate: '2026-05-11T08:15:36.000Z'
  },
  // V4 - Comprehensive Coverage
  {
    id: 'a01SB00001pCAV00004C',
    name: 'V4 - Comprehensive Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAV00004',
    sequenceNumber: 2,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 52000,
    deductible: 500,
    premiumAllocation: 3800,
    insuredValue: 52000,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Comprehensive, ACV Basis, Deductible: $500',
    createdDate: '2026-05-11T08:15:37.000Z',
    lastModifiedDate: '2026-05-11T08:15:37.000Z'
  },
  // V4 - Collision Coverage
  {
    id: 'a01SB00001pCAV00004X',
    name: 'V4 - Collision Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAV00004',
    sequenceNumber: 3,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 52000,
    deductible: 1000,
    premiumAllocation: 6200,
    insuredValue: 52000,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Collision, ACV Basis, Deductible: $1,000',
    createdDate: '2026-05-11T08:15:38.000Z',
    lastModifiedDate: '2026-05-11T08:15:38.000Z'
  },
  // Vehicle 5 - 2023 Ram ProMaster 3500
  {
    id: 'a01SB00001pCAV00005',
    name: 'Vehicle 5 - 2023 Ram ProMaster 3500',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Vehicle',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAUTOLOB',
    sequenceNumber: 5,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: null,
    deductible: null,
    premiumAllocation: 33000,
    insuredValue: 48000,
    sublimit: null,
    description: null,
    lineAttributes: 'VIN: 3C6URVJG5PE567890, Year: 2023, Make: Ram, Model: ProMaster 3500, Body Type: Cargo Van, GVW: 9350 lbs, Use: Delivery, Radius: Local (50 mi), Garaging Zip: 60612',
    createdDate: '2026-05-11T08:15:39.000Z',
    lastModifiedDate: '2026-05-11T08:15:39.000Z'
  },
  // V5 - Liability Coverage
  {
    id: 'a01SB00001pCAV00005L',
    name: 'V5 - Liability Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAV00005',
    sequenceNumber: 1,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 1000000,
    deductible: null,
    premiumAllocation: 8800,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Liability, Combined Single Limit: $1M, Symbol: 7',
    createdDate: '2026-05-11T08:15:40.000Z',
    lastModifiedDate: '2026-05-11T08:15:40.000Z'
  },
  // V5 - Comprehensive Coverage
  {
    id: 'a01SB00001pCAV00005C',
    name: 'V5 - Comprehensive Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAV00005',
    sequenceNumber: 2,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 48000,
    deductible: 500,
    premiumAllocation: 3500,
    insuredValue: 48000,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Comprehensive, ACV Basis, Deductible: $500',
    createdDate: '2026-05-11T08:15:41.000Z',
    lastModifiedDate: '2026-05-11T08:15:41.000Z'
  },
  // V5 - Collision Coverage
  {
    id: 'a01SB00001pCAV00005X',
    name: 'V5 - Collision Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAV00005',
    sequenceNumber: 3,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 48000,
    deductible: 1000,
    premiumAllocation: 5700,
    insuredValue: 48000,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Collision, ACV Basis, Deductible: $1,000',
    createdDate: '2026-05-11T08:15:42.000Z',
    lastModifiedDate: '2026-05-11T08:15:42.000Z'
  },
  // Driver 1 - Michael Anderson
  {
    id: 'a01SB00001pCAD00001',
    name: 'Driver 1 - Michael Anderson',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Driver',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAUTOLOB',
    sequenceNumber: 1,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: null,
    deductible: null,
    premiumAllocation: 18000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'DOB: 1985-03-15, License: D123456789, State: IL, CDL: Yes, Years Experience: 15, Accidents: 0, Violations: 0, Assigned Vehicles: V2, V4',
    createdDate: '2026-05-11T08:15:43.000Z',
    lastModifiedDate: '2026-05-11T08:15:43.000Z'
  },
  // Driver 2 - Jennifer Martinez
  {
    id: 'a01SB00001pCAD00002',
    name: 'Driver 2 - Jennifer Martinez',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Driver',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAUTOLOB',
    sequenceNumber: 2,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: null,
    deductible: null,
    premiumAllocation: 12000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'DOB: 1990-07-22, License: D987654321, State: IL, CDL: No, Years Experience: 8, Accidents: 0, Violations: 1 (Speeding - 2 years ago), Assigned Vehicles: V1, V5',
    createdDate: '2026-05-11T08:15:44.000Z',
    lastModifiedDate: '2026-05-11T08:15:44.000Z'
  },
  // Driver 3 - Robert Johnson
  {
    id: 'a01SB00001pCAD00003',
    name: 'Driver 3 - Robert Johnson',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Driver',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAUTOLOB',
    sequenceNumber: 3,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: null,
    deductible: null,
    premiumAllocation: 15000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'DOB: 1978-11-08, License: D456789123, State: IL, CDL: Yes, Years Experience: 22, Accidents: 1 (Not-at-fault - 4 years ago), Violations: 0, Assigned Vehicles: V2',
    createdDate: '2026-05-11T08:15:45.000Z',
    lastModifiedDate: '2026-05-11T08:15:45.000Z'
  },
  // Driver 4 - Sarah Thompson
  {
    id: 'a01SB00001pCAD00004',
    name: 'Driver 4 - Sarah Thompson',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Driver',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAUTOLOB',
    sequenceNumber: 4,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: null,
    deductible: null,
    premiumAllocation: 10000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'DOB: 1995-02-18, License: D741852963, State: IL, CDL: No, Years Experience: 5, Accidents: 0, Violations: 0, Assigned Vehicles: V3, V4',
    createdDate: '2026-05-11T08:15:46.000Z',
    lastModifiedDate: '2026-05-11T08:15:46.000Z'
  },
  // Driver 5 - David Chen
  {
    id: 'a01SB00001pCAD00005',
    name: 'Driver 5 - David Chen',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Driver',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAUTOLOB',
    sequenceNumber: 5,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: null,
    deductible: null,
    premiumAllocation: 11000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'DOB: 1988-09-30, License: D159753486, State: IL, CDL: No, Years Experience: 10, Accidents: 0, Violations: 0, Assigned Vehicles: V1, V3, V5',
    createdDate: '2026-05-11T08:15:47.000Z',
    lastModifiedDate: '2026-05-11T08:15:47.000Z'
  },
  // Fleet-Level Coverages
  // Medical Payments Coverage
  {
    id: 'a01SB00001pCAFLTMED',
    name: 'Medical Payments Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAUTOLOB',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 5000,
    deductible: null,
    premiumAllocation: 8000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Medical Payments, Limit: $5K per person, Applies To: All Vehicles',
    createdDate: '2026-05-11T08:15:48.000Z',
    lastModifiedDate: '2026-05-11T08:15:48.000Z'
  },
  // Uninsured/Underinsured Motorist Coverage
  {
    id: 'a01SB00001pCAFLTUIM',
    name: 'Uninsured/Underinsured Motorist Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAUTOLOB',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 1000000,
    deductible: null,
    premiumAllocation: 22000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: UM/UIM, Combined Single Limit: $1M, Per Accident, Stacking: Not Allowed, Applies To: All Vehicles',
    createdDate: '2026-05-11T08:15:49.000Z',
    lastModifiedDate: '2026-05-11T08:15:49.000Z'
  },
  // Hired & Non-Owned Auto Coverage
  {
    id: 'a01SB00001pCAFLTHNO',
    name: 'Hired & Non-Owned Auto Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Commercial Auto',
    parentLineId: 'a01SB00001pCAUTOLOB',
    sequenceNumber: null,
    status: 'Active',
    stage: 'New Submission',
    coverageLimit: 1000000,
    deductible: null,
    premiumAllocation: 15000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Hired & Non-Owned, Combined Single Limit: $1M, Cost of Hire: $50K max',
    createdDate: '2026-05-11T08:15:50.000Z',
    lastModifiedDate: '2026-05-11T08:15:50.000Z'
  },

  // ============================================================================
  // DUPLICATE LOCATIONS - San Jose Manufacturing Campus
  // These two locations have similar addresses and overlapping buildings
  // ============================================================================

  // Location 3A - San Jose Manufacturing Campus (First Instance)
  {
    id: 'a01SB00001pDUP3A',
    name: 'Location 3A - San Jose Manufacturing Campus',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Location',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001p8B5FYAU',
    sequenceNumber: 3,
    status: 'Active',
    stage: null,
    coverageLimit: 32000000,
    deductible: null,
    premiumAllocation: 220000,
    insuredValue: 32000000,
    sublimit: null,
    description: null,
    lineAttributes: 'Address: 2500 Augustine Dr, City: San Jose, State: CA, Zip: 95054, Country: USA, Sprinklered: Yes, Fire Alarm: Yes, Security: 24/7 Security + CCTV',
    createdDate: '2026-05-09T16:58:00.000Z',
    lastModifiedDate: '2026-05-09T16:58:00.000Z'
  },

  // L3A - Blanket Location Coverage
  {
    id: 'a01SB00001pDUP3AB',
    name: 'L3A - Blanket Location Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001pDUP3A',
    sequenceNumber: 1,
    status: 'Active',
    stage: null,
    coverageLimit: 32000000,
    deductible: 50000,
    premiumAllocation: 20000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage Form: Blanket, Perils: Special Form, Deductible Type: Per Occurrence, Wind/Hail Deductible: 2% TIV',
    createdDate: '2026-05-09T16:58:01.000Z',
    lastModifiedDate: '2026-05-09T16:58:01.000Z'
  },

  // L3A-B1 - Manufacturing Building A
  {
    id: 'a01SB00001pDUP3AB1',
    name: 'L3A-B1 - Manufacturing Building A',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Building',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001pDUP3A',
    sequenceNumber: 2,
    status: 'Active',
    stage: null,
    coverageLimit: 15000000,
    deductible: 50000,
    premiumAllocation: 95000,
    insuredValue: 15000000,
    sublimit: null,
    description: null,
    lineAttributes: 'Construction Type: Fire Resistive, Year Built: 2008, Square Footage: 145000, Stories: 2, Roof Type: TPO Membrane, Roof Year: 2020, Occupancy: Manufacturing',
    createdDate: '2026-05-09T16:58:02.000Z',
    lastModifiedDate: '2026-05-09T16:58:02.000Z'
  },

  // L3A-B1 - Building Coverage
  {
    id: 'a01SB00001pDUP3AB1C',
    name: 'L3A-B1 - Building Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001pDUP3AB1',
    sequenceNumber: 1,
    status: 'Active',
    stage: null,
    coverageLimit: 15000000,
    deductible: 50000,
    premiumAllocation: 75000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Building, Valuation: Replacement Cost, Agreed Value: Yes, Ordinance or Law: 15%',
    createdDate: '2026-05-09T16:58:03.000Z',
    lastModifiedDate: '2026-05-09T16:58:03.000Z'
  },

  // L3A-B1 - Manufacturing Equipment
  {
    id: 'a01SB00001pDUP3AB1E',
    name: 'L3A-B1 - Manufacturing Equipment',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Equipment / Contents',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001pDUP3AB1',
    sequenceNumber: 2,
    status: 'Active',
    stage: null,
    coverageLimit: 5200000,
    deductible: 50000,
    premiumAllocation: 20000,
    insuredValue: 5200000,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Manufacturing Equipment, Valuation: Replacement Cost, Equipment Type: CNC Machines + Assembly Lines, Breakdown Coverage: Yes',
    createdDate: '2026-05-09T16:58:04.000Z',
    lastModifiedDate: '2026-05-09T16:58:04.000Z'
  },

  // L3A-B2 - Quality Control Lab
  {
    id: 'a01SB00001pDUP3AB2',
    name: 'L3A-B2 - Quality Control Lab',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Building',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001pDUP3A',
    sequenceNumber: 3,
    status: 'Active',
    stage: null,
    coverageLimit: 6500000,
    deductible: 50000,
    premiumAllocation: 45000,
    insuredValue: 6500000,
    sublimit: null,
    description: null,
    lineAttributes: 'Construction Type: Masonry Non-Combustible, Year Built: 2012, Square Footage: 42000, Stories: 1, Roof Type: Built-Up, Roof Year: 2021, Occupancy: Laboratory/Testing',
    createdDate: '2026-05-09T16:58:05.000Z',
    lastModifiedDate: '2026-05-09T16:58:05.000Z'
  },

  // L3A-B2 - Building Coverage
  {
    id: 'a01SB00001pDUP3AB2C',
    name: 'L3A-B2 - Building Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001pDUP3AB2',
    sequenceNumber: 1,
    status: 'Active',
    stage: null,
    coverageLimit: 6500000,
    deductible: 50000,
    premiumAllocation: 35000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Building, Valuation: Replacement Cost, Agreed Value: Yes',
    createdDate: '2026-05-09T16:58:06.000Z',
    lastModifiedDate: '2026-05-09T16:58:06.000Z'
  },

  // L3A-B2 - Lab Equipment
  {
    id: 'a01SB00001pDUP3AB2E',
    name: 'L3A-B2 - Lab Equipment',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Equipment / Contents',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001pDUP3AB2',
    sequenceNumber: 2,
    status: 'Active',
    stage: null,
    coverageLimit: 2800000,
    deductible: 50000,
    premiumAllocation: 10000,
    insuredValue: 2800000,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Laboratory Equipment, Valuation: ACV, Equipment Type: Testing Equipment + Microscopes + Analyzers',
    createdDate: '2026-05-09T16:58:07.000Z',
    lastModifiedDate: '2026-05-09T16:58:07.000Z'
  },

  // L3A-B3 - Warehouse & Distribution
  {
    id: 'a01SB00001pDUP3AB3',
    name: 'L3A-B3 - Warehouse & Distribution',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Building',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001pDUP3A',
    sequenceNumber: 4,
    status: 'Active',
    stage: null,
    coverageLimit: 8200000,
    deductible: 50000,
    premiumAllocation: 60000,
    insuredValue: 8200000,
    sublimit: null,
    description: null,
    lineAttributes: 'Construction Type: Joisted Masonry, Year Built: 2010, Square Footage: 95000, Stories: 1, Roof Type: TPO, Roof Year: 2019, Occupancy: Warehouse/Distribution',
    createdDate: '2026-05-09T16:58:08.000Z',
    lastModifiedDate: '2026-05-09T16:58:08.000Z'
  },

  // L3A-B3 - Building Coverage
  {
    id: 'a01SB00001pDUP3AB3C',
    name: 'L3A-B3 - Building Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001pDUP3AB3',
    sequenceNumber: 1,
    status: 'Active',
    stage: null,
    coverageLimit: 8200000,
    deductible: 50000,
    premiumAllocation: 45000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Building, Valuation: Replacement Cost, Agreed Value: Yes',
    createdDate: '2026-05-09T16:58:09.000Z',
    lastModifiedDate: '2026-05-09T16:58:09.000Z'
  },

  // L3A-B3 - Inventory & Equipment
  {
    id: 'a01SB00001pDUP3AB3E',
    name: 'L3A-B3 - Inventory & Equipment',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Equipment / Contents',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001pDUP3AB3',
    sequenceNumber: 2,
    status: 'Active',
    stage: null,
    coverageLimit: 6800000,
    deductible: 50000,
    premiumAllocation: 15000,
    insuredValue: 6800000,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Business Personal Property, Valuation: ACV, Contents Type: Inventory + Forklifts + Conveyors, Peak Season Increase: 30%',
    createdDate: '2026-05-09T16:58:10.000Z',
    lastModifiedDate: '2026-05-09T16:58:10.000Z'
  },

  // ============================================================================
  // Location 3B - San Jose Manufacturing Facility (Second Instance - Duplicate)
  // Similar address, overlapping buildings B1 and B3
  // ============================================================================

  {
    id: 'a01SB00001pDUP3B',
    name: 'Location 3B - San Jose Manufacturing Facility',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Location',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001p8B5FYAU',
    sequenceNumber: 4,
    status: 'Active',
    stage: null,
    coverageLimit: 29500000,
    deductible: null,
    premiumAllocation: 205000,
    insuredValue: 29500000,
    sublimit: null,
    description: null,
    lineAttributes: 'Address: 2500 Augustine Drive, City: San Jose, State: California, Zip: 95054, Country: USA, Sprinklered: Full System, Fire Alarm: Central Station, Security: 24-Hour Guard + Video Surveillance',
    createdDate: '2026-05-09T16:58:20.000Z',
    lastModifiedDate: '2026-05-09T16:58:20.000Z'
  },

  // L3B - Blanket Location Coverage
  {
    id: 'a01SB00001pDUP3BB',
    name: 'L3B - Blanket Location Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001pDUP3B',
    sequenceNumber: 1,
    status: 'Active',
    stage: null,
    coverageLimit: 29500000,
    deductible: 50000,
    premiumAllocation: 18000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage Form: Blanket, Perils: All Risk, Deductible Type: Per Occurrence, Wind/Hail Deductible: 2%',
    createdDate: '2026-05-09T16:58:21.000Z',
    lastModifiedDate: '2026-05-09T16:58:21.000Z'
  },

  // L3B-B1 - Manufacturing Facility Building A (Overlaps with L3A-B1)
  {
    id: 'a01SB00001pDUP3BB1',
    name: 'L3B-B1 - Manufacturing Facility Building A',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Building',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001pDUP3B',
    sequenceNumber: 2,
    status: 'Active',
    stage: null,
    coverageLimit: 14800000,
    deductible: 50000,
    premiumAllocation: 92000,
    insuredValue: 14800000,
    sublimit: null,
    description: null,
    lineAttributes: 'Construction Type: Fire Resistive, Year Built: 2008, Square Footage: 148000, Stories: 2, Roof Type: TPO, Roof Year: 2020, Occupancy: Manufacturing/Production',
    createdDate: '2026-05-09T16:58:22.000Z',
    lastModifiedDate: '2026-05-09T16:58:22.000Z'
  },

  // L3B-B1 - Building Coverage
  {
    id: 'a01SB00001pDUP3BB1C',
    name: 'L3B-B1 - Building Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001pDUP3BB1',
    sequenceNumber: 1,
    status: 'Active',
    stage: null,
    coverageLimit: 14800000,
    deductible: 50000,
    premiumAllocation: 73000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Building, Valuation: Replacement Cost, Agreed Value: Yes, Ordinance or Law: 15%',
    createdDate: '2026-05-09T16:58:23.000Z',
    lastModifiedDate: '2026-05-09T16:58:23.000Z'
  },

  // L3B-B1 - Production Equipment (Overlaps with L3A-B1 Equipment)
  {
    id: 'a01SB00001pDUP3BB1E',
    name: 'L3B-B1 - Production Equipment',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Equipment / Contents',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001pDUP3BB1',
    sequenceNumber: 2,
    status: 'Active',
    stage: null,
    coverageLimit: 5100000,
    deductible: 50000,
    premiumAllocation: 19000,
    insuredValue: 5100000,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Manufacturing Equipment, Valuation: Replacement Cost, Equipment Type: CNC Machinery + Production Lines, Breakdown Coverage: Included',
    createdDate: '2026-05-09T16:58:24.000Z',
    lastModifiedDate: '2026-05-09T16:58:24.000Z'
  },

  // L3B-B3 - Distribution Center (Overlaps with L3A-B3)
  {
    id: 'a01SB00001pDUP3BB3',
    name: 'L3B-B3 - Distribution Center',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Building',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001pDUP3B',
    sequenceNumber: 3,
    status: 'Active',
    stage: null,
    coverageLimit: 8000000,
    deductible: 50000,
    premiumAllocation: 58000,
    insuredValue: 8000000,
    sublimit: null,
    description: null,
    lineAttributes: 'Construction Type: Joisted Masonry, Year Built: 2010, Square Footage: 92000, Stories: 1, Roof Type: TPO Membrane, Roof Year: 2019, Occupancy: Warehouse',
    createdDate: '2026-05-09T16:58:25.000Z',
    lastModifiedDate: '2026-05-09T16:58:25.000Z'
  },

  // L3B-B3 - Building Coverage
  {
    id: 'a01SB00001pDUP3BB3C',
    name: 'L3B-B3 - Building Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001pDUP3BB3',
    sequenceNumber: 1,
    status: 'Active',
    stage: null,
    coverageLimit: 8000000,
    deductible: 50000,
    premiumAllocation: 43000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Building, Valuation: Replacement Cost, Agreed Value: Yes',
    createdDate: '2026-05-09T16:58:26.000Z',
    lastModifiedDate: '2026-05-09T16:58:26.000Z'
  },

  // L3B-B3 - Warehouse Contents (Overlaps with L3A-B3 Equipment)
  {
    id: 'a01SB00001pDUP3BB3E',
    name: 'L3B-B3 - Warehouse Contents',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Equipment / Contents',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001pDUP3BB3',
    sequenceNumber: 2,
    status: 'Active',
    stage: null,
    coverageLimit: 6500000,
    deductible: 50000,
    premiumAllocation: 14000,
    insuredValue: 6500000,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Business Personal Property, Valuation: ACV, Contents Type: Finished Goods Inventory + Material Handling Equipment, Peak Season Increase: 25%',
    createdDate: '2026-05-09T16:58:27.000Z',
    lastModifiedDate: '2026-05-09T16:58:27.000Z'
  },

  // L3B-B4 - Administrative Office
  {
    id: 'a01SB00001pDUP3BB4',
    name: 'L3B-B4 - Administrative Office',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Building',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001pDUP3B',
    sequenceNumber: 4,
    status: 'Active',
    stage: null,
    coverageLimit: 3500000,
    deductible: 25000,
    premiumAllocation: 22000,
    insuredValue: 3500000,
    sublimit: null,
    description: null,
    lineAttributes: 'Construction Type: Masonry Non-Combustible, Year Built: 2015, Square Footage: 28000, Stories: 3, Roof Type: Built-Up, Roof Year: 2022, Occupancy: Office',
    createdDate: '2026-05-09T16:58:28.000Z',
    lastModifiedDate: '2026-05-09T16:58:28.000Z'
  },

  // L3B-B4 - Building Coverage
  {
    id: 'a01SB00001pDUP3BB4C',
    name: 'L3B-B4 - Building Coverage',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Coverage',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001pDUP3BB4',
    sequenceNumber: 1,
    status: 'Active',
    stage: null,
    coverageLimit: 3500000,
    deductible: 25000,
    premiumAllocation: 18000,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Building, Valuation: Replacement Cost',
    createdDate: '2026-05-09T16:58:29.000Z',
    lastModifiedDate: '2026-05-09T16:58:29.000Z'
  },

  // L3B-B4 - Office Contents
  {
    id: 'a01SB00001pDUP3BB4E',
    name: 'L3B-B4 - Office Contents',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Equipment / Contents',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001pDUP3BB4',
    sequenceNumber: 2,
    status: 'Active',
    stage: null,
    coverageLimit: 800000,
    deductible: 25000,
    premiumAllocation: 4000,
    insuredValue: 800000,
    sublimit: null,
    description: null,
    lineAttributes: 'Coverage: Business Personal Property, Valuation: Replacement Cost, Contents Type: Furniture + IT Equipment',
    createdDate: '2026-05-09T16:58:30.000Z',
    lastModifiedDate: '2026-05-09T16:58:30.000Z'
  },

  // ── Location 5A / 5B — Austin duplicate pair with IDENTICAL mapped values ──
  // Every mapped canonical term matches across the two lines, so the Resolve
  // Duplicates comparison shows only "matching" rows — selecting "Differences"
  // yields the empty-state message.
  {
    id: 'a01SB00001pDUP5A',
    name: 'Location 5A - Austin Distribution Center',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Location',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001p8B5FYAU',
    sequenceNumber: 5,
    status: 'Active',
    stage: null,
    coverageLimit: 18000000,
    deductible: null,
    premiumAllocation: 120000,
    insuredValue: 18000000,
    sublimit: null,
    description: null,
    lineAttributes: 'Address: 4200 Industrial Blvd, City: Austin, State: TX, Zip: 78744, Country: USA, Sprinklered: Yes, Fire Alarm: Yes, Security: 24/7 Security + CCTV',
    createdDate: '2026-05-09T16:58:40.000Z',
    lastModifiedDate: '2026-05-09T16:58:40.000Z'
  },
  {
    id: 'a01SB00001pDUP5B',
    name: 'Location 5B - Austin Warehouse Facility',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Location',
    lineOfBusiness: 'Property',
    parentLineId: 'a01SB00001p8B5FYAU',
    sequenceNumber: 6,
    status: 'Active',
    stage: null,
    coverageLimit: 18000000,
    deductible: null,
    premiumAllocation: 120000,
    insuredValue: 18000000,
    sublimit: null,
    description: null,
    lineAttributes: 'Address: 4200 Industrial Blvd, City: Austin, State: TX, Zip: 78744, Country: USA, Sprinklered: Yes, Fire Alarm: Yes, Security: 24/7 Security + CCTV',
    createdDate: '2026-05-09T16:58:41.000Z',
    lastModifiedDate: '2026-05-09T16:58:41.000Z'
  },

  // ── Submission Parties ──────────────────────────────────────────────
  // Party records surface in the "Submission Parties" tab using the same
  // submission-lines grid as Lines of Business. Accounts are root siblings;
  // each Account has one Contact child.

  // Account 1 — Named Insured
  {
    id: 'a01SBPARTY0ACC01',
    name: 'NexGen Biologics Inc',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Account',
    lineOfBusiness: 'Parties',
    parentLineId: null,
    sequenceNumber: 1,
    status: 'Active',
    stage: null,
    coverageLimit: null,
    deductible: null,
    premiumAllocation: null,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Account Name: NexGen Biologics Inc, Account Type: Named Insured, DBA: NexGen Bio, Legal Entity: Corporation, Tax ID: 84-3921004, DUNS Number: 07-284-9931, Industry: Biotechnology, SIC Code: 2836, NAICS Code: 325414, Website: nexgenbio.com, Billing Street: 1450 W Fulton St, Billing City: Chicago, Billing State: IL, Billing Zip: 60607, Phone: (312) 555-0142, Annual Revenue: $84M, Employees: 320, Year Established: 2009',
    owner: 'Martha (UW Team Lead)',
    createdDate: '2026-05-09T16:59:00.000Z',
    lastModifiedDate: '2026-05-09T16:59:00.000Z'
  },
  // Account 1 → Contact
  {
    id: 'a01SBPARTY0CON01',
    name: 'Dr. Elena Vasquez',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Contact',
    lineOfBusiness: 'Parties',
    parentLineId: 'a01SBPARTY0ACC01',
    sequenceNumber: 1,
    status: 'Active',
    stage: null,
    coverageLimit: null,
    deductible: null,
    premiumAllocation: null,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'First Name: Elena, Last Name: Vasquez, Title: Chief Risk Officer, Contact Role: Primary Contact, Email: evasquez@nexgenbio.com, Phone: (312) 555-0148, Mobile: (312) 555-0199, Mailing Street: 1450 W Fulton St, Mailing City: Chicago, Mailing State: IL, Mailing Zip: 60607, Preferred Contact Method: Email',
    owner: 'Martha (UW Team Lead)',
    createdDate: '2026-05-09T16:59:01.000Z',
    lastModifiedDate: '2026-05-09T16:59:01.000Z'
  },

  // Account 2 — Parent Company
  {
    id: 'a01SBPARTY0ACC02',
    name: 'Vanguard Insurance Partners',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Account',
    lineOfBusiness: 'Parties',
    parentLineId: null,
    sequenceNumber: 2,
    status: 'Active',
    stage: null,
    coverageLimit: null,
    deductible: null,
    premiumAllocation: null,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'Account Name: Vanguard Insurance Partners, Account Type: Broker, DBA: Vanguard, Legal Entity: LLC, Tax ID: 47-1180265, DUNS Number: 14-902-6650, Industry: Insurance Brokerage, SIC Code: 6411, NAICS Code: 524210, Website: vanguardip.com, Billing Street: 200 S Wacker Dr, Billing City: Chicago, Billing State: IL, Billing Zip: 60606, Phone: (312) 555-0300, Annual Revenue: $52M, Employees: 140, Year Established: 1998',
    owner: 'Martha (UW Team Lead)',
    createdDate: '2026-05-09T16:59:02.000Z',
    lastModifiedDate: '2026-05-09T16:59:02.000Z'
  },
  // Account 2 → Contact
  {
    id: 'a01SBPARTY0CON02',
    name: 'Niki Paoloni',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Contact',
    lineOfBusiness: 'Parties',
    parentLineId: 'a01SBPARTY0ACC02',
    sequenceNumber: 1,
    status: 'Active',
    stage: null,
    coverageLimit: null,
    deductible: null,
    premiumAllocation: null,
    insuredValue: null,
    sublimit: null,
    description: null,
    lineAttributes: 'First Name: Niki, Last Name: Paoloni, Title: Senior Account Broker, Contact Role: Producing Broker, Email: npaoloni@vanguardip.com, Phone: (312) 555-0312, Mobile: (312) 555-0355, Mailing Street: 200 S Wacker Dr, Mailing City: Chicago, Mailing State: IL, Mailing Zip: 60606, Preferred Contact Method: Phone',
    owner: 'Martha (UW Team Lead)',
    createdDate: '2026-05-09T16:59:03.000Z',
    lastModifiedDate: '2026-05-09T16:59:03.000Z'
  },

  // ── Shared Locations ────────────────────────────────────────────────
  // Locations shared across lines of business. Rendered in the "Shared
  // Locations" tab as a flat list (no hierarchy) using the same grid as
  // Submission Parties / Lines of business.
  {
    id: 'a01SBSHLOC01',
    name: 'Location 1 - Chicago HQ Warehouse',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Location',
    lineOfBusiness: 'Shared Locations',
    parentLineId: null,
    sequenceNumber: 1,
    status: 'Active',
    stage: null,
    coverageLimit: null,
    deductible: null,
    premiumAllocation: null,
    insuredValue: 12500000,
    sublimit: null,
    description: null,
    lineAttributes: 'Street Address: 1450 W Fulton St, City: Chicago, State: IL, Zip: 60607, Country: USA, Construction Type: Masonry Non-Combustible, Year Built: 2004, Square Footage: 82000, Number of Stories: 2, Occupancy Type: Warehouse, Sprinklered: Full, Fire Alarm: Central Station, Security: 24/7 Guard, Building Value: $12.5M',
    owner: 'Martha (UW Team Lead)',
    createdDate: '2026-05-09T16:59:04.000Z',
    lastModifiedDate: '2026-05-09T16:59:04.000Z'
  },
  {
    id: 'a01SBSHLOC02',
    name: 'Location 2 - Austin Distribution Center',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Location',
    lineOfBusiness: 'Shared Locations',
    parentLineId: null,
    sequenceNumber: 2,
    status: 'Active',
    stage: null,
    coverageLimit: null,
    deductible: null,
    premiumAllocation: null,
    insuredValue: 8200000,
    sublimit: null,
    description: null,
    lineAttributes: 'Street Address: 5600 E Ben White Blvd, City: Austin, State: TX, Zip: 78741, Country: USA, Construction Type: Fire Resistive, Year Built: 2015, Square Footage: 64000, Number of Stories: 1, Occupancy Type: Distribution, Sprinklered: Full, Fire Alarm: Central Station, Security: Card Access, Building Value: $8.2M',
    owner: 'Martha (UW Team Lead)',
    createdDate: '2026-05-09T16:59:05.000Z',
    lastModifiedDate: '2026-05-09T16:59:05.000Z'
  },
  {
    id: 'a01SBSHLOC03',
    name: 'Location 3 - San Jose R&D Lab',
    insuranceSubmissionId: 'a00SB00001ARehdYAD',
    lineType: 'Location',
    lineOfBusiness: 'Shared Locations',
    parentLineId: null,
    sequenceNumber: 3,
    status: 'Active',
    stage: null,
    coverageLimit: null,
    deductible: null,
    premiumAllocation: null,
    insuredValue: 15800000,
    sublimit: null,
    description: null,
    lineAttributes: 'Street Address: 2811 Zanker Rd, City: San Jose, State: CA, Zip: 95134, Country: USA, Construction Type: Fire Resistive, Year Built: 2018, Square Footage: 48000, Number of Stories: 3, Occupancy Type: Laboratory, Sprinklered: Full, Fire Alarm: Central Station, Security: 24/7 Guard, Building Value: $15.8M',
    owner: 'Martha (UW Team Lead)',
    createdDate: '2026-05-09T16:59:06.000Z',
    lastModifiedDate: '2026-05-09T16:59:06.000Z'
  }
];

const SUBMISSION_LINE_KEY_PREFIX = 'submissionLine_';

const readLineOverride = (lineId: string): Partial<InsuranceSubmissionLine> | null => {
  if (typeof window === 'undefined') return null;
  try {
    // Session-scoped only — survives in-page navigation, dies on full reload.
    const raw = window.sessionStorage.getItem(`${SUBMISSION_LINE_KEY_PREFIX}${lineId}`);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<InsuranceSubmissionLine>;
  } catch {
    return null;
  }
};

export const applyLineOverrides = (lines: InsuranceSubmissionLine[]): InsuranceSubmissionLine[] => {
  if (typeof window === 'undefined') return lines;
  return lines.map((l) => {
    const override = readLineOverride(l.id);
    return override ? { ...l, ...override } : l;
  });
};

export const getMergedSubmissionLine = (lineId: string): InsuranceSubmissionLine | null => {
  const base = mockSubmissionLines.find((l) => l.id === lineId) || null;
  if (!base) return null;
  const override = readLineOverride(lineId);
  return override ? { ...base, ...override } : base;
};

// ---------------------------------------------------------------------------
// Product Mapping — sellable products modeled as Salesforce Product Catalog
// Manager (PCM) bundles. Each sellable product is a configurable Product2
// bundle whose components (Location / Building / Equipment / Coverage) are
// themselves products, organized into ProductComponentGroups with cardinality
// (ProductRelatedComponent) and carrying product attributes
// (ProductAttributeDefinition). Consumed by ProductMappingContainer.
//
// Property LOB only. Worked example: NexGen Biologics (a00SB00001ARehdYAD).
// Scores follow the Product Fit Scoring PRD's 4-tier waterfall — the three
// surfaced sub-scores are Tier 2 (Attribute Presence), Tier 3 (Coverage
// Density), Tier 4 (Coverage Attribute).
// ---------------------------------------------------------------------------

/** Three-state attribute classification (PRD §6.1). */
export type ProductAttrStatus = 'present' | 'missing' | 'unmapped';

export interface ProductAttribute {
  attribute: string;
  /** Value on the submission line (empty for missing/unmapped). */
  value: string;
  /** The single canonical source selected for this attribute (empty when not present). */
  source: string;
  status: ProductAttrStatus;
}

export type ProductNodeType =
  | 'Location'
  | 'Building'
  | 'Equipment / Contents'
  | 'Coverage';

// A node in a sellable product's OWN hierarchy (an LOB-style tree of Location →
// Building → Equipment/Coverage component products). Submission lines are mapped
// against these product nodes by role; the product owns the structure, so a
// submission line with no matching product node simply doesn't appear here.
export interface ProductNode {
  id: string;
  name: string;
  nodeType: ProductNodeType;
  /** Salesforce ProductClassification the component product derives from. */
  classification: string;
  parentId: string | null;
  /** ProductRelatedComponent cardinality. */
  cardinality?: { required: boolean; defaultQty: number; min: number; max: number | null };
  attributes?: ProductAttribute[];
}

export interface SellableProduct {
  id: string;
  name: string;
  /** ProductClassification the bundle is built from. */
  classification: string;
  recommended: boolean;
  outcome: 'Assigned' | 'Triaged' | 'Unmatched';
  summary: string;
  scores: { attributePresence: number; coverageDensity: number; coverageAttribute: number };
  /** The product's own hierarchy (roots have parentId null). */
  structure: ProductNode[];
  /** Submission lines with no matching product node (surfaced in the "Missing" section). */
  missingLines: string[];
}

const req = (defaultQty = 1, min = 1, max: number | null = 1) => ({ required: true, defaultQty, min, max });
const opt = (defaultQty = 1, min = 0, max: number | null = 1) => ({ required: false, defaultQty, min, max });

// Node-type → default ProductClassification (surfaced as the table's 2nd column).
const CLS_LOCATION = 'Commercial Property Location';
const CLS_BUILDING = 'Commercial Building';
const CLS_CONTENTS = 'Business Personal Property';
const CLS_COVERAGE = 'Property Coverage';

// Compact attribute builders — product nodes carry the same name as the
// submission line they map to, with a representative set of mapped attributes.
type A = ProductAttribute;
// Each builder mixes the PRD's three attribute statuses (§6.1): present (value +
// selected canonical source), missing (mapped to a canonical term but no value
// on the line — source retained, value blank), and unmapped (no canonical
// binding — both value and source blank).
const locAttrs = (addr: string, city: string, st: string, zip: string, pc: string): A[] => [
  { attribute: 'Address', value: addr, source: 'ACORD 140', status: 'present' },
  { attribute: 'City', value: city, source: 'ACORD 140', status: 'present' },
  { attribute: 'State', value: st, source: 'ACORD 140', status: 'present' },
  { attribute: 'ZIP', value: zip, source: 'ACORD 140', status: 'present' },
  { attribute: 'Protection Class', value: pc, source: 'ISO', status: 'present' },
  { attribute: 'Sprinklered', value: 'Yes', source: 'ACORD 140', status: 'present' },
  { attribute: 'Distance to Fire Station', value: '', source: '', status: 'missing' },
  { attribute: 'FEMA Flood Zone', value: '', source: '', status: 'unmapped' },
];
const bldAttrs = (occ: string, con: string, yr: string, sqft: string, val: string): A[] => [
  { attribute: 'Occupancy Type', value: occ, source: 'ACORD 140', status: 'present' },
  { attribute: 'Construction Type', value: con, source: 'ACORD 140', status: 'present' },
  { attribute: 'Year Built', value: yr, source: 'ACORD 140', status: 'present' },
  { attribute: 'Square Footage', value: sqft, source: 'Statement of Values', status: 'present' },
  { attribute: 'Building Value', value: val, source: 'Statement of Values', status: 'present' },
  { attribute: 'Number of Stories', value: '', source: '', status: 'missing' },
  { attribute: 'Roof Age', value: '', source: '', status: 'unmapped' },
];
const covAttrs = (form: string, col: string, val: string, ded: string, limit: string): A[] => [
  { attribute: 'Policy Form', value: form, source: 'ACORD 125', status: 'present' },
  { attribute: 'Cause of Loss', value: col, source: 'ACORD 125', status: 'present' },
  { attribute: 'Valuation', value: val, source: 'ACORD 125', status: 'present' },
  { attribute: 'Deductible', value: ded, source: 'ACORD 140', status: 'present' },
  { attribute: 'Limit', value: limit, source: 'Statement of Values', status: 'present' },
  { attribute: 'Coinsurance', value: '', source: '', status: 'missing' },
  { attribute: 'Waiting Period', value: '', source: '', status: 'unmapped' },
];
const conAttrs = (cval: string): A[] => [
  { attribute: 'Contents Value', value: cval, source: 'Statement of Values', status: 'present' },
  { attribute: 'Valuation', value: 'Replacement Cost', source: 'ACORD 125', status: 'present' },
  { attribute: 'Business Income Value', value: '', source: '', status: 'missing' },
  { attribute: 'Equipment Type', value: '', source: '', status: 'unmapped' },
];

// Location-level blanket coverage attribute set.
const blanketAttrs = (limit: string): A[] => [
  { attribute: 'Coverage Form', value: 'Blanket', source: 'ACORD 125', status: 'present' },
  { attribute: 'Valuation', value: 'Replacement Cost', source: 'ACORD 125', status: 'present' },
  { attribute: 'Limit', value: limit, source: 'Statement of Values', status: 'present' },
  { attribute: 'Coinsurance', value: '', source: '', status: 'missing' },
  { attribute: 'Deductible', value: '', source: '', status: 'unmapped' },
];

// Product nodes carry the SAME name as the submission line they map to. Each
// product below owns its own hierarchy and covers a different subset of the
// submission's Locations / Buildings / Equipment / Coverages.

// The submission's Property LOB has four distinct locations (the 3A/3B and
// 5A/5B potential-duplicate pairs are deduped to 3A + 5A). Across them:
// 8 buildings, 7 equipment/contents lines, 11 coverages.

// ── Product 1 — Commercial Property — Standard (best fit, Assigned) ──────────
// Covers all Locations, Buildings and Equipment, plus ~80% of the Coverages
// (excludes the L2-B3 and L3A-B3 building coverages → 9 of 11).
const p1: SellableProduct = {
  id: 'prod-commprop-standard',
  name: 'Commercial Property — Standard',
  classification: 'Commercial Property Package',
  recommended: true,
  outcome: 'Assigned',
  summary:
    'Every Location, Building and Equipment line on the submission maps to a matching product component, and Property attributes (Square Footage, Year Built, Construction Type, Occupancy) are all present. About 80% of the submission’s coverages are covered by the bundle. Recommended for auto-assignment.',
  scores: { attributePresence: 94, coverageDensity: 88, coverageAttribute: 82 },
  structure: [
    { id: 'p1-loc1', name: 'Location 1 - Chicago Warehouse', nodeType: 'Location', classification: CLS_LOCATION, parentId: null, cardinality: req(1, 1, null), attributes: locAttrs('1450 W Fulton St', 'Chicago', 'IL', '60607', '3') },
    { id: 'p1-loc1-cov', name: 'L1 - Blanket Location Coverage', nodeType: 'Coverage', classification: CLS_COVERAGE, parentId: 'p1-loc1', cardinality: opt(1, 0, 1), attributes: blanketAttrs('$34.0M') },
    { id: 'p1-loc1-b1', name: 'L1-B1 - Main Warehouse', nodeType: 'Building', classification: CLS_BUILDING, parentId: 'p1-loc1', cardinality: req(1, 1, null), attributes: bldAttrs('Cold Storage', 'Masonry Non-Combustible', '1998', '142,000 sq ft', '$28.64M') },
    { id: 'p1-loc1-b1-cov', name: 'L1-B1 - Building Coverage', nodeType: 'Coverage', classification: CLS_COVERAGE, parentId: 'p1-loc1-b1', cardinality: req(1, 1, 3), attributes: covAttrs('CP 00 10', 'Special Form', 'Replacement Cost', '$25,000', '$28.0M') },
    { id: 'p1-loc1-b1-bpp', name: 'L1-B1 - Business Personal Property', nodeType: 'Equipment / Contents', classification: CLS_CONTENTS, parentId: 'p1-loc1-b1', cardinality: opt(1, 0, null), attributes: conAttrs('$6.2M') },
    { id: 'p1-loc1-b2', name: 'L1-B2 - Loading Dock Annex', nodeType: 'Building', classification: CLS_BUILDING, parentId: 'p1-loc1', cardinality: opt(1, 0, null), attributes: bldAttrs('Warehouse', 'Masonry Non-Combustible', '2004', '38,000 sq ft', '$7.9M') },
    { id: 'p1-loc1-b2-cov', name: 'L1-B2 - Building Coverage', nodeType: 'Coverage', classification: CLS_COVERAGE, parentId: 'p1-loc1-b2', cardinality: req(1, 1, 3), attributes: covAttrs('CP 00 10', 'Special Form', 'Replacement Cost', '$25,000', '$7.9M') },
    { id: 'p1-loc1-b2-eq', name: 'L1-B2 - Loading Equipment', nodeType: 'Equipment / Contents', classification: CLS_CONTENTS, parentId: 'p1-loc1-b2', cardinality: opt(1, 0, null), attributes: conAttrs('$1.8M') },
    { id: 'p1-loc2', name: 'Location 2 - Austin Office Campus', nodeType: 'Location', classification: CLS_LOCATION, parentId: null, cardinality: opt(1, 0, null), attributes: locAttrs('2200 Metric Blvd', 'Austin', 'TX', '78758', '2') },
    { id: 'p1-loc2-cov', name: 'L2 - Blanket Location Coverage', nodeType: 'Coverage', classification: CLS_COVERAGE, parentId: 'p1-loc2', cardinality: opt(1, 0, 1), attributes: blanketAttrs('$73.4M') },
    { id: 'p1-loc2-b1', name: 'L2-B1 - HQ Tower', nodeType: 'Building', classification: CLS_BUILDING, parentId: 'p1-loc2', cardinality: req(1, 1, null), attributes: bldAttrs('Office', 'Fire Resistive', '2012', '96,500 sq ft', '$41.2M') },
    { id: 'p1-loc2-b1-cov', name: 'L2-B1 - Building Coverage', nodeType: 'Coverage', classification: CLS_COVERAGE, parentId: 'p1-loc2-b1', cardinality: req(1, 1, 3), attributes: covAttrs('CP 00 10', 'Special Form', 'Replacement Cost', '$25,000', '$41.2M') },
    { id: 'p1-loc2-b1-con', name: 'L2-B1 - Office Contents', nodeType: 'Equipment / Contents', classification: CLS_CONTENTS, parentId: 'p1-loc2-b1', cardinality: opt(1, 0, null), attributes: conAttrs('$12.4M') },
    { id: 'p1-loc2-b2', name: 'L2-B2 - R&D Lab Building', nodeType: 'Building', classification: CLS_BUILDING, parentId: 'p1-loc2', cardinality: opt(1, 0, null), attributes: bldAttrs('Laboratory', 'Fire Resistive', '2015', '54,000 sq ft', '$22.8M') },
    { id: 'p1-loc2-b2-cov', name: 'L2-B2 - Building Coverage', nodeType: 'Coverage', classification: CLS_COVERAGE, parentId: 'p1-loc2-b2', cardinality: req(1, 1, 3), attributes: covAttrs('CP 00 10', 'Special Form', 'Replacement Cost', '$25,000', '$22.8M') },
    { id: 'p1-loc2-b2-eq', name: 'L2-B2 - Lab Equipment', nodeType: 'Equipment / Contents', classification: CLS_CONTENTS, parentId: 'p1-loc2-b2', cardinality: opt(1, 0, null), attributes: conAttrs('$8.6M') },
    { id: 'p1-loc2-b3', name: 'L2-B3 - Parking Structure', nodeType: 'Building', classification: CLS_BUILDING, parentId: 'p1-loc2', cardinality: opt(1, 0, null), attributes: bldAttrs('Parking', 'Reinforced Concrete', '2010', '120,000 sq ft', '$9.4M') },
    // L2-B3 - Building Coverage intentionally excluded.
    { id: 'p1-loc3', name: 'Location 3A - San Jose Manufacturing Campus', nodeType: 'Location', classification: CLS_LOCATION, parentId: null, cardinality: opt(1, 0, null), attributes: locAttrs('2500 Augustine Dr', 'San Jose', 'CA', '95054', '2') },
    { id: 'p1-loc3-cov', name: 'L3A - Blanket Location Coverage', nodeType: 'Coverage', classification: CLS_COVERAGE, parentId: 'p1-loc3', cardinality: opt(1, 0, 1), attributes: blanketAttrs('$32.0M') },
    { id: 'p1-loc3-b1', name: 'L3A-B1 - Manufacturing Building A', nodeType: 'Building', classification: CLS_BUILDING, parentId: 'p1-loc3', cardinality: req(1, 1, null), attributes: bldAttrs('Manufacturing', 'Fire Resistive', '2008', '145,000 sq ft', '$15.0M') },
    { id: 'p1-loc3-b1-cov', name: 'L3A-B1 - Building Coverage', nodeType: 'Coverage', classification: CLS_COVERAGE, parentId: 'p1-loc3-b1', cardinality: req(1, 1, 3), attributes: covAttrs('CP 00 10', 'Special Form', 'Replacement Cost', '$50,000', '$15.0M') },
    { id: 'p1-loc3-b1-eq', name: 'L3A-B1 - Manufacturing Equipment', nodeType: 'Equipment / Contents', classification: CLS_CONTENTS, parentId: 'p1-loc3-b1', cardinality: opt(1, 0, null), attributes: conAttrs('$5.2M') },
    { id: 'p1-loc3-b2', name: 'L3A-B2 - Quality Control Lab', nodeType: 'Building', classification: CLS_BUILDING, parentId: 'p1-loc3', cardinality: opt(1, 0, null), attributes: bldAttrs('Laboratory/Testing', 'Masonry Non-Combustible', '2012', '42,000 sq ft', '$6.5M') },
    { id: 'p1-loc3-b2-cov', name: 'L3A-B2 - Building Coverage', nodeType: 'Coverage', classification: CLS_COVERAGE, parentId: 'p1-loc3-b2', cardinality: req(1, 1, 3), attributes: covAttrs('CP 00 10', 'Special Form', 'Replacement Cost', '$50,000', '$6.5M') },
    { id: 'p1-loc3-b2-eq', name: 'L3A-B2 - Lab Equipment', nodeType: 'Equipment / Contents', classification: CLS_CONTENTS, parentId: 'p1-loc3-b2', cardinality: opt(1, 0, null), attributes: conAttrs('$2.8M') },
    { id: 'p1-loc3-b3', name: 'L3A-B3 - Warehouse & Distribution', nodeType: 'Building', classification: CLS_BUILDING, parentId: 'p1-loc3', cardinality: opt(1, 0, null), attributes: bldAttrs('Warehouse/Distribution', 'Joisted Masonry', '2010', '95,000 sq ft', '$8.2M') },
    { id: 'p1-loc3-b3-eq', name: 'L3A-B3 - Inventory & Equipment', nodeType: 'Equipment / Contents', classification: CLS_CONTENTS, parentId: 'p1-loc3-b3', cardinality: opt(1, 0, null), attributes: conAttrs('$6.8M') },
    // L3A-B3 - Building Coverage intentionally excluded.
    { id: 'p1-loc5', name: 'Location 5A - Austin Distribution Center', nodeType: 'Location', classification: CLS_LOCATION, parentId: null, cardinality: opt(1, 0, null), attributes: locAttrs('4200 Industrial Blvd', 'Austin', 'TX', '78744', '3') },
  ],
  missingLines: ['L2-B3 - Building Coverage', 'L3A-B3 - Building Coverage'],
};

// ── Product 2 — Commercial Property — Manufacturing & Cold Storage (Triaged) ─
// Covers all Locations, Buildings and Equipment, but only ~60% of the coverages
// (excludes the L1-B2, L2-B2, L2-B3 and L3A-B3 building coverages → 7 of 11).
const p2: SellableProduct = {
  id: 'prod-commprop-mfg',
  name: 'Commercial Property — Manufacturing & Cold Storage',
  classification: 'Manufacturing Property Package',
  recommended: false,
  outcome: 'Triaged',
  summary:
    'Cold Storage occupancy and high Contents values fit the manufacturing template, and all Location / Building / Equipment lines map. Only ~60% of the submission’s coverages are covered by the bundle — four building coverages have no matching product component. Route to triage to confirm coverage before assignment.',
  scores: { attributePresence: 86, coverageDensity: 79, coverageAttribute: 74 },
  structure: [
    { id: 'p2-loc1', name: 'Location 1 - Chicago Warehouse', nodeType: 'Location', classification: CLS_LOCATION, parentId: null, cardinality: req(1, 1, null), attributes: locAttrs('1450 W Fulton St', 'Chicago', 'IL', '60607', '3') },
    { id: 'p2-loc1-cov', name: 'L1 - Blanket Location Coverage', nodeType: 'Coverage', classification: CLS_COVERAGE, parentId: 'p2-loc1', cardinality: opt(1, 0, 1), attributes: blanketAttrs('$34.0M') },
    { id: 'p2-loc1-b1', name: 'L1-B1 - Main Warehouse', nodeType: 'Building', classification: CLS_BUILDING, parentId: 'p2-loc1', cardinality: req(1, 1, null), attributes: bldAttrs('Cold Storage', 'Masonry Non-Combustible', '1998', '142,000 sq ft', '$28.64M') },
    { id: 'p2-loc1-b1-cov', name: 'L1-B1 - Building Coverage', nodeType: 'Coverage', classification: CLS_COVERAGE, parentId: 'p2-loc1-b1', cardinality: req(1, 1, 3), attributes: covAttrs('CP 00 10', 'Special Form', 'Replacement Cost', '$25,000', '$28.0M') },
    { id: 'p2-loc1-b1-bpp', name: 'L1-B1 - Business Personal Property', nodeType: 'Equipment / Contents', classification: CLS_CONTENTS, parentId: 'p2-loc1-b1', cardinality: opt(1, 0, null), attributes: conAttrs('$6.2M') },
    { id: 'p2-loc1-b2', name: 'L1-B2 - Loading Dock Annex', nodeType: 'Building', classification: CLS_BUILDING, parentId: 'p2-loc1', cardinality: opt(1, 0, null), attributes: bldAttrs('Warehouse', 'Masonry Non-Combustible', '2004', '38,000 sq ft', '$7.9M') },
    { id: 'p2-loc1-b2-eq', name: 'L1-B2 - Loading Equipment', nodeType: 'Equipment / Contents', classification: CLS_CONTENTS, parentId: 'p2-loc1-b2', cardinality: opt(1, 0, null), attributes: conAttrs('$1.8M') },
    { id: 'p2-loc2', name: 'Location 2 - Austin Office Campus', nodeType: 'Location', classification: CLS_LOCATION, parentId: null, cardinality: opt(1, 0, null), attributes: locAttrs('2200 Metric Blvd', 'Austin', 'TX', '78758', '2') },
    { id: 'p2-loc2-cov', name: 'L2 - Blanket Location Coverage', nodeType: 'Coverage', classification: CLS_COVERAGE, parentId: 'p2-loc2', cardinality: opt(1, 0, 1), attributes: blanketAttrs('$73.4M') },
    { id: 'p2-loc2-b1', name: 'L2-B1 - HQ Tower', nodeType: 'Building', classification: CLS_BUILDING, parentId: 'p2-loc2', cardinality: req(1, 1, null), attributes: bldAttrs('Office', 'Fire Resistive', '2012', '96,500 sq ft', '$41.2M') },
    { id: 'p2-loc2-b1-cov', name: 'L2-B1 - Building Coverage', nodeType: 'Coverage', classification: CLS_COVERAGE, parentId: 'p2-loc2-b1', cardinality: req(1, 1, 3), attributes: covAttrs('CP 00 10', 'Special Form', 'Replacement Cost', '$25,000', '$41.2M') },
    { id: 'p2-loc2-b1-con', name: 'L2-B1 - Office Contents', nodeType: 'Equipment / Contents', classification: CLS_CONTENTS, parentId: 'p2-loc2-b1', cardinality: opt(1, 0, null), attributes: conAttrs('$12.4M') },
    { id: 'p2-loc2-b2', name: 'L2-B2 - R&D Lab Building', nodeType: 'Building', classification: CLS_BUILDING, parentId: 'p2-loc2', cardinality: opt(1, 0, null), attributes: bldAttrs('Laboratory', 'Fire Resistive', '2015', '54,000 sq ft', '$22.8M') },
    { id: 'p2-loc2-b2-eq', name: 'L2-B2 - Lab Equipment', nodeType: 'Equipment / Contents', classification: CLS_CONTENTS, parentId: 'p2-loc2-b2', cardinality: opt(1, 0, null), attributes: conAttrs('$8.6M') },
    { id: 'p2-loc2-b3', name: 'L2-B3 - Parking Structure', nodeType: 'Building', classification: CLS_BUILDING, parentId: 'p2-loc2', cardinality: opt(1, 0, null), attributes: bldAttrs('Parking', 'Reinforced Concrete', '2010', '120,000 sq ft', '$9.4M') },
    { id: 'p2-loc3', name: 'Location 3A - San Jose Manufacturing Campus', nodeType: 'Location', classification: CLS_LOCATION, parentId: null, cardinality: opt(1, 0, null), attributes: locAttrs('2500 Augustine Dr', 'San Jose', 'CA', '95054', '2') },
    { id: 'p2-loc3-cov', name: 'L3A - Blanket Location Coverage', nodeType: 'Coverage', classification: CLS_COVERAGE, parentId: 'p2-loc3', cardinality: opt(1, 0, 1), attributes: blanketAttrs('$32.0M') },
    { id: 'p2-loc3-b1', name: 'L3A-B1 - Manufacturing Building A', nodeType: 'Building', classification: CLS_BUILDING, parentId: 'p2-loc3', cardinality: req(1, 1, null), attributes: bldAttrs('Manufacturing', 'Fire Resistive', '2008', '145,000 sq ft', '$15.0M') },
    { id: 'p2-loc3-b1-cov', name: 'L3A-B1 - Building Coverage', nodeType: 'Coverage', classification: CLS_COVERAGE, parentId: 'p2-loc3-b1', cardinality: req(1, 1, 3), attributes: covAttrs('CP 00 10', 'Special Form', 'Replacement Cost', '$50,000', '$15.0M') },
    { id: 'p2-loc3-b1-eq', name: 'L3A-B1 - Manufacturing Equipment', nodeType: 'Equipment / Contents', classification: CLS_CONTENTS, parentId: 'p2-loc3-b1', cardinality: opt(1, 0, null), attributes: conAttrs('$5.2M') },
    { id: 'p2-loc3-b2', name: 'L3A-B2 - Quality Control Lab', nodeType: 'Building', classification: CLS_BUILDING, parentId: 'p2-loc3', cardinality: opt(1, 0, null), attributes: bldAttrs('Laboratory/Testing', 'Masonry Non-Combustible', '2012', '42,000 sq ft', '$6.5M') },
    { id: 'p2-loc3-b2-eq', name: 'L3A-B2 - Lab Equipment', nodeType: 'Equipment / Contents', classification: CLS_CONTENTS, parentId: 'p2-loc3-b2', cardinality: opt(1, 0, null), attributes: conAttrs('$2.8M') },
    { id: 'p2-loc3-b3', name: 'L3A-B3 - Warehouse & Distribution', nodeType: 'Building', classification: CLS_BUILDING, parentId: 'p2-loc3', cardinality: opt(1, 0, null), attributes: bldAttrs('Warehouse/Distribution', 'Joisted Masonry', '2010', '95,000 sq ft', '$8.2M') },
    { id: 'p2-loc3-b3-eq', name: 'L3A-B3 - Inventory & Equipment', nodeType: 'Equipment / Contents', classification: CLS_CONTENTS, parentId: 'p2-loc3-b3', cardinality: opt(1, 0, null), attributes: conAttrs('$6.8M') },
    { id: 'p2-loc5', name: 'Location 5A - Austin Distribution Center', nodeType: 'Location', classification: CLS_LOCATION, parentId: null, cardinality: opt(1, 0, null), attributes: locAttrs('4200 Industrial Blvd', 'Austin', 'TX', '78744', '3') },
    // L1-B2, L2-B2, L2-B3 and L3A-B3 building coverages intentionally excluded.
  ],
  missingLines: ['L1-B2 - Building Coverage', 'L2-B2 - Building Coverage', 'L2-B3 - Building Coverage', 'L3A-B3 - Building Coverage'],
};

// ── Product 3 — Commercial Property — Buildings Only (Unmatched) ─────────────
// Excludes Equipment / Contents lines and their sub-nodes entirely, and keeps
// ~70% of the coverages (excludes the L1-B2, L2-B3 and L3A-B3 building
// coverages → 8 of 11).
const p3: SellableProduct = {
  id: 'prod-commprop-buildings-only',
  name: 'Commercial Property — Buildings Only',
  classification: 'Buildings-Only Property Package',
  recommended: false,
  outcome: 'Unmatched',
  summary:
    'This bundle has no Equipment / Contents components, so every equipment and contents line on the submission is unmatched, and only ~70% of coverages map. Structural fit is weak for a submission with significant business personal property; not recommended.',
  scores: { attributePresence: 58, coverageDensity: 52, coverageAttribute: 44 },
  structure: [
    { id: 'p3-loc1', name: 'Location 1 - Chicago Warehouse', nodeType: 'Location', classification: CLS_LOCATION, parentId: null, cardinality: req(1, 1, null), attributes: locAttrs('1450 W Fulton St', 'Chicago', 'IL', '60607', '3') },
    { id: 'p3-loc1-cov', name: 'L1 - Blanket Location Coverage', nodeType: 'Coverage', classification: CLS_COVERAGE, parentId: 'p3-loc1', cardinality: opt(1, 0, 1), attributes: blanketAttrs('$34.0M') },
    { id: 'p3-loc1-b1', name: 'L1-B1 - Main Warehouse', nodeType: 'Building', classification: CLS_BUILDING, parentId: 'p3-loc1', cardinality: req(1, 1, null), attributes: bldAttrs('Cold Storage', 'Masonry Non-Combustible', '1998', '142,000 sq ft', '$28.64M') },
    { id: 'p3-loc1-b1-cov', name: 'L1-B1 - Building Coverage', nodeType: 'Coverage', classification: CLS_COVERAGE, parentId: 'p3-loc1-b1', cardinality: req(1, 1, 3), attributes: covAttrs('CP 00 10', 'Special Form', 'Replacement Cost', '$25,000', '$28.0M') },
    { id: 'p3-loc1-b2', name: 'L1-B2 - Loading Dock Annex', nodeType: 'Building', classification: CLS_BUILDING, parentId: 'p3-loc1', cardinality: opt(1, 0, null), attributes: bldAttrs('Warehouse', 'Masonry Non-Combustible', '2004', '38,000 sq ft', '$7.9M') },
    { id: 'p3-loc2', name: 'Location 2 - Austin Office Campus', nodeType: 'Location', classification: CLS_LOCATION, parentId: null, cardinality: opt(1, 0, null), attributes: locAttrs('2200 Metric Blvd', 'Austin', 'TX', '78758', '2') },
    { id: 'p3-loc2-cov', name: 'L2 - Blanket Location Coverage', nodeType: 'Coverage', classification: CLS_COVERAGE, parentId: 'p3-loc2', cardinality: opt(1, 0, 1), attributes: blanketAttrs('$73.4M') },
    { id: 'p3-loc2-b1', name: 'L2-B1 - HQ Tower', nodeType: 'Building', classification: CLS_BUILDING, parentId: 'p3-loc2', cardinality: req(1, 1, null), attributes: bldAttrs('Office', 'Fire Resistive', '2012', '96,500 sq ft', '$41.2M') },
    { id: 'p3-loc2-b1-cov', name: 'L2-B1 - Building Coverage', nodeType: 'Coverage', classification: CLS_COVERAGE, parentId: 'p3-loc2-b1', cardinality: req(1, 1, 3), attributes: covAttrs('CP 00 10', 'Special Form', 'Replacement Cost', '$25,000', '$41.2M') },
    { id: 'p3-loc2-b2', name: 'L2-B2 - R&D Lab Building', nodeType: 'Building', classification: CLS_BUILDING, parentId: 'p3-loc2', cardinality: opt(1, 0, null), attributes: bldAttrs('Laboratory', 'Fire Resistive', '2015', '54,000 sq ft', '$22.8M') },
    { id: 'p3-loc2-b2-cov', name: 'L2-B2 - Building Coverage', nodeType: 'Coverage', classification: CLS_COVERAGE, parentId: 'p3-loc2-b2', cardinality: req(1, 1, 3), attributes: covAttrs('CP 00 10', 'Special Form', 'Replacement Cost', '$25,000', '$22.8M') },
    { id: 'p3-loc2-b3', name: 'L2-B3 - Parking Structure', nodeType: 'Building', classification: CLS_BUILDING, parentId: 'p3-loc2', cardinality: opt(1, 0, null), attributes: bldAttrs('Parking', 'Reinforced Concrete', '2010', '120,000 sq ft', '$9.4M') },
    { id: 'p3-loc3', name: 'Location 3A - San Jose Manufacturing Campus', nodeType: 'Location', classification: CLS_LOCATION, parentId: null, cardinality: opt(1, 0, null), attributes: locAttrs('2500 Augustine Dr', 'San Jose', 'CA', '95054', '2') },
    { id: 'p3-loc3-cov', name: 'L3A - Blanket Location Coverage', nodeType: 'Coverage', classification: CLS_COVERAGE, parentId: 'p3-loc3', cardinality: opt(1, 0, 1), attributes: blanketAttrs('$32.0M') },
    { id: 'p3-loc3-b1', name: 'L3A-B1 - Manufacturing Building A', nodeType: 'Building', classification: CLS_BUILDING, parentId: 'p3-loc3', cardinality: req(1, 1, null), attributes: bldAttrs('Manufacturing', 'Fire Resistive', '2008', '145,000 sq ft', '$15.0M') },
    { id: 'p3-loc3-b1-cov', name: 'L3A-B1 - Building Coverage', nodeType: 'Coverage', classification: CLS_COVERAGE, parentId: 'p3-loc3-b1', cardinality: req(1, 1, 3), attributes: covAttrs('CP 00 10', 'Special Form', 'Replacement Cost', '$50,000', '$15.0M') },
    { id: 'p3-loc3-b2', name: 'L3A-B2 - Quality Control Lab', nodeType: 'Building', classification: CLS_BUILDING, parentId: 'p3-loc3', cardinality: opt(1, 0, null), attributes: bldAttrs('Laboratory/Testing', 'Masonry Non-Combustible', '2012', '42,000 sq ft', '$6.5M') },
    { id: 'p3-loc3-b2-cov', name: 'L3A-B2 - Building Coverage', nodeType: 'Coverage', classification: CLS_COVERAGE, parentId: 'p3-loc3-b2', cardinality: req(1, 1, 3), attributes: covAttrs('CP 00 10', 'Special Form', 'Replacement Cost', '$50,000', '$6.5M') },
    { id: 'p3-loc3-b3', name: 'L3A-B3 - Warehouse & Distribution', nodeType: 'Building', classification: CLS_BUILDING, parentId: 'p3-loc3', cardinality: opt(1, 0, null), attributes: bldAttrs('Warehouse/Distribution', 'Joisted Masonry', '2010', '95,000 sq ft', '$8.2M') },
    { id: 'p3-loc5', name: 'Location 5A - Austin Distribution Center', nodeType: 'Location', classification: CLS_LOCATION, parentId: null, cardinality: opt(1, 0, null), attributes: locAttrs('4200 Industrial Blvd', 'Austin', 'TX', '78744', '3') },
    // No Equipment / Contents nodes; L1-B2, L2-B3 and L3A-B3 building coverages excluded.
  ],
  missingLines: [
    'L1-B1 - Business Personal Property',
    'L1-B2 - Loading Equipment',
    'L2-B1 - Office Contents',
    'L2-B2 - Lab Equipment',
    'L3A-B1 - Manufacturing Equipment',
    'L3A-B2 - Lab Equipment',
    'L3A-B3 - Inventory & Equipment',
    'L1-B2 - Building Coverage',
    'L2-B3 - Building Coverage',
    'L3A-B3 - Building Coverage',
  ],
};

/** Sellable products keyed by submission id (Property LOB only). */
export const productCatalog: Record<string, SellableProduct[]> = {
  a00SB00001ARehdYAD: [p1, p2, p3],
};

// ── Quote pricing model (demo) ──────────────────────────────────────────────
// Only Coverage lines carry an intrinsic premium (their `premiumAllocation`).
// Every asset (Location / Building / Equipment) and the LOB itself is a pure
// rollup of everything beneath it. Tax and fee are derived per coverage so a
// parent's totals equal the exact sum of its children's — which keeps the
// LOB-level Total in sync with the Quotes related list.
export interface QuoteLinePrice {
  premium: number;
  tax: number;
  fee: number;
  total: number;
}

const QUOTE_TAX_RATE = 0.0875;
const QUOTE_FEE_RATE = 0.02;

export function computeQuotePricing(lines: InsuranceSubmissionLine[]): Record<string, QuoteLinePrice> {
  const childrenMap = new Map<string | null, InsuranceSubmissionLine[]>();
  for (const l of lines) {
    const key = l.parentLineId ?? null;
    if (!childrenMap.has(key)) childrenMap.set(key, []);
    childrenMap.get(key)!.push(l);
  }

  const result: Record<string, QuoteLinePrice> = {};
  const add = (a: QuoteLinePrice, b: QuoteLinePrice): QuoteLinePrice => ({
    premium: a.premium + b.premium,
    tax: a.tax + b.tax,
    fee: a.fee + b.fee,
    total: a.total + b.total,
  });

  const compute = (line: InsuranceSubmissionLine): QuoteLinePrice => {
    if (result[line.id]) return result[line.id];
    let price: QuoteLinePrice = { premium: 0, tax: 0, fee: 0, total: 0 };
    if (line.lineType === 'Coverage') {
      const premium = line.premiumAllocation ?? 0;
      const tax = Math.round(premium * QUOTE_TAX_RATE);
      const fee = Math.round(premium * QUOTE_FEE_RATE);
      price = { premium, tax, fee, total: premium + tax + fee };
    }
    // Roll up every child (child coverages and child assets alike).
    for (const child of childrenMap.get(line.id) ?? []) {
      price = add(price, compute(child));
    }
    result[line.id] = price;
    return price;
  };

  for (const l of lines) compute(l);
  return result;
}

// LOB-level total premium for one LOB of a submission — used to keep the Quotes
// related list total identical to the quote record page.
export function computeQuoteTotalForLob(submissionId: string, dataLob: string): number {
  const lines = mockSubmissionLines.filter(
    (l) => l.insuranceSubmissionId === submissionId && l.lineOfBusiness === dataLob
  );
  const pricing = computeQuotePricing(lines);
  const root = lines.find((l) => l.lineType === 'LOB') || lines.find((l) => l.parentLineId === null);
  return root ? pricing[root.id]?.total ?? 0 : 0;
}
