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
  Building2
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
    <div className="p-4 sm:p-8 space-y-10 animate-in fade-in duration-500">
      {/* Back button */}
      <Button 
        variant="link" 
        size="sm" 
        onClick={() => router.push('/checklists/data')} 
        className="p-0 h-auto text-primary font-bold hover:no-underline"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Registry
      </Button>

      {/* Header Section */}
      <div className="flex items-center gap-5">
        <div className="bg-primary/10 p-5 rounded-2xl shrink-0 shadow-sm">
          <Building2 className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight leading-none truncate">
            {site.name}
          </h1>
          <p className="text-sm font-bold text-muted-foreground/70 truncate">
            {site.projectCompany}
          </p>
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* Checklist Options List */}
      <div className="space-y-2">
        {/* Option 1: MMS */}
        <div 
          onClick={() => router.push(`/checklists/data/${siteId}/mms`)}
          className="group flex items-center justify-between p-4 rounded-2xl border border-transparent hover:bg-muted/5 transition-all cursor-pointer active:scale-[0.98]"
        >
          <div className="flex items-center gap-4">
            <div className="p-4 bg-primary/5 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
              <LayoutGrid className="h-7 w-7" />
            </div>
            <div className="space-y-0.5">
              <p className="text-base sm:text-lg font-black text-foreground uppercase tracking-tight">Table Level MMS</p>
              <p className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-[0.15em]">Structural Audit Logs</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary transition-all group-hover:translate-x-1" />
        </div>

        <div className="px-4">
           <Separator className="opacity-40" />
        </div>

        {/* Option 2: HT Line */}
        <div 
          onClick={() => router.push(`/checklists/data/${siteId}/ht-line`)}
          className="group flex items-center justify-between p-4 rounded-2xl border border-transparent hover:bg-muted/5 transition-all cursor-pointer active:scale-[0.98]"
        >
          <div className="flex items-center gap-4">
            <div className="p-4 bg-muted text-muted-foreground rounded-2xl group-hover:bg-amber-500 group-hover:text-white transition-all shadow-sm">
              <Zap className="h-7 w-7" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-3">
                <p className="text-base sm:text-lg font-black text-foreground uppercase tracking-tight">HT Line Checklist</p>
                <Badge className="bg-orange-100 text-orange-600 hover:bg-orange-100 border-none rounded-full h-5 text-[9px] font-black uppercase px-2 shadow-sm tracking-tighter">In Progress</Badge>
              </div>
              <p className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-[0.15em]">HV Transmission Audit</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary transition-all group-hover:translate-x-1" />
        </div>
      </div>
    </div>
  );
}
