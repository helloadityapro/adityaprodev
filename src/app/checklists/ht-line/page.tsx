
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { 
  useFirestore, 
  useUser, 
  useDoc, 
  useMemoFirebase, 
  useCollection, 
  addDocumentNonBlocking, 
  useFirebaseApp 
} from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { 
  Zap, 
  Building2, 
  Plus, 
  Trash2, 
  Loader2, 
  Search, 
  Check, 
  ChevronsUpDown, 
  ImageIcon, 
  Camera, 
  X, 
  Save, 
  Info, 
  CheckCircle2 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import imageCompression from 'browser-image-compression';
import { Progress } from "@/components/ui/progress";

const POLE_SIZES = [
  "RSJ 152 X 152",
  "13 Mtr Long Pole RSJ 100 X 116",
  "11 Mtr Long Pole RSJ 100 X 116",
  "10 Mtr Long Pole RSJ 100 X 116",
  "09 Mtr Long Pole"
];

const STUD_SIZES = ["08", "09", "10", "11 Mtr"];

const pointSchema = z.object({
  status: z.enum(['Yes', 'No']),
  quantity: z.coerce.number().optional().default(0),
  remarks: z.string().optional().default(""),
  localPhotos: z.array(z.any()).default([]),
});

const htLineSchema = z.object({
  siteId: z.string().min(1, 'Site selection is mandatory.'),
  siteName: z.string(),
  projectCompany: z.string().optional(),
  poleType: z.enum(['Two Pole', 'Four Pole']),
  poleNumber: z.string().min(1, "Required").regex(/^\d{1,2}$/, "Max 2 digits allowed."),
  poleSize: z.string().min(1, "Please select pole size."),
  studSize: z.string().optional(),
  cutPointType: z.enum(['Single Cut Point', 'Double Cut Point']),
  checks: z.record(pointSchema),
  additionalRemarks: z.string().optional(),
  generalPhotos: z.array(z.any()).default([]),
  undertaking: z.boolean().refine(val => val === true, {
    message: "Mandatory compliance undertaking."
  }),
});

type Site = { id: string; name: string; projectCompany?: string };

const CHECK_KEYS = [
  { key: 'studInstalled', label: 'Stud installed?' },
  { key: 'vCross', label: 'V-Cross installed?' },
  { key: 'stayInstalled', label: 'Stay Installed?' },
  { key: 'discInsulator', label: 'Disc insulator installed?' },
  { key: 'pinInsulator', label: 'Pin insulator installed?' },
  { key: 'abSwitch', label: 'AB Switch installed?' },
  { key: 'barbedWire', label: 'Barbed Wire installed?' },
  { key: 'concreting', label: 'Concreting Done Properly?' },
  { key: 'earthingSet', label: 'Earthing Set Installed?' },
  { key: 'redOxide', label: 'Red Oxide applied?' },
  { key: 'silverPaint', label: 'Silver Paint applied?' },
];

export default function HTLineChecklistPage() {
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<Record<string, number>>({});
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearch, setSiteSearch] = React.useState("");
  
  const [visibleRemarks, setVisibleRemarks] = React.useState<Record<string, boolean>>({});
  const [visiblePhotos, setVisiblePhotos] = React.useState<Record<string, boolean>>({});

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);

  const defaultChecks: any = {};
  CHECK_KEYS.forEach(item => {
    defaultChecks[item.key] = { status: 'No', quantity: 0, remarks: '', localPhotos: [] };
  });

  const form = useForm<z.infer<typeof htLineSchema>>({
    resolver: zodResolver(htLineSchema),
    defaultValues: {
      siteId: "",
      siteName: "",
      projectCompany: "",
      poleType: "Two Pole",
      poleNumber: "",
      poleSize: "",
      studSize: "",
      cutPointType: "Single Cut Point",
      checks: defaultChecks,
      additionalRemarks: "",
      generalPhotos: [],
      undertaking: false,
    }
  });

  const watchChecks = form.watch('checks');

  const uploadFile = async (file: File, path: string): Promise<any> => {
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

  const onSubmit = async (values: z.infer<typeof htLineSchema>) => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);
    try {
      const timestamp = Date.now();
      const finalChecks = [];

      for (const item of CHECK_KEYS) {
        const checkVal = values.checks[item.key];
        const attachments = [];
        if (checkVal.localPhotos && checkVal.localPhotos.length > 0) {
          for (let i = 0; i < checkVal.localPhotos.length; i++) {
            const file = checkVal.localPhotos[i];
            const path = `checklists/htline/${user.uid}/${timestamp}_${item.key}_${i}_${file.name.replace(/\s+/g, '_')}`;
            const uploaded = await uploadFile(file, path);
            attachments.push(uploaded);
          }
        }
        finalChecks.push({
          key: item.key,
          label: item.label,
          status: checkVal.status,
          quantity: checkVal.quantity || 0,
          remarks: checkVal.remarks || "",
          attachments
        });
      }

      const generalAttachments = [];
      if (values.generalPhotos && values.generalPhotos.length > 0) {
        for (let i = 0; i < values.generalPhotos.length; i++) {
          const file = values.generalPhotos[i];
          const path = `checklists/htline/${user.uid}/${timestamp}_general_${i}_${file.name.replace(/\s+/g, '_')}`;
          const uploaded = await uploadFile(file, path);
          generalAttachments.push(uploaded);
        }
      }

      await addDocumentNonBlocking(collection(firestore, 'ht_line_checklists'), {
        siteId: values.siteId,
        siteName: values.siteName,
        projectCompany: values.projectCompany || "",
        poleType: values.poleType,
        poleNumber: values.poleNumber,
        poleSize: values.poleSize,
        studSize: values.studSize || "",
        cutPointType: values.cutPointType,
        checks: finalChecks,
        additionalRemarks: values.additionalRemarks || "",
        generalPhotos: generalAttachments,
        userId: user.uid,
        userName: userProfile.username,
        status: 'Pending',
        createdAt: serverTimestamp(),
      });

      setIsSuccess(true);
      toast({ title: "Audit Recorded", description: `Pole ${values.poleNumber} has been logged.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4 animate-in fade-in zoom-in-95 duration-500">
        <Card className="max-w-md w-full rounded-sm shadow-2xl border-emerald-500/20">
          <CardHeader className="text-center pt-8">
            <div className="flex justify-center mb-6">
              <div className="bg-emerald-500/10 p-6 rounded-full"><CheckCircle2 className="h-16 w-16 text-emerald-600" /></div>
            </div>
            <CardTitle className="text-2xl font-black uppercase tracking-tight text-emerald-900">Audit Logged</CardTitle>
            <CardDescription className="text-base font-medium text-emerald-800/70 mt-2">
              HT Line record for Pole <strong>#{form.getValues('poleNumber')}</strong> archived successfully.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pb-8 px-8">
            <Button className="w-full h-12 text-sm font-black uppercase bg-emerald-600" onClick={() => router.push("/checklists/data")}>View Site Registry</Button>
            <Button variant="ghost" className="w-full h-10 text-[10px] font-black uppercase" onClick={() => { setIsSuccess(false); form.reset(); setUploadProgress({}); }}>Audit Next Pole</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20 px-2 sm:px-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
          <Zap className="h-7 w-7" /> HT Line Checklist
        </h1>
        <p className="text-muted-foreground font-medium text-sm">Verify High Tension line pole components and installation quality.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card className="rounded-sm shadow-md border-primary/10">
            <CardHeader className="bg-primary/5 border-b py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Pole Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="siteId" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Project Name *</FormLabel>
                    <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={cn("w-full justify-between font-normal h-11 rounded-sm", !field.value && "text-muted-foreground")}>
                            {field.value ? allSites?.find(s => s.id === field.value)?.name : "Choose site..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <div className="flex items-center border-b px-3">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <Input placeholder="Search sites..." className="h-10 w-full border-none focus-visible:ring-0 px-0" value={siteSearch} onChange={e => setSiteSearch(e.target.value)} />
                        </div>
                        <ScrollArea className="h-[200px]">
                          <div className="p-1">
                            {allSites?.filter(s => s.name.toLowerCase().includes(siteSearch.toLowerCase())).map(site => (
                              <Button key={site.id} type="button" variant="ghost" className="w-full justify-start h-10 text-xs" onClick={() => { 
                                field.onChange(site.id); 
                                form.setValue('siteName', site.name); 
                                form.setValue('projectCompany', site.projectCompany || "");
                                setIsSitePopoverOpen(false); 
                              }}>
                                <Check className={cn("mr-2 h-4 w-4 text-primary", field.value === site.id ? "opacity-100" : "opacity-0")} />
                                {site.name}
                              </Button>
                            ))}
                          </div>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="projectCompany" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Project Company</FormLabel><FormControl><Input {...field} readOnly className="h-11 rounded-sm bg-muted/20 cursor-not-allowed" /></FormControl></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <FormField control={form.control} name="poleType" render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pole Configuration *</FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-6 h-11 items-center">
                        <div className="flex items-center space-x-2"><RadioGroupItem value="Two Pole" id="pt-two" /><Label htmlFor="pt-two" className="font-bold cursor-pointer text-xs">Two Pole</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="Four Pole" id="pt-four" /><Label htmlFor="pt-four" className="font-bold cursor-pointer text-xs">Four Pole</Label></div>
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )} />

                <FormField control={form.control} name="poleNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      Pole Number (2 Digits) * 
                      <Popover><PopoverTrigger asChild><Info className="h-3 w-3 text-primary cursor-help" /></PopoverTrigger><PopoverContent className="text-[10px] p-2 leading-relaxed">Start numbering from Plant side and end at Substation side.</PopoverContent></Popover>
                    </FormLabel>
                    <FormControl><Input placeholder="01" maxLength={2} {...field} className="h-11 rounded-sm font-mono font-bold" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="poleSize" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pole Size *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-11 rounded-sm"><SelectValue placeholder="Select size" /></SelectTrigger></FormControl>
                      <SelectContent>{POLE_SIZES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="cutPointType" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cut Point Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-11 rounded-sm"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Single Cut Point" className="text-xs">Single Cut Point</SelectItem>
                        <SelectItem value="Double Cut Point" className="text-xs">Double Cut Point</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
            <CardHeader className="bg-muted/5 border-b py-4"><CardTitle className="text-xs font-bold uppercase tracking-widest">Verification Points *</CardTitle></CardHeader>
            <CardContent className="p-0 divide-y">
              {CHECK_KEYS.map((item) => (
                <div key={item.key} className="p-4 sm:p-6 space-y-4 hover:bg-muted/[0.01] transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <Label className="text-sm font-black uppercase tracking-tight text-foreground">{item.label}</Label>
                    <div className="flex items-center gap-6">
                      <FormField control={form.control} name={`checks.${item.key}.status` as any} render={({ field }) => (
                        <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                          {['Yes', 'No'].map(s => (
                            <div key={s} className="flex items-center space-x-1.5">
                              <RadioGroupItem value={s} id={`${item.key}-${s}`} className="sr-only" />
                              <Label htmlFor={`${item.key}-${s}`} className={cn("flex items-center gap-1 px-3 py-1 rounded-sm border-2 cursor-pointer transition-all text-[10px] font-black uppercase", field.value === s ? "bg-primary text-white border-primary shadow-lg" : "bg-background border-transparent text-muted-foreground hover:bg-muted/50")}>{s}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      )} />
                      <div className="flex gap-1">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setVisibleRemarks(p => ({...p, [item.key]: !p[item.key]}))} className={cn("h-7 px-2 text-[9px] font-black uppercase", visibleRemarks[item.key] ? "text-primary" : "text-muted-foreground")}>
                          <Plus className="h-3 w-3 mr-1" /> Remark
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setVisiblePhotos(p => ({...p, [item.key]: !p[item.key]}))} className={cn("h-7 px-2 text-[9px] font-black uppercase", visiblePhotos[item.key] ? "text-primary" : "text-muted-foreground")}>
                          <Camera className="h-3 w-3 mr-1" /> Photo
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Conditional logic for Stud Size and Insulator Quantity */}
                  {(item.key === 'studInstalled' && watchChecks['studInstalled']?.status === 'Yes') && (
                    <div className="p-4 bg-primary/[0.03] border-l-4 border-primary rounded-sm animate-in slide-in-from-left-2 duration-300">
                      <FormField control={form.control} name="studSize" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] font-bold uppercase">Stud Size *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger className="h-10 bg-background"><SelectValue placeholder="Choose size" /></SelectTrigger></FormControl>
                          <SelectContent>{STUD_SIZES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
                        </Select></FormItem>
                      )} />
                    </div>
                  )}

                  {(['discInsulator', 'pinInsulator'].includes(item.key) && watchChecks[item.key]?.status === 'Yes') && (
                    <div className="p-4 bg-primary/[0.03] border-l-4 border-primary rounded-sm animate-in slide-in-from-left-2">
                       <FormField control={form.control} name={`checks.${item.key}.quantity` as any} render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] font-bold uppercase">Quantity *</FormLabel><FormControl><Input type="number" {...field} className="h-10 bg-background" /></FormControl></FormItem>
                      )} />
                    </div>
                  )}

                  {visibleRemarks[item.key] && (
                    <FormField control={form.control} name={`checks.${item.key}.remarks` as any} render={({ field }) => (
                      <FormControl><Textarea placeholder="Findings..." {...field} className="rounded-sm bg-muted/5 min-h-[80px] text-sm animate-in fade-in duration-300" /></FormControl>
                    )} />
                  )}

                  {visiblePhotos[item.key] && (
                    <FormField control={form.control} name={`checks.${item.key}.localPhotos` as any} render={({ field: { value, onChange } }) => (
                      <div className="space-y-3 animate-in fade-in duration-300">
                        <div className="flex flex-wrap items-center gap-2">
                          {(value || []).map((file: File, fIdx: number) => (
                            <Badge key={fIdx} variant="secondary" className="h-8 gap-1.5 pl-2 pr-1 rounded-sm bg-primary/5 text-primary border-primary/20">
                              <ImageIcon className="h-3 w-3" /><span className="text-[9px] font-black truncate max-w-[80px]">{file.name}</span>
                              <Button type="button" variant="ghost" size="icon" className="h-5 w-5 rounded-full hover:bg-destructive/10 text-muted-foreground" onClick={() => onChange(value.filter((_: any, i: number) => i !== fIdx))}><X className="h-3 w-3" /></Button>
                            </Badge>
                          ))}
                          <label className="cursor-pointer h-8 border border-dashed border-primary/30 bg-background flex items-center justify-center px-4 gap-2 rounded-sm hover:bg-primary/5 transition-all text-[9px] font-black uppercase text-primary tracking-widest"><Camera className="h-3.5 w-3.5" /> ADD PHOTO<input type="file" multiple accept="image/*,video/*" className="hidden" onChange={e => onChange([...(value || []), ...Array.from(e.target.files || [])])} /></label>
                        </div>
                      </div>
                    )} />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-sm shadow-md border-primary/10">
            <CardHeader className="bg-muted/5 border-b py-4"><CardTitle className="text-xs font-bold uppercase tracking-widest">Pole Photos (Multi-angle) & Remarks</CardTitle></CardHeader>
            <CardContent className="pt-6 space-y-6">
              <FormField control={form.control} name="additionalRemarks" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">General Observations</FormLabel><FormControl><Textarea rows={4} {...field} className="rounded-sm" /></FormControl></FormItem>
              )} />
              
              <FormField control={form.control} name="generalPhotos" render={({ field: { value, onChange } }) => (
                <div className="space-y-4 p-6 border-2 border-dashed rounded-sm bg-muted/5 text-center">
                  <div className="flex flex-wrap gap-4 justify-center">
                    {(value || []).map((file: File, fIdx: number) => (
                      <div key={fIdx} className="relative w-24 h-24 rounded-sm overflow-hidden border bg-background flex flex-col items-center justify-center"><img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="Preview" /><Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full" onClick={() => onChange(value.filter((_: any, i: number) => i !== fIdx))}><Trash2 className="h-3.5 w-3.5" /></Button></div>
                    ))}
                    <label className="flex flex-col items-center justify-center w-24 h-24 cursor-pointer border-2 border-dashed rounded-sm hover:bg-primary/5 transition-colors"><Plus className="h-6 w-6 text-primary" /><span className="text-[8px] font-black uppercase text-primary mt-1">Upload</span><input type="file" multiple accept="image/*,video/*" className="hidden" onChange={e => onChange([...(value || []), ...Array.from(e.target.files || [])])} /></label>
                  </div>
                </div>
              )} />
            </CardContent>
          </Card>

          <Card className="rounded-sm border-primary/10 shadow-lg overflow-hidden">
            <CardContent className="p-6 sm:p-8 space-y-8">
              <FormField control={form.control} name="undertaking" render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 rounded-sm bg-primary/5 border border-primary/20">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-1" /></FormControl>
                  <div className="space-y-1">
                    <FormLabel className="text-xs sm:text-sm text-foreground leading-relaxed cursor-pointer font-bold">
                      I, {userProfile?.username || user?.email}, hereby undertake and confirm that the information provided above is true and accurate as of {format(new Date(), 'dd MMMM yyyy')}. *
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )} />
            </CardContent>
          </Card>
          
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-8">
            <Button type="button" variant="outline" onClick={() => router.back()} className="rounded-sm font-bold h-12 sm:w-32">Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-sm font-black uppercase text-xs tracking-widest h-12 px-10 shadow-xl shadow-primary/20 flex-1 sm:flex-none">
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publishing...</> : <><Save className="mr-2 h-4 w-4" /> SUBMIT AUDIT</>}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
