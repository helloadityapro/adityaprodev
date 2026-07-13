'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, orderBy, where, limit, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Gavel, 
  Search, 
  FilterX, 
  Eye, 
  Trash2, 
  Calendar,
  Building2,
  HardHat,
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
  FileText,
  ShieldCheck,
  ExternalLink,
  MessageCircle,
  Clock,
  Printer
} from 'lucide-react';
import { format, parse } from 'date-fns';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { slugifyRole } from '@/lib/access-control';

type WOItem = {
  description: string;
  quantity: number;
  rate: number;
  gstPercent: number;
  amount: number;
};

type Attachment = {
  url: string;
  name: string;
  contentType: string;
};

type WorkOrder = {
  id: string;
  woNumber: string;
  siteId: string;
  siteName: string;
  projectCompany?: string;
  contractorName: string;
  contractorAddress?: string;
  contractorGST?: string;
  orderDate: string;
  status: string;
  totalAmount: number;
  totalBasicAmount?: number;
  totalGstAmount?: number;
  items: WOItem[];
  description: string;
  termsAndConditions?: string;
  scopeAttachments?: Attachment[];
  issuerType?: 'Aditya' | 'Client';
  subject?: string;
  createdAt: any;
  createdByName?: string;
  history?: any[];
};

type AccessConfig = {
  id: string;
  ownDataOnly?: boolean;
};

type WOSortKey = 'woNumber' | 'site' | 'contractor' | 'status' | 'date' | 'total';

const formatTimestamp = (ts: any) => {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : (typeof ts === 'string' ? new Date(ts) : ts);
  return format(date, 'dd/MM/yyyy HH:mm');
};

