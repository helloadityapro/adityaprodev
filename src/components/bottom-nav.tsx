'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  FileBarChart, 
  CalendarCheck, 
  ListTodo, 
  Trophy, 
  UserCircle 
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Bottom navigation bar for mobile devices.
 * Provides quick access to high-traffic areas of the application.
 */
export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Reports', href: '/reports', icon: FileBarChart },
    { label: 'Attendance', href: '/attendance', icon: CalendarCheck },
    { label: 'Tasks', href: '/tasks/list', icon: ListTodo },
    { label: 'Rewards', href: '/rewards', icon: Trophy },
    { label: 'Profile', href: '/profile', icon: UserCircle },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/80 backdrop-blur-lg pb-safe md:hidden">
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href) || 
                          (item.href === '/attendance' && pathname.startsWith('/attendance'));
          
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
