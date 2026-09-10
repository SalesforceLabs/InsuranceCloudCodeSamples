import { LightningElement, api, track } from 'lwc';
import {
  getBenefitCategories,
  getRootProduct,
  DEDUCTIBLE_WAIVER_OPTIONS
} from 'data/ebCatalog';

/**
 * c-eb-benefits-copays - runtime Step 3 (Benefits & Copays).
 *
 * Mounted inside c-rfq-workspace-eb when the wizard is on the
 * 'benefits' step. Renders the 5-level EB product model with a
 * catalog-driven per-Benefit field composition:
 *
 *   L1 Coverage       - one accordion per in-scope root (Medical /
 *                       Dental / Vision).
 *   L2 Category       - Physician / Emergency / Outpatient / etc.
 *                       Rendered as single-open accordions (one
 *                       category expanded at a time per app-wide rule).
 *   L3 Benefit        - Office Visit PCP, Urgent Care, ER, ...
 *                       Rendered as an SLDS 2 tab strip inside each
 *                       expanded category; the active tab exposes its
 *                       attribute rows in the tabpanel below.
 *   L4 Attribute      - For 'cost-slots' the broker picks Copay or
 *                       Coinsurance per slot; for 'native' the benefit's
 *                       own attribute is implied by its dataType.
 *   L5 Value+DataType - Copay renders $ input, Coinsurance renders %
 *                       input, Deductible / Limit render $ / # inputs,
 *                       Deductible Waiver renders a picklist.
 *
 * Tier chips (broker-named, up to 4 per coverage) sit at the top of
 * each expanded coverage. Tier ids are minted at add-time and stay
 * stable across renames, so `benefitState` keyed by
 * `${benefitId}::${tierId}::${attrTypeId}[::${slot}]` survives label
 * edits.
 *
 * @api inScopeRootIds - string[] of root ids drawn from the wizard's
 *                       LOC scope.
 * @api benefitState   - { [attrKey]: { value } } slice of the
 *                       parent's policyConfiguration. Composed key
 *                       shape:
 *                         cost-slots layout ->
 *                           `${benefitId}::${tierId}::${costType}::${slot}`
 *                         cost-slots waiver ->
 *                           `${benefitId}::${tierId}::deductible_waiver`
 *                         cost-slots notes  ->
 *                           `${benefitId}::${tierId}::notes`
 *                         native layout     ->
 *                           `${benefitId}::${tierId}`
 *
 * Events:
 *   - configchange  detail { scope: 'benefit', attrId, field, value }
 *                   where `attrId` is the composed key described above.
 */

// Maximum tiers a broker can add per coverage.
const MAX_TIERS = 4;

// Default tier label seeded when the broker creates a new tier.
// Broker can inline-edit to something like "In Network" / "Out of
// Network" via the Tier Name input; the seeded default reflects the
// position in the list so brokers always land on a named tier.
function _defaultTierLabel(indexZeroBased) {
  return `Tier ${indexZeroBased + 1}`;
}

// Cost slot picker options (broker chooses Copay $ or Coinsurance %
// per slot). Shared across every 'cost-slots' benefit.
const COST_TYPE_OPTIONS = Object.freeze([
  { value: 'copay',       label: 'Copay'       },
  { value: 'coinsurance', label: 'Coinsurance' }
]);

// Short random id, stable across label renames.
function _mintTierId() {
  return (
    'tier_' +
    Math.random().toString(36).slice(2, 6) +
    Date.now().toString(36).slice(-3)
  );
}

// Per-(Benefit, Tier, Slot) composite key used by `_costTypes`.
function _costKey(benefitId, tierId, slotIdx) {
  return `${benefitId}::${tierId}::${slotIdx}`;
}

