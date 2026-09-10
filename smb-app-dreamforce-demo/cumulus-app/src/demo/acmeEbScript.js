/**
 * acmeEbScript.js - Guided autoplay narrative for Acme Manufacturing's
 * bundled Employee-Benefits RFQ (Group Medical + Group Dental).
 *
 * Runs against the LIVE UI via the atlasDemo engine `api`. The script is
 * written against the real component markup (verified selectors, not
 * guesses) and is fully UI-gated: every action waits for its target to be
 * interactable, and after anything that changes the DOM it waits for the
 * next expected element/state (the `expect` / `gone` options on the
 * combinators, or explicit waitForVisible / waitForGone). Fixed sleeps
 * are used ONLY for cosmetic beats - never to gate correctness.
 *
 * Selector map (source of truth = the components themselves):
 *   Intake modal (c-rfq-intake-modal):
 *     - c-picklist accessible-label="Line of Business" / "Line of Coverage"
 *     - footer brand button "Save & Continue"
 *   Rate-plan modal (inline in c-rfq-workspace-eb, .eb-rp-modal):
 *     - launchers: .eb-hc-new-plan ("New Rate Plan"),
 *                  .eb-hc-prior-plan ("Add Prior Rate Plan")
 *     - step-1 c-picklists by aria-label: Plan Type / Geo State /
 *       Frequency / Currency
 *     - tier multi-select trigger #eb-rp-tier-trigger, options are
 *       input.eb-rate__multi-input[data-id="employeeOnly|employeeSpouse|
 *       employeeChildren|employeeFamily"]
 *     - footer brand button = Next (step 1) then Save Plan (step 2)
 *     - step-2 FTE inputs input.eb-hc-input[data-key="…"]
 *   Wizard steps: footer "Proceed" (button.continue) advances census →
 *     coverages → benefits → review.
 *   Coverages (c-eb-core-coverages): input.ecv-input[data-field="min|max"].
 *   Benefits (c-eb-benefits-copays): .ebc-tier-acc__head, .ebc-tier-add,
 *     .ebc-tier-row__input, .ebc-cat-acc__head, input.ebc-input.
 *   Review: buttons "+ Add Another Line of Coverage" / "Add to Submission
 *     Board".
 *   Submission board (c-submission-board): input[data-bundle-id],
 *     input[data-id], .sb-caret-btn, .sb-foot .sb-btn_brand, and the
 *     rating modal input.sb-rating__radio + .sb-rating-modal__footer
 *     .sb-btn_brand.
 *
 * FTE headcount: 10 per tier across Employee / Employee + Spouse /
 * Employee + Children = 30 enrolled total (per the demo brief). Employee
 * + Family is intentionally NOT selected.
 */

const FTE = 10; // per tier → 30 total across the three seeded tiers

// Tier ids map 1:1 to HEADCOUNT_TIERS keys in rfqWorkspaceEb.js. We want
// the three-tier scope from the brief; employeeFamily is deliberately
// omitted.
const TIER_IDS = ['employeeOnly', 'employeeSpouse', 'employeeChildren'];

const RP_BRAND_BTN = '.eb-rp-modal__footer-actions .brand';

// Tick a checkbox / radio robustly: the control may sit behind a faux
// SLDS glyph (visually hidden), so reach it with deepOne and glow the
// nearest visible ancestor before flipping it with a single native click.
async function tick(api, selector, { nth = 0 } = {}) {
  const box = api.deepAll(selector)[nth];
  if (!box) return false;
  const host = box.closest('tr, li, label, .slds-form-element') || box;
  await api.point(host);
  api.setChecked(box, true);
  await api.dwell(api.beats.beat);
  return true;
}

