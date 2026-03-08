'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CarFront, 
  Search, 
  FilterX, 
  MapPin, 
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
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
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

type Assignment = {
  id: string;
  userId: string;
  userName: string;
  driverId?: string;
  driverName?: string;
  vehicleId?: string;
  vehicleDetails?: string;
  purpose: string;
  pickupLocation: string;
  destinations: { type: string, location: string, purpose: string }[];
  status: 'Pending' | 'Approved' | 'Ongoing' | 'Completed' | 'Rejected';
  requestDate: any;
  startTime?: any;
  endTime?: any;
  startReading?: number;
  endReading?: number;
  coPassengers?: { id: string, name: string }[];
};

type UserProfile = {
  id: string;
  username: string;
  role: string;
};

export default function ManageAllTripsPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const assignmentsQuery = useMemoFirebase(() => {
    if (!isAdmin) return null;
    return query(collection(firestore, 'vehicle_assignments'), orderBy('requestDate', 'desc'));
  }, [firestore, isAdmin]);

  const { data: assignments, isLoading } = useCollection<Assignment>(assignmentsQuery);

  const stats = React.useMemo(() => {
    if (!assignments) return { total: 0, pending: 0, ongoing: 0, completed: 0 };
    return {
      total: assignments.length,
      pending: assignments.filter(a => a.status === 'Pending').length,
      ongoing: assignments.filter(a => a.status === 'Ongoing').length,
      completed: assignments.filter(a => a.status === 'Completed').length,
    };
  }, [assignments]);

  const filteredAssignments = React.useMemo(() => {
    if (!assignments) return [];
    return assignments.filter(trip => {
      const matchesSearch = trip.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trip.pickupLocation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (trip.vehicleDetails || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (trip.driverName || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || trip.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [assignments, searchTerm, statusFilter]);

  const handleExport = () => {
    if (!filteredAssignments.length) return;
    
    const exportData = filteredAssignments.map(trip => ({
      'Requester': trip.userName,
      'Status': trip.status,
      'Request Date': trip.requestDate ? format(trip.requestDate.toDate(), 'yyyy-MM-dd HH:mm') : 'N/A',
      'Pickup': trip.pickupLocation,
      'Route': trip.destinations.map(d => d.location).join(' -> '),
      'Purpose': trip.purpose,
      'Vehicle': trip.vehicleDetails || 'Unassigned',
      'Driver': trip.driverName || 'Unassigned',
      'Passengers': trip.coPassengers?.map(p => p.name).join(', ') || 'Solo',
      'Distance (KM)': trip.startReading && trip.endReading ? trip.endReading - trip.startReading : 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Trips Registry");
    XLSX.writeFile(wb, `AdityaPro_Trips_Export_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const handleDelete = (id: string) => {
    if (confirm("Permanently delete this trip record?")) {
      deleteDocumentNonBlocking(doc(firestore, 'vehicle_assignments', id));
    }
  };

  if (isUserLoading || isProfileLoading || isLoading) {
    return (
      <div className="space-y-8 p-4">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (!isAdmin && user) return <div className="p-12 text-center uppercase font-black text-destructive tracking-widest">Unauthorized Access</div>;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Navigation className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-black tracking-tight uppercase">Trip Registry</h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium">Monitoring the full lifecycle of organizational vehicle assignments and itineraries.</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="h-10 rounded-sm font-bold border-primary text-primary hover:bg-primary/5 shadow-sm px-6">
          <FileDown className="h-4 w-4 mr-2" /> Export Registry
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Total Logs" value={stats.total} icon={History} color="primary" />
        <SummaryCard title="Awaiting Allotment" value={stats.pending} icon={AlertCircle} color="amber" />
        <SummaryCard title="Ongoing Journeys" value={stats.ongoing} icon={Timer} color="blue" />
        <SummaryCard title="Completed" value={stats.completed} icon={CheckCircle2} color="emerald" />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search personnel, vehicle or site..." 
                className="pl-8 h-9 text-xs rounded-sm border-primary/20"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] h-9 text-xs font-bold uppercase tracking-tight rounded-sm border-primary/20">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-bold uppercase">All Status</SelectItem>
                <SelectItem value="Pending" className="text-xs font-bold uppercase text-yellow-600">Pending Allotment</SelectItem>
                <SelectItem value="Approved" className="text-xs font-bold uppercase text-blue-600">Approved / Ready</SelectItem>
                <SelectItem value="Ongoing" className="text-xs font-bold uppercase text-primary">In Progress</SelectItem>
                <SelectItem value="Completed" className="text-xs font-bold uppercase text-emerald-600">Completed</SelectItem>
                <SelectItem value="Rejected" className="text-xs font-bold uppercase text-red-600">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(""); setStatusFilter("all"); }} className="h-9 px-3 rounded-sm font-bold text-[10px] uppercase tracking-widest text-muted-foreground">
              <FilterX className="h-3.5 w-3.5 mr-1.5" /> Clear
            </Button>
          </div>
        </div>

        <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-6 min-w-[200px]">Requester & Manifest</TableHead>
                    <TableHead className="min-w-[250px]">Route Itinerary</TableHead>
                    <TableHead>Resource Allotment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Logged On</TableHead>
                    <TableHead className="text-right px-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.length > 0 ? filteredAssignments.map((trip) => (
                    <TableRow key={trip.id} className="hover:bg-muted/5 transition-colors">
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <span className="font-bold text-sm text-foreground">{trip.userName}</span>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline" className="text-[8px] font-black uppercase h-4 px-1 border-primary/10 bg-primary/5 text-primary">
                              Requester
                            </Badge>
                            {trip.coPassengers && trip.coPassengers.length > 0 && (
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3 text-muted-foreground" />
                                <span className="text-[9px] font-bold text-muted-foreground uppercase">+{trip.coPassengers.length} More</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-black text-emerald-700">
                            <MapPin className="h-3 w-3" /> {trip.pickupLocation}
                          </div>
                          <div className="flex flex-col gap-1 ml-4 border-l-2 border-primary/10 pl-2">
                            {trip.destinations.map((dest, i) => (
                              <div key={i} className="flex flex-col leading-tight py-0.5">
                                <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                                  <ArrowRight className="h-2.5 w-2.5" /> {dest.location}
                                </span>
                                <span className="text-[8px] text-muted-foreground italic pl-4 truncate max-w-[200px] font-medium">"{dest.purpose}"</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {trip.vehicleId ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                              <CarFront className="h-3 w-3 text-primary" />
                              {trip.vehicleDetails}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-black uppercase tracking-tight">
                              <User className="h-2.5 w-2.5 text-primary/60" />
                              {trip.driverName}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-muted-foreground/40 uppercase italic tracking-widest">Awaiting Allotment</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          "text-[8px] font-black uppercase rounded-sm px-1.5 h-5",
                          trip.status === 'Pending' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                          req.status === 'Approved' ? "bg-blue-50 text-blue-700 border-blue-200" :
                          trip.status === 'Ongoing' ? "bg-primary text-white border-none animate-pulse" :
                          trip.status === 'Completed' ? "bg-green-50 text-green-700 border-green-200" :
                          "bg-red-50 text-red-700 border-red-200"
                        )}>
                          {trip.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[10px] font-mono font-bold text-muted-foreground">
                        {trip.requestDate ? format(trip.requestDate.toDate(), 'dd/MM HH:mm') : '—'}
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm hover:bg-primary/10" asChild>
                            <Link href={`/vehicles/assigned?view=${trip.id}`}><Eye className="h-4 w-4" /></Link>
                          </Button>
                          {trip.status === 'Pending' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 rounded-sm hover:bg-blue-50" asChild title="Go to Allotment">
                              <Link href="/vehicles/manage"><CarFront className="h-4 w-4" /></Link>
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm hover:bg-red-50" onClick={() => handleDelete(trip.id)} title="Delete Record">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">No trip records found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
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
