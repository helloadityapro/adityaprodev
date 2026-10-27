
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { 
  useFirestore, 
  useUser, 
  useDoc, 
  useMemoFirebase, 
  updateDocumentNonBlocking, 
  useFirebaseApp, 
  setDocumentNonBlocking,
  useCollection
} from '@/firebase';
import { doc, serverTimestamp, collection, query, where, getDocs, updateDoc, ref as firestoreRef } from 'firebase/firestore';
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
  Plus, 
  X, 
  Upload, 
  FileText, 
  Trash2, 
  Loader2, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Building2,
  LayoutGrid,
  FileCheck,
  Check,
  LockKeyhole,
  HardHat,
  ChevronDown,
  Search
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { isSuperAdmin } from '@/lib/auth-constants';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

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
  contractorId?: string;
  contractorName?: string;
};

const MAIN_STAGES = [
  { id: 'loa', label: '1. LOA' },
  { id: 'ppa', label: '2. PPA' },
  { id: 'spv_docs', label: '3. SPV or Company Documents' },
  { id: 'land_acquisition', label: '4. Land Acquisition' },
  { id: 'grid_connectivity', label: '5. Grid Connectivity' },
  { 
    id: 'estimate_approval', 
    label: '6. Estimate – Approval Stages', 
    subStages: [
      { id: 'ae_je', label: 'Approved from AE/JE' },
      { id: 'dyee', label: 'Approved from DYEE' },
      { id: 'ee', label: 'Approved from Executive Engineer' },
      { id: 'circle_office', label: 'Approved from Circle Office' }
    ] 
  },
  { id: 'estimate_sanction', label: '7. Estimate Sanction' },
  { id: 'supervision_testing', label: '8. Supervision & Testing Charges' },
  { id: 'material_inspection', label: '9. Material Inspection' },
  { 
    id: 'work_progress', 
    label: '10. Work Progress',
    flags: [
      { id: 'started', label: 'Started' },
      { id: 'not_started', label: 'Not Started Yet' },
      { id: 'row', label: 'ROW' }
    ]
  },
  { id: 'wcr', label: '11. Work Completion Report (WCR)' },
  { id: 'pre_commissioning', label: '12. Pre-Commissioning' },
  { 
    id: 'format_ii_approval', 
    label: '13. Format II – Approval Stages',
    subStages: [
      { id: 'eet', label: 'EE Testing (EET)' },
      { id: 'om', label: 'Superintending Engineer (O&M)' },
      { id: 'setqa', label: 'SE TQA Approved' }
    ]
  },
  { id: 'ptc', label: '14. Permission to Commission (PTC)' },
  { id: 'clearance', label: '15. Clearance Certificate / Release Order' },
  { id: 'commissioning', label: '16. Commissioning' },
  { id: 'commissioning_certificate', label: '17. Commissioning Certificate upload from SE(O&M) to Single Window Portal' }
];

