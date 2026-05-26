
"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { collection, query, where, limit, doc, or } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, differenceInMinutes, subDays, subMonths, subYears } from "date-fns";
import { 
  History, 
  Timer, 
  FileText, 
  Search, 
  User, 
  ArrowRight, 
  Building2, 
  Calendar, 
  Clock, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  FilterX, 
  ListFilter 
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { isSuperAdmin } from "@/lib/auth-constants";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Label } from "@/components/ui/label";

type SiteVisit = {
  id: string;
  siteId: string;
  siteName: string;
  managerName: string;
  managerId: string;
  siteManagerId?: string;
  department?: string;
  startTime: any;
  endTime?: any;
  purpose?: string;
  status: 'ongoing' | 'completed';
};

type AccessConfig = {
  id: string;
  ownDataOnly?: boolean;
};

type SortKey = 'startTime' | 'siteName' | 'managerName' | 'duration' | 'status';

const formatTimestamp = (ts: any) => {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : (typeof ts === 'string' ? new Date(ts) : ts);
  return format(date, 'dd MMM yyyy HH:mm');
};

const calculateDurationMins = (start: any, end: any) => {
  if (!start || !end) return 0;
  const s = start.toDate ? start.toDate() : new Date(start);
  const e = end.toDate ? end.toDate() : new Date(end);
  return differenceInMinutes(e, s);
};

const calculateDurationStr = (start: any, end: any) => {
  const mins = calculateDurationMins(start, end);
  if (mins === 0) return '—';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
};

