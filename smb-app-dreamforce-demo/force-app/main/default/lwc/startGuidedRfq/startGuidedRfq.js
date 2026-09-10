import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import { CloseActionScreenEvent } from 'lightning/actions';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import ACCOUNT_NAME from '@salesforce/schema/Account.Name';
import ACCOUNT_OWNER from '@salesforce/schema/Account.Owner.Name';
import ACCOUNT_INDUSTRY from '@salesforce/schema/Account.Industry';

// Step 1 of the org-native Guided RFQ — a Quick Action screen that
// confirms the launch context (account + suggested LOB/LOCs) before
// transitioning into the full TurboTax-style wizard. Mock data only
// at this stage; the wizard itself will be ported in a follow-up.
export default class StartGuidedRfq extends LightningElement {
  // Provided by Salesforce when the LWC runs inside a Quick Action
  // on a record page (target: lightning__RecordAction).
  @api recordId;

  @wire(getRecord, {
    recordId: '$recordId',
    fields: [ACCOUNT_NAME, ACCOUNT_OWNER, ACCOUNT_INDUSTRY]
  })
  account;

  // ── Derived view model ───────────────────────────────────
  get accountName() {
    return getFieldValue(this.account.data, ACCOUNT_NAME) || '—';
  }

  get accountOwner() {
    return getFieldValue(this.account.data, ACCOUNT_OWNER) || '—';
  }

  get accountIndustry() {
    return getFieldValue(this.account.data, ACCOUNT_INDUSTRY) || 'Not specified';
  }

  get suggestedLob() {
    return 'Property & Casualty';
  }

  get suggestedLocs() {
    return /household/i.test(this.accountName)
      ? ['Personal Auto', 'Homeowners']
      : ['Commercial Auto', 'General Liability'];
  }

  get suggestedLocLabel() {
    return this.suggestedLocs.join(' + ');
  }

  get loaded() {
    return !!this.account.data;
  }

  // ── Handlers ─────────────────────────────────────────────
  handleStart() {
    this.dispatchEvent(
      new ShowToastEvent({
        title: 'Guided RFQ launched',
        message:
          `RFQ started for ${this.accountName} · ${this.suggestedLob} (${this.suggestedLocLabel}). ` +
          'Pre-filled from Salesforce Account.',
        variant: 'success',
        mode: 'sticky'
      })
    );
    this.dispatchEvent(new CloseActionScreenEvent());
  }

  handleCancel() {
    this.dispatchEvent(new CloseActionScreenEvent());
  }
}
