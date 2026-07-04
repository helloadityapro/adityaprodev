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
  X,
  CheckCircle2
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
  }, [firestore, isAdmin, user]));

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

  const { data: siteDocs } = useCollection<DataItem>(useMemoFirebase(() => getFilteredQuery('site_documents'), [firestore, isAdmin, user]));
  const { data: usersList } = useCollection<DataItem>(useMemoFirebase(() => isAdmin ? collection(firestore, 'users') : null, [firestore, isAdmin]));
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
    payments?.forEach(p => addItem(p, 'Payment', 'Finance', IndianRupee, 'text-emerald-700', 'date', 'recordedByName', `${p.recordedByName} recorded a payment against ${p.referenceNumber} for ${p.siteName}`, `/payments/project-wise`));
    redemptions?.forEach(r => addItem(r, 'Redemption', 'Rewards', CreditCard, 'text-green-600', 'createdAt', 'userName', `${r.userName} requested points redemption`, `/rewards`));
    
    installationChecklists?.forEach(cl => {
      addItem(cl, 'Checklist', 'Quality', ClipboardCheck, 'text-cyan-600', 'createdAt', 'userName', `${cl.userName} submitted MMS audit for Table ${cl.tableNumber}`, `/checklists/data`);
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
      if (v.status === 'Pending') addItem(v, 'Trip Request', 'Fleet', Fuel, 'text-orange-500', 'requestDate', 'userName', `${v.userName} requested vehicle for trip to ${v.pickupLocation}`, `/vehicles/trips/manage`);
      else if (v.status === 'Approved') addItem(v, 'Trip Allotted', 'Fleet', CarFront, 'text-blue-500', 'approvalDate', 'userName', `Vehicle ${v.vehicleDetails} allotted to ${v.userName} with driver ${v.driverName}`, `/vehicles/trips/manage`);
      else if (v.status === 'Ongoing') addItem(v, 'Trip Start', 'Fleet', PlayCircle, 'text-blue-700', 'startTime', 'userName', `${v.userName} started a journey with ${v.vehicleDetails}`, `/vehicles/trips/manage`);
      else if (v.status === 'Completed') addItem(v, 'Trip End', 'Fleet', Flag, 'text-emerald-700', 'endTime', 'userName', `${v.userName} arrived at ${v.dropLocation}. Journey complete.`, `/vehicles/trips/manage`);
    });

    siteDocs?.forEach(doc => addItem(doc, 'Document', 'Files', FileUp, 'text-sky-600', 'createdAt', 'uploadedByName', `${doc.uploadedByName} uploaded "${doc.fileName}"`, `/documents/${doc.siteId}`));
    usersList?.forEach(u => addItem(u, 'User Registry', 'Systems', UserPlus, 'text-purple-600', 'createdAt', 'username', `New user added to registry: ${u.username}`, `/settings/users`));
    siteGroups?.forEach(g => addItem(g, 'Site Group', 'Registry', Tags, 'text-pink-600', 'createdAt', 'createdByName', `New site cluster defined: "${g.name}"`, `/projects/groups`));
    lmsCourses?.forEach(c => addItem(c, 'Course Published', 'LMS', BookOpen, 'text-indigo-700', 'createdAt', 'createdBy', `New training curriculum published: "${c.title}"`, `/lms/admin`));

    return agg.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [permits, tasks, dprs, movements, requirements, expenses, visits, pos, wos, payments, redemptions, installationChecklists, vehicleReqs, siteDocs, usersList, siteGroups, lmsCourses, queryDateRange, searchTerm, isAdmin, user, userProfile, roleConfigs, userRoleStr]);

  const clearFilters = () => {
    setSearchTerm("");
    setDateFilter("today");
  };

  if (isProfileLoading) return <div className="p-8"><Skeleton className="h-12 w-48" /></div>;

  const ActivityTable = () => (
    <Table className="min-w-full table-fixed">
      <TableHeader className="bg-muted/30 sticky top-0 z-20">
        <TableRow className="h-9">
          <TableHead className="w-[80px] text-[10px] font-black uppercase text-center px-2">Time</TableHead>
          <TableHead className="w-[120px] text-[10px] font-black uppercase px-2">Participation</TableHead>
          <TableHead className="text-[10px] font-black uppercase px-2">Audit Narrative</TableHead>
          <TableHead className="w-[180px] text-[10px] font-black uppercase px-2 text-right">Context</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <AnimatePresence initial={false}>
          {activities.length > 0 ? activities.map((activity) => (
            <TableRow key={activity.id} className="group hover:bg-primary/[0.03] transition-colors border-b border-border/50">
              <TableCell className="px-2 py-3">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-mono font-black text-foreground">{format(activity.timestamp, 'HH:mm')}</span>
                  <span className="text-[8px] font-bold text-muted-foreground uppercase">{format(activity.timestamp, 'dd MMM')}</span>
                </div>
              </TableCell>
              <TableCell className="px-2 py-3">
                <div className="flex items-center gap-2">
                  <div className={cn("p-1.5 rounded-sm bg-muted shrink-0 group-hover:bg-background transition-colors shadow-sm", activity.color)}>
                    <activity.icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-tight truncate">{activity.userName}</span>
                </div>
              </TableCell>
              <TableCell className="px-2 py-3">
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex flex-col gap-1"
                >
                  <p className="text-xs font-black text-foreground leading-none">
                    {activity.sentence}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-primary uppercase tracking-widest">{activity.module}</span>
                    <Link href={activity.link} className="text-[9px] font-bold text-primary/60 hover:text-primary underline decoration-dashed underline-offset-4 uppercase">
                      View Source
                    </Link>
                  </div>
                </motion.div>
              </TableCell>
              <TableCell className="px-2 py-3 text-right">
                <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold text-muted-foreground uppercase truncate">
                  <MapPin className="h-3 w-3 text-primary opacity-30" />
                  <span className="truncate max-w-[150px]">{activity.siteName}</span>
                </div>
              </TableCell>
            </TableRow>
          )) : (
            <TableRow>
              <TableCell colSpan={4} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[10px] opacity-20 tracking-widest">
                No participatory logs discovered for this window
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
          <Bell className="h-5 w-5 text-primary" /> Centralized Audit Log
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
              <SelectItem value="custom" className="text-[10px] font-bold uppercase text-primary">Custom</SelectItem>
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
              placeholder="Filter narrative..." 
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
               <Badge variant="outline" className="h-7 rounded-sm font-black uppercase text-[10px] bg-primary/5 text-primary border-primary/20">
                {activities.length} Events Participated
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
                placeholder="Search participations..." 
                className="max-w-md border-none focus-visible:ring-0 bg-transparent text-lg font-bold"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                autoFocus
               />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="max-w-5xl mx-auto py-6">
              <ActivityTable />
            </div>
          </ScrollArea>
          <div className="p-3 border-t bg-muted/5 text-center shrink-0">
             <p className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.4em]">Proprietary Audit Feed • Aditya Green Energy</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}