"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, or, serverTimestamp, increment, getDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ArrowLeftRight, Search, Pencil, Trash2, Loader2, Clock, Calendar, FilterX, FileDown, TrendingUp, ArrowDownCircle, ArrowUpCircle, MapPin, Truck, Building2, ChevronsUpDown, Check, User, MessageCircle, FileText, ExternalLink, Eye } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

type Attachment = {
  url: string;
  name: string;
  contentType: string;
};

type MaterialMovement = {
  id: string;
  siteName: string;
  itemName: string;
  quantity: number;
  unit: string;
  movementType: "Inward" | "Outward";
  sourceOrDestinationType: "Supplier" | "Site";
  sourceOrDestination: string;
  movementDate: string;
  userId: string;
  userName: string;
  siteManagerId: string | null;
  createdAt: any;
  editedBy?: string;
  editedAt?: any;
  attachments?: Attachment[];
};

type Site = {
  id: string;
  name: string;
};

export default function MovementListPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [editingMov, setEditingMov] = React.useState<MaterialMovement | null>(null);
  const [deletingMov, setDeletingMov] = React.useState<MaterialMovement | null>(null);
  const [viewAttachments, setViewAttachments] = React.useState<Attachment[] | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const [isEditSitePopoverOpen, setIsEditSitePopoverOpen] = React.useState(false);
  const [editSiteSearchQuery, setEditSiteSearchQuery] = React.useState("");

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const movementsQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const colRef = collection(firestore, 'material_movements');
    
    if (isAdmin) return colRef;
    
    if (isManager) {
        return query(
            colRef, 
            or(where('userId', '==', user.uid), where('siteManagerId', '==', user.uid))
        );
    }
    
    return query(colRef, where('userId', '==', user.uid));
  }, [firestore, user, userProfile, isAdmin, isManager]);

  const { data: movements, isLoading: loading } = useCollection<MaterialMovement>(movementsQuery);

  const filteredMovements = React.useMemo(() => {
    if (!movements) return [];
    
    let result = movements.filter(mov => {
      const matchesSearch = mov.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (mov.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (mov.itemName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (mov.sourceOrDestination || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesDate = true;
      if (startDate) {
        matchesDate = matchesDate && mov.movementDate >= startDate;
      }
      if (endDate) {
        matchesDate = matchesDate && mov.movementDate <= endDate;
      }
      
      return matchesSearch && matchesDate;
    });

    return result.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
        const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
        return dateB - dateA;
    });
  }, [movements, searchTerm, startDate, endDate]);

  const stats = React.useMemo(() => {
    if (!filteredMovements) return { total: 0, inward: 0, outward: 0 };
    return {
      total: filteredMovements.length,
      inward: filteredMovements.filter(m => m.movementType === 'Inward').length,
      outward: filteredMovements.filter(m => m.movementType === 'Outward').length,
    };
  }, [filteredMovements]);

  const handleDelete = async () => {
    if (!deletingMov || !firestore) return;

    try {
        // Point Deduction Logic (Reversing 0.1 for Engineer, 0.05 for Manager)
        const engDoc = await getDoc(doc(firestore, 'users', deletingMov.userId));
        const multiplier = engDoc.exists() ? engDoc.data()?.pointsMultiplier || 1 : 1;
        
        // 1. Deduct from Engineer (0.1 base * multiplier)
        updateDocumentNonBlocking(doc(firestore, 'users', deletingMov.userId), {
            totalPoints: increment(-(0.1 * multiplier))
        });

        // 2. Deduct from Manager (0.05 base)
        if (deletingMov.siteManagerId) {
            updateDocumentNonBlocking(doc(firestore, 'users', deletingMov.siteManagerId), {
                totalPoints: increment(-0.05)
            });
        }

        deleteDocumentNonBlocking(doc(firestore, 'material_movements', deletingMov.id));
        toast({ title: "Deleted", description: "Movement record and associated points removed." });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to reverse points during deletion.' });
    } finally {
        setDeletingMov(null);
    }
  };

  const handleEditSave = () => {
    if (!editingMov || !editingMov.itemName.trim() || !userProfile) return;
    setIsSaving(true);
    updateDocumentNonBlocking(doc(firestore, 'material_movements', editingMov.id), {
        itemName: editingMov.itemName,
        quantity: editingMov.quantity,
        unit: editingMov.unit,
        movementType: editingMov.movementType,
        sourceOrDestinationType: editingMov.sourceOrDestinationType,
        sourceOrDestination: editingMov.sourceOrDestination,
        movementDate: editingMov.movementDate,
        editedBy: userProfile.username || user?.email || "Unknown",
        editedAt: serverTimestamp()
    });
    toast({ title: "Updated", description: "Movement details updated." });
    setIsSaving(false);
    setEditingMov(null);
  };

  const handleWhatsAppShare = (mov: MaterialMovement) => {
    const sourceLabel = mov.movementType === 'Inward' ? 'From' : 'To';
    const message = `*Aditya Pro - Material Movement Report*\n\n*Site:* ${mov.siteName}\n*Date:* ${format(new Date(mov.movementDate), 'dd MMM yyyy')}\n*Type:* ${mov.movementType} (${sourceLabel} ${mov.sourceOrDestinationType || 'Supplier'}: ${mov.sourceOrDestination})\n*Item:* ${mov.itemName}\n*Quantity:* ${mov.quantity} ${mov.unit}\n*Recorded By:* ${mov.userName}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
  };

  const allSitesList = allSites ? Array.from(new Map(allSites.map(s => [s.name, s])).values()) : [];
  const filteredAllSites = allSitesList.filter(s => s.name.toLowerCase().includes(editSiteSearchQuery.toLowerCase()));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1 no-print">
        <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
          <ArrowLeftRight className="h-8 w-8" /> Movement Data
        </h1>
        <p className="text-muted-foreground">Track inward and outward material logs.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
        <Card className="bg-primary/5 border-primary/10 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Total Logs</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/10 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-green-600">Inward Items</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{stats.inward}</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-blue-500/10 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-blue-600">Outward Items</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{stats.outward}</div>
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

      {/* Mobile Responsive List */}
      <div className="md:hidden space-y-4">
        {filteredMovements.length > 0 ? filteredMovements.map((mov) => (
          <Card key={mov.id} className="border-primary/10 rounded-sm shadow-sm overflow-hidden" onClick={() => mov.attachments?.length && setViewAttachments(mov.attachments)}>
            <CardContent className="p-4 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">{mov.movementDate ? format(new Date(mov.movementDate), 'dd MMM yy') : '—'}</span>
                  <h3 className="font-bold text-sm leading-tight text-foreground truncate">{mov.siteName}</h3>
                </div>
                <Badge variant="outline" className={cn("rounded-sm text-[9px] font-bold uppercase", mov.movementType === 'Inward' ? "bg-green-100 text-green-800 border-green-200" : "bg-blue-100 text-blue-800 border-blue-200")}>
                  {mov.movementType}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold">{mov.itemName}</div>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-primary">{mov.quantity} {mov.unit}</div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                    <User className="h-3 w-3 text-primary" /> {mov.userName}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-primary/5 flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-black uppercase text-muted-foreground">{mov.movementType === 'Inward' ? 'From' : 'To'} {mov.sourceOrDestinationType || 'Supplier'}</span>
                  <span className="text-[10px] font-bold text-foreground truncate max-w-[150px]">{mov.sourceOrDestination}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={(e) => { e.stopPropagation(); handleWhatsAppShare(mov); }}>
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                  {mov.userId === user?.uid && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={(e) => { e.stopPropagation(); setEditingMov(mov); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {(mov.userId === user?.uid || mov.siteManagerId === user?.uid || isAdmin) && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); setDeletingMov(mov); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )) : (
          <div className="text-center py-12 text-muted-foreground italic bg-muted/5 rounded-sm border-2 border-dashed">
            No movements found.
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Card className="shadow-md border-primary/10 rounded-sm overflow-hidden" id="printable-report-area">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-28">Date</TableHead>
                  <TableHead>Project Site</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="min-w-[180px]">Source / Destination</TableHead>
                  <TableHead className="min-w-[180px]">Item Details</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Recorded By</TableHead>
                  <TableHead className="text-right px-6 no-print">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovements.map((mov) => (
                  <TableRow key={mov.id} className="hover:bg-muted/5 transition-colors">
                    <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {mov.movementDate ? format(new Date(mov.movementDate), 'dd MMM yy') : '—'}
                        </div>
                    </TableCell>
                    <TableCell className="font-bold text-sm">{mov.siteName}</TableCell>
                    <TableCell>
                        <Badge variant="outline" className={cn("rounded-sm text-[10px] font-bold uppercase", mov.movementType === 'Inward' ? "bg-green-100 text-green-800 border-green-200" : "bg-blue-100 text-blue-800 border-blue-200")}>
                            {mov.movementType}
                        </Badge>
                    </TableCell>
                    <TableCell>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                    {mov.movementType === 'Inward' ? 'From' : 'To'}:
                                </span>
                                <Badge variant="secondary" className="text-[9px] h-4 rounded-sm px-1.5 font-bold uppercase tracking-tighter">
                                    {mov.sourceOrDestinationType || 'Supplier'}
                                </Badge>
                            </div>
                            <span className="text-[11px] font-medium text-primary flex items-center gap-1">
                                {mov.sourceOrDestinationType === 'Site' ? <Building2 className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
                                {mov.sourceOrDestination || '—'}
                            </span>
                        </div>
                    </TableCell>
                    <TableCell>
                        <div className="text-sm font-semibold whitespace-pre-wrap max-w-xs">{mov.itemName}</div>
                    </TableCell>
                    <TableCell>
                        <div className="font-mono font-bold text-sm text-primary">{mov.quantity}</div>
                        <div className="text-[10px] text-muted-foreground uppercase font-medium">{mov.unit}</div>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight truncate max-w-[100px]">{mov.userName}</span>
                        </div>
                    </TableCell>
                    <TableCell className="text-right px-6 no-print">
                        <div className="flex justify-end items-center gap-1">
                            {mov.attachments && mov.attachments.length > 0 && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setViewAttachments(mov.attachments || null)}>
                                <FileText className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => handleWhatsAppShare(mov)}>
                                <MessageCircle className="h-4 w-4" />
                            </Button>
                            {mov.userId === user?.uid && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setEditingMov(mov)}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            )}
                            {(mov.userId === user?.uid || mov.siteManagerId === user?.uid || isAdmin) && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingMov(mov)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* View Attachments Dialog */}
      <Dialog open={!!viewAttachments} onOpenChange={(o) => !o && setViewAttachments(null)}>
        <DialogContent className="rounded-sm max-w-md">
          <DialogHeader><DialogTitle>Invoices / Documents</DialogTitle></DialogHeader>
          <div className="py-4 space-y-3">
            {viewAttachments?.map((att, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 border rounded-sm bg-muted/5">
                <span className="text-xs font-bold truncate max-w-[200px]">{att.name}</span>
                <Button variant="ghost" size="sm" className="h-8 text-xs font-bold text-primary" asChild>
                  <a href={att.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3 mr-1.5" /> View</a>
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingMov} onOpenChange={(o) => !o && setEditingMov(null)}>
        <DialogContent className="rounded-sm max-w-lg">
            <DialogHeader>
                <DialogTitle>Edit Movement</DialogTitle>
                <DialogDescription>Modify the recorded details.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label>Item Name</Label>
                    <Input value={editingMov?.itemName || ""} onChange={(e) => setEditingMov(prev => prev ? { ...prev, itemName: e.target.value } : null)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input type="number" value={editingMov?.quantity || 0} onChange={(e) => setEditingMov(prev => prev ? { ...prev, quantity: Number(e.target.value) } : null)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Date</Label>
                        <Input type="date" value={editingMov?.movementDate || ""} onChange={(e) => setEditingMov(prev => prev ? { ...prev, movementDate: e.target.value } : null)} />
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setEditingMov(null)}>Cancel</Button>
                <Button onClick={handleEditSave} disabled={isSaving}>Update</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingMov} onOpenChange={(o) => !o && setDeletingMov(null)}>
        <AlertDialogContent className="rounded-sm">
            <AlertDialogHeader><AlertDialogTitle>Delete Record?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
