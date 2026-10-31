
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { isSuperAdmin } from '@/lib/auth-constants';
import { 
  LifeBuoy, 
  Phone, 
  Settings2, 
  Coins, 
  Users, 
  Workflow, 
  FileCheck,
  ChevronRight,
  ShieldCheck,
  Truck,
  HardHat,
  Quote,
  Lock,
  Mail,
  User,
  UserIcon,
  Tag,
  RotateCcw,
  Fuel
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
    const syncThemeState = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    };

    syncThemeState();
    window.addEventListener('theme-change', syncThemeState);
    return () => window.removeEventListener('theme-change', syncThemeState);
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
    { label: 'User Access', href: '/settings/access', icon: Lock, color: 'text-primary' },
    { label: 'Rewards Setup', href: '/settings/rewards', icon: Coins, color: 'text-amber-600' },
    { label: 'Fuel Rates', href: '/settings/fuel-rates', icon: Fuel, color: 'text-emerald-600' },
    { label: 'Quotes Hub', href: '/settings/quotes', icon: Quote, color: 'text-blue-600' },
    { label: 'User Directory', href: '/settings/users', icon: Users, color: 'text-purple-600' },
    { label: 'Team Mapping', href: '/settings/teams', icon: Workflow, color: 'text-emerald-600' },
    { label: 'Supplier Registry', href: '/registries/suppliers', icon: Truck, color: 'text-indigo-600' },
    { label: 'Contractor Registry', href: '/registries/contractors', icon: HardHat, color: 'text-orange-600' },
    { label: 'Makes Registry', href: '/registries/makes', icon: Tag, color: 'text-slate-600' },
    { label: 'Restore Projects', href: '/settings/restore', icon: RotateCcw, color: 'text-orange-500' },
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
          <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Technical Support</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="rounded-sm border-primary/10 shadow-sm overflow-hidden bg-muted/20">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="bg-background p-3 rounded-full border shadow-sm shrink-0">
                  <UserIcon className="h-6 w-6 text-primary" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-1">For Support</span>
                  <span className="text-base font-black truncate">Khalil Choudhary</span>
                </div>
              </div>
              <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                      <Mail className="h-3.5 w-3.5 text-primary opacity-60" />
                      <a href="mailto:khalil@adityagreenenergy.com" className="hover:underline">khalil@adityagreenenergy.com</a>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                      <Phone className="h-3.5 w-3.5 text-primary opacity-60" />
                      <a href="tel:8983787846" className="hover:underline">8983787846</a>
                  </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-sm border-primary/10 shadow-sm overflow-hidden bg-muted/20">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="bg-background p-3 rounded-full border shadow-sm shrink-0">
                  <UserIcon className="h-6 w-6 text-primary" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-1">For Support</span>
                  <span className="text-base font-black truncate">Abhijeet Bramhawale</span>
                </div>
              </div>
              <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                      <Mail className="h-3.5 w-3.5 text-primary opacity-60" />
                      <a href="mailto:abhijeet.agepl@gmail.com" className="hover:underline">abhijeet.agepl@gmail.com</a>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                      <Phone className="h-3.5 w-3.5 text-primary opacity-60" />
                      <a href="tel:9960769636" className="hover:underline">9960769636</a>
                  </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
