'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, or, orderBy, limit, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ClipboardList, 
  Search, 
  FilterX, 
  Building2, 
  User, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  ListFilter, 
  Plus, 
  Eye, 
  History, 
  Layers, 
  Trash2, 
  MapPin,
  ChevronUp,
  ChevronDown,
  UserPlus,
  Loader2,
  Check,
  ChevronRight,
  Package
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { isSuperAdmin } from '@/lib/auth-constants';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { slugifyRole } from '@/lib/access-control';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type RequisitionItem = {
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
};

type TimelineEntry = {
  action: string;
  status: string;
  remarks: string;
  userName: string;
  userId: string;
  timestamp: string;
};

type Requisition = {
  id: string;
  siteId: string;
  siteName: string;
  items: RequisitionItem[];
  status: 'Pending' | 'ManagerApproved' | 'Approved' | 'Rejected' | 'Approved & Looking Into It' | 'Ordered' | 'Dispatched' | 'Delivered';
  urgency: 'Low' | 'Medium' | 'High';
  neededBy: string;
  remarks?: string;
  userId: string;
  userName: string;
  siteManagerId: string | null;
  assignedToId?: string;
  assignedToName?: string;
  timeline: TimelineEntry[];
  createdAt: any;
};

type UserProfile = { id: string; username: string; role: string; email: string };
type SortKey = 'date' | 'site' | 'urgency' | 'status';

