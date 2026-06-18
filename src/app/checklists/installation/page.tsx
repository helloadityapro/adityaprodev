"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking, useFirebaseApp } from "@/firebase";
import { collection, doc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
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
  ArrowRight,
  FileImage,
  AlertCircle
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
import { motion } from "framer-motion";

const checkItemSchema = z.object({
  status: z.enum(["OK", "NOT OK", "Pending"], { required_error: "Selection required" }),
  remarks: z.string().min(1, "Findings/Remarks are required for this check"),
  localFiles: z.array(z.any()).default([]),
});

const installationSchema = z.object({
  siteId: z.string().min(1, "Site is required"),
  siteName: z.string(),
  projectCompany: z.string().optional(),
  tableNumber: z.string().min(1, "Table Number is required"),
  tableSize: z.string()
    .min(1, "Size of Table is required")
    .refine(val => !val.includes(" "), "Spaces are not allowed in Size of Table"),
  columnCount: z.coerce.number().min(1, "Number of Columns is required"),
  moduleCount: z.coerce.number().min(1, "Number of Modules is required"),
  checks: z.object({
    moduleNutBolt: checkItemSchema,
    mmsNutBolt: checkItemSchema,
    crackedModules: checkItemSchema,
    cableDressing: checkItemSchema,
    cappingCondition: checkItemSchema,
    earthingCondition: checkItemSchema,
  }),
  otherRemarks: z.string().optional(),
  otherLocalFiles: z.array(z.any()).default([]),
  customerRepPresent: z.enum(["Yes", "No"]),
  customerRepName: z.string().optional(),
  customerRepRemarks: z.string().optional(),
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
}).refine(data => {
  if (data.customerRepPresent === "Yes" && (!data.customerRepRemarks || data.customerRepRemarks.trim() === "")) {
    return false;
  }
  return true;
}, {
  message: "Representative feedback is required when present",
  path: ["customerRepRemarks"]
});

type Site = { id: string; name: string; projectCompany?: string };

const CHECK_LABELS = {
  moduleNutBolt: "Module Nut-bolt Tightness",
  mmsNutBolt: "MMS Nut-Bolt Tightness",
  crackedModules: "Cracked Modules",
  cableDressing: "Cable Dressing",
  cappingCondition: "Capping Condition",
  earthingCondition: "Earthing Condition",
};

export default function TableLevelMMSChecklistPage() {
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [submittedTable, setSubmittedTable] = React.useState("");
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  const [uploadProgress, setUploadProgress] = React.useState<Record<string, number>>({});

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);

  const form = useForm<z.infer<typeof installationSchema>>({
    resolver: zodResolver(installationSchema),
    defaultValues: {
      siteId: "",
      siteName: "",
      projectCompany: "",
      tableNumber: "",
      tableSize: "",
      columnCount: 0,
      moduleCount: 0,
      checks: {
        moduleNutBolt: { status: undefined as any, remarks: "", localFiles: [] },
        mmsNutBolt: { status: undefined as any, remarks: "", localFiles: [] },
        crackedModules: { status: undefined as any, remarks: "", localFiles: [] },
        cableDressing: { status: undefined as any, remarks: "", localFiles: [] },
        cappingCondition: { status: undefined as any, remarks: "", localFiles: [] },
        earthingCondition: { status: undefined as any, remarks: "", localFiles: [] },
      },
      otherRemarks: "",
      otherLocalFiles: [],
      customerRepPresent: "No",
      customerRepName: "",
      customerRepRemarks: "",
      undertaking: false,
    },
  });

  const watchRepPresent = form.watch("customerRepPresent");

  const uploadFile = async (file: File, path: string): Promise<{url: string, contentType: string, name: string}> => {
    let blob: Blob = file;
    const isCompressible = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp';
    
    if (isCompressible) {
      try {
        blob = await imageCompression(file, { 
          maxSizeMB: 1, 
          maxWidthOrHeight: 1920,
          alwaysKeepResolution: true,
          initialQuality: 0.8,
          useWebWorker: true
        });
      } catch (e) {
        console.warn("Compression skipped", e);
      }
    }
    
    const storage = getStorage(firebaseApp);
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, blob);
    
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
        }, 
        (error) => {
          console.error("Storage Error:", error);
          reject(error);
        }, 
        () => {
          getDownloadURL(uploadTask.snapshot.ref)
            .then((url) => {
              resolve({ 
                url, 
                contentType: file.type || 'application/octet-stream', 
                name: file.name 
              });
            })
            .catch((err) => {
              console.error("GetDownloadURL Error:", err);
              reject(err);
            });
        }
      );
    });
  };

  const onSubmit = async (values: z.infer<typeof installationSchema>) => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);
    setUploadProgress({});

    try {
      const finalTableNumber = values.tableNumber.startsWith("T - ") ? values.tableNumber : `T - ${values.tableNumber}`;

      const duplicateQuery = query(
        collection(firestore, 'installation_checklists'),
        where('siteId', '==', values.siteId),
        where('tableNumber', '==', finalTableNumber)
      );
      const duplicateSnap = await getDocs(duplicateQuery);
      
      if (!duplicateSnap.empty) {
        toast({ 
          variant: "destructive", 
          title: "Duplicate Entry", 
          description: `An audit for ${finalTableNumber} at this project site already exists in the registry.` 
        });
        setIsSubmitting(false);
        return;
      }

      const timestamp = Date.now();

      const finalChecks = [];
      for (const [key, check] of Object.entries(values.checks)) {
        const attachments = [];
        if (check.localFiles && check.localFiles.length > 0) {
          for (let i = 0; i < check.localFiles.length; i++) {
            const file = check.localFiles[i];
            const path = `checklists/mms/${user.uid}/${timestamp}_${key}_${i}_${file.name.replace(/\s+/g, '_')}`;
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
          const path = `checklists/mms/${user.uid}/${timestamp}_other_${i}_${file.name.replace(/\s+/g, '_')}`;
          const uploaded = await uploadFile(file, path);
          otherAttachments.push(uploaded);
        }
      }

      addDocumentNonBlocking(collection(firestore, 'installation_checklists'), {
        siteId: values.siteId,
        siteName: values.siteName,
        projectCompany: values.projectCompany || "",
        tableNumber: finalTableNumber,
        tableSize: values.tableSize,
        columnCount: values.columnCount,
        moduleCount: values.moduleCount,
        checks: finalChecks,
        otherRemarks: values.otherRemarks || "",
        otherAttachments: otherAttachments,
        customerRepPresent: values.customerRepPresent === "Yes",
        customerRepName: values.customerRepName || "",
        customerRepRemarks: values.customerRepRemarks || "",
        userId: user.uid,
        userName: userProfile.username || user.email,
        createdAt: serverTimestamp(),
      });

      const adminsQuery = query(collection(firestore, 'users'), where('role', '==', 'Admin'));
      const adminDocs = await getDocs(adminsQuery);
      adminDocs.forEach(adminDoc => {
        sendNotification(firestore, {
          userId: adminDoc.id,
          title: "New MMS Audit Logged",
          description: `${userProfile.username} submitted an audit for Table ${finalTableNumber} at ${values.siteName}.`,
          link: `/checklists/data`,
          push: true
        });
      });

      setSubmittedTable(finalTableNumber);
      setIsSuccess(true);
      toast({ title: "Success", description: "Audit published to registry." });
    } catch (e: any) {
      console.error("MMS Submission Error:", e);
      toast({ 
        variant: "destructive", 
        title: "Submission Error", 
        description: e.message || "Failed to finalize audit record. Please check your connection." 
      });
    } finally {
      setIsSubmitting(false);
      setUploadProgress({});
    }
  };

  const filteredSites = allSites?.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase())) || [];

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <Card className="max-w-md w-full animate-in fade-in zoom-in-95 duration-500 rounded-sm shadow-2xl border-emerald-500/20">
          <CardHeader className="text-center pt-8">
            <div className="flex justify-center mb-6">
              <motion.div 
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 260, 
                  damping: 20,
                  delay: 0.1 
                }}
                className="bg-emerald-500/10 p-6 rounded-full relative"
              >
                <CheckCircle2 className="h-16 w-16 text-emerald-600" />
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 bg-emerald-500/20 rounded-full"
                />
              </motion.div>
            </div>
            <CardTitle className="text-2xl font-black uppercase tracking-tight text-emerald-900">Audit Published</CardTitle>
            <CardDescription className="text-base font-medium text-emerald-800/70 mt-2 leading-relaxed">
              The quality verification for <strong className="text-emerald-900">{submittedTable}</strong> has been successfully archived in the site registry.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pb-8 px-8">
            <Button 
              className="w-full h-12 text-sm font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20" 
              onClick={() => router.push("/checklists/data")}
            >
              View Site Registry
            </Button>
            <Button 
              variant="ghost" 
              className="w-full h-10 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted/50" 
              onClick={() => { setIsSuccess(false); form.reset(); }}
            >
              Record Next Table
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20 px-2 sm:px-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
          <ClipboardCheck className="h-7 w-7" /> Table Level MMS Audit
        </h1>
        <p className="text-muted-foreground font-medium text-sm">Comprehensive field verification for solar tables. All fields except Additional Feedback are mandatory.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card className="rounded-sm shadow-md border-primary/10">
            <CardHeader className="bg-primary/5 border-b py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Site & Table Context
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="siteId" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Project Name *</FormLabel>
                  <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal h-11 rounded-sm text-left", !field.value && "text-muted-foreground")}>
                          {field.value ? allSites?.find(s => s.id === field.value)?.name : "Choose site..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <div className="flex items-center border-b px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Input placeholder="Search sites..." className="h-10 w-full border-none focus-visible:ring-0 px-0 text-sm" value={siteSearchQuery} onChange={e => setSiteSearchQuery(e.target.value)} />
                      </div>
                      <ScrollArea className="h-[200px]">
                        <div className="p-1">
                          {filteredSites.map(site => (
                            <Button key={site.id} type="button" variant="ghost" className="w-full justify-start h-10 text-xs text-left" onClick={() => { 
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
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Project Company</FormLabel>
                  <FormControl>
                    <Input {...field} readOnly className="h-11 rounded-sm bg-muted/20 cursor-not-allowed" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="tableNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Table Number *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-sm font-bold text-muted-foreground">T - </span>
                      <Input placeholder="101" {...field} className="h-11 rounded-sm pl-10" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="tableSize" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Size of Table * (No Spaces)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g. 2P36" 
                      {...field} 
                      className="h-11 rounded-sm" 
                      onChange={(e) => field.onChange(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="columnCount" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Columns *</FormLabel>
                    <FormControl><Input type="number" {...field} className="h-11 rounded-sm" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="moduleCount" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Modules *</FormLabel>
                    <FormControl><Input type="number" {...field} className="h-11 rounded-sm" /></FormControl>
                    <FormMessage />
                  </FormItem>
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
                      <Label className="text-xs sm:text-sm font-black uppercase tracking-tight text-foreground">
                        {(CHECK_LABELS as any)[key]} *
                      </Label>
                      
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <FormField
                          control={form.control}
                          name={`checks.${key}.status` as any}
                          render={({ field }) => (
                            <FormItem className="space-y-0">
                              <FormControl>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  value={field.value}
                                  className="flex items-center gap-4"
                                >
                                  <div className="flex items-center space-x-1.5">
                                    <RadioGroupItem value="OK" id={`${key}-ok`} className="sr-only" />
                                    <Label
                                      htmlFor={`${key}-ok`}
                                      className={cn(
                                        "flex items-center gap-1 px-3 py-1.5 rounded-sm border-2 cursor-pointer transition-all",
                                        field.value === "OK" 
                                          ? "bg-green-50 border-green-500 text-green-700 shadow-sm" 
                                          : "bg-background border-transparent text-muted-foreground hover:bg-muted/50"
                                      )}
                                    >
                                      <Check className={cn("h-4 w-4", field.value === "OK" ? "text-green-600" : "opacity-40")} />
                                      <span className="text-[10px] font-black uppercase">OK</span>
                                    </Label>
                                  </div>

                                  <div className="flex items-center space-x-1.5">
                                    <RadioGroupItem value="NOT OK" id={`${key}-notok`} className="sr-only" />
                                    <Label
                                      htmlFor={`${key}-notok`}
                                      className={cn(
                                        "flex items-center gap-1 px-3 py-1.5 rounded-sm border-2 cursor-pointer transition-all",
                                        field.value === "NOT OK" 
                                          ? "bg-red-50 border-red-500 text-red-700 shadow-sm" 
                                          : "bg-background border-transparent text-muted-foreground hover:bg-muted/50"
                                      )}
                                    >
                                      <X className={cn("h-4 w-4", field.value === "NOT OK" ? "text-red-600" : "opacity-40")} />
                                      <span className="text-[10px] font-black uppercase">NOT OK</span>
                                    </Label>
                                  </div>

                                  <div className="flex items-center space-x-1.5">
                                    <RadioGroupItem value="Pending" id={`${key}-pending`} className="sr-only" />
                                    <Label
                                      htmlFor={`${key}-pending`}
                                      className={cn(
                                        "flex items-center gap-1 px-3 py-1.5 rounded-sm border-2 cursor-pointer transition-all",
                                        field.value === "Pending" 
                                          ? "bg-amber-50 border-amber-500 text-amber-700 shadow-sm" 
                                          : "bg-background border-transparent text-muted-foreground hover:bg-muted/50"
                                      )}
                                    >
                                      <AlertCircle className={cn("h-4 w-4", field.value === "Pending" ? "text-amber-600" : "opacity-40")} />
                                      <span className="text-[10px] font-black uppercase">Pending</span>
                                    </Label>
                                  </div>
                                </RadioGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField control={form.control} name={`checks.${key}.localFiles` as any} render={({ field: { value, onChange } }) => (
                          <FormItem className="space-y-0">
                            <FormControl>
                              <div className="flex flex-col gap-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  {(value || []).map((file: File, fIdx: number) => {
                                    const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
                                    return (
                                      <Badge key={fIdx} variant="secondary" className="h-8 gap-1.5 pl-2 pr-1 rounded-sm bg-primary/5 text-primary border-primary/20">
                                        {file.type.startsWith('video/') ? <Film className="h-3 w-3" /> : isHeic ? <FileImage className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                                        <span className="text-[9px] font-black truncate max-w-[80px]">{file.name}</span>
                                        <Button 
                                          type="button"
                                          variant="ghost" size="icon" 
                                          className="h-5 w-5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive" 
                                          onClick={() => onChange(value.filter((_: any, i: number) => i !== fIdx))}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </Badge>
                                    );
                                  })}
                                  
                                  <label className="cursor-pointer">
                                    <div className="flex items-center justify-center gap-2 px-3 h-8 rounded-sm border border-dashed border-primary/30 bg-background text-primary hover:bg-primary/5 transition-colors text-[9px] font-black uppercase tracking-widest">
                                      <Camera className="h-3 w-3" /> Add Media
                                    </div>
                                    <input 
                                      type="file" 
                                      multiple 
                                      accept="image/*,video/*,.heic,.heif" 
                                      className="hidden" 
                                      onChange={(e) => {
                                        const newFiles = Array.from(e.target.files || []);
                                        onChange([...(value || []), ...newFiles]);
                                      }} 
                                    />
                                  </label>
                                </div>
                              </div>
                            </FormControl>
                          </FormItem>
                        )} />
                      </div>
                    </div>

                    <FormField control={form.control} name={`checks.${key}.remarks` as any} render={({ field }) => (
                      <FormControl>
                        <div className="space-y-1">
                          <Textarea placeholder="Enter mandatory findings..." {...field} className="rounded-sm bg-muted/5 min-h-[80px] text-sm" />
                          <FormMessage />
                        </div>
                      </FormControl>
                    )} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-sm shadow-md border-primary/10">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest">Additional Feedback (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <FormField control={form.control} name="otherRemarks" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">General Remarks</FormLabel>
                  <FormControl><Textarea placeholder="Supplementary site observations..." rows={4} {...field} className="rounded-sm text-sm" /></FormControl>
                </FormItem>
              )} />
              
              <FormField control={form.control} name="otherLocalFiles" render={({ field: { value, onChange } }) => (
                <FormItem>
                  <FormControl>
                    <div className="space-y-4 p-6 border-2 border-dashed rounded-sm bg-muted/5">
                      <div className="flex flex-wrap gap-4 justify-center">
                        {(value || []).map((file: File, fIdx: number) => {
                          const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
                          const isVideo = file.type.startsWith('video/');
                          const isImage = file.type.startsWith('image/') && !isHeic;

                          return (
                            <div key={fIdx} className="relative group w-24 h-24 rounded-sm overflow-hidden border bg-background flex flex-col items-center justify-center gap-1">
                              {isImage ? (
                                <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="Preview" />
                              ) : isVideo ? (
                                <Film className="h-8 w-8 text-primary opacity-40" />
                              ) : (
                                <>
                                  <FileImage className="h-8 w-8 text-primary opacity-40" />
                                  <span className="text-[8px] font-black uppercase text-muted-foreground">HEIC</span>
                                </>
                              )}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                 <Button 
                                  type="button"
                                  variant="destructive" size="icon" className="h-7 w-7 rounded-full" 
                                  onClick={() => onChange(value.filter((_: any, i: number) => i !== fIdx))}
                                 >
                                   <Trash2 className="h-3.5 w-3.5" />
                                 </Button>
                              </div>
                            </div>
                          );
                        })}

                        <label className="flex flex-col items-center justify-center w-24 h-24 cursor-pointer border border-dashed border-primary/30 rounded-sm hover:bg-primary/5 transition-colors">
                          <Plus className="h-6 w-6 text-primary" />
                          <span className="text-[8px] font-black uppercase text-primary mt-1">Add Media</span>
                          <input 
                            type="file" 
                            multiple 
                            accept="image/*,video/*,.heic,.heif" 
                            className="hidden" 
                            onChange={(e) => {
                              const newFiles = Array.from(e.target.files || []);
                              onChange([...(value || []), ...newFiles]);
                            }} 
                          />
                        </label>
                      </div>
                    </div>
                  </FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="rounded-sm shadow-md border-primary/10">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest">Customer Verification *</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <FormField control={form.control} name="customerRepPresent" render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Is a Representative of Project Customer present at site? *</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-6">
                      <div className="flex items-center space-x-2"><RadioGroupItem value="Yes" id="rep-yes" /><Label htmlFor="rep-yes" className="font-bold cursor-pointer text-xs">Yes</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="No" id="rep-no" /><Label htmlFor="rep-no" className="font-bold cursor-pointer text-xs">No</Label></div>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )} />

              {watchRepPresent === "Yes" && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <FormField control={form.control} name="customerRepName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Representative Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Full name" {...field} className="h-11 rounded-sm" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="customerRepRemarks" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Representative Feedback *</FormLabel>
                      <FormControl><Textarea placeholder="Client comments..." rows={3} {...field} className="rounded-sm bg-muted/5 text-sm" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-sm border-primary/10 shadow-lg overflow-hidden">
            <CardContent className="p-6 sm:p-8 space-y-8">
              <FormField control={form.control} name="undertaking" render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 sm:p-6 rounded-sm bg-primary/5 border border-primary/20">
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
            <Button type="submit" disabled={isSubmitting} className="rounded-sm font-black uppercase text-xs tracking-widest h-12 px-10 shadow-xl shadow-primary/20">
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Transferring Media...</> : <><Save className="mr-2 h-4 w-4" /> Finalize Record</>}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
