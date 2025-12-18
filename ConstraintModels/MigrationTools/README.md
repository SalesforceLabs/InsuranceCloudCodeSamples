# Migration Tools for Digital Insurance Constraint Engine

This directory contains utilities designed to streamline the deployment and migration of Constraint Rule Engine assets across Salesforce orgs. These tools enable you to efficiently move CML rule sets and associated product model metadata between your instances:

- Migrate CML rule sets from one org to another
- Transfer complete product hierarchies with all dependencies intact
- Transform standard/legacy configuration rules to constraints

Before using these tools:

* Install [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli)
* Ensure you have: 
  - Digital Insurance product licenses configured in target orgs
  - Constraint Rule Engine enabled in target orgs (for CML migrations)
  - Appropriate API access and authentication credentials

Before using the CML Migration Tool, make sure the target org already has relevant Context Definition and PCM data such as Attributes, Product Classifications, Products, and Product Related Components.

---

## Available Tools

### [CML Migration Tool](https://github.com/gkibilov/cml-migration/tree/main)

The **CML Migration Tool** enables seamless import, export, and deployment of Constraint Modeling Language (CML) rule sets across Salesforce orgs:

- Moving rule sets from sandbox to production environments
- Updating the existing rule sets
- Creating backups of your CML configurations
- Sharing rule set templates across multiple orgs


#### How to Use the CML Migration Tool

1. Authorize the source org and target org:
   ```
   sf auth:web:login --instance-url https://<source-instance>.salesforce.com -a srcOrg
   sf auth:web:login --instance-url https://<target-instance>.salesforce.com -a tgtOrg
   ```
1. Check the connection: ```sf org list```
1. Export from the source org: ```python export_cml.py --developerName [Constraint Model API Name]```.
1. Import to the target org: ```python import_cml.py```


   🔧 Requirements

- Python 3.9+
- Salesforce CLI (sf)
- Connected orgs with accessible metadata API
---

### [Multi Cloud Data Migrator for Product Models](https://github.com/sf-mcdm/multi-cloud-data-migrator)

The **Multi Cloud Data Migrator** is a comprehensive tool for migrating Insurance product hierarchy metadata and data across orgs. It ensures that all components of your product model remain consistent during transfer:

