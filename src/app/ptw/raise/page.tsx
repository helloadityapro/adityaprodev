"use client";

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
import { TriangleAlert, Loader2, Search, ChevronsUpDown, Check, FileUp, MessageCircle, CheckCircle2 } from "lucide-react"
import { useFirebaseApp, useFirestore, useUser, useDoc, useMemoFirebase, useCollection, setDocumentNonBlocking, updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase"
import { collection, serverTimestamp, doc, arrayUnion, getDoc, query, where, getDocs, Timestamp, runTransaction } from "firebase/firestore"
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
import { format } from "date-fns";
import { isSuperAdmin } from "@/lib/auth-constants";

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
  acCapacity: any;
  dcCapacity: any;
};

const formatCapacity = (val: any) => {
  const num = typeof val === 'number' ? val : parseFloat(String(val || 0));
  return isNaN(num) ? "0.000" : num.toFixed(3);
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

  const isAdmin = React.useMemo(() => isSuperAdmin(user?.email) || userProfile?.role === 'Admin', [user, userProfile]);
  
  const accessibleSites = React.useMemo(() => {
    if (!allSites || !userProfile) return [];
    if (isAdmin) {
      return Array.from(new Map(allSites.map(site => [site.name, site])).values());
    }
    const assignedIds = userProfile.assignedProjectIds || [];
    const filtered = allSites.filter(s => assignedIds.includes(s.id));
    return Array.from(new Map(filtered.map(site => [site.name, site])).values());
  }, [allSites, userProfile, isAdmin]);

  const [selectedSite, setSelectedSite] = React.useState<Site | null>(null);
  const [files, setFiles] = React.useState<File[]>([]);
  const [referenceDocs, setReferenceDocs] = React.useState<File[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [submittedPermit, setSubmittedPermit] = React.useState<{id: string, serialNumber: string, siteName: string, managerMobile?: string} | null>(null);

  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  const [isPtwTypePopoverOpen, setIsPtwTypePopoverOpen] = React.useState(false);
  const [ptwTypeSearchQuery, setPtwTypeSearchQuery] = React.useState("");

  const filteredAccessibleSites = React.useMemo(() => {
    return accessibleSites.filter(site => site.name.toLowerCase().includes(siteSearchQuery.toLowerCase()));
  }, [accessibleSites, siteSearchQuery]);

  const filteredPtwTypesList = React.useMemo(() => {
    if (!ptwTypes) return [];
    return ptwTypes.filter(type => type.name.toLowerCase().includes(ptwTypeSearchQuery.toLowerCase()));
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

  const canRaisePermit = userProfile?.role === 'Site Manager' || userProfile?.role === 'Admin' || !!userProfile?.siteManagerId;

  const getCurrentLocation = (): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        toast({ variant: 'destructive', title: 'Geolocation Not Supported' });
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        () => {
          toast({ variant: 'destructive', title: 'Location Error', description: 'Could not get location.' });
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const triggerWhatsApp = (serial: string, site: string, permitId: string, mobile?: string) => {
    if (!mobile) {
      toast({ variant: 'destructive', title: 'No Mobile', description: 'No mobile number found for notification.' });
      return;
    }
    const cleanMobile = mobile.replace(/\D/g, '');
    const formattedMobile = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;
    const message = `Hello, I've resubmitted the PtW request.\nSerial: ${serial}\nSite: ${site}\nLink: ${window.location.origin}/ptw/list?view=${permitId}`;
    const url = `https://wa.me/${formattedMobile}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const onSubmit = async (values: z.infer<typeof raisePtwSchema>) => {
    if (!user || !userProfile) return;
    if (!canRaisePermit) {
      toast({ variant: "destructive", title: "Supervisor Mapping Required", description: "Contact Admin for supervisor assignment." });
      return;
    }
    if (!selectedSite) {
      form.setError('siteName', { type: 'manual', message: 'Please select a valid site from the dropdown.' });
      return;
    }

    setIsProcessing(true);
    const location = await getCurrentLocation();
    if (!location) {
      setIsProcessing(false);
      return;
    }

    try {
      let serialNumber = "";
      if (isCorrectionMode && permitToCorrect) {
        serialNumber = permitToCorrect.serialNumber;
      } else {
        serialNumber = await runTransaction(firestore, async (transaction) => {
          const counterRef = doc(firestore, 'system_settings', 'counters');
          const counterSnap = await transaction.get(counterRef);
          let nextNum = 1;
          if (counterSnap.exists()) {
            nextNum = (counterSnap.data().lastPtwNumber || 0) + 1;
          }
          transaction.set(counterRef, { lastPtwNumber: nextNum }, { merge: true });
          
          const now = new Date();
          const dateStr = format(now, 'yyyy/MM/dd');
          return `AGEPL/PtW/${dateStr}/${nextNum}`;
        });
      }

      const permitRef = isCorrectionMode && permitIdToCorrect 
        ? doc(firestore, "permits_to_work", permitIdToCorrect)
        : doc(collection(firestore, "permits_to_work"));
      
      const permitId = permitRef.id;
      
      const maxExistingIndex = isCorrectionMode && permitToCorrect?.attachments 
        ? Math.max(0, ...(permitToCorrect.attachments.map(a => (a as any).submissionIndex || 0)))
        : 0;
      const currentSubmissionIndex = maxExistingIndex + 1;

      const uploadFile = (file: File, storagePath: string): Promise<any> => {
        return new Promise((resolve, reject) => {
          const storage = getStorage(firebaseApp);
          const storageRef = ref(storage, storagePath);
          const uploadTask = uploadBytesResumable(storageRef, file);
          uploadTask.on('state_changed', 
            null, 
            (error) => {
              console.error("Storage Error:", error);
              reject(error);
            }, 
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

      const timestamp = Date.now();
      let allFilesToUpload: File[] = [...files, ...referenceDocs];

      const processedFiles = await Promise.all(allFilesToUpload.map(async (file) => {
        if (file.type.startsWith('image/')) return imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
        return file;
      }));

      const newAttachments = await Promise.all(processedFiles.map(file => {
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `uploads/${user.uid}/${timestamp}-${safeName}`;
        return uploadFile(file, filePath);
      }));
      
      const isEngineerRole = userProfile.role === 'Site Engineer';
      const targetStatus = isEngineerRole ? "Pending" : "ManagerApproved";

      const timelineEntry = {
        status: targetStatus,
        timestamp: new Date(),
        userId: user.uid,
        userName: userProfile.username || user.email || 'User',
        userRole: userProfile.role,
        remarks: values.commentsAndRemarks || (isCorrectionMode ? "Permit resubmitted with corrections." : "Initial permit creation."),
        action: isCorrectionMode ? "Resubmitted" : "Created",
        submissionIndex: currentSubmissionIndex
      };

      const effectiveSiteManagerId = userProfile.siteManagerId || (isCorrectionMode ? permitToCorrect?.siteManagerId : null) || null;

      const permitData: any = {
        siteName: values.siteName,
        ptwType: values.ptwType,
        descriptionOfWork: values.descriptionOfWork,
        commentsAndRemarks: values.commentsAndRemarks || "",
        latitude: location.latitude,
        longitude: location.longitude,
        status: targetStatus,
        statusChangeDate: serverTimestamp(),
        siteManagerId: effectiveSiteManagerId,
      };

      let managerMobile = "";
      if (effectiveSiteManagerId) {
        const managerDoc = await getDoc(doc(firestore, 'users', effectiveSiteManagerId));
        if (managerDoc.exists()) {
          managerMobile = managerDoc.data().mobile;
          
          if (targetStatus === 'Pending') {
            addDocumentNonBlocking(collection(firestore, 'notifications'), {
                userId: effectiveSiteManagerId,
                title: isCorrectionMode ? "Permit Resubmitted" : "New Permit Request",
                description: `${userProfile.username} ${isCorrectionMode ? 'resubmitted' : 'raised'} a permit (${serialNumber}) for "${values.siteName}". Please review.`,
                link: `/ptw/list?view=${permitId}`,
                read: false,
                createdAt: serverTimestamp(),
            });
          }
        }
      }

      const adminsQuery = query(collection(firestore, 'users'), where('email', '==', 'khalil@adityagreenenergy.com'));
      getDocs(adminsQuery).then(snapshot => {
        snapshot.forEach(adminDoc => {
          if (adminDoc.id === user.uid) return;
          
          addDocumentNonBlocking(collection(firestore, 'notifications'), {
            userId: adminDoc.id,
            title: isCorrectionMode ? "Permit Resubmitted" : "New Permit Request",
            description: `Permit ${serialNumber} ("${values.siteName}") has been ${isCorrectionMode ? 'resubmitted' : 'raised'} and is now ${targetStatus}.`,
            link: `/ptw/list?view=${permitId}`,
            read: false,
            createdAt: serverTimestamp(),
          });
        });
      });

      if (isCorrectionMode) {
        permitData.attachments = arrayUnion(...newAttachments);
        permitData.timeline = arrayUnion(timelineEntry);
        updateDocumentNonBlocking(permitRef, permitData);
      } else {
        permitData.id = permitId;
        permitData.serialNumber = serialNumber;
        permitData.siteEngineerId = user.uid;
        permitData.siteEngineerName = userProfile.username || user.email || 'User';
        permitData.requestDate = serverTimestamp();
        permitData.attachments = newAttachments;
        permitData.timeline = [timelineEntry];
        setDocumentNonBlocking(permitRef, permitData, { merge: true });
      }

      setSubmittedPermit({
        id: permitId,
        serialNumber,
        siteName: values.siteName,
        managerMobile: managerMobile
      });
      setIsSubmitted(true);
      setIsProcessing(false);
      toast({ title: "Submission Success", description: `Permit ${serialNumber} is now ${targetStatus}.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Submission Failed", description: error.message });
      setIsProcessing(false);
    }
  }

  if (isProfileLoading || isLoadingPermit || ptwTypesLoading || sitesLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (isSubmitted && submittedPermit) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full animate-in fade-in zoom-in-95 duration-300">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-primary/10 p-4 rounded-full">
                <CheckCircle2 className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Submission Successful</CardTitle>
            <CardDescription className="text-base">
              Permit <span className="font-mono font-bold text-primary">{submittedPermit.serialNumber}</span> has been raised and is pending review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg font-semibold" 
              onClick={() => triggerWhatsApp(submittedPermit.serialNumber, submittedPermit.siteName, submittedPermit.id, submittedPermit.managerMobile)}
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              Notify Manager on WhatsApp
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-11" onClick={() => router.push('/ptw/list')}>
                View Dashboard
              </Button>
              <Button variant="secondary" className="h-11" onClick={() => {
                setIsSubmitted(false);
                setSubmittedPermit(null);
                form.reset();
                setSelectedSite(null);
                setFiles([]);
                setReferenceDocs([]);
              }}>
                Raise Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!canRaisePermit && userProfile?.role === 'Site Engineer' && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Action Required</AlertTitle>
          <AlertDescription>Please contact Admin to assign a Site Manager to your account before raising a permit.</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">{isCorrectionMode ? "Resubmit PtW Request" : "Raise a Permit to Work"}</h1>
        <p className="text-muted-foreground">Detailed site documentation is required for approval.</p>
      </div>

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Permit Details</CardTitle>
          <CardDescription>All fields are mandatory for safety compliance.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="siteName" render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>Site Name</FormLabel>
                    <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal", !field.value && "text-muted-foreground")} disabled={isProcessing || isSubmitted || isCorrectionMode}>
                            {field.value || "Select a site..."}
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
                            onKeyDown={(e) => e.stopPropagation()}
                          />
                        </div>
                        <ScrollArea className="h-[200px]">
                          {filteredAccessibleSites.length > 0 ? filteredAccessibleSites.map((site) => (
                            <Button 
                              key={site.id} 
                              type="button"
                              variant="ghost" 
                              className="w-full justify-start font-normal text-left" 
                              onClick={() => { field.onChange(site.name); setSelectedSite(site); setIsSitePopoverOpen(false); }}
                            >
                              <Check className={cn("mr-2 h-4 w-4 shrink-0", site.name === field.value ? "opacity-100" : "opacity-0")} />
                              <span className="truncate">{site.name}</span>
                            </Button>
                          )) : (
                            <div className="p-4 text-center text-sm text-muted-foreground">No authorized sites found.</div>
                          )}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="ptwType" render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>PTW Type</FormLabel>
                    <Popover open={isPtwTypePopoverOpen} onOpenChange={setIsPtwTypePopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal", !field.value && "text-muted-foreground")} disabled={isProcessing || isSubmitted}>
                            {field.value || "Select a type..."}
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
                            onKeyDown={(e) => e.stopPropagation()}
                          />
                        </div>
                        <ScrollArea className="h-[200px]">
                          {filteredPtwTypesList.map((type) => (
                            <Button 
                              key={type.id} 
                              type="button" 
                              variant="ghost" 
                              className="w-full justify-start font-normal text-left" 
                              onClick={() => { field.onChange(type.name); setIsPtwTypePopoverOpen(false); }}
                            >
                              <Check className={cn("mr-2 h-4 w-4 shrink-0", type.name === field.value ? "opacity-100" : "opacity-0")} />
                              <span className="truncate">{type.name}</span>
                            </Button>
                          ))}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {selectedSite && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg border text-sm">
                  <div><p className="text-muted-foreground mb-1 uppercase text-[10px] font-bold">Company</p><p className="font-semibold">{selectedSite.projectCompany}</p></div>
                  <div><p className="text-muted-foreground mb-1 uppercase text-[10px] font-bold">AC Capacity (MW)</p><p className="font-semibold">{formatCapacity(selectedSite.acCapacity)}</p></div>
                  <div><p className="text-muted-foreground mb-1 uppercase text-[10px] font-bold">DC Capacity (MWp)</p><p className="font-semibold">{formatCapacity(selectedSite.dcCapacity)}</p></div>
                </div>
              )}

              <FormField control={form.control} name="descriptionOfWork" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description of Work</FormLabel>
                  <FormControl><Textarea placeholder="Explain exactly what tasks will be performed..." rows={5} {...field} disabled={isProcessing || isSubmitted} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 font-semibold"><FileUp className="h-4 w-4 text-primary" /> Reference documents</Label>
                  <Input type="file" multiple onChange={(e) => setReferenceDocs(prev => [...prev, ...Array.from(e.target.files || [])])} disabled={isProcessing || isSubmitted} className={FILE_INPUT_STYLES} />
                </div>
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 font-semibold"><FileUp className="h-4 w-4 text-primary" /> Work related files</Label>
                  <Input type="file" multiple onChange={(e) => setFiles(prev => [...prev, ...Array.from(e.target.files || [])])} disabled={isProcessing || isSubmitted} className={FILE_INPUT_STYLES} />
                </div>
              </div>

              <FormField control={form.control} name="undertaking" render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border p-5 bg-primary/5 border-primary/20 shadow-sm">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isProcessing || isSubmitted} /></FormControl>
                  <div className="space-y-1">
                    <FormLabel className="text-sm font-bold text-primary uppercase">Safety Undertaking</FormLabel>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      I, <strong className="text-primary font-bold">{userProfile?.username || 'user'}</strong>, hereby undertake that the work will be carried out safely as per company SOPs and PPE will be used at all times.
                    </p>
                    <FormMessage />
                  </div>
                </FormItem>
              )} />

              <div className="flex items-center justify-between pt-4 border-t">
                <Button type="button" variant="ghost" onClick={() => router.push('/ptw/list')} disabled={isProcessing || isSubmitted}>Cancel</Button>
                <Button type="submit" size="lg" disabled={isProcessing || isSubmitted || (!canRaisePermit && userProfile?.role === 'Site Engineer')} className="min-w-[200px]">
                  {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : isSubmitted ? "Submitted" : "Submit for Approval"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
