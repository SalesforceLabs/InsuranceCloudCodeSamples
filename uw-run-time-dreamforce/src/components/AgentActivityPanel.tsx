import React, { useState } from 'react';
import { Icon } from '@salesforce/design-system-react';

interface AgentStep {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'in-progress' | 'pending';
  timestamp?: string;
}

interface AgentActivityPanelProps {
  taskName: string;
  steps: AgentStep[];
  onClose: () => void;
}

export const AgentActivityPanel: React.FC<AgentActivityPanelProps> = ({ taskName, steps, onClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: isExpanded ? '50%' : '400px',
        height: '100vh',
        backgroundColor: 'white',
        boxShadow: '-4px 0 12px rgba(0,0,0,0.15)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e5e5e5',
          backgroundColor: '#f3f3f3',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <Icon
            assistiveText={{ label: 'Agent' }}
            category="utility"
            name="agent_home"
            size="small"
            style={{ fill: '#0176D3' }}
          />
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#001e5b', margin: 0 }}>
              Agent Activity
            </h2>
            <p style={{ fontSize: '13px', color: '#5c5c5c', margin: 0 }}>
              {taskName}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              width: '32px',
              height: '32px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e5e5e5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Icon
              assistiveText={{ label: isExpanded ? 'Collapse' : 'Expand' }}
              category="utility"
              name={isExpanded ? 'collapse' : 'expand'}
              size="x-small"
            />
          </button>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e5e5e5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Icon
              assistiveText={{ label: 'Close' }}
              category="utility"
              name="close"
              size="x-small"
            />
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
        }}
      >
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} style={{ display: 'flex', gap: '12px', marginBottom: isLast ? 0 : '20px' }}>
              {/* Timeline indicator */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor:
                      step.status === 'completed'
                        ? '#4BCA81'
                        : step.status === 'in-progress'
                        ? '#0176D3'
                        : '#C9C9C9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {step.status === 'completed' ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  ) : step.status === 'in-progress' ? (
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        border: '2px solid white',
                      }}
                    />
                  )}
                </div>
                {!isLast && (
                  <div
                    style={{
                      width: '2px',
                      flex: 1,
                      minHeight: '40px',
                      backgroundColor: '#e5e5e5',
                      marginTop: '4px',
                    }}
                  />
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, paddingBottom: isLast ? 0 : '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h3
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#001e5b',
                      margin: 0,
                    }}
                  >
                    {step.title}
                  </h3>
                  {step.status === 'in-progress' && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#0176D3',
                        backgroundColor: '#D8EDFF',
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      In Progress
                    </span>
                  )}
                </div>
                <p
                  style={{
                    fontSize: '13px',
                    color: '#5c5c5c',
                    lineHeight: '1.5',
                    margin: 0,
                    marginBottom: '4px',
                  }}
                >
                  {step.description}
                </p>
                {step.timestamp && (
                  <span style={{ fontSize: '12px', color: '#706E6B' }}>
                    {step.timestamp}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
