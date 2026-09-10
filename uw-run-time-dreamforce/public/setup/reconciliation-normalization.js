// Reconciliation And Normalization
// Three constructs: Entities, Coverages, LOB Hierarchies.
// All user-supplied strings are routed through esc() before being placed in markup.

let rnEntities = [];
let nextRnEntityId = 1;
let rnCoverages = [];
let nextRnCoverageId = 1;
let rnHierarchies = [];
let nextRnHierarchyId = 1;

let rnActiveTab = 'hierarchies';
let rnSelectedEntityId = null;
let rnSelectedCoverageId = null;

const RN_LOB_OPTIONS = ['Property', 'General Liability', 'Commercial Auto', 'Workers Compensation', 'Cyber'];
const RN_RESOLUTION_STRATEGIES = ['Most Common', 'Source Priority', 'Most Recent', 'Always Flag'];
const RN_ATTR_TYPES = [
  'Text',
  'Long Text Area',
  'Number',
  'Currency',
  'Percent',
  'Date',
  'Date/Time',
  'Boolean',
  'Picklist',
  'Email',
  'Phone',
  'URL',
];

// ─── SLDS-styled prompt + confirm modals ─────────────────────────
// rnShowPromptModal({ title, fields, primaryLabel, onSubmit })
//   fields: [{ key, label, type: 'text'|'select', options?, value, required, placeholder }]
function rnShowPromptModal(opts) {
  const fields = (opts.fields || []).map((f, i) => ({
    key: f.key,
    label: f.label || '',
    type: f.type || 'text',
    options: f.options || [],
    value: f.value ?? '',
    required: !!f.required,
    placeholder: f.placeholder || '',
    autofocus: i === 0,
  }));
  const fieldHtml = fields.map(f => {
    const id = `rn-modal-fld-${f.key}`;
    if (f.type === 'select') {
      const opts = f.options.map(o => `<option value="${esc(o)}" ${o === f.value ? 'selected' : ''}>${esc(o)}</option>`).join('');
      return `
        <div class="rn-form-row">
          <label class="rn-form-label" for="${id}">${esc(f.label)}${f.required ? ' *' : ''}</label>
          <select class="rn-form-select" id="${id}" data-rn-key="${esc(f.key)}">${opts}</select>
        </div>`;
    }
    return `
      <div class="rn-form-row">
        <label class="rn-form-label" for="${id}">${esc(f.label)}${f.required ? ' *' : ''}</label>
        <input type="text" class="rn-input" id="${id}" data-rn-key="${esc(f.key)}" value="${esc(f.value)}" placeholder="${esc(f.placeholder)}" />
      </div>`;
  }).join('');

  const html = `
    <div class="modal-overlay" id="rn-prompt-overlay" onclick="if(event.target===this) rnClosePromptModal()">
      <div class="modal" style="max-width: 460px;">
        <div class="modal-header">
          <h3>${esc(opts.title || 'Edit')}</h3>
          <button class="modal-close" onclick="rnClosePromptModal()">&times;</button>
        </div>
        <div class="modal-body" id="rn-prompt-body" style="padding: 18px 20px;">
          ${fieldHtml}
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" onclick="rnClosePromptModal()">Cancel</button>
          <button class="btn-new" id="rn-prompt-submit">${esc(opts.primaryLabel || 'Save')}</button>
        </div>
      </div>
    </div>`;
  document.getElementById('rn-prompt-overlay')?.remove();
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('rn-prompt-submit').onclick = () => {
    const body = document.getElementById('rn-prompt-body');
    const result = {};
    body.querySelectorAll('[data-rn-key]').forEach(el => {
      result[el.getAttribute('data-rn-key')] = (el.value || '').trim();
    });
    // Required validation — inline error inside the modal
    const errEl = document.getElementById('rn-prompt-error');
    if (errEl) errEl.remove();
    const missing = fields.find(f => f.required && !result[f.key]);
    if (missing) {
      const err = document.createElement('div');
      err.id = 'rn-prompt-error';
      err.className = 'rn-form-error';
      err.textContent = `${missing.label} is required.`;
      body.appendChild(err);
      return;
    }
    rnClosePromptModal();
    Promise.resolve(opts.onSubmit?.(result));
  };
  setTimeout(() => {
    const first = document.querySelector('#rn-prompt-body [data-rn-key]');
    first?.focus();
    if (first?.tagName === 'INPUT') first.select();
  }, 0);
}

function rnClosePromptModal() {
  document.getElementById('rn-prompt-overlay')?.remove();
}

