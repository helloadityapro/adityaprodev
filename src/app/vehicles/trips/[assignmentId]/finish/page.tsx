'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, useFirebaseApp } from '@/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, MapPin, Loader2, CheckCircle2, Flag, SwitchCamera, ImagePlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function FinishTripPage() {
  const params = useParams();
  const assignmentId = params.assignmentId as string;
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const tripRef = useMemoFirebase(() => doc(firestore, 'vehicle_assignments', assignmentId), [firestore, assignmentId]);
  const { data: trip, isLoading } = useDoc(tripRef);

  const [reading, setReading] = React.useState<string>("");
  const [photo, setPhoto] = React.useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = React.useState(false);
  const [facingMode, setFacingMode] = React.useState<"user" | "environment">("environment");
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const startCamera = async (mode: "user" | "environment" = facingMode) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode } });
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Camera Denied', description: 'Enable camera to verify reading.' });
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

  const handleFinishTrip = async () => {
    if (!user || !trip || !photo || !reading) return;
    setIsProcessing(true);

    try {
      const storage = getStorage(firebaseApp);
      const photoRef = ref(storage, `trips/${assignmentId}/finish_${Date.now()}.jpg`);
      await uploadString(photoRef, photo, 'data_url', { contentType: 'image/jpeg' });
      const photoUrl = await getDownloadURL(photoRef);

      const endValue = parseFloat(reading);

      // 1. Update assignment status
      await updateDocumentNonBlocking(tripRef, {
        status: 'Completed',
        endTime: serverTimestamp(),
        endReading: endValue,
        endReadingPhoto: photoUrl,
        updatedAt: serverTimestamp()
      });

      // 2. Update vehicle availability & reading
      if (trip.vehicleId) {
        updateDocumentNonBlocking(doc(firestore, 'vehicles', trip.vehicleId), {
          status: 'Available',
          currentReading: endValue
        });
      }

      toast({ title: 'Trip Concluded', description: 'Report published. Vehicle is now available for allotment.' });
      router.push('/vehicles/assigned');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
      setIsProcessing(false);
    }
  };

  if (isLoading) return <div className="p-8 max-w-2xl mx-auto"><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-8 max-w-2xl mx-auto pb-20 px-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2">
          <Flag className="h-8 w-8" /> Conclude Site Trip
        </h1>
        <p className="text-muted-foreground font-medium">Capture final vehicle status at destination.</p>
      </div>

      <Card className="rounded-sm shadow-md border-primary/10">
        <CardHeader className="bg-muted/5 border-b">
          <CardTitle className="text-xl">Arrival Audit: {trip?.vehicleDetails}</CardTitle>
          <CardDescription>Captured start reading: {trip?.startReading} KM</CardDescription>
        </CardHeader>
        <CardContent className="pt-8 space-y-6">
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-wider">Final odometer reading (KM)</Label>
            <Input 
              type="number" 
              placeholder="Enter final KM value..." 
              value={reading} 
              onChange={e => setReading(e.target.value)}
              className="h-12 text-lg font-mono font-bold rounded-sm"
            />
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className={cn("relative w-full aspect-video bg-black rounded-sm overflow-hidden", !isCameraActive && "hidden")}>
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-4">
                <Button onClick={toggleCamera} variant="secondary" size="icon" className="rounded-full bg-black/40 text-white border-white/20 hover:bg-black/60 shadow-lg"><SwitchCamera className="h-5 w-5" /></Button>
                <Button onClick={capturePhoto} className="rounded-full h-14 w-14 p-0 shadow-2xl border-4 border-white/20 bg-white text-black hover:bg-white/90"><Camera className="h-7 w-7" /></Button>
                <div className="w-10" />
              </div>
            </div>

            {photo && !isCameraActive && (
              <div className="relative w-full aspect-video group">
                <img src={photo} className="w-full h-full object-cover rounded-sm border-2 border-primary shadow-md" alt="Audit" />
                <Button variant="destructive" size="icon" className="absolute top-2 right-2 rounded-full opacity-0 group-hover:opacity-100" onClick={() => setPhoto(null)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            )}

            {!photo && !isCameraActive && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                <Button onClick={() => startCamera()} variant="outline" className="h-40 border-dashed border-2 rounded-sm flex flex-col gap-3 hover:bg-primary/5 transition-all">
                  <Camera className="h-10 w-10 text-primary" />
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
                  <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-full h-40 border-dashed border-2 rounded-sm flex flex-col gap-3 hover:bg-primary/5 transition-all">
                    <ImagePlus className="h-10 w-10 text-primary" />
                    <span className="font-black uppercase text-xs tracking-widest text-primary">Upload from Gallery</span>
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Button 
            className="w-full h-16 text-xl font-black rounded-sm shadow-xl bg-slate-900" 
            onClick={handleFinishTrip}
            disabled={isProcessing || !photo || !reading || parseFloat(reading) <= (trip?.startReading || 0)}
          >
            {isProcessing ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : 'END TRIP & CHECK-OUT'}
          </Button>
          {reading && trip?.startReading && parseFloat(reading) <= trip.startReading && (
            <p className="text-[10px] text-destructive font-black uppercase text-center">End reading must be greater than start reading ({trip.startReading} KM)</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
