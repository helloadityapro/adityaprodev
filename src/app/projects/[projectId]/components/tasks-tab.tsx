'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DataItem } from '../types';

interface TasksTabProps {
  tasks: DataItem[] | null;
}

export function TasksTab({ tasks }: TasksTabProps) {
  return (
    <div className="mt-6 animate-in fade-in duration-300 transition-all">
      <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md text-left">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow><TableHead className="px-6">Title</TableHead><TableHead>Assigned To</TableHead><TableHead>Status</TableHead><TableHead className="text-right px-6">Due</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {tasks && tasks.length > 0 ? tasks.map((task: any) => (
                <TableRow key={task.id} className="hover:bg-muted/5">
                  <TableCell className="px-6 py-4 font-bold text-sm">{task.title}</TableCell>
                  <TableCell className="text-xs font-medium">{task.assignedToName || 'Multi'}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[9px] font-black uppercase rounded-sm">{task.status}</Badge></TableCell>
                  <TableCell className="text-right px-6 text-[10px] font-mono font-black text-muted-foreground uppercase">{task.dueDate}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={4} className="h-32 text-center italic">No tasks.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
