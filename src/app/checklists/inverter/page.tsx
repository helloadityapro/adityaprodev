"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFirebaseApp, useFirestore, useUser, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp, increment, query, where, getDocs } from "firebase/firestore";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, 
  Check, 
  ChevronsUpDown, 
  Loader2, 
  Building2, 
  ClipboardCheck,
  Camera,
  ImageIcon,
  X,
  Save,
  Trash2,
  Film,
  Plus,
  CheckCircle2,
  FileImage,
  AlertCircle,
  Cpu
} from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import imageCompression from 'browser-image-compression';
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { sendNotification } from "@/lib/notifications";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const checkItemSchema = z.object({
  status: z.enum(["OK", "NOT OK", "Pending"], { required_error: "Selection required" }),
  remarks: z.string().optional().default(""),
  localFiles: z.array(z.any()).default([]),
});

const inverterSchema = z.object({
  siteId: z.string().min(1, "Site is required"),
  siteName: z.string(),
  projectCompany: z.string().optional(),
  inverterMake: z.string().min(1, "Inverter make is required"),
  inverterRating: z.string().min(1, "Inverter rating is required"),
  inverterNumber: z.string().min(1, "Inverter Number is required"),
  inverterSerialNumber: z.string().min(1, "Serial Number is required"),
  stringCount: z.coerce.number().min(1, "String count is required"),
  checks: z.object({
    mounting: checkItemSchema,
    acTerminations: checkItemSchema,
    acCabinetPosition: checkItemSchema,
    dcStrings: checkItemSchema,
    earthing: checkItemSchema,
    canopy: checkItemSchema,
  }),
  otherRemarks: z.string().optional(),
  otherLocalFiles: z.array(z.any()).default([]),
  customerRepPresent: z.enum(["Yes", "No"]),
  customerRepName: z.string().optional(),
  undertaking: z.boolean().refine(val => val === true, {
    message: "You must agree to the undertaking."
  }),
}).refine(data => {
  if (data.customerRepPresent === "Yes" && (!data.customerRepName || data.customerRepName.trim() === "")) {
    return false;
  }
  return true;
}, {
  message: "Representative Name is required when present",
  path: ["customerRepName"]
});

type Site = { id: string; name: string; projectCompany?: string };
type GenericItem = { id: string; name: string };

const CHECK_LABELS = {
  mounting: "Inverter Mounting Condition",
  acTerminations: "Inverter AC Terminations",
  acCabinetPosition: "AC Cabinet Position",
  dcStrings: "DC Strings Connection",
  earthing: "Earthing Connections",
  canopy: "Canopy Fixing",
};

