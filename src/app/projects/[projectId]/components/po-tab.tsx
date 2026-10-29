'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  ChevronUp, 
  ChevronDown, 
  Eye, 
  Pencil, 
  Trash2, 
  CircleCheck, 
  CircleX, 
  Layers, 
  Loader2, 
  Clock, 
  User as UserIcon, 
  History,
  Building2,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { doc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { useFirestore, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import Link from 'next/link';
import { PurchaseOrder, MasterItem, UserProfile, POSortKey } from '../types';
import { formatTimestamp } from '../utils';

interface BoMTabProps {
  projectId: string;
  siteName: string;
  bomItems: BoMItem[] | null;
  masterItems: MasterItem[] | null;
  userProfile: UserProfile | null;
  user: any;
  isAdmin: boolean;
  isManager: boolean;
  canManageBom: boolean;
}

const UNITS = ["Numbers", "Kilograms", "Liters", "Meters", "Sets", "Bundles", "Pairs", "Drums"];

export function POTab({ projectId, purchaseOrders, userProfile, isAdmin }: { projectId: string, purchaseOrders: PurchaseOrder[] | null, userProfile: UserProfile | null, isAdmin: boolean }) {
  const firestore = useFirestore();
  const [poSearch, setPoSearch] = React.useState("");
  const [poSortConfig, setPoSortConfig] = React.useState<{ key: POSortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [expandedPORows, setExpandedPORows] = React.useState<Set<string>>(new Set());
  const [poActionState, setPoActionState] = React.useState<{ po: PurchaseOrder, type: 'Accepted' | 'Rejected' } | null>(null);
  const [isActionProcessing, setIsActionProcessing] = React.useState(false);

  const filteredSortedPOs = React.useMemo(() => {
    if (!purchaseOrders) return [];
    let result = purchaseOrders.filter(po => po.poNumber.toLowerCase().includes(poSearch.toLowerCase()) || po.supplierName.toLowerCase().includes(poSearch.toLowerCase()));
    result.sort((a, b) => {
      const { key, direction } = poSortConfig;
      let valA: any = ''; let valB: any = '';
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
  }, [purchaseOrders, poSearch, poSortConfig]);

  const handleProcessPO = (remarks: string) => {
    if (!poActionState) return;
    setIsActionProcessing(true);
    const logEntry = { action: poActionState.type === 'Accepted' ? 'Accepted' : 'Rejected', userName: userProfile?.username || 'Admin', userId: userProfile?.id || '', timestamp: new Date(), details: remarks ? `Remarks: ${remarks}` : 'Processed.' };
    updateDocumentNonBlocking(doc(firestore, 'project_pos', poActionState.po.id), {
      status: poActionState.type, adminRemarks: remarks, processedByName: userProfile?.username || 'Admin', processedAt: serverTimestamp(), updatedAt: serverTimestamp(), history: arrayUnion(logEntry)
    });
    setIsActionProcessing(false);
    setPoActionState(null);
  };

  const POSortIcon = ({ column }: { column: POSortKey }) => {
    if (poSortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return poSortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3 text-primary" /> : <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  function toggleRow(id: string) {
    const next = new Set(expandedPORows);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedPORows(next);
  }

  return (
    <div className="mt-6 animate-in fade-in duration-300 transition-all space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
        <div className="relative w-full md:w-80"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search PO or Supplier" className="pl-8 h-9 rounded-sm border-primary/20 text-xs" value={poSearch} onChange={e => setPoSearch(e.target.value)} /></div>
        <Button asChild className="rounded-sm font-bold shadow-md h-9"><Link href={`/purchase-orders/create?siteId=${projectId}`}><Plus className="h-4 w-4 mr-2" /> Create PO</Link></Button>
      </div>
      <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => setPoSortConfig({key: 'poNumber', direction: poSortConfig.direction === 'asc' ? 'desc' : 'asc'})}><div className="flex items-center">PO Number <POSortIcon column="poNumber" /></div></TableHead>
                  <TableHead>Supplier</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total Value</TableHead><TableHead className="text-right px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSortedPOs.length > 0 ? filteredSortedPOs.map(po => (
                  <React.Fragment key={po.id}>
                    <TableRow className="hover:bg-muted/5 transition-colors">
                      <TableCell className="px-6 py-4"><div className="flex items-center gap-2"><Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={(e) => { e.stopPropagation(); toggleRow(po.id); }}>{expandedPORows.has(po.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button><span className="font-mono text-xs font-black text-primary uppercase">{po.poNumber}</span></div></TableCell>
                      <TableCell className="text-sm font-semibold">{po.supplierName}</TableCell><TableCell className="text-[10px] font-bold text-muted-foreground uppercase">{po.orderDate}</TableCell>
                      <TableCell><Badge variant="outline" className={cn("text-[8px] font-black uppercase rounded-sm px-1.5 h-5", po.status === 'Accepted' ? "bg-green-50 text-green-700 border-green-200" : "bg-yellow-50 text-yellow-700 border-yellow-200")}>{po.status || 'Pending'}</Badge></TableCell>
                      <TableCell className="text-right font-black text-sm font-mono text-foreground">₹{po.totalAmount.toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-right px-6"><div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary rounded-sm"><Link href={`/purchase-orders/manage?view=${po.id}`}><Eye className="h-4 w-4" /></Link></Button>
                      </div></TableCell>
                    </TableRow>
                  </React.Fragment>
                )) : <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic text-xs">Registry empty.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={!!poActionState} onOpenChange={(o) => !o && setPoActionState(null)}>
        <DialogContent className="rounded-sm max-md">
          <DialogHeader><DialogTitle>Authorize Purchase Order</DialogTitle></DialogHeader>
          <div className="py-6 space-y-4 text-left"><Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Decision Remarks</Label><Textarea id="po-action-remarks" placeholder="Provide reason..." className="min-h-[120px] rounded-sm" /></div>
          <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button className={cn("min-w-[120px]", poActionState?.type === 'Accepted' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700")} disabled={isActionProcessing} onClick={() => handleProcessPO((document.getElementById('po-action-remarks') as HTMLTextAreaElement)?.value || "")}>{isActionProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : `Confirm ${poActionState?.type}`}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
