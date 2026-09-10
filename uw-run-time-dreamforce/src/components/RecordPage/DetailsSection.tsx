import React from 'react';
import { Card, Icon } from '@salesforce/design-system-react';
import { InsuranceSubmission } from '@/types/InsuranceSubmission';
import { format } from 'date-fns';

interface DetailsSectionProps {
  submission: InsuranceSubmission;
}

export default function DetailsSection({ submission }: DetailsSectionProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MM/dd/yyyy');
  };

  return (
    <Card
      heading="Details"
      headerActions={
        <button className="slds-button slds-button_icon slds-button_icon-border-filled">
          <Icon
            category="utility"
            name="edit"
            size="small"
          />
          <span className="slds-assistive-text">Edit Details</span>
        </button>
      }
    >
      <div className="slds-form slds-form_stacked">
        <div className="slds-grid slds-gutters slds-wrap">
          {/* Column 1 */}
          <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2">
            <div className="slds-form-element slds-m-bottom_small">
              <span className="slds-form-element__label slds-text-title_caps">Submission Name</span>
              <div className="slds-form-element__control">
                <span className="slds-form-element__static">{submission.name}</span>
              </div>
            </div>

            <div className="slds-form-element slds-m-bottom_small">
              <span className="slds-form-element__label slds-text-title_caps">Status</span>
              <div className="slds-form-element__control">
                <span className="slds-form-element__static">{submission.status}</span>
              </div>
            </div>

            <div className="slds-form-element slds-m-bottom_small">
              <span className="slds-form-element__label slds-text-title_caps">Policy Type</span>
              <div className="slds-form-element__control">
                <span className="slds-form-element__static">{submission.policyType}</span>
              </div>
            </div>

            <div className="slds-form-element slds-m-bottom_small">
              <span className="slds-form-element__label slds-text-title_caps">Insured Name</span>
              <div className="slds-form-element__control">
                <span className="slds-form-element__static">{submission.insuredName}</span>
              </div>
            </div>

            <div className="slds-form-element slds-m-bottom_small">
              <span className="slds-form-element__label slds-text-title_caps">Insured Address</span>
              <div className="slds-form-element__control">
                <span className="slds-form-element__static">{submission.insuredAddress}</span>
              </div>
            </div>

            <div className="slds-form-element slds-m-bottom_small">
              <span className="slds-form-element__label slds-text-title_caps">Broker</span>
              <div className="slds-form-element__control">
                <span className="slds-form-element__static">
                  <a href="#" className="slds-text-link">{submission.broker}</a>
                </span>
              </div>
            </div>
          </div>

          {/* Column 2 */}
          <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2">
            <div className="slds-form-element slds-m-bottom_small">
              <span className="slds-form-element__label slds-text-title_caps">Submission Date</span>
              <div className="slds-form-element__control">
                <span className="slds-form-element__static">{formatDate(submission.submissionDate)}</span>
              </div>
            </div>

            <div className="slds-form-element slds-m-bottom_small">
              <span className="slds-form-element__label slds-text-title_caps">Effective Date</span>
              <div className="slds-form-element__control">
                <span className="slds-form-element__static">{formatDate(submission.effectiveDate)}</span>
              </div>
            </div>

            <div className="slds-form-element slds-m-bottom_small">
              <span className="slds-form-element__label slds-text-title_caps">Expiration Date</span>
              <div className="slds-form-element__control">
                <span className="slds-form-element__static">{formatDate(submission.expirationDate)}</span>
              </div>
            </div>

            <div className="slds-form-element slds-m-bottom_small">
              <span className="slds-form-element__label slds-text-title_caps">Total Premium</span>
              <div className="slds-form-element__control">
                <span className="slds-form-element__static slds-text-heading_medium">
                  {formatCurrency(submission.totalPremium)}
                </span>
              </div>
            </div>

            <div className="slds-form-element slds-m-bottom_small">
              <span className="slds-form-element__label slds-text-title_caps">Coverage Amount</span>
              <div className="slds-form-element__control">
                <span className="slds-form-element__static">
                  {formatCurrency(submission.coverageAmount)}
                </span>
              </div>
            </div>

            <div className="slds-form-element slds-m-bottom_small">
              <span className="slds-form-element__label slds-text-title_caps">Underwriter</span>
              <div className="slds-form-element__control">
                <span className="slds-form-element__static">
                  <a href="#" className="slds-text-link">{submission.underwriter}</a>
                </span>
              </div>
            </div>

            <div className="slds-form-element slds-m-bottom_small">
              <span className="slds-form-element__label slds-text-title_caps">Risk Score</span>
              <div className="slds-form-element__control">
                <span className="slds-form-element__static">
                  <span className={`slds-badge ${submission.riskScore > 75 ? 'slds-badge_error' : submission.riskScore > 50 ? 'slds-badge_warning' : 'slds-badge_success'}`}>
                    {submission.riskScore}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes Section */}
        <div className="slds-m-top_medium">
          <div className="slds-form-element">
            <span className="slds-form-element__label slds-text-title_caps">Notes</span>
            <div className="slds-form-element__control">
              <span className="slds-form-element__static">{submission.notes}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
