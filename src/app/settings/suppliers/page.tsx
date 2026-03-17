'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { Trash2, Search, Plus, Pencil, Loader2, Truck, Mail, Smartphone, MapPin, Hash, CheckCircle2, FileDown, FileUp, AlertCircle, ArrowLeft, MoreHorizontal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { isSuperAdmin } from '@/lib/auth-constants';
import { cn } from '@/lib/utils';

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
  name: z.string().min(1, 'Company Name is required.'),
  gstin: z.string().optional().or(z.literal('')).refine(val => !val || val.length === 15, "GSTIN must be exactly 15 characters if provided."),
  address: z.string().optional().or(z.literal('')),
  mobile: z.string().optional().or(z.literal('')),
  email: z.string().email('Invalid email address.').optional().or(z.literal('')),
});

export default function SuppliersManagementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [supplierToEdit, setSupplierToEdit] = React.useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isImporting, setIsImporting] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
      (s.gstin || "").toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [suppliers, searchTerm]);

  const form = useForm<z.infer<typeof supplierSchema>>({
    resolver: zodResolver(supplierSchema),
    defaultValues: { name: '', gstin: '', address: '', mobile: '', email: '' },
  });

  // Sync form values when editing or resetting
  React.useEffect(() => {
    if (supplierToEdit) {
      form.reset({
        name: supplierToEdit.name,
        gstin: supplierToEdit.gstin || '',
        address: supplierToEdit.address || '',
        mobile: supplierToEdit.mobile || '',
        email: supplierToEdit.email || '',
      });
    } else if (!isAddDialogOpen) {
      form.reset({ name: '', gstin: '', address: '', mobile: '', email: '' });
    }
  }, [supplierToEdit, isAddDialogOpen, form]);

  const checkGstinUnique = async (gstin: string, currentId?: string) => {
    if (!gstin) return true;
    const q = query(collection(firestore, 'suppliers'), where('gstin', '==', gstin.toUpperCase()));
    const snap = await getDocs(q);
    const others = snap.docs.filter(d => d.id !== currentId);
    return others.length === 0;
  };

  const onAddSubmit = async (values: z.infer<typeof supplierSchema>) => {
    setIsSubmitting(true);
    try {
      if (values.gstin) {
        const isUnique = await checkGstinUnique(values.gstin);
        if (!isUnique) {
          form.setError('gstin', { type: 'manual', message: 'This GSTIN is already registered to another supplier.' });
          setIsSubmitting(false);
          return;
        }
      }

      addDocumentNonBlocking(collection(firestore, 'suppliers'), {
        ...values,
        gstin: values.gstin?.toUpperCase() || "",
        createdAt: serverTimestamp(),
      });
      toast({ title: 'Supplier Added', description: `${values.name} has been added to the registry.` });
      form.reset();
      setIsAddDialogOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onEditSubmit = async (values: z.infer<typeof supplierSchema>) => {
    if (!supplierToEdit) return;
    setIsSubmitting(true);
    try {
      if (values.gstin) {
        const isUnique = await checkGstinUnique(values.gstin, supplierToEdit.id);
        if (!isUnique) {
          form.setError('gstin', { type: 'manual', message: 'This GSTIN is already registered to another supplier.' });
          setIsSubmitting(false);
          return;
        }
      }

      updateDocumentNonBlocking(doc(firestore, 'suppliers', supplierToEdit.id), {
        ...values,
        gstin: values.gstin?.toUpperCase() || ""
      });
      toast({ title: 'Supplier Updated', description: 'Record has been successfully modified.' });
      setSupplierToEdit(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'suppliers', id));
    toast({ title: 'Supplier Removed' });
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { 
        'Name': 'Sample Supplier Ltd', 
        'GSTIN': '27AAAAA0000A1Z5', 
        'Mobile': '9876543210', 
        'Address': '123 Solar Street, Pune, Maharashtra', 
        'Email': 'info@samplesolar.com' 
      }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Supplier_Import_Template.xlsx");
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (json.length === 0) {
          toast({ variant: 'destructive', title: 'Import Failed', description: 'The file is empty.' });
          return;
        }

        const batch = writeBatch(firestore);
        let count = 0;
        let errors = 0;

        for (const row of json) {
          const name = row['Name'] || row['name'];
          const gstin = row['GSTIN'] || row['gstin'];
          const mobile = row['Mobile'] || row['mobile'];
          const address = row['Address'] || row['address'];
          const email = row['Email'] || row['email'];
          
          if (name) {
            const cleanGstin = String(gstin || '').trim().toUpperCase();
            if (cleanGstin && cleanGstin.length !== 15) {
              errors++;
              continue;
            }

            const newDocRef = doc(collection(firestore, 'suppliers'));
            batch.set(newDocRef, {
              name: String(name).trim(),
              gstin: cleanGstin,
              mobile: String(mobile || '').trim(),
              address: String(address || '').trim(),
              email: String(email || '').trim(),
              createdAt: serverTimestamp(),
            });
            count++;
          } else {
            errors++;
          }
        }

        if (count > 0) {
          await batch.commit();
          toast({ 
            variant: 'success', 
            title: 'Import Successful', 
            description: `Successfully imported ${count} suppliers. ${errors > 0 ? `${errors} rows were invalid or skipped.` : ''}` 
          });
        } else {
          toast({ variant: 'destructive', title: 'Import Failed', description: 'No valid data rows found in the file.' });
        }
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'Import Error', description: err.message });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
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
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Button variant="ghost" size="sm" onClick={() => router.push('/settings')} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings
          </Button>
          <h1 className="flex items-center gap-2 text-primary">
            <Truck className="h-6 w-6 md:h-8 md:w-8" /> Supplier Registry
          </h1>
          <p className="text-muted-foreground text-sm font-medium">Manage organizational material suppliers. Only Company Name is mandatory.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="flex-1 md:flex-initial h-10 rounded-sm font-bold border-primary/20 text-primary hover:bg-primary/5">
            <FileDown className="mr-2 h-4 w-4" /> Template
          </Button>
          <div className="relative flex-1 md:flex-initial">
            <input 
              type="file" 
              accept=".xlsx,.xls,.csv" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleBulkImport} 
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="w-full h-10 rounded-sm font-bold border-primary/20 text-primary hover:bg-primary/5">
              {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
              Bulk Import
            </Button>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} className="w-full md:w-auto h-10 rounded-sm font-bold shadow-md">
            <Plus className="mr-2 h-4 w-4" /> Add New Supplier
          </Button>
        </div>
      </div>

      <Card className="rounded-sm shadow-sm overflow-hidden border-primary/10">
        <CardHeader className="bg-muted/5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 md:p-6">
          <div className="space-y-1">
            <CardTitle className="text-base md:text-lg">Suppliers Database</CardTitle>
            <CardDescription className="text-xs">Comprehensive list of all registered business partners.</CardDescription>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name or GSTIN..." 
              className="pl-8 h-10 rounded-sm border-primary/20 text-sm bg-background" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-border/50">
            {filteredSuppliers.length > 0 ? filteredSuppliers.map((supplier) => (
              <div key={supplier.id} className="p-4 space-y-4 bg-card hover:bg-muted/5 transition-colors">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <h3 className="font-bold text-sm text-primary leading-tight truncate">{supplier.name}</h3>
                    {supplier.gstin ? (
                      <Badge variant="secondary" className="w-fit rounded-sm font-mono text-[10px] uppercase font-bold tracking-wider px-1.5 h-5">
                        {supplier.gstin}
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground italic font-medium">No GSTIN recorded</span>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setSupplierToEdit(supplier)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(supplier.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/60" />
                    <span className="leading-relaxed line-clamp-2">{supplier.address || "Address not provided"}</span>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    <div className="flex items-center gap-2.5 text-xs font-semibold text-foreground">
                      <Smartphone className="h-3.5 w-3.5 text-primary/60" />
                      <span>{supplier.mobile || "Phone not available"}</span>
                    </div>
                    {supplier.email && (
                      <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 text-primary/60" />
                        <span className="truncate">{supplier.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )) : (
              <div className="p-12 text-center text-muted-foreground italic text-sm">
                No matching suppliers found.
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
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
                            <span className="truncate max-w-[200px]" title={supplier.address}>{supplier.address || "No address recorded"}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {supplier.gstin ? (
                          <Badge variant="secondary" className="rounded-sm font-mono text-[10px] uppercase font-bold tracking-wider">
                            {supplier.gstin}
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">No GSTIN</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-xs">
                            <Smartphone className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{supplier.mobile || "—"}</span>
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
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm hover:bg-primary/10" onClick={() => setSupplierToEdit(supplier)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm hover:bg-destructive/10" onClick={() => handleDelete(supplier.id)}>
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
          </div>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-sm p-0 overflow-hidden border-none shadow-2xl bg-background">
          <DialogHeader className="p-6 bg-primary/5 border-b">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Register New Supplier</DialogTitle>
            <DialogDescription className="text-xs font-medium">Input business details for the new material supplier.</DialogDescription>
          </DialogHeader>
          <div className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onAddSubmit)} className="space-y-5">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Company Name</FormLabel>
                    <FormControl><Input placeholder="Legal name of business" {...field} className="h-11 rounded-sm focus-visible:ring-primary/20" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="gstin" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">GSTIN (Optional)</FormLabel>
                      <FormControl><Input placeholder="15 Digit GST Number" {...field} className="h-11 rounded-sm font-mono uppercase focus-visible:ring-primary/20" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="mobile" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mobile Number (Optional)</FormLabel>
                      <FormControl><Input placeholder="10 Digit Number" {...field} className="h-11 rounded-sm focus-visible:ring-primary/20" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email Address (Optional)</FormLabel>
                    <FormControl><Input placeholder="billing@supplier.com" {...field} className="h-11 rounded-sm focus-visible:ring-primary/20" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Business Address (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="Street, City, State, ZIP" {...field} className="rounded-sm focus-visible:ring-primary/20 min-h-[80px]" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <DialogFooter className="pt-4 border-t gap-2 flex flex-col sm:flex-row">
                  <DialogClose asChild><Button variant="outline" className="flex-1 h-11 rounded-sm font-bold uppercase text-[10px] tracking-widest">Cancel</Button></DialogClose>
                  <Button type="submit" className="flex-1 h-11 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-lg" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Supplier"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!supplierToEdit} onOpenChange={(o) => !o && setSupplierToEdit(null)}>
        <DialogContent className="sm:max-w-lg rounded-sm p-0 overflow-hidden border-none shadow-2xl bg-background">
          <DialogHeader className="p-6 bg-primary/5 border-b">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Edit Supplier Details</DialogTitle>
            <DialogDescription className="text-xs font-medium">Update the registered information for {supplierToEdit?.name}.</DialogDescription>
          </DialogHeader>
          {supplierToEdit && (
            <div className="p-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-5">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Company Name</FormLabel>
                      <FormControl><Input {...field} className="h-11 rounded-sm focus-visible:ring-primary/20" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="gstin" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">GSTIN (Optional)</FormLabel>
                        <FormControl><Input {...field} className="h-11 rounded-sm font-mono uppercase focus-visible:ring-primary/20" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="mobile" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mobile Number (Optional)</FormLabel>
                        <FormControl><Input {...field} className="h-11 rounded-sm focus-visible:ring-primary/20" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email Address (Optional)</FormLabel>
                      <FormControl><Input {...field} className="h-11 rounded-sm focus-visible:ring-primary/20" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Business Address (Optional)</FormLabel>
                      <FormControl><Textarea rows={3} {...field} className="rounded-sm focus-visible:ring-primary/20" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <DialogFooter className="pt-4 border-t gap-2 flex flex-col sm:flex-row">
                    <DialogClose asChild><Button variant="outline" className="flex-1 h-11 rounded-sm font-bold uppercase text-[10px] tracking-widest">Cancel</Button></DialogClose>
                    <Button type="submit" className="flex-1 h-11 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-lg" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Changes"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
