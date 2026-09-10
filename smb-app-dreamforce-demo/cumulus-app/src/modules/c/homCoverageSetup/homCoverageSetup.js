import { LightningElement, api } from 'lwc';

// c-hom-coverage-setup - HO coverages, split across two cards.
//
// Presentational/controlled. The workspace owns coverageRanges state;
// this component renders picklists and dispatches:
//
//   coveragerangechange { key, field, value }   // field ∈ included | limit | ded
//
// Layout mirrors the PA "Policy-Level Coverages" card: each coverage
// row has an include checkbox plus a Limit picklist and, where the
// coverage carries one, a Deductible picklist. Dwelling, Personal
// Property and Loss of Use attach to
// the property and sit in the first card; E and F are written at the
// policy level and sit in the second. Other Structures is limit-only -
// it rides the dwelling deductible rather than carrying one of its own.

// Limit dropdowns are broad enough to cover Mavericks-tier dwellings
// (~$685k dwelling) up to a $1M umbrella-adjacent liability limit.
const COV_A_VALUES = [
  '$400,000', '$500,000', '$600,000', '$650,000',
  '$685,000', '$700,000', '$725,000', '$800,000', '$1,000,000'
];
const COV_B_VALUES = [
  '$40,000', '$50,000', '$60,000', '$65,000', '$68,500',
  '$70,000', '$75,000', '$100,000'
];
const COV_C_VALUES = [
  '$200,000', '$250,000', '$300,000', '$325,000', '$342,500',
  '$375,000', '$400,000', '$500,000'
];
const COV_D_VALUES = [
  '$80,000', '$100,000', '$120,000', '$130,000', '$137,000',
  '$150,000', '$175,000', '$200,000'
];
const COV_E_VALUES = [
  '$100,000', '$300,000', '$500,000', '$1,000,000', '$2,000,000'
];
const COV_F_VALUES = ['$1,000', '$2,000', '$5,000', '$10,000'];

// Property deductibles are flat dollar figures. Liability lines are
// normally written without one, so $0 leads their list.
const PROPERTY_DED_VALUES = [
  '$1,000', '$1,500', '$2,500', '$5,000', '$10,000'
];
const LIABILITY_DED_VALUES = ['$0', '$250', '$500', '$1,000'];

// A def without dedValues renders as limit-only (Other Structures).
const PROPERTY_COVERAGE_DEFS = [
  {
    key: 'dwelling',
    label: 'Dwelling',
    mandatory: true,
    values: COV_A_VALUES,
    dedValues: PROPERTY_DED_VALUES
  },
  {
    key: 'otherStructures',
    label: 'Other Structures',
    mandatory: true,
    values: COV_B_VALUES
  },
  {
    key: 'personalProperty',
    label: 'Personal Property',
    mandatory: true,
    values: COV_C_VALUES,
    dedValues: PROPERTY_DED_VALUES
  },
  {
    key: 'lossOfUse',
    label: 'Loss of Use',
    mandatory: true,
    values: COV_D_VALUES,
    dedValues: PROPERTY_DED_VALUES
  }
];

const POLICY_COVERAGE_DEFS = [
  {
    key: 'liability',
    label: 'Personal Liability',
    mandatory: true,
    values: COV_E_VALUES,
    dedValues: LIABILITY_DED_VALUES
  },
  {
    key: 'medPay',
    label: 'Med Pay to Others',
    mandatory: true,
    values: COV_F_VALUES,
    dedValues: LIABILITY_DED_VALUES
  }
];

function selectOptions(values, current) {
  return values.map((v) => ({ value: v, label: v, selected: v === current }));
}

function buildRow(def, ranges) {
  const r = ranges[def.key] || {};
  const included = def.mandatory ? true : r.included === true;
  const hasDed = Array.isArray(def.dedValues);
  return {
    key: def.key,
    label: def.label,
    mandatory: !!def.mandatory,
    included,
    limit: r.limit || '',
    limitOptions: selectOptions(def.values, r.limit),
    hasDed,
    ded: r.ded || '',
    dedOptions: hasDed ? selectOptions(def.dedValues, r.ded) : [],
    rowClass: included ? 'hom-cov__row' : 'hom-cov__row is-excluded'
  };
}

export default class HomCoverageSetup extends LightningElement {
  @api coverageRanges = {};

  get propertyCoverageRows() {
    const cr = this.coverageRanges || {};
    return PROPERTY_COVERAGE_DEFS.map((def) => buildRow(def, cr));
  }

  get policyCoverageRows() {
    const cr = this.coverageRanges || {};
    return POLICY_COVERAGE_DEFS.map((def) => buildRow(def, cr));
  }

  handleCoverageInclude(event) {
    const key = event.target.dataset.key;
    if (!key) return;
    this.dispatchEvent(
      new CustomEvent('coveragerangechange', {
        detail: { key, field: 'included', value: !!event.target.checked },
        bubbles: true,
        composed: true
      })
    );
  }

  handleCoverageRange(event) {
    const key = event.currentTarget.dataset.coverage;
    const field = event.currentTarget.dataset.field;
    if (!key || !field) return;
    this.dispatchEvent(
      new CustomEvent('coveragerangechange', {
        detail: { key, field, value: event.detail.value },
        bubbles: true,
        composed: true
      })
    );
  }
}
