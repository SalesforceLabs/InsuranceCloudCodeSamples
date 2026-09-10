// ═══════════════════════════════════════════════════════════════
// ACTIVITY RENDERING PATCHES
// ═══════════════════════════════════════════════════════════════

// Override buildProcessCell to handle both old and new activity structures
const _originalBuildProcessCell = typeof buildProcessCell !== 'undefined' ? buildProcessCell : null;

function buildProcessCell(a) {
  // Library activity: has action and actionDetails directly
  if (a.action && a.actionDetails && !a.activityRefId) {
    const detail = formatActionDetailFromActivity(a);
    if (!detail || detail === '—') {
      return `<span class="badge-type">${esc(a.action)}</span>`;
    }
    const lines = [detail];
    const tooltipData = JSON.stringify({ title: a.action, lines }).replace(/"/g, '&quot;');
    return `<span class="badge-type" style="cursor:default;"
      data-tooltip='${tooltipData}'
      onmouseenter="showActTooltip(event, this)"
      onmouseleave="hideActTooltip()">${esc(a.action)}</span>`;
  }

  // New structure: activity reference
  if (a.activityRefId) {
    const activity = getActivityById(a.activityRefId);
    if (!activity) {
      return '<span style="color:#C62828;">Task Not Found</span>';
    }

    const detail = formatActionDetailFromActivity(activity);

    if (!detail || detail === '—') {
      return `<span class="badge-type">${esc(activity.action)}</span>`;
    }

    const lines = [detail];
    const tooltipData = JSON.stringify({ title: activity.action, lines }).replace(/"/g, '&quot;');
    return `<span class="badge-type" style="cursor:default;"
      data-tooltip='${tooltipData}'
      onmouseenter="showActTooltip(event, this)"
      onmouseleave="hideActTooltip()">${esc(activity.action)}</span>`;
  }

  // Old structure: direct action definition (backward compatibility)
  if (_originalBuildProcessCell) {
    return _originalBuildProcessCell(a);
  }

  // Fallback for old structure if original function not available
  if (!a.action) return '<span style="color:var(--sf-text-muted)">—</span>';
  const detail = formatActionDetail(a);
  if (!detail || detail === '—') {
    return `<span class="badge-type">${esc(a.action)}</span>`;
  }
  const lines = [detail];
  const tooltipData = JSON.stringify({ title: a.action, lines }).replace(/"/g, '&quot;');
  return `<span class="badge-type" style="cursor:default;"
    data-tooltip='${tooltipData}'
    onmouseenter="showActTooltip(event, this)"
    onmouseleave="hideActTooltip()">${esc(a.action)}</span>`;
}

// Format action detail from activity library object
function formatActionDetailFromActivity(activity) {
  if (!activity || !activity.action || !activity.actionDetails) return '—';

  if (activity.action === 'Flow') {
    return activity.actionDetails.flowName || '—';
  } else if (activity.action === 'Integration Procedure') {
    return activity.actionDetails.ipName || '—';
  } else if (activity.action === 'Omniscript') {
    return activity.actionDetails.omniscriptName || '—';
  } else if (activity.action === 'Agent') {
    return activity.actionDetails.agentName || '—';
  } else if (activity.action === 'Enrichment Definition') {
    return activity.actionDetails.enrichmentDefinitionName || '—';
  }
  return '—';
}

// Override buildActivityRow to handle activity references
const _originalBuildActivityRow = typeof buildActivityRow !== 'undefined' ? buildActivityRow : null;

function buildActivityRow(a, pos, key) {
  const processCell = buildProcessCell(a);

  const availability = a.availability || 'On Stage Change';
  const trigger      = a.trigger      || 'Manual';

  const availBadge = availability === 'Conditional'
    ? buildConditionalBadge(a.availabilityRules, key, 'Availability Conditions')
    : `<span class="badge-trigger">${esc(availability)}</span>`;

  const trigBadge = trigger === 'Conditional'
    ? buildConditionalBadge(a.triggerRules, key, 'Trigger Conditions')
    : `<span class="badge-trigger">${esc(trigger)}</span>`;

  const [scId, stgIdx] = key.split(':').map(x => parseInt(x));

  // Get display name
  let displayName = a.name || '—';
  if (a.activityRefId) {
    const activity = getActivityById(a.activityRefId);
    displayName = a.nameOverride || activity?.name || 'Unknown Activity';
  }

  const tr = document.createElement('tr');
  tr.dataset.actId = a.id;
  tr.dataset.pos = pos;
  tr.innerHTML = `
    <td><a href="#" onclick="openActivityModal(${scId},'sc-${scId}:${stgIdx}',${a.id}); return false;">${esc(displayName)}</a></td>
    <td>${processCell}</td>
    <td>${availBadge}</td>
    <td>${trigBadge}</td>
    <td>${a.mandatory ? '<span class="badge-mandatory">Mandatory</span>' : '—'}</td>
    <td class="col-action">
      ${rowMenuBtn(`onclick="openRowMenu(this,[{label:'Edit',action:()=>openActivityModal(${scId},'sc-${scId}:${stgIdx}',${a.id})},{label:'Delete',action:()=>deleteActivity(${scId},${stgIdx},${a.id}),danger:true}]);event.stopPropagation()"`)}
    </td>`;
  return tr;
}

// Override buildStmActivityRow to handle activity references
const _originalBuildStmActivityRow = typeof buildStmActivityRow !== 'undefined' ? buildStmActivityRow : null;

function buildStmActivityRow(a, pos, stmId) {
  const availability = a.availability || 'Always';
  const availBadge = availability === 'Conditional'
    ? buildConditionalBadge(a.availabilityRules, `stm-${stmId}`, 'Availability Conditions')
    : `<span class="badge-trigger">${availability === 'On Stage Change' ? 'Always' : esc(availability)}</span>`;

  const trigger = a.trigger || 'Manual';
  const trigBadge = trigger === 'Conditional'
    ? buildConditionalBadge(a.triggerRules, `stm-${stmId}`, 'Trigger Conditions')
    : `<span class="badge-trigger">${esc(trigger)}</span>`;

  const processCell = buildProcessCell(a);

  const tr = document.createElement('tr');
  tr.dataset.actId = a.id;
  tr.dataset.stmId = stmId;

  // Get display name
  let displayName = a.name || '—';
  if (a.activityRefId) {
    const activity = getActivityById(a.activityRefId);
    displayName = a.nameOverride || activity?.name || 'Unknown Task';
  }

  tr.innerHTML = `
    <td><a href="#" onclick="openStmActivityModal(${stmId}, ${a.id}); return false;">${esc(displayName)}</a></td>
    <td>${processCell}</td>
    <td>${availBadge}</td>
    <td>${trigBadge}</td>
    <td>${a.mandatory ? '<span class="badge-mandatory">Mandatory</span>' : '—'}</td>
    <td class="col-action">
      ${rowMenuBtn(`onclick="openRowMenu(this,[{label:'Edit',action:()=>openStmActivityModal(${stmId},${a.id})},{label:'Delete',action:()=>deleteStmActivity(${stmId},${a.id}),danger:true}]);event.stopPropagation()"`)}
    </td>`;
  return tr;
}

// Update openStmActivityModal to use new structure
const _originalOpenStmActivityModal = typeof openStmActivityModal !== 'undefined' ? openStmActivityModal : null;

function openStmActivityModal(stmId, actId) {
  const acts = getStmActivities(stmId);
  const act  = actId ? acts.find(a => a.id === actId) : null;

  document.getElementById('act-edit-id').value   = actId || '';
  document.getElementById('act-stage-key').value = `stm-${stmId}`;
  document.getElementById('activity-modal-title').textContent = act ? 'Edit Task' : 'Add Task';

  // Populate activity selector
  const selector = document.getElementById('act-activity-ref');
  selector.innerHTML = buildActivitySelector(act?.activityRefId || null);

  // Display name override
  document.getElementById('act-name').value = act?.nameOverride || '';
  document.getElementById('act-mandatory').checked = act?.mandatory || false;

  // Show selected activity info if editing
  if (act?.activityRefId) {
    const selInput = document.getElementById('act-activity-ref');
    selInput.value = act.activityRefId;
    onActivityReferenceChange();
  } else {
    document.getElementById('act-selected-info').classList.add('hidden');
  }

  // Availability - Show for submission-level activities with Always/Conditional options
  const avail = act?.availability || 'Always';
  document.querySelectorAll('[name="act-availability"]').forEach(r => {
    r.checked = r.value === avail;
    // Show only "Always" (mapped to "On Stage Change") and "Conditional"
    const parent = r.closest('label');
    if (parent && r.value === 'On Stage Change') {
      // Change label text to "Always"
      const label = parent.childNodes[1]; // Text node after input
      if (label && label.nodeType === 3) {
        label.textContent = ' Always';
      }
      parent.style.display = 'inline';
    } else if (parent && r.value === 'Conditional') {
      parent.style.display = 'inline';
    } else if (parent) {
      parent.style.display = 'none';
    }
  });

  const availInst = `stm-act-avail-${stmId}-${actId || 'new'}`;
  rulesInstances[availInst] = act?.availabilityRules
    ? JSON.parse(JSON.stringify(act.availabilityRules))
    : { stageKey: `stm-${stmId}`, conditions: [], expression: '' };
  const availWrap = document.getElementById('act-availability-rules-wrap');
  if (avail === 'Conditional') {
    availWrap.classList.remove('hidden');
    setTimeout(() => createRulesModule('act-availability-rules', availInst, `stm-${stmId}`), 0);
  } else {
    availWrap.classList.add('hidden');
  }

  // Trigger - Show only Manual and Conditional for submission-level
  const trigger = act?.trigger || 'Manual';
  document.querySelectorAll('[name="act-trigger"]').forEach(r => {
    r.checked = r.value === trigger;
    // Show only "Manual" and "Conditional"
    const parent = r.closest('label');
    if (parent && (r.value === 'Manual' || r.value === 'Conditional')) {
      parent.style.display = 'inline';
    } else if (parent && r.value === 'On Stage Change') {
      parent.style.display = 'none';
    }
  });
  const trigInst = `stm-act-trig-${stmId}-${actId || 'new'}`;
  rulesInstances[trigInst] = act?.triggerRules
    ? JSON.parse(JSON.stringify(act.triggerRules))
    : { stageKey: `stm-${stmId}`, conditions: [], expression: '' };
  const trigWrap = document.getElementById('act-trigger-rules-wrap');
  const buttonNameWrap = document.getElementById('act-button-name-wrap');

  // Initialize button name field visibility and value
  if (trigger === 'Manual') {
    buttonNameWrap.style.display = 'block';
    document.getElementById('act-button-name').value = act?.buttonName || 'Run Task';
  } else {
    buttonNameWrap.style.display = 'none';
    document.getElementById('act-button-name').value = '';
  }

  if (trigger === 'Conditional') {
    trigWrap.classList.remove('hidden');
    setTimeout(() => createRulesModule('act-trigger-rules', trigInst, `stm-${stmId}`), 0);
  } else {
    trigWrap.classList.add('hidden');
  }

  document.getElementById('activity-modal').classList.remove('hidden');

  // Initialize preview
  if (typeof updateActivityPreview === 'function') {
    updateActivityPreview();
  }
}
