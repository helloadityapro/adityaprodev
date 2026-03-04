
"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, limit, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, CalendarCheck, Clock, CheckCircle2, Navigation, LogOut, Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function CheckOutPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [isProcessing, setIsProcessing] = React.useState(false);

  const activeAttendanceQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'attendance'),
      where('userId', '==', user.uid),
      where('status', '==', 'ongoing'),
      limit(1)
    );
  }, [firestore, user]);

  const { data: activeAttendance, isLoading } = useCollection(activeAttendanceQuery);
  const currentEntry = activeAttendance?.[0];

  const getCurrentLocation = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        toast({ variant: 'destructive', title: 'GPS Error', description: 'Geolocation is not supported.' });
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => {
          toast({ variant: 'destructive', title: 'Location Access Required', description: 'Please enable GPS to end your day.' });
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const handleCheckOut = async () => {
    if (!user || !currentEntry) return;
    
    setIsProcessing(true);
    const location = await getCurrentLocation();
    
    if (!location) {
      setIsProcessing(false);
      return;
    }

    try {
      const entryRef = doc(firestore, 'attendance', currentEntry.id);
      
      updateDocumentNonBlocking(entryRef, {
        checkOutTime: serverTimestamp(),
        checkOutLat: location.lat,
        checkOutLng: location.lng,
        status: 'completed',
        updatedAt: serverTimestamp()
      });

      toast({ variant: 'success', title: 'Workday Completed', description: `Checked out at ${format(new Date(), 'HH:mm')}.` });
      router.push('/attendance/history');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
      setIsProcessing(false);
    }
  };

  if (isLoading) return <div className="p-8 space-y-4 max-w-2xl mx-auto"><Skeleton className="h-12 w-48" /><Skeleton className="h-64 w-full" /></div>;

  if (!currentEntry) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-4 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-500 opacity-20" />
        <div className="space-y-2">
          <h2 className="text-2xl font-black uppercase tracking-tight">No Active Session</h2>
          <p className="text-muted-foreground max-w-xs mx-auto">Your workday hasn't started yet or has already been completed.</p>
        </div>
        <Button onClick={() => router.push('/attendance/check-in')} className="font-bold h-11 px-8 rounded-sm">Check-in Now</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2">
          <CalendarCheck className="h-8 w-8" /> Workday In Progress
        </h1>
        <p className="text-muted-foreground">Session started {formatDistanceToNow(currentEntry.checkInTime?.toDate() || new Date(), { addSuffix: true })}.</p>
      </div>

      <Card className="shadow-lg border-emerald-500/20 overflow-hidden rounded-sm bg-emerald-50/10">
        <CardHeader className="bg-emerald-500/5 border-b py-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Badge className="bg-emerald-600 text-white font-bold uppercase text-[10px] tracking-widest rounded-sm">Currently Active</Badge>
              <CardTitle className="text-xl pt-1">Duty Records</CardTitle>
            </div>
            <div className="bg-white p-2 rounded-sm border shadow-sm">
              <Timer className="h-6 w-6 text-emerald-600 animate-pulse" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-8 pb-8 space-y-8">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-background border rounded-sm">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter mb-1">Check-in Time</p>
              <p className="text-lg font-bold">{format(currentEntry.checkInTime?.toDate() || new Date(), 'HH:mm')}</p>
              <p className="text-[9px] text-muted-foreground font-medium">{format(currentEntry.checkInTime?.toDate() || new Date(), 'dd MMM yyyy')}</p>
            </div>
            <div className="p-4 bg-background border rounded-sm">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter mb-1">Current Duration</p>
              <p className="text-lg font-bold text-primary">{formatDistanceToNow(currentEntry.checkInTime?.toDate() || new Date())}</p>
              <p className="text-[9px] text-muted-foreground font-medium">Duty time elapsed</p>
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-100 rounded-sm flex items-start gap-3">
            <MapPin className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[10px] text-blue-800 font-black uppercase tracking-tight">Check-in Coordinates</p>
              <p className="text-xs font-mono font-medium text-blue-900">{currentEntry.checkInLat.toFixed(5)}, {currentEntry.checkInLng.toFixed(5)}</p>
            </div>
          </div>

          <Button 
            className="w-full h-16 text-xl font-black rounded-sm shadow-xl bg-slate-900 hover:bg-slate-800" 
            onClick={handleCheckOut}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <><Loader2 className="mr-2 h-6 w-6 animate-spin" /> Finalizing Logs...</>
            ) : (
              <><LogOut className="mr-3 h-6 w-6" /> END WORKDAY</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