export default function InverterChecklistPage() {
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [submittedInv, setSubmittedInv] = React.useState("");
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  const [uploadProgress, setUploadProgress] = React.useState<Record<string, number>>({});

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const makesQuery = useMemoFirebase(() => collection(firestore, 'inverter_makes'), [firestore]);
  const { data: inverterMakes } = useCollection<GenericItem>(makesQuery);

  const ratingsQuery = useMemoFirebase(() => collection(firestore, 'inverter_ratings'), [firestore]);
  const { data: inverterRatings } = useCollection<GenericItem>(ratingsQuery);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);

  const form = useForm<z.infer<typeof inverterSchema>>({
    resolver: zodResolver(inverterSchema),
    defaultValues: {
      siteId: "",
      siteName: "",
      projectCompany: "",
      inverterMake: "",
      inverterRating: "",
      inverterNumber: "",
      inverterSerialNumber: "",
      stringCount: 0,
      checks: {
        mounting: { status: undefined as any, remarks: "", localFiles: [] },
        acTerminations: { status: undefined as any, remarks: "", localFiles: [] },
        acCabinetPosition: { status: undefined as any, remarks: "", localFiles: [] },
        dcStrings: { status: undefined as any, remarks: "", localFiles: [] },
        earthing: { status: undefined as any, remarks: "", localFiles: [] },
        canopy: { status: undefined as any, remarks: "", localFiles: [] },
      },
      otherRemarks: "",
      otherLocalFiles: [],
      customerRepPresent: "No",
      customerRepName: "",
      undertaking: false,
    },
  });

  const watchMake = form.watch("inverterMake");
  const watchRating = form.watch("inverterRating");
  const watchRepPresent = form.watch("customerRepPresent");

  const ratingWarning = React.useMemo(() => {
    if (!watchMake || !watchRating) return null;
    const make = watchMake.toLowerCase();
    const rating = watchRating.toLowerCase();

    const is300Make = make.includes("sineng") || make.includes("waaree");
    const is275Make = make.includes("wattpower");

    if (is300Make && !rating.includes("300")) return "Recheck Inverter Rating";
    if (is275Make && !rating.includes("275")) return "Recheck Inverter Rating";
    
    return null;
  }, [watchMake, watchRating]);

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

  const onSubmit = async (values: z.infer<typeof inverterSchema>) => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);
    setUploadProgress({});

    try {
      const finalInverterNumber = values.inverterNumber.startsWith("INV-") ? values.inverterNumber : `INV-${values.inverterNumber}`;
      const timestamp = Date.now();
      const finalChecks = [];
      
      for (const [key, check] of Object.entries(values.checks)) {
        const attachments = [];
        if (check.localFiles && check.localFiles.length > 0) {
          for (let i = 0; i < check.localFiles.length; i++) {
            const file = check.localFiles[i];
            const path = `checklists/inverter/${user.uid}/${timestamp}_${key}_${i}_${file.name.replace(/\s+/g, '_')}`;
            const uploaded = await uploadFile(file, path);
            attachments.push(uploaded);
          }
        }
        finalChecks.push({
          key,
          label: (CHECK_LABELS as any)[key],
          status: check.status,
          remarks: check.remarks || "",
          attachments
        });
      }

      const otherAttachments = [];
      if (values.otherLocalFiles && values.otherLocalFiles.length > 0) {
        for (let i = 0; i < values.otherLocalFiles.length; i++) {
          const file = values.otherLocalFiles[i];
          const path = `checklists/inverter/${user.uid}/${timestamp}_other_${i}_${file.name.replace(/\s+/g, '_')}`;
          const uploaded = await uploadFile(file, path);
          otherAttachments.push(uploaded);
        }
      }

      await addDocumentNonBlocking(collection(firestore, 'inverter_checklists'), {
        siteId: values.siteId,
        siteName: values.siteName,
        projectCompany: values.projectCompany || "",
        inverterMake: values.inverterMake,
        inverterRating: values.inverterRating,
        inverterNumber: finalInverterNumber,
        inverterSerialNumber: values.inverterSerialNumber,
        stringCount: values.stringCount,
        checks: finalChecks,
        otherRemarks: values.otherRemarks || "",
        otherAttachments,
        customerRepPresent: values.customerRepPresent === "Yes",
        customerRepName: values.customerRepName || "",
        userId: user.uid,
        userName: userProfile.username || user.email,
        status: 'Pending',
        createdAt: serverTimestamp(),
      });

      const adminsQuery = query(collection(firestore, 'users'), where('role', '==', 'Admin'));
      const adminDocs = await getDocs(adminsQuery);
      adminDocs.forEach(adminDoc => {
        if (adminDoc.id === user.uid) return;
        sendNotification(firestore, {
          userId: adminDoc.id,
          title: "New Inverter Audit Logged",
          description: `${userProfile.username} submitted an audit for Inverter ${finalInverterNumber} at ${values.siteName}.`,
          link: `/checklists/data/${values.siteId}/inverter`,
          push: true
        });
      });

      setSubmittedInv(finalInverterNumber);
      setIsSuccess(true);
      toast({ title: "Audit Published", description: "Record successfully archived." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSites = allSites?.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase())) || [];

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4 animate-in fade-in zoom-in-95 duration-500">
        <Card className="max-w-md w-full rounded-sm shadow-2xl border-emerald-500/20">
          <CardHeader className="text-center pt-8">
            <div className="flex justify-center mb-6">
              <div className="bg-emerald-500/10 p-6 rounded-full"><CheckCircle2 className="h-16 w-16 text-emerald-600" /></div>
            </div>
            <CardTitle className="text-2xl font-black uppercase tracking-tight text-emerald-900">Checklist Submitted</CardTitle>
            <CardDescription className="text-base font-medium text-emerald-800/70 mt-2">
              Inverter audit <strong>#{submittedInv}</strong> has been successfully archived in the site registry.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pb-8 px-8">
            <Button className="w-full h-12 text-sm font-black uppercase bg-emerald-600" onClick={() => router.push("/checklists/data")}>View Registry</Button>
            <Button variant="ghost" className="w-full h-10 text-[10px] font-black uppercase" onClick={() => { setIsSuccess(false); form.reset(); setSubmittedInv(""); }}>Record Next Inverter</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20 px-2 sm:px-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
          <Cpu className="h-7 w-7" /> Inverter Installation Checklist
        </h1>
        <p className="text-muted-foreground font-medium text-sm">Quality verification for site inverters.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card className="rounded-sm shadow-md border-primary/10">
            <CardHeader className="bg-primary/5 border-b py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Site Context</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        <Input placeholder="Search sites..." className="h-10 w-full border-none focus-visible:ring-0 px-0" value={siteSearchQuery} onChange={e => setSiteSearchQuery(e.target.value)} />
                      </div>
                      <ScrollArea className="h-[200px]">
                        <div className="p-1">
                          {allSites?.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase())).map(site => (
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
            </CardContent>
          </Card>

          <Card className="rounded-sm shadow-md border-primary/10">
            <CardHeader className="bg-primary/5 border-b py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2"><Cpu className="h-4 w-4" /> Inverter Configuration</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="inverterMake" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Inverter Make *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-11 rounded-sm"><SelectValue placeholder="Select Make" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {inverterMakes?.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="inverterRating" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Inverter Rating *</FormLabel>
                    <div className="space-y-2">
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="h-11 rounded-sm"><SelectValue placeholder="Select Rating" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {inverterRatings?.map(r => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {ratingWarning && (
                        <div className="flex items-center gap-2 text-red-600 animate-pulse">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-[10px] font-black uppercase tracking-tight">{ratingWarning}</span>
                        </div>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="inverterNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Inverter Number (ID) *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-3 text-sm font-bold text-muted-foreground uppercase">INV-</span>
                        <Input 
                          placeholder="01" 
                          {...field} 
                          className="h-11 rounded-sm pl-12 uppercase font-mono font-bold" 
                          onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="inverterSerialNumber" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Serial Number *</FormLabel><FormControl><Input placeholder="Manufacturer SN" {...field} className="h-11 rounded-sm font-mono" /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name="stringCount" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Strings Connected *</FormLabel><FormControl><Input type="number" {...field} className="h-11 rounded-sm font-mono font-bold" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest">Verification Points *</CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y">
              {Object.keys(CHECK_LABELS).map((key) => (
                <div key={key} className="p-4 sm:p-6 space-y-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <Label className="text-xs sm:text-sm font-black uppercase tracking-tight text-foreground">{(CHECK_LABELS as any)[key]} *</Label>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <FormField control={form.control} name={`checks.${key}.status` as any} render={({ field }) => (
                          <FormItem className="space-y-0">
                            <FormControl>
                              <RadioGroup onValueChange={field.onChange} value={field.value} className="flex items-center gap-4">
                                {['OK', 'NOT OK', 'Pending'].map(s => (
                                  <div key={s} className="flex items-center space-x-1.5">
                                    <RadioGroupItem value={s} id={`${key}-${s}`} className="sr-only" />
                                    <Label htmlFor={`${key}-${s}`} className={cn("flex items-center gap-1 px-3 py-1.5 rounded-sm border-2 cursor-pointer transition-all", field.value === s ? (s === 'OK' ? "bg-green-50 border-green-500 text-green-700" : s === 'NOT OK' ? "bg-red-50 border-red-500 text-red-700" : "bg-amber-50 border-amber-500 text-amber-700") : "bg-background border-transparent text-muted-foreground hover:bg-muted/50")}>
                                      <span className="text-[10px] font-black uppercase">{s}</span>
                                    </Label>
                                  </div>
                                ))}
                              </RadioGroup>
                            </FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={`checks.${key}.localFiles` as any} render={({ field: { value, onChange } }) => (
                          <div className="flex flex-wrap items-center gap-2">
                            {(value || []).map((file: File, fIdx: number) => (
                              <Badge key={fIdx} variant="secondary" className="h-8 gap-1.5 pl-2 pr-1 rounded-sm bg-primary/5 text-primary border-primary/20">
                                <ImageIcon className="h-3 w-3" /><span className="text-[9px] font-black truncate max-w-[80px]">{file.name}</span>
                                <Button type="button" variant="ghost" size="icon" className="h-5 w-5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive" onClick={() => onChange(value.filter((_: any, i: number) => i !== fIdx))}><X className="h-3 w-3" /></Button>
                              </Badge>
                            ))}
                            <label className="cursor-pointer"><div className="flex items-center justify-center gap-2 px-3 h-8 rounded-sm border border-dashed border-primary/30 bg-background text-primary hover:bg-primary/5 transition-colors text-[9px] font-black uppercase tracking-widest"><Camera className="h-3 w-3" /> Add Media</div><input type="file" multiple accept="image/*,video/*" className="hidden" onChange={e => onChange([...(value || []), ...Array.from(e.target.files || [])])} /></label>
                          </div>
                        )} />
                      </div>
                    </div>
                    <FormField control={form.control} name={`checks.${key}.remarks` as any} render={({ field }) => (
                      <FormControl><Textarea placeholder="Enter observations..." {...field} className="rounded-sm bg-muted/5 min-h-[80px] text-sm" /></FormControl>
                    )} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-sm shadow-md border-primary/10">
            <CardHeader className="bg-muted/5 border-b py-4"><CardTitle className="text-xs font-bold uppercase tracking-widest">Additional Feedback</CardTitle></CardHeader>
            <CardContent className="pt-6 space-y-4">
              <FormField control={form.control} name="otherRemarks" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">General Remarks</FormLabel><FormControl><Textarea rows={4} {...field} className="rounded-sm text-sm" /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="otherLocalFiles" render={({ field: { value, onChange } }) => (
                <div className="space-y-4 p-6 border-2 border-dashed rounded-sm bg-muted/5">
                  <div className="flex flex-wrap gap-4 justify-center">
                    {(value || []).map((file: File, fIdx: number) => (
                      <div key={fIdx} className="relative group w-24 h-24 rounded-sm overflow-hidden border bg-background flex flex-col items-center justify-center gap-1">
                        {file.type.startsWith('image/') ? <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="Preview" /> : <Film className="h-8 w-8 text-primary opacity-40" />}
                        <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-7 w-7 rounded-full" onClick={() => onChange(value.filter((_: any, i: number) => i !== fIdx))}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    ))}
                    <label className="flex flex-col items-center justify-center w-24 h-24 cursor-pointer border border-dashed border-primary/30 rounded-sm hover:bg-primary/5 transition-colors">
                      <Plus className="h-6 w-6 text-primary" /><span className="text-[8px] font-black uppercase text-primary mt-1">Add Media</span>
                      <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={e => onChange([...(value || []), ...Array.from(e.target.files || [])])} />
                    </label>
                  </div>
                </div>
              )} />
            </CardContent>
          </Card>

          <Card className="rounded-sm shadow-md border-primary/10">
            <CardHeader className="bg-muted/5 border-b py-4"><CardTitle className="text-xs font-bold uppercase tracking-widest">Customer Verification *</CardTitle></CardHeader>
            <CardContent className="pt-6 space-y-6">
              <FormField control={form.control} name="customerRepPresent" render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Is a Representative of Client present at site? *</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-6">
                      <div className="flex items-center space-x-2"><RadioGroupItem value="Yes" id="rep-yes" /><Label htmlFor="rep-yes" className="font-bold cursor-pointer text-xs">Yes</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="No" id="rep-no" /><Label htmlFor="rep-no" className="font-bold cursor-pointer text-xs">No</Label></div>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )} />
              {watchRepPresent === "Yes" && (
                <FormField control={form.control} name="customerRepName" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Representative Name *</FormLabel><FormControl><Input placeholder="Full name" {...field} className="h-11 rounded-sm" /></FormControl><FormMessage /></FormItem>
                )} />
              )}
            </CardContent>
          </Card>

          <Card className="rounded-sm border-primary/10 shadow-lg overflow-hidden">
            <CardContent className="p-6 sm:p-8 space-y-8">
              <FormField control={form.control} name="undertaking" render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 sm:p-6 rounded-sm bg-primary/5 border border-primary/20">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-1" /></FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-xs sm:text-sm text-foreground leading-relaxed cursor-pointer font-bold">
                      I, {userProfile?.username || user?.email}, hereby undertake and confirm that the information provided above is true and accurate as of {format(new Date(), 'dd MMMM yyyy')}.
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 pt-8">
            <Button type="button" variant="outline" onClick={() => router.back()} className="h-12 w-32 rounded-sm font-bold">Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="h-12 px-10 rounded-sm font-black uppercase text-xs tracking-widest shadow-xl">
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publishing...</> : <><Save className="mr-2 h-4 w-4" /> SUBMIT</>}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
