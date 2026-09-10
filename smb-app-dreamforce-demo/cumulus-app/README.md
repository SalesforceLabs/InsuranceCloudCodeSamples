# Atlas

A local prototype for a modern, "Apple-like" SMB Commercial Fleet Brokerage app built with **Vite + LWC Open Source + SLDS**. The UI is an Atlas-branded shell wrapping three core screens — *Run My Day*, *Meeting Center*, and *Guided RFQ Intake + Quote Comparison* — backed by a mock Connect-API client that shapes every record exactly like the real Salesforce FSC objects (`InsurancePolicy`, `InsurancePolicyCoverage`, `InsurancePolicyParticipant`, `InsuranceApplication`).

## Run it

```bash
cd cumulus-app
npm install
npm run dev
```

Open the printed URL (Vite picks the first free port starting at `5175`). Useful query-param shortcuts for previewing each screen without clicking through:

| URL | Screen |
| --- | --- |
| `/` | Run My Day (default) |
| `/?route=meeting-center` | Meeting Center → Meeting Prep |
| `/?route=rfq-workspace` | Guided RFQ Intake |
| `/?route=rfq-workspace&view=compare` | Quote Comparison |
| `/?slack=open` | Opens the right-side Slack drawer on load |

## Stack

- **Vite 5** — dev server / bundler.
- **`vite-plugin-lwc`** (community) — the official `@lwc/rollup-plugin` doesn't compose cleanly with Vite's CSS pipeline; this wrapper does.
- **LWC OSS 8.x** — components live under `src/modules/c/<name>/<name>.{js,html,css}`.
- **SLDS CDN** — global stylesheet from `cdnjs.cloudflare.com/.../salesforce-lightning-design-system.min.css`.
- **Inter** font + custom CSS tokens for the soft, Apple-flavored surfaces SLDS doesn't ship by default.
- **`date-fns`** — for the dashboard greeting date.

## Folder layout

```
cumulus-app/
├── index.html                       # SLDS CDN, Inter font, root mount
├── vite.config.js                   # rootDir=src/modules, excludes global styles
├── src/
│   ├── index.js                     # createElement(c-app) → mount
│   ├── styles/
│   │   ├── tokens.css               # --atlas-radius/-shadow/-glow vars
│   │   └── overrides.css            # softer SLDS overrides
│   └── modules/
│       ├── c/                       # LWC components
│       │   ├── app/                 # root router + global state
│       │   ├── topNav/              # white nav with Atlas logo
│       │   ├── agentforcePill/      # fixed bottom pill, purple/blue gradient border
│       │   ├── slackDrawer/         # right slide-in #acct-sunrise-agency
│       │   ├── runMyDay/            # Screen A
│       │   ├── meetingCard/         # 4 cards on Run My Day
│       │   ├── insightAccordion/    # Production Drop-Off / Loss Ratio Spikes
│       │   ├── meetingCenter/       # Screen B (3 tabs)
│       │   ├── rfqWorkspace/        # Screen C orchestrator
│       │   ├── progressPath/        # vertical step list
│       │   ├── lobPicker/           # Auto vs Home visual cards
│       │   ├── censusDropZone/      # skeleton-and-sparkle → grid reveal
│       │   └── quoteCompare/        # 3-column Hartford/Travelers/Chubb table
│       └── data/                    # plain ES modules — *not* LWC components
│           ├── mockData/            # currentUser, upcomingMeetings, quotes, census, slackMessages, catalog
│           ├── api/                 # mock Connect-API client (Promise + simulated latency)
│           └── insurancePolicy/     # JSDoc typedefs for the FSC data model
```

## Data model — keeping the backend honest

The reference build never had real Apex/Connect wiring (the legacy `force-app/` LWC pulls from the same in-memory catalog the prototype does). To preserve the engineering team's stated backend intent from the recording, every piece of data flows through three layers:

1. **`src/modules/data/insurancePolicy/insurancePolicy.js`** — JSDoc typedefs that mirror the standard FSC Insurance objects: `InsurancePolicy`, `InsurancePolicyCoverage` (IPC), `InsurancePolicyParticipant` (IPP), `CarrierQuote`, and the custom `InsuranceApplication` (RFQ) shape. The catalog from [../force-app/main/default/lwc/rfqConstants/rfqConstants.js](../force-app/main/default/lwc/rfqConstants/rfqConstants.js) — line-item schemas, coverage codes, ACORD form refs, mock accounts — is ported into `mockData.js` verbatim so the source of truth doesn't diverge.

2. **`src/modules/data/mockData/mockData.js`** — single source of seed data. New domain data for the three screens (meetings, action items, at-risk agencies, census, quotes with `aiRecommendation`, Slack messages) all live here and use the same DTO shapes.

