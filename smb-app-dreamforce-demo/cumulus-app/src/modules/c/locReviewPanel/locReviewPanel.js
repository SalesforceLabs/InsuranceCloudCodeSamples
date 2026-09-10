import { LightningElement, api } from 'lwc';

// c-loc-review-panel
// ────────────────────────────────────────────────────────────────
// Renders a Review-card snapshot for a single LOC. Consumed by
// c-rfq-workspace (PA), c-rfq-workspace-home, and c-rfq-workspace-eb
// on the Review step when the broker has multiple LOCs on the same
// account bundle - each sibling LOC gets a tab in the bundle-review
// bar, and this panel renders the selected sibling's data inline
// without leaving the current SF workspace tab.
//
// Snapshot shape (produced by
//   rfqWorkspace.buildReviewSnapshot() (Auto)
//   rfqWorkspaceHome.buildReviewSnapshot() (Home)
//   rfqWorkspaceEb.buildReviewSnapshot() (EB)
// - keep symmetric; every consumer publishes ALL keys, empty arrays
// where a section doesn't apply, so this panel can iterate safely):
//
//   {
//     tabId, locKind: 'auto' | 'home' | 'eb',
//     locLabel, application, insured,
//     status: 'Draft' | 'Ready',
//     policyDetails: { loc, effectiveFrom, effectiveTo, summary,
//                      highlights: [{ key, label, value,
//                                     showBasePolicyLink }] },
//     // Auto
//     vehicles: [{ id, year, make, model }],
//     drivers: [{ id, firstName, lastName, dobDisplay }],
//     // Home
//     dwellings: [{ id, address, yearBuilt, construction,
//                   replacementCostDisplay }],
//     homeowners: [{ id, firstName, lastName, dobDisplay,
//                    maritalStatus, priorCarrier }],
//     scheduledItems: [{ id, name, category, appraisedDisplay }],
//     // EB
//     headcount: [{ id, label, value }],
//     ratePlans: [{ id, planType, frequency, tier, count }],
//     ebCoverages: [{ id, label, value }],     // IPC macro-financial
//     ebBenefits:  [{ id, label, value }],     // IPCB per-encounter
//     // PA/Home coverages (limits + deductibles) - EB leaves empty
//     coverages: [{ key, label, statusLabel, rowClass,
//                   detailLine, included }],
//     counts: { vehicles, drivers, dwellings, homeowners,
//               scheduledItems, headcount, ratePlans,
//               ebCoverages, ebBenefits, coverages },
//     hasContent
//   }
export default class LocReviewPanel extends LightningElement {
  @api payload;

  // Empty-state fallback. Drives the "not yet reviewed" copy for
  // sibling LOCs the broker opened but hasn't populated with any
  // assets/coverages yet.
  get isEmpty() {
    if (!this.payload) return true;
    return this.payload.hasContent === false;
  }

  get isAuto() {
    return this.payload?.locKind === 'auto';
  }

  get isHome() {
    return this.payload?.locKind === 'home';
  }

  get isEb() {
    return this.payload?.locKind === 'eb';
  }

  // Auto/Home render the shared coverages list (BI/PD/UM etc. for
  // Auto, Dwelling/Personal Property for Home). EB gets its own
  // Coverages + Benefits sections above, so we skip this fallback
  // list for the EB kind rather than showing an empty card.
  get showLegacyCoverages() {
    return !this.isEb;
  }

  get policyDetails() {
    return this.payload?.policyDetails || {};
  }

  get policyDetailsSummary() {
    return this.policyDetails?.summary || '';
  }

  get highlights() {
    return this.policyDetails?.highlights || [];
  }

  get vehicles() {
    return this.payload?.vehicles || [];
  }

  get drivers() {
    return this.payload?.drivers || [];
  }

  get dwellings() {
    return this.payload?.dwellings || [];
  }

  get homeowners() {
    return this.payload?.homeowners || [];
  }

  get scheduledItems() {
    return this.payload?.scheduledItems || [];
  }

  get coverages() {
    return this.payload?.coverages || [];
  }

  get counts() {
    return this.payload?.counts || {};
  }

  get vehicleCountLabel() {
    return this.counts.vehicles || '';
  }
  get driverCountLabel() {
    return this.counts.drivers || '';
  }
  get dwellingCountLabel() {
    return this.counts.dwellings || '';
  }
  get homeownerCountLabel() {
    return this.counts.homeowners || '';
  }
  get scheduledItemsCountLabel() {
    return this.counts.scheduledItems || '';
  }
  get coverageSectionSummary() {
    return this.counts.coverages || '';
  }

  get hasHomeowners() {
    return (this.payload?.homeowners || []).length > 0;
  }
  get hasScheduledItems() {
    return (this.payload?.scheduledItems || []).length > 0;
  }

  // ── EB accessors ────────────────────────────────────────────────
  // Each list falls back to an empty array so the templates can
  // for:each safely, and each has() variant gates whether the
  // section renders at all - the EB workspace publishes zero-length
  // arrays when a broker hasn't touched a step (e.g., no rate plans
  // saved yet) so we don't paint empty sections.
  get headcount() {
    return this.payload?.headcount || [];
  }
  get hasHeadcount() {
    return this.headcount.length > 0;
  }
  get headcountCountLabel() {
    return this.counts.headcount || '';
  }

  get ratePlans() {
    return this.payload?.ratePlans || [];
  }
  get hasRatePlans() {
    return this.ratePlans.length > 0;
  }
  get ratePlansCountLabel() {
    return this.counts.ratePlans || '';
  }

  get ebCoverages() {
    return this.payload?.ebCoverages || [];
  }
  get hasEbCoverages() {
    return this.ebCoverages.length > 0;
  }
  get ebCoveragesCountLabel() {
    return this.counts.ebCoverages || '';
  }

  get ebBenefits() {
    return this.payload?.ebBenefits || [];
  }
  get hasEbBenefits() {
    return this.ebBenefits.length > 0;
  }
  get ebBenefitsCountLabel() {
    return this.counts.ebBenefits || '';
  }

  get emptyLocLabel() {
    return this.payload?.locLabel || 'This LOC';
  }

  get emptyLocTitle() {
    return `Nothing to review for ${this.emptyLocLabel} yet`;
  }
}
