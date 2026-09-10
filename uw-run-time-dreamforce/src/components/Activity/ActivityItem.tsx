import React, { useState } from 'react';
import AgenticProgress, { AgenticStep } from '../Tasks/AgenticProgress';

// Base path prefix for static assets under public/ (empty locally, set for GitHub Pages).
const ASSET_PREFIX = process.env.NEXT_PUBLIC_PAGES_BASE_PATH || '';

export interface ActivityItemProps {
  id: string;
  title: string;
  description: string;
  completedBy: string;
  timestamp: string;
  status: 'completed' | 'in-progress' | 'pending';
  icon?: React.ReactNode;
  isLast?: boolean;
  errorMessage?: string;
  warningMessage?: React.ReactNode;
  details?: string;
  detailsList?: React.ReactNode[];
  agenticSteps?: AgenticStep[];
  hideTimeline?: boolean;
  dependentOn?: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function ActivityItem({
  title,
  description,
  completedBy,
  timestamp,
  status,
  icon,
  isLast = false,
  errorMessage,
  warningMessage,
  details,
  detailsList,
  agenticSteps,
  hideTimeline = false,
  dependentOn,
  onEdit,
  onDelete
}: ActivityItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDependencyTooltip, setShowDependencyTooltip] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const hasWarning = status === 'completed' && !!warningMessage;

  const getIconBackgroundColor = () => {
    if (hasWarning) {
      return '#B85C00';
    }
    switch (status) {
      case 'completed':
        return '#2E844A';
      case 'in-progress':
        return '#0176D3';
      case 'pending':
        return '#939393';
      default:
        return '#939393';
    }
  };

  const defaultIcon = (
    <svg style={{ width: '10px', height: '10px', fill: 'white' }} viewBox="0 0 24 24">
      {hasWarning ? (
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
      ) : status === 'completed' ? (
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      ) : (
        <circle cx="12" cy="12" r="8" />
      )}
    </svg>
  );

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '8px', alignItems: 'flex-start' }}>
      {/* Timeline dot (outside the card, on the left) */}
      {!hideTimeline && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '16px',
          flexShrink: 0,
          position: 'relative',
          marginTop: '14px'
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: getIconBackgroundColor(),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 1
          }}>
            {icon || defaultIcon}
          </div>
        </div>
      )}

      {/* Card */}
      <div
        onClick={toggleExpanded}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="slds-card"
        style={{
          flex: 1,
          cursor: 'pointer',
          borderRadius: '12px',
          boxShadow: 'none',
          border: hideTimeline ? '1px solid #e5e5e5' : 'none',
          padding: '12px 16px',
          backgroundColor: isHovered ? '#eef4ff' : 'white',
          transition: 'background-color 0.15s ease',
          marginTop: 0,
          marginBottom: 0
        }}
      >
        {/* Content */}
        <div>
          {/* Header with title and timestamp */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
              {dependentOn && (
                <div
                  style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                  onMouseEnter={() => setShowDependencyTooltip(true)}
                  onMouseLeave={() => setShowDependencyTooltip(false)}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 52 52"
                    fill="#5c5c5c"
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

            {/* Timestamp and Menu */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                fontSize: '11px',
                fontWeight: 400,
                color: '#5c5c5c',
                whiteSpace: 'nowrap'
              }}>
                {timestamp}
              </div>

              {/* Menu Button */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(!showMenu);
                  }}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                      }}
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
                        onClick={(e) => {
                          e.stopPropagation();
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
                        onClick={(e) => {
                          e.stopPropagation();
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
            </div>
          </div>

          {/* Subline */}
          <div style={{
            fontSize: '11px',
            color: '#5c5c5c',
            lineHeight: '14px',
            marginBottom: '4px'
          }}>
            {description}
            {completedBy && (
              <>
                {' · Completed By '}
                <span style={{ color: '#0176D3' }}>{completedBy}</span>
              </>
            )}
          </div>

          {/* Warning Message - always visible */}
          {warningMessage && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              marginBottom: '4px',
              fontSize: '12px',
              color: '#B85C00',
              lineHeight: '17px'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#B85C00" style={{ marginTop: '2px', flexShrink: 0 }}>
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
              </svg>
              <span>{warningMessage}</span>
            </div>
          )}

          {/* Error Message - always visible */}
          {errorMessage && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              marginBottom: '4px',
              fontSize: '12px',
              color: '#c23934',
              lineHeight: '17px'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#c23934" style={{ marginTop: '2px', flexShrink: 0 }}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Expanded Content */}
          {isExpanded && (
            <div style={{ marginTop: '8px' }}>
              {/* Details heading */}
              {(details || (detailsList && detailsList.length > 0) || (agenticSteps && agenticSteps.length > 0)) && details && (
                <div style={{
                  fontSize: '12px',
                  color: '#5c5c5c',
                  lineHeight: '17px',
                  marginBottom: '8px'
                }}>
                  {details}
                </div>
              )}

              {/* Agentic Progress Panel */}
              {agenticSteps && agenticSteps.length > 0 && (
                <AgenticProgress steps={agenticSteps} showLastSteps={agenticSteps.length} />
              )}

              {/* Details list */}
              {detailsList && detailsList.length > 0 && (
                <ul style={{
                  margin: 0,
                  paddingLeft: '20px',
                  fontSize: '12px',
                  color: '#5c5c5c',
                  lineHeight: '17px'
                }}>
                  {detailsList.map((item, index) => (
                    <li key={index} style={{ marginBottom: '4px' }}>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
