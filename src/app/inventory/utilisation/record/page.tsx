"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp, increment, query, where, getDocs, and, setDoc } from "firebase/firestore";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Check, ChevronsUpDown, Loader2, PieChart, Calendar, CheckCircle2, Building2, AlertCircle, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { slugifyRole } from "@/lib/access-control";
import { Skeleton } from "@/components/ui/skeleton";
import { sendNotification } from "@/lib/notifications";
import { format } from "date-fns";

const utilisationSchema = z.object({
  siteId: z.string().min(1, "Site is required"),
  siteName: z.string(),
  itemName: z.string().min(1, "Item is required"),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0"),
  utilisationDate: z.string().min(1, "Date is required"),
  remarks: z.string().min(5, "Please provide brief remarks (min 5 chars)"),
});

type Site = {
  id: string;
  name: string;
  projectCompany?: string;
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
  assignedProjectIds?: string[];
  siteManagerId?: string;
  ownDataOnly?: boolean;
};

type MappingOverride = {
  id: string;
  engineerId: string;
  siteId: string;
  managerId: string;
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
  status: string;
  items: { itemName: string }[];
};

const UNIT_ABBREVIATIONS: Record<string, string> = {
  "Meters": "m",
  "Kilograms": "kg",
  "Liters": "L",
  "Numbers": "Nos",
  "Sets": "Sets",
  "Bundles": "Bndls",
  "Pairs": "Prs",
  "Drums": "Drms"
};

const getFriendlyUnit = (unit: string) => UNIT_ABBREVIATIONS[unit] || unit;

