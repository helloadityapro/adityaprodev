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
  updateDocumentNonBlocking,
  useFirebaseApp
} from '@/firebase';
import { collection, doc, query, where, serverTimestamp, getDocs, increment } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { 
  HandCoins, 
  Search, 
  Check, 
  ChevronsUpDown, 
  Building2,
  Truck,
  CheckCircle2,
  Calendar,
  FileUp,
  Loader2,
  CircleDollarSign,
  AlertCircle,
  HardHat,
  ShoppingBag,
  Gavel
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const paymentSchema = z.object({
  siteId: z.string().min(1, 'Please select a project.'),
  siteName: z.string(),
  paymentAgainst: z.enum(['PO', 'WO']),
  payeeId: z.string().min(1, 'Please select a payee.'),
  payeeName: z.string(),
  referenceId: z.string().min(1, 'Please select a PO/WO.'),
  referenceNumber: z.string(),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
  paymentType: z.enum(['Advance', 'Part', 'Final', 'Full']),
  paymentMode: z.string().min(1, 'Select payment mode.'),
  paymentDetails: z.string().min(1, 'Add reference number or notes.'),
  proofUrl: z.string().optional(),
});

type Site = { id: string; name: string };
type Supplier = { id: string; name: string; gstin: string };
type Contractor = { id: string; name: string; gstin: string };
type PO = { id: string; poNumber: string; supplierId: string; totalAmount: number; paidAmount?: number };
type WO = { id: string; woNumber: string; contractorId: string; totalAmount: number; paidAmount?: number };

export default function RecordPaymentPage() {
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [proofFile, setProofFile] = React.useState<File | null>(null);
  
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearch, setSiteSearch] = React.useState("");
  const [isPayeePopoverOpen, setIsPayeePopoverOpen] = React.useState(false);
  const [payeeSearch, setPayeeSearch] = React.useState("");
  const [isRefPopoverOpen, setIsRefPopoverOpen] = React.useState(false);
  const [refSearch, setRefSearch] = React.useState("");

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: sites } = useCollection<Site>(sitesQuery);

  const suppliersQuery = useMemoFirebase(() => collection(firestore, 'suppliers'), [firestore]);
  const { data: suppliers } = useCollection<Supplier>(suppliersQuery);

  const contractorsQuery = useMemoFirebase(() => collection(firestore, 'contractors'), [firestore]);
  const { data: contractors } = useCollection<Contractor>(contractorsQuery);

  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      siteId: "", siteName: "", paymentAgainst: "PO", payeeId: "", payeeName: "", referenceId: "", referenceNumber: "", amount: 0, paymentType: "Part", paymentMode: "Bank Transfer", paymentDetails: ""
    },
  });

  const watchSiteId = form.watch('siteId');
  const watchType = form.watch('paymentAgainst');
  const watchPayeeId = form.watch('payeeId');
  const watchRefId = form.watch('referenceId');

  const [orders, setOrders] = React.useState<any[]>([]);
  const selectedOrder = React.useMemo(() => orders.find(o => o.id === watchRefId), [orders, watchRefId]);

  React.useEffect(() => {
    const fetchOrders = async () => {
      if (!watchSiteId || !watchPayeeId) {
        setOrders([]);
        return;
      }
      const coll = watchType === 'PO' ? 'project_pos' : 'project_wos';
      const payeeField = watchType === 'PO' ? 'supplierId' : 'contractorId';
      const q = query(collection(firestore, coll), where('siteId', '==', watchSiteId), where(payeeField, '==', watchPayeeId));
      const snap = await getDocs(q);
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchOrders();
  }, [watchSiteId, watchType, watchPayeeId, firestore]);

  const remainingPayable = selectedOrder 
    ? (selectedOrder.totalAmount - (selectedOrder.paidAmount || 0)) 
    : 0;

  const onSubmit = async (values: z.infer<typeof paymentSchema>) => {
    if (values.amount > remainingPayable + 0.01) {
      toast({ variant: 'destructive', title: 'Overpayment Restricted', description: `Maximum allowed amount is ₹${remainingPayable.toFixed(2)}` });
      return;
    }

    setIsSubmitting(true);
    try {
      let proofUrl = "";
      if (proofFile) {
        const storage = getStorage(firebaseApp);
        const path = `payments/${user?.uid}/${Date.now()}_${proofFile.name}`;
        const sRef = ref(storage, path);
        await uploadBytesResumable(sRef, proofFile);
        proofUrl = await getDownloadURL(sRef);
      }

      await addDocumentNonBlocking(collection(firestore, 'payments'), {
        ...values,
        proofUrl,
        date: serverTimestamp(),
        recordedById: user?.uid,
        recordedByName: user?.displayName || user?.email
      });

      // Update source document totals
      const coll = values.paymentAgainst === 'PO' ? 'project_pos' : 'project_wos';
      const docRef = doc(firestore, coll, values.referenceId);
      updateDocumentNonBlocking(docRef, {
        paidAmount: increment(values.amount),
        lastPaymentDate: serverTimestamp()
      });

      toast({ title: 'Payment Recorded', description: 'Transaction logged and balances updated.' });
      router.push('/payments/project-wise');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSites = sites?.filter(s => s.name.toLowerCase().includes(siteSearch.toLowerCase())) || [];
  const payees = watchType === 'PO' ? suppliers : contractors;
  const filteredPayees = payees?.filter(p => p.name.toLowerCase().includes(payeeSearch.toLowerCase())) || [];
  const filteredRefs = orders.filter(o => (o.poNumber || o.woNumber).toLowerCase().includes(refSearch.toLowerCase()));

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20 px-4">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-primary">
          <HandCoins className="h-8 w-8" /> Record Payment
        </h1>
        <p className="text-muted-foreground font-medium">Log organizational disbursements against active purchase or work orders.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
            <CardHeader className="bg-primary/5 border-b py-4">
              <CardTitle className="text-sm font-black uppercase tracking-widest">Source & Target</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="siteId" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Project Site</FormLabel>
                    <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={cn("w-full justify-between h-11 rounded-sm", !field.value && "text-muted-foreground")}>
                            {field.value ? sites?.find(s => s.id === field.value)?.name : "Choose site..."}
                            <Building2 className="ml-2 h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <div className="flex items-center border-b px-3">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <Input placeholder="Search sites..." className="h-10 border-none" value={siteSearch} onChange={e => setSiteSearch(e.target.value)} />
                        </div>
                        <ScrollArea className="h-[200px]">
                          {filteredSites.map(s => (
                            <Button key={s.id} type="button" variant="ghost" className="w-full justify-start h-10 text-sm" onClick={() => { field.onChange(s.id); form.setValue('siteName', s.name); setIsSitePopoverOpen(false); }}>
                              {s.name}
                            </Button>
                          ))}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="paymentAgainst" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Payment Against</FormLabel>
                    <Select onValueChange={(val: any) => { field.onChange(val); form.setValue('payeeId', ''); form.setValue('referenceId', ''); }} value={field.value}>
                      <FormControl><SelectTrigger className="h-11 rounded-sm"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="PO">Purchase Order (PO)</SelectItem>
                        <SelectItem value="WO">Work Order (WO)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                <FormField control={form.control} name="payeeId" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">{watchType === 'PO' ? 'Supplier' : 'Contractor'}</FormLabel>
                    <Popover open={isPayeePopoverOpen} onOpenChange={setIsPayeePopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" disabled={!watchSiteId} className={cn("w-full justify-between h-11 rounded-sm", !field.value && "text-muted-foreground")}>
                            {field.value ? payees?.find(p => p.id === field.value)?.name : `Select ${watchType === 'PO' ? 'Supplier' : 'Contractor'}...`}
                            {watchType === 'PO' ? <Truck className="ml-2 h-4 w-4 opacity-50" /> : <HardHat className="ml-2 h-4 w-4 opacity-50" />}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <div className="flex items-center border-b px-3">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <Input placeholder="Search..." className="h-10 border-none" value={payeeSearch} onChange={e => setPayeeSearch(e.target.value)} />
                        </div>
                        <ScrollArea className="h-[200px]">
                          {filteredPayees.map(p => (
                            <Button key={p.id} type="button" variant="ghost" className="w-full justify-start h-10 text-sm" onClick={() => { field.onChange(p.id); form.setValue('payeeName', p.name); setIsPayeePopoverOpen(false); }}>
                              {p.name}
                            </Button>
                          ))}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="referenceId" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">{watchType} Reference</FormLabel>
                    <Popover open={isRefPopoverOpen} onOpenChange={setIsRefPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" disabled={!watchPayeeId} className={cn("w-full justify-between h-11 rounded-sm", !field.value && "text-muted-foreground")}>
                            {field.value ? (watchType === 'PO' ? selectedOrder?.poNumber : selectedOrder?.woNumber) : `Select ${watchType}...`}
                            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <div className="flex items-center border-b px-3">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <Input placeholder="Filter..." className="h-10 border-none" value={refSearch} onChange={e => setRefSearch(e.target.value)} />
                        </div>
                        <ScrollArea className="h-[200px]">
                          {filteredRefs.map(o => (
                            <Button key={o.id} type="button" variant="ghost" className="w-full justify-start h-10 text-xs font-mono" onClick={() => { field.onChange(o.id); form.setValue('referenceNumber', o.poNumber || o.woNumber); setIsRefPopoverOpen(false); }}>
                              {o.poNumber || o.woNumber} (₹{o.totalAmount.toLocaleString()})
                            </Button>
                          ))}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          {selectedOrder && (
            <Card className="rounded-sm border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-2 duration-300">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Total Order Value</p>
                    <p className="text-xl font-black font-mono">₹{selectedOrder.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Total Paid till date</p>
                    <p className="text-xl font-black font-mono text-blue-700">₹{(selectedOrder.paidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-primary tracking-widest">Remaining Balance</p>
                    <p className="text-2xl font-black font-mono text-primary">₹{remainingPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-sm font-black uppercase tracking-widest">Payment Attributes</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Amount to Pay (₹)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type="number" step="0.01" {...field} className="h-11 pl-8 font-mono font-bold" />
                        <span className="absolute left-3 top-3 text-muted-foreground font-bold">₹</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="paymentType" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Payment Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-11 rounded-sm"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Advance">Advance</SelectItem>
                        <SelectItem value="Part">Part Payment</SelectItem>
                        <SelectItem value="Final">Final Payment</SelectItem>
                        <SelectItem value="Full">Full Payment (Settlement)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                <FormField control={form.control} name="paymentMode" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Payment Mode</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-11 rounded-sm"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Bank Transfer">Bank Transfer (NEFT/RTGS)</SelectItem>
                        <SelectItem value="UPI">UPI</SelectItem>
                        <SelectItem value="Cheque">Cheque</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="paymentDetails" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Transaction Ref / Notes</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. UTR No. 123456789 or special remarks" {...field} className="h-11 rounded-sm" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="space-y-3">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                  <FileUp className="h-4 w-4" /> Payment Document / Proof
                </Label>
                <Input type="file" accept="image/*,application/pdf" onChange={e => setProofFile(e.target.files?.[0] || null)} className="h-auto py-2 border-dashed" />
              </div>
            </CardContent>
            <CardFooter className="bg-muted/10 border-t p-6 flex justify-end">
              <Button type="submit" disabled={isSubmitting || !watchRefId} className="h-12 px-10 font-black rounded-sm shadow-xl">
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loging...</> : <><Send className="mr-2 h-4 w-4" /> RECORD PAYMENT</>}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}
