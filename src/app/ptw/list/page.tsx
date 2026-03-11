"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CircleCheck, Clock, CircleX, Eye, FilePen, ArrowUpDown, ArrowUp, ArrowDown, History, User, ExternalLink, CalendarDays, Printer, FileText, MessageCircle, Paperclip, ImageIcon, Film, Layers, MapPin, Maximize2, X, ZoomIn, ZoomOut, RotateCcw, Search, FilterX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, limit, serverTimestamp, arrayUnion, getDocs, or, and, increment, getDoc } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem, 
  CarouselNext, 
  CarouselPrevious 
} from "@/components/ui/carousel";
import { isSuperAdmin } from "@/lib/auth-constants";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

type Attachment = { 
  url: string; 
  contentType: string; 
  name: string; 
  submissionIndex?: number;
  timestamp?: string;
};

type TimelineEntry = {
  status: string;
  timestamp: any;
  userId: string;
  userName: string;
  userRole?: string;
  remarks: string;
  action: string;
  submissionIndex?: number;
};

type Permit = {
  id: string;
  serialNumber?: string;
  siteName: string;
  ptwType: string;
  descriptionOfWork: string;
  status: 'Pending' | 'ManagerApproved' | 'Approved' | 'Rejected';
  siteEngineerId: string;
  siteEngineerName?: string;
  siteManagerId?: string;
  adminId?: string;
  requestDate: any;
  statusChangeDate?: any;
  attachments?: Attachment[];
  commentsAndRemarks?: string;
  timeline?: TimelineEntry[];
  latitude?: number;
  longitude?: number;
};

type PtwType = {
    id: string;
    name: string;
    allowedApproverIds?: string[];
};

type RewardSettings = {
  ptwNoCorrection?: number;
  ptwWithCorrection?: number;
};

type SortKey = 'serialNumber' | 'ptwType' | 'siteName' | 'requestDate' | 'status' | 'siteEngineerName';

function StatusBadge({ permit, className }: { permit: Permit, className?: string }) {
  const firestore = useFirestore();
  const managerRef = useMemoFirebase(() => (permit.status === 'Pending' && permit.siteManagerId) ? doc(firestore, 'users', permit.siteManagerId) : null, [firestore, permit.siteManagerId, permit.status]);
  const { data: managerProfile } = useDoc(managerRef);

  const statusConfig = {
    Pending: { 
      label: managerProfile ? `With ${managerProfile.username}` : 'Pending Manager', 
      icon: Clock, 
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200' 
    },
    ManagerApproved: { 
      label: 'With Admin', 
      icon: Clock, 
      className: 'bg-blue-100 text-blue-800 border-blue-200' 
    },
    Approved: { label: 'Approved', icon: CircleCheck, className: 'bg-green-100 text-green-800 border-green-200' },
    Rejected: { label: 'Rejected', icon: CircleX, className: 'bg-red-100 text-red-800 border-red-200' },
  };
  const config = statusConfig[permit.status] || statusConfig.Pending;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={cn("flex items-center gap-1.5 text-[10px] font-black uppercase whitespace-nowrap border rounded-sm h-5 px-2", config.className, className)}>
      <Icon className="h-2.5 w-2.5" /> {config.label}
    </Badge>
  );
}

function WhatsAppUpdateEngineer({ permit }: { permit: Permit }) {
    const firestore = useFirestore();
    const { data: engineerProfile } = useDoc(useMemoFirebase(() => doc(firestore, 'users', permit.siteEngineerId), [firestore, permit.siteEngineerId]));
    
    const triggerWhatsApp = () => {
        if (!engineerProfile?.mobile) return;
        const cleanMobile = engineerProfile.mobile.replace(/\D/g, '');
        const formattedMobile = cleanMobile.length === 10 ? `91${cleanMobile}` : (cleanMobile.startsWith('91') ? cleanMobile : `91${cleanMobile}`);
        const lastEntry = [...(permit.timeline || [])].sort((a, b) => (b.timestamp?.toDate?.() || 0) - (a.timestamp?.toDate?.() || 0))[0];
        const message = `Aditya Pro Update:\nPermit: ${permit.serialNumber}\nSite: ${permit.siteName}\nStatus: ${permit.status}\nRemarks: ${lastEntry?.remarks || "None"}\nLink: ${window.location.origin}/ptw/list?view=${permit.id}`;
        window.open(`https://wa.me/${formattedMobile}?text=${encodeURIComponent(message)}`, '_blank');
    };

    if (!engineerProfile?.mobile) return null;
    return <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 rounded-sm" onClick={(e) => { e.stopPropagation(); triggerWhatsApp(); }}><MessageCircle className="h-4 w-4" /></Button>;
}

