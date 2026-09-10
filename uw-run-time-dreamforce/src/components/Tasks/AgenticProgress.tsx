import React, { useState } from 'react';

export interface AgenticStep {
  id: string;
  title: string;
  status: 'completed' | 'in-progress' | 'pending';
  timestamp: string;
  details?: React.ReactNode;
}

interface AgenticProgressProps {
  steps: AgenticStep[];
  showLastSteps?: number;
}

export const AgenticProgress: React.FC<AgenticProgressProps> = ({
  steps,
  showLastSteps = 5
}) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div style={{
        border: '1px solid #c9c9c9',
        borderRadius: '12px',
        padding: '12px',
        backgroundColor: 'white',
        marginBottom: '12px',
        maxHeight: '300px',
        overflowY: 'auto'
      }}>
        {/* Steps List - Show only completed and in-progress steps */}
        <div>
          {steps.filter(step => step.status !== 'pending').map((step, index, filteredSteps) => (
            <div
              key={step.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                marginBottom: index < filteredSteps.length - 1 ? '16px' : '0',
                paddingBottom: index < filteredSteps.length - 1 ? '16px' : '0',
                borderBottom: index < filteredSteps.length - 1 ? '1px solid #e5e5e5' : 'none'
              }}
            >
              {/* Status Icon */}
              <div style={{ flexShrink: 0, marginTop: '2px' }}>
                {step.status === 'completed' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#2E844A">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                )}
                {step.status === 'in-progress' && (
                  <svg width="20" height="20" viewBox="0 0 52 52" fill="#0176D3">
                    <path d="M26 6.2c-11 0-19.8 8.8-19.8 19.8S15 45.8 26 45.8 45.8 37 45.8 26 37 6.2 26 6.2zM26 42c-8.8 0-16-7.2-16-16s7.2-16 16-16 16 7.2 16 16-7.2 16-16 16z"/>
                    <path d="M27.5 14.8h-3.1v13.1l11.5 6.8 1.5-2.6-9.9-5.8z"/>
                  </svg>
                )}
              </div>

              {/* Step Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#001e5b',
                  marginBottom: '4px',
                  lineHeight: '18px'
                }}>
                  {step.title}
                </div>
                {step.details && (
                  <div style={{
                    fontSize: '12px',
                    color: '#5c5c5c',
                    lineHeight: '17px'
                  }}>
                    {step.details}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid #e5e5e5',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#001e5b', margin: 0 }}>
                Agentic Task Progress
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#5c5c5c">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div
              style={{
                padding: '24px',
                overflowY: 'auto',
                flex: 1
              }}
            >
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  style={{
                    marginBottom: '24px',
                    paddingBottom: '24px',
                    borderBottom: index < steps.length - 1 ? '1px solid #e5e5e5' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
                    {step.status === 'completed' && (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="#2E844A" style={{ flexShrink: 0, marginTop: '2px' }}>
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                    )}
                    {step.status === 'in-progress' && (
                      <div style={{ display: 'flex', gap: '2px', flexShrink: 0, marginTop: '2px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="url(#gradient-modal1)">
                          <defs>
                            <linearGradient id="gradient-modal1" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#9602c7"/>
                              <stop offset="100%" stopColor="#0250d9"/>
                            </linearGradient>
                          </defs>
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="url(#gradient-modal2)">
                          <defs>
                            <linearGradient id="gradient-modal2" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#9602c7"/>
                              <stop offset="100%" stopColor="#0250d9"/>
                            </linearGradient>
                          </defs>
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="url(#gradient-modal3)">
                          <defs>
                            <linearGradient id="gradient-modal3" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#9602c7"/>
                              <stop offset="100%" stopColor="#0250d9"/>
                            </linearGradient>
                          </defs>
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                      </div>
                    )}
                    {step.status === 'pending' && (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="#c9c9c9" style={{ flexShrink: 0, marginTop: '2px' }}>
                        <circle cx="12" cy="12" r="10" stroke="#c9c9c9" strokeWidth="2" fill="none"/>
                      </svg>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '16px', fontWeight: 600, color: '#001e5b', marginBottom: '4px' }}>
                        {step.title}
                      </div>
                      <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '4px' }}>
                        {step.timestamp}
                      </div>
                      {step.details && (
                        <div style={{ fontSize: '14px', color: '#5c5c5c', lineHeight: '20px' }}>
                          {step.details}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid #e5e5e5',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px'
              }}
            >
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #c9c9c9',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  color: '#001e5b',
                  fontSize: '14px',
                  fontWeight: 400,
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f3f3';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AgenticProgress;
