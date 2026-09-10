import React, { useState } from 'react';

interface EmailComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTo?: string;
  defaultCc?: string;
  defaultSubject?: string;
  defaultBody?: string;
  onSend?: (email: { to: string; cc: string; subject: string; body: string }) => void;
}

export const EmailComposerModal: React.FC<EmailComposerModalProps> = ({
  isOpen,
  onClose,
  defaultTo = '',
  defaultCc = '',
  defaultSubject = '',
  defaultBody = '',
  onSend
}) => {
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState(defaultCc);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [showCc, setShowCc] = useState(!!defaultCc);

  React.useEffect(() => {
    if (isOpen) {
      setTo(defaultTo);
      setCc(defaultCc);
      setSubject(defaultSubject);
      setBody(defaultBody);
      setShowCc(!!defaultCc);
    }
  }, [isOpen, defaultTo, defaultCc, defaultSubject, defaultBody]);

  if (!isOpen) return null;

  const handleSend = () => {
    onSend?.({ to, cc, subject, body });
    onClose();
  };

  const inputBase: React.CSSProperties = {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '13px',
    color: '#2e2e2e',
    backgroundColor: 'transparent',
    padding: '8px 0',
    fontFamily: 'inherit'
  };

  const fieldRow: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 16px',
    borderBottom: '1px solid #e5e5e5',
    minHeight: '40px'
  };

  const fieldLabel: React.CSSProperties = {
    fontSize: '13px',
    color: '#5c5c5c',
    fontWeight: 600,
    width: '60px',
    flexShrink: 0
  };

  return (
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
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          width: '720px',
          maxWidth: '90%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.24)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#001e5b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
            </svg>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>New Email</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={onClose}
              title="Minimize"
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M19 13H5v-2h14v2z"/>
              </svg>
            </button>
            <button
              onClick={onClose}
              title="Close"
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: '#f3f3f3',
            borderBottom: '1px solid #e5e5e5'
          }}
        >
          <button
            style={{
              padding: '4px 12px',
              border: '1px solid #c9c9c9',
              borderRadius: '4px',
              backgroundColor: 'white',
              color: '#001e5b',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#0176D3">
              <path d="M20.41 4.94l-1.35-1.35c-.78-.78-2.05-.78-2.83 0L13.41 6.41 17.59 10.59 20.41 7.77c.78-.79.78-2.05 0-2.83zM3 17.25V21h3.75L17.81 9.94 14.06 6.19 3 17.25z"/>
            </svg>
            Templates
          </button>
          <span style={{ fontSize: '12px', color: '#5c5c5c' }}>|</span>
          <span style={{ fontSize: '12px', color: '#5c5c5c' }}>From: <strong style={{ color: '#001e5b' }}>Martha (UW Team Lead)</strong></span>
        </div>

        {/* Fields */}
        <div style={fieldRow}>
          <span style={fieldLabel}>To</span>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={inputBase}
            placeholder="Recipient email"
          />
          {!showCc && (
            <button
              onClick={() => setShowCc(true)}
              style={{
                border: 'none',
                background: 'none',
                color: '#0176D3',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Cc
            </button>
          )}
        </div>
        {showCc && (
          <div style={fieldRow}>
            <span style={fieldLabel}>Cc</span>
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              style={inputBase}
              placeholder="Cc"
            />
          </div>
        )}
        <div style={fieldRow}>
          <span style={fieldLabel}>Subject</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={inputBase}
            placeholder="Subject"
          />
        </div>

        {/* Formatting toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            backgroundColor: '#fafafa',
            borderBottom: '1px solid #e5e5e5'
          }}
        >
          {[
            { label: 'B', style: { fontWeight: 700 } },
            { label: 'I', style: { fontStyle: 'italic' } },
            { label: 'U', style: { textDecoration: 'underline' } },
          ].map((btn) => (
            <button
              key={btn.label}
              style={{
                width: '28px',
                height: '28px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: 'transparent',
                color: '#001e5b',
                fontSize: '13px',
                cursor: 'pointer',
                ...btn.style
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e5e5e5'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {btn.label}
            </button>
          ))}
          <span style={{ width: '1px', height: '20px', backgroundColor: '#c9c9c9', margin: '0 4px' }} />
          {[
            { icon: <path d="M3 17h18v2H3zm0-7h18v2H3zm0-7v2h18V3z"/>, title: 'Align' },
            { icon: <path d="M3 4h18v2H3zm3 4h12v2H6zm-3 4h18v2H3zm3 4h12v2H6zm-3 4h18v2H3z"/>, title: 'List' },
            { icon: <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>, title: 'Link' },
          ].map((btn, i) => (
            <button
              key={i}
              title={btn.title}
              style={{
                width: '28px',
                height: '28px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e5e5e5'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#5c5c5c">
                {btn.icon}
              </svg>
            </button>
          ))}
        </div>

        {/* Body */}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            padding: '16px',
            fontSize: '13px',
            color: '#2e2e2e',
            lineHeight: '20px',
            resize: 'none',
            minHeight: '300px',
            fontFamily: 'inherit'
          }}
          placeholder="Write your message..."
        />

        {/* Footer */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #e5e5e5',
            backgroundColor: '#fafafa',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleSend}
              style={{
                padding: '8px 24px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: '#0176D3',
                color: 'white',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Send
            </button>
            <button
              title="Attach file"
              style={{
                width: '32px',
                height: '32px',
                border: '1px solid #c9c9c9',
                borderRadius: '4px',
                backgroundColor: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#5c5c5c">
                <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
              </svg>
            </button>
            <button
              title="Insert link"
              style={{
                width: '32px',
                height: '32px',
                border: '1px solid #c9c9c9',
                borderRadius: '4px',
                backgroundColor: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#5c5c5c">
                <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
              </svg>
            </button>
          </div>
          <button
            onClick={onClose}
            title="Discard"
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#5c5c5c">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailComposerModal;
