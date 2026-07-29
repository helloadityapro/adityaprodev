'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft, 
  Clock, 
  User, 
  Zap, 
  Maximize2, 
  X, 
  ThumbsUp, 
  ThumbsDown, 
  Loader2, 
  MapPin,
  Building2,
  Navigation,
  MessageCircle,
  TrendingUp,
  History,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Film,
  Download,
  FileImage,
  LayoutGrid
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { isSuperAdmin } from '@/lib/auth-constants';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

type Attachment = { url: string; contentType: string; name: string; };

type CheckPoint = { label: string; remarks: string; status: string; quantity?: number; attachments?: Attachment[] };

type HTConductorChecklist = {
  id: string;
  siteId: string;
  siteName: string;
  projectCompany: string;
  poleConfiguration: string;
  poleType?: string;
  poleNumber: string;
  poleSize: string;
  studSize?: string;
  cutPointType: string;
  userName: string;
  userId: string;
  status: string;
  createdAt: any;
  updatedAt?: any;
  checks: CheckPoint[];
  adminRemarks?: string;
  additionalRemarks?: string;
  generalPhotos?: Attachment[];
  processedBy?: string;
  processedByName?: string;
  processedAt?: any;
  editHistory?: {
    editedBy: string;
    editedById: string;
    timestamp: any;
    previousValues: {
      checks: CheckPoint[];
      additionalRemarks?: string;
      poleNumber?: string;
      poleConfiguration?: string;
      poleType?: string;
      poleSize?: string;
      studSize?: string;
      cutPointType?: string;
    }
  }[];
};