// rnShowConfirmModal({ title, message, danger, primaryLabel, onConfirm })
function rnShowConfirmModal(opts) {
  const html = `
    <div class="modal-overlay" id="rn-confirm-overlay" onclick="if(event.target===this) rnCloseConfirmModal()">
      <div class="modal" style="max-width: 440px;">
        <div class="modal-header">
          <h3>${esc(opts.title || 'Confirm')}</h3>
          <button class="modal-close" onclick="rnCloseConfirmModal()">&times;</button>
        </div>
        <div class="modal-body" style="padding: 18px 20px; font-size: 13px; color: #2e2e2e; line-height: 18px;">
          ${esc(opts.message || 'Are you sure?')}
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" onclick="rnCloseConfirmModal()">Cancel</button>
          <button class="${opts.danger ? 'btn-new rn-modal-danger-btn' : 'btn-new'}" id="rn-confirm-submit">${esc(opts.primaryLabel || (opts.danger ? 'Delete' : 'Confirm'))}</button>
        </div>
      </div>
    </div>`;
  document.getElementById('rn-confirm-overlay')?.remove();
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('rn-confirm-submit').onclick = () => {
    rnCloseConfirmModal();
    Promise.resolve(opts.onConfirm?.());
  };
}

function rnCloseConfirmModal() {
  document.getElementById('rn-confirm-overlay')?.remove();
}

function rnIconBtn(iconName, label, onclick, opts) {
  const danger = !!(opts && opts.danger);
  const cls = `slds-button slds-button_icon slds-button_icon-border-filled slds-button_icon-x-small rn-row-icon-btn${danger ? ' rn-row-icon-btn-danger' : ''}`;
  return `<button class="${cls}" title="${esc(label)}" aria-label="${esc(label)}" onclick="event.stopPropagation(); ${onclick}">
      <svg class="slds-button__icon slds-button__icon_x-small" aria-hidden="true">
        <use href="/assets/salesforce-lightning-design-system/icons/utility-sprite/svg/symbols.svg#${iconName}" />
      </svg>
    </button>`;
}

async function persistRn() {
  setRnEntities(rnEntities);
  setNextRnEntityId(nextRnEntityId);
  setRnCoverages(rnCoverages);
  setNextRnCoverageId(nextRnCoverageId);
  setRnHierarchies(rnHierarchies);
  setNextRnHierarchyId(nextRnHierarchyId);
  await saveConfig();
}

function renderReconciliationNormalization() {
  const container = document.getElementById('rn-content');
  if (!container) return;
  container.innerHTML = `
    <div class="rn-page">
      <div class="rn-page-header">
        <h1>Reconciliation And Normalization</h1>
        <p>Configure entities, coverages, and per-LOB hierarchies used to reconcile and normalize submission line data at runtime.</p>
      </div>
      <div class="rn-tabs">
        ${renderRnTab('hierarchies', 'LOB Hierarchies')}
        ${renderRnTab('entities', 'Entities')}
        ${renderRnTab('coverages', 'Coverages')}
      </div>
      <div id="rn-tab-content" class="rn-tab-content"></div>
    </div>`;
  renderRnActiveTab();
}

function renderRnTab(key, label) {
  const isActive = rnActiveTab === key;
  return `<button class="rn-tab ${isActive ? 'active' : ''}" onclick="switchRnTab('${key}')">${esc(label)}</button>`;
}

function switchRnTab(key) {
  rnActiveTab = key;
  renderReconciliationNormalization();
}

function renderRnActiveTab() {
  if (rnActiveTab === 'hierarchies') return renderRnHierarchiesList();
  if (rnActiveTab === 'entities') return renderRnEntitiesTab();
  if (rnActiveTab === 'coverages') return renderRnCoveragesTab();
}

// ── Entities ─────────────────────────────────────────────────

function renderRnEntitiesTab() {
  const host = document.getElementById('rn-tab-content');
  if (!host) return;
  if (rnSelectedEntityId == null && rnEntities.length > 0) rnSelectedEntityId = rnEntities[0].id;
  host.innerHTML = `
    <div class="rn-md">
      <div class="rn-md-list">
        <div class="rn-md-list-header">
          <h2>Entities</h2>
          <button class="btn-new" onclick="rnCreateEntity()">New</button>
        </div>
        <div class="rn-md-list-items">${renderRnEntityListItems()}</div>
      </div>
      <div class="rn-md-detail" id="rn-entity-detail">${renderRnEntityDetail()}</div>
    </div>`;
}

function renderRnEntityListItems() {
  if (rnEntities.length === 0) {
    return `<div class="rn-empty">No entities yet. Click <strong>New</strong> to create one.</div>`;
  }
  return rnEntities.map(e => {
    const active = rnSelectedEntityId === e.id;
    const count = (e.attributes || []).length;
    return `
      <div class="rn-list-item ${active ? 'active' : ''}" onclick="rnSelectEntity(${e.id})">
        <div class="rn-list-item-text">
          <span class="rn-list-name">${esc(e.name)}</span>
          <span class="rn-list-meta">${count} attribute${count === 1 ? '' : 's'}</span>
        </div>
      </div>`;
  }).join('');
}

function rnSelectEntity(id) { rnSelectedEntityId = id; renderRnEntitiesTab(); }

