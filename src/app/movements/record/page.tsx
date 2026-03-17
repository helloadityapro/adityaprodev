
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
import { Search, Check, ChevronsUpDown, Loader2, ArrowLeftRight, Calendar, Plus, Trash2, ListPlus, Truck, Building2, CheckCircle2, MessageCircle, FileUp, FileText, X, MapPin, Hash, Smartphone, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSuperAdmin } from "@/lib/auth-constants";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useRouter } from "next/navigation";

const itemSchema = z.object({
  itemName: z.string().min(1, "Item name is required"),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0"),
  unit: z.string().min(1, "Unit is required"),
  parentSetName: z.string().optional(),
});

const movementSchema = z.object({
  siteName: z.string().min(1, "Site is required"),
  movementType: z.enum(["Inward", "Outward"], { required_error: "Movement type is required" }),
  sourceOrDestinationType: z.enum(["Supplier", "Site"], { required_error: "Type is required" }),
  sourceOrDestination: z.string().min(1, "Source/Destination is required"),
  movementDate: z.string().min(1, "Date is required"),
  items: z.array(itemSchema).min(1, "Add at least one item"),
});

type Site = {
  id: string;
  name: string;
  projectCompany: string;
  acCapacity: any;
  dcCapacity: any;
};

type Supplier = {
  id: string;
  name: string;
  gstin: string;
  mobile: string;
  address: string;
  email: string;
};

type UserProfile = {
  id: string;
  username: string;
  email: string;
  role: string;
  mobile?: string;
  siteManagerId?: string;
  assignedProjectIds?: string[];
  pointsMultiplier?: number;
};

type BoMItem = {
  id: string;
  itemName: string;
  unit: string;
  subItems?: { name: string; quantityPerSet: number; unit: string }[];
};

type MasterItem = {
  id: string;
  name: string;
  unit: string;
  subItems?: { name: string; quantityPerSet: number; unit: string }[];
};

type RewardSettings = {
  movementEngineer?: number;
  movementManager?: number;
};

const formatCapacity = (val: any) => {
  const num = typeof val === 'number' ? val : parseFloat(String(val || 0));
  return isNaN(num) ? "0.000" : num.toFixed(3);
};

