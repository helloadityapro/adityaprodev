'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, doc, limit, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Eye, 
  ArrowLeft,
  Loader2,
  Trash2,
  GlassWater,
  User,
  History,
  X,
  Maximize2,
  ImageIcon,
  FileDown,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { isSuperAdmin } from '@/lib/auth-constants';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from "@/components/ui/progress";
import * as XLSX from 'xlsx';

type ModuleBreakage = {
  id: string;
  siteId: string;
  siteName: string;
  serialNumber: string;
  moduleMake: string;
  idPhotoUrl: string;
  sunnySidePhotoUrl?: string;
  breakageReason: string;
  createdAt: any;
  createdBy: string;
  createdByName: string;
};

export default function ProjectModuleBreakageDataPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = React.use(params);
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = React.useState("");
  const [deletingRecord, setDeletingRecord] = React.useState<ModuleBreakage | null>(null);
  const [viewingRecord, setViewingRecord] = React.useState<ModuleBreakage | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);
  const [generationProgress, setGenerationProgress] = React.useState(0);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const siteRef = useMemoFirebase(() => doc(firestore, 'sites', siteId), [firestore, siteId]);
  const { data: site, isLoading: siteLoading } = useDoc<any>(siteRef);

  const breakageQuery = useMemoFirebase(() => query(collection(firestore, 'module_breakages'), where('siteId', '==', siteId), limit(1000)), [firestore, siteId]);
  const { data: records, isLoading: breakageLoading } = useCollection<ModuleBreakage>(breakageQuery);

  const filteredRecords = React.useMemo(() => {
    if (!records) return [];
    return records.filter(r => 
      r.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.createdByName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.moduleMake.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
  }, [records, searchTerm]);

  const handleExportExcel = () => {
    if (filteredRecords.length === 0) return;
    const exportData = filteredRecords.map(r => ({
      'Date & Time': r.createdAt ? format(r.createdAt.toDate(), 'dd-MM-yyyy HH:mm') : '—',
      'Serial Number': r.serialNumber,
      'Module Make': r.moduleMake,
      'Reason for Breakage': r.breakageReason,
      'Auditor Name': r.createdByName,
      'ID Photo Link': r.idPhotoUrl,
      'Physical Condition Photo': r.sunnySidePhotoUrl || '—'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Module Breakages");
    XLSX.writeFile(wb, `Module_Breakage_Registry_${site?.name?.replace(/\s+/g, '_') || 'Site'}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    toast({ title: "Excel Exported" });
  };

  const handleExportPDF = async () => {
    if (filteredRecords.length === 0) return;
    setIsExporting(true);
    setGenerationProgress(0);

    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF('p', 'mm', 'a4');
      const logoUrl = '/icon.png';

      let logoProps: any = null;
      try {
        logoProps = await doc.getImageProperties(logoUrl);
      } catch (e) {
        console.warn("Logo load failed", e);
      }

      const addHeaderLogo = (pdfDoc: any) => {
        if (!logoProps) return;
        try {
          const areaSize = 25;
          const startX = 210 - areaSize - 15;
          const startY = 10;
          const ratio = logoProps.width / logoProps.height;
          let renderW = areaSize;
          let renderH = areaSize;
          if (ratio > 1) renderH = areaSize / ratio;
          else renderW = areaSize * ratio;
          const x = startX + (areaSize - renderW) / 2;
          const y = startY + (areaSize - renderH) / 2;
          pdfDoc.addImage(logoUrl, 'PNG', x, y, renderW, renderH);
        } catch (e) {
          pdfDoc.addImage(logoUrl, 'PNG', 170, 10, 25, 25);
        }
      };

      const margin = 15;
      let currY = 40;
      const rowHeight = 8;

      addHeaderLogo(doc);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('MODULE BREAKAGE AUDIT REGISTRY', margin, currY - 10);
      
      doc.setFontSize(10);
      doc.text(`PROJECT: ${site?.name || 'Unknown Site'}`, margin, currY);
      doc.text(`COMPANY: ${site?.projectCompany || 'Aditya Green Energy'}`, margin, currY + 6);
      doc.text(`REPORT DATE: ${format(new Date(), 'dd MMM yyyy')}`, margin, currY + 12);
      
      currY += 25;

      doc.setFillColor(245, 245, 245);
      doc.rect(margin, currY, 180, 10, 'F');
      doc.setFontSize(8);
      doc.text('DATE', margin + 2, currY + 6.5);
      doc.text('SERIAL NUMBER', margin + 35, currY + 6.5);
      doc.text('MAKE', margin + 80, currY + 6.5);
      doc.text('REASON', margin + 110, currY + 6.5);
      doc.text('PROOF', margin + 165, currY + 6.5);
      
      currY += 10;
      doc.setFont('helvetica', 'normal');

      for (let i = 0; i < filteredRecords.length; i++) {
        const r = filteredRecords[i];
        setGenerationProgress(Math.round(((i + 1) / filteredRecords.length) * 100));
        await new Promise(resolve => setTimeout(resolve, 0));

        if (currY > 270) {
          doc.addPage();
          currY = 30;
          addHeaderLogo(doc);
        }

        const dateStr = r.createdAt ? format(r.createdAt.toDate(), 'dd/MM/yy HH:mm') : '—';
        const reasonLines = doc.splitTextToSize(r.breakageReason, 50);
        const h = Math.max(rowHeight, reasonLines.length * 4 + 4);

        doc.rect(margin, currY, 180, h);
        doc.text(dateStr, margin + 2, currY + 5);
        doc.text(r.serialNumber, margin + 35, currY + 5);
        doc.text(r.moduleMake, margin + 80, currY + 5);
        doc.text(reasonLines, margin + 110, currY + 5);
        
        doc.setTextColor(0, 0, 255);
        doc.text('View Photos', margin + 165, currY + 5);
        doc.link(margin + 165, currY + 1, 15, 5, { url: r.idPhotoUrl });
        doc.setTextColor(0, 0, 0);

        currY += h;
      }

      doc.save(`Breakage_Audit_${site?.name?.replace(/\s+/g, '_') || 'Site'}.pdf`);
      toast({ title: 'PDF Exported' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Export Failed', description: e.message });
    } finally {
      setIsExporting(false);
      setGenerationProgress(0);
    }
  };

  const handleDelete = () => {
    if (!deletingRecord) return;
    deleteDocumentNonBlocking(doc(firestore, 'module_breakages', deletingRecord.id));
    setDeletingRecord(null);
    toast({ title: 'Record Removed' });
  };

  if (isProfileLoading || siteLoading || breakageLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="space-y-6 md:space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/checklists/data/${siteId}`)} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Project Hub
        </Button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h2 className="text-lg md:text-2xl font-black text-foreground uppercase tracking-tight flex items-center gap-2 md:gap-3 leading-none">
              <GlassWater className="h-5 w-5 md:h-6 md:w-6 text-primary shrink-0" />
              <span className="truncate">{site?.name} : Breakage Records</span>
            </h2>
            <p className="text-muted-foreground text-[8px] md:text-xs font-bold uppercase tracking-[0.2em]">{site?.projectCompany}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleExportExcel} 
              disabled={filteredRecords.length === 0}
              variant="outline" size="sm" 
              className="h-9 rounded-sm font-black uppercase text-[10px] tracking-widest border-primary/20 text-primary"
            >
              <FileDown className="h-3.5 w-3.5 mr-1.5" />
              Excel
            </Button>
            <Button 
              onClick={handleExportPDF} 
              disabled={isExporting || filteredRecords.length === 0}
              variant="outline" size="sm" 
              className="h-9 rounded-sm font-black uppercase text-[10px] tracking-widest border-primary/20 text-primary"
            >
              {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <FileText className="h-3.5 w-3.5 mr-1.5" />}
              PDF Report
            </Button>
          </div>
        </div>
      </div>

      {isExporting && (
        <div className="space-y-1.5 animate-in fade-in duration-300">
          <div className="flex justify-between items-center text-[8px] font-black uppercase text-primary tracking-tighter">
            <span>Rendering PDF Documents</span>
            <span>{generationProgress}%</span>
          </div>
          <Progress value={generationProgress} className="h-1 rounded-none" />
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search Serial #, Make or Auditor..." 
            className="pl-10 h-11 text-sm rounded-sm" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
          />
        </div>
        <Badge variant="secondary" className="rounded-sm font-black uppercase text-[9px] tracking-widest px-3 h-8 border-none">
          {filteredRecords.length} Breakages Logged
        </Badge>
      </div>

      <Card className="rounded-sm border-primary/10 shadow-md overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6">Timestamp</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Make</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Auditor</TableHead>
                  <TableHead className="text-right px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map(record => (
                  <TableRow key={record.id} className="hover:bg-muted/5 transition-colors group">
                    <TableCell className="px-6 py-4 font-mono text-[10px] font-bold text-muted-foreground">{record.createdAt ? format(record.createdAt.toDate(), 'dd MMM yy HH:mm') : '—'}</TableCell>
                    <TableCell className="font-black text-sm text-primary">{record.serialNumber}</TableCell>
                    <TableCell className="font-bold text-xs uppercase">{record.moduleMake}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground" title={record.breakageReason}>{record.breakageReason}</TableCell>
                    <TableCell><div className="flex items-center gap-2 text-xs font-medium"><User className="h-3.5 w-3.5 text-primary opacity-50" />{record.createdByName}</div></TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => setViewingRecord(record)} title="View Photos"><Eye className="h-4 w-4" /></Button>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => setDeletingRecord(record)} title="Delete Record"><Trash2 className="h-4 w-4" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredRecords.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">No breakage records found for this site.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingRecord} onOpenChange={o => !o && setDeletingRecord(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Breakage Log?</AlertDialogTitle>
            <AlertDialogDescription>Removing record for Serial #{deletingRecord?.serialNumber}. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white rounded-sm" onClick={handleDelete}>Confirm Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!viewingRecord} onOpenChange={o => !o && setViewingRecord(null)}>
        <DialogContent className="max-w-4xl w-[95vw] rounded-sm p-0 overflow-hidden border-none shadow-2xl bg-background">
          <DialogHeader className="p-6 bg-primary/5 border-b flex flex-row items-center justify-between space-y-0 text-left">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-sm"><GlassWater className="h-5 w-5 text-primary" /></div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Breakage Proof</DialogTitle>
                <DialogDescription className="text-xs font-bold text-muted-foreground uppercase">SN: {viewingRecord?.serialNumber}</DialogDescription>
              </div>
            </div>
            <DialogClose asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><X className="h-5 w-5" /></Button></DialogClose>
          </DialogHeader>
          <ScrollArea className="max-h-[80vh]">
            <div className="p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><ImageIcon className="h-3.5 w-3.5" /> Module ID Sticker</Label>
                  {viewingRecord?.idPhotoUrl ? (
                    <img src={viewingRecord.idPhotoUrl} className="w-full aspect-[4/3] object-cover rounded-sm border shadow-sm" alt="ID Sticker" />
                  ) : <div className="aspect-[4/3] bg-muted flex items-center justify-center text-[10px] font-bold uppercase">No Image</div>}
                </div>
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><ImageIcon className="h-3.5 w-3.5" /> Sunny Side View</Label>
                  {viewingRecord?.sunnySidePhotoUrl ? (
                    <img src={viewingRecord.sunnySidePhotoUrl} className="w-full aspect-[4/3] object-cover rounded-sm border shadow-sm" alt="Sunny Side" />
                  ) : <div className="aspect-[4/3] bg-muted flex items-center justify-center text-[10px] font-bold uppercase">No Image</div>}
                </div>
              </div>
              <div className="p-4 bg-muted/20 border rounded-sm space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Reported Reason</Label>
                <p className="text-sm italic font-medium leading-relaxed">"{viewingRecord?.breakageReason}"</p>
              </div>
              <div className="flex items-center justify-between pt-4 border-t text-[10px] font-bold text-muted-foreground uppercase">
                <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-primary opacity-50" />Logged By {viewingRecord?.createdByName}</div>
                <div className="flex items-center gap-2"><History className="h-3.5 w-3.5 text-primary opacity-50" />{viewingRecord?.createdAt && format(viewingRecord.createdAt.toDate(), 'dd/MM/yyyy HH:mm')}</div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}