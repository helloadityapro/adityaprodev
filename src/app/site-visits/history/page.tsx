"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { collection, query, where, orderBy, limit, doc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, differenceInMinutes } from "date-fns";
import { MapPin, Navigation, History, ExternalLink, UserCheck, Timer, FileText, ImageIcon, Search, FilterX, Calendar, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { isSuperAdmin } from "@/lib/auth-constants";
import { cn } from "@/lib/utils";

type SiteVisit = {
  id: string;
  siteName: string;
  managerName: string;
  managerId: string;
  startTime: any;
  endTime?: any;
  startLat: number;
  startLng: number;
  endLat?: number;
  endLng?: number;
  purpose?: string;
  details?: string;
  tasks?: string[];
  selfieUrl?: string;
  customerAvailable?: boolean;
  customerNames?: string;
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
  const [viewVisit, setViewVisit] = React.useState<SiteVisit | null>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const historyQuery = useMemoFirebase(() => {
    if (!user) return null;
    const colRef = collection(firestore, 'site_visits');
    if (isAdmin) return query(colRef, orderBy('startTime', 'desc'), limit(100));
    return query(
      colRef,
      where('managerId', '==', user.uid),
      orderBy('startTime', 'desc'),
      limit(50)
    );
  }, [firestore, user, isAdmin]);

  const { data: visits, isLoading } = useCollection<SiteVisit>(historyQuery);

  const filteredVisits = React.useMemo(() => {
    if (!visits) return [];
    return visits.filter(v => 
      v.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.purpose || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [visits, searchTerm]);

  if (isLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-48" /><Skeleton className="h-[500px] w-full" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <History className="h-8 w-8" /> Visit Logs & Reports
          </h1>
          <p className="text-muted-foreground">Historical records of site presence and audit reports.</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by site or purpose..." 
            className="pl-8 rounded-sm h-10 border-primary/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Start Date & Time</TableHead>
                <TableHead>Project Site</TableHead>
                {isAdmin && <TableHead>Manager</TableHead>}
                <TableHead>Purpose</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right px-6">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVisits.length > 0 ? filteredVisits.map((visit) => (
                <TableRow key={visit.id} className="hover:bg-muted/5 transition-colors">
                  <TableCell className="font-mono text-xs font-bold text-muted-foreground">
                    {formatTimestamp(visit.startTime)}
                  </TableCell>
                  <TableCell className="font-black text-sm">{visit.siteName}</TableCell>
                  {isAdmin && <TableCell className="text-xs font-bold">{visit.managerName}</TableCell>}
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
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setViewVisit(visit)}>
                      <FileText className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 7 : 6} className="h-32 text-center text-muted-foreground italic">
                    No visit records found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!viewVisit} onOpenChange={(o) => !o && setViewVisit(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-sm">
          <DialogHeader className="p-6 border-b bg-muted/5">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <DialogTitle className="text-2xl font-black">{viewVisit?.siteName} Visit Report</DialogTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatTimestamp(viewVisit?.startTime)}
                </div>
              </div>
              <Badge className="bg-primary h-6 text-[10px] uppercase font-black px-3 rounded-sm">{viewVisit?.status}</Badge>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1 p-6">
            {viewVisit && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Visual Metadata */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Verification Selfie</Label>
                      {viewVisit.selfieUrl ? (
                        <div className="relative aspect-video rounded-sm overflow-hidden border shadow-inner bg-muted">
                          <img src={viewVisit.selfieUrl} className="w-full h-full object-cover" alt="Verification" />
                        </div>
                      ) : (
                        <div className="aspect-video bg-muted/50 rounded-sm border border-dashed flex flex-col items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-8 w-8 opacity-20 mb-2" />
                          <p className="text-[10px] font-bold uppercase">No image captured</p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-muted/20 border rounded-sm">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground mb-1 block">Visit Duration</Label>
                        <div className="flex items-center gap-2 text-primary font-black">
                          <Timer className="h-4 w-4" />
                          {calculateDuration(viewVisit.startTime, viewVisit.endTime)}
                        </div>
                      </div>
                      <div className="p-3 bg-muted/20 border rounded-sm">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground mb-1 block">Customer Rep</Label>
                        <div className="flex items-center gap-2 font-bold text-sm">
                          {viewVisit.customerAvailable ? (
                            <><UserCheck className="h-4 w-4 text-green-600" /> Present</>
                          ) : (
                            <><FilterX className="h-4 w-4 text-red-600" /> Absent</>
                          )}
                        </div>
                      </div>
                    </div>

                    {viewVisit.customerAvailable && viewVisit.customerNames && (
                      <div className="p-4 bg-green-50 border border-green-100 rounded-sm">
                        <Label className="text-[9px] font-black uppercase text-green-700 mb-2 flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" /> Met with Representative(s)
                        </Label>
                        <p className="text-sm font-bold text-green-900 leading-tight">{viewVisit.customerNames}</p>
                      </div>
                    )}
                  </div>

                  {/* Visit Narrative */}
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Purpose</Label>
                      <p className="font-bold text-lg text-primary">{viewVisit.purpose || 'Regular field audit'}</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Summary of Activities</Label>
                      <div className="p-4 bg-muted/10 border rounded-sm text-sm leading-relaxed whitespace-pre-wrap font-medium">
                        {viewVisit.details || 'No detailed log provided for this visit.'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                  {/* Task List */}
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                      <Navigation className="h-3.5 w-3.5" /> Action Items & Observations
                    </Label>
                    {viewVisit.tasks && viewVisit.tasks.length > 0 ? (
                      <div className="space-y-2">
                        {viewVisit.tasks.map((task, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-primary/[0.02] border border-primary/5 rounded-sm">
                            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary shrink-0">{i+1}</div>
                            <span className="text-sm font-medium">{task}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic pl-2">No specific tasks logged.</p>
                    )}
                  </div>

                  {/* Location Audit */}
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" /> GPS Audit (Logistics)
                    </Label>
                    <div className="space-y-2">
                      <div className="p-3 bg-muted/20 border rounded-sm flex items-center justify-between">
                        <div>
                          <p className="text-[9px] font-black uppercase text-muted-foreground">Entry GPS</p>
                          <p className="font-mono text-[11px]">{viewVisit.startLat.toFixed(5)}, {viewVisit.startLng.toFixed(5)}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" asChild>
                          <a href={`https://www.google.com/maps/search/?api=1&query=${viewVisit.startLat},${viewVisit.startLng}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                        </Button>
                      </div>
                      {viewVisit.endLat && (
                        <div className="p-3 bg-muted/20 border rounded-sm flex items-center justify-between">
                          <div>
                            <p className="text-[9px] font-black uppercase text-muted-foreground">Exit GPS</p>
                            <p className="font-mono text-[11px]">{viewVisit.endLat.toFixed(5)}, {viewVisit.endLng.toFixed(5)}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" asChild>
                            <a href={`https://www.google.com/maps/search/?api=1&query=${viewVisit.endLat},${viewVisit.endLng}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
          
          <div className="p-4 border-t bg-muted/5 flex justify-end">
            <Button variant="outline" className="rounded-sm font-bold" onClick={() => setViewVisit(null)}>Close Report</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}