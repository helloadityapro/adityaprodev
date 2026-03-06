"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { format, differenceInMinutes } from "date-fns";
import { MapPin, Navigation, History, UserCheck, Timer, FileText, ImageIcon, Users, Maximize2, X, User, FolderArchive, ArrowLeft, Printer, ExternalLink, CheckCircle2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type TaskItem = {
  text: string;
  photoUrl: string | null;
};

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
  tasks?: TaskItem[];
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

export default function SiteVisitDetailPage() {
  const params = useParams();
  const visitId = params.visitId as string;
  const firestore = useFirestore();
  const router = useRouter();
  const [enlargedImage, setEnlargedImage] = React.useState<string | null>(null);
  const [zoom, setZoom] = React.useState(1);

  const visitRef = useMemoFirebase(() => doc(firestore, 'site_visits', visitId), [firestore, visitId]);
  const { data: visit, isLoading } = useDoc<SiteVisit>(visitRef);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  if (isLoading) return (
    <div className="space-y-8 max-w-5xl mx-auto p-6">
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );

  if (!visit) return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <FileText className="h-16 w-16 text-muted-foreground/20 mb-4" />
      <h2 className="text-xl font-bold">Visit Report Not Found</h2>
      <p className="text-muted-foreground mt-2">The requested audit log does not exist or has been removed.</p>
      <Button variant="outline" className="mt-6" onClick={() => router.push('/site-visits/history')}>Back to History</Button>
    </div>
  );

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20 px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <Button variant="ghost" size="sm" onClick={() => router.push('/site-visits/history')} className="w-fit -ml-2 text-muted-foreground hover:text-primary">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to History
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-sm font-bold border-primary text-primary hover:bg-primary/5">
            <Printer className="mr-2 h-4 w-4" /> Print Report
          </Button>
        </div>
      </div>

      <Card id="printable-report-area" className="rounded-sm shadow-xl overflow-hidden border-primary/10">
        <CardHeader className="bg-primary/5 border-b p-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary h-6 text-[10px] uppercase font-black px-3 rounded-sm">{visit.status}</Badge>
                <div className="flex items-center gap-1.5 text-[9px] font-black text-muted-foreground uppercase bg-white/50 px-2 py-0.5 rounded-sm border border-primary/10">
                  <FolderArchive className="h-3 w-3" /> site_visits/{visit.managerId}
                </div>
              </div>
              <CardTitle className="text-4xl font-black tracking-tight text-foreground leading-none">{visit.siteName}</CardTitle>
              <div className="flex flex-col gap-1.5 pt-2">
                <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                  <User className="h-4 w-4 text-primary" />
                  Visit Logged by {visit.managerName}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground font-semibold">
                  <History className="h-4 w-4" />
                  Started on {formatTimestamp(visit.startTime)}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col md:items-end gap-4">
              <div className="p-4 bg-white/80 backdrop-blur rounded-sm border border-primary/10 shadow-sm text-center min-w-[160px]">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Total Duration</p>
                <div className="flex items-center justify-center gap-2 text-primary font-black text-2xl">
                  <Timer className="h-6 w-6" />
                  {calculateDuration(visit.startTime, visit.endTime)}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-8 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Left Column: Verification & GPS */}
            <div className="space-y-10">
              <section className="space-y-4">
                <Label className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
                  <UserCheck className="h-4 w-4" /> Presence Verification
                </Label>
                {visit.selfieUrl ? (
                  <div className="relative aspect-video rounded-sm overflow-hidden border-2 border-primary/10 shadow-lg bg-muted group cursor-pointer" onClick={() => { setZoom(1); setEnlargedImage(visit.selfieUrl || null); }}>
                    <img src={visit.selfieUrl} className="w-full h-full object-cover" alt="Verification Selfie" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors no-print">
                      <Maximize2 className="h-8 w-8 text-white opacity-0 group-hover:opacity-100" />
                    </div>
                    <div className="absolute bottom-3 left-3 bg-black/60 text-white text-[9px] font-black uppercase px-2 py-1 rounded-sm backdrop-blur-sm">
                      Face & Upper Body Audit Profile
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video bg-muted/30 rounded-sm border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-10 w-10 opacity-20 mb-3" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Selfie Not Captured</p>
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <Label className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> GPS Audit Logs
                </Label>
                <div className="grid gap-3">
                  <div className="p-4 bg-muted/20 border rounded-sm flex items-center justify-between group">
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Entry Coordinates</p>
                      <p className="font-mono text-xs font-bold mt-1">{visit.startLat.toFixed(6)}, {visit.startLng.toFixed(6)}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10 rounded-sm no-print" asChild>
                      <a href={`https://www.google.com/maps/search/?api=1&query=${visit.startLat},${visit.startLng}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                    </Button>
                  </div>
                  {visit.endLat && (
                    <div className="p-4 bg-muted/20 border rounded-sm flex items-center justify-between group">
                      <div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Exit Coordinates</p>
                        <p className="font-mono text-xs font-bold mt-1">{visit.endLat.toFixed(6)}, {visit.endLng.toFixed(6)}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10 rounded-sm no-print" asChild>
                        <a href={`https://www.google.com/maps/search/?api=1&query=${visit.endLat},${visit.endLng}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                      </Button>
                    </div>
                  )}
                </div>
              </section>

              {visit.customerAvailable && (
                <section className="p-6 bg-green-50 border-2 border-green-100 rounded-sm animate-in fade-in slide-in-from-top-2">
                  <Label className="text-[10px] font-black uppercase text-green-700 mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" /> Client Engagement Recorded
                  </Label>
                  <p className="text-base font-black text-green-900 leading-tight">
                    {visit.customerNames || 'Customer representative present'}
                  </p>
                  <p className="text-[10px] text-green-600 mt-2 font-bold uppercase tracking-tight italic">Verified through site presence audit</p>
                </section>
              )}
            </div>

            {/* Right Column: Narrative & Observations */}
            <div className="space-y-10">
              <section className="space-y-4">
                <Label className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
                  <Navigation className="h-4 w-4" /> Visit Intent & Narrative
                </Label>
                <div className="space-y-4">
                  <div className="p-4 bg-primary/5 border border-primary/10 rounded-sm">
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1">Declared Purpose</p>
                    <p className="text-lg font-bold">{visit.purpose || 'General Field Management'}</p>
                  </div>
                  <div className="p-6 bg-card border rounded-sm shadow-sm space-y-2">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Site Narrative & Findings</p>
                    <div className="text-base leading-relaxed text-foreground/90 whitespace-pre-wrap font-medium italic">
                      "{visit.details || 'No narrative log provided for this visit.'}"
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <Label className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Action Items & Observations Proof
                </Label>
                {visit.tasks && visit.tasks.length > 0 ? (
                  <div className="grid gap-6">
                    {visit.tasks.map((task, i) => (
                      <Card key={i} className="rounded-sm border-primary/5 bg-primary/[0.01] shadow-none overflow-hidden">
                        <div className="flex flex-col">
                          <div className="p-4 border-b bg-muted/10 flex items-start gap-4">
                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-black text-primary shrink-0 border border-primary/20">
                              {i + 1}
                            </div>
                            <span className="text-sm font-bold leading-snug pt-0.5">{task.text}</span>
                          </div>
                          {task.photoUrl && (
                            <div className="relative aspect-video w-full cursor-pointer group" onClick={() => { setZoom(1); setEnlargedImage(task.photoUrl); }}>
                              <img src={task.photoUrl} className="w-full h-full object-cover" alt={`Proof for task ${i+1}`} />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors no-print">
                                <Maximize2 className="h-8 w-8 text-white opacity-0 group-hover:opacity-100" />
                              </div>
                              <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded-sm text-[8px] font-black text-white uppercase tracking-widest">
                                Task Photo Proof
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center border-2 border-dashed rounded-sm bg-muted/5">
                    <FileText className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">No specific action items documented</p>
                  </div>
                )}
              </section>
            </div>
          </div>
        </CardContent>
        
        <Separator />
        
        <CardFooter className="bg-muted/5 p-8 flex flex-col items-center justify-center text-center gap-2">
          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">End of Site Visit Audit Report</p>
          <p className="text-[8px] text-muted-foreground/60 font-mono">ID: {visit.id}</p>
        </CardFooter>
      </Card>

      <Dialog open={!!enlargedImage} onOpenChange={(o) => { if(!o) setZoom(1); setEnlargedImage(null); }}>
        <DialogContent className="max-w-[95vw] h-[90vh] p-0 border-none bg-black/95 flex flex-col items-center justify-center rounded-sm overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Audit Image Detail</DialogTitle>
            <DialogDescription>Enlarged high-resolution view of site audit proof.</DialogDescription>
          </DialogHeader>
          
          <div className="absolute top-4 left-4 flex gap-2 z-50 no-print">
            <Button variant="secondary" size="icon" className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white border-none" onClick={() => setZoom(prev => Math.min(prev + 0.25, 4))} title="Zoom In">
              <ZoomIn className="h-5 w-5" />
            </Button>
            <Button variant="secondary" size="icon" className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white border-none" onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.5))} title="Zoom Out">
              <ZoomOut className="h-5 w-5" />
            </Button>
            <Button variant="secondary" size="icon" className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white border-none" onClick={() => setZoom(1)} title="Reset Zoom">
              <RotateCcw className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="relative w-full h-full flex overflow-auto p-4">
            <div 
              className="m-auto transition-transform duration-200 ease-out flex items-center justify-center" 
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
            >
              {enlargedImage && (
                <img src={enlargedImage} className="max-w-full max-h-[85vh] object-contain shadow-2xl" alt="Audit Evidence" />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
