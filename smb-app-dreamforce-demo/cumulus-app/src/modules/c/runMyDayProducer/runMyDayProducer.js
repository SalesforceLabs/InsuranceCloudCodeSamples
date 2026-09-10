import { LightningElement } from 'lwc';
import { renewalAlerts } from 'data/mockData';
import { today } from 'data/dates';

// A row counts as a "big-increase" trigger when the renewal quote is
// 15%+ above the expiring premium. Same threshold the workspace uses
// for its Remarket vs. View action mapping.
const BIG_INCREASE_THRESHOLD = 1.15;

// Watch window for the pipeline strip. Kept in one place so the prose
// summary, the chip counts, and any downstream logic all agree.
const WATCH_WINDOW_DAYS = 60;

export default class RunMyDayProducer extends LightningElement {
  // Freshness signal snapshot taken when the component mounts, so the
  // AI-generated timestamp inside c-agentic-card stays stable across
  // re-renders instead of ticking every keystroke.
  _timestamp = '';

  connectedCallback() {
    this._timestamp = this._formatTimestamp(today());
  }

  // ═════════════════════════════════════════════════════════════
  // Agent Insight (rendered inside c-agentic-card's default slot)
  // Reads the same 0-60 day flagged slice the workspace's Action
  // Required tab uses, then exposes the parts needed to compose a
  // single prose sentence - plus a structured `sources` array so
  // the reader can see the accounts Agentforce reasoned over.
  // ═════════════════════════════════════════════════════════════
  get _atRiskRows() {
    return renewalAlerts.filter((r) => {
      if (r.daysToExpiration < 0 || r.daysToExpiration > WATCH_WINDOW_DAYS) return false;
      const ratio = r.currentPremium
        ? r.renewalPremium / r.currentPremium
        : 1;
      const hasBigIncrease = ratio >= BIG_INCREASE_THRESHOLD;
      return hasBigIncrease || !!r.hasOpenClaim;
    });
  }

  get atRiskCount() {
    return this._atRiskRows.length;
  }

  get hasAtRisk() {
    return this.atRiskCount > 0;
  }

  // Prose helpers - kept as small getters so the HTML stays flat and
  // template bindings don't need arithmetic.
  get atRiskCountLabel() {
    const n = this.atRiskCount;
    return `${n} ${n === 1 ? 'renewal' : 'renewals'}`;
  }
  get atRiskNoun() {
    return this.atRiskCount === 1 ? 'needs' : 'need';
  }

  get spikesCount() {
    return this._atRiskRows.filter((r) => {
      const ratio = r.currentPremium ? r.renewalPremium / r.currentPremium : 1;
      return ratio >= BIG_INCREASE_THRESHOLD;
    }).length;
  }
  get spikesLabel() {
    const n = this.spikesCount;
    return `${n} ${n === 1 ? 'account' : 'accounts'}`;
  }

  get claimsCount() {
    return this._atRiskRows.filter((r) => !!r.hasOpenClaim).length;
  }
  get claimsLabel() {
    const n = this.claimsCount;
    return `${n} ${n === 1 ? 'account' : 'accounts'}`;
  }

  get hasBothSignals() {
    return this.spikesCount > 0 && this.claimsCount > 0;
  }

  // Nearest expiration inside the flagged set, in days. Rendered inline
  // as "the nearest expires in N days".
  get _nextExpirationDays() {
    if (!this._atRiskRows.length) return null;
    return this._atRiskRows.reduce(
      (min, r) => (r.daysToExpiration < min ? r.daysToExpiration : min),
      Infinity
    );
  }
  get nextExpirationLabel() {
    const d = this._nextExpirationDays;
    if (d === null || !Number.isFinite(d)) return '-';
    if (d <= 0) return 'today';
    if (d === 1) return '1 day';
    return `${d} days`;
  }

  // Copy for the "clear pipeline" empty state.
  get watchingLabel() {
    const total = renewalAlerts.filter(
      (r) => r.daysToExpiration >= 0 && r.daysToExpiration <= WATCH_WINDOW_DAYS
    ).length;
    return `${total} ${total === 1 ? 'renewal' : 'renewals'}`;
  }

  // ─── Sources passed to c-agentic-card ─────────────────────────
  // Each flagged account is one source citation. The card renders
  // them as "N · <Account Name> · Account" per the SVG spec.
  get insightSources() {
    return this._atRiskRows.map((r) => ({
      id: r.id ?? r.accountName,
      label: r.accountName,
      type: 'Account'
    }));
  }

  // ─── Freshness / provenance passed to the card ────────────────
  get insightTimestamp() {
    return this._timestamp;
  }

  // ─── c-agentic-card event handlers ────────────────────────────
  // Refresh restamps the timestamp so the freshness signal updates
  // immediately; the bubbled event is available for a future backend
  // integration to trigger a real regeneration.
  handleRefreshInsight() {
    this._timestamp = this._formatTimestamp(today());
    this.dispatchEvent(
      new CustomEvent('insightrefresh', { bubbles: true, composed: true })
    );
  }

  handleToggleSources(event) {
    this.dispatchEvent(
      new CustomEvent('insightsources', {
        detail: {
          count: this.insightSources.length,
          open: event?.detail?.open
        },
        bubbles: true,
        composed: true
      })
    );
  }

  handleFeedback(event) {
    this.dispatchEvent(
      new CustomEvent('insightfeedback', {
        detail: event.detail,
        bubbles: true,
        composed: true
      })
    );
  }

  handleOpenWorkspace() {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { route: 'renewal-workspace' },
      bubbles: true,
      composed: true
    }));
  }

  // ─── Utilities ────────────────────────────────────────────────
  _formatTimestamp(date) {
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const suffix = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `Today at ${hours}:${minutes} ${suffix}`;
  }
}
