# Product Selection Lightning Web Component

## Overview

The `productSelection` Lightning Web Component (LWC) is designed for Digital Insurance product selection workflows. It extends `OmniscriptBaseMixin` to integrate seamlessly with OmniScripts, and makes it easy for users to view, compare, and select rated insurance products.

The component supports both **single-select** and **multi-select** modes, displays product cards with pricing information, and includes a product comparison modal.

---

## Dependencies

- **Apex Controller**: `InsuranceRatingApexService.postRatingFromLwc`  
- **Mixin**: `c/omniscriptBaseMixin` (follow the steps under [Prerequisites]()) 
- **Helper Modules**:  
  - `dataManager.js` – Tree building and grid transformation utilities  
  - `labelsAndConstants.js` – Validation messages, labels, and constants

## Components Included

| Component | Description |
| :---- | :---- |
| `productSelection` | Main component for displaying and selecting rated products |
| `productSelectionCompareModal` | Modal dialog for comparing 2-3 selected products |
| `productSelectionCustomTreeGrid` | Extended `lightning-treeGrid` with custom cell rendering |
| `productSelectionCustomTemplate` | Custom cell template for various data types such as currency, date, and lookup. |

### Supporting Files

| File | Type | Description |
| :---- | :---- | :---- |
| `InsuranceRatingApexService.cls` | Apex Class | Service class that wraps the `createInsuranceRating` invocable action |
| `ProductSelectionLabels.labels` | Custom Labels | UI text labels for translation support |

---

## Public Properties (`@api`) {#public-properties-(@api)}

| Property | Type | Default | Description |
| :---- | :---- | :---- | :---- |
| `additionalFields` | `Object` | `{}` | Additional fields to include in the rating request payload.  |
| `clearStateOnChange` | `String` | — | JSON stringified array of element names whose state should be cleared when selection changes. |
| `clearStateOnPrev` | `Boolean/String` | — | When `true` or `'true'`, enables custom navigation buttons and clears state when navigating to the previous step. |
| `effectiveDate` | `String` | — | The effective date for rating calculations. |
| `enableMultiSelect` | `Boolean` | `false` | Enables multi-select mode allowing users to select multiple products. |
| `multiSelectMax` | `Number` | `10` | Maximum number of products that can be selected in multi-select mode. |
| `ratedProdDescriptions` | `Array` | `[]` | Array of description objects `{rootProductCode, rootInstanceKey, ratingDescription}` for custom product descriptions. |
| `ratingInputs` | `Array` | `[]` | Array of rating input objects containing product configuration data. Supports reusable and non-reusable inputs with `instanceKeys`. |
| `ratingOptions` | `Object` | `{}` | Rating options passed to the API. Defaults `executePricing` and `executeConfigurationRules` to `true`. |
| `rootProductCodes` | `Array` | `[]` | Array of root product codes to rate. Define when the rating inputs are marked as reusable. |
| `transactionType` | `String` | — | The transaction type for the rating request |

