
'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, where, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Car, Clock, CheckCircle2, XCircle, User, MapPin, Plus, Loader2, Search, FilterX, Truck, Fuel } from 'lucide-react';
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

type Vehicle = {
  id: string;
  make: string;
  model: string;
  plateNumber: string;
  ownership: string;
  status: 'Available' | 'Assigned' | 'Maintenance';
  currentReading: number;
};

type Assignment = {
  id: string;
  userId: string;
  userName: string;
  purpose: string;
  destination: string;
  status: 'Pending' | 'Approved' | 'Ongoing' | 'Completed' | 'Rejected';
  requestDate: any;
  vehicleId?: string;
  driverId?: string;
};

type UserProfile = {
  id: string;
  username: string;
  role: string;
};

export default function ManageVehiclesPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const vehiclesQuery = useMemoFirebase(() => collection(firestore, 'vehicles'), [firestore]);
  const { data: vehicles, isLoading: vehiclesLoading } = useCollection<Vehicle>(vehiclesQuery);

  const assignmentsQuery = useMemoFirebase(() => query(collection(firestore, 'vehicle_assignments'), orderBy('requestDate', 'desc')), [firestore]);
  const { data: assignments, isLoading: assignmentsLoading } = useCollection<Assignment>(assignmentsQuery);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers } = useCollection<UserProfile>(usersQuery);

  const drivers = React.useMemo(() => allUsers?.filter(u => u.role === 'Driver') || [], [allUsers]);

  const [approvalTarget, setApprovalState] = React.useState<{ assignment: Assignment, vehicleId: string, driverId: string } | null>(null);
  const [vehicleSearch, setVehicleSearch] = React.useState("");

  const handleApprove = async () => {
    if (!approvalTarget || !approvalTarget.vehicleId || !approvalTarget.driverId) {
      toast({ variant: 'destructive', title: 'Selection Required', description: 'Please select both a vehicle and a driver.' });
      return;
    }

    const { assignment, vehicleId, driverId } = approvalTarget;
    const vehicle = vehicles?.find(v => v.id === vehicleId);
    const driver = drivers?.find(d => d.id === driverId);

    try {
      // 1. Update assignment
      updateDocumentNonBlocking(doc(firestore, 'vehicle_assignments', assignment.id), {
        status: 'Approved',
        vehicleId,
        vehicleDetails: `${vehicle?.make} ${vehicle?.model} (${vehicle?.plateNumber})`,
        driverId,
        driverName: driver?.username || 'Assigned Driver',
        approvalDate: serverTimestamp(),
      });

      // 2. Update vehicle status
      updateDocumentNonBlocking(doc(firestore, 'vehicles', vehicleId), {
        status: 'Assigned'
      });

      toast({ title: 'Trip Approved', description: 'Vehicle and Driver have been assigned.' });
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

  if (!isAdmin && user) return <div className="p-12 text-center uppercase font-black">Unauthorized</div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Car className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-black tracking-tight uppercase">Fleet Management</h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium">Control asset allotment and monitor trip statuses.</p>
        </div>
        <Button asChild className="rounded-sm font-black shadow-md h-11">
          <Link href="/vehicles/add"><Plus className="mr-2 h-4 w-4" /> Add Vehicle</Link>
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Vehicles Inventory */}
        <Card className="rounded-sm border-primary/10 shadow-md h-fit">
          <CardHeader className="bg-muted/5 border-b flex flex-row items-center justify-between py-4">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" /> Registry
            </CardTitle>
            <div className="relative w-32">
              <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
              <Input placeholder="Search..." className="h-7 pl-7 text-[10px] rounded-sm" value={vehicleSearch} onChange={e => setVehicleSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              {vehicles?.filter(v => v.plateNumber.toLowerCase().includes(vehicleSearch.toLowerCase())).map(v => (
                <div key={v.id} className="p-4 border-b last:border-0 hover:bg-muted/10 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-sm">{v.make} {v.model}</p>
                      <p className="text-[10px] font-mono text-muted-foreground uppercase">{v.plateNumber}</p>
                    </div>
                    <Badge variant={v.status === 'Available' ? 'default' : 'secondary'} className="text-[8px] h-4 rounded-sm font-black uppercase">
                      {v.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between mt-3 text-[10px] font-bold text-muted-foreground">
                    <span className="uppercase">{v.ownership}</span>
                    <span className="font-mono text-primary">{v.currentReading} KM</span>
                  </div>
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Trip Requests Queue */}
        <Card className="lg:col-span-2 rounded-sm border-primary/10 shadow-md">
          <CardHeader className="bg-muted/5 border-b py-4">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <Fuel className="h-4 w-4 text-primary" /> Allotment Requests Queue
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6">Personnel</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignmentsLoading ? (
                  <TableRow><TableCell colSpan={5} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : assignments?.map(req => (
                  <TableRow key={req.id} className="hover:bg-muted/5">
                    <TableCell className="px-6">
                      <p className="font-bold text-sm">{req.userName}</p>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase truncate max-w-[150px]">{req.purpose}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                        <MapPin className="h-3 w-3" /> {req.destination}
                      </div>
                    </TableCell>
                    <TableCell className="text-[10px] font-mono text-muted-foreground">
                      {req.requestDate ? format(req.requestDate.toDate(), 'dd MMM HH:mm') : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "text-[8px] font-black uppercase rounded-sm px-1.5",
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
                      {req.status === 'Pending' && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" className="h-7 text-[10px] font-bold rounded-sm px-3" onClick={() => setApprovalState({ assignment: req, vehicleId: "", driverId: "" })}>Approve</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-[10px] font-bold rounded-sm text-destructive" onClick={() => handleReject(req.id)}>Reject</Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Approval Dialog */}
      <Dialog open={!!approvalTarget} onOpenChange={(o) => !o && setApprovalState(null)}>
        <DialogContent className="max-w-md rounded-sm">
          <DialogHeader>
            <DialogTitle>Approve Allotment</DialogTitle>
            <DialogDescription>Assign resources for trip requested by <strong>{approvalTarget?.assignment?.userName}</strong>.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Purpose & Destination</Label>
              <div className="p-3 bg-muted/20 border rounded-sm">
                <p className="text-xs font-bold text-primary">{approvalTarget?.assignment.destination}</p>
                <p className="text-[10px] text-muted-foreground italic mt-1">"{approvalTarget?.assignment.purpose}"</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Allot Vehicle</Label>
                <Select onValueChange={(val) => setApprovalState(prev => prev ? { ...prev, vehicleId: val } : null)}>
                  <SelectTrigger><SelectValue placeholder="Select available vehicle..." /></SelectTrigger>
                  <SelectContent>
                    {vehicles?.filter(v => v.status === 'Available').map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.make} {v.model} ({v.plateNumber})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assign Driver</Label>
                <Select onValueChange={(val) => setApprovalState(prev => prev ? { ...prev, driverId: val } : null)}>
                  <SelectTrigger><SelectValue placeholder="Select driver..." /></SelectTrigger>
                  <SelectContent>
                    {drivers.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" className="rounded-sm">Cancel</Button></DialogClose>
            <Button onClick={handleApprove} className="rounded-sm font-bold min-w-[120px]" disabled={!approvalTarget?.vehicleId || !approvalTarget?.driverId}>
              Approve & Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
