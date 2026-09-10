# Salesforce Data Replication Guide

## Overview

This document describes how the Insurance Submission data structure was replicated from the FScagentforce Salesforce org into the demo application.

## Source Data

**Salesforce Org:** FScagentforce (epic.out.15bbc359afe6@orgfarm.salesforce.com)  
**Org ID:** 00DSB00000wdmxp2AA  
**Instance:** orgfarm-5154ccaff5.test1.my.pc-rnd.salesforce.com

**Source Record:**
- Object: `Insurance_Submission__c`
- Record ID: `a00SB00001ARehdYAD`
- Name: `SUB-2024-CP-001`
- Related Lines: 43 `Insurance_Submission_Line__c` records

## Data Structure

### Insurance Submission Object

The `Insurance_Submission__c` custom object contains the following fields:

#### Standard Salesforce Fields
- `Id` - Unique record identifier
- `Name` - Submission number (e.g., SUB-2024-CP-001)
- `OwnerId` - User who owns the record
- `CreatedDate` - Record creation timestamp
- `CreatedById` - User who created the record
- `LastModifiedDate` - Last modification timestamp
- `LastModifiedById` - User who last modified the record

#### Custom Fields
- `Account__c` - Lookup to Account
- `Annual_Revenue__c` - Number field
- `Bound_Premium__c` - Currency field
- `Broker_Email__c` - Email field
- `Broker_Phone__c` - Phone field
- `Broker__c` - Text field (broker name)
- `Carrier_Portal_URL__c` - URL field
- `Carrier__c` - Text field (insurance carrier name)
- `Commission_Rate__c` - Percent field
- `Coverage_Types__c` - Text area field
- `Date_Submitted__c` - Date field
- `Effective_Date__c` - Date field
- `Expiration_Date__c` - Date field
- `Insured_State__c` - Text field
- `Is_Bound__c` - Checkbox field
- `Is_Renewal__c` - Checkbox field
- `Line_of_Business__c` - Picklist field
- `Number_of_Employees__c` - Number field
- `Opportunity__c` - Lookup to Opportunity
- `Priority__c` - Picklist field (High, Medium, Low)
- `Quoted_Premium__c` - Currency field
- `Requested_Premium__c` - Currency field
- `Stage__c` - Picklist field
- `Total_Insured_Value__c` - Currency field
- `Underwriting_Notes__c` - Text area field

### Insurance Submission Line Object

The `Insurance_Submission_Line__c` custom object represents the hierarchical structure of coverage:

#### Hierarchy Structure
```
LOB (Line of Business)
├── Location
│   ├── Coverage
│   ├── Building
│   │   ├── Coverage
│   │   └── Equipment / Contents
│   └── Premise / Operation
│       ├── Class Code
│       └── Coverage
├── Coverage
├── Endorsement
└── Exclusion
```

#### Fields
- `Id` - Unique record identifier
- `Name` - Line item name
- `Insurance_Submission__c` - Lookup to parent submission
- `Line_Type__c` - Picklist (LOB, Location, Building, Coverage, Equipment / Contents, Premise / Operation, Class Code, Endorsement, Exclusion)
- `Line_of_Business__c` - Picklist (Property, General Liability, Auto, Umbrella, etc.)
- `Parent_Line__c` - Lookup to parent line item (for hierarchy)
- `Sequence_Number__c` - Number field (ordering within siblings)
- `Status__c` - Picklist (Active, Inactive, Pending)
- `Stage__c` - Picklist (aligns with submission stage)
- `Coverage_Limit__c` - Currency field
- `Deductible__c` - Currency field
- `Premium_Allocation__c` - Currency field
- `Insured_Value__c` - Currency field
- `Sublimit__c` - Currency field
- `Description__c` - Text area
- `Line_Attributes__c` - Long text area (JSON-like structured data)

## Example Data

### Sample Submission Record

```json
{
  "Id": "a00SB00001ARehdYAD",
  "Name": "SUB-2024-CP-001",
  "Broker__c": "Marsh & McLennan",
  "Broker_Email__c": "broker@marsh.com",
  "Broker_Phone__c": "2125550100",
  "Carrier__c": "Chubb",
  "Effective_Date__c": "2025-01-01",
  "Expiration_Date__c": "2026-01-01",
  "Line_of_Business__c": "Property",
  "Priority__c": "High",
  "Requested_Premium__c": 285000,
  "Stage__c": "Risk Assessment",
  "Total_Insured_Value__c": 42500000,
  "Is_Bound__c": false,
  "Is_Renewal__c": false,
  "Underwriting_Notes__c": "Commercial property submission for Acme Corp. Two locations — Chicago warehouse and Austin office campus."
}
```

### Sample Line Item Records

