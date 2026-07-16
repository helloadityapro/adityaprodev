
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
  ShieldCheck, 
  Clock, 
  User, 
  Zap, 
  Maximize2, 
  X, 
  ThumbsUp, 
  ThumbsDown, 
  Loader2, 
  MapPin,
  Building2
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

type Attachment = { url: string; contentType: string; name: string; };

type HTLineChecklist = {
  id: string;
  siteId: string;
  siteName: string;
  projectCompany: string;
  poleNumber: string;
  poleType: string;
  poleSize: string;
  studSize?: string;
  cutPointType: string;
  userName: string;
  userId: string;
  status: string;
  createdAt: any;
  checks: { label: string; remarks: string; status: string; quantity?: number; attachments?: Attachment[] }[];
  additionalRemarks?: string;
  generalPhotos?: Attachment[];
};

export default function HTLineAuditViewPage({ params }: { params: Promise<{ siteId: string, checklistId: string }> }) {
  const { siteId, checklistId } = React.use(params);
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const auditRef = useMemoFirebase(() => doc(firestore, 'ht_line_checklists', checklistId), [firestore, checklistId]);
  const { data: audit, isLoading: auditLoading } = useDoc<HTLineChecklist>(auditRef);

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [approvingAction, setApprovingAction] = React.useState<'Approved' | 'Rejected' | null>(null);
  const [viewUrl, setViewUrl] = React.useState<string | null>(null);

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
                <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight truncate">HT Line Pole Audit</h1>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">{audit.siteName} • Pole #{audit.poleNumber}</p>
              </div>
           </div>
           <Badge variant="outline" className={cn(
             "rounded-sm text-[10px] font-black uppercase px-3 h-8",
             audit.status === 'Approved' ? "bg-green-100 text-green-700 border-green-200" :
             audit.status === 'Rejected' ? "bg-red-100 text-red-700 border-red-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"
           )}>{audit.status}</Badge>
        </div>
      </div>

      <Card className="rounded-sm shadow-xl border-primary/10 overflow-hidden">
        <CardHeader className="bg-primary/5 border-b p-6 md:p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Personnel</Label><p className="text-sm font-bold flex items-center gap-2"><User className="h-3.5 w-3.5 text-primary opacity-50" />{audit.userName}</p></div>
            <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Pole Config</Label><p className="text-sm font-bold">{audit.poleType}</p></div>
            <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Pole Size</Label><p className="text-xs font-bold leading-tight">{audit.poleSize}</p></div>
            <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Timestamp</Label><p className="text-xs font-mono font-bold text-muted-foreground">{format(audit.createdAt.toDate(), 'dd MMM yy, HH:mm')}</p></div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y border-b">
            {audit.checks.map((check, idx) => (
              <div key={idx} className="p-6 md:p-8 space-y-4 hover:bg-primary/[0.01] transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-base font-black uppercase tracking-tight text-foreground block">{check.label}</span>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={cn(
                        "rounded-sm text-[9px] font-bold uppercase px-2 h-5",
                        check.status === 'Yes' ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                      )}>{check.status}</Badge>
                      {check.quantity > 0 && <Badge variant="secondary" className="h-5 rounded-sm text-[10px] font-black">Qty: {check.quantity}</Badge>}
                      {check.label.includes('Stud') && audit.studSize && check.status === 'Yes' && (
                        <Badge variant="outline" className="h-5 rounded-sm text-[10px] font-bold border-amber-200 text-amber-700 bg-amber-50">Size: {audit.studSize}</Badge>
                      )}
                    </div>
                  </div>
                </div>

                {check.remarks && <p className="p-3 bg-muted/20 border rounded-sm italic text-sm text-foreground/80 leading-relaxed">"{check.remarks}"</p>}

                {check.attachments && check.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {check.attachments.map((file, fIdx) => (
                      <div key={fIdx} className="relative aspect-video w-32 md:w-40 rounded-sm overflow-hidden border shadow-sm cursor-pointer group" onClick={() => setViewUrl(file.url)}>
                        <img src={file.url} className="w-full h-full object-cover" alt="Audit" />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Maximize2 className="h-5 w-5 text-white" /></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-6 md:p-8 space-y-6 bg-muted/5">
             <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4 block">Pole Evidence Photos</Label>
                <div className="flex flex-wrap gap-4">
                  {audit.generalPhotos?.map((file, fIdx) => (
                    <div key={fIdx} className="relative aspect-square w-32 md:w-48 rounded-sm overflow-hidden border-2 border-white shadow-xl cursor-pointer group" onClick={() => setViewUrl(file.url)}>
                      <img src={file.url} className="w-full h-full object-cover" alt="General" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Maximize2 className="h-6 w-6 text-white" /></div>
                    </div>
                  ))}
                </div>
             </div>
             {audit.additionalRemarks && (
               <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">General Remarks</Label>
                 <p className="text-sm italic leading-relaxed text-foreground/80 p-4 bg-background border rounded-sm">"{audit.additionalRemarks}"</p>
               </div>
             )}
          </div>
        </CardContent>
      </Card>

      {canApprove && audit.status === 'Pending' && (
        <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 bg-background/90 backdrop-blur border-t p-4 z-40 md:left-[16rem] animate-in slide-in-from-bottom-full duration-500 shadow-2xl">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
             <div className="hidden sm:block">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Audit Resolution Center</p>
                <p className="text-[11px] font-bold text-foreground/60">Choose a decision for this HT pole audit.</p>
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
            <DialogDescription className="text-xs font-medium">Archiving quality decision for Pole #{audit.poleNumber}.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-3 text-left">
            <Label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase px-1">Authority Remarks (Optional)</Label>
            <Textarea id="final-action-remarks-ht" placeholder="Enter feedback..." className="min-h-[120px] rounded-sm" />
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-3">
            <DialogClose asChild><Button variant="outline" className="w-full sm:flex-1 h-12 font-bold rounded-sm text-[10px] uppercase">Cancel</Button></DialogClose>
            <Button className={cn("w-full sm:flex-1 h-12 rounded-sm font-black uppercase text-[10px]", approvingAction === 'Approved' ? 'bg-green-600' : 'bg-red-600')} 
              onClick={() => handleProcessAudit((document.getElementById('final-action-remarks-ht') as HTMLTextAreaElement)?.value || "")} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : `Confirm ${approvingAction}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewUrl} onOpenChange={(o) => !o && setViewUrl(null)}>
        <DialogContent className="max-w-[95vw] h-[90vh] p-0 border-none bg-black/95 flex items-center justify-center rounded-sm overflow-hidden">
          <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white z-50 h-10 w-10" onClick={() => setViewUrl(null)}><X className="h-6 w-6" /></Button>
          {viewUrl && <img src={viewUrl} className="max-w-full max-h-full object-contain" alt="evidence" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
