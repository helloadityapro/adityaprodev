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
  addDocumentNonBlocking 
} from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
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
  FileText
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';

const woSchema = z.object({
  woNumber: z.string().min(3, 'WO Number is required.'),
  orderDate: z.string().min(1, 'Date is required.'),
  contractorId: z.string().min(1, 'Please select a contractor.'),
  contractorName: z.string(),
  totalAmount: z.coerce.number().min(0.01, 'Contract value is required.'),
  description: z.string().min(10, 'Please provide a detailed scope of work (min 10 chars).'),
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

export default function CreateWOPage({ params }: { params: Promise<{ projectId: string }> }) {
  const resolvedParams = React.use(params);
  const projectId = resolvedParams.projectId;
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [finalTotal, setFinalTotal] = React.useState(0);

  const [isContractorPopoverOpen, setIsContractorPopoverOpen] = React.useState(false);
  const [contractorSearch, setContractorSearch] = React.useState("");

  const projectRef = useMemoFirebase(() => doc(firestore, 'sites', projectId), [firestore, projectId]);
  const { data: site } = useDoc<Site>(projectRef);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);

  const contractorsQuery = useMemoFirebase(() => collection(firestore, 'contractors'), [firestore]);
  const { data: allContractors } = useCollection<Contractor>(contractorsQuery);

  const form = useForm<z.infer<typeof woSchema>>({
    resolver: zodResolver(woSchema),
    defaultValues: {
      woNumber: "",
      orderDate: format(new Date(), 'yyyy-MM-dd'),
      contractorId: "",
      contractorName: "",
      totalAmount: 0,
      description: ""
    },
  });

  const onSubmit = async (values: z.infer<typeof woSchema>) => {
    if (!user || !userProfile || !site) return;

    setIsSubmitting(true);

    try {
      const historyEntry = {
        action: 'Created',
        userName: userProfile.username || user.email,
        userId: user.uid,
        timestamp: new Date(),
        details: `Work Order released for ₹${values.totalAmount.toLocaleString('en-IN')}`
      };

      await addDocumentNonBlocking(collection(firestore, 'project_wos'), {
        siteId: projectId,
        siteName: site.name,
        woNumber: values.woNumber,
        contractorId: values.contractorId,
        contractorName: values.contractorName,
        orderDate: values.orderDate,
        totalAmount: values.totalAmount,
        description: values.description,
        status: 'Open',
        createdAt: serverTimestamp(),
        createdByName: userProfile.username || user.email,
        history: [historyEntry]
      });

      setFinalTotal(values.totalAmount);
      setIsSuccess(true);
      toast({ title: 'WO Created', description: `Work Order ${values.woNumber} for ${values.contractorName} has been recorded.` });
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
            <div className="flex justify-center mb-4">
              <div className="bg-primary/10 p-4 rounded-full">
                <CheckCircle2 className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold uppercase tracking-tight">WO Generated</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              Work Order for <strong className="text-primary font-black">₹{finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> has been released to <strong className="text-foreground">{form.getValues('contractorName')}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full h-12 text-lg font-semibold rounded-sm shadow-md" onClick={() => router.push(`/projects/${projectId}?tab=wo`)}>
              Back to Work Orders
            </Button>
            <Button variant="outline" className="w-full h-11 rounded-sm font-bold" onClick={() => { setIsSuccess(false); form.reset(); }}>
              Create Another WO
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20 px-4">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary">
          <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
        </Button>
        <h1 className="flex items-center gap-2">
          <Gavel className="h-8 w-8 text-primary" /> Release Work Order
        </h1>
        <p className="text-muted-foreground font-medium">Provision service contracts for site contractors.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
            <CardHeader className="bg-primary/5 border-b">
              <CardTitle className="text-sm font-black uppercase tracking-widest">Order Context</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="woNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">WO Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. AGEPL/WO/2026/042" {...field} className="h-11 rounded-sm uppercase font-mono font-bold" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="orderDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Order Date</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type="date" {...field} className="h-11 rounded-sm pr-10" />
                          <Calendar className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contractorId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Contractor Partner</FormLabel>
                      <Popover open={isContractorPopoverOpen} onOpenChange={setIsContractorPopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between font-normal rounded-sm h-11",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? allContractors?.find(c => c.id === field.value)?.name : "Select Contractor..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <div className="flex items-center border-b px-3">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <Input
                              placeholder="Search contractors..."
                              className="h-10 w-full border-none focus-visible:ring-0 px-0 text-sm"
                              value={contractorSearch}
                              onChange={(e) => setContractorSearch(e.target.value)}
                            />
                          </div>
                          <ScrollArea className="h-[200px]">
                            <div className="p-1">
                              {allContractors?.filter(c => c.name.toLowerCase().includes(contractorSearch.toLowerCase())).map((c) => (
                                <Button
                                  key={c.id}
                                  type="button"
                                  variant="ghost"
                                  className="w-full justify-start font-normal h-11 text-xs"
                                  onClick={() => {
                                    field.onChange(c.id);
                                    form.setValue('contractorName', c.name);
                                    setIsContractorPopoverOpen(false);
                                    setContractorSearch("");
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4 text-primary", c.id === field.value ? "opacity-100" : "opacity-0")} />
                                  <div className="flex flex-col items-start">
                                    <span className="font-bold">{c.name}</span>
                                    <span className="text-[8px] font-mono text-muted-foreground">{c.gstin}</span>
                                  </div>
                                </Button>
                              ))}
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
                  name="totalAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Contract Value (₹)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-bold">₹</span>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} className="h-11 rounded-sm pl-7 font-mono font-bold" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="mt-8 space-y-4">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-primary" /> Scope of Work & Deliverables
                      </FormLabel>
                      <FormControl>
                        <Textarea placeholder="Detail the specific services, milestones, or technical requirements..." rows={8} {...field} className="rounded-sm bg-muted/5 italic" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <div className="p-8 bg-primary/5 rounded-sm border-2 border-primary/10 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl animate-in slide-in-from-bottom-2">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary border-4 border-primary/5">
                <Gavel className="h-8 w-8" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] leading-none mb-1">Contract Total</span>
                <span className="text-4xl font-black text-primary tabular-nums">₹{form.watch('totalAmount').toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            
            <div className="flex gap-3 w-full sm:w-auto">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => router.back()} 
                className="h-14 px-8 font-bold uppercase text-xs tracking-widest rounded-sm"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting} 
                className="w-full sm:w-auto h-14 px-12 font-black text-lg rounded-sm shadow-xl"
              >
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> PROVISIONING...</> : <><Send className="mr-2 h-4 w-4" /> RELEASE WORK ORDER</>}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
