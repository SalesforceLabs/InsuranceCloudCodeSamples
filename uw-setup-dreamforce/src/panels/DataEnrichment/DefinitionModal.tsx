import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Modal, Select } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { EnrichmentDefinition } from '@/types/config';

interface Props {
  open: boolean;
  editingId: number | null;
  onClose: () => void;
}

export function DefinitionModal({ open, editingId, onClose }: Props) {
  const { config, update } = useConfig();
  const [name, setName] = useState('');
  const [lob, setLob] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [ipName, setIpName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const lobs = useMemo(
    () => config.enrichmentConfigs.map((c) => c.lob).filter(Boolean),
    [config.enrichmentConfigs],
  );

  const categories = useMemo(() => {
    const cfg = config.enrichmentConfigs.find((c) => c.lob === lob);
    return cfg?.categories ?? [];
  }, [config.enrichmentConfigs, lob]);

  const ips = useMemo(() => {
    return config.integrationProcedures.filter(
      (p) => !p.lob || p.lob === 'All' || p.lob === lob,
    );
  }, [config.integrationProcedures, lob]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editingId != null) {
      const d = config.enrichmentDefinitions.find((x) => x.id === editingId);
      if (d) {
        setName(d.name);
        setLob(d.lob);
        setCategoryId(d.categoryId);
        setIpName(d.integrationProcedureName);
        return;
      }
    }
    // New definition — pick sensible defaults
    const firstLob = config.enrichmentConfigs[0]?.lob ?? '';
    setName('');
    setLob(firstLob);
    const firstCat = config.enrichmentConfigs.find((c) => c.lob === firstLob)?.categories[0];
    setCategoryId(firstCat?.id ?? '');
    const firstIp = config.integrationProcedures.find(
      (p) => !p.lob || p.lob === 'All' || p.lob === firstLob,
    );
    setIpName(firstIp?.name ?? '');
  }, [open, editingId, config]);

  const onLobChange = (next: string) => {
    setLob(next);
    const cats = config.enrichmentConfigs.find((c) => c.lob === next)?.categories ?? [];
    setCategoryId(cats[0]?.id ?? '');
    const eligibleIps = config.integrationProcedures.filter(
      (p) => !p.lob || p.lob === 'All' || p.lob === next,
    );
    setIpName(eligibleIps[0]?.name ?? '');
  };

  const onSave = () => {
    const errs: string[] = [];
    if (!name.trim()) errs.push('Name is required.');
    if (!lob) errs.push('Line of Business is required.');
    if (!categoryId) errs.push('Category is required.');
    if (!ipName) errs.push('Integration Procedure is required.');
    if (errs.length > 0) {
      setError(errs.join(' '));
      return;
    }
    const cat = categories.find((c) => c.id === categoryId);
    const lastModified = new Date().toISOString();
    update((prev) => {
      if (editingId != null) {
        return {
          ...prev,
          enrichmentDefinitions: prev.enrichmentDefinitions.map((d) =>
            d.id === editingId
              ? {
                  ...d,
                  name: name.trim(),
                  lob,
                  categoryId,
                  categoryName: cat?.name ?? '',
                  integrationProcedureName: ipName,
                  lastModified,
                }
              : d,
          ),
        };
      }
      const next: EnrichmentDefinition = {
        id: prev.nextEnrichmentDefinitionId,
        name: name.trim(),
        lob,
        categoryId,
        categoryName: cat?.name ?? '',
        integrationProcedureName: ipName,
        active: true,
        lastModified,
      };
      return {
        ...prev,
        enrichmentDefinitions: [...prev.enrichmentDefinitions, next],
        nextEnrichmentDefinitionId: prev.nextEnrichmentDefinitionId + 1,
      };
    });
    onClose();
  };

  const isEdit = editingId != null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Enrichment Definition' : 'New Enrichment Definition'}
      size="md"
      footer={
        <>
          <Button variant="neutral" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="brand" onClick={onSave}>
            {isEdit ? 'Save' : 'Create'}
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
          placeholder="e.g. Property Characteristics — Verisk 360"
          fullWidth
        />
        <Select
          label="Line of Business"
          required
          value={lob}
          onChange={(e) => onLobChange(e.target.value)}
        >
          {lobs.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </Select>
        {categories.length === 0 ? (
          <Select label="Category" required disabled value="">
            <option>No categories defined for this LOB</option>
          </Select>
        ) : (
          <Select
            label="Category"
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
        {ips.length === 0 ? (
          <Select label="Integration Procedure" required disabled value="">
            <option>No integration procedures available for this LOB</option>
          </Select>
        ) : (
          <Select
            label="Integration Procedure"
            required
            value={ipName}
            onChange={(e) => setIpName(e.target.value)}
          >
            {ips.map((p) => (
              <option key={p.id} value={p.name}>
                {p.procName} · {p.versionLabel}
              </option>
            ))}
          </Select>
        )}
        {error && (
          <div
            style={{
              padding: '8px 12px',
              background: 'var(--slds-g-color-error-container-1)',
              color: 'var(--slds-g-color-on-error-container-1, var(--slds-g-color-error-1))',
              borderRadius: 6,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
