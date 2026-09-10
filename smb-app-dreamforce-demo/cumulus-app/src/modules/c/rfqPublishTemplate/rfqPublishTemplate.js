import { LightningElement, api, track } from 'lwc';
import {
  getTemplateById,
  addTemplate,
  updateTemplate
} from 'data/rfqTemplates';

/**
 * c-rfq-publish-template
 *
 * Final-step Publish Template form for the RFQ Setup Workspace.
 * Captures version + validity metadata and the activation toggle,
 * persists the record in data/rfqTemplates, then bubbles a
 * `configurationsave` event the workspace uses to navigate back to
 * the Templates dashboard.
 *
 * Public contract (per workspace directive):
 *   @api rootProduct          - current root id from the shell
 *   @api editingTemplateId    - when set, the form re-hydrates from
 *                                the saved record and updates in
 *                                place on Publish; null for the
 *                                "+ New Template" flow.
 *   @api newTemplateDefaults  - optional scope + name for the record
 *                                a "+ New Template" publish creates.
 *   @api save()               - host-driven publish; the host owns the
 *                                primary CTA, so this form renders no
 *                                button of its own.
 *   event "configurationsave" - bubbles save intent up to workspace
 *   event "validitychange"    - { canPublish } so a host footer can
 *                                gate its Save button
 */
export default class RfqPublishTemplate extends LightningElement {
  _rootProduct = null;
  _editingTemplateId = null;

  @api
  get rootProduct() {
    return this._rootProduct;
  }
  set rootProduct(value) {
    this._rootProduct = value || null;
  }

  @api
  get editingTemplateId() {
    return this._editingTemplateId;
  }
  set editingTemplateId(value) {
    const next = value || null;
    if (this._editingTemplateId === next) return;
    this._editingTemplateId = next;
    // Re-hydrate form fields from the saved template (Edit mode) or
    // reset to defaults (+ New flow).
    if (next) {
      const tpl = getTemplateById(next);
      if (tpl) {
        this.versionName = tpl.version || 'v1.0';
        this.effectiveStartDate = tpl.liveSince || '';
        this.effectiveEndDate = tpl.effectiveEndDate || '';
        this.templateStatus = tpl.isActive ? 'active' : 'draft';
        this._scheduleValidityEmit();
        return;
      }
    }
    this.versionName = 'v1.0';
    this.effectiveStartDate = '';
    this.effectiveEndDate = '';
    this.templateStatus = 'draft';
    this._scheduleValidityEmit();
  }

  // Scope + name for the record a "+ New Template" publish creates.
  // A host that captured LOB / LOC up front (c-rfq-template-wizard)
  // passes them so the tile carries the right badge and a scoped
  // name. Unset - as in c-insurance-setup-workspace - keeps the
  // Group Benefits defaults this form has always written.
  _newTemplateDefaults = null;
  @api
  get newTemplateDefaults() {
    return this._newTemplateDefaults;
  }
  set newTemplateDefaults(value) {
    this._newTemplateDefaults = value || null;
  }

  // Host-driven publish. Mirrors c-quote-compare-setup's @api save()
  // so a wizard footer can own the primary CTA.
  @api
  save() {
    this.handlePublish();
  }

  // Versioning + validity state - mirrors the c-agentforce-setup
  // Publish step shape so the markup transfers 1:1. Defaults seed
  // the form with sensible starting values so the admin sees real
  // copy on first paint.
  @track versionName = 'v1.0';
  @track effectiveStartDate = '';
  @track effectiveEndDate = '';
  @track templateStatus = 'draft'; // 'draft' | 'active'

