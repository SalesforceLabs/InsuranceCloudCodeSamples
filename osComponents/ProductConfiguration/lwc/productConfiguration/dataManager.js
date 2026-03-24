import { CONSTANTS } from './labelsAndConstants';

/**
 * Builds tree structure from contextJSON for lightning-tree component
 * @param {Object} contextJSON - The context JSON object
 * @param {Array} productDetails - The product details array (changed from object to array)
 * @returns {Array} - Clean tree structure array for lightning-tree component
 */
export function buildTreeFromContextJSON(contextJSON, productDetails) {
    // Create a map from productCode to productDetail for efficient lookup
    const productDetailsMap = (productDetails || []).reduce((acc, detail) => {
        if (detail.productCode) {
            acc[detail.productCode] = detail;
        }
        return acc;
    }, {});

    if (!contextJSON?.salesTransactions?.[0]?.salesTransactionItems) {
        return [];
    }
    const rootItems = contextJSON.salesTransactions[0].salesTransactionItems;
    const tree = rootItems
        .map(rootItem => {
            const itemData = rootItem.fields;
            if (itemData.ProductSpec === 'Coverage') {
                return null; // Skip root-level coverages
            }
            // Use AggregationKeyLevel1 for instance key (used by backend for pricing/configuration)
            const rootInstanceKey = itemData.AggregationKeyLevel1 || itemData.InstanceKey || itemData.id;
            return buildTreeNode(rootItem, productDetailsMap, [rootInstanceKey]);
        })
        .filter(item => item !== null); // Filter out the skipped items
    return tree;
}

/**
 * Helper function to get the instance key from aggregation key levels
 * @param {Object} fields - The STI fields object
 * @param {number} depth - Current depth level (1-based: 1 for root, 2 for children, etc.)
 * @returns {string} - The instance key for this level
 */
function getInstanceKeyForLevel(fields, depth) {
    const levelKey = `AggregationKeyLevel${depth}`;
    return fields[levelKey] || fields.InstanceKey || fields.id;
}

/**
 * Recursively builds a single node for the tree structure
 * @param {Object} salesTransactionItem - The sales transaction item object with fields, childNodes, etc.
 * @param {Object} productDetailsMap - Map of productCode to product details
 * @param {Array} instanceKeysPath - The path of instance keys from root to this node
 * @returns {Object} - A tree node object
 */
function buildTreeNode(salesTransactionItem, productDetailsMap, instanceKeysPath = []) {
    const itemData = salesTransactionItem.fields;
    const productDetail = productDetailsMap[itemData.ProductCode] || {};
    const childNodes = salesTransactionItem.childNodes || [];
    const currentDepth = instanceKeysPath.length;

    // Step 1: Recursively build all child items and extract coverages
    const childItems = [];
    const coverages = [];
    const selectedCoverageCodes = new Set();

    childNodes.forEach(childNode => {
        const childData = childNode.fields;
        // Check if it's a coverage by examining both ProductSpec and productSpecificationType
        const isCoverage = childData.ProductSpec === 'Coverage' ||
                          productDetailsMap[childData.ProductCode]?.productSpecificationType?.name === 'Coverage';

        if (isCoverage) {
            selectedCoverageCodes.add(childData.ProductCode);
            const coverageProductDetail = productDetailsMap[childData.ProductCode] || {};
            // For coverages, use the next aggregation level (current depth + 1)
            const coverageInstanceKey = getInstanceKeyForLevel(childData, currentDepth + 1);
            const coverageInstanceKeys = [...instanceKeysPath, coverageInstanceKey];
            coverages.push({
                key: childData.id,
                name: coverageProductDetail.name || childData.ProductName,
                productCode: childData.ProductCode,
                prcId: coverageProductDetail.productRelatedComponent?.id,
                stiId: childData.id, // Store the coverage's stiId for UI treatments
                isSelected: true,
                attributes: getAttributesWithDetails(childNode, coverageProductDetail),
                netUnitPrice: childData.NetUnitPrice,
                proratedQLITaxAmount: childData.ProratedQLITaxAmount,
                proratedQLIFeeAmount: childData.ProratedQLIFeeAmount__std,
                instanceKeys: coverageInstanceKeys,
                instanceKeysString: coverageInstanceKeys.join(',')
            });
        } else {
            // For child products, use the next aggregation level
            const childInstanceKey = getInstanceKeyForLevel(childData, currentDepth + 1);
            const childInstanceKeys = [...instanceKeysPath, childInstanceKey];
            childItems.push(buildTreeNode(childNode, productDetailsMap, childInstanceKeys));
        }
    });

    // Step 2: Create the current node
    const node = {
        label: itemData.CustomProductName || productDetail.name || itemData.ProductName || itemData.id,
        name: itemData.InstanceKey,
        id: itemData.id, // Store the id for navigation purposes
        expanded: false,
        items: childItems,
        productCode: itemData.ProductCode,
        attributes: getAttributesWithDetails(salesTransactionItem, productDetail),
        coverages,
        netUnitPrice: itemData.NetUnitPrice,
        proratedQLITaxAmount: itemData.ProratedQLITaxAmount,
        proratedQLIFeeAmount: itemData.ProratedQLIFeeAmount__std
    };

    // Step 3: Add unselected coverages from product details
    if (productDetail.productComponentGroups) {
        productDetail.productComponentGroups.forEach(group => {
            if (group.name === 'Coverages' && group.components) {
                group.components.forEach(comp => {
                    if (comp.productCode && !selectedCoverageCodes.has(comp.productCode)) {
                        // For unselected coverages, use a generated key based on product code
                        const unselectedKey = comp.name || comp.productCode;
                        const unselectedInstanceKeys = [...instanceKeysPath, unselectedKey];
                        // Get the full product detail for this coverage's productCode
                        const unselectedCoverageProductDetail = productDetailsMap[comp.productCode] || {};
                        node.coverages.push({
                            key: comp.productCode,
                            name: comp.name,
                            productCode: comp.productCode,
                            prcId: comp.productRelatedComponent?.id,
                            isSelected: false,
                            attributes: getAttributesWithDetails({fields: {}}, unselectedCoverageProductDetail),
                            instanceKeys: unselectedInstanceKeys,
                            instanceKeysString: unselectedInstanceKeys.join(',')
                        });
                    }
                });
            }
        });
    }
    return node;
}


