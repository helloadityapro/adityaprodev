'use client';

import * as React from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { 
  useFirestore, 
  useUser, 
  useDoc, 
  useMemoFirebase, 
  useCollection, 
  addDocumentNonBlocking 
} from '@/firebase';
import { collection, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { 
  Gavel, 
  Plus, 
  Loader2, 
  Search, 
  Check, 
  ChevronsUpDown, 
  ArrowLeft,
  Building2,
  HardHat,
  CheckCircle2,
  Calendar,
  Send,
  FileText,
  Trash2,
  ListPlus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { isSuperAdmin } from '@/lib/auth-constants';

const woItemSchema = z.object({
  description: z.string().min(1, 'Description is required.'),
  quantity: z.coerce.number().min(0.01, 'Quantity is required.'),
  rate: z.coerce.number().min(0.01, 'Rate is required.'),
  gstPercent: z.coerce.number().min(0, 'GST is required.'),
  amount: z.number(),
});

const woSchema = z.object({
  siteId: z.string().min(1, 'Please select a project site.'),
  siteName: z.string(),
  woNumber: z.string().min(3, 'WO Number is required.'),
  orderDate: z.string().min(1, 'Date is required.'),
  contractorId: z.string().min(1, 'Please select a contractor.'),
  contractorName: z.string(),
  items: z.array(woItemSchema).min(1, 'At least one line item is required.'),
  description: z.string().min(10, 'Please provide a detailed overall scope of work.'),
});

type Site = {
  id: string;
  name: string;
  projectCompany: string;
};

type Contractor = {
  id: string;
  name: string;
  gstin: string;
};

export default function GlobalCreateWOPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [finalTotal, setFinalTotal] = React.useState(0);

  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearch, setSiteSearch] = React.useState("");
  const [isContractorPopoverOpen, setIsContractorPopoverOpen] = React.useState(false);
  const [contractorSearch, setContractorSearch] = React.useState("");

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const contractorsQuery = useMemoFirebase(() => collection(firestore, 'contractors'), [firestore]);
  const { data: allContractors } = useCollection<Contractor>(contractorsQuery);

  const form = useForm<z.infer<typeof woSchema>>({
    resolver: zodResolver(woSchema),
    defaultValues: {
      siteId: "",
      siteName: "",
      woNumber: "",
      orderDate: format(new Date(), 'yyyy-MM-dd'),
      contractorId: "",
      contractorName: "",
      items: [{ description: "", quantity: 0, rate: 0, gstPercent: 18, amount: 0 }],
      description: ""
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  const watchedItems = useWatch({
    control: form.control,
    name: "items",
  }) || [];

  const totalAmount = React.useMemo(() => {
    return watchedItems.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const gst = Number(item.gstPercent) || 0;
      const lineTotal = (qty * rate) * (1 + (gst / 100));
      return sum + lineTotal;
    }, 0);
  }, [watchedItems]);

  React.useEffect(() => {
    watchedItems.forEach((item, index) => {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const gst = Number(item.gstPercent) || 0;
      const calculatedAmount = (qty * rate) * (1 + (gst / 100));
      
      if (Math.abs((item.amount || 0) - calculatedAmount) > 0.01) {
        form.setValue(`items.${index}.amount`, calculatedAmount);
      }
    });
  }, [watchedItems, form]);

  const filteredSites = allSites?.filter(s => 
    s.name.toLowerCase().includes(siteSearch.toLowerCase())
  ) || [];

  const filteredContractors = allContractors?.filter(c => 
    c.name.toLowerCase().includes(contractorSearch.toLowerCase()) ||
    c.gstin.toLowerCase().includes(contractorSearch.toLowerCase())
  ) || [];

  const onSubmit = async (values: z.infer<typeof woSchema>) => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);
    try {
      const historyEntry = {
        action: 'Created',
        userName: userProfile.username || user.email,
        userId: user.uid,
        timestamp: new Date(),
        details: `Work Order issued for ₹${totalAmount.toLocaleString('en-IN')} (Pending Admin Approval)`
      };

      await addDocumentNonBlocking(collection(firestore, 'project_wos'), {
        siteId: values.siteId,
        siteName: values.siteName,
        woNumber: values.woNumber,
        contractorId: values.contractorId,
        contractorName: values.contractorName,
        orderDate: values.orderDate,
        items: values.items,
        totalAmount,
        description: values.description,
        status: 'Pending',
        createdAt: serverTimestamp(),
        createdByName: userProfile.username || user.email,
        history: [historyEntry]
      });

      setFinalTotal(totalAmount);
      setIsSuccess(true);
      toast({ title: 'WO Submitted', description: `Work Order ${values.woNumber} sent for approval.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full animate-in fade-in zoom-in-95 duration-300 rounded-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><div className="bg-primary/10 p-4 rounded-full"><CheckCircle2 className="h-12 w-12 text-primary" /></div></div>
            <CardTitle className="text-2xl font-bold uppercase tracking-tight">WO Generated</CardTitle>
            <CardDescription className="text-base leading-relaxed">Work Order for <strong className="text-primary font-black">₹{finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> has been generated successfully.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full h-12 text-lg font-semibold rounded-sm shadow-md" onClick={() => router.push('/work-orders/manage')}>Manage All WOs</Button>
            <Button variant="outline" className="w-full h-11 rounded-sm font-bold" onClick={() => { setIsSuccess(false); form.reset(); }}>Create Another</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20 px-4">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2"><Gavel className="h-8 w-8 text-primary" /> Add New Work Order</h1>
        <p className="text-muted-foreground font-medium">Issue formal service contracts across organizational project sites.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
          <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
            <CardHeader className="bg-primary/5 border-b"><CardTitle className="text-sm font-black uppercase tracking-widest">General Context</CardTitle></CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <FormField control={form.control} name="siteId" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Target Project Site</FormLabel>
                    <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal rounded-sm h-11", !field.value && "text-muted-foreground")}>
                            {field.value ? allSites?.find(s => s.id === field.value)?.name : "Select site..."}
                            <Building2 className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <div className="flex items-center border-b px-3">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <Input placeholder="Search sites..." className="h-10 w-full border-none focus-visible:ring-0 px-0 text-sm" value={siteSearch} onChange={(e) => setSiteSearch(e.target.value)} />
                        </div>
                        <ScrollArea className="h-[200px]">
                          <div className="p-1">
                            {filteredSites.map((s) => (
                              <Button key={s.id} type="button" variant="ghost" className="w-full justify-start font-normal h-11 text-xs" onClick={() => { field.onChange(s.id); form.setValue('siteName', s.name); setIsSitePopoverOpen(false); setSiteSearch(""); }}>
                                <Check className={cn("mr-2 h-4 w-4 text-primary", s.id === field.value ? "opacity-100" : "opacity-0")} />
                                {s.name}
                              </Button>
                            ))}
                          </div>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="contractorId" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Contractor Partner</FormLabel>
                    <Popover open={isContractorPopoverOpen} onOpenChange={setIsContractorPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal rounded-sm h-11", !field.value && "text-muted-foreground")}>
                            {field.value ? allContractors?.find(c => c.id === field.value)?.name : "Choose Contractor..."}
                            <HardHat className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <div className="flex items-center border-b px-3">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <Input placeholder="Search contractors..." className="h-10 w-full border-none focus-visible:ring-0 px-0 text-sm" value={contractorSearch} onChange={(e) => setContractorSearch(e.target.value)} />
                        </div>
                        <ScrollArea className="h-[200px]">
                          <div className="p-1">
                            {filteredContractors.map((c) => (
                              <Button key={c.id} type="button" variant="ghost" className="w-full justify-start font-normal h-11 text-xs" onClick={() => { field.onChange(c.id); form.setValue('contractorName', c.name); setIsContractorPopoverOpen(false); setContractorSearch(""); }}>
                                <Check className={cn("mr-2 h-4 w-4 text-primary", c.id === field.value ? "opacity-100" : "opacity-0")} />
                                <div className="flex flex-col items-start"><span className="font-bold">{c.name}</span><span className="text-[8px] font-mono text-muted-foreground">{c.gstin}</span></div>
                              </Button>
                            ))}
                          </div>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="woNumber" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">WO Serial Number</FormLabel><FormControl><Input placeholder="e.g. AGEPL/WO/2026/042" {...field} className="h-11 rounded-sm uppercase font-mono font-bold" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="orderDate" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Order Date</FormLabel><FormControl><div className="relative"><Input type="date" {...field} className="h-11 rounded-sm pr-10" /><Calendar className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground pointer-events-none" /></div></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <div className="flex items-center justify-between border-b pb-2 px-1">
              <div className="flex items-center gap-2">
                <ListPlus className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Service Line Items</h3>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => appendStop({ description: "", quantity: 0, rate: 0, gstPercent: 18, amount: 0 })} className="h-8 rounded-sm font-bold border-primary text-primary">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Service
              </Button>
            </div>

            <div className="space-y-4">
              {fields.map((field, index) => {
                const qty = Number(watchedItems[index]?.quantity) || 0;
                const rate = Number(watchedItems[index]?.rate) || 0;
                const gst = Number(watchedItems[index]?.gstPercent) || 0;
                const lineTotal = (qty * rate) * (1 + (gst / 100));

                return (
                  <div key={field.id} className="p-6 border rounded-sm bg-muted/5 relative animate-in fade-in slide-in-from-top-2">
                    {fields.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 text-destructive" onClick={() => remove(index)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                      <div className="md:col-span-5">
                        <FormField control={form.control} name={`items.${index}.description`} render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Service Description</FormLabel><FormControl><Input placeholder="e.g. Earthwork excavation" {...field} className="h-10 rounded-sm bg-background" /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      
                      <div className="md:col-span-2">
                        <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Qty</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-10 rounded-sm bg-background font-mono font-bold" /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>

                      <div className="md:col-span-2">
                        <FormField control={form.control} name={`items.${index}.rate`} render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Rate (₹)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-10 rounded-sm bg-background font-mono font-bold" /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>

                      <div className="md:col-span-1">
                        <FormField control={form.control} name={`items.${index}.gstPercent`} render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">GST %</FormLabel><FormControl><Input type="number" {...field} className="h-10 rounded-sm bg-background font-mono font-bold text-center" /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>

                      <div className="md:col-span-2 text-right">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Line Total (₹)</Label>
                          <div className="h-10 px-3 bg-primary/5 border border-primary/10 rounded-sm flex items-center justify-end font-mono font-black text-primary text-sm shadow-inner">{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-primary" /> Detailed Scope of Work</FormLabel>
                <FormControl><Textarea placeholder="Detail specific project milestones, technical requirements, or legal conditions..." rows={8} {...field} className="rounded-sm bg-muted/5 italic" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <div className="p-8 bg-primary/5 rounded-sm border-2 border-primary/10 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary border-4 border-primary/5"><Gavel className="h-8 w-8" /></div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] leading-none mb-1">Total Contract Value</span>
                <span className="text-4xl font-black text-primary tabular-nums">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <Button type="submit" disabled={isSubmitting || totalAmount <= 0} className="w-full sm:w-auto h-14 px-12 font-black text-lg rounded-sm shadow-xl">
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> SUBMITTING...</> : <><Send className="mr-2 h-4 w-4" /> GENERATE WORK ORDER</>}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
