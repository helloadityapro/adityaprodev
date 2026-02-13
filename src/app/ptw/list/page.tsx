
"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CircleCheck, Clock, CircleX, Eye, FilePen, ArrowUpDown, ArrowUp, ArrowDown, History, User, ExternalLink, CalendarDays, Printer, FileText, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, serverTimestamp, arrayUnion } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, isSameDay } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Separator } from "@/components/ui/separator";

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

function StatusBadge({ status }: { status: Permit["status"] }) {
  const statusConfig = {
    Pending: { label: 'Pending Manager', icon: Clock, className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    ManagerApproved: { label: 'Pending Admin', icon: Clock, className: 'bg-blue-100 text-blue-800 border-blue-300' },
    Approved: { label: 'Approved', icon: CircleCheck, className: 'bg-green-100 text-green-800 border-green-300' },
    Rejected: { label: 'Rejected', icon: CircleX, className: 'bg-red-100 text-red-800 border-red-300' },
  };
  const config = statusConfig[status] || statusConfig.Pending;
  const Icon = config.icon;
  return (
    <Badge className={cn("flex items-center gap-1.5 text-xs font-medium w-fit border", config.className)}>
      <Icon className="h-3 w-3" /> {config.label}
    </Badge>
  );
}

const formatTimestamp = (ts: any) => {
  if (!ts) return 'N/A';
  const date = ts.toDate ? ts.toDate() : (typeof ts === 'string' ? new Date(ts) : ts);
  return format(date, 'dd/MM/yyyy HH:mm');
};

function UserDisplay({ userId }: { userId: string }) {
  const firestore = useFirestore();
  const { data: user } = useDoc(useMemoFirebase(() => userId ? doc(firestore, 'users', userId) : null, [firestore, userId]));
  return <span>{user?.username || '...'}</span>;
}

function WhatsAppReminder({ userId, permit }: { userId: string | undefined, permit: Permit }) {
    const firestore = useFirestore();
    const { data: targetUser } = useDoc(useMemoFirebase(() => userId ? doc(firestore, 'users', userId) : null, [firestore, userId]));
    
    const triggerWhatsApp = () => {
        if (!targetUser?.mobile) return;
        const cleanMobile = targetUser.mobile.replace(/\D/g, '');
        const formattedMobile = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;
        const message = `Reminder: PtW request ${permit.serialNumber} for "${permit.siteName}" is pending your review.\nStatus: ${permit.status}\nLink: ${window.location.origin}/ptw/list?view=${permit.id}`;
        const url = `https://wa.me/${formattedMobile}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    if (!targetUser?.mobile) return null;

    return (
        <Button 
            variant="ghost" 
            size="icon" 
            className="text-green-600 hover:text-green-700 hover:bg-green-50" 
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
  const [filters, setFilters] = React.useState({ ptwType: "", siteName: "", engineerId: "", date: undefined as Date | undefined });
  const [actionState, setActionState] = React.useState<{ permit: Permit, status: 'Approved' | 'Rejected' | 'ManagerApproved' } | null>(null);
  const [detailsPermit, setDetailsPermit] = React.useState<Permit | null>(null);
  const [viewerState, setViewerState] = React.useState<{ attachments: Attachment[]; startIndex: number } | null>(null);
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'requestDate', direction: 'desc' });

  const { data: userProfile } = useDoc(useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]));
  const isAdmin = userProfile?.role === "Admin" || user?.email === 'abhijeet.agepl@gmail.com' || user?.email === 'abhijeetsb22@gmail.com' || user?.email === 'khalil@adityagreenenergy.com' || user?.email === 'prafulrana143@gmail.com';
  const userRole = isAdmin ? "Admin" : userProfile?.role;

  const permitsQuery = useMemoFirebase(() => {
    if (!userRole) return null;
    const base = collection(firestore, 'permits_to_work');
    if (userRole === 'Site Engineer') return query(base, where('siteEngineerId', '==', user?.uid));
    if (userRole === 'Site Manager') return query(base, where('siteManagerId', '==', user?.uid));
    return base;
  }, [firestore, userRole, user]);

  const { data: permits, isLoading } = useCollection<Permit>(permitsQuery);
  const { data: ptwTypes } = useCollection<PtwType>(useMemoFirebase(() => collection(firestore, 'ptw_types'), [firestore]));

  // Deep linking: open modal if ?view=ID is present
  React.useEffect(() => {
    const viewId = searchParams.get('view');
    if (viewId && permits) {
      const permit = permits.find(p => p.id === viewId);
      if (permit) {
        setDetailsPermit(permit);
      }
    }
  }, [searchParams, permits]);

  const isUserAuthorizedForType = (typeId: string | undefined, typeName: string) => {
    if (!user) return false;
    const typeDoc = ptwTypes?.find(t => t.name === typeName);
    if (!typeDoc) return false;
    return typeDoc.allowedApproverIds?.includes(user.uid) ?? false;
  };

  const handleAction = (permit: Permit, targetStatus: Permit['status'], remarks: string) => {
    if (!user || !userProfile) return;
    const permitRef = doc(firestore, "permits_to_work", permit.id);

    const timelineEntry: TimelineEntry = {
      status: targetStatus,
      timestamp: new Date(),
      userId: user.uid,
      userName: userProfile.username || user.email || 'System',
      remarks: remarks,
      action: targetStatus === 'Rejected' ? `Rejected by ${userRole}` : (targetStatus === 'ManagerApproved' ? 'Approved by Manager' : 'Final Approval by Admin')
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

    let notificationTitle = "Permit Status Update";
    let notificationDescription = `Your permit ${permit.serialNumber} for "${permit.siteName}" has been updated to ${targetStatus}.`;

    addDocumentNonBlocking(collection(firestore, 'notifications'), {
      userId: permit.siteEngineerId,
      title: notificationTitle,
      description: notificationDescription,
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

  if (isLoading || !userRole) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">PtW Dashboard</h1>
        <p className="text-muted-foreground">Monitor permit status and manage compliance.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-primary">Total Permits</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card className="bg-yellow-500/5 border-yellow-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-yellow-600">Pending Actions</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.pending}</div></CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-green-600">Fully Approved</CardTitle>
            <CircleCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.approved}</div></CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-destructive">Rejected</CardTitle>
            <CircleX className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.rejected}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
                <CardTitle className="text-sm font-medium">Filter by Status</CardTitle>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Status" /></SelectTrigger>
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

      <Card className="overflow-hidden">
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
                const isAuthorized = isUserAuthorizedForType(undefined, permit.ptwType);
                return (
                  <TableRow key={permit.id}>
                    <TableCell className="font-mono text-xs">{permit.serialNumber || permit.id.slice(0, 8)}</TableCell>
                    <TableCell className="font-medium">{permit.ptwType}</TableCell>
                    <TableCell>{permit.siteName}</TableCell>
                    <TableCell><StatusBadge status={permit.status} /></TableCell>
                    <TableCell>{formatTimestamp(permit.requestDate)}</TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" title="View Details" onClick={() => setDetailsPermit(permit)}><Eye className="h-4 w-4" /></Button>

                        {userRole === 'Site Engineer' && (permit.status === 'Pending' || permit.status === 'ManagerApproved') && (
                          <WhatsAppReminder userId={permit.status === 'Pending' ? permit.siteManagerId : undefined} permit={permit} />
                        )}

                        {userRole === 'Site Manager' && permit.status === 'Pending' && isAuthorized && (
                          <>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setActionState({ permit, status: 'ManagerApproved' })}>Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => setActionState({ permit, status: 'Rejected' })}>Reject</Button>
                          </>
                        )}

                        {userRole === 'Admin' && permit.status === 'ManagerApproved' && isAuthorized && (
                          <>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setActionState({ permit, status: 'Approved' })}>Final Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => setActionState({ permit, status: 'Rejected' })}>Reject</Button>
                          </>
                        )}

                        {userRole === 'Site Engineer' && permit.status === 'Rejected' && (
                          <Button size="sm" variant="outline" onClick={() => router.push(`/ptw/raise?correct=${permit.id}`)}>
                            <FilePen className="h-4 w-4 mr-2" /> Resubmit
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionState?.status === 'Rejected' ? 'Reject' : 'Approve'} Permit Request</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="action-remarks">Remarks/Comments</Label>
            <Textarea id="action-remarks" placeholder="Explain your decision..." className="min-h-[100px]" />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={() => {
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div id="printable-permit-area">
            <DialogHeader className="flex flex-row items-center justify-between border-b pb-4 mb-6">
              <div className="space-y-1">
                <DialogTitle className="text-2xl font-bold">Permit to Work Details</DialogTitle>
                <DialogDescription className="font-mono text-primary font-semibold">{detailsPermit?.serialNumber}</DialogDescription>
              </div>
              <div className="flex gap-2 no-print">
                <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-2" /> Print</Button>
              </div>
            </DialogHeader>
            {detailsPermit && (
                <div className="space-y-6 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                        <div className="space-y-1"><Label className="text-xs uppercase font-bold tracking-tight">Site Name</Label><p className="font-semibold text-lg">{detailsPermit.siteName}</p></div>
                        <div className="space-y-1"><Label className="text-xs uppercase font-bold tracking-tight">Permit Type</Label><p className="font-semibold text-lg">{detailsPermit.ptwType}</p></div>
                        <div className="col-span-full space-y-2">
                            <Label className="text-xs uppercase font-bold tracking-tight">Scope of Work</Label>
                            <p className="p-4 bg-muted/30 rounded-lg border leading-relaxed whitespace-pre-wrap">{detailsPermit.descriptionOfWork}</p>
                        </div>
                        <div className="space-y-1"><Label className="text-xs uppercase font-bold tracking-tight">Status</Label><div><StatusBadge status={detailsPermit.status} /></div></div>
                        <div className="space-y-1"><Label className="text-xs uppercase font-bold tracking-tight">Submission Date</Label><p className="font-medium">{formatTimestamp(detailsPermit.requestDate)}</p></div>
                    </div>

                    <Separator className="my-6" />
                    
                    <div className="space-y-4">
                        <div className="flex items-center gap-2"><History className="h-4 w-4 text-primary" /><h3 className="font-bold text-sm uppercase">Activity Log</h3></div>
                        <div className="space-y-4">
                        {detailsPermit.timeline?.map((entry, idx) => (
                            <div key={idx} className="flex gap-4 items-start p-3 bg-muted/20 rounded-lg border">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><User className="h-4 w-4 text-primary" /></div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-sm">{entry.action}</span>
                                        <span className="text-[10px] text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
                                    </div>
                                    <p className="text-xs italic">"{entry.remarks}" - {entry.userName}</p>
                                </div>
                            </div>
                        ))}
                        </div>
                    </div>
                </div>
            )}
          </div>
          <DialogFooter className="no-print">
            <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #printable-permit-area, #printable-permit-area * { visibility: visible; }
          #printable-permit-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  )
}
