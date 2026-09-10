import { LightningElement, api, track } from 'lwc';

/**
 * c-attribute-picker
 *
 * Shared attribute-list primitive for setup wizards. Renders a
 * progressive-disclosure list:
 *
 *   [✓] Select All (45 of 47 Selected)   [🔍 Find attribute…]   [Show all]
 *   [x] VIN
 *   [x] Year
 *   [x] Make                           ← only currently-selected rows
 *   ...                                  render while collapsed
 *
 * Collapsed state shows only the rows the admin has ticked - the
 * "here is what will ship" summary. Clicking `Show all` reveals
 * every attribute; the button flips to `Hide`. Typing in the
 * search bar (which is always visible in the header) also auto-
 * expands the list so the admin can find unselected attributes.
 *
 * The Select-all master checkbox is tri-state:
 *   • empty         → click selects every attribute in scope
 *   • indeterminate → click clears every attribute in scope
 *   • checked       → click clears every attribute in scope
 * (In other words: any non-empty state clears; only empty selects.)
 *
 * ── Consumer contract ─────────────────────────────────────────
 * Rule (app-wide, no exceptions):
 *   1. `Select All` selected by default. Consumers must seed
 *      `selected-ids` with every leaf id on first render, so the
 *      admin lands on the "all-checked" state and unticks what
 *      they don't want.
 *   2. `Show all` NOT opened by default. The picker owns its own
 *      expanded state (`_expanded = false` initial) and there is
 *      no `default-expanded` prop. Consumers must never force
 *      expansion at mount - Show all is admin-initiated only.
 * See docs / .cursor rule `attribute-picker-defaults.mdc`.
 *
 * Row markup is intentionally minimal: checkbox + label + optional
 * badge. No per-row eye/preview icons.
 *
 * Public API:
 *
 *   Props
 *     attributes      - flat: [{ id, label, badge? }]
 *                       tree: [{ id, label, children: [{ id, label, badge? }] }]
 *     selected-ids    - array of leaf ids currently selected
 *     enable-reorder  - boolean, gate for grip + arrows + drag
 *     ordering        - required when enable-reorder is true;
 *                       array of ids in display sequence
 *     enable-search   - retained for backward-compat but no longer
 *                       gates visibility - the picker now renders
 *                       the search bar unconditionally so the
 *                       header experience is consistent across
 *                       every consumer (previously hidden for
 *                       lists shorter than SEARCH_AUTO_THRESHOLD,
 *                       which produced an inconsistent surface)
 *     group-mode      - 'none' | 'tree' (default 'none')
 *
 *   Events
 *     attrtoggle      - detail: { id, isChecked }
 *     selectallchange - detail: { isChecked, ids }
 *     attrreorder     - detail: { id, direction: 'up' | 'down' }
 *     attrreordermove - detail: { order }  (full new ordering after drag)
 *     searchchange    - detail: { query }
 */

// Historical threshold kept as a documented constant for reference
// (the picker used to auto-hide search when totalCount was <= 5).
// The threshold no longer gates rendering - see `get showSearch`
// below - because brokers reported a jarring inconsistency where
// the summary-widgets picker (5 items) had no search while the
// metrics picker (7+ items) did. Search is now always visible so
// the picker header reads identically everywhere.
const SEARCH_AUTO_THRESHOLD = 5;

export default class AttributePicker extends LightningElement {
  // ── Props ──────────────────────────────────────────────────
  @api enableReorder = false;
  @api enableSearch = false;
  @api groupMode = 'none';

  _attributes = [];
  _selectedIds = [];
  _ordering = [];
  _attrScopeKey = '';

  @api
  get attributes() { return this._attributes; }
  set attributes(val) {
    const next = Array.isArray(val) ? val : [];
    this._attributes = next;
    // Reset transient view state (search + expand) only when the
    // underlying id-set genuinely changes - i.e., the parent has
    // swapped scope (a new tab, section, or step). If the same
    // array is re-passed on unrelated re-renders we keep the
    // admin's current view open.
    const key = next.map((a) => a && a.id).join('|');
    if (key !== this._attrScopeKey) {
      this._attrScopeKey = key;
      this._searchQuery = '';
      this._expanded = false;
    }
    this._seedExpandedParents();
  }

