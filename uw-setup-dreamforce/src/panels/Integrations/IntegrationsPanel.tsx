import { useState } from 'react';
import { Icon, type IconName } from '@/components/ui';
import { openSetupAssistant } from '@/components/shell/setup-assistant-store';
import {
  buildAssistantContext,
  type AssistantSubject,
} from '@/components/shell/setup-assistant-scripts';
import { IntegrationsHealthSection } from '@/panels/GeneralSetup/IntegrationsHealthSection';
import { ConnectionsSection } from '@/panels/GeneralSetup/ConnectionsSection';
import { IntegrationsCatalogSection } from '@/panels/GeneralSetup/IntegrationsCatalogSection';
import '@/components/ThreePanelHub.css';
import '@/panels/GeneralSetup/GeneralSetup.css';

interface IntegrationsSubcategory {
  key: string;
  label: string;
  icon: IconName;
  description: string;
  subject: AssistantSubject;
  render: () => JSX.Element;
}

const SUBCATEGORIES: IntegrationsSubcategory[] = [
  {
    key: 'health',
    label: 'Health',
    icon: 'trending-up',
    description: 'Uptime, latency, and error rates across active integrations.',
    subject: 'integrations-health',
    render: () => <IntegrationsHealthSection />,
  },
  {
    key: 'connections',
    label: 'Connections',
    icon: 'plug',
    description: 'Live connections configured from the provider catalog.',
    subject: 'integrations-connections',
    render: () => <ConnectionsSection />,
  },
  {
    key: 'provider-catalog',
    label: 'P2P Provider Catalog',
    icon: 'database',
    description:
      'Browse data and rating providers and configure connection templates.',
    subject: 'integrations-catalog',
    render: () => <IntegrationsCatalogSection />,
  },
  {
    key: 'dcc-library',
    label: 'Data Cloud Connector Catalog',
    icon: 'layers',
    description:
      'Packaged Data Cloud Connectors that ingest data streams into Data Cloud.',
    subject: 'integrations-dcc-library',
    render: () => <IntegrationsCatalogSection mode="dcc-library" />,
  },
];

/**
 * Top-level Integrations page. Master/detail only — the three integration
 * sections (Health / Connections / Provider Catalog) reused from General
 * Setup, without the category landing grid or hero. Lives above Underwriting
 * in the nav.
 */
export function IntegrationsPanel() {
  const [selected, setSelected] = useState<string>(SUBCATEGORIES[0].key);
  const selectedSub =
    SUBCATEGORIES.find((s) => s.key === selected) ?? SUBCATEGORIES[0];

  return (
    <div className="gs-page">
      <div className="tph tph--working">
        <div className="tph__row">
          <section className="tph__md" aria-label="Integrations">
            <header className="tph__md-header">
              <h4 className="tph__md-title">Integrations</h4>
            </header>
            <div className="tph__md-body">
              <nav className="tph__md-master" aria-label="Sections">
                {SUBCATEGORIES.map((s) => (
                  <div key={s.key} className="tph__md-master-cell">
                    <button
                      type="button"
                      className={`tph__md-master-item${selected === s.key ? ' tph__md-master-item--selected' : ''}`}
                      onClick={() => setSelected(s.key)}
                    >
                      <span className="tph__md-master-item-label">{s.label}</span>
                      <span className="tph__md-master-item-desc">{s.description}</span>
                    </button>
                  </div>
                ))}
              </nav>
              <div className="tph__md-detail">
                <div className="tph__detail">
                  <header className="tph__detail-header">
                    <button
                      type="button"
                      className="tph__ask-btn"
                      onClick={() =>
                        openSetupAssistant(
                          buildAssistantContext({ subject: selectedSub.subject, mode: 'ask' }),
                        )
                      }
                      aria-label="Ask the Setup Assistant"
                      title="Ask the Setup Assistant"
                    >
                      <svg
                        viewBox="0 0 1000 1000"
                        aria-hidden="true"
                        focusable="false"
                        className="tph__ask-icon"
                      >
                        <path
                          fill="currentColor"
                          d="M569 521c-10 0-20 2-27 5l-29 6-13 1h-2a96 96 0 01-12-1c-18-3-29-7-29-7q-12-4.5-27-6c-56-6-81 16-82 20s5 57 9 65a35 35 0 0018 16c6 3 57 8 74 5s20-8 25-17c3-6 11-35 16-52 1-3 1-10 9-10 8 1 8 7 9 11a588 588 0 0015 52c5 9 7 15 24 17 18 3 69-1 75-4 6-2 13-7 18-15 4-8 11-61 10-65s-25-26-81-22zm175-166a282 282 0 00-54-54 46 46 0 0037-45 46 46 0 00-46-46 46 46 0 00-42 61 320 320 0 00-105-30 321 321 0 00-172 29 46 46 0 00-43-60 46 46 0 00-46 46c0 23 16 41 37 45-58 44-99 108-108 181a258 258 0 0054 192 307 307 0 00245 116c150 0 279-103 297-243a258 258 0 00-54-192M500 711c-113 0-204-76-204-170 0-28 8-56 24-80a81 81 0 006 22 21 21 0 0029 10 22 22 0 0010-29c-3-6-10-25 7-39a185 185 0 0064 40c48 15 84 6 85 6a22 22 0 0015-15c3-7 1-15-4-20-24-29-35-49-40-62 97 14 116 93 117 97a21 21 0 0025 16c12-2 19-14 17-26-3-14-11-34-25-54 48 31 79 80 79 134 0 94-92 170-205 170"
                        />
                      </svg>
                      Ask
                    </button>
                  </header>
                  {selectedSub.render()}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
