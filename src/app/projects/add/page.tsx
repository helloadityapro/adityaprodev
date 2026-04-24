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
import { 
  Trash2, 
  Search, 
  MapPin, 
  Plus, 
  FileDown, 
  FileUp, 
  Download, 
  Check, 
  ListFilter, 
  AlertCircle, 
  Loader2, 
  ArrowLeft, 
  RefreshCw, 
  Pencil, 
  LayoutGrid, 
  Tags, 
  X, 
  ShieldCheck,
  Building2,
  Zap,
  ChevronDown
} from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const siteSchema = z.object({
  name: z.string().min(1, 'Site name is required.'),
  projectCompany: z.string().min(1, 'Project company is required.'),
  acCapacity: z.coerce.number({ invalid_type_error: "Must be a valid number" }).min(0, "Capacity cannot be negative"),
  dcCapacity: z.coerce.number({ invalid_type_error: "Must be a valid number" }).min(0, "Capacity cannot be negative"),
  latitude: z.coerce.number().optional().or(z.literal(0)),
  longitude: z.coerce.number().optional().or(z.literal(0)),
});

type SortOrder = 'name' | 'newest' | 'oldest';

const formatCapacity = (val: any) => {
  const num = typeof val === 'number' ? val : parseFloat(String(val || 0));
  return isNaN(num) ? "0.000" : num.toFixed(3);
};

