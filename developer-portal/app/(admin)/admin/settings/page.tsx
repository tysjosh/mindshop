'use client';

import { useState } from 'react';
// import { useSession } from 'next-auth/react'; // TODO: Use for API authentication
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Settings as SettingsIcon, 
  Shield, 
  Bell, 
  Key,
  AlertCircle,
  CheckCircle2,
  Save
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SettingsPage() {
  // const { data: session } = useSession(); // TODO: Use session for API calls
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Mock settings state
  const [settings, setSettings] = useState({
    platform: {
      maintenanceMode: false,
      allowNewSignups: true,
      requireEmailVerification: true,
    },
    notifications: {
      emailAlerts: true,
      slackWebhook: '',
      alertThreshold: 100,
    },
    security: {
      sessionTimeout: 3600,
      maxLoginAttempts: 5,
      requireMfa: false,
    },
    api: {
      rateLimitPerMinute: 60,
      maxRequestSize: 10,
      enableCors: true,
    },
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // TODO: Replace with actual API call
      // await apiClient.updateAdminSettings(settings, session?.accessToken!);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      setSuccessMessage('Settings saved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Settings</h1>
          <p className="text-gray-600 mt-1">Configure platform-wide settings and preferences</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {successMessage && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="platform" className="space-y-6">
        <TabsList>
          <TabsTrigger value="platform">
            <SettingsIcon className="h-4 w-4 mr-2" />
            Platform
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="api">
            <Key className="h-4 w-4 mr-2" />
            API
          </TabsTrigger>
        </TabsList>

        {/* Platform Settings */}
        <TabsContent value="platform" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Platform Configuration</CardTitle>
              <CardDescription>General platform settings and features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Maintenance Mode</Label>
                  <p className="text-sm text-gray-600">
                    Temporarily disable the platform for maintenance
                  </p>
                </div>
                <Switch
                  checked={settings.platform.maintenanceMode}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      platform: { ...settings.platform, maintenanceMode: checked },
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow New Signups</Label>
                  <p className="text-sm text-gray-600">
                    Enable new merchant registrations
                  </p>
                </div>
                <Switch
                  checked={settings.platform.allowNewSignups}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      platform: { ...settings.platform, allowNewSignups: checked },
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Email Verification</Label>
                  <p className="text-sm text-gray-600">
                    New users must verify their email address
                  </p>
                </div>
                <Switch
                  checked={settings.platform.requireEmailVerification}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      platform: { ...settings.platform, requireEmailVerification: checked },
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Configuration</CardTitle>
              <CardDescription>Authentication and access control settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="sessionTimeout">Session Timeout (seconds)</Label>
                <Input
                  id="sessionTimeout"
                  type="number"
                  value={settings.security.sessionTimeout}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      security: { ...settings.security, sessionTimeout: parseInt(e.target.value) },
                    })
                  }
                />
                <p className="text-sm text-gray-600">
                  How long before inactive sessions expire
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxLoginAttempts">Max Login Attempts</Label>
                <Input
                  id="maxLoginAttempts"
                  type="number"
                  value={settings.security.maxLoginAttempts}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      security: { ...settings.security, maxLoginAttempts: parseInt(e.target.value) },
                    })
                  }
                />
                <p className="text-sm text-gray-600">
                  Number of failed login attempts before account lockout
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Multi-Factor Authentication</Label>
                  <p className="text-sm text-gray-600">
                    Force all users to enable MFA
                  </p>
                </div>
                <Switch
                  checked={settings.security.requireMfa}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      security: { ...settings.security, requireMfa: checked },
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Configuration</CardTitle>
              <CardDescription>Alert and notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Alerts</Label>
                  <p className="text-sm text-gray-600">
                    Receive email notifications for critical events
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.emailAlerts}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, emailAlerts: checked },
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slackWebhook">Slack Webhook URL</Label>
                <Input
                  id="slackWebhook"
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={settings.notifications.slackWebhook}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, slackWebhook: e.target.value },
                    })
                  }
                />
                <p className="text-sm text-gray-600">
                  Send alerts to Slack channel
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="alertThreshold">Error Alert Threshold</Label>
                <Input
                  id="alertThreshold"
                  type="number"
                  value={settings.notifications.alertThreshold}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, alertThreshold: parseInt(e.target.value) },
                    })
                  }
                />
                <p className="text-sm text-gray-600">
                  Number of errors before sending alert
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Settings */}
        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>API rate limits and security settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="rateLimit">Rate Limit (requests per minute)</Label>
                <Input
                  id="rateLimit"
                  type="number"
                  value={settings.api.rateLimitPerMinute}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      api: { ...settings.api, rateLimitPerMinute: parseInt(e.target.value) },
                    })
                  }
                />
                <p className="text-sm text-gray-600">
                  Maximum API requests per minute per merchant
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxRequestSize">Max Request Size (MB)</Label>
                <Input
                  id="maxRequestSize"
                  type="number"
                  value={settings.api.maxRequestSize}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      api: { ...settings.api, maxRequestSize: parseInt(e.target.value) },
                    })
                  }
                />
                <p className="text-sm text-gray-600">
                  Maximum size for API request payloads
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable CORS</Label>
                  <p className="text-sm text-gray-600">
                    Allow cross-origin requests
                  </p>
                </div>
                <Switch
                  checked={settings.api.enableCors}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      api: { ...settings.api, enableCors: checked },
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Changes to these settings will affect all merchants on the platform. 
          Some changes may require a platform restart to take effect.
        </AlertDescription>
      </Alert>
    </div>
  );
}
