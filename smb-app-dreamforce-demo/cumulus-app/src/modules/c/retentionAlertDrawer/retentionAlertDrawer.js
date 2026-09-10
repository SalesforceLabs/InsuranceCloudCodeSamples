import { LightningElement, api, track } from 'lwc';
import { runMyDayCategories, accountHasRecordPage } from 'data/mockData';

// Every insight row offers the same four actions, so this is component policy
// rather than per-row data. Driving it from here instead of from each card's
// `actions` array keeps the set identical across Retain, Grow, Service and
// Comply, and means a label change is one edit rather than forty.
const ROW_ACTIONS = [
  { label: 'Draft email with Agentforce', action: 'draftEmail' },
  { label: 'Draft call with Agentforce', action: 'draftCall' },
  { label: 'Snooze', action: 'snooze' },
  { label: 'Dismiss', action: 'dismiss' }
];

/**
 * c-retention-alert-drawer
 * ────────────────────────
 * Inline "Retention Alert Details" pane - the third column of the
 * Run My Day insights grid. Renders the details for a selected
 * insight card in-place; shows an empty-state pill when no card is
 * selected.
 *
 * Contract:
 *  - `card-id`      : which insight card to render
 *  - `category-id`  : which category the card belongs to (retain, grow, …)
 *
 * Emits (composed + bubbling so c-app catches them without shell
 * plumbing):
 *  - `navigate`: the account name link requested a route change
 *  - `toast`   : a row action requested a toast confirmation
 */
export default class RetentionAlertDrawer extends LightningElement {
  @api cardId;
  @api categoryId;

  @track _openMenuRowId = null;

  // Index of the row-menu item that currently holds the roving tabindex.
  // Only that item sits in the tab order; Arrow keys move it.
  @track _activeItemIndex = 0;

  // Bound document listeners used to auto-dismiss any open row-menu on an
  // outside click or Escape. Attached only while a menu is open so idle
  // drawers don't pay the cost.
  _boundOutsideClick = null;
  _boundDocKeydown = null;

  // renderedCallback focus requests, set by the handlers that open or
  // close a menu. Focus has to move after the re-render that shows or
  // hides the list, not before it.
  _pendingFocusItem = false;
  _pendingFocusTriggerRowId = null;

  disconnectedCallback() {
    this._teardownDismissListeners();
  }

  renderedCallback() {
    if (this._pendingFocusTriggerRowId) {
      const rowId = this._pendingFocusTriggerRowId;
      this._pendingFocusTriggerRowId = null;
      const trigger = this.template.querySelector(
        `.af-action-btn[data-row-id="${rowId}"]`
      );
      if (trigger) trigger.focus();
      return;
    }
    if (this._pendingFocusItem && this._openMenuRowId) {
      this._pendingFocusItem = false;
      const items = this._menuItems(this._openMenuRowId);
      const target = items[this._activeItemIndex] || items[0];
      if (target) target.focus();
    }
  }

  // ── Data lookup ─────────────────────────────────────────────
  get _card() {
    if (!this.cardId) return null;
    const catId = this.categoryId;
    // `all` view flattens every category - search across all buckets.
    if (!catId || catId === 'all') {
      for (const cat of runMyDayCategories) {
        const hit = cat.cards.find((c) => c.id === this.cardId);
        if (hit) return { ...hit, _categoryId: cat.id };
      }
      return null;
    }
    const cat = runMyDayCategories.find((c) => c.id === catId);
    if (!cat) return null;
    const hit = cat.cards.find((c) => c.id === this.cardId);
    return hit ? { ...hit, _categoryId: cat.id } : null;
  }

  // ── Drawer chrome ───────────────────────────────────────────
  get hasCard() {
    return !!this._card;
  }
  get drawerClass() {
    return this._card ? 'af-drawer' : 'af-drawer af-drawer--empty';
  }
  get title() {
    return this._card?.title || 'Retention Alert Details';
  }
  get summary() {
    return (
      this._card?.alertLong ||
      this._card?.summary ||
      'Select an insight to view detail.'
    );
  }
  get updatedLabel() {
    return this._card?.updated || '';
  }
  get hasUpdatedLabel() {
    return !!this.updatedLabel;
  }

