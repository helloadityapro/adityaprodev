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
  Gavel, 
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
  History,
  Building2,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { doc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import Link from 'next/link';
import { WorkOrder, UserProfile, WOSortKey } from '../types';

interface WOTabProps {
  projectId: string;
  workOrders: WorkOrder[] | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
}

export function WOTab({ projectId, workOrders, userProfile, isAdmin }: WOTabProps) {
  const firestore = useFirestore();
  const [woSearch, setWoSearch] = React.useState("");
  const [woSortConfig, setWoSortConfig] = React.useState<{ key: WOSortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [expandedWORows, setExpandedWORows] = React.useState<Set<string>>(new Set());
  const [woActionState, setWoActionState] = React.useState<{ wo: WorkOrder, type: 'Accepted' | 'Rejected' } | null>(null);
  const [isActionProcessing, setIsActionProcessing] = React.useState(false);

  const filteredSortedWOs = React.useMemo(() => {
    if (!workOrders) return [];
    let result = workOrders.filter(wo => wo.woNumber.toLowerCase().includes(woSearch.toLowerCase()) || wo.contractorName.toLowerCase().includes(woSearch.toLowerCase()));
    result.sort((a, b) => {
      const { key, direction } = woSortConfig;
      let valA: any = ''; let valB: any = '';
      if (key === 'woNumber') { valA = a.woNumber; valB = b.woNumber; }
      else if (key === 'contractor') { valA = a.contractorName; valB = b.contractorName; }
      else if (key === 'status') { valA = a.status; valB = b.status; }
      else if (key === 'date') { valA = new Date(a.orderDate).getTime(); valB = new Date(b.orderDate).getTime(); }
      else if (key === 'total') { valA = a.totalAmount || 0; valB = b.totalAmount || 0; }
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [workOrders, woSearch, woSortConfig]);

  const handleProcessWO = (remarks: string) => {
    if (!woActionState) return;
    setIsActionProcessing(true);
    const logEntry = { action: woActionState.type === 'Accepted' ? 'Accepted' : 'Rejected', userName: userProfile?.username || 'Admin', userId: userProfile?.id || '', timestamp: new Date(), details: remarks ? `Remarks: ${remarks}` : 'Processed.' };
    updateDocumentNonBlocking(doc(firestore, 'project_wos', woActionState.wo.id), {
      status: woActionState.type, adminRemarks: remarks, processedByName: userProfile?.username || 'Admin', processedAt: serverTimestamp(), updatedAt: serverTimestamp(), history: arrayUnion(logEntry)
    });
    setIsActionProcessing(false);
    setWoActionState(null);
  };

  const WOSortIcon = ({ column }: { column: WOSortKey }) => {
    if (woSortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return woSortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3 text-primary" /> : <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  function handleWOSort(key: WOSortKey) {
    setWoSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  }

  function toggleRow(id: string) {
    const next = new Set(expandedWORows);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedWORows(next);
  }

  return (
    <div className="mt-6 animate-in fade-in duration-300 transition-all space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
        <div className="relative w-full md:w-80"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search WO or Contractor" className="pl-8 h-9 rounded-sm border-primary/20 text-xs" value={woSearch} onChange={e => setWoSearch(e.target.value)} /></div>
        <Button asChild className="rounded-sm font-bold shadow-md h-9"><Link href={`/projects/${projectId}/work-orders/create`}><Plus className="h-4 w-4 mr-2" /> Create WO</Link></Button>
      </div>
      <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handleWOSort('woNumber')}><div className="flex items-center">WO Number <WOSortIcon column="woNumber" /></div></TableHead>
                  <TableHead>Contractor</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Contract Value</TableHead><TableHead className="text-right px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSortedWOs.map(wo => (
                  <React.Fragment key={wo.id}>
                    <TableRow className="hover:bg-muted/5 transition-colors">
                      <TableCell className="px-6 py-4"><div className="flex items-center gap-2"><Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={(e) => { e.stopPropagation(); toggleRow(wo.id); }}>{expandedWORows.has(wo.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button><span className="font-mono text-xs font-black text-primary uppercase">{wo.woNumber}</span></div></TableCell>
                      <TableCell className="text-sm font-semibold">{wo.contractorName}</TableCell><TableCell className="text-[10px] font-bold text-muted-foreground uppercase">{wo.orderDate}</TableCell>
                      <TableCell><Badge variant="outline" className={cn("text-[8px] font-black uppercase rounded-sm px-1.5 h-5", wo.status === 'Accepted' ? "bg-green-50 text-green-700 border-green-200" : "bg-yellow-50 text-yellow-700 border-yellow-200")}>{wo.status || 'Pending'}</Badge></TableCell>
                      <TableCell className="text-right font-black text-sm font-mono text-foreground">₹{wo.totalAmount.toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-right px-6"><div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary rounded-sm"><Link href={`/work-orders/manage?view=${wo.id}`}><Eye className="h-4 w-4" /></Link></Button>
                      </div></TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={!!woActionState} onOpenChange={(o) => !o && setWoActionState(null)}>
        <DialogContent className="rounded-sm max-md">
          <DialogHeader><DialogTitle>Authorize Work Order</DialogTitle></DialogHeader>
          <div className="py-6 space-y-4 text-left"><Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Decision Remarks</Label><Textarea id="wo-action-remarks" placeholder="Provide reason..." className="min-h-[120px] rounded-sm" /></div>
          <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button className={cn("min-w-[120px]", woActionState?.type === 'Accepted' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700")} disabled={isActionProcessing} onClick={() => handleProcessWO((document.getElementById('wo-action-remarks') as HTMLTextAreaElement)?.value || "")}>{isActionProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : `Confirm ${woActionState?.type}`}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}