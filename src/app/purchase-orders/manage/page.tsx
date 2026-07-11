'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, orderBy, where, limit, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ShoppingBag, 
  Search, 
  FilterX, 
  Eye, 
  Trash2, 
  Calendar,
  Building2,
  Truck,
  ArrowRight, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  History, 
  User, 
  ChevronDown, 
  ChevronUp, 
  Layers,
  FileDown,
  Plus,
  Pencil,
  CircleCheck,
  CircleX,
  Loader2,
  Printer,
  ExternalLink,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { isSuperAdmin } from '@/lib/auth-constants';
import * as XLSX from 'xlsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { slugifyRole } from '@/lib/access-control';

type POItem = {
  bomItemId: string;
  itemName: string;
  quantity: number;
  rate: number;
  gstPercent: number;
  amount: number;
};

type PurchaseOrder = {
  id: string;
  poNumber: string;
  siteId: string;
  siteName: string;
  supplierName: string;
  orderDate: string;
  status: string;
  totalAmount: number;
  items: POItem[];
  itemsCount?: number;
  createdAt: any;
  createdByName?: string;
  history?: any[];
  adminRemarks?: string;
  processedByName?: string;
  processedAt?: any;
};

type AccessConfig = {
  id: string;
  ownDataOnly?: boolean;
};

type POSortKey = 'poNumber' | 'site' | 'supplier' | 'status' | 'date' | 'total';

const formatTimestamp = (ts: any) => {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : (typeof ts === 'string' ? new Date(ts) : ts);
  return format(date, 'dd/MM/yyyy HH:mm');
};

