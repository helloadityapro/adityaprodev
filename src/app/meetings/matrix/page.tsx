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
  ArrowUpDown,
  Plus,
  Globe,
  FilterX
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
  customPoints?: { id: string, label: string, value: string }[];
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
    if (selectedSiteId === 'all') return query(collection(firestore, 'meetings'), limit(100));
    return query(collection(firestore, 'meetings'), where('siteId', '==', selectedSiteId), limit(50));
  }, [firestore, selectedSiteId]);

  const { data: meetings, isLoading: meetingsLoading } = useCollection<Meeting>(meetingsQuery);

  const sortedMeetings = React.useMemo(() => {
    if (!meetings) return [];
    return [...meetings].sort((a, b) => {
        const da = a.createdAt?.toDate?.()?.getTime() || new Date(a.date).getTime();
        const db = b.createdAt?.toDate?.()?.getTime() || new Date(b.date).getTime();
        return da - db; // Ascending order for matrix columns
    });
  }, [meetings]);

  // Extract unique custom point labels from all visible meetings
  const allCustomPointLabels = React.useMemo(() => {
    const labels = new Set<string>();
    sortedMeetings.forEach(m => {
      m.customPoints?.forEach(cp => {
        if (cp.label) labels.add(cp.label);
      });
    });
    return Array.from(labels).sort();
  }, [sortedMeetings]);

  const handleExport = () => {
    if (sortedMeetings.length === 0) return;

    const workbook = XLSX.utils.book_new();
    
    // Row mapping logic for export
    const exportData = REVIEW_POINTS.map(point => {
      const row: any = { 'Observation Point': point.label };
      sortedMeetings.forEach(m => {
        row[m.date] = m.observations[point.id] || '-';
      });
      return row;
    });

    if (allCustomPointLabels.length > 0) {
      allCustomPointLabels.forEach(label => {
        const row: any = { 'Observation Point': `Custom: ${label}` };
        sortedMeetings.forEach(m => {
          const cp = m.customPoints?.find(p => p.label === label);
          row[m.date] = cp ? cp.value : '-';
        });
        exportData.push(row);
      });
    }

    const criticalRow: any = { 'Observation Point': 'CRITICAL POINTS' };
    sortedMeetings.forEach(m => {
      criticalRow[m.date] = m.criticalPoints || '-';
    });
    exportData.push(criticalRow);

    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(workbook, ws, "Meetings Matrix");
    XLSX.writeFile(workbook, `Meetings_Matrix_${selectedSiteId}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  if (isProfileLoading || sitesLoading || meetingsLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-[600px] w-full" /></div>;

  return (
    <div className="space-y-6 md:space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.push('/meetings/list')} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Registry
        </Button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-2.5 rounded-sm shrink-0"><LayoutGrid className="h-7 w-7 text-primary" /></div>
            <div className="min-w-0 text-left">
              <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-primary leading-tight truncate">
                {selectedSiteId === 'all' ? "Global Matrix" : allSites?.find(s => s.id === selectedSiteId)?.name}
              </h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1">Cross-session technical audit</p>
            </div>
          </div>
          <Button onClick={handleExport} disabled={sortedMeetings.length === 0} variant="outline" className="h-11 rounded-sm font-bold border-primary text-primary hover:bg-primary/5 px-8 shadow-sm">
            <FileDown className="h-4 w-4 mr-2" /> Export Matrix
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
        <div className="flex flex-col gap-1.5 flex-1">
          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Filter by Site Registry</Label>
          <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full md:w-[450px] justify-between h-12 rounded-sm bg-background border-primary/10 font-bold text-sm uppercase transition-all hover:border-primary/30 shadow-inner">
                <div className="flex items-center gap-2 truncate">
                  <Building2 className="h-4 w-4 text-primary opacity-60" />
                  <span className="truncate">{selectedSiteId === 'all' ? "Global Review (Recent 100)" : allSites?.find(s => s.id === selectedSiteId)?.name}</span>
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-2xl border-primary/10" align="start">
              <div className="flex items-center border-b px-3 bg-muted/20">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <Input placeholder="Search sites..." className="h-10 border-none focus-visible:ring-0 text-sm bg-transparent" value={siteSearch} onChange={e => setSiteSearch(e.target.value)} />
              </div>
              <ScrollArea className="h-[300px]">
                <div className="p-1">
                  <Button 
                    variant="ghost" 
                    className={cn(
                        "w-full justify-start h-10 text-xs font-black uppercase rounded-sm mb-1 px-4",
                        selectedSiteId === 'all' ? "bg-primary/10 text-primary" : ""
                    )} 
                    onClick={() => { setSelectedSiteId('all'); setIsSitePopoverOpen(false); }}
                  >
                    <Globe className="h-3.5 w-3.5 mr-2" /> Global View (Latest)
                  </Button>
                  {allSites?.filter(s => s.name.toLowerCase().includes(siteSearch.toLowerCase())).map(s => (
                    <Button 
                        key={s.id} 
                        variant="ghost" 
                        className={cn(
                            "w-full justify-start h-auto py-3 px-4 text-xs text-left rounded-sm mb-0.5 group",
                            selectedSiteId === s.id ? "bg-primary/10 text-primary" : ""
                        )} 
                        onClick={() => { setSelectedSiteId(s.id); setIsSitePopoverOpen(false); }}
                    >
                      <div className="flex flex-col items-start min-w-0 text-left">
                        <span className={cn("font-bold truncate w-full uppercase tracking-tight", selectedSiteId === s.id ? "text-primary" : "text-foreground")}>{s.name}</span>
                        <span className="text-[9px] text-muted-foreground uppercase opacity-60 font-medium">{s.projectCompany}</span>
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
                    <TableHead className="w-[220px] font-black uppercase tracking-widest bg-primary text-white sticky left-0 top-0 z-30 px-4 py-4 border-r border-white/10">Observation Point</TableHead>
                    {sortedMeetings.map((m) => (
                      <TableHead key={m.id} className="text-center font-black uppercase tracking-tight leading-tight w-[200px] px-2 py-4 bg-primary text-white border-r border-white/10 last:border-0">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] font-mono">{m.date.split(' ')[0]}</span>
                          <span className="text-[8px] opacity-80">{m.date.split(' ')[1] || ''}</span>
                          {selectedSiteId === 'all' && (
                            <div className="mt-1 px-2 py-0.5 bg-white/20 rounded-sm w-full">
                               <span className="text-[7px] block truncate uppercase tracking-tighter" title={m.siteName}>{m.siteName}</span>
                            </div>
                          )}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* STANDARD POINTS */}
                  {REVIEW_POINTS.map((point) => (
                    <TableRow key={point.id} className="hover:bg-primary/[0.02] transition-colors group">
                      <TableCell className="px-4 py-4 font-black text-[11px] border-r border-b bg-background sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)] uppercase tracking-tight">
                        {point.label}
                      </TableCell>
                      {sortedMeetings.map((m) => {
                        const observation = m.observations[point.id];
                        return (
                          <TableCell key={`${m.id}-${point.id}`} className="text-center border-r border-b p-0 group">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="w-full h-full flex justify-center items-center py-5 px-3 cursor-default hover:bg-muted/10 transition-colors font-medium text-center">
                                  {observation ? (
                                    <span className="truncate text-[10px] text-foreground block max-w-full font-bold" title={observation}>
                                      {observation}
                                    </span>
                                  ) : <span className="text-muted-foreground/20 font-black">-</span>}
                                </div>
                              </TooltipTrigger>
                              {observation && (
                                <TooltipContent side="top" className="p-4 border-none shadow-2xl bg-slate-900 text-white rounded-sm max-w-[280px]">
                                   <div className="space-y-2">
                                      <p className="text-[9px] font-black uppercase text-primary tracking-widest border-b border-white/10 pb-1.5">{point.label}</p>
                                      <p className="text-xs leading-relaxed italic font-medium">"{observation}"</p>
                                      <div className="pt-2 border-t border-white/5 flex justify-between items-center text-[8px] font-bold text-white/40 uppercase">
                                         <span>Log By: {m.userName}</span>
                                         <span className="font-mono">{m.date}</span>
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

                  {/* CUSTOM POINTS SECTION */}
                  {allCustomPointLabels.length > 0 && (
                    <>
                      <TableRow className="bg-muted/10">
                        <TableCell colSpan={sortedMeetings.length + 1} className="px-4 py-2 font-black uppercase text-[9px] tracking-[0.25em] text-muted-foreground border-b">
                           Supplementary Site Observations
                        </TableCell>
                      </TableRow>
                      {allCustomPointLabels.map((label) => (
                        <TableRow key={label} className="hover:bg-primary/[0.02] transition-colors group">
                          <TableCell className="px-4 py-4 font-black text-[11px] border-r border-b bg-background sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)] uppercase tracking-tight text-primary/70">
                            {label}
                          </TableCell>
                          {sortedMeetings.map((m) => {
                            const cp = m.customPoints?.find(p => p.label === label);
                            const val = cp?.value;
                            return (
                              <TableCell key={`${m.id}-${label}`} className="text-center border-r border-b p-0 group">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="w-full h-full flex justify-center items-center py-5 px-3 cursor-default hover:bg-muted/10 transition-colors font-medium text-center">
                                      {val ? (
                                        <span className="truncate text-[10px] text-foreground block max-w-full font-bold" title={val}>
                                          {val}
                                        </span>
                                      ) : <span className="text-muted-foreground/20 font-black">-</span>}
                                    </div>
                                  </TooltipTrigger>
                                  {val && (
                                    <TooltipContent side="top" className="p-4 border-none shadow-2xl bg-slate-900 text-white rounded-sm max-w-[280px]">
                                       <div className="space-y-2">
                                          <p className="text-[9px] font-black uppercase text-amber-400 tracking-widest border-b border-white/10 pb-1.5">{label}</p>
                                          <p className="text-xs leading-relaxed italic font-medium">"{val}"</p>
                                       </div>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </>
                  )}
                  
                  {/* CRITICAL POINTS ROW */}
                  <TableRow className="bg-red-50/50">
                    <TableCell className="sticky left-0 z-10 px-4 py-8 font-black text-xs text-red-700 uppercase border-r border-b bg-red-50/90 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center gap-2">
                         <ShieldAlert className="h-4 w-4" />
                         Critical Points
                      </div>
                    </TableCell>
                    {sortedMeetings.map((m) => (
                      <TableCell key={`critical-${m.id}`} className="p-0 border-r border-b">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="w-full h-full p-4 hover:bg-red-100/50 transition-colors cursor-default text-center flex items-center justify-center">
                               {m.criticalPoints ? (
                                 <p className="text-[10px] font-black text-red-950 line-clamp-3 leading-tight uppercase tracking-tighter">
                                   {m.criticalPoints}
                                 </p>
                               ) : <span className="text-red-900/10 font-black flex justify-center">-</span>}
                            </div>
                          </TooltipTrigger>
                          {m.criticalPoints && (
                            <TooltipContent side="top" className="p-5 bg-red-900 text-white border-none shadow-2xl max-w-[320px]">
                               <div className="space-y-3">
                                  <div className="flex items-center gap-2 border-b border-white/20 pb-2">
                                     <ShieldAlert className="h-4 w-4" />
                                     <Label className="text-[10px] font-black uppercase tracking-widest text-red-100 leading-none">Critical Blockers Identified</Label>
                                  </div>
                                  <p className="text-sm font-medium leading-relaxed italic">"{m.criticalPoints}"</p>
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
        <div className="p-4 border-t bg-muted/5 flex flex-wrap items-center justify-center gap-8 shrink-0 z-10 no-print">
           <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-[9px] font-black uppercase text-foreground/70 tracking-widest">Standard Indicators</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-[9px] font-black uppercase text-foreground/70 tracking-widest">Custom Points</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-600" />
              <span className="text-[9px] font-black uppercase text-foreground/70 tracking-widest">Critical Findings</span>
           </div>
           <Separator orientation="vertical" className="h-4 hidden sm:block" />
           <div className="flex items-center gap-2">
              <Info className="h-3.5 w-3.5 text-primary opacity-50" />
              <span className="text-[10px] font-bold text-muted-foreground italic leading-none">Hover cell to expand observation narrative</span>
           </div>
        </div>
      </Card>
    </div>
  );
}
