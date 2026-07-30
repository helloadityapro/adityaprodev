'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  useFirestore, 
  useUser, 
  useDoc, 
  useMemoFirebase, 
  updateDocumentNonBlocking, 
  useFirebaseApp,
  useCollection
} from '@/firebase';
import { doc, serverTimestamp, arrayUnion, collection, query, where, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft, 
  FileDown, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  History, 
  User, 
  Building2, 
  MapPin, 
  Maximize2, 
  PlayCircle, 
  Film, 
  ImageIcon, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  X, 
  XCircle,
  MessageCircle, 
  Check, 
  AlertTriangle, 
  Send,
  Loader2,
  FileImage,
  Download,
  ThumbsUp,
  ThumbsDown,
  RotateCw,
  ShieldAlert
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { isSuperAdmin } from '@/lib/auth-constants';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

type Attachment = {
  url: string;
  contentType: string;
  name: string;
};

type InstallationChecklist = {
  id: string;
  siteId: string;
  siteName: string;
  projectCompany?: string;
  tableNumber: string;
  tableSize: string;
  columnCount: number;
  moduleCount: number;
  userId: string;
  userName: string;
  createdAt: any;
  updatedAt?: any;
  updatedByName?: string;
  updatedById?: string;
  editHistory?: any[];
  checks: { key?: string; label: string; remarks: string; status: 'OK' | 'NOT OK' | 'Pending'; attachments?: Attachment[] }[];
  otherRemarks: string;
  otherAttachments?: Attachment[];
  customerRepPresent: boolean;
  customerRepName?: string;
  customerRepRemarks?: string;
  comments?: any[];
  status?: 'Pending' | 'Approved' | 'Rejected';
  adminRemarks?: string;
  processedBy?: string;
  processedByName?: string;
  processedAt?: any;
};

export default function MmsAuditViewPage({ params }: { params: Promise<{ siteId: string, checklistId: string }> }) {
  const { siteId, checklistId } = React.use(params);
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const auditRef = useMemoFirebase(() => doc(firestore, 'installation_checklists', checklistId), [firestore, checklistId]);
  const { data: audit, isLoading: auditLoading } = useDoc<any>(auditRef);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';
  const canApprove = isAdmin || isManager;

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [newComment, setNewComment] = React.useState("");
  
  // Media Viewer State
  const [viewFile, setViewFile] = React.useState<Attachment | null>(null);
  const [viewFiles, setViewFiles] = React.useState<Attachment[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = React.useState(0);
  const [scale, setScale] = React.useState(1);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [startPan, setStartPan] = React.useState({ x: 0, y: 0 });
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mediaRef = React.useRef<HTMLDivElement>(null);

  const [approvingAction, setApprovingAction] = React.useState<'Approved' | 'Rejected' | null>(null);

  const handleProcessAudit = async (remarks: string) => {
    if (!approvingAction || !user || !userProfile || !audit) return;
    setIsProcessing(true);
    try {
      await updateDocumentNonBlocking(auditRef, {
        status: approvingAction,
        adminRemarks: remarks || "",
        processedBy: user.uid,
        processedByName: userProfile.username || user.email,
        processedAt: serverTimestamp()
      });
      toast({ title: `Audit ${approvingAction}`, description: `Checklist for Table ${audit.tableNumber} updated.` });
      setApprovingAction(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Action Failed", description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateCheckStatus = (checkIndex: number, newStatus: 'OK' | 'NOT OK' | 'Pending') => {
    if (!audit || !canApprove) return;
    const updatedChecks = [...audit.checks];
    updatedChecks[checkIndex] = { ...updatedChecks[checkIndex], status: newStatus };
    updateDocumentNonBlocking(auditRef, {
      checks: updatedChecks,
      updatedAt: serverTimestamp()
    });
    toast({ title: 'Point Updated', description: `Status set to ${newStatus} for ${updatedChecks[checkIndex].label}.` });
  };

  const handlePostComment = async () => {
    if (!audit || !newComment.trim() || !user || !userProfile) return;
    setIsProcessing(true);
    try {
      await updateDocumentNonBlocking(doc(firestore, 'installation_checklists', audit.id), {
        comments: arrayUnion({ userId: user.uid, userName: userProfile.username || user.email, text: newComment.trim(), createdAt: new Date().toISOString() })
      });
      setNewComment("");
      toast({ title: "Comment Posted" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally { setIsProcessing(false); }
  };

  const exportToPDF = async () => {
    if (!audit) return;
    setIsExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF('p', 'mm', 'a4');
      const logoUrl = '/icon.png';
      
      const margin = 15;
      let currY = 40;
      const colWidthLabel = 65;
      const colWidthValue = 115;
      const rowHeight = 8;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('TABLE LEVEL MMS CHECKLIST', margin, currY - 10);
      
      const drawRow = (label: string, value: string) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.rect(margin, currY, colWidthLabel, rowHeight);
        doc.text(label, margin + 2, currY + 5.5);
        doc.setFont('helvetica', 'normal');
        doc.rect(margin + colWidthLabel, currY, colWidthValue, rowHeight);
        doc.text(String(value || '—'), margin + colWidthLabel + 2, currY + 5.5);
        currY += rowHeight;
      };

      drawRow('PROJECT COMPANY', audit.projectCompany || 'Aditya Green Energy');
      drawRow('PROJECT NAME', audit.siteName);
      drawRow('TABLE NUMBER', audit.tableNumber);
      drawRow('SIZE OF TABLE', audit.tableSize || '—');
      drawRow('NUMBER OF COLUMNS', String(audit.columnCount || '—'));
      drawRow('NUMBER OF MODULES', String(audit.moduleCount || '—'));

      currY += 5;
      const col1 = 65; const colStatusRemarks = 80; const col3 = 35;
      doc.setFont('helvetica', 'bold');
      doc.rect(margin, currY, col1, rowHeight);
      doc.text('CHECKS/ AUTHORITIES', margin + 2, currY + 5.5);
      doc.rect(margin + col1, currY, colStatusRemarks, rowHeight);
      doc.text('STATUS & REMARKS', margin + col1 + 2, currY + 5.5);
      doc.rect(margin + col1 + colStatusRemarks, currY, col3, rowHeight);
      doc.text('ATTACHMENTS', margin + col1 + colStatusRemarks + 2, currY + 5.5);
      currY += rowHeight;

      doc.setFont('helvetica', 'normal');
      for (const check of audit.checks) {
        const statusText = check.status || '—';
        const remarksText = check.remarks || '—';
        const combinedText = `${statusText}\n${remarksText}`;
        const combinedLines = doc.splitTextToSize(combinedText, colStatusRemarks - 4);
        const attachments = check.attachments || [];
        const iHeight = attachments.length > 0 ? (attachments.length * 5) + 4 : rowHeight;
        const h = Math.max(rowHeight, combinedLines.length * 4 + 4, iHeight);
        if (currY + h > 270) { doc.addPage(); currY = 20; }
        doc.rect(margin, currY, col1, h);
        doc.text(check.label.toUpperCase(), margin + 2, currY + 5.5);
        doc.rect(margin + col1, currY, colStatusRemarks, h);
        doc.text(combinedLines, margin + col1 + 2, currY + 5.5);
        doc.rect(margin + col1 + colStatusRemarks, currY, col3, h);
        if (attachments.length > 0) {
          attachments.forEach((att, attIdx) => {
            const linkY = currY + 5.5 + (attIdx * 5);
            doc.setTextColor(0, 0, 255);
            doc.text('View File', margin + col1 + colStatusRemarks + 2, linkY);
            doc.link(margin + col1 + colStatusRemarks + 2, linkY - 4, 15, 6, { url: att.url });
          });
          doc.setTextColor(0, 0, 0);
        } else { doc.text('NO', margin + col1 + colStatusRemarks + 2, currY + 5.5); }
        currY += h;
      }
      
      doc.save(`Audit_${audit.tableNumber}_${audit.siteName}.pdf`);
      toast({ title: 'PDF Exported' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Export Failed', description: e.message });
    } finally {
      setIsExporting(false);
    }
  };

  const isVideo = (file: Attachment) => {
    const type = file.contentType?.toLowerCase() || '';
    const name = file.name?.toLowerCase() || '';
    return type.startsWith('video/') || name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.webm');
  };
  const isImage = (file: Attachment) => {
    const type = file.contentType?.toLowerCase() || '';
    const name = file.name?.toLowerCase() || '';
    return type.startsWith('image/') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp') || name.endsWith('.heic') || name.endsWith('.heif');
  };
  const isHeic = (file: Attachment) => {
    const name = (file.name || "").toLowerCase();
    return name.endsWith('.heic') || name.endsWith('.heif');
  };
  const resetViewer = () => { setScale(1); setPosition({ x: 0, y: 0 }); };
  const openViewer = (file: Attachment, gallery: Attachment[]) => {
    const mediaFiles = gallery.filter(a => isImage(a) || isVideo(a));
    const index = mediaFiles.findIndex(a => a.url === file.url);
    setViewFiles(mediaFiles);
    setCurrentFileIndex(index >= 0 ? index : 0);
    setViewFile(file);
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
    setPosition({
      x: Math.min(Math.max(newX, -limitX), limitX),
      y: Math.min(Math.max(newY, -limitY), limitY)
    });
  };
  const handleMouseUp = () => setIsDragging(false);
  const handleDoubleClick = () => { if (viewFile && (isVideo(viewFile) || isHeic(viewFile))) return; if (scale > 1) { setScale(1); setPosition({ x: 0, y: 0 }); } else { setScale(2); } };
  const nextFile = () => { if (viewFiles.length <= 1) return; const nextIdx = (currentFileIndex + 1) % viewFiles.length; setCurrentFileIndex(nextIdx); setViewFile(viewFiles[nextIdx]); resetViewer(); };
  const prevFile = () => { if (viewFiles.length <= 1) return; const prevIdx = (currentFileIndex - 1 + viewFiles.length) % viewFiles.length; setCurrentFileIndex(prevIdx); setViewFile(viewFiles[prevIdx]); resetViewer(); };

  if (auditLoading) return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 animate-pulse">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );

  if (!audit) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <AlertCircle className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
      <h2 className="text-xl font-bold">Registry Record Not Found</h2>
      <p className="text-muted-foreground mt-2">The requested audit log does not exist or has been removed.</p>
      <Button variant="outline" className="mt-6 rounded-sm font-bold uppercase text-xs" onClick={() => router.back()}>Return to Registry</Button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1 no-print">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => router.back()} 
          className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Site Registry
        </Button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2.5 rounded-sm shrink-0"><ShieldCheck className="h-6 w-6 text-primary" /></div>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight truncate">Quality Audit Log</h1>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">{audit.siteName} • Table {audit.tableNumber}</p>
              </div>
           </div>
           <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn(
                "rounded-sm text-[10px] font-black uppercase px-3 h-8 mr-2",
                audit.status === 'Approved' ? "bg-green-100 text-green-700 border-green-200" :
                audit.status === 'Rejected' ? "bg-red-100 text-red-700 border-red-100" :
                "bg-yellow-50 text-yellow-700 border-yellow-200"
              )}>{audit.status || 'Pending'}</Badge>
              <Button onClick={exportToPDF} disabled={isExporting} variant="outline" size="sm" className="h-8 md:h-10 rounded-sm font-black uppercase text-[10px] tracking-widest border-primary/20 text-primary bg-background shadow-md">
                {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <FileDown className="h-3.5 w-3.5 mr-1.5" />} Report PDF
              </Button>
           </div>
        </div>
      </div>

      <Card className="rounded-sm shadow-xl border-primary/10 overflow-hidden">
        <CardHeader className="bg-primary/5 border-b p-6 md:p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            <div className="space-y-1"><Label className="text-[8px] md:text-[9px] font-black uppercase text-muted-foreground tracking-widest">Personnel</Label><p className="text-sm font-bold flex items-center gap-2"><User className="h-3.5 w-3.5 text-primary opacity-50" />{audit.userName}</p></div>
            <div className="space-y-1"><Label className="text-[8px] md:text-[9px] font-black uppercase text-muted-foreground tracking-widest">Config</Label><p className="text-sm font-bold">{audit.tableSize || '—'}</p></div>
            <div className="space-y-1"><Label className="text-[8px] md:text-[9px] font-black uppercase text-muted-foreground tracking-widest">Columns / Modules</Label><p className="text-sm font-bold">{audit.columnCount} / {audit.moduleCount}</p></div>
            <div className="space-y-1"><Label className="text-[8px] md:text-[9px] font-black uppercase text-muted-foreground tracking-widest">Timestamp</Label><p className="text-xs font-mono font-bold text-muted-foreground uppercase flex items-center gap-2"><Clock className="h-3.5 w-3.5" />{format(audit.createdAt.toDate(), 'dd MMM yy, HH:mm')}</p></div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y border-b">
            {audit.checks.map((check, idx) => (
              <div key={idx} className="p-6 md:p-10 space-y-6 hover:bg-primary/[0.01] transition-colors group">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="space-y-1.5">
                    <span className="text-base font-black uppercase tracking-tight text-foreground block">{check.label}</span>
                    <p className={cn(
                      "text-[10px] font-black uppercase tracking-widest flex items-center gap-2",
                      check.status === 'OK' ? "text-green-600" : check.status === 'NOT OK' ? "text-red-600" : "text-amber-600"
                    )}>
                      {check.status === 'OK' ? <CheckCircle2 className="h-3 w-3" /> : check.status === 'NOT OK' ? <XCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      Status: {check.status}
                    </p>
                  </div>
                  
                  {canApprove && (
                    <div className="flex items-center gap-1.5 border rounded-sm p-1 bg-background shadow-md no-print self-start sm:self-center">
                      <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-sm", check.status === 'OK' ? "bg-green-600 text-white hover:bg-green-700" : "opacity-30 hover:opacity-100")} onClick={() => handleUpdateCheckStatus(idx, 'OK')} title="Mark OK"><Check className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-sm", check.status === 'NOT OK' ? "bg-red-600 text-white hover:bg-red-700" : "opacity-30 hover:opacity-100")} onClick={() => handleUpdateCheckStatus(idx, 'NOT OK')} title="Mark NOT OK"><X className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-sm", check.status === 'Pending' ? "bg-amber-500 text-white hover:bg-amber-600" : "opacity-30 hover:opacity-100")} onClick={() => handleUpdateCheckStatus(idx, 'Pending')} title="Mark Pending"><Clock className="h-4 w-4" /></Button>
                    </div>
                  )}
                </div>

                {check.remarks && (
                  <div className="p-4 bg-muted/20 border rounded-sm italic text-sm text-foreground/80 leading-relaxed">
                    "{check.remarks}"
                  </div>
                )}

                {check.attachments && check.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-4">
                    {check.attachments.map((file, fIdx) => (
                      <div key={fIdx} className="relative aspect-video w-32 md:w-48 rounded-sm overflow-hidden border shadow-md shrink-0 bg-muted cursor-pointer transition-transform hover:scale-[1.02]" onClick={() => openViewer(file, check.attachments!)}>
                        {isVideo(file) ? <div className="w-full h-full bg-slate-900 flex items-center justify-center"><Film className="h-8 w-8 text-white opacity-40" /><PlayCircle className="absolute h-8 w-8 text-white" /></div> : <img src={file.url} className="w-full h-full object-cover" alt={file.name} />}
                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Maximize2 className="h-6 w-6 text-white" /></div>
                        <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/60 text-white text-[8px] font-bold uppercase truncate px-2">{file.name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {(audit.otherRemarks || (audit.otherAttachments && audit.otherAttachments.length > 0)) && (
            <div className="p-6 md:p-10 space-y-6 bg-muted/5">
               <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Observations & Supplementary Evidence</Label>
               <div className="space-y-6">
                  {audit.otherRemarks && <p className="text-sm italic text-foreground/80 leading-relaxed p-4 bg-background border rounded-sm">"{audit.otherRemarks}"</p>}
                  {audit.otherAttachments && audit.otherAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-4">
                      {audit.otherAttachments.map((file, fIdx) => (
                        <div key={fIdx} className="relative aspect-video w-32 md:w-48 rounded-sm overflow-hidden border shadow-md shrink-0 bg-muted cursor-pointer" onClick={() => openViewer(file, audit.otherAttachments!)}>
                           {isVideo(file) ? <div className="w-full h-full bg-slate-900 flex items-center justify-center"><Film className="h-8 w-8 text-white opacity-40" /></div> : <img src={file.url} className="w-full h-full object-cover" alt={file.name} />}
                           <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 hover:opacity-100"><Maximize2 className="h-6 w-6 text-white" /></div>
                        </div>
                      ))}
                    </div>
                  )}
               </div>
            </div>
          )}
          
          <div className="p-6 md:p-10 grid grid-cols-1 md:grid-cols-2 gap-8 bg-primary/5">
             <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Customer Verification</Label>
                <div className="p-4 bg-background border rounded-sm space-y-2">
                   <div className="flex items-center justify-between text-xs font-bold uppercase tracking-tight">
                      <span>Representative</span>
                      <span className="text-primary">{audit.customerRepPresent ? (audit.customerRepName || 'Confirmed Present') : 'Not Present'}</span>
                   </div>
                   {audit.customerRepRemarks && <p className="text-xs italic text-muted-foreground border-t pt-2 mt-2 leading-relaxed">"{audit.customerRepRemarks}"</p>}
                </div>
             </div>
             {audit.status !== 'Pending' && (
                <div className="space-y-4">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Administrative Action</Label>
                   <div className={cn("p-4 border rounded-sm space-y-2", audit.status === 'Approved' ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100")}>
                      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-tight">
                         <span>Processed by {audit.processedByName}</span>
                         <span className={cn(audit.status === 'Approved' ? "text-green-700" : "text-red-700")}>{audit.status}</span>
                      </div>
                      {audit.adminRemarks && <p className="text-xs italic text-muted-foreground border-t pt-2 mt-2 leading-relaxed">"{audit.adminRemarks}"</p>}
                      {audit.processedAt && <p className="text-[8px] font-bold opacity-30 text-right uppercase mt-1">{format(audit.processedAt.toDate(), 'dd/MM/yyyy HH:mm')}</p>}
                   </div>
                </div>
             )}
          </div>
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
                                  <Badge variant="outline" className={cn("h-4 text-[8px] font-black uppercase rounded-sm px-1", prevCheck.status === 'OK' ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200")}>{prevCheck.status}</Badge>
                               </div>
                               {prevCheck.remarks && <p className="text-[10px] italic text-muted-foreground leading-snug line-clamp-1">"{prevCheck.remarks}"</p>}
                            </div>
                          ))}
                       </div>
                       {entry.previousValues?.otherRemarks && (
                          <div className="p-4 bg-muted/30 border rounded-sm">
                             <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Previous Observations</Label>
                             <p className="text-xs italic text-foreground/80 leading-relaxed">"{entry.previousValues.otherRemarks}"</p>
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

      {/* Discussion Section */}
      <Card className="rounded-sm shadow-xl border-primary/10 overflow-hidden no-print">
        <CardHeader className="bg-primary/5 border-b p-6 flex flex-row items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-sm text-primary"><MessageCircle className="h-5 w-5" /></div>
              <CardTitle className="text-base font-black uppercase tracking-widest">Audit Discussion</CardTitle>
           </div>
           <Badge variant="outline" className="rounded-full px-3 h-6 font-mono font-bold bg-background text-primary">{audit.comments?.length || 0}</Badge>
        </CardHeader>
        <CardContent className="p-6 md:p-8 space-y-8">
           <ScrollArea className={cn("w-full", audit.comments?.length ? "h-[300px]" : "h-auto")}>
              <div className="space-y-6 pr-4">
                 {audit.comments?.map((comment: any, i: number) => (
                    <div key={i} className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                       <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-black text-primary uppercase">{comment.userName}</span>
                          <span className="text-[8px] font-mono font-bold text-muted-foreground uppercase">{format(new Date(comment.createdAt), 'dd MMM, HH:mm')}</span>
                       </div>
                       <div className="p-4 bg-muted/20 border rounded-sm text-left shadow-sm">
                          <p className="text-xs md:text-sm font-medium leading-relaxed italic text-foreground/90">"{comment.text}"</p>
                       </div>
                    </div>
                 ))}
                 {!audit.comments?.length && (
                    <div className="py-12 text-center text-muted-foreground/30 italic text-xs uppercase font-black tracking-widest">Zero communication threads found.</div>
                 )}
              </div>
           </ScrollArea>
           
           <div className="pt-6 border-t border-dashed space-y-4">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Post Response or Findings</Label>
              <div className="flex flex-col sm:flex-row gap-3">
                 <Textarea 
                   placeholder="Type your message to the team..." 
                   className="min-h-[100px] rounded-sm bg-background border-primary/20 text-sm shadow-inner" 
                   value={newComment} 
                   onChange={(e) => setNewComment(e.target.value)} 
                 />
                 <Button onClick={handlePostComment} disabled={isProcessing || !newComment.trim()} className="rounded-sm font-black uppercase text-[11px] h-auto px-10 shadow-lg tracking-[0.2em] sm:w-auto w-full">
                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Send Message
                 </Button>
              </div>
           </div>
        </CardContent>
      </Card>

      {/* Admin Action Overlay */}
      {canApprove && (!audit.status || audit.status === 'Pending') && (
        <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 bg-background/90 backdrop-blur border-t p-4 z-40 md:left-[16rem] no-print animate-in slide-in-from-bottom-full duration-500 shadow-2xl">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
             <div className="hidden sm:block">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Audit Resolution Center</p>
                <p className="text-[11px] font-bold text-foreground/60">Choose a decision to finalize this quality record.</p>
             </div>
             <div className="flex-1 sm:flex-none flex gap-3">
                <Button className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white font-black uppercase text-[11px] tracking-[0.15em] shadow-xl shadow-green-500/20 px-8" onClick={() => setApprovingAction('Approved')}>Approve Audit</Button>
                <Button variant="destructive" className="flex-1 h-12 font-black uppercase text-[11px] tracking-[0.15em] shadow-xl shadow-red-500/20 px-8" onClick={() => setApprovingAction('Rejected')}>Reject Audit</Button>
             </div>
          </div>
        </div>
      )}

      {/* Decision Dialog */}
      <Dialog open={!!approvingAction} onOpenChange={() => setApprovingAction(null)}>
        <DialogContent className="max-w-md w-[95vw] rounded-sm p-6">
          <DialogHeader className="text-left space-y-2">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Finalize {approvingAction}</DialogTitle>
            <DialogDescription className="text-xs font-medium">Archiving quality decision for Table {audit.tableNumber}.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-3 text-left">
            <Label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase px-1">Authority Remarks (Optional)</Label>
            <Textarea id="final-action-remarks" placeholder="Enter findings or feedback for personnel..." className="min-h-[120px] rounded-sm" />
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-3">
            <DialogClose asChild><Button variant="outline" className="w-full sm:flex-1 h-12 font-bold rounded-sm text-[10px] uppercase">Cancel</Button></DialogClose>
            <Button className={cn("w-full sm:flex-1 h-12 rounded-sm font-black uppercase text-[10px]", approvingAction === 'Approved' ? 'bg-green-600' : 'bg-red-600')} 
              onClick={() => handleProcessAudit((document.getElementById('final-action-remarks') as HTMLTextAreaElement)?.value || "")}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : `Confirm ${approvingAction}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advanced Media Viewer Dialog */}
      <Dialog open={!!viewFile} onOpenChange={(o) => { if(!o) { resetViewer(); setViewFile(null); setViewFiles([]); } }}>
        <DialogContent className="max-w-[95vw] h-[90vh] p-0 border-none bg-black/95 flex flex-col items-center justify-center rounded-sm overflow-hidden shadow-2xl z-[100]">
          <DialogHeader className="sr-only"><DialogTitle>Audit Media Detail</DialogTitle></DialogHeader>
          <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-3 md:p-4 bg-gradient-to-b from-black/60 to-transparent no-print">
            <div className="flex items-center gap-2"><div className="bg-white/10 p-1.5 rounded-sm"><ImageIcon className="h-3.5 w-3.5 text-white" /></div><span className="text-[8px] md:text-[10px] font-black text-white uppercase truncate max-w-[120px]">{viewFile?.name}</span></div>
            <div className="flex items-center gap-1.5"><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-white" onClick={() => setScale(prev => Math.min(prev + 0.5, 4))}><ZoomIn className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-white" onClick={() => { setScale(prev => Math.max(prev - 0.5, 1)); if(scale <= 1) setPosition({x:0,y:0}); }}><ZoomOut className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-white" onClick={() => setRotation(prev => (prev + 90) % 360)}><RotateCw className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-white" onClick={resetViewer}><RotateCcw className="h-5 w-5" /></Button><Separator orientation="vertical" className="h-6 bg-white/20 mx-1 md:mx-2" /><DialogClose asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-white hover:bg-red-500"><X className="h-5 w-5" /></Button></DialogClose></div>
          </div>
          {viewFiles.length > 1 && (<><div className="absolute left-2 top-1/2 -translate-y-1/2 z-50"><Button variant="secondary" size="icon" className="h-10 w-10 rounded-full bg-white/10 text-white shadow-2xl" onClick={(e) => { e.stopPropagation(); prevFile(); }}><ChevronLeft className="h-6 w-6" /></Button></div><div className="absolute right-2 top-1/2 -translate-y-1/2 z-50"><Button variant="secondary" size="icon" className="h-10 w-10 rounded-full bg-white/10 text-white shadow-2xl" onClick={(e) => { e.stopPropagation(); nextFile(); }}><ChevronRight className="h-6 w-6" /></Button></div></>)}
          <div ref={containerRef} className={cn("relative w-full h-full flex items-center justify-center overflow-hidden touch-none", scale > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default")} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onDoubleClick={handleDoubleClick}>
            <div ref={mediaRef} className={cn("transition-transform duration-200 ease-out will-change-transform flex items-center justify-center select-none pointer-events-none w-fit h-fit", isDragging && "transition-none")} style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}>
              {viewFile && (
                isVideo(viewFile) ? (
                  <div className="pointer-events-auto"><video src={viewFile.url} controls autoPlay className="max-w-[90vw] max-h-[80vh] shadow-2xl rounded-sm" /></div>
                ) : isHeic(viewFile) ? (
                  <div className="bg-white/5 p-12 rounded-sm flex flex-col items-center gap-6 text-center pointer-events-auto">
                    <FileImage className="h-16 w-16 text-primary opacity-20" />
                    <div className="space-y-2">
                      <p className="text-white font-black text-sm uppercase tracking-widest" style={{ letterSpacing: "0.4em" }}>HEIC Media Unsupported</p>
                      <p className="text-white/40 text-xs max-w-[200px]">Format restricted. Download for local viewing.</p>
                    </div>
                    <Button asChild className="rounded-sm font-bold uppercase text-[10px] tracking-widest"><a href={viewFile.url} download={viewFile.name}><Download className="h-3.5 w-3.5 mr-2" /> Save Artifact</a></Button>
                  </div>
                ) : (
                  <img src={viewFile.url} className="max-w-[90vw] max-h-[80vh] object-contain shadow-2xl rounded-sm pointer-events-none" alt="Evidence View" draggable={false} />
                )
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
