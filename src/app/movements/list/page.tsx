
"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, or, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ArrowLeftRight, Search, Pencil, Trash2, Loader2, Clock, Calendar, FilterX, FileDown, TrendingUp, ArrowDownCircle, ArrowUpCircle, MapPin, Truck, Building2, ChevronsUpDown, Check, User } from "lucide-react";
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

type MaterialMovement = {
  id: string;
  siteName: string;
  itemName: string;
  quantity: number;
  unit: string;
  movementType: "Inward" | "Outward";
  sourceOrDestinationType: "Vendor" | "Site";
  sourceOrDestination: string;
  movementDate: string;
  userId: string;
  userName: string;
  siteManagerId: string | null;
  createdAt: any;
  editedBy?: string;
  editedAt?: any;
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

  const handleDelete = () => {
    if (!deletingMov) return;
    deleteDocumentNonBlocking(doc(firestore, 'material_movements', deletingMov.id));
    toast({ title: "Deleted", description: "Movement record has been removed." });
    setDeletingMov(null);
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

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      const originalTitle = document.title;
      document.title = `AdityaPro_Movement_Summary`;
      window.print();
      document.title = originalTitle;
    }
  };

  const allSitesList = allSites ? Array.from(new Map(allSites.map(s => [s.name, s])).values()) : [];
  const filteredAllSites = allSitesList.filter(s => s.name.toLowerCase().includes(editSiteSearchQuery.toLowerCase()));

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <ArrowLeftRight className="h-8 w-8" /> Movement Data
          </h1>
          <p className="text-muted-foreground">Track inward and outward material logs.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-sm font-bold border-primary text-primary hover:bg-primary/5" onClick={handlePrint}>
            <FileDown className="mr-2 h-4 w-4" />
            Generate Summary Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
        <Card className="bg-primary/5 border-primary/10 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Total Movements</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Daily material flow tracking</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/10 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Inward Items</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{stats.inward}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Materials received at site</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-blue-500/10 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Outward Items</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{stats.outward}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Materials dispatched from site</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-card p-4 border border-primary/10 rounded-sm shadow-sm no-print">
        <div className="md:col-span-2 space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search item, site, from/to or user..." 
              className="pl-9 rounded-sm h-10 border-primary/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">From Date</Label>
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
            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">To Date</Label>
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
          <Button variant="ghost" size="icon" className="mt-auto h-10 w-10 rounded-sm text-muted-foreground" onClick={() => { setSearchTerm(""); setStartDate(""); setEndDate(""); }} title="Clear Filters">
            <FilterX className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="shadow-md border-primary/10 rounded-sm overflow-hidden" id="printable-report-area">
        <CardHeader className="border-b bg-muted/5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Material Movement Summary</CardTitle>
              <CardDescription>
                {startDate || endDate ? (
                  <span className="text-primary font-bold">
                    Report for {startDate || 'Earliest'} to {endDate || 'Latest'}
                  </span>
                ) : "Comprehensive log of all material inward and outward flows."}
              </CardDescription>
            </div>
            <div className="hidden print:block text-right">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Report Generated On</p>
              <p className="text-sm font-mono font-bold text-primary">{format(new Date(), 'dd MMM yyyy HH:mm')}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredMovements && filteredMovements.length > 0 ? (
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
                                    {mov.sourceOrDestinationType || 'Vendor'}
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
                        {mov.editedBy && (
                            <div className="flex items-center gap-1.5 text-[8px] text-primary/70 font-bold uppercase mt-1">
                                <Badge variant="outline" className="h-3 px-1 text-[7px] border-primary/20">Edited</Badge>
                                <span>by {mov.editedBy}</span>
                            </div>
                        )}
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
                            {mov.userId === user?.uid && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => setEditingMov(mov)}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            )}
                            {(mov.userId === user?.uid || mov.siteManagerId === user?.uid || isAdmin) && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setDeletingMov(mov)}>
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
              No movement records found.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingMov} onOpenChange={(o) => !o && setEditingMov(null)}>
        <DialogContent className="rounded-sm max-w-lg">
            <DialogHeader>
                <DialogTitle>Edit Movement Record</DialogTitle>
                <DialogDescription>Modify the recorded material movement details.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label>Item Name</Label>
                    <Input value={editingMov?.itemName || ""} onChange={(e) => setEditingMov(prev => prev ? { ...prev, itemName: e.target.value } : null)} />
                </div>
                
                <div className="space-y-3">
                    <Label>{editingMov?.movementType === 'Inward' ? 'Inward From' : 'Outward To'}</Label>
                    <RadioGroup
                        value={editingMov?.sourceOrDestinationType || "Vendor"}
                        onValueChange={(val: any) => setEditingMov(prev => prev ? { ...prev, sourceOrDestinationType: val, sourceOrDestination: "" } : null)}
                        className="flex gap-4 mb-2"
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Vendor" id="edit-vendor" />
                            <Label htmlFor="edit-vendor" className="font-normal cursor-pointer flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> Vendor</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Site" id="edit-site" />
                            <Label htmlFor="edit-site" className="font-normal cursor-pointer flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> Project Site</Label>
                        </div>
                    </RadioGroup>
                    
                    {editingMov?.sourceOrDestinationType === 'Site' ? (
                        <Popover open={isEditSitePopoverOpen} onOpenChange={setIsEditSitePopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-full justify-between font-normal rounded-sm">
                                    {editingMov.sourceOrDestination || "Select site..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <div className="flex items-center border-b px-3">
                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                    <Input 
                                        placeholder="Search sites..." 
                                        className="h-9 w-full border-none focus-visible:ring-0 px-0" 
                                        value={editSiteSearchQuery} 
                                        onChange={(e) => setEditSiteSearchQuery(e.target.value)}
                                    />
                                </div>
                                <ScrollArea className="h-[200px]">
                                    {filteredAllSites.map((site) => (
                                        <Button 
                                            key={site.id} 
                                            variant="ghost" 
                                            className="w-full justify-start font-normal text-left" 
                                            onClick={() => { setEditingMov(prev => prev ? { ...prev, sourceOrDestination: site.name } : null); setIsEditSitePopoverOpen(false); }}
                                        >
                                            <Check className={cn("mr-2 h-4 w-4 shrink-0", site.name === editingMov.sourceOrDestination ? "opacity-100" : "opacity-0")} />
                                            <span className="truncate">{site.name}</span>
                                        </Button>
                                    ))}
                                </ScrollArea>
                            </PopoverContent>
                        </Popover>
                    ) : (
                        <Input value={editingMov?.sourceOrDestination || ""} onChange={(e) => setEditingMov(prev => prev ? { ...prev, sourceOrDestination: e.target.value } : null)} placeholder="Vendor name" />
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Movement Type</Label>
                        <Select value={editingMov?.movementType} onValueChange={(val: any) => setEditingMov(prev => prev ? { ...prev, movementType: val } : null)}>
                            <SelectTrigger className="rounded-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Inward">Inward</SelectItem>
                                <SelectItem value="Outward">Outward</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Date</Label>
                        <Input type="date" value={editingMov?.movementDate || ""} onChange={(e) => setEditingMov(prev => prev ? { ...prev, movementDate: e.target.value } : null)} />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input type="number" value={editingMov?.quantity || 0} onChange={(e) => setEditingMov(prev => prev ? { ...prev, quantity: Number(e.target.value) } : null)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Unit</Label>
                        <Select value={editingMov?.unit} onValueChange={(val) => setEditingMov(prev => prev ? { ...prev, unit: val } : null)}>
                            <SelectTrigger className="rounded-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {["Numbers", "Kilograms", "Liters", "Meters", "Sets"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setEditingMov(null)} disabled={isSaving}>Cancel</Button>
                <Button onClick={handleEditSave} disabled={isSaving || !editingMov?.itemName.trim() || !editingMov?.sourceOrDestination.trim()}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Record
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingMov} onOpenChange={(o) => !o && setDeletingMov(null)}>
        <AlertDialogContent className="rounded-sm">
            <AlertDialogHeader>
                <AlertDialogTitle>Delete Record?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently remove this material movement log.
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
