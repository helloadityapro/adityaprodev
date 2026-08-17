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
  useFirebaseApp,
  updateDocumentNonBlocking
} from '@/firebase';
import { collection, doc, serverTimestamp, increment, query, where, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { 
  GlassWater, 
  Building2, 
  Loader2, 
  Search, 
  Check, 
  ChevronsUpDown, 
  Camera, 
  Save, 
  X,
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  Sun
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import imageCompression from 'browser-image-compression';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

const breakageSchema = z.object({
  siteId: z.string().min(1, 'Site selection is required.'),
  siteName: z.string(),
  serialNumber: z.string().min(1, 'Module Serial Number is required.'),
  moduleMake: z.string().min(1, 'Module Make is required.'),
  breakageReason: z.string().min(1, "Please select a reason for breakage."),
  otherReason: z.string().optional(),
  idPhotoFile: z.any().refine((files) => files?.length > 0, "Module ID Sticker photo is required."),
  sunnySidePhotoFile: z.any().refine((files) => files?.length > 0, "Sunny side photo with all corners visible is required."),
}).refine(data => {
  if (data.breakageReason === "Other" && (!data.otherReason || data.otherReason.trim() === "")) {
    return false;
  }
  return true;
}, {
  message: "Please specify the other reason.",
  path: ["otherReason"]
});

type Site = { id: string; name: string; moduleBreakageCount?: number };

export default function ModuleBreakagePage() {
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [idPhotoPreview, setIdPhotoPreview] = React.useState<string | null>(null);
  const [sunnySidePhotoPreview, setSunnySidePhotoPreview] = React.useState<string | null>(null);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const assignedSites = React.useMemo(() => {
    if (!allSites || !userProfile) return [];
    const assignedIds = new Set(userProfile.assignedProjectIds || []);
    return allSites.filter(s => assignedIds.has(s.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [allSites, userProfile]);

  const form = useForm<z.infer<typeof breakageSchema>>({
    resolver: zodResolver(breakageSchema),
    defaultValues: {
      siteId: "",
      siteName: "",
      serialNumber: "",
      moduleMake: "",
      breakageReason: "",
      otherReason: "",
    },
  });

  const watchSiteId = form.watch('siteId');
  const watchReason = form.watch('breakageReason');
  const selectedSiteData = React.useMemo(() => assignedSites.find(s => s.id === watchSiteId), [assignedSites, watchSiteId]);

  const handleIdPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIdPhotoPreview(URL.createObjectURL(file));
      form.setValue('idPhotoFile', e.target.files);
    }
  };

  const handleSunnySidePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSunnySidePhotoPreview(URL.createObjectURL(file));
      form.setValue('sunnySidePhotoFile', e.target.files);
    }
  };

  const uploadFile = async (file: File, path: string): Promise<string> => {
    let blob: Blob = file;
    if (file.type.startsWith('image/')) {
      try {
        blob = await imageCompression(file, { maxSizeMB: 0.8, maxWidthOrHeight: 1920 });
      } catch (e) {
        console.warn("Compression skipped", e);
      }
    }
    const storage = getStorage(firebaseApp);
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, blob);
    
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed', null, reject, () => {
        getDownloadURL(uploadTask.snapshot.ref).then(resolve);
      });
    });
  };

  const onSubmit = async (values: z.infer<typeof breakageSchema>) => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);

    try {
      const timestamp = Date.now();
      
      const idFile = values.idPhotoFile[0];
      const idPath = `module_breakages/${user.uid}/${timestamp}_id_${idFile.name.replace(/\s+/g, '_')}`;
      const idPhotoUrl = await uploadFile(idFile, idPath);

      const sunnyFile = values.sunnySidePhotoFile[0];
      const sunnyPath = `module_breakages/${user.uid}/${timestamp}_sunny_${sunnyFile.name.replace(/\s+/g, '_')}`;
      const sunnySidePhotoUrl = await uploadFile(sunnyFile, sunnyPath);

      const finalReason = values.breakageReason === "Other" ? values.otherReason : values.breakageReason;

      // Save record
      await addDocumentNonBlocking(collection(firestore, 'module_breakages'), {
        siteId: values.siteId,
        siteName: values.siteName,
        serialNumber: values.serialNumber,
        moduleMake: values.moduleMake,
        photoUrl: idPhotoUrl,
        idPhotoUrl: idPhotoUrl,
        sunnySidePhotoUrl: sunnySidePhotoUrl,
        breakageReason: finalReason,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdByName: userProfile.username || user.email,
      });

      // Atomic increment
      const siteRef = doc(firestore, 'sites', values.siteId);
      updateDocumentNonBlocking(siteRef, {
        moduleBreakageCount: increment(1)
      });

      setIsSuccess(true);
      toast({ title: "Report Logged", description: "Module breakage has been recorded and counter updated." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Submission Failed", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isProfileLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="max-w-md w-full animate-in fade-in zoom-in-95 duration-500 rounded-sm shadow-2xl border-emerald-500/20">
          <CardHeader className="text-center pt-8">
            <div className="flex justify-center mb-6">
              <div className="bg-emerald-500/10 p-6 rounded-full">
                <CheckCircle2 className="h-16 w-16 text-emerald-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black uppercase tracking-tight text-emerald-900">Breakage Recorded</CardTitle>
            <CardDescription className="text-base font-medium text-emerald-800/70 mt-2">
              Module <strong>{form.getValues('serialNumber')}</strong> has been added to the damage registry.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pb-8 px-8">
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-sm text-center">
               <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-1">New Site Total</p>
               <p className="text-3xl font-black text-emerald-900">{(selectedSiteData?.moduleBreakageCount || 0) + 1}</p>
            </div>
            <Button className="w-full h-12 text-sm font-black uppercase bg-emerald-600 shadow-lg" onClick={() => { setIsSuccess(false); form.reset(); setIdPhotoPreview(null); setSunnySidePhotoPreview(null); }}>
              Log Another Module
            </Button>
            <Button variant="ghost" className="w-full h-10 text-[10px] font-black uppercase" onClick={() => router.push('/dashboard')}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto pb-20 px-2 sm:px-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
          <GlassWater className="h-7 w-7" /> Module Breakage Data
        </h1>
        <p className="text-muted-foreground font-medium text-sm">Register damage reports for solar modules with mandatory photo evidence.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card className="rounded-sm shadow-md border-primary/10">
            <CardHeader className="bg-primary/5 border-b py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" /> Project Context
                </CardTitle>
                {selectedSiteData && (
                  <Badge variant="outline" className="rounded-sm bg-background font-black text-[10px] uppercase border-primary/20 text-primary">
                    Total Breakages: {selectedSiteData.moduleBreakageCount || 0}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <FormField control={form.control} name="siteId" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Select Assigned Project *</FormLabel>
                  <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal h-11 rounded-sm text-left", !field.value && "text-muted-foreground")}>
                          {field.value ? assignedSites.find(s => s.id === field.value)?.name : "Choose site..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <div className="flex items-center border-b px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Input placeholder="Search assigned sites..." className="h-10 w-full border-none focus-visible:ring-0 px-0 text-sm" value={siteSearchQuery} onChange={e => setSiteSearchQuery(e.target.value)} />
                      </div>
                      <ScrollArea className="h-[200px]">
                        <div className="p-1">
                          {assignedSites.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase())).map(site => (
                            <Button key={site.id} type="button" variant="ghost" className="w-full justify-start h-10 text-xs" onClick={() => { 
                              field.onChange(site.id); 
                              form.setValue('siteName', site.name); 
                              setIsSitePopoverOpen(false); 
                            }}>
                              <Check className={cn("mr-2 h-4 w-4 text-primary", field.value === site.id ? "opacity-100" : "opacity-0")} />
                              {site.name}
                            </Button>
                          ))}
                          {assignedSites.length === 0 && (
                            <div className="p-4 text-center text-xs text-muted-foreground italic">No projects assigned to your account.</div>
                          )}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="rounded-sm shadow-md border-primary/10">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest">Module Specifications</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="serialNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Module Serial Number *</FormLabel>
                    <FormControl><Input placeholder="Enter unique ID..." {...field} className="h-11 rounded-sm font-mono font-bold" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="moduleMake" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Manufacturer / Make *</FormLabel>
                    <FormControl><Input placeholder="e.g. Adani, Waaree..." {...field} className="h-11 rounded-sm uppercase font-bold" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="space-y-4">
                <FormField control={form.control} name="breakageReason" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reason of Breakage *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11 rounded-sm font-medium">
                          <SelectValue placeholder="Select exact reason..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Already breakage from the Pallet." className="text-sm">Already breakage from the Pallet.</SelectItem>
                        <SelectItem value="Handling Breakage from vendor ." className="text-sm">Handling Breakage from vendor .</SelectItem>
                        <SelectItem value="Other" className="text-sm font-bold text-primary">Other (Specify Below)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {watchReason === "Other" && (
                  <FormField control={form.control} name="otherReason" render={({ field }) => (
                    <FormItem className="animate-in slide-in-from-top-2 duration-300">
                      <FormLabel className="text-[10px] font-black uppercase text-primary tracking-widest px-1">Other Specification *</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Explain custom reason..." {...field} className="rounded-sm bg-primary/[0.02] border-primary/20 min-h-[100px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-sm shadow-md border-primary/10">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Camera className="h-4 w-4 text-primary" /> Visual Documentation
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-8">
              <FormField control={form.control} name="idPhotoFile" render={() => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Module ID Sticker Photo *</FormLabel>
                  <FormControl>
                    <div className="space-y-4">
                      <div className="flex flex-col items-center justify-center w-full">
                        <label className={cn(
                          "flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-sm cursor-pointer transition-all bg-muted/5",
                          idPhotoPreview ? "border-primary/50" : "border-primary/20 hover:bg-primary/5"
                        )}>
                          {idPhotoPreview ? (
                            <div className="relative w-full h-full p-2">
                               <img src={idPhotoPreview} className="w-full h-full object-contain rounded-sm" alt="ID Sticker Preview" />
                               <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity rounded-sm">
                                  <Badge className="bg-white text-black font-black text-[10px] uppercase">Click to Retake</Badge>
                               </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <ImagePlus className="w-8 h-8 mb-2 text-primary/40" />
                              <p className="mb-1 text-xs font-bold text-foreground">Tap to Capture ID Sticker</p>
                              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Mandatory Evidence</p>
                            </div>
                          )}
                          <input 
                            type="file" 
                            accept="image/*" 
                            capture="environment" 
                            className="hidden" 
                            onChange={handleIdPhotoChange} 
                          />
                        </label>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="sunnySidePhotoFile" render={() => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sunny Side of the Module (All Corners Visible) *</FormLabel>
                  <FormControl>
                    <div className="space-y-4">
                      <div className="flex flex-col items-center justify-center w-full">
                        <label className={cn(
                          "flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-sm cursor-pointer transition-all bg-muted/5",
                          sunnySidePhotoPreview ? "border-primary/50" : "border-primary/20 hover:bg-primary/5"
                        )}>
                          {sunnySidePhotoPreview ? (
                            <div className="relative w-full h-full p-2">
                               <img src={sunnySidePhotoPreview} className="w-full h-full object-contain rounded-sm" alt="Sunny Side Preview" />
                               <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity rounded-sm">
                                  <Badge className="bg-white text-black font-black text-[10px] uppercase">Click to Retake</Badge>
                               </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <Sun className="w-8 h-8 mb-2 text-primary/40" />
                              <p className="mb-1 text-xs font-bold text-foreground">Tap to Capture Sunny Side</p>
                              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Mandatory Evidence</p>
                            </div>
                          )}
                          <input 
                            type="file" 
                            accept="image/*" 
                            capture="environment" 
                            className="hidden" 
                            onChange={handleSunnySidePhotoChange} 
                          />
                        </label>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting || !watchSiteId} className="w-full sm:w-auto min-w-[240px] h-14 text-base font-black uppercase tracking-widest shadow-xl shadow-primary/20">
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Finalizing Report...</>
              ) : (
                <><Save className="mr-2 h-4 w-4" /> Submit Breakage Data</>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