/**
 * Resolves the attribute value based on data type and context
 * @param {Object} record - The attribute record from product details
 * @param {Object} contextAttr - The attribute from context JSON
 * @returns {*} - The resolved attribute value
 */
function resolveAttributeValue(record, contextAttr) {
    let value = null;

    // For picklist attributes, use AttributePicklistValue ID to lookup textValue from catalog
    if (record.dataType === 'PICKLIST' && contextAttr?.AttributePicklistValue) {
        const picklistOption = record.attributePickList?.values.find(
            option => option.id === contextAttr.AttributePicklistValue
        );
        value = picklistOption?.textValue ?? contextAttr?.AttributeValue ?? record.defaultValue ?? null;
    } else {
        // For non-picklist attributes, use AttributeValue directly
        value = contextAttr?.AttributeValue ?? record.defaultValue ?? null;
    }

    // Convert string boolean values to actual booleans for CHECKBOX dataType
    if (record.dataType === 'CHECKBOX') {
        value = normalizeCheckboxValue(value);
    }

    return value;
}

/**
 * Normalizes checkbox values to boolean
 * @param {*} value - The value to normalize
 * @returns {boolean} - The normalized boolean value
 */
function normalizeCheckboxValue(value) {
    if (value === null || value === undefined) {
        return false;
    }
    if (typeof value === 'string') {
        const lowerValue = value.toLowerCase().trim();
        if (lowerValue === 'true') {
            return true;
        }
        if (lowerValue === 'false') {
            return false;
        }
        return Boolean(value);
    }
    return value;
}

/**
 * Gets active picklist options from attribute record
 * @param {Object} record - The attribute record
 * @returns {Array} - Array of active picklist options
 */
function getActivePicklistOptions(record) {
    return record.attributePickList?.values
        .filter(p => p.status === 'Active')
        .map(p => ({
            label: p.label || p.displayValue,
            value: p.textValue,
            id: p.id
        })) || [];
}

/**
 * Determines data type and additional fields for lookups
 * @param {Object} record - The attribute record
 * @returns {Object} - Object containing dataType and additionalFields
 */
function getDataTypeAndFields(record) {
    let dataType = record.dataType;
    let additionalFields = null;

    if (record.additionalFields?.ReferenceObject &&
        record.additionalFields?.ReferenceFieldApiName?.toLowerCase() === CONSTANTS.REFERENCE_FIELD_ID) {
        dataType = 'lookup';
        additionalFields = {
            referenceObject: record.additionalFields.ReferenceObject,
            referenceField: record.additionalFields.ReferenceFieldApiName
        };
    }

    return { dataType, additionalFields };
}

/**
 * Builds an attribute object from a record and context
 * @param {Object} record - The attribute record from product details
 * @param {Object} contextAttr - The attribute from context JSON
 * @param {string|null} categoryName - The category name (null for uncategorized)
 * @returns {Object} - The formatted attribute object
 */
