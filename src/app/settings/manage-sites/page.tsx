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
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Trash2, Search, MapPin, Plus, FileDown, FileUp, Download, Check, ListFilter, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { isSuperAdmin } from '@/lib/auth-constants';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const siteSchema = z.object({
  name: z.string().min(1, 'Site name is required.'),
  projectCompany: z.string().min(1, 'Project company is required.'),
  acCapacity: z.string().min(1, 'AC capacity is required.'),
  dcCapacity: z.string().min(1, 'DC capacity is required.'),
});

type SortOrder = 'name' | 'newest' | 'oldest';

export default function ManageSitesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState<SortOrder>('name');
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = React.useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = React.useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  React.useEffect(() => {
    if (!isUserLoading && !isProfileLoading && !isAdmin) {
      router.replace('/reports');
    }
  }, [isUserLoading, isProfileLoading, isAdmin, router]);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: sites, isLoading: sitesLoading } = useCollection<any>(sitesQuery);

  const siteForm = useForm<z.infer<typeof siteSchema>>({
    resolver: zodResolver(siteSchema),
    defaultValues: { name: '', projectCompany: '', acCapacity: '', dcCapacity: '' },
  });

  const onSiteSubmit = (values: z.infer<typeof siteSchema>) => {
    addDocumentNonBlocking(collection(firestore, 'sites'), {
      ...values,
      createdAt: serverTimestamp()
    });
    toast({ title: 'Success', description: 'New Site added.' });
    siteForm.reset();
    setIsAddDialogOpen(false);
  };

  const deleteSite = (id: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'sites', id));
    toast({ title: 'Success', description: 'Site deleted.' });
    setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsDeletingBulk(true);
    
    try {
      const batchSize = 400;
      for (let i = 0; i < selectedIds.length; i += batchSize) {
        const batch = writeBatch(firestore);
        const chunk = selectedIds.slice(i, i + batchSize);
        chunk.forEach(id => {
          batch.delete(doc(firestore, 'sites', id));
        });
        await batch.commit();
      }
      
      toast({ 
        title: 'Bulk Action Complete', 
        description: `Successfully removed ${selectedIds.length} site records from the registry.` 
      });
      setSelectedIds([]);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
    } finally {
      setIsDeletingBulk(false);
      setIsBulkDialogOpen(false);
    }
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { 'Site Name': 'Sample Site A', 'Project Company': 'ABC Energies', 'AC Capacity': '5.000', 'DC Capacity': '6.250' }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "AdityaPro_Site_Import_Template.xlsx");
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

        let count = 0;
        const batchSize = 400;
        
        for (let i = 0; i < json.length; i += batchSize) {
          const batch = writeBatch(firestore);
          const chunk = json.slice(i, i + batchSize);
          
          chunk.forEach((row) => {
            const name = row['Site Name'] || row['name'] || row['Name'];
            const company = row['Project Company'] || row['projectCompany'] || row['Company'];
            const ac = row['AC Capacity'] || row['acCapacity'] || row['AC'];
            const dc = row['DC Capacity'] || row['dcCapacity'] || row['DC'];

            if (name && company) {
              const newDocRef = doc(collection(firestore, 'sites'));
              batch.set(newDocRef, {
                name: String(name),
                projectCompany: String(company),
                acCapacity: String(ac || "0"),
                dcCapacity: String(dc || "0"),
                createdAt: serverTimestamp(),
              });
              count++;
            }
          });
          
          await batch.commit();
        }

        toast({ variant: 'success', title: 'Import Successful', description: `Successfully imported ${count} sites.` });
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'Import Error', description: err.message });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExportRegistry = () => {
    if (!sites || sites.length === 0) return;
    
    const worksheet = XLSX.utils.json_to_sheet(sites.map(s => ({
      'Site Name': s.name,
      'Project Company': s.projectCompany,
      'AC Capacity': s.acCapacity,
      'DC Capacity': s.dcCapacity,
      'Date Added': s.createdAt ? format(s.createdAt.toDate(), 'dd/MM/yyyy HH:mm') : 'N/A'
    })));
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sites");
    XLSX.writeFile(workbook, "AdityaPro_SiteRegistry.xlsx");
  };

  const filteredSitesList = React.useMemo(() => {
    if (!sites) return [];
    
    let result = sites.filter(s => 
      s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.projectCompany?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortOrder === 'name') {
      result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (sortOrder === 'newest') {
      result.sort((a, b) => {
        const da = a.createdAt?.toDate?.()?.getTime() || 0;
        const db = b.createdAt?.toDate?.()?.getTime() || 0;
        return db - da;
      });
    } else if (sortOrder === 'oldest') {
      result.sort((a, b) => {
        const da = a.createdAt?.toDate?.()?.getTime() || 0;
        const db = b.createdAt?.toDate?.()?.getTime() || 0;
        return da - db;
      });
    }

    return result;
  }, [sites, searchTerm, sortOrder]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredSitesList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSitesList.map(s => s.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  if (isUserLoading || isProfileLoading || sitesLoading) {
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
            <MapPin className="h-8 w-8" /> Manage Project Sites
          </h1>
          <p className="text-muted-foreground">Define and organize project locations for organizational operations.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={handleDownloadTemplate} className="rounded-sm border-primary/20 text-primary">
                  <FileDown className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download Import Template</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" ref={fileInputRef} onChange={handleBulkImport} />
                  <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="rounded-sm border-primary/20 text-primary">
                    {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent>Bulk Import Sites (Excel/CSV)</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={handleExportRegistry} className="rounded-sm border-primary/20 text-primary">
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export Site Registry to Excel</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-sm font-bold h-11 shadow-md ml-2">
                <Plus className="h-4 w-4 mr-2" /> Add New Site
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-sm">
              <DialogHeader>
                <DialogTitle>Register New Site</DialogTitle>
                <DialogDescription>Add a specific project location to the registry.</DialogDescription>
              </DialogHeader>
              <Form {...siteForm}>
                <form onSubmit={siteForm.handleSubmit(onSiteSubmit)} className="space-y-4 py-4">
                  <FormField control={siteForm.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Site Name</FormLabel><FormControl><Input placeholder="e.g., Shahapur - 194082" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={siteForm.control} name="projectCompany" render={({ field }) => (
                    <FormItem><FormLabel>Project Company</FormLabel><FormControl><Input placeholder="e.g., HTI Energies" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={siteForm.control} name="acCapacity" render={({ field }) => (
                      <FormItem><FormLabel>AC Capacity</FormLabel><FormControl><Input placeholder="4.000" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={siteForm.control} name="dcCapacity" render={({ field }) => (
                      <FormItem><FormLabel>DC Capacity</FormLabel><FormControl><Input placeholder="5.174" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <DialogFooter className="pt-4 gap-2">
                    <DialogClose asChild><Button variant="outline" className="rounded-sm">Cancel</Button></DialogClose>
                    <Button type="submit" className="rounded-sm font-bold">Add Project Site</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md">
        <CardHeader className="bg-muted/5 border-b py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-sm font-bold uppercase tracking-widest">Site Registry</CardTitle>
            <CardDescription className="text-xs uppercase font-black text-primary">{sites?.length || 0} Locations Active</CardDescription>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search registry..." 
                className="pl-8 rounded-sm h-9 border-primary/20 text-xs" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
            
            <Select value={sortOrder} onValueChange={(val: SortOrder) => setSortOrder(val)}>
              <SelectTrigger className="w-40 h-9 text-xs rounded-sm border-primary/20">
                <ListFilter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name" className="text-xs">Alphabetical</SelectItem>
                <SelectItem value="newest" className="text-xs">Recently Added</SelectItem>
                <SelectItem value="oldest" className="text-xs">Oldest Added</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {selectedIds.length > 0 && (
            <div className="bg-primary/5 border-b p-3 flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary h-5 text-[10px] uppercase font-black">{selectedIds.length} Selected</Badge>
                <span className="text-xs font-medium text-muted-foreground">Perform action on selected records</span>
              </div>
              <Button 
                variant="destructive" 
                size="sm" 
                className="h-8 rounded-sm font-bold text-[10px] uppercase"
                onClick={() => setIsBulkDialogOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete Selected
              </Button>
            </div>
          )}

          <div className="max-h-[600px] overflow-auto custom-scrollbar">
            <Table>
              <TableHeader className="bg-muted/30 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-12 text-center">
                    <Checkbox 
                      checked={selectedIds.length === filteredSitesList.length && filteredSitesList.length > 0} 
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Site Name</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Company</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold text-center">AC Capacity</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold text-center">DC Capacity</TableHead>
                  <TableHead className="text-right px-6"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSitesList.length > 0 ? (
                  filteredSitesList.map((site) => (
                    <TableRow key={site.id} className={cn("hover:bg-muted/5 group", selectedIds.includes(site.id) && "bg-primary/[0.02]")}>
                      <TableCell className="text-center">
                        <Checkbox 
                          checked={selectedIds.includes(site.id)} 
                          onCheckedChange={() => toggleSelectOne(site.id)}
                        />
                      </TableCell>
                      <TableCell className="font-bold text-sm">{site.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-medium">{site.projectCompany}</TableCell>
                      <TableCell className="text-center font-mono text-[10px] font-bold text-blue-600">
                        {site.acCapacity}
                      </TableCell>
                      <TableCell className="text-center font-mono text-[10px] font-bold text-amber-600">
                        {site.dcCapacity}
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => deleteSite(site.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                      {searchTerm ? `No sites found matching "${searchTerm}"` : "Registry empty. Add sites to start."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Confirm Bulk Deletion
            </AlertDialogTitle>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to permanently remove <strong>{selectedIds.length} project sites</strong> from the organization registry. 
              This action will remove them from all dropdowns across the platform and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-sm font-bold"
              disabled={isDeletingBulk}
            >
              {isDeletingBulk ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Deletion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
