
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp, increment, query, where, getDocs, setDoc, and } from "firebase/firestore";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Check, ChevronsUpDown, Loader2, PieChart, Calendar, CheckCircle2, Building2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSuperAdmin } from "@/lib/auth-constants";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

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
};

export default function RecordUtilisationPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  const [isItemPopoverOpen, setIsItemPopoverOpen] = React.useState(false);
  const [itemSearchQuery, setItemSearchQuery] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);

  const [availableMaterials, setAvailableMaterials] = React.useState<InventoryItem[]>([]);

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
  const selectedItem = availableMaterials.find(m => m.itemName === selectedItemName);

  React.useEffect(() => {
    if (selectedSiteId) {
      const fetchAvailable = async () => {
        // Updated: Removed the inequality filter (stockLevel > 0) to avoid composite index requirement.
        // We now filter the results in-memory.
        const q = query(collection(firestore, 'project_inventory'), where('siteId', '==', selectedSiteId));
        const snap = await getDocs(q);
        const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem));
        setAvailableMaterials(results.filter(m => m.stockLevel > 0));
      };
      fetchAvailable();
    } else {
      setAvailableMaterials([]);
    }
  }, [selectedSiteId, firestore]);

  const onSubmit = async (values: z.infer<typeof utilisationSchema>) => {
    if (!user || !userProfile || !selectedItem) return;
    
    if (values.quantity > selectedItem.stockLevel) {
      toast({ variant: 'destructive', title: 'Insufficient Stock', description: `Only ${selectedItem.stockLevel} ${selectedItem.unit} available at this site.` });
      return;
    }

    setIsSubmitting(true);
    try {
      // Site-Specific Manager Lookup (Override Logic)
      const overridesQuery = query(collection(firestore, 'team_mapping_overrides'), and(where('engineerId', '==', user.uid), where('siteId', '==', values.siteId)));
      const overridesSnap = await getDocs(overridesQuery);
      const effectiveSiteManagerId = !overridesSnap.empty ? overridesSnap.docs[0].data().managerId : (userProfile.siteManagerId || null);

      // 1. Log Utilisation Record
      await addDocumentNonBlocking(collection(firestore, 'material_utilisations'), {
        ...values,
        unit: selectedItem.unit,
        userId: user.uid,
        userName: userProfile.username || user.email,
        siteManagerId: effectiveSiteManagerId,
        createdAt: serverTimestamp()
      });

      // 2. Update Inventory (Decrement Stock, Increment Utilised)
      const invRef = doc(firestore, 'project_inventory', selectedItem.id);
      updateDocumentNonBlocking(invRef, {
        stockLevel: increment(-values.quantity),
        utilisedQuantity: increment(values.quantity),
        lastUpdated: serverTimestamp()
      });

      setIsSuccess(true);
      toast({ title: "Consumption Logged", description: "Inventory stock levels adjusted successfully." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const accessibleSites = React.useMemo(() => {
    if (!allSites || !userProfile) return [];
    if (isAdmin) return allSites;
    const assignedIds = new Set(userProfile.assignedProjectIds || []);
    return allSites.filter(s => assignedIds.has(s.id));
  }, [allSites, userProfile, isAdmin]);

  const filteredSites = accessibleSites.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase()));
  const filteredMaterials = availableMaterials.filter(m => m.itemName.toLowerCase().includes(itemSearchQuery.toLowerCase()));

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full animate-in fade-in zoom-in-95 duration-300">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><div className="bg-primary/10 p-4 rounded-full"><CheckCircle2 className="h-12 w-12 text-primary" /></div></div>
            <CardTitle className="text-2xl font-bold">Utilisation Recorded</CardTitle>
            <CardDescription className="text-base">Consumption for <strong>{form.getValues('itemName')}</strong> at <strong>{form.getValues('siteName')}</strong> has been logged.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full h-11" onClick={() => router.push(`/projects/${form.getValues('siteId')}?tab=utilisation`)}>View Site Log</Button>
            <Button className="w-full h-11" onClick={() => { setIsSuccess(false); form.reset(); setAvailableMaterials([]); }}>Record New Entry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
          <PieChart className="h-8 w-8" /> Record Utilisation
        </h1>
        <p className="text-muted-foreground">Log material consumption from available site inventory.</p>
      </div>

      <Card className="shadow-md border-primary/10 rounded-sm">
        <CardHeader><CardTitle>Utilisation Entry Form</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField control={form.control} name="siteId" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Project Site</FormLabel>
                  <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal h-11 rounded-sm", !field.value && "text-muted-foreground")}>
                          {field.value ? accessibleSites.find(s => s.id === field.value)?.name : "Select site..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <div className="flex items-center border-b px-3"><Search className="mr-2 h-4 w-4 shrink-0 opacity-50" /><Input placeholder="Search sites..." className="h-9 border-none" value={siteSearchQuery} onChange={e => setSiteSearchQuery(e.target.value)} /></div>
                      <ScrollArea className="h-[200px]">{filteredSites.map(site => (
                        <Button key={site.id} type="button" variant="ghost" className="w-full justify-start h-10 text-sm" onClick={() => { field.onChange(site.id); form.setValue('siteName', site.name); setIsSitePopoverOpen(false); }}><Check className={cn("mr-2 h-4 w-4 text-primary", site.id === field.value ? "opacity-100" : "opacity-0")} />{site.name}</Button>
                      ))}</ScrollArea>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="itemName" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Material to Consume</FormLabel>
                  <Popover open={isItemPopoverOpen} onOpenChange={setIsItemPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" disabled={!selectedSiteId} className={cn("w-full justify-between font-normal h-11 rounded-sm", !field.value && "text-muted-foreground")}>
                          {field.value || "Choose item from stock..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <div className="flex items-center border-b px-3"><Search className="mr-2 h-4 w-4 shrink-0 opacity-50" /><Input placeholder="Search stock..." className="h-9 border-none" value={itemSearchQuery} onChange={e => setItemSearchQuery(e.target.value)} /></div>
                      <ScrollArea className="h-[200px]">
                        {filteredMaterials.length > 0 ? filteredMaterials.map(item => (
                          <Button key={item.id} type="button" variant="ghost" className="w-full justify-start h-12 text-sm" onClick={() => { field.onChange(item.itemName); setIsItemPopoverOpen(false); }}>
                            <div className="flex flex-col items-start overflow-hidden text-left">
                              <span className="font-bold truncate">{item.itemName}</span>
                              <span className="text-[10px] text-muted-foreground uppercase">Available: {item.stockLevel} {item.unit}</span>
                            </div>
                          </Button>
                        )) : <div className="p-4 text-center text-xs text-muted-foreground italic">No available stock found for this site.</div>}
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="quantity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity Utilised</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type="number" step="0.01" {...field} className="h-11 font-mono font-bold" />
                        {selectedItem && <span className="absolute right-3 top-3 text-[10px] font-black uppercase text-muted-foreground">{selectedItem.unit}</span>}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="utilisationDate" render={({ field }) => (
                  <FormItem><FormLabel>Date of Consumption</FormLabel><FormControl><Input type="date" {...field} className="h-11 rounded-sm" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <FormField control={form.control} name="remarks" render={({ field }) => (
                <FormItem><FormLabel>Utilisation Remarks</FormLabel><FormControl><Textarea placeholder="e.g. Used for mounting structure at Block A..." rows={3} {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              {selectedItem && (
                <div className="p-4 bg-primary/5 rounded-sm border border-primary/10 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-primary shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Submitting this will reduce available <strong>{selectedItem.itemName}</strong> stock by <strong>{form.watch('quantity')} {selectedItem.unit}</strong> and mark it as utilised.
                  </p>
                </div>
              )}

              <Button type="submit" className="w-full h-12 text-lg font-black uppercase" disabled={isSubmitting || !selectedItem}>
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Publish Utilisation"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
