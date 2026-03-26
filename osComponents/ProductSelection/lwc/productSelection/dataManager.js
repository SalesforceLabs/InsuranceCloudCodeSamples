import { LABELS, CONSTANTS } from './labelsAndConstants';

/**
 * @file This file contains utility functions for transforming insurance product data.
 * It provides methods to build a hierarchical tree structure from a JSON response
 * and then transform that tree into a format suitable for a tree grid component.
 */

export function buildTreeFromContextJSON(contextJSON, productDetails, uiTreatments = []) {
    if (!contextJSON?.salesTransactions?.[0]?.salesTransactionItems) {
        return [];
    }

    const treatments = _buildUiTreatmentsMap(uiTreatments);

    const productDetailsMap = Array.isArray(productDetails)
        ? new Map(productDetails.map(pd => [pd.productCode, pd]))
        : productDetails;

    const rootItems = contextJSON.salesTransactions[0].salesTransactionItems;
    const tree = rootItems
        .map(rootItem => {
            const itemData = rootItem.fields;
            const itemKey = itemData.InstanceKey || itemData.ProductCode;
            if (itemData.ProductSpec === 'Coverage') {
                return null;
            }
            return buildTreeNode(rootItem, itemKey, productDetailsMap, treatments);
        })
        .filter(item => item !== null);
    return tree;
}

function buildTreeNode(item, itemKey, productDetails, treatments) {
    const itemData = item.fields;
    const productDetail = (productDetails instanceof Map)
        ? productDetails.get(itemData.ProductCode) || {}
        : productDetails[itemData.ProductCode] || {};
    const childNodes = item.childNodes || [];

    const childItems = [];
    const coverages = [];
    const selectedCoverageCodes = new Set();

    childNodes.forEach(childNode => {
        const childData = childNode.fields;
        const childKey = childData.InstanceKey || childData.ProductCode;

        if (childData.ProductSpec === 'Coverage') {
            selectedCoverageCodes.add(childData.ProductCode);
            const coverageProductDetail = (productDetails instanceof Map)
                ? productDetails.get(childData.ProductCode) || {}
                : productDetails[childData.ProductCode] || {};
            const prcId = childNode.salesTransactionItemRelationships?.[0]?.fields?.ProductRelatedComponent || null;

            const coverageNode = {
                key: childKey,
                name: coverageProductDetail.name || childData.ProductName,
                productCode: childData.ProductCode,
                isSelected: true,
                price: childData.NetUnitPrice,
                taxAmount: childData.ProratedQLITaxAmount,
                feeAmount: childData.ProratedQLIFeeAmount__std,
                attributes: getAttributesWithDetails(childNode, coverageProductDetail, treatments),
                id: childData.id,
                prcId
            };

            const stiId = itemData.id;
            const isComponentHidden = prcId && treatments.hiddenComponents.get(stiId)?.has(prcId);
            if (isComponentHidden) {
                coverageNode.price = '--';
                coverageNode.attributes.forEach(attr => {
                    attr.value = '--';
                });
            }

            coverages.push(coverageNode);
        } else {
            childItems.push(buildTreeNode(childNode, childKey, productDetails, treatments));
        }
    });

    const prcId = item.salesTransactionItemRelationships?.[0]?.fields?.ProductRelatedComponent || null;

    const node = {
        id: itemData.id,
        instanceKey: itemData.InstanceKey,
        label: itemData.CustomProductName || productDetail.name || itemData.ProductName || itemKey,
        description: productDetail.description,
        customProductName: itemData.CustomProductName,
        price: itemData.NetUnitPrice,
        taxAmount: itemData.ProratedQLITaxAmount,
        feeAmount: itemData.ProratedQLIFeeAmount__std,
        hasEmptyPrice: itemData.NetUnitPrice === null || itemData.NetUnitPrice === undefined,
        name: itemKey,
        expanded: false,
        items: childItems,
        productCode: itemData.ProductCode,
        attributes: getAttributesWithDetails(item, productDetail, treatments),
        coverages,
        prcId
    };

    if (productDetail.productComponentGroups) {
        productDetail.productComponentGroups.forEach(group => {
            if (group.name === 'Coverages' && group.components) {
                group.components.forEach(comp => {
                    if (comp.productCode && !selectedCoverageCodes.has(comp.productCode)) {
                        node.coverages.push({
                            key: comp.productCode,
                            name: comp.name,
                            productCode: comp.productCode,
                            isSelected: false,
                            price: comp.NetUnitPrice,
                            attributes: getAttributesWithDetails({}, comp, treatments)
                        });
                    }
                });
            }
        });
    }
    return node;
}

