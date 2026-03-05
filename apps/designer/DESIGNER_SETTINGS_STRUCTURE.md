# Designer Settings Structure

## Overview
The Designer Instance page uses a **3-level navigation structure**:
1. **Main Tabs** (top level)
2. **Settings Sub-sections** (middle level - collapsible groups)
3. **Settings Items** (bottom level - individual settings pages)

---

## Component Architecture

### 1. ClientPage (`app/(main)/[accountId]/designer-instances/instance/[instanceId]/ClientPage.tsx`)
- Main container for the designer instance page
- Manages state: `activeTab`, `selectedSettingsItem`, `openSections`
- Renders `LeftSidebar` and content preview area

### 2. LeftSidebar (`src/components/designer/LeftSidebar.tsx`)
- **Main Tabs** displayed using Shadcn `Tabs` component:
  - **Design Tab** - Widget design controls (hidden for partner plans)
    - Switches between Widget Mode and Form Mode
    - Shows `DesignTabV2` or `FlowTab` based on mode
  - **Settings Tab** - Instance configuration
    - Shows `SettingsTab` component
  - **Launch Tab** - Launch/deployment settings
    - Shows `LaunchTab` component

### 3. SettingsTab (`src/components/features/SettingsTab.tsx`)
- Displays **collapsible sub-sections** with items
- Structure defined in `SECTIONS` constant:

```typescript
const SECTIONS = [
  {
    id: 'instance',
    label: 'Instance',
    icon: Building2,
    items: [
      { id: 'basic-info', label: 'Basic Info', description: '...' },
      { id: 'industry-services', label: 'Industry & Services', description: '...' },
      { id: 'placeholder-images', label: 'Placeholder Images', description: '...' },
      { id: 'access-control', label: 'Access Control', description: '...' },
      { id: 'credits', label: 'Credits', description: '...' }
    ]
  },
  {
    id: 'configuration',
    label: 'Configuration',
    icon: Cog,
    items: [
      { id: 'usage-limits', label: 'Usage Limits', description: '...' }
    ]
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: Globe,
    items: [
      { id: 'webhooks', label: 'Webhooks', description: '...' },
      { id: 'notifications', label: 'Notifications', description: '...' }
    ]
  }
]
```

### 4. SettingsInputViewer (`src/components/features/SettingsInputViewer.tsx`)
- Renders in the main content area when Settings tab is active
- Receives `selectedItem` prop and looks up component from registry
- Dynamically renders the selected settings component

### 5. SettingsRegistry (`src/components/features/settings/SettingsRegistry.ts`)
- Maps settings IDs to React components:

```typescript
export const SETTINGS_REGISTRY = {
  'basic-info': BasicInfoSettings,
  'placeholder-images': PlaceholderImagesSettings,
  'industry-services': IndustryServicesSettings,
  'access-control': AccessControlSettings,
  'credits': CreditsSettings,
  'webhooks': WebhooksSettings,
  'service-config': ServiceConfigSettings,
  'api-config': ApiConfigSettings,
  'usage-limits': UsageLimitsSettings,
  'notifications': NotificationsSettings,
  'database': DatabaseSettings,
  'security': SecuritySettings,
  'monitoring': MonitoringSettings,
}
```

---

## Data Flow

### State Management
```
ClientPage (parent)
├─ activeTab: 'design' | 'settings' | 'launch'
├─ selectedSettingsItem: string (e.g., 'basic-info')
├─ openSections: Record<string, Record<string, boolean>>
│   └─ settings: { instance: true, configuration: false, ... }
└─ Passes down to LeftSidebar
```

### Navigation Flow
1. **User clicks main tab** (Design/Settings/Launch)
   → `ClientPage.setActiveTab()` called
   → `LeftSidebar` updates active tab
   → Content area re-renders

2. **User clicks settings sub-section** (e.g., "Instance")
   → `SettingsTab.handleSectionClick()` called
   → `toggleSection('settings', 'instance')` updates `openSections`
   → Section expands/collapses

3. **User clicks settings item** (e.g., "Basic Info")
   → `SettingsTab.handleItemClick()` called
   → `setSelectedSettingsItem('basic-info')` updates selection
   → `SettingsInputViewer` looks up component from registry
   → Component renders in main content area

---

## Current Visual Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ LeftSidebar (420px)                Main Content Area            │
├─────────────────────────────────────────────────────────────────┤
│ ┌─ Design Studio ───────────────┐  ┌─────────────────────────┐ │
│ │ [Design] [Settings] [Launch]  │  │                         │ │
│ └───────────────────────────────┘  │                         │ │
│                                     │                         │ │
│ When Settings tab active:           │  SettingsInputViewer   │ │
│ ┌─────────────────────────────┐   │  renders selected       │ │
│ │ ▼ Instance (Building2 icon) │   │  component from         │ │
│ │   • Basic Info              │   │  SettingsRegistry       │ │
│ │   • Industry & Services     │   │                         │ │
│ │   • Placeholder Images      │   │                         │ │
│ │   • Access Control          │   │                         │ │
│ │   • Credits                 │   │                         │ │
│ │ ▶ Configuration (Cog icon)  │   │                         │ │
│ │ ▶ Integrations (Globe icon) │   │                         │ │
│ └─────────────────────────────┘   └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Adding New Settings

