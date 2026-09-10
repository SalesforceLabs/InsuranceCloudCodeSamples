// ═══════════════════════════════════════════════════════════════
// ACTIVITIES LIBRARY - Reusable Activities Module
// ═══════════════════════════════════════════════════════════════

let reusableActivities = [];
let nextReusableActivityId = 1;

async function persistActivities() {
  setReusableActivities(reusableActivities);
  setNextReusableActivityId(nextReusableActivityId);
  await saveConfig();
}

// ── Render Activities Table ──────────────────────────────────

function renderActivitiesLibraryTable() {
  const tbody = document.getElementById('activities-library-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (reusableActivities.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-row">No activities defined yet. Click <strong>New</strong> to create a reusable activity.</td></tr>`;
  } else {
    reusableActivities.forEach(activity => {
      const tr = document.createElement('tr');
      const processDisplay = buildProcessCell(activity);
      tr.innerHTML = `
        <td class="col-check"><input type="checkbox" /></td>
        <td><a href="#" onclick="openActivityLibraryModal(${activity.id}); return false;">${esc(activity.name)}</a></td>
        <td>${processDisplay}</td>
        <td>${esc(activity.description || '—')}</td>
        <td class="col-action">
          ${rowMenuBtn(`onclick="openRowMenu(this,[{label:'Edit',action:()=>openActivityLibraryModal(${activity.id})},{label:'Delete',action:()=>deleteActivityFromLibrary(${activity.id}),danger:true}]);event.stopPropagation()"`)}
        </td>`;
      tbody.appendChild(tr);
    });
  }

  document.getElementById('activities-library-count').textContent =
    reusableActivities.length + (reusableActivities.length === 1 ? ' activity' : ' activities');
}

// ── Activity Library Modal ───────────────────────────────────

function openActivityLibraryModal(id) {
  const activity = id ? reusableActivities.find(a => a.id === id) : null;

  document.getElementById('act-lib-edit-id').value = id || '';
  document.getElementById('act-lib-modal-title').textContent = activity ? 'Edit Activity' : 'New Activity';

  document.getElementById('act-lib-name').value = activity?.name || '';
  document.getElementById('act-lib-description').value = activity?.description || '';
  document.getElementById('act-lib-process').value = activity?.action || '';

  // Process details
  onActivityLibraryProcessChange(activity?.actionDetails || {});

  document.getElementById('activity-library-modal').classList.remove('hidden');
}

function closeActivityLibraryModal() {
  document.getElementById('activity-library-modal').classList.add('hidden');
}

function actLibOverlayClick(e) {
  if (e.target === document.getElementById('activity-library-modal')) closeActivityLibraryModal();
}

