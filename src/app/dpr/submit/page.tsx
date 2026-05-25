
"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp, increment, query, where, getDocs, and } from "firebase/firestore";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Check, ChevronsUpDown, Loader2, FilePlus, Calendar, Plus, Trash2, MessageCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { isSuperAdmin } from "@/lib/auth-constants";
import { useRouter } from "next/navigation";
import { sendNotification } from "@/lib/notifications";

const dprSchema = z.object({
  siteName: z.string().min(1, "Site is required"),
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
};

type RewardSettings = {
  dprEngineer?: number;
  dprManager?: number;
};

export default function SubmitDPRPage() {
  const firestore = useFirestore();
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

  // Fetch team members for managers to aggregate sites
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
    
    // Aggregated site visibility for Managers
    const assignedIds = new Set<string>(userProfile.assignedProjectIds || []);
    if (isManager && teamMembers) {
      teamMembers.forEach(member => {
        (member.assignedProjectIds || []).forEach(id => assignedIds.add(id));
      });
    }

    const filtered = allSites.filter(s => assignedIds.has(s.id));
    return Array.from(new Map(filtered.map(s => [s.name, s])).values());
  }, [allSites, userProfile, isAdmin, isManager, teamMembers]);

  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [submittedDpr, setSubmittedDpr] = React.useState<{ siteName: string, date: string, description: string } | null>(null);

  const form = useForm<z.infer<typeof dprSchema>>({
    resolver: zodResolver(dprSchema),
    defaultValues: { 
      siteName: "", 
      reportDate: format(new Date(), 'yyyy-MM-dd'), 
      updates: [{ value: "" }] 
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "updates"
  });

  const onSubmit = async (values: z.infer<typeof dprSchema>) => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);
    try {
      const combinedDescription = values.updates.map(u => u.value.trim()).join('\n\n');
      const siteId = accessibleSites.find(s => s.name === values.siteName)?.id;

      // Site-Specific Manager Lookup (Override Logic)
      const overridesQuery = query(collection(firestore, 'team_mapping_overrides'), and(where('engineerId', '==', user.uid), where('siteId', '==', siteId || '')));
      const overridesSnap = await getDocs(overridesQuery);
      const effectiveSiteManagerId = !overridesSnap.empty ? overridesSnap.docs[0].data().managerId : (userProfile.siteManagerId || null);
      
      await addDocumentNonBlocking(collection(firestore, 'dprs'), {
        siteId: siteId || null,
        siteName: values.siteName,
        reportDate: values.reportDate,
        description: combinedDescription,
        userId: user.uid,
        userName: userProfile?.username || user.email,
        siteManagerId: effectiveSiteManagerId,
        createdAt: serverTimestamp(),
      });

      // Notify Manager
      if (effectiveSiteManagerId && effectiveSiteManagerId !== user.uid) {
        sendNotification(firestore, {
          userId: effectiveSiteManagerId,
          title: "DPR Submitted",
          description: `${userProfile.username} submitted a progress report for ${values.siteName}.`,
          link: "/dpr/list",
        });
      }

      // Notify All Admins
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

      // Reward Points Logic for DPR
      const rateEngineer = rewardSettings?.dprEngineer ?? 1.0;
      const rateManager = rewardSettings?.dprManager ?? 0.25;
      const multiplier = userProfile.pointsMultiplier || 1;
      
      // 1. Award Engineer
      updateDocumentNonBlocking(doc(firestore, 'users', user.uid), {
        totalPoints: increment(rateEngineer * multiplier)
      });

      // 2. Award Manager (Inheritance)
      if (effectiveSiteManagerId && effectiveSiteManagerId !== user.uid) {
        updateDocumentNonBlocking(doc(firestore, 'users', effectiveSiteManagerId), {
            totalPoints: increment(rateManager)
        });
      }
      
      setSubmittedDpr({
        siteName: values.siteName,
        date: values.reportDate,
        description: combinedDescription
      });
      setIsSubmitted(true);
      toast({ title: "Success", description: "DPR submitted. Points awarded successfully." });
      form.reset({ siteName: "", reportDate: format(new Date(), 'yyyy-MM-dd'), updates: [{ value: "" }] });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerWhatsApp = () => {
    if (!submittedDpr) return;
    const message = `*Aditya Pro - Daily Progress Report*\n\n*Site:* ${submittedDpr.siteName}\n*Date:* ${format(new Date(submittedDpr.date), 'dd MMM yyyy')}\n*Submitted By:* ${userProfile?.username || user?.email}\n\n*Activities:*\n${submittedDpr.description}`;
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
          <CardDescription>Break down your updates into paragraphs using the (+) button.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField control={form.control} name="siteName" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Site Name</FormLabel>
                  <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button 
                          variant="outline" 
                          role="combobox" 
                          className={cn("w-full justify-between font-normal rounded-sm", !field.value && "text-muted-foreground")}
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
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="reportDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Date</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type="date" {...field} className="rounded-sm pr-10" />
                      <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="space-y-4">
                <FormLabel>Daily Updates (Paragraph Wise)</FormLabel>
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

              <div className="flex justify-end gap-4 pt-4 border-t">
                <Button type="submit" className="min-w-[150px] h-11 rounded-sm text-lg font-semibold" disabled={isSubmitting}>
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
