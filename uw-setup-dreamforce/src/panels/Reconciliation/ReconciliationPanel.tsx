import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  Icon,
  Input,
  Modal,
  PageHeader,
  Select,
  Table,
  Tabs,
  type Column,
} from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { RnCoverage, RnEntity, RnHierarchy } from '@/types/config';

type Tab = 'entities' | 'coverages' | 'hierarchies';

export function ReconciliationPanel() {
  const [tab, setTab] = useState<Tab>('entities');
  return (
    <>
      <PageHeader
        title="Reconciliation And Normalization"
        icon={<Icon name="layers" size={20} />}
        subtitle="Define base entities, coverage templates, and hierarchies to drive reconciliation."
      />
      <Tabs
        items={[
          { id: 'entities', label: 'Entities' },
          { id: 'coverages', label: 'Coverages' },
          { id: 'hierarchies', label: 'Hierarchies' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as Tab)}
      />
      <div style={{ marginTop: 16 }}>
        {tab === 'entities' && <EntitiesTab />}
        {tab === 'coverages' && <CoveragesTab />}
        {tab === 'hierarchies' && <HierarchiesTab />}
      </div>
    </>
  );
}

function EntitiesTab() {
  const { config, update } = useConfig();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const cols: Column<RnEntity>[] = [
    { key: 'name', header: 'Entity Name', render: (e) => <span style={{ fontWeight: 500 }}>{e.name}</span> },
    {
      key: 'attrs',
      header: 'Attributes',
      render: (e) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {e.attributes.slice(0, 6).map((a) => (
            <Badge key={a.id}>{a.name}</Badge>
          ))}
          {e.attributes.length > 6 && (
            <Badge tone="neutral">+{e.attributes.length - 6} more</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'count',
      header: '#',
      width: '80px',
      render: (e) => e.attributes.length,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '90px',
      render: (e) => (
        <Button
          variant="icon"
          aria-label="Delete"
          onClick={() => {
            if (!confirm(`Delete entity "${e.name}"?`)) return;
            update((p) => ({ ...p, rnEntities: p.rnEntities.filter((x) => x.id !== e.id) }));
          }}
        >
          <Icon name="trash" />
        </Button>
      ),
    },
  ];

  return (
    <>
      <Card
        title="Entities"
        subtitle={`${config.rnEntities.length} defined`}
        actions={
          <Button variant="brand" iconLeading={<Icon name="plus" size={14} />} onClick={() => setOpen(true)}>
            New Entity
          </Button>
        }
        padding="none"
      >
        <Table<RnEntity> columns={cols} rows={config.rnEntities} rowKey={(e) => e.id} empty="No entities yet." />
      </Card>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New Entity"
        footer={
          <>
            <Button variant="neutral" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              disabled={!name.trim()}
              onClick={() => {
                update((p) => ({
                  ...p,
                  rnEntities: [...p.rnEntities, { id: p.nextRnEntityId, name: name.trim(), attributes: [] }],
                  nextRnEntityId: p.nextRnEntityId + 1,
                }));
                setName('');
                setOpen(false);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <Input label="Entity Name" required value={name} onChange={(e) => setName(e.target.value)} />
      </Modal>
    </>
  );
}

function CoveragesTab() {
  const { config, update } = useConfig();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [baseEntityId, setBaseEntityId] = useState('');

  const cols: Column<RnCoverage>[] = [
    { key: 'name', header: 'Coverage Name', render: (c) => <span style={{ fontWeight: 500 }}>{c.name}</span> },
    {
      key: 'base',
      header: 'Base Entity',
      render: (c) => config.rnEntities.find((e) => e.id === c.baseEntityId)?.name ?? '—',
    },
    {
      key: 'values',
      header: 'Defaulted Values',
      render: (c) => `${Object.keys(c.values).length}`,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '90px',
      render: (c) => (
        <Button
          variant="icon"
          aria-label="Delete"
          onClick={() => {
            if (!confirm(`Delete coverage "${c.name}"?`)) return;
            update((p) => ({ ...p, rnCoverages: p.rnCoverages.filter((x) => x.id !== c.id) }));
          }}
        >
          <Icon name="trash" />
        </Button>
      ),
    },
  ];

  return (
    <>
      <Card
        title="Coverages"
        subtitle={`${config.rnCoverages.length} defined`}
        actions={
          <Button variant="brand" iconLeading={<Icon name="plus" size={14} />} onClick={() => setOpen(true)}>
            New Coverage
          </Button>
        }
        padding="none"
      >
        <Table<RnCoverage> columns={cols} rows={config.rnCoverages} rowKey={(c) => c.id} empty="No coverages yet." />
      </Card>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New Coverage"
        footer={
          <>
            <Button variant="neutral" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              disabled={!name.trim() || !baseEntityId}
              onClick={() => {
                update((p) => ({
                  ...p,
                  rnCoverages: [
                    ...p.rnCoverages,
                    { id: p.nextRnCoverageId, name: name.trim(), baseEntityId: Number(baseEntityId), values: {} },
                  ],
                  nextRnCoverageId: p.nextRnCoverageId + 1,
                }));
                setName('');
                setBaseEntityId('');
                setOpen(false);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input label="Coverage Name" required value={name} onChange={(e) => setName(e.target.value)} />
          <Select label="Base Entity" required value={baseEntityId} onChange={(e) => setBaseEntityId(e.target.value)}>
            <option value="">— Select —</option>
            {config.rnEntities.map((ent) => (
              <option key={ent.id} value={ent.id}>
                {ent.name}
              </option>
            ))}
          </Select>
        </div>
      </Modal>
    </>
  );
}

function HierarchiesTab() {
  const { config, update } = useConfig();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [lob, setLob] = useState('Property');

  const cols: Column<RnHierarchy>[] = [
    {
      key: 'name',
      header: 'Hierarchy Name',
      render: (h) => (
        <a
          href={`/reconciliation/hierarchy/${h.id}`}
          onClick={(e) => {
            e.preventDefault();
            navigate(`/reconciliation/hierarchy/${h.id}`);
          }}
        >
          {h.name}
        </a>
      ),
    },
    { key: 'lob', header: 'Line of Business', render: (h) => <Badge tone="brand">{h.lob}</Badge> },
    { key: 'nodes', header: 'Nodes', render: (h) => countNodes(h.nodes) },
    {
      key: 'actions',
      header: 'Actions',
      width: '90px',
      render: (h) => (
        <Button
          variant="icon"
          aria-label="Delete"
          onClick={() => {
            if (!confirm(`Delete hierarchy "${h.name}"?`)) return;
            update((p) => ({ ...p, rnHierarchies: p.rnHierarchies.filter((x) => x.id !== h.id) }));
          }}
        >
          <Icon name="trash" />
        </Button>
      ),
    },
  ];

  const lobOptions =
    config.fields.find((f) => f.api === 'Line_of_Business__c')?.picklistValues ?? ['Property', 'General Liability', 'Cyber'];

  return (
    <>
      <Card
        title="Hierarchies"
        subtitle={`${config.rnHierarchies.length} defined`}
        actions={
          <Button variant="brand" iconLeading={<Icon name="plus" size={14} />} onClick={() => setOpen(true)}>
            New Hierarchy
          </Button>
        }
        padding="none"
      >
        <Table<RnHierarchy>
          columns={cols}
          rows={config.rnHierarchies}
          rowKey={(h) => h.id}
          empty="No hierarchies yet."
        />
      </Card>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New Hierarchy"
        footer={
          <>
            <Button variant="neutral" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              disabled={!name.trim()}
              onClick={() => {
                update((p) => ({
                  ...p,
                  rnHierarchies: [
                    ...p.rnHierarchies,
                    { id: p.nextRnHierarchyId, name: name.trim(), lob, nodes: [] },
                  ],
                  nextRnHierarchyId: p.nextRnHierarchyId + 1,
                }));
                setName('');
                setOpen(false);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
          <Select
            label="Line of Business"
            value={lob}
            onChange={(e) => setLob(e.target.value)}
            options={lobOptions.map((v) => ({ value: v, label: v }))}
          />
        </div>
      </Modal>
    </>
  );
}

function countNodes(nodes: RnHierarchy['nodes']): number {
  let n = 0;
  for (const node of nodes) {
    n += 1 + countNodes(node.children);
  }
  return n;
}
