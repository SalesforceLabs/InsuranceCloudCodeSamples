import { LightningElement, api, track } from 'lwc';
import { format } from 'date-fns';
import { readForcedState } from 'c/emptyState';
import {
  runMyDayCategories,
  getRunMyDayCategoryCounts,
  runMyDayMeetings,
  runMyDayMetricsByPersona,
  runMyDayAgents,
  runMyDayAgentAnalytics,
  getPersona,
  accountHasRecordPage,
  DEFAULT_PERSONA_ID
} from 'data/mockData';
import { getRevenueIntelligence } from 'data/revenueIntelligence';
import { formatUsDate } from 'data/dates';
import { today as baseToday } from 'data/dates';

// How long the just-booked meeting card stays flagged for its
// highlight. Matches the `meeting-card-just-booked` keyframes duration
// plus a frame of slack, so the class is never pulled mid-animation.
const JUST_BOOKED_MS = 2100;

// Currency formatters shared by the Agency Revenue strip (KPI tiles,
// leakage bars, leaderboard). Compact so "$487.5K" fits inside the
// same tile geometry as the renewals counters.
const COMPACT_USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1
});
const FULL_USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Small utils - kept private so we don't leak our stringly-typed
// date keys into the template layer.
function _formatDateKey(d) {
  return (
    d.getFullYear() +
    '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0')
  );
}
function _dateFromKey(k) {
  const [y, m, d] = (k || _formatDateKey(baseToday())).split('-').map(Number);
  return new Date(y, m - 1, d);
}
function _isSameDay(a, b) {
  return _formatDateKey(a) === _formatDateKey(b);
}
function _formatDisplayDate(d) {
  const today = baseToday();
  if (_isSameDay(d, today)) return 'Today, ' + MONTH_NAMES[d.getMonth()] + ' ' + d.getDate();
  return DAY_NAMES[d.getDay()] + ', ' + MONTH_NAMES[d.getMonth()] + ' ' + d.getDate();
}
// Meeting cards restate the calendar date even though the section
// heading already says "Today's Meetings", matching the org carousel's
// MM/DD/YYYY prefix on every time range.
function _formatSlashDate(d) {
  return (
    String(d.getMonth() + 1).padStart(2, '0') +
    '/' + String(d.getDate()).padStart(2, '0') +
    '/' + d.getFullYear()
  );
}
// The badge's only per-status signal is its own label, so the CSS
// modifier is derived from that text. A status with no matching rule
// keeps just the base class, which is the In Prep treatment, so an
// unrecognised value degrades to a styled badge rather than an unstyled
// one.
function _meetingBadgeClass(status) {
  const base = 'meeting-card-badge';
  const slug = String(status || '').trim().toLowerCase().replace(/\s+/g, '-');
  return slug ? base + ' ' + base + '_' + slug : base;
}
function _parseMeetingTime(t) {
  const m = (t || '').match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const isPM = m[3].toUpperCase() === 'PM';
  if (isPM && h !== 12) h += 12;
  if (!isPM && h === 12) h = 0;
  return h * 60 + min;
}

export default class RunMyDay extends LightningElement {
  @api boundAccountIds = [];
  // Persona routing - which Home layout to render. Parent (c-app)
  // owns the source of truth; this component derives layout + gated
  // widgets from the persona's `homeVariant` + `capabilities`.
  @api personaId = DEFAULT_PERSONA_ID;
  // Persisted Run My Day sub-tab (Principal only). Null → the
  // persona's default landing tab ("renewals" today).
  @api activeTab;

  // Meetings come from the `runMyDayMeetings` module array, not from a
  // prop, and this component stays mounted for the life of the app. The
  // shell bumps this counter after a booking; it is read by the
  // carousel getters so LWC re-renders. Mutating the module array
  // alone does not dirty this component.
  @api meetingsRevision = 0;
  // After a booking the shell also sends the day and card to land on,
  // so a slot that is not "today" still surfaces instead of looking
  // like the invite vanished.
  @api focusDateKey;
  @api highlightMeetingId;
  // The card currently mid-highlight. Local rather than derived from
  // highlightMeetingId because the highlight is a one-shot: the shell's
  // id persists, this clears itself once the animation has run.
  @track _justBookedId = null;
  _highlightTimer = null;

  // ── Persisted tab (Principal) ────────────────────────────────
  @track _rmdTab = null;
  _lastSeenParentTab = null;

