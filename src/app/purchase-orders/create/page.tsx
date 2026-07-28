"use client";

import * as React from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { 
  useFirestore, 
  useUser, 
  useDoc, 
  useMemoFirebase, 
  useCollection, 
  addDocumentNonBlocking, 
  updateDocumentNonBlocking,
  useFirebaseApp 
} from "@/firebase";
import { collection, doc, query, where, serverTimestamp, getDocs, increment } from "firebase/firestore";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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
  FileUp,
  Send,
  ShieldCheck,
  AlertCircle,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  ListPlus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isSuperAdmin } from '@/lib/auth-constants';

const poItemSchema = z.object({
  bomItemId: z.string().min(1, 'Please select a material.'),
  itemName: z.string(),
  quantity: z.coerce.number().min(0.01, 'Quantity is required.'),
  rate: z.coerce.number().min(0.01, 'Unit price is required.'),
  gstPercent: z.coerce.number().min(0, 'GST is required.'),
  amount: z.number(),
  isAssociated: z.boolean().optional().default(false),
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
  subItems?: { name: string; quantityPerSet: number; unit: string }[];
};

type PurchaseOrder = {
  id: string;
  siteId: string;
  status: string;
  items: { bomItemId: string; quantity: number; isAssociated?: boolean }[];
};

export default function CreatePOPage() {
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  // State Management - Moved to top for consistency
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearch, setSiteSearch] = React.useState("");
  const [isSupplierPopoverOpen, setIsSupplierPopoverOpen] = React.useState(false);
  const [supplierSearch, setSupplierSearch] = React.useState("");
  const [openBomIndex, setOpenBomIndex] = React.useState<number | null>(null);
  const [bomSearch, setBomSearch] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<Record<number, number>>({});
  const [finalTotal, setFinalTotal] = React.useState(0);
  
  // Set Interaction State
  const [expandedAssociated, setExpandedAssociated] = React.useState<Set<number>>(new Set());

  const toggleAssociated = (index: number) => {
    const next = new Set(expandedAssociated);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setExpandedAssociated(next);
  };

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites, isLoading: sitesLoading } = useCollection<Site>(sitesQuery);

  const suppliersQuery = useMemoFirebase(() => collection(firestore, 'suppliers'), [firestore]);
  const { data: allSuppliers, isLoading: suppliersLoading } = useCollection<Supplier>(suppliersQuery);

  const form = useForm<z.infer<typeof poSchema>>({
    resolver: zodResolver(poSchema),
    defaultValues: {
      siteId: "",
      siteName: "",
      poNumber: "",
      orderDate: format(new Date(), 'yyyy-MM-dd'),
      supplierId: "",
      supplierName: "",
      items: [{ bomItemId: "", itemName: "", quantity: 0, rate: 0, gstPercent: 18, amount: 0, isAssociated: false }]
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

  const watchSiteId = form.watch('siteId');

  const approvedBomQuery = useMemoFirebase(() => 
    watchSiteId ? query(collection(firestore, 'project_boms'), where('siteId', '==', watchSiteId), where('status', '==', 'Approved')) : null,
    [firestore, watchSiteId]
  );
  const { data: approvedBomItems } = useCollection<BoMItem>(approvedBomQuery);

  const posQuery = useMemoFirebase(() => 
    watchSiteId ? query(collection(firestore, 'project_pos'), where('siteId', '==', watchSiteId)) : null, 
    [firestore, watchSiteId]
  );
  const { data: existingPOs } = useCollection<PurchaseOrder>(posQuery);

  const consumedQuantities = React.useMemo(() => {
    const counts: Record<string, number> = {};
    if (!existingPOs) return counts;
    existingPOs.forEach(po => {
      if (po.status !== 'Cancelled') {
        po.items.forEach(item => {
          if (!item.isAssociated) {
            counts[item.bomItemId] = (counts[item.bomItemId] || 0) + (Number(item.quantity) || 0);
          }
        });
      }
    });
    return counts;
  }, [existingPOs]);

  const totalAmount = React.useMemo(() => {
    return watchedItems.reduce((sum, item) => {
      if (!item) return sum;
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const gst = Number(item.gstPercent) || 0;
      const lineTotal = (qty * rate) * (1 + (gst / 100));
      return sum + lineTotal;
    }, 0);
  }, [watchedItems]);

  React.useEffect(() => {
    watchedItems.forEach((item, index) => {
      if (!item) return;
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const gst = Number(item.gstPercent) || 0;
      const calculatedAmount = (qty * rate) * (1 + (gst / 100));
      
      if (Math.abs((item.amount || 0) - calculatedAmount) > 0.01) {
        form.setValue(`items.${index}.amount`, calculatedAmount);
      }
    });
  }, [watchedItems, form]);

  const onSubmit = async (values: z.infer<typeof poSchema>) => {
    if (!user || !userProfile) return;
    
    const newOrderCounts: Record<string, number> = {};
    for (const item of values.items) {
      if (item.isAssociated) continue; 

      const original = approvedBomItems?.find(i => i.id === item.bomItemId);
      const authorized = original?.approvedQuantity || original?.plannedQuantity || 0;
      const consumed = consumedQuantities[item.bomItemId] || 0;
      const remaining = authorized - consumed;
      
      newOrderCounts[item.bomItemId] = (newOrderCounts[item.bomItemId] || 0) + item.quantity;
      
      if (newOrderCounts[item.bomItemId] > remaining + 0.001) {
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
        details: `Initial order generated for ₹${totalAmount.toLocaleString('en-IN')}`
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
        status: 'Pending',
        createdAt: serverTimestamp(),
        createdByName: userProfile.username || user.email,
        history: [historyEntry]
      });

      setIsSuccess(true);
      toast({ title: 'PO Created', description: `Purchase Order ${values.poNumber} has been recorded.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const uploadProof = async (file: File, userId: string, index: number): Promise<string | null> => {
    if (!file) return null;
    const storage = getStorage(firebaseApp);
    const timestamp = Date.now();
    const storagePath = `expenses/${userId}/${timestamp}_item_${index}_${file.name.replace(/\s+/g, '_')}`;
    const storageRef = ref(storage, storagePath);
    
    const uploadTask = uploadBytesResumable(storageRef, file);
    
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(prev => ({ ...prev, [index]: progress }));
        }, 
        (error) => {
          console.error("Proof upload failed:", error);
          reject(error);
        }, 
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(url);
        }
      );
    });
  };

  const filteredSites = allSites?.filter(s => 
    s.name.toLowerCase().includes(siteSearch.toLowerCase()) ||
    s.projectCompany.toLowerCase().includes(siteSearch.toLowerCase())
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

  if (isProfileLoading || isUserLoading || sitesLoading || suppliersLoading || !user) return <div className="p-20 text-center"><Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" /></div>;

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full animate-in fade-in zoom-in-95 duration-300 rounded-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><div className="bg-primary/10 p-4 rounded-full"><CheckCircle2 className="h-12 w-12 text-primary" /></div></div>
            <CardTitle className="text-2xl font-bold uppercase tracking-tight">PO Generated</CardTitle>
            <CardDescription className="text-base leading-relaxed">Purchase Order for <strong className="text-primary font-black">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> has been generated successfully.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full h-12 text-lg font-semibold rounded-sm shadow-md" onClick={() => router.push('/purchase-orders/manage')}>Manage All POs</Button>
            <Button variant="outline" className="w-full h-11 rounded-sm font-bold" onClick={() => { setIsSuccess(false); form.reset(); }}>Create Another PO</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20 px-4">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary"><ArrowLeft className="mr-2 h-4 w-4" /> Cancel</Button>
        <h1 className="flex items-center gap-2"><ShoppingBag className="h-8 w-8 text-primary" /> Create Purchase Order</h1>
        <p className="text-muted-foreground font-medium">Link procurement line items to authorized site materials.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
          <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
            <CardHeader className="bg-primary/5 border-b"><CardTitle className="text-sm font-black uppercase tracking-widest">Order Context</CardTitle></CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="siteId" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Target Project Site</FormLabel>
                    <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal rounded-sm h-11 text-left", !field.value && "text-muted-foreground")}>
                            {field.value ? allSites?.find(s => s.id === field.value)?.name : "Select site..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                              <Button key={s.id} type="button" variant="ghost" className="w-full justify-start h-auto py-2.5 px-3 mb-0.5 text-xs text-left" onClick={() => { 
                                field.onChange(s.id); 
                                form.setValue('siteName', s.name); 
                                setIsSitePopoverOpen(false); 
                                setSiteSearch("");
                                form.setValue('items', [{ bomItemId: "", itemName: "", quantity: 0, rate: 0, gstPercent: 18, amount: 0, isAssociated: false }]);
                              }}>
                                <Check className={cn("mr-2 h-4 w-4 text-primary", s.id === field.value ? "opacity-100" : "opacity-0")} />
                                <div className="flex flex-col items-start overflow-hidden">
                                  <span className="font-bold truncate w-full">{s.name}</span>
                                  <span className="text-[9px] text-muted-foreground uppercase">{s.projectCompany}</span>
                                </div>
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
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Select Supplier</FormLabel>
                    <Popover open={isSupplierPopoverOpen} onOpenChange={setIsSupplierPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal rounded-sm h-11", !field.value && "text-muted-foreground")}>
                            {field.value ? allSuppliers?.find(s => s.id === field.value)?.name : "Choose Vendor..."}
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
                  <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">PO Number</FormLabel><FormControl><Input placeholder="e.g. AGEPL/PO/2026/001" {...field} className="h-11 rounded-sm uppercase font-mono font-bold" /></FormControl><FormMessage /></FormItem>
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
                <Truck className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Order Line Items</h3>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ bomItemId: "", itemName: "", quantity: 0, rate: 0, gstPercent: 18, amount: 0, isAssociated: false })} className="h-8 rounded-sm font-bold border-primary text-primary hover:bg-primary/5">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Row
              </Button>
            </div>

            <div className="space-y-4">
              {fields.map((field, index) => {
                const item = watchedItems[index];
                if (!item) return <div key={field.id} className="h-20 bg-muted/5 animate-pulse" />;

                const selectedBomItem = approvedBomItems?.find(i => i.id === item.bomItemId);
                const maxRemaining = selectedBomItem ? (selectedBomItem.remaining || 0) : 0;
                const isSet = selectedBomItem?.unit === 'Sets';

                return (
                  <div key={field.id} className="space-y-2">
                    <div className={cn(
                      "p-4 sm:p-6 border rounded-sm relative animate-in fade-in duration-300", 
                      item.isAssociated ? "bg-primary/[0.01] border-primary/5 ml-4 sm:ml-12" : "bg-muted/5"
                    )}>
                      {fields.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 text-destructive hover:bg-destructive/10 rounded-sm" onClick={() => remove(index)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                        <div className="md:col-span-3">
                          <FormField control={form.control} name={`items.${index}.bomItemId`} render={({ field: bomField }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Material</FormLabel>
                              {item.isAssociated ? (
                                <div className="h-10 flex items-center">
                                  <p className="text-xs font-bold text-primary truncate" title={item.itemName}>{item.itemName}</p>
                                </div>
                              ) : (
                                <Popover open={openBomIndex === index} onOpenChange={(o) => setOpenBomIndex(o ? index : null)}>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button variant="outline" role="combobox" disabled={!watchSiteId} className={cn("w-full justify-between font-normal h-10 rounded-sm bg-background border-primary/10", !bomField.value && "text-muted-foreground")}>
                                        <span className="truncate">{bomField.value ? item.itemName : "Select Item..."}</span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[450px] p-0 shadow-2xl" align="start">
                                    <div className="flex items-center border-b px-3">
                                      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                      <Input placeholder="Filter materials..." className="h-10 w-full border-none focus-visible:ring-0 px-0 text-sm" value={bomSearch} onChange={(e) => setBomSearch(e.target.value)} />
                                    </div>
                                    <ScrollArea className="h-[200px]">
                                      <div className="p-1">
                                        {filteredBomItems.length > 0 ? filteredBomItems.map((bi) => (
                                          <Button key={bi.id} type="button" variant="ghost" className="w-full justify-start h-auto py-2.5 px-3 mb-0.5 text-xs text-left rounded-sm" onClick={() => { 
                                            bomField.onChange(bi.id); 
                                            form.setValue(`items.${index}.itemName`, bi.itemName); 
                                            form.setValue(`items.${index}.isAssociated`, false);
                                            setOpenBomIndex(null); 
                                            setBomSearch(""); 
                                          }}>
                                            <Check className={cn("mr-2 h-4 w-4 text-primary", bi.id === bomField.value ? "opacity-100" : "opacity-0")} />
                                            <div className="flex flex-col items-start overflow-hidden text-left">
                                              <span className="font-bold truncate w-full">{bi.itemName}</span>
                                              <span className="text-[8px] font-black uppercase text-muted-foreground mt-0.5">Limit: {bi.authorized} {bi.unit} (Left: {bi.remaining.toFixed(2)})</span>
                                            </div>
                                          </Button>
                                        )) : <p className="p-4 text-center text-[10px] uppercase font-bold text-muted-foreground">No matches</p>}
                                      </div>
                                    </ScrollArea>
                                  </PopoverContent>
                                </Popover>
                              )}
                            </FormItem>
                          )} />
                        </div>

                        <div className="md:col-span-2">
                          {!item.isAssociated && (
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> Balance</Label>
                              <div className="h-10 px-3 bg-muted/20 border rounded-sm flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                                <span>{maxRemaining.toFixed(2)}</span>
                                <span className="opacity-50 uppercase text-[8px]">{selectedBomItem?.unit}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="md:col-span-2">
                          <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Order Qty</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input type="number" step="0.01" {...field} onFocus={e => e.target.select()} className={cn("h-10 rounded-sm bg-background font-mono font-bold", !item.isAssociated && selectedBomItem && Number(field.value) > maxRemaining + 0.001 && "border-destructive text-destructive")} />
                                  {!item.isAssociated && selectedBomItem && Number(field.value) > maxRemaining + 0.001 && (
                                    <div className="absolute -bottom-5 left-0 text-[8px] font-black text-destructive uppercase tracking-tight flex items-center gap-1"><AlertCircle className="h-2.5 w-2.5" /> Over limit</div>
                                  )}
                                </div>
                              </FormControl>
                            </FormItem>
                          )} />
                        </div>

                        <div className="md:col-span-2">
                          <FormField control={form.control} name={`items.${index}.rate`} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Rate (₹)</FormLabel>
                              <FormControl><Input type="number" step="0.01" {...field} onFocus={e => e.target.select()} className="h-10 rounded-sm bg-background font-mono font-bold" /></FormControl>
                            </FormItem>
                          )} />
                        </div>

                        <div className="md:col-span-1">
                          <FormField control={form.control} name={`items.${index}.gstPercent`} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Tax %</FormLabel>
                              <FormControl><div className="relative"><Input type="number" {...field} onFocus={e => e.target.select()} className="h-10 rounded-sm bg-background font-mono font-bold pr-6 px-1 text-center" /><span className="absolute right-1.5 top-2.5 text-[10px] font-bold text-muted-foreground">%</span></div></FormControl>
                            </FormItem>
                          )} />
                        </div>

                        <div className="md:col-span-2 text-right">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest text-right block">Total (₹)</Label>
                            <div className="h-10 px-3 bg-primary/5 border border-primary/10 rounded-sm flex items-center justify-end font-mono font-black text-primary text-sm shadow-inner">{(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                          </div>
                        </div>
                      </div>

                      {/* Associated Items Control for Sets */}
                      {isSet && !item.isAssociated && (
                        <div className="mt-4 pt-4 border-t border-primary/10">
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => toggleAssociated(index)}
                            className="h-8 rounded-sm font-bold text-primary hover:bg-primary/5 gap-2 px-3"
                          >
                            {expandedAssociated.has(index) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            <span className="text-[10px] font-black uppercase tracking-widest">View Associated Items</span>
                          </Button>

                          {expandedAssociated.has(index) && selectedBomItem?.subItems && (
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-in slide-in-from-top-2 duration-300">
                              {selectedBomItem.subItems.map((sub, sIdx) => (
                                <div key={sIdx} className="flex items-center justify-between p-3 rounded-sm border bg-background group shadow-sm hover:border-primary/20 transition-all">
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-bold truncate pr-4">{sub.name}</span>
                                    <span className="text-[9px] font-black text-muted-foreground uppercase opacity-60">Standard: {sub.quantityPerSet} {sub.unit}</span>
                                  </div>
                                  <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-7 text-[8px] font-black uppercase tracking-widest border-primary/20 text-primary hover:bg-primary hover:text-white shrink-0"
                                    onClick={() => append({ 
                                      bomItemId: selectedBomItem.id, 
                                      itemName: sub.name, 
                                      quantity: item.quantity * sub.quantityPerSet, 
                                      rate: 0, 
                                      gstPercent: 18, 
                                      amount: 0, 
                                      isAssociated: true 
                                    })}
                                  >
                                    <Plus className="h-3.5 w-3.5 mr-1" /> Add to New Row
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-8 bg-primary/5 rounded-sm border-2 border-primary/10 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl animate-in slide-in-from-bottom-2">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary border-4 border-primary/5"><CheckCircle2 className="h-8 w-8" /></div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] leading-none mb-1">Final PO Value (Incl. Taxes)</span>
                <span className="text-4xl font-black text-primary tabular-nums">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button type="button" variant="ghost" onClick={() => router.back()} className="h-14 px-8 font-bold uppercase text-xs tracking-widest rounded-sm">Cancel</Button>
              <Button type="submit" disabled={isSubmitting || totalAmount <= 0} className="w-full sm:w-auto h-14 px-12 font-black text-lg rounded-sm shadow-xl transition-all active:scale-95">
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> VALIDATING...</> : <><Send className="mr-2 h-4 w-4" /> GENERATE PURCHASE ORDER</>}</Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}