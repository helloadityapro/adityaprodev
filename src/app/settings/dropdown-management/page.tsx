
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
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Trash2, SlidersHorizontal, Building2, UserCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isSuperAdmin } from '@/lib/auth-constants';

type PtwType = {
  id: string;
  name: string;
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

export default function AdminSettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

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

  const deleteItem = (coll: string, id: string) => {
    deleteDocumentNonBlocking(doc(firestore, coll, id));
    toast({ title: 'Deleted' });
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
        <h1 className="text-3xl font-bold tracking-tight">System Configuration</h1>
        <p className="text-muted-foreground">Global settings and organizational dropdown management.</p>
      </div>

      <Tabs defaultValue="org" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8 rounded-sm max-w-md">
          <TabsTrigger value="org" className="flex items-center gap-2 rounded-sm"><Building2 className="h-4 w-4" /> Organization</TabsTrigger>
          <TabsTrigger value="configuration" className="flex items-center gap-2 rounded-sm"><SlidersHorizontal className="h-4 w-4" /> PTW Types</TabsTrigger>
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
                            <Button variant="ghost" size="icon" className="rounded-sm h-8 w-8" onClick={() => deleteItem('user_roles', item.id)}>
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
                            <Button variant="ghost" size="icon" className="rounded-sm h-8 w-8" onClick={() => deleteItem('user_departments', item.id)}>
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

        <TabsContent value="configuration" className="space-y-6 animate-in fade-in-50 duration-300">
          <Card className="rounded-sm">
            <CardHeader>
              <CardTitle>Manage PTW Types</CardTitle>
              <CardDescription>Define categories for permits.</CardDescription>
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
                  <TableBody>
                    {ptwTypes?.map((type) => (
                      <TableRow key={type.id}>
                        <TableCell className="font-medium">{type.name}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="rounded-sm" onClick={() => deleteItem('ptw_types', type.id)}>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