function onActivityLibraryProcessChange(existingDetails = {}) {
  const processType = document.getElementById('act-lib-process').value;
  const container = document.getElementById('act-lib-process-details');

  if (!processType) {
    container.innerHTML = '<p class="form-hint">Choose a Process type above to configure details.</p>';
    return;
  }

  container.innerHTML = '';

  const group = document.createElement('div');
  group.className = 'action-detail-row';

  if (processType === 'Flow') {
    group.innerHTML = `
      <label class="form-label">Flow Name <span class="req">*</span></label>
      <div class="action-detail-search">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/>
          <path d="m16.5 16.5 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <input type="text" id="act-lib-flow-name" placeholder="Search flows..." value="${esc(existingDetails.flowName || '')}" />
      </div>`;
  } else if (processType === 'Integration Procedure') {
    group.innerHTML = `
      <label class="form-label">Integration Procedure <span class="req">*</span></label>
      <div class="action-detail-search">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/>
          <path d="m16.5 16.5 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <input type="text" id="act-lib-ip-name" placeholder="Search integration procedures..." value="${esc(existingDetails.ipName || '')}" />
      </div>`;
  } else if (processType === 'Omniscript') {
    group.innerHTML = `
      <label class="form-label">Omniscript <span class="req">*</span></label>
      <div class="action-detail-search">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/>
          <path d="m16.5 16.5 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <input type="text" id="act-lib-omniscript-name" placeholder="Search omniscripts..." value="${esc(existingDetails.omniscriptName || '')}" />
      </div>`;
  } else if (processType === 'Agent') {
    group.innerHTML = `
      <label class="form-label">Agent <span class="req">*</span></label>
      <div class="action-detail-search">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/>
          <path d="m16.5 16.5 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <input type="text" id="act-lib-agent-name" placeholder="Search agents..." value="${esc(existingDetails.agentName || '')}" />
      </div>`;
  } else if (processType === 'Enrichment Definition') {
    const lobs = (typeof enrichmentConfigs !== 'undefined' ? enrichmentConfigs : []).map(c => c.lob).filter(Boolean);
    const initialLob = existingDetails.lob && lobs.includes(existingDetails.lob)
      ? existingDetails.lob
      : (lobs[0] || '');
    const lobOpts = lobs.map(l =>
      `<option value="${esc(l)}" ${l === initialLob ? 'selected' : ''}>${esc(l)}</option>`
    ).join('');
    container.innerHTML = `
      <div class="form-group">
        <label>Line of Business <span class="req">*</span></label>
        <select id="act-lib-ed-lob" onchange="onEnrichmentDefinitionLobChange()">${lobOpts}</select>
      </div>
      <div class="form-group" id="act-lib-ed-category-row"></div>
      <div class="form-group" id="act-lib-ed-definition-row"></div>`;
    renderEnrichmentDefinitionCategoryRow(initialLob, existingDetails.categoryId);
    renderEnrichmentDefinitionDefinitionRow(initialLob, existingDetails.categoryId, existingDetails.enrichmentDefinitionId);
    return;
  }

  container.appendChild(group);
}

function renderEnrichmentDefinitionCategoryRow(lob, selectedCategoryId) {
  const row = document.getElementById('act-lib-ed-category-row');
  if (!row) return;
  const cfg = (typeof enrichmentConfigs !== 'undefined' ? enrichmentConfigs : []).find(c => c.lob === lob);
  const cats = (cfg?.categories || []).map(cat => ({ id: cat.id, name: cat.name }));
  if (cats.length === 0) {
    row.innerHTML = `
      <label>Category <span class="req">*</span></label>
      <select id="act-lib-ed-category" disabled>
        <option>No categories defined for this LOB</option>
      </select>`;
    return;
  }
  const value = cats.some(c => c.id === selectedCategoryId) ? selectedCategoryId : cats[0].id;
  const opts = cats.map(c =>
    `<option value="${esc(c.id)}" ${c.id === value ? 'selected' : ''}>${esc(c.name)}</option>`
  ).join('');
  row.innerHTML = `
    <label>Category <span class="req">*</span></label>
    <select id="act-lib-ed-category" onchange="onEnrichmentDefinitionCategoryChange()">${opts}</select>`;
}

function renderEnrichmentDefinitionDefinitionRow(lob, categoryId, selectedDefinitionId) {
  const row = document.getElementById('act-lib-ed-definition-row');
  if (!row) return;
  const defs = (typeof enrichmentDefinitions !== 'undefined' ? enrichmentDefinitions : [])
    .filter(d => d.lob === lob && (!categoryId || d.categoryId === categoryId));
  if (defs.length === 0) {
    row.innerHTML = `
      <label>Enrichment Definition <span class="req">*</span></label>
      <select id="act-lib-ed-definition" disabled>
        <option>No enrichment definitions match this LOB and category</option>
      </select>`;
    return;
  }
  const value = defs.some(d => d.id === selectedDefinitionId) ? selectedDefinitionId : defs[0].id;
  const opts = defs.map(d =>
    `<option value="${d.id}" ${d.id === value ? 'selected' : ''}>${esc(d.name)}</option>`
  ).join('');
  row.innerHTML = `
    <label>Enrichment Definition <span class="req">*</span></label>
    <select id="act-lib-ed-definition">${opts}</select>`;
}

