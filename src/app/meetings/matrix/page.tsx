'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, doc, limit, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  LayoutGrid, 
  FileDown, 
  Maximize2, 
  Minimize2, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Building2, 
  Calendar, 
  ChevronsUpDown, 
  ShieldAlert, 
  ArrowUp, 
  ArrowDown, 
  ArrowUpDown, 
  Globe, 
  FilterX,
  History,
  Check,
  Info
} from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { isSuperAdmin } from '@/lib/auth-constants';
import * as XLSX from 'xlsx';
import { format, subDays, subMonths, subYears, startOfDay, endOfDay } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const REVIEW_POINTS = [
  { id: 'mms_civil', label: 'MMS Civil-work', category: 'MMS & MODULES INSTALLATION' },
  { id: 'mms_install', label: 'MMS Installation', category: 'MMS & MODULES INSTALLATION' },
  { id: 'module_install', label: 'Modules Installation', category: 'MMS & MODULES INSTALLATION' },
  { id: 'earthing_laying', label: 'Laying & Termination', category: 'EARTHING' },
  { id: 'dc_block_laying', label: 'Trenches, Laying & Termination', category: 'DC BLOCK' },
  { id: 'ac_block_laying', label: 'Trenches, Laying & Termination', category: 'AC BLOCK' },
  { id: 'inverter_install', label: 'Frame erection, Installation and Termination', category: 'INVERTERS' },
  
  // CIVIL WORKS
  { id: 'control_room_civil', label: 'Control Room', category: 'CIVIL WORKS' },
  { id: 'lt_foundation_civil', label: 'LT Panel Foundation', category: 'CIVIL WORKS' },
  { id: 'idt_foundation_civil', label: 'IDT Foundation', category: 'CIVIL WORKS' },
  { id: 'ht_panel_foundation_civil', label: 'HT Panel Foundation', category: 'CIVIL WORKS' },
  { id: 'pole_erection_civil', label: 'Four-Pole/Two Pole Erection', category: 'CIVIL WORKS' },
  { id: 'switchyard_civil', label: 'Switch-yard Civil Work', category: 'CIVIL WORKS' },

  // EQUIPMENT INSTALLATION
  { id: 'lt_panel_install', label: 'LT Panel', category: 'EQUIPMENT INSTALLATION' },
  { id: 'ht_panel_install', label: 'HT Panel', category: 'EQUIPMENT INSTALLATION' },
  { id: 'idt_install', label: 'IDT', category: 'EQUIPMENT INSTALLATION' },
  { id: 'rtcc_install', label: 'RTCC', category: 'EQUIPMENT INSTALLATION' },
  { id: 'scada_install', label: 'SCADA', category: 'EQUIPMENT INSTALLATION' },
  { id: 'rms_wms_install', label: 'RMS/WMS', category: 'EQUIPMENT INSTALLATION' },

  // TRANSMISSION LINE WORKS
  { id: 'poles_erection_tl', label: 'Poles Erection', category: 'Transmission Line Works' },
  { id: 'cable_stringing_tl', label: 'Cable Stringing', category: 'Transmission Line Works' },

  // SUB-STATION WORKS
  { id: 'equip_foundation_ss', label: 'Equipment Foundation', category: 'Sub-Station Works' },
  { id: 'bay_erection_ss', label: 'Bay Erection', category: 'Sub-Station Works' },
  { id: 'ht_panel_install_ss', label: 'HT Panel Installation', category: 'Sub-Station Works' },

  { id: 'others', label: 'Others', category: 'OTHERS' },
];

