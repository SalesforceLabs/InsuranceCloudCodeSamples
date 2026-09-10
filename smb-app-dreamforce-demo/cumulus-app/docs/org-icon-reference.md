# Org Icon Reference

Verbatim glyph and colour data for every icon rendered by the workspace tab strip and the related-list cards in `c-account-record-page`. Every path, viewBox and hex value below was copied out of an authoritative Salesforce source; nothing here was drawn, traced or eyeballed.

This file is reference data only. It does not change any component.

## 1. Sources used

### Local SLDS metadata: did NOT yield colours

Inspected `cumulus-app/node_modules/@salesforce-ux/sds-metadata/current/`, all 21 files. Relevant findings:

- `icons.json` - an array of 5 sprite groups (`action`, `custom`, `doctype`, `standard`, `utility`). Each icon entry carries `sprite`, `symbol`, `className`, `visible` and often `synonyms`. It carries **no colour field of any kind**.
- `sldsClasses.json` and `sldsPlusClasses.json` - flat arrays of class-name strings only (3411 and 3762 entries). No declarations, no values.
- Programmatic check: for every file in the package that mentions `slds-icon-standard-account`, there is no hex, `rgb(` or `background-color` token anywhere near the class name.
- Sibling packages under `cumulus-app/node_modules/@salesforce-ux/` are only `eslint-plugin-slds` and `slds-linter`. Neither ships icon colours.
- There is no copy of `salesforce-lightning-design-system.css` anywhere under `node_modules`.

**Verdict: the local metadata package cannot supply background colours.** It was still useful, and was used, for two other things: confirming the canonical `className` per icon, and resolving ambiguous names via its `synonyms` field.

### Org sprite endpoints: yielded all glyph paths and viewBoxes

Fetched unauthenticated with `curl`, saved to `/tmp/sprites/`:

| URL | Symbols |
| --- | --- |
| `https://preetiorg2.test1.lightning.pc-rnd.force.com/_slds/icons/standard-sprite/svg/symbols.svg` | 632 |
| `https://preetiorg2.test1.lightning.pc-rnd.force.com/_slds/icons/utility-sprite/svg/symbols.svg` | 750 |
| `https://preetiorg2.test1.lightning.pc-rnd.force.com/_slds/icons/custom-sprite/svg/symbols.svg` | 113 |

### SLDS distribution CSS: yielded all background colours

The org's own stylesheet is not reachable anonymously. Every candidate path under `/_slds/` returns HTTP 302 to a login redirect:

```
302  /_slds/styles/salesforce-lightning-design-system.css
302  /_slds/css/salesforce-lightning-design-system.css
302  /_slds/assets/styles/salesforce-lightning-design-system.css
302  /_slds/styles/index.css
302  /_slds/index.css
```

Colours therefore come from the official Salesforce-published SLDS package instead, which is the upstream source the org stylesheet is built from:

- `https://unpkg.com/@salesforce-ux/design-system@latest/assets/styles/salesforce-lightning-design-system.css`
- Resolved to version **2.264.0** (`https://unpkg.com/@salesforce-ux/design-system@2.264.0/...`), 1,089,700 bytes.
- 974 per-icon background rules parsed: 660 `standard`, 201 `action`, 113 `custom`.

The rules take this shape, so the literal fallback `rgb()` is the real value:

```css
.slds-icon-standard-account{
  background-color:var(--slds-c-icon-color-background, var(--sds-c-icon-color-background, rgb(88, 103, 232)));
}
```

Because the colours are from the published package rather than scraped from this specific org, a human should spot-check two or three against the live org if the org runs a custom theme. Nothing indicates it does, but this is the one link in the chain that is upstream-of-org rather than from-org.

## 2. The viewBox trap, measured

viewBox is genuinely not uniform, not even within a single sprite. Measured distribution across every symbol in each file:

| Sprite | `0 0 1000 1000` | `0 0 100 100` | `0 0 520 520` | `0 0 52 52` |
| --- | --- | --- | --- | --- |
| standard (632) | 534 | 98 | - | - |
| utility (750) | - | - | 687 | 62 |
| custom (113) | 73 | 40 | - | - |

Two consequences that matter directly for this work:

1. **`standard:account` is `0 0 100 100`, while most standard icons are `0 0 1000 1000`.** It is one of only 98 exceptions, and it happens to be the single most-used icon on this page. Reusing a neighbouring icon's viewBox here would scale the glyph by a factor of 10.
2. **`utility:setup` is `0 0 520 520`, not `0 0 52 52`.** The utility sprite is predominantly 520x520 (687 of 750). The 52x52 form exists but is the minority at 62 symbols. Note the existing hand-drawn markup in `accountRecordPage.html` uses `viewBox="0 0 52 52"` for its gear and caret glyphs, so swapping in the real `utility:setup` path without also changing the viewBox to `0 0 520 520` would render the glyph at one tenth scale.

