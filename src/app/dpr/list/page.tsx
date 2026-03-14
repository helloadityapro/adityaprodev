"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, or, serverTimestamp, increment, getDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { FileText, Search, Pencil, Trash2, Loader2, Clock, Calendar, FilterX, FileDown, MessageCircle, User } from "lucide-react";
import { isSuperAdmin } from "@/lib/auth-constants";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";

type DPR = {
  id: string;
  siteName: string;
  reportDate: string;
  description: string;
  userId: string;
  userName: string;
  siteManagerId: string | null;
  createdAt: any;
  editedBy?: string;
  editedAt?: any;
};

export default function DPRListPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [editingDpr, setEditingDpr] = React.useState<DPR | null>(null);
  const [deletingDpr, setDeletingDpr] = React.useState<DPR | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const dprsQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const colRef = collection(firestore, 'dprs');
    
    if (isAdmin) return colRef;
    
    if (isManager) {
        return query(
            colRef, 
            or(where('userId', '==', user.uid), where('siteManagerId', '==', user.uid))
        );
    }
    
    return query(colRef, where('userId', '==', user.uid));
  }, [firestore, user, userProfile, isAdmin, isManager]);

  const { data: dprs, isLoading: dprsLoading } = useCollection<DPR>(dprsQuery);

  const sortedAndFilteredDprs = React.useMemo(() => {
    if (!dprs) return [];
    
    let result = dprs.filter(dpr => {
      const matchesSearch = dpr.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (dpr.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        dpr.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesDate = true;
      if (startDate) {
        matchesDate = matchesDate && dpr.reportDate >= startDate;
      }
      if (endDate) {
        matchesDate = matchesDate && dpr.reportDate <= endDate;
      }
      
      return matchesSearch && matchesDate;
    });

    return result.sort((a, b) => {
        const dateA = new Date(a.reportDate || (a.createdAt?.toDate?.() || 0)).getTime();
        const dateB = new Date(b.reportDate || (b.createdAt?.toDate?.() || 0)).getTime();
        return dateB - dateA;
    });
  }, [dprs, searchTerm, startDate, endDate]);

  const handleDelete = async () => {
    if (!deletingDpr || !firestore) return;

    try {
        const engineerId = deletingDpr.userId;
        const managerId = deletingDpr.siteManagerId;

        const engRef = doc(firestore, 'users', engineerId);
        const engDoc = await getDoc(engRef);
        const multiplier = engDoc.exists() ? engDoc.data()?.pointsMultiplier || 1 : 1;
        
        updateDocumentNonBlocking(engRef, {
            totalPoints: increment(-(1.0 * multiplier))
        });

        if (managerId) {
            updateDocumentNonBlocking(doc(firestore, 'users', managerId), {
                totalPoints: increment(-0.25)
            });
        }

        deleteDocumentNonBlocking(doc(firestore, 'dprs', deletingDpr.id));
        toast({ title: "Deleted", description: "Report and associated points have been removed." });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not complete deletion logic.' });
    } finally {
        setDeletingDpr(null);
    }
  };

  const handleEditSave = () => {
    if (!editingDpr || !editingDpr.description.trim() || !userProfile) return;
    setIsSaving(true);
    updateDocumentNonBlocking(doc(firestore, 'dprs', editingDpr.id), {
        description: editingDpr.description,
        reportDate: editingDpr.reportDate,
        editedBy: userProfile.username || user?.email || "Unknown",
        editedAt: serverTimestamp()
    });
    toast({ title: "Updated", description: "Report has been updated successfully." });
    setIsSaving(false);
    setEditingDpr(null);
  };

  const handleWhatsAppShare = (dpr: DPR) => {
    const message = `*Aditya Pro - Daily Progress Report*\n\n*Site:* ${dpr.siteName}\n*Date:* ${format(new Date(dpr.reportDate), 'dd MMM yyyy')}\n*Submitted By:* ${dpr.userName}\n\n*Activities:*\n${dpr.description}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" /> DPR Data
          </h1>
          <p className="text-muted-foreground">Track and review submitted progress reports.</p>
        </div>
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
              <Calendar className="absolute left-2 top-2.5 h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground pointer-events-none" />
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
                <Calendar className="absolute left-2 top-2.5 h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground pointer-events-none" />
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

      <Card className="shadow-md border-primary/10 rounded-sm overflow-hidden" id="printable-report-area">
        <CardHeader className="border-b bg-muted/5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Daily Progress Updates</CardTitle>
              <CardDescription>
                {startDate || endDate ? (
                  <span className="text-primary font-semibold">
                    Report for {startDate || 'Start'} to {endDate || 'Today'}
                  </span>
                ) : "Comprehensive list of daily site activities."}
              </CardDescription>
            </div>
            <div className="hidden print:block text-right">
              <p className="text-xs font-bold uppercase text-muted-foreground">Generated On</p>
              <p className="text-sm font-mono">{format(new Date(), 'dd MMM yyyy HH:mm')}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {dprsLoading ? (
            <div className="p-6 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : sortedAndFilteredDprs && sortedAndFilteredDprs.length > 0 ? (
            <>
              {/* Mobile Card Layout */}
              <div className="md:hidden divide-y">
                {sortedAndFilteredDprs.map((dpr) => (
                  <div key={dpr.id} className="p-4 space-y-3 bg-card hover:bg-muted/5 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">
                          {dpr.reportDate ? format(new Date(dpr.reportDate), 'dd MMM yyyy') : '—'}
                        </span>
                        <h3 className="font-bold text-sm leading-tight text-foreground truncate">{dpr.siteName}</h3>
                      </div>
                      <Badge variant="outline" className="text-[8px] font-black uppercase rounded-sm border-primary/20 text-primary">
                        DPR
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                      <User className="h-3 w-3 text-primary" />
                      <span>{dpr.userName}</span>
                    </div>

                    <div className="space-y-2">
                      {dpr.description.split('\n\n').filter(p => p.trim() !== '').map((para, pIdx) => (
                        <p key={pIdx} className="text-xs italic text-muted-foreground leading-relaxed line-clamp-3">
                          "{para.trim()}"
                        </p>
                      ))}
                    </div>

                    {dpr.editedBy && (
                      <div className="flex items-center gap-1.5 text-[9px] text-primary/70 font-medium bg-primary/5 p-1.5 rounded-sm">
                        <Clock className="h-2.5 w-2.5" />
                        <span>Edited by {dpr.editedBy} on {dpr.editedAt ? format(dpr.editedAt.toDate(), 'dd MMM HH:mm') : '—'}</span>
                      </div>
                    )}

                    <div className="pt-2 border-t flex justify-end items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 rounded-sm" onClick={() => handleWhatsAppShare(dpr)} title="Push to WhatsApp">
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      {dpr.userId === user?.uid && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => setEditingDpr(dpr)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {(dpr.userId === user?.uid || dpr.siteManagerId === user?.uid || isAdmin) && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => setDeletingDpr(dpr)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-32">Date</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead className="min-w-[300px]">Update & Activity</TableHead>
                      <TableHead className="text-right px-6 no-print">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAndFilteredDprs.map((dpr) => (
                      <TableRow key={dpr.id} className="hover:bg-muted/5">
                        <TableCell className="font-medium whitespace-nowrap">
                            {dpr.reportDate ? format(new Date(dpr.reportDate), 'dd MMM yyyy') : '—'}
                        </TableCell>
                        <TableCell className="font-semibold">{dpr.siteName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div className="font-medium text-foreground">{dpr.userName || '—'}</div>
                        </TableCell>
                        <TableCell className="max-w-md py-4">
                            <div className="space-y-3 mb-3">
                                {dpr.description.split('\n\n').filter(p => p.trim() !== '').map((para, pIdx, arr) => (
                                    <React.Fragment key={pIdx}>
                                        <p className="text-sm italic text-muted-foreground leading-relaxed">
                                            "{para.trim()}"
                                        </p>
                                        {pIdx < arr.length - 1 && (
                                            <div className="h-px bg-primary/10 my-2" />
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                            {dpr.editedBy && (
                                <div className="flex items-center gap-1.5 text-[10px] text-primary/70 font-medium border-t border-primary/5 pt-2">
                                    <span className="bg-primary/10 px-1 rounded">Edited</span>
                                    <span>by {dpr.editedBy}</span>
                                    {dpr.editedAt && (
                                        <span className="text-muted-foreground/60 flex items-center gap-1">
                                            <Clock className="h-2.5 w-2.5" />
                                            {format(dpr.editedAt.toDate(), 'dd MMM HH:mm')}
                                        </span>
                                    )}
                                </div>
                            )}
                        </TableCell>
                        <TableCell className="text-right px-6 no-print">
                            <div className="flex justify-end items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-50" onClick={() => handleWhatsAppShare(dpr)} title="Push to WhatsApp">
                                    <MessageCircle className="h-4 w-4" />
                                </Button>
                                {dpr.userId === user?.uid && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setEditingDpr(dpr)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                )}
                                {(dpr.userId === user?.uid || dpr.siteManagerId === user?.uid || isAdmin) && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingDpr(dpr)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="text-center py-24 text-muted-foreground italic bg-muted/5">
              {searchTerm || startDate || endDate ? "No results found matching your filters." : "No reports found matching your criteria."}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingDpr} onOpenChange={(o) => !o && setEditingDpr(null)}>
        <DialogContent className="rounded-sm max-w-lg">
            <DialogHeader>
                <DialogTitle>Edit Daily Progress Report</DialogTitle>
                <DialogDescription>Update the details for your site report at {editingDpr?.siteName}.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label>Report Date</Label>
                    <Input type="date" value={editingDpr?.reportDate || ""} onChange={(e) => setEditingDpr(prev => prev ? { ...prev, reportDate: e.target.value } : null)} />
                </div>
                <div className="space-y-2">
                    <Label>Today's Update</Label>
                    <Textarea 
                        rows={6} 
                        value={editingDpr?.description || ""} 
                        onChange={(e) => setEditingDpr(prev => prev ? { ...prev, description: e.target.value } : null)} 
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setEditingDpr(null)} disabled={isSaving}>Cancel</Button>
                <Button onClick={handleEditSave} disabled={isSaving || !editingDpr?.description.trim()}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingDpr} onOpenChange={(o) => !o && setDeletingDpr(null)}>
        <AlertDialogContent className="rounded-sm">
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the progress report for <strong>{deletingDpr?.siteName}</strong> on {deletingDpr?.reportDate} and reverse any reward points earned.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete Permanently
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}