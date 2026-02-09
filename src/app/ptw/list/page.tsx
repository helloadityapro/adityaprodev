"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FileCheck, Clock, FileX, List as ListIcon, Eye, FilePen, Check, X, FileText, Paperclip, Calendar as CalendarIcon, FilterX, MapPin, Film, Video, Image } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, serverTimestamp, writeBatch } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, isSameDay } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";

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
        Pending: { icon: Clock, className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
        ManagerApproved: { icon: FileCheck, className: 'bg-blue-100 text-blue-800 border-blue-300' },
        Approved: { icon: FileCheck, className: 'bg-green-100 text-green-800 border-green-300' },
        Rejected: { icon: FileX, className: 'bg-red-100 text-red-800 border-red-300' },
        Corrected: { icon: FileCheck, className: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
    };
    const config = statusConfig[status];
    if (!config) return null;
    const Icon = config.icon;
    return (
        <Badge className={cn("flex items-center gap-1.5 text-xs font-medium w-fit border", config.className)}>
            <Icon className="h-3 w-3" /> {status === 'ManagerApproved' ? 'Manager Approved' : status}
        </Badge>
    );
}

const formatTimestamp = (ts: any) => (ts?.toDate ? format(ts.toDate(), 'dd/MM/yyyy HH:mm') : 'N/A');

function UserDisplay({ userId }: { userId: string }) {
  const firestore = useFirestore();
  const { data: user } = useDoc(useMemoFirebase(() => userId ? doc(firestore, 'users', userId) : null, [firestore, userId]));
  return <span>{user?.username || '...'}</span>;
}

