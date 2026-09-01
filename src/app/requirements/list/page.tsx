"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, or, serverTimestamp, arrayUnion, limit, getDoc, and, getDocs } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays, subMonths, subYears } from "date-fns";
import { 
  ClipboardList, 
  Search, 
  Pencil, 
  Trash2, 
  Loader2, 
  Clock, 
  Calendar, 
  FilterX, 
  CircleCheck, 
  CircleX, 
  Building2, 
  MessageCircle,
  History,
  User,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ListFilter
} from "lucide-react";
import { isSuperAdmin } from "@/lib/auth-constants";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from "next/navigation";
import { sendNotification } from "@/lib/notifications";
import { slugifyRole } from "@/lib/access-control";

type TimelineEntry = {
  action: string;
  status: string;
  remarks: string;
  userName: string;
  userId: string;
  timestamp: any;
};

type Requirement = {
  id: string;
  siteId: string;
  siteName: string;
  itemName: string;
  quantity: number;
  unit: string;
  urgency: "High" | "Medium" | "Low";
  expectedDate: string;
  status: "Pending" | "ManagerApproved" | "Approved" | "Rejected" | "Ordered" | "Dispatched" | "In-transit" | "Delivered";
  statusUpdatedBy?: string;
  statusUpdatedAt?: any;
  userId: string;
  userName: string;
  siteManagerId: string | null;
  createdAt: any;
  editedBy?: string;
  editedAt?: any;
  timeline?: TimelineEntry[];
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

const LOGISTICS_STATUSES = ["Ordered", "Dispatched", "In-transit", "Delivered"] as const;

const formatTimestamp = (ts: any) => {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : (typeof ts === 'string' ? new Date(ts) : ts);
  return format(date, 'dd MMM, HH:mm');
};

function StatusBadge({ status, className }: { status: string, className?: string }) {
  const config: Record<string, { label: string, color: string }> = {
    Pending: { label: "Pending Manager", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    ManagerApproved: { label: "Pending Admin", color: "bg-blue-100 text-blue-800 border-blue-200" },
    Approved: { label: "Approved", color: "bg-green-100 text-green-800 border-green-200" },
    Rejected: { label: "Rejected", color: "bg-red-100 text-red-800 border-red-200" },
    Ordered: { label: "Ordered", color: "bg-purple-100 text-purple-800 border-purple-200" },
    Dispatched: { label: "Dispatched", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
    "In-transit": { label: "In Transit", color: "bg-amber-100 text-amber-800 border-amber-200" },
    Delivered: { label: "Delivered", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  };

  const item = config[status] || { label: status, color: "bg-slate-100 text-slate-800 border-slate-200" };

  return (
    <Badge variant="outline" className={cn("rounded-sm text-[10px] font-bold uppercase", item.color, className)}>
      {item.label}
    </Badge>
  );
}

export default function RequirementListPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [siteFilter, setSiteFilter] = React.useState("all");
  const [dateFilter, setDateFilter] = React.useState<string>("7days");
  
  const [editingReq, setEditingReq] = React.useState<Requirement | null>(null);
  const [deletingReq, setDeletingReq] = React.useState<Requirement | null>(null);
  const [historyReq, setHistoryReq] = React.useState<Requirement | null>(null);
  const [actionState, setActionState] = React.useState<{ req: Requirement, targetStatus: string } | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<AccessConfig>(roleConfigsQuery);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<{ name: string, id: string }>(sitesQuery);

  const overridesQuery = useMemoFirebase(() => collection(firestore, 'team_mapping_overrides'), [firestore]);
  const { data: allOverrides, isLoading: overridesLoading } = useCollection<MappingOverride>(overridesQuery);

  const isSuper = isSuperAdmin(user?.email);
  const isAdmin = isSuper || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';
  const isProcurement = userProfile?.department === 'Procurement and Supply-chain' || userProfile?.role === "Assistant Manager - Purchase & Supply Chain";

  const teamQuery = useMemoFirebase(() => {
    if (!isManager || !user) return null;
    return query(collection(firestore, 'users'), where('siteManagerId', '==', user.uid));
  }, [firestore, user, isManager]);
  const { data: teamMembers } = useCollection<UserProfile>(teamQuery);

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

  const requirementsQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    return query(collection(firestore, 'requirements'), limit(1000));
  }, [firestore, user, userProfile]);

  const { data: requirements, isLoading: reqsLoading } = useCollection<Requirement>(requirementsQuery);

  const queryDateRange = React.useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    
    switch (dateFilter) {
      case 'today': return { start: todayStr, end: todayStr };
      case 'yesterday': return { start: format(subDays(today, 1), 'yyyy-MM-dd'), end: format(subDays(today, 1), 'yyyy-MM-dd') };
      case '7days': return { start: format(subDays(today, 7), 'yyyy-MM-dd'), end: todayStr };
      case 'lastMonth': return { start: format(subMonths(today, 1), 'yyyy-MM-dd'), end: todayStr };
      case 'allTime': return { start: '1970-01-01', end: '2099-12-31' };
      default: return { start: format(subDays(today, 7), 'yyyy-MM-dd'), end: todayStr };
    }
  }, [dateFilter]);

  const sortedAndFilteredReqs = React.useMemo(() => {
    if (!requirements || !userProfile) return [];
    
    let result = requirements;

    if (!isAdmin && !isProcurement) {
      result = result.filter(req => accessibleSiteIds.has(req.siteId) || req.userId === user?.uid);
    }

    const { start, end } = queryDateRange;

    result = result.filter(req => {
      const rDate = req.createdAt?.toDate?.() || new Date(req.createdAt);
      const rDateStr = format(rDate, 'yyyy-MM-dd');
      const matchesSearch = req.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.itemName || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDate = rDateStr >= start && rDateStr <= end;
      const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
      const matchesSite = siteFilter === 'all' || req.siteName === siteFilter;
      
      return matchesSearch && matchesDate && matchesStatus && matchesSite;
    });

    return result.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
        const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
        return dateB - dateA;
    });
  }, [requirements, searchTerm, statusFilter, siteFilter, queryDateRange, userProfile, isAdmin, isProcurement, accessibleSiteIds, user]);

  const handleAction = async (remarks: string) => {
    if (!actionState || !user || !userProfile) return;
    const { req, targetStatus } = actionState;
    const reqRef = doc(firestore, 'requirements', req.id);

    const timelineEntry: TimelineEntry = {
      action: targetStatus === 'Rejected' ? "Rejected" : (targetStatus === 'ManagerApproved' ? "Manager Approval" : (targetStatus === 'Approved' ? "Admin Approval" : "Status Update")),
      status: targetStatus,
      remarks: remarks || "Status updated by authority.",
      userName: userProfile.username || user.email || 'System',
      userId: user.uid,
      timestamp: new Date().toISOString()
    };

    updateDocumentNonBlocking(reqRef, {
        status: targetStatus,
        statusUpdatedBy: userProfile.username || user.email || "Unknown",
        statusUpdatedAt: serverTimestamp(),
        timeline: arrayUnion(timelineEntry)
    });

    if (req.userId !== user.uid) {
        sendNotification(firestore, {
            userId: req.userId,
            title: `Requirement Update: ${targetStatus}`,
            description: `Your material request for "${req.itemName}" is now ${targetStatus.toLowerCase()}.`,
            link: "/requirements/list",
            push: true
        });
    }

    toast({ title: "Status Updated", description: `Requirement set to ${targetStatus}.` });
    setActionState(null);
  };

  const handleEditSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingReq || !user || !userProfile) return;
    setIsSaving(true);
    
    const formData = new FormData(e.currentTarget);
    const quantity = parseFloat(formData.get('quantity') as string);
    const urgency = formData.get('urgency') as any;
    const expectedDate = formData.get('expectedDate') as string;

    try {
      updateDocumentNonBlocking(doc(firestore, 'requirements', editingReq.id), {
        quantity,
        urgency,
        expectedDate,
        editedBy: userProfile.username || user.email || 'Unknown',
        editedAt: serverTimestamp(),
        timeline: arrayUnion({ action: "Modified", status: editingReq.status, remarks: `Details corrected by requester.`, userName: userProfile.username, userId: user.uid, timestamp: new Date().toISOString() })
      });
      toast({ title: "Updated", description: "Requirement details modified." });
      setEditingReq(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleWhatsAppShare = (req: Requirement) => {
    const message = `*Aditya Pro - Material Requirement*\n\n*Site:* ${req.siteName}\n*Item:* ${req.itemName}\n*Qty:* ${req.quantity} ${req.unit}\n*Urgency:* ${req.urgency}\n*Expected:* ${format(new Date(req.expectedDate), 'dd MMM yyyy')}\n*Status:* ${req.status}\n*Requested By:* ${req.userName}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleDelete = async () => {
    if (!deletingReq || !firestore) return;
    deleteDocumentNonBlocking(doc(firestore, 'requirements', deletingReq.id));
    toast({ title: "Request Removed" });
    setDeletingReq(null);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setSiteFilter("all");
    setDateFilter("7days");
  };

  if (isProfileLoading || reqsLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
          <ClipboardList className="h-6 w-6" /> Requirement Logs
        </h1>
        <p className="text-muted-foreground text-sm font-medium">Monitoring site material demands across all authorized locations.</p>
      </div>

      <div className="flex flex-col gap-4 bg-card p-3 md:p-4 border border-primary/10 rounded-sm shadow-sm no-print">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Search Personnel or Material</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-10 h-11 rounded-sm bg-background border-primary/10 text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Time Range</Label>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="h-11 rounded-sm border-primary/20 bg-background font-bold text-xs uppercase">
                <Calendar className="h-4 w-4 mr-2 opacity-50" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="allTime" className="text-xs font-bold uppercase">All Time</SelectItem>
                <SelectItem value="today" className="text-xs font-bold uppercase">Today</SelectItem>
                <SelectItem value="yesterday" className="text-xs font-bold uppercase">Yesterday</SelectItem>
                <SelectItem value="7days" className="text-xs font-bold uppercase">Last 7 Days</SelectItem>
                <SelectItem value="lastMonth" className="text-xs font-bold uppercase">Last Month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Filter by Site</Label>
              <Select value={siteFilter} onValueChange={setSiteFilter}>
                <SelectTrigger className="h-11 rounded-sm border-primary/20 bg-background font-bold text-xs uppercase">
                  <Building2 className="h-4 w-4 mr-2 opacity-50" />
                  <SelectValue placeholder="All Sites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs font-bold uppercase">All Accessible Sites</SelectItem>
                  {accessibleSites.map(s => <SelectItem key={s.id} value={s.name} className="text-xs font-bold uppercase">{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-sm text-muted-foreground" onClick={clearFilters} title="Clear Filters">
              <FilterX className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {['all', 'Pending', 'ManagerApproved', 'Approved', 'Rejected', 'Ordered', 'Delivered'].map(s => (
            <Badge key={s} onClick={() => setStatusFilter(s)} className={cn("cursor-pointer font-bold text-[10px] h-7 px-3 rounded-sm uppercase tracking-tighter transition-all", statusFilter === s ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
              {s === 'all' ? 'All Status' : s}
            </Badge>
          ))}
        </div>
      </div>

      <div className="md:hidden space-y-4">
        {sortedAndFilteredReqs.length > 0 ? sortedAndFilteredReqs.map((req) => {
          const isOwner = req.userId === user?.uid;
          const canManagerAct = isManager && req.siteManagerId === user?.uid && req.status === 'Pending';
          const canAdminAct = (isAdmin || isProcurement) && (req.status === 'ManagerApproved' || (req.status === 'Pending' && !req.siteManagerId));
          const canLogisticsAct = (isAdmin || isManager || isProcurement) && (["Approved", "Ordered", "Dispatched", "In-transit"].includes(req.status));

          return (
            <Card key={req.id} className="border-primary/10 rounded-sm shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" /> {formatTimestamp(req.createdAt)}
                    </span>
                    <h3 className="font-bold text-sm leading-tight text-foreground truncate">{req.itemName}</h3>
                  </div>
                  <Badge variant="outline" className={cn("rounded-sm text-[9px] font-black uppercase shrink-0 px-2 h-5", req.urgency === 'High' ? "bg-red-50 text-red-700 border-red-200" : "bg-blue-50 text-blue-700")}>{req.urgency}</Badge>
                </div>
                <div className="flex items-center justify-between"><div className="flex items-center gap-1.5 text-[10px] font-black text-muted-foreground uppercase tracking-tight truncate max-w-[150px]"><Building2 className="h-3.5 w-3.5 text-primary/60" /><span>{req.siteName}</span></div><StatusBadge status={req.status} /></div>
                <div className="flex items-center justify-between py-2 border-y border-primary/5"><div className="flex flex-col"><span className="text-[8px] font-black text-muted-foreground uppercase">Target Date</span><span className="text-xs font-bold">{req.expectedDate}</span></div><span className="text-sm font-black text-primary">{req.quantity} {req.unit}</span></div>
                <div className="flex items-center justify-between pt-2">
                  <div className="flex gap-1">{(canManagerAct || canAdminAct) && (<><Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 rounded-sm hover:bg-green-50" onClick={() => setActionState({ req, targetStatus: canManagerAct ? 'ManagerApproved' : 'Approved' })}><CircleCheck className="h-5 w-5" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 rounded-sm hover:bg-red-50" onClick={() => setActionState({ req, targetStatus: 'Rejected' })}><CircleX className="h-5 w-5" /></Button></>)}</div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 rounded-sm" onClick={() => handleWhatsAppShare(req)}><MessageCircle className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground rounded-sm" onClick={() => setHistoryReq(req)}><History className="h-4 w-4" /></Button>
                    {isOwner && req.status === 'Pending' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => setEditingReq(req)}><Pencil className="h-4 w-4" /></Button>
                    )}
                    {(isAdmin || (isOwner && req.status === 'Pending')) && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => setDeletingReq(req)}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        }) : <div className="text-center py-20 text-muted-foreground italic">No matching records found.</div>}
      </div>

      <div className="hidden md:block">
        <Card className="shadow-lg border-primary/10 rounded-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-6">Request Date</TableHead>
                    <TableHead>Log Info</TableHead>
                    <TableHead className="min-w-[200px]">Item Details</TableHead>
                    <TableHead>Urgency</TableHead>
                    <TableHead className="text-center">Quantity</TableHead>
                    <TableHead>Target Date</TableHead>
                    <TableHead className="min-w-[180px]">Lifecycle Status</TableHead>
                    <TableHead className="text-right px-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAndFilteredReqs.length > 0 ? sortedAndFilteredReqs.map((req) => {
                    const isOwner = req.userId === user?.uid;
                    const canManagerAct = isManager && req.siteManagerId === user?.uid && req.status === 'Pending';
                    const canAdminAct = (isAdmin || isProcurement) && (req.status === 'ManagerApproved' || (req.status === 'Pending' && !req.siteManagerId));
                    const canLogisticsAct = (isAdmin || isManager || isProcurement) && (["Approved", "Ordered", "Dispatched", "In-transit"].includes(req.status));

                    return (
                      <TableRow key={req.id} className="hover:bg-muted/5 transition-colors">
                        <TableCell className="px-6 font-mono text-[10px] font-bold text-muted-foreground whitespace-nowrap">{formatTimestamp(req.createdAt)}</TableCell>
                        <TableCell><div className="font-bold text-sm text-foreground">{req.siteName}</div><div className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter mt-0.5">{req.userName}</div></TableCell>
                        <TableCell><div className="text-sm font-semibold whitespace-pre-wrap max-w-xs">{req.itemName}</div></TableCell>
                        <TableCell><Badge variant="outline" className={cn("rounded-sm text-[9px] font-black uppercase h-5 px-1.5", req.urgency === 'High' ? "bg-red-50 text-red-700 border-red-200" : "bg-blue-50 text-blue-700")}>{req.urgency}</Badge></TableCell>
                        <TableCell className="text-center"><div className="font-mono font-black text-sm text-primary">{req.quantity}</div><div className="text-[10px] text-muted-foreground uppercase font-bold">{req.unit}</div></TableCell>
                        <TableCell className="text-xs font-bold text-muted-foreground">{req.expectedDate}</TableCell>
                        <TableCell><div className="flex flex-col gap-1.5"><StatusBadge status={req.status} />{canLogisticsAct && (<Select defaultValue={req.status} onValueChange={(val) => setActionState({ req, targetStatus: val })}><SelectTrigger className="w-[120px] h-7 text-[10px] font-bold rounded-sm border-primary/20"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Approved" className="text-[10px] font-bold">Approved</SelectItem>{LOGISTICS_STATUSES.map(opt => (<SelectItem key={opt} value={opt} className="text-[10px] font-medium">{opt}</SelectItem>))}</SelectContent></Select>)}</div></TableCell>
                        <TableCell className="text-right px-6">
                            <div className="flex justify-end items-center gap-1">
                                {(canManagerAct || canAdminAct) && (<><Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 rounded-sm hover:bg-green-50" onClick={() => setActionState({ req, targetStatus: canManagerAct ? 'ManagerApproved' : 'Approved' })} title="Approve"><CircleCheck className="h-5 w-5" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 rounded-sm hover:bg-red-50" onClick={() => setActionState({ req, targetStatus: 'Rejected' })} title="Reject"><CircleX className="h-5 w-5" /></Button></>)}
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 rounded-sm" onClick={() => handleWhatsAppShare(req)} title="WhatsApp"><MessageCircle className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-muted rounded-sm" onClick={() => setHistoryReq(req)} title="History"><History className="h-4 w-4" /></Button>
                                {isOwner && req.status === 'Pending' && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => setEditingReq(req)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                                )}
                                {(isAdmin || (isOwner && req.status === 'Pending')) && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => setDeletingReq(req)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                                )}
                            </div>
                        </TableCell>
                      </TableRow>
                    );
                  }) : <TableRow><TableCell colSpan={8} className="h-48 text-center text-muted-foreground italic">No requirements logged</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!actionState} onOpenChange={() => setActionState(null)}>
        <DialogContent className="rounded-sm max-md"><DialogHeader><DialogTitle className="uppercase tracking-tight font-black">Process Authorization</DialogTitle><DialogDescription>Setting final lifecycle status to: <strong>{actionState?.targetStatus}</strong>.</DialogDescription></DialogHeader><div className="py-6 space-y-3"><Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Feedback / Remarks</Label><Textarea id="action-remarks-input" placeholder="Enter remarks..." className="min-h-[120px] rounded-sm" /></div><DialogFooter className="gap-2"><DialogClose asChild><Button variant="outline" className="rounded-sm font-bold uppercase text-[10px]">Cancel</Button></DialogClose><Button className={cn("rounded-sm font-black uppercase text-[10px]", actionState?.targetStatus === 'Rejected' ? "bg-red-600" : "bg-green-600")} onClick={() => handleAction((document.getElementById('action-remarks-input') as HTMLTextAreaElement)?.value || "")}>Confirm Status</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={!!historyReq} onOpenChange={(o) => !o && setHistoryReq(null)}>
        <DialogContent className="rounded-sm max-lg p-0 overflow-hidden flex flex-col h-[70vh] shadow-2xl border-none"><DialogHeader className="p-6 bg-primary/5 border-b"><DialogTitle className="text-xl font-black uppercase tracking-tight">Lifecycle Audit</DialogTitle></DialogHeader><ScrollArea className="flex-1"><div className="p-8 space-y-8 relative border-l-2 border-muted ml-8 my-4">{historyReq?.timeline?.map((entry, idx) => (<div key={idx} className="relative"><div className="absolute -left-[39px] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-background" /><div className="flex flex-col gap-1.5 text-left"><span className="text-[11px] font-black text-primary uppercase tracking-tight">{entry.action} — {entry.userName}</span><p className="text-[9px] text-muted-foreground font-mono font-bold uppercase">{formatTimestamp(entry.timestamp)}</p><p className="text-xs font-medium italic text-foreground/80">"{entry.remarks}"</p><StatusBadge status={entry.status} className="w-fit mt-1 h-4 px-1.5" /></div></div>))}</div></ScrollArea><DialogFooter className="p-4 bg-muted/5 border-t"><DialogClose asChild><Button variant="outline" className="rounded-sm font-black uppercase text-[10px] h-10 px-8 w-full">Close Audit</Button></DialogClose></DialogFooter></DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingReq} onOpenChange={(o) => !o && setDeletingReq(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive font-black uppercase tracking-tight flex items-center gap-2"><Trash2 className="h-5 w-5" /> Remove Requirement?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium leading-relaxed">
              Are you sure you want to permanently delete the requirement for <strong>{deletingReq?.itemName}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm font-bold uppercase text-[10px] h-10">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90 rounded-sm font-black uppercase text-[10px] h-10 shadow-lg">Confirm Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
