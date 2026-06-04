"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { collection, query, where, limit, doc, or, orderBy } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, differenceInMinutes, subDays, subMonths } from "date-fns";
import { MapPin, History, Search, User, Timer, LogIn, LogOut, ImageIcon, X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, PlayCircle, Film, FilterX, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isSuperAdmin } from "@/lib/auth-constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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
  checkOutType?: string;
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
  const [dateFilter, setDateFilter] = React.useState<string>("today");
  const [customStart, setCustomStart] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  
  const [viewUrl, setViewUrl] = React.useState<string | null>(null);
  const [viewUrls, setViewUrls] = React.useState<string[]>([]);
  const [currentUrlIndex, setCurrentUrlIndex] = React.useState(0);
  const [zoom, setZoom] = React.useState(1);

  const viewerRef = React.useRef<HTMLDivElement>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';
  const showPersonnelColumn = isAdmin || isManager;

  const queryDateRange = React.useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    if (dateFilter === 'today') return { start: todayStr, end: todayStr };
    if (dateFilter === '7days') return { start: format(subDays(today, 7), 'yyyy-MM-dd'), end: todayStr };
    if (dateFilter === 'lastMonth') return { start: format(subMonths(today, 1), 'yyyy-MM-dd'), end: todayStr };
    if (dateFilter === 'custom') return { start: customStart, end: customEnd };
    return { start: '1970-01-01', end: '2099-12-31' };
  }, [dateFilter, customStart, customEnd]);

  const attendanceQuery = useMemoFirebase(() => {
    if (!user || !userProfile || isProfileLoading) return null;
    const colRef = collection(firestore, 'attendance');
    const { start, end } = queryDateRange;
    
    // 1. "Today" filter: Equality on date works without complex indices
    if (dateFilter === 'today') {
      if (isAdmin) return query(colRef, where('date', '==', start), limit(1000));
      return query(colRef, where('userId', '==', user.uid), where('date', '==', start), limit(500));
    }

    // 2. History filters ("7days", "lastMonth", "custom"):
    // We avoid combining 'where' and 'orderBy' on different fields to prevent missing index errors.
    // To ensure Custom Range works well, we try to fetch as many records as possible for the user.
    if (isAdmin) {
      // For Admin, we sort by checkInTime globally. 
      // If they specify a custom range, we'll rely on the 1000 record window for now, 
      // or we can query by date if we ignore the global order.
      return query(colRef, orderBy('checkInTime', 'desc'), limit(1000));
    }
    
    return query(
      colRef,
      where('userId', '==', user.uid),
      limit(1000)
    );
  }, [firestore, user, userProfile, isAdmin, isProfileLoading, dateFilter, queryDateRange]);

  const { data: entries, isLoading } = useCollection<AttendanceEntry>(attendanceQuery);

  // Zoom logic for media preview
  React.useEffect(() => {
    const el = viewerRef.current;
    if (!el || !viewUrl) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(prev => {
        const delta = e.deltaY > 0 ? -0.2 : 0.2;
        return Math.min(Math.max(prev + delta, 0.5), 4);
      });
    };

    let initialDist = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDist = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY
        );
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY
        );
        const delta = (dist - initialDist) / 100;
        setZoom(prev => Math.min(Math.max(prev + delta, 0.5), 4));
        initialDist = dist;
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart);
    el.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [viewUrl]);

  const filteredEntries = React.useMemo(() => {
    if (!entries) return [];
    
    const { start, end } = queryDateRange;

    const filtered = entries.filter(e => {
      // Robust string-based date comparison
      const matchesDate = e.date >= start && e.date <= end;
      const matchesSearch = e.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           e.date.includes(searchTerm);
      return matchesDate && matchesSearch;
    });

    return [...filtered].sort((a, b) => {
        const dateA = a.checkInTime?.toDate?.()?.getTime() || 0;
        const dateB = b.checkInTime?.toDate?.()?.getTime() || 0;
        return dateB - dateA;
    });
  }, [entries, searchTerm, queryDateRange]);

  const openViewer = (url: string, entry: AttendanceEntry) => {
    const urls = [entry.checkInSelfieUrl, entry.checkOutSelfieUrl].filter(Boolean) as string[];
    const index = urls.indexOf(url);
    setViewUrls(urls);
    setCurrentUrlIndex(index >= 0 ? index : 0);
    setViewUrl(url);
    setZoom(1);
  };

  const nextUrl = () => {
    if (viewUrls.length <= 1) return;
    const nextIdx = (currentUrlIndex + 1) % viewUrls.length;
    setCurrentUrlIndex(nextIdx);
    setViewUrl(viewUrls[nextIdx]);
    setZoom(1);
  };

  const prevUrl = () => {
    if (viewUrls.length <= 1) return;
    const prevIdx = (currentUrlIndex - 1 + viewUrls.length) % viewUrls.length;
    setCurrentUrlIndex(prevIdx);
    setViewUrl(viewUrls[prevIdx]);
    setZoom(1);
  };

  const isVideoUrl = (url: string) => {
    const lowUrl = url.toLowerCase();
    return lowUrl.includes('.mp4') || lowUrl.includes('.mov') || lowUrl.includes('.webm') || lowUrl.includes('.ogg');
  };

  if (isLoading || isProfileLoading) return <div className="p-8 space-y-4 max-w-5xl mx-auto"><Skeleton className="h-[500px] w-full" /></div>;

  const headerTitle = isAdmin ? "Global Attendance Audit" : "My Workday History";

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-8 px-4">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2">
          <History className="h-8 w-8 text-primary" /> {headerTitle}
        </h1>
        <p className="text-muted-foreground font-medium text-sm">Review workday sessions with GPS and profile verification.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-card p-4 border rounded-sm shadow-sm">
        <div className="md:col-span-2 space-y-1.5">
          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Search Records</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name or date..." 
              className="pl-8 rounded-sm border-primary/20 h-10 bg-background text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Time Range</Label>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="h-10 rounded-sm border-primary/20 bg-background font-bold text-xs uppercase">
              <Calendar className="h-3.5 w-3.5 mr-2 opacity-50" />
              <SelectValue placeholder="Select Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today" className="text-xs font-bold uppercase">Today</SelectItem>
              <SelectItem value="7days" className="text-xs font-bold uppercase">Last 7 Days</SelectItem>
              <SelectItem value="lastMonth" className="text-xs font-bold uppercase">Last Month</SelectItem>
              <SelectItem value="custom" className="text-xs font-bold uppercase text-primary">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end gap-2">
          {dateFilter === 'custom' ? (
            <div className="flex-1 flex gap-2 animate-in fade-in zoom-in-95">
              <div className="flex-1 space-y-1">
                <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-10 rounded-sm border-primary/20 text-xs" />
              </div>
              <div className="flex-1 space-y-1">
                <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-10 rounded-sm border-primary/20 text-xs" />
              </div>
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <Button variant="ghost" size="icon" onClick={() => { setSearchTerm(""); setDateFilter("today"); }} className="h-10 w-10 text-muted-foreground rounded-sm border border-transparent hover:border-primary/10">
            <FilterX className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="md:hidden space-y-4">
        {filteredEntries.length > 0 ? filteredEntries.map((entry) => (
          <Card key={entry.id} className="border-primary/10 rounded-sm shadow-sm overflow-hidden">
            <CardContent className="p-4 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">{formatDate(entry.checkInTime)}</span>
                  {showPersonnelColumn && <h3 className="font-bold text-sm flex items-center gap-1.5"><User className="h-3 w-3 text-primary" /> {entry.userName}</h3>}
                </div>
                <div className="flex items-center gap-1.5 font-black text-primary text-xs">
                  <Timer className="h-3 w-3" />
                  {calculateDuration(entry.checkInTime, entry.checkOutTime)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Entry</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-700">{formatTime(entry.checkInTime)}</span>
                    <div className="flex gap-1">
                      {entry.checkInSelfieUrl && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={() => openViewer(entry.checkInSelfieUrl!, entry)}>
                          {isVideoUrl(entry.checkInSelfieUrl!) ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" asChild>
                        <a href={`https://www.google.com/maps/search/?api=1&query=${entry.checkInLat},${entry.checkInLng}`} target="_blank" rel="noopener noreferrer"><MapPin className="h-3 w-3" /></a>
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Exit</p>
                  {entry.checkOutTime ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700">{formatTime(entry.checkOutTime)}</span>
                        <div className="flex gap-1">
                          {entry.checkOutSelfieUrl && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={() => openViewer(entry.checkOutSelfieUrl!, entry)}>
                              {isVideoUrl(entry.checkOutSelfieUrl!) ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" asChild>
                            <a href={`https://www.google.com/maps/search/?api=1&query=${entry.checkOutLat},${entry.checkOutLng}`} target="_blank" rel="noopener noreferrer"><MapPin className="h-3 w-3" /></a>
                          </Button>
                        </div>
                      </div>
                      {entry.checkOutType === 'System CheckOut' && (
                        <Badge variant="outline" className="bg-red-50 text-red-600 border-red-100 text-[7px] h-3.5 px-1 font-black uppercase w-fit">System</Badge>
                      )}
                    </div>
                  ) : (
                    <Badge variant="secondary" className="text-[8px] font-black uppercase rounded-sm h-5">In Session</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )) : (
          <div className="text-center py-12 text-muted-foreground italic bg-muted/5 rounded-sm border-2 border-dashed">
            No attendance records discovered for the selected range.
          </div>
        )}
      </div>

      <div className="hidden md:block">
        <Card className="rounded-sm shadow-xl border-primary/10 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-6 font-black uppercase text-[10px] tracking-widest">Date</TableHead>
                    {showPersonnelColumn && <TableHead className="font-black uppercase text-[10px] tracking-widest">Personnel</TableHead>}
                    <TableHead className="text-center font-black uppercase text-[10px] tracking-widest">Entry (Photo/GPS)</TableHead>
                    <TableHead className="text-center font-black uppercase text-[10px] tracking-widest">Exit (Photo/GPS)</TableHead>
                    <TableHead className="text-center font-black uppercase text-[10px] tracking-widest">Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => (
                    <TableRow key={entry.id} className="hover:bg-primary/[0.02] transition-colors group">
                      <TableCell className="px-6 font-bold text-sm">{formatDate(entry.checkInTime)}</TableCell>
                      {showPersonnelColumn && (
                        <TableCell>
                          <div className="flex items-center gap-2 text-xs font-black uppercase text-foreground">
                            <User className="h-3.5 w-3.5 text-primary" /> {entry.userName}
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-3">
                          <div className="flex flex-col items-center gap-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-black text-emerald-700">
                              <LogIn className="h-3 w-3" /> {formatTime(entry.checkInTime)}
                            </div>
                            <div className="flex gap-1 items-center">
                              {entry.checkInSelfieUrl && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10 rounded-sm" onClick={() => openViewer(entry.checkInSelfieUrl!, entry)}>
                                  {isVideoUrl(entry.checkInSelfieUrl!) ? <Film className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-muted rounded-sm" asChild>
                                <a href={`https://www.google.com/maps/search/?api=1&query=${entry.checkInLat},${entry.checkInLng}`} target="_blank" rel="noopener noreferrer"><MapPin className="h-3.5 w-3.5" /></a>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {entry.checkOutTime ? (
                          <div className="flex items-center justify-center gap-3">
                            <div className="flex flex-col items-center gap-1.5">
                              <div className="flex items-center gap-1.5 text-xs font-black text-slate-700">
                                <LogOut className="h-3 w-3" /> {formatTime(entry.checkOutTime)}
                                {entry.checkOutType === 'System CheckOut' && (
                                  <Badge variant="outline" className="ml-1 bg-red-50 text-red-600 border-red-100 text-[7px] h-4 px-1 font-black uppercase">System</Badge>
                                )}
                              </div>
                              <div className="flex gap-1 items-center">
                                {entry.checkOutSelfieUrl && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10 rounded-sm" onClick={() => openViewer(entry.checkOutSelfieUrl!, entry)}>
                                    {isVideoUrl(entry.checkOutSelfieUrl!) ? <Film className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-muted rounded-sm" asChild>
                                  <a href={`https://www.google.com/maps/search/?api=1&query=${entry.checkOutLat},${entry.checkOutLng}`} target="_blank" rel="noopener noreferrer"><MapPin className="h-3.5 w-3.5" /></a>
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <Badge variant="secondary" className="text-[9px] font-black uppercase rounded-sm animate-pulse px-3 py-1">In Session</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5 font-black text-primary text-xs">
                          <Timer className="h-3.5 w-3.5" />
                          {calculateDuration(entry.checkInTime, entry.checkOutTime)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!viewUrl} onOpenChange={(o) => { if(!o) { setZoom(1); setViewUrl(null); setViewUrls([]); } }}>
        <DialogContent className="max-w-[95vw] h-[90vh] p-0 bg-black/95 border-none rounded-sm overflow-hidden flex flex-col items-center justify-center shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Audit Verification Media</DialogTitle>
            <DialogDescription>Verification media for attendance session.</DialogDescription>
          </DialogHeader>
          
          <div className="absolute top-4 left-4 flex gap-2 z-50 no-print">
            <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white border-none" onClick={(e) => { e.stopPropagation(); setZoom(prev => Math.min(prev + 0.25, 4)); }} title="Zoom In">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white border-none" onClick={(e) => { e.stopPropagation(); setZoom(prev => Math.max(prev - 0.25, 0.5)); }} title="Zoom Out">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white border-none" onClick={(e) => { e.stopPropagation(); setZoom(1); }} title="Reset Zoom">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          {viewUrls.length > 1 && (
            <>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50 no-print">
                <Button variant="secondary" size="icon" className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white border-none shadow-2xl" onClick={(e) => { e.stopPropagation(); prevUrl(); }}>
                  <ChevronLeft className="h-8 w-8" />
                </Button>
              </div>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 z-50 no-print">
                <Button variant="secondary" size="icon" className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white border-none shadow-2xl" onClick={(e) => { e.stopPropagation(); nextUrl(); }}>
                  <ChevronRight className="h-8 w-8" />
                </Button>
              </div>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 no-print">
                <Badge variant="outline" className="bg-black/40 text-white border-none px-4 py-1 rounded-full font-black text-[9px] tracking-widest">
                  {currentUrlIndex === 0 ? 'ENTRY VERIFICATION' : 'EXIT VERIFICATION'}
                </Badge>
              </div>
            </>
          )}

          <div className="relative w-full h-full overflow-auto p-4 flex">
            <div 
              ref={viewerRef}
              className={cn(
                "m-auto transition-transform duration-200 ease-out flex items-center justify-center",
                zoom > 1 ? "cursor-move" : "cursor-default"
              )}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
            >
              {viewUrl && (
                isVideoUrl(viewUrl) ? (
                  <video src={viewUrl} controls autoPlay className="max-w-full max-h-[85vh] shadow-2xl rounded-sm" />
                ) : (
                  <img src={viewUrl} className="max-w-full max-h-[85vh] object-contain shadow-2xl rounded-sm" alt="Workday Profile" />
                )
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
