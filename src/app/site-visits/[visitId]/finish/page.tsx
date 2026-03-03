"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, useFirebaseApp } from "@/firebase";
import { doc, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Camera, MapPin, Loader2, Plus, Trash2, CheckCircle2, UserCheck, AlertCircle, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const PURPOSES = ["Kick-off visit", "Regular visit", "Site team meetup", "Vendor meetup"];

export default function FinishSiteVisitPage() {
  const params = useParams();
  const visitId = params.visitId as string;
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const visitRef = useMemoFirebase(() => doc(firestore, 'site_visits', visitId), [firestore, visitId]);
  const { data: visit, isLoading } = useDoc(visitRef);

  const [selfie, setSelfie] = React.useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = React.useState(false);
  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  
  const [purpose, setPurpose] = React.useState("");
  const [details, setDetails] = React.useState("");
  const [customerAvailable, setCustomerAvailable] = React.useState("no");
  const [customerNames, setCustomerNames] = React.useState("");
  const [tasks, setTasks] = React.useState<string[]>([""]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      setHasCameraPermission(true);
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'Camera Access Denied',
        description: 'Please enable camera permissions to capture the mandatory selfie.',
      });
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Draw video frame
        ctx.drawImage(videoRef.current, 0, 0);
        
        // Add Timestamp Overlay
        const timestamp = format(new Date(), 'dd/MM/yyyy HH:mm:ss');
        ctx.font = "bold 24px Inter, sans-serif";
        ctx.fillStyle = "white";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        const textWidth = ctx.measureText(timestamp).width;
        ctx.strokeText(timestamp, canvas.width - textWidth - 20, canvas.height - 30);
        ctx.fillText(timestamp, canvas.width - textWidth - 20, canvas.height - 30);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        setSelfie(dataUrl);
        
        // Stop stream
        const stream = videoRef.current.srcObject as MediaStream;
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
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  };

  const addTask = () => setTasks([...tasks, ""]);
  const removeTask = (index: number) => setTasks(tasks.filter((_, i) => i !== index));
  const updateTask = (index: number, val: string) => {
    const newTasks = [...tasks];
    newTasks[index] = val;
    setTasks(newTasks);
  };

  const onSubmit = async () => {
    if (!user || !visit || !selfie || !purpose || !details) {
      toast({ variant: 'destructive', title: 'Form Incomplete', description: 'Selfie, Purpose and Visit Details are mandatory.' });
      return;
    }

    if (customerAvailable === 'yes' && !customerNames.trim()) {
      toast({ variant: 'destructive', title: 'Missing Info', description: 'Please provide the names of the customer representatives.' });
      return;
    }

    setIsSubmitting(true);
    const endLocation = await getCurrentLocation();

    try {
      const storage = getStorage(firebaseApp);
      const selfieRef = ref(storage, `site_visits/${user.uid}/${Date.now()}.jpg`);
      await uploadString(selfieRef, selfie, 'data_url');
      const selfieUrl = await getDownloadURL(selfieRef);

      await updateDocumentNonBlocking(visitRef, {
        endTime: serverTimestamp(),
        endLat: endLocation?.lat || visit.startLat, // Fallback to start if GPS fails at end
        endLng: endLocation?.lng || visit.startLng,
        selfieUrl,
        purpose,
        details,
        tasks: tasks.filter(t => t.trim() !== ""),
        customerAvailable: customerAvailable === "yes",
        customerNames: customerAvailable === "yes" ? customerNames : "",
        status: 'completed',
        updatedAt: serverTimestamp()
      });

      toast({ title: 'Report Submitted', description: `Visit to ${visit.siteName} has been documented.` });
      router.push('/site-visits/history');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Submission Failed', description: e.message });
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;
  if (!visit) return <div className="p-8 text-center italic">Visit log not found.</div>;
  if (visit.status === 'completed') {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center gap-4">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <h2 className="text-2xl font-bold">Visit Already Completed</h2>
        <Button onClick={() => router.push('/site-visits/history')}>View Visit History</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
          <CheckCircle2 className="h-8 w-8" /> Finalize Visit Report
        </h1>
        <p className="text-muted-foreground">Provide details of your activities at <strong>{visit.siteName}</strong>.</p>
      </div>

      <div className="grid gap-8">
        {/* Verification Selfie */}
        <Card className="rounded-sm shadow-md overflow-hidden border-primary/10">
          <CardHeader className="bg-primary/5 py-4 border-b">
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" /> Manager Verification (Mandatory)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              {selfie ? (
                <div className="relative group">
                  <img src={selfie} className="w-full max-w-sm aspect-video object-cover rounded-sm border shadow-lg" alt="Verification" />
                  <Button 
                    variant="destructive" 
                    size="icon" 
                    className="absolute top-2 right-2 rounded-full h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" 
                    onClick={() => setSelfie(null)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : isCameraActive ? (
                <div className="space-y-4 w-full flex flex-col items-center">
                  <div className="relative w-full max-w-sm aspect-video bg-black rounded-sm overflow-hidden shadow-2xl">
                    <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                  </div>
                  <Button onClick={capturePhoto} className="w-full max-w-sm rounded-sm font-bold h-12 shadow-md">
                    Capture Timestamped Selfie
                  </Button>
                </div>
              ) : (
                <Button onClick={startCamera} variant="outline" className="w-full h-24 border-dashed rounded-sm flex flex-col gap-2 hover:bg-primary/5">
                  <Camera className="h-8 w-8 text-primary" />
                  <span className="font-bold">Open Camera for Verification</span>
                </Button>
              )}
              
              {hasCameraPermission === false && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Camera Access Required</AlertTitle>
                  <AlertDescription>Please enable camera access in your browser settings to verify your site presence.</AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Visit Details */}
        <Card className="rounded-sm shadow-md border-primary/10">
          <CardHeader>
            <CardTitle>Report Details</CardTitle>
            <CardDescription>Document the purpose and outcomes of this site visit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider">Purpose of Visit</Label>
              <Select value={purpose} onValueChange={setPurpose}>
                <SelectTrigger className="rounded-sm"><SelectValue placeholder="Select purpose" /></SelectTrigger>
                <SelectContent>
                  {PURPOSES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider">What happened in this visit?</Label>
              <Textarea 
                placeholder="Describe discussions, site status, or findings..." 
                rows={5} 
                value={details}
                onChange={e => setDetails(e.target.value)}
                className="rounded-sm" 
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider">Tasks Performed / Actions Taken</Label>
                <Button variant="ghost" size="sm" onClick={addTask} className="text-primary font-bold"><Plus className="h-3.5 w-3.5 mr-1" /> Add Item</Button>
              </div>
              <div className="space-y-2">
                {tasks.map((task, idx) => (
                  <div key={idx} className="flex gap-2 animate-in slide-in-from-top-1">
                    <Input 
                      placeholder={`Action item #${idx + 1}`} 
                      value={task} 
                      onChange={e => updateTask(idx, e.target.value)}
                      className="rounded-sm"
                    />
                    {tasks.length > 1 && (
                      <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => removeTask(idx)}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 p-4 bg-muted/20 rounded-sm border">
              <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" /> Was Customer or Representative Available During Visit?
              </Label>
              <RadioGroup value={customerAvailable} onValueChange={setCustomerAvailable} className="flex gap-6 mt-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="c-yes" />
                  <Label htmlFor="c-yes" className="font-bold cursor-pointer">YES</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="c-no" />
                  <Label htmlFor="c-no" className="font-bold cursor-pointer">NO</Label>
                </div>
              </RadioGroup>

              {customerAvailable === 'yes' && (
                <div className="space-y-2 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" /> Representative Name(s)
                  </Label>
                  <Input 
                    placeholder="Enter names of persons met at site..." 
                    value={customerNames}
                    onChange={e => setCustomerNames(e.target.value)}
                    className="rounded-sm bg-background"
                  />
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="bg-muted/10 border-t p-6">
            <Button 
              className="w-full h-14 text-xl font-black rounded-sm shadow-xl" 
              onClick={onSubmit}
              disabled={isSubmitting || !selfie || !purpose || details.trim().length < 10}
            >
              {isSubmitting ? <><Loader2 className="mr-2 h-6 w-6 animate-spin" /> Publishing Report...</> : 'End Visit & Submit Report'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}