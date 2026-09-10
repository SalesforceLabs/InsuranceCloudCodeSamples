import React, { useState, useEffect, useMemo } from 'react';

export interface NewTaskInput {
  id: string;
  title: string;
  type: 'manual';
  assignedTo: string;
  status: 'in-progress' | 'pending';
  priority: 'High' | 'Medium' | 'Low';
  dueDate: string;
  description: string;
  activityType: string;
  hasDraftEmail: boolean;
}

interface PredefinedActivity {
  name: string;
  description: string;
  hasDraftEmail?: boolean;
}

const PREDEFINED_ACTIVITIES: PredefinedActivity[] = [
  {
    name: 'Data Completion Check',
    description: 'Reviewing the submission to confirm all required information has been provided. Includes verifying legal entity name, FEIN/Tax ID, business address, business profile (SIC/NAICS code, business description, years in business), and broker information.',
  },
  {
    name: 'Appetite Check',
    description: 'Evaluating whether this submission fits within the carrier\'s underwriting appetite — class code on the approved list, revenue within target size range, operating states within geographic footprint.',
  },
  {
    name: 'Clearance Check',
    description: 'Verifying the submission is eligible to be quoted: duplicate-submission check, producer appointment and license, prior-decline check within the last 12–24 months.',
  },
  {
    name: 'Get Information from Broker',
    description: 'Reach out to the producer to request information missing from the submission required to complete qualifying checks or extraction.',
    hasDraftEmail: true,
  },
  {
    name: 'Complete Data Extraction',
    description: 'Performs end-to-end extraction across all submission documents and creates the corresponding submission lines in Salesforce.',
  },
  {
    name: 'Risk Evaluation',
    description: 'Assess the risk profile of the insured: loss history, exposure analysis, occupancy/operations review, and protection class.',
  },
  {
    name: 'Loss Run Review',
    description: 'Review prior-policy loss runs for frequency, severity, and trends. Flag large losses, open claims, and patterns that warrant pricing or terms adjustments.',
  },
  {
    name: 'Quote Preparation',
    description: 'Build the indication or quote: rate the exposures, apply credits/debits, select forms and endorsements, and document the rationale.',
  },
  {
    name: 'Reinsurance Review',
    description: 'Confirm the risk fits the treaty, identify any facultative needs, and obtain quotes from facultative markets if required.',
  },
  {
    name: 'Referral / Approval',
    description: 'Refer the submission to the appropriate authority for approval (large account referral, off-appetite exception, or coverage authority sign-off).',
  },
];

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (task: NewTaskInput) => void;
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const [title, setTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState('Martha (UW Team Lead)');
  const [status, setStatus] = useState<'in-progress' | 'pending'>('pending');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [activityType, setActivityType] = useState('');
  const [activityQuery, setActivityQuery] = useState('');
  const [showActivityDropdown, setShowActivityDropdown] = useState(false);
  const [hasDraftEmail, setHasDraftEmail] = useState(false);

  const filteredActivities = useMemo(() => {
    const q = activityQuery.trim().toLowerCase();
    if (!q) return PREDEFINED_ACTIVITIES;
    return PREDEFINED_ACTIVITIES.filter((a) => a.name.toLowerCase().includes(q));
  }, [activityQuery]);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setAssignedTo('Martha (UW Team Lead)');
      setStatus('pending');
      setPriority('Medium');
      setDueDate('');
      setDescription('');
      setActivityType('');
      setActivityQuery('');
      setShowActivityDropdown(false);
      setHasDraftEmail(false);
    }
  }, [isOpen]);

  const handleSelectActivity = (activity: PredefinedActivity) => {
    setActivityType(activity.name);
    setActivityQuery(activity.name);
    setShowActivityDropdown(false);
    if (!title.trim()) setTitle(activity.name);
    if (!description.trim()) setDescription(activity.description);
    setHasDraftEmail(!!activity.hasDraftEmail);
  };

  if (!isOpen) return null;

  const handleSave = () => {
    if (!title.trim()) return;
    onSave?.({
      id: `task-${Date.now()}`,
      title: title.trim(),
      type: 'manual',
      assignedTo,
      status,
      priority,
      dueDate,
      description: description.trim(),
      activityType,
      hasDraftEmail
    });
    onClose();
  };

  const fieldRow: React.CSSProperties = {
    marginBottom: '16px'
  };

  const fieldLabel: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    color: '#5c5c5c',
    marginBottom: '4px',
    fontWeight: 600
  };

  const fieldRequired: React.CSSProperties = {
    color: '#c23934',
    marginRight: '2px'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 10px',
    fontSize: '13px',
    color: '#2e2e2e',
    border: '1px solid #c9c9c9',
    borderRadius: '4px',
    outline: 'none',
    fontFamily: 'inherit',
    backgroundColor: 'white',
    boxSizing: 'border-box'
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
          width: '560px',
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
            padding: '16px 24px',
            borderBottom: '1px solid #e5e5e5',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#001e5b', margin: 0 }}>
            New Task
          </h2>
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#5c5c5c">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          <div style={fieldRow}>
            <label style={fieldLabel}>Activity</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={activityQuery}
                onChange={(e) => {
                  setActivityQuery(e.target.value);
                  setShowActivityDropdown(true);
                }}
                onFocus={() => setShowActivityDropdown(true)}
                onBlur={() => setTimeout(() => setShowActivityDropdown(false), 150)}
                placeholder="Search activities..."
                style={inputStyle}
                autoFocus
              />
              {showActivityDropdown && filteredActivities.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '2px',
                    backgroundColor: 'white',
                    border: '1px solid #c9c9c9',
                    borderRadius: '4px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    zIndex: 10
                  }}
                >
                  {filteredActivities.map((activity) => (
                    <div
                      key={activity.name}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectActivity(activity);
                      }}
                      style={{
                        padding: '8px 12px',
                        fontSize: '13px',
                        color: '#2e2e2e',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f3f3f3'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f3f3f3';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'white';
                      }}
                    >
                      {activity.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={fieldRow}>
            <label style={fieldLabel}>
              <span style={fieldRequired}>*</span>Subject
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Review loss runs"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={fieldRow}>
              <label style={fieldLabel}>Assigned To</label>
              <input
                type="text"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={fieldRow}>
              <label style={fieldLabel}>Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={fieldRow}>
              <label style={fieldLabel}>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'in-progress' | 'pending')}
                style={inputStyle}
              >
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
              </select>
            </div>

            <div style={fieldRow}>
              <label style={fieldLabel}>Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'High' | 'Medium' | 'Low')}
                style={inputStyle}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>

          <div style={fieldRow}>
            <label style={fieldLabel}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs to be done?"
              rows={4}
              style={{
                ...inputStyle,
                resize: 'vertical',
                minHeight: '80px',
                lineHeight: '18px'
              }}
            />
          </div>

        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid #e5e5e5',
            backgroundColor: '#fafafa',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px'
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              border: '1px solid #c9c9c9',
              borderRadius: '4px',
              backgroundColor: 'white',
              color: '#001e5b',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            style={{
              padding: '8px 20px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: title.trim() ? '#0176D3' : '#c9c9c9',
              color: 'white',
              fontSize: '13px',
              fontWeight: 600,
              cursor: title.trim() ? 'pointer' : 'not-allowed'
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewTaskModal;
