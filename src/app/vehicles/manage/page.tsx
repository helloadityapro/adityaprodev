
'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking, writeBatch, useFirebaseApp } from '@/firebase';
import { collection, doc, query, orderBy, where, serverTimestamp, limit, getDocs, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Car, 
  Plus, 
  Search, 
  FilterX, 
  Truck, 
  Navigation,
  Wrench, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  ArrowRight,
  Settings2,
  CheckCircle2,
  Loader2,
  Save,
  X,
  Clock,
  AlertCircle,
  History,
  Trash2,
  RotateCcw,
  User as UserIcon,
  MapPin,
  Calendar,
  Filter,
  Eye,
  FileText,
  Upload,
  Download,
  ShieldCheck,
  FileCheck,
  RefreshCcw,
  Check,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  File as FileIcon,
  FileImage
} from 'lucide-react';
import { isSuperAdmin } from '@/lib/auth-constants';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval } from 'date-fns';
import { Progress } from "@/components/ui/progress";
import { Label } from '@/components/ui/label';

const editVehicleSchema = z.object({
  make: z.string().min(1, 'Make is required.'),
  model: z.string().min(1, 'Model is required.'),
  plateNumber: z.string().min(4, 'Registration number is required.'),
  ownership: z.enum(['Owned', 'Rented']),
  currentReading: z.coerce.number().min(0, 'Odometer reading cannot be negative.'),
  status: z.enum(['Available', 'Allotted', 'Ongoing']),
});

type VehicleDocument = {
  url: string;
  name: string;
  type: string;
  storagePath: string;
  uploadedAt: string;
};

type Vehicle = {
  id: string;
  make: string;
  model: string;
  plateNumber: string;
  ownership: 'Owned' | 'Rented';
  status: 'Available' | 'Allotted' | 'Ongoing';
  currentReading: number;
  createdAt?: any;
  rcDocs?: VehicleDocument[];
  insuranceDocs?: VehicleDocument[];
};

type Assignment = {
  id: string;
  vehicleId: string;
  userId: string;
  userName: string;
  pickupLocation: string;
  dropLocation: string;
  status: string;
  tripDate: string;
  requestDate: any;
  startTime?: any;
  endTime?: any;
  startReading?: number;
  endReading?: number;
  intermediateStops?: { type: 'Site' | 'Other', location: string, purpose: string }[];
};

type UserProfile = {
  id: string;
  username: string;
  role: string;
};

type SortOrderKey = 'plate' | 'reading' | 'status';