  // ── Meetings carousel + calendar popover ─────────────────────
  @track _selectedDateKey = _formatDateKey(baseToday());
  @track _calendarOpen = false;
  @track _calendarViewYear;
  @track _calendarViewMonth;
  _appliedFocusRevision = -1;
  _appliedFocusDateKey = null;
  _scrolledMeetingId = null;

  // ── Action Items state ───────────────────────────────────────
  // Grow is the org default (Advisor Home / runtime_industries_runmyday).
  @track _activeCategory = 'grow';
  @track _selectedCardId = null;
  @track _agentSubTab = 'analytics';
  @track _navCollapsed = false;

  connectedCallback() {
    const now = baseToday();
    this._calendarViewYear = now.getFullYear();
    this._calendarViewMonth = now.getMonth();
    this._rmdTab = this.activeTab || this._defaultTab;
    this._lastSeenParentTab = this.activeTab || null;
  }

  renderedCallback() {
    // Sync from parent-owned `activeTab` only when the parent value
    // actually changed (persona switch resets it to null, or a
    // deep-link ?rmdTab= arrives). Guarding on the last-seen parent
    // value keeps a user's local tab click from being reverted
    // during the intermediate render before the parent echoes back.
    const parentTab = this.activeTab || null;
    if (parentTab !== this._lastSeenParentTab) {
      this._lastSeenParentTab = parentTab;
      this._rmdTab = parentTab || this._defaultTab;
    }

    this._applyFocusDate();
    this._scrollHighlightIntoView();
  }

  _applyFocusDate() {
    const key = this.focusDateKey;
    if (!key) return;
    if (this.meetingsRevision === this._appliedFocusRevision) return;
    this._appliedFocusRevision = this.meetingsRevision;
    this._appliedFocusDateKey = key;
    if (key === this._selectedDateKey) return;
    this._selectedDateKey = key;
    const d = _dateFromKey(key);
    this._calendarViewYear = d.getFullYear();
    this._calendarViewMonth = d.getMonth();
  }

  _scrollHighlightIntoView() {
    const id = this.highlightMeetingId;
    if (!id || id === this._scrolledMeetingId) return;
    const card = this.template.querySelector(
      `[data-meeting-id="${id}"]`
    );
    if (!card) return;
    this._scrolledMeetingId = id;
    card.scrollIntoView({
      inline: 'start',
      block: 'nearest',
      behavior: 'smooth'
    });
    // Landing on the day is not enough on a four-card strip: the broker
    // needs to know WHICH card is the one they just booked. Flag it for
    // a single pass of the highlight, then drop the flag so the
    // animation cannot replay on an unrelated re-render - the shell
    // holds highlightMeetingId for the rest of the session.
    this._justBookedId = id;
    if (this._highlightTimer) clearTimeout(this._highlightTimer);
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this._highlightTimer = setTimeout(() => {
      this._highlightTimer = null;
      this._justBookedId = null;
    }, JUST_BOOKED_MS);
  }

  // ═════════════════════════════════════════════════════════════
  // Persona-derived state
  // ═════════════════════════════════════════════════════════════
  get _persona() {
    return getPersona(this.personaId);
  }
  get _capabilities() {
    return this._persona.capabilities || {};
  }
  get _defaultTab() {
    return this._persona.homeVariant === 'revenue' ? 'revenue' : 'renewals';
  }
  get _currentTab() {
    if (!this.isTabbedHome) return this._defaultTab;
    return this._rmdTab || this._defaultTab;
  }
  get isTabbedHome() {
    return this._persona.homeVariant === 'tabbed';
  }
  get showRenewalsBody() {
    if (this.hasForcedRmdState) return false;
    if (this.isTabbedHome) return this._currentTab === 'renewals';
    return this._persona.homeVariant === 'renewals'
      && !!this._capabilities.seeRenewalsOps;
  }
  get showRevenueBody() {
    if (this.hasForcedRmdState) return false;
    if (this.isTabbedHome) return this._currentTab === 'revenue';
    return this._persona.homeVariant === 'revenue'
      && !!this._capabilities.seeAgencyRevenue;
  }