// ── Rate-plan modal (2-step) ─────────────────────────────────────────
// `prior:true` uses the cross-LOC "Add Prior Rate Plan" seed (Dental
// reusing Medical's config) when it's on offer; otherwise builds fresh.
async function buildRatePlan(api, { planLabel, prior = false } = {}) {
  let seeded = false;
  if (prior) {
    await api.step(`Seeding ${planLabel}'s rate plan from the prior LOC`);
    const priorBtn = await api.click('.eb-hc-prior-plan', {
      optional: true,
      timeout: 4000,
      expect: '.eb-rp-modal'
    });
    seeded = !!priorBtn;
  }
  if (!seeded) {
    await api.step(`Launching the rate-plan builder for ${planLabel}`);
    await api.click('.eb-hc-new-plan', { expect: '.eb-rp-modal' });
  }

  await api.scopeToModal();

  if (!seeded) {
    // Step 1 - the four required picklists (targeted by accessible-label,
    // so ordering can't drift) + the eligible-tier multi-select.
    await api.step('Rate plan type - Fully Insured Health');
    await api.picklist('Fully Insured Health', { label: 'Plan Type' });
    await api.step('Geo state - California');
    await api.picklist('California', { label: 'Geo State' });
    await api.step('Billing frequency - Annual');
    await api.picklist('Annual', { label: 'Frequency' });
    await api.step('Currency - USD');
    await api.picklist('USD', { label: 'Currency' });

    await api.step('Eligible tiers - Employee, +Spouse, +Children');
    await api.multiPick('#eb-rp-tier-trigger', TIER_IDS);
  } else {
    await api.step('Prior config carried over - confirming the details');
    await api.dwell(api.beats.read);
  }

  // Advance to Step 2 (Enrollment Headcount). Gate on an FTE input.
  await api.step('Next → enrollment headcount');
  await api.click(RP_BRAND_BTN, { expect: 'input.eb-hc-input' });

  await api.step(`Entering FTE headcount - ${FTE} per tier, ${FTE * TIER_IDS.length} total`);
  for (const id of TIER_IDS) {
    await api.type(`input.eb-hc-input[data-key="${id}"]`, FTE, { optional: true });
  }

  // Save Plan closes the modal. Gate on the modal being gone.
  await api.step('Saving the rate plan');
  await api.click(RP_BRAND_BTN, { gone: '.eb-rp-modal' });
  api.clearScope();
}

// ── Coverages → Benefits → Review for the current LOC ────────────────
async function walkCoveragesToReview(api, { locLabel }) {
  // Census → Coverages. The census "Proceed" enables once FTE total > 0.
  await api.step(`Proceeding to Core Plan Coverages (${locLabel})`);
  await api.clickText('button', 'Proceed', { expect: '.ecv-seg__head' });

  // The in-scope segment renders expanded by default, so its Min/Max
  // range inputs are live - fill deductible + out-of-pocket caps.
  await api.step('Setting deductible & out-of-pocket caps');
  await api.type('input.ecv-input[data-field="min"]', 500, { nth: 0, optional: true });
  await api.type('input.ecv-input[data-field="max"]', 5000, { nth: 0, optional: true });
  await api.type('input.ecv-input[data-field="min"]', 1000, { nth: 1, optional: true });
  await api.type('input.ecv-input[data-field="max"]', 9000, { nth: 1, optional: true });

  // Coverages → Benefits.
  await api.step('Proceeding to Benefits & Copays');
  await api.clickText('button', 'Proceed', { expect: '.ebc-seg__head' });

  // Benefits: name the network tiers, add a second tier, then open the
  // first category and enter representative copays.
  await api.step('Opening Tier Details to define network tiers');
  await api.click('.ebc-tier-acc__head', { optional: true, expect: '.ebc-tier-row__input' });
  await api.type('.ebc-tier-row__input', 'In-Network', { nth: 0, optional: true });

  await api.step('Adding an Out-of-Network tier');
  // Adding a tier appends a second .ebc-tier-row__input - wait for it.
  await api.click('.ebc-tier-add', {
    optional: true,
    expect: '.ebc-tier-row__input'
  });
  await api.waitFor(() => api.all('.ebc-tier-row__input').length > 1, { timeout: 4000 });
  await api.type('.ebc-tier-row__input', 'Out-of-Network', { nth: 1, optional: true });

  await api.step('Entering per-encounter copays');
  // Opening a category closes Tier Details (single-open siblings) and
  // reveals the benefit tab panel with cost inputs.
  await api.click('.ebc-cat-acc__head', { nth: 0, optional: true, expect: 'input.ebc-input' });
  await api.type('input.ebc-input', 25, { nth: 0, optional: true });
  await api.type('input.ebc-input', 40, { nth: 1, optional: true });

  // Benefits → Review.
  await api.step('Proceeding to Review & Publish');
  await api.clickText('button', 'Proceed');
  // Gate on the Review fork CTAs being present.
  await api.waitFor(
    () =>
      api.byText('button', 'Add to Submission Board') ||
      api.byText('button', 'Add Another Line of Coverage'),
    { timeout: 9000 }
  );
  await api.step('Review - Agentforce summary + quote details');
  await api.click('.review-acc__head', { nth: 1, optional: true });
  await api.dwell(api.beats.scene);
}

