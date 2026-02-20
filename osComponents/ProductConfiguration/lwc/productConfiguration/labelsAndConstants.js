/*
 * Copyright 2025 salesforce.com, inc.
 * All Rights Reserved
 * Company Confidential
 */

// Import Custom Labels
import MESSAGES from '@salesforce/label/c.PRODUCT_CONFIG_MESSAGES';
import COVERAGES from '@salesforce/label/c.PRODUCT_CONFIG_COVERAGES';
import LOADING from '@salesforce/label/c.PRODUCT_CONFIG_LOADING';
import PRODUCT_CONFIGURATION from '@salesforce/label/c.PRODUCT_CONFIG_PRODUCT_CONFIGURATION';
import TOGGLE_MESSAGES from '@salesforce/label/c.PRODUCT_CONFIG_TOGGLE_MESSAGES';
import ERROR from '@salesforce/label/c.PRODUCT_CONFIG_ERROR';
import DETAILS from '@salesforce/label/c.PRODUCT_CONFIG_DETAILS';
import SELECT_ITEM_MESSAGE from '@salesforce/label/c.PRODUCT_CONFIG_SELECT_ITEM_MESSAGE';
import PRICE_SUMMARY from '@salesforce/label/c.PRODUCT_CONFIG_PRICE_SUMMARY';
import INSTANT_PRICING from '@salesforce/label/c.PRODUCT_CONFIG_INSTANT_PRICING';
import UPDATE_PRICES from '@salesforce/label/c.PRODUCT_CONFIG_UPDATE_PRICES';
import TOTAL_PREMIUM from '@salesforce/label/c.PRODUCT_CONFIG_TOTAL_PREMIUM';
import TAXES_FEES_SURCHARGE from '@salesforce/label/c.PRODUCT_CONFIG_TAXES_FEES_SURCHARGE';
import PREMIUM from '@salesforce/label/c.PRODUCT_CONFIG_PREMIUM';
import ERROR_OCCURRED from '@salesforce/label/c.PRODUCT_CONFIG_ERROR_OCCURRED';
import INVALID_DATA_RECEIVED from '@salesforce/label/c.PRODUCT_CONFIG_INVALID_DATA_RECEIVED';
import SELECT_COVERAGE_FIRST from '@salesforce/label/c.PRODUCT_CONFIG_SELECT_COVERAGE_FIRST';
import DELETE from '@salesforce/label/c.PRODUCT_CONFIG_DELETE';
import CONFIRM_DELETE from '@salesforce/label/c.PRODUCT_CONFIG_CONFIRM_DELETE';
import DELETE_CONFIRMATION_MESSAGE from '@salesforce/label/c.PRODUCT_CONFIG_DELETE_CONFIRMATION_MESSAGE';
import CANCEL from '@salesforce/label/c.PRODUCT_CONFIG_CANCEL';
import CONFIRM from '@salesforce/label/c.PRODUCT_CONFIG_CONFIRM';
import REQUIRED_ATTRIBUTES_MSG from '@salesforce/label/c.PRODUCT_CONFIG_REQUIRED_ATTRIBUTES_MSG';
import NO_ATTRIBUTES_MSG from '@salesforce/label/c.PRODUCT_CONFIG_NO_ATTRIBUTES_MSG';
import MULTI_VALUE_DECODER_MESSAGE from '@salesforce/label/c.PRODUCT_CONFIG_MULTI_VALUE_DECODER_MESSAGE';
import NEXT from '@salesforce/label/c.PRODUCT_CONFIG_NEXT';
import PREVIOUS from '@salesforce/label/c.PRODUCT_CONFIG_PREVIOUS';
import TAX_AMOUNT from '@salesforce/label/c.PRODUCT_CONFIG_TAX_AMOUNT';

// Product Configuration Labels
export const LABELS = {
    MESSAGES,
    COVERAGES,
    LOADING,
    PRODUCT_CONFIGURATION,
    TOGGLE_MESSAGES,
    ERROR,
    DETAILS,
    SELECT_ITEM_MESSAGE,
    PRICE_SUMMARY,
    INSTANT_PRICING,
    UPDATE_PRICES,
    TOTAL_PREMIUM,
    TAXES_FEES_SURCHARGE,
    PREMIUM,
    ERROR_OCCURRED,
    INVALID_DATA_RECEIVED,
    SELECT_COVERAGE_FIRST,
    DELETE,
    CONFIRM_DELETE,
    DELETE_CONFIRMATION_MESSAGE,
    CANCEL,
    CONFIRM,
    REQUIRED_ATTRIBUTES_MSG,
    NO_ATTRIBUTES_MSG,
    MULTI_VALUE_DECODER_MESSAGE,
    NEXT,
    PREVIOUS,
    TAX_AMOUNT
};

export const CONSTANTS = {
    // Component constants
    REFERENCE_FIELD_ID: 'id',
    EVENT_NAMES: {
        VIEW: 'productConfiguration.view',
        ATTRIBUTE_CHANGE: 'productConfiguration.attributechange',
        COVERAGE_SELECTION_CHANGE: 'productConfiguration.coverageselectionchange',
        UPDATE_PRICES: 'productConfiguration.updateprices',
        NODE_SELECT: 'productConfiguration.nodeselect',
        DELETE_BUTTON_CLICK: 'productConfiguration.deletebuttonclick',
        DELETE_CANCEL: 'productConfiguration.deletecancel',
        DELETE_CONFIRM: 'productConfiguration.deleteconfirm',
        ERROR: 'productConfiguration.error',
        STI_DELETE: 'productConfiguration.stidelete'
    }
};