Every viewBox in the table below was read off that specific `<symbol>` element. None were inferred.

## 3. Icon table

Bucket counts: **13 CONFIRMED**, **2 BEST-AVAILABLE-SUBSTITUTE**, **2 OUR-CHOICE**.

### A. Workspace tab-strip icons

| Our `type` | Salesforce icon | Bucket | Verbatim viewBox | Background hex | Colour source |
| --- | --- | --- | --- | --- | --- |
| `account` | `standard:account` | CONFIRMED | `0 0 100 100` | `#5867E8` rgb(88, 103, 232) | SLDS CSS `.slds-icon-standard-account` |
| `product` | `standard:product` | CONFIRMED | `0 0 1000 1000` | `#9050E9` rgb(144, 80, 233) | SLDS CSS `.slds-icon-standard-product` |
| `policy` | `standard:policy` | CONFIRMED | `0 0 1000 1000` | `#06A59A` rgb(6, 165, 154) | SLDS CSS `.slds-icon-standard-policy` |
| `rfq` | `standard:quotes` | OUR-CHOICE | `0 0 1000 1000` | `#3BA755` rgb(59, 167, 85) | SLDS CSS `.slds-icon-standard-quotes` |
| `client360` | `standard:customer_360` | BEST-AVAILABLE-SUBSTITUTE | `0 0 1000 1000` | `#032D60` rgb(3, 45, 96) | SLDS CSS `.slds-icon-standard-customer-360` |
| `revenue` | `standard:sales_value` | OUR-CHOICE | `0 0 1000 1000` | `#1B96FF` rgb(27, 150, 255) | SLDS CSS `.slds-icon-standard-sales-value` |
| `dashboards` | `standard:dashboard` | CONFIRMED | `0 0 1000 1000` | `#2F2CB7` rgb(47, 44, 183) | SLDS CSS `.slds-icon-standard-dashboard` |
| `setup` | `utility:setup` | CONFIRMED | `0 0 520 520` | none (utility icon) | n/a - utility sprite has no background rule |
| `Home` | `standard:home` | CONFIRMED | `0 0 1000 1000` | `#FF538A` rgb(255, 83, 138) | SLDS CSS `.slds-icon-standard-home` |
| `Recently Viewed` | `standard:recent` | CONFIRMED | `0 0 1000 1000` | `#1B96FF` rgb(27, 150, 255) | SLDS CSS `.slds-icon-standard-recent` |
| `default` | `standard:default` | CONFIRMED | `0 0 1000 1000` | `#939393` rgb(147, 147, 147) | SLDS CSS `.slds-icon-standard-default` |

### B. Related-list card icons

| Our `type` | Salesforce icon | Bucket | Verbatim viewBox | Background hex | Colour source |
| --- | --- | --- | --- | --- | --- |
| `Contacts` | `standard:contact` | CONFIRMED | `0 0 1000 1000` | `#9602C7` rgb(150, 2, 199) | SLDS CSS `.slds-icon-standard-contact` |
| `Opportunities` | `standard:opportunity` | CONFIRMED | `0 0 1000 1000` | `#FF5D2D` rgb(255, 93, 45) | SLDS CSS `.slds-icon-standard-opportunity` |
| `Cases` | `standard:case` | CONFIRMED | `0 0 1000 1000` | `#FF538A` rgb(255, 83, 138) | SLDS CSS `.slds-icon-standard-case` |
| `Partners` | `standard:partners` | CONFIRMED | `0 0 1000 1000` | `#06A59A` rgb(6, 165, 154) | SLDS CSS `.slds-icon-standard-partners` |
| `Notes & Attachments` | `standard:note` | CONFIRMED | `0 0 1000 1000` | `#B60554` rgb(182, 5, 84) | SLDS CSS `.slds-icon-standard-note` |
| `Invoices` | `standard:billing` | BEST-AVAILABLE-SUBSTITUTE | `0 0 1000 1000` | `#FF5D2D` rgb(255, 93, 45) | SLDS CSS `.slds-icon-standard-billing` |

### Per-row notes

