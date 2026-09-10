# Salesforce Lightning Design System (SLDS) Icon Path Setup

## Problem

Icons from the Salesforce Design System React components are not displaying, showing blank spaces or broken icons where icons should appear.

## Symptoms

- Button icons are not visible (e.g., sparkles, chevron, settings icons)
- Icon components render but show no graphic
- Console may show 404 errors for icon sprite files
- Icons show in Figma design but not in the running application

## Root Cause

The `IconSettings` component's `iconPath` prop is pointing to an incorrect directory path. This happens because:

1. The SLDS icons are installed via `@salesforce-ux/design-system` npm package
2. The icon sprites need to be copied to the `public` folder to be accessible at runtime
3. The `iconPath` must match the actual location in the `public` folder

## Solution

### Step 1: Verify Icon Location

Check where the SLDS icons are located in your public folder:

```bash
ls public/assets/salesforce-lightning-design-system/
```

You should see a folder structure like:
```
public/
└── assets/
    └── salesforce-lightning-design-system/
        ├── icons/           # ✅ Icons are HERE
        │   ├── utility-sprite/
        │   ├── standard-sprite/
        │   ├── action-sprite/
        │   └── custom-sprite/
        ├── images/
        └── styles/
```

### Step 2: Set Correct iconPath

Wrap your components with `IconSettings` using the **correct** path:

```jsx
import { IconSettings } from '@salesforce/design-system-react';

// ❌ WRONG - includes extra "assets" folder
<IconSettings iconPath="/assets/salesforce-lightning-design-system/assets/icons">

// ✅ CORRECT - points directly to the icons folder
<IconSettings iconPath="/assets/salesforce-lightning-design-system/icons">
  <YourApp />
</IconSettings>
```

### Step 3: Verify Icon Exists

To check if a specific icon exists in the library:

```bash
# Check if icon exists in utility sprite
grep -o 'id="sparkles"' public/assets/salesforce-lightning-design-system/icons/utility-sprite/svg/symbols.svg

# List all available utility icons
grep -o 'id="[^"]*"' public/assets/salesforce-lightning-design-system/icons/utility-sprite/svg/symbols.svg
```

### Step 4: Use Icons in Components

Once the path is correct, use icons in your components:

```jsx
import { Button, Icon } from '@salesforce/design-system-react';

// Button with icon
<Button
  label="Ask"
  iconCategory="utility"
  iconName="sparkles"
  iconPosition="left"
  iconSize="x-small"
/>

// Standalone icon
<Icon
  assistiveText={{ label: 'Settings' }}
  category="utility"
  name="settings"
  size="small"
/>
```

## Icon Categories

SLDS provides several icon categories:

| Category | Usage | Examples |
|----------|-------|----------|
| `utility` | UI actions & states | chevron, search, settings, sparkles, check |
| `standard` | Standard objects | account, opportunity, document, contact |
| `action` | Action items | email, call, new_task, log_a_call |
| `custom` | Custom objects | custom1, custom2, etc. |
| `doctype` | File types | pdf, excel, word, xml |

## Common Icon Names

### Utility Icons (UI Actions)
- `chevrondown`, `chevronup`, `chevronright`, `chevronleft`
- `search`, `settings`, `close`, `check`
- `edit`, `delete`, `add`, `refresh`
- `sparkles` (AI/Einstein features)
- `waffle` (app launcher)
- `favorite`, `threedots_vertical`

### Standard Icons (Objects)
- `account`, `contact`, `opportunity`
- `document`, `email`, `task`
- `calendar`, `dashboard`

## Troubleshooting

### Icons still not showing?

1. **Check browser console** for 404 errors on sprite files
2. **Verify public folder** has the icons:
   ```bash
   ls -la public/assets/salesforce-lightning-design-system/icons/
   ```

3. **Check if SLDS assets were copied** during build. If not, you may need to:
   ```bash
   # Copy SLDS assets from node_modules to public
   cp -r node_modules/@salesforce-ux/design-system/assets/* public/assets/salesforce-lightning-design-system/
   ```

4. **Verify iconPath in all IconSettings** instances throughout your app

5. **Clear browser cache** and restart dev server

### Icon name doesn't exist?

Check the official SLDS icon documentation:
- https://www.lightningdesignsystem.com/icons/

Or search the sprite files directly:
```bash
# Search all icon IDs in utility sprite
grep -o 'id="[^"]*"' public/assets/salesforce-lightning-design-system/icons/utility-sprite/svg/symbols.svg | sed 's/id="//g' | sed 's/"//g' | sort
```

## Best Practices

1. **Set IconSettings once** at the app root level, not on every page
2. **Use semantic icon names** that match SLDS naming conventions
3. **Provide assistiveText** for accessibility on all icons
4. **Check Figma designs** for correct icon names before implementing
5. **Document custom icon usage** if you add custom SVGs

## References

- [SLDS Icon Documentation](https://www.lightningdesignsystem.com/icons/)
- [Design System React - IconSettings](https://react.lightningdesignsystem.com/components/icon-settings/)
- [Design System React - Icon](https://react.lightningdesignsystem.com/components/icons/)
- [Design System React - Button](https://react.lightningdesignsystem.com/components/buttons/)

---

**Created:** May 28, 2026  
**Last Updated:** May 28, 2026  
**Project:** UW Front End - Insurance Submissions  
**Issue:** Icons not displaying due to incorrect iconPath configuration