export default async function runAcmeEbDemo(api) {
  await api.step('Welcome - auto-quoting Acme Manufacturing\u2019s benefits renewal', 1600);

  // ── 1. Kick off a new RFQ from the account quick actions ──────────
  await api.step('Acme Manufacturing - starting a guided RFQ');
  // The caret is a click-to-toggle menu; with the single-activation fix
  // it now opens and stays open. Gate on the menu item appearing.
  await api.click('.action-dropdown-btn', { expect: 'a[data-action="start-rfq"]' });
  await api.click('a[data-action="start-rfq"]', { expect: '.slds-modal.slds-fade-in-open' });

  // ── 2. Intake modal - Group Medical ───────────────────────────────
  await api.scopeToModal();
  await api.step('Line of Business - Employee Benefits');
  await api.picklist('Employee Benefits', { label: 'Line of Business' });
  await api.step('Line of Coverage - Group Medical');
  await api.picklist('Group Medical', { label: 'Line of Coverage' });
  await api.step('Save & Continue into the guided wizard');
  // Save & Continue spawns the workspace tab; gate on the census
  // "New Rate Plan" launcher rendering.
  await api.clickText('button', 'Save & Continue', { expect: '.eb-hc-new-plan' });
  api.clearScope();

  // ── 3. Group Medical: rate plan + census + coverages/benefits ─────
  await buildRatePlan(api, { planLabel: 'Group Medical' });
  await walkCoveragesToReview(api, { locLabel: 'Group Medical' });

  // ── 4. Bundle a second line of coverage - Group Dental ────────────
  // "+ Add Another Line of Coverage" saves Group Medical to the bundle
  // AND opens the intake modal pre-scoped to add a sibling LOC.
  await api.step('Bundling a second line of coverage - Group Dental');
  const addLoc = await api.clickText('button', 'Add Another Line of Coverage', {
    optional: true,
    timeout: 6000,
    expect: '.slds-modal.slds-fade-in-open'
  });

  if (addLoc) {
    await api.scopeToModal();
    await api.step('Line of Coverage - Group Dental');
    await api.picklist('Group Dental', { label: 'Line of Coverage' });
    await api.step('Save & Continue');
    await api.clickText('button', 'Save & Continue', { expect: '.eb-hc-new-plan' });
    api.clearScope();

    // Dental reuses Medical's rate-plan config via the prior-plan seed,
    // then still captures its own FTE headcount.
    await buildRatePlan(api, { planLabel: 'Group Dental', prior: true });
    await walkCoveragesToReview(api, { locLabel: 'Group Dental' });

    await api.step('Adding the bundle to the Submission Board');
    await api.clickText('button', 'Add to Submission Board', {
      expect: 'c-submission-board'
    });
  } else {
    // Single-LOC fallback: still route what we have.
    await api.step('Adding Group Medical to the Submission Board');
    await api.clickText('button', 'Add to Submission Board', {
      optional: true,
      expect: 'c-submission-board'
    });
  }

  // ── 5. Submission Board - route the bundle to carriers ────────────
  await api.step('Opening the Submission Board');
  await api.waitForVisible('c-submission-board', { timeout: 9000 });

  await api.step('Selecting the bundled RFQs to route');
  // Expand the bundle (cosmetic) then check its parent box - that selects
  // every LOC in the bundle at once.
  await api.click('.sb-caret-btn', { optional: true });
  const pickedBundle = await tick(api, 'input[type="checkbox"][data-bundle-id]');
  if (!pickedBundle) {
    // Standalone rows: tick each ready RFQ row instead.
    const rows = api.deepAll('input[type="checkbox"][data-id]');
    for (let i = 0; i < Math.min(rows.length, 4); i += 1) {
      await tick(api, 'input[type="checkbox"][data-id]', { nth: i });
    }
  }

  await api.step('Route to Carriers');
  // The route CTA enables once at least one RFQ is selected; waiting for
  // interactability guarantees the selection registered first. Routing
  // opens the QuinStreet rating modal directly.
  await api.click('.sb-foot .sb-btn_brand', { expect: 'input.sb-rating__radio' });

  // ── 6. QuinStreet rating screen - pick a quote ────────────────────
  await api.step('QuinStreet rating results - selecting the best quote');
  await tick(api, 'input.sb-rating__radio');
  await api.step('Confirming the selected quote');
  await api.click('.sb-rating-modal__footer .sb-btn_brand');

  await api.step('Bundle sent to carrier - quotes will return via Slack', 2200);
}
