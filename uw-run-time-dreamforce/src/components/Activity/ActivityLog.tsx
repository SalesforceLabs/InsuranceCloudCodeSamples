import React from 'react';
import ActivityItem, { ActivityItemProps } from './ActivityItem';
import { Button } from '@salesforce/design-system-react';

interface ActivityLogProps {
  activities: ActivityItemProps[];
  showViewAll?: boolean;
  showHeading?: boolean;
  onViewAll?: () => void;
}

export default function ActivityLog({
  activities,
  showViewAll = true,
  showHeading = true,
  onViewAll
}: ActivityLogProps) {
  return (
    <div>
      {showHeading && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: '#2e2e2e' }}>
          Activity Log
        </h3>
        {showViewAll && activities.length > 0 && (
          <Button
            label="View All"
            variant="neutral"
            onClick={onViewAll}
            style={{ fontSize: '13px', height: '28px', padding: '0 12px' }}
          />
        )}
      </div>
      )}

      <div>
        {activities.length > 0 ? (
          <>
            {activities.map((activity, index) => (
              <ActivityItem
                key={activity.id}
                {...activity}
                isLast={index === activities.length - 1}
              />
            ))}
            {showViewAll && !showHeading && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
                <button
                  onClick={onViewAll}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: '#0176D3',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '4px 8px'
                  }}
                >
                  View All
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '24px',
            color: '#706E6B',
            fontSize: '13px',
            backgroundColor: 'white',
            borderRadius: '12px'
          }}>
            No activities to display
          </div>
        )}
      </div>
    </div>
  );
}