- **`account` -> `standard:account`** (CONFIRMED): Exact name match. One of the 98 standard symbols authored at 100x100, not 1000x1000.
- **`product` -> `standard:product`** (CONFIRMED): Exact name match.
- **`policy` -> `standard:policy`** (CONFIRMED): Exact name match. standard:insurance_policy does not exist in the sprite; standard:policy does.
- **`rfq` -> `standard:quotes`** (OUR-CHOICE): No rfq symbol in any of the three sprites and no synonym hit for "rfq" anywhere in icons.json. Recommending standard:quotes because RFQ means Request For Quote.
- **`client360` -> `standard:customer_360`** (BEST-AVAILABLE-SUBSTITUTE): standard:client360 does not exist. standard:customer_360 does and is the direct Salesforce equivalent. standard:client also exists but its icons.json synonyms are "source window editor", so it is a code/developer client icon and is the wrong match.
- **`revenue` -> `standard:sales_value`** (OUR-CHOICE): No revenue symbol and zero synonym hits for "revenue" across all five sprites. Recommending standard:sales_value, whose synonyms are "magnifyingglass chart growth projection".
- **`dashboards` -> `standard:dashboard`** (CONFIRMED): Our type string is plural; the Salesforce symbol is singular standard:dashboard. That is the canonical Dashboards icon.
- **`setup` -> `utility:setup`** (CONFIRMED): Utility sprite, not standard. There is no standard:setup symbol. Utility icons carry no per-icon background colour by design.
- **`Home` -> `standard:home`** (CONFIRMED): Exact name match. Synonyms "app homepage house".
- **`Recently Viewed` -> `standard:recent`** (CONFIRMED): Exact semantic match; synonyms "clock message new". See caveat in the notes section about how a real console renders a Recently Viewed list view.
- **`default` -> `standard:default`** (CONFIRMED): Exact name match; this is Salesforce's own fallback icon. Synonyms "cloud salesforce original". Carries opacity=".5" which must be preserved.
- **`Contacts` -> `standard:contact`** (CONFIRMED): Exact name match.
- **`Opportunities` -> `standard:opportunity`** (CONFIRMED): Exact name match.
- **`Cases` -> `standard:case`** (CONFIRMED): Exact name match.
- **`Partners` -> `standard:partners`** (CONFIRMED): Exact name match on the plural symbol standard:partners. Synonyms "handshake deal agreement".
- **`Notes & Attachments` -> `standard:note`** (CONFIRMED): standard:note, synonyms "text content notepad".
- **`Invoices` -> `standard:billing`** (BEST-AVAILABLE-SUBSTITUTE): No standard:invoice symbol exists. standard:billing is the match because its own icons.json synonyms are literally "invoice payment bill receipt".

## 4. Verbatim symbol markup

Complete inner markup of each `<symbol>`, byte-for-byte as it appears in the org sprite. Not truncated, not reformatted, not re-indented.

Read section 6 before pasting: these glyphs carry **no `fill` attribute**, so white is not encoded in the markup.

### A. Workspace tab-strip icons

#### `account` -> `standard:account`

- viewBox: `0 0 100 100`
- background: `#5867E8` rgb(88, 103, 232)
- bucket: CONFIRMED

```svg
<path d="M79 51.1c.1-2.1-1.4-2.7-2-2.7H55.2c-1.9 0-2.2 2-2.2 2.2V74h26zM64 67.9a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2c0-1.1.9-2 2-2h2a2 2 0 012 2zm0-10.2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2c0-1.1.9-2 2-2h2a2 2 0 012 2zm10 10.2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2c0-1.1.9-2 2-2h2a2 2 0 012 2zm0-10.2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2c0-1.1.9-2 2-2h2a2 2 0 012 2zM59 40.3V28.7c.1-2.1-1.4-2.7-2-2.7H23.2c-1.9 0-2.2 2-2.2 2.2V74h26V44.7s0-2.4 2.2-2.4h7.9c1.1 0 1.9-1.2 1.9-2M32 66.9a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2c0-1.1.9-2 2-2h2a2 2 0 012 2zm0-10.3a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2c0-1.1.9-2 2-2h2a2 2 0 012 2zm0-10.2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2c0-1.1.9-2 2-2h2a2 2 0 012 2zm0-10.2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2c0-1.1.9-2 2-2h2a2 2 0 012 2zm11 30.7a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2c0-1.1.9-2 2-2h2a2 2 0 012 2zm0-10.3a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2c0-1.1.9-2 2-2h2a2 2 0 012 2zm0-10.2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2c0-1.1.9-2 2-2h2a2 2 0 012 2zm0-10.2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2c0-1.1.9-2 2-2h2a2 2 0 012 2zm11 0a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2c0-1.1.9-2 2-2h2a2 2 0 012 2z"/>
```

#### `product` -> `standard:product`

- viewBox: `0 0 1000 1000`
- background: `#9050E9` rgb(144, 80, 233)
- bucket: CONFIRMED

```svg
<path d="M220 660h50c11 0 20-9 20-20V330c0-11-9-20-20-20h-50c-11 0-20 9-20 20v310c0 11 9 20 20 20m560-350h-50c-11 0-20 9-20 20v310c0 11 9 20 20 20h50c11 0 20-9 20-20V330c0-11-9-20-20-20M530 660c11 0 20-9 20-20V330c0-11-9-20-20-20h-60c-11 0-20 9-20 20v310c0 11 9 20 20 20zm120 0c11 0 20-9 20-20V330c0-11-9-20-20-20h-20c-11 0-20 9-20 20v310c0 11 9 20 20 20zm-260 0c11 0 20-9 20-20V330c0-11-9-20-20-20h-20c-11 0-20 9-20 20v310c0 11 9 20 20 20zm390 60H220c-11 0-20 9-20 20v20c0 11 9 20 20 20h560c11 0 20-9 20-20v-20c0-11-9-20-20-20m0-520H220c-11 0-20 9-20 20v20c0 11 9 20 20 20h560c11 0 20-9 20-20v-20c0-11-9-20-20-20"/>
```

