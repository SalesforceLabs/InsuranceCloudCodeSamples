# PCM Catalog — Personal Lines + Group Benefits

Captured verbatim from the Home (HO-3) and Auto product diagrams
shared on 2026-06-25, and the Medical PPO / Dental DPPO / Vision Plan
product diagrams shared on 2026-06-29.

## Taxonomy

Every product follows the same 4-level shape; the colour key in
the source diagrams maps 1:1 to this taxonomy.

| Level | Colour | Notes |
|---|---|---|
| **Root** | Purple | The top-level Root Product (e.g. "Home Root (HO-3)", "Auto Root"). |
| **Subject** | Blue | A "Product Classification" — IPA (Insurable Property Asset) or IPP (Insurable Person Profile). Coverages can branch off a Subject or off the Root directly. |
| **Coverage** | Pink | The named coverages exposed by the product. |
| **Attributes** | Yellow | Two kinds: Subject-level attributes (live on the IPA / IPP under the Subject box) and Coverage-level attributes (Limit / Deductible / Premium under each Coverage). |

Field-type shorthand used in the diagrams:

- `req` = required
- `opt` = optional
- `Text`, `Number`, `Currency`, `Date`, `Boolean`, `Picklist` — primitive types

---

## 1. Home Root (HO-3)

> Homeowners HO-3 — minimal OOTB. Coverages A-D branch off Property
> (IPA); coverages E-F branch off Root directly (they cover the
> Named Insured anywhere, not the structure).
>
> Common extensions (not modelled yet): Wind/Hail Deductible,
> Inflation Guard, Water Backup, Scheduled Personal Property,
> Service Line, Identity Theft, Earthquake.

### 1.1 Subjects

#### Property (IPA) — Subject lv 1

Property attributes:

| Field                 | Type     | Req | Picklist values |
|---|---|---|---|
| `PropertyStreet`      | Text     | req |  |
| `PropertyCity`        | Text     | req |  |
| `PropertyState`       | Picklist | req | US state |
| `PropertyZIP`         | Text     | req |  |
| `DwellingUsage`       | Picklist | opt | Primary / Secondary / Rental |
| `OccupancyType`       | Picklist | opt | Owner-Occupied / Tenant / Vacant |
| `DwellingType`        | Picklist | req | Single Family / Condo / Townhouse / Mobile |
| `YearBuilt`           | Number   | opt |  |
| `SquareFootage`       | Number   | opt |  |
| `Stories`             | Number   | opt |  |
| `ReplacementCostValue`| Currency | opt |  |
| `ConstructionType`    | Picklist | opt | Frame / Masonry / Mixed |
| `RoofType`            | Picklist | opt | Asphalt / Metal / Tile / Flat |
| `RoofAge`             | Number   | opt |  |
| `Foundation`          | Picklist | opt | Slab / Crawlspace / Basement |
| `Pool`                | Boolean  | opt |  |
| `NumberOfOccupants`   | Number   | opt |  |

#### Named Insured (IPP) — Subject lv 2

Named Insured attributes:

| Field          | Type          |
|---|---|
| `Name`         | Text          |
| `DOB`          | Date          |
| `MaritalStatus`| Picklist      |
| `PriorCarrier` | Text          |

### 1.2 Coverages

Off **Property (IPA)**:

| Code | Coverage | Attributes |
|---|---|---|
| A | Dwelling           | Limit, Deductible, Premium |
| B | Other Structures   | Limit, Premium             |
| C | Personal Property  | Limit, Deductible, Premium |
| D | Loss of Use        | Limit, Premium             |

Off **Root** (policy-level):

| Code | Coverage              | Attributes        |
|---|---|---|
| E | Personal Liability    | Limit, Premium    |
| F | Med Pay to Others     | Limit, Premium    |

---

## 2. Auto Root

> Personal Auto — minimal OOTB. Drivers are linked per Vehicle (auto
> rates apply per driver-vehicle pair). Vehicle subtree exposes
> Collision and Comprehensive; Driver subtree exposes Medical
> Payments. Policy-level coverages at Root: Bodily Injury, Property
> Damage, UM/UIM.

### 2.1 Subjects

#### Vehicle (IPA) — Subject lv 1

Vehicle attributes:

| Field                 | Type     | Req | Notes |
|---|---|---|---|
| `VIN`                 | Text     | req | 17-char |
| `Year`                | Number   | req |  |
| `Make`                | Text     | req |  |
| `Model`               | Text     | req |  |
| `AutoValue`           | Currency | opt |  |
| `PurchaseDate`        | Date     | opt |  |
| `AnnualMileage`       | Number   | opt |  |
| `GaragingZIPCode`     | Text     | opt |  |
| `AntiLockBrakes`      | Boolean  | opt |  |
| `DaytimeRunningLights`| Boolean  | opt |  |

