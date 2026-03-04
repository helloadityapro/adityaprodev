
"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking, useFirebaseApp } from "@/firebase";
import { collection, doc, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, CalendarCheck, Clock, Navigation, Camera, Trash2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export default function CheckInPage() {
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [selfie, setSelfie] = React.useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = React.useState(false);
  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user" } 
      });
      setHasCameraPermission(true);
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      setHasCameraPermission(false);
      toast({ variant: 'destructive', title: 'Camera Access Denied', description: 'Please enable camera permissions to check in.' });
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
    
    if (!location) {
      setIsProcessing(false);
      return;
    }

    try {
      const storage = getStorage(firebaseApp);
      const selfieRef = ref(storage, `attendance/${user.uid}/checkin_${Date.now()}.jpg`);
      await uploadString(selfieRef, selfie, 'data_url', { contentType: 'image/jpeg' });
      const selfieUrl = await getDownloadURL(selfieRef);

      const today = format(new Date(), 'yyyy-MM-dd');
      
      await addDocumentNonBlocking(collection(firestore, 'attendance'), {
        userId: user.uid,
        userName: userProfile.username || user.email,
        checkInTime: serverTimestamp(),
        checkInLat: location.lat,
        checkInLng: location.lng,
        checkInSelfieUrl: selfieUrl,
        status: 'ongoing',
        date: today,
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
    <div className="space-y-8 max-w-2xl mx-auto py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2">
          <CalendarCheck className="h-8 w-8" /> Workday Attendance
        </h1>
        <p className="text-muted-foreground">Start your professional day with verified GPS and Selfie check-in.</p>
      </div>

      <Card className="shadow-lg border-primary/10 rounded-sm">
        <CardHeader className="bg-primary/5 border-b py-6">
          <CardTitle className="text-xl">Daily Check-in</CardTitle>
          <CardDescription>Capture identity and location.</CardDescription>
        </CardHeader>
        <CardContent className="pt-8 pb-8 space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className={cn("relative w-full aspect-video bg-black rounded-sm overflow-hidden", !isCameraActive && "hidden")}>
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
              <Button onClick={capturePhoto} className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full h-12 w-12 p-0"><Camera className="h-6 w-6" /></Button>
            </div>

            {selfie && !isCameraActive && (
              <div className="relative w-full aspect-video group">
                <img src={selfie} className="w-full h-full object-cover rounded-sm border" alt="Selfie" />
                <Button variant="destructive" size="icon" className="absolute top-2 right-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setSelfie(null)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            )}

            {!selfie && !isCameraActive && (
              <Button onClick={startCamera} variant="outline" className="w-full h-32 border-dashed rounded-sm flex flex-col gap-2">
                <Camera className="h-8 w-8 text-primary" />
                <span className="font-bold uppercase text-xs">Capture Verification Selfie</span>
              </Button>
            )}
          </div>

          <div className="p-4 bg-amber-50 border border-amber-100 rounded-sm flex items-start gap-3">
            <MapPin className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-800 leading-relaxed font-bold uppercase tracking-tight">
              Selfie and GPS coordinates are mandatory for audit compliance.
            </p>
          </div>

          <Button 
            className="w-full h-16 text-xl font-black rounded-sm shadow-xl" 
            onClick={handleCheckIn}
            disabled={isProcessing || !selfie}
          >
            {isProcessing ? (
              <><Loader2 className="mr-2 h-6 w-6 animate-spin" /> Finalizing...</>
            ) : (
              <>START WORKDAY</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