- Product Definitions and hierarchies(Product Related Components)
- Attribute Categories and Definitions
- Picklist and Picklist Values
- Pricebook Entries
- [and more...](#sobject-keys-reference) 

  **Key Features:**
- Dependency-aware sequencing prevents broken references
- Automated or semi-automated migration workflows
- Support for complex product hierarchies
- Validation to ensure data integrity post-migration

#### How to Use the Multi Cloud Data Migrator

1. Install the Multi Cloud Data Migrator Plugin: ```sf plugins install sf-mcdm/multi-cloud-data-migrator```
1. Authorize the source org and target org:
   ```
   sf auth:web:login --instance-url https://<source-instance>.salesforce.com -a srcOrg
   sf auth:web:login --instance-url https://<target-instance>.salesforce.com -a tgtOrg
   ```
1. Check the connection: ```sf org list```
1. Open the Web App user interface: ```sf multi-cloud-data-migrator:ui```
1. Choose **Deep Clone Migration Plan** and **Revenue-Cloud-Advanced-Product**
1. Input your source and target org, and the root product's Stock Keeping Unit (SKU). You can enter multiple SKUs separated by commas.
1. Click **View Plan** and make sure all Key fields in the SObject are populated. **NOTE**: This is very important for clean product structure migration. See the **SObject Keys Reference**.
1. Click **Start Migration**, you can monitor the progress in the **Job Monitor** tab, and view issues in the **Failure and Skipped Files** tab.

#### SObject Keys Reference

For a successful migration, it's critical to ensure your data is clean and properly prepared.

- Check Your Keys: Use the **View Plan** button to review the migration strategy.
- Ensure Uniqueness: Verify that all Key fields and composite key combinations are populated and unique in the source data.
- Validate Data: Duplicate or missing keys will cause records to be skipped or linked incorrectly. 

The migration will not run as expected if the underlying data quality is poor.


  | SObject                        | Key                                                                                      |
  | ------------------------------ | ---------------------------------------------------------------------------------------- |
  | UnitOfMeasureClass             | Code                                                                                     |
  | UnitOfMeasure                  | Name                                                                                     |
  | UnitOfMeasureClass             | Code                                                                                     |
  | AttributeCategory              | Code                                                                                     |
  | AttributePicklist              | Name                                                                                     |
  | AttributePicklistValue         | Code                                                                                     |
  | AttributeDefinition            | Code                                                                                     |
  | AttributeCategoryAttribute     | AttributeCategory.Code, AttributeDefinition.Code                                         |
  | ProductClassification          | Code                                                                                     |
  | ProductClassificationAttr      | AttributeDefinition.Code, ProductClassification.Code                                     |
  | ProductSpecificationType       | DeveloperName                                                                            |
  | ProductSpecificationRecType    | DeveloperName                                                                            |
  | Product2                       | StockKeepingUnit                                                                         |
  | ProductAttributeDefinition     | AttributeDefinitionId, Product2Id, ProductClassificationAttributeId                      |
  | Product2DataTranslation        | Parent.StockKeepingUnit, Language                                                        |
  | CostBook                       | Name                                                                                     |
  | CostBookEntry                  | CostBook.Name, Product.StockKeepingUnit                                                  |
  | Pricebook2                     | Name                                                                                     |
  | ProrationPolicy                | Name                                                                                     |
  | ProductSellingModel            | Name                                                                                     |
  | ProductSellingModelOption      | ProductSellingModel.Name, Product2.StockKeepingUnit                                      |
  | PricebookEntry                 | ProductSellingModel.Name, Product2.StockKeepingUnit, Pricebook2.Name                     |
  | ProductCatalog                 | Code                                                                                     |
  | ProductCategory                | Code                                                                                     |
  | ProductCategoryDataTranslation | Parent.Code, Language                                                                    |
  | ProductCategoryProduct         | ProductCategory.Code, Product.StockKeepingUnit                                           |
  | ProductComponentGroup          | Code                                                                                     |
  | ProductComponentGrpOverride    | OverrideContext.Name, ProductComponentGroup.Code                                         |
  | ProductRelatedComponent        | ParentProduct.StockKeepingUnit, ProductComponentGroup.Code, ProductRelationshipType.Name |
  | ProductRelComponentOverride    | OverrideContext.Name, ProductRelatedComponentId                                          |
  | PriceAdjustmentSchedule        | Name                                                                                     |
  | PriceAdjustmentTier            | PriceAdjustmentSchedule.Name, Product2.StockKeepingUnit                                  |
  | BundleBasedAdjustment          | PriceAdjustmentSchedule.Name, ParentProduct.StockKeepingUnit, Product.StockKeepingUnit   |
  | AttributeBasedAdjRule          | Name                                                                                     |
  | AttributeAdjustmentCondition   | AttributeBasedAdjRule.Name, AttributeDefinition.Name, Product.StockKeepingUnit           |
  | AttributeBasedAdjustment       | AttributeBasedAdjRule.Name, PriceAdjustmentSchedule.Name, Product.StockKeepingUnit       |
  | ProductConfigurationFlow       | FlowIdentifier                                                                           |
  | ProductConfigFlowAssignment    | ProductConfigurationFlow.FlowIdentifier                                                  |

---

## Support and Troubleshooting

If you encounter issues during migration:

- Check the Failure/Skip log.
- Verify that all prerequisites are met in the target org.
- Ensure that product model metadata exists before migrating dependent CML rules.

For additional support, refer to the main repository documentation or contact Salesforce support.

---

## Additional Resources

- [Main Repository README](../README.md)
- [Example CML Rule Sets](../ExampleCMLRuleSets/README.md)
- [Product Models Documentation](../ProductModels/README.md)

