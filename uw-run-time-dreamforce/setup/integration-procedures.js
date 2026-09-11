// Integration Procedures (Salesforce IP pattern) — DEMO ONLY.
// No actual HTTP calls or wiring; this is configuration data the demo can show.

var integrationProcedures = [];
var nextIntegrationProcedureId = 1;

const IP_STEP_TYPES = [
  'HTTP Action',
  'Remote Action',
  'Set Values',
  'Conditional Block',
  'Try/Catch Block',
  'Loop Block',
  'Cache Block',
  'Response Action',
];

const DEFAULT_INTEGRATION_PROCEDURES = [
  {
    id: 1,
    name: 'Verisk360_GetPropertyValuation',
    procName: 'Verisk360',
    versionLabel: 'GetPropertyValuation',
    description: 'Pull 360Value building replacement-cost report and building characteristics.',
    lob: 'Commercial Property',
    provider: 'Verisk 360',
    active: true,
    lastModified: '2026-06-09T10:32:00Z',
    invocationMode: 'Standalone',
    steps: [
      { id: 1, name: 'setRequestPayload', type: 'Set Values', description: 'Map ACORD 140 location + structural fields into Verisk request.' },
      { id: 2, name: 'callVerisk360Api', type: 'HTTP Action', description: 'POST /v1/360value/properties — fetch valuation + characteristics.' },
      { id: 3, name: 'cacheValuation', type: 'Cache Block', description: 'Cache by latitude/longitude for 24h.' },
      { id: 4, name: 'extractFields', type: 'Set Values', description: 'Map response to Property Characteristics + Valuation enrichment fields.' },
      { id: 5, name: 'returnEnrichment', type: 'Response Action', description: 'Return building replacement cost, construction type, year built, square footage.' },
    ],
  },
  {
    id: 2,
    name: 'CoreLogic_GetCATExposure',
    procName: 'CoreLogic',
    versionLabel: 'GetCATExposure',
    description: 'Geocode the address and pull all CAT-exposure data (flood, EQ, wildfire, hurricane, hail).',
    lob: 'Commercial Property',
    provider: 'CoreLogic',
    active: true,
    lastModified: '2026-06-09T11:10:00Z',
    invocationMode: 'Standalone',
    steps: [
      { id: 1, name: 'geocodeAddress', type: 'HTTP Action', description: 'POST /geocode — resolve street address to lat/lng.' },
      { id: 2, name: 'lookupFloodZone', type: 'HTTP Action', description: 'GET /risk/flood — FEMA flood zone, BFE, panel id.' },
      { id: 3, name: 'lookupEarthquakeRisk', type: 'HTTP Action', description: 'GET /risk/earthquake — PGA, soil liquefaction, PML.' },
      { id: 4, name: 'lookupWildfireRisk', type: 'HTTP Action', description: 'GET /risk/wildfire — hazard severity zone + wildfire risk score.' },
      { id: 5, name: 'lookupHurricaneRisk', type: 'HTTP Action', description: 'GET /risk/hurricane — wind zone, distance to coast.' },
      { id: 6, name: 'aggregateExposureRisks', type: 'Set Values', description: 'Combine all CAT outputs into a single response object.' },
      { id: 7, name: 'returnEnrichment', type: 'Response Action', description: 'Return Location & CAT Exposure fields.' },
    ],
  },
  {
    id: 3,
    name: 'ISO_GetPublicProtectionClass',
    procName: 'ISO',
    versionLabel: 'GetPublicProtectionClass',
    description: 'Fetch ISO PPC, fire-department type, hydrant distance, water supply data.',
    lob: 'Commercial Property',
    provider: 'ISO Public Protection',
    active: true,
    lastModified: '2026-06-09T09:50:00Z',
    invocationMode: 'Standalone',
    steps: [
      { id: 1, name: 'setRequestPayload', type: 'Set Values', description: 'Build ISO request from address + lat/lng.' },
      { id: 2, name: 'callIsoPpcApi', type: 'HTTP Action', description: 'GET /ppc/lookup — ISO PPC class + fire protection.' },
      { id: 3, name: 'cachePpc', type: 'Cache Block', description: 'Cache by ZIP + protection district for 30 days.' },
      { id: 4, name: 'extractProtectionFields', type: 'Set Values', description: 'Map PPC, hydrant distance, water supply, FD type, response time.' },
      { id: 5, name: 'returnEnrichment', type: 'Response Action', description: 'Return Fire Protection & Response fields.' },
    ],
  },
  {
    id: 4,
    name: 'LexisNexis_GetClaimsHistory',
    procName: 'LexisNexis',
    versionLabel: 'GetClaimsHistory',
    description: 'Pull 5-year commercial CLUE history and aggregate by peril.',
    lob: 'Commercial Property',
    provider: 'LexisNexis CLUE Commercial',
    active: true,
    lastModified: '2026-06-09T08:21:00Z',
    invocationMode: 'Standalone',
    steps: [
      { id: 1, name: 'authenticate', type: 'HTTP Action', description: 'Exchange API key for short-lived bearer token.' },
      { id: 2, name: 'requestClueReport', type: 'HTTP Action', description: 'POST /clue/commercial/v2/lookup — request 5y claims history.' },
      { id: 3, name: 'parseClaims', type: 'Loop Block', description: 'Iterate claims; bucket by peril (fire, water, theft, wind/hail).' },
      { id: 4, name: 'computeAggregates', type: 'Set Values', description: 'Total incurred, claim frequency, severity, largest claim.' },
      { id: 5, name: 'fetchIndustryBenchmarks', type: 'Remote Action', description: 'Look up ISO industry-average frequency + severity.' },
      { id: 6, name: 'returnEnrichment', type: 'Response Action', description: 'Return Claims History fields.' },
    ],
  },
  {
    id: 5,
    name: 'DnB_GetBusinessProfile',
    procName: 'DnB',
    versionLabel: 'GetBusinessProfile',
    description: 'Pull D&B business profile, credit scores, public records.',
    lob: 'General Liability',
    provider: 'D&B (Dun & Bradstreet)',
    active: true,
    lastModified: '2026-06-09T07:45:00Z',
    invocationMode: 'Standalone',
    steps: [
      { id: 1, name: 'matchByDuns', type: 'Conditional Block', description: 'If DUNS provided, lookup by DUNS; else match by legal name + address.' },
      { id: 2, name: 'fetchProfile', type: 'HTTP Action', description: 'GET /v1/data/duns/{duns} — base profile + entity info.' },
      { id: 3, name: 'fetchCreditScores', type: 'HTTP Action', description: 'GET /v1/data/duns/{duns}/credit — PAYDEX, failure score, financial stress.' },
      { id: 4, name: 'fetchPublicRecords', type: 'HTTP Action', description: 'GET /v1/data/duns/{duns}/public-records — liens, judgments, bankruptcies.' },
      { id: 5, name: 'mergeFields', type: 'Set Values', description: 'Combine into Business Operations + Financial Stability output.' },
      { id: 6, name: 'returnEnrichment', type: 'Response Action', description: 'Return Business Operations + Financial Stability fields.' },
    ],
  },
  {
    id: 6,
    name: 'OSHA_GetSafetyHistory',
    procName: 'OSHA',
    versionLabel: 'GetSafetyHistory',
    description: 'Look up OSHA inspections, violations, abatement status by establishment.',
    lob: 'General Liability',
    provider: 'OSHA Enforcement API',
    active: true,
    lastModified: '2026-06-09T07:15:00Z',
    invocationMode: 'Standalone',
    steps: [
      { id: 1, name: 'matchEstablishment', type: 'HTTP Action', description: 'GET /v1/establishments?ein=… — find establishment ids.' },
      { id: 2, name: 'fetchInspections', type: 'HTTP Action', description: 'GET /v1/inspections?establishmentId=… (5-year window).' },
      { id: 3, name: 'fetchViolations', type: 'Loop Block', description: 'For each inspection, fetch citations + abatement status.' },
      { id: 4, name: 'aggregateOshaMetrics', type: 'Set Values', description: 'Inspection count, violation count, serious violations, abatement %.' },
      { id: 5, name: 'returnEnrichment', type: 'Response Action', description: 'Return Safety Programs & OSHA fields.' },
    ],
  },
  {
    id: 7,
    name: 'NCCI_GetWorkersCompEMR',
    procName: 'NCCI',
    versionLabel: 'GetWorkersCompEMR',
    description: 'Fetch experience modification factor and recent WC claim history.',
    lob: 'General Liability',
    provider: 'NCCI',
    active: true,
    lastModified: '2026-06-09T06:55:00Z',
    invocationMode: 'Standalone',
    steps: [
      { id: 1, name: 'lookupRiskId', type: 'HTTP Action', description: 'GET /risk-id/lookup?ein=… — resolve NCCI risk id.' },
      { id: 2, name: 'fetchEmr', type: 'HTTP Action', description: 'GET /experience-mod/{riskId} — current + prior EMR.' },
      { id: 3, name: 'computeTrend', type: 'Set Values', description: 'Compare current vs prior EMR → Improving / Stable / Declining.' },
      { id: 4, name: 'fetchWcClaims', type: 'Remote Action', description: 'Pull WC claims from current carrier.' },
      { id: 5, name: 'returnEnrichment', type: 'Response Action', description: 'Return Workers Compensation Experience fields.' },
    ],
  },
  {
    id: 8,
    name: 'Enrichment_RunAllForSubmission',
    procName: 'Enrichment',
    versionLabel: 'RunAllForSubmission',
    description: 'Orchestrator — fans out to all relevant provider IPs based on submission LOB and aggregates results.',
    lob: 'All',
    provider: 'Orchestrator',
    active: true,
    lastModified: '2026-06-10T14:00:00Z',
    invocationMode: 'Standalone',
    steps: [
      { id: 1, name: 'detectLineOfBusiness', type: 'Set Values', description: 'Inspect submission to determine which IPs to invoke.' },
      { id: 2, name: 'isCommercialProperty', type: 'Conditional Block', description: 'If submission contains Property line, run Verisk + CoreLogic + ISO + LexisNexis.' },
      { id: 3, name: 'isGeneralLiability', type: 'Conditional Block', description: 'If submission contains GL line, run D&B + OSHA + NCCI.' },
      { id: 4, name: 'callPropertyEnrichments', type: 'Loop Block', description: 'Fan-out to property IPs in parallel and collect results.' },
      { id: 5, name: 'callGeneralLiabilityEnrichments', type: 'Loop Block', description: 'Fan-out to GL IPs in parallel and collect results.' },
      { id: 6, name: 'mergeAndDedupe', type: 'Set Values', description: 'Combine outputs; resolve overlaps using source priority.' },
      { id: 7, name: 'persistEnrichmentRecord', type: 'Remote Action', description: 'Persist combined enrichment record on the submission.' },
      { id: 8, name: 'returnSummary', type: 'Response Action', description: 'Return enrichment summary + any provider errors.' },
    ],
  },
];

