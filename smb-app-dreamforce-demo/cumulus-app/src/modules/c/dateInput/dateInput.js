import { LightningElement, api } from 'lwc';
import { formatUsDate, parseToIso, today as baseToday } from 'data/dates';

/**
 * c-date-input - SLDS 2 date field that always shows MM/DD/YYYY.
 *
 * Native <input type="date"> paints the value in the browser's OS
 * locale, so a US term like 10/14/2026 becomes 13/10/2026 on a
 * DD/MM machine. This control is a text input plus the in-house
 * datepicker (same calendar used by c-client-reply-modal) so the
 * closed field and the open calendar both stay US-formatted.
 *
 * Public API:
 *   value            - ISO day (YYYY-MM-DD)
 *   placeholder      - default MM/DD/YYYY
 *   disabled         - boolean
 *   min              - optional ISO day; earlier dates cannot be picked
 *   input-id         - id on the text input so a visible label can
 *                      use for=
 *   accessible-label - aria-label when there is no visible label
 *   size             - 'l' (default) or 's'
 *
 * Emits `change` with detail { value } (ISO or '').
 */

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

const WEEKDAYS = [
  { key: 'sun', short: 'Sun' },
  { key: 'mon', short: 'Mon' },
  { key: 'tue', short: 'Tue' },
  { key: 'wed', short: 'Wed' },
  { key: 'thu', short: 'Thu' },
  { key: 'fri', short: 'Fri' },
  { key: 'sat', short: 'Sat' }
];

function pad(n) {
  return String(n).padStart(2, '0');
}

