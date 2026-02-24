
"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, or } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ClipboardList, Search, Pencil, Trash2, Loader2, User } from "lucide-react";
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

type Requirement = {
  id: string;
  siteName: string;
  description: string;
  status: "Pending" | "Ordered" | "Dispatched" | "In-transit" | "Delivered";
  statusUpdatedBy?: string;
  userId: string;
  userName: string;
  siteManagerId: string | null;
  createdAt: any;
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
      req.description.toLowerCase().includes(searchTerm.toLowerCase())
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
    if (!editingReq || !editingReq.description.trim()) return;
    setIsSaving(true);
    updateDocumentNonBlocking(doc(firestore, 'requirements', editingReq.id), {
        description: editingReq.description
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
        statusUpdatedBy: userProfile.username || user.email || "Unknown"
    });
    toast({ title: "Status Updated", description: `Requirement status changed to ${newStatus}.` });
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
            placeholder="Search requirements..." 
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
                  <TableHead className="w-32">Date</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="min-w-[200px]">Requirement</TableHead>
                  <TableHead className="min-w-[250px]">Status & Log</TableHead>
                  <TableHead className="text-right px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAndFilteredReqs.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                        {req.createdAt ? format(req.createdAt.toDate(), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    <TableCell className="font-semibold">{req.siteName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{req.userName || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-sm truncate">
                        {req.description}
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-3">
                            <Select 
                                defaultValue={req.status || "Pending"} 
                                onValueChange={(val) => handleStatusChange(req.id, val)}
                            >
                                <SelectTrigger className="w-[140px] h-8 text-[11px] font-bold rounded-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_OPTIONS.map(opt => (
                                        <SelectItem key={opt} value={opt} className="text-[11px] font-medium">{opt}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {req.statusUpdatedBy && (
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground italic whitespace-nowrap">
                                    <User className="h-3 w-3" />
                                    <span>by {req.statusUpdatedBy}</span>
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
                    <Label>Requirement Details</Label>
                    <Textarea 
                        rows={8} 
                        value={editingReq?.description || ""} 
                        onChange={(e) => setEditingReq(prev => prev ? { ...prev, description: e.target.value } : null)} 
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setEditingReq(null)} disabled={isSaving}>Cancel</Button>
                <Button onClick={handleEditSave} disabled={isSaving || !editingReq?.description.trim()}>
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
