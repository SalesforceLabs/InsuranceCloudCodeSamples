import { LightningElement, api, track } from 'lwc';
import {
  getMeetingPrep,
  getMeetingSlackData,
  runMyDayMeetings,
  accountHasRecordPage
} from 'data/mockData';
import { formatUsDate, today } from 'data/dates';
import { readForcedState } from 'c/emptyState';
import { ILLUSTRATIONS } from '../../../assets/illustrations/slds2/illustrations.js';

// Stage labels and ordering follow the org's Meeting Playbook page
// (Pre Meeting / In Session / Post Meeting) so a broker moving between
// the two surfaces reads the same three words in the same order.
const TABS = [
  { id: 'prep', label: 'Pre Meeting' },
  { id: 'session', label: 'In Session' },
  { id: 'follow', label: 'Post Meeting' }
];

// The draft banner shows the timestamp in the canonical "Today at HH:MM"
// shape the retention-alert-drawer and c-agentic-card use elsewhere so
// AI-provenance freshness reads consistently across every Agentic
// surface. Falls back to the raw ISO string on parse failure.
function fmtDraftTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `Today at ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  } catch (e) {
    return iso;
  }
}

// Slugs the playbook status into a modifier class so the header pill
// can tint per stage the way the org's does (In Prep, Prep Complete,
// In Session, Post Meeting).
function statusModifier(status) {
  return (status || '').toLowerCase().replace(/[^a-z]+/g, '-');
}

// The org header prints the meeting date as MM/DD/YYYY next to the
// time range. The carousel already renders the same shape, so both
// surfaces agree on what "when" looks like.
function todaySlashDate() {
  return formatUsDate(today());
}

export default class MeetingCenter extends LightningElement {
  // Which playbook this panel is showing. Set by c-account-record-page
  // from the workspace tab that owns the panel. Unset falls back to the
  // first meeting on the carousel so a bare `?route=meeting-center`
  // deep-link still renders something.
  @api meetingId;

  @track activeTab = 'prep';
  // Ticked Agentforce actions, scoped to the playbook they were ticked on.
  // Only the broker's own ticks live here; the rows themselves are derived
  // from the active playbook at render time. A null `meetingId` means no
  // tick has been recorded yet, so the payload's own defaults stand.
  @track checkedActions = { meetingId: null, ids: [] };
  // Draft state lifecycle: 'draft' (Agentforce created it, awaiting
  // review), 'saved' (broker clicked Save to Record - pinned to the
  // account for the meeting), or 'discarded' (broker rejected it -
  // the card unmounts so the segment falls back to the metrics grid
  // as the top-of-page anchor). This mirrors the way the Retention
  // Alert drawer treats a summary as a first-class draft object.
  @track draftStatus = 'draft';
  // Org Client Summary lands with Sources expanded; Documents lands
  // expanded (the header control is Collapse). Both match the live
  // Meeting Playbook Pre Meeting tab.
  @track prepSourcesOpen = true;
  @track prepDocsOpen = true;

  // ── Record header (mirrors the org's meeting-highlights-panel) ──
  // The org's Meeting Playbook page opens on a breadcrumb, a title with
  // a status pill, the event's date + time range, and a three-column
  // Organizer / Related Record / Event meta row. Everything here comes
  // off the same carousel catalog the Home page reads, so the card the
  // broker clicked and the page they land on cannot disagree.
  get meeting() {
    return (
      runMyDayMeetings.find((m) => m.id === this.meetingId) ||
      runMyDayMeetings[0] ||
      null
    );
  }

  get meetingTitle() {
    return this.meeting?.name || `${this.prep.agency} - Renewal Prep`;
  }

  get meetingStatus() {
    return this.meeting?.status || '';
  }

  get statusPillClass() {
    return `mc-status mc-status_${statusModifier(this.meetingStatus)}`;
  }

  get meetingTimeRange() {
    const m = this.meeting;
    if (!m) return '';
    const meetingDate = formatUsDate(m.dateKey) || todaySlashDate();
    return `${meetingDate}, ${m.startTime} - ${m.endTime}`;
  }

  get breadcrumbParent() {
    return this.meeting?.relatedRecord || '';
  }

  get hasBreadcrumbParent() {
    return Boolean(this.breadcrumbParent);
  }

  // Accounts outside the record-page set have no tab to land on, so the
  // parent renders as plain text instead of an anchor that goes nowhere.
  get isParentLinkable() {
    return accountHasRecordPage(this.meeting?.accountId);
  }

  get isParentPlainText() {
    return this.hasBreadcrumbParent && !this.isParentLinkable;
  }

  get draftTimestamp() {
    return fmtDraftTime(this.prep.draftCreatedAt);
  }

  get draftBookAtAGlance() {
    return (this.prep.draft?.bookAtAGlance || []).map((line, i) => ({
      id: `bag-${i}`,
      line
    }));
  }

  get draftSources() {
    return this.prep.sources || [];
  }

  // True while the draft is still in "draft" review state (i.e. neither
  // saved nor discarded). Drives the top-of-page Agentic card visibility.
  get showDraftCard() {
    return this.draftStatus === 'draft';
  }

  // Saved-state confirmation strip - replaces the draft card once
  // the broker commits the summary to the record.
  get showSavedNotice() {
    return this.draftStatus === 'saved';
  }

  get tabsView() {
    return TABS.map((t) => ({
      ...t,
      className: t.id === this.activeTab ? 'tab is-active' : 'tab'
    }));
  }

  get isPrep() {
    return this.activeTab === 'prep';
  }

  // ── Forced empty/error state (`?forceEmpty=mc@<code>`). ─────
  _forcedMcState = readForcedState('mc');
  get hasForcedMcState() {
    return Boolean(this._forcedMcState);
  }
  get forcedMcStateName() {
    return this._forcedMcState;
  }
  get forcedMcStateTitle() {
    const map = {
      'error:recoverable': 'Couldn’t load meeting prep',
      'error:connectionissue': 'You’re offline',
      'error:appconnection': 'Agentforce is unreachable',
      'error:unrecoverable': 'We hit an unexpected problem',
      'accessissues:request': 'You don’t have access to Meeting Center',
      'accessissues:deleted': 'This meeting was deleted',
      'success:new': 'No meeting selected'
    };
    return map[this._forcedMcState] || '';
  }
  get forcedMcStateDescription() {
    const map = {
      'error:recoverable': 'The prep draft failed to load. Try again in a moment.',
      'error:connectionissue': 'Reconnect to sync the latest prep, sources, and follow-ups.',
      'error:appconnection': 'Agentforce didn’t respond. Retry, or check integration health.',
      'error:unrecoverable': 'Refresh the page or contact your admin if this keeps happening.',
      'accessissues:request': 'Ask your admin for the Meeting Center permission set.',
      'accessissues:deleted': 'The organizer removed this meeting. Pick another meeting from your calendar.',
      'success:new': 'Open a meeting from Run My Day to see its prep, session notes, and follow-ups here.'
    };
    return map[this._forcedMcState] || '';
  }
  get forcedMcStateCtaLabel() {
    const map = {
      'error:recoverable': 'Try again',
      'error:connectionissue': 'Retry',
      'error:appconnection': 'Retry',
      'error:unrecoverable': 'Reload'
    };
    return map[this._forcedMcState] || '';
  }
  get hasForcedMcStateCta() {
    return Boolean(this.forcedMcStateCtaLabel);
  }
  get showMcSurface() {
    return !this.hasForcedMcState;
  }
  get isSession() {
    return this.activeTab === 'session';
  }
  get isFollow() {
    return this.activeTab === 'follow';
  }

  // Prep is resolved from the playbook the broker clicked rather than being
  // one shared payload, so the brief, discussion guide, and recap describe
  // the account named in the breadcrumb.
  get prep() {
    return getMeetingPrep(this.meeting?.id, this.meeting?.accountId);
  }

  get prepActions() {
    const ids = this.checkedActionIds;
    return this.prep.agentforceActions.map((a) => {
      const checked = ids.includes(a.id);
      return {
        ...a,
        checked,
        itemClass: checked ? 'check is-checked' : 'check'
      };
    });
  }

  // The ticks belong to a specific playbook, so pointing the panel at a
  // different meeting drops back to that playbook's own defaults rather
  // than carrying the previous one's ticks over. Derived rather than
  // reseeded on the fly, because writing tracked state from inside a
  // template getter is a render-time side effect LWC rejects.
  get checkedActionIds() {
    const id = this.meeting?.id ?? null;
    if (this.checkedActions.meetingId === id) return this.checkedActions.ids;
    return this.prep.agentforceActions
      .filter((a) => a.checked)
      .map((a) => a.id);
  }

  // Client Summary metrics differ per line of business - a household renewal
  // has nothing meaningful to say about submission volume - so each playbook
  // names its own three.
  get prepMetrics() {
    return (this.prep.summary?.metrics || []).map((m) => ({
      ...m,
      deltaClass: m.dir ? `metric-delta ${m.dir}` : 'metric-delta'
    }));
  }

  get selectedCount() {
    return this.checkedActionIds.length;
  }

  // ── Cards shared with, or unique to, each stage ─────────────────
  // The org splits each stage into a narrow column and a wide one, and
  // the split differs per stage. Rather than force one ratio on all
  // three, each stage names its own grid modifier.
  get prepGridClass() {
    return 'mc-grid mc-grid_brief';
  }

  get sessionGridClass() {
    return 'mc-grid mc-grid_even';
  }

  get followGridClass() {
    return 'mc-grid mc-grid_summary';
  }

  get documents() {
    return this.prep.documents || [];
  }

  get hasDocuments() {
    return this.documents.length > 0;
  }

  // The Pre Meeting cards follow the org's layout but read the same
  // per-playbook payload every other stage does, so the summary, tasks,
  // and brief describe the account named in the breadcrumb rather than
  // a second, unrelated client.
  get orgPrep() {
    return this.prep.preMeeting;
  }

  get meetingPrepTasks() {
    return this.orgPrep.tasks;
  }

  get meetingPrepTaskCount() {
    return this.orgPrep.tasksTotal;
  }

  get meetingPrepTaskTitle() {
    return `Meeting Preparation Tasks (${this.orgPrep.tasksTotal})`;
  }

  get summaryBullets() {
    return this.orgPrep.bullets;
  }

  // Heading and body stay siblings rather than being wrapped, so the
  // `.mc-brief__h:first-of-type` margin reset still finds only the first
  // heading in the card. That means each iteration has two roots, and
  // LWC needs a distinct key on each.
  get briefSections() {
    return this.orgPrep.brief.sections.map((s) => ({
      ...s,
      headingKey: `${s.id}-h`,
      bodyKey: `${s.id}-b`
    }));
  }

  get briefAgenda() {
    return this.orgPrep.brief.suggestedAgenda.map((text, i) => ({
      id: `agenda-${i}`,
      text
    }));
  }

  get briefPriorities() {
    return this.orgPrep.brief.meetingPriorities.map((text, i) => ({
      id: `priority-${i}`,
      text
    }));
  }

  get prepReadinessLabel() {
    return `${this.orgPrep.tasksCompleted}/${this.orgPrep.tasksTotal} Completed`;
  }

  get prepReadinessPct() {
    const { tasksCompleted: done, tasksTotal: total } = this.orgPrep;
    return total ? Math.round((done / total) * 100) : 0;
  }

  get prepReadinessValueStyle() {
    return `width: ${this.prepReadinessPct}%`;
  }

  get prepReadinessAria() {
    return `${this.prepReadinessPct}%`;
  }

  get prepReadinessNow() {
    return String(this.prepReadinessPct);
  }

  get citedSources() {
    return this.orgPrep.citedSources;
  }

  get referenceSources() {
    return this.orgPrep.references;
  }

  get prepSourcesCount() {
    return this.citedSources.length + this.referenceSources.length;
  }

  get prepSourcesToggleLabel() {
    return `Sources (${this.prepSourcesCount})`;
  }

  get prepSourcesChevronClass() {
    return this.prepSourcesOpen
      ? 'mc-org-sources__chev is-open'
      : 'mc-org-sources__chev';
  }

  get prepSourcesAriaExpanded() {
    return this.prepSourcesOpen ? 'true' : 'false';
  }

  get docsCollapseLabel() {
    return this.prepDocsOpen ? 'Collapse' : 'Expand';
  }

  get docsEmptyIllustration() {
    return ILLUSTRATIONS['noresults:search'];
  }

  get docsChevronClass() {
    return this.prepDocsOpen
      ? 'mc-org-card__chev is-open'
      : 'mc-org-card__chev';
  }

  get discussionTopics() {
    return this.prep.discussionGuide?.topics || [];
  }

  get discussionGuideTimestamp() {
    return fmtDraftTime(this.prep.discussionGuide?.createdAt);
  }

  get followUpTimestamp() {
    return fmtDraftTime(this.prep.followUp?.createdAt);
  }

  get followUpDecisions() {
    return (this.prep.followUp?.decisions || []).map((line, i) => ({
      id: `fu-${i}`,
      line
    }));
  }

  // ── Slack sidebar ───────────────────────────────────────────────
  // Only Mavericks meetings have an account channel in this demo. Every
  // other account keeps the org's disconnected Slack Channel card.
  get meetingSlack() {
    return getMeetingSlackData(this.meeting);
  }

  get slackConnected() {
    return Boolean(this.meetingSlack);
  }

  get slackChannelName() {
    return this.meetingSlack?.channelName || '';
  }

  get slackMembers() {
    return this.meetingSlack?.members || [];
  }

  get slackMessages() {
    return this.meetingSlack?.messages || [];
  }

  handleTab(event) {
    const tab = event.currentTarget.dataset.tab;
    if (tab) this.activeTab = tab;
  }

  // The org's stage buttons are generative handoffs: the Pre Meeting
  // stage generates the discussion guide the In Session stage reads
  // from, and In Session generates the follow-up Post Meeting reads
  // from. Advancing the stage is what makes that handoff legible.
  handleGenerateGuide() {
    this.activeTab = 'session';
  }

  handleTogglePrepSources() {
    this.prepSourcesOpen = !this.prepSourcesOpen;
  }

  handleTogglePrepDocs() {
    this.prepDocsOpen = !this.prepDocsOpen;
  }

  handleTaskNameClick(event) {
    event.preventDefault();
  }

  handleGenerateFollowUp() {
    this.activeTab = 'follow';
  }

  // Meeting Concierge is the day-level view of every meeting on the
  // calendar, which in this app is Run My Day on Home.
  handleGoToConcierge() {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { route: 'home' },
      bubbles: true,
      composed: true
    }));
  }

  // Breadcrumb parent + the Related Record link both route to the
  // account, leaving this meeting's own tab open behind them - the same
  // way the org's breadcrumb navigates without closing the record tab.
  handleBreadcrumbClick(event) {
    event.preventDefault();
    const accountId = this.meeting?.accountId;
    if (!accountId) return;
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { route: 'account-record-page', accountId },
      bubbles: true,
      composed: true
    }));
  }

  toggleAction(event) {
    const id = event.target.dataset.id;
    const ids = this.checkedActionIds;
    this.checkedActions = {
      meetingId: this.meeting?.id ?? null,
      ids: event.target.checked
        ? [...ids, id]
        : ids.filter((x) => x !== id)
    };
  }

  handleSaveDraft() {
    this.draftStatus = 'saved';
  }

  handleDiscardDraft() {
    this.draftStatus = 'discarded';
  }
}
