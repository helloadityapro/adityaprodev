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
  Zap,
  Pencil
} from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import imageCompression from 'browser-image-compression';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const POLE_SIZES = [
  "RSJ 152 X 152, 13 Mtr Long Pole",
  "RSJ 100 X 116, 11 Mtr Long Pole",
  "RSJ 100 X 116, 10 Mtr Long Pole",
  "RSJ 100 X 116, 09 Mtr Long Pole"
];

const STUD_SIZES = ["08 Meters", "09 Meters", "10 Meters", "11 Meters"];

const checkItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  status: z.enum(["Yes", "No"]),
  quantity: z.coerce.number().optional().default(0),
  remarks: z.string().default(""),
  attachments: z.array(z.object({
    url: z.string(),
    name: z.string(),
    contentType: z.string()
  })).default([]),
  localFiles: z.array(z.any()).default([]),
});

const editSchema = z.object({
  poleNumber: z.string().min(1, "Required").regex(/^\d{1,2}$/, "Max 2 digits allowed."),
  poleType: z.enum(['Two Pole', 'Four Pole']),
  poleSize: z.string().min(1, "Required"),
  studSize: z.string().optional(),
  cutPointType: z.enum(['Single Cut Point', 'Double Cut Point', 'V-Cross', 'Horizontal Channel (One Side channel)']),
  checks: z.array(checkItemSchema),
  additionalRemarks: z.string().optional(),
  generalPhotos: z.array(z.object({ url: z.string(), name: z.string(), contentType: z.string() })).default([]),
  generalLocalFiles: z.array(z.any()).default([]),
});

