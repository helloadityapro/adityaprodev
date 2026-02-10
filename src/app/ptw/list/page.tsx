
"use client";
import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FileCheck, Clock, FileX, Eye, FilePen, ArrowUpDown, ArrowUp, ArrowDown, FilterX } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, serverTimestamp } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, isSameDay } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

type Attachment = { url: string; contentType: string; name: string; };

type Permit = {
  id: string;
  siteName: string;
  ptwType: string;
  descriptionOfWork: string;
  status: 'Pending' | 'ManagerApproved' | 'Approved' | 'Rejected' | 'Corrected';
  siteEngineerId: string;
  siteManagerId?: string;
  adminId?: string;
  requestDate: any;
  statusChangeDate?: any;
  attachments?: Attachment[];
  commentsAndRemarks?: string;
  adminRemarks?: string;
  managerRemarks?: string;
  latitude?: number;
  longitude?: number;
  isNew?: boolean;
};

function StatusBadge({ status }: { status: Permit["status"] }) {
    const statusConfig = {
        Pending: { label: 'Pending with Manager', icon: Clock, className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
        ManagerApproved: { label: 'Pending with Admin', icon: Clock, className: 'bg-blue-100 text-blue-800 border-blue-300' },
        Approved: { label: 'Approved', icon: FileCheck, className: 'bg-green-100 text-green-800 border-green-300' },
        Rejected: { label: 'Rejected', icon: FileX, className: 'bg-red-100 text-red-800 border-red-300' },
        Corrected: { label: 'Corrected (Pending)', icon: Clock, className: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
    };
    const config = statusConfig[status];
    if (!config) return null;
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
  const [actionState, setActionState] = React.useState<{permit: Permit, status: 'Approved' | 'Rejected' | 'ManagerApproved'} | null>(null);
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
    const permitRef = doc(firestore, "permits_to_work", permit.id);
    const updateData: any = { 
        status: targetStatus, 
        statusChangeDate: serverTimestamp(),
        isNew: true
    };
    
    let notificationMessage = `Your permit for "${permit.siteName}" status changed to ${targetStatus}.`;

    if (userRole === 'Site Manager') {
        updateData.managerRemarks = remarks;
        updateData.siteManagerId = user?.uid;
        if (targetStatus === 'Rejected') {
            notificationMessage = `Your permit for "${permit.siteName}" was rejected by the Site Manager: ${remarks}`;
        }
    } else if (userRole === 'Admin') {
        updateData.adminRemarks = remarks;
        updateData.adminId = user?.uid;
        if (targetStatus === 'Rejected') {
            notificationMessage = `Your permit for "${permit.siteName}" was rejected by the Admin: ${remarks}`;
            
            // Also notify the manager if admin rejects
            if (permit.siteManagerId) {
                addDocumentNonBlocking(collection(firestore, 'notifications'), {
                    userId: permit.siteManagerId,
                    title: `Permit Final Rejection`,
                    description: `An engineer's permit you approved for "${permit.siteName}" was rejected by the Admin: ${remarks}`,
                    link: `/ptw/list`,
                    read: false,
                    createdAt: serverTimestamp(),
                });
            }
        }
    }
    
    updateDocumentNonBlocking(permitRef, updateData);

    // Notify the Site Engineer
    addDocumentNonBlocking(collection(firestore, 'notifications'), {
        userId: permit.siteEngineerId,
        title: `Permit Status Update`,
        description: notificationMessage,
        link: `/ptw/list`,
        read: false,
        createdAt: serverTimestamp(),
    });

    toast({ title: "Status Updated", description: `The permit has been marked as ${targetStatus}.` });
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
      let valA = a[key];
      let valB = b[key];

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
        <p className="text-muted-foreground">Manage and track your permit requests through the approval levels.</p>
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
          <Button variant="outline" onClick={() => { setStatusFilter('all'); setFilters({ptwType: "", siteName: "", engineerId: "", date: undefined}); }}><FilterX className="mr-2 h-4 w-4" /> Clear</Button>
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
                <TableHead className="text-right">Actions</TableHead>
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
                  <TableCell className="text-right flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" title="View Details" onClick={() => setDetailsPermit(permit)}><Eye className="h-4 w-4" /></Button>
                    
                    {/* Site Manager Actions */}
                    {userRole === 'Site Manager' && (permit.status === 'Pending' || permit.status === 'Corrected') && (
                        <>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setActionState({permit, status: 'ManagerApproved'})}>Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => setActionState({permit, status: 'Rejected'})}>Reject</Button>
                        </>
                    )}
                    
                    {/* Admin Actions */}
                    {userRole === 'Admin' && permit.status === 'ManagerApproved' && (
                        <>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setActionState({permit, status: 'Approved'})}>Final Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => setActionState({permit, status: 'Rejected'})}>Reject</Button>
                        </>
                    )}
                    
                    {/* Engineer Actions (Resubmit) */}
                    {userRole === 'Site Engineer' && permit.status === 'Rejected' && (
                        <Button size="sm" variant="outline" onClick={() => router.push(`/ptw/raise?correct=${permit.id}`)}><FilePen className="h-4 w-4 mr-2" /> Resubmit</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredPermits.length === 0 && (
                  <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No permits found in this category.</TableCell>
                  </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Action Dialog (Approve/Reject with Remarks) */}
      <Dialog open={!!actionState} onOpenChange={() => setActionState(null)}>
        <DialogContent>
            <DialogHeader>
              <DialogTitle>{actionState?.status === 'Rejected' ? 'Reject' : 'Approve'} Permit Request</DialogTitle>
              <DialogDescription>
                Please provide your remarks for this action.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
                <Label htmlFor="action-remarks">Remarks/Comments</Label>
                <Textarea id="action-remarks" placeholder="Explain the reason for your decision..." />
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={() => {
                    const remarks = (document.getElementById('action-remarks') as HTMLTextAreaElement).value;
                    if (remarks) {
                        handleAction(actionState!.permit, actionState!.status, remarks);
                        setActionState(null);
                    } else {
                        toast({ variant: 'destructive', title: 'Remarks Required', description: 'Please enter a comment to proceed.' });
                    }
                }}>{actionState?.status === 'Rejected' ? 'Confirm Rejection' : 'Confirm Approval'}</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details View Dialog */}
      <Dialog open={!!detailsPermit} onOpenChange={() => setDetailsPermit(null)}>
          <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Permit Request Details</DialogTitle>
                <DialogDescription>Full summary of the permit and its approval history.</DialogDescription>
              </DialogHeader>
              {detailsPermit && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm py-4">
                      <div className="space-y-1"><Label className="text-xs text-muted-foreground">Site</Label><p className="font-medium text-base">{detailsPermit.siteName}</p></div>
                      <div className="space-y-1"><Label className="text-xs text-muted-foreground">Permit Type</Label><p className="font-medium text-base">{detailsPermit.ptwType}</p></div>
                      <div className="col-span-full space-y-1"><Label className="text-xs text-muted-foreground">Description of Work</Label><p className="p-3 bg-muted rounded-md border">{detailsPermit.descriptionOfWork}</p></div>
                      
                      <div className="space-y-1"><Label className="text-xs text-muted-foreground">Current Status</Label><div><StatusBadge status={detailsPermit.status} /></div></div>
                      <div className="space-y-1"><Label className="text-xs text-muted-foreground">Submission Date</Label><p>{formatTimestamp(detailsPermit.requestDate)}</p></div>
                      
                      {detailsPermit.managerRemarks && (
                        <div className="col-span-full space-y-1 p-3 bg-blue-50/50 border border-blue-100 rounded-md">
                          <Label className="text-xs text-blue-800">Site Manager Remarks</Label>
                          <p className="italic text-blue-900">{detailsPermit.managerRemarks}</p>
                        </div>
                      )}
                      
                      {detailsPermit.adminRemarks && (
                        <div className="col-span-full space-y-1 p-3 bg-red-50/50 border border-red-100 rounded-md">
                          <Label className="text-xs text-red-800">Admin Rejection Remarks</Label>
                          <p className="italic text-red-900">{detailsPermit.adminRemarks}</p>
                        </div>
                      )}
                      
                      {detailsPermit.attachments && detailsPermit.attachments.length > 0 && (
                          <div className="col-span-full space-y-2">
                              <Label className="text-xs text-muted-foreground">Attachments & Media</Label>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  {detailsPermit.attachments.map((a, i) => (
                                      <Button key={i} variant="outline" size="sm" className="w-full truncate" onClick={() => setViewerState({attachments: detailsPermit.attachments!, startIndex: i})}>
                                        {a.contentType.startsWith('image') ? 'Photo' : 'Video'} {i+1}
                                      </Button>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
              )}
          </DialogContent>
      </Dialog>
      
      {/* Media Gallery Viewer */}
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
