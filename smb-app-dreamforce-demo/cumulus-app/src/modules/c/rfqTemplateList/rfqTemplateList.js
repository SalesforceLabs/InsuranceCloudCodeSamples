import { LightningElement, track } from 'lwc';
import {
  getTemplates,
  addTemplate,
  updateTemplate,
  removeTemplate
} from 'data/rfqTemplates';
import {
  ALL_VALUE,
  DEFAULT_SORT,
  SORT_OPTIONS,
  buildLobOptions,
  buildLocOptions,
  locIsValid,
  labelForLob,
  labelForLoc,
  filterAndSort
} from 'data/templateScope';
import { formatUsDate, todayIso } from 'data/dates';

/**
 * c-rfq-template-list
 *
 * Dashboard tile grid for the RFQ Setup workspace's Templates section.
 * Mirrors the visual language of the Quote Comparison Setup dashboard
 * (qcs-template tiles) so the two surfaces feel consistent.
 *
 * Reads templates from data/rfqTemplates; in-place actions
 * (Activate/Deactivate, Clone, Delete) mutate the shared module so
 * the Publish step's saves stay visible. Edit / + New bubble
 * `templatepick` and `templatenew` events the workspace shell uses
 * to navigate into the inline wizard (Initialize / Configure /
 * Publish) with the right context loaded.
 */

const _formatLiveSince = (iso) => formatUsDate(iso);

export default class RfqTemplateList extends LightningElement {
  @track templates = getTemplates();
  @track openMenuId = null;
  @track filterLob = ALL_VALUE;
  @track filterLoc = ALL_VALUE;
  @track sortBy = DEFAULT_SORT;
  sortOptions = SORT_OPTIONS;

  // ── View-model ─────────────────────────────────────────────
  get hasTemplates() {
    return this.templates.length > 0;
  }
  get filteredTemplates() {
    return filterAndSort(this.templates, {
      lob: this.filterLob,
      loc: this.filterLoc,
      sortBy: this.sortBy
    });
  }
  get hasVisibleTiles() {
    return this.filteredTemplates.length > 0;
  }
  get visibleCount() {
    return this.filteredTemplates.length;
  }
  get totalCount() {
    return this.templates.length;
  }
  get lobFilterOptions() {
    return buildLobOptions(this.templates);
  }
  get locFilterOptions() {
    return buildLocOptions(this.templates, this.filterLob);
  }
  get templateTiles() {
    return this.filteredTemplates.map((t) => {
      const isOpen = this.openMenuId === t.id;
      const isActive = !!t.isActive;
      const liveSinceLabel = _formatLiveSince(t.liveSince);
      const scopeParts = [labelForLob(t.lob), labelForLoc(t.coverage || t.loc)].filter(
        Boolean
      );
      const metaParts = [];
      metaParts.push(isActive ? 'Active' : 'Inactive');
      if (t.version) metaParts.push(t.version);
      if (liveSinceLabel) metaParts.push(`Live since ${liveSinceLabel}`);
      return {
        ...t,
        scopeLine: scopeParts.join(' \u00b7 '),
        initial: (t.name || '?').charAt(0).toUpperCase(),
        isOpen,
        isActive,
        activateLabel: isActive ? 'Deactivate' : 'Activate',
        metaLine: metaParts.join(' \u00b7 '),
        tileClass: [
          'rtl-template',
          isActive ? '' : 'is-inactive',
          isOpen ? 'is-menu-open' : ''
        ]
          .filter(Boolean)
          .join(' '),
        moreBtnClass: isOpen
          ? 'rtl-template__more is-open'
          : 'rtl-template__more'
      };
    });
  }

  // ── Filter / sort ──────────────────────────────────────────
  handleFilterLob(event) {
    this.filterLob = event.detail.value;
    this._syncLocFilter();
  }
  handleFilterLoc(event) {
    this.filterLoc = event.detail.value;
  }
  handleFilterSort(event) {
    this.sortBy = event.detail.value;
  }
  handleClearFilters() {
    this.filterLob = ALL_VALUE;
    this.filterLoc = ALL_VALUE;
    this.sortBy = DEFAULT_SORT;
  }
  _syncLocFilter() {
    if (!locIsValid(this.templates, this.filterLob, this.filterLoc)) {
      this.filterLoc = ALL_VALUE;
    }
  }
  _refreshCatalog() {
    this.templates = getTemplates();
    if (!this.templates.length) {
      this.filterLob = ALL_VALUE;
      this.filterLoc = ALL_VALUE;
      this.sortBy = DEFAULT_SORT;
      return;
    }
    this._syncLocFilter();
  }

  // ── Handlers ───────────────────────────────────────────────
  handleToggleMenu(event) {
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    this.openMenuId = this.openMenuId === id ? null : id;
  }
  handleCloseMenu() {
    this.openMenuId = null;
  }

  handleActivate(event) {
    const id = event.currentTarget.dataset.id;
    const current = this.templates.find((t) => t.id === id);
    if (!current) return;
    updateTemplate(id, { isActive: !current.isActive });
    this._refreshCatalog();
    this.openMenuId = null;
  }
  handleClone(event) {
    const id = event.currentTarget.dataset.id;
    const src = this.templates.find((t) => t.id === id);
    if (!src) return;
    const today = todayIso();
    addTemplate({
      ...src,
      id: `${src.id}-copy-${Date.now()}`,
      name: `${src.name} (Copy)`,
      version: 'v0.1',
      liveSince: today,
      isActive: false
    });
    this._refreshCatalog();
    this.openMenuId = null;
  }
  handleDelete(event) {
    const id = event.currentTarget.dataset.id;
    removeTemplate(id);
    this._refreshCatalog();
    this.openMenuId = null;
  }

  // Edit + New bubble up so the workspace navigates into the wizard
  // with the right context. The workspace's handler reads detail.id
  // (Edit) or null (New) and seeds the wizard state accordingly.
  handleEdit(event) {
    const id = event.currentTarget.dataset.id;
    this.openMenuId = null;
    if (!id) return;
    this.dispatchEvent(
      new CustomEvent('templatepick', {
        detail: { id },
        bubbles: true,
        composed: true
      })
    );
  }
  handleNew() {
    this.dispatchEvent(
      new CustomEvent('templatenew', {
        bubbles: true,
        composed: true
      })
    );
  }
}
