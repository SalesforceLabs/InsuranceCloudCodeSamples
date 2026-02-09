import LightningTreeGrid from "lightning/treeGrid";
import prodSelCustomTemplate from './productSelectionCustomTemplate.html';

export default class ProductSelectionCustomTreeGrid extends LightningTreeGrid {
    static customTypes = {
        customDataType: {
            template: prodSelCustomTemplate,
            standardCellLayout: true
        }
    };
}