
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking, useFirebaseApp } from "@/firebase";
import { collection, doc, serverTimestamp } from "firebase/firestore";
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
  CheckCircle2,
  Camera,
  ImageIcon,
  X,
  UserCheck,
  Save
} from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import imageCompression from 'browser-image-compression';

const checkItemSchema = z.object({
  remarks: z.string().optional(),
  photo: z.any().optional(),
});

const installationSchema = z.object({
  siteId: z.string().min(1, "Site is required"),
  siteName: z.string(),
  tableNumber: z.string().min(1, "Table Number is required"),
  tableSize: z.string().min(1, "Size of Table is required"),
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
  otherPhoto: z.any().optional(),
  customerRepPresent: z.enum(["Yes", "No"]),
  customerRepName: z.string().optional(),
  customerRepRemarks: z.string().optional(),
  undertaking: z.boolean().refine(val => val === true, {
    message: "You must confirm the undertaking to proceed."
  }),
});

type Site = { id: string; name: string };

const CHECK_LABELS = {
  moduleNutBolt: "Module Nut-bolt Tightness",
  mmsNutBolt: "MMS Nut-Bolt Tightness",
  crackedModules: "Cracked Modules",
  cableDressing: "Cable Dressing",
  cappingCondition: "Capping Condition",
  earthingCondition: "Earthing Condition",
};