#### Driver (IPP) — Subject lv 2

Driver attributes:

| Field             | Type     | Req | Picklist values / notes |
|---|---|---|---|
| `FirstName`       | Text     | req |  |
| `LastName`        | Text     | req |  |
| `DateOfBirth`     | Date     | req | Referenced from Contact attributes |
| `Gender`          | Picklist | opt |  |
| `MaritalStatus`   | Picklist | opt | Single / Married / Domestic Partner / Other |
| `Occupation`      | Text     | opt |  |
| `LicenseStatus`   | Picklist | req | Active / Suspended / International / None |
| `LicenseNumber`   | Text     | req |  |
| `LicenseState`    | Picklist | opt | US state |
| `AgeFirstLicensed`| Number   | opt |  |

### 2.2 Coverages

Off **Vehicle (IPA)**:

| Coverage      | Attributes                 |
|---|---|
| Collision     | Limit, Deductible, Premium |
| Comprehensive | Limit, Deductible, Premium |

Off **Driver (IPP)**:

| Coverage         | Attributes      |
|---|---|
| Medical Payments | Limit, Premium  |

Off **Root** (policy-level):

| Coverage                       | Attributes      |
|---|---|
| Liability — Bodily Injury      | Limit, Premium  |
| Liability — Property Damage    | Limit, Premium  |
| UM / UIM                       | Limit, Premium  |

---

## 3. Medical Root (Medical PPO)

> Group Medical — minimal OOTB. No Asset/IPA in EB. Member is the
> Subject. Coverage = plan type (Medical PPO ships OOTB) and carries
> plan-level rating attrs. Benefits = per-visit cost-sharing rows
> beneath the Coverage.

### 3.1 Subjects

#### Member (IPP) — Subject lv 1

Member attributes:

| Field           | Type     | Req | Notes |
|---|---|---|---|
| `Name`          | Text     | req |  |
| `DOB`           | Date     | req |  |
| `Gender`        | Picklist | opt |  |
| `Relationship` | Picklist | opt | Employee / Spouse / Child / Other |
| `EffectiveDate` | Date     | req |  |

### 3.2 Coverage (Medical PPO)

Off **Root** (plan-level):

| Field             | Type       | Notes |
|---|---|---|
| `Network`         | Picklist   | In-Network / Out-of-Network |
| `PlanYear`        | Picklist   |  |
| `Deductible_Ind`  | Currency   | Annual Deductible — Individual |
| `Deductible_Fam`  | Currency   | Annual Deductible — Family |
| `OOPMax_Ind`      | Currency   | Annual Out-of-Pocket — Individual |
| `OOPMax_Fam`      | Currency   | Annual Out-of-Pocket — Family |
| `CoinsurancePct`  | Percentage |  |

### 3.3 Benefits

Off **Coverage (Medical PPO)** — per-visit cost-sharing rows:

| Benefit                        | Attributes                                            |
|---|---|
| Preventive Care                | In-Network Coinsurance, Out-of-Network Coinsurance    |
| Primary Care                   | Copay, Coinsurance                                    |
| Specialist                     | Copay, Coinsurance                                    |
| Emergency Services             | Copay, Coinsurance                                    |
| Hospital (Inpatient/Outpatient) | Coinsurance                                          |
| Prescription Drugs             | Generic Copay, Brand Copay, Specialty Coinsurance     |

> Common extensions: HMO, EPO, POS, HDHP as additional Coverages.
> Benefits: Mental Health, Maternity, Diagnostic/Lab, Telehealth,
> Rehab, DME.

---

## 4. Dental Root (Dental DPPO)

> Group Dental — minimal OOTB. No IPA. Coverage = plan type (DPPO
> OOTB). Benefits = the 3-tier industry standard (Preventive / Basic
> / Major) + Ortho.

### 4.1 Subjects

#### Member (IPP) — Subject lv 1

Member attributes:

| Field           | Type     | Req | Notes |
|---|---|---|---|
| `Name`          | Text     | req |  |
| `DOB`           | Date     | req |  |
| `Relationship` | Picklist | opt | Employee / Spouse / Child / Other |
| `EffectiveDate` | Date     | req |  |

### 4.2 Coverage (Dental DPPO)

Off **Root** (plan-level):

| Field          | Type       | Notes |
|---|---|---|
| `Network`      | Picklist   | In-Network / Out-of-Network |
| `PlanYear`     | Picklist   |  |
| `AnnualMaximum`| Currency   |  |
| `Deductible`   | Currency   |  |

