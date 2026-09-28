// ═══════════════════════════════════════════════════════════════
// ACTIVITY MANAGEMENT - Tab Switching
// ═══════════════════════════════════════════════════════════════

function switchActivityManagementTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('#panel-activity-management .integration-hub-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  event.target.classList.add('active');

  // Update tab content
  document.querySelectorAll('#panel-activity-management .integration-tab-content').forEach(content => {
    content.classList.remove('active');
  });

  const targetTab = document.getElementById(`activity-mgmt-tab-${tabName}`);
  if (targetTab) {
    targetTab.classList.add('active');
  }

  // Render appropriate content
  if (tabName === 'activities') {
    renderActivitiesLibraryTable();
  } else if (tabName === 'stage-management') {
    renderStmTable();
    renderScTable();
  }
}

// ═══════════════════════════════════════════════════════════════
// UPDATED ACTIVITY MODAL - Activity Reference Selection
// ═══════════════════════════════════════════════════════════════

function onActivityReferenceChange() {
  const activityId = parseInt(document.getElementById('act-activity-ref').value);
  const infoDiv = document.getElementById('act-selected-info');
  const detailsDiv = document.getElementById('act-selected-details');
  const displayNameInput = document.getElementById('act-name');

  if (!activityId) {
    infoDiv.classList.add('hidden');
    displayNameInput.value = '';
    updateActivityPreview();
    return;
  }

  const activity = getActivityById(activityId);
  if (!activity) {
    infoDiv.classList.add('hidden');
    displayNameInput.value = '';
    updateActivityPreview();
    return;
  }

  // Prepopulate display name with activity name
  if (!displayNameInput.value) {
    displayNameInput.value = activity.name;
  }

  // Show activity details
  const processDisplay = buildProcessCellDetails(activity);
  detailsDiv.innerHTML = `
    <div style="font-size: 14px; font-weight: 600; color: var(--sf-text); margin-bottom: 4px;">${esc(activity.name)}</div>
    ${activity.description ? `<div style="font-size: 12px; color: var(--sf-text-muted); margin-bottom: 6px;">${esc(activity.description)}</div>` : ''}
    <div style="font-size: 12px; color: var(--sf-text);">${processDisplay}</div>
  `;

  infoDiv.classList.remove('hidden');
  updateActivityPreview();
}

function buildProcessCellDetails(activity) {
  if (activity.action === 'Flow') {
    return `<strong>Flow:</strong> ${esc(activity.actionDetails.flowName || '—')}`;
  } else if (activity.action === 'Integration Procedure') {
    return `<strong>Integration Procedure:</strong> ${esc(activity.actionDetails.ipName || '—')}`;
  } else if (activity.action === 'Omniscript') {
    return `<strong>Omniscript:</strong> ${esc(activity.actionDetails.omniscriptName || '—')}`;
  } else if (activity.action === 'Agent') {
    return `<strong>Agent:</strong> ${esc(activity.actionDetails.agentName || '—')}`;
  } else if (activity.action === 'Enrichment Definition') {
    return `<strong>Enrichment Definition:</strong> ${esc(activity.actionDetails.enrichmentDefinitionName || '—')}`;
  }
  return '—';
}

// ═══════════════════════════════════════════════════════════════
// OVERRIDE: Activity Modal Opening (for Stage Activities)
// ═══════════════════════════════════════════════════════════════

// Store original function
const _originalOpenActivityModal = typeof openActivityModal !== 'undefined' ? openActivityModal : null;

