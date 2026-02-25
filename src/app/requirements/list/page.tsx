"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, or, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ClipboardList, Search, Pencil, Trash2, Loader2, Clock, Calendar, FilterX, FileDown, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";
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

type Requirement = {
  id: string;
  siteName: string;
  itemName: string;
  quantity: number;
  unit: string;
  urgency: "High" | "Medium" | "Low";
  expectedDate: string;
  status: "Pending" | "Ordered" | "Dispatched" | "In-transit" | "Delivered";
  statusUpdatedBy?: string;
  statusUpdatedAt?: any;
  userId: string;
  userName: string;
  siteManagerId: string | null;
  createdAt: any;
  editedBy?: string;
  editedAt?: any;
};

const STATUS_OPTIONS = ["Pending", "Ordered", "Dispatched", "In-transit", "Delivered"] as const;

export default function RequirementListPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [editingReq, setEditingReq] = React.useState<Requirement | null>(null);
  const [deletingReq, setDeletingReq] = React.useState<Requirement | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const requirementsQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const colRef = collection(firestore, 'requirements');
    
    if (isAdmin) return colRef;
    
    if (isManager) {
        return query(
            colRef, 
            or(where('userId', '==', user.uid), where('siteManagerId', '==', user.uid))
        );
    }
    
    return query(colRef, where('userId', '==', user.uid));
  }, [firestore, user, userProfile, isAdmin, isManager]);

  const { data: requirements, isLoading: reqsLoading } = useCollection<Requirement>(requirementsQuery);

  const sortedAndFilteredReqs = React.useMemo(() => {
    if (!requirements) return [];
    
    let result = requirements.filter(req => {
      const matchesSearch = req.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.itemName || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesDate = true;
      if (startDate) {
        matchesDate = matchesDate && req.expectedDate >= startDate;
      }
      if (endDate) {
        matchesDate = matchesDate && req.expectedDate <= endDate;
      }
      
      return matchesSearch && matchesDate;
    });

    return result.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
        const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
        return dateB - dateA;
    });
  }, [requirements, searchTerm, startDate, endDate]);

  const stats = React.useMemo(() => {
    if (!sortedAndFilteredReqs) return { total: 0, high: 0, medium: 0, low: 0, pending: 0, delivered: 0 };
    return {
      total: sortedAndFilteredReqs.length,
      high: sortedAndFilteredReqs.filter(r => r.urgency === 'High').length,
      medium: sortedAndFilteredReqs.filter(r => r.urgency === 'Medium').length,
      low: sortedAndFilteredReqs.filter(r => r.urgency === 'Low').length,
      pending: sortedAndFilteredReqs.filter(r => r.status === 'Pending').length,
      delivered: sortedAndFilteredReqs.filter(r => r.status === 'Delivered').length,
    };
  }, [sortedAndFilteredReqs]);

  const handleDelete = () => {
    if (!deletingReq) return;
    deleteDocumentNonBlocking(doc(firestore, 'requirements', deletingReq.id));
    toast({ title: "Deleted", description: "Requirement request has been removed." });
    setDeletingReq(null);
  };

  const handleEditSave = () => {
    if (!editingReq || !editingReq.itemName.trim() || !userProfile) return;
    setIsSaving(true);
    updateDocumentNonBlocking(doc(firestore, 'requirements', editingReq.id), {
        itemName: editingReq.itemName,
        quantity: editingReq.quantity,
        unit: editingReq.unit,
        urgency: editingReq.urgency,
        expectedDate: editingReq.expectedDate,
        editedBy: userProfile.username || user?.email || "Unknown",
        editedAt: serverTimestamp()
    });
    toast({ title: "Updated", description: "Requirement details updated." });
    setIsSaving(false);
    setEditingReq(null);
  };

  const handleStatusChange = (reqId: string, newStatus: string) => {
    if (!user || !userProfile) return;
    const reqRef = doc(firestore, 'requirements', reqId);
    updateDocumentNonBlocking(reqRef, {
        status: newStatus,
        statusUpdatedBy: userProfile.username || user.email || "Unknown",
        statusUpdatedAt: serverTimestamp()
    });
    toast({ title: "Status Updated", description: `Requirement status changed to ${newStatus}.` });
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      const originalTitle = document.title;
      const dateSuffix = startDate || endDate ? `_${startDate || 'Start'}_to_${endDate || 'End'}` : '';
      document.title = `AdityaPro_Requirements_Summary${dateSuffix}`;
      window.print();
      document.title = originalTitle;
    }
  };

  const urgencyConfig = {
    High: "bg-red-100 text-red-800 border-red-200",
    Medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    Low: "bg-blue-100 text-blue-800 border-blue-200",
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <ClipboardList className="h-8 w-8" /> Requirement Data
          </h1>
          <p className="text-muted-foreground">Monitor and track site material requests.</p>
        </div>
        <div className="flex items-center gap-2">
          {(isAdmin || isManager) && (
            <Button variant="outline" className="rounded-sm font-bold border-primary text-primary hover:bg-primary/5" onClick={handlePrint}>
              <FileDown className="mr-2 h-4 w-4" />
              Generate Summary Report
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
        <Card className="bg-primary/5 border-primary/10 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Active Requests</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              <span className="text-red-600 font-bold">{stats.high} High Urgency</span> items pending
            </p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/5 border-yellow-500/10 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Pending Action</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">Awaiting procurement processing</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/10 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Fulfilled</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{stats.delivered}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">Successfully delivered to site</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-card p-4 border border-primary/10 rounded-sm shadow-sm no-print">
        <div className="md:col-span-2 space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search item, site or user..." 
              className="pl-9 rounded-sm h-10 border-primary/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">From Expected Date</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input 
              type="date" 
              className="pl-9 rounded-sm h-10 border-primary/20" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
            />
          </div>
        </div>
        <div className="space-y-1.5 flex gap-2">
          <div className="flex-1 space-y-1.5">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">To Expected Date</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input 
                type="date" 
                className="pl-9 rounded-sm h-10 border-primary/20" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
              />
            </div>
          </div>
          <Button variant="ghost" size="icon" className="mt-auto h-10 w-10 rounded-sm text-muted-foreground" onClick={clearFilters} title="Clear Filters">
            <FilterX className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="shadow-md border-primary/10 rounded-sm overflow-hidden" id="printable-report-area">
        <CardHeader className="border-b bg-muted/5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Daily Site Requirements Summary</CardTitle>
              <CardDescription>
                {startDate || endDate ? (
                  <span className="text-primary font-bold">
                    Requests expected between {startDate || 'Earliest'} and {endDate || 'Latest'}
                  </span>
                ) : "Status tracking for all submitted site material needs."}
              </CardDescription>
            </div>
            <div className="hidden print:block text-right">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Report Generated On</p>
              <p className="text-sm font-mono font-bold text-primary">{format(new Date(), 'dd MMM yyyy HH:mm')}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden print:grid grid-cols-3 gap-4 p-6 border-b bg-muted/10">
            <div className="space-y-1">
              <Label className="text-[9px] uppercase font-bold text-muted-foreground">High Urgency</Label>
              <p className="text-xl font-bold text-red-600">{stats.high}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] uppercase font-bold text-muted-foreground">Awaiting Order</Label>
              <p className="text-xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] uppercase font-bold text-muted-foreground">Total Lines</Label>
              <p className="text-xl font-bold text-primary">{stats.total}</p>
            </div>
          </div>

          {reqsLoading ? (
            <div className="p-6 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : sortedAndFilteredReqs && sortedAndFilteredReqs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-32">Site & User</TableHead>
                  <TableHead className="min-w-[200px]">Item Details</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Qty & Unit</TableHead>
                  <TableHead>Expected By</TableHead>
                  <TableHead className="min-w-[200px]">Status & Log</TableHead>
                  <TableHead className="text-right px-6 no-print">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAndFilteredReqs.map((req) => (
                  <TableRow key={req.id} className="hover:bg-muted/5 transition-colors">
                    <TableCell>
                        <div className="font-bold text-sm">{req.siteName}</div>
                        <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">{req.userName}</div>
                    </TableCell>
                    <TableCell>
                        <div className="text-sm font-semibold whitespace-pre-wrap max-w-xs">{req.itemName}</div>
                        {req.editedBy && (
                            <div className="flex items-center gap-1.5 text-[8px] text-primary/70 font-bold uppercase mt-1">
                                <Badge variant="outline" className="h-3 px-1 text-[7px] border-primary/20">Edited</Badge>
                                <span>by {req.editedBy}</span>
                            </div>
                        )}
                    </TableCell>
                    <TableCell>
                        <Badge variant="outline" className={cn("rounded-sm text-[10px] font-bold uppercase", urgencyConfig[req.urgency] || urgencyConfig.Medium)}>
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
                        <div className="flex items-center gap-2">
                            <div className="no-print">
                              <Select 
                                  defaultValue={req.status || "Pending"} 
                                  onValueChange={(val) => handleStatusChange(req.id, val)}
                              >
                                  <SelectTrigger className="w-[130px] h-8 text-[11px] font-bold rounded-sm border-primary/20 bg-background shadow-sm">
                                      <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                      {STATUS_OPTIONS.map(opt => (
                                          <SelectItem key={opt} value={opt} className="text-[11px] font-medium">{opt}</SelectItem>
                                      ))}
                                  </SelectContent>
                              </Select>
                            </div>
                            <div className="hidden print:block font-bold text-[11px] uppercase tracking-wide">
                              {req.status}
                            </div>
                            {req.statusUpdatedBy && (
                                <div className="hidden lg:flex flex-col text-[9px] text-muted-foreground italic leading-none ml-1">
                                    <span>{req.statusUpdatedBy}</span>
                                    {req.statusUpdatedAt && <span>{format(req.statusUpdatedAt.toDate(), 'dd/MM HH:mm')}</span>}
                                </div>
                            )}
                        </div>
                    </TableCell>
                    <TableCell className="text-right px-6 no-print">
                        <div className="flex justify-end items-center gap-1">
                            {req.userId === user?.uid && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => setEditingReq(req)}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            )}
                            {(req.userId === user?.uid || req.siteManagerId === user?.uid || isAdmin) && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setDeletingReq(req)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-24 text-muted-foreground italic bg-muted/5 border-t border-dashed">
              {searchTerm || startDate || endDate ? "No results found matching your current filters." : "No requirements found matching your criteria."}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingReq} onOpenChange={(o) => !o && setEditingReq(null)}>
        <DialogContent className="rounded-sm max-w-lg">
            <DialogHeader>
                <DialogTitle>Edit Requirement Request</DialogTitle>
                <DialogDescription>Modify your material or resource request for {editingReq?.siteName}.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label>Item Name</Label>
                    <Input 
                        value={editingReq?.itemName || ""} 
                        onChange={(e) => setEditingReq(prev => prev ? { ...prev, itemName: e.target.value } : null)} 
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input type="number" value={editingReq?.quantity || 0} onChange={(e) => setEditingReq(prev => prev ? { ...prev, quantity: Number(e.target.value) } : null)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Unit</Label>
                        <Select value={editingReq?.unit} onValueChange={(val) => setEditingReq(prev => prev ? { ...prev, unit: val } : null)}>
                            <SelectTrigger className="rounded-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {["Numbers", "Kilograms", "Liters", "Meters", "Sets"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Urgency</Label>
                        <Select value={editingReq?.urgency} onValueChange={(val: any) => setEditingReq(prev => prev ? { ...prev, urgency: val } : null)}>
                            <SelectTrigger className="rounded-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {["High", "Medium", "Low"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Expected Date</Label>
                        <Input type="date" value={editingReq?.expectedDate || ""} onChange={(e) => setEditingReq(prev => prev ? { ...prev, expectedDate: e.target.value } : null)} />
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setEditingReq(null)} disabled={isSaving}>Cancel</Button>
                <Button onClick={handleEditSave} disabled={isSaving || !editingReq?.itemName.trim()}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Request
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingReq} onOpenChange={(o) => !o && setDeletingReq(null)}>
        <AlertDialogContent className="rounded-sm">
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete your requirement request for <strong>{deletingReq?.siteName}</strong>.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete Permanently
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
