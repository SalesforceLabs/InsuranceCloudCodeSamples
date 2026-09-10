import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Checkbox, Icon, Input, PageHeader, Select, Textarea } from '@/components/ui';

export function RoutingFormPanel() {
  const navigate = useNavigate();
  const [name, setName] = useState('RoutingOne');
  const [email, setEmail] = useState('');

  return (
    <>
      <Button
        variant="link"
        iconLeading={<Icon name="arrow-left" size={14} />}
        onClick={() => navigate('/email-to-submission')}
      >
        Back to Email-to-Submission
      </Button>
      <div style={{ height: 12 }} />
      <PageHeader eyebrow="Setup" title="Email Routing Address" icon={<Icon name="mail" size={20} />} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card title="Routing Information" padding="md">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              label="Routing Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              hint="Must be associated with an Email Service Address."
            />
          </div>
        </Card>

        <Card title="Email Settings" padding="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Checkbox label="Save Email Headers" defaultChecked />
            <Textarea label="Accept Email From" rows={3} placeholder="Comma-separated allowlist (optional)" />
          </div>
        </Card>

        <Card title="Submission Settings" padding="md">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Select label="Submission Owner" options={[{ value: 'user', label: 'User' }, { value: 'queue', label: 'Queue' }]} />
            <Input label="Owner Lookup" placeholder="Search…" />
            <Select label="Submission Priority" options={['--None--', 'Low', 'Medium', 'High', 'Urgent'].map((v) => ({ value: v, label: v }))} />
            <Select label="Submission Origin" options={['--None--', 'Email', 'Phone', 'Web', 'Broker Portal'].map((v) => ({ value: v, label: v }))} />
          </div>
        </Card>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="brand">Save</Button>
          <Button variant="brand">Save & New</Button>
          <Button variant="neutral" onClick={() => navigate('/email-to-submission')}>
            Cancel
          </Button>
        </div>
      </div>
    </>
  );
}