function openActivityModal(scIdOrKey, stageKeyOrActId, actIdOrNull) {
  // Handle both old and new signatures
  // Old: openActivityModal('1:2', actId)
  // New: openActivityModal(1, 'sc-1:2', actId)

  let scId, stageKey, actId;

  if (typeof scIdOrKey === 'string' && scIdOrKey.includes(':')) {
    // Old signature: ('scId:stageIdx', actId)
    const [scIdStr, stageIdxStr] = scIdOrKey.split(':');
    scId = parseInt(scIdStr);
    const stageIdx = parseInt(stageIdxStr);
    stageKey = `sc-${scId}:${stageIdx}`;
    actId = stageKeyOrActId;
  } else {
    // New signature: (scId, 'sc-scId:stageIdx', actId)
    scId = scIdOrKey;
    stageKey = stageKeyOrActId;
    actId = actIdOrNull;
  }
  const acts = getActivitiesForStage(scId, stageKey);
  const act = actId ? acts.find(a => a.id === actId) : null;

  document.getElementById('act-edit-id').value = actId || '';
  document.getElementById('act-stage-key').value = stageKey;
  document.getElementById('activity-modal-title').textContent = act ? 'Edit Task' : 'Add Task to Stage';

  // Populate activity selector
  buildActivitySelector(act?.activityRefId || null);

  // Display name override
  document.getElementById('act-name').value = act?.nameOverride || '';
  document.getElementById('act-mandatory').checked = act?.mandatory || false;

  // Show selected activity info if editing
  if (act?.activityRefId) {
    onActivityReferenceChange();
  } else {
    document.getElementById('act-selected-info').classList.add('hidden');
  }

  // Availability
  const avail = act?.availability || 'On Stage Change';
  document.querySelectorAll('[name="act-availability"]').forEach(r => {
    r.checked = r.value === avail;
  });
  const availInst = `act-avail-${scId}-${stageKey}-${actId || 'new'}`;
  rulesInstances[availInst] = act?.availabilityRules
    ? JSON.parse(JSON.stringify(act.availabilityRules))
    : { stageKey, conditions: [], expression: '' };
  const availWrap = document.getElementById('act-availability-rules-wrap');
  if (avail === 'Conditional') {
    availWrap.classList.remove('hidden');
    setTimeout(() => createRulesModule('act-availability-rules', availInst, stageKey), 0);
  } else {
    availWrap.classList.add('hidden');
  }

  // Trigger
  const trigger = act?.trigger || 'Manual';
  document.querySelectorAll('[name="act-trigger"]').forEach(r => {
    r.checked = r.value === trigger;
  });
  const trigInst = `act-trig-${scId}-${stageKey}-${actId || 'new'}`;
  rulesInstances[trigInst] = act?.triggerRules
    ? JSON.parse(JSON.stringify(act.triggerRules))
    : { stageKey, conditions: [], expression: '' };
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
    setTimeout(() => createRulesModule('act-trigger-rules', trigInst, stageKey), 0);
  } else {
    trigWrap.classList.add('hidden');
  }

  // Outcomes — reset to the Trigger & Availability tab and load this activity's outcomes
  const configTabBtn = document.querySelector('#activity-modal .act-modal-tabs .integration-hub-tab');
  if (configTabBtn) switchActivityTab('config', configTabBtn);
  initActivityOutcomes(act?.outcomes);

  document.getElementById('activity-modal').classList.remove('hidden');

  // Initialize preview
  updateActivityPreview();
}

// ═══════════════════════════════════════════════════════════════
// SAVE ACTIVITY - Updated to use Activity Reference
// ═══════════════════════════════════════════════════════════════

// This will override the saveActivity function from app.js
const _originalSaveActivity = typeof saveActivity !== 'undefined' ? saveActivity : null;