export default function RecordMovementPage() {
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const suppliersQuery = useMemoFirebase(() => collection(firestore, 'suppliers'), [firestore]);
  const { data: allSuppliers } = useCollection<Supplier>(suppliersQuery);

  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  
  const [isTargetSitePopoverOpen, setIsTargetSitePopoverOpen] = React.useState(false);
  const [targetSiteSearchQuery, setTargetSiteSearchQuery] = React.useState("");

  const [isSupplierPopoverOpen, setIsSupplierPopoverOpen] = React.useState(false);
  const [supplierSearchQuery, setSupplierSearchQuery] = React.useState("");

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [submittedData, setSubmittedData] = React.useState<any>(null);
  const [invoiceFiles, setInvoiceFiles] = React.useState<File[]>([]);

  // BoM and Master Items for lookup
  const siteNameValue = React.useRef("");
  const [bomItems, setBomItems] = React.useState<BoMItem[]>([]);
  const masterItemsQuery = useMemoFirebase(() => collection(firestore, 'master_inventory'), [firestore]);
  const { data: masterItems } = useCollection<MasterItem>(masterItemsQuery);

  const form = useForm<z.infer<typeof movementSchema>>({
    resolver: zodResolver(movementSchema),
    defaultValues: { 
      siteName: "", 
      movementType: "Inward",
      sourceOrDestinationType: "Supplier",
      sourceOrDestination: "",
      movementDate: format(new Date(), 'yyyy-MM-dd'),
      items: [{ itemName: "", quantity: 0, unit: "Numbers" }]
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  const movementType = form.watch("movementType");
  const sourceOrDestinationType = form.watch("sourceOrDestinationType");
  const sourceOrDestinationValue = form.watch("sourceOrDestination");
  const currentSiteName = form.watch("siteName");

  // Fetch BoM for current site to offer component selection
  React.useEffect(() => {
    if (currentSiteName && currentSiteName !== siteNameValue.current) {
      siteNameValue.current = currentSiteName;
      const fetchBom = async () => {
        const q = query(collection(firestore, 'project_boms'), where('siteName', '==', currentSiteName));
        const snap = await getDocs(q);
        setBomItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as BoMItem)));
      };
      fetchBom();
    }
  }, [currentSiteName, firestore]);

  const [openItemPopoverIndex, setOpenItemPopoverIndex] = React.useState<number | null>(null);
  const [itemSearchQuery, setItemSearchQuery] = React.useState("");

  const filteredLookupItems = React.useMemo(() => {
    const list: { name: string; unit: string; parentSet?: string }[] = [];
    
    // Add items from site BoM (including breakdown if it's a Set)
    bomItems.forEach(item => {
      if (item.subItems && item.subItems.length > 0) {
        item.subItems.forEach(sub => {
          list.push({ name: `${item.itemName} - ${sub.name}`, unit: sub.unit, parentSet: item.itemName });
        });
      } else {
        list.push({ name: item.itemName, unit: item.unit });
      }
    });

    // Add master items if not already in list
    masterItems?.forEach(item => {
      if (!list.find(l => l.name === item.name)) {
        if (item.subItems && item.subItems.length > 0) {
          item.subItems.forEach(sub => {
            list.push({ name: `${item.name} - ${sub.name}`, unit: sub.unit, parentSet: item.name });
          });
        } else {
          list.push({ name: item.name, unit: item.unit });
        }
      }
    });

    return list.filter(i => i.name.toLowerCase().includes(itemSearchQuery.toLowerCase()));
  }, [bomItems, masterItems, itemSearchQuery]);

  const onSubmit = async (values: z.infer<typeof movementSchema>) => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);
    try {
      const storage = getStorage(firebaseApp);
      const attachments: any[] = [];
      
      // Upload invoices
      for (const file of invoiceFiles) {
        const path = `movements/${user.uid}/${Date.now()}_${file.name}`;
        const sRef = ref(storage, path);
        await uploadBytesResumable(sRef, file);
        const url = await getDownloadURL(sRef);
        attachments.push({ url, name: file.name, contentType: file.type });
      }

      const siteId = allSites?.find(s => s.name === values.siteName)?.id;

      // 1. Log each movement and update specific inventory components
      for (const item of values.items) {
        await addDocumentNonBlocking(collection(firestore, 'material_movements'), {
          ...values,
          itemName: item.itemName,
          quantity: item.quantity,
          unit: item.unit,
          parentSetName: item.parentSetName || null,
          items: [item], // Compatibility with list view
          attachments,
          userId: user.uid,
          userName: userProfile.username,
          siteId: siteId || null,
          createdAt: serverTimestamp()
        });

        // 2. Update Component Inventory
        const invQuery = query(
          collection(firestore, 'project_inventory'),
          where('siteId', '==', siteId),
          where('itemName', '==', item.itemName)
        );
        const invSnap = await getDocs(invQuery);
        const adjustment = values.movementType === 'Inward' ? item.quantity : -item.quantity;

        if (!invSnap.empty) {
          const invDoc = invSnap.docs[0];
          updateDocumentNonBlocking(doc(firestore, 'project_inventory', invDoc.id), {
            stockLevel: increment(adjustment),
            lastUpdated: serverTimestamp()
          });
        } else {
          // Create new record for this component
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

      setSubmittedData({ ...values, attachments });
      setIsSubmitted(true);
      toast({ title: "Movement Recorded", description: "Log entries generated and item stock updated." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSites = allSites?.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase())) || [];
  const filteredSuppliers = allSuppliers?.filter(s => s.name.toLowerCase().includes(supplierSearchQuery.toLowerCase())) || [];

  if (isSubmitted && submittedData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full animate-in fade-in zoom-in-95 duration-300">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-primary/10 p-4 rounded-full">
                <CheckCircle2 className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Log Generated</CardTitle>
            <CardDescription className="text-base">
              {submittedData.items.length} item(s) recorded at <strong>{submittedData.siteName}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full h-11" onClick={() => router.push('/movements/list')}>View Repository</Button>
            <Button className="w-full h-11" onClick={() => { setIsSubmitted(false); form.reset(); setInvoiceFiles([]); }}>Record Another</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2 uppercase">
          <ArrowLeftRight className="h-8 w-8" /> Record Site Movement
        </h1>
        <p className="text-muted-foreground">Log materials or set-components entering/leaving site.</p>
      </div>

      <Card className="shadow-md border-primary/10 rounded-sm">
        <CardHeader>
          <CardTitle>Movement Entry Form</CardTitle>
          <CardDescription>Select material components. If a set is delivered in parts, log the individual components here.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="siteName" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Project Site</FormLabel>
                    <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal h-11 rounded-sm", !field.value && "text-muted-foreground")}>
                            {field.value || "Select site..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <div className="flex items-center border-b px-3">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <Input placeholder="Search sites..." className="h-9 w-full border-none focus-visible:ring-0 px-0" value={siteSearchQuery} onChange={e => setSiteSearchQuery(e.target.value)} />
                        </div>
                        <ScrollArea className="h-[200px]">
                          {filteredSites.map(site => (
                            <Button key={site.id} type="button" variant="ghost" className="w-full justify-start h-10 text-sm" onClick={() => { field.onChange(site.name); setIsSitePopoverOpen(false); }}>
                              <Check className={cn("mr-2 h-4 w-4 text-primary", site.name === field.value ? "opacity-100" : "opacity-0")} />
                              {site.name}
                            </Button>
                          ))}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="movementDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Movement Date</FormLabel>
                    <FormControl><Input type="date" {...field} className="h-11 rounded-sm" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="movementType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Movement Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-11 rounded-sm"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Inward">Inward (Entering Site)</SelectItem>
                        <SelectItem value="Outward">Outward (Leaving Site)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="space-y-4">
                  <FormField control={form.control} name="sourceOrDestinationType" render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>{movementType === 'Inward' ? 'Received From' : 'Dispatched To'}</FormLabel>
                      <FormControl>
                        <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                          <div className="flex items-center space-x-2"><RadioGroupItem value="Supplier" id="src-supp" /><Label htmlFor="src-supp">Supplier</Label></div>
                          <div className="flex items-center space-x-2"><RadioGroupItem value="Site" id="src-site" /><Label htmlFor="src-site">Project Site</Label></div>
                        </RadioGroup>
                      </FormControl>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="sourceOrDestination" render={({ field }) => (
                    <FormItem>
                      {sourceOrDestinationType === 'Supplier' ? (
                        <Popover open={isSupplierPopoverOpen} onOpenChange={setIsSupplierPopoverOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button variant="outline" className={cn("w-full justify-between h-11 font-normal rounded-sm", !field.value && "text-muted-foreground")}>
                                {field.value || "Select supplier..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <div className="flex items-center border-b px-3">
                              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                              <Input placeholder="Search suppliers..." className="h-9 border-none" value={supplierSearchQuery} onChange={e => setSupplierSearchQuery(e.target.value)} />
                            </div>
                            <ScrollArea className="h-[200px]">
                              {filteredSuppliers.map(s => (
                                <Button key={s.id} type="button" variant="ghost" className="w-full justify-start h-10 text-sm" onClick={() => { field.onChange(s.name); setIsSupplierPopoverOpen(false); }}>
                                  <Check className={cn("mr-2 h-4 w-4 text-primary", s.name === field.value ? "opacity-100" : "opacity-0")} />
                                  {s.name}
                                </Button>
                              ))}
                            </ScrollArea>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <FormControl><Input placeholder="Site name or address..." {...field} className="h-11 rounded-sm" /></FormControl>
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                  <FileUp className="h-4 w-4 text-primary" /> Invoice / Photo Evidence
                </Label>
                <Input type="file" multiple accept="image/*,application/pdf" onChange={e => e.target.files && setInvoiceFiles(prev => [...prev, ...Array.from(e.target.files!)])} className="rounded-sm border-dashed" />
                {invoiceFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {invoiceFiles.map((f, i) => (
                      <Badge key={i} variant="secondary" className="gap-2 h-8 rounded-sm">
                        <FileText className="h-3 w-3" /> {f.name}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => setInvoiceFiles(prev => prev.filter((_, idx) => idx !== i))} />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2"><ListPlus className="h-5 w-5 text-primary" /> Item List</h3>
                  <Button type="button" variant="outline" size="sm" onClick={() => append({ itemName: "", quantity: 0, unit: "Numbers" })} className="rounded-sm border-primary text-primary">
                    <Plus className="mr-2 h-4 w-4" /> Add Item
                  </Button>
                </div>

                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <Card key={field.id} className="relative bg-muted/10 border-dashed rounded-sm">
                      <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-8 w-8 text-destructive" onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <CardContent className="pt-6 space-y-4">
                        <FormField control={form.control} name={`items.${index}.itemName`} render={({ field: itemField }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Select Item</FormLabel>
                            <Popover open={openItemPopoverIndex === index} onOpenChange={o => setOpenItemPopoverIndex(o ? index : null)}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant="outline" className={cn("w-full justify-between h-10 bg-background", !itemField.value && "text-muted-foreground")}>
                                    <span className="truncate">{itemField.value || "Select material or part..."}</span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-[400px] p-0" align="start">
                                <div className="flex items-center border-b px-3">
                                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                  <Input placeholder="Search inventory..." className="h-9 border-none" value={itemSearchQuery} onChange={e => setItemSearchQuery(e.target.value)} />
                                </div>
                                <ScrollArea className="h-[250px]">
                                  <div className="p-1">
                                    {filteredLookupItems.map((lookup, lIdx) => (
                                      <Button
                                        key={lIdx}
                                        type="button"
                                        variant="ghost"
                                        className="w-full justify-start h-12 text-xs mb-0.5"
                                        onClick={() => {
                                          itemField.onChange(lookup.name);
                                          form.setValue(`items.${index}.unit`, lookup.unit);
                                          form.setValue(`items.${index}.parentSetName`, lookup.parentSet || "");
                                          setOpenItemPopoverIndex(null);
                                          setItemSearchQuery("");
                                        }}
                                      >
                                        <div className="flex flex-col items-start overflow-hidden text-left">
                                          <span className="font-bold truncate w-full">{lookup.name}</span>
                                          <span className="text-[10px] text-muted-foreground uppercase">{lookup.parentSet ? `Part of: ${lookup.parentSet}` : 'Primary Material'}</span>
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

                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantity</FormLabel>
                              <FormControl><Input type="number" step="0.01" {...field} className="h-10 bg-background font-mono" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormItem>
                            <FormLabel>Unit</FormLabel>
                            <Input readOnly value={form.watch(`items.${index}.unit`) || "Numbers"} className="h-10 bg-muted/20 border-primary/10 cursor-not-allowed font-bold" />
                          </FormItem>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-6 border-t">
                <Button type="submit" className="min-w-[200px] h-12 text-lg font-semibold" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Recording...</> : "Record Logs"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