const CATEGORIES = [
  "MMS & MODULES INSTALLATION",
  "EARTHING",
  "DC BLOCK",
  "AC BLOCK",
  "INVERTERS",
  "CIVIL WORKS",
  "EQUIPMENT INSTALLATION",
  "Transmission Line Works",
  "Sub-Station Works",
  "OTHERS"
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
  
  const [dateFilter, setDateFilter] = React.useState<string>("7days");
  const [expandedCells, setExpandedCells] = React.useState<Set<string>>(new Set());

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

  const queryDateRange = React.useMemo(() => {
    const today = new Date();
    switch (dateFilter) {
      case '7days': return { start: startOfDay(subDays(today, 7)), end: endOfDay(today) };
      case 'lastMonth': return { start: startOfDay(subMonths(today, 1)), end: endOfDay(today) };
      case 'lastYear': return { start: startOfDay(subYears(today, 1)), end: endOfDay(today) };
      case 'allTime': return { start: new Date(0), end: new Date(2100, 0, 1) };
      default: return { start: startOfDay(subDays(today, 7)), end: endOfDay(today) };
    }
  }, [dateFilter]);

  const sortedMeetings = React.useMemo(() => {
    if (!meetings) return [];
    const { start, end } = queryDateRange;
    return [...meetings].filter(m => {
        const d = m.createdAt?.toDate?.() || new Date(m.date);
        return d >= start && d <= end;
    }).sort((a, b) => {
        const da = a.createdAt?.toDate?.()?.getTime() || new Date(a.date).getTime();
        const db = b.createdAt?.toDate?.()?.getTime() || new Date(b.date).getTime();
        return da - db;
    });
  }, [meetings, queryDateRange]);

  const toggleCell = (cellId: string) => {
    const next = new Set(expandedCells);
    if (next.has(cellId)) next.delete(cellId);
    else next.add(cellId);
    setExpandedCells(next);
  };

  const handleExport = () => {
    if (sortedMeetings.length === 0) return;

    const workbook = XLSX.utils.book_new();
    const exportData = REVIEW_POINTS.map(point => {
      const row: any = { 'Category': point.category, 'Observation Point': point.label };
      sortedMeetings.forEach(m => {
        row[m.date] = m.observations[point.id] || '-';
      });
      return row;
    });

    const criticalRow: any = { 'Category': 'GENERAL', 'Observation Point': 'CRITICAL POINTS' };
    sortedMeetings.forEach(m => {
      criticalRow[m.date] = m.criticalPoints || '-';
    });
    exportData.push(criticalRow);

    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(workbook, ws, "Meetings Matrix");
    XLSX.writeFile(workbook, `Meetings_Matrix_${selectedSiteId}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
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
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-2.5 rounded-sm shrink-0"><LayoutGrid className="h-7 w-7 text-primary" /></div>
            <div className="min-w-0 text-left">
              <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-primary leading-tight truncate">
                {selectedSiteId === 'all' ? "Global Matrix" : allSites?.find(s => s.id === selectedSiteId)?.name}
              </h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1">Cross-session technical audit</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="h-10 w-[160px] rounded-sm font-black uppercase text-[10px] tracking-widest bg-secondary border-none">
                <Calendar className="mr-2 h-3.5 w-3.5" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7days" className="text-[10px] font-black uppercase">Last 7 Days</SelectItem>
                <SelectItem value="lastMonth" className="text-[10px] font-black uppercase">Last Month</SelectItem>
                <SelectItem value="lastYear" className="text-[10px] font-black uppercase">Last Year</SelectItem>
                <SelectItem value="allTime" className="text-[10px] font-black uppercase">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleExport} disabled={sortedMeetings.length === 0} variant="outline" className="h-11 rounded-sm font-bold border-primary text-primary hover:bg-primary/5 px-8 shadow-sm">
              <FileDown className="h-4 w-4 mr-2" /> Export Matrix
            </Button>
          </div>
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
                <TableHeader className="sticky top-0 z-40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[220px] font-black uppercase tracking-widest bg-primary text-white sticky left-0 top-0 z-30 px-4 py-4 border-r border-white/10">Observation Point</TableHead>
                    {sortedMeetings.map((m) => (
                      <TableHead key={m.id} className="text-center font-black uppercase tracking-tight leading-tight w-[200px] px-2 py-4 bg-primary text-white border-r border-white/10 last:border-0">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] font-mono">{m.date.split(' ')[0]}</span>
                          <span className="text-[8px] opacity-80">{m.date.split(' ')[1] || ''}</span>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {CATEGORIES.map(category => (
                    <React.Fragment key={category}>
                      <TableRow className="bg-muted/50">
                        <TableCell colSpan={sortedMeetings.length + 1} className="px-4 py-2 font-black text-[9px] uppercase tracking-[0.2em] text-primary border-b border-r">
                           {category}
                        </TableCell>
                      </TableRow>
                      {REVIEW_POINTS.filter(p => p.category === category).map((point) => (
                        <TableRow key={point.id} className="hover:bg-primary/[0.02] transition-colors group">
                          <TableCell className="px-6 py-4 font-bold text-[11px] border-r border-b bg-background sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)] uppercase tracking-tight">
                            {point.label}
                          </TableCell>
                          {sortedMeetings.map((m) => {
                            const observation = m.observations[point.id];
                            const cellId = `${m.id}-${point.id}`;
                            const isExpanded = expandedCells.has(cellId);
                            
                            return (
                              <TableCell key={cellId} className="text-center border-r border-b p-0 group align-top">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="w-full h-full flex flex-col p-4 cursor-default hover:bg-muted/10 transition-colors font-medium text-left relative min-h-[60px]">
                                      {observation ? (
                                        <div className="space-y-2">
                                          <p className={cn(
                                            "text-[10px] text-foreground leading-relaxed font-bold break-words",
                                            !isExpanded && "line-clamp-2"
                                          )}>
                                            {observation}
                                          </p>
                                          {observation.length > 30 && (
                                            <Button 
                                              variant="ghost" 
                                              size="icon" 
                                              className="h-6 w-6 absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                              onClick={(e) => { e.stopPropagation(); toggleCell(cellId); }}
                                            >
                                              {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                                            </Button>
                                          )}
                                        </div>
                                      ) : <span className="text-muted-foreground/20 font-black text-center w-full block">-</span>}
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
                    </React.Fragment>
                  ))}
                  
                  {/* CRITICAL POINTS ROW */}
                  <TableRow className="bg-red-50/50">
                    <TableCell className="sticky left-0 z-10 px-4 py-8 font-black text-xs text-red-700 uppercase border-r border-b bg-red-50/90 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center gap-2">
                         <ShieldAlert className="h-3.5 w-3.5" />
                         Critical Points
                      </div>
                    </TableCell>
                    {sortedMeetings.map((m) => {
                      const cellId = `critical-${m.id}`;
                      const isExpanded = expandedCells.has(cellId);
                      
                      return (
                        <TableCell key={cellId} className="p-0 border-r border-b align-top">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="w-full h-full p-4 hover:bg-red-100/50 transition-colors cursor-default text-left flex flex-col justify-start relative min-h-[80px]">
                                 {m.criticalPoints ? (
                                   <div className="space-y-2">
                                      <p className={cn(
                                        "text-[10px] font-black text-red-950 leading-tight uppercase tracking-tighter break-words",
                                        !isExpanded && "line-clamp-3"
                                      )}>
                                        {m.criticalPoints}
                                      </p>
                                      {m.criticalPoints.length > 30 && (
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-6 w-6 absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-red-700"
                                          onClick={(e) => { e.stopPropagation(); toggleCell(cellId); }}
                                        >
                                          {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                                        </Button>
                                      )}
                                   </div>
                                 ) : <span className="text-red-900/10 font-black text-center w-full block">-</span>}
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
                      );
                    })}
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
              <div className="h-2 w-2 rounded-full bg-red-600" />
              <span className="text-[9px] font-black uppercase text-foreground/70 tracking-widest">Critical Findings</span>
           </div>
           <Separator orientation="vertical" className="h-4 hidden sm:block" />
           <div className="flex items-center gap-2">
              <Info className="h-3.5 w-3.5 text-primary opacity-50" />
              <span className="text-[10px] font-bold text-muted-foreground italic leading-none">Hover cell to view detailed notes</span>
           </div>
        </div>
      </Card>
    </div>
  );
}
