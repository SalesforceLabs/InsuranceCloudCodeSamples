// ═══════════════════════════════════════════════════════════════
// RUN MY DAY — PLAYBOOK CONFIGURATION
// ═══════════════════════════════════════════════════════════════

let playbooks = [];
let nextPlaybookId = 1;

const DEFAULT_RMD_GROUP_LIBRARY = [
  { id: 1, name: 'Grow', api: 'Grow', icon: 'trending_up', order: 1 },
  { id: 2, name: 'Retain', api: 'Retain', icon: 'shield', order: 2 },
  { id: 3, name: 'Service', api: 'Service', icon: 'service', order: 3 },
  { id: 4, name: 'Comply', api: 'Comply', icon: 'check_circle', order: 4 },
];

const RMD_GROUP_ICONS = [
  'trending_up', 'shield', 'service', 'check_circle', 'briefcase',
  'goals', 'opportunity', 'task', 'flag', 'lightbulb', 'people'
];

const RMD_INSIGHT_FLOWS = [
  'Renewal_Expiring_Flow',
  'Quote_Followup_Flow',
  'New_Submission_Flow',
  'Loss_Run_Review_Flow',
  'Compliance_Check_Flow',
];

const RMD_CALCULATED_INSIGHTS = [
  'High_Priority_Renewals',
  'Stalled_Quotes',
  'New_Business_Opportunities',
  'Pending_Compliance_Reviews',
  'Recent_Loss_Activity',
];

const RMD_ACTION_TYPES = [
  { value: 'platform', label: 'Platform Action' },
  { value: 'prompt', label: 'Prompt Template' },
  { value: 'flow', label: 'Flow' },
];

const RMD_ACTION_OPTIONS = {
  platform: ['Open Submission', 'Send Reminder', 'Mark Complete', 'Reassign'],
  prompt: ['Renewal Email Draft', 'Follow-up Email', 'Status Update'],
  flow: ['Quote_Generation_Flow', 'Renewal_Workflow', 'Loss_Review_Flow'],
};

let rmdGroupLibrary = [];
let nextRmdGroupId = 1;
let rmdInsightLibrary = [];
let nextRmdInsightId = 1;
let rmdActionLibrary = [];
let nextRmdActionId = 1;

// ── Wizard state (in-memory while the modal is open) ──────────
let wizardState = null;

async function persistPlaybooks() {
  setPlaybooks(playbooks);
  setNextPlaybookId(nextPlaybookId);
  await saveConfig();
}

async function persistRmdLibraries() {
  setRmdGroupLibrary(rmdGroupLibrary);
  setNextRmdGroupId(nextRmdGroupId);
  setRmdInsightLibrary(rmdInsightLibrary);
  setNextRmdInsightId(nextRmdInsightId);
  setRmdActionLibrary(rmdActionLibrary);
  setNextRmdActionId(nextRmdActionId);
  await saveConfig();
}

// ═══════════════════════════════════════════════════════════════
// PLAYBOOK LIST PAGE
// ═══════════════════════════════════════════════════════════════

function renderPlaybooksList() {
  const container = document.getElementById('run-my-day-content');
  if (!container) return;

  const headerHtml = `
    <div class="rmd-page">
      <div class="rmd-page-header">
        <div>
          <h1 class="rmd-page-title">Run My Day</h1>
          <p class="rmd-page-sub">Configure playbooks that structure the Run My Day landing experience.</p>
        </div>
        <button class="btn-new" onclick="openPlaybookWizard(null)">New Playbook</button>
      </div>
      <div class="rmd-table-wrap">
        ${playbooks.length === 0 ? renderPlaybookEmptyState() : renderPlaybookTable()}
      </div>
    </div>`;
  container.innerHTML = headerHtml;
}

function renderPlaybookEmptyState() {
  return `
    <div class="rmd-empty">
      <svg class="rmd-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <div class="rmd-empty-title">No Playbooks Yet</div>
      <div class="rmd-empty-sub">Create a playbook to define the Groups, Insights, and Actions on Run My Day.</div>
      <button class="btn-new" onclick="openPlaybookWizard(null)">New Playbook</button>
    </div>`;
}

