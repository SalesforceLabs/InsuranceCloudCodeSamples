import { Badge, Button, Icon, Table, type Column } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { EnrichmentDefinition } from '@/types/config';

interface Props {
  onEdit: (d: EnrichmentDefinition) => void;
}

export function DefinitionsTable({ onEdit }: Props) {
  const { config, update } = useConfig();

  const cols: Column<EnrichmentDefinition>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (d) => (
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onEdit(d);
          }}
          style={{ fontWeight: 600, color: 'var(--slds-g-color-on-surface-3)' }}
        >
          {d.name}
        </a>
      ),
    },
    {
      key: 'lob',
      header: 'Line of Business',
      render: (d) => d.lob || '—',
    },
    {
      key: 'category',
      header: 'Category',
      render: (d) => d.categoryName || '—',
    },
    {
      key: 'ip',
      header: 'Integration Procedure',
      render: (d) => <code style={{ fontSize: 12 }}>{d.integrationProcedureName || '—'}</code>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      render: (d) =>
        d.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>,
    },
    {
      key: 'actions',
      header: '',
      width: '110px',
      render: (d) => (
        <div style={{ display: 'inline-flex', gap: 4 }}>
          <Button variant="icon" aria-label="Edit" onClick={() => onEdit(d)}>
            <Icon name="edit" />
          </Button>
          <Button
            variant="icon"
            aria-label="Delete"
            onClick={() => {
              if (!confirm(`Delete "${d.name}"?`)) return;
              update((prev) => ({
                ...prev,
                enrichmentDefinitions: prev.enrichmentDefinitions.filter((x) => x.id !== d.id),
              }));
            }}
          >
            <Icon name="trash" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Table<EnrichmentDefinition>
      columns={cols}
      rows={config.enrichmentDefinitions}
      rowKey={(d) => d.id}
      empty="No definitions yet."
    />
  );
}
