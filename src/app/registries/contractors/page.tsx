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
import { 
  useCollection, 
  useFirestore, 
  useUser, 
  useDoc, 
  useMemoFirebase, 
  addDocumentNonBlocking, 
  deleteDocumentNonBlocking, 
  updateDocumentNonBlocking 
} from '@/firebase';
import { collection, doc, serverTimestamp, writeBatch, query, where, getDocs, orderBy } from 'firebase/firestore';
import { 
  Trash2, 
  Search, 
  Plus, 
  Pencil, 
  Loader2, 
  HardHat, 
  Smartphone, 
  MapPin, 
  FileDown, 
  FileUp, 
  ArrowLeft, 
  Settings2,
  Check,
  ChevronDown,
  Building2,
  Wallet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter, 
  DialogClose 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { isSuperAdmin } from '@/lib/auth-constants';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';

type Contractor = {
  id: string;
  name: string;
  role: string;
  bankingDetails?: string;
  gstin: string;
  address: string;
  mobile: string;
  email: string;
  createdAt: any;
};

type ContractorRole = {
  id: string;
  name: string;
};

type SortKey = 'name' | 'role' | 'gstin';

const contractorSchema = z.object({
  name: z.string().min(1, 'Company Name is required.'),
  role: z.string().min(1, 'Contractor Role is required.'),
  bankingDetails: z.string().optional().or(z.literal('')),
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
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  
  // Role Management State
  const [isManageRolesOpen, setIsManageRolesOpen] = React.useState(false);
  const [newRoleName, setNewGroupName] = React.useState("");
  const [isSavingRole, setIsSavingRole] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const contractorsQuery = useMemoFirebase(() => collection(firestore, 'contractors'), [firestore]);
  const { data: contractors, isLoading: contractorsLoading } = useCollection<Contractor>(contractorsQuery);

  const rolesQuery = useMemoFirebase(() => query(collection(firestore, 'contractor_roles'), orderBy('name', 'asc')), [firestore]);
  const { data: contractorRoles, isLoading: rolesLoading } = useCollection<ContractorRole>(rolesQuery);

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

  const filteredContractors = React.useMemo(() => {
    if (!contractors) return [];
    let result = contractors.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.gstin || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.role || "").toLowerCase().includes(searchTerm.toLowerCase())
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
  }, [contractors, searchTerm, sortConfig]);

  const form = useForm<z.infer<typeof contractorSchema>>({
    resolver: zodResolver(contractorSchema),
    defaultValues: { name: '', role: '', bankingDetails: '', gstin: '', address: '', mobile: '', email: '' },
  });

  React.useEffect(() => {
    if (contractorToEdit) {
      form.reset({
        name: contractorToEdit.name,
        role: contractorToEdit.role || '',
        bankingDetails: contractorToEdit.bankingDetails || '',
        gstin: contractorToEdit.gstin || '',
        address: contractorToEdit.address || '',
        mobile: contractorToEdit.mobile || '',
        email: contractorToEdit.email || '',
      });
    } else if (!isAddDialogOpen) {
      form.reset({ name: '', role: '', bankingDetails: '', gstin: '', address: '', mobile: '', email: '' });
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

  const handleSaveRole = async () => {
    if (!newRoleName.trim()) return;
    setIsSavingRole(true);
    try {
      await addDocumentNonBlocking(collection(firestore, 'contractor_roles'), {
        name: newRoleName.trim()
      });
      toast({ title: 'Role Added', description: `"${newRoleName}" is now available in selections.` });
      setNewGroupName("");
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleDeleteRole = async (id: string) => {
    try {
      deleteDocumentNonBlocking(doc(firestore, 'contractor_roles', id));
      toast({ title: 'Role Removed' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const handleDelete = (id: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'contractors', id));
    toast({ title: 'Contractor Removed' });
  };

  const handleExport = () => {
    if (filteredContractors.length === 0) return;
    const exportData = filteredContractors.map(c => ({
      'Name': c.name,
      'Role': c.role || '—',
      'GSTIN': c.gstin || '—',
      'Mobile': c.mobile || '—',
      'Email': c.email || '—',
      'Address': c.address || '—',
      'Banking Details': c.bankingDetails || '—'
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contractors");
    XLSX.writeFile(wb, `Contractors_Registry_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const handleDownloadTemplate = () => {
    const wsData = [
      ["Company Name", "Role", "Banking Details", "GSTIN", "Address", "Mobile", "Email"],
      ["A1 Infrastructure", "Civil Contractor", "State Bank of India, A/c: 12345678, IFSC: SBIN000123", "27AAAAA0000A1Z5", "123 Solar Street, Mumbai", "9876543210", "contact@a1infra.com"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ContractorTemplate");
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
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet) as any[];

        if (jsonData.length === 0) {
          toast({ variant: "destructive", title: "Import Failed", description: "The uploaded file contains no data." });
          return;
        }

        const batch = writeBatch(firestore);
        let count = 0;

        for (const row of jsonData) {
          const name = row["Company Name"] || row["name"];
          const role = row["Role"] || row["role"];
          
          if (name && role) {
            const newDocRef = doc(collection(firestore, 'contractors'));
            batch.set(newDocRef, {
              name: String(name).trim(),
              role: String(role).trim(),
              bankingDetails: String(row["Banking Details"] || "").trim(),
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
          toast({ title: "Import Success", description: `Successfully added ${count} contractors to the registry.` });
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

  if (isUserLoading || isProfileLoading || contractorsLoading || rolesLoading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;
  }

  return (
    <div className="space-y-6 md:space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-primary">
            <HardHat className="h-6 w-6 md:h-8 md:w-8" /> Contractor Registry
          </h1>
          <p className="text-muted-foreground text-sm font-medium">Manage corporate service partners and labor contractors.</p>
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
          <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredContractors.length === 0} className="h-10 rounded-sm font-bold border-primary/20 text-primary hover:bg-primary/5">
            <FileDown className="mr-2 h-4 w-4" /> Export List
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)} className="h-10 rounded-sm font-bold shadow-md px-6">
            <Plus className="mr-2 h-4 w-4" /> Add Contractor
          </Button>
        </div>
      </div>

      <Card className="rounded-sm shadow-sm overflow-hidden border-primary/10">
        <CardHeader className="bg-muted/5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 md:p-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base md:text-lg">Contractor Partners</CardTitle>
              <Badge variant="secondary" className="h-5 rounded-sm px-1.5 font-bold text-[10px] bg-primary/5 text-primary border-primary/10">{filteredContractors.length} Registered</Badge>
            </div>
            <CardDescription className="text-xs">Registry of authorized service providers.</CardDescription>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name, role or GSTIN..." 
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
                    <div className="flex items-center">Partner Name <SortIcon column="name" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('role')}>
                    <div className="flex items-center">Role <SortIcon column="role" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('gstin')}>
                    <div className="flex items-center">GSTIN <SortIcon column="gstin" /></div>
                  </TableHead>
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
                      <Badge variant="secondary" className="rounded-sm text-[10px] font-bold uppercase h-5 bg-primary/5 text-primary border-primary/10">{c.role || 'Unassigned'}</Badge>
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
                )) : <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">No records found.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen || !!contractorToEdit} onOpenChange={(open) => { if(!open) { setIsAddDialogOpen(false); setContractorToEdit(null); } }}>
        <DialogContent className="sm:max-w-2xl rounded-sm p-0 overflow-hidden border-none shadow-2xl bg-background max-h-[90vh] flex flex-col gap-0">
          <DialogHeader className="p-6 bg-primary/5 border-b shrink-0">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">{contractorToEdit ? 'Edit' : 'Register New'} Contractor</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(contractorToEdit ? onEditSubmit : onAddSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Partner Name</FormLabel>
                        <FormControl><Input placeholder="Legal entity name" {...field} className="h-11 rounded-sm" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="role" render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contractor Role</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-11 rounded-sm font-medium">
                              <SelectValue placeholder="Select contractor specialization..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <div className="p-1 space-y-1">
                              {contractorRoles?.map((role) => (
                                <SelectItem key={role.id} value={role.name} className="text-sm font-medium">
                                  {role.name}
                                </SelectItem>
                              ))}
                              <Separator className="my-2" />
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                className="w-full justify-start h-9 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setIsManageRolesOpen(true);
                                }}
                              >
                                <Settings2 className="h-3.5 w-3.5 mr-2" /> Manage Roles
                              </Button>
                            </div>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
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

                  <FormField control={form.control} name="bankingDetails" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Banking Details</FormLabel>
                      <FormControl><Textarea placeholder="Bank Name, A/c Number, IFSC, Branch..." rows={4} {...field} className="rounded-sm min-h-[100px] bg-muted/10 italic" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </form>
              </Form>
            </div>
          </div>
          <DialogFooter className="p-6 border-t gap-2 flex flex-col sm:flex-row shrink-0 bg-muted/5">
            <DialogClose asChild><Button variant="outline" className="flex-1 h-11 rounded-sm font-bold uppercase text-[10px]">Cancel</Button></DialogClose>
            <Button type="button" onClick={form.handleSubmit(contractorToEdit ? onEditSubmit : onAddSubmit)} className="flex-1 h-11 rounded-sm font-black uppercase text-[10px] shadow-lg" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Contractor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Management Dialog */}
      <Dialog open={isManageRolesOpen} onOpenChange={setIsManageRolesOpen}>
        <DialogContent className="sm:max-w-md rounded-sm p-0 overflow-hidden border-none shadow-2xl bg-background">
          <DialogHeader className="p-6 bg-primary/5 border-b shrink-0">
            <div className="flex items-center gap-3">
              <Settings2 className="h-5 w-5 text-primary" />
              <DialogTitle className="text-lg font-black uppercase tracking-tight">Contractor Roles</DialogTitle>
            </div>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground px-1">Add New Role</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="e.g. Civil Contractor" 
                  value={newRoleName} 
                  onChange={e => setNewGroupName(e.target.value)}
                  className="rounded-sm h-11 font-medium"
                />
                <Button onClick={handleSaveRole} disabled={isSavingRole || !newRoleName.trim()} className="rounded-sm font-black uppercase text-[10px] h-11 px-6">
                  {isSavingRole ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />} Add
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground px-1">Registered Roles</Label>
              <div className="border rounded-sm bg-muted/5 divide-y">
                <ScrollArea className="h-[200px]">
                  {contractorRoles && contractorRoles.length > 0 ? contractorRoles.map((role) => (
                    <div key={role.id} className="flex items-center justify-between p-3 hover:bg-background transition-colors group">
                      <span className="text-sm font-bold text-foreground">{role.name}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteRole(role.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )) : (
                    <div className="p-8 text-center text-xs text-muted-foreground italic opacity-40">No custom roles defined.</div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 border-t bg-muted/5">
            <DialogClose asChild><Button variant="outline" className="w-full rounded-sm font-bold uppercase text-[10px]">Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
