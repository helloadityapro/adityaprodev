
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
  MessageCircle,
  Cpu
} from 'lucide-react';
import { format } from 'date-fns';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { isSuperAdmin } from '@/lib/auth-constants';
import { useToast } from '@/hooks/use-toast';
import { Progress } from "@/components/ui/progress";
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "@/components/ui/dialog";

type InverterChecklist = {
  id: string;
  inverterNumber: string;
  inverterMake: string;
  inverterRating: string;
  checks: { label: string; remarks: string; status: string; attachments?: any[] }[];
};

const CHECK_LABELS = {
  mounting: "Inverter Mounting Condition",
  acTerminations: "Inverter AC Terminations",
  acCabinetPosition: "AC Cabinet Position",
  dcStrings: "DC Strings Connection",
  earthing: "Earthing Connections",
  canopy: "Canopy Fixing",
};

export default function InverterMatrixPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = React.use(params);
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [viewUrl, setViewUrl] = React.useState<string | null>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const siteRef = useMemoFirebase(() => doc(firestore, 'sites', siteId), [firestore, siteId]);
  const { data: site, isLoading: siteLoading } = useDoc<any>(siteRef);

  const invQuery = useMemoFirebase(() => query(collection(firestore, 'inverter_checklists'), where('siteId', '==', siteId), limit(1000)), [firestore, siteId]);
  const { data: records, isLoading: invLoading } = useCollection<InverterChecklist>(invQuery);

  const filteredRecords = React.useMemo(() => {
    if (!records) return [];
    return [...records].sort((a, b) => a.inverterNumber.localeCompare(b.inverterNumber, undefined, { numeric: true, sensitivity: 'base' }));
  }, [records]);

  if (isProfileLoading || siteLoading || invLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="space-y-6 md:space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/checklists/data/${siteId}/inverter`)} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Registry
        </Button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-sm"><LayoutGrid className="h-6 w-6 text-primary" /></div>
            <div>
              <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight">{site?.name} Inverter Matrix</h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Quality Data Grid</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="rounded-sm border-primary/10 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
        <ScrollArea className="flex-1 w-full">
          <div className="min-w-full">
            <TooltipProvider delayDuration={0}>
              <Table className="border-separate border-spacing-0 table-fixed w-full">
                <TableHeader className="sticky top-0 z-20 shadow-sm">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[120px] sm:w-[150px] font-black uppercase text-[10px] sm:text-xs tracking-widest bg-primary text-white sticky left-0 top-0 z-30 px-3 py-4 border-r border-white/10">Inverter #</TableHead>
                    {Object.values(CHECK_LABELS).map((label) => (
                      <TableHead key={label} className="text-center font-black uppercase text-[8px] sm:text-[10px] tracking-tight leading-tight w-[100px] sm:w-[160px] px-2 py-4 bg-primary text-white border-r border-white/10 last:border-0 sticky top-0 z-20">{label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id} className="hover:bg-primary/[0.02] transition-colors group">
                      <TableCell className="px-3 py-4 font-black text-xs sm:text-sm border-r border-b bg-background sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                        <div className="flex flex-col">
                          <span>{record.inverterNumber}</span>
                          <span className="text-[8px] font-bold text-muted-foreground uppercase truncate">{record.inverterMake}</span>
                        </div>
                      </TableCell>
                      {Object.values(CHECK_LABELS).map((label) => {
                        const check = record.checks.find(c => c.label === label);
                        const status = check?.status;
                        return (
                          <TableCell key={label} className="text-center py-0 border-r border-b last:border-0 w-[100px] sm:w-[160px] p-0">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="w-full h-full flex justify-center items-center py-4 cursor-default hover:bg-muted/10 transition-colors">
                                  {status === 'OK' ? <Check className="h-5 w-5 text-green-600" /> : status === 'NOT OK' ? <X className="h-5 w-5 text-red-600" /> : status === 'Pending' ? <AlertTriangle className="h-5 w-5 text-amber-500" /> : <span className="text-muted-foreground/30 font-black">—</span>}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="p-0 border-none shadow-2xl bg-white rounded-sm overflow-hidden min-w-[200px]">
                                <div className="bg-muted/30 p-2 border-b text-[9px] font-black uppercase tracking-widest text-primary">Inverter {record.inverterNumber} : {status || 'N/A'}</div>
                                <div className="p-3 space-y-2">
                                  <p className="text-[10px] font-medium leading-relaxed italic text-muted-foreground">"{check?.remarks || 'No notes logged.'}"</p>
                                  {check?.attachments && check.attachments.length > 0 && (
                                    <div className="flex items-center gap-1.5 pt-1">
                                      {check.attachments.map((a, i) => (
                                        <div key={i} className="h-8 w-12 border rounded-sm overflow-hidden bg-muted cursor-pointer" onClick={() => setViewUrl(a.url)}><img src={a.url} className="w-full h-full object-cover" alt="Proof" /></div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TooltipProvider>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <div className="p-3 border-t bg-muted/5 flex items-center justify-center gap-6 shrink-0 z-10">
           <div className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-600" /><span className="text-[9px] font-black uppercase text-foreground/70 tracking-widest">OK</span></div>
           <div className="flex items-center gap-1.5"><X className="h-3.5 w-3.5 text-red-600" /><span className="text-[9px] font-black uppercase text-foreground/70 tracking-widest">NOT OK</span></div>
           <div className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /><span className="text-[9px] font-black uppercase text-foreground/70 tracking-widest">PENDING</span></div>
        </div>
      </Card>

      <Dialog open={!!viewUrl} onOpenChange={(o) => !o && setViewUrl(null)}>
        <DialogContent className="max-w-[95vw] h-[90vh] p-0 border-none bg-black/95 flex items-center justify-center rounded-sm overflow-hidden">
          <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white z-50 h-10 w-10" onClick={() => setViewUrl(null)}><X className="h-6 w-6" /></Button>
          {viewUrl && <img src={viewUrl} className="max-w-full max-h-full object-contain" alt="evidence" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
