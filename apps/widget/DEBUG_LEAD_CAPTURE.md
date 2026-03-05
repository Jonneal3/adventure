# 🔍 Lead Capture Debugging Guide

## Quick Debug Checklist

### 1. **Check Console Logs**
Open browser DevTools → Console and look for these emoji-prefixed logs:

- 🎯 `LeadCaptureModal mounted/updated` - Component lifecycle
- 📝 `Email/Name/Phone changed` - Form field updates
- 💾 `Auto-saved form data` - localStorage saves
- ⏰ `Idle check` - Idle timeout monitoring
- ❌ `Close button clicked` - X button events
- 🚪 `Before unload triggered` - Page exit events
- 📡 `Beacon sent successfully` - Exit submissions

### 2. **Test Scenarios**

#### **Scenario A: X Button Test**
1. Open lead modal
2. Fill email field
3. Click X button
4. Check console for: `❌ Close button clicked` → `📤 Submitting partial lead due to close button`

#### **Scenario B: Idle Timeout Test**
1. Open lead modal
2. Fill email field
3. Stop all activity (no mouse/keyboard)
4. Wait for idle timeout (default: 60 seconds)
5. Check console for: `⏰ Idle check` → `📤 Submitting partial lead due to idle timeout`

#### **Scenario C: Page Exit Test**
1. Open lead modal
2. Fill email field
3. Close tab/window or navigate away
4. Check console for: `🚪 Before unload triggered` → `📡 Beacon sent successfully`

### 3. **Network Tab Verification**
1. Open DevTools → Network tab
2. Filter by "Fetch/XHR"
3. Perform test scenarios
4. Look for POST requests to `/api/webhook`

### 4. **localStorage Inspection**
```javascript
// In console, check:
localStorage.getItem('lead_form_YOUR_INSTANCE_ID')
localStorage.getItem('lead_submitted_YOUR_INSTANCE_ID')
```

## Common Issues & Fixes

### **Issue 1: No console logs appearing**
**Cause**: Component not mounting or logs disabled
**Fix**: 
- Check if `lead_capture_enabled` is true in config
- Verify modal is actually opening
- Check console log level settings

### **Issue 2: Form data not saving**
**Cause**: localStorage issues or debounce not working
**Fix**:
- Check for `💾 Auto-saved form data` logs
- Verify localStorage is available: `typeof localStorage !== 'undefined'`
- Check if auto-save delay is too long

### **Issue 3: Idle timeout not firing**
**Cause**: Activity constantly resetting timer
**Fix**:
- Look for `⏰ Idle check` logs
- Check if mouse/keyboard events are firing constantly
- Verify idle timeout value in config

### **Issue 4: Exit submissions not working**
**Cause**: `beforeunload` limitations or sendBeacon issues
**Fix**:
- Check for `🚪 Before unload triggered` logs
- Verify `📡 Beacon sent successfully` appears
- Check if webhook endpoint is accessible

### **Issue 5: Partial vs Complete confusion**
**Cause**: Logic determining submission type
**Fix**:
- Check `isPartial` flag in submission logs
- Verify form completion logic
- Check database status field

## Debug Commands

### **Manual State Check**
```javascript
// In console, trigger debug state
document.querySelector('[title="Debug State"]')?.click()
```

### **Force Partial Submission**
```javascript
// In console, manually trigger partial submission
const modal = document.querySelector('.lead-capture-modal');
if (modal && modal.__reactProps$) {
  // Access React component and call submitPartialLead
}
```

### **Check localStorage**
```javascript
// List all lead-related localStorage items
Object.keys(localStorage).filter(key => key.includes('lead_'))
```

### **Simulate Exit Events**
```javascript
// Simulate beforeunload
window.dispatchEvent(new Event('beforeunload'));

// Simulate visibility change
document.dispatchEvent(new Event('visibilitychange'));
```

## Performance Monitoring

### **Key Metrics to Track**
- Form field change frequency
- Auto-save success rate
- Idle timeout accuracy
- Exit submission success rate
- localStorage operation success rate

### **Performance Issues**
- **High auto-save frequency**: Increase `lead_auto_save_delay`
- **Idle timeout too aggressive**: Increase `lead_idle_timeout`
- **Exit submissions failing**: Check webhook endpoint availability

## Production Debugging

### **Remove Debug Logs**
Before production, remove or conditionally disable debug logs:

```typescript
const DEBUG = process.env.NODE_ENV === 'development';

if (DEBUG) {
  console.log('Debug message');
}
```

### **Error Tracking**
Add error tracking for production:

```typescript
try {
  // Lead submission logic
} catch (error) {
  console.error('Lead submission failed:', error);
  // Send to error tracking service
}
```

## Testing Checklist

- [ ] Form fields auto-save correctly
- [ ] X button triggers partial submission
- [ ] Idle timeout works as expected
- [ ] Page exit submissions are reliable
- [ ] localStorage cleanup works
- [ ] Webhook payloads are correct
- [ ] Database records are created
- [ ] Partial vs complete status is accurate

## Support

If issues persist after following this guide:

1. **Collect logs**: Copy all console output during test scenarios
2. **Check network**: Screenshot Network tab showing failed requests
3. **Verify config**: Confirm all lead capture settings are correct
4. **Test environment**: Verify the issue exists in both dev and production 