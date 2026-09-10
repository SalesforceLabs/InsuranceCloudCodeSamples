# Underwriter Assistant — Agent Script

> Source of truth for the scripted **Underwriter Assistant** ("Ask") conversation shown in the
> runtime demo (astro button, top-right sticky header). Based on
> `underwriting-prds/uw_copilot_sample_experience.md` (6 turns: orient → read → redirect → act),
> with every value pinned to the **NexGen Biologics Inc — New Business** demo data that is actually
> rendered on screen.
>
> Edit the responses here; the implementation transcribes this file into the `ASSISTANT_SCRIPT`
> const in `src/components/Navigation/GlobalHeader.tsx`. **Nothing is implemented from this file yet.**

---

## Interaction model

- Six turns, linear. Martha drives each turn by clicking the **next suggested prompt** (option chip)
  or, for turn 6, by acting on an editable email preview.
- The copilot **reads** the submission and **redirects** Martha to the right resolution surface
  (Resolve Attribute Mapping / Resolve Duplicates). It does **not** resolve discrepancies itself.
- The only **write** in the whole flow is turn 6 (Approve & Send), and it happens only on approval.
- Persona: user is **Martha (UW Team Lead)**, the recorded actor for any write.

## Grounding data (verified against the demo, matches what's on screen)

| Field | Value | Notes |
|---|---|---|
| Submission | NexGen Biologics Inc — New Business | |
| Broker | Niki Paoloni · Vanguard Insurance Partners | |
| Assigned to | Martha (UW Team Lead) | |
| Effective date | 06/01/2026 | per ACORD 125 |
| Industry / NAICS | Pharmaceutical manufacturer · NAICS 325412 | |
| Annual revenue | ~$47.2M | |
| TIV | ~$19.5M ($19,526,769) | |
| Stage | In Progress (lines exist) | |
| Property line | Commercial Property · owner **Manish Arya** | |
| GL line | General Liability · owner **David Chen** | |
| Business Auto | **Not created** — Schedule of Vehicles not attached, no VINs in the email narrative | |

**Chicago Warehouse (Location 1) address conflict** — the worked example:

| Source | Address | ZIP |
|---|---|---|
| ACORD 140 | 1450 W Fulton St | 60607 |
| ACORD 125 | 1450 West Fulton St | 60607 |
| Statement of Values | 1450 W Fulton St | 60607 |
| **Broker email** | **1448 W Fulton Street** | **60612** |

**GL Premium Basis conflict:**

| Source | Value |
|---|---|
| ACORD 126 | Payroll + Sales + Area |
| Broker email | Payroll + Sales |
| ACORD 140 | Payroll, Sales, Area |

**Duplicate location pairs (Property line):**
- **San Jose** — Location 3A – San Jose Manufacturing Campus ↔ Location 3B – San Jose Manufacturing
  Facility. Same address **2500 Augustine Dr**, overlapping buildings (Manufacturing Building A,
  Warehouse & Distribution).
- **Austin** — Location 5A – Austin Distribution Center ↔ Location 5B – Austin Warehouse Facility
  (same address 4200 Industrial Blvd; every mapped value matches).

---

## The 6 turns

### Turn 1 — Orient

**Prompt (Martha):** "Give me the picture on this one."

**Copilot:**
> **NexGen Biologics Inc — New Business**, submitted by Niki Paoloni (Vanguard Insurance Partners).
> Pharmaceutical manufacturer, NAICS 325412, ~$47.2M revenue, TIV ~$19.5M. Effective 06/01/2026.
> Stage **In Progress**.
>
> Two submission lines were created — **Commercial Property** (Manish Arya) and **General Liability**
> (David Chen).
>
> Both created lines have discrepancies to resolve before quoting.

*Record card (orientation):*
- **NexGen Biologics Inc New Business**
- Broker — Niki Paoloni · Vanguard Insurance Partners
- Industry — Pharmaceutical mfg · NAICS 325412
- Annual Revenue — ~$47.2M
- Total Insured Value — ~$19.5M
- Effective Date — 06/01/2026
- Lines — Commercial Property, General Liability (Business Auto skipped)

*UX shape:* Orientation card, context auto-injected from the record. *PRD: US1, US3.*

---

### Turn 2 — Needs attention

**Prompt (Martha):** "What needs my attention right now?"

**Copilot:**
> Two things:
> 1. Resolve the discrepancies on the **Commercial Property** line — the Chicago Warehouse address
>    conflict (address, city, state, ZIP), plus a **duplicate San Jose location pair**.
> 2. Resolve the **Premium Basis** conflict on the **General Liability** line.

