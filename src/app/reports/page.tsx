'use client';

import * as React from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, or, doc, orderBy, limit, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
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
  Legend,
  AreaChart,
  Area
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
  ArrowRight,
  Gavel,
  ShoppingBag,
  IndianRupee,
  CreditCard,
  UserPlus,
  CarFront,
  FileUp,
  Tags,
  BookOpen,
  LayoutGrid,
  Fuel,
  Activity,
  ClipboardCheck,
  MessageCircle,
  CheckCircle2,
  Flag,
  PlayCircle
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
import Link from 'next/link';

type DataItem = {
  id: string;
  siteName: string;
  title?: string;
  itemName?: string;
  tableNumber?: string;
  name?: string;
  fileName?: string;
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
  endTime?: any;
  amount?: number;
  poNumber?: string;
  woNumber?: string;
  supplierName?: string;
  contractorName?: string;
  referenceNumber?: string;
  paymentAgainst?: string;
  ptwType?: string;
  movementType?: string;
  points?: number;
  amountInRs?: number;
  username?: string;
  pickupLocation?: string;
  dropLocation?: string;
  vehicleDetails?: string;
  driverName?: string;
  uploadedByName?: string;
  createdBy?: string;
  comments?: any[];
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
  sentence: string;
  userName: string;
  module: string;
  timestamp: Date;
  siteName: string;
  link: string;
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
  const [timeRange, setTimeRange] = React.useState<number>(7);
  const [customStartDate, setCustomStartDate] = React.useState<string>(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSitesList } = useCollection<Site>(sitesQuery);

  const teamQuery = useMemoFirebase(() => {
    if (!isManager || !user) return null;
    return query(collection(firestore, 'users'), where('siteManagerId', '==', user.uid));
  }, [firestore, user, isManager]);
  const { data: teamMembers } = useCollection<UserProfile>(teamQuery);

  const accessibleSites = React.useMemo(() => {
    if (!allSitesList || !userProfile) return [];
    if (isAdmin) return Array.from(new Map(allSitesList.map(s => [s.name, s])).values());
    
    const assignedIds = new Set<string>(userProfile.assignedProjectIds || []);
    if (isManager && teamMembers) {
      teamMembers.forEach(member => {
        (member.assignedProjectIds || []).forEach(id => assignedIds.add(id));
      });
    }

    return allSitesList.filter(s => assignedIds.has(s.id));
  }, [allSitesList, userProfile, isAdmin, isManager, teamMembers]);

  const filteredSiteList = accessibleSites.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase()));

  // Data Collections - Now ordered by date to ensure the "Latest" 100 actions are correct
  const permitsQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'permits_to_work');
    if (isAdmin) return query(colRef, orderBy('requestDate', 'desc'), limit(500));
    return query(colRef, or(where('siteManagerId', '==', user.uid), where('siteEngineerId', '==', user.uid)), limit(500));
  }, [firestore, user, isProfileLoading, isAdmin, isManager]);
  const { data: permits, isLoading: permitsLoading } = useCollection<DataItem>(permitsQuery);

  const dprsQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'dprs');
    if (isAdmin) return query(colRef, orderBy('createdAt', 'desc'), limit(500));
    return query(colRef, or(where('siteManagerId', '==', user.uid), where('userId', '==', user.uid)), limit(500));
  }, [firestore, user, isProfileLoading, isAdmin, isManager]);
  const { data: dprs, isLoading: dprsLoading } = useCollection<DataItem>(dprsQuery);

  const movementsQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'material_movements');
    if (isAdmin) return query(colRef, orderBy('createdAt', 'desc'), limit(500));
    return query(colRef, or(where('siteManagerId', '==', user.uid), where('userId', '==', user.uid)), limit(500));
  }, [firestore, user, isProfileLoading, isAdmin, isManager]);
  const { data: movements, isLoading: movementsLoading } = useCollection<DataItem>(movementsQuery);

  const requirementsQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'requirements');
    if (isAdmin) return query(colRef, orderBy('createdAt', 'desc'), limit(500));
    return query(colRef, or(where('siteManagerId', '==', user.uid), where('userId', '==', user.uid)), limit(500));
  }, [firestore, user, isProfileLoading, isAdmin, isManager]);
  const { data: requirements, isLoading: requirementsLoading } = useCollection<DataItem>(requirementsQuery);

  const tasksQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'tasks');
    if (isAdmin) return query(colRef, orderBy('createdAt', 'desc'), limit(500));
    return query(colRef, or(where('assignedToId', '==', user.uid), where('assignedById', '==', user.uid)), limit(500));
  }, [firestore, user, isProfileLoading, isAdmin]);
  const { data: tasks, isLoading: tasksLoading } = useCollection<DataItem>(tasksQuery);

  const visitsQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading || !isAdmin) return null;
    return query(collection(firestore, 'site_visits'), orderBy('startTime', 'desc'), limit(500));
  }, [firestore, user, isProfileLoading, isAdmin]);
  const { data: visits, isLoading: visitsLoading } = useCollection<DataItem>(visitsQuery);

  const checkinstallationQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading || !isAdmin) return null;
    return query(collection(firestore, 'installation_checklists'), orderBy('createdAt', 'desc'), limit(500));
  }, [firestore, user, isProfileLoading, isAdmin]);
  const { data: installationChecklists, isLoading: instLoading } = useCollection<DataItem>(checkinstallationQuery);

  const expensesQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading || !isAdmin) return null;
    return query(collection(firestore, 'expenses'), orderBy('createdAt', 'desc'), limit(500));
  }, [firestore, user, isProfileLoading, isAdmin]);
  const { data: expenses, isLoading: expensesLoading } = useCollection<DataItem>(expensesQuery);

  const posQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading || !isAdmin) return null;
    return query(collection(firestore, 'project_pos'), orderBy('createdAt', 'desc'), limit(500));
  }, [firestore, user, isProfileLoading, isAdmin]);
  const { data: pos, isLoading: posLoading } = useCollection<DataItem>(posQuery);

  const wosQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading || !isAdmin) return null;
    return query(collection(firestore, 'project_wos'), orderBy('createdAt', 'desc'), limit(500));
  }, [firestore, user, isProfileLoading, isAdmin]);
  const { data: wos, isLoading: wosLoading } = useCollection<DataItem>(wosQuery);

  const paymentsQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading || !isAdmin) return null;
    return query(collection(firestore, 'payments'), orderBy('date', 'desc'), limit(500));
  }, [firestore, user, isProfileLoading, isAdmin]);
  const { data: payments, isLoading: paymentsLoading } = useCollection<DataItem>(paymentsQuery);

  const redemptionsQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading || !isAdmin) return null;
    return query(collection(firestore, 'redemption_requests'), orderBy('createdAt', 'desc'), limit(500));
  }, [firestore, user, isProfileLoading, isAdmin]);
  const { data: redemptions, isLoading: redemptionsLoading } = useCollection<DataItem>(redemptionsQuery);

  const usersListQuery = useMemoFirebase(() => isAdmin ? query(collection(firestore, 'users'), orderBy('createdAt', 'desc'), limit(500)) : null, [firestore, isAdmin]);
  const { data: usersList, isLoading: usersListLoading } = useCollection<DataItem>(usersListQuery);

  const vehiclesReqsQuery = useMemoFirebase(() => isAdmin ? query(collection(firestore, 'vehicle_assignments'), orderBy('requestDate', 'desc'), limit(500)) : null, [firestore, isAdmin]);
  const { data: vehicleReqs, isLoading: vehicleReqsLoading } = useCollection<DataItem>(vehiclesReqsQuery);

  const docsQuery = useMemoFirebase(() => isAdmin ? query(collection(firestore, 'site_documents'), orderBy('createdAt', 'desc'), limit(500)) : null, [firestore, isAdmin]);
  const { data: siteDocs, isLoading: docsLoading } = useCollection<DataItem>(docsQuery);

  const groupsQuery = useMemoFirebase(() => isAdmin ? query(collection(firestore, 'site_groups'), orderBy('createdAt', 'desc'), limit(500)) : null, [firestore, isAdmin]);
  const { data: siteGroups, isLoading: groupsLoading } = useCollection<DataItem>(groupsQuery);

  const lmsCoursesQuery = useMemoFirebase(() => isAdmin ? query(collection(firestore, 'lms_courses'), orderBy('createdAt', 'desc'), limit(500)) : null, [firestore, isAdmin]);
  const { data: lmsCourses, isLoading: lmsCoursesLoading } = useCollection<DataItem>(lmsCoursesQuery);

  const lmsModulesQuery = useMemoFirebase(() => isAdmin ? query(collection(firestore, 'lms_modules'), orderBy('createdAt', 'desc'), limit(500)) : null, [firestore, isAdmin]);
  const { data: lmsModules, isLoading: lmsModulesLoading } = useCollection<DataItem>(lmsModulesQuery);

  const isLoadingTotal = isProfileLoading || permitsLoading || dprsLoading || movementsLoading || requirementsLoading || tasksLoading || (isAdmin && (visitsLoading || instLoading || expensesLoading || posLoading || wosLoading || paymentsLoading || redemptionsLoading || usersListLoading || vehicleReqsLoading || docsLoading || groupsLoading || lmsCoursesLoading || lmsModulesLoading));

  const stats = React.useMemo(() => {
    if (isLoadingTotal) return null;

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
      if (effectiveDays > 365) effectiveDays = 365;
    }

    const applyFilters = (list: DataItem[] | null, dateField: string) => {
      if (!list) return [];
      return list.filter(item => {
        const siteMatch = selectedSite === "All Sites" || item.siteName === selectedSite;
        if (!siteMatch) return false;
        let d: Date | null = null;
        const val = (item as any)[dateField];
        if (val?.toDate) d = val.toDate();
        else if (val) d = new Date(val);
        return d && d >= startDateRange && d <= endDateRange;
      });
    };

    const fPermits = applyFilters(permits, 'requestDate');
    const fDprs = applyFilters(dprs, 'createdAt');
    const fMovements = applyFilters(movements, 'createdAt');
    const fRequirements = applyFilters(requirements, 'createdAt');
    const fTasks = applyFilters(tasks, 'createdAt');

    const trendDays = Array.from({ length: effectiveDays }, (_, i) => {
      const date = subDays(endDateRange, i);
      return {
        label: format(date, effectiveDays > 7 ? 'dd/MM' : 'dd MMM'),
        date: date,
        permits: 0,
        reports: 0,
        movements: 0
      };
    }).reverse();

    const processItemDate = (item: DataItem, dateField: string) => {
      let d: Date | null = null;
      const val = (item as any)[dateField];
      if (val?.toDate) d = val.toDate();
      else if (val) d = new Date(val);
      if (d) {
        const dateStr = format(d!, 'yyyy-MM-dd');
        return trendDays.findIndex(day => format(day.date, 'yyyy-MM-dd') === dateStr);
      }
      return -1;
    };

    fPermits.forEach(p => { const idx = processItemDate(p, 'requestDate'); if (idx !== -1) trendDays[idx].permits++; });
    fDprs.forEach(d => { const idx = processItemDate(d, 'createdAt'); if (idx !== -1) trendDays[idx].reports++; });
    fMovements.forEach(m => { const idx = processItemDate(m, 'createdAt'); if (idx !== -1) trendDays[idx].movements++; });

    const approvedPermitsCount = fPermits.filter(p => p.status === 'Approved').length;
    const pendingPermitsCount = fPermits.filter(p => p.status === 'Pending' || p.status === 'ManagerApproved').length;
    const rejectedPermitsCount = fPermits.filter(p => p.status === 'Rejected').length;
    const totalPermits = fPermits.length;
    const approvalRate = totalPermits > 0 ? Math.round((approvedPermitsCount / totalPermits) * 100) : 0;

    const permitDistribution = [
      { name: 'APPROVED', value: approvedPermitsCount, color: '#22c55e' },
      { name: 'PENDING', value: pendingPermitsCount, color: '#eab308' },
      { name: 'REJECTED', value: rejectedPermitsCount, color: '#ef4444' },
    ];

    const taskProgress = [
      { name: 'Completed', value: fTasks.filter(t => t.status === 'Completed').length, fill: '#22c55e' },
      { name: 'Ongoing', value: fTasks.filter(t => t.status === 'In Progress' || t.status === 'To-do').length, fill: '#3b82f6' },
      { name: 'Cancelled', value: fTasks.filter(t => t.status === 'Cancelled').length, fill: '#ef4444' },
    ].reverse();

    const reqUrgency = [
      { name: 'High', value: fRequirements.filter(r => r.urgency === 'High').length, fill: '#ef4444' },
      { name: 'Medium', value: fRequirements.filter(r => r.urgency === 'Medium').length, fill: '#f59e0b' },
      { name: 'Low', value: fRequirements.filter(r => r.urgency === 'Low').length, fill: '#3b82f6' },
    ];

    const aggregatedActivities: RecentActivity[] = [];
    if (isAdmin) {
      const addItemToActivity = (item: DataItem, type: string, module: string, icon: any, color: string, dateField: string, userField: string, sentence: string, link: string) => {
        let d: Date | null = null;
        const val = (item as any)[dateField];
        if (val?.toDate) d = val.toDate();
        else if (val) d = new Date(val);

        if (d && (selectedSite === "All Sites" || !item.siteName || item.siteName === selectedSite)) {
          aggregatedActivities.push({
            id: item.id,
            type,
            module,
            icon,
            color,
            sentence,
            userName: (item as any)[userField] || 'Unknown User',
            timestamp: d,
            siteName: item.siteName || 'System',
            link
          });
        }
      };

      permits?.forEach(p => addItemToActivity(p, 'Permit', 'Compliance', ShieldCheck, 'text-blue-600', 'requestDate', 'siteEngineerName', `${p.siteEngineerName} requested a ${p.ptwType} permit for ${p.siteName}`, `/ptw/list?view=${p.id}`));
      tasks?.forEach(t => {
        if (t.status === 'Completed') addItemToActivity(t, 'Task Finished', 'Operations', CheckCircle2, 'text-green-600', 'updatedAt', 'assignedToName', `${t.assignedToName} finished task: "${t.title}" for ${t.siteName}`, `/tasks/list`);
        else addItemToActivity(t, 'Task', 'Operations', CheckSquare, 'text-slate-600', 'createdAt', 'assignedByName', `${t.assignedByName} assigned task "${t.title}" to ${t.assignedToName} for ${t.siteName}`, `/tasks/list`);
      });
      dprs?.forEach(d => addItemToActivity(d, 'DPR', 'Reporting', FileText, 'text-amber-600', 'createdAt', 'userName', `${d.userName} submitted a DPR for ${d.siteName}`, `/dpr/list`));
      movements?.forEach(m => addItemToActivity(m, 'Movement', 'Inventory', ArrowLeftRight, 'text-emerald-600', 'createdAt', 'userName', `${m.userName} recorded a material ${m.movementType} for ${m.itemName} at ${m.siteName}`, `/movements/list`));
      requirements?.forEach(r => addItemToActivity(r, 'Requirement', 'Procurement', ClipboardList, 'text-purple-600', 'createdAt', 'userName', `${r.userName} raised a requirement for ${r.itemName} at ${r.siteName}`, `/requirements/list`));
      expenses?.forEach(e => addItemToActivity(e, 'Expense', 'Finance', Wallet, 'text-indigo-600', 'createdAt', 'userName', `${e.userName} submitted an expense claim: "${e.title}"`, `/expenses/list?view=${e.id}`));
      visits?.forEach(v => {
        if (v.status === 'completed') addItemToActivity(v, 'Site Visit End', 'Visits', Flag, 'text-rose-700', 'endTime', 'managerName', `${v.managerName} finished a site visit at ${v.siteName}`, `/site-visits/${v.id}`);
        else addItemToActivity(v, 'Site Visit Start', 'Visits', Navigation, 'text-rose-600', 'startTime', 'managerName', `${v.managerName} started a site visit at ${v.siteName}`, `/site-visits/${v.id}`);
      });
      pos?.forEach(p => addItemToActivity(p, 'Purchase Order', 'Procurement', ShoppingBag, 'text-blue-700', 'createdAt', 'createdByName', `${p.createdByName} generated a Purchase Order ${p.poNumber} for ${p.siteName}`, `/projects/${p.siteId}?tab=po`));
      wos?.forEach(w => addItemToActivity(w, 'Work Order', 'Procurement', Gavel, 'text-slate-700', 'createdAt', 'createdByName', `${w.createdByName} issued a Work Order ${w.woNumber} for ${w.siteName}`, `/projects/${w.siteId}?tab=wo`));
      payments?.forEach(p => addItemToActivity(p, 'Payment', 'Finance', IndianRupee, 'text-emerald-700', 'date', 'recordedByName', `${p.recordedByName} recorded a payment of ₹${p.amount?.toLocaleString()} against ${p.referenceNumber} for ${p.siteName}`, `/payments/project-wise`));
      redemptions?.forEach(r => addItemToActivity(r, 'Redemption', 'Rewards', CreditCard, 'text-green-600', 'createdAt', 'userName', `${r.userName} requested a points redemption of ₹${r.amountInRs?.toLocaleString()}`, `/settings/rewards`));
      installationChecklists?.forEach(cl => {
        addItemToActivity(cl, 'Checklist', 'Quality', ClipboardCheck, 'text-cyan-600', 'createdAt', 'userName', `${cl.userName} submitted an MMS audit for Table ${cl.tableNumber} at ${cl.siteName}`, `/checklists/data`);
        if (cl.comments && cl.comments.length > 0) {
           cl.comments.forEach(c => addItemToActivity({...c, siteName: cl.siteName}, 'Audit Comment', 'Quality', MessageCircle, 'text-cyan-800', 'createdAt', 'userName', `${c.userName} commented on Table ${cl.tableNumber} audit for ${cl.siteName}`, `/checklists/data`));
        }
      });
      
      usersList?.forEach(u => addItemToActivity(u, 'User', 'Registry', UserPlus, 'text-purple-600', 'createdAt', 'username', `New user added to registry: ${u.username}`, `/settings/users`));
      vehicleReqs?.forEach(v => {
        if (v.status === 'Pending') addItemToActivity(v, 'Trip Request', 'Fleet', Fuel, 'text-orange-500', 'requestDate', 'userName', `${v.userName} requested a vehicle for trip to ${v.pickupLocation}`, `/vehicles/trips/manage`);
        else if (v.status === 'Approved') addItemToActivity(v, 'Trip Allotted', 'Fleet', CarFront, 'text-blue-500', 'approvalDate', 'userName', `Vehicle ${v.vehicleDetails} allotted to ${v.userName} with driver ${v.driverName}`, `/vehicles/trips/manage`);
        else if (v.status === 'Ongoing') addItemToActivity(v, 'Trip Start', 'Fleet', PlayCircle, 'text-blue-700', 'startTime', 'userName', `${v.userName} started a journey with ${v.vehicleDetails}`, `/vehicles/trips/manage`);
        else if (v.status === 'Completed') addItemToActivity(v, 'Trip End', 'Fleet', Flag, 'text-emerald-700', 'endTime', 'userName', `${v.userName} arrived at ${v.dropLocation}. Journey complete.`, `/vehicles/trips/manage`);
      });
      siteDocs?.forEach(doc => addItemToActivity(doc, 'Document', 'Files', FileUp, 'text-sky-600', 'createdAt', 'uploadedByName', `${doc.uploadedByName} uploaded a document "${doc.fileName}" for ${doc.siteName}`, `/documents/${doc.siteId}`));
      siteGroups?.forEach(g => addItemToActivity(g, 'Group', 'Registry', Tags, 'text-pink-600', 'createdAt', 'createdByName', `New site group created: "${g.name}"`, `/projects/groups`));
      lmsCourses?.forEach(c => addItemToActivity(c, 'Course', 'LMS', BookOpen, 'text-indigo-700', 'createdAt', 'createdBy', `New training course published: "${c.title}"`, `/lms/admin`));
    }

    return {
      dailyTrend: trendDays,
      permitDistribution,
      approvalRate,
      taskProgress,
      requirementUrgency: reqUrgency,
      recentActivities: aggregatedActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 100),
      counts: {
        permits: fPermits.length,
        dprs: fDprs.length,
        movements: fMovements.length,
        requirements: fRequirements.length,
        tasks: fTasks.length,
      }
    };
  }, [isLoadingTotal, permits, dprs, movements, requirements, tasks, visits, installationChecklists, expenses, pos, wos, payments, redemptions, usersList, vehicleReqs, siteDocs, siteGroups, lmsCourses, lmsModules, selectedSite, timeRange, customStartDate, customEndDate, isAdmin]);

  if (isLoadingTotal) return <div className="space-y-8 p-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-4 w-96" /><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-sm" />)}</div></div>;

  if (!stats) return null;

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1>Operational Reports</h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium">Platform-wide analytical summaries and performance tracking.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={timeRange.toString()} onValueChange={(val) => setTimeRange(parseInt(val))}>
            <SelectTrigger className="w-[140px] h-8 rounded-sm font-black uppercase text-[10px] tracking-widest bg-secondary border-none">
              <Calendar className="mr-1.5 h-3 w-3" /><SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0" className="text-[10px] font-black uppercase">Today</SelectItem>
              <SelectItem value="7" className="text-[10px] font-black uppercase">Last 7 Days</SelectItem>
              <SelectItem value="30" className="text-[10px] font-black uppercase">Last 30 Days</SelectItem>
              <SelectItem value="-1" className="text-[10px] font-black uppercase">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-sm font-bold border-primary/20 text-primary h-8 px-3">
                <Filter className="mr-1.5 h-3 w-3" />{selectedSite}<ChevronsUpDown className="ml-2 h-3 w-3 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0" align="end">
              <div className="flex items-center border-b px-3"><Search className="mr-2 h-4 w-4 shrink-0 opacity-50" /><Input placeholder="Filter site..." className="h-9 w-full border-none focus-visible:ring-0 px-0 text-sm" value={siteSearchQuery} onChange={(e) => setSiteSearchQuery(e.target.value)} /></div>
              <ScrollArea className="h-[200px]"><div className="p-1"><Button variant="ghost" className="w-full justify-start font-bold text-xs h-8" onClick={() => { setSelectedSite("All Sites"); setIsSitePopoverOpen(false); }}><Check className={cn("mr-2 h-3 w-3", selectedSite === "All Sites" ? "opacity-100" : "opacity-0")} />All Sites</Button>{filteredSiteList.map(site => (<Button key={site.id} variant="ghost" className="w-full justify-start font-medium text-xs h-8" onClick={() => { setSelectedSite(site.name); setIsSitePopoverOpen(false); }}><Check className={cn("mr-2 h-3 w-3", selectedSite === site.name ? "opacity-100" : "opacity-0")} /><span className="truncate">{site.name}</span></Button>))}</div></ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard title="Permits" value={stats.counts.permits} icon={ShieldCheck} description="Compliance logs" color="blue" />
        <SummaryCard title="Reports" value={stats.counts.dprs} icon={FileText} description="Activity updates" color="amber" />
        <SummaryCard title="Material Logs" value={stats.counts.movements} icon={ArrowLeftRight} description="Stock movements" color="emerald" />
        <SummaryCard title="Requirements" value={stats.counts.requirements} icon={ClipboardList} description="Site requests" color="purple" />
        <SummaryCard title="Tasks" value={stats.counts.tasks} icon={CheckSquare} description="Work items" color="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 rounded-sm border-primary/10 shadow-md overflow-hidden">
          <CardHeader className="bg-muted/5 border-b py-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Document Activity Trend</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-8 px-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} />
                  <RechartsTooltip cursor={{fill: 'rgba(0,0,0,0.02)'}} />
                  <Legend iconType="circle" wrapperStyle={{paddingTop: '20px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase'}} />
                  <Bar dataKey="permits" name="PERMITS" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={10} />
                  <Bar dataKey="reports" name="REPORTS" fill="#f59e0b" radius={[2, 2, 0, 0]} barSize={10} />
                  <Bar dataKey="movements" name="MOVEMENTS" fill="#10b981" radius={[2, 2, 0, 0]} barSize={10} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-sm border-primary/10 shadow-md overflow-hidden flex flex-col h-full">
          <CardHeader className="bg-muted/5 border-b py-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Compliance Health</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center pt-8">
            <div className="h-[250px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.permitDistribution}
                    cx="50%"
                    cy="50%"
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
                  <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{fontSize: '9px', fontWeight: 900, paddingTop: '10px'}} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                <span className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter">PTW APPROVAL RATE</span>
                <span className="text-3xl font-black text-primary">{stats.approvalRate}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-sm border-primary/10 shadow-md overflow-hidden">
          <CardHeader className="bg-muted/5 border-b py-4">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-primary" />
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Task Progress Analysis</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-8 px-6">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.taskProgress} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} />
                  <RechartsTooltip cursor={{fill: 'rgba(0,0,0,0.02)'}} />
                  <Bar dataKey="value" radius={[0, 2, 2, 0]} barSize={25} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 rounded-sm border-primary/10 shadow-md overflow-hidden">
          <CardHeader className="bg-muted/5 border-b py-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Requirement Urgency</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-8 px-6">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.requirementUrgency}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} />
                  <YAxis hide />
                  <RechartsTooltip cursor={{fill: 'rgba(0,0,0,0.02)'}} />
                  <Bar dataKey="value" radius={[2, 2, 0, 0]} barSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 rounded-sm border-primary/10 shadow-md flex flex-col h-full overflow-hidden">
          <CardHeader className="bg-muted/5 border-b py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Recent Activities</CardTitle>
              </div>
              <Badge variant="outline" className="h-5 px-1.5 text-[8px] font-black uppercase">Latest 100 Actions</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-[600px]">
              <div className="divide-y divide-border/50">
                {stats.recentActivities.length > 0 ? stats.recentActivities.map((activity) => (
                  <Link key={activity.id} href={activity.link} className="block group">
                    <div className="p-3 hover:bg-primary/[0.03] transition-colors space-y-1 cursor-pointer">
                      <div className="flex items-start justify-between gap-3">
                        <div className={cn("p-1.5 rounded-sm bg-muted shrink-0 group-hover:bg-primary/10 transition-colors", activity.color)}>
                          <activity.icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-foreground leading-tight group-hover:text-primary transition-colors">{activity.sentence}</p>
                          <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-tight mt-0.5">{activity.module}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[8px] font-mono font-bold text-muted-foreground">{format(activity.timestamp, 'HH:mm')}</p>
                          <p className="text-[8px] font-medium text-muted-foreground/40">{format(activity.timestamp, 'dd MMM')}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                )) : (
                  <div className="p-12 text-center text-muted-foreground italic text-[10px] uppercase font-bold opacity-30">No activity logs found for this period.</div>
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
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, description, color }: { title: string, value: number, icon: any, description: string, color: 'blue' | 'amber' | 'emerald' | 'purple' | 'slate' }) {
  const colors = { blue: 'bg-blue-500/10 text-blue-600 border-blue-200', amber: 'bg-amber-500/10 text-amber-600 border-amber-200', emerald: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', purple: 'bg-purple-500/10 text-purple-600 border-purple-200', slate: 'bg-slate-500/10 text-slate-600 border-slate-200' };
  return (
    <Card className="rounded-sm border-primary/10 shadow-sm hover:shadow-md transition-all">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</CardTitle><div className={cn("p-1.5 rounded-sm border", colors[color])}><Icon className="h-3.5 w-3.5" /></div></CardHeader>
      <CardContent><div className="text-3xl font-black tracking-tight">{value}</div><p className="text-[10px] text-muted-foreground mt-1 font-medium italic line-clamp-1">"{description}"</p></CardContent>
    </Card>
  );
}
