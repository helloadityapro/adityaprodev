
"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, CalendarCheck, Clock, CheckCircle2, History, Navigation } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function CheckInPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [isProcessing, setIsProcessing] = React.useState(false);
  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const getCurrentLocation = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        toast({ variant: 'destructive', title: 'GPS Error', description: 'Geolocation is not supported by your browser.' });
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => {
          toast({ variant: 'destructive', title: 'Location Access Required', description: 'Please enable GPS to check in.' });
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const handleCheckIn = async () => {
    if (!user || !userProfile) return;
    
    setIsProcessing(true);
    const location = await getCurrentLocation();
    
    if (!location) {
      setIsProcessing(false);
      return;
    }

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      await addDocumentNonBlocking(collection(firestore, 'attendance'), {
        userId: user.uid,
        userName: userProfile.username || user.email,
        checkInTime: serverTimestamp(),
        checkInLat: location.lat,
        checkInLng: location.lng,
        status: 'ongoing',
        date: today,
        createdAt: serverTimestamp()
      });

      toast({ variant: 'success', title: 'Check-in Successful', description: `Workday started at ${format(new Date(), 'HH:mm')}.` });
      router.push('/attendance/check-out');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2">
          <CalendarCheck className="h-8 w-8" /> Workday Attendance
        </h1>
        <p className="text-muted-foreground">Start your professional day with a verified GPS check-in.</p>
      </div>

      <div className="grid gap-6">
        <Card className="shadow-lg border-primary/10 overflow-hidden rounded-sm">
          <CardHeader className="bg-primary/5 border-b py-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl">Check-in</CardTitle>
                <CardDescription>Capture location and start time.</CardDescription>
              </div>
              <div className="bg-background p-2 rounded-sm border shadow-sm">
                <Clock className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-8 pb-8 space-y-6">
            <div className="flex flex-col items-center justify-center text-center p-8 bg-muted/20 border border-dashed rounded-sm gap-4">
              <Navigation className="h-12 w-12 text-primary opacity-20" />
              <div className="space-y-1">
                <p className="text-lg font-bold">Awaiting Start</p>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-black">Current System Time: {format(new Date(), 'HH:mm')}</p>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-100 rounded-sm flex items-start gap-3">
              <MapPin className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-800 leading-relaxed font-bold uppercase tracking-tight">
                By starting the day, your current GPS coordinates will be recorded for organizational compliance and audit trails.
              </p>
            </div>

            <Button 
              className="w-full h-16 text-xl font-black rounded-sm shadow-xl shadow-primary/20" 
              onClick={handleCheckIn}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <><Loader2 className="mr-2 h-6 w-6 animate-spin" /> Verifying GPS Position...</>
              ) : (
                <>START WORKDAY</>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button variant="ghost" onClick={() => router.push('/attendance/history')} className="text-xs font-bold uppercase tracking-widest">
            <History className="mr-2 h-4 w-4" /> View Attendance Log
          </Button>
        </div>
      </div>
    </div>
  );
}
