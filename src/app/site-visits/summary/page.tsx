'use client';

import * as React from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Search, 
  Check, 
  ChevronsUpDown, 
  Calendar, 
  User, 
  Clock, 
  Timer,
  CheckCircle2,
  Loader2,
  Navigation,
  Building2,
  ArrowRight,
  Globe,
  AreaChart,
  FileText,
  Eye,
  FileDown,
  Users,
  FilterX,
  CalendarRange
} from 'lucide-react';
import { format, startOfDay, endOfDay, parseISO, differenceInMinutes, isValid, subDays, subMonths, subYears } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { isSuperAdmin } from '@/lib/auth-constants';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import * as XLSX from 'xlsx';

type UserProfile = {
  id: string;
  username: string;
  email: string;
  role: string;
};

type SiteVisit = {
  id: string;
  siteName: string;
  managerName: string;
  managerId: string;
  startTime: any;
  endTime?: any;
  status: 'ongoing' | 'completed';
  locationType?: 'site' | 'other';
  purpose?: string;
};

export default function SiteVisitsSummaryPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([]);
  const [dateFilter, setDateFilter] = React.useState<string>("7days");
  const [customStart, setCustomStart] = React.useState<string>(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  
  const [isUserPopoverOpen, setIsUserPopoverOpen] = React.useState(false);
  const [userSearchQuery, setUserSearchQuery] = React.useState("");
  const [isLoadingData, setIsLoadingData] = React.useState(false);
  const [filteredVisits, setFilteredVisits] = React.useState<SiteVisit[]>([]);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: currentUserProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || currentUserProfile?.role === 'Admin';

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers, isLoading: isUsersLoading } = useCollection<UserProfile>(usersQuery);

  const filteredUsersList = React.useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(u => 
      u.username?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearchQuery.toLowerCase())
    ).sort((a, b) => a.username.localeCompare(b.username));
  }, [allUsers, userSearchQuery]);

  React.useEffect(() => {
    if (!isUserLoading && !isProfileLoading && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [isUserLoading, isProfileLoading, isAdmin, router]);

  React.useEffect(() => {
    const fetchVisits = async () => {
      if (selectedUserIds.length === 0) {
        setFilteredVisits([]);
        return;
      }
      setIsLoadingData(true);
      
      const today = new Date();
      let start: Date;
      let end: Date = endOfDay(today);

      switch (dateFilter) {
        case 'today': start = startOfDay(today); end = endOfDay(today); break;
        case 'yesterday': start = startOfDay(subDays(today, 1)); end = endOfDay(subDays(today, 1)); break;
        case '7days': start = startOfDay(subDays(today, 7)); break;
        case 'lastMonth': start = startOfDay(subMonths(today, 1)); break;
        case 'last6months': start = startOfDay(subMonths(today, 6)); break;
        case 'lastYear': start = startOfDay(subYears(today, 1)); break;
        case 'allTime': start = new Date(0); break;
        case 'custom': 
          start = startOfDay(parseISO(customStart)); 
          end = endOfDay(parseISO(customEnd)); 
          break;
        default: start = startOfDay(subDays(today, 7));
      }

      if (!isValid(start) || !isValid(end)) {
        setIsLoadingData(false);
        return;
      }

      try {
        // Since we allow multiple users, we fetch based on status and filter by ID array
        // and date range client-side for precision in the prototype.
        const q = query(
          collection(firestore, 'site_visits'),
          where('status', '==', 'completed')
        );
        
        const snap = await getDocs(q);
        const results = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as SiteVisit))
          .filter(v => {
            if (!selectedUserIds.includes(v.managerId)) return false;
            const d = v.startTime?.toDate();
            return d && d >= start && d <= end;
          })
          .sort((a, b) => b.startTime.toDate().getTime() - a.startTime.toDate().getTime());
        
        setFilteredVisits(results);
      } catch (e) {
        console.error("Failed to fetch visits", e);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchVisits();
  }, [selectedUserIds, dateFilter, customStart, customEnd, firestore]);

  const calculateDurationMins = (start: any, end: any) => {
    if (!start || !end) return 0;
    const s = start.toDate ? start.toDate() : new Date(start);
    const e = end.toDate ? end.toDate() : new Date(end);
    return differenceInMinutes(e, s);
  };

  const calculateDurationStr = (mins: number) => {
    const hours = Math.floor(mins / 60);
    const m = mins % 60;
    return `${hours}h ${m}m`;
  };

  const userStats = React.useMemo(() => {
    const stats: Record<string, { username: string, visits: number, totalMins: number }> = {};
    
    selectedUserIds.forEach(id => {
      const u = allUsers?.find(user => user.id === id);
      stats[id] = { username: u?.username || 'Unknown', visits: 0, totalMins: 0 };
    });

    filteredVisits.forEach(v => {
      if (stats[v.managerId]) {
        stats[v.managerId].visits++;
        stats[v.managerId].totalMins += calculateDurationMins(v.startTime, v.endTime);
      }
    });

    return Object.values(stats).sort((a, b) => b.visits - a.visits);
  }, [filteredVisits, selectedUserIds, allUsers]);

  const globalSummary = React.useMemo(() => {
    const totalVisits = filteredVisits.length;
    let totalMinutes = 0;

    filteredVisits.forEach(v => {
      totalMinutes += calculateDurationMins(v.startTime, v.endTime);
    });

    return {
      totalVisits,
      totalTime: calculateDurationStr(totalMinutes),
      avgTime: totalVisits > 0 ? calculateDurationStr(Math.round(totalMinutes / totalVisits)) : '0h 0m'
    };
  }, [filteredVisits]);

  const handleExport = () => {
    if (filteredVisits.length === 0) return;

    const workbook = XLSX.utils.book_new();

    // Per user summary sheet
    const summaryData = userStats.map(s => ({
        'Personnel': s.username,
        'No. of Visits': s.visits,
        'Total Time': calculateDurationStr(s.totalMins),
        'Avg Time/Site': s.visits > 0 ? calculateDurationStr(Math.round(s.totalMins / s.visits)) : '—'
    }));
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, wsSummary, "Team Summary");

    // Detail log sheet
    const detailData = filteredVisits.map(v => ({
      'Personnel': v.managerName,
      'Date': format(v.startTime.toDate(), 'dd MMM yyyy'),
      'Check-in': format(v.startTime.toDate(), 'HH:mm'),
      'Check-out': v.endTime ? format(v.endTime.toDate(), 'HH:mm') : 'Ongoing',
      'Location': v.siteName,
      'Type': v.locationType || 'site',
      'Purpose': v.purpose || 'N/A',
      'Duration (Mins)': calculateDurationMins(v.startTime, v.endTime)
    }));
    const wsDetail = XLSX.utils.json_to_sheet(detailData);
    XLSX.utils.book_append_sheet(workbook, wsDetail, "Activity Log");

    XLSX.writeFile(workbook, `Visit_Audit_Summary_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const toggleUser = (id: string) => {
    setSelectedUserIds(prev => 
      prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
    );
  };

  if (isProfileLoading || isUsersLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-sm shrink-0">
              <AreaChart className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-foreground">Visit Summary Audit</h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mt-1">Comparative Field Analytics</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 bg-card p-4 border border-primary/10 rounded-sm shadow-sm no-print">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Select Personnel</Label>
            <Popover open={isUserPopoverOpen} onOpenChange={setIsUserPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[260px] justify-between h-10 rounded-sm font-bold border-primary/20 bg-background text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <Users className="h-3.5 w-3.5 text-primary opacity-60" />
                    <span className="truncate">
                        {selectedUserIds.length === 0 ? "Select Personnel..." : 
                         selectedUserIds.length === 1 ? allUsers?.find(u => u.id === selectedUserIds[0])?.username :
                         `${selectedUserIds.length} Selection(s)`}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <div className="flex items-center border-b px-3 bg-muted/20">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <Input 
                    placeholder="Search name..." 
                    className="h-9 w-full border-none focus-visible:ring-0 px-0 text-sm bg-transparent" 
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                  />
                </div>
                <ScrollArea className="h-[300px]">
                  <div className="p-2 space-y-1">
                    {filteredUsersList.map(u => (
                      <div 
                        key={u.id} 
                        className={cn(
                            "flex items-center space-x-3 p-2.5 rounded-sm hover:bg-primary/5 transition-colors cursor-pointer group",
                            selectedUserIds.includes(u.id) && "bg-primary/5"
                        )}
                        onClick={() => toggleUser(u.id)}
                      >
                        <Checkbox checked={selectedUserIds.includes(u.id)} className="rounded-[4px]" />
                        <div className="flex flex-col min-w-0">
                          <span className={cn("text-xs font-bold truncate transition-colors", selectedUserIds.includes(u.id) ? "text-primary" : "text-foreground")}>{u.username}</span>
                          <span className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter opacity-60">{u.role}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                {selectedUserIds.length > 0 && (
                    <div className="p-2 border-t bg-muted/5 flex gap-2">
                        <Button variant="ghost" className="h-8 flex-1 rounded-sm text-[9px] font-black uppercase" onClick={() => setSelectedUserIds([])}>Clear All</Button>
                        <Button variant="secondary" className="h-8 flex-1 rounded-sm text-[9px] font-black uppercase" onClick={() => setIsUserPopoverOpen(false)}>Done</Button>
                    </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Audit Window</Label>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[160px] h-10 rounded-sm border-primary/20 bg-background font-bold text-xs uppercase">
                <CalendarRange className="h-4 w-4 mr-2 opacity-50" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today" className="text-[10px] font-bold uppercase">Today</SelectItem>
                <SelectItem value="yesterday" className="text-[10px] font-bold uppercase">Yesterday</SelectItem>
                <SelectItem value="7days" className="text-[10px] font-bold uppercase">Last 7 Days</SelectItem>
                <SelectItem value="lastMonth" className="text-[10px] font-bold uppercase">Last Month</SelectItem>
                <SelectItem value="last6months" className="text-[10px] font-bold uppercase">Last 6 Months</SelectItem>
                <SelectItem value="lastYear" className="text-[10px] font-bold uppercase">Last Year</SelectItem>
                <SelectItem value="allTime" className="text-[10px] font-bold uppercase">All Time</SelectItem>
                <SelectItem value="custom" className="text-[10px] font-bold uppercase text-primary">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dateFilter === 'custom' && (
            <div className="flex items-end gap-2 animate-in slide-in-from-right-2 duration-300">
              <div className="space-y-1.5">
                <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-10 rounded-sm border-primary/20 bg-background text-xs font-bold" />
              </div>
              <div className="space-y-1.5">
                <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-10 rounded-sm border-primary/20 bg-background text-xs font-bold" />
              </div>
            </div>
          )}

          <Button onClick={handleExport} disabled={filteredVisits.length === 0} variant="outline" size="sm" className="h-10 rounded-sm font-bold border-primary text-primary hover:bg-primary/5 px-6">
            <FileDown className="h-4 w-4 mr-2" /> Export
          </Button>
        </div>
      </div>

      {selectedUserIds.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-40 text-center bg-card border border-dashed rounded-sm border-primary/20">
          <div className="p-6 rounded-full bg-primary/5 mb-4"><Users className="h-12 w-12 text-primary/30" /></div>
          <h3 className="text-xl font-bold uppercase tracking-tight">Personnel Selection Required</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mt-2 text-sm font-medium">
            Please choose one or more team members from the filter to generate a comparative visit analysis.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
            <SummaryCard title="Aggregate Visits" value={globalSummary.totalVisits} icon={Navigation} color="blue" description="Total in range" />
            <SummaryCard title="Total Field Time" value={globalSummary.totalTime} icon={Clock} color="primary" description="Team aggregate" />
            <SummaryCard title="Avg. Visit Cycle" value={globalSummary.avgTime} icon={Timer} color="emerald" description="Efficiency metric" />
          </div>

          <Card className="rounded-sm shadow-xl border-primary/10 overflow-hidden">
            <CardHeader className="bg-muted/5 border-b py-4 px-6 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="bg-primary/10 p-1.5 rounded-sm"><Users className="h-4 w-4 text-primary" /></div>
                 <CardTitle className="text-xs font-black uppercase tracking-widest">Personnel Performance Matrix</CardTitle>
              </div>
              <Badge variant="secondary" className="rounded-full px-3 h-6 font-mono font-bold">{userStats.length} Selected</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-6 font-black uppercase text-[10px] tracking-widest h-11">Team Member</TableHead>
                    <TableHead className="text-center font-black uppercase text-[10px] tracking-widest h-11">Total Visits</TableHead>
                    <TableHead className="text-center font-black uppercase text-[10px] tracking-widest h-11">Cumulative Time</TableHead>
                    <TableHead className="text-right px-6 font-black uppercase text-[10px] tracking-widest h-11">Avg. Time / Site</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userStats.map((stat, idx) => (
                    <TableRow key={idx} className="hover:bg-muted/5 transition-colors">
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 rounded-sm shadow-sm">
                            <AvatarFallback className="text-[10px] font-black bg-primary/5 text-primary">{stat.username.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="font-black text-sm text-foreground">{stat.username}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-black text-primary text-base tabular-nums">{stat.visits}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2 font-bold text-xs text-foreground">
                          <Clock className="h-3.5 w-3.5 text-primary opacity-40" />
                          {calculateDurationStr(stat.totalMins)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <Badge variant="outline" className="rounded-sm font-black text-[10px] uppercase border-emerald-200 text-emerald-700 bg-emerald-50 h-6 px-2.5">
                          {stat.visits > 0 ? calculateDurationStr(Math.round(stat.totalMins / stat.visits)) : '—'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="rounded-sm shadow-xl border-primary/10 overflow-hidden">
            <CardHeader className="bg-muted/5 border-b py-4 px-6 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-1.5 rounded-sm"><FileText className="h-4 w-4 text-primary" /></div>
                <CardTitle className="text-xs font-black uppercase tracking-widest">Chronological Activity Log</CardTitle>
              </div>
              <div className="relative w-64 no-print">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search location or notes..." className="pl-8 h-8 text-[10px] font-bold rounded-sm border-primary/10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingData ? (
                <div className="p-12 space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : filteredVisits.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="px-6 font-black uppercase text-[10px] tracking-widest h-11">Date & Personnel</TableHead>
                        <TableHead className="font-black uppercase text-[10px] tracking-widest h-11">Location Context</TableHead>
                        <TableHead className="font-black uppercase text-[10px] tracking-widest h-11">Purpose & Findings</TableHead>
                        <TableHead className="text-center font-black uppercase text-[10px] tracking-widest h-11">Duration</TableHead>
                        <TableHead className="text-right px-6 font-black uppercase text-[10px] tracking-widest h-11">Audit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVisits.filter(v => 
                        v.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (v.purpose || '').toLowerCase().includes(searchTerm.toLowerCase())
                      ).map((visit) => (
                        <TableRow key={visit.id} className="hover:bg-muted/5 transition-colors group">
                          <TableCell className="px-6 py-4">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-black text-sm text-foreground">{visit.managerName}</span>
                              <span className="text-[9px] font-mono font-black text-muted-foreground uppercase tracking-tight">{format(visit.startTime.toDate(), 'dd MMM yyyy')} • {format(visit.startTime.toDate(), 'HH:mm')}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                                {visit.locationType === 'other' ? <Globe className="h-3.5 w-3.5 text-primary/40" /> : <Building2 className="h-3.5 w-3.5 text-primary/40" />}
                                <span className="truncate max-w-[180px]">{visit.siteName}</span>
                              </div>
                              <Badge variant="secondary" className="w-fit h-4 text-[7px] font-black uppercase px-1 rounded-[2px]">{visit.locationType || 'site'}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5 max-w-[250px]">
                                <span className="text-[10px] font-black uppercase text-primary tracking-tighter leading-none mb-1">{visit.purpose || 'General Audit'}</span>
                                <p className="text-[11px] font-medium text-muted-foreground italic line-clamp-1">"{visit.details || 'Documentation provided.'}"</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2 font-black text-xs text-foreground">
                              <Timer className="h-3.5 w-3.5 text-primary/60" />
                              {calculateDurationStr(calculateDurationMins(visit.startTime, visit.endTime))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                              <Link href={`/site-visits/${visit.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-32 text-center text-muted-foreground italic text-xs uppercase font-black tracking-widest opacity-20 leading-relaxed">
                  No completed presence records discovered in the specified window.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, color, description }: { title: string, value: string | number, icon: any, color: 'primary' | 'emerald' | 'blue', description: string }) {
  const colors = {
    primary: "bg-primary/5 border-primary/10 text-primary",
    emerald: "bg-emerald-500/5 border-emerald-500/10 text-emerald-600",
    blue: "bg-blue-500/5 border-blue-500/10 text-blue-600",
  };

  return (
    <Card className={cn("rounded-sm border shadow-sm overflow-hidden group hover:shadow-lg transition-all duration-300", colors[color])}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{title}</CardTitle>
        <div className="p-2 rounded-sm bg-background/50 border border-border/5 group-hover:scale-110 transition-transform">
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        <div className="text-3xl font-black tabular-nums tracking-tighter leading-none mb-1">{value}</div>
        <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-40">{description}</p>
      </CardContent>
    </Card>
  );
}

function Avatar({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}>
      {children}
    </div>
  );
}

function AvatarFallback({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)}>
      {children}
    </div>
  );
}