  @api
  get selectedIds() { return this._selectedIds; }
  set selectedIds(val) {
    this._selectedIds = Array.isArray(val) ? [...val] : [];
  }

  @api
  get ordering() { return this._ordering; }
  set ordering(val) {
    this._ordering = Array.isArray(val) ? [...val] : [];
  }

  // ── Internal state ─────────────────────────────────────────
  @track _searchQuery = '';
  @track _expanded = false;
  @track _expandedParents = {};
  _dragSrcIdx = null;

  connectedCallback() {
    this._seedExpandedParents();
  }

  _seedExpandedParents() {
    if (!this.isTreeMode) return;
    // Only write when there is an actually-new parent id to seed;
    // otherwise a new object reference every re-render will loop
    // against parents that return a fresh `attributes` array each
    // tick.
    let changed = false;
    const next = { ...this._expandedParents };
    for (const p of this._attributes) {
      if (p && !(p.id in next)) {
        next[p.id] = true;
        changed = true;
      }
    }
    if (changed) this._expandedParents = next;
  }

  // ── Derived: modes and counts ──────────────────────────────
  get isTreeMode() { return this.groupMode === 'tree'; }
  get isFlatMode() { return !this.isTreeMode; }

  // Every leaf id across the picker, regardless of tree vs flat.
  get _allLeafIds() {
    if (this.isTreeMode) {
      const ids = [];
      for (const p of this._attributes) {
        for (const c of (p.children || [])) ids.push(c.id);
      }
      return ids;
    }
    return this._attributes.map((a) => a.id);
  }
  get _selectedSet() {
    return new Set(this._selectedIds);
  }
  get totalCount() { return this._allLeafIds.length; }
  get selectedCount() { return this._allLeafIds.filter((id) => this._selectedSet.has(id)).length; }

  // ── Expand / collapse ──────────────────────────────────────
  get isExpanded() { return this._expanded; }
  get toggleLabel() { return this._expanded ? 'Hide' : 'Show all'; }
  get toggleAriaLabel() {
    return this._expanded
      ? 'Hide attribute list'
      : `Show all ${this.totalCount} attributes`;
  }
  get toggleAriaExpanded() { return String(this._expanded); }

  // ── Derived: search + filter ───────────────────────────────
  // Search bar is always visible in the header. Consumers used to
  // see it appear/disappear based on list length (>5 items),
  // which produced an inconsistent header across pickers
  // (Fixed Summary Widgets = 5 items, no search; Metrics = 7+
  // items, search). Rendering unconditionally keeps the header
  // shape identical everywhere. Typing while the list is
  // collapsed auto-expands it so unselected matches can surface.
  get showSearch() {
    return true;
  }
  get isFiltering() { return this._searchQuery.trim().length > 0; }
  get searchQuery() { return this._searchQuery; }
  get showClearSearch() { return this.isFiltering; }

  _matchesQuery(label) {
    if (!this.isFiltering) return true;
    const q = this._searchQuery.trim().toLowerCase();
    return String(label || '').toLowerCase().includes(q);
  }

  get _filteredFlatAttributes() {
    if (this.isTreeMode) return this._attributes;
    const list = this._attributes.filter((a) => this._matchesQuery(a.label));
    // Reorder view - ticked+ordered rows float to top in display
    // sequence so numbered badges read in order.
    if (!this.enableReorder || this._ordering.length === 0) return list;
    const rank = (a) => {
      const i = this._ordering.indexOf(a.id);
      return i >= 0 ? i : Number.MAX_SAFE_INTEGER;
    };
    return [...list]
      .map((a, i) => ({ a, i, r: rank(a) }))
      .sort((x, y) => (x.r - y.r) || (x.i - y.i))
      .map((e) => e.a);
  }

  // ── Header view-model ──────────────────────────────────────
  // Header label reads "Select All (3 of 10 Selected)" - verb-
  // first CTA with the count meter parenthesised. Total always
  // reflects the full asset/tab, never the filtered view, so the
  // admin sees their overall coverage regardless of search state.
  get selectAllLabel() {
    return `Select All (${this.selectedCount} of ${this.totalCount} Selected)`;
  }
  // Screen readers get a verb-first label so the master checkbox
  // still reads as an action, not just a status meter. Sighted
  // users get the compact "X of Y Selected" visual label above.
  get selectAllA11yLabel() {
    if (this.selectAllChecked || this.selectAllIndeterminate) {
      return `Clear all attributes (${this.selectedCount} of ${this.totalCount} selected)`;
    }
    return `Select all ${this.totalCount} attributes`;
  }