export default function RecordUtilisationPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const isAdmin = userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<any>(roleConfigsQuery);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const overridesQuery = useMemoFirebase(() => collection(firestore, 'team_mapping_overrides'), [firestore]);
  const { data: allOverrides } = useCollection<MappingOverride>(overridesQuery);

  const teamQuery = useMemoFirebase(() => {
    if (!isManager || !user) return null;
    return query(collection(firestore, 'users'), where('siteManagerId', '==', user.uid));
  }, [firestore, user, isManager]);
  const { data: teamMembers } = useCollection<UserProfile>(teamQuery);

  const accessibleSites = React.useMemo(() => {
    if (!allSites || !userProfile) return [];
    if (isAdmin) return Array.from(new Map(allSites.map(s => [s.name, s])).values()).sort((a, b) => a.name.localeCompare(b.name));
    
    const roleId = userProfile.role ? slugifyRole(userProfile.role) : 'none';
    const isOwnDataOnly = userProfile.ownDataOnly !== undefined 
      ? userProfile.ownDataOnly 
      : roleConfigs?.find(c => c.id === roleId)?.ownDataOnly ?? false;

    if (!isOwnDataOnly) return Array.from(new Map(allSites.map(s => [s.name, s])).values()).sort((a, b) => a.name.localeCompare(b.name));

    const siteIds = new Set<string>(userProfile.assignedProjectIds || []);
    const filtered = allSites.filter(s => siteIds.has(s.id));
    return Array.from(new Map(filtered.map(s => [s.name, s])).values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allSites, userProfile, isAdmin, roleConfigs]);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  const [isItemPopoverOpen, setIsItemPopoverOpen] = React.useState(false);
  const [itemSearchQuery, setItemSearchQuery] = React.useState("");

  const form = useForm<z.infer<typeof utilisationSchema>>({
    resolver: zodResolver(utilisationSchema),
    defaultValues: { 
      siteId: "", 
      siteName: "", 
      itemName: "", 
      quantity: 0, 
      utilisationDate: format(new Date(), 'yyyy-MM-dd'),
      remarks: ""
    },
  });

  const selectedSiteId = form.watch("siteId");
  const selectedItemName = form.watch("itemName");
  const currentQuantity = form.watch("quantity");

  const inventoryQuery = useMemoFirebase(() => {
    if (!selectedSiteId) return null;
    return query(collection(firestore, 'project_inventory'), where('siteId', '==', selectedSiteId));
  }, [firestore, selectedSiteId]);
  const { data: projectInventory } = useCollection<InventoryItem>(inventoryQuery);

  const bomQuery = useMemoFirebase(() => {
    if (!selectedSiteId) return null;
    return query(collection(firestore, 'project_boms'), where('siteId', '==', selectedSiteId), where('status', '==', 'Approved'));
  }, [firestore, selectedSiteId]);
  const { data: approvedBomItems } = useCollection<BoMItem>(bomQuery);

  const poQuery = useMemoFirebase(() => {
    if (!selectedSiteId) return null;
    return query(collection(firestore, 'project_pos'), where('siteId', '==', selectedSiteId), where('status', '==', 'Accepted'));
  }, [firestore, selectedSiteId]);
  const { data: acceptedPOs } = useCollection<PurchaseOrder>(poQuery);

  const filteredMaterials = React.useMemo(() => {
    if (!selectedSiteId || !approvedBomItems || !acceptedPOs) return [];
    
    const poItemNames = new Set<string>();
    acceptedPOs.forEach(po => po.items?.forEach(it => poItemNames.add(it.itemName)));

    const list: { itemName: string; unit: string; stockLevel: number; id: string }[] = [];

    approvedBomItems.forEach(bom => {
      if (poItemNames.has(bom.itemName)) {
        if (bom.subItems && bom.subItems.length > 0) {
          bom.subItems.forEach(sub => {
            const fullName = `${bom.itemName} - ${sub.name}`;
            const inv = projectInventory?.find(i => i.itemName === fullName);
            list.push({
              id: inv?.id || `new-${fullName}`,
              itemName: fullName,
              unit: sub.unit,
              stockLevel: inv?.stockLevel || 0
            });
          });
        } else {
          const inv = projectInventory?.find(i => i.itemName === bom.itemName);
          list.push({
            id: inv?.id || `new-${bom.id}`,
            itemName: bom.itemName,
            unit: bom.unit,
            stockLevel: inv?.stockLevel || 0
          });
        }
      }
    });

    return list.filter(m => m.itemName.toLowerCase().includes(itemSearchQuery.toLowerCase()));
  }, [selectedSiteId, approvedBomItems, acceptedPOs, projectInventory, itemSearchQuery]);

  const selectedItem = filteredMaterials.find(m => m.itemName === selectedItemName);
  const isOverStock = selectedItem && currentQuantity > selectedItem.stockLevel;

  const onSubmit = async (values: z.infer<typeof utilisationSchema>) => {
    if (!user || !userProfile || !selectedItem) return;
    
    if (values.quantity > selectedItem.stockLevel) {
      toast({ variant: 'destructive', title: 'Insufficient Stock', description: `Only ${selectedItem.stockLevel} ${selectedItem.unit} available at this site.` });
      return;
    }

    setIsSubmitting(true);
    try {
      const overridesQ = query(collection(firestore, 'team_mapping_overrides'), and(where('engineerId', '==', user.uid), where('siteId', '==', values.siteId)));
      const overridesSnap = await getDocs(overridesQ);
      const effectiveSiteManagerId = !overridesSnap.empty ? overridesSnap.docs[0].data().managerId : (userProfile.siteManagerId || null);

      await addDocumentNonBlocking(collection(firestore, 'material_utilisations'), {
        ...values,
        unit: selectedItem.unit,
        userId: user.uid,
        userName: userProfile.username || user.email,
        siteManagerId: effectiveSiteManagerId,
        createdAt: serverTimestamp()
      });

      if (!selectedItem.id.startsWith('new-')) {
        updateDocumentNonBlocking(doc(firestore, 'project_inventory', selectedItem.id), {
          stockLevel: increment(-values.quantity),
          utilisedQuantity: increment(values.quantity),
          lastUpdated: serverTimestamp()
        });
      }

      setIsSuccess(true);
      toast({ title: "Consumption Logged", description: "Inventory stock levels adjusted successfully." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
      setIsSubmitting(false);
    }
  };

  const filteredSites = accessibleSites.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase()));

  if (isProfileLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4 animate-in fade-in zoom-in-95 duration-500">
        <Card className="max-w-md w-full rounded-sm shadow-2xl border-emerald-500/20">
          <CardHeader className="text-center pt-8">
            <div className="flex justify-center mb-6">
              <div className="bg-emerald-500/10 p-6 rounded-full"><CheckCircle2 className="h-16 w-16 text-emerald-600" /></div>
            </div>
            <CardTitle className="text-2xl font-black uppercase tracking-tight text-emerald-900">Utilisation Logged</CardTitle>
            <CardDescription className="text-base font-medium text-emerald-800/70 mt-2 text-center">
              The material consumption report for <strong>{selectedItemName}</strong> has been successfully archived.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pb-8 px-8">
            <Button className="w-full h-12 text-sm font-black uppercase bg-emerald-600 shadow-lg" onClick={() => router.push("/inventory/utilisation/data")}>View Utilisation Data</Button>
            <Button variant="ghost" className="w-full h-10 text-[10px] font-black uppercase text-muted-foreground" onClick={() => { setIsSuccess(false); form.reset(); setItemSearchQuery(""); }}>Record New Entry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 max-w-2xl mx-auto pb-20 px-2 sm:px-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-primary flex items-center gap-2 uppercase leading-none">
          <PieChart className="h-6 w-6 md:h-8 md:w-8" /> Record Utilisation
        </h1>
        <p className="text-muted-foreground font-medium text-xs md:text-sm">Log material consumption from available site inventory.</p>
      </div>

      <Card className="shadow-md border-primary/10 rounded-sm overflow-hidden">
        <CardHeader className="bg-primary/5 border-b p-4 sm:p-6">
          <CardTitle className="text-sm font-bold uppercase tracking-widest">Utilisation Entry Form</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
              <FormField control={form.control} name="siteId" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Project Site</FormLabel>
                  <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal h-12 rounded-sm text-left px-4", !field.value && "text-muted-foreground")}>
                          <span className="truncate">{field.value ? accessibleSites.find(s => s.id === field.value)?.name : "Select site..."}</span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-2xl border-primary/10">
                      <div className="flex items-center border-b px-3 bg-muted/20"><Search className="mr-2 h-4 w-4 shrink-0 opacity-50" /><Input placeholder="Search sites..." className="h-10 border-none focus-visible:ring-0 text-sm bg-transparent" value={siteSearchQuery} onChange={e => setSiteSearchQuery(e.target.value)} /></div>
                      <ScrollArea className="h-[200px]">
                        <div className="p-1">
                          {filteredSites.map(site => (
                            <Button key={site.id} type="button" variant="ghost" className="w-full justify-start h-auto py-3 px-4 mb-0.5 text-xs text-left rounded-sm group hover:bg-primary/5" onClick={() => { field.onChange(site.id); form.setValue('siteName', site.name); setIsSitePopoverOpen(false); }}>
                              <Check className={cn("mr-2 h-4 w-4 text-primary shrink-0", site.id === field.value ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col items-start min-w-0">
                                <span className={cn("font-bold truncate w-full", site.id === field.value ? "text-primary" : "text-foreground")}>{site.name}</span>
                                <span className="text-[9px] text-muted-foreground uppercase opacity-60">{site.projectCompany}</span>
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

              <FormField control={form.control} name="itemName" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Material to Consume</FormLabel>
                  <Popover open={isItemPopoverOpen} onOpenChange={setIsItemPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" disabled={!selectedSiteId} className={cn("w-full justify-between font-normal h-auto min-h-[3rem] rounded-sm text-left px-4 py-3", !field.value && "text-muted-foreground")}>
                          <span className="whitespace-normal leading-tight">{field.value ? `${field.value} (Stock: ${selectedItem?.stockLevel.toLocaleString()} ${getFriendlyUnit(selectedItem?.unit || "")})` : "Choose material..."}</span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] sm:w-[500px] p-0 shadow-2xl border-primary/10">
                      <div className="flex items-center border-b px-3 bg-muted/20"><Search className="mr-2 h-4 w-4 shrink-0 opacity-50" /><Input placeholder="Filter materials..." className="h-10 border-none focus-visible:ring-0 text-sm bg-transparent" value={itemSearchQuery} onChange={e => setItemSearchQuery(e.target.value)} /></div>
                      <ScrollArea className="h-[200px]">
                        <div className="p-1">
                          {filteredMaterials.length > 0 ? filteredMaterials.map(item => (
                            <Button key={item.id} type="button" variant="ghost" className="w-full justify-start h-auto min-h-12 py-3 px-4 text-sm rounded-sm mb-0.5 group hover:bg-primary/5" onClick={() => { field.onChange(item.itemName); setIsItemPopoverOpen(false); }}>
                              <div className="flex items-center justify-between w-full gap-4">
                                <span className={cn("font-bold truncate flex-1 text-left", item.itemName === field.value ? "text-primary" : "text-foreground")}>{item.itemName}</span>
                                <span className={cn("text-[10px] font-black uppercase whitespace-nowrap shrink-0 px-2 py-0.5 rounded-sm", item.stockLevel > 0 ? "bg-primary/5 text-primary" : "bg-red-50 text-red-500")}>
                                  {item.stockLevel.toLocaleString()} {getFriendlyUnit(item.unit)}
                                </span>
                              </div>
                            </Button>
                          )) : <div className="p-10 text-center text-xs text-muted-foreground italic leading-relaxed uppercase font-black opacity-30 tracking-widest">No materials found</div>}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <FormField control={form.control} name="quantity" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quantity Consumed</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type="number" 
                          step="0.01" 
                          {...field} 
                          onFocus={e => e.target.select()} 
                          className={cn("h-12 font-mono font-black text-lg rounded-sm pr-12 focus:ring-primary/20", isOverStock && "border-destructive text-destructive")} 
                          max={selectedItem?.stockLevel}
                        />
                        {selectedItem && <span className="absolute right-4 top-3.5 text-[10px] font-black uppercase text-primary bg-primary/5 px-1.5 py-0.5 rounded-sm">{getFriendlyUnit(selectedItem.unit)}</span>}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="utilisationDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Consumption Date</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type="date" {...field} className="h-12 rounded-sm font-bold bg-background pr-10" />
                        <Calendar className="absolute right-3 top-4 h-4 w-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="remarks" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Audit Remarks</FormLabel>
                  <FormControl><Textarea placeholder="Explain the context or reason for this consumption..." rows={4} {...field} className="rounded-sm text-sm focus:ring-primary/20 min-h-[100px]" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {selectedItem && (
                <div className={cn("p-4 rounded-sm border flex items-start gap-3 animate-in slide-in-from-top-1 duration-300", isOverStock ? "bg-red-50 border-red-200" : "bg-primary/5 border-primary/10")}>
                  {isOverStock ? <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" /> : <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />}
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    {isOverStock ? (
                      <strong className="text-red-700 uppercase font-black">Error: Insufficient Stock! </strong>
                    ) : (
                      <strong>Inventory Adjustment: </strong>
                    )}
                    Submitting this will reduce <strong>{selectedItem.itemName}</strong> stock by <strong>{currentQuantity} {selectedItem.unit}</strong>. Current balance: <span className={cn("font-bold", isOverStock ? "text-red-800" : "text-foreground")}>{selectedItem.stockLevel} {selectedItem.unit}</span>.
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full h-14 text-base font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-[0.98]" disabled={isSubmitting || !selectedItem || isOverStock}>
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <><Save className="mr-2 h-5 w-5" /> PUBLISH UTILISATION</>}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
