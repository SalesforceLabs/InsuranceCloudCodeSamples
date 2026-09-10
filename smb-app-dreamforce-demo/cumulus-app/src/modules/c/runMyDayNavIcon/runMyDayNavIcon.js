import { LightningElement, api } from 'lwc';

// Small presentational shim that picks the right vertical-nav glyph
// for Run My Day's Action Items rail. Kept as its own module so the
// runMyDay template stays free of six inline SVG blocks (LWC doesn't
// support a native switch expression in markup).
//
// Glyphs are filled SLDS utility icons (x-small / 16px), not stroke
// sketches. The first four are the exact symbols the org's Advisor Home
// renders on its group pills. Icon-key mapping:
//   retain  → utility:user                   (retention / relationship work)
//   grow    → utility:forward_up             (pipeline growth)
//   service → utility:questions_and_answers  (case / service work)
//   comply  → utility:shield                 (regulatory / compliance)
//   all     → utility:apps                   (aggregate view)
//   agents  → utility:sparkles               (AI Agents / Agentforce)
//
// Falls back to a filled circle so template errors show up quickly
// in dev instead of silently rendering nothing.
export default class RunMyDayNavIcon extends LightningElement {
  @api iconKey;

  get isUsers()   { return this.iconKey === 'users'; }
  get isGrowth()  { return this.iconKey === 'growth'; }
  get isChat()    { return this.iconKey === 'chat'; }
  get isShield()  { return this.iconKey === 'shield'; }
  get isGrid()    { return this.iconKey === 'grid'; }
  get isSparkle() { return this.iconKey === 'sparkle'; }
  get isFallback() {
    return !(
      this.isUsers || this.isGrowth || this.isChat
      || this.isShield || this.isGrid || this.isSparkle
    );
  }
}
