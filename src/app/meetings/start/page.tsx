'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking, useFirebaseApp, useCollection } from '@/firebase';
import { collection, doc, serverTimestamp, query, where, limit } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Mic, 
  Square, 
  Play, 
  Trash2, 
  Save, 
  X, 
  Plus, 
  Building2, 
  CheckCircle2, 
  Loader2, 
  ShieldAlert,
  MicOff,
  Volume2,
  Calendar,
  MessageCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  Search,
  ChevronsUpDown,
  Check,
  ListChecks
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';

const REVIEW_POINTS = [
  { id: 'mms', label: 'Module Mounting Structure' },
  { id: 'mcr', label: 'Main Control Room' },
  { id: 'earthing', label: 'Earthing' },
  { id: 'acCable', label: 'AC Cable' },
  { id: 'dcCable', label: 'DC Cable' },
  { id: 'stringInverter', label: 'String Inverter' },
  { id: 'ltPanel', label: 'LT Panel' },
  { id: 'transformer', label: 'Transformer' },
  { id: 'rmuVcb', label: 'RMU/VCB' },
  { id: 'poleStructure', label: 'Four Pole/Two Pole Structure' },
  { id: 'modules', label: 'Modules' },
  { id: 'htLine', label: 'HT Line' },
];

export default function StartMeetingPage() {
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [siteId, setSiteId] = React.useState("");
  const [siteName, setSiteName] = React.useState("");
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearch, setSiteSearch] = React.useState("");

  const [observations, setObservations] = React.useState<Record<string, string>>({});
  const [customPoints, setCustomPoints] = React.useState<{ id: string, label: string, value: string }[]>([]);
  const [criticalPoints, setCriticalPoints] = React.useState("");
  
  // Recording State
  const [isRecording, setIsRecording] = React.useState(false);
  const [audioBlob, setAudioBlob] = React.useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [recordingTime, setRecordingTime] = React.useState(0);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<any>(sitesQuery);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      toast({ title: 'Recording Started', description: 'Meeting audio is being captured.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Mic Access Required', description: 'Please enable microphone access.' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const addCustomPoint = () => {
    const id = `custom_${Date.now()}`;
    setCustomPoints([...customPoints, { id, label: '', value: '' }]);
  };

  const updateCustomPoint = (id: string, field: 'label' | 'value', val: string) => {
    setCustomPoints(customPoints.map(p => p.id === id ? { ...p, [field]: val } : p));
  };

  const removeCustomPoint = (id: string) => {
    setCustomPoints(customPoints.filter(p => p.id !== id));
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSaveMeeting = async () => {
    if (!user || !userProfile || !siteId) {
      toast({ variant: 'destructive', title: 'Site Required', description: 'Please select a project site.' });
      return;
    }

    setIsSubmitting(true);
    try {
      let recordingUrl = "";
      if (audioBlob) {
        const storage = getStorage(firebaseApp);
        const path = `meetings/${user.uid}/${Date.now()}_recording.webm`;
        const storageRef = ref(storage, path);
        const uploadTask = uploadBytesResumable(storageRef, audioBlob);
        await new Promise((resolve, reject) => {
          uploadTask.on('state_changed', null, reject, resolve);
        });
        recordingUrl = await getDownloadURL(storageRef);
      }

      await addDocumentNonBlocking(collection(firestore, 'meetings'), {
        siteId,
        siteName,
        date: format(new Date(), 'yyyy-MM-dd HH:mm'),
        observations,
        customPoints,
        criticalPoints,
        recordingUrl,
        userId: user.uid,
        userName: userProfile.username || user.email,
        createdAt: serverTimestamp()
      });

      setIsSuccess(true);
      toast({ title: 'Meeting Saved', description: 'Site review record archived successfully.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4 animate-in fade-in zoom-in-95">
        <Card className="max-w-md w-full rounded-sm shadow-2xl border-primary/20">
          <CardHeader className="text-center pt-8">
            <div className="flex justify-center mb-6">
              <div className="bg-emerald-500/10 p-6 rounded-full"><CheckCircle2 className="h-16 w-16 text-emerald-600" /></div>
            </div>
            <CardTitle className="text-2xl font-black uppercase tracking-tight text-foreground">Meeting Archived</CardTitle>
            <CardDescription className="text-base font-medium text-muted-foreground mt-2">
              Review meeting for <strong>{siteName}</strong> has been successfully documented.
            </CardDescription>
          </CardHeader>
          <CardFooter className="space-y-4 pb-8 px-8 flex flex-col">
            <Button className="w-full h-12 text-sm font-black uppercase tracking-widest shadow-lg" onClick={() => router.push("/meetings/list")}>
              View Meetings Data
            </Button>
            <Button variant="ghost" className="w-full h-10 text-[10px] font-black uppercase text-muted-foreground" onClick={() => router.push("/dashboard")}>
              Return to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-3 text-2xl md:text-3xl font-black uppercase tracking-tight">
          <div className="bg-primary/10 p-2 rounded-sm"><Mic className="h-6 w-6 text-primary" /></div>
          Start Review Meeting
        </h1>
        <p className="text-muted-foreground text-sm font-medium">Document site progress and record collaborative discussions.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Site Selection */}
          <Card className="rounded-sm border-primary/10 shadow-md">
            <CardHeader className="py-4 border-b bg-muted/5">
              <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Site Context
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Select Project Site</Label>
                <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between h-12 rounded-sm font-bold border-primary/20">
                      <span className="truncate">{siteName || "Choose site..."}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-2xl">
                    <div className="flex items-center border-b px-3 bg-muted/20">
                      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                      <Input 
                        placeholder="Search sites..." 
                        className="h-10 border-none text-sm bg-transparent" 
                        value={siteSearch} 
                        onChange={e => setSiteSearch(e.target.value)} 
                      />
                    </div>
                    <ScrollArea className="h-[200px]">
                      <div className="p-1">
                        {allSites?.filter(s => s.name.toLowerCase().includes(siteSearch.toLowerCase())).map(s => (
                          <Button key={s.id} type="button" variant="ghost" className="w-full justify-start h-10 text-xs font-bold uppercase" onClick={() => { setSiteId(s.id); setSiteName(s.name); setIsSitePopoverOpen(false); }}>
                            {s.name}
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>

          {/* Review Points */}
          <Card className="rounded-sm border-primary/10 shadow-md overflow-hidden">
            <CardHeader className="bg-primary/5 border-b py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" /> Technical Review Points
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {REVIEW_POINTS.map((point) => (
                  <div key={point.id} className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-start hover:bg-muted/[0.01] transition-colors">
                    <Label className="md:col-span-4 text-xs font-black uppercase text-foreground pt-3 tracking-tight">{point.label}</Label>
                    <div className="md:col-span-8">
                      <Textarea 
                        placeholder="Status / Observation..." 
                        value={observations[point.id] || ""}
                        onChange={(e) => setObservations({ ...observations, [point.id]: e.target.value })}
                        className="rounded-sm bg-muted/10 border-primary/5 min-h-[60px] text-xs font-medium"
                      />
                    </div>
                  </div>
                ))}

                {/* Custom Points */}
                {customPoints.map((point) => (
                  <div key={point.id} className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-start bg-primary/[0.01] animate-in slide-in-from-top-2">
                    <div className="md:col-span-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input 
                          placeholder="Point Label..." 
                          value={point.label}
                          onChange={(e) => updateCustomPoint(point.id, 'label', e.target.value)}
                          className="h-8 text-[10px] font-black uppercase tracking-widest border-primary/20 rounded-sm"
                        />
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={() => removeCustomPoint(point.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="md:col-span-8">
                      <Textarea 
                        placeholder="Details..." 
                        value={point.value}
                        onChange={(e) => updateCustomPoint(point.id, 'value', e.target.value)}
                        className="rounded-sm bg-background border-primary/10 min-h-[60px] text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-6 bg-muted/5 border-t">
                <Button variant="outline" onClick={addCustomPoint} className="w-full border-dashed rounded-sm font-bold text-primary border-primary/30 h-11">
                  <Plus className="h-4 w-4 mr-2" /> Add Custom Review Point
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Critical Points */}
          <Card className="rounded-sm border-primary/10 shadow-md">
            <CardHeader className="bg-red-500/5 border-b py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-red-700 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" /> Critical Points Observed
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <Textarea 
                placeholder="List major concerns, blockers or high-priority findings..." 
                rows={6}
                value={criticalPoints}
                onChange={e => setCriticalPoints(e.target.value)}
                className="rounded-sm border-red-500/10 focus-visible:ring-red-500/20 text-sm font-medium"
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Recorder Sidebox */}
          <Card className="rounded-sm border-primary/10 shadow-lg overflow-hidden sticky top-24">
            <CardHeader className="bg-slate-900 border-b p-6 text-white">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] opacity-80">Voice Memo</CardTitle>
                {isRecording && <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse ring-4 ring-red-500/20" />}
              </div>
            </CardHeader>
            <CardContent className="p-8 flex flex-col items-center gap-8 bg-slate-900 text-white">
              <div className="text-center space-y-2">
                <p className="text-4xl font-black font-mono tracking-tighter tabular-nums">
                  {formatDuration(recordingTime)}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">
                  {isRecording ? "Auditing Discussions" : "Ready to Record"}
                </p>
              </div>

              <div className="relative">
                {isRecording ? (
                  <Button 
                    onClick={stopRecording} 
                    className="h-24 w-24 rounded-full bg-red-600 hover:bg-red-700 border-[8px] border-white/10 shadow-2xl transition-all active:scale-90"
                  >
                    <Square className="h-8 w-8 fill-current" />
                  </Button>
                ) : (
                  <Button 
                    onClick={startRecording} 
                    className="h-24 w-24 rounded-full bg-primary hover:bg-primary/90 border-[8px] border-white/10 shadow-2xl transition-all active:scale-90"
                  >
                    <Mic className="h-10 w-10" />
                  </Button>
                )}
                {isRecording && (
                  <motion.div 
                    animate={{ scale: [1, 1.4, 1] }} 
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="absolute -inset-4 bg-red-500/10 rounded-full -z-10" 
                  />
                )}
              </div>

              {audioUrl && !isRecording && (
                <div className="w-full space-y-4 animate-in fade-in duration-500">
                  <Separator className="bg-white/10" />
                  <div className="flex flex-col gap-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-center opacity-40">Recorded Segment</p>
                    <div className="flex items-center gap-3 bg-white/5 p-3 rounded-sm border border-white/10">
                      <Volume2 className="h-4 w-4 text-primary shrink-0" />
                      <audio src={audioUrl} controls className="h-8 flex-1" />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-red-500" onClick={() => { setAudioBlob(null); setAudioUrl(null); setRecordingTime(0); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="p-6 bg-black flex flex-col gap-3">
               <div className="flex items-center gap-3 w-full">
                  <Button variant="ghost" onClick={() => router.back()} className="flex-1 rounded-sm text-white/40 font-bold uppercase text-[10px] tracking-widest hover:text-white hover:bg-white/5">Cancel</Button>
                  <Button 
                    onClick={handleSaveMeeting} 
                    disabled={isSubmitting || !siteId}
                    className="flex-[2] rounded-sm font-black uppercase text-[10px] tracking-widest h-12 shadow-xl"
                  >
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Meeting
                  </Button>
               </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
