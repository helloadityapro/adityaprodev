
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
import { collection, doc, serverTimestamp, increment, query, where } from "firebase/firestore";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Check, ChevronsUpDown, Loader2, ArrowLeftRight, Calendar, Plus, Trash2, ListPlus, Truck, Building2, CheckCircle2, MessageCircle, FileUp, FileText, X, MapPin, Hash, Smartphone } from "lucide-react";
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
  unit: z.enum(["Numbers", "Kilograms", "Liters", "Meters", "Sets"], { required_error: "Unit is required" }),
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

  const settingsRef = useMemoFirebase(() => doc(firestore, 'system_settings', 'rewards'), [firestore]);
  const { data: rewardSettings } = useDoc<RewardSettings>(settingsRef);

  // Fetch team members for managers to aggregate sites
  const teamQuery = useMemoFirebase(() => {
    if (!isManager || !user) return null;
    return query(collection(firestore, 'users'), where('siteManagerId', '==', user.uid));
  }, [firestore, user, isManager]);
  const { data: teamMembers } = useCollection<UserProfile>(teamQuery);

  const accessibleSites = React.useMemo(() => {
    if (!allSites || !userProfile) return [];
    if (isAdmin) {
        return Array.from(new Map(allSites.map(s => [s.name, s])).values());
    }
    
    // Aggregated site visibility for Managers
    const assignedIds = new Set<string>(userProfile.assignedProjectIds || []);
    if (isManager && teamMembers) {
      teamMembers.forEach(member => {
        (member.assignedProjectIds || []).forEach(id => assignedIds.add(id));
      });
    }

    const filtered = allSites.filter(s => assignedIds.has(s.id));
    return Array.from(new Map(filtered.map(s => [s.name, s])).values());
  }, [allSites, userProfile, isAdmin, isManager, teamMembers]);

  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  
  const [isTargetSitePopoverOpen, setIsTargetSitePopoverOpen] = React.useState(false);
  const [targetSiteSearchQuery, setTargetSiteSearchQuery] = React.useState("");

  const [isSupplierPopoverOpen, setIsSupplierPopoverOpen] = React.useState(false);
  const [supplierSearchQuery, setSupplierSearchQuery] = React.useState("");

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [submittedData, setSubmittedData] = React.useState<z.infer<typeof movementSchema> & { attachments?: any[] } | null>(null);
  
  const [invoiceFiles, setInvoiceFiles] = React.useState<File[]>([]);

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
  const siteNameValue = form.watch("siteName");

  const selectedSite = React.useMemo(() => {
    return accessibleSites.find(s => s.name === siteNameValue);
  }, [accessibleSites, siteNameValue]);

  const selectedTarget = React.useMemo(() => {
    if (!sourceOrDestinationValue) return null;
    if (sourceOrDestinationType === 'Site') {
      return allSites?.find(s => s.name === sourceOrDestinationValue);
    } else {
      return allSuppliers?.find(s => s.name === sourceOrDestinationValue);
    }
  }, [sourceOrDestinationValue, sourceOrDestinationType, allSites, allSuppliers]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setInvoiceFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setInvoiceFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (userId: string): Promise<any[]> => {
    const storage = getStorage(firebaseApp);
    const results: any[] = [];
    const timestamp = Date.now();

    for (const file of invoiceFiles) {
      const storagePath = `uploads/${userId}/movements/${timestamp}-${file.name.replace(/\s+/g, '_')}`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      const downloadUrl = await new Promise<string>((resolve, reject) => {
        uploadTask.on('state_changed', null, reject, async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(url);
        });
      });

      results.push({
        url: downloadUrl,
        name: file.name,
        contentType: file.type,
        timestamp: new Date().toISOString()
      });
    }
    return results;
  };

  const onSubmit = async (values: z.infer<typeof movementSchema>) => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);
    try {
      const attachments = await uploadFiles(user.uid);
      const siteId = accessibleSites.find(s => s.name === values.siteName)?.id;

      const promises = values.items.map(item => {
        return addDocumentNonBlocking(collection(firestore, 'material_movements'), {
          siteId: siteId || null,
          siteName: values.siteName,
          movementType: values.movementType,
          sourceOrDestinationType: values.sourceOrDestinationType,
          sourceOrDestination: values.sourceOrDestination,
          movementDate: values.movementDate,
          ...item,
          attachments,
          userId: user.uid,
          userName: userProfile?.username || user.email,
          siteManagerId: userProfile?.siteManagerId || null,
          createdAt: serverTimestamp(),
        });
      });

      await Promise.all(promises);

      const rateEngineer = rewardSettings?.movementEngineer ?? 0.1;
      const rateManager = rewardSettings?.movementManager ?? 0.05;
      const multiplier = userProfile.pointsMultiplier || 1;
      
      const engineerPoints = rateEngineer * values.items.length * multiplier;
      updateDocumentNonBlocking(doc(firestore, 'users', user.uid), {
        totalPoints: increment(engineerPoints)
      });

      if (userProfile.siteManagerId && userProfile.siteManagerId !== user.uid) {
        const managerPoints = rateManager * values.items.length;
        updateDocumentNonBlocking(doc(firestore, 'users', userProfile.siteManagerId), {
            totalPoints: increment(managerPoints)
        });
      }
      
      setSubmittedData({ ...values, attachments });
      setIsSubmitted(true);
      toast({ title: "Success", description: `${values.items.length} movement logs recorded. Points updated.` });
      form.reset({ 
        siteName: "", 
        movementType: values.movementType,
        sourceOrDestinationType: "Supplier",
        sourceOrDestination: "",
        movementDate: format(new Date(), 'yyyy-MM-dd'),
        items: [{ itemName: "", quantity: 0, unit: "Numbers" }] 
      });
      setInvoiceFiles([]);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerWhatsApp = () => {
    if (!submittedData) return;
    const itemsList = submittedData.items.map(item => `- ${item.itemName}: ${item.quantity} ${item.unit}`).join('\n');
    const sourceLabel = submittedData.movementType === 'Inward' ? 'From' : 'To';
    const message = `*Aditya Pro - Material Movement Report*\n\n*Site:* ${submittedData.siteName}\n*Date:* ${format(new Date(submittedData.movementDate), 'dd MMM yyyy')}\n*Type:* ${submittedData.movementType} (${sourceLabel} ${submittedData.sourceOrDestinationType}: ${submittedData.sourceOrDestination})\n*Submitted By:* ${userProfile?.username || user?.email}\n\n*Items Recorded:*\n${itemsList}${submittedData.attachments?.length ? `\n\n_Note: Invoices/Photos uploaded to system._` : ''}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const filteredSites = accessibleSites.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase()));
  
  const allSitesList = allSites ? Array.from(new Map(allSites.map(s => [s.name, s])).values()) : [];
  const filteredAllSites = allSitesList.filter(s => s.name.toLowerCase().includes(targetSiteSearchQuery.toLowerCase()));

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
            <CardTitle className="text-2xl font-bold">Movement Recorded</CardTitle>
            <CardDescription className="text-base">
              {submittedData.items.length} item(s) logged for <strong className="text-primary">{submittedData.siteName}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg font-semibold rounded-sm shadow-md" 
              onClick={triggerWhatsApp}
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              Push to WhatsApp
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-11 rounded-sm" onClick={() => router.push('/movements/list')}>
                View Log Data
              </Button>
              <Button variant="secondary" className="h-11 rounded-sm" onClick={() => {
                setIsSubmitted(false);
                setSubmittedData(null);
                form.reset();
              }}>
                Record New
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2 uppercase">
          <ArrowLeftRight className="h-8 w-8" /> Record Movement
        </h1>
        <p className="text-muted-foreground">Log inward or outward material movement at site.</p>
      </div>

      <Card className="shadow-md border-primary/10 rounded-sm">
        <CardHeader>
          <CardTitle>Material Movement Form</CardTitle>
          <CardDescription>Select site and record the movement details. You can also upload invoices.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="siteName" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Current Site</FormLabel>
                    <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button 
                            variant="outline" 
                            role="combobox" 
                            className={cn("w-full justify-between font-normal rounded-sm", !field.value && "text-muted-foreground")}
                          >
                            {field.value || "Select site..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <div className="flex items-center border-b px-3">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <Input 
                            placeholder="Search sites..." 
                            className="h-9 w-full border-none focus-visible:ring-0 px-0" 
                            value={siteSearchQuery} 
                            onChange={(e) => setSiteSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                          />
                        </div>
                        <ScrollArea className="h-[200px]">
                          {filteredSites.length > 0 ? filteredSites.map((site) => (
                            <Button 
                                key={site.id} 
                                type="button" 
                                variant="ghost" 
                                className="w-full justify-start font-normal text-left" 
                                onClick={() => { field.onChange(site.name); setIsSitePopoverOpen(false); }}
                            >
                              <Check className={cn("mr-2 h-4 w-4 shrink-0", site.name === field.value ? "opacity-100" : "opacity-0")} />
                              <span className="truncate">{site.name}</span>
                            </Button>
                          )) : (
                            <div className="p-4 text-center text-sm text-muted-foreground">No sites found.</div>
                          )}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="movementDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Movement Date</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type="date" {...field} className="rounded-sm pr-10" />
                        <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="movementType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Movement Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-sm">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Inward">Inward (Stock Coming In)</SelectItem>
                        <SelectItem value="Outward">Outward (Stock Going Out)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="space-y-4">
                  <FormField control={form.control} name="sourceOrDestinationType" render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>{movementType === 'Inward' ? 'Inward From' : 'Outward To'}</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(val) => {
                            field.onChange(val);
                            form.setValue("sourceOrDestination", "");
                          }}
                          defaultValue={field.value}
                          className="flex gap-4"
                        >
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl><RadioGroupItem value="Supplier" /></FormControl>
                            <FormLabel className="font-normal cursor-pointer flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Supplier</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl><RadioGroupItem value="Site" /></FormControl>
                            <FormLabel className="font-normal cursor-pointer flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Project Site</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="sourceOrDestination" render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        {sourceOrDestinationType === 'Site' ? (
                          <Popover open={isTargetSitePopoverOpen} onOpenChange={setIsTargetSitePopoverOpen}>
                            <PopoverTrigger asChild>
                              <Button 
                                variant="outline" 
                                role="combobox" 
                                className={cn("w-full justify-between font-normal rounded-sm", !field.value && "text-muted-foreground")}
                              >
                                {field.value || "Select target site..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                              <div className="flex items-center border-b px-3">
                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <Input 
                                  placeholder="Search sites..." 
                                  className="h-9 w-full border-none focus-visible:ring-0 px-0" 
                                  value={targetSiteSearchQuery} 
                                  onChange={(e) => setTargetSiteSearchQuery(e.target.value)}
                                  onKeyDown={(e) => e.stopPropagation()}
                                />
                              </div>
                              <ScrollArea className="h-[200px]">
                                {filteredAllSites.length > 0 ? filteredAllSites.map((site) => (
                                  <Button 
                                      key={site.id} 
                                      type="button" 
                                      variant="ghost" 
                                      className="w-full justify-start font-normal text-left" 
                                      onClick={() => { field.onChange(site.name); setIsTargetSitePopoverOpen(false); }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4 shrink-0", site.name === field.value ? "opacity-100" : "opacity-0")} />
                                    <span className="truncate">{site.name}</span>
                                  </Button>
                                )) : (
                                  <div className="p-4 text-center text-sm text-muted-foreground">No sites found.</div>
                                )}
                              </ScrollArea>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <Popover open={isSupplierPopoverOpen} onOpenChange={setIsSupplierPopoverOpen}>
                            <PopoverTrigger asChild>
                              <Button 
                                variant="outline" 
                                role="combobox" 
                                className={cn("w-full justify-between font-normal rounded-sm", !field.value && "text-muted-foreground")}
                              >
                                {field.value || "Select supplier..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                              <div className="flex items-center border-b px-3">
                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <Input 
                                  placeholder="Search suppliers..." 
                                  className="h-9 w-full border-none focus-visible:ring-0 px-0" 
                                  value={supplierSearchQuery} 
                                  onChange={(e) => setSupplierSearchQuery(e.target.value)}
                                  onKeyDown={(e) => e.stopPropagation()}
                                />
                              </div>
                              <ScrollArea className="h-[200px]">
                                {filteredSuppliers.length > 0 ? filteredSuppliers.map((supplier) => (
                                  <Button 
                                      key={supplier.id} 
                                      type="button" 
                                      variant="ghost" 
                                      className="w-full justify-start font-normal text-left" 
                                      onClick={() => { field.onChange(supplier.name); setIsSupplierPopoverOpen(false); }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4 shrink-0", supplier.name === field.value ? "opacity-100" : "opacity-0")} />
                                    <span className="truncate">{supplier.name}</span>
                                  </Button>
                                )) : (
                                  <div className="p-4 text-center text-sm text-muted-foreground">No suppliers found.</div>
                                )}
                              </ScrollArea>
                            </PopoverContent>
                          </Popover>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  {selectedSite ? (
                    <div className="p-4 bg-primary/5 rounded-sm border border-primary/10 text-xs animate-in fade-in duration-300 h-full">
                      <p className="font-bold text-primary uppercase tracking-widest text-[9px] mb-3 flex items-center gap-1.5">
                        <MapPin className="h-3 w-3" /> {movementType === 'Inward' ? 'MOVEMENT TO' : 'MOVEMENT FROM'}
                      </p>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                        <div>
                          <p className="text-muted-foreground uppercase font-black text-[8px] tracking-tighter">Company</p>
                          <p className="font-bold truncate" title={selectedSite.projectCompany}>{selectedSite.projectCompany}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground uppercase font-black text-[8px] tracking-tighter">Site ID</p>
                          <p className="font-mono">{selectedSite.id.slice(0, 8)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground uppercase font-black text-[8px] tracking-tighter">AC Capacity (MW)</p>
                          <p className="font-bold">{formatCapacity(selectedSite.acCapacity)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground uppercase font-black text-[8px] tracking-tighter">DC Capacity (MWp)</p>
                          <p className="font-bold">{formatCapacity(selectedSite.dcCapacity)}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full border border-dashed rounded-sm flex items-center justify-center p-8 bg-muted/5">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold text-center">Select current site to view details</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {selectedTarget ? (
                    <div className="p-4 bg-amber-500/5 rounded-sm border border-amber-500/10 text-xs animate-in fade-in duration-300 h-full">
                      <p className="font-bold text-amber-700 uppercase tracking-widest text-[9px] mb-3 flex items-center gap-1.5">
                        {sourceOrDestinationType === 'Supplier' ? <Truck className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                        {movementType === 'Inward' ? 'MOVEMENT FROM' : 'MOVEMENT TO'}
                      </p>
                      {sourceOrDestinationType === 'Supplier' ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-muted-foreground uppercase font-black text-[8px] tracking-tighter">GSTIN</p>
                              <p className="font-mono font-bold flex items-center gap-1 uppercase"><Hash className="h-2.5 w-2.5" /> {(selectedTarget as Supplier).gstin.toUpperCase()}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground uppercase font-black text-[8px] tracking-tighter">Mobile</p>
                              <p className="font-bold flex items-center gap-1"><Smartphone className="h-2.5 w-2.5" /> {(selectedTarget as Supplier).mobile}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-muted-foreground uppercase font-black text-[8px] tracking-tighter">Address</p>
                            <p className="font-medium leading-relaxed">{(selectedTarget as Supplier).address}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                          <div>
                            <p className="text-muted-foreground uppercase font-black text-[8px] tracking-tighter">Company</p>
                            <p className="font-bold truncate">{(selectedTarget as Site).projectCompany}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground uppercase font-black text-[8px] tracking-tighter">Site ID</p>
                            <p className="font-mono">{(selectedTarget as Site).id.slice(0, 8)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground uppercase font-black text-[8px] tracking-tighter">AC Capacity (MW)</p>
                            <p className="font-bold">{formatCapacity((selectedTarget as Site).acCapacity)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground uppercase font-black text-[8px] tracking-tighter">DC Capacity (MWp)</p>
                            <p className="font-bold">{formatCapacity((selectedTarget as Site).dcCapacity)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full border border-dashed rounded-sm flex items-center justify-center p-8 bg-muted/5">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold text-center">
                        Select {sourceOrDestinationType === 'Supplier' ? 'supplier' : 'target site'} to view info
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <Label className="flex items-center gap-2 font-bold uppercase text-[10px] tracking-widest text-muted-foreground">
                  <FileUp className="h-3 w-3" /> Invoice / Delivery Challan
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      id="invoice-upload"
                    />
                    <Button 
                      asChild 
                      variant="outline" 
                      className="w-full border-dashed h-20 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-all"
                    >
                      <label htmlFor="invoice-upload" className="cursor-pointer">
                        <FileUp className="h-6 w-6 text-primary" />
                        <span className="text-xs font-bold uppercase tracking-tight">Upload or Capture Invoice</span>
                      </label>
                    </Button>
                  </div>
                  
                  {invoiceFiles.length > 0 && (
                    <div className="border rounded-sm bg-muted/5 p-2 overflow-y-auto max-h-20 space-y-1">
                      {invoiceFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-background p-1.5 rounded-sm border text-[10px]">
                          <div className="flex items-center gap-2 truncate">
                            {file.type.includes('pdf') ? <FileText className="h-3 w-3 text-red-500" /> : <CheckCircle2 className="h-3 w-3 text-green-500" />}
                            <span className="truncate">{file.name}</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 text-destructive" 
                            onClick={() => removeFile(idx)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <ListPlus className="h-5 w-5 text-primary" /> Item List
                    </h3>
                    <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => append({ itemName: "", quantity: 0, unit: "Numbers" })}
                        className="rounded-sm border-primary text-primary hover:bg-primary/5"
                    >
                        <Plus className="mr-2 h-4 w-4" /> Add Another Item
                    </Button>
                </div>

                {fields.map((field, index) => (
                  <Card key={field.id} className="relative bg-muted/10 border-dashed rounded-sm overflow-hidden">
                    {fields.length > 1 && (
                        <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="absolute top-2 right-2 h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => remove(index)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                    <CardContent className="pt-6 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="rounded-sm font-mono text-[10px]">Item #{index + 1}</Badge>
                        </div>
                        
                        <FormField control={form.control} name={`items.${index}.itemName`} render={({ field }) => (
                            <FormItem>
                                <FormLabel>Item Name</FormLabel>
                                <FormControl>
                                    <Input 
                                        placeholder="Enter item name..." 
                                        {...field} 
                                        className="rounded-sm bg-background" 
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Quantity</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" placeholder="0.00" {...field} className="rounded-sm bg-background" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField control={form.control} name={`items.${index}.unit`} render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Unit</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="rounded-sm bg-background">
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {["Numbers", "Kilograms", "Liters", "Meters", "Sets"].map(u => (
                                                <SelectItem key={u} value={u}>{u}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-end gap-4 pt-6 border-t">
                <Button type="submit" className="min-w-[200px] h-12 rounded-sm text-lg font-semibold" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Recording...</> : "Record Movement"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
