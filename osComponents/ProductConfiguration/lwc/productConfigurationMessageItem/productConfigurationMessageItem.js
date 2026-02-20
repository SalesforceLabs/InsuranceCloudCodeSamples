/*
 * Copyright 2025 salesforce.com, inc.
 * All Rights Reserved
 * Company Confidential
 */

import { LightningElement, api } from 'lwc';
import { publish, createMessageContext } from 'lightning/messageService';
import MessageChannel from '@salesforce/messageChannel/lightning__productConfigurator_notification';

export default class MessageItem extends LightningElement {
    // ================================================================================
    // PUBLIC PROPERTIES
    // ================================================================================
    /**
    * Variable to store message information. Properties required in message
    *  1. message (text content)
    *  2. type (info, error, warning)
     *  3. key (optional unique identifier)
     *  4. recordId (optional - Salesforce record ID for navigation)
     */
    @api message;

    // ================================================================================
    // ACCESSOR METHODS
    // ================================================================================

    get title() {
        return this.message.message || this.message.text || '';
    }

    get isInfoMessage() {
        return this.message.type === 'info';
    }

    get isErrorMessage() {
        return this.message.type === 'error';
    }

    get isWarningMessage() {
        return this.message.type === 'warning';
    }

    get hasNavigationPath() {
        return !!this.message.recordId;
    }

    // ================================================================================
    // EVENT HANDLERS
    // ================================================================================

    handleView(event) {
        // Prevent default button behavior
        event.preventDefault();
        event.stopPropagation();
        // Publish navigation event via Lightning Message Service
        publish(createMessageContext(), MessageChannel, {
            action: 'navigate',
            type: 'jump',
            recordId: this.message.recordId
        });

        // Also dispatch a custom event for parent components that don't use LMS
        const navigateEvent = new CustomEvent('navigate', {
            detail: {
                recordId: this.message.recordId,
                message: this.message
            },
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(navigateEvent);
    }
}