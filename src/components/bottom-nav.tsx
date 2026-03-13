'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  FileBarChart, 
  CalendarCheck, 
  Trophy, 
  UserCircle,
  Plus,
  Zap,
  FilePlus,
  Table as TableIcon,
  ArrowLeftRight,
  Package,
  CheckSquare,
  Navigation,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';

/**
 * Bottom navigation bar for mobile devices.
 * Features a centralized "Quick Actions" hub for field operations.
 */
export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { label: 'Reports', href: '/reports', icon: FileBarChart },
    { label: 'Attendance', href: '/attendance', icon: CalendarCheck },
    // Center is Quick Actions (handled separately below)
    { label: 'Rewards', href: '/rewards', icon: Trophy },
    { label: 'Profile', href: '/profile', icon: UserCircle },
  ];

  const quickActions = [
    {
      label: 'Start Site Visit',
      icon: <Navigation className="h-5 w-5 text-indigo-500" />,
      href: '/site-visits/start',
      description: 'Check-in to a project site',
    },
    {
      label: 'Raise PtW',
      icon: <FilePlus className="h-5 w-5 text-blue-500" />,
      href: '/ptw/raise',
      description: 'Create a new Permit to Work',
    },
    {
      label: 'Submit DPR',
      icon: <TableIcon className="h-5 w-5 text-amber-500" />,
      href: '/dpr/submit',
      description: 'Log daily site progress',
    },
    {
      label: 'Record Movement',
      icon: <ArrowLeftRight className="h-5 w-5 text-emerald-500" />,
      href: '/movements/record',
      description: 'Log material flow',
    },
    {
      label: 'Submit Requirement',
      icon: <Package className="h-5 w-5 text-purple-500" />,
      href: '/requirements/submit',
      description: 'Request site materials',
    },
    {
      label: 'Assign Task',
      icon: <CheckSquare className="h-5 w-5 text-slate-500" />,
      href: '/tasks/create',
      description: 'Delegate a new task',
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/80 backdrop-blur-lg pb-safe md:hidden">
      <div className="flex h-16 items-center justify-around px-2">
        {/* First 2 Items */}
        {navItems.slice(0, 2).map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-full h-full transition-colors",
                isActive ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "fill-primary/10")} />
              <span className="text-[10px] uppercase tracking-tighter leading-none">{item.label}</span>
            </Link>
          );
        })}

        {/* Quick Actions Central Button */}
        <Dialog>
          <DialogTrigger asChild>
            <div className="flex flex-col items-center justify-center w-full h-full cursor-pointer group">
              <div className="bg-primary text-primary-foreground p-2 rounded-full shadow-lg shadow-primary/20 -mt-6 border-4 border-background transition-transform active:scale-90">
                <Plus className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-tighter leading-none mt-1 text-primary">Actions</span>
            </div>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md p-0 border-none rounded-t-xl rounded-b-none bottom-0 top-auto translate-y-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-300">
            <div className="bg-background p-6 space-y-6">
              <DialogHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="space-y-1">
                  <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                    <Zap className="h-5 w-5 fill-amber-500 text-amber-500" /> Quick Hub
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Site Operations</p>
                </div>
                <DialogClose asChild>
                  <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                    <X className="h-5 w-5" />
                  </Button>
                </DialogClose>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-3">
                {quickActions.map((action, idx) => (
                  <DialogClose key={action.href} asChild>
                    <button
                      onClick={() => router.push(action.href)}
                      className={cn(
                        "flex items-center gap-4 p-4 w-full rounded-sm bg-muted/30 hover:bg-primary/5 border border-transparent hover:border-primary/10 transition-all text-left animate-in fade-in slide-in-from-bottom-2",
                        `duration-${(idx + 1) * 100}`
                      )}
                    >
                      <div className="p-2 bg-white rounded-sm shadow-sm">
                        {action.icon}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-black uppercase tracking-tight leading-none mb-1">{action.label}</span>
                        <span className="text-[10px] text-muted-foreground font-medium">{action.description}</span>
                      </div>
                    </button>
                  </DialogClose>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Last 2 Items */}
        {navItems.slice(2).map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-full h-full transition-colors",
                isActive ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "fill-primary/10")} />
              <span className="text-[10px] uppercase tracking-tighter leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}