async function saveActivity() {
  const stageKey = document.getElementById('act-stage-key').value;
  const actId = document.getElementById('act-edit-id').value;
  const nameOverride = document.getElementById('act-name').value.trim();

  // Display Name is required; Activity reference is optional.
  if (!nameOverride) {
    alert('Display Name is required.');
    return;
  }

  const activityRefRaw = document.getElementById('act-activity-ref').value;
  const activityRefId = activityRefRaw ? parseInt(activityRefRaw) : null;
  let activity = null;
  if (activityRefId) {
    activity = getActivityById(activityRefId);
    if (!activity) {
      alert('Selected activity not found.');
      return;
    }
  }

  // Extract scId from stageKey for instance ID construction
  let scId = null;
  if (stageKey.startsWith('sc-')) {
    const match = stageKey.match(/^sc-(\d+)/);
    scId = match ? parseInt(match[1]) : null;
  } else if (stageKey.startsWith('stm-')) {
    scId = parseInt(stageKey.replace('stm-', ''));
  }

  // Get availability
  let availability = 'On Stage Change';
  document.querySelectorAll('[name="act-availability"]').forEach(r => {
    if (r.checked) availability = r.value;
  });

  let availabilityRules = null;
  if (availability === 'Conditional') {
    let availInst;
    if (stageKey.startsWith('stm-')) {
      availInst = `stm-act-avail-${scId}-${actId || 'new'}`;
    } else {
      availInst = `act-avail-${scId}-${stageKey}-${actId || 'new'}`;
    }
    availabilityRules = rulesInstances[availInst];
  }

  // Get trigger
  let trigger = 'Manual';
  document.querySelectorAll('[name="act-trigger"]').forEach(r => {
    if (r.checked) trigger = r.value;
  });

  let triggerRules = null;
  if (trigger === 'Conditional') {
    let trigInst;
    if (stageKey.startsWith('stm-')) {
      trigInst = `stm-act-trig-${scId}-${actId || 'new'}`;
    } else {
      trigInst = `act-trig-${scId}-${stageKey}-${actId || 'new'}`;
    }
    triggerRules = rulesInstances[trigInst];
  }

  const mandatory = document.getElementById('act-mandatory').checked;

  // Get button name (only for Manual trigger)
  const buttonName = trigger === 'Manual' ? document.getElementById('act-button-name').value.trim() : '';

  // Build activity record
  const actRecord = {
    activityRefId,
    nameOverride,
    availability,
    availabilityRules,
    trigger,
    triggerRules,
    mandatory,
    outcomes: _actOutcomes.map(o => ({ name: (o.name || '').trim() || 'new outcome', description: o.description || '' })),
  };

  if (buttonName) {
    actRecord.buttonName = buttonName;
  }

  // Save to appropriate data structure
  if (stageKey.startsWith('stm-')) {
    // Submission-level activity
    const stmId = parseInt(stageKey.split('-')[1]);
    await saveStmActivity(stmId, actId, actRecord);
  } else if (stageKey.startsWith('sc-')) {
    // Stage-level activity
    // stageKey format: "sc-scId:stageIdx" e.g., "sc-1:2"
    const parts = stageKey.replace('sc-', '').split(':');
    const scId = parseInt(parts[0]);
    const stgIdx = parseInt(parts[1]);
    await saveStageActivity(scId, stgIdx, actId, actRecord);
  }

  closeActivityModal();
}

// Helper function to save submission-level activity
async function saveStmActivity(stmId, actId, actRecord) {
  if (!stmActivitiesData[stmId]) {
    stmActivitiesData[stmId] = [];
  }

  if (actId) {
    const idx = stmActivitiesData[stmId].findIndex(a => a.id === parseInt(actId));
    stmActivitiesData[stmId][idx] = { id: parseInt(actId), ...actRecord };
  } else {
    stmActivitiesData[stmId].push({ id: nextStmActivityId++, ...actRecord });
  }

  await persistStmActivities();
  const stm = activityConfigs.find(x => x.id === stmId);
  renderStmActivities(stm);
}

// Helper function to save stage-level activity
async function saveStageActivity(scId, stgIdx, actId, actRecord) {
  const stageKey = `${scId}:${stgIdx}`;

  if (!activitiesData[stageKey]) {
    activitiesData[stageKey] = [];
  }

  if (actId) {
    const idx = activitiesData[stageKey].findIndex(a => a.id === parseInt(actId));
    activitiesData[stageKey][idx] = { id: parseInt(actId), ...actRecord };
  } else {
    const newId = Date.now(); // Simple unique ID
    activitiesData[stageKey].push({ id: newId, ...actRecord });
  }

  await persistActivities();
  renderActivities(scId, stgIdx);
}