export default function SiteVisitsHistoryPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [dateFilter, setDateFilter] = React.useState<string>("7days");
  const [customStart, setCustomStart] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'startTime', direction: 'desc' });

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<AccessConfig>(roleConfigsQuery);

  const isSuper = isSuperAdmin(user?.email);
  const isAdmin = isSuper || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const historyQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'site_visits');
    
    if (isAdmin) return query(colRef, limit(500));

    if (isManager) {
        return query(
            colRef,
            or(where('managerId', '==', user.uid), where('siteManagerId', '==', user.uid)),
            limit(300)
        );
    }
    
    return query(colRef, where('managerId', '==', user.uid), limit(200));
  }, [firestore, user, isAdmin, isManager, isProfileLoading]);

  const { data: visits, isLoading } = useCollection<SiteVisit>(historyQuery);

  const queryDateRange = React.useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    
    switch (dateFilter) {
      case 'today':
        return { start: todayStr, end: todayStr };
      case 'yesterday':
        const yesterday = format(subDays(today, 1), 'yyyy-MM-dd');
        return { start: yesterday, end: yesterday };
      case '7days':
        return { start: format(subDays(today, 7), 'yyyy-MM-dd'), end: todayStr };
      case 'lastMonth':
        return { start: format(subMonths(today, 1), 'yyyy-MM-dd'), end: todayStr };
      case 'allTime':
        return { start: '1970-01-01', end: '2099-12-31' };
      case 'custom':
        return { start: customStart, end: customEnd };
      default:
        return { start: format(subDays(today, 7), 'yyyy-MM-dd'), end: todayStr };
    }
  }, [dateFilter, customStart, customEnd]);

  const filteredVisits = React.useMemo(() => {
    if (!visits || !userProfile) return [];
    
    const roleId = userProfile.role ? userProfile.role.toLowerCase().replace(/\s+/g, '-') : 'none';
    const isOwnDataOnly = userProfile.ownDataOnly !== undefined 
      ? userProfile.ownDataOnly 
      : roleConfigs?.find(c => c.id === roleId)?.ownDataOnly ?? false;

    let result = visits;

    if (isOwnDataOnly && !isSuper) {
      const assignedIds = new Set(userProfile.assignedProjectIds || []);
      result = result.filter(v => assignedIds.has(v.siteId));
    }

    const { start, end } = queryDateRange;

    result = result.filter(v => {
      const vDate = v.startTime?.toDate?.() || new Date(v.startTime);
      const vDateStr = format(vDate, 'yyyy-MM-dd');

      const matchesSearch = v.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.purpose || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.managerName || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
      const matchesDate = vDateStr >= start && vDateStr <= end;
      
      return matchesSearch && matchesStatus && matchesDate;
    });

    return result.sort((a, b) => {
      const { key, direction } = sortConfig;
      let valA: any = '';
      let valB: any = '';

      if (key === 'startTime') {
        valA = a.startTime?.toDate?.()?.getTime() || 0;
        valB = b.startTime?.toDate?.()?.getTime() || 0;
      } else if (key === 'siteName') {
        valA = a.siteName.toLowerCase();
        valB = b.siteName.toLowerCase();
      } else if (key === 'managerName') {
        valA = a.managerName.toLowerCase();
        valB = b.managerName.toLowerCase();
      } else if (key === 'duration') {
        valA = calculateDurationMins(a.startTime, a.endTime);
        valB = calculateDurationMins(b.startTime, b.endTime);
      } else if (key === 'status') {
        valA = a.status;
        valB = b.status;
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [visits, searchTerm, statusFilter, sortConfig, userProfile, roleConfigs, isSuper, queryDateRange]);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4 text-primary" /> : <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setDateFilter("7days");
  };

  if (isLoading || isProfileLoading) return <div className="p-8 space-y-4 max-w-5xl mx-auto"><Skeleton className="h-12 w-48" /><Skeleton className="h-[500px] w-full" /></div>;

  const headerTitle = isAdmin ? "Organization Visit Logs" : (isManager ? "Team Visit Logs" : "My Site Visit Logs");

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2">
            <History className="h-8 w-8 text-primary" /> {headerTitle}
          </h1>
          <p className="text-muted-foreground">Historical records of site presence from authorized project locations.</p>
        </div>
      </div>

      <div className="bg-card p-4 border rounded-sm shadow-sm no-print space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Search Context</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by site, name, or purpose..." 
                className="pl-10 h-11 rounded-sm border-primary/20 bg-background text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Quick Filter</Label>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="h-11 rounded-sm border-primary/20 bg-background font-bold text-xs uppercase">
                <Calendar className="h-4 w-4 mr-2 opacity-50" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today" className="text-xs font-bold uppercase">Today</SelectItem>
                <SelectItem value="yesterday" className="text-xs font-bold uppercase">Yesterday</SelectItem>
                <SelectItem value="7days" className="text-xs font-bold uppercase">Last 7 Days</SelectItem>
                <SelectItem value="lastMonth" className="text-xs font-bold uppercase">Last Month</SelectItem>
                <SelectItem value="allTime" className="text-xs font-bold uppercase">All Time</SelectItem>
                <SelectItem value="custom" className="text-xs font-bold uppercase text-primary">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Visit Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-11 text-xs font-bold uppercase tracking-tight rounded-sm border-primary/20 bg-background">
                <ListFilter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-bold uppercase">All Visits</SelectItem>
                <SelectItem value="ongoing" className="text-xs font-bold uppercase text-amber-600">Ongoing</SelectItem>
                <SelectItem value="completed" className="text-xs font-bold uppercase text-emerald-600">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {dateFilter === 'custom' && (
          <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-muted/20 rounded-sm border border-dashed animate-in slide-in-from-top-2 duration-300">
            <div className="flex-1 w-full space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Start Date</Label>
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-10 rounded-sm" />
            </div>
            <ArrowRight className="hidden sm:block h-4 w-4 text-muted-foreground mt-6" />
            <div className="flex-1 w-full space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">End Date</Label>
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-10 rounded-sm" />
            </div>
            <Button variant="ghost" size="icon" onClick={clearFilters} className="mt-6 text-muted-foreground hover:text-primary">
              <FilterX className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="md:hidden space-y-4">
        {filteredVisits.length > 0 ? filteredVisits.map((visit) => (
          <Card key={visit.id} className="border-primary/10 rounded-sm shadow-sm overflow-hidden">
            <CardContent className="p-4 space-y-4">
              <div className="flex justify-between items-start gap-4">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTimestamp(visit.startTime)}
                  </span>
                  <h3 className="font-bold text-sm leading-tight text-foreground line-clamp-2">{visit.siteName}</h3>
                </div>
                <Badge className={cn("rounded-sm text-[9px] font-bold uppercase h-5 px-2", visit.status === 'completed' ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800")}>
                  {visit.status}
                </Badge>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[9px] font-black uppercase rounded-sm px-1.5 py-0">
                    {visit.purpose || 'General Visit'}
                  </Badge>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <Timer className="h-3 w-3" />
                    {calculateDurationStr(visit.startTime, visit.endTime)}
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-primary/5 flex justify-end">
                <Button variant="ghost" size="sm" asChild className="rounded-sm text-primary h-8 px-3">
                  <Link href={`/site-visits/${visit.id}`}>
                    <FileText className="h-4 w-4 mr-1.5" />
                    View Report
                    <ArrowRight className="ml-1.5 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )) : <div className="text-center py-12 text-muted-foreground italic bg-muted/5 rounded-sm border-2 border-dashed">No visit records found.</div>}
      </div>

      <div className="hidden md:block">
        <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('startTime')}><div className="flex items-center">Start Date & Time <SortIcon column="startTime" /></div></TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('siteName')}><div className="flex items-center">Project Site <SortIcon column="siteName" /></div></TableHead>
                    {(isAdmin || isManager) && (<TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('managerName')}><div className="flex items-center">Personnel <SortIcon column="managerName" /></div></TableHead>)}
                    <TableHead>Purpose</TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('duration')}><div className="flex items-center">Duration <SortIcon column="duration" /></div></TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('status')}><div className="flex items-center">Status <SortIcon column="status" /></div></TableHead>
                    <TableHead className="text-right px-6">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVisits.length > 0 ? filteredVisits.map((visit) => (
                    <TableRow key={visit.id} className="hover:bg-muted/5 transition-colors group">
                      <TableCell className="font-mono text-xs font-bold text-muted-foreground">{formatTimestamp(visit.startTime)}</TableCell>
                      <TableCell className="font-black text-sm">{visit.siteName}</TableCell>
                      {(isAdmin || isManager) && (
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-xs font-bold"><User className="h-3 w-3 text-primary" />{visit.managerName}</div>
                            {visit.department && (<Badge className="w-fit text-[8px] h-4 font-black uppercase rounded-sm border-none bg-slate-900 text-white flex items-center gap-1 px-1.5"><Building2 className="h-3 w-3" /> {visit.department}</Badge>)}
                          </div>
                        </TableCell>
                      )}
                      <TableCell><Badge variant="secondary" className="text-[9px] font-black uppercase rounded-sm px-1.5 py-0">{visit.purpose || '—'}</Badge></TableCell>
                      <TableCell><div className="flex items-center gap-1.5 text-xs font-bold text-primary"><Timer className="h-3 w-3" />{calculateDurationStr(visit.startTime, visit.endTime)}</div></TableCell>
                      <TableCell><Badge className={cn("rounded-sm text-[9px] font-bold uppercase", visit.status === 'completed' ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800")}>{visit.status}</Badge></TableCell>
                      <TableCell className="text-right px-6"><Button variant="ghost" size="sm" asChild className="rounded-sm text-primary"><Link href={`/site-visits/${visit.id}`}><FileText className="h-4 w-4 mr-1.5" />View Report</Link></Button></TableCell>
                    </TableRow>
                  )) : <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic">No visit records found.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
