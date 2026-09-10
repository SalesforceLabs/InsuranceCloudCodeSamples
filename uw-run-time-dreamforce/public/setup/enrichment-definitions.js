// Enrichment Definitions — DEMO ONLY.
// Each definition is a name + (LOB, Category) drawn from enrichmentConfigs +
// an Integration Procedure drawn from integrationProcedures. Used to attach
// enrichment to activities at runtime.

var enrichmentDefinitions = [];
var nextEnrichmentDefinitionId = 1;

const DEFAULT_ENRICHMENT_DEFINITIONS = [
  {
    id: 1,
    name: 'Property Characteristics — Verisk 360',
    lob: 'Commercial Property',
    categoryId: 'property-characteristics',
    categoryName: 'Property Characteristics',
    integrationProcedureName: 'Verisk360_GetPropertyValuation',
    active: true,
    lastModified: '2026-06-09T10:32:00Z',
  },
  {
    id: 2,
    name: 'Location & CAT Exposure — CoreLogic',
    lob: 'Commercial Property',
    categoryId: 'location-cat-exposure',
    categoryName: 'Location & CAT Exposure',
    integrationProcedureName: 'CoreLogic_GetCATExposure',
    active: true,
    lastModified: '2026-06-09T11:10:00Z',
  },
  {
    id: 3,
    name: 'Fire Protection — ISO PPC',
    lob: 'Commercial Property',
    categoryId: 'fire-protection-response',
    categoryName: 'Fire Protection & Response',
    integrationProcedureName: 'ISO_GetPublicProtectionClass',
    active: true,
    lastModified: '2026-06-09T09:50:00Z',
  },
  {
    id: 4,
    name: 'Claims History — LexisNexis CLUE',
    lob: 'Commercial Property',
    categoryId: 'claims-history',
    categoryName: 'Claims History',
    integrationProcedureName: 'LexisNexis_GetClaimsHistory',
    active: true,
    lastModified: '2026-06-09T08:21:00Z',
  },
];

async function persistEnrichmentDefinitions() {
  setEnrichmentDefinitions(enrichmentDefinitions);
  setNextEnrichmentDefinitionId(nextEnrichmentDefinitionId);
  await saveConfig();
}

function renderEnrichmentDefinitions() {
  const host = document.getElementById('enrichment-definitions-content');
  if (!host) return;
  const empty = enrichmentDefinitions.length === 0;
  const body = empty
    ? `<div class="rn-empty rn-empty-large">No enrichment definitions yet. Click <strong>New Definition</strong> to create one.</div>`
    : `
      <table class="slds-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Line of Business</th>
            <th>Category</th>
            <th>Integration Procedure</th>
            <th>Status</th>
            <th class="col-action">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${enrichmentDefinitions.map(d => {
            const status = d.active
              ? `<span class="badge-active">Active</span>`
              : `<span class="badge-inactive">Inactive</span>`;
            return `
              <tr>
                <td><span style="font-weight:600; color:#001e5b;">${esc(d.name)}</span></td>
                <td>${esc(d.lob || '—')}</td>
                <td>${esc(d.categoryName || '—')}</td>
                <td><code style="font-size:12px;">${esc(d.integrationProcedureName || '—')}</code></td>
                <td>${status}</td>
                <td class="col-action">
                  <button class="rn-row-icon-btn" title="Edit" aria-label="Edit" onclick="edOpenEditDefinitionModal(${d.id})">
                    <svg class="slds-button__icon slds-button__icon_x-small" aria-hidden="true">
                      <use href="/assets/salesforce-lightning-design-system/icons/utility-sprite/svg/symbols.svg#edit" />
                    </svg>
                  </button>
                  <button class="rn-row-icon-btn rn-row-icon-btn-danger" title="Delete" aria-label="Delete" onclick="edDeleteDefinition(${d.id})">
                    <svg class="slds-button__icon slds-button__icon_x-small" aria-hidden="true">
                      <use href="/assets/salesforce-lightning-design-system/icons/utility-sprite/svg/symbols.svg#delete" />
                    </svg>
                  </button>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  host.innerHTML = `
    <div class="ip-list-page">
      <div class="ip-list-header">
        <div>
          <h2>Enrichment Definitions</h2>
          <p>Reusable named enrichments that can be attached to activities. Each ties a category from Enrichment Data to an Integration Procedure.</p>
        </div>
        <button class="btn-new" onclick="edOpenNewDefinitionModal()">New Definition</button>
      </div>
      <div class="ip-list-body">${body}</div>
    </div>`;
}