export default function HTLineAuditViewPage({ params }: { params: Promise<{ siteId: string, checklistId: string }> }) {
  const { siteId, checklistId } = React.use(params);
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const auditRef = useMemoFirebase(() => doc(firestore, 'ht_line_checklists', checklistId), [firestore, checklistId]);
  const { data: audit, isLoading: auditLoading } = useDoc<HTConductorChecklist>(auditRef);

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [approvingAction, setApprovingAction] = React.useState<'Approved' | 'Rejected' | null>(null);

  // Advanced Media Viewer State
  const [viewFile, setViewFile] = React.useState<Attachment | null>(null);
  const [viewFiles, setViewFiles] = React.useState<Attachment[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = React.useState(0);
  const [scale, setScale] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [startPan, setStartPan] = React.useState({ x: 0, y: 0 });

  const containerRef = React.useRef<HTMLDivElement>(null);
  const mediaRef = React.useRef<HTMLDivElement>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';
  const canApprove = isAdmin || isManager;

  const handleProcessAudit = async (remarks: string) => {
    if (!approvingAction || !audit) return;
    setIsProcessing(true);
    try {
      await updateDocumentNonBlocking(auditRef, {
        status: approvingAction,
        adminRemarks: remarks || "",
        processedBy: user?.uid,
        processedByName: userProfile?.username || user?.email,
        processedAt: serverTimestamp()
      });
      toast({ title: `Audit ${approvingAction}` });
      setApprovingAction(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Action Failed", description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const isPointEdited = React.useCallback((label: string) => {
    if (!audit?.editHistory || audit.editHistory.length === 0) return false;
    const originalChecks = audit.editHistory[0].previousValues.checks;
    const currentCheck = audit.checks?.find(c => c.label === label);
    const originalCheck = originalChecks?.find(c => c.label === label);
    if (!originalCheck || !currentCheck) return false;
    return originalCheck.status !== currentCheck.status || 
           originalCheck.quantity !== currentCheck.quantity || 
           originalCheck.remarks !== currentCheck.remarks;
  }, [audit]);

  // Viewer Helpers
  const isVideo = (file: Attachment) => {
    const type = file.contentType?.toLowerCase() || '';
    const name = (file.name || '').toLowerCase();
    return type.startsWith('video/') || name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.webm');
  };

  const isHeic = (file: Attachment) => {
    const name = (file.name || "").toLowerCase();
    return name.endsWith('.heic') || name.endsWith('.heif');
  };

  const resetViewer = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const openViewer = (file: Attachment, gallery: Attachment[]) => {
    setViewFiles(gallery);
    setCurrentFileIndex(gallery.findIndex(a => a.url === file.url) || 0);
    setViewFile(file);
    resetViewer();
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!viewFile || isVideo(viewFile) || isHeic(viewFile)) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    const newScale = Math.min(Math.max(scale + delta, 1), 4);
    setScale(newScale);
    if (newScale === 1) setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1 || (viewFile && (isVideo(viewFile) || isHeic(viewFile)))) return;
    setIsDragging(true);
    setStartPan({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    const newX = e.clientX - startPan.x;
    const newY = e.clientY - startPan.y;
    const limitX = Math.max(0, (window.innerWidth * scale - window.innerWidth) / 2);
    const limitY = Math.max(0, (window.innerHeight * scale - window.innerHeight) / 2);
    setPosition({ x: Math.min(Math.max(newX, -limitX), limitX), y: Math.min(Math.max(newY, -limitY), limitY) });
  };

  const handleMouseUp = () => setIsDragging(false);
  const nextFile = () => { if (viewFiles.length <= 1) return; const nextIdx = (currentFileIndex + 1) % viewFiles.length; setCurrentFileIndex(nextIdx); setViewFile(viewFiles[nextIdx]); resetViewer(); };
  const prevFile = () => { if (viewFiles.length <= 1) return; const prevIdx = (currentFileIndex - 1 + viewFiles.length) % viewFiles.length; setCurrentFileIndex(prevIdx); setViewFile(viewFiles[prevIdx]); resetViewer(); };

  if (auditLoading) return <div className="p-8 space-y-4 max-w-4xl mx-auto"><Skeleton className="h-10 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!audit) return <div className="p-12 text-center italic">Record not found.</div>;

  const allGalleryFiles = [
    ...(audit.checks?.flatMap(c => c.attachments || []) || []),
    ...(audit.generalPhotos || [])
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Registry
        </Button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2.5 rounded-sm shrink-0"><Zap className="h-6 w-6 text-primary" /></div>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight truncate">HT Line Pole Audit</h1>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">{audit.siteName} • Pole #{audit.poleNumber}</p>
              </div>
           </div>
           <Badge variant="outline" className={cn(
             "rounded-sm text-[10px] font-black uppercase px-3 h-8",
             audit.status === 'Approved' ? "bg-green-100 text-green-700 border-green-200" :
             audit.status === 'Rejected' ? "bg-red-100 text-red-700 border-red-200" :
             audit.status === 'Draft' ? "bg-amber-100 text-amber-700 border-amber-200" :
             "bg-yellow-50 text-yellow-700 border-yellow-200"
           )}>{audit.status === 'Draft' ? 'In Progress' : audit.status}</Badge>
        </div>
      </div>

      <Card className="rounded-sm shadow-xl border-primary/10 overflow-hidden">
        <CardHeader className="bg-primary/5 border-b p-6 md:p-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 md:gap-8">
            <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Personnel</Label><p className="text-sm font-bold flex items-center gap-2"><User className="h-3.5 w-3.5 text-primary opacity-50" />{audit.userName}</p></div>
            <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Pole Config</Label><p className="text-sm font-bold uppercase">{audit.poleConfiguration || 'Single Pole'}</p></div>
            {audit.poleType && <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-primary tracking-widest">Plant Config</Label><p className="text-sm font-bold uppercase">{audit.poleType}</p></div>}
            <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Pole Size</Label><p className="text-xs font-bold leading-tight">{audit.poleSize}</p></div>
            <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Timestamp</Label><p className="text-xs font-mono font-bold text-muted-foreground">{audit.createdAt ? format(audit.createdAt.toDate(), 'dd MMM yy, HH:mm') : '—'}</p></div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y border-b">
            {audit.checks?.map((check, idx) => (
              <div key={idx} className="p-6 md:p-8 space-y-4 hover:bg-primary/[0.01] transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="text-base font-black uppercase tracking-tight text-foreground block">{check.label}</span>
                        {isPointEdited(check.label) && (
                            <span className="text-[10px] text-blue-600 italic font-medium ml-1">*edited</span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={cn(
                        "rounded-sm text-[9px] font-bold uppercase px-2 h-5",
                        check.status === 'Yes' ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                      )}>{check.status}</Badge>
                      {check.quantity > 0 && <Badge variant="secondary" className="h-5 rounded-sm text-[10px] font-black">Qty: {check.quantity}</Badge>}
                    </div>
                  </div>
                </div>

                {check.remarks && <p className="p-3 bg-muted/20 border rounded-sm italic text-sm text-foreground/80 leading-relaxed">"{check.remarks}"</p>}

                {check.attachments && check.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {check.attachments.map((file, fIdx) => (
                      <div key={fIdx} className="relative aspect-video w-32 md:w-40 rounded-sm overflow-hidden border shadow-sm cursor-pointer group" onClick={() => openViewer(file, allGalleryFiles)}>
                        {isVideo(file) ? (
                          <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                            <Film className="h-6 w-6 text-white/40" />
                          </div>
                        ) : (
                          <img src={file.url} className="w-full h-full object-cover" alt="Audit" />
                        )}
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Maximize2 className="h-5 w-5 text-white" /></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-6 md:p-8 space-y-6 bg-muted/5">
             {audit.generalPhotos && audit.generalPhotos.length > 0 && (
               <div>
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4 block">Pole Evidence Photos</Label>
                  <div className="flex flex-wrap gap-4">
                    {audit.generalPhotos.map((file, fIdx) => (
                      <div key={fIdx} className="relative aspect-square w-32 md:w-48 rounded-sm overflow-hidden border-2 border-white shadow-xl cursor-pointer group" onClick={() => openViewer(file, allGalleryFiles)}>
                        {isVideo(file) ? (
                          <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                            <Film className="h-8 w-8 text-white/40" />
                          </div>
                        ) : (
                          <img src={file.url} className="w-full h-full object-cover" alt="General" />
                        )}
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Maximize2 className="h-6 w-6 text-white" /></div>
                      </div>
                    ))}
                  </div>
               </div>
             )}
             {audit.additionalRemarks && (
               <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">General Remarks</Label>
                 <p className="text-sm italic leading-relaxed text-foreground/80 p-4 bg-background border rounded-sm">"{audit.additionalRemarks}"</p>
               </div>
             )}
          </div>

          {audit.adminRemarks && (
            <div className="p-8 bg-muted/5 border-t space-y-3">
               <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Authority Feedback</Label>
               <p className="text-sm italic leading-relaxed text-foreground/80 p-4 bg-background border rounded-sm">"{audit.adminRemarks}"</p>
               <div className="flex justify-end gap-2 text-[8px] font-bold text-muted-foreground/60 uppercase">
                  <span>Processed by {audit.processedByName}</span>
                  <span>•</span>
                  <span>{audit.processedAt ? format(audit.processedAt.toDate(), 'dd/MM/yyyy HH:mm') : ''}</span>
               </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revision History Section */}
      <div className="space-y-6 pt-10 no-print">
        <div className="flex items-center gap-3 border-b-2 border-primary/10 pb-3">
           <History className="h-6 w-6 text-primary" />
           <h2 className="text-2xl font-black uppercase tracking-tight">Audit Lifecycle & Revisions</h2>
        </div>
        
        {audit.editHistory && audit.editHistory.length > 0 ? (
          <div className="space-y-8 relative pl-6 ml-4 border-l-2 border-muted-foreground/10 py-4">
            {[...audit.editHistory].reverse().map((entry, eIdx) => {
              const getT = (ts: any) => {
                if (!ts) return 0;
                if (typeof ts === 'string') return new Date(ts).getTime();
                if (ts.toDate) return ts.toDate().getTime();
                if (ts instanceof Date) return ts.getTime();
                return 0;
              };
              const safeTime = format(new Date(getT(entry.timestamp)), 'dd MMM yyyy, HH:mm');
              
              return (
                <div key={eIdx} className="relative animate-in slide-in-from-left-4 duration-500">
                  <div className="absolute -left-[33px] top-1.5 h-3.5 w-3.5 rounded-full bg-primary ring-4 ring-background shadow-sm" />
                  <Card className="rounded-sm border-primary/10 shadow-md bg-muted/5 overflow-hidden">
                    <CardHeader className="bg-primary/5 py-3 px-6 border-b flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="rounded-sm bg-background font-black text-[9px] uppercase tracking-tighter border-primary/20">Version Snapshot</Badge>
                        <span className="text-11px font-black text-foreground uppercase tracking-tight">{entry.editedBy}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">{safeTime}</span>
                    </CardHeader>
                    <CardContent className="p-6 space-y-8">
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {entry.previousValues?.checks?.map((prevCheck: any, cIdx: number) => (
                            <div key={cIdx} className="p-3 border rounded-sm bg-background space-y-2 shadow-sm">
                               <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-black uppercase truncate pr-4 text-foreground/70">{prevCheck.label}</span>
                                  <Badge variant="outline" className={cn("h-4 text-[8px] font-black uppercase rounded-sm px-1", prevCheck.status === 'Yes' ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200")}>{prevCheck.status}</Badge>
                               </div>
                               {prevCheck.remarks && <p className="text-[10px] italic text-muted-foreground leading-snug line-clamp-1">"{prevCheck.remarks}"</p>}
                            </div>
                          ))}
                       </div>
                       {(entry.previousValues?.additionalRemarks || entry.previousValues?.poleConfiguration) && (
                          <div className="p-4 bg-muted/30 border rounded-sm space-y-2">
                             {entry.previousValues?.poleConfiguration && (
                               <div className="flex justify-between items-center text-[9px] font-bold uppercase border-b border-border/10 pb-2 mb-2">
                                  <span className="text-muted-foreground">Original Config:</span>
                                  <span className="text-primary">{entry.previousValues.poleConfiguration}</span>
                               </div>
                             )}
                             {entry.previousValues?.additionalRemarks && (
                                <>
                                  <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Previous Observations</Label>
                                  <p className="text-xs italic text-foreground/80 leading-relaxed">"{entry.previousValues.additionalRemarks}"</p>
                                </>
                             )}
                          </div>
                       )}
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-24 text-center border-2 border-dashed rounded-sm bg-muted/5 flex flex-col items-center justify-center gap-4 opacity-40">
             <History className="h-12 w-12 text-muted-foreground/20" />
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Original Version • No Revisions</p>
          </div>
        )}
      </div>

      {canApprove && audit.status === 'Pending' && (
        <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 bg-background/90 backdrop-blur border-t p-4 z-40 md:left-[16rem] animate-in slide-in-from-bottom-full duration-500 shadow-2xl">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
             <div className="hidden sm:block text-left">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Audit Resolution Center</p>
                <p className="text-[11px] font-bold text-foreground/60">Choose a decision for this Conductor audit.</p>
             </div>
             <div className="flex-1 sm:flex-none flex gap-3">
                <Button className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white font-black uppercase text-[10px] px-8 shadow-xl" onClick={() => setApprovingAction('Approved')}>Approve Audit</Button>
                <Button variant="destructive" className="flex-1 h-12 font-black uppercase text-[10px] px-8 shadow-xl" onClick={() => setApprovingAction('Rejected')}>Reject Audit</Button>
             </div>
          </div>
        </div>
      )}

      <Dialog open={!!approvingAction} onOpenChange={() => setApprovingAction(null)}>
        <DialogContent className="max-w-md w-[95vw] rounded-sm p-6">
          <DialogHeader className="text-left space-y-2">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Finalize {approvingAction}</DialogTitle>
            <DialogDescription className="text-xs font-medium">Archiving quality decision for this conductor log.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-3 text-left">
            <Label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase px-1">Authority Remarks (Optional)</Label>
            <Textarea id="final-action-remarks-htc" placeholder="Enter feedback..." className="min-h-[120px] rounded-sm" />
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-3">
            <DialogClose asChild><Button variant="outline" className="w-full sm:flex-1 h-12 font-bold rounded-sm text-[10px] uppercase">Cancel</Button></DialogClose>
            <Button className={cn("w-full sm:flex-1 h-12 rounded-sm font-black uppercase text-[10px]", approvingAction === 'Approved' ? 'bg-green-600' : 'bg-red-600')} 
              onClick={() => handleProcessAudit((document.getElementById('final-action-remarks-htc') as HTMLTextAreaElement)?.value || "")} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : `Confirm ${approvingAction}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advanced Media Viewer Dialog */}
      <Dialog open={!!viewFile} onOpenChange={(o) => { if(!o) { resetViewer(); setViewFile(null); setViewFiles([]); } }}>
        <DialogContent className="max-w-[95vw] h-[90vh] p-0 border-none bg-black/95 flex flex-col items-center justify-center rounded-sm overflow-hidden shadow-2xl z-[100]">
          <DialogHeader className="sr-only"><DialogTitle>Audit Media Evidence</DialogTitle></DialogHeader>
          <div className="absolute top-0 left-0 right-0 z-110 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent no-print">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-1.5 rounded-sm"><ImageIcon className="h-4 w-4 text-white" /></div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-white uppercase tracking-widest truncate max-w-[150px]">{viewFile?.name}</span>
                <span className="text-[8px] font-bold text-white/50 uppercase">{currentFileIndex + 1} of {viewFiles.length} Evidence Artifacts</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-white/10" onClick={() => setScale(prev => Math.min(prev + 0.5, 4))}><ZoomIn className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-white/10" onClick={() => { setScale(prev => Math.max(prev - 0.5, 1)); if(scale <= 1) setPosition({x:0,y:0}); }}><ZoomOut className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-white/10" onClick={() => setRotation(prev => (prev + 90) % 360)}><RotateCw className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-white/10" onClick={resetViewer}><RotateCcw className="h-5 w-5" /></Button>
              <Separator orientation="vertical" className="h-6 bg-white/20 mx-2" />
              <DialogClose asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-red-500"><X className="h-6 w-6" /></Button></DialogClose>
            </div>
          </div>

          {viewFiles.length > 1 && (
            <>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 z-110">
                <Button variant="secondary" size="icon" className="h-12 w-12 rounded-full bg-white/10 text-white border-none shadow-2xl backdrop-blur-md hover:bg-white/20" onClick={(e) => { e.stopPropagation(); prevFile(); }}><ChevronLeft className="h-8 w-8" /></Button>
              </div>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 z-110">
                <Button variant="secondary" size="icon" className="h-12 w-12 rounded-full bg-white/10 text-white border-none shadow-2xl backdrop-blur-md hover:bg-white/20" onClick={(e) => { e.stopPropagation(); nextFile(); }}><ChevronRight className="h-8 w-8" /></Button>
              </div>
            </>
          )}

          <div 
            ref={containerRef} 
            className={cn("relative w-full h-full flex items-center justify-center overflow-hidden touch-none z-[105]", scale > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default")} 
            onWheel={handleWheel} 
            onMouseDown={handleMouseDown} 
            onMouseMove={handleMouseMove} 
            onMouseUp={handleMouseUp} 
            onMouseLeave={handleMouseUp}
          >
            <div 
              ref={mediaRef} 
              className={cn("transition-transform duration-200 ease-out flex items-center justify-center pointer-events-none w-fit h-fit", isDragging && "transition-none")} 
              style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}
            >
              {viewFile && (
                isVideo(viewFile) ? (
                  <div className="pointer-events-auto"><video src={viewFile.url} controls autoPlay className="max-w-[90vw] max-h-[75vh] shadow-2xl rounded-sm" /></div>
                ) : isHeic(viewFile) ? (
                  <div className="bg-white/5 p-12 rounded-sm flex flex-col items-center gap-6 text-center pointer-events-auto">
                    <FileImage className="h-16 w-16 text-primary opacity-20" />
                    <p className="text-white font-black text-sm uppercase tracking-widest">HEIC Media Unsupported</p>
                    <Button asChild className="rounded-sm font-bold uppercase text-[10px] tracking-widest"><a href={viewFile.url} download={viewFile.name}><Download className="h-3.5 w-3.5 mr-2" /> Download File</a></Button>
                  </div>
                ) : (
                  <img src={viewFile.url} className="max-w-[90vw] max-h-[75vh] object-contain shadow-2xl rounded-sm" alt="Evidence" />
                )
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
