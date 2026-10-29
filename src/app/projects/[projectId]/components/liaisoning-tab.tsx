'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { 
  PlugZap, 
  LayoutGrid, 
  Building2, 
  HardHat, 
  Search, 
  Check, 
  Plus,
  ChevronsUpDown, 
  ChevronRight, 
  ChevronDown, 
  FileCheck, 
  Upload, 
  Loader2, 
  FileText, 
  ExternalLink, 
  Trash2, 
  ShieldCheck 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, serverTimestamp, collection, updateDoc, deleteDoc } from 'firebase/firestore';
import { useFirestore, useFirebaseApp, updateDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { Project, UserProfile, LiaisoningRecord, StageData, LiaisoningDocument, MAIN_STAGES } from '../types';

interface LiaisoningTabProps {
  projectId: string;
  project: Project;
  liaisonRecord: LiaisoningRecord | null;
  allContractors: any[] | null;
  userProfile: UserProfile | null;
  user: any;
}

export function LiaisoningTab({
  projectId,
  project,
  liaisonRecord,
  allContractors,
  userProfile,
  user
}: LiaisoningTabProps) {
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const [activeStageId, setActiveStageId] = React.useState<string>('loa');
  const [uploadingStageId, setUploadingStageId] = React.useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [isContractorPopoverOpen, setIsContractorPopoverOpen] = React.useState(false);
  const [contractorSearch, setContractorSearch] = React.useState("");

  const recordRef = doc(firestore, 'liaisoning_records', projectId);

  const calculateCompletion = (stages: Record<string, StageData>) => {
    const total = MAIN_STAGES.length;
    const completed = Object.values(stages).filter(s => s.status === 'Completed').length;
    return Math.round((completed / total) * 100);
  };

  const handleInitialize = async () => {
    const initialStages: Record<string, StageData> = {};
    MAIN_STAGES.forEach(s => {
      const stageObj: any = { status: 'Pending', remarks: "", documents: [] };
      if (s.subStages) stageObj.subStages = s.subStages.reduce((acc: any, ss) => ({ ...acc, [ss.id]: false }), {});
      if (s.flags) stageObj.progressFlags = [];
      initialStages[s.id] = stageObj;
    });
    setDocumentNonBlocking(recordRef, {
      id: projectId, siteId: projectId, siteName: project.name,
      status: 'In Progress', completionPercentage: 0, stages: initialStages,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: user?.uid
    }, { merge: true });
  };

  const handleUpdateStage = async (stageId: string, updates: Partial<StageData>) => {
    if (!liaisonRecord) return;
    const updatedStages = { ...liaisonRecord.stages };
    updatedStages[stageId] = { ...updatedStages[stageId], ...updates };
    const completion = calculateCompletion(updatedStages);
    updateDocumentNonBlocking(recordRef, {
      stages: updatedStages, completionPercentage: completion,
      status: completion === 100 ? 'Completed' : 'In Progress',
      updatedAt: serverTimestamp(), updatedBy: user?.uid
    });
  };

  const handleUploadDoc = async (stageId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !liaisonRecord) return;
    setUploadingStageId(stageId);
    setUploadProgress(0);
    try {
      const storage = getStorage(firebaseApp);
      const timestamp = Date.now();
      const storagePath = `liaisoning/${projectId}/${stageId}/${timestamp}_${file.name.replace(/\s+/g, '_')}`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);
      uploadTask.on('state_changed', 
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        null,
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          const newDoc: LiaisoningDocument = { url, name: file.name, storagePath, uploadedAt: new Date().toISOString() };
          const updatedStages = { ...liaisonRecord.stages };
          if (updatedStages[stageId]) {
            updatedStages[stageId].documents = [...(updatedStages[stageId].documents || []), newDoc];
            updateDocumentNonBlocking(recordRef, { stages: updatedStages, updatedAt: serverTimestamp() });
          }
          setUploadingStageId(null);
        }
      );
    } catch (e) { setUploadingStageId(null); }
  };

  const handleDeleteDoc = async (stageId: string, docToDelete: LiaisoningDocument) => {
    if (!liaisonRecord) return;
    try {
      const storage = getStorage(firebaseApp);
      await deleteObject(ref(storage, docToDelete.storagePath));
      const updatedStages = { ...liaisonRecord.stages };
      if (updatedStages[stageId]) {
        updatedStages[stageId].documents = (updatedStages[stageId].documents || []).filter(d => d.url !== docToDelete.url);
        updateDocumentNonBlocking(recordRef, { stages: updatedStages, updatedAt: serverTimestamp() });
      }
    } catch (e) {}
  };

  const handleAssignContractor = async (contractor: any) => {
    if (!liaisonRecord) return;
    updateDocumentNonBlocking(recordRef, { contractorId: contractor.id, contractorName: contractor.name, updatedAt: serverTimestamp() });
    setIsContractorPopoverOpen(false);
  };

  if (!liaisonRecord) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
        <PlugZap className="h-16 w-16 text-primary/20" />
        <div className="space-y-1">
          <h2 className="text-xl font-bold uppercase tracking-tight">No Liaisoning Profile</h2>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">Progress tracking hasn't been initialized for this site.</p>
        </div>
        <Button onClick={handleInitialize} className="rounded-sm font-black h-12 px-10 shadow-lg">Initialize Tracker</Button>
      </div>
    );
  }

  const activeStageData = liaisonRecord.stages[activeStageId] || { status: 'Pending', remarks: '', documents: [] };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 pb-20">
      <Card className="lg:col-span-4 rounded-sm border-primary/10 shadow-md h-fit overflow-hidden text-left">
        <CardHeader className="bg-muted/5 border-b py-4">
          <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
            <LayoutGrid className="h-3.5 w-3.5 text-primary" /> Approval Milestones
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[60vh]">
            <div className="divide-y">
              {MAIN_STAGES.map((s, idx) => {
                const stageData = liaisonRecord.stages?.[s.id] || { status: 'Pending', documents: [] };
                const isDone = stageData.status === 'Completed';
                const isActive = activeStageId === s.id;
                return (
                  <button 
                    key={s.id} 
                    onClick={() => setActiveStageId(s.id)}
                    className={cn("w-full flex items-start gap-4 p-4 text-left transition-all group", isActive ? "bg-primary/5 ring-1 ring-inset ring-primary/10" : "hover:bg-muted/5")}
                  >
                    <div className={cn("h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-2 mt-0.5 transition-colors", isDone ? "bg-green-500 border-green-500 text-white" : isActive ? "border-primary text-primary bg-primary/10 animate-pulse" : "border-muted text-muted-foreground")}>
                      {isDone ? <Check className="h-3.5 w-3.5" /> : <span className="text-[10px] font-black">{idx + 1}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={cn("text-[11px] font-bold uppercase tracking-tight block truncate", isActive ? "text-primary" : "text-foreground")}>{s.label}</span>
                      <Badge variant="outline" className={cn("h-4 text-[7px] font-black uppercase px-1.5 border-none rounded-sm mt-1", isDone ? "bg-green-50 text-green-700" : stageData.status === 'In Progress' ? "bg-blue-50 text-blue-700" : "bg-muted text-muted-foreground/50")}>{stageData.status}</Badge>
                    </div>
                    <ChevronRight className={cn("h-4 w-4 mt-2 shrink-0 transition-all", isActive ? "text-primary opacity-100 translate-x-1" : "opacity-0")} />
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="lg:col-span-8 space-y-6">
        <Card className="rounded-sm border-primary/10 shadow-lg overflow-hidden h-full flex flex-col text-left">
          <CardHeader className="bg-primary/5 border-b p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <CardTitle className="text-xl font-black uppercase tracking-tight text-foreground">{MAIN_STAGES.find(s => s.id === activeStageId)?.label}</CardTitle>
              <CardDescription className="text-[10px] font-bold text-muted-foreground uppercase">Milestone Audit & compliance Records</CardDescription>
            </div>
            <div className="flex flex-col items-start md:items-end gap-2 w-full md:w-auto">
              <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest px-1">Stage Status</Label>
              <Select 
                value={activeStageData.status} 
                onValueChange={(val: any) => handleUpdateStage(activeStageId, { status: val })}
              >
                <SelectTrigger className="h-10 w-full md:w-[180px] rounded-sm font-black uppercase text-[10px] tracking-widest bg-background border-primary/20 shadow-sm">
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
          <CardContent className="p-6 md:p-8 flex-1 space-y-10">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Stage Observations & Audit Remarks</Label>
              <Textarea 
                placeholder="Record specific findings or blockers for this stage..."
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
                {activeStageData.documents?.map((doc, dIdx) => (
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
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
