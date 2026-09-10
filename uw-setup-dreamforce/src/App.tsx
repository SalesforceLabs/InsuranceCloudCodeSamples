import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ConfigProvider } from '@/data/ConfigContext';
import { Layout } from '@/components/shell/Layout';
import { ActiveConfigurationsPanel } from '@/panels/ActiveConfigurations/ActiveConfigurationsPanel';
import { ObjectManagementPanel } from '@/panels/ObjectManagement/ObjectManagementPanel';
import { ActivitiesAndStagesPanel } from '@/panels/ActivitiesAndStages/ActivitiesAndStagesPanel';
import { StmDetailPanel } from '@/panels/ActivitiesAndStages/StmDetailPanel';
import { ScDetailPanel } from '@/panels/ActivitiesAndStages/ScDetailPanel';
import { IntegrationHubPanel } from '@/panels/IntegrationHub/IntegrationHubPanel';
import { ConnectionDetailPanel } from '@/panels/IntegrationHub/ConnectionDetailPanel';
import { DataEnrichmentPanel } from '@/panels/DataEnrichment/DataEnrichmentPanel';
import { DocumentExtractionPanel } from '@/panels/DocumentExtraction/DocumentExtractionPanel';
import { ReconciliationPanel } from '@/panels/Reconciliation/ReconciliationPanel';
import { HierarchyDetailPanel } from '@/panels/Reconciliation/HierarchyDetailPanel';
import { RunMyDayPanel } from '@/panels/RunMyDay/RunMyDayPanel';
import { GeneralSetupPanel } from '@/panels/GeneralSetup/GeneralSetupPanel';
import { ConnectionDetailPanel as GsConnectionDetailPanel } from '@/panels/GeneralSetup/ConnectionDetailPanel';
import { LinesOfBusinessPanel } from '@/panels/LinesOfBusiness/LinesOfBusinessPanel';
import { SubmissionSettingsPanel } from '@/panels/SubmissionSettings/SubmissionSettingsPanel';
import { IntegrationsPanel } from '@/panels/Integrations/IntegrationsPanel';
import { EmailToSubmissionPanel } from '@/panels/EmailToSubmission/EmailToSubmissionPanel';
import { RoutingFormPanel } from '@/panels/EmailToSubmission/RoutingFormPanel';
import { SubmissionAssignmentPanel } from '@/panels/SubmissionAssignment/SubmissionAssignmentPanel';
import { AssignmentRuleDetailPanel } from '@/panels/SubmissionAssignment/AssignmentRuleDetailPanel';
import { RuleEntryFormPanel } from '@/panels/SubmissionAssignment/RuleEntryFormPanel';

export function App() {
  return (
    <ConfigProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/general-setup" replace />} />
            <Route path="/active-configurations" element={<ActiveConfigurationsPanel />} />
            <Route path="/activities" element={<ActivitiesAndStagesPanel />} />
            <Route path="/activities/stm/:id" element={<StmDetailPanel />} />
            <Route path="/activities/lob/:id" element={<ScDetailPanel />} />
            <Route path="/integration-hub" element={<IntegrationHubPanel />} />
            <Route path="/integration-hub/connection/:id" element={<ConnectionDetailPanel />} />
            <Route path="/data-enrichment" element={<DataEnrichmentPanel />} />
            <Route path="/document-extraction" element={<DocumentExtractionPanel />} />
            <Route path="/reconciliation" element={<ReconciliationPanel />} />
            <Route path="/reconciliation/hierarchy/:id" element={<HierarchyDetailPanel />} />
            <Route path="/integrations" element={<IntegrationsPanel />} />
            <Route path="/general-setup" element={<GeneralSetupPanel />} />
            <Route path="/general-setup/connection/:id" element={<GsConnectionDetailPanel />} />
            <Route path="/submission-settings" element={<SubmissionSettingsPanel />} />
            <Route path="/submission-settings/stage-config/:id" element={<ScDetailPanel />} />
            <Route path="/lines-of-business" element={<LinesOfBusinessPanel />} />
            <Route path="/lines-of-business/stage-config/:id" element={<ScDetailPanel />} />
            <Route path="/run-my-day" element={<Navigate to="/general-setup" replace />} />
            <Route path="/run-my-day/playbooks" element={<RunMyDayPanel />} />
            <Route path="/email-to-submission" element={<EmailToSubmissionPanel />} />
            <Route path="/email-to-submission/routing/:id" element={<RoutingFormPanel />} />
            <Route path="/submission-assignment" element={<SubmissionAssignmentPanel />} />
            <Route path="/submission-assignment/:id" element={<AssignmentRuleDetailPanel />} />
            <Route path="/submission-assignment/:id/entry/:entryId" element={<RuleEntryFormPanel />} />
            <Route path="/object-management" element={<ObjectManagementPanel />} />
            <Route path="*" element={<Navigate to="/general-setup" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
