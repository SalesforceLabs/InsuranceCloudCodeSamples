import { LightningElement, api, track } from 'lwc';

// c-hom-asset-tree - Homeowners Schedule of Property.
//
// Mirrors c-pa-asset-tree's roster mode: dwelling rows (Level 1) with an
// expandable scheduled personal property section (Level 2 - jewelry,
// fine art, collectibles). The workspace owns all edits; this component
// is presentational and dispatches typed events on user actions:
//
//   editdwellingrequest        { dwellingId }
//   removedwellingrequest      { dwellingId }
//   addscheduleditemrequest    { dwellingId }
//   editscheduleditemrequest   { itemId }
//   removescheduleditemrequest { itemId }
//
// Coverage editing lives in the sibling c-hom-coverage-setup component
// (HO coverages A-F sit at the policy level - unlike PA where coverage
// state is per-vehicle - so a coverage mode on the tree wasn't useful).

function formatCurrency(n) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '';
  return Number(n).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  });
}

export default class HomAssetTree extends LightningElement {
  @api mode = 'roster';
  @api dwellings = [];
  @api scheduledItems = [];
  // Named Insured (IPP) roster - siblings of Dwellings under the HO
  // Root per the HO-3 PCM.
  @api homeowners = [];

  // Which dwelling's overflow (row action) menu is open (one at a time).
  @track openMenuDwellingId = null;
  // Which homeowner's overflow (row action) menu is open (one at a time).
  @track openMenuHomeownerId = null;
  // Which scheduled-item's overflow (row action) menu is open (one at
  // a time). Mirrors dwelling / homeowner - moves the inline Edit +
  // Remove buttons into a single "Item actions" overflow so scheduled
  // items match the row-action pattern used elsewhere in the tree.
  @track openMenuItemId = null;
  // Which dwelling's scheduled-items section is expanded (single-open).
  @track openDwellingId = null;
  // Read-only view modal (eye icon on a dwelling / scheduled item / homeowner).
  @track viewOpen = false;
  @track viewKind = 'dwelling';
  @track viewHeading = '';
  @track viewSubtitle = '';
  @track viewFields = [];
  @track viewSummary = '';

  _docClickHandler = null;

  connectedCallback() {
    this._docClickHandler = this.handleDocClick.bind(this);
    document.addEventListener('click', this._docClickHandler);
  }

  disconnectedCallback() {
    if (this._docClickHandler) {
      document.removeEventListener('click', this._docClickHandler);
    }
  }

  get hasDwellings() {
    return Array.isArray(this.dwellings) && this.dwellings.length > 0;
  }

  get hasHomeowners() {
    return Array.isArray(this.homeowners) && this.homeowners.length > 0;
  }

  // "Homeowners (N)" section title - parity with "Schedule of Property
  // (N)" above and with c-pa-asset-tree's "Schedule of Vehicles (N)".
  get homeownersSectionTitle() {
    const n = Array.isArray(this.homeowners) ? this.homeowners.length : 0;
    return n > 0 ? `Homeowners (${n})` : 'Homeowners';
  }