async function persistIntegrationProcedures() {
  setIntegrationProcedures(integrationProcedures);
  setNextIntegrationProcedureId(nextIntegrationProcedureId);
  await saveConfig();
}

// ── List page ────────────────────────────────────────────────

function renderIntegrationProcedures() {
  const host = document.getElementById('integration-procedures-content');
  if (!host) return;
  const empty = integrationProcedures.length === 0;
  const body = empty
    ? `<div class="rn-empty rn-empty-large">No integration procedures yet. Click <strong>New Procedure</strong> to create one.</div>`
    : `
      <table class="slds-table">
        <thead>
          <tr>
            <th>Procedure Name</th>
            <th>Provider</th>
            <th>Line of Business</th>
            <th>Steps</th>
            <th>Status</th>
            <th>Last Modified</th>
          </tr>
        </thead>
        <tbody>
          ${integrationProcedures.map(p => {
            const status = p.active
              ? `<span class="badge-active">Active</span>`
              : `<span class="badge-inactive">Inactive</span>`;
            const stepCount = (p.steps || []).length;
            const date = p.lastModified ? new Date(p.lastModified).toLocaleString() : '—';
            return `
              <tr>
                <td>
                  <a onclick="window.location.hash='#/integration-procedure/${p.id}'; return false;" style="cursor:pointer; color:#0176D3; font-weight:600;">${esc(p.procName)}</a>
                  <span style="color:#706E6B;"> · </span>
                  <span style="color:#444;">${esc(p.versionLabel)}</span>
                </td>
                <td>${esc(p.provider || '—')}</td>
                <td>${esc(p.lob || '—')}</td>
                <td>${stepCount}</td>
                <td>${status}</td>
                <td>${esc(date)}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  host.innerHTML = `
    <div class="ip-list-page">
      <div class="ip-list-header">
        <div>
          <h2>Integration Procedures</h2>
          <p>Reusable Salesforce-style integration procedures used by enrichment, reconciliation, and submission workflows.</p>
        </div>
        <button class="btn-new" onclick="ipOpenNewProcedureModal()">New Procedure</button>
      </div>
      <div class="ip-list-body">${body}</div>
    </div>`;
}