// ── Modal: New / Edit ─────────────────────────────────────────

let edEditingDefinitionId = null;
let edDraftLob = '';
let edDraftCategoryId = '';
let edDraftIntegrationProcedureName = '';

function edAvailableLobs() {
  return (enrichmentConfigs || []).map(c => c.lob).filter(Boolean);
}

function edCategoriesForLob(lob) {
  const cfg = (enrichmentConfigs || []).find(c => c.lob === lob);
  return (cfg?.categories || []).map(cat => ({ id: cat.id, name: cat.name }));
}

function edIpsForLob(lob) {
  return (integrationProcedures || []).filter(p => !p.lob || p.lob === 'All' || p.lob === lob);
}

function edOpenNewDefinitionModal() {
  edEditingDefinitionId = null;
  const lobs = edAvailableLobs();
  edDraftLob = lobs[0] || '';
  const cats = edCategoriesForLob(edDraftLob);
  edDraftCategoryId = cats[0]?.id || '';
  const ips = edIpsForLob(edDraftLob);
  edDraftIntegrationProcedureName = ips[0]?.name || '';
  edRenderDefinitionModal('New Enrichment Definition', 'Create');
}

function edOpenEditDefinitionModal(id) {
  const d = enrichmentDefinitions.find(x => x.id === id);
  if (!d) return;
  edEditingDefinitionId = id;
  edDraftLob = d.lob;
  edDraftCategoryId = d.categoryId;
  edDraftIntegrationProcedureName = d.integrationProcedureName;
  edRenderDefinitionModal('Edit Enrichment Definition', 'Save', d.name);
}

