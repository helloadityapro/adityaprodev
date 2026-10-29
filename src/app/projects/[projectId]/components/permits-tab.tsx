'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { DataItem } from '../types';
import { formatTimestamp } from '../utils';

interface PermitsTabProps {
  permits: DataItem[] | null;
}

export function PermitsTab({ permits }: PermitsTabProps) {
  return (
    <div className="mt-6 animate-in fade-in duration-300 transition-all">
      <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md text-left">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="px-6">Serial No</TableHead><TableHead>Type</TableHead><TableHead>Engineer</TableHead><TableHead>Status</TableHead><TableHead className="text-right px-6">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permits && permits.length > 0 ? permits.map((permit: any) => (
                <TableRow key={permit.id}>
                  <TableCell className="px-6 py-4 font-mono text-xs font-bold text-primary uppercase">{permit.serialNumber || permit.id.slice(0, 8)}</TableCell>
                  <TableCell className="text-sm font-semibold">{permit.ptwType}</TableCell>
                  <TableCell className="text-xs font-medium">{permit.siteEngineerName || '—'}</TableCell>
                  <TableCell><Badge variant="outline" className={cn("text-[9px] font-black uppercase rounded-sm h-5 px-1.5", permit.status === 'Approved' ? "bg-green-50 text-green-700 border-green-200" : permit.status === 'Rejected' ? "bg-red-50 text-red-700 border-red-200" : permit.status === 'Pending' ? "bg-yellow-50 text-yellow-700 border-yellow-200" : permit.status === 'ManagerApproved' ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-muted text-muted-foreground")}>{permit.status}</Badge></TableCell>
                  <TableCell className="text-right px-6"><Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary rounded-sm"><Link href={`/ptw/list?view=${permit.id}`}><Eye className="h-4 w-4" /></Link></Button></TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={5} className="h-32 text-center italic">No records.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
