import { LightningElement, track, api } from 'lwc';
import { buildTreeFromContextJSON, findSelectedTreeNode, findTreeNodeById, findInstanceKeysForNode } from './dataManager';
import LOCALE from '@salesforce/i18n/locale';
import CURRENCY from '@salesforce/i18n/currency';
import postRatingFromLwc from '@salesforce/apex/InsuranceRatingApexService.postRatingFromLwc';
import patchRatingFromLwc from '@salesforce/apex/InsuranceRatingApexService.patchRatingFromLwc';
import { OmniscriptBaseMixin } from 'c/omniscriptBaseMixin';
import { LABELS } from './labelsAndConstants';

const DELIMITERS = ['/', '#'];

export default class ProdCfg extends OmniscriptBaseMixin(LightningElement) {
    @track treeItems = [];
    @track selectedNode;
    @track error;
    @track configMessages = [];
    showDeleteConfirmation = false;
    @track validationMsg = ''; // Validation message for required attributes
    isLoading = false;
    instantPricing = true; // Toggle for executePricing in PATCH calls
    executeConfigurationRules;
    isMessagesExpanded = true;
    _internalContextId = null; // Internal property to store contextId from POST/PATCH response or saved state
    attributeOriginalValues = new Map(); // Map to store original attribute values during editing
    parentNodeNameBeforeDeletion = null; // Store parent node name before deletion for selection
    _navigationDirection = null; // Track navigation direction: 'next' or 'previous'


    // Input properties
    @api additionalFields = {};
    @api ratingInputs = [];
    @api ratingOptions = {};
    @api transactionType;
    @api contextId = null; // Input property for PATCH-first scenario (from parent component)
    @api clearStateOnPrev; // Use property if no prodSel LWC configured that clears state on update of plan

    constructor() {
        super();
    }

    connectedCallback() {
        const stateData = this.omniGetSaveState();
        if (stateData && stateData.savedProduct) {
            this.parseSavedState(stateData);
        } else {
            this.loadData();
        }
    }

    /**
     * OS - Set UI to previous saved state
     * @param {Object} stateData
     */
    parseSavedState(stateData) {
        this.treeItems = stateData.savedProduct;
        const name = this.treeItems?.[0]?.name;
        this.handleSelect({ detail: { name } });
        this._internalContextId = stateData?.contextId;
        this._savedPricingSummary = stateData?.pricingSummary;
        this._savedCurrencyCode = stateData?.currencyCode;
        this.isLoading = false;
    }

    async loadData() {
        this.isLoading = true;
        this.error = null;
        try {
            // Initialize internal contextId from input contextId if provided, otherwise keep existing internal value
            this._internalContextId = this.contextId || this._internalContextId;

            let result;

            // If contextId is provided, use PATCH for initial load
            if (this._internalContextId) {
                const request = {
                    contextId: this._internalContextId,
                    ratingOptions: this.formatRatingOptions(),
                    additionalFields: this.formatAdditionalFields()
                };
                result = await patchRatingFromLwc({ patchPayloadJson: JSON.stringify(request) });

            } else {
                // Otherwise, use POST with ratingInputs
                const ratingInputArr = JSON.parse(JSON.stringify(this.ratingInputs));
                const request = {
                    ratingInputs: ratingInputArr,
                    ratingOptions: this.formatRatingOptions(),
                    additionalFields: this.formatAdditionalFields(),
                    transactionType: this.transactionType
                };
                result = await postRatingFromLwc({ postPayloadJson: JSON.stringify(request) });
            }

            if (result && result.success) {
                this.processApiResponse(result);
            } else {
                console.error('Rating Failed:', result?.errorMessage);
                if (result?.actionErrors) {
                    console.error('Detailed Errors:', result.actionErrors);
                }
                throw new Error(result?.errorMessage || 'Unknown Error');
            }   
        } catch (error) {
            const errorMessage = error?.body ? JSON.stringify(error.body, null, 2) : error?.message || LABELS.ERROR_OCCURRED;
            this.error = errorMessage;
        } finally {
            this.isLoading = false;
        }
    }

    formatAdditionalFields() {
        const additionalFields = { ...this.additionalFields };
        if (!additionalFields.CurrencyIsoCode__std) {
            additionalFields.CurrencyIsoCode__std = CURRENCY;
        }
        return additionalFields;
    }

    formatRatingOptions() {
        const ratingOptions = { ...this.ratingOptions };
        ratingOptions.returnContextJson = true; // RATING IA TAKES CAMEL CASE (returnContextJson instead of returnContextJSON)
        ratingOptions.returnProductDetails = true;
        ratingOptions.returnRatingResults = true;  // REQUIRED FOR RATING IA

        if (ratingOptions.executePricing === null || ratingOptions.executePricing === undefined) {
            ratingOptions.executePricing = true;
        }
        if (ratingOptions.executeConfigurationRules === null || ratingOptions.executeConfigurationRules === undefined) {
            ratingOptions.executeConfigurationRules = true;
        }

        return ratingOptions;
    }

    processApiResponse(response) {
        response = response.ratingData;
        if (!response) {
            this.error = LABELS.INVALID_DATA_RECEIVED;
            return;
        }

        // Check for errors in response first
        if (response.errors && Array.isArray(response.errors) && response.errors.length > 0) {
            const errorMessage = response.errors[0].message || LABELS.ERROR_OCCURRED;
            this.error = errorMessage;
            return;
        }

        // Then check for valid data structure
        if (!response.productRatingOutput.contextJSON || !response.productRatingOutput.productDetails) {
            this.error = LABELS.INVALID_DATA_RECEIVED;
            return;
        }

        // Clear any previous errors
        this.error = null;

        // Store contextId for PATCH requests
        this._internalContextId = response.contextId;

        // Update omniscript data JSON with contextId
        this.omniUpdateDataJson(this.getOmniDataOutput());

        // Process configuration messages
        this.processConfigMessages(response.productRatingOutput.configMessages);

        // Store the raw response for pricing calculations
        this.apiResponse = response;

        // Clear saved pricing and currency values so getters compute fresh values from new apiResponse
        this._savedPricingSummary = null;
        this._savedCurrencyCode = null;

        // Process uiTreatments to identify disabled/hidden components and attributes
        this.uiTreatments = this.processUiTreatments(response.productRatingOutput.uiTreatments);

        // Sync selectedNode changes back to treeItems before rebuilding
        this.syncSelectedNodeToTreeItems();

        // Preserve current selection and expansion state before rebuilding tree
        const previouslySelectedNodeName = this.selectedNode?.name;
        const expandedNodeNames = this.getExpandedNodeNames(this.treeItems);

        const builtData = buildTreeFromContextJSON(response.productRatingOutput.contextJSON, response.productRatingOutput.productDetails);
        const preparedData = this.prepareDataForUI(builtData);

        // Restore expansion states or default expand first nodes
        if (preparedData.length > 0) {
            if (expandedNodeNames.size > 0) {
                // Restore previous expansion state
                this.restoreExpansionState(preparedData, expandedNodeNames);
            } else {
                // Default behavior: expand first node and its children
                const firstNode = preparedData[0];
                firstNode.expanded = true;
                if (firstNode.items) {
                    firstNode.items.forEach(child => {
                        child.expanded = true;
                    });
                }
            }

            // Re-assign to trigger the tree render with expanded nodes
            this.treeItems = [...preparedData];

            // Determine which node to select after tree rebuild
            let nodeNameToSelect;

            // Priority 1: If we have a parent node from a deletion, try to select it
            if (this.parentNodeNameBeforeDeletion) {
                const parentNodeExists = findSelectedTreeNode(preparedData, this.parentNodeNameBeforeDeletion);
                if (parentNodeExists) {
                    nodeNameToSelect = this.parentNodeNameBeforeDeletion;
                }
                // Clear the stored parent name after use
                this.parentNodeNameBeforeDeletion = null;
            }

            // Priority 2: If previously selected node still exists, select it
            if (!nodeNameToSelect && previouslySelectedNodeName) {
                const previousNodeStillExists = findSelectedTreeNode(preparedData, previouslySelectedNodeName);
                if (previousNodeStillExists) {
                    nodeNameToSelect = previouslySelectedNodeName;
                }
            }

            // Priority 3: Default to first node
            if (!nodeNameToSelect) {
                nodeNameToSelect = preparedData[0].name;
            }

            this.handleSelect({ detail: { name: nodeNameToSelect } });
        }

        // Validate required attributes after processing response
        const isValid = this.validateRequiredAttributes();
        this.omniValidate(isValid);
    }

