
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
  FileDown
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

export default function ManageAllTripsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const assignmentsQuery = useMemoFirebase(() => {
    if (!isAdmin) return null;
    return query(collection(firestore, 'vehicle_assignments'), orderBy('requestDate', 'desc'));
  }, [firestore, isAdmin]);

  const { data: assignments, isLoading } = useCollection<Assignment>(assignmentsQuery);

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

  if (!isAdmin && user) return <div className="p-12 text-center uppercase font-black">Unauthorized</div>;

  if (isLoading || isProfileLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Navigation className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-black tracking-tight uppercase">Organizational Trips Registry</h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium">Monitoring the full lifecycle of vehicle assignments and site travel.</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="rounded-sm font-bold border-primary text-primary hover:bg-primary/5 h-11 px-6 shadow-sm">
          <FileDown className="mr-2 h-4 w-4" /> Export Registry
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search personnel, vehicle or site..." 
            className="pl-9 h-11 rounded-sm border-primary/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] h-11 rounded-sm border-primary/20">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trip Status</SelectItem>
              <SelectItem value="Pending">Pending Allotment</SelectItem>
              <SelectItem value="Approved">Approved / Ready</SelectItem>
              <SelectItem value="Ongoing">In Progress</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={() => { setSearchTerm(""); setStatusFilter("all"); }} className="h-11 w-11 rounded-sm text-muted-foreground">
            <FilterX className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6 min-w-[180px]">Requester & Passengers</TableHead>
                  <TableHead className="min-w-[220px]">Route Itinerary</TableHead>
                  <TableHead>Asset & Driver</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments.length > 0 ? filteredAssignments.map((trip) => (
                  <TableRow key={trip.id} className="hover:bg-muted/5 transition-colors">
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-bold text-sm text-foreground">{trip.userName}</span>
                        {trip.coPassengers && trip.coPassengers.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {trip.coPassengers.map((p, idx) => (
                              <Badge key={idx} variant="outline" className="text-[8px] font-bold h-4 px-1 border-primary/10 bg-primary/5 text-primary">
                                {p.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-black text-emerald-700">
                          <MapPin className="h-3 w-3" /> {trip.pickupLocation}
                        </div>
                        <div className="flex flex-col gap-1 ml-4 border-l-2 border-primary/10 pl-2">
                          {trip.destinations.map((dest, i) => (
                            <div key={i} className="flex flex-col leading-tight">
                              <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                                <ArrowRight className="h-2.5 w-2.5" /> {dest.location}
                              </span>
                              <span className="text-[8px] text-muted-foreground italic pl-4 truncate max-w-[180px]">{dest.purpose}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {trip.vehicleId ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold">
                            <CarFront className="h-3 w-3 text-primary" />
                            {trip.vehicleDetails}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium uppercase">
                            <User className="h-2.5 w-2.5" />
                            {trip.driverName}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-muted-foreground/40 uppercase italic tracking-widest">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "text-[9px] font-black uppercase rounded-sm px-2 h-5",
                        trip.status === 'Pending' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                        trip.status === 'Approved' ? "bg-blue-50 text-blue-700 border-blue-200" :
                        trip.status === 'Ongoing' ? "bg-primary text-white border-none" :
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
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => router.push(`/vehicles/assigned?view=${trip.id}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {trip.status === 'Pending' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 rounded-sm" onClick={() => router.push('/vehicles/manage')}>
                            <CarFront className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => handleDelete(trip.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                      No trip records found matching current criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
