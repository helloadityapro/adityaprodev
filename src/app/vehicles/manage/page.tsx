'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, where, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Settings2,
  CheckCircle2,
  Loader2,
  Save,
  X,
  Clock,
  AlertCircle
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
};

type UserProfile = {
  id: string;
  username: string;
  role: string;
};

type SortKey = 'plate' | 'reading' | 'status';

export default function ManageVehiclesPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const [vehicleSearch, setVehicleSearch] = React.useState("");
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'plate', direction: 'asc' });
  const [vehicleToEdit, setVehicleToEdit] = React.useState<Vehicle | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const vehiclesQuery = useMemoFirebase(() => collection(firestore, 'vehicles'), [firestore]);
  const { data: vehicles, isLoading: vehiclesLoading } = useCollection<Vehicle>(vehiclesQuery);

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

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
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

  const stats = React.useMemo(() => {
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

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Total Fleet" value={stats.total} icon={Truck} color="primary" />
        <SummaryCard title="Available" value={stats.available} icon={CheckCircle2} color="emerald" />
        <SummaryCard title="Allotted" value={stats.allotted} icon={Clock} color="amber" />
        <SummaryCard title="Ongoing" value={stats.ongoing} icon={Navigation} color="blue" />
      </div>

      <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
        <CardHeader className="bg-muted/5 border-b py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-sm font-bold uppercase tracking-widest">Asset Inventory</CardTitle>
            <CardDescription className="text-xs uppercase font-black text-primary">{stats.total} Records</CardDescription>
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
                  <div className="flex items-center">Vehicle & Registry <SortIcon column="plate" /></div>
                </TableHead>
                <TableHead>Ownership</TableHead>
                <TableHead className="text-center cursor-pointer hover:bg-muted/50" onClick={() => handleSort('reading')}>
                  <div className="flex items-center justify-center">Odometer (KM) <SortIcon column="reading" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('status')}>
                  <div className="flex items-center">Status <SortIcon column="status" /></div>
                </TableHead>
                <TableHead className="text-right px-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVehicles.length > 0 ? filteredVehicles.map((v) => (
                <TableRow key={v.id} className="hover:bg-muted/5 transition-colors">
                  <TableCell className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm">{v.make} {v.model}</span>
                      <span className="text-[10px] font-mono font-black text-primary uppercase tracking-widest">{v.plateNumber}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[9px] font-black uppercase rounded-sm border-primary/20 bg-primary/5 text-primary">
                      {v.ownership}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-mono font-bold text-xs text-primary">
                    {v.currentReading.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "text-[9px] font-black uppercase rounded-sm px-2 h-5",
                      v.status === 'Available' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      v.status === 'Ongoing' ? "bg-blue-50 text-blue-700 border-blue-200" :
                      "bg-amber-50 text-amber-700 border-amber-200"
                    )}>
                      {v.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right px-6">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-sm text-primary hover:bg-primary/10"
                      onClick={() => setVehicleToEdit(v)}
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">No vehicles found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Vehicle Dialog */}
      <Dialog open={!!vehicleToEdit} onOpenChange={(o) => !o && setVehicleToEdit(null)}>
        <DialogContent className="sm:max-w-[500px] rounded-sm p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-primary/5 border-b">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Edit Vehicle Details</DialogTitle>
            <DialogDescription className="text-xs font-medium">Update registry information for {vehicleToEdit?.plateNumber}.</DialogDescription>
          </DialogHeader>
          <div className="p-6">
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
    </div>
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
