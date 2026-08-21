'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking, writeBatch, useFirebaseApp } from '@/firebase';
import { collection, doc, query, orderBy, where, serverTimestamp, limit, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
  Check
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
import { format, subWeeks, subMonths, subYears, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval } from 'date-fns';
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

type Vehicle = {
  id: string;
  make: string;
  model: string;
  plateNumber: string;
  ownership: 'Owned' | 'Rented';
  status: 'Available' | 'Allotted' | 'Ongoing';
  currentReading: number;
  createdAt?: any;
  rcUrl?: string;
  rcName?: string;
  insuranceUrl?: string;
  insuranceName?: string;
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

      {/* History Dialog */}
      <VehicleHistoryDialog 
        vehicle={vehicleHistory} 
        assignments={allAssignments || []} 
        open={!!vehicleHistory} 
        onOpenChange={(o) => !o && setVehicleHistory(null)} 
      />

      {/* Delete Confirmation */}
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

      {/* Release Confirmation */}
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

  const handleUpload = async (type: 'rc' | 'insurance', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !vehicle) return;

    try {
      const storage = getStorage(firebaseApp);
      const storagePath = `fleet_docs/${vehicle.id}/${type}_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
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
          const vehicleRef = doc(firestore, 'vehicles', vehicle.id);
          
          const updateData: any = {};
          if (type === 'rc') {
            updateData.rcUrl = url;
            updateData.rcName = file.name;
          } else {
            updateData.insuranceUrl = url;
            updateData.insuranceName = file.name;
          }

          updateDocumentNonBlocking(vehicleRef, { ...updateData, updatedAt: serverTimestamp() });
          toast({ title: 'Document Saved', description: `${type.toUpperCase()} updated for ${vehicle.plateNumber}.` });
          setUploading(prev => { const n = {...prev}; delete n[type]; return n; });
        }
      );
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-sm p-0 overflow-hidden border-none shadow-2xl bg-background">
        <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 flex flex-row items-center justify-between space-y-0 text-left">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-sm"><ShieldCheck className="h-5 w-5 text-primary" /></div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Compliance Documents</DialogTitle>
              <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{vehicle?.plateNumber}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-8">
          <DocSection 
            label="Registration Certificate (RC)" 
            url={vehicle?.rcUrl} 
            name={vehicle?.rcName} 
            loading={uploading.rc} 
            onUpload={(e) => handleUpload('rc', e)} 
          />
          <DocSection 
            label="Insurance Document" 
            url={vehicle?.insuranceUrl} 
            name={vehicle?.insuranceName} 
            loading={uploading.insurance} 
            onUpload={(e) => handleUpload('insurance', e)} 
          />
        </div>

        <DialogFooter className="p-4 bg-muted/5 border-t">
          <DialogClose asChild><Button variant="outline" className="w-full rounded-sm font-bold uppercase text-[10px] h-10 px-8">Close Manager</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocSection({ label, url, name, loading, onUpload }: { label: string, url?: string, name?: string, loading?: number, onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  const isUploaded = !!url;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{label}</Label>
        <Badge variant={isUploaded ? "default" : "outline"} className={cn(
          "rounded-sm text-[8px] font-black uppercase h-5",
          isUploaded ? "bg-emerald-600 text-white border-none" : "text-muted-foreground/40 border-muted"
        )}>
          {isUploaded ? <><Check className="h-2 w-2 mr-1" /> Available</> : "Missing"}
        </Badge>
      </div>

      <div className="relative group">
        {loading !== undefined ? (
          <div className="p-4 border rounded-sm bg-muted/5 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-primary">
              <span>Transferring...</span>
              <span>{Math.round(loading)}%</span>
            </div>
            <Progress value={loading} className="h-1" />
          </div>
        ) : isUploaded ? (
          <div className="p-4 border rounded-sm bg-primary/5 flex items-center justify-between shadow-sm animate-in fade-in duration-300">
            <div className="flex items-center gap-3 min-w-0">
              <div className="bg-primary/10 p-2 rounded-sm"><FileCheck className="h-4 w-4 text-primary" /></div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold truncate max-w-[150px]">{name}</span>
                <span className="text-[8px] font-black uppercase text-muted-foreground">Professional Copy</span>
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" /></a>
              </Button>
              <label className="cursor-pointer h-8 w-8 flex items-center justify-center rounded-sm text-primary hover:bg-primary/10 transition-colors">
                <RefreshCcw className="h-4 w-4" />
                <input type="file" className="hidden" accept="image/*,application/pdf" onChange={onUpload} />
              </label>
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-sm cursor-pointer hover:bg-muted/50 transition-all bg-muted/5 group">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-6 h-6 mb-2 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 group-hover:text-primary transition-colors">Select {label}</p>
            </div>
            <input type="file" className="hidden" accept="image/*,application/pdf" onChange={onUpload} />
          </label>
        )}
      </div>
    </div>
  );
}

function VehicleHistoryDialog({ vehicle, assignments, open, onOpenChange }: { vehicle: Vehicle | null, assignments: Assignment[], open: boolean, onOpenChange: (o: boolean) => void }) {
  const [filter, setFilter] = React.useState<string>("all");
  const [customStart, setCustomStart] = React.useState("");
  const [customEnd, setCustomEnd] = React.useState("");

  const filteredHistory = React.useMemo(() => {
    if (!vehicle || !assignments) return [];
    
    let list = assignments.filter(a => a.vehicleId === vehicle.id && a.status === 'Completed');
    
    const now = new Date();
    if (filter === 'week') {
      const start = startOfWeek(now);
      const end = endOfWeek(now);
      list = list.filter(a => {
        const d = a.endTime?.toDate?.() || new Date(a.endTime);
        return isWithinInterval(d, { start, end });
      });
    } else if (filter === 'month') {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      list = list.filter(a => {
        const d = a.endTime?.toDate?.() || new Date(a.endTime);
        return isWithinInterval(d, { start, end });
      });
    } else if (filter === 'year') {
      const start = startOfYear(now);
      const end = endOfYear(now);
      list = list.filter(a => {
        const d = a.endTime?.toDate?.() || new Date(a.endTime);
        return isWithinInterval(d, { start, end });
      });
    } else if (filter === 'custom' && customStart && customEnd) {
      const start = new Date(customStart);
      const end = new Date(customEnd);
      list = list.filter(a => {
        const d = a.endTime?.toDate?.() || new Date(a.endTime);
        return isWithinInterval(d, { start, end });
      });
    }

    return list.sort((a, b) => {
      const da = a.endTime?.toDate?.()?.getTime() || 0;
      const db = b.endTime?.toDate?.()?.getTime() || 0;
      return db - da;
    });
  }, [vehicle, assignments, filter, customStart, customEnd]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] p-0 overflow-hidden border-none shadow-2xl bg-background h-[85vh] flex flex-col">
        <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-sm"><History className="h-5 w-5 text-primary" /></div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Trip Audit Trail</DialogTitle>
              <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{vehicle?.plateNumber} — {vehicle?.make} {vehicle?.model}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 border-b bg-muted/10 flex flex-col sm:flex-row items-center gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40 h-9 rounded-sm text-xs font-bold uppercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-bold uppercase">All Time</SelectItem>
                <SelectItem value="week" className="text-xs font-bold uppercase">This Week</SelectItem>
                <SelectItem value="month" className="text-xs font-bold uppercase">This Month</SelectItem>
                <SelectItem value="year" className="text-xs font-bold uppercase">This Year</SelectItem>
                <SelectItem value="custom" className="text-xs font-bold uppercase text-primary">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filter === 'custom' && (
            <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-9 w-36 rounded-sm text-xs" />
              <span className="text-xs font-black text-muted-foreground">TO</span>
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-9 w-36 rounded-sm text-xs" />
            </div>
          )}

          <div className="ml-auto">
            <Badge variant="secondary" className="rounded-sm font-black uppercase text-[10px] bg-primary/10 text-primary border-none">{filteredHistory.length} Trip(s)</Badge>
          </div>
        </div>

        <ScrollArea className="flex-1 p-0">
          <Table>
            <TableHeader className="bg-muted/30 sticky top-0 z-10">
              <TableRow>
                <TableHead className="px-6">Timeline</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="min-w-[200px]">Itinerary</TableHead>
                <TableHead className="text-right px-6">Distance (KM)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistory.length > 0 ? filteredHistory.map((a) => (
                <TableRow key={a.id} className="hover:bg-muted/5 transition-colors">
                  <TableCell className="px-6 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-foreground">{a.tripDate}</span>
                      <span className="text-[10px] text-muted-foreground font-mono uppercase">{a.startTime ? format(a.startTime.toDate(), 'HH:mm') : '—'} TO {a.endTime ? format(a.endTime.toDate(), 'HH:mm') : '—'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold">{a.userName}</span>
                      <span className="text-[10px] text-muted-foreground uppercase font-medium">{a.id.slice(0, 8)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 uppercase">
                        <MapPin className="h-2.5 w-2.5" /> {a.pickupLocation}
                      </div>
                      {a.intermediateStops?.map((stop, sIdx) => (
                        <div key={sIdx} className="flex items-center gap-1 text-[9px] font-medium text-muted-foreground ml-3">
                          <ArrowRight className="h-2.5 w-2.5 opacity-50" /> {stop.location}
                        </div>
                      ))}
                      <div className="flex items-center gap-1 text-[10px] font-bold text-red-700 uppercase ml-3">
                        <ArrowRight className="h-2.5 w-2.5" /> {a.dropLocation}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right px-6 font-mono font-black text-primary">
                    {a.startReading && a.endReading ? (a.endReading - a.startReading).toFixed(1) : '—'}
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={4} className="h-48 text-center text-muted-foreground italic text-xs uppercase font-bold opacity-40">No historical records discovered for this range</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
        <DialogFooter className="p-4 bg-muted/5 border-t shrink-0"><DialogClose asChild><Button variant="outline" className="w-full sm:w-auto rounded-sm font-black uppercase text-[10px] h-10 px-8">Close Audit</Button></DialogClose></DialogFooter>
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