export default function GlobalManageWOsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sortConfig, setSortConfig] = React.useState<{ key: WOSortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());
  const [woToDelete, setWoToDelete] = React.useState<WorkOrder | null>(null);
  const [woActionState, setWoActionState] = React.useState<{ wo: WorkOrder, type: 'Accepted' | 'Rejected' } | null>(null);
  const [viewingWO, setViewingWO] = React.useState<WorkOrder | null>(null);
  const [isActionProcessing, setIsActionProcessing] = React.useState(false);
  const [isExportingPDF, setIsExportingPDF] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<AccessConfig>(roleConfigsQuery);

  const isSuper = isSuperAdmin(user?.email);
  const isAdmin = isSuper || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const wosQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    return query(collection(firestore, 'project_wos'), orderBy('createdAt', 'desc'), limit(500));
  }, [firestore, user, isProfileLoading]);

  const { data: allWOs, isLoading: isWOsLoading } = useCollection<WorkOrder>(wosQuery);

  // Handle deep link via URL view parameter
  React.useEffect(() => {
    const viewId = searchParams.get('view');
    if (viewId && allWOs && allWOs.length > 0) {
      const found = allWOs.find(p => p.id === viewId);
      if (found) {
        setViewingWO(found);
      }
    }
  }, [searchParams, allWOs]);

  const handleSort = (key: WOSortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: WOSortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3 text-primary" /> : <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  const filteredWOs = React.useMemo(() => {
    if (!allWOs || !userProfile) return [];
    
    const isOwnDataOnly = userProfile.ownDataOnly !== undefined 
      ? userProfile.ownDataOnly 
      : roleConfigs?.find(c => c.id === slugifyRole(userProfile.role || ""))?.ownDataOnly ?? false;

    let result = allWOs;

    if (isOwnDataOnly && !isSuper) {
      const assignedIds = new Set(userProfile.assignedProjectIds || []);
      result = result.filter(wo => assignedIds.has(wo.siteId));
    }

    result = result.filter(wo => {
      const matchesSearch = 
        wo.woNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wo.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wo.contractorName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || wo.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });

    result.sort((a, b) => {
      const { key, direction } = sortConfig;
      let valA: any = '';
      let valB: any = '';

      if (key === 'woNumber') { valA = a.woNumber; valB = b.woNumber; }
      else if (key === 'site') { valA = a.siteName; valB = b.siteName; }
      else if (key === 'contractor') { valA = a.contractorName; valB = b.contractorName; }
      else if (key === 'status') { valA = a.status; valB = b.status; }
      else if (key === 'date') { valA = new Date(a.orderDate).getTime(); valB = new Date(b.orderDate).getTime(); }
      else if (key === 'total') { valA = a.totalAmount || 0; valB = b.totalAmount || 0; }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [allWOs, searchTerm, statusFilter, sortConfig, userProfile, roleConfigs, isSuper]);

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  const handleProcessWO = (remarks: string) => {
    if (!woActionState || !userProfile) return;
    setIsActionProcessing(true);
    const logEntry = {
      action: woActionState.type === 'Accepted' ? 'Accepted' : 'Rejected',
      userName: userProfile.username || user?.email || 'Admin',
      userId: user?.uid || '',
      timestamp: new Date(),
      details: remarks ? `Remarks: ${remarks}` : 'Processed without specific remarks.'
    };
    const woRef = doc(firestore, 'project_wos', woActionState.wo.id);
    updateDocumentNonBlocking(woRef, {
      status: woActionState.type,
      adminRemarks: remarks,
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid || '',
      updatedByName: userProfile.username || user?.email || 'Admin',
      history: arrayUnion(logEntry)
    });
    toast({ 
      title: woActionState.type === 'Accepted' ? 'WO Accepted' : 'WO Rejected', 
      description: `Work Order ${woActionState.wo.woNumber} has been updated.` 
    });
    setIsActionProcessing(false);
    setWoActionState(null);
  };

  const handleDeleteWO = async () => {
    if (!woToDelete) return;
    try {
      await deleteDocumentNonBlocking(doc(firestore, 'project_wos', woToDelete.id));
      toast({ title: 'WO Removed', description: 'Work Order record deleted.' });
      setWoToDelete(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const exportToPDF = async (wo: WorkOrder) => {
    setIsExportingPDF(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF('p', 'mm', 'a4');
      const margin = 20;
      const pageWidth = 210;
      const contentWidth = pageWidth - (margin * 2);
      let currY = 30;

      const currencyFormat = (num: number) => num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const toProperCase = (str: string) => str.toLowerCase().replace(/(?:^|\s)\w/g, (match) => match.toUpperCase());

      // Helper for multi-page text handling
      const addMultiLineText = (text: string, x: number, y: number, fontSize: number, fontWeight: 'bold' | 'normal' = 'normal') => {
        doc.setFont('helvetica', fontWeight);
        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(text || 'N/A', contentWidth);
        const lineHeight = fontSize * 0.5; // conversion factor for mm
        
        let localY = y;
        for (let line of lines) {
          if (localY > 275) {
            doc.addPage();
            localY = 30;
          }
          doc.text(line, x, localY);
          localY += lineHeight;
        }
        return localY;
      };

      // Letterhead
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      const letterhead = wo.issuerType === 'Client' ? (wo.projectCompany || 'PROJECT CLIENT') : 'ADITYA GREEN ENERGY PRIVATE LIMITED';
      doc.text(letterhead.toUpperCase(), 105, currY, { align: 'center' });
      
      currY += 8;
      doc.setDrawColor(0);
      doc.setLineWidth(0.4);
      doc.line(margin, currY, pageWidth - margin, currY);

      currY += 7;
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text('WORK ORDER', 105, currY, { align: 'center' });
      
      currY += 3;
      doc.line(margin, currY, pageWidth - margin, currY);

      currY += 12;
      doc.setFont('helvetica', 'bold');
      doc.text(`WO NUMBER: ${wo.woNumber}`, margin, currY);
      doc.text(`DATE: ${wo.orderDate}`, pageWidth - margin, currY, { align: 'right' });
      
      currY += 10;
      doc.text('PROJECT SITE:', margin, currY);
      doc.setFont('helvetica', 'normal');
      doc.text(wo.siteName, margin + 30, currY);

      currY += 10;
      doc.setFont('helvetica', 'bold');
      doc.text('TO:', margin, currY);
      doc.setFont('helvetica', 'normal');
      doc.text(wo.contractorName, margin, currY + 5);
      currY += 5;
      if (wo.contractorAddress) {
        const splitAddr = doc.splitTextToSize(wo.contractorAddress, 80);
        doc.text(splitAddr, margin, currY + 5);
        currY += (splitAddr.length * 5);
      }
      if (wo.contractorGST) {
        doc.setFont('helvetica', 'bold');
        doc.text(`GSTIN: ${wo.contractorGST}`, margin, currY + 5);
        currY += 10;
      }

      if (wo.subject) {
        currY += 5;
        doc.setFont('helvetica', 'bold');
        doc.text('SUBJECT:', margin, currY);
        doc.setFont('helvetica', 'normal');
        const splitSubject = doc.splitTextToSize(toProperCase(wo.subject), contentWidth - 20);
        doc.text(splitSubject, margin + 20, currY);
        currY += (splitSubject.length * 5) + 5;
      }

      currY += 5;

      // Table Header
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, currY, 170, 10, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('DESCRIPTION', margin + 2, currY + 6);
      doc.text('QTY', margin + 62, currY + 6);
      doc.text('RATE', margin + 74, currY + 6);
      doc.text('BASIC', margin + 92, currY + 6);
      doc.text('GST %', margin + 112, currY + 6);
      doc.text('GST AMT', margin + 127, currY + 6);
      doc.text('TOTAL', pageWidth - margin - 2, currY + 6, { align: 'right' });
      
      currY += 10;
      doc.setFont('helvetica', 'normal');
      
      wo.items.forEach((item) => {
        if (currY > 270) { doc.addPage(); currY = 30; }
        const basic = item.quantity * item.rate;
        const gstAmount = basic * (item.gstPercent / 100);
        const sub = item.amount;
        
        const splitItemDesc = doc.splitTextToSize(item.description, 60);
        doc.text(splitItemDesc, margin + 2, currY + 5);
        doc.text(item.quantity.toString(), margin + 62, currY + 5);
        doc.text(item.rate.toLocaleString(undefined, {minimumFractionDigits: 2}), margin + 74, currY + 5);
        doc.text(basic.toLocaleString(undefined, {minimumFractionDigits: 2}), margin + 92, currY + 5);
        doc.text(`${item.gstPercent}%`, margin + 112, currY + 5);
        doc.text(gstAmount.toLocaleString(undefined, {minimumFractionDigits: 2}), margin + 127, currY + 5);
        doc.setFont('helvetica', 'bold');
        doc.text(currencyFormat(sub), pageWidth - margin - 2, currY + 5, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        
        currY += Math.max(10, splitItemDesc.length * 5 + 2);
        doc.line(margin, currY - 2, pageWidth - margin, currY - 2);
      });

      // Financial Summary
      if (currY > 250) { doc.addPage(); currY = 30; }
      currY += 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      
      const totalBasic = wo.totalBasicAmount || wo.items.reduce((s, i) => s + (i.quantity * i.rate), 0);
      const totalGst = wo.totalAmount - totalBasic;

      doc.text('TOTAL BASIC VALUE:', margin + 80, currY);
      doc.text(`Rs ${currencyFormat(totalBasic)}`, pageWidth - margin, currY, { align: 'right' });
      
      currY += 6;
      doc.text('TOTAL GST AMOUNT:', margin + 80, currY);
      doc.text(`Rs ${currencyFormat(totalGst)}`, pageWidth - margin, currY, { align: 'right' });

      currY += 8;
      doc.setFontSize(11);
      doc.text('TOTAL CONTRACT VALUE:', margin + 70, currY);
      doc.setTextColor(45, 115, 255);
      doc.text(`Rs ${currencyFormat(wo.totalAmount)}`, pageWidth - margin, currY, { align: 'right' });

      // Scope of Work
      currY += 15;
      if (currY > 270) { doc.addPage(); currY = 30; }
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('SCOPE OF WORK:', margin, currY);
      currY += 7;
      currY = addMultiLineText(wo.description || 'N/A', margin, currY, 9, 'normal');

      // T&C
      if (wo.termsAndConditions) {
        currY += 10;
        if (currY > 270) { doc.addPage(); currY = 30; }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('TERMS & CONDITIONS:', margin, currY);
        currY += 7;
        currY = addMultiLineText(wo.termsAndConditions, margin, currY, 9, 'normal');
      }

      doc.save(`WorkOrder_${wo.woNumber.replace(/\//g, '_')}.pdf`);
      toast({ title: 'Document Exported', description: 'Official Work Order PDF has been generated.' });
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Export Failed', description: e.message });
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredWOs.length === 0) return;
    const exportData = filteredWOs.map(wo => ({
      'WO Number': wo.woNumber,
      'Site': wo.siteName,
      'Contractor': wo.contractorName,
      'Date': wo.orderDate,
      'Status': wo.status,
      'Amount (INR)': wo.totalAmount
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "WOs Registry");
    XLSX.writeFile(wb, `WOs_Registry_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const triggerWhatsApp = (wo: WorkOrder) => {
    const message = `*Aditya Pro - Work Order Update*\n\n*WO:* ${wo.woNumber}\n*Site:* ${wo.siteName}\n*Contractor:* ${wo.contractorName}\n*Value:* ₹${wo.totalAmount.toLocaleString('en-IN')}\n*Status:* ${wo.status}\n\n*Review Link:* ${window.location.origin}/work-orders/manage?view=${wo.id}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleCloseDetail = () => {
    setViewingWO(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('view');
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`);
  };

  if (isProfileLoading || isWOsLoading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Gavel className="h-6 w-6 text-primary" />
            <h1>Manage Work Orders</h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium">Organizational overview of all service contracts and partner engagements.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportCSV} variant="outline" className="h-10 rounded-sm font-bold border-primary text-primary hover:bg-primary/5">
            <FileDown className="h-4 w-4 mr-2" /> Export Excel
          </Button>
          <Button onClick={() => router.push('/work-orders/create')} className="h-10 rounded-sm font-bold shadow-md px-6">
            <Plus className="h-4 w-4 mr-2" /> New Work Order
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search WO, Site or Contractor..." 
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
              <SelectItem value="all" className="text-xs font-bold uppercase">All Status</SelectItem>
              <SelectItem value="Pending" className="text-xs font-bold uppercase text-amber-600">Pending</SelectItem>
              <SelectItem value="Accepted" className="text-xs font-bold uppercase text-green-600">Accepted</SelectItem>
              <SelectItem value="Rejected" className="text-xs font-bold uppercase text-red-600">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={() => { setSearchTerm(""); setStatusFilter("all"); }} className="h-10 w-10 text-muted-foreground rounded-sm">
            <FilterX className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mobile-Responsive Card List */}
      <div className="md:hidden space-y-4">
        {filteredWOs.length > 0 ? filteredWOs.map((wo) => (
          <Card key={wo.id} className="border-primary/10 rounded-sm shadow-sm overflow-hidden cursor-pointer" onClick={() => setViewingWO(wo)}>
            <CardContent className="p-4 space-y-4">
              <div className="flex justify-between items-start gap-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-col gap-1 min-w-0" onClick={() => setViewingWO(wo)}>
                  <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">{wo.orderDate}</span>
                  <h3 className="font-bold text-sm leading-tight text-foreground truncate">{wo.woNumber}</h3>
                </div>
                <Badge variant="outline" className={cn(
                  "text-[8px] font-black uppercase rounded-sm px-1.5 h-5",
                  wo.status === 'Accepted' ? "bg-green-50 text-green-700 border-green-200" :
                  wo.status === 'Rejected' ? "bg-red-50 text-red-700 border-red-200" :
                  wo.status === 'Pending' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                  "bg-muted text-muted-foreground"
                )}>{wo.status || 'Pending'}</Badge>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  {wo.siteName}
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <HardHat className="h-3.5 w-3.5" />
                  {wo.contractorName}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-primary/5">
                <span className="font-black text-primary text-sm font-mono">₹{wo.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => triggerWhatsApp(wo)}>
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setViewingWO(wo)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )) : (
          <div className="text-center py-12 text-muted-foreground italic bg-muted/5 border-2 border-dashed rounded-sm">No records found.</div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('woNumber')}>
                      <div className="flex items-center">WO Number <SortIcon column="woNumber" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('site')}>
                      <div className="flex items-center">Project Site <SortIcon column="site" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('contractor')}>
                      <div className="flex items-center">Contractor <SortIcon column="contractor" /></div>
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
                  {filteredWOs.length > 0 ? filteredWOs.map((wo) => (
                    <React.Fragment key={wo.id}>
                      <TableRow className="hover:bg-muted/5 transition-colors cursor-pointer group" onClick={() => setViewingWO(wo)}>
                        <TableCell className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={(e) => { e.stopPropagation(); toggleRow(wo.id); }}>
                              {expandedRows.has(wo.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                            <span className="font-mono text-xs font-black text-primary uppercase">{wo.woNumber}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-semibold">{wo.siteName}</TableCell>
                        <TableCell className="text-xs font-medium text-muted-foreground">{wo.contractorName}</TableCell>
                        <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">{wo.orderDate}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            "text-[8px] font-black uppercase rounded-sm px-1.5 h-5",
                            wo.status === 'Accepted' ? "bg-green-50 text-green-700 border-green-200" :
                            wo.status === 'Rejected' ? "bg-red-50 text-red-700 border-red-200" :
                            wo.status === 'Pending' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                            "bg-muted text-muted-foreground"
                          )}>{wo.status || 'Pending'}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-black text-sm font-mono text-foreground">
                          ₹{wo.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <div className="flex justify-end items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {isAdmin && wo.status === 'Pending' && (
                              <div className="flex gap-1 mr-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 rounded-sm hover:bg-green-50" onClick={() => setWoActionState({ wo, type: 'Accepted' })} title="Accept WO">
                                  <CircleCheck className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 rounded-sm hover:bg-red-50" onClick={() => setWoActionState({ wo, type: 'Rejected' })} title="Reject WO">
                                  <CircleX className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 rounded-sm hover:bg-green-50" onClick={() => triggerWhatsApp(wo)}>
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => setViewingWO(wo)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {(isAdmin || isManager) && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 rounded-sm" asChild>
                                <Link href={`/projects/${wo.siteId}/work-orders/${wo.id}/edit`}>
                                  <Pencil className="h-4 w-4" />
                                </Link>
                              </Button>
                            )}
                            {isAdmin && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => setWoToDelete(wo)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedRows.has(wo.id) && wo.items && wo.items.length > 0 && (
                        <TableRow className="bg-muted/20">
                          <TableCell colSpan={7} className="p-0 border-b">
                            <div className="p-6 px-12 space-y-4 animate-in slide-in-from-top-1 duration-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Layers className="h-3.5 w-3.5 text-primary" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Service Breakdown</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {wo.items.map((item, idx) => (
                                  <div key={idx} className="p-3 bg-background border border-primary/10 rounded-sm space-y-2 shadow-sm">
                                    <div className="flex justify-between items-start">
                                      <span className="text-xs font-black text-foreground">{item.description}</span>
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
                    <TableRow><TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic text-xs uppercase font-black text-[10px] opacity-20">No work orders discovered</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* WO Detail Dialog */}
      <Dialog open={!!viewingWO} onOpenChange={(o) => !o && handleCloseDetail()}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-none shadow-2xl bg-background flex flex-col h-[90vh]">
          <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-sm"><Gavel className="h-5 w-5 text-primary" /></div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Work Order Audit</DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{viewingWO?.woNumber}</DialogDescription>
              </div>
            </div>
            {viewingWO && (
              <Badge variant="outline" className={cn(
                "text-[9px] font-black uppercase rounded-sm px-2 h-6",
                viewingWO.status === 'Accepted' ? "bg-green-100 text-green-800" : 
                viewingWO.status === 'Pending' ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"
              )}>
                {viewingWO.status}
              </Badge>
            )}
          </DialogHeader>

          <ScrollArea className="flex-1">
            {viewingWO && (
              <div className="p-8 space-y-10 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Contractor Partner</Label>
                      <p className="text-lg font-black text-foreground leading-tight flex items-center gap-2">
                        <HardHat className="h-5 w-5 text-primary/40" />
                        {viewingWO.contractorName}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Release Date</Label>
                        <p className="text-sm font-bold flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-primary/40" /> {viewingWO.orderDate}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Project Context</Label>
                        <p className="text-sm font-black flex items-center gap-1.5 text-primary"><Building2 className="h-3.5 w-3.5" /> {viewingWO.siteName}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-primary/5 rounded-sm border-2 border-primary/10 p-6 flex flex-col justify-center items-center text-center shadow-inner">
                    <span className="text-[10px] font-black uppercase text-primary tracking-widest mb-2">Total Contract Value</span>
                    <span className="text-4xl font-black tabular-nums text-primary">₹{viewingWO.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <Separator className="opacity-50" />

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Service Breakdown (Financial Detail)</Label>
                  </div>
                  <div className="border rounded-sm overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="text-[10px] font-black uppercase px-4">Service Item</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-center">Qty</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-center">Unit Rate</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-center">Basic Total</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-center">GST %</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-center">GST Amt</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase px-4">Subtotal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewingWO.items.map((item, idx) => {
                          const basic = item.quantity * item.rate;
                          const gstAmt = basic * (item.gstPercent / 100);
                          return (
                            <TableRow key={idx} className="bg-background hover:bg-muted/5 transition-colors">
                              <TableCell className="px-4 text-xs font-bold leading-tight max-w-[200px]">{item.description}</TableCell>
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

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Detailed Scope of Work</Label>
                  </div>
                  <div className="p-5 bg-muted/20 border rounded-sm text-sm leading-relaxed italic text-foreground/80 whitespace-pre-wrap">
                    "{viewingWO.description || 'No detailed scope provided.'}"
                  </div>
                  
                  {viewingWO.scopeAttachments && viewingWO.scopeAttachments.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                      {viewingWO.scopeAttachments.map((att, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 border rounded-sm bg-background group hover:border-primary/30 transition-all">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 bg-muted rounded-sm"><FileText className="h-4 w-4 text-primary" /></div>
                            <span className="text-[10px] font-bold truncate max-w-[150px]" title={att.name}>{att.name}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" asChild>
                            <a href={att.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {viewingWO.termsAndConditions && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Terms & Conditions</Label>
                    </div>
                    <div className="p-5 bg-muted/20 border rounded-sm text-[11px] leading-relaxed text-muted-foreground font-medium whitespace-pre-wrap">
                      {viewingWO.termsAndConditions}
                    </div>
                  </div>
                )}

                <Separator className="opacity-50" />

                <div className="space-y-6">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-muted-foreground/60">
                    <History className="h-4 w-4 text-primary" /> Lifecycle Audit
                  </h3>
                  <div className="relative border-l-2 border-muted ml-3 pl-6 space-y-8">
                    {[...(viewingWO.history || [])].sort((a, b) => {
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

                {viewingWO.adminRemarks && (
                  <div className={cn(
                    "p-6 rounded-sm border-2 space-y-2 mt-8",
                    viewingWO.status === 'Accepted' ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"
                  )}>
                    <Label className={cn(
                      "text-[10px] font-black uppercase tracking-widest",
                      viewingWO.status === 'Accepted' ? "text-green-700" : "text-red-700"
                    )}>Authority Decision Remarks</Label>
                    <p className="text-sm font-medium italic leading-relaxed text-foreground/80">
                      "{viewingWO.adminRemarks}"
                    </p>
                    <p className="text-[9px] font-bold opacity-40 uppercase pt-2">
                      Processed by {viewingWO.processedByName} on {formatTimestamp(viewingWO.processedAt)}
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
                onClick={() => viewingWO && exportToPDF(viewingWO)}
              >
                {isExportingPDF ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
                Export PDF
              </Button>
            </div>
            
            <div className="flex gap-2 items-center">
              {isAdmin && viewingWO?.status === 'Pending' && (
                <div className="flex gap-2">
                  <Button className="h-10 rounded-sm font-black uppercase text-[10px] tracking-widest bg-green-600 hover:bg-green-700 px-8" onClick={() => { setWoActionState({ wo: viewingWO!, type: 'Accepted' }); setViewingWO(null); }}>Approve WO</Button>
                  <Button variant="destructive" className="h-10 rounded-sm font-black uppercase text-[10px] tracking-widest px-8" onClick={() => { setWoActionState({ wo: viewingWO!, type: 'Rejected' }); setViewingWO(null); }}>Reject WO</Button>
                </div>
              )}
              <DialogClose asChild><Button variant="outline" className="rounded-sm font-black uppercase text-[10px] h-10 px-10 tracking-widest">Close Audit</Button></DialogClose>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!woActionState} onOpenChange={(o) => !o && setWoActionState(null)}>
        <DialogContent className="rounded-sm max-md">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-tight font-black">Authorize Work Order</DialogTitle>
            <DialogDescription>Set decision for {woActionState?.wo.woNumber}.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2 text-left">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Decision Remarks</Label>
              <Textarea id="wo-action-remarks-global" placeholder="Provide feedback for the contractor engagement..." className="min-h-[120px] rounded-sm" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" className="rounded-sm font-bold uppercase text-[10px]">Cancel</Button></DialogClose>
            <Button 
              className={cn("min-w-[120px] rounded-sm font-black uppercase text-[10px]", woActionState?.type === 'Accepted' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700")}
              disabled={isActionProcessing}
              onClick={() => {
                const remarks = (document.getElementById('wo-action-remarks-global') as HTMLTextAreaElement)?.value || "";
                handleProcessWO(remarks);
              }}
            >
              {isActionProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : `Confirm ${woActionState?.type}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!woToDelete} onOpenChange={(o) => !o && setWoToDelete(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Work Order?</AlertDialogTitle>
            <AlertDialogDescription>Removing order <strong>{woToDelete?.woNumber}</strong> will erase it from site records and financial logs. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteWO} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-sm font-bold">Confirm Delete</AlertDialogAction>
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
