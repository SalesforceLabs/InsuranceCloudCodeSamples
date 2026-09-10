import { LightningElement, api, track } from 'lwc';

/**
 * c-pa-view-modal - details dialog for a vehicle or driver, opened from the
 * eye (view) icon in the asset tree. Each field has an inline pencil that
 * flips that single line into an editable input. The parent may pass an
 * Agentforce summary which renders as an AI insight card.
 *
 * @api open      - controls render.
 * @api heading   - record title.
 * @api subtitle  - eyebrow ("Vehicle" | "Driver").
 * @api kind      - 'vehicle' | 'driver' (drives the header glyph).
 * @api fields    - [{ label, value }] field rows.
 * @api summary   - optional Agentforce summary string.
 *
 * Events: close.
 */
export default class PaViewModal extends LightningElement {
  @api open = false;
  @api heading = '';
  @api subtitle = '';
  @api kind = 'vehicle';
  @api summary = '';

  _fields = [];
  @track rows = [];

  @api
  get fields() {
    return this._fields;
  }
  set fields(value) {
    this._fields = value || [];
    this.rows = (this._fields || []).map((f, i) => ({
      key: `f${i}`,
      label: f.label,
      value: f.value,
      editing: false
    }));
  }

  get isVehicle() {
    return this.kind === 'vehicle';
  }
  get isDriver() {
    return this.kind === 'driver';
  }
  get hasSummary() {
    // Composed with the global Agentforce kill-switch so the summary
    // panel stays hidden everywhere while the markup + styles + the
    // underlying summary text source stay in place. Flip the toggle
    // when we're ready to bring the panel back.
    return this.showAgentforceSummary && !!this.summary;
  }
  get showAgentforceSummary() {
    return false;
  }

  handleClose() {
    this.dispatchEvent(new CustomEvent('close'));
  }
  stopPropagation(event) {
    event.stopPropagation();
  }

  // ── Inline edit (pencil per line) ───────────────────────────────
  handleEdit(event) {
    const key = event.currentTarget.dataset.key;
    this.rows = this.rows.map((r) => ({ ...r, editing: r.key === key }));
    // Focus the freshly-rendered input.
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    requestAnimationFrame(() => {
      const input = this.template.querySelector(
        `input[data-key="${key}"]`
      );
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  handleInput(event) {
    const key = event.currentTarget.dataset.key;
    const value = event.currentTarget.value;
    this.rows = this.rows.map((r) => (r.key === key ? { ...r, value } : r));
  }

  handleConfirm(event) {
    const key = event.currentTarget.dataset.key;
    this.rows = this.rows.map((r) =>
      r.key === key ? { ...r, editing: false } : r
    );
  }

  handleKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.handleConfirm(event);
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      const key = event.currentTarget.dataset.key;
      this.rows = this.rows.map((r) =>
        r.key === key ? { ...r, editing: false } : r
      );
    }
  }
}