function _buildUiTreatmentsMap(uiTreatments = []) {
    const treatments = {
        hiddenComponents: new Map(),
        hiddenAttributes: new Map(),
        hiddenPicklistValues: new Map()
    };

    if (uiTreatments && Array.isArray(uiTreatments)) {
        uiTreatments.forEach(treatment => {
            const { uiTreatmentType, uiTreatmentTarget, details } = treatment;
            if (!details || uiTreatmentType.toLowerCase() !== 'hide') {
                return;
            }

            if (uiTreatmentTarget.toLowerCase() === 'component') {
                const { stiId, prcId } = details;
                if (!stiId || !prcId) {
                    return;
                }

                if (!treatments.hiddenComponents.has(stiId)) {
                    treatments.hiddenComponents.set(stiId, new Set());
                }
                treatments.hiddenComponents.get(stiId).add(prcId);
            }

            if (uiTreatmentTarget.toLowerCase() === 'attribute') {
                const { stiId, attributeId } = details;
                if (!stiId || !attributeId) {
                    return;
                }

                if (!treatments.hiddenAttributes.has(stiId)) {
                    treatments.hiddenAttributes.set(stiId, new Set());
                }
                treatments.hiddenAttributes.get(stiId).add(attributeId);
            }

            if (uiTreatmentTarget.toLowerCase() === 'attribute_picklist_value') {
                const { stiId, attributeId, attributePicklistValueId } = details;
                if (!stiId || !attributeId || !attributePicklistValueId) {
                    return;
                }

                if (!treatments.hiddenPicklistValues.has(stiId)) {
                    treatments.hiddenPicklistValues.set(stiId, new Map());
                }
                const stiMap = treatments.hiddenPicklistValues.get(stiId);
                if (!stiMap.has(attributeId)) {
                    stiMap.set(attributeId, new Set());
                }
                stiMap.get(attributeId).add(attributePicklistValueId);
            }
        });
    }
    return treatments;
}

function getAttributesWithDetails(item, productDetail, treatments) {
    const attributes = [];
    const contextAttributes = (item.salesTransactionItemAttributes || []).reduce((acc, attrWrapper) => {
        const attr = attrWrapper.fields;
        acc[attr.AttributeDeveloperName] = attr;
        return acc;
    }, {});

    const stiId = item.fields?.id;
    const hiddenAttributes = treatments.hiddenAttributes?.get(stiId) || new Set();
    const hiddenPicklistValues = treatments.hiddenPicklistValues?.get(stiId) || new Map();

    if (productDetail) {
        const allAttributeRecords = [];
        productDetail.attributeCategories?.forEach(category => {
            if (category.records) {
                allAttributeRecords.push(...category.records);
            }
        });
        if (productDetail.attributes) {
            allAttributeRecords.push(...productDetail.attributes);
        }
        allAttributeRecords.sort((a, b) => {
            const seqA = a.sequence;
            const seqB = b.sequence;

            if (seqA != null && seqB != null) {
                return seqA - seqB;
            }
            if (seqA != null && seqB == null) {
                return -1;
            }
            if (seqA == null && seqB != null) {
                return 1;
            }
            return 0;
        });
        allAttributeRecords.forEach(record => {
            if (record.hidden !== true && record.status === 'Active') {
                const attr = retrieveAttributeDetails(contextAttributes, hiddenAttributes, hiddenPicklistValues, record);
                attributes.push(attr);
            }
        });
    }
    return attributes;
}