  // ═════════════════════════════════════════════════════════════
  // Greeting banner + hero (persona-aware)
  // ═════════════════════════════════════════════════════════════
  // Always the running user's own first name. The greeting used to carry a
  // separate hardcoded name for the renewals variant, which let it drift
  // from the persona it was greeting (it said "Sarah" while the avatar and
  // both account-owner fields said Elena Rostova).
  get firstName() {
    return (this._persona.name || '').split(' ')[0];
  }
  get _greetingPeriod() {
    // Time of day, not a date - this one stays on the system clock so
    // the greeting matches the room the demo is being shown in. The
    // base date pins the calendar, not the hour.
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  }
  get heroTitle() {
    return `Good ${this._greetingPeriod}, ${this.firstName}`;
  }
  get bannerSubcopy() {
    // Producer / Principal see the operational subcopy; Finance sees a
    // commission-focused version so the greeting doesn't lie about a
    // meetings row it never mounts.
    if (this._persona.homeVariant === 'revenue') {
      return "I've pulled together your commission run, receivables, and producer leaderboard for the day.";
    }
    const meetings = this._todayMeetings.length;
    // Counted off the mounted groups so the number always equals the sum of
    // the badges directly below it.
    const alerts = this._categoryCounts.all ?? 0;
    const meetingWord = meetings === 1 ? 'meeting' : 'meetings';
    const alertWord = alerts === 1 ? 'alert' : 'alerts';
    return `Here are your daily updates: ${meetings} ${meetingWord} and ${alerts} ${alertWord} that impact your clients.`;
  }
  get dateLabel() {
    return format(baseToday(), 'EEEE, MMMM d');
  }
  get heroMeta() {
    if (this._persona.homeVariant === 'revenue') {
      const kpi = this._revenue.kpiMetrics;
      return `${this.dateLabel} · ${COMPACT_USD.format(kpi.totalCommissionEarned)} commission YTD`;
    }
    return 'Have a great day!';
  }
  get heroChipLabel() {
    if (this._persona.homeVariant === 'revenue') return 'YTD commission +10% YoY';
    if (this.isTabbedHome) return `${this._persona.profileLabel} view`;
    return "You're at 72% of weekly goal";
  }

  // ═════════════════════════════════════════════════════════════
  // Agentforce prompt bar
  // ═════════════════════════════════════════════════════════════
  get agentforcePlaceholder() {
    return 'Agentforce is an AI Agent that can answer your questions and take action on your book.';
  }
  handleAgentforceKey(event) {
    if (event.key === 'Enter') this._submitAgentforce(event.currentTarget.value);
  }
  handleAgentforceSubmit() {
    const input = this.template.querySelector('.agf-input');
    if (input) this._submitAgentforce(input.value);
  }
  _submitAgentforce(text) {
    const q = (text || '').trim();
    if (!q) return;
    // Placeholder - a real build routes to the Agentforce panel /
    // Slack drawer with an intent + context payload. No toast: the ask
    // is not one of the three moments that earn one.
    const input = this.template.querySelector('.agf-input');
    if (input) input.value = '';
  }

  // ═════════════════════════════════════════════════════════════
  // Meetings carousel + calendar popover
  // ═════════════════════════════════════════════════════════════
  get _selectedDate() {
    return _dateFromKey(this._selectedDateKey);
  }
  get _todayMeetings() {
    return this._meetingsForSelectedDate;
  }
  get meetingsHeader() {
    if (_isSameDay(this._selectedDate, baseToday())) return "Today's Meetings";
    return _formatDisplayDate(this._selectedDate) + ' Meetings';
  }
  get meetingsCountLabel() {
    return `(${this._meetingsForSelectedDate.length})`;
  }
  get meetingsEmptyLabel() {
    if (_isSameDay(this._selectedDate, baseToday())) return 'No meetings today';
    return 'No meetings on this day';
  }
  get _meetingsForSelectedDate() {
    // Touch meetingsRevision so a shell bump re-runs this getter.
    const revision = this.meetingsRevision;
    return runMyDayMeetings
      .filter((m) => m.dateKey === this._selectedDateKey && revision >= 0)
      .slice()
      .sort(
        (a, b) => _parseMeetingTime(a.startTime) - _parseMeetingTime(b.startTime)
      );
  }
  get meetingsForCarousel() {
    const slashDate = _formatSlashDate(this._selectedDate);
    return this._meetingsForSelectedDate.map((m) => ({
      ...m,
      timeRange: slashDate + ', ' + m.startTime + ' - ' + m.endTime,
      // Only the related record resolves to a destination in Atlas, so
      // organizer and event stay as plain text rather than dead links.
      // Accounts outside the record-page set have no tab to land on, so
      // they stay plain text too.
      hasRelatedLink: !!m.relatedRecord && accountHasRecordPage(m.accountId),
      badgeClass: _meetingBadgeClass(m.status),
      cardClass:
        m.id === this._justBookedId
          ? 'meeting-card is-just-booked'
          : 'meeting-card'
    }));
  }
  get hasNoMeetings() {
    return this._meetingsForSelectedDate.length === 0;
  }

