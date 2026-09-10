import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Icon, Input } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { ConnectionInstance } from '@/types/config';
import { PROVIDERS, findServiceById } from '@/panels/IntegrationHub/providers';
import { ConnectionWizardModal } from './ConnectWizardModal';
import '@/panels/ActivitiesAndStages/ActivitiesEntityEditor.css';
import '@/panels/LinesOfBusiness/LobActivitiesSection.css';
import '@/panels/LinesOfBusiness/LobStageManagementSection.css';
import './Connections.css';

/**
 * Integrations → Connections.
 *
 * Live connections (instances of connection templates) that have been
 * configured via the Connect wizard. Compact-tile cards with status
 * badge + chevron actions.
 */
export function ConnectionsSection() {
  const { config, update } = useConfig();
  const navigate = useNavigate();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<ConnectionInstance | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  const instances = useMemo(
    () => (config.connectionInstances ?? []).slice().sort((a, b) => b.id - a.id),
    [config.connectionInstances],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return instances;
    return instances.filter((c) => c.name.toLowerCase().includes(q));
  }, [instances, query]);

  const onDisconnect = (c: ConnectionInstance) => {
    if (c.status === 'Disconnected') return;
    update((p) => ({
      ...p,
      connectionInstances: (p.connectionInstances ?? []).map((x) =>
        x.id === c.id ? { ...x, status: 'Disconnected' } : x,
      ),
    }));
    setOpenMenuId(null);
  };

  const onReconnect = (c: ConnectionInstance) => {
    if (c.status !== 'Disconnected') return;
    update((p) => ({
      ...p,
      connectionInstances: (p.connectionInstances ?? []).map((x) =>
        x.id === c.id ? { ...x, status: 'Connected' } : x,
      ),
    }));
    setOpenMenuId(null);
  };

  const onDelete = (c: ConnectionInstance) => {
    if (!confirm(`Delete connection "${c.name}"?`)) return;
    update((p) => ({
      ...p,
      connectionInstances: (p.connectionInstances ?? []).filter((x) => x.id !== c.id),
    }));
    setOpenMenuId(null);
  };

  return (
    <div className="cn-section">
      <div className="lob-activities__toolbar">
        <Input
          placeholder="Search by name"
          iconLeading={<Icon name="search" size={14} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search connections by name"
          className="lob-activities__search"
        />
        <button
          type="button"
          className="lob-activities__new-btn"
          onClick={() => setWizardOpen(true)}
        >
          <Icon name="plus" size={14} />
          New Connection
        </button>
      </div>

      <div className="lob-activities__list">
        {instances.length === 0 ? (
          <div className="lob-activities__empty">
            <p style={{ margin: 0 }}>
              No connections configured yet. Click New Connection to create one.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <div className="lob-activities__empty">
            No connections match "{query}".
          </div>
        ) : (
          visible.map((c) => (
            <ConnectionTile
              key={c.id}
              instance={c}
              menuOpen={openMenuId === c.id}
              onMenuToggle={(next) =>
                setOpenMenuId(next ? c.id : openMenuId === c.id ? null : openMenuId)
              }
              onOpen={() => navigate(`/general-setup/connection/${c.id}`)}
              onEdit={() => {
                setEditing(c);
                setOpenMenuId(null);
              }}
              onDisconnect={() => onDisconnect(c)}
              onReconnect={() => onReconnect(c)}
              onDelete={() => onDelete(c)}
            />
          ))
        )}
      </div>

      <ConnectionWizardModal
        open={wizardOpen}
        withAuthPicker
        onClose={() => setWizardOpen(false)}
      />
      <ConnectionWizardModal
        open={editing != null}
        existingConnection={editing ?? undefined}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

interface TileProps {
  instance: ConnectionInstance;
  menuOpen: boolean;
  onMenuToggle: (next: boolean) => void;
  onOpen: () => void;
  onEdit: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
  onDelete: () => void;
}

function ConnectionTile({
  instance,
  menuOpen,
  onMenuToggle,
  onOpen,
  onEdit,
  onDisconnect,
  onReconnect,
  onDelete,
}: TileProps) {
  const resolved = findServiceById(instance.serviceId);
  const service = resolved?.service;
  const isDcc = service?.type === 'Data Cloud Connector';
  const selectedEndpointId =
    instance.enabledEndpointIds?.[0] ?? service?.endpoints[0]?.id;
  const endpointName = service?.endpoints.find(
    (e) => e.id === selectedEndpointId,
  )?.name;
  const categories = instance.categories ?? [];
  const subline = [
    resolved?.provider.name,
    service?.name,
    isDcc
      ? instance.dataspace
        ? `Dataspace: ${instance.dataspace}`
        : null
      : endpointName ?? null,
    instance.usageType ? `Usage: ${instance.usageType}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div
      className="act-tile act-tile--compact lob-stage-tile cn-tile"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="act-tile__actions">
        <div className="lob-stage-tile__actions">
          <Badge tone="brand" outline>
            {service?.type ?? 'P2P'}
          </Badge>
          <div className="cn-tile__status-stack">
            <StatusBadge status={instance.status} />
          </div>
          <TileMenu
            open={menuOpen}
            connected={instance.status !== 'Disconnected'}
            onToggle={onMenuToggle}
            onEdit={onEdit}
            onDisconnect={onDisconnect}
            onReconnect={onReconnect}
            onDelete={onDelete}
          />
        </div>
      </div>
      <div className="cn-tile__head">
        <ProviderTag providerId={instance.providerId} />
        <span className="cn-tile__name">{instance.name}</span>
      </div>
      <div className="lob-stage-tile__sub">{subline}</div>
      {categories.length > 0 && (
        <div className="cn-tile__cats">
          {categories.map((c) => (
            <Badge key={c}>{c}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

interface TileMenuProps {
  open: boolean;
  connected: boolean;
  onToggle: (next: boolean) => void;
  onEdit: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
  onDelete: () => void;
}
function TileMenu({
  open,
  connected,
  onToggle,
  onEdit,
  onDisconnect,
  onReconnect,
  onDelete,
}: TileMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDocClick = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) onToggle(false);
    };
    const onKey = (ev: globalThis.KeyboardEvent) => {
      if (ev.key === 'Escape') onToggle(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onToggle]);
  return (
    <div className="lob-tile-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="lob-tile-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Connection actions"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(!open);
        }}
      >
        <Icon name="chevron-down" size={14} />
      </button>
      {open && (
        <div className="lob-tile-menu__panel" role="menu">
          <button
            type="button"
            role="menuitem"
            className="lob-tile-menu__item"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Icon name="edit" size={14} />
            Edit
          </button>
          {connected ? (
            <button
              type="button"
              role="menuitem"
              className="lob-tile-menu__item"
              onClick={(e) => {
                e.stopPropagation();
                onDisconnect();
              }}
            >
              <Icon name="close" size={14} />
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="lob-tile-menu__item"
              onClick={(e) => {
                e.stopPropagation();
                onReconnect();
              }}
            >
              <Icon name="refresh" size={14} />
              Reconnect
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="lob-tile-menu__item lob-tile-menu__item--destructive"
            onClick={onDelete}
          >
            <Icon name="trash" size={14} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'Connected') return <Badge tone="success">Connected</Badge>;
  if (status === 'Needs Attention') return <Badge tone="warning">Needs Attention</Badge>;
  return <Badge>Disconnected</Badge>;
}

function ProviderTag({ providerId }: { providerId?: string }) {
  const provider = PROVIDERS.find((p) => p.id === providerId);
  if (!provider) return null;
  return (
    <span className="cn-provider-tag" aria-hidden="true" title={provider.name}>
      {provider.logo}
    </span>
  );
}
