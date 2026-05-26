'use client';

import * as React from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, updateDocumentNonBlocking, deleteDocumentNonBlocking, useFirebaseApp } from '@/firebase';
import { collection, query, orderBy, doc, limit, arrayUnion, serverTimestamp, getDocs, where } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Search, 
  FilterX, 
  Building2, 
  User, 
  ClipboardCheck, 
  Eye, 
  ChevronRight, 
  ShieldCheck, 
  CheckCircle2, 
  X,
  ImageIcon,
  Maximize2,
  ArrowLeft,
  Film,
  PlayCircle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  History,
  Trash2,
  MessageCircle,
  Send,
  Loader2,
  AlertCircle,
  FileDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  Clock,
  Plus,
  FileText,
  ExternalLink,
  MoreVertical
} from 'lucide-react';
import { format, subDays, subMonths, subYears } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { isSuperAdmin } from '@/lib/auth-constants';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sendNotification } from '@/lib/notifications';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Site = { 
  id: string; 
  name: string; 
  projectCompany?: string; 
  drawingUrl?: string; 
  drawingName?: string;
  updatedAt?: any;
};

type Attachment = {
  url: string;
  contentType: string;
  name: string;
};

type Comment = {
  userId: string;
  userName: string;
  text: string;
  createdAt: any;
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
  checks: { label: string; remarks: string; attachments?: Attachment[] }[];
  otherRemarks: string;
  otherAttachments?: Attachment[];
  customerRepPresent: boolean;
  customerRepName?: string;
  customerRepRemarks?: string;
  comments?: Comment[];
};

type AuditSortKey = 'date' | 'table' | 'user' | 'comments';
type SiteSortKey = 'name' | 'company' | 'count';

