# Split-Pane (Master-Detail) refactor - c-eb-benefits-copays

Refactor the Employee Benefits runtime Step 3 to a "left classifications rail + right benefits pane" split-pane, replacing the current single-open category accordion + benefit-tab layout. Scope is strictly the [`c-eb-benefits-copays`](cumulus-app/src/modules/c/ebBenefitsCopays/ebBenefitsCopays.js) LWC (its `.js`, `.html`, `.css`). No parent, catalog, mock-data, or downstream compare-table changes. `benefitState` key shape is untouched, so nothing that reads it needs to change.

Framework note: repo uses **LWC + SLDS 2** (not React + Tailwind). The message template mentioned React/Tailwind, but plan and code will be LWC + SLDS 2 to match the existing surrounding components and preserve visual consistency with the other runtime steps.

## Layout target

Only the inner white card under the Medical segment header changes. The wizard sidebar + segment header + Tier Details accordion above stay exactly as-is.

```
Medical (segment header)                            [unchanged]
--------------------------------------------------------------------
[>] Tier Details                     [+ Add tier]   [unchanged]
--------------------------------------------------------------------
[ Classifications rail ] | [ Benefits pane                       ]
[ Physician Services  * ] | [ [x] Include Physician Services...  ]
[ Preventive Services   ] | [                                    ]
[ Emergency Services    ] | [ [v] Office Visit: PCP              ]
[ Outpatient Services   ] | [    Tier 1                          ]
[ Hospital ...          ] | [      Copay $  |  Value $ __        ]
[ Chiropractic Services ] | [      Deductible $ __                ]
[ Prescription Drugs    ] | [      Deductible Waiver [Select v]   ]
                          | [      Limit __                       ]
                          | [    Tier 2                          ]
                          | [      Copay $  |  Value $ __        ]
                          | [    ...                              ]
                          | [ [>] Office Visit: Specialist        ]
                          | [ [>] Office Visit: Virtual           ]
```

- Left rail: SLDS 2 vertical navigation, active item highlighted (blue left-border rule + subtle brand-tint background). Renders every category, even those without an active benefit yet. Full labels wrap onto a second line if needed - no truncation.
- Right pane: the active category's include-in-RFQ checkbox at the top, then one accordion card per Benefit, then the tier blocks + attribute rows inside each open benefit.
- Tier Details accordion (broker names up to four tiers) stays above the split as-is, since tiers are shared across every category and benefit.

## 1. State (`ebBenefitsCopays.js`)

- Rename `@track _expandedCategoryKey` -> `@track _activeCategoryKey` (semantics change: this is now "which classification the left rail has selected", always one - the concept of "no category open" goes away since the rail always has a selection).
- Keep `@track _activeBenefitByCategory` untouched; still keyed `${rootId}::${categoryId}` -> benefitId. The plan replaces the tab strip with an accordion list, but the "which benefit is currently expanded" state maps onto the same key. Optionally rename to `_expandedBenefitByCategory` for clarity (functionally identical).
- Keep `_categoryIncluded`, `_tiers`, `_costTypes`, `_tierDetailsOpenByRoot`, `_expandedRootId` unchanged.
- Add nothing else. Form data lives in `_benefitState` (already keyed by `benefitId::tierId::...`), so switching classifications naturally preserves every entered value.

Handlers:

- Replace `handleCategoryToggle` / `handleCategoryKeydown` (were the category accordion toggle) with `handleCategorySelect` / `handleCategorySelectKeydown` - always sets `_activeCategoryKey`, never clears it. Selecting the currently-active category is a no-op.
- Replace `handleBenefitTabSelect` / `handleBenefitTabKeydown` (were the benefit tab strip) with `handleBenefitToggle` / `handleBenefitKeydown` - toggles `_activeBenefitByCategory[catKey]` between benefitId (open) and `''` (closed). Single-open per app-wide rule: only one benefit accordion open per category.
- Keep `handleCategoryIncludeToggle`, `handleAddTier`, `handleTierLabelInput`, `handleTierLabelKeydown`, `handleRemoveTier`, `handleTierDetailsToggle`, `handleTierDetailsKeydown`, `handleCostTypeChange`, `handleAttributeInput`, `handleAttributePicklist` unchanged.

## 2. View-model (`ebBenefitsCopays.js`)

In `get segments()`, keep the outer `segments -> categories[]` shape but reshape category decoration:

- `_decorateCategory(c, rootId, tierChips, isMultiTier)` returns two shapes:
  - Always: `{ key, collapseKey, includeKey, id, label, isActive, ariaSelected, itemClass }` (cheap - one per rail item).
  - Only when `isActive`: adds `included`, `benefits[]` (fully decorated benefit accordions).
- `_activeCategoryKey` defaults to the first category id if unset.
- Emit `activeCategory` on the segment view-model as a convenience alias (same object flagged `isActive`) so the right-pane template doesn't have to hunt for it.