#### Property LOB (Top Level)
```json
{
  "Id": "a01SB00001p8B5FYAU",
  "Name": "Commercial Property LOB",
  "Line_Type__c": "LOB",
  "Line_of_Business__c": "Property",
  "Parent_Line__c": null,
  "Coverage_Limit__c": 40000000,
  "Premium_Allocation__c": 285000,
  "Insured_Value__c": 42500000,
  "Line_Attributes__c": "Policy Form: CP 00 10, Cause of Loss: Special Form, Valuation: Replacement Cost, Coinsurance: 90%"
}
```

#### Location (Child of LOB)
```json
{
  "Id": "a01SB00001p8B6rYAE",
  "Name": "Location 1 - Chicago Warehouse",
  "Line_Type__c": "Location",
  "Line_of_Business__c": "Property",
  "Parent_Line__c": "a01SB00001p8B5FYAU",
  "Sequence_Number__c": 1,
  "Coverage_Limit__c": 28000000,
  "Premium_Allocation__c": 185000,
  "Insured_Value__c": 28000000,
  "Line_Attributes__c": "Address: 1450 W Fulton St, City: Chicago, State: IL, Zip: 60607, Country: USA, Sprinklered: Yes, Fire Alarm: Yes, Security: 24/7 Guard"
}
```

#### Building (Child of Location)
```json
{
  "Id": "a01SB00001p8BA5YAM",
  "Name": "L1-B1 - Main Warehouse",
  "Line_Type__c": "Building",
  "Line_of_Business__c": "Property",
  "Parent_Line__c": "a01SB00001p8B6rYAE",
  "Sequence_Number__c": 2,
  "Coverage_Limit__c": 18000000,
  "Deductible__c": 25000,
  "Premium_Allocation__c": 110000,
  "Insured_Value__c": 18000000,
  "Line_Attributes__c": "Construction Type: Masonry Non-Combustible, Year Built: 1998, Square Footage: 120000, Stories: 1, Roof Type: TPO Membrane, Roof Year: 2018, Occupancy: Warehouse/Distribution"
}
```

#### Coverage (Child of Building)
```json
{
  "Id": "a01SB00001p8BBhYAM",
  "Name": "L1-B1 - Building Coverage",
  "Line_Type__c": "Coverage",
  "Line_of_Business__c": "Property",
  "Parent_Line__c": "a01SB00001p8BA5YAM",
  "Sequence_Number__c": 1,
  "Coverage_Limit__c": 18000000,
  "Deductible__c": 25000,
  "Premium_Allocation__c": 90000,
  "Line_Attributes__c": "Coverage: Building, Valuation: Replacement Cost, Agreed Value: Yes, Ordinance or Law: 10%"
}
```

## Implementation in Demo App

### File Changes

#### 1. TypeScript Types (`src/types/InsuranceSubmission.ts`)

**Added fields to `InsuranceSubmission` interface:**
- All custom Salesforce fields from `Insurance_Submission__c`
- Made fields optional to maintain backward compatibility with existing mock data

**Created new `InsuranceSubmissionLine` interface:**
- Matches the structure of `Insurance_Submission_Line__c`
- Supports hierarchical parent-child relationships via `parentLineId`
- Includes all coverage, deductible, and premium fields

#### 2. Mock Data (`src/data/mockSubmissions.ts`)

**Updated submission record:**
- Changed ID from `SUB-00000345` to actual Salesforce ID `a00SB00001ARehdYAD`
- Updated name from "NexGen BioLogics Inc New Business" to "SUB-2024-CP-001"
- Added all new Salesforce custom fields with actual values from org
- Changed insured name to "Acme Corporation" to match org data

#### 3. Submission Lines Data (`src/data/mockSubmissionLines.ts`)

**Created new file with 43 line items:**
- 2 LOB records (Property and General Liability)
- 4 Location records (2 for Property, 2 for GL)
- 8 Building records
- 20 Coverage records
- 4 Equipment/Contents records
- 4 Premise/Operation records
- 3 Class Code records
- 3 Endorsement records
- 2 Exclusion records

All records maintain proper parent-child relationships through `parentLineId` field.

## Data Hierarchy Example

### Property LOB Hierarchy

```
Commercial Property LOB (a01SB00001p8B5FYAU)
│
├── Location 1 - Chicago Warehouse (a01SB00001p8B6rYAE)
│   ├── L1 - Blanket Location Coverage (a01SB00001p8B8TYAU)
│   ├── L1-B1 - Main Warehouse (a01SB00001p8BA5YAM)
│   │   ├── L1-B1 - Building Coverage (a01SB00001p8BBhYAM)
│   │   └── L1-B1 - Business Personal Property (a01SB00001p8BEvYAM)
│   └── L1-B2 - Loading Dock Annex (a01SB00001p8BGXYA2)
│       ├── L1-B2 - Building Coverage (a01SB00001p8BI9YAM)
│       └── L1-B2 - Loading Equipment (a01SB00001p8BJlYAM)
│
└── Location 2 - Austin Office Campus (a01SB00001p85SsYAI)
    ├── L2 - Blanket Location Coverage (a01SB00001p8BMzYAM)
    ├── L2-B1 - HQ Tower (a01SB00001p8BObYAM)
    │   ├── L2-B1 - Building Coverage (a01SB00001p8BQDYA2)
    │   └── L2-B1 - Office Contents (a01SB00001p8BRpYAM)
    ├── L2-B2 - R&D Lab Building (a01SB00001p8BTRYA2)
    │   ├── L2-B2 - Building Coverage (a01SB00001p8BV3YAM)
    │   └── L2-B2 - Lab Equipment (a01SB00001p8AnWYAU)
    └── L2-B3 - Parking Structure (a01SB00001p8BWfYAM)
        └── L2-B3 - Building Coverage (a01SB00001p8BYHYA2)
```

