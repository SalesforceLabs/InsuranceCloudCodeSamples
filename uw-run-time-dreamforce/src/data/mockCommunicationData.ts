// Mock data for Communication tab - shared across Submission and Submission Line pages

export const mockEmailThreads = [
  {
    id: 'email-1',
    from: 'Niki Paoloni',
    fromInitials: 'NP',
    subject: 'Request for insurance',
    preview: 'Hi, I hope this email finds you well. I am writing to request commercial property, general liability...',
    date: '9:30 PM',
    fullDate: 'May 12',
    unread: true,
    hasAttachment: true,
    to: 'You',
    body: `Hi,

I hope this email finds you well. I am writing to request commercial property, general liability, auto and Umbrella insurance for NexGen Biologics. Attached are the ACORD forms. Total insured value is $19,526,769. Please let me know if you need anything else.

Best,
Niki Paoloni`,
    attachments: [
      'NexGen Biologics- 2025 Acords.pdf',
      'SOV.xls'
    ]
  },
  {
    id: 'email-2',
    from: 'Sarah Chen',
    fromInitials: 'SC',
    subject: 'Re: Policy renewal discussion',
    preview: 'Thanks for reaching out. I reviewed the renewal terms and have a few questions about the coverage limits...',
    date: '8:15 PM',
    fullDate: 'May 12',
    unread: false,
    hasAttachment: false,
    to: 'You',
    body: `Thanks for reaching out. I reviewed the renewal terms and have a few questions about the coverage limits.

Can we schedule a call tomorrow to discuss the property coverage specifics? I want to make sure we're fully protected for the new warehouse expansion.

Best regards,
Sarah Chen`,
    attachments: []
  },
  {
    id: 'email-3',
    from: 'Michael Torres',
    fromInitials: 'MT',
    subject: 'Quote request - General Liability',
    preview: 'I need a quote for general liability coverage for our construction company. We have 50 employees...',
    date: '7:45 PM',
    fullDate: 'May 12',
    unread: true,
    hasAttachment: true,
    to: 'You',
    body: `I need a quote for general liability coverage for our construction company. We have 50 employees and work primarily on commercial projects.

Our annual revenue is approximately $8M. I've attached our current policy for reference.

Please let me know what you need from us to prepare a competitive quote.

Thanks,
Michael Torres`,
    attachments: [
      'Current_GL_Policy.pdf'
    ]
  },
  {
    id: 'email-4',
    from: 'Jennifer Liu',
    fromInitials: 'JL',
    subject: 'Certificate of Insurance - Urgent',
    preview: 'We need a certificate of insurance by end of day for the Morrison project. The general contractor is requesting...',
    date: '6:30 PM',
    fullDate: 'May 12',
    unread: false,
    hasAttachment: false,
    to: 'You, David Kim',
    body: `We need a certificate of insurance by end of day for the Morrison project. The general contractor is requesting proof of coverage before we can start work on Monday.

Policy number: CP-2024-8675
Project: Morrison Office Complex
GC: BuildRight Construction

Please send the COI to their email: permits@buildrightco.com

Thanks for your help!
Jennifer Liu`,
    attachments: []
  },
  {
    id: 'email-5',
    from: 'Robert Martinez',
    fromInitials: 'RM',
    subject: 'Workers Comp Audit Follow-up',
    preview: 'Following up on the workers comp audit we discussed last week. I have the payroll records ready...',
    date: '5:20 PM',
    fullDate: 'May 12',
    unread: false,
    hasAttachment: true,
    to: 'You',
    body: `Following up on the workers comp audit we discussed last week. I have the payroll records ready for your review.

Total payroll for audit period: $2.4M
Number of employees: 45
Primary class code: 8810

Let me know if you need anything else to complete the audit.

Best,
Robert Martinez`,
    attachments: [
      'Payroll_Records_2025.xlsx'
    ]
  }
];

export const mockSlackMessages = [
  {
    id: 'msg-1',
    sender: 'Niki Paoloni',
    senderInitials: 'NP',
    time: '9:30 AM',
    date: 'May 12',
    text: 'Hi team! Just submitted the new business request for NexGen Biologics. Total insured value is $19.5M across 4 lines of business.',
    reactions: [
      { emoji: '👍', count: 3 },
      { emoji: '👀', count: 2 }
    ]
  },
  {
    id: 'msg-2',
    sender: 'Alex Johnson',
    senderInitials: 'AJ',
    time: '9:35 AM',
    date: 'May 12',
    text: 'Thanks @Niki! I\'ll start reviewing the property values. The building coverage looks substantial.',
    reactions: []
  },
  {
    id: 'msg-3',
    sender: 'Maria Garcia',
    senderInitials: 'MG',
    time: '9:42 AM',
    date: 'May 12',
    text: 'I ran the initial clearance check - no red flags. Loss history looks clean for the past 3 years.',
    reactions: [
      { emoji: '✅', count: 5 }
    ]
  },
  {
    id: 'msg-4',
    sender: 'David Kim',
    senderInitials: 'DK',
    time: '10:15 AM',
    date: 'May 12',
    text: 'The L1 data extraction completed. Found some conflicting information between the ACORD forms and the SOV that needs manual review.',
    reactions: [
      { emoji: '⚠️', count: 2 }
    ]
  },
  {
    id: 'msg-5',
    sender: 'Sarah Chen',
    senderInitials: 'SC',
    time: '10:20 AM',
    date: 'May 12',
    text: 'I can help with the data reconciliation. What specific fields are showing conflicts?',
    reactions: []
  },
  {
    id: 'msg-6',
    sender: 'David Kim',
    senderInitials: 'DK',
    time: '10:22 AM',
    date: 'May 12',
    text: 'Main issues are in the Commercial Auto section - vehicle counts and driver information don\'t match between documents.',
    reactions: []
  },
  {
    id: 'msg-7',
    sender: 'Tom Wilson',
    senderInitials: 'TW',
    time: '11:05 AM',
    date: 'May 12',
    text: 'Just finished the class code review. NAICS codes are correct - 423140, 423420, 423430. Risk factors calculated.',
    reactions: [
      { emoji: '🎯', count: 4 }
    ]
  },
  {
    id: 'msg-8',
    sender: 'You',
    senderInitials: 'YO',
    time: '11:30 AM',
    date: 'May 12',
    text: 'Great progress team! Let\'s aim to have the quote ready by end of week. @Alex and @Sarah - can you two collaborate on resolving the auto data conflicts?',
    reactions: [
      { emoji: '👍', count: 6 }
    ]
  }
];