    getExpandedNodeNames(treeItems) {
        const expandedNames = new Set();
        if (!treeItems || treeItems.length === 0) {
            return expandedNames;
        }
        const traverse = (items) => {
            if (!items) {
                return;
            }
            items.forEach(item => {
                if (item.expanded) {
                    expandedNames.add(item.name);
                }
                if (item.items && item.items.length > 0) {
                    traverse(item.items);
                }
            });
        };
        traverse(treeItems);
        return expandedNames;
    }

    restoreExpansionState(treeItems, expandedNames) {
        const traverse = (items) => {
            if (!items) {
                return;
            }
            items.forEach(item => {
                if (expandedNames.has(item.name)) {
                    item.expanded = true;
                }
                if (item.items && item.items.length > 0) {
                    traverse(item.items);
                }
            });
        };
        traverse(treeItems);
    }

    prepareDataForUI(data) {
        return data.map(node => {
            const preparedNode = { ...node };
            if (node.coverages) {
                // Filter out hidden coverages and process the rest
                preparedNode.coverages = node.coverages
                    .filter(coverage => !this.isCoverageHidden(node.id, coverage.prcId))
                    .map(coverage => {
                        const preparedCoverage = { ...coverage };

                        // Check if this coverage should be disabled based on uiTreatments
                        const isDisabled = this.isCoverageDisabled(node.id, coverage.prcId);
                        preparedCoverage.isDisabled = isDisabled;
                        preparedCoverage.containerClass = isDisabled
                            ? 'slds-box slds-box_x-small slds-m-bottom_small slds-is-disabled'
                            : 'slds-box slds-box_x-small slds-m-bottom_small';

                        // Pass raw price and formatted tax and fee for coverage
                        const currency = this.getCurrencyForPriceSummary();
                        preparedCoverage.price = coverage.netUnitPrice;

                        // Build tooltip content with tax and fee information
                        const taxInfo = (coverage.proratedQLITaxAmount !== null && coverage.proratedQLITaxAmount !== undefined)
                            ?  `${LABELS.TAX_AMOUNT} ` + this.formatCurrency(coverage.proratedQLITaxAmount, currency)
                            : null;
                        const feeInfo = (coverage.proratedQLIFeeAmount !== null && coverage.proratedQLIFeeAmount !== undefined)
                            ?  `${LABELS.FEE_AMOUNT} ` + this.formatCurrency(coverage.proratedQLIFeeAmount, currency)
                            : null;

                        // Combine tax and fee info for tooltip
                        if (taxInfo && feeInfo) {
                            preparedCoverage.tax = `${taxInfo} | ${feeInfo}`;
                        } else if (taxInfo) {
                            preparedCoverage.tax = taxInfo;
                        } else if (feeInfo) {
                            preparedCoverage.tax = feeInfo;
                        } else {
                            preparedCoverage.tax = null;
                        }

                        if (coverage.attributes) {
                            // Use coverage's stiId for attribute treatments (not parent node's id)
                            const coverageStiId = coverage.stiId || node.id;

                            // Filter out hidden attributes and process the rest
                            preparedCoverage.attributes = coverage.attributes
                                .filter(attr => !this.isAttributeHidden(coverageStiId, attr.id))
                                .map(attr => {
                                    const isAttrDisabled = this.isAttributeDisabled(coverageStiId, attr.id);
                                    const controlType = this.attributeInputType(attr.dataType, attr.displayTypeOverride);
                                    const preparedAttr = {
                                        ...attr,
                                        controlType,
                                        isPicklist: attr.dataType === 'PICKLIST',
                                        inputType: this.attributeInputType(attr.dataType, attr.displayTypeOverride),
                                        isReadOnly: attr.isReadOnly || isDisabled || isAttrDisabled,
                                        isDisabled: isDisabled || isAttrDisabled,
                                        // Boolean flags for template rendering
                                        isCombobox: controlType === 'combobox',
                                        isRadio: controlType === 'radio',
                                        isSlider: controlType === 'slider',
                                        isToggle: controlType === 'toggle',
                                        isMultivalue: controlType === 'multivalue',
                                        isLookup: attr.dataType === 'lookup',
                                        isStandardInput: !['combobox', 'radio', 'slider', 'toggle', 'multivalue', 'lookup'].includes(controlType),
                                        // Toggle-specific properties
                                        toggleVariant: attr.value ? 'success' : 'default',
                                        toggleLabel: attr.value ? 'On' : 'Off',
                                        // Formatting properties for number inputs
                                        formatter: this._getAttributeFormatter(attr.dataType),
                                        step: this._getAttributeStep(attr.dataType),
                                        // Lookup-specific properties
                                        lookupObjectApiName: attr.additionalFields?.referenceObject || null,
                                         // Decoder value for multivalue display
                                        decoderValue: controlType === 'multivalue' ? this.getDecoderValue(attr) : null
                                    };

                                    // Filter picklist options to hide specific values
                                    if (preparedAttr.isPicklist && preparedAttr.options) {
                                        const hiddenValues = this.getHiddenPicklistValues(coverageStiId, attr.id);
                                        if (hiddenValues.size > 0) {
                                            preparedAttr.options = preparedAttr.options.filter(
                                                option => !hiddenValues.has(option.id)
                                            );
                                        }
                                    }

                                    return preparedAttr;
                                });
                        }
                        return preparedCoverage;
                    });
            }
            if (node.items && node.items.length > 0) {
                preparedNode.items = this.prepareDataForUI(node.items);
            }
            return preparedNode;
        });
    }

