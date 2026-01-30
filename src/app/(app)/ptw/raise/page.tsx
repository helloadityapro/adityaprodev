
"use client"

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
import { FileVideo, Video } from "lucide-react"
import { useFirebaseApp, useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from "@/firebase"
import { addDoc, collection, serverTimestamp, doc, updateDoc } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import imageCompression from 'browser-image-compression';
import { Skeleton } from "@/components/ui/skeleton";

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


function RaisePtwSkeleton() {
    return (
        <div className="animate-pulse">
            <Skeleton className="h-9 w-72 mb-6" />
            <Card className="w-full max-w-3xl mx-auto">
                <CardHeader>
                    <Skeleton className="h-8 w-56" />
                    <Skeleton className="h-4 w-full max-w-sm mt-1" />
                </CardHeader>
                <CardContent className="grid gap-6">
                    <div className="grid gap-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="grid gap-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="grid gap-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="grid gap-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-20 w-full" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <div className="grid gap-2">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-20 w-full" />
                    </div>
                    <Skeleton className="h-24 w-full rounded-md" />
                    <div className="flex justify-end">
                        <Skeleton className="h-10 w-32" />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}


export default function RaisePtwPage() {
  const firestore = useFirestore()
  const firebaseApp = useFirebaseApp()
  const { user } = useUser()
  const router = useRouter()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const permitIdToCorrect = searchParams.get('correct')
  const isCorrectionMode = !!permitIdToCorrect;

  const permitToCorrectRef = useMemoFirebase(() => {
    if (!permitIdToCorrect || !firestore) return null;
    return doc(firestore, 'permits_to_work', permitIdToCorrect);
  }, [firestore, permitIdToCorrect]);

  const { data: permitToCorrect, isLoading: isLoadingPermit } = useDoc(permitToCorrectRef);

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const ptwTypesQuery = useMemoFirebase(() => collection(firestore, 'ptw_types'), [firestore]);
  const { data: ptwTypes, isLoading: ptwTypesLoading } = useCollection<PtwType>(ptwTypesQuery);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites, isLoading: sitesLoading } = useCollection<Site>(sitesQuery);
  
  const uniqueSites = React.useMemo(() => {
    if (!allSites) return [];
    return Array.from(new Map(allSites.map(site => [site.name, site])).values());
  }, [allSites]);

  const [selectedSite, setSelectedSite] = React.useState<Site | null>(null);
  
  const [files, setFiles] = React.useState<File[]>([]);
  const [vlogFile, setVlogFile] = React.useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
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
    if (isCorrectionMode && permitToCorrect && uniqueSites && uniqueSites.length > 0) {
      form.reset({
        siteName: permitToCorrect.siteName,
        ptwType: permitToCorrect.ptwType,
        descriptionOfWork: permitToCorrect.descriptionOfWork,
        commentsAndRemarks: permitToCorrect.commentsAndRemarks || "",
        undertaking: false, // Force re-agreement
      });
      const site = uniqueSites.find(s => s.name === permitToCorrect.siteName);
      setSelectedSite(site || null);
    }
  }, [isCorrectionMode, permitToCorrect, form, uniqueSites]);


  const onSubmit = async (values: z.infer<typeof raisePtwSchema>) => {
    if (!user) {
        toast({ variant: "destructive", title: "You must be logged in to submit a permit." });
        return;
    }
    if(!selectedSite) {
        form.setError('siteName', { type: 'manual', message: 'Please select a valid site from the list.' });
        return;
    }

    setIsSubmitting(true);
    setUploadProgress({});

    const uploadFile = (file: File, path: string): Promise<{ url: string; contentType: string; name: string; }> => {
        return new Promise((resolve, reject) => {
            const storage = getStorage(firebaseApp);
            const storageRef = ref(storage, path);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
                },
                (error) => {
                    console.error("Upload failed:", error);
                    reject(error);
                },
                () => {
                    getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                        resolve({ url: downloadURL, contentType: file.type, name: file.name });
                    });
                }
            );
        });
    };

    try {
        const timestamp = Date.now();
        let allFilesToUpload = [...files];
        if (vlogFile) {
          allFilesToUpload.push(vlogFile);
        }

        const compressionPromises = allFilesToUpload.map(async (file) => {
          if (file.type.startsWith('image/')) {
            try {
              const options = {
                maxSizeMB: 1,
                maxWidthOrHeight: 1920,
                useWebWorker: true,
              };
              const compressedFile = await imageCompression(file, options);
              return compressedFile;
            } catch (compressionError) {
              console.error('Image compression error:', compressionError);
              toast({
                variant: 'destructive',
                title: 'Compression Failed',
                description: `Could not compress ${file.name}. It will be uploaded in its original size.`,
              });
              return file;
            }
          }
          return file;
        });

        const processedFiles = await Promise.all(compressionPromises);

        const attachmentPromises = processedFiles.map(file => {
            const filePath = `uploads/${user.uid}/${timestamp}-${file.name}`;
            return uploadFile(file, filePath);
        });

        const attachments = await Promise.all(attachmentPromises);

        const { undertaking, ...permitValues } = values;

        if (isCorrectionMode && permitIdToCorrect) {
            const permitRef = doc(firestore, "permits_to_work", permitIdToCorrect);
            const updatedData = {
                ...permitValues,
                status: "Corrected" as const,
                attachments: [...(permitToCorrect.attachments || []), ...attachments],
            };
            await updateDoc(permitRef, updatedData);
            toast({ title: "Success", description: "Your permit has been corrected and resubmitted." });
        } else {
            const permitData = {
              ...permitValues,
              siteEngineerId: user.uid,
              status: "Pending" as const,
              requestDate: serverTimestamp(),
              attachments,
            };

            const permitsCollection = collection(firestore, "permits_to_work");
            await addDoc(permitsCollection, permitData);

            toast({ title: "Success", description: "Your permit request has been submitted." });
        }

        router.push('/ptw/list');

    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Submission Failed",
            description: error.message || "Could not submit permit request."
        });
    } finally {
        setIsSubmitting(false);
        setUploadProgress({});
    }
  }

  const pageTitle = isCorrectionMode ? "Correct and Resubmit PtW" : "Raise a Permit to Work";
  const cardTitle = isCorrectionMode ? "Correct PtW Request" : "New PtW Request";
  const cardDescription = isCorrectionMode ? "Update the form below to resubmit your permit." : "Fill out the form below to submit a new permit request.";
  const submitButtonText = isCorrectionMode ? 'Resubmit Request' : 'Submit Request';
  const submittingButtonText = isCorrectionMode ? 'Resubmitting...' : 'Submitting...';

  if (isLoadingPermit || ptwTypesLoading || sitesLoading) {
    return <RaisePtwSkeleton />;
  }

  return (
    <>
      {isCorrectionMode && permitToCorrect?.adminRemarks && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Rejection Remarks</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap">
            {permitToCorrect.adminRemarks}
          </AlertDescription>
        </Alert>
      )}

      <h1 className="text-lg font-headline font-semibold md:text-2xl">{pageTitle}</h1>
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>{cardTitle}</CardTitle>
          <CardDescription>{cardDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
              <div className="grid gap-2">
                <Label>Requesting Engineer</Label>
                <Input readOnly value={userProfile?.username || user?.email || ''} className="bg-muted"/>
              </div>

              <FormField
                  control={form.control}
                  name="siteName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site Name</FormLabel>
                       <Select onValueChange={(value) => {
                          field.onChange(value);
                          const site = uniqueSites?.find(s => s.name === value);
                          setSelectedSite(site || null);
                      }} value={field.value} disabled={isSubmitting}>
                          <FormControl>
                          <SelectTrigger>
                              <SelectValue placeholder="Select a site" />
                          </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                              {uniqueSites?.map((site) => (
                              <SelectItem key={site.id} value={site.name}>{site.name}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
              />
              
              {selectedSite && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Site Details</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-muted-foreground">Project Company</p>
                        <p className="font-medium">{selectedSite.projectCompany}</p>
                    </div>
                     <div>
                        <p className="text-muted-foreground">AC Capacity</p>
                        <p className="font-medium">{selectedSite.acCapacity}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">DC Capacity</p>
                        <p className="font-medium">{selectedSite.dcCapacity}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              <FormField
                  control={form.control}
                  name="ptwType"
                  render={({ field }) => (
                      <FormItem>
                          <FormLabel>PTW for</FormLabel>
                           <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                              <FormControl>
                              <SelectTrigger>
                                  <SelectValue placeholder="Select a permit type" />
                              </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                  {ptwTypes?.map((type) => (
                                  <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                                  ))}
                              </SelectContent>
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
                          <FormControl>
                              <Textarea placeholder="Provide a detailed description of the work to be performed." rows={4} {...field} disabled={isSubmitting} />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                  )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="work-files">Attach files (videos, photos)</Label>
                    <div className="flex items-center gap-2">
                        <FileVideo className="h-5 w-5 text-muted-foreground"/>
                        <Input id="work-files" type="file" className="border-dashed" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} disabled={isSubmitting} />
                    </div>
                    {files.length > 0 && (
                        <div className="mt-2 space-y-2">
                        <Label>Selected Files:</Label>
                        {files.map((file, index) => (
                            <div key={index} className="text-sm">
                            <p className="truncate">{file.name}</p>
                            {uploadProgress[file.name] != null && <Progress value={uploadProgress[file.name]} className="w-full mt-1" />}
                            </div>
                        ))}
                        </div>
                    )}
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="vlog">Self attestation Video of engineer</Label>
                    <div className="flex items-center gap-2">
                        <Video className="h-5 w-5 text-muted-foreground"/>
                        <Input id="vlog" type="file" accept="video/*" className="border-dashed" onChange={(e) => setVlogFile(e.target.files ? e.target.files[0] : null)} disabled={isSubmitting} />
                    </div>
                    {vlogFile && (
                        <div className="mt-2 space-y-2">
                            <Label>Selected Vlog:</Label>
                            <div className="text-sm">
                                <p className="truncate">{vlogFile.name}</p>
                                {uploadProgress[vlogFile.name] != null && <Progress value={uploadProgress[vlogFile.name]} className="w-full mt-1" />}
                            </div>
                        </div>
                    )}
                </div>
              </div>


              <FormField
                  control={form.control}
                  name="commentsAndRemarks"
                  render={({ field }) => (
                      <FormItem>
                          <FormLabel>Additional Comments and Remarks</FormLabel>
                          <FormControl>
                              <Textarea placeholder="Any additional comments or remarks." {...field} disabled={isSubmitting}/>
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                  )}
              />
              
              <FormField
                  control={form.control}
                  name="undertaking"
                  render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                          <FormControl>
                              <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  id="undertaking"
                                  disabled={isSubmitting}
                              />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                              <FormLabel htmlFor="undertaking" className="text-sm font-normal">
                                  I, <span className="font-semibold">{userProfile?.username || user?.email}</span>, hereby undertake that the work for which I am requesting a Permit to Work (PTW) will be carried out in accordance with the approved Standard Operating Procedures. Kindly grant approval to proceed with the work.
                              </FormLabel>
                              <FormMessage />
                          </div>
                      </FormItem>
                  )}
              />

              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? submittingButtonText : submitButtonText}</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  )
}

    