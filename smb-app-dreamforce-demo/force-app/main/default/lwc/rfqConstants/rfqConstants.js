// Shared constants for the RFQ Create flow.
// Mirrors the schema from the Summit Brokerage rfq-create.html reference:
//   - LOBs: Commercial Property, Commercial Auto
//   - Line item types: location, building, equipment, vehicle (each with field schemas)
//   - Coverage catalog: applicable to policy or specific item types, with ACORD form refs

export const LOBS = [
    {
        value: 'property',
        title: 'Commercial Property',
        description: 'Buildings, contents, business personal property',
        accent: '#f3b23f'
    },
    {
        value: 'auto',
        title: 'Commercial Auto',
        description: 'Fleet vehicles, liability, physical damage',
        accent: '#7f8de1'
    }
];

export const ITEM_TYPES = {
    location: {
        key: 'location',
        label: 'Location',
        lob: ['property'],
        canHaveChildren: true,
        allowedParents: [null],
        fields: [
            { key: 'name', label: 'Location Name', type: 'text', required: true, placeholder: 'e.g. Main Office', span: 2 },
            { key: 'address', label: 'Address', type: 'text', required: true, placeholder: '123 Main St, City, State, ZIP', span: 2 },
            { key: 'protectionClass', label: 'Protection Class', type: 'select', options: ['', '1 (Best)', '2', '3', '4', '5', '6', '7', '8', '9', '10 (Unprotected)'] },
            { key: 'territory', label: 'Fire Territory Code', type: 'text', placeholder: 'e.g. 001' }
        ]
    },
    building: {
        key: 'building',
        label: 'Building',
        lob: ['property'],
        canHaveChildren: true,
        allowedParents: ['location', null],
        fields: [
            { key: 'name', label: 'Building Name / Number', type: 'text', required: true, placeholder: 'e.g. Building A', span: 2 },
            { key: 'value', label: 'Building Value', type: 'number', required: true, placeholder: '2500000', isMoney: true },
            { key: 'contentsValue', label: 'Contents / BPP Value', type: 'number', placeholder: '500000', isMoney: true },
            { key: 'yearBuilt', label: 'Year Built', type: 'number', placeholder: '1998' },
            { key: 'sqft', label: 'Square Footage', type: 'number', placeholder: '25000' },
            { key: 'construction', label: 'Construction Type', type: 'select', required: true, options: ['', 'Frame', 'Joisted Masonry', 'Non-Combustible', 'Masonry Non-Combustible', 'Modified Fire Resistive', 'Fire Resistive'] },
            { key: 'occupancy', label: 'Occupancy', type: 'select', required: true, options: ['', 'Office', 'Retail', 'Warehouse', 'Manufacturing', 'Restaurant', 'Apartment / Residential', 'Mixed Use'] },
            { key: 'sprinklered', label: 'Sprinklered?', type: 'select', options: ['No', 'Yes — Fully', 'Yes — Partial'] },
            { key: 'stories', label: 'Number of Stories', type: 'number', placeholder: '3' }
        ]
    },
    equipment: {
        key: 'equipment',
        label: 'Equipment',
        lob: ['property', 'auto'],
        canHaveChildren: false,
        allowedParents: ['building', 'vehicle'],
        fields: [
            { key: 'name', label: 'Equipment Name', type: 'text', required: true, placeholder: 'e.g. Epson projector', span: 2 },
            { key: 'value', label: 'Replacement Value', type: 'number', required: true, placeholder: '5000', isMoney: true },
            { key: 'category', label: 'Category', type: 'select', options: ['', 'Office Equipment', 'Computer / IT', 'Audio / Visual', 'Manufacturing', 'Medical', 'Kitchen', 'Tools', 'Inventory', 'Other'] },
            { key: 'serial', label: 'Serial Number', type: 'text', placeholder: 'Optional' },
            { key: 'model', label: 'Make / Model', type: 'text', placeholder: 'e.g. Epson EB-PU2216B' },
            { key: 'scheduled', label: 'Scheduled Item?', type: 'select', options: ['No', 'Yes'] }
        ]
    },
    vehicle: {
        key: 'vehicle',
        label: 'Vehicle',
        lob: ['auto'],
        canHaveChildren: true,
        allowedParents: [null],
        fields: [
            { key: 'name', label: 'Vehicle Description', type: 'text', required: true, placeholder: 'e.g. Unit 12 — Ford F-150', span: 2 },
            { key: 'year', label: 'Year', type: 'number', required: true, placeholder: '2023' },
            { key: 'make', label: 'Make', type: 'text', required: true, placeholder: 'Ford' },
            { key: 'model', label: 'Model', type: 'text', required: true, placeholder: 'F-150' },
            { key: 'vin', label: 'VIN', type: 'text', placeholder: '17 characters' },
            { key: 'value', label: 'Stated Value', type: 'number', required: true, placeholder: '45000', isMoney: true },
            { key: 'class', label: 'Vehicle Class', type: 'select', required: true, options: ['', 'Private Passenger', 'Light Truck', 'Medium Truck', 'Heavy Truck', 'Trailer', 'Bus'] },
            { key: 'use', label: 'Primary Use', type: 'select', options: ['', 'Business', 'Service', 'Retail Delivery', 'Commercial Transport'] },
            { key: 'radius', label: 'Radius of Operation', type: 'select', options: ['', 'Local (≤ 50 mi)', 'Intermediate (51-200 mi)', 'Long Haul (200+ mi)'] },
            { key: 'garaging', label: 'Garaging Address', type: 'text', placeholder: '123 Depot Rd, City, State, ZIP', span: 2 }
        ]
    }
};

