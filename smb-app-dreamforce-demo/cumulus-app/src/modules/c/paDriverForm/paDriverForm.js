import { LightningElement, api } from 'lwc';

// ─────────────────────────────────────────────────────────────────────────────
// c-pa-driver-form - manual-entry driver roster (Step 1, "None / Manual Entry").
// One editable SLDS card per driver with the design-kit fields (First/Last
// Name, DOB, Gender, License Number, Contact, Email, ZIP). Edits bubble up as
// `driverfieldchange { id, key, value }`; the footer fires `adddriver`.
// ─────────────────────────────────────────────────────────────────────────────

const GENDERS = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];
const ZIPS = [
  '33602 - Tampa, FL',
  '33606 - Tampa, FL',
  '33611 - Tampa, FL',
  '33629 - Tampa, FL',
  '33647 - Tampa, FL'
];

function selectOptions(values, current) {
  return values.map((v) => ({ value: v, label: v, selected: v === current }));
}

export default class PaDriverForm extends LightningElement {
  @api drivers;

  get driverCards() {
    const list = Array.isArray(this.drivers) ? this.drivers : [];
    return list.map((d, i) => ({
      id: d.id,
      index: i + 1,
      firstName: d.firstName || '',
      lastName: d.lastName || '',
      dob: d.dob || '',
      licenseNumber: d.licenseNumber || '',
      contact: d.contact || '',
      email: d.email || '',
      gender: d.gender || '',
      zip: d.zip || '',
      genderOptions: selectOptions(GENDERS, d.gender),
      zipOptions: selectOptions(ZIPS, d.zip),
      ids: {
        firstName: `${d.id}-firstName`,
        lastName: `${d.id}-lastName`,
        dob: `${d.id}-dob`,
        gender: `${d.id}-gender`,
        licenseNumber: `${d.id}-licenseNumber`,
        contact: `${d.id}-contact`,
        email: `${d.id}-email`,
        zip: `${d.id}-zip`
      }
    }));
  }

  // c-picklist change handler - reads `event.detail.value` and uses
  // `event.currentTarget.dataset` (host element carries the data attrs).
  handlePicklistChange(event) {
    const { id, key } = event.currentTarget.dataset;
    if (!id || !key) return;
    this.dispatchEvent(
      new CustomEvent('driverfieldchange', {
        detail: { id, key, value: event.detail.value },
        bubbles: true,
        composed: true
      })
    );
  }

  handleFieldChange(event) {
    const { id, key } = event.currentTarget.dataset;
    if (!id || !key) return;
    const value =
      event.detail && 'value' in event.detail
        ? event.detail.value
        : event.target.value;
    this.dispatchEvent(
      new CustomEvent('driverfieldchange', {
        detail: { id, key, value },
        bubbles: true,
        composed: true
      })
    );
  }

  handleAdd() {
    this.dispatchEvent(
      new CustomEvent('adddriver', { bubbles: true, composed: true })
    );
  }
}
