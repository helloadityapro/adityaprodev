'use client';

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking, useFirebaseApp } from "@/firebase";
import { collection, doc, serverTimestamp, increment, query, where, getDocs, and } from "firebase/firestore";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Check, ChevronsUpDown, Loader2, FilePlus, Calendar, Plus, Trash2, MessageCircle, CheckCircle2, Building2, Globe, FileUp, X, FileText, ImageIcon, Film } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { isSuperAdmin } from "@/lib/auth-constants";
import { useRouter } from "next/navigation";
import { sendNotification } from "@/lib/notifications";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import imageCompression from 'browser-image-compression';
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const dprSchema = z.object({
  dprType: z.enum(['site', 'other'], { required_error: "Please select a category." }),
  siteName: z.string().min(1, "Location/Site name is required"),
  reportDate: z.string().min(1, "Date is required"),
  updates: z.array(z.object({
    value: z.string().min(1, "Paragraph cannot be empty")
  })).min(1, "At least one paragraph is required"),
});

type Site = {
  id: string;
  name: string;
};

type UserProfile = {
  id: string;
  username: string;
  role: string;
  siteManagerId?: string;
  assignedProjectIds?: string[];
  pointsMultiplier?: number;
  ownDataOnly?: boolean;
};

type RewardSettings = {
  dprEngineer?: number;
  dprManager?: number;
};

type MappingOverride = {
  id: string;
  engineerId: string;
  siteId: string;
  managerId: string;
};

