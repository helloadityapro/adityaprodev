'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, orderBy, where, limit } from 'firebase/firestore';
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
  ArrowRight,
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
  Info,
  Loader2,
  FileText,
  X,
  RotateCw,
  RotateCcw,
  Users,
  User as UserIcon,
  UserCog,
  ChevronDown
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
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';

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
  userId: string;
  userName: string;
  attendees?: { id: string, name: string }[];
  createdAt: any;
};

type Site = {
  id: string;
  name: string;
  projectCompany: string;
};

type UserProfile = {
  id: string;
  username: string;
  email: string;
  role: string;
};

type SortKey = 'company' | 'name' | 'total' | string;

export default function MeetingsMatrixPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId: initialSiteId } = React.use(params);
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [selectedSiteId, setSelectedSiteId] = React.useState<string>("all");
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearch, setSiteSearch] = React.useState("");
  
  const [dateFilter, setDateFilter] = React.useState<string>("7days");
  const [customStart, setCustomStart] = React.useState<string>(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [isExportingPDF, setIsExportingPDF] = React.useState(false);

  // Personnel filters
  const [selectedLeadIds, setSelectedLeadIds] = React.useState<string[]>([]);
  const [selectedAttendeeIds, setSelectedAttendeeIds] = React.useState<string[]>([]);
  const [isLeadPopoverOpen, setIsLeadPopoverOpen] = React.useState(false);
  const [isAttendeePopoverOpen, setIsAttendeePopoverOpen] = React.useState(false);
  const [leadSearchQuery, setLeadSearchQuery] = React.useState("");
  const [attendeeSearchQuery, setAttendeeSearchQuery] = React.useState("");

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites, isLoading: sitesLoading } = useCollection<Site>(sitesQuery);
  const site = React.useMemo(() => allSites?.find(s => s.id === selectedSiteId), [allSites, selectedSiteId]);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers } = useCollection<UserProfile>(usersQuery);

  const meetingsQuery = useMemoFirebase(() => {
    if (selectedSiteId === 'all') return query(collection(firestore, 'meetings'), limit(100));
    return query(collection(firestore, 'meetings'), where('siteId', '==', selectedSiteId), limit(50));
  }, [firestore, selectedSiteId]);

  const { data: meetings, isLoading: meetingsLoading } = useCollection<Meeting>(meetingsQuery);

  const queryDateRange = React.useMemo(() => {
    const today = new Date();
    switch (dateFilter) {
      case 'today': return { start: startOfDay(today), end: endOfDay(today) };
      case 'yesterday': return { start: startOfDay(subDays(today, 1)), end: endOfDay(subDays(today, 1)) };
      case '7days': return { start: startOfDay(subDays(today, 7)), end: endOfDay(today) };
      case 'lastMonth': return { start: startOfDay(subMonths(today, 1)), end: endOfDay(today) };
      case 'lastYear': return { start: startOfDay(subYears(today, 1)), end: endOfDay(today) };
      case 'allTime': return { start: new Date(0), end: new Date(2100, 0, 1) };
      case 'custom': return { start: startOfDay(new Date(customStart)), end: endOfDay(new Date(customEnd)) };
      default: return { start: startOfDay(subDays(today, 7)), end: endOfDay(today) };
    }
  }, [dateFilter, customStart, customEnd]);

  const sortedMeetings = React.useMemo(() => {
    if (!meetings) return [];
    const { start, end } = queryDateRange;
    
    return [...meetings]
      .filter(m => {
        const d = m.createdAt?.toDate?.() || new Date(m.date);
        const matchesDate = d >= start && d <= end;
        const matchesLead = selectedLeadIds.length === 0 || selectedLeadIds.includes(m.userId);
        const matchesAttendee = selectedAttendeeIds.length === 0 || 
          m.attendees?.some(a => selectedAttendeeIds.includes(a.id));
          
        return matchesDate && matchesLead && matchesAttendee;
      })
      .sort((a, b) => {
        const da = a.createdAt?.toDate?.()?.getTime() || new Date(a.date).getTime();
        const db = b.createdAt?.toDate?.()?.getTime() || new Date(b.date).getTime();
        return db - da; // Descending - Newest first
      });
  }, [meetings, queryDateRange, selectedLeadIds, selectedAttendeeIds]);

  const filteredLeads = React.useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(u => u.role === 'Admin' || u.role === 'Site Manager')
      .filter(u => u.username?.toLowerCase().includes(leadSearchQuery.toLowerCase()));
  }, [allUsers, leadSearchQuery]);

  const filteredAttendees = React.useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(u => u.username?.toLowerCase().includes(attendeeSearchQuery.toLowerCase()));
  }, [allUsers, attendeeSearchQuery]);

  const handleExportPDF = async () => {
    if (sortedMeetings.length === 0) return;
    setIsExportingPDF(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF('l', 'mm', 'a4');
      const logoUrl = '/icon.png';

      // Load logo
      let logoProps: any = null;
      try {
        logoProps = await doc.getImageProperties(logoUrl);
      } catch (e) { console.warn("Logo failed", e); }

      const addHeaderLogo = (pdfDoc: any) => {
        if (!logoProps) return;
        const areaSize = 20;
        pdfDoc.addImage(logoUrl, 'PNG', 297 - areaSize - 10, 10, areaSize, areaSize);
      };

      const drawMatrix = (items: Meeting[]) => {
        addHeaderLogo(doc);
        const margin = 10;
        let currY = 30;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`MEETINGS MATRIX: ${selectedSiteId === 'all' ? 'GLOBAL' : site?.name}`, margin, 15);
        
        doc.setFontSize(8);
        const col1W = 50;
        const remainingW = 297 - margin * 2 - col1W;
        const colW = remainingW / items.length;

        // Header Row
        doc.rect(margin, currY, col1W, 10);
        doc.text('OBSERVATION POINT', margin + 2, currY + 6);
        items.forEach((m, i) => {
          doc.rect(margin + col1W + (i * colW), currY, colW, 10);
          const splitName = doc.splitTextToSize(m.siteName, colW - 4);
          doc.setFontSize(6);
          doc.text(splitName, margin + col1W + (i * colW) + 2, currY + 4);
          doc.setFontSize(7);
          doc.text(m.date.split(' ')[0], margin + col1W + (i * colW) + 2, currY + 9);
        });
        currY += 10;

        // Critical Points at Top in PDF
        doc.setFillColor(255, 235, 235);
        doc.rect(margin, currY, 277, 10, 'F');
        doc.setFont('helvetica', 'bold');
        doc.rect(margin, currY, col1W, 10);
        doc.text('CRITICAL POINTS', margin + 2, currY + 6);
        items.forEach((m, i) => {
          doc.rect(margin + col1W + (i * colW), currY, colW, 10);
          const splitCrit = doc.splitTextToSize(m.criticalPoints || '-', colW - 4);
          doc.setFontSize(6);
          doc.text(splitCrit, margin + col1W + (i * colW) + 2, currY + 5);
        });
        currY += 10;

        CATEGORIES.forEach(cat => {
          if (currY > 180) { doc.addPage(); currY = 20; addHeaderLogo(doc); }
          doc.setFillColor(240, 240, 240);
          doc.rect(margin, currY, 277, 6, 'F');
          doc.setFont('helvetica', 'bold');
          doc.text(cat, margin + 2, currY + 4);
          currY += 6;

          REVIEW_POINTS.filter(p => p.category === cat).forEach(point => {
            const wrapWidth = colW - 4;
            let maxLines = 1;
            items.forEach(m => {
              const obs = m.observations[point.id] || '-';
              const lines = doc.splitTextToSize(obs, wrapWidth);
              if (lines.length > maxLines) maxLines = lines.length;
            });
            
            const h = Math.max(10, maxLines * 4 + 2);

            if (currY + h > 190) { doc.addPage(); currY = 20; addHeaderLogo(doc); }
            
            doc.rect(margin, currY, col1W, h);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.text(doc.splitTextToSize(point.label.toUpperCase(), col1W - 4), margin + 2, currY + 4);
            
            items.forEach((m, i) => {
              doc.rect(margin + col1W + (i * colW), currY, colW, h);
              const obs = m.observations[point.id] || '-';
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(7);
              doc.text(doc.splitTextToSize(obs, colW - 4), margin + col1W + (i * colW) + 2, currY + 4);
            });
            currY += h;
          });
        });
      };

      drawMatrix(sortedMeetings);
      doc.save(`Meetings_Matrix_${site?.name || 'Global'}.pdf`);
      toast({ title: 'PDF Exported' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Export Failed' });
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExport = () => {
    if (sortedMeetings.length === 0) return;

    const workbook = XLSX.utils.book_new();
    const exportData = [
      { 'Category': 'GENERAL', 'Observation Point': 'CRITICAL POINTS', ...Object.fromEntries(sortedMeetings.map(m => [`${m.siteName} (${m.date})`, m.criticalPoints || '-'])) }
    ];

    REVIEW_POINTS.forEach(point => {
      const row: any = { 'Category': point.category, 'Observation Point': point.label };
      sortedMeetings.forEach(m => {
        row[`${m.siteName} (${m.date})`] = m.observations[point.id] || '-';
      });
      exportData.push(row);
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(workbook, ws, "Meetings Matrix");
    XLSX.writeFile(workbook, `Meetings_Matrix_${selectedSiteId}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const { scrollLeft } = scrollContainerRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - 400 : scrollLeft + 400;
      scrollContainerRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  const toggleLead = (id: string) => {
    setSelectedLeadIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleAttendee = (id: string) => {
    setSelectedAttendeeIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  if (isProfileLoading || sitesLoading || meetingsLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;

  if (!isAdmin) return null;

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
              <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-primary leading-tight truncate">
                {selectedSiteId === 'all' ? "Global Matrix" : allSites?.find(s => s.id === selectedSiteId)?.name}
              </h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1">Cross-session technical audit</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="h-10 w-[160px] rounded-sm font-black uppercase text-[10px] tracking-widest bg-secondary border-none shadow-sm">
                <Calendar className="mr-2 h-3.5 w-3.5" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today" className="text-[10px] font-black uppercase">Today</SelectItem>
                <SelectItem value="yesterday" className="text-[10px] font-black uppercase">Yesterday</SelectItem>
                <SelectItem value="7days" className="text-[10px] font-black uppercase">Last 7 Days</SelectItem>
                <SelectItem value="lastMonth" className="text-[10px] font-black uppercase">Last Month</SelectItem>
                <SelectItem value="lastYear" className="text-[10px] font-black uppercase">Last Year</SelectItem>
                <SelectItem value="allTime" className="text-[10px] font-black uppercase">All Time</SelectItem>
                <SelectItem value="custom" className="text-[10px] font-black uppercase text-primary">Custom Range</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleExport} disabled={sortedMeetings.length === 0} variant="outline" className="h-11 rounded-sm font-bold border-primary text-primary hover:bg-primary/5 px-8 shadow-sm">
              <FileDown className="h-4 w-4 mr-2" /> Export Excel
            </Button>
            <Button onClick={handleExportPDF} disabled={sortedMeetings.length === 0 || isExportingPDF} variant="outline" className="h-11 rounded-sm font-bold border-primary text-primary hover:bg-primary/5 px-8 shadow-sm">
              {isExportingPDF ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />} Export PDF
            </Button>
          </div>
        </div>

        {dateFilter === 'custom' && (
          <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-sm border border-primary/10 animate-in slide-in-from-top-2 duration-300 mt-2">
            <div className="flex-1 space-y-1.5">
              <Label className="text-[9px] font-black uppercase text-primary tracking-widest px-1">Start Date</Label>
              <Input 
                type="date" 
                value={customStart} 
                onChange={e => setCustomStart(e.target.value)} 
                className="h-9 text-[10px] rounded-sm bg-background border-primary/20 font-bold"
              />
            </div>
            <ArrowRight className="h-4 w-4 text-primary/40 mt-6 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Label className="text-[9px] font-black uppercase text-primary tracking-widest px-1">End Date</Label>
              <Input 
                type="date" 
                value={customEnd} 
                onChange={e => setCustomEnd(e.target.value)} 
                className="h-9 text-[10px] rounded-sm bg-background border-primary/20 font-bold"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm no-print">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1.5 flex-1">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Select Site</Label>
            <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between h-11 rounded-sm bg-background border-primary/10 font-bold text-xs uppercase shadow-inner">
                  <div className="flex items-center gap-2 truncate">
                    <Building2 className="h-4 w-4 text-primary opacity-60" />
                    <span className="truncate">{selectedSiteId === 'all' ? "All Sites" : allSites?.find(s => s.id === selectedSiteId)?.name}</span>
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0 shadow-2xl border-primary/10" align="start">
                <div className="flex items-center border-b px-3 bg-muted/20">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <Input placeholder="Search sites..." className="h-10 border-none focus-visible:ring-0 text-sm bg-transparent" value={siteSearch} onChange={e => setSiteSearch(e.target.value)} />
                </div>
                <ScrollArea className="h-[250px]">
                  <div className="p-1">
                    <Button variant="ghost" className="w-full justify-start h-10 text-xs font-black uppercase rounded-sm mb-1 px-4" onClick={() => { setSelectedSiteId('all'); setIsSitePopoverOpen(false); }}>
                      <Globe className="h-3.5 w-3.5 mr-2" /> Show All Sites
                    </Button>
                    {allSites?.filter(s => s.name.toLowerCase().includes(siteSearch.toLowerCase())).map(s => (
                      <Button key={s.id} variant="ghost" className="w-full justify-start h-auto py-3 px-4 text-xs text-left rounded-sm mb-0.5" onClick={() => { setSelectedSiteId(s.id); setIsSitePopoverOpen(false); }}>
                        <div className="flex flex-col items-start min-w-0">
                          <span className="font-bold truncate w-full uppercase tracking-tight">{s.name}</span>
                          <span className="text-[9px] text-muted-foreground uppercase opacity-60">{s.projectCompany}</span>
                        </div>
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Meeting Lead</Label>
            <Popover open={isLeadPopoverOpen} onOpenChange={setIsLeadPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between h-11 rounded-sm bg-background border-primary/10 font-bold text-xs uppercase shadow-inner">
                  <div className="flex items-center gap-2 truncate">
                    <UserCog className="h-4 w-4 text-primary opacity-60" />
                    <span className="truncate">{selectedLeadIds.length === 0 ? "Any Lead" : `${selectedLeadIds.length} Selected`}</span>
                  </div>
                  <ChevronDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0 shadow-2xl border-primary/10" align="start">
                <div className="flex items-center border-b px-3 bg-muted/20">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <Input placeholder="Filter personnel..." className="h-10 border-none focus-visible:ring-0 text-sm bg-transparent" value={leadSearchQuery} onChange={e => setLeadSearchQuery(e.target.value)} />
                </div>
                <ScrollArea className="h-[200px]">
                  <div className="p-2 space-y-1">
                    {filteredLeads.map(u => (
                      <div key={u.id} className="flex items-center space-x-3 p-2 rounded-sm hover:bg-primary/5 transition-colors cursor-pointer" onClick={() => toggleLead(u.id)}>
                        <Checkbox checked={selectedLeadIds.includes(u.id)} />
                        <span className="text-xs font-bold uppercase">{u.username}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                {selectedLeadIds.length > 0 && <Button variant="ghost" onClick={() => setSelectedLeadIds([])} className="w-full h-8 text-[9px] font-black uppercase text-destructive border-t rounded-none">Clear Filters</Button>}
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Participants</Label>
            <Popover open={isAttendeePopoverOpen} onOpenChange={setIsAttendeePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between h-11 rounded-sm bg-background border-primary/10 font-bold text-xs uppercase shadow-inner">
                  <div className="flex items-center gap-2 truncate">
                    <Users className="h-4 w-4 text-primary opacity-60" />
                    <span className="truncate">{selectedAttendeeIds.length === 0 ? "Any Attendee" : `${selectedAttendeeIds.length} Selected`}</span>
                  </div>
                  <ChevronDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0 shadow-2xl border-primary/10" align="start">
                <div className="flex items-center border-b px-3 bg-muted/20">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <Input placeholder="Filter personnel..." className="h-10 border-none focus-visible:ring-0 text-sm bg-transparent" value={attendeeSearchQuery} onChange={e => setAttendeeSearchQuery(e.target.value)} />
                </div>
                <ScrollArea className="h-[200px]">
                  <div className="p-2 space-y-1">
                    {filteredAttendees.map(u => (
                      <div key={u.id} className="flex items-center space-x-3 p-2 rounded-sm hover:bg-primary/5 transition-colors cursor-pointer" onClick={() => toggleAttendee(u.id)}>
                        <Checkbox checked={selectedAttendeeIds.includes(u.id)} />
                        <span className="text-xs font-bold uppercase">{u.username}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                {selectedAttendeeIds.length > 0 && <Button variant="ghost" onClick={() => setSelectedAttendeeIds([])} className="w-full h-8 text-[9px] font-black uppercase text-destructive border-t rounded-none">Clear Filters</Button>}
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-end gap-2">
             <Badge variant="outline" className="rounded-sm font-black uppercase text-[10px] tracking-widest px-3 h-11 border-primary/20 text-primary bg-primary/5 flex-1">
                {sortedMeetings.length} Records Found
             </Badge>
             <Button variant="ghost" size="icon" onClick={() => { setDateFilter("7days"); setSelectedSiteId('all'); setSelectedLeadIds([]); setSelectedAttendeeIds([]); setSearchTerm(""); }} className="h-11 w-11 rounded-sm border border-transparent hover:border-primary/10 text-muted-foreground"><FilterX className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      <Card className="rounded-sm border-primary/10 shadow-xl overflow-hidden min-h-[600px] flex flex-col relative">
        <div 
          ref={scrollContainerRef}
          className="flex-1 w-full relative overflow-auto custom-scrollbar"
        >
          <div className="min-w-full">
            <TooltipProvider delayDuration={0}>
              <Table className="border-separate border-spacing-0 text-[10px] min-w-full w-max table-fixed">
                <TableHeader className="sticky top-0 z-40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[220px] font-black uppercase tracking-widest bg-primary text-white sticky left-0 top-0 z-50 px-4 py-4 border-r border-white/10">Meeting Items</TableHead>
                    {sortedMeetings.map((m) => (
                      <TableHead key={m.id} className="text-center font-black uppercase tracking-tight leading-tight w-[240px] px-3 py-4 bg-primary text-white border-r border-white/10 last:border-0">
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="flex items-center gap-1.5">
                             <Calendar className="h-3 w-3" />
                             <span className="text-[10px] font-mono opacity-90">{m.date.split(' ')[0]}</span>
                          </div>
                          <span className="text-[10px] font-black block truncate max-w-full bg-white/10 px-2 py-0.5 rounded-sm">{m.siteName}</span>
                          <div className="flex items-center gap-1.5 opacity-70">
                             <UserIcon className="h-2.5 w-2.5" />
                             <span className="text-[8px] font-bold">{m.userName}</span>
                          </div>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* ✅ CRITICAL POINTS ROW - MOVED TO TOP */}
                  <TableRow className="bg-red-50/50">
                    <TableCell className="sticky left-0 z-10 px-4 py-8 font-black text-xs text-red-700 uppercase border-r border-b bg-red-50/90 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center gap-2">
                         <ShieldAlert className="h-4 w-4" />
                         Critical Findings
                      </div>
                    </TableCell>
                    {sortedMeetings.map((m) => (
                      <TableCell key={`critical-${m.id}`} className="p-0 border-r border-b align-top">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={cn(
                                "w-full h-full p-4 hover:bg-red-100/50 transition-colors cursor-default text-left flex flex-col justify-start relative min-h-[100px]",
                                m.criticalPoints && "bg-red-50/30"
                            )}>
                               {m.criticalPoints ? (
                                  <p className="text-[11px] font-black text-red-950 leading-relaxed uppercase tracking-tighter break-words whitespace-normal drop-shadow-sm">
                                    {m.criticalPoints}
                                  </p>
                               ) : <span className="text-red-900/10 font-black text-center w-full block mt-8">—</span>}
                            </div>
                          </TooltipTrigger>
                          {m.criticalPoints && (
                            <TooltipContent side="top" className="p-5 bg-red-900 text-white border-none shadow-2xl max-w-[320px] rounded-sm">
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

                  {/* REST OF CATEGORIES */}
                  {CATEGORIES.map(category => (
                    <React.Fragment key={category}>
                      <TableRow className="bg-muted/80">
                        <TableCell colSpan={sortedMeetings.length + 1} className="px-4 py-2 font-black text-[9px] uppercase tracking-[0.25em] text-primary border-b border-r shadow-inner">
                           {category}
                        </TableCell>
                      </TableRow>
                      {REVIEW_POINTS.filter(p => p.category === category).map((point) => (
                        <TableRow key={point.id} className="hover:bg-primary/[0.02] transition-colors group">
                          <TableCell className="px-6 py-4 font-bold text-[11px] border-r border-b bg-background sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)] uppercase tracking-tight text-foreground/70">
                            {point.label}
                          </TableCell>
                          {sortedMeetings.map((m) => {
                            const observation = m.observations[point.id];
                            return (
                              <TableCell key={`${m.id}-${point.id}`} className="text-center border-r border-b p-0 group align-top">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="w-full h-full flex flex-col p-4 cursor-default hover:bg-muted/10 transition-colors font-medium text-left relative min-h-[80px]">
                                      {observation ? (
                                        <p className="text-[10px] text-foreground leading-relaxed font-bold break-words whitespace-normal">
                                          {observation}
                                        </p>
                                      ) : <span className="text-muted-foreground/10 font-black text-center w-full block mt-8">—</span>}
                                    </div>
                                  </TooltipTrigger>
                                  {observation && (
                                    <TooltipContent side="top" className="p-4 border-none shadow-2xl bg-slate-900 text-white rounded-sm max-w-[280px]">
                                       <div className="space-y-2 text-left">
                                          <p className="text-[9px] font-black uppercase text-primary tracking-widest border-b border-white/10 pb-1.5">{point.label}</p>
                                          <p className="text-xs leading-relaxed italic font-medium">"{observation}"</p>
                                          <div className="pt-2 border-t border-white/5 flex justify-between items-center text-[8px] font-bold text-white/40 uppercase">
                                             <span>{m.siteName}</span>
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
                </TableBody>
              </Table>
            </TooltipProvider>
          </div>
        </div>
        
        {/* Navigation Floating Buttons */}
        <div className="fixed right-6 bottom-24 flex flex-col gap-3 z-[60] no-print">
            <Button 
                variant="secondary" 
                size="icon" 
                className="h-12 w-12 rounded-full shadow-2xl bg-background/95 backdrop-blur border-2 border-primary/20 hover:bg-primary hover:text-white transition-all scale-100 hover:scale-110 active:scale-95 group"
                onClick={() => scroll('left')}
            >
                <ChevronLeft className="h-6 w-6 group-hover:scale-110 transition-transform" />
            </Button>
            <Button 
                variant="secondary" 
                size="icon" 
                className="h-12 w-12 rounded-full shadow-2xl bg-background/95 backdrop-blur border-2 border-primary/20 hover:bg-primary hover:text-white transition-all scale-100 hover:scale-110 active:scale-95 group"
                onClick={() => scroll('right')}
            >
                <ChevronRight className="h-6 w-6 group-hover:scale-110 transition-transform" />
            </Button>
        </div>

        <div className="p-4 border-t bg-muted/5 flex flex-wrap items-center justify-center gap-8 shrink-0 z-10 no-print">
           <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-[9px] font-black uppercase text-foreground/70 tracking-widest">General Points</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-600" />
              <span className="text-[9px] font-black uppercase text-foreground/70 tracking-widest">Critical Points</span>
           </div>
           <Separator orientation="vertical" className="h-4 hidden sm:block" />
           <div className="flex items-center gap-2">
              <Info className="h-3.5 w-3.5 text-primary opacity-50" />
              <span className="text-[10px] font-bold text-muted-foreground italic leading-none">Columns are sorted by Newest First. Use Shift + Mouse Wheel to scroll horizontally.</span>
           </div>
        </div>
      </Card>
    </div>
  );
}

function SortIcon({ column, config }: { column: SortKey, config: { key: SortKey; direction: 'asc' | 'desc' } }) {
  if (config.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
  return config.direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3 text-primary" /> : <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
}
