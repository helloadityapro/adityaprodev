
"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp, increment, getDoc } from "firebase/firestore";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Check, ChevronsUpDown, Loader2, ArrowLeftRight, Calendar, Plus, Trash2, ListPlus, MapPin, Building2, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSuperAdmin } from "@/lib/auth-constants";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const itemSchema = z.object({
  itemName: z.string().min(1, "Item name is required"),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0"),
  unit: z.enum(["Numbers", "Kilograms", "Liters", "Meters", "Sets"], { required_error: "Unit is required" }),
});

const movementSchema = z.object({
  siteName: z.string().min(1, "Site is required"),
  movementType: z.enum(["Inward", "Outward"], { required_error: "Movement type is required" }),
  sourceOrDestinationType: z.enum(["Vendor", "Site"], { required_error: "Type is required" }),
  sourceOrDestination: z.string().min(1, "Name is required"),
  movementDate: z.string().min(1, "Date is required"),
  items: z.array(itemSchema).min(1, "Add at least one item"),
});

type Site = {
  id: string;
  name: string;
};

type RewardSettings = {
  movementEngineer?: number;
  movementManager?: number;
};

export default function RecordMovementPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const settingsRef = useMemoFirebase(() => doc(firestore, 'system_settings', 'rewards'), [firestore]);
  const { data: rewardSettings } = useDoc<RewardSettings>(settingsRef);

  const accessibleSites = React.useMemo(() => {
    if (!allSites || !userProfile) return [];
    if (isAdmin) {
        return Array.from(new Map(allSites.map(s => [s.name, s])).values());
    }
    const assignedIds = userProfile.assignedProjectIds || [];
    const filtered = allSites.filter(s => assignedIds.includes(s.id));
    return Array.from(new Map(filtered.map(s => [s.name, s])).values());
  }, [allSites, userProfile, isAdmin]);

  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  const [isTargetSitePopoverOpen, setIsTargetSitePopoverOpen] = React.useState(false);
  const [targetSiteSearchQuery, setTargetSiteSearchQuery] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<z.infer<typeof movementSchema>>({
    resolver: zodResolver(movementSchema),
    defaultValues: { 
      siteName: "", 
      movementType: "Inward",
      sourceOrDestinationType: "Vendor",
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

  const onSubmit = async (values: z.infer<typeof movementSchema>) => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);
    try {
      const promises = values.items.map(item => {
        return addDocumentNonBlocking(collection(firestore, 'material_movements'), {
          siteName: values.siteName,
          movementType: values.movementType,
          sourceOrDestinationType: values.sourceOrDestinationType,
          sourceOrDestination: values.sourceOrDestination,
          movementDate: values.movementDate,
          ...item,
          userId: user.uid,
          userName: userProfile?.username || user.email,
          siteManagerId: userProfile?.siteManagerId || null,
          createdAt: serverTimestamp(),
        });
      });

      await Promise.all(promises);

      // Reward Points Logic for Movement
      const rateEngineer = rewardSettings?.movementEngineer ?? 0.1;
      const rateManager = rewardSettings?.movementManager ?? 0.05;

      const multiplier = userProfile.pointsMultiplier || 1;
      const engineerPoints = rateEngineer * values.items.length * multiplier;
      
      updateDocumentNonBlocking(doc(firestore, 'users', user.uid), {
        totalPoints: increment(engineerPoints)
      });

      if (userProfile.siteManagerId) {
        updateDocumentNonBlocking(doc(firestore, 'users', userProfile.siteManagerId), {
            totalPoints: increment(rateManager * values.items.length)
        });
      }
      
      toast({ title: "Success", description: `${values.items.length} movement logs recorded. Points updated.` });
      form.reset({ 
        siteName: "", 
        movementType: values.movementType,
        sourceOrDestinationType: "Vendor",
        sourceOrDestination: "",
        movementDate: format(new Date(), 'yyyy-MM-dd'),
        items: [{ itemName: "", quantity: 0, unit: "Numbers" }] 
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSites = accessibleSites.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase()));
  const allSitesList = allSites ? Array.from(new Map(allSites.map(s => [s.name, s])).values()) : [];
  const filteredAllSites = allSitesList.filter(s => s.name.toLowerCase().includes(targetSiteSearchQuery.toLowerCase()));

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
          <ArrowLeftRight className="h-8 w-8" /> Record Movement
        </h1>
        <p className="text-muted-foreground">Log inward or outward material movement at site.</p>
      </div>

      <Card className="shadow-md border-primary/10 rounded-sm">
        <CardHeader>
          <CardTitle>Material Movement Form</CardTitle>
          <CardDescription>Select site and record the movement details.</CardDescription>
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
                            <FormControl><RadioGroupItem value="Vendor" /></FormControl>
                            <FormLabel className="font-normal cursor-pointer flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Vendor</FormLabel>
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
                          <div className="relative">
                            <Input placeholder="Enter vendor name..." {...field} className="rounded-sm pr-10" />
                            <Truck className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                          </div>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
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
