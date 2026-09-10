import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Button,
  Card,
  DataTable,
  DataTableColumn,
  Icon,
  IconSettings,
  PageHeader
} from '@salesforce/design-system-react';
import GlobalHeader from '@/components/Navigation/GlobalHeader';
import { mockSubmissions } from '@/data/mockSubmissions';
import { format } from 'date-fns';
import { useDemoFlow } from '@/contexts/DemoFlowContext';

// Base path prefix for static assets under public/ (empty locally, set for GitHub Pages).
const ASSET_PREFIX = process.env.NEXT_PUBLIC_PAGES_BASE_PATH || '';

type RunMyDayGroupKey = 'grow' | 'retain' | 'service' | 'comply';

type RunMyDayInsight = {
  id: string;
  title: string;
  count: number;
  rule: string;
  banner: string;
  submissions: RunMyDaySubmission[];
};

type RunMyDayActionKind = 'partial-extraction' | 'open-submission';

type RunMyDayAction = {
  label: string;
  reason: string;
  kind?: RunMyDayActionKind;
};

type RunMyDayAlert = {
  title: string;
  message: string;
};

type RunMyDaySubmission = {
  id: string;
  title: string;
  subline: string;
  description: string;
  alerts?: RunMyDayAlert[];
  actions: RunMyDayAction[];
};

type RunMyDayGroup = {
  key: RunMyDayGroupKey;
  label: string;
  iconName: string;
  count: number;
  insights: RunMyDayInsight[];
};

