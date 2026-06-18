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
  Building2
} from 'lucide-react';
import { format } from 'date-fns';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { isSuperAdmin } from '@/lib/auth-constants';
import { useToast } from '@/hooks/use-toast';
import { Progress } from "@/components/ui/progress";

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
  checks: { key?: string; label: string; remarks: string; status: 'OK' | 'NOT OK' | 'Pending' }[];
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

      // Legends at the end
      if (currY > 180) { doc.addPage(); currY = 25; }
      currY += 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('LEGENDS:', margin, currY);
      currY += 6;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 128, 0); doc.text('OK: Verification points found in compliance.', margin, currY);
      currY += 5;
      doc.setTextColor(255, 0, 0); doc.text('NOT OK: Issues detected requiring immediate remediation.', margin, currY);
      currY += 5;
      doc.setTextColor(218, 165, 32); doc.text('Pending: Verification incomplete or Work is still pending.', margin, currY);

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
                          <TableCell key={key} className="text-center py-4 border-r last:border-0 w-[160px]">
                            <div className="flex justify-center">
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
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground italic">No metrics available.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
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
    </div>
  );
}
