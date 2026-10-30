
'use client';

import * as React from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, orderBy, doc, limit, where, getDocs, writeBatch, increment, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format, subDays, subMonths, subYears } from 'date-fns';
import { 
  Table as TableIcon, 
  Search, 
  FilterX, 
  Clock, 
  MapPin, 
  User as UserIcon, 
  ArrowDownCircle, 
  ArrowUpCircle,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ListFilter,
  FileDown,
  Eye,
  Trash2,
  FileText,
  ExternalLink,
  Building2,
  Truck,
  ShieldCheck,
  History,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { isSuperAdmin } from '@/lib/auth-constants';
import { slugifyRole } from '@/lib/access-control';
import { useToast } from '@/hooks/use-toast';

type Attachment = {
  url: string;
  name: string;
  contentType: string;
};

type Movement = {
  id: string;
  siteId: string;
  sourceOrDestinationId?: string;
  siteName: string;
  itemName: string;
  quantity: number;
  unit: string;
  movementType: 'Inward' | 'Outward';
  sourceOrDestinationType: 'Supplier' | 'Site';
  sourceOrDestination: string;
  movementDate: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  attachments?: Attachment[];
  userName: string;
  userId: string;
  status: 'Pending' | 'Accepted' | 'Partially Accepted' | 'Rejected' | 'Recorded';
  acceptedQuantity?: number;
  rejectedQuantity?: number;
  acceptanceRemarks?: string;
  acceptedById?: string;
  acceptedByName?: string;
  acceptedAt?: any;
  createdAt: any;
};

type SortKey = 'date' | 'site' | 'item' | 'quantity' | 'personnel' | 'flow' | 'createdAt';

export default function MovementDataPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = React.useState("");
  const [siteFilter, setSiteFilter] = React.useState("all");
  const [dateFilter, setDateFilter] = React.useState("7days");
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ 
    key: 'createdAt', 
    direction: 'desc' 
  });

  const [viewingMovement, setViewingMovement] = React.useState<Movement | null>(null);
  const [deletingMovement, setDeletingMovement] = React.useState<Movement | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Inward Acceptance State
  const [processingInward, setProcessingInward] = React.useState<Movement | null>(null);
  const [acceptedQty, setAcceptedQty] = React.useState<string>("");
  const [acceptanceRemarks, setAcceptanceRemarks] = React.useState("");

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<any>(roleConfigsQuery);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<{ name: string, id: string }>(sitesQuery);

  const overridesQuery = useMemoFirebase(() => collection(firestore, 'team_mapping_overrides'), [firestore]);
  const { data: allOverrides, isLoading: overridesLoading } = useCollection<any>(overridesQuery);

  const isSuper = isSuperAdmin(user?.email);
  const isAdmin = isSuper || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const teamQuery = useMemoFirebase(() => {
    if (!isManager || !user) return null;
    return query(collection(firestore, 'users'), where('siteManagerId', '==', user.uid));
  }, [firestore, user, isManager]);
  const { data: teamMembers } = useCollection<any>(teamQuery);

  const accessibleSites = React.useMemo(() => {
    if (!allSites || !userProfile) return [];
    if (isAdmin) return allSites;
    
    const roleId = userProfile.role ? slugifyRole(userProfile.role) : 'none';
    const isOwnDataOnly = userProfile.ownDataOnly !== undefined 
      ? userProfile.ownDataOnly 
      : roleConfigs?.find(c => c.id === roleId)?.ownDataOnly ?? false;

    if (!isOwnDataOnly) return allSites;

    const siteIds = new Set<string>();
    if (isManager) {
      allOverrides?.filter((o: any) => o.managerId === userProfile.id).forEach((o: any) => siteIds.add(o.siteId));
      teamMembers?.forEach(member => {
        (member.assignedProjectIds || []).forEach((sid: string) => {
          const hasOtherOverride = allOverrides?.some((o: any) => o.engineerId === member.id && o.siteId === sid && o.managerId !== userProfile.id);
          if (!hasOtherOverride) siteIds.add(sid);
        });
      });
    } else {
      (userProfile.assignedProjectIds || []).forEach(id => siteIds.add(id));
    }
    return allSites.filter(s => siteIds.has(s.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [allSites, userProfile, roleConfigs, isAdmin, isManager, teamMembers, allOverrides]);

  const accessibleSiteIds = React.useMemo(() => new Set(accessibleSites.map(s => s.id)), [accessibleSites]);

  const dataQuery = useMemoFirebase(() => 
    query(collection(firestore, 'material_movements'), orderBy('createdAt', 'desc'), limit(1000)), 
    [firestore]
  );
  const { data: movements, isLoading } = useCollection<Movement>(dataQuery);

  const queryDateRange = React.useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    
    switch (dateFilter) {
      case 'today':
        return { start: todayStr, end: todayStr };
      case 'yesterday':
        const yesterday = format(subDays(today, 1), 'yyyy-MM-dd');
        return { start: yesterday, end: yesterday };
      case '7days':
        return { start: format(subDays(today, 7), 'yyyy-MM-dd'), end: todayStr };
      case 'lastMonth':
        return { start: format(subMonths(today, 1), 'yyyy-MM-dd'), end: todayStr };
      case 'lastYear':
        return { start: format(subYears(today, 1), 'yyyy-MM-dd'), end: todayStr };
      case 'allTime':
        return { start: '1970-01-01', end: '2099-12-31' };
      default:
        return { start: format(subDays(today, 7), 'yyyy-MM-dd'), end: todayStr };
    }
  }, [dateFilter]);

  const filteredData = React.useMemo(() => {
    if (!movements || !userProfile) return [];
    
    const { start, end } = queryDateRange;
    let result = movements;

    if (!isAdmin) {
      result = result.filter(m => 
        accessibleSiteIds.has(m.siteId) || 
        m.userId === user?.uid ||
        (m.sourceOrDestinationType === 'Site' && accessibleSiteIds.has(m.sourceOrDestinationId || ""))
      );
    }

    result = result.filter(m => {
      const matchesSearch = m.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.sourceOrDestination.toLowerCase().includes(searchTerm.toLowerCase());
      
      const dateMatch = m.movementDate >= start && m.movementDate <= end;
      const matchesSite = siteFilter === 'all' || m.siteName === siteFilter || (m.sourceOrDestinationType === 'Site' && m.sourceOrDestination === siteFilter);
      
      return matchesSearch && dateMatch && matchesSite;
    });

    result.sort((a, b) => {
      const { key, direction } = sortConfig;
      let valA: any = ''; let valB: any = '';
      if (key === 'date') { valA = new Date(a.movementDate).getTime(); valB = new Date(b.movementDate).getTime(); }
      else if (key === 'site') { valA = a.siteName.toLowerCase(); valB = b.siteName.toLowerCase(); }
      else if (key === 'item') { valA = a.itemName.toLowerCase(); valB = b.itemName.toLowerCase(); }
      else if (key === 'quantity') { valA = a.quantity; valB = b.quantity; }
      else if (key === 'personnel') { valA = a.userName.toLowerCase(); valB = b.userName.toLowerCase(); }
      else if (key === 'flow') { valA = a.movementType; valB = b.movementType; }
      else if (key === 'createdAt') { valA = a.createdAt?.toDate?.()?.getTime() || 0; valB = b.createdAt?.toDate?.()?.getTime() || 0; }
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [movements, searchTerm, siteFilter, queryDateRange, sortConfig, isAdmin, accessibleSiteIds, user, userProfile]);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3.5 w-3.5 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3.5 w-3.5 text-primary" /> : <ArrowDown className="ml-2 h-3.5 w-3.5 text-primary" />;
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSiteFilter("all");
    setDateFilter("7days");
  };

  const handleProcessInward = async (action: 'Accepted' | 'Rejected') => {
    if (!processingInward || !user || !userProfile) return;
    setIsProcessing(true);

    try {
      const acceptedValue = action === 'Accepted' ? parseFloat(acceptedQty || "0") : 0;
      const rejectedValue = processingInward.quantity - acceptedValue;
      
      if (action === 'Accepted' && acceptedValue > processingInward.quantity) {
          toast({ variant: 'destructive', title: 'Invalid Quantity', description: 'Accepted quantity cannot exceed dispatched amount.' });
          setIsProcessing(false);
          return;
      }

      if (acceptedValue < processingInward.quantity && !acceptanceRemarks.trim()) {
          toast({ variant: 'destructive', title: 'Remarks Required', description: 'Please explain the quantity deviation or rejection reason.' });
          setIsProcessing(false);
          return;
      }

      const finalStatus = action === 'Rejected' ? 'Rejected' : (acceptedValue === processingInward.quantity ? 'Accepted' : 'Partially Accepted');

      const batch = writeBatch(firestore);

      // 1. Update Site B (Destination) - Increase by accepted quantity
      if (acceptedValue > 0 && processingInward.sourceOrDestinationId) {
          const bInvQ = query(collection(firestore, 'project_inventory'), where('siteId', '==', processingInward.sourceOrDestinationId), where('itemName', '==', processingInward.itemName));
          const bSnap = await getDocs(bInvQ);
          if (!bSnap.empty) {
              batch.update(bSnap.docs[0].ref, {
                  stockLevel: increment(acceptedValue),
                  lastUpdated: serverTimestamp()
              });
          } else {
              const newRef = doc(collection(firestore, 'project_inventory'));
              batch.set(newRef, {
                  siteId: processingInward.sourceOrDestinationId,
                  siteName: processingInward.sourceOrDestination,
                  itemName: processingInward.itemName,
                  stockLevel: acceptedValue,
                  unit: processingInward.unit,
                  lastUpdated: serverTimestamp()
              });
          }
      }

      // 2. Update Site A (Source) - Restore rejected quantity
      if (rejectedValue > 0) {
          const aInvQ = query(collection(firestore, 'project_inventory'), where('siteId', '==', processingInward.siteId), where('itemName', '==', processingInward.itemName));
          const aSnap = await getDocs(aInvQ);
          if (!aSnap.empty) {
              batch.update(aSnap.docs[0].ref, {
                  stockLevel: increment(rejectedValue),
                  lastUpdated: serverTimestamp()
              });
          }
      }

      // 3. Update movement record
      batch.update(doc(firestore, 'material_movements', processingInward.id), {
          status: finalStatus,
          acceptedQuantity: acceptedValue,
          rejectedQuantity: rejectedValue,
          acceptanceRemarks: acceptanceRemarks,
          acceptedById: user.uid,
          acceptedByName: userProfile.username,
          acceptedAt: serverTimestamp()
      });

      await batch.commit();

      toast({ title: 'Transfer Finalized', description: `Material ${finalStatus.toLowerCase()} and stock reconciled.` });
      setProcessingInward(null);
      setAcceptedQty("");
      setAcceptanceRemarks("");
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteMovement = async () => {
    if (!deletingMovement) return;
    setIsProcessing(true);
    try {
      const adjustment = deletingMovement.movementType === 'Inward' ? -deletingMovement.quantity : deletingMovement.quantity;

      const invQ = query(
        collection(firestore, 'project_inventory'),
        where('siteId', '==', deletingMovement.siteId),
        where('itemName', '==', deletingMovement.itemName)
      );
      const invSnap = await getDocs(invQ);

      const batch = writeBatch(firestore);

      if (!invSnap.empty) {
        const invDoc = invSnap.docs[0];
        batch.update(invDoc.ref, {
          stockLevel: increment(adjustment),
          lastUpdated: serverTimestamp()
        });
      }

      batch.delete(doc(firestore, 'material_movements', deletingMovement.id));
      
      await batch.commit();

      toast({ title: 'Record Removed', description: 'Log deleted and site stock reconciled.' });
      setDeletingMovement(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = () => {
    if (filteredData.length === 0) return;
    const exportData = filteredData.map(m => ({
      'Date': m.movementDate,
      'Project Site': m.siteName,
      'Flow': m.movementType,
      'Item Name': m.itemName,
      'Quantity': m.quantity,
      'Unit': m.unit,
      'Status': m.status || 'Recorded',
      'Source/Destination': m.sourceOrDestination,
      'Personnel': m.userName,
      'Acceptance Personnel': m.acceptedByName || '—',
      'Log Timestamp': m.createdAt ? format(m.createdAt.toDate(), 'dd/MM/yyyy HH:mm:ss') : 'N/A'
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Material Movements");
    XLSX.writeFile(wb, `Material_Movements_Registry_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  if (isLoading || isProfileLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-[500px] w-full" /></div>;

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
            <TableIcon className="h-6 w-6 md:h-8 md:w-8" /> Global Movement Data
          </h1>
          <p className="text-muted-foreground font-medium text-xs md:text-sm leading-relaxed">Chronological history of material transactions and inter-site transfers.</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="h-10 rounded-sm font-bold border-primary text-primary hover:bg-primary/5 shadow-sm px-6">
          <FileDown className="h-4 w-4 mr-2" />
          Export to Excel
        </Button>
      </div>

      <div className="flex flex-col gap-4 bg-card p-3 md:p-4 border border-primary/10 rounded-sm shadow-sm no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search material or personnel..." className="pl-10 h-10 text-sm rounded-sm border-primary/20 bg-background" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1 md:flex-none">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-full md:w-[140px] h-10 text-xs font-bold uppercase rounded-sm border-primary/20 bg-background"><Calendar className="h-3.5 w-3.5 mr-2 opacity-50" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today" className="text-xs font-bold uppercase">Today</SelectItem>
                  <SelectItem value="yesterday" className="text-xs font-bold uppercase">Yesterday</SelectItem>
                  <SelectItem value="7days" className="text-xs font-bold uppercase">Last 7 Days</SelectItem>
                  <SelectItem value="lastMonth" className="text-xs font-bold uppercase">Last Month</SelectItem>
                  <SelectItem value="lastYear" className="text-xs font-bold uppercase">Last Year</SelectItem>
                  <SelectItem value="allTime" className="text-xs font-bold uppercase">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 md:flex-none">
              <Select value={siteFilter} onValueChange={setSiteFilter}>
                <SelectTrigger className="w-full md:w-[180px] h-10 text-xs font-bold uppercase rounded-sm border-primary/20 bg-background">
                  <ListFilter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="All Sites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs font-bold uppercase">All Accessible Sites</SelectItem>
                  {accessibleSites.map(site => (
                    <SelectItem key={site.id} value={site.name} className="text-xs font-bold uppercase">{site.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Badge variant="outline" className="rounded-sm font-black uppercase text-[10px] tracking-widest px-3 h-10 border-primary/20 text-primary bg-primary/5 hidden sm:flex">
              {filteredData.length} Records
            </Badge>
            <Button variant="ghost" size="icon" onClick={clearFilters} className="h-10 w-10 text-muted-foreground rounded-sm"><FilterX className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="md:hidden space-y-4">
          {filteredData.length > 0 ? filteredData.map((m) => {
            const isIncomingForMe = m.movementType === 'Outward' && m.sourceOrDestinationType === 'Site' && accessibleSiteIds.has(m.sourceOrDestinationId || '') && m.status === 'Pending';
            return (
              <Card key={m.id} className={cn("border-primary/10 rounded-sm shadow-sm overflow-hidden animate-in fade-in duration-300", isIncomingForMe && "ring-2 ring-amber-500/50 bg-amber-50/10")}>
                <CardContent className="p-4 space-y-4" onClick={() => setViewingMovement(m)}>
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-[10px] font-mono font-black text-primary uppercase flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {m.createdAt ? format(m.createdAt.toDate(), 'dd MMM, HH:mm') : '—'}
                      </span>
                      <h3 className="font-bold text-sm text-foreground leading-tight whitespace-normal break-words">{m.itemName}</h3>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="outline" className={cn("text-[8px] font-black uppercase rounded-sm px-2 h-5 shrink-0", m.movementType === 'Inward' ? "bg-green-50 text-green-700 border-green-200" : "bg-blue-50 text-blue-700 border-blue-200")}>
                        {m.movementType}
                      </Badge>
                      {m.status && <StatusBadge status={m.status} />}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-black uppercase text-muted-foreground tracking-tighter">Project Site</span>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-foreground">
                        <Building2 className="h-3 w-3 text-primary opacity-40" />
                        <span className="truncate">{m.siteName}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-black uppercase text-muted-foreground tracking-tighter">Quantity</span>
                      <span className="text-xs font-black text-primary font-mono">{m.quantity} {m.unit}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-primary/5 flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[8px] font-black uppercase text-muted-foreground tracking-tighter">{m.movementType === 'Inward' ? 'Received From' : 'Sent To'}</span>
                      <span className="text-[10px] font-bold text-foreground truncate max-w-[140px]">{m.sourceOrDestination}</span>
                    </div>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      {isIncomingForMe && (
                        <Button variant="default" size="sm" className="h-8 rounded-sm font-black text-[9px] uppercase px-3 bg-amber-600 hover:bg-amber-700" onClick={() => { setProcessingInward(m); setAcceptedQty(m.quantity.toString()); }}>
                           Process
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm hover:bg-primary/10" onClick={() => setViewingMovement(m)} title="View Detail">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          }) : (
            <div className="text-center py-20 text-muted-foreground italic text-xs uppercase font-bold border-2 border-dashed rounded-sm opacity-30">No logs found matching filters.</div>
          )}
        </div>

        <div className="hidden md:block">
          <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('createdAt')}>
                        <div className="flex items-center">Log Timestamp <SortIcon column="createdAt" /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('date')}>
                        <div className="flex items-center">Movement Date <SortIcon column="date" /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('site')}>
                        <div className="flex items-center">Project Site <SortIcon column="site" /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('flow')}>
                        <div className="flex items-center">Flow <SortIcon column="flow" /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('item')}>
                        <div className="flex items-center">Item Details <SortIcon column="item" /></div>
                      </TableHead>
                      <TableHead className="text-center cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('quantity')}>
                        <div className="flex items-center justify-center">Quantity <SortIcon column="quantity" /></div>
                      </TableHead>
                      <TableHead>Acceptance Status</TableHead>
                      <TableHead className="text-right px-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.length > 0 ? filteredData.map((m) => {
                      const isIncomingForMe = m.movementType === 'Outward' && m.sourceOrDestinationType === 'Site' && accessibleSiteIds.has(m.sourceOrDestinationId || '') && m.status === 'Pending';
                      return (
                        <TableRow key={m.id} className={cn("hover:bg-muted/5 transition-colors", isIncomingForMe && "bg-amber-50/30")}>
                          <TableCell className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-[10px] font-mono font-black text-primary uppercase">
                              <Clock className="h-3 w-3" />
                              {m.createdAt ? format(m.createdAt.toDate(), 'dd MMM, HH:mm') : '—'}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs font-bold text-muted-foreground whitespace-nowrap"><div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />{m.movementDate}</div></TableCell>
                          <TableCell className="font-bold text-sm text-foreground"><div className="flex items-center gap-2"><MapPin className="h-3 w-3 text-primary" />{m.siteName}</div></TableCell>
                          <TableCell><Badge variant="outline" className={cn("text-[9px] font-black uppercase rounded-sm px-2 h-5", m.movementType === 'Inward' ? "bg-green-50 text-green-700 border-green-200" : "bg-blue-50 text-blue-700 border-blue-200")}>{m.movementType}</Badge></TableCell>
                          <TableCell className="whitespace-normal break-words max-w-[250px]">
                            <div className="flex flex-col">
                              <span className="font-bold text-sm text-foreground leading-tight">{m.itemName}</span>
                              <span className="text-[9px] font-bold text-muted-foreground uppercase mt-1">{m.sourceOrDestination}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-black text-primary font-mono text-sm">{m.quantity} {m.unit}</TableCell>
                          <TableCell>
                            {m.status && <StatusBadge status={m.status} />}
                            {m.acceptedByName && <p className="text-[7px] font-black uppercase text-muted-foreground mt-1">By: {m.acceptedByName}</p>}
                          </TableCell>
                          <TableCell className="text-right px-6 whitespace-nowrap">
                            <div className="flex justify-end items-center gap-1">
                              {isIncomingForMe && (
                                <Button variant="default" size="sm" className="h-8 rounded-sm font-black text-[9px] uppercase px-3 bg-amber-600 hover:bg-amber-700 shadow-sm" onClick={() => { setProcessingInward(m); setAcceptedQty(m.quantity.toString()); }}>
                                   Process Inward
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm hover:bg-primary/10" onClick={() => setViewingMovement(m)} title="View Details">
                                <Eye className="h-4 w-4" />
                              </Button>
                              {(isAdmin || m.userId === user?.uid) && m.status === 'Pending' && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm hover:bg-red-50" onClick={() => setDeletingMovement(m)} title="Delete Record">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }) : <TableRow><TableCell colSpan={8} className="h-48 text-center text-muted-foreground italic">No logs found.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Inward Acceptance Dialog */}
      <Dialog open={!!processingInward} onOpenChange={(o) => !o && setProcessingInward(null)}>
        <DialogContent className="max-w-md w-[95vw] p-0 overflow-hidden border-none shadow-2xl bg-background flex flex-col rounded-sm">
          <DialogHeader className="p-6 bg-amber-500/10 border-b shrink-0 text-left">
            <div className="flex items-center gap-3">
              <div className="bg-amber-500/20 p-2 rounded-sm"><ArrowDownCircle className="h-6 w-6 text-amber-600" /></div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Inward Acceptance</DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-amber-700 uppercase">Process incoming dispatch from {processingInward?.siteName}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-6 text-left">
            <div className="space-y-1">
               <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Material Item</Label>
               <p className="text-base font-black text-foreground leading-tight">{processingInward?.itemName}</p>
               <p className="text-xs font-bold text-primary">Dispatched Qty: {processingInward?.quantity} {processingInward?.unit}</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Accepted Quantity ({processingInward?.unit})</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={acceptedQty} 
                  onChange={e => setAcceptedQty(e.target.value)} 
                  className="h-12 text-lg font-mono font-black border-primary/20"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Remarks / Observation</Label>
                <Textarea 
                  placeholder={parseFloat(acceptedQty) < (processingInward?.quantity || 0) ? "Mandatory: Explain the quantity deviation..." : "Add any site notes..."}
                  value={acceptanceRemarks}
                  onChange={e => setAcceptanceRemarks(e.target.value)}
                  className="min-h-[100px] text-sm"
                />
              </div>
            </div>

            {parseFloat(acceptedQty) < (processingInward?.quantity || 0) && (
              <Alert variant="destructive" className="bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-[10px] font-black uppercase">Stock Reconciliation</AlertTitle>
                <AlertDescription className="text-[10px]">
                  The rejected portion ({(processingInward!.quantity - parseFloat(acceptedQty || "0")).toFixed(2)} {processingInward?.unit}) will be automatically restored to the source site's inventory.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="p-4 bg-muted/5 border-t gap-3 shrink-0 flex flex-col sm:flex-row">
            <Button variant="ghost" className="w-full sm:flex-1 h-11 font-bold uppercase text-[10px]" onClick={() => handleProcessInward('Rejected')} disabled={isProcessing}>
               Full Rejection
            </Button>
            <Button 
              className="w-full sm:flex-1 h-11 font-black uppercase text-[10px] bg-amber-600 hover:bg-amber-700 shadow-lg" 
              onClick={() => handleProcessInward('Accepted')}
              disabled={isProcessing || !acceptedQty || parseFloat(acceptedQty) <= 0}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Finalize Inward
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingMovement} onOpenChange={(o) => !o && setViewingMovement(null)}>
        <DialogContent className="max-w-2xl w-[95vw] p-0 overflow-hidden border-none rounded-sm shadow-2xl bg-background flex flex-col">
          <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 flex flex-row items-center justify-between space-y-0 text-left">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-sm"><History className="h-5 w-5 text-primary" /></div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Movement Audit Detail</DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Logged by {viewingMovement?.userName}</DialogDescription>
              </div>
            </div>
            {viewingMovement && <StatusBadge status={viewingMovement.status || 'Recorded'} />}
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            {viewingMovement && (
              <div className="p-8 space-y-10 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Material Item</Label>
                      <p className="text-lg font-black text-foreground leading-tight whitespace-normal break-words">{viewingMovement.itemName}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Dispatched Qty</Label>
                        <p className="text-sm font-black text-primary font-mono">{viewingMovement.quantity} {viewingMovement.unit}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Movement Date</Label>
                        <p className="text-sm font-bold flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-primary/40" /> {viewingMovement.movementDate}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-primary/5 rounded-sm border-2 border-primary/10 p-6 flex flex-col justify-center gap-4 shadow-inner">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-primary tracking-widest">Site Context</p>
                      <p className="text-sm font-black flex items-center gap-1.5 leading-tight"><Building2 className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{viewingMovement.siteName}</span></p>
                    </div>
                    <Separator className="opacity-10" />
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-primary tracking-widest">
                        {viewingMovement.movementType === 'Inward' ? 'Source (From)' : 'Destination (To)'}
                      </p>
                      <p className="text-sm font-black flex items-center gap-1.5 leading-tight">
                        {viewingMovement.sourceOrDestinationType === 'Site' ? <MapPin className="h-3.5 w-3.5 shrink-0" /> : <Truck className="h-3.5 w-3.5 shrink-0" />}
                        <span className="truncate">{viewingMovement.sourceOrDestination}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {viewingMovement.status !== 'Pending' && viewingMovement.status !== 'Recorded' && (
                  <div className="p-6 bg-muted/20 border-2 rounded-sm space-y-4">
                     <Label className="text-[10px] font-black uppercase text-primary tracking-[0.2em] flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" /> Inward Acceptance Audit
                     </Label>
                     <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-1">
                           <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Accepted</p>
                           <p className="text-sm font-black text-emerald-600">{viewingMovement.acceptedQuantity} {viewingMovement.unit}</p>
                        </div>
                        <div className="space-y-1">
                           <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Rejected / Short</p>
                           <p className="text-sm font-black text-red-600">{viewingMovement.rejectedQuantity} {viewingMovement.unit}</p>
                        </div>
                     </div>
                     <div className="pt-2 border-t border-border/50">
                        <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest mb-1">Acceptance Remarks</p>
                        <p className="text-xs font-medium italic text-foreground/80 leading-relaxed">"{viewingMovement.acceptanceRemarks || 'N/A'}"</p>
                     </div>
                     <div className="flex justify-between items-center pt-2 text-[8px] font-black uppercase text-muted-foreground/60">
                        <span>Processed by {viewingMovement.acceptedByName}</span>
                        <span>{viewingMovement.acceptedAt ? format(viewingMovement.acceptedAt.toDate(), 'dd MMM yyyy HH:mm') : ''}</span>
                     </div>
                  </div>
                )}

                <div className="pt-6 border-t flex flex-col gap-2">
                   <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                     <UserIcon className="h-3 w-3" /> 
                     Logged By: <span className="text-foreground">{viewingMovement.userName}</span>
                   </div>
                   <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                     <Clock className="h-3 w-3" /> 
                     System Timestamp: <span className="text-foreground font-mono">{viewingMovement.createdAt ? format(viewingMovement.createdAt.toDate(), 'dd MMM yyyy, HH:mm:ss') : '—'}</span>
                   </div>
                </div>
              </div>
            )}
          </ScrollArea>
          <DialogFooter className="p-4 bg-muted/5 border-t shrink-0">
            <DialogClose asChild><Button variant="outline" className="rounded-sm font-black uppercase text-[10px] h-11 px-8 tracking-widest w-full sm:w-auto">Close Audit</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingMovement} onOpenChange={(o) => !o && setDeletingMovement(null)}>
        <AlertDialogContent className="rounded-sm max-w-md w-[95vw]">
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle className="text-destructive font-black uppercase tracking-tight flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Delete Material Log?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium leading-relaxed">
              Are you sure you want to permanently remove this {deletingMovement?.movementType.toLowerCase()} log for <strong>{deletingMovement?.itemName}</strong>? This action cannot be reversed and may lead to inventory discrepancies if not manually adjusted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 flex flex-col sm:flex-row pt-4 border-t mt-4">
            <AlertDialogCancel className="rounded-sm font-bold uppercase text-[10px] h-11 flex-1">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMovement} disabled={isProcessing} className="bg-destructive text-white hover:bg-destructive/90 rounded-sm font-bold uppercase text-[10px] h-11 flex-1 shadow-lg">
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Deletion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusBadge({ status, className }: { status: string, className?: string }) {
    const config: Record<string, { label: string, color: string }> = {
      Pending: { label: "Pending Acceptance", color: "bg-amber-100 text-amber-800 border-amber-200" },
      Accepted: { label: "Accepted", color: "bg-green-100 text-green-800 border-green-200" },
      "Partially Accepted": { label: "Partially Accepted", color: "bg-blue-100 text-blue-800 border-blue-200" },
      Rejected: { label: "Rejected", color: "bg-red-100 text-red-800 border-red-200" },
      Recorded: { label: "Recorded", color: "bg-slate-100 text-slate-800 border-slate-200" },
    };

    const item = config[status] || { label: status, color: "bg-slate-100 text-slate-800 border-slate-200" };

    return (
      <Badge variant="outline" className={cn("rounded-sm text-[8px] font-black uppercase h-5 px-1.5", item.color, className)}>
        {item.label}
      </Badge>
    );
}
