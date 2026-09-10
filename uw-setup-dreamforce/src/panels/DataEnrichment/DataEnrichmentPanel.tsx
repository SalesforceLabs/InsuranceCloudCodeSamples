import { useMemo, useState } from 'react';
import {
  Button,
  Card,
  EmptyState,
  Icon,
  PageHeader,
  Tabs,
} from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import { DefinitionsTable } from './DefinitionsTable';
import { DefinitionModal } from './DefinitionModal';
import { EnrichmentFieldsEditor } from './EnrichmentFieldsEditor';
import type { EnrichmentDefinition } from '@/types/config';

type Tab = 'data' | 'definition';

export function DataEnrichmentPanel() {
  const [tab, setTab] = useState<Tab>('data');
  const [modal, setModal] = useState<{ open: boolean; editingId: number | null }>({
    open: false,
    editingId: null,
  });
  const { config } = useConfig();

  const tabs = useMemo(
    () => [
      { id: 'data' as Tab, label: 'Enrichment Fields' },
      { id: 'definition' as Tab, label: 'Enrichment Definition', badge: config.enrichmentDefinitions.length },
    ],
    [config.enrichmentDefinitions.length],
  );

  return (
    <>
      <PageHeader
        title="Data Enrichment"
        icon={<Icon name="sparkles" size={20} />}
        subtitle="Browse enrichment data by LOB and define reusable enrichments that can be attached to activities."
      />
      <Tabs items={tabs} active={tab} onChange={(id) => setTab(id as Tab)} />
      <div style={{ marginTop: 16 }}>
        {tab === 'data' ? (
          <EnrichmentFieldsEditor />
        ) : (
          <DefinitionsView
            onNew={() => setModal({ open: true, editingId: null })}
            onEdit={(d) => setModal({ open: true, editingId: d.id })}
          />
        )}
      </div>
      <DefinitionModal
        open={modal.open}
        editingId={modal.editingId}
        onClose={() => setModal({ open: false, editingId: null })}
      />
    </>
  );
}

function DefinitionsView({
  onNew,
  onEdit,
}: {
  onNew: () => void;
  onEdit: (d: EnrichmentDefinition) => void;
}) {
  const { config } = useConfig();
  return (
    <Card
      title="Enrichment Definitions"
      subtitle="Reusable named enrichments that can be attached to activities. Each ties a category from Enrichment Data to an Integration Procedure."
      actions={
        <Button variant="brand" iconLeading={<Icon name="plus" size={14} />} onClick={onNew}>
          New Definition
        </Button>
      }
      padding="none"
    >
      {config.enrichmentDefinitions.length === 0 ? (
        <EmptyState
          icon={<Icon name="sparkles" size={20} />}
          title="No enrichment definitions yet"
          description="Click New Definition to create one."
          action={
            <Button variant="brand" iconLeading={<Icon name="plus" size={14} />} onClick={onNew}>
              New Definition
            </Button>
          }
        />
      ) : (
        <DefinitionsTable onEdit={onEdit} />
      )}
    </Card>
  );
}