### General Liability LOB Hierarchy

```
General Liability LOB (a01SB00001pGYUTYA4)
│
├── Premises Operations Coverage (a01SB00001pGYW5YAO)
│   ├── Each Occurrence Limit (a01SB00001pGYXhYAO)
│   ├── General Aggregate Limit (a01SB00001pGYZJYA4)
│   └── Products/Completed Operations Aggregate (a01SB00001pGQ5WYAW)
│
├── Location 1 - Chicago Manufacturing Facility (a01SB00001pGYavYAG)
│   ├── L1 - Premise/Operation - Building A Manufacturing (a01SB00001pGYcXYAW)
│   │   ├── L1-A - Class Code 91805 (a01SB00001pGYe9YAG)
│   │   └── L1-A - Coverage (a01SB00001pGYflYAG)
│   └── L1 - Premise/Operation - Warehouse (a01SB00001pGSIcYAO)
│       ├── L1-W - Class Code 92104 (a01SB00001pGYizYAG)
│       └── L1-W - Coverage (a01SB00001pGYkbYAG)
│
├── Location 2 - Austin Retail Store (a01SB00001pGYmDYAW)
│   └── L2 - Premise/Operation - Retail Sales Floor (a01SB00001pGYnpYAG)
│       ├── L2 - Class Code 95132 (a01SB00001pGYfmYAG)
│       └── L2 - Coverage (a01SB00001pGYpRYAW)
│
├── Products Liability Coverage (a01SB00001pGYvtYAG)
│   ├── Products Aggregate Limit (a01SB00001pGZ3xYAG)
│   └── Products Per Claim Limit (a01SB00001pGZ5ZYAW)
│
├── Additional Insured - Landlords (a01SB00001pGZ7BYAW)
├── Additional Insured - Vendors (a01SB00001pGZ8nYAG)
├── Waiver of Subrogation (a01SB00001pGSQgYAO)
├── Professional Liability Exclusion (a01SB00001pGYmEYAW)
└── Pollution Exclusion (a01SB00001pGZAPYA4)
```

## Query Commands Used

### Get Full Submission Record
```bash
sf data query --query "SELECT FIELDS(ALL) FROM Insurance_Submission__c WHERE Id = 'a00SB00001ARehdYAD' LIMIT 200" --target-org FScagentforce --json
```

### Get All Line Items
```bash
sf data query --query "SELECT FIELDS(ALL) FROM Insurance_Submission_Line__c WHERE Insurance_Submission__c = 'a00SB00001ARehdYAD' LIMIT 200" --target-org FScagentforce --json
```

## Key Insights

### Line Attributes Field
The `Line_Attributes__c` field contains semi-structured data that provides additional context for each line item. The format is key-value pairs separated by commas:

**Example formats:**
- Property: `"Construction Type: Masonry Non-Combustible, Year Built: 1998, Square Footage: 120000"`
- Liability: `"Class Code: 91805, Description: Electronic Components Manufacturing, Rate Basis: Payroll"`
- Coverage: `"Coverage: Building, Valuation: Replacement Cost, Agreed Value: Yes"`

### Premium Allocation
Premium amounts roll up hierarchically:
- LOB premium = sum of all child Location premiums
- Location premium = sum of all child Building/Coverage premiums
- Building premium = sum of all child Coverage/Equipment premiums

### Sequence Numbers
The `Sequence_Number__c` field controls the display order of sibling items within the same parent. NULL values indicate no specific ordering is required.

## Next Steps

To fully integrate this data structure into the UI:

1. **Create Submission Line Item Component** - Display the hierarchical structure in the detail page
2. **Add Tree View** - Show expandable/collapsible hierarchy
3. **Calculate Rollup Totals** - Show aggregated premiums and coverage limits
4. **Add Line Attributes Parser** - Parse and display structured data from Line_Attributes__c field
5. **Create Related List** - Show line items grouped by LOB and Location
6. **Add Inline Editing** - Allow users to edit line item values
7. **Implement Filtering** - Filter by line type, LOB, status

## References

- Salesforce Custom Object API Name: `Insurance_Submission__c`
- Child Object API Name: `Insurance_Submission_Line__c`
- Relationship Field: `Insurance_Submission__c` (Master-Detail)
- Parent Line Field: `Parent_Line__c` (Self-Lookup)

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-28  
**Author:** System  
**Source Org:** FScagentforce (00DSB00000wdmxp2AA)
