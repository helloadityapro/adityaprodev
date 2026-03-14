"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking, useFirebaseApp } from "@/firebase";
import { collection, doc, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, CalendarCheck, Camera, Trash2, SwitchCamera, History, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function CheckInPage() {
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [selfie, setSelfie] = React.useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = React.useState(false);
  const [facingMode, setFacingMode] = React.useState<"user" | "environment">("user");
  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);

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
      setHasCameraPermission(false);
      toast({ variant: 'destructive', title: 'Camera Access Denied', description: 'Please enable permissions to check in.' });
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
        toast({ variant: 'destructive', title: 'GPS Error', description: 'Geolocation not supported.' });
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => {
          toast({ variant: 'destructive', title: 'GPS Error', description: 'Location access required.' });
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const handleCheckIn = async () => {
    if (!user || !userProfile || !selfie) return;
    setIsProcessing(true);
    const location = await getCurrentLocation();
    if (!location) { setIsProcessing(false); return; }

    try {
      const storage = getStorage(firebaseApp);
      const selfieRef = ref(storage, `attendance/${user.uid}/checkin_${Date.now()}.jpg`);
      await uploadString(selfieRef, selfie, 'data_url', { contentType: 'image/jpeg' });
      const selfieUrl = await getDownloadURL(selfieRef);

      await addDocumentNonBlocking(collection(firestore, 'attendance'), {
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
      });

      toast({ variant: 'success', title: 'Check-in Successful' });
      router.push('/attendance/check-out');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-10">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2">
            <CalendarCheck className="h-6 w-6 text-primary" /> Check-in
          </h1>
          <p className="text-muted-foreground text-xs font-medium">Verify your site presence.</p>
        </div>
        <Button variant="ghost" size="sm" asChild className="rounded-sm font-bold text-primary h-8 px-3 border border-primary/10">
          <Link href="/attendance/history"><History className="mr-1.5 h-3.5 w-3.5" /> Log</Link>
        </Button>
      </div>

      <Card className="shadow-lg border-primary/10 rounded-sm overflow-hidden">
        <CardHeader className="bg-primary/5 py-4 border-b">
          <CardTitle className="text-sm font-black uppercase tracking-widest">Verification Profile</CardTitle>
          <CardDescription className="text-[10px] font-bold text-amber-700 uppercase">Live front profile & GPS sync</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className={cn("relative w-full aspect-video bg-black rounded-sm overflow-hidden shadow-2xl", !isCameraActive && "hidden")}>
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
              {facingMode === "user" && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center opacity-40">
                  <div className="w-24 h-24 rounded-full border-2 border-white mt-4" />
                  <div className="w-40 h-24 rounded-t-full border-2 border-white -mt-2" />
                  <p className="text-white text-[8px] font-black uppercase mt-2 bg-black/20 px-2 rounded-full tracking-widest">Center Face</p>
                </div>
              )}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-4">
                <Button onClick={toggleCamera} variant="secondary" size="icon" className="rounded-full h-10 w-10 bg-black/40 border-white/20"><SwitchCamera className="h-5 w-5" /></Button>
                <Button onClick={capturePhoto} className="rounded-full h-14 w-14 p-0 shadow-2xl border-4 border-primary bg-white text-black"><Camera className="h-7 w-7" /></Button>
                <div className="w-10" />
              </div>
            </div>

            {selfie && !isCameraActive && (
              <div className="relative group w-full">
                <img src={selfie} className="w-full aspect-video object-cover rounded-sm border-2 border-primary shadow-md" alt="Selfie" />
                <Button variant="destructive" size="icon" className="absolute top-2 right-2 rounded-full h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setSelfie(null)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            )}

            {!selfie && !isCameraActive && (
              <Button onClick={() => startCamera()} variant="outline" className="w-full h-40 border-dashed border-2 rounded-sm flex flex-col gap-3 hover:bg-primary/5 transition-all text-primary border-primary/20">
                <Camera className="h-10 w-10" />
                <div className="flex flex-col gap-1 text-center">
                  <span className="font-black uppercase text-xs tracking-widest">Open Camera</span>
                  <span className="text-[10px] text-muted-foreground font-bold">Audit selfie required</span>
                </div>
              </Button>
            )}
          </div>

          {hasCameraPermission === false && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Camera Required</AlertTitle>
              <AlertDescription>Enable camera permissions in settings to continue.</AlertDescription>
            </Alert>
          )}

          <Button 
            className="w-full h-14 text-lg font-black rounded-sm shadow-xl" 
            onClick={handleCheckIn}
            disabled={isProcessing || !selfie}
          >
            {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'START WORKDAY'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}