  // Decorated dwelling tree - each row exposes its metadata + scheduled
  // personal property children grouped by parentId.
  get tree() {
    const grouped = {};
    (this.scheduledItems || []).forEach((s) => {
      if (!s.parentId) return;
      if (!grouped[s.parentId]) grouped[s.parentId] = [];
      grouped[s.parentId].push(s);
    });
    return (this.dwellings || []).map((dwl, idx) => {
      const items = grouped[dwl.id] || [];
      const expanded = this.openDwellingId === dwl.id;
      const isPending =
        !dwl.yearBuilt || !dwl.replacementCost || dwl.replacementCost === 0;
      return {
        key: dwl.id || `dwl-${idx}`,
        id: dwl.id,
        name: dwl.name || 'New Dwelling (Pending Details)',
        meta: this._composeDwellingMeta(dwl),
        replacementDisplay: formatCurrency(dwl.replacementCost),
        statusLabel: 'Draft',
        isDraft: isPending,
        statusClass: 'hom-asset-tree__status is-draft',
        expanded,
        chevronClass: expanded
          ? 'hom-asset-tree__chevron is-open'
          : 'hom-asset-tree__chevron',
        showBody: expanded,
        itemsCountLabel:
          items.length === 0
            ? 'No scheduled items'
            : `${items.length} scheduled item${items.length === 1 ? '' : 's'}`,
        hasItems: items.length > 0,
        menuOpen: this.openMenuDwellingId === dwl.id,
        items: items.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category || 'Scheduled Item',
          description: s.description || '',
          appraisedDisplay: formatCurrency(s.appraisedValue),
          menuOpen: this.openMenuItemId === s.id
        }))
      };
    });
  }

  _composeDwellingMeta(dwl) {
    const parts = [];
    if (dwl.yearBuilt) parts.push(`Built ${dwl.yearBuilt}`);
    if (dwl.sqFt) {
      const n = typeof dwl.sqFt === 'number' ? dwl.sqFt.toLocaleString() : dwl.sqFt;
      parts.push(`${n} sq ft`);
    }
    if (dwl.construction) parts.push(dwl.construction);
    if (dwl.occupancy) parts.push(dwl.occupancy);
    return parts.join(' · ');
  }

  // Decorated Homeowners view - one row per Named Insured.
  get homeownerTree() {
    return (this.homeowners || []).map((h, idx) => {
      const isPending = !h.dob || !h.maritalStatus;
      return {
        key: h.id || `h-${idx}`,
        id: h.id,
        name: h.name || `${h.firstName || ''} ${h.lastName || ''}`.trim() || 'New Homeowner',
        initials: this._composeInitials(h),
        meta: this._composeHomeownerMeta(h),
        role: h.role || 'Named Insured',
        isDraft: isPending,
        statusLabel: 'Draft',
        statusClass: 'hom-asset-tree__status is-draft',
        menuOpen: this.openMenuHomeownerId === h.id
      };
    });
  }

  _composeInitials(h) {
    const first = (h.firstName || h.name || '').charAt(0);
    const last = (h.lastName || (h.name || '').split(' ').slice(-1)[0] || '').charAt(0);
    return `${first}${last}`.toUpperCase() || '?';
  }

  _composeHomeownerMeta(h) {
    const parts = [];
    if (h.role) parts.push(h.role);
    if (h.dob) parts.push(`DOB ${this._formatDob(h.dob)}`);
    if (h.maritalStatus) parts.push(h.maritalStatus);
    if (h.priorCarrier) parts.push(`Prior: ${h.priorCarrier}`);
    return parts.join(' · ');
  }

  _formatDob(dob) {
    if (!dob) return '-';
    const parts = String(dob).split('-');
    if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`;
    return dob;
  }

  // ── Expand / collapse (single-open accordion) ───────────────────
  toggleDwelling(event) {
    const id = event.currentTarget.dataset.dwellingId;
    if (!id) return;
    this.openDwellingId = this.openDwellingId === id ? null : id;
  }

  // ── Overflow row-action menu ────────────────────────────────────
  toggleDwellingMenu(event) {
    event.stopPropagation();
    const id = event.currentTarget.dataset.dwellingId;
    this.openMenuDwellingId = this.openMenuDwellingId === id ? null : id;
    // Only one overflow menu open across the tree at a time.
    this.openMenuHomeownerId = null;
    this.openMenuItemId = null;
  }

  handleDwellingRowAction(event) {
    event.stopPropagation();
    const { dwellingId, action } = event.currentTarget.dataset;
    if (!dwellingId || !action) return;
    this.openMenuDwellingId = null;
    this.openMenuItemId = null;
    switch (action) {
      case 'add_scheduled_item':
        this.dispatchEvent(
          new CustomEvent('addscheduleditemrequest', {
            detail: { dwellingId },
            bubbles: true,
            composed: true
          })
        );
        // Auto-expand the dwelling so the freshly-added item is visible.
        this.openDwellingId = dwellingId;
        break;
      case 'edit_dwelling':
        this.dispatchEvent(
          new CustomEvent('editdwellingrequest', {
            detail: { dwellingId },
            bubbles: true,
            composed: true
          })
        );
        break;
      case 'delete_dwelling':
        this.dispatchEvent(
          new CustomEvent('removedwellingrequest', {
            detail: { dwellingId },
            bubbles: true,
            composed: true
          })
        );
        break;
      default:
        break;
    }
  }

  handleDwellingRowKeydown(event) {
    if (
      event.key === 'Enter' ||
      event.key === ' ' ||
      event.key === 'Spacebar'
    ) {
      event.preventDefault();
      this.handleDwellingRowAction(event);
    }
  }

  handleDocClick() {
    if (this.openMenuDwellingId !== null) {
      this.openMenuDwellingId = null;
    }
    if (this.openMenuHomeownerId !== null) {
      this.openMenuHomeownerId = null;
    }
    if (this.openMenuItemId !== null) {
      this.openMenuItemId = null;
    }
  }

  stopPropagation(event) {
    event.stopPropagation();
  }

  // ── Scheduled item row actions (overflow menu, single-open) ─────
  // Toggle the scheduled-item overflow menu (Edit Item / Remove Item).
  // Closes any other row-action menu to keep only one open at a time.
  toggleItemMenu(event) {
    event.stopPropagation();
    const id = event.currentTarget.dataset.itemId;
    this.openMenuItemId = this.openMenuItemId === id ? null : id;
    this.openMenuDwellingId = null;
    this.openMenuHomeownerId = null;
  }

  handleItemRowAction(event) {
    event.stopPropagation();
    const { itemId, action } = event.currentTarget.dataset;
    if (!itemId || !action) return;
    this.openMenuItemId = null;
    switch (action) {
      case 'edit_item':
        this.dispatchEvent(
          new CustomEvent('editscheduleditemrequest', {
            detail: { itemId },
            bubbles: true,
            composed: true
          })
        );
        break;
      case 'remove_item':
        this.dispatchEvent(
          new CustomEvent('removescheduleditemrequest', {
            detail: { itemId },
            bubbles: true,
            composed: true
          })
        );
        break;
      default:
        break;
    }
  }

  // Keyboard partner for handleItemRowAction (Enter / Space activation),
  // matching the handleVehicleRowKeydown / handleDwellingRowKeydown
  // pattern on the sibling row menus.
  handleItemRowKeydown(event) {
    if (
      event.key === 'Enter' ||
      event.key === ' ' ||
      event.key === 'Spacebar'
    ) {
      event.preventDefault();
      this.handleItemRowAction(event);
    }
  }

  // ── Homeowner row actions ───────────────────────────────────────
  toggleHomeownerMenu(event) {
    event.stopPropagation();
    const id = event.currentTarget.dataset.homeownerId;
    this.openMenuHomeownerId =
      this.openMenuHomeownerId === id ? null : id;
    // Only one overflow menu open across the tree at a time.
    this.openMenuDwellingId = null;
    this.openMenuItemId = null;
  }

  handleHomeownerRowAction(event) {
    event.stopPropagation();
    const { homeownerId, action } = event.currentTarget.dataset;
    if (!homeownerId || !action) return;
    this.openMenuHomeownerId = null;
    switch (action) {
      case 'edit_homeowner':
        this.dispatchEvent(
          new CustomEvent('edithomeownerrequest', {
            detail: { homeownerId },
            bubbles: true,
            composed: true
          })
        );
        break;
      case 'delete_homeowner':
        this.dispatchEvent(
          new CustomEvent('removehomeownerrequest', {
            detail: { homeownerId },
            bubbles: true,
            composed: true
          })
        );
        break;
      default:
        break;
    }
  }

  handleViewHomeowner(event) {
    event.stopPropagation();
    const id = event.currentTarget.dataset.homeownerId;
    const h = (this.homeowners || []).find((x) => x.id === id);
    if (!h) return;
    this.viewKind = 'homeowner';
    this.viewHeading = h.name || 'Homeowner';
    this.viewSubtitle = h.role || 'Homeowner';
    this.viewFields = [
      { label: 'First Name', value: h.firstName || '-' },
      { label: 'Last Name', value: h.lastName || '-' },
      { label: 'Role', value: h.role || '-' },
      { label: 'Date of Birth', value: this._formatDob(h.dob) || '-' },
      { label: 'Marital Status', value: h.maritalStatus || '-' },
      { label: 'Prior Carrier', value: h.priorCarrier || '-' }
    ];
    this.viewSummary = '';
    this.viewOpen = true;
  }

  // ── Read-only view modal (eye icon) ─────────────────────────────
  handleViewDwelling(event) {
    event.stopPropagation();
    const id = event.currentTarget.dataset.dwellingId;
    const dwl = (this.dwellings || []).find((d) => d.id === id);
    if (!dwl) return;
    this.viewKind = 'dwelling';
    this.viewHeading = dwl.name || dwl.address || 'Dwelling';
    this.viewSubtitle = 'Dwelling';
    this.viewFields = [
      { label: 'Address', value: dwl.address || '-' },
      { label: 'Year Built', value: dwl.yearBuilt || '-' },
      { label: 'Square Footage', value: dwl.sqFt || '-' },
      { label: 'Construction', value: dwl.construction || '-' },
      { label: 'Roof Type', value: dwl.roofType || '-' },
      { label: 'Roof Year', value: dwl.roofYear || '-' },
      { label: 'Occupancy', value: dwl.occupancy || '-' },
      {
        label: 'Replacement Cost',
        value: formatCurrency(dwl.replacementCost) || '-'
      },
      { label: 'Protection Class', value: dwl.protectionClass || '-' },
      { label: 'Distance to Coast', value: dwl.distanceToCoast || '-' },
      { label: 'Distance to Fire Station', value: dwl.distanceToFireStation || '-' },
      { label: 'Alarm System', value: dwl.alarmSystem || '-' },
      { label: 'Prior Losses', value: String(dwl.priorLosses ?? '-') }
    ];
    this.viewSummary = '';
    this.viewOpen = true;
  }

  handleViewItem(event) {
    event.stopPropagation();
    const id = event.currentTarget.dataset.itemId;
    const s = (this.scheduledItems || []).find((x) => x.id === id);
    if (!s) return;
    this.viewKind = 'item';
    this.viewHeading = s.name || 'Scheduled Item';
    this.viewSubtitle = 'Scheduled Item';
    this.viewFields = [
      { label: 'Category', value: s.category || '-' },
      { label: 'Description', value: s.description || '-' },
      {
        label: 'Appraised Value',
        value: formatCurrency(s.appraisedValue) || '-'
      },
      { label: 'Appraisal Date', value: s.appraisalDate || '-' },
      { label: 'Appraised By', value: s.appraisedBy || '-' }
    ];
    this.viewSummary = '';
    this.viewOpen = true;
  }

  handleViewClose() {
    this.viewOpen = false;
  }
}