// Helper to get activities for a stage
function getActivitiesForStage(scId, stageKey) {
  if (stageKey.startsWith('stm-')) {
    const stmId = parseInt(stageKey.split('-')[1]);
    return stmActivitiesData[stmId] || [];
  } else if (stageKey.startsWith('sc-')) {
    // Extract stageIdx from stageKey format "sc-scId:stageIdx"
    const stgIdx = parseInt(stageKey.split(':')[1]);
    // Use activitiesData with key format "scId:stageIdx"
    const dataKey = `${scId}:${stgIdx}`;
    return activitiesData[dataKey] || [];
  }
  return [];
}

// ═══════════════════════════════════════════════════════════════
// WRAPPER: deleteActivity - Handle both old and new signatures
// ═══════════════════════════════════════════════════════════════

const _originalDeleteActivity = typeof deleteActivity !== 'undefined' ? deleteActivity : null;

async function deleteActivity(scIdOrKey, stageIdxOrActId, actIdOrNull) {
  // Handle both signatures:
  // Old: deleteActivity('1:2', actId)
  // New: deleteActivity(scId, stageIdx, actId)

  if (typeof scIdOrKey === 'string' && scIdOrKey.includes(':')) {
    // Old signature
    if (_originalDeleteActivity) {
      return _originalDeleteActivity(scIdOrKey, stageIdxOrActId);
    }
  } else {
    // New signature: (scId, stageIdx, actId)
    const scId = scIdOrKey;
    const stageIdx = stageIdxOrActId;
    const actId = actIdOrNull;
    const stageKey = `${scId}:${stageIdx}`;

    const act = activitiesData[stageKey]?.find(a => a.id === actId);
    if (!confirm(`Delete activity "${act?.name}"?`)) return;
    activitiesData[stageKey] = activitiesData[stageKey].filter(a => a.id !== actId);
    await persistActivities();
    renderActivities(scId, stageIdx);
  }
}

// ═══════════════════════════════════════════════════════════════
// ACTIVITY MODAL - In-form Tabs (Trigger & Availability / Outcomes)
// ═══════════════════════════════════════════════════════════════

