'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeftRight, Plus, Calendar, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { DataItem } from '../types';

interface MovementsTabProps {
  movements: DataItem[] | null;
}

function StatusBadge({ status, className }: { status: string, className?: string }) {
  const config: Record<string, { label: string, color: string }> = {
    Pending: { label: "Pending Acceptance", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
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

export function MovementsTab({ movements }: MovementsTabProps) {
  return (
    <div className="mt-6 animate-in fade-in duration-300">
      <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md text-left">
        <CardHeader className="bg-muted/5 border-b py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold uppercase tracking-widest">Movement Registry Audit</CardTitle>
            </div>
            <Button size="sm" className="h-8 rounded-sm font-black text-[10px] uppercase" asChild><Link href="/inventory/record"><Plus className="h-3.5 w-3.5 mr-1.5" /> Record</Link></Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6">Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Item Details</TableHead>
                  <TableHead className="text-center">Dispatched</TableHead>
                  <TableHead className="text-center">Accepted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right px-6">Source/Dest</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements && movements.length > 0 ? movements.map((mov: any) => (
                  <TableRow key={mov.id} className="hover:bg-muted/5 transition-colors">
                    <TableCell className="px-6 py-4 font-mono text-[10px] font-bold uppercase whitespace-nowrap text-muted-foreground">{mov.movementDate}</TableCell>
                    <TableCell><Badge variant="outline" className={cn("text-[9px] font-black uppercase rounded-sm h-5 px-1.5", mov.movementType === 'Inward' ? "bg-green-50 text-green-700 border-green-200" : "bg-blue-50 text-blue-700 border-blue-200")}>{mov.movementType}</Badge></TableCell>
                    <TableCell>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-black text-foreground truncate max-w-[250px] leading-tight">{mov.itemName}</span>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase mt-1">{mov.userName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs font-black font-mono text-foreground">{mov.quantity} {mov.unit}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {(mov.status === 'Accepted' || mov.status === 'Partially Accepted') ? (
                        <span className="text-xs font-black font-mono text-emerald-700">{mov.acceptedQuantity} {mov.unit}</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/30 italic">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={mov.status || 'Recorded'} />
                        {mov.acceptedByName && (
                          <span className="text-[7px] font-black uppercase text-muted-foreground pl-0.5">By: {mov.acceptedByName}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-primary uppercase leading-tight">{mov.sourceOrDestination}</span>
                        <span className="text-[8px] font-bold text-muted-foreground uppercase">{mov.sourceOrDestinationType}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic uppercase font-black text-[10px] opacity-20 tracking-widest">
                      No movement logs found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