  get _treeFilteredLeafCount() {
    if (!this.isTreeMode) return 0;
    let n = 0;
    for (const p of this._attributes) {
      const parentMatch = this._matchesQuery(p.label);
      for (const c of (p.children || [])) {
        if (parentMatch || this._matchesQuery(c.label)) n += 1;
      }
    }
    return n;
  }

  // Tri-state select-all. Filter-aware when expanded + filtering;
  // otherwise applies to the full set.
  get _selectAllScope() {
    if (this.isTreeMode) {
      const ids = [];
      for (const p of this._attributes) {
        const parentMatch = this._matchesQuery(p.label);
        for (const c of (p.children || [])) {
          if (parentMatch || this._matchesQuery(c.label)) ids.push(c.id);
        }
      }
      return ids;
    }
    return this._filteredFlatAttributes.map((a) => a.id);
  }
  get selectAllChecked() {
    const scope = this._selectAllScope;
    if (scope.length === 0) return false;
    const sel = this._selectedSet;
    return scope.every((id) => sel.has(id));
  }
  get selectAllIndeterminate() {
    const scope = this._selectAllScope;
    if (scope.length === 0) return false;
    const sel = this._selectedSet;
    const any = scope.some((id) => sel.has(id));
    const all = scope.every((id) => sel.has(id));
    return any && !all;
  }
  get selectAllAriaChecked() {
    if (this.selectAllIndeterminate) return 'mixed';
    return this.selectAllChecked ? 'true' : 'false';
  }
  get selectAllCheckClass() {
    const base = 'ap__check-faux';
    if (this.selectAllChecked) return `${base} is-on`;
    if (this.selectAllIndeterminate) return `${base} is-mixed`;
    return base;
  }

  // ── Flat list view-model ───────────────────────────────────
  // When expanded, every attribute matching the current search is
  // rendered. When collapsed, only currently-selected attributes
  // render - the admin sees exactly what will ship without being
  // buried in unselected rows. Exception: if _every_ attribute is
  // selected (e.g., after clicking Select All), we do NOT list all
  // of them; instead the "all-selected" hint below the header
  // handles it so a bulk tick never visually "opens the list".
  get flatRows() {
    if (!this.isFlatMode) return [];
    if (this.showCollapsedAllSelected) return [];
    const filtered = this._filteredFlatAttributes;
    const sel = this._selectedSet;
    const visible = this._expanded
      ? filtered
      : filtered.filter((a) => sel.has(a.id));
    const rows = [];
    for (let i = 0; i < visible.length; i += 1) {
      const a = visible[i];
      const isChecked = sel.has(a.id);
      const orderPos = this.enableReorder ? this._ordering.indexOf(a.id) : -1;
      const isOrdered = this.enableReorder && isChecked && orderPos >= 0;
      const cls = [
        'ap__row',
        isChecked ? 'is-checked' : '',
        isOrdered ? 'is-ordered' : ''
      ].filter(Boolean).join(' ');
      rows.push({
        id: a.id,
        label: a.label,
        badge: a.badge || '',
        showBadge: !!a.badge,
        isChecked,
        checkAriaChecked: isChecked ? 'true' : 'false',
        checkClass: isChecked ? 'ap__check-faux is-on' : 'ap__check-faux',
        rowClass: cls,
        canReorder: isOrdered,
        orderIdx: isOrdered ? orderPos : null,
        dragAttr: isOrdered ? 'true' : 'false',
        isFirst: orderPos === 0,
        isLast: orderPos === this._ordering.length - 1
      });
    }
    return rows;
  }
  get isEmptyFiltered() {
    if (!this.isFiltering) return false;
    return this.isTreeMode
      ? this._treeFilteredLeafCount === 0
      : this._filteredFlatAttributes.length === 0;
  }
  get emptyFilteredCopy() {
    return `No attributes match "${this._searchQuery.trim()}".`;
  }
  // Shown while collapsed and nothing is selected yet - keeps the
  // picker from rendering as a blank strip and hints at the next
  // action.
  get showCollapsedEmpty() {
    if (this._expanded) return false;
    if (this.isFiltering) return false;
    return this.selectedCount === 0;
  }
  get collapsedEmptyCopy() {
    return 'No attributes selected. Click Show all to browse.';
  }
  // Shown while collapsed and every attribute is selected. This
  // is the counterpart to showCollapsedEmpty: bulk-ticking Select
  // All should NOT visually open the list; instead we render a
  // one-line summary and defer full row rendering to Show all.
  get showCollapsedAllSelected() {
    if (this._expanded) return false;
    if (this.isFiltering) return false;
    if (this.totalCount === 0) return false;
    return this.selectedCount === this.totalCount;
  }
  get collapsedAllSelectedCopy() {
    return `All ${this.totalCount} attributes selected. Click Show all to review.`;
  }

