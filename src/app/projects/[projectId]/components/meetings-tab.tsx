'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NotebookPen, Eye, Plus, Calendar, User } from 'lucide-react';
import Link from 'next/link';
import { Meeting } from '../types';
import { format } from 'date-fns';

interface MeetingsTabProps {
  meetings: Meeting[] | null;
}

export function MeetingsTab({ meetings }: MeetingsTabProps) {
  const sortedMeetings = React.useMemo(() => {
    if (!meetings) return [];
    return [...meetings].sort((a, b) => {
      const da = a.createdAt?.toDate?.()?.getTime() || new Date(a.date).getTime();
      const db = b.createdAt?.toDate?.()?.getTime() || new Date(b.date).getTime();
      return db - da;
    });
  }, [meetings]);

  return (
    <div className="mt-6 animate-in fade-in duration-300">
      <div className="flex justify-end mb-4">
        <Button asChild className="rounded-sm font-bold shadow-md h-9">
          <Link href="/meetings/start">
            <Plus className="h-4 w-4 mr-2" /> Start New Meeting
          </Link>
        </Button>
      </div>
      <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md text-left">
        <CardHeader className="bg-muted/5 border-b py-4">
          <div className="flex items-center gap-2">
            <NotebookPen className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-bold uppercase tracking-widest">Site Review Meetings</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6">Date</TableHead>
                  <TableHead>Meeting Lead</TableHead>
                  <TableHead>Critical Points</TableHead>
                  <TableHead className="text-right px-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMeetings.length > 0 ? sortedMeetings.map((m) => (
                  <TableRow key={m.id} className="hover:bg-muted/5 group">
                    <TableCell className="px-6 py-4 font-mono text-xs font-bold text-muted-foreground uppercase whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-primary opacity-40" />
                        {m.date}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <User className="h-3.5 w-3.5 text-primary opacity-40" />
                        {m.userName}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs italic text-red-700" title={m.criticalPoints}>
                      {m.criticalPoints || 'No critical points recorded.'}
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary rounded-sm">
                        <Link href={`/meetings/list?view=${m.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic uppercase font-black text-[10px] opacity-20">
                      No meetings recorded for this site.
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
