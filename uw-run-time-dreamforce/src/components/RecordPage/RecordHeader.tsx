import React from 'react';
import { PageHeader, PageHeaderControl, Button, Dropdown } from '@salesforce/design-system-react';
import { InsuranceSubmission } from '@/types/InsuranceSubmission';

// Base path prefix for static assets under public/ (empty locally, set for GitHub Pages).
const ASSET_PREFIX = process.env.NEXT_PUBLIC_PAGES_BASE_PATH || '';

interface RecordHeaderProps {
  submission: InsuranceSubmission;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function RecordHeader({ submission, onEdit, onDelete }: RecordHeaderProps) {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'success';
      case 'Rejected':
        return 'error';
      case 'Under Review':
        return 'warning';
      case 'Submitted':
        return 'default';
      default:
        return 'default';
    }
  };

  const actions = () => (
    <>
      <PageHeaderControl>
        <Button label="Edit" onClick={onEdit} />
      </PageHeaderControl>
      <PageHeaderControl>
        <Button label="Delete" onClick={onDelete} />
      </PageHeaderControl>
      <PageHeaderControl>
        <Dropdown
          assistiveText={{ icon: 'More' }}
          iconCategory="utility"
          iconName="down"
          iconVariant="border-filled"
          onSelect={(option: any) => {
            console.log('Selected:', option);
          }}
          options={[
            { label: 'Share', value: 'share' },
            { label: 'Clone', value: 'clone' },
            { label: 'Submit for Approval', value: 'submit' },
          ]}
        />
      </PageHeaderControl>
    </>
  );

  return (
    <PageHeader
      icon={
        <span className="slds-icon_container slds-icon-standard-opportunity">
          <svg className="slds-icon slds-page-header__icon" aria-hidden="true">
            <use xlinkHref={`${ASSET_PREFIX}/assets/salesforce-lightning-design-system/icons/standard-sprite/svg/symbols.svg#opportunity`} />
          </svg>
        </span>
      }
      label="Insurance Submission"
      title={submission.name}
      info={submission.id}
      truncate
      variant="record-home"
      onRenderActions={actions}
      details={[
        {
          label: 'Status',
          content: (
            <span className={`slds-badge slds-badge_${getStatusVariant(submission.status)}`}>
              {submission.status}
            </span>
          ),
        },
        {
          label: 'Underwriter',
          content: submission.underwriter,
        },
        {
          label: 'Total Premium',
          content: `$${submission.totalPremium.toLocaleString()}`,
        },
      ]}
    />
  );
}