function rnCreateEntity() {
  rnShowPromptModal({
    title: 'New Entity',
    primaryLabel: 'Create',
    fields: [{ key: 'name', label: 'Entity Name', placeholder: 'e.g. Location, Building, Equipment', required: true }],
    onSubmit: async ({ name }) => {
      const id = nextRnEntityId++;
      rnEntities.push({ id, name, attributes: [] });
      rnSelectedEntityId = id;
      await persistRn();
      renderRnEntitiesTab();
    },
  });
}

function rnRenameEntity(id) {
  const ent = rnEntities.find(e => e.id === id);
  if (!ent) return;
  rnShowPromptModal({
    title: 'Edit Entity',
    primaryLabel: 'Save',
    fields: [{ key: 'name', label: 'Entity Name', value: ent.name, required: true }],
    onSubmit: async ({ name }) => {
      if (name === ent.name) return;
      ent.name = name;
      await persistRn();
      renderRnEntitiesTab();
    },
  });
}

function rnDeleteEntity(id) {
  const ent = rnEntities.find(e => e.id === id);
  if (!ent) return;
  rnShowConfirmModal({
    title: 'Delete Entity',
    message: `Delete entity "${ent.name}"? Coverages based on this entity will lose their schema reference.`,
    danger: true,
    onConfirm: async () => {
      rnEntities = rnEntities.filter(e => e.id !== id);
      if (rnSelectedEntityId === id) rnSelectedEntityId = rnEntities[0]?.id ?? null;
      await persistRn();
      renderRnEntitiesTab();
    },
  });
}

function renderRnEntityDetail() {
  const ent = rnEntities.find(e => e.id === rnSelectedEntityId);
  if (!ent) return `<div class="rn-empty rn-empty-large">Select an entity from the list, or create a new one.</div>`;
  return `
    <div class="rn-detail-header">
      <div class="rn-detail-title">
        <h2>${esc(ent.name)}</h2>
      </div>
      <div class="rn-detail-header-actions">
        ${rnIconBtn('edit', 'Edit', `rnRenameEntity(${ent.id})`)}
        ${rnIconBtn('delete', 'Delete entity', `rnDeleteEntity(${ent.id})`, { danger: true })}
      </div>
    </div>
    <div class="rn-attr-section">
      <div class="rn-attr-section-header">
        <h3>Attributes</h3>
        <button class="btn-new" onclick="rnAddEntityAttribute(${ent.id})">Add Attribute</button>
      </div>
      ${renderRnEntityAttrTable(ent)}
    </div>`;
}

