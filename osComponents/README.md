# Insurance Omniscript Lightning Web Components for Salesforce Industries

A set of Lightning Web Components designed for insurance product selection workflows in Salesforce Industries. These components integrate with OmniScripts to enable users to view, compare, and select rated insurance products.

---

## Table of Contents

- [Overview](#overview)  
- [Prerequisites](#prerequisites)  
- [Installation](#installation)

---

## Overview

### Product Selection

The Product Selection components provide a complete solution for insurance product rating and selection within OmniScript flows. Key features include:

- **Product Rating Integration** – Calls the Salesforce Industries `createInsuranceRating` invocable action  
- **Single and Multi-Select Modes** – Support for selecting one or multiple products  
- **Product Comparison** – Side-by-side comparison modal for up to 3 products  
- **Custom Labels** – Fully translatable using Salesforce Custom Labels

---

## Prerequisites

Before deploying these components, complete these prerequisites.

- [ ] Make sure that your org has Digital Insurance licenses and complete the [setup](https://help.salesforce.com/s/articleView?id=ind.insurance_admin_setup.htm&type=5).  
- [ ] Deploy **Omniscript customization npm package** components. See [Set Up Your Environment to Customize Omniscript Elements](https://help.salesforce.com/s/articleView?id=xcloud.os_standard_set_up_your_environment_for_customizing_omniscript_elements.htm&type=5).  
- [ ]  Install the Salesforce CLI locally to deploy the components.

---

## Installation

### Step 1: Clone or Download the Repository

```shell
git clone <repository-url>
cd InsuranceCloudCodeSamples
```

### Step 2: Copy the Components to a Salesforce DX Project

Copy the contents under the apex, labels, and lwc folders from the OS LWC example folder to the respective folders in a Salesforce DX project authenticated to your org.

### Step 3: Deploy the Components

Deploy only the Product Selection components and their dependencies:

```shell
sf project deploy start \
  --source-dir force-app/main/default/classes/InsuranceRatingApexService.cls \
  --source-dir force-app/main/default/classes/InsuranceRatingApexService.cls-meta.xml \
  --source-dir force-app/main/default/labels/ProductSelectionLabels.labels \
  --source-dir force-app/main/default/lwc/productSelection \
  --source-dir force-app/main/default/lwc/productSelectionCompareModal \
  --source-dir force-app/main/default/lwc/productSelectionCustomTreeGrid \
  --source-dir force-app/main/default/lwc/productSelectionCustomTemplate \
  --target-org my-org
```

Or deploy the entire `force-app` directory:

```shell
sf project deploy start --source-dir force-app --target-org my-org
```

### Step 4: Verify Deployment

```shell
sf project deploy report --target-org my-org
```

---

## Dependencies

This component set depends on the following:

### OmniStudio Modules (must exist in org)

Follow the steps in [Prerequisites](#prerequisites) to retrieve and deploy the OS npm package.

### Salesforce Industries

- `createInsuranceRating` invocable action  
- `repriceInsuranceProduct` invocable action

---

## Support

For issues or questions related to these components:

1. Review the component-specific README at `force-app/main/default/lwc/productSelection/README.md.`  
2. Contact your Salesforce administrator or implementation partner.