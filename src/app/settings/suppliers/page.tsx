
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
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { Trash2, Search, Plus, Pencil, Loader2, Truck, Mail, Smartphone, MapPin, Hash, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { isSuperAdmin } from '@/lib/auth-constants';

type Supplier = {
  id: string;
  name: string;
  gstin: string;
  address: string;
  mobile: string;
  email: string;
  createdAt: any;
};

const supplierSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  gstin: z.string().min(15, 'GSTIN must be 15 characters.').max(15, 'GSTIN must be 15 characters.'),
  address: z.string().min(1, 'Address is required.'),
  mobile: z.string().min(10, 'Mobile number is required.'),
  email: z.string().email('Invalid email address.').or(z.literal('')),
});

export default function SuppliersManagementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [supplierToEdit, setSupplierToEdit] = React.useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  React.useEffect(() => {
    if (!isUserLoading && !isProfileLoading && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [isUserLoading, isProfileLoading, isAdmin, router]);

  const suppliersQuery = useMemoFirebase(() => collection(firestore, 'suppliers'), [firestore]);
  const { data: suppliers, isLoading: suppliersLoading } = useCollection<Supplier>(suppliersQuery);

  const filteredSuppliers = React.useMemo(() => {
    if (!suppliers) return [];
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.gstin.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [suppliers, searchTerm]);

  const form = useForm<z.infer<typeof supplierSchema>>({
    resolver: zodResolver(supplierSchema),
    defaultValues: { name: '', gstin: '', address: '', mobile: '', email: '' },
  });

  const onAddSubmit = (values: z.infer<typeof supplierSchema>) => {
    addDocumentNonBlocking(collection(firestore, 'suppliers'), {
      ...values,
      createdAt: serverTimestamp(),
    });
    toast({ title: 'Supplier Added', description: `${values.name} has been added to the registry.` });
    form.reset();
    setIsAddDialogOpen(false);
  };

  const onEditSubmit = (values: z.infer<typeof supplierSchema>) => {
    if (!supplierToEdit) return;
    updateDocumentNonBlocking(doc(firestore, 'suppliers', supplierToEdit.id), values);
    toast({ title: 'Supplier Updated', description: 'Record has been successfully modified.' });
    setSupplierToEdit(null);
  };

  const handleDelete = (id: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'suppliers', id));
    toast({ title: 'Supplier Removed' });
  };

  if (isUserLoading || isProfileLoading || suppliersLoading) {
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <Truck className="h-8 w-8" /> Supplier Registry
          </h1>
          <p className="text-muted-foreground">Manage organizational material suppliers and their credentials.</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} className="rounded-sm font-bold shadow-md">
          <Plus className="mr-2 h-4 w-4" /> Add New Supplier
        </Button>
      </div>

      <Card className="rounded-sm shadow-sm overflow-hidden border-primary/10">
        <CardHeader className="bg-muted/5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Suppliers Database</CardTitle>
            <CardDescription>Comprehensive list of all registered business partners.</CardDescription>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name or GSTIN..." 
              className="pl-8 rounded-sm h-10 border-primary/20" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="px-6">Supplier Details</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead>Contact Info</TableHead>
                <TableHead className="text-right px-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.length > 0 ? (
                filteredSuppliers.map((supplier) => (
                  <TableRow key={supplier.id} className="hover:bg-muted/5 group">
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-primary">{supplier.name}</span>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[200px]">{supplier.address}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="rounded-sm font-mono text-[10px] uppercase font-bold tracking-wider">
                        {supplier.gstin}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-xs">
                          <Smartphone className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{supplier.mobile}</span>
                        </div>
                        {supplier.email && (
                          <div className="flex items-center gap-2 text-xs">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">{supplier.email}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => setSupplierToEdit(supplier)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => handleDelete(supplier.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">
                    {searchTerm ? `No suppliers matching "${searchTerm}"` : "No registered suppliers found. Click 'Add New Supplier' to start."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="rounded-sm max-w-lg">
          <DialogHeader>
            <DialogTitle>Register New Supplier</DialogTitle>
            <DialogDescription>Input business details for the new material supplier.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onAddSubmit)} className="space-y-4 py-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input placeholder="Legal name of business" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="gstin" render={({ field }) => (
                  <FormItem><FormLabel>GSTIN</FormLabel><FormControl><Input placeholder="15 Digit GST Number" {...field} className="rounded-sm font-mono uppercase" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="mobile" render={({ field }) => (
                  <FormItem><FormLabel>Mobile Number</FormLabel><FormControl><Input placeholder="10 Digit Number" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email Address (Optional)</FormLabel><FormControl><Input placeholder="billing@supplier.com" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem><FormLabel>Business Address</FormLabel><FormControl><Input placeholder="Street, City, State, ZIP" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter className="pt-4 border-t">
                <DialogClose asChild><Button variant="outline" className="rounded-sm font-bold">Cancel</Button></DialogClose>
                <Button type="submit" className="rounded-sm font-bold px-8">Save Supplier</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!supplierToEdit} onOpenChange={(o) => !o && setSupplierToEdit(null)}>
        <DialogContent className="rounded-sm max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Supplier Details</DialogTitle>
            <DialogDescription>Update the registered information for {supplierToEdit?.name}.</DialogDescription>
          </DialogHeader>
          {supplierToEdit && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4 py-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} className="rounded-sm" defaultValue={supplierToEdit.name} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="gstin" render={({ field }) => (
                    <FormItem><FormLabel>GSTIN</FormLabel><FormControl><Input {...field} className="rounded-sm font-mono uppercase" defaultValue={supplierToEdit.gstin} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="mobile" render={({ field }) => (
                    <FormItem><FormLabel>Mobile Number</FormLabel><FormControl><Input {...field} className="rounded-sm" defaultValue={supplierToEdit.mobile} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input {...field} className="rounded-sm" defaultValue={supplierToEdit.email} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem><FormLabel>Business Address</FormLabel><FormControl><Input {...field} className="rounded-sm" defaultValue={supplierToEdit.address} /></FormControl><FormMessage /></FormItem>
                )} />
                <DialogFooter className="pt-4 border-t">
                  <DialogClose asChild><Button variant="outline" className="rounded-sm font-bold">Cancel</Button></DialogClose>
                  <Button type="submit" className="rounded-sm font-bold px-8">Save Changes</Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
