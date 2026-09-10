import { Card, EmptyState, Icon, PageHeader } from '@/components/ui';

export function ActiveConfigurationsPanel() {
  return (
    <>
      <PageHeader
        title="Active Configurations"
        icon={<Icon name="check" size={20} />}
        subtitle="An overview of every configuration that is currently active across underwriting setup."
      />
      <Card padding="md">
        <EmptyState
          icon={<Icon name="check" size={20} />}
          title="Coming soon"
          description="A consolidated view of active activities, stages, integrations, enrichments, and playbooks will live here."
        />
      </Card>
    </>
  );
}