function renderRnEntityAttrTable(ent) {
  const attrs = ent.attributes || [];
  if (attrs.length === 0) {
    return `<div class="rn-empty">No attributes yet. Click <strong>Add Attribute</strong> to create one.</div>`;
  }
  return `
    <table class="slds-table rn-attr-table">
      <thead>
        <tr>
          <th>Attribute Name</th>
          <th>Type</th>
          <th class="col-action">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${attrs.map(a => `
          <tr>
            <td>${esc(a.name)}</td>
            <td>${esc(a.type || 'Text')}</td>
            <td class="col-action">
              ${rnIconBtn('edit', 'Edit', `rnRenameEntityAttribute(${ent.id}, ${a.id})`)}
              ${rnIconBtn('delete', 'Delete', `rnDeleteEntityAttribute(${ent.id}, ${a.id})`, { danger: true })}
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function rnAddEntityAttribute(entityId) {
  const ent = rnEntities.find(e => e.id === entityId);
  if (!ent) return;
  rnShowPromptModal({
    title: 'New Attribute',
    primaryLabel: 'Add',
    fields: [
      { key: 'name', label: 'Attribute Name', required: true },
      { key: 'type', label: 'Type', type: 'select', options: RN_ATTR_TYPES, value: 'Text', required: true },
    ],
    onSubmit: async ({ name, type }) => {
      ent.attributes = ent.attributes || [];
      const id = ent.attributes.reduce((m, a) => Math.max(m, a.id || 0), 0) + 1;
      ent.attributes.push({ id, name, type });
      await persistRn();
      renderRnEntitiesTab();
    },
  });
}

function rnRenameEntityAttribute(entityId, attrId) {
  const ent = rnEntities.find(e => e.id === entityId);
  if (!ent) return;
  const attr = (ent.attributes || []).find(a => a.id === attrId);
  if (!attr) return;
  rnShowPromptModal({
    title: 'Edit Attribute',
    primaryLabel: 'Save',
    fields: [
      { key: 'name', label: 'Attribute Name', value: attr.name, required: true },
      { key: 'type', label: 'Type', type: 'select', options: RN_ATTR_TYPES, value: attr.type || 'Text', required: true },
    ],
    onSubmit: async ({ name, type }) => {
      attr.name = name;
      attr.type = type;
      await persistRn();
      renderRnEntitiesTab();
    },
  });
}

function rnDeleteEntityAttribute(entityId, attrId) {
  const ent = rnEntities.find(e => e.id === entityId);
  if (!ent) return;
  const attr = (ent.attributes || []).find(a => a.id === attrId);
  if (!attr) return;
  rnShowConfirmModal({
    title: 'Delete Attribute',
    message: `Delete attribute "${attr.name}"?`,
    danger: true,
    onConfirm: async () => {
      ent.attributes = ent.attributes.filter(a => a.id !== attrId);
      await persistRn();
      renderRnEntitiesTab();
    },
  });
}

// ── Coverages ────────────────────────────────────────────────

function renderRnCoveragesTab() {
  const host = document.getElementById('rn-tab-content');
  if (!host) return;
  if (rnSelectedCoverageId == null && rnCoverages.length > 0) rnSelectedCoverageId = rnCoverages[0].id;
  host.innerHTML = `
    <div class="rn-md">
      <div class="rn-md-list">
        <div class="rn-md-list-header">
          <h2>Coverages</h2>
          <button class="btn-new" onclick="rnCreateCoverage()">New</button>
        </div>
        <div class="rn-md-list-items">${renderRnCoverageListItems()}</div>
      </div>
      <div class="rn-md-detail" id="rn-coverage-detail">${renderRnCoverageDetail()}</div>
    </div>`;
}

function rnGetCoverageEntity() {
  return rnEntities.find(e => e.name === 'Coverage') || null;
}

function renderRnCoverageListItems() {
  if (rnCoverages.length === 0) {
    return `<div class="rn-empty">No coverages yet. Click <strong>New</strong> to create one.</div>`;
  }
  const baseEnt = rnGetCoverageEntity();
  const baseAttrCount = baseEnt ? (baseEnt.attributes || []).length : 0;
  return rnCoverages.map(c => {
    const active = rnSelectedCoverageId === c.id;
    const meta = `${baseAttrCount} attribute${baseAttrCount === 1 ? '' : 's'}`;
    return `
      <div class="rn-list-item ${active ? 'active' : ''}" onclick="rnSelectCoverage(${c.id})">
        <div class="rn-list-item-text">
          <span class="rn-list-name">${esc(c.name)}</span>
          <span class="rn-list-meta">${meta}</span>
        </div>
      </div>`;
  }).join('');
}

function rnSelectCoverage(id) { rnSelectedCoverageId = id; renderRnCoveragesTab(); }

function rnCreateCoverage() {
  const baseEnt = rnGetCoverageEntity();
  if (!baseEnt) {
    rnShowConfirmModal({
      title: 'Coverage Entity Required',
      message: 'Create an entity named "Coverage" first. All coverages share its attributes.',
      onConfirm: () => {},
    });
    return;
  }
  rnShowPromptModal({
    title: 'New Coverage',
    primaryLabel: 'Create',
    fields: [{ key: 'name', label: 'Coverage Name', placeholder: 'e.g. Building Coverage, BPP, GL Premises', required: true }],
    onSubmit: async ({ name }) => {
      const id = nextRnCoverageId++;
      rnCoverages.push({ id, name, baseEntityId: baseEnt.id, values: {} });
      rnSelectedCoverageId = id;
      await persistRn();
      renderRnCoveragesTab();
    },
  });
}

function rnRenameCoverage(id) {
  const cov = rnCoverages.find(c => c.id === id);
  if (!cov) return;
  rnShowPromptModal({
    title: 'Edit Coverage',
    primaryLabel: 'Save',
    fields: [{ key: 'name', label: 'Coverage Name', value: cov.name, required: true }],
    onSubmit: async ({ name }) => {
      cov.name = name;
      await persistRn();
      renderRnCoveragesTab();
    },
  });
}

function rnDeleteCoverage(id) {
  const cov = rnCoverages.find(c => c.id === id);
  if (!cov) return;
  rnShowConfirmModal({
    title: 'Delete Coverage',
    message: `Delete coverage "${cov.name}"?`,
    danger: true,
    onConfirm: async () => {
      rnCoverages = rnCoverages.filter(c => c.id !== id);
      if (rnSelectedCoverageId === id) rnSelectedCoverageId = rnCoverages[0]?.id ?? null;
      await persistRn();
      renderRnCoveragesTab();
    },
  });
}

async function rnSetNodeAttrStrategy(nodeId, attrId, value) {
  const h = rnHierarchies.find(x => x.id === rnDetailHierarchyId);
  if (!h) return;
  const node = findRnNodeById(h.nodes || [], nodeId);
  if (!node) return;
  node.attrConfig = node.attrConfig || {};
  node.attrConfig[attrId] = node.attrConfig[attrId] || {};
  node.attrConfig[attrId].strategy = value;
  await persistRn();
}

async function rnSetNodeAttrDuplicate(nodeId, attrId, checked) {
  const h = rnHierarchies.find(x => x.id === rnDetailHierarchyId);
  if (!h) return;
  const node = findRnNodeById(h.nodes || [], nodeId);
  if (!node) return;
  node.attrConfig = node.attrConfig || {};
  node.attrConfig[attrId] = node.attrConfig[attrId] || {};
  node.attrConfig[attrId].considerForDuplicate = !!checked;
  await persistRn();
}

async function rnSetCoverageValue(id, attrId, value) {
  const cov = rnCoverages.find(c => c.id === id);
  if (!cov) return;
  cov.values = cov.values || {};
  if (value === '' || value == null) delete cov.values[attrId];
  else cov.values[attrId] = value;
  await persistRn();
}

function renderRnCoverageDetail() {
  const cov = rnCoverages.find(c => c.id === rnSelectedCoverageId);
  if (!cov) return `<div class="rn-empty rn-empty-large">Select a coverage from the list, or create a new one.</div>`;
  const baseEnt = rnGetCoverageEntity();
  const attrs = baseEnt ? (baseEnt.attributes || []) : [];
  const attrTable = !baseEnt
    ? `<div class="rn-empty">No <strong>Coverage</strong> entity defined. Create one in the Entities tab.</div>`
    : attrs.length === 0
      ? `<div class="rn-empty">The Coverage entity has no attributes yet. Add attributes to it first.</div>`
      : `
        <table class="slds-table rn-attr-table">
          <thead><tr><th>Attribute</th><th>Type</th><th>Value</th></tr></thead>
          <tbody>
            ${attrs.map(a => {
              const v = cov.values?.[a.id] ?? '';
              return `
                <tr>
                  <td>${esc(a.name)}</td>
                  <td>${esc(a.type || 'Text')}</td>
                  <td>
                    <input type="text" class="rn-input" value="${esc(v)}"
                      onblur="rnSetCoverageValue(${cov.id}, ${a.id}, this.value)" />
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>`;
  return `
    <div class="rn-detail-header">
      <div class="rn-detail-title">
        <h2>${esc(cov.name)}</h2>
      </div>
      <div class="rn-detail-header-actions">
        ${rnIconBtn('edit', 'Edit', `rnRenameCoverage(${cov.id})`)}
        ${rnIconBtn('delete', 'Delete coverage', `rnDeleteCoverage(${cov.id})`, { danger: true })}
      </div>
    </div>
    <div class="rn-attr-section">
      <div class="rn-attr-section-header">
        <h3>Attribute Values</h3>
      </div>
      ${attrTable}
    </div>`;
}

// ── Hierarchies — list ───────────────────────────────────────

function renderRnHierarchiesList() {
  const host = document.getElementById('rn-tab-content');
  if (!host) return;
  const empty = rnHierarchies.length === 0;
  const body = empty
    ? `<div class="rn-empty rn-empty-large">No hierarchies yet. Click <strong>New Hierarchy</strong> to create one.</div>`
    : `
      <table class="slds-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Line of Business</th>
            <th>Elements</th>
          </tr>
        </thead>
        <tbody>
          ${rnHierarchies.map(h => {
            const count = countHierarchyElements(h.nodes || []);
            return `
              <tr>
                <td><a onclick="window.location.hash='#/rn-hierarchy/${h.id}'; return false;" style="cursor:pointer; color:#0176D3; font-weight:600;">${esc(h.name)}</a></td>
                <td>${esc(h.lob || '—')}</td>
                <td>${count}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  host.innerHTML = `
    <div class="rn-list-page">
      <div class="rn-list-page-header">
        <h2>LOB Hierarchies</h2>
        <button class="btn-new" onclick="rnOpenNewHierarchyModal()">New Hierarchy</button>
      </div>
      ${body}
    </div>`;
}

function countHierarchyElements(nodes) {
  let n = 0;
  const walk = (arr) => arr.forEach(node => { n++; if (node.children?.length) walk(node.children); });
  walk(nodes);
  return n;
}

function rnOpenNewHierarchyModal() {
  rnShowPromptModal({
    title: 'New Hierarchy',
    primaryLabel: 'Create',
    fields: [
      { key: 'name', label: 'Hierarchy Name', placeholder: 'e.g. Commercial Property Hierarchy', required: true },
      { key: 'lob', label: 'Line of Business', type: 'select', options: RN_LOB_OPTIONS, value: RN_LOB_OPTIONS[0], required: true },
    ],
    onSubmit: async ({ name, lob }) => {
      const id = nextRnHierarchyId++;
      rnHierarchies.push({ id, name, lob, nodes: [] });
      await persistRn();
      window.location.hash = `#/rn-hierarchy/${id}`;
    },
  });
}

function rnRenameHierarchy(id) {
  const h = rnHierarchies.find(x => x.id === id);
  if (!h) return;
  rnShowPromptModal({
    title: 'Edit Hierarchy',
    primaryLabel: 'Save',
    fields: [
      { key: 'name', label: 'Hierarchy Name', value: h.name, required: true },
      { key: 'lob', label: 'Line of Business', type: 'select', options: RN_LOB_OPTIONS, value: h.lob || RN_LOB_OPTIONS[0], required: true },
    ],
    onSubmit: async ({ name, lob }) => {
      h.name = name;
      h.lob = lob;
      await persistRn();
      renderRnHierarchiesList();
    },
  });
}

function rnDeleteHierarchy(id) {
  const h = rnHierarchies.find(x => x.id === id);
  if (!h) return;
  rnShowConfirmModal({
    title: 'Delete Hierarchy',
    message: `Delete hierarchy "${h.name}"?`,
    danger: true,
    onConfirm: async () => {
      rnHierarchies = rnHierarchies.filter(x => x.id !== id);
      await persistRn();
      renderRnHierarchiesList();
    },
  });
}

// ── Hierarchy detail ────────────────────────────────────────

let rnDetailHierarchyId = null;
let rnDetailSelectedNodeId = null;

function renderRnHierarchyDetail(id) {
  rnDetailHierarchyId = id;
  rnDetailSelectedNodeId = rnDetailSelectedNodeId; // preserved across re-renders
  const host = document.getElementById('rn-hierarchy-detail-content');
  if (!host) return;
  const h = rnHierarchies.find(x => x.id === id);
  if (!h) {
    host.innerHTML = `
      <div class="rn-page">
        <div class="rn-empty rn-empty-large">
          Hierarchy not found.
          <div style="margin-top: 12px;">
            <button class="btn-cancel" onclick="window.location.hash='#/reconciliation-normalization'">Back</button>
          </div>
        </div>
      </div>`;
    return;
  }
  if (rnDetailSelectedNodeId == null) {
    rnDetailSelectedNodeId = (h.nodes && h.nodes[0]?.id) || null;
  }
  const treeBody = h.nodes && h.nodes.length > 0
    ? renderRnTree(h.nodes, 0)
    : `<div class="rn-empty">No elements yet. Click <strong>+ Add Root</strong> to begin.</div>`;
  host.innerHTML = `
    <div class="rn-detail-page">
      <div class="rn-detail-page-header">
        <div>
          <a class="rn-back-link" onclick="window.location.hash='#/reconciliation-normalization'; return false;" style="cursor:pointer;">← LOB Hierarchies</a>
          <div class="rn-detail-page-title-row">
            <h1>${esc(h.name)}</h1>
            <span class="rn-lob-pill">${esc(h.lob || '—')}</span>
          </div>
        </div>
        <div class="rn-detail-header-actions">
          ${rnIconBtn('edit', 'Edit', `rnRenameHierarchyInline(${h.id})`)}
          ${rnIconBtn('delete', 'Delete hierarchy', `rnDeleteHierarchyFromDetail(${h.id})`, { danger: true })}
        </div>
      </div>
      <div class="rn-detail-page-body">
        <div class="rn-tree-pane">
          <div class="rn-tree-toolbar">
            <span class="rn-tree-title">Hierarchy</span>
            <button class="btn-new" onclick="rnOpenAddElementModal(${h.id}, null)">+ Add Root</button>
          </div>
          <div class="rn-tree-body">${treeBody}</div>
        </div>
        <div class="rn-attr-pane">${renderRnDetailAttrPane(h)}</div>
      </div>
    </div>`;
}

function findRnNodeById(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    const c = findRnNodeById(n.children || [], id);
    if (c) return c;
  }
  return null;
}

