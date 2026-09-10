/**
 * Salesforce FSC-shaped DTOs used throughout the Atlas app.
 *
 * These typedefs mirror the standard Insurance objects the engineering team
 * outlined in the recording. Every component consumes data through these
 * shapes so swapping `data/api.js` for a real Connect API client is a no-op.
 *
 * Standard FSC objects referenced:
 *   - InsurancePolicy           (the bound policy)
 *   - InsurancePolicyCoverage   (IPC - one row per coverage line)
 *   - InsurancePolicyParticipant (IPP - Insured / Contact / Producer roles)
 *   - InsuranceClaim            (out of scope, defined for completeness)
 *
 * Custom objects expected in the org:
 *   - InsuranceApplication__c   (the in-flight RFQ; "Application" in the recording)
 *   - InsuranceApplicationLineItem__c
 *   - InsuranceApplicationCoverage__c
 *   - CarrierQuote__c
 */

/**
 * @typedef {'property' | 'auto' | 'home' | 'liability' | 'workers_comp'} LobCode
 */

/**
 * @typedef {'Draft' | 'Submitted' | 'Quoted' | 'Bound' | 'Declined'} ApplicationStatus
 */

/**
 * @typedef {Object} InsuranceApplication
 * @property {string} id
 * @property {string} applicationName
 * @property {string} accountId
 * @property {LobCode} lob
 * @property {ApplicationStatus} status
 * @property {string} effectiveDate     ISO date
 * @property {string} expirationDate    ISO date
 * @property {string} responseDeadline  ISO date
 * @property {InsuranceApplicationLineItem[]} lineItems
 * @property {InsuranceApplicationCoverage[]} coverages
 * @property {InsurancePolicyParticipant[]} participants
 */

/**
 * @typedef {Object} InsuranceApplicationLineItem
 * @property {string} id
 * @property {'location' | 'building' | 'equipment' | 'vehicle'} itemType
 * @property {string} name
 * @property {number} insuredValue
 * @property {Object<string, any>} attributes  free-form schema-driven attrs
 * @property {string|null} parentId
 */

/**
 * @typedef {Object} InsuranceApplicationCoverage
 * @property {string} id
 * @property {string} coverageKey         e.g. 'cgl', 'building_special'
 * @property {string} code                e.g. 'CG 00 01'
 * @property {string} formCode            ACORD form, e.g. 'ACORD 125'
 * @property {string} appliesToItemId     line-item id, or '__policy__'
 * @property {Object<string, any>} attributes
 */

/**
 * @typedef {Object} InsurancePolicy
 * @property {string} id
 * @property {string} policyNumber
 * @property {string} accountId
 * @property {LobCode} lobCode
 * @property {string} carrierId
 * @property {string} effectiveDate
 * @property {string} expirationDate
 * @property {'Quoted' | 'Bound' | 'In Force' | 'Cancelled'} status
 * @property {number} totalPremium
 */

/**
 * @typedef {Object} InsurancePolicyCoverage
 * @property {string} id
 * @property {string} policyId
 * @property {string} coverageType
 * @property {string} code
 * @property {string} formCode
 * @property {number} limit
 * @property {number} deductible
 * @property {number} premium
 */

/**
 * @typedef {Object} InsurancePolicyParticipant
 * @property {string} id
 * @property {string} policyId
 * @property {'Insured' | 'PrimaryContact' | 'Producer' | 'Underwriter'} role
 * @property {string|null} accountId
 * @property {string|null} contactId
 * @property {string} name
 */

/**
 * @typedef {Object} CarrierQuote
 * @property {string} id
 * @property {string} applicationId
 * @property {string} carrierId
 * @property {string} carrierName
 * @property {'pending' | 'received' | 'declined'} status
 * @property {number} annualPremium
 * @property {string} combinedSingleLimit  Auto liability - CSL
 * @property {string} collisionDeductible
 * @property {string} compDeductible
 * @property {string} umUim                UM / UIM coverage
 * @property {string} hnoa                 Hired & Non-Owned Auto status
 * @property {string} validUntil
 * @property {AIRecommendation|null} aiRecommendation
 */

/**
 * @typedef {Object} AIRecommendation
 * @property {boolean} bestValue
 * @property {string} reason
 * @property {number} confidence  0..1
 */

export const POLICY_TARGET = '__policy__';
