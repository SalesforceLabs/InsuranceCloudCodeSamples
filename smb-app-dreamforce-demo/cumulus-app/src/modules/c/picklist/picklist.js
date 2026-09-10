import { LightningElement, api } from 'lwc';

/**
 * c-picklist - a fully custom SLDS 2 combobox/listbox.
 *
 * Native <select> renders its open option list with the OS (the
 * "apple picklist"), which CSS cannot style. This component replaces
 * it with a button (role=combobox) that toggles a styled
 * <ul role=listbox> so both the closed control AND the open menu read
 * as SLDS 2.
 *
 * Public API:
 *   options          - [{ value, label }]
 *   value            - currently-selected value (string)
 *   placeholder      - shown when nothing is selected
 *   disabled         - boolean
 *   required         - boolean; sets aria-required on the combobox so
 *                      the asterisk on the caller's visible label is
 *                      also announced by assistive tech
 *   accessible-label - aria-label for the combobox + listbox
 *
 * Emits `change` with detail { value } on selection.
 *
 * Keyboard: ArrowUp/Down, Home/End, Enter/Space to select, Esc to
 * close, type-ahead to jump, with aria-activedescendant tracking the
 * highlighted option (focus stays on the combobox button).
 */
export default class Picklist extends LightningElement {
  @api placeholder = 'Select an option…';
  @api accessibleLabel = '';
  @api disabled = false;
  @api required = false;
  // Two-size system shared across all input controls:
  //   'l' (default) - 2rem (32px) trigger, 0.875rem text. Use in
  //                   forms / setup screens / standard data entry.
  //   's'           - 1.5rem (24px) trigger, 0.75rem text. Use in
  //                   dense tables, inline grid edits, toolbars.
  // Any other value falls back to 'l'.
  @api size = 'l';

  _options = [];
  _value = '';
  isOpen = false;
  activeIndex = -1;
  // Inline style for the open listbox. Positioned fixed to the viewport so
  // the menu escapes any `overflow: auto` ancestor (e.g. a modal body) that
  // would otherwise clip it.
  menuStyle = '';

  _typeBuffer = '';
  _typeTimer = null;

  @api
  get options() {
    return this._options;
  }
  set options(val) {
    this._options = Array.isArray(val) ? val : [];
  }

  @api
  get value() {
    return this._value;
  }
  set value(val) {
    this._value = val === null || val === undefined ? '' : String(val);
  }

  // ── Derived view state ──────────────────────────────────────
  get hasValue() {
    return this._options.some((o) => String(o.value) === this._value);
  }
  get displayLabel() {
    const match = this._options.find((o) => String(o.value) === this._value);
    return match ? match.label : this.placeholder;
  }
  get rootClass() {
    const base = this.isOpen ? 'picklist is-open' : 'picklist';
    return this.size === 's' ? `${base} picklist_size_s` : base;
  }
  get triggerClass() {
    const cls = ['picklist__trigger'];
    if (this.hasValue) cls.push('has-value');
    if (this.size === 's') cls.push('picklist__trigger_size_s');
    return cls.join(' ');
  }
  get valueClass() {
    return this.hasValue
      ? 'picklist__value'
      : 'picklist__value is-placeholder';
  }
  get activeOptionId() {
    return this.isOpen && this.activeIndex >= 0
      ? `picklist-opt-${this.activeIndex}`
      : null;
  }
  // Returns null rather than 'false' when optional so the attribute is
  // dropped from the DOM entirely - an explicit aria-required="false"
  // on every optional picklist in a long coverage list is noise.
  get ariaRequired() {
    return this.required ? 'true' : null;
  }
  get decoratedOptions() {
    return this._options.map((o, i) => {
      const isSelected = String(o.value) === this._value;
      const isActive = i === this.activeIndex;
      const isDisabled = !!o.disabled;
      const cls = ['picklist__option'];
      if (isSelected) cls.push('is-selected');
      if (isActive && !isDisabled) cls.push('is-active');
      if (isDisabled) cls.push('is-disabled');
      return {
        value: o.value,
        label: o.label,
        id: `picklist-opt-${i}`,
        index: i,
        isSelected,
        isDisabled,
        ariaDisabled: isDisabled ? 'true' : 'false',
        cls: cls.join(' ')
      };
    });
  }

  // Return true if the option at `idx` cannot be selected.
  _isDisabledAt(idx) {
    const o = this._options[idx];
    return !!(o && o.disabled);
  }
  // Return the next selectable index in the given direction (+1 / -1),
  // skipping disabled options. Falls back to the current index if the
  // whole list is disabled.
  _nextSelectable(from, dir) {
    const n = this._options.length;
    if (!n) return -1;
    let i = from;
    for (let steps = 0; steps < n; steps += 1) {
      i += dir;
      if (i < 0 || i >= n) return from;
      if (!this._isDisabledAt(i)) return i;
    }
    return from;
  }