  get calendarPopoverClass() {
    return 'calendar-popover' + (this._calendarOpen ? ' visible' : '');
  }
  get calendarMonthLabel() {
    return MONTH_NAMES[this._calendarViewMonth] + ' ' + this._calendarViewYear;
  }
  get calendarGrid() {
    // Padded 6-row month grid with day-of-week headers up top. Each
    // cell carries the ISO date key so the click handler can reuse
    // the same `_selectedDateKey` state machine as the header nav.
    const year = this._calendarViewYear;
    const month = this._calendarViewMonth;
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const daysInMonth = last.getDate();
    const startPad = first.getDay();
    const prevMonth = new Date(year, month - 1);
    const prevMonthDays = new Date(
      prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0
    ).getDate();
    const today = baseToday();
    const selectedKey = this._selectedDateKey;
    const cells = [];

    for (let i = 0; i < startPad; i++) {
      const d = prevMonthDays - startPad + i + 1;
      const key = prevMonth.getFullYear()
        + '-' + String(prevMonth.getMonth() + 1).padStart(2, '0')
        + '-' + String(d).padStart(2, '0');
      cells.push({ id: 'p-' + key, day: d, key, cls: 'calendar-day other-month' });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const key = year
        + '-' + String(month + 1).padStart(2, '0')
        + '-' + String(d).padStart(2, '0');
      let cls = 'calendar-day';
      if (d === today.getDate()
        && month === today.getMonth()
        && year === today.getFullYear()) cls += ' today';
      if (key === selectedKey) cls += ' selected';
      cells.push({ id: key, day: d, key, cls });
    }
    const total = startPad + daysInMonth;
    const remaining = total % 7 === 0 ? 0 : 7 - (total % 7);
    const next = new Date(year, month + 1);
    for (let i = 1; i <= remaining; i++) {
      const key = next.getFullYear()
        + '-' + String(next.getMonth() + 1).padStart(2, '0')
        + '-' + String(i).padStart(2, '0');
      cells.push({ id: 'n-' + key, day: i, key, cls: 'calendar-day other-month' });
    }
    return cells;
  }

  handleCalendarToggle(event) {
    event.stopPropagation();
    this._calendarOpen = !this._calendarOpen;
    if (this._calendarOpen) {
      const d = this._selectedDate;
      this._calendarViewYear = d.getFullYear();
      this._calendarViewMonth = d.getMonth();
      this._ensureOutsideClick();
    }
  }
  handleCalendarPrev() {
    if (this._calendarViewMonth === 0) {
      this._calendarViewMonth = 11;
      this._calendarViewYear -= 1;
    } else {
      this._calendarViewMonth -= 1;
    }
  }
  handleCalendarNext() {
    if (this._calendarViewMonth === 11) {
      this._calendarViewMonth = 0;
      this._calendarViewYear += 1;
    } else {
      this._calendarViewMonth += 1;
    }
  }
  handleCalendarPick(event) {
    const key = event.currentTarget.dataset.key;
    if (!key) return;
    this._selectedDateKey = key;
    const d = _dateFromKey(key);
    this._calendarViewYear = d.getFullYear();
    this._calendarViewMonth = d.getMonth();
    this._calendarOpen = false;
  }
  _boundOutsideClick;
  _ensureOutsideClick() {
    if (this._boundOutsideClick) return;
    this._boundOutsideClick = (e) => {
      // Ignore clicks that started inside the popover or its trigger.
      if (e.target.closest('.calendar-popover') || e.target.closest('.calendar-icon-btn')) return;
      if (this._calendarOpen) this._calendarOpen = false;
    };
    document.addEventListener('click', this._boundOutsideClick, true);
  }

  disconnectedCallback() {
    if (this._boundOutsideClick) {
      document.removeEventListener('click', this._boundOutsideClick, true);
      this._boundOutsideClick = null;
    }
    if (this._highlightTimer) {
      clearTimeout(this._highlightTimer);
      this._highlightTimer = null;
    }
  }

