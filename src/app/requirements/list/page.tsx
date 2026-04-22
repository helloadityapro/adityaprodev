
"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, updateDocumentNonBlocking, deleteDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, or, serverTimestamp, arrayUnion } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { 
  ClipboardList, 
  Search, 
  Pencil, 
  Trash2, 
  Loader2, 
  Clock, 
  Calendar, 
  FilterX, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  History, 
  User, 
  MoreHorizontal, 
  CircleCheck, 
  CircleX, 
  Building2, 
  Eye,
  MessageCircle,
  X
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { sendNotification } from "@/lib/notifications";

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

const LOGISTICS_STATUSES = ["Ordered", "Dispatched", "In-transit", "Delivered"] as const;

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
  const [searchTerm, setSearchTerm] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [editingReq, setEditingReq] = React.useState<Requirement | null>(null);
  const [deletingReq, setDeletingReq] = React.useState<Requirement | null>(null);
  const [historyReq, setHistoryReq] = React.useState<Requirement | null>(null);
  const [actionState, setActionState] = React.useState<{ req: Requirement, targetStatus: string } | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<AccessConfig>(roleConfigsQuery);

  const isSuper = isSuperAdmin(user?.email);
  const isAdmin = isSuper || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';
  const isProcurementRole = userProfile?.role === "Assistant Manager - Purchase & Supply Chain";
  const isProcurementDept = userProfile?.department === 'Procurement and Supply-chain';
  const isProcurement = isProcurementDept || isProcurementRole;

  const requirementsQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const colRef = collection(firestore, 'requirements');
    
    if (isAdmin || isProcurement) return colRef;
    if (isManager) {
        return query(colRef, or(where('userId', '==', user.uid), where('siteManagerId', '==', user.uid)));
    }
    return query(colRef, where('userId', '==', user.uid));
  }, [firestore, user, userProfile, isAdmin, isManager, isProcurement]);

  const { data: requirements, isLoading: reqsLoading } = useCollection<Requirement>(requirementsQuery);

  const sortedAndFilteredReqs = React.useMemo(() => {
    if (!requirements || !userProfile) return [];
    
    const roleId = userProfile.role ? userProfile.role.toLowerCase().replace(/\s+/g, '-') : 'none';
    const isOwnDataOnly = userProfile.ownDataOnly !== undefined 
      ? userProfile.ownDataOnly 
      : roleConfigs?.find(c => c.id === roleId)?.ownDataOnly ?? false;

    let result = requirements;

    if (isOwnDataOnly && !isSuper && !isProcurement) {
      const assignedIds = new Set(userProfile.assignedProjectIds || []);
      result = result.filter(req => assignedIds.has(req.siteId));
    }

    result = result.filter(req => {
      const matchesSearch = req.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.itemName || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesDate = true;
      if (startDate) matchesDate = matchesDate && req.expectedDate >= startDate;
      if (endDate) matchesDate = matchesDate && req.expectedDate <= endDate;
      
      return matchesSearch && matchesDate;
    });

    return result.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
        const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
        return dateB - dateA;
    });
  }, [requirements, searchTerm, startDate, endDate, userProfile, roleConfigs, isSuper, isProcurement]);

  const stats = React.useMemo(() => {
    return {
      total: sortedAndFilteredReqs.length,
      high: sortedAndFilteredReqs.filter(r => r.urgency === 'High').length,
      pending: sortedAndFilteredReqs.filter(r => r.status === 'Pending' || r.status === 'ManagerApproved').length,
      delivered: sortedAndFilteredReqs.filter(r => r.status === 'Delivered').length,
    };
  }, [sortedAndFilteredReqs]);

  const clearFilters = () => {
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
  };

  const handleDelete = () => {
    if (!deletingReq) return;
    deleteDocumentNonBlocking(doc(firestore, 'requirements', deletingReq.id));
    toast({ title: "Deleted", description: "Requirement removed." });
    setDeletingReq(null);
  };

  const handleAction = async (remarks: string) => {
    if (!actionState || !user || !userProfile) return;
    const { req, targetStatus } = actionState;
    const reqRef = doc(firestore, 'requirements', req.id);

    const timelineEntry: TimelineEntry = {
      action: targetStatus === 'Rejected' ? "Rejected" : (targetStatus === 'ManagerApproved' ? "Manager Approval" : (targetStatus === 'Approved' ? "Admin Approval" : "Status Update")),
      status: targetStatus,
      remarks: remarks || "Status changed.",
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
        addDocumentNonBlocking(collection(firestore, 'notifications'), {
            userId: req.userId,
            title: `Requirement Update: ${targetStatus}`,
            description: `Request for "${req.itemName}" is now ${targetStatus}. Remarks: ${remarks}`,
            link: "/requirements/list",
            read: false,
            createdAt: serverTimestamp(),
        });
    }

    toast({ title: "Updated", description: `Requirement is now ${targetStatus}.` });
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

    const timelineEntry: TimelineEntry = {
      action: "Modified",
      status: editingReq.status,
      remarks: `Details updated by requester.`,
      userName: userProfile.username || user.email || 'System',
      userId: user.uid,
      timestamp: new Date().toISOString()
    };

    try {
      updateDocumentNonBlocking(doc(firestore, 'requirements', editingReq.id), {
        quantity,
        urgency,
        expectedDate,
        editedBy: userProfile.username || user.email || 'Unknown',
        editedAt: serverTimestamp(),
        timeline: arrayUnion(timelineEntry)
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
    const message = `*Aditya Pro - Material Requirement*\n\n*Site:* ${req.siteName}\n*Item:* ${req.itemName}\n*Qty:* ${req.quantity} ${req.unit}\n*Urgency:* ${req.urgency}\n*Expected:* ${format(new Date(req.expectedDate), 'dd MMM yyyy')}\n*Status:* ${req.status}\n*Requested By:* ${req.userName}\n\n*Review Link:* ${window.location.origin}/requirements/list`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const urgencyConfig = {
    High: "bg-red-100 text-red-800 border-red-200",
    Medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    Low: "bg-blue-100 text-blue-800 border-blue-200",
  };

  if (isProfileLoading || reqsLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1 no-print">
        <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
          <ClipboardList className="h-8 w-8" /> Requirement Data
        </h1>
        <p className="text-muted-foreground font-medium">Monitor and track site material requests from authorized projects.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
        <Card className="bg-primary/5 border-primary/10 rounded-sm shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Active Requests</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/5 border-yellow-500/10 rounded-sm shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-yellow-600">Pending Action</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/10 rounded-sm shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-green-600">Fulfilled</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{stats.delivered}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-4 items-end bg-card p-3 md:p-4 border border-primary/10 rounded-sm shadow-sm no-print">
        <div className="md:col-span-2 space-y-1">
          <Label className="text-[9px] md:text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
            <Input 
              placeholder="Search..." 
              className="pl-8 h-9 md:h-10 rounded-sm border-primary/20 text-xs md:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 md:contents gap-2">
          <div className="space-y-1">
            <Label className="text-[9px] md:text-[10px] uppercase font-bold text-muted-foreground tracking-wider">From Date</Label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground pointer-events-none" />
              <Input 
                type="date" 
                className="pl-8 h-9 md:h-10 rounded-sm border-primary/20 text-[10px] md:text-sm" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
              />
            </div>
          </div>
          <div className="space-y-1 flex gap-1.5 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-[9px] md:text-[10px] uppercase font-bold text-muted-foreground tracking-wider">To Date</Label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground pointer-events-none" />
                <Input 
                  type="date" 
                  className="pl-8 h-9 md:h-10 rounded-sm border-primary/20 text-[10px] md:text-sm" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                />
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10 rounded-sm text-muted-foreground" onClick={clearFilters} title="Clear Filters">
              <FilterX className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="md:hidden space-y-4 pb-20">
        {sortedAndFilteredReqs.length > 0 ? sortedAndFilteredReqs.map((req) => {
          const isOwner = req.userId === user?.uid;
          const canManagerAct = isManager && req.siteManagerId === user?.uid && req.status === 'Pending';
          const canAdminAct = (isAdmin || isProcurement) && (req.status === 'ManagerApproved' || (req.status === 'Pending' && !req.siteManagerId));
          const canLogisticsAct = (isAdmin || isManager || isProcurement) && (["Approved", "Ordered", "Dispatched", "In-transit"].includes(req.status));

          return (
            <Card key={req.id} className="border-primary/10 rounded-sm shadow-sm overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">Expected {req.expectedDate ? format(new Date(req.expectedDate), 'dd MMM yy') : '—'}</span>
                    <h3 className="font-bold text-sm leading-tight text-foreground truncate">{req.itemName}</h3>
                  </div>
                  <Badge variant="outline" className={cn("rounded-sm text-[9px] font-bold uppercase", (urgencyConfig as any)[req.urgency] || urgencyConfig.Medium)}>
                    {req.urgency}
                  </Badge>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                    <Building2 className="h-3 w-3 text-primary/60" />
                    <span>{req.siteName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary">{req.quantity} {req.unit}</span>
                    <StatusBadge status={req.status} />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase py-1">
                  <User className="h-3 w-3 text-primary" />
                  <span>{req.userName}</span>
                </div>

                {canLogisticsAct && (
                  <div className="pt-2">
                    <Select defaultValue={req.status} onValueChange={(val) => setActionState({ req, targetStatus: val })}>
                      <SelectTrigger className="w-full h-10 text-xs font-bold rounded-sm border-primary/20"><SelectValue /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="Approved">Approved</SelectItem>
                          {LOGISTICS_STATUSES.map(opt => (<SelectItem key={opt} value={opt} className="text-xs font-medium">{opt}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="pt-2 border-t border-primary/5 grid grid-cols-2 gap-2">
                  {(canManagerAct || canAdminAct) && (
                    <>
                      <Button size="sm" className="h-10 rounded-sm bg-green-600 hover:bg-green-700 font-bold text-[10px] uppercase" onClick={() => setActionState({ req, targetStatus: canManagerAct ? 'ManagerApproved' : 'Approved' })}>
                        <CircleCheck className="h-4 w-4 mr-1.5" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" className="h-10 rounded-sm font-bold text-[10px] uppercase" onClick={() => setActionState({ req, targetStatus: 'Rejected' })}>
                        <CircleX className="h-4 w-4 mr-1.5" /> Reject
                      </Button>
                    </>
                  )}
                  <div className={cn("col-span-2 flex justify-end gap-2", (canManagerAct || canAdminAct) && "mt-2")}>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-green-600" onClick={() => handleWhatsAppShare(req)} title="Share on WhatsApp">
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={() => setHistoryReq(req)} title="View Timeline">
                      <History className="h-4 w-4" />
                    </Button>
                    {isOwner && req.status === 'Pending' && (
                      <>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-primary" onClick={() => setEditingReq(req)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => setDeletingReq(req)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )) : <div className="text-center py-12 text-muted-foreground italic bg-muted/5 rounded-sm border-2 border-dashed">No requirements found.</div>}
      </div>

      <div className="hidden md:block">
        <Card className="shadow-md border-primary/10 rounded-sm overflow-hidden" id="printable-report-area">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-32">Site & User</TableHead>
                  <TableHead className="min-w-[200px]">Item Details</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Qty & Unit</TableHead>
                  <TableHead>Expected By</TableHead>
                  <TableHead className="min-w-[180px]">Status</TableHead>
                  <TableHead className="text-right px-6 no-print">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAndFilteredReqs.map((req) => {
                  const isOwner = req.userId === user?.uid;
                  const canManagerAct = isManager && req.siteManagerId === user?.uid && req.status === 'Pending';
                  const canAdminAct = (isAdmin || isProcurement) && (req.status === 'ManagerApproved' || (req.status === 'Pending' && !req.siteManagerId));
                  const canLogisticsAct = (isAdmin || isManager || isProcurement) && (["Approved", "Ordered", "Dispatched", "In-transit"].includes(req.status));

                  return (
                    <TableRow key={req.id} className="hover:bg-muted/5 transition-colors">
                      <TableCell>
                          <div className="font-bold text-sm">{req.siteName}</div>
                          <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">{req.userName}</div>
                      </TableCell>
                      <TableCell>
                          <div className="text-sm font-semibold whitespace-pre-wrap max-w-xs">{req.itemName}</div>
                      </TableCell>
                      <TableCell>
                          <Badge variant="outline" className={cn("rounded-sm text-[10px] font-bold uppercase", (urgencyConfig as any)[req.urgency] || urgencyConfig.Medium)}>
                              {req.urgency}
                          </Badge>
                      </TableCell>
                      <TableCell>
                          <div className="font-mono font-bold text-sm text-primary">{req.quantity}</div>
                          <div className="text-[10px] text-muted-foreground uppercase font-medium">{req.unit}</div>
                      </TableCell>
                      <TableCell>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {req.expectedDate ? format(new Date(req.expectedDate), 'dd MMM yy') : '—'}
                          </div>
                      </TableCell>
                      <TableCell>
                          <div className="flex flex-col gap-1.5">
                            <StatusBadge status={req.status} />
                            {canLogisticsAct && (
                              <div className="no-print">
                                <Select defaultValue={req.status} onValueChange={(val) => setActionState({ req, targetStatus: val })}>
                                    <SelectTrigger className="w-[120px] h-7 text-[10px] font-bold rounded-sm border-primary/20"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Approved">Approved</SelectItem>
                                        {LOGISTICS_STATUSES.map(opt => (<SelectItem key={opt} value={opt} className="text-[10px] font-medium">{opt}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                      </TableCell>
                      <TableCell className="text-right px-6 no-print">
                          <div className="flex justify-end items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => handleWhatsAppShare(req)} title="Share on WhatsApp">
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setHistoryReq(req)} title="View Timeline"><History className="h-4 w-4" /></Button>
                              {(canManagerAct || canAdminAct) && (
                                <>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-50" onClick={() => setActionState({ req, targetStatus: canManagerAct ? 'ManagerApproved' : 'Approved' })} title="Approve"><CircleCheck className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => setActionState({ req, targetStatus: 'Rejected' })} title="Reject"><CircleX className="h-4 w-4" /></Button>
                                </>
                              )}
                              {isOwner && req.status === 'Pending' && (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setEditingReq(req)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingReq(req)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                                  </>
                              )}
                          </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!actionState} onOpenChange={() => setActionState(null)}>
        <DialogContent className="rounded-sm">
          <DialogHeader><DialogTitle>Update Status</DialogTitle><DialogDescription>Setting status to <strong>{actionState?.targetStatus}</strong>.</DialogDescription></DialogHeader>
          <div className="py-4 space-y-2"><Label>Remarks</Label><Textarea id="action-remarks" placeholder="Provide reason..." className="min-h-[100px] rounded-sm" /></div>
          <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={() => handleAction((document.getElementById('action-remarks') as HTMLTextAreaElement)?.value || "")}>Confirm</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyReq} onOpenChange={(o) => !o && setHistoryReq(null)}>
        <DialogContent className="rounded-sm max-w-lg">
          <DialogHeader><DialogTitle>Requirement Lifecycle</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-6 relative border-l-2 border-muted ml-3 pl-6 py-2">
              {historyReq?.timeline?.map((entry, idx) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                  <div className="flex flex-col gap-1 text-left">
                    <span className="text-xs font-bold text-primary">{entry.action} — {entry.userName}</span>
                    <p className="text-sm italic">{entry.remarks}</p>
                    <StatusBadge status={entry.status} className="w-fit" />
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {format(new Date(entry.timestamp), 'dd MMM yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              ))}
              {(!historyReq?.timeline || historyReq.timeline.length === 0) && (
                <div className="text-center py-10 opacity-30 italic text-sm">No timeline history recorded.</div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter><DialogClose asChild><Button variant="outline" className="rounded-sm font-bold">Close</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingReq} onOpenChange={(o) => !o && setEditingReq(null)}>
        <DialogContent className="rounded-sm max-w-md">
            <DialogHeader>
                <DialogTitle>Edit Requirement</DialogTitle>
                <DialogDescription>Modify request details for <strong>{editingReq?.itemName}</strong>.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSave} className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label>Quantity ({editingReq?.unit})</Label>
                    <Input name="quantity" type="number" step="0.01" defaultValue={editingReq?.quantity} required className="rounded-sm" />
                </div>
                <div className="space-y-2">
                    <Label>Urgency</Label>
                    <Select name="urgency" defaultValue={editingReq?.urgency}>
                        <SelectTrigger className="rounded-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="High">High</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="Low">Low</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Expected Date</Label>
                    <Input name="expectedDate" type="date" defaultValue={editingReq?.expectedDate} required className="rounded-sm" />
                </div>
                <DialogFooter className="pt-4 gap-2">
                    <Button type="button" variant="outline" onClick={() => setEditingReq(null)} disabled={isSaving}>Cancel</Button>
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Changes"}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingReq} onOpenChange={(o) => !o && setDeletingReq(null)}>
        <AlertDialogContent className="rounded-sm">
            <AlertDialogHeader><AlertDialogTitle>Delete Request?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
