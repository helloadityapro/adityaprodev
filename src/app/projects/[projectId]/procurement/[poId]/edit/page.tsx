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
  updateDocumentNonBlocking, 
  useFirebaseApp 
} from '@/firebase';
import { collection, doc, query, where, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
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
  ArrowLeft,
  Building2,
  Truck,
  CheckCircle2,
  Calendar,
  Send,
  ShieldCheck,
  AlertCircle,
  Save,
  Pencil
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const poItemSchema = z.object({
  bomItemId: z.string().min(1, 'Please select a material.'),
  itemName: z.string(),
  quantity: z.coerce.number().min(0.01, 'Quantity is required.'),
  rate: z.coerce.number().min(0.01, 'Unit price is required.'),
  gstPercent: z.coerce.number().min(0, 'GST is required.'),
  amount: z.number(),
});

const poSchema = z.object({
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
  poNumber: string;
  orderDate: string;
  supplierId: string;
  supplierName: string;
  items: any[];
  totalAmount: number;
};

export default function EditPOPage({ params }: { params: Promise<{ projectId: string, poId: string }> }) {
  const resolvedParams = React.use(params);
  const projectId = resolvedParams.projectId;
  const poId = resolvedParams.poId;
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [finalTotal, setFinalTotal] = React.useState(0);

  const [isSupplierPopoverOpen, setIsSupplierPopoverOpen] = React.useState(false);
  const [supplierSearch, setSupplierSearch] = React.useState("");
  const [openBomIndex, setOpenBomIndex] = React.useState<number | null>(null);
  const [bomSearch, setBomSearch] = React.useState("");

  const poRef = useMemoFirebase(() => doc(firestore, 'project_pos', poId), [firestore, poId]);
  const { data: poData, isLoading: poLoading } = useDoc<PurchaseOrder>(poRef);

  const projectRef = useMemoFirebase(() => doc(firestore, 'sites', projectId), [firestore, projectId]);
  const { data: site } = useDoc<Site>(projectRef);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);

  const suppliersQuery = useMemoFirebase(() => collection(firestore, 'suppliers'), [firestore]);
  const { data: allSuppliers } = useCollection<Supplier>(suppliersQuery);

  const approvedBomQuery = useMemoFirebase(() => query(collection(firestore, 'project_boms'), where('siteId', '==', projectId), where('status', '==', 'Approved')), [firestore, projectId]);
  const { data: approvedBomItems } = useCollection<BoMItem>(approvedBomQuery);

  const posQuery = useMemoFirebase(() => query(collection(firestore, 'project_pos'), where('siteId', '==', projectId)), [firestore, projectId]);
  const { data: existingPOs } = useCollection<PurchaseOrder>(posQuery);

  const form = useForm<z.infer<typeof poSchema>>({
    resolver: zodResolver(poSchema),
    defaultValues: { poNumber: "", orderDate: "", supplierId: "", supplierName: "", items: [{ bomItemId: "", itemName: "", quantity: 0, rate: 0, gstPercent: 18, amount: 0 }] },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  React.useEffect(() => {
    if (poData) {
      form.reset({
        poNumber: poData.poNumber,
        orderDate: poData.orderDate,
        supplierId: poData.supplierId,
        supplierName: poData.supplierName,
        items: poData.items.map(item => ({
          bomItemId: item.bomItemId,
          itemName: item.itemName,
          quantity: item.quantity,
          rate: item.rate,
          gstPercent: item.gstPercent || 18,
          amount: item.amount
        }))
      });
    }
  }, [poData, form]);

  const watchedItems = form.watch('items');

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
      if (Math.abs(item.amount - calculatedAmount) > 0.01) {
        form.setValue(`items.${index}.amount`, calculatedAmount);
      }
    });
  }, [watchedItems, form]);

  const consumedByOthers = React.useMemo(() => {
    const counts: Record<string, number> = {};
    if (!existingPOs) return counts;
    existingPOs.forEach(po => {
      if (po.id !== poId && po.status !== 'Cancelled') {
        po.items.forEach(item => {
          counts[item.bomItemId] = (counts[item.bomItemId] || 0) + (Number(item.quantity) || 0);
        });
      }
    });
    return counts;
  }, [existingPOs, poId]);

  const filteredBomItems = React.useMemo(() => {
    if (!approvedBomItems) return [];
    return approvedBomItems.map(item => {
      const consumed = consumedByOthers[item.id] || 0;
      const authorized = item.approvedQuantity || item.plannedQuantity || 0;
      return { ...item, remaining: Math.max(0, authorized - consumed), authorized };
    }).filter(i => i.itemName.toLowerCase().includes(bomSearch.toLowerCase()));
  }, [approvedBomItems, consumedByOthers, bomSearch]);

  const onSubmit = async (values: z.infer<typeof poSchema>) => {
    if (!user || !userProfile || !site || !poData) return;
    const newOrderCounts: Record<string, number> = {};
    for (const item of values.items) {
      const original = approvedBomItems?.find(i => i.id === item.bomItemId);
      const authorized = original?.approvedQuantity || original?.plannedQuantity || 0;
      const consumed = consumedByOthers[item.bomItemId] || 0;
      const remaining = authorized - consumed;
      newOrderCounts[item.bomItemId] = (newOrderCounts[item.bomItemId] || 0) + item.quantity;
      if (newOrderCounts[item.bomItemId] > remaining) {
        toast({ variant: 'destructive', title: 'Authorization Exceeded', description: `Line item "${item.itemName}" exceeds the remaining approved quantity (${remaining.toFixed(2)} ${original?.unit}). Please obtain additional quantity approval from the site BoM before proceeding.` });
        return;
      }
    }
    setIsSubmitting(true);
    try {
      const changes: string[] = [];
      if (values.poNumber !== poData.poNumber) changes.push(`PO Number changed from ${poData.poNumber}`);
      if (values.supplierId !== poData.supplierId) changes.push(`Supplier changed to ${values.supplierName}`);
      if (values.orderDate !== poData.orderDate) changes.push(`Order Date changed to ${values.orderDate}`);
      if (values.items.length !== poData.items.length) {
        changes.push(`Line items adjusted (${poData.items.length} to ${values.items.length})`);
      } else {
        const valueChanged = values.items.some((item, i) => item.quantity !== poData.items[i].quantity || item.rate !== poData.items[i].rate);
        if (valueChanged) changes.push("Material quantities or rates modified");
      }
      const historyEntry = { action: 'Modified', userName: userProfile.username || user.email, userId: user.uid, timestamp: new Date(), details: changes.length > 0 ? changes.join(', ') : 'Order metadata updated' };
      await updateDocumentNonBlocking(doc(firestore, 'project_pos', poId), {
        poNumber: values.poNumber, supplierId: values.supplierId, supplierName: values.supplierName, orderDate: values.orderDate, items: values.items, itemsCount: values.items.length, totalAmount, updatedAt: serverTimestamp(), updatedBy: user.uid, updatedByName: userProfile.username || user.email, history: arrayUnion(historyEntry)
      });
      setFinalTotal(totalAmount);
      setIsSuccess(true);
      toast({ title: 'PO Updated', description: `Order ${values.poNumber} has been modified.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (poLoading) return <div className="p-20 text-center"><Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" /></div>;

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full animate-in fade-in zoom-in-95 duration-300 rounded-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><div className="bg-primary/10 p-4 rounded-full"><CheckCircle2 className="h-12 w-12 text-primary" /></div></div>
            <CardTitle className="text-2xl font-bold uppercase tracking-tight">PO Updated</CardTitle>
            <CardDescription className="text-base leading-relaxed">Purchase Order total value: <strong className="text-primary font-black">₹{finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4"><Button className="w-full h-12 text-lg font-semibold rounded-sm shadow-md" onClick={() => router.push(`/projects/${projectId}?tab=po`)}>Back to Procurement</Button></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20 px-4">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary"><ArrowLeft className="mr-2 h-4 w-4" /> Cancel Edit</Button>
        <h1 className="flex items-center gap-2"><Pencil className="h-8 w-8 text-primary" /> Edit Purchase Order</h1>
        <p className="text-muted-foreground font-medium">Update quantities or details for authorized materials.</p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
          <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden"><CardHeader className="bg-primary/5 border-b"><CardTitle className="text-sm font-black uppercase tracking-widest">Order Context</CardTitle></CardHeader><CardContent className="pt-6"><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><FormField control={form.control} name="poNumber" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">PO Number</FormLabel><FormControl><Input placeholder="e.g. AGEPL/PO/2026/001" {...field} className="h-11 rounded-sm uppercase font-mono font-bold" /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="orderDate" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Order Date</FormLabel><FormControl><div className="relative"><Input type="date" {...field} className="h-11 rounded-sm pr-10" /><Calendar className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground pointer-events-none" /></div></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="supplierId" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Select Supplier</FormLabel><Popover open={isSupplierPopoverOpen} onOpenChange={setIsSupplierPopoverOpen}><PopoverTrigger asChild><FormControl><Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal rounded-sm h-11", !field.value && "text-muted-foreground")}>{field.value ? allSuppliers?.find(s => s.id === field.value)?.name : "Choose Vendor..."}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start"><div className="flex items-center border-b px-3"><Search className="mr-2 h-4 w-4 shrink-0 opacity-50" /><Input placeholder="Search vendors..." className="h-10 w-full border-none focus-visible:ring-0 px-0 text-sm" value={supplierSearch} onChange={(e) => setSupplierSearch(e.target.value)} /></div><ScrollArea className="h-[200px]"><div className="p-1">{allSuppliers?.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase())).map((s) => (<Button key={s.id} type="button" variant="ghost" className="w-full justify-start font-normal h-11 text-xs" onClick={() => { field.onChange(s.id); form.setValue('supplierName', s.name); setIsSupplierPopoverOpen(false); setSupplierSearch(""); }}><Check className={cn("mr-2 h-4 w-4 text-primary", s.id === field.value ? "opacity-100" : "opacity-0")} /><div className="flex flex-col items-start"><span className="font-bold">{s.name}</span><span className="text-[8px] font-mono text-muted-foreground">{s.gstin}</span></div></Button>))}</div></ScrollArea></PopoverContent></Popover><FormMessage /></FormItem>)} /></div></CardContent></Card>
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b pb-2 px-1"><div className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /><h3 className="text-sm font-black uppercase tracking-widest text-foreground">Order Line Items</h3></div><Button type="button" variant="outline" size="sm" onClick={() => append({ bomItemId: "", itemName: "", quantity: 0, rate: 0, gstPercent: 18, amount: 0 })} className="h-8 rounded-sm font-bold border-primary text-primary hover:bg-primary/5"><Plus className="h-3.5 w-3.5 mr-1.5" /> Add Row</Button></div>
            <div className="space-y-4">
              {fields.map((field, index) => {
                const qty = Number(watchedItems[index]?.quantity) || 0;
                const rate = Number(watchedItems[index]?.rate) || 0;
                const gst = Number(watchedItems[index]?.gstPercent) || 0;
                const lineTotal = (qty * rate) * (1 + (gst / 100));
                const selectedBomItem = filteredBomItems?.find(i => i.id === watchedItems[index]?.bomItemId);
                const maxRemaining = selectedBomItem?.remaining || 0;
                return (
                  <div key={field.id} className="p-6 border rounded-sm bg-muted/5 relative animate-in fade-in slide-in-from-top-2 duration-300">
                    {fields.length > 1 && (<Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 text-destructive hover:bg-destructive/10 rounded-sm" onClick={() => remove(index)}><Trash2 className="h-3.5 w-3.5" /></Button>)}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                      <div className="md:col-span-3"><FormField control={form.control} name={`items.${index}.bomItemId`} render={({ field: bomField }) => (<FormItem className="flex flex-col"><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Authorized Material</FormLabel><Popover open={openBomIndex === index} onOpenChange={(o) => setOpenBomIndex(o ? index : null)}><PopoverTrigger asChild><FormControl><Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal h-10 rounded-sm bg-background border-primary/10", !bomField.value && "text-muted-foreground")}><span className="truncate">{bomField.value ? approvedBomItems?.find(i => i.id === bomField.value)?.itemName : "Select Item..."}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-[350px] p-0" align="start"><div className="flex items-center border-b px-3"><Search className="mr-2 h-4 w-4 shrink-0 opacity-50" /><Input placeholder="Filter materials..." className="h-10 w-full border-none focus-visible:ring-0 px-0 text-sm" value={bomSearch} onChange={(e) => setBomSearch(e.target.value)} /></div><ScrollArea className="h-[200px]"><div className="p-1">{filteredBomItems.length > 0 ? filteredBomItems.map((item) => (<Button key={item.id} type="button" variant="ghost" className="w-full justify-start font-normal h-11 text-xs" onClick={() => { bomField.onChange(item.id); form.setValue(`items.${index}.itemName`, item.itemName); setOpenBomIndex(null); setBomSearch(""); }}><Check className={cn("mr-2 h-4 w-4 text-primary", item.id === bomField.value ? "opacity-100" : "opacity-0")} /><div className="flex flex-col items-start overflow-hidden"><span className="font-bold truncate w-full">{item.itemName}</span><span className="text-[8px] font-black uppercase text-muted-foreground">Limit: {item.authorized} {item.unit} (Left: {item.remaining.toFixed(2)})</span></div></Button>)) : (<div className="p-8 text-center text-[10px] font-black uppercase text-muted-foreground italic">No authorized items found.</div>)}</div></ScrollArea></PopoverContent></Popover><FormMessage /></FormItem>)} /></div>
                      <div className="md:col-span-2"><div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-primary" /> Remaining Limit</Label><div className="h-10 px-3 bg-muted/20 border border-border/50 rounded-sm flex items-center justify-between text-[11px] font-bold text-muted-foreground"><span>{maxRemaining.toFixed(2)}</span><span className="opacity-50 uppercase text-[8px]">{selectedBomItem?.unit}</span></div></div></div>
                      <div className="md:col-span-2"><FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Order Quantity</FormLabel><FormControl><div className="relative"><Input type="number" step="0.01" {...field} className={cn("h-10 rounded-sm bg-background font-mono font-bold", qty > maxRemaining && "border-destructive text-destructive")} />{qty > maxRemaining && (<div className="absolute -bottom-5 left-0 text-[8px] font-black text-destructive uppercase tracking-tight flex items-center gap-1"><AlertCircle className="h-2.5 w-2.5" /> Over limit</div>)}</div></FormControl><FormMessage /></FormItem>)} /></div>
                      <div className="md:col-span-2"><FormField control={form.control} name={`items.${index}.rate`} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Unit Rate (₹)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-10 rounded-sm bg-background font-mono font-bold" /></FormControl><FormMessage /></FormItem>)} /></div>
                      <div className="md:col-span-1"><FormField control={form.control} name={`items.${index}.gstPercent`} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Tax %</FormLabel><FormControl><div className="relative"><Input type="number" {...field} className="h-10 rounded-sm bg-background font-mono font-bold pr-6 px-2 text-center" /><span className="absolute right-1.5 top-2.5 text-[10px] font-bold text-muted-foreground">%</span></div></FormControl><FormMessage /></FormItem>)} /></div>
                      <div className="md:col-span-2"><div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Line Total (₹)</Label><div className="h-10 px-3 bg-primary/5 border border-primary/10 rounded-sm flex items-center justify-end font-mono font-black text-primary text-sm shadow-inner">{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></div></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="p-8 bg-primary/5 rounded-sm border-2 border-primary/10 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl"><div className="flex items-center gap-4"><div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary border-4 border-primary/5"><Save className="h-8 w-8" /></div><div className="flex flex-col"><span className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] leading-none mb-1">Adjusted PO Value (Incl. Taxes)</span><span className="text-4xl font-black text-primary tabular-nums">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div></div><div className="flex gap-3 w-full sm:w-auto"><Button type="button" variant="ghost" onClick={() => router.back()} className="h-14 px-8 font-bold uppercase text-xs tracking-widest rounded-sm">Cancel</Button><Button type="submit" disabled={isSubmitting || totalAmount <= 0} className="w-full sm:w-auto h-14 px-12 font-black text-lg rounded-sm shadow-xl">{isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> SAVING...</> : <><Save className="mr-2 h-4 w-4" /> SAVE CHANGES</>}</Button></div></div>
        </form>
      </Form>
    </div>
  );
}
