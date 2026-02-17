
"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CircleCheck, Clock, CircleX, Eye, FilePen, ArrowUpDown, ArrowUp, ArrowDown, History, User, ExternalLink, CalendarDays, Printer, FileText, MessageCircle, Paperclip, ImageIcon, Film, Layers, MapPin, Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, serverTimestamp, arrayUnion } from "firebase/firestore";
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

function StatusBadge({ permit, className }: { permit: Permit, className?: string }) {
  const firestore = useFirestore();
  const managerRef = useMemoFirebase(() => (permit.status === 'Pending' && permit.siteManagerId) ? doc(firestore, 'users', permit.siteManagerId) : null, [firestore, permit.siteManagerId, permit.status]);
  const { data: managerProfile } = useDoc(managerRef);

  const statusConfig = {
    Pending: { 
      label: managerProfile ? `Pending with ${managerProfile.username}` : 'Pending Manager', 
      icon: Clock, 
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200' 
    },
    ManagerApproved: { label: 'Pending Admin', icon: Clock, className: 'bg-blue-100 text-blue-800 border-blue-200' },
    Approved: { label: 'Approved', icon: CircleCheck, className: 'bg-green-100 text-green-800 border-green-200' },
    Rejected: { label: 'Rejected', icon: CircleX, className: 'bg-red-100 text-red-800 border-red-200' },
  };
  const config = statusConfig[permit.status] || statusConfig.Pending;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={cn("flex items-center gap-1.5 text-xs font-semibold w-fit border rounded-sm", config.className, className)}>
      <Icon className="h-3 w-3" /> {config.label}
    </Badge>
  );
}

const formatTimestamp = (ts: any) => {
  if (!ts) return 'N/A';
  const date = ts.toDate ? ts.toDate() : (typeof ts === 'string' ? new Date(ts) : ts);
  return format(date, 'dd/MM/yyyy HH:mm');
};

