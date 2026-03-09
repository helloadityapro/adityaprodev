
"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { collection, query, where, limit, doc, or } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, differenceInMinutes } from "date-fns";
import { History, Timer, FileText, Search, User, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isSuperAdmin } from "@/lib/auth-constants";
import { cn } from "@/lib/utils";
import Link from "next/link";

type SiteVisit = {
  id: string;
  siteName: string;
  managerName: string;
  managerId: string;
  siteManagerId?: string;
  department?: string;
  startTime: any;
  endTime?: any;
  purpose?: string;
  status: 'ongoing' | 'completed';
};

const formatTimestamp = (ts: any) => {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : (typeof ts === 'string' ? new Date(ts) : ts);
  return format(date, 'dd MMM yyyy HH:mm');
};

const calculateDuration = (start: any, end: any) => {
  if (!start || !end) return '—';
  const s = start.toDate ? start.toDate() : new Date(start);
  const e = end.toDate ? end.toDate() : new Date(end);
  const mins = differenceInMinutes(e, s);
  
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
};

export default function SiteVisitsHistoryPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = React.useState("");

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const historyQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'site_visits');
    
    // Removing orderBy to bypass index requirements
    if (isAdmin) return query(colRef, limit(100));

    if (isManager) {
        return query(
            colRef,
            or(where('managerId', '==', user.uid), where('siteManagerId', '==', user.uid)),
            limit(100)
        );
    }
    
    return query(
      colRef,
      where('managerId', '==', user.uid),
      limit(50)
    );
  }, [firestore, user, isAdmin, isManager, isProfileLoading]);

  const { data: visits, isLoading } = useCollection<SiteVisit>(historyQuery);

  const filteredVisits = React.useMemo(() => {
    if (!visits) return [];
    
    // Sort in memory: Latest visits first
    const sorted = [...visits].sort((a, b) => {
        const dateA = a.startTime?.toDate?.()?.getTime() || 0;
        const dateB = b.startTime?.toDate?.()?.getTime() || 0;
        return dateB - dateA;
    });

    return sorted.filter(v => 
      v.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.purpose || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.managerName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [visits, searchTerm]);

  if (isLoading || isProfileLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-48" /><Skeleton className="h-[500px] w-full" /></div>;

  const headerTitle = isAdmin ? "Organization Visit Logs" : (isManager ? "Team Visit Logs" : "My Site Visit Logs");

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <History className="h-8 w-8" /> {headerTitle}
          </h1>
          <p className="text-muted-foreground">Historical records of site presence and audit reports.</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by site, name, or purpose..." 
            className="pl-8 rounded-sm h-10 border-primary/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Start Date & Time</TableHead>
                  <TableHead>Project Site</TableHead>
                  {(isAdmin || isManager) && <TableHead>Personnel</TableHead>}
                  <TableHead>Purpose</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right px-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVisits.length > 0 ? filteredVisits.map((visit) => (
                  <TableRow key={visit.id} className="hover:bg-muted/5 transition-colors group">
                    <TableCell className="font-mono text-xs font-bold text-muted-foreground">
                      {formatTimestamp(visit.startTime)}
                    </TableCell>
                    <TableCell className="font-black text-sm">{visit.siteName}</TableCell>
                    {(isAdmin || isManager) && (
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs font-bold">
                          <User className="h-3 w-3 text-primary" />
                          {visit.managerName}
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant="secondary" className="text-[9px] font-black uppercase rounded-sm px-1.5 py-0">
                        {visit.purpose || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                        <Timer className="h-3 w-3" />
                        {calculateDuration(visit.startTime, visit.endTime)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("rounded-sm text-[9px] font-bold uppercase", visit.status === 'completed' ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800")}>
                        {visit.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <Button variant="ghost" size="sm" asChild className="rounded-sm text-primary hover:text-primary hover:bg-primary/5">
                        <Link href={`/site-visits/${visit.id}`}>
                          <FileText className="h-4 w-4 mr-1.5" />
                          View Report
                          <ArrowRight className="ml-1.5 h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={isAdmin || isManager ? 7 : 6} className="h-32 text-center text-muted-foreground italic">
                      No visit records found.
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
