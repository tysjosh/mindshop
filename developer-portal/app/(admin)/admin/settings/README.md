# Admin Settings Page

Platform-wide configuration and settings management for administrators.

## Features

### Platform Settings
- **Maintenance Mode** - Temporarily disable platform access
- **Allow New Signups** - Control merchant registration
- **Email Verification** - Require email verification for new accounts

### Security Settings
- **Session Timeout** - Configure session expiration time
- **Max Login Attempts** - Set lockout threshold for failed logins
- **Multi-Factor Authentication** - Require MFA for all users

### Notification Settings
- **Email Alerts** - Enable/disable email notifications
- **Slack Integration** - Configure Slack webhook for alerts
- **Alert Thresholds** - Set error count before triggering alerts

### API Settings
- **Rate Limiting** - Configure requests per minute limits
- **Max Request Size** - Set maximum payload size
- **CORS Configuration** - Enable/disable cross-origin requests

## Implementation

Currently using local state. To integrate with backend:

1. Create admin settings endpoints:
   ```typescript
   GET  /api/admin/settings
   PUT  /api/admin/settings
   ```

2. Add to API client:
   ```typescript
   async getAdminSettings(token: string): Promise<AdminSettings> {
     return this.request<AdminSettings>('/admin/settings', {
       headers: { Authorization: `Bearer ${token}` },
     });
   }

   async updateAdminSettings(
     settings: AdminSettings,
     token: string
   ): Promise<AdminSettings> {
     return this.request<AdminSettings>('/admin/settings', {
       method: 'PUT',
       headers: { Authorization: `Bearer ${token}` },
       body: JSON.stringify(settings),
     });
   }
   ```

3. Load settings on mount and save on button click

## Settings Structure

```typescript
interface AdminSettings {
  platform: {
    maintenanceMode: boolean;
    allowNewSignups: boolean;
    requireEmailVerification: boolean;
  };
  notifications: {
    emailAlerts: boolean;
    slackWebhook: string;
    alertThreshold: number;
  };
  security: {
    sessionTimeout: number;
    maxLoginAttempts: number;
    requireMfa: boolean;
  };
  api: {
    rateLimitPerMinute: number;
    maxRequestSize: number;
    enableCors: true;
  };
}
```

## Security Considerations

- All settings changes should be logged for audit trail
- Sensitive settings (like webhooks) should be encrypted at rest
- Changes to security settings should trigger notifications
- Some settings may require platform restart
- Validate all input values before saving

## Future Enhancements

- [ ] Add settings history/audit log
- [ ] Implement settings rollback functionality
- [ ] Add validation rules for each setting
- [ ] Create setting presets/templates
- [ ] Add bulk import/export of settings
- [ ] Implement setting change notifications
- [ ] Add confirmation dialogs for critical changes
- [ ] Create settings documentation/help text
