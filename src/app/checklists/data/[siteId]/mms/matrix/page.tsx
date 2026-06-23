'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, doc, limit, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  LayoutGrid, 
  FileDown, 
  Loader2, 
  Check, 
  X, 
  AlertTriangle,
  Building2,
  ImageIcon,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Film,
  PlayCircle,
  FileImage,
  Download,
  MessageCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { isSuperAdmin } from '@/lib/auth-constants';
import { useToast } from '@/hooks/use-toast';
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter
} from "@/components/ui/dialog";

type Attachment = {
  url: string;
  contentType: string;
  name: string;
};

type Site = { 
  id: string; 
  name: string; 
  projectCompany?: string; 
};

type InstallationChecklist = {
  id: string;
  siteId: string;
  siteName: string;
  projectCompany?: string;
  tableNumber: string;
  checks: { 
    key?: string; 
    label: string; 
    remarks: string; 
    status: 'OK' | 'NOT OK' | 'Pending'; 
    attachments?: Attachment[] 
  }[];
};

const CHECK_LABELS = {
  moduleNutBolt: "Module Nut-bolt Tightness",
  mmsNutBolt: "MMS Nut-Bolt Tightness",
  crackedModules: "Module Condition/Cracks",
  cableDressing: "Cable Dressing",
  cappingCondition: "Capping Condition",
  earthingCondition: "Earthing Condition",
};

