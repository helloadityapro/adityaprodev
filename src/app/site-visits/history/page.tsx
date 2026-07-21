
"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { collection, query, where, limit, doc, or, and, orderBy } from "firebase/firestore";
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
  ListFilter,
  Globe,
  LayoutGrid
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isSuperAdmin } from "@/lib/auth-constants";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { slugifyRole } from "@/lib/access-control";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

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
  locationType?: 'site' | 'other';
};

type AccessConfig = {
  id: string;
  ownDataOnly?: boolean;
};

type MappingOverride = {
  id: string;
  engineerId: string;
  siteId: string;
  managerId: string;
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

const calculateDurationStr = (mins: number) => {
  if (mins === 0) return '—';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
};

export default function SiteVisitsHistoryPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [deptFilter, setDeptFilter] = React.useState("all");
  const [dateFilter, setDateFilter] = React.useState<string>("7days");
  const [locationTab, setLocationTab] = React.useState<string>("site");
  const [customStart, setCustomStart] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'startTime', direction: 'desc' });

  // Persistence logic for active tab
  React.useEffect(() => {
    const savedTab = localStorage.getItem('siteVisitsActiveTab');
    if (savedTab && (savedTab === 'site' || savedTab === 'other')) {
      setLocationTab(savedTab);
    }
  }, []);

  const handleTabChange = (val: string) => {
    setLocationTab(val);
    localStorage.setItem('siteVisitsActiveTab', val);
  };

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  // Authority Flags
  const isSuper = isSuperAdmin(user?.email);
  const isAdmin = isSuper || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<AccessConfig>(roleConfigsQuery);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<{ name: string, id: string }>(sitesQuery);

  const overridesQuery = useMemoFirebase(() => collection(firestore, 'team_mapping_overrides'), [firestore]);
  const { data: allOverrides } = useCollection<MappingOverride>(overridesQuery);

  const deptsQuery = useMemoFirebase(() => collection(firestore, 'user_departments'), [firestore]);
  const { data: allDepts } = useCollection<{ name: string }>(deptsQuery);

  const teamQuery = useMemoFirebase(() => {
    if (!isManager || !user) return null;
    return query(collection(firestore, 'users'), where('siteManagerId', '==', user.uid));
  }, [firestore, user, isManager]);
  const { data: teamMembers } = useCollection<any>(teamQuery);

  const accessibleSites = React.useMemo(() => {
    if (!allSites || !userProfile) return [];
    if (isAdmin) return allSites;
    
    const roleId = userProfile.role ? slugifyRole(userProfile.role) : 'none';
    const isOwnDataOnly = userProfile.ownDataOnly !== undefined 
      ? userProfile.ownDataOnly 
      : roleConfigs?.find(c => c.id === roleId)?.ownDataOnly ?? false;

    if (!isOwnDataOnly) return allSites;

    const siteIds = new Set<string>();
    if (isManager) {
      allOverrides?.filter(o => o.managerId === userProfile.id).forEach(o => siteIds.add(o.siteId));
      teamMembers?.forEach(member => {
        (member.assignedProjectIds || []).forEach(sid => {
          const hasOtherOverride = allOverrides?.some(o => o.engineerId === member.id && o.siteId === sid && o.managerId !== userProfile.id);
          if (!hasOtherOverride) siteIds.add(sid);
        });
      });
    } else {
      (userProfile.assignedProjectIds || []).forEach(id => siteIds.add(id));
    }
    return allSites.filter(s => siteIds.has(s.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [allSites, userProfile, roleConfigs, isAdmin, isManager, teamMembers, allOverrides]);

  const accessibleSiteIds = React.useMemo(() => new Set(accessibleSites.map(s => s.id)), [accessibleSites]);

  const historyQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    return query(collection(firestore, 'site_visits'), orderBy('startTime', 'desc'));
  }, [firestore, user, isProfileLoading]);

  const { data: visits, isLoading } = useCollection<SiteVisit>(historyQuery);

  const queryDateRange = React.useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    
    switch (dateFilter) {
      case 'today': return { start: todayStr, end: todayStr };
      case 'yesterday': return { start: format(subDays(today, 1), 'yyyy-MM-dd'), end: format(subDays(today, 1), 'yyyy-MM-dd') };
      case '7days': return { start: format(subDays(today, 7), 'yyyy-MM-dd'), end: todayStr };
      case 'lastMonth': return { start: format(subMonths(today, 1), 'yyyy-MM-dd'), end: todayStr };
      case 'allTime': return { start: '1970-01-01', end: '2099-12-31' };
      case 'custom': return { start: customStart, end: customEnd };
      default: return { start: format(subDays(today, 7), 'yyyy-MM-dd'), end: todayStr };
    }
  }, [dateFilter, customStart, customEnd]);

  const filteredVisits = React.useMemo(() => {
    if (!visits || !userProfile) return [];
    
    let list = visits;

    if (!isAdmin) {
      list = list.filter(v => 
        accessibleSiteIds.has(v.siteId) || v.managerId === user?.uid || v.locationType === 'other'
      );
    }

    const { start, end } = queryDateRange;

    const result = list.filter(v => {
      const vDate = v.startTime?.toDate?.() || new Date(v.startTime);
      const vDateStr = format(vDate, 'yyyy-MM-dd');

      const matchesSearch = v.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.purpose || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.managerName || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
      const matchesDept = deptFilter === 'all' || v.department === deptFilter;
      const matchesDate = vDateStr >= start && vDateStr <= end;
      
      const matchesLocation = v.locationType === locationTab || (locationTab === 'site' && (!v.locationType || v.locationType === 'site'));
      
      return matchesSearch && matchesStatus && matchesDept && matchesDate && matchesLocation;
    });

    return result.sort((a, b) => {
      const { key, direction } = sortConfig;
      let valA: any = ''; let valB: any = '';
      if (key === 'startTime') { valA = a.startTime?.toDate?.()?.getTime() || 0; valB = b.startTime?.toDate?.()?.getTime() || 0; }
      else if (key === 'siteName') { valA = a.siteName.toLowerCase(); valB = b.siteName.toLowerCase(); }
      else if (key === 'managerName') { valA = a.managerName.toLowerCase(); valB = b.managerName.toLowerCase(); }
      else if (key === 'duration') { valA = calculateDurationMins(a.startTime, a.endTime); valB = calculateDurationMins(b.startTime, b.endTime); }
      else if (key === 'status') { valA = a.status; valB = b.status; }
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [visits, searchTerm, statusFilter, deptFilter, sortConfig, userProfile, isAdmin, accessibleSiteIds, user, queryDateRange, locationTab]);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3 text-primary" /> : <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setDeptFilter("all");
    setDateFilter("7days");
  };

  function renderResults() {
    return (
      <>
        <div className="md:hidden space-y-4">
          {filteredVisits.length > 0 ? filteredVisits.map(visit => (
            <Card key={visit.id} className="border-primary/10 rounded-sm shadow-sm overflow-hidden" onClick={() => router.push(`/site-visits/${visit.id}`)}>
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">{formatTimestamp(visit.startTime)}</span>
                    <h3 className="font-bold text-sm leading-tight text-foreground line-clamp-2">{visit.siteName}</h3>
                  </div>
                  <Badge className={cn("rounded-sm text-[9px] font-bold uppercase", visit.status === 'completed' ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800")}>{visit.status}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground truncate mr-4">
                    <User className="h-3.5 w-3.5 text-primary/60" />
                    <span>{visit.managerName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary shrink-0">
                    <Timer className="h-3.5 w-3.5" />
                    {calculateDurationStr(calculateDurationMins(visit.startTime, visit.endTime))}
                  </div>
                </div>
                <div className="pt-2 border-t border-primary/5 flex justify-end">
                  <Button variant="ghost" size="sm" className="h-8 rounded-sm text-primary text-[10px] font-bold uppercase tracking-widest">
                    View Report <ArrowRight className="ml-1.5 h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )) : <div className="text-center py-12 text-muted-foreground italic bg-muted/5 rounded-sm border-2 border-dashed">No records discovered for this category.</div>}
        </div>

        <div className="hidden md:block">
          <Card className="rounded-sm overflow-hidden border-primary/10 shadow-lg">
            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <div className="min-w-[800px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('startTime')}><div className="flex items-center">Start Date & Time <SortIcon column="startTime" /></div></TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('siteName')}><div className="flex items-center">Location Name <SortIcon column="siteName" /></div></TableHead>
                        {(isAdmin || isManager) && (<TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('managerName')}><div className="flex items-center">Personnel <SortIcon column="managerName" /></div></TableHead>)}
                        <TableHead>Purpose</TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('duration')}><div className="flex items-center">Duration <SortIcon column="duration" /></div></TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('status')}><div className="flex items-center">Status <SortIcon column="status" /></div></TableHead>
                        <TableHead className="text-right px-6">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVisits.length > 0 ? filteredVisits.map((visit) => (
                        <TableRow key={visit.id} className="hover:bg-muted/5 transition-colors group" onClick={() => router.push(`/site-visits/${visit.id}`)}>
                          <TableCell className="font-mono text-xs font-bold text-muted-foreground">{formatTimestamp(visit.startTime)}</TableCell>
                          <TableCell className="font-black text-sm">
                            <div className="flex items-center gap-2">
                              {visit.locationType === 'other' ? <Globe className="h-3.5 w-3.5 text-primary/40" /> : <Building2 className="h-3.5 w-3.5 text-primary/40" />}
                              {visit.siteName}
                            </div>
                          </TableCell>
                          {(isAdmin || isManager) && (
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2 text-xs font-bold"><User className="h-3.5 w-3.5 text-primary" />{visit.managerName}</div>
                                {visit.department && (<Badge className="w-fit text-[8px] h-4 font-black uppercase rounded-sm border-none bg-slate-900 text-white flex items-center gap-1 px-1.5"><Building2 className="h-3 w-3" /> {visit.department}</Badge>)}
                              </div>
                            </TableCell>
                          )}
                          <TableCell><Badge variant="secondary" className="text-[9px] font-black uppercase rounded-sm px-1.5 py-0">{visit.purpose || '—'}</Badge></TableCell>
                          <TableCell><div className="flex items-center gap-1.5 text-xs font-bold text-primary"><Timer className="h-3.5 w-3.5" />{calculateDurationStr(calculateDurationMins(visit.startTime, visit.endTime))}</div></TableCell>
                          <TableCell><Badge className={cn("rounded-sm text-[9px] font-bold uppercase", visit.status === 'completed' ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800")}>{visit.status}</Badge></TableCell>
                          <TableCell className="text-right px-6"><Button variant="ghost" size="sm" asChild className="rounded-sm text-primary"><Link href={`/site-visits/${visit.id}`}><FileText className="h-4 w-4 mr-1.5" />View Report</Link></Button></TableCell>
                        </TableRow>
                      )) : <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic">No records discovered in this category.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  if (isLoading || isProfileLoading) return <div className="p-8 space-y-4 max-w-5xl mx-auto"><Skeleton className="h-12 w-48" /><Skeleton className="h-[500px] w-full" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2">
          <History className="h-8 w-8 text-primary" /> {isAdmin ? "Global Site Visits Data" : "Site Visits Data"}
        </h1>
        <p className="text-muted-foreground">Historical records of your Site Visits.</p>
      </div>

      <div className="bg-card p-3 border rounded-sm shadow-sm no-print">
        <div className="flex flex-wrap items-end gap-2 md:gap-3">
          {/* Search Box - Flex-grow to fill remaining space */}
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest px-1">Search Context</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input 
                placeholder="Personnel/Location..." 
                className="pl-8 h-9 text-xs rounded-sm border-primary/10 bg-background" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
          </div>
          
          {/* Time Filter - Standard size */}
          <div className="w-[110px] sm:w-[130px] space-y-1.5">
            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest px-1">Time</Label>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="h-9 rounded-sm border-primary/20 bg-background font-bold text-[10px] uppercase">
                <Calendar className="h-3.5 w-3.5 mr-1.5 opacity-50" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today" className="text-[10px] font-bold uppercase">Today</SelectItem>
                <SelectItem value="yesterday" className="text-[10px] font-bold uppercase">Yesterday</SelectItem>
                <SelectItem value="7days" className="text-[10px] font-bold uppercase">7 Days</SelectItem>
                <SelectItem value="lastMonth" className="text-[10px] font-bold uppercase">Month</SelectItem>
                <SelectItem value="allTime" className="text-[10px] font-bold uppercase">All</SelectItem>
                <SelectItem value="custom" className="text-[10px] font-bold uppercase text-primary">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter - Standard size */}
          <div className="w-[100px] sm:w-[120px] space-y-1.5">
            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest px-1">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 rounded-sm border-primary/20 bg-background font-bold text-[10px] uppercase">
                <ListFilter className="h-3.5 w-3.5 mr-1.5 opacity-50" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-[10px] font-bold uppercase">All</SelectItem>
                <SelectItem value="ongoing" className="text-[10px] font-bold uppercase">Active</SelectItem>
                <SelectItem value="completed" className="text-[10px] font-bold uppercase">Done</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dept Filter - Standard size */}
          <div className="w-[100px] sm:w-[130px] space-y-1.5">
            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest px-1">Dept</Label>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="h-9 rounded-sm border-primary/20 bg-background font-bold text-[10px] uppercase">
                <Building2 className="h-3.5 w-3.5 mr-1.5 opacity-50" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-[10px] font-bold uppercase">All</SelectItem>
                {allDepts?.map(dept => (
                  <SelectItem key={dept.name} value={dept.name} className="text-[10px] font-bold uppercase">{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reset Button */}
          <Button variant="ghost" size="icon" onClick={clearFilters} title="Reset" className="h-9 w-9 rounded-sm text-muted-foreground border border-transparent hover:border-primary/10 shrink-0">
            <FilterX className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Custom Range Expansion */}
        {dateFilter === 'custom' && (
          <div className="flex items-center gap-3 pt-3 border-t border-border/50 mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex-1 space-y-1">
              <Label className="text-[9px] font-black uppercase text-primary tracking-widest px-1">Start Range</Label>
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-8 text-[10px] rounded-sm border-primary/20" />
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground mt-4 shrink-0" />
            <div className="flex-1 space-y-1">
              <Label className="text-[9px] font-black uppercase text-primary tracking-widest px-1">End Range</Label>
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-8 text-[10px] rounded-sm border-primary/20" />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <Tabs value={locationTab} onValueChange={handleTabChange} className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <TabsList className="bg-muted/50 border border-primary/10 p-1 h-11 max-w-sm m-0">
              <TabsTrigger value="site" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
                <Building2 className="h-3.5 w-3.5 mr-2" /> Site Visits
              </TabsTrigger>
              <TabsTrigger value="other" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
                <Globe className="h-3.5 w-3.5 mr-2" /> Other Visits
              </TabsTrigger>
            </TabsList>
            <Badge variant="secondary" className="rounded-sm font-black uppercase text-[9px] tracking-widest px-3 h-8 border-none w-fit">
              {filteredVisits.length} Records Indexed
            </Badge>
          </div>

          <TabsContent value="site" className="mt-0 space-y-4 animate-in fade-in-50 duration-300">
            {renderResults()}
          </TabsContent>

          <TabsContent value="other" className="mt-0 space-y-4 animate-in fade-in-50 duration-300">
            {renderResults()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
