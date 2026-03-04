
"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { collection, query, where, orderBy, limit, doc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, differenceInMinutes } from "date-fns";
import { MapPin, History, Search, User, Navigation, Timer, LogIn, LogOut, ExternalLink, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSuperAdmin } from "@/lib/auth-constants";
import { cn } from "@/lib/utils";

type AttendanceEntry = {
  id: string;
  userId: string;
  userName: string;
  checkInTime: any;
  checkOutTime?: any;
  checkInLat: number;
  checkInLng: number;
  checkOutLat?: number;
  checkOutLng?: number;
  status: 'ongoing' | 'completed';
  date: string;
};

const formatTime = (ts: any) => {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return format(date, 'HH:mm');
};

const formatDate = (ts: any) => {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return format(date, 'dd MMM yyyy');
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

export default function AttendanceHistoryPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = React.useState("");

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const attendanceQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'attendance');
    if (isAdmin) return query(colRef, orderBy('checkInTime', 'desc'), limit(100));
    return query(
      colRef,
      where('userId', '==', user.uid),
      orderBy('checkInTime', 'desc'),
      limit(50)
    );
  }, [firestore, user, isAdmin, isProfileLoading]);

  const { data: entries, isLoading } = useCollection<AttendanceEntry>(attendanceQuery);

  const filteredEntries = React.useMemo(() => {
    if (!entries) return [];
    return entries.filter(e => 
      e.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.date.includes(searchTerm)
    );
  }, [entries, searchTerm]);

  if (isLoading || isProfileLoading) return <div className="p-8 space-y-4 max-w-5xl mx-auto"><Skeleton className="h-12 w-48" /><Skeleton className="h-[500px] w-full" /></div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2">
            <History className="h-8 w-8" /> {isAdmin ? "Global Attendance Logs" : "My Attendance History"}
          </h1>
          <p className="text-muted-foreground">Historical records of work session check-ins and check-outs.</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name or date..." 
            className="pl-8 rounded-sm h-10 border-primary/20 bg-background"
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
                  <TableHead className="w-32">Date</TableHead>
                  {isAdmin && <TableHead>Personnel</TableHead>}
                  <TableHead className="text-center">Check-in</TableHead>
                  <TableHead className="text-center">Check-out</TableHead>
                  <TableHead className="text-center">Total Duration</TableHead>
                  <TableHead className="text-right px-6">Audit Info</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.length > 0 ? filteredEntries.map((entry) => (
                  <TableRow key={entry.id} className="hover:bg-muted/5 transition-colors">
                    <TableCell className="font-bold text-sm">
                      {formatDate(entry.checkInTime)}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs font-bold">
                          <User className="h-3.5 w-3.5 text-primary" />
                          {entry.userName}
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                          <LogIn className="h-3 w-3" />
                          {formatTime(entry.checkInTime)}
                        </div>
                        <Badge variant="outline" className="text-[8px] h-3 px-1 border-emerald-200 text-emerald-700 bg-emerald-50">ENTRY</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        {entry.checkOutTime ? (
                          <>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                              <LogOut className="h-3 w-3" />
                              {formatTime(entry.checkOutTime)}
                            </div>
                            <Badge variant="outline" className="text-[8px] h-3 px-1 border-slate-200 text-slate-700 bg-slate-50">EXIT</Badge>
                          </>
                        ) : (
                          <Badge variant="secondary" className="text-[9px] font-black uppercase rounded-sm animate-pulse bg-blue-100 text-blue-800">Ongoing</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1.5 text-xs font-black text-primary">
                        <Timer className="h-3.5 w-3.5" />
                        {calculateDuration(entry.checkInTime, entry.checkOutTime)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="Check-in Location" asChild>
                          <a href={`https://www.google.com/maps/search/?api=1&query=${entry.checkInLat},${entry.checkInLng}`} target="_blank" rel="noopener noreferrer">
                            <MapPin className="h-4 w-4" />
                          </a>
                        </Button>
                        {entry.checkOutLat && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600" title="Check-out Location" asChild>
                            <a href={`https://www.google.com/maps/search/?api=1&query=${entry.checkOutLat},${entry.checkOutLng}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 6 : 5} className="h-32 text-center text-muted-foreground italic">
                      No attendance records found.
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
