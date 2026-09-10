import { useEffect, useState } from 'react';
import { Button, Checkbox, Input, Modal, Select } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { StageConfig } from '@/types/config';

interface Props {
  open: boolean;
  editing: StageConfig | null;
  onClose: () => void;
}

export function ScModal({ open, editing, onClose }: Props) {
  const { config, update } = useConfig();

  const lobOptions = config.fields.find((f) => f.api === 'Line_of_Business__c')?.picklistValues ?? [];

  const [name, setName] = useState('');
  const [recordType, setRecordType] = useState('');
  const [active, setActive] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setRecordType(editing.recordType);
      setActive(editing.active);
      setFrom(editing.effectiveFrom);
      setTo(editing.effectiveTo);
    } else {
      setName('');
      setRecordType(lobOptions[0] ?? '');
      setActive(true);
      setFrom(new Date().toISOString().slice(0, 10));
      setTo('');
    }
  }, [open, editing, lobOptions]);

  const onSave = () => {
    if (!name.trim()) return;
    update((p) => {
      if (editing) {
        // Preserve picklist and stages on edit; the form no longer manages them.
        return {
          ...p,
          stageConfigs: p.stageConfigs.map((a) =>
            a.id === editing.id
              ? {
                  ...a,
                  name: name.trim(),
                  recordType,
                  active,
                  effectiveFrom: from,
                  effectiveTo: to,
                }
              : a,
          ),
        };
      }
      // New configurations start with the default Stages picklist and an empty
      // stage list. Stages are added later from the LOB detail page.
      const next: StageConfig = {
        id: p.nextStageConfigId,
        name: name.trim(),
        object: 'Submission',
        recordType,
        picklist: 'Stages',
        stages: [],
        active,
        effectiveFrom: from,
        effectiveTo: to,
      };
      return {
        ...p,
        stageConfigs: [...p.stageConfigs, next],
        nextStageConfigId: p.nextStageConfigId + 1,
      };
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit LOB Activity Configuration' : 'New LOB Activity Configuration'}
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
        <Input
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Commercial Property V1"
          fullWidth
        />
        <Select
          label="Line of Business"
          required
          value={recordType}
          onChange={(e) => setRecordType(e.target.value)}
        >
          {lobOptions.length === 0 && <option value="">No LOBs configured</option>}
          {lobOptions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input
            label="Start Date"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            label="End Date"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <Checkbox label="Active" checked={active} onChange={(e) => setActive(e.target.checked)} />
      </div>
    </Modal>
  );
}
