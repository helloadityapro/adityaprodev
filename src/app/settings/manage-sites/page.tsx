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
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Trash2, Search, MapPin, Plus, ArrowUpDown, Clock, Check, ListFilter, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { isSuperAdmin } from '@/lib/auth-constants';
import { Checkbox } from '@/components/ui/checkbox';
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
import { cn } from '@/lib/utils';

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

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  React.useEffect(() => {
    if (!isUserLoading && !isProfileLoading && !isAdmin) {
      router.replace('/dashboard');
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
      const batch = writeBatch(firestore);
      selectedIds.forEach(id => {
        batch.delete(doc(firestore, 'sites', id));
      });
      await batch.commit();
      
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
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-sm h-fit lg:col-span-1">
          <CardHeader>
            <CardTitle>Register New Site</CardTitle>
            <CardDescription>Add a specific project location to the registry.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...siteForm}>
              <form onSubmit={siteForm.handleSubmit(onSiteSubmit)} className="space-y-4">
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
                <Button type="submit" className="w-full rounded-sm font-bold h-11">
                  <Plus className="h-4 w-4 mr-2" /> Add Project Site
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="rounded-sm overflow-hidden lg:col-span-2 border-primary/10 shadow-md">
          <CardHeader className="bg-muted/5 border-b py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-sm font-bold uppercase tracking-widest">Site Registry</CardTitle>
              <CardDescription className="text-xs uppercase font-black text-primary">{sites?.length || 0} Locations Active</CardDescription>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search registry..." 
                  className="pl-8 rounded-sm h-9 border-primary/20 text-xs" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
              </div>
              
              <Select value={sortOrder} onValueChange={(val: SortOrder) => setSortOrder(val)}>
                <SelectTrigger className="w-36 h-9 text-xs rounded-sm border-primary/20">
                  <ListFilter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Alphabetical</SelectItem>
                  <SelectItem value="newest">Recently Added</SelectItem>
                  <SelectItem value="oldest">Oldest Added</SelectItem>
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
                    <TableHead className="text-[10px] uppercase font-bold text-center">AC / DC</TableHead>
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
                        <TableCell className="text-center font-mono text-[10px] font-bold">
                          <span className="text-blue-600">{site.acCapacity}</span> / <span className="text-amber-600">{site.dcCapacity}</span>
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
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                        {searchTerm ? `No sites found matching "${searchTerm}"` : "Registry empty. Add sites to start."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Confirm Bulk Deletion
            </AlertDialogTitle>
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
