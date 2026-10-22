'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Zap,
  FilePlus,
  Table as TableIcon,
  ArrowLeftRight,
  Package,
  CheckSquare,
  Plus,
  Navigation,
  Fuel,
  ClipboardList,
  NotebookPen,
  Wallet
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion } from 'framer-motion';
import { type PageKey } from '@/lib/access-control';

interface QuickActionsProps {
  canShow: (key: PageKey) => boolean;
}

export function QuickActions({ canShow }: QuickActionsProps) {
  const router = useRouter();

  const actions = [
    {
      label: 'Start Review Meeting',
      icon: <NotebookPen className="mr-2 h-4 w-4 text-indigo-500" />,
      href: '/meetings/start',
      description: 'Record on-site discussion',
      key: 'meetings' as PageKey
    },
    {
      label: 'Start Site Visit',
      icon: <Navigation className="mr-2 h-4 w-4 text-blue-500" />,
      href: '/site-visits/start',
      description: 'Check-in to a project site',
      key: 'visits' as PageKey
    },
    {
      label: 'Request a Vehicle',
      icon: <Fuel className="mr-2 h-4 w-4 text-orange-500" />,
      href: '/vehicles/request',
      description: 'Allotment for site trip',
      key: 'trips' as PageKey
    },
    {
      label: 'Material Requisition',
      icon: <ClipboardList className="mr-2 h-4 w-4 text-primary" />,
      href: '/requisitions/submit',
      description: 'Formal request from catalog',
      key: 'requisitions' as PageKey
    },
    {
      label: 'Submit Expense',
      icon: <Wallet className="mr-2 h-4 w-4 text-indigo-600" />,
      href: '/expenses/submit',
      description: 'Request reimbursement',
      key: 'expenses' as PageKey
    },
    {
      label: 'Request PtW',
      icon: <FilePlus className="mr-2 h-4 w-4 text-blue-500" />,
      href: '/ptw/raise',
      description: 'Request a new Permit to Work',
      key: 'permits' as PageKey
    },
    {
      label: 'Submit DPR',
      icon: <TableIcon className="mr-2 h-4 w-4 text-amber-500" />,
      href: '/dpr/submit',
      description: 'Log daily site progress',
      key: 'dpr' as PageKey
    },
    {
      label: 'Record Movement',
      icon: <ArrowLeftRight className="mr-2 h-4 w-4 text-emerald-500" />,
      href: '/movements/record',
      description: 'Log material flow',
      key: 'inventory' as PageKey
    },
    {
      label: 'Submit Requirement',
      icon: <Package className="mr-2 h-4 w-4 text-purple-500" />,
      href: '/requirements/submit',
      description: 'Request site materials',
      key: 'requirements' as PageKey
    },
    {
      label: 'Assign Task',
      icon: <CheckSquare className="mr-2 h-4 w-4 text-slate-500" />,
      href: '/tasks/create',
      description: 'Delegate a new task',
      key: 'tasks' as PageKey
    },
  ];

  const filteredActions = actions.filter(action => canShow(action.key));

  if (filteredActions.length === 0) return null;

  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button variant="default" size="icon" className="relative h-8 w-8 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 border-none">
                  <Plus className="h-5 w-5" />
                  <span className="sr-only">Quick Actions</span>
                </Button>
              </motion.div>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Quick Actions</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end" className="w-56 rounded-sm shadow-xl border-primary/10">
        <DropdownMenuLabel className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          <Zap className="h-3 w-3 fill-amber-500 text-amber-500" /> 
          QUICKLY
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {filteredActions.map((action) => (
          <DropdownMenuItem
            key={action.href}
            onClick={() => router.push(action.href)}
            className="cursor-pointer py-2.5 focus:bg-primary/5 group"
          >
            <div className="flex items-center w-full">
              {action.icon}
              <div className="flex flex-col">
                <span className="text-sm font-bold group-hover:text-primary transition-colors">
                  {action.label}
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  {action.description}
                </span>
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
