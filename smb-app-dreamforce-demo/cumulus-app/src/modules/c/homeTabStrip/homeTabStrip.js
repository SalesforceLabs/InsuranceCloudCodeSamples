import { LightningElement } from 'lwc';

/**
 * c-home-tab-strip
 *
 * Minimal top strip that promotes the Salesforce-style "Home" pill
 * (extracted from c-account-record-page's workspace tab bar) to a
 * top-level chrome element so routes that used to rely on the Atlas
 * top nav (Run My Day, Renewals Workspace, RFQ Workspace, Meeting
 * Center) still have a single-click way back to Home / Run My Day.
 *
 * Presentational: emits a `navigate` event with the run-my-day route,
 * which c-app's handleNavigate already knows how to route. Global
 * search / notifications / persona menu are intentionally out of
 * scope - the Atlas bar remains available in source (topNav/) if
 * those affordances need to come back later.
 */
export default class HomeTabStrip extends LightningElement {
  handleHomeClick(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    // c-app's handleNavigate shims `route: 'run-my-day'` into
    // route=account-record-page + activeWorkspaceTabId=tab-home, so
    // the SF shell mounts with the Home workspace tab active and
    // RMD renders inside it.
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: { route: 'run-my-day' },
        bubbles: true,
        composed: true
      })
    );
  }

  handleHomeKey(event) {
    if (
      event.key === 'Enter' ||
      event.key === ' ' ||
      event.key === 'Spacebar'
    ) {
      event.preventDefault();
      this.handleHomeClick(event);
    }
  }
}
