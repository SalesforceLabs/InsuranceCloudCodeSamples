import { LightningElement, api } from 'lwc';

/**
 * Global-header notification tray.
 *
 * The SLDS 2 Popover blueprint rendered as the bell's notification
 * list, i.e. the Lightning Experience notifications panel rather than
 * a toast. Toasts stay reserved for transient confirmation of an
 * action the broker just took (see toast-notifications.mdc); this tray
 * is the durable log of things that happened *to* the broker while
 * they were elsewhere in the app - carriers returning quotes on a
 * routed RFQ, for instance.
 *
 * Purely presentational: the shell owns the notification records and
 * their read state, and this component reports intent back up.
 *
 * Consumed by c-account-record-page, which anchors it under the bell
 * cell of the global-header icon strip and sets `--nt-nubbin-inset`
 * so the nubbin points at that bell.
 *
 * Item shape:
 *   { id, title, body, timestamp (epoch ms), unread, rfqId, accountId,
 *     actionLabel?  - optional inline link CTA; clicking it fires
 *                     the same itemopen as the row }
 *
 * Events:
 *   close        - scrim/Escape/close button; parent should unmount
 *   markallread  - "Mark all as read" pressed
 *   itemopen     - { id } a row or its CTA was activated
 */

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export default class NotificationTray extends LightningElement {
  @api open = false;
  @api items = [];

  get rows() {
    return (this.items || []).map((n) => {
      const hasAction = Boolean(n.actionLabel);
      return {
        ...n,
        hasAction,
        timeLabel: this._timeLabel(n.timestamp),
        itemClass: n.unread ? 'nt__item nt__item_unread' : 'nt__item',
        // Quote rows stay one keyboard target. A reply row's CTA is
        // the link, so the chrome around it is a mouse-only hit area.
        rowRole: hasAction ? undefined : 'button',
        rowTabIndex: hasAction ? '-1' : '0'
      };
    });
  }

  get hasItems() {
    return (this.items || []).length > 0;
  }

  get unreadCount() {
    return (this.items || []).filter((n) => n.unread).length;
  }

  get markAllDisabled() {
    return this.unreadCount === 0;
  }

  // Relative stamps are computed at render rather than on a ticking
  // interval. The tray re-renders whenever it opens or a new quote
  // lands, which are the only moments the broker can read them.
  _timeLabel(timestamp) {
    if (!timestamp) return '';
    const secs = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
    if (secs < MINUTE) return 'Just now';
    if (secs < HOUR) return `${Math.floor(secs / MINUTE)}m ago`;
    if (secs < DAY) return `${Math.floor(secs / HOUR)}h ago`;
    return `${Math.floor(secs / DAY)}d ago`;
  }

  handleClose() {
    this.dispatchEvent(new CustomEvent('close'));
  }

  handleMarkAllRead() {
    this.dispatchEvent(new CustomEvent('markallread'));
  }

  handleRowClick(event) {
    this._openItem(event.currentTarget.dataset.id);
  }

  handleRowKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this._openItem(event.currentTarget.dataset.id);
  }

  // Stop the row handler so the same open is not fired twice.
  handleCtaClick(event) {
    event.preventDefault();
    event.stopPropagation();
    this._openItem(event.currentTarget.dataset.id);
  }

  _openItem(id) {
    if (!id) return;
    this.dispatchEvent(new CustomEvent('itemopen', { detail: { id } }));
  }

  handleKeydown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.handleClose();
    }
  }

  // Called by the host after a deliberate bell click so Escape and
  // tab land inside the popover. Auto-open does not steal focus.
  @api
  focusPanel() {
    const panel = this.template.querySelector('.nt');
    if (panel) panel.focus();
  }
}