#### `policy` -> `standard:policy`

- viewBox: `0 0 1000 1000`
- background: `#06A59A` rgb(6, 165, 154)
- bucket: CONFIRMED

```svg
<path d="M223 400h132c31 0 50-19 50-49V219a19 19 0 0119-19h195a57 57 0 0157 56v242H571c-14 0-18 13-21 25l-6 15c-9 14-21 20-34 27l-12 7c-16 9-6 43 0 64l3 9a339 339 0 0060 120l-300 1a57 57 0 01-57-57V419a19 19 0 0119-19m-15-72l125-125c2-2 7-3 10-3 7 0 14 6 14 13v100a41 41 0 01-40 40H217c-7 0-13-7-13-14 0-4 1-8 4-11m495 267c-4-4-27-4-37-4-4 0-4 3-4 8v124c0 12 18-7 21-9a188 188 0 0042-71l1-3c3-8 5-15-3-21a71 71 0 01-10-12c-3-5-6-9-10-12"/><path fill-rule="evenodd" d="M786 588a59 59 0 01-32-26 50 50 0 01-5-11c-3-9-6-20-16-20l-142 1c-10 0-14 10-17 19l-4 11c-7 12-16 16-26 22l-10 5c-12 7-4 34 0 50l3 7a236 236 0 00119 152c10 6 28-7 38-15l3-3a222 222 0 0058-61 276 276 0 0030-66l7-29 1-4c2-8 4-17 2-24-1-4-4-7-8-8zm-36 17a42 42 0 01-23-18c-2-2-2-5-3-8-2-7-5-14-12-14H611c-7 0-9 7-11 14l-3 8c-5 8-12 11-19 15l-7 4c-9 5-3 24 0 35l2 5a174 174 0 0057 91c9 7 18 12 27 17 8 4 20-5 27-11l2-1a157 157 0 0041-44 192 192 0 0026-67l1-3c1-6 3-13 2-17-1-3-4-5-6-6"/>
```

#### `rfq` -> `standard:quotes`

- viewBox: `0 0 1000 1000`
- background: `#3BA755` rgb(59, 167, 85)
- bucket: OUR-CHOICE

```svg
<path d="M720 220H501c-14-1-26 6-36 16L197 505a61 61 0 000 85l212 212c23 23 61 23 85 0l271-272c10-10 16-26 15-40V280c0-33-27-60-60-60M504 660l-14 14c-8 8-20 8-28 0L326 538c-8-8-8-20 0-28l14-14c8-8 20-8 28 0l136 136c8 8 8 20 0 28m80-80l-14 14c-8 8-20 8-28 0L406 458c-8-8-8-20 0-28l14-14c8-8 20-8 28 0l136 136c8 8 8 20 0 28m56-170c-28 0-50-22-50-50s22-50 50-50 50 22 50 50-22 50-50 50"/>
```

#### `client360` -> `standard:customer_360`

- viewBox: `0 0 1000 1000`
- background: `#032D60` rgb(3, 45, 96)
- bucket: BEST-AVAILABLE-SUBSTITUTE

```svg
<path d="M788 508c7-7 7-16 4-24-4-9-12-14-22-14-7 0-13 2-19 8l-5 5c-9-132-118-236-252-236-139 0-252 113-252 252s113 252 252 252c119 0 218-82 245-193zM494 701c-112 0-202-91-202-202s91-202 202-202c106 0 193 82 201 186l-5-5c-3-3-6-5-10-6-10-4-20-1-27 7-8 10-8 24 1 33l36 36c-21 87-101 153-196 153m123-130v11c0 14-11 25-25 25H395c-14 0-25-11-25-25v-11c0-30 35-48 68-62 1 0 2-1 3-2 2-1 5-1 8 0 13 9 28 14 44 14s31-5 44-13c2-2 5-2 8 0 1 0 2 1 3 2 34 13 69 31 69 61"/><ellipse cx="494" cy="428" rx="61" ry="68"/>
```

#### `revenue` -> `standard:sales_value`

- viewBox: `0 0 1000 1000`
- background: `#1B96FF` rgb(27, 150, 255)
- bucket: OUR-CHOICE