  // ═════════════════════════════════════════════════════════════
  // Action Items metrics + category tabstrip + vertical nav
  // ═════════════════════════════════════════════════════════════
  get _metrics() {
    return runMyDayMetricsByPersona[this.personaId] || runMyDayMetricsByPersona.producer;
  }
  get metricTaskItems() {
    const m = this._metrics;
    return [
      { id: 'total', label: 'Total Tasks', value: m.total, cls: 'rmd-metric highlight' },
      { id: 'carried', label: 'Carried Forward', value: m.carried, cls: 'rmd-metric' },
      { id: 'completed', label: 'Completed Today', value: m.completed, cls: 'rmd-metric' },
      { id: 'pending', label: 'Pending', value: m.pending, cls: 'rmd-metric' },
      { id: 'overdue', label: 'Overdue', value: m.overdue, cls: 'rmd-metric overdue' },
      { id: 'dueToday', label: 'Due Today', value: m.dueToday, cls: 'rmd-metric' },
      { id: 'slaAtRisk', label: 'SLA at Risk', value: m.slaAtRisk, cls: 'rmd-metric sla' }
    ];
  }
  get metricAgentItems() {
    const m = this._metrics;
    return [
      { id: 'agents', label: 'Agents on Duty', value: m.agents, cls: 'rmd-metric' },
      {
        id: 'agentCompleted',
        label: 'Tasks Completed by Agents',
        value: m.agentTasksCompleted,
        cls: 'rmd-metric'
      }
    ];
  }

  get _categoryCounts() {
    return getRunMyDayCategoryCounts();
  }
  // Vertical icon nav (sits to the left of the cards column).
  // Figma parity: pill is [icon] [Label] [warn dot if unread] [count]. Counts
  // are zero-padded to 2 digits to match Frame 18-6770 (e.g. "06", "01").
  // Warn dot is data-driven off `hasAlert` at the card level so we don't leak
  // demo-only flags into the getter.
  get verticalNavItems() {
    const active = this._activeCategory;
    const counts = this._categoryCounts;
    const byId = Object.fromEntries(runMyDayCategories.map((c) => [c.id, c]));
    // Org group order on Advisor Home: Grow, Retain, Service, Comply.
    const order = ['grow', 'retain', 'service', 'comply'];
    return order.map((id) => {
      const c = byId[id];
      if (!c) return null;
      const urgency = id === 'grow' ? 'attention' : 'urgent';
      return {
        id: c.id,
        label: c.label,
        badge: this._formatCountBadge(counts[c.id] ?? 0),
        hasAlert: true,
        urgencyCls: 'rmd-vertical-nav__warn rmd-vertical-nav__warn_' + urgency,
        iconKey: c.icon,
        cls: this._verticalNavClass(c.id, active)
      };
    }).filter(Boolean);
  }
  _formatCountBadge(n) {
    const count = Number(n) || 0;
    return count > 99 ? '99+' : String(count);
  }
  get verticalNavAgentEntry() {
    return {
      id: 'agents',
      label: 'Agent Observability',
      iconKey: 'sparkle',
      cls: this._activeCategory === 'agents'
        ? 'rmd-vertical-nav-link active'
        : 'rmd-vertical-nav-link'
    };
  }
  get verticalNavClass() {
    return 'rmd-vertical-nav' + (this._navCollapsed ? ' collapsed' : '');
  }
  get verticalNavCollapseLabel() {
    return this._navCollapsed ? 'Expand navigation' : 'Collapse navigation';
  }
  _verticalNavClass(id, active) {
    let cls = 'rmd-vertical-nav-link';
    if (id === active) cls += ' active';
    return cls;
  }

  handleVerticalNavClick(event) {
    event.preventDefault();
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    if (id === 'agents') {
      this._activeCategory = 'agents';
      this._selectFirstCardForCategory('agents');
      this._agentSubTab = 'analytics';
      return;
    }
    if (id === this._activeCategory) return;
    this._activeCategory = id;
    this._selectedCardId = null;
  }
  handleNavCollapse() {
    this._navCollapsed = !this._navCollapsed;
  }

  // ═════════════════════════════════════════════════════════════
  // Cards column (mid) + tiles column (right)
  // ═════════════════════════════════════════════════════════════
  get isAgentsView() {
    return this._activeCategory === 'agents';
  }
  _flatCards() {
    if (this._activeCategory === 'all') {
      const all = [];
      runMyDayCategories.forEach((c) => {
        c.cards.forEach((card) => all.push({ ...card, categoryId: c.id }));
      });
      return all;
    }
    const cat = runMyDayCategories.find((c) => c.id === this._activeCategory);
    if (!cat) return [];
    return cat.cards.map((card) => ({ ...card, categoryId: cat.id }));
  }
  get visibleCards() {
    if (this.isAgentsView) return [];
    const urgency = this._activeCategory === 'grow' ? 'attention' : 'urgent';
    return this._flatCards().map((card) => {
      const count = card.itemCount ?? (card.rows?.length || 0);
      const hasAlert = card.hasAlert !== false;
      return {
        id: card.id,
        title: card.title,
        titleWithCount: `${card.title} (${count})`,
        count,
        summary: card.summary,
        hasAlert,
        urgencyCls: 'rmd-card__urgency rmd-card__urgency_' + urgency,
        cls: this._selectedCardId === card.id
          ? 'rmd-card selected'
          : 'rmd-card'
      };
    });
  }
  get hasVisibleCards() {
    return this.visibleCards.length > 0;
  }

