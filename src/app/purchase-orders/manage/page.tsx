'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, where, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Pencil
} from 'lucide-react';
import { format } from 'date-fns';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
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

type POItem = {
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
};

type POSortKey = 'poNumber' | 'site' | 'supplier' | 'status' | 'date' | 'total';

export default function GlobalManagePOsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sortConfig, setSortConfig] = React.useState<{ key: POSortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());
  const [poToDelete, setPoToDelete] = React.useState<PurchaseOrder | null>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const posQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    return query(collection(firestore, 'project_pos'), orderBy('createdAt', 'desc'), limit(500));
  }, [firestore, user, isProfileLoading]);

  const { data: allPOs, isLoading: isPOsLoading } = useCollection<PurchaseOrder>(posQuery);

  const handleSort = (key: POSortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: POSortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4 text-primary" /> : <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
  };

  const filteredPOs = React.useMemo(() => {
    if (!allPOs) return [];
    
    let result = allPOs.filter(po => {
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
  }, [allPOs, searchTerm, statusFilter, sortConfig]);

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

  const handleExport = () => {
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
          <Button onClick={handleExport} variant="outline" className="h-10 rounded-sm font-bold border-primary text-primary hover:bg-primary/5">
            <FileDown className="h-4 w-4 mr-2" /> Export
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
            <SelectTrigger className="w-[160px] h-10 text-xs font-bold uppercase rounded-sm border-primary/20 bg-background">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs font-bold">All Status</SelectItem>
              <SelectItem value="Open" className="text-xs font-bold">Open</SelectItem>
              <SelectItem value="Approved" className="text-xs font-bold text-green-600">Approved</SelectItem>
              <SelectItem value="Cancelled" className="text-xs font-bold text-red-600">Cancelled</SelectItem>
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
                    <TableRow className="hover:bg-muted/5 transition-colors group">
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => toggleRow(po.id)}>
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
                          po.status === 'Open' ? "bg-blue-50 text-blue-700 border-blue-200" :
                          po.status === 'Approved' ? "bg-green-50 text-green-700 border-green-200" :
                          "bg-red-50 text-red-700 border-red-200"
                        )}>
                          {po.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-black text-sm font-mono text-foreground">
                        ₹{po.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" asChild>
                            <Link href={`/projects/${po.siteId}?tab=po`}><Eye className="h-4 w-4" /></Link>
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4" />
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-2xl font-black">{value}</div>
      </CardContent>
    </Card>
  );
}