### 4.3 Benefits

Off **Coverage (Dental DPPO)**:

| Benefit                | Attributes                          |
|---|---|
| Preventive & Diagnostic| Coinsurance                         |
| Basic Services         | Coinsurance, Waiting Period         |
| Major Services         | Coinsurance, Waiting Period         |
| Orthodontia            | Coinsurance, Lifetime Maximum       |

> Common extensions: DHMO, Indemnity, Discount as additional
> Coverages. Benefits: TMJ, Pediatric Dental, Cosmetic discount.

---

## 5. Vision Root (Vision Plan)

> Group Vision — minimal OOTB. No IPA. Coverage = Vision Plan.
> Benefits = Exam / Frames / Lenses / Contacts.

### 5.1 Subjects

#### Member (IPP) — Subject lv 1

Member attributes:

| Field           | Type     | Req | Notes |
|---|---|---|---|
| `Name`          | Text     | req |  |
| `DOB`           | Date     | req |  |
| `Relationship` | Picklist | opt | Employee / Spouse / Child / Other |
| `EffectiveDate` | Date     | req |  |

### 5.2 Coverage (Vision Plan)

Off **Root** (plan-level):

| Field            | Type     | Notes |
|---|---|---|
| `Network`        | Picklist | In-Network / Out-of-Network |
| `PlanYear`       | Picklist |  |
| `ExamFrequency`  | Picklist | 12 / 24 months |
| `LensFrequency`  | Picklist | 12 / 24 months |
| `FrameFrequency` | Picklist | 12 / 24 months |

### 5.3 Benefits

Off **Coverage (Vision Plan)**:

| Benefit  | Attributes               |
|---|---|
| Eye Exam | Copay, Frequency         |
| Frames   | Allowance, Frequency     |
| Lenses   | Copay, Frequency         |
| Contacts | Allowance, Frequency     |

> Common extensions: Lens Enhancements, LASIK Discount, Contact Lens
> Fitting as benefits.

---

## 6. Common extensions (one-stop reference)

| Root              | Coverages (additional)            | Benefits (additional)                                   |
|---|---|---|
| Medical (PPO OOTB)| HMO, EPO, POS, HDHP               | Mental Health, Maternity, Diagnostic/Lab, Telehealth, Rehab, DME |
| Dental (DPPO OOTB)| DHMO, Indemnity, Discount         | TMJ, Pediatric Dental, Cosmetic discount               |
| Vision (Vision Plan OOTB) | —                         | Lens Enhancements, LASIK Discount, Contact Lens Fitting |

---

## 7. Integration notes

Maps cleanly into the workspace's LOB / LOC / Root Product cascade
(see `ROOT_PRODUCT_OPTIONS_BY_COVERAGE` in
`cumulus-app/src/modules/c/rfqPlaybookSetup/rfqPlaybookSetup.js` and
`ROOT_PRODUCTS_BY_LOB_LOC` in
`cumulus-app/src/modules/c/quoteCompareSetup/quoteCompareSetup.js`):

| Product       | LOB              | LOC    | Root Product code(s) currently wired in the workspace |
|---|---|---|---|
| Home (HO-3)   | `PERSONAL_LINES` | `HOME` | `HOME_ROOT` / `DWELLING_ROOT` / `RENTERS_ROOT` (rfq) · `pl_home_base` (comparison) |
| Auto          | `PERSONAL_LINES` | `AUTO` | `AUTO_ROOT` / `AUTO_BUNDLE_ROOT` / `MULTI_CAR_ROOT` (rfq) · `pl_auto_silver` / `pl_auto_gold` (comparison) |
| Medical PPO   | `GROUP_BENEFITS` | `MEDICAL` | `MEDICAL_PPO_ROOT` / `PPO_ROOT` / `FAMILY_PLAN_ROOT` / `GROUP_MEDICAL_ROOT` (rfq) · catalog root id `medical` (runtime) |
| Dental DPPO   | `GROUP_BENEFITS` | `DENTAL`  | `DENTAL_DPPO_ROOT` / `GROUP_DENTAL_ROOT` (rfq) · catalog root id `dental` (runtime) |
| Vision Plan   | `GROUP_BENEFITS` | `VISION`  | `VISION_PLAN_ROOT` / `GROUP_VISION_ROOT` (rfq) · catalog root id `vision` (runtime) |

If you need the workspace's Root Product list to surface the exact
`Home Root (HO-3)` / `Auto Root` / `Medical PPO Root` / `Dental DPPO Root` /
`Vision Plan Root` labels from this catalog, the two constants above
are the single source of truth — both can be updated to map directly
to the PCM identifiers in this file.
