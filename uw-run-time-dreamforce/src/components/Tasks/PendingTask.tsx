import React, { useState } from 'react';
import AgenticProgress, { AgenticStep } from './AgenticProgress';

// Base path prefix for static assets under public/ (empty locally, set for GitHub Pages).
const ASSET_PREFIX = process.env.NEXT_PUBLIC_PAGES_BASE_PATH || '';

interface PendingTaskProps {
  id: string;
  title: string;
  assignedTo: string;
  parentLabel?: string;
  taskType: 'Stage Task' | 'Manually Created' | 'Dependent Task';
  progressType: 'agentic' | 'normal' | 'none';
  status: 'in-progress' | 'error' | 'pending' | 'completed' | 'on-hold';
  hideStatusBadge?: boolean;
  isManuallyCreated?: boolean;
  onHoldReason?: string;
  errorMessage?: string;
  description?: string;
  agenticSteps?: AgenticStep[];
  dependentOn?: string | string[];
  hideDependencyIcon?: boolean;
  agentName?: string;
  onLaunch?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDraftEmail?: () => void;
  onRunTask?: () => void;
  runTaskLabel?: string;
  onClassify?: () => void;
  onMarkComplete?: () => void;
  onRetry?: () => void;
}

export const PendingTask: React.FC<PendingTaskProps> = ({
  id,
  title,
  assignedTo,
  parentLabel = 'NexGen Biologics Inc New Business',
  taskType,
  progressType,
  status,
  hideStatusBadge = false,
  isManuallyCreated = false,
  onHoldReason,
  errorMessage,
  description,
  agenticSteps,
  dependentOn,
  hideDependencyIcon = false,
  agentName = 'Agentforce',
  onLaunch,
  onEdit,
  onDelete,
  onDraftEmail,
  onRunTask,
  runTaskLabel = 'Run',
  onClassify,
  onMarkComplete,
  onRetry
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDependencyTooltip, setShowDependencyTooltip] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const isActive = status === 'in-progress';
  const activeAnimationName = progressType === 'agentic' ? 'taskPulseAgentic' : 'taskPulseManual';

  return (
    <div
      className="slds-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        marginTop: '0',
        marginBottom: '4px',
        cursor: 'pointer',
        borderRadius: '12px',
        boxShadow: 'none',
        border: 'none',
        backgroundColor: isHovered ? '#eef4ff' : undefined,
        transition: 'background-color 0.15s ease',
        ...(isActive ? { animation: `${activeAnimationName} 2s ease-in-out infinite` } : {})
      }}
    >
      <style>{`
        @keyframes taskPulseAgentic {
          0%, 100% { box-shadow: 0 0 0 0 rgba(150, 2, 199, 0); }
          50% { box-shadow: 0 0 0 3px rgba(150, 2, 199, 0.16); }
        }
        @keyframes taskPulseManual {
          0%, 100% { box-shadow: 0 0 0 0 rgba(184, 92, 0, 0); }
          50% { box-shadow: 0 0 0 3px rgba(184, 92, 0, 0.16); }
        }
        @keyframes taskWorkingDot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes taskSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div className="slds-card__body slds-card__body_inner" style={{ padding: '12px 16px' }}>
        {/* Card Body - Click to expand */}
        <div onClick={toggleExpanded}>
        {/* Task Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {dependentOn && !hideDependencyIcon && (
              <div
                style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                onMouseEnter={() => setShowDependencyTooltip(true)}
                onMouseLeave={() => setShowDependencyTooltip(false)}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 52 52"
                  fill="#0176D3"
                  style={{ flexShrink: 0 }}
                  aria-hidden="true"
                >
                  <use href={`${ASSET_PREFIX}/assets/salesforce-lightning-design-system/icons/utility-sprite/svg/symbols.svg#level_down`} />
                </svg>
                {showDependencyTooltip && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginTop: '4px',
                    backgroundColor: '#001e5b',
                    color: 'white',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    whiteSpace: 'nowrap',
                    zIndex: 10000,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    pointerEvents: 'none'
                  }}>
                    Dependent on {dependentOn}
                    <div style={{
                      position: 'absolute',
                      top: '-4px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 0,
                      height: 0,
                      borderLeft: '4px solid transparent',
                      borderRight: '4px solid transparent',
                      borderBottom: '4px solid #001e5b'
                    }} />
                  </div>
                )}
              </div>
            )}
            <h3 style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#2e2e2e',
              margin: 0,
              lineHeight: '20px'
            }}>
              {title}
            </h3>
          </div>

          {/* Status Badge (top right) and Overflow Menu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!hideStatusBadge && (() => {
              if (status === 'error') {
                return (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#7a1f1f',
                    backgroundColor: '#fdecea',
                    border: '1px solid #c23934',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    lineHeight: '14px'
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#c23934">
                      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                    </svg>
                    Error
                  </span>
                );
              }
              if (status === 'in-progress') {
                if (progressType === 'agentic') {
                  return (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '10px',
                      lineHeight: '14px',
                      background: 'linear-gradient(to left, rgba(2, 80, 217, 0.12), rgba(150, 2, 199, 0.12))',
                      border: '1px solid #9602c7',
                      color: '#5a1a73'
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="url(#agenticBadgeGrad)">
                        <defs>
                          <linearGradient id="agenticBadgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#9602c7"/>
                            <stop offset="100%" stopColor="#0250d9"/>
                          </linearGradient>
                        </defs>
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                      In Progress
                    </span>
                  );
                }
                return (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#5c3a00',
                    backgroundColor: '#fef5e8',
                    border: '1px solid #f5b87c',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    lineHeight: '14px'
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#B85C00">
                      <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                    </svg>
                    In Progress
                  </span>
                );
              }
              if (status === 'on-hold') {
                return (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#3e3e3e',
                    backgroundColor: '#f3f3f3',
                    border: '1px solid #939393',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    lineHeight: '14px'
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#5c5c5c">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                    </svg>
                    On Hold
                  </span>
                );
              }
              if (status === 'pending') {
                return (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#014486',
                    backgroundColor: '#eaf3fc',
                    border: '1px solid #0176D3',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    lineHeight: '14px'
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#0176D3">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                    Manual Task
                  </span>
                );
              }
              if (status === 'completed') {
                return (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#1a4f2c',
                    backgroundColor: '#e7f5ec',
                    border: '1px solid #2E844A',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    lineHeight: '14px'
                  }}>
                    Completed
                  </span>
                );
              }
              return null;
            })()}

            {/* Menu Button - manually created tasks only */}
            {isManuallyCreated && (
              <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
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
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#001e5b">
                    <circle cx="12" cy="5" r="2"/>
                    <circle cx="12" cy="12" r="2"/>
                    <circle cx="12" cy="19" r="2"/>
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {showMenu && (
                  <>
                    <div
                      style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 9998
                      }}
                      onClick={() => setShowMenu(false)}
                    />
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '4px',
                      backgroundColor: 'white',
                      border: '1px solid #c9c9c9',
                      borderRadius: '4px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      minWidth: '120px',
                      zIndex: 9999
                    }}>
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          onEdit?.();
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: 'none',
                          background: 'none',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: '#001e5b',
                          display: 'block'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f3f3f3';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          onDelete?.();
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: 'none',
                          background: 'none',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: '#c23934',
                          display: 'block'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f3f3f3';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Subline */}
        <div style={{
          fontSize: '11px',
          color: '#5c5c5c',
          lineHeight: '14px',
          marginBottom: '4px'
        }}>
          {parentLabel} · {taskType} · Assigned To{' '}
          <span style={{ color: '#0176D3' }}>{assignedTo}</span>
        </div>

        {/* Agentforce working indicator (gradient text) — kept for in-progress agentic tasks */}
        {progressType === 'agentic' && status === 'in-progress' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            background: 'linear-gradient(to left, #0250d9, #9602c7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 400,
            marginBottom: '4px',
            lineHeight: '17px'
          }}>
            {agentName} is working{' '}
            <span style={{ display: 'inline-flex', gap: '2px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="url(#gradient1)" style={{ animation: 'taskWorkingDot 1.2s ease-in-out 0s infinite' }}>
                <defs>
                  <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#9602c7"/>
                    <stop offset="100%" stopColor="#0250d9"/>
                  </linearGradient>
                </defs>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="url(#gradient2)" style={{ animation: 'taskWorkingDot 1.2s ease-in-out 0.2s infinite' }}>
                <defs>
                  <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#9602c7"/>
                    <stop offset="100%" stopColor="#0250d9"/>
                  </linearGradient>
                </defs>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="url(#gradient3)" style={{ animation: 'taskWorkingDot 1.2s ease-in-out 0.4s infinite' }}>
                <defs>
                  <linearGradient id="gradient3" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#9602c7"/>
                    <stop offset="100%" stopColor="#0250d9"/>
                  </linearGradient>
                </defs>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </span>
          </div>
        )}

        {/* Error indicator — replaces the working byline; short description of the failure */}
        {status === 'error' && errorMessage && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px',
            fontSize: '12px',
            color: '#c23934',
            fontWeight: 400,
            marginBottom: '4px',
            lineHeight: '17px'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#c23934" style={{ flexShrink: 0, marginTop: '1px' }}>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Manual task in-progress indicator — rotating sync icon */}
        {progressType !== 'agentic' && status === 'in-progress' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: '#B85C00',
            fontWeight: 400,
            marginBottom: '4px',
            lineHeight: '17px'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#B85C00" style={{ animation: 'taskSpin 1.1s linear infinite', flexShrink: 0 }}>
              <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
            </svg>
            Task in progress
          </div>
        )}
        </div>

        {/* Expanded Content */}
        {isExpanded && (
        <div style={{ marginTop: '8px' }}>
          {/* Agentic Progress */}
          {progressType === 'agentic' && agenticSteps && agenticSteps.length > 0 && (
            <AgenticProgress steps={agenticSteps} showLastSteps={6} />
          )}

          {/* Description */}
          {description && (
            <div style={{
              fontSize: '12px',
              color: '#5c5c5c',
              lineHeight: '17px',
              marginBottom: '8px'
            }}>
              {description}
            </div>
          )}

          {/* Pending Reason */}
          {(status === 'on-hold' || status === 'pending') && onHoldReason && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              marginBottom: '8px',
              fontSize: '12px',
              color: '#5c5c5c',
              lineHeight: '17px',
              backgroundColor: '#f3f3f3',
              padding: '8px 12px',
              borderRadius: '4px',
              borderLeft: '3px solid #939393'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#5c5c5c" style={{ marginTop: '2px', flexShrink: 0 }}>
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
              <span><strong>On Hold:</strong> {onHoldReason}</span>
            </div>
          )}

          {/* Launch Button */}
          {onLaunch && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLaunch();
              }}
              style={{
                padding: '8px 24px',
                border: '2px solid #001e5b',
                borderRadius: '24px',
                backgroundColor: 'white',
                color: '#0176D3',
                fontSize: '16px',
                fontWeight: 400,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f3f3';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
              }}
            >
              Launch
            </button>
          )}
        </div>
        )}

        {/* Draft Email Footer Button - text-only, centered */}
        {onDraftEmail && (
          <div style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid #e5e5e5',
            display: 'flex',
            justifyContent: 'center'
          }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDraftEmail();
              }}
              style={{
                padding: 0,
                border: 'none',
                background: 'none',
                color: '#0176D3',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Draft Email
            </button>
          </div>
        )}

        {/* Classify Footer Button */}
        {onClassify && (
          <div style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid #e5e5e5',
            display: 'flex',
            justifyContent: 'center'
          }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClassify();
              }}
              style={{
                padding: 0,
                border: 'none',
                background: 'none',
                color: '#0176D3',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Classify
            </button>
          </div>
        )}

        {/* Mark Completed Footer Button */}
        {onMarkComplete && (
          <div style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid #e5e5e5',
            display: 'flex',
            justifyContent: 'center'
          }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkComplete();
              }}
              style={{
                padding: 0,
                border: 'none',
                background: 'none',
                color: '#0176D3',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Mark Completed
            </button>
          </div>
        )}

        {/* Retry Footer Button - error tasks */}
        {onRetry && (
          <div style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid #e5e5e5',
            display: 'flex',
            justifyContent: 'center'
          }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
              style={{
                padding: 0,
                border: 'none',
                background: 'none',
                color: '#0176D3',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Run Task Footer Button - manual tasks */}
        {onRunTask && (
          <div style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid #e5e5e5',
            display: 'flex',
            justifyContent: 'center'
          }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRunTask();
              }}
              style={{
                padding: 0,
                border: 'none',
                background: 'none',
                color: '#0176D3',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {runTaskLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingTask;
