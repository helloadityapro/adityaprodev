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
import { collection, doc, query, where } from 'firebase/firestore';
import { Trash2, SlidersHorizontal, Building2, UserCircle2, ShieldCheck, UserCog, UserPlus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isSuperAdmin } from '@/lib/auth-constants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';

type PtwType = {
  id: string;
  name: string;
  authorizedAdminId?: string;
  authorizedAdminName?: string;
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
};

const genericItemSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
});

const ptwTypeSchema = z.object({
  name: z.string().min(1, 'Type name is required.'),
  authorizedAdminId: z.string().min(1, 'Approver selection is required.'),
});

export default function AdminSettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const [assigningType, setAssigningType] = React.useState<PtwType | null>(null);
  const [selectedAdminId, setSelectedAdminId] = React.useState<string>("");
  const [isAssigning, setIsAssigning] = React.useState(false);

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

  const adminsQuery = useMemoFirebase(() => query(collection(firestore, 'users'), where('role', '==', 'Admin')), [firestore]);
  const { data: admins } = useCollection<UserProfile>(adminsQuery);

  const ptwTypeForm = useForm<z.infer<typeof ptwTypeSchema>>({
    resolver: zodResolver(ptwTypeSchema),
    defaultValues: { name: '', authorizedAdminId: '' },
  });

  const roleForm = useForm<z.infer<typeof genericItemSchema>>({
    resolver: zodResolver(genericItemSchema),
    defaultValues: { name: '' },
  });

  const departmentForm = useForm<z.infer<typeof genericItemSchema>>({
    resolver: zodResolver(genericItemSchema),
    defaultValues: { name: '' },
  });

  const onPtwTypeSubmit = (values: z.infer<typeof ptwTypeSchema>) => {
    const admin = admins?.find(a => a.id === values.authorizedAdminId);
    addDocumentNonBlocking(collection(firestore, 'ptw_types'), {
      ...values,
      authorizedAdminName: admin?.username || admin?.email || 'System'
    });
    toast({ title: 'Success', description: `New PTW Type "${values.name}" added with authorized approver.` });
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

  const deleteItem = (coll: string, id: string) => {
    deleteDocumentNonBlocking(doc(firestore, coll, id));
    toast({ title: 'Deleted' });
  };

  const handleQuickAssign = async () => {
    if (!assigningType || !selectedAdminId) return;
    setIsAssigning(true);
    try {
      const admin = admins?.find(a => a.id === selectedAdminId);
      updateDocumentNonBlocking(doc(firestore, 'ptw_types', assigningType.id), {
        authorizedAdminId: selectedAdminId,
        authorizedAdminName: admin?.username || admin?.email || 'System'
      });
      toast({ title: 'Approver Assigned', description: `Authorization for ${assigningType.name} updated.` });
      setAssigningType(null);
      setSelectedAdminId("");
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsAssigning(false);
    }
  };

  if (isUserLoading || isProfileLoading || ptwTypesLoading) {
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
        <h1>System Configuration</h1>
        <p className="text-muted-foreground">Global settings and organizational dropdown management.</p>
      </div>

      <Tabs defaultValue="org" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8 rounded-sm max-w-md bg-muted/50 border border-primary/10">
          <TabsTrigger value="org" className="flex items-center gap-2 rounded-sm font-bold text-[10px] uppercase tracking-widest"><Building2 className="h-4 w-4" /> Organization</TabsTrigger>
          <TabsTrigger value="configuration" className="flex items-center gap-2 rounded-sm font-bold text-[10px] uppercase tracking-widest"><SlidersHorizontal className="h-4 w-4" /> PTW Types</TabsTrigger>
        </TabsList>

        <TabsContent value="org" className="space-y-8 animate-in fade-in-50 duration-300">
          <div className="grid gap-8 md:grid-cols-2">
            <Card className="rounded-sm border-primary/10 shadow-md overflow-hidden">
              <CardHeader className="bg-primary/5 border-b">
                <div className="flex items-center gap-2">
                  <UserCircle2 className="h-5 w-5 text-primary" />
                  <CardTitle className="text-sm font-bold uppercase tracking-widest">Manage Roles</CardTitle>
                </div>
                <CardDescription className="text-xs">Define organizational roles for personnel assignment.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <Form {...roleForm}>
                  <form onSubmit={roleForm.handleSubmit(onRoleSubmit)} className="flex items-start gap-2 mb-4">
                    <FormField
                      control={roleForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="flex-grow">
                          <FormControl><Input placeholder="e.g. Area Manager" {...field} className="rounded-sm h-10 text-sm" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="rounded-sm font-bold h-10">Add</Button>
                  </form>
                </Form>
                <div className="rounded-sm border max-h-60 overflow-auto">
                  <Table>
                    <TableBody>
                      {roles?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-bold text-sm">{item.name}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="rounded-sm h-8 w-8 text-destructive" onClick={() => deleteItem('user_roles', item.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-sm border-primary/10 shadow-md overflow-hidden">
              <CardHeader className="bg-primary/5 border-b">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <CardTitle className="text-sm font-bold uppercase tracking-widest">Manage Departments</CardTitle>
                </div>
                <CardDescription className="text-xs">Configure organizational departments/verticals.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <Form {...departmentForm}>
                  <form onSubmit={departmentForm.handleSubmit(onDepartmentSubmit)} className="flex items-start gap-2 mb-4">
                    <FormField
                      control={departmentForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="flex-grow">
                          <FormControl><Input placeholder="e.g. Quality Control" {...field} className="rounded-sm h-10 text-sm" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="rounded-sm font-bold h-10">Add</Button>
                  </form>
                </Form>
                <div className="rounded-sm border max-h-60 overflow-auto">
                  <Table>
                    <TableBody>
                      {departments?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-bold text-sm">{item.name}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="rounded-sm h-8 w-8 text-destructive" onClick={() => deleteItem('user_departments', item.id)}>
                              <Trash2 className="h-4 w-4" />
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

        <TabsContent value="configuration" className="space-y-6 animate-in fade-in-50 duration-300">
          <Card className="rounded-sm border-primary/10 shadow-md overflow-hidden">
            <CardHeader className="bg-primary/5 border-b">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <CardTitle className="text-sm font-bold uppercase tracking-widest">Manage PTW Types & Authorization</CardTitle>
              </div>
              <CardDescription className="text-xs">Define permit categories and assign their final authorized approvers.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...ptwTypeForm}>
                <form onSubmit={ptwTypeForm.handleSubmit(onPtwTypeSubmit)} className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8 items-end p-4 bg-muted/20 border rounded-sm">
                  <FormField
                    control={ptwTypeForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="md:col-span-5">
                        <FormLabel className="text-[10px] font-bold uppercase tracking-wider">Type Name</FormLabel>
                        <FormControl><Input placeholder="e.g. Hot Work" {...field} className="rounded-sm h-10" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={ptwTypeForm.control}
                    name="authorizedAdminId"
                    render={({ field }) => (
                      <FormItem className="md:col-span-5">
                        <FormLabel className="text-[10px] font-bold uppercase tracking-wider">Authorized Approver (Admin)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-10 rounded-sm">
                              <SelectValue placeholder="Select Admin" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {admins?.map(admin => (
                              <SelectItem key={admin.id} value={admin.id} className="text-xs font-bold">{admin.username}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="md:col-span-2">
                    <Button type="submit" className="w-full h-10 rounded-sm font-bold uppercase text-[10px] tracking-widest">Add Type</Button>
                  </div>
                </form>
              </Form>
              
              <div className="rounded-sm border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="px-6 font-black text-[10px] uppercase tracking-widest">PTW Type Name</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest">Authorized Approver</TableHead>
                      <TableHead className="text-right px-6 font-black text-[10px] uppercase tracking-widest">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ptwTypes && ptwTypes.length > 0 ? ptwTypes.map((type) => (
                      <TableRow key={type.id} className="hover:bg-muted/5 transition-colors">
                        <TableCell className="px-6 py-4 font-bold text-sm">{type.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <UserCog className="h-3.5 w-3.5 text-primary opacity-60" />
                            {type.authorizedAdminId ? (
                              <span className="text-xs font-semibold">{type.authorizedAdminName}</span>
                            ) : (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 text-[10px] font-bold uppercase rounded-sm border-dashed border-primary/30 text-primary hover:bg-primary/5"
                                onClick={() => {
                                  setAssigningType(type);
                                  setSelectedAdminId("");
                                }}
                              >
                                <UserPlus className="h-3 w-3 mr-1.5" /> Assign Approver
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <Button variant="ghost" size="icon" className="rounded-sm h-8 w-8 text-destructive" onClick={() => deleteItem('ptw_types', type.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={3} className="h-32 text-center text-muted-foreground italic text-xs">No types defined.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!assigningType} onOpenChange={(o) => !o && setAssigningType(null)}>
        <DialogContent className="max-w-md rounded-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" /> Assign Authorized Approver</DialogTitle>
            <DialogDescription className="text-xs font-medium">Select an Admin responsible for final approval of "{assigningType?.name}" permits.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Select Admin User</Label>
              <Select value={selectedAdminId} onValueChange={setSelectedAdminId}>
                <SelectTrigger className="h-11 rounded-sm"><SelectValue placeholder="Choose an Admin..." /></SelectTrigger>
                <SelectContent>
                  {admins?.map(admin => (
                    <SelectItem key={admin.id} value={admin.id} className="text-xs font-bold">{admin.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild><Button variant="outline" className="rounded-sm font-bold h-11 px-6 uppercase text-[10px]">Cancel</Button></DialogClose>
            <Button 
              disabled={!selectedAdminId || isAssigning} 
              className="rounded-sm font-black h-11 px-8 uppercase text-[10px] tracking-widest shadow-lg"
              onClick={handleQuickAssign}
            >
              {isAssigning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
