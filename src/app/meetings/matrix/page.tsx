'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, limit, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  LayoutGrid, 
  FileDown, 
  Check, 
  X, 
  Zap,
  ImageIcon,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Search,
  Building2,
  Calendar,
  CheckCircle2,
  XCircle,
  ChevronsUpDown,
  ShieldAlert,
  Info,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { isSuperAdmin } from '@/lib/auth-constants';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const REVIEW_POINTS = [
  { id: 'mms', label: 'Module Mounting Structure' },
  { id: 'mcr', label: 'Main Control Room' },
  { id: 'earthing', label: 'Earthing' },
  { id: 'acCable', label: 'AC Cable' },
  { id: 'dcCable', label: 'DC Cable' },
  { id: 'stringInverter', label: 'String Inverter' },
  { id: 'ltPanel', label: 'LT Panel' },
  { id: 'transformer', label: 'Transformer' },
  { id: 'rmuVcb', label: 'RMU/VCB' },
  { id: 'poleStructure', label: 'Four Pole/Two Pole Structure' },
  { id: 'modules', label: 'Modules' },
  { id: 'htLine', label: 'HT Line' },
];

type Meeting = {
  id: string;
  siteId: string;
  siteName: string;
  date: string;
  observations: Record<string, string>;
  criticalPoints: string;
  userName: string;
  createdAt: any;
};

type Site = {
  id: string;
  name: string;
  projectCompany: string;
};

type SortKey = 'company' | 'name' | 'total' | string;

