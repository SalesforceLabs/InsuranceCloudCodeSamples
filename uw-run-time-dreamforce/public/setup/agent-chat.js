// ═══════════════════════════════════════════════════════════════
// AGENT CHAT - Realistic Step-by-Step Conversation
// ═══════════════════════════════════════════════════════════════

let conversationIndex = 0;
let isTyping = false;

// Conversation script - Stage-by-stage configuration
const conversation = [
  {
    role: 'agent',
    delay: 1000,
    text: `Hello! I'm your Underwriting Setup Assistant. I can help you configure various aspects of your underwriting system.

What would you like to set up today?`,
    options: [
      { label: 'Set Up Activities', value: 'activities' },
      { label: 'Set Up Email Ingestion', value: 'email' },
      { label: 'Set Up Integrations', value: 'integrations' },
      { label: 'Set Up Document Ingestion', value: 'documents' }
    ]
  },
  {
    role: 'user',
    text: 'Set Up Activities'
  },
  {
    role: 'agent',
    delay: 1000,
    text: `Great choice! Activity Management is the foundation of your underwriting workflow.

What type of underwriting activities would you like to configure?`,
    options: [
      { label: 'Commercial Property', value: 'commercial' },
      { label: 'Auto Insurance', value: 'auto' },
      { label: 'Workers Compensation', value: 'workers-comp' },
      { label: 'Custom Configuration', value: 'custom' }
    ]
  },
  {
    role: 'user',
    text: 'Commercial Property'
  },
  {
    role: 'agent',
    delay: 1500,
    text: `Perfect! I'll help you set up a complete Activity Management system for Commercial Property underwriting.

Let me analyze your requirements and create a comprehensive plan...`
  },
  {
    role: 'agent',
    delay: 2000,
    text: `I've created a plan for your Commercial Property underwriting workflow.

**Configuration Overview:**

**5 Stages:**
1. Submission Review
2. Property Inspection
3. Risk Assessment
4. Underwriting Decision
5. Quote Generation

**11 Activities Required:**
- Loss History Review (Integration Procedure)
- Property Valuation Check (Integration Procedure)
- Compliance Document Verification (Flow)
- Occupancy Classification (Omniscript)
- Hazard Analysis (Flow)
- D&B Credit Check (Integration Procedure)
- Risk Score Calculation (Integration Procedure)
- Underwriter Review (Omniscript)
- Approval Workflow (Flow)
- Quote Generation (Integration Procedure)
- Broker Notification (Flow)

**Approach:**
I'll guide you through configuring each stage one at a time, creating the necessary Salesforce processes (Flows, Integration Procedures) and Activities as we go.

Shall we proceed with this plan?`,
    options: [
      { label: 'Yes, let\'s start', value: 'yes' },
      { label: 'Modify the plan', value: 'modify' },
      { label: 'Show more details', value: 'details' }
    ]
  },
  {
    role: 'user',
    text: 'Yes, let\'s start'
  },
  {
    role: 'agent',
    text: `Perfect! Let's begin with **Stage 1: Submission Review**

This stage handles initial document collection and validation when a submission first arrives.

**Activities needed for this stage:**
1. Loss History Review - Retrieves 5-year loss history
2. Property Valuation Check - Validates property value
3. Compliance Document Verification - Checks required documents

Let's start by creating the first activity: **Loss History Review**

This activity needs an Integration Procedure to call an external service (like ISO or Verisk) to retrieve loss history data.

Should I help you create the Integration Procedure first?`,
    options: [
      { label: 'Yes, create the Integration Procedure', value: 'yes' },
      { label: 'I already have one', value: 'have' },
      { label: 'Skip this activity', value: 'skip' }
    ]
  },
  {
    role: 'user',
    text: 'Yes, create the Integration Procedure'
  },
  {
    role: 'agent',
    delay: 1000,
    text: `Great! I'll create an Integration Procedure for retrieving loss history.

**Creating Integration Procedure...**

**Thinking through the design:**
- Input: Property Address, Policy Holder Name, Date Range
- External Service: ISO ClaimSearch API
- Output: List of claims with dates, amounts, and types
- Error Handling: Return empty list if service unavailable`
  },
  {
    role: 'agent',
    delay: 2000,
    text: `I'm configuring the Integration Procedure with the following elements:

**Step 1:** Set Values - Prepare request parameters
**Step 2:** HTTP Action - Call ISO ClaimSearch API
**Step 3:** Transform Data - Parse JSON response
**Step 4:** Set Values - Map to Salesforce fields
**Step 5:** Response Action - Return structured data`
  },
  {
    role: 'agent',
    delay: 2000,
    text: `Integration Procedure created successfully:`,
    record: {
      icon: '⚡',
      title: 'CProp_LossHistory_IP',
      fields: [
        { label: 'Name', value: 'CProp_LossHistory_IP' },
        { label: 'Type', value: 'Integration Procedure' },
        { label: 'Sub Type', value: 'REST' },
        { label: 'Language', value: 'English' },
        { label: 'Is Active', value: 'Yes' },
        { label: 'Created Date', value: '5/19/2026, 11:45 AM' }
      ]
    }
  },
  {
    role: 'agent',
    delay: 1000,
    text: `Now that we have the Integration Procedure, let's create the **Loss History Review** activity in your Activities library.

This activity will reference the Integration Procedure we just created.

**Activity Configuration:**
- Name: Loss History Review
- Description: Retrieves and analyzes 5-year loss history for the property
- Process Type: Integration Procedure
- Process: CProp_LossHistory_IP

Creating activity...`
  },
  {
    role: 'agent',
    delay: 1500,
    text: `Activity created successfully:`,
    record: {
      icon: '📋',
      title: 'Loss History Review',
      fields: [
        { label: 'Activity Name', value: 'Loss History Review' },
        { label: 'Type', value: 'Integration Procedure' },
        { label: 'Process Name', value: 'CProp_LossHistory_IP' },
        { label: 'Description', value: 'Retrieves and analyzes 5-year loss history for the property' },
        { label: 'Created Date', value: '5/19/2026, 11:46 AM' }
      ]
    }
  },
  {
    role: 'agent',
    delay: 1000,
    text: `Excellent! Now let's configure how this activity will be used in **Stage 1: Submission Review**

**Configuration Options:**

**Availability:** When should this activity be available?
- On Stage Change (automatic when entering stage)
- Manual (underwriter decides when to run)
- Conditional (based on submission data)

**Trigger:** When should it execute?
- Automatic (runs immediately when available)
- Manual (underwriter clicks to execute)
- Conditional (based on rules)

**Mandatory:** Should this activity be required before moving to the next stage?

For Loss History Review, I recommend:
- Availability: On Stage Change
- Trigger: Automatic
- Mandatory: Yes

But you might want to add a condition. For example, only retrieve loss history for properties above a certain value, or only for certain policy types.

Would you like to add a conditional rule for when this activity should appear?`,
    options: [
      { label: 'Yes, add a condition', value: 'yes' },
      { label: 'No, make it always available', value: 'no' },
      { label: 'Show examples first', value: 'examples' }
    ]
  },
  {
    role: 'user',
    text: 'Yes, add a condition'
  },
  {
    role: 'agent',
    text: `Great! Let's add a condition for when Loss History Review should be available.

You can describe the condition in plain language, and I'll translate it to a Salesforce formula.

**Examples:**
- "Only when property value exceeds 1 million dollars"
- "When the building age is greater than 50 years or property type is high-rise"
- "Only for renewal policies, not new business"

What condition would you like to apply?`
  },
  {
    role: 'user',
    delay: 2000,
    text: 'Only when property value exceeds 2 million dollars and the building has had a prior claim'
  },
  {
    role: 'agent',
    delay: 2000,
    text: `I understand your condition. Let me translate it to a Salesforce formula:`,
    conditionCard: {
      naturalLanguage: 'Only when property value exceeds 2 million dollars and the building has had a prior claim',
      formula: '(Property_Value__c > 2000000) AND (Has_Prior_Claims__c = TRUE)',
      mappings: [
        { from: 'property value exceeds 2 million dollars', to: 'Property_Value__c > 2000000' },
        { from: 'building has had a prior claim', to: 'Has_Prior_Claims__c = TRUE' }
      ]
    },
    options: [
      { label: 'Yes, apply this condition', value: 'yes' },
      { label: 'No, let me rewrite it', value: 'rewrite' }
    ]
  },
  {
    role: 'user',
    text: 'Yes, apply this condition'
  },
  {
    role: 'agent',
    delay: 1000,
    text: `Condition applied successfully!

**Activity Configuration Summary:**`,
    record: {
      icon: '⚙️',
      title: 'Loss History Review - Stage Assignment',
      fields: [
        { label: 'Activity', value: 'Loss History Review' },
        { label: 'Stage', value: 'Submission Review' },
        { label: 'Availability', value: 'Conditional' },
        { label: 'Availability Rule', value: '(Property_Value__c > 2000000) AND (Has_Prior_Claims__c = TRUE)' },
        { label: 'Trigger', value: 'Automatic' },
        { label: 'Mandatory', value: 'Yes' }
      ]
    }
  },
  {
    role: 'agent',
    delay: 1000,
    text: `Perfect! We've completed the first activity for Stage 1.

**Progress Update:**

✅ Stage 1: Submission Review
  ✅ Loss History Review (configured with conditions)
  ⏳ Property Valuation Check (pending)
  ⏳ Compliance Document Verification (pending)

⏳ Stage 2: Property Inspection (not started)
⏳ Stage 3: Risk Assessment (not started)
⏳ Stage 4: Underwriting Decision (not started)
⏳ Stage 5: Quote Generation (not started)

**Next Steps:**

I can help you:
1. Continue configuring remaining activities for Stage 1
2. Move to Stage 2 configuration
3. Create a Flow for the next activity (Compliance Document Verification)
4. Review what we've created so far

What would you like to do next?`,
    options: [
      { label: 'Continue with Stage 1 activities', value: 'continue' },
      { label: 'Create the Compliance Verification Flow', value: 'flow' },
      { label: 'Review configuration so far', value: 'review' },
      { label: 'Skip to Stage 2', value: 'stage2' }
    ]
  },
  {
    role: 'user',
    text: 'Create the Compliance Verification Flow'
  },
  {
    role: 'agent',
    delay: 1000,
    text: `Excellent choice! Let's create the **Compliance Document Verification Flow**

This Flow will check that all required documents are uploaded and valid.

**Flow Design Thinking:**

**Purpose:** Verify all compliance documents are present and valid before underwriting
**Trigger:** Called from Activity Management
**Input Variables:**
- submissionId (Text)
- requiredDocTypes (Text Collection)

**Output Variables:**
- allDocsPresent (Boolean)
- missingDocs (Text Collection)
- validationErrors (Text Collection)

Let me build this Flow...`
  },
  {
    role: 'agent',
    delay: 2500,
    text: `**Building Flow Steps:**

**Step 1: Get Records**
- Query ContentDocumentLink records related to submission
- Filter by required document types

**Step 2: Loop Through Required Documents**
- For each required doc type, check if document exists
- Validate document meets requirements (file type, size, date)

**Step 3: Decision Element**
- Check if all required docs are present
- Branch: All Present → Continue
- Branch: Missing Docs → Collect missing doc names

**Step 4: Document Validation**
- Check file types (PDF, DOCX allowed)
- Verify upload dates (within 90 days)
- Validate file sizes (max 10MB)

**Step 5: Assignment**
- Set output variables
- Build error messages if validation fails`
  },
  {
    role: 'agent',
    delay: 2000,
    text: `Flow created successfully:`,
    record: {
      icon: '🔄',
      title: 'Commercial_Property_Compliance_Flow',
      fields: [
        { label: 'Flow Label', value: 'Commercial Property Compliance Flow' },
        { label: 'API Name', value: 'Commercial_Property_Compliance_Flow' },
        { label: 'Type', value: 'Autolaunched Flow' },
        { label: 'Process Type', value: 'Flow' },
        { label: 'Status', value: 'Active' },
        { label: 'Version', value: '1' },
        { label: 'Created Date', value: '5/19/2026, 11:52 AM' }
      ]
    }
  },
  {
    role: 'agent',
    delay: 1000,
    text: `Now let's create the Activity that uses this Flow.

**Activity Configuration:**
- Name: Compliance Document Verification
- Description: Verifies all required compliance documents are uploaded and valid
- Process Type: Flow
- Process: Commercial_Property_Compliance_Flow

Creating activity...`
  },
  {
    role: 'agent',
    delay: 1500,
    text: `Activity created:`,
    record: {
      icon: '📋',
      title: 'Compliance Document Verification',
      fields: [
        { label: 'Activity Name', value: 'Compliance Document Verification' },
        { label: 'Type', value: 'Flow' },
        { label: 'Process Name', value: 'Commercial_Property_Compliance_Flow' },
        { label: 'Description', value: 'Verifies all required compliance documents are uploaded and valid' },
        { label: 'Created Date', value: '5/19/2026, 11:53 AM' }
      ]
    }
  },
  {
    role: 'agent',
    delay: 1000,
    text: `Let's configure this activity for Stage 1.

For document verification, I recommend:
- Availability: On Stage Change (always show)
- Trigger: Manual (let underwriter run when ready)
- Mandatory: Yes (must pass before moving forward)

Should we add any conditions, or keep it available for all submissions?`,
    options: [
      { label: 'Keep available for all submissions', value: 'no' },
      { label: 'Add a condition', value: 'yes' }
    ]
  },
  {
    role: 'user',
    text: 'Keep available for all submissions'
  },
  {
    role: 'agent',
    delay: 1000,
    text: `Configuration applied:`,
    record: {
      icon: '⚙️',
      title: 'Compliance Document Verification - Stage Assignment',
      fields: [
        { label: 'Activity', value: 'Compliance Document Verification' },
        { label: 'Stage', value: 'Submission Review' },
        { label: 'Availability', value: 'On Stage Change' },
        { label: 'Trigger', value: 'Manual' },
        { label: 'Mandatory', value: 'Yes' }
      ]
    }
  },
  {
    role: 'agent',
    delay: 1000,
    text: `Excellent progress! Let me show you what we've accomplished.

**Configuration Summary:**`,
    record: {
      icon: '📊',
      title: 'Commercial Property Underwriting - Progress',
      fields: [
        { label: 'Configuration Name', value: 'Commercial Property Underwriting' },
        { label: 'Stages Configured', value: '1 of 5 (20%)' },
        { label: 'Activities Created', value: '2' },
        { label: 'Flows Created', value: '1' },
        { label: 'Integration Procedures Created', value: '1' },
        { label: 'Conditional Rules Applied', value: '1' },
        { label: 'Status', value: 'In Progress' }
      ]
    }
  },
  {
    role: 'agent',
    delay: 1000,
    text: `**What We've Built So Far:**

**Salesforce Processes:**
✅ CProp_LossHistory_IP (Integration Procedure)
✅ Commercial_Property_Compliance_Flow (Flow)

**Activities Library:**
✅ Loss History Review
✅ Compliance Document Verification

**Stage 1 Configuration:**
✅ Loss History Review - Conditional availability
✅ Compliance Document Verification - Always available

**Next Steps:**

We still need to:
1. Complete Stage 1 (1 more activity: Property Valuation Check)
2. Configure Stages 2-5
3. Create remaining 9 activities
4. Add conditional rules where needed

This is a great start! The foundation is in place. Would you like to:
- Continue building Stage 1
- Fast-forward through remaining stages
- Review and test what we've created
- Export the configuration plan`,
    options: [
      { label: 'Continue building out the configuration', value: 'continue' },
      { label: 'Review what we created', value: 'review' },
      { label: 'Show me how to test this', value: 'test' }
    ]
  },
  {
    role: 'user',
    text: 'Review what we created'
  },
  {
    role: 'agent',
    text: `Here's a complete summary of your Commercial Property underwriting configuration:

**Salesforce Objects Created:**

**Integration Procedure:**
- CProp_LossHistory_IP
  → Calls ISO ClaimSearch API
  → Returns 5-year loss history
  → Includes error handling

**Flow:**
- Commercial_Property_Compliance_Flow
  → Validates document presence
  → Checks file types and dates
  → Returns validation results

**Activities in Library:**
1. Loss History Review (Integration Procedure)
2. Compliance Document Verification (Flow)

**Stage Configuration:**

**Stage 1: Submission Review** ✅
- Loss History Review
  - Availability: Conditional (Property Value > $2M AND Has Prior Claims)
  - Trigger: Automatic
  - Mandatory: Yes

- Compliance Document Verification
  - Availability: On Stage Change
  - Trigger: Manual
  - Mandatory: Yes

**Next Actions:**

To continue building:
1. Go to Activity Management → Activities Tab (view created activities)
2. Go to Stage Management → Create "Commercial Property Underwriting" config
3. Add remaining stages and activities
4. Test with a sample submission

Your Commercial Property underwriting workflow is ready to implement!

**What You Have:**
✅ 2 Salesforce processes created (Integration Procedure + Flow)
✅ 2 Activities in your library
✅ Stage 1 fully configured with conditions
✅ Foundation in place for remaining stages

**To complete the setup:**
1. Create remaining Salesforce processes (Flows, Integration Procedures, Omniscripts)
2. Add remaining 9 activities to library
3. Configure Stages 2-5 using the same approach
4. Test with sample submissions

**Need Help?**
Ask me to:
- "Create the next activity"
- "Build Stage 2 configuration"
- "Help me test this workflow"
- "Explain how conditions work"

Thank you for using the Setup Assistant! 🎉`
  }
];

