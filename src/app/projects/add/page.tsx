
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
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { 
  Trash2, 
  Search, 
  Plus, 
  FileDown, 
  FileUp,
  Check, 
  AlertCircle, 
  Loader2, 
  ArrowLeft, 
  Pencil, 
  Tags, 
  Building2,
  Zap,
  ShieldCheck,
  ChevronDown,
  MapPin,
  Download,
  LayoutGrid,
  Globe,
  RefreshCcw,
  User as UserIcon,
  ChevronsUpDown,
  FilterX,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Lock,
  ShieldAlert
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { isSuperAdmin } from '@/lib/auth-constants';
import { format } from 'date-fns';

const siteSchema = z.object({
  name: z.string().min(1, 'Site name is required.'),
  projectCompany: z.string().min(1, 'Project company is required.'),
  projectType: z.enum(['groundmount', 'rooftop']),
  acCapacity: z.coerce.number({ invalid_type_error: "Must be a valid number" }).min(0, "Capacity cannot be negative"),
  dcCapacity: z.coerce.number({ invalid_type_error: "Must be a valid number" }).min(0, "Capacity cannot be negative"),
  latitude: z.coerce.number().optional().or(z.literal(0)),
  longitude: z.coerce.number().optional().or(z.literal(0)),
  projectOwnerId: z.string().optional(),
  projectOwnerName: z.string().optional(),
  workStatus: z.enum(["Yet to Start", "Work in progress", "Completed", "Cancelled"]).default("Yet to Start"),
  projectStatus: z.enum(["open", "close"]).default("open"),
});

type SortOrder = 'name' | 'newest' | 'oldest';

export default function AddNewProjectPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  const [activeTab, setActiveTab] = React.useState<string>("groundmount");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState<SortOrder>('name');
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = React.useState(false);
  const [isMovingBulk, setIsMovingBulk] = React.useState(false);
  
  // Deletion States
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const [siteToDelete, setSiteToDelete] = React.useState<any | null>(null);
  const [deletePassword, setDeletePassword] = React.useState("");
  const [isVerifyingPassword, setIsVerifyingPassword] = React.useState(false);
  const [verificationError, setVerificationError] = React.useState<string | null>(null);

  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [siteToEdit, setSiteToEdit] = React.useState<any | null>(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const [selectedGroupIds, setSelectedGroupIds] = React.useState<string[]>([]);
  const [isOwnerPopoverOpen, setIsOwnerPopoverOpen] = React.useState(false);
  const [ownerSearchQuery, setOwnerSearchQuery] = React.useState("");

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: sites, isLoading: sitesLoading } = useCollection<any>(sitesQuery);

  const groupsQuery = useMemoFirebase(() => collection(firestore, 'site_groups'), [firestore]);
  const { data: groups, isLoading: groupsLoading } = useCollection<any>(groupsQuery);

  const allUsersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allPersonnel } = useCollection<any>(allUsersQuery);

  const siteForm = useForm<z.infer<typeof siteSchema>>({
    resolver: zodResolver(siteSchema),
    defaultValues: { 
      name: '', 
      projectCompany: '', 
      projectType: 'groundmount', 
      acCapacity: 0, 
      dcCapacity: 0, 
      latitude: 0, 
      longitude: 0,
      projectOwnerId: "",
      projectOwnerName: "",
      workStatus: "Yet to Start",
      projectStatus: "open"
    },
  });

  React.useEffect(() => {
    if (isAddDialogOpen) {
      siteForm.reset({ 
        name: '', 
        projectCompany: '', 
        projectType: 'groundmount', 
        acCapacity: 0, 
        dcCapacity: 0, 
        latitude: 0, 
        longitude: 0,
        projectOwnerId: "",
        projectOwnerName: "",
        workStatus: "Yet to Start",
        projectStatus: "open"
      });
    }
  }, [isAddDialogOpen, siteForm]);

  React.useEffect(() => {
    if (siteToEdit) {
      siteForm.reset({
        name: siteToEdit.name,
        projectCompany: siteToEdit.projectCompany,
        projectType: siteToEdit.projectType || 'groundmount',
        acCapacity: siteToEdit.acCapacity,
        dcCapacity: siteToEdit.dcCapacity,
        latitude: siteToEdit.latitude || 0,
        longitude: siteToEdit.longitude || 0,
        projectOwnerId: siteToEdit.projectOwnerId || "",
        projectOwnerName: siteToEdit.projectOwnerName || "",
        workStatus: siteToEdit.workStatus || "Work in progress",
        projectStatus: siteToEdit.projectStatus || "open",
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

  const handleFinalDelete = async () => {
    if (!user || !deletePassword) return;
    setIsVerifyingPassword(true);
    setVerificationError(null);

    try {
      // 1. Verify Identity
      const credential = EmailAuthProvider.credential(user.email!, deletePassword);
      await reauthenticateWithCredential(user, credential);

      // 2. Perform Deletion
      if (siteToDelete) {
        // Individual Delete
        deleteDocumentNonBlocking(doc(firestore, 'sites', siteToDelete.id));
        toast({ title: 'Site Removed', description: `${siteToDelete.name} deleted from registry.` });
        setSelectedIds(prev => prev.filter(id => id !== siteToDelete.id));
      } else if (selectedIds.length > 0) {
        // Bulk Delete
        const batchSize = 400;
        for (let i = 0; i < selectedIds.length; i += batchSize) {
          const batch = writeBatch(firestore);
          const chunk = selectedIds.slice(i, i + batchSize);
          chunk.forEach(id => {
            batch.delete(doc(firestore, 'sites', id));
          });
          await batch.commit();
        }
        toast({ title: 'Bulk Removal Complete', description: `Successfully removed ${selectedIds.length} projects.` });
        setSelectedIds([]);
      }

      // 3. Reset state
      setDeletePassword("");
      setIsDeleteConfirmOpen(false);
      setSiteToDelete(null);
    } catch (e: any) {
      console.error(e);
      setVerificationError("Invalid password. Authorization denied.");
      toast({ variant: 'destructive', title: 'Security Alert', description: 'Authentication failed. Record preserved.' });
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const handleBulkMove = async () => {
    if (selectedIds.length === 0) return;
    setIsMovingBulk(true);
    
    try {
      const targetType = activeTab === 'groundmount' ? 'rooftop' : 'groundmount';
      const batchSize = 400;
      for (let i = 0; i < selectedIds.length; i += batchSize) {
        const batch = writeBatch(firestore);
        const chunk = selectedIds.slice(i, i + batchSize);
        chunk.forEach(id => {
          batch.update(doc(firestore, 'sites', id), {
            projectType: targetType,
            updatedAt: serverTimestamp()
          });
        });
        await batch.commit();
      }
      
      toast({ 
        title: 'Transfer Complete', 
        description: `Moved ${selectedIds.length} projects to ${targetType === 'groundmount' ? 'Groundmount' : 'Rooftop'}.` 
      });
      setSelectedIds([]);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
    } finally {
      setIsMovingBulk(false);
    }
  };

  const filteredSitesList = React.useMemo(() => {
    if (!sites) return [];
    
    let result = sites.filter(s => {
      const type = s.projectType || 'groundmount';
      return type === activeTab;
    });

    result = result.filter(s => 
      s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.projectCompany?.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
      result.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
    } else if (sortOrder === 'oldest') {
      result.sort((a, b) => (a.createdAt?.toDate?.() || 0) - (b.createdAt?.toDate?.() || 0));
    }

    return result;
  }, [sites, groups, searchTerm, selectedGroupIds, sortOrder, activeTab]);

  const summaryStats = React.useMemo(() => {
    return {
      count: filteredSitesList.length,
      ac: filteredSitesList.reduce((sum, s) => sum + (parseFloat(String(s.acCapacity || 0)) || 0), 0),
      dc: filteredSitesList.reduce((sum, s) => sum + (parseFloat(String(s.dcCapacity || 0)) || 0), 0),
    };
  }, [filteredSitesList]);

  const handleDownloadTemplate = () => {
    const wsData = [
      ["Site Name", "Project Company", "Project Type (groundmount/rooftop)", "AC Capacity (MW)", "DC Capacity (MWp)", "Latitude", "Longitude"],
      ["Shahapur Site", "HTI Energies", "groundmount", "4.5", "5.2", "19.2312", "73.1234"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SiteTemplate");
    XLSX.writeFile(wb, "Project_Import_Template.xlsx");
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
          const name = row["Site Name"] || row["name"];
          const company = row["Project Company"] || row["company"];
          const type = row["Project Type (groundmount/rooftop)"] || row["projectType"] || 'groundmount';
          const normalizedType = String(type).toLowerCase().trim();

          const ac = parseFloat(row["AC Capacity (MW)"] || row["ac"]);
          const dc = parseFloat(row["DC Capacity (MWp)"] || row["dc"]);
          const lat = parseFloat(row["Latitude"] || row["lat"] || 0);
          const lng = parseFloat(row["Longitude"] || row["lng"] || 0);

          if (name && company) {
            const newDocRef = doc(collection(firestore, 'sites'));
            batch.set(newDocRef, {
              name: String(name).trim(),
              projectCompany: String(company).trim(),
              projectType: normalizedType === 'rooftop' ? 'rooftop' : 'groundmount',
              acCapacity: isNaN(ac) ? 0 : ac,
              dcCapacity: isNaN(dc) ? 0 : dc,
              latitude: isNaN(lat) ? 0 : lat,
              longitude: isNaN(lng) ? 0 : lng,
              createdAt: serverTimestamp()
            });
            count++;
          }
        }

        if (count > 0) {
          await batch.commit();
          toast({ title: "Import Success", description: `Successfully added ${count} projects to the registry.` });
        } else {
          toast({ variant: "destructive", title: "Import Failed", description: "No valid project rows found in file." });
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

  const handleExportFiltered = () => {
    if (filteredSitesList.length === 0) return;
    
    const exportData = filteredSitesList.map(s => ({
      "Site Name": s.name,
      "Project Company": s.projectCompany,
      "Project Type": s.projectType || 'groundmount',
      "AC Capacity (MW)": s.acCapacity,
      "DC Capacity (MWp)": s.dcCapacity,
      "Latitude": s.latitude || 0,
      "Longitude": s.longitude || 0,
      "Project Owner": s.projectOwnerName || "Unassigned",
      "Work Status": s.workStatus || "N/A",
      "Project Status": s.projectStatus || "open",
      "Created At": s.createdAt?.toDate?.() ? format(s.createdAt.toDate(), 'dd-MM-yyyy') : '—'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Filtered Projects");
    XLSX.writeFile(wb, `AdityaPro_Projects_Export_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredSitesList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSitesList.map(s => s.id));
    }
  };

  const openDeleteDialog = (site?: any) => {
    if (site) {
        setSiteToDelete(site);
    } else {
        setSiteToDelete(null);
    }
    setDeletePassword("");
    setVerificationError(null);
    setIsDeleteConfirmOpen(true);
  };

  if (isUserLoading || isProfileLoading || sitesLoading || groupsLoading) {
    return (
      <div className="space-y-6 animate-pulse p-8">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!isAdmin) return null;

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
        
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-sm font-bold h-11 shadow-md px-6">
                <Plus className="h-4 w-4 mr-2" /> Add New Site
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl rounded-sm">
              <DialogHeader>
                <DialogTitle>Register New Site</DialogTitle>
                <DialogDescription>Add a specific project location to the registry.</DialogDescription>
              </DialogHeader>
              <Form {...siteForm}>
                <form onSubmit={siteForm.handleSubmit(onSiteSubmit)} className="space-y-4 py-4">
                  <FormField control={siteForm.control} name="projectType" render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Project Type</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex gap-6"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="groundmount" id="add-gm" />
                            <Label htmlFor="add-gm" className="font-bold cursor-pointer flex items-center gap-1.5 text-xs uppercase">
                              <LayoutGrid className="h-3.5 w-3.5" /> Groundmount
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="rooftop" id="add-rt" />
                            <Label htmlFor="add-rt" className="font-bold cursor-pointer flex items-center gap-1.5 text-xs uppercase">
                              <Building2 className="h-3.5 w-3.5" /> Rooftop
                            </Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={siteForm.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>Site Name</FormLabel><FormControl><Input placeholder="e.g., Shahapur - 194082" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={siteForm.control} name="projectCompany" render={({ field }) => (
                      <FormItem><FormLabel>Project Company</FormLabel><FormControl><Input placeholder="e.g., HTI Energies" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={siteForm.control} name="projectOwnerId" render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Project Owner</FormLabel>
                        <Popover open={isOwnerPopoverOpen} onOpenChange={setIsOwnerPopoverOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal h-11", !field.value && "text-muted-foreground")}>
                                {field.value ? allPersonnel?.find(u => u.id === field.value)?.username : "Select Owner..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <div className="flex items-center border-b px-3">
                              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                              <Input placeholder="Search users..." className="h-9 w-full border-none focus-visible:ring-0 px-0 text-sm" value={ownerSearchQuery} onChange={e => setOwnerSearchQuery(e.target.value)} />
                            </div>
                            <ScrollArea className="h-[200px]">
                              {allPersonnel?.filter(u => u.username?.toLowerCase().includes(ownerSearchQuery.toLowerCase())).map(u => (
                                <Button key={u.id} type="button" variant="ghost" className="w-full justify-start h-9 text-xs" onClick={() => { 
                                  field.onChange(u.id); 
                                  siteForm.setValue('projectOwnerName', u.username); 
                                  setIsOwnerPopoverOpen(false); 
                                }}>
                                  <Check className={cn("mr-2 h-3 w-3", field.value === u.id ? "opacity-100" : "opacity-0")} />
                                  {u.username}
                                </Button>
                              ))}
                            </ScrollArea>
                          </PopoverContent>
                        </Popover>
                      </FormItem>
                    )} />
                    <FormField control={siteForm.control} name="workStatus" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Work Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="Yet to Start">Yet to Start</SelectItem>
                            <SelectItem value="Work in progress">Work in progress</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                            <SelectItem value="Cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={siteForm.control} name="projectStatus" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="close">Close</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-2">
                      <FormField control={siteForm.control} name="acCapacity" render={({ field }) => (
                        <FormItem><FormLabel>AC (MW)</FormLabel><FormControl><Input type="number" step="0.001" placeholder="4.000" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={siteForm.control} name="dcCapacity" render={({ field }) => (
                        <FormItem><FormLabel>DC (MWp)</FormLabel><FormControl><Input type="number" step="0.001" placeholder="5.174" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
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

          <Button variant="outline" onClick={handleDownloadTemplate} className="rounded-sm font-bold h-11 border-primary/20 text-primary hover:bg-primary/5">
            <Download className="h-4 w-4 mr-2" /> Template
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
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileUp className="mr-2 h-4 w-4" />}
              Bulk Import
            </Button>
          </div>

          <Button variant="outline" onClick={handleExportFiltered} disabled={filteredSitesList.length === 0} className="rounded-sm font-bold h-11 border-primary/20 text-primary hover:bg-primary/5">
            <FileDown className="h-4 w-4 mr-2" /> Export Filtered
          </Button>

          <Button variant="outline" asChild className="rounded-sm font-bold h-11 border-primary/20 text-primary hover:bg-primary/5">
            <Link href="/projects/groups">
              <Tags className="h-4 w-4 mr-2" /> Manage Groups
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-muted/50 border border-primary/10 rounded-sm p-1 h-11 max-w-md mb-6">
          <TabsTrigger value="groundmount" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
            <LayoutGrid className="h-3.5 w-3.5 mr-2" /> Groundmount Projects
          </TabsTrigger>
          <TabsTrigger value="rooftop" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
            <Building2 className="h-3.5 w-3.5 mr-2" /> Rooftop Projects
          </TabsTrigger>
        </TabsList>

        <TabsContent value="groundmount" className="space-y-6 m-0 animate-in fade-in-50 duration-300">
          {renderSummaryAndTable()}
        </TabsContent>

        <TabsContent value="rooftop" className="space-y-6 m-0 animate-in fade-in-50 duration-300">
          {renderSummaryAndTable()}
        </TabsContent>
      </Tabs>

      {/* Edit Site Dialog */}
      <Dialog open={!!siteToEdit} onOpenChange={(open) => !open && setSiteToEdit(null)}>
        <DialogContent className="sm:max-w-xl rounded-sm">
          <DialogHeader>
            <DialogTitle>Edit Site Details</DialogTitle>
            <DialogDescription>Modify the properties for {siteToEdit?.name}.</DialogDescription>
          </DialogHeader>
          <Form {...siteForm}>
            <form onSubmit={siteForm.handleSubmit(onEditSubmit)} className="space-y-4 py-4">
              <FormField control={siteForm.control} name="projectType" render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Project Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex gap-6"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="groundmount" id="edit-gm" />
                        <Label htmlFor="edit-gm" className="font-bold cursor-pointer flex items-center gap-1.5 text-xs uppercase">
                          <LayoutGrid className="h-3.5 w-3.5" /> Groundmount
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="rooftop" id="edit-rt" />
                        <Label htmlFor="edit-rt" className="font-bold cursor-pointer flex items-center gap-1.5 text-xs uppercase">
                          <Building2 className="h-3.5 w-3.5" /> Rooftop
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={siteForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Site Name</FormLabel><FormControl><Input placeholder="e.g., Shahapur - 194082" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={siteForm.control} name="projectCompany" render={({ field }) => (
                  <FormItem><FormLabel>Project Company</FormLabel><FormControl><Input placeholder="e.g., HTI Energies" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={siteForm.control} name="projectOwnerId" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Project Owner</FormLabel>
                    <Popover open={isOwnerPopoverOpen} onOpenChange={setIsOwnerPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal h-11", !field.value && "text-muted-foreground")}>
                            {field.value ? allPersonnel?.find(u => u.id === field.value)?.username : "Select Owner..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <div className="flex items-center border-b px-3">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <Input placeholder="Search users..." className="h-9 w-full border-none focus-visible:ring-0 px-0 text-sm" value={ownerSearchQuery} onChange={e => setOwnerSearchQuery(e.target.value)} />
                        </div>
                        <ScrollArea className="h-[200px]">
                          {allPersonnel?.filter(u => u.username?.toLowerCase().includes(ownerSearchQuery.toLowerCase())).map(u => (
                            <Button key={u.id} type="button" variant="ghost" className="w-full justify-start h-9 text-xs" onClick={() => { 
                              field.onChange(u.id); 
                              siteForm.setValue('projectOwnerName', u.username); 
                              setIsOwnerPopoverOpen(false); 
                            }}>
                              <Check className={cn("mr-2 h-3 w-3", field.value === u.id ? "opacity-100" : "opacity-0")} />
                              {u.username}
                            </Button>
                          ))}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </FormItem>
                )} />
                <FormField control={siteForm.control} name="workStatus" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Yet to Start">Yet to Start</SelectItem>
                        <SelectItem value="Work in progress">Work in progress</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={siteForm.control} name="projectStatus" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="close">Close</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-2">
                  <FormField control={siteForm.control} name="acCapacity" render={({ field }) => (
                    <FormItem><FormLabel>AC (MW)</FormLabel><FormControl><Input type="number" step="0.001" placeholder="4.000" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={siteForm.control} name="dcCapacity" render={({ field }) => (
                    <FormItem><FormLabel>DC (MWp)</FormLabel><FormControl><Input type="number" step="0.001" placeholder="5.174" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
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
                <Button type="submit" className="rounded-sm font-black uppercase text-[10px]">Save Changes</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md rounded-sm border-none shadow-2xl overflow-hidden bg-background">
          <DialogHeader className="p-6 bg-red-500/5 border-b space-y-2 text-left">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-500/10 text-red-600 rounded-sm">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight text-red-700">Confirm Deletion</DialogTitle>
            </div>
            <DialogDescription className="text-xs font-medium leading-relaxed">
              {siteToDelete ? (
                <>You are about to permanently remove <strong className="text-foreground">{siteToDelete.name}</strong> from the organizational registry.</>
              ) : (
                <>You are about to permanently remove <strong className="text-foreground">{selectedIds.length} project sites</strong> from the organizational registry.</>
              )}
              <br/><br/>
              <span className="text-red-600 font-bold uppercase">This action cannot be undone.</span>
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-2">
                <Lock className="h-3 w-3" /> Security Verification
              </Label>
              <Input 
                type="password" 
                placeholder="Enter your account password..." 
                className="h-12 rounded-sm font-medium border-primary/10 bg-muted/20 focus-visible:ring-primary/20"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFinalDelete()}
              />
              {verificationError && (
                <p className="text-[10px] font-bold text-destructive uppercase tracking-tight flex items-center gap-1.5 px-1 animate-in shake duration-300">
                  <XCircle className="h-3 w-3" /> {verificationError}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="p-4 bg-muted/5 border-t gap-3 flex flex-col sm:flex-row">
            <DialogClose asChild>
              <Button variant="outline" className="w-full sm:flex-1 h-12 font-bold uppercase text-[10px] tracking-widest rounded-sm">
                Cancel
              </Button>
            </DialogClose>
            <Button 
              disabled={!deletePassword || isVerifyingPassword} 
              onClick={handleFinalDelete}
              className="w-full sm:flex-1 h-12 font-black uppercase text-[10px] tracking-widest bg-red-600 hover:bg-red-700 text-white shadow-lg"
            >
              {isVerifyingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  function renderSummaryAndTable() {
    const countLabel = selectedGroupIds.length > 0 ? 'Filtered Sites' : 'Total Locations';

    return (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in slide-in-from-top-2 duration-300">
          <div className="p-4 bg-primary/5 border border-primary/10 rounded-sm flex items-center justify-between shadow-sm">
            <div className="space-y-0.5">
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">{countLabel}</p>
              <p className="text-2xl font-black text-primary leading-none">{summaryStats.count}</p>
              <p className="text-[8px] font-bold text-primary/60 uppercase">Project Locations</p>
            </div>
            <Building2 className="h-8 w-8 text-primary/10" />
          </div>
          <div className="p-4 bg-primary/5 border border-primary/10 rounded-sm flex items-center justify-between shadow-sm">
            <div className="space-y-0.5">
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Total AC Capacity</p>
              <p className="text-2xl font-black text-primary leading-none">{formatCapacity(summaryStats.ac)}</p>
              <p className="text-[8px] font-bold text-primary/60 uppercase">Megawatts (MW)</p>
            </div>
            <Zap className="h-8 w-8 text-primary/10" />
          </div>
          <div className="p-4 bg-primary/5 border border-primary/10 rounded-sm flex items-center justify-between shadow-sm">
            <div className="space-y-0.5">
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Total DC Capacity</p>
              <p className="text-2xl font-black text-primary leading-none">{formatCapacity(summaryStats.dc)}</p>
              <p className="text-[8px] font-bold text-primary/60 uppercase">Megawatts Peak (MWp)</p>
            </div>
            <ShieldCheck className="h-8 w-8 text-primary/10" />
          </div>
        </div>

        <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md">
          <CardHeader className="bg-muted/5 border-b py-4 flex flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-sm font-bold uppercase tracking-widest">Project Database</CardTitle>
              <CardDescription className="text-[10px] font-black uppercase text-primary">
                Records Management : {activeTab}
              </CardDescription>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
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
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-primary text-left">Filter by Cluster</h3>
                  </div>
                  <ScrollArea className="h-[200px]">
                    <div className="p-2 space-y-1">
                      {groups?.sort((a: any, b: any) => a.name.localeCompare(b.name)).map((group: any) => (
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
                        <p className="p-4 text-center text-[10px] uppercase font-bold text-muted-foreground opacity-30">No groups registered</p>
                      )}
                    </div>
                  </ScrollArea>
                  {selectedGroupIds.length > 0 && (
                    <Button variant="ghost" onClick={() => setSelectedGroupIds([])} className="w-full rounded-none h-8 text-[9px] font-black uppercase text-primary border-t">Clear Filter</Button>
                  )}
                </PopoverContent>
              </Popover>

              <div className="relative w-full md:w-48">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search..." 
                  className="pl-8 h-9 rounded-sm border-primary/20 text-xs" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
              </div>
              
              <Select value={sortOrder} onValueChange={(val: SortOrder) => setSortOrder(val)}>
                <SelectTrigger className="w-32 h-9 text-[10px] font-bold uppercase rounded-sm border-primary/20">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name" className="text-[10px] font-bold uppercase">Alphabetical</SelectItem>
                  <SelectItem value="newest" className="text-[10px] font-bold uppercase">Newest First</SelectItem>
                  <SelectItem value="oldest" className="text-[10px] font-bold uppercase">Oldest First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            {selectedIds.length > 0 && (
              <div className="bg-primary/5 border-b p-3 flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary h-5 text-[8px] uppercase font-black">{selectedIds.length} Selected</Badge>
                  <span className="text-xs font-medium text-muted-foreground">Perform bulk action on selected sites</span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 rounded-sm font-bold text-[10px] uppercase border-primary/20 text-primary"
                    onClick={handleBulkMove}
                    disabled={isMovingBulk}
                  >
                    {isMovingBulk ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />}
                    Move to {activeTab === 'groundmount' ? 'Rooftop' : 'Groundmount'}
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="h-8 rounded-sm font-bold text-[10px] uppercase"
                    onClick={() => openDeleteDialog()}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remove Bulk
                  </Button>
                </div>
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
                    <TableHead className="text-[10px] uppercase font-black tracking-widest text-center">Owner</TableHead>
                    <TableHead className="text-[10px] uppercase font-black tracking-widest text-center">Work Status</TableHead>
                    <TableHead className="text-[10px] uppercase font-black tracking-widest text-center">Lifecycle</TableHead>
                    <TableHead className="text-[10px] uppercase font-black tracking-widest text-center">AC Capacity</TableHead>
                    <TableHead className="text-[10px] uppercase font-black tracking-widest text-center">DC Capacity</TableHead>
                    <TableHead className="text-[10px] uppercase font-black tracking-widest text-center">GPS</TableHead>
                    <TableHead className="text-right px-6 font-black uppercase text-[10px] tracking-widest">Manage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSitesList.length > 0 ? (
                    filteredSitesList.map((site) => {
                      return (
                        <TableRow key={site.id} className={cn("hover:bg-muted/5 transition-colors group", selectedIds.includes(site.id) && "bg-primary/[0.02]")}>
                          <TableCell className="text-center">
                            <Checkbox 
                              checked={selectedIds.includes(site.id)} 
                              onCheckedChange={() => setSelectedIds(prev => prev.includes(site.id) ? prev.filter(i => i !== site.id) : [...prev, site.id])}
                            />
                          </TableCell>
                          <TableCell className="py-4 text-left">
                            <div className="flex flex-col">
                              <span className="font-bold text-sm text-foreground">{site.name}</span>
                              <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter mt-0.5">{site.projectCompany}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-foreground">
                              <UserIcon className="h-3 w-3 text-primary/40" />
                              {site.projectOwnerName || "—"}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={cn(
                              "text-[8px] font-black uppercase h-5 px-1.5",
                              site.workStatus === 'Completed' ? "bg-green-50 text-green-700 border-green-200" :
                              site.workStatus === 'Cancelled' ? "bg-red-50 text-red-700 border-red-200" :
                              site.workStatus === 'Yet to Start' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                              "bg-blue-50 text-blue-700 border-blue-200"
                            )}>
                              {site.workStatus || "In Progress"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={cn(
                              "text-[8px] font-black uppercase h-5 px-1.5 border-none",
                              site.projectStatus === 'close' ? "bg-slate-900 text-white" : "bg-primary text-white"
                            )}>
                              {site.projectStatus || "open"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-mono text-[10px] font-black text-primary">
                            {formatCapacity(site.acCapacity)} MW
                          </TableCell>
                          <TableCell className="text-center font-mono text-[10px] font-black text-amber-600">
                            {formatCapacity(site.dcCapacity)} MWp
                          </TableCell>
                          <TableCell className="text-center font-mono text-[10px] text-muted-foreground">
                            {site.latitude && site.longitude ? (
                              <span className="opacity-60">Stamped</span>
                            ) : (
                              <span className="opacity-20 italic">No GPS</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm transition-colors" onClick={() => setSiteToEdit(site)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm transition-colors" onClick={() => openDeleteDialog(site)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-muted-foreground italic uppercase font-black text-[10px] opacity-20">
                        No {activeTab} records discovered matching your filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }
}