export default class EbBenefitsCopays extends LightningElement {
  _inScopeRootIds = ['medical'];
  _benefitState = {};
  @track _expandedRootId = 'medical';
  // Which Benefit Category is currently open. Single-open accordion
  // (app-wide rule: no two accordions open at the same level at once).
  // Key shape: `${rootId}::${categoryId}`.
  @track _expandedCategoryKey = '';
  // Which Benefit tab is active per category. Keyed
  // `${rootId}::${categoryId}` -> benefitId. Persists per category so
  // reopening a previously-visited category returns to whichever tab
  // the broker last had selected there.
  @track _activeBenefitByCategory = {};
  // Category-level include gate. Keys `${rootId}::${categoryId}`.
  @track _categoryIncluded = {};
  // Per-root ordered tier list.
  //   { medical: [{ id: 'tier_abc123', label: 'Base Network' }, ...] }
  @track _tiers = {};
  // Per (Benefit, Tier, Slot) which cost attribute is active. Keys
  // are `${benefitId}::${tierId}::${slotIdx}`. Values are 'copay' or
  // 'coinsurance'. Purely UI state; the entered VALUE lives in the
  // parent's benefitState under `${benefitId}::${tierId}::${costType}
  // ::${slotIdx}` so switching between Copay and Coinsurance orphans
  // (but doesn't erase) the value stored under the unchosen key.
  @track _costTypes = {};
  // Whether the "Tier Details" accordion is open per root. Defaults
  // to CLOSED per the app-wide rule: no accordion opens by default,
  // and opening one closes any other accordion at the same sibling
  // level (Tier Details and the Category accordions share a slot,
  // see handleTierDetailsToggle / handleCategoryToggle).
  @track _tierDetailsOpenByRoot = {};

  @api
  get inScopeRootIds() {
    return this._inScopeRootIds;
  }
  set inScopeRootIds(v) {
    const next = Array.isArray(v) && v.length ? v.slice() : ['medical'];
    this._inScopeRootIds = next;
    if (!next.includes(this._expandedRootId)) {
      this._expandedRootId = next[0];
    }
    this._reconcileScopedState(next);
  }

  @api
  get benefitState() {
    return this._benefitState;
  }
  set benefitState(v) {
    this._benefitState = v && typeof v === 'object' ? v : {};
  }

  // ── View-model ──────────────────────────────────────────────
  get segments() {
    return this._inScopeRootIds
      .map((id) => {
        const root = getRootProduct(id) || { id, label: id };
        const catalogCats = getBenefitCategories(id).filter(
          (c) => c.attributes && c.attributes.length
        );
        if (!catalogCats.length) return null;

        const tiers = this._tiers[id] || [];
        const hasTiers = tiers.length > 0;
        const isMultiTier = tiers.length > 1;

        const tierChips = tiers.map((t, i) => {
          const fallback = _defaultTierLabel(i);
          return {
            id: t.id,
            label: t.label,
            // Placeholder mirrors the seeded default so the field
            // still reads as "Tier N" if the broker clears it.
            placeholder: fallback,
            displayLabel: t.label && t.label.trim() ? t.label : fallback
          };
        });

        const categories = hasTiers
          ? catalogCats.map((c) =>
              this._decorateCategory(c, id, tierChips, isMultiTier)
            )
          : [];

        const expanded = id === this._expandedRootId;
        const canAddTier = tiers.length < MAX_TIERS;
        // Tier Details accordion open state per root. Defaults to
        // false per app-wide "no accordion opens by default" rule.
        const tierDetailsOpen =
          id in this._tierDetailsOpenByRoot
            ? !!this._tierDetailsOpenByRoot[id]
            : false;
        return {
          id: root.id,
          label: root.label,
          iconPath: root.iconPath,
          expanded,
          ariaExpanded: String(expanded),
          chevronCls: expanded ? 'ebc-seg__chev is-open' : 'ebc-seg__chev',
          tierChips,
          hasTiers,
          canAddTier,
          tierDetailsOpen,
          tierDetailsAriaExpanded: String(tierDetailsOpen),
          tierDetailsChevronCls: tierDetailsOpen
            ? 'ebc-tier-acc__chev is-open'
            : 'ebc-tier-acc__chev',
          categories
        };
      })
      .filter(Boolean);
  }

  get hasSegments() {
    return this.segments.length > 0;
  }