const actionSchema = z.object({ remarks: z.string().min(1, "Remarks are required.") });

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

  const { data: userProfile } = useDoc(useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]));
  const isAdmin = userProfile?.role === "Admin" || user?.email === 'abhijeet.agepl@gmail.com' || user?.email === 'abhijeetsb22@gmail.com';
  const userRole = isAdmin ? "Admin" : userProfile?.role;

  const permitsQuery = useMemoFirebase(() => {
    if (!userRole) return null;
    const base = collection(firestore, 'permits_to_work');
    if (userRole === 'SiteEngineer') return query(base, where('siteEngineerId', '==', user?.uid));
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
    
    if (userRole === 'Site Manager') {
        updateData.managerRemarks = remarks;
        updateData.siteManagerId = user?.uid;
    } else if (userRole === 'Admin') {
        updateData.adminRemarks = remarks;
        updateData.adminId = user?.uid;
    }
    
    updateDocumentNonBlocking(permitRef, updateData);

    addDocumentNonBlocking(collection(firestore, 'notifications'), {
        userId: permit.siteEngineerId,
        title: `Permit Update`,
        description: `Your permit for "${permit.siteName}" status changed to ${targetStatus}.`,
        link: `/ptw/list`,
        read: false,
        createdAt: serverTimestamp(),
    });
  };

  const filteredPermits = React.useMemo(() => {
    if (!permits) return [];
    return permits.filter(p => {
      const matchStatus = statusFilter === 'all' ? true : p.status === statusFilter;
      const matchType = !filters.ptwType || p.ptwType === filters.ptwType;
      const matchSite = !filters.siteName || p.siteName === filters.siteName;
      const matchDate = !filters.date || (p.requestDate?.toDate && isSameDay(p.requestDate.toDate(), filters.date));
      return matchStatus && matchType && matchSite && matchDate;
    }).sort((a, b) => (b.requestDate?.toDate?.()?.getTime() || 0) - (a.requestDate?.toDate?.()?.getTime() || 0));
  }, [permits, statusFilter, filters]);

  if (isLoading || !userRole) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">PTW List</h1>
        <p className="text-muted-foreground">Manage and track your permit requests.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Pending">Pending Manager</SelectItem>
                <SelectItem value="ManagerApproved">Manager Approved</SelectItem>
                <SelectItem value="Approved">Fully Approved</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => { setStatusFilter('all'); setFilters({ptwType: "", siteName: "", engineerId: "", date: undefined}); }}><FilterX className="mr-2 h-4 w-4" /> Clear</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PTW Type</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Engineer</TableHead>
                <TableHead>Status</TableHead>
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
                  <TableCell className="text-right flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setDetailsPermit(permit)}><Eye className="h-4 w-4" /></Button>
                    {userRole === 'Site Manager' && (permit.status === 'Pending' || permit.status === 'Corrected') && (
                        <>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setActionState({permit, status: 'ManagerApproved'})}>Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => setActionState({permit, status: 'Rejected'})}>Reject</Button>
                        </>
                    )}
                    {userRole === 'Admin' && permit.status === 'ManagerApproved' && (
                        <>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setActionState({permit, status: 'Approved'})}>Final Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => setActionState({permit, status: 'Rejected'})}>Reject</Button>
                        </>
                    )}
                    {userRole === 'SiteEngineer' && permit.status === 'Rejected' && (
                        <Button size="sm" variant="outline" onClick={() => router.push(`/ptw/raise?correct=${permit.id}`)}><FilePen className="h-4 w-4 mr-2" /> Resubmit</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={!!actionState} onOpenChange={() => setActionState(null)}>
        <DialogContent>
            <DialogHeader><DialogTitle>{actionState?.status === 'Rejected' ? 'Reject' : 'Approve'} Permit</DialogTitle></DialogHeader>
            <div className="py-4"><Label>Remarks</Label><Textarea id="remarks" placeholder="Add your comments here..." /></div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={() => {
                    const remarks = (document.getElementById('remarks') as HTMLTextAreaElement).value;
                    if (remarks) {
                        handleAction(actionState!.permit, actionState!.status, remarks);
                        setActionState(null);
                    } else {
                        toast({ variant: 'destructive', title: 'Remarks Required' });
                    }
                }}>Confirm</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={!!detailsPermit} onOpenChange={() => setDetailsPermit(null)}>
          <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Permit Details</DialogTitle></DialogHeader>
              {detailsPermit && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><Label>Site</Label><p>{detailsPermit.siteName}</p></div>
                      <div><Label>Type</Label><p>{detailsPermit.ptwType}</p></div>
                      <div className="col-span-2"><Label>Description</Label><p>{detailsPermit.descriptionOfWork}</p></div>
                      <div><Label>Status</Label><StatusBadge status={detailsPermit.status} /></div>
                      <div><Label>Date</Label><p>{formatTimestamp(detailsPermit.requestDate)}</p></div>
                      {detailsPermit.managerRemarks && <div className="col-span-2"><Label>Manager Remarks</Label><p className="italic">{detailsPermit.managerRemarks}</p></div>}
                      {detailsPermit.adminRemarks && <div className="col-span-2"><Label>Admin Remarks</Label><p className="italic text-red-600">{detailsPermit.adminRemarks}</p></div>}
                      {detailsPermit.attachments && (
                          <div className="col-span-2 space-y-2">
                              <Label>Attachments</Label>
                              <div className="flex gap-2">
                                  {detailsPermit.attachments.map((a, i) => (
                                      <Button key={i} variant="outline" size="sm" onClick={() => setViewerState({attachments: detailsPermit.attachments!, startIndex: i})}>File {i+1}</Button>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
              )}
          </DialogContent>
      </Dialog>
      
      {/* Media Viewer */}
      <Dialog open={!!viewerState} onOpenChange={() => setViewerState(null)}>
          <DialogContent className="max-w-4xl">
              <DialogHeader className="sr-only">
                  <DialogTitle>Media Viewer</DialogTitle>
                  <DialogDescription>Viewing permit attachments</DialogDescription>
              </DialogHeader>
              <Carousel opts={{ startIndex: viewerState?.startIndex || 0 }}>
                  <CarouselContent>
                      {viewerState?.attachments.map((a, i) => (
                          <CarouselItem key={i} className="flex flex-col items-center justify-center min-h-[50vh]">
                              {a.contentType.startsWith('image') ? <img src={a.url} className="max-h-[60vh] object-contain" /> : <video src={a.url} controls className="max-h-[60vh]" />}
                              <p className="mt-2 text-sm text-muted-foreground">{a.name}</p>
                          </CarouselItem>
                      ))}
                  </CarouselContent>
                  <CarouselPrevious />
                  <CarouselNext />
              </Carousel>
          </DialogContent>
      </Dialog>
    </div>
  )
}
