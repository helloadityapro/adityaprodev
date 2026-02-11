
'use client';

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { TriangleAlert, Loader2, CheckCircle2, Search, ChevronsUpDown, Check, FileUp } from "lucide-react"
import { useFirebaseApp, useFirestore, useUser, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase"
import { collection, serverTimestamp, doc, arrayUnion } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import imageCompression from 'browser-image-compression';
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const raisePtwSchema = z.object({
  siteName: z.string().min(1, "Site is required"),
  ptwType: z.string().min(1, "Permit type is required"),
  descriptionOfWork: z.string().min(10, "Description must be at least 10 characters"),
  commentsAndRemarks: z.string().optional(),
  undertaking: z.boolean().refine(value => value === true, {
    message: "You must agree to the undertaking to proceed."
  }),
})

type PtwType = {
  id: string;
  name: string;
};

type Site = {
  id: string;
  name: string;
  projectCompany: string;
  acCapacity: string;
  dcCapacity: string;
};

const FILE_INPUT_STYLES = "cursor-pointer h-auto py-2 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 transition-all";

export default function RaisePtwPage() {
  const firestore = useFirestore()
  const firebaseApp = useFirebaseApp()
  const { user } = useUser()
  const router = useRouter()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const permitIdToCorrect = searchParams.get('correct')
  const isCorrectionMode = !!permitIdToCorrect;

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const permitToCorrectRef = useMemoFirebase(() => {
    if (!permitIdToCorrect || !firestore) return null;
    return doc(firestore, 'permits_to_work', permitIdToCorrect);
  }, [firestore, permitIdToCorrect]);

  const { data: permitToCorrect, isLoading: isLoadingPermit } = useDoc(permitToCorrectRef);

  const ptwTypesQuery = useMemoFirebase(() => collection(firestore, 'ptw_types'), [firestore]);
  const { data: ptwTypes, isLoading: ptwTypesLoading } = useCollection<PtwType>(ptwTypesQuery);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites, isLoading: sitesLoading } = useCollection<Site>(sitesQuery);

  const accessibleSites = React.useMemo(() => {
    if (!allSites || !userProfile) return [];
    const isAdmin = userProfile.role === 'Admin' ||
      user?.email === 'abhijeet.agepl@gmail.com' ||
      user?.email === 'abhijeetsb22@gmail.com' ||
      user?.email === 'khalil@adityagreenenergy.com' ||
      user?.email === 'prafulrana143@gmail.com';

    if (isAdmin) {
      return Array.from(new Map(allSites.map(site => [site.name, site])).values());
    }
    const assignedIds = userProfile.assignedProjectIds || [];
    const filtered = allSites.filter(s => assignedIds.includes(s.id));
    return Array.from(new Map(filtered.map(site => [site.name, site])).values());
  }, [allSites, userProfile, user]);

  const [selectedSite, setSelectedSite] = React.useState<Site | null>(null);
  const [files, setFiles] = React.useState<File[]>([]);
  const [referenceDocs, setReferenceDocs] = React.useState<File[]>([]);
  const [vlogFile, setVlogFile] = React.useState<File | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<{ [key: string]: number }>({});

  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");

  const [isPtwTypePopoverOpen, setIsPtwTypePopoverOpen] = React.useState(false);
  const [ptwTypeSearchQuery, setPtwTypeSearchQuery] = React.useState("");

  const filteredAccessibleSites = React.useMemo(() => {
    return accessibleSites.filter(site => 
      site.name.toLowerCase().includes(siteSearchQuery.toLowerCase())
    );
  }, [accessibleSites, siteSearchQuery]);

  const filteredPtwTypesList = React.useMemo(() => {
    if (!ptwTypes) return [];
    return ptwTypes.filter(type => 
      type.name.toLowerCase().includes(ptwTypeSearchQuery.toLowerCase())
    );
  }, [ptwTypes, ptwTypeSearchQuery]);

  const form = useForm<z.infer<typeof raisePtwSchema>>({
    resolver: zodResolver(raisePtwSchema),
    defaultValues: {
      siteName: "",
      ptwType: "",
      descriptionOfWork: "",
      commentsAndRemarks: "",
      undertaking: false,
    },
  })

  React.useEffect(() => {
    if (isCorrectionMode && permitToCorrect && accessibleSites.length > 0) {
      form.reset({
        siteName: permitToCorrect.siteName,
        ptwType: permitToCorrect.ptwType,
        descriptionOfWork: permitToCorrect.descriptionOfWork,
        commentsAndRemarks: permitToCorrect.commentsAndRemarks || "",
        undertaking: false,
      });
      const site = accessibleSites.find(s => s.name === permitToCorrect.siteName);
      setSelectedSite(site || null);
    }
  }, [isCorrectionMode, permitToCorrect, form, accessibleSites]);

  const hasManagerMapping = !!userProfile?.siteManagerId || userProfile?.role === 'Admin';

  const getCurrentLocation = (): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        toast({ variant: 'destructive', title: 'Geolocation Not Supported' });
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        (error) => {
          toast({ variant: 'destructive', title: 'Location Error', description: 'Could not get location.' });
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const onSubmit = async (values: z.infer<typeof raisePtwSchema>) => {
    if (!user || !userProfile) return;
    if (!hasManagerMapping) {
      toast({ variant: "destructive", title: "No Manager Assigned", description: "Contact Admin for team mapping." });
      return;
    }
    if (!selectedSite) {
      form.setError('siteName', { type: 'manual', message: 'Select a valid site.' });
      return;
    }

    setIsProcessing(true);
    const location = await getCurrentLocation();

    if (!location) {
      setIsProcessing(false);
      return;
    }

    // Determine current submission index
    let currentSubmissionIndex = 1;
    if (isCorrectionMode && permitToCorrect?.attachments) {
      const indices = permitToCorrect.attachments.map((a: any) => a.submissionIndex || 1);
      currentSubmissionIndex = Math.max(...indices) + 1;
    }

    const uploadFile = (file: File, path: string): Promise<{ url: string; contentType: string; name: string; submissionIndex: number; timestamp: string }> => {
      return new Promise((resolve, reject) => {
        const storage = getStorage(firebaseApp);
        const storageRef = ref(storage, path);
        const uploadTask = uploadBytesResumable(storageRef, file);
        uploadTask.on('state_changed',
          (snapshot) => setUploadProgress(prev => ({ ...prev, [file.name]: (snapshot.bytesTransferred / snapshot.totalBytes) * 100 })),
          reject,
          () => getDownloadURL(uploadTask.snapshot.ref).then((url) => resolve({ 
            url, 
            contentType: file.type, 
            name: file.name,
            submissionIndex: currentSubmissionIndex,
            timestamp: new Date().toISOString()
          }))
        );
      });
    };

    try {
      const timestamp = Date.now();
      const serialNumber = `PTW-${timestamp}`; // Auto serial number generation

      let allFilesToUpload: File[] = [...files, ...referenceDocs];
      if (vlogFile) allFilesToUpload.push(new File([vlogFile], `attestation-${vlogFile.name}`, { type: vlogFile.type }));

      const processedFiles = await Promise.all(allFilesToUpload.map(async (file) => {
        if (file.type.startsWith('image/')) return imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
        return file;
      }));

      const newAttachments = await Promise.all(processedFiles.map(file => uploadFile(file, `uploads/${user.uid}/${timestamp}-${file.name}`)));
      const { undertaking, ...permitValues } = values;

      const timelineEntry = {
        status: "Pending",
        timestamp: new Date(),
        userId: user.uid,
        userName: userProfile.username || user.email || 'Engineer',
        remarks: permitValues.commentsAndRemarks || (isCorrectionMode ? "Permit resubmitted with corrections." : "Permit initially submitted."),
        action: isCorrectionMode ? `Resubmitted (v${currentSubmissionIndex})` : "Created"
      };

      if (isCorrectionMode && permitIdToCorrect) {
        updateDocumentNonBlocking(doc(firestore, "permits_to_work", permitIdToCorrect), {
          ...permitValues,
          latitude: location.latitude,
          longitude: location.longitude,
          status: "Pending",
          attachments: arrayUnion(...newAttachments),
          statusChangeDate: serverTimestamp(),
          timeline: arrayUnion(timelineEntry)
        });
      } else {
        addDocumentNonBlocking(collection(firestore, "permits_to_work"), {
          ...permitValues,
          serialNumber: serialNumber,
          siteEngineerId: user.uid,
          siteManagerId: userProfile.siteManagerId,
          status: "Pending",
          requestDate: serverTimestamp(),
          attachments: newAttachments,
          latitude: location.latitude,
          longitude: location.longitude,
          timeline: [timelineEntry]
        });
      }

      // Notify Site Manager
      if (userProfile.siteManagerId) {
        addDocumentNonBlocking(collection(firestore, 'notifications'), {
          userId: userProfile.siteManagerId,
          title: isCorrectionMode ? "Permit Resubmitted" : "New Permit Request",
          description: `${userProfile.username || user.email} has ${isCorrectionMode ? 'resubmitted' : 'raised'} a permit (${isCorrectionMode ? permitToCorrect?.serialNumber : serialNumber}) for "${values.siteName}".`,
          link: `/ptw/list`,
          read: false,
          createdAt: serverTimestamp(),
        });
      }

      setIsSubmitted(true);
      setIsProcessing(false);
      toast({ title: "Success", description: `Permit ${isCorrectionMode ? 'resubmitted' : 'submitted'} for review.` });
      setTimeout(() => router.push('/ptw/list'), 2000);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Submission Failed", description: error.message });
      setIsProcessing(false);
    }
  }

  if (isProfileLoading || isLoadingPermit || ptwTypesLoading || sitesLoading) return <div className="space-y-6"><Skeleton className="h-9 w-72" /><Skeleton className="h-[600px] w-full" /></div>;

  return (
    <div className="space-y-6">
      {!hasManagerMapping && (
        <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/20">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Action Required</AlertTitle>
          <AlertDescription>You are not assigned to any Site Manager. Please contact Admin before raising a permit.</AlertDescription>
        </Alert>
      )}

      {isCorrectionMode && permitToCorrect && (
        <Alert className="bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Correction Mode</AlertTitle>
          <AlertDescription>
            You are editing a rejected permit (<strong>{permitToCorrect.serialNumber}</strong>) for <strong>{permitToCorrect.siteName}</strong>.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">{isCorrectionMode ? "Correct PtW Request" : "Raise a Permit to Work"}</h1>
        <p className="text-muted-foreground">Complete the form below to initiate the approval lifecycle.</p>
      </div>

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Permit Details</CardTitle>
          <CardDescription>All fields are required for safety and compliance.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <FormField
                  control={form.control}
                  name="siteName"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Site Name</FormLabel>
                      <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              disabled={isProcessing || isSubmitted || !hasManagerMapping || isCorrectionMode}
                            >
                              {field.value
                                ? accessibleSites.find((site) => site.name === field.value)?.name
                                : "Select a site..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <div className="flex items-center border-b px-3">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <Input
                              placeholder="Search sites..."
                              className="h-9 w-full border-none focus-visible:ring-0 px-0"
                              value={siteSearchQuery}
                              onChange={(e) => setSiteSearchQuery(e.target.value)}
                            />
                          </div>
                          <ScrollArea className="h-[200px]">
                            <div className="p-1">
                              {filteredAccessibleSites.length > 0 ? (
                                filteredAccessibleSites.map((site) => (
                                  <Button
                                    key={site.id}
                                    variant="ghost"
                                    className="w-full justify-start font-normal"
                                    onClick={() => {
                                      field.onChange(site.name);
                                      setSelectedSite(site);
                                      setIsSitePopoverOpen(false);
                                      setSiteSearchQuery("");
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        site.name === field.value ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {site.name}
                                  </Button>
                                ))
                              ) : (
                                <p className="p-4 text-center text-sm text-muted-foreground">No site found.</p>
                              )}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ptwType"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>PTW Type</FormLabel>
                      <Popover open={isPtwTypePopoverOpen} onOpenChange={setIsPtwTypePopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              disabled={isProcessing || isSubmitted}
                            >
                              {field.value
                                ? ptwTypes?.find((type) => type.name === field.value)?.name
                                : "Select a type..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <div className="flex items-center border-b px-3">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <Input
                              placeholder="Search types..."
                              className="h-9 w-full border-none focus-visible:ring-0 px-0"
                              value={ptwTypeSearchQuery}
                              onChange={(e) => setPtwTypeSearchQuery(e.target.value)}
                            />
                          </div>
                          <ScrollArea className="h-[200px]">
                            <div className="p-1">
                              {filteredPtwTypesList.length > 0 ? (
                                filteredPtwTypesList.map((type) => (
                                  <Button
                                    key={type.id}
                                    variant="ghost"
                                    className="w-full justify-start font-normal"
                                    onClick={() => {
                                      field.onChange(type.name);
                                      setIsPtwTypePopoverOpen(false);
                                      setPtwTypeSearchQuery("");
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        type.name === field.value ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {type.name}
                                  </Button>
                                ))
                              ) : (
                                <p className="p-4 text-center text-sm text-muted-foreground">No type found.</p>
                              )}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {selectedSite && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg border text-sm">
                  <div><p className="text-muted-foreground mb-1 uppercase text-[10px] font-bold">Company</p><p className="font-semibold">{selectedSite.projectCompany}</p></div>
                  <div><p className="text-muted-foreground mb-1 uppercase text-[10px] font-bold">AC Capacity</p><p className="font-semibold">{selectedSite.acCapacity}</p></div>
                  <div><p className="text-muted-foreground mb-1 uppercase text-[10px] font-bold">DC Capacity</p><p className="font-semibold">{selectedSite.dcCapacity}</p></div>
                </div>
              )}

              <FormField
                control={form.control}
                name="descriptionOfWork"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description of Work</FormLabel>
                    <FormControl><Textarea placeholder="Describe exactly what work will be performed, including safety precautions." rows={5} {...field} disabled={isProcessing || isSubmitted} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="flex items-center gap-2"><FileUp className="h-4 w-4 text-primary" /> Reference Documents</Label>
                  <div className="flex flex-col gap-2">
                    <Input 
                      type="file" 
                      multiple 
                      onChange={(e) => setReferenceDocs(prev => [...prev, ...Array.from(e.target.files || [])])} 
                      disabled={isProcessing || isSubmitted} 
                      className={FILE_INPUT_STYLES}
                    />
                    <p className="text-[10px] text-muted-foreground">Attach PDFs, drawings, or safety manuals.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2"><FileUp className="h-4 w-4 text-primary" /> Additional Attachments</Label>
                    <div className="flex flex-col gap-2">
                      <Input 
                        type="file" 
                        multiple 
                        onChange={(e) => setFiles(prev => [...prev, ...Array.from(e.target.files || [])])} 
                        disabled={isProcessing || isSubmitted} 
                        className={FILE_INPUT_STYLES}
                      />
                      <p className="text-[10px] text-muted-foreground">Attach images or videos of the site.</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2"><FileUp className="h-4 w-4 text-primary" /> Self Attestation (Vlog)</Label>
                    <div className="flex flex-col gap-2">
                      <Input 
                        type="file" 
                        accept="video/*"
                        onChange={(e) => setVlogFile(e.target.files ? e.target.files[0] : null)} 
                        disabled={isProcessing || isSubmitted} 
                        className={FILE_INPUT_STYLES}
                      />
                      <p className="text-[10px] text-muted-foreground">A short video explaining safety measures.</p>
                    </div>
                  </div>
                </div>
              </div>

              <FormField
                control={form.control}
                name="undertaking"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border p-5 shadow-sm bg-primary/5 border-primary/20">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isProcessing || isSubmitted} /></FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm font-semibold text-primary">Safety Undertaking</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        I, <strong>{userProfile?.username || user?.email || 'the undersigned'}</strong>, hereby undertake that the work will be carried out safely as per company SOPs and PPE will be used at all times.
                      </p>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between pt-4 border-t">
                <Button type="button" variant="ghost" onClick={() => router.push('/ptw/list')} disabled={isProcessing || isSubmitted}>Cancel</Button>
                <Button type="submit" size="lg" disabled={isProcessing || isSubmitted || !hasManagerMapping} className="min-w-[200px]">
                  {isProcessing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                  ) : isSubmitted ? (
                    <><CheckCircle2 className="mr-2 h-4 w-4" /> Submitted</>
                  ) : (
                    isCorrectionMode ? "Update & Resubmit" : "Submit for Approval"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
