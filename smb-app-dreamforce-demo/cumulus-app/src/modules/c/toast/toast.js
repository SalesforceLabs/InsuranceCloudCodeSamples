import { LightningElement, api } from 'lwc';

/**
 * c-toast — SLDS 2 Toast blueprint (top-center anchored with a
 * modal-style backdrop).
 *
 * The parent sets `visible` to true, then clears it after the
 * auto-dismiss timeout (or in response to the `dismiss` event
 * when the user clicks the close button or the backdrop).
 *
 * Blueprint:
 *   https://www.lightningdesignsystem.com/2e1ef8501/p/6d5c11-toast
 */
export default class Toast extends LightningElement {
  @api message = '';
  @api kind = 'success';   // 'success' | 'info' | 'error'
  @api visible = false;

  get toastClass() {
    const themeMap = {
      success: 'slds-theme_success',
      info: 'slds-theme_info',
      error: 'slds-theme_error'
    };
    const theme = themeMap[this.kind] || themeMap.success;
    return `slds-notify slds-notify_toast ${theme}`;
  }

  get isSuccess() {
    return this.kind === 'success';
  }

  get isError() {
    return this.kind === 'error';
  }

  get kindLabel() {
    if (this.kind === 'error') return 'Error';
    if (this.kind === 'info') return 'Info';
    return 'Success';
  }

  handleDismiss() {
    this.dispatchEvent(new CustomEvent('dismiss'));
  }
}