function dateKeyOf(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export default class DateInput extends LightningElement {
  @api placeholder = 'MM/DD/YYYY';
  @api accessibleLabel = '';
  @api disabled = false;
  @api min = '';
  @api size = 'l';
  @api inputId = '';

  _value = '';
  _draft = null;
  _focused = false;
  _uid = `di-${Math.random().toString(36).slice(2, 10)}`;
  isOpen = false;
  viewYear = null;
  viewMonth = null;
  menuStyle = '';

  @api
  get value() {
    return this._value;
  }
  set value(val) {
    this._value = parseToIso(val);
    if (!this._focused) this._draft = null;
  }

  @api
  focus() {
    const input = this.template.querySelector('.date-input__text');
    if (input) input.focus();
  }

  get resolvedInputId() {
    return this.inputId || `${this._uid}-input`;
  }
  get pickerId() {
    return `${this._uid}-picker`;
  }
  get ariaExpanded() {
    return this.isOpen ? 'true' : 'false';
  }
  get displayValue() {
    if (this._draft != null) return this._draft;
    return formatUsDate(this._value);
  }
  get rootClass() {
    const base = this.isOpen ? 'date-input is-open' : 'date-input';
    return this.size === 's' ? `${base} date-input_size_s` : base;
  }
  get weekdayLabels() {
    return WEEKDAYS;
  }
  get monthLabel() {
    if (this.viewYear == null || this.viewMonth == null) return '';
    return `${MONTH_NAMES[this.viewMonth]} ${this.viewYear}`;
  }

  get calendarGrid() {
    const year = this.viewYear;
    const month = this.viewMonth;
    if (year == null || month == null) return [];

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startPad = new Date(year, month, 1).getDay();
    const prev = new Date(year, month, 0);
    const prevDays = prev.getDate();
    const today = baseToday();
    const selected = this._value;
    const cells = [];

    for (let i = 0; i < startPad; i += 1) {
      const day = prevDays - startPad + i + 1;
      cells.push({
        id: `p-${day}`,
        day,
        key: null,
        disabled: true,
        ariaSelected: 'false',
        label: '',
        cls: 'date-input__day date-input__day_muted'
      });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = dateKeyOf(year, month, day);
      const isSelected = key === selected;
      const isToday =
        day === today.getDate() &&
        month === today.getMonth() &&
        year === today.getFullYear();
      const allowed = this._isAllowed(key);
      let cls = 'date-input__day';
      if (isToday) cls += ' date-input__day_today';
      if (isSelected) cls += ' date-input__day_selected';
      if (!allowed) cls += ' date-input__day_disabled';
      cells.push({
        id: key,
        day,
        key,
        disabled: !allowed,
        ariaSelected: isSelected ? 'true' : 'false',
        label: `${MONTH_NAMES[month]} ${day}, ${year}`,
        cls
      });
    }

    const trailing = (startPad + daysInMonth) % 7;
    for (let i = 1; trailing && i <= 7 - trailing; i += 1) {
      cells.push({
        id: `n-${i}`,
        day: i,
        key: null,
        disabled: true,
        ariaSelected: 'false',
        label: '',
        cls: 'date-input__day date-input__day_muted'
      });
    }
    return cells;
  }

  _isAllowed(iso) {
    if (!iso) return false;
    const min = parseToIso(this.min);
    if (min && iso < min) return false;
    return true;
  }

  handleTextFocus() {
    this._focused = true;
    if (this._draft == null) this._draft = this.displayValue;
  }

  handleTyped(event) {
    this._draft = event.target.value;
    const iso = parseToIso(this._draft);
    if (iso && this._isAllowed(iso) && iso !== this._value) {
      this._value = iso;
      this._emitChange();
    }
  }

  handleTextBlur() {
    this._focused = false;
    Promise.resolve().then(() => {
      if (this.isOpen) return;
      this._commitDraft();
      this.dispatchEvent(new CustomEvent('blur'));
    });
  }

  handleTextKeydown(event) {
    if (this.disabled) return;
    if (event.key === 'ArrowDown' && !this.isOpen) {
      event.preventDefault();
      this._open();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.isOpen) {
        this._close();
        return;
      }
      this.dispatchEvent(
        new CustomEvent('keydown', { detail: { key: 'Escape' } })
      );
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      this._commitDraft();
      this._close();
      this.dispatchEvent(
        new CustomEvent('keydown', { detail: { key: 'Enter' } })
      );
    }
  }

  handlePickerMouseDown(event) {
    event.preventDefault();
  }

  handleToggle() {
    if (this.disabled) return;
    if (this.isOpen) this._close();
    else this._open();
  }

  handleScrim() {
    this._commitDraft();
    this._close();
    this.dispatchEvent(new CustomEvent('blur'));
  }

  handlePrevMonth() {
    if (this.viewMonth === 0) {
      this.viewMonth = 11;
      this.viewYear -= 1;
    } else {
      this.viewMonth -= 1;
    }
  }

  handleNextMonth() {
    if (this.viewMonth === 11) {
      this.viewMonth = 0;
      this.viewYear += 1;
    } else {
      this.viewMonth += 1;
    }
  }

  handleSelectDay(event) {
    const key = event.currentTarget.dataset.key;
    if (!key || !this._isAllowed(key)) return;
    this._value = key;
    this._draft = null;
    this._close();
    this._emitChange();
    this.focus();
  }

  _open() {
    const iso = parseToIso(this._value) || parseToIso(this.min);
    const base = iso
      ? new Date(
          Number(iso.slice(0, 4)),
          Number(iso.slice(5, 7)) - 1,
          Number(iso.slice(8, 10))
        )
      : baseToday();
    this.viewYear = base.getFullYear();
    this.viewMonth = base.getMonth();
    this.isOpen = true;
    this._positionMenu();
  }

  _close() {
    this.isOpen = false;
    this.menuStyle = '';
  }

  _positionMenu() {
    const control = this.template.querySelector('.date-input__control');
    if (!control || typeof window === 'undefined') {
      this.menuStyle = '';
      return;
    }
    const r = control.getBoundingClientRect();
    const gap = 4;
    const margin = 8;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const pickerH = 280;
    const spaceBelow = vh - r.bottom;
    const spaceAbove = r.top;
    const openUp = spaceBelow < pickerH && spaceAbove > spaceBelow;
    let style = `position:fixed;left:${Math.round(r.left)}px;min-width:${Math.round(
      Math.max(r.width, 280)
    )}px;right:auto;`;
    if (openUp) {
      style += `bottom:${Math.round(vh - r.top + gap)}px;top:auto;`;
    } else {
      const top = Math.min(r.bottom + gap, vh - pickerH - margin);
      style += `top:${Math.round(Math.max(margin, top))}px;bottom:auto;`;
    }
    this.menuStyle = style;
  }

  _commitDraft() {
    const typed = this._draft;
    this._draft = null;
    if (typed == null) return;
    const trimmed = String(typed).trim();
    if (!trimmed) {
      if (this._value !== '') {
        this._value = '';
        this._emitChange();
      }
      return;
    }
    const iso = parseToIso(trimmed);
    if (iso && this._isAllowed(iso)) {
      if (iso !== this._value) {
        this._value = iso;
        this._emitChange();
      }
      return;
    }
  }

  _emitChange() {
    this.dispatchEvent(
      new CustomEvent('change', { detail: { value: this._value } })
    );
  }
}
