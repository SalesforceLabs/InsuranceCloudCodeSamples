import { LightningElement, api, track } from 'lwc';

/**
 * c-activity-panel - the Activity / Chatter tabset the org parks in the
 * second, narrower column of a record page.
 *
 * Shared by every record page that carries a sidebar (Account, Insurance
 * Policy) so the two read as the same component rather than two copies that
 * drift. "Upcoming & Overdue" is the one section the org ships expanded.
 *
 * Composers, the settings gear and the View All / Show All Activities
 * affordances all navigate away in a real org, so they confirm through the
 * shared toast instead of dead-ending on a click.
 */
export default class ActivityPanel extends LightningElement {
  // Object noun for the Chatter empty state ("...conversation on this
  // account" / "...on this policy").
  @api recordLabel = 'record';

  @track activityTab = 'activity';
  @track activityUpcomingOpen = true;

  get chatterEmptySub() {
    return `Share an update to start the conversation on this ${this.recordLabel}.`;
  }

  get activityTabs() {
    return [
      { id: 'activity', label: 'Activity' },
      { id: 'chatter', label: 'Chatter' }
    ].map((t) => {
      const active = t.id === this.activityTab;
      return {
        ...t,
        tabId: `sf-activity-tab-${t.id}`,
        panelId: `sf-activity-panel-${t.id}`,
        className: active ? 'sf-activity-tab is-active' : 'sf-activity-tab',
        selected: active ? 'true' : 'false',
        tabIndex: active ? 0 : -1
      };
    });
  }

  get isActivityFeed() {
    return this.activityTab === 'activity';
  }

  // Both sides of the tab/panel idref pair are bound expressions so LWC
  // leaves them untouched; a static id would be rewritten on one side
  // only and break the association.
  get activePanelId() {
    return `sf-activity-panel-${this.activityTab}`;
  }

  get activeTabDomId() {
    return `sf-activity-tab-${this.activityTab}`;
  }

  get upcomingCaretClass() {
    return this.activityUpcomingOpen
      ? 'sf-activity-section-caret is-open'
      : 'sf-activity-section-caret';
  }

  get upcomingAriaExpanded() {
    return this.activityUpcomingOpen ? 'true' : 'false';
  }

  handleActivityTabClick(event) {
    this.activityTab = event.currentTarget.dataset.tab;
  }

  handleActivityTabKeydown(event) {
    const ids = this.activityTabs.map((t) => t.id);
    const current = ids.indexOf(this.activityTab);
    let next = current;
    if (event.key === 'ArrowLeft') next = (current - 1 + ids.length) % ids.length;
    else if (event.key === 'ArrowRight') next = (current + 1) % ids.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = ids.length - 1;
    else return;

    event.preventDefault();
    this.activityTab = ids[next];
    Promise.resolve().then(() => {
      this.template
        .querySelector(`.sf-activity-tab[data-tab="${ids[next]}"]`)
        ?.focus();
    });
  }

  handleActivityToggleUpcoming() {
    this.activityUpcomingOpen = !this.activityUpcomingOpen;
  }

  handleActivityExpandAll() {
    this.activityUpcomingOpen = true;
  }

  // Refresh and the row actions are both no-ops in the prototype and
  // no longer toast - see the toast policy in c/app.
  handleActivityRefresh() {}

  handleActivityAction() {}
}
