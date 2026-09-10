import { LightningElement, api } from 'lwc';
import { ALL_VALUE, DEFAULT_SORT } from 'data/templateScope';

/**
 * c-template-list-toolbar
 *
 * SLDS 2 filter + sort bar for template dashboards. Closed state is
 * two bare icon buttons (Filter, Sort). Each opens a menu of
 * menuitemradio options - not labeled comboboxes. Parent owns filter
 * state and applies data/templateScope.filterAndSort.
 *
 * Events: lobchange, locchange, sortchange, clear - each change
 * event carries detail { value } to match the prior c-picklist
 * contract.
 */
export default class TemplateListToolbar extends LightningElement {
  @api lob = ALL_VALUE;
  @api loc = ALL_VALUE;
  @api sortBy = DEFAULT_SORT;
  @api lobOptions = [];
  @api locOptions = [];
  @api sortOptions = [];
  @api matchCount = 0;
  @api totalCount = 0;

  openMenu = null;

  get filtersActive() {
    return this.lob !== ALL_VALUE || this.loc !== ALL_VALUE;
  }
  get sortActive() {
    return this.sortBy !== DEFAULT_SORT;
  }
  get showClear() {
    return this.filtersActive || this.sortActive;
  }
  get isFilterOpen() {
    return this.openMenu === 'filter';
  }
  get isSortOpen() {
    return this.openMenu === 'sort';
  }
  get hasOpenMenu() {
    return this.openMenu === 'filter' || this.openMenu === 'sort';
  }

  get filterWrapClass() {
    return this.isFilterOpen ? 'tlt-anchor is-open' : 'tlt-anchor';
  }
  get sortWrapClass() {
    return this.isSortOpen ? 'tlt-anchor is-open' : 'tlt-anchor';
  }
  get filterBtnClass() {
    return this._iconClass(this.isFilterOpen, this.filtersActive);
  }
  get sortBtnClass() {
    return this._iconClass(this.isSortOpen, this.sortActive);
  }

  get decoratedLobOptions() {
    return this._decorate(this.lobOptions, this.lob);
  }
  get decoratedLocOptions() {
    return this._decorate(this.locOptions, this.loc);
  }
  get decoratedSortOptions() {
    return this._decorate(this.sortOptions, this.sortBy);
  }

  _iconClass(isOpen, isActive) {
    const cls = [
      'slds-button',
      'slds-button_icon',
      'slds-button_icon-bare',
      'tlt-icon'
    ];
    if (isOpen) cls.push('slds-is-open');
    if (isActive) cls.push('slds-is-selected', 'is-active');
    return cls.join(' ');
  }
  _decorate(options, selected) {
    const list = Array.isArray(options) ? options : [];
    const selectedStr = selected === null || selected === undefined ? '' : String(selected);
    return list.map((o) => {
      const value = o && o.value;
      const isSelected = String(value) === selectedStr;
      const cls = ['tlt-menu__item'];
      if (isSelected) cls.push('is-selected');
      return {
        value,
        label: o && o.label,
        isSelected,
        cls: cls.join(' ')
      };
    });
  }

  handleFilterToggle() {
    if (this.openMenu === 'filter') {
      this.openMenu = null;
    } else {
      this._open('filter');
    }
  }
  handleSortToggle() {
    if (this.openMenu === 'sort') {
      this.openMenu = null;
    } else {
      this._open('sort');
    }
  }
  handleScrim() {
    this._close(true);
  }
  handleClear() {
    this.openMenu = null;
    this.dispatchEvent(new CustomEvent('clear'));
  }

  handleFilterSelect(event) {
    const group = event.currentTarget.dataset.group;
    const value = event.currentTarget.dataset.value;
    const name = group === 'loc' ? 'locchange' : 'lobchange';
    this.dispatchEvent(new CustomEvent(name, { detail: { value } }));
  }
  handleSortSelect(event) {
    const value = event.currentTarget.dataset.value;
    this.openMenu = null;
    this.dispatchEvent(new CustomEvent('sortchange', { detail: { value } }));
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    Promise.resolve().then(() => this._focusTrigger('sort'));
  }

  handleToolbarKeydown(event) {
    if (!this.openMenu) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const trigger = event.target.closest('button.tlt-icon');
        if (!trigger) return;
        event.preventDefault();
        const which =
          trigger.getAttribute('aria-label') === 'Sort templates'
            ? 'sort'
            : 'filter';
        this._open(which);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this._close(true);
      return;
    }
    if (event.key === 'Tab') {
      this.openMenu = null;
      return;
    }
    if (
      event.key === 'ArrowDown' ||
      event.key === 'ArrowUp' ||
      event.key === 'Home' ||
      event.key === 'End'
    ) {
      this._moveMenuFocus(event);
    }
  }

  _open(which) {
    this.openMenu = which;
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    Promise.resolve().then(() => this._focusActiveItem());
  }
  _close(restoreFocus) {
    const which = this.openMenu;
    this.openMenu = null;
    if (restoreFocus && which) {
      // eslint-disable-next-line @lwc/lwc/no-async-operation
      Promise.resolve().then(() => this._focusTrigger(which));
    }
  }
  _focusTrigger(which) {
    const selector =
      which === 'sort'
        ? 'button[aria-label="Sort templates"]'
        : 'button[aria-label="Filter templates"]';
    const btn = this.template.querySelector(selector);
    if (btn) btn.focus();
  }
  _focusActiveItem() {
    const menu = this.template.querySelector('.tlt-menu');
    if (!menu) return;
    const selected = menu.querySelector('[role="menuitemradio"][aria-checked="true"]');
    const fallback = menu.querySelector('[role="menuitemradio"]');
    const target = selected || fallback;
    if (target) target.focus();
  }
  _moveMenuFocus(event) {
    const menu = this.template.querySelector('.tlt-menu');
    if (!menu) return;
    const items = [...menu.querySelectorAll('[role="menuitemradio"]')];
    if (!items.length) return;
    event.preventDefault();
    const current = items.indexOf(event.target.closest('[role="menuitemradio"]'));
    let next = 0;
    if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = items.length - 1;
    } else if (event.key === 'ArrowDown') {
      next = current < 0 ? 0 : (current + 1) % items.length;
    } else {
      next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length;
    }
    items[next].focus();
  }
}
