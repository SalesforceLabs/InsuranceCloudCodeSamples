import { useMemo } from 'react';
import { ThreePanelHub, type HubCategory } from '@/components/ThreePanelHub';
import { openSetupAssistant } from '@/components/shell/setup-assistant-store';
import { Button, Card, Icon } from '@/components/ui';
import { SubmissionStageManagementSection } from '@/panels/GeneralSetup/SubmissionStageManagementSection';
import { LobRnCategoriesSection } from '@/panels/LinesOfBusiness/LobEnrichmentFieldsSection';
import { LobLineTypesCoveragesSection } from '@/panels/LinesOfBusiness/LobLineTypesCoveragesSection';
import { LobHierarchyV2Section } from '@/panels/LinesOfBusiness/LobHierarchyV2Section';
import '@/panels/GeneralSetup/GeneralSetup.css';

/** Reserved scope key for Submission-level definitions. Kept distinct from any
 * LOB picklist value so its categories / attributes never collide with a line
 * of business. */
const SUBMISSION_SCOPE = 'Submission';

/**
 * Submission Settings hub. Configuration that applies to the parent
 * Submission record before any LOB-specific path takes over. Sections
 * here are reused from General Setup (which used to host them under a
 * single "Submission Settings" category). Submission Context now lives as
 * its own tile under General Setup, so it is intentionally absent here.
 */
export function SubmissionSettingsPanel() {
  const categories: HubCategory[] = useMemo(
    () => [
      {
        key: 'submission-stages',
        label: 'Submission Stages',
        icon: 'task',
        description:
          'Stage configurations that run at the parent Submission level.',
        subcategories: [
          {
            key: 'stage-management',
            label: 'Stage Management',
            description:
              'Stage configurations that run at the parent Submission level.',
            render: () => <SubmissionStageManagementSection />,
            info: { subject: 'submission-stage-management' },
          },
        ],
      },
      {
        key: 'submission-definition',
        label: 'Submission Definition',
        icon: 'bundle_config',
        description:
          'Attribute categories and canonical attributes carried on the parent Submission record.',
        subcategories: [
          {
            key: 'submission-attribute-categories',
            label: 'Attribute Categories',
            group: 'Submission Definition',
            description: 'Normalization categories for the parent Submission.',
            render: () => (
              <LobRnCategoriesSection lob={SUBMISSION_SCOPE} submissionMode />
            ),
          },
          {
            key: 'submission-line-definitions',
            label: 'Line Definitions',
            group: 'Submission Definition',
            description:
              'Canonical line definitions carried on the submission — Account, Contact, Shared Location, Loss History and Previous Policies — and the attributes they own.',
            render: () => <LobLineTypesCoveragesSection lob={SUBMISSION_SCOPE} />,
            info: { subject: 'lob-line-types-coverages', scope: SUBMISSION_SCOPE, uploadCsv: true },
          },
          {
            key: 'submission-hierarchy',
            label: 'Hierarchy',
            group: 'Submission Definition',
            description:
              'Reconciliation hierarchy for the submission — the root with its line definitions as children.',
            render: () => <LobHierarchyV2Section lob={SUBMISSION_SCOPE} />,
            info: { subject: 'lob-hierarchy', scope: SUBMISSION_SCOPE },
          },
        ],
      },
    ],
    [],
  );

  return (
    <div className="gs-page">
      <header className="gs-hero">
        <div className="gs-hero__inner">
          <h1 className="gs-hero__title">Submission Settings</h1>
          <p className="gs-hero__subtitle">
            Configuration that applies to the parent Submission record before any LOB-specific
            path takes over. Pick a category below to dive into its sections.
          </p>
        </div>
        <Card
          className="gs-hero__assistant"
          title="Get Setup Help"
          subtitle="The Setup Assistant walks you through configuration step by step, suggests defaults, and surfaces the right page for the task you describe."
          actions={
            <Button
              variant="brand"
              iconLeading={<Icon name="sparkles" size={14} />}
              onClick={() => openSetupAssistant()}
            >
              Launch Setup Assistant
            </Button>
          }
          padding="none"
        />
      </header>
      <ThreePanelHub categoriesTitle="Categories" categories={categories} />
    </div>
  );
}