`_decorateBenefit(b, rootId, categoryId, tierChips, isMultiTier, categoryIncluded)` picks up accordion state again:

- Add `isOpen` (from `_activeBenefitByCategory[catKey] === b.id`), `ariaExpanded`, `chevronCls`, `accordionKey`, plus the existing `isMultiTier`, `isCostSlots`, `isNative`, `tierBlocks`, `only`, and the cost/deductible/waiver/limit/notes row decorators.
- Header always renders (label + chevron); body renders inside `lwc:if={b.isOpen}` block.

Keep all existing `_decorateCostSlotsTier`, `_decorateCostRow`, `_decorateWaiverRow`, `_decorateDeductibleRow`, `_decorateLimitRow`, `_decorateNotesRow`, `_decorateNativeTier` helpers - unchanged.

## 3. Template (`ebBenefitsCopays.html`)

Between the Tier Details accordion and the closing segment body, replace the current category accordion loop + tabs + tabpanel block with:

```html
<div class="ebc-split">
  <!-- Left rail: classification list -->
  <nav class="ebc-split__master" aria-label="Benefit Classifications">
    <ul class="ebc-nav" role="list">
      <template for:each={seg.categories} for:item="cat">
        <li class="ebc-nav__item-wrap" key={cat.key}>
          <button type="button"
                  class={cat.itemClass}
                  aria-current={cat.ariaSelected}
                  data-key={cat.collapseKey}
                  onclick={handleCategorySelect}
                  onkeydown={handleCategorySelectKeydown}>
            <span class="ebc-nav__label">{cat.label}</span>
          </button>
        </li>
      </template>
    </ul>
  </nav>

  <!-- Right pane: active classification's include gate + benefits -->
  <template lwc:if={seg.activeCategory}>
    <section class="ebc-split__detail" aria-label={seg.activeCategory.label}>
      <label class="ebc-cat-include">
        <input type="checkbox"
               data-key={seg.activeCategory.includeKey}
               checked={seg.activeCategory.included}
               aria-label={seg.activeCategory.label}
               onchange={handleCategoryIncludeToggle} />
        <span class="ebc-cat-include__faux" aria-hidden="true"></span>
        <span class="ebc-cat-include__label">Include {seg.activeCategory.label} in RFQ</span>
      </label>

      <template for:each={seg.activeCategory.benefits} for:item="b">
        <article class="ebc-benefit-acc" key={b.key}>
          <header class="ebc-benefit-acc__head"
                  role="button" tabindex="0"
                  aria-expanded={b.ariaExpanded}
                  data-key={b.accordionKey}
                  onclick={handleBenefitToggle}
                  onkeydown={handleBenefitKeydown}>
            <svg class={b.chevronCls} ...>chevron</svg>
            <span class="ebc-benefit-acc__label">{b.label}</span>
          </header>
          <template lwc:if={b.isOpen}>
            <div class="ebc-benefit-acc__body">
              <!-- multi-tier tier blocks + single-tier "only" branch
                   moved verbatim from the current tabpanel; each tier
                   block renders the .ebc-attr-list of Copay / Coinsurance
                   / Deductible / Waiver / Limit / Notes rows. -->
            </div>
          </template>
        </article>
      </template>
    </section>
  </template>
</div>
```

The entire benefit-row markup block (multi-tier `tierBlocks` loop + single-tier `only` branch with the `.ebc-attr-row` label-left / control-right rows) is moved verbatim from today's tabpanel to inside `<div class="ebc-benefit-acc__body">`, rebound from `cat.activeBenefit.*` -> `b.*` (since it now sits inside the per-benefit loop). No changes to the attribute-row internals.

## 4. CSS (`ebBenefitsCopays.css`)

Add:

- `.ebc-split` - CSS grid: `grid-template-columns: minmax(12rem, 15rem) 1fr;` with a `gap: var(--slds-g-spacing-var-4, 1rem);`. Right pane gets the surplus horizontal space by design.
- `.ebc-split__master` - vertical rail. Padding-right + `border-right: 1px solid var(--slds-g-color-border-1);` for the master/detail divider.
- `.ebc-split__detail` - column with `gap: var(--slds-g-spacing-var-3, 0.75rem);`.
- `.ebc-nav` - `list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--slds-g-spacing-1, 0.25rem);`.
- `.ebc-nav__item` (the button) - full-width, left-aligned, 3-line-clamped label, transparent background, `padding-left` reserving space for the active-state border-left rule. Hover: `background: var(--slds-g-color-surface-container-2);`. Focus-visible: brand focus ring.
- `.ebc-nav__item.is-active` - `background: var(--slds-g-color-palette-electric-blue-95);`, `color: var(--slds-g-color-on-surface-3);`, `font-weight: var(--slds-g-font-weight-7);`, plus a `border-left: 3px solid var(--slds-g-color-border-accent-1);` rule (the SLDS 2 active-nav marker).
- `.ebc-benefit-acc`, `.ebc-benefit-acc__head`, `.ebc-benefit-acc__label`, `.ebc-benefit-acc__body`, `.ebc-benefit-acc__chev` (rotates on `.is-open`) - re-instates the grey-band accordion pattern removed in the last refactor. Header padding matches `.ebc-tier-acc__head` for family consistency; body inherits the existing `.ebc-tier-block-inline` + `.ebc-attr-list` styling.

