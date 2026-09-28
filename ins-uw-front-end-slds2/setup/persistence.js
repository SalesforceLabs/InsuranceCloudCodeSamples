// ═══════════════════════════════════════════════════════════════
// PERSISTENCE LAYER - API-backed configuration storage
// ═══════════════════════════════════════════════════════════════

let cachedConfig = null;
let configLoaded = false;

async function loadConfig() {
  if (configLoaded) return cachedConfig;

  try {
    const response = await fetch('/api/setup/config');
    if (!response.ok) throw new Error('Failed to load configuration');
    cachedConfig = await response.json();

    // Migrate from localStorage if config is empty
    if (cachedConfig.fields.length === 0 && localStorage.getItem('uw_fields')) {
      console.log('Migrating from localStorage to database...');
      await migrateFromLocalStorage();
    }

    configLoaded = true;
    return cachedConfig;
  } catch (error) {
    console.error('Error loading config:', error);
    // Fallback to empty config
    cachedConfig = {
      fields: [],
      nextFieldId: 1,
      reusableActivities: [],
      nextReusableActivityId: 1,
      activityConfigs: [],
      nextActivityConfigId: 1,
      stageConfigs: [],
      nextStageConfigId: 1,
      assignmentRules: [],
      nextAssignmentRuleId: 1,
      connections: [],
      nextConnectionId: 1,
      enrichmentConfigs: [],
      nextEnrichmentConfigId: 1,
      hasDefaultConnections: false,
      activitiesData: {},
      stmActivitiesData: {},
      nextActivityId: 1,
      nextStmActivityId: 1
    };
    configLoaded = true;
    return cachedConfig;
  }
}

async function migrateFromLocalStorage() {
  const migrated = {
    fields: JSON.parse(localStorage.getItem('uw_fields') || '[]'),
    nextFieldId: parseInt(localStorage.getItem('uw_next_field_id') || '1'),
    reusableActivities: JSON.parse(localStorage.getItem('uw_reusable_activities') || '[]'),
    nextReusableActivityId: parseInt(localStorage.getItem('uw_next_reusable_activity_id') || '1'),
    activityConfigs: JSON.parse(localStorage.getItem('uw_activity_configs') || '[]'),
    nextActivityConfigId: parseInt(localStorage.getItem('uw_next_stm_id') || '1'),
    stageConfigs: JSON.parse(localStorage.getItem('uw_stage_configs') || '[]'),
    nextStageConfigId: parseInt(localStorage.getItem('uw_next_sc_id') || '1'),
    assignmentRules: JSON.parse(localStorage.getItem('uw_assignment_rules') || '[]'),
    nextAssignmentRuleId: parseInt(localStorage.getItem('uw_next_assignment_id') || '1'),
    connections: JSON.parse(localStorage.getItem('uw_connections') || '[]'),
    nextConnectionId: parseInt(localStorage.getItem('uw_next_conn_id') || '1'),
    enrichmentConfigs: JSON.parse(localStorage.getItem('uw_enrichment_configs') || '[]'),
    nextEnrichmentConfigId: parseInt(localStorage.getItem('uw_next_enrichment_id') || '1'),
    activitiesData: JSON.parse(localStorage.getItem('uw_activities') || '{}'),
    stmActivitiesData: JSON.parse(localStorage.getItem('uw_stm_activities') || '{}'),
    nextActivityId: parseInt(localStorage.getItem('uw_next_act_id') || '1'),
    nextStmActivityId: parseInt(localStorage.getItem('uw_next_stm_act_id') || '1')
  };

  cachedConfig = migrated;
  await saveConfig();
  console.log('Migration complete!');
}

async function saveConfig() {
  try {
    const response = await fetch('/api/setup/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cachedConfig)
    });
    if (!response.ok) throw new Error('Failed to save configuration');
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    alert('Failed to save configuration. Please try again.');
    return false;
  }
}

// Getters
function getFields() {
  return cachedConfig?.fields || [];
}

function getNextFieldId() {
  return cachedConfig?.nextFieldId || 1;
}

function getReusableActivities() {
  return cachedConfig?.reusableActivities || [];
}

function getNextReusableActivityId() {
  return cachedConfig?.nextReusableActivityId || 1;
}

function getActivityConfigs() {
  return cachedConfig?.activityConfigs || [];
}

function getNextActivityConfigId() {
  return cachedConfig?.nextActivityConfigId || 1;
}

function getStageConfigs() {
  return cachedConfig?.stageConfigs || [];
}

function getNextStageConfigId() {
  return cachedConfig?.nextStageConfigId || 1;
}

function getAssignmentRules() {
  return cachedConfig?.assignmentRules || [];
}

function getNextAssignmentRuleId() {
  return cachedConfig?.nextAssignmentRuleId || 1;
}

function getConnections() {
  return cachedConfig?.connections || [];
}

function getNextConnectionId() {
  return cachedConfig?.nextConnectionId || 1;
}

function getEnrichmentConfigs() {
  return cachedConfig?.enrichmentConfigs || [];
}

function getNextEnrichmentConfigId() {
  return cachedConfig?.nextEnrichmentConfigId || 1;
}

function getPlaybooks() {
  return cachedConfig?.playbooks || [];
}

function getNextPlaybookId() {
  return cachedConfig?.nextPlaybookId || 1;
}

function getRmdGroupLibrary() {
  return cachedConfig?.rmdGroupLibrary || [];
}

function getNextRmdGroupId() {
  return cachedConfig?.nextRmdGroupId || 1;
}

function getRmdInsightLibrary() {
  return cachedConfig?.rmdInsightLibrary || [];
}

