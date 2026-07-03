'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  useFirestore, 
  useUser, 
  useDoc, 
  useMemoFirebase, 
  updateDocumentNonBlocking, 
  useFirebaseApp 
} from '@/firebase';
import { doc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  Plus, 
  X, 
  Trash2, 
  Camera, 
  ImageIcon, 
  FileImage, 
  ShieldCheck, 
  Check, 
  AlertTriangle,
  Pencil
} from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import imageCompression from 'browser-image-compression';
import { cn } from '@/lib/utils';
import { isSuperAdmin } from '@/lib/auth-constants';
import { Skeleton } from '@/components/ui/skeleton';

const checkItemSchema = z.object({
  label: z.string(),
  status: z.enum(["OK", "NOT OK", "Pending"]),
  remarks: z.string().default(""),
  attachments: z.array(z.object({
    url: z.string(),
    name: z.string(),
    contentType: z.string()
  })).default([]),
  localFiles: z.array(z.any()).default([]),
});

const editSchema = z.object({
  tableNumber: z.string().min(1, "Table Number is required"),
  tableSize: z.string().min(1, "Table Size is required"),
  columnCount: z.coerce.number().min(1),
  moduleCount: z.coerce.number().min(1),
  checks: z.array(checkItemSchema),
  otherRemarks: z.string().optional(),
  otherAttachments: z.array(z.object({
    url: z.string(),
    name: z.string(),
    contentType: z.string()
  })).default([]),
  otherLocalFiles: z.array(z.any()).default([]),
  customerRepName: z.string().optional(),
  customerRepRemarks: z.string().optional(),
});

