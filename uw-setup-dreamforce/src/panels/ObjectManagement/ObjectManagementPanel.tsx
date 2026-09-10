import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Icon,
  PageHeader,
  Table,
  type Column,
} from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { Field } from '@/types/config';
import { FieldModal } from './FieldModal';

export function ObjectManagementPanel() {
  const { config } = useConfig();
  const [editing, setEditing] = useState<Field | null>(null);
  const [open, setOpen] = useState(false);

  const fields = config.fields;

  const columns: Column<Field>[] = [
    {
      key: 'label',
      header: 'Field Label',
      render: (f) => <span style={{ fontWeight: 500 }}>{f.label}</span>,
    },
    {
      key: 'api',
      header: 'API Name',
      render: (f) => <code>{f.api}</code>,
    },
    {
      key: 'type',
      header: 'Data Type',
      render: (f) => <Badge tone="brand">{f.type}</Badge>,
    },
    {
      key: 'description',
      header: 'Description',
      render: (f) => (
        <span style={{ color: 'var(--slds-g-color-on-surface-2)' }}>{f.description || '—'}</span>
      ),
    },
    {
      key: 'required',
      header: 'Required',
      align: 'center',
      width: '90px',
      render: (f) =>
        f.required ? <Badge tone="warning">Required</Badge> : <span style={{ color: 'var(--slds-g-color-on-surface-2)' }}>—</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '120px',
      render: (f) => (
        <div style={{ display: 'inline-flex', gap: 4 }}>
          <Button
            variant="icon"
            aria-label="Edit"
            onClick={() => {
              setEditing(f);
              setOpen(true);
            }}
          >
            <Icon name="edit" />
          </Button>
          <DeleteFieldButton field={f} />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Custom Object · API: Submission__c"
        title="Submission"
        subtitle={`${fields.length} field${fields.length === 1 ? '' : 's'} defined`}
        icon={<Icon name="database" size={20} />}
        actions={
          <Button
            variant="brand"
            iconLeading={<Icon name="plus" size={14} />}
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            New Field
          </Button>
        }
      />
      <Card padding="none">
        <Table<Field>
          columns={columns}
          rows={fields}
          rowKey={(f) => f.id}
          empty="No fields defined yet."
        />
      </Card>
      <FieldModal
        open={open}
        editing={editing}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
      />
    </>
  );
}

function DeleteFieldButton({ field }: { field: Field }) {
  const { update } = useConfig();
  return (
    <Button
      variant="icon"
      aria-label="Delete"
      onClick={() => {
        if (!confirm(`Delete field "${field.label}"?`)) return;
        update((prev) => ({ ...prev, fields: prev.fields.filter((f) => f.id !== field.id) }));
      }}
    >
      <Icon name="trash" />
    </Button>
  );
}