  // ── View-model getters ─────────────────────────────────────
  get isEndBeforeStart() {
    if (!this.effectiveStartDate || !this.effectiveEndDate) return false;
    return this.effectiveEndDate < this.effectiveStartDate;
  }
  get versioningSummary() {
    if (!this.versionName && !this.effectiveStartDate && !this.effectiveEndDate) {
      return 'Stamp this template with a version name and active window before publishing.';
    }
    const parts = [];
    if (this.versionName) parts.push(this.versionName);
    if (this.effectiveStartDate && this.effectiveEndDate) {
      parts.push(`${this.effectiveStartDate} → ${this.effectiveEndDate}`);
    } else if (this.effectiveStartDate) {
      parts.push(`from ${this.effectiveStartDate}`);
    } else if (this.effectiveEndDate) {
      parts.push(`until ${this.effectiveEndDate}`);
    }
    return parts.join(' · ');
  }
  get isTemplateActive() {
    return this.templateStatus === 'active';
  }
  get templateStatusLabel() {
    return this.isTemplateActive ? 'Active' : 'Draft';
  }
  get templateStatusTrackClass() {
    return this.isTemplateActive
      ? 'rpt-toggle__track is-on'
      : 'rpt-toggle__track';
  }
  get publishDisabled() {
    if (!this.versionName) return true;
    if (!this.effectiveStartDate) return true;
    if (!this.effectiveEndDate) return true;
    if (this.isEndBeforeStart) return true;
    return false;
  }

  // ── Validity broadcast ─────────────────────────────────────
  // A host that owns the primary CTA (c-rfq-template-wizard's footer)
  // can't read this component's getters reactively, so publish
  // readiness is pushed out on every change. Deferred to a microtask
  // so an @api setter never dispatches mid-render. Non-bubbling, like
  // the playbook's assignmentschange - only the direct parent cares.
  connectedCallback() {
    this._scheduleValidityEmit();
  }
  _scheduleValidityEmit() {
    if (this._validityEmitQueued) return;
    this._validityEmitQueued = true;
    Promise.resolve().then(() => {
      this._validityEmitQueued = false;
      this.dispatchEvent(
        new CustomEvent('validitychange', {
          detail: { canPublish: !this.publishDisabled }
        })
      );
    });
  }

  // ── Handlers ───────────────────────────────────────────────
  handleVersionNameChange(event) {
    this.versionName = event.target.value || '';
    this._scheduleValidityEmit();
  }
  handleStartDateChange(event) {
    this.effectiveStartDate = event.detail?.value ?? event.target.value ?? '';
    this._scheduleValidityEmit();
  }
  handleEndDateChange(event) {
    this.effectiveEndDate = event.detail?.value ?? event.target.value ?? '';
    this._scheduleValidityEmit();
  }
  handleTemplateStatusToggle() {
    this.templateStatus = this.isTemplateActive ? 'draft' : 'active';
  }
  handlePublish() {
    if (this.publishDisabled) return;
    const payload = {
      version: this.versionName,
      liveSince: this.effectiveStartDate,
      effectiveEndDate: this.effectiveEndDate,
      isActive: this.isTemplateActive,
      rootProduct: this._rootProduct
    };
    let savedId = this._editingTemplateId;
    if (this._editingTemplateId) {
      updateTemplate(this._editingTemplateId, payload);
    } else {
      const defaults = this._newTemplateDefaults || {};
      const created = addTemplate({
        name: defaults.name || this._defaultNameForNewTemplate(),
        lob: defaults.lob || 'GROUP_BENEFITS',
        coverage: defaults.coverage || 'HEALTH',
        badge: defaults.badge || 'GROUP BENEFITS',
        ...payload
      });
      savedId = created.id;
    }
    this.dispatchEvent(
      new CustomEvent('configurationsave', {
        detail: {
          stepId: 'publish',
          source: 'rfqPublishTemplate',
          id: savedId,
          rootProduct: this._rootProduct,
          versionName: this.versionName,
          effectiveStartDate: this.effectiveStartDate,
          effectiveEndDate: this.effectiveEndDate,
          templateStatus: this.templateStatus
        },
        bubbles: true,
        composed: true
      })
    );
  }

  // Generated name for + New Template flow when the wizard doesn't
  // yet collect a friendly label. Reads the version so successive
  // bumps stay distinguishable on the dashboard.
  _defaultNameForNewTemplate() {
    const stamp = this.versionName || `v${Date.now()}`;
    return `RFQ Template ${stamp}`;
  }
}
