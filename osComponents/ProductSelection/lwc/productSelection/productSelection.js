import { LightningElement, api } from 'lwc';
import { buildTreeFromContextJSON, transformTreeToGrid } from './dataManager';
import CURRENCY from '@salesforce/i18n/currency';

import postRatingFromLwc from '@salesforce/apex/InsuranceRatingApexService.postRatingFromLwc';
import ProdSelCompareModal from 'c/productSelectionCompareModal';
import { OmniscriptBaseMixin } from 'c/omniscriptBaseMixin';
import { VALIDATION_MESSAGES, CONSTANTS, LABELS } from './labelsAndConstants';

export default class ProductSelection extends OmniscriptBaseMixin(LightningElement) {

    @api additionalFields = {};
    @api effectiveDate;
    @api ratingInputs = [];
    @api ratingOptions = {};
    @api ratedProdDescriptions = [];
    @api rootProductCodes = [];
    @api transactionType;
    @api clearStateOnChange;
    @api clearStateOnPrev;
    @api enableMultiSelect = false;
    @api multiSelectMax = CONSTANTS.MAX_ROOT_PRODUCTS;

    errors = [];
    isLoading = false;
    ratedProductsMap = new Map();
    compareProducts = new Set();
    selectedProducts = new Set();
    validationMsg;
    currencyIsoCode;
    _navigationDirection = null;

    connectedCallback() {
        if (!this.validateRootProducts()) {
            return;
        }

        const stateData = this.omniGetSaveState();
        if (stateData && stateData.ratedProducts) {
            this.parseSavedState(stateData);
        } else {
            this.loadData();
        }
    }

    get CONSTANTS() {
        return CONSTANTS;
    }

    get LABELS() {
        return LABELS;
    }

    // Overwrites method from OmniscriptBaseMixin to prevent user from using Next button
    @api checkValidity() {
        return this.selectedProducts.size > 0 && this.selectedProducts.size <= this.multiSelectMax;
    }

    async loadData() {
        this.isLoading = true;
        try {
            await this.invokeApiRequest();
        } catch (error) {
            this._handleError(error);
        } finally {
            this.isLoading = false;
        }
    }

    async invokeApiRequest() {
        const ratingInputArr = JSON.parse(JSON.stringify(this.ratingInputs));

        // Group rating inputs per root product instance
        const inputsByRatedProduct = this.formatRatingInputsRequest(ratingInputArr);
        const additionalFields = this.formatAdditionalFields();
        const ratingOptions = this.formatRatingOptions();

        // Create a separate request for each root product instance and execute in parallel
        const promises = Array.from(inputsByRatedProduct.values()).map(({ rootProductCode, ratingInputs }) => {
            const postPayload = {
                additionalFields,
                effectiveDate: this.effectiveDate,
                ratingInputs,
                ratingOptions,
                rootProductCodes: rootProductCode ? [rootProductCode] : null,
                transactionType: this.transactionType
            };
            return postRatingFromLwc({ postPayloadJson: JSON.stringify(postPayload) });
        });

        try {
            const responses = await Promise.all(promises);
            this.processMultipleApiResponses(responses);
        } catch (error) {
            this._handleError(error);
        }
    }

    formatRatingInputsRequest(ratingInputArr) {
        const reusableInputs = ratingInputArr.filter(input => input.reusable === true);
        const nonReusableInputs = ratingInputArr.filter(input => input.reusable !== true);

        const topLevelInputs = nonReusableInputs.filter(input =>
            input.instanceKeys && input.instanceKeys.length === 1
        );

        const inputsByRatedProduct = new Map();
        topLevelInputs.forEach(topLevelInput => {
            const topLevelInstanceKey = topLevelInput.instanceKeys[0];
            const relatedInputs = nonReusableInputs.filter(input =>
                input.instanceKeys && input.instanceKeys.includes(topLevelInstanceKey)
            );

            if (relatedInputs.length > 0) {
                inputsByRatedProduct.set(topLevelInstanceKey, {
                    rootProductCode: null,
                    ratingInputs: relatedInputs
                });
            }
        });

        if (this.rootProductCodes && this.rootProductCodes.length > 0) {
            this.rootProductCodes.forEach(rootProductCode => {
                const relatedProductCodeInputs = nonReusableInputs.filter(input =>
                    input.instanceKeys && input.instanceKeys.includes(rootProductCode)
                );
                if (reusableInputs.length > 0 || relatedProductCodeInputs.length > 0) {
                    inputsByRatedProduct.set(rootProductCode, {
                        rootProductCode,
                        ratingInputs: [...reusableInputs, ...relatedProductCodeInputs]
                    });
                }
            });
        }

        return inputsByRatedProduct;
    }

