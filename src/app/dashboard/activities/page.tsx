'use client';

import * as React from 'react';
import { useUser, useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, doc, orderBy, limit, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Bell,
  Search,
  Filter,
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
  ChevronRight,
  Clock,
  User as UserIcon,
  Building2,
  Globe
} from 'lucide-react';
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay, isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { isSuperAdmin } from '@/lib/auth-constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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

export default function ActivitiesPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [dateFilter, setDateFilter] = React.useState<string>("today");
  const [customStart, setCustomStart] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = React.useState("");

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  // Base Data Fetching with strict filtering
  const queryLimit = 1000;

  const getFilteredQuery = (coll: string, dateField: string = 'createdAt') => {
    const colRef = collection(firestore, coll);
    if (isAdmin) return query(colRef, orderBy(dateField, 'desc'), limit(queryLimit));
    return query(colRef, where('userId', '==', user?.uid), limit(queryLimit));
  };

  // Specialized queries for different modules
  const { data: permits } = useCollection<DataItem>(useMemoFirebase(() => {
    const colRef = collection(firestore, 'permits_to_work');
    if (isAdmin) return query(colRef, orderBy('requestDate', 'desc'), limit(queryLimit));
    return query(colRef, where('siteEngineerId', '==', user?.uid), limit(queryLimit));
  }, [firestore, isAdmin, user]));

  const { data: dprs } = useCollection<DataItem>(useMemoFirebase(() => getFilteredQuery('dprs'), [firestore, isAdmin, user]));
  const { data: movements } = useCollection<DataItem>(useMemoFirebase(() => getFilteredQuery('material_movements'), [firestore, isAdmin, user]));
  const { data: requirements } = useCollection<DataItem>(useMemoFirebase(() => getFilteredQuery('requirements'), [firestore, isAdmin, user]));
  
  const { data: tasks } = useCollection<DataItem>(useMemoFirebase(() => {
    const colRef = collection(firestore, 'tasks');
    if (isAdmin) return query(colRef, orderBy('createdAt', 'desc'), limit(queryLimit));
    return query(colRef, where('assignedToId', '==', user?.uid), limit(queryLimit));
  }, [firestore, isAdmin, user]));

  const { data: visits } = useCollection<DataItem>(useMemoFirebase(() => {
    const colRef = collection(firestore, 'site_visits');
    if (isAdmin) return query(colRef, orderBy('startTime', 'desc'), limit(queryLimit));
    return query(colRef, where('managerId', '==', user?.uid), limit(queryLimit));
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

    const addItem = (item: DataItem, type: string, module: string, icon: any, color: string, dateField: string, userField: string, sentence: string, link: string) => {
      let d: Date | null = null;
      const val = (item as any)[dateField];
      if (val?.toDate) d = val.toDate();
      else if (val) d = new Date(val);

      if (d && d >= start && d <= end) {
        const textMatch = sentence.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (item.siteName || '').toLowerCase().includes(searchTerm.toLowerCase());
        
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
    tasks?.forEach(t => addItem(t, 'Task', 'Operations', CheckSquare, 'text-slate-600', 'createdAt', 'assignedToName', `${t.assignedByName} assigned task "${t.title}" to ${t.assignedToName}`, `/tasks/list`));
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
  }, [permits, tasks, dprs, movements, requirements, expenses, visits, pos, wos, payments, redemptions, installationChecklists, vehicleReqs, siteDocs, queryDateRange, searchTerm]);

  if (isProfileLoading) return <div className="p-8"><Skeleton className="h-12 w-48" /></div>;

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl md:text-3xl font-black uppercase tracking-tight text-foreground flex items-center gap-3">
          <Bell className="h-6 w-6 md:h-8 md:w-8 text-primary" /> System Activity Audit
        </h1>
        <p className="text-muted-foreground text-[10px] md:text-sm font-medium uppercase tracking-widest opacity-60">
          Chronological record of organizational interactions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
        <div className="md:col-span-2 space-y-1.5">
          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Keyword Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search user, site, or activity..." 
              className="pl-10 h-10 rounded-sm border-primary/20 bg-background text-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Time Window</Label>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="h-10 rounded-sm border-primary/20 bg-background font-bold text-xs uppercase">
              <Calendar className="h-4 w-4 mr-2 opacity-50" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today" className="text-xs font-bold uppercase">Today</SelectItem>
              <SelectItem value="yesterday" className="text-xs font-bold uppercase">Yesterday</SelectItem>
              <SelectItem value="this-week" className="text-xs font-bold uppercase">This Week</SelectItem>
              <SelectItem value="last-week" className="text-xs font-bold uppercase">Last Week</SelectItem>
              <SelectItem value="this-month" className="text-xs font-bold uppercase">This Month</SelectItem>
              <SelectItem value="last-month" className="text-xs font-bold uppercase">Last Month</SelectItem>
              <SelectItem value="custom" className="text-xs font-bold uppercase text-primary">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end gap-2">
          {dateFilter === 'custom' ? (
            <div className="flex-1 flex gap-2 animate-in fade-in zoom-in-95 duration-300">
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-10 rounded-sm border-primary/20 text-xs" />
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-10 rounded-sm border-primary/20 text-xs" />
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <Button variant="ghost" size="icon" onClick={() => { setSearchTerm(""); setDateFilter("today"); }} className="h-10 w-10 text-muted-foreground rounded-sm border border-transparent hover:border-primary/10">
            <FilterX className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="rounded-sm border-primary/10 shadow-xl overflow-hidden flex flex-col min-h-[600px]">
        <CardHeader className="bg-muted/5 border-b py-4 px-6 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-1.5 rounded-sm"><History className="h-4 w-4 text-primary" /></div>
            <CardTitle className="text-xs font-black uppercase tracking-widest">Live Activity Feed</CardTitle>
          </div>
          <Badge variant="secondary" className="rounded-full px-3 h-6 font-mono font-bold">
            {activities.length} Events Indexed
          </Badge>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden">
          <ScrollArea className="h-[calc(100vh-350px)]">
            <div className="divide-y divide-border/50">
              {activities.length > 0 ? activities.map((activity) => (
                <Link key={activity.id} href={activity.link} className="block group">
                  <div className="p-4 sm:p-6 hover:bg-primary/[0.02] transition-colors cursor-pointer relative">
                    <div className="flex items-start gap-4">
                      <div className={cn("p-2.5 rounded-sm bg-muted shrink-0 group-hover:bg-primary/10 transition-colors shadow-sm", activity.color)}>
                        <activity.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <span className="text-[9px] font-black uppercase tracking-widest text-primary/60">{activity.module}</span>
                          <span className="text-[10px] font-mono font-black text-muted-foreground uppercase opacity-40">
                            {format(activity.timestamp, 'HH:mm:ss')} • {format(activity.timestamp, 'dd MMM')}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                          {activity.sentence}
                        </p>
                        <div className="flex items-center gap-3 pt-1">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                            <UserIcon className="h-3 w-3 text-primary opacity-40" />
                            {activity.userName}
                          </div>
                          <Separator orientation="vertical" className="h-3" />
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase truncate">
                            <MapPin className="h-3 w-3 text-emerald-600 opacity-40" />
                            {activity.siteName}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary group-hover:translate-x-1 transition-all self-center" />
                    </div>
                  </div>
                </Link>
              )) : (
                <div className="p-40 text-center flex flex-col items-center gap-4">
                  <Bell className="h-16 w-16 text-muted-foreground/10" />
                  <div className="space-y-1">
                    <p className="text-sm font-black uppercase tracking-widest text-muted-foreground/40">Zero activities discovered</p>
                    <p className="text-[10px] text-muted-foreground/30 font-medium italic">Adjust filters or time window to expand search.</p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