```svg
<path d="M795 739L629 574c34-47 51-107 42-171-15-107-102-192-211-202-147-15-272 110-257 258 10 107 95 196 202 211 64 9 123-9 171-42l166 166c7 7 19 7 26 0l26-26c8-9 8-21 1-29M543 557v-43c0-8-7-15-15-15s-15 7-15 15v63q-27 15-60 18v-60c0-8-7-15-15-15s-15 7-15 15v60q-33-3-60-18v-63c0-8-7-15-15-15s-15 7-15 15v42c-26-23-45-53-53-89l68-54 71 53c6 5 15 4 20-2l74-82v52c0 8 7 15 15 15s15-7 15-15v-90c0-8-7-15-15-15h-80c-8 0-15 7-15 15s7 16 15 16h45l-67 75-69-52c-5-4-13-4-18 0l-62 49a161 161 0 11266 125"/>
```

#### `dashboards` -> `standard:dashboard`

- viewBox: `0 0 1000 1000`
- background: `#2F2CB7` rgb(47, 44, 183)
- bucket: CONFIRMED

```svg
<path d="M500 200c-165 0-300 135-300 300s135 300 300 300 300-135 300-300-135-300-300-300m0 80c121 0 220 99 220 220l-2 30h-89c-10 0-18 7-20 17-8 52-54 93-109 93s-101-41-109-93c-1-10-10-17-20-17h-89l-2-30c0-121 99-220 220-220m-23 294c24 13 55 3 68-21 19-35 55-189 46-193-9-5-116 111-134 147-14 24-5 54 20 67"/>
```

#### `setup` -> `utility:setup`

- viewBox: `0 0 520 520`
- background: none (utility icon, monochrome)
- bucket: CONFIRMED

```svg
<path d="M468 324l-37-31a195 195 0 000-68l37-31c12-10 16-28 8-42l-16-29a34 34 0 00-40-14l-45 17a173 173 0 00-58-34l-8-47c-3-16-17-25-33-25h-32c-16 0-30 9-33 25l-8 46c-22 7-41 19-59 34l-44-17-11-2c-12 0-23 6-29 16l-16 28c-8 14-5 32 8 42l37 31a195 195 0 000 68l-37 31a34 34 0 00-8 42l16 30a34 34 0 0040 14l45-17c18 16 38 27 58 34l8 48a33 33 0 0033 27h32c16 0 30-12 33-28l8-48c23-8 43-20 61-37l42 17 12 2c12 0 23-6 29-16l15-26c8-12 4-30-8-40m-207 47a110 110 0 01-109-110 109 109 0 11218 0 110 110 0 01-109 110m29-191h-46c-7 0-13 4-15 10l-28 72c-2 5 2 11 8 11h47l-17 60c-2 6 5 9 9 5l71-83c5-5 1-13-6-13h-35l31-49c3-5-1-12-7-12h-12z"/>
```

#### `Home` -> `standard:home`

- viewBox: `0 0 1000 1000`
- background: `#FF538A` rgb(255, 83, 138)
- bucket: CONFIRMED

```svg
<path d="M788 512h-63v275c0 8-5 12-13 12H588c-8 0-13-5-13-12V575H425v212c0 8-5 12-13 12H288c-8 0-13-5-13-12V512h-63c-5 0-10-2-11-8-3-5-1-10 3-14l288-288c5-5 14-5 18 0l288 288c4 4 4 9 3 14s-8 8-13 8"/>
```

#### `Recently Viewed` -> `standard:recent`

- viewBox: `0 0 1000 1000`
- background: `#1B96FF` rgb(27, 150, 255)
- bucket: CONFIRMED

```svg
<path d="M281 480c-1 7-1 13-1 20h-60c0-7 0-13 1-20zm234-120h-30c-8 0-15 7-15 15v131c0 4 2 8 4 11l84 84c6 6 15 6 21 0l21-21c6-6 6-15 0-21l-70-71V375c0-8-7-15-15-15"/><path d="M500 220c-148 0-269 115-279 260 0 3-1 7-1 10h-45c-13 0-20 15-12 24l75 91c6 7 17 7 23 0l75-91c8-10 1-24-12-24h-44v-10c10-112 105-200 219-200 130 0 233 113 219 245-10 95-100 185-196 194-71 7-138-19-185-70-6-7-14-11-22-1l-24 29c-5 6-1 10 4 15 54 57 128 89 208 88 144-2 265-116 275-260 13-163-117-300-278-300"/>
```

#### `default` -> `standard:default`

- viewBox: `0 0 1000 1000`
- background: `#939393` rgb(147, 147, 147)
- bucket: CONFIRMED

```svg
<path d="M446 328c21-21 49-34 81-34 42 0 79 23 99 57 17-7 36-12 56-12 76 1 138 62 138 137a137.4 137.4 0 01-165 134 101.3 101.3 0 01-132 41c-18 40-58 69-106 69-50 0-92-31-108-74-7 1-14 2-22 2a106.3 106.3 0 01-54-198c-7-15-10-31-10-48 0-67 56-122 124-122 41 0 77 19 99 48" opacity=".5"/>
```

### B. Related-list card icons

#### `Contacts` -> `standard:contact`

