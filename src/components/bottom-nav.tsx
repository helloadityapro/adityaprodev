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
  Navigation
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from '@/components/ui/scroll-area';

/**
 * Bottom navigation bar for mobile devices.
 * Features a centralized "Quick Actions" hub for field operations.
 * Now uses a compact DropdownMenu for a smaller, faster UI.
 */
export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { label: 'Reports', href: '/reports', icon: FileBarChart },
    { label: 'Attendance', href: '/attendance', icon: CalendarCheck },
    // Center is Quick Actions
    { label: 'Rewards', href: '/rewards', icon: Trophy },
    { label: 'Profile', href: '/profile', icon: UserCircle },
  ];

  const quickActions = [
    {
      label: 'Start Site Visit',
      icon: <Navigation className="h-4 w-4 text-indigo-500" />,
      href: '/site-visits/start',
      description: 'Check-in to a project site',
    },
    {
      label: 'Raise PtW',
      icon: <FilePlus className="h-4 w-4 text-blue-500" />,
      href: '/ptw/raise',
      description: 'Create a new Permit',
    },
    {
      label: 'Submit DPR',
      icon: <TableIcon className="h-4 w-4 text-amber-500" />,
      href: '/dpr/submit',
      description: 'Log daily site progress',
    },
    {
      label: 'Record Movement',
      icon: <ArrowLeftRight className="h-4 w-4 text-emerald-500" />,
      href: '/movements/record',
      description: 'Log material flow',
    },
    {
      label: 'Submit Requirement',
      icon: <Package className="h-4 w-4 text-purple-500" />,
      href: '/requirements/submit',
      description: 'Request site materials',
    },
    {
      label: 'Assign Task',
      icon: <CheckSquare className="h-4 w-4 text-slate-500" />,
      href: '/tasks/create',
      description: 'Delegate a new task',
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/80 backdrop-blur-lg pb-safe md:hidden">
      <div className="flex h-16 items-center justify-around px-2">
        {/* Reports & Attendance */}
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
              <span className="text-[10px] tracking-tighter leading-none">{item.label}</span>
            </Link>
          );
        })}

        {/* Quick Actions Central Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex flex-col items-center justify-center w-full h-full cursor-pointer group">
              <div className="bg-primary text-primary-foreground p-2 rounded-full shadow-lg shadow-primary/20 -mt-6 border-4 border-background transition-transform active:scale-90">
                <Plus className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-semibold tracking-tighter leading-none mt-1 text-primary">Actions</span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            side="top" 
            align="center" 
            sideOffset={20}
            className="w-64 rounded-sm shadow-2xl border-primary/10 mb-2 p-1 bg-background/95 backdrop-blur-sm"
          >
            <DropdownMenuLabel className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-2 px-3">
              <Zap className="h-3 w-3 fill-amber-500 text-amber-500" /> 
              QUICK HUB
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ScrollArea className="max-h-[350px]">
              <div className="p-1">
                {quickActions.map((action) => (
                  <DropdownMenuItem
                    key={action.href}
                    onClick={() => router.push(action.href)}
                    className="cursor-pointer py-3 px-3 focus:bg-primary/5 group rounded-sm"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="p-2 bg-muted rounded-sm group-hover:bg-primary/10 transition-colors shrink-0">
                        {action.icon}
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-semibold tracking-tight leading-none mb-1 group-hover:text-primary transition-colors">
                          {action.label}
                        </span>
                        <span className="text-xs text-muted-foreground font-normal tracking-tight truncate">
                          {action.description}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </div>
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Rewards & Profile */}
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
              <span className="text-[10px] tracking-tighter leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
