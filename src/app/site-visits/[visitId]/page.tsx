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
  RotateCw,
  Building2, 
  ChevronLeft, 
  ChevronRight, 
  PlayCircle, 
  Film,
  Calendar,
  Clock,
  ShieldCheck,
  Activity,
  Globe
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
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
  locationType?: 'site' | 'other';
};

const formatTimestamp = (ts: any) => {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : (typeof ts === 'string' ? new Date(ts) : ts);
  return format(date, 'dd MMM yyyy HH:mm');
};

const calculateDurationMins = (start: any, end: any) => {
  if (!start || !end) return 0;
  const s = start.toDate ? start.toDate() : new Date(start);
  const e = end.toDate ? end.toDate() : new Date(end);
  return differenceInMinutes(e, s);
};

const calculateDurationStr = (mins: number) => {
  if (mins === 0) return '—';
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
  const [rotation, setRotation] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [startPan, setStartPan] = React.useState({ x: 0, y: 0 });

  const viewerRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const visitRef = useMemoFirebase(() => doc(firestore, 'site_visits', visitId), [firestore, visitId]);
  const { data: visit, isLoading } = useDoc<SiteVisit>(visitRef);

  // Zoom logic for media preview
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || !viewUrl) return;

    const onWheel = (e: WheelEvent) => {
      if (isVideoUrl(viewUrl)) return;
      e.preventDefault();
      setZoom(prev => {
        const delta = e.deltaY > 0 ? -0.2 : 0.2;
        const next = Math.min(Math.max(prev + delta, 0.5), 4);
        if (next === 1) setPosition({ x: 0, y: 0 });
        return next;
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [viewUrl]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const resetViewer = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const openViewer = (url: string) => {
    const urls = [visit?.selfieUrl, ...(visit?.tasks?.map(t => t.photoUrl) || [])].filter(Boolean) as string[];
    const index = urls.indexOf(url);
    setViewUrls(urls);
    setCurrentUrlIndex(index >= 0 ? index : 0);
    setViewUrl(url);
    resetViewer();
  };

  const nextUrl = () => {
    if (viewUrls.length <= 1) return;
    const nextIdx = (currentUrlIndex + 1) % viewUrls.length;
    setCurrentUrlIndex(nextIdx);
    setViewUrl(viewUrls[nextIdx]);
    resetViewer();
  };

  const prevUrl = () => {
    if (viewUrls.length <= 1) return;
    const prevIdx = (currentUrlIndex - 1 + viewUrls.length) % viewUrls.length;
    setCurrentUrlIndex(prevIdx);
    setViewUrl(viewUrls[prevIdx]);
    resetViewer();
  };

  const rotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1 || (viewUrl && isVideoUrl(viewUrl))) return;
    setIsDragging(true);
    setStartPan({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    const newX = e.clientX - startPan.x;
    const newY = e.clientY - startPan.y;
    
    // Boundary limits roughly based on scale
    const limitX = Math.max(0, (window.innerWidth * zoom - window.innerWidth) / 2);
    const limitY = Math.max(0, (window.innerHeight * zoom - window.innerHeight) / 2);

    setPosition({
      x: Math.min(Math.max(newX, -limitX), limitX),
      y: Math.min(Math.max(newY, -limitY), limitY)
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleDoubleClick = () => {
    if (viewUrl && isVideoUrl(viewUrl)) return;
    if (zoom > 1) {
      resetViewer();
    } else {
      setZoom(2);
    }
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
      <h2 className="text-xl font-bold">Audit Report Not Found</h2>
      <p className="text-muted-foreground mt-2">The requested report does not exist or has been removed.</p>
      <Button variant="outline" className="mt-6" onClick={() => router.push('/site-visits/history')}>Back to History</Button>
    </div>
  );

  const isSite = visit.locationType !== 'other';

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
                  {visit.status === 'pending_upload' ? 'Syncing...' : visit.status}
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
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Total Duration</p>
                <div className="flex items-center justify-center gap-2 text-primary font-black text-2xl">
                  <Timer className="h-6 w-6" />
                  {calculateDurationStr(calculateDurationMins(visit.startTime, visit.endTime))}
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
                    <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Verification Audit Photo</Label>
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
                    <p className="text-[10px] font-black uppercase">No Audit Proof</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">GPS Audit Trail</Label>
                    <div className="space-y-2">
                      <div className="p-3 bg-muted/20 border rounded-sm flex items-center justify-between group text-[11px] font-mono font-bold">
                        <span>Arrival: {visit.startLat.toFixed(5)}, {visit.startLng.toFixed(5)}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-primary no-print" asChild>
                          <a href={`https://www.google.com/maps/search/?api=1&query=${visit.startLat},${visit.startLng}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </div>
                      {visit.endLat && (
                        <div className="p-3 bg-muted/20 border rounded-sm flex items-center justify-between group text-[11px] font-mono font-bold">
                          <span>Departure: {visit.endLat.toFixed(5)}, {visit.endLng.toFixed(5)}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-primary no-print" asChild>
                            <a href={`https://www.google.com/maps/search/?api=1&query=${visit.endLat},${visit.endLng}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {visit.customerAvailable && (
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-sm">
                      <Label className="text-[9px] font-black uppercase text-emerald-700 block mb-1">Contact Verification</Label>
                      <p className="text-xs font-black text-emerald-900 leading-tight">{visit.customerNames || 'Confirmed present'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Visit Context */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b pb-2">
                <Navigation className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">Audit Summary</h3>
              </div>
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Purpose</Label>
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
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">Activity Proof & Evidence</h3>
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
                          <img src={task.photoUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt={`Evidence ${i+1}`} />
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors no-print">
                          <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100" />
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
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">No activity items documented</p>
              </div>
            )}
          </div>
        </CardContent>
        
        <Separator className="opacity-50" />
        
        <CardFooter className="bg-muted/5 p-8 flex flex-col items-center justify-center text-center gap-2">
          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.3em]">End of Official Visit Record</p>
          <p className="text-[8px] text-muted-foreground/40 font-mono">Aditya Pro</p>
        </CardFooter>
      </Card>

      {/* Advanced Media Viewer Dialog */}
      <Dialog open={!!viewUrl} onOpenChange={(o) => { if(!o) { resetViewer(); setViewUrl(null); setViewUrls([]); } }}>
        <DialogContent className="max-w-[95vw] h-[90vh] p-0 border-none bg-black/95 flex flex-col items-center justify-center rounded-sm overflow-hidden shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Audit Media Viewer</DialogTitle>
            <DialogDescription>Verification media details</DialogDescription>
          </DialogHeader>
          
          <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent no-print">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-1.5 rounded-sm"><ImageIcon className="h-4 w-4 text-white" /></div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-white uppercase tracking-widest truncate max-w-[150px]">Media Audit</span>
                <span className="text-[8px] font-bold text-white/60 uppercase">{currentUrlIndex + 1} of {viewUrls.length} File{viewUrls.length > 1 ? 's' : ''}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-white/5 hover:bg-white/20 text-white border-none" onClick={() => setZoom(prev => Math.min(prev + 0.5, 4))} title="Zoom In"><ZoomIn className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-white/5 hover:bg-white/20 text-white border-none" onClick={() => { setZoom(prev => Math.max(prev - 0.5, 1)); if(zoom <= 1) setPosition({x:0,y:0}); }} title="Zoom Out"><ZoomOut className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-white/5 hover:bg-white/20 text-white border-none" onClick={rotate} title="Rotate Clockwise"><RotateCw className="h-5 w-5" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-white/5 hover:bg-white/20 text-white border-none" onClick={resetViewer} title="Reset View"><RotateCcw className="h-5 w-5" /></Button>
              <Separator orientation="vertical" className="h-6 bg-white/20 mx-2" />
              <DialogClose asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-white/10 hover:bg-red-500 transition-colors"><X className="h-6 w-6" /></Button></DialogClose>
            </div>
          </div>

          {viewUrls.length > 1 && (
            <>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50">
                <Button variant="secondary" size="icon" className="h-12 w-12 rounded-full bg-white/10 text-white border-none shadow-2xl backdrop-blur-md hover:bg-white/20" onClick={(e) => { e.stopPropagation(); prevUrl(); }}><ChevronLeft className="h-8 w-8" /></Button>
              </div>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 z-50">
                <Button variant="secondary" size="icon" className="h-12 w-12 rounded-full bg-white/10 text-white border-none shadow-2xl backdrop-blur-md hover:bg-white/20" onClick={(e) => { e.stopPropagation(); nextUrl(); }}><ChevronRight className="h-8 w-8" /></Button>
              </div>
            </>
          )}

          <div 
            ref={containerRef} 
            className={cn(
              "relative w-full h-full flex items-center justify-center overflow-hidden touch-none",
              zoom > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
            )}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
          >
            <div 
              ref={mediaRef}
              className={cn("transition-transform duration-200 ease-out will-change-transform flex items-center justify-center select-none pointer-events-none w-fit h-fit", isDragging && "transition-none")}
              style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)` }}
            >
              {viewUrl && (
                isVideoUrl(viewUrl) ? (
                  <div className="pointer-events-auto"><video src={viewUrl} controls autoPlay className="max-w-[90vw] max-h-[80vh] shadow-2xl rounded-sm" /></div>
                ) : (
                  <img src={viewUrl} className="max-w-[90vw] max-h-[80vh] object-contain shadow-2xl rounded-sm pointer-events-none" alt="Evidence View" draggable={false} />
                )
              )}
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent flex flex-col items-center gap-2 no-print">
            <div className="flex gap-1.5">
              {viewUrls.map((_, i) => (
                <div key={i} className={cn("h-1 w-6 rounded-full transition-all duration-300", i === currentUrlIndex ? "bg-primary w-12" : "bg-white/20")} />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