export default function EditMmsAuditPage({ params }: { params: Promise<{ siteId: string, checklistId: string }> }) {
  const { siteId, checklistId } = React.use(params);
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<Record<string, number>>({});

  const auditRef = useMemoFirebase(() => doc(firestore, 'installation_checklists', checklistId), [firestore, checklistId]);
  const { data: audit, isLoading: auditLoading } = useDoc<any>(auditRef);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);

  const form = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      tableNumber: "",
      tableSize: "",
      columnCount: 0,
      moduleCount: 0,
      checks: [],
      otherRemarks: "",
      otherAttachments: [],
      otherLocalFiles: [],
      customerRepName: "",
      customerRepRemarks: "",
    }
  });

  React.useEffect(() => {
    if (audit) {
      form.reset({
        tableNumber: audit.tableNumber,
        tableSize: audit.tableSize,
        columnCount: audit.columnCount,
        moduleCount: audit.moduleCount,
        checks: audit.checks.map((c: any) => ({
          ...c,
          localFiles: []
        })),
        otherRemarks: audit.otherRemarks || "",
        otherAttachments: audit.otherAttachments || [],
        otherLocalFiles: [],
        customerRepName: audit.customerRepName || "",
        customerRepRemarks: audit.customerRepRemarks || "",
      });
    }
  }, [audit, form]);

  const uploadFile = async (file: File, path: string): Promise<{url: string, contentType: string, name: string}> => {
    let blob: Blob = file;
    if (file.type.startsWith('image/')) {
      try {
        blob = await imageCompression(file, { maxSizeMB: 0.8, maxWidthOrHeight: 1920 });
      } catch (e) { console.warn("Compression skipped", e); }
    }
    const storage = getStorage(firebaseApp);
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, blob);
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed', 
        (snapshot) => setUploadProgress(prev => ({ ...prev, [file.name]: (snapshot.bytesTransferred / snapshot.totalBytes) * 100 })), 
        reject, 
        () => getDownloadURL(uploadTask.snapshot.ref).then(url => resolve({ url, contentType: file.type, name: file.name }))
      );
    });
  };

  const onSubmit = async (values: z.infer<typeof editSchema>) => {
    if (!user || !userProfile || !audit) return;
    setIsSubmitting(true);
    setUploadProgress({});

    try {
      // 1. Snapshot previous values for history
      const previousValues = {
        checks: audit.checks,
        otherRemarks: audit.otherRemarks || "",
        otherAttachments: audit.otherAttachments || [],
        customerRepName: audit.customerRepName || "",
        customerRepRemarks: audit.customerRepRemarks || "",
      };

      const historyEntry = {
        editedBy: userProfile.username || user.email,
        editedById: user.uid,
        timestamp: new Date(),
        previousValues
      };

      // 2. Process all media uploads
      const timestamp = Date.now();
      const updatedChecks = [];

      for (let i = 0; i < values.checks.length; i++) {
        const check = values.checks[i];
        const newAttachments = [...check.attachments];
        
        if (check.localFiles.length > 0) {
          for (let f = 0; f < check.localFiles.length; f++) {
            const file = check.localFiles[f];
            const path = `checklists/mms/${user.uid}/${timestamp}_check_${i}_${f}_${file.name}`;
            const uploaded = await uploadFile(file, path);
            newAttachments.push(uploaded);
          }
        }
        
        updatedChecks.push({
          label: check.label,
          status: check.status,
          remarks: check.remarks,
          attachments: newAttachments
        });
      }

      const updatedOtherAttachments = [...values.otherAttachments];
      if (values.otherLocalFiles.length > 0) {
        for (let f = 0; f < values.otherLocalFiles.length; f++) {
          const file = values.otherLocalFiles[f];
          const path = `checklists/mms/${user.uid}/${timestamp}_other_${f}_${file.name}`;
          const uploaded = await uploadFile(file, path);
          updatedOtherAttachments.push(uploaded);
        }
      }

      // 3. Perform atomic update
      await updateDocumentNonBlocking(auditRef, {
        tableNumber: values.tableNumber,
        tableSize: values.tableSize,
        columnCount: values.columnCount,
        moduleCount: values.moduleCount,
        checks: updatedChecks,
        otherRemarks: values.otherRemarks,
        otherAttachments: updatedOtherAttachments,
        customerRepName: values.customerRepName,
        customerRepRemarks: values.customerRepRemarks,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: userProfile.username || user.email,
        editHistory: arrayUnion(historyEntry)
      });

      toast({ title: "Audit Synchronized", description: `Table ${values.tableNumber} registry record has been updated with a new revision.` });
      router.back();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Sync Failed", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (auditLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full"/><Skeleton className="h-96 w-full"/></div>;
  if (!audit) return <div className="p-12 text-center italic">Audit record not found.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Cancel & Return
        </Button>
        <div className="flex items-center gap-3">
           <div className="bg-primary/10 p-2.5 rounded-sm shrink-0"><Pencil className="h-6 w-6 text-primary" /></div>
           <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">Edit Audit Log</h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{audit.siteName} • Table {audit.tableNumber}</p>
           </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
          <Card className="rounded-sm shadow-md border-primary/10">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest">Table Context</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="tableNumber" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Table Ref</FormLabel><FormControl><Input {...field} className="h-11 rounded-sm font-mono font-bold" /></FormControl><FormMessage/></FormItem>
              )} />
              <FormField control={form.control} name="tableSize" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Configuration</FormLabel><FormControl><Input {...field} className="h-11 rounded-sm uppercase font-bold" /></FormControl><FormMessage/></FormItem>
              )} />
              <FormField control={form.control} name="columnCount" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Columns</FormLabel><FormControl><Input type="number" {...field} className="h-11 rounded-sm" /></FormControl><FormMessage/></FormItem>
              )} />
              <FormField control={form.control} name="moduleCount" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Modules</FormLabel><FormControl><Input type="number" {...field} className="h-11 rounded-sm" /></FormControl><FormMessage/></FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest">Verification Status Feed</CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y">
              {form.watch('checks').map((_, index) => (
                <div key={index} className="p-4 sm:p-8 space-y-6 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <Label className="text-base font-black uppercase tracking-tight text-foreground">{form.watch(`checks.${index}.label`)}</Label>
                    
                    <FormField
                      control={form.control}
                      name={`checks.${index}.status`}
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                              {['OK', 'NOT OK', 'Pending'].map(s => (
                                <div key={s} className="flex items-center space-x-1.5">
                                  <RadioGroupItem value={s} id={`check-${index}-${s}`} className="sr-only" />
                                  <Label htmlFor={`check-${index}-${s}`} className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-sm border-2 cursor-pointer transition-all text-[10px] font-black uppercase",
                                    field.value === s ? "bg-primary text-white border-primary shadow-lg scale-105" : "bg-background border-transparent text-muted-foreground hover:bg-muted/50"
                                  )}>
                                    {s === 'OK' && <Check className="h-3.5 w-3.5" />}
                                    {s === 'NOT OK' && <X className="h-3.5 w-3.5" />}
                                    {s === 'Pending' && <AlertTriangle className="h-3.5 w-3.5" />}
                                    {s}
                                  </Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField control={form.control} name={`checks.${index}.remarks`} render={({ field }) => (
                    <FormControl><Textarea {...field} placeholder="Enter findings..." className="rounded-sm bg-muted/5 min-h-[100px]" /></FormControl>
                  )} />

                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2 px-1">
                      <ImageIcon className="h-3.5 w-3.5" /> Media Evidence
                    </Label>
                    <div className="flex flex-wrap gap-4">
                      {form.watch(`checks.${index}.attachments`).map((file, fIdx) => (
                        <div key={fIdx} className="relative aspect-video w-32 sm:w-40 rounded-sm overflow-hidden border shadow-sm group">
                          <img src={file.url} className="w-full h-full object-cover" alt="Saved evidence" />
                          <Button 
                            type="button" 
                            variant="destructive" size="icon" 
                            className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              const current = form.getValues(`checks.${index}.attachments`);
                              form.setValue(`checks.${index}.attachments`, current.filter((_, i) => i !== fIdx));
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      
                      {form.watch(`checks.${index}.localFiles`).map((file: File, fIdx: number) => (
                        <div key={fIdx} className="relative aspect-video w-32 sm:w-40 rounded-sm overflow-hidden border border-primary/20 bg-primary/5 flex items-center justify-center group">
                          <FileImage className="h-6 w-6 text-primary opacity-40" />
                          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-primary p-2 text-center uppercase truncate">{file.name}</span>
                          <Button 
                            type="button" 
                            variant="destructive" size="icon" 
                            className="absolute top-1 right-1 h-6 w-6 rounded-full"
                            onClick={() => {
                              const current = form.getValues(`checks.${index}.localFiles`);
                              form.setValue(`checks.${index}.localFiles`, current.filter((_, i) => i !== fIdx));
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}

                      <label className="aspect-video w-32 sm:w-40 border-2 border-dashed border-primary/20 rounded-sm flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-all cursor-pointer group">
                        <Camera className="h-6 w-6 text-primary/40 group-hover:text-primary transition-colors" />
                        <span className="text-[8px] font-black uppercase text-primary/40 group-hover:text-primary tracking-widest">Add Media</span>
                        <input 
                          type="file" multiple accept="image/*,video/*" className="hidden" 
                          onChange={(e) => {
                            const newFiles = Array.from(e.target.files || []);
                            const current = form.getValues(`checks.${index}.localFiles`) || [];
                            form.setValue(`checks.${index}.localFiles`, [...current, ...newFiles]);
                          }} 
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-sm shadow-md border-primary/10">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest">Additional Feedback</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <FormField control={form.control} name="otherRemarks" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-black uppercase text-muted-foreground">General Remarks</FormLabel><FormControl><Textarea rows={4} {...field} className="rounded-sm" /></FormControl></FormItem>
              )} />
              
              <div className="space-y-3">
                 <Label className="text-[10px] font-black uppercase text-muted-foreground">General Media Attachments</Label>
                 <div className="flex flex-wrap gap-4">
                   {form.watch('otherAttachments').map((file, idx) => (
                     <div key={idx} className="relative aspect-video w-32 rounded-sm overflow-hidden border shadow-sm group">
                        <img src={file.url} className="w-full h-full object-cover" alt="Existing attachment" />
                        <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full" onClick={() => form.setValue('otherAttachments', form.getValues('otherAttachments').filter((_, i) => i !== idx))}><X className="h-3.5 w-3.5"/></Button>
                     </div>
                   ))}
                   {form.watch('otherLocalFiles').map((file, idx) => (
                     <div key={idx} className="relative aspect-video w-32 rounded-sm overflow-hidden border border-primary/20 bg-primary/5 flex items-center justify-center">
                        <span className="text-[7px] font-black uppercase text-primary p-2 text-center truncate">{file.name}</span>
                        <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full" onClick={() => form.setValue('otherLocalFiles', form.getValues('otherLocalFiles').filter((_, i) => i !== idx))}><X className="h-3.5 w-3.5"/></Button>
                     </div>
                   ))}
                   <label className="aspect-video w-32 border-2 border-dashed border-primary/20 rounded-sm flex items-center justify-center cursor-pointer hover:bg-primary/5 transition-all"><Plus className="h-6 w-6 text-primary/40"/><input type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => form.setValue('otherLocalFiles', [...form.getValues('otherLocalFiles'), ...Array.from(e.target.files || [])])} /></label>
                 </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-sm shadow-md border-primary/10">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest">Customer Verification Context</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="customerRepName" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Representative Name</FormLabel><FormControl><Input {...field} className="h-11 rounded-sm" /></FormControl><FormMessage/></FormItem>
              )} />
              <FormField control={form.control} name="customerRepRemarks" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Representative Feedback</FormLabel><FormControl><Textarea rows={3} {...field} className="rounded-sm" /></FormControl><FormMessage/></FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 bg-background/90 backdrop-blur border-t p-4 z-40 md:left-[16rem]">
            <div className="max-w-4xl mx-auto flex items-center justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isSubmitting} className="rounded-sm font-bold uppercase text-[10px] tracking-widest h-12 px-8">Discard</Button>
              <Button type="submit" disabled={isSubmitting} className="rounded-sm font-black uppercase text-[10px] tracking-widest h-12 px-12 shadow-xl shadow-primary/20 flex-1 sm:flex-none">
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Synchronizing...</> : <><Save className="mr-2 h-4 w-4" /> Finalize Revision</>}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}