    processMultipleApiResponses(responses) {
        this.ratedProductsMap = this.handleRatingResponses(responses);

        if (this.errors && this.errors.length > 0) {
            this.omniUpdateDataJson(this.getOmniDataOutput());
            return;
        }

        const allProducts = Array.from(this.ratedProductsMap.values());
        allProducts.sort((a, b) => {
            const nameA = (a.label || a.name || '').toLowerCase();
            const nameB = (b.label || b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });

        this.ratedProductsMap.clear();
        allProducts.forEach(product => {
            this.ratedProductsMap.set(product.id, product);
        });
    }

    handleRatingResponses(responses) {
        const ratedProducts = new Map();
        const descriptionMap = new Map();
        this.ratedProdDescriptions.forEach(desc => {
            if (desc.rootProductCode) {
                descriptionMap.set(desc.rootProductCode, desc.ratingDescription);
            }
            if (desc.rootInstanceKey) {
                descriptionMap.set(desc.rootInstanceKey, desc.ratingDescription);
            }
        });

        responses.forEach(response => {
            // Handle Apex response structure - extract data from response or ratingData
            const ratingData = response?.ratingData || {};
            const productRatingOutput = ratingData?.productRatingOutput || {};
            const contextId = response?.contextId || ratingData?.contextId || productRatingOutput?.contextId;
            const contextJSON = response?.contextJSON || ratingData?.contextJSON || productRatingOutput?.contextJSON;
            const productDetails = response?.productDetails || ratingData?.productDetails || productRatingOutput?.productDetails;
            const uiTreatments = response?.uiTreatments || ratingData?.uiTreatments || productRatingOutput?.uiTreatments;

            if (response?.success === false) {
                const errorMessage = response?.errorMessage || 'Unknown error occurred';
                this.errors.push({ message: errorMessage });
                return;
            }

            if (response?.error && response.error.length > 0) {
                this.errors.push(...response.error);
                return;
            }

            if (!contextJSON || !productDetails) {
                return;
            }

            if (!this.currencyIsoCode) {
                this.currencyIsoCode = contextJSON?.salesTransactions[0]?.fields?.CurrencyIsoCode__std || CURRENCY;
            }

            const productsArray = buildTreeFromContextJSON(contextJSON, productDetails, uiTreatments);
            productsArray.forEach(rootProduct => {
                const description = descriptionMap.get(rootProduct.instanceKey)
                    || descriptionMap.get(rootProduct.productCode)
                    || rootProduct.description;

                const productWithDescription = {
                    ...rootProduct,
                    contextId,
                    description,
                };
                ratedProducts.set(rootProduct.id, productWithDescription);
            });
        });

        return ratedProducts;
    }

    handleProductSelection(event) {
        const selectedId = event.target.dataset.id;
        const isSelected = event.target.checked;

        if (selectedId) {
            if (isSelected) {
                this.compareProducts.add(selectedId);
            } else {
                this.compareProducts.delete(selectedId);
            }

            // Validate selection after each change
            this.validationMsg = '';
            if (this.compareProducts.size > 0) {
                this.validateSelectionForComparison();
            }
        }
    }

    handlePickerSelection(event) {
        const selectedId = event.target.dataset.id;
        const isChecked = event.target.checked;

        if (this.enableMultiSelect) {
            const product = this.findProductById(selectedId);
            if (product) {
                if (isChecked) {
                    this.selectedProducts.add(selectedId);
                    product.isSelected = true;
                } else {
                    this.selectedProducts.delete(selectedId);
                    product.isSelected = false;
                }

                if (this.multiSelectMax && this.selectedProducts.size > this.multiSelectMax) {
                    this.validationMsg = VALIDATION_MESSAGES.MAX_MULTI_SELECT_PRODUCT_VALIDATION.replace('{0}', this.multiSelectMax);
                } else {
                    this.validationMsg = '';
                }

                this.omniUpdateDataJson(this.getOmniDataOutput());
                this.omniValidate();
            }
        } else {
            this.clearState();

            if (this.selectedProducts.size > 0) {
                const previousId = Array.from(this.selectedProducts)[0];
                const previousProduct = this.findProductById(previousId);
                if (previousProduct) {
                    previousProduct.isSelected = false;
                }
                this.selectedProducts.clear();
            }

            if (selectedId) {
                const product = this.findProductById(selectedId);
                if (product) {
                    product.isSelected = true;
                    this.selectedProducts.add(selectedId);
                    this.omniUpdateDataJson(this.getOmniDataOutput());
                }

                this.omniValidate();
            }
        }
    }

    findProductById(productId) {
        return this.ratedProductsMap.get(productId) || null;
    }

    launchProdCompareModal() {
        if (!this.validateSelectionForComparison()) {
            return;
        }

        const filteredProducts = this.ratedProducts.filter(product =>
            this.compareProducts.has(product.id)
        );

        const { gridData, gridColumns } = transformTreeToGrid(filteredProducts, this.currencyIsoCode);
        ProdSelCompareModal.open({
            gridData,
            gridColumns
        }).then(() => {
            // do nothing
        }).catch(error => {
            this._handleError(error);
        });
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
        ratingOptions.returnContextJson = true;
        ratingOptions.returnProductDetails = true;
        ratingOptions.returnRatingResults = true;

        if (ratingOptions.executePricing === null || ratingOptions.executePricing === undefined) {
            ratingOptions.executePricing = true;
        }
        if (ratingOptions.executeConfigurationRules === null || ratingOptions.executeConfigurationRules === undefined) {
            ratingOptions.executeConfigurationRules = true;
        }

        return ratingOptions;
    }

    _handleError(err) {
        const errorMessage = err && err.message ? err.message : String(err);
        this.errors = [{ message: errorMessage }];
        this.omniUpdateDataJson(this.getOmniDataOutput());
    }

    validateSelectionForComparison() {
        let comparisonMsg = '';

        if (this.compareProducts.size < 2) {
            comparisonMsg = VALIDATION_MESSAGES.MIN_COMPARISON_VALIDATION.replace('{0}', CONSTANTS.MIN_PRODUCTS_FOR_COMPARISON);
        }

        if (this.compareProducts.size > 3) {
            comparisonMsg = VALIDATION_MESSAGES.MAX_COMPARISON_VALIDATION.replace('{0}', CONSTANTS.MAX_PRODUCTS_FOR_COMPARISON);
        }

        this.validationMsg = comparisonMsg;
        return !comparisonMsg;
    }

    validateRootProducts() {
        let rootProductCount = 0;
        if (this.rootProductCodes && Array.isArray(this.rootProductCodes)) {
            rootProductCount += this.rootProductCodes.length;
        }

        if (this.ratingInputs && Array.isArray(this.ratingInputs)) {
            const rootProductInputs = this.ratingInputs.filter(input => {
                return input.instanceKeys && input.instanceKeys.length === 1 && input.reusable !== true;
            });
            rootProductCount += rootProductInputs.length;
        }

        if (rootProductCount > CONSTANTS.MAX_ROOT_PRODUCTS) {
            const maxProdErrorMsg = VALIDATION_MESSAGES.MAX_ROOT_PRODUCT_VALIDATION.replace('{0}', CONSTANTS.MAX_ROOT_PRODUCTS);
            this.validationMsg = maxProdErrorMsg;
            this._handleError(maxProdErrorMsg);
            return false;
        }

        return true;
    }

    getOmniDataOutput() {
        const selectedProductsArray = Array.from(this.selectedProducts).map(productId => {
            const product = this.findProductById(productId);
            return {
                contextId: product?.contextId,
                ratingInputs: this.getFilteredRatingInputsForProduct(product)
            };
        });

        return {
            errors: this.errors,
            selectedProducts: selectedProductsArray
        };
    }

    getFilteredRatingInputsForProduct(product) {
        if (!product || !this.ratingInputs || this.ratingInputs.length === 0) {
            return [];
        }

        const selectedInstanceKey = product.instanceKey;
        const matchingInputs = this.ratingInputs.filter(input => {
            return input.instanceKeys && input.instanceKeys.includes(selectedInstanceKey);
        });

        const reusableInputs = this.ratingInputs.filter(input => input.reusable === true);
        if (reusableInputs.length > 0) {
            const updatedReuseInputs = reusableInputs.map(input => {
                const updatedInput = JSON.parse(JSON.stringify(input));
                updatedInput.instanceKeys = [selectedInstanceKey, ...(updatedInput.instanceKeys || [])];
                updatedInput.reusable = false;
                return updatedInput;
            });

            matchingInputs.push(...updatedReuseInputs);
        }

        if (this.rootProductCodes && this.rootProductCodes.includes(product.productCode)) {
            const rootProductRatingInput = {
                productCode: product.productCode,
                instanceKeys: [selectedInstanceKey],
                reusable: false
            };
            matchingInputs.unshift(rootProductRatingInput);
        }

        return matchingInputs;
    }

    parseSavedState(stateData) {
        this.ratedProductsMap = new Map();
        stateData?.ratedProducts.forEach(product => {
            this.ratedProductsMap.set(product.id, product);
        });

        if (stateData?.selectedProductIds && Array.isArray(stateData.selectedProductIds)) {
            this.selectedProducts = new Set(stateData.selectedProductIds);
            stateData.selectedProductIds.forEach(productId => {
                const product = this.findProductById(productId);
                if (product) {
                    product.isSelected = true;
                }
            });
        }

        this.isLoading = false;
    }

    clearState() {
        if (this.clearStateOnChange) {
            // stringified array in OS LWC config
            JSON.parse(this.clearStateOnChange).forEach(key => {
                this.omniSaveState('', key);
            });
        }
    }

    handleCustomPrevious() {
        if (this.clearStateOnPrev === true || this.clearStateOnPrev === 'true') {
            this.omniUpdateDataJson('');
            this.omniSaveState(null, null, false);
        }
        this.omniPrevStep();
    }

    handleCustomNext() {
        const isValid = this.checkValidity();
        if (isValid) {
            this.validationMsg = '';
            this.omniNextStep();
        } else {
            this.showValidation = true;
            this.validationMsg = this.displayErrorMsg;
        }
    }

    omniNextStep() {
        this._navigationDirection = 'next';
        const stateData = {
            ratedProducts: this.ratedProducts,
            selectedProductIds: Array.from(this.selectedProducts)
        };
        this.omniSaveState(stateData, null, false);
        super.omniNextStep();
    }

    omniPrevStep() {
        this._navigationDirection = 'previous';
        super.omniPrevStep();
    }

    get displayErrorMsg() {
        if (this.ratedProducts.length === 0) {
            return this.validationMsg ? this.validationMsg : VALIDATION_MESSAGES.NO_PRODUCTS_MSG;
        }

        if (this.showValidation && this.selectedProducts.size === 0) {
            return VALIDATION_MESSAGES.SELECTION_REQUIRED_MSG;
        }

        return this.validationMsg;
    }

    get ratedProducts() {
        return Array.from(this.ratedProductsMap.values());
    }

    get pickerType() {
        return this.enableMultiSelect ? CONSTANTS.PICKER.CHECKBOX : CONSTANTS.PICKER.RADIO;
    }

    get showCustomNextPrevButtons() {
        return this.clearStateOnPrev === true || this.clearStateOnPrev === 'true';
    }

    disconnectedCallback() {
        this._navigationDirection = null;
    }
}
