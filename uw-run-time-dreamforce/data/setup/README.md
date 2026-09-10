# Setup Configuration Storage

This directory stores the persistent configuration for the UW Workbench Setup app (`public/setup/`).

## Files

- **`config.json`** — Active configuration (gitignored, user-specific)
- **`config.template.json`** — Default configuration template (committed to repo)

## How it works

1. The Setup app loads configuration from `/api/setup/config` on page load
2. The Next.js API route (`src/pages/api/setup/config.ts`) reads/writes `config.json`
3. If `config.json` doesn't exist, the API creates it with empty defaults
4. If the Setup app detects old `uw_*` localStorage data, it automatically migrates it to `config.json` on first load

## Schema

```json
{
  "fields": [],                    // Submission object fields
  "nextFieldId": 1,
  "reusableActivities": [],        // Reusable activity library
  "nextReusableActivityId": 1,
  "activityConfigs": [],           // Activity configurations
  "nextActivityConfigId": 1,
  "stageConfigs": [],              // Stage configurations
  "nextStageConfigId": 1,
  "assignmentRules": [],           // Assignment rules
  "nextAssignmentRuleId": 1,
  "connections": [],               // Integration connections
  "nextConnectionId": 1
}
```

## Reset to defaults

To reset configuration to defaults:

```bash
cp data/setup/config.template.json data/setup/config.json
```

Or delete `config.json` and restart the server — the API will recreate it with empty defaults.
