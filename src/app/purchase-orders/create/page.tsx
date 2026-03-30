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
  addDocumentNonBlocking, 
  useFirebaseApp 
} from '@/firebase';
import { collection, doc, query, where, serverTimestamp, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { 
  ShoppingBag, 
  Plus, 
  Trash2, 
  Loader2, 
  Search, 
  Check, 
  ChevronsUpDown, 
  Building2,
  Truck,
  CheckCircle2,
  Calendar,
  Send,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { isSuperAdmin } from '@/lib/auth-constants';

const poItemSchema = z.object({
  bomItemId: z.string().min(1, 'Please select a material.'),
  itemName: z.string(),
  quantity: z.coerce.number().min(0.01, 'Quantity is required.'),
  rate: z.coerce.number().min(0.01, 'Unit price is required.'),
  gstPercent: z.coerce.number().min(0, 'GST is required.'),
  amount: z.number(),
});

const poSchema = z.object({
  siteId: z.string().min(1, 'Please select a project site.'),
  siteName: z.string(),
  poNumber: z.string().min(3, 'PO Number is required.'),
  orderDate: z.string().min(1, 'Date is required.'),
  supplierId: z.string().min(1, 'Please select a supplier.'),
  supplierName: z.string(),
  items: z.array(poItemSchema).min(1, 'At least one item is required.'),
});

type Site = {
  id: string;
  name: string;
  projectCompany: string;
};

type Supplier = {
  id: string;
  name: string;
  gstin: string;
};

type BoMItem = {
  id: string;
  itemName: string;
  unit: string;
  approvedQuantity?: number;
  plannedQuantity: number;
  status: string;
};

type PurchaseOrder = {
  id: string;
  siteId: string;
  status: string;
  items: { bomItemId: string; quantity: number }[];
};

export default function GlobalCreatePOPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [finalTotal, setFinalTotal] = React.useState(0);

  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearch, setSiteSearch] = React.useState("");
  const [isSupplierPopoverOpen, setIsSupplierPopoverOpen] = React.useState(false);
  const [supplierSearch, setSupplierSearch] = React.useState("");
  const [openBomIndex, setOpenBomIndex] = React.useState<number | null>(null);
  const [bomSearch, setBomSearch] = React.useState("");

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isProcurement = isAdmin || userProfile?.department === 'Procurement and Supply-chain';

  React.useEffect(() => {
    if (!isProfileLoading && user && !isProcurement) {
      router.replace('/ptw/list');
    }
  }, [user, isProfileLoading, isProcurement, router]);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const suppliersQuery = useMemoFirebase(() => collection(firestore, 'suppliers'), [firestore]);
  const { data: allSuppliers } = useCollection<Supplier>(suppliersQuery);

  const [approvedBomItems, setApprovedBomItems] = React.useState<BoMItem[]>([]);
  const [sitePOs, setSitePOs] = React.useState<PurchaseOrder[]>([]);

  const form = useForm<z.infer<typeof poSchema>>({
    resolver: zodResolver(poSchema),
    defaultValues: {
      siteId: "",
      siteName: "",
      poNumber: "",
      orderDate: format(new Date(), 'yyyy-MM-dd'),
      supplierId: "",
      supplierName: "",
      items: [{ bomItemId: "", itemName: "", quantity: 0, rate: 0, gstPercent: 18, amount: 0 }]
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

  const selectedSiteId = form.watch('siteId');

  // Load site-specific context when site changes
  React.useEffect(() => {
    if (selectedSiteId) {
      const fetchContext = async () => {
        const bomQ = query(collection(firestore, 'project_boms'), where('siteId', '==', selectedSiteId), where('status', '==', 'Approved'));
        const bomSnap = await getDocs(bomQ);
        setApprovedBomItems(bomSnap.docs.map(d => ({ id: d.id, ...d.data() } as BoMItem)));

        const posQ = query(collection(firestore, 'project_pos'), where('siteId', '==', selectedSiteId));
        const posSnap = await getDocs(posQ);
        setSitePOs(posSnap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrder)));
      };
      fetchContext();
    } else {
      setApprovedBomItems([]);
      setSitePOs([]);
    }
  }, [selectedSiteId, firestore]);

  const consumedQuantities = React.useMemo(() => {
    const counts: Record<string, number> = {};
    sitePOs.forEach(po => {
      if (po.status !== 'Cancelled') {
        po.items.forEach(item => {
          counts[item.bomItemId] = (counts[item.bomItemId] || 0) + (Number(item.quantity) || 0);
        });
      }
    });
    return counts;
  }, [sitePOs]);

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

  const filteredSuppliers = allSuppliers?.filter(s => 
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    s.gstin.toLowerCase().includes(supplierSearch.toLowerCase())
  ) || [];

  const filteredBomItems = React.useMemo(() => {
    if (!approvedBomItems) return [];
    return approvedBomItems.map(item => {
      const consumed = consumedQuantities[item.id] || 0;
      const authorized = item.approvedQuantity || item.plannedQuantity || 0;
      return { ...item, remaining: Math.max(0, authorized - consumed), authorized };
    }).filter(i => i.remaining > 0 && i.itemName.toLowerCase().includes(bomSearch.toLowerCase()));
  }, [approvedBomItems, consumedQuantities, bomSearch]);

  const onSubmit = async (values: z.infer<typeof poSchema>) => {
    if (!user || !userProfile) return;
    
    // Authorization Check
    const newOrderCounts: Record<string, number> = {};
    for (const item of values.items) {
      const original = approvedBomItems?.find(i => i.id === item.bomItemId);
      const authorized = original?.approvedQuantity || original?.plannedQuantity || 0;
      const consumed = consumedQuantities[item.bomItemId] || 0;
      const remaining = authorized - consumed;
      newOrderCounts[item.bomItemId] = (newOrderCounts[item.bomItemId] || 0) + item.quantity;
      if (newOrderCounts[item.bomItemId] > remaining) {
        toast({ variant: 'destructive', title: 'Authorization Exceeded', description: `Line item "${item.itemName}" exceeds remaining approved quantity (${remaining.toFixed(2)} ${original?.unit}).` });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const historyEntry = {
        action: 'Created',
        userName: userProfile.username || user.email,
        userId: user.uid,
        timestamp: new Date(),
        details: `Order generated for ₹${totalAmount.toLocaleString('en-IN')}`
      };

      await addDocumentNonBlocking(collection(firestore, 'project_pos'), {
        siteId: values.siteId,
        siteName: values.siteName,
        poNumber: values.poNumber,
        supplierId: values.supplierId,
        supplierName: values.supplierName,
        orderDate: values.orderDate,
        items: values.items,
        itemsCount: values.items.length,
        totalAmount,
        status: 'Open',
        createdAt: serverTimestamp(),
        createdByName: userProfile.username || user.email,
        history: [historyEntry]
      });

      setFinalTotal(totalAmount);
      setIsSuccess(true);
      toast({ title: 'PO Created', description: `Purchase Order ${values.poNumber} has been logged.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isProfileLoading || !user) return <div className="p-20 text-center"><Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" /></div>;

  if (!isProcurement) return null;

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full animate-in fade-in zoom-in-95 duration-300 rounded-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><div className="bg-primary/10 p-4 rounded-full"><CheckCircle2 className="h-12 w-12 text-primary" /></div></div>
            <CardTitle className="text-2xl font-bold uppercase tracking-tight">PO Generated</CardTitle>
            <CardDescription className="text-base leading-relaxed">Purchase Order for <strong className="text-primary font-black">₹{finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> has been generated successfully.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full h-12 text-lg font-semibold rounded-sm shadow-md" onClick={() => router.push('/purchase-orders/manage')}>Manage All POs</Button>
            <Button variant="outline" className="w-full h-11 rounded-sm font-bold" onClick={() => { setIsSuccess(false); form.reset(); }}>Create Another</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20 px-4">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2"><ShoppingBag className="h-8 w-8 text-primary" /> Add New Purchase Order</h1>
        <p className="text-muted-foreground font-medium">Issue formal purchase orders across organizational project sites.</p>
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

                <FormField control={form.control} name="supplierId" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Vendor / Supplier</FormLabel>
                    <Popover open={isSupplierPopoverOpen} onOpenChange={setIsSupplierPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal rounded-sm h-11", !field.value && "text-muted-foreground")}>
                            {field.value ? allSuppliers?.find(s => s.id === field.value)?.name : "Choose Supplier..."}
                            <Truck className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <div className="flex items-center border-b px-3">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <Input placeholder="Search vendors..." className="h-10 w-full border-none focus-visible:ring-0 px-0 text-sm" value={supplierSearch} onChange={(e) => setSupplierSearch(e.target.value)} />
                        </div>
                        <ScrollArea className="h-[200px]">
                          <div className="p-1">
                            {filteredSuppliers.map((s) => (
                              <Button key={s.id} type="button" variant="ghost" className="w-full justify-start font-normal h-11 text-xs" onClick={() => { field.onChange(s.id); form.setValue('supplierName', s.name); setIsSupplierPopoverOpen(false); setSupplierSearch(""); }}>
                                <Check className={cn("mr-2 h-4 w-4 text-primary", s.id === field.value ? "opacity-100" : "opacity-0")} />
                                <div className="flex flex-col items-start"><span className="font-bold">{s.name}</span><span className="text-[8px] font-mono text-muted-foreground">{s.gstin}</span></div>
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
                <FormField control={form.control} name="poNumber" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">PO Serial Number</FormLabel><FormControl><Input placeholder="e.g. AGEPL/PO/2026/001" {...field} className="h-11 rounded-sm uppercase font-mono font-bold" /></FormControl><FormMessage /></FormItem>
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
                <ShoppingBag className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Line Items</h3>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ bomItemId: "", itemName: "", quantity: 0, rate: 0, gstPercent: 18, amount: 0 })} className="h-8 rounded-sm font-bold border-primary text-primary" disabled={!selectedSiteId}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Row
              </Button>
            </div>

            {!selectedSiteId && (
              <div className="p-12 border-2 border-dashed rounded-sm bg-muted/5 flex flex-col items-center justify-center text-center">
                <Building2 className="h-8 w-8 text-muted-foreground/20 mb-3" />
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Select a project site first to load approved BoM items</p>
              </div>
            )}

            <div className="space-y-4">
              {fields.map((field, index) => {
                const qty = Number(watchedItems[index]?.quantity) || 0;
                const rate = Number(watchedItems[index]?.rate) || 0;
                const gst = Number(watchedItems[index]?.gstPercent) || 0;
                const lineTotal = (qty * rate) * (1 + (gst / 100));
                const selectedBomItem = filteredBomItems?.find(i => i.id === watchedItems[index]?.bomItemId);
                const maxRemaining = selectedBomItem?.remaining || 0;

                return (
                  <div key={field.id} className="p-6 border rounded-sm bg-muted/5 relative animate-in fade-in slide-in-from-top-2">
                    {fields.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 text-destructive" onClick={() => remove(index)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                      <div className="md:col-span-3">
                        <FormField control={form.control} name={`items.${index}.bomItemId`} render={({ field: bomField }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Material Selection (from site BoM)</FormLabel>
                            <Popover open={openBomIndex === index} onOpenChange={(o) => setOpenBomIndex(o ? index : null)}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal h-10 rounded-sm bg-background border-primary/10", !bomField.value && "text-muted-foreground")}>
                                    <span className="truncate">{bomField.value ? approvedBomItems?.find(i => i.id === bomField.value)?.itemName : "Select Item..."}</span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-[350px] p-0" align="start">
                                <div className="flex items-center border-b px-3">
                                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                  <Input placeholder="Filter materials..." className="h-10 w-full border-none focus-visible:ring-0 px-0 text-sm" value={bomSearch} onChange={(e) => setBomSearch(e.target.value)} />
                                </div>
                                <ScrollArea className="h-[200px]">
                                  <div className="p-1">
                                    {filteredBomItems.length > 0 ? filteredBomItems.map((item) => (
                                      <Button key={item.id} type="button" variant="ghost" className="w-full justify-start font-normal h-11 text-xs" onClick={() => { bomField.onChange(item.id); form.setValue(`items.${index}.itemName`, item.itemName); setOpenBomIndex(null); setBomSearch(""); }}>
                                        <Check className={cn("mr-2 h-4 w-4 text-primary", item.id === bomField.value ? "opacity-100" : "opacity-0")} />
                                        <div className="flex flex-col items-start overflow-hidden"><span className="font-bold truncate w-full">{item.itemName}</span><span className="text-[8px] font-black uppercase text-muted-foreground">Remaining: {item.remaining.toFixed(2)} {item.unit}</span></div>
                                      </Button>
                                    )) : (<div className="p-8 text-center text-[10px] font-black uppercase text-muted-foreground italic leading-relaxed">No authorized items with remaining balance found.</div>)}
                                  </div>
                                </ScrollArea>
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      
                      <div className="md:col-span-2">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-primary" /> Remaining Limit</Label>
                          <div className="h-10 px-3 bg-muted/20 border border-border/50 rounded-sm flex items-center justify-between text-[11px] font-bold text-muted-foreground"><span>{maxRemaining.toFixed(2)}</span><span className="opacity-50 uppercase text-[8px]">{selectedBomItem?.unit}</span></div>
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Order Qty</FormLabel>
                            <FormControl><div className="relative"><Input type="number" step="0.01" {...field} className={cn("h-10 rounded-sm bg-background font-mono font-bold", qty > maxRemaining && "border-destructive text-destructive")} />{qty > maxRemaining && (<div className="absolute -bottom-5 left-0 text-[8px] font-black text-destructive uppercase tracking-tight flex items-center gap-1"><AlertCircle className="h-2.5 w-2.5" /> Balance exceeded</div>)}</div></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <div className="md:col-span-2">
                        <FormField control={form.control} name={`items.${index}.rate`} render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Unit Rate (₹)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-10 rounded-sm bg-background font-mono font-bold" /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>

                      <div className="md:col-span-1">
                        <FormField control={form.control} name={`items.${index}.gstPercent`} render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Tax %</FormLabel><FormControl><Input type="number" {...field} className="h-10 rounded-sm bg-background font-mono font-bold text-center" /></FormControl><FormMessage /></FormItem>
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

          <div className="p-8 bg-primary/5 rounded-sm border-2 border-primary/10 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary border-4 border-primary/5"><CheckCircle2 className="h-8 w-8" /></div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] leading-none mb-1">Final PO Value (Incl. Taxes)</span>
                <span className="text-4xl font-black text-primary tabular-nums">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <Button type="submit" disabled={isSubmitting || totalAmount <= 0} className="w-full sm:w-auto h-14 px-12 font-black text-lg rounded-sm shadow-xl">
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> GENERATING...</> : <><Send className="mr-2 h-4 w-4" /> GENERATE PURCHASE ORDER</>}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