function WhatsAppReminder({ userId, permit }: { userId: string | undefined, permit: Permit }) {
    const firestore = useFirestore();
    const { data: targetUser } = useDoc(useMemoFirebase(() => userId ? doc(firestore, 'users', userId) : null, [firestore, userId]));
    
    const triggerWhatsApp = () => {
        if (!targetUser?.mobile) return;
        const cleanMobile = targetUser.mobile.replace(/\D/g, '');
        const formattedMobile = cleanMobile.length === 10 ? `91${cleanMobile}` : (cleanMobile.startsWith('91') ? cleanMobile : `91${cleanMobile}`);
        const message = `Reminder: PtW request ${permit.serialNumber} for "${permit.siteName}" is pending your review.\nStatus: ${permit.status}\nLink: ${window.location.origin}/ptw/list?view=${permit.id}`;
        const url = `https://wa.me/${formattedMobile}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    if (!targetUser?.mobile) return null;

    return (
        <Button 
            variant="ghost" 
            size="icon" 
            className="text-green-600 hover:text-green-700 hover:bg-green-50 rounded-sm" 
            title="Send WhatsApp Reminder"
            onClick={triggerWhatsApp}
        >
            <MessageCircle className="h-4 w-4" />
        </Button>
    );
}

type SortKey = 'serialNumber' | 'ptwType' | 'siteName' | 'requestDate' | 'status';

export default function PtwListPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = React.useState('all');
  const [actionState, setActionState] = React.useState<{ permit: Permit, status: 'Approved' | 'Rejected' | 'ManagerApproved' } | null>(null);
  const [detailsPermit, setDetailsPermit] = React.useState<Permit | null>(null);
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'requestDate', direction: 'desc' });
  const [viewerImages, setViewerImages] = React.useState<{ images: Attachment[], initialIndex: number } | null>(null);

  const { data: userProfile } = useDoc(useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]));
  const isAdmin = userProfile?.role === "Admin" || user?.email === 'abhijeet.agepl@gmail.com' || user?.email === 'abhijeetsb22@gmail.com' || user?.email === 'khalil@adityagreenenergy.com' || user?.email === 'prafulrana143@gmail.com';
  const userRole = isAdmin ? "Admin" : userProfile?.role;

  const permitsQuery = useMemoFirebase(() => {
    if (!userRole || !user) return null;
    return collection(firestore, 'permits_to_work');
  }, [firestore, userRole, user]);

  const { data: allPermits, isLoading } = useCollection<Permit>(permitsQuery);
  const { data: ptwTypes } = useCollection<PtwType>(useMemoFirebase(() => collection(firestore, 'ptw_types'), [firestore]));

  const permits = React.useMemo(() => {
    if (!allPermits || !userRole || !user) return [];
    
    // Filter hidden permits for the current user
    const hiddenIds = userProfile?.hiddenPermitIds || [];
    const visiblePermits = allPermits.filter(p => !hiddenIds.includes(p.id));

    if (userRole === 'Admin') return visiblePermits;
    if (userRole === 'Site Manager') {
      return visiblePermits.filter(p => p.siteManagerId === user.uid || p.siteEngineerId === user.uid);
    }
    return visiblePermits.filter(p => p.siteEngineerId === user.uid);
  }, [allPermits, userRole, user, userProfile]);

  React.useEffect(() => {
    const viewId = searchParams.get('view');
    if (viewId && permits.length > 0) {
      const permit = permits.find(p => p.id === viewId);
      if (permit) {
        setDetailsPermit(permit);
      }
    }
  }, [searchParams, permits]);

  const isAuthorizedForType = (typeName: string) => {
    if (!user) return false;
    if (isAdmin) return true;
    const typeDoc = ptwTypes?.find(t => t.name === typeName);
    if (!typeDoc || !typeDoc.allowedApproverIds || typeDoc.allowedApproverIds.length === 0) {
      return true;
    }
    return typeDoc.allowedApproverIds.includes(user.uid);
  };

  const handleAction = (permit: Permit, targetStatus: Permit['status'], remarks: string) => {
    if (!user || !userProfile) return;
    const permitRef = doc(firestore, "permits_to_work", permit.id);
    const currentSubmission = Math.max(1, ...(permit.attachments?.map(a => a.submissionIndex || 0) || []));

    const timelineEntry: TimelineEntry = {
      status: targetStatus,
      timestamp: new Date(),
      userId: user.uid,
      userName: userProfile.username || user.email || 'System',
      remarks: remarks,
      action: targetStatus === 'Rejected' ? `Rejected by ${userRole}` : (targetStatus === 'ManagerApproved' ? 'Approved by Manager' : 'Final Approval by Admin'),
      submissionIndex: currentSubmission
    };

    const updateData: any = {
      status: targetStatus,
      statusChangeDate: serverTimestamp(),
      timeline: arrayUnion({ ...timelineEntry, timestamp: new Date() })
    };

    if (userRole === 'Site Manager') {
      updateData.siteManagerId = user.uid;
    } else if (userRole === 'Admin') {
      updateData.adminId = user.uid;
    }

    updateDocumentNonBlocking(permitRef, updateData);

    addDocumentNonBlocking(collection(firestore, 'notifications'), {
      userId: permit.siteEngineerId,
      title: "Permit Status Update",
      description: `Your permit ${permit.serialNumber} for "${permit.siteName}" has been updated to ${targetStatus}.`,
      link: `/ptw/list?view=${permit.id}`,
      read: false,
      createdAt: serverTimestamp(),
    });

    toast({ title: "Status Updated", description: `Permit marked as ${targetStatus}.` });
  };

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const filteredPermits = React.useMemo(() => {
    if (!permits) return [];
    return permits.filter(p => {
      const matchStatus = statusFilter === 'all' ? true : p.status === statusFilter;
      return matchStatus;
    }).sort((a, b) => {
      const { key, direction } = sortConfig;
      let valA = a[key] || '';
      let valB = b[key] || '';
      if (key === 'requestDate') {
        valA = a.requestDate?.toDate?.()?.getTime() || 0;
        valB = b.requestDate?.toDate?.()?.getTime() || 0;
      }
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [permits, statusFilter, sortConfig]);

  const stats = React.useMemo(() => {
    if (!permits) return { total: 0, pending: 0, approved: 0, rejected: 0 };
    return {
      total: permits.length,
      pending: permits.filter(p => p.status === 'Pending' || p.status === 'ManagerApproved').length,
      approved: permits.filter(p => p.status === 'Approved').length,
      rejected: permits.filter(p => p.status === 'Rejected').length,
    };
  }, [permits]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const groupedAttachments = React.useMemo(() => {
    if (!detailsPermit?.attachments) return {};
    return detailsPermit.attachments.reduce((acc, attachment) => {
      const index = attachment.submissionIndex || 1;
      if (!acc[index]) acc[index] = [];
      acc[index].push(attachment);
      return acc;
    }, {} as Record<number, Attachment[]>);
  }, [detailsPermit]);

  if (isLoading || !userRole) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">PtW Dashboard</h1>
        <p className="text-muted-foreground">Monitor permit status and manage compliance.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-primary/5 border-primary/20 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-primary">Total Permits</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card className="bg-yellow-500/5 border-yellow-500/20 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-yellow-600">Pending Actions</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.pending}</div></CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/20 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-green-600">Fully Approved</CardTitle>
            <CircleCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.approved}</div></CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-destructive">Rejected</CardTitle>
            <CircleX className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.rejected}</div></CardContent>
        </Card>
      </div>

      <Card className="rounded-sm">
        <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
                <CardTitle className="text-sm font-medium">Filter by Status</CardTitle>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px] rounded-sm"><SelectValue placeholder="All Status" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Pending">Pending Manager</SelectItem>
                    <SelectItem value="ManagerApproved">Pending Admin</SelectItem>
                    <SelectItem value="Approved">Fully Approved</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
            </Select>
        </CardHeader>
      </Card>

      <Card className="overflow-hidden rounded-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead onClick={() => handleSort('serialNumber')} className="cursor-pointer">Serial No <SortIcon column="serialNumber" /></TableHead>
                <TableHead onClick={() => handleSort('ptwType')} className="cursor-pointer">PTW Type <SortIcon column="ptwType" /></TableHead>
                <TableHead onClick={() => handleSort('siteName')} className="cursor-pointer">Site <SortIcon column="siteName" /></TableHead>
                <TableHead onClick={() => handleSort('status')} className="cursor-pointer">Status <SortIcon column="status" /></TableHead>
                <TableHead onClick={() => handleSort('requestDate')} className="cursor-pointer">Date <SortIcon column="requestDate" /></TableHead>
                <TableHead className="text-right px-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPermits.map(permit => {
                const isAuthorized = isAuthorizedForType(permit.ptwType);
                return (
                  <TableRow key={permit.id}>
                    <TableCell className="font-mono text-xs">{permit.serialNumber || permit.id.slice(0, 8)}</TableCell>
                    <TableCell className="font-medium">{permit.ptwType}</TableCell>
                    <TableCell>{permit.siteName}</TableCell>
                    <TableCell><StatusBadge permit={permit} /></TableCell>
                    <TableCell>{formatTimestamp(permit.requestDate)}</TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="rounded-sm" title="View Details" onClick={() => setDetailsPermit(permit)}><Eye className="h-4 w-4" /></Button>

                        {userRole === 'Site Engineer' && (permit.status === 'Pending' || permit.status === 'ManagerApproved') && (
                          <WhatsAppReminder userId={permit.status === 'Pending' ? permit.siteManagerId : undefined} permit={permit} />
                        )}

                        {userRole === 'Site Manager' && permit.status === 'Pending' && isAuthorized && permit.siteManagerId === user?.uid && (
                          <>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8 rounded-sm" onClick={() => setActionState({ permit, status: 'ManagerApproved' })}>Approve</Button>
                            <Button size="sm" variant="destructive" className="h-8 rounded-sm" onClick={() => setActionState({ permit, status: 'Rejected' })}>Reject</Button>
                          </>
                        )}

                        {userRole === 'Admin' && (permit.status === 'ManagerApproved' || (permit.status === 'Pending' && !permit.siteManagerId)) && isAuthorized && (
                          <>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8 rounded-sm" onClick={() => setActionState({ permit, status: 'Approved' })}>Approve</Button>
                            <Button size="sm" variant="destructive" className="h-8 rounded-sm" onClick={() => setActionState({ permit, status: 'Rejected' })}>Reject</Button>
                          </>
                        )}

                        {userRole === 'Site Engineer' && permit.status === 'Rejected' && (
                          <Button size="sm" variant="outline" className="h-8 rounded-sm" onClick={() => router.push(`/ptw/raise?correct=${permit.id}`)}>
                            <FilePen className="h-3 w-3 mr-1.5" /> Resubmit
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!actionState} onOpenChange={() => setActionState(null)}>
        <DialogContent className="rounded-sm">
          <DialogHeader>
            <DialogTitle>{actionState?.status === 'Rejected' ? 'Reject' : 'Approve'} Permit Request</DialogTitle>
            <DialogDescription className="sr-only">Decision processing for permit {actionState?.permit?.serialNumber}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="action-remarks">Remarks/Comments</Label>
            <Textarea id="action-remarks" placeholder="Explain your decision..." className="min-h-[100px] rounded-sm" />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" className="rounded-sm">Cancel</Button></DialogClose>
            <Button className="rounded-sm" onClick={() => {
              const remarks = (document.getElementById('action-remarks') as HTMLTextAreaElement)?.value || "";
              if (remarks.trim()) {
                handleAction(actionState!.permit, actionState!.status, remarks);
                setActionState(null);
              } else {
                toast({ variant: 'destructive', title: 'Remarks Required', description: 'Please enter a comment.' });
              }
            }}>{actionState?.status === 'Rejected' ? 'Confirm Rejection' : 'Confirm Approval'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsPermit} onOpenChange={() => setDetailsPermit(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-none rounded-sm">
          <DialogHeader className="sr-only">
            <DialogTitle>Permit to Work Details: {detailsPermit?.serialNumber}</DialogTitle>
            <DialogDescription>Full overview of site, scope, location and submission history for permit {detailsPermit?.serialNumber}.</DialogDescription>
          </DialogHeader>
          
          <div id="printable-permit-area" className="bg-background">
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-6 py-4 flex items-center justify-between no-print">
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight">Permit to Work Details</span>
                <span className="text-xs font-mono text-primary font-semibold">{detailsPermit?.serialNumber}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs font-bold rounded-sm" onClick={handlePrint}><Printer className="h-3.5 w-3.5 mr-1.5" /> Print</Button>
                <DialogClose asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm"><CircleX className="h-4 w-4" /></Button></DialogClose>
              </div>
            </div>

            {detailsPermit && (
              <div className="p-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="md:col-span-3 space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                      <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Site Name</Label><p className="font-semibold text-sm">{detailsPermit.siteName}</p></div>
                      <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Permit Type</Label><p className="font-semibold text-sm">{detailsPermit.ptwType}</p></div>
                      <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Submission Date</Label><p className="text-sm font-medium">{formatTimestamp(detailsPermit.requestDate)}</p></div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Description of Work</Label>
                      <div className="p-4 bg-muted/20 rounded-sm border text-sm leading-relaxed whitespace-pre-wrap">{detailsPermit.descriptionOfWork}</div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Status</Label><div><StatusBadge permit={detailsPermit} className="text-[10px] px-2" /></div></div>
                    
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Submission Location</Label>
                      <div className="p-3 bg-primary/5 rounded-sm border border-primary/20 flex flex-col gap-2">
                        {detailsPermit.latitude && detailsPermit.longitude ? (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-mono font-medium">{detailsPermit.latitude.toFixed(5)}, {detailsPermit.longitude.toFixed(5)}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-primary no-print rounded-sm" asChild>
                                <a href={`https://www.google.com/maps/search/?api=1&query=${detailsPermit.latitude},${detailsPermit.longitude}`} target="_blank" rel="noopener noreferrer">
                                  <MapPin className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                            </div>
                            <Button variant="outline" size="sm" className="w-full h-7 text-[10px] font-bold rounded-sm no-print" asChild>
                              <a href={`https://www.google.com/maps/search/?api=1&query=${detailsPermit.latitude},${detailsPermit.longitude}`} target="_blank" rel="noopener noreferrer">Open in Google Maps</a>
                            </Button>
                          </>
                        ) : (
                          <p className="text-[10px] text-muted-foreground italic">No location recorded</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-6">
                  <div className="flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /><h3 className="font-bold text-sm uppercase tracking-widest">Submission Documentation History</h3></div>
                  
                  {Object.keys(groupedAttachments).length > 0 ? (
                    <div className="space-y-8">
                      {Object.entries(groupedAttachments).sort(([a], [b]) => Number(b) - Number(a)).map(([index, files]) => {
                        const images = files.filter(f => f.contentType.startsWith('image/'));
                        const videos = files.filter(f => f.contentType.startsWith('video/'));
                        const others = files.filter(f => !f.contentType.startsWith('image/') && !f.contentType.startsWith('video/'));

                        return (
                          <div key={index} className="p-4 rounded-sm border bg-muted/5 space-y-4">
                            <div className="flex items-center justify-between">
                              <Badge variant="secondary" className="px-2 py-0.5 text-[10px] font-bold rounded-sm">Submission {index}</Badge>
                              <span className="text-[10px] text-muted-foreground italic">{index === "1" ? "Initial submission" : "Correction/Resubmission"}</span>
                            </div>

                            {images.length > 0 && (
                              <div className="space-y-3">
                                <Label className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 px-1">
                                  <ImageIcon className="h-3.5 w-3.5" /> Photo Gallery
                                </Label>
                                <Carousel className="w-full" opts={{ align: "start" }}>
                                  <CarouselContent className="-ml-2">
                                    {images.map((img, idx) => (
                                      <CarouselItem key={idx} className="pl-2 basis-1/2 md:basis-1/3 lg:basis-1/4">
                                        <Card 
                                          className="overflow-hidden border-none group rounded-sm shadow-sm hover:shadow-md transition-all cursor-pointer"
                                          onClick={() => setViewerImages({ images, initialIndex: idx })}
                                        >
                                          <CardContent className="p-0 aspect-square relative flex items-center justify-center bg-muted/30">
                                            <img 
                                              src={img.url} 
                                              alt={img.name} 
                                              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300" 
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                              <Maximize2 className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                          </CardContent>
                                        </Card>
                                      </CarouselItem>
                                    ))}
                                  </CarouselContent>
                                  {images.length > 2 && (
                                    <>
                                      <CarouselPrevious className="h-7 w-7 rounded-full -left-3 border-muted shadow-lg bg-background/80 backdrop-blur" />
                                      <CarouselNext className="h-7 w-7 rounded-full -right-3 border-muted shadow-lg bg-background/80 backdrop-blur" />
                                    </>
                                  )}
                                </Carousel>
                              </div>
                            )}

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                              {videos.map((vid, idx) => (
                                <div key={idx} className="space-y-2">
                                  <Label className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1"><Film className="h-3 w-3" /> Video Preview</Label>
                                  <Card className="overflow-hidden group rounded-sm">
                                    <div className="aspect-video bg-black relative flex items-center justify-center">
                                      <video src={vid.url} className="w-full h-full object-contain" />
                                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="secondary" size="sm" className="h-7 text-[10px] font-bold rounded-sm" asChild>
                                          <a href={vid.url} target="_blank" rel="noopener noreferrer">View Full</a>
                                        </Button>
                                      </div>
                                    </div>
                                    <div className="p-1.5 border-t bg-background text-[10px] truncate font-medium">{vid.name}</div>
                                  </Card>
                                </div>
                              ))}

                              {others.map((file, idx) => (
                                <div key={idx} className="space-y-2">
                                  <Label className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1"><Paperclip className="h-3 w-3" /> Document</Label>
                                  <Card className="p-2 flex items-center gap-2 border-dashed rounded-sm">
                                    <FileText className="h-4 w-4 text-primary" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[10px] font-bold truncate">{file.name}</p>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm" asChild>
                                      <a href={file.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" /></a>
                                    </Button>
                                  </Card>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center p-8 bg-muted/10 rounded-sm border border-dashed text-xs text-muted-foreground">No attachments provided.</div>
                  )}
                </div>

                <Separator />

                <div className="space-y-6">
                  <div className="flex items-center gap-2"><History className="h-4 w-4 text-primary" /><h3 className="font-bold text-sm uppercase tracking-widest">Activity Log</h3></div>
                  <div className="space-y-0 relative border-l-2 border-muted ml-3 pl-6">
                    {[...(detailsPermit.timeline || [])].sort((a, b) => {
                      const dateA = a.timestamp?.toDate?.().getTime() || 0;
                      const dateB = b.timestamp?.toDate?.().getTime() || 0;
                      return dateB - dateA;
                    }).map((entry, idx) => (
                      <div key={idx} className="relative pb-6">
                        <div className="absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-primary">{entry.action}</span>
                              {entry.submissionIndex && (
                                <Badge variant="outline" className="text-[9px] h-3.5 px-1 py-0 border-primary/30 rounded-sm">Subm {entry.submissionIndex}</Badge>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
                          </div>
                          <p className="text-sm italic leading-relaxed text-foreground/80">"{entry.remarks}"</p>
                          <p className="text-[10px] font-semibold text-muted-foreground">— {entry.userName}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="p-4 border-t bg-muted/20 flex justify-end no-print">
            <DialogClose asChild><Button variant="outline" className="h-8 text-xs font-bold rounded-sm">Close</Button></DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewerImages} onOpenChange={() => setViewerImages(null)}>
        <DialogContent className="max-w-[95vw] h-[90vh] p-0 border-none bg-black/95 flex flex-col items-center justify-center rounded-sm">
          <DialogHeader className="sr-only">
            <DialogTitle>Full Screen Document Viewer</DialogTitle>
            <DialogDescription>Viewing images from submission in full size.</DialogDescription>
          </DialogHeader>
          <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white z-50 hover:bg-white/10 rounded-sm" onClick={() => setViewerImages(null)}>
            <X className="h-6 w-6" />
          </Button>
          {viewerImages && (
            <Carousel className="w-full h-full flex items-center justify-center" opts={{ startIndex: viewerImages.initialIndex }}>
              <CarouselContent className="h-full">
                {viewerImages.images.map((img, idx) => (
                  <CarouselItem key={idx} className="flex items-center justify-center h-full">
                    <img src={img.url} alt={img.name} className="max-w-full max-h-full object-contain shadow-2xl" />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-8 h-12 w-12 bg-white/10 text-white hover:bg-white/20 border-none rounded-sm" />
              <CarouselNext className="right-8 h-12 w-12 bg-white/10 text-white hover:bg-white/20 border-none rounded-sm" />
            </Carousel>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
