# Enhanced Lead Capture System

## Overview

The enhanced lead capture system implements a robust, 10x developer approach to capturing partial form data as users progress through the lead capture form. This ensures that valuable lead information is captured even when users don't complete the entire form.

## Key Features

### 1. Real-time Form State Tracking
- **Auto-save**: Form data is automatically saved as users type (with configurable delay)
- **Progressive capture**: Each field is saved individually as it's filled out
- **Persistence**: Form state persists across page refreshes and browser sessions

### 2. Enhanced Exit Detection
- **X button click**: Captures partial data when users click the close button
- **Idle timeout**: Auto-submits partial data after configurable idle time
- **Mouse leave**: Detects when users move mouse to viewport edges
- **Tab switching**: Captures data when users switch tabs or minimize window
- **Page exit**: Handles browser close, refresh, and navigation events

### 3. Smart Submission Logic
- **Partial vs Complete**: Distinguishes between partial and complete submissions
- **Metadata tracking**: Includes submission type and timing information
- **Database storage**: Saves leads with appropriate status flags
- **Webhook support**: Sends enhanced payloads to configured webhooks

## Configuration Options

### Timeout Settings (in milliseconds)
```typescript
lead_idle_timeout?: number;        // Default: 60000 (1 minute)
lead_auto_save_delay?: number;     // Default: 2000 (2 seconds)
lead_mouse_leave_delay?: number;   // Default: 1000 (1 second)
```

### Example Configuration
```json
{
  "lead_capture_enabled": true,
  "lead_idle_timeout": 300000,     // 5 minutes
  "lead_auto_save_delay": 1500,    // 1.5 seconds
  "lead_mouse_leave_delay": 500    // 0.5 seconds
}
```

## Data Flow

### 1. Form Interaction
```
User types → Auto-save triggered → Data stored in localStorage
```

### 2. Exit Detection
```
Exit event detected → Partial data submitted → Database updated
```

### 3. Complete Submission
```
Form completed → Complete data submitted → Cleanup performed
```

## Database Schema

The leads table includes enhanced fields for tracking partial submissions:

```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY,
  instance_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  status TEXT CHECK (status IN ('partial', 'complete')),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Webhook Payload

Enhanced webhook payloads include metadata about submission type:

```json
{
  "lead_id": "uuid",
  "timestamp": "2024-01-15T10:30:00Z",
  "form": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890"
  },
  "source": {
    "widget_id": "instance-123",
    "company_id": "company-456",
    "company_name": "Example Corp",
    "page_url": "https://example.com"
  },
  "metadata": {
    "is_partial": false,
    "submission_type": "complete"
  }
}
```

## Implementation Details

### Storage Keys
- `lead_form_{instanceId}`: Stores current form state
- `lead_submitted_{instanceId}`: Tracks submission status

### Event Listeners
- `mousemove`, `keypress`, `click`: Activity tracking
- `mouseleave`, `mouseenter`: Exit intent detection
- `visibilitychange`: Tab switching detection
- `beforeunload`, `pagehide`: Page exit detection

### Error Handling
- Graceful degradation if localStorage is unavailable
- Non-blocking webhook failures
- Comprehensive error logging

## Best Practices

### 1. User Experience
- Transparent auto-saving (no visible indicators)
- Smooth transitions between form steps
- Clear feedback on submission status

### 2. Performance
- Debounced auto-save to prevent excessive writes
- Efficient event listener management
- Minimal impact on page performance

### 3. Privacy
- Clear terms and conditions
- Transparent data collection
- Secure data transmission

## Testing

### Manual Testing Scenarios
1. **Partial completion**: Fill email only, then close modal
2. **Idle timeout**: Start form, then leave page idle
3. **Tab switching**: Fill form, switch tabs, return
4. **Browser close**: Fill form, close browser
5. **Complete submission**: Fill all fields and submit

### Automated Testing
- Unit tests for form state management
- Integration tests for webhook delivery
- E2E tests for user interaction flows

## Monitoring

### Key Metrics
- Partial submission rate
- Form completion rate
- Average time to complete
- Exit intent detection accuracy

### Logging
- Form interaction events
- Submission attempts and results
- Error conditions and resolutions

## Future Enhancements

### Potential Improvements
1. **A/B testing**: Different timeout configurations
2. **Analytics**: Detailed user behavior tracking
3. **Retargeting**: Follow-up campaigns for partial leads
4. **Personalization**: Dynamic form fields based on user behavior
5. **Integration**: CRM and marketing automation connections 