const runMyDayGroups: RunMyDayGroup[] = [
  {
    key: 'retain',
    label: 'Retain',
    iconName: 'case',
    count: 6,
    insights: [
      {
        id: 'retain-insight-1',
        title: 'High-Priority Renewals Expiring in 7 Days',
        count: 2,
        rule: 'Renewal · Expiring in 7 days · Within $0-$25K authority',
        banner: 'Expiring in 7 days. $40K premium at risk. Quote by Jun 12 to meet 48-hour SLA.',
        submissions: [
          {
            id: 'a00SB00001ARehdYAD',
            title: 'NexGen Biologics Inc.',
            subline: '$18K Premium · Portland, OR · Commercial Property',
            description:
              'This is a renewal submission for NexGen Biologics Inc. The current policy expires on June 15, 2026. Last term premium was $18K with no claims. Loss runs show clean 5-year history. Building has been upgraded with new sprinkler system since last term. All renewal documentation received from broker. Data enrichment complete - ready to price.',
            alerts: [
              {
                title: 'Unable to classify document',
                message: 'Unable to classify ACORD 126 - Commercial General Liability.pdf. Manual classification required to continue.',
              },
            ],
            actions: [
              {
                label: 'Open Submission',
                reason: 'Open full Risk Appetite Scorecard with pre-enriched D&B, ISO, and CoreLogic data',
              },
              {
                label: 'Price & Quote',
                reason: 'Open rating engine with auto-populated fields. Estimated time: 20 min',
              },
              {
                label: 'Email Broker',
                reason: 'Send message to Acme Brokerage. Draft email suggestions available',
              },
            ],
          },
          {
            id: 'sub-def-dist',
            title: 'Northwest Supply & Logistics',
            subline: '$22K Premium · Seattle, WA · General Liability + Commercial Property',
            description:
              'Renewal submission expiring June 16, 2026. Clean loss history with 38% loss ratio. Standard broker tier. Quote due by Jun 14.',
            actions: [
              {
                label: 'Open Submission',
                reason: 'Open full Risk Appetite Scorecard with pre-enriched D&B, ISO, and CoreLogic data',
              },
              {
                label: 'Price & Quote',
                reason: 'Open rating engine with auto-populated fields',
              },
              {
                label: 'Email Broker',
                reason: 'Send message to Beta Insurance Agency',
              },
            ],
          },
        ],
      },
      {
        id: 'retain-insight-2',
        title: 'Renewals with Premium Increases >15%',
        count: 3,
        rule: 'Renewal · Premium increase >15% · Within $0-$25K authority',
        banner: 'May cause non-renewals. Broker may shop for better pricing. Prepare justification for increase or consider adjustment.',
        submissions: [
          {
            id: 'sub-ghi-retail',
            title: 'Cascade Home & Garden Center',
            subline: '$15K Premium (+20%) · Renewal',
            description:
              'Renewal with 20% premium increase from $12.5K to $15K. May require justification.',
            actions: [
              {
                label: 'Open Submission',
                reason: 'Review full details and loss history',
              },
              {
                label: 'Price & Quote',
                reason: 'Recalculate premium options',
              },
            ],
          },
          {
            id: 'sub-jkl-restaurant',
            title: 'Bella Vista Italian Bistro',
            subline: '$9K Premium (+20%) · Renewal',
            description:
              'Renewal with 20% premium increase from $7.5K to $9K.',
            actions: [
              {
                label: 'Open Submission',
                reason: 'Review details',
              },
              {
                label: 'Price & Quote',
                reason: 'Adjust pricing',
              },
            ],
          },
          {
            id: 'sub-mno-office',
            title: 'Pioneer Square Professional Center',
            subline: '$14K Premium (+17%) · Renewal',
            description:
              'Renewal with 17% premium increase from $12K to $14K.',
            actions: [
              {
                label: 'Open Submission',
                reason: 'Review details',
              },
              {
                label: 'Price & Quote',
                reason: 'Recalculate',
              },
            ],
          },
        ],
      },
      {
        id: 'retain-insight-3',
        title: 'Renewal with New Loss Activity',
        count: 1,
        rule: 'Renewal · New loss activity since last term',
        banner: 'Loss ratio 38% (acceptable, but requires review). Review loss details, adjust pricing if necessary.',
        submissions: [
          {
            id: 'sub-pqr-warehouse',
            title: 'Columbia River Distribution Center',
            subline: '$21K Premium · 1 Claim ($8K) · Loss Ratio 38%',
            description:
              'Renewal with new loss activity. One claim for $8K incurred last term. Loss ratio 38% is acceptable but requires review before renewal.',
            actions: [
              {
                label: 'Open Submission',
                reason: 'Review loss details',
              },
              {
                label: 'Price & Quote',
                reason: 'Adjust pricing for loss activity',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    key: 'grow',
    label: 'Grow',
    iconName: 'trending',
    count: 1,
    insights: [
      {
        id: 'grow-insight-1',
        title: 'New Business - Preferred Broker Submission',
        count: 1,
        rule: 'New business · Preferred broker · Within $0-$25K authority · Clean loss history',
        banner: 'New business submission from preferred broker - Restaurant class, clean loss history, estimated $19K premium. Good learning opportunity.',
        submissions: [
          {
            id: 'sub-stu-restaurant',
            title: 'Emerald City Seafood & Grill',
            subline: '$19K Est. Premium · Seattle, WA · Restaurant · Acme Brokerage (Preferred)',
            description:
              'New business opportunity with preferred broker. Clean loss history. Est. premium: $19K. Good example of "sweet spot" account for practice.',
            actions: [
              {
                label: 'Open Submission',
                reason: 'Review full submission details',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    key: 'service',
    label: 'Service',
    iconName: 'custom_apps',
    count: 1,
    insights: [
      {
        id: 'service-insight-1',
        title: 'Broker RFI - Certificate of Insurance',
        count: 1,
        rule: 'In-force policy · Broker RFI · COI request',
        banner: 'Broker RFI - Certificate of Insurance request for existing policy. Standard request, should take 15 min. Received 2 hours ago.',
        submissions: [
          {
            id: 'sub-vwx-office',
            title: 'Waterfront Corporate Plaza',
            subline: 'Policy POL-789456 · Beta Insurance Agency · COI Request',
            description:
              'Broker requesting certificate of insurance for existing account. Priority: Standard. Received 2h ago. Landlord requires updated COI for lease renewal. SLA: 4 hours (50% remaining).',
            actions: [
              {
                label: 'Generate COI',
                reason: 'Auto-populated with policy data',
              },
              {
                label: 'Email Broker',
                reason: 'Draft email with COI attached',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    key: 'comply',
    label: 'Comply',
    iconName: 'locker_service_console',
    count: 1,
    insights: [
      {
        id: 'comply-insight-1',
        title: 'Appetite Violation - High Hazard Manufacturing',
        count: 1,
        rule: 'Appetite violation · Restricted class · Learning required',
        banner: 'Appetite violation detected: High Hazard Manufacturing class. Review appetite guidelines section 4.2 before proceeding. LEARNING: This class requires sprinkler system to be acceptable.',
        submissions: [
          {
            id: 'sub-yza-mfg',
            title: 'Precision Chemical Solutions LLC',
            subline: 'New Business · Class 43210 (High Hazard) · Sprinklers Present',
            description:
              'LEARNING OPPORTUNITY: Appetite violation detected. Review guidelines before proceeding. Class 43210 acceptable ONLY if building has automatic sprinkler system. Building: 1998, Masonry non-combustible, automatic sprinklers present, central station fire alarm. DECISION: ACCEPTABLE - sprinkler system present.',
            actions: [
              {
                label: 'Review Guidelines',
                reason: 'Opens appetite guidelines section 4.2',
              },
              {
                label: 'Proceed with Quote',
                reason: 'If sprinklers present',
              },
              {
                label: 'Refer to Marcus',
                reason: 'Escalate to Marcus Webb (Senior). Include your work-in-progress notes',
              },
            ],
          },
        ],
      },
    ],
  },
];

export default function Home() {
  const router = useRouter();
  const { goToStep } = useDemoFlow();
  const [items, setItems] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'run-my-day' | 'all-submissions'>('run-my-day');
  const [activeGroupKey, setActiveGroupKey] = useState<RunMyDayGroupKey>('retain');
  const [activeInsightId, setActiveInsightId] = useState<string>('retain-insight-1');
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MM/dd/yyyy');
  };

  const columns: DataTableColumn[] = [
    {
      label: 'Submission Name',
      property: 'submissionName',
      sortable: true,
      width: '15rem'
    },
    {
      label: 'Account',
      property: 'accountName',
      sortable: true,
      width: '12rem'
    },
    {
      label: 'Line Of Business',
      property: 'lineOfBusiness',
      sortable: true,
      width: '12rem'
    },
    {
      label: 'Total Insured Value',
      property: 'totalInsuredValue',
      sortable: true,
      width: '10rem'
    },
    {
      label: 'Is Renewal',
      property: 'isRenewal',
      sortable: true,
      width: '8rem'
    },
    {
      label: 'Date Submitted',
      property: 'dateSubmitted',
      sortable: true,
      width: '9rem'
    },
    {
      label: 'Stage',
      property: 'stage',
      sortable: true,
      width: '10rem'
    },
  ];

  // Load items - function to reload from localStorage
  const loadItems = () => {
    const loadedItems = mockSubmissions.map((submission) => {
      // Load any saved edits from localStorage
      let submissionData = submission;
      const savedEdits = localStorage.getItem(`submission_${submission.id}`);
      if (savedEdits) {
        try {
          const edits = JSON.parse(savedEdits);
          submissionData = { ...submission, ...edits };
        } catch (e) {
          console.error('Error loading saved edits for list:', e);
        }
      }

      return {
        id: submissionData.id,
        submissionName: submissionData.name,
        accountName: submissionData.insuredName,
        accountId: submissionData.accountId || `ACC-${submissionData.id}`,
        lineOfBusiness: submissionData.lineOfBusiness || submissionData.policyType,
        totalInsuredValue: formatCurrency(submissionData.totalInsuredValue || submissionData.coverageAmount),
        isRenewal: submissionData.isRenewal ? 'Yes' : 'No',
        dateSubmitted: submissionData.dateSubmitted ? formatDate(submissionData.dateSubmitted) : formatDate(submissionData.submissionDate),
        stage: submissionData.stage || submissionData.status || 'Draft',
        isNew: submissionData.isNew === true,
      };
    });
    setItems(loadedItems);
  };

  // Load items on mount to avoid hydration mismatch
  useEffect(() => {
    loadItems();
  }, []);

  // Reload items when navigating back to this page
  useEffect(() => {
    const handleRouteChange = () => {
      loadItems();
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  const handleRowClick = (item: any) => {
    if (item.isNew) {
      goToStep(1);
    }
    router.push(`/submissions/${item.id}`);
  };

  // Apply link formatting to Account column and row click handlers after DataTable renders.
  // Also re-runs when switching to the All Submissions tab — the table unmounts on the Run my day tab,
  // so a fresh DOM needs the NEW badge / row handlers re-injected.
  useEffect(() => {
    if (activeTab !== 'all-submissions') return;

    const inject = () => {
      const table = document.getElementById('submissions-table');
      if (!table || items.length === 0) return;
      const rows = table.querySelectorAll('tbody tr');
      rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        const item = items[index];
        if (item && cells.length > 0) {
          const nameCell = cells[0] as HTMLElement;
          const nameDiv = nameCell.querySelector('div');
          if (nameDiv && item.isNew) {
            const escapedName = String(item.submissionName)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
            nameDiv.innerHTML = `<div class="name-cell-content"><span class="name-text">${escapedName}</span><span class="new-badge">NEW</span></div>`;
          }

          const accountCell = cells[1] as HTMLElement;
          const accountDiv = accountCell.querySelector('div');
          if (accountDiv) {
            accountDiv.innerHTML = `<a href="/accounts/${item.accountId}" class="account-link">${item.accountName}</a>`;
          }

          (row as HTMLTableRowElement).onclick = (e) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'A' || target.closest('a')) return;
            handleRowClick(item);
          };
        }
      });
    };

    // Defer one frame so the DataTable's tbody has mounted before we touch it.
    const handle = window.requestAnimationFrame(inject);
    return () => window.cancelAnimationFrame(handle);
  }, [items, activeTab]);

  return (
    <IconSettings iconPath={`${ASSET_PREFIX}/assets/salesforce-lightning-design-system/icons`}>
      <div style={{ backgroundColor: '#f3f3f3', minHeight: '100vh' }}>
        <GlobalHeader />

        <div style={{ padding: '16px', maxWidth: '1440px', margin: '0 auto' }}>
          {/* Top-level Tabs: Run my day / All Submissions */}
          <div style={{
            display: 'flex',
            gap: '4px',
            borderBottom: '1px solid #c9c9c9',
            marginBottom: '16px',
            backgroundColor: 'transparent'
          }}>
            {[
              { key: 'run-my-day', label: 'Run my day' },
              { key: 'all-submissions', label: 'All Submissions' }
            ].map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as 'run-my-day' | 'all-submissions')}
                  style={{
                    border: 'none',
                    background: 'none',
                    padding: '10px 16px',
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#0176D3' : '#3e3e3c',
                    borderBottom: isActive ? '2px solid #0176D3' : '2px solid transparent',
                    cursor: 'pointer',
                    marginBottom: '-1px'
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === 'run-my-day' && (
            <RunMyDayView
              activeGroupKey={activeGroupKey}
              setActiveGroupKey={setActiveGroupKey}
              activeInsightId={activeInsightId}
              setActiveInsightId={setActiveInsightId}
              onOpenSubmission={(id) => {
                if (id === 'a00SB00001ARehdYAD') goToStep(1);
                router.push(`/submissions/${id}`);
              }}
            />
          )}

          {activeTab === 'all-submissions' && (
            <>
          {/* Page Header */}
          <div style={{ backgroundColor: 'white', marginBottom: '16px' }}>
            <PageHeader
              icon={
                <Icon
                  assistiveText={{ label: 'Submissions' }}
                  category="standard"
                  name="document"
                  size="medium"
                  style={{ backgroundColor: '#5867E8' }}
                />
              }
              label="Submissions"
              title="Insurance Submissions"
              onRenderActions={() => (
                <Button label="New Submission" variant="brand" />
              )}
              info={`${items.length} items`}
            />
          </div>

          {/* Summary Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
            {/* Total Insured Value */}
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #c9c9c9',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#706E6B', lineHeight: '16px' }}>Total Insured Value</span>
                <Button
                  assistiveText={{ icon: 'More options' }}
                  iconCategory="utility"
                  iconName="threedots_vertical"
                  iconSize="x-small"
                  variant="icon"
                />
              </div>
              <div style={{ fontSize: '28px', fontWeight: 400, color: '#001e5b', marginBottom: '4px' }}>$539M</div>
              <div style={{ fontSize: '11px', color: '#706E6B' }}>+4.5% vs Yesterday</div>
            </div>

            {/* Risk Submission Review Time */}
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #c9c9c9',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#706E6B', lineHeight: '16px' }}>Risk Submission Review Time</span>
                <Button
                  assistiveText={{ icon: 'More options' }}
                  iconCategory="utility"
                  iconName="threedots_vertical"
                  iconSize="x-small"
                  variant="icon"
                />
              </div>
              <div style={{ fontSize: '28px', fontWeight: 400, color: '#001e5b', marginBottom: '4px' }}>22hrs</div>
              <div style={{ fontSize: '11px', color: '#706E6B' }}>+7.5% vs Yesterday</div>
            </div>

            {/* Submission To Quote Conversion */}
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #c9c9c9',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#706E6B', lineHeight: '16px' }}>Submission To Quote Conversion</span>
                <Button
                  assistiveText={{ icon: 'More options' }}
                  iconCategory="utility"
                  iconName="threedots_vertical"
                  iconSize="x-small"
                  variant="icon"
                />
              </div>
              <div style={{ fontSize: '28px', fontWeight: 400, color: '#001e5b', marginBottom: '4px' }}>56%</div>
              <div style={{ fontSize: '11px', color: '#706E6B' }}>+4.7% vs Yesterday</div>
            </div>

            {/* Quote To Bound Conversion */}
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #c9c9c9',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#706E6B', lineHeight: '16px' }}>Quote To Bound Conversion</span>
                <Button
                  assistiveText={{ icon: 'More options' }}
                  iconCategory="utility"
                  iconName="threedots_vertical"
                  iconSize="x-small"
                  variant="icon"
                />
              </div>
              <div style={{ fontSize: '28px', fontWeight: 400, color: '#001e5b', marginBottom: '4px' }}>-</div>
              <div style={{ fontSize: '11px', color: '#706E6B' }}>- vs Yesterday</div>
            </div>
          </div>

          {/* List View Card */}
          <Card hasNoHeader style={{ backgroundColor: 'white', padding: 0 }}>
            <div style={{
              borderBottom: '1px solid #dddbda',
              padding: '12px 16px',
              backgroundColor: '#fafaf9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Icon
                  assistiveText={{ label: 'List View' }}
                  category="utility"
                  name="table"
                  size="x-small"
                />
                <span style={{ fontWeight: 600, fontSize: '13px' }}>All Submissions</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  assistiveText={{ icon: 'Filter' }}
                  iconCategory="utility"
                  iconName="filterList"
                  iconSize="small"
                  variant="icon"
                  iconVariant="border"
                />
                <Button
                  assistiveText={{ icon: 'Refresh' }}
                  iconCategory="utility"
                  iconName="refresh"
                  iconSize="small"
                  variant="icon"
                  iconVariant="border"
                />
              </div>
            </div>

            <div style={{ position: 'relative', overflowX: 'auto' }}>
              <style jsx>{`
                :global(#submissions-table tbody tr) {
                  cursor: pointer;
                  height: 52px;
                }
                :global(#submissions-table tbody tr:hover) {
                  background-color: #f3f3f3;
                }
                :global(#submissions-table tbody td) {
                  padding-top: 12px !important;
                  padding-bottom: 12px !important;
                }
                :global(.account-link) {
                  color: #0176D3 !important;
                  text-decoration: none !important;
                  font-weight: 600 !important;
                  cursor: pointer;
                }
                :global(.account-link:hover) {
                  text-decoration: underline !important;
                }
                :global(.account-link:visited) {
                  color: #0176D3 !important;
                }
                :global(.name-cell-content) {
                  display: flex !important;
                  align-items: center !important;
                  justify-content: space-between !important;
                  gap: 8px !important;
                  width: 100% !important;
                }
                :global(.name-text) {
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                }
                :global(.new-badge) {
                  display: inline-flex;
                  align-items: center;
                  padding: 3px 10px;
                  border-radius: 12px;
                  background-color: #ea001e;
                  color: white;
                  font-size: 11px;
                  font-weight: 700;
                  letter-spacing: 0.6px;
                  flex-shrink: 0;
                  text-transform: uppercase;
                  box-shadow: 0 0 0 2px rgba(234, 0, 30, 0.18);
                }
              `}</style>

              <DataTable
                items={items}
                id="submissions-table"
              >
                {columns.map((column) => (
                  <DataTableColumn key={column.property} {...column} />
                ))}
              </DataTable>
            </div>
          </Card>

          {/* List View Info Footer */}
          <div style={{
            padding: '12px 16px',
            backgroundColor: 'white',
            borderTop: '1px solid #dddbda',
            marginTop: '-1px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: '#706E6B'
          }}>
            <span>{items.length} items • Updated a few seconds ago</span>
            <span>Page 1 of 1</span>
          </div>
            </>
          )}
        </div>
      </div>
    </IconSettings>
  );
}

interface RunMyDayViewProps {
  activeGroupKey: RunMyDayGroupKey;
  setActiveGroupKey: (key: RunMyDayGroupKey) => void;
  activeInsightId: string;
  setActiveInsightId: (id: string) => void;
  onOpenSubmission: (id: string) => void;
}

function RunMyDayView({
  activeGroupKey,
  setActiveGroupKey,
  activeInsightId,
  setActiveInsightId,
  onOpenSubmission
}: RunMyDayViewProps) {
  const activeGroup = runMyDayGroups.find((g) => g.key === activeGroupKey) || runMyDayGroups[0];
  const activeInsight =
    activeGroup.insights.find((i) => i.id === activeInsightId) || activeGroup.insights[0];

  return (
    <div>
      <h2 style={{
        fontSize: '20px',
        fontWeight: 600,
        color: '#001e5b',
        margin: '0 0 16px 0'
      }}>
        Good morning Martha
      </h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '560px 1fr',
        gap: '16px',
        alignItems: 'start'
      }}>
        {/* Combined Groups + Insights panel */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e5e5e5',
          borderRadius: '8px',
          padding: '16px',
          minHeight: '420px',
          display: 'grid',
          gridTemplateColumns: '200px 1fr',
          gap: '20px',
          alignItems: 'start'
        }}>
          {/* Groups column */}
          <div>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#5c5c5c',
              padding: '0 0 10px 4px'
            }}>
              Groups
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {runMyDayGroups.map((group) => {
                const isActive = activeGroupKey === group.key;
                return (
                  <button
                    key={group.key}
                    onClick={() => {
                      setActiveGroupKey(group.key);
                      setActiveInsightId(group.insights[0]?.id || '');
                    }}
                    style={{
                      border: '1px solid #e5e5e5',
                      borderRadius: '8px',
                      backgroundColor: isActive ? '#0b5cab' : 'white',
                      color: isActive ? 'white' : '#001e5b',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '13px',
                      fontWeight: 600,
                      textAlign: 'left',
                      boxShadow: isActive ? '0 1px 4px rgba(11,92,171,0.25)' : 'none'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <svg width="16" height="16" viewBox="0 0 52 52" fill={isActive ? 'white' : '#5c5c5c'}>
                        <use href={`${ASSET_PREFIX}/assets/salesforce-lightning-design-system/icons/utility-sprite/svg/symbols.svg#${group.iconName}`} />
                      </svg>
                      {group.label}
                    </span>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: isActive ? 'white' : '#5c5c5c'
                    }}>
                      {group.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Insights column */}
          <div>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#5c5c5c',
              padding: '0 0 10px 4px'
            }}>
              Insights
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activeGroup.insights.map((insight) => {
                const isInsightActive = activeInsightId === insight.id;
                return (
                  <button
                    key={insight.id}
                    onClick={() => setActiveInsightId(insight.id)}
                    style={{
                      border: 'none',
                      borderRadius: '8px',
                      backgroundColor: isInsightActive ? '#eef3fb' : 'transparent',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#001e5b',
                      marginBottom: '4px'
                    }}>
                      {insight.title} ({insight.count})
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#5c5c5c',
                      lineHeight: '16px'
                    }}>
                      {insight.rule}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Submissions for active insight */}
        <div style={{
          background: 'linear-gradient(180deg, #efe7ff 0%, #f5f0ff 100%)',
          border: '1px solid #e2d6ff',
          borderRadius: '12px',
          padding: '16px',
          minHeight: '420px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {activeInsight && (
            <>
              {/* Banner */}
              <div style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
                padding: '4px 4px 8px 4px'
              }}>
                <svg width="16" height="16" viewBox="0 0 52 52" fill="#0b5cab" style={{ marginTop: '2px', flexShrink: 0 }}>
                  <use href={`${ASSET_PREFIX}/assets/salesforce-lightning-design-system/icons/utility-sprite/svg/symbols.svg#einstein`} />
                </svg>
                <div style={{ fontSize: '13px', color: '#1a1a1a', lineHeight: '18px' }}>
                  {activeInsight.banner}
                </div>
              </div>

              {/* Submission tiles */}
              {activeInsight.submissions.length === 0 && (
                <div style={{
                  fontSize: '12px',
                  color: '#5c5c5c',
                  padding: '8px',
                  fontStyle: 'italic'
                }}>
                  No submissions match this rule right now.
                </div>
              )}

              {activeInsight.submissions.map((sub) => {
                return (
                  <div
                    key={sub.id}
                    style={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e5e5',
                      borderRadius: '10px',
                      padding: '14px 16px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '12px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div
                          onClick={() => onOpenSubmission(sub.id)}
                          style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: '#0176D3',
                            cursor: 'pointer',
                            marginBottom: '4px'
                          }}
                        >
                          {sub.title}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#5c5c5c'
                        }}>
                          {sub.subline}
                        </div>
                      </div>
                      <div
                        style={{
                          border: '1px solid #c9c9c9',
                          borderRadius: '50%',
                          backgroundColor: 'white',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                        aria-hidden="true"
                      >
                        <svg width="10" height="10" viewBox="0 0 52 52" fill="#001e5b">
                          <use href={`${ASSET_PREFIX}/assets/salesforce-lightning-design-system/icons/utility-sprite/svg/symbols.svg#chevrondown`} />
                        </svg>
                      </div>
                    </div>

                    <div style={{ marginTop: '12px' }}>
                      <div style={{
                        fontSize: '12px',
                        color: '#3e3e3c',
                        lineHeight: '17px',
                        marginBottom: '12px'
                      }}>
                        {sub.description}
                      </div>

                      {(() => {
                        const tasks = sub.actions.filter(
                          (a) => a.kind !== 'open-submission' && a.label !== 'Open Submission'
                        );
                        const alerts = sub.alerts || [];
                        return (
                          <div style={{
                            border: '1px solid #e5e5e5',
                            borderRadius: '8px',
                            backgroundColor: '#fafaf9',
                            padding: '12px 14px'
                          }}>
                            {alerts.length > 0 && (
                              <div style={{ marginBottom: tasks.length > 0 ? '14px' : '0' }}>
                                <div style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  color: '#5c5c5c',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.4px',
                                  marginBottom: '10px'
                                }}>
                                  Needs attention
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {alerts.map((alert, idx) => (
                                  <div
                                    key={idx}
                                    style={{
                                      display: 'flex',
                                      gap: '8px',
                                      border: '1px solid #f5c6a5',
                                      borderRadius: '6px',
                                      backgroundColor: '#fef5e8',
                                      padding: '8px 10px'
                                    }}
                                  >
                                    <svg viewBox="0 0 24 24" width="15" height="15" fill="#B85C00" style={{ flexShrink: 0, marginTop: '1px' }}>
                                      <path d="M12 2 1 21h22L12 2zm0 5.8c.6 0 1 .4 1 1v5c0 .6-.4 1-1 1s-1-.4-1-1v-5c0-.6.4-1 1-1zm0 10.7c-.7 0-1.2-.5-1.2-1.2S11.3 16 12 16s1.2.5 1.2 1.2-.5 1.3-1.2 1.3z" />
                                    </svg>
                                    <div>
                                      <div style={{
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        color: '#B85C00',
                                        marginBottom: '2px'
                                      }}>
                                        {alert.title}
                                      </div>
                                      <div style={{
                                        fontSize: '11px',
                                        color: '#5c5c5c',
                                        lineHeight: '15px'
                                      }}>
                                        {alert.message}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                </div>
                              </div>
                            )}

                            {tasks.length > 0 ? (
                              <div>
                                <div style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  color: '#5c5c5c',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.4px',
                                  marginBottom: '10px'
                                }}>
                                  Pending tasks
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {tasks.map((action, idx) => (
                                  <div key={idx}>
                                    <div style={{
                                      fontSize: '13px',
                                      fontWeight: 600,
                                      color: '#001e5b',
                                      marginBottom: '2px'
                                    }}>
                                      {action.label}
                                    </div>
                                    <div style={{
                                      fontSize: '11px',
                                      color: '#5c5c5c',
                                      lineHeight: '15px'
                                    }}>
                                      {action.reason}
                                    </div>
                                  </div>
                                ))}
                                </div>
                              </div>
                            ) : alerts.length === 0 ? (
                              <div style={{ fontSize: '12px', color: '#5c5c5c' }}>
                                No alerts or pending tasks.
                              </div>
                            ) : null}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                              <button
                                onClick={() => onOpenSubmission(sub.id)}
                                style={{
                                  border: 'none',
                                  backgroundColor: '#0176D3',
                                  color: 'white',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  borderRadius: '4px',
                                  padding: '6px 14px',
                                  cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#014486'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#0176D3'; }}
                              >
                                Go To Submission
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

