'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, useFirebaseApp, setDocumentNonBlocking } from '@/firebase';
import { doc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  PlugZap, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Plus, 
  X, 
  Upload, 
  FileText, 
  Download, 
  Trash2, 
  Loader2, 
  Save, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Building2,
  Settings2,
  CircleCheck,
  CircleDashed,
  LayoutGrid,
  FileCheck,
  History,
  Check
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

type LiaisoningDocument = {
  url: string;
  name: string;
  storagePath: string;
  uploadedAt: string;
};

type StageData = {
  status: 'Pending' | 'In Progress' | 'Completed';
  remarks: string;
  documents: LiaisoningDocument[];
  subStages?: Record<string, boolean>;
  progressFlags?: string[];
};

type LiaisoningRecord = {
  id: string;
  siteId: string;
  siteName: string;
  status: 'In Progress' | 'Completed';
  completionPercentage: number;
  stages: Record<string, StageData>;
};

const MAIN_STAGES = [
  { id: 'grid_connectivity', label: '1. Grid Connectivity' },
  { 
    id: 'estimate_approval', 
    label: '2. Estimate – Approval Stages', 
    subStages: [
      { id: 'ae_je', label: 'Approved from AE/JE' },
      { id: 'dyee', label: 'Approved from DYEE' },
      { id: 'ee', label: 'Approved from Executive Engineer' },
      { id: 'circle_office', label: 'Approved from Circle Office' }
    ] 
  },
  { id: 'estimate_sanction', label: '3. Estimate Sanction' },
  { id: 'supervision_testing', label: '4. Supervision & Testing Charges' },
  { id: 'material_inspection', label: '5. Material Inspection' },
  { 
    id: 'work_progress', 
    label: '6. Work Progress',
    flags: [
      { id: 'started', label: 'Started' },
      { id: 'not_started', label: 'Not Started Yet' },
      { id: 'row', label: 'ROW' }
    ]
  },
  { id: 'wcr', label: '7. Work Completion Report (WCR)' },
  { id: 'pre_commissioning', label: '8. Pre-Commissioning' },
  { 
    id: 'format_ii_approval', 
    label: '9. Format II – Approval Stages',
    subStages: [
      { id: 'eet', label: 'EE Testing (EET)' },
      { id: 'om', label: 'Senior Engineer (O&M)' },
      { id: 'setqa', label: 'SETQA Approved' }
    ]
  },
  { id: 'ptc', label: '10. Permission to Commission (PTC)' },
  { id: 'clearance', label: '11. Clearance Certificate / Release Order' },
  { id: 'commissioning', label: '12. Commissioning' }
];

export default function ManageLiaisoningPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = React.use(params);
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [activeStageId, setActiveStageId] = React.useState<string>('grid_connectivity');
  const [uploadingStageId, setUploadingStageId] = React.useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = React.useState(0);

  const siteRef = useMemoFirebase(() => doc(firestore, 'sites', siteId), [firestore, siteId]);
  const { data: site, isLoading: siteLoading } = useDoc<any>(siteRef);

  const recordRef = useMemoFirebase(() => doc(firestore, 'liaisoning_records', siteId), [firestore, siteId]);
  const { data: record, isLoading: recordLoading } = useDoc<LiaisoningRecord>(recordRef);

  const calculateCompletion = (stages: Record<string, StageData>) => {
    const total = MAIN_STAGES.length;
    const completed = Object.values(stages).filter(s => s.status === 'Completed').length;
    return Math.round((completed / total) * 100);
  };

  const handleInitialize = async () => {
    if (!site) return;
    const initialStages: Record<string, StageData> = {};
    MAIN_STAGES.forEach(s => {
      initialStages[s.id] = {
        status: 'Pending',
        remarks: "",
        documents: [],
        subStages: s.subStages ? s.subStages.reduce((acc: any, ss) => ({ ...acc, [ss.id]: false }), {}) : undefined,
        progressFlags: s.flags ? [] : undefined
      };
    });

    await setDocumentNonBlocking(recordRef, {
      id: siteId,
      siteId,
      siteName: site.name,
      status: 'In Progress',
      completionPercentage: 0,
      stages: initialStages,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid
    }, { merge: true });
  };

  const handleUpdateStage = async (stageId: string, updates: Partial<StageData>) => {
    if (!record) return;
    const updatedStages = { ...record.stages };
    updatedStages[stageId] = { ...updatedStages[stageId], ...updates };
    
    const completion = calculateCompletion(updatedStages);
    
    updateDocumentNonBlocking(recordRef, {
      stages: updatedStages,
      completionPercentage: completion,
      status: completion === 100 ? 'Completed' : 'In Progress',
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid
    });
  };

  const handleUploadDoc = async (stageId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !record) return;

    setUploadingStageId(stageId);
    setUploadProgress(0);

    try {
      const storage = getStorage(firebaseApp);
      const timestamp = Date.now();
      const storagePath = `liaisoning/${siteId}/${stageId}/${timestamp}_${file.name.replace(/\s+/g, '_')}`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        (err) => { toast({ variant: 'destructive', title: 'Upload Failed', description: err.message }); setUploadingStageId(null); },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          const newDoc: LiaisoningDocument = {
            url,
            name: file.name,
            storagePath,
            uploadedAt: new Date().toISOString()
          };

          const updatedStages = { ...record.stages };
          updatedStages[stageId].documents = [...(updatedStages[stageId].documents || []), newDoc];
          
          updateDocumentNonBlocking(recordRef, {
            stages: updatedStages,
            updatedAt: serverTimestamp()
          });

          toast({ title: 'Document Uploaded' });
          setUploadingStageId(null);
          setUploadProgress(0);
        }
      );
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
      setUploadingStageId(null);
    }
  };

  const handleDeleteDoc = async (stageId: string, docToDelete: LiaisoningDocument) => {
    if (!record) return;
    try {
      const storage = getStorage(firebaseApp);
      await deleteObject(ref(storage, docToDelete.storagePath)).catch(e => console.warn("Storage removal ignored", e));
      
      const updatedStages = { ...record.stages };
      updatedStages[stageId].documents = updatedStages[stageId].documents.filter(d => d.url !== docToDelete.url);
      
      updateDocumentNonBlocking(recordRef, {
        stages: updatedStages,
        updatedAt: serverTimestamp()
      });
      toast({ title: 'Document Removed' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
    }
  };

  if (siteLoading || recordLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-[600px] w-full" /></div>;

  if (!record) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-center space-y-6">
        <PlugZap className="h-16 w-16 text-primary/20" />
        <div className="space-y-1">
          <h2 className="text-xl font-bold uppercase tracking-tight">No Liaisoning Profile</h2>
          <p className="text-muted-foreground text-sm max-w-xs">Progress tracking hasn't been initialized for {site?.name}.</p>
        </div>
        <Button onClick={handleInitialize} className="rounded-sm font-black h-12 px-10 shadow-lg">Initialize site tracker</Button>
      </div>
    );
  }

  const currentStage = MAIN_STAGES.find(s => s.id === activeStageId);
  const activeStageData = record.stages[activeStageId];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.push('/liaisoning/list')} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Liaisoning Hub
        </Button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
           <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-sm shrink-0"><Building2 className="h-8 w-8 text-primary" /></div>
              <div className="min-w-0">
                <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight truncate leading-none">{site?.name}</h1>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1 opacity-60">Liaisoning Progress Lifecycle</p>
              </div>
           </div>
           <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                 <span>Overall Completion</span>
                 <span className="text-primary text-sm">{record.completionPercentage}%</span>
              </div>
              <Progress value={record.completionPercentage} className="h-1.5 w-64 rounded-none" />
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Stages Sidebar */}
        <Card className="lg:col-span-4 rounded-sm border-primary/10 shadow-md h-fit overflow-hidden">
          <CardHeader className="bg-muted/5 border-b py-4">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-primary" /> Approval Milestones
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[65vh]">
              <div className="divide-y">
                {MAIN_STAGES.map((s, idx) => {
                  const stageData = record.stages[s.id];
                  const isDone = stageData.status === 'Completed';
                  const isActive = activeStageId === s.id;
                  
                  return (
                    <button 
                      key={s.id} 
                      onClick={() => setActiveStageId(s.id)}
                      className={cn(
                        "w-full flex items-start gap-4 p-4 text-left transition-all group",
                        isActive ? "bg-primary/5 ring-1 ring-inset ring-primary/10" : "hover:bg-muted/5"
                      )}
                    >
                      <div className={cn(
                        "h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-2 mt-0.5",
                        isDone ? "bg-green-500 border-green-500 text-white" : 
                        isActive ? "border-primary text-primary bg-primary/10 animate-pulse" : "border-muted text-muted-foreground"
                      )}>
                        {isDone ? <Check className="h-3.5 w-3.5" /> : <span className="text-[10px] font-black">{idx + 1}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={cn("text-xs font-bold uppercase tracking-tight block truncate", isActive ? "text-primary" : "text-foreground")}>{s.label}</span>
                        <div className="flex items-center gap-2 mt-1">
                           <Badge variant="outline" className={cn(
                             "h-3.5 text-[7px] font-black uppercase px-1 border-none",
                             isDone ? "bg-green-50 text-green-700" : stageData.status === 'In Progress' ? "bg-blue-50 text-blue-700" : "bg-muted text-muted-foreground/50"
                           )}>{stageData.status}</Badge>
                           {stageData.documents?.length > 0 && <span className="text-[7px] font-bold text-primary flex items-center gap-0.5"><FileCheck className="h-2 w-2" /> {stageData.documents.length} Docs</span>}
                        </div>
                      </div>
                      <ChevronRight className={cn("h-4 w-4 mt-2 shrink-0 transition-all", isActive ? "text-primary opacity-100 translate-x-1" : "opacity-0 -translate-x-2 group-hover:opacity-30 group-hover:translate-x-0")} />
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Stage Content */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="rounded-sm border-primary/10 shadow-lg overflow-hidden h-full flex flex-col">
            <CardHeader className="bg-primary/5 border-b p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <CardTitle className="text-xl sm:text-2xl font-black uppercase tracking-tight text-foreground">{currentStage?.label}</CardTitle>
                <CardDescription className="text-xs font-bold text-muted-foreground uppercase">Milestone Management & Audit Documentation</CardDescription>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Update Milestone State</Label>
                <Select value={activeStageData.status} onValueChange={(val: any) => handleUpdateStage(activeStageId, { status: val })}>
                  <SelectTrigger className="h-10 w-[180px] rounded-sm font-black uppercase text-[10px] tracking-widest bg-background border-primary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending" className="text-[10px] font-bold uppercase">Pending</SelectItem>
                    <SelectItem value="In Progress" className="text-[10px] font-bold uppercase text-blue-600">In Progress</SelectItem>
                    <SelectItem value="Completed" className="text-[10px] font-bold uppercase text-green-600">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-6 sm:p-8 flex-1 space-y-10">
              {/* Nested Approvals for specific stages */}
              {currentStage?.subStages && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><FileCheck className="h-4 w-4" /> Hierarchical Approval Status</Label>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     {currentStage.subStages.map(sub => (
                       <div key={sub.id} className={cn(
                         "flex items-center space-x-3 p-4 rounded-sm border transition-all cursor-pointer group",
                         activeStageData.subStages?.[sub.id] ? "bg-green-50 border-green-200" : "bg-muted/5 border-border/50 hover:bg-muted/10"
                       )} onClick={() => {
                         const next = { ...(activeStageData.subStages || {}) };
                         next[sub.id] = !next[sub.id];
                         handleUpdateStage(activeStageId, { subStages: next });
                       }}>
                         <div className={cn(
                           "h-5 w-5 rounded-sm border-2 flex items-center justify-center transition-all",
                           activeStageData.subStages?.[sub.id] ? "bg-green-600 border-green-600 text-white" : "bg-white border-muted-foreground/30"
                         )}>
                            {activeStageData.subStages?.[sub.id] && <Check className="h-3.5 w-3.5" />}
                         </div>
                         <span className="text-[11px] font-bold uppercase text-foreground/80">{sub.label}</span>
                       </div>
                     ))}
                   </div>
                </div>
              )}

              {/* Work Progress Flags */}
              {currentStage?.flags && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Progress Indicators</Label>
                   <div className="flex flex-wrap gap-3">
                     {currentStage.flags.map(flag => {
                       const isSelected = activeStageData.progressFlags?.includes(flag.id);
                       return (
                         <Badge 
                           key={flag.id} 
                           variant="outline" 
                           onClick={() => {
                             const current = activeStageData.progressFlags || [];
                             const next = current.includes(flag.id) ? current.filter(id => id !== flag.id) : [...current, flag.id];
                             handleUpdateStage(activeStageId, { progressFlags: next });
                           }}
                           className={cn(
                             "h-9 px-4 rounded-sm font-black uppercase text-[10px] tracking-widest cursor-pointer transition-all",
                             isSelected ? "bg-primary text-white border-primary shadow-md scale-105" : "bg-background text-muted-foreground hover:bg-primary/5 border-border"
                           )}
                         >
                           {flag.label}
                         </Badge>
                       );
                     })}
                   </div>
                </div>
              )}

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Stage Observations & Audit Remarks</Label>
                <Textarea 
                  placeholder="Record specific findings, meeting outcomes or blockers for this stage..."
                  className="min-h-[120px] rounded-sm text-sm italic font-medium leading-relaxed bg-muted/[0.02]"
                  value={activeStageData.remarks}
                  onChange={e => handleUpdateStage(activeStageId, { remarks: e.target.value })}
                />
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between border-b pb-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Upload className="h-4 w-4" /> Compliance Documentation</Label>
                   <label className="cursor-pointer">
                      <Button variant="outline" size="sm" asChild className="h-8 rounded-sm font-black text-[10px] uppercase border-primary/20 text-primary">
                        <span><Plus className="h-3.5 w-3.5 mr-1" /> Add File</span>
                      </Button>
                      <input type="file" className="hidden" onChange={e => handleUploadDoc(activeStageId, e)} />
                   </label>
                </div>

                {uploadingStageId === activeStageId && (
                  <div className="p-4 border rounded-sm bg-primary/5 space-y-2 animate-in fade-in duration-300">
                     <div className="flex justify-between items-center text-[10px] font-black uppercase text-primary">
                        <span>Transferring Artifact...</span>
                        <span>{Math.round(uploadProgress)}%</span>
                     </div>
                     <Progress value={uploadProgress} className="h-1 rounded-none" />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeStageData.documents?.length > 0 ? activeStageData.documents.map((doc, dIdx) => (
                    <div key={dIdx} className="group p-4 border rounded-sm bg-background hover:border-primary/30 transition-all flex items-center justify-between shadow-sm">
                       <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 bg-muted rounded-sm text-primary group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                             <FileText className="h-5 w-5" />
                          </div>
                          <div className="flex flex-col min-w-0">
                             <span className="text-xs font-black truncate max-w-[150px] uppercase tracking-tight" title={doc.name}>{doc.name}</span>
                             <span className="text-[8px] font-bold text-muted-foreground/60">{format(new Date(doc.uploadedAt), 'dd MMM yyyy')}</span>
                          </div>
                       </div>
                       <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" asChild title="Open">
                             <a href={doc.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm hover:bg-red-50" onClick={() => handleDeleteDoc(activeStageId, doc)} title="Delete">
                             <Trash2 className="h-4 w-4" />
                          </Button>
                       </div>
                    </div>
                  )) : (
                    <div className="col-span-full py-16 text-center border-2 border-dashed rounded-sm opacity-20 bg-muted/5 flex flex-col items-center justify-center gap-3">
                       <ShieldCheck className="h-10 w-10" />
                       <p className="text-[10px] font-black uppercase tracking-widest">No documentation attached</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/5 border-t p-6 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                   <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                   <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Stage {activeStageId.replace(/_/g, ' ')} Active</span>
                </div>
                <Button variant="ghost" size="sm" className="h-8 rounded-sm font-bold text-muted-foreground uppercase text-[10px]" onClick={() => {
                   const curIdx = MAIN_STAGES.findIndex(s => s.id === activeStageId);
                   if (curIdx < MAIN_STAGES.length - 1) setActiveStageId(MAIN_STAGES[curIdx + 1].id);
                }}>
                   Skip to Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