function buildAttributeObject(record, contextAttr, categoryName) {
    const value = resolveAttributeValue(record, contextAttr);
    const picklistOptions = getActivePicklistOptions(record);
    const { dataType, additionalFields } = getDataTypeAndFields(record);

    return {
        id: record.id,
        code: record.code,
        developerName: record.developerName,
        label: record.attributeNameOverride || record.name,
        value,
        dataType,
        additionalFields,
        displayTypeOverride: record.displayTypeOverride,
        valueDecoder: record.valueDecoder,
        minimumValue: record.minimumValue,
        maximumValue: record.maximumValue,
        stepValue: record.stepValue,
        isReadOnly: record.isReadOnly || false,
        isRequired: record.isRequired || false,
        categoryName,
        sequence: record.sequence,
        options: picklistOptions
    };
}

/**
 * Processes a single attribute record
 * @param {Object} record - The attribute record
 * @param {Object} contextAttributes - Map of context attributes
 * @param {string|null} categoryName - The category name (null for uncategorized)
 * @returns {Object|null} - The attribute object or null if should be skipped
 */
function processAttributeRecord(record, contextAttributes, categoryName) {
    // Only show attributes that are not hidden and have Active status
    if (record.hidden || record.status !== 'Active') {
        return null;
    }

    // Match by code (AttributeDefinitionCode) or developerName (AttributeDeveloperName)
    const contextAttr = contextAttributes[record.code] ?? contextAttributes[record.developerName];
    return buildAttributeObject(record, contextAttr, categoryName);
}

/**
 * Merges attributes from contextJSON with metadata from productDetails.
 * @param {Object} salesTransactionItem - The sales transaction item object with fields, attributes, etc.
 * @param {Object} productDetail - The product catalog data for the item.
 * @returns {Array} - An array of formatted attribute objects.
 */
function getAttributesWithDetails(salesTransactionItem, productDetail) {
    const attributes = [];

    // Build map using AttributeDefinitionCode (matches productDetails.code)
    const contextAttributes = (salesTransactionItem.salesTransactionItemAttributes || []).reduce((acc, attr) => {
        // In V2 API, attribute data is in attr.fields
        const attrFields = attr.fields || attr;
        // Prefer AttributeDefinitionCode, but fall back to AttributeDeveloperName as temporary workaround
        const attrKey = attrFields.AttributeDefinitionCode || attrFields.AttributeDeveloperName;
        if (attrKey) {
            // Store full attribute object to access both AttributeValue and AttributePicklistValue
            acc[attrKey] = attrFields;
        }
        return acc;
    }, {});

    // Process categorized attributes - exclude hidden and inactive attributes
    if (productDetail?.attributeCategories) {
        productDetail.attributeCategories.forEach(category => {
            category.records.forEach(record => {
                const attribute = processAttributeRecord(record, contextAttributes, category.name);
                if (attribute) {
                    attributes.push(attribute);
                }
            });
        });
    }

    // Process uncategorized attributes - exclude hidden and inactive attributes
    if (productDetail?.attributes) {
        productDetail.attributes.forEach(record => {
            const attribute = processAttributeRecord(record, contextAttributes, null);
            if (attribute) {
                attributes.push(attribute);
            }
        });
    }

    return attributes;
}


/**
 * Finds the selected tree node by name recursively.
 * @param {Array} treeItems - Array of tree items.
 * @param {string} selectedName - The selected tree item name.
 * @returns {Object|null} - The found tree node or null.
 */
export function findSelectedTreeNode(treeItems, selectedName) {
    for (const item of treeItems) {
        if (item.name === selectedName) {
            return item;
        }
        if (item.items && item.items.length > 0) {
            const childResult = findSelectedTreeNode(item.items, selectedName);
            if (childResult) {
                return childResult;
            }
        }
    }
    return null;
}

/**
 * Finds a tree node by id recursively.
 * @param {Array} treeItems - Array of tree items.
 * @param {string} id - The id to search for.
 * @returns {Object|null} - The found tree node or null.
 */
export function findTreeNodeById(treeItems, id) {
    for (const item of treeItems) {
        if (item.id === id) {
            return item;
        }
        if (item.items && item.items.length > 0) {
            const childResult = findTreeNodeById(item.items, id);
            if (childResult) {
                return childResult;
            }
        }
    }
    return null;
}

/**
 * Finds the instance keys path for a tree node by name recursively.
 * @param {Array} treeItems - Array of tree items.
 * @param {string} targetName - The name of the target node.
 * @param {Array} currentPath - The current path of instance keys.
 * @returns {Array|null} - The instance keys path or null if not found.
 */
export function findInstanceKeysForNode(treeItems, targetName, currentPath = []) {
    for (const item of treeItems) {
        const newPath = [...currentPath, item.name];
        if (item.name === targetName) {
            return newPath;
        }
        if (item.items && item.items.length > 0) {
            const childResult = findInstanceKeysForNode(item.items, targetName, newPath);
            if (childResult) {
                return childResult;
            }
        }
    }
    return null;
}