function switchActivityTab(tabName, btn) {
  document.querySelectorAll('#activity-modal .act-modal-tabs .integration-hub-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const config = document.getElementById('act-tab-config');
  const outcomes = document.getElementById('act-tab-outcomes');
  // Set display explicitly — #act-tab-config carries an inline display that would
  // otherwise override the .active class toggle and keep both panels visible.
  if (config) {
    config.classList.toggle('active', tabName === 'config');
    config.style.display = tabName === 'config' ? 'flex' : 'none';
  }
  if (outcomes) {
    outcomes.classList.toggle('active', tabName === 'outcomes');
    outcomes.style.display = tabName === 'outcomes' ? 'block' : 'none';
  }

  if (tabName === 'outcomes') renderActivityOutcomes();
}

// ═══════════════════════════════════════════════════════════════
// ACTIVITY MODAL - Outcomes (SLDS vertical navigation)
// ═══════════════════════════════════════════════════════════════

let _actOutcomes = [];
let _actOutcomeIdx = 0;

function initActivityOutcomes(outcomes) {
  _actOutcomes = Array.isArray(outcomes) ? JSON.parse(JSON.stringify(outcomes)) : [];
  _actOutcomeIdx = _actOutcomes.length ? 0 : -1;
  renderActivityOutcomes();
}

function renderActivityOutcomes() {
  const mount = document.getElementById('act-outcomes-mount');
  if (!mount) return;

  if (_actOutcomeIdx >= _actOutcomes.length) _actOutcomeIdx = _actOutcomes.length - 1;

  const navItems = _actOutcomes.length
    ? _actOutcomes.map((o, i) => `
        <div class="outcomes-nav-item ${i === _actOutcomeIdx ? 'active' : ''}" onclick="selectActivityOutcome(${i})">
          <input type="radio" name="act-outcome-sel" ${i === _actOutcomeIdx ? 'checked' : ''} onclick="event.stopPropagation();selectActivityOutcome(${i})" />
          <span class="outcomes-nav-label" id="oc-nav-label-${i}">${esc(o.name || 'new outcome')}</span>
        </div>`).join('')
    : `<div class="outcomes-nav-empty">No outcomes yet. Click New to add one.</div>`;

  const atTop = _actOutcomeIdx <= 0;
  const atBottom = _actOutcomeIdx < 0 || _actOutcomeIdx >= _actOutcomes.length - 1;

  let formHtml;
  if (_actOutcomeIdx < 0 || !_actOutcomes[_actOutcomeIdx]) {
    formHtml = `<div class="outcomes-empty-panel">Select an outcome to edit its details, or click New to add one.</div>`;
  } else {
    const o = _actOutcomes[_actOutcomeIdx];
    formHtml = `
      <div class="outcomes-form">
        <div class="outcomes-form-header">
          <h4>Outcome Details</h4>
          <button type="button" class="outcomes-remove-btn" onclick="removeActivityOutcome(${_actOutcomeIdx})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            Remove Outcome
          </button>
        </div>
        <div class="form-group">
          <label>Outcome Value <span class="req">*</span></label>
          <input type="text" id="act-outcome-value" placeholder="e.g., Approved"
            value="${esc(o.name || '')}"
            oninput="setActivityOutcomeName(this.value)"
            onblur="commitActivityOutcomeName()" />
          <p class="form-hint">Shown as the outcome name. Referenced by transition and trigger conditions.</p>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea id="act-outcome-desc" rows="3" placeholder="Optional description"
            oninput="_actOutcomes[${_actOutcomeIdx}].description = this.value">${esc(o.description || '')}</textarea>
        </div>
      </div>`;
  }

  mount.innerHTML = `
    <div class="outcomes-layout">
      <div class="outcomes-nav">
        <div class="outcomes-nav-toolbar">
          <button type="button" class="btn-secondary" onclick="addActivityOutcome()">New</button>
          <div class="outcomes-move-group">
            <button type="button" class="outcomes-move-btn" title="Move up" ${atTop ? 'disabled' : ''} onclick="moveActivityOutcome(-1)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 15l-6-6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button type="button" class="outcomes-move-btn" title="Move down" ${atBottom ? 'disabled' : ''} onclick="moveActivityOutcome(1)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
        <div class="outcomes-nav-list">${navItems}</div>
      </div>
      ${formHtml}
    </div>`;
}

function selectActivityOutcome(idx) {
  _actOutcomeIdx = idx;
  renderActivityOutcomes();
}

function addActivityOutcome() {
  _actOutcomes.push({ name: 'new outcome', description: '' });
  _actOutcomeIdx = _actOutcomes.length - 1;
  renderActivityOutcomes();
  const input = document.getElementById('act-outcome-value');
  if (input) { input.focus(); input.select(); }
}

function removeActivityOutcome(idx) {
  _actOutcomes.splice(idx, 1);
  if (_actOutcomeIdx >= _actOutcomes.length) _actOutcomeIdx = _actOutcomes.length - 1;
  renderActivityOutcomes();
}

function moveActivityOutcome(dir) {
  const from = _actOutcomeIdx;
  const to = from + dir;
  if (to < 0 || to >= _actOutcomes.length) return;
  const [moved] = _actOutcomes.splice(from, 1);
  _actOutcomes.splice(to, 0, moved);
  _actOutcomeIdx = to;
  renderActivityOutcomes();
}

function setActivityOutcomeName(value) {
  if (_actOutcomes[_actOutcomeIdx]) _actOutcomes[_actOutcomeIdx].name = value;
}

function commitActivityOutcomeName() {
  const label = document.getElementById(`oc-nav-label-${_actOutcomeIdx}`);
  const o = _actOutcomes[_actOutcomeIdx];
  if (label && o) label.textContent = o.name || 'new outcome';
}

// ═══════════════════════════════════════════════════════════════
// ACTIVITY PREVIEW - WYSIWYG Pending Task Preview
// ═══════════════════════════════════════════════════════════════

function updateActivityPreview() {
  const activityId = parseInt(document.getElementById('act-activity-ref').value);
  const displayName = document.getElementById('act-name').value.trim();
  const trigger = document.querySelector('[name="act-trigger"]:checked')?.value || 'Manual';
  const buttonName = document.getElementById('act-button-name').value.trim();

  const previewTitle = document.getElementById('preview-title');
  const previewSubline = document.getElementById('preview-subline');
  const previewDescription = document.getElementById('preview-description');
  const previewButtonSection = document.getElementById('preview-button-section');
  const previewButton = document.getElementById('preview-button');
  const previewHierarchyIcon = document.getElementById('preview-hierarchy-icon');
  const previewDependency = document.getElementById('preview-dependency');
  const previewDependencyList = document.getElementById('preview-dependency-list');

  // Title is driven by the Display Name input; defaults to "Task Name" when blank.
  previewTitle.textContent = displayName || 'Task Name';

  // Description comes from the linked activity if one is selected.
  if (activityId) {
    const activity = getActivityById(activityId);
    if (activity && activity.description) {
      previewDescription.textContent = activity.description;
      previewDescription.style.display = 'block';
    } else {
      previewDescription.style.display = 'none';
    }
  } else {
    previewDescription.style.display = 'none';
  }

  // Update byline based on trigger
  let taskType = 'Manual Task';
  if (trigger === 'On Stage Change') {
    taskType = 'Stage Task';
  } else if (trigger === 'Conditional') {
    taskType = 'Dependent Task';
  }
  previewSubline.textContent = `Submission/Submission Line · ${taskType} · Assigned To [Assignee]`;

  // Show/hide hierarchy icon for conditional
  if (trigger === 'Conditional') {
    previewHierarchyIcon.style.display = 'block';
  } else {
    previewHierarchyIcon.style.display = 'none';
  }

  // Show/hide dependency section for conditional
  if (trigger === 'Conditional') {
    // Get trigger rules to show dependencies
    const stageKey = document.getElementById('act-stage-key').value;
    const actId = document.getElementById('act-edit-id').value;
    const inst = `act-trig-${stageKey}-${actId || 'new'}`;
    const rules = rulesInstances[inst];

    if (rules && rules.conditions && rules.conditions.length > 0) {
      // Get all tasks from the stage to resolve names
      let stageTasks = [];
      if (stageKey.startsWith('stm-')) {
        const stmId = parseInt(stageKey.replace('stm-', ''));
        stageTasks = getStmActivities(stmId) || [];
      } else if (stageKey.startsWith('sc-')) {
        const cleanKey = stageKey.replace('sc-', '');
        const [scId, stageIdx] = cleanKey.split(':').map(Number);
        stageTasks = getActivities(scId, stageIdx) || [];
      }

      // Extract task names from conditions using activityId
      const dependencies = rules.conditions
        .filter(c => c.activityId)
        .map(c => {
          const task = stageTasks.find(t => t.id == c.activityId);
          if (task) {
            // Resolve task name from activity reference
            if (task.activityRefId) {
              const activity = getActivityById(task.activityRefId);
              return task.nameOverride || activity?.name || 'Unknown Task';
            }
            return task.name || 'Unknown Task';
          }
          return 'Task ' + c.activityId;
        })
        .filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates
        .slice(0, 3); // Show max 3

      if (dependencies.length > 0) {
        previewDependencyList.textContent = dependencies.join(', ');
        previewDependency.style.display = 'block';
      } else {
        previewDependencyList.textContent = 'Task Name';
        previewDependency.style.display = 'block';
      }
    } else {
      previewDependencyList.textContent = 'Task Name';
      previewDependency.style.display = 'block';
    }
  } else {
    previewDependency.style.display = 'none';
  }

  // Show/hide button section based on trigger
  if (trigger === 'Manual') {
    previewButtonSection.style.display = 'flex';
    previewButton.textContent = buttonName || 'Run Task';
  } else {
    previewButtonSection.style.display = 'none';
  }
}