export default function ProjectMmsMatrixPage({ params }: { params: Promise<{ siteId: string }> }) {
  const resolvedParams = React.use(params);
  const siteId = resolvedParams.siteId;
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [isExporting, setIsExporting] = React.useState(false);
  const [generationProgress, setGenerationProgress] = React.useState(0);

  // Media Viewer State
  const [viewFile, setViewFile] = React.useState<Attachment | null>(null);
  const [viewFiles, setViewFiles] = React.useState<Attachment[]>([]);
  const [viewRemarks, setViewRemarks] = React.useState<string>("");
  const [currentFileIndex, setCurrentFileIndex] = React.useState(0);
  const [scale, setScale] = React.useState(1);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [startPan, setStartPan] = React.useState({ x: 0, y: 0 });

  const containerRef = React.useRef<HTMLDivElement>(null);
  const mediaRef = React.useRef<HTMLDivElement>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const siteRef = useMemoFirebase(() => doc(firestore, 'sites', siteId), [firestore, siteId]);
  const { data: site, isLoading: siteLoading } = useDoc<Site>(siteRef);

  const instQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'installation_checklists'), where('siteId', '==', siteId), limit(1000));
  }, [firestore, siteId]);
  const { data: instRecords, isLoading: instLoading } = useCollection<InstallationChecklist>(instQuery);

  const filteredInst = React.useMemo(() => {
    if (!instRecords) return [];
    return [...instRecords].sort((a, b) => 
      a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [instRecords]);

  // Viewer Helpers
  const isVideo = (file: Attachment) => {
    const type = file.contentType?.toLowerCase() || '';
    const name = file.name?.toLowerCase() || '';
    return type.startsWith('video/') || name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.webm');
  };

  const isHeic = (file: Attachment) => {
    const name = (file.name || "").toLowerCase();
    return name.endsWith('.heic') || name.endsWith('.heif');
  };

  const resetViewer = () => { setScale(1); setPosition({ x: 0, y: 0 }); };

  const openViewer = (file: Attachment, gallery: Attachment[], remarks: string) => {
    setViewFiles(gallery);
    setCurrentFileIndex(gallery.findIndex(a => a.url === file.url) || 0);
    setViewFile(file);
    setViewRemarks(remarks);
    resetViewer();
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!viewFile || isVideo(viewFile) || isHeic(viewFile)) return;
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
  const handleDoubleClick = () => { if (viewFile && (isVideo(viewFile) || isHeic(viewFile))) return; if (scale > 1) { setScale(1); setPosition({ x: 0, y: 0 }); } else { setScale(2); } };
  const nextFile = () => { if (viewFiles.length <= 1) return; const nextIdx = (currentFileIndex + 1) % viewFiles.length; setCurrentFileIndex(nextIdx); setViewFile(viewFiles[nextIdx]); resetViewer(); };
  const prevFile = () => { if (viewFiles.length <= 1) return; const prevIdx = (currentFileIndex - 1 + viewFiles.length) % viewFiles.length; setCurrentFileIndex(prevIdx); setViewFile(viewFiles[prevIdx]); resetViewer(); };

  const handleExportMatrixPDF = async () => {
    if (filteredInst.length === 0) return;
    setIsExporting(true);
    setGenerationProgress(0);

    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF('l', 'mm', 'a4');
      const margin = 10;
      let currY = 25;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(`SITE CHECKLIST MATRIX: ${site?.name || 'MMS'}`, margin, 15);
      doc.setFontSize(10);
      doc.text(`Project Company: ${site?.projectCompany || 'Aditya Green Energy'}`, margin, 20);

      const tableCols = ['Table Ref', ...Object.values(CHECK_LABELS)];
      const colWidths = [30, 40, 40, 40, 40, 40, 40];
      
      const drawHeader = () => {
        doc.setFillColor(45, 115, 255); // Primary blue
        doc.rect(margin, currY, 277, 12, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        let x = margin;
        tableCols.forEach((col, i) => {
          const lines = doc.splitTextToSize(col.toUpperCase(), colWidths[i] - 4);
          doc.text(lines, x + 2, currY + 5);
          x += colWidths[i];
        });
        currY += 12;
        doc.setTextColor(0, 0, 0);
      };

      drawHeader();

      filteredInst.forEach((record, index) => {
        if (currY > 180) {
          doc.addPage();
          currY = 25;
          drawHeader();
        }

        setGenerationProgress(Math.round(((index + 1) / filteredInst.length) * 100));
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        let x = margin;
        
        doc.rect(margin, currY, 277, 8);
        
        doc.setFont('helvetica', 'bold');
        doc.text(record.tableNumber, x + 2, currY + 5.5);
        doc.setFont('helvetica', 'normal');
        x += colWidths[0];

        Object.keys(CHECK_LABELS).forEach((key, i) => {
          const check = record.checks.find(c => c.key === key || c.label === (CHECK_LABELS as any)[key]);
          const status = check?.status || '—';
          if (status === 'OK') doc.setTextColor(0, 128, 0);
          else if (status === 'NOT OK') doc.setTextColor(255, 0, 0);
          else if (status === 'Pending') doc.setTextColor(218, 165, 32);
          
          doc.text(status, x + 2, currY + 5.5);
          doc.setTextColor(0, 0, 0);
          x += colWidths[i + 1];
        });

        currY += 8;
      });

      doc.save(`AdityaPro_Matrix_${site?.name.replace(/\s+/g, '_')}.pdf`);
      toast({ title: 'Matrix Exported' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Export Failed', description: error.message });
    } finally {
      setIsExporting(false);
      setGenerationProgress(0);
    }
  };

  React.useEffect(() => {
    if (!isProfileLoading && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [isProfileLoading, isAdmin, router]);

  if (isProfileLoading || siteLoading || instLoading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6 md:space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/checklists/data/${siteId}/mms`)} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Registry
        </Button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-sm"><LayoutGrid className="h-6 w-6 text-primary" /></div>
            <div>
              <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight">{site?.name} Checklist Records</h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Master Quality Data Feed</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleExportMatrixPDF} disabled={isExporting || filteredInst.length === 0} variant="outline" size="sm" className="h-10 rounded-sm font-black uppercase text-[10px] tracking-widest border-primary/20 text-primary">
              {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <FileDown className="h-3.5 w-3.5 mr-1.5" />} 
              PDF Summary
            </Button>
          </div>
        </div>
      </div>

      {isExporting && (
        <div className="space-y-1.5 animate-in fade-in duration-300">
          <div className="flex justify-between items-center text-[8px] font-black uppercase text-primary tracking-tighter">
            <span>Rendering Document</span>
            <span>{generationProgress}%</span>
          </div>
          <Progress value={generationProgress} className="h-1 rounded-none" />
        </div>
      )}

      <Card className="rounded-sm border-primary/10 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
        <div className="flex-1 overflow-hidden relative">
          <ScrollArea className="h-[calc(100vh-250px)] w-full">
            <div className="min-w-full">
              <TooltipProvider delayDuration={0}>
                <Table className="border-collapse table-fixed w-full">
                  <TableHeader className="sticky top-0 z-[60] shadow-md bg-primary">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[150px] font-black uppercase text-xs md:text-sm tracking-widest border-r bg-primary text-white sticky left-0 top-0 z-[70] px-6 py-4">Table Ref</TableHead>
                      {Object.entries(CHECK_LABELS).map(([key, label]) => (
                        <TableHead key={key} className="text-center font-black uppercase text-[10px] md:text-xs tracking-tight leading-tight w-[160px] px-3 py-4 bg-primary text-white border-r last:border-0 sticky top-0 z-[60]">{label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInst.length > 0 ? filteredInst.map((record) => (
                      <TableRow key={record.id} className="hover:bg-primary/[0.02] transition-colors border-b last:border-0">
                        <TableCell className="px-6 py-4 font-black text-sm border-r bg-background sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">{record.tableNumber}</TableCell>
                        {Object.keys(CHECK_LABELS).map((key) => {
                          const check = record.checks.find(c => c.key === key || c.label === (CHECK_LABELS as any)[key]);
                          const status = check?.status;
                          return (
                            <TableCell key={key} className="text-center py-4 border-r last:border-0 w-[160px] p-0">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="w-full h-full flex justify-center items-center py-4 cursor-help">
                                    {status === 'OK' ? (
                                      <Check className="h-5 w-5 text-green-600 drop-shadow-sm" />
                                    ) : status === 'NOT OK' ? (
                                      <X className="h-5 w-5 text-red-600 drop-shadow-sm" />
                                    ) : status === 'Pending' ? (
                                      <AlertTriangle className="h-5 w-5 text-amber-500 drop-shadow-sm" />
                                    ) : (
                                      <span className="text-muted-foreground/30 font-black">—</span>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="p-0 border-none shadow-2xl bg-background rounded-sm overflow-hidden min-w-[200px]">
                                  <div className="bg-primary/5 p-3 border-b">
                                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Status Report</p>
                                    <div className="flex items-center justify-between gap-4">
                                      <span className={cn(
                                        "text-[10px] font-black uppercase",
                                        status === 'OK' ? "text-green-600" : status === 'NOT OK' ? "text-red-600" : "text-amber-600"
                                      )}>{status || 'Unknown'}</span>
                                      <Badge variant="outline" className="h-4 px-1.5 text-[7px] font-black uppercase border-primary/20 text-primary">{record.tableNumber}</Badge>
                                    </div>
                                  </div>
                                  <div className="p-3 space-y-3">
                                    {check?.remarks ? (
                                      <p className="text-[10px] italic text-muted-foreground leading-relaxed">"{check.remarks}"</p>
                                    ) : (
                                      <p className="text-[9px] text-muted-foreground/40 italic">No field observations recorded.</p>
                                    )}
                                    
                                    {check?.attachments && check.attachments.length > 0 && (
                                      <div className="space-y-2 pt-2 border-t border-border/50">
                                        <div className="flex items-center gap-2">
                                           <div className="relative h-10 w-16 bg-muted rounded-sm overflow-hidden border">
                                              {isVideo(check.attachments[0]) ? (
                                                <div className="w-full h-full flex items-center justify-center bg-slate-900"><Film className="h-3 w-3 text-white/40" /></div>
                                              ) : (
                                                <img src={check.attachments[0].url} className="w-full h-full object-cover" alt="Audit" />
                                              )}
                                           </div>
                                           {check.attachments.length > 1 && (
                                             <span className="text-[8px] font-black text-muted-foreground">+{check.attachments.length - 1} more</span>
                                           )}
                                        </div>
                                        <Button 
                                          variant="default" 
                                          size="sm" 
                                          className="w-full h-7 rounded-sm text-[8px] font-black uppercase tracking-widest"
                                          onClick={() => openViewer(check.attachments![0], check.attachments!, check.remarks)}
                                        >
                                          <Maximize2 className="h-2.5 w-2.5 mr-1" /> View Evidence
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground italic">No metrics available.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TooltipProvider>
            </div>
            <ScrollBar orientation="horizontal" />
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        </div>
        <div className="p-4 border-t bg-muted/5 flex items-center justify-center gap-8 shrink-0">
           <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-600" /><span className="text-[10px] font-black uppercase text-foreground/70 tracking-widest">Verified (OK)</span></div>
           <div className="flex items-center gap-2"><X className="h-4 w-4 text-red-600" /><span className="text-[10px] font-black uppercase text-foreground/70 tracking-widest">Issue Detected (NOT OK)</span></div>
           <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /><span className="text-[10px] font-black uppercase text-foreground/70 tracking-widest">Awaiting (Pending)</span></div>
        </div>
      </Card>

      {/* Media Viewer Dialog */}
      <Dialog open={!!viewFile} onOpenChange={(o) => { if(!o) { resetViewer(); setViewFile(null); setViewFiles([]); setViewRemarks(""); } }}>
        <DialogContent className="max-w-[95vw] h-[90vh] p-0 border-none bg-black/95 flex flex-col items-center justify-center rounded-sm overflow-hidden shadow-2xl">
          <DialogHeader className="sr-only"><DialogTitle>Audit Media Evidence</DialogTitle></DialogHeader>
          <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent no-print">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-1.5 rounded-sm"><ImageIcon className="h-4 w-4 text-white" /></div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-white uppercase tracking-widest truncate max-w-[150px]">{viewFile?.name}</span>
                <span className="text-[8px] font-bold text-white/50 uppercase">{currentFileIndex + 1} of {viewFiles.length} Evidence Artifacts</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white" onClick={() => setScale(prev => Math.min(prev + 0.5, 4))}><ZoomIn className="h-5 w-5" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white" onClick={() => { setScale(prev => Math.max(prev - 0.5, 1)); if(scale <= 1) setPosition({x:0,y:0}); }}><ZoomOut className="h-5 w-5" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white" onClick={resetViewer}><RotateCcw className="h-5 w-5" /></Button>
              <Separator orientation="vertical" className="h-6 bg-white/20 mx-2" />
              <DialogClose asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-red-500"><X className="h-6 w-6" /></Button></DialogClose>
            </div>
          </div>

          {viewFiles.length > 1 && (
            <>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50">
                <Button variant="secondary" size="icon" className="h-12 w-12 rounded-full bg-white/10 text-white border-none shadow-2xl backdrop-blur-md" onClick={(e) => { e.stopPropagation(); prevFile(); }}><ChevronLeft className="h-8 w-8" /></Button>
              </div>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 z-50">
                <Button variant="secondary" size="icon" className="h-12 w-12 rounded-full bg-white/10 text-white border-none shadow-2xl backdrop-blur-md" onClick={(e) => { e.stopPropagation(); nextFile(); }}><ChevronRight className="h-8 w-8" /></Button>
              </div>
            </>
          )}

          <div ref={containerRef} className={cn("relative w-full h-full flex items-center justify-center overflow-hidden touch-none", scale > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default")} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onDoubleClick={handleDoubleClick}>
            <div ref={mediaRef} className={cn("transition-transform duration-200 ease-out flex items-center justify-center pointer-events-none w-fit h-fit", isDragging && "transition-none")} style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}>
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

          <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 to-transparent flex flex-col items-center gap-4">
            {viewRemarks && (
              <div className="max-w-2xl w-full bg-white/10 backdrop-blur-md p-4 rounded-sm border border-white/10 shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-2 mb-2 text-primary">
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Auditor Remarks</span>
                </div>
                <p className="text-xs text-white leading-relaxed italic font-medium">"{viewRemarks}"</p>
              </div>
            )}
            <div className="flex gap-1.5">
              {viewFiles.map((_, i) => (
                <div key={i} className={cn("h-1 w-6 rounded-full transition-all duration-300", i === currentFileIndex ? "bg-primary w-12" : "bg-white/20")} />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
