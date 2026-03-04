
"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { collection, query, where, orderBy, limit, doc } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, differenceInMinutes } from "date-fns";
import { MapPin, History, Search, User, Timer, LogIn, LogOut, ImageIcon, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isSuperAdmin } from "@/lib/auth-constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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
  checkInSelfieUrl?: string;
  checkOutSelfieUrl?: string;
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
  const [viewImage, setViewImage] = React.useState<string | null>(null);

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

  if (isLoading || isProfileLoading) return <div className="p-8 space-y-4 max-w-5xl mx-auto"><Skeleton className="h-[500px] w-full" /></div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2">
            <History className="h-8 w-8" /> {isAdmin ? "Global Attendance Logs" : "My Attendance History"}
          </h1>
          <p className="text-muted-foreground">Historical records with GPS and Photo verification.</p>
        </div>
        <Input 
          placeholder="Search by name or date..." 
          className="w-full md:w-72 rounded-sm border-primary/20"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Date</TableHead>
                  {isAdmin && <TableHead>Personnel</TableHead>}
                  <TableHead className="text-center">Entry (Photo/GPS)</TableHead>
                  <TableHead className="text-center">Exit (Photo/GPS)</TableHead>
                  <TableHead className="text-center">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.length > 0 ? filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-bold text-sm">{formatDate(entry.checkInTime)}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs font-bold uppercase">
                          <User className="h-3 w-3" /> {entry.userName}
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1 text-xs font-bold text-emerald-700">
                            <LogIn className="h-3 w-3" /> {formatTime(entry.checkInTime)}
                          </div>
                          <div className="flex gap-1">
                            {entry.checkInSelfieUrl && (
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={() => setViewImage(entry.checkInSelfieUrl!)}><ImageIcon className="h-3 w-3" /></Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" asChild>
                              <a href={`https://www.google.com/maps/search/?api=1&query=${entry.checkInLat},${entry.checkInLng}`} target="_blank" rel="noopener noreferrer"><MapPin className="h-3 w-3" /></a>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {entry.checkOutTime ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1 text-xs font-bold text-slate-700">
                              <LogOut className="h-3 w-3" /> {formatTime(entry.checkOutTime)}
                            </div>
                            <div className="flex gap-1">
                              {entry.checkOutSelfieUrl && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={() => setViewImage(entry.checkOutSelfieUrl!)}><ImageIcon className="h-3 w-3" /></Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" asChild>
                                <a href={`https://www.google.com/maps/search/?api=1&query=${entry.checkOutLat},${entry.checkOutLng}`} target="_blank" rel="noopener noreferrer"><MapPin className="h-3 w-3" /></a>
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <Badge variant="secondary" className="text-[9px] font-black uppercase rounded-sm animate-pulse">Ongoing</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-black text-primary">
                      <Timer className="h-3 w-3 inline mr-1" />
                      {calculateDuration(entry.checkInTime, entry.checkOutTime)}
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={isAdmin ? 5 : 4} className="h-32 text-center text-muted-foreground italic">No records.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!viewImage} onOpenChange={() => setViewImage(null)}>
        <DialogContent className="max-w-lg p-0 bg-black border-none rounded-sm overflow-hidden">
          <DialogHeader className="sr-only"><DialogTitle>Verification Photo</DialogTitle></DialogHeader>
          <div className="relative aspect-square flex items-center justify-center">
            {viewImage && <img src={viewImage} className="max-w-full max-h-full object-contain" alt="Verification" />}
            <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-white bg-black/20 rounded-full" onClick={() => setViewImage(null)}><X className="h-6 w-6" /></Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
