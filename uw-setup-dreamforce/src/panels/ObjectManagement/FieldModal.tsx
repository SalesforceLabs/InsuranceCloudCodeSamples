import { useEffect, useState } from 'react';
import {
  Button,
  Checkbox,
  Icon,
  Input,
  Modal,
  Select,
  Textarea,
} from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { Field, FieldType } from '@/types/config';

const TYPES: FieldType[] = [
  'Text',
  'Number',
  'Currency',
  'Date',
  'Date/Time',
  'Boolean',
  'Picklist',
  'Multi-Select Picklist',
  'Percent',
  'Phone',
  'Email',
  'URL',
  'Long Text Area',
];

interface Props {
  open: boolean;
  editing: Field | null;
  onClose: () => void;
}

export function FieldModal({ open, editing, onClose }: Props) {
  const { update } = useConfig();
  const [label, setLabel] = useState('');
  const [api, setApi] = useState('');
  const [apiDirty, setApiDirty] = useState(false);
  const [type, setType] = useState<FieldType>('Text');
  const [required, setRequired] = useState(false);
  const [description, setDescription] = useState('');
  const [picklistValues, setPicklistValues] = useState<string[]>([]);
  const [picklistInput, setPicklistInput] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setLabel(editing.label);
      setApi(editing.api);
      setApiDirty(true);
      setType(editing.type);
      setRequired(editing.required);
      setDescription(editing.description);
      setPicklistValues(editing.picklistValues || []);
    } else {
      setLabel('');
      setApi('');
      setApiDirty(false);
      setType('Text');
      setRequired(false);
      setDescription('');
      setPicklistValues([]);
    }
    setPicklistInput('');
  }, [open, editing]);

  const onLabelChange = (v: string) => {
    setLabel(v);
    if (!apiDirty) {
      setApi(toApiName(v));
    }
  };

  const onSave = () => {
    if (!label.trim() || !api.trim()) return;
    update((prev) => {
      if (editing) {
        return {
          ...prev,
          fields: prev.fields.map((f) =>
            f.id === editing.id
              ? {
                  ...f,
                  label: label.trim(),
                  api: api.trim(),
                  type,
                  required,
                  description: description.trim(),
                  picklistValues: needsPicklist(type) ? picklistValues : [],
                }
              : f,
          ),
        };
      }
      const newField: Field = {
        id: prev.nextFieldId,
        label: label.trim(),
        api: api.trim(),
        type,
        required,
        description: description.trim(),
        picklistValues: needsPicklist(type) ? picklistValues : [],
      };
      return {
        ...prev,
        fields: [...prev.fields, newField],
        nextFieldId: prev.nextFieldId + 1,
      };
    });
    onClose();
  };

  const addPicklistValue = () => {
    const v = picklistInput.trim();
    if (!v) return;
    if (picklistValues.includes(v)) return;
    setPicklistValues([...picklistValues, v]);
    setPicklistInput('');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Field' : 'New Field'}
      size="md"
      footer={
        <>
          <Button variant="neutral" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="brand" onClick={onSave} disabled={!label.trim() || !api.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input
            label="Field Label"
            required
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder="e.g. Premium Amount"
          />
          <Input
            label="API Name"
            required
            value={api}
            onChange={(e) => {
              setApi(e.target.value);
              setApiDirty(true);
            }}
            placeholder="e.g. Premium_Amount__c"
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 16, alignItems: 'end' }}>
          <Select
            label="Data Type"
            required
            value={type}
            onChange={(e) => setType(e.target.value as FieldType)}
            options={TYPES.map((t) => ({ value: t, label: t }))}
          />
          <Checkbox checked={required} onChange={(e) => setRequired(e.target.checked)} label="Required" />
        </div>
        <Textarea
          label="Description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this field"
        />
        {needsPicklist(type) && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Picklist Values</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <Input
                placeholder="Add a value…"
                value={picklistInput}
                onChange={(e) => setPicklistInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addPicklistValue();
                  }
                }}
                fullWidth
              />
              <Button variant="neutral" onClick={addPicklistValue}>
                Add
              </Button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {picklistValues.length === 0 && (
                <span style={{ fontSize: 12, color: 'var(--slds-g-color-on-surface-2)' }}>
                  No values yet.
                </span>
              )}
              {picklistValues.map((v) => (
                <span
                  key={v}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'var(--slds-g-color-palette-neutral-95)',
                    borderRadius: 'var(--slds-g-radius-border-2)',
                    padding: '2px 6px 2px 8px',
                    fontSize: 12,
                  }}
                >
                  {v}
                  <button
                    type="button"
                    onClick={() => setPicklistValues(picklistValues.filter((x) => x !== v))}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--slds-g-color-on-surface-2)',
                      padding: 2,
                      display: 'inline-flex',
                    }}
                    aria-label={`Remove ${v}`}
                  >
                    <Icon name="close" size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function needsPicklist(t: FieldType): boolean {
  return t === 'Picklist' || t === 'Multi-Select Picklist';
}

function toApiName(label: string): string {
  const cleaned = label
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!cleaned) return '';
  const camel = cleaned
    .split('_')
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join('_');
  return `${camel}__c`;
}

