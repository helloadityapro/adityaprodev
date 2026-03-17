"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { format, differenceInMinutes } from "date-fns";
import { 
  MapPin, 
  Navigation, 
  History, 
  UserCheck, 
  Timer, 
  FileText, 
  ImageIcon, 
  Users, 
  Maximize2, 
  X, 
  User, 
  FolderArchive, 
  ArrowLeft, 
  Printer, 
  ExternalLink, 
  CheckCircle2, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Building2, 
  ChevronLeft, 
  ChevronRight, 
  PlayCircle, 
  Film,
  Calendar,
  Clock,
  ShieldCheck,
  Activity
} from "lucide-react";
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
  siteManagerId?: string;
  department?: string;
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

export default function SiteVisitDetailPage({ params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = React.use(params);
  const firestore = useFirestore();
  const router = useRouter();
  
  const [viewUrl, setViewUrl] = React.useState<string | null>(null);
  const [viewUrls, setViewUrls] = React.useState<string[]>([]);
  const [currentUrlIndex, setCurrentUrlIndex] = React.useState(0);
  const [zoom, setZoom] = React.useState(1);

  const viewerRef = React.useRef<HTMLDivElement>(null);

  const visitRef = useMemoFirebase(() => doc(firestore, 'site_visits', visitId), [firestore, visitId]);
  const { data: visit, isLoading } = useDoc<SiteVisit>(visitRef);

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

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const openViewer = (url: string) => {
    const urls = [visit?.selfieUrl, ...(visit?.tasks?.map(t => t.photoUrl) || [])].filter(Boolean) as string[];
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
        <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-sm font-bold border-primary text-primary hover:bg-primary/5">
          <Printer className="mr-2 h-4 w-4" /> Print Report
        </Button>
      </div>

      <Card id="printable-report-area" className="rounded-sm shadow-xl overflow-hidden border-primary/10">
        <CardHeader className="bg-primary/5 border-b p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={cn("h-6 text-[10px] uppercase font-black px-3 rounded-sm border-none shadow-sm", visit.status === 'ongoing' ? "bg-amber-500 text-white" : "bg-green-600 text-white")}>
                  {visit.status}
                </Badge>
                <div className="flex items-center gap-1.5 text-[9px] font-black text-muted-foreground uppercase bg-white/50 px-2.5 py-1 rounded-sm border border-primary/10">
                  <FolderArchive className="h-3 w-3" /> Audit ID: {visit.id.slice(0, 8)}
                </div>
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground leading-none">{visit.siteName}</h1>
              
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1">
                <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                  <User className="h-4 w-4 text-primary" />
                  {visit.managerName}
                  {visit.department && (
                    <Badge variant="outline" className="ml-1 text-[8px] h-4 font-black uppercase border-primary/20 text-primary bg-primary/5 px-1.5">
                      {visit.department}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground font-semibold">
                  <Calendar className="h-4 w-4 text-primary" />
                  {formatTimestamp(visit.startTime)}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col md:items-end gap-2 shrink-0">
              <div className="p-4 bg-white/80 backdrop-blur rounded-sm border border-primary/10 shadow-sm text-center min-w-[160px]">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Trip Duration</p>
                <div className="flex items-center justify-center gap-2 text-primary font-black text-2xl">
                  <Timer className="h-6 w-6" />
                  {calculateDuration(visit.startTime, visit.endTime)}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 md:p-10 space-y-12">
          {/* Top Grid: Critical Verification Data */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Presence Audit */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b pb-2">
                <UserCheck className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">Personnel Verification</h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {visit.selfieUrl ? (
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Verification Selfie</Label>
                    <div className="relative aspect-square sm:aspect-[4/3] rounded-sm overflow-hidden border-2 border-primary/5 shadow-md bg-muted group cursor-pointer" onClick={() => openViewer(visit.selfieUrl!)}>
                      {isVideoUrl(visit.selfieUrl) ? (
                        <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                          <Film className="h-10 w-10 text-white opacity-40" />
                          <PlayCircle className="absolute h-10 w-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      ) : (
                        <img src={visit.selfieUrl} className="w-full h-full object-cover" alt="Audit Selfie" />
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors no-print">
                        <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 border-2 border-dashed rounded-sm bg-muted/5 flex flex-col items-center justify-center text-center opacity-40">
                    <ImageIcon className="h-8 w-8 mb-2" />
                    <p className="text-[10px] font-black uppercase">No Media</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">GPS Coordinates</Label>
                    <div className="space-y-2">
                      <div className="p-3 bg-muted/20 border rounded-sm flex items-center justify-between group text-[11px] font-mono font-bold">
                        <span>Entry: {visit.startLat.toFixed(5)}, {visit.startLng.toFixed(5)}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-primary no-print" asChild>
                          <a href={`https://www.google.com/maps/search/?api=1&query=${visit.startLat},${visit.startLng}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      </div>
                      {visit.endLat && (
                        <div className="p-3 bg-muted/20 border rounded-sm flex items-center justify-between group text-[11px] font-mono font-bold">
                          <span>Exit: {visit.endLat.toFixed(5)}, {visit.endLng.toFixed(5)}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-primary no-print" asChild>
                            <a href={`https://www.google.com/maps/search/?api=1&query=${visit.endLat},${visit.endLng}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {visit.customerAvailable && (
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-sm">
                      <Label className="text-[9px] font-black uppercase text-emerald-700 block mb-1">Customer Present</Label>
                      <p className="text-xs font-black text-emerald-900 leading-tight">{visit.customerNames || 'Confirmed'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Visit Context */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b pb-2">
                <Navigation className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">Visit Narrative</h3>
              </div>
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Purpose of Visit</Label>
                  <p className="text-sm font-black text-primary leading-tight uppercase">{visit.purpose || 'General Management'}</p>
                </div>
                <div className="p-5 bg-card border rounded-sm shadow-inner min-h-[120px]">
                  <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-2 opacity-50">Narrative & Observations</Label>
                  <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap font-medium italic">
                    "{visit.details || 'No additional narrative logged.'}"
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator className="opacity-50" />

          {/* Action Items Section - Grid Layout */}
          <div className="space-y-8">
            <div className="flex items-center justify-between gap-4 border-b pb-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">Activity & Findings Proof</h3>
              </div>
              <Badge variant="secondary" className="rounded-full px-3 py-0.5 h-5 text-[10px] font-bold bg-muted text-muted-foreground border-none">
                {visit.tasks?.length || 0} Items Logged
              </Badge>
            </div>

            {visit.tasks && visit.tasks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-10">
                {visit.tasks.map((task, i) => (
                  <div key={i} className="flex flex-col gap-4 animate-in fade-in duration-500">
                    <div className="flex gap-3 items-start">
                      <div className="h-6 w-6 rounded-sm bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary shrink-0 border border-primary/20">
                        {i + 1}
                      </div>
                      <p className="text-sm font-bold leading-snug pt-0.5 text-foreground">{task.text}</p>
                    </div>
                    
                    {task.photoUrl ? (
                      <div className="relative w-full aspect-[16/10] rounded-sm overflow-hidden border border-primary/10 shadow-sm bg-muted group cursor-pointer" onClick={() => openViewer(task.photoUrl!)}>
                        {isVideoUrl(task.photoUrl) ? (
                          <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                            <Film className="h-8 w-8 text-white opacity-40" />
                            <PlayCircle className="absolute h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        ) : (
                          <img src={task.photoUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt={`Task Proof ${i+1}`} />
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors no-print">
                          <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100" />
                        </div>
                        <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded-sm text-[8px] font-black text-white uppercase tracking-widest opacity-80">
                          Proof Attachment
                        </div>
                      </div>
                    ) : (
                      <div className="h-20 bg-muted/10 border border-dashed rounded-sm flex items-center justify-center text-[9px] font-bold text-muted-foreground uppercase opacity-40">
                        Documentation provided without visual proof
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center border-2 border-dashed rounded-sm bg-muted/5">
                <Activity className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">No specific action items documented</p>
              </div>
            )}
          </div>
        </CardContent>
        
        <Separator className="opacity-50" />
        
        <CardFooter className="bg-muted/5 p-8 flex flex-col items-center justify-center text-center gap-2">
          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.3em]">End of Official Audit Record</p>
          <p className="text-[8px] text-muted-foreground/40 font-mono">Digitally signed and time-stamped by Aditya Pro Engine</p>
        </CardFooter>
      </Card>

      {/* Media Preview Overlay */}
      <Dialog open={!!viewUrl} onOpenChange={(o) => { if(!o) { setZoom(1); setViewUrl(null); setViewUrls([]); } }}>
        <DialogContent className="max-w-[95vw] h-[90vh] p-0 border-none bg-black/95 flex flex-col items-center justify-center rounded-sm overflow-hidden shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Audit Media Detail</DialogTitle>
            <DialogDescription>Enlarged view of site audit proof.</DialogDescription>
          </DialogHeader>
          
          <div className="absolute top-4 left-4 flex gap-2 z-50 no-print">
            <Button variant="secondary" size="icon" className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white border-none" onClick={(e) => { e.stopPropagation(); setZoom(prev => Math.min(prev + 0.25, 4)); }} title="Zoom In">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon" className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white border-none" onClick={(e) => { e.stopPropagation(); setZoom(prev => Math.max(prev - 0.25, 0.5)); }} title="Zoom Out">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon" className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white border-none" onClick={(e) => { e.stopPropagation(); setZoom(1); }} title="Reset Zoom">
              <RotateCcw className="h-5 w-5" />
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
                <Badge variant="outline" className="bg-black/40 text-white border-none px-3 py-1 rounded-full font-mono text-xs">
                  {currentFileIndex + 1} / {viewUrls.length}
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
                  <video src={viewUrl} controls autoPlay className="max-w-full max-h-[85vh] shadow-2xl" />
                ) : (
                  <img src={viewUrl} className="max-w-full max-h-[85vh] object-contain shadow-2xl" alt="Audit Evidence" />
                )
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