function getNextRmdInsightId() {
  return cachedConfig?.nextRmdInsightId || 1;
}

function getRmdActionLibrary() {
  return cachedConfig?.rmdActionLibrary || [];
}

function getNextRmdActionId() {
  return cachedConfig?.nextRmdActionId || 1;
}

function getRnEntities() { return cachedConfig?.rnEntities || []; }
function getNextRnEntityId() { return cachedConfig?.nextRnEntityId || 1; }
function getRnCoverages() { return cachedConfig?.rnCoverages || []; }
function getNextRnCoverageId() { return cachedConfig?.nextRnCoverageId || 1; }
function getRnHierarchies() { return cachedConfig?.rnHierarchies || []; }
function getNextRnHierarchyId() { return cachedConfig?.nextRnHierarchyId || 1; }

function getIntegrationProcedures() { return cachedConfig?.integrationProcedures || []; }
function getNextIntegrationProcedureId() { return cachedConfig?.nextIntegrationProcedureId || 1; }

function getEnrichmentDefinitions() { return cachedConfig?.enrichmentDefinitions || []; }
function getNextEnrichmentDefinitionId() { return cachedConfig?.nextEnrichmentDefinitionId || 1; }

function getActivitiesData() {
  return cachedConfig?.activitiesData || {};
}

function getStmActivitiesData() {
  return cachedConfig?.stmActivitiesData || {};
}

function getNextActivityId() {
  return cachedConfig?.nextActivityId || 1;
}

function getNextStmActivityId() {
  return cachedConfig?.nextStmActivityId || 1;
}

// Setters
function setFields(fields) {
  if (cachedConfig) cachedConfig.fields = fields;
}

function setNextFieldId(id) {
  if (cachedConfig) cachedConfig.nextFieldId = id;
}

function setReusableActivities(activities) {
  if (cachedConfig) cachedConfig.reusableActivities = activities;
}

function setNextReusableActivityId(id) {
  if (cachedConfig) cachedConfig.nextReusableActivityId = id;
}

function setActivityConfigs(configs) {
  if (cachedConfig) cachedConfig.activityConfigs = configs;
}

function setNextActivityConfigId(id) {
  if (cachedConfig) cachedConfig.nextActivityConfigId = id;
}

function setStageConfigs(configs) {
  if (cachedConfig) cachedConfig.stageConfigs = configs;
}

function setNextStageConfigId(id) {
  if (cachedConfig) cachedConfig.nextStageConfigId = id;
}

function setAssignmentRules(rules) {
  if (cachedConfig) cachedConfig.assignmentRules = rules;
}

function setNextAssignmentRuleId(id) {
  if (cachedConfig) cachedConfig.nextAssignmentRuleId = id;
}

function setConnections(connections) {
  if (cachedConfig) cachedConfig.connections = connections;
}

function setNextConnectionId(id) {
  if (cachedConfig) cachedConfig.nextConnectionId = id;
}

function setEnrichmentConfigs(configs) {
  if (cachedConfig) cachedConfig.enrichmentConfigs = configs;
}

function setNextEnrichmentConfigId(id) {
  if (cachedConfig) cachedConfig.nextEnrichmentConfigId = id;
}

function setPlaybooks(playbooks) {
  if (cachedConfig) cachedConfig.playbooks = playbooks;
}

function setNextPlaybookId(id) {
  if (cachedConfig) cachedConfig.nextPlaybookId = id;
}

function setRmdGroupLibrary(groups) {
  if (cachedConfig) cachedConfig.rmdGroupLibrary = groups;
}

function setNextRmdGroupId(id) {
  if (cachedConfig) cachedConfig.nextRmdGroupId = id;
}

function setRmdInsightLibrary(insights) {
  if (cachedConfig) cachedConfig.rmdInsightLibrary = insights;
}

function setNextRmdInsightId(id) {
  if (cachedConfig) cachedConfig.nextRmdInsightId = id;
}

function setRmdActionLibrary(actions) {
  if (cachedConfig) cachedConfig.rmdActionLibrary = actions;
}

function setNextRmdActionId(id) {
  if (cachedConfig) cachedConfig.nextRmdActionId = id;
}

function setRnEntities(v) { if (cachedConfig) cachedConfig.rnEntities = v; }
function setNextRnEntityId(v) { if (cachedConfig) cachedConfig.nextRnEntityId = v; }
function setRnCoverages(v) { if (cachedConfig) cachedConfig.rnCoverages = v; }
function setNextRnCoverageId(v) { if (cachedConfig) cachedConfig.nextRnCoverageId = v; }
function setRnHierarchies(v) { if (cachedConfig) cachedConfig.rnHierarchies = v; }
function setNextRnHierarchyId(v) { if (cachedConfig) cachedConfig.nextRnHierarchyId = v; }

function setIntegrationProcedures(v) { if (cachedConfig) cachedConfig.integrationProcedures = v; }
function setNextIntegrationProcedureId(v) { if (cachedConfig) cachedConfig.nextIntegrationProcedureId = v; }

function setEnrichmentDefinitions(v) { if (cachedConfig) cachedConfig.enrichmentDefinitions = v; }
function setNextEnrichmentDefinitionId(v) { if (cachedConfig) cachedConfig.nextEnrichmentDefinitionId = v; }

function setActivitiesData(data) {
  if (cachedConfig) cachedConfig.activitiesData = data;
}

function setStmActivitiesData(data) {
  if (cachedConfig) cachedConfig.stmActivitiesData = data;
}

function setNextActivityId(id) {
  if (cachedConfig) cachedConfig.nextActivityId = id;
}

function setNextStmActivityId(id) {
  if (cachedConfig) cachedConfig.nextStmActivityId = id;
}