  // ── Tree view-model ────────────────────────────────────────
  // Same progressive-disclosure rule as flat mode: when collapsed,
  // only groups with at least one selected leaf render, and only
  // the selected leaves show inside each group. Expanding reveals
  // the full tree. Exception: bulk Select All → all-selected hint
  // takes over (see showCollapsedAllSelected).
  get treeRows() {
    if (!this.isTreeMode) return [];
    if (this.showCollapsedAllSelected) return [];
    const sel = this._selectedSet;
    return this._attributes.map((parent) => {
      const children = (parent.children || []);
      const parentMatch = this._matchesQuery(parent.label);
      let visibleChildren = this.isFiltering
        ? children.filter((c) => parentMatch || this._matchesQuery(c.label))
        : children;
      if (!this._expanded) {
        visibleChildren = visibleChildren.filter((c) => sel.has(c.id));
      }
      if (visibleChildren.length === 0) return null;
      if (this.isFiltering && visibleChildren.length === 0 && !parentMatch) {
        return null;
      }
      const onCount = children.reduce((n, c) => n + (sel.has(c.id) ? 1 : 0), 0);
      const total = children.length;
      const all = total > 0 && onCount === total;
      const none = onCount === 0;
      const mixed = !all && !none;
      const expanded = !!this._expandedParents[parent.id];
      let checkCls = 'ap__check-faux';
      if (all) checkCls += ' is-on';
      if (mixed) checkCls += ' is-mixed';
      let ariaChecked = 'false';
      if (all) ariaChecked = 'true';
      else if (mixed) ariaChecked = 'mixed';
      return {
        id: parent.id,
        label: parent.label,
        badge: parent.badge || '',
        showBadge: !!parent.badge,
        expanded,
        chevronCls: expanded
          ? 'ap__tree-chevron-icon is-open'
          : 'ap__tree-chevron-icon',
        ariaExpanded: String(expanded),
        rowCls: expanded
          ? 'ap__row ap__row_lvl-0 is-open'
          : 'ap__row ap__row_lvl-0',
        parentAllChecked: all,
        parentAriaChecked: ariaChecked,
        parentCheckClass: checkCls,
        children: visibleChildren.map((c) => {
          const isChecked = sel.has(c.id);
          return {
            id: c.id,
            label: c.label,
            badge: c.badge || '',
            showBadge: !!c.badge,
            isChecked,
            checkAriaChecked: isChecked ? 'true' : 'false',
            checkClass: isChecked ? 'ap__check-faux is-on' : 'ap__check-faux'
          };
        })
      };
    }).filter(Boolean);
  }

  // ── Root class ────────────────────────────────────────────
  get rootClass() {
    const cls = ['ap'];
    if (this.isTreeMode) cls.push('ap_tree');
    if (this.enableReorder) cls.push('ap_reorder');
    if (this._expanded) cls.push('is-expanded');
    return cls.join(' ');
  }

  // ── Handlers: expand / collapse ───────────────────────────
  handleToggleExpand() {
    this._expanded = !this._expanded;
    // Collapsing wipes any active filter so the next expand starts
    // from a clean state.
    if (!this._expanded) this._searchQuery = '';
  }

