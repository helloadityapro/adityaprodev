
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, useFirebaseApp } from '@/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, MapPin, Loader2, PlayCircle, HardHat, AlertCircle, UserCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export default function StartTripPage() {
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
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Camera Denied', description: 'Enable camera to verify reading.' });
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

  const handleStartTrip = async () => {
    if (!user || !trip || !photo || !reading) return;
    setIsProcessing(true);

    try {
      const storage = getStorage(firebaseApp);
      const photoRef = ref(storage, `trips/${assignmentId}/start_${Date.now()}.jpg`);
      await uploadString(photoRef, photo, 'data_url', { contentType: 'image/jpeg' });
      const photoUrl = await getDownloadURL(photoRef);

      await updateDocumentNonBlocking(tripRef, {
        status: 'Ongoing',
        startTime: serverTimestamp(),
        startReading: parseFloat(reading),
        startReadingPhoto: photoUrl,
        updatedAt: serverTimestamp()
      });

      toast({ title: 'Trip Started', description: 'Safe driving. Your start time and reading are logged.' });
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
          <PlayCircle className="h-8 w-8" /> Start Assigned Trip
        </h1>
        <p className="text-muted-foreground font-medium">Verify vehicle status at departure.</p>
      </div>

      <Card className="rounded-sm shadow-md border-primary/10">
        <CardHeader className="bg-primary/5 border-b">
          <CardTitle className="text-xl">Vehicle Audit: {trip?.vehicleDetails}</CardTitle>
          <CardDescription>Capture odometer reading and photo.</CardDescription>
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
              <Button onClick={capturePhoto} className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full h-14 w-14 p-0 shadow-2xl border-4 border-white/20"><Camera className="h-6 w-6" /></Button>
            </div>

            {photo && !isCameraActive && (
              <div className="relative w-full aspect-video group">
                <img src={photo} className="w-full h-full object-cover rounded-sm border-2 border-primary shadow-md" alt="Audit" />
                <Button variant="destructive" size="icon" className="absolute top-2 right-2 rounded-full opacity-0 group-hover:opacity-100" onClick={() => setPhoto(null)}><Camera className="h-4 w-4" /></Button>
              </div>
            )}

            {!photo && !isCameraActive && (
              <Button onClick={startCamera} variant="outline" className="w-full h-40 border-dashed border-2 rounded-sm flex flex-col gap-3 hover:bg-primary/5 transition-all">
                <Camera className="h-10 w-10 text-primary" />
                <span className="font-black uppercase text-xs tracking-widest text-primary">Capture Odometer Photo</span>
              </Button>
            )}
          </div>

          <Button 
            className="w-full h-16 text-xl font-black rounded-sm shadow-xl" 
            onClick={handleStartTrip}
            disabled={isProcessing || !photo || !reading}
          >
            {isProcessing ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : 'CONFIRM & DEPART'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