function renderRnTree(nodes, level) {
  return nodes.map(n => {
    const isActive = n.id === rnDetailSelectedNodeId;
    const sourceName = n.kind === 'entity'
      ? (rnEntities.find(e => e.id === n.refId)?.name || 'Entity')
      : (rnCoverages.find(c => c.id === n.refId)?.name || 'Coverage');
    const subLabel = n.kind === 'entity' ? 'Entity' : 'Coverage';
    const childMarkup = n.children && n.children.length > 0 ? renderRnTree(n.children, level + 1) : '';
    return `
      <div class="rn-tree-node">
        <div class="rn-list-item rn-tree-list-item ${isActive ? 'active' : ''}" style="padding-left: ${16 + level * 16}px;" onclick="rnSelectTreeNode(${n.id})">
          <div class="rn-list-item-text">
            <span class="rn-list-name">${esc(sourceName)}</span>
            <span class="rn-list-meta">${esc(subLabel)}</span>
          </div>
        </div>
        ${childMarkup}
      </div>`;
  }).join('');
}

function rnSelectTreeNode(nodeId) {
  rnDetailSelectedNodeId = nodeId;
  renderRnHierarchyDetail(rnDetailHierarchyId);
}

function renderRnDetailAttrPane(h) {
  if (!rnDetailSelectedNodeId) return `<div class="rn-empty rn-empty-large">Select an element on the left to view its attributes.</div>`;
  const node = findRnNodeById(h.nodes || [], rnDetailSelectedNodeId);
  if (!node) return `<div class="rn-empty rn-empty-large">Selected element no longer exists.</div>`;
  let attrs = [];
  let sourceName = '';
  let sourceKind = '';
  if (node.kind === 'entity') {
    const ent = rnEntities.find(e => e.id === node.refId);
    sourceName = ent ? ent.name : 'Entity';
    sourceKind = 'Entity';
    attrs = ent?.attributes || [];
  } else {
    const cov = rnCoverages.find(c => c.id === node.refId);
    const baseEnt = cov ? rnEntities.find(e => e.id === cov.baseEntityId) : null;
    sourceName = cov ? cov.name : 'Coverage';
    sourceKind = 'Coverage';
    attrs = baseEnt?.attributes || [];
  }
  node.attrConfig = node.attrConfig || {};
  const tableBody = attrs.length === 0
    ? `<div class="rn-empty">No attributes available from this element's source.</div>`
    : `
      <table class="slds-table rn-attr-table">
        <thead>
          <tr>
            <th>Attribute</th>
            <th>Resolution Strategy</th>
            <th style="text-align: center;">Consider For Duplicate Check</th>
          </tr>
        </thead>
        <tbody>
          ${attrs.map(a => {
            const cfg = node.attrConfig[a.id] || {};
            const strat = cfg.strategy || 'Always Flag';
            const dup = !!cfg.considerForDuplicate;
            return `
              <tr>
                <td>${esc(a.name)}</td>
                <td>
                  <select class="rn-form-select rn-attr-strategy" onchange="rnSetNodeAttrStrategy(${node.id}, ${a.id}, this.value)">
                    ${RN_RESOLUTION_STRATEGIES.map(s => `<option value="${esc(s)}" ${s === strat ? 'selected' : ''}>${esc(s)}</option>`).join('')}
                  </select>
                </td>
                <td style="text-align: center;">
                  <input type="checkbox" ${dup ? 'checked' : ''}
                    onchange="rnSetNodeAttrDuplicate(${node.id}, ${a.id}, this.checked)" />
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  return `
    <div class="rn-detail-header">
      <div class="rn-detail-title">
        <h2>${esc(sourceName)}</h2>
        <span class="rn-tree-kind" style="font-size:12px;">${esc(sourceKind)}</span>
      </div>
      <div class="rn-detail-header-actions">
        ${rnIconBtn('add', 'Add Child', `rnOpenAddElementModal(${rnDetailHierarchyId}, ${rnDetailSelectedNodeId})`)}
        ${rnIconBtn('delete', 'Delete element', `rnDeleteTreeNode(${rnDetailSelectedNodeId})`, { danger: true })}
      </div>
    </div>
    <div class="rn-attr-section">
      <div class="rn-attr-section-header">
        <h3>Attributes</h3>
      </div>
      ${tableBody}
    </div>`;
}