export default function ManageLiaisoningPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = React.use(params);
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [activeStageId, setActiveStageId] = React.useState<string>('loa');
  const [uploadingStageId, setUploadingStageId] = React.useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  
  const [isContractorPopoverOpen, setIsContractorPopoverOpen] = React.useState(false);
  const [contractorSearch, setContractorSearch] = React.useState("");

  const siteRef = useMemoFirebase(() => doc(firestore, 'sites', siteId), [firestore, siteId]);
  const { data: site, isLoading: siteLoading } = useDoc<any>(siteRef);

  const recordRef = useMemoFirebase(() => doc(firestore, 'liaisoning_records', siteId), [firestore, siteId]);
  const { data: record, isLoading: recordLoading } = useDoc<LiaisoningRecord>(recordRef);

  const contractorsQuery = useMemoFirebase(() => collection(firestore, 'contractors'), [firestore]);
  const { data: allContractors } = useCollection<any>(contractorsQuery);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const calculateCompletion = (stages: Record<string, StageData>) => {
    const total = MAIN_STAGES.length;
    const completed = Object.values(stages).filter(s => s.status === 'Completed').length;
    return Math.round((completed / total) * 100);
  };

  const handleInitialize = async () => {
    if (!site) return;
    const initialStages: Record<string, StageData> = {};
    MAIN_STAGES.forEach(s => {
      const stageObj: any = {
        status: 'Pending',
        remarks: "",
        documents: [],
      };

      if (s.subStages) {
        stageObj.subStages = s.subStages.reduce((acc: any, ss) => ({ ...acc, [ss.id]: false }), {});
      }

      if (s.flags) {
        stageObj.progressFlags = [];
      }

      initialStages[s.id] = stageObj;
    });

    setDocumentNonBlocking(recordRef, {
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

  const handleAssignContractor = async (contractor: any) => {
    if (!record) return;
    try {
      await updateDocumentNonBlocking(recordRef, {
        contractorId: contractor.id,
        contractorName: contractor.name,
        updatedAt: serverTimestamp()
      });
      toast({ title: 'Contractor Assigned', description: `${contractor.name} linked to this site tracker.` });
      setIsContractorPopoverOpen(false);
      setContractorSearch("");
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Assignment Failed', description: e.message });
    }
  };

  const handleToggleSubStage = (stageId: string, subId: string) => {
    if (!record) return;
    const stageDef = MAIN_STAGES.find(s => s.id === stageId);
    if (!stageDef?.subStages) return;

    const currentSubStages = record.stages[stageId]?.subStages || {};
    const subIdx = stageDef.subStages.findIndex(ss => ss.id === subId);
    const isChecking = !currentSubStages[subId];

    const nextSubStages = { ...currentSubStages };

    if (isChecking) {
      const allPrevChecked = stageDef.subStages.slice(0, subIdx).every(ss => currentSubStages[ss.id]);
      if (!allPrevChecked) {
        toast({ variant: 'destructive', title: 'Sequential Workflow', description: 'Please complete previous approval steps first.' });
        return;
      }
      nextSubStages[subId] = true;
    } else {
      nextSubStages[subId] = false;
      stageDef.subStages.slice(subIdx + 1).forEach(ss => {
        nextSubStages[ss.id] = false;
      });
    }

    let newStatus = record.stages[stageId].status;
    const allChecked = stageDef.subStages.every(ss => nextSubStages[ss.id]);
    
    if (!allChecked && newStatus === 'Completed') {
      newStatus = 'In Progress';
    }

    handleUpdateStage(stageId, { subStages: nextSubStages, status: newStatus });
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
          if (updatedStages[stageId]) {
            updatedStages[stageId].documents = [...(updatedStages[stageId].documents || []), newDoc];
            
            updateDocumentNonBlocking(recordRef, {
              stages: updatedStages,
              updatedAt: serverTimestamp()
            });

            toast({ title: 'Document Uploaded' });
          }
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
      await deleteObject(ref(storage, docToDelete.storagePath)).catch(e => console.warn("Storage removal failed", e));
      
      const updatedStages = { ...record.stages };
      if (updatedStages[stageId]) {
        updatedStages[stageId].documents = (updatedStages[stageId].documents || []).filter(d => d.url !== docToDelete.url);
        
        updateDocumentNonBlocking(recordRef, {
          stages: updatedStages,
          updatedAt: serverTimestamp()
        });
        toast({ title: 'Document Removed' });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
    }
  };

  if (siteLoading || recordLoading) return <div className="p-4 sm:p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-[500px] w-full" /></div>;

  if (!record) {
    return (
      <div className="flex flex-col items-center justify-center py-24 sm:py-40 text-center space-y-6 px-4">
        <PlugZap className="h-16 w-16 text-primary/20" />
        <div className="space-y-1">
          <h2 className="text-xl font-bold uppercase tracking-tight">No Liaisoning Profile</h2>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">Progress tracking hasn't been initialized for {site?.name}.</p>
        </div>
        <Button onClick={handleInitialize} className="rounded-sm font-black h-12 px-10 shadow-lg w-full sm:w-auto">Initialize site tracker</Button>
      </div>
    );
  }

  const currentStage = MAIN_STAGES.find(s => s.id === activeStageId);
  const activeStageData = record.stages?.[activeStageId] || { status: 'Pending', remarks: '', documents: [] };

  const isSubStageLocked = (idx: number) => {
    if (idx === 0) return false;
    const prevSubId = currentStage?.subStages?.[idx - 1]?.id;
    return !activeStageData.subStages?.[prevSubId || ''];
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-20 px-1 sm:px-0">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.push('/liaisoning/list')} className="w-fit mb-1 -ml-2 text-muted-foreground hover:text-primary transition-colors h-8">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Liaisoning Hub
        </Button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
           <div className="flex items-center gap-3 sm:gap-4">
              <div className="bg-primary/10 p-2.5 sm:p-3 rounded-sm shrink-0"><Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-primary" /></div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight truncate leading-none">{site?.name}</h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                  <p className="text-[8px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">{site?.projectCompany}</p>
                  
                  <Separator orientation="vertical" className="h-3 hidden sm:block" />
                  
                  {/* Contractor Assignment UI */}
                  <Popover open={isContractorPopoverOpen} onOpenChange={setIsContractorPopoverOpen}>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1.5 text-[8px] sm:text-[10px] font-black uppercase text-primary hover:opacity-80 transition-opacity">
                        <HardHat className="h-3 w-3" />
                        {record.contractorName || "Assign Contractor"}
                        <ChevronDown className="h-2.5 w-2.5 opacity-40" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <div className="bg-primary/5 p-3 border-b">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Select Site Contractor</h3>
                      </div>
                      <div className="flex items-center border-b px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Input 
                          placeholder="Search registry..." 
                          className="h-10 border-none focus-visible:ring-0 text-xs" 
                          value={contractorSearch} 
                          onChange={e => setContractorSearch(e.target.value)} 
                        />
                      </div>
                      <ScrollArea className="h-[200px]">
                        <div className="p-1">
                          {allContractors?.filter((c: any) => c.name.toLowerCase().includes(contractorSearch.toLowerCase())).map((c: any) => (
                            <Button 
                              key={c.id} 
                              variant="ghost" 
                              className="w-full justify-start h-auto py-2.5 px-3 mb-0.5 text-xs text-left"
                              onClick={() => handleAssignContractor(c)}
                            >
                              <div className="flex flex-col items-start min-w-0">
                                <span className="font-bold truncate w-full uppercase tracking-tight">{c.name}</span>
                                <span className="text-[9px] text-muted-foreground uppercase opacity-60">{c.role}</span>
                              </div>
                            </Button>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
           </div>
           <div className="flex flex-col items-start sm:items-end gap-2 w-full md:w-auto">
              <div className="flex items-center justify-between sm:justify-end gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-full sm:w-auto">
                 <span>Global Completion</span>
                 <span className="text-primary text-sm font-black">{record.completionPercentage}%</span>
              </div>
              <Progress value={record.completionPercentage} className="h-2 md:h-1.5 w-full md:w-64 rounded-none" />
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Stages Sidebar */}
        <Card className="lg:col-span-4 rounded-sm border-primary/10 shadow-md h-fit overflow-hidden">
          <CardHeader className="bg-muted/5 border-b py-3 sm:py-4">
            <CardTitle className="text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
              <LayoutGrid className="h-3.5 w-3.5 text-primary" /> Approval Milestones
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[30vh] sm:h-[40vh] lg:h-[70vh]">
              <div className="divide-y">
                {MAIN_STAGES.map((s, idx) => {
                  const stageData = record.stages?.[s.id] || { status: 'Pending', documents: [] };
                  const isDone = stageData.status === 'Completed';
                  const isActive = activeStageId === s.id;
                  
                  return (
                    <button 
                      key={s.id} 
                      onClick={() => setActiveStageId(s.id)}
                      className={cn(
                        "w-full flex items-start gap-3 sm:gap-4 p-3 sm:p-4 text-left transition-all group",
                        isActive ? "bg-primary/5 ring-1 ring-inset ring-primary/10" : "hover:bg-muted/5"
                      )}
                    >
                      <div className={cn(
                        "h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-2 mt-0.5 transition-colors",
                        isDone ? "bg-green-500 border-green-500 text-white" : 
                        isActive ? "border-primary text-primary bg-primary/10 animate-pulse" : "border-muted text-muted-foreground"
                      )}>
                        {isDone ? <Check className="h-3.5 w-3.5" /> : <span className="text-[10px] font-black">{idx + 1}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={cn("text-[11px] sm:text-xs font-bold uppercase tracking-tight block truncate", isActive ? "text-primary" : "text-foreground")}>{s.label}</span>
                        <div className="flex items-center gap-2 mt-1">
                           <Badge variant="outline" className={cn(
                             "h-4 text-[7px] sm:text-[8px] font-black uppercase px-1.5 border-none rounded-sm",
                             isDone ? "bg-green-50 text-green-700" : stageData.status === 'In Progress' ? "bg-blue-50 text-blue-700" : "bg-muted text-muted-foreground/50"
                           )}>{stageData.status}</Badge>
                           {stageData.documents?.length > 0 && <span className="text-[8px] font-bold text-primary flex items-center gap-0.5"><FileCheck className="h-2.5 w-2.5" /> {stageData.documents.length}</span>}
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
            <CardHeader className="bg-primary/5 border-b p-5 sm:p-6 lg:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <CardTitle className="text-lg sm:text-xl md:text-2xl font-black uppercase tracking-tight text-foreground">{currentStage?.label}</CardTitle>
                <CardDescription className="text-[10px] font-bold text-muted-foreground uppercase">Milestone Audit & compliance Records</CardDescription>
              </div>
              <div className="flex flex-col items-start md:items-end gap-2 w-full md:w-auto">
                <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest px-1">Stage Status</Label>
                <Select 
                  value={activeStageData.status} 
                  onValueChange={(val: any) => {
                    if (val === 'Completed' && currentStage?.subStages) {
                      const allDone = currentStage.subStages.every(ss => activeStageData.subStages?.[ss.id]);
                      if (!allDone) {
                        toast({ 
                          variant: 'destructive', 
                          title: 'Milestone Incomplete', 
                          description: 'All hierarchical sub-stages must be completed before marking this milestone as finished.' 
                        });
                        return;
                      }
                    }
                    handleUpdateStage(activeStageId, { status: val });
                  }}
                >
                  <SelectTrigger className="h-11 md:h-10 w-full md:w-[180px] rounded-sm font-black uppercase text-[10px] tracking-widest bg-background border-primary/20 shadow-sm">
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
            <CardContent className="p-5 sm:p-6 lg:p-8 flex-1 space-y-10">
              {/* Nested Approvals for specific stages */}
              {currentStage?.subStages && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><FileCheck className="h-4 w-4" /> Sequential Approval Workflow</Label>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     {currentStage.subStages.map((sub, idx) => {
                       const isLocked = isSubStageLocked(idx);
                       const isChecked = !!activeStageData.subStages?.[sub.id];

                       return (
                         <div 
                           key={sub.id} 
                           className={cn(
                             "flex items-center space-x-3 p-4 rounded-sm border transition-all group",
                             isLocked ? "opacity-40 bg-muted/20 cursor-not-allowed border-dashed" : "cursor-pointer active:scale-[0.98]",
                             isChecked ? "bg-green-50 border-green-200" : (isLocked ? "" : "bg-muted/5 border-border/50 hover:bg-muted/10")
                           )} 
                           onClick={() => {
                             if (!isLocked) handleToggleSubStage(activeStageId, sub.id);
                           }}
                         >
                           <div className={cn(
                             "h-6 w-6 rounded-sm border-2 flex items-center justify-center transition-all shrink-0",
                             isChecked ? "bg-green-600 border-green-600 text-white shadow-sm" : 
                             isLocked ? "bg-muted/20 border-muted-foreground/10" : "bg-white border-muted-foreground/30"
                           )}>
                              {isChecked ? <Check className="h-4 w-4" /> : isLocked ? <LockKeyhole className="h-3 w-3 text-muted-foreground/30" /> : null}
                           </div>
                           <div className="flex flex-col min-w-0">
                              <span className={cn("text-[12px] font-bold uppercase tracking-tight leading-tight", isChecked ? "text-green-800" : "text-foreground/80")}>
                                {sub.label}
                              </span>
                              {isLocked && <span className="text-[8px] font-black uppercase text-muted-foreground/40 mt-1">Awaiting previous stage</span>}
                           </div>
                         </div>
                       );
                     })}
                   </div>
                </div>
              )}

              {/* Work Progress Flags */}
              {currentStage?.flags && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Progress Indicators</Label>
                   <div className="flex flex-wrap gap-2.5 sm:gap-3">
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
                             "h-10 px-5 rounded-sm font-black uppercase text-[10px] tracking-widest cursor-pointer transition-all active:scale-95",
                             isSelected ? "bg-primary text-white border-primary shadow-lg scale-105" : "bg-background text-muted-foreground hover:bg-primary/5 border-border"
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
                  className="min-h-[140px] rounded-sm text-sm italic font-medium leading-relaxed bg-muted/[0.02] shadow-inner"
                  value={activeStageData.remarks}
                  onChange={e => handleUpdateStage(activeStageId, { remarks: e.target.value })}
                />
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between border-b pb-2 px-1">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Upload className="h-4 w-4" /> Compliance Documentation</Label>
                   <label className="cursor-pointer">
                      <Button variant="outline" size="sm" asChild className="h-9 rounded-sm font-black text-[10px] uppercase border-primary/20 text-primary shadow-sm hover:bg-primary/5">
                        <span><Plus className="h-4 w-4 mr-1" /> Add File</span>
                      </Button>
                      <input type="file" className="hidden" onChange={e => handleUploadDoc(activeStageId, e)} />
                   </label>
                </div>

                {uploadingStageId === activeStageId && (
                  <div className="p-4 border rounded-sm bg-primary/5 space-y-2 animate-in fade-in duration-300">
                     <div className="flex justify-between items-center text-[10px] font-black uppercase text-primary">
                        <span>Uploading Please Wait...</span>
                        <span>{Math.round(uploadProgress)}%</span>
                     </div>
                     <Progress value={uploadProgress} className="h-1.5 rounded-none" />
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
                             <span className="text-xs font-black truncate max-w-[150px] uppercase tracking-tight leading-tight" title={doc.name}>{doc.name}</span>
                             <span className="text-[8px] font-bold text-muted-foreground/60 mt-0.5">{format(new Date(doc.uploadedAt), 'dd MMM yyyy')}</span>
                          </div>
                       </div>
                       <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-primary rounded-sm hover:bg-primary/10" asChild title="Open">
                             <a href={doc.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive rounded-sm hover:bg-red-50" onClick={() => handleDeleteDoc(activeStageId, doc)} title="Delete">
                             <Trash2 className="h-4 w-4" />
                          </Button>
                       </div>
                    </div>
                  )) : (
                    <div className="col-span-full py-16 sm:py-24 text-center border-2 border-dashed rounded-sm opacity-20 bg-muted/5 flex flex-col items-center justify-center gap-3">
                       <ShieldCheck className="h-10 w-10 sm:h-12 sm:w-12" />
                       <p className="text-[10px] font-black uppercase tracking-[0.2em]">No documentation attached</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/5 border-t p-5 sm:p-6 lg:p-8 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                   <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                   <span className="text-[9px] sm:text-[10px] font-black uppercase text-muted-foreground tracking-widest">Stage Analysis Active</span>
                </div>
                <Button variant="ghost" size="sm" className="h-9 px-4 rounded-sm font-bold text-muted-foreground hover:text-primary uppercase text-[10px] tracking-tight" onClick={() => {
                   const curIdx = MAIN_STAGES.findIndex(s => s.id === activeStageId);
                   if (curIdx < MAIN_STAGES.length - 1) {
                     setActiveStageId(MAIN_STAGES[curIdx + 1].id);
                     window.scrollTo({ top: 0, behavior: 'smooth' });
                   }
                }}>
                   Next Stage <ChevronRight className="h-4 w-4 ml-1.5" />
                </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
