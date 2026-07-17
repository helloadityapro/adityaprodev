'use client';

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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
  updateDocumentNonBlocking,
  setDocumentNonBlocking
} from '@/firebase';
import { collection, doc, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { 
  Zap, 
  Building2, 
  Plus, 
  Trash2, 
  Loader2, 
  Search, 
  Check, 
  ChevronsUpDown, 
  Save, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  Navigation
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

const spanSchema = z.object({
  label: z.string(),
  distance: z.preprocess((val) => (val === "" ? undefined : val), z.coerce.number().min(0.01, 'Distance required.')),
  remarks: z.string().optional(),
});

const conductorSchema = z.object({
  siteId: z.string().min(1, 'Site selection is mandatory.'),
  siteName: z.string(),
  projectCompany: z.string().optional(),
  poleConfiguration: z.enum(['Two Pole', 'Four Pole']),
  spans: z.array(spanSchema).min(1, 'At least one span distance is required.'),
});

type Site = { id: string; name: string; projectCompany?: string };

export default function HTConductorChecklistPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDrafting, setIsDrafting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearch, setSiteSearch] = React.useState("");
  const [existingDraftId, setExistingDraftId] = React.useState<string | null>(null);
  const [visibleRemarks, setVisibleRemarks] = React.useState<Record<number, boolean>>({});

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const form = useForm<z.infer<typeof conductorSchema>>({
    resolver: zodResolver(conductorSchema),
    defaultValues: {
      siteId: "",
      siteName: "",
      projectCompany: "",
      poleConfiguration: "Two Pole",
      spans: [
        { label: "Two Pole to Pole 1 Distance", distance: undefined as any },
        { label: "Pole 1 to Pole 2 Distance", distance: undefined as any },
        { label: "Pole 2 to Pole 3 Distance", distance: undefined as any },
      ],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "spans"
  });

  const watchConfig = form.watch('poleConfiguration');
  const watchSiteId = form.watch('siteId');

  // Handle dynamic labeling of the first span when configuration changes
  React.useEffect(() => {
    const currentSpans = form.getValues('spans');
    if (currentSpans.length > 0) {
      const firstSpanLabel = `${watchConfig} to Pole 1 Distance`;
      if (currentSpans[0].label !== firstSpanLabel) {
        const newSpans = [...currentSpans];
        newSpans[0].label = firstSpanLabel;
        replace(newSpans);
      }
    }
  }, [watchConfig, replace, form]);

  // Check for existing drafts when site is selected
  React.useEffect(() => {
    if (watchSiteId && user) {
      const checkDraft = async () => {
        const q = query(
          collection(firestore, 'ht_conductor_checklists'),
          where('userId', '==', user.uid),
          where('siteId', '==', watchSiteId),
          where('status', '==', 'Draft'),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const draft = snap.docs[0].data();
          setExistingDraftId(snap.docs[0].id);
          form.reset({
            siteId: draft.siteId,
            siteName: draft.siteName,
            projectCompany: draft.projectCompany || "",
            poleConfiguration: draft.poleConfiguration,
            spans: draft.spans
          });
          toast({ title: 'Draft Resumed', description: 'Previously saved work for this site has been loaded.' });
        } else {
          setExistingDraftId(null);
        }
      };
      checkDraft();
    }
  }, [watchSiteId, user, firestore, form, toast]);

  const handleAddMore = () => {
    const currentCount = fields.length;
    append({
      label: `Pole ${currentCount} to Pole ${currentCount + 1} Distance`,
      distance: undefined as any
    });
  };

  const toggleRemark = (idx: number) => {
    setVisibleRemarks(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const saveToFirestore = async (values: z.infer<typeof conductorSchema>, status: 'Draft' | 'Pending') => {
    if (!user || !userProfile) return;
    
    const isSave = status === 'Draft';
    if (isSave) setIsDrafting(true);
    else setIsSubmitting(true);

    try {
      const data = {
        ...values,
        userId: user.uid,
        userName: userProfile.username || user.email,
        status,
        updatedAt: serverTimestamp(),
      };

      if (existingDraftId) {
        await updateDocumentNonBlocking(doc(firestore, 'ht_conductor_checklists', existingDraftId), data);
      } else {
        await addDocumentNonBlocking(collection(firestore, 'ht_conductor_checklists'), {
          ...data,
          createdAt: serverTimestamp()
        });
      }

      if (!isSave) {
        setIsSuccess(true);
        toast({ title: "Audit Submitted", description: `Conductor checklist for ${values.siteName} has been logged.` });
      } else {
        toast({ title: "Draft Saved", description: "Progress saved. You can continue later." });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsDrafting(false);
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4 animate-in fade-in zoom-in-95 duration-500">
        <Card className="max-w-md w-full rounded-sm shadow-2xl border-emerald-500/20">
          <CardHeader className="text-center pt-8">
            <div className="flex justify-center mb-6">
              <div className="bg-emerald-500/10 p-6 rounded-full"><CheckCircle2 className="h-16 w-16 text-emerald-600" /></div>
            </div>
            <CardTitle className="text-2xl font-black uppercase tracking-tight text-emerald-900">Log Finalized</CardTitle>
            <CardDescription className="text-base font-medium text-emerald-800/70 mt-2">
              HT Conductor record for <strong>{form.getValues('siteName')}</strong> archived.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pb-8 px-8">
            <Button className="w-full h-12 text-sm font-black uppercase bg-emerald-600 shadow-lg" onClick={() => router.push("/checklists/data")}>View Data Hub</Button>
            <Button variant="ghost" className="w-full h-10 text-[10px] font-black uppercase" onClick={() => { setIsSuccess(false); form.reset(); setExistingDraftId(null); }}>Start New Audit</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 max-w-4xl mx-auto pb-20 px-2 sm:px-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl md:text-2xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
          <Zap className="h-6 w-6 sm:h-7 sm:w-7" /> HT Conductor Checklist
        </h1>
        <p className="text-muted-foreground font-medium text-xs sm:text-sm">Verify sequential pole distances for HT transmission.</p>
      </div>

      <Form {...form}>
        <form className="space-y-6 md:space-y-8">
          <Card className="rounded-sm shadow-md border-primary/10">
            <CardHeader className="bg-primary/5 border-b py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Project Context
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <FormField control={form.control} name="siteId" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Project Name *</FormLabel>
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
                          <Input placeholder="Search sites..." className="h-10 w-full border-none focus-visible:ring-0 px-0" value={siteSearch} onChange={e => setSiteSearch(e.target.value)} />
                        </div>
                        <ScrollArea className="h-[200px]">
                          <div className="p-1">
                            {allSites?.filter(s => s.name.toLowerCase().includes(siteSearch.toLowerCase())).map(site => (
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
              </div>

              <FormField control={form.control} name="poleConfiguration" render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pole Configuration at Plant *</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 sm:gap-10 h-11 items-center">
                      <div className="flex items-center space-x-2"><RadioGroupItem value="Four Pole" id="pc-four" /><Label htmlFor="pc-four" className="font-bold cursor-pointer text-xs uppercase">Four Pole</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="Two Pole" id="pc-two" /><Label htmlFor="pc-two" className="font-bold cursor-pointer text-xs uppercase">Two Pole</Label></div>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Navigation className="h-4 w-4 text-primary" /> Pole Distance Section
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {fields.map((field, index) => (
                  <div key={field.id} className="p-4 sm:p-6 space-y-4 hover:bg-muted/[0.01] transition-colors relative group">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs sm:text-sm font-black uppercase tracking-tight text-foreground">{form.watch(`spans.${index}.label`)} *</Label>
                        <div className="flex items-center gap-2">
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => toggleRemark(index)}
                            className={cn("h-7 px-2 text-[9px] font-black uppercase border border-primary/5 bg-background", visibleRemarks[index] ? "text-primary border-primary/20" : "text-muted-foreground")}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" /> Remark
                          </Button>
                          {index > 2 && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive rounded-sm" onClick={() => remove(index)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <FormField control={form.control} name={`spans.${index}.distance`} render={({ field }) => (
                          <FormItem className="space-y-0">
                            <FormControl>
                              <div className="relative">
                                <Input type="number" step="0.01" {...field} value={field.value ?? ""} className="h-11 w-[140px] rounded-sm font-mono font-bold pl-4 pr-10" />
                                <span className="absolute right-3 top-3 text-[9px] font-black text-muted-foreground uppercase">Mtrs</span>
                              </div>
                            </FormControl>
                          </FormItem>
                        )} />
                      </div>
                    </div>
                    
                    {visibleRemarks[index] && (
                      <FormField control={form.control} name={`spans.${index}.remarks`} render={({ field }) => (
                        <FormItem className="animate-in fade-in duration-300">
                          <FormControl><Textarea placeholder="Add observation for this span..." {...field} className="rounded-sm bg-muted/5 min-h-[80px] text-xs" /></FormControl>
                        </FormItem>
                      )} />
                    )}
                  </div>
                ))}
              </div>
              <div className="p-4 bg-muted/5 border-t">
                <Button type="button" variant="outline" className="w-full h-11 border-dashed rounded-sm font-bold text-primary border-primary/20 hover:bg-primary/5" onClick={handleAddMore}>
                  <Plus className="h-4 w-4 mr-2" /> Add More Pole Spans
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 sm:pt-8">
            <Button type="button" variant="outline" disabled={isSubmitting || isDrafting} onClick={() => saveToFirestore(form.getValues(), 'Draft')} className="rounded-sm font-bold h-12 flex-1 sm:flex-none sm:min-w-[200px]">
              {isDrafting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save and Continue Later
            </Button>
            <Button type="button" disabled={isSubmitting || isDrafting} onClick={form.handleSubmit(v => saveToFirestore(v, 'Pending'))} className="rounded-sm font-black uppercase text-xs tracking-widest h-12 px-10 shadow-xl flex-1 sm:flex-none sm:min-w-[200px]">
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finalizing...</> : <><CheckCircle2 className="mr-2 h-4 w-4" /> SUBMIT AUDIT</>}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
