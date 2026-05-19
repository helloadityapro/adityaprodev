'use client';

import * as React from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, or, doc, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  Cell, 
  PieChart, 
  Pie, 
  Legend 
} from 'recharts';
import { 
  BarChart3, 
  FileText, 
  ClipboardList, 
  ArrowLeftRight, 
  CheckSquare, 
  ShieldCheck, 
  TrendingUp, 
  Calendar,
  Filter,
  Search,
  Check,
  ChevronsUpDown,
  MapPin,
  CalendarRange,
  History,
  Wallet,
  Navigation,
  User as UserIcon,
  Clock,
  ArrowRight
} from 'lucide-react';
import { format, subDays, isAfter, startOfDay, endOfDay } from 'date-fns';
import { isSuperAdmin } from '@/lib/auth-constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn } from '@/lib/utils';

type DataItem = {
  id: string;
  siteName: string;
  title?: string;
  itemName?: string;
  createdAt?: any;
  requestDate?: any;
  movementDate?: string;
  reportDate?: string;
  dueDate?: string;
  status?: string;
  userId?: string;
  userName?: string;
  siteEngineerId?: string;
  siteEngineerName?: string;
  assignedToId?: string;
  assignedToName?: string;
  assignedById?: string;
  assignedByName?: string;
  siteManagerId?: string | null;
  priority?: string;
  urgency?: string;
  startTime?: any;
  amount?: number;
};

type UserProfile = {
  id: string;
  username: string;
  role: string;
  siteManagerId?: string;
  assignedProjectIds?: string[];
};

type Site = {
  id: string;
  name: string;
};

type RecentActivity = {
  id: string;
  type: string;
  title: string;
  userName: string;
  module: string;
  timestamp: Date;
  siteName: string;
  icon: any;
  color: string;
};

