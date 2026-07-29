'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, doc, limit, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Zap,
  Pencil,
  FileDown,
  User,
  TrendingUp,
  History
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { isSuperAdmin } from '@/lib/auth-constants';
import Link from 'next/link';
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
import { Progress } from "@/components/ui/progress";
import { useToast } from '@/hooks/use-toast';

type HTConductorChecklist = {
  id: string;
  siteId: string;
  siteName: string;
  projectCompany?: string;
  poleConfiguration: string;
  userName: string;
  userId: string;
  status: string;
  createdAt: any;
  updatedAt?: any;
  updatedByName?: string;
  spans: { label: string; distance: number; remarks?: string }[];
};

export default function ProjectHTConductorDataPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = React.use(params);
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = React.useState("");
  const [deletingRecord, setDeletingRecord] = React.useState<HTConductorChecklist | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);
  const [generationProgress, setGenerationProgress] = React.useState(0);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const siteRef = useMemoFirebase(() => doc(firestore, 'sites', siteId), [firestore, siteId]);
  const { data: site, isLoading: siteLoading } = useDoc<any>(siteRef);

  const htQuery = useMemoFirebase(() => query(collection(firestore, 'ht_conductor_checklists'), where('siteId', '==', siteId), limit(1000)), [firestore, siteId]);
  const { data: records, isLoading: htLoading } = useCollection<HTConductorChecklist>(htQuery);

  const siteTotalLength = React.useMemo(() => {
    if (!records) return 0;
    return records.reduce((acc, record) => {
      const recordTotal = record.spans?.reduce((sum, span) => sum + (Number(span.distance) || 0), 0) || 0;
      return acc + recordTotal;
    }, 0);
  }, [records]);

  const filteredRecords = React.useMemo(() => {
    if (!records) return [];
    return records.filter(r => 
      r.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.status.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
  }, [records, searchTerm]);

  const handleExportPDF = async (items: HTConductorChecklist[]) => {
    if (items.length === 0) return;
    setIsExporting(true);
    setGenerationProgress(0);

    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF('p', 'mm', 'a4');
      
      for (let index = 0; index < items.length; index++) {
        const record = items[index];
        if (index > 0) doc.addPage();
        
        setGenerationProgress(Math.round(((index + 1) / items.length) * 100));
        await new Promise(resolve => setTimeout(resolve, 0));

        const margin = 15;
        let currY = 40;
        const colWidthLabel = 65;
        const colWidthValue = 115;
        const rowHeight = 8;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('HT CONDUCTOR SPAN AUDIT', margin, currY - 10);
        
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
        drawRow('PLANT CONFIGURATION', record.poleConfiguration);
        drawRow('AUDITOR', record.userName);
        drawRow('STATUS', record.status);

        currY += 5;
        const colDesc = 110; const colDist = 40; const colTotal = 30;
        doc.setFont('helvetica', 'bold');
        doc.rect(margin, currY, colDesc, rowHeight);
        doc.text('SPAN DESCRIPTION', margin + 2, currY + 5.5);
        doc.rect(margin + colDesc, currY, colDist, rowHeight);
        doc.text('DISTANCE (MTRS)', margin + colDesc + 2, currY + 5.5);
        currY += rowHeight;

        doc.setFont('helvetica', 'normal');
        let recordTotalDist = 0;
        for (const span of record.spans) {
          const h = rowHeight;
          if (currY + h > 270) { doc.addPage(); currY = 30; }
          
          doc.rect(margin, currY, colDesc, h);
          doc.text(span.label.toUpperCase(), margin + 2, currY + 5.5);
          doc.rect(margin + colDesc, currY, colDist, h);
          const distNum = Number(span.distance) || 0;
          doc.text(distNum.toFixed(2), margin + colDesc + colDist - 2, currY + 5.5, { align: 'right' });
          recordTotalDist += distNum;
          currY += h;
        }

        // Total Row for this record
        doc.setFont('helvetica', 'bold');
        doc.rect(margin, currY, colDesc, rowHeight);
        doc.text('TOTAL SECTION LENGTH', margin + 2, currY + 5.5);
        doc.rect(margin + colDesc, currY, colDist, rowHeight);
        doc.text(recordTotalDist.toFixed(2), margin + colDesc + colDist - 2, currY + 5.5, { align: 'right' });
      }
      doc.save(`HT_Conductor_Audit_${site?.name.replace(/\s+/g, '_')}.pdf`);
      toast({ title: 'Export Complete' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Export Failed', description: e.message });
    } finally {
      setIsExporting(false);
      setGenerationProgress(0);
    }
  };

  const handleDelete = () => {
    if (!deletingRecord) return;
    deleteDocumentNonBlocking(doc(firestore, 'ht_conductor_checklists', deletingRecord.id));
    setDeletingRecord(null);
    toast({ title: 'Record Removed' });
  };

  if (isProfileLoading || siteLoading || htLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="space-y-6 md:space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/checklists/data/${siteId}`)} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Project Hub
        </Button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h2 className="text-lg md:text-2xl font-black text-foreground uppercase tracking-tight flex items-center gap-2 md:gap-3 leading-none">
              <Zap className="h-5 w-5 md:h-6 md:w-6 text-primary shrink-0" />
              <span className="truncate">{site?.name} : Conductor Records</span>
            </h2>
            <p className="text-muted-foreground text-[8px] md:text-xs font-bold uppercase tracking-[0.2em]">{site?.projectCompany}</p>
          </div>
          <div className="flex items-center gap-3">
             <Button 
                onClick={() => handleExportPDF(filteredRecords)} 
                disabled={isExporting || filteredRecords.length === 0} 
                variant="outline" size="sm" 
                className="h-9 rounded-sm font-black uppercase text-[10px] tracking-widest border-primary/20 text-primary"
             >
                {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <FileDown className="h-3.5 w-3.5 mr-1.5" />}
                Export All
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
          <Input placeholder="Search auditor or status..." className="pl-10 h-11 text-sm rounded-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="rounded-sm font-black uppercase text-[10px] tracking-widest px-3 h-8 border-primary/20 text-primary bg-primary/5">
            <TrendingUp className="h-3.5 w-3.5 mr-2" /> Total Site Length: {siteTotalLength.toFixed(2)} Mtrs
          </Badge>
          <Badge variant="secondary" className="rounded-sm font-black uppercase text-[9px] tracking-widest px-3 h-8 border-none">
            {filteredRecords.length} Audits Indexed
          </Badge>
        </div>
      </div>

      <Card className="rounded-sm border-primary/10 shadow-md overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6">Timestamp</TableHead>
                  <TableHead>Config</TableHead>
                  <TableHead>Spans</TableHead>
                  <TableHead className="text-center">Total Length</TableHead>
                  <TableHead>Auditor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Edited</TableHead>
                  <TableHead className="text-right px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map(record => {
                  const recordTotal = record.spans?.reduce((sum, span) => sum + (Number(span.distance) || 0), 0) || 0;
                  return (
                    <TableRow key={record.id} className="hover:bg-muted/5 transition-colors group cursor-pointer" onClick={() => router.push(`/checklists/data/${siteId}/ht-conductor/view/${record.id}`)}>
                      <TableCell className="px-6 py-4 font-mono text-[10px] font-bold text-muted-foreground">{record.createdAt ? format(record.createdAt.toDate(), 'dd MMM yy HH:mm') : '—'}</TableCell>
                      <TableCell className="font-bold text-sm text-primary">{record.poleConfiguration}</TableCell>
                      <TableCell><span className="text-xs font-bold">{record.spans?.length || 0} Points</span></TableCell>
                      <TableCell className="text-center font-mono font-bold text-xs text-primary">{recordTotal.toFixed(2)} Mtrs</TableCell>
                      <TableCell><div className="flex items-center gap-2 text-xs font-medium"><User className="h-3.5 w-3.5 text-primary opacity-50" />{record.userName}</div></TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          "rounded-sm text-[9px] font-black uppercase px-1.5 h-5",
                          record.status === 'Approved' ? "bg-green-50 text-green-700 border-green-200" :
                          record.status === 'Draft' ? "bg-amber-50 text-amber-700 border-amber-200" :
                          record.status === 'Rejected' ? "bg-red-50 text-red-700 border-red-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"
                        )}>
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {record.updatedAt ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-foreground">{record.updatedByName}</span>
                            <span className="text-[9px] font-mono font-medium text-muted-foreground">{format(record.updatedAt.toDate(), 'dd/MM HH:mm')}</span>
                          </div>
                        ) : <span className="text-[10px] text-muted-foreground italic">—</span>}
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => handleExportPDF([record])} title="Export PDF"><FileDown className="h-4 w-4" /></Button>
                          {(isAdmin || record.userId === user?.uid) && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" asChild><Link href={`/checklists/data/${siteId}/ht-conductor/edit/${record.id}`}><Pencil className="h-4 w-4" /></Link></Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" asChild><Link href={`/checklists/data/${siteId}/ht-conductor/view/${record.id}`}><Eye className="h-4 w-4" /></Link></Button>
                          {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={(e) => { e.stopPropagation(); setDeletingRecord(record); }}><Trash2 className="h-4 w-4" /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredRecords.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground italic">No HT Conductor records found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingRecord} onOpenChange={o => !o && setDeletingRecord(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Audit Log?</AlertDialogTitle>
            <AlertDialogDescription>Removing record for {deletingRecord?.userName}. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white rounded-sm" onClick={handleDelete}>Confirm Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
