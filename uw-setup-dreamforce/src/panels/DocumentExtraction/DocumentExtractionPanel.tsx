import { useState } from 'react';
import { Button, Card, EmptyState, Icon, PageHeader, Toggle } from '@/components/ui';

export function DocumentExtractionPanel() {
  const [enabled, setEnabled] = useState(true);

  return (
    <>
      <PageHeader
        eyebrow="Insurance Settings"
        title="Document Extraction"
        icon={<Icon name="doc" size={20} />}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card padding="md">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ maxWidth: 720 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Document AI for Insurance</h2>
              <p style={{ margin: '6px 0 0', color: 'var(--slds-g-color-on-surface-2)', fontSize: 13 }}>
                Process PDFs using Agentforce and large language models (LLMs) to extract content and map it to
                Insurance objects and fields.
              </p>
            </div>
            <Toggle
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              label={enabled ? 'Enabled' : 'Disabled'}
            />
          </div>
        </Card>
        <Card title="Submission Document Extraction Templates" padding="none">
          <EmptyState
            icon={<Icon name="doc" size={20} />}
            title="No Templates Configured"
            description="Start by creating a new extraction template."
            action={
              <Button variant="brand" iconLeading={<Icon name="plus" size={14} />} disabled>
                New Template
              </Button>
            }
          />
        </Card>
      </div>
    </>
  );
}