export default function AddNewProjectPage() {
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
  const [siteToEdit, setSiteToEdit] = React.useState<any | null>(null);
  const [isImporting, setIsImporting] = React.useState(false);
  
  // Group States
  const [selectedGroupIds, setSelectedGroupIds] = React.useState<string[]>([]);
  const [isGroupManageOpen, setIsGroupManageOpen] = React.useState(false);
  const [newGroupName, setNewGroupName] = React.useState("");
  const [groupSiteIds, setGroupSiteIds] = React.useState<string[]>([]);
  const [groupSiteSearch, setGroupSiteSearch] = React.useState("");

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: sites, isLoading: sitesLoading } = useCollection<any>(sitesQuery);

  const groupsQuery = useMemoFirebase(() => collection(firestore, 'site_groups'), [firestore]);
  const { data: groups, isLoading: groupsLoading } = useCollection<any>(groupsQuery);

  const siteForm = useForm<z.infer<typeof siteSchema>>({
    resolver: zodResolver(siteSchema),
    defaultValues: { name: '', projectCompany: '', acCapacity: 0, dcCapacity: 0, latitude: 0, longitude: 0 },
  });

  React.useEffect(() => {
    if (isAddDialogOpen) {
      siteForm.reset({ name: '', projectCompany: '', acCapacity: 0, dcCapacity: 0, latitude: 0, longitude: 0 });
    }
  }, [isAddDialogOpen, siteForm]);

  React.useEffect(() => {
    if (siteToEdit) {
      siteForm.reset({
        name: siteToEdit.name,
        projectCompany: siteToEdit.projectCompany,
        acCapacity: siteToEdit.acCapacity,
        dcCapacity: siteToEdit.dcCapacity,
        latitude: siteToEdit.latitude || 0,
        longitude: siteToEdit.longitude || 0,
      });
    }
  }, [siteToEdit, siteForm]);

  const onSiteSubmit = (values: z.infer<typeof siteSchema>) => {
    addDocumentNonBlocking(collection(firestore, 'sites'), {
      ...values,
      createdAt: serverTimestamp()
    });
    toast({ title: 'Success', description: 'New Site added.' });
    siteForm.reset();
    setIsAddDialogOpen(false);
  };

  const onEditSubmit = (values: z.infer<typeof siteSchema>) => {
    if (!siteToEdit) return;
    updateDocumentNonBlocking(doc(firestore, 'sites', siteToEdit.id), {
      ...values,
      updatedAt: serverTimestamp()
    });
    toast({ title: 'Success', description: 'Site details updated.' });
    setSiteToEdit(null);
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

  // Group Management
  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || groupSiteIds.length === 0 || !user) return;
    try {
      await addDocumentNonBlocking(collection(firestore, 'site_groups'), {
        name: newGroupName.trim(),
        siteIds: groupSiteIds,
        createdById: user.uid,
        createdAt: serverTimestamp(),
      });
      toast({ title: 'Group Created', description: `Site group "${newGroupName}" is now available.` });
      setNewGroupName("");
      setGroupSiteIds([]);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to create group', description: e.message });
    }
  };

  const handleDeleteGroup = (id: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'site_groups', id));
    toast({ title: 'Group Removed' });
  };

  const filteredSitesList = React.useMemo(() => {
    if (!sites) return [];
    
    let result = sites.filter(s => 
      s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.projectCompany?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Apply Group Filtering
    if (selectedGroupIds.length > 0) {
      const allowedSiteIds = new Set<string>();
      groups?.filter(g => selectedGroupIds.includes(g.id)).forEach(g => {
        g.siteIds?.forEach((id: string) => allowedSiteIds.add(id));
      });
      result = result.filter(s => allowedSiteIds.has(s.id));
    }

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
  }, [sites, groups, searchTerm, selectedGroupIds, sortOrder]);

  const summaryStats = React.useMemo(() => {
    return {
      count: filteredSitesList.length,
      ac: filteredSitesList.reduce((sum, s) => sum + (parseFloat(String(s.acCapacity || 0)) || 0), 0),
      dc: filteredSitesList.reduce((sum, s) => sum + (parseFloat(String(s.dcCapacity || 0)) || 0), 0),
    };
  }, [filteredSitesList]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredSitesList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSitesList.map(s => s.id));
    }
  };

  if (isUserLoading || isProfileLoading || sitesLoading || groupsLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex flex-col gap-1">
          <Button variant="ghost" size="sm" onClick={() => router.push('/projects/list')} className="w-fit mb-2 -ml-2 text-muted-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
          </Button>
          <h1 className="flex items-center gap-2 text-primary">
            <Plus className="h-8 w-8" /> Add or Update Project
          </h1>
          <p className="text-muted-foreground">Manage specific site records or organize them into clusters via groups.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-sm font-bold h-11 shadow-md">
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
                      <FormItem><FormLabel>AC Capacity (MW)</FormLabel><FormControl><Input type="number" step="0.001" placeholder="4.000" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={siteForm.control} name="dcCapacity" render={({ field }) => (
                      <FormItem><FormLabel>DC Capacity (MWp)</FormLabel><FormControl><Input type="number" step="0.001" placeholder="5.174" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={siteForm.control} name="latitude" render={({ field }) => (
                      <FormItem><FormLabel>Latitude</FormLabel><FormControl><Input type="number" step="0.000001" placeholder="19.0760" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={siteForm.control} name="longitude" render={({ field }) => (
                      <FormItem><FormLabel>Longitude</FormLabel><FormControl><Input type="number" step="0.000001" placeholder="72.8777" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
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

          <Dialog open={isGroupManageOpen} onOpenChange={setIsGroupManageOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-sm font-bold h-11 border-primary/20 text-primary hover:bg-primary/5">
                <Tags className="h-4 w-4 mr-2" /> Manage Groups
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl rounded-sm p-0 overflow-hidden border-none shadow-2xl flex flex-col h-[80vh]">
              <DialogHeader className="p-6 bg-primary/5 border-b">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-sm"><Tags className="h-5 w-5 text-primary" /></div>
                  <div>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight">Site Grouping Hub</DialogTitle>
                    <DialogDescription className="text-xs font-medium">Categorize project locations for cluster reports and filtering.</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              
              <Tabs defaultValue="create" className="flex-1 flex flex-col min-h-0">
                <TabsList className="bg-muted/50 rounded-none border-b h-12 p-1 px-6 gap-4">
                  <TabsTrigger value="create" className="rounded-sm font-bold text-[10px] uppercase tracking-widest">New Group</TabsTrigger>
                  <TabsTrigger value="list" className="rounded-sm font-bold text-[10px] uppercase tracking-widest">Active Groups</TabsTrigger>
                </TabsList>
                
                <TabsContent value="create" className="flex-1 p-6 space-y-6 overflow-y-auto m-0">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Group Name</Label>
                      <Input 
                        placeholder="e.g. Cluster North, Phase 2, etc..." 
                        className="h-12 rounded-sm text-lg font-black tracking-tight"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Select Sites ({groupSiteIds.length})</Label>
                        <div className="relative w-48">
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                          <Input 
                            placeholder="Filter sites..." 
                            className="pl-8 h-8 rounded-sm text-[10px]" 
                            value={groupSiteSearch}
                            onChange={(e) => setGroupSiteSearch(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="border rounded-sm bg-muted/10">
                        <ScrollArea className="h-64">
                          <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {sites?.filter(s => s.name.toLowerCase().includes(groupSiteSearch.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)).map(site => (
                              <div 
                                key={site.id} 
                                className={cn(
                                  "flex items-center space-x-2 p-2 rounded-sm border transition-all cursor-pointer",
                                  groupSiteIds.includes(site.id) ? "bg-primary/5 border-primary/30" : "bg-background border-transparent hover:border-border"
                                )}
                                onClick={() => {
                                  setGroupSiteIds(prev => prev.includes(site.id) ? prev.filter(id => id !== site.id) : [...prev, site.id]);
                                }}
                              >
                                <Checkbox checked={groupSiteIds.includes(site.id)} />
                                <span className="text-[11px] font-bold truncate leading-none">{site.name}</span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  </div>
                  <Button 
                    className="w-full h-12 font-black uppercase text-xs tracking-widest shadow-lg"
                    disabled={!newGroupName.trim() || groupSiteIds.length === 0}
                    onClick={handleCreateGroup}
                  >
                    Confirm Group Creation
                  </Button>
                </TabsContent>

                <TabsContent value="list" className="flex-1 p-0 m-0 overflow-hidden flex flex-col">
                  <ScrollArea className="flex-1">
                    <div className="divide-y">
                      {groups && groups.length > 0 ? groups.map(g => (
                        <div key={g.id} className="p-4 px-6 flex items-center justify-between hover:bg-muted/5 transition-colors">
                          <div className="space-y-1 min-w-0">
                            <p className="font-black text-sm uppercase tracking-tight text-primary">{g.name}</p>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">{g.siteIds?.length || 0} Projects Assigned</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => handleDeleteGroup(g.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )) : (
                        <div className="p-20 text-center text-muted-foreground italic text-xs uppercase font-bold opacity-30">No groups defined</div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
              <div className="p-4 bg-muted/5 border-t">
                <DialogClose asChild><Button variant="outline" className="w-full h-11 font-black uppercase text-[10px] tracking-widest rounded-sm">Close Dashboard</Button></DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Aggregate Analytics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-primary/5 border border-primary/10 rounded-sm flex items-center justify-between shadow-sm">
          <div className="space-y-0.5">
            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Filtered Registry</p>
            <p className="text-2xl font-black text-primary leading-none">{summaryStats.count}</p>
            <p className="text-[8px] font-bold text-primary/60 uppercase">Project Sites</p>
          </div>
          <Building2 className="h-8 w-8 text-primary/10" />
        </div>
        <div className="p-4 bg-primary/5 border border-primary/10 rounded-sm flex items-center justify-between shadow-sm">
          <div className="space-y-0.5">
            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Agg. AC Capacity</p>
            <p className="text-2xl font-black text-primary leading-none">{formatCapacity(summaryStats.ac)}</p>
            <p className="text-[8px] font-bold text-primary/60 uppercase">Megawatts (MW)</p>
          </div>
          <Zap className="h-8 w-8 text-primary/10" />
        </div>
        <div className="p-4 bg-primary/5 border border-primary/10 rounded-sm flex items-center justify-between shadow-sm">
          <div className="space-y-0.5">
            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Agg. DC Capacity</p>
            <p className="text-2xl font-black text-primary leading-none">{formatCapacity(summaryStats.dc)}</p>
            <p className="text-[8px] font-bold text-primary/60 uppercase">Megawatts Peak (MWp)</p>
          </div>
          <ShieldCheck className="h-8 w-8 text-primary/10" />
        </div>
      </div>

      <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md">
        <CardHeader className="bg-muted/5 border-b py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-sm font-bold uppercase tracking-widest">Operational Registry</CardTitle>
            <CardDescription className="text-[10px] font-black uppercase text-primary">
              Management & Bulk Operations
            </CardDescription>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Group Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 rounded-sm border-primary/20 text-primary font-bold text-[10px] uppercase gap-1.5 min-w-[140px]">
                  <Tags className="h-3.5 w-3.5" />
                  {selectedGroupIds.length === 0 ? "Filter Groups" : `${selectedGroupIds.length} Groups Active`}
                  <ChevronDown className="h-3 w-3 opacity-50 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-0 rounded-sm border-primary/10 shadow-2xl overflow-hidden">
                <div className="bg-primary/5 p-3 border-b">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Filter results by group</h3>
                </div>
                <ScrollArea className="h-[200px]">
                  <div className="p-2 space-y-1">
                    {groups?.map(group => (
                      <div 
                        key={group.id} 
                        className={cn(
                          "flex items-center space-x-2 p-2 rounded-sm hover:bg-muted/50 transition-colors cursor-pointer",
                          selectedGroupIds.includes(group.id) && "bg-primary/10"
                        )}
                        onClick={() => setSelectedGroupIds(prev => prev.includes(group.id) ? prev.filter(id => id !== group.id) : [...prev, group.id])}
                      >
                        <Checkbox checked={selectedGroupIds.includes(group.id)} />
                        <span className="text-[11px] font-bold uppercase truncate">{group.name}</span>
                      </div>
                    ))}
                    {(!groups || groups.length === 0) && (
                      <p className="p-4 text-center text-[10px] text-muted-foreground font-bold uppercase italic">No groups defined</p>
                    )}
                  </div>
                </ScrollArea>
                {selectedGroupIds.length > 0 && (
                  <Button variant="ghost" onClick={() => setSelectedGroupIds([])} className="w-full rounded-none h-8 text-[9px] font-black uppercase text-primary border-t">Clear Selection</Button>
                )}
              </PopoverContent>
            </Popover>

            <div className="relative w-full md:w-48">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search..." 
                className="pl-8 rounded-sm h-9 border-primary/20 text-xs" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
            
            <Select value={sortOrder} onValueChange={(val: SortOrder) => setSortOrder(val)}>
              <SelectTrigger className="w-32 h-9 text-[10px] font-bold uppercase rounded-sm border-primary/20">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name" className="text-[10px] font-bold">ALPHA</SelectItem>
                <SelectItem value="newest" className="text-[10px] font-bold">NEWEST</SelectItem>
                <SelectItem value="oldest" className="text-[10px] font-bold">OLDEST</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {selectedIds.length > 0 && (
            <div className="bg-primary/5 border-b p-3 flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary h-5 text-[10px] uppercase font-black">{selectedIds.length} Selected</Badge>
                <span className="text-xs font-medium text-muted-foreground">Perform bulk action on selected sites</span>
              </div>
              <Button 
                variant="destructive" 
                size="sm" 
                className="h-8 rounded-sm font-bold text-[10px] uppercase"
                onClick={() => setIsBulkDialogOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remove Bulk
              </Button>
            </div>
          )}

          <div className="max-h-[600px] overflow-auto custom-scrollbar">
            <Table>
              <TableHeader className="bg-muted/30 sticky top-0 z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-12 text-center">
                    <Checkbox 
                      checked={selectedIds.length === filteredSitesList.length && filteredSitesList.length > 0} 
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="text-[10px] uppercase font-black tracking-widest">Site Name</TableHead>
                  <TableHead className="text-[10px] uppercase font-black tracking-widest text-center">AC Capacity</TableHead>
                  <TableHead className="text-[10px] uppercase font-black tracking-widest text-center">DC Capacity</TableHead>
                  <TableHead className="text-[10px] uppercase font-black tracking-widest text-center">Groups</TableHead>
                  <TableHead className="text-right px-6 font-black uppercase text-[10px] tracking-widest">Manage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSitesList.length > 0 ? (
                  filteredSitesList.map((site) => {
                    const siteGroups = groups?.filter(g => g.siteIds?.includes(site.id)) || [];
                    return (
                      <TableRow key={site.id} className={cn("hover:bg-muted/5 transition-colors group", selectedIds.includes(site.id) && "bg-primary/[0.02]")}>
                        <TableCell className="text-center">
                          <Checkbox 
                            checked={selectedIds.includes(site.id)} 
                            onCheckedChange={() => setSelectedIds(prev => prev.includes(site.id) ? prev.filter(i => i !== site.id) : [...prev, site.id])}
                          />
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-foreground">{site.name}</span>
                            <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter mt-0.5">{site.projectCompany}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono text-[10px] font-black text-primary">
                          {formatCapacity(site.acCapacity)} MW
                        </TableCell>
                        <TableCell className="text-center font-mono text-[10px] font-black text-amber-600">
                          {formatCapacity(site.dcCapacity)} MWp
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-wrap justify-center gap-1">
                            {siteGroups.slice(0, 2).map(g => (
                              <Badge key={g.id} variant="secondary" className="h-4 px-1.5 text-[7px] font-black uppercase border-none bg-primary/5 text-primary/60">{g.name}</Badge>
                            ))}
                            {siteGroups.length > 2 && <span className="text-[8px] font-black text-muted-foreground">+{siteGroups.length - 2}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setSiteToEdit(site)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteSite(site.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic uppercase font-black text-[10px] opacity-20">
                      No records discovered matching your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Site Dialog */}
      <Dialog open={!!siteToEdit} onOpenChange={(open) => !open && setSiteToEdit(null)}>
        <DialogContent className="sm:max-w-md rounded-sm">
          <DialogHeader>
            <DialogTitle>Edit Site Details</DialogTitle>
            <DialogDescription>Modify the properties for {siteToEdit?.name}.</DialogDescription>
          </DialogHeader>
          <Form {...siteForm}>
            <form onSubmit={siteForm.handleSubmit(onEditSubmit)} className="space-y-4 py-4">
              <FormField control={siteForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Site Name</FormLabel><FormControl><Input placeholder="e.g., Shahapur - 194082" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={siteForm.control} name="projectCompany" render={({ field }) => (
                <FormItem><FormLabel>Project Company</FormLabel><FormControl><Input placeholder="e.g., HTI Energies" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={siteForm.control} name="acCapacity" render={({ field }) => (
                  <FormItem><FormLabel>AC Capacity (MW)</FormLabel><FormControl><Input type="number" step="0.001" placeholder="4.000" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={siteForm.control} name="dcCapacity" render={({ field }) => (
                  <FormItem><FormLabel>DC Capacity (MWp)</FormLabel><FormControl><Input type="number" step="0.001" placeholder="5.174" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={siteForm.control} name="latitude" render={({ field }) => (
                  <FormItem><FormLabel>Latitude</FormLabel><FormControl><Input type="number" step="0.000001" placeholder="19.0760" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={siteForm.control} name="longitude" render={({ field }) => (
                  <FormItem><FormLabel>Longitude</FormLabel><FormControl><Input type="number" step="0.000001" placeholder="72.8777" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <DialogFooter className="pt-4 gap-2">
                <DialogClose asChild><Button variant="outline" className="rounded-sm font-bold uppercase text-[10px]">Cancel</Button></DialogClose>
                <Button type="submit" className="rounded-sm font-black uppercase text-[10px]">Save Changes</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

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
            <AlertDialogCancel className="rounded-sm font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-sm font-bold uppercase text-[10px]"
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