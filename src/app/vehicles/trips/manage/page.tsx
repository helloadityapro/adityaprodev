'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, where, or, serverTimestamp, and, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CarFront, 
  Search, 
  FilterX, 
  MapPin, 
  MapPinned,
  ArrowRight, 
  Users, 
  History, 
  Eye, 
  Trash2, 
  Calendar,
  Clock,
  User,
  Navigation,
  FileDown,
  CheckCircle2,
  Timer,
  AlertCircle,
  XCircle,
  Fuel,
  Loader2,
  FileText,
  PlayCircle,
  Flag,
  Smartphone,
  Check,
  HardHat,
  TrendingUp,
  CircleX,
  ListFilter
} from 'lucide-react';
import { format } from 'date-fns';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { isSuperAdmin } from '@/lib/auth-constants';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { Separator } from '@/components/ui/separator';
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

type Assignment = {
  id: string;
  userId: string;
  userName: string;
  driverId?: string;
  driverName?: string;
  vehicleId?: string;
  vehicleDetails?: string;
  vehicleOwnership?: 'Owned' | 'Rented';
  purpose: string;
  siteId?: string;
  pickupLocation: string;
  pickupType: 'Site' | 'Other';
  destinations: { type: string, location: string, purpose: string }[];
  status: 'Pending' | 'Approved' | 'Ongoing' | 'Completed' | 'Rejected';
  requestDate: any;
  approvalDate?: any;
  startTime?: any;
  endTime?: any;
  startReading?: number;
  startReadingPhoto?: string;
  endReading?: number;
  endReadingPhoto?: string;
  coPassengers?: { id: string, name: string }[];
};

type Vehicle = {
  id: string;
  make: string;
  model: string;
  plateNumber: string;
  status: string;
  ownership: 'Owned' | 'Rented';
};

type UserProfile = {
  id: string;
  username: string;
  role: string;
  assignedProjectIds?: string[];
  ownDataOnly?: boolean;
};

type AccessConfig = {
  id: string;
  ownDataOnly?: boolean;
};

