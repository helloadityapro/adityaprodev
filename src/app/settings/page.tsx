'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { LifeBuoy, Phone } from 'lucide-react';

export default function SettingsPage() {
  const [isDarkMode, setIsDarkMode] = React.useState(false);

  React.useEffect(() => {
    const syncState = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    };

    syncState();
    window.addEventListener('theme-change', syncState);
    return () => window.removeEventListener('theme-change', syncState);
  }, []);

  const handleThemeChange = (checked: boolean) => {
    setIsDarkMode(checked);
    if (checked) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    // Notify other components (like ClientShell)
    window.dispatchEvent(new Event('theme-change'));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize the look and feel of the app.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="dark-mode" className="text-base">Dark Mode</Label>
              <p className="text-sm text-muted-foreground">
                Enable dark mode for the application.
              </p>
            </div>
            <Switch
              id="dark-mode"
              checked={isDarkMode}
              onCheckedChange={handleThemeChange}
            />
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Support</CardTitle>
          <CardDescription>Get help and support from our team.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 rounded-lg border p-4">
            <div className="bg-muted p-3 rounded-full">
              <LifeBuoy className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold">Help & Support Email</span>
              <a href="mailto:khalil@adityagreenenergy.com" className="text-sm text-primary hover:underline">
                khalil@adityagreenenergy.com
              </a>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-lg border p-4">
            <div className="bg-muted p-3 rounded-full">
              <Phone className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold">Contact Support</span>
              <a href="tel:9960769636" className="text-sm text-primary hover:underline">
                9960769636
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
