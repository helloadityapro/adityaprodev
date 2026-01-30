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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { FileCheck, Clock, FileX, List as ListIcon, ExternalLink, Eye, FilePen, Trash2, Check, X, FileText, FileVideo, Video, Film, Paperclip } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type Attachment = {
  url: string;
  contentType: string;
  name: string;
};

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
  attachments?: Attachment[];
  commentsAndRemarks?: string;
  adminRemarks?: string;
};

function StatusBadge({ status }: { status: Permit["status"] }) {
    const statusConfig = {
        Pending: { icon: Clock, className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80 dark:bg-yellow-900/50 dark:text-yellow-300 border-yellow-300' },
        Approved: { icon: FileCheck, className: 'bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/50 dark:text-green-300 border-green-300' },
        Rejected: { icon: FileX, className: 'bg-red-100 text-red-800 hover:bg-red-100/80 dark:bg-red-900/50 dark:text-red-300 border-red-300' },
        Corrected: { icon: FileCheck, className: 'bg-blue-100 text-blue-800 hover:bg-blue-100/80 dark:bg-blue-900/50 dark:text-blue-300 border-blue-300' },
    };

    const config = statusConfig[status];
    if (!config) return null;
    const Icon = config.icon;

    return (
        <Badge
          className={cn("flex items-center gap-1.5 text-xs font-medium w-fit border", config.className)}
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


const PermitListTable = React.memo(function PermitListTable({ permits, onAction, userRole, onViewDetails, onCorrect, onDelete, onAttachmentView }: { permits: Permit[]; onAction: (permit: Permit, status: 'Approved' | 'Rejected') => void; userRole: string; onViewDetails: (permit: Permit) => void; onCorrect: (permit: Permit) => void; onDelete: (permit: Permit) => void; onAttachmentView: (media: { url: string; type: string }) => void; }) {
    return (
      <TooltipProvider>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">#</TableHead>
              <TableHead>PTW Type</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Engineer</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attachments</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {permits.map((permit, index) => (
              <TableRow key={permit.id}>
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 font-medium">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{permit.ptwType}</span>
                  </div>
                </TableCell>
                <TableCell>{permit.siteName}</TableCell>
                <TableCell><UserDisplay userId={permit.siteEngineerId} /></TableCell>
                <TableCell>{permit.requestDate ? new Date(permit.requestDate?.toDate()).toLocaleDateString() : 'N/A'}</TableCell>
                <TableCell>
                  <StatusBadge status={permit.status} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-start gap-1 flex-wrap">
                    {permit.attachments?.map((attachment, index) => (
                      <Tooltip key={index}>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onAttachmentView({url: attachment.url, type: attachment.contentType})}>
                            {attachment.contentType.startsWith('video/') ? <Video className="h-4 w-4" /> : attachment.contentType.startsWith('image/') ? <FileVideo className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />}
                            <span className="sr-only">{attachment.name}</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{attachment.name}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => onViewDetails(permit)}><span className="sr-only">View</span><Eye className="h-4 w-4" /></Button>
                      
                      {userRole === 'SiteEngineer' && permit.status === 'Rejected' && (
                          <Button variant="outline" size="sm" onClick={() => onCorrect(permit)}>
                              <FilePen className="h-4 w-4 mr-2" />
                              Resubmit
                          </Button>
                      )}
                      
                      {(userRole === 'Admin' || userRole === 'Supervisor') && (
                          <>
                              {permit.status !== 'Approved' && <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => onDelete(permit)}><span className="sr-only">Delete</span><Trash2 className="h-4 w-4" /></Button>}
                              {(permit.status === 'Pending' || permit.status === 'Corrected') && (
                                  <>
                                  <Button variant="default" size="icon" className="bg-green-500 hover:bg-green-600 text-white h-8 w-8" onClick={() => onAction(permit, 'Approved')}><span className="sr-only">Approve</span><Check className="h-4 w-4" /></Button>
                                  <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => onAction(permit, 'Rejected')}><span className="sr-only">Reject</span><X className="h-4 w-4" /></Button>
                                  </>
                              )}
                          </>
                      )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TooltipProvider>
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

function PermitDetailsDialog({ permit, open, onOpenChange, onAttachmentView }: { permit: Permit | null, open: boolean, onOpenChange: (open: boolean) => void, onAttachmentView: (media: { url: string; type: string }) => void }) {
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
            
            {permit.attachments && permit.attachments.length > 0 && (
              <div className="col-span-2">
                <Label>Attachments</Label>
                <div className="flex flex-col gap-2 mt-2">
                  {permit.attachments.map((attachment, index) => (
                    <Button
                      key={index}
                      variant="link"
                      className="p-0 h-auto flex items-center gap-2 justify-start text-primary"
                      onClick={() => onAttachmentView({ url: attachment.url, type: attachment.contentType })}
                    >
                      <ExternalLink size={14}/>
                      <span>{attachment.name}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MediaViewerDialog({ media, open, onOpenChange }: { media: { url: string; type: string } | null, open: boolean, onOpenChange: (open: boolean) => void }) {
  if (!media) return null;

  const isVideo = media.type.startsWith('video/');
  const isImage = media.type.startsWith('image/');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Attachment Viewer</DialogTitle>
        </DialogHeader>
        <div className="py-4 flex items-center justify-center bg-black rounded-md">
          {isVideo ? (
            <video controls autoPlay src={media.url} className="max-h-[80vh] w-full rounded-md" />
          ) : isImage ? (
            <img src={media.url} alt="Attachment" className="max-h-[80vh] w-auto rounded-md" />
          ) : (
            <div className="flex flex-col items-center gap-4 p-8 text-muted-foreground">
                <Film size={48} />
                <p>Unsupported file type: {media.type}.</p>
                <Button asChild>
                    <a href={media.url} target="_blank" rel="noopener noreferrer">Download file</a>
                </Button>
            </div>
          )}
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
  const [permitToDelete, setPermitToDelete] = React.useState<Permit | null>(null);
  const [mediaToView, setMediaToView] = React.useState<{ url: string, type: string } | null>(null);

  const handleActionTrigger = React.useCallback((permit: Permit, status: 'Approved' | 'Rejected') => {
    setActionState({ permit, status });
  }, []);

  const handleViewDetails = React.useCallback((permit: Permit) => {
      setDetailsPermit(permit);
  }, []);

  const handleDeleteTrigger = React.useCallback((permit: Permit) => {
    setPermitToDelete(permit);
  }, []);
  
  const handleConfirmDelete = () => {
    if (!permitToDelete) return;
    const permitRef = doc(firestore, 'permits_to_work', permitToDelete.id);
    deleteDocumentNonBlocking(permitRef);
    setPermitToDelete(null);
  }

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
      router.push(`/ptw/raise?correct=${permit.id}`);
  }, [router]);

  const allPermits = permits || [];
  const pendingPermits = React.useMemo(() => allPermits.filter(p => p.status === 'Pending' || p.status === 'Corrected'), [allPermits]);
  const otherPermits = React.useMemo(() => allPermits.filter(p => p.status !== 'Pending' && p.status !== 'Corrected'), [allPermits]);
  
  const summary = {
    total: allPermits.length,
    pending: pendingPermits.length,
    approved: React.useMemo(() => allPermits.filter(p => p.status === 'Approved').length, [allPermits]),
    rejected: React.useMemo(() => allPermits.filter(p => p.status === 'Rejected').length, [allPermits]),
  };

  if (isLoading || (!userProfile && user?.email !== 'abhijeet.agepl@gmail.com')) {
    return <p>Loading permits...</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">PTW Request Management</h1>
        <p className="text-muted-foreground">Review and manage permit to work requests</p>
      </div>

      {(userRole === 'Admin' || userRole === 'Supervisor') && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                    <ListIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{summary.total}</div>
                </CardContent>
            </Card>
             <Card className="border-yellow-500 border-2">
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
                    <CardTitle className="text-sm font-medium">Approved</CardTitle>
                    <FileCheck className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{summary.approved}</div>
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

      <Card>
        <CardHeader>
          <CardTitle>Pending PTW Requests</CardTitle>
        </CardHeader>
        <CardContent>
            {pendingPermits.length > 0 ? (
                <PermitListTable permits={pendingPermits} onAction={handleActionTrigger} userRole={userRole || ''} onViewDetails={handleViewDetails} onCorrect={handleCorrectAndResubmit} onDelete={handleDeleteTrigger} onAttachmentView={setMediaToView} />
            ) : (
                <div className="text-center py-12 text-muted-foreground">
                    <p>No pending requests.</p>
                </div>
            )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>All Other Requests</CardTitle>
        </CardHeader>
        <CardContent>
            {otherPermits.length > 0 ? (
             <PermitListTable permits={otherPermits} onAction={handleActionTrigger} userRole={userRole || ''} onViewDetails={handleViewDetails} onCorrect={handleCorrectAndResubmit} onDelete={handleDeleteTrigger} onAttachmentView={setMediaToView} />
            ) : (
                 <div className="text-center py-12 text-muted-foreground">
                    <p>No other requests found.</p>
                </div>
            )}
        </CardContent>
      </Card>


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
        onAttachmentView={setMediaToView}
      />
      
      <AlertDialog open={!!permitToDelete} onOpenChange={() => setPermitToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the permit request.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MediaViewerDialog media={mediaToView} open={!!mediaToView} onOpenChange={() => setMediaToView(null)} />

    </div>
  )
}

    