'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PieChart, Plus, Calendar, User, Search } from 'lucide-react';
import Link from 'next/link';
import { MaterialUtilisation } from '../types';

interface UtilisationTabProps {
  utilisations: MaterialUtilisation[] | null;
}

export function UtilisationTab({ utilisations }: UtilisationTabProps) {
  const [searchTerm, setSearchTerm] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!utilisations) return [];
    return utilisations.filter(u => 
      u.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.remarks.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a: any, b: any) => {
      const da = a.createdAt?.toDate?.()?.getTime() || 0;
      const db = b.createdAt?.toDate?.()?.getTime() || 0;
      return db - da;
    });
  }, [utilisations, searchTerm]);

  return (
    <div className="mt-6 animate-in fade-in duration-300">
      <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden text-left">
        <CardHeader className="bg-muted/5 border-b py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold uppercase tracking-widest">Utilisation Logs</CardTitle>
            </div>
            <div className="flex gap-2">
              <div className="relative w-48 sm:w-64"><Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" /><Input placeholder="Search..." className="pl-7 h-8 text-[10px] rounded-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
              <Button size="sm" className="h-8 rounded-sm font-black text-[10px] uppercase" asChild><Link href="/inventory/utilisation/record"><Plus className="h-3.5 w-3.5 mr-1.5" /> Record</Link></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6">Date</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead>Personnel</TableHead>
                  <TableHead className="text-right px-6">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="px-6 py-4 font-mono text-[10px] font-bold"><div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />{u.utilisationDate}</div></TableCell>
                    <TableCell><div className="flex flex-col"><span className="font-bold text-sm">{u.itemName}</span><span className="text-[10px] font-bold text-muted-foreground uppercase">Inventory Consumption</span></div></TableCell>
                    <TableCell className="text-center"><Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">{u.quantity} {u.unit}</Badge></TableCell>
                    <TableCell><div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase"><User className="h-3 w-3 text-primary" />{u.userName}</div></TableCell>
                    <TableCell className="text-right px-6 text-[10px] font-medium text-muted-foreground italic truncate max-w-[200px]" title={u.remarks}>"{u.remarks}"</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