export default function MeetingsMatrixPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();

  const [selectedSiteId, setSelectedSiteId] = React.useState<string>("all");
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearch, setSiteSearch] = React.useState("");

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites, isLoading: sitesLoading } = useCollection<Site>(sitesQuery);

  const meetingsQuery = useMemoFirebase(() => {
    if (selectedSiteId === 'all') return query(collection(firestore, 'meetings'), orderBy('createdAt', 'desc'), limit(100));
    return query(collection(firestore, 'meetings'), where('siteId', '==', selectedSiteId), orderBy('createdAt', 'desc'), limit(50));
  }, [firestore, selectedSiteId]);

  const { data: meetings, isLoading: meetingsLoading } = useCollection<Meeting>(meetingsQuery);

  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'total', direction: 'desc' });

  const sortedMeetings = React.useMemo(() => {
    if (!meetings) return [];
    return [...meetings].sort((a, b) => {
        const da = a.createdAt?.toDate?.()?.getTime() || new Date(a.date).getTime();
        const db = b.createdAt?.toDate?.()?.getTime() || new Date(b.date).getTime();
        return da - db; // Ascending order for matrix columns
    });
  }, [meetings]);

  const handleExport = () => {
    if (sortedMeetings.length === 0) return;

    const exportData = REVIEW_POINTS.map(point => {
      const row: any = { 'Review Point': point.label };
      sortedMeetings.forEach(m => {
        row[m.date] = m.observations[point.id] || '-';
      });
      return row;
    });

    const criticalRow: any = { 'Review Point': 'CRITICAL POINTS' };
    sortedMeetings.forEach(m => {
      criticalRow[m.date] = m.criticalPoints || '-';
    });
    exportData.push(criticalRow);

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Meetings Matrix");
    XLSX.writeFile(wb, `Meetings_Matrix_${selectedSiteId}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30 shrink-0" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3 text-primary shrink-0" /> : <ArrowDown className="ml-2 h-3 w-3 text-primary shrink-0" />;
  };

  if (isProfileLoading || sitesLoading || meetingsLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-[600px] w-full" /></div>;

  return (
    <div className="space-y-6 md:space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.push('/meetings/list')} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Registry
        </Button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-sm"><LayoutGrid className="h-6 w-6 text-primary" /></div>
            <div>
              <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight">Meetings Matrix View</h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Cross-session technical audit</p>
            </div>
          </div>
          <Button onClick={handleExport} disabled={sortedMeetings.length === 0} variant="outline" className="h-10 rounded-sm font-bold border-primary text-primary hover:bg-primary/5 px-6">
            <FileDown className="h-4 w-4 mr-2" /> Export Matrix
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
        <div className="flex flex-col gap-1.5 flex-1">
          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Filter by Site</Label>
          <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full md:w-[400px] justify-between h-10 rounded-sm bg-background border-primary/10 font-bold text-xs uppercase">
                <div className="flex items-center gap-2 truncate">
                  <Building2 className="h-4 w-4 text-primary opacity-60" />
                  <span className="truncate">{selectedSiteId === 'all' ? "Global Review (Recent 100)" : allSites?.find(s => s.id === selectedSiteId)?.name}</span>
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <div className="flex items-center border-b px-3 bg-muted/20">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <Input placeholder="Search sites..." className="h-10 border-none focus-visible:ring-0 text-xs bg-transparent" value={siteSearch} onChange={e => setSiteSearch(e.target.value)} />
              </div>
              <ScrollArea className="h-[200px]">
                <div className="p-1">
                  <Button variant="ghost" className="w-full justify-start h-9 text-xs font-bold uppercase" onClick={() => { setSelectedSiteId('all'); setIsSitePopoverOpen(false); }}>
                    Global View (Latest)
                  </Button>
                  {allSites?.filter(s => s.name.toLowerCase().includes(siteSearch.toLowerCase())).map(s => (
                    <Button key={s.id} variant="ghost" className="w-full justify-start h-10 text-xs text-left" onClick={() => { setSelectedSiteId(s.id); setIsSitePopoverOpen(false); }}>
                      <div className="flex flex-col items-start min-w-0">
                        <span className="font-bold truncate w-full">{s.name}</span>
                        <span className="text-[9px] text-muted-foreground uppercase opacity-60">{s.projectCompany}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Card className="rounded-sm border-primary/10 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
        <ScrollArea className="flex-1 w-full relative">
          <div className="min-w-full">
            <TooltipProvider delayDuration={0}>
              <Table className="border-separate border-spacing-0 table-fixed w-full text-[10px]">
                <TableHeader className="sticky top-0 z-20 shadow-sm">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[220px] font-black uppercase tracking-widest bg-primary text-white sticky left-0 top-0 z-30 px-4 py-4 border-r border-white/10">Technical Point</TableHead>
                    {sortedMeetings.map((m) => (
                      <TableHead key={m.id} className="text-center font-black uppercase tracking-tight leading-tight w-[180px] px-2 py-4 bg-primary text-white border-r border-white/10 last:border-0">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px]">{m.date.split(' ')[0]}</span>
                          <span className="text-[8px] opacity-80">{m.date.split(' ')[1] || ''}</span>
                          {selectedSiteId === 'all' && <span className="text-[7px] bg-white/20 px-1 rounded-sm block truncate max-w-[150px]">{m.siteName}</span>}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {REVIEW_POINTS.map((point) => (
                    <TableRow key={point.id} className="hover:bg-primary/[0.02] transition-colors group">
                      <TableCell className="px-4 py-4 font-black text-xs border-r border-b bg-background sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                        {point.label}
                      </TableCell>
                      {sortedMeetings.map((m) => {
                        const observation = m.observations[point.id];
                        
                        return (
                          <TableCell key={`${m.id}-${point.id}`} className="text-center border-r border-b p-0 group">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="w-full h-full flex justify-center items-center py-4 px-2 cursor-default hover:bg-muted/10 transition-colors font-medium text-center">
                                  {observation ? (
                                    <span className="truncate text-[10px] text-foreground block max-w-full" title={observation}>
                                      {observation}
                                    </span>
                                  ) : <span className="text-muted-foreground/30 font-black">-</span>}
                                </div>
                              </TooltipTrigger>
                              {observation && (
                                <TooltipContent side="top" className="p-3 border-none shadow-2xl bg-slate-900 text-white rounded-sm max-w-[250px]">
                                   <div className="space-y-1.5">
                                      <p className="text-[9px] font-black uppercase text-primary tracking-widest">{point.label}</p>
                                      <p className="text-xs leading-relaxed italic">"{observation}"</p>
                                      <div className="pt-1.5 border-t border-white/10 flex justify-between items-center text-[8px] font-bold text-white/40 uppercase">
                                         <span>Log By: {m.userName}</span>
                                         <span>{m.date}</span>
                                      </div>
                                   </div>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                  
                  {/* Critical Points Row */}
                  <TableRow className="bg-red-50/50">
                    <TableCell className="sticky left-0 z-10 px-4 py-6 font-black text-xs text-red-700 uppercase border-r border-b bg-red-50/90 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center gap-2">
                         <ShieldAlert className="h-3.5 w-3.5" />
                         Critical Points
                      </div>
                    </TableCell>
                    {sortedMeetings.map((m) => (
                      <TableCell key={`critical-${m.id}`} className="p-0 border-r border-b">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="w-full h-full p-4 hover:bg-red-100/50 transition-colors cursor-default text-center">
                               {m.criticalPoints ? (
                                 <p className="text-[9px] font-bold text-red-900 line-clamp-2 leading-tight">
                                   {m.criticalPoints}
                                 </p>
                               ) : <span className="text-muted-foreground/20 font-black flex justify-center">-</span>}
                            </div>
                          </TooltipTrigger>
                          {m.criticalPoints && (
                            <TooltipContent side="top" className="p-4 bg-red-900 text-white border-none shadow-2xl max-w-[300px]">
                               <div className="space-y-2">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-red-200">Major Findings / Blockers</Label>
                                  <p className="text-xs font-medium leading-relaxed italic">"{m.criticalPoints}"</p>
                               </div>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </TooltipProvider>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <div className="p-3 border-t bg-muted/5 flex items-center justify-center gap-6 shrink-0 z-10">
           <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /><span className="text-[9px] font-black uppercase text-foreground/70 tracking-widest">Satisfactory / OK</span></div>
           <div className="flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5 text-red-600" /><span className="text-[9px] font-black uppercase text-foreground/70 tracking-widest">Action Required</span></div>
           <Separator orientation="vertical" className="h-4" />
           <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-muted-foreground/40 italic">Hover cell to view detailed notes</div>
        </div>
      </Card>
    </div>
  );
}