function edRenderDefinitionModal(title, primaryLabel, initialName) {
  const lobs = edAvailableLobs();
  const lobOpts = lobs.map(l => `<option value="${esc(l)}" ${l === edDraftLob ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const editing = edEditingDefinitionId != null;
  const existingName = editing
    ? enrichmentDefinitions.find(x => x.id === edEditingDefinitionId)?.name || ''
    : (initialName || '');

  const html = `
    <div class="modal-overlay" id="ed-def-overlay" onclick="if(event.target===this) edCloseDefinitionModal()">
      <div class="modal" style="max-width: 500px;">
        <div class="modal-header">
          <h3>${esc(title)}</h3>
          <button class="modal-close" onclick="edCloseDefinitionModal()">&times;</button>
        </div>
        <div class="modal-body" id="ed-def-body" style="padding: 18px 20px;">
          <div class="rn-form-row">
            <label class="rn-form-label">Name *</label>
            <input type="text" class="rn-input" id="ed-def-name" value="${esc(existingName)}" placeholder="e.g. Property Characteristics — Verisk 360" />
          </div>
          <div class="rn-form-row">
            <label class="rn-form-label">Line of Business *</label>
            <select class="rn-form-select" id="ed-def-lob" onchange="edOnLobChange(this.value)">${lobOpts}</select>
          </div>
          <div class="rn-form-row" id="ed-def-category-row">
            ${edRenderCategorySelect()}
          </div>
          <div class="rn-form-row" id="ed-def-ip-row">
            ${edRenderIpSelect()}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" onclick="edCloseDefinitionModal()">Cancel</button>
          <button class="btn-new" id="ed-def-submit">${esc(primaryLabel)}</button>
        </div>
      </div>
    </div>`;
  document.getElementById('ed-def-overlay')?.remove();
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('ed-def-submit').onclick = edSubmitDefinitionModal;
  setTimeout(() => document.getElementById('ed-def-name')?.focus(), 0);
}

function edRenderCategorySelect() {
  const cats = edCategoriesForLob(edDraftLob);
  if (cats.length === 0) {
    return `
      <label class="rn-form-label">Category *</label>
      <select class="rn-form-select" id="ed-def-category" disabled>
        <option>No categories defined for this LOB</option>
      </select>`;
  }
  const opts = cats.map(c => `<option value="${esc(c.id)}" ${c.id === edDraftCategoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  return `
    <label class="rn-form-label">Category *</label>
    <select class="rn-form-select" id="ed-def-category" onchange="edDraftCategoryId = this.value;">${opts}</select>`;
}

function edRenderIpSelect() {
  const ips = edIpsForLob(edDraftLob);
  if (ips.length === 0) {
    return `
      <label class="rn-form-label">Integration Procedure *</label>
      <select class="rn-form-select" id="ed-def-ip" disabled>
        <option>No integration procedures available for this LOB</option>
      </select>`;
  }
  const opts = ips.map(p => {
    const name = `${p.procName}_${p.versionLabel}`;
    return `<option value="${esc(name)}" ${name === edDraftIntegrationProcedureName ? 'selected' : ''}>${esc(p.procName)} · ${esc(p.versionLabel)}</option>`;
  }).join('');
  return `
    <label class="rn-form-label">Integration Procedure *</label>
    <select class="rn-form-select" id="ed-def-ip" onchange="edDraftIntegrationProcedureName = this.value;">${opts}</select>`;
}

function edOnLobChange(lob) {
  edDraftLob = lob;
  // Re-derive defaults for category + IP based on the new LOB
  const cats = edCategoriesForLob(lob);
  edDraftCategoryId = cats[0]?.id || '';
  const ips = edIpsForLob(lob);
  edDraftIntegrationProcedureName = ips[0]?.name || '';
  const catRow = document.getElementById('ed-def-category-row');
  const ipRow = document.getElementById('ed-def-ip-row');
  if (catRow) catRow.innerHTML = edRenderCategorySelect();
  if (ipRow) ipRow.innerHTML = edRenderIpSelect();
}

function edCloseDefinitionModal() {
  document.getElementById('ed-def-overlay')?.remove();
}

async function edSubmitDefinitionModal() {
  const name = (document.getElementById('ed-def-name')?.value || '').trim();
  const lob = document.getElementById('ed-def-lob')?.value || '';
  const categoryId = document.getElementById('ed-def-category')?.value || '';
  const ipName = document.getElementById('ed-def-ip')?.value || '';

  const errs = [];
  if (!name) errs.push('Name is required.');
  if (!lob) errs.push('Line of Business is required.');
  if (!categoryId) errs.push('Category is required.');
  if (!ipName) errs.push('Integration Procedure is required.');
  const body = document.getElementById('ed-def-body');
  document.getElementById('ed-def-error')?.remove();
  if (errs.length) {
    const err = document.createElement('div');
    err.id = 'ed-def-error';
    err.className = 'rn-form-error';
    err.textContent = errs.join(' ');
    body.appendChild(err);
    return;
  }
  const cat = edCategoriesForLob(lob).find(c => c.id === categoryId);

  if (edEditingDefinitionId != null) {
    const d = enrichmentDefinitions.find(x => x.id === edEditingDefinitionId);
    if (d) {
      d.name = name;
      d.lob = lob;
      d.categoryId = categoryId;
      d.categoryName = cat?.name || '';
      d.integrationProcedureName = ipName;
      d.lastModified = new Date().toISOString();
    }
  } else {
    enrichmentDefinitions.push({
      id: nextEnrichmentDefinitionId++,
      name,
      lob,
      categoryId,
      categoryName: cat?.name || '',
      integrationProcedureName: ipName,
      active: true,
      lastModified: new Date().toISOString(),
    });
  }
  await persistEnrichmentDefinitions();
  edCloseDefinitionModal();
  renderEnrichmentDefinitions();
}

function edDeleteDefinition(id) {
  const d = enrichmentDefinitions.find(x => x.id === id);
  if (!d) return;
  rnShowConfirmModal({
    title: 'Delete Enrichment Definition',
    message: `Delete "${d.name}"?`,
    danger: true,
    onConfirm: async () => {
      enrichmentDefinitions = enrichmentDefinitions.filter(x => x.id !== id);
      await persistEnrichmentDefinitions();
      renderEnrichmentDefinitions();
    },
  });
}
