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
  Clock, 
  CheckCircle2, 
  XCircle, 
  User, 
  MapPin, 
  Plus, 
  Loader2, 
  Search, 
  FilterX, 
  Truck, 
  Fuel, 
  ArrowRight, 
  Users, 
  Settings2, 
  Wrench, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Navigation,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { isSuperAdmin } from '@/lib/auth-constants';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

type Vehicle = {
  id: string;
  make: string;
  model: string;
  plateNumber: string;
  ownership: string;
  status: 'Available' | 'Assigned' | 'Maintenance';
  currentReading: number;
  createdAt?: any;
};

type Assignment = {
  id: string;
  userId: string;
  userName: string;
  purpose: string;
  pickupLocation: string;
  destinations: { type: string, location: string, purpose: string }[];
  status: 'Pending' | 'Approved' | 'Ongoing' | 'Completed' | 'Rejected';
  requestDate: any;
  vehicleId?: string;
  driverId?: string;
  coPassengers?: { id: string, name: string }[];
};

type UserProfile = {
  id: string;
  username: string;
  role: string;
};

type SortKey = 'plate' | 'reading' | 'status' | 'requestDate' | 'requester';

export default function ManageVehiclesPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const [activeTab, setActiveTab] = React.useState("inventory");
  const [vehicleSearch, setVehicleSearch] = React.useState("");
  const [queueSearch, setQueueSearch] = React.useState("");
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'plate', direction: 'asc' });
  const [approvalTarget, setApprovalState] = React.useState<{ assignment: Assignment, vehicleId: string, driverId: string } | null>(null);

  const vehiclesQuery = useMemoFirebase(() => collection(firestore, 'vehicles'), [firestore]);
  const { data: vehicles, isLoading: vehiclesLoading } = useCollection<Vehicle>(vehiclesQuery);

  const assignmentsQuery = useMemoFirebase(() => query(collection(firestore, 'vehicle_assignments'), orderBy('requestDate', 'desc')), [firestore]);
  const { data: assignments, isLoading: assignmentsLoading } = useCollection<Assignment>(assignmentsQuery);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers } = useCollection<UserProfile>(usersQuery);

  const drivers = React.useMemo(() => allUsers?.filter(u => u.role === 'Driver') || [], [allUsers]);

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

  const filteredQueue = React.useMemo(() => {
    if (!assignments) return [];
    return assignments
      .filter(a => 
        a.userName.toLowerCase().includes(queueSearch.toLowerCase()) ||
        a.pickupLocation.toLowerCase().includes(queueSearch.toLowerCase())
      )
      .sort((a, b) => {
        const { key, direction } = sortConfig;
        let valA: any = '';
        let valB: any = '';

        if (key === 'requestDate') { valA = a.requestDate?.toDate?.()?.getTime() || 0; valB = b.requestDate?.toDate?.()?.getTime() || 0; }
        else if (key === 'requester') { valA = a.userName; valB = b.userName; }

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
      });
  }, [assignments, queueSearch, sortConfig]);

  const stats = React.useMemo(() => {
    return {
      total: vehicles?.length || 0,
      available: vehicles?.filter(v => v.status === 'Available').length || 0,
      assigned: vehicles?.filter(v => v.status === 'Assigned').length || 0,
      maintenance: vehicles?.filter(v => v.status === 'Maintenance').length || 0,
      pendingRequests: assignments?.filter(a => a.status === 'Pending').length || 0
    };
  }, [vehicles, assignments]);

  const handleApprove = async () => {
    if (!approvalTarget?.vehicleId || !approvalTarget?.driverId) {
      toast({ variant: 'destructive', title: 'Selection Required', description: 'Please allot a vehicle and driver.' });
      return;
    }

    const { assignment, vehicleId, driverId } = approvalTarget;
    const vehicle = vehicles?.find(v => v.id === vehicleId);
    const driver = drivers?.find(d => d.id === driverId);

    try {
      updateDocumentNonBlocking(doc(firestore, 'vehicle_assignments', assignment.id), {
        status: 'Approved',
        vehicleId,
        vehicleDetails: `${vehicle?.make} ${vehicle?.model} (${vehicle?.plateNumber})`,
        driverId,
        driverName: driver?.username || 'Assigned Driver',
        approvalDate: serverTimestamp(),
      });

      updateDocumentNonBlocking(doc(firestore, 'vehicles', vehicleId), { status: 'Assigned' });

      toast({ title: 'Trip Authorized', description: 'Resources have been successfully alloted.' });
      setApprovalState(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const handleReject = (id: string) => {
    updateDocumentNonBlocking(doc(firestore, 'vehicle_assignments', id), {
      status: 'Rejected',
      processedDate: serverTimestamp(),
    });
    toast({ title: 'Request Rejected' });
  };

  if (isUserLoading || isProfileLoading || vehiclesLoading || assignmentsLoading) {
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

  if (!isAdmin && user) return <div className="p-12 text-center uppercase font-black text-destructive tracking-widest">Unauthorized Access</div>;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Car className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-black tracking-tight uppercase">Fleet Management</h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium">Registry audit and organizational trip allotment control.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild className="h-10 rounded-sm font-bold shadow-md px-6">
            <Link href="/vehicles/add"><Plus className="h-4 w-4 mr-2" /> Register New Vehicle</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Total Fleet" value={stats.total} icon={Truck} color="primary" />
        <SummaryCard title="Available" value={stats.available} icon={CheckCircle2} color="emerald" />
        <SummaryCard title="On Trip" value={stats.assigned} icon={Navigation} color="blue" />
        <SummaryCard title="Maintenance" value={stats.maintenance} icon={Wrench} color="amber" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <TabsList className="bg-muted/50 border border-primary/10 rounded-sm p-1">
            <TabsTrigger value="inventory" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-8">Fleet Registry</TabsTrigger>
            <TabsTrigger value="queue" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-8 relative">
              Allotment Queue
              {stats.pendingRequests > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 rounded-full bg-red-500 text-[10px] font-black">{stats.pendingRequests}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            {activeTab === 'inventory' ? (
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search plate, make..." className="pl-8 h-9 text-xs rounded-sm border-primary/20" value={vehicleSearch} onChange={e => setVehicleSearch(e.target.value)} />
              </div>
            ) : (
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search personnel..." className="pl-8 h-9 text-xs rounded-sm border-primary/20" value={queueSearch} onChange={e => setQueueSearch(e.target.value)} />
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={() => { setVehicleSearch(""); setQueueSearch(""); }} className="h-9 px-3 rounded-sm font-bold text-[10px] uppercase tracking-widest text-muted-foreground">
              <FilterX className="h-3.5 w-3.5 mr-1.5" /> Clear
            </Button>
          </div>
        </div>

        <TabsContent value="inventory" className="animate-in fade-in-50 duration-300">
          <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-6 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('plate')}>
                      <div className="flex items-center">Asset Details <SortIcon column="plate" /></div>
                    </TableHead>
                    <TableHead>Ownership</TableHead>
                    <TableHead className="text-center cursor-pointer hover:bg-muted/50" onClick={() => handleSort('reading')}>
                      <div className="flex items-center justify-center">Odometer <SortIcon column="reading" /></div>
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
                        {v.currentReading.toLocaleString()} KM
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          "text-[9px] font-black uppercase rounded-sm px-2 h-5",
                          v.status === 'Available' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          v.status === 'Assigned' ? "bg-blue-50 text-blue-700 border-blue-200" :
                          "bg-amber-50 text-amber-700 border-amber-200"
                        )}>
                          {v.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm text-primary hover:bg-primary/10">
                            <Settings2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">No vehicles found matching search criteria.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queue" className="animate-in fade-in-50 duration-300">
          <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-6 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('requester')}>
                      <div className="flex items-center">Requester & Intent <SortIcon column="requester" /></div>
                    </TableHead>
                    <TableHead>Route & Stops</TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('requestDate')}>
                      <div className="flex items-center">Logged On <SortIcon column="requestDate" /></div>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right px-6">Allotment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQueue.length > 0 ? filteredQueue.map((req) => (
                    <TableRow key={req.id} className="hover:bg-muted/5 transition-colors">
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-sm text-foreground">{req.userName}</span>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/20 text-primary h-4 px-1">
                              <Users className="h-2.5 w-2.5 mr-1" /> +{req.coPassengers?.length || 0}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground italic truncate max-w-[150px]">"{req.purpose}"</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-black text-emerald-700">
                            <MapPin className="h-3 w-3" /> {req.pickupLocation}
                          </div>
                          <div className="flex flex-col gap-1 ml-4 border-l-2 border-primary/10 pl-2">
                            {req.destinations?.slice(0, 2).map((dest, idx) => (
                              <div key={idx} className="flex flex-col leading-tight">
                                <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                                  <ArrowRight className="h-2.5 w-2.5" /> {dest.location}
                                </span>
                              </div>
                            ))}
                            {req.destinations?.length > 2 && (
                              <span className="text-[8px] font-black text-muted-foreground uppercase pl-4">+{req.destinations.length - 2} more stops</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-[10px] font-mono font-bold text-muted-foreground">
                        {req.requestDate ? format(req.requestDate.toDate(), 'dd MMM HH:mm') : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          "text-[8px] font-black uppercase rounded-sm px-1.5 h-5",
                          req.status === 'Pending' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                          req.status === 'Approved' ? "bg-blue-50 text-blue-700 border-blue-200" :
                          req.status === 'Ongoing' ? "bg-primary text-white border-none" :
                          req.status === 'Completed' ? "bg-green-50 text-green-700 border-green-200" :
                          "bg-red-50 text-red-700 border-red-200"
                        )}>
                          {req.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right px-6">
                        {req.status === 'Pending' ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" className="h-8 rounded-sm font-black text-[10px] uppercase px-4 shadow-sm" onClick={() => setApprovalState({ assignment: req, vehicleId: "", driverId: "" })}>
                              Process Allotment
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50 rounded-sm" onClick={() => handleReject(req.id)}>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" asChild>
                            <Link href={`/vehicles/assigned?view=${req.id}`}><Eye className="h-4 w-4" /></Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">Queue is currently empty.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modern Allotment Modal */}
      <Dialog open={!!approvalTarget} onOpenChange={(o) => !o && setApprovalState(null)}>
        <DialogContent className="max-w-xl p-0 overflow-hidden border-none rounded-sm shadow-2xl bg-background">
          <DialogHeader className="p-6 bg-primary/5 border-b shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-sm"><Fuel className="h-5 w-5 text-primary" /></div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Authorize Trip Allotment</DialogTitle>
                <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Requester: {approvalTarget?.assignment?.userName}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            <div className="p-6 space-y-8">
              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-2">
                  <MapPin className="h-3 w-3" /> Logged Route Itinerary
                </Label>
                <div className="bg-muted/20 border rounded-sm p-4 space-y-4">
                  <div className="relative pl-6 border-l-2 border-emerald-500">
                    <div className="absolute -left-[7px] top-0 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-background" />
                    <p className="text-[10px] font-black uppercase text-emerald-700 tracking-tighter">Pickup Location</p>
                    <p className="text-sm font-black">{approvalTarget?.assignment.pickupLocation}</p>
                  </div>
                  {approvalTarget?.assignment.destinations.map((d, i) => (
                    <div key={i} className="relative pl-6 border-l-2 border-primary">
                      <div className="absolute -left-[7px] top-0 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                      <p className="text-[10px] font-black uppercase text-primary tracking-tighter">Destination {i + 1}</p>
                      <p className="text-sm font-black">{d.location}</p>
                      <div className="flex items-start gap-2 mt-1 bg-white/50 p-2 rounded-sm border border-primary/5">
                        <FileText className="h-3 w-3 text-muted-foreground mt-0.5" />
                        <p className="text-[10px] font-bold text-muted-foreground leading-relaxed italic">"{d.purpose}"</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Select Fleet Vehicle</Label>
                  <Select onValueChange={(val) => setApprovalState(prev => prev ? { ...prev, vehicleId: val } : null)}>
                    <SelectTrigger className="rounded-sm border-primary/20 h-11 font-bold text-sm bg-muted/5">
                      <SelectValue placeholder="Allot Vehicle..." />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles?.filter(v => v.status === 'Available').map(v => (
                        <SelectItem key={v.id} value={v.id} className="text-xs font-bold">
                          {v.make} {v.model} ({v.plateNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Assign Driver</Label>
                  <Select onValueChange={(val) => setApprovalState(prev => prev ? { ...prev, driverId: val } : null)}>
                    <SelectTrigger className="rounded-sm border-primary/20 h-11 font-bold text-sm bg-muted/5">
                      <SelectValue placeholder="Designate Driver..." />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers.map(d => (
                        <SelectItem key={d.id} value={d.id} className="text-xs font-bold">{d.username}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-100 rounded-sm flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="text-[10px] font-bold text-amber-800 uppercase leading-relaxed tracking-tight">
                  Driver will be notified via platform notification upon allotment. The vehicle odometer reading will be synchronized at trip departure.
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-4 bg-muted/5 border-t gap-3 shrink-0">
            <DialogClose asChild><Button variant="outline" className="rounded-sm font-black uppercase text-[10px] h-10 px-6 tracking-widest">Cancel</Button></DialogClose>
            <Button 
              onClick={handleApprove} 
              className="rounded-sm font-black uppercase text-[10px] h-10 px-8 tracking-widest shadow-xl bg-primary hover:bg-primary/90" 
              disabled={!approvalTarget?.vehicleId || !approvalTarget?.driverId}
            >
              Confirm Allotment
            </Button>
          </DialogFooter>
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-black">{value}</div>
      </CardContent>
    </Card>
  );
}
