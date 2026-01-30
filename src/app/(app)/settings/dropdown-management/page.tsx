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
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

type PtwType = {
  id: string;
  name: string;
};

type Site = {
  id: string;
  name: string;
  projectCompany: string;
  acCapacity: string;
  dcCapacity: string;
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

function AddOptionsSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <Skeleton className="h-9 w-80 mb-4" />
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-64 mt-1" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-10 w-full mb-4" />
                        <Skeleton className="h-32 w-full" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-64 mt-1" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <Skeleton className="h-32 w-full mt-4" />
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export default function AddOptionsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useUser();

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const isAdmin = userProfile?.role === 'Admin' || user?.email === 'abhijeet.agepl@gmail.com';

  React.useEffect(() => {
    if (!isProfileLoading && !isAdmin) {
      router.replace('/ptw/raise');
    }
  }, [isProfileLoading, isAdmin, router]);

  const ptwTypesQuery = useMemoFirebase(() => collection(firestore, 'ptw_types'), [firestore]);
  const { data: ptwTypes, isLoading: ptwTypesLoading } = useCollection<PtwType>(ptwTypesQuery);
  const ptwTypesCollectionRef = useMemoFirebase(() => collection(firestore, 'ptw_types'), [firestore]);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: sites, isLoading: sitesLoading } = useCollection<Site>(sitesQuery);
  const sitesCollectionRef = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);

  const ptwTypeForm = useForm<z.infer<typeof ptwTypeSchema>>({
    resolver: zodResolver(ptwTypeSchema),
    defaultValues: { name: '' },
  });

  const siteForm = useForm<z.infer<typeof siteSchema>>({
    resolver: zodResolver(siteSchema),
    defaultValues: { name: '', projectCompany: '', acCapacity: '', dcCapacity: '' },
  });

  const onPtwTypeSubmit = (values: z.infer<typeof ptwTypeSchema>) => {
    if (!ptwTypesCollectionRef) return;
    addDocumentNonBlocking(ptwTypesCollectionRef, values);
    toast({ title: 'Success', description: 'New PTW Type added.' });
    ptwTypeForm.reset();
  };

  const onSiteSubmit = (values: z.infer<typeof siteSchema>) => {
    if (!sitesCollectionRef) return;
    addDocumentNonBlocking(sitesCollectionRef, values);
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

  if (isProfileLoading || ptwTypesLoading || sitesLoading) {
    return <AddOptionsSkeleton />;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-headline font-semibold md:text-2xl">Add Options</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Manage PTW Types</CardTitle>
            <CardDescription>Add or remove options for the "PTW for" dropdown.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...ptwTypeForm}>
              <form onSubmit={ptwTypeForm.handleSubmit(onPtwTypeSubmit)} className="flex items-start gap-2 mb-4">
                <FormField
                  control={ptwTypeForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="flex-grow">
                      <FormLabel className="sr-only">New PTW Type</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter new PTW type" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit">Add</Button>
              </form>
            </Form>
            <div className="rounded-md border max-h-60 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ptwTypes?.map((type) => (
                    <TableRow key={type.id}>
                      <TableCell>{type.name}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deletePtwType(type.id)}>
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

        <Card>
          <CardHeader>
            <CardTitle>Manage Sites</CardTitle>
            <CardDescription>Add or remove options for the "Site name" dropdown.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...siteForm}>
              <form onSubmit={siteForm.handleSubmit(onSiteSubmit)} className="space-y-4 mb-4">
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
                <Button type="submit" className="w-full">Add New Site</Button>
              </form>
            </Form>
             <div className="rounded-md border max-h-60 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sites?.map((site) => (
                    <TableRow key={site.id}>
                      <TableCell>{site.name}</TableCell>
                      <TableCell>{site.projectCompany}</TableCell>
                      <TableCell>
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
    </div>
  );
}