export default function ManageVehiclesPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const [vehicleSearch, setVehicleSearch] = React.useState("");
  const [sortConfig, setSortConfig] = React.useState<{ key: SortOrderKey; direction: 'asc' | 'desc' }>({ key: 'plate', direction: 'asc' });
  const [vehicleToEdit, setVehicleToEdit] = React.useState<Vehicle | null>(null);
  const [vehicleToDelete, setVehicleToDelete] = React.useState<Vehicle | null>(null);
  const [vehicleToRelease, setVehicleToRelease] = React.useState<Vehicle | null>(null);
  const [vehicleHistory, setVehicleHistory] = React.useState<Vehicle | null>(null);
  const [vehicleDocs, setVehicleDocs] = React.useState<Vehicle | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const vehiclesQuery = useMemoFirebase(() => collection(firestore, 'vehicles'), [firestore]);
  const { data: vehicles, isLoading: vehiclesLoading } = useCollection<Vehicle>(vehiclesQuery);

  const assignmentsQuery = useMemoFirebase(() => collection(firestore, 'vehicle_assignments'), [firestore]);
  const { data: allAssignments } = useCollection<Assignment>(assignmentsQuery);

  const form = useForm<z.infer<typeof editVehicleSchema>>({
    resolver: zodResolver(editVehicleSchema),
    defaultValues: {
      make: '',
      model: '',
      plateNumber: '',
      ownership: 'Owned',
      currentReading: 0,
      status: 'Available',
    },
  });

  React.useEffect(() => {
    if (vehicleToEdit) {
      form.reset({
        make: vehicleToEdit.make,
        model: vehicleToEdit.model,
        plateNumber: vehicleToEdit.plateNumber,
        ownership: vehicleToEdit.ownership,
        currentReading: vehicleToEdit.currentReading,
        status: vehicleToEdit.status,
      });
    }
  }, [vehicleToEdit, form]);

  React.useEffect(() => {
    if (!isUserLoading && !isProfileLoading && !isAdmin) {
      router.replace('/vehicles/trips/manage');
    }
  }, [isUserLoading, isProfileLoading, isAdmin, router]);

  const onEditSubmit = async (values: z.infer<typeof editVehicleSchema>) => {
    if (!vehicleToEdit) return;
    setIsSubmitting(true);
    try {
      const vehicleRef = doc(firestore, 'vehicles', vehicleToEdit.id);
      updateDocumentNonBlocking(vehicleRef, {
        ...values,
        plateNumber: values.plateNumber.toUpperCase(),
        updatedAt: serverTimestamp(),
      });

      toast({
        title: 'Vehicle Updated',
        description: `${values.plateNumber} record has been modified successfully.`,
      });
      setVehicleToEdit(null);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Could not save changes.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVehicle = () => {
    if (!vehicleToDelete) return;
    deleteDocumentNonBlocking(doc(firestore, 'vehicles', vehicleToDelete.id));
    toast({ title: 'Vehicle Removed', description: `${vehicleToDelete.plateNumber} deleted from registry.` });
    setVehicleToDelete(null);
  };

  const handleReleaseVehicle = async () => {
    if (!vehicleToRelease || !allAssignments) return;
    setIsSubmitting(true);
    try {
      const batch = writeBatch(firestore);
      
      const activeAssignments = allAssignments.filter(a => 
        a.vehicleId === vehicleToRelease.id && 
        (a.status === 'Approved' || a.status === 'Ongoing')
      );

      activeAssignments.forEach(a => {
        batch.update(doc(firestore, 'vehicle_assignments', a.id), {
          status: 'Rejected',
          updatedAt: serverTimestamp(),
          adminRemarks: 'Vehicle force-released by administration.'
        });
      });

      batch.update(doc(firestore, 'vehicles', vehicleToRelease.id), {
        status: 'Available',
        updatedAt: serverTimestamp()
      });

      await batch.commit();
      toast({ title: 'Vehicle Released', description: `${vehicleToRelease.plateNumber} is now available for allotment.` });
      setVehicleToRelease(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSort = (key: SortOrderKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIconComponent = ({ column }: { column: SortOrderKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4 text-primary" /> : <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
  };

  const filteredVehicles = React.useMemo(() => {
    if (!vehicles) return [];
    return vehicles
      .filter(v => 
        v.plateNumber.toLowerCase().includes(vehicleSearch.toLowerCase()) || 
        v.make.toLowerCase().includes(vehicleSearch.toLowerCase()) ||
        v.model.toLowerCase().includes(vehicleSearch.toLowerCase())
      )
      .sort((a, b) => {
        const { key, direction } = sortConfig;
        let valA: any = '';
        let valB: any = '';

        if (key === 'plate') { valA = a.plateNumber; valB = b.plateNumber; }
        else if (key === 'reading') { valA = a.currentReading; valB = b.currentReading; }
        else if (key === 'status') { valA = a.status; valB = b.status; }

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
      });
  }, [vehicles, vehicleSearch, sortConfig]);

  const statsSummary = React.useMemo(() => {
    return {
      total: vehicles?.length || 0,
      available: vehicles?.filter(v => v.status === 'Available').length || 0,
      allotted: vehicles?.filter(v => v.status === 'Allotted').length || 0,
      ongoing: vehicles?.filter(v => v.status === 'Ongoing').length || 0,
    };
  }, [vehicles]);

  if (isUserLoading || isProfileLoading || vehiclesLoading) {
    return (
      <div className="space-y-8 p-4">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Car className="h-6 w-6 text-primary" />
              <h1>Fleet Registry</h1>
            </div>
            <p className="text-muted-foreground text-sm font-medium">Organizational asset management and availability audit.</p>
          </div>
          <Button asChild className="h-10 rounded-sm font-bold shadow-md px-6">
            <Link href="/vehicles/add"><Plus className="h-4 w-4 mr-2" /> Register New Vehicle</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Total Fleet" value={statsSummary.total} icon={Truck} color="primary" />
        <SummaryCard title="Available" value={statsSummary.available} icon={CheckCircle2} color="emerald" />
        <SummaryCard title="Allotted" value={statsSummary.allotted} icon={Clock} color="amber" />
        <SummaryCard title="Ongoing" value={statsSummary.ongoing} icon={Navigation} color="blue" />
      </div>

      <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
        <CardHeader className="bg-muted/5 border-b py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-sm font-bold uppercase tracking-widest">Asset Inventory</CardTitle>
            <CardDescription className="text-xs uppercase font-black text-primary">{statsSummary.total} Records</CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search plate or make..." 
                className="pl-8 h-9 text-xs rounded-sm border-primary/20" 
                value={vehicleSearch} 
                onChange={e => setVehicleSearch(e.target.value)} 
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setVehicleSearch("")} className="h-9 px-3 rounded-sm font-bold text-[10px] uppercase tracking-widest text-muted-foreground">
              <FilterX className="h-3.5 w-3.5 mr-1.5" /> Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="px-6 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('plate')}>
                  <div className="flex items-center">Vehicle <SortIconComponent column="plate" /></div>
                </TableHead>
                <TableHead>Ownership</TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('status')}>
                  <div className="flex items-center">Status <SortIconComponent column="status" /></div>
                </TableHead>
                <TableHead>Current User</TableHead>
                <TableHead className="min-w-[200px]">Current Itinerary</TableHead>
                <TableHead className="text-center cursor-pointer hover:bg-muted/50" onClick={() => handleSort('reading')}>
                  <div className="flex items-center justify-center">Odometer (KM) <SortIconComponent column="reading" /></div>
                </TableHead>
                <TableHead className="text-right px-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVehicles.length > 0 ? filteredVehicles.map((v) => {
                const activeAssignment = allAssignments?.find(a => 
                  a.vehicleId === v.id && (a.status === 'Approved' || a.status === 'Ongoing')
                );

                return (
                  <TableRow key={v.id} className="hover:bg-muted/5 transition-colors">
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{v.make} {v.model}</span>
                        <span className="font-mono text-[10px] font-black text-primary uppercase tracking-widest">{v.plateNumber}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] font-black uppercase rounded-sm border-primary/20 bg-primary/5 text-primary">
                        {v.ownership}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "text-[9px] font-black uppercase rounded-sm px-2 h-5",
                        v.status === 'Available' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        v.status === 'Ongoing' ? "bg-blue-50 text-blue-700 border-blue-200" :
                        "bg-amber-50 text-amber-700 border-amber-200"
                      )}>{v.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {activeAssignment ? (
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-bold">{activeAssignment.userName}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/40 italic font-medium uppercase">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {activeAssignment ? (
                        <div className="flex flex-col gap-0.5 max-w-[200px]">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-foreground">
                            <MapPin className="h-3 w-3 text-emerald-600" />
                            <span className="truncate">{activeAssignment.pickupLocation}</span>
                          </div>
                          {activeAssignment.intermediateStops?.map((stop, sIdx) => (
                            <div key={sIdx} className="flex items-center gap-1.5 text-[9px] font-medium text-muted-foreground ml-4">
                              <ArrowRight className="h-2.5 w-2.5 opacity-50" />
                              <span className="truncate">{stop.location}</span>
                            </div>
                          ))}
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-foreground ml-4">
                            <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                            <span className="truncate">{activeAssignment.dropLocation}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/40 italic font-medium uppercase">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-mono font-bold text-xs text-primary">
                      {v.currentReading.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-sm text-primary hover:bg-primary/10"
                          onClick={() => setVehicleDocs(v)}
                          title="Vehicle Documents"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-sm text-primary hover:bg-primary/10"
                          onClick={() => setVehicleHistory(v)}
                          title="View History"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-sm text-primary hover:bg-primary/10"
                          onClick={() => setVehicleToEdit(v)}
                          title="Settings"
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                        {(v.status === 'Allotted' || v.status === 'Ongoing') && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-amber-600 rounded-sm hover:bg-amber-50"
                            onClick={() => setVehicleToRelease(v)}
                            title="Force Release"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive rounded-sm hover:bg-red-50"
                          onClick={() => setVehicleToDelete(v)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic">No vehicles found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Vehicle Dialog */}
      <Dialog open={!!vehicleToEdit} onOpenChange={(o) => !o && setVehicleToEdit(null)}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col rounded-sm p-0 border-none shadow-2xl">
          <DialogHeader className="p-6 bg-primary/5 border-b">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Edit Vehicle Details</DialogTitle>
            <DialogDescription className="text-xs font-medium">Update registry information for {vehicleToEdit?.plateNumber}.</DialogDescription>
          </DialogHeader>
          <div className="p-6 overflow-y-auto flex-1">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="make"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Make / Brand</FormLabel>
                        <FormControl><Input {...field} className="rounded-sm" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Model</FormLabel>
                        <FormControl><Input {...field} className="rounded-sm" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="plateNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Plate Number</FormLabel>
                        <FormControl><Input {...field} className="rounded-sm font-mono uppercase" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ownership"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ownership</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger className="rounded-sm"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="Owned" className="text-xs font-bold">Owned</SelectItem>
                            <SelectItem value="Rented" className="text-xs font-bold">Rented</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="currentReading"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Odometer (KM)</FormLabel>
                        <FormControl><Input type="number" {...field} className="rounded-sm font-mono" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Current Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger className="rounded-sm"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="Available" className="text-xs font-bold text-emerald-600">Available</SelectItem>
                            <SelectItem value="Allotted" className="text-xs font-bold text-amber-600">Allotted</SelectItem>
                            <SelectItem value="Ongoing" className="text-xs font-bold text-blue-600">Ongoing</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter className="pt-4 border-t gap-2 flex flex-col sm:flex-row">
                  <DialogClose asChild><Button variant="outline" className="flex-1 h-11 rounded-sm font-bold uppercase text-[10px] tracking-widest">Cancel</Button></DialogClose>
                  <Button type="submit" className="flex-1 h-11 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-lg" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Confirm Changes
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>

      <VehicleDocumentsDialog 
        vehicle={vehicleDocs} 
        open={!!vehicleDocs} 
        onOpenChange={(o) => !o && setVehicleDocs(null)} 
      />

      <VehicleHistoryDialog 
        vehicle={vehicleHistory} 
        assignments={allAssignments || []} 
        open={!!vehicleHistory} 
        onOpenChange={(o) => !o && setVehicleHistory(null)} 
      />

      <AlertDialog open={!!vehicleToDelete} onOpenChange={(o) => !o && setVehicleToDelete(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive font-black uppercase tracking-tight">
              <Trash2 className="h-5 w-5" /> De-register Vehicle
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium leading-relaxed">
              Are you sure you want to permanently remove <strong>{vehicleToDelete?.plateNumber}</strong> from the organizational fleet registry? This action cannot be reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteVehicle} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-sm font-bold uppercase text-[10px]">
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!vehicleToRelease} onOpenChange={(o) => !o && setVehicleToRelease(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-700 font-black uppercase tracking-tight">
              <RotateCcw className="h-5 w-5" /> Force Release Asset
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium leading-relaxed">
              Force-releasing <strong>{vehicleToRelease?.plateNumber}</strong> will immediately cancel any active allotments or ongoing journeys linked to this vehicle. The asset will be marked as <strong>Available</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReleaseVehicle} disabled={isSubmitting} className="bg-amber-600 text-white hover:bg-amber-700 rounded-sm font-bold uppercase text-[10px]">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Release Vehicle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function VehicleDocumentsDialog({ vehicle, open, onOpenChange }: { vehicle: Vehicle | null, open: boolean, onOpenChange: (o: boolean) => void }) {
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { toast } = useToast();
  const [uploading, setUploading] = React.useState<Record<string, number>>({});
  const [viewingDoc, setViewingDoc] = React.useState<VehicleDocument | null>(null);

  const handleUpload = async (type: 'rcDocs' | 'insuranceDocs', e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !vehicle) return;

    const storage = getStorage(firebaseApp);
    
    for (const file of Array.from(files)) {
      const timestamp = Date.now();
      const storagePath = `fleet_docs/${vehicle.id}/${type}_${timestamp}_${file.name.replace(/\s+/g, '_')}`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploading(prev => ({ ...prev, [type]: progress }));
        },
        (error) => {
          toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
          setUploading(prev => { const n = {...prev}; delete n[type]; return n; });
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          const newDoc: VehicleDocument = {
            url,
            name: file.name,
            type: file.type,
            storagePath,
            uploadedAt: new Date().toISOString()
          };

          const vehicleRef = doc(firestore, 'vehicles', vehicle.id);
          updateDocumentNonBlocking(vehicleRef, {
            [type]: arrayUnion(newDoc),
            updatedAt: serverTimestamp()
          });

          toast({ title: 'Document Added', description: `${file.name} saved to vehicle record.` });
          setUploading(prev => { const n = {...prev}; delete n[type]; return n; });
        }
      );
    }
  };

  const handleDeleteDoc = async (type: 'rcDocs' | 'insuranceDocs', docToDelete: VehicleDocument) => {
    if (!vehicle) return;
    try {
      const storage = getStorage(firebaseApp);
      await deleteObject(ref(storage, docToDelete.storagePath)).catch(e => console.warn("Missing from storage", e));
      
      const vehicleRef = doc(firestore, 'vehicles', vehicle.id);
      updateDocumentNonBlocking(vehicleRef, {
        [type]: arrayRemove(docToDelete),
        updatedAt: serverTimestamp()
      });
      toast({ title: 'Removed', description: 'Document deleted from registry.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl rounded-sm p-0 overflow-hidden border-none shadow-2xl bg-background flex flex-col h-[85vh]">
          <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 flex flex-row items-center justify-between space-y-0 text-left">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-sm"><ShieldCheck className="h-5 w-5 text-primary" /></div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight leading-none">Fleet Documents</DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{vehicle?.plateNumber} Registry</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-10">
              <DocSection 
                label="Registration Certificate (RC)" 
                docs={vehicle?.rcDocs} 
                loading={uploading.rcDocs} 
                onUpload={(e) => handleUpload('rcDocs', e)} 
                onView={(d) => setViewingDoc(d)}
                onDelete={(d) => handleDeleteDoc('rcDocs', d)}
              />
              <DocSection 
                label="Insurance Certificates" 
                docs={vehicle?.insuranceDocs} 
                loading={uploading.insuranceDocs} 
                onUpload={(e) => handleUpload('insuranceDocs', e)} 
                onView={(d) => setViewingDoc(d)}
                onDelete={(d) => handleDeleteDoc('insuranceDocs', d)}
              />
            </div>
          </ScrollArea>

          <DialogFooter className="p-4 bg-muted/5 border-t shrink-0">
            <DialogClose asChild><Button variant="outline" className="w-full rounded-sm font-bold uppercase text-[10px] h-10 px-8">Close Manager</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DocumentViewerDialog 
        file={viewingDoc} 
        open={!!viewingDoc} 
        onOpenChange={(o) => !o && setViewingDoc(null)} 
      />
    </>
  );
}

function DocSection({ label, docs, loading, onUpload, onView, onDelete }: { 
  label: string, 
  docs?: VehicleDocument[], 
  loading?: number, 
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void, 
  onView: (doc: VehicleDocument) => void,
  onDelete: (doc: VehicleDocument) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b pb-2">
        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{label}</Label>
        <div className="flex items-center gap-2">
          <Badge variant={docs?.length ? "default" : "outline"} className={cn(
            "rounded-sm text-[8px] font-black uppercase h-5",
            docs?.length ? "bg-emerald-600 text-white border-none" : "text-muted-foreground/40 border-muted"
          )}>
            {docs?.length || 0} Files
          </Badge>
          <label className="cursor-pointer">
            <Badge variant="outline" className="h-5 rounded-sm border-primary/20 text-primary hover:bg-primary/5 transition-colors text-[8px] font-black uppercase">
              <Plus className="h-2 w-2 mr-1" /> Add File
            </Badge>
            <input type="file" multiple className="hidden" onChange={onUpload} />
          </label>
        </div>
      </div>

      <div className="space-y-3">
        {loading !== undefined && (
          <div className="p-3 border rounded-sm bg-muted/5 space-y-1.5">
            <div className="flex items-center justify-between text-[8px] font-bold uppercase text-primary">
              <span>Transferring...</span>
              <span>{Math.round(loading)}%</span>
            </div>
            <Progress value={loading} className="h-0.5" />
          </div>
        )}

        {docs && docs.length > 0 ? (
          <div className="grid gap-2">
            {docs.map((doc, idx) => {
              const isImg = doc.type.startsWith('image/');
              return (
                <div key={idx} className="p-3 border rounded-sm bg-background flex items-center justify-between group hover:border-primary/20 transition-all shadow-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-12 bg-muted rounded-sm overflow-hidden border shrink-0">
                       {isImg ? <img src={doc.url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-primary/5"><FileText className="h-4 w-4 text-primary/40" /></div>}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-bold truncate max-w-[200px] text-foreground uppercase tracking-tight">{doc.name}</span>
                      <span className="text-[8px] font-medium text-muted-foreground/60">{format(new Date(doc.uploadedAt), 'dd MMM yyyy')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-primary rounded-sm hover:bg-primary/10" onClick={() => onView(doc)}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-primary rounded-sm hover:bg-primary/10" asChild><a href={doc.url} download={doc.name} target="_blank"><Download className="h-4 w-4" /></a></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive rounded-sm hover:bg-red-50" onClick={() => onDelete(doc)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center border-2 border-dashed rounded-sm opacity-20 bg-muted/5 flex flex-col items-center gap-2">
             <FileIcon className="h-8 w-8" />
             <p className="text-[9px] font-black uppercase tracking-widest">No documentation logged</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentViewerDialog({ file, open, onOpenChange }: { file: VehicleDocument | null, open: boolean, onOpenChange: (o: boolean) => void }) {
  const [scale, setScale] = React.useState(1);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [startPan, setStartPan] = React.useState({ x: 0, y: 0 });
  const [rotation, setRotation] = React.useState(0);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const mediaRef = React.useRef<HTMLDivElement>(null);

  const isPdf = file?.type.includes('pdf') || file?.url.toLowerCase().endsWith('.pdf');
  const isImg = file?.type.startsWith('image/') || (file && /\.(jpg|jpeg|png|webp)$/i.test(file.url));

  const resetViewer = () => { setScale(1); setPosition({ x: 0, y: 0 }); setRotation(0); };

  const handleWheel = (e: React.WheelEvent) => {
    if (!isImg) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    const newScale = Math.min(Math.max(scale + delta, 1), 4);
    setScale(newScale);
    if (newScale === 1) setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1 || !isImg) return;
    setIsDragging(true);
    setStartPan({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    const newX = e.clientX - startPan.x;
    const newY = e.clientY - startPan.y;
    const limitX = Math.max(0, (window.innerWidth * scale - window.innerWidth) / 2);
    const limitY = Math.max(0, (window.innerHeight * scale - window.innerHeight) / 2);
    setPosition({ x: Math.min(Math.max(newX, -limitX), limitX), y: Math.min(Math.max(newY, -limitY), limitY) });
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[90vh] p-0 border-none bg-black/95 flex flex-col items-center justify-center rounded-sm overflow-hidden shadow-2xl z-[100]">
        <DialogHeader className="sr-only"><DialogTitle>Audit Document Detail</DialogTitle></DialogHeader>
        <div className="absolute top-0 left-0 right-0 z-[110] flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent no-print">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-1.5 rounded-sm"><FileIcon className="h-4 w-4 text-white" /></div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-white uppercase tracking-widest truncate max-w-[200px]">{file?.name}</span>
              <span className="text-[8px] font-bold text-white/50 uppercase tracking-tighter">Fleet Compliance Copy</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isImg && (
              <>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-white/10" onClick={() => setScale(prev => Math.min(prev + 0.5, 4))}><ZoomIn className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-white/10" onClick={() => { setScale(prev => Math.max(prev - 0.5, 1)); if(scale <= 1) setPosition({x:0,y:0}); }}><ZoomOut className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-white/10" onClick={() => setRotation(prev => (prev + 90) % 360)}><RotateCw className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-white/10" onClick={resetViewer}><RotateIcon className="h-5 w-5" /></Button>
              </>
            )}
            <Separator orientation="vertical" className="h-6 bg-white/20 mx-2" />
            <DialogClose asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-red-500"><X className="h-6 w-6" /></Button></DialogClose>
          </div>
        </div>

        <div 
          ref={containerRef} 
          className={cn("relative w-full h-full flex items-center justify-center overflow-hidden touch-none z-[105]", isImg && scale > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default")} 
          onWheel={handleWheel} 
          onMouseDown={handleMouseDown} 
          onMouseMove={handleMouseMove} 
          onMouseUp={handleMouseUp} 
          onMouseLeave={handleMouseUp}
        >
          <div 
            ref={mediaRef} 
            className={cn("transition-transform duration-200 ease-out flex items-center justify-center pointer-events-none w-fit h-fit", isDragging && "transition-none")} 
            style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)` }}
          >
            {file && (
              isPdf ? (
                <div className="pointer-events-auto w-[90vw] h-[75vh] bg-white rounded-sm shadow-2xl"><iframe src={file.url} className="w-full h-full border-none" /></div>
              ) : (
                <img src={file.url} className="max-w-[90vw] max-h-[75vh] object-contain shadow-2xl rounded-sm" alt="Document" />
              )
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VehicleHistoryDialog({ vehicle, assignments, open, onOpenChange }: { vehicle: Vehicle | null, assignments: Assignment[], open: boolean, onOpenChange: (o: boolean) => void }) {
  const [filter, setFilter] = React.useState<string>("all");

  const filteredHistory = React.useMemo(() => {
    if (!vehicle || !assignments) return [];
    const list = assignments.filter(a => a.vehicleId === vehicle.id && a.status === 'Completed');
    return list.sort((a, b) => {
      const da = a.endTime?.toDate?.()?.getTime() || 0;
      const db = b.endTime?.toDate?.()?.getTime() || 0;
      return db - da;
    });
  }, [vehicle, assignments]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] rounded-sm p-0 overflow-hidden border-none shadow-2xl bg-background h-[80vh] flex flex-col">
        <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 text-left">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-sm"><History className="h-5 w-5 text-primary" /></div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Vehicle Deployment History</DialogTitle>
              <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{vehicle?.plateNumber}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <ScrollArea className="flex-1">
          <Table>
            <TableHeader className="bg-muted/30 sticky top-0 z-10 shadow-sm">
              <TableRow>
                <TableHead className="px-6">Timeline</TableHead>
                <TableHead>Requester</TableHead>
                <TableHead>Itinerary</TableHead>
                <TableHead className="text-right px-6">KM Run</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistory.map((a) => (
                <TableRow key={a.id} className="hover:bg-muted/5">
                  <TableCell className="px-6 py-4">
                    <div className="flex flex-col gap-0.5 whitespace-nowrap">
                      <span className="text-xs font-bold">{a.tripDate}</span>
                      <span className="text-[9px] font-mono font-bold text-muted-foreground uppercase">{format(a.startTime.toDate(), 'HH:mm')} - {format(a.endTime.toDate(), 'HH:mm')}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-medium uppercase">{a.userName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                      <span className="truncate max-w-[100px]">{a.pickupLocation}</span>
                      <ArrowRight className="h-3 w-3 shrink-0" />
                      <span className="truncate max-w-[100px]">{a.dropLocation}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right px-6 font-mono font-black text-primary">
                    {a.startReading && a.endReading ? (a.endReading - a.startReading).toFixed(1) : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {filteredHistory.length === 0 && (
                <TableRow><TableCell colSpan={4} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[10px] opacity-30">No completed journeys logged</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
        <DialogFooter className="p-4 bg-muted/5 border-t">
          <DialogClose asChild><Button variant="outline" className="w-full rounded-sm font-bold h-10 px-8">Close Audit</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({ title, value, icon: Icon, color }: { title: string, value: number, icon: any, color: 'primary' | 'emerald' | 'blue' | 'amber' }) {
  const colors = {
    primary: "bg-primary/5 border-primary/10 text-primary",
    emerald: "bg-emerald-500/5 border-emerald-500/10 text-emerald-600",
    blue: "bg-blue-500/5 border-blue-500/10 text-blue-600",
    amber: "bg-amber-500/5 border-amber-500/10 text-amber-600",
  };

  return (
    <Card className={cn("rounded-sm border shadow-sm", colors[color])}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4">
        <CardTitle className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
        <Icon className="h-3.5 sm:h-4 sm:w-4" />
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0">
        <div className="text-xl sm:text-2xl font-black">{value}</div>
      </CardContent>
    </Card>
  );
}
