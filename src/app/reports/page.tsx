
'use client';

import * as React from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, or, doc, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Users, 
  ShieldCheck, 
  MapPin, 
  TrendingUp, 
  Calendar,
  Filter
} from 'lucide-react';
import { format, subDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { isSuperAdmin } from '@/lib/auth-constants';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type DataItem = {
  id: string;
  createdAt?: any;
  requestDate?: any;
  movementDate?: string;
  reportDate?: string;
  dueDate?: string;
  status?: string;
  userId?: string;
  siteEngineerId?: string;
  assignedToId?: string;
  assignedById?: string;
  siteManagerId?: string | null;
  priority?: string;
};

type UserProfile = {
  id: string;
  username: string;
  role: string;
  siteManagerId?: string;
};

export default function ReportsDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

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

  // 6. Users (for Managers to see their team names if needed, or Admin for overview)
  const usersQuery = useMemoFirebase(() => {
    if (!isAdmin && !isManager) return null;
    const colRef = collection(firestore, 'users');
    if (isAdmin) return colRef;
    return query(colRef, where('siteManagerId', '==', user?.uid));
  }, [firestore, isAdmin, isManager, user]);
  const { data: teamUsers } = useCollection<UserProfile>(usersQuery);

  const isLoading = isProfileLoading || permitsLoading || dprsLoading || movementsLoading || requirementsLoading || tasksLoading;

  // Analytical Calculations
  const stats = React.useMemo(() => {
    if (isLoading) return null;

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), i);
      return {
        label: format(date, 'dd MMM'),
        date: date,
        permits: 0,
        dprs: 0,
        movements: 0,
        requirements: 0
      };
    }).reverse();

    // Fill last 7 days data
    const processItemDate = (item: DataItem, dateField: string) => {
      let d: Date | null = null;
      const val = (item as any)[dateField];
      if (val?.toDate) d = val.toDate();
      else if (val) d = new Date(val);
      
      if (d) {
        const index = last7Days.findIndex(day => format(day.date, 'yyyy-MM-dd') === format(d!, 'yyyy-MM-dd'));
        return index;
      }
      return -1;
    };

    permits?.forEach(p => {
      const idx = processItemDate(p, 'requestDate');
      if (idx !== -1) last7Days[idx].permits++;
    });
    dprs?.forEach(d => {
      const idx = processItemDate(d, 'reportDate');
      if (idx !== -1) last7Days[idx].dprs++;
    });
    movements?.forEach(m => {
      const idx = processItemDate(m, 'movementDate');
      if (idx !== -1) last7Days[idx].movements++;
    });
    requirements?.forEach(r => {
      const idx = processItemDate(r, 'createdAt'); // Fallback if no specific date
      if (idx !== -1) last7Days[idx].requirements++;
    });

    // Status distributions
    const permitStatus = [
      { name: 'Approved', value: permits?.filter(p => p.status === 'Approved').length || 0, color: '#22c55e' },
      { name: 'Pending', value: permits?.filter(p => p.status === 'Pending' || p.status === 'ManagerApproved').length || 0, color: '#eab308' },
      { name: 'Rejected', value: permits?.filter(p => p.status === 'Rejected').length || 0, color: '#ef4444' },
    ];

    const taskStatus = [
      { name: 'Completed', value: tasks?.filter(t => t.status === 'Completed').length || 0, color: '#22c55e' },
      { name: 'Ongoing', value: tasks?.filter(t => t.status === 'In Progress' || t.status === 'To-do').length || 0, color: '#3b82f6' },
      { name: 'Cancelled', value: tasks?.filter(t => t.status === 'Cancelled').length || 0, color: '#94a3b8' },
    ];

    const requirementUrgency = [
      { name: 'High', value: requirements?.filter(r => (r as any).urgency === 'High').length || 0, color: '#ef4444' },
      { name: 'Medium', value: requirements?.filter(r => (r as any).urgency === 'Medium').length || 0, color: '#eab308' },
      { name: 'Low', value: requirements?.filter(r => (r as any).urgency === 'Low').length || 0, color: '#3b82f6' },
    ];

    return {
      dailyTrend: last7Days,
      permitDistribution: permitStatus,
      taskDistribution: taskStatus,
      requirementDistribution: requirementUrgency,
      counts: {
        permits: permits?.length || 0,
        dprs: dprs?.length || 0,
        movements: movements?.length || 0,
        requirements: requirements?.length || 0,
        tasks: tasks?.length || 0,
        teamSize: teamUsers?.length || 0
      }
    };
  }, [isLoading, permits, dprs, movements, requirements, tasks, teamUsers]);

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
            <h1 className="text-3xl font-black tracking-tight uppercase">Operational Reports</h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium">
            {isAdmin ? "Global overview of all site documentation and personnel activity." : 
             isManager ? `Reporting summary for you and your team of ${stats.counts.teamSize} engineers.` : 
             "Summary of your personal site submissions and task performance."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-sm font-black uppercase text-[10px] tracking-widest px-3 h-8">
            <Calendar className="mr-1.5 h-3 w-3" /> Last 7 Days
          </Badge>
          <Badge variant="outline" className="rounded-sm font-bold border-primary/20 text-primary px-3 h-8">
            <Filter className="mr-1.5 h-3 w-3" /> Filters Active
          </Badge>
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard 
          title="Permits to Work" 
          value={stats.counts.permits} 
          icon={ShieldCheck} 
          description="Safety compliance logs"
          color="blue"
        />
        <SummaryCard 
          title="Daily Reports" 
          value={stats.counts.dprs} 
          icon={FileText} 
          description="Site activity updates"
          color="amber"
        />
        <SummaryCard 
          title="Material Logs" 
          value={stats.counts.movements} 
          icon={ArrowLeftRight} 
          description="Inward/Outward movements"
          color="emerald"
        />
        <SummaryCard 
          title="Site Requirements" 
          value={stats.counts.requirements} 
          icon={ClipboardList} 
          description="Resource requests"
          color="purple"
        />
        <SummaryCard 
          title="Active Tasks" 
          value={stats.counts.tasks} 
          icon={CheckSquare} 
          description="Delegated work items"
          color="slate"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Daily Activity Chart */}
        <Card className="lg:col-span-2 rounded-sm border-primary/10 shadow-md overflow-hidden">
          <CardHeader className="bg-muted/5 border-b py-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold uppercase tracking-widest">Team Activity Volume</CardTitle>
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

        {/* Distribution Card */}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Task Priority Distribution */}
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

        {/* Requirements Status */}
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
