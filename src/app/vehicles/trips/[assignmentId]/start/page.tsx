'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, useFirebaseApp } from '@/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, MapPin, Loader2, PlayCircle, HardHat, AlertCircle, UserCircle2, SwitchCamera, ImagePlus, Trash2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function StartTripPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = React.use(params);
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const tripRef = useMemoFirebase(() => doc(firestore, 'vehicle_assignments', assignmentId), [firestore, assignmentId]);
  const { data: trip, isLoading } = useDoc<any>(tripRef);

  const [reading, setReading] = React.useState<string>("");
  const [photo, setPhoto] = React.useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = React.useState(false);
  const [facingMode, setFacingMode] = React.useState<"user" | "environment">("environment");
  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const canStartTrip = React.useMemo(() => {
    if (!trip || !user) return false;
    if (trip.status !== 'Approved') return false;
    
    // Rule: Driver handles Owned, Requester handles Rented
    if (trip.vehicleOwnership === 'Rented') {
      return trip.userId === user.uid;
    }
    return trip.driverId === user.uid;
  }, [trip, user]);

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
      console.error('Camera denied:', error);
      setHasCameraPermission(false);
      toast({ variant: 'destructive', title: 'Camera Denied', description: 'Enable camera permissions in your device settings to verify reading.' });
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
        setPhoto(canvas.toDataURL("image/jpeg", 0.8));
        const stream = video.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
        setIsCameraActive(false);
      }
    }
  };

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhoto(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStartTrip = async () => {
    if (!user || !trip || !reading) return;
    setIsProcessing(true);

    try {
      let photoUrl = "";
      if (photo) {
        const storage = getStorage(firebaseApp);
        const photoRef = ref(storage, `trips/${assignmentId}/start_${Date.now()}.jpg`);
        await uploadString(photoRef, photo, 'data_url', { contentType: 'image/jpeg' });
        photoUrl = await getDownloadURL(photoRef);
      }

      // Non-blocking update for trip start
      updateDocumentNonBlocking(tripRef, {
        status: 'Ongoing',
        startTime: serverTimestamp(),
        startReading: parseFloat(reading),
        startReadingPhoto: photoUrl || null,
        updatedAt: serverTimestamp()
      });

      toast({ title: 'Trip Started', description: 'Safe driving. Your start time and reading are logged.' });
      router.push('/vehicles/trips/manage');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
      setIsProcessing(false);
    }
  };

  if (isLoading) return <div className="p-8 max-w-2xl mx-auto"><Skeleton className="h-64 w-full" /></div>;

  if (!canStartTrip && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Restricted</AlertTitle>
          <AlertDescription>
            {trip?.vehicleOwnership === 'Rented' 
              ? "Since this is a Rented vehicle, only the requester can record the start reading." 
              : "Only the designated system driver is authorized to start this trip."}
          </AlertDescription>
        </Alert>
        <Button variant="outline" asChild><Link href="/vehicles/trips/manage"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Trips</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto pb-20 px-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
          <PlayCircle className="h-8 w-8" /> Start Assigned Trip
        </h1>
        <p className="text-muted-foreground font-medium">Verify vehicle status at departure.</p>
      </div>

      <Card className="rounded-sm shadow-md border-primary/10">
        <CardHeader className="bg-primary/5 border-b">
          <CardTitle className="text-xl">Vehicle Audit: {trip?.vehicleDetails}</CardTitle>
          <CardDescription>Capture odometer reading and photo (Photo is optional).</CardDescription>
        </CardHeader>
        <CardContent className="pt-8 space-y-6">
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-wider">Current odometer reading (KM)</Label>
            <Input 
              type="number" 
              placeholder="Enter numerical value..." 
              value={reading} 
              onChange={e => setReading(e.target.value)}
              className="h-12 text-lg font-mono font-bold rounded-sm"
            />
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className={cn("relative w-full aspect-video bg-black rounded-sm overflow-hidden", !isCameraActive && "hidden")}>
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-4">
                <Button onClick={toggleCamera} variant="secondary" size="icon" className="rounded-full h-10 w-10 p-0 bg-black/40 text-white border-white/20 hover:bg-black/60 shadow-lg"><SwitchCamera className="h-5 w-5" /></Button>
                <Button onClick={capturePhoto} className="rounded-full h-14 w-14 p-0 shadow-2xl border-4 border-white/20 bg-white text-black hover:bg-white/90 transition-transform active:scale-90"><Camera className="h-7 w-7" /></Button>
                <div className="w-10" />
              </div>
            </div>

            {photo && !isCameraActive && (
              <div className="relative w-full aspect-video group">
                <img src={photo} className="w-full h-full object-cover rounded-sm border-2 border-primary shadow-md" alt="Audit" />
                <Button variant="destructive" size="icon" className="absolute top-2 right-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setPhoto(null)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            )}

            {!photo && !isCameraActive && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                <Button onClick={() => startCamera()} variant="outline" className="h-40 border-dashed border-2 rounded-sm flex flex-col gap-3 hover:bg-primary/5 transition-all text-primary group">
                  <Camera className="h-10 w-10 group-hover:scale-110 transition-transform" />
                  <span className="font-black uppercase text-xs tracking-widest text-primary">Capture Live Photo</span>
                </Button>

                <div className="relative">
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleGalleryUpload} 
                  />
                  <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-full h-40 border-dashed border-2 rounded-sm flex flex-col gap-3 hover:bg-primary/5 transition-all text-primary group">
                    <ImagePlus className="h-10 w-10 group-hover:scale-110 transition-transform" />
                    <span className="font-black uppercase text-xs tracking-widest text-primary">Upload from Gallery</span>
                  </Button>
                </div>
              </div>
            )}

            {hasCameraPermission === false && (
              <Alert variant="secondary" className="border-dashed">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Camera Disabled</AlertTitle>
                <AlertDescription>Hardware access is disabled. You can still proceed by manually entering the odometer reading.</AlertDescription>
              </Alert>
            )}
          </div>

          <Button 
            className="w-full h-16 text-xl font-black rounded-sm shadow-xl transition-all active:scale-[0.98]" 
            onClick={handleStartTrip}
            disabled={isProcessing || !reading}
          >
            {isProcessing ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : 'CONFIRM & DEPART'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
