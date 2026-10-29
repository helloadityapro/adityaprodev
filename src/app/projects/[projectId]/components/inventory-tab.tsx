'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Warehouse, 
  History, 
  ChevronUp, 
  ChevronDown, 
  Building2, 
  Clock, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  PieChart 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { InventoryItem, BoMItem, DataItem } from '../types';
import { formatTimestamp } from '../utils';

interface InventoryTabProps {
  inventory: InventoryItem[] | null;
  bomItems: BoMItem[] | null;
  movements: DataItem[] | null;
  utilisations: DataItem[] | null;
}

export function InventoryTab({ inventory, bomItems, movements, utilisations }: InventoryTabProps) {
  const [expandedInvRows, setExpandedInvRows] = React.useState<Set<string>>(new Set());

  const toggleInvRow = (id: string) => {
    const next = new Set(expandedInvRows);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedInvRows(next);
  };

  return (
    <div className="space-y-8 mt-6 animate-in fade-in duration-300">
      <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden text-left">
        <CardHeader className="bg-muted/5 border-b py-4">
          <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2"><Warehouse className="h-4 w-4 text-primary" /> On-Site Inventory Registry</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6 min-w-[250px]">Material / Component</TableHead>
                  <TableHead>Make</TableHead>
                  <TableHead className="text-center">Total Received Stock</TableHead>
                  <TableHead className="text-center">Utilised Stock</TableHead>
                  <TableHead className="text-center">Available Stock</TableHead>
                  <TableHead className="text-right px-6">Logs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory && inventory.length > 0 ? inventory.map(invRecord => {
                  const bomItem = bomItems?.find(i => i.itemName === invRecord.itemName && i.status === 'Approved');
                  const itemMovements = movements?.filter((m: any) => m.itemName === invRecord.itemName) || [];
                  const itemUtilisations = utilisations?.filter((u: any) => u.itemName === invRecord.itemName) || [];
                  const utilised = invRecord.utilisedQuantity || 0;
                  const available = invRecord.stockLevel;
                  const total = utilised + available;

                  return (
                    <React.Fragment key={invRecord.id}>
                      <TableRow className="hover:bg-muted/5 transition-colors group">
                        <TableCell className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => toggleInvRow(invRecord.id)}>
                              {expandedInvRows.has(invRecord.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-sm text-foreground">{invRecord.itemName}</span>
                              <span className="text-[10px] text-muted-foreground line-clamp-1">{bomItem?.specification || 'Site Allocated Asset'}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="secondary" className="rounded-sm text-[9px] font-black uppercase bg-primary/5 text-primary border-primary/10">{bomItem?.make || 'Standard'}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="font-mono font-bold rounded-sm px-3 h-7 bg-primary/5 text-primary border-primary/10">{total} {invRecord.unit}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="secondary" className="font-mono font-bold rounded-sm px-3 h-7 bg-amber-100 text-amber-800 border-amber-200">{utilised} {invRecord.unit}</Badge></TableCell>
                        <TableCell className="text-center"><Badge className={cn("font-mono font-bold rounded-sm px-3 h-7 border-none shadow-sm", available > 0 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600")}>{available} {invRecord.unit}</Badge></TableCell>
                        <TableCell className="text-right px-6"><Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => toggleInvRow(invRecord.id)}>{expandedInvRows.has(invRecord.id) ? <ChevronUp className="h-4 w-4" /> : <History className="h-4 w-4" />}</Button></TableCell>
                      </TableRow>
                      {expandedInvRows.has(invRecord.id) && (
                        <TableRow className="bg-primary/[0.01]">
                          <TableCell colSpan={6} className="p-0 border-b">
                            <div className="p-6 px-12 space-y-8 animate-in slide-in-from-top-1 duration-200 text-left">
                              <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2"><History className="h-3.5 w-3.5 text-primary" /><span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Movement History</span></div>
                                {itemMovements.length > 0 ? (<div className="grid gap-2">{[...itemMovements].sort((a: any, b: any) => (b.createdAt?.toDate?.()?.getTime() || 0) - (a.createdAt?.toDate?.()?.getTime() || 0)).map((m: any) => (<div key={m.id} className="flex items-center justify-between p-3 bg-background border rounded-sm text-[11px] shadow-sm"><div className="flex items-center gap-4"><Badge variant="outline" className={cn("text-[8px] font-black h-5 px-1.5 uppercase", m.movementType === 'Inward' ? "bg-green-50 text-green-700 border-green-200" : "bg-blue-50 text-blue-700 border-blue-200")}>{m.movementType}</Badge><div className="flex flex-col"><span className="font-bold text-foreground">Qty: {m.quantity} {m.unit}</span><span className="text-[9px] text-muted-foreground uppercase">{m.movementType === 'Inward' ? 'From' : 'To'}: {m.sourceOrDestination}</span></div></div><div className="flex flex-col items-end"><span className="font-bold text-muted-foreground uppercase text-[9px]">{m.userName}</span><span className="text-[9px] text-muted-foreground/60">{m.movementDate}</span></div></div>))}</div>) : <p className="text-[10px] text-center text-muted-foreground italic uppercase">No logs.</p>}
                              </div>
                              <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2"><History className="h-3.5 w-3.5 text-amber-600" /><span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">Utilisation History</span></div>
                                {itemUtilisations.length > 0 ? (<div className="grid gap-2">{[...itemUtilisations].sort((a: any, b: any) => (b.createdAt?.toDate?.()?.getTime() || 0) - (a.createdAt?.toDate?.()?.getTime() || 0)).map((u: any) => (<div key={u.id} className="flex items-center justify-between p-3 bg-background border rounded-sm text-[11px] shadow-sm"><div className="flex items-center gap-4"><Badge variant="outline" className="text-[8px] font-black h-5 px-1.5 uppercase bg-amber-50 text-amber-700 border-amber-200"><PieChart className="h-2.5 w-2.5 mr-1" />Utilised</Badge><div className="flex flex-col"><span className="font-bold text-foreground">Qty: {u.quantity} {u.unit}</span><span className="text-[9px] text-muted-foreground italic leading-tight">"{u.remarks}"</span></div></div><div className="flex flex-col items-end"><span className="font-bold text-muted-foreground uppercase text-[9px]">{u.userName}</span><span className="text-[9px] text-muted-foreground/60">{u.utilisationDate}</span></div></div>))}</div>) : <p className="text-[10px] text-center text-muted-foreground italic uppercase">No logs.</p>}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                }) : <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic">Registry empty.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
