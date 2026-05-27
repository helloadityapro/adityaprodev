'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  LayoutGrid, 
  Zap, 
  ChevronRight, 
  Database,
  Building2,
  Clock
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!site) return <div className="p-12 text-center italic">Project site not found.</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.push('/checklists/data')} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Registry
        </Button>
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-sm shrink-0">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">{site.name}</h1>
            <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">{site.projectCompany}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* MMS Checklist Option */}
        <Card 
          className="group hover:shadow-xl transition-all duration-300 border-primary/10 rounded-sm overflow-hidden cursor-pointer bg-card"
          onClick={() => router.push(`/checklists/data/${siteId}/mms`)}
        >
          <CardHeader className="bg-muted/5 border-b py-6 flex flex-row items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 text-primary rounded-sm group-hover:bg-primary group-hover:text-white transition-all duration-300">
                <LayoutGrid className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-lg font-black uppercase tracking-tight group-hover:text-primary transition-colors">Table Level MMS</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Structural Audit Logs</CardDescription>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary transition-all group-hover:translate-x-1" />
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground leading-relaxed font-medium">
              View granular audit data for mounting structures, including torque verification, component alignment, and visual evidence per table numbering.
            </p>
          </CardContent>
          <div className="px-6 pb-6 mt-auto">
            <Button className="w-full rounded-sm font-black uppercase text-[10px] tracking-widest shadow-md">
              Access MMS Data
            </Button>
          </div>
        </Card>

        {/* HT Line Checklist Option (Placeholder) */}
        <Card 
          className="group relative hover:shadow-md transition-all duration-300 border-primary/5 rounded-sm overflow-hidden bg-card opacity-90"
          onClick={() => router.push(`/checklists/data/${siteId}/ht-line`)}
        >
          <CardHeader className="bg-muted/5 border-b py-6 flex flex-row items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-muted text-muted-foreground rounded-sm group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                <Zap className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-lg font-black uppercase tracking-tight">HT Line Checklist</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest">HV Transmission Audit</CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="bg-amber-500 text-white border-none rounded-sm px-2 h-5 font-black uppercase text-[8px] tracking-tighter animate-pulse">
                Updating Soon
            </Badge>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground leading-relaxed font-medium italic">
              Verification parameters for High Tension transmission lines, pole alignment, sag monitoring, and technical clearance logs.
            </p>
          </CardContent>
          <div className="px-6 pb-6 mt-auto">
            <Button variant="outline" className="w-full rounded-sm font-bold uppercase text-[10px] tracking-widest border-primary/10 text-muted-foreground">
              <Clock className="h-3.5 w-3.5 mr-2" /> Maintenance in progress
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
