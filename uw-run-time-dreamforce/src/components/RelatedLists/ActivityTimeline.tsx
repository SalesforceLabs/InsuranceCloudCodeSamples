import React from 'react';
import { Card, Icon } from '@salesforce/design-system-react';
import { ActivityHistory } from '@/types/InsuranceSubmission';
import { format } from 'date-fns';

interface ActivityTimelineProps {
  activities: ActivityHistory[];
}

export default function ActivityTimeline({ activities }: ActivityTimelineProps) {
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy hh:mm a');
  };

  const getIconName = (type: ActivityHistory['type']) => {
    switch (type) {
      case 'Note':
        return 'note';
      case 'Email':
        return 'email';
      case 'Call':
        return 'call';
      case 'Task':
        return 'task';
      case 'Status Change':
        return 'record_update';
      default:
        return 'event';
    }
  };

  return (
    <Card heading="Activity Timeline" className="slds-m-top_medium">
      <div className="slds-timeline">
        <ul className="slds-list_dotted">
          {activities.map((activity, index) => (
            <li key={activity.id} className="slds-timeline__item">
              <span className="slds-assistive-text">{activity.type}</span>
              <div className="slds-media">
                <div className="slds-media__figure">
                  <div className="slds-icon_container slds-icon-standard-task slds-timeline__icon">
                    <Icon
                      category="standard"
                      name={getIconName(activity.type)}
                      size="small"
                    />
                  </div>
                </div>
                <div className="slds-media__body">
                  <div className="slds-grid slds-grid_align-spread slds-timeline__trigger">
                    <div className="slds-grid slds-grid_vertical-align-center slds-truncate_container_75 slds-no-space">
                      <h3 className="slds-truncate" title={activity.subject}>
                        <strong>{activity.subject}</strong>
                      </h3>
                    </div>
                    <div className="slds-timeline__actions slds-timeline__actions_inline">
                      <p className="slds-timeline__date">{formatDate(activity.date)}</p>
                    </div>
                  </div>
                  <p className="slds-m-vertical_x-small">{activity.description}</p>
                  <div className="slds-text-color_weak slds-text-body_small">
                    <Icon
                      category="utility"
                      name="user"
                      size="x-small"
                      className="slds-icon-text-default"
                    />
                    <span className="slds-m-left_xx-small">{activity.user}</span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
