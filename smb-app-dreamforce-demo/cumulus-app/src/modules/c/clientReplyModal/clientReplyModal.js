import { LightningElement, api, track } from 'lwc';
import { today as baseToday } from 'data/dates';

/**
 * c-client-reply-modal - read-only view of a client's reply to an
 * emailed proposal, plus the scheduling step it leads into.
 *
 * Opened from the global-header notification tray: sending a proposal
 * from the Quote Comparison modal schedules a client response, and
 * activating that notification lands here. The reply asks for a call,
 * so the primary action books one - the datepicker opens on the day the
 * reply arrived, which is the day the client was talking about.
 *
 * @api open  - visibility, owned by the app shell.
 * @api reply - { fromName, fromEmail, fromInitials, subject,
 *                receivedLabel, receivedDateKey, paragraphs:
 *                [{ key, text }], quotedSubject, quotedSentLabel,
 *                accountName, accountId }
 *
 * Events:
 *   close          - backdrop, Escape, close button.
 *   schedulemeeting - invite confirmed. Detail:
 *                { dateKey, startTime, endTime, durationMinutes,
 *                  subject, attendee, accountName, accountId }
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
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

// Half-hour slots across a working day. The client asked for "tomorrow
// morning", so 9:00 AM is the default rather than the first slot.
const SLOT_START_HOUR = 8;
const SLOT_END_HOUR = 18;
const DEFAULT_SLOT = '09:00';

const DURATIONS = [30, 45, 60];
const DEFAULT_DURATION = 30;

function pad(n) {
  return String(n).padStart(2, '0');
}

function dateKeyOf(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function dateFromKey(key) {
  const [y, m, d] = String(key || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// 24h "HH:MM" -> "9:00 AM". The meeting records on Run My Day store
// display times, not timestamps, so this is the storage format too.
function toDisplayTime(value) {
  const [h, m] = String(value || '').split(':').map(Number);
  if (Number.isNaN(h)) return '';
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${pad(m || 0)} ${suffix}`;
}

function addMinutes(value, minutes) {
  const [h, m] = String(value || '').split(':').map(Number);
  if (Number.isNaN(h)) return '';
  const total = h * 60 + (m || 0) + minutes;
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
}

export default class ClientReplyModal extends LightningElement {
  @api open = false;
  @api reply;

  @track isScheduling = false;
  @track startTime = DEFAULT_SLOT;
  @track durationMinutes = DEFAULT_DURATION;

  // Both are required: the shell can flip `open` a frame before the
  // payload lands, and the template dereferences `reply` throughout.
  get isOpen() {
    return Boolean(this.open && this.reply);
  }

  get headingText() {
    if (!this.reply) return '';
    return this.isScheduling ? 'Schedule a Meeting' : this.reply.subject;
  }

  // ── Datepicker ──────────────────────────────────────────────────
  // Selection and the visible month are seeded from the reply's own
  // date on first entry to the scheduling step, so the picker opens
  // where the conversation left off rather than on today.
  @track _selectedKey = null;
  @track viewYear = null;
  @track viewMonth = null;

  get selectedKey() {
    return this._selectedKey || this.reply?.receivedDateKey || null;
  }

  get monthLabel() {
    const y = this.viewYear;
    const m = this.viewMonth;
    if (y == null || m == null) return '';
    return `${MONTH_NAMES[m]} ${y}`;
  }

  get weekdayLabels() {
    return WEEKDAYS;
  }

  get calendarGrid() {
    const year = this.viewYear;
    const month = this.viewMonth;
    if (year == null || month == null) return [];

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startPad = new Date(year, month, 1).getDay();
    const prev = new Date(year, month - 1);
    const prevDays = new Date(
      prev.getFullYear(), prev.getMonth() + 1, 0
    ).getDate();
    const next = new Date(year, month + 1);
    const today = baseToday();
    const selected = this.selectedKey;
    const cells = [];

    // Leading and trailing cells belong to the neighbouring months.
    // They render for grid alignment only and are not selectable, so a
    // stray click cannot book a meeting in a month the broker is not
    // looking at.
    for (let i = 0; i < startPad; i++) {
      const day = prevDays - startPad + i + 1;
      cells.push({
        id: `p-${day}`,
        day,
        key: null,
        isSelected: false,
        label: '',
        cls: 'crm-day crm-day_muted'
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const key = dateKeyOf(year, month, day);
      const isSelected = key === selected;
      const isToday =
        day === today.getDate() &&
        month === today.getMonth() &&
        year === today.getFullYear();
      let cls = 'crm-day';
      if (isToday) cls += ' crm-day_today';
      if (isSelected) cls += ' crm-day_selected';
      cells.push({
        id: key,
        day,
        key,
        isSelected,
        label: `${MONTH_NAMES[month]} ${day}, ${year}`,
        cls
      });
    }

    const trailing = (startPad + daysInMonth) % 7;
    for (let i = 1; trailing && i <= 7 - trailing; i++) {
      cells.push({
        id: `n-${i}`,
        day: i,
        key: null,
        isSelected: false,
        label: '',
        cls: 'crm-day crm-day_muted'
      });
    }
    return cells;
  }

  // ── Time + duration ─────────────────────────────────────────────
  get timeOptions() {
    const options = [];
    for (let h = SLOT_START_HOUR; h < SLOT_END_HOUR; h++) {
      for (const m of [0, 30]) {
        const value = `${pad(h)}:${pad(m)}`;
        options.push({
          key: value,
          value,
          label: toDisplayTime(value),
          isSelected: value === this.startTime
        });
      }
    }
    return options;
  }

  get durationOptions() {
    return DURATIONS.map((d) => ({
      key: `d-${d}`,
      value: String(d),
      label: `${d} minutes`,
      isSelected: d === this.durationMinutes
    }));
  }

  get endTime() {
    return addMinutes(this.startTime, this.durationMinutes);
  }

  get scheduleSummary() {
    const d = dateFromKey(this.selectedKey);
    if (!d) return '';
    const day = `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    return `${day} from ${toDisplayTime(this.startTime)} to ${toDisplayTime(this.endTime)}.`;
  }

  // ── Handlers ────────────────────────────────────────────────────
  handleStartScheduling() {
    const seed =
      dateFromKey(this.reply?.receivedDateKey) || baseToday();
    this._selectedKey =
      this.reply?.receivedDateKey ||
      dateKeyOf(seed.getFullYear(), seed.getMonth(), seed.getDate());
    this.viewYear = seed.getFullYear();
    this.viewMonth = seed.getMonth();
    this.startTime = DEFAULT_SLOT;
    this.durationMinutes = DEFAULT_DURATION;
    this.isScheduling = true;
  }

  handleBackToReply() {
    this.isScheduling = false;
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

  handlePickDate(event) {
    const key = event.currentTarget.dataset.key;
    if (!key) return;
    this._selectedKey = key;
    const d = dateFromKey(key);
    this.viewYear = d.getFullYear();
    this.viewMonth = d.getMonth();
  }

  handleTimeChange(event) {
    this.startTime = event.target.value;
  }

  handleDurationChange(event) {
    this.durationMinutes = Number(event.target.value) || DEFAULT_DURATION;
  }

  handleSendInvite() {
    const dateKey = this.selectedKey;
    if (!dateKey) return;
    this.dispatchEvent(
      new CustomEvent('schedulemeeting', {
        detail: {
          dateKey,
          startTime: toDisplayTime(this.startTime),
          endTime: toDisplayTime(this.endTime),
          durationMinutes: this.durationMinutes,
          subject: this.reply?.quotedSubject || this.reply?.subject || '',
          attendee: this.reply?.fromName || '',
          accountName: this.reply?.accountName || '',
          accountId: this.reply?.accountId || null,
          leadCarrier: this.reply?.leadCarrier || null,
          lineLabel: this.reply?.lineLabel || null
        }
      })
    );
    this.isScheduling = false;
  }

  connectedCallback() {
    this._keyHandler = (e) => {
      if (e.key === 'Escape' && this.isOpen) this._close();
    };
    document.addEventListener('keydown', this._keyHandler, true);
  }

  disconnectedCallback() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler, true);
      this._keyHandler = null;
    }
  }

  handleClose() {
    this._close();
  }

  handleBackdrop(event) {
    if (event.target === event.currentTarget) this._close();
  }

  stopPropagation(event) {
    event.stopPropagation();
  }

  _close() {
    this.isScheduling = false;
    this.dispatchEvent(new CustomEvent('close'));
  }
}