export default function ManageAllTripsPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState("registry");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [approvalTarget, setApprovalState] = React.useState<{ assignment: Assignment, vehicleId: string, driverId: string, rentedDriverDetails: string } | null>(null);
  const [detailsAssignment, setDetailsAssignment] = React.useState<Assignment | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<Assignment | null>(null);
  const [isCancelling, setIsCancelling] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<AccessConfig>(roleConfigsQuery);
  
  const isSuper = isSuperAdmin(user?.email);
  const isAdmin = isSuper || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const assignmentsQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'vehicle_assignments');
    
    if (isAdmin) {
      return query(colRef, orderBy('requestDate', 'desc'));
    }

    return query(
      colRef, 
      or(
        where('driverId', '==', user.uid), 
        where('userId', '==', user.uid),
        where('siteManagerId', '==', user.uid)
      )
    );
  }, [firestore, isAdmin, user, isProfileLoading]);

  const { data: assignments, isLoading } = useCollection<Assignment>(assignmentsQuery);

  const vehiclesQuery = useMemoFirebase(() => collection(firestore, 'vehicles'), [firestore]);
  const { data: vehicles } = useCollection<Vehicle>(vehiclesQuery);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers } = useCollection<UserProfile>(usersQuery);

  const driversList = React.useMemo(() => allUsers?.filter(u => u.role === 'Driver') || [], [allUsers]);

  const filteredAssignments = React.useMemo(() => {
    if (!assignments || !userProfile) return [];
    
    const isOwnDataOnly = userProfile.ownDataOnly !== undefined 
      ? userProfile.ownDataOnly 
      : roleConfigs?.find(c => c.id === userProfile.role)?.ownDataOnly ?? false;

    let result = assignments;

    if (isOwnDataOnly && !isSuper) {
      const assignedIds = new Set(userProfile.assignedProjectIds || []);
      result = result.filter(trip => {
        if (trip.siteId) return assignedIds.has(trip.siteId);
        return true; 
      });
    }

    return result.filter(trip => {
      const matchesSearch = trip.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trip.pickupLocation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (trip.vehicleDetails || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (trip.driverName || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || trip.status === statusFilter;
      const isQueue = activeTab === 'queue' ? trip.status === 'Pending' : true;
      
      return matchesSearch && matchesStatus && isQueue;
    }).sort((a, b) => {
      const dateA = a.requestDate?.toDate?.()?.getTime() || 0;
      const dateB = b.requestDate?.toDate?.()?.getTime() || 0;
      return dateB - dateA;
    });
  }, [assignments, searchTerm, statusFilter, activeTab, userProfile, roleConfigs, isSuper]);

  const stats = React.useMemo(() => {
    return {
      total: filteredAssignments.length,
      pending: filteredAssignments.filter(a => a.status === 'Pending').length,
      ongoing: filteredAssignments.filter(a => a.status === 'Ongoing').length,
      completed: filteredAssignments.filter(a => a.status === 'Completed').length,
    };
  }, [filteredAssignments]);

  const handleApprove = async () => {
    if (!approvalTarget?.vehicleId || !approvalTarget?.driverId) {
      toast({ variant: 'destructive', title: 'Selection Required', description: 'Please allot a vehicle and driver.' });
      return;
    }

    const { assignment, vehicleId, driverId, rentedDriverDetails } = approvalTarget;
    const vehicle = vehicles?.find(v => v.id === vehicleId);
    
    let finalDriverId = driverId;
    let finalDriverName = "";

    if (driverId === 'RENTED') {
      finalDriverId = "RENTED";
      finalDriverName = rentedDriverDetails ? `Rented: ${rentedDriverDetails}` : "Rented Driver";
    } else {
      const driver = driversList?.find(d => d.id === driverId);
      finalDriverName = driver?.username || 'Assigned Driver';
    }

    try {
      updateDocumentNonBlocking(doc(firestore, 'vehicle_assignments', assignment.id), {
        status: 'Approved',
        vehicleId,
        vehicleDetails: `${vehicle?.make} ${vehicle?.model} (${vehicle?.plateNumber})`,
        vehicleOwnership: vehicle?.ownership || 'Owned',
        driverId: finalDriverId,
        driverName: finalDriverName,
        approvalDate: serverTimestamp(),
      });

      updateDocumentNonBlocking(doc(firestore, 'vehicles', vehicleId), { status: 'Assigned' });

      toast({ title: 'Trip Authorized', description: 'Resources alloted successfully.' });
      setApprovalState(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);

    try {
      updateDocumentNonBlocking(doc(firestore, 'vehicle_assignments', cancelTarget.id), {
        status: 'Rejected',
        updatedAt: serverTimestamp(),
        cancelledAt: serverTimestamp(),
        cancelledById: user?.uid
      });

      if (cancelTarget.vehicleId) {
        updateDocumentNonBlocking(doc(firestore, 'vehicles', cancelTarget.vehicleId), {
          status: 'Available'
        });
      }

      toast({ title: 'Trip Cancelled', description: 'The trip request has been revoked.' });
      setCancelTarget(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsCancelling(false);
    }
  };

  if (isUserLoading || isProfileLoading || isLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-[500px] w-full" /></div>;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <MapPinned className="h-6 w-6 text-primary" />
            <h1>Manage Trips</h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium">Trip coordination hub for authorized project itineraries.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Logs Found" value={stats.total} icon={History} color="primary" />
        <SummaryCard title="Awaiting Allotment" value={stats.pending} icon={AlertCircle} color="amber" />
        <SummaryCard title="Active Journeys" value={stats.ongoing} icon={Timer} color="blue" />
        <SummaryCard title="Completed" value={stats.completed} icon={CheckCircle2} color="emerald" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <TabsList className="bg-muted/50 border border-primary/10 rounded-sm p-1">
            <TabsTrigger value="registry" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-8">Trip History</TabsTrigger>
            {(isAdmin || isManager) && (
              <TabsTrigger value="queue" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-8 relative">
                Allotment Queue
                {stats.pending > 0 && <Badge className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center p-0 rounded-full bg-red-500 text-[10px] font-black">{stats.pending}</Badge>}
              </TabsTrigger>
            )}
          </TabsList>

          <div className="flex items-center gap-2">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search personnel or location..." 
                className="pl-8 h-9 text-xs rounded-sm border-primary/20"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] h-9 text-xs font-bold uppercase tracking-tight rounded-sm border-primary/20">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-bold uppercase">All Status</SelectItem>
                <SelectItem value="Pending" className="text-xs font-bold uppercase">Pending</SelectItem>
                <SelectItem value="Approved" className="text-xs font-bold uppercase">Approved</SelectItem>
                <SelectItem value="Ongoing" className="text-xs font-bold uppercase">Ongoing</SelectItem>
                <SelectItem value="Completed" className="text-xs font-bold uppercase">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="registry" className="animate-in fade-in-50 duration-300">
          <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="px-6 min-w-[180px]">Requester</TableHead>
                      <TableHead className="min-w-[250px]">Itinerary</TableHead>
                      <TableHead>Fleet Resource</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right px-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssignments.length > 0 ? filteredAssignments.map((trip) => {
                      const isAssignedDriver = trip.driverId === user?.uid;
                      const isRequester = trip.userId === user?.uid;
                      const canCancel = (isAdmin || isRequester) && (trip.status === 'Pending' || trip.status === 'Approved');
                      
                      const canStartTrip = (trip.status === 'Approved') && (
                        (trip.vehicleOwnership === 'Rented' && isRequester) || 
                        (trip.vehicleOwnership !== 'Rented' && isAssignedDriver)
                      );

                      const canEndTrip = (trip.status === 'Ongoing') && (
                        (trip.vehicleOwnership === 'Rented' && isRequester) || 
                        (trip.vehicleOwnership !== 'Rented' && isAssignedDriver)
                      );

                      return (
                        <TableRow key={trip.id} className="hover:bg-muted/5 transition-colors">
                          <TableCell className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <span className="font-bold text-sm text-foreground">{trip.userName}</span>
                              {trip.coPassengers && trip.coPassengers.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <Users className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase">+{trip.coPassengers.length} pax</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-1.5 text-xs font-black text-emerald-700">
                                <MapPin className="h-3 w-3" /> {trip.pickupLocation}
                              </div>
                              <div className="flex flex-col gap-1 ml-4 border-l border-primary/10 pl-2">
                                {trip.destinations.map((dest, i) => (
                                  <div key={i} className="flex items-center gap-1.5 text-[10px] font-bold text-primary">
                                    <ArrowRight className="h-2.5 w-2.5" /> {dest.location}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {trip.vehicleId ? (
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold">{trip.vehicleDetails}</span>
                                  <Badge variant="secondary" className="h-3.5 px-1 text-[7px] font-black uppercase rounded-sm border-none bg-muted text-muted-foreground">{trip.vehicleOwnership || 'Owned'}</Badge>
                                </div>
                                <span className="text-[10px] text-muted-foreground font-black uppercase">{trip.driverName}</span>
                              </div>
                            ) : (
                              <span className="text-[9px] font-bold text-muted-foreground/40 uppercase italic">Awaiting Resource</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(
                              "text-[8px] font-black uppercase rounded-sm px-1.5 h-5",
                              trip.status === 'Pending' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                              trip.status === 'Approved' ? "bg-blue-50 text-blue-700 border-blue-200" :
                              trip.status === 'Ongoing' ? "bg-primary text-white border-none" :
                              trip.status === 'Completed' ? "bg-green-50 text-green-700 border-green-200" :
                              "bg-red-50 text-red-700 border-red-200"
                            )}>
                              {trip.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <div className="flex justify-end gap-1">
                              {canStartTrip && (
                                <Button size="sm" className="h-8 rounded-sm bg-blue-600 hover:bg-blue-700 font-bold px-3 text-[10px] uppercase tracking-tight" asChild>
                                  <Link href={`/vehicles/trips/${trip.id}/start`}>
                                    <PlayCircle className="h-3.5 w-3.5 mr-1" /> Start
                                  </Link>
                                </Button>
                              )}
                              {canEndTrip && (
                                <Button size="sm" className="h-8 rounded-sm bg-red-600 hover:bg-red-700 font-bold px-3 text-[10px] uppercase tracking-tight" asChild>
                                  <Link href={`/vehicles/trips/${trip.id}/finish`}>
                                    <Flag className="h-3.5 w-3.5 mr-1" /> End
                                  </Link>
                                </Button>
                              )}
                              {canCancel && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 rounded-sm" onClick={() => setCancelTarget(trip)}>
                                  <CircleX className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" asChild>
                                <Link href={`/vehicles/trips/manage?view=${trip.id}`}><Eye className="h-4 w-4" /></Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }) : (
                      <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">No logs discovered.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queue" className="animate-in fade-in-50 duration-300">
          <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-6">Requester</TableHead>
                    <TableHead>Itinerary Summary</TableHead>
                    <TableHead>Request Date</TableHead>
                    <TableHead className="text-right px-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.filter(a => a.status === 'Pending').length > 0 ? (
                    filteredAssignments.filter(a => a.status === 'Pending').map((trip) => (
                      <TableRow key={trip.id} className="hover:bg-muted/5 transition-colors">
                        <TableCell className="px-6 py-4 font-bold text-sm">{trip.userName}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-black text-emerald-700">
                              <MapPin className="h-3 w-3" /> {trip.pickupLocation}
                            </div>
                            <div className="flex flex-col gap-1 ml-4 border-l border-primary/10 pl-2">
                              {trip.destinations.map((dest, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-[10px] font-bold text-primary">
                                  <ArrowRight className="h-2.5 w-2.5" /> {dest.location}
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-[10px] font-mono font-bold text-muted-foreground">
                          {trip.requestDate ? format(trip.requestDate.toDate(), 'dd MMM, HH:mm') : '—'}
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" className="h-8 rounded-sm font-black text-[10px] uppercase px-4" onClick={() => setApprovalState({ assignment: trip, vehicleId: "", driverId: "", rentedDriverDetails: "" })}>
                              Allot Vehicle
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 rounded-sm" onClick={() => setCancelTarget(trip)}>
                              <CircleX className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">Queue empty.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
                  <div className="relative pl-6 border-l-2 border-emerald-500 pb-2">
                    <div className="absolute -left-[7px] top-0 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-background" />
                    <p className="text-[10px] font-black uppercase text-emerald-700 tracking-tighter">Pickup Location</p>
                    <p className="text-sm font-black">{approvalTarget?.assignment.pickupLocation}</p>
                  </div>
                  {approvalTarget?.assignment.destinations.map((d, i) => (
                    <div key={i} className="relative pl-6 border-l-2 border-primary">
                      <div className="absolute -left-[7px] top-0 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                      <p className="text-[10px] font-black uppercase text-primary tracking-tighter">Destination {i + 1}</p>
                      <p className="text-sm font-black">{d.location}</p>
                      <p className="text-[10px] font-bold text-muted-foreground italic leading-relaxed">"{d.purpose}"</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Select Fleet Vehicle</Label>
                  <Select onValueChange={(val) => {
                    const v = vehicles?.find(x => x.id === val);
                    setApprovalState(prev => prev ? { 
                      ...prev, 
                      vehicleId: val, 
                      driverId: v?.ownership === 'Rented' ? 'RENTED' : '' 
                    } : null);
                  }}>
                    <SelectTrigger className="rounded-sm border-primary/20 h-11 font-bold text-sm bg-muted/5">
                      <SelectValue placeholder="Allot Vehicle..." />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles?.filter(v => v.status === 'Available').map(v => (
                        <SelectItem key={v.id} value={v.id} className="text-xs font-bold">
                          {v.make} {v.model} ({v.plateNumber}) — {v.ownership}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  {vehicles?.find(v => v.id === approvalTarget?.vehicleId)?.ownership === 'Rented' ? (
                    <>
                      <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Rented Driver Info (Optional)</Label>
                      <Input 
                        placeholder="Name / Phone..." 
                        className="h-11 font-bold text-sm rounded-sm"
                        value={approvalTarget?.rentedDriverDetails || ""}
                        onChange={(e) => setApprovalState(prev => prev ? { ...prev, rentedDriverDetails: e.target.value } : null)}
                      />
                      <p className="text-[9px] text-muted-foreground italic font-medium">External driver — No system selection required.</p>
                    </>
                  ) : (
                    <>
                      <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Assign System Driver</Label>
                      <Select 
                        disabled={!approvalTarget?.vehicleId}
                        value={approvalTarget?.driverId}
                        onValueChange={(val) => setApprovalState(prev => prev ? { ...prev, driverId: val } : null)}
                      >
                        <SelectTrigger className="rounded-sm border-primary/20 h-11 font-bold text-sm bg-muted/5">
                          <SelectValue placeholder="Designate Driver..." />
                        </SelectTrigger>
                        <SelectContent>
                          {driversList.map(d => (
                            <SelectItem key={d.id} value={d.id} className="text-xs font-bold">{d.username}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
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

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive font-black uppercase tracking-tight">
              <CircleX className="h-5 w-5" /> Confirm Cancellation
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium leading-relaxed">
              Revoke this trip request? If a vehicle was alloted, it will be returned to the available pool.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-sm font-bold uppercase text-[10px]">Back</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmCancel} 
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-sm font-black uppercase text-[10px] shadow-lg"
            >
              {isCancelling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Cancellation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