- viewBox: `0 0 1000 1000`
- background: `#9602C7` rgb(150, 2, 199)
- bucket: CONFIRMED

```svg
<path d="M740 290H260c-33 0-60 27-60 60v290c0 33 27 60 60 60h480c33 0 60-27 60-60V350c0-33-27-60-60-60M486 630H314c-19 0-34-21-34-41 1-30 32-48 65-63 23-10 26-19 26-29s-6-19-14-26a68 68 0 01-21-50c0-38 23-70 63-70s63 32 63 70c0 20-7 38-21 50-8 7-14 16-14 26s3 19 26 28c33 14 64 34 65 64 2 20-13 41-32 41m234-70c0 11-9 20-20 20h-90c-11 0-20-9-20-20v-30c0-11 9-20 20-20h90c11 0 20 9 20 20zm0-110c0 11-9 20-20 20H550c-11 0-20-9-20-20v-30c0-11 9-20 20-20h150c11 0 20 9 20 20z"/>
```

#### `Opportunities` -> `standard:opportunity`

- viewBox: `0 0 1000 1000`
- background: `#FF5D2D` rgb(255, 93, 45)
- bucket: CONFIRMED

```svg
<path d="M711 690H289c-10 0-19 9-19 19v1c0 33 27 60 60 60h340c33 0 60-27 60-60v-1c0-10-9-19-19-19m49-410a60 60 0 00-39 106c-17 39-56 66-102 64-53-3-96-46-99-99 0-9 0-17 2-25a60 60 0 00-22-116 60 60 0 00-22 116c2 8 2 16 2 25-3 53-46 96-99 99-46 3-86-25-102-64a60 60 0 00-39-106c-33 0-60 27-60 60s27 60 60 60l28 214c1 9 9 16 19 16h426c9 0 17-7 19-16l28-214c33 0 60-27 60-60s-27-60-60-60"/>
```

#### `Cases` -> `standard:case`

- viewBox: `0 0 1000 1000`
- background: `#FF538A` rgb(255, 83, 138)
- bucket: CONFIRMED

```svg
<path d="M380 290h40c6 0 10-4 10-10v-30h140v30c0 6 4 10 10 10h40c6 0 10-4 10-10v-30c0-33-27-60-60-60H430c-33 0-60 27-60 60v30c0 6 4 10 10 10m360 60H260c-33 0-60 27-60 60v320c0 33 27 60 60 60h480c33 0 60-27 60-60V410c0-33-27-60-60-60"/>
```

#### `Partners` -> `standard:partners`

- viewBox: `0 0 1000 1000`
- background: `#06A59A` rgb(6, 165, 154)
- bucket: CONFIRMED

```svg
<path d="M770 317h-60c-13 0-26-6-36-15l-48-41c-10-8-23-14-36-14H473c-15 0-29 6-40 17l-62 51c-5 4-5 12-1 17l19 18c13 10 30 12 43 3l55-33c7-5 17-3 23 3l173 168c4 4 7 10 7 16v45c0 12 9 25 20 25h60c11 0 20-9 20-21V337c0-12-9-20-20-20M600 497L492 392l-30 18c-15 9-32 14-49 14-21 0-43-8-60-22l-39-32c-9-7-14-15-15-26-2-11-10-17-20-17h-69c-11 0-20 6-20 18v182c0 12 9 20 20 20h40c3 0 7-11 11-16 15-20 37-31 61-34 24-2 47 6 66 23l125 114c11 10 19 21 24 35 3 7 11 9 16 4l47-47c24-24 42-80 20-106zm-251 74a28 28 0 00-42 4c-11 14-9 34 4 46l125 113c6 6 14 8 22 7s15-5 20-12c11-14 9-34-4-46z"/>
```

#### `Notes & Attachments` -> `standard:note`

- viewBox: `0 0 1000 1000`
- background: `#B60554` rgb(182, 5, 84)
- bucket: CONFIRMED

```svg
<path d="M713 670l-11 11a66 66 0 01-46 19h-33c-30 0-63-23-63-65v-31c0-25 11-40 18-48l135-136c4-4 7-12 7-17V300c0-33-27-60-60-60H340c-33 0-60 30-60 60h-20c-22 0-40 18-40 40s18 40 40 40h20v80h-20c-22 0-40 18-40 40s18 40 40 40h20v80h-20c-22 0-40 18-40 40s18 40 40 40h20c0 40 27 60 60 60h320c33 0 60-27 60-60v-27c0-6-3-7-7-3M610 390c0 11-9 20-20 20H390c-11 0-20-9-20-20v-20c0-11 9-20 20-20h200c11 0 20 9 20 20zm-90 240c0 11-9 20-20 20H390c-11 0-20-9-20-20v-20c0-11 9-20 20-20h110c11 0 20 9 20 20zm30-120c0 11-9 20-20 20H390c-11 0-20-9-20-20v-20c0-11 9-20 20-20h140c11 0 20 9 20 20zm264-54l-12-12c-8-8-20-8-28 0L621 599l-1 3v33c0 3 0 5 3 5h33l4-1 154-154c8-9 8-21 0-29"/>
```