Rating inputs and options are based on the [Insurance Product Rating API](https://developer.salesforce.com/docs/atlas.en-us.insurance_developer_guide.meta/insurance_developer_guide/connect_resources_product_rating.htm%20%20).

## HTML Markup

### Product Card Layout

Each card displays:

- **Product title** – With 2-line text clamp and ellipsis overflow  
- **Premium amount** – Formatted using `lightning-formatted-number` with currency  
- **Description** – With 3-line text clamp and ellipsis overflow

### Conditional Custom Navigation

When `clearStateOnPrev` is true, the component renders custom Previous/Next buttons for state management control:

```html
<template lwc:if={showCustomNextPrevButtons}>
    <lightning-button label="Previous" onclick={handleCustomPrevious} ... />
    <lightning-button label="Next" onclick={handleCustomNext} ... />
</template>
```

---

## Component Usage

Embed the productSelection LWC in an Omniscript by using the Custom Lightning Web Component element in a step.

### Adding to an OmniScript Step

1. Open your OmniScript in OmniStudio Designer  
2. Add a **Custom Lightning Web Component** element to your step  
3. Set the **LWC Component Name** to `c-product-selection`  
4. Configure the component properties (see [Public Properties]())

If you set `clearStateOnPrev` to `true`, hide the standard Previous and Next buttons in the step by reducing their width to 0\. The productSelection LWC shows Previous and Next buttons for navigation.

### Data Output Structure

The component outputs data to OmniScript via `omniUpdateDataJson()`:

```javascript
{
    errors: [{ message: "Error message" }],
    selectedProducts: [
        {
            contextId: "contextId-123",
            ratingInputs: [
                {
                    productCode: "PROD_001",
                    instanceKeys: ["key1", "key2"],
                    reusable: false
                }
            ]
        }
    ]
}
```

---

## Customization

### Styling

The productSelection LWC uses the Salesforce Lightning Design System (SLDS) for styling. 

### Adding Custom Product Descriptions

Pass custom descriptions via the `ratedProdDescriptions` property:

```json
{
  "ratedProdDescriptions": [
  	{
          "rootProductCode": "AUTO_POLICY",
    	   "rootInstanceKey": "policy-1",
    	   "ratingDescription": "Comprehensive auto coverage with roadside assistance"
  	}
   ]
}
```

If both rootProductCode and rootInstanceKey are provided, rootInstanceKey takes precedence.

### Constants Configuration

Edit `labelsAndConstants.js` to modify:

- `MIN_PRODUCTS_FOR_COMPARISON`: The minimum number of products that the user must select for comparison. The default value is 2\.  
- `MAX_PRODUCTS_FOR_COMPARISON`: The maximum number of products that the user can select for comparison. The default value is 3\.  
- `MAX_ROOT_PRODUCTS`:  The maximum number of root products that the user can select. The default value is 10\.  
- `MAX_CHAR_LIMIT`: Character limit for descriptions (default: 150\) The maximum number of characters that the user can enter in the description. The default value is 150\.

### Custom Labels

These custom labels are included and can be customized or translated:

| Label API Name | Default Value | Purpose |
| :---- | :---- | :---- |
| `ProdSelMinComparisonValidation` | Select at least {0} products to compare | Validation message |
| `ProdSelMaxComparisonValidation` | Select up to {0} products to compare. | Validation message |
| `ProdSelMaxMultiSelectValidation` | Choose no more than {0} products. | Validation message |
| `ProdSelMaxRootProductValidation` | No more than {0} root products are allowed for input. | Validation message |
| `ProdSelSelectionRequiredMsg` | Choose a product. | Validation message |
| `ProdSelNoProductsMsg` | No products are available. | Empty state message |
| `ProdSelCompareBtn` | Compare | Button label |
| `ProdSelDetails` | Details | Column header |
| `ProdSelNext` | Next | Button label |
| `ProdSelPremium` | Premium | Label text |
| `ProdSelPrevious` | Previous | Button label |
| `ProdSelProduct` | Product | Column header |
| `ProdSelLoading` | Loading | Spinner alt text |
| `ProdSelCheckbox` | checkbox | Accessibility label |
| `ProdSelCompareProducts` | Compare Products | Modal header |
| `ProdSelCancel` | Cancel | Button label |

## Troubleshooting

### Common Issues

| Issue | Possible Cause | Solution |
| :---- | :---- | :---- |
| "No products are available" | Rating API returned no products or ran into error | Verify `rootProductCodes` and `ratingInputs` are correct. |
| OmniscriptBaseMixin not found on component deployment | Missing Omniscript customization package | Ensure `omniscriptBaseMixin` and utility modules are deployed by following the [Prerequisites](). |
| Missing context or product details on rating call response | Wrong API version | Ensure that all components and supporting files use Salesforce API version **66.0** or later. |
| State not persisting | clearStateOnPrev is not set to true | Hide step buttons by setting width to 0 and set `clearStateOnPrev` to true. |

### Debugging

1. **Debug Logs:** Enable debug logs for the `InsuranceRatingApexService` class.  
2. **Browser console:**  The component logs errors to the console.  
3. **OmniScript data panel:**  Check the data JSON for output values.

## API Version

All components and supporting files must use Salesforce API version **66.0** or later.  