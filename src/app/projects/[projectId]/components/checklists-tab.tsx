'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, Eye, History, User, Building2, Layers, Cpu, Zap, GlassWater } from 'lucide-react';
import Link from 'next/link';
import { ChecklistRecord } from '../types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ChecklistsTabProps {
  checklists: ChecklistRecord[] | null;
}

export function ChecklistsTab({ checklists }: ChecklistsTabProps) {
  const getIcon = (type: ChecklistRecord['type']) => {
    switch (type) {
      case 'MMS': return <Layers className="h-3.5 w-3.5 text-blue-500" />;
      case 'Inverter': return <Cpu className="h-3.5 w-3.5 text-purple-500" />;
      case 'HT Line': return <Zap className="h-3.5 w-3.5 text-amber-500" />;
      case 'HT Conductor': return <Zap className="h-3.5 w-3.5 text-emerald-500" />;
      case 'Module Breakage': return <GlassWater className="h-3.5 w-3.5 text-red-500" />;
      default: return <ClipboardCheck className="h-3.5 w-3.5 text-primary" />;
    }
  };

  const getLink = (record: ChecklistRecord) => {
    const baseUrl = `/checklists/data/${record.siteId}`;
    switch (record.type) {
      case 'MMS': return `${baseUrl}/mms/view/${record.id}`;
      case 'Inverter': return `${baseUrl}/inverter/view/${record.id}`;
      case 'HT Line': return `${baseUrl}/ht-line/view/${record.id}`;
      case 'HT Conductor': return `${baseUrl}/ht-conductor/view/${record.id}`;
      case 'Module Breakage': return `${baseUrl}/module-breakage`; // Breakage hub
      default: return baseUrl;
    }
  };

  return (
    <div className="mt-6 animate-in fade-in duration-300">
      <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md text-left">
        <CardHeader className="bg-muted/5 border-b py-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-bold uppercase tracking-widest">Quality Audit Registry</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6">Timestamp</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Auditor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right px-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checklists && checklists.length > 0 ? checklists.map((record) => (
                  <TableRow key={record.id} className="hover:bg-muted/5 group">
                    <TableCell className="px-6 py-4 font-mono text-[10px] font-bold text-muted-foreground uppercase whitespace-nowrap">
                      {record.createdAt ? format(record.createdAt.toDate(), 'dd MMM yy HH:mm') : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getIcon(record.type)}
                        <span className="text-[10px] font-black uppercase tracking-tight">{record.type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-xs text-foreground uppercase">{record.reference || '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <User className="h-3.5 w-3.5 text-primary opacity-40" />
                        {record.userName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "rounded-sm text-[9px] font-black uppercase px-1.5 h-5",
                        record.status === 'Approved' || record.status === 'OK' ? "bg-green-50 text-green-700 border-green-200" :
                        record.status === 'Rejected' || record.status === 'NOT OK' ? "bg-red-50 text-red-700 border-red-200" :
                        "bg-yellow-50 text-yellow-700 border-yellow-200"
                      )}>
                        {record.status || 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary rounded-sm">
                        <Link href={getLink(record)}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic uppercase font-black text-[10px] opacity-20">
                      No quality records discovered for this site.
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
