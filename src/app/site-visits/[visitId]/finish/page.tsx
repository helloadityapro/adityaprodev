"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, useFirebaseApp } from "@/firebase";
import { doc, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Camera, 
  MapPin, 
  Loader2, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  UserCheck, 
  AlertCircle, 
  Users, 
  ImageIcon, 
  X, 
  Maximize2, 
  UserCircle2, 
  SwitchCamera, 
  ImagePlus, 
  ArrowLeft, 
  ArrowRight,
  Send, 
  Flag, 
  Navigation,
  Save,
  ChevronUp,
  ArrowUp
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

const PURPOSES = ["Kick-off visit", "Regular visit", "Site team meetup", "Vendor meetup"];

type TaskItem = {
  text: string;
  photoUrl: string | null;
  localPhoto?: string | null;
};

export default function FinishSiteVisitPage({ params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = React.use(params);
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const visitRef = useMemoFirebase(() => doc(firestore, 'site_visits', visitId), [firestore, visitId]);
  const { data: visit, isLoading } = useDoc(visitRef);

  const [isFinalizing, setIsFinalizing] = React.useState(false);
  const [selfie, setSelfie] = React.useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = React.useState(false);
  const [facingMode, setFacingMode] = React.useState<"user" | "environment">("user");
  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const finalFormRef = React.useRef<HTMLDivElement>(null);
  
  const [purpose, setPurpose] = React.useState("");
  const [details, setDetails] = React.useState("");
  const [customerAvailable, setCustomerAvailable] = React.useState("no");
  const [customerNames, setCustomerNames] = React.useState("");
  const [tasks, setTasks] = React.useState<TaskItem[]>([{ text: "", photoUrl: null }]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (visit?.tasks) {
      setTasks(visit.tasks.length > 0 ? visit.tasks : [{ text: "", photoUrl: null }]);
    }
    if (visit?.purpose) setPurpose(visit.purpose);
    if (visit?.details) setDetails(visit.details);
    if (visit?.customerAvailable !== undefined) setCustomerAvailable(visit.customerAvailable ? "yes" : "no");
    if (visit?.customerNames) setCustomerNames(visit.customerNames);
  }, [visit]);

  const startCamera = async (mode: "user" | "environment" = facingMode) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      setHasCameraPermission(true);
      setIsCameraActive(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasCameraPermission(false);
      setIsCameraActive(false);
      toast({
        variant: 'destructive',
        title: 'Camera Access Denied',
        description: 'Please enable camera permissions in your settings to capture the mandatory verification selfie.',
      });
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
    if (videoRef.current && videoRef.current.readyState === 4) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        
        const timestamp = format(new Date(), 'dd/MM/yyyy HH:mm:ss');
        ctx.font = "bold 24px sans-serif";
        ctx.fillStyle = "white";
        ctx.shadowColor = "black";
        ctx.shadowBlur = 4;
        ctx.lineWidth = 2;
        const textWidth = ctx.measureText(timestamp).width;
        ctx.fillText(timestamp, canvas.width - textWidth - 20, canvas.height - 30);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        setSelfie(dataUrl);
        
        const stream = video.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
        setIsCameraActive(false);
      }
    } else {
      toast({ variant: 'destructive', title: 'Camera Not Ready', description: 'Please wait for the video feed to initialize.' });
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
          toast({ variant: 'destructive', title: 'GPS Error', description: 'Location access required for site audit.' });
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  };

  const addTask = () => setTasks([...tasks, { text: "", photoUrl: null }]);
  const removeTask = (index: number) => setTasks(tasks.filter((_, i) => i !== index));
  const updateTaskText = (index: number, val: string) => {
    const newTasks = [...tasks];
    newTasks[index].text = val;
    setTasks(newTasks);
  };

  const handleTaskPhotoChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const newTasks = [...tasks];
        newTasks[index].localPhoto = event.target?.result as string;
        setTasks(newTasks);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeTaskPhoto = (index: number) => {
    const newTasks = [...tasks];
    newTasks[index].localPhoto = null;
    newTasks[index].photoUrl = null;
    setTasks(newTasks);
  };

  const processTaskPhotos = async () => {
    const storage = getStorage(firebaseApp);
    const metadata = { contentType: 'image/jpeg' };
    
    return await Promise.all(tasks.map(async (task, idx) => {
      if (task.localPhoto) {
        const taskPhotoRef = ref(storage, `site_visits/${user!.uid}/task_${idx}_${Date.now()}.jpg`);
        await uploadString(taskPhotoRef, task.localPhoto, 'data_url', metadata);
        const url = await getDownloadURL(taskPhotoRef);
        return { text: task.text, photoUrl: url };
      }
      return { text: task.text, photoUrl: task.photoUrl };
    }));
  };

  const handleSaveProgress = async () => {
    if (!user || !visit) return;
    setIsSubmitting(true);
    try {
      const finalTasks = await processTaskPhotos();
      await updateDocumentNonBlocking(visitRef, {
        tasks: finalTasks.filter(t => t.text.trim() !== "" || t.photoUrl),
        updatedAt: serverTimestamp()
      });
      toast({ title: 'Draft Saved', description: 'Action items updated. Visit remains ongoing.' });
      router.push('/site-visits/active');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
      setIsSubmitting(false);
    }
  };

  const handleProceedToFinal = () => {
    setIsFinalizing(true);
    setTimeout(() => {
      finalFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const onSubmitFinalReport = async () => {
    if (!user || !visit || !selfie || !purpose || !details) {
      toast({ variant: 'destructive', title: 'Mandatory Fields Missing', description: 'Verification Selfie, Purpose and Narrative are required for final submission.' });
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
      const metadata = { contentType: 'image/jpeg' };
      
      const selfieRef = ref(storage, `site_visits/${user.uid}/selfie_${Date.now()}.jpg`);
      await uploadString(selfieRef, selfie, 'data_url', metadata);
      const selfieUrl = await getDownloadURL(selfieRef);

      const finalTasks = await processTaskPhotos();

      await updateDocumentNonBlocking(visitRef, {
        endTime: serverTimestamp(),
        endLat: endLocation?.lat || visit.startLat,
        endLng: endLocation?.lng || visit.startLng,
        selfieUrl,
        purpose,
        details,
        tasks: finalTasks.filter(t => t.text.trim() !== "" || t.photoUrl),
        customerAvailable: customerAvailable === "yes",
        customerNames: customerAvailable === "yes" ? customerNames : "",
        status: 'completed',
        updatedAt: serverTimestamp()
      });

      toast({ variant: 'success', title: 'Report Published', description: `Visit to ${visit.siteName} concluded and documented.` });
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
      <div className="p-8 flex flex-col items-center justify-center text-center gap-4 min-h-[60vh]">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <h2 className="text-2xl font-bold">Visit Completed</h2>
        <p className="text-muted-foreground">The visit report for {visit.siteName} has already been published.</p>
        <Button onClick={() => router.push('/site-visits/history')} className="rounded-sm font-bold shadow-md">View History</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20 px-2 sm:px-4">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl sm:text-2xl">
          <Navigation className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          Continue Site Visit
        </h1>
        <p className="text-muted-foreground text-xs sm:text-sm">Documenting presence and activities at <strong>{visit.siteName}</strong>.</p>
      </div>

      <div className="space-y-6">
        {/* Section 1: Action Items - ALWAYS VISIBLE */}
        <Card className="rounded-sm shadow-md border-primary/10 transition-all duration-300">
          <CardHeader className="bg-primary/5 border-b p-4 sm:py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-xs sm:text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" /> Action Items / Task Checklist
                </CardTitle>
                <CardDescription className="text-[10px] font-bold text-muted-foreground uppercase">Log current activities and findings</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={addTask} className="text-primary font-bold h-9 sm:h-8 px-3 border-primary/20 bg-white w-full sm:w-auto">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Action
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 space-y-4">
            {tasks.map((task, idx) => (
              <div key={idx} className="space-y-3 p-3 sm:p-4 border rounded-sm bg-muted/5 relative group animate-in slide-in-from-top-1">
                <div className="flex gap-2">
                  <Input 
                    placeholder={`Activity item #${idx + 1}...`} 
                    value={task.text} 
                    onChange={e => updateTaskText(idx, e.target.value)}
                    className="rounded-sm flex-1 bg-background h-10 sm:h-11"
                  />
                  {tasks.length > 1 && (
                    <Button variant="ghost" size="icon" className="text-destructive shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeTask(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <div className="flex items-center gap-4">
                  {(task.localPhoto || task.photoUrl) ? (
                    <div className="relative h-20 w-32 rounded-sm overflow-hidden border shadow-sm group">
                      <img src={task.localPhoto || task.photoUrl!} className="h-full w-full object-cover" alt="Task proof" />
                      <Button 
                        variant="destructive" size="icon" 
                        className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity" 
                        onClick={() => removeTaskPhoto(idx)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="relative w-full sm:w-auto">
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        className="hidden" 
                        id={`task-photo-${idx}`}
                        onChange={e => handleTaskPhotoChange(idx, e)}
                      />
                      <Button variant="outline" size="sm" asChild className="h-9 sm:h-8 text-[10px] font-bold rounded-sm cursor-pointer border-primary/20 text-primary hover:bg-primary/5 w-full sm:w-auto">
                        <label htmlFor={`task-photo-${idx}`}>
                          <ImageIcon className="h-3.5 w-3.5 mr-1.5" /> Attach Photo
                        </label>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
          <CardFooter className="bg-muted/10 border-t p-4 sm:p-6 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button 
                variant="outline"
                className="flex-1 h-12 text-sm font-bold rounded-sm border-primary/30 text-primary hover:bg-primary/5" 
                onClick={handleSaveProgress}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Progress & Continue Later
              </Button>
              {!isFinalizing && (
                <Button 
                  className="flex-1 h-12 text-sm font-black rounded-sm shadow-xl" 
                  onClick={handleProceedToFinal}
                  disabled={isSubmitting || tasks.every(t => t.text.trim() === "")}
                >
                  Complete Site Visit <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>

        {/* Section 2: Final Audit - VISIBLE WHEN isFinalizing is TRUE */}
        <AnimatePresence>
          {isFinalizing && (
            <motion.div 
              ref={finalFormRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="space-y-6 animate-in slide-in-from-bottom-4 duration-500"
            >
              <div className="flex items-center justify-between px-1">
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 border-amber-200 uppercase font-black px-3 h-7 rounded-sm text-[9px]">Final Submission Required</Badge>
                <Button variant="ghost" onClick={() => { setIsFinalizing(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-muted-foreground font-bold h-7 px-2 text-[10px] uppercase">
                  <ArrowUp className="mr-1.5 h-3 w-3" /> Edit Tasks
                </Button>
              </div>

              <Card className="rounded-sm shadow-md overflow-hidden border-primary/10">
                <CardHeader className="bg-primary/5 py-4 border-b p-4">
                  <CardTitle className="text-xs sm:text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <Camera className="h-4 w-4 text-primary" /> Mandatory Selfie Audit
                  </CardTitle>
                  <CardDescription className="text-[9px] font-bold text-amber-700 uppercase">Include face and upper body profile</CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col items-center gap-4">
                    <div className={cn("relative w-full max-w-sm aspect-video bg-black rounded-sm overflow-hidden shadow-2xl", !isCameraActive && "hidden")}>
                      <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-4">
                        <Button onClick={toggleCamera} variant="secondary" size="icon" className="rounded-full h-10 w-10 p-0 bg-black/40 text-white border-white/20 hover:bg-black/60 shadow-lg"><SwitchCamera className="h-5 w-5" /></Button>
                        <Button onClick={capturePhoto} className="rounded-full h-14 w-14 p-0 bg-white hover:bg-white/90 text-black border-4 border-primary shadow-xl transition-transform active:scale-90"><Camera className="h-6 w-6" /></Button>
                        <div className="w-10" />
                      </div>
                    </div>

                    {selfie && !isCameraActive && (
                      <div className="relative group w-full max-w-sm">
                        <img src={selfie} className="w-full aspect-video object-cover rounded-sm border-2 border-primary shadow-lg" alt="Verification" />
                        <Button variant="destructive" size="icon" className="absolute top-2 right-2 rounded-full h-8 w-8" onClick={() => setSelfie(null)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    )}

                    {!selfie && !isCameraActive && (
                      <Button onClick={() => startCamera()} variant="outline" className="w-full max-w-sm h-32 border-dashed border-2 rounded-sm flex flex-col gap-2 hover:bg-primary/5 transition-all text-primary">
                        <Camera className="h-8 w-8" />
                        <span className="font-bold uppercase text-[10px] tracking-widest">Open Camera for Audit</span>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-sm shadow-md border-primary/10">
                <CardHeader className="p-4"><CardTitle className="text-sm uppercase font-bold tracking-widest">Final Report Metadata</CardTitle></CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Purpose of Visit</Label>
                    <Select value={purpose} onValueChange={setPurpose}>
                      <SelectTrigger className="rounded-sm h-11"><SelectValue placeholder="Select purpose" /></SelectTrigger>
                      <SelectContent>
                        {PURPOSES.map(p => <SelectItem key={p} value={p} className="text-sm">{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Detailed Narrative Summary</Label>
                    <Textarea placeholder="Detail the progress, findings, or critical discussions..." rows={4} value={details} onChange={e => setDetails(e.target.value)} className="rounded-sm text-sm" />
                  </div>

                  <div className="space-y-4 p-4 bg-primary/[0.02] rounded-sm border border-primary/10">
                    <Label className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 text-primary"><Users className="h-4 w-4" /> Customer Available?</Label>
                    <RadioGroup value={customerAvailable} onValueChange={setCustomerAvailable} className="flex gap-6 mt-1">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="c-yes" /><Label htmlFor="c-yes" className="font-bold cursor-pointer text-xs">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="c-no" /><Label htmlFor="c-no" className="font-bold cursor-pointer text-xs">No</Label>
                      </div>
                    </RadioGroup>
                    {customerAvailable === 'yes' && (
                      <div className="space-y-2 mt-4 animate-in fade-in duration-300">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground">Persons met during visit</Label>
                        <Input placeholder="Enter names..." value={customerNames} onChange={e => setCustomerNames(e.target.value)} className="rounded-sm bg-background h-10" />
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/10 border-t p-4 sm:p-6">
                  <Button 
                    className="w-full h-14 text-base font-black rounded-sm shadow-xl tracking-tight" 
                    onClick={onSubmitFinalReport}
                    disabled={isSubmitting || !selfie || !purpose || details.trim().length < 10}
                  >
                    {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <><Send className="mr-2 h-4 w-4" /> CONCLUDE & PUBLISH REPORT</>}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
