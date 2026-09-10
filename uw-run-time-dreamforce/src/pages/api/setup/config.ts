import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'data', 'setup', 'config.json');

function ensureConfigFile() {
  if (!fs.existsSync(CONFIG_PATH)) {
    const defaultConfig = {
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
      activitiesData: {},
      stmActivitiesData: {},
      nextActivityId: 1,
      nextStmActivityId: 1,
      enrichmentConfigs: [],
      nextEnrichmentConfigId: 1
    };
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  ensureConfigFile();

  if (req.method === 'GET') {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    // Ensure new fields exist for backward compatibility
    if (!config.activitiesData) config.activitiesData = {};
    if (!config.stmActivitiesData) config.stmActivitiesData = {};
    if (!config.nextActivityId) config.nextActivityId = 1;
    if (!config.nextStmActivityId) config.nextStmActivityId = 1;
    if (!config.enrichmentConfigs) config.enrichmentConfigs = [];
    if (!config.nextEnrichmentConfigId) config.nextEnrichmentConfigId = 1;
    res.status(200).json(config);
  } else if (req.method === 'POST') {
    const newConfig = req.body;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
    res.status(200).json({ success: true });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