export default function RequisitionsListPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  
  const [assignTarget, setAssignTarget] = React.useState<Requisition | null>(null);
  const [assignUserSearch, setAssignUserSearch] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [deletingReq, setDeletingReq] = React.useState<Requisition | null>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const reqsQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'material_requisitions');
    if (isAdmin) return query(colRef, limit(500));
    return query(colRef, or(where('userId', '==', user.uid), where('siteManagerId', '==', user.uid), where('assignedToId', '==', user.uid)), limit(500));
  }, [firestore, user, isProfileLoading, isAdmin]);

  const { data: requisitions, isLoading: isReqsLoading } = useCollection<Requisition>(reqsQuery);

  const allUsersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers } = useCollection<UserProfile>(allUsersQuery);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3 text-primary" /> : <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  const filteredReqs = React.useMemo(() => {
    if (!requisitions) return [];
    
    let result = requisitions.filter(r => {
      const matchesSearch = r.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.items.some(i => i.itemName.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    result.sort((a, b) => {
      const { key, direction } = sortConfig;
      let valA: any = ''; let valB: any = '';
      if (key === 'date') { valA = a.createdAt?.toDate?.()?.getTime() || 0; valB = b.createdAt?.toDate?.()?.getTime() || 0; }
      else if (key === 'site') { valA = a.siteName.toLowerCase(); valB = b.siteName.toLowerCase(); }
      else if (key === 'urgency') { valA = a.urgency; valB = b.urgency; }
      else if (key === 'status') { valA = a.status; valB = b.status; }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [requisitions, searchTerm, statusFilter, sortConfig]);

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  const handleUpdateStatus = async (req: Requisition, targetStatus: Requisition['status'], remarks: string) => {
    if (!user || !userProfile) return;
    
    const timelineEntry: TimelineEntry = {
      action: "Status Updated",
      status: targetStatus,
      remarks: remarks || `Requirement moved to ${targetStatus}.`,
      userName: userProfile.username,
      userId: user.uid,
      timestamp: new Date().toISOString()
    };

    updateDocumentNonBlocking(doc(firestore, 'material_requisitions', req.id), {
      status: targetStatus,
      updatedAt: serverTimestamp(),
      timeline: arrayUnion(timelineEntry)
    });

    toast({ title: 'Status Updated', description: `Requisition is now ${targetStatus}.` });
  };

  const handleAssignPerson = async (targetUserId: string) => {
    if (!assignTarget || !user || !userProfile) return;
    setIsProcessing(true);
    
    const targetUser = allUsers?.find(u => u.id === targetUserId);
    const targetStatus = 'Approved & Looking Into It';
    
    const timelineEntry: TimelineEntry = {
      action: "Personnel Assigned",
      status: targetStatus,
      remarks: `Assigned to ${targetUser?.username} for fulfillment.`,
      userName: userProfile.username,
      userId: user.uid,
      timestamp: new Date().toISOString()
    };

    try {
      updateDocumentNonBlocking(doc(firestore, 'material_requisitions', assignTarget.id), {
        status: targetStatus,
        assignedToId: targetUserId,
        assignedToName: targetUser?.username || 'System',
        updatedAt: serverTimestamp(),
        timeline: arrayUnion(timelineEntry)
      });

      toast({ title: 'Assigned Successfully', description: `Request delegated to ${targetUser?.username}.` });
      setAssignTarget(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Assignment Failed', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingReq || !firestore) return;
    try {
      deleteDocumentNonBlocking(doc(firestore, 'material_requisitions', deletingReq.id));
      toast({ title: "Request Removed" });
      setDeletingReq(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete requisition.' });
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
  };

  function StatusBadge({ status, className }: { status: string, className?: string }) {
    const config: Record<string, { label: string, color: string }> = {
      Pending: { label: "Pending Manager", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
      ManagerApproved: { label: "Pending Admin", color: "bg-blue-100 text-blue-800 border-blue-200" },
      Approved: { label: "Approved", color: "bg-green-100 text-green-800 border-green-200" },
      Rejected: { label: "Rejected", color: "bg-red-100 text-red-800 border-red-200" },
      "Approved & Looking Into It": { label: "Looking Into It", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
      Ordered: { label: "Ordered", color: "bg-purple-100 text-purple-800 border-purple-200" },
      Dispatched: { label: "Dispatched", color: "bg-amber-100 text-amber-800 border-amber-200" },
      Delivered: { label: "Delivered", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    };

    const item = config[status] || { label: status, color: "bg-slate-100 text-slate-800 border-slate-200" };

    return (
      <Badge variant="outline" className={cn("rounded-sm text-[10px] font-bold uppercase", item.color, className)}>
        {item.label}
      </Badge>
    );
  }

  const getFulfillmentOptions = () => {
    return ["Approved & Looking Into It", "Ordered", "Dispatched", "Delivered"];
  };

  if (isProfileLoading || isReqsLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-primary" />
              <h1>Material Requisitions</h1>
            </div>
            <p className="text-muted-foreground text-sm font-medium">Lifecycle tracking for site material demands.</p>
          </div>
          <Button asChild className="h-10 rounded-sm font-bold shadow-md px-6">
            <Link href="/requisitions/submit"><Plus className="h-4 w-4 mr-2" /> New Requisition</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm no-print">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by site, material or personnel..." 
            className="pl-10 h-10 text-sm rounded-sm border-primary/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] h-10 text-xs font-bold uppercase rounded-sm border-primary/20">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs font-bold uppercase">All Status</SelectItem>
              <SelectItem value="Pending" className="text-xs font-bold uppercase text-yellow-700">Pending Manager</SelectItem>
              <SelectItem value="ManagerApproved" className="text-xs font-bold uppercase text-blue-700">Pending Admin</SelectItem>
              <SelectItem value="Approved" className="text-xs font-bold uppercase text-green-700">Approved</SelectItem>
              <SelectItem value="Approved & Looking Into It" className="text-xs font-bold uppercase text-indigo-700">Looking Into It</SelectItem>
              <SelectItem value="Ordered" className="text-xs font-bold uppercase text-purple-700">Ordered</SelectItem>
              <SelectItem value="Dispatched" className="text-xs font-bold uppercase text-amber-700">Dispatched</SelectItem>
              <SelectItem value="Delivered" className="text-xs font-bold uppercase text-emerald-700">Delivered</SelectItem>
              <SelectItem value="Rejected" className="text-xs font-bold uppercase text-red-700">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={clearFilters} className="h-10 w-10 text-muted-foreground">
            <FilterX className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <TooltipProvider delayDuration={0}>
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('date')}>
                      <div className="flex items-center">Date <SortIcon column="date" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('site')}>
                      <div className="flex items-center">Site <SortIcon column="site" /></div>
                    </TableHead>
                    <TableHead>Requested Materials</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('urgency')}>
                      <div className="flex items-center">Urgency <SortIcon column="urgency" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('status')}>
                      <div className="flex items-center">Status <SortIcon column="status" /></div>
                    </TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead className="text-right px-6">Manage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReqs.length > 0 ? (
                    filteredReqs.map((req) => {
                      const isOwner = req.userId === user?.uid;
                      const isMgrOfReq = req.siteManagerId === user?.uid && req.status === 'Pending';
                      const canAdminApprove = isAdmin && (req.status === 'ManagerApproved' || (req.status === 'Pending' && !req.siteManagerId));
                      const canAssign = isAdmin && req.status === 'Approved';
                      const isAssigned = req.assignedToId === user?.uid;
                      const canUpdateFulfillment = isAssigned && ["Approved & Looking Into It", "Ordered", "Dispatched", "Delivered"].includes(req.status);

                      const materialsText = req.items.map(i => i.itemName).join(', ');
                      const totalQty = req.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
                      const displayQty = req.items.length === 1 ? `${totalQty} ${req.items[0].unit}` : `${req.items.length} Items`;

                      return (
                        <React.Fragment key={req.id}>
                          <TableRow className={cn("hover:bg-muted/5 transition-colors cursor-pointer group", expandedIds.has(req.id) && "bg-primary/[0.02]")} onClick={() => toggleExpand(req.id)}>
                            <TableCell className="pl-4" onClick={e => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm" onClick={() => toggleExpand(req.id)}>
                                {expandedIds.has(req.id) ? <ChevronUp className="h-4 w-4 text-primary" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </TableCell>
                            <TableCell className="px-6 py-4 font-mono text-[10px] font-bold text-muted-foreground uppercase">
                              {req.createdAt ? format(req.createdAt.toDate(), 'dd MMM yy') : '—'}
                            </TableCell>
                            <TableCell className="font-bold text-sm text-foreground truncate max-w-[150px]">
                               {req.siteName}
                            </TableCell>
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2 max-w-[200px]">
                                    <Package className="h-3.5 w-3.5 text-primary opacity-40 shrink-0" />
                                    <span className="text-xs font-semibold truncate leading-tight">{materialsText}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[300px] p-3 space-y-2">
                                  <p className="text-[10px] font-black uppercase text-primary border-b border-primary/10 pb-1">Line Items</p>
                                  <div className="space-y-1">
                                    {req.items.map((it, i) => (
                                      <div key={i} className="flex justify-between text-[11px] font-medium">
                                        <span>{it.itemName}</span>
                                        <span className="font-bold ml-4">{it.quantity} {it.unit}</span>
                                      </div>
                                    ))}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell className="text-center font-mono font-black text-primary text-xs">
                              {displayQty}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                                <User className="h-3.5 w-3.5 text-primary opacity-40" />
                                <span>{req.userName}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn(
                                "text-[9px] font-black uppercase rounded-sm px-1.5 h-5",
                                req.urgency === 'High' ? "bg-red-50 text-red-700 border-red-200" :
                                req.urgency === 'Medium' ? "bg-amber-50 text-amber-700 border-amber-200" :
                                "bg-blue-50 text-blue-700 border-blue-200"
                              )}>{req.urgency}</Badge>
                            </TableCell>
                            <TableCell><StatusBadge status={req.status} /></TableCell>
                            <TableCell>
                               {req.assignedToName ? (
                                 <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                                   <User className="h-3 w-3" /> {req.assignedToName}
                                 </div>
                               ) : <span className="text-[10px] text-muted-foreground/30 italic uppercase font-bold">Unassigned</span>}
                            </TableCell>
                            <TableCell className="text-right px-6" onClick={e => e.stopPropagation()}>
                              <div className="flex justify-end gap-1">
                                {isMgrOfReq && (
                                  <div className="flex gap-1">
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 rounded-sm hover:bg-green-50" onClick={() => handleUpdateStatus(req, 'ManagerApproved', 'Approved by Manager.')}><CheckCircle2 className="h-4 w-4" /></Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 rounded-sm hover:bg-red-50" onClick={() => handleUpdateStatus(req, 'Rejected', 'Rejected by Manager.')}><XCircle className="h-4 w-4" /></Button>
                                  </div>
                                )}
                                {canAdminApprove && (
                                  <div className="flex gap-1">
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 rounded-sm hover:bg-green-50" onClick={() => handleUpdateStatus(req, 'Approved', 'Final Approved by Admin.')}><CheckCircle2 className="h-4 w-4" /></Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 rounded-sm hover:bg-red-50" onClick={() => handleUpdateStatus(req, 'Rejected', 'Final Rejected by Admin.')}><XCircle className="h-4 w-4" /></Button>
                                  </div>
                                )}
                                {canAssign && (
                                  <Button size="sm" variant="outline" className="h-8 px-3 rounded-sm font-black text-[9px] uppercase border-primary/20 text-primary" onClick={() => setAssignTarget(req)}><UserPlus className="h-3 w-3 mr-1" /> Assign</Button>
                                )}
                                {canUpdateFulfillment && (
                                  <Select defaultValue={req.status} onValueChange={(val: any) => handleUpdateStatus(req, val, `Status updated during fulfillment phase.`)}>
                                    <SelectTrigger className="h-8 w-[130px] text-[10px] font-black uppercase"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {getFulfillmentOptions().map(opt => <SelectItem key={opt} value={opt} className="text-[10px] font-bold uppercase">{opt}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                )}
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm hover:bg-primary/10" onClick={() => toggleExpand(req.id)}><Eye className="h-4 w-4" /></Button>
                                {(isAdmin || (isOwner && req.status === 'Pending')) && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm hover:bg-red-50" onClick={() => setDeletingReq(req)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          {expandedIds.has(req.id) && (
                            <TableRow className="bg-muted/10">
                              <TableCell colSpan={10} className="p-0 border-b">
                                <div className="p-8 px-20 space-y-8 animate-in slide-in-from-top-1 duration-300 text-left">
                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                     <div className="space-y-4">
                                       <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Layers className="h-4 w-4" /> Detailed Material Breakdown</Label>
                                       <div className="grid gap-3">
                                         {req.items.map((item, idx) => (
                                           <div key={idx} className="p-3 bg-background border rounded-sm flex items-center justify-between shadow-sm">
                                             <span className="text-sm font-bold">{item.itemName}</span>
                                             <Badge className="font-mono bg-primary text-white border-none">{item.quantity} {item.unit}</Badge>
                                           </div>
                                         ))}
                                       </div>
                                       {req.remarks && (
                                         <div className="p-4 bg-primary/5 border rounded-sm"><Label className="text-[9px] font-black uppercase text-primary/40 block mb-2">Requester Justification</Label><p className="text-sm italic font-medium leading-relaxed">"{req.remarks}"</p></div>
                                       )}
                                     </div>

                                     <div className="space-y-6">
                                       <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><History className="h-4 w-4" /> Workflow Audit Trail</Label>
                                       <div className="relative border-l-2 border-muted pl-6 space-y-6">
                                          {req.timeline?.map((t, tIdx) => (
                                            <div key={tIdx} className="relative">
                                               <div className="absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                                               <div className="flex flex-col gap-0.5">
                                                  <div className="flex justify-between items-center text-[10px] font-black uppercase"><span className="text-primary">{t.action}</span><span className="text-muted-foreground opacity-50">{format(new Date(t.timestamp), 'dd/MM HH:mm')}</span></div>
                                                  <p className="text-xs font-bold text-foreground">{t.userName}</p>
                                                  <p className="text-xs italic text-muted-foreground leading-relaxed mt-1">"{t.remarks}"</p>
                                               </div>
                                            </div>
                                          ))}
                                       </div>
                                     </div>
                                   </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <TableRow><TableCell colSpan={10} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[10px] opacity-20 tracking-[0.2em]">No material requisitions discovered in registry</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!assignTarget} onOpenChange={(o) => !o && setAssignTarget(null)}>
        <DialogContent className="max-w-md w-[95vw] rounded-sm p-0 overflow-hidden border-none shadow-2xl bg-background flex flex-col h-[70vh] sm:h-auto">
          <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 text-left">
             <DialogTitle className="text-xl font-black uppercase tracking-tight">Assign Fulfillment</DialogTitle>
             <DialogDescription className="text-xs font-medium">Delegate the material collection for {assignTarget?.siteName}.</DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-6 flex-1 flex flex-col min-h-0">
             <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search personnel..." className="pl-10 h-11 rounded-sm border-primary/20" value={assignUserSearch} onChange={e => setAssignUserSearch(e.target.value)} />
             </div>
             <div className="flex-1 border rounded-sm bg-background shadow-inner overflow-hidden">
                <ScrollArea className="h-[250px]">
                  <div className="divide-y">
                    {allUsers?.filter(u => u.username.toLowerCase().includes(assignUserSearch.toLowerCase())).map(u => (
                      <button key={u.id} className="w-full p-4 flex items-center justify-between hover:bg-primary/[0.03] transition-all text-left group" onClick={() => handleAssignPerson(u.id)}>
                         <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold group-hover:text-primary transition-colors">{u.username}</span>
                            <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">{u.role}</span>
                         </div>
                         <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                      </button>
                    ))}
                  </div>
                </ScrollArea>
             </div>
          </div>
          <DialogFooter className="p-4 bg-muted/5 border-t"><DialogClose asChild><Button variant="outline" className="w-full h-11 rounded-sm font-bold uppercase text-[10px]">Cancel</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingReq} onOpenChange={(o) => !o && setDeletingReq(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2 font-black uppercase tracking-tight"><Trash2 className="h-5 w-5" /> Remove Requisition?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium leading-relaxed">
              Are you sure you want to permanently delete the requirement for <strong>{deletingReq?.siteName}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm font-bold uppercase text-[10px] h-10">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90 rounded-sm font-black uppercase text-[10px] h-10 shadow-lg">Confirm Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
