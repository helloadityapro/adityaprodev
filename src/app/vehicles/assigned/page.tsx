
'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, where, or } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CarFront, Clock, MapPin, User, ArrowRight, CheckCircle2, Navigation, MapPinned } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import Link from 'next/link';

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
  destination: string;
  status: 'Pending' | 'Approved' | 'Ongoing' | 'Completed' | 'Rejected';
  requestDate: any;
  startTime?: any;
  endTime?: any;
  startReading?: number;
  endReading?: number;
};

export default function AssignedVehiclesPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const assignmentsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'vehicle_assignments'),
      or(where('userId', '==', user.uid), where('driverId', '==', user.uid)),
      orderBy('requestDate', 'desc')
    );
  }, [firestore, user]);

  const { data: assignments, isLoading } = useCollection<Assignment>(assignmentsQuery);

  if (isLoading) return <div className="p-8 space-y-4 max-w-4xl mx-auto"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20 px-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2">
          <CarFront className="h-8 w-8" /> Assigned Trips
        </h1>
        <p className="text-muted-foreground font-medium">Monitoring active allotements and personal travel history.</p>
      </div>

      <div className="grid gap-6">
        {assignments && assignments.length > 0 ? assignments.map((trip) => {
          const isDriver = trip.driverId === user?.uid;
          const showAction = (isDriver && trip.status === 'Approved') || (isDriver && trip.status === 'Ongoing');

          return (
            <Card key={trip.id} className={cn(
              "rounded-sm shadow-md overflow-hidden border-l-4 transition-all hover:shadow-lg",
              trip.status === 'Ongoing' ? "border-l-primary border-primary/10" : "border-l-muted border-primary/5"
            )}>
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className={cn(
                    "text-[10px] font-black uppercase px-2 rounded-sm",
                    trip.status === 'Pending' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                    trip.status === 'Approved' ? "bg-blue-50 text-blue-700 border-blue-200" :
                    trip.status === 'Ongoing' ? "bg-primary text-white border-none animate-pulse" :
                    trip.status === 'Completed' ? "bg-green-50 text-green-700 border-green-200" :
                    "bg-red-50 text-red-700 border-red-200"
                  )}>
                    {trip.status}
                  </Badge>
                  <span className="text-[10px] font-mono font-bold text-muted-foreground">
                    REQ: {trip.requestDate ? format(trip.requestDate.toDate(), 'dd MMM, HH:mm') : '—'}
                  </span>
                </div>
                <CardTitle className="text-xl font-black text-foreground flex items-center gap-3">
                  <span className="text-primary">{trip.pickupLocation || 'Source'}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{trip.destination}</span>
                </CardTitle>
                <p className="text-sm font-bold text-muted-foreground italic leading-relaxed">"{trip.purpose}"</p>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Assigned Vehicle</Label>
                      <div className="flex items-center gap-2 font-black text-sm">
                        <CarFront className="h-4 w-4 text-primary" />
                        {trip.vehicleDetails || 'Pending Allotment'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Designated Driver</Label>
                      <div className="flex items-center gap-2 font-black text-sm">
                        <User className="h-4 w-4 text-primary" />
                        {trip.driverName || 'Pending Driver'}
                      </div>
                    </div>
                  </div>

                  {trip.status !== 'Pending' && trip.status !== 'Rejected' && (
                    <div className="p-4 bg-muted/20 border rounded-sm space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold uppercase text-muted-foreground">Start Reading</span>
                        <span className="font-mono font-black text-primary">{trip.startReading || '—'} KM</span>
                      </div>
                      {trip.endReading && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold uppercase text-muted-foreground">End Reading</span>
                          <span className="font-mono font-black text-primary">{trip.endReading} KM</span>
                        </div>
                      )}
                      {trip.startTime && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold uppercase text-muted-foreground">Trip Start</span>
                          <span className="font-medium text-muted-foreground">{format(trip.startTime.toDate(), 'HH:mm')}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>

              {showAction && (
                <CardFooter className="bg-muted/10 border-t p-4">
                  <Button 
                    className="w-full h-12 text-lg font-black rounded-sm shadow-xl" 
                    onClick={() => router.push(`/vehicles/trips/${trip.id}/${trip.status === 'Approved' ? 'start' : 'finish'}`)}
                  >
                    {trip.status === 'Approved' ? 'START TRIP' : 'FINISH TRIP'}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </CardFooter>
              )}
            </Card>
          );
        }) : (
          <div className="flex flex-col items-center justify-center py-32 text-center bg-card border border-dashed rounded-sm border-primary/20">
            <Navigation className="h-16 w-16 text-muted-foreground/20 mb-4" />
            <h3 className="text-xl font-bold">No Records Found</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mt-2">
              You do not have any active allotments or past trips registered.
            </p>
            <Button asChild className="mt-6 font-bold h-11 px-8 rounded-sm">
              <Link href="/vehicles/request">Request Trip Allotment</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
