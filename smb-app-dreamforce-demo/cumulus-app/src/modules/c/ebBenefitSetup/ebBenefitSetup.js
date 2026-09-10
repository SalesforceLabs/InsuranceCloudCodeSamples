import { LightningElement, api, track } from 'lwc';
import {
  getAllBenefitCategories,
  setIncluded,
  setDataType,
  SETTABLE_DATA_TYPES
} from 'data/ebCatalog';

/**
 * c-eb-benefit-setup - design-time widget for EB Plan Benefits & Copays.
 *
 * Mounted inside c-rfq-playbook-setup when the GROUP_BENEFITS::HEALTH
 * blueprint is loaded and the admin is on the Plan Benefits stage. Tabs
 * are Benefit Categories filtered by the active Root Products. Each
 * tab renders an attribute table with name + data-type chip +
 * "Include in RFQ" toggle.
 *
 * Tab overflow: the tab strip is fixed-width. As many tabs as fit
 * render inline; the rest fall into a trailing "More" popover with a
 * chevron. Resize collapses or expands the visible set automatically.
 *
 * @api selectedRootIds - string[] of root product ids in scope.
 */
export default class EbBenefitSetup extends LightningElement {
  _selectedRootIds = ['medical'];
  @track _activeTabKey = null;
  // Re-render token bumped after every catalog mutation.
  @track _tick = 0;

  // Overflow state: how many tabs render inline. The rest spill into
  // the "More" popover. Defaults high so the first render shows
  // everything; renderedCallback shrinks down if the strip overflows.
  @track _visibleTabCount = 999;
  @track _moreOpen = false;
  // Inline style for the open More menu - positioned fixed to the
  // viewport so it escapes the `overflow: hidden` clipping on the
  // tab strip (which is required for overflow detection).
  @track _moreMenuStyle = '';

  _resizeObserver = null;

  @api
  get selectedRootIds() {
    return this._selectedRootIds;
  }
  set selectedRootIds(v) {
    const next = Array.isArray(v) && v.length ? v.slice() : ['medical'];
    this._selectedRootIds = next;
    const tabs = this._buildTabs();
    if (!tabs.length) {
      this._activeTabKey = null;
    } else if (!tabs.some((t) => t.key === this._activeTabKey)) {
      this._activeTabKey = tabs[0].key;
    }
    // Reset the visible-count cap so renderedCallback can re-converge
    // for the new tab set.
    this._visibleTabCount = tabs.length || 999;
    this._moreOpen = false;
  }

  // ── View-model ──────────────────────────────────────────────
  get _decoratedTabs() {
    return this._buildTabs().map((t) => {
      const isActive = t.key === this._activeTabKey;
      return {
        ...t,
        cls: isActive ? 'eb-bs__tab eb-bs__tab_active' : 'eb-bs__tab',
        ariaSelected: isActive ? 'true' : 'false',
        tabIndex: isActive ? '0' : '-1'
      };
    });
  }

  get visibleTabs() {
    return this._decoratedTabs.slice(0, this._visibleTabCount);
  }

  get overflowTabs() {
    return this._decoratedTabs.slice(this._visibleTabCount);
  }

  get hasOverflow() {
    return this.overflowTabs.length > 0;
  }

  // Highlight the More button when the active tab lives in overflow,
  // so the broker can still see selection state at a glance.
  get moreBtnCls() {
    const inOverflow = this.overflowTabs.some(
      (t) => t.key === this._activeTabKey
    );
    const base = inOverflow ? 'eb-bs__more eb-bs__more_active' : 'eb-bs__more';
    return this._moreOpen ? `${base} is-open` : base;
  }
  get moreAriaExpanded() {
    return this._moreOpen ? 'true' : 'false';
  }
  get isMoreOpen() {
    return this._moreOpen;
  }
  get moreMenuItems() {
    return this.overflowTabs.map((t) => ({
      key: t.key,
      label: t.label,
      rootLabel: t.rootLabel,
      cls:
        t.key === this._activeTabKey
          ? 'eb-bs__more-item is-active'
          : 'eb-bs__more-item'
    }));
  }

  get hasTabs() {
    return this._buildTabs().length > 0;
  }

  get activeCategoryRows() {
    this._tick; // keep getter reactive after catalog mutations
    const tab = this._buildTabs().find((t) => t.key === this._activeTabKey);
    if (!tab) return [];
    return tab.attributes.map((a) => ({
      id: a.id,
      label: a.label,
      dataType: a.dataType,
      includedInRfq: a.includedInRfq,
      hint: hintForDataType(a.dataType)
    }));
  }

  // Static option list for the Data Type c-picklist. Same shape for
  // every row, so the menu opens with native SLDS 2 chrome instead of
  // the OS-native dark dropdown a native <select> falls back to.
  // `value={a.dataType}` on the picklist drives the selected state.
  get dataTypeOptions() {
    return SETTABLE_DATA_TYPES.slice();
  }

  // Inline style for the open More menu (see _moreMenuStyle field).
  get moreMenuStyle() {
    return this._moreMenuStyle;
  }

  // ── Handlers ────────────────────────────────────────────────
  handleTabClick(event) {
    const key = event.currentTarget.dataset.key;
    if (key) this._activeTabKey = key;
  }

