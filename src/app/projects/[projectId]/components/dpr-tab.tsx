'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataItem } from '../types';

interface DPRTabProps {
  dprs: DataItem[] | null;
}

export function DPRTab({ dprs }: DPRTabProps) {
  return (
    <div className="mt-6 animate-in fade-in duration-300 transition-all">
      <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md text-left">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow><TableHead className="px-6">Date</TableHead><TableHead>User</TableHead><TableHead className="min-w-[400px]">Activity & Update</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {dprs && dprs.length > 0 ? dprs.map((dpr: any) => (
                <TableRow key={dpr.id}><TableCell className="px-6 py-4 font-mono text-xs font-bold uppercase">{dpr.reportDate}</TableCell><TableCell className="text-xs font-semibold">{dpr.userName}</TableCell><TableCell className="py-4"><div className="text-sm italic text-muted-foreground">"{dpr.description}"</div></TableCell></TableRow>
              )) : <TableRow><TableCell colSpan={3} className="h-32 text-center italic">No records.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