Remove:

- `.ebc-cat-acc` and `.ebc-cat-acc__*` variants (category is now a nav item, not an accordion).
- `.ebc-tabs`, `.ebc-tab`, `.ebc-tab.is-active` (benefit tab strip is gone).
- `.ebc-tabpanel` (right pane is `.ebc-split__detail`, benefit body is `.ebc-benefit-acc__body`).

Adjust:

- `.ebc-cat-acc.is-excluded ...` cascade -> port to `.ebc-split__detail.is-excluded .ebc-attr-row__label, ...` (drive the exclusion class off the right-pane container based on `activeCategory.included`).

Responsive:

- Below `48em` (SLDS medium breakpoint) collapse the grid to a single column so the rail stacks on top of the detail pane. `.ebc-split { grid-template-columns: 1fr; }` and `.ebc-split__master { border-right: 0; border-bottom: 1px solid ...; }`. Nav items go horizontal-scroll or stacked (keep stacked; better readability).

## 5. State-preservation guarantee

Form data lives in the parent's `_benefitState` (composed key: `${benefitId}::${tierId}::${attrTypeId}[::${slot}]`). Switching classifications in the left rail only flips `_activeCategoryKey`; nothing in `_benefitState` moves. When the broker returns to a previously-viewed classification the values render right back from the same keys.

Similarly `_activeBenefitByCategory` remembers which benefit accordion was open per (root, category) so a round-trip to another classification returns to the same benefit.

## 6. Alternatives (not chosen, worth flagging)

- Include toggle in the left rail (under the active nav item) instead of the right pane header. Cleaner rail-as-master read, but crowds the rail and pushes the checkbox away from the fields it gates. Reversible if you prefer.
- Benefits as always-open cards (no accordion collapse). Faster to fill many benefits, more scrolling. The chosen single-open accordion pattern matches the app-wide "no two accordions open at the same level" rule already enforced elsewhere.
- Multi-select classifications (checkbox per item, N right panes side-by-side). Overkill for the current data volume; also breaks the "one active benefit" mental model.

## 7. Files touched

- [cumulus-app/src/modules/c/ebBenefitsCopays/ebBenefitsCopays.js](cumulus-app/src/modules/c/ebBenefitsCopays/ebBenefitsCopays.js) - state rename, handler rename, VM reshape.
- [cumulus-app/src/modules/c/ebBenefitsCopays/ebBenefitsCopays.html](cumulus-app/src/modules/c/ebBenefitsCopays/ebBenefitsCopays.html) - replace the category-accordion loop + benefit-tabs + tabpanel block with the split-pane markup above.
- [cumulus-app/src/modules/c/ebBenefitsCopays/ebBenefitsCopays.css](cumulus-app/src/modules/c/ebBenefitsCopays/ebBenefitsCopays.css) - add `.ebc-split*`, `.ebc-nav*`, `.ebc-benefit-acc*`; remove `.ebc-cat-acc*`, `.ebc-tabs*`, `.ebc-tab*`, `.ebc-tabpanel`.

Nothing else in the repo depends on the removed classes or the accordion state, so no cross-file cleanup is needed.

## 8. Todos (for execution)

1. `state_swap` - rename `_expandedCategoryKey` -> `_activeCategoryKey`; replace `handleCategoryToggle/Keydown` with `handleCategorySelect/SelectKeydown` (always-set, no unset); rename benefit tab handlers -> `handleBenefitToggle/Keydown` (single-open toggle).
2. `vm_rewrite` - split `_decorateCategory` into cheap rail-item shape + full active-category shape; add `activeCategory` alias; re-add benefit accordion fields (`isOpen`, `ariaExpanded`, `chevronCls`, `accordionKey`) inside `_decorateBenefit`.
3. `html_rewrite` - swap the category loop for `.ebc-split` with left `.ebc-split__master` nav + right `.ebc-split__detail` (include gate + benefit accordions); move the tier-block / attribute-row markup verbatim into `.ebc-benefit-acc__body`.
4. `css_rewrite` - add `.ebc-split*`, `.ebc-nav*`, `.ebc-benefit-acc*`; delete `.ebc-cat-acc*`, `.ebc-tabs*`, `.ebc-tab*`, `.ebc-tabpanel`; add responsive breakpoint for `<48em`.
5. `build_ship` - `npm run build`, sync `dist/index.html` -> `preview/v02/index.html`, run `scripts/package-preview.mjs`, copy `atlas-standalone.html` -> `~/Desktop/Atlas latest.html`.