  handleIncludeToggle(event) {
    const attrId = event.currentTarget.dataset.attr;
    const flag = !!event.currentTarget.checked;
    if (!attrId) return;
    setIncluded('benefit', attrId, flag);
    this._tick = this._tick + 1;
  }

  handleMoreToggle() {
    if (this._moreOpen) {
      this._moreOpen = false;
      this._moreMenuStyle = '';
      return;
    }
    this._moreOpen = true;
    this._positionMoreMenu();
  }
  handleMoreScrim() {
    this._moreOpen = false;
    this._moreMenuStyle = '';
  }
  handleMoreSelect(event) {
    const key = event.currentTarget.dataset.key;
    if (key) this._activeTabKey = key;
    this._moreOpen = false;
    this._moreMenuStyle = '';
  }

  // Design-time data-type picker - flips the attribute's `dataType`
  // in the shared catalog so both Setup and Runtime re-render with
  // the new control (Text / Currency / CurrencyRange / Percentage /
  // Picklist). c-picklist forwards the new value in event.detail.value.
  handleDataTypeChange(event) {
    const attrId = event.currentTarget.dataset.attr;
    const value = event.detail && event.detail.value;
    if (!attrId || !value) return;
    setDataType('benefit', attrId, value);
    this._tick = this._tick + 1;
  }

  // ── Lifecycle ───────────────────────────────────────────────
  connectedCallback() {
    const tabs = this._buildTabs();
    this._visibleTabCount = tabs.length;
    if (!this._activeTabKey && tabs.length) {
      this._activeTabKey = tabs[0].key;
    }
  }

  renderedCallback() {
    this._setupResizeObserver();
    this._adjustOverflow();
  }

  disconnectedCallback() {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
  }

  // ── Internal ────────────────────────────────────────────────
  _setupResizeObserver() {
    if (this._resizeObserver) return;
    if (typeof window === 'undefined' || !window.ResizeObserver) return;
    const strip = this.template.querySelector('.eb-bs__tabs');
    if (!strip) return;
    this._resizeObserver = new ResizeObserver(() => {
      // Reset to total - renderedCallback will shrink again if needed,
      // letting tabs grow back when the container gets wider.
      const total = this._buildTabs().length;
      if (total > 0 && this._visibleTabCount !== total) {
        this._visibleTabCount = total;
      }
    });
    this._resizeObserver.observe(strip);
  }

  // Iteratively shrink the visible tab count until the strip stops
  // overflowing. Runs on every render; converges in a few frames
  // because each setState triggers another render+measure cycle.
  _adjustOverflow() {
    const strip = this.template.querySelector('.eb-bs__tabs');
    if (!strip) return;
    const total = this._buildTabs().length;
    if (total === 0) return;
    if (this._visibleTabCount > total) {
      this._visibleTabCount = total;
      return;
    }
    // Tolerance of 1px guards against sub-pixel layout rounding.
    if (
      strip.scrollWidth > strip.clientWidth + 1 &&
      this._visibleTabCount > 1
    ) {
      this._visibleTabCount = this._visibleTabCount - 1;
    }
  }

  // Anchor the More popover to the trigger's viewport rect so it
  // escapes the tab strip's `overflow: hidden`. Falls back to a
  // sane no-op if the trigger isn't measurable yet.
  _positionMoreMenu() {
    const trigger = this.template.querySelector('.eb-bs__more');
    if (!trigger || typeof window === 'undefined') {
      this._moreMenuStyle = '';
      return;
    }
    const r = trigger.getBoundingClientRect();
    const gap = 4;
    const margin = 8;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const maxH = 320;
    const spaceBelow = vh - r.bottom;
    const minWidth = 240;
    // Open up when there isn't room below.
    const openUp = spaceBelow < Math.min(maxH, 200) && r.top > spaceBelow;
    let s = `position:fixed;right:auto;left:${Math.round(
      Math.max(8, r.right - minWidth)
    )}px;min-width:${minWidth}px;`;
    if (openUp) {
      const avail = Math.max(160, Math.min(maxH, r.top - gap - margin));
      s += `bottom:${Math.round(vh - r.top + gap)}px;top:auto;max-height:${Math.round(
        avail
      )}px;`;
    } else {
      const avail = Math.max(160, Math.min(maxH, spaceBelow - gap - margin));
      s += `top:${Math.round(r.bottom + gap)}px;bottom:auto;max-height:${Math.round(
        avail
      )}px;`;
    }
    this._moreMenuStyle = s;
  }

  _buildTabs() {
    return getAllBenefitCategories(this._selectedRootIds).map((c) => ({
      key: `${c.rootId}::${c.id}`,
      rootId: c.rootId,
      rootLabel: c.rootLabel,
      categoryId: c.id,
      label: c.label,
      attributes: c.attributes
    }));
  }
}

function hintForDataType(dt) {
  switch (dt) {
    case 'CurrencyRange':
      return 'Min/Max $ pair';
    case 'Currency':
      // "Single $ amount" hint removed per spec.
      return '';
    case 'Percentage':
      return 'Percentage (0–100%)';
    case 'Picklist':
      return 'Pick from list';
    default:
      return dt;
  }
}