export default function ReportsDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const [selectedSite, setSelectedSite] = React.useState<string>("All Sites");
  const [timeRange, setTimeRange] = React.useState<number>(7); // -1 for Custom Range, 0 for Today
  const [customStartDate, setCustomStartDate] = React.useState<string>(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");

  // Sites query for filtering
  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSitesList } = useCollection<Site>(sitesQuery);

  // Fetch team members for managers to aggregate sites
  const teamQuery = useMemoFirebase(() => {
    if (!isManager || !user) return null;
    return query(collection(firestore, 'users'), where('siteManagerId', '==', user.uid));
  }, [firestore, user, isManager]);
  const { data: teamMembers } = useCollection<UserProfile>(teamQuery);

  const accessibleSites = React.useMemo(() => {
    if (!allSitesList || !userProfile) return [];
    if (isAdmin) return Array.from(new Map(allSitesList.map(s => [s.name, s])).values());
    
    // Aggregated site visibility for Managers
    const assignedIds = new Set<string>(userProfile.assignedProjectIds || []);
    if (isManager && teamMembers) {
      teamMembers.forEach(member => {
        (member.assignedProjectIds || []).forEach(id => assignedIds.add(id));
      });
    }

    return allSitesList.filter(s => assignedIds.has(s.id));
  }, [allSitesList, userProfile, isAdmin, isManager, teamMembers]);

  const filteredSiteList = accessibleSites.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase()));

  // 1. Permits
  const permitsQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'permits_to_work');
    if (isAdmin) return colRef;
    if (isManager) return query(colRef, or(where('siteManagerId', '==', user.uid), where('siteEngineerId', '==', user.uid)));
    return query(colRef, where('siteEngineerId', '==', user.uid));
  }, [firestore, user, isProfileLoading, isAdmin, isManager]);
  const { data: permits, isLoading: permitsLoading } = useCollection<DataItem>(permitsQuery);

  // 2. DPRs
  const dprsQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'dprs');
    if (isAdmin) return colRef;
    if (isManager) return query(colRef, or(where('siteManagerId', '==', user.uid), where('userId', '==', user.uid)));
    return query(colRef, where('userId', '==', user.uid));
  }, [firestore, user, isProfileLoading, isAdmin, isManager]);
  const { data: dprs, isLoading: dprsLoading } = useCollection<DataItem>(dprsQuery);

  // 3. Movements
  const movementsQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'material_movements');
    if (isAdmin) return colRef;
    if (isManager) return query(colRef, or(where('siteManagerId', '==', user.uid), where('userId', '==', user.uid)));
    return query(colRef, where('userId', '==', user.uid));
  }, [firestore, user, isProfileLoading, isAdmin, isManager]);
  const { data: movements, isLoading: movementsLoading } = useCollection<DataItem>(movementsQuery);

  // 4. Requirements
  const requirementsQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'requirements');
    if (isAdmin) return colRef;
    if (isManager) return query(colRef, or(where('siteManagerId', '==', user.uid), where('userId', '==', user.uid)));
    return query(colRef, where('userId', '==', user.uid));
  }, [firestore, user, isProfileLoading, isAdmin, isManager]);
  const { data: requirements, isLoading: requirementsLoading } = useCollection<DataItem>(requirementsQuery);

  // 5. Tasks
  const tasksQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'tasks');
    if (isAdmin) return colRef;
    return query(colRef, or(where('assignedToId', '==', user.uid), where('assignedById', '==', user.uid)));
  }, [firestore, user, isProfileLoading, isAdmin]);
  const { data: tasks, isLoading: tasksLoading } = useCollection<DataItem>(tasksQuery);

  // 6. Site Visits (Only for Activity Log)
  const visitsQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading || !isAdmin) return null;
    return query(collection(firestore, 'site_visits'), limit(100));
  }, [firestore, user, isProfileLoading, isAdmin]);
  const { data: visits, isLoading: visitsLoading } = useCollection<DataItem>(visitsQuery);

  // 7. Expenses (Only for Activity Log)
  const expensesQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading || !isAdmin) return null;
    return query(collection(firestore, 'expenses'), limit(100));
  }, [firestore, user, isProfileLoading, isAdmin]);
  const { data: expenses, isLoading: expensesLoading } = useCollection<DataItem>(expensesQuery);

  const isLoading = isProfileLoading || permitsLoading || dprsLoading || movementsLoading || requirementsLoading || tasksLoading || visitsLoading || expensesLoading;

  // Analytical Calculations
  const stats = React.useMemo(() => {
    if (isLoading) return null;

    let startDateRange: Date;
    let endDateRange = new Date();
    let effectiveDays: number;

    if (timeRange >= 0) {
      startDateRange = startOfDay(subDays(new Date(), timeRange));
      endDateRange = endOfDay(new Date());
      effectiveDays = timeRange + 1;
    } else {
      if (!customStartDate || !customEndDate) return null;
      startDateRange = startOfDay(new Date(customStartDate));
      endDateRange = endOfDay(new Date(customEndDate));
      
      effectiveDays = Math.max(1, Math.ceil((endDateRange.getTime() - startDateRange.getTime()) / (1000 * 60 * 60 * 24)));
      if (effectiveDays > 365) effectiveDays = 365; // Cap for visualization
    }

    const applyFilters = (list: DataItem[] | null, dateField: string) => {
      if (!list) return [];
      return list.filter(item => {
        // Site filter
        const siteMatch = selectedSite === "All Sites" || item.siteName === selectedSite;
        if (!siteMatch) return false;

        // Date filter
        let d: Date | null = null;
        const val = (item as any)[dateField];
        if (val?.toDate) d = val.toDate();
        else if (val) d = new Date(val);
        
        return d && d >= startDateRange && d <= endDateRange;
      });
    };

    const fPermits = applyFilters(permits, 'requestDate');
    const fDprs = applyFilters(dprs, 'reportDate');
    const fMovements = applyFilters(movements, 'movementDate');
    const fRequirements = applyFilters(requirements, 'createdAt');
    const fTasks = applyFilters(tasks, 'createdAt');

    const trendDays = Array.from({ length: effectiveDays }, (_, i) => {
      const date = subDays(endDateRange, i);
      return {
        label: format(date, effectiveDays > 7 ? 'dd/MM' : 'dd MMM'),
        date: date,
        permits: 0,
        dprs: 0,
        movements: 0,
        requirements: 0
      };
    }).reverse();

    const processItemDate = (item: DataItem, dateField: string) => {
      let d: Date | null = null;
      const val = (item as any)[dateField];
      if (val?.toDate) d = val.toDate();
      else if (val) d = new Date(val);
      
      if (d) {
        const dateStr = format(d!, 'yyyy-MM-dd');
        const index = trendDays.findIndex(day => format(day.date, 'yyyy-MM-dd') === dateStr);
        return index;
      }
      return -1;
    };

    fPermits.forEach(p => {
      const idx = processItemDate(p, 'requestDate');
      if (idx !== -1) trendDays[idx].permits++;
    });
    fDprs.forEach(d => {
      const idx = processItemDate(d, 'reportDate');
      if (idx !== -1) trendDays[idx].dprs++;
    });
    fMovements.forEach(m => {
      const idx = processItemDate(m, 'movementDate');
      if (idx !== -1) trendDays[idx].movements++;
    });
    fRequirements.forEach(r => {
      const idx = processItemDate(r, 'createdAt');
      if (idx !== -1) trendDays[idx].requirements++;
    });

    const permitStatus = [
      { name: 'Approved', value: fPermits.filter(p => p.status === 'Approved').length, color: '#22c55e' },
      { name: 'Pending', value: fPermits.filter(p => p.status === 'Pending' || p.status === 'ManagerApproved').length, color: '#eab308' },
      { name: 'Rejected', value: fPermits.filter(p => p.status === 'Rejected').length, color: '#ef4444' },
    ];

    const taskStatus = [
      { name: 'Completed', value: fTasks.filter(t => t.status === 'Completed').length, color: '#22c55e' },
      { name: 'Ongoing', value: fTasks.filter(t => t.status === 'In Progress' || t.status === 'To-do').length, color: '#3b82f6' },
      { name: 'Cancelled', value: fTasks.filter(t => t.status === 'Cancelled').length, color: '#94a3b8' },
    ];

    const requirementUrgency = [
      { name: 'High', value: fRequirements.filter(r => r.urgency === 'High').length, color: '#ef4444' },
      { name: 'Medium', value: fRequirements.filter(r => r.urgency === 'Medium').length, color: '#eab308' },
      { name: 'Low', value: fRequirements.filter(r => r.urgency === 'Low').length, color: '#3b82f6' },
    ];

    // Activity Aggregator (For Admins)
    const aggregatedActivities: RecentActivity[] = [];
    if (isAdmin) {
      const addItemToActivity = (item: DataItem, type: string, module: string, icon: any, color: string, dateField: string, titleField: string, userField: string) => {
        let d: Date | null = null;
        const val = (item as any)[dateField];
        if (val?.toDate) d = val.toDate();
        else if (val) d = new Date(val);

        if (d && (selectedSite === "All Sites" || item.siteName === selectedSite)) {
          aggregatedActivities.push({
            id: item.id,
            type,
            module,
            icon,
            color,
            title: (item as any)[titleField] || type,
            userName: (item as any)[userField] || 'Unknown User',
            timestamp: d,
            siteName: item.siteName
          });
        }
      };

      permits?.forEach(p => addItemToActivity(p, 'Permit', 'Compliance', ShieldCheck, 'text-blue-600', 'requestDate', 'serialNumber', 'siteEngineerName'));
      tasks?.forEach(t => addItemToActivity(t, 'Task', 'Operations', CheckSquare, 'text-slate-600', 'createdAt', 'title', 'assignedToName'));
      dprs?.forEach(d => addItemToActivity(d, 'DPR', 'Reporting', FileText, 'text-amber-600', 'createdAt', 'siteName', 'userName'));
      movements?.forEach(m => addItemToActivity(m, 'Movement', 'Inventory', ArrowLeftRight, 'text-emerald-600', 'createdAt', 'itemName', 'userName'));
      requirements?.forEach(r => addItemToActivity(r, 'Requirement', 'Procurement', ClipboardList, 'text-purple-600', 'createdAt', 'itemName', 'userName'));
      expenses?.forEach(e => addItemToActivity(e, 'Expense', 'Finance', Wallet, 'text-indigo-600', 'createdAt', 'title', 'userName'));
      visits?.forEach(v => addItemToActivity(v, 'Site Visit', 'Visits', Navigation, 'text-rose-600', 'startTime', 'siteName', 'managerName'));
    }

    const sortedActivities = aggregatedActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 50);

    return {
      dailyTrend: trendDays,
      permitDistribution: permitStatus,
      taskDistribution: taskStatus,
      requirementDistribution: requirementUrgency,
      recentActivities: sortedActivities,
      counts: {
        permits: fPermits.length,
        dprs: fDprs.length,
        movements: fMovements.length,
        requirements: fRequirements.length,
        tasks: fTasks.length,
      }
    };
  }, [isLoading, permits, dprs, movements, requirements, tasks, visits, expenses, selectedSite, timeRange, customStartDate, customEndDate, isAdmin]);

  if (isLoading) {
    return (
      <div className="space-y-8 p-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-sm" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-[400px] lg:col-span-2 rounded-sm" />
          <Skeleton className="h-[400px] rounded-sm" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1>Operational Reports</h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium">
            Operational summaries and performance data analytics.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Select value={timeRange.toString()} onValueChange={(val) => setTimeRange(parseInt(val))}>
              <SelectTrigger className="w-[140px] h-8 rounded-sm font-black uppercase text-[10px] tracking-widest bg-secondary border-none">
                <Calendar className="mr-1.5 h-3 w-3" />
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0" className="text-[10px] font-black uppercase">Today</SelectItem>
                <SelectItem value="7" className="text-[10px] font-black uppercase">Last 7 Days</SelectItem>
                <SelectItem value="30" className="text-[10px] font-black uppercase">Last 30 Days</SelectItem>
                <SelectItem value="90" className="text-[10px] font-black uppercase">Last 90 Days</SelectItem>
                <SelectItem value="-1" className="text-[10px] font-black uppercase">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {timeRange === -1 && (
              <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                <Input 
                  type="date" 
                  className="h-8 w-32 rounded-sm text-[10px] font-bold border-primary/20 bg-background" 
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
                <span className="text-[10px] font-black uppercase text-muted-foreground">to</span>
                <Input 
                  type="date" 
                  className="h-8 w-32 rounded-sm text-[10px] font-bold border-primary/20 bg-background" 
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
            )}
          </div>
          
          <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-sm font-bold border-primary/20 text-primary h-8 px-3">
                <Filter className="mr-1.5 h-3 w-3" />
                {selectedSite}
                <ChevronsUpDown className="ml-2 h-3 w-3 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0" align="end">
              <div className="flex items-center border-b px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <Input 
                  placeholder="Filter site..." 
                  className="h-9 w-full border-none focus-visible:ring-0 px-0 text-sm" 
                  value={siteSearchQuery}
                  onChange={(e) => setSiteSearchQuery(e.target.value)}
                />
              </div>
              <ScrollArea className="h-[200px]">
                <div className="p-1">
                  <Button
                    variant="ghost"
                    className="w-full justify-start font-bold text-xs rounded-sm h-8"
                    onClick={() => { setSelectedSite("All Sites"); setIsSitePopoverOpen(false); }}
                  >
                    <Check className={cn("mr-2 h-3 w-3", selectedSite === "All Sites" ? "opacity-100" : "opacity-0")} />
                    All Sites
                  </Button>
                  {filteredSiteList.map(site => (
                    <Button
                      key={site.id}
                      variant="ghost"
                      className="w-full justify-start font-medium text-xs rounded-sm h-8"
                      onClick={() => { setSelectedSite(site.name); setIsSitePopoverOpen(false); }}
                    >
                      <Check className={cn("mr-2 h-3 w-3", selectedSite === site.name ? "opacity-100" : "opacity-0")} />
                      <span className="truncate">{site.name}</span>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard 
          title="Permits" 
          value={stats.counts.permits} 
          icon={ShieldCheck} 
          description="Compliance logs"
          color="blue"
        />
        <SummaryCard 
          title="Reports" 
          value={stats.counts.dprs} 
          icon={FileText} 
          description="Activity updates"
          color="amber"
        />
        <SummaryCard 
          title="Material Logs" 
          value={stats.counts.movements} 
          icon={ArrowLeftRight} 
          description="Stock movements"
          color="emerald"
        />
        <SummaryCard 
          title="Requirements" 
          value={stats.counts.requirements} 
          icon={ClipboardList} 
          description="Site requests"
          color="purple"
        />
        <SummaryCard 
          title="Tasks" 
          value={stats.counts.tasks} 
          icon={CheckSquare} 
          description="Work items"
          color="slate"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 rounded-sm border-primary/10 shadow-md overflow-hidden">
          <CardHeader className="bg-muted/5 border-b py-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold uppercase tracking-widest">Document Activity Trend</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-8">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="label" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} 
                  />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{fill: 'rgba(0,0,0,0.02)'}}
                  />
                  <Legend iconType="circle" wrapperStyle={{paddingTop: '20px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase'}} />
                  <Bar dataKey="permits" name="Permits" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="dprs" name="Reports" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="movements" name="Movements" fill="#10b981" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-sm border-primary/10 shadow-md flex flex-col">
          <CardHeader className="bg-muted/5 border-b py-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold uppercase tracking-widest">Compliance Health</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1 pt-8 flex flex-col items-center justify-center">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.permitDistribution}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.permitDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend verticalAlign="bottom" wrapperStyle={{paddingTop: '20px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 text-center space-y-1">
              <p className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">PtW Approval Rate</p>
              <p className="text-2xl font-black text-primary">
                {stats.counts.permits > 0 
                  ? Math.round((stats.permitDistribution[0].value / stats.counts.permits) * 100) 
                  : 0}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="rounded-sm border-primary/10 shadow-md">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-primary" /> Task Progress Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-8 h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={stats.taskDistribution} margin={{ left: 40, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} 
                  />
                  <RechartsTooltip />
                  <Bar dataKey="value" name="Count" radius={[0, 2, 2, 0]}>
                    {stats.taskDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-sm border-primary/10 shadow-md">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" /> Requirement Urgency
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-8 h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.requirementDistribution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} 
                  />
                  <YAxis axisLine={false} tickLine={false} hide />
                  <RechartsTooltip />
                  <Bar dataKey="value" name="Volume" radius={[2, 2, 0, 0]}>
                    {stats.requirementDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activities Card - Admin Only */}
        {isAdmin && (
          <Card className="rounded-sm border-primary/10 shadow-md flex flex-col h-full overflow-hidden">
            <CardHeader className="bg-muted/5 border-b py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-bold uppercase tracking-widest">Recent Activities</CardTitle>
                </div>
                <Badge variant="outline" className="h-5 px-1.5 text-[8px] font-black uppercase">Live Log</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-[520px]">
                <div className="divide-y divide-border/50">
                  {stats.recentActivities.length > 0 ? stats.recentActivities.map((activity) => (
                    <div key={activity.id} className="p-4 hover:bg-muted/30 transition-colors space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className={cn("p-1.5 rounded-sm bg-muted shrink-0", activity.color)}>
                          <activity.icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground leading-tight line-clamp-1">{activity.title}</p>
                          <p className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-tight mt-0.5">{activity.module} • {activity.siteName}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[9px] font-mono font-bold text-muted-foreground">{format(activity.timestamp, 'HH:mm')}</p>
                          <p className="text-[8px] font-medium text-muted-foreground/40">{format(activity.timestamp, 'dd MMM')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <UserIcon className="h-2.5 w-2.5 text-primary/40" />
                        <span className="text-[10px] font-bold text-muted-foreground truncate">{activity.userName}</span>
                      </div>
                    </div>
                  )) : (
                    <div className="p-12 text-center text-muted-foreground italic text-[10px] uppercase font-bold opacity-30">
                      No matching activity logs
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
            <CardFooter className="bg-muted/5 border-t p-3">
              <Button variant="ghost" size="sm" className="w-full h-7 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary" asChild>
                <Link href="/ptw/activities">View Full Audit Trail <ArrowRight className="ml-1.5 h-3 w-3" /></Link>
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, description, color }: { 
  title: string, 
  value: number, 
  icon: any, 
  description: string,
  color: 'blue' | 'amber' | 'emerald' | 'purple' | 'slate'
}) {
  const colors = {
    blue: 'bg-blue-500/10 text-blue-600 border-blue-200',
    amber: 'bg-amber-500/10 text-amber-600 border-amber-200',
    emerald: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    purple: 'bg-purple-500/10 text-purple-600 border-purple-200',
    slate: 'bg-slate-500/10 text-slate-600 border-slate-200',
  };

  return (
    <Card className="rounded-sm border-primary/10 shadow-sm hover:shadow-md transition-all">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
        <div className={cn("p-1.5 rounded-sm border", colors[color])}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-black tracking-tight">{value}</div>
        <p className="text-[10px] text-muted-foreground mt-1 font-medium italic line-clamp-1">"{description}"</p>
      </CardContent>
    </Card>
  );
}