function rnRenameHierarchyInline(id) {
  const h = rnHierarchies.find(x => x.id === id);
  if (!h) return;
  rnShowPromptModal({
    title: 'Edit Hierarchy',
    primaryLabel: 'Save',
    fields: [
      { key: 'name', label: 'Hierarchy Name', value: h.name, required: true },
      { key: 'lob', label: 'Line of Business', type: 'select', options: RN_LOB_OPTIONS, value: h.lob || RN_LOB_OPTIONS[0], required: true },
    ],
    onSubmit: async ({ name, lob }) => {
      h.name = name;
      h.lob = lob;
      await persistRn();
      renderRnHierarchyDetail(id);
    },
  });
}

function rnDeleteHierarchyFromDetail(id) {
  const h = rnHierarchies.find(x => x.id === id);
  if (!h) return;
  rnShowConfirmModal({
    title: 'Delete Hierarchy',
    message: `Delete hierarchy "${h.name}"?`,
    danger: true,
    onConfirm: async () => {
      rnHierarchies = rnHierarchies.filter(x => x.id !== id);
      await persistRn();
      window.location.hash = '#/reconciliation-normalization';
    },
  });
}

// Entities tab in the Add Element modal excludes the catch-all "Coverage" entity —
// users add concrete coverages from the Coverages tab instead.
function rnAddElementEntityChoices() {
  return rnEntities.filter(e => e.name !== 'Coverage');
}

