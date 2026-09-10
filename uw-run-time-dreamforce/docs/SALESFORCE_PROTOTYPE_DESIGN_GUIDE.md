# Salesforce Prototype Design & Implementation Guide

> **Purpose:** Ensure all Salesforce-based prototypes maintain visual consistency with the Salesforce Lightning Design System (SLDS) and match Figma designs pixel-perfect.

## Table of Contents
1. [Design System Setup](#design-system-setup)
2. [Color Palette](#color-palette)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Components](#components)
6. [Icons](#icons)
7. [Common Patterns](#common-patterns)
8. [Accessibility](#accessibility)
9. [Figma to Code Workflow](#figma-to-code-workflow)
10. [Troubleshooting](#troubleshooting)

---

## Design System Setup

### Required Packages

```json
{
  "@salesforce-ux/design-system": "^2.25.4",
  "@salesforce/design-system-react": "^0.10.65"
}
```

### Installation

```bash
npm install @salesforce-ux/design-system @salesforce/design-system-react
```

### Copy SLDS Assets to Public Folder

SLDS assets (icons, images, styles) must be accessible at runtime:

```bash
# Create directory structure
mkdir -p public/assets/salesforce-lightning-design-system

# Copy assets from node_modules
cp -r node_modules/@salesforce-ux/design-system/assets/* \
  public/assets/salesforce-lightning-design-system/
```

### Global CSS Import

Import SLDS CSS in your main stylesheet or `_app.tsx`:

```css
/* styles/globals.css */
@import '@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.min.css';

:root {
  font-family: 'Salesforce Sans', Arial, sans-serif;
  background-color: #f3f3f3;
}
```

### IconSettings Wrapper

Wrap your app with `IconSettings` at the root level:

```jsx
import { IconSettings } from '@salesforce/design-system-react';

function App() {
  return (
    <IconSettings iconPath="/assets/salesforce-lightning-design-system/icons">
      <YourApp />
    </IconSettings>
  );
}
```

---

## Color Palette

### Primary Colors

Use SLDS design tokens for consistency:

| Token | Hex | Usage |
|-------|-----|-------|
| Brand (Primary Blue) | `#0176D3` | Primary actions, links, current state |
| Electric Blue 40 | `#0250D9` | Interactive links, hover states |
| Navy (Dark Blue) | `#001E5B` | Headers, primary text |
| Success (Green) | `#2E844A` | Success states, completed items |
| Warning (Orange) | `#FFB75D` | Warning badges, alerts |
| Error (Red) | `#C23934` | Error states, destructive actions |

### Neutral Colors

| Token | Hex | Usage |
|-------|-----|-------|
| Surface 1 (White) | `#FFFFFF` | Card backgrounds, containers |
| Surface 2 (Light Gray) | `#F3F3F3` | Page backgrounds |
| On-Surface 1 (Medium Gray) | `#5C5C5C` | Secondary text, labels |
| On-Surface 2 (Dark Gray) | `#2E2E2E` | Body text |
| On-Surface 3 (Navy) | `#001E5B` | Headers, emphasis |
| Border 1 | `#DDDBDA` | Default borders |
| Border 2 | `#C9C9C9` | Emphasized borders |

### Usage in Code

```jsx
// Using inline styles
<div style={{ 
  backgroundColor: '#FFFFFF',
  color: '#001E5B',
  borderColor: '#DDDBDA'
}}>

// Using CSS variables
<div style={{ 
  backgroundColor: 'var(--slds-g-color-surface-1, #FFFFFF)',
  color: 'var(--slds-g-color-on-surface-3, #001E5B)'
}}>
```

---

## Typography

### Font Family

**Primary:** Salesforce Sans (fallback: system sans-serif)

```css
font-family: 'Salesforce Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
```

### Font Scale

| Size Name | Size | Line Height | Weight | Usage |
|-----------|------|-------------|--------|-------|
| Heading Large | 28px | 35px | 400 | Page titles (H1) |
| Heading Medium | 20px | 28px | 400 | Section headers |
| Heading Small | 16px | 22px | 600 | Card titles, sub-headers |
| Body Base | 13px | 18px | 400 | Default body text |
| Body Small | 12px | 17px | 400 | Labels, captions |
| Body Tiny | 10px | 14px | 400 | Metadata, timestamps |

### Font Weights

| Weight | Value | Usage |
|--------|-------|-------|
| Regular | 400 | Body text, descriptions |
| Semibold | 600 | Headers, emphasis, button labels |
| Bold | 700 | Strong emphasis, active states |

### Implementation

```jsx
// Page Title
<h1 style={{ 
  fontSize: '28px', 
  lineHeight: '35px', 
  fontWeight: 400,
  color: '#001E5B' 
}}>
  Page Title
</h1>

// Body Text
<p style={{ 
  fontSize: '13px', 
  lineHeight: '18px', 
  fontWeight: 400,
  color: '#2E2E2E' 
}}>
  Body content goes here
</p>

// Label
<span style={{ 
  fontSize: '12px', 
  lineHeight: '17px', 
  fontWeight: 400,
  color: '#5C5C5C' 
}}>
  Field Label
</span>
```

---

## Spacing & Layout

### Spacing Scale (8px Base)

| Token | Value | Usage |
|-------|-------|-------|
| spacing-0 | 0px | No spacing |
| spacing-1 | 4px | Minimal gaps, tight spacing |
| spacing-2 | 8px | Small gaps between related items |
| spacing-3 | 12px | Default gap between elements |
| spacing-4 | 16px | Section padding, card padding |
| spacing-6 | 32px | Large section spacing |
| spacing-12 | 80px | Column gaps in detail rows |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| radius-border-2 | 4px | Small elements, badges |
| radius-border-3 | 8px | Cards, containers |
| radius-border-4 | 20px | Large cards, modals |
| radius-border-circle | 9999px | Pills, circular buttons, avatars |

### Layout Patterns

#### Page Container
```jsx
<div style={{ 
  padding: '16px', 
  maxWidth: '1440px', 
  margin: '0 auto',
  backgroundColor: '#f3f3f3',
  minHeight: '100vh'
}}>
```

#### Card Container
```jsx
<div style={{ 
  backgroundColor: '#FFFFFF',
  borderRadius: '20px',
  padding: '16px',
  border: '1px solid #DDDBDA'
}}>
```

#### Two-Column Layout
```jsx
<div style={{ 
  display: 'grid', 
  gridTemplateColumns: '1fr 403px', 
  gap: '16px' 
}}>
  <div>{/* Main content */}</div>
  <div>{/* Sidebar */}</div>
</div>
```

---

## Components

### Page Header

```jsx
<div style={{ backgroundColor: '#FFFFFF', marginBottom: '16px' }}>
  <div style={{ padding: '16px', display: 'flex', gap: '12px' }}>
    {/* Icon */}
    <div style={{
      width: '32px',
      height: '32px',
      backgroundColor: '#5867E8',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Icon category="standard" name="document" size="small" />
    </div>

    {/* Content */}
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '12px', color: '#5c5c5c' }}>Object Label</div>
      <h1 style={{ fontSize: '28px', fontWeight: 400, color: '#001e5b' }}>
        Record Title
      </h1>
      
      {/* Details Row */}
      <div style={{ display: 'flex', gap: '80px' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#5c5c5c' }}>Field Label</div>
          <div style={{ fontSize: '13px', color: '#001e5b' }}>Field Value</div>
        </div>
      </div>
    </div>

    {/* Actions */}
    <ButtonGroup>
      <Button label="Action 1" />
      <Button label="Action 2" />
    </ButtonGroup>
  </div>
</div>
```

### Tabs

```jsx
<div style={{ borderBottom: '1px solid #dddbda', display: 'flex' }}>
  {['Tab 1', 'Tab 2', 'Tab 3'].map((tab) => (
    <button
      key={tab}
      style={{
        padding: '16px',
        border: 'none',
        background: 'none',
        fontSize: '13px',
        fontWeight: selected ? 600 : 400,
        color: selected ? '#0176D3' : '#706E6B',
        borderBottom: selected ? '2px solid #0176D3' : '2px solid transparent',
        cursor: 'pointer'
      }}
    >
      {tab}
    </button>
  ))}
</div>
```

### Progress Path

```jsx
<div style={{
  backgroundColor: 'white',
  borderRadius: '8px',
  padding: '16px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px'
}}>
  {/* Complete Step */}
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <div style={{
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      backgroundColor: '#2E844A',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Icon category="utility" name="check" size="x-small" color="white" />
    </div>
    <span style={{ fontSize: '13px' }}>Completed</span>
  </div>

  {/* Progress Line */}
  <div style={{ 
    width: '80px', 
    height: '4px', 
    backgroundColor: '#2E844A' 
  }} />

  {/* Current Step */}
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <div style={{
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      backgroundColor: '#0176D3',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '13px',
      fontWeight: 600
    }}>
      2
    </div>
    <span style={{ fontSize: '13px', fontWeight: 600, color: '#0176D3' }}>
      In Progress
    </span>
  </div>

  {/* Inactive Line */}
  <div style={{ 
    width: '80px', 
    height: '4px', 
    backgroundColor: '#DDDBDA' 
  }} />

  {/* Incomplete Step */}
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <div style={{
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      backgroundColor: '#DDDBDA',
      color: '#706E6B',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '13px'
    }}>
      3
    </div>
    <span style={{ fontSize: '13px', color: '#706E6B' }}>Pending</span>
  </div>
</div>
```

### Badge

```jsx
{/* Success Badge */}
<span style={{
  backgroundColor: '#2E844A',
  color: '#ffffff',
  padding: '4px 12px',
  borderRadius: '12px',
  fontSize: '11px',
  fontWeight: 600
}}>
  Approved
</span>

{/* Warning Badge */}
<span style={{
  backgroundColor: '#FFB75D',
  color: '#ffffff',
  padding: '4px 12px',
  borderRadius: '12px',
  fontSize: '11px',
  fontWeight: 600
}}>
  In Progress
</span>

{/* Error Badge */}
<span style={{
  backgroundColor: '#C23934',
  color: '#ffffff',
  padding: '4px 12px',
  borderRadius: '12px',
  fontSize: '11px',
  fontWeight: 600
}}>
  Rejected
</span>
```

### Card with Header

```jsx
<div style={{
  backgroundColor: 'white',
  border: '1px solid #c9c9c9',
  borderRadius: '20px',
  overflow: 'hidden'
}}>
  {/* Header */}
  <div style={{
    backgroundColor: '#f1f6fa',
    borderBottom: '1px solid #c9c9c9',
    padding: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Icon category="utility" name="sparkles" size="x-small" />
      <span style={{ fontSize: '16px', fontWeight: 600 }}>Card Title</span>
    </div>
    <Button label="Action" />
  </div>

  {/* Content */}
  <div style={{ padding: '16px' }}>
    Card content goes here
  </div>
</div>
```

---

## Icons

### Icon Setup

**Critical:** Set the correct iconPath in IconSettings:

```jsx
<IconSettings iconPath="/assets/salesforce-lightning-design-system/icons">
```

### Icon Categories

1. **Utility Icons** - UI actions (chevron, search, settings, sparkles)
2. **Standard Icons** - Objects (account, document, email)
3. **Action Icons** - Actions (call, email, new_task)
4. **Custom Icons** - Custom objects
5. **Doctype Icons** - File types (pdf, excel, word)

### Common Utility Icons

```jsx
// Chevrons (navigation)
<Icon category="utility" name="chevrondown" size="x-small" />
<Icon category="utility" name="chevronright" size="x-small" />

// Actions
<Icon category="utility" name="edit" size="small" />
<Icon category="utility" name="settings" size="small" />
<Icon category="utility" name="search" size="small" />
<Icon category="utility" name="check" size="small" />

// AI/Agent
<Icon category="utility" name="sparkles" size="x-small" />

// UI Elements
<Icon category="utility" name="waffle" size="small" />
<Icon category="utility" name="favorite" size="x-small" />
<Icon category="utility" name="threedots_vertical" size="small" />
```

### Icon Sizes

| Size | Dimension | Usage |
|------|-----------|-------|
| xx-small | 12px | Inline icons in text |
| x-small | 16px | Small UI elements, badges |
| small | 20px | Buttons, navigation |
| medium | 32px | Page headers, primary actions |
| large | 48px | Empty states, placeholders |

### Icon Colors

Icons inherit color from their container by default. For custom colors:

```jsx
<Icon 
  category="utility" 
  name="check" 
  size="small"
  style={{ fill: '#2E844A' }}
/>
```

### Icons in Buttons

```jsx
// Icon on left
<Button
  label="Ask"
  iconCategory="utility"
  iconName="sparkles"
  iconPosition="left"
  iconSize="x-small"
/>

// Icon only
<Button
  iconCategory="utility"
  iconName="settings"
  iconSize="small"
  variant="icon"
  iconVariant="border"
/>
```

---

## Common Patterns

### Global Navigation

```jsx
<div style={{
  backgroundColor: 'white',
  borderBottom: '1px solid #c9c9c9',
  boxShadow: '0px 2px 1px rgba(0,0,0,0.18)'
}}>
  <div style={{ 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    padding: '4px 32px 4px 0'
  }}>
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '16px',
      paddingLeft: '16px' 
    }}>
      <Icon category="utility" name="waffle" size="small" />
      <span style={{ fontSize: '20px', color: '#001e5b' }}>App Name</span>
    </div>
    <Button iconCategory="utility" iconName="edit" iconVariant="container" />
  </div>
</div>
```

### List View Table

```jsx
<DataTable
  items={items}
  id="list-table"
  fixedLayout
  selectRows="checkbox"
>
  <DataTableColumn label="Name" property="name" sortable width="20rem" />
  <DataTableColumn label="Status" property="status" sortable width="10rem" />
  <DataTableColumn label="Date" property="date" sortable width="10rem" />
</DataTable>
```

### Email/Message Display

```jsx
<div style={{ display: 'flex', gap: '16px', padding: '16px' }}>
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
    color: '#001e5b'
  }}>
    AB
  </div>

  {/* Content */}
  <div style={{ flex: 1 }}>
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between',
      marginBottom: '4px'
    }}>
      <span style={{ fontSize: '14px', fontWeight: 600, color: '#0250d9' }}>
        Sender Name
      </span>
      <span style={{ fontSize: '13px', color: '#5c5c5c' }}>
        9:30 PM · May 12
      </span>
    </div>
    
    <div style={{ fontSize: '12px', color: '#2e2e2e', lineHeight: '17px' }}>
      Message body text goes here...
    </div>
  </div>
</div>
```

### Attachment Pills

```jsx
<div style={{
  border: '1px solid #5c5c5c',
  borderRadius: '20px',
  padding: '4px 12px',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: '13px'
}}>
  <Icon category="utility" name="attach" size="x-small" />
  document.pdf
</div>
```

---

## Accessibility

### Required Attributes

```jsx
// Icons
<Icon 
  category="utility" 
  name="search" 
  assistiveText={{ label: 'Search' }}
/>

// Buttons
<Button 
  iconCategory="utility" 
  iconName="edit"
  assistiveText={{ icon: 'Edit Record' }}
/>

// Form inputs
<input 
  type="text"
  aria-label="Search submissions"
  placeholder="Search..."
/>
```

### Color Contrast

- Ensure minimum 4.5:1 contrast ratio for normal text
- Ensure minimum 3:1 contrast ratio for large text (18px+)
- Use SLDS color tokens which are pre-validated for WCAG AA

### Keyboard Navigation

- All interactive elements must be keyboard accessible
- Maintain logical tab order
- Provide visible focus indicators

```css
button:focus {
  outline: 2px solid #0176D3;
  outline-offset: 2px;
}
```

---

## Figma to Code Workflow

### Step 1: Get Design Context from Figma

```bash
# Use Figma MCP to fetch design
mcp__plugin_figma_figma__get_design_context({
  fileKey: "YOUR_FILE_KEY",
  nodeId: "NODE_ID"
})
```

### Step 2: Identify Components

Map Figma components to SLDS React components:

| Figma Component | SLDS React Component |
|-----------------|---------------------|
| Button | `<Button>` |
| Input | `<Input>` |
| Icon | `<Icon>` |
| Tab | `<Tabs>` + `<TabsPanel>` |
| Badge | Custom styled `<span>` |
| Card | Custom styled `<div>` |

### Step 3: Extract Design Tokens

From Figma design context, extract:
- **Colors:** Convert to SLDS hex values
- **Spacing:** Use 8px base grid
- **Typography:** Map to SLDS font scale
- **Border Radius:** Use SLDS radius tokens

### Step 4: Build Incrementally

1. **Structure first:** Create layout containers
2. **Components next:** Add SLDS components
3. **Styling last:** Apply exact spacing and colors
4. **Icons finally:** Add icons with correct paths

### Step 5: Validate

- ✅ Colors match Figma exactly
- ✅ Spacing uses 8px grid
- ✅ Typography uses SLDS scale
- ✅ Icons display correctly
- ✅ Responsive behavior works
- ✅ Accessibility requirements met

---

## Troubleshooting

### Icons Not Showing

**Problem:** Icons display as blank spaces

**Solution:**
1. Verify iconPath: `/assets/salesforce-lightning-design-system/icons`
2. Check public folder has icon sprites
3. Verify icon name exists in sprite
4. Clear browser cache

See: [SLDS_ICON_PATH_SETUP.md](./SLDS_ICON_PATH_SETUP.md)

### Colors Don't Match Figma

**Problem:** Colors appear different from design

**Solution:**
1. Use SLDS color palette hex values
2. Check for color overlays or opacity
3. Verify background colors are set
4. Test in same browser as design review

### Spacing Looks Off

**Problem:** Elements don't align with design

**Solution:**
1. Use 8px base grid (4px, 8px, 12px, 16px, 32px, 80px)
2. Check padding vs margin usage
3. Verify flex gap vs individual margins
4. Use browser dev tools to inspect computed spacing

### Components Don't Look Right

**Problem:** SLDS components have wrong styling

**Solution:**
1. Check if SLDS CSS is imported
2. Verify no conflicting global styles
3. Use variant props correctly (neutral, brand, etc.)
4. Check component documentation for correct props

### Fonts Look Different

**Problem:** Typography doesn't match design

**Solution:**
1. Ensure Salesforce Sans is loaded
2. Check font-weight values (400, 600, 700)
3. Verify line-height matches design
4. Use exact font-size from SLDS scale

---

## Checklist for New Prototypes

### Setup Phase
- [ ] Install SLDS packages
- [ ] Copy assets to public folder
- [ ] Import SLDS CSS globally
- [ ] Set up IconSettings wrapper with correct path
- [ ] Configure font family

### Development Phase
- [ ] Use SLDS color palette
- [ ] Follow typography scale
- [ ] Apply 8px spacing grid
- [ ] Use SLDS components where available
- [ ] Implement with correct icons
- [ ] Add assistive text for accessibility
- [ ] Test keyboard navigation

### Review Phase
- [ ] Compare with Figma design
- [ ] Verify all icons display
- [ ] Check color accuracy
- [ ] Validate spacing consistency
- [ ] Test responsive behavior
- [ ] Run accessibility audit
- [ ] Cross-browser testing

---

## Resources

### Official Documentation
- [SLDS Website](https://www.lightningdesignsystem.com/)
- [Design System React](https://react.lightningdesignsystem.com/)
- [SLDS Icons](https://www.lightningdesignsystem.com/icons/)
- [SLDS Design Tokens](https://www.lightningdesignsystem.com/design-tokens/)

### Internal Docs
- [SLDS Icon Path Setup](./SLDS_ICON_PATH_SETUP.md)
- Project-specific implementation guides

### Tools
- [Figma SLDS Library](https://www.figma.com/@salesforce)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)
- [WAVE Accessibility Tool](https://wave.webaim.org/)

---

**Version:** 1.0  
**Last Updated:** May 28, 2026  
**Maintained By:** Engineering Team  
**Applies To:** All Salesforce-based prototypes and applications