  // ── Forced empty/error state for demos (`?forceEmpty=rmd@<code>`).
  _forcedRmdState = readForcedState('rmd');
  get hasForcedRmdState() {
    return Boolean(this._forcedRmdState);
  }
  get forcedRmdStateName() {
    return this._forcedRmdState;
  }
  get forcedRmdStateTitle() {
    const map = {
      'error:recoverable': 'Couldn’t load Run My Day',
      'error:connectionissue': 'You’re offline',
      'error:appconnection': 'Meetings feed is unreachable',
      'error:unrecoverable': 'We hit an unexpected problem',
      'success:selfassigned': 'You’re all caught up',
      'success:assigned': 'No assigned work today',
      'accessissues:request': 'You don’t have access to Run My Day'
    };
    return map[this._forcedRmdState] || '';
  }
  get forcedRmdStateDescription() {
    const map = {
      'error:recoverable': 'The Run My Day feed failed to load. Try again in a moment.',
      'error:connectionissue': 'Reconnect to sync your meetings, alerts, and insights.',
      'error:appconnection': 'Your calendar integration didn’t respond. Reconnect it or contact your admin.',
      'error:unrecoverable': 'Refresh the page or contact your admin if this keeps happening.',
      'success:selfassigned': 'Nothing needs your attention right now. Nice work.',
      'success:assigned': 'No one’s assigned you anything for today.',
      'accessissues:request': 'Ask your admin for the Broker Home permission set.'
    };
    return map[this._forcedRmdState] || '';
  }
  get forcedRmdStateCtaLabel() {
    const map = {
      'error:recoverable': 'Try again',
      'error:connectionissue': 'Retry',
      'error:appconnection': 'Reconnect calendar',
      'error:unrecoverable': 'Reload'
    };
    return map[this._forcedRmdState] || '';
  }
  get hasForcedRmdStateCta() {
    return Boolean(this.forcedRmdStateCtaLabel);
  }

  // Insight-column empty. Wraps the primary card list so the
  // insight rail always says *why* the column is empty (e.g., every
  // alert has been dismissed for the day).
  get showInsightsEmpty() {
    return !this.isAgentsView && !this.hasVisibleCards && !this.hasForcedRmdState;
  }
  get insightsColumnTitle() {
    return 'Insights';
  }
  get agentCardsList() {
    if (!this.isAgentsView) return [];
    return runMyDayAgents.map((a) => ({
      id: a.id,
      title: a.name,
      summary: a.summary,
      cls: this._selectedCardId === a.id
        ? 'rmd-card rmd-agent-card selected'
        : 'rmd-card rmd-agent-card'
    }));
  }
  get hasAgentCardsList() {
    return this.agentCardsList.length > 0;
  }

  _findCardById(id) {
    const flat = this._flatCards();
    return flat.find((c) => c.id === id);
  }
  _selectFirstCardForCategory(catId) {
    if (catId === 'agents') {
      this._selectedCardId = runMyDayAgents[0]?.id || null;
      return;
    }
    const flat = this._flatCards();
    this._selectedCardId = flat[0]?.id || null;
  }
  handleCardClick(event) {
    const id = event.currentTarget.dataset.cardId;
    if (!id) return;
    this._selectedCardId = id;
  }

  // Retention-Alert Detail rendering (title / summary / rows / row
  // action menu) lives in c-retention-alert-drawer, mounted inline
  // as the third column of the insights grid. That component reads
  // { card-id, category-id } off the `selectedCardId` /
  // `activeCategoryId` public getters below and looks up its content
  // from mockData internally.
  get selectedCardId() {
    return this._selectedCardId;
  }
  get activeCategoryId() {
    return this._activeCategory;
  }

