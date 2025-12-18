# Salesforce Labs – Digital Insurance Constraint Rule Engine Examples

The **Salesforce Labs Insurance Examples Repository** provides examples that demonstrate how to implement governance for Digital Insurance product configuration using the Constraint Rule Engine and Constraint Modeling Language (CML).

These assets are designed for:

- Salesforce Admins & Product Owners
- Insurance IT Developers
- System Integrators implementing Digital Insurance Policy Admin
- Architects defining governance for product configuration at scale

The examples in this repository showcase best practices, validated integration patterns, and ready-to-deploy CML rule sets aligned to Salesforce Engineering standards.

---

# Overview

The Constraint Rule Engine and Advanced Configurator provide a governance layer on top of the Standard Configurator, ensuring that product configuration stays compliant, validated, and consistent across quotes. This repository delivers a complete baseline implementation, including:

- Certified CML rule sets (“Golden Examples”)
- Sample product models and data assets
- Org-to-org migration utilities
- Documentation and guides

These tools are designed to accelerate your implementation, reduce onboarding time with CML, and provide a reliable foundation for extending Insurance product configuration.

---

# Directory Contents

The directory contains examples, product models, and tools.

## Golden Example CML Rule Sets

Pre-built, Engineering-certified rule CMLs that demonstrate:

- Best practices for CML syntax and structure
- How to enforce configuration rules as Admin/Product Designer
- Real-world Insurance scenarios (e.g., required coverages, disallowed combinations, preset attributes)

These examples cover Auto Insurance, Medical Insurance, and Commercial Insurance, and are fully production-validated and serve as baseline templates for customer customization.

---

## Product Models & Supporting Metadata

Each rule set comes with Salesforce Product Hierarchy metadata such as:

- Product Definitions
- Attribute Categories
- Attribute Definitions
- Picklists
- Relationship metadata needed for rule evaluation

These assets are provided to ensure that each CML rule set is functional and testable when deployed into a fresh environment.

---

## Migration Tools

Migration tools enable you to move data between orgs while preserving metadata and its hierarchy.

### CML Migration Tool

THe CML Migration Tool is a command-line + UI utility that enables:

- Import/export of CML rule sets
- CML Deployment across orgs
- Standard Configurator Rules to Constraint Engine Rules (WIP)

### Product Hierarchy Migration Tool (Multi Cloud Data Migrator)

The Product Hierarchy Migration Tool ensures that product model data remains consistent across orgs, enabling:

- Reliable replication of Insurance product hierarchy
- Automated or semi-automated org-to-org transfer
- Dependency-aware sequencing of metadata and data

---

## Documentation & Guides

The documentation covers:

- How CML works
- Sample Product Hierarchy Visualization
- Setup instructions
- Best practices for CML