export default function ModuleInstallationChecklistPage() {
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
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
      tableNumber: "",
      tableSize: "",
      columnCount: 0,
      moduleCount: 0,
      checks: {
        moduleNutBolt: { remarks: "", photo: null },
        mmsNutBolt: { remarks: "", photo: null },
        crackedModules: { remarks: "", photo: null },
        cableDressing: { remarks: "", photo: null },
        cappingCondition: { remarks: "", photo: null },
        earthingCondition: { remarks: "", photo: null },
      },
      otherRemarks: "",
      otherPhoto: null,
      customerRepPresent: "No",
      customerRepName: "",
      customerRepRemarks: "",
      undertaking: false,
    },
  });

  const watchRepPresent = form.watch("customerRepPresent");

  const uploadFile = async (file: File, path: string, label: string) => {
    const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920 });
    const storage = getStorage(firebaseApp);
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, compressed);
    
    return new Promise<string>((resolve, reject) => {
      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(prev => ({ ...prev, [label]: progress }));
        }, 
        reject, 
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(url);
        }
      );
    });
  };

  const onSubmit = async (values: z.infer<typeof installationSchema>) => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);
    setUploadProgress({});

    try {
      const timestamp = Date.now();
      const uploadResults: Record<string, string> = {};

      // Handle photos for checks
      for (const [key, check] of Object.entries(values.checks)) {
        if (check.photo instanceof File) {
          const label = (CHECK_LABELS as any)[key];
          const path = `checklists/installation/${user.uid}/${timestamp}_${key}_${check.photo.name.replace(/\s+/g, '_')}`;
          uploadResults[key] = await uploadFile(check.photo, path, label);
        }
      }

      // Handle other photo
      let otherPhotoUrl = null;
      if (values.otherPhoto instanceof File) {
        const path = `checklists/installation/${user.uid}/${timestamp}_other_${values.otherPhoto.name.replace(/\s+/g, '_')}`;
        otherPhotoUrl = await uploadFile(values.otherPhoto, path, "Other Proof");
      }

      const finalChecks = Object.entries(values.checks).map(([key, check]) => ({
        key,
        label: (CHECK_LABELS as any)[key],
        remarks: check.remarks || "",
        photoUrl: uploadResults[key] || null,
      }));

      await addDocumentNonBlocking(collection(firestore, 'installation_checklists'), {
        siteId: values.siteId,
        siteName: values.siteName,
        tableNumber: values.tableNumber,
        tableSize: values.tableSize,
        columnCount: values.columnCount,
        moduleCount: values.moduleCount,
        checks: finalChecks,
        otherRemarks: values.otherRemarks || "",
        otherPhotoUrl: otherPhotoUrl,
        customerRepPresent: values.customerRepPresent === "Yes",
        customerRepName: values.customerRepName || "",
        customerRepRemarks: values.customerRepRemarks || "",
        userId: user.uid,
        userName: userProfile.username || user.email,
        createdAt: serverTimestamp(),
      });

      toast({ title: "Success", description: "Installation checklist submitted successfully." });
      router.push("/dashboard");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmitting(false);
      setUploadProgress({});
    }
  };

  const filteredSites = allSites?.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase())) || [];

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20 px-2 sm:px-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
          <ClipboardCheck className="h-8 w-8" /> Module Installation Checklist
        </h1>
        <p className="text-muted-foreground font-medium">Capture quality metrics for physical site installations.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Section: Context */}
          <Card className="rounded-sm shadow-md border-primary/10">
            <CardHeader className="bg-primary/5 border-b py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Site Context
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="siteId" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Project Name</FormLabel>
                  <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal h-11 rounded-sm", !field.value && "text-muted-foreground")}>
                          {field.value ? allSites?.find(s => s.id === field.value)?.name : "Choose site..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <div className="flex items-center border-b px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Input placeholder="Search sites..." className="h-9 w-full border-none focus-visible:ring-0 px-0 text-sm" value={siteSearchQuery} onChange={e => setSiteSearchQuery(e.target.value)} />
                      </div>
                      <ScrollArea className="h-[200px]">
                        <div className="p-1">
                          {filteredSites.map(site => (
                            <Button key={site.id} type="button" variant="ghost" className="w-full justify-start h-10 text-xs" onClick={() => { field.onChange(site.id); form.setValue('siteName', site.name); setIsSitePopoverOpen(false); }}>
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

              <FormField control={form.control} name="tableNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Table Number</FormLabel>
                  <FormControl><Input placeholder="e.g. T-042" {...field} className="h-11 rounded-sm" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="tableSize" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Size of Table</FormLabel>
                  <FormControl><Input placeholder="e.g. 2Rx14C" {...field} className="h-11 rounded-sm" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="columnCount" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Number of Columns</FormLabel>
                    <FormControl><Input type="number" {...field} className="h-11 rounded-sm" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="moduleCount" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Number of Modules</FormLabel>
                    <FormControl><Input type="number" {...field} className="h-11 rounded-sm" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          {/* Section: Checks */}
          <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest">Verification Points</CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y">
              {Object.keys(CHECK_LABELS).map((key) => (
                <div key={key} className="p-4 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <Label className="text-xs sm:text-sm font-black uppercase tracking-tight text-foreground">
                      {(CHECK_LABELS as any)[key]}
                    </Label>
                    <div className="flex items-center gap-4">
                      <FormField control={form.control} name={`checks.${key}.photo` as any} render={({ field: { value, onChange, ...rest } }) => (
                        <FormItem className="space-y-0 w-full sm:w-auto">
                          <FormControl>
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                {value ? (
                                  <Badge variant="secondary" className="h-9 gap-1.5 pl-2 pr-1 rounded-sm bg-primary/5 text-primary border-primary/20 flex-1 sm:flex-none">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span className="text-[10px] font-black truncate max-w-[100px]">{value instanceof File ? value.name : 'Photo Captured'}</span>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive" onClick={() => onChange(null)}>
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </Badge>
                                ) : (
                                  <label className="cursor-pointer w-full sm:w-auto">
                                    <div className="flex items-center justify-center gap-2 px-4 h-9 rounded-sm border border-primary/20 bg-background text-primary hover:bg-primary/5 transition-colors text-[10px] font-black uppercase tracking-widest">
                                      <Camera className="h-3.5 w-3.5" /> Attach Photo
                                    </div>
                                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onChange(e.target.files?.[0])} {...rest} />
                                  </label>
                                )}
                              </div>
                              {uploadProgress[(CHECK_LABELS as any)[key]] !== undefined && (
                                <div className="space-y-1">
                                  <Progress value={uploadProgress[(CHECK_LABELS as any)[key]]} className="h-1 rounded-none" />
                                </div>
                              )}
                            </div>
                          </FormControl>
                        </FormItem>
                      )} />
                    </div>
                  </div>
                  <FormField control={form.control} name={`checks.${key}.remarks` as any} render={({ field }) => (
                    <FormControl><Textarea placeholder="Enter findings or observations..." {...field} className="rounded-sm bg-muted/5 min-h-[80px]" /></FormControl>
                  )} />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Other Remarks */}
          <Card className="rounded-sm shadow-md border-primary/10">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest">Additional Feedback</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <FormField control={form.control} name="otherRemarks" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Other Remarks / Comments</FormLabel>
                  <FormControl><Textarea placeholder="Any other site observations..." rows={4} {...field} className="rounded-sm" /></FormControl>
                </FormItem>
              )} />
              
              <FormField control={form.control} name="otherPhoto" render={({ field: { value, onChange, ...rest } }) => (
                <FormItem>
                  <FormControl>
                    <div className="flex flex-col items-center gap-4 p-8 border-2 border-dashed rounded-sm bg-muted/5">
                      {value ? (
                        <div className="relative group">
                          <img src={URL.createObjectURL(value)} className="h-32 w-auto rounded-sm shadow-md" alt="Other proof" />
                          <div className="mt-2 text-center">
                            {uploadProgress['Other Proof'] !== undefined && (
                              <div className="w-full space-y-1 mb-2">
                                <span className="text-[8px] font-black uppercase text-primary">Uploading...</span>
                                <Progress value={uploadProgress['Other Proof']} className="h-1" />
                              </div>
                            )}
                            <Button variant="destructive" size="sm" className="h-7 px-3 rounded-sm text-[9px] font-black uppercase" onClick={() => onChange(null)}>
                              <Trash2 className="h-3 w-3 mr-1" /> Remove
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center gap-2 cursor-pointer">
                          <div className="p-3 bg-primary/10 rounded-full text-primary"><ImageIcon className="h-6 w-6" /></div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Upload Supplementary Proof</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => onChange(e.target.files?.[0])} {...rest} />
                        </label>
                      )}
                    </div>
                  </FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Customer Representative */}
          <Card className="rounded-sm shadow-md border-primary/10">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest">Customer Verification</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <FormField control={form.control} name="customerRepPresent" render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Is a Representative of Project Customer present at site?</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-6">
                      <div className="flex items-center space-x-2"><RadioGroupItem value="Yes" id="rep-yes" /><Label htmlFor="rep-yes" className="font-bold cursor-pointer">Yes</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="No" id="rep-no" /><Label htmlFor="rep-no" className="font-bold cursor-pointer">No</Label></div>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )} />

              {watchRepPresent === "Yes" && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <FormField control={form.control} name="customerRepName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Representative Name</FormLabel>
                      <FormControl><Input placeholder="Full name of representative" {...field} className="h-11 rounded-sm" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="customerRepRemarks" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Representative Remarks / Comments</FormLabel>
                      <FormControl><Textarea placeholder="Any comments from the customer..." rows={3} {...field} className="rounded-sm bg-muted/5" /></FormControl>
                    </FormItem>
                  )} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Undertaking */}
          <Card className="rounded-sm border-primary/10 shadow-lg overflow-hidden">
            <CardContent className="p-6 sm:p-8 space-y-8">
              <FormField control={form.control} name="undertaking" render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 sm:p-6 rounded-sm bg-primary/5 border border-primary/20">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-1" /></FormControl>
                  <div className="space-y-1">
                    <FormLabel className="text-xs sm:text-sm font-bold text-foreground leading-relaxed italic cursor-pointer">
                      “I, <span className="text-primary not-italic font-black underline">{userProfile?.username || user?.email}</span>, hereby undertake and confirm that the information provided above is true and accurate as of <span className="text-primary not-italic font-black underline">{format(new Date(), 'dd MMMM yyyy')}</span>.”
                    </FormLabel>
                    <div className="pt-2 flex items-center gap-2 text-[8px] sm:text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                      <UserCheck className="h-3 w-3 text-primary" />
                      Record Submitted by: {userProfile?.username || user?.email}
                    </div>
                    <FormMessage />
                  </div>
                </FormItem>
              )} />

              <div className="flex flex-col sm:flex-row justify-end gap-4 border-t pt-8">
                <Button type="button" variant="ghost" onClick={() => router.back()} className="rounded-sm font-bold uppercase text-[10px] h-12 px-8">Cancel</Button>
                <Button type="submit" disabled={isSubmitting} className="rounded-sm font-black uppercase text-xs tracking-widest h-14 px-12 shadow-xl shadow-primary/20">
                  {isSubmitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Publishing Results...</> : <><Save className="mr-2 h-4 w-4" /> Finalize Record</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
