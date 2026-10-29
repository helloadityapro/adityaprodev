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

export function MovementsTab({ movements }: MovementsTabProps) {
  return (
    <div className="mt-6 animate-in fade-in duration-300">
      <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md text-left">
        <CardHeader className="bg-muted/5 border-b py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold uppercase tracking-widest">Movement Logs</CardTitle>
            </div>
            <Button size="sm" className="h-8 rounded-sm font-black text-[10px] uppercase" asChild><Link href="/inventory/record"><Plus className="h-3.5 w-3.5 mr-1.5" /> Record</Link></Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="px-6">Date</TableHead><TableHead>Type</TableHead><TableHead>Item</TableHead><TableHead className="text-center">Qty</TableHead><TableHead className="text-right px-6">Source/Dest</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements && movements.length > 0 ? movements.map((mov: any) => (
                <TableRow key={mov.id}>
                  <TableCell className="px-6 py-4 font-mono text-[10px] font-bold uppercase">{mov.movementDate}</TableCell>
                  <TableCell><Badge variant="outline" className={cn("text-[9px] font-black uppercase rounded-sm h-5 px-1.5", mov.movementType === 'Inward' ? "bg-green-50 text-green-700 border-green-200" : "bg-blue-50 text-blue-700 border-blue-200")}>{mov.movementType}</Badge></TableCell>
                  <TableCell className="text-sm font-semibold">{mov.itemName}</TableCell>
                  <TableCell className="text-center text-xs font-bold text-primary">{mov.quantity} {mov.unit}</TableCell>
                  <TableCell className="text-right px-6 text-[10px] font-bold text-muted-foreground uppercase">{mov.sourceOrDestination}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">No logs.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
