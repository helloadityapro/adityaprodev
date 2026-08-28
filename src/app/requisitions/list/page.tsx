
'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList, Search, FilterX, Building2, User, Clock, Calendar, CheckCircle2, XCircle, ArrowUpDown, ArrowUp, ArrowDown, ListFilter, Plus, Eye, History, Layers, Trash2, MapPin } from 'lucide-react';
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

type RequisitionItem = {
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
};

type Requisition = {
  id: string;
  siteId: string;
  siteName: string;
  items: RequisitionItem[];
  status: 'Pending' | 'Approved' | 'Rejected' | 'Fulfilled';
  urgency: 'Low' | 'Medium' | 'High';
  neededBy: string;
  remarks?: string;
  userId: string;
  userName: string;
  createdAt: any;
};

type SortKey = 'date' | 'site' | 'urgency' | 'status';

export default function RequisitionsListPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const reqsQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'material_requisitions');
    if (isAdmin) return query(colRef, limit(500));
    return query(colRef, where('userId', '==', user.uid), limit(200));
  }, [firestore, user, isProfileLoading, isAdmin]);

  const { data: requisitions, isLoading: isReqsLoading } = useCollection<Requisition>(reqsQuery);

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

  const handleUpdateStatus = (id: string, status: Requisition['status']) => {
    if (!isAdmin) return;
    updateDocumentNonBlocking(doc(firestore, 'material_requisitions', id), {
      status,
      updatedAt: serverTimestamp(),
      processedByName: userProfile?.username || user?.email
    });
    toast({ title: 'Requisition Updated', description: `Request status set to ${status}.` });
  };

  if (isProfileLoading || isReqsLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            <h1>Material Requisitions</h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium">Track and manage site-level material demands.</p>
        </div>
        <Button asChild className="h-10 rounded-sm font-bold shadow-md px-6">
          <Link href="/requisitions/submit"><Plus className="h-4 w-4 mr-2" /> Raise Requisition</Link>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
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
            <SelectTrigger className="w-[160px] h-10 text-xs font-bold uppercase rounded-sm border-primary/20">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs font-bold uppercase">All Status</SelectItem>
              <SelectItem value="Pending" className="text-xs font-bold uppercase text-amber-600">Pending</SelectItem>
              <SelectItem value="Approved" className="text-xs font-bold uppercase text-green-600">Approved</SelectItem>
              <SelectItem value="Rejected" className="text-xs font-bold uppercase text-red-600">Rejected</SelectItem>
              <SelectItem value="Fulfilled" className="text-xs font-bold uppercase text-emerald-600">Fulfilled</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={() => { setSearchTerm(""); setStatusFilter("all"); }} className="h-10 w-10 text-muted-foreground">
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
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('date')}>
                    <div className="flex items-center">Logged Date <SortIcon column="date" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('site')}>
                    <div className="flex items-center">Project Site <SortIcon column="site" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('urgency')}>
                    <div className="flex items-center">Urgency <SortIcon column="urgency" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('status')}>
                    <div className="flex items-center">Approval Status <SortIcon column="status" /></div>
                  </TableHead>
                  <TableHead>Target Date</TableHead>
                  <TableHead className="text-right px-6">Manage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReqs.length > 0 ? filteredReqs.map((req) => (
                  <React.Fragment key={req.id}>
                    <TableRow className="hover:bg-muted/5 transition-colors cursor-pointer group" onClick={() => toggleExpand(req.id)}>
                      <TableCell className="pl-4">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm">
                          {expandedIds.has(req.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell className="px-6 py-4 font-mono text-[10px] font-bold text-muted-foreground uppercase">
                        {req.createdAt ? format(req.createdAt.toDate(), 'dd MMM yy HH:mm') : '—'}
                      </TableCell>
                      <TableCell className="font-bold text-sm text-foreground">
                        <div className="flex flex-col">
                          <span className="leading-tight">{req.siteName}</span>
                          <span className="text-[9px] text-muted-foreground font-black uppercase tracking-tight">BY: {req.userName}</span>
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
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          "text-[9px] font-black uppercase rounded-sm px-1.5 h-5",
                          req.status === 'Pending' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                          req.status === 'Approved' ? "bg-green-50 text-green-700 border-green-200" :
                          req.status === 'Rejected' ? "bg-red-50 text-red-700 border-red-200" :
                          "bg-emerald-500 text-white border-none"
                        )}>{req.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-muted-foreground">{req.neededBy}</TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                          {isAdmin && req.status === 'Pending' && (
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 rounded-sm hover:bg-green-50" onClick={() => handleUpdateStatus(req.id, 'Approved')}><CheckCircle2 className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 rounded-sm hover:bg-red-50" onClick={() => handleUpdateStatus(req.id, 'Rejected')}><XCircle className="h-4 w-4" /></Button>
                            </div>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm hover:bg-primary/10" onClick={() => toggleExpand(req.id)}><Eye className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedIds.has(req.id) && (
                      <TableRow className="bg-primary/[0.01]">
                        <TableCell colSpan={7} className="p-0 border-b shadow-inner">
                          <div className="p-6 px-20 space-y-6 animate-in slide-in-from-top-1 duration-300">
                             <div className="flex items-center gap-2 border-b pb-2">
                                <Layers className="h-3.5 w-3.5 text-primary" />
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">Required Material Details</h4>
                             </div>
                             
                             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                               {req.items.map((item, idx) => (
                                 <Card key={idx} className="bg-background rounded-sm border-primary/10 shadow-sm overflow-hidden">
                                   <CardContent className="p-4 flex items-center justify-between gap-4">
                                      <div className="flex flex-col min-w-0">
                                        <span className="text-xs font-black text-foreground uppercase tracking-tight truncate" title={item.itemName}>{item.itemName}</span>
                                        <span className="text-[8px] font-bold text-muted-foreground uppercase opacity-60">Master Catalog Item</span>
                                      </div>
                                      <div className="flex flex-col items-end shrink-0">
                                        <span className="text-sm font-black text-primary font-mono">{item.quantity}</span>
                                        <span className="text-[8px] font-bold text-muted-foreground uppercase">{item.unit}</span>
                                      </div>
                                   </CardContent>
                                 </Card>
                               ))}
                             </div>

                             {req.remarks && (
                               <div className="p-4 bg-muted/20 border rounded-sm space-y-2">
                                  <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest px-1">Requester's Narrative</Label>
                                  <p className="text-sm italic font-medium text-foreground/80 leading-relaxed">"{req.remarks}"</p>
                               </div>
                             )}

                             {isAdmin && req.status === 'Approved' && (
                                <div className="flex justify-end pt-2">
                                   <Button size="sm" variant="outline" className="h-8 rounded-sm font-black text-[10px] uppercase border-primary/20 text-primary" onClick={() => handleUpdateStatus(req.id, 'Fulfilled')}>Mark as Fulfilled</Button>
                                </div>
                             )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )) : (
                  <TableRow><TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[10px] opacity-20">No material requisitions discovered in registry</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
