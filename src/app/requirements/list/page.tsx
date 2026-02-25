
"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, or, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ClipboardList, Search, Pencil, Trash2, Loader2, User, Clock, AlertTriangle } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
    
    let result = requirements.filter(req => 
      req.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.itemName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return result.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
        const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
        return dateB - dateA;
    });
  }, [requirements, searchTerm]);

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

  const urgencyConfig = {
    High: "bg-red-100 text-red-800 border-red-200",
    Medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    Low: "bg-blue-100 text-blue-800 border-blue-200",
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <ClipboardList className="h-8 w-8" /> Requirement Data
          </h1>
          <p className="text-muted-foreground">Monitor and track site material requests.</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search item, site or user..." 
            className="pl-9 rounded-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="shadow-md border-primary/10 rounded-sm overflow-hidden">
        <CardHeader>
          <CardTitle>Pending & Past Requests</CardTitle>
          <CardDescription>Status tracking for all submitted site requirements.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {reqsLoading ? (
            <div className="p-6 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : sortedAndFilteredReqs && sortedAndFilteredReqs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Site & User</TableHead>
                  <TableHead className="min-w-[200px]">Item Details</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Qty & Unit</TableHead>
                  <TableHead>Expected By</TableHead>
                  <TableHead className="min-w-[200px]">Status & Log</TableHead>
                  <TableHead className="text-right px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAndFilteredReqs.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>
                        <div className="font-semibold">{req.siteName}</div>
                        <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">{req.userName}</div>
                    </TableCell>
                    <TableCell>
                        <div className="text-sm font-medium whitespace-pre-wrap max-w-xs">{req.itemName}</div>
                        {req.editedBy && (
                            <div className="flex items-center gap-1.5 text-[9px] text-primary/70 font-bold uppercase mt-1">
                                <span>Edited by {req.editedBy}</span>
                            </div>
                        )}
                    </TableCell>
                    <TableCell>
                        <Badge variant="outline" className={cn("rounded-sm text-[10px] font-bold uppercase", urgencyConfig[req.urgency] || urgencyConfig.Medium)}>
                            {req.urgency}
                        </Badge>
                    </TableCell>
                    <TableCell>
                        <div className="font-mono font-bold text-sm">{req.quantity}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">{req.unit}</div>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {req.expectedDate ? format(new Date(req.expectedDate), 'dd MMM yy') : '—'}
                        </div>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2">
                            <Select 
                                defaultValue={req.status || "Pending"} 
                                onValueChange={(val) => handleStatusChange(req.id, val)}
                            >
                                <SelectTrigger className="w-[130px] h-8 text-[11px] font-bold rounded-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_OPTIONS.map(opt => (
                                        <SelectItem key={opt} value={opt} className="text-[11px] font-medium">{opt}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {req.statusUpdatedBy && (
                                <div className="hidden lg:flex flex-col text-[10px] text-muted-foreground italic leading-none">
                                    <span>by {req.statusUpdatedBy}</span>
                                    {req.statusUpdatedAt && <span>{format(req.statusUpdatedAt.toDate(), 'dd MMM HH:mm')}</span>}
                                </div>
                            )}
                        </div>
                    </TableCell>
                    <TableCell className="text-right px-6">
                        <div className="flex justify-end items-center gap-1">
                            {req.userId === user?.uid && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setEditingReq(req)}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            )}
                            {(req.userId === user?.uid || req.siteManagerId === user?.uid || isAdmin) && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingReq(req)}>
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
            <div className="text-center py-24 text-muted-foreground italic bg-muted/5">
              {searchTerm ? "No results found matching your search." : "No requirements found matching your criteria."}
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
                    <Textarea 
                        rows={4} 
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