function _processPicklistAttribute(attr, record, hiddenPicklistValues) {
    attr.picklistDataType = record.attributePickList?.dataType ? record.attributePickList.dataType : null;

    const selectedOption = (record.attributePickList?.values || []).find(picklistValue => picklistValue.textValue === attr.value);
    if (selectedOption?.status !== 'Active') {
        attr.value = '--';
    }

    const hiddenValuesForAttr = hiddenPicklistValues.get(record.id) || new Set();
    if (hiddenValuesForAttr.size > 0) {
        if (selectedOption && hiddenValuesForAttr.has(selectedOption.id)) {
            attr.value = '--';
        }
        attr.options = attr.options.filter(option => !hiddenValuesForAttr.has(option.id));
    }
}

function retrieveAttributeDetails(contextAttributes, hiddenAttributes, hiddenPicklistValues, record) {
    const isAttributeHidden = hiddenAttributes.has(record.id);

    const contextAttr = contextAttributes[record.developerName];
    const value = contextAttr?.AttributeValue ?? record.defaultValue ?? null;

    let dataType = record.dataType;
    let additionalFields = null;
    if (record.additionalFields?.ReferenceObject && record.additionalFields?.ReferenceFieldApiName?.toLowerCase() === CONSTANTS.REFERENCE_FIELD_ID) {
        dataType = 'lookup';
        additionalFields = {
            referenceObject: record.additionalFields.ReferenceObject,
            referenceField: record.additionalFields.ReferenceFieldApiName
        };
    }

    const attr = {
        id: record.developerName,
        developerName: record.developerName,
        label: record.attributeNameOverride || record.name,
        value,
        dataType,
        isReadOnly: record.isReadOnly || false,
        additionalFields,
        options: (record.attributePickList?.values || [])
        .filter(picklistValue => picklistValue.status === 'Active')
        .map(picklistValue => ({
            label: picklistValue.label || picklistValue.displayValue,
            value: picklistValue.textValue,
            id: picklistValue.id
        }))
    };

    if (isAttributeHidden) {
        attr.value = '--';
        attr.isReadOnly = true;
    }

    if (attr.dataType === 'PICKLIST') {
        _processPicklistAttribute(attr, record, hiddenPicklistValues);
    }

    attr.options = attr.options.map(option => ({ label: option.label, value: option.value }));

    return attr;
}

function _processAttributes(attributes, planName, currentLevelMap) {
    attributes.forEach(attr => {
        const attrKey = attr.id;
        if (!attrKey) {
            return;
        }

        let entry = currentLevelMap.get(attrKey);
        if (!entry) {
            entry = {
                type: 'attribute',
                label: attr.label,
                productCode: attrKey,
                dataType: attr.dataType,
                additionalFields: attr.additionalFields,
                values: new Map(),
                children: new Map()
            };
            currentLevelMap.set(attrKey, entry);
        }

        let displayValue = attr.value;
        if (attr.dataType === 'PICKLIST' && attr.options && attr.value !== null) {
            const option = attr.options.find(opt => opt.value === attr.value);
            if (option) {
                if (attr.picklistDataType?.toLowerCase() === 'currency' && (!option.label || option.label === option.value)) {
                    entry.dataType = attr.picklistDataType;
                } else {
                    displayValue = option.label;
                }
            }
        }

        entry.values.set(planName, displayValue);
    });
}

