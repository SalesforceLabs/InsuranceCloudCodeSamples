import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Checkbox, EmptyState, Icon, Input, PageHeader, Select } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { AssignmentRuleEntry } from '@/types/config';

const OPERATORS = ['equals', 'not equal to', 'contains', 'starts with', 'greater than', 'less than'];

interface CriteriaRow {
  field: string;
  operator: string;
  value: string;
}

const EMPTY: CriteriaRow = { field: '', operator: '', value: '' };

export function RuleEntryFormPanel() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { config, update } = useConfig();
  const rule = config.assignmentRules.find((r) => String(r.id) === id);

  const [sortOrder, setSortOrder] = useState(1);
  const [rows, setRows] = useState<CriteriaRow[]>([EMPTY]);
  const [user, setUser] = useState('');
  const [noReassign, setNoReassign] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState('');

  if (!rule)
    return (
      <EmptyState
        title="Rule not found"
        action={<Button variant="neutral" onClick={() => navigate('/submission-assignment')}>Back</Button>}
      />
    );

  const fieldOptions = config.fields.map((f) => ({ value: f.api, label: f.label }));

  const onSave = () => {
    const criteria = rows.filter((r) => r.field && r.operator);
    update((p) => ({
      ...p,
      assignmentRules: p.assignmentRules.map((r) =>
        r.id === rule.id
          ? {
              ...r,
              entries: [
                ...(r.entries ?? []),
                {
                  id: Math.max(0, ...(r.entries ?? []).map((e) => e.id)) + 1,
                  sortOrder,
                  criteria,
                  user: user.trim(),
                  noReassign,
                  emailTemplate: emailTemplate.trim(),
                  predefinedTeams: [],
                } as AssignmentRuleEntry,
              ],
            }
          : r,
      ),
    }));
    navigate(`/submission-assignment/${rule.id}`);
  };

  return (
    <>
      <Button
        variant="link"
        iconLeading={<Icon name="arrow-left" size={14} />}
        onClick={() => navigate(-1)}
      >
        Back
      </Button>
      <div style={{ height: 12 }} />
      <PageHeader eyebrow="Submission Assignment Rules" title={rule.name} icon={<Icon name="users" size={20} />} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card title="Step 1 · Sort Order" padding="md">
          <Input
            label="Sort Order"
            type="number"
            min={1}
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value) || 1)}
            style={{ maxWidth: 200 }}
          />
        </Card>

        <Card title="Step 2 · Criteria" padding="md">
          <div style={{ fontSize: 12, color: 'var(--slds-g-color-on-surface-2)', marginBottom: 12 }}>
            Run this rule IF the criteria are met (joined by AND).
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((row, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 180px 1fr 32px', gap: 8, alignItems: 'end' }}>
                <Select
                  value={row.field}
                  onChange={(e) => updateRow(setRows, i, { ...row, field: e.target.value })}
                >
                  <option value="">— Field —</option>
                  {fieldOptions.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
                <Select
                  value={row.operator}
                  onChange={(e) => updateRow(setRows, i, { ...row, operator: e.target.value })}
                >
                  <option value="">— Operator —</option>
                  {OPERATORS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </Select>
                <Input value={row.value} onChange={(e) => updateRow(setRows, i, { ...row, value: e.target.value })} placeholder="Value" />
                <Button
                  variant="icon"
                  aria-label="Remove row"
                  onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs))}
                >
                  <Icon name="close" />
                </Button>
              </div>
            ))}
            <Button
              variant="link"
              iconLeading={<Icon name="plus" size={14} />}
              onClick={() => setRows((rs) => [...rs, EMPTY])}
            >
              Add Criterion
            </Button>
          </div>
        </Card>

        <Card title="Step 3 · Assignment" padding="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input label="User or Queue" value={user} onChange={(e) => setUser(e.target.value)} />
            <Checkbox label="Do Not Reassign Owner" checked={noReassign} onChange={(e) => setNoReassign(e.target.checked)} />
            <Input label="Email Template" value={emailTemplate} onChange={(e) => setEmailTemplate(e.target.value)} />
          </div>
        </Card>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="brand" onClick={onSave}>
            Save
          </Button>
          <Button variant="neutral" onClick={() => navigate(`/submission-assignment/${rule.id}`)}>
            Cancel
          </Button>
        </div>
      </div>
    </>
  );
}

function updateRow(setter: React.Dispatch<React.SetStateAction<CriteriaRow[]>>, i: number, next: CriteriaRow) {
  setter((rs) => rs.map((r, idx) => (idx === i ? next : r)));
}