function onEnrichmentDefinitionLobChange() {
  const lob = document.getElementById('act-lib-ed-lob').value;
  renderEnrichmentDefinitionCategoryRow(lob, null);
  const cat = document.getElementById('act-lib-ed-category');
  const categoryId = cat && !cat.disabled ? cat.value : null;
  renderEnrichmentDefinitionDefinitionRow(lob, categoryId, null);
}

function onEnrichmentDefinitionCategoryChange() {
  const lob = document.getElementById('act-lib-ed-lob').value;
  const categoryId = document.getElementById('act-lib-ed-category').value;
  renderEnrichmentDefinitionDefinitionRow(lob, categoryId, null);
}

function saveActivityLibrary() {
  const name = document.getElementById('act-lib-name').value.trim();
  const description = document.getElementById('act-lib-description').value.trim();
  const processType = document.getElementById('act-lib-process').value;

  if (!name) {
    alert('Activity Name is required.');
    return;
  }

  if (!processType) {
    alert('Process type is required.');
    return;
  }

  // Gather process details
  const actionDetails = {};
  if (processType === 'Flow') {
    actionDetails.flowName = document.getElementById('act-lib-flow-name')?.value.trim();
    if (!actionDetails.flowName) {
      alert('Flow Name is required.');
      return;
    }
  } else if (processType === 'Integration Procedure') {
    actionDetails.ipName = document.getElementById('act-lib-ip-name')?.value.trim();
    if (!actionDetails.ipName) {
      alert('Integration Procedure is required.');
      return;
    }
  } else if (processType === 'Omniscript') {
    actionDetails.omniscriptName = document.getElementById('act-lib-omniscript-name')?.value.trim();
    if (!actionDetails.omniscriptName) {
      alert('Omniscript is required.');
      return;
    }
  } else if (processType === 'Agent') {
    actionDetails.agentName = document.getElementById('act-lib-agent-name')?.value.trim();
    if (!actionDetails.agentName) {
      alert('Agent is required.');
      return;
    }
  } else if (processType === 'Enrichment Definition') {
    const lob = document.getElementById('act-lib-ed-lob')?.value || '';
    const categoryEl = document.getElementById('act-lib-ed-category');
    const defEl = document.getElementById('act-lib-ed-definition');
    const categoryId = categoryEl && !categoryEl.disabled ? categoryEl.value : '';
    const definitionId = defEl && !defEl.disabled ? parseInt(defEl.value) : null;
    if (!lob) { alert('Line of Business is required.'); return; }
    if (!categoryId) { alert('Category is required.'); return; }
    if (!definitionId) { alert('Enrichment Definition is required.'); return; }
    const def = (enrichmentDefinitions || []).find(d => d.id === definitionId);
    actionDetails.lob = lob;
    actionDetails.categoryId = categoryId;
    actionDetails.categoryName = def?.categoryName || '';
    actionDetails.enrichmentDefinitionId = definitionId;
    actionDetails.enrichmentDefinitionName = def?.name || '';
  }

  const id = document.getElementById('act-lib-edit-id').value;
  const activity = {
    name,
    description,
    action: processType,
    actionDetails,
  };

  if (id) {
    const idx = reusableActivities.findIndex(a => a.id === parseInt(id));
    reusableActivities[idx] = { id: parseInt(id), ...activity };
  } else {
    reusableActivities.push({ id: nextReusableActivityId++, ...activity });
  }

  persistActivities();
  closeActivityLibraryModal();
  renderActivitiesLibraryTable();
}

function deleteActivityFromLibrary(id) {
  const activity = reusableActivities.find(a => a.id === id);
  if (!confirm(`Delete activity "${activity.name}"? This will not affect existing stage configurations that reference it.`)) return;

  reusableActivities = reusableActivities.filter(a => a.id !== id);
  persistActivities();
  renderActivitiesLibraryTable();
}

// ── Get Activity by ID ───────────────────────────────────────

function getActivityById(id) {
  return reusableActivities.find(a => a.id === id);
}

// ── Build Activity Selector Dropdown ─────────────────────────