const formatTimestamp = (ts: any) => {
  if (!ts) return 'N/A';
  const date = ts.toDate ? ts.toDate() : (typeof ts === 'string' ? new Date(ts) : ts);
  return format(date, 'dd MMM yyyy HH:mm');
};

export default function PtwListPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [actionState, setActionState] = React.useState<{ permit: Permit, status: 'Approved' | 'Rejected' | 'ManagerApproved' } | null>(null);
  const [detailsPermit, setDetailsPermit] = React.useState<Permit | null>(null);
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'requestDate', direction: 'desc' });

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === "Admin";
  const userRole = isAdmin ? "Admin" : (userProfile?.role || "Site Engineer");

  const permitsQuery = useMemoFirebase(() => {
    if (!userRole || !user || isProfileLoading) return null;
    const colRef = collection(firestore, 'permits_to_work');
    if (isAdmin) return colRef;
    if (userRole === 'Site Manager') {
      return query(colRef, or(where('siteManagerId', '==', user.uid), where('siteEngineerId', '==', user.uid)));
    }
    return query(colRef, where('siteEngineerId', '==', user.uid));
  }, [firestore, userRole, user, isProfileLoading, isAdmin]);

  const { data: permits, isLoading } = useCollection<Permit>(permitsQuery);
  const { data: rewardSettings } = useDoc<RewardSettings>(useMemoFirebase(() => doc(firestore, 'system_settings', 'rewards'), [firestore]));

  React.useEffect(() => {
    const viewId = searchParams.get('view');
    if (viewId && permits && permits.length > 0) {
      const permit = permits.find(p => p.id === viewId);
      if (permit) setDetailsPermit(permit);
    }
  }, [searchParams, permits]);

  const handleAction = async (permit: Permit, targetStatus: Permit['status'], remarks: string) => {
    if (!user || !userProfile) return;
    const permitRef = doc(firestore, "permits_to_work", permit.id);
    const currentSubmission = Math.max(1, ...(permit.attachments?.map(a => a.submissionIndex || 0) || []));

    const timelineEntry: TimelineEntry = {
      status: targetStatus,
      timestamp: new Date(),
      userId: user.uid,
      userName: userProfile.username || user.email || 'System',
      userRole: userProfile.role || userRole,
      remarks: remarks,
      action: targetStatus === 'Rejected' ? `Rejected` : (targetStatus === 'ManagerApproved' ? 'Approved by Manager' : 'Final Approval'),
      submissionIndex: currentSubmission
    };

    updateDocumentNonBlocking(permitRef, {
      status: targetStatus,
      statusChangeDate: serverTimestamp(),
      timeline: arrayUnion({ ...timelineEntry, timestamp: new Date() }),
      ...(userProfile.role === 'Site Manager' && permit.status === 'Pending' ? { siteManagerId: user.uid } : {}),
      ...(isAdmin ? { adminId: user.uid } : {})
    });

    if (targetStatus === 'Approved') {
        const engineerDoc = await getDoc(doc(firestore, 'users', permit.siteEngineerId));
        if (engineerDoc.exists()) {
            const multiplier = engineerDoc.data()?.pointsMultiplier || 1;
            const hasRejection = (permit.timeline || []).some(t => t.status === 'Rejected');
            const basePoints = hasRejection ? (rewardSettings?.ptwWithCorrection ?? 0.5) : (rewardSettings?.ptwNoCorrection ?? 1.0);
            updateDocumentNonBlocking(doc(firestore, 'users', permit.siteEngineerId), { totalPoints: increment(basePoints * multiplier) });
            if (permit.siteManagerId) {
                updateDocumentNonBlocking(doc(firestore, 'users', permit.siteManagerId), { totalPoints: increment(basePoints * 0.5) });
            }
        }
    }

    addDocumentNonBlocking(collection(firestore, 'notifications'), {
      userId: permit.siteEngineerId,
      title: "Permit Update",
      description: `Permit ${permit.serialNumber} is now ${targetStatus}.`,
      link: `/ptw/list?view=${permit.id}`,
      read: false,
      createdAt: serverTimestamp(),
    });

    toast({ title: "Updated", description: `Permit set to ${targetStatus}.` });
  };

  const filteredPermits = React.useMemo(() => {
    if (!permits) return [];
    const hiddenIds = userProfile?.hiddenPermitIds || [];
    return permits.filter(p => !hiddenIds.includes(p.id))
      .filter(p => {
        const matchesStatus = statusFilter === 'all' ? true : p.status === statusFilter;
        const matchesSearch = p.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             p.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             p.siteEngineerName?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesStatus && matchesSearch;
      })
      .sort((a, b) => {
        const { key, direction } = sortConfig;
        let valA: any = a[key] || '';
        let valB: any = b[key] || '';
        if (key === 'requestDate') {
          valA = a.requestDate?.toDate?.().getTime() || 0;
          valB = b.requestDate?.toDate?.().getTime() || 0;
        }
        return direction === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
      });
  }, [permits, statusFilter, searchTerm, sortConfig, userProfile]);

  const stats = React.useMemo(() => {
    if (!permits) return { total: 0, pending: 0, approved: 0 };
    return {
      total: permits.length,
      pending: permits.filter(p => p.status === 'Pending' || p.status === 'ManagerApproved').length,
      approved: permits.filter(p => p.status === 'Approved').length,
    };
  }, [permits]);

  if (isLoading || isProfileLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-foreground uppercase">PtW Audit</h1>
        <p className="text-muted-foreground text-sm font-medium">Compliance monitoring and permit authorization hub.</p>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Card className="bg-primary/5 border-primary/10 rounded-sm">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 font-black text-2xl">{stats.total}</CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/10 rounded-sm">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-[10px] font-black uppercase text-amber-600 tracking-widest">Pending</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 font-black text-2xl text-amber-700">{stats.pending}</CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/10 rounded-sm">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-[10px] font-black uppercase text-green-600 tracking-widest">Approved</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 font-black text-2xl text-green-700">{stats.approved}</CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 bg-card p-4 border rounded-sm shadow-sm">
        <div className="relative w-full">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by serial or site..." className="pl-9 h-10 rounded-sm bg-muted/20 border-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-print">
          {['all', 'Pending', 'ManagerApproved', 'Approved', 'Rejected'].map(s => (
            <Badge 
              key={s} 
              variant={statusFilter === s ? 'default' : 'outline'} 
              className="cursor-pointer font-black text-[9px] uppercase h-7 px-3 rounded-sm whitespace-nowrap"
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'All Permits' : s === 'ManagerApproved' ? 'Pending Admin' : s}
            </Badge>
          ))}
        </div>
      </div>

      <Card className="rounded-sm overflow-hidden border-primary/10">
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <div className="min-w-[800px]">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Serial & Site</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Request Date</TableHead>
                    <TableHead className="text-right px-6">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPermits.map(permit => {
                    const canManagerAct = userRole === 'Site Manager' && permit.status === 'Pending' && permit.siteManagerId === user?.uid;
                    const canAdminAct = isAdmin && permit.status === 'ManagerApproved';
                    
                    return (
                      <TableRow key={permit.id} className="hover:bg-muted/5 cursor-pointer" onClick={() => setDetailsPermit(permit)}>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono text-[10px] font-bold text-primary">{permit.serialNumber || permit.id.slice(0, 8)}</span>
                            <span className="font-bold text-sm truncate max-w-[180px]">{permit.siteName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-semibold">{permit.ptwType}</TableCell>
                        <TableCell><StatusBadge permit={permit} /></TableCell>
                        <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">{formatTimestamp(permit.requestDate)}</TableCell>
                        <TableCell className="text-right px-6">
                          <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                            {(canManagerAct || canAdminAct) && (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-green-600 hover:bg-green-50 rounded-sm" 
                                  onClick={() => setActionState({ permit, status: isAdmin ? 'Approved' : 'ManagerApproved' })}
                                  title="Approve"
                                >
                                  <CircleCheck className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-red-600 hover:bg-red-50 rounded-sm" 
                                  onClick={() => setActionState({ permit, status: 'Rejected' })}
                                  title="Reject"
                                >
                                  <CircleX className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => setDetailsPermit(permit)}><Eye className="h-4 w-4" /></Button>
                            {(isAdmin || userProfile?.role === 'Site Manager') && <WhatsAppUpdateEngineer permit={permit} />}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Decision Dialog */}
      <Dialog open={!!actionState} onOpenChange={() => setActionState(null)}>
        <DialogContent className="max-w-md w-[95vw] rounded-sm p-6">
          <DialogHeader className="text-left space-y-2">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Process Decision</DialogTitle>
            <DialogDescription className="text-xs font-medium">Process permit {actionState?.permit?.serialNumber}</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Action Remarks</Label>
            <Textarea id="action-remarks" placeholder="Provide feedback or justification..." className="min-h-[120px] rounded-sm" />
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-3">
            <DialogClose asChild><Button variant="outline" className="w-full sm:flex-1 h-12 font-bold rounded-sm uppercase text-xs">Cancel</Button></DialogClose>
            <Button 
              className={cn("w-full sm:flex-1 h-12 font-black rounded-sm uppercase text-xs", actionState?.status === 'Rejected' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700')}
              onClick={() => {
                const remarks = (document.getElementById('action-remarks') as HTMLTextAreaElement)?.value || "";
                if (remarks.trim()) {
                  handleAction(actionState!.permit, actionState!.status as any, remarks);
                  setActionState(null);
                } else {
                  toast({ variant: 'destructive', title: 'Remarks Required' });
                }
              }}
            >
              Confirm {actionState?.status === 'Rejected' ? 'Rejection' : 'Approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detailed View Overlay */}
      <Dialog open={!!detailsPermit} onOpenChange={(o) => !o && setDetailsPermit(null)}>
        <DialogContent className="max-w-4xl w-[98vw] h-[95vh] p-0 border-none rounded-sm overflow-hidden flex flex-col shadow-2xl bg-background">
          <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-sm"><FileText className="h-5 w-5 text-primary" /></div>
              <div>
                <DialogTitle className="text-lg font-black uppercase tracking-tight">Permit Audit Log</DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase">{detailsPermit?.serialNumber}</DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 no-print">
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-sm border-primary/20 text-primary" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button>
              <DialogClose asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-sm"><X className="h-5 w-5" /></Button></DialogClose>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 bg-background">
            {detailsPermit && (
              <div id="printable-permit-area" className="p-6 md:p-10 space-y-12 pb-20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-8">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Project Site</Label><p className="font-black text-lg leading-tight">{detailsPermit.siteName}</p></div>
                      <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Permit Type</Label><p className="font-bold text-lg leading-tight">{detailsPermit.ptwType}</p></div>
                    </div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Work Description</Label><div className="p-4 bg-muted/20 border rounded-sm text-sm leading-relaxed whitespace-pre-wrap font-medium">"{detailsPermit.descriptionOfWork}"</div></div>
                  </div>
                  <div className="space-y-8">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Status</Label><div><StatusBadge permit={detailsPermit} /></div></div>
                      <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Submission</Label><p className="text-xs font-mono font-bold text-muted-foreground">{formatTimestamp(detailsPermit.requestDate)}</p></div>
                    </div>
                    <div className="space-y-3"><Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> GPS Stamped Location</Label>
                      {detailsPermit.latitude ? (
                        <div className="p-4 bg-primary/5 border border-primary/10 rounded-sm flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-primary">{detailsPermit.latitude.toFixed(6)}, {detailsPermit.longitude?.toFixed(6)}</span>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm no-print" asChild><a href={`https://www.google.com/maps/search/?api=1&query=${detailsPermit.latitude},${detailsPermit.longitude}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
                        </div>
                      ) : <p className="text-xs italic text-muted-foreground">Location not available</p>}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-6">
                  <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><History className="h-4 w-4 text-primary" /> Lifecycle History</h3>
                  <div className="relative border-l-2 border-muted ml-3 pl-6 space-y-8">
                    {[...(detailsPermit.timeline || [])].sort((a, b) => (b.timestamp?.toDate?.() || 0) - (a.timestamp?.toDate?.() || 0)).map((entry, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs font-black uppercase tracking-tight text-primary">{entry.action} — {entry.userName}</span>
                            <span className="text-[9px] font-mono font-bold text-muted-foreground uppercase">{formatTimestamp(entry.timestamp)}</span>
                          </div>
                          <p className="text-sm italic font-medium leading-relaxed opacity-80">"{entry.remarks}"</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>

          {detailsPermit && detailsPermit.status !== 'Approved' && detailsPermit.status !== 'Rejected' && (
            <div className="p-4 border-t bg-muted/5 grid grid-cols-2 gap-3 no-print">
              {((userRole === 'Site Manager' && detailsPermit.status === 'Pending' && detailsPermit.siteManagerId === user?.uid) || isAdmin) && (
                <>
                  <Button className="h-12 rounded-sm font-black uppercase text-xs bg-green-600 hover:bg-green-700 shadow-lg" onClick={() => { setDetailsPermit(null); setActionState({ permit: detailsPermit, status: isAdmin && detailsPermit.status === 'ManagerApproved' ? 'Approved' : 'ManagerApproved' }); }}>
                    Authorize
                  </Button>
                  <Button variant="destructive" className="h-12 rounded-sm font-black uppercase text-xs shadow-lg" onClick={() => { setDetailsPermit(null); setActionState({ permit: detailsPermit, status: 'Rejected' }); }}>
                    Reject
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
