// Product Selection Custom Labels
import ProdSelMinComparisonValidation from '@salesforce/label/c.ProdSelMinComparisonValidation';
import ProdSelMaxComparisonValidation from '@salesforce/label/c.ProdSelMaxComparisonValidation';
import ProdSelMaxMultiSelectValidation from '@salesforce/label/c.ProdSelMaxMultiSelectValidation';
import ProdSelMaxRootProductValidation from '@salesforce/label/c.ProdSelMaxRootProductValidation';
import ProdSelSelectionRequiredMsg from '@salesforce/label/c.ProdSelSelectionRequiredMsg';
import ProdSelNoProductsMsg from '@salesforce/label/c.ProdSelNoProductsMsg';
import ProdSelCompareBtn from '@salesforce/label/c.ProdSelCompareBtn';
import ProdSelDetails from '@salesforce/label/c.ProdSelDetails';
import ProdSelNext from '@salesforce/label/c.ProdSelNext';
import ProdSelPremium from '@salesforce/label/c.ProdSelPremium';
import ProdSelPrevious from '@salesforce/label/c.ProdSelPrevious';
import ProdSelProduct from '@salesforce/label/c.ProdSelProduct';
import ProdSelLoading from '@salesforce/label/c.ProdSelLoading';
import ProdSelCheckbox from '@salesforce/label/c.ProdSelCheckbox';
import ProdSelTaxAmount from '@salesforce/label/c.ProdSelTaxAmount';
import ProdSelFeeAmount from '@salesforce/label/c.ProdSelFeeAmount';

// Product Selection validation messages
export const VALIDATION_MESSAGES = {
    MIN_COMPARISON_VALIDATION: ProdSelMinComparisonValidation,
    MAX_COMPARISON_VALIDATION: ProdSelMaxComparisonValidation,
    MAX_MULTI_SELECT_PRODUCT_VALIDATION: ProdSelMaxMultiSelectValidation,
    MAX_ROOT_PRODUCT_VALIDATION: ProdSelMaxRootProductValidation,
    SELECTION_REQUIRED_MSG: ProdSelSelectionRequiredMsg,
    NO_PRODUCTS_MSG: ProdSelNoProductsMsg
};

export const LABELS = {
    CompareBtn: ProdSelCompareBtn,
    Details: ProdSelDetails,
    Next: ProdSelNext,
    Premium: ProdSelPremium,
    Previous: ProdSelPrevious,
    Product: ProdSelProduct,
    Loading: ProdSelLoading,
    Checkbox: ProdSelCheckbox,
    TaxAmount: ProdSelTaxAmount,
    FeeAmount: ProdSelFeeAmount
};

export const CONSTANTS = {
    // Component constants
    MIN_PRODUCTS_FOR_COMPARISON: '2',
    MAX_PRODUCTS_FOR_COMPARISON: '3',
    MAX_ROOT_PRODUCTS: 10,
    MAX_CHAR_LIMIT: 150,
    NULL_VALUE_PLACEHOLDER: '--',
    TRAILING_ELLIPSES: '...',
    REFERENCE_FIELD_ID: 'id',
    PICKER: {
        CHECKBOX: 'checkbox',
        RADIO: 'radio'
    }
};