    isCoverageDisabled(stiId, prcId) {
        if (!this.uiTreatments || !stiId || !prcId) {
            return false;
        }
        const disabledPrcIds = this.uiTreatments.disabledComponents.get(stiId);
        return disabledPrcIds ? disabledPrcIds.has(prcId) : false;
    }

    isCoverageHidden(stiId, prcId) {
        if (!this.uiTreatments || !stiId || !prcId) {
            return false;
        }
        const hiddenPrcIds = this.uiTreatments.hiddenComponents.get(stiId);
        return hiddenPrcIds ? hiddenPrcIds.has(prcId) : false;
    }

    isAttributeDisabled(stiId, attributeId) {
        if (!this.uiTreatments || !stiId || !attributeId) {
            return false;
        }
        const disabledAttrIds = this.uiTreatments.disabledAttributes.get(stiId);
        return disabledAttrIds ? disabledAttrIds.has(attributeId) : false;
    }

    isAttributeHidden(stiId, attributeId) {
        if (!this.uiTreatments || !stiId || !attributeId) {
            return false;
        }
        const hiddenAttrIds = this.uiTreatments.hiddenAttributes.get(stiId);
        return hiddenAttrIds ? hiddenAttrIds.has(attributeId) : false;
    }

    getHiddenPicklistValues(stiId, attributeId) {
        if (!this.uiTreatments || !stiId || !attributeId) {
            return new Set();
        }
        const stiMap = this.uiTreatments.hiddenPicklistValues.get(stiId);
        if (!stiMap) {
            return new Set();
        }
        return stiMap.get(attributeId) || new Set();
    }

    handleSelect(event) {
        const selectedName = event.detail.name;

        // Ensure we're searching through the current treeItems
        if (!this.treeItems || this.treeItems.length === 0) {
            return;
        }

        const foundNode = findSelectedTreeNode(this.treeItems, selectedName);

        if (foundNode) {
            // Deep clone the node to ensure LWC detects the change and re-renders.
            // This is the key fix for the reactivity issue.
            this.selectedNode = JSON.parse(JSON.stringify(foundNode));
        } else {
            // If node not found (e.g., after deletion), select the first available node
            this.selectedNode = JSON.parse(JSON.stringify(this.treeItems[0]));
        }
    }

    async handleCoverageSelectionChange(event) {
        const coverageKey = event.target.dataset.coverageKey;
        const isSelected = event.target.checked;
        const coverage = this.selectedNode.coverages.find(c => c.key === coverageKey);

        if (!coverage) {
            return;
        }

        // Update local state
        coverage.isSelected = isSelected;
        this.selectedNode = { ...this.selectedNode };

        // Only call PATCH if contextId exists
        if (!this._internalContextId) {
            this.error = LABELS.ERROR_OCCURRED;
            // Revert checkbox state since change cannot be persisted
            coverage.isSelected = !isSelected;
            this.selectedNode = { ...this.selectedNode };
            return;
        }

        // Parse instanceKeys
        const instanceKeysArray = coverage.instanceKeys || [];
        const productCode = coverage.productCode;

        let patchPayload;

        if (isSelected) {
            // Coverage is being added - use addedNodes
            // Collect all attribute values for this coverage using attributeCode
            const attributes = {};
            if (coverage.attributes) {
                coverage.attributes.forEach(attr => {
                    if (attr.value !== null && attr.value !== undefined && attr.value !== '') {
                        attributes[attr.code] = attr.value;
                    }
                });
            }

            patchPayload = {
                contextId: this._internalContextId,
                ratingOptions: {
                    executePricing: this.instantPricing,
                    executeConfigurationRules: true,
                    returnContextJson: true,
                    returnProductDetails: true,
                    returnRatingResults: true
                },
                addedNodes: [
                    {
                        instanceKeys: instanceKeysArray,
                        productCode,
                        attributes
                    }
                ]
            };

        } else {
            // Coverage is being removed - use deletedNodes
            patchPayload = {
                contextId: this._internalContextId,
                ratingOptions: {
                    executePricing: this.instantPricing,
                    executeConfigurationRules: this.executeConfigurationRules,
                    returnContextJson: true,
                    returnProductDetails: true,
                    returnRatingResults: true
                },
                deletedNodes: [
                    {
                        instanceKeys: instanceKeysArray,
                        productCode
                    }
                ]
            };
        }

        this.isLoading = true;
        this.error = null;

        try {
            const result = await patchRatingFromLwc({ patchPayloadJson: JSON.stringify(patchPayload) });
           
            if (result && result.success) {
                this.processApiResponse(result);
                const isValid = this.validateRequiredAttributes();
                this.omniValidate(isValid);
            } else {
                console.error('Coverage Update Failed:', result?.errorMessage);
                
                if (result?.actionErrors) {
                    console.error('Detailed Errors:', result.actionErrors);
                }
                throw new Error(result?.errorMessage || 'Error saving selection');
            }
          
        } catch (error) {
            this.error = error?.body ? JSON.stringify(error.body, null, 2) : error?.message || LABELS.ERROR_OCCURRED;

            // Revert the UI state on error
            coverage.isSelected = !isSelected;
            this.selectedNode = { ...this.selectedNode };
        } finally {
            this.isLoading = false;
        }
    }

    handleInstantPricingToggle(event) {
        this.instantPricing = event.target.checked;
    }

