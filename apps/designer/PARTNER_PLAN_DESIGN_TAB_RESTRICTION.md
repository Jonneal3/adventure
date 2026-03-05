# Partner Plan Design Tab Restriction

## Overview
This implementation restricts access to the design tab in the designer instances for users on partner plans. Partner plans are identified by having `onboarding_type: 'partner'` in the plans table.

## Files Modified

### 1. `src/hooks/use-account-plan.ts` (NEW)
- Custom hook to check if the current account has a partner plan
- Fetches subscription data and plan details to determine if the account is on a partner plan
- Returns `isPartner` boolean flag

### 2. `app/api/plans/[planId]/route.ts` (NEW)
- API endpoint to fetch plan details by plan ID
- Used by the `useAccountPlan` hook to get plan information including `onboarding_type`

### 3. `src/components/designer/LeftSidebar.tsx`
- Modified to conditionally hide the design tab for partner plans
- Changes grid layout from 3 columns to 2 columns when design tab is hidden
- Conditionally renders the design tab trigger and content

### 4. `app/(main)/[accountId]/designer-instances/instance/[instanceId]/ClientPage.tsx`
- Added partner plan detection using `useAccountPlan` hook
- Automatically switches to settings tab if user tries to access design tab on partner plan
- Prevents tab switching to design tab for partner users
- Conditionally hides design tab content in the main area

## How It Works

1. **Plan Detection**: The `useAccountPlan` hook fetches the current account's subscription and plan details
2. **Tab Hiding**: The LeftSidebar component conditionally renders the design tab based on the `isPartner` flag
3. **Access Prevention**: The ClientPage component prevents partner users from switching to the design tab
4. **Default Behavior**: Partner users are automatically redirected to the settings tab if they somehow end up on the design tab

## Testing

To test this implementation:

1. **Non-Partner Plan**: Users with regular plans should see all three tabs (Design, Settings, Launch)
2. **Partner Plan**: Users with partner plans should only see two tabs (Settings, Launch)
3. **Tab Switching**: Partner users should not be able to switch to the design tab
4. **Console Logs**: Check browser console for debug messages indicating plan detection and tab restrictions

## Database Requirements

The implementation relies on:
- `plans` table with `onboarding_type` column
- `user_subscriptions` table with `plan_id` foreign key
- Existing subscription status API that returns plan information

## Future Considerations

- Consider adding a message explaining why the design tab is hidden for partner users
- Could add a tooltip or help text explaining that design is handled by the partner team
- May want to add analytics to track partner user behavior in the restricted interface
