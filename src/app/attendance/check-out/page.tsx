"use client";

import * as React from "react";
import { useFirestore, useUser, useMemoFirebase, useCollection, updateDocumentNonBlocking, useFirebaseApp } from "@/firebase";
import { collection, doc, query, where, limit, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CalendarCheck, CheckCircle2, LogOut, Camera, Trash2, SwitchCamera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function CheckOutPage() {
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [selfie, setSelfie] = React.useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = React.useState(false);
  const [facingMode, setFacingMode] = React.useState<"user" | "environment">("user");
  const videoRef = React.useRef<HTMLVideoElement>(null);

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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: mode } 
      });
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Camera Error', description: 'Enable camera to check out.' });
    }
  };

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
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        setSelfie(dataUrl);
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
      updateDocumentNonBlocking(entryRef, {
        checkOutTime: serverTimestamp(),
        checkOutLat: location.lat,
        checkOutLng: location.lng,
        checkOutSelfieUrl: selfieUrl,
        status: 'completed',
        updatedAt: serverTimestamp()
      });

      toast({ variant: 'success', title: 'Workday Completed' });
      router.push('/attendance/history');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
      setIsProcessing(false);
    }
  };

  if (isLoading) return <div className="p-8 space-y-4 max-w-2xl mx-auto"><Skeleton className="h-64 w-full" /></div>;

  if (!currentEntry) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-500 opacity-20" />
        <h2 className="text-2xl font-black uppercase">No Active Session</h2>
        <Button onClick={() => router.push('/attendance/check-in')}>Check-in Now</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto py-8 px-4">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2">
          <CalendarCheck className="h-8 w-8 text-primary" /> Workday In Progress
        </h1>
        <p className="text-muted-foreground">Session started {formatDistanceToNow(currentEntry.checkInTime?.toDate() || new Date(), { addSuffix: true })}.</p>
      </div>

      <Card className="shadow-lg border-emerald-500/20 overflow-hidden rounded-sm">
        <CardHeader className="bg-emerald-500/5 border-b py-6">
          <CardTitle className="text-xl">Check-out Verification</CardTitle>
          <CardDescription>Final profile capture and GPS sync.</CardDescription>
        </CardHeader>
        <CardContent className="pt-8 pb-8 space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className={cn("relative w-full aspect-video bg-black rounded-sm overflow-hidden shadow-2xl", !isCameraActive && "hidden")}>
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
              
              {facingMode === "user" && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center opacity-40">
                  <div className="w-24 h-24 rounded-full border-2 border-white mt-4" />
                  <div className="w-40 h-24 rounded-t-full border-2 border-t-2 border-x-2 border-white -mt-2" />
                  <p className="text-white text-[8px] font-black uppercase mt-2 bg-black/20 px-2 rounded-full tracking-widest">Position face and shoulders here</p>
                </div>
              )}

              <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-4">
                <Button onClick={toggleCamera} variant="secondary" size="icon" className="rounded-full bg-black/40 text-white border-white/20 hover:bg-black/60 shadow-lg"><SwitchCamera className="h-5 w-5" /></Button>
                <Button onClick={capturePhoto} className="rounded-full h-14 w-14 p-0 shadow-lg border-4 border-white/20"><Camera className="h-7 w-7" /></Button>
                <div className="w-10" />
              </div>
            </div>

            {selfie && !isCameraActive && (
              <div className="relative w-full aspect-video group">
                <img src={selfie} className="w-full h-full object-cover rounded-sm border-2 border-emerald-200 shadow-md" alt="Checkout Selfie" />
                <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-sm uppercase tracking-tighter">Exit Profile Snapshot</div>
                <Button variant="destructive" size="icon" className="absolute top-2 right-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setSelfie(null)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            )}

            {!selfie && !isCameraActive && (
              <Button onClick={() => startCamera()} variant="outline" className="w-full h-40 border-dashed border-2 rounded-sm flex flex-col gap-3 hover:bg-emerald-50/50 transition-all border-emerald-200 text-emerald-700">
                <div className="p-3 bg-emerald-100 rounded-full text-emerald-600">
                  <Camera className="h-8 w-8" />
                </div>
                <div className="flex flex-col gap-1 text-center px-4">
                  <span className="font-black uppercase text-xs tracking-widest">Open Camera</span>
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">Live Exit Audit Required</span>
                </div>
              </Button>
            )}
          </div>

          <Button 
            className="w-full h-16 text-xl font-black rounded-sm shadow-xl bg-red-600 hover:bg-red-700 text-white transition-colors" 
            onClick={handleCheckOut}
            disabled={isProcessing || !selfie}
          >
            {isProcessing ? (
              <><Loader2 className="mr-2 h-6 w-6 animate-spin" /> Finalizing...</>
            ) : (
              <><LogOut className="mr-3 h-6 w-6" /> END WORKDAY</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}