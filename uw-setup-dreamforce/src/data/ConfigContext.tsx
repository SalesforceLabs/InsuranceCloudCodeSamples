import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { loadConfig, saveConfig } from './persistence';
import { DEFAULT_CONFIG, type SetupConfig } from '@/types/config';
import {
  SEED_ENRICHMENT_CONFIGS,
  SEED_ENRICHMENT_DEFINITIONS,
  SEED_INTEGRATION_PROCEDURES,
} from '@/panels/DataEnrichment/seed';
import { setCustomProviders } from '@/panels/IntegrationHub/providers';

type Updater = (prev: SetupConfig) => SetupConfig;

interface ConfigContextValue {
  config: SetupConfig;
  loaded: boolean;
  update: (updater: Updater) => void;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SetupConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadConfig().then((next) => {
      if (cancelled) return;
      // One-time seed: populate Data Enrichment arrays if empty so existing
      // installs pick up the canonical demo data without manual migration.
      let seeded = next;
      let didSeed = false;
      if (!seeded.enrichmentConfigs || seeded.enrichmentConfigs.length === 0) {
        seeded = {
          ...seeded,
          enrichmentConfigs: SEED_ENRICHMENT_CONFIGS,
          nextEnrichmentConfigId:
            SEED_ENRICHMENT_CONFIGS.reduce((m, c) => Math.max(m, c.id), 0) + 1,
        };
        didSeed = true;
      }
      if (!seeded.integrationProcedures || seeded.integrationProcedures.length === 0) {
        seeded = {
          ...seeded,
          integrationProcedures: SEED_INTEGRATION_PROCEDURES,
          nextIntegrationProcedureId:
            SEED_INTEGRATION_PROCEDURES.reduce((m, p) => Math.max(m, p.id), 0) + 1,
        };
        didSeed = true;
      }
      if (!seeded.enrichmentDefinitions || seeded.enrichmentDefinitions.length === 0) {
        seeded = {
          ...seeded,
          enrichmentDefinitions: SEED_ENRICHMENT_DEFINITIONS,
          nextEnrichmentDefinitionId:
            SEED_ENRICHMENT_DEFINITIONS.reduce((m, d) => Math.max(m, d.id), 0) + 1,
        };
        didSeed = true;
      }
      setCustomProviders(seeded.customProviders);
      setConfig(seeded);
      setLoaded(true);
      if (didSeed) void saveConfig(seeded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((updater: Updater) => {
    setConfig((prev) => {
      const next = updater(prev);
      setCustomProviders(next.customProviders);
      void saveConfig(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ config, loaded, update }), [config, loaded, update]);
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used inside ConfigProvider');
  return ctx;
}
