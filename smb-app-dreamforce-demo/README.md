# RFQ — Summit Brokerage (Insurance)

An SLDS-compliant **Create RFQ** flow for an insurance brokerage, ported from the `rfq-create.html` reference. Two artifacts ship side by side:

1. **`preview/rfq-create.html`** — the original full-fidelity reference (4-step wizard, Einstein panel, carrier picker, ACORD forms, email composer, quote comparison, binding). Open it directly in a browser to interact with the full mockup.
2. **`force-app/main/default/lwc/rfqCreate/`** — a deployable Lightning Web Component that mirrors **Step 1 — Create RFQ** of the reference using real SLDS components, the same data model, and event-based handoff to a host page.

> Why two artifacts? The reference is a single 7.6k-line HTML prototype that's perfect for design review. The LWC carves out Step 1 — the actual "Create RFQ" surface — as a production-deployable starting point. Steps 2-4 (Publish to Carriers / Compare Quotes / Bind Policy) and the Einstein-assist flow live in the reference today and will become their own LWCs.

## Structure

```
.
├── sfdx-project.json
├── force-app/main/default/lwc/
│   ├── rfqConstants/                 ← shared catalogs (line item types, coverages, mock accounts)
│   │   ├── rfqConstants.js
│   │   └── rfqConstants.js-meta.xml
│   └── rfqCreate/                    ← Step 1 — Create RFQ
│       ├── rfqCreate.html
│       ├── rfqCreate.js
│       ├── rfqCreate.css
│       └── rfqCreate.js-meta.xml
├── preview/
│   └── rfq-create.html               ← full reference, open in browser
└── README.md
```

## Preview locally

```bash
open preview/rfq-create.html
```

or serve the folder if you want stable host-relative URLs:

```bash
npx serve preview
# → http://localhost:3000/rfq-create.html
```

## Deploy the LWC

```bash
sf project deploy start --source-dir force-app
```

`rfqCreate` is exposed on:

- `lightning__AppPage`
- `lightning__RecordPage`
- `lightning__HomePage`
- `lightningCommunity__Page` (Experience Cloud)

## What's in Step 1 (the LWC)

| Block | Purpose |
| --- | --- |
| **Record header** | Breadcrumb (Accounts › RFQs › …), record icon, "Request for Quotation · RFQ-…", live title (`{Insured} — {LoB}`), Draft badge, Cancel / Save Draft. |
| **Progress path** | 4 chevron steps: Create RFQ (current) → Publish → Compare → Bind. |
| **Insured** | Account lookup (mocked list w/ search), Primary Contact, Contact Email. |
| **Line of Business** | Radio cards: Commercial Property / Commercial Auto. Switching LoB prunes incompatible line items and coverages. |
| **Insured Line Items** | Hierarchical tree of `location → building → equipment` (Property) and `vehicle → equipment` (Auto). Add/Edit modal with per-type field schema. Live **Total Insured Value**. |
| **Policy-Level Coverages** | Catalog-driven add modal (CGL, Umbrella, Cyber, Workers' Comp, Hired & Non-Owned, etc.). Each coverage carries its ACORD form code and a summary line. |
| **Policy Period & Requirements** | Effective date, Expiration date, Response Deadline, Underwriting notes. |
| **Sticky footer** | Save as Draft / Continue to Publish (fires the `next` event). |

## Data model (lives in `c/rfqConstants`)

- `LOBS` — Commercial Property / Commercial Auto.
- `ITEM_TYPES` — `location`, `building`, `equipment`, `vehicle`. Each has a `fields` array (text / number / select), `allowedParents`, and `lob` membership for filtering.
- `COVERAGE_CATALOG` — Fire & Allied Perils, Special Form, Wind/Hail, Flood, Earthquake, Business Income, Equipment Breakdown, Theft, Inland Marine, Auto Liability, Auto Physical, Hired & Non-Owned, CGL, Umbrella, Cyber, EPLI, Workers' Comp. Each carries its `code`, `form` (ACORD), `applicableTo` (target type or `__policy__`), and a `fields` schema.
- `MOCK_ACCOUNTS` — six demo accounts behind the Insured lookup. Replace with an `@wire(searchAccounts)` Apex call.

## Component API

`<c-rfq-create>` raises three custom events the host can listen for:

| Event | Detail payload |
| --- | --- |
| `cancel` | _none_ |
| `savedraft` | `{ rfqNumber, insured, primaryContact, contactEmail, lob, effectiveDate, expirationDate, responseDeadline, notes, lineItems, coverages }` |
| `next` | same payload, after validating that an insured + at least one line item exist. |

Example host usage:

```html
<c-rfq-create
    oncancel={handleCancel}
    onsavedraft={handleSave}
    onnext={handleContinueToPublish}>
</c-rfq-create>
```

## What's intentionally out of scope (today)

These live in the reference but are not yet ported to LWC — flagged here so the gap is explicit:

- **Step 2 — Publish to Carriers**: carrier picker grid, ACORD form preview, cover-email composer with `{{variables}}`, email preview.
- **Step 3 — Compare Quotes**: submission inbox, quote comparison table, simulate-responses tool.
- **Step 4 — Bind Policy**: subjectivity checklist, binding email composer, policy issuance request.
- **Einstein assist**: per-step "AI: Draft this step" actions, the AI banner with progress, and the slide-out Einstein panel.
- **Stale-quote banner**: re-publish prompt when Step 1 is mutated after publishing.
- **Step menus**: clickable per-step popovers on the progress path.
- **App shell**: global nav, app nav, Setup overlay (these belong to the parent Experience Cloud / Lightning App, not the page itself).

## Customizing against the reference

The reference is the design source of truth — when you touch the LWC, check:

- **Insured lookup** — wire to `AccountController.search()` (SOSL) and a `lightning-record-picker` if available in your org.
- **Mock accounts** — replace `MOCK_ACCOUNTS` with the wired data.
- **Coverages + ACORD codes** — confirm the org's product team has approved this catalog; otherwise move it to Custom Metadata Types (`RFQ_Coverage__mdt`) and load via Apex.
- **Line item field schemas** — same as above: candidate for CMDT so the underwriting team can edit options without redeploying.
- **SLDS tokens** — swap raw hex values in `rfqCreate.css` for design tokens from the in-house Design Kit extension once that's wired in.
- **In-house extensions** — when available, replace the hand-rolled tree, lookup, and modal with the team's `c-lookup`, `c-tree-grid`, and `c-modal` so we inherit a11y + behavior fixes for free.