    async handleUpdatePrices() {
        if (!this._internalContextId) {
            return;
        }

        // Build the PATCH payload for updating prices
        const patchPayload = {
            contextId: this._internalContextId,
            ratingOptions: {
                executePricing: true,
                executeConfigurationRules: this.executeConfigurationRules,
                returnContextJson: true,
                returnProductDetails: true,
                returnRatingResults: true
            }
        };

        this.isLoading = true;
        this.error = null;

        try {
            const result = await patchRatingFromLwc({ patchPayloadJson: JSON.stringify(patchPayload) });
            
            if (result && result.success) {
                this.processApiResponse(result);
            } else {
                console.error('Update Failed:', result?.errorMessage);
                if (result?.actionErrors) {
                    console.error('Detailed Errors:', result.actionErrors);
                }
                throw new Error(result?.errorMessage || 'Error saving selection');
            }
        } catch (error) {
            const errorMessage = error?.body ? JSON.stringify(error.body, null, 2) : error?.message || LABELS.ERROR_OCCURRED;
            this.error = errorMessage;
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Handler for custom Previous button
     * Calls OmniScript's previous step method (which tracks direction)
     */
    handleCustomPrevious() {
        this.omniPrevStep();
    }

    /**
     * Handler for custom Next button
     * Validates required fields before navigating to next step
     */
    handleCustomNext() {
        // Validate required attributes before proceeding
        const isValid = this.validateRequiredAttributes();

        if (!isValid) {
            // Scroll to top to show validation message
            const card = this.template.querySelector('lightning-card');
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            return;
        }
        // Clear validation message if it was previously set
        this.validationMsg = '';

        // Proceed to next step
        this.omniNextStep();
    }

    handleDeleteButtonClick() {
        // Show confirmation modal
        this.showDeleteConfirmation = true;
    }

    handleCancelDelete() {
        // Close modal and navigate to home (first root node)
        this.showDeleteConfirmation = false;
        if (this.treeItems.length > 0) {
            const firstNode = this.treeItems[0];
            this.expandAndSelectNode(firstNode.name);
        }
    }

    async handleConfirmDelete() {
        // Close modal and proceed with delete
        this.showDeleteConfirmation = false;

        if (!this._internalContextId || !this.selectedNode) {
            return;
        }

        // Find parent node before deletion so we can select it after deletion
        const parentNode = this.findParentNode(this.treeItems, this.selectedNode.name);
        this.parentNodeNameBeforeDeletion = parentNode?.name || null;

        // Find the instance keys path for this node
        const instanceKeys = findInstanceKeysForNode(this.treeItems, this.selectedNode.name);

        if (!instanceKeys || instanceKeys.length === 0) {
            this.error = LABELS.ERROR_OCCURRED;
            return;
        }

        const productCode = this.selectedNode.productCode;

        // Build the PATCH payload with deletedNodes
        const patchPayload = {
            contextId: this._internalContextId,
            ratingOptions: {
                executePricing: this.instantPricing,
                executeConfigurationRules: this.executeConfigurationRules,
                returnContextJson: true,
                returnProductDetails: true,
                returnRatingResults: true
            },
            deletedNodes: [
                {
                    instanceKeys,
                    productCode
                }
            ]
        };

        this.isLoading = true;
        this.error = null;

        try {
            const result = await patchRatingFromLwc({ patchPayloadJson: JSON.stringify(patchPayload) });
            if (result && result.success) {
                this.processApiResponse(result);
            } else {
                console.error('Delete Failed:', result?.errorMessage);
                
                if (result?.actionErrors) {
                    console.error('Detailed Errors:', result.actionErrors);
                }
                throw new Error(result?.errorMessage || 'Error saving selection');
            }

        } catch (error) {
            const errorMessage = error?.body ? JSON.stringify(error.body, null, 2) : error?.message || LABELS.ERROR_OCCURRED;
            this.error = errorMessage;
        } finally {
            this.isLoading = false;
        }
    }

    handleAttributeChange(event) {
        const coverageKey = event.target.dataset.coverageKey;
        const attrDevName = event.target.dataset.attrDevName;
        const controlType = event.target.dataset.controlType;

        // For toggle/checkbox controls, use checked instead of value
        const newValue = (controlType === 'toggle' || controlType === 'checkbox')
            ? event.target.checked
            : event.target.value;

        const coverage = this.selectedNode.coverages.find(c => c.key === coverageKey);
        if (coverage?.attributes) {
            const attribute = coverage.attributes.find(a => a.developerName === attrDevName);
            if (attribute) {
                // Store original value before updating (for comparison in handleAttributeBlur)
                // Use stiId or instanceKeysString to ensure unique key across all coverage instances
                const key = `${coverage.stiId || coverage.instanceKeysString}_${attribute.code}`;
                if (!this.attributeOriginalValues.has(key)) {
                    this.attributeOriginalValues.set(key, attribute.value);
                }
                attribute.value = newValue;
                this.selectedNode = { ...this.selectedNode };

                // For controls that don't have blur events (slider, radio, toggle, multivalue),
                // trigger the PATCH immediately on change
                const controlsWithoutBlur = ['slider', 'radio', 'toggle', 'multivalue'];
                if (controlsWithoutBlur.includes(controlType)) {
                    // Trigger blur handler to make PATCH call
                    this.handleAttributeBlur(event);
                }
            }
        }
    }

    async handleAttributeBlur(event) {
        const eventData = this._extractEventData(event);
        const { coverage, attribute } = this._findCoverageAndAttribute(eventData.coverageKey, eventData.attrDevName);

        if (!coverage || !attribute) {
            return;
        }

        const key = `${coverage.stiId || coverage.instanceKeysString}_${attribute.code}`;
        const originalValue = this._getOriginalValue(key, attribute);

        // Check if value has changed
        if (!this._hasValueChanged(originalValue, eventData.newValue)) {
            this.attributeOriginalValues.delete(key);
            return;
        }

        // Validate coverage is selected
        if (!this._validateCoverageSelected(coverage, attribute, originalValue, key)) {
            return;
        }

        // Only call PATCH if contextId exists
        if (!this._internalContextId) {
            return;
        }

        await this._patchAttributeUpdate(eventData, key, attribute, originalValue);
    }

    _extractEventData(event) {
        const controlType = event.target.dataset.controlType;
        let newValue;

        if (controlType === 'toggle' || controlType === 'checkbox') {
            newValue = event.target.checked;
        } else {
            newValue = event.target.value;
        }

        return {
            coverageKey: event.target.dataset.coverageKey,
            attrDevName: event.target.dataset.attrDevName,
            attrCode: event.target.dataset.attrCode,
            valueDecoder: event.target.dataset.valueDecoder,
            productCode: event.target.dataset.productCode,
            instanceKeys: event.target.dataset.instanceKeys,
            controlType,
            newValue
        };
    }

    _findCoverageAndAttribute(coverageKey, attrDevName) {
        if (!this.selectedNode || !this.selectedNode.coverages) {
            return {};
        }

        const coverage = this.selectedNode.coverages.find(c => c.key === coverageKey);
        if (!coverage) {
            return {};
        }

        const attribute = coverage.attributes?.find(a => a.developerName === attrDevName);
        return { coverage, attribute };
    }

    _getOriginalValue(key, attribute) {
        return this.attributeOriginalValues.has(key)
            ? this.attributeOriginalValues.get(key)
            : attribute.value;
    }

    _hasValueChanged(originalValue, newValue) {
        const isOriginalEmpty = originalValue === null || originalValue === undefined || originalValue === '';
        const isNewEmpty = newValue === null || newValue === undefined || newValue === '';

        // If both are empty, no change
        if (isOriginalEmpty && isNewEmpty) {
            return false;
        }

        // If both are non-empty and equal, no change
        if (!isOriginalEmpty && !isNewEmpty && originalValue === newValue) {
            return false;
        }

        return true;
    }

    _validateCoverageSelected(coverage, attribute, originalValue, key) {
        if (!coverage.isSelected) {
            this.error = LABELS.SELECT_COVERAGE_FIRST;
            attribute.value = originalValue;
            this.attributeOriginalValues.delete(key);
            this.selectedNode = { ...this.selectedNode };
            return false;
        }
        return true;
    }

    async _patchAttributeUpdate(eventData, key, attribute, originalValue) {
        const instanceKeysArray = eventData.instanceKeys ? eventData.instanceKeys.split(',') : [];

        const patchPayload = {
            contextId: this._internalContextId,
            ratingOptions: {
                executePricing: this.instantPricing,
                executeConfigurationRules: true,
                returnContextJson: true,
                returnProductDetails: true,
                returnRatingResults: true
            },
            updatedNodes: [
                {
                    instanceKeys: instanceKeysArray,
                    productCode: eventData.productCode,
                    attributes: {
                        [eventData.attrCode]: eventData.newValue
                    }
                }
            ]
        };

        this.isLoading = true;
        this.error = null;

        try {
            const result = await patchRatingFromLwc({ patchPayloadJson: JSON.stringify(patchPayload) });
            
              if (result && result.success) {
                this.processApiResponse(result);

                // Clean up stored original value after successful update
                this.attributeOriginalValues.delete(key);

                // Validate after attribute change
                const isValid = this.validateRequiredAttributes();
                this.omniValidate(isValid);
            } else {
                console.error('Error:', result?.errorMessage);
                
                if (result?.actionErrors) {
                    console.error('Detailed Errors:', result.actionErrors);
                }
                throw new Error(result?.errorMessage || 'Error saving selection');
            }
        } catch (error) {
            this._handlePatchError(error, attribute, originalValue, key);
        } finally {
            this.isLoading = false;
        }
    }

    _handlePatchError(error, attribute, originalValue, key) {
        this.error = error?.body ? JSON.stringify(error.body, null, 2) : error?.message || LABELS.ERROR_OCCURRED;

        const storedOriginalValue = this.attributeOriginalValues.get(key);
        if (storedOriginalValue !== undefined) {
            attribute.value = storedOriginalValue;
            this.attributeOriginalValues.delete(key);
            this.selectedNode = { ...this.selectedNode };
        }
    }

    /**
     * Handles itemoutputchange event from force-lookup component for attributes in Details section
     * Displays read-only Name of the record tied to the attribute
     */
    handleAttributeLookupChange(event) {
        if (!event || !event.detail || !event.detail.value) {
            return;
        }

        const attrId = event.target?.dataset?.attrId;
        if (!attrId) {
            return;
        }

        const displayValue = event.detail.value.displayValue;

        // Update the lookup display name in the categorized attributes
        if (this.selectedNode && this.selectedNode.attributes) {
            const attribute = this.selectedNode.attributes.find(a => a.id === attrId);
            if (attribute) {
                attribute.lookupDisplayName = displayValue;
                // Trigger reactivity
                this.selectedNode = { ...this.selectedNode };
            }
        }
    }

    /**
     * Handles itemoutputchange event from force-lookup component for coverage attributes
     * Displays read-only Name of the record tied to the coverage attribute
     */
    handleCoverageAttributeLookupChange(event) {
        if (!event || !event.detail || !event.detail.value) {
            return;
        }

        const coverageKey = event.target?.dataset?.coverageKey;
        const attrId = event.target?.dataset?.attrId;

        if (!coverageKey || !attrId) {
            return;
        }

        const displayValue = event.detail.value.displayValue;

        // Find the coverage and attribute
        const coverage = this.selectedNode?.coverages?.find(c => c.key === coverageKey);
        if (coverage?.attributes) {
            const attribute = coverage.attributes.find(a => a.id === attrId);
            if (attribute) {
                attribute.lookupDisplayName = displayValue;
                // Trigger reactivity
                this.selectedNode = { ...this.selectedNode };
            }
        }
    }

    handleNavigate(event) {
        const recordId = event.detail.recordId;
        if (!recordId) {
            return;
        }
        // Find the node with the matching recordId (id) in the tree
        const targetNode = findTreeNodeById(this.treeItems, recordId);
        if (targetNode) {
            // Expand parent nodes if needed and select the target node
            this.expandAndSelectNodeById(recordId);
        }
    }

    findParentNode(items, targetName, parent = null) {
        // Find the parent node of a given node by name
        for (const item of items) {
            if (item.name === targetName) {
                return parent;
            }
            if (item.items && item.items.length > 0) {
                const foundParent = this.findParentNode(item.items, targetName, item);
                if (foundParent !== undefined) {
                    return foundParent;
                }
            }
        }
        return undefined;
    }

    expandAndSelectNode(nodeName) {
        // Expand all parent nodes and select the target node by name
        const expandParents = (items, targetName, parentPath = []) => {
            for (const item of items) {
                if (item.name === targetName) {
                    // Found the target - expand all parents
                    parentPath.forEach(parent => {
                        parent.expanded = true;
                    });
                    // Trigger selection using the node's name (required by lightning-tree)
                    this.handleSelect({ detail: { name: item.name } });
                    return true;
                }
                if (item.items && item.items.length > 0) {
                    if (expandParents(item.items, targetName, [...parentPath, item])) {
                        return true;
                    }
                }
            }
            return false;
        };

        expandParents(this.treeItems, nodeName);
        // Re-assign to trigger reactivity
        this.treeItems = [...this.treeItems];
    }

    expandAndSelectNodeById(id) {
        // Expand all parent nodes and select the target node by id
        const expandParents = (items, targetId, parentPath = []) => {
            for (const item of items) {
                if (item.id === targetId) {
                    // Found the target - collect parent names to expand
                    const nodeNamesToExpand = new Set(parentPath.map(p => p.name));
                    // Trigger selection using the node's name (required by lightning-tree)
                    this.handleSelect({ detail: { name: item.name } });
                    return nodeNamesToExpand;
                }
                if (item.items && item.items.length > 0) {
                    const result = expandParents(item.items, targetId, [...parentPath, item]);
                    if (result) {
                        return result;
                    }
                }
            }
            return null;
        };

        const nodeNamesToExpand = expandParents(this.treeItems, id);
        if (nodeNamesToExpand) {
            // Restore expansion using the safe method
            this.restoreExpansionState(this.treeItems, nodeNamesToExpand);
            // Re-assign to trigger reactivity
            this.treeItems = [...this.treeItems];
        }
    }


    get productTitle() {
        return this.selectedNode ? this.selectedNode.label : 'Details';
    }

    get selectedNodePrice() {
        if (!this.selectedNode || this.selectedNode.netUnitPrice === null || this.selectedNode.netUnitPrice === undefined) {
            return null;
        }
        return this.selectedNode.netUnitPrice;
    }

    get selectedNodeTax() {
        if (!this.selectedNode) {
            return '';
        }

        const currency = this.getCurrencyForPriceSummary();
        const hasTax = this.selectedNode.proratedQLITaxAmount !== null && this.selectedNode.proratedQLITaxAmount !== undefined;
        const hasFee = this.selectedNode.proratedQLIFeeAmount !== null && this.selectedNode.proratedQLIFeeAmount !== undefined;

        if (!hasTax && !hasFee) {
            return '';
        }

        const taxInfo = hasTax ? `${LABELS.TAX_AMOUNT} ${this.formatCurrency(this.selectedNode.proratedQLITaxAmount, currency)}` : null;
        const feeInfo = hasFee ? `${LABELS.FEE_AMOUNT} ${this.formatCurrency(this.selectedNode.proratedQLIFeeAmount, currency)}` : null;

        if (taxInfo && feeInfo) {
            return `${taxInfo} | ${feeInfo}`;
        }
        if (feeInfo) {
            return feeInfo;
        }
        return taxInfo;
    }

    get currencyCode() {
        return this._savedCurrencyCode || this.getCurrencyForPriceSummary();
    }

    get hasCoverages() {
        return this.selectedNode?.coverages?.length > 0;
    }

    // Computed property that adds isDisabledOrLoading dynamically based on current isLoading state
    /**
     * Helper method to group and sort attributes by category
     */
    groupAttributesByCategory(attributes) {
        if (!attributes || attributes.length === 0) {
            return [];
        }

        // Helper function to sort attributes by sequence then label
        const sortAttributes = (attrs) => {
            return attrs.sort((a, b) => {
                const aSeq = a.sequence ?? Number.MAX_SAFE_INTEGER;
                const bSeq = b.sequence ?? Number.MAX_SAFE_INTEGER;

                if (aSeq !== bSeq) {
                    return aSeq - bSeq;
                }

                return (a.label || '').localeCompare(b.label || '');
            });
        };

        // Group attributes by category
        const categoryMap = new Map();
        const uncategorizedAttrs = [];

        attributes.forEach(attr => {
            if (attr.categoryName) {
                if (!categoryMap.has(attr.categoryName)) {
                    categoryMap.set(attr.categoryName, []);
                }
                categoryMap.get(attr.categoryName).push(attr);
            } else {
                uncategorizedAttrs.push(attr);
            }
        });

        // Build result array with categorized groups
        const result = [];

        // Add categorized groups (sorted by category name)
        const sortedCategories = Array.from(categoryMap.keys()).sort();
        sortedCategories.forEach(categoryName => {
            const attrs = categoryMap.get(categoryName);
            result.push({
                categoryName,
                attributes: sortAttributes(attrs),
                key: `category-${categoryName}`
            });
        });

        // Add uncategorized group if exists
        if (uncategorizedAttrs.length > 0) {
            result.push({
                categoryName: 'Uncategorized',
                attributes: sortAttributes(uncategorizedAttrs),
                key: 'category-uncategorized'
            });
        }

        return result;
    }

    get displayNode() {
        if (!this.selectedNode) {
            return null;
        }

        const node = { ...this.selectedNode };

        if (node.coverages) {
            node.coverages = node.coverages.map(coverage => {
                const updatedCoverage = { ...coverage };
                updatedCoverage.isDisabledOrLoading = coverage.isDisabled || this.isLoading;

                if (coverage.attributes) {
                    updatedCoverage.attributes = coverage.attributes.map(attr => {
                        const updatedAttr = { ...attr };
                        updatedAttr.isDisabledOrLoading = attr.isDisabled || this.isLoading;
                        updatedAttr.displayValue = this.getAttributeDisplayValue(attr);
                        return updatedAttr;
                    });

                    // Add categorized attributes for display
                    updatedCoverage.categorizedAttributes = this.groupAttributesByCategory(updatedCoverage.attributes);
                }

                return updatedCoverage;
            }).sort((a, b) => {
                // Sort coverages alphabetically by name
                return (a.name || '').localeCompare(b.name || '');
            });
        }

        return node;
    }

    get hasConfigMessages() {
        return this.configMessages && this.configMessages.length > 0;
    }

    get configMessageCount() {
        return this.configMessages ? this.configMessages.length : 0;
    }

    handleToggleMessages() {
        this.isMessagesExpanded = !this.isMessagesExpanded;
    }

    get messagesIconName() {
        return this.isMessagesExpanded ? 'utility:chevrondown' : 'utility:chevronright';
    }

    get showDeleteButton() {
        if (!this.selectedNode) {
            return false;
        }
        // Check if this node is a root product by checking if it exists in the top level of treeItems
        const isRootProduct = this.treeItems.some(item => item.name === this.selectedNode.name);
        return !isRootProduct;
    }

    processConfigMessages(messages) {
        if (messages && Array.isArray(messages)) {
            // Add unique keys to messages for proper rendering in template loops
            this.configMessages = messages.map((message, index) => ({
                ...message,
                key: message.key || `message-${index}`
            }));
        } else {
            this.configMessages = [];
        }
    }

    processUiTreatments(uiTreatments) {
        const treatments = {
            disabledComponents: new Map(), // stiId -> Set of prcIds
            hiddenComponents: new Map(), // stiId -> Set of prcIds
            disabledAttributes: new Map(), // stiId -> Set of attributeIds
            hiddenAttributes: new Map(), // stiId -> Set of attributeIds
            hiddenPicklistValues: new Map() // stiId -> Map(attributeId -> Set of valueIds)
        };

        if (uiTreatments && Array.isArray(uiTreatments)) {
            uiTreatments.forEach(treatment => {
                const { uiTreatmentType, uiTreatmentTarget, details } = treatment;
                if (!details) {
                    return;
                }

                // Component treatments
                if (uiTreatmentTarget === 'component') {
                    const { stiId, prcId } = details;
                    if (!stiId || !prcId) {
                        return;
                    }

                    if (uiTreatmentType === 'disable') {
                        if (!treatments.disabledComponents.has(stiId)) {
                            treatments.disabledComponents.set(stiId, new Set());
                        }
                        treatments.disabledComponents.get(stiId).add(prcId);
                    } else if (uiTreatmentType === 'hide') {
                        if (!treatments.hiddenComponents.has(stiId)) {
                            treatments.hiddenComponents.set(stiId, new Set());
                        }
                        treatments.hiddenComponents.get(stiId).add(prcId);
                    }
                }

                // Attribute treatments
                if (uiTreatmentTarget === 'attribute') {
                    const { stiId, attributeId } = details;
                    if (!stiId || !attributeId) {
                        return;
                    }

                    if (uiTreatmentType === 'disable') {
                        if (!treatments.disabledAttributes.has(stiId)) {
                            treatments.disabledAttributes.set(stiId, new Set());
                        }
                        treatments.disabledAttributes.get(stiId).add(attributeId);
                    } else if (uiTreatmentType === 'hide') {
                        if (!treatments.hiddenAttributes.has(stiId)) {
                            treatments.hiddenAttributes.set(stiId, new Set());
                        }
                        treatments.hiddenAttributes.get(stiId).add(attributeId);
                    }
                }

                // Attribute picklist value treatments
                if (uiTreatmentTarget === 'attribute_picklist_value') {
                    const { stiId, attributeId, attributePicklistValueId } = details;
                    if (!stiId || !attributeId || !attributePicklistValueId) {
                        return;
                    }

                    if (uiTreatmentType === 'hide') {
                        if (!treatments.hiddenPicklistValues.has(stiId)) {
                            treatments.hiddenPicklistValues.set(stiId, new Map());
                        }
                        const stiMap = treatments.hiddenPicklistValues.get(stiId);
                        if (!stiMap.has(attributeId)) {
                            stiMap.set(attributeId, new Set());
                        }
                        stiMap.get(attributeId).add(attributePicklistValueId);
                    }
                }
            });
        }
        return treatments;
    }

    // Pricing getter methods
    getCurrencyForPriceSummary() {
        if (!this.apiResponse?.productRatingOutput?.contextJSON?.salesTransactions?.[0]?.salesTransactionItems) {
            return CURRENCY; // Fall back to org's default currency
        }
        const firstItem = this.apiResponse.productRatingOutput.contextJSON.salesTransactions[0].salesTransactionItems[0];
        const currency = firstItem?.fields?.STICurrencyIsoCode__std || CURRENCY;
        return currency;
    }

    formatCurrency(amount, currencyCode) {
        const currency = currencyCode || CURRENCY;
        return new Intl.NumberFormat(LOCALE, {
            style: 'currency',
            currency,
            currencyDisplay: 'symbol'
        }).format(amount);
    }

    getPriceValue(fieldName) {
        if (!this.apiResponse?.productRatingOutput?.contextJSON?.salesTransactions?.[0]?.salesTransactionItems) {
            return 0;
        }
        const firstItem = this.apiResponse.productRatingOutput.contextJSON.salesTransactions[0].salesTransactionItems[0];
        return firstItem?.fields?.[fieldName] || 0;
    }

    get priceSummary() {
        if (this._savedPricingSummary) {
            return this._savedPricingSummary;
        }
        return {
            premium: this.getPriceValue('NetUnitPrice'),
            taxes: this.getPriceValue('ProratedQLITaxAmount'),
            fees: this.getPriceValue('ProratedQLIFeeAmount__std'),
            totalPremium: this.getPriceValue('NetTotalPrice')
        };
    }

    /**
     * Determines the formatter for an attribute based on data type
     * @param {string} dataType - The data type of the attribute
     * @returns {string} - The formatter to use ('currency', 'percent', or undefined)
     */
    _getAttributeFormatter(dataType) {
        if (!dataType) {
            return undefined;
        }

        const upperDataType = dataType.toUpperCase();
        switch (upperDataType) {
            case 'CURRENCY':
                return 'currency';
            case 'PERCENT':
                return 'percent';
            default:
                return undefined;
        }
    }

    _getAttributeStep(dataType) {
        if (!dataType) {
            return undefined;
        }

        const upperDataType = dataType.toUpperCase();
        switch (upperDataType) {
            case 'CURRENCY':
                return '0.01';
            case 'PERCENT':
                return '0.01';
            case 'NUMBER':
                return 'any';
            default:
                return undefined;
        }
    }

    attributeInputType(dataType, displayTypeOverride) {
        // If displayTypeOverride is specified, use it (normalized to lowercase)
        if (displayTypeOverride) {
            const override = displayTypeOverride.toUpperCase();
            // Map display type override values to control types
            switch (override) {
                case 'TEXT':
                    return 'text';
                case 'NUMBER':
                    return 'number';
                case 'DATE':
                    return 'date';
                case 'DATETIME':
                    return 'datetime';
                case 'CHECKBOX':
                    return 'checkbox';
                case 'TOGGLE':
                    return 'toggle';
                case 'SLIDER':
                    return 'slider';
                case 'RADIOBUTTON':
                    return 'radio';
                case 'COMBOBOX':
                    return 'combobox';
                case 'MULTIVALUECOMBOBOX':
                    return 'multivalue';
                default:
                    // If override value is not recognized, fall through to dataType logic
                    break;
            }
        }

        // Fall back to default dataType mapping
        switch (dataType) {
            case 'NUMBER':
            case 'CURRENCY':
            case 'PERCENT':
                return 'number';
            case 'DATE':
                return 'date';
            case 'DATETIME':
                return 'datetime';
            case 'CHECKBOX':
                return 'checkbox';
            case 'PICKLIST':
                return 'combobox';
            default:
                return 'text';
        }
    }

    /**
     * Calculates the decoder value display message for multivalue attributes
     * @param {Object} attr - The attribute object with valueDecoder and options
     * @returns {string} - The formatted decoder message
     */
    getDecoderValue(attr) {
        if (!attr.valueDecoder) {
            return '';
        }

        const parsingregex = /[/#]+/;
        let parsedDecoderValue = attr.valueDecoder.trim().split(parsingregex);
        parsedDecoderValue = parsedDecoderValue.map(part => part.trim());

        // Find the delimiter present in the label of first picklist option
        DELIMITERS.forEach((delimiter) => {
            if (attr.options && attr.options.length > 0 && attr.options[0].label.includes(delimiter)) {
                parsedDecoderValue = parsedDecoderValue.join(' ' + delimiter + ' ');
            }
        });

        return LABELS.MULTI_VALUE_DECODER_MESSAGE + parsedDecoderValue;
    }

    /** Getter for all labels used in HTML template */
    get labels() {
        return LABELS;
    }

    /** Getter for validation error message */
    get displayValidationMsg() {
        return this.validationMsg;
    }

    /**
     * Gets the display value for an attribute, converting picklist values to labels
     * and formatting values based on datatype
     * @param {Object} attr - The attribute object
     * @returns {string} - The display value
     */
    getAttributeDisplayValue(attr) {
        if (!attr) {
            return '';
        }

        let displayValue = attr.value;

        // Handle null/undefined values
        if (displayValue === null || displayValue === undefined) {
            return '';
        }

        // For picklists, find the label corresponding to the value
        if (attr.dataType === 'PICKLIST' && attr.options) {
            const option = attr.options.find(opt => opt.value === attr.value);
            if (option) {
                displayValue = option.label;
            }
            return displayValue;
        }

        // Format based on dataType
        const dataType = attr.dataType?.toUpperCase();

        switch (dataType) {
            case 'CURRENCY':
                // Format as currency
                try {
                    const numValue = parseFloat(displayValue);
                    if (!isNaN(numValue)) {
                        displayValue = new Intl.NumberFormat(LOCALE, {
                            style: 'currency',
                            currency: this.currencyCode || CURRENCY,
                            currencyDisplay: 'symbol'
                        }).format(numValue);
                    }
                } catch (e) {
                    // If formatting fails, return original value
                }
                break;

            case 'PERCENT':
                // Format as percentage
                try {
                    const numValue = parseFloat(displayValue);
                    if (!isNaN(numValue)) {
                        displayValue = new Intl.NumberFormat(LOCALE, {
                            style: 'percent',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2
                        }).format(numValue / 100);
                    }
                } catch (e) {
                    // If formatting fails, return original value
                }
                break;

            case 'DATE':
                // Format as date
                try {
                    const dateValue = new Date(displayValue);
                    if (!isNaN(dateValue.getTime())) {
                        displayValue = new Intl.DateTimeFormat(LOCALE, {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                        }).format(dateValue);
                    }
                } catch (e) {
                    // If formatting fails, return original value
                }
                break;

            case 'DATETIME':
                // Format as datetime
                try {
                    const dateValue = new Date(displayValue);
                    if (!isNaN(dateValue.getTime())) {
                        displayValue = new Intl.DateTimeFormat(LOCALE, {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                        }).format(dateValue);
                    }
                } catch (e) {
                    // If formatting fails, return original value
                }
                break;

            default:
                // For other types (TEXT, NUMBER, CHECKBOX, etc.), return as-is
                break;
        }

        return displayValue;
    }

    /** Computed property to determine if Update Prices button should be disabled */
    get isUpdatePricesDisabled() {
        // Disable when instant pricing is enabled, enable when it's disabled
        return this.instantPricing;
    }

    /** Computed property to group and sort attributes by category */
    get categorizedAttributes() {
        if (!this.selectedNode || !this.selectedNode.attributes) {
            return [];
        }

        // Filter out hidden attributes based on uiTreatments
        const stiId = this.selectedNode.id;
        const visibleAttributes = this.selectedNode.attributes.filter(attr =>
            !this.isAttributeHidden(stiId, attr.id)
        );

        // Helper function to sort attributes by sequence then label
        const sortAttributes = (attrs) => {
            return attrs.sort((a, b) => {
                // First compare by sequence
                const aSeq = a.sequence ?? Number.MAX_SAFE_INTEGER;
                const bSeq = b.sequence ?? Number.MAX_SAFE_INTEGER;

                if (aSeq !== bSeq) {
                    return aSeq - bSeq;
                }

                // If sequences are equal, compare by label
                return (a.label || '').localeCompare(b.label || '');
            });
        };

        // Group attributes by category
        const categoryMap = new Map();
        const uncategorizedAttrs = [];

        visibleAttributes.forEach(attr => {
            // Add displayValue and lookup properties to attribute
            const attrWithDisplay = {
                ...attr,
                displayValue: this.getAttributeDisplayValue(attr),
                isLookup: attr.dataType === 'lookup',
                lookupObjectApiName: attr.additionalFields?.referenceObject || null
            };

            if (attr.categoryName) {
                if (!categoryMap.has(attr.categoryName)) {
                    categoryMap.set(attr.categoryName, []);
                }
                categoryMap.get(attr.categoryName).push(attrWithDisplay);
            } else {
                uncategorizedAttrs.push(attrWithDisplay);
            }
        });

        // Build result array with categorized groups
        const result = [];

        // Add categorized groups (sorted by category name for consistent display)
        const sortedCategories = Array.from(categoryMap.keys()).sort();
        sortedCategories.forEach(categoryName => {
            const attrs = categoryMap.get(categoryName);
            result.push({
                categoryName,
                attributes: sortAttributes(attrs),
                key: `category-${categoryName}`
            });
        });

        // Add uncategorized group if there are any uncategorized attributes
        if (uncategorizedAttrs.length > 0) {
            result.push({
                categoryName: 'Uncategorized',
                attributes: sortAttributes(uncategorizedAttrs),
                key: 'category-uncategorized'
            });
        }

        return result;
    }

    getOmniDataOutput() {
        return {
            contextId: this._internalContextId
        };
    }

    /**
     * Helper method to check if a value is empty
     * @param {*} value - The value to check
     * @returns {boolean} - True if the value is empty
     */
    _isEmptyValue(value) {
        // Check for null, undefined, or empty string
        if (value === null || value === undefined || value === '') {
            return true;
        }
        // Check for empty array (for multivalue combobox)
        if (Array.isArray(value) && value.length === 0) {
            return true;
        }
        return false;
    }

    /**
     * Validates that all required attributes have values from context JSON.
     * This mirrors the omniValidate logic from prodSel.
     * @returns {boolean} - True if all required attributes have values, false otherwise
     */
    validateRequiredAttributes() {
        if (!this.treeItems || this.treeItems.length === 0) {
            this.validationMsg = '';
            return true; // No data to validate
        }

        let hasAllRequiredValues = true;

        const validateNode = (node) => {
            // Check attributes at node level
            if (node.attributes) {
                node.attributes.forEach(attr => {
                    if (attr.isRequired && this._isEmptyValue(attr.value)) {
                        hasAllRequiredValues = false;
                    }
                });
            }

            // Check attributes in coverages
            if (node.coverages) {
                node.coverages.forEach(coverage => {
                    // Only validate selected coverages
                    if (coverage.isSelected && coverage.attributes) {
                        coverage.attributes.forEach(attr => {
                            if (attr.isRequired && this._isEmptyValue(attr.value)) {
                                hasAllRequiredValues = false;
                            }
                        });
                    }
                });
            }

            // Recursively check child items
            if (node.items && node.items.length > 0) {
                node.items.forEach(childNode => validateNode(childNode));
            }
        };

        // Validate all root nodes
        this.treeItems.forEach(rootNode => validateNode(rootNode));

        // Set validation message if validation fails
        if (!hasAllRequiredValues) {
            this.validationMsg = LABELS.REQUIRED_ATTRIBUTES_MSG;
        } else {
            this.validationMsg = '';
        }

        return hasAllRequiredValues;
    }

    /**
     * Syncs selectedNode changes back to treeItems to ensure latest user values are captured
     */
    syncSelectedNodeToTreeItems() {
        if (!this.selectedNode) {
            return;
        }

        const updateNodeInTree = (items, targetName, updatedNode) => {
            for (let i = 0; i < items.length; i++) {
                if (items[i].name === targetName) {
                    // Update the node with the latest changes from selectedNode
                    items[i] = { ...items[i], ...updatedNode };
                    return true;
                }
                if (items[i].items && items[i].items.length > 0) {
                    if (updateNodeInTree(items[i].items, targetName, updatedNode)) {
                        return true;
                    }
                }
            }
            return false;
        };

        updateNodeInTree(this.treeItems, this.selectedNode.name, this.selectedNode);
    }

    // Overwrites method from OmniscriptBaseMixin to prevent user from using Next button
    @api checkValidity() {
        return this.validateRequiredAttributes();
    }

    /**
     * Override omniNextStep to track navigation direction
     * This allows us to know if the user clicked Next vs Previous
     */
    omniNextStep() {
        this._navigationDirection = 'next';
        super.omniNextStep();
    }

    /**
     * Override omniPrevStep to track navigation direction
     * This allows us to know if the user clicked Previous vs Next
     */
    omniPrevStep() {
        this._navigationDirection = 'previous';
        super.omniPrevStep();
    }


    // Save state does not work in custom OS environment
    disconnectedCallback() {
        // Reset navigation direction for next navigation
        this._navigationDirection = null;
    }

    get showCustomNextPrevButtons() {
        // Handle both boolean and string values (OmniScript may pass "true" as string)
        return this.clearStateOnPrev === true || this.clearStateOnPrev === 'true';
    }
}