  // ── Row list (accounts inside the selected insight) ─────────
  get rows() {
    const card = this._card;
    if (!card?.rows) return [];
    return card.rows.map((r) => ({
      ...r,
      // Accounts outside the record-page set have no tab to land on, so
      // the name renders as plain text rather than an anchor that goes
      // nowhere. Mirrors c-run-my-day and c-meeting-center.
      hasAccountLink: accountHasRecordPage(r.accountId),
      isAccountPlainText: !accountHasRecordPage(r.accountId),
      badgeItems: (r.badges || []).map((b, i) => ({
        key: r.id + '-b-' + i,
        label: b.label,
        cls: 'rmd-name-badge ' + (b.kind || 'hni'),
        showIcon: b.kind === 'attention'
      })),
      actionItems: ROW_ACTIONS.map((a, i) => ({
        key: r.id + '-a-' + i,
        label: a.label,
        actionId: a.action,
        tabIndex: i === this._activeItemIndex ? '0' : '-1',
        cls: 'rmd-row-action'
      })),
      hasEscalation: !!r.escalation,
      escalationLabel: (r.escalation || '').replace(/^[\u26A0\uFE0F\s]+/, ''),
      menuOpen: this._openMenuRowId === r.id,
      menuId: r.id + '-actions-menu',
      triggerClass:
        this._openMenuRowId === r.id
          ? 'slds-dropdown-trigger slds-dropdown-trigger_click slds-is-open af-action-menu'
          : 'slds-dropdown-trigger slds-dropdown-trigger_click af-action-menu',
      menuClass:
        this._openMenuRowId === r.id
          ? 'slds-dropdown slds-dropdown_right slds-dropdown_small rmd-action-dropdown open'
          : 'slds-dropdown slds-dropdown_right slds-dropdown_small rmd-action-dropdown',
      menuBtnAria: this._openMenuRowId === r.id ? 'true' : 'false'
    }));
  }
  get hasRows() {
    return this.rows.length > 0;
  }

  // ── Handlers ────────────────────────────────────────────────
  handleOpenAccountLink(event) {
    event.preventDefault();
    const accountId = event.currentTarget.dataset.accountId;
    if (accountId) this._navigate({ route: 'account-record-page', accountId });
  }

  handleRowMenuToggle(event) {
    event.stopPropagation();
    const rowId = event.currentTarget.dataset.rowId;
    if (!rowId) return;
    if (this._openMenuRowId === rowId) {
      this._closeMenu(false);
      return;
    }
    // A click with `detail` 0 came from Enter or Space on the button, so
    // the menu was opened by keyboard and focus belongs on the first item.
    this._openMenu(rowId, event.detail === 0);
  }

  handleTriggerKeydown(event) {
    const rowId = event.currentTarget.dataset.rowId;
    if (!rowId) return;
    const key = event.key;
    if (key === 'ArrowDown' || key === 'Down') {
      event.preventDefault();
      this._openMenu(rowId, true);
      return;
    }
    if (key === 'ArrowUp' || key === 'Up') {
      event.preventDefault();
      this._openMenu(rowId, true, -1);
      return;
    }
    if ((key === 'Escape' || key === 'Esc') && this._openMenuRowId) {
      event.preventDefault();
      this._closeMenu(true);
    }
  }