*UX shape:* Prioritized needs-attention list, in conversation. *PRD: US3, US4.*

> **Editor note:** the PRD doc phrases this as "3 items, plus a duplicate San Jose location." On
> screen the Property line's flagged discrepancies span Location 1's address block (Address / City /
> State / ZIP), a couple of building-level attributes, and an LOB Valuation flag. Decide whether to
> say "3 items" (matches the PRD wording) or describe the groups as above (matches the data). Current
> draft above uses the descriptive version.

---

### Turn 3 — Source lineage (Chicago address)

**Prompt (Martha):** "Where did the Chicago Warehouse address come from? Something looks off."

**Copilot:**
> The address is **1450 W Fulton St** on ACORD 140, ACORD 125, and the Statement of Values, but the
> **broker email** says **1448 W Fulton Street** — and the email's ZIP is **60612** where the others
> say **60607**. That's the flagged conflict on **Location 1 – Chicago Warehouse**.
>
> To pick the value to keep, open **Resolve Attribute Mapping** on the Property line.

*Redirect chip:* **Open Resolve Attribute Mapping →** (Property line)

*UX shape:* Source-lineage answer, then redirect to Resolve Attribute Mapping. *PRD: US3.*

---

### Turn 4 — Source comparison (GL Premium Basis)

**Prompt (Martha):** "Compare the GL Premium Basis across the sources."

**Copilot:**
> - **ACORD 126** — "Payroll + Sales + Area"
> - **Broker email** — "Payroll + Sales"
> - **ACORD 140** — "Payroll, Sales, Area"
>
> That's the flagged conflict on the **General Liability** line — resolve it from **Resolve Attribute
> Mapping** on that line.

*Redirect chip:* **Open Resolve Attribute Mapping →** (GL line)

*UX shape:* Side-by-side source comparison + redirect to Resolve Attribute Mapping. *PRD: US3.*

---

### Turn 5 — Duplicates (San Jose)

**Prompt (Martha):** "Are the San Jose locations really duplicates?"

**Copilot:**
> Reconciliation flagged **Location 3A – San Jose Manufacturing Campus** and **Location 3B – San Jose
> Manufacturing Facility** — same address (**2500 Augustine Dr**) with overlapping buildings
> (Manufacturing Building A, Warehouse & Distribution). There's a second pair in **Austin**
> (Location 5A – Austin Distribution Center / Location 5B – Austin Warehouse Facility).
>
> You can merge them from **Resolve Duplicates** on the Property line.

*Redirect chip:* **Open Resolve Duplicates →** (Property line)

*UX shape:* Duplicate summary + redirect to Resolve Duplicates. *PRD: US3, US4.*

---

### Turn 6 — Draft & send (the only write)

**Prompt (Martha):** "Draft an email to Niki to confirm the Chicago Warehouse address."

**Copilot — editable preview, nothing written yet:**

*Email draft card:*
- **Activity:** Request Additional Information
- **To:** Niki Paoloni (Vanguard Insurance Partners)
- **Subject:** NexGen Biologics — confirm Chicago Warehouse address
- **Body:**
  > Hi Niki — the submission has two different addresses for the Chicago Warehouse (Location 1). Your
  > email lists **1448 W Fulton Street, ZIP 60612**, while the ACORD forms and the Statement of Values
  > show **1450 W Fulton St, ZIP 60607**. Can you confirm which is correct?
  >
  > Thanks,
  > Martha
- **Buttons:** [Edit] [Approve & Send] [Cancel]

**After Approve & Send:**
> Sent. Recorded **Request Additional Information** — you're the recorded actor. It's in the Tasks
> panel and Activity Log now.

*UX shape:* Editable draft preview; write only on approve; audit marker on the write (Martha as actor).
*PRD: US5, US7.*

---

## Coverage map

| Turn | Prompt | Capability | PRD |
|---|---|---|---|
| 1 | Give me the picture on this one. | Ask entry, auto-inject, orient | US1, US3 |
| 2 | What needs my attention right now? | Needs-attention read | US3, US4 |
| 3 | Where did the Chicago Warehouse address come from? | Source-lineage + redirect (Resolve Attribute Mapping) | US3 |
| 4 | Compare the GL Premium Basis across the sources. | Source comparison + redirect (Resolve Attribute Mapping) | US3 |
| 5 | Are the San Jose locations really duplicates? | Duplicate summary + redirect (Resolve Duplicates) | US3, US4 |
| 6 | Draft an email to Niki to confirm the Chicago Warehouse address. | Draft activity, approve → write (Martha actor) | US5, US7 |
