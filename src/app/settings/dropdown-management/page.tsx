
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
import { collection, doc, writeBatch, query, where } from 'firebase/firestore';
import { Trash2, Users, Search, Check, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

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

  const [statusToDelete, setStatusToDelete] = React.useState<string | null>(null);
  const [individualPermitToDelete, setIndividualPermitToDelete] = React.useState<any | null>(null);
  const [ptwTypeToManage, setPtwTypeToManage] = React.useState<PtwType | null>(null);
  const [approverSearch, setApproverSearch] = React.useState("");

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const isAdmin = userProfile?.role === 'Admin' || 
                  user?.email === 'abhijeet.agepl@gmail.com' || 
                  user?.email === 'abhijeetsb22@gmail.com' ||
                  user?.email === 'khalil@adityagreenenergy.com' ||
                  user?.email === 'prafulrana143@gmail.com';

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

  if (isUserLoading || isProfileLoading || ptwTypesLoading || sitesLoading) {
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
        <h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1>
        <p className="text-muted-foreground">Manage dropdown options and specialized authorizations.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
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
                      <FormControl><Input placeholder="Enter new PTW type" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit">Add</Button>
              </form>
            </Form>
            <div className="rounded-md border max-h-96 overflow-auto">
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
                            <Button variant="ghost" size="icon" title="Manage Approvers" onClick={() => setPtwTypeToManage(type)}>
                                <ShieldCheck className="h-4 w-4 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deletePtwType(type.id)}>
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

        <Card>
          <CardHeader>
            <CardTitle>Manage Sites</CardTitle>
            <CardDescription>Add project locations for selection in PtW requests.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...siteForm}>
              <form onSubmit={siteForm.handleSubmit(onSiteSubmit)} className="space-y-4 mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={siteForm.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>Site Name</FormLabel><FormControl><Input placeholder="Project Site Name" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={siteForm.control} name="projectCompany" render={({ field }) => (
                        <FormItem><FormLabel>Project Company</FormLabel><FormControl><Input placeholder="Company Name" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={siteForm.control} name="acCapacity" render={({ field }) => (
                        <FormItem><FormLabel>AC Capacity</FormLabel><FormControl><Input placeholder="e.g., 100 MW" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={siteForm.control} name="dcCapacity" render={({ field }) => (
                        <FormItem><FormLabel>DC Capacity</FormLabel><FormControl><Input placeholder="e.g., 120 MWp" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                <Button type="submit" className="w-full">Add New Site</Button>
              </form>
            </Form>
             <div className="rounded-md border max-h-96 overflow-auto">
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
                        <Button variant="ghost" size="icon" onClick={() => deleteSite(site.id)}>
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

      <Dialog open={!!ptwTypeToManage} onOpenChange={() => setPtwTypeToManage(null)}>
        <DialogContent className="max-w-md">
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
                        className="pl-8" 
                        value={approverSearch} 
                        onChange={(e) => setApproverSearch(e.target.value)} 
                    />
                </div>
                <ScrollArea className="h-[300px] rounded-md border p-4">
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
                <DialogClose asChild><Button>Done</Button></DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
