"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Check, ChevronsUpDown, Loader2, LayoutGrid, Building2, Layers, CheckCircle2, ListPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const tableSchema = z.object({
  siteId: z.string().min(1, "Project site is required"),
  siteName: z.string(),
  tableName: z.string().min(1, "Table name is required"),
  bomItemId: z.string().min(1, "Configuration is required"),
  configurationType: z.string(),
  modulesPerTable: z.coerce.number().int().min(1, "Must be a positive integer"),
});

type Site = {
  id: string;
  name: string;
};

type BoMItem = {
  id: string;
  itemName: string;
  unit: string;
  subItems?: { name: string; quantityPerSet: number; unit: string }[];
};

export default function AddTableConfigurationPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  const [isBomPopoverOpen, setIsBomPopoverOpen] = React.useState(false);
  const [bomSearchQuery, setBomSearchQuery] = React.useState("");

  const [approvedBomItems, setApprovedBomItems] = React.useState<BoMItem[]>([]);
  const [selectedBomItem, setSelectedBomItem] = React.useState<BoMItem | null>(null);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const form = useForm<z.infer<typeof tableSchema>>({
    resolver: zodResolver(tableSchema),
    defaultValues: { 
      siteId: "", 
      siteName: "", 
      tableName: "", 
      bomItemId: "", 
      configurationType: "",
      modulesPerTable: 0
    },
  });

  const watchSiteId = form.watch("siteId");

  React.useEffect(() => {
    if (watchSiteId) {
      const fetchBom = async () => {
        const q = query(
          collection(firestore, 'project_boms'), 
          where('siteId', '==', watchSiteId),
          where('category', '==', 'Modules Mounting Structure'),
          where('status', '==', 'Approved')
        );
        const snap = await getDocs(q);
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as BoMItem));
        setApprovedBomItems(items);
      };
      fetchBom();
    } else {
      setApprovedBomItems([]);
    }
    // Reset BoM selection if site changes
    form.setValue("bomItemId", "");
    form.setValue("configurationType", "");
    setSelectedBomItem(null);
  }, [watchSiteId, firestore, form]);

  const onSubmit = async (values: z.infer<typeof tableSchema>) => {
    setIsSubmitting(true);
    try {
      await addDocumentNonBlocking(collection(firestore, 'table_configurations'), {
        ...values,
        members: selectedBomItem?.subItems || [],
        createdAt: serverTimestamp(),
        userId: user?.uid,
        userName: user?.displayName || user?.email
      });

      toast({ title: "Configuration Added", description: `Table "${values.tableName}" has been saved.` });
      router.push('/master-data/tables/list');
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
      setIsSubmitting(false);
    }
  };

  const filteredSites = allSites?.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase())) || [];
  const filteredBom = approvedBomItems.filter(i => i.itemName.toLowerCase().includes(bomSearchQuery.toLowerCase()));

  return (
    <div className="space-y-8 max-w-2xl mx-auto pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
          <LayoutGrid className="h-8 w-8" /> Add Table Configuration
        </h1>
        <p className="text-muted-foreground">Define master table data for solar mounting structures.</p>
      </div>

      <Card className="shadow-md border-primary/10 rounded-sm">
        <CardHeader className="bg-primary/5 border-b py-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest">Table Definition</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField control={form.control} name="siteId" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Project Site</FormLabel>
                  <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal h-11 rounded-sm", !field.value && "text-muted-foreground")}>
                          {field.value ? allSites?.find(s => s.id === field.value)?.name : "Select site..."}
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
                        <div className="p-1">
                          {filteredSites.map(site => (
                            <Button key={site.id} type="button" variant="ghost" className="w-full justify-start h-10 text-sm" onClick={() => { field.onChange(site.id); form.setValue('siteName', site.name); setIsSitePopoverOpen(false); }}>
                              <Check className={cn("mr-2 h-4 w-4 text-primary", site.id === field.value ? "opacity-100" : "opacity-0")} />
                              {site.name}
                            </Button>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="tableName" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Table Name</FormLabel>
                  <FormControl><Input placeholder="e.g., Table Type A" {...field} className="h-11 rounded-sm" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="bomItemId" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Table Configuration (BoM Source)</FormLabel>
                  <Popover open={isBomPopoverOpen} onOpenChange={setIsBomPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" disabled={!watchSiteId} role="combobox" className={cn("w-full justify-between font-normal h-11 rounded-sm", !field.value && "text-muted-foreground")}>
                          {field.value ? approvedBomItems.find(i => i.id === field.value)?.itemName : "Select from approved BoM..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <div className="flex items-center border-b px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Input placeholder="Filter materials..." className="h-9 w-full border-none focus-visible:ring-0 px-0 text-sm" value={bomSearchQuery} onChange={e => setBomSearchQuery(e.target.value)} />
                      </div>
                      <ScrollArea className="h-[200px]">
                        <div className="p-1">
                          {filteredBom.length > 0 ? filteredBom.map(item => (
                            <Button key={item.id} type="button" variant="ghost" className="w-full justify-start h-10 text-sm" onClick={() => { field.onChange(item.id); form.setValue('configurationType', item.itemName); setSelectedBomItem(item); setIsBomPopoverOpen(false); }}>
                              <Check className={cn("mr-2 h-4 w-4 text-primary", item.id === field.value ? "opacity-100" : "opacity-0")} />
                              {item.itemName}
                            </Button>
                          )) : <p className="p-4 text-center text-xs text-muted-foreground italic">No approved MMS items found for this site.</p>}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="modulesPerTable" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Modules per Table</FormLabel>
                  <FormControl><Input type="number" {...field} className="h-11 rounded-sm font-mono font-bold" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {selectedBomItem && selectedBomItem.subItems && selectedBomItem.subItems.length > 0 && (
                <div className="space-y-4 p-4 bg-muted/10 border rounded-sm animate-in fade-in zoom-in-95 duration-200">
                  <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5" /> Associated Members/Components
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedBomItem.subItems.map((sub, idx) => (
                      <div key={idx} className="p-3 bg-background border rounded-sm shadow-sm flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground truncate mr-2">{sub.name}</span>
                        <Badge variant="outline" className="h-5 text-[9px] font-black uppercase border-primary/20 text-primary">
                          {sub.quantityPerSet} {sub.unit}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full h-14 text-base font-black uppercase tracking-tight shadow-xl" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <><ListPlus className="mr-2 h-5 w-5" /> REGISTER TABLE DATA</>}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
