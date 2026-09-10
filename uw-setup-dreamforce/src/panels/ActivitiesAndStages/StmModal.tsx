import { useEffect, useState } from 'react';
import { Button, Checkbox, Input, Modal } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { ActivityConfig } from '@/types/config';

interface Props {
  open: boolean;
  editing: ActivityConfig | null;
  onClose: () => void;
}

export function StmModal({ open, editing, onClose }: Props) {
  const { update } = useConfig();
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setActive(editing.active);
      setFrom(editing.effectiveFrom);
      setTo(editing.effectiveTo);
    } else {
      setName('');
      setActive(true);
      setFrom(new Date().toISOString().slice(0, 10));
      setTo('');
    }
  }, [open, editing]);

  const onSave = () => {
    if (!name.trim()) return;
    update((p) => {
      if (editing) {
        return {
          ...p,
          activityConfigs: p.activityConfigs.map((a) =>
            a.id === editing.id
              ? { ...a, name: name.trim(), active, effectiveFrom: from, effectiveTo: to }
              : a,
          ),
        };
      }
      const next: ActivityConfig = {
        id: p.nextActivityConfigId,
        name: name.trim(),
        active,
        effectiveFrom: from,
        effectiveTo: to,
      };
      return {
        ...p,
        activityConfigs: [...p.activityConfigs, next],
        nextActivityConfigId: p.nextActivityConfigId + 1,
      };
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Submission Activity Configuration' : 'New Submission Activity Configuration'}
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
          <Input label="Effective From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="Effective To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Checkbox label="Active" checked={active} onChange={(e) => setActive(e.target.checked)} />
      </div>
    </Modal>
  );
}
