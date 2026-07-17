
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
  TrendingUp
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

type HTConductorChecklist = {
  id: string;
  siteId: string;
  siteName: string;
  projectCompany: string;
  poleConfiguration: string;
  userName: string;
  userId: string;
  status: string;
  createdAt: any;
  spans: { label: string; distance: number; remarks?: string }[];
  adminRemarks?: string;
  processedBy?: string;
  processedByName?: string;
  processedAt?: any;
};

export default function HTConductorAuditViewPage({ params }: { params: Promise<{ siteId: string, checklistId: string }> }) {
  const { siteId, checklistId } = React.use(params);
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const auditRef = useMemoFirebase(() => doc(firestore, 'ht_conductor_checklists', checklistId), [firestore, checklistId]);
  const { data: audit, isLoading: auditLoading } = useDoc<HTConductorChecklist>(auditRef);

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [approvingAction, setApprovingAction] = React.useState<'Approved' | 'Rejected' | null>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';
  const canApprove = isAdmin || isManager;

  const recordTotalLength = React.useMemo(() => {
    if (!audit?.spans) return 0;
    return audit.spans.reduce((sum, span) => sum + (Number(span.distance) || 0), 0);
  }, [audit]);

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

  if (auditLoading) return <div className="p-8 space-y-4 max-w-4xl mx-auto"><Skeleton className="h-10 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!audit) return <div className="p-12 text-center italic">Record not found.</div>;

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
                <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight truncate">HT Conductor Audit</h1>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">{audit.siteName} • {audit.poleConfiguration} Setup</p>
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Personnel</Label><p className="text-sm font-bold flex items-center gap-2"><User className="h-3.5 w-3.5 text-primary opacity-50" />{audit.userName}</p></div>
            <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Plant Config</Label><p className="text-sm font-bold uppercase">{audit.poleConfiguration}</p></div>
            <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Total Spans</Label><p className="text-xs font-bold leading-tight">{audit.spans?.length || 0} Points Logged</p></div>
            <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-primary tracking-widest">Total Length</Label><p className="text-sm font-black text-primary flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" />{recordTotalLength.toFixed(2)} Mtrs</p></div>
            <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Timestamp</Label><p className="text-xs font-mono font-bold text-muted-foreground">{audit.createdAt ? format(audit.createdAt.toDate(), 'dd MMM yy, HH:mm') : '—'}</p></div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="px-8 font-black uppercase text-[10px] tracking-widest">Span Description</TableHead>
                <TableHead className="text-right px-8 font-black uppercase text-[10px] tracking-widest">Verified Distance (Mtrs)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.spans?.map((span, idx) => (
                <TableRow key={idx} className="hover:bg-primary/[0.01]">
                  <TableCell className="px-8 py-5">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <div className="h-6 w-6 rounded-sm bg-muted flex items-center justify-center font-mono font-black text-[10px] text-muted-foreground">{idx + 1}</div>
                        <span className="font-bold text-sm text-foreground uppercase tracking-tight">{span.label}</span>
                      </div>
                      {span.remarks && (
                        <div className="flex items-start gap-2 ml-9">
                          <MessageCircle className="h-3 w-3 text-primary opacity-40 shrink-0 mt-0.5" />
                          <p className="text-[10px] font-medium italic text-muted-foreground leading-relaxed">"{span.remarks}"</p>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right px-8 font-mono font-black text-primary text-base">
                    {Number(span.distance).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

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
    </div>
  );
}
