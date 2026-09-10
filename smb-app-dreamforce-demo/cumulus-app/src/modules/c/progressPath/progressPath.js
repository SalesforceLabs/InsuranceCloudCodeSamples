import { LightningElement, api } from 'lwc';

// Default step labels - Personal Auto wizard. Intake now lives in the
// Intake modal (c-rfq-intake-modal), so the wizard starts at Vehicles &
// Drivers. The EB wizard overrides via the @api stepDefs prop with its own
// labels (Employee Census, Rules & Contributions, etc.).
const DEFAULT_STEP_DEFS = [
  { id: 'vehicles', label: 'Schedule of Vehicles', meta: 'Roster & Assignments' },
  { id: 'coverages', label: 'Policy Coverages', meta: 'Limits & Deductibles' },
  { id: 'review', label: 'Market Routing', meta: 'Review & Submit' }
];

export default class ProgressPath extends LightningElement {
  @api activeStep = 'vehicles';
  @api stepDefs;

  get effectiveStepDefs() {
    return Array.isArray(this.stepDefs) && this.stepDefs.length > 0
      ? this.stepDefs
      : DEFAULT_STEP_DEFS;
  }

  get steps() {
    const defs = this.effectiveStepDefs;
    const idx = defs.findIndex((s) => s.id === this.activeStep);
    return defs.map((step, i) => {
      const done = i < idx;
      const current = i === idx;
      let className = 'step';
      if (done) className += ' is-done';
      if (current) className += ' is-current';
      // SLDS progress-indicator interaction: only completed steps are
      // navigable. Current + upcoming steps stay non-interactive.
      const clickable = done;
      if (clickable) className += ' is-clickable';
      return {
        ...step,
        num: i + 1,
        done,
        current,
        clickable,
        disabled: !clickable,
        ariaCurrent: current ? 'step' : null,
        triggerTitle: clickable ? `Go back to ${step.label}` : step.label,
        className
      };
    });
  }

  // Completed steps fire `stepselect`; the parent workspace re-opens that
  // step (and leaves later steps to be re-confirmed).
  handleStepClick(event) {
    const stepId = event.currentTarget.dataset.stepId;
    if (!stepId) return;
    this.dispatchEvent(
      new CustomEvent('stepselect', {
        detail: { stepId },
        bubbles: true,
        composed: true
      })
    );
  }
}