export default function GlobalManagePOsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sortConfig, setSortConfig] = React.useState<{ key: POSortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());
  const [poToDelete, setPoToDelete] = React.useState<PurchaseOrder | null>(null);
  const [poActionState, setPoActionState] = React.useState<{ po: PurchaseOrder, type: 'Accepted' | 'Rejected' } | null>(null);
  const [viewingPO, setViewingPO] = React.useState<PurchaseOrder | null>(null);
  const [isActionProcessing, setIsActionProcessing] = React.useState(false);
  const [isExportingPDF, setIsExportingPDF] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<AccessConfig>(roleConfigsQuery);

  const isSuper = isSuperAdmin(user?.email);
  const isAdmin = isSuper || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const posQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    return query(collection(firestore, 'project_pos'), orderBy('createdAt', 'desc'), limit(500));
  }, [firestore, user, isProfileLoading]);

  const { data: allPOs, isLoading: isPOsLoading } = useCollection<PurchaseOrder>(posQuery);

  // Handle deep link via URL view parameter
  React.useEffect(() => {
    const viewId = searchParams.get('view');
    if (viewId && allPOs && allPOs.length > 0) {
      const found = allPOs.find(p => p.id === viewId);
      if (found) {
        setViewingPO(found);
      }
    }
  }, [searchParams, allPOs]);

  const handleSort = (key: POSortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: POSortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3 text-primary" /> : <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  const filteredPOs = React.useMemo(() => {
    if (!allPOs || !userProfile) return [];
    
    const isOwnDataOnly = userProfile.ownDataOnly !== undefined 
      ? userProfile.ownDataOnly 
      : roleConfigs?.find(c => c.id === slugifyRole(userProfile.role || ""))?.ownDataOnly ?? false;

    let result = allPOs;

    if (isOwnDataOnly && !isSuper) {
      const assignedIds = new Set(userProfile.assignedProjectIds || []);
      result = result.filter(po => assignedIds.has(po.siteId));
    }

    result = result.filter(po => {
      const matchesSearch = 
        po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || po.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });

    result.sort((a, b) => {
      const { key, direction } = sortConfig;
      let valA: any = '';
      let valB: any = '';

      if (key === 'poNumber') { valA = a.poNumber; valB = b.poNumber; }
      else if (key === 'site') { valA = a.siteName; valB = b.siteName; }
      else if (key === 'supplier') { valA = a.supplierName; valB = b.supplierName; }
      else if (key === 'status') { valA = a.status; valB = b.status; }
      else if (key === 'date') { valA = new Date(a.orderDate).getTime(); valB = new Date(b.orderDate).getTime(); }
      else if (key === 'total') { valA = a.totalAmount || 0; valB = b.totalAmount || 0; }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [allPOs, searchTerm, statusFilter, sortConfig, userProfile, roleConfigs, isSuper]);

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  const handleDeletePO = async () => {
    if (!poToDelete) return;
    try {
      await deleteDocumentNonBlocking(doc(firestore, 'project_pos', poToDelete.id));
      toast({ title: 'PO Removed', description: 'Order record deleted.' });
      setPoToDelete(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const handleProcessPO = (remarks: string) => {
    if (!poActionState || !userProfile) return;
    setIsActionProcessing(true);
    const logEntry = {
      action: poActionState.type === 'Accepted' ? 'Accepted' : 'Rejected',
      userName: userProfile.username || user?.email || 'Admin',
      userId: user?.uid || '',
      timestamp: new Date(),
      details: remarks ? `Remarks: ${remarks}` : 'Processed without specific remarks.'
    };
    const poRef = doc(firestore, 'project_pos', poActionState.po.id);
    updateDocumentNonBlocking(poRef, {
      status: poActionState.type,
      adminRemarks: remarks,
      processedByName: userProfile.username || user?.email || 'Admin',
      processedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      history: arrayUnion(logEntry)
    });
    toast({ 
      title: poActionState.type === 'Accepted' ? 'PO Accepted' : 'PO Rejected', 
      description: `Purchase Order ${poActionState.po.poNumber} has been updated.` 
    });
    setIsActionProcessing(false);
    setPoActionState(null);
  };

  const exportToPDF = async (po: PurchaseOrder) => {
    setIsExportingPDF(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF('p', 'mm', 'a4');
      const margin = 20;
      let currY = 30;

      // Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(45, 115, 255); // Primary Blue
      doc.text('PURCHASE ORDER', 105, currY, { align: 'center' });
      
      currY += 15;
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text('ADITYA GREEN ENERGY PRIVATE LIMITED', margin, currY);
      doc.setFont('helvetica', 'normal');
      doc.text('Registered Office: Maharashtra, India', margin, currY + 5);
      
      currY += 20;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, currY, 210 - margin, currY);
      
      currY += 10;
      doc.setFont('helvetica', 'bold');
      doc.text(`PO NUMBER: ${po.poNumber}`, margin, currY);
      doc.text(`DATE: ${po.orderDate}`, 210 - margin, currY, { align: 'right' });
      
      currY += 10;
      doc.text('SUPPLIER:', margin, currY);
      doc.setFont('helvetica', 'normal');
      doc.text(po.supplierName, margin, currY + 5);
      
      currY += 15;
      doc.setFont('helvetica', 'bold');
      doc.text('PROJECT SITE:', margin, currY);
      doc.setFont('helvetica', 'normal');
      doc.text(po.siteName, margin + 30, currY);

      currY += 15;

      // Table Header
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, currY, 170, 10, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('MATERIAL / DESCRIPTION', margin + 2, currY + 6);
      doc.text('QTY', margin + 60, currY + 6);
      doc.text('RATE', margin + 75, currY + 6);
      doc.text('BASIC', margin + 95, currY + 6);
      doc.text('GST %', margin + 115, currY + 6);
      doc.text('GST AMT', margin + 135, currY + 6);
      doc.text('TOTAL', margin + 168, currY + 6, { align: 'right' });
      
      currY += 10;
      doc.setFont('helvetica', 'normal');
      
      po.items.forEach((item) => {
        if (currY > 260) { doc.addPage(); currY = 30; }
        const basicTotal = item.quantity * item.rate;
        const gstAmount = basicTotal * (item.gstPercent / 100);
        const subtotal = item.amount;
        
        const splitItemName = doc.splitTextToSize(item.itemName, 55);
        doc.text(splitItemName, margin + 2, currY + 5);
        doc.text(item.quantity.toString(), margin + 60, currY + 5);
        doc.text(item.rate.toLocaleString(), margin + 75, currY + 5);
        doc.text(basicTotal.toLocaleString(), margin + 95, currY + 5);
        doc.text(`${item.gstPercent}%`, margin + 115, currY + 5);
        doc.text(gstAmount.toLocaleString(), margin + 135, currY + 5);
        doc.setFont('helvetica', 'bold');
        doc.text(subtotal.toLocaleString(), 210 - margin - 2, currY + 5, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        
        currY += Math.max(10, splitItemName.length * 5 + 2);
        doc.line(margin, currY - 2, 210 - margin, currY - 2);
      });

      // Grand Total
      currY += 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('AGGREGATE PO VALUE:', margin + 60, currY);
      doc.setTextColor(45, 115, 255);
      doc.text(`INR ${po.totalAmount.toLocaleString('en-IN')}`, 210 - margin, currY, { align: 'right' });

      doc.save(`PurchaseOrder_${po.poNumber.replace(/\//g, '_')}.pdf`);
      toast({ title: 'Document Exported', description: 'Official Purchase Order PDF generated.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Export Failed', description: e.message });
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredPOs.length === 0) return;
    const exportData = filteredPOs.map(po => ({
      'PO Number': po.poNumber,
      'Site': po.siteName,
      'Supplier': po.supplierName,
      'Date': po.orderDate,
      'Status': po.status,
      'Amount (INR)': po.totalAmount
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "POs Registry");
    XLSX.writeFile(wb, `POs_Registry_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  if (isProfileLoading || isPOsLoading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-primary" />
            <h1>Manage Purchase Orders</h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium">Organizational overview of all procurement activities and authorizations.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportCSV} variant="outline" className="h-10 rounded-sm font-bold border-primary text-primary hover:bg-primary/5">
            <FileDown className="h-4 w-4 mr-2" /> Export Excel
          </Button>
          <Button onClick={() => router.push('/purchase-orders/create')} className="h-10 rounded-sm font-bold shadow-md px-6">
            <Plus className="h-4 w-4 mr-2" /> New Purchase Order
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search PO, Site or Supplier..." 
            className="pl-10 h-10 text-sm rounded-sm border-primary/20 bg-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-10 text-xs font-bold uppercase tracking-tight rounded-sm border-primary/20 bg-background">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs font-bold uppercase">All Records</SelectItem>
              <SelectItem value="Pending" className="text-xs font-bold uppercase text-amber-600">Pending</SelectItem>
              <SelectItem value="Accepted" className="text-xs font-bold uppercase text-green-600">Accepted</SelectItem>
              <SelectItem value="Rejected" className="text-xs font-bold uppercase text-red-600">Rejected</SelectItem>
              <SelectItem value="Cancelled" className="text-xs font-bold uppercase">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={() => { setSearchTerm(""); setStatusFilter("all"); }} className="h-10 w-10 text-muted-foreground rounded-sm">
            <FilterX className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('poNumber')}>
                    <div className="flex items-center">PO Number <SortIcon column="poNumber" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('site')}>
                    <div className="flex items-center">Project Site <SortIcon column="site" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('supplier')}>
                    <div className="flex items-center">Supplier <SortIcon column="supplier" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('date')}>
                    <div className="flex items-center">Order Date <SortIcon column="date" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('status')}>
                    <div className="flex items-center">Status <SortIcon column="status" /></div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('total')}>
                    <div className="flex items-center justify-end">Total Amount <SortIcon column="total" /></div>
                  </TableHead>
                  <TableHead className="text-right px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPOs.length > 0 ? filteredPOs.map((po) => (
                  <React.Fragment key={po.id}>
                    <TableRow className="hover:bg-muted/5 transition-colors group cursor-pointer" onClick={() => setViewingPO(po)}>
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={(e) => { e.stopPropagation(); toggleRow(po.id); }}>
                            {expandedRows.has(po.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                          <span className="font-mono text-xs font-black text-primary uppercase">{po.poNumber}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-semibold">{po.siteName}</TableCell>
                      <TableCell className="text-xs font-medium text-muted-foreground">{po.supplierName}</TableCell>
                      <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">{po.orderDate}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          "text-[8px] font-black uppercase rounded-sm px-1.5 h-5",
                          po.status === 'Accepted' ? "bg-green-50 text-green-700 border-green-200" :
                          po.status === 'Rejected' ? "bg-red-50 text-red-700 border-red-200" :
                          po.status === 'Pending' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {po.status || 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-black text-sm font-mono text-foreground">
                        ₹{po.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex justify-end items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {isAdmin && po.status === 'Pending' && (
                            <div className="flex gap-1 mr-2">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 rounded-sm hover:bg-green-50" onClick={() => setPoActionState({ po, type: 'Accepted' })} title="Accept PO">
                                <CircleCheck className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 rounded-sm hover:bg-red-50" onClick={() => setPoActionState({ po, type: 'Rejected' })} title="Reject PO">
                                <CircleX className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => setViewingPO(po)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(isAdmin || isManager) && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 rounded-sm" asChild>
                              <Link href={`/projects/${po.siteId}/procurement/${po.id}/edit`}>
                                <Pencil className="h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                          {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => setPoToDelete(po)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(po.id) && po.items && (
                      <TableRow className="bg-muted/20">
                        <TableCell colSpan={7} className="p-0 border-b">
                          <div className="p-6 px-12 space-y-4 animate-in slide-in-from-top-1 duration-200">
                            <div className="flex items-center gap-2 mb-2">
                              <Layers className="h-3.5 w-3.5 text-primary" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-primary">Order Item Breakdown</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                              {po.items.map((item, idx) => (
                                <div key={idx} className="p-3 bg-background border border-primary/10 rounded-sm space-y-2 shadow-sm">
                                  <div className="flex justify-between items-start">
                                    <span className="text-xs font-black text-foreground">{item.itemName}</span>
                                    <Badge variant="outline" className="h-4 px-1 text-[8px] font-black uppercase">Tax {item.gstPercent}%</Badge>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 border-t pt-2">
                                    <div className="flex flex-col">
                                      <span className="text-muted-foreground uppercase font-bold text-[8px]">Qty x Rate</span>
                                      <span className="font-mono font-bold text-[10px]">{item.quantity} x ₹{item.rate.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex flex-col text-right">
                                      <span className="text-muted-foreground uppercase font-bold text-[8px]">Total</span>
                                      <span className="text-primary font-black text-[10px]">₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )) : (
                  <TableRow><TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic">No purchase orders discovered in registry.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* PO Detail Dialog */}
      <Dialog open={!!viewingPO} onOpenChange={(o) => !o && setViewingPO(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-none shadow-2xl bg-background flex flex-col h-[90vh]">
          <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-sm"><ShoppingBag className="h-5 w-5 text-primary" /></div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Purchase Order Audit</DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{viewingPO?.poNumber}</DialogDescription>
              </div>
            </div>
            {viewingPO && (
              <Badge variant="outline" className={cn(
                "rounded-sm text-[10px] font-black uppercase px-2 h-6",
                viewingPO.status === 'Accepted' ? "bg-green-100 text-green-800" : 
                viewingPO.status === 'Pending' ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"
              )}>
                {viewingPO.status}
              </Badge>
            )}
          </DialogHeader>

          <ScrollArea className="flex-1">
            {viewingPO && (
              <div className="p-8 space-y-10 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Supplier Partner</Label>
                      <p className="text-lg font-black text-foreground leading-tight flex items-center gap-2">
                        <Truck className="h-5 w-5 text-primary/40" />
                        {viewingPO.supplierName}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Order Date</Label>
                        <p className="text-sm font-bold flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-primary/40" /> {viewingPO.orderDate}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Project Context</Label>
                        <p className="text-sm font-black flex items-center gap-1.5 text-primary"><Building2 className="h-3.5 w-3.5" /> {viewingPO.siteName}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-primary/5 rounded-sm border-2 border-primary/10 p-6 flex flex-col justify-center items-center text-center shadow-inner">
                    <span className="text-[10px] font-black uppercase text-primary tracking-widest mb-2">Aggregate PO Value</span>
                    <span className="text-4xl font-black tabular-nums text-primary">₹{viewingPO.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <Separator className="opacity-50" />

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Material Breakdown (Financial Detail)</Label>
                  </div>
                  <div className="border rounded-sm overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="text-[10px] font-black uppercase px-4">Material Item</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-center">Qty</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-center">Unit Rate</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-center">Basic Total</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-center">GST %</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-center">GST Amt</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase px-4">Subtotal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewingPO.items.map((item, idx) => {
                          const basic = item.quantity * item.rate;
                          const gstAmt = basic * (item.gstPercent / 100);
                          return (
                            <TableRow key={idx} className="bg-background hover:bg-muted/5 transition-colors">
                              <TableCell className="px-4 text-xs font-bold leading-tight max-w-[200px]">{item.itemName}</TableCell>
                              <TableCell className="text-xs font-mono font-bold text-center">{item.quantity}</TableCell>
                              <TableCell className="text-xs font-mono font-medium text-center">₹{item.rate.toLocaleString()}</TableCell>
                              <TableCell className="text-xs font-mono font-bold text-center">₹{basic.toLocaleString()}</TableCell>
                              <TableCell className="text-xs font-mono font-bold text-center text-muted-foreground">{item.gstPercent}%</TableCell>
                              <TableCell className="text-xs font-mono font-medium text-center text-muted-foreground">₹{gstAmt.toLocaleString()}</TableCell>
                              <TableCell className="text-right px-4 font-mono font-black text-xs text-primary">
                                ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <Separator className="opacity-50" />

                <div className="space-y-6">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-muted-foreground/60">
                    <History className="h-4 w-4 text-primary" /> Lifecycle Audit
                  </h3>
                  <div className="relative border-l-2 border-muted ml-3 pl-6 space-y-8">
                    {[...(viewingPO.history || [])].sort((a, b) => {
                      const da = a.timestamp?.toDate?.()?.getTime() || (typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() : 0);
                      const db = b.timestamp?.toDate?.()?.getTime() || (typeof b.timestamp === 'string' ? new Date(b.timestamp).getTime() : 0);
                      return db - da;
                    }).map((entry, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                        <div className="flex flex-col gap-1 text-left">
                          <span className="text-xs font-bold text-primary uppercase tracking-tight">{entry.action} — {entry.userName}</span>
                          <p className="text-[10px] text-muted-foreground font-mono font-bold uppercase">
                            {formatTimestamp(entry.timestamp)}
                          </p>
                          <p className="text-xs italic text-foreground/80 mt-1 leading-relaxed">"{entry.details || 'Processed.'}"</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {viewingPO.adminRemarks && (
                  <div className={cn(
                    "p-6 rounded-sm border-2 space-y-2 mt-8",
                    viewingPO.status === 'Accepted' ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"
                  )}>
                    <Label className={cn(
                      "text-[10px] font-black uppercase tracking-widest",
                      viewingPO.status === 'Accepted' ? "text-green-700" : "text-red-700"
                    )}>Authority Decision Remarks</Label>
                    <p className="text-sm font-medium italic leading-relaxed text-foreground/80">
                      "{viewingPO.adminRemarks}"
                    </p>
                    <p className="text-[9px] font-bold opacity-40 uppercase pt-2">
                      Processed by {viewingPO.processedByName} on {formatTimestamp(viewingPO.processedAt)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="p-4 bg-muted/5 border-t gap-3 shrink-0 flex items-center justify-between">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="h-10 rounded-sm font-black uppercase text-[10px] tracking-widest border-primary/20 text-primary"
                disabled={isExportingPDF}
                onClick={() => viewingPO && exportToPDF(viewingPO)}
              >
                {isExportingPDF ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
                Download Official PO
              </Button>
            </div>
            
            <div className="flex gap-2 items-center">
              {isAdmin && viewingPO?.status === 'Pending' && (
                <div className="flex gap-2">
                  <Button className="h-10 rounded-sm font-black uppercase text-[10px] tracking-widest bg-green-600 hover:bg-green-700 px-8" onClick={() => { setPoActionState({ po: viewingPO!, type: 'Accepted' }); setViewingPO(null); }}>Approve PO</Button>
                  <Button variant="destructive" className="h-10 rounded-sm font-black uppercase text-[10px] tracking-widest px-8" onClick={() => { setPoActionState({ po: viewingPO!, type: 'Rejected' }); setViewingPO(null); }}>Reject PO</Button>
                </div>
              )}
              <DialogClose asChild><Button variant="outline" className="rounded-sm font-black uppercase text-[10px] h-10 px-10 tracking-widest">Close Audit</Button></DialogClose>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!poActionState} onOpenChange={(o) => !o && setPoActionState(null)}>
        <DialogContent className="rounded-sm max-md">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-tight font-black">Authorize Purchase Order</DialogTitle>
            <DialogDescription>Set decision for {poActionState?.po.poNumber}.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2 text-left">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Decision Remarks</Label>
              <Textarea id="po-action-remarks-global" placeholder="Provide feedback for the procurement request..." className="min-h-[120px] rounded-sm" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" className="rounded-sm font-bold uppercase text-[10px]">Cancel</Button></DialogClose>
            <Button 
              className={cn("min-w-[120px] rounded-sm font-black uppercase text-[10px]", poActionState?.type === 'Accepted' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700")}
              disabled={isActionProcessing}
              onClick={() => {
                const remarks = (document.getElementById('po-action-remarks-global') as HTMLTextAreaElement)?.value || "";
                handleProcessPO(remarks);
              }}
            >
              {isActionProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : `Confirm ${poActionState?.type}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!poToDelete} onOpenChange={(o) => !o && setPoToDelete(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Order?</AlertDialogTitle>
            <AlertDialogDescription>Removing order <strong>{poToDelete?.poNumber}</strong> will erase it from site records and analytics. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePO} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-sm font-bold">Confirm Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, color }: { title: string, value: number, icon: any, color: 'primary' | 'emerald' | 'blue' | 'amber' }) {
  const colors = {
    primary: "bg-primary/5 border-primary/10 text-primary",
    emerald: "bg-emerald-500/5 border-emerald-500/10 text-emerald-600",
    blue: "bg-blue-500/5 border-blue-500/10 text-blue-600",
    amber: "bg-amber-500/5 border-amber-500/10 text-amber-600",
  };

  return (
    <Card className={cn("rounded-sm border shadow-sm", colors[color])}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4">
        <CardTitle className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
        <Icon className="h-3.5 sm:h-4 sm:w-4" />
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0">
        <div className="text-xl sm:text-2xl font-black">{value}</div>
      </CardContent>
    </Card>
  );
}
