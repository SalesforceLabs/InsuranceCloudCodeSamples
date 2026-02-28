# Product Configuration Lightning Web Component

## Overview

The `productConfiguration` Lightning Web Component (LWC) is designed for Digital Insurance Product Configuration workflows. It extends `OmniscriptBaseMixin` to integrate seamlessly with OmniScripts, and makes it easy for users to view, configure, and rate insurance products.

---

## Dependencies

- **Apex Controller**: `InsuranceRatingApexService.postRatingFromLwc`  
- **Apex Controller**: `InsuranceRatingApexService.patchRatingFromLwc` 
- **Mixin**: `c/omniscriptBaseMixin` (follow the steps under [Prerequisites](../../../README.md#prerequisites)) 
- **Helper Modules**:  
  - `dataManager.js` – Tree building and grid transformation utilities  
  - `labelsAndConstants.js` – Validation messages, labels, and constants

## Components Included

| Component | Description |
| :---- | :---- |
| `productConfiguration` | Main component for displaying, configuring and rating insurance products.|
| `productConfigurationMessageItem` | Notification component used to display validation results, configuration errors, or informational messages within the product.|

### Supporting Files

| File | Type | Description |
| :---- | :---- | :---- |
| `InsuranceRatingApexService.cls` | Apex Class | Service class that wraps the createInsuranceRating and repriceInsuranceProduct invocable action.|
| `ProductConfigurationLabels.labels` | Custom Labels | UI text labels for translation support |

---

## Public Properties (`@api`)

| Property | Type | Default | Description |
| :---- | :---- | :---- | :---- |
| `additionalFields` | `Object` | `{}` | Additional fields to include in the rating request payload.  |
| `clearStateOnPrev` | `Boolean/String` | — | When `true` or `'true'`, enables custom navigation buttons and clears state when navigating to the previous step. |
| `ratingInputs` | `Array` | `[]` | Array of rating input objects containing product configuration data. Supports reusable and non-reusable inputs with `instanceKeys`. |
| `ratingOptions` | `Object` | `{}` | Rating options passed to the API. Defaults `executePricing` and `executeConfigurationRules` to `true`. |
| `transactionType` | `String` | — | The transaction type for the rating request |
| `contextId` | `String` | — | Input property for PATCH first scenario |

Rating inputs and options are based on the [Insurance Product Rating API](https://developer.salesforce.com/docs/atlas.en-us.insurance_developer_guide.meta/insurance_developer_guide/connect_resources_product_rating.htm%20%20).

## HTML Markup

### Side Panel Layout

Displays a tree navigation showing the product hierarchy, allowing users to select products/coverages to configure.

- First product selected as default
- Selected item highlights and drives the main area content

### Main Section Layout

Shows the selected product's details, attributes (read-only), and associated coverages with their configurable attributes.

**Attribute Details Card:**  
- Displays product title, attributes and price with tax info. 
- Product attributes grouped by category (read-only display)

**Coverages Card (conditional):**
- Displays if product has coverages
- When selected, expands to show editable coverage attributes
- Coverage attributes grouped by category in two-column layout

### Configuration Messages Layout
- Collapsible message notification area with toggle button
- Uses the product-configuration-message-item component

---

## Component Usage

Embed the productConfiguration LWC in an Omniscript by using the Custom Lightning Web Component element in a step.

### Adding to an OmniScript Step

1. Open your OmniScript in OmniStudio Designer  
2. Add a **Custom Lightning Web Component** element to your step  
3. Set the **LWC Component Name** to `c-product-configuration`  
4. Configure the component properties (see [Public Properties](#public-properties-api))

If you set `clearStateOnPrev` to `true`, hide the standard Previous and Next buttons in the step by reducing their width to 0\. The productConfiguration LWC shows Previous and Next buttons for navigation.

### Data Output Structure

The component outputs data to OmniScript via `omniUpdateDataJson()`:

```javascript
{ contextId: "contextId-123" }
```

---

## Troubleshooting

### Common Issues

| Issue | Possible Cause | Solution |
| :---- | :---- | :---- |
| "No products are available" | Rating API returned no products or ran into error | Verify `ratingInputs` are correct. |
| OmniscriptBaseMixin not found on component deployment | Missing Omniscript customization package | Ensure `omniscriptBaseMixin` and utility modules are deployed by following the [Prerequisites](../../../README.md#prerequisites). |
| Missing context or product details on rating call response | Wrong API version | Ensure that all components and supporting files use Salesforce API version **66.0** or later. |
| State not persisting | clearStateOnPrev is not set to true | Hide step buttons by setting width to 0 and set `clearStateOnPrev` to true. |

### Debugging

1. **Debug Logs:** Enable debug logs for the `InsuranceRatingApexService` class.  
2. **Browser console:**  The component logs errors to the console.  
3. **OmniScript data panel:**  Check the data JSON for output values.

## API Version

All components and supporting files must use Salesforce API version **66.0** or later.  