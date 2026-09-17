'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, where, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  PlugZap, 
  Search, 
  Building2, 
  ChevronRight, 
  Plus, 
  Activity, 
  CheckCircle2, 
  Clock,
  FilterX
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isSuperAdmin } from '@/lib/auth-constants';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

type Site = { id: string; name: string; projectCompany: string };
type LiaisoningRecord = {
  id: string;
  siteId: string;
  siteName: string;
  completionPercentage: number;
  status: string;
  updatedAt: any;
};

export default function LiaisoningRegistryPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearch, setSiteSearch] = React.useState("");

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites, isLoading: sitesLoading } = useCollection<Site>(sitesQuery);

  const recordsQuery = useMemoFirebase(() => query(collection(firestore, 'liaisoning_records'), orderBy('updatedAt', 'desc')), [firestore]);
  const { data: records, isLoading: recordsLoading } = useCollection<LiaisoningRecord>(recordsQuery);

  const filteredRecords = React.useMemo(() => {
    if (!records) return [];
    return records.filter(r => 
      r.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.status.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [records, searchTerm]);

  const accessibleSites = React.useMemo(() => {
    if (!allSites || !userProfile) return [];
    if (isAdmin) return allSites.sort((a, b) => a.name.localeCompare(b.name));
    
    const assignedIds = new Set(userProfile.assignedProjectIds || []);
    return allSites.filter(s => assignedIds.has(s.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [allSites, userProfile, isAdmin]);

  if (sitesLoading || recordsLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-[500px] w-full" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-sm shrink-0">
              <PlugZap className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">Liaisoning Hub</h1>
              <p className="text-muted-foreground text-sm font-medium uppercase tracking-widest opacity-60">Grid Connectivity & Approval Tracker</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
            <PopoverTrigger asChild>
              <Button className="h-11 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-lg px-8">
                <Plus className="mr-2 h-4 w-4" /> Start New Tracking
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="end">
              <div className="bg-primary/5 p-3 border-b">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Select Project Site</h3>
              </div>
              <div className="flex items-center border-b px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <Input placeholder="Search sites..." className="h-10 border-none" value={siteSearch} onChange={e => setSiteSearch(e.target.value)} />
              </div>
              <ScrollArea className="h-[250px]">
                <div className="p-1">
                  {accessibleSites.filter(s => s.name.toLowerCase().includes(siteSearch.toLowerCase())).map(site => (
                    <Button key={site.id} variant="ghost" className="w-full justify-start h-auto py-3 px-4 mb-0.5 text-xs text-left" onClick={() => router.push(`/liaisoning/manage/${site.id}`)}>
                      <div className="flex flex-col items-start min-w-0">
                        <span className="font-bold truncate w-full uppercase tracking-tight">{site.name}</span>
                        <span className="text-[9px] text-muted-foreground uppercase opacity-60">{site.projectCompany}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search registry by site..." 
            className="pl-10 h-10 text-sm rounded-sm border-primary/20 bg-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-sm font-black uppercase text-[10px] tracking-widest px-3 h-10 border-primary/20 text-primary bg-primary/5">
            {filteredRecords.length} Active Records
          </Badge>
          <Button variant="ghost" size="icon" onClick={() => setSearchTerm("")} className="h-10 w-10 text-muted-foreground rounded-sm">
            <FilterX className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRecords.length > 0 ? filteredRecords.map(record => (
          <Card key={record.id} className="group hover:shadow-xl transition-all duration-300 rounded-sm border-primary/10 overflow-hidden flex flex-col cursor-pointer" onClick={() => router.push(`/liaisoning/manage/${record.siteId}`)}>
            <CardHeader className="bg-primary/5 border-b p-5">
               <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1 min-w-0">
                     <CardTitle className="text-lg font-black uppercase tracking-tight truncate text-foreground group-hover:text-primary transition-colors">{record.siteName}</CardTitle>
                     <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                        <Building2 className="h-3 w-3" />
                        {allSites?.find(s => s.id === record.siteId)?.projectCompany || '—'}
                     </p>
                  </div>
                  <Badge variant="outline" className={cn(
                    "rounded-sm font-black uppercase text-[8px] h-5 px-1.5 border-primary/20",
                    record.status === 'Completed' ? "bg-green-50 text-green-700 border-green-200" : "bg-primary/5 text-primary"
                  )}>
                    {record.status}
                  </Badge>
               </div>
            </CardHeader>
            <CardContent className="p-6 flex-1 space-y-6">
               <div className="space-y-3">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                     <span>Global Progress</span>
                     <span className="text-primary">{record.completionPercentage}%</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden border border-border/50">
                     <div 
                        className="h-full bg-primary transition-all duration-1000" 
                        style={{ width: `${record.completionPercentage}%` }} 
                     />
                  </div>
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                     <div className="bg-primary/10 p-2 rounded-sm"><Activity className="h-4 w-4 text-primary" /></div>
                     <div className="flex flex-col">
                        <span className="text-[8px] font-black text-muted-foreground uppercase">Next Milestone</span>
                        <span className="text-[10px] font-bold uppercase truncate max-w-[100px]">Approval Pending</span>
                     </div>
                  </div>
                  <div className="flex items-center gap-3">
                     <div className="bg-primary/10 p-2 rounded-sm"><Clock className="h-4 w-4 text-primary" /></div>
                     <div className="flex flex-col">
                        <span className="text-[8px] font-black text-muted-foreground uppercase">Last Activity</span>
                        <span className="text-[10px] font-bold uppercase">{record.updatedAt ? format(record.updatedAt.toDate(), 'dd MMM') : '—'}</span>
                     </div>
                  </div>
               </div>
            </CardContent>
            <CardFooter className="bg-muted/10 border-t p-4 flex justify-end">
               <Button variant="ghost" size="sm" className="h-8 rounded-sm font-black text-[10px] uppercase tracking-widest group-hover:bg-primary group-hover:text-white transition-all">
                  Manage Tracker <ChevronRight className="h-3.5 w-3.5 ml-1.5" />
               </Button>
            </CardFooter>
          </Card>
        )) : (
          <div className="col-span-full py-32 flex flex-col items-center justify-center text-center gap-4 bg-muted/5 border-2 border-dashed rounded-sm opacity-40">
             <PlugZap className="h-16 w-16 text-muted-foreground/30" />
             <p className="text-sm font-bold uppercase tracking-widest">No liaisoning records found</p>
          </div>
        )}
      </div>
    </div>
  );
}
