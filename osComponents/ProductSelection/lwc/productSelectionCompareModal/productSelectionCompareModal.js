import { api } from 'lwc';
import LightningModal from 'lightning/modal';
import ProdSelCompareProducts from '@salesforce/label/c.ProdSelCompareProducts';
import ProdSelCancel from '@salesforce/label/c.ProdSelCancel';

export default class ProductSelectionCompareModal extends LightningModal {
    @api gridData = [];
    @api gridColumns = [];

    labels = {
        CompareProducts: ProdSelCompareProducts,
        Cancel: ProdSelCancel
    };

    get hasGridData() {
        if (!this.gridData) {
            return false;
        }
        return this.gridData.length > 0;
    }

    handleCancel() {
        this.close({});
    }
}
