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
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { Trash2, Search, Plus, Pencil, Loader2, MapPin, CheckCircle2, FileDown, ArrowLeft, RefreshCcw, Tag, ArrowUpDown, ArrowUp, ArrowDown, FileUp, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { isSuperAdmin } from '@/lib/auth-constants';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type Make = {
  id: string;
  name: string;
  gstin: string;
  address: string;
  mobile: string;
  email: string;
  createdAt: any;
};

type SortKey = 'name' | 'gstin';

const makeSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  gstin: z.string().optional().or(z.literal('')).refine(val => !val || val.length === 15, "GSTIN must be exactly 15 characters if provided."),
  address: z.string().optional().or(z.literal('')),
  mobile: z.string().optional().or(z.literal('')),
  email: z.string().email('Invalid email address.').optional().or(z.literal('')),
});

export default function MakesManagementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [makeToEdit, setMakeToEdit] = React.useState<Make | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const makesQuery = useMemoFirebase(() => collection(firestore, 'makes'), [firestore]);
  const { data: makes, isLoading: makesLoading } = useCollection<Make>(makesQuery);

  const suppliersQuery = useMemoFirebase(() => collection(firestore, 'suppliers'), [firestore]);
  const { data: allSuppliers } = useCollection<any>(suppliersQuery);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3.5 w-3.5 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3.5 w-3.5 text-primary" /> : <ArrowDown className="ml-2 h-3.5 w-3.5 text-primary" />;
  };

  const filteredMakes = React.useMemo(() => {
    if (!makes) return [];
    let result = makes.filter(m => 
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.gstin || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    result.sort((a, b) => {
      const { key, direction } = sortConfig;
      let valA: any = a[key]?.toLowerCase() || '';
      let valB: any = b[key]?.toLowerCase() || '';

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [makes, searchTerm, sortConfig]);

  const form = useForm<z.infer<typeof makeSchema>>({
    resolver: zodResolver(makeSchema),
    defaultValues: { name: '', gstin: '', address: '', mobile: '', email: '' },
  });

  React.useEffect(() => {
    if (makeToEdit) {
      form.reset({
        name: makeToEdit.name,
        gstin: makeToEdit.gstin || '',
        address: makeToEdit.address || '',
        mobile: makeToEdit.mobile || '',
        email: makeToEdit.email || '',
      });
    } else if (!isAddDialogOpen) {
      form.reset({ name: '', gstin: '', address: '', mobile: '', email: '' });
    }
  }, [makeToEdit, isAddDialogOpen, form]);

  const onAddSubmit = async (values: z.infer<typeof makeSchema>) => {
    setIsSubmitting(true);
    try {
      await addDocumentNonBlocking(collection(firestore, 'makes'), {
        ...values,
        gstin: values.gstin?.toUpperCase() || "",
        createdAt: serverTimestamp(),
      });
      toast({ title: 'Make Registered', description: `${values.name} added to registry.` });
      form.reset();
      setIsAddDialogOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onEditSubmit = async (values: z.infer<typeof makeSchema>) => {
    if (!makeToEdit) return;
    setIsSubmitting(true);
    try {
      updateDocumentNonBlocking(doc(firestore, 'makes', makeToEdit.id), {
        ...values,
        gstin: values.gstin?.toUpperCase() || ""
      });
      toast({ title: 'Make Updated', description: 'Record modified successfully.' });
      setMakeToEdit(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddAsSupplier = async (make: Make) => {
    try {
      await addDocumentNonBlocking(collection(firestore, 'suppliers'), {
        name: make.name,
        gstin: make.gstin || "",
        address: make.address || "",
        mobile: make.mobile || "",
        email: make.email || "",
        createdAt: serverTimestamp(),
      });
      toast({ title: 'Cross-Linked', description: `${make.name} now registered as Supplier.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const handleDelete = (id: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'makes', id));
    toast({ title: 'Make Removed' });
  };

  const handleExport = () => {
    if (filteredMakes.length === 0) return;
    const exportData = filteredMakes.map(m => ({
      'Name': m.name,
      'GSTIN': m.gstin || '—',
      'Address': m.address || '—',
      'Mobile': m.mobile || '—',
      'Email': m.email || '—'
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Makes");
    XLSX.writeFile(wb, `Makes_Registry_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const handleDownloadTemplate = () => {
    const wsData = [
      ["Brand Name", "GSTIN", "Address", "Mobile", "Email"],
      ["Tata Power Solar", "27AAAAA0000A1Z5", "123 Energy Park, Bangalore", "9876543210", "info@tatasolar.com"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MakeTemplate");
    XLSX.writeFile(wb, "Make_Import_Template.xlsx");
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
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet) as any[];

        if (jsonData.length === 0) {
          toast({ variant: "destructive", title: "Import Failed", description: "The uploaded file contains no data." });
          return;
        }

        const batch = writeBatch(firestore);
        let count = 0;

        for (const row of jsonData) {
          const name = row["Brand Name"] || row["name"];
          if (name) {
            const newDocRef = doc(collection(firestore, 'makes'));
            batch.set(newDocRef, {
              name: String(name).trim(),
              gstin: String(row["GSTIN"] || "").trim().toUpperCase(),
              address: String(row["Address"] || "").trim(),
              mobile: String(row["Mobile"] || "").trim(),
              email: String(row["Email"] || "").trim(),
              createdAt: serverTimestamp()
            });
            count++;
          }
        }

        if (count > 0) {
          await batch.commit();
          toast({ title: "Import Success", description: `Successfully added ${count} brands to the registry.` });
        } else {
          toast({ variant: "destructive", title: "Import Failed", description: "No valid rows found." });
        }
      } catch (err: any) {
        toast({ variant: "destructive", title: "Import Error", description: err.message });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  if (isUserLoading || isProfileLoading || makesLoading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;
  }

  return (
    <div className="space-y-6 md:space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-primary">
            <Tag className="h-6 w-6 md:h-8 md:w-8" /> Makes / Brands Registry
          </h1>
          <p className="text-muted-foreground text-sm font-medium">Manage manufacturing brands and brands associated with site inventory.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="h-10 rounded-sm font-bold border-primary/20 text-primary hover:bg-primary/5">
            <Download className="mr-2 h-4 w-4" /> Template
          </Button>
          <div className="relative">
            <input 
              type="file" 
              accept=".xlsx,.xls,.csv" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleBulkImport} 
              disabled={isImporting}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="h-10 rounded-sm font-bold border-primary/20 text-primary hover:bg-primary/5">
              {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
              Bulk Import
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredMakes.length === 0} className="h-10 rounded-sm font-bold border-primary/20 text-primary">
            <FileDown className="mr-2 h-4 w-4" /> Export List
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)} className="h-10 rounded-sm font-bold shadow-md">
            <Plus className="mr-2 h-4 w-4" /> Add New Make
          </Button>
        </div>
      </div>

      <Card className="rounded-sm shadow-sm overflow-hidden border-primary/10">
        <CardHeader className="bg-muted/5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 md:p-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base md:text-lg uppercase font-black">Authorized Makes</CardTitle>
              <Badge variant="secondary" className="h-5 rounded-sm px-1.5 font-bold text-[10px] bg-primary/5 text-primary border-primary/10">{filteredMakes.length} Registered</Badge>
            </div>
            <CardDescription className="text-xs">Brands registered for BoM mapping.</CardDescription>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search make or GSTIN..." 
              className="pl-8 h-10 rounded-sm border-primary/20 text-sm bg-background" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('name')}>
                    <div className="flex items-center">Brand Name <SortIcon column="name" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('gstin')}>
                    <div className="flex items-center">GSTIN <SortIcon column="gstin" /></div>
                  </TableHead>
                  <TableHead>Linked Identity</TableHead>
                  <TableHead className="text-right px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMakes.length > 0 ? filteredMakes.map((m) => {
                  const isAlreadySupplier = allSuppliers?.some((s: any) => s.name.toLowerCase() === m.name.toLowerCase());
                  return (
                    <TableRow key={m.id} className="hover:bg-muted/5 group">
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-primary">{m.name}</span>
                          <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" /> {m.address || "No address"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-sm font-mono text-[10px] uppercase font-bold tracking-wider px-1.5 h-5">{m.gstin || '—'}</Badge>
                      </TableCell>
                      <TableCell>
                        {!isAlreadySupplier && (
                          <Button variant="outline" size="sm" onClick={() => handleAddAsSupplier(m)} className="h-7 text-[9px] font-black uppercase border-primary/20 text-primary hover:bg-primary/5 rounded-sm">
                            <RefreshCcw className="h-3 w-3 mr-1" /> Add as Supplier
                          </Button>
                        )}
                        {isAlreadySupplier && (
                          <Badge variant="outline" className="h-6 rounded-sm bg-green-50 text-green-700 border-green-200 text-[9px] uppercase font-black">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Also Supplier
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm hover:bg-primary/10" onClick={() => setMakeToEdit(m)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm hover:bg-red-50" onClick={() => handleDelete(m.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">No makes registered.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen || !!makeToEdit} onOpenChange={(open) => { if(!open) { setIsAddDialogOpen(false); setMakeToEdit(null); } }}>
        <DialogContent className="sm:max-w-lg rounded-sm p-0 overflow-hidden border-none shadow-2xl bg-background">
          <DialogHeader className="p-6 bg-primary/5 border-b">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">{makeToEdit ? 'Edit' : 'Register New'} Make</DialogTitle>
          </DialogHeader>
          <div className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(makeToEdit ? onEditSubmit : onAddSubmit)} className="space-y-5">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Brand / Make Name</FormLabel><FormControl><Input placeholder="Legal name" {...field} className="h-11 rounded-sm" /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="gstin" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">GSTIN</FormLabel><FormControl><Input placeholder="15 Digit" {...field} className="h-11 font-mono uppercase rounded-sm" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="mobile" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mobile</FormLabel><FormControl><Input placeholder="Contact" {...field} className="h-11 rounded-sm" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email</FormLabel><FormControl><Input placeholder="m@brand.com" {...field} className="h-11 rounded-sm" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Address</FormLabel><FormControl><Textarea placeholder="Full address..." {...field} className="rounded-sm min-h-[80px]" /></FormControl><FormMessage /></FormItem>
                )} />
                <DialogFooter className="pt-4 border-t gap-2">
                  <DialogClose asChild><Button variant="outline" className="flex-1 h-11 rounded-sm font-bold uppercase text-[10px]">Cancel</Button></DialogClose>
                  <Button type="submit" className="flex-1 h-11 rounded-sm font-black uppercase text-[10px] shadow-lg" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Make"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