function rnOpenAddElementModal(hierId, parentNodeId) {
  rnAddElemHierId = hierId;
  rnAddElemParentNodeId = parentNodeId;
  rnAddElemKind = 'entity';
  // Default selection: first available entity, else first coverage
  const ents = rnAddElementEntityChoices();
  if (ents.length > 0) {
    rnAddElemKind = 'entity';
    rnAddElemRefId = ents[0].id;
  } else if (rnCoverages.length > 0) {
    rnAddElemKind = 'coverage';
    rnAddElemRefId = rnCoverages[0].id;
  } else {
    rnAddElemRefId = null;
  }
  const html = `
    <div class="modal-overlay" id="rn-add-elem-overlay" onclick="if(event.target===this) rnCloseAddElementModal()">
      <div class="modal" style="max-width: 480px;">
        <div class="modal-header">
          <h3>Add Element</h3>
          <button class="modal-close" onclick="rnCloseAddElementModal()">&times;</button>
        </div>
        <div class="modal-body" id="rn-add-elem-body" style="padding: 18px 20px;">
          ${rnRenderAddElementBody()}
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" onclick="rnCloseAddElementModal()">Cancel</button>
          <button class="btn-new" onclick="rnSubmitAddElement()">Add</button>
        </div>
      </div>
    </div>`;
  document.getElementById('rn-add-elem-overlay')?.remove();
  document.body.insertAdjacentHTML('beforeend', html);
}