  // ── Handlers ────────────────────────────────────────────────
  handleSegmentToggle(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this._expandedRootId = this._expandedRootId === id ? '' : id;
  }
  handleSegmentKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.handleSegmentToggle(event);
  }

  // ── Tier Details accordion ──────────────────────────────────
  // App-wide single-open rule: Tier Details and the Category
  // accordions live at the same sibling level inside the segment
  // body, so opening Tier Details closes any open category and
  // vice versa.
  handleTierDetailsToggle(event) {
    const rootId = event.currentTarget.dataset.root;
    if (!rootId) return;
    const current =
      rootId in this._tierDetailsOpenByRoot
        ? this._tierDetailsOpenByRoot[rootId]
        : false;
    this._tierDetailsOpenByRoot = {
      ...this._tierDetailsOpenByRoot,
      [rootId]: !current
    };
    // Opening Tier Details closes any open category.
    if (!current) {
      this._expandedCategoryKey = '';
    }
  }
  handleTierDetailsKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.handleTierDetailsToggle(event);
  }

  // ── Tier chip handlers ──────────────────────────────────────
  handleAddTier(event) {
    // The button now lives inside the Tier Details accordion header,
    // which is itself click-to-toggle. Absorb the click so pressing
    // Add tier doesn't also collapse/expand the accordion.
    event.stopPropagation();
    const rootId = event.currentTarget.dataset.root;
    if (!rootId) return;
    const current = this._tiers[rootId] || [];
    if (current.length >= MAX_TIERS) return;
    const next = [
      ...current,
      { id: _mintTierId(), label: _defaultTierLabel(current.length) }
    ];
    this._tiers = { ...this._tiers, [rootId]: next };
    // Auto-open the accordion so the newly added tier is visible
    // straight away (matters when the broker adds while the section
    // was collapsed). Also enforce the single-open rule: adding a
    // tier closes any open category so only one sibling accordion
    // is expanded at a time.
    this._tierDetailsOpenByRoot = {
      ...this._tierDetailsOpenByRoot,
      [rootId]: true
    };
    this._expandedCategoryKey = '';
  }
  handleTierLabelInput(event) {
    const rootId = event.currentTarget.dataset.root;
    const tierId = event.currentTarget.dataset.tier;
    if (!rootId || !tierId) return;
    const current = this._tiers[rootId] || [];
    const next = current.map((t) =>
      t.id === tierId ? { ...t, label: event.currentTarget.value } : t
    );
    this._tiers = { ...this._tiers, [rootId]: next };
  }
  handleTierLabelKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }
  handleRemoveTier(event) {
    const rootId = event.currentTarget.dataset.root;
    const tierId = event.currentTarget.dataset.tier;
    if (!rootId || !tierId) return;
    const current = this._tiers[rootId] || [];
    const next = current.filter((t) => t.id !== tierId);
    this._tiers = { ...this._tiers, [rootId]: next };
    // Prune orphaned _costTypes entries for the deleted tier so state
    // doesn't hoard.
    const infix = `::${tierId}::`;
    const nextTypes = {};
    for (const key of Object.keys(this._costTypes)) {
      if (!key.includes(infix)) nextTypes[key] = this._costTypes[key];
    }
    this._costTypes = nextTypes;
  }

  // Category-level include gate (checkbox above the benefit tabs in
  // the open category's accordion body).
  handleCategoryIncludeToggle(event) {
    const key = event.currentTarget.dataset.key;
    if (!key) return;
    this._categoryIncluded = {
      ...this._categoryIncluded,
      [key]: !!event.currentTarget.checked
    };
  }

  // Category accordion (single-open per app-wide rule). Also closes
  // the Tier Details accordion (sibling at the same level) so only
  // one accordion is expanded inside the segment body at any time.
  handleCategoryToggle(event) {
    const key = event.currentTarget.dataset.key;
    if (!key) return;
    const wasOpen = this._expandedCategoryKey === key;
    this._expandedCategoryKey = wasOpen ? '' : key;
    // Opening a category closes Tier Details for the affected root.
    if (!wasOpen) {
      const rootId = key.split('::')[0];
      if (rootId && this._tierDetailsOpenByRoot[rootId]) {
        this._tierDetailsOpenByRoot = {
          ...this._tierDetailsOpenByRoot,
          [rootId]: false
        };
      }
    }
  }
  handleCategoryKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.handleCategoryToggle(event);
  }

  // Benefit tab within a category. Persists per (rootId, categoryId)
  // so switching categories doesn't blow away the last-viewed tab.
  // Belt-and-braces early-return when the category's include checkbox
  // is off: keeps the "preview + disable" semantic - broker can peek
  // at the current tab's fields (all disabled) but can't switch to a
  // different benefit tab until they include the category.
  handleBenefitTabSelect(event) {
    const catKey = event.currentTarget.dataset.key;
    const benefitId = event.currentTarget.dataset.benefit;
    if (!catKey || !benefitId) return;
    if (!this._categoryIncluded[catKey]) return;
    if (this._activeBenefitByCategory[catKey] === benefitId) return;
    this._activeBenefitByCategory = {
      ...this._activeBenefitByCategory,
      [catKey]: benefitId
    };
  }
  handleBenefitTabKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.handleBenefitTabSelect(event);
  }

  // ── Cost slot type change (Copay <-> Coinsurance) ───────────
  handleCostTypeChange(event) {
    const benefitId = event.currentTarget.dataset.benefit;
    const tierId = event.currentTarget.dataset.tier;
    const slot = event.currentTarget.dataset.slot;
    const nextType = event.detail?.value;
    if (!benefitId || !tierId || slot == null || !nextType) return;
    const key = _costKey(benefitId, tierId, slot);
    if (this._costTypes[key] === nextType) return;
    this._costTypes = { ...this._costTypes, [key]: nextType };
    // Nothing to emit - the newly-selected slot's attrKey is now bound
    // in the view-model; the input value comes from whatever the
    // parent's benefitState already has under the new key (or empty).
  }

  // ── L5 Value handlers (typed input dispatch) ────────────────
  handleAttributeInput(event) {
    this._emit(
      event.currentTarget.dataset.attr,
      'value',
      event.currentTarget.value
    );
  }
  handleAttributePicklist(event) {
    this._emit(
      event.currentTarget.dataset.attr,
      'value',
      event.detail?.value
    );
  }

  // Absorb clicks on any nested control so they don't also toggle
  // the parent accordion header.
  stopPropagation(event) {
    event.stopPropagation();
  }

  // ── Internal ────────────────────────────────────────────────
  _emit(attrId, field, value) {
    if (!attrId) return;
    this.dispatchEvent(
      new CustomEvent('configchange', {
        detail: { scope: 'benefit', attrId, field, value },
        bubbles: true,
        composed: true
      })
    );
  }

  _reconcileScopedState(nextRoots) {
    const nextIncluded = {};
    const nextTiers = {};
    for (const rootId of nextRoots) {
      // Seed one default tier per root the first time this root
      // enters scope. Broker can rename via the Tier Name input,
      // add up to MAX_TIERS more with "+ Add tier", or remove the
      // seeded one entirely (which then surfaces the empty-state
      // message). Seeded label is "Tier 1" so brokers see a named
      // tier straight away instead of an empty input.
      nextTiers[rootId] =
        rootId in this._tiers
          ? this._tiers[rootId]
          : [{ id: _mintTierId(), label: _defaultTierLabel(0) }];
      const cats = getBenefitCategories(rootId).filter(
        (c) => c.attributes && c.attributes.length
      );
      for (const c of cats) {
        const key = `${rootId}::${c.id}`;
        nextIncluded[key] = key in this._categoryIncluded
          ? this._categoryIncluded[key]
          : true;
      }
    }
    this._categoryIncluded = nextIncluded;
    this._tiers = nextTiers;
    // Prune _costTypes entries whose tierId no longer belongs to
    // any live root.
    const liveTierIds = new Set();
    for (const rootId of nextRoots) {
      for (const t of nextTiers[rootId] || []) liveTierIds.add(t.id);
    }
    const nextTypes = {};
    for (const key of Object.keys(this._costTypes)) {
      const tierId = key.split('::')[1];
      if (liveTierIds.has(tierId)) nextTypes[key] = this._costTypes[key];
    }
    this._costTypes = nextTypes;
  }

  // Decorate one Benefit Category: emits accordion-header state
  // always, plus (only when the category is open) the benefit tab
  // strip and the currently-active benefit's fully decorated view.
  _decorateCategory(c, rootId, tierChips, isMultiTier) {
    const collapseKey = `${rootId}::${c.id}`;
    const includeKey = collapseKey;
    const isOpen = this._expandedCategoryKey === collapseKey;
    const included = !!this._categoryIncluded[includeKey];

    const accordionClass = [
      'ebc-cat-acc',
      isOpen ? 'is-open' : '',
      included ? 'is-included' : 'is-excluded'
    ]
      .filter(Boolean)
      .join(' ');
    const base = {
      key: collapseKey,
      collapseKey,
      includeKey,
      id: c.id,
      label: c.label,
      // Accessible name for the in-header include checkbox (which
      // no longer renders a visible text label - the visible cue is
      // the category title next to it).
      includeLabel: `Include ${c.label} in RFQ`,
      isOpen,
      ariaExpanded: String(isOpen),
      chevronCls: isOpen ? 'ebc-cat-acc__chev is-open' : 'ebc-cat-acc__chev',
      accordionClass,
      included,
      ariaChecked: String(included)
    };

    if (!isOpen) {
      return base;
    }

    // Resolve which benefit tab is active for this category. Default
    // to the first benefit if no explicit selection.
    const attrs = c.attributes;
    const activeBenefitId =
      this._activeBenefitByCategory[collapseKey] &&
      attrs.some(
        (b) => b.id === this._activeBenefitByCategory[collapseKey]
      )
        ? this._activeBenefitByCategory[collapseKey]
        : attrs[0].id;

    const benefitTabs = attrs.map((b) => {
      const isActive = b.id === activeBenefitId;
      return {
        key: `${collapseKey}::${b.id}::tab`,
        catKey: collapseKey,
        benefitId: b.id,
        label: b.label,
        isActive,
        tabAriaSelected: String(isActive),
        tabTabIndex: isActive ? '0' : '-1',
        tabClass: isActive ? 'ebc-tab is-active' : 'ebc-tab'
      };
    });

    const activeBenefitCatalog = attrs.find((b) => b.id === activeBenefitId);
    const activeBenefit = activeBenefitCatalog
      ? this._decorateBenefit(
          activeBenefitCatalog,
          rootId,
          c.id,
          tierChips,
          isMultiTier,
          included
        )
      : null;

    return {
      ...base,
      benefitTabs,
      activeBenefit
    };
  }

  // Decorate the active Benefit for the tabpanel: emits one block per
  // tier (multi-tier) or a single flat block (`only`), each carrying
  // the composition-driven cost / deductible / waiver / limit / notes
  // rows.
  _decorateBenefit(b, rootId, categoryId, tierChips, isMultiTier, categoryIncluded) {
    const layout = b.layout === 'cost-slots' ? 'cost-slots' : 'native';
    const tierBlocks = tierChips.map((tier) => {
      const base = {
        key: `${b.id}::${tier.id}`,
        benefitId: b.id,
        tierId: tier.id,
        tierLabel: tier.displayLabel
      };
      if (layout === 'cost-slots') {
        return {
          ...base,
          ...this._decorateCostSlotsTier(b, tier, categoryIncluded)
        };
      }
      return {
        ...base,
        ...this._decorateNativeTier(b, tier, categoryIncluded)
      };
    });
    const panelKey = `${rootId}::${categoryId}::${b.id}::panel`;
    return {
      key: panelKey,
      benefitId: b.id,
      label: b.label,
      isMultiTier,
      isCostSlots: layout === 'cost-slots',
      isNative: layout === 'native',
      tierBlocks,
      // Convenience alias for the single-tier template branch.
      only: tierBlocks[0] || null
    };
  }

  // ── cost-slots layout ───────────────────────────────────────
  _decorateCostSlotsTier(b, tier, categoryIncluded) {
    const slotCount = b.costSlots === 2 ? 2 : 1;
    const costRows = [];
    for (let slot = 0; slot < slotCount; slot++) {
      costRows.push(
        this._decorateCostRow(b.id, tier.id, slot, categoryIncluded)
      );
    }

    const hasDeductible = b.showsDeductible !== false; // default true
    const deductibleRow = hasDeductible
      ? this._decorateDeductibleRow(b.id, tier.id, categoryIncluded)
      : null;

    const hasWaiver = b.showsWaiver !== false; // default true
    const waiverRow = hasWaiver
      ? this._decorateWaiverRow(b, tier, categoryIncluded)
      : null;

    const hasLimit = b.showsLimit !== false; // default true
    const limitRow = hasLimit
      ? this._decorateLimitRow(b.id, tier.id, categoryIncluded)
      : null;

    return {
      costRows,
      hasDeductible,
      deductibleRow,
      hasWaiver,
      waiverRow,
      hasLimit,
      limitRow,
      isTwoSlots: slotCount === 2
    };
  }

  _decorateCostRow(benefitId, tierId, slotIdx, categoryIncluded) {
    const key = _costKey(benefitId, tierId, slotIdx);
    // Slot 0 defaults to Copay, Slot 1 defaults to Coinsurance so
    // Urgent Care / Lab / Complex Imaging (costSlots=2) match the
    // mockup out of the box.
    const stored = this._costTypes[key];
    const costType =
      stored === 'copay' || stored === 'coinsurance'
        ? stored
        : slotIdx === 1
          ? 'coinsurance'
          : 'copay';
    const attrKey = `${benefitId}::${tierId}::${costType}::${slotIdx}`;
    const s = this._benefitState[attrKey] || {};
    const title = costType === 'copay' ? 'Copay' : 'Coinsurance';
    const subtitle = costType === 'copay' ? 'Currency ($)' : 'Percentage (%)';
    return {
      slot: String(slotIdx),
      key,
      benefitId,
      tierId,
      costType,
      isCopay: costType === 'copay',
      isCoinsurance: costType === 'coinsurance',
      attrKey,
      title,
      subtitle,
      value: s.value != null ? String(s.value) : '',
      valueDisabled: !categoryIncluded,
      costTypeOptions: COST_TYPE_OPTIONS.map((opt) => ({
        value: opt.value,
        label: opt.label,
        selected: opt.value === costType
      }))
    };
  }

  _decorateWaiverRow(b, tier, categoryIncluded) {
    const attrKey = `${b.id}::${tier.id}::deductible_waiver`;
    const s = this._benefitState[attrKey] || {};
    const label = b.waiverLabel || 'Deductible Waiver';
    const optionValues =
      Array.isArray(b.waiverOptions) && b.waiverOptions.length
        ? b.waiverOptions
        : DEDUCTIBLE_WAIVER_OPTIONS;
    return {
      title: label,
      subtitle: 'Picklist',
      label,
      attrKey,
      value: s.value != null ? String(s.value) : '',
      valueDisabled: !categoryIncluded,
      options: optionValues.map((opt) => ({
        value: opt,
        label: opt,
        selected: opt === (s.value || '')
      }))
    };
  }

  _decorateDeductibleRow(benefitId, tierId, categoryIncluded) {
    const attrKey = `${benefitId}::${tierId}::deductible`;
    const s = this._benefitState[attrKey] || {};
    return {
      title: 'Deductible',
      subtitle: 'Currency ($)',
      attrKey,
      value: s.value != null ? String(s.value) : '',
      valueDisabled: !categoryIncluded
    };
  }

  _decorateLimitRow(benefitId, tierId, categoryIncluded) {
    const attrKey = `${benefitId}::${tierId}::limit`;
    const s = this._benefitState[attrKey] || {};
    return {
      title: 'Limit',
      subtitle: 'Number',
      attrKey,
      value: s.value != null ? String(s.value) : '',
      valueDisabled: !categoryIncluded
    };
  }

  // ── native layout ───────────────────────────────────────────
  // One input per tier driven by the benefit's own dataType. Keeps
  // Dental / Vision benefits (percentage / currency / picklist)
  // working with the same broker mental model they had before the
  // Medical mockup adopted cost-slots.
  _decorateNativeTier(b, tier, categoryIncluded) {
    const attrKey = `${b.id}::${tier.id}`;
    const s = this._benefitState[attrKey] || {};
    const isCurrency = b.dataType === 'Currency';
    const isPercent = b.dataType === 'Percentage';
    const isPicklist = b.dataType === 'Picklist';
    const isText = b.dataType === 'Text';
    const isNumber = b.dataType === 'Number';
    const subtitle = isCurrency
      ? 'Currency ($)'
      : isPercent
        ? 'Percentage (%)'
        : isPicklist
          ? 'Picklist'
          : isText
            ? 'Text'
            : isNumber
              ? 'Number'
              : b.dataType || '';
    return {
      isNativeRow: true,
      nativeRow: {
        attrKey,
        title: b.label,
        subtitle,
        label: b.label,
        value: s.value != null ? String(s.value) : '',
        valueDisabled: !categoryIncluded,
        isCurrency,
        isPercent,
        isPicklist,
        isText,
        isNumber,
        options: isPicklist
          ? (b.options || []).map((opt) => ({
              value: opt,
              label: opt,
              selected: opt === (s.value || '')
            }))
          : []
      }
    };
  }
}
