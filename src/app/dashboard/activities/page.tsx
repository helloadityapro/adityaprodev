'use client';

import * as React from 'react';
import { useUser, useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, doc, orderBy, limit } from 'firebase/firestore';
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
  Globe,
  MapPin,
  Eye
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from '@/lib/utils';
import { slugifyRole } from '@/lib/access-control';
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

type AccessConfig = {
  id: string;
  ownDataOnly?: boolean;
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

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<AccessConfig>(roleConfigsQuery);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const userRoleStr = isAdmin ? 'admin' : (userProfile?.role ? slugifyRole(userProfile.role) : 'site-engineer');

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
        // Strict sovereignty check
        if (isOwnDataOnly && !isAdmin) {
            const hasAccess = !item.siteId || assignedIds.has(item.siteId) || item.userId === user?.uid;
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
  }, [permits, tasks, dprs, movements, requirements, expenses, visits, pos, wos, payments, redemptions, installationChecklists, vehicleReqs, siteDocs, queryDateRange, searchTerm, isAdmin, user, userProfile, roleConfigs, userRoleStr]);

  const clearFilters = () => {
    setSearchTerm("");
    setDateFilter("today");
  };

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
              className="pl-10 h-10 rounded-sm border-primary/10 bg-background text-sm"
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
          <Button variant="ghost" size="icon" onClick={clearFilters} className="h-10 w-10 text-muted-foreground rounded-sm border border-transparent hover:border-primary/10">
            <FilterX className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="rounded-sm border-primary/10 shadow-xl overflow-hidden flex flex-col min-h-[600px]">
        <CardHeader className="bg-muted/5 border-b py-4 px-6 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-1.5 rounded-sm"><History className="h-4 w-4 text-primary" /></div>
            <CardTitle className="text-xs font-black uppercase tracking-widest">Live Activity Registry</CardTitle>
          </div>
          <Badge variant="secondary" className="rounded-full px-3 h-6 font-mono font-bold">
            {activities.length} Events Indexed
          </Badge>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden">
          <ScrollArea className="h-[calc(100vh-350px)]">
            <div className="min-w-full inline-block align-middle">
              <Table className="border-collapse">
                <TableHeader className="bg-muted/30 sticky top-0 z-10 shadow-sm">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[100px] text-[10px] font-black uppercase tracking-widest px-4 h-10">Time</TableHead>
                    <TableHead className="w-[120px] text-[10px] font-black uppercase tracking-widest h-10">Module</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest h-10">Event Description</TableHead>
                    <TableHead className="w-[160px] text-[10px] font-black uppercase tracking-widest h-10">Personnel</TableHead>
                    <TableHead className="w-[180px] text-[10px] font-black uppercase tracking-widest h-10">Site / Context</TableHead>
                    <TableHead className="w-12 h-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.length > 0 ? activities.map((activity) => (
                    <TableRow key={activity.id} className="hover:bg-primary/[0.02] transition-colors h-12">
                      <TableCell className="px-4 py-2">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-mono font-black text-foreground">{format(activity.timestamp, 'HH:mm')}</span>
                          <span className="text-[8px] font-bold text-muted-foreground uppercase">{format(activity.timestamp, 'dd MMM')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-2">
                        <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-sm border w-fit", activity.color.replace('text', 'bg').replace('600', '50').replace('700', '50'), activity.color.replace('text', 'border').replace('600', '200').replace('700', '200'))}>
                          <activity.icon className={cn("h-3 w-3", activity.color)} />
                          <span className={cn("text-[8px] font-black uppercase tracking-tighter", activity.color)}>{activity.module}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-2">
                        <p className="text-xs font-bold text-foreground leading-tight line-clamp-1">{activity.sentence}</p>
                      </TableCell>
                      <TableCell className="px-2 py-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase truncate">
                          <UserIcon className="h-3 w-3 text-primary opacity-40 shrink-0" />
                          <span className="truncate">{activity.userName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase truncate">
                          <MapPin className="h-3 w-3 text-emerald-600 opacity-40 shrink-0" />
                          <span className="truncate">{activity.siteName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-2 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-primary group-hover:bg-primary group-hover:text-white transition-colors" asChild>
                          <Link href={activity.link}><Eye className="h-3.5 w-3.5" /></Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-64 text-center">
                        <div className="flex flex-col items-center gap-2 opacity-30">
                          <Bell className="h-10 w-10" />
                          <p className="text-sm font-black uppercase tracking-widest">Zero activity logs</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, color, description }: { title: string, value: number, icon: any, color: string, description: string }) {
  return (
    <Card className="rounded-sm border-primary/10 shadow-sm hover:shadow-md transition-all">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 p-3 md:p-4">
        <CardTitle className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
        <div className={cn("p-1 rounded-sm border shrink-0", color)}>
          <Icon className="h-3 w-3 md:h-3.5 md:w-3.5" />
        </div>
      </CardHeader>
      <CardContent className="p-3 md:p-4 pt-0">
        <div className="text-xl md:text-2xl font-black tracking-tight">{value}</div>
        <p className="text-[8px] md:text-[9px] text-muted-foreground mt-1 font-bold uppercase tracking-tighter truncate opacity-60">{description}</p>
      </CardContent>
    </Card>
  );
}
