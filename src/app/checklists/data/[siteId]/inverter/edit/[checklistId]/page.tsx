'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  useFirestore, 
  useUser, 
  useDoc, 
  useMemoFirebase, 
  updateDocumentNonBlocking, 
  useFirebaseApp,
  useCollection
} from '@/firebase';
import { doc, serverTimestamp, collection } from 'firebase/firestore';
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
  Camera, 
  ImageIcon, 
  FileImage, 
  Check, 
  AlertTriangle,
  Pencil,
  Cpu
} from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import imageCompression from 'browser-image-compression';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  inverterNumber: z.string().min(1, "Required"),
  inverterSerialNumber: z.string().min(1, "Required"),
  inverterMake: z.string().min(1, "Required"),
  inverterRating: z.string().min(1, "Required"),
  stringCount: z.coerce.number().min(1),
  checks: z.array(checkItemSchema),
  otherRemarks: z.string().optional(),
  otherAttachments: z.array(z.object({ url: z.string(), name: z.string(), contentType: z.string() })).default([]),
  otherLocalFiles: z.array(z.any()).default([]),
  customerRepName: z.string().optional(),
});

export default function EditInverterAuditPage({ params }: { params: Promise<{ siteId: string, checklistId: string }> }) {
  const { siteId, checklistId } = React.use(params);
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<Record<string, number>>({});

  const auditRef = useMemoFirebase(() => doc(firestore, 'inverter_checklists', checklistId), [firestore, checklistId]);
  const { data: audit, isLoading: auditLoading } = useDoc<any>(auditRef);

  const makesQuery = useMemoFirebase(() => collection(firestore, 'inverter_makes'), [firestore]);
  const { data: inverterMakes } = useCollection<any>(makesQuery);

  const ratingsQuery = useMemoFirebase(() => collection(firestore, 'inverter_ratings'), [firestore]);
  const { data: inverterRatings } = useCollection<any>(ratingsQuery);

  const form = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      inverterNumber: "",
      inverterSerialNumber: "",
      inverterMake: "",
      inverterRating: "",
      stringCount: 0,
      checks: [],
      otherRemarks: "",
      otherAttachments: [],
      otherLocalFiles: [],
      customerRepName: "",
    }
  });

  React.useEffect(() => {
    if (audit) {
      form.reset({
        inverterNumber: audit.inverterNumber?.replace("INV-", "") || "",
        inverterSerialNumber: audit.inverterSerialNumber || "",
        inverterMake: audit.inverterMake || "",
        inverterRating: audit.inverterRating || "",
        stringCount: audit.stringCount || 0,
        checks: (audit.checks || []).map((c: any) => ({
          label: c.label || "",
          status: c.status || "Pending",
          remarks: c.remarks || "",
          attachments: c.attachments || [],
          localFiles: []
        })),
        otherRemarks: audit.otherRemarks || "",
        otherAttachments: audit.otherAttachments || [],
        otherLocalFiles: [],
        customerRepName: audit.customerRepName || "",
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
    if (!user || !audit) return;
    setIsSubmitting(true);
    try {
      const finalInverterNumber = values.inverterNumber.startsWith("INV-") ? values.inverterNumber : `INV-${values.inverterNumber}`;
      const timestamp = Date.now();
      
      // 1. Process point-wise checks
      const updatedChecks = [];
      for (let i = 0; i < values.checks.length; i++) {
        const check = values.checks[i];
        const newAttachments = [...check.attachments];
        
        // Handle local uploads for this check
        if (check.localFiles && check.localFiles.length > 0) {
          for (const file of check.localFiles) {
            const path = `checklists/inverter/${user.uid}/${timestamp}_edit_check_${i}_${file.name.replace(/\s+/g, '_')}`;
            const uploaded = await uploadFile(file, path);
            newAttachments.push(uploaded);
          }
        }
        
        // Omit localFiles from the final Firestore payload
        const { localFiles, ...checkClean } = check;
        updatedChecks.push({ 
          ...checkClean, 
          attachments: newAttachments 
        });
      }

      // 2. Process additional other attachments
      const updatedOtherAttachments = [...values.otherAttachments];
      if (values.otherLocalFiles && values.otherLocalFiles.length > 0) {
        for (const file of values.otherLocalFiles) {
          const path = `checklists/inverter/${user.uid}/${timestamp}_edit_other_${file.name.replace(/\s+/g, '_')}`;
          const uploaded = await uploadFile(file, path);
          updatedOtherAttachments.push(uploaded);
        }
      }

      // 3. Destructure values to omit raw File objects (otherLocalFiles)
      const { otherLocalFiles, checks, otherAttachments, ...sanitizedValues } = values;

      // 4. Perform non-blocking update
      updateDocumentNonBlocking(auditRef, {
        ...sanitizedValues,
        inverterNumber: finalInverterNumber,
        checks: updatedChecks,
        otherAttachments: updatedOtherAttachments,
        updatedAt: serverTimestamp(),
        status: 'Pending'
      });

      toast({ 
        title: "Revision Saved", 
        description: "Audit record updated and returned to Pending status for review." 
      });
      
      router.back();
    } catch (e: any) {
      console.error("Inverter Edit Error:", e);
      toast({ 
        variant: "destructive", 
        title: "Update Failed", 
        description: e.message || "An error occurred during synchronization." 
      });
      setIsSubmitting(false);
    }
  };

  if (auditLoading) return <div className="p-8 space-y-4 max-w-4xl mx-auto"><Skeleton className="h-10 w-48" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.back()} disabled={isSubmitting} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary">
          <ArrowLeft className="mr-2 h-4 w-4" /> Cancel & Return
        </Button>
        <div className="flex items-center gap-3">
           <div className="bg-primary/10 p-2.5 rounded-sm shrink-0"><Pencil className="h-6 w-6 text-primary" /></div>
           <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">Edit Inverter Log</h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{audit?.siteName} • Inv #{audit?.inverterNumber}</p>
           </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card className="rounded-sm shadow-md border-primary/10">
            <CardHeader className="bg-primary/5 border-b py-4"><CardTitle className="text-xs font-bold uppercase tracking-widest">Inverter Identity</CardTitle></CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="inverterNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Inverter #</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-sm font-bold text-muted-foreground uppercase">INV-</span>
                      <Input 
                        {...field} 
                        className="h-11 rounded-sm pl-12 uppercase font-mono font-bold" 
                        onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))}
                      />
                    </div>
                  </FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="inverterSerialNumber" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Serial #</FormLabel><FormControl><Input {...field} className="h-11 font-mono" /></FormControl></FormItem>)} />
              <FormField control={form.control} name="inverterMake" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Make</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{inverterMakes?.map((m: any) => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}</SelectContent>
                </Select></FormItem>
              )} />
              <FormField control={form.control} name="inverterRating" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Rating</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{inverterRatings?.map((r: any) => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}</SelectContent>
                </Select></FormItem>
              )} />
              <FormField control={form.control} name="stringCount" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Strings</FormLabel><FormControl><Input type="number" {...field} className="h-11 font-black" /></FormControl></FormItem>)} />
            </CardContent>
          </Card>

          <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
            <CardHeader className="bg-muted/5 border-b py-4"><CardTitle className="text-xs font-bold uppercase tracking-widest">Verification Status Feed</CardTitle></CardHeader>
            <CardContent className="p-0 divide-y">
              {form.watch('checks').map((_, index) => (
                <div key={index} className="p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <Label className="text-base font-black uppercase tracking-tight text-foreground">{form.watch(`checks.${index}.label`)}</Label>
                    <FormField control={form.control} name={`checks.${index}.status`} render={({ field }) => (
                      <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                        {['OK', 'NOT OK', 'Pending'].map(s => (
                          <div key={s} className="flex items-center space-x-1.5">
                            <RadioGroupItem value={s} id={`check-${index}-${s}`} className="sr-only" />
                            <Label htmlFor={`check-${index}-${s}`} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-sm border-2 cursor-pointer text-[10px] font-black uppercase", field.value === s ? "bg-primary text-white border-primary shadow-lg" : "bg-background border-transparent text-muted-foreground hover:bg-muted/50")}>{s}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )} />
                  </div>
                  <FormField control={form.control} name={`checks.${index}.remarks`} render={({ field }) => (<FormControl><Textarea {...field} placeholder="Findings..." className="rounded-sm bg-muted/5" /></FormControl>)} />
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2"><ImageIcon className="h-3.5 w-3.5" /> Media Evidence</Label>
                    <div className="flex flex-wrap gap-4">
                      {form.watch(`checks.${index}.attachments`)?.map((file, fIdx) => (
                        <div key={fIdx} className="relative aspect-video w-32 rounded-sm overflow-hidden border group">
                          <img src={file.url} className="w-full h-full object-cover" alt="Audit" />
                          <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full" onClick={() => form.setValue(`checks.${index}.attachments`, form.getValues(`checks.${index}.attachments`).filter((_, i) => i !== fIdx))}><X className="h-3.5 w-3.5" /></Button>
                        </div>
                      ))}
                      {form.watch(`checks.${index}.localFiles`)?.map((file: File, fIdx: number) => (
                        <div key={fIdx} className="relative aspect-video w-32 rounded-sm overflow-hidden border border-primary/20 bg-primary/5 flex items-center justify-center group shadow-sm">
                          <FileImage className="h-6 w-6 text-primary opacity-40" /><span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-primary p-2 text-center uppercase truncate">{file.name}</span>
                          <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full" onClick={() => form.setValue(`checks.${index}.localFiles`, form.getValues(`checks.${index}.localFiles`).filter((_, i) => i !== fIdx))}><X className="h-3.5 w-3.5" /></Button>
                        </div>
                      ))}
                      <label className="aspect-video w-32 border-2 border-dashed border-primary/20 rounded-sm flex flex-col items-center justify-center cursor-pointer hover:bg-primary/5 transition-all bg-muted/5"><Camera className="h-6 w-6 text-primary/40" /><input type="file" multiple accept="image/*,video/*" className="hidden" onChange={e => form.setValue(`checks.${index}.localFiles`, [...(form.getValues(`checks.${index}.localFiles`) || []), ...Array.from(e.target.files || [])])} /></label>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-sm shadow-md border-primary/10">
            <CardHeader className="bg-muted/5 border-b py-4"><CardTitle className="text-xs font-bold uppercase tracking-widest">Additional Feedback</CardTitle></CardHeader>
            <CardContent className="pt-6 space-y-6">
              <FormField control={form.control} name="otherRemarks" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">General Remarks</FormLabel><FormControl><Textarea rows={4} {...field} className="rounded-sm bg-muted/5" /></FormControl></FormItem>
              )} />
              <div className="space-y-3">
                 <Label className="text-[10px] font-black uppercase text-muted-foreground">Supplementary Media</Label>
                 <div className="flex flex-wrap gap-4">
                   {form.watch('otherAttachments')?.map((file, idx) => (
                     <div key={idx} className="relative aspect-video w-32 rounded-sm overflow-hidden border group"><img src={file.url} className="w-full h-full object-cover" alt="Audit" /><Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full" onClick={() => form.setValue('otherAttachments', form.getValues('otherAttachments').filter((_, i) => i !== idx))}><X className="h-3.5 w-3.5"/></Button></div>
                   ))}
                   {form.watch('otherLocalFiles')?.map((file, idx) => (
                     <div key={idx} className="relative aspect-video w-32 rounded-sm overflow-hidden border border-primary/20 bg-primary/5 flex items-center justify-center group"><span className="text-[7px] font-black uppercase text-primary p-2 text-center truncate">{file.name}</span><Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full shadow-lg" onClick={() => form.setValue('otherLocalFiles', form.getValues('otherLocalFiles').filter((_, i) => i !== idx))}><X className="h-3.5 w-3.5"/></Button></div>
                   ))}
                   <label className="aspect-video w-32 border-2 border-dashed border-primary/20 rounded-sm flex items-center justify-center cursor-pointer hover:bg-primary/5 transition-all bg-muted/5"><Plus className="h-6 w-6 text-primary/40"/><input type="file" multiple accept="image/*,video/*" className="hidden" onChange={e => form.setValue('otherLocalFiles', [...(form.getValues('otherLocalFiles') || []), ...Array.from(e.target.files || [])])} /></label>
                 </div>
              </div>
            </CardContent>
          </Card>

          <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 bg-background/90 backdrop-blur border-t p-4 z-40 md:left-[16rem]">
            <div className="max-w-4xl mx-auto flex items-center justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isSubmitting} className="rounded-sm font-bold uppercase text-[10px] tracking-widest h-12 px-8">Discard</Button>
              <Button type="submit" disabled={isSubmitting} className="rounded-sm font-black uppercase text-[10px] tracking-widest h-12 px-12 shadow-xl">
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing...</> : <><Save className="mr-2 h-4 w-4" /> Save Revision</>}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