### Step 1: Create Settings Component
Create a new file in `src/components/features/settings/`:

```typescript
// YourNewSettings.tsx
"use client";

import React from 'react';
import { SettingsPageHeader, SettingsSection } from './SettingsPrimitives';

interface YourNewSettingsProps {
  onSave?: () => void;
}

export function YourNewSettings({ onSave }: YourNewSettingsProps) {
  return (
    <div className="space-y-6">
      <SettingsPageHeader 
        title="Your Setting Title" 
        description="Description here" 
      />
      <SettingsSection title="Section">
        {/* Your settings UI here */}
      </SettingsSection>
    </div>
  );
}
```

### Step 2: Export in index.ts
Add to `src/components/features/settings/index.ts`:

```typescript
export { YourNewSettings } from './YourNewSettings';
```

### Step 3: Register in SettingsRegistry
Add to `src/components/features/settings/SettingsRegistry.ts`:

```typescript
import { YourNewSettings } from './YourNewSettings';

export const SETTINGS_REGISTRY = {
  // ... existing entries
  'your-new-setting': YourNewSettings,
} as const;
```

### Step 4: Add to SettingsTab Sections
Add to `SECTIONS` array in `src/components/features/SettingsTab.tsx`:

```typescript
{
  id: 'instance', // or create new section
  items: [
    // ... existing items
    { 
      id: 'your-new-setting', 
      label: 'Your Setting', 
      description: 'Brief description' 
    }
  ]
}
```

### Step 5: (Optional) Add to Lazy Registry
If using lazy loading, add to `src/components/features/settings/SettingsRegistryLazy.ts`:

```typescript
export const SETTINGS_REGISTRY_LAZY = {
  // ... existing entries
  'your-new-setting': () => import('.').then(m => m.YourNewSettings),
} as const;
```

---

## Key Design Patterns

### 1. Collapsible Sections
- Uses `openSections` state to track which sections are expanded
- Format: `{ [tab]: { [section]: boolean } }`
- Example: `{ settings: { instance: true, configuration: false } }`

### 2. Active Item Highlighting
- `selectedSettingsItem` tracks which item is currently selected
- Visual feedback with `bg-muted/50` and `font-medium` classes

### 3. Lazy Loading (Optional)
- `SettingsInputViewerLazy` uses dynamic imports
- Reduces initial bundle size
- Falls back to direct imports if lazy loading fails

### 4. Responsive Layout
- LeftSidebar: Fixed 420px width (collapsible to 56px)
- Main content: Flexible width (fills remaining space)
- Settings content: Max 2xl width (except full-width settings like placeholder-images)

---

## Current Status

✅ **Working Features:**
- Main tabs (Design, Settings, Launch)
- Settings sub-sections (Instance, Configuration, Integrations)
- Collapsible section behavior
- Item selection and navigation
- All settings components registered and working
- Credits settings properly added to registry

✅ **Recently Fixed:**
- Added `CreditsSettings` to `SettingsRegistry.ts`
- All settings items now properly render

---

## Files Reference

### Core Files
- `app/(main)/[accountId]/designer-instances/instance/[instanceId]/ClientPage.tsx` - Main page
- `src/components/designer/LeftSidebar.tsx` - Sidebar with main tabs
- `src/components/features/SettingsTab.tsx` - Settings sub-sections
- `src/components/features/SettingsInputViewer.tsx` - Settings content renderer

### Settings Infrastructure
- `src/components/features/settings/SettingsRegistry.ts` - Component registry
- `src/components/features/settings/SettingsRegistryLazy.ts` - Lazy loading registry
- `src/components/features/settings/index.ts` - Barrel export
- `src/components/features/settings/SettingsPrimitives.tsx` - Reusable UI components

### Individual Settings Components
- `BasicInfoSettings.tsx` - Instance name, description
- `IndustryServicesSettings.tsx` - Industry and services selection
- `PlaceholderImagesSettings.tsx` - Gallery placeholder images
- `AccessControlSettings.tsx` - Public/private access
- `CreditsSettings.tsx` - Credit pricing configuration
- `UsageLimitsSettings.tsx` - Rate limits and quotas
- `WebhooksSettings.tsx` - Webhook endpoints
- `NotificationsSettings.tsx` - Email and alerts
- `ServiceConfigSettings.tsx` - AI model settings (hidden)
- `ApiConfigSettings.tsx` - API configuration (hidden)
- `DatabaseSettings.tsx` - Storage settings (hidden)
- `SecuritySettings.tsx` - Auth settings (hidden)
- `MonitoringSettings.tsx` - Logs and analytics (hidden)

---

## Notes

- Partner plans cannot access Design tab (hidden with `isPartner` check)
- Some advanced settings are commented out in SettingsTab.tsx
- Settings content uses `SettingsPrimitives` for consistent styling
- The `placeholder-images` setting uses full-width layout
- All other settings use max-width 2xl with centered layout
