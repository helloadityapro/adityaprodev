
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { isSuperAdmin } from '@/lib/auth-constants';
import { 
  LifeBuoy, 
  Phone, 
  Settings2, 
  MapPin, 
  Coins, 
  Users, 
  Workflow, 
  FileCheck,
  ChevronRight,
  ShieldCheck,
  Truck,
  HardHat
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isDarkMode, setIsDarkMode] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

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
    window.dispatchEvent(new Event('theme-change'));
  };

  const adminTools = [
    { label: 'Manage Sites', href: '/settings/manage-sites', icon: MapPin, color: 'text-blue-600' },
    { label: 'Rewards Setup', href: '/settings/rewards', icon: Coins, color: 'text-amber-600' },
    { label: 'User Directory', href: '/settings/users', icon: Users, color: 'text-purple-600' },
    { label: 'Team Mapping', href: '/settings/teams', icon: Workflow, color: 'text-emerald-600' },
    { label: 'Supplier Registry', href: '/settings/suppliers', icon: Truck, color: 'text-indigo-600' },
    { label: 'Contractor Registry', href: '/settings/contractors', icon: HardHat, color: 'text-orange-600' },
    { label: 'Permit Management', href: '/settings/permits', icon: FileCheck, color: 'text-primary' },
    { label: 'Dropdown Config', href: '/settings/dropdown-management', icon: Settings2, color: 'text-slate-600' },
  ];

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1>Settings</h1>
        <p className="text-muted-foreground font-medium">Personal preferences and system administration.</p>
      </div>

      {isAdmin && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Administrative Tools</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {adminTools.map((tool) => (
              <Link key={tool.href} href={tool.href}>
                <Card className="hover:bg-muted/50 transition-colors rounded-sm border-primary/10 overflow-hidden group">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 bg-background rounded-sm border shadow-sm", tool.color)}>
                        <tool.icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-bold uppercase tracking-tight">{tool.label}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Preferences</h2>
        </div>
        <Card className="rounded-sm border-primary/10 shadow-sm overflow-hidden">
          <CardContent className="p-0 divide-y">
            <div className="flex items-center justify-between p-6">
              <div className="space-y-0.5">
                <Label htmlFor="dark-mode" className="text-base font-bold">Dark Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Toggle high-contrast dark interface.
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
      </section>
      
      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <LifeBuoy className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Support</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="rounded-sm border-primary/10 shadow-sm overflow-hidden bg-muted/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="bg-background p-3 rounded-full border shadow-sm">
                  <LifeBuoy className="h-6 w-6 text-primary" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black uppercase text-muted-foreground tracking-tighter">Email Support</span>
                  <a href="mailto:khalil@adityagreenenergy.com" className="text-base font-bold text-primary hover:underline">
                    khalil@adityagreenenergy.com
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-sm border-primary/10 shadow-sm overflow-hidden bg-muted/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="bg-background p-3 rounded-full border shadow-sm">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black uppercase text-muted-foreground tracking-tighter">Phone Support</span>
                  <a href="tel:9960769636" className="text-base font-bold text-primary hover:underline">
                    9960769636
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