function _processNode(node, planName, currentLevelMap) {
    const nodeKey = node.customProductName || node.productCode || node.instanceKey;
    const nodeLabel = node.label || node.name || node.instanceKey;

    if (!nodeKey) {
        return;
    }

    let entry = currentLevelMap.get(nodeKey);
    if (!entry) {
        entry = {
            type: 'product',
            label: nodeLabel,
            productCode: node.productCode,
            prices: new Map(),
            taxAmounts: new Map(),
            feeAmounts: new Map(),
            children: new Map(),
        };
        currentLevelMap.set(nodeKey, entry);
    }
    if (node.price !== undefined) {
        entry.prices.set(planName, node.price);
    }
    if (node.taxAmount !== undefined) {
        entry.taxAmounts.set(planName, node.taxAmount);
    }
    if (node.feeAmount !== undefined) {
        entry.feeAmounts.set(planName, node.feeAmount);
    }

    if (node.attributes && node.attributes.length > 0) {
        _processAttributes(node.attributes, planName, entry.children);
    }

    const allChildren = [...(node.coverages || []), ...(node.items || [])];
    allChildren.forEach(child => {
        _processNode(child, planName, entry.children);
    });
}


function _hasAnyPriceForPlans(value, planNames) {
    if (!value.prices || value.prices.size === 0) {
        return false;
    }
    return planNames.some(planName => value.prices.has(planName));
}

function _buildGridRowsRecursive(map, parentId, planNames, currencyCode, parentValue = null) {
    const rows = [];
    let index = 1;
    for (const value of map.values()) {
        if (value.type !== 'product' || _hasAnyPriceForPlans(value, planNames)) {
            const id = parentId ? `${parentId}-${index}` : `${index}`;
            const isAttribute = value.type === 'attribute';
            const row = {
                id,
                Product: isAttribute ? '' : value.label,
                Details: isAttribute ? value.label : LABELS.Premium,
            };

            planNames.forEach(planName => {
                if (value.type === 'attribute') {
                    const parentExistsInPlan = !parentValue || (parentValue.prices && parentValue.prices.has(planName));
                    const attrValue = value.values.get(planName);
                    const type = _getCellTypeFromDataType(value.dataType);
                    row[planName] = {
                        value: parentExistsInPlan && (attrValue !== null && attrValue !== undefined) ? attrValue : '--',
                        type,
                        currencyIsoCode: type === 'currency' ? currencyCode : undefined,
                        additionalFields: value.additionalFields
                    };
                } else {
                    const price = value.prices.get(planName);
                    row[planName] = {
                        value: typeof price === 'number' ? price : '--',
                        type: typeof price === 'number' ? 'currency' : 'text',
                        currencyIsoCode: currencyCode,
                    };
                }
            });

            // Create tax and fee rows for products/coverages (not attributes)
            const additionalRows = [];
            if (value.type === 'product') {
                // Create Tax Amount row
                const taxRow = {
                    id: `${id}-tax`,
                    Product: '',
                    Details: LABELS.TaxAmount,
                };
                planNames.forEach(planName => {
                    const taxAmount = value.taxAmounts.get(planName);
                    taxRow[planName] = {
                        value: typeof taxAmount === 'number' ? taxAmount : '--',
                        type: typeof taxAmount === 'number' ? 'currency' : 'text',
                        currencyIsoCode: currencyCode,
                    };
                });
                additionalRows.push(taxRow);

                // Create Fee Amount row
                const feeRow = {
                    id: `${id}-fee`,
                    Product: '',
                    Details: LABELS.FeeAmount,
                };
                planNames.forEach(planName => {
                    const feeAmount = value.feeAmounts.get(planName);
                    feeRow[planName] = {
                        value: typeof feeAmount === 'number' ? feeAmount : '--',
                        type: typeof feeAmount === 'number' ? 'currency' : 'text',
                        currencyIsoCode: currencyCode,
                    };
                });
                additionalRows.push(feeRow);
            }

            if (value.children && value.children.size > 0) {
                row._children = _buildGridRowsRecursive(value.children, id, planNames, currencyCode, value);
                // Add tax and fee rows to children
                if (additionalRows.length > 0) {
                    row._children = [...additionalRows, ...row._children];
                }
                if (row._children.length === 0 && value.type === 'product' && !_hasAnyPriceForPlans(value, planNames)) {
                } else {
                    rows.push(row);
                    index++;
                }
            } else {
                // Add tax and fee rows as children even if no other children exist
                if (additionalRows.length > 0) {
                    row._children = additionalRows;
                }
                rows.push(row);
                index++;
            }
        }
    }
    return rows;
}