#### `Invoices` -> `standard:billing`

- viewBox: `0 0 1000 1000`
- background: `#FF5D2D` rgb(255, 93, 45)
- bucket: BEST-AVAILABLE-SUBSTITUTE

```svg
<path d="M671 455a5 5 0 005-5V255c0-15-7-29-18-39s-25-16-40-16H312a60 60 0 00-40 17 55 55 0 00-17 35v394l2 7c2 7 6 13 10 18 5 5 10 10 16 13s13 5 20 6h232c4 0 7-4 5-8a152 152 0 01131-226zM341 321c0-3 0-6 2-8 0-2 3-5 5-6l7-4h245c3 0 5 2 7 4l5 6v27c0 6-3 11-8 14-4 4-10 5-15 5H362c-6 0-11 0-15-5s-7-9-8-14v-19zm154 245c0 3 0 5-2 8l-4 6-6 4H354l-7-4-5-6-2-7v-19c0-5 3-10 6-14 4-4 9-5 14-5h121l7 4 5 6 2 7zm47-94H366c-14 0-26-8-26-19v-18c0-11 11-19 26-19h177c14 0 26 8 26 19v18c0 10-12 19-27 19m132 153c-27-11-30-18-30-24s6-11 19-11 22 6 38 15l7 2c4 0 10-3 13-8l14-15c2-2 4-7 3-11 0-4-3-9-6-11-6-4-23-13-39-18v-25c0-6-5-9-10-9h-32q-6 0-6 9v26c-41 9-55 36-55 60 0 41 33 58 61 69 30 11 33 20 33 25s-9 13-20 13-24-4-41-15l-8-2c-5 0-10 2-12 7l-10 18c-5 8-3 13 3 20 5 6 25 17 50 22v29c0 6 0 9 6 9h32c5 0 10-3 10-9v-30c31-9 53-34 52-63 0-42-37-62-71-74h-1z"/>
```

## 5. Needs human decision

Four rows are not a straight lift from the org. Two are substitutions of a real Salesforce icon for a name that does not exist, and two are cases where Salesforce has no counterpart at all and the app must simply pick.

### BEST-AVAILABLE-SUBSTITUTE (2)

**`client360` -> `standard:customer_360`** (`0 0 1000 1000`, `#032D60`)

There is no `standard:client360`. `standard:customer_360` is Salesforce's own name for the same concept, so this is a high-confidence substitution. Separately, this resolves the previously open question about `standard:client`: that symbol does exist, but `icons.json` gives its synonyms as "source window editor", meaning it is a code-editor / client-application icon and **not** a customer icon. Do not use it. Recommendation: accept `standard:customer_360`. Note its background `#032D60` is a dark navy, considerably darker than the other tab icons; confirm that reads acceptably in the tab strip.

**`Invoices` -> `standard:billing`** (`0 0 1000 1000`, `#FF5D2D`)

There is no `standard:invoice` in the 632-symbol standard sprite, nor any `invoice` symbol in utility. `standard:billing` is the correct target because Salesforce's own metadata lists its synonyms as "invoice payment bill receipt". Recommendation: accept. One caveat worth knowing: `#FF5D2D` is the identical hex to `standard:opportunity`, so Invoices and Opportunities would share a colour in the related-list rail.

### OUR-CHOICE / NO ORG COUNTERPART (2)

**`rfq` -> recommend `standard:quotes`** (`0 0 1000 1000`, `#3BA755`)

RFQ is our own object concept. Searched exhaustively: no `rfq` symbol id in standard (632), utility (750) or custom (113), and zero synonym matches for "rfq" anywhere in `icons.json` across all five sprite groups. The custom sprite is no help either; it is only the 113 generic `custom1` through `custom113` placeholders, which carry no semantic meaning. Recommendation: `standard:quotes` (synonyms "tag pricetag"), on the grounds that RFQ expands to Request For Quote and Quotes is the nearest real Salesforce object. Alternative if a document-like glyph is preferred: `utility:quote` (`0 0 520 520`, no background colour). This is a naming judgement, not an org fact.

**`revenue` -> recommend `standard:sales_value`** (`0 0 1000 1000`, `#1B96FF`)

Confirmed absent: no `revenue` symbol id in any sprite, and zero synonym hits for "revenue" across the whole of `icons.json`. Our tab is labelled "Revenue Intelligence". Recommendation: `standard:sales_value`, whose synonyms are "magnifyingglass chart growth projection", which maps well onto analysis-of-revenue. Ranked alternatives, all real and all colour-resolvable:

| Candidate | Synonyms | viewBox | Hex |
| --- | --- | --- | --- |
| `standard:sales_value` (recommended) | magnifyingglass chart growth projection | `0 0 1000 1000` | `#1B96FF` |
| `standard:insights` | analytics data report | `0 0 1000 1000` | `#CB65FF` |
| `standard:metrics` | chart graph data | `0 0 1000 1000` | `#1B96FF` |
| `standard:forecasts` | binoculars | `0 0 1000 1000` | `#3BA755` |

This is a judgement call and needs sign-off.

### Lower-stakes items worth a glance

- **`Recently Viewed`**: mapped to `standard:recent`, which is a real icon and a clean semantic match. Flagging only that in a real Lightning console a "Recently Viewed" tab is a list view, and a list-view tab inherits the icon of its parent object rather than showing a generic recency clock. If the intent is to mirror the org pixel-for-pixel, a human may prefer `standard:account` there. The mock's label is `Recently Viewed | ...` with no object named, so `standard:recent` is the reasonable reading.
- **`setup`**: mapped to `utility:setup`, which is correct (there is no `standard:setup`), but it is a utility icon and so has no background colour. See section 6.
- **`dashboards`**: our type string is plural, the symbol is `standard:dashboard`. Same thing, noted for transparency.

## 6. Implementation notes before pasting

### The glyphs contain no `fill` attribute

Worth stating plainly because it is easy to assume otherwise: none of the 17 symbols carries a `fill` attribute. Audited every child element. What is present is only:

- `standard:policy` - a `fill-rule="evenodd"` on its second path.
- `standard:default` - an `opacity=".5"` on its path.
- `standard:customer_360` - an `<ellipse>` child alongside its `<path>`.

Everything else is bare `<path d="..."/>`. The white comes from the consuming stylesheet, not the sprite:

```css
.slds-icon{
  fill:var(--slds-c-icon-color-foreground, var(--sds-c-icon-color-foreground, var(--slds-g-color-neutral-base-100, rgb(255, 255, 255))));
}
```

So each glyph must be given `fill="#fff"` (or an equivalent CSS `fill`) at the call site. Copying the path alone and expecting white is the failure mode to avoid.

### Utility icons have no background colour

Verified: the SLDS CSS contains **zero** `.slds-icon-utility-*` background-colour rules. Utility icons are single-colour glyphs with no keyline shape. `utility:setup` therefore gets no coloured chip; it inherits its colour from the surrounding text. This is by design and matches how the Setup gear renders in Lightning.

### Current app colours vs org colours

Not part of the ask, but it fell out of the colour extraction and is directly actionable. Comparing the hardcoded values in `accountRecordPage.css` against the org:

| Element | Current CSS | Org value | Match |
| --- | --- | --- | --- |
| `.sf-related-icon_contact` | `#9602c7` | `#9602C7` | matches |
| `.sf-related-icon_opp` | `#ff5d2d` | `#FF5D2D` | matches |
| `.sf-related-icon_case` | `#ff538a` | `#FF538A` | matches |
| `.sf-related-icon_partner` | `#5867e8` | `#06A59A` | wrong; org Partners is teal, not indigo |
| `.sf-related-icon_notes` | `#939393` | `#B60554` | wrong; org Note is crimson, not grey |
| `.sf-related-icon_invoice` | `#9050e9` | `#FF5D2D` | wrong; org Billing is hot orange, not purple |

Three of six related-list colours are currently off. Note `#939393` is not a random choice; it is the real hex of `standard:default`, so the Notes icon looks like it inherited the fallback colour.

### Scope correction on the related lists

The brief named four related lists (Contacts, Opportunities, Cases, Partners). Reading `accountRecordPage.html` and grepping `sf-related-icon` shows **six**. The two additional ones are included above:

| Related list | Class | Icon |
| --- | --- | --- |
| Contacts | `sf-related-icon_contact` | `standard:contact` |
| Opportunities | `sf-related-icon_opp` | `standard:opportunity` |
| Cases | `sf-related-icon_case` | `standard:case` |
| Partners | `sf-related-icon_partner` | `standard:partners` |
| Notes & Attachments | `sf-related-icon_notes` | `standard:note` |
| Invoices | `sf-related-icon_invoice` | `standard:billing` |

### Current state of the tab strip

For context on the size of the swap: the tab strip today has no per-type icons at all. `accountRecordPage.html` renders exactly two variants, both hand-drawn:

- an `lwc:if={t.isSetup}` branch with a hand-drawn gear at `viewBox="0 0 52 52"`;
- an `lwc:else` branch with a hand-drawn building glyph at `viewBox="0 0 24 24"` that currently serves every other type, so `account`, `product`, `policy`, `rfq`, `client360`, `revenue` and `dashboards` all render identically.

The static `Home` and `Recently Viewed` tabs are likewise hand-drawn at `viewBox="0 0 24 24"`. All 17 rows above are replacements, not adjustments.