// Open agent chat panel
function openAgentChat() {
  const panel = document.getElementById('agent-chat-panel');
  const body = document.getElementById('agent-chat-body');

  panel.classList.remove('hidden');

  // Reset conversation if starting fresh
  if (conversationIndex === 0) {
    body.innerHTML = '';
    startConversation();
  }
}

// Close agent chat panel
function closeAgentChat() {
  const panel = document.getElementById('agent-chat-panel');
  panel.classList.add('hidden');
}

// Start the conversation
function startConversation() {
  conversationIndex = 0;
  showNextMessage();
}

// Show next message in sequence
function showNextMessage() {
  if (conversationIndex >= conversation.length) return;

  const message = conversation[conversationIndex];
  const delay = message.delay || (message.role === 'agent' ? 1000 : 500);

  // Show typing indicator for agent messages
  if (message.role === 'agent' && !isTyping) {
    showTypingIndicator();
  }

  setTimeout(() => {
    hideTypingIndicator();
    addMessage(message);
    conversationIndex++;

    // Auto-continue if not waiting for user interaction
    if (!message.options && conversationIndex < conversation.length) {
      showNextMessage();
    }
  }, delay);
}

// Add message to chat
function addMessage(message) {
  const body = document.getElementById('agent-chat-body');

  const messageDiv = document.createElement('div');
  messageDiv.className = `agent-message ${message.role}`;

  const avatar = document.createElement('div');
  avatar.className = 'agent-message-avatar';

  if (message.role === 'agent') {
    avatar.innerHTML = '<img src="http://salesforcetime.com/wp-content/uploads/2025/12/AgentforceIcon.png" alt="Agent" />';
  } else {
    // User avatar - flat icon
    avatar.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
    </svg>`;
  }

  const content = document.createElement('div');
  content.className = 'agent-message-content';

  const bubble = document.createElement('div');
  bubble.className = 'agent-message-bubble';
  bubble.innerHTML = formatMessageText(message.text);

  content.appendChild(bubble);

  // Add record card if present
  if (message.record) {
    const recordCard = createRecordCard(message.record);
    content.appendChild(recordCard);
  }

  // Add condition card if present
  if (message.conditionCard) {
    const conditionCard = createConditionCard(message.conditionCard);
    content.appendChild(conditionCard);
  }

  // Add options if present
  if (message.options) {
    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'agent-options';

    message.options.forEach(option => {
      const btn = document.createElement('button');
      btn.className = 'agent-option-btn';
      btn.textContent = option.label;
      btn.onclick = () => selectOption(btn, option.label);
      optionsDiv.appendChild(btn);
    });

    content.appendChild(optionsDiv);
  }

  // Add feedback buttons for agent messages
  if (message.role === 'agent') {
    const feedback = document.createElement('div');
    feedback.className = 'agent-feedback';
    feedback.innerHTML = `
      <button class="agent-feedback-btn" title="Good response">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
        </svg>
      </button>
      <button class="agent-feedback-btn" title="Bad response">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
        </svg>
      </button>
      <button class="agent-feedback-btn" title="Copy response">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      </button>
    `;
    content.appendChild(feedback);
  }

  messageDiv.appendChild(avatar);
  messageDiv.appendChild(content);

  body.appendChild(messageDiv);
  body.scrollTop = body.scrollHeight;
}

// Create Salesforce record card
function createRecordCard(record) {
  const card = document.createElement('div');
  card.className = 'sf-record-card';

  const header = document.createElement('div');
  header.className = 'sf-record-header';
  header.innerHTML = `
    <div class="sf-record-icon">${record.icon}</div>
    <div class="sf-record-title">${record.title}</div>
  `;

  card.appendChild(header);

  record.fields.forEach(field => {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'sf-record-field';
    fieldDiv.innerHTML = `
      <div class="sf-record-label">${field.label}</div>
      <div class="sf-record-value">${field.value}</div>
    `;
    card.appendChild(fieldDiv);
  });

  const viewBtn = document.createElement('button');
  viewBtn.className = 'sf-view-btn';
  viewBtn.textContent = 'View';
  viewBtn.onclick = () => alert('View functionality - would navigate to record detail');
  card.appendChild(viewBtn);

  return card;
}

// Create condition translation card
function createConditionCard(condition) {
  const card = document.createElement('div');
  card.className = 'sf-record-card condition-card';

  const translation = document.createElement('div');
  translation.className = 'condition-translation';

  // Natural language
  const nlLabel = document.createElement('div');
  nlLabel.className = 'condition-label';
  nlLabel.textContent = 'Your Natural Language Condition';
  translation.appendChild(nlLabel);

  const nlText = document.createElement('div');
  nlText.className = 'condition-text';
  nlText.textContent = `"${condition.naturalLanguage}"`;
  translation.appendChild(nlText);

  // Formula
  const formulaLabel = document.createElement('div');
  formulaLabel.className = 'condition-label';
  formulaLabel.textContent = 'Translated to Salesforce Formula';
  translation.appendChild(formulaLabel);

  const formula = document.createElement('div');
  formula.className = 'condition-formula';
  formula.textContent = condition.formula;
  translation.appendChild(formula);

  // Field mappings
  if (condition.mappings && condition.mappings.length > 0) {
    const mappingLabel = document.createElement('div');
    mappingLabel.className = 'condition-label';
    mappingLabel.textContent = 'Field Mappings';
    translation.appendChild(mappingLabel);

    const mappingContainer = document.createElement('div');
    mappingContainer.className = 'field-mapping';

    condition.mappings.forEach(mapping => {
      const item = document.createElement('div');
      item.className = 'field-mapping-item';
      item.innerHTML = `"${mapping.from}" → <code>${mapping.to}</code>`;
      mappingContainer.appendChild(item);
    });

    translation.appendChild(mappingContainer);
  }

  card.appendChild(translation);
  return card;
}

// Select an option
function selectOption(button, label) {
  // Mark button as selected
  button.classList.add('selected');

  // Disable all option buttons
  const allButtons = button.parentElement.querySelectorAll('.agent-option-btn');
  allButtons.forEach(btn => {
    btn.style.pointerEvents = 'none';
    if (btn !== button) {
      btn.style.opacity = '0.5';
    }
  });

  // Continue conversation
  setTimeout(() => {
    showNextMessage();
  }, 500);
}

// Format message text (basic markdown)
function formatMessageText(text) {
  // Convert **bold**
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Convert `code`
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Convert line breaks
  text = text.replace(/\n/g, '<br>');

  // Convert --- to horizontal rule
  text = text.replace(/<br>---<br>/g, '<hr style="margin: 16px 0; border: none; border-top: 1px solid #E5E5E5;">');

  return text;
}

// Show typing indicator
function showTypingIndicator() {
  isTyping = true;
  const body = document.getElementById('agent-chat-body');

  const typingDiv = document.createElement('div');
  typingDiv.id = 'agent-typing-indicator';
  typingDiv.className = 'agent-message agent';

  const avatar = document.createElement('div');
  avatar.className = 'agent-message-avatar';
  avatar.innerHTML = '<img src="http://salesforcetime.com/wp-content/uploads/2025/12/AgentforceIcon.png" alt="Agent" />';

  const content = document.createElement('div');
  content.className = 'agent-message-content';

  const typing = document.createElement('div');
  typing.className = 'agent-typing';
  typing.innerHTML = '<div class="agent-typing-dot"></div><div class="agent-typing-dot"></div><div class="agent-typing-dot"></div>';

  content.appendChild(typing);
  typingDiv.appendChild(avatar);
  typingDiv.appendChild(content);

  body.appendChild(typingDiv);
  body.scrollTop = body.scrollHeight;
}

// Hide typing indicator
function hideTypingIndicator() {
  isTyping = false;
  const indicator = document.getElementById('agent-typing-indicator');
  if (indicator) {
    indicator.remove();
  }
}
