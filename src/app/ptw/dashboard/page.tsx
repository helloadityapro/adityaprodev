'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  LayoutDashboard, 
  Search, 
  ArrowLeft, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Info,
  Building2,
  Globe,
  UserCog,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  FileDown
} from 'lucide-react';
import { format, subDays, subMonths, startOfDay, endOfDay } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { isSuperAdmin } from '@/lib/auth-constants';
import { useIsMobile } from '@/hooks/use-mobile';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import * as XLSX from 'xlsx';

export default function PtwDashboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const isMobile = useIsMobile();
  
  const [searchTerm, setSearchTerm] = React.useState("");
  const [dateFilter, setDateFilter] = React.useState<string>("7days");
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === "Admin";

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites, isLoading: sitesLoading } = useCollection<any>(sitesQuery);

  const typesQuery = useMemoFirebase(() => collection(firestore, 'ptw_types'), [firestore]);
  const { data: ptwTypes, isLoading: typesLoading } = useCollection<any>(typesQuery);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers, isLoading: usersLoading } = useCollection<any>(usersQuery);

  const permitsQuery = useMemoFirebase(() => collection(firestore, 'permits_to_work'), [firestore]);
  const { data: allPermits, isLoading: permitsLoading } = useCollection<any>(permitsQuery);

  const queryDateRange = React.useMemo(() => {
    const today = new Date();
    switch (dateFilter) {
      case 'today': return { start: startOfDay(today), end: endOfDay(today) };
      case 'yesterday': return { start: startOfDay(subDays(today, 1)), end: endOfDay(subDays(today, 1)) };
      case '7days': return { start: startOfDay(subDays(today, 7)), end: endOfDay(today) };
      case 'lastMonth': return { start: startOfDay(subMonths(today, 1)), end: endOfDay(today) };
      case 'lastYear': return { start: startOfDay(subDays(today, 365)), end: endOfDay(today) };
      default: return { start: new Date(0), end: new Date(2100, 0, 1) };
    }
  }, [dateFilter]);

  const dashboardData = React.useMemo(() => {
    if (!allSites || !allPermits || !ptwTypes || !allUsers) return [];

    const { start, end } = queryDateRange;

    return allSites.map(site => {
      const sitePermits = allPermits.filter(p => {
        let pDate: Date;
        if (p.requestDate?.toDate) pDate = p.requestDate.toDate();
        else if (p.requestDate) pDate = new Date(p.requestDate);
        else return false;

        const matchesDate = pDate >= start && pDate <= end;
        return p.siteId === site.id && matchesDate;
      });

      const typeCounts: Record<string, number> = {};
      ptwTypes.forEach(type => {
        typeCounts[type.name] = sitePermits.filter(p => p.ptwType === type.name).length;
      });

      const team = allUsers.filter(u => u.assignedProjectIds?.includes(site.id));
      const managers = team.filter(u => u.role === 'Site Manager').map(u => u.username).join(', ');
      const engineers = team.filter(u => u.role === 'Site Engineer').map(u => u.username).join(', ');

      return {
        ...site,
        total: sitePermits.length,
        typeCounts,
        managers: managers || '—',
        engineers: engineers || '—'
      };
    }).filter(row => 
      row.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.projectCompany.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => b.total - a.total);
  }, [allSites, allPermits, ptwTypes, allUsers, searchTerm, queryDateRange]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const { scrollLeft } = scrollContainerRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - 300 : scrollLeft + 300;
      scrollContainerRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  const handleExport = () => {
    if (!dashboardData || dashboardData.length === 0) return;

    const exportData = dashboardData.map(row => {
      const data: any = {
        'Project Company': row.projectCompany,
        'Project Name': row.name,
        'Managers': row.managers,
        'Engineers': row.engineers,
        'Total PtWs': row.total
      };
      
      ptwTypes?.forEach(type => {
        data[type.name] = row.typeCounts[type.name] || 0;
      });
      
      return data;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PtW Compliance Matrix");
    XLSX.writeFile(wb, `PtW_Dashboard_${format(queryDateRange.start, 'yyyyMMdd')}.xlsx`);
  };

  if (isProfileLoading || sitesLoading || typesLoading || usersLoading || permitsLoading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-[500px] w-full" /></div>;
  }

  if (!isAdmin) return <div className="p-20 text-center font-bold text-destructive">Unauthorized Access.</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {isMobile && (
        <Alert className="bg-primary/5 border-primary/20 rounded-sm">
          <Info className="h-4 w-4 text-primary" />
          <AlertTitle className="text-[10px] font-black uppercase tracking-widest text-primary">View Optimization</AlertTitle>
          <AlertDescription className="text-[11px] font-medium leading-relaxed">
            This page is optimized for desktop view. Please open it in Chrome and <strong>Enable Desktop View</strong> for the best experience.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.push('/ptw/activities')} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Activities
        </Button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-sm shrink-0">
              <LayoutDashboard className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight">PtW Compliance Matrix</h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Site-wise performance & volume analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleExport} variant="outline" size="sm" className="h-10 rounded-sm font-bold border-primary text-primary hover:bg-primary/5 mr-2">
              <FileDown className="h-4 w-4 mr-2" /> Export
            </Button>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="h-10 w-[160px] rounded-sm font-black uppercase text-[10px] tracking-widest bg-secondary border-none">
                <Calendar className="mr-2 h-3.5 w-3.5" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today" className="text-[10px] font-black uppercase">Today</SelectItem>
                <SelectItem value="yesterday" className="text-[10px] font-black uppercase">Yesterday</SelectItem>
                <SelectItem value="7days" className="text-[10px] font-black uppercase">Last 7 Days</SelectItem>
                <SelectItem value="lastMonth" className="text-[10px] font-black uppercase">Last Month</SelectItem>
                <SelectItem value="lastYear" className="text-[10px] font-black uppercase">Last Year</SelectItem>
                <SelectItem value="allTime" className="text-[10px] font-black uppercase">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="relative group">
        <Card className="rounded-sm shadow-xl border-primary/10 overflow-hidden bg-background">
          <CardHeader className="bg-muted/30 border-b py-3 px-4">
             <div className="relative max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input 
                  placeholder="Filter site or client..." 
                  className="pl-8 h-9 text-[11px] font-bold bg-background border-primary/10" 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
             </div>
          </CardHeader>
          <CardContent className="p-0 relative">
            <div 
              ref={scrollContainerRef}
              className="overflow-auto scrollbar-hide max-h-[70vh]"
            >
              <Table className="border-separate border-spacing-0 text-[10px] min-w-full w-max table-fixed">
                <TableHeader className="sticky top-0 z-40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="sticky left-0 z-50 w-[180px] min-w-[180px] font-black uppercase tracking-widest px-4 h-10 border-r border-b bg-background shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Project Company</TableHead>
                    <TableHead className="sticky left-[180px] z-50 w-[200px] min-w-[200px] font-black uppercase tracking-widest px-4 h-10 border-r border-b bg-background shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Project Name</TableHead>
                    <TableHead className="sticky left-[380px] z-50 w-[220px] min-w-[220px] font-black uppercase tracking-widest px-4 h-10 border-r border-b text-primary bg-background shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Assigned Personnel</TableHead>
                    <TableHead className="sticky left-[600px] z-50 w-[100px] min-w-[100px] font-black uppercase tracking-widest px-4 h-10 border-r border-b text-center bg-primary text-primary-foreground shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Total</TableHead>
                    
                    {ptwTypes?.map(type => (
                      <TableHead key={`head-${type.id}`} className="w-[140px] min-w-[140px] font-black uppercase tracking-tight text-center px-2 h-10 border-r border-b last:border-r-0 bg-muted/50 backdrop-blur">
                        {type.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboardData.length > 0 ? dashboardData.map((row) => (
                    <TableRow key={`row-${row.id}`} className="hover:bg-muted/10 transition-colors group">
                      <TableCell className="sticky left-0 z-30 px-4 py-2 font-bold text-muted-foreground border-r border-b bg-background group-hover:bg-muted truncate max-w-[180px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] transition-colors">
                        {row.projectCompany}
                      </TableCell>
                      <TableCell className="sticky left-[180px] z-30 px-4 py-2 font-black text-foreground border-r border-b bg-background group-hover:bg-muted truncate max-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] transition-colors">
                        {row.name}
                      </TableCell>
                      <TableCell className="sticky left-[380px] z-30 px-4 py-2 border-r border-b bg-background group-hover:bg-muted shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] transition-colors">
                        <div className="flex flex-col gap-0.5 max-w-[220px]">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-[8px] font-black text-primary uppercase bg-primary/5 px-1 rounded-[2px] shrink-0">MGR</span>
                            <span className="font-bold truncate">{row.managers}</span>
                          </div>
                          <div className="flex items-center gap-1.5 truncate opacity-70">
                            <span className="text-[8px] font-black text-slate-500 uppercase bg-slate-100 px-1 rounded-[2px] shrink-0">ENG</span>
                            <span className="font-medium truncate">{row.engineers}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="sticky left-[600px] z-30 px-4 py-2 text-center border-r border-b bg-background group-hover:bg-primary/5 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] transition-colors">
                        <span className="font-black text-sm text-primary">{row.total}</span>
                      </TableCell>
                      
                      {ptwTypes?.map(type => (
                        <TableCell key={`cell-${row.id}-${type.id}`} className="px-2 py-2 text-center border-r border-b last:border-r-0">
                          <span className={cn(
                            "font-bold text-[11px]",
                            row.typeCounts[type.name] > 0 ? "text-foreground" : "text-muted-foreground/20"
                          )}>
                            {row.typeCounts[type.name] || 0}
                          </span>
                        </TableCell>
                      ))}
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={(ptwTypes?.length || 0) + 4} className="h-40 text-center italic text-muted-foreground uppercase font-black text-[11px] opacity-20 tracking-[0.2em]">
                        No compliance data recorded for this selection
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Floating Horizontal Scroll Controls */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-[60] no-print animate-in fade-in slide-in-from-right-4 duration-500">
        <Button 
          variant="secondary" 
          size="icon" 
          className="h-12 w-12 rounded-full shadow-2xl bg-background/90 backdrop-blur border-2 border-primary/20 hover:bg-primary hover:text-white transition-all scale-100 hover:scale-110 active:scale-95 group"
          onClick={() => scroll('left')}
          title="Scroll Left"
        >
          <ChevronLeft className="h-6 w-6 group-hover:scale-110 transition-transform" />
        </Button>
        <Button 
          variant="secondary" 
          size="icon" 
          className="h-12 w-12 rounded-full shadow-2xl bg-background/90 backdrop-blur border-2 border-primary/20 hover:bg-primary hover:text-white transition-all scale-100 hover:scale-110 active:scale-95 group"
          onClick={() => scroll('right')}
          title="Scroll Right"
        >
          <ChevronRight className="h-6 w-6 group-hover:scale-110 transition-transform" />
        </Button>
      </div>
    </div>
  );
}