  // ── Handlers: toggle rows ─────────────────────────────────
  handleAttrToggle(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    const sel = new Set(this._selectedIds);
    const isChecked = !sel.has(id);
    if (isChecked) sel.add(id); else sel.delete(id);
    this.dispatchEvent(
      new CustomEvent('attrtoggle', { detail: { id, isChecked } })
    );
  }

  // ── Handlers: select-all ──────────────────────────────────
  // Tri-state semantics:
  //   • unchecked    → select every id in scope
  //   • indeterminate → clear every id in scope
  //   • checked      → clear every id in scope
  // i.e. only the fully-empty state triggers a bulk select; every
  // other click clears. This matches the pattern used across setup
  // wizards - "any dot in the box means one more click clears".
  handleSelectAllToggle() {
    const scope = this._selectAllScope;
    if (scope.length === 0) return;
    const hasAnySelection = this.selectAllChecked || this.selectAllIndeterminate;
    const isChecked = !hasAnySelection;
    this.dispatchEvent(
      new CustomEvent('selectallchange', {
        detail: { isChecked, ids: scope }
      })
    );
  }

  // ── Handlers: search ──────────────────────────────────────
  // Typing while collapsed auto-expands the list so unselected
  // matches can surface - otherwise the admin would be searching
  // against only the already-checked rows.
  handleSearchInput(event) {
    this._searchQuery = event.target.value || '';
    if (this._searchQuery.trim().length > 0 && !this._expanded) {
      this._expanded = true;
    }
    this.dispatchEvent(
      new CustomEvent('searchchange', { detail: { query: this._searchQuery } })
    );
  }
  handleClearSearch() {
    this._searchQuery = '';
    this.dispatchEvent(
      new CustomEvent('searchchange', { detail: { query: '' } })
    );
    const input = this.template.querySelector('.ap__search-input');
    if (input) input.focus();
  }

  // ── Handlers: reorder ─────────────────────────────────────
  handleMoveUp(event) {
    const idx = parseInt(event.currentTarget.dataset.idx, 10);
    if (Number.isNaN(idx) || idx <= 0) return;
    const id = this._ordering[idx];
    if (!id) return;
    this.dispatchEvent(
      new CustomEvent('attrreorder', { detail: { id, direction: 'up' } })
    );
  }
  handleMoveDown(event) {
    const idx = parseInt(event.currentTarget.dataset.idx, 10);
    if (Number.isNaN(idx) || idx >= this._ordering.length - 1) return;
    const id = this._ordering[idx];
    if (!id) return;
    this.dispatchEvent(
      new CustomEvent('attrreorder', { detail: { id, direction: 'down' } })
    );
  }
  handleDragStart(event) {
    const idx = parseInt(event.currentTarget.dataset.idx, 10);
    if (Number.isNaN(idx)) return;
    this._dragSrcIdx = idx;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      try { event.dataTransfer.setData('text/plain', String(idx)); } catch (e) {
        // Safari can throw on setData for non-input drag sources.
      }
    }
  }
  handleDragOver(event) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }
  handleDrop(event) {
    event.preventDefault();
    const targetIdx = parseInt(event.currentTarget.dataset.idx, 10);
    const srcIdx = this._dragSrcIdx;
    this._dragSrcIdx = null;
    if (Number.isNaN(targetIdx) || srcIdx === null || srcIdx === targetIdx) return;
    const next = [...this._ordering];
    const [moved] = next.splice(srcIdx, 1);
    next.splice(targetIdx, 0, moved);
    this.dispatchEvent(
      new CustomEvent('attrreordermove', { detail: { order: next } })
    );
  }
  handleDragEnd() {
    this._dragSrcIdx = null;
  }

  // ── Handlers: tree expand/collapse + parent toggle ────────
  handleTreeExpand(event) {
    event.preventDefault();
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this._expandedParents = {
      ...this._expandedParents,
      [id]: !this._expandedParents[id]
    };
  }
  handleTreeParentToggle(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    const parent = this._attributes.find((p) => p.id === id);
    if (!parent) return;
    const children = (parent.children || []).map((c) => c.id);
    if (children.length === 0) return;
    const sel = this._selectedSet;
    const allOn = children.every((cid) => sel.has(cid));
    const isChecked = !allOn;
    this.dispatchEvent(
      new CustomEvent('selectallchange', {
        detail: { isChecked, ids: children }
      })
    );
  }
}
