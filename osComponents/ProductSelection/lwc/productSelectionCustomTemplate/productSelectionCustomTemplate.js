
import { LightningElement, api, wire } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import { FIELD_TYPES } from './constants';

export default class ProductSelectionCustomTemplate extends LightningElement {

    @api value;
    @api type;
    @api currencyIsoCode;
    @api additionalFields;

    referenceRecord;
    _displayName = '';

    @wire(getRecord, {
        recordId: '$value',
        layoutTypes: ['Full'], 
        modes: ['View']
    })
    wiredRecord({ data }) {
        if (data) {
            this.referenceRecord = data?.fields?.Name?.value;
        }
    }

    get isCurrency() {
        return this.type === FIELD_TYPES.CURRENCY;
    }

    get isPercentage() {
        return this.type === FIELD_TYPES.PERCENT;
    }

    get isDate() {
        return this.type === FIELD_TYPES.DATE;
    }

    get isDateTime() {
        return this.type === FIELD_TYPES.DATETIME;
    }

    get isLookup() {
        return this.type === FIELD_TYPES.LOOKUP;
    }

    get isText() {
        return !this.isCurrency && !this.isPercentage && !this.isDate && !this.isDateTime;
    }

    get displayValue() {
        if (this.isLookup) {
            return this.referenceRecord;
        }

        return this.value !== undefined && this.value !== null ? this.value : '';
    }

    get displayName() {
        return this._displayName;
    }
}