"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking, useFirebaseApp, useCollection } from "@/firebase";
import { collection, doc, serverTimestamp, query, where, limit, getDocs } from "firebase/firestore";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, CalendarCheck, Camera, Trash2, SwitchCamera, History, AlertCircle, Zap, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function CheckInPage() {
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [selfie, setSelfie] = React.useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = React.useState(false);
  const [facingMode, setFacingMode] = React.useState<"user" | "environment">("user");
  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);

  const activeAttendanceQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'attendance'),
      where('userId', '==', user.uid),
      where('status', '==', 'ongoing'),
      limit(1)
    );
  }, [firestore, user]);

  const { data: activeAttendance } = useCollection(activeAttendanceQuery);
  const isCheckedIn = activeAttendance && activeAttendance.length > 0;

  const startCamera = async (mode: "user" | "environment" = facingMode) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      setHasCameraPermission(true);
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Camera access error:', error);
      setHasCameraPermission(false);
      setIsCameraActive(false);
      toast({ variant: 'destructive', title: 'Camera Access Denied', description: 'Mandatory verification required.' });
    }
  };

  React.useEffect(() => {
    if (!selfie && !isCameraActive && !isCheckedIn) {
      startCamera();
    }
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [selfie, isCheckedIn]);

  const toggleCamera = async () => {
    if (isCameraActive) {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
      const nextMode = facingMode === "user" ? "environment" : "user";
      setFacingMode(nextMode);
      startCamera(nextMode);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        setSelfie(canvas.toDataURL("image/jpeg", 0.8));
        const stream = video.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
        setIsCameraActive(false);
      }
    }
  };

  const getCurrentLocation = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const handleCheckIn = async () => {
    if (!user || !userProfile || !selfie) return;
    setIsProcessing(true);
    
    const q = query(collection(firestore, 'attendance'), where('userId', '==', user.uid), where('status', '==', 'ongoing'), limit(1));
    const existing = await getDocs(q);
    if (!existing.empty) {
      router.replace('/attendance/check-out');
      return;
    }

    const location = await getCurrentLocation();
    if (!location) { 
      toast({ variant: 'destructive', title: 'GPS Required', description: 'Location access is mandatory for site attendance.' });
      setIsProcessing(false); 
      return; 
    }

    try {
      const storage = getStorage(firebaseApp);
      const selfieRef = ref(storage, `attendance/${user.uid}/checkin_${Date.now()}.jpg`);
      await uploadString(selfieRef, selfie, 'data_url', { contentType: 'image/jpeg' });
      const selfieUrl = await getDownloadURL(selfieRef);

      const checkInData = {
        userId: user.uid,
        userName: userProfile.username || user.email,
        siteManagerId: userProfile.siteManagerId || null,
        checkInTime: serverTimestamp(),
        checkInLat: location.lat,
        checkInLng: location.lng,
        checkInSelfieUrl: selfieUrl,
        status: 'ongoing',
        date: format(new Date(), 'yyyy-MM-dd'),
        createdAt: serverTimestamp()
      };

      addDocumentNonBlocking(collection(firestore, 'attendance'), checkInData);

      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch {}

      setIsProcessing(false);
      setShowSuccess(true);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
      setIsProcessing(false);
    }
  };

  if (isCheckedIn && !isProcessing && !showSuccess) {
    router.replace('/attendance/check-out');
    return null;
  }

  return (
    <div className="space-y-3 max-w-2xl mx-auto py-2 px-4">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl">
          <CalendarCheck className="h-6 w-6 text-primary" /> Start Workday
        </h1>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="h-6 px-2 text-[9px] font-black uppercase rounded-sm border-none bg-amber-600 text-white shadow-md">
            Status: Checked-Out
          </Badge>
          <Button variant="ghost" size="sm" asChild className="rounded-sm font-bold text-primary h-6 px-2 border border-primary/10 text-[9px]">
            <Link href="/attendance/history"><History className="mr-1 h-3 w-3" /> History</Link>
          </Button>
        </div>
      </div>

      <Card className="shadow-lg border-primary/10 rounded-sm overflow-hidden">
        <CardHeader className="bg-primary/5 py-2 border-b">
          <CardTitle className="text-sm font-black uppercase tracking-widest">Check-in Verification</CardTitle>
          <CardDescription className="text-[8px] font-bold text-muted-foreground uppercase">GPS Sync & Identity Audit</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 pb-4 space-y-4">
          <div className="flex flex-col items-center gap-4">
            <div className={cn("relative w-full h-80 bg-black rounded-sm overflow-hidden shadow-2xl border-4 border-primary/10", !isCameraActive && "hidden")}>
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
              <div className="absolute top-4 left-4">
                <Badge className="bg-red-600 animate-pulse border-none rounded-full h-6 px-3 flex items-center gap-1.5 font-black text-[9px] uppercase tracking-widest">
                  <Zap className="h-3 w-3 fill-white" /> Live Audit
                </Badge>
              </div>
              <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-6">
                <Button onClick={toggleCamera} variant="secondary" size="icon" className="rounded-full h-12 w-12 bg-black/40 text-white border-white/20 hover:bg-black/60 shadow-lg backdrop-blur-md"><SwitchCamera className="h-6 w-6" /></Button>
                <Button onClick={capturePhoto} className="rounded-full h-16 w-16 p-0 shadow-2xl border-4 border-primary bg-white text-black hover:bg-white/90 transition-all active:scale-90 scale-110"><Camera className="h-8 w-8" /></Button>
                <div className="w-12" />
              </div>
            </div>

            {selfie && !isCameraActive && (
              <div className="relative group w-full h-80">
                <img src={selfie} className="w-full h-full object-cover rounded-sm border-2 border-primary shadow-md" alt="Selfie" />
                <Button variant="destructive" size="icon" className="absolute top-4 right-4 rounded-full h-10 w-10 shadow-lg" onClick={() => setSelfie(null)}><Trash2 className="h-5 w-5" /></Button>
              </div>
            )}

            {!selfie && !isCameraActive && hasCameraPermission === null && (
              <div className="w-full h-80 bg-muted/20 border-dashed border-2 rounded-sm flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Connecting Feed...</p>
              </div>
            )}
          </div>

          {hasCameraPermission === false && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-xs">Compliance Error</AlertTitle>
              <AlertDescription className="text-[10px]">Identity verification is mandatory. Enable camera permissions to proceed.</AlertDescription>
            </Alert>
          )}

          <Button 
            className="w-full h-14 text-lg font-black rounded-sm shadow-xl transition-all" 
            onClick={handleCheckIn}
            disabled={isProcessing || !selfie}
          >
            {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'START WORKDAY'}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showSuccess} onOpenChange={(open) => { if(!open) router.push('/attendance/check-out'); }}>
        <DialogContent className="sm:max-w-md rounded-sm border-emerald-500/20 shadow-2xl">
          <DialogHeader className="pt-4 text-center">
            <div className="mx-auto bg-emerald-500/10 p-4 rounded-full w-fit mb-4">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-emerald-900">Check-In Successful</DialogTitle>
            <DialogDescription className="text-base leading-relaxed text-emerald-800">
              Your workday has been activated. GPS and time stamps have been recorded for organizational compliance.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center pb-4">
            <Button onClick={() => router.push('/attendance/check-out')} className="w-full h-12 text-sm font-black rounded-sm bg-emerald-600 hover:bg-emerald-700">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}