export default function SubmitDPRPage() {
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const settingsRef = useMemoFirebase(() => doc(firestore, 'system_settings', 'rewards'), [firestore]);
  const { data: rewardSettings } = useDoc<RewardSettings>(settingsRef);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const overridesQuery = useMemoFirebase(() => collection(firestore, 'team_mapping_overrides'), [firestore]);
  const { data: allOverrides } = useCollection<MappingOverride>(overridesQuery);

  const teamQuery = useMemoFirebase(() => {
    if (!isManager || !user) return null;
    return query(collection(firestore, 'users'), where('siteManagerId', '==', user.uid));
  }, [firestore, user, isManager]);
  const { data: teamMembers } = useCollection<UserProfile>(teamQuery);

  const accessibleSites = React.useMemo(() => {
    if (!allSites || !userProfile) return [];
    if (isAdmin) {
        return Array.from(new Map(allSites.map(s => [s.name, s])).values());
    }
    
    const siteIds = new Set<string>(userProfile.assignedProjectIds || []);
    if (isManager) {
      allOverrides?.filter(o => o.managerId === userProfile.id).forEach(o => siteIds.add(o.siteId));
      if (teamMembers) {
        teamMembers.forEach(member => {
          (member.assignedProjectIds || []).forEach(id => {
            const hasOtherOverride = allOverrides?.some(o => o.engineerId === member.id && o.siteId === id && o.managerId !== userProfile.id);
            if (!hasOtherOverride) siteIds.add(id);
          });
        });
      }
    }
    
    const filtered = allSites.filter(s => siteIds.has(s.id));
    return Array.from(new Map(filtered.map(s => [s.name, s])).values());
  }, [allSites, userProfile, isAdmin, isManager, teamMembers, allOverrides]);

  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [submittedDpr, setSubmittedDpr] = React.useState<{ siteName: string, date: string, description: string, attachments: any[] } | null>(null);
  
  const [localFiles, setLocalFiles] = React.useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = React.useState<Record<string, number>>({});

  const form = useForm<z.infer<typeof dprSchema>>({
    resolver: zodResolver(dprSchema),
    defaultValues: { 
      dprType: 'site',
      siteName: "", 
      reportDate: format(new Date(), 'yyyy-MM-dd'), 
      updates: [{ value: "" }] 
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "updates"
  });

  const watchDprType = form.watch('dprType');

  const uploadFile = async (file: File, userId: string): Promise<any> => {
    let blob: Blob = file;
    if (file.type.startsWith('image/')) {
      try {
        blob = await imageCompression(file, { maxSizeMB: 0.8, maxWidthOrHeight: 1920 });
      } catch (e) { console.warn("Compression skipped", e); }
    }
    const storage = getStorage(firebaseApp);
    const path = `dprs/${userId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
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

  const onSubmit = async (values: z.infer<typeof dprSchema>) => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);
    setUploadProgress({});
    try {
      const combinedDescription = values.updates.map(u => u.value.trim()).join('\n\n');
      const siteId = values.dprType === 'site' ? accessibleSites.find(s => s.name === values.siteName)?.id : 'other';

      const attachments = [];
      for (const file of localFiles) {
        const uploaded = await uploadFile(file, user.uid);
        attachments.push(uploaded);
      }

      let effectiveSiteManagerId = userProfile.siteManagerId || null;
      
      if (values.dprType === 'site' && siteId !== 'other') {
        const overridesQuery = query(collection(firestore, 'team_mapping_overrides'), and(where('engineerId', '==', user.uid), where('siteId', '==', siteId || '')));
        const overridesSnap = await getDocs(overridesQuery);
        if (!overridesSnap.empty) {
          effectiveSiteManagerId = overridesSnap.docs[0].data().managerId;
        }
      }
      
      await addDocumentNonBlocking(collection(firestore, 'dprs'), {
        dprType: values.dprType,
        siteId: siteId || null,
        siteName: values.siteName,
        reportDate: values.reportDate,
        description: combinedDescription,
        attachments,
        userId: user.uid,
        userName: userProfile?.username || user.email,
        siteManagerId: effectiveSiteManagerId,
        createdAt: serverTimestamp(),
      });

      if (effectiveSiteManagerId && effectiveSiteManagerId !== user.uid) {
        sendNotification(firestore, {
          userId: effectiveSiteManagerId,
          title: "DPR Submitted",
          description: `${userProfile.username} submitted a progress report for ${values.siteName}.`,
          link: "/dpr/list",
        });
      }

      const adminsQuery = query(collection(firestore, 'users'), where('role', '==', 'Admin'));
      const adminDocs = await getDocs(adminsQuery);
      adminDocs.forEach(adminDoc => {
        if (adminDoc.id === user.uid || adminDoc.id === effectiveSiteManagerId) return;
        sendNotification(firestore, {
          userId: adminDoc.id,
          title: "New DPR Logged",
          description: `Site: ${values.siteName} • By: ${userProfile.username}`,
          link: "/dpr/list",
        });
      });

      const rateEngineer = rewardSettings?.dprEngineer ?? 1.0;
      const rateManager = rewardSettings?.dprManager ?? 0.25;
      const multiplier = userProfile.pointsMultiplier || 1;
      
      updateDocumentNonBlocking(doc(firestore, 'users', user.uid), {
        totalPoints: increment(rateEngineer * multiplier)
      });

      if (effectiveSiteManagerId && effectiveSiteManagerId !== user.uid) {
        updateDocumentNonBlocking(doc(firestore, 'users', effectiveSiteManagerId), {
            totalPoints: increment(rateManager)
        });
      }
      
      setSubmittedDpr({
        siteName: values.siteName,
        date: values.reportDate,
        description: combinedDescription,
        attachments
      });
      setIsSubmitted(true);
      toast({ title: "Success", description: "DPR submitted. Points awarded successfully." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerWhatsApp = () => {
    if (!submittedDpr) return;
    const mediaLinks = submittedDpr.attachments?.length ? `\n\n*Attachments:*\n${submittedDpr.attachments.map((a, i) => `${i + 1}. ${a.url}`).join('\n')}` : '';
    const message = `*Aditya Pro - Daily Progress Report*\n\n*Site:* ${submittedDpr.siteName}\n*Date:* ${format(new Date(submittedDpr.date), 'dd MMM yyyy')}\n*Submitted By:* ${userProfile?.username || user?.email}\n\n*Activities:*\n${submittedDpr.description}${mediaLinks}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const filteredSites = accessibleSites.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase()));

  if (isSubmitted && submittedDpr) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full animate-in fade-in zoom-in-95 duration-300">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-primary/10 p-4 rounded-full">
                <CheckCircle2 className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">DPR Submitted</CardTitle>
            <CardDescription className="text-base">
              The Daily Progress Report for <strong className="text-primary">{submittedDpr.siteName}</strong> has been logged.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg font-semibold rounded-sm shadow-md" 
              onClick={triggerWhatsApp}
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              Push to WhatsApp
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-11 rounded-sm" onClick={() => router.push('/dpr/list')}>
                View DPR Logs
              </Button>
              <Button variant="secondary" className="h-11 rounded-sm" onClick={() => {
                setIsSubmitted(false);
                setSubmittedDpr(null);
                form.reset();
                setLocalFiles([]);
              }}>
                Submit New
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2">
          <FilePlus className="h-8 w-8 text-primary" /> Submit DPR
        </h1>
        <p className="text-muted-foreground">Log today's site progress and updates.</p>
      </div>

      <Card className="shadow-md border-primary/10 rounded-sm">
        <CardHeader>
          <CardTitle>Daily Progress Report Form</CardTitle>
          <CardDescription>Break down your updates and attach media for visual evidence.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <FormField
                control={form.control}
                name="dprType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">DPR Category</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={(val) => {
                          field.onChange(val);
                          form.setValue('siteName', '');
                        }}
                        defaultValue={field.value}
                        className="flex gap-6 h-11 items-center"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="site" id="dpr-site" />
                          <Label htmlFor="dpr-site" className="font-bold cursor-pointer flex items-center gap-1.5 text-xs uppercase">
                            <Building2 className="h-3.5 w-3.5 text-primary" /> Groundmount Projects
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="other" id="dpr-other" />
                          <Label htmlFor="dpr-other" className="font-bold cursor-pointer flex items-center gap-1.5 text-xs uppercase">
                            <Globe className="h-3.5 w-3.5 text-slate-500" /> Others
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="siteName" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {watchDprType === 'site' ? 'Select Project Site' : 'Work Location / Title'}
                    </FormLabel>
                    {watchDprType === 'site' ? (
                      <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button 
                              variant="outline" 
                              role="combobox" 
                              className={cn("w-full justify-between font-normal rounded-sm h-11", !field.value && "text-muted-foreground")}
                            >
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
                            {filteredSites.length > 0 ? filteredSites.map((site) => (
                              <Button 
                                  key={site.id} 
                                  type="button" 
                                  variant="ghost" 
                                  className="w-full justify-start font-normal text-left" 
                                  onClick={() => { field.onChange(site.name); setIsSitePopoverOpen(false); }}
                              >
                                <Check className={cn("mr-2 h-4 w-4 shrink-0", site.name === field.value ? "opacity-100" : "opacity-0")} />
                                <span className="truncate">{site.name}</span>
                              </Button>
                            )) : (
                              <div className="p-4 text-center text-sm text-muted-foreground">No sites found.</div>
                            )}
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <FormControl>
                        <Input placeholder="e.g. Office work, Vendor meeting..." {...field} className="h-11 rounded-sm" />
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="reportDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Select Date</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type="date" {...field} className="rounded-sm pr-10 h-11" />
                        <Calendar className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="space-y-4">
                <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Daily Updates (Paragraph Wise)</FormLabel>
                {fields.map((field, index) => (
                  <FormField
                    key={field.id}
                    control={form.control}
                    name={`updates.${index}.value`}
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex gap-2">
                          <FormControl>
                            <Textarea 
                              placeholder={`Activity details for part ${index + 1}...`} 
                              rows={3} 
                              {...field} 
                              className="rounded-sm flex-1 min-h-[100px]" 
                            />
                          </FormControl>
                          {fields.length > 1 && (
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="h-10 w-10 text-destructive hover:bg-destructive/10 shrink-0"
                              onClick={() => remove(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed rounded-sm h-12"
                  onClick={() => append({ value: "" })}
                >
                  <Plus className="mr-2 h-4 w-4" /> Add New Paragraph
                </Button>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <FileUp className="h-4 w-4 text-primary" /> Attach Visual Evidence (Images / Videos)
                </Label>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-4">
                    {localFiles.map((file, idx) => (
                      <div key={idx} className="relative w-24 h-24 rounded-sm overflow-hidden border bg-muted group">
                         {file.type.startsWith('image/') ? (
                           <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="Preview" />
                         ) : (
                           <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                             <Film className="h-6 w-6 text-muted-foreground" />
                             <span className="text-[8px] font-black uppercase text-muted-foreground">Video</span>
                           </div>
                         )}
                         <Button 
                           type="button" 
                           variant="destructive" size="icon" 
                           className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity" 
                           onClick={() => setLocalFiles(prev => prev.filter((_, i) => i !== idx))}
                         >
                           <X className="h-3 w-3" />
                         </Button>
                         {uploadProgress[file.name] !== undefined && (
                           <div className="absolute bottom-0 left-0 right-0">
                             <Progress value={uploadProgress[file.name]} className="h-1 rounded-none" />
                           </div>
                         )}
                      </div>
                    ))}
                    <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed rounded-sm cursor-pointer hover:bg-muted/50 transition-colors">
                      <Plus className="h-6 w-6 text-muted-foreground/50" />
                      <span className="text-[8px] font-black uppercase text-muted-foreground/40 mt-1">Add Media</span>
                      <input 
                        type="file" multiple accept="image/*,video/*" className="hidden" 
                        onChange={(e) => setLocalFiles(prev => [...prev, ...Array.from(e.target.files || [])])} 
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t">
                <Button type="submit" className="min-w-[150px] h-12 rounded-sm text-lg font-semibold" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : "Submit DPR"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
