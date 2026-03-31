"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFirebaseApp, useFirestore, useUser, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp, increment, query, where, getDocs, setDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Check, ChevronsUpDown, Loader2, ArrowLeftRight, Calendar, Plus, Trash2, ListPlus, Truck, Building2, CheckCircle2, FileUp, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSuperAdmin } from "@/lib/auth-constants";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useRouter } from "next/navigation";

const itemSchema = z.object({
  itemName: z.string().min(1, "Item selection is required"),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0"),
  unit: z.string().min(1, "Unit is required"),
});

const movementSchema = z.object({
  siteName: z.string().min(1, "Site selection is required"),
  movementType: z.enum(["Inward", "Outward"], { required_error: "Movement type is required" }),
  sourceOrDestinationType: z.enum(["Supplier", "Site"], { required_error: "Type is required" }),
  sourceOrDestination: z.string().min(1, "Source/Destination is required"),
  movementDate: z.string().min(1, "Date is required"),
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().optional(),
  items: z.array(itemSchema).min(1, "Add at least one item"),
});

type Site = {
  id: string;
  name: string;
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
  status: string;
  subItems?: { name: string; quantityPerSet: number; unit: string }[];
};

type UserProfile = {
  id: string;
  username: string;
  role: string;
  siteManagerId?: string;
  assignedProjectIds?: string[];
  ownDataOnly?: boolean;
};

type AccessConfig = {
  id: string;
  ownDataOnly?: boolean;
};

