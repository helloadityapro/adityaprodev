
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Paperclip, TriangleAlert, MapPin } from "lucide-react"
import { useFirebaseApp, useFirestore, useUser, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase"
import { collection, serverTimestamp, doc } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import imageCompression from 'browser-image-compression';
import { Skeleton } from "@/components/ui/skeleton";
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
  const [vlogFile, setVlogFile] = React.useState<File | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<{ [key: string]: number }>({});

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
    if(!selectedSite) {
        form.setError('siteName', { type: 'manual', message: 'Select a valid site.' });
        return;
    }

    setIsProcessing(true);
    const location = await getCurrentLocation();

    if (!location) {
        setIsProcessing(false);
        return;
    }

    const uploadFile = (file: File, path: string): Promise<{ url: string; contentType: string; name: string; }> => {
        return new Promise((resolve, reject) => {
            const storage = getStorage(firebaseApp);
            const storageRef = ref(storage, path);
            const uploadTask = uploadBytesResumable(storageRef, file);
            uploadTask.on('state_changed',
                (snapshot) => setUploadProgress(prev => ({ ...prev, [file.name]: (snapshot.bytesTransferred / snapshot.totalBytes) * 100 })),
                reject,
                () => getDownloadURL(uploadTask.snapshot.ref).then((url) => resolve({ url, contentType: file.type, name: file.name }))
            );
        });
    };

    try {
        const timestamp = Date.now();
        let allFilesToUpload: File[] = [...files];
        if (vlogFile) allFilesToUpload.push(new File([vlogFile], `attestation-${vlogFile.name}`, { type: vlogFile.type }));

        const processedFiles = await Promise.all(allFilesToUpload.map(async (file) => {
          if (file.type.startsWith('image/')) return imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
          return file;
        }));

        const attachments = await Promise.all(processedFiles.map(file => uploadFile(file, `uploads/${user.uid}/${timestamp}-${file.name}`)));
        const { undertaking, ...permitValues } = values;

        if (isCorrectionMode && permitIdToCorrect) {
            updateDocumentNonBlocking(doc(firestore, "permits_to_work", permitIdToCorrect), {
                ...permitValues,
                latitude: location.latitude,
                longitude: location.longitude,
                status: "Pending",
                attachments: [...(permitToCorrect.attachments || []), ...attachments],
                statusChangeDate: serverTimestamp(),
                isNew: true,
            });
        } else {
            addDocumentNonBlocking(collection(firestore, "permits_to_work"), {
              ...permitValues,
              siteEngineerId: user.uid,
              siteManagerId: userProfile.siteManagerId,
              status: "Pending",
              requestDate: serverTimestamp(),
              attachments,
              latitude: location.latitude,
              longitude: location.longitude,
              isNew: true,
            });
        }

        setIsSubmitted(true);
        setIsProcessing(false);
        toast({ title: "Success", description: "Submitted to manager." });
        setTimeout(() => router.push('/ptw/list'), 2500);
    } catch (error: any) {
        toast({ variant: "destructive", title: "Submission Failed", description: error.message });
        setIsProcessing(false);
    }
  }

  if (isProfileLoading || isLoadingPermit || ptwTypesLoading || sitesLoading) return <div className="space-y-6"><Skeleton className="h-9 w-72" /><Skeleton className="h-[600px] w-full" /></div>;

  return (
    <div className="space-y-6">
      {isCorrectionMode && permitToCorrect?.adminRemarks && (
        <Alert variant="destructive"><AlertTitle>Rejection Remarks</AlertTitle><AlertDescription>{permitToCorrect.adminRemarks}</AlertDescription></Alert>
      )}

      {!hasManagerMapping && (
        <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/20">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Action Required</AlertTitle>
          <AlertDescription>You are not mapped to any Site Manager.</AlertDescription>
        </Alert>
      )}

      <h1 className="text-2xl font-bold font-headline">Raise a Permit to Work</h1>
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>{isCorrectionMode ? "Correct PtW Request" : "New PtW Request"}</CardTitle>
          <CardDescription>Fill out the form below for approval.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
              <FormField
                  control={form.control}
                  name="siteName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site Name</FormLabel>
                       <Select onValueChange={(value) => { field.onChange(value); setSelectedSite(accessibleSites.find(s => s.name === value) || null); }} value={field.value} disabled={isProcessing || isSubmitted || !hasManagerMapping}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select a site" /></SelectTrigger></FormControl>
                          <SelectContent>{accessibleSites.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
              />
              
              {selectedSite && (
                <Card className="bg-muted/30">
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm py-4">
                    <div><p className="text-muted-foreground">Project Company</p><p className="font-medium">{selectedSite.projectCompany}</p></div>
                    <div><p className="text-muted-foreground">AC / DC Capacity</p><p className="font-medium">{selectedSite.acCapacity} / {selectedSite.dcCapacity}</p></div>
                  </CardContent>
                </Card>
              )}
              
              <FormField
                  control={form.control}
                  name="ptwType"
                  render={({ field }) => (
                      <FormItem>
                          <FormLabel>PTW for</FormLabel>
                           <Select onValueChange={field.onChange} value={field.value} disabled={isProcessing || isSubmitted}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select a permit type" /></SelectTrigger></FormControl>
                              <SelectContent>{ptwTypes?.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                          </Select>
                          <FormMessage />
                      </FormItem>
                  )}
              />

              <FormField
                  control={form.control}
                  name="descriptionOfWork"
                  render={({ field }) => (
                      <FormItem>
                          <FormLabel>Description of Work</FormLabel>
                          <FormControl><Textarea placeholder="Detail the work." rows={4} {...field} disabled={isProcessing || isSubmitted} /></FormControl>
                          <FormMessage />
                      </FormItem>
                  )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Attach Files</Label>
                    <Input type="file" multiple onChange={(e) => setFiles(prev => [...prev, ...Array.from(e.target.files || [])])} disabled={isProcessing || isSubmitted} />
                </div>
                <div className="space-y-2">
                    <Label>Self Attestation</Label>
                    <Input type="file" onChange={(e) => setVlogFile(e.target.files ? e.target.files[0] : null)} disabled={isProcessing || isSubmitted} />
                </div>
              </div>

              <FormField
                  control={form.control}
                  name="undertaking"
                  render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isProcessing || isSubmitted} /></FormControl>
                          <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm font-normal">I hereby undertake that the work will be carried out safely.</FormLabel>
                              <FormMessage />
                          </div>
                      </FormItem>
                  )}
              />

              <div className="flex justify-end mt-4">
                <Button type="submit" disabled={isProcessing || isSubmitted || !hasManagerMapping}>
                  {isSubmitted ? "Submitted" : isProcessing ? "Submitting..." : "Submit for Approval"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
