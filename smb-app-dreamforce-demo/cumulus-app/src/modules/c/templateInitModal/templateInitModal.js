import { LightningElement, api, track } from 'lwc';

/**
 * c-template-init-modal
 *
 * Pre-builder modal for the "+ New Template" flow on both the
 * RFQ Setup and Comparison Setup dashboards. Captures the two
 * scoping picks (Line of Business → Line of Coverage) up front so
 * the builder pane can immediately render the right pipeline and
 * filtered Root Product options.
 *
 * The modal is fully stateless about RFQ vs Comparison aside from
 * its title - pass `kind` in to vary the copy.
 *
 * Events:
 *   continue → { lob, loc }   user clicked Continue
 *   cancel   → ()             user dismissed (Cancel / overlay / Esc)
 */

// Scoped to Personal Lines + Group Benefits only - Commercial Lines
// is out of scope for this build.
const LOB_OPTIONS = [
  { value: 'PERSONAL_LINES', label: 'Personal Lines' },
  { value: 'GROUP_BENEFITS', label: 'Group Benefits' }
];

const LOC_OPTIONS_BY_LOB = {
  PERSONAL_LINES: [
    { value: 'AUTO', label: 'Auto' },
    { value: 'HOME', label: 'Home/Dwelling' }
  ],
  GROUP_BENEFITS: [
    { value: 'MEDICAL', label: 'Medical' },
    { value: 'DENTAL',  label: 'Dental' },
    { value: 'VISION',  label: 'Vision' }
  ]
};

export default class TemplateInitModal extends LightningElement {
  // 'rfq' | 'compare' - drives header copy only.
  @api kind = 'rfq';
  // The host opens/closes via the `open` flag; the modal owns its
  // own field state so each open starts fresh.
  _open = false;
  @api
  get open() { return this._open; }
  set open(v) {
    const next = !!v;
    if (this._open === next) return;
    this._open = next;
    if (next) {
      // Reset every time the modal opens - picks shouldn't leak
      // between "+ New" invocations.
      this.lob = null;
      this.loc = null;
    }
  }

  @track lob = null;
  @track loc = null;

  // ── View-model ────────────────────────────────────────────────
  get title() {
    return this.kind === 'compare'
      ? 'New Comparison Template'
      : 'New RFQ Template';
  }
  get continueLabel() { return 'Continue'; }

  get lobOptions() {
    return LOB_OPTIONS.map((o) => ({
      ...o,
      selected: this.lob === o.value
    }));
  }
  get locOptions() {
    if (!this.lob) return [];
    return (LOC_OPTIONS_BY_LOB[this.lob] || []).map((o) => ({
      ...o,
      selected: this.loc === o.value
    }));
  }
  get isLocDisabled() { return !this.lob; }
  get isContinueDisabled() { return !this.lob || !this.loc; }

  // ── Handlers ──────────────────────────────────────────────────
  handleLobChange(event) {
    this.lob = event.detail.value || null;
    // LOB → LOC cascade - clearing LOB clears LOC.
    this.loc = null;
  }
  handleLocChange(event) {
    this.loc = event.detail.value || null;
  }
  handleCancel() {
    this._dismiss();
  }
  // Backdrop click - close. The dialog itself swallows clicks via
  // stopPropagation in the template.
  handleBackdropClick() {
    this._dismiss();
  }
  handleDialogClick(event) {
    event.stopPropagation();
  }
  handleKeydown(event) {
    if (event.key === 'Escape') this._dismiss();
  }
  handleContinue() {
    if (this.isContinueDisabled) return;
    this.dispatchEvent(
      new CustomEvent('continue', {
        detail: { lob: this.lob, loc: this.loc },
        bubbles: true,
        composed: true
      })
    );
  }
  _dismiss() {
    this.dispatchEvent(
      new CustomEvent('cancel', {
        bubbles: true,
        composed: true
      })
    );
  }
}
