'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, writeBatch, arrayUnion, getDocs, query, where, or, getDoc, increment, serverTimestamp } from 'firebase/firestore';
import { Trash2, Search, ShieldCheck, AlertCircle, Loader2, SlidersHorizontal, ClipboardList, RefreshCw, Eraser, UserX, KeyRound, ShieldAlert, User, UserCog, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
import { format } from 'date-fns';
import { isSuperAdmin } from '@/lib/auth-constants';

type PtwType = {
  id: string;
  name: string;
  allowedApproverIds?: string[];
};

type Site = {
  id: string;
  name: string;
  projectCompany: string;
  acCapacity: string;
  dcCapacity: string;
};

type UserProfile = {
    id: string;
    username: string;
    email: string;
    role: string;
    hiddenPermitIds?: string[];
};

type Permit = {
  id: string;
  serialNumber?: string;
  siteName: string;
  ptwType: string;
  status: string;
  siteEngineerId: string;
  siteEngineerName?: string;
  siteManagerId?: string;
  timeline?: any[];
  requestDate: any;
};

type CleanupRequest = {
  id: string;
  targetEmail: string;
  requestedById: string;
  requestedByName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
};

const ptwTypeSchema = z.object({
  name: z.string().min(1, 'PTW Type name is required.'),
});

const siteSchema = z.object({
  name: z.string().min(1, 'Site name is required.'),
  projectCompany: z.string().min(1, 'Project company is required.'),
  acCapacity: z.string().min(1, 'AC capacity is required.'),
  dcCapacity: z.string().min(1, 'DC capacity is required.'),
});

export default function AdminSettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  const [ptwTypeToManage, setPtwTypeToManage] = React.useState<PtwType | null>(null);
  const [approverSearch, setApproverSearch] = React.useState("");

  // Permit Management States
  const [selectedPermitIds, setSelectedPermitIds] = React.useState<string[]>([]);
  const [deleteDialog, setDeleteDialog] = React.useState<{ open: boolean, targets: string[], isAll: boolean }>({ open: false, targets: [], isAll: false });
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Data Cleanup States
  const [purgeEmail, setPurgeEmail] = React.useState("");
  const [isRequestingPurge, setIsRequestingPurge] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isSuperAdminUser = user?.email === 'khalil@adityagreenenergy.com';

  React.useEffect(() => {
    if (!isUserLoading && !isProfileLoading && !isAdmin) {
      router.replace('/ptw/raise');
    }
  }, [isUserLoading, isProfileLoading, isAdmin, router]);

  const ptwTypesQuery = useMemoFirebase(() => collection(firestore, 'ptw_types'), [firestore]);
  const { data: ptwTypes, isLoading: ptwTypesLoading } = useCollection<PtwType>(ptwTypesQuery);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: sites, isLoading: sitesLoading } = useCollection<Site>(sitesQuery);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers } = useCollection<UserProfile>(usersQuery);

  const permitsQuery = useMemoFirebase(() => collection(firestore, 'permits_to_work'), [firestore]);
  const { data: allPermits, isLoading: permitsLoading } = useCollection<Permit>(permitsQuery);

  const cleanupRequestsQuery = useMemoFirebase(() => collection(firestore, 'cleanup_requests'), [firestore]);
  const { data: cleanupRequests, isLoading: cleanupRequestsLoading } = useCollection<CleanupRequest>(cleanupRequestsQuery);

  const potentialApprovers = React.useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(u => u.role === 'Admin' || u.role === 'Site Manager');
  }, [allUsers]);

  const filteredPotentialApprovers = React.useMemo(() => {
    return potentialApprovers.filter(u => 
        u.username.toLowerCase().includes(approverSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(approverSearch.toLowerCase())
    );
  }, [potentialApprovers, approverSearch]);

  const filteredPermits = React.useMemo(() => {
    if (!allPermits) return [];
    const hiddenIds = userProfile?.hiddenPermitIds || [];
    return allPermits.filter(p => !hiddenIds.includes(p.id));
  }, [allPermits, userProfile]);

  const ptwTypeForm = useForm<z.infer<typeof ptwTypeSchema>>({
    resolver: zodResolver(ptwTypeSchema),
    defaultValues: { name: '' },
  });

  const siteForm = useForm<z.infer<typeof siteSchema>>({
    resolver: zodResolver(siteSchema),
    defaultValues: { name: '', projectCompany: '', acCapacity: '', dcCapacity: '' },
  });

  const onPtwTypeSubmit = (values: z.infer<typeof ptwTypeSchema>) => {
    addDocumentNonBlocking(collection(firestore, 'ptw_types'), values);
    toast({ title: 'Success', description: 'New PTW Type added.' });
    ptwTypeForm.reset();
  };

  const onSiteSubmit = (values: z.infer<typeof siteSchema>) => {
    addDocumentNonBlocking(collection(firestore, 'sites'), values);
    toast({ title: 'Success', description: 'New Site added.' });
    siteForm.reset();
  };

  const deletePtwType = (id: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'ptw_types', id));
    toast({ title: 'Success', description: 'PTW Type deleted.' });
  };

  const deleteSite = (id: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'sites', id));
    toast({ title: 'Success', description: 'Site deleted.' });
  };

  const toggleApprover = (userId: string) => {
    if (!ptwTypeToManage) return;
    const current = ptwTypeToManage.allowedApproverIds || [];
    const next = current.includes(userId) ? current.filter(id => id !== userId) : [...current, userId];
    
    updateDocumentNonBlocking(doc(firestore, 'ptw_types', ptwTypeToManage.id), { allowedApproverIds: next });
    setPtwTypeToManage(prev => prev ? { ...prev, allowedApproverIds: next } : null);
  };

  // Permit Management Logic
  const toggleSelectAllPermits = () => {
    if (selectedPermitIds.length === filteredPermits.length) {
      setSelectedPermitIds([]);
    } else {
      setSelectedPermitIds(filteredPermits.map(p => p.id));
    }
  };

  const toggleSelectPermit = (id: string) => {
    setSelectedPermitIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleDeleteForMe = async () => {
    if (!user || deleteDialog.targets.length === 0) return;
    setIsDeleting(true);
    try {
      const userRef = doc(firestore, 'users', user.uid);
      updateDocumentNonBlocking(userRef, {
        hiddenPermitIds: arrayUnion(...deleteDialog.targets)
      });
      toast({ title: "Hidden Successfully", description: "Selected requests hidden from your view." });
      setSelectedPermitIds([]);
      setDeleteDialog({ open: false, targets: [], isAll: false });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not hide requests.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteForEveryone = async () => {
    if (!firestore || (!deleteDialog.isAll && deleteDialog.targets.length === 0)) return;
    setIsDeleting(true);
    try {
      let idsToDelete = deleteDialog.targets;
      
      if (deleteDialog.isAll) {
        const snapshot = await getDocs(collection(firestore, 'permits_to_work'));
        idsToDelete = snapshot.docs.map(doc => doc.id);
        
        // Reset the global monotonic counter
        updateDocumentNonBlocking(doc(firestore, 'system_settings', 'counters'), { lastPtwNumber: 0 });
      }

      for (const id of idsToDelete) {
          const pRef = doc(firestore, 'permits_to_work', id);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
              const pData = pSnap.data();
              if (pData.status === 'Approved') {
                  const hasRejection = (pData.timeline || []).some((t: any) => t.status === 'Rejected');
                  const basePoints = hasRejection ? 0.5 : 1.0;
                  
                  const engRef = doc(firestore, 'users', pData.siteEngineerId);
                  const engSnap = await getDoc(engRef);
                  if (engSnap.exists()) {
                      const m = engSnap.data()?.pointsMultiplier || 1;
                      updateDocumentNonBlocking(engRef, {
                          totalPoints: increment(-(basePoints * m))
                      });
                  }
              }
          }
      }

      const batchSize = 500;
      for (let i = 0; i < idsToDelete.length; i += batchSize) {
        const batch = writeBatch(firestore);
        const chunk = idsToDelete.slice(i, i + batchSize);
        chunk.forEach(id => {
          batch.delete(doc(firestore, 'permits_to_work', id));
        });
        await batch.commit();
      }

      toast({ title: "Permanently Deleted", description: deleteDialog.isAll ? "All records deleted and counter reset." : "Selected requests deleted." });
      setSelectedPermitIds([]);
      setDeleteDialog({ open: false, targets: [], isAll: false });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete records.' });
    } finally {
      setIsDeleting(false);
    }
  };

  // Data Purge Approval Workflow
  const handleRequestPurge = async () => {
    if (!purgeEmail.trim() || !user || !userProfile) return;
    
    const email = purgeEmail.toLowerCase().trim();
    const userExists = allUsers?.some(u => u.email.toLowerCase() === email);
    
    if (!userExists) {
      toast({ variant: 'destructive', title: 'Not Found', description: 'No user account found with this email.' });
      return;
    }

    setIsRequestingPurge(true);
    try {
      await addDocumentNonBlocking(collection(firestore, 'cleanup_requests'), {
        targetEmail: email,
        requestedById: user.uid,
        requestedByName: userProfile.username || user.email || 'Admin',
        status: 'pending',
        createdAt: serverTimestamp()
      });

      toast({ title: 'Purge Requested', description: `Request for ${email} submitted for Super Admin authorization.` });
      setPurgeEmail("");
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Request Failed', description: e.message });
    } finally {
      setIsRequestingPurge(false);
    }
  };

  const handleProcessCleanupRequest = async (req: CleanupRequest, action: 'approved' | 'rejected') => {
    if (!isSuperAdminUser || !firestore) return;

    if (action === 'rejected') {
      updateDocumentNonBlocking(doc(firestore, 'cleanup_requests', req.id), { status: 'rejected' });
      toast({ title: 'Request Rejected' });
      return;
    }

    // Approved: Execute actual purge
    setIsDeleting(true);
    try {
      const usersSnap = await getDocs(query(collection(firestore, 'users'), where('email', '==', req.targetEmail)));
      if (usersSnap.empty) {
        toast({ variant: 'destructive', title: 'Execution Failed', description: 'User account no longer exists.' });
        updateDocumentNonBlocking(doc(firestore, 'cleanup_requests', req.id), { status: 'rejected' });
        return;
      }

      const userId = usersSnap.docs[0].id;
      const collections = ['permits_to_work', 'tasks', 'requirements', 'dprs', 'material_movements', 'notifications'];
      let totalDeleted = 0;

      for (const colName of collections) {
        const q = query(collection(firestore, colName), or(where('userId', '==', userId), where('siteEngineerId', '==', userId), where('assignedToId', '==', userId)));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const batch = writeBatch(firestore);
          snap.docs.forEach(doc => {
            batch.delete(doc.ref);
            totalDeleted++;
          });
          await batch.commit();
        }
      }

      await deleteDocumentNonBlocking(doc(firestore, 'users', userId));
      updateDocumentNonBlocking(doc(firestore, 'cleanup_requests', req.id), { status: 'approved' });

      toast({ variant: 'success', title: 'Data Purge Complete', description: `Deleted ${totalDeleted} records and associated user profile. Session will be blocked.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Operation Failed', description: e.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const pendingCleanupRequests = React.useMemo(() => {
    return cleanupRequests?.filter(r => r.status === 'pending').sort((a, b) => {
      const da = a.createdAt?.toDate?.()?.getTime() || 0;
      const db = b.createdAt?.toDate?.()?.getTime() || 0;
      return db - da;
    }) || [];
  }, [cleanupRequests]);

  if (isUserLoading || isProfileLoading || ptwTypesLoading || sitesLoading || permitsLoading || cleanupRequestsLoading) {
    return (
        <div className="space-y-6 animate-pulse">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-[400px] w-full" />
        </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Global configuration and permit record management.</p>
      </div>

      <Tabs defaultValue="configuration" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8 rounded-sm max-w-xl">
          <TabsTrigger value="configuration" className="flex items-center gap-2 rounded-sm"><SlidersHorizontal className="h-4 w-4" /> Manage</TabsTrigger>
          <TabsTrigger value="permits" className="flex items-center gap-2 rounded-sm"><ClipboardList className="h-4 w-4" /> Delete Permits</TabsTrigger>
          <TabsTrigger value="cleanup" className="flex items-center gap-2 rounded-sm"><Eraser className="h-4 w-4" /> Data Cleanup</TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-6 animate-in fade-in-50 duration-300">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="rounded-sm">
              <CardHeader>
                <CardTitle>Manage PTW Types</CardTitle>
                <CardDescription>Define categories for permits and assign authorized approvers.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...ptwTypeForm}>
                  <form onSubmit={ptwTypeForm.handleSubmit(onPtwTypeSubmit)} className="flex items-start gap-2 mb-4">
                    <FormField
                      control={ptwTypeForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="flex-grow">
                          <FormControl><Input placeholder="Enter new PTW type" {...field} className="rounded-sm" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="rounded-sm">Add</Button>
                  </form>
                </Form>
                <div className="rounded-sm border max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type Name</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ptwTypes?.map((type) => (
                        <TableRow key={type.id}>
                          <TableCell className="font-medium">{type.name}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" title="Manage Approvers" className="rounded-sm" onClick={() => setPtwTypeToManage(type)}>
                                    <ShieldCheck className="h-4 w-4 text-primary" />
                                </Button>
                                <Button variant="ghost" size="icon" className="rounded-sm" onClick={() => deletePtwType(type.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-sm">
              <CardHeader>
                <CardTitle>Manage Sites</CardTitle>
                <CardDescription>Add project locations for selection in PtW requests.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...siteForm}>
                  <form onSubmit={siteForm.handleSubmit(onSiteSubmit)} className="space-y-4 mb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={siteForm.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Site Name</FormLabel><FormControl><Input placeholder="Project Site Name" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={siteForm.control} name="projectCompany" render={({ field }) => (
                            <FormItem><FormLabel>Project Company</FormLabel><FormControl><Input placeholder="Company Name" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={siteForm.control} name="acCapacity" render={({ field }) => (
                            <FormItem><FormLabel>AC Capacity</FormLabel><FormControl><Input placeholder="e.g., 100 MW" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={siteForm.control} name="dcCapacity" render={({ field }) => (
                            <FormItem><FormLabel>DC Capacity</FormLabel><FormControl><Input placeholder="e.g., 120 MWp" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                    <Button type="submit" className="w-full rounded-sm">Add New Site</Button>
                  </form>
                </Form>
                 <div className="rounded-sm border max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Site</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead className="text-right"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sites?.map((site) => (
                        <TableRow key={site.id}>
                          <TableCell className="font-medium">{site.name}</TableCell>
                          <TableCell>{site.projectCompany}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="rounded-sm" onClick={() => deleteSite(site.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="permits" className="space-y-6 animate-in fade-in-50 duration-300">
          <Card className="rounded-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Delete Permit Records</CardTitle>
                <CardDescription>Cleanup requests and manage administrative visibility across the entire platform. Reward points are reversed on deletion.</CardDescription>
              </div>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => setDeleteDialog({ open: true, targets: [], isAll: true })}
                className="rounded-sm bg-red-700 hover:bg-red-800"
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Delete All Records
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4 p-4 bg-muted/40 border rounded-sm">
                <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{selectedPermitIds.length} permits selected</span>
                </div>
                <Button 
                    variant="destructive" 
                    disabled={selectedPermitIds.length === 0} 
                    onClick={() => setDeleteDialog({ open: true, targets: selectedPermitIds, isAll: false })}
                    className="rounded-sm"
                >
                    <Trash2 className="h-4 w-4 mr-2" /> Delete Selected
                </Button>
              </div>

              <div className="rounded-sm border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={selectedPermitIds.length === filteredPermits.length && filteredPermits.length > 0} 
                          onCheckedChange={toggleSelectAllPermits} 
                        />
                      </TableHead>
                      <TableHead>Serial No</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Engineer</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right px-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPermits.length > 0 ? (
                      filteredPermits.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <Checkbox 
                              checked={selectedPermitIds.includes(p.id)} 
                              onCheckedChange={() => toggleSelectPermit(p.id)} 
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs">{p.serialNumber || p.id.slice(0,8)}</TableCell>
                          <TableCell className="font-medium">{p.siteName}</TableCell>
                          <TableCell>{p.ptwType}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs">{p.siteEngineerName || '—'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                                <UserCog className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs">{allUsers?.find(u => u.id === p.siteManagerId)?.username || '—'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                              <Badge variant="outline" className="rounded-sm text-[10px] font-bold uppercase">{p.status}</Badge>
                          </TableCell>
                          <TableCell className="text-[11px] text-muted-foreground">
                              {p.requestDate ? format(p.requestDate.toDate(), 'dd/MM/yyyy HH:mm') : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right px-6">
                              <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="text-destructive hover:bg-destructive/10 rounded-sm h-8 w-8"
                                  onClick={() => setDeleteDialog({ open: true, targets: [p.id], isAll: false })}
                              >
                                  <Trash2 className="h-4 w-4" />
                              </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground italic">
                          No permit requests found matching your current view.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cleanup" className="space-y-6 animate-in fade-in-50 duration-300">
          <div className="grid gap-8">
            <Card className="rounded-sm border-destructive/20">
              <CardHeader className="bg-destructive/5 border-b border-destructive/10">
                <div className="flex items-center gap-3">
                  <div className="bg-destructive/10 p-2 rounded-sm">
                    <Eraser className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <CardTitle className="text-destructive">User Data Cleanup</CardTitle>
                    <CardDescription>Request a permanent data purge for a user. This action requires Super Admin authorization.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="flex flex-col gap-4 p-4 bg-red-50 border border-red-100 rounded-sm">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-red-800 leading-relaxed space-y-2">
                      <p className="font-bold uppercase">Approval Workflow Information</p>
                      <p>Once requested, the Super Admin must formally authorize the data removal. This process will:</p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Permanently delete the Firestore <strong>User Profile</strong> and all associated <strong>Permits, Tasks, Reports</strong>.</li>
                        <li><strong>Block Session:</strong> The user will immediately lose access to the platform services.</li>
                        <li><strong>Auth Warning:</strong> Note that Firebase Auth accounts are not automatically deleted via the Client SDK. You must manually block or delete the login via the Firebase Console to prevent future sign-ins.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="purge-email">Target User Email</Label>
                    <Input 
                      id="purge-email" 
                      placeholder="e.g. user@example.com" 
                      value={purgeEmail}
                      onChange={(e) => setPurgeEmail(e.target.value)}
                      className="rounded-sm"
                    />
                  </div>
                  <Button 
                    variant="destructive" 
                    className="w-full rounded-sm font-bold h-11" 
                    disabled={!purgeEmail.includes('@') || isRequestingPurge}
                    onClick={handleRequestPurge}
                  >
                    {isRequestingPurge ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : <><KeyRound className="mr-2 h-4 w-4" /> Request Data Purge</>}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {pendingCleanupRequests.length > 0 && (
              <Card className="rounded-sm border-primary/10 shadow-md overflow-hidden">
                <CardHeader className="bg-primary/5 border-b">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <CardTitle>Cleanup Authorization Queue</CardTitle>
                  </div>
                  <CardDescription>Data removal requests awaiting authorization from project leadership.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="px-6">Target Account</TableHead>
                        <TableHead>Requested By</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right px-6">Authorization</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingCleanupRequests.map(req => (
                        <TableRow key={req.id}>
                          <TableCell className="px-6 py-4 font-bold text-sm">{req.targetEmail}</TableCell>
                          <TableCell className="text-xs font-medium text-muted-foreground">{req.requestedByName}</TableCell>
                          <TableCell className="text-[11px] text-muted-foreground">
                            {req.createdAt ? format(req.createdAt.toDate(), 'dd MMM HH:mm') : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right px-6">
                            {isSuperAdminUser ? (
                              <div className="flex justify-end gap-1">
                                <Button 
                                  size="sm" 
                                  className="h-8 rounded-sm bg-green-600 hover:bg-green-700 font-bold" 
                                  onClick={() => handleProcessCleanupRequest(req, 'approved')}
                                  disabled={isDeleting}
                                >
                                  {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                                  Authorize
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-8 rounded-sm text-red-600 hover:bg-red-50" 
                                  onClick={() => handleProcessCleanupRequest(req, 'rejected')}
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-[9px] uppercase tracking-wider font-bold">Awaiting Super Admin</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!ptwTypeToManage} onOpenChange={() => setPtwTypeToManage(null)}>
        <DialogContent className="max-w-md rounded-sm">
            <DialogHeader>
                <DialogTitle>Authorized Approvers</DialogTitle>
                <DialogDescription>
                    Select Managers and Admins authorized to approve <strong>{ptwTypeToManage?.name}</strong> requests.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search for Managers or Admins..." 
                        className="pl-8 rounded-sm" 
                        value={approverSearch} 
                        onChange={(e) => setApproverSearch(e.target.value)} 
                    />
                </div>
                <ScrollArea className="h-[300px] rounded-sm border p-4">
                    <div className="space-y-4">
                        {filteredPotentialApprovers.length > 0 ? filteredPotentialApprovers.map((u) => (
                            <div key={u.id} className="flex items-center space-x-3">
                                <Checkbox 
                                    id={`user-${u.id}`} 
                                    checked={ptwTypeToManage?.allowedApproverIds?.includes(u.id)}
                                    onCheckedChange={() => toggleApprover(u.id)}
                                />
                                <div className="grid gap-1.5 leading-none">
                                    <label htmlFor={`user-${u.id}`} className="text-sm font-medium leading-none cursor-pointer">
                                        {u.username}
                                    </label>
                                    <p className="text-[10px] text-muted-foreground">{u.role} &bull; {u.email}</p>
                                </div>
                            </div>
                        )) : (
                            <p className="text-center text-sm text-muted-foreground py-8">No matching users found.</p>
                        )}
                    </div>
                </ScrollArea>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button className="rounded-sm">Done</Button></DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialog.open} onOpenChange={(o) => !o && setDeleteDialog({ open: false, targets: [], isAll: false })}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteDialog.isAll ? 'Factory Reset PtW Data' : `Delete ${deleteDialog.targets.length > 1 ? 'Requests' : 'Request'}`}
            </AlertDialogTitle>
            <AlertDialogDescription>
                {deleteDialog.isAll 
                  ? 'This will permanently remove EVERY Permit to Work from the database. The global sequence count will reset to 1. Reward points will be reversed. Are you absolutely sure?'
                  : 'Choose how you want to handle the deletion of these records. Points will be reversed if deleted for everyone.'
                }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3 py-4">
            {!deleteDialog.isAll && (
              <div className="flex flex-col gap-1 p-3 border rounded-sm bg-accent/30">
                  <p className="text-sm font-bold">Delete for me</p>
                  <p className="text-xs text-muted-foreground">Only hides these requests from your administration dashboard. Engineers and Managers can still see them.</p>
                  <Button variant="outline" className="mt-2 w-full rounded-sm" onClick={handleDeleteForMe} disabled={isDeleting}>
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete for me"}
                  </Button>
              </div>
            )}
            <div className="flex flex-col gap-1 p-3 border border-destructive/20 rounded-sm bg-destructive/5">
                <p className="text-sm font-bold text-destructive">Delete for everyone</p>
                <p className="text-xs text-muted-foreground">
                  {deleteDialog.isAll 
                    ? 'WIPE ALL DATA: This cannot be undone.' 
                    : 'Permanently removes these records and reverses points from the database for all users.'}
                </p>
                <Button variant="destructive" className="mt-2 w-full rounded-sm" onClick={handleDeleteForEveryone} disabled={isDeleting}>
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : deleteDialog.isAll ? "Wipe All Data" : "Delete for everyone"}
                </Button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm" disabled={isDeleting}>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
