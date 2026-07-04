'use client';

import * as React from 'react';
import { useUser, useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, doc, orderBy, limit, or } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  Minimize2,
  CheckCircle2,
  X
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
import { cn } from '@/lib/utils';
import { slugifyRole } from '@/lib/access-control';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

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
  driverName?: string;
  uploadedByName?: string;
  createdBy?: string;
  comments?: any[];
  updatedAt?: any;
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

export default function ActivitiesPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  // Requirements: Keep default time window as Today
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
  }, [firestore, isAdmin, user]));

  const { data: installationChecklists } = useCollection<DataItem>(useMemoFirebase(() => getFilteredQuery('installation_checklists'), [firestore, isAdmin, user]));
  const { data: expenses } = useCollection<DataItem>(useMemoFirebase(() => getFilteredQuery('expenses'), [firestore, isAdmin, user]));
  const { data: pos } = useCollection<DataItem>(useMemoFirebase(() => getFilteredQuery('project_pos'), [firestore, isAdmin, user]));
  const { data: wos } = useCollection<DataItem>(useMemoFirebase(() => getFilteredQuery('project_wos'), [firestore, isAdmin, user]));
  const { data: payments } = useCollection<DataItem>(useMemoFirebase(() => getFilteredQuery('payments', 'date'), [firestore, isAdmin, user]));
  const { data: redemptions } = useCollection<DataItem>(useMemoFirebase(() => getFilteredQuery('redemption_requests'), [firestore, isAdmin, user]));
  const { data: vehicleReqs } = useCollection<DataItem>(useMemoFirebase(() => getFilteredQuery('vehicle_assignments', 'requestDate'), [firestore, isAdmin, user]));
  const { data: siteDocs } = useCollection<DataItem>(useMemoFirebase(() => getFilteredQuery('site_documents'), [firestore, isAdmin, user]));

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
            const hasAccess = !item.siteName || assignedIds.has(item.siteId || '') || item.userId === user?.uid;
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
    tasks?.forEach(t => addItem(t, 'Task', 'Operations', CheckSquare, 'text-slate-600', 'createdAt', 'assignedToName', `${t.assignedByName} assigned task "${t.title}" to ${t.assignedToName} for ${t.siteName}`, `/tasks/list`));
    dprs?.forEach(d => addItem(d, 'DPR', 'Reporting', FileText, 'text-amber-600', 'createdAt', 'userName', `${d.userName} submitted a DPR for ${d.siteName}`, `/dpr/list`));
    movements?.forEach(m => addItem(m, 'Movement', 'Inventory', ArrowLeftRight, 'text-emerald-600', 'createdAt', 'userName', `${m.userName} recorded a ${m.movementType} for ${m.itemName} at ${m.siteName}`, `/movements/list`));
    requirements?.forEach(r => addItem(r, 'Requirement', 'Procurement', ClipboardList, 'text-purple-600', 'createdAt', 'userName', `${r.userName} raised a requirement for ${r.itemName} at ${r.siteName}`, `/requirements/list`));
    expenses?.forEach(e => addItem(e, 'Expense', 'Finance', Wallet, 'text-indigo-600', 'createdAt', 'userName', `${e.userName} submitted an expense: "${e.title}"`, `/expenses/list?view=${e.id}`));
    visits?.forEach(v => addItem(v, 'Site Visit', 'Visits', Navigation, 'text-rose-600', 'startTime', 'managerName', `${v.managerName} started a visit at ${v.siteName}`, `/site-visits/${v.id}`));
    pos?.forEach(p => addItem(p, 'Purchase Order', 'Procurement', ShoppingBag, 'text-blue-700', 'createdAt', 'createdByName', `${p.createdByName} generated PO ${p.poNumber} for ${p.siteName}`, `/projects/${p.siteId}?tab=po`));
    wos?.forEach(w => addItem(w, 'Work Order', 'Procurement', Gavel, 'text-slate-700', 'createdAt', 'createdByName', `${w.createdByName} issued WO ${w.woNumber} for ${w.siteName}`, `/projects/${w.siteId}?tab=wo`));
    payments?.forEach(p => addItem(p, 'Payment', 'Finance', IndianRupee, 'text-emerald-700', 'date', 'recordedByName', `${p.recordedByName} recorded payment against ${p.referenceNumber}`, `/payments/project-wise`));
    redemptions?.forEach(r => addItem(r, 'Redemption', 'Rewards', CreditCard, 'text-green-600', 'createdAt', 'userName', `${r.userName} requested points redemption`, `/rewards`));
    installationChecklists?.forEach(cl => addItem(cl, 'Checklist', 'Quality', ClipboardCheck, 'text-cyan-600', 'createdAt', 'userName', `${cl.userName} submitted MMS audit for Table ${cl.tableNumber}`, `/checklists/data`));
    vehicleReqs?.forEach(v => addItem(v, 'Trip', 'Fleet', Fuel, 'text-orange-500', 'requestDate', 'userName', `${v.userName} requested vehicle for trip to ${v.dropLocation}`, `/vehicles/trips/manage`));
    siteDocs?.forEach(doc => addItem(doc, 'Document', 'Files', FileUp, 'text-sky-600', 'createdAt', 'uploadedByName', `${doc.uploadedByName} uploaded "${doc.fileName}"`, `/documents/${doc.siteId}`));

    return agg.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [permits, tasks, dprs, movements, requirements, expenses, visits, pos, wos, payments, redemptions, installationChecklists, vehicleReqs, siteDocs, queryDateRange, searchTerm, isAdmin, user, userProfile, roleConfigs, userRoleStr]);

  const clearFilters = () => {
    setSearchTerm("");
    setDateFilter("today");
  };

  if (isProfileLoading) return <div className="p-8"><Skeleton className="h-12 w-48" /></div>;

  const ActivityFeed = ({ isFull = false }: { isFull?: boolean }) => (
    <div className={cn("space-y-0 divide-y divide-border/50", isFull ? "p-0" : "")}>
      <AnimatePresence initial={false}>
        {activities.length > 0 ? activities.map((activity) => (
          <motion.div 
            key={activity.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="group"
          >
            <Link href={activity.link} className="flex gap-4 p-4 hover:bg-muted/30 transition-colors items-start">
              <div className="p-2 bg-muted rounded-md h-fit shrink-0 group-hover:bg-primary/5 transition-colors">
                <activity.icon className={cn("h-4 w-4", activity.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-foreground leading-snug">
                  {activity.sentence}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{activity.module}</span>
                  <span className="h-1 w-1 rounded-full bg-border" />
                  <span className="text-[10px] text-muted-foreground font-bold truncate">{activity.siteName}</span>
                </div>
              </div>
              <div className="text-right shrink-0 flex flex-col items-end">
                <span className="text-[10px] font-mono font-black text-foreground">{format(activity.timestamp, 'HH:mm')}</span>
                <span className="text-[8px] font-bold text-muted-foreground uppercase">{format(activity.timestamp, 'dd MMM')}</span>
              </div>
            </Link>
          </motion.div>
        )) : (
          <div className="py-32 flex flex-col items-center justify-center text-center gap-2 opacity-30">
            <Bell className="h-12 w-12" />
            <p className="text-sm font-black uppercase tracking-widest">No activity for this period</p>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary" /> Activities
        </h1>
        
        <div className="flex items-center gap-2">
          {/* Requirements: Time Range Presets */}
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

          <div className="relative hidden md:block w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Search feed..." 
              className="pl-8 h-9 rounded-sm border-primary/20 bg-background text-[10px] font-bold"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(true)} className="h-9 w-9 rounded-sm border border-primary/10 text-primary">
            <Maximize2 className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="icon" onClick={clearFilters} className="h-9 w-9 text-muted-foreground rounded-sm border border-transparent hover:border-primary/10">
            <FilterX className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="rounded-sm border-primary/10 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <ActivityFeed />
        </CardContent>
      </Card>

      {/* Requirement: Full Screen View Dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-none w-screen h-screen m-0 p-0 border-none rounded-none shadow-none bg-background flex flex-col">
          <DialogHeader className="p-4 border-b bg-muted/10 shrink-0 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-primary" />
              <DialogTitle className="text-lg font-black uppercase tracking-tight">Full-Screen Activity Audit</DialogTitle>
            </div>
            <div className="flex items-center gap-3">
               <Badge variant="outline" className="h-7 rounded-sm font-black uppercase text-[10px] bg-primary/5 text-primary border-primary/20">
                {activities.length} Events Indexed
               </Badge>
               <DialogClose asChild>
                 <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-destructive/10 hover:text-destructive">
                   <X className="h-5 w-5" />
                 </Button>
               </DialogClose>
            </div>
          </DialogHeader>
          <div className="p-4 border-b bg-muted/5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
               <Search className="h-4 w-4 text-muted-foreground" />
               <Input 
                placeholder="Search logs in real-time..." 
                className="max-w-md border-none focus-visible:ring-0 bg-transparent text-lg font-bold"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                autoFocus
               />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Filter By Range:</span>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="h-9 w-40 rounded-sm border-primary/20 font-bold text-xs uppercase">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="last-week">Last Week</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="max-w-5xl mx-auto py-10 px-6">
              <ActivityFeed isFull />
            </div>
          </ScrollArea>
          <div className="p-4 border-t bg-muted/5 text-center shrink-0">
             <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.4em]">End of Audit Feed</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, description, color }: { title: string, value: number, icon: any, description: string, color: string }) {
  const colors = { 
    blue: 'bg-blue-500/10 text-blue-600 border-blue-200', 
    amber: 'bg-amber-500/10 text-amber-600 border-amber-200', 
    emerald: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', 
    purple: 'bg-purple-500/10 text-purple-600 border-purple-200', 
    slate: 'bg-slate-500/10 text-slate-600 border-slate-200' 
  };
  return (
    <Card className="rounded-sm border-primary/10 shadow-sm hover:shadow-md transition-all">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 p-3 sm:p-4">
        <CardTitle className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
        <div className={cn("p-1 rounded-sm border shrink-0", (colors as any)[color])}>
          <Icon className="h-3 w-3 md:h-3.5 md:w-3.5" />
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0">
        <div className="text-xl md:text-2xl font-black tracking-tight">{value}</div>
        <p className="text-[8px] sm:text-[9px] text-muted-foreground mt-1 font-bold uppercase tracking-tighter truncate opacity-60">{description}</p>
      </CardContent>
    </Card>
  );
}