  handleMenuKeydown(event) {
    const rowId = event.currentTarget.dataset.rowId;
    if (!rowId) return;
    const key = event.key;
    if (key === 'Escape' || key === 'Esc') {
      event.preventDefault();
      event.stopPropagation();
      this._closeMenu(true);
      return;
    }
    // Tab moves focus out of the menu, so the menu should not stay open
    // behind it. No preventDefault: the browser still performs the move.
    if (key === 'Tab') {
      this._closeMenu(false);
      return;
    }
    const items = this._menuItems(rowId);
    if (!items.length) return;
    const current = items.indexOf(event.currentTarget);
    let next;
    if (key === 'ArrowDown' || key === 'Down') {
      next = (current + 1) % items.length;
    } else if (key === 'ArrowUp' || key === 'Up') {
      next = (current - 1 + items.length) % items.length;
    } else if (key === 'Home') {
      next = 0;
    } else if (key === 'End') {
      next = items.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    this._activeItemIndex = next;
    items[next].focus();
  }

  handleRowAction(event) {
    event.stopPropagation();
    const rowId = event.currentTarget.dataset.rowId;
    const actionId = event.currentTarget.dataset.action;
    // Hand focus back to the trigger: the item that had it is about to be
    // hidden.
    this._closeMenu(true);
    if (!rowId || !actionId) return;
    const card = this._card;
    const row = card?.rows?.find((r) => r.id === rowId);
    if (!row) return;
    // The row actions are no-ops in the prototype and no longer toast -
    // see the toast policy in c/app.
  }
  _friendlyActionMessage(actionId, row) {
    switch (actionId) {
      case 'draftEmail':      return `Agentforce is drafting an email for ${row.name}.`;
      case 'draftCall':       return `Agentforce is drafting call talking points for ${row.name}.`;
      case 'snooze':          return `${row.name} snoozed until tomorrow.`;
      case 'dismiss':         return `${row.name} dismissed from today's queue.`;
      default:                return `Action triggered for ${row.name}.`;
    }
  }
  _navigate(detail) {
    this.dispatchEvent(
      new CustomEvent('navigate', { detail, bubbles: true, composed: true })
    );
  }

  // ── Menu open / close ───────────────────────────────────────
  _openMenu(rowId, focusItem, fromEnd) {
    this._openMenuRowId = rowId;
    this._activeItemIndex = fromEnd === -1 ? ROW_ACTIONS.length - 1 : 0;
    this._pendingFocusItem = !!focusItem;
    this._ensureDismissListeners();
  }

  _closeMenu(returnFocusToTrigger) {
    const rowId = this._openMenuRowId;
    this._openMenuRowId = null;
    this._activeItemIndex = 0;
    this._pendingFocusItem = false;
    if (returnFocusToTrigger && rowId) this._pendingFocusTriggerRowId = rowId;
    this._teardownDismissListeners();
  }

  _menuItems(rowId) {
    return Array.from(
      this.template.querySelectorAll(`.rmd-row-action[data-row-id="${rowId}"]`)
    );
  }

  _ensureDismissListeners() {
    if (this._boundOutsideClick) return;
    this._boundOutsideClick = (evt) => {
      // Any click that isn't on this drawer's own trigger or inside its
      // open menu closes the currently-open row menu. The trigger is
      // excluded so its own handler can perform the close-on-second-click
      // toggle instead of this listener closing and the handler reopening.
      const path = evt.composedPath ? evt.composedPath() : [];
      const inside = path.some(
        (n) =>
          n && n.classList && (
            n.classList.contains('af-action-btn') ||
            n.classList.contains('rmd-action-dropdown')
          )
      );
      if (inside) return;
      this._closeMenu(false);
    };
    this._boundDocKeydown = (evt) => {
      // Escape closes from anywhere, including when the pointer opened the
      // menu and focus never entered the list.
      if (evt.key !== 'Escape' && evt.key !== 'Esc') return;
      if (!this._openMenuRowId) return;
      this._closeMenu(true);
    };
    document.addEventListener('click', this._boundOutsideClick, true);
    document.addEventListener('keydown', this._boundDocKeydown, true);
  }

  _teardownDismissListeners() {
    if (this._boundOutsideClick) {
      document.removeEventListener('click', this._boundOutsideClick, true);
      this._boundOutsideClick = null;
    }
    if (this._boundDocKeydown) {
      document.removeEventListener('keydown', this._boundDocKeydown, true);
      this._boundDocKeydown = null;
    }
  }
}