function rnRenderAddElementBody() {
  const ents = rnAddElementEntityChoices();
  const showingEntities = rnAddElemKind === 'entity';
  const items = showingEntities ? ents : rnCoverages;
  const emptyHint = (ents.length === 0 && rnCoverages.length === 0)
    ? `<div class="rn-form-hint">Create at least one Entity or Coverage first.</div>`
    : (showingEntities && ents.length === 0)
      ? `<div class="rn-form-hint">No entities available.</div>`
      : (!showingEntities && rnCoverages.length === 0)
        ? `<div class="rn-form-hint">No coverages defined yet.</div>`
        : '';

  const list = items.map(it => {
    const selected = rnAddElemRefId === it.id;
    return `
      <button class="rn-add-elem-item ${selected ? 'active' : ''}" onclick="rnAddElemSelectRef(${it.id})">
        <span class="rn-list-name">${esc(it.name)}</span>
      </button>`;
  }).join('');

  return `
    <div class="rn-form-row">
      <label class="rn-form-label">Type</label>
      <div class="rn-toggle-group">
        <button class="rn-toggle-btn ${showingEntities ? 'active' : ''}" onclick="rnAddElemSetKind('entity')">Entities</button>
        <button class="rn-toggle-btn ${!showingEntities ? 'active' : ''}" onclick="rnAddElemSetKind('coverage')">Coverages</button>
      </div>
    </div>
    <div class="rn-form-row">
      <label class="rn-form-label">${showingEntities ? 'Entity' : 'Coverage'}</label>
      <div class="rn-add-elem-list">${items.length === 0 ? emptyHint : list}</div>
    </div>`;
}

let rnAddElemHierId = null;
let rnAddElemParentNodeId = null;
let rnAddElemKind = 'entity';
let rnAddElemRefId = null;

function rnAddElemSetKind(kind) {
  rnAddElemKind = kind;
  const items = kind === 'entity' ? rnAddElementEntityChoices() : rnCoverages;
  rnAddElemRefId = items[0]?.id ?? null;
  const body = document.getElementById('rn-add-elem-body');
  if (body) body.innerHTML = rnRenderAddElementBody();
}

function rnAddElemSelectRef(refId) {
  rnAddElemRefId = refId;
  const body = document.getElementById('rn-add-elem-body');
  if (body) body.innerHTML = rnRenderAddElementBody();
}

function rnCloseAddElementModal() {
  document.getElementById('rn-add-elem-overlay')?.remove();
}

function nextRnNodeId(nodes) {
  let max = 0;
  const walk = (arr) => arr.forEach(n => { if ((n.id || 0) > max) max = n.id; if (n.children?.length) walk(n.children); });
  walk(nodes);
  return max + 1;
}

async function rnSubmitAddElement() {
  if (!rnAddElemRefId) {
    const body = document.getElementById('rn-add-elem-body');
    const existing = document.getElementById('rn-add-elem-error');
    if (existing) existing.remove();
    if (body) {
      const err = document.createElement('div');
      err.id = 'rn-add-elem-error';
      err.className = 'rn-form-error';
      err.textContent = 'Pick an Entity or Coverage to add.';
      body.appendChild(err);
    }
    return;
  }
  const h = rnHierarchies.find(x => x.id === rnAddElemHierId);
  if (!h) return;
  h.nodes = h.nodes || [];
  const newNode = { id: nextRnNodeId(h.nodes), kind: rnAddElemKind, refId: rnAddElemRefId, label: '', children: [] };
  if (rnAddElemParentNodeId == null) {
    h.nodes.push(newNode);
  } else {
    const parent = findRnNodeById(h.nodes, rnAddElemParentNodeId);
    if (!parent) return;
    parent.children = parent.children || [];
    parent.children.push(newNode);
  }
  rnDetailSelectedNodeId = newNode.id;
  await persistRn();
  rnCloseAddElementModal();
  renderRnHierarchyDetail(rnAddElemHierId);
}

function rnDeleteTreeNode(nodeId) {
  rnShowConfirmModal({
    title: 'Delete Element',
    message: 'Delete this element and all of its children?',
    danger: true,
    onConfirm: async () => {
      const h = rnHierarchies.find(x => x.id === rnDetailHierarchyId);
      if (!h) return;
      const removeFrom = (arr) => arr.filter(n => {
        if (n.id === nodeId) return false;
        if (n.children?.length) n.children = removeFrom(n.children);
        return true;
      });
      h.nodes = removeFrom(h.nodes || []);
      if (rnDetailSelectedNodeId === nodeId) rnDetailSelectedNodeId = h.nodes[0]?.id ?? null;
      await persistRn();
      renderRnHierarchyDetail(rnDetailHierarchyId);
    },
  });
}