export function typesForLob(lob) {
    return Object.values(ITEM_TYPES).filter(t => t.lob.includes(lob));
}

export const POLICY_TARGET = '__policy__';

export const COVERAGE_CATALOG = {
    building_fire: {
        key: 'building_fire', name: 'Fire & Allied Perils', code: 'CP 10 10', form: 'ACORD 140',
        description: 'Direct damage by fire, lightning, explosion, vandalism, and named perils.',
        category: 'Property', accent: '#c23934',
        applicableTo: ['building', 'location'],
        fields: [
            { key: 'limit', label: 'Limit of Insurance', type: 'number', isMoney: true, required: true, hint: 'Typically matches building value' },
            { key: 'deductible', label: 'Deductible', type: 'number', isMoney: true, default: '5000' },
            { key: 'valuation', label: 'Valuation', type: 'select', options: ['Replacement Cost', 'Actual Cash Value', 'Agreed Value'], default: 'Replacement Cost' },
            { key: 'coinsurance', label: 'Coinsurance', type: 'select', options: ['80%', '90%', '100%', 'Agreed Amount'], default: '90%' }
        ]
    },
    building_special: {
        key: 'building_special', name: 'Special Form (All-Risk)', code: 'CP 10 30', form: 'ACORD 140',
        description: 'Open perils — covers all direct physical loss except exclusions.',
        category: 'Property', accent: '#c23934',
        applicableTo: ['building', 'location'],
        fields: [
            { key: 'limit', label: 'Limit of Insurance', type: 'number', isMoney: true, required: true },
            { key: 'deductible', label: 'Deductible', type: 'number', isMoney: true, default: '10000' },
            { key: 'valuation', label: 'Valuation', type: 'select', options: ['Replacement Cost', 'Actual Cash Value', 'Agreed Value'], default: 'Replacement Cost' },
            { key: 'coinsurance', label: 'Coinsurance', type: 'select', options: ['80%', '90%', '100%', 'Agreed Amount'], default: '90%' }
        ]
    },
    wind_hail: {
        key: 'wind_hail', name: 'Wind & Hail', code: 'CP 10 54', form: 'ACORD 140',
        description: 'Separate wind / hail deductible — often required in coastal or hail-prone regions.',
        category: 'Property', accent: '#0ea5e9',
        applicableTo: ['building', 'location'],
        fields: [
            { key: 'limit', label: 'Limit', type: 'number', isMoney: true },
            { key: 'windDed', label: 'Wind / Hail Deductible (%)', type: 'select', options: ['1%', '2%', '3%', '5%', '10%'], default: '2%' },
            { key: 'namedStorm', label: 'Named Storm Exclusion', type: 'select', options: ['No', 'Yes'], default: 'No' }
        ]
    },
    flood: {
        key: 'flood', name: 'Flood', code: 'CP 10 65', form: 'ACORD 140',
        description: 'Damage from rising water, storm surge, or overflow.',
        category: 'Property', accent: '#0ea5e9',
        applicableTo: ['building', 'location'],
        fields: [
            { key: 'limit', label: 'Limit', type: 'number', isMoney: true, required: true },
            { key: 'deductible', label: 'Deductible', type: 'number', isMoney: true, default: '25000' },
            { key: 'floodZone', label: 'Flood Zone', type: 'select', options: ['', 'X (Low)', 'A', 'AE', 'V', 'VE', 'B', 'C'] }
        ]
    },
    earthquake: {
        key: 'earthquake', name: 'Earthquake', code: 'CP 10 40', form: 'ACORD 140',
        description: 'Direct damage from earth movement, including aftershocks.',
        category: 'Property', accent: '#78350f',
        applicableTo: ['building', 'location'],
        fields: [
            { key: 'limit', label: 'Limit', type: 'number', isMoney: true, required: true },
            { key: 'deductible', label: 'Deductible (%)', type: 'select', options: ['5%', '10%', '15%', '20%'], default: '10%' }
        ]
    },
    business_income: {
        key: 'business_income', name: 'Business Income & Extra Expense', code: 'CP 00 30', form: 'ACORD 140',
        description: 'Lost revenue and extra expense while operations are suspended after a covered loss.',
        category: 'Property', accent: '#2e844a',
        applicableTo: ['building', 'location', POLICY_TARGET],
        fields: [
            { key: 'limit', label: 'Annual Limit', type: 'number', isMoney: true, required: true },
            { key: 'waitingPeriod', label: 'Waiting Period', type: 'select', options: ['24 hours', '48 hours', '72 hours'], default: '72 hours' },
            { key: 'period', label: 'Period of Indemnity', type: 'select', options: ['6 months', '12 months', '18 months', '24 months'], default: '12 months' }
        ]
    },
    equipment_breakdown: {
        key: 'equipment_breakdown', name: 'Equipment Breakdown', code: 'EB 00 20', form: 'ACORD 140',
        description: 'Mechanical, electrical, and pressure system breakdown — including the resulting direct damage and lost income.',
        category: 'Equipment', accent: '#7f8de1',
        applicableTo: ['building', 'equipment', POLICY_TARGET],
        fields: [
            { key: 'limit', label: 'Limit', type: 'number', isMoney: true, required: true },
            { key: 'deductible', label: 'Deductible', type: 'number', isMoney: true, default: '5000' }
        ]
    },
    theft: {
        key: 'theft', name: 'Theft / Burglary', code: 'CR 00 23', form: 'ACORD 146',
        description: 'Loss of property by burglary, robbery, or employee theft.',
        category: 'Equipment', accent: '#a16207',
        applicableTo: ['equipment', 'building', POLICY_TARGET],
        fields: [
            { key: 'limit', label: 'Limit', type: 'number', isMoney: true, required: true },
            { key: 'deductible', label: 'Deductible', type: 'number', isMoney: true, default: '1000' },
            { key: 'subLimit', label: 'Money & Securities Sub-limit', type: 'number', isMoney: true, default: '25000' }
        ]
    },
    inland_marine: {
        key: 'inland_marine', name: 'Inland Marine (Scheduled)', code: 'IM 00 07', form: 'ACORD 141',
        description: 'Coverage for high-value, mobile, or specialized equipment — often on a scheduled basis.',
        category: 'Equipment', accent: '#8b5cf6',
        applicableTo: ['equipment'],
        fields: [
            { key: 'limit', label: 'Limit', type: 'number', isMoney: true, required: true, hint: 'Typically equals replacement value' },
            { key: 'deductible', label: 'Deductible', type: 'number', isMoney: true, default: '500' },
            { key: 'offPremises', label: 'Off-Premises Coverage', type: 'select', options: ['Yes', 'No'], default: 'Yes' },
            { key: 'agreedValue', label: 'Agreed Value', type: 'select', options: ['Yes', 'No'], default: 'Yes' }
        ]
    },
    auto_liability: {
        key: 'auto_liability', name: 'Auto Liability', code: 'CA 00 01', form: 'ACORD 137',
        description: 'Bodily injury and property damage caused by covered autos.',
        category: 'Auto', accent: '#0176d3',
        applicableTo: ['vehicle', POLICY_TARGET],
        fields: [
            { key: 'limit', label: 'Combined Single Limit', type: 'select', required: true, options: ['$300,000', '$500,000', '$1,000,000', '$2,000,000', '$5,000,000'], default: '$1,000,000' },
            { key: 'umPlan', label: 'UM / UIM', type: 'select', options: ['Same as Liability', '$100,000 / $300,000', '$250,000 / $500,000', 'Rejected'], default: 'Same as Liability' }
        ]
    },
    auto_physical: {
        key: 'auto_physical', name: 'Physical Damage — Comp & Collision', code: 'CA 00 20', form: 'ACORD 137',
        description: 'Covered-auto damage from collision, and non-collision (comprehensive) losses.',
        category: 'Auto', accent: '#0176d3',
        applicableTo: ['vehicle'],
        fields: [
            { key: 'collisionDed', label: 'Collision Deductible', type: 'select', options: ['$500', '$1,000', '$2,500', '$5,000'], default: '$1,000' },
            { key: 'compDed', label: 'Comprehensive Deductible', type: 'select', options: ['$250', '$500', '$1,000', '$2,500', '$5,000'], default: '$500' },
            { key: 'statedValue', label: 'Stated Value', type: 'number', isMoney: true, hint: 'Defaults to vehicle stated value' }
        ]
    },
    hired_nonowned: {
        key: 'hired_nonowned', name: 'Hired & Non-Owned Auto', code: 'CA 20 01', form: 'ACORD 137',
        description: 'Liability for autos the insured rents, leases, or does not own but uses in the business.',
        category: 'Auto', accent: '#0176d3',
        applicableTo: [POLICY_TARGET],
        fields: [
            { key: 'limit', label: 'Liability Limit', type: 'select', required: true, options: ['$500,000', '$1,000,000', '$2,000,000'], default: '$1,000,000' }
        ]
    },
    cgl: {
        key: 'cgl', name: 'Commercial General Liability', code: 'CG 00 01', form: 'ACORD 125',
        description: 'Third-party bodily injury, property damage, and personal/advertising injury.',
        category: 'Liability', accent: '#2e844a',
        applicableTo: [POLICY_TARGET],
        fields: [
            { key: 'occurrence', label: 'Each Occurrence', type: 'select', required: true, options: ['$500,000', '$1,000,000', '$2,000,000'], default: '$1,000,000' },
            { key: 'aggregate', label: 'General Aggregate', type: 'select', required: true, options: ['$1,000,000', '$2,000,000', '$5,000,000'], default: '$2,000,000' },
            { key: 'prodAgg', label: 'Products / Completed Ops', type: 'select', options: ['$1,000,000', '$2,000,000', '$5,000,000'], default: '$2,000,000' },
            { key: 'personal', label: 'Personal & Adv Injury', type: 'select', options: ['$500,000', '$1,000,000', '$2,000,000'], default: '$1,000,000' }
        ]
    },
    umbrella: {
        key: 'umbrella', name: 'Commercial Umbrella / Excess', code: 'CU 00 01', form: 'ACORD 131',
        description: "Excess limits above underlying GL, Auto, and Employer's Liability.",
        category: 'Liability', accent: '#7c3aed',
        applicableTo: [POLICY_TARGET],
        fields: [
            { key: 'limit', label: 'Umbrella Limit', type: 'select', required: true, options: ['$1,000,000', '$2,000,000', '$5,000,000', '$10,000,000', '$25,000,000'], default: '$5,000,000' },
            { key: 'retention', label: 'Self-Insured Retention', type: 'number', isMoney: true, default: '10000' },
            { key: 'following', label: 'Follow-Form', type: 'select', options: ['Yes', 'No'], default: 'Yes' }
        ]
    },
    cyber: {
        key: 'cyber', name: 'Cyber Liability', code: 'CYB 1001', form: 'ACORD 125',
        description: 'Data breach response, cyber extortion, network security & privacy liability.',
        category: 'Liability', accent: '#be185d',
        applicableTo: [POLICY_TARGET],
        fields: [
            { key: 'limit', label: 'Aggregate Limit', type: 'select', required: true, options: ['$500,000', '$1,000,000', '$3,000,000', '$5,000,000', '$10,000,000'], default: '$1,000,000' },
            { key: 'retention', label: 'Retention', type: 'number', isMoney: true, default: '10000' },
            { key: 'retroDate', label: 'Retroactive Date', type: 'date' }
        ]
    },
    workers_comp: {
        key: 'workers_comp', name: "Workers' Compensation", code: 'WC 00 00', form: 'ACORD 130',
        description: "Statutory workers' comp plus employer's liability limits.",
        category: 'Liability', accent: '#ea7600',
        applicableTo: [POLICY_TARGET],
        fields: [
            { key: 'wcLimit', label: "Workers' Comp", type: 'text', default: 'Statutory' },
            { key: 'elEach', label: 'EL — Each Accident', type: 'select', options: ['$100,000', '$500,000', '$1,000,000'], default: '$1,000,000' },
            { key: 'elDisease', label: 'EL — Disease, Each Emp.', type: 'select', options: ['$100,000', '$500,000', '$1,000,000'], default: '$1,000,000' }
        ]
    }
};

export function coveragesForTarget(target) {
    return Object.values(COVERAGE_CATALOG).filter(c => c.applicableTo.includes(target));
}

// Mock account list used by the Insured lookup. Replace with an Apex call wiring up SOSL/SOQL.
export const MOCK_ACCOUNTS = [
    { id: '001A', name: 'Acme Manufacturing Inc.', industry: 'Manufacturing', city: 'Cincinnati, OH' },
    { id: '001B', name: 'Bluebird Logistics LLC', industry: 'Transportation', city: 'Memphis, TN' },
    { id: '001C', name: 'Coastal Restaurants Group', industry: 'Restaurant', city: 'Tampa, FL' },
    { id: '001D', name: 'Delta Diagnostics', industry: 'Healthcare', city: 'Austin, TX' },
    { id: '001E', name: 'Evergreen Apartments LP', industry: 'Real Estate', city: 'Seattle, WA' },
    { id: '001F', name: 'Foundry Iron Works', industry: 'Manufacturing', city: 'Pittsburgh, PA' }
];