// ── Detail page ──────────────────────────────────────────────

let ipDetailSelectedStepId = null;

function renderIntegrationProcedureDetail(id) {
  const host = document.getElementById('integration-procedure-detail-content');
  if (!host) return;
  const proc = integrationProcedures.find(p => p.id === id);
  if (!proc) {
    host.innerHTML = `
      <div class="rn-page">
        <div class="rn-empty rn-empty-large">
          Integration procedure not found.
          <div style="margin-top:12px;">
            <button class="btn-cancel" onclick="window.location.hash='#/integration-hub'">Back</button>
          </div>
        </div>
      </div>`;
    return;
  }
  if (ipDetailSelectedStepId == null || !(proc.steps || []).some(s => s.id === ipDetailSelectedStepId)) {
    ipDetailSelectedStepId = (proc.steps && proc.steps[0]?.id) || null;
  }
  const activeStep = (proc.steps || []).find(s => s.id === ipDetailSelectedStepId);

  const stepList = (proc.steps || []).length === 0
    ? `<div class="rn-empty">No steps yet. Click <strong>Add Step</strong> to add the first one.</div>`
    : (proc.steps || []).map((s, i) => {
        const active = s.id === ipDetailSelectedStepId;
        return `
          <div class="rn-list-item ${active ? 'active' : ''}" onclick="ipSelectStep(${s.id})">
            <div class="rn-list-item-text">
              <span class="rn-list-name">${(i + 1)}. ${esc(s.name)}</span>
              <span class="rn-list-meta">${esc(s.type)}</span>
            </div>
          </div>`;
      }).join('');

  const detailHtml = !activeStep
    ? `<div class="rn-empty rn-empty-large">Select a step on the left, or add a new one.</div>`
    : `
      <div class="rn-detail-header">
        <div class="rn-detail-title">
          <h2>${esc(activeStep.name)}</h2>
          <span class="rn-tree-kind" style="font-size:12px;">${esc(activeStep.type)}</span>
        </div>
        <div class="rn-detail-header-actions">
          <button class="rn-row-icon-btn" title="Edit step" aria-label="Edit step" onclick="ipOpenEditStepModal(${proc.id}, ${activeStep.id})">
            <svg class="slds-button__icon slds-button__icon_x-small" aria-hidden="true">
              <use href="/assets/salesforce-lightning-design-system/icons/utility-sprite/svg/symbols.svg#edit" />
            </svg>
          </button>
          <button class="rn-row-icon-btn rn-row-icon-btn-danger" title="Delete step" aria-label="Delete step" onclick="ipDeleteStep(${proc.id}, ${activeStep.id})">
            <svg class="slds-button__icon slds-button__icon_x-small" aria-hidden="true">
              <use href="/assets/salesforce-lightning-design-system/icons/utility-sprite/svg/symbols.svg#delete" />
            </svg>
          </button>
        </div>
      </div>
      <div class="rn-attr-section">
        <div class="rn-attr-section-header">
          <h3>Step Details</h3>
        </div>
        <table class="slds-table rn-attr-table">
          <tbody>
            <tr>
              <td style="width: 200px; font-weight: 600; color: #5c5c5c;">Step Type</td>
              <td>${esc(activeStep.type)}</td>
            </tr>
            <tr>
              <td style="font-weight: 600; color: #5c5c5c;">Step Name</td>
              <td><code>${esc(activeStep.name)}</code></td>
            </tr>
            <tr>
              <td style="font-weight: 600; color: #5c5c5c; vertical-align: top;">Description</td>
              <td>${esc(activeStep.description || '—')}</td>
            </tr>
          </tbody>
        </table>
      </div>`;

  host.innerHTML = `
    <div class="ip-detail-page">
      <div style="margin-bottom: 12px;">
        <a href="#/integration-hub" style="color:#0176D3; text-decoration:none; font-size: 14px;">← Back to Integration Hub</a>
      </div>
      <div class="ip-detail-header">
        <div>
          <div class="ip-detail-procname">${esc(proc.procName)} · ${esc(proc.versionLabel)}</div>
          <h1>${esc(proc.description || proc.procName)}</h1>
          <div class="ip-detail-meta">
            <span class="ip-meta-pill">${esc(proc.provider || '—')}</span>
            <span class="ip-meta-pill">${esc(proc.lob || 'All')}</span>
            <span class="ip-meta-pill">${esc(proc.invocationMode || 'Standalone')}</span>
            <span class="badge-${proc.active ? 'active' : 'inactive'}">${proc.active ? 'Active' : 'Inactive'}</span>
          </div>
        </div>
        <div style="display:inline-flex; gap: 6px;">
          <button class="rn-row-icon-btn" title="Edit procedure" aria-label="Edit procedure" onclick="ipOpenEditProcedureModal(${proc.id})">
            <svg class="slds-button__icon slds-button__icon_x-small" aria-hidden="true">
              <use href="/assets/salesforce-lightning-design-system/icons/utility-sprite/svg/symbols.svg#edit" />
            </svg>
          </button>
          <button class="rn-row-icon-btn rn-row-icon-btn-danger" title="Delete procedure" aria-label="Delete procedure" onclick="ipDeleteProcedure(${proc.id})">
            <svg class="slds-button__icon slds-button__icon_x-small" aria-hidden="true">
              <use href="/assets/salesforce-lightning-design-system/icons/utility-sprite/svg/symbols.svg#delete" />
            </svg>
          </button>
        </div>
      </div>
      <div class="rn-md">
        <div class="rn-md-list">
          <div class="rn-md-list-header">
            <h2>Steps</h2>
            <button class="btn-new" onclick="ipOpenAddStepModal(${proc.id})">+ Add Step</button>
          </div>
          <div class="rn-md-list-items">${stepList}</div>
        </div>
        <div class="rn-md-detail">${detailHtml}</div>
      </div>
    </div>`;
}

