import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, Icon, PageHeader } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { RnHierarchyNode } from '@/types/config';

export function HierarchyDetailPanel() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { config } = useConfig();
  const h = config.rnHierarchies.find((x) => String(x.id) === id);

  if (!h)
    return (
      <EmptyState
        title="Hierarchy not found"
        action={<Button variant="neutral" onClick={() => navigate('/reconciliation')}>Back</Button>}
      />
    );

  return (
    <>
      <Button variant="link" iconLeading={<Icon name="arrow-left" size={14} />} onClick={() => navigate(-1)}>
        Back
      </Button>
      <div style={{ height: 12 }} />
      <PageHeader
        eyebrow={`Hierarchy · ${h.lob}`}
        title={h.name}
        icon={<Icon name="layers" size={20} />}
        actions={<Badge tone="brand">{h.lob}</Badge>}
      />
      <Card title="Tree" padding="md">
        {h.nodes.length === 0 ? (
          <EmptyState title="No nodes" description="Add entities and coverages to build the hierarchy." />
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {h.nodes.map((n) => (
              <NodeView key={n.id} node={n} depth={0} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function NodeView({ node, depth }: { node: RnHierarchyNode; depth: number }) {
  const { config } = useConfig();
  const ref =
    node.kind === 'entity'
      ? config.rnEntities.find((e) => e.id === node.refId)
      : config.rnCoverages.find((c) => c.id === node.refId);
  return (
    <li>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 0',
          paddingLeft: depth * 20,
        }}
      >
        <Icon name={node.kind === 'entity' ? 'database' : 'shield'} size={14} />
        <span style={{ fontWeight: 500 }}>{node.label}</span>
        <Badge tone={node.kind === 'entity' ? 'brand' : 'success'}>{node.kind}</Badge>
        {ref && <span style={{ fontSize: 12, color: 'var(--slds-g-color-on-surface-2)' }}>· {ref.name}</span>}
      </div>
      {node.children.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {node.children.map((c) => (
            <NodeView key={c.id} node={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
