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
import { collection, doc, serverTimestamp, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { Trash2, Search, Plus, Pencil, Loader2, HardHat, Mail, Smartphone, MapPin, Hash, CheckCircle2, FileDown, FileUp, AlertCircle, ArrowLeft, MoreHorizontal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { isSuperAdmin } from '@/lib/auth-constants';
import { cn } from '@/lib/utils';

type Contractor = {
  id: string;
  name: string;
  gstin: string;
  address: string;
  mobile: string;
  email: string;
  createdAt: any;
};

const contractorSchema = z.object({
  name: z.string().min(1, 'Company Name is required.'),
  gstin: z.string().optional().or(z.literal('')).refine(val => !val || val.length === 15, "GSTIN must be exactly 15 characters if provided."),
  address: z.string().optional().or(z.literal('')),
  mobile: z.string().optional().or(z.literal('')),
  email: z.string().email('Invalid email address.').optional().or(z.literal('')),
});

export default function ContractorsManagementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [contractorToEdit, setContractorToEdit] = React.useState<Contractor | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isImporting, setIsImporting] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const contractorsQuery = useMemoFirebase(() => collection(firestore, 'contractors'), [firestore]);
  const { data: contractors, isLoading: contractorsLoading } = useCollection<Contractor>(contractorsQuery);

  const filteredContractors = React.useMemo(() => {
    if (!contractors) return [];
    return contractors.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.gstin || "").toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [contractors, searchTerm]);

  const form = useForm<z.infer<typeof contractorSchema>>({
    resolver: zodResolver(contractorSchema),
    defaultValues: { name: '', gstin: '', address: '', mobile: '', email: '' },
  });

  React.useEffect(() => {
    if (contractorToEdit) {
      form.reset({
        name: contractorToEdit.name,
        gstin: contractorToEdit.gstin || '',
        address: contractorToEdit.address || '',
        mobile: contractorToEdit.mobile || '',
        email: contractorToEdit.email || '',
      });
    } else if (!isAddDialogOpen) {
      form.reset({ name: '', gstin: '', address: '', mobile: '', email: '' });
    }
  }, [contractorToEdit, isAddDialogOpen, form]);

  const onAddSubmit = async (values: z.infer<typeof contractorSchema>) => {
    setIsSubmitting(true);
    try {
      addDocumentNonBlocking(collection(firestore, 'contractors'), {
        ...values,
        gstin: values.gstin?.toUpperCase() || "",
        createdAt: serverTimestamp(),
      });
      toast({ title: 'Contractor Added', description: `${values.name} has been added to the registry.` });
      form.reset();
      setIsAddDialogOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onEditSubmit = async (values: z.infer<typeof contractorSchema>) => {
    if (!contractorToEdit) return;
    setIsSubmitting(true);
    try {
      updateDocumentNonBlocking(doc(firestore, 'contractors', contractorToEdit.id), {
        ...values,
        gstin: values.gstin?.toUpperCase() || ""
      });
      toast({ title: 'Contractor Updated', description: 'Record has been successfully modified.' });
      setContractorToEdit(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'contractors', id));
    toast({ title: 'Contractor Removed' });
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { 
        'Name': 'Sample Contractor Pvt Ltd', 
        'GSTIN': '27BBBBB0000B1Z5', 
        'Mobile': '9876543210', 
        'Address': '456 Service Lane, Mumbai, MH', 
        'Email': 'ops@samplecontractor.com' 
      }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Contractor_Import_Template.xlsx");
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

        for (const row of json) {
          const name = row['Name'] || row['name'];
          if (name) {
            const newDocRef = doc(collection(firestore, 'contractors'));
            batch.set(newDocRef, {
              name: String(name).trim(),
              gstin: String(row['GSTIN'] || row['gstin'] || '').trim().toUpperCase(),
              mobile: String(row['Mobile'] || row['mobile'] || '').trim(),
              address: String(row['Address'] || row['address'] || '').trim(),
              email: String(row['Email'] || row['email'] || '').trim(),
              createdAt: serverTimestamp(),
            });
            count++;
          }
        }

        if (count > 0) {
          await batch.commit();
          toast({ title: 'Import Successful', description: `Successfully imported ${count} contractors.` });
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

  if (isUserLoading || isProfileLoading || contractorsLoading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-primary">
            <HardHat className="h-6 w-6 md:h-8 md:w-8" /> Contractor Registry
          </h1>
          <p className="text-muted-foreground text-sm font-medium">Manage corporate service partners and labor contractors.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="h-10 rounded-sm font-bold border-primary/20 text-primary">
            <FileDown className="mr-2 h-4 w-4" /> Template
          </Button>
          <div className="relative">
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" ref={fileInputRef} onChange={handleBulkImport} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="h-10 rounded-sm font-bold border-primary/20 text-primary">
              {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />} Bulk Import
            </Button>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} className="h-10 rounded-sm font-bold shadow-md">
            <Plus className="mr-2 h-4 w-4" /> Add Contractor
          </Button>
        </div>
      </div>

      <Card className="rounded-sm shadow-sm overflow-hidden border-primary/10">
        <CardHeader className="bg-muted/5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 md:p-6">
          <div className="space-y-1">
            <CardTitle className="text-base md:text-lg">Contractor Partners</CardTitle>
            <CardDescription className="text-xs">Registry of authorized service providers.</CardDescription>
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="px-6">Partner Name</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>Communication</TableHead>
                  <TableHead className="text-right px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContractors.length > 0 ? filteredContractors.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/5 group">
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-primary">{c.name}</span>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[200px]">{c.address || "Address not recorded"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="rounded-sm font-mono text-[10px] uppercase font-bold tracking-wider px-1.5 h-5">{c.gstin || '—'}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-xs">
                          <Smartphone className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{c.mobile || "—"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm hover:bg-primary/10" onClick={() => setContractorToEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm hover:bg-red-50" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">No records found.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen || !!contractorToEdit} onOpenChange={(open) => { if(!open) { setIsAddDialogOpen(false); setContractorToEdit(null); } }}>
        <DialogContent className="sm:max-w-lg rounded-sm p-0 overflow-hidden border-none shadow-2xl bg-background">
          <DialogHeader className="p-6 bg-primary/5 border-b">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">{contractorToEdit ? 'Edit' : 'Register New'} Contractor</DialogTitle>
          </DialogHeader>
          <div className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(contractorToEdit ? onEditSubmit : onAddSubmit)} className="space-y-5">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Partner Name</FormLabel><FormControl><Input placeholder="Legal entity name" {...field} className="h-11 rounded-sm" /></FormControl><FormMessage /></FormItem>
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
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email</FormLabel><FormControl><Input placeholder="contact@partner.com" {...field} className="h-11 rounded-sm" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Address</FormLabel><FormControl><Textarea placeholder="Full address..." {...field} className="rounded-sm min-h-[80px]" /></FormControl><FormMessage /></FormItem>
                )} />
                <DialogFooter className="pt-4 border-t gap-2">
                  <DialogClose asChild><Button variant="outline" className="flex-1 h-11 rounded-sm font-bold uppercase text-[10px]">Cancel</Button></DialogClose>
                  <Button type="submit" className="flex-1 h-11 rounded-sm font-black uppercase text-[10px] shadow-lg" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Contractor"}
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
