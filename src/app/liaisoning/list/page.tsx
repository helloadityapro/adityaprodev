'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, where, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
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
  FilterX, 
  Trash2, 
  HardHat, 
  AlertCircle, 
  LayoutGrid, 
  List 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isSuperAdmin } from '@/lib/auth-constants';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from '@/hooks/use-toast';

type Site = { id: string; name: string; projectCompany: string };

type LiaisoningRecord = {
  id: string;
  siteId: string;
  siteName: string;
  completionPercentage: number;
  status: string;
  updatedAt: any;
  stages: Record<string, { status: string }>;
  contractorName?: string;
};

const STAGE_LABELS: Record<string, string> = {
  grid_connectivity: 'Grid Connectivity',
  estimate_approval: 'Estimate Approval',
  estimate_sanction: 'Estimate Sanction',
  supervision_testing: 'Supervision & Testing',
  material_inspection: 'Material Inspection',
  work_progress: 'Work Progress',
  wcr: 'WCR Submission',
  pre_commissioning: 'Pre-Commissioning',
  format_ii_approval: 'Format II Approval',
  ptc: 'PTC Issuance',
  clearance: 'Clearance Certificate',
  commissioning: 'Final Commissioning',
  commissioning_certificate: 'Commissioning Certificate (SE-O&M)'
};

const STAGE_ORDER = [
  'grid_connectivity', 'estimate_approval', 'estimate_sanction', 
  'supervision_testing', 'material_inspection', 'work_progress', 
  'wcr', 'pre_commissioning', 'format_ii_approval', 'ptc', 
  'clearance', 'commissioning', 'commissioning_certificate'
];

