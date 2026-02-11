"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CircleCheck, Clock, CircleX, Eye, FilePen, ArrowUpDown, ArrowUp, ArrowDown, FilterX, History, User, ExternalLink, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, serverTimestamp, arrayUnion } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, isSameDay } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Separator } from "@/components/ui/separator";

type Attachment = { url: string; contentType: string; name: string; };

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

function StatusBadge({ status }: { status: Permit["status"] }) {
  const statusConfig = {
    Pending: { label: 'Pending with Manager', icon: Clock, className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    ManagerApproved: { label: 'Pending with Admin', icon: Clock, className: 'bg-blue-100 text-blue-800 border-blue-300' },
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

const formatTimestamp = (ts: any) => (ts?.toDate ? format(ts.toDate(), 'dd/MM/yyyy HH:mm') : 'N/A');

function UserDisplay({ userId }: { userId: string }) {
  const firestore = useFirestore();
  const { data: user } = useDoc(useMemoFirebase(() => userId ? doc(firestore, 'users', userId) : null, [firestore, userId]));
  return <span>{user?.username || '...'}</span>;
}

type SortKey = 'ptwType' | 'siteName' | 'requestDate' | 'status';

export default function PtwListPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
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
    let notificationDescription = `Your permit for "${permit.siteName}" has been updated to ${targetStatus}.`;

    if (targetStatus === 'Rejected') {
      notificationTitle = "Permit Rejected";
      notificationDescription = `Your permit for "${permit.siteName}" was rejected: ${remarks}`;
    } else if (targetStatus === 'Approved') {
      notificationTitle = "Permit Fully Approved";
      notificationDescription = `Great news! Your permit for "${permit.siteName}" is now fully approved and active.`;
    }

    addDocumentNonBlocking(collection(firestore, 'notifications'), {
      userId: permit.siteEngineerId,
      title: notificationTitle,
      description: notificationDescription,
      link: `/ptw/list`,
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
      const matchType = !filters.ptwType || p.ptwType === filters.ptwType;
      const matchSite = !filters.siteName || p.siteName === filters.siteName;
      const matchDate = !filters.date || (p.requestDate?.toDate && isSameDay(p.requestDate.toDate(), filters.date));
      return matchStatus && matchType && matchSite && matchDate;
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
  }, [permits, statusFilter, filters, sortConfig]);

  if (isLoading || !userRole) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">PTW List</h1>
        <p className="text-muted-foreground">Manage and track permit requests through the approval levels.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Quick Filters</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Pending">Pending Manager</SelectItem>
              <SelectItem value="ManagerApproved">Pending Admin</SelectItem>
              <SelectItem value="Approved">Fully Approved</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => { setStatusFilter('all'); setFilters({ ptwType: "", siteName: "", engineerId: "", date: undefined }); }}><FilterX className="mr-2 h-4 w-4" /> Clear</Button>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead onClick={() => handleSort('ptwType')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center">PTW Type <SortIcon column="ptwType" /></div>
                </TableHead>
                <TableHead onClick={() => handleSort('siteName')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center">Site <SortIcon column="siteName" /></div>
                </TableHead>
                <TableHead>Engineer</TableHead>
                <TableHead onClick={() => handleSort('status')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center">Status <SortIcon column="status" /></div>
                </TableHead>
                <TableHead onClick={() => handleSort('requestDate')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center">Date <SortIcon column="requestDate" /></div>
                </TableHead>
                <TableHead className="text-right px-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPermits.map(permit => (
                <TableRow key={permit.id}>
                  <TableCell className="font-medium">{permit.ptwType}</TableCell>
                  <TableCell>{permit.siteName}</TableCell>
                  <TableCell><UserDisplay userId={permit.siteEngineerId} /></TableCell>
                  <TableCell><StatusBadge status={permit.status} /></TableCell>
                  <TableCell>{formatTimestamp(permit.requestDate)}</TableCell>
                  <TableCell className="text-right px-6">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" title="View Details" onClick={() => setDetailsPermit(permit)}><Eye className="h-4 w-4" /></Button>

                      {userRole === 'Site Manager' && permit.status === 'Pending' && (
                        <>
                          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setActionState({ permit, status: 'ManagerApproved' })}>Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => setActionState({ permit, status: 'Rejected' })}>Reject</Button>
                        </>
                      )}

                      {userRole === 'Admin' && permit.status === 'ManagerApproved' && (
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
              ))}
              {filteredPermits.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No permits found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!actionState} onOpenChange={() => setActionState(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionState?.status === 'Rejected' ? 'Reject' : 'Approve'} Permit Request</DialogTitle>
            <DialogDescription>Provide remarks for this action. These will be logged in the timeline.</DialogDescription>
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
                toast({ variant: 'destructive', title: 'Remarks Required', description: 'Please enter a comment for the log.' });
              }
            }}>{actionState?.status === 'Rejected' ? 'Confirm Rejection' : 'Confirm Approval'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsPermit} onOpenChange={() => setDetailsPermit(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Permit Request Details</DialogTitle>
            <DialogDescription>Full summary and lifecycle timeline.</DialogDescription>
          </DialogHeader>
          {detailsPermit && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1"><Label className="text-xs text-muted-foreground uppercase">Site</Label><p className="font-semibold text-lg">{detailsPermit.siteName}</p></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground uppercase">Permit Type</Label><p className="font-semibold text-lg">{detailsPermit.ptwType}</p></div>
                <div className="col-span-full space-y-1"><Label className="text-xs text-muted-foreground uppercase">Description of Work</Label><p className="p-4 bg-muted/50 rounded-lg border whitespace-pre-wrap">{detailsPermit.descriptionOfWork}</p></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground uppercase">Status</Label><div><StatusBadge status={detailsPermit.status} /></div></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground uppercase">Initial Request</Label><p>{formatTimestamp(detailsPermit.requestDate)}</p></div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  <h3 className="font-bold text-sm uppercase tracking-wider">Lifecycle Timeline</h3>
                </div>
                <div className="relative space-y-4 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-primary/20 before:via-primary/50 before:to-primary/20">
                  {detailsPermit.timeline && detailsPermit.timeline.length > 0 ? (
                    detailsPermit.timeline.map((entry, idx) => (
                      <div key={idx} className="relative flex items-start group">
                        <div className="absolute left-0 mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-background border-2 border-primary shadow-sm z-10 transition-transform group-hover:scale-110">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex flex-col ml-14 w-full bg-muted/30 p-4 rounded-lg border border-border/50">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                            <span className="font-bold text-primary">{entry.action}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {formatTimestamp(entry.timestamp)}</span>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-[10px] py-0">{entry.userName}</Badge>
                          </div>
                          <p className="text-sm italic text-muted-foreground leading-relaxed">"{entry.remarks || 'No remarks provided.'}"</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="ml-14 py-4 text-sm text-muted-foreground italic">No lifecycle logs available for this permit.</div>
                  )}
                </div>
              </div>

              {detailsPermit.attachments && detailsPermit.attachments.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <Label className="text-xs text-muted-foreground uppercase">Attachments & Documents</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {detailsPermit.attachments.map((a, i) => {
                        const isMedia = a.contentType.startsWith('image') || a.contentType.startsWith('video');
                        return (
                          <div key={i} className="flex items-center gap-2 p-2 rounded-md border bg-muted/20">
                            <div className="flex-1 truncate">
                              <p className="text-xs font-medium truncate">{a.name}</p>
                              <p className="text-[10px] text-muted-foreground">{a.contentType}</p>
                            </div>
                            {isMedia ? (
                              <Button variant="outline" size="sm" onClick={() => setViewerState({ attachments: detailsPermit.attachments!, startIndex: i })}>
                                <Eye className="h-3 w-3 mr-1" /> View
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" asChild>
                                <a href={a.url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3 w-3 mr-1" /> Open
                                </a>
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewerState} onOpenChange={() => setViewerState(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Media Viewer</DialogTitle>
            <DialogDescription>Viewing permit attachments</DialogDescription>
          </DialogHeader>
          <Carousel opts={{ startIndex: viewerState?.startIndex || 0 }} className="w-full">
            <CarouselContent>
              {viewerState?.attachments.map((a, i) => (
                <CarouselItem key={i} className="flex flex-col items-center justify-center min-h-[60vh] p-4">
                  {a.contentType.startsWith('image') ? (
                    <img src={a.url} className="max-h-[70vh] max-w-full object-contain shadow-2xl rounded-sm" alt={a.name} />
                  ) : (
                    <video src={a.url} controls className="max-h-[70vh] max-w-full shadow-2xl rounded-sm" />
                  )}
                  <p className="mt-6 text-sm text-white/70 font-medium">{a.name}</p>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-4 text-white hover:text-white bg-white/10 hover:bg-white/20 border-white/20" />
            <CarouselNext className="right-4 text-white hover:text-white bg-white/10 hover:bg-white/20 border-white/20" />
          </Carousel>
          <div className="p-4 flex justify-center border-t border-white/10">
            <DialogClose asChild><Button variant="ghost" className="text-white hover:bg-white/10">Close Viewer</Button></DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
