'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Plus,
  Zap,
  FilePlus,
  Table as TableIcon,
  ArrowLeftRight,
  Package,
  CheckSquare,
  Navigation,
  BarChart3,
  CalendarDays,
  Trophy,
  User
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
 * Modern minimal icon-only design for a cleaner mobile interface.
 */
export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  // Modern minimal icon selection
  const navItems = [
    { label: 'Reports', href: '/reports', icon: BarChart3 },
    { label: 'Attendance', href: '/attendance', icon: CalendarDays },
    // Center position is reserved for Quick Actions
    { label: 'Rewards', href: '/rewards', icon: Trophy },
    { label: 'Profile', href: '/profile', icon: User },
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/80 backdrop-blur-xl pb-safe md:hidden shadow-[0_-4px_20px_0_rgba(0,0,0,0.05)]">
      <div className="flex h-16 items-center justify-around px-2">
        {/* Left Side: Reports & Attendance */}
        {navItems.slice(0, 2).map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-center w-full h-full transition-all duration-300",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "p-2.5 rounded-xl transition-all duration-300",
                isActive && "bg-primary/10 scale-110 shadow-sm"
              )}>
                <Icon className={cn("h-6 w-6", isActive && "stroke-[2.5px]")} />
              </div>
            </Link>
          );
        })}

        {/* Center: Quick Actions Floating Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center justify-center w-full h-full cursor-pointer group">
              <div className="bg-primary text-primary-foreground p-3.5 rounded-full shadow-xl shadow-primary/30 -mt-8 border-[6px] border-background transition-all duration-300 group-active:scale-90 group-hover:scale-105">
                <Plus className="h-6 w-6 stroke-[3.5px]" />
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            side="top" 
            align="center" 
            sideOffset={20}
            className="w-56 rounded-xl shadow-2xl border-primary/10 mb-2 p-1 bg-background/95 backdrop-blur-md"
          >
            <DropdownMenuLabel className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 py-2.5 px-3 font-body">
              <Zap className="h-3 w-3 fill-amber-500 text-amber-500" /> 
              QUICKLY
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-primary/5" />
            <ScrollArea className="max-h-[60vh]">
              <div className="p-1">
                {quickActions.map((action) => (
                  <DropdownMenuItem
                    key={action.href}
                    onClick={() => router.push(action.href)}
                    className="cursor-pointer py-3 px-3 focus:bg-primary/5 group rounded-lg mb-0.5 font-body"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="p-2 bg-muted/50 rounded-lg group-hover:bg-primary/10 transition-colors shrink-0">
                        {action.icon}
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-bold tracking-tight leading-none mb-1 group-hover:text-primary transition-colors">
                          {action.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium tracking-tight truncate">
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

        {/* Right Side: Rewards & Profile */}
        {navItems.slice(2).map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-center w-full h-full transition-all duration-300",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "p-2.5 rounded-xl transition-all duration-300",
                isActive && "bg-primary/10 scale-110 shadow-sm"
              )}>
                <Icon className={cn("h-6 w-6", isActive && "stroke-[2.5px]")} />
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