export default function LiaisoningRegistryPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [viewMode, setViewMode] = React.useState<'card' | 'table'>('card');
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearch, setSiteSearch] = React.useState("");
  const [deletingRecordId, setDeletingRecordId] = React.useState<string | null>(null);

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
      r.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.contractorName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [records, searchTerm]);

  const accessibleSites = React.useMemo(() => {
    if (!allSites) return [];
    return [...allSites].sort((a, b) => a.name.localeCompare(b.name));
  }, [allSites]);

  const handleDelete = async () => {
    if (!deletingRecordId) return;
    try {
      await deleteDocumentNonBlocking(doc(firestore, 'liaisoning_records', deletingRecordId));
      toast({ title: 'Record Removed', description: 'The site tracker has been deleted.' });
      setDeletingRecordId(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
    }
  };

  if (sitesLoading || recordsLoading) return <div className="p-4 sm:p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-[500px] w-full" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-1">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2.5 rounded-sm shrink-0">
                <PlugZap className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">Track Progress</h1>
                <p className="text-muted-foreground text-sm font-medium uppercase tracking-widest opacity-60">Grid Connectivity & Approval Tracker</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
              <PopoverTrigger asChild>
                <Button className="h-11 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-lg px-8">
                  <Plus className="mr-2 h-4 w-4" /> Start New Site
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <div className="bg-primary/5 p-3 border-b">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Select Project Site</h3>
                </div>
                <div className="flex items-center border-b px-3">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <Input placeholder="Search sites..." className="h-10 border-none focus-visible:ring-0" value={siteSearch} onChange={e => setSiteSearch(e.target.value)} />
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
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm no-print">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by site or contractor..." 
              className="pl-10 h-11 text-sm rounded-sm border-primary/20 bg-background"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center bg-muted/50 p-1 rounded-sm border border-primary/10">
            <Button 
              variant={viewMode === 'card' ? 'default' : 'ghost'} 
              size="icon" 
              className="h-8 w-8 rounded-sm"
              onClick={() => setViewMode('card')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === 'table' ? 'default' : 'ghost'} 
              size="icon" 
              className="h-8 w-8 rounded-sm"
              onClick={() => setViewMode('table')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
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

      {viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecords.length > 0 ? filteredRecords.map(record => {
            const nextStageKey = STAGE_ORDER.find(key => record.stages?.[key]?.status !== 'Completed');
            const nextMilestoneLabel = nextStageKey ? STAGE_LABELS[nextStageKey] : 'All Completed';

            return (
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
                   {record.contractorName && (
                     <div className="flex items-center gap-2 mb-4">
                        <HardHat className="h-3.5 w-3.5 text-primary opacity-60" />
                        <span className="text-[10px] font-black uppercase tracking-tight text-foreground/80 truncate">
                          {record.contractorName}
                        </span>
                     </div>
                   )}

                   <div className="space-y-3">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                         <span>Progress</span>
                         <span className="text-primary">{record.completionPercentage}%</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden border border-border/50">
                         <div 
                            className="h-full bg-primary transition-all duration-1000 shadow-[0_0_10px_rgba(45,115,255,0.4)]" 
                            style={{ width: `${record.completionPercentage}%` }} 
                         />
                      </div>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                         <div className="bg-primary/10 p-2 rounded-sm"><Activity className="h-4 w-4 text-primary" /></div>
                         <div className="flex flex-col min-w-0">
                            <span className="text-[8px] font-black text-muted-foreground uppercase">Pending Stage</span>
                            <span className="text-[10px] font-bold uppercase leading-tight line-clamp-2">
                              {nextMilestoneLabel}
                            </span>
                         </div>
                      </div>
                      <div className="flex items-center gap-3">
                         <div className="bg-primary/10 p-2 rounded-sm"><Clock className="h-4 w-4 text-primary" /></div>
                         <div className="flex flex-col">
                            <span className="text-[8px] font-black text-muted-foreground uppercase">Activity Date</span>
                            <span className="text-[10px] font-bold uppercase">{record.updatedAt ? format(record.updatedAt.toDate(), 'dd MMM') : '—'}</span>
                         </div>
                      </div>
                   </div>
                </CardContent>
                <CardFooter className="bg-muted/10 border-t p-3 flex justify-between items-center">
                   {isAdmin && (
                     <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-sm" 
                      onClick={(e) => { e.stopPropagation(); setDeletingRecordId(record.id); }}
                     >
                       <Trash2 className="h-4 w-4" />
                     </Button>
                   )}
                   <Button variant="ghost" size="sm" className="h-8 rounded-sm font-black text-[10px] uppercase tracking-widest group-hover:bg-primary group-hover:text-white transition-all ml-auto">
                      Details <ChevronRight className="h-3.5 w-3.5 ml-1.5" />
                   </Button>
                </CardFooter>
              </Card>
            );
          }) : (
            <div className="col-span-full py-32 flex flex-col items-center justify-center text-center gap-4 bg-muted/5 border-2 border-dashed rounded-sm opacity-40">
               <PlugZap className="h-16 w-16 text-muted-foreground/30" />
               <p className="text-sm font-bold uppercase tracking-widest">No active trackers found</p>
            </div>
          )}
        </div>
      ) : (
        <Card className="rounded-sm border-primary/10 shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="px-6 font-black uppercase text-[10px] tracking-widest">Site Name & Client</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Completion</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Next Milestone</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Contractor</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Last Activity</TableHead>
                  <TableHead className="text-right px-6 font-black uppercase text-[10px] tracking-widest">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length > 0 ? filteredRecords.map(record => {
                  const nextStageKey = STAGE_ORDER.find(key => record.stages?.[key]?.status !== 'Completed');
                  const nextMilestoneLabel = nextStageKey ? STAGE_LABELS[nextStageKey] : 'All Completed';

                  return (
                    <TableRow key={record.id} className="hover:bg-muted/5 cursor-pointer group" onClick={() => router.push(`/liaisoning/manage/${record.siteId}`)}>
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-black text-sm text-foreground group-hover:text-primary transition-colors">{record.siteName}</span>
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{allSites?.find(s => s.id === record.siteId)?.projectCompany || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5 min-w-[120px]">
                           <div className="flex justify-between items-center text-[9px] font-black">
                              <span className="text-primary">{record.completionPercentage}%</span>
                           </div>
                           <Progress value={record.completionPercentage} className="h-1" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-sm font-bold text-[9px] uppercase bg-primary/5 text-primary border-primary/10">
                           {nextMilestoneLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {record.contractorName ? (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                            <HardHat className="h-3 w-3" />
                            {record.contractorName}
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="font-mono text-[10px] font-bold text-muted-foreground">
                        {record.updatedAt ? format(record.updatedAt.toDate(), 'dd MMM yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-right px-6" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => setDeletingRecordId(record.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic uppercase font-black text-[10px] opacity-20">No matching records</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deletingRecordId} onOpenChange={(o) => !o && setDeletingRecordId(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive font-black uppercase tracking-tight">
              <AlertCircle className="h-5 w-5" /> Delete Site Tracker?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium leading-relaxed">
              This will permanently remove the Liaisoning progress record and all attached documentation for this site. This action cannot be reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90 rounded-sm font-black uppercase text-[10px]">
              Confirm Purge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
