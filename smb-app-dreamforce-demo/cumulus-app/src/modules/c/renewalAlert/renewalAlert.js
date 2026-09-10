import { LightningElement, api } from 'lwc';

// Shared USD formatter so each card mount doesn't rebuild it.
const USD_FULL = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

export default class RenewalAlert extends LightningElement {
  @api alert;

  // ── Risk flags ─────────────────────────────────────────────
  // The decision-critical "why" that moved up from L3 (Client 360).
  // Rendered as chips reusing the card's existing .chip pattern.
  get riskFlags() {
    const flags = this.alert?.riskFlags || [];
    return flags.map((label, i) => ({
      key: `${this.alert?.id || 'alert'}-rf-${i}`,
      label
    }));
  }
  get hasRiskFlags() {
    return this.riskFlags.length > 0;
  }

  // ── Premium delta ──────────────────────────────────────────
  // Current → renewal premium with % increase, so the broker sees
  // the magnitude of the change without opening the record.
  get hasPremiumDelta() {
    return (
      this.alert?.currentPremium > 0 && this.alert?.renewalPremium > 0
    );
  }
  get renewalPremiumFmt() {
    return this.hasPremiumDelta ? USD_FULL.format(this.alert.renewalPremium) : '';
  }
  get _premiumIncreasePct() {
    if (!this.hasPremiumDelta) return null;
    if (Number.isFinite(this.alert?.premiumIncreasePct)) {
      return this.alert.premiumIncreasePct;
    }
    const ratio = this.alert.renewalPremium / this.alert.currentPremium;
    return Math.round((ratio - 1) * 100);
  }
  get premiumIncreaseLabel() {
    const pct = this._premiumIncreasePct;
    return pct === null ? '' : `+${pct}%`;
  }

  handleStart() {
    this.dispatchEvent(
      new CustomEvent('startrenewal', {
        detail: { alert: this.alert },
        bubbles: true,
        composed: true
      })
    );
  }

  // Account name link - jumps back to the account's record page (the
  // screen starting point) rather than into the renewal flow.
  handleAccountOpen(event) {
    event.preventDefault();
    this.dispatchEvent(
      new CustomEvent('openaccount', {
        detail: {
          accountId: this.alert?.accountId,
          accountName: this.alert?.accountName
        },
        bubbles: true,
        composed: true
      })
    );
  }
}