  // Composed+bubbling forwarders for the inline drawer's `navigate`
  // and `toast` events so c-app's handlers pick them up through the
  // c-account-record-page → c-run-my-day chain.
  handleChildNavigate(event) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: event.detail,
      bubbles: true,
      composed: true
    }));
  }
  handleChildToast(event) {
    this.dispatchEvent(new CustomEvent('toast', {
      detail: event.detail,
      bubbles: true,
      composed: true
    }));
  }

  _navigate(detail) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail,
      bubbles: true,
      composed: true
    }));
  }
  handleOpenAccountLink(event) {
    event.preventDefault();
    // Stop the click from bubbling to the meeting-card wrapper's
    // onclick - the account link is a nested affordance and must
    // route to the account page, not the Meeting Prep segment.
    event.stopPropagation();
    const accountId = event.currentTarget.dataset.accountId;
    if (accountId) this._navigate({ route: 'account-record-page', accountId });
  }

  // Whole meeting card is a click target that opens Meeting Center
  // (default landing tab = Meeting Prep). The nested account link
  // stopPropagation's so it can hijack this handler for its own route.
  // The card's own id rides along so the shell opens a workspace tab
  // for *that* playbook, the way the org's carousel links straight to
  // /lightning/r/MeetingPlaybook/<id>/view.
  handleMeetingCardClick(event) {
    // Skip if the click originated on the nested account link, which
    // is handled independently - belt-and-suspenders against browsers
    // that fire the parent click before stopPropagation registers.
    if (event.target && event.target.closest &&
        event.target.closest('.meeting-card-account-link')) return;
    this._openMeeting(event.currentTarget?.dataset?.meetingId);
  }
  handleMeetingCardKeydown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this._openMeeting(event.currentTarget?.dataset?.meetingId);
    }
  }
  _openMeeting(meetingId) {
    this._navigate({ route: 'meeting-center', meetingId: meetingId || null });
  }

  // ═════════════════════════════════════════════════════════════
  // Agent Observability (sub-tabs + chart data)
  // ═════════════════════════════════════════════════════════════
  get showAgentObservabilityBody() {
    // Only reveal the sub-tab body if we're on the agents nav AND a
    // specific agent card is selected in the middle column.
    return this.isAgentsView && !!this._selectedCardId;
  }
  get agentSubTabs() {
    const tabs = [
      { id: 'analytics', label: 'Agent Analytics' },
      { id: 'optimization', label: 'Agent Optimization' },
      { id: 'health', label: 'Agent Health Monitoring' }
    ];
    return tabs.map((t) => ({
      ...t,
      cls: this._agentSubTab === t.id ? 'rmd-agent-tab active' : 'rmd-agent-tab'
    }));
  }
  handleAgentSubTab(event) {
    const id = event.currentTarget.dataset.subtab;
    if (id) this._agentSubTab = id;
  }
  get showAnalyticsTab()   { return this._agentSubTab === 'analytics'; }
  get showOptimizationTab(){ return this._agentSubTab === 'optimization'; }
  get showHealthTab()      { return this._agentSubTab === 'health'; }

  // Bar chart: conversation volume by agent. Sizing is scaled to a
  // fixed viewBox (240 wide, 140 tall) so the SVG stays crisp at any
  // container width without external chart libraries.
  get conversationVolumeBars() {
    const rows = runMyDayAgentAnalytics.conversationVolume;
    const max = rows.reduce((m, r) => Math.max(m, r.value), 0) || 1;
    const barWidth = 60;
    const gap = 30;
    return rows.map((r, i) => {
      const h = Math.round((r.value / max) * 95);
      return {
        id: r.id,
        label: r.label,
        value: r.value.toLocaleString(),
        x: 20 + i * (barWidth + gap),
        y: 130 - h,
        width: barWidth,
        height: h,
        labelX: 20 + i * (barWidth + gap) + barWidth / 2,
        valueY: 145,
        labelY: 158
      };
    });
  }
  get resolutionRows() {
    const rows = runMyDayAgentAnalytics.resolutionRates;
    return rows.map((r, i) => {
      const yTop = 10 + i * 50;
      const width = Math.round((r.pct / 100) * 220);
      return {
        id: r.id,
        label: r.label,
        pct: r.pct + '%',
        labelY: yTop + 12,
        rectY: yTop + 18,
        fillWidth: width,
        pctX: 230,
        pctY: yTop + 38
      };
    });
  }
  get optimizationItems() {
    return runMyDayAgentAnalytics.optimization;
  }
  get healthItems() {
    return runMyDayAgentAnalytics.health;
  }

  // ═════════════════════════════════════════════════════════════
  // Agency Revenue view (composes RID data - unchanged)
  // ═════════════════════════════════════════════════════════════
  get _revenue() {
    return getRevenueIntelligence();
  }
  get revenueKpis() {
    const kpi = this._revenue.kpiMetrics;
    const delta = (curr, prev) => {
      if (!prev) return null;
      const pct = ((curr - prev) / prev) * 100;
      const rounded = Math.round(pct * 10) / 10;
      const up = rounded >= 0;
      return {
        text: `${up ? '+' : ''}${rounded}% YoY`,
        cls: up ? 'rmd-kpi__trend rmd-kpi__trend_up'
               : 'rmd-kpi__trend rmd-kpi__trend_down'
      };
    };
    return [
      {
        id: 'commission',
        label: 'Commission Earned',
        value: COMPACT_USD.format(kpi.totalCommissionEarned),
        trend: delta(kpi.totalCommissionEarned, kpi.totalCommissionEarnedPrevYear)
      },
      {
        id: 'expected',
        label: 'Expected Revenue',
        value: COMPACT_USD.format(kpi.expectedRevenue),
        trend: delta(kpi.expectedRevenue, kpi.expectedRevenuePrevYear)
      },
      {
        id: 'receivables',
        label: 'Outstanding Receivables',
        value: COMPACT_USD.format(kpi.outstandingReceivables),
        trend: delta(kpi.outstandingReceivables, kpi.outstandingReceivablesPrevYear),
        isInverse: true
      },
      {
        id: 'payments',
        label: 'Payments Collected',
        value: COMPACT_USD.format(kpi.totalPaymentsCollected),
        trend: delta(kpi.totalPaymentsCollected, kpi.totalPaymentsCollectedPrevYear)
      }
    ];
  }
  get expectedVsReceivedRows() {
    const rows = this._revenue.expectedVsReceived;
    const scale = rows.reduce((m, r) => Math.max(m, r.expected), 0) || 1;
    return rows.map((r) => {
      const gap = r.expected - r.received;
      const gapPct = r.expected ? Math.round((gap / r.expected) * 100) : 0;
      return {
        id: r.id,
        period: r.period,
        expected: COMPACT_USD.format(r.expected),
        received: COMPACT_USD.format(r.received),
        gapLabel: gap === 0 ? 'On track' : `-${COMPACT_USD.format(gap)} (${gapPct}%)`,
        gapCls: gap === 0
          ? 'rmd-leak__gap rmd-leak__gap_ok'
          : gapPct >= 25
            ? 'rmd-leak__gap rmd-leak__gap_warn'
            : 'rmd-leak__gap',
        expectedWidth: `width: ${(r.expected / scale) * 100}%;`,
        receivedWidth: `width: ${(r.received / scale) * 100}%;`
      };
    });
  }
  get producerLeaderboard() {
    const rows = this._revenue.producerData;
    const top = rows.reduce((m, r) => Math.max(m, r.totalCommission), 0) || 1;
    return rows.map((r, i) => ({
      id: r.id,
      rank: i + 1,
      name: r.name,
      totalCommission: FULL_USD.format(r.totalCommission),
      policyCount: r.policyCount,
      avgPct: `${r.avgCommissionPct.toFixed(1)}%`,
      barWidth: `width: ${(r.totalCommission / top) * 100}%;`,
      isSelf: r.name === this._persona.name,
      rowCls: r.name === this._persona.name
        ? 'rmd-lb__row is-self'
        : 'rmd-lb__row'
    }));
  }
  get revenueAsOfLabel() {
    const stamp = formatUsDate(this._revenue?.asOf);
    return stamp ? `As of ${stamp}` : '';
  }
  handleOpenFullRevenue() {
    this._navigate({ route: 'account-record-page' });
  }

  // ═════════════════════════════════════════════════════════════
  // Principal tabstrip (My Renewals | Agency Revenue)
  // ═════════════════════════════════════════════════════════════
  get tabs() {
    return [
      {
        id: 'renewals',
        label: 'My Renewals',
        cls: this._currentTab === 'renewals' ? 'rmd-htab is-active' : 'rmd-htab',
        selected: this._currentTab === 'renewals'
      },
      {
        id: 'revenue',
        label: 'Agency Revenue',
        cls: this._currentTab === 'revenue' ? 'rmd-htab is-active' : 'rmd-htab',
        selected: this._currentTab === 'revenue'
      }
    ];
  }
  handleTabClick(event) {
    const tab = event.currentTarget.dataset.tab;
    if (!tab || tab === this._currentTab) return;
    this._rmdTab = tab;
    this.dispatchEvent(new CustomEvent('rmdtabchange', {
      detail: { tab },
      bubbles: true,
      composed: true
    }));
  }
}
