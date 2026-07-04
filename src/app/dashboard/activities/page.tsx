'use client';

import * as React from 'react';
import { useUser, useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, doc, orderBy, limit, or, getDocs } from 'firebase/firestore';
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
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { 
  Bell,
  Search,
  Calendar,
  ShieldCheck,
  FileText,
  CheckSquare,
  ArrowLeftRight,
  ClipboardList,
  Wallet,
  Navigation,
  ShoppingBag,
  Gavel,
  IndianRupee,
  CreditCard,
  ClipboardCheck,
  MessageCircle,
  UserPlus,
  Fuel,
  CarFront,
  PlayCircle,
  Flag,
  FileUp,
  Tags,
  BookOpen,
  History,
  FilterX,
  Clock,
  User as UserIcon,
  MapPin,
  Eye,
  Maximize2,
  X,
  CheckCircle2,
  Users
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { isSuperAdmin } from '@/lib/auth-constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { slugifyRole } from '@/lib/access-control';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

type DataItem = {
  id: string;
  siteId?: string;
  siteName: string;
  title?: string;
  itemName?: string;
  tableNumber?: string;
  name?: string;
  fileName?: string;
  createdAt?: any;
  requestDate?: any;
  date?: any;
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
  ptwType?: string;
  movementType?: string;
  amount?: number;
  poNumber?: string;
  woNumber?: string;
  createdByName?: string;
  recordedByName?: string;
  referenceNumber?: string;
  amountInRs?: number;
  username?: string;
  pickupLocation?: string;
  dropLocation?: string;
  vehicleDetails?: string;
  driverId?: string;
  driverName?: string;
  uploadedByName?: string;
  createdBy?: string;
  comments?: any[];
  updatedAt?: any;
  startTime?: any;
  endTime?: any;
  approvalDate?: any;
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

type AccessConfig = {
  id: string;
  ownDataOnly?: boolean;
};

const EXCLUDED_PERSONNEL = ["Khalil Choudhary", "Imtiyaz Kazi", "Jayesh Bajaj", "Vipul Joisher", "Demo Admin", "Demo Manager", "Demo User"];

export default function ActivitiesPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [dateFilter, setDateFilter] = React.useState<string>("today");
  const [customStart, setCustomStart] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<AccessConfig>(roleConfigsQuery);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const userRoleStr = isAdmin ? 'admin' : (userProfile?.role ? slugifyRole(userProfile.role) : 'site-engineer');

  const queryLimit = 1000;

  const getFilteredQuery = (coll: string, dateField: string = 'createdAt') => {
    const colRef = collection(firestore, coll);
    if (isAdmin) return query(colRef, orderBy(dateField, 'desc'), limit(queryLimit));
    return query(colRef, where('userId', '==', user?.uid), limit(queryLimit));
  };

  const { data: permits } = useCollection<DataItem>(useMemoFirebase(() => {
    const colRef = collection(firestore, 'permits_to_work');
    if (isAdmin) return query(colRef, orderBy('requestDate', 'desc'), limit(queryLimit));
    return query(colRef, or(where('siteManagerId', '==', user?.uid), where('siteEngineerId', '==', user?.uid)), limit(queryLimit));
  }, [firestore, isAdmin, user]));

  const { data: dprs } = useCollection<DataItem>(useMemoFirebase(() => getFilteredQuery('dprs'), [firestore, isAdmin, user]));
  const { data: movements } = useCollection<DataItem>(useMemoFirebase(() => getFilteredQuery('material_movements'), [firestore, isAdmin, user]));
  const { data: requirements } = useCollection<DataItem>(useMemoFirebase(() => getFilteredQuery('requirements'), [firestore, isAdmin, user]));
  
  const { data: tasks } = useCollection<DataItem>(useMemoFirebase(() => {
    const colRef = collection(firestore, 'tasks');
    if (isAdmin) return query(colRef, orderBy('createdAt', 'desc'), limit(queryLimit));
    return query(colRef, or(where('assignedToId', '==', user?.uid), where('assignedById', '==', user?.uid)), limit(queryLimit));
  }, [firestore, isAdmin, user]));

  const { data: visits } = useCollection<DataItem>(useMemoFirebase(() => {
    const colRef = collection(firestore, 'site_visits');
    if (isAdmin) return query(colRef, orderBy('startTime', 'desc'), limit(queryLimit));
    return query(colRef, or(where('managerId', '==', user?.uid), where('siteManagerId', '==', user?.uid)), limit(queryLimit));
  }, [firestore, user, isAdmin]));

  const { data: installationChecklists } = useCollection<DataItem>(useMemoFirebase(() => getFilteredQuery('installation_checklists'), [firestore, isAdmin, user]));
  const { data: expenses } = useCollection<DataItem>(useMemoFirebase(() => getFilteredQuery('expenses'), [firestore, isAdmin, user]));
  const { data: pos } = useCollection<DataItem>(useMemoFirebase(() => getFilteredQuery('project_pos'), [firestore, isAdmin, user]));
  const { data: wos } = useCollection<DataItem>(useMemoFirebase(() => getFilteredQuery('project_wos'), [firestore, isAdmin, user]));
  const { data: payments } = useCollection<DataItem>(useMemoFirebase(() => getFilteredQuery('payments', 'date'), [firestore, isAdmin, user]));
  const { data: redemptions } = useCollection<DataItem>(useMemoFirebase(() => getFilteredQuery('redemption_requests'), [firestore, isAdmin, user]));
  
  const { data: vehicleReqs } = useCollection<DataItem>(useMemoFirebase(() => {
    const colRef = collection(firestore, 'vehicle_assignments');
    if (isAdmin) return query(colRef, orderBy('requestDate', 'desc'), limit(queryLimit));
    return query(colRef, or(where('userId', '==', user?.uid), where('driverId', '==', user?.uid)), limit(queryLimit));
  }, [firestore, isAdmin, user]));

  const { data: attendanceLogs } = useCollection<DataItem>(useMemoFirebase(() => {
    const colRef = collection(firestore, 'attendance');
    if (isAdmin) return query(colRef, limit(queryLimit));
    return query(colRef, where('userId', '==', user?.uid), limit(queryLimit));
  }, [firestore, isAdmin, user]));

  const { data: allPersonnel } = useCollection<UserProfile>(useMemoFirebase(() => collection(firestore, 'users'), [firestore]));

  const { data: siteDocs } = useCollection<DataItem>(useMemoFirebase(() => getFilteredQuery('site_documents'), [firestore, isAdmin, user]));
  const { data: siteGroups } = useCollection<DataItem>(useMemoFirebase(() => isAdmin ? collection(firestore, 'site_groups') : null, [firestore, isAdmin]));
  const { data: lmsCourses } = useCollection<DataItem>(useMemoFirebase(() => collection(firestore, 'lms_courses'), [firestore]));

  const queryDateRange = React.useMemo(() => {
    const today = new Date();
    switch (dateFilter) {
      case 'today': return { start: startOfDay(today), end: endOfDay(today) };
      case 'yesterday': return { start: startOfDay(subDays(today, 1)), end: endOfDay(subDays(today, 1)) };
      case 'this-week': return { start: startOfWeek(today), end: endOfWeek(today) };
      case 'last-week': return { start: startOfWeek(subDays(today, 7)), end: endOfWeek(subDays(today, 7)) };
      case 'this-month': return { start: startOfMonth(today), end: endOfMonth(today) };
      case 'last-month': return { start: startOfMonth(subMonths(today, 1)), end: endOfMonth(subMonths(today, 1)) };
      case 'custom': return { start: startOfDay(new Date(customStart)), end: endOfDay(new Date(customEnd)) };
      default: return { start: startOfDay(today), end: endOfDay(today) };
    }
  }, [dateFilter, customStart, customEnd]);

  const summaryStats = React.useMemo(() => {
    const { start, end } = queryDateRange;
    
    const countInRange = (list: DataItem[] | null, dateField: string, filter?: (i: DataItem) => boolean) => {
        if (!list) return 0;
        return list.filter(item => {
            let d: Date | null = null;
            const val = (item as any)[dateField];
            if (val?.toDate) d = val.toDate();
            else if (val) d = new Date(val);
            const matchesDate = d && d >= start && d <= end;
            const matchesFilter = filter ? filter(item) : true;
            return matchesDate && matchesFilter;
        }).length;
    };

    const ptwCount = countInRange(permits, 'requestDate');
    const dprCount = countInRange(dprs, 'createdAt');
    // Visits: Count of completed site visits
    const visitCount = countInRange(visits, 'startTime', (i) => i.status === 'completed');
    // Vehicle Dispatches: Count of ongoing plus completed trips
    const dispatchCount = countInRange(vehicleReqs, 'requestDate', (i) => i.status === 'Ongoing' || i.status === 'Completed');

    // Attendance Calculation: Count of Checked in employees
    const presentUserIds = new Set<string>();
    attendanceLogs?.forEach(log => {
        let d: Date | null = null;
        if (log.date) d = new Date(log.date);
        else if (log.createdAt?.toDate) d = log.createdAt.toDate();
        
        if (d && d >= start && d <= end && log.userId) {
            presentUserIds.add(log.userId);
        }
    });

    const activeStaff = allPersonnel?.filter(p => !EXCLUDED_PERSONNEL.includes(p.username)) || [];
    const presentCount = presentUserIds.size;
    // Absent: Count of Not checked in employees
    const absentCount = Math.max(0, activeStaff.length - presentCount);

    return {
        ptw: ptwCount,
        dpr: dprCount,
        visits: visitCount,
        dispatches: dispatchCount,
        present: presentCount,
        absent: absentCount
    };
  }, [permits, dprs, visits, vehicleReqs, attendanceLogs, allPersonnel, queryDateRange]);

  const activities = React.useMemo(() => {
    const agg: RecentActivity[] = [];
    const { start, end } = queryDateRange;

    const isOwnDataOnly = userProfile?.ownDataOnly !== undefined 
      ? userProfile.ownDataOnly 
      : roleConfigs?.find(c => c.id === userRoleStr)?.ownDataOnly ?? false;

    const assignedIds = new Set(userProfile?.assignedProjectIds || []);

    const addItem = (item: DataItem, type: string, module: string, icon: any, color: string, dateField: string, userField: string, sentence: string, link: string) => {
      let d: Date | null = null;
      const val = (item as any)[dateField];
      if (val?.toDate) d = val.toDate();
      else if (val) d = new Date(val);

      if (d && d >= start && d <= end) {
        if (isOwnDataOnly && !isAdmin) {
            const hasAccess = !item.siteName || assignedIds.has(item.siteId || '') || item.userId === user?.uid || (item as any)[userField] === userProfile?.username;
            if (!hasAccess) return;
        }

        const textMatch = sentence.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (item.siteName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.userName || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        if (textMatch) {
          agg.push({
            id: `${type}-${item.id}-${d.getTime()}`,
            type,
            module,
            icon,
            color,
            sentence,
            userName: (item as any)[userField] || 'User',
            timestamp: d,
            siteName: item.siteName || 'System',
            link
          });
        }
      }
    };

    permits?.forEach(p => addItem(p, 'Permit', 'Compliance', ShieldCheck, 'text-blue-600', 'requestDate', 'siteEngineerName', `${p.siteEngineerName} requested a ${p.ptwType} permit for ${p.siteName}`, `/ptw/list?view=${p.id}`));
    
    tasks?.forEach(t => {
      if (t.status === 'Completed') addItem(t, 'Task Finished', 'Operations', CheckCircle2, 'text-green-600', 'updatedAt', 'assignedToName', `${t.assignedToName} finished task: "${t.title}" for ${t.siteName}`, `/tasks/list`);
      else addItem(t, 'Task', 'Operations', CheckSquare, 'text-slate-600', 'createdAt', 'assignedByName', `${t.assignedByName} assigned task "${t.title}" to ${t.assignedToName} for ${t.siteName}`, `/tasks/list`);
    });

    dprs?.forEach(d => addItem(d, 'DPR', 'Reporting', FileText, 'text-amber-600', 'createdAt', 'userName', `${d.userName} submitted a DPR for ${d.siteName}`, `/dpr/list`));
    movements?.forEach(m => addItem(m, 'Movement', 'Inventory', ArrowLeftRight, 'text-emerald-600', 'createdAt', 'userName', `${m.userName} recorded a material ${m.movementType} for ${m.itemName} at ${m.siteName}`, `/movements/list`));
    requirements?.forEach(r => addItem(r, 'Requirement', 'Procurement', ClipboardList, 'text-purple-600', 'createdAt', 'userName', `${r.userName} raised a requirement for ${r.itemName} at ${r.siteName}`, `/requirements/list`));
    expenses?.forEach(e => addItem(e, 'Expense', 'Finance', Wallet, 'text-indigo-600', 'createdAt', 'userName', `${e.userName} submitted an expense claim: "${e.title}"`, `/expenses/list?view=${e.id}`));
    
    visits?.forEach(v => {
      if (v.status === 'completed') addItem(v, 'Site Visit End', 'Visits', Flag, 'text-rose-700', 'endTime', 'managerName', `${v.managerName} finished a site visit at ${v.siteName}`, `/site-visits/${v.id}`);
      else addItem(v, 'Site Visit Start', 'Visits', Navigation, 'text-rose-600', 'startTime', 'managerName', `${v.managerName} started a site visit at ${v.siteName}`, `/site-visits/${v.id}`);
    });

    pos?.forEach(p => addItem(p, 'Purchase Order', 'Procurement', ShoppingBag, 'text-blue-700', 'createdAt', 'createdByName', `${p.createdByName} generated a Purchase Order ${p.poNumber} for ${p.siteName}`, `/projects/${p.siteId}?tab=po`));
    wos?.forEach(w => addItem(w, 'Work Order', 'Procurement', Gavel, 'text-slate-700', 'createdAt', 'createdByName', `${w.createdByName} issued a Work Order ${w.woNumber} for ${w.siteName}`, `/projects/${w.siteId}?tab=wo`));
    payments?.forEach(p => addItem(p, 'Payment', 'Finance', IndianRupee, 'text-emerald-700', 'date', 'recordedByName', `${p.recordedByName} recorded a payment of ₹${p.amount?.toLocaleString()} against ${p.referenceNumber} for ${p.siteName}`, `/payments/project-wise`));
    redemptions?.forEach(r => addItem(r, 'Redemption', 'Rewards', CreditCard, 'text-green-600', 'createdAt', 'userName', `${r.userName} requested a points redemption of ₹${r.amountInRs?.toLocaleString()}`, `/settings/rewards`));
    
    installationChecklists?.forEach(cl => {
      addItem(cl, 'Checklist', 'Quality', ClipboardCheck, 'text-cyan-600', 'createdAt', 'userName', `${cl.userName} submitted an MMS audit for Table ${cl.tableNumber} at ${cl.siteName}`, `/checklists/data`);
      if (cl.comments && cl.comments.length > 0) {
        cl.comments.forEach((c: any, cIdx: number) => {
          let cd: Date | null = null;
          const cval = c.createdAt;
          if (cval?.toDate) cd = cval.toDate();
          else if (cval) cd = new Date(cval);
          if (cd && cd >= start && cd <= end) {
            const sentence = `${c.userName} commented on Table ${cl.tableNumber} audit for ${cl.siteName}`;
            if (sentence.toLowerCase().includes(searchTerm.toLowerCase())) {
              agg.push({
                id: `Comment-${cl.id}-${cIdx}-${cd.getTime()}`,
                type: 'Audit Comment',
                module: 'Quality',
                icon: MessageCircle,
                color: 'text-cyan-800',
                sentence,
                userName: c.userName,
                timestamp: cd,
                siteName: cl.siteName,
                link: `/checklists/data`
              });
            }
          }
        });
      }
    });

    vehicleReqs?.forEach(v => {
      if (v.status === 'Pending') addItem(v, 'Trip Request', 'Fleet', Fuel, 'text-orange-500', 'requestDate', 'userName', `${v.userName} requested a vehicle for trip to ${v.pickupLocation}`, `/vehicles/trips/manage`);
      else if (v.status === 'Approved') addItem(v, 'Trip Allotted', 'Fleet', CarFront, 'text-blue-500', 'approvalDate', 'userName', `Vehicle ${v.vehicleDetails} allotted to ${v.userName} with driver ${v.driverName}`, `/vehicles/trips/manage`);
      else if (v.status === 'Ongoing') addItem(v, 'Trip Start', 'Fleet', PlayCircle, 'text-blue-700', 'startTime', 'userName', `${v.userName} started a journey with ${v.vehicleDetails}`, `/vehicles/trips/manage`);
      else if (v.status === 'Completed') addItem(v, 'Trip End', 'Fleet', Flag, 'text-emerald-700', 'endTime', 'userName', `${v.userName} arrived at ${v.dropLocation}. Journey complete.`, `/vehicles/trips/manage`);
    });

    siteDocs?.forEach(doc => addItem(doc, 'Document', 'Files', FileUp, 'text-sky-600', 'createdAt', 'uploadedByName', `${doc.uploadedByName} uploaded "${doc.fileName}"`, `/documents/${doc.siteId}`));
    siteGroups?.forEach(g => addItem(g, 'Site Group', 'Registry', Tags, 'text-pink-600', 'createdAt', 'createdByName', `New site cluster defined: "${g.name}"`, `/projects/groups`));
    lmsCourses?.forEach(c => addItem(c, 'Course Published', 'LMS', BookOpen, 'text-indigo-700', 'createdAt', 'createdBy', `New training curriculum published: "${c.title}"`, `/lms/admin`));

    return agg.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [permits, tasks, dprs, movements, requirements, expenses, visits, pos, wos, payments, redemptions, installationChecklists, vehicleReqs, siteDocs, siteGroups, lmsCourses, queryDateRange, searchTerm, isAdmin, user, userProfile, roleConfigs, userRoleStr]);

  const clearFilters = () => {
    setSearchTerm("");
    setDateFilter("today");
  };

  if (isProfileLoading) return <div className="p-8"><Skeleton className="h-12 w-48" /></div>;

  const AnalyticsSummary = () => (
    <Card className="rounded-sm border-primary/10 shadow-sm overflow-hidden bg-background mb-4">
      <CardContent className="p-0">
        <div className="flex flex-wrap divide-x divide-border/40">
          <StatBox label="PtWs" value={summaryStats.ptw} icon={ShieldCheck} color="text-blue-600" />
          <StatBox label="DPRs" value={summaryStats.dpr} icon={FileText} color="text-amber-600" />
          <StatBox label="Visits" value={summaryStats.visits} icon={Navigation} color="text-rose-600" />
          <StatBox label="Dispatches" value={summaryStats.dispatches} icon={Fuel} color="text-orange-500" />
          <StatBox label="Present" value={summaryStats.present} icon={CheckCircle2} color="text-emerald-600" />
          <StatBox label="Absent" value={summaryStats.absent} icon={X} color="text-red-500" />
        </div>
      </CardContent>
    </Card>
  );

  const StatBox = ({ label, value, icon: Icon, color }: { label: string, value: number, icon: any, color: string }) => (
    <div className="flex-1 min-w-[120px] p-4 flex items-center justify-between group hover:bg-muted/10 transition-colors">
      <div className="flex flex-col gap-0.5">
        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-1">{label}</span>
        <span className="text-xl font-black tabular-nums leading-none">{value}</span>
      </div>
      <Icon className={cn("h-5 w-5 opacity-20 group-hover:opacity-100 transition-opacity", color)} />
    </div>
  );

  const ActivityTable = () => (
    <Table className="min-w-full">
      <TableHeader className="bg-muted/30 sticky top-0 z-20 shadow-sm">
        <TableRow className="h-10">
          <TableHead className="w-[100px] text-[10px] font-black uppercase text-center px-4">Time</TableHead>
          <TableHead className="text-[10px] font-black uppercase px-4">Activity detail</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <AnimatePresence initial={false}>
          {activities.length > 0 ? activities.map((activity) => (
            <TableRow key={activity.id} className="group hover:bg-primary/[0.02] transition-colors border-b border-border/40">
              <TableCell className="px-4 py-4 align-top w-[100px]">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[11px] font-mono font-black text-foreground">{format(activity.timestamp, 'HH:mm')}</span>
                  <span className="text-[8px] font-bold text-muted-foreground uppercase opacity-60">{format(activity.timestamp, 'dd MMM')}</span>
                </div>
              </TableCell>
              <TableCell className="px-4 py-4">
                <div className="flex items-start gap-4">
                  <div className={cn("p-2 rounded-sm bg-muted shrink-0 group-hover:bg-background transition-all shadow-sm border border-border/10", activity.color)}>
                    <activity.icon className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <motion.p 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-xs sm:text-sm font-bold text-foreground leading-snug"
                    >
                      {activity.sentence}
                    </motion.p>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-muted-foreground/80 uppercase tracking-[0.2em]">{activity.module}</span>
                      <span className="h-1 w-1 rounded-full bg-border" />
                      <div className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground/60 uppercase truncate">
                        <MapPin className="h-2.5 w-2.5 opacity-40" />
                        {activity.siteName}
                      </div>
                      <Link href={activity.link} className="text-[9px] font-black text-primary/60 hover:text-primary underline decoration-dashed underline-offset-4 uppercase ml-3 transition-colors">
                        View
                      </Link>
                    </div>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          )) : (
            <TableRow>
              <TableCell colSpan={2} className="h-64 text-center">
                <div className="flex flex-col items-center justify-center gap-2 opacity-20">
                  <History className="h-12 w-12" />
                  <p className="text-[11px] uppercase font-black tracking-[0.3em] text-muted-foreground">Zero Audit Records Found</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </AnimatePresence>
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary" /> Activities
        </h1>
        
        <div className="flex items-center gap-2">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="h-9 rounded-sm border-primary/20 bg-background font-bold text-[10px] uppercase w-[130px]">
              <Calendar className="h-3.5 w-3.5 mr-1.5 opacity-50" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today" className="text-[10px] font-bold uppercase">Today</SelectItem>
              <SelectItem value="yesterday" className="text-[10px] font-bold uppercase">Yesterday</SelectItem>
              <SelectItem value="this-week" className="text-[10px] font-bold uppercase">This Week</SelectItem>
              <SelectItem value="last-week" className="text-[10px] font-bold uppercase">Last Week</SelectItem>
              <SelectItem value="this-month" className="text-[10px] font-bold uppercase">This Month</SelectItem>
              <SelectItem value="last-month" className="text-[10px] font-bold uppercase">Last Month</SelectItem>
              <SelectItem value="custom" className="text-[10px] font-bold uppercase text-primary">Custom Range</SelectItem>
            </SelectContent>
          </Select>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-300">
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-9 w-32 rounded-sm border-primary/20 text-[10px]" />
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-9 w-32 rounded-sm border-primary/20 text-[10px]" />
            </div>
          )}

          <div className="relative hidden md:block w-48 lg:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Search" 
              className="pl-8 h-9 rounded-sm border-primary/20 bg-background text-[10px] font-bold"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(true)} className="h-9 w-9 rounded-sm border border-primary/10 text-primary hover:bg-primary hover:text-white transition-all shadow-sm" title="Maximize View">
            <Maximize2 className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="icon" onClick={clearFilters} className="h-9 w-9 text-muted-foreground rounded-sm border border-transparent hover:border-primary/10" title="Clear Filters">
            <FilterX className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AnalyticsSummary />

      <Card className="rounded-sm border-primary/10 shadow-sm overflow-hidden bg-background">
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-280px)] w-full">
            <ActivityTable />
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-none w-screen h-screen m-0 p-0 border-none rounded-none shadow-none bg-background flex flex-col">
          <DialogHeader className="p-4 border-b bg-muted/10 shrink-0 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-primary" />
              <DialogTitle className="text-lg font-black uppercase tracking-tight">Full-Screen Audit Audit</DialogTitle>
            </div>
            <div className="flex items-center gap-3">
               <Badge variant="outline" className="h-7 rounded-sm font-black uppercase text-[10px] bg-primary/5 text-primary border-primary/20 shadow-none">
                {activities.length} Participations Logged
               </Badge>
               <DialogClose asChild>
                 <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-destructive/10 hover:text-destructive">
                   <X className="h-5 w-5" />
                 </Button>
               </DialogClose>
            </div>
          </DialogHeader>
          <div className="p-4 border-b bg-muted/5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                 <Search className="h-5 w-5 text-muted-foreground" />
                 <Input 
                  placeholder="Search audit narrative..." 
                  className="max-w-md border-none focus-visible:ring-0 bg-transparent text-lg font-bold"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  autoFocus
                 />
              </div>
              <Badge variant="secondary" className="font-mono text-[10px] h-6 px-3">{dateFilter}</Badge>
            </div>
            <AnalyticsSummary />
          </div>
          <ScrollArea className="flex-1">
            <div className="max-w-5xl mx-auto py-10">
              <ActivityTable />
            </div>
          </ScrollArea>
          <div className="p-4 border-t bg-muted/5 text-center shrink-0">
             <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.4em] opacity-40">Aditya Pro Proprietary Audit Engine</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
