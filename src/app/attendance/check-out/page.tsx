
"use client";

import * as React from "react";
import { useFirestore, useUser, useMemoFirebase, useCollection, useFirebaseApp } from "@/firebase";
import { collection, doc, query, where, limit, serverTimestamp, updateDoc } from "firebase/firestore";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CalendarCheck, CheckCircle2, LogOut, Camera, Trash2, SwitchCamera, AlertCircle, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
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

const SUCCESS_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

export default function CheckOutPage() {
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
  const streamRef = React.useRef<MediaStream | null>(null);

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

  const startCamera = async (mode: "user" | "environment" = facingMode) => {
    // Guard: Don't restart if already active and using same mode
    if (streamRef.current?.active && mode === facingMode) {
      if (videoRef.current && !videoRef.current.srcObject) {
        videoRef.current.srcObject = streamRef.current;
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      streamRef.current = stream;
      setHasCameraPermission(true);
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Camera access error:', error);
      setHasCameraPermission(false);
      setIsCameraActive(false);
      toast({ variant: 'destructive', title: 'Camera Access Denied', description: 'Please enable hardware permissions to complete check-out.' });
    }
  };

  React.useEffect(() => {
    if (currentEntry && !selfie) {
      startCamera();
    }
  }, [currentEntry, selfie]);

  // Ensure stream stays attached if component re-renders
  React.useEffect(() => {
    if (isCameraActive && streamRef.current && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current;
    }
  });

  // Dedicated unmount cleanup
  React.useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const toggleCamera = async () => {
    if (isCameraActive && streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
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
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        setSelfie(dataUrl);

        // Stop stream after successful capture
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
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
        () => {
          toast({ variant: 'destructive', title: 'GPS Error', description: 'Location access required for check-out audit.' });
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const handleCheckOut = async () => {
    if (!user || !currentEntry || !selfie) return;
    
    setIsProcessing(true);
    const location = await getCurrentLocation();
    
    if (!location) {
      setIsProcessing(false);
      return;
    }

    try {
      const storage = getStorage(firebaseApp);
      const selfieRef = ref(storage, `attendance/${user.uid}/checkout_${Date.now()}.jpg`);
      await uploadString(selfieRef, selfie, 'data_url', { contentType: 'image/jpeg' });
      const selfieUrl = await getDownloadURL(selfieRef);

      const entryRef = doc(firestore, 'attendance', currentEntry.id);
      
      await updateDoc(entryRef, {
        checkOutTime: serverTimestamp(),
        checkOutLat: location.lat,
        checkOutLng: location.lng,
        checkOutSelfieUrl: selfieUrl,
        status: 'completed',
        updatedAt: serverTimestamp()
      });

      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch (hapticError) {}

      setIsProcessing(false);
      setShowSuccess(true);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
      setIsProcessing(false);
    }
  };

  if (isLoading) return <div className="p-8 space-y-4 max-w-2xl mx-auto"><Skeleton className="h-64 w-full" /></div>;

  if (!currentEntry && !showSuccess) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-500 opacity-20" />
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-2xl font-black uppercase">No Active Session</h2>
          <Badge variant="outline" className="h-8 sm:h-9 px-3 sm:px-4 text-[10px] sm:text-xs font-black uppercase rounded-sm border-none bg-amber-600 text-white shadow-md animate-in fade-in zoom-in-95 duration-500">
            Status: Checked-out
          </Badge>
        </div>
        <Button onClick={() => router.push('/attendance/check-in')}>Check-in Now</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-2xl mx-auto py-2 px-4">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl">
          <CalendarCheck className="h-6 w-6 text-primary" /> Session Active
        </h1>
        <div className="flex items-center gap-2">
          {currentEntry && (
            <p className="text-muted-foreground text-[10px]">Started {formatDistanceToNow(currentEntry.checkInTime?.toDate() || new Date(), { addSuffix: true })}.</p>
          )}
          <Badge variant="outline" className="h-6 px-2 text-[9px] font-black uppercase rounded-sm border-none bg-emerald-600 text-white shadow-md animate-in fade-in zoom-in-95 duration-500">
            Status: Checked-in
          </Badge>
        </div>
      </div>

      <Card className="shadow-lg border-emerald-500/20 overflow-hidden rounded-sm">
        <CardHeader className="bg-emerald-500/5 border-b py-2">
          <CardTitle className="text-sm font-black uppercase tracking-widest">Check-out Verification</CardTitle>
          <CardDescription className="text-[8px] font-bold text-muted-foreground uppercase">Final profile capture and GPS sync.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 pb-4 space-y-4">
          <div className="flex flex-col items-center gap-4">
            <div className={cn("relative w-full h-80 bg-black rounded-sm overflow-hidden shadow-2xl border-4 border-emerald-500/20", !isCameraActive && "hidden")}>
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
              <div className="absolute top-4 left-4">
                <Badge className="bg-emerald-600 animate-pulse border-none rounded-full h-6 px-3 flex items-center gap-1.5 font-black text-[9px] uppercase tracking-widest">
                  <Zap className="h-3 w-3 fill-white" /> Exit Audit Live
                </Badge>
              </div>
              <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-4">
                <Button onClick={toggleCamera} variant="secondary" size="icon" className="rounded-full h-10 w-10 p-0 bg-black/40 text-white border-white/20 hover:bg-black/60 shadow-lg"><SwitchCamera className="h-5 w-5" /></Button>
                <Button onClick={capturePhoto} className="rounded-full h-14 w-14 p-0 shadow-lg border-4 border-emerald-500/20 bg-white text-black hover:bg-white/90 transition-all active:scale-90 scale-110"><Camera className="h-8 w-8" /></Button>
                <div className="w-10" />
              </div>
            </div>

            {selfie && !isCameraActive && (
              <div className="relative w-full h-80 group">
                <img src={selfie} className="w-full h-full object-cover rounded-sm border-2 border-emerald-200 shadow-md" alt="Checkout Selfie" />
                <Button variant="destructive" size="icon" className="absolute top-2 right-2 rounded-full h-8 w-8 shadow-lg" onClick={() => setSelfie(null)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            )}

            {!selfie && !isCameraActive && hasCameraPermission === null && (
              <div className="w-full h-80 bg-muted/20 border-dashed border-2 rounded-sm flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-emerald-600 opacity-20" />
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Initializing Exit Audit Feed...</p>
              </div>
            )}
          </div>

          {hasCameraPermission === false && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-xs">Camera Required</AlertTitle>
              <AlertDescription className="text-[10px]">Hardware access is mandatory for site audit.</AlertDescription>
            </Alert>
          )}

          <Button 
            className="w-full h-14 text-lg font-black rounded-sm shadow-xl bg-red-600 hover:bg-red-700 text-white transition-colors" 
            onClick={handleCheckOut}
            disabled={isProcessing || !selfie}
          >
            {isProcessing ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Finalizing...</>
            ) : (
              <><LogOut className="mr-3 h-5 w-5" /> END WORKDAY</>
            )}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showSuccess} onOpenChange={(open) => { if(!open) router.push('/attendance/history'); }}>
        <DialogContent className="sm:max-w-md rounded-sm border-emerald-500/20 shadow-2xl">
          <DialogHeader className="pt-4 text-center">
            <div className="mx-auto bg-emerald-500/10 p-4 rounded-full w-fit mb-4">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-emerald-900">Check-Out Complete</DialogTitle>
            <DialogDescription className="text-base leading-relaxed text-emerald-800">
              Your workday has been successfully concluded. Final verification and GPS coordinates have been archived.
              <audio autoPlay hidden>
                <source src={SUCCESS_SOUND_URL} type="audio/mpeg" />
              </audio>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center pb-4">
            <Button onClick={() => router.push('/attendance/history')} className="w-full h-12 text-sm font-black rounded-sm bg-slate-900">
              View Activity History
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