function ipSelectStep(stepId) {
  ipDetailSelectedStepId = stepId;
  // Re-render preserving the current procedure
  const m = window.location.hash.match(/^#\/integration-procedure\/(\d+)$/);
  if (m) renderIntegrationProcedureDetail(parseInt(m[1]));
}

// ── Modals ────────────────────────────────────────────────────

function ipOpenNewProcedureModal() {
  rnShowPromptModal({
    title: 'New Integration Procedure',
    primaryLabel: 'Create',
    fields: [
      { key: 'procName', label: 'Procedure Name', placeholder: 'e.g. Verisk360', required: true },
      { key: 'versionLabel', label: 'Version Label', placeholder: 'e.g. GetPropertyValuation', required: true },
      { key: 'provider', label: 'Provider', placeholder: 'e.g. Verisk 360' },
      { key: 'lob', label: 'Line of Business', type: 'select', options: ['All', 'Commercial Property', 'General Liability', 'Commercial Auto', 'Workers Compensation', 'Cyber'], value: 'All' },
      { key: 'description', label: 'Description' },
    ],
    onSubmit: async ({ procName, versionLabel, provider, lob, description }) => {
      const id = nextIntegrationProcedureId++;
      const proc = {
        id,
        name: `${procName}_${versionLabel}`,
        procName,
        versionLabel,
        provider: provider || '',
        lob: lob || 'All',
        description: description || '',
        invocationMode: 'Standalone',
        active: true,
        lastModified: new Date().toISOString(),
        steps: [],
      };
      integrationProcedures.push(proc);
      await persistIntegrationProcedures();
      window.location.hash = `#/integration-procedure/${id}`;
    },
  });
}

function ipOpenEditProcedureModal(id) {
  const proc = integrationProcedures.find(p => p.id === id);
  if (!proc) return;
  rnShowPromptModal({
    title: 'Edit Integration Procedure',
    primaryLabel: 'Save',
    fields: [
      { key: 'procName', label: 'Procedure Name', value: proc.procName, required: true },
      { key: 'versionLabel', label: 'Version Label', value: proc.versionLabel, required: true },
      { key: 'provider', label: 'Provider', value: proc.provider || '' },
      { key: 'lob', label: 'Line of Business', type: 'select', options: ['All', 'Commercial Property', 'General Liability', 'Commercial Auto', 'Workers Compensation', 'Cyber'], value: proc.lob || 'All' },
      { key: 'description', label: 'Description', value: proc.description || '' },
    ],
    onSubmit: async ({ procName, versionLabel, provider, lob, description }) => {
      proc.procName = procName;
      proc.versionLabel = versionLabel;
      proc.name = `${procName}_${versionLabel}`;
      proc.provider = provider || '';
      proc.lob = lob || 'All';
      proc.description = description || '';
      proc.lastModified = new Date().toISOString();
      await persistIntegrationProcedures();
      renderIntegrationProcedureDetail(id);
    },
  });
}

function ipDeleteProcedure(id) {
  const proc = integrationProcedures.find(p => p.id === id);
  if (!proc) return;
  rnShowConfirmModal({
    title: 'Delete Integration Procedure',
    message: `Delete "${proc.name}"? This cannot be undone.`,
    danger: true,
    onConfirm: async () => {
      integrationProcedures = integrationProcedures.filter(p => p.id !== id);
      await persistIntegrationProcedures();
      window.location.hash = '#/integration-hub';
    },
  });
}

function ipOpenAddStepModal(procId) {
  rnShowPromptModal({
    title: 'Add Step',
    primaryLabel: 'Add',
    fields: [
      { key: 'name', label: 'Step Name', placeholder: 'e.g. callVerisk360Api', required: true },
      { key: 'type', label: 'Step Type', type: 'select', options: IP_STEP_TYPES, value: 'HTTP Action', required: true },
      { key: 'description', label: 'Description' },
    ],
    onSubmit: async ({ name, type, description }) => {
      const proc = integrationProcedures.find(p => p.id === procId);
      if (!proc) return;
      proc.steps = proc.steps || [];
      const newId = (proc.steps.reduce((m, s) => Math.max(m, s.id || 0), 0)) + 1;
      proc.steps.push({ id: newId, name, type, description: description || '' });
      proc.lastModified = new Date().toISOString();
      ipDetailSelectedStepId = newId;
      await persistIntegrationProcedures();
      renderIntegrationProcedureDetail(procId);
    },
  });
}

function ipOpenEditStepModal(procId, stepId) {
  const proc = integrationProcedures.find(p => p.id === procId);
  const step = proc?.steps?.find(s => s.id === stepId);
  if (!step) return;
  rnShowPromptModal({
    title: 'Edit Step',
    primaryLabel: 'Save',
    fields: [
      { key: 'name', label: 'Step Name', value: step.name, required: true },
      { key: 'type', label: 'Step Type', type: 'select', options: IP_STEP_TYPES, value: step.type, required: true },
      { key: 'description', label: 'Description', value: step.description || '' },
    ],
    onSubmit: async ({ name, type, description }) => {
      step.name = name;
      step.type = type;
      step.description = description || '';
      proc.lastModified = new Date().toISOString();
      await persistIntegrationProcedures();
      renderIntegrationProcedureDetail(procId);
    },
  });
}

function ipDeleteStep(procId, stepId) {
  const proc = integrationProcedures.find(p => p.id === procId);
  const step = proc?.steps?.find(s => s.id === stepId);
  if (!step) return;
  rnShowConfirmModal({
    title: 'Delete Step',
    message: `Delete step "${step.name}"?`,
    danger: true,
    onConfirm: async () => {
      proc.steps = (proc.steps || []).filter(s => s.id !== stepId);
      if (ipDetailSelectedStepId === stepId) ipDetailSelectedStepId = proc.steps[0]?.id ?? null;
      proc.lastModified = new Date().toISOString();
      await persistIntegrationProcedures();
      renderIntegrationProcedureDetail(procId);
    },
  });
}