export default function RecordMovementPage() {
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<AccessConfig>(roleConfigsQuery);

  const isSuper = isSuperAdmin(user?.email);
  const isAdmin = isSuper || userProfile?.role === 'Admin';

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const suppliersQuery = useMemoFirebase(() => collection(firestore, 'suppliers'), [firestore]);
  const { data: allSuppliers } = useCollection<Supplier>(suppliersQuery);

  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  const [isSupplierPopoverOpen, setIsSupplierPopoverOpen] = React.useState(false);
  const [supplierSearchQuery, setSupplierSearchQuery] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [submittedData, setSubmittedData] = React.useState<any>(null);
  const [invoiceFiles, setInvoiceFiles] = React.useState<File[]>([]);

  const [approvedBomItems, setApprovedBomItems] = React.useState<BoMItem[]>([]);
  const currentSiteNameRef = React.useRef("");

  const form = useForm<z.infer<typeof movementSchema>>({
    resolver: zodResolver(movementSchema),
    defaultValues: { 
      siteName: "", 
      movementType: "Inward",
      sourceOrDestinationType: "Supplier",
      sourceOrDestination: "",
      movementDate: format(new Date(), 'yyyy-MM-dd'),
      invoiceNumber: "",
      invoiceDate: format(new Date(), 'yyyy-MM-dd'),
      items: [{ itemName: "", quantity: 0, unit: "Numbers" }]
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  const watchSiteName = form.watch("siteName");
  const movementType = form.watch("movementType");
  const sourceOrDestinationType = form.watch("sourceOrDestinationType");

  React.useEffect(() => {
    if (watchSiteName && watchSiteName !== currentSiteNameRef.current) {
      currentSiteNameRef.current = watchSiteName;
      const fetchApprovedBom = async () => {
        const q = query(collection(firestore, 'project_boms'), where('siteName', '==', watchSiteName), where('status', '==', 'Approved'));
        const snap = await getDocs(q);
        setApprovedBomItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as BoMItem)));
      };
      fetchApprovedBom();
    }
  }, [watchSiteName, firestore]);

  const [openItemPopoverIndex, setOpenItemPopoverIndex] = React.useState<number | null>(null);
  const [itemSearchQuery, setItemSearchQuery] = React.useState("");

  const filteredLookupItems = React.useMemo(() => {
    const list: { name: string; unit: string }[] = [];
    approvedBomItems.forEach(item => {
      if (item.subItems && item.subItems.length > 0) {
        item.subItems.forEach(sub => list.push({ name: `${item.itemName} - ${sub.name}`, unit: sub.unit }));
      } else {
        list.push({ name: item.itemName, unit: item.unit });
      }
    });
    return list.filter(i => i.name.toLowerCase().includes(itemSearchQuery.toLowerCase()));
  }, [approvedBomItems, itemSearchQuery]);

  const onSubmit = async (values: z.infer<typeof movementSchema>) => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);
    try {
      const storage = getStorage(firebaseApp);
      const attachments: any[] = [];
      
      for (const file of invoiceFiles) {
        const path = `movements/${user.uid}/${Date.now()}_${file.name}`;
        const sRef = ref(storage, path);
        await uploadBytesResumable(sRef, file);
        const url = await getDownloadURL(sRef);
        attachments.push({ url, name: file.name, contentType: file.type });
      }

      const siteId = allSites?.find(s => s.name === values.siteName)?.id;

      for (const item of values.items) {
        await addDocumentNonBlocking(collection(firestore, 'material_movements'), {
          ...values,
          itemName: item.itemName,
          quantity: item.quantity,
          unit: item.unit,
          attachments,
          userId: user.uid,
          userName: userProfile.username,
          siteId: siteId || null,
          createdAt: serverTimestamp()
        });

        const invQuery = query(collection(firestore, 'project_inventory'), where('siteId', '==', siteId), where('itemName', '==', item.itemName));
        const invSnap = await getDocs(invQuery);
        const adjustment = values.movementType === 'Inward' ? item.quantity : -item.quantity;

        if (!invSnap.empty) {
          const invDoc = invSnap.docs[0];
          updateDocumentNonBlocking(doc(firestore, 'project_inventory', invDoc.id), {
            stockLevel: increment(adjustment),
            lastUpdated: serverTimestamp()
          });
        } else {
          const newInvRef = doc(collection(firestore, 'project_inventory'));
          await setDoc(newInvRef, {
            siteId,
            siteName: values.siteName,
            itemName: item.itemName,
            stockLevel: Math.max(0, adjustment),
            unit: item.unit,
            lastUpdated: serverTimestamp()
          });
        }
      }

      setSubmittedData(values);
      setIsSubmitted(true);
      toast({ title: "Movement Recorded", description: "Logs generated and stock levels updated successfully." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const accessibleSites = React.useMemo(() => {
    if (!allSites || !userProfile) return [];

    const isOwnDataOnly = userProfile.ownDataOnly !== undefined 
      ? userProfile.ownDataOnly 
      : roleConfigs?.find(c => c.id === userProfile.role)?.ownDataOnly ?? false;

    if (isSuper) return Array.from(new Map(allSites.map(s => [s.name, s])).values());

    if (isOwnDataOnly || !isAdmin) {
      const assignedIds = new Set<string>(userProfile.assignedProjectIds || []);
      return allSites.filter(s => assignedIds.has(s.id));
    }

    return Array.from(new Map(allSites.map(s => [s.name, s])).values());
  }, [allSites, userProfile, isAdmin, isSuper, roleConfigs]);

  const filteredSites = accessibleSites.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase()));
  const filteredSuppliers = allSuppliers?.filter(s => s.name.toLowerCase().includes(supplierSearchQuery.toLowerCase())) || [];

  if (isSubmitted && submittedData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full animate-in fade-in zoom-in-95 duration-300">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><div className="bg-primary/10 p-4 rounded-full"><CheckCircle2 className="h-12 w-12 text-primary" /></div></div>
            <CardTitle className="text-2xl font-bold">Movement Logged</CardTitle>
            <CardDescription className="text-base">Movement recorded for <strong>{submittedData.siteName}</strong>. Available quantities updated.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full h-11" onClick={() => router.push('/inventory/data')}>View History</Button>
            <Button className="w-full h-11" onClick={() => { setIsSubmitted(false); form.reset(); setInvoiceFiles([]); }}>Record New Entry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
          <ArrowLeftRight className="h-8 w-8" /> Record Site Movement
        </h1>
        <p className="text-muted-foreground">Log materials entering or leaving project sites. Only approved BoM items are allowed.</p>
      </div>

      <Card className="shadow-md border-primary/10 rounded-sm">
        <CardHeader><CardTitle>Movement Entry Form</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Row 1: Date | Movement Direction */}
                <FormField control={form.control} name="movementDate" render={({ field }) => (
                  <FormItem><FormLabel>Movement Date</FormLabel><FormControl><Input type="date" {...field} className="h-11 rounded-sm" /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name="movementType" render={({ field }) => (
                  <FormItem><FormLabel>Movement Direction</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11 rounded-sm"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Inward">Inward (Add to Stock)</SelectItem><SelectItem value="Outward">Outward (Remove from Stock)</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />

                {/* Row 2: Project Site | Source Type */}
                <FormField control={form.control} name="siteName" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Project Site (Recording Site)</FormLabel>
                    <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl><Button variant="outline" className={cn("w-full justify-between font-normal h-11 rounded-sm", !field.value && "text-muted-foreground")}>{field.value || "Select site..."}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <div className="flex items-center border-b px-3"><Search className="mr-2 h-4 w-4 shrink-0 opacity-50" /><Input placeholder="Search sites..." className="h-9 border-none" value={siteSearchQuery} onChange={e => setSiteSearchQuery(e.target.value)} /></div>
                        <ScrollArea className="h-[200px]">{filteredSites.map(site => (
                          <Button key={site.id} type="button" variant="ghost" className="w-full justify-start h-10 text-sm" onClick={() => { field.onChange(site.name); setIsSitePopoverOpen(false); }}><Check className={cn("mr-2 h-4 w-4 text-primary", site.name === field.value ? "opacity-100" : "opacity-0")} />{site.name}</Button>
                        ))}</ScrollArea>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="sourceOrDestinationType" render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>{movementType === 'Inward' ? 'Source' : 'Destination'} Type</FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Supplier" id="src-supp" />
                          <Label htmlFor="src-supp">Supplier</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Site" id="src-site" />
                          <Label htmlFor="src-site">Project Site</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Specific Entity Name Input */}
              <FormField control={form.control} name="sourceOrDestination" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{movementType === 'Inward' ? 'Received From' : 'Sent To'} Name</FormLabel>
                  {sourceOrDestinationType === 'Supplier' ? (
                    <Popover open={isSupplierPopoverOpen} onOpenChange={setIsSupplierPopoverOpen}><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full justify-between h-11 font-normal rounded-sm", !field.value && "text-muted-foreground")}>{field.value || "Select supplier..."}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-[--radix-popover-trigger-width] p-0"><div className="flex items-center border-b px-3"><Search className="mr-2 h-4 w-4 shrink-0 opacity-50" /><Input placeholder="Search suppliers..." className="h-9 border-none" value={supplierSearchQuery} onChange={e => setSupplierSearchQuery(e.target.value)} /></div><ScrollArea className="h-[200px]">{filteredSuppliers.map(s => (<Button key={s.id} type="button" variant="ghost" className="w-full justify-start h-10 text-sm" onClick={() => { field.onChange(s.name); setIsSupplierPopoverOpen(false); }}><Check className={cn("mr-2 h-4 w-4 text-primary", s.name === field.value ? "opacity-100" : "opacity-0")} />{s.name}</Button>))}</ScrollArea></PopoverContent></Popover>
                  ) : (<FormControl><Input placeholder="Site name or address..." {...field} className="h-11 rounded-sm" /></FormControl>)}
                  <FormMessage />
                </FormItem>
              )} />

              <Separator />

              {/* Invoice Documentation Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Invoice Documentation</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="invoiceNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Invoice / Challan Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. INV/2024/001" {...field} className="h-11 rounded-sm" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="invoiceDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Invoice Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="h-11 rounded-sm" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="space-y-3">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <FileUp className="h-4 w-4" /> Upload Invoices / Proof
                  </Label>
                  <Input 
                    type="file" 
                    multiple 
                    accept="image/*,application/pdf" 
                    className="h-auto py-2 border-dashed"
                    onChange={e => {
                      if (e.target.files) {
                        setInvoiceFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                      }
                    }}
                  />
                  {invoiceFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {invoiceFiles.map((file, idx) => (
                        <Badge key={idx} variant="secondary" className="gap-2 h-8 rounded-sm">
                          <FileText className="h-3 w-3" />
                          <span className="truncate max-w-[150px] text-[10px]">{file.name}</span>
                          <X 
                            className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors" 
                            onClick={() => setInvoiceFiles(prev => prev.filter((_, i) => i !== idx))}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between"><h3 className="text-lg font-black uppercase tracking-widest flex items-center gap-2"><ListPlus className="h-5 w-5 text-primary" /> Approved Materials List</h3><Button type="button" variant="outline" size="sm" onClick={() => append({ itemName: "", quantity: 0, unit: "Numbers" })} className="rounded-sm border-primary text-primary"><Plus className="mr-2 h-4 w-4" /> Add Line Item</Button></div>
                <div className="space-y-4">{fields.map((field, index) => (
                  <Card key={field.id} className="relative bg-muted/10 border-dashed rounded-sm">
                    <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-8 w-8 text-destructive" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                    <CardContent className="pt-6 space-y-4">
                      <FormField control={form.control} name={`items.${index}.itemName`} render={({ field: itemField }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Authorized Item</FormLabel>
                          <Popover open={openItemPopoverIndex === index} onOpenChange={o => setOpenItemPopoverIndex(o ? index : null)}>
                            <PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full justify-between h-10 bg-background", !itemField.value && "text-muted-foreground")}><span className="truncate">{itemField.value || "Search approved BoM items..."}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></FormControl></PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0" align="start"><div className="flex items-center border-b px-3"><Search className="mr-2 h-4 w-4 shrink-0 opacity-50" /><Input placeholder="Filter materials..." className="h-9 border-none" value={itemSearchQuery} onChange={e => setItemSearchQuery(e.target.value)} /></div><ScrollArea className="h-[250px]"><div className="p-1">{filteredLookupItems.length > 0 ? filteredLookupItems.map((lookup, lIdx) => (<Button key={lIdx} type="button" variant="ghost" className="w-full justify-start h-10 text-xs" onClick={() => { itemField.onChange(lookup.name); form.setValue(`items.${index}.unit`, lookup.unit); setOpenItemPopoverIndex(null); setItemSearchQuery(""); }}><Check className={cn("mr-2 h-4 w-4 text-primary", lookup.name === itemField.value ? "opacity-100" : "opacity-0")} />{lookup.name}</Button>)) : (<div className="p-8 text-center text-[10px] font-black uppercase text-muted-foreground italic leading-relaxed">No approved items found for this site.</div>)}</div></ScrollArea></PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (<FormItem><FormLabel>Quantity</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-10 bg-background font-mono" /></FormControl><FormMessage /></FormItem>)} />
                        <FormItem><FormLabel>Unit</FormLabel><Input readOnly value={form.watch(`items.${index}.unit`) || "Numbers"} className="h-10 bg-muted/20 cursor-not-allowed font-bold" /></FormItem>
                      </div>
                    </CardContent>
                  </Card>
                ))}</div>
              </div>

              <div className="flex justify-end gap-4 pt-6 border-t"><Button type="submit" className="min-w-[200px] h-12 text-lg font-black uppercase" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Recording...</> : "Record Movements"}</Button></div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
