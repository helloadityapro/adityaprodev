'use client';

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Check, ChevronsUpDown, Loader2, ClipboardList, Plus, Trash2, CheckCircle2, Building2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { isSuperAdmin } from "@/lib/auth-constants";
import { slugifyRole } from "@/lib/access-control";
import { Skeleton } from "@/components/ui/skeleton";

const itemSchema = z.object({
  itemId: z.string().min(1, "Material selection is required"),
  itemName: z.string(),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0"),
  unit: z.string().min(1, "Unit is required"),
});

const requisitionSchema = z.object({
  siteId: z.string().min(1, "Site selection is required"),
  siteName: z.string(),
  urgency: z.enum(["Low", "Medium", "High"], { required_error: "Urgency is required" }),
  neededBy: z.string().min(1, "Target date is required"),
  remarks: z.string().optional(),
  items: z.array(itemSchema).min(1, "Add at least one item"),
});

type Site = { id: string; name: string };
type MasterItem = { id: string; name: string; unit: string; category: string; make: string };

export default function SubmitRequisitionPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const masterItemsQuery = useMemoFirebase(() => collection(firestore, 'master_inventory'), [firestore]);
  const { data: masterInventory } = useCollection<MasterItem>(masterItemsQuery);

  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearch, setSiteSearch] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [openItemIndex, setOpenItemIndex] = React.useState<number | null>(null);
  const [itemSearch, setItemSearch] = React.useState("");

  const form = useForm<z.infer<typeof requisitionSchema>>({
    resolver: zodResolver(requisitionSchema),
    defaultValues: { 
      siteId: "", 
      siteName: "", 
      urgency: "Medium",
      neededBy: format(new Date(), 'yyyy-MM-dd'),
      remarks: "",
      items: [{ itemId: "", itemName: "", quantity: 0, unit: "Numbers" }] 
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  const onSubmit = async (values: z.infer<typeof requisitionSchema>) => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);
    try {
      await addDocumentNonBlocking(collection(firestore, 'material_requisitions'), {
        ...values,
        userId: user.uid,
        userName: userProfile.username || user.email,
        status: 'Pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setIsSuccess(true);
      toast({ title: "Requisition Raised", description: `Request for ${values.siteName} has been submitted.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Submission Failed", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const accessibleSites = React.useMemo(() => {
    if (!allSites) return [];
    return allSites.sort((a, b) => a.name.localeCompare(b.name));
  }, [allSites]);

  if (isProfileLoading) return <div className="p-8"><Skeleton className="h-10 w-48" /></div>;

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4 animate-in fade-in zoom-in-95 duration-500">
        <Card className="max-w-md w-full rounded-sm shadow-2xl border-emerald-500/20">
          <CardHeader className="text-center pt-8">
            <div className="flex justify-center mb-6">
              <div className="bg-emerald-500/10 p-6 rounded-full"><CheckCircle2 className="h-16 w-16 text-emerald-600" /></div>
            </div>
            <CardTitle className="text-2xl font-black uppercase tracking-tight text-emerald-900">Request Logged</CardTitle>
            <CardDescription className="text-base font-medium text-emerald-800/70 mt-2">
              Your material requisition has been sent for administrative review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pb-8 px-8">
            <Button className="w-full h-12 text-sm font-black uppercase bg-emerald-600 shadow-lg" onClick={() => router.push("/requisitions/list")}>Track Requisitions</Button>
            <Button variant="ghost" className="w-full h-10 text-[10px] font-black uppercase" onClick={() => { setIsSuccess(false); form.reset(); }}>Raise Another</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredSites = accessibleSites.filter(s => s.name.toLowerCase().includes(siteSearch.toLowerCase()));

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
          <ClipboardList className="h-8 w-8" /> Raise Material Requisition
        </h1>
        <p className="text-muted-foreground font-medium">Request materials from master inventory for site deployment.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card className="rounded-sm shadow-md border-primary/10">
            <CardHeader className="bg-primary/5 border-b py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Request Context
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="siteId" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Project Site *</FormLabel>
                  <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal h-11 rounded-sm", !field.value && "text-muted-foreground")}>
                          {field.value ? accessibleSites.find(s => s.id === field.value)?.name : "Choose site..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <div className="flex items-center border-b px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Input placeholder="Search sites..." className="h-10 w-full border-none focus-visible:ring-0 px-0" value={siteSearch} onChange={e => setSiteSearch(e.target.value)} />
                      </div>
                      <ScrollArea className="h-[200px]">
                        <div className="p-1">
                          {allSites?.filter(s => s.name.toLowerCase().includes(siteSearch.toLowerCase())).map(site => (
                            <Button key={site.id} type="button" variant="ghost" className="w-full justify-start h-10 text-xs" onClick={() => { 
                              field.onChange(site.id); 
                              form.setValue('siteName', site.name); 
                              setIsSitePopoverOpen(false); 
                            }}>
                              <Check className={cn("mr-2 h-4 w-4 text-primary", field.value === site.id ? "opacity-100" : "opacity-0")} />
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

              <FormField control={form.control} name="urgency" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Urgency Level</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger className="h-11 rounded-sm"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              <FormField control={form.control} name="neededBy" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Target Date</FormLabel>
                  <FormControl><Input type="date" {...field} className="h-11 rounded-sm" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="remarks" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Special Instructions</FormLabel>
                  <FormControl><Input placeholder="Reason for request..." {...field} className="h-11 rounded-sm" /></FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" /> Materials Required
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ itemId: "", itemName: "", quantity: 0, unit: "Numbers" })} className="h-8 rounded-sm font-bold border-primary text-primary hover:bg-primary/5">
                Add More Line
              </Button>
            </div>
            <div className="space-y-3">
              {fields.map((field, index) => (
                <Card key={field.id} className="relative bg-muted/5 border-dashed rounded-sm">
                  {fields.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 text-destructive" onClick={() => remove(index)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-6">
                      <FormField control={form.control} name={`items.${index}.itemId`} render={({ field: itemField }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-[9px] font-bold uppercase">Material Selection</FormLabel>
                          <Popover open={openItemIndex === index} onOpenChange={o => setOpenItemIndex(o ? index : null)}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button variant="outline" role="combobox" className={cn("w-full justify-between h-10 bg-background text-left text-xs rounded-sm", !itemField.value && "text-muted-foreground")}>
                                  <span className="truncate">{itemField.value ? masterInventory?.find(i => i.id === itemField.value)?.name : "Search Master Inventory..."}</span>
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0 shadow-xl border-primary/10">
                              <div className="flex items-center border-b px-3 bg-muted/30">
                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <Input placeholder="Filter materials..." className="h-9 border-none focus-visible:ring-0 text-sm bg-transparent" value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
                              </div>
                              <ScrollArea className="h-[200px]">
                                <div className="p-1">
                                  {masterInventory?.filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase())).map(item => (
                                    <Button key={item.id} type="button" variant="ghost" className="w-full justify-start h-auto py-2.5 px-3 mb-0.5 text-xs text-left" onClick={() => { 
                                      itemField.onChange(item.id); 
                                      form.setValue(`items.${index}.itemName`, item.name);
                                      form.setValue(`items.${index}.unit`, item.unit);
                                      setOpenItemIndex(null);
                                      setItemSearch("");
                                    }}>
                                      <div className="flex flex-col items-start overflow-hidden">
                                        <span className="font-bold truncate w-full">{item.name}</span>
                                        <span className="text-[8px] text-muted-foreground uppercase">{item.make} • {item.unit}</span>
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
                    </div>
                    <div className="md:col-span-3">
                      <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[9px] font-bold uppercase">Requested Qty</FormLabel>
                          <FormControl><Input type="number" step="0.01" {...field} className="h-10 rounded-sm bg-background" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="md:col-span-3">
                      <FormItem>
                        <FormLabel className="text-[9px] font-bold uppercase opacity-50">Unit</FormLabel>
                        <Input readOnly value={form.watch(`items.${index}.unit`) || "—"} className="h-10 bg-muted/10 cursor-not-allowed text-xs font-bold" />
                      </FormItem>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t gap-3">
            <Button variant="ghost" type="button" onClick={() => router.back()} className="h-12 px-8 font-bold rounded-sm">Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-[200px] h-12 rounded-sm font-black uppercase tracking-widest shadow-xl">
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : <><Save className="mr-2 h-4 w-4" /> Submit Requisition</>}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