function _getCellTypeFromDataType(dataType) {
    if (!dataType) {
        return 'text';
    }
    const lowerDataType = dataType.toLowerCase();
    switch (lowerDataType) {
        case 'date':
        case 'datetime':
        case 'currency':
        case 'percent':
        case 'lookup':
            return lowerDataType;
        default:
            return 'text';
    }
}

export function transformTreeToGrid(enhancedTree, currencyIsoCode) {
    if (!enhancedTree || enhancedTree.length === 0) {
        return { gridColumns: [], gridData: [] };
    }

    const planNames = enhancedTree.map(root => root.name);

    const dynamicColumns = enhancedTree.map(rootNode => ({
        label: rootNode.label,
        fieldName: rootNode.name,
        type: 'customDataType',
    }));

    const gridColumns = [
        { label: LABELS.Product, fieldName: 'Product', type: 'text', treeColumn: true },
        { label: LABELS.Details, fieldName: 'Details', type: 'text' },
        ...dynamicColumns,
    ];

    const aggregatedMap = new Map();

    const rootAttributesMap = new Map();
    enhancedTree.forEach(rootProduct => {
        if (rootProduct.attributes && rootProduct.attributes.length > 0) {
            _processAttributes(rootProduct.attributes, rootProduct.name, rootAttributesMap);
        }
    });

    enhancedTree.forEach(rootProduct => {
        const allChildren = [...(rootProduct.coverages || []), ...(rootProduct.items || [])];
        allChildren.forEach(childNode => {
            _processNode(childNode, rootProduct.name, aggregatedMap);
        });
    });

    const productRows = _buildGridRowsRecursive(aggregatedMap, '', planNames, currencyIsoCode);

    const totalPriceRow = {
        id: '0',
        Product: '',
        Details: LABELS.Premium
    };
    planNames.forEach(planName => {
        const rootProduct = enhancedTree.find(p => p.name === planName);
        const price = rootProduct ? rootProduct.price : undefined;
        totalPriceRow[planName] = {
            value: typeof price === 'number' ? price : '--',
            type: typeof price === 'number' ? 'currency' : 'text',
            currencyIsoCode
        };
    });

    // Create a row for tax amount of each plan
    const totalTaxRow = {
        id: '0-tax',
        Product: '',
        Details: LABELS.TaxAmount
    };
    planNames.forEach(planName => {
        const rootProduct = enhancedTree.find(p => p.name === planName);
        const taxAmount = rootProduct ? rootProduct.taxAmount : undefined;
        totalTaxRow[planName] = {
            value: typeof taxAmount === 'number' ? taxAmount : '--',
            type: typeof taxAmount === 'number' ? 'currency' : 'text',
            currencyIsoCode
        };
    });

    // Create a row for fee amount of each plan
    const totalFeeRow = {
        id: '0-fee',
        Product: '',
        Details: LABELS.FeeAmount
    };
    planNames.forEach(planName => {
        const rootProduct = enhancedTree.find(p => p.name === planName);
        const feeAmount = rootProduct ? rootProduct.feeAmount : undefined;
        totalFeeRow[planName] = {
            value: typeof feeAmount === 'number' ? feeAmount : '--',
            type: typeof feeAmount === 'number' ? 'currency' : 'text',
            currencyIsoCode
        };
    });

    const rootAttributeRows = _buildGridRowsRecursive(rootAttributesMap, '0', planNames, currencyIsoCode, null);

    const gridData = [totalPriceRow, totalTaxRow, totalFeeRow, ...rootAttributeRows, ...productRows];

    return { gridColumns, gridData };
}
