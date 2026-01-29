"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, FileCheck, Clock, FileX, ArrowUpRight, List as ListIcon, ExternalLink, FileVideo, Video } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

type Permit = {
  id: string;
  siteName: string;
  ptwType: string;
  descriptionOfWork: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Corrected';
  siteEngineerId: string;
  supervisorId?: string;
  adminId?: string;
  requestDate: any; // Should be a timestamp
  videoUrl?: string;
  vlogUrl?: string;
  commentsAndRemarks?: string;
  adminRemarks?: string;
};

function StatusBadge({ status }: { status: Permit["status"] }) {
    const statusConfig = {
        Pending: { icon: Clock, className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80 dark:bg-yellow-900/50 dark:text-yellow-300 border-transparent' },
        Approved: { icon: FileCheck, className: 'bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/50 dark:text-green-300 border-transparent' },
        Rejected: { icon: FileX, className: 'bg-red-100 text-red-800 hover:bg-red-100/80 dark:bg-red-900/50 dark:text-red-300 border-transparent' },
        Corrected: { icon: ArrowUpRight, className: 'bg-blue-100 text-blue-800 hover:bg-blue-100/80 dark:bg-blue-900/50 dark:text-blue-300 border-transparent' },
    };

    const config = statusConfig[status];
    if (!config) return null;
    const Icon = config.icon;

    return (
        <Badge
          className={cn("flex items-center gap-1.5 text-xs font-medium", config.className)}
        >
            <Icon className="h-3 w-3" />
            {status}
        </Badge>
    );
}

function UserDisplay({ userId }: { userId: string }) {
  const firestore = useFirestore();
  const userRef = useMemoFirebase(() => userId ? doc(firestore, 'users', userId) : null, [firestore, userId]);
  const { data: user, isLoading } = useDoc(userRef);

  if (isLoading) return <span className="animate-pulse">...</span>;
  if (!user) return <span className="text-muted-foreground">Unknown</span>;
  return <span>{user.username}</span>;
}


const PermitListTable = React.memo(function PermitListTable({ permits, onAction, userRole, onViewDetails, onCorrect }: { permits: Permit[]; onAction: (permit: Permit, status: 'Approved' | 'Rejected') => void; userRole: string; onViewDetails: (permit: Permit) => void; onCorrect: (permit: Permit) => void; }) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Permit ID</TableHead>
            <TableHead>Site Name</TableHead>
            <TableHead>Permit For</TableHead>
            <TableHead className="hidden md:table-cell">Requested By</TableHead>
            <TableHead className="hidden sm:table-cell">Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Attachments</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {permits.map((permit) => (
            <TableRow key={permit.id}>
              <TableCell className="font-medium">{permit.id.substring(0,7)}...</TableCell>
              <TableCell>{permit.siteName}</TableCell>
              <TableCell>{permit.ptwType}</TableCell>
              <TableCell className="hidden md:table-cell"><UserDisplay userId={permit.siteEngineerId} /></TableCell>
              <TableCell className="hidden sm:table-cell">{permit.requestDate ? new Date(permit.requestDate?.toDate()).toLocaleDateString() : 'N/A'}</TableCell>
              <TableCell>
                <StatusBadge status={permit.status} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {permit.videoUrl && (
                    <a href={permit.videoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                      <FileVideo className="h-4 w-4"/>
                    </a>
                  )}
                  {permit.vlogUrl && (
                    <a href={permit.vlogUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                      <Video className="h-4 w-4" />
                    </a>
                  )}
                  {!permit.videoUrl && !permit.vlogUrl && (
                    <span className="text-xs text-muted-foreground">N/A</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button aria-haspopup="true" size="icon" variant="ghost">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Toggle menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => onViewDetails(permit)}>View Details</DropdownMenuItem>
                    {(userRole === 'Admin' || userRole === 'Supervisor') && permit.status === 'Pending' && (
                        <>
                            <DropdownMenuItem onClick={() => onAction(permit, 'Approved')}>Approve</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onAction(permit, 'Rejected')} className="text-destructive focus:text-destructive focus:bg-destructive/10">Reject</DropdownMenuItem>
                        </>
                    )}
                    {userRole === 'SiteEngineer' && permit.status === 'Rejected' && (
                        <DropdownMenuItem onClick={() => onCorrect(permit)}>Correct & Resubmit</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
});

const actionSchema = z.object({
  adminRemarks: z.string().min(1, "Remarks are required to proceed."),
});

function PermitActionDialog({ permit, status, open, onOpenChange, onConfirm }: { permit: Permit | null, status: 'Approved' | 'Rejected' | null, open: boolean, onOpenChange: (open: boolean) => void, onConfirm: (permitId: string, status: 'Approved' | 'Rejected', remarks: string) => void }) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof actionSchema>>({
    resolver: zodResolver(actionSchema),
    defaultValues: { adminRemarks: "" },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({ adminRemarks: "" });
    }
  }, [open, form]);

  const onSubmit = (values: z.infer<typeof actionSchema>) => {
    if (!permit || !status) return;
    onConfirm(permit.id, status, values.adminRemarks);
    toast({ title: `Permit ${status}`, description: `The permit has been ${status.toLowerCase()}.` });
    onOpenChange(false);
  };
  
  if (!permit || !status) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{status} Permit Request?</DialogTitle>
          <DialogDescription>
            You are about to {status.toLowerCase()} this permit. Please provide remarks for this action.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="adminRemarks"
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor="adminRemarks">Remarks</Label>
                  <FormControl>
                    <Textarea id="adminRemarks" placeholder={`Enter remarks for ${status.toLowerCase()} this permit...`} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit">{status}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function PermitDetailsDialog({ permit, open, onOpenChange }: { permit: Permit | null, open: boolean, onOpenChange: (open: boolean) => void }) {
  if (!permit) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Permit Details</DialogTitle>
          <DialogDescription>ID: {permit.id}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 text-sm">
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <div><Label>Site Name</Label><p>{permit.siteName}</p></div>
            <div><Label>Permit Type</Label><p>{permit.ptwType}</p></div>
            <div className="col-span-2"><Label>Description of Work</Label><p className="whitespace-pre-wrap">{permit.descriptionOfWork}</p></div>
            <div><Label>Status</Label><div><StatusBadge status={permit.status} /></div></div>
            <div><Label>Requested On</Label><p>{permit.requestDate ? new Date(permit.requestDate.toDate()).toLocaleString() : 'N/A'}</p></div>
            <div className="flex items-center gap-2"><Label>Requested By</Label><UserDisplay userId={permit.siteEngineerId} /></div>
             {permit.supervisorId && <div className="flex items-center gap-2"><Label>Reviewed By (Supervisor)</Label><UserDisplay userId={permit.supervisorId} /></div>}
            {permit.adminId && <div className="flex items-center gap-2"><Label>Reviewed By (Admin)</Label><UserDisplay userId={permit.adminId} /></div>}
            {permit.commentsAndRemarks && <div className="col-span-2"><Label>Engineer's Remarks</Label><p className="whitespace-pre-wrap">{permit.commentsAndRemarks}</p></div>}
            {permit.adminRemarks && <div className="col-span-2"><Label>Admin's Remarks</Label><p className="whitespace-pre-wrap">{permit.adminRemarks}</p></div>}
            {permit.videoUrl && <div><Label>Work Video/Photos</Label><a href={permit.videoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary underline"><ExternalLink size={14}/>View Attachment</a></div>}
            {permit.vlogUrl && <div><Label>Engineer's Vlog</Label><a href={permit.vlogUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary underline"><ExternalLink size={14}/>View Attachment</a></div>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


export default function PtwListPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile } = useDoc(userProfileRef);
  const isAdmin = userProfile?.role === "Admin" || user?.email === 'abhijeet.agepl@gmail.com';
  const userRole = isAdmin ? "Admin" : userProfile?.role;
  
  const [actionState, setActionState] = React.useState<{permit: Permit, status: 'Approved' | 'Rejected'} | null>(null);
  const [detailsPermit, setDetailsPermit] = React.useState<Permit | null>(null);

  const handleActionTrigger = React.useCallback((permit: Permit, status: 'Approved' | 'Rejected') => {
    setActionState({ permit, status });
  }, []);

  const handleViewDetails = React.useCallback((permit: Permit) => {
      setDetailsPermit(permit);
  }, []);

  const permitsQuery = useMemoFirebase(() => {
    if (!userRole) return null;
    const baseQuery = collection(firestore, 'permits_to_work');
    if (userRole === 'SiteEngineer') {
      return query(baseQuery, where('siteEngineerId', '==', user?.uid));
    }
    return baseQuery;
  }, [firestore, userRole, user]);

  const { data: permits, isLoading } = useCollection<Permit>(permitsQuery);

  const handlePermitAction = (permitId: string, status: Permit['status'], adminRemarks: string) => {
    const permitRef = doc(firestore, "permits_to_work", permitId);
    let updateData: any = { status, adminRemarks };
    if (userRole === 'Supervisor') {
        updateData.supervisorId = user?.uid;
    }
    if (userRole === 'Admin') {
        updateData.adminId = user?.uid;
    }
    updateDocumentNonBlocking(permitRef, updateData);
  };
  
  const handleCorrectAndResubmit = React.useCallback((permit: Permit) => {
      router.push('/ptw/raise');
  }, [router]);

  if (isLoading || (!userProfile && user?.email !== 'abhijeet.agepl@gmail.com')) {
    return <p>Loading permits...</p>
  }
  
  const allPermits = permits || [];
  const pendingPermits = React.useMemo(() => allPermits.filter(p => p.status === 'Pending'), [allPermits]);
  const approvedPermits = React.useMemo(() => allPermits.filter(p => p.status === 'Approved'), [allPermits]);
  const rejectedPermits = React.useMemo(() => allPermits.filter(p => p.status === 'Rejected'), [allPermits]);
  
  const summary = {
    total: allPermits.length,
    pending: pendingPermits.length,
    approved: approvedPermits.length,
    rejected: rejectedPermits.length,
  };


  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center">
        <h1 className="text-lg font-headline font-semibold md:text-2xl">Permits to Work</h1>
      </div>

      {(userRole === 'Admin' || userRole === 'Supervisor') && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Permits</CardTitle>
                    <ListIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{summary.total}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Approved</CardTitle>
                    <FileCheck className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{summary.approved}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pending</CardTitle>
                    <Clock className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{summary.pending}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Rejected</CardTitle>
                    <FileX className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{summary.rejected}</div>
                </CardContent>
            </Card>
        </div>
      )}

      <Tabs defaultValue="all">
        <TabsList className="grid w-full grid-cols-4 sm:w-auto sm:inline-flex">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
        <Card className="mt-4">
            <TabsContent value="all" className="m-0">
                <PermitListTable permits={allPermits} onAction={handleActionTrigger} userRole={userRole || ''} onViewDetails={handleViewDetails} onCorrect={handleCorrectAndResubmit} />
            </TabsContent>
            <TabsContent value="pending" className="m-0">
                <PermitListTable permits={pendingPermits} onAction={handleActionTrigger} userRole={userRole || ''} onViewDetails={handleViewDetails} onCorrect={handleCorrectAndResubmit} />
            </TabsContent>
            <TabsContent value="approved" className="m-0">
                <PermitListTable permits={approvedPermits} onAction={handleActionTrigger} userRole={userRole || ''} onViewDetails={handleViewDetails} onCorrect={handleCorrectAndResubmit} />
            </TabsContent>
            <TabsContent value="rejected" className="m-0">
                <PermitListTable permits={rejectedPermits} onAction={handleActionTrigger} userRole={userRole || ''} onViewDetails={handleViewDetails} onCorrect={handleCorrectAndResubmit} />
            </TabsContent>
        </Card>
      </Tabs>

      <PermitActionDialog
        permit={actionState?.permit || null}
        status={actionState?.status || null}
        open={!!actionState}
        onOpenChange={() => setActionState(null)}
        onConfirm={handlePermitAction}
      />
      
      <PermitDetailsDialog
        permit={detailsPermit}
        open={!!detailsPermit}
        onOpenChange={() => setDetailsPermit(null)}
      />

    </div>
  )
}