3. **`src/modules/data/api/api.js`** — a Promise-returning fake Connect API client. Every function maps 1:1 to an endpoint outlined in the recording:

   | Function | Endpoint it would call |
   | --- | --- |
   | `listInsuranceApplications({ accountId, status })` | `GET /services/data/v60.0/connect/insurance/applications` |
   | `createInsuranceApplication(payload)` | `POST /services/data/v60.0/connect/insurance/applications` |
   | `listQuotes({ applicationId })` | `GET /services/data/v60.0/connect/insurance/applications/{id}/quotes` |
   | `compareQuotes({ applicationId })` | `POST /services/data/v60.0/connect/insurance/applications/{id}/compare` |
   | `parseCensusFile(file)` | (carrier-specific census enrichment endpoint) |
   | `searchAccounts(term)` | SOSL via Apex |

   Every component awaits these, so when the engineering team wires real Apex/Connect, only `api.js` swaps — the screens already render skeleton states (`c-census-drop-zone`, `c-quote-compare`) on the back of those promises.

## The three screens

### Run My Day (`c-run-my-day`)

- Greeting hero with today's date pulled from `date-fns`.
- 4 horizontally-flexed meeting cards (Sunrise Insurance Agency Visit, Quarterly Business Review, Renewal Strategy — Acme Mfg, New Carrier Onboarding — Chubb) with status pills (`Prep Ready` / `Prep In Progress`).
- Full-width banner at `#00396B` with 6 counters (Fully Ready, Checked, Completed, Approved, Pending Review, Needs Attention).
- 20 / 80 split below — vertical action category nav (Retain, Grow, Service & C, AI-Powered) and the two `c-insight-accordion` cards for Production Drop-Off and Loss Ratio Spikes with `Schedule Call` / `Send AI Email` inline buttons.

### Meeting Center (`c-meeting-center`)

- 3 top tabs — Meeting Prep (default), Meeting Session, Meeting Follow-Up.
- Meeting Prep view: Agentforce draft-summary banner with Save / Discard, two-column body (3-metric KPI strip + Key Concerns bullet list + Recommended Talking Points on the left; Agentforce Actions checklist on the right with one item pre-checked), and a Meeting Prep Tasks related-list table with colored SLDS-style status badges.

### Guided RFQ Intake + Quote Comparison (`c-rfq-workspace`)

State machine `intake → compare`. Vertical `c-progress-path` on the left.

- **Intake:** LOB visual picker (Auto vs Home, Auto pre-selected with brand-blue border and `✓` chip), the prior policy card (2022 Tesla Model 3 — Unit 04 carried over from Meridian Restaurant Group's existing policy), the census drop zone (click → 1500ms shimmer + sparkle → 7-employee grid revealed from `parseCensusFile()`), and the Coverages table (CGL row showing ACORD 125 form code and "Mapped" badge).
- **Compare:** three carrier cards — Hartford / Travelers / Chubb. Travelers is highlighted with a 2px brand border, the "✨ Best Value" pill, gradient premium text, and the AI callout populated from `quote.aiRecommendation.reason`. `Bind Travelers →` brand CTA enabled in the page header once a card is selected (Travelers is selected by default from the `compareQuotes` recommendation).

## The global shell

- **`c-top-nav`** — sticky white bar with a subtle gradient globe-glyph "Atlas" logo on the left and search/bell/hamburger/avatar icons on the right. Bell click → opens the Slack drawer.
- **`c-agentforce-pill`** — fixed bottom-center input with the `+` icon, ✨ sparkle, the exact placeholder text from the brief, and the **purple → blue gradient border** (padding-box / border-box trick) plus a soft purple glow. Submit → pushes a new "Agentforce: …" message into the Slack drawer and opens it.
- **`c-slack-drawer`** — 400px right-side drawer with the cubic-bezier slide and a dimming overlay. Renders the `#acct-sunrise-agency` channel header and 5 seeded messages (Agentforce + Quote Bot) including the *"Travelers Quote Received — flagged Best Value by Agentforce"* alert.

## What's intentionally out of scope

- No real Apex / Connect calls — `api.js` is the swap point.
- Meeting Center's `Meeting Session` and `Meeting Follow-Up` tabs render polished "Coming next" placeholders.
- The Bind flow stops at the `Bind Travelers →` CTA. The existing React Step 4 (in [`../app/src/views/Step4_BindPolicy.tsx`](../app/src/views/Step4_BindPolicy.tsx)) already covers binding and is not re-implemented here.
- The companion React prototype at `../app/` and the deployable LWC at `../force-app/main/default/lwc/rfqCreate/` are **untouched** — they're the v1 reference, this is the v2 visual layer.
