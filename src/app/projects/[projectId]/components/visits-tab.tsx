'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { DataItem } from '../types';
import { formatTimestamp } from '../utils';

interface VisitsTabProps {
  visits: DataItem[] | null;
}

export function VisitsTab({ visits }: VisitsTabProps) {
  return (
    <div className="mt-6 animate-in fade-in duration-300 transition-all">
      <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md text-left">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow><TableHead className="px-6">Audit Date</TableHead><TableHead>Manager</TableHead><TableHead>Purpose</TableHead><TableHead className="text-right px-6">Action</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {visits && visits.length > 0 ? visits.map((visit: any) => (
                <TableRow key={visit.id} className="hover:bg-muted/5 group">
                  <TableCell className="px-6 py-4 font-mono text-[10px] font-bold text-muted-foreground uppercase">{formatTimestamp(visit.startTime)}</TableCell>
                  <TableCell className="text-sm font-bold text-foreground">{visit.managerName}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[9px] font-black uppercase rounded-sm">{visit.purpose || '—'}</Badge></TableCell>
                  <TableCell className="text-right px-6"><Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary rounded-sm"><Link href={`/site-visits/${visit.id}`}><ChevronRight className="h-4 w-4" /></Link></Button></TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={4} className="h-32 text-center italic">No records.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
