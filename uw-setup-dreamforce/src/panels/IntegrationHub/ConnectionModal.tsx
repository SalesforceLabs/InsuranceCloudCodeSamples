import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select, Textarea } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { Connection } from '@/types/config';

const AUTH_TYPES = ['OAuth 2.0', 'API Key', 'Basic Auth', 'JWT', 'None'];
const STATUSES = ['Connected', 'Disconnected', 'Needs Attention'];

interface Props {
  open: boolean;
  editing: Connection | null;
  onClose: () => void;
}

export function ConnectionModal({ open, editing, onClose }: Props) {
  const { update } = useConfig();
  const [name, setName] = useState('');
  const [authType, setAuthType] = useState('API Key');
  const [baseUrl, setBaseUrl] = useState('');
  const [status, setStatus] = useState('Disconnected');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setAuthType(editing.authType);
      setBaseUrl(editing.baseUrl);
      setStatus(editing.status);
      setDescription(editing.description ?? '');
    } else {
      setName('');
      setAuthType('API Key');
      setBaseUrl('');
      setStatus('Disconnected');
      setDescription('');
    }
  }, [open, editing]);

  const onSave = () => {
    if (!name.trim()) return;
    update((p) => {
      const isNew = !editing || editing.id === 0;
      if (!isNew && editing) {
        return {
          ...p,
          connections: p.connections.map((c) =>
            c.id === editing.id
              ? { ...c, name: name.trim(), authType, baseUrl: baseUrl.trim(), status, description: description.trim() }
              : c,
          ),
        };
      }
      const next: Connection = {
        id: p.nextConnectionId,
        name: name.trim(),
        authType,
        baseUrl: baseUrl.trim(),
        status,
        description: description.trim(),
        providerId: editing?.providerId,
      };
      return {
        ...p,
        connections: [...p.connections, next],
        nextConnectionId: p.nextConnectionId + 1,
      };
    });
    onClose();
  };

  const isEdit = editing && editing.id !== 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Connection' : 'Add Connection'}
      size="md"
      footer={
        <>
          <Button variant="neutral" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="brand" onClick={onSave} disabled={!name.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Select
            label="Auth Type"
            value={authType}
            onChange={(e) => setAuthType(e.target.value)}
            options={AUTH_TYPES.map((a) => ({ value: a, label: a }))}
          />
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={STATUSES.map((s) => ({ value: s, label: s }))}
          />
        </div>
        <Input label="Base URL" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com" />
        <Textarea label="Description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
    </Modal>
  );
}