export default function ChecklistsDataPage() {
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  
  const [selectedSiteId, setSelectedSiteId] = React.useState<string>("all");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  
  const [auditSortConfig, setAuditSortConfig] = React.useState<{ key: AuditSortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [siteSortConfig, setSortConfig] = React.useState<{ key: SiteSortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  
  const [dateFilter, setDateFilter] = React.useState<string>("7days");
  const [customStart, setCustomStart] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const [viewingInstallation, setViewingInstallation] = React.useState<InstallationChecklist | null>(null);
  const [commentingRecord, setCommentingRecord] = React.useState<InstallationChecklist | null>(null);
  const [deletingRecord, setDeletingRecord] = React.useState<InstallationChecklist | null>(null);
  const [newComment, setNewComment] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  
  const [isUploadingDrawing, setIsUploadingDrawing] = React.useState(false);
  const [deletingDrawing, setDeletingDrawing] = React.useState<Site | null>(null);

  const [viewFile, setViewFile] = React.useState<Attachment | null>(null);
  const [viewFiles, setViewFiles] = React.useState<Attachment[]>([]);
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

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const instQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'installation_checklists'), limit(1000));
  }, [firestore]);
  const { data: instRecords, isLoading: instLoading } = useCollection<InstallationChecklist>(instQuery);

  const queryDateRange = React.useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    
    switch (dateFilter) {
      case 'today': return { start: todayStr, end: todayStr };
      case 'yesterday': return { start: format(subDays(today, 1), 'yyyy-MM-dd'), end: format(subDays(today, 1), 'yyyy-MM-dd') };
      case '7days': return { start: format(subDays(today, 7), 'yyyy-MM-dd'), end: todayStr };
      case 'lastMonth': return { start: format(subMonths(today, 1), 'yyyy-MM-dd'), end: todayStr };
      case 'lastYear': return { start: format(subYears(today, 1), 'yyyy-MM-dd'), end: todayStr };
      case 'allTime': return { start: '1970-01-01', end: '2099-12-31' };
      case 'custom': return { start: customStart, end: customEnd };
      default: return { start: format(subDays(today, 7), 'yyyy-MM-dd'), end: todayStr };
    }
  }, [dateFilter, customStart, customEnd]);

  const siteStats = React.useMemo(() => {
    const stats: Record<string, number> = {};
    instRecords?.forEach(r => {
      stats[r.siteId] = (stats[r.siteId] || 0) + 1;
    });
    return stats;
  }, [instRecords]);

  const filteredSortedSites = React.useMemo(() => {
    if (!allSites) return [];
    let result = allSites.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase()));

    result.sort((a, b) => {
      const { key, direction } = siteSortConfig;
      let valA: any = '';
      let valB: any = '';

      if (key === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (key === 'company') {
        valA = (a.projectCompany || '').toLowerCase();
        valB = (b.projectCompany || '').toLowerCase();
      } else if (key === 'count') {
        valA = siteStats[a.id] || 0;
        valB = siteStats[b.id] || 0;
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [allSites, siteSearchQuery, siteSortConfig, siteStats]);

  const filteredInst = React.useMemo(() => {
    if (!instRecords) return [];
    const { start, end } = queryDateRange;

    let result = instRecords.map(r => {
      const site = allSites?.find(s => s.id === r.siteId);
      return {
        ...r,
        projectCompany: r.projectCompany || site?.projectCompany || 'Aditya Green Energy'
      };
    }).filter(r => {
      const rDate = r.createdAt?.toDate?.() || new Date(r.createdAt);
      const rDateStr = format(rDate, 'yyyy-MM-dd');

      const matchesSite = selectedSiteId === 'all' || r.siteId === selectedSiteId;
      const matchesSearch = r.siteName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           r.tableNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           r.userName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDate = rDateStr >= start && rDateStr <= end;

      return matchesSite && matchesSearch && matchesDate;
    });

    result.sort((a, b) => {
      const { key, direction } = auditSortConfig;
      let valA: any = '';
      let valB: any = '';

      if (key === 'date') {
        valA = a.createdAt?.toDate?.()?.getTime() || 0;
        valB = b.createdAt?.toDate?.()?.getTime() || 0;
      } else if (key === 'table') {
        valA = a.tableNumber.toLowerCase();
        valB = b.tableNumber.toLowerCase();
      } else if (key === 'user') {
        valA = a.userName.toLowerCase();
        valB = b.userName.toLowerCase();
      } else if (key === 'comments') {
        valA = a.comments?.length || 0;
        valB = b.comments?.length || 0;
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [instRecords, selectedSiteId, searchTerm, queryDateRange, auditSortConfig, allSites]);

  const handleAuditSort = (key: AuditSortKey) => {
    setAuditSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleSiteSort = (key: SiteSortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const AuditSortIcon = ({ column }: { column: AuditSortKey }) => {
    if (auditSortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return auditSortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3 text-primary" /> : <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  const SiteSortIcon = ({ column }: { column: SiteSortKey }) => {
    if (siteSortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return siteSortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3 text-primary" /> : <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  const handleDrawingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSiteId || selectedSiteId === 'all') return;
    
    setIsUploadingDrawing(true);
    try {
      const storage = getStorage(firebaseApp);
      const storagePath = `site_drawings/${selectedSiteId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      await new Promise((resolve, reject) => {
        uploadTask.on('state_changed', null, reject, resolve);
      });
      
      const url = await getDownloadURL(uploadTask.snapshot.ref);
      
      await updateDocumentNonBlocking(doc(firestore, 'sites', selectedSiteId), {
        drawingUrl: url,
        drawingName: file.name,
        updatedAt: serverTimestamp()
      });
      
      toast({ title: 'Drawing Uploaded', description: 'Reference document added to site.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
    } finally {
      setIsUploadingDrawing(false);
      e.target.value = '';
    }
  };

  const confirmDeleteDrawing = async () => {
    if (!deletingDrawing) return;
    setIsProcessing(true);
    try {
      await updateDocumentNonBlocking(doc(firestore, 'sites', deletingDrawing.id), {
        drawingUrl: null,
        drawingName: null,
        updatedAt: serverTimestamp()
      });
      toast({ title: 'Drawing Removed', description: 'Reference document deleted.' });
      setDeletingDrawing(null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const exportToPDF = async (items: InstallationChecklist[]) => {
    if (items.length === 0) return;
    setIsExporting(true);
    
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF('p', 'mm', 'a4');
      
      for (let index = 0; index < items.length; index++) {
        const record = items[index];
        if (index > 0) doc.addPage();
        
        const margin = 15;
        let currY = 25;
        const colWidthLabel = 65;
        const colWidthValue = 115;
        const rowHeight = 8;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('TABLE LEVEL MMS CHECKLIST', margin, currY - 8);
        
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

        drawRow('PROJECT COMPANY', record.projectCompany || 'Aditya Green Energy');
        drawRow('PROJECT NAME', record.siteName);
        drawRow('TABLE NUMBER', record.tableNumber);
        drawRow('SIZE OF TABLE', record.tableSize || '—');
        drawRow('NUMBER OF COLUMNS', String(record.columnCount || '—'));
        drawRow('NUMBER OF MODULES', String(record.moduleCount || '—'));

        currY += 5;

        const col1 = 65;
        const col2 = 75;
        const col3 = 40;

        doc.setFont('helvetica', 'bold');
        doc.rect(margin, currY, col1, rowHeight);
        doc.text('CHECKS/ AUTHORITIES', margin + 2, currY + 5.5);
        doc.rect(margin + col1, currY, col2, rowHeight);
        doc.text('REMARKS', margin + col1 + 2, currY + 5.5);
        doc.rect(margin + col1 + col2, currY, col3, rowHeight);
        doc.text('ATTACHMENTS', margin + col1 + col2 + 2, currY + 5.5);
        currY += rowHeight;

        doc.setFont('helvetica', 'normal');
        for (const check of record.checks) {
          const remarkLines = doc.splitTextToSize(check.remarks || '—', col2 - 4);
          const h = Math.max(rowHeight, remarkLines.length * 4 + 4);

          if (currY + h > 270) {
            doc.addPage();
            currY = 20;
          }

          doc.rect(margin, currY, col1, h);
          doc.text(check.label.toUpperCase(), margin + 2, currY + 5.5);
          
          doc.rect(margin + col1, currY, col2, h);
          doc.text(remarkLines, margin + col1 + 2, currY + 5.5);
          
          doc.rect(margin + col1 + col2, currY, col3, h);
          const attCount = check.attachments?.length || 0;
          doc.text(attCount > 0 ? `YES (${attCount})` : 'NO', margin + col1 + col2 + 2, currY + 5.5);
          
          currY += h;
        }

        const otherRemLines = doc.splitTextToSize(record.otherRemarks || '—', col2 - 4);
        const otherH = Math.max(rowHeight, otherRemLines.length * 4 + 4);
        
        if (currY + otherH > 270) {
          doc.addPage();
          currY = 20;
        }

        doc.rect(margin, currY, col1, otherH);
        doc.text('OTHER REMARK (IF ANY)', margin + 2, currY + 5.5);
        doc.rect(margin + col1, currY, col2, otherH);
        doc.text(otherRemLines, margin + col1 + 2, currY + 5.5);
        
        doc.rect(margin + col1 + col2, currY, col3, otherH);
        const otherAttCount = record.otherAttachments?.length || 0;
        doc.text(otherAttCount > 0 ? `YES (${otherAttCount})` : 'NO', margin + col1 + col2 + 2, currY + 5.5);
        currY += otherH;

        currY += 5;

        const drawFooterRow = (label: string, value: string) => {
          if (currY + rowHeight > 270) {
            doc.addPage();
            currY = 20;
          }
          doc.setFont('helvetica', 'bold');
          doc.rect(margin, currY, colWidthLabel, rowHeight);
          doc.text(label, margin + 2, currY + 5.5);
          doc.setFont('helvetica', 'normal');
          doc.rect(margin + colWidthLabel, currY, colWidthValue, rowHeight);
          doc.text(value, margin + colWidthLabel + 2, currY + 5.5);
          currY += rowHeight;
        };

        drawFooterRow('SUBMITTED BY', record.userName);
        drawFooterRow('DATE', record.createdAt ? format(record.createdAt.toDate(), 'dd/MM/yyyy HH:mm') : '—');
        
        currY += 5;
        
        const clientRemarks = record.customerRepRemarks || '—';
        const clientContent = record.customerRepPresent 
          ? `Rep: ${record.customerRepName || 'N/A'}\nRemarks: ${clientRemarks}` 
          : "Not Present";
        
        const clientLines = doc.splitTextToSize(clientContent, colWidthValue - 4);
        const clientH = Math.max(rowHeight * 2, clientLines.length * 4 + 6);

        if (currY + clientH > 270) {
          doc.addPage();
          currY = 20;
        }

        doc.setFont('helvetica', 'bold');
        doc.rect(margin, currY, colWidthLabel, clientH);
        doc.text('REPRESENTATIVE OF PROJECT\nCLIENT & THEIR COMMENTS', margin + 2, currY + 5.5);
        doc.setFont('helvetica', 'normal');
        doc.rect(margin + colWidthLabel, currY, colWidthValue, clientH);
        doc.text(clientLines, margin + colWidthLabel + 2, currY + 5.5);
        currY += clientH;

        currY += 5;

        const extCommentsRaw = record.comments?.map(c => `[${format(new Date(c.createdAt), 'dd/MM HH:mm')}] ${c.userName}: ${c.text}`).join('\n') || '—';
        const extLines = doc.splitTextToSize(extCommentsRaw, colWidthValue - 4);
        const extH = Math.max(rowHeight * 2, extLines.length * 4 + 6);

        if (currY + extH > 270) {
          doc.addPage();
          currY = 20;
        }

        doc.setFont('helvetica', 'bold');
        doc.rect(margin, currY, colWidthLabel, extH);
        doc.text('EXTERNAL COMMENTS', margin + 2, currY + 5.5);
        doc.setFont('helvetica', 'normal');
        doc.rect(margin + colWidthLabel, currY, colWidthValue, extH);
        doc.text(extLines, margin + colWidthLabel + 2, currY + 5.5);
      }

      const fileName = items.length === 1 
        ? `AdityaPro_MMS_Audit_${items[0].tableNumber}.pdf` 
        : `AdityaPro_MMS_Batch_${items[0].siteName.replace(/\s+/g, '_')}.pdf`;
        
      doc.save(fileName);
      toast({ title: 'PDF Generated', description: 'Audit document saved successfully.' });
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Export Failed', description: error.message });
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
    return type.startsWith('image/') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp');
  };

  const resetViewer = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const openViewer = (file: Attachment, gallery: Attachment[]) => {
    const mediaFiles = gallery.filter(a => isImage(a) || isVideo(a));
    const index = mediaFiles.findIndex(a => a.url === file.url);
    setViewFiles(mediaFiles);
    setCurrentFileIndex(index >= 0 ? index : 0);
    setViewFile(file);
    resetViewer();
  };

  const nextFile = () => {
    if (viewFiles.length <= 1) return;
    const nextIdx = (currentFileIndex + 1) % viewFiles.length;
    setCurrentFileIndex(nextIdx);
    setViewFile(viewFiles[nextIdx]);
    resetViewer();
  };

  const prevFile = () => {
    if (viewFiles.length <= 1) return;
    const prevIdx = (currentFileIndex - 1 + viewFiles.length) % viewFiles.length;
    setCurrentFileIndex(prevIdx);
    setViewFile(viewFiles[prevIdx]);
    resetViewer();
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (viewFile && isVideo(viewFile)) return;
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    const newScale = Math.min(Math.max(scale + delta, 1), 4);
    setScale(newScale);
    if (newScale === 1) setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1 || (viewFile && isVideo(viewFile))) return;
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

  const handleDoubleClick = () => {
    if (viewFile && isVideo(viewFile)) return;
    if (scale > 1) {
      resetViewer();
    } else {
      setScale(2);
    }
  };

  const handlePostComment = async () => {
    if (!commentingRecord || !newComment.trim() || !user || !userProfile) return;
    setIsProcessing(true);
    try {
      const ref = doc(firestore, 'installation_checklists', commentingRecord.id);
      await updateDocumentNonBlocking(ref, {
        comments: arrayUnion({
          userId: user.uid,
          userName: userProfile.username || user.email,
          text: newComment.trim(),
          createdAt: new Date().toISOString()
        })
      });

      if (commentingRecord.userId !== user.uid) {
        sendNotification(firestore, {
          userId: commentingRecord.userId,
          title: "New Comment on Audit",
          description: `${userProfile.username} commented on your Table ${commentingRecord.tableNumber} audit.`,
          link: `/checklists/data`,
          push: true
        });
      }

      const adminsQuery = query(collection(firestore, 'users'), where('role', '==', 'Admin'));
      const adminDocs = await getDocs(adminsQuery);
      adminDocs.forEach(adminDoc => {
        sendNotification(firestore, {
          userId: adminDoc.id,
          title: "Audit Comment",
          description: `${userProfile.username} commented on an audit for ${commentingRecord.siteName}.`,
          link: `/checklists/data`,
          push: true
        });
      });

      setNewComment("");
      toast({ title: "Comment Posted" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteRecord = async () => {
    if (!deletingRecord) return;
    setIsProcessing(true);
    try {
      await deleteDocumentNonBlocking(doc(firestore, 'installation_checklists', deletingRecord.id));
      toast({ title: "Audit Deleted", description: "Record has been removed from registry." });
      setDeletingRecord(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAuditFilters = () => {
    setSearchTerm("");
    setDateFilter("7days");
  };

  if (isProfileLoading || instLoading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;
  }

  const selectedSiteObj = allSites?.find(s => s.id === selectedSiteId);

  return (
    <div className="space-y-6 md:space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
          <ClipboardCheck className="h-6 w-6" /> Table Level MMS Data
        </h1>
        <p className="text-muted-foreground text-[10px] md:text-xs font-medium">Project-wise structural quality audit and verification logs.</p>
      </div>

      {selectedSiteId === 'all' ? (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-3 md:p-4 border border-primary/10 rounded-sm shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search projects..." 
                className="pl-10 h-10 md:h-11 rounded-sm bg-background border-primary/10 text-sm"
                value={siteSearchQuery}
                onChange={e => setSiteSearchQuery(e.target.value)}
              />
            </div>
            <Badge variant="secondary" className="rounded-sm font-black uppercase text-[8px] md:text-[10px] tracking-widest px-3 h-7 md:h-8 border-none w-fit">
              {allSites?.length || 0} Sites Registered
            </Badge>
          </div>

          <div className="md:hidden space-y-3">
            {filteredSortedSites.map(site => {
              const count = siteStats[site.id] || 0;
              return (
                <Card 
                  key={site.id} 
                  className="rounded-sm border-primary/10 shadow-sm active:bg-muted/5 transition-colors cursor-pointer"
                  onClick={() => setSelectedSiteId(site.id)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-sm text-primary">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-sm text-foreground truncate">{site.name}</span>
                        <span className="text-[9px] uppercase font-black text-muted-foreground truncate">{site.projectCompany}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <Badge variant="outline" className="rounded-sm h-6 px-2 text-[9px] font-bold border-primary/10 bg-primary/5 text-primary">
                        {count} Logs
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="hidden md:block rounded-sm border-primary/10 shadow-md overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead 
                      className="px-6 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleSiteSort('name')}
                    >
                      <div className="flex items-center">Project Name <SiteSortIcon column="name" /></div>
                    </TableHead>
                    <TableHead 
                      className="hidden md:table-cell cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleSiteSort('company')}
                    >
                      <div className="flex items-center">Project Company <SiteSortIcon column="company" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-center cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleSiteSort('count')}
                    >
                      <div className="flex items-center justify-center">Audits Logged <SiteSortIcon column="count" /></div>
                    </TableHead>
                    <TableHead className="text-right px-6">Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSortedSites.map(site => {
                    const count = siteStats[site.id] || 0;
                    return (
                      <TableRow 
                        key={site.id} 
                        className="hover:bg-muted/5 cursor-pointer transition-colors group"
                        onClick={() => setSelectedSiteId(site.id)}
                      >
                        <TableCell className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{site.name}</span>
                            <span className="text-[10px] md:hidden uppercase font-black text-muted-foreground">{site.projectCompany}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-[10px] uppercase font-black text-muted-foreground">{site.projectCompany}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="rounded-sm h-6 px-2 text-[10px] font-bold border-primary/10 bg-primary/5 text-primary">
                            {count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <div className="flex items-center justify-end gap-3 text-xs font-black text-foreground">
                            <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-all group-hover:translate-x-1" />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredSortedSites.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">No projects found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6 md:space-y-8 animate-in slide-in-from-right-4 duration-500">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setSelectedSiteId('all'); setSearchTerm(""); }} 
                className="h-7 mb-1 -ml-2 text-muted-foreground hover:text-primary"
              >
                <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Back to Project List
              </Button>
              <h2 className="text-lg md:text-2xl font-black text-foreground uppercase tracking-tight flex items-center gap-2 md:gap-3 leading-tight">
                <Building2 className="h-5 w-5 md:h-6 md:w-6 text-primary shrink-0" />
                <span className="truncate">{selectedSiteObj?.name}</span>
              </h2>
              <p className="text-muted-foreground text-[8px] md:text-xs font-bold uppercase tracking-[0.2em]">{selectedSiteObj?.projectCompany}</p>
            </div>
            
            <div className="flex items-center gap-2 md:gap-3 w-full sm:w-auto">
              {selectedSiteObj?.drawingUrl ? (
                <div className="flex items-center gap-2 flex-1 sm:flex-none">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    asChild
                    className="h-9 rounded-sm font-black uppercase text-[8px] md:text-[10px] tracking-widest border-primary/20 text-primary bg-primary/5 flex-1 sm:flex-none"
                  >
                    <a href={selectedSiteObj.drawingUrl} download target="_blank" rel="noopener noreferrer">
                      <FileText className="h-3.5 w-3.5 mr-1.5" /> View Drawing
                    </a>
                  </Button>
                  {isAdmin && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive rounded-sm hover:bg-destructive/10 shrink-0" 
                      onClick={() => setDeletingDrawing(selectedSiteObj)}
                      title="Remove Drawing"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ) : (
                <div className="relative flex-1 sm:flex-none">
                  <input 
                    type="file" 
                    accept=".pdf" 
                    className="hidden" 
                    id="drawing-upload" 
                    onChange={handleDrawingUpload}
                    disabled={isUploadingDrawing}
                  />
                  <Button 
                    asChild 
                    disabled={isUploadingDrawing}
                    className="h-9 rounded-sm font-black uppercase text-[8px] md:text-[10px] tracking-widest shadow-md px-4 bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto"
                  >
                    <label htmlFor="drawing-upload" className="cursor-pointer flex items-center justify-center">
                      {isUploadingDrawing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
                      Add Drawing PDF
                    </label>
                  </Button>
                </div>
              )}

              <Button 
                onClick={() => exportToPDF(filteredInst)} 
                disabled={isExporting || filteredInst.length === 0} 
                variant="outline" 
                className="h-9 rounded-sm font-black uppercase text-[8px] md:text-[10px] tracking-widest border-primary text-primary hover:bg-primary/5 flex-1 sm:flex-none"
              >
                {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <FileDown className="h-3.5 w-3.5 mr-1.5" />}
                Export All (PDF)
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:gap-4 bg-card p-3 md:p-4 border border-primary/10 rounded-sm shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4 items-end">
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-[9px] md:text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Search Table or Auditor</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Filter by table ref or personnel..." 
                    className="pl-9 h-9 md:h-10 rounded-sm bg-background border-primary/10 text-xs"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[9px] md:text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Time Range</Label>
                <div className="flex gap-2">
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="h-9 md:h-10 rounded-sm border-primary/20 bg-background font-bold text-xs uppercase flex-1">
                      <Calendar className="h-3.5 w-3.5 mr-2 opacity-50" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today" className="text-xs font-bold uppercase">Today</SelectItem>
                      <SelectItem value="7days" className="text-xs font-bold uppercase">Last 7 Days</SelectItem>
                      <SelectItem value="lastMonth" className="text-xs font-bold uppercase">Last Month</SelectItem>
                      <SelectItem value="allTime" className="text-xs font-bold uppercase">All Records</SelectItem>
                      <SelectItem value="custom" className="text-xs font-bold uppercase text-primary">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={clearAuditFilters} className="h-9 md:h-10 w-9 md:w-10 text-muted-foreground rounded-sm border border-transparent hover:border-primary/10">
                    <FilterX className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-end">
                {dateFilter === 'custom' && (
                  <div className="w-full flex gap-2 animate-in fade-in zoom-in-95 duration-200">
                    <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-9 md:h-10 rounded-sm border-primary/20 text-[9px] md:text-[10px]" />
                    <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-9 md:h-10 rounded-sm border-primary/20 text-[9px] md:text-[10px]" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="md:hidden space-y-3">
            {filteredInst.length > 0 ? filteredInst.map((record) => (
              <Card 
                key={record.id} 
                className="rounded-xl border-primary/5 shadow-sm overflow-hidden bg-card hover:bg-primary/[0.01] active:bg-primary/[0.02] transition-colors cursor-pointer"
                onClick={() => setViewingInstallation(record)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4 min-w-0">
                    <Badge className="h-10 w-12 rounded-lg bg-primary/5 text-primary border-none flex items-center justify-center font-black text-xs shrink-0">
                      {record.tableNumber}
                    </Badge>
                    <div className="flex flex-col min-w-0 gap-1">
                      <div className="flex items-center gap-2 text-foreground font-bold">
                        <User className="h-3 w-3 text-primary/60" />
                        <span className="text-xs truncate">{record.userName}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                          <Calendar className="h-3 w-3" />
                          {record.createdAt ? format(record.createdAt.toDate(), 'dd MMM yyyy • HH:mm a') : '—'}
                        </div>
                        <button 
                          className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium hover:text-primary transition-colors"
                          onClick={(e) => { e.stopPropagation(); setCommentingRecord(record); }}
                        >
                          <MessageCircle className="h-3 w-3" />
                          {record.comments?.length || 0} comments
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-primary rounded-full hover:bg-primary/5" onClick={() => setViewingInstallation(record)}>
                      <Eye className="h-5 w-5" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground rounded-full hover:bg-muted/50">
                          <MoreVertical className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-lg shadow-xl">
                        <DropdownMenuItem onClick={() => exportToPDF([record])} className="gap-2 cursor-pointer font-medium py-2.5">
                          <FileDown className="h-4 w-4" /> Export PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setCommentingRecord(record)} className="gap-2 cursor-pointer font-medium py-2.5">
                          <MessageCircle className="h-4 w-4" /> Add Comment
                        </DropdownMenuItem>
                        {(isAdmin || record.userId === user?.uid) && (
                          <DropdownMenuItem onClick={() => setDeletingRecord(record)} className="gap-2 cursor-pointer font-medium py-2.5 text-destructive focus:text-destructive">
                            <Trash2 className="h-4 w-4" /> Delete Audit
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <div className="text-center py-12 text-muted-foreground italic bg-muted/5 rounded-sm border-2 border-dashed">No audits found.</div>
            )}
          </div>

          <Card className="hidden md:block rounded-sm border-primary/10 shadow-md overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> Audit Records ({filteredInst.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead 
                      className="px-6 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleAuditSort('date')}
                    >
                      <div className="flex items-center">Date & Time <AuditSortIcon column="date" /></div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleAuditSort('table')}
                    >
                      <div className="flex items-center">Table Ref <AuditSortIcon column="table" /></div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleAuditSort('user')}
                    >
                      <div className="flex items-center">Auditor <AuditSortIcon column="user" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-center cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleAuditSort('comments')}
                    >
                      <div className="flex items-center justify-center">Comments <AuditSortIcon column="comments" /></div>
                    </TableHead>
                    <TableHead className="text-right px-6">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInst.length > 0 ? filteredInst.map((record) => (
                    <TableRow 
                      key={record.id} 
                      className="hover:bg-muted/5 transition-colors group cursor-pointer"
                      onClick={() => setViewingInstallation(record)}
                    >
                      <TableCell className="px-6 py-4 font-mono text-[10px] font-bold text-muted-foreground">
                        {record.createdAt ? format(record.createdAt.toDate(), 'dd MMM yy HH:mm') : '—'}
                      </TableCell>
                      <TableCell><Badge variant="secondary" className="rounded-sm font-black text-[10px] uppercase bg-primary/5 text-primary border-primary/10">{record.tableNumber}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <User className="h-3 w-3 text-primary opacity-50" />
                          {record.userName}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => { e.stopPropagation(); setCommentingRecord(record); }} 
                          className="h-7 text-[10px] font-bold uppercase gap-1.5 hover:bg-primary/5 text-muted-foreground hover:text-primary"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> {record.comments?.length || 0}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => setViewingInstallation(record)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-600 rounded-sm hover:text-primary" 
                            onClick={() => exportToPDF([record])}
                            title="Export PDF"
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground rounded-sm hover:text-primary" onClick={() => setCommentingRecord(record)}>
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          {(isAdmin || record.userId === user?.uid) && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => setDeletingRecord(record)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic text-sm">No audits found matching criteria.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!viewingInstallation} onOpenChange={(o) => !o && setViewingInstallation(null)}>
        <DialogContent className="max-w-4xl w-[98vw] h-[90vh] p-0 overflow-hidden border-none rounded-sm shadow-2xl bg-background flex flex-col">
          <DialogHeader className="p-4 md:p-6 bg-primary/5 border-b shrink-0 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="bg-primary/10 p-2 rounded-sm"><ShieldCheck className="h-4 w-4 md:h-5 md:w-5 text-primary" /></div>
              <div className="min-w-0">
                <DialogTitle className="text-sm md:text-xl font-black uppercase tracking-tight truncate">Audit Summary</DialogTitle>
                <DialogDescription className="text-[8px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">{viewingInstallation?.siteName} • Table {viewingInstallation?.tableNumber}</DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 pr-8">
               <Button onClick={() => viewingInstallation && exportToPDF([viewingInstallation])} variant="outline" size="sm" className="h-8 md:h-9 rounded-sm font-black uppercase text-[8px] md:text-[10px] tracking-widest border-primary/20 text-primary">
                 <FileDown className="h-3.5 w-3.5 mr-0 md:mr-1.5" /> <span className="hidden md:inline">PDF Report</span>
               </Button>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="p-4 md:p-8 space-y-8 md:space-y-10 text-left">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <div className="space-y-1"><Label className="text-[8px] md:text-[9px] font-black uppercase text-muted-foreground">Personnel</Label><p className="text-[10px] md:text-xs font-bold">{viewingInstallation?.userName}</p></div>
                <div className="space-y-1"><Label className="text-[8px] md:text-[9px] font-black uppercase text-muted-foreground">Status</Label><div><Badge className="bg-green-600 text-white font-black uppercase text-[7px] md:text-[8px] border-none px-2 h-4 md:h-5">Verified</Badge></div></div>
                <div className="space-y-1"><Label className="text-[8px] md:text-[9px] font-black uppercase text-muted-foreground">Customer Present</Label><p className="text-[10px] md:text-xs font-bold">{viewingInstallation?.customerRepPresent ? `Yes (${viewingInstallation.customerRepName})` : 'No'}</p></div>
                <div className="space-y-1"><Label className="text-[8px] md:text-[9px] font-black uppercase text-muted-foreground">Timestamp</Label><p className="text-[10px] md:text-xs font-mono font-bold">{viewingInstallation?.createdAt ? format(viewingInstallation.createdAt.toDate(), 'dd MMM yy, HH:mm') : '—'}</p></div>
              </div>

              <Separator />

              <div className="space-y-6">
                <Label className="text-[9px] md:text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Verification Points Feed
                </Label>
                <div className="flex flex-col gap-4 md:gap-6">
                  {viewingInstallation?.checks.map((check, idx) => (
                    <div key={idx} className="flex flex-col gap-4 p-3 md:p-5 border rounded-sm bg-muted/5 group transition-colors hover:border-primary/20">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] md:text-[11px] font-black uppercase text-foreground">{check.label}</span>
                          <Badge variant="outline" className="h-3.5 px-1.5 text-[6px] font-black uppercase bg-white border-primary/20 text-primary">Requirement</Badge>
                        </div>
                        <p className="text-xs italic text-muted-foreground leading-relaxed">
                          "{check.remarks || 'No specific observations recorded.'}"
                        </p>
                      </div>
                      
                      {check.attachments && check.attachments.length > 0 ? (
                        <div className="flex flex-wrap gap-2 md:gap-3">
                          {check.attachments.map((file, fIdx) => (
                            <div 
                              key={fIdx} 
                              className="relative aspect-video w-24 md:w-40 rounded-sm overflow-hidden border shadow-sm shrink-0 bg-muted cursor-pointer"
                              onClick={() => openViewer(file, check.attachments!)}
                            >
                              {isVideo(file) ? (
                                <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                                  <Film className="h-6 w-6 md:h-8 md:w-8 text-white opacity-40" />
                                  <PlayCircle className="absolute h-6 w-6 md:h-8 md:w-8 text-white" />
                                </div>
                              ) : (
                                <img src={file.url} className="w-full h-full object-cover" alt={file.name} />
                              )}
                              <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Maximize2 className="h-4 w-4 text-white" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="w-fit px-3 md:px-4 h-6 md:h-8 bg-muted/50 border border-dashed rounded-sm flex items-center justify-center text-[7px] md:text-[8px] font-bold text-muted-foreground uppercase opacity-40">No Media Evidence</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {viewingInstallation?.otherRemarks && (
                <div className="p-4 md:p-6 bg-primary/5 border rounded-sm space-y-4 md:space-y-6">
                   <div className="space-y-2">
                      <Label className="text-[8px] md:text-[9px] font-black uppercase text-primary tracking-widest">Other Remarks</Label>
                      <p className="text-[10px] md:text-sm font-medium leading-relaxed italic text-foreground/80">"{viewingInstallation.otherRemarks}"</p>
                    </div>

                    {viewingInstallation.otherAttachments && viewingInstallation.otherAttachments.length > 0 && (
                       <div className="flex flex-wrap gap-2 md:gap-4">
                          {viewingInstallation.otherAttachments.map((file, idx) => (
                            <div 
                              key={idx} 
                              className="relative aspect-video w-24 md:w-48 rounded-sm overflow-hidden border shadow-lg bg-muted shrink-0 cursor-pointer"
                              onClick={() => openViewer(file, viewingInstallation.otherAttachments!)}
                            >
                              {isVideo(file) ? (
                                <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                                  <Film className="h-6 w-6 md:h-10 md:w-10 text-white opacity-40" />
                                  <PlayCircle className="absolute h-6 w-6 md:h-10 md:w-10 text-white" />
                                </div>
                              ) : (
                                <img src={file.url} className="w-full h-full object-cover" alt="Supplementary" />
                              )}
                              <div className="absolute top-1 md:top-2 right-1 md:right-2 p-1 bg-black/40 rounded-sm">
                                <Maximize2 className="h-3 w-3 text-white" />
                              </div>
                            </div>
                          ))}
                       </div>
                    )}
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 bg-muted/5 border-t shrink-0">
            <DialogClose asChild>
              <Button variant="outline" className="rounded-sm font-black uppercase text-[10px] h-10 md:h-11 px-8 w-full sm:w-auto">Close Audit Log</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comment Dialog */}
      <Dialog open={!!commentingRecord} onOpenChange={(o) => !o && setCommentingRecord(null)}>
        <DialogContent className="max-w-md w-[95vw] p-0 overflow-hidden border-none rounded-sm shadow-2xl bg-background flex flex-col h-[70vh]">
          <DialogHeader className="p-4 md:p-6 bg-primary/5 border-b shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-sm"><MessageCircle className="h-5 w-5 text-primary" /></div>
              <div className="min-w-0">
                <DialogTitle className="text-base md:text-xl font-black uppercase tracking-tight truncate">Audit Discussion</DialogTitle>
                <DialogDescription className="text-[10px] md:text-xs font-medium truncate">Table {commentingRecord?.tableNumber} • {commentingRecord?.siteName}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 flex flex-col min-h-0 bg-background">
            <ScrollArea className="flex-1 p-4 md:p-6">
              <div className="space-y-4 md:space-y-6">
                {commentingRecord?.comments && commentingRecord.comments.length > 0 ? (
                  commentingRecord.comments.map((comment, i) => (
                    <div key={i} className="flex flex-col gap-1.5 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] md:text-[11px] font-black text-primary uppercase tracking-tight">{comment.userName}</span>
                        <span className="text-[8px] md:text-[9px] font-mono text-muted-foreground uppercase">{comment.createdAt ? format(new Date(comment.createdAt), 'dd MMM, HH:mm') : '—'}</span>
                      </div>
                      <div className="p-2.5 md:p-3 bg-muted/20 border rounded-sm text-left">
                        <p className="text-xs md:text-sm font-medium leading-relaxed italic">"{comment.text}"</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center flex flex-col items-center gap-3 opacity-20">
                    <MessageCircle className="h-10 w-10" />
                    <p className="text-[10px] font-black uppercase tracking-widest">No comments yet</p>
                  </div>
                )}
              </div>
            </ScrollArea>
            
            <div className="p-4 md:p-6 border-t bg-muted/5 space-y-3 md:space-y-4 shrink-0">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Post Comment</Label>
              <div className="flex gap-2">
                <Textarea 
                  placeholder="Type your message..." 
                  className="min-h-[60px] md:min-h-[80px] rounded-sm bg-background border-primary/20 text-xs md:text-sm"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <DialogClose asChild><Button variant="ghost" className="rounded-sm font-bold uppercase text-[10px] h-9 md:h-10 px-4 md:px-6">Close</Button></DialogClose>
                <Button 
                  onClick={handlePostComment} 
                  disabled={isProcessing || !newComment.trim()} 
                  className="rounded-sm font-black uppercase text-[10px] h-9 md:h-10 px-6 md:px-8 shadow-md"
                >
                  {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                  Send
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Audit Record Alert */}
      <AlertDialog open={!!deletingRecord} onOpenChange={(o) => !o && setDeletingRecord(null)}>
        <AlertDialogContent className="rounded-sm w-[95vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive font-black uppercase tracking-tight">
              <Trash2 className="h-5 w-5" /> Delete Audit Record?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs md:text-sm font-medium leading-relaxed">
              Are you sure you want to permanently remove this audit log for Table <strong>{deletingRecord?.tableNumber}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="rounded-sm font-bold uppercase text-[10px] h-10 md:h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteRecord} 
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-sm font-black uppercase text-[10px] h-10 md:h-11 shadow-lg shadow-destructive/10"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Confirm Deletion"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Drawing Alert */}
      <AlertDialog open={!!deletingDrawing} onOpenChange={(o) => !o && setDeletingDrawing(null)}>
        <AlertDialogContent className="rounded-sm w-[95vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive font-black uppercase tracking-tight">
              <Trash2 className="h-5 w-5" /> Remove Site Drawing?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs md:text-sm font-medium leading-relaxed">
              Are you sure you want to permanently remove the Table Numbering Drawing for <strong>{deletingDrawing?.name}</strong>? This action cannot be undone and will require a new upload.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="rounded-sm font-bold uppercase text-[10px] h-10 md:h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteDrawing} 
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-sm font-black uppercase text-[10px] h-10 md:h-11 shadow-lg shadow-destructive/10"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Confirm Removal"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modern High-Fidelity Media Viewer Overlay */}
      <Dialog open={!!viewFile} onOpenChange={(o) => { if(!o) { resetViewer(); setViewFile(null); setViewFiles([]); } }}>
        <DialogContent className="max-w-[95vw] h-[90vh] p-0 border-none bg-black/95 flex flex-col items-center justify-center rounded-sm overflow-hidden shadow-2xl">
          <DialogHeader className="sr-only"><DialogTitle>Audit Media Detail</DialogTitle><DialogDescription>Visual evidence review</DialogDescription></DialogHeader>
          
          <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-3 md:p-4 bg-gradient-to-b from-black/60 to-transparent no-print">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="bg-white/10 p-1.5 rounded-sm"><ImageIcon className="h-3.5 w-3.5 md:h-4 md:w-4 text-white" /></div>
              <div className="flex flex-col min-w-0">
                <span className="text-[8px] md:text-[10px] font-black text-white uppercase tracking-widest truncate max-w-[120px] sm:max-w-xs">{viewFile?.name}</span>
                <span className="text-[7px] md:text-[8px] font-bold text-white/60 uppercase">{currentFileIndex + 1} of {viewFiles.length} </span>
              </div>
            </div>

            <div className="flex items-center gap-1 md:gap-1.5">
              <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9 rounded-full bg-white/5 hover:bg-white/20 text-white border-none" onClick={() => setScale(prev => Math.min(prev + 0.5, 4))}><ZoomIn className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9 rounded-full bg-white/5 hover:bg-white/20 text-white border-none" onClick={() => { setScale(prev => Math.max(prev - 0.5, 1)); if(scale <= 1) setPosition({x:0,y:0}); }}><ZoomOut className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9 rounded-full bg-white/5 hover:bg-white/20 text-white border-none" onClick={resetViewer}><RotateCcw className="h-4 w-4" /></Button>
              <Separator orientation="vertical" className="h-6 bg-white/20 mx-1 md:mx-2" />
              <DialogClose asChild><Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9 rounded-full bg-white/10 hover:bg-red-500 text-white border-none transition-colors"><X className="h-5 w-5" /></Button></DialogClose>
            </div>
          </div>

          {viewFiles.length > 1 && (
            <>
              <div className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-50 no-print">
                <Button variant="secondary" size="icon" className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-white/10 hover:bg-white/20 text-white border-none shadow-2xl backdrop-blur-md" onClick={(e) => { e.stopPropagation(); prevFile(); }}><ChevronLeft className="h-6 w-6 md:h-8 md:w-8" /></Button>
              </div>
              <div className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-50 no-print">
                <Button variant="secondary" size="icon" className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-white/10 hover:bg-white/20 text-white border-none shadow-2xl backdrop-blur-md" onClick={(e) => { e.stopPropagation(); nextFile(); }}><ChevronRight className="h-6 w-6 md:h-8 md:w-8" /></Button>
              </div>
            </>
          )}

          <div 
            ref={containerRef} 
            className={cn(
              "relative w-full h-full flex items-center justify-center overflow-hidden touch-none",
              scale > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
            )}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
          >
            <div 
              ref={mediaRef}
              className={cn(
                "transition-transform duration-200 ease-out will-change-transform flex items-center justify-center select-none pointer-events-none w-fit h-fit",
                isDragging && "transition-none"
              )}
              style={{ 
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              }}
            >
              {viewFile && (
                isVideo(viewFile) ? (
                  <div className="pointer-events-auto">
                    <video 
                      src={viewFile.url} 
                      controls 
                      autoPlay 
                      className="max-w-[90vw] max-h-[80vh] shadow-2xl rounded-sm" 
                    />
                  </div>
                ) : (
                  <img 
                    src={viewFile.url} 
                    className="max-w-[90vw] max-h-[80vh] object-contain shadow-2xl rounded-sm pointer-events-none" 
                    alt="Evidence View" 
                    draggable={false}
                  />
                )
              )}
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent flex flex-col items-center gap-2 no-print">
            <div className="flex gap-1">
              {viewFiles.map((_, i) => (
                <div key={i} className={cn("h-1 w-3 md:w-4 rounded-full transition-all", i === currentFileIndex ? "bg-primary w-6 md:w-8" : "bg-white/20")} />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