export default function EditHTLineAuditPage({ params }: { params: Promise<{ siteId: string, checklistId: string }> }) {
  const { siteId, checklistId } = React.use(params);
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<Record<string, number>>({});

  const auditRef = useMemoFirebase(() => doc(firestore, 'ht_line_checklists', checklistId), [firestore, checklistId]);
  const { data: audit, isLoading: auditLoading } = useDoc<any>(auditRef);

  const form = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      poleNumber: "",
      poleType: "Two Pole",
      poleSize: "",
      studSize: "",
      cutPointType: "Single Cut Point",
      checks: [],
      additionalRemarks: "",
      generalPhotos: [],
      generalLocalFiles: [],
    }
  });

  React.useEffect(() => {
    if (audit) {
      form.reset({
        poleNumber: audit.poleNumber || "",
        poleType: audit.poleType || "Two Pole",
        poleSize: audit.poleSize || "",
        studSize: audit.studSize || "",
        cutPointType: audit.cutPointType || "Single Cut Point",
        checks: (audit.checks || []).map((c: any) => ({
          key: c.key || "",
          label: c.label || "",
          status: c.status || "No",
          quantity: c.quantity || 0,
          remarks: c.remarks || "",
          attachments: c.attachments || [],
          localFiles: []
        })),
        additionalRemarks: audit.additionalRemarks || "",
        generalPhotos: audit.generalPhotos || [],
        generalLocalFiles: [],
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
      const timestamp = Date.now();
      
      // 1. Process point-wise checks
      const updatedChecks = [];
      for (let i = 0; i < values.checks.length; i++) {
        const check = values.checks[i];
        const newAttachments = [...check.attachments];
        
        if (check.localFiles && check.localFiles.length > 0) {
          for (const file of check.localFiles) {
            const path = `checklists/htline/${user.uid}/${timestamp}_edit_check_${i}_${file.name.replace(/\s+/g, '_')}`;
            const uploaded = await uploadFile(file, path);
            newAttachments.push(uploaded);
          }
        }
        
        const { localFiles, ...checkClean } = check;
        updatedChecks.push({ 
          ...checkClean, 
          attachments: newAttachments 
        });
      }

      // 2. Process general photos
      const updatedGeneralPhotos = [...values.generalPhotos];
      if (values.generalLocalFiles && values.generalLocalFiles.length > 0) {
        for (const file of values.generalLocalFiles) {
          const path = `checklists/htline/${user.uid}/${timestamp}_edit_gen_${file.name.replace(/\s+/g, '_')}`;
          const uploaded = await uploadFile(file, path);
          updatedGeneralPhotos.push(uploaded);
        }
      }

      const { generalLocalFiles, checks, generalPhotos, ...sanitizedValues } = values;

      updateDocumentNonBlocking(auditRef, {
        ...sanitizedValues,
        checks: updatedChecks,
        generalPhotos: updatedGeneralPhotos,
        updatedAt: serverTimestamp(),
        status: 'Pending'
      });

      toast({ 
        title: "Revision Saved", 
        description: "Audit record updated and returned to Pending status." 
      });
      
      router.back();
    } catch (e: any) {
      toast({ 
        variant: "destructive", 
        title: "Update Failed", 
        description: e.message 
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
              <h1 className="text-2xl font-black uppercase tracking-tight">Edit HT Line Log</h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{audit?.siteName} • Pole #{audit?.poleNumber}</p>
           </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card className="rounded-sm shadow-md border-primary/10">
            <CardHeader className="bg-primary/5 border-b py-4"><CardTitle className="text-xs font-bold uppercase tracking-widest">Pole Context</CardTitle></CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="poleNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pole Number</FormLabel>
                    <FormControl><Input {...field} maxLength={2} className="h-11 rounded-sm font-mono font-bold" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="poleType" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Two Pole">Two Pole</SelectItem>
                        <SelectItem value="Four Pole">Four Pole</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="poleSize" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Size</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {POLE_SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="cutPointType" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Cut Point Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Single Cut Point">Single Cut Point</SelectItem>
                        <SelectItem value="Double Cut Point">Double Cut Point</SelectItem>
                        <SelectItem value="V-Cross">V-Cross</SelectItem>
                        <SelectItem value="Horizontal Channel (One Side channel)">Horizontal Channel</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
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
                        {['Yes', 'No'].map(s => (
                          <div key={s} className="flex items-center space-x-1.5">
                            <RadioGroupItem value={s} id={`check-${index}-${s}`} className="sr-only" />
                            <Label htmlFor={`check-${index}-${s}`} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-sm border-2 cursor-pointer text-[10px] font-black uppercase", field.value === s ? "bg-primary text-white border-primary shadow-lg" : "bg-background border-transparent text-muted-foreground hover:bg-muted/50")}>{s}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )} />
                  </div>

                  {form.watch(`checks.${index}.status`) === 'Yes' && ['studInstalled', 'earthingSet', 'discInsulator', 'pinInsulator'].includes(form.watch(`checks.${index}.key`)) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-1">
                      {form.watch(`checks.${index}.key`) === 'studInstalled' && (
                        <FormField control={form.control} name="studSize" render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] font-bold uppercase">Stud Size</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="h-10"><SelectValue placeholder="Choose size" /></SelectTrigger></FormControl>
                            <SelectContent>{STUD_SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                          </Select></FormItem>
                        )} />
                      )}
                      <FormField control={form.control} name={`checks.${index}.quantity`} render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] font-bold uppercase">Quantity</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-10 font-bold" /></FormControl></FormItem>
                      )} />
                    </div>
                  )}

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
                          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-primary p-2 text-center uppercase truncate">{file.name}</span>
                          <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full shadow-lg" onClick={() => form.setValue(`checks.${index}.localFiles`, form.getValues(`checks.${index}.localFiles`).filter((_, i) => i !== fIdx))}><X className="h-3.5 w-3.5" /></Button>
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
            <CardHeader className="bg-muted/5 border-b py-4"><CardTitle className="text-xs font-bold uppercase tracking-widest">Additional Evidence</CardTitle></CardHeader>
            <CardContent className="pt-6 space-y-6">
              <FormField control={form.control} name="additionalRemarks" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">General Remarks</FormLabel><FormControl><Textarea rows={4} {...field} className="rounded-sm bg-muted/5" /></FormControl></FormItem>
              )} />
              <div className="space-y-3">
                 <Label className="text-[10px] font-black uppercase text-muted-foreground">General Media Attachments</Label>
                 <div className="flex flex-wrap gap-4">
                   {form.watch('generalPhotos')?.map((file, idx) => (
                     <div key={idx} className="relative aspect-video w-32 rounded-sm overflow-hidden border group"><img src={file.url} className="w-full h-full object-cover" alt="Audit" /><Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full" onClick={() => form.setValue('generalPhotos', form.getValues('generalPhotos').filter((_, i) => i !== idx))}><X className="h-3.5 w-3.5"/></Button></div>
                   ))}
                   {form.watch('generalLocalFiles')?.map((file: File, idx: number) => (
                     <div key={idx} className="relative aspect-video w-32 rounded-sm overflow-hidden border border-primary/20 bg-primary/5 flex items-center justify-center group"><span className="text-[7px] font-black uppercase text-primary p-2 text-center truncate">{file.name}</span><Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full shadow-lg" onClick={() => form.setValue('generalLocalFiles', form.getValues('generalLocalFiles').filter((_, i) => i !== idx))}><X className="h-3.5 w-3.5"/></Button></div>
                   ))}
                   <label className="aspect-video w-32 border-2 border-dashed border-primary/20 rounded-sm flex items-center justify-center cursor-pointer hover:bg-primary/5 transition-all bg-muted/5"><Plus className="h-6 w-6 text-primary/40"/><input type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => form.setValue('generalLocalFiles', [...form.getValues('generalLocalFiles'), ...Array.from(e.target.files || [])])} /></label>
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