function buildActivitySelector(selectedId = null) {
  const dropdown = document.getElementById('activity-select-dropdown');
  const trigger = document.querySelector('#custom-activity-select .custom-select-trigger');
  const hiddenInput = document.getElementById('act-activity-ref');
  const wrap = document.getElementById('custom-activity-select');

  if (!dropdown || !trigger) return '';

  dropdown.innerHTML = '';

  // Add placeholder option
  const placeholderOption = document.createElement('div');
  placeholderOption.className = 'custom-select-option placeholder';
  placeholderOption.innerHTML = '— Select Activity —';
  placeholderOption.onclick = () => {
    hiddenInput.value = '';
    trigger.innerHTML = '<span class="custom-select-placeholder">— Select Activity —</span>';
    wrap.classList.remove('open');
    if (typeof onActivityReferenceChange === 'function') onActivityReferenceChange();
  };
  dropdown.appendChild(placeholderOption);

  // Add activity options
  reusableActivities.forEach(activity => {
    const option = document.createElement('div');
    option.className = 'custom-select-option';
    if (activity.id === selectedId) option.classList.add('selected');

    // Build metadata byline
    let byline = '';
    if (activity.action) {
      byline = activity.action;
      if (activity.actionDetails) {
        if (activity.action === 'Flow' && activity.actionDetails.flowName) {
          byline += `: ${activity.actionDetails.flowName}`;
        } else if (activity.action === 'Integration Procedure' && activity.actionDetails.ipName) {
          byline += `: ${activity.actionDetails.ipName}`;
        } else if (activity.action === 'Omniscript' && activity.actionDetails.omniscriptName) {
          byline += `: ${activity.actionDetails.omniscriptName}`;
        } else if (activity.action === 'Agent' && activity.actionDetails.agentName) {
          byline += `: ${activity.actionDetails.agentName}`;
        }
      }
    }

    option.innerHTML = `
      <div class="custom-select-option-title">${esc(activity.name)}</div>
      ${byline ? `<div class="custom-select-option-meta">${esc(byline)}</div>` : ''}
    `;

    option.onclick = () => {
      hiddenInput.value = activity.id;
      trigger.innerHTML = `
        <span class="activity-name">${esc(activity.name)}</span>
        ${byline ? `<span class="activity-meta">(${esc(byline)})</span>` : ''}
      `;
      document.querySelectorAll('.custom-select-option').forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
      wrap.classList.remove('open');
      if (typeof onActivityReferenceChange === 'function') onActivityReferenceChange();
    };

    dropdown.appendChild(option);
  });

  // Set initial selected value
  if (selectedId) {
    const selected = reusableActivities.find(a => a.id === selectedId);
    if (selected) {
      let byline = '';
      if (selected.action) {
        byline = selected.action;
        if (selected.actionDetails) {
          if (selected.action === 'Flow' && selected.actionDetails.flowName) {
            byline += `: ${selected.actionDetails.flowName}`;
          } else if (selected.action === 'Integration Procedure' && selected.actionDetails.ipName) {
            byline += `: ${selected.actionDetails.ipName}`;
          } else if (selected.action === 'Omniscript' && selected.actionDetails.omniscriptName) {
            byline += `: ${selected.actionDetails.omniscriptName}`;
          } else if (selected.action === 'Agent' && selected.actionDetails.agentName) {
            byline += `: ${selected.actionDetails.agentName}`;
          }
        }
      }
      trigger.innerHTML = `
        <span class="activity-name">${esc(selected.name)}</span>
        ${byline ? `<span class="activity-meta">(${esc(byline)})</span>` : ''}
      `;
      hiddenInput.value = selectedId;
    }
  }

  // Toggle dropdown
  trigger.onclick = (e) => {
    e.stopPropagation();
    wrap.classList.toggle('open');
  };

  // Close on outside click
  document.addEventListener('click', function closeCustomSelect(e) {
    if (!wrap.contains(e.target)) {
      wrap.classList.remove('open');
    }
  });

  return ''; // Return empty since we're manipulating DOM directly
}
