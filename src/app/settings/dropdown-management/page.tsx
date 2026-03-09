
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
import { collection, doc, writeBatch, arrayUnion, getDocs, query, where, or, serverTimestamp } from 'firebase/firestore';
import { Trash2, Search, ShieldCheck, AlertCircle, Loader2, SlidersHorizontal, ClipboardList, RefreshCw, Eraser, UserCog, CheckCircle2, XCircle, Building2, UserCircle2 } from 'lucide-react';
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

type GenericItem = {
  id: string;
  name: string;
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

const genericItemSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
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

  const rolesQuery = useMemoFirebase(() => collection(firestore, 'user_roles'), [firestore]);
  const { data: roles } = useCollection<GenericItem>(rolesQuery);

  const departmentsQuery = useMemoFirebase(() => collection(firestore, 'user_departments'), [firestore]);
  const { data: departments } = useCollection<GenericItem>(departmentsQuery);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers } = useCollection<UserProfile>(usersQuery);

  const permitsQuery = useMemoFirebase(() => collection(firestore, 'permits_to_work'), [firestore]);
  const { data: allPermits, isLoading: permitsLoading } = useCollection<Permit>(permitsQuery);

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

  const ptwTypeForm = useForm<z.infer<typeof genericItemSchema>>({
    resolver: zodResolver(genericItemSchema),
    defaultValues: { name: '' },
  });

  const roleForm = useForm<z.infer<typeof genericItemSchema>>({
    resolver: zodResolver(genericItemSchema),
    defaultValues: { name: '' },
  });

  const departmentForm = useForm<z.infer<typeof genericItemSchema>>({
    resolver: zodResolver(genericItemSchema),
    defaultValues: { name: '' },
  });

  const onPtwTypeSubmit = (values: z.infer<typeof genericItemSchema>) => {
    addDocumentNonBlocking(collection(firestore, 'ptw_types'), values);
    toast({ title: 'Success', description: 'New PTW Type added.' });
    ptwTypeForm.reset();
  };

  const onRoleSubmit = (values: z.infer<typeof genericItemSchema>) => {
    addDocumentNonBlocking(collection(firestore, 'user_roles'), values);
    toast({ title: 'Success', description: 'New Role added.' });
    roleForm.reset();
  };

  const onDepartmentSubmit = (values: z.infer<typeof genericItemSchema>) => {
    addDocumentNonBlocking(collection(firestore, 'user_departments'), values);
    toast({ title: 'Success', description: 'New Department added.' });
    departmentForm.reset();
  };

  const deletePtwType = (id: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'ptw_types', id));
    toast({ title: 'Success', description: 'PTW Type deleted.' });
  };

  const deleteRole = (id: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'user_roles', id));
    toast({ title: 'Success', description: 'Role deleted.' });
  };

  const deleteDepartment = (id: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'user_departments', id));
    toast({ title: 'Success', description: 'Department deleted.' });
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

  const handleDeleteForEveryone = async () => {
    if (!firestore || (!deleteDialog.isAll && deleteDialog.targets.length === 0)) return;
    setIsDeleting(true);
    try {
      let idsToDelete = deleteDialog.targets;
      
      if (deleteDialog.isAll) {
        const snapshot = await getDocs(collection(firestore, 'permits_to_work'));
        idsToDelete = snapshot.docs.map(doc => doc.id);
        updateDocumentNonBlocking(doc(firestore, 'system_settings', 'counters'), { lastPtwNumber: 0 });
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

  if (isUserLoading || isProfileLoading || ptwTypesLoading || permitsLoading) {
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
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <p className="text-muted-foreground">Global configuration and platform dropdown management.</p>
      </div>

      <Tabs defaultValue="org" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8 rounded-sm max-w-xl">
          <TabsTrigger value="org" className="flex items-center gap-2 rounded-sm"><Building2 className="h-4 w-4" /> Organization</TabsTrigger>
          <TabsTrigger value="configuration" className="flex items-center gap-2 rounded-sm"><SlidersHorizontal className="h-4 w-4" /> PTW Types</TabsTrigger>
          <TabsTrigger value="permits" className="flex items-center gap-2 rounded-sm"><ClipboardList className="h-4 w-4" /> Delete Records</TabsTrigger>
        </TabsList>

        <TabsContent value="org" className="space-y-8 animate-in fade-in-50 duration-300">
          <div className="grid gap-8 md:grid-cols-2">
            <Card className="rounded-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <UserCircle2 className="h-5 w-5 text-primary" />
                  <CardTitle>Manage Roles</CardTitle>
                </div>
                <CardDescription>Define organizational roles for personnel assignment.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...roleForm}>
                  <form onSubmit={roleForm.handleSubmit(onRoleSubmit)} className="flex items-start gap-2 mb-4">
                    <FormField
                      control={roleForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="flex-grow">
                          <FormControl><Input placeholder="e.g. Area Manager" {...field} className="rounded-sm" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="rounded-sm">Add</Button>
                  </form>
                </Form>
                <div className="rounded-sm border max-h-60 overflow-auto">
                  <Table>
                    <TableBody>
                      {roles?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="rounded-sm h-8 w-8" onClick={() => deleteRole(item.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!roles?.length && <TableRow><TableCell className="text-center py-8 text-muted-foreground italic">No custom roles defined.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <CardTitle>Manage Departments</CardTitle>
                </div>
                <CardDescription>Configure organizational departments/verticals.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...departmentForm}>
                  <form onSubmit={departmentForm.handleSubmit(onDepartmentSubmit)} className="flex items-start gap-2 mb-4">
                    <FormField
                      control={departmentForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="flex-grow">
                          <FormControl><Input placeholder="e.g. Quality Control" {...field} className="rounded-sm" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="rounded-sm">Add</Button>
                  </form>
                </Form>
                <div className="rounded-sm border max-h-60 overflow-auto">
                  <Table>
                    <TableBody>
                      {departments?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="rounded-sm h-8 w-8" onClick={() => deleteDepartment(item.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!departments?.length && <TableRow><TableCell className="text-center py-8 text-muted-foreground italic">No departments defined.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="configuration" className="space-y-6 animate-in fade-in-50 duration-300">
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
        </TabsContent>

        <TabsContent value="permits" className="space-y-6 animate-in fade-in-50 duration-300">
          <Card className="rounded-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Delete Operational Records</CardTitle>
                <CardDescription>Wipe records from the database. This action is permanent.</CardDescription>
              </div>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => setDeleteDialog({ open: true, targets: [], isAll: true })}
                className="rounded-sm bg-red-700 hover:bg-red-800"
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Delete All Permit Records
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
                      <TableHead>Site Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
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
                              <Badge variant="outline" className="rounded-sm text-[10px] font-bold uppercase">{p.status}</Badge>
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
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground italic">
                          No permit requests found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
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
              {deleteDialog.isAll ? 'Wipe All Data' : `Delete Records`}
            </AlertDialogTitle>
            <AlertDialogDescription>
                This will permanently remove the selected operational records from the organization database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm" disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDeleteForEveryone} disabled={isDeleting}>
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {deleteDialog.isAll ? "Wipe All Data" : "Confirm Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
