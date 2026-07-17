
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
  Check, 
  X, 
  AlertTriangle,
  Zap
} from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { isSuperAdmin } from '@/lib/auth-constants';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

const CHECK_KEYS = [
  { key: 'studInstalled', label: 'Stud' },
  { key: 'vCross', label: 'V-Cross' },
  { key: 'stayInstalled', label: 'Stay' },
  { key: 'discInsulator', label: 'Disc' },
  { key: 'pinInsulator', label: 'Pin' },
  { key: 'abSwitch', label: 'AB Switch' },
  { key: 'dangerBoard', label: 'Danger Board' },
  { key: 'barbedWire', label: 'Barbed Wire' },
  { key: 'concreting', label: 'Concreting' },
  { key: 'earthingSet', label: 'Earthing' },
  { key: 'redOxide', label: 'Red Oxide' },
  { key: 'silverPaint', label: 'Silver Paint' },
];

const QTY_FIELDS = ['studInstalled', 'discInsulator', 'pinInsulator', 'earthingSet'];

type HTLineChecklist = {
  id: string;
  poleNumber: string;
  poleType: string;
  poleSize: string;
  cutPointType: string;
  checks: { key: string; label: string; status: string; quantity?: number }[];
};

export default function HTLineMatrixPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = React.use(params);
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const siteRef = useMemoFirebase(() => doc(firestore, 'sites', siteId), [firestore, siteId]);
  const { data: site, isLoading: siteLoading } = useDoc<any>(siteRef);

  const htQuery = useMemoFirebase(() => query(collection(firestore, 'ht_line_checklists'), where('siteId', '==', siteId), limit(1000)), [firestore, siteId]);
  const { data: records, isLoading: htLoading } = useCollection<HTLineChecklist>(htQuery);

  const filteredRecords = React.useMemo(() => {
    if (!records) return [];
    return [...records].sort((a, b) => a.poleNumber.localeCompare(b.poleNumber, undefined, { numeric: true, sensitivity: 'base' }));
  }, [records]);

  const columnTotals = React.useMemo(() => {
    const totals: Record<string, number> = {};
    CHECK_KEYS.forEach(k => totals[k.key] = 0);

    filteredRecords.forEach(record => {
      CHECK_KEYS.forEach(k => {
        const check = record.checks.find(c => c.key === k.key);
        if (check?.status === 'Yes') {
          if (QTY_FIELDS.includes(k.key)) {
            totals[k.key] += (Number(check.quantity) || 0);
          } else {
            totals[k.key] += 1;
          }
        }
      });
    });
    return totals;
  }, [filteredRecords]);

  const handleExport = () => {
    if (filteredRecords.length === 0) return;

    const exportData = filteredRecords.map(record => {
      const row: any = {
        'Pole #': record.poleNumber,
        'Type': record.poleType,
        'Size': record.poleSize,
        'Cut Point': record.cutPointType,
      };

      CHECK_KEYS.forEach(k => {
        const check = record.checks.find(c => c.key === k.key);
        if (check?.status === 'Yes') {
          row[k.label] = QTY_FIELDS.includes(k.key) ? (check.quantity || 1) : 1;
        } else {
          row[k.label] = 0;
        }
      });

      return row;
    });

    // Add Total Row to export
    const totalRow: any = { 'Pole #': 'TOTAL', 'Type': '', 'Size': '', 'Cut Point': '' };
    CHECK_KEYS.forEach(k => {
      totalRow[k.label] = columnTotals[k.key];
    });
    exportData.push(totalRow);

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "HT Line Matrix");
    XLSX.writeFile(wb, `HT_Line_Matrix_${site?.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  if (isProfileLoading || siteLoading || htLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-[600px] w-full" /></div>;

  return (
    <div className="space-y-6 md:space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/checklists/data/${siteId}/ht-line`)} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Registry
        </Button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-sm"><LayoutGrid className="h-6 w-6 text-primary" /></div>
            <div>
              <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight">{site?.name} HT Line Matrix</h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Global Pole Component Grid</p>
            </div>
          </div>
          <Button onClick={handleExport} variant="outline" className="h-10 rounded-sm font-bold border-primary text-primary hover:bg-primary/5 px-6">
            <FileDown className="h-4 w-4 mr-2" /> Export Matrix
          </Button>
        </div>
      </div>

      <Card className="rounded-sm border-primary/10 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
        <ScrollArea className="flex-1 w-full">
          <div className="min-w-full">
            <Table className="border-separate border-spacing-0 table-fixed w-full text-[10px]">
              <TableHeader className="sticky top-0 z-20 shadow-sm">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[80px] font-black uppercase tracking-widest bg-primary text-white sticky left-0 top-0 z-30 px-3 py-4 border-r border-white/10">Pole #</TableHead>
                  <TableHead className="w-[120px] font-black uppercase tracking-widest bg-primary text-white border-r border-white/10 px-3 py-4">Config</TableHead>
                  {CHECK_KEYS.map((k) => (
                    <TableHead key={k.key} className="text-center font-black uppercase tracking-tight leading-tight w-[80px] px-2 py-4 bg-primary text-white border-r border-white/10">{k.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id} className="hover:bg-primary/[0.02] transition-colors group">
                    <TableCell className="px-3 py-4 font-black text-sm border-r border-b bg-background sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                      #{record.poleNumber}
                    </TableCell>
                    <TableCell className="px-3 py-4 border-r border-b bg-background font-bold text-muted-foreground">
                      <div className="flex flex-col gap-0.5">
                        <span className="truncate">{record.poleType}</span>
                        <span className="text-[8px] opacity-60 truncate">{record.poleSize}</span>
                      </div>
                    </TableCell>
                    {CHECK_KEYS.map((k) => {
                      const check = record.checks.find(c => c.key === k.key);
                      const isYes = check?.status === 'Yes';
                      return (
                        <TableCell key={k.key} className="text-center py-4 border-r border-b font-mono font-bold text-sm">
                          {isYes ? (
                             QTY_FIELDS.includes(k.key) ? (
                               <span className="text-primary">{check.quantity || 1}</span>
                             ) : <span className="text-primary">1</span>
                          ) : <span className="text-muted-foreground/30">0</span>}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                
                {/* Total Row */}
                <TableRow className="bg-muted/50 font-black">
                  <TableCell className="sticky left-0 z-30 bg-muted/90 px-3 py-6 border-r border-b shadow-[2px_0_5px_rgba(0,0,0,0.05)] text-primary">TOTAL</TableCell>
                  <TableCell className="bg-muted/90 border-r border-b"></TableCell>
                  {CHECK_KEYS.map((k) => (
                    <TableCell key={`total-${k.key}`} className="text-center py-6 border-r border-b text-primary text-base font-mono">
                      {columnTotals[k.key]}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <div className="p-3 border-t bg-muted/5 flex items-center justify-center gap-6 shrink-0 z-10">
           <div className="flex items-center gap-1.5"><span className="text-[9px] font-black uppercase text-foreground/70 tracking-widest">Binary Logic: YES=1, NO=0</span></div>
           <Separator orientation="vertical" className="h-4" />
           <div className="flex items-center gap-1.5"><span className="text-[9px] font-black uppercase text-foreground/70 tracking-widest">Qty fields display count</span></div>
        </div>
      </Card>
    </div>
  );
}
