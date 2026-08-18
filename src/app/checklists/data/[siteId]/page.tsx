
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  LayoutGrid, 
  Zap, 
  ChevronRight, 
  Building2,
  Cpu,
  GlassWater
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

export default function ProjectChecklistHubPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = React.use(params);
  const firestore = useFirestore();
  const router = useRouter();

  const siteRef = useMemoFirebase(() => doc(firestore, 'sites', siteId), [firestore, siteId]);
  const { data: site, isLoading: siteLoading } = useDoc<any>(siteRef);

  if (siteLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!site) return <div className="p-12 text-center italic">Project site not found.</div>;

  return (
    <div className="p-4 sm:p-8 space-y-8 animate-in fade-in duration-500">
      <Button 
        variant="link" 
        size="sm" 
        onClick={() => router.push('/checklists/data')} 
        className="p-0 h-auto text-primary font-bold hover:no-underline"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Registry
      </Button>

      <div className="flex items-center gap-4">
        <div className="bg-primary/10 p-3 rounded-lg shrink-0 shadow-sm border border-primary/5">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-0.5 min-w-0">
          <h1 className="text-xl font-black text-foreground tracking-tight leading-none truncate">
            {site.name}
          </h1>
          <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] truncate">
            {site.projectCompany}
          </p>
        </div>
      </div>

      <Separator className="bg-border/50" />

      <div className="space-y-1">
        <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.25em] px-1 mb-4">Authorized Checklists</h2>
        
        {/* MMS */}
        <div 
          onClick={() => router.push(`/checklists/data/${siteId}/mms`)}
          className="group flex items-center justify-between p-3 rounded-lg border border-transparent hover:bg-primary/[0.03] hover:border-primary/10 transition-all cursor-pointer active:scale-[0.99]"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="p-2.5 bg-muted rounded-md group-hover:bg-primary/10 transition-colors shrink-0">
              <LayoutGrid className="h-5 w-5 text-primary opacity-70 group-hover:opacity-100" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">Table Level MMS</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">Structural Audit Logs</span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-all group-hover:translate-x-0.5" />
        </div>

        <div className="py-1 px-1"><Separator className="opacity-30" /></div>

        {/* Inverter */}
        <div 
          onClick={() => router.push(`/checklists/data/${siteId}/inverter`)}
          className="group flex items-center justify-between p-3 rounded-lg border border-transparent hover:bg-primary/[0.03] hover:border-primary/10 transition-all cursor-pointer active:scale-[0.99]"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="p-2.5 bg-muted rounded-md group-hover:bg-primary/10 transition-colors shrink-0">
              <Cpu className="h-5 w-5 text-primary opacity-70 group-hover:opacity-100" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">Inverter Checklist</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">Equipment Quality Registry</span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-all group-hover:translate-x-0.5" />
        </div>

        <div className="py-1 px-1"><Separator className="opacity-30" /></div>

        {/* HT Line */}
        <div 
          onClick={() => router.push(`/checklists/data/${siteId}/ht-line`)}
          className="group flex items-center justify-between p-3 rounded-lg border border-transparent hover:bg-muted/50 transition-all cursor-pointer active:scale-[0.99]"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="p-2.5 bg-muted rounded-md shrink-0">
              <Zap className="h-5 w-5 text-muted-foreground/60" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-foreground truncate">HT Line Checklist</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">HV Transmission Audit</span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:translate-x-0.5 transition-transform" />
        </div>

        <div className="py-1 px-1"><Separator className="opacity-30" /></div>

        {/* HT Conductor */}
        <div 
          onClick={() => router.push(`/checklists/data/${siteId}/ht-conductor`)}
          className="group flex items-center justify-between p-3 rounded-lg border border-transparent hover:bg-muted/50 transition-all cursor-pointer active:scale-[0.99]"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="p-2.5 bg-muted rounded-md shrink-0">
              <Zap className="h-5 w-5 text-primary opacity-60" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-foreground truncate">HT Conductor Checklist</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">Pole Distance Audits</span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:translate-x-0.5 transition-transform" />
        </div>

        <div className="py-1 px-1"><Separator className="opacity-30" /></div>

        {/* Module Breakage */}
        <div 
          onClick={() => router.push(`/checklists/data/${siteId}/module-breakage`)}
          className="group flex items-center justify-between p-3 rounded-lg border border-transparent hover:bg-primary/[0.03] hover:border-primary/10 transition-all cursor-pointer active:scale-[0.99]"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="p-2.5 bg-muted rounded-md group-hover:bg-primary/10 transition-colors shrink-0">
              <GlassWater className="h-5 w-5 text-primary opacity-70 group-hover:opacity-100" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">Module Breakage Data</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">Damage Registry & Photos</span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-all group-hover:translate-x-0.5" />
        </div>
      </div>
    </div>
  );
}
