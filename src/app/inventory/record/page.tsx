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
import { collection, doc, serverTimestamp, increment, query, where, getDocs, setDoc, and } from "firebase/firestore";
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
};

type BoMItem = {
  id: string;
  itemName: string;
  unit: string;
  make: string;
  status: string;
  subItems?: { name: string; quantityPerSet: number; unit: string }[];
};

type PurchaseOrder = {
  id: string;
  supplierId: string;
  supplierName: string;
  status: string;
  items: { itemName: string }[];
};

type InventoryItem = {
  id: string;
  itemName: string;
  stockLevel: number;
  unit: string;
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

type MappingOverride = {
  id: string;
  engineerId: string;
  siteId: string;
  managerId: string;
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
  const isManager = userProfile?.role === 'Site Manager';

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const suppliersQuery = useMemoFirebase(() => collection(firestore, 'suppliers'), [firestore]);
  const { data: allSuppliers } = useCollection<Supplier>(suppliersQuery);

  const overridesQuery = useMemoFirebase(() => collection(firestore, 'team_mapping_overrides'), [firestore]);
  const { data: allOverrides } = useCollection<MappingOverride>(overridesQuery);

  const teamQuery = useMemoFirebase(() => {
    if (!isManager || !user) return null;
    return query(collection(firestore, 'users'), where('siteManagerId', '==', user.uid));
  }, [firestore, user, isManager]);
  const { data: teamMembers } = useCollection<UserProfile>(teamQuery);

  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  const [isSupplierPopoverOpen, setIsSupplierPopoverOpen] = React.useState(false);
  const [supplierSearchQuery, setSupplierSearchQuery] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [submittedData, setSubmittedData] = React.useState<any>(null);
  const [invoiceFiles, setInvoiceFiles] = React.useState<File[]>([]);

  const [approvedBomItems, setApprovedBomItems] = React.useState<BoMItem[]>([]);
  const [approvedPOs, setApprovedPOs] = React.useState<PurchaseOrder[]>([]);
  const [sourceSiteInventory, setSourceSiteInventory] = React.useState<InventoryItem[]>([]);
  
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
  const watchSource = form.watch("sourceOrDestination");
  const movementType = form.watch("movementType");
  const sourceOrDestinationType = form.watch("sourceOrDestinationType");

  const selectedSiteId = React.useMemo(() => allSites?.find(s => s.name === watchSiteName)?.id, [allSites, watchSiteName]);

  React.useEffect(() => {
    if (selectedSiteId) {
      const fetchData = async () => {
        const bomQ = query(collection(firestore, 'project_boms'), where('siteId', '==', selectedSiteId), where('status', '==', 'Approved'));
        const bomSnap = await getDocs(bomQ);
        setApprovedBomItems(bomSnap.docs.map(d => ({ id: d.id, ...d.data() } as BoMItem)));

        const poQ = query(collection(firestore, 'project_pos'), where('siteId', '==', selectedSiteId), where('status', '==', 'Accepted'));
        const poSnap = await getDocs(poQ);
        setApprovedPOs(poSnap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrder)));
      };
      fetchData();
    }
  }, [selectedSiteId, firestore]);

  React.useEffect(() => {
    if (sourceOrDestinationType === 'Site' && watchSource) {
      const sourceSiteId = allSites?.find(s => s.name === watchSource)?.id;
      if (sourceSiteId) {
        const fetchInv = async () => {
          const invQ = query(collection(firestore, 'project_inventory'), where('siteId', '==', sourceSiteId));
          const snap = await getDocs(invQ);
          setSourceSiteInventory(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem)));
        };
        fetchInv();
      }
    }
  }, [sourceOrDestinationType, watchSource, allSites, firestore]);

  React.useEffect(() => {
    form.setValue("items", [{ itemName: "", quantity: 0, unit: "Numbers" }]);
  }, [watchSource, sourceOrDestinationType, form]);

  const [openItemPopoverIndex, setOpenItemPopoverIndex] = React.useState<number | null>(null);
  const [itemSearchQuery, setItemSearchQuery] = React.useState("");

  const suppliersWithPOs = React.useMemo(() => {
    const ids = new Set(approvedPOs.map(po => po.supplierId));
    return allSuppliers?.filter(s => ids.has(s.id)) || [];
  }, [allSuppliers, approvedPOs]);

  const filteredSuppliers = React.useMemo(() => {
    const list = (movementType === 'Inward' && sourceOrDestinationType === 'Supplier') ? suppliersWithPOs : (allSuppliers || []);
    return list.filter(s => s.name.toLowerCase().includes(supplierSearchQuery.toLowerCase()));
  }, [allSuppliers, suppliersWithPOs, movementType, sourceOrDestinationType, supplierSearchQuery]);

  const filteredLookupItems = React.useMemo(() => {
    let list: { name: string; unit: string; make: string }[] = [];

    if (movementType === 'Inward' && sourceOrDestinationType === 'Supplier') {
      const selectedSupplierId = allSuppliers?.find(s => s.name === watchSource)?.id;
      const supplierPOs = approvedPOs.filter(po => po.supplierId === selectedSupplierId);
      const itemNames = new Set<string>();
      supplierPOs.forEach(po => po.items.forEach(it => itemNames.add(it.itemName)));
      
      approvedBomItems.forEach(item => {
        if (itemNames.has(item.itemName)) {
          if (item.subItems && item.subItems.length > 0) {
            item.subItems.forEach(sub => list.push({ name: `${item.itemName} - ${sub.name}`, unit: sub.unit, make: item.make || "" }));
          } else {
            list.push({ name: item.itemName, unit: item.unit, make: item.make || "" });
          }
        }
      });
    } else if (sourceOrDestinationType === 'Site') {
      const sourceSiteName = movementType === 'Outward' ? watchSiteName : watchSource;
      const sourceSiteId = allSites?.find(s => s.name === sourceSiteName)?.id;
      
      sourceSiteInventory.forEach(inv => {
        if (inv.stockLevel > 0) {
          list.push({ name: inv.itemName, unit: inv.unit, make: "" });
        }
      });
    } else {
      approvedBomItems.forEach(item => {
        if (item.subItems && item.subItems.length > 0) {
          item.subItems.forEach(sub => list.push({ name: `${item.itemName} - ${sub.name}`, unit: sub.unit, make: item.make || "" }));
        } else {
          list.push({ name: item.itemName, unit: item.unit, make: item.make || "" });
        }
      });
    }

    return list.filter(i => i.name.toLowerCase().includes(itemSearchQuery.toLowerCase()));
  }, [approvedBomItems, approvedPOs, sourceSiteInventory, itemSearchQuery, movementType, sourceOrDestinationType, watchSource, allSuppliers, allSites, watchSiteName]);

  const onSubmit = async (values: z.infer<typeof movementSchema>) => {
    if (!user || !userProfile || !selectedSiteId) return;
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

      const isTransfer = values.sourceOrDestinationType === 'Site';
      const status = isTransfer ? 'Pending' : 'Recorded';

      // 1. Resolve Effective Recording Manager (respecting overrides)
      const recordingOverridesQ = query(collection(firestore, 'team_mapping_overrides'), and(where('engineerId', '==', user.uid), where('siteId', '==', selectedSiteId)));
      const recordingOverridesSnap = await getDocs(recordingOverridesQ);
      const effectiveSiteManagerId = !recordingOverridesSnap.empty ? recordingOverridesSnap.docs[0].data().managerId : (userProfile.siteManagerId || null);

      // 2. Resolve Effective Receiving Manager for Transfers (respecting overrides)
      let receivingManagerId = null;
      if (isTransfer) {
        const destSiteName = values.movementType === 'Outward' ? values.sourceOrDestination : values.siteName;
        const destSiteId = allSites?.find(s => s.name === destSiteName)?.id;
        
        if (destSiteId) {
          const receivingOverridesQ = query(collection(firestore, 'team_mapping_overrides'), and(where('engineerId', '==', user.uid), where('siteId', '==', destSiteId)));
          const receivingOverridesSnap = await getDocs(receivingOverridesQ);
          if (!receivingOverridesSnap.empty) {
            receivingManagerId = receivingOverridesSnap.docs[0].data().managerId;
          } else {
            const usersQ = query(collection(firestore, 'users'), where('role', '==', 'Site Manager'));
            const usersSnap = await getDocs(usersQ);
            const manager = usersSnap.docs.find(d => (d.data().assignedProjectIds || []).includes(destSiteId));
            receivingManagerId = manager?.id || null;
          }
        }
      }

      for (const item of values.items) {
        await addDocumentNonBlocking(collection(firestore, 'material_movements'), {
          ...values,
          itemName: item.itemName,
          quantity: item.quantity,
          unit: item.unit,
          attachments,
          userId: user.uid,
          userName: userProfile.username,
          siteId: selectedSiteId,
          siteManagerId: effectiveSiteManagerId,
          status,
          receivingManagerId,
          createdAt: serverTimestamp()
        });

        if (!isTransfer) {
          const invQuery = query(collection(firestore, 'project_inventory'), where('siteId', '==', selectedSiteId), where('itemName', '==', item.itemName));
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
              siteId: selectedSiteId,
              siteName: values.siteName,
              itemName: item.itemName,
              stockLevel: Math.max(0, adjustment),
              unit: item.unit,
              lastUpdated: serverTimestamp()
            });
          }
        }
      }

      setSubmittedData(values);
      setIsSubmitted(true);
      toast({ 
        title: isTransfer ? "Transfer Logged" : "Movement Recorded", 
        description: isTransfer ? "Request is pending destination manager approval." : "Logs generated and stock levels updated." 
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const accessibleSites = React.useMemo(() => {
    if (!allSites || !userProfile) return [];
    if (isAdmin) return Array.from(new Map(allSites.map(s => [s.name, s])).values());
    
    // Sovereignty Logic
    const siteIds = new Set<string>(userProfile.assignedProjectIds || []);
    if (isManager) {
      allOverrides?.filter(o => o.managerId === userProfile.id).forEach(o => siteIds.add(o.siteId));
      if (teamMembers) {
        teamMembers.forEach(member => {
          (member.assignedProjectIds || []).forEach(id => {
            const hasOtherOverride = allOverrides?.some(o => o.engineerId === member.id && o.siteId === id && o.managerId !== userProfile.id);
            if (!hasOtherOverride) siteIds.add(id);
          });
        });
      }
    }
    
    const filtered = allSites.filter(s => siteIds.has(s.id));
    return Array.from(new Map(filtered.map(s => [s.name, s])).values());
  }, [allSites, userProfile, isAdmin, isManager, teamMembers, allOverrides]);

  const filteredSites = accessibleSites.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase()));

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
          <ArrowLeftRight className="h-8 w-8" /> Record Site Movement
        </h1>
        <p className="text-muted-foreground">Log materials entering or leaving project sites. Transfers require destination manager approval.</p>
      </div>

      <Card className="shadow-md border-primary/10 rounded-sm">
        <CardHeader><CardTitle>Movement Entry Form</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="movementDate" render={({ field }) => (
                  <FormItem><FormLabel>Movement Date</FormLabel><FormControl><Input type="date" {...field} className="h-11 rounded-sm" /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name="movementType" render={({ field }) => (
                  <FormItem><FormLabel>Movement Direction</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11 rounded-sm"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Inward">Inward (Add to Stock)</SelectItem><SelectItem value="Outward">Outward (Remove from Stock)</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />

                <FormField control={form.control} name="siteName" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Project Site (Recording Site)</FormLabel>
                    <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl><Button variant="outline" className={cn("w-full justify-between font-normal h-11 rounded-sm", !field.value && "text-muted-foreground")}>{field.value || "Select site..."}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
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

              <FormField control={form.control} name="sourceOrDestination" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{movementType === 'Inward' ? 'Received From' : 'Sent To'} Name</FormLabel>
                  {sourceOrDestinationType === 'Supplier' ? (
                    <Popover open={isSupplierPopoverOpen} onOpenChange={setIsSupplierPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" disabled={!watchSiteName} className={cn("w-full justify-between h-11 font-normal rounded-sm", !field.value && "text-muted-foreground")}>
                            {field.value || (movementType === 'Inward' ? "Select Supplier (With Approved POs)..." : "Select Supplier...")}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <div className="flex items-center border-b px-3">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <Input placeholder="Search suppliers..." className="h-9 w-full border-none focus-visible:ring-0 px-0" value={supplierSearchQuery} onChange={e => setSupplierSearchQuery(e.target.value)} />
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
                    <Popover open={isSupplierPopoverOpen} onOpenChange={setIsSupplierPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" disabled={!watchSiteName} className={cn("w-full justify-between h-11 font-normal rounded-sm", !field.value && "text-muted-foreground")}>
                            {field.value || "Select Target Site..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <div className="flex items-center border-b px-3">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <Input placeholder="Search sites..." className="h-9 w-full border-none focus-visible:ring-0 px-0" value={supplierSearchQuery} onChange={e => setSupplierSearchQuery(e.target.value)} />
                        </div>
                        <ScrollArea className="h-[200px]">
                          {allSites?.filter(s => s.name !== watchSiteName && s.name.toLowerCase().includes(supplierSearchQuery.toLowerCase())).map(s => (
                            <Button key={s.id} type="button" variant="ghost" className="w-full justify-start h-10 text-sm" onClick={() => { field.onChange(s.name); setIsSupplierPopoverOpen(false); }}>
                              <Check className={cn("mr-2 h-4 w-4 text-primary", s.name === field.value ? "opacity-100" : "opacity-0")} />
                              {s.name}
                            </Button>
                          ))}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  )}
                  <FormMessage />
                </FormItem>
              )} />

              <Separator />

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
                <div className="flex items-center justify-between"><h3 className="text-lg font-black uppercase tracking-widest flex items-center gap-2"><ListPlus className="h-5 w-5 text-primary" /> Authorized Materials List</h3><Button type="button" variant="outline" size="sm" onClick={() => append({ itemName: "", quantity: 0, unit: "Numbers" })} className="rounded-sm border-primary text-primary"><Plus className="mr-2 h-4 w-4" /> Add Line Item</Button></div>
                <div className="space-y-4">{fields.map((field, index) => (
                  <Card key={field.id} className="relative bg-muted/10 border-dashed rounded-sm">
                    <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-8 w-8 text-destructive" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                    <CardContent className="pt-6 space-y-4">
                      <FormField control={form.control} name={`items.${index}.itemName`} render={({ field: itemField }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Authorized Item</FormLabel>
                          <Popover open={openItemPopoverIndex === index} onOpenChange={o => setOpenItemPopoverIndex(o ? index : null)}>
                            <PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full justify-between h-auto min-h-10 bg-background text-left", !itemField.value && "text-muted-foreground")}><span className="truncate whitespace-normal">{itemField.value || "Search contextual materials..."}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></FormControl></PopoverTrigger>
                            <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[500px] p-0" align="start"><div className="flex items-center border-b px-3"><Search className="mr-2 h-4 w-4 shrink-0 opacity-50" /><Input placeholder="Filter materials..." className="h-9 border-none" value={itemSearchQuery} onChange={e => setItemSearchQuery(e.target.value)} /></div><ScrollArea className="h-[250px]"><div className="p-1">{filteredLookupItems.length > 0 ? filteredLookupItems.map((lookup, lIdx) => (<Button key={lIdx} type="button" variant="ghost" className="w-full justify-start h-auto min-h-10 text-xs py-2 px-3 text-left whitespace-normal flex items-start gap-2" onClick={() => { itemField.onChange(lookup.name); form.setValue(`items.${index}.unit`, lookup.unit); setOpenItemPopoverIndex(null); setItemSearchQuery(""); }}><Check className={cn("mt-0.5 h-4 w-4 text-primary shrink-0", lookup.name === itemField.value ? "opacity-100" : "opacity-0")} /><span className="flex-1 break-words leading-relaxed">{lookup.name}</span></Button>)) : (<div className="p-8 text-center text-[10px] font-black uppercase text-muted-foreground italic leading-relaxed">No matching authorized items found for this context.</div>)}</div></ScrollArea></PopoverContent>
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
