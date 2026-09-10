import React from 'react';
import { Icon } from '@salesforce/design-system-react';

interface CommunicationTabProps {
  emailThreads: any[];
  slackMessages: any[];
  selectedCommTab: 'email' | 'slack';
  setSelectedCommTab: (tab: 'email' | 'slack') => void;
  selectedEmailId: string;
  setSelectedEmailId: (id: string) => void;
  expandedEmailIds: Set<string>;
  setExpandedEmailIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedSlackThreadId: string;
  setSelectedSlackThreadId: (id: string) => void;
  contextName: string;
}

export const CommunicationTab: React.FC<CommunicationTabProps> = ({
  emailThreads,
  slackMessages,
  selectedCommTab,
  setSelectedCommTab,
  selectedEmailId,
  setSelectedEmailId,
  expandedEmailIds,
  setExpandedEmailIds,
  selectedSlackThreadId,
  setSelectedSlackThreadId,
  contextName
}) => {
  const selectedEmail = emailThreads.find(e => e.id === selectedEmailId);
  const channelName = contextName;
  const threadMessages = [...emailThreads].reverse();
  const latestMessage = emailThreads[0];
  const threadSubject = (latestMessage?.subject || '').replace(/^Re:\\s*/i, '');
  const threadParticipants = Array.from(
    new Set(emailThreads.map((e: any) => e.from))
  );
  
  const isMessageExpanded = (msgId: string) => {
    if (expandedEmailIds.has(msgId)) return true;
    if (expandedEmailIds.has(`!${msgId}`)) return false;
    return msgId === latestMessage?.id;
  };
  
  const toggleMessage = (msgId: string) => {
    setExpandedEmailIds((prev) => {
      const next = new Set(prev);
      const expanded = isMessageExpanded(msgId);
      next.delete(msgId);
      next.delete(`!${msgId}`);
      if (expanded) {
        next.add(`!${msgId}`);
      } else {
        next.add(msgId);
      }
      return next;
    });
  };

  return (
<div style={{ display: 'flex', flex: 1 }}>
  {/* Vertical Icon Tabs */}
  <div style={{
    width: '56px',
    borderRight: '1px solid #e5e5e5',
    backgroundColor: '#fafafa',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: '12px',
    gap: '8px',
    flexShrink: 0
  }}>
    {/* Email Tab */}
    <button
      onClick={() => setSelectedCommTab('email')}
      title="Email"
      style={{
        width: '40px',
        height: '40px',
        border: 'none',
        borderRadius: '8px',
        backgroundColor: selectedCommTab === 'email' ? '#0176D3' : 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 0.2s'
      }}
      onMouseEnter={(e) => {
        if (selectedCommTab !== 'email') {
          e.currentTarget.style.backgroundColor = '#e5e5e5';
        }
      }}
      onMouseLeave={(e) => {
        if (selectedCommTab !== 'email') {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      <svg style={{ width: '20px', height: '20px', fill: selectedCommTab === 'email' ? 'white' : '#5c5c5c' }} viewBox="0 0 24 24">
        <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
      </svg>
    </button>

    {/* Slack Tab */}
    <button
      onClick={() => setSelectedCommTab('slack')}
      title="Slack"
      style={{
        width: '40px',
        height: '40px',
        border: 'none',
        borderRadius: '8px',
        backgroundColor: selectedCommTab === 'slack' ? '#0176D3' : 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 0.2s',
        padding: 0
      }}
      onMouseEnter={(e) => {
        if (selectedCommTab !== 'slack') {
          e.currentTarget.style.backgroundColor = '#e5e5e5';
        }
      }}
      onMouseLeave={(e) => {
        if (selectedCommTab !== 'slack') {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      <Icon
        assistiveText={{ label: 'Slack' }}
        category="utility"
        name="slack"
        size="x-small"
        colorVariant={selectedCommTab === 'slack' ? 'default' : 'default'}
        style={{ fill: selectedCommTab === 'slack' ? 'white' : '#5c5c5c' }}
      />
    </button>
  </div>

  {/* Left Column - Single Thread Card (only for email) */}
  {selectedCommTab === 'email' && latestMessage && (
    <div style={{
      width: '320px',
      borderRight: '1px solid #e5e5e5',
      flexShrink: 0
    }}>
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #e5e5e5',
          cursor: 'pointer',
          backgroundColor: '#f3f3f3'
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          {/* Avatar */}
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: '#E0E5EE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 600,
            color: '#001e5b',
            flexShrink: 0
          }}>
            {latestMessage.fromInitials}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Header row - participants + count + date */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
              <span style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#001e5b',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                marginRight: '8px'
              }}>
                {threadParticipants.join(', ')}
                {threadMessages.length > 1 && (
                  <span style={{ color: '#5c5c5c', fontWeight: 400 }}>
                    {' '}({threadMessages.length})
                  </span>
                )}
              </span>
              <span style={{
                fontSize: '11px',
                color: '#5c5c5c',
                whiteSpace: 'nowrap'
              }}>
                {latestMessage.date}
              </span>
            </div>

            {/* Subject */}
            <div style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#001e5b',
              marginBottom: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {threadSubject}
            </div>

            {/* Preview - latest message */}
            <div style={{
              fontSize: '12px',
              color: '#5c5c5c',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              {threadMessages.some((m) => m.hasAttachment) && (
                <svg style={{ width: '14px', height: '14px', fill: '#5c5c5c', flexShrink: 0 }} viewBox="0 0 24 24">
                  <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
                </svg>
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {latestMessage.preview}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )}

  {/* Right Column - Thread View (Gmail-style collapsible messages) */}
  {selectedCommTab === 'email' && latestMessage && (
    <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
      {/* Thread Subject */}
      <div style={{
        fontSize: '20px',
        fontWeight: 400,
        color: '#2e2e2e',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '1px solid #e5e5e5'
      }}>
        {threadSubject}
        <span style={{ fontSize: '13px', color: '#5c5c5c', marginLeft: '8px' }}>
          ({threadMessages.length})
        </span>
      </div>

      {/* Thread Messages (oldest first, latest at bottom) */}
      {threadMessages.map((msg, idx) => {
        const expanded = isMessageExpanded(msg.id);
        return (
          <div
            key={msg.id}
            style={{
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              marginBottom: '8px',
              backgroundColor: 'white',
              overflow: 'hidden'
            }}
          >
            {/* Collapsible Header */}
            <div
              onClick={() => toggleMessage(msg.id)}
              style={{
                display: 'flex',
                gap: '12px',
                padding: '12px 16px',
                cursor: 'pointer',
                alignItems: 'center'
              }}
            >
              {/* Avatar */}
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#E0E5EE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 600,
                color: '#001e5b',
                flexShrink: 0
              }}>
                {msg.fromInitials}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {expanded ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#001e5b' }}>
                        {msg.from}
                      </span>
                      <span style={{ fontSize: '12px', color: '#5c5c5c' }}>
                        {msg.date} · {msg.fullDate}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#5c5c5c' }}>
                      to {msg.to}
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
                    <div style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '13px'
                    }}>
                      <span style={{ fontWeight: 600, color: '#001e5b', marginRight: '8px' }}>
                        {msg.from}
                      </span>
                      <span style={{ color: '#5c5c5c' }}>
                        {msg.preview}
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#5c5c5c', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {msg.date}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Expanded Body */}
            {expanded && (
              <div style={{ padding: '0 16px 16px 60px' }}>
                {/* Body */}
                <div style={{
                  fontSize: '13px',
                  color: '#2e2e2e',
                  whiteSpace: 'pre-wrap',
                  lineHeight: '18px',
                  marginBottom: '12px'
                }}>
                  {msg.body}
                </div>

                {/* Attachments */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    {msg.attachments.map((attachment: any, index: number) => (
                      <div
                        key={index}
                        style={{
                          backgroundColor: 'white',
                          border: '1px solid #c9c9c9',
                          borderRadius: '12px',
                          padding: '4px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12px',
                          height: '26px'
                        }}
                      >
                        <svg style={{ width: '14px', height: '14px', fill: '#001e5b' }} viewBox="0 0 52 52">
                          <path d="M43.1 19.7l-12-12c-.3-.3-.7-.4-1.1-.4H13c-1.1 0-2 .9-2 2v33c0 1.1.9 2 2 2h26c1.1 0 2-.9 2-2V20.8c0-.4-.2-.8-.5-1.1zM32 11.4l7.6 7.6H32v-7.6z"/>
                        </svg>
                        {attachment}
                      </div>
                    ))}
                  </div>
                )}

                {/* Action buttons - only on the latest message */}
                {idx === threadMessages.length - 1 && (
                  <div style={{ display: 'flex', gap: '24px' }}>
                    <button className="slds-button slds-button_neutral" style={{ fontSize: '13px', padding: '4px 0', border: 'none', background: 'none', color: '#0250d9' }}>Reply</button>
                    <button className="slds-button slds-button_neutral" style={{ fontSize: '13px', padding: '4px 0', border: 'none', background: 'none', color: '#0250d9' }}>Reply All</button>
                    <button className="slds-button slds-button_neutral" style={{ fontSize: '13px', padding: '4px 0', border: 'none', background: 'none', color: '#0250d9' }}>Forward</button>
                    <button className="slds-button slds-button_neutral" style={{ fontSize: '13px', padding: '4px 0', border: 'none', background: 'none', color: '#0250d9' }}>Comment</button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  )}

  {/* Slack - Full width channel view */}
  {selectedCommTab === 'slack' && (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'white' }}>
      {/* Channel Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #e5e5e5',
        backgroundColor: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <Icon
          assistiveText={{ label: 'Channel' }}
          category="utility"
          name="slack"
          size="x-small"
        />
        <span style={{ fontSize: '16px', fontWeight: 700, color: '#001e5b' }}>
          {channelName}
        </span>
        <span style={{ fontSize: '13px', color: '#5c5c5c', marginLeft: '8px' }}>
          {slackMessages.length} messages
        </span>
      </div>

      {/* Messages Area */}
      <div style={{
        flex: 1,
        padding: '16px',
        backgroundColor: 'white'
      }}>
        {slackMessages.map((message, index) => {
          const showDateDivider = index === 0 || slackMessages[index - 1].date !== message.date;

          return (
            <React.Fragment key={message.id}>
              {/* Date Divider */}
              {showDateDivider && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  margin: '16px 0',
                  gap: '12px'
                }}>
                  <div style={{
                    flex: 1,
                    height: '1px',
                    backgroundColor: '#e5e5e5'
                  }}/>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#001e5b',
                    padding: '2px 8px',
                    border: '1px solid #e5e5e5',
                    borderRadius: '16px',
                    backgroundColor: 'white'
                  }}>
                    {message.date}
                  </span>
                  <div style={{
                    flex: 1,
                    height: '1px',
                    backgroundColor: '#e5e5e5'
                  }}/>
                </div>
              )}

              {/* Message */}
              <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '12px',
                padding: '8px',
                borderRadius: '4px',
                transition: 'background-color 0.1s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#fafafa';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}>
                {/* Avatar */}
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '4px',
                  backgroundColor: '#E0E5EE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#001e5b',
                  flexShrink: 0
                }}>
                  {message.senderInitials}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Sender and time */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#001e5b' }}>
                      {message.sender}
                    </span>
                    <span style={{ fontSize: '12px', color: '#5c5c5c' }}>
                      {message.time}
                    </span>
                  </div>

                  {/* Message text */}
                  <div style={{
                    fontSize: '15px',
                    color: '#1d1c1d',
                    lineHeight: '1.5',
                    wordBreak: 'break-word'
                  }}>
                    {message.text}
                  </div>

                  {/* Reactions */}
                  {message.reactions.length > 0 && (
                    <div style={{
                      display: 'flex',
                      gap: '6px',
                      marginTop: '6px',
                      flexWrap: 'wrap'
                    }}>
                      {message.reactions.map((reaction: any, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            border: '1px solid #c9c9c9',
                            borderRadius: '12px',
                            backgroundColor: 'white',
                            fontSize: '13px',
                            cursor: 'pointer'
                          }}
                        >
                          <span>{reaction.emoji}</span>
                          <span style={{ fontSize: '12px', color: '#5c5c5c', fontWeight: 600 }}>
                            {reaction.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Message Input */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid #e5e5e5',
        backgroundColor: 'white'
      }}>
        <div style={{
          border: '1px solid #c9c9c9',
          borderRadius: '8px',
          padding: '12px',
          backgroundColor: 'white'
        }}>
          <input
            type="text"
            placeholder={`Message ${channelName}`}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              fontSize: '15px',
              color: '#001e5b',
              fontFamily: 'inherit'
            }}
          />
        </div>
      </div>
    </div>
  )}
</div>
  );
};