function renderPlaybookTable() {
  return `
    <table class="slds-table">
      <thead>
        <tr>
          <th class="col-check"><input type="checkbox" /></th>
          <th>Configuration Name</th>
          <th>API Name</th>
          <th>Groups</th>
          <th>Insights</th>
          <th>Actions</th>
          <th>Status</th>
          <th class="col-action">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${playbooks.map(pb => `
          <tr>
            <td class="col-check"><input type="checkbox" /></td>
            <td><a onclick="openPlaybookWizard(${pb.id}); return false;" style="cursor:pointer;">${esc(pb.name)}</a></td>
            <td>${esc(pb.api)}</td>
            <td>${(pb.groups || []).length}</td>
            <td>${(pb.groups || []).reduce((s, g) => s + (g.insights || []).length, 0)}</td>
            <td>${(pb.groups || []).reduce((s, g) => s + (g.insights || []).reduce((s2, i) => s2 + (i.actions || []).length, 0), 0)}</td>
            <td>${pb.active ? '<span class="badge-active">Active</span>' : '<span class="badge-inactive">Inactive</span>'}</td>
            <td class="col-action">
              ${rowMenuBtn(`onclick="openRowMenu(this,[{label:'Edit',action:()=>openPlaybookWizard(${pb.id})},{label:'${pb.active ? 'Deactivate' : 'Activate'}',action:()=>togglePlaybookActive(${pb.id})},{label:'Delete',action:()=>deletePlaybook(${pb.id})}]);event.stopPropagation()"`)}
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

async function togglePlaybookActive(id) {
  const pb = playbooks.find(p => p.id === id);
  if (!pb) return;
  pb.active = !pb.active;
  await persistPlaybooks();
  renderPlaybooksList();
}

async function deletePlaybook(id) {
  const pb = playbooks.find(p => p.id === id);
  if (!pb) return;
  if (!confirm(`Delete playbook "${pb.name}"? This cannot be undone.`)) return;
  playbooks = playbooks.filter(p => p.id !== id);
  await persistPlaybooks();
  renderPlaybooksList();
}

// ═══════════════════════════════════════════════════════════════
// PLAYBOOK WIZARD
// ═══════════════════════════════════════════════════════════════

function openPlaybookWizard(playbookId) {
  const existing = playbookId ? playbooks.find(p => p.id === playbookId) : null;

  wizardState = {
    step: 1,
    editingId: playbookId || null,
    name: existing?.name || '',
    api: existing?.api || '',
    description: existing?.description || '',
    groups: existing ? JSON.parse(JSON.stringify(existing.groups || [])) : [],
    active: existing ? !!existing.active : true,
    selection: { groupIdx: null, insightIdx: null, actionIdx: null, focus: null },
  };

  const overlay = document.getElementById('rmd-wizard-overlay');
  if (!overlay) {
    document.body.insertAdjacentHTML('beforeend', renderWizardShell());
  }
  document.getElementById('rmd-wizard-overlay').classList.remove('hidden');
  renderWizard();
}

function closePlaybookWizard() {
  const overlay = document.getElementById('rmd-wizard-overlay');
  if (overlay) overlay.classList.add('hidden');
  wizardState = null;
}

function renderWizardShell() {
  return `
    <div id="rmd-wizard-overlay" class="rmd-wizard-overlay hidden">
      <div class="rmd-wizard">
        <div class="rmd-wizard-header">
          <h2 class="rmd-wizard-title" id="rmd-wizard-title">New Playbook</h2>
          <button class="rmd-wizard-close" onclick="closePlaybookWizard()" title="Close">×</button>
        </div>
        <div class="rmd-wizard-body">
          <div class="rmd-wizard-steps" id="rmd-wizard-steps"></div>
          <div class="rmd-wizard-content" id="rmd-wizard-content"></div>
        </div>
        <div class="rmd-wizard-footer">
          <button class="rmd-btn-back" id="rmd-wizard-back" onclick="wizardBack()">← Back</button>
          <button class="rmd-btn-next" id="rmd-wizard-next" onclick="wizardNext()">Save & Next</button>
        </div>
      </div>
    </div>`;
}

function renderWizard() {
  if (!wizardState) return;
  document.getElementById('rmd-wizard-title').textContent = wizardState.editingId ? 'Edit Playbook' : 'New Playbook';
  renderWizardSteps();
  const content = document.getElementById('rmd-wizard-content');
  if (wizardState.step === 1) content.innerHTML = renderStep1();
  else if (wizardState.step === 2) content.innerHTML = renderStep2();
  else if (wizardState.step === 3) content.innerHTML = renderStep3();

  // Update footer buttons
  const backBtn = document.getElementById('rmd-wizard-back');
  const nextBtn = document.getElementById('rmd-wizard-next');
  backBtn.disabled = wizardState.step === 1;
  if (wizardState.step === 3) {
    nextBtn.textContent = 'Save';
    nextBtn.classList.add('rmd-btn-primary');
  } else {
    nextBtn.textContent = 'Save & Next';
    nextBtn.classList.remove('rmd-btn-primary');
  }
}

function renderWizardSteps() {
  const stepsEl = document.getElementById('rmd-wizard-steps');
  const labels = ['Define', 'Configure', 'Activate'];
  stepsEl.innerHTML = labels.map((label, i) => {
    const num = i + 1;
    let cls = 'rmd-step-item';
    if (num === wizardState.step) cls += ' active';
    else if (num < wizardState.step) cls += ' done';
    return `
      <div class="${cls}">
        <div class="rmd-step-num">${num}</div>
        <div class="rmd-step-label">${label}</div>
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
// STEP 1 — DEFINE
// ═══════════════════════════════════════════════════════════════

function renderStep1() {
  const s = wizardState;
  return `
    <h3 class="rmd-step1-title">Define Your Configuration</h3>
    <div class="rmd-form-field">
      <label class="rmd-form-label"><span class="req">*</span> Configuration Name</label>
      <input type="text" class="rmd-form-input" id="rmd-pb-name" maxlength="80" placeholder="e.g., Wealth Advisor"
        value="${esc(s.name)}" oninput="onPlaybookNameInput(event)" />
      <div class="rmd-char-count"><span id="rmd-pb-name-count">${s.name.length}</span>/80</div>
    </div>
    <div class="rmd-form-field">
      <label class="rmd-form-label"><span class="req">*</span> API Name</label>
      <input type="text" class="rmd-form-input" id="rmd-pb-api" maxlength="80" placeholder="Enter API Name"
        value="${esc(s.api)}" oninput="wizardState.api = this.value; document.getElementById('rmd-pb-api-count').textContent = this.value.length;" />
      <div class="rmd-char-count"><span id="rmd-pb-api-count">${s.api.length}</span>/80</div>
    </div>
    <div class="rmd-form-field">
      <label class="rmd-form-label">Description</label>
      <textarea class="rmd-form-textarea" id="rmd-pb-desc" maxlength="500" placeholder="Describe the configuration's intended use and target segment..."
        oninput="wizardState.description = this.value; document.getElementById('rmd-pb-desc-count').textContent = this.value.length;">${esc(s.description)}</textarea>
      <div class="rmd-char-count"><span id="rmd-pb-desc-count">${s.description.length}</span>/500</div>
    </div>

    <div class="rmd-config-columns">
      <h4 class="rmd-config-columns-title">Configuration Columns</h4>
      <p class="rmd-config-columns-sub">Predefined columns that structure the Run My Day experience.</p>
      <div class="rmd-config-columns-card">
        <div class="rmd-config-column-row">
          <div class="rmd-config-column-num">1</div>
          <div>
            <div class="rmd-config-column-name">Group Configuration</div>
            <div class="rmd-config-column-desc">Top-level categories (e.g., Grow, Retain, Service) that bucket related insights for the underwriter.</div>
          </div>
        </div>
        <div class="rmd-config-column-row">
          <div class="rmd-config-column-num">2</div>
          <div>
            <div class="rmd-config-column-name">Insight Configuration</div>
            <div class="rmd-config-column-desc">Filtered views of submissions surfaced inside a group, powered by Flows or Calculated Insights.</div>
          </div>
        </div>
        <div class="rmd-config-column-row">
          <div class="rmd-config-column-num">3</div>
          <div>
            <div class="rmd-config-column-name">Action Configuration</div>
            <div class="rmd-config-column-desc">Things the underwriter can do on each submission — platform actions, prompt templates, or flows.</div>
          </div>
        </div>
      </div>
    </div>`;
}

function onPlaybookNameInput(event) {
  const v = event.target.value;
  wizardState.name = v;
  document.getElementById('rmd-pb-name-count').textContent = v.length;
  // Auto-suggest API name if blank
  if (!wizardState.api) {
    wizardState.api = v.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '');
    const apiInput = document.getElementById('rmd-pb-api');
    if (apiInput) {
      apiInput.value = wizardState.api;
      document.getElementById('rmd-pb-api-count').textContent = wizardState.api.length;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// STEP 2 — WYSIWYG CONFIGURE
// ═══════════════════════════════════════════════════════════════

function renderStep2() {
  return `
    <div class="rmd-config-layout">
      <div class="rmd-preview" id="rmd-preview">${renderPreview()}</div>
      <div class="rmd-config-panel" id="rmd-config-panel">${renderConfigPanel()}</div>
    </div>`;
}

function renderPreview() {
  const s = wizardState;
  const sel = s.selection;
  const selectedGroup = sel.groupIdx != null ? s.groups[sel.groupIdx] : null;

  return `
    <div class="rmd-preview-col">
      <h4 class="rmd-preview-col-title">Groups</h4>
      ${s.groups.map((g, i) => `
        <div class="rmd-preview-item ${sel.groupIdx === i && sel.focus === 'group' ? 'selected' : ''}"
          onclick="selectGroup(${i})">
          ${renderGroupIconSvg(g.icon)}
          <span style="flex:1; font-weight: 500;">${esc(g.name || 'Group ' + (i+1))}</span>
        </div>`).join('')}
      <button class="rmd-preview-add" onclick="addGroup()">+ Add Group</button>
    </div>

    <div class="rmd-preview-col">
      <h4 class="rmd-preview-col-title">Insights</h4>
      ${selectedGroup ? `
        ${(selectedGroup.insights || []).map((ins, i) => `
          <div class="rmd-preview-item rmd-preview-insight ${sel.insightIdx === i && sel.focus === 'insight' ? 'selected' : ''}"
            onclick="selectInsight(${i})">
            <div class="rmd-preview-insight-header">
              <span class="rmd-preview-insight-title">${esc(ins.name || 'Insight ' + (i+1))}</span>
              <span class="rmd-preview-insight-dot"></span>
            </div>
            <div class="rmd-preview-insight-bar"></div>
            <div class="rmd-preview-insight-bar"></div>
          </div>`).join('')}
        <button class="rmd-preview-add" onclick="addInsight()">+ Add Insight</button>
      ` : `<div style="font-size:11px; color:#a0a0a0; padding:8px 4px;">Select a group</div>`}
    </div>

    <div class="rmd-preview-col">
      <h4 class="rmd-preview-col-title">Actions</h4>
      ${(() => {
        if (sel.groupIdx == null || sel.insightIdx == null) {
          return `<div style="font-size:11px; color:#a0a0a0; padding:8px 4px;">Select an insight</div>`;
        }
        return `
          <div class="rmd-actions-tile ${sel.focus === 'action' ? 'selected' : ''}" onclick="openActionsPanel()">
            <div class="rmd-preview-insight-bar"></div>
            <div class="rmd-preview-insight-bar"></div>
            <div class="rmd-preview-insight-bar"></div>
            <div class="rmd-preview-insight-bar"></div>
            <div class="rmd-preview-insight-bar"></div>
          </div>`;
      })()}
    </div>
  `;
}

function renderGroupIconSvg(icon) {
  const icons = {
    trending_up: '<svg class="rmd-preview-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>',
    shield: '<svg class="rmd-preview-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    service: '<svg class="rmd-preview-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    check_circle: '<svg class="rmd-preview-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    briefcase: '<svg class="rmd-preview-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
    goals: '<svg class="rmd-preview-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    opportunity: '<svg class="rmd-preview-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="6" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    task: '<svg class="rmd-preview-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    flag: '<svg class="rmd-preview-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
    lightbulb: '<svg class="rmd-preview-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.4.5.6.9.6 1.5V18h6.8v-1.8c0-.6.2-1 .6-1.5A7 7 0 0 0 12 2z"/></svg>',
    people: '<svg class="rmd-preview-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  };
  return icons[icon] || icons.briefcase;
}

function selectGroup(idx) {
  wizardState.selection = { groupIdx: idx, insightIdx: null, actionIdx: null, focus: 'group' };
  refreshStep2();
}

function selectInsight(idx) {
  wizardState.selection.insightIdx = idx;
  wizardState.selection.actionIdx = null;
  wizardState.selection.focus = 'insight';
  refreshStep2();
}

function openActionsPanel() {
  if (wizardState.selection.groupIdx == null || wizardState.selection.insightIdx == null) return;
  wizardState.selection.actionIdx = null;
  wizardState.selection.focus = 'action';
  refreshStep2();
}

function refreshStep2() {
  document.getElementById('rmd-preview').innerHTML = renderPreview();
  document.getElementById('rmd-config-panel').innerHTML = renderConfigPanel();
}

function addGroup() {
  const newGroup = {
    libraryId: null,
    name: '',
    api: '',
    icon: 'briefcase',
    order: wizardState.groups.length + 1,
    insights: [],
  };
  wizardState.groups.push(newGroup);
  wizardState.selection = { groupIdx: wizardState.groups.length - 1, insightIdx: null, actionIdx: null, focus: 'group' };
  refreshStep2();
}

function addInsight() {
  if (wizardState.selection.groupIdx == null) return;
  const group = wizardState.groups[wizardState.selection.groupIdx];
  group.insights = group.insights || [];
  group.insights.push({
    libraryId: null,
    name: '',
    api: '',
    description: '',
    capabilityType: 'flow',
    capabilityValue: '',
    order: group.insights.length + 1,
    snoozeEnabled: false,
    dismissEnabled: false,
    actions: [],
  });
  wizardState.selection.insightIdx = group.insights.length - 1;
  wizardState.selection.actionIdx = null;
  wizardState.selection.focus = 'insight';
  refreshStep2();
}


// ─── Right config panel ────────────────────────────────────────

function renderConfigPanel() {
  const sel = wizardState.selection;
  if (sel.focus === 'group' && sel.groupIdx != null) return renderGroupConfig();
  if (sel.focus === 'insight' && sel.insightIdx != null) return renderInsightConfig();
  if (sel.focus === 'action' && sel.insightIdx != null) return renderActionConfig();
  return renderConfigEmpty();
}

function renderConfigEmpty() {
  return `
    <div class="rmd-config-empty">
      <svg class="rmd-config-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
      <div class="rmd-config-empty-title">Select A Group</div>
      <div class="rmd-config-empty-sub">Click a Group in the preview to open its configuration panel.</div>
    </div>`;
}

// ── Group ───────────────────────────────────────────────────────

function renderGroupConfig() {
  const idx = wizardState.selection.groupIdx;
  const group = wizardState.groups[idx];

  const libOptions = rmdGroupLibrary.map(g =>
    `<option value="${g.id}" ${group.libraryId === g.id ? 'selected' : ''}>${esc(g.name)}</option>`
  ).join('');

  const iconOptions = RMD_GROUP_ICONS.map(ic =>
    `<option value="${ic}" ${group.icon === ic ? 'selected' : ''}>${ic}</option>`
  ).join('');

  return `
    <h3 class="rmd-config-panel-title">Configure Group</h3>

    <div class="rmd-form-field">
      <label class="rmd-form-label">Select From Existing Groups</label>
      <select class="rmd-form-select" onchange="onGroupLibrarySelect(this.value)">
        <option value="">Select a Group</option>
        ${libOptions}
      </select>
    </div>

    <div class="rmd-config-divider">Or Create A New Group</div>

    <div class="rmd-form-field">
      <label class="rmd-form-label">Group Name</label>
      <input type="text" class="rmd-form-input" placeholder="Enter Name"
        value="${esc(group.name)}"
        oninput="updateGroupField('name', this.value)" />
    </div>

    <div class="rmd-form-field">
      <label class="rmd-form-label">API Name</label>
      <input type="text" class="rmd-form-input" placeholder="Enter API Name"
        value="${esc(group.api)}"
        oninput="updateGroupField('api', this.value)" />
    </div>

    <div class="rmd-form-field">
      <label class="rmd-form-label">Group Icon</label>
      <select class="rmd-form-select" onchange="updateGroupField('icon', this.value); refreshStep2();">
        ${iconOptions}
      </select>
    </div>

    <div class="rmd-form-field">
      <label class="rmd-form-label">Group Order</label>
      <input type="number" class="rmd-form-input" placeholder="Enter Order"
        value="${group.order || ''}"
        oninput="updateGroupField('order', parseInt(this.value) || 0)" />
    </div>

    <button class="rmd-btn-remove" onclick="removeGroup(${idx})">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
      Remove Group
    </button>

    <div class="rmd-config-next">Next: <a onclick="addInsight()">Configure Insights →</a></div>
  `;
}

function onGroupLibrarySelect(value) {
  const id = parseInt(value);
  const group = wizardState.groups[wizardState.selection.groupIdx];
  if (!id) {
    group.libraryId = null;
  } else {
    const lib = rmdGroupLibrary.find(g => g.id === id);
    if (lib) {
      group.libraryId = lib.id;
      group.name = lib.name;
      group.api = lib.api;
      group.icon = lib.icon;
      group.order = lib.order;
    }
  }
  refreshStep2();
}

function updateGroupField(field, value) {
  const group = wizardState.groups[wizardState.selection.groupIdx];
  group[field] = value;
  group.libraryId = null; // editing means it's a new variant, not a library reference
  if (field === 'name') {
    // Update the preview tile label
    const items = document.querySelectorAll('#rmd-preview .rmd-preview-col:nth-child(1) .rmd-preview-item');
    if (items[wizardState.selection.groupIdx]) {
      const span = items[wizardState.selection.groupIdx].querySelector('span');
      if (span) span.textContent = value || 'Group ' + (wizardState.selection.groupIdx + 1);
    }
  }
}

function removeGroup(idx) {
  if (!confirm('Remove this group from the playbook?')) return;
  wizardState.groups.splice(idx, 1);
  wizardState.selection = { groupIdx: null, insightIdx: null, actionIdx: null, focus: null };
  refreshStep2();
}

// ── Insight ─────────────────────────────────────────────────────

function renderInsightConfig() {
  const sel = wizardState.selection;
  const insight = wizardState.groups[sel.groupIdx].insights[sel.insightIdx];

  const libOptions = rmdInsightLibrary.map(i =>
    `<option value="${i.id}" ${insight.libraryId === i.id ? 'selected' : ''}>${esc(i.name)}</option>`
  ).join('');

  const flowOptions = RMD_INSIGHT_FLOWS.map(f =>
    `<option value="${f}" ${insight.capabilityType === 'flow' && insight.capabilityValue === f ? 'selected' : ''}>${f}</option>`
  ).join('');

  const ciOptions = RMD_CALCULATED_INSIGHTS.map(c =>
    `<option value="${c}" ${insight.capabilityType === 'calculated' && insight.capabilityValue === c ? 'selected' : ''}>${c}</option>`
  ).join('');

  return `
    <h3 class="rmd-config-panel-title">Configure Insight</h3>

    <div class="rmd-form-field">
      <label class="rmd-form-label">Select From Existing Insight</label>
      <select class="rmd-form-select" onchange="onInsightLibrarySelect(this.value)">
        <option value="">Select Insight</option>
        ${libOptions}
      </select>
    </div>

    <div class="rmd-config-divider">Or create a new insight</div>

    <div class="rmd-form-field">
      <label class="rmd-form-label">Insight Name</label>
      <input type="text" class="rmd-form-input" placeholder="Enter Name"
        value="${esc(insight.name)}"
        oninput="updateInsightField('name', this.value)" />
    </div>

    <div class="rmd-form-field">
      <label class="rmd-form-label">API Name</label>
      <input type="text" class="rmd-form-input" placeholder="Enter API Name"
        value="${esc(insight.api)}"
        oninput="updateInsightField('api', this.value)" />
    </div>

    <div class="rmd-form-field">
      <label class="rmd-form-label">Description</label>
      <input type="text" class="rmd-form-input" placeholder="Enter Description"
        value="${esc(insight.description)}"
        oninput="updateInsightField('description', this.value)" />
    </div>

    <div class="rmd-form-field">
      <label class="rmd-form-label">Insight Capability</label>
      <div class="rmd-form-grid-2">
        <select class="rmd-form-select" onchange="onInsightCapabilityChange('flow', this.value)">
          <option value="">Select Flow</option>
          ${flowOptions}
        </select>
        <select class="rmd-form-select" onchange="onInsightCapabilityChange('calculated', this.value)">
          <option value="">Select Calculated Insight</option>
          ${ciOptions}
        </select>
      </div>
      <div class="rmd-char-count">Select from Flows or Calculated Insights.</div>
    </div>

    <div class="rmd-form-field">
      <label class="rmd-form-label">Display order</label>
      <input type="number" class="rmd-form-input" placeholder="Enter Order"
        value="${insight.order || ''}"
        oninput="updateInsightField('order', parseInt(this.value) || 0)" />
    </div>

    <button class="rmd-btn-remove" onclick="removeInsight()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
      Remove Insight
    </button>

    <div class="rmd-config-next">Next: <a onclick="addAction()">Configure Actions →</a></div>
  `;
}

function onInsightLibrarySelect(value) {
  const id = parseInt(value);
  const sel = wizardState.selection;
  const insight = wizardState.groups[sel.groupIdx].insights[sel.insightIdx];
  if (!id) {
    insight.libraryId = null;
  } else {
    const lib = rmdInsightLibrary.find(i => i.id === id);
    if (lib) {
      Object.assign(insight, {
        libraryId: lib.id,
        name: lib.name,
        api: lib.api,
        description: lib.description,
        capabilityType: lib.capabilityType,
        capabilityValue: lib.capabilityValue,
        order: lib.order,
      });
    }
  }
  refreshStep2();
}

function updateInsightField(field, value) {
  const sel = wizardState.selection;
  const insight = wizardState.groups[sel.groupIdx].insights[sel.insightIdx];
  insight[field] = value;
  insight.libraryId = null;
}

function onInsightCapabilityChange(type, value) {
  const sel = wizardState.selection;
  const insight = wizardState.groups[sel.groupIdx].insights[sel.insightIdx];
  if (value) {
    insight.capabilityType = type;
    insight.capabilityValue = value;
    // Reset the other selector by re-rendering
    refreshStep2();
  }
}

function removeInsight() {
  if (!confirm('Remove this insight from the group?')) return;
  const sel = wizardState.selection;
  wizardState.groups[sel.groupIdx].insights.splice(sel.insightIdx, 1);
  wizardState.selection.insightIdx = null;
  wizardState.selection.actionIdx = null;
  wizardState.selection.focus = 'group';
  refreshStep2();
}

// ── Action ──────────────────────────────────────────────────────

function renderActionConfig() {
  const sel = wizardState.selection;
  const insight = wizardState.groups[sel.groupIdx].insights[sel.insightIdx];

  return `
    <div class="rmd-snooze-card">
      <h3 class="rmd-config-panel-title" style="margin-bottom:8px;">Snooze / Dismiss</h3>
      <div class="rmd-snooze-row">
        <div>
          <div class="rmd-snooze-label">Snooze</div>
          <div class="rmd-snooze-sub">Enable at runtime</div>
        </div>
        <div class="rmd-toggle ${insight.snoozeEnabled ? 'on' : ''}" onclick="toggleInsightSnooze('snooze')">
          <div class="rmd-toggle-switch"></div>
          <div class="rmd-toggle-state">${insight.snoozeEnabled ? 'Enabled' : 'Disabled'}</div>
        </div>
      </div>
      <div class="rmd-snooze-row">
        <div>
          <div class="rmd-snooze-label">Dismiss</div>
          <div class="rmd-snooze-sub">Enable at runtime</div>
        </div>
        <div class="rmd-toggle ${insight.dismissEnabled ? 'on' : ''}" onclick="toggleInsightSnooze('dismiss')">
          <div class="rmd-toggle-switch"></div>
          <div class="rmd-toggle-state">${insight.dismissEnabled ? 'Enabled' : 'Disabled'}</div>
        </div>
      </div>
    </div>

    <h3 class="rmd-config-panel-title">Configure Actions</h3>
    <p class="rmd-actions-message">Actions are defined in the Activities and Stages section.</p>
    <button class="rmd-link-btn" onclick="goToActivitiesAndStages()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/>
        <line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
      Go to Activities and Stages
    </button>
  `;
}

function goToActivitiesAndStages() {
  closePlaybookWizard();
  window.location.hash = '#/activity-management';
}

function toggleInsightSnooze(field) {
  const sel = wizardState.selection;
  const insight = wizardState.groups[sel.groupIdx].insights[sel.insightIdx];
  if (field === 'snooze') insight.snoozeEnabled = !insight.snoozeEnabled;
  if (field === 'dismiss') insight.dismissEnabled = !insight.dismissEnabled;
  refreshStep2();
}


// ═══════════════════════════════════════════════════════════════
// STEP 3 — ACTIVATE
// ═══════════════════════════════════════════════════════════════

function renderStep3() {
  const s = wizardState;
  return `
    ${s.active ? `
      <div class="rmd-activation-banner">
        <svg class="rmd-activation-banner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="9 12 11.5 14.5 16 10"/>
        </svg>
        <span>You've successfully activated this Run My Day configuration.</span>
      </div>` : ''}

    <h3 class="rmd-activation-title">Activation</h3>
    <p class="rmd-activation-sub">After activation, this Run My Day playbook will be available for configuration in Lighting App Builder.</p>

    <div class="rmd-activation-row">
      <div>
        <div class="rmd-activation-label">Activate This Configuration</div>
        <div class="rmd-activation-hint">Enable at runtime</div>
      </div>
      <div class="rmd-toggle ${s.active ? 'on' : ''}" onclick="toggleWizardActive()">
        <div class="rmd-toggle-switch"></div>
        <div class="rmd-toggle-state">${s.active ? 'Enabled' : 'Disabled'}</div>
      </div>
    </div>`;
}

function toggleWizardActive() {
  wizardState.active = !wizardState.active;
  document.getElementById('rmd-wizard-content').innerHTML = renderStep3();
}

// ═══════════════════════════════════════════════════════════════
// WIZARD NAVIGATION
// ═══════════════════════════════════════════════════════════════

function wizardBack() {
  if (wizardState.step > 1) {
    wizardState.step -= 1;
    renderWizard();
  }
}

async function wizardNext() {
  if (wizardState.step === 1) {
    if (!wizardState.name.trim()) { alert('Configuration Name is required.'); return; }
    if (!wizardState.api.trim()) { alert('API Name is required.'); return; }
    wizardState.step = 2;
    renderWizard();
    return;
  }

  if (wizardState.step === 2) {
    if (wizardState.groups.length === 0) {
      if (!confirm('No groups have been added. Continue anyway?')) return;
    }
    wizardState.step = 3;
    renderWizard();
    return;
  }

  if (wizardState.step === 3) {
    await commitPlaybook();
  }
}

async function commitPlaybook() {
  // Sync any newly defined groups/insights/actions to the libraries
  syncRmdLibraries();

  const record = {
    name: wizardState.name.trim(),
    api: wizardState.api.trim(),
    description: wizardState.description.trim(),
    groups: wizardState.groups,
    active: !!wizardState.active,
  };

  if (wizardState.editingId) {
    const idx = playbooks.findIndex(p => p.id === wizardState.editingId);
    if (idx >= 0) playbooks[idx] = { ...playbooks[idx], ...record };
  } else {
    playbooks.push({ id: nextPlaybookId++, ...record });
  }

  await persistPlaybooks();
  await persistRmdLibraries();
  closePlaybookWizard();
  renderPlaybooksList();
}

function syncRmdLibraries() {
  // Promote any in-wizard items that aren't yet in the libraries
  wizardState.groups.forEach(g => {
    if (!g.libraryId && g.name && g.api) {
      const existing = rmdGroupLibrary.find(x => x.api === g.api);
      if (!existing) {
        const id = nextRmdGroupId++;
        rmdGroupLibrary.push({ id, name: g.name, api: g.api, icon: g.icon, order: g.order });
        g.libraryId = id;
      }
    }
    (g.insights || []).forEach(ins => {
      if (!ins.libraryId && ins.name && ins.api) {
        const existing = rmdInsightLibrary.find(x => x.api === ins.api);
        if (!existing) {
          const id = nextRmdInsightId++;
          rmdInsightLibrary.push({
            id, name: ins.name, api: ins.api, description: ins.description,
            capabilityType: ins.capabilityType, capabilityValue: ins.capabilityValue, order: ins.order,
          });
          ins.libraryId = id;
        }
      }
      (ins.actions || []).forEach(act => {
        if (!act.libraryId && act.name && act.api) {
          const existing = rmdActionLibrary.find(x => x.api === act.api);
          if (!existing) {
            const id = nextRmdActionId++;
            rmdActionLibrary.push({
              id, name: act.name, api: act.api,
              actionType: act.actionType, actionValue: act.actionValue, order: act.order,
            });
            act.libraryId = id;
          }
        }
      });
    });
  });
}
