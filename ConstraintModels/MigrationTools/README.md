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

