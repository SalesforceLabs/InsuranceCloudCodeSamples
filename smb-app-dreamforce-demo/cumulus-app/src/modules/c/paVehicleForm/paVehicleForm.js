import { LightningElement, api } from 'lwc';

// ─────────────────────────────────────────────────────────────────────────────
// c-pa-vehicle-form - manual-entry roster (Step 1, "None / Manual Entry").
// Renders one editable SLDS card per vehicle with the fields from the design
// kit (Car Name, Mileage, Model, Make, VIN, Registration State, Condition,
// Value). Field edits bubble up as `vehiclefieldchange { id, key, value }`
// and the footer button fires `addvehicle`. c-rfq-workspace owns the state.
// ─────────────────────────────────────────────────────────────────────────────

const STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine',
  'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia',
  'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];
const CONDITIONS = ['New', 'Used', 'Certified Pre-Owned', 'Salvage / Rebuilt'];
const VALUES = [
  'Under $10,000',
  '$10,000 – $25,000',
  '$25,000 – $50,000',
  '$50,000 – $100,000',
  'Over $100,000'
];

function selectOptions(values, current) {
  return values.map((v) => ({ value: v, label: v, selected: v === current }));
}

export default class PaVehicleForm extends LightningElement {
  @api vehicles;

  get vehicleCards() {
    const list = Array.isArray(this.vehicles) ? this.vehicles : [];
    return list.map((veh, i) => ({
      id: veh.id,
      index: i + 1,
      carName: veh.carName || '',
      carMileage: veh.carMileage || '',
      carModel: veh.carModel || '',
      carMake: veh.carMake || '',
      vin: veh.vin || '',
      registrationState: veh.registrationState || '',
      condition: veh.condition || '',
      value: veh.value || '',
      stateOptions: selectOptions(STATES, veh.registrationState),
      conditionOptions: selectOptions(CONDITIONS, veh.condition),
      valueOptions: selectOptions(VALUES, veh.value),
      ids: {
        carName: `${veh.id}-carName`,
        carMileage: `${veh.id}-carMileage`,
        carModel: `${veh.id}-carModel`,
        carMake: `${veh.id}-carMake`,
        vin: `${veh.id}-vin`,
        registrationState: `${veh.id}-registrationState`,
        condition: `${veh.id}-condition`,
        value: `${veh.id}-value`
      }
    }));
  }

  handleFieldChange(event) {
    const { id, key } = event.target.dataset;
    if (!id || !key) return;
    this.dispatchEvent(
      new CustomEvent('vehiclefieldchange', {
        detail: { id, key, value: event.target.value },
        bubbles: true,
        composed: true
      })
    );
  }

  // c-picklist change handler - reads `event.detail.value` and uses
  // `event.currentTarget.dataset` (host element carries the data attrs).
  handlePicklistChange(event) {
    const { id, key } = event.currentTarget.dataset;
    if (!id || !key) return;
    this.dispatchEvent(
      new CustomEvent('vehiclefieldchange', {
        detail: { id, key, value: event.detail.value },
        bubbles: true,
        composed: true
      })
    );
  }

  handleAdd() {
    this.dispatchEvent(
      new CustomEvent('addvehicle', { bubbles: true, composed: true })
    );
  }
}