  // ── Open / close ────────────────────────────────────────────
  handleToggle() {
    if (this.disabled) return;
    if (this.isOpen) {
      this._close();
    } else {
      this._open();
    }
  }
  _open() {
    this.isOpen = true;
    const sel = this._options.findIndex(
      (o) => String(o.value) === this._value
    );
    let start = sel >= 0 ? sel : 0;
    if (this._isDisabledAt(start)) {
      // Land on the first selectable option instead of a disabled one.
      start = this._nextSelectable(start - 1, 1);
    }
    this.activeIndex = start;
    this._positionMenu();
  }

  // Anchor the fixed-position menu to the trigger's viewport rect, flipping
  // upward and capping its height when there isn't room below.
  _positionMenu() {
    const trigger = this.template.querySelector('.picklist__trigger');
    if (!trigger || typeof window === 'undefined') {
      this.menuStyle = '';
      return;
    }
    const r = trigger.getBoundingClientRect();
    const gap = 4;
    const margin = 8;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const maxH = 288; // 18rem
    const spaceBelow = vh - r.bottom;
    const spaceAbove = r.top;
    const openUp = spaceBelow < Math.min(maxH, 180) && spaceAbove > spaceBelow;
    // Menu uses min-width (not width) so it grows to fit the widest
    // option label - a narrow trigger like "Copay" still surfaces the
    // full "Coinsurance" option without clipping. The trigger width
    // is the floor so the menu never looks narrower than the trigger.
    let style = `position:fixed;left:${Math.round(r.left)}px;min-width:${Math.round(
      r.width
    )}px;right:auto;`;
    if (openUp) {
      const avail = Math.max(120, Math.min(maxH, spaceAbove - gap - margin));
      style += `bottom:${Math.round(vh - r.top + gap)}px;top:auto;max-height:${Math.round(
        avail
      )}px;`;
    } else {
      const avail = Math.max(120, Math.min(maxH, spaceBelow - gap - margin));
      style += `top:${Math.round(r.bottom + gap)}px;bottom:auto;max-height:${Math.round(
        avail
      )}px;`;
    }
    this.menuStyle = style;
  }
  _close() {
    this.isOpen = false;
    this.activeIndex = -1;
    this._typeBuffer = '';
  }
  handleScrim() {
    this._close();
  }

  // ── Selection ───────────────────────────────────────────────
  handleSelect(event) {
    const idx = parseInt(event.currentTarget.dataset.index, 10);
    if (!Number.isNaN(idx) && this._isDisabledAt(idx)) return;
    const v = event.currentTarget.dataset.value;
    this._commit(v);
  }
  _commit(v) {
    this._value = v === null || v === undefined ? '' : String(v);
    this._close();
    this.dispatchEvent(
      new CustomEvent('change', { detail: { value: this._value } })
    );
    this._focusTrigger();
  }
  handleHover(event) {
    const idx = parseInt(event.currentTarget.dataset.index, 10);
    if (Number.isNaN(idx) || this._isDisabledAt(idx)) return;
    this.activeIndex = idx;
  }

  // ── Keyboard ────────────────────────────────────────────────
  handleKeydown(event) {
    if (this.disabled) return;
    const key = event.key;

    if (!this.isOpen) {
      if (
        key === 'ArrowDown' ||
        key === 'ArrowUp' ||
        key === 'Enter' ||
        key === ' '
      ) {
        event.preventDefault();
        this._open();
      }
      return;
    }

    switch (key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex = this._nextSelectable(this.activeIndex, 1);
        this._scrollActiveIntoView();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex = this._nextSelectable(this.activeIndex, -1);
        this._scrollActiveIntoView();
        break;
      case 'Home':
        event.preventDefault();
        this.activeIndex = this._isDisabledAt(0)
          ? this._nextSelectable(-1, 1)
          : 0;
        this._scrollActiveIntoView();
        break;
      case 'End': {
        event.preventDefault();
        const last = this._options.length - 1;
        this.activeIndex = this._isDisabledAt(last)
          ? this._nextSelectable(this._options.length, -1)
          : last;
        this._scrollActiveIntoView();
        break;
      }
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (
          this._options[this.activeIndex] &&
          !this._isDisabledAt(this.activeIndex)
        ) {
          this._commit(this._options[this.activeIndex].value);
        }
        break;
      case 'Escape':
        event.preventDefault();
        this._close();
        this._focusTrigger();
        break;
      case 'Tab':
        this._close();
        break;
      default:
        if (key.length === 1 && /\S/.test(key)) {
          this._typeAhead(key);
        }
        break;
    }
  }

  _typeAhead(ch) {
    this._typeBuffer += ch.toLowerCase();
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    clearTimeout(this._typeTimer);
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this._typeTimer = setTimeout(() => {
      this._typeBuffer = '';
    }, 600);
    const idx = this._options.findIndex(
      (o) =>
        !o.disabled &&
        String(o.label).toLowerCase().startsWith(this._typeBuffer)
    );
    if (idx >= 0) {
      this.activeIndex = idx;
      this._scrollActiveIntoView();
    }
  }

  _scrollActiveIntoView() {
    // Defer until the active class is rendered.
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    Promise.resolve().then(() => {
      const el = this.template.querySelector(
        `[data-index="${this.activeIndex}"]`
      );
      if (el && el.scrollIntoView) {
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  _focusTrigger() {
    const btn = this.template.querySelector('.picklist__trigger');
    if (btn) btn.focus();
  }
}
