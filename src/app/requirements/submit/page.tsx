
"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp, query, where, getDocs, and } from "firebase/firestore";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Check, ChevronsUpDown, Loader2, PackagePlus, Calendar, Plus, Trash2, ListPlus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSuperAdmin } from "@/lib/auth-constants";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { sendNotification } from "@/lib/notifications";

const COMMON_MATERIALS = [
  "Solar Module", "Solar Panel", "Inverter", "Wiring Harness", "DC Cable", "AC Cable", "MC4 Connector",
  "Column Post", "Rafter", "Purlin", "Back Bracing", "Bracing Connector", "Front Bracing", "Sag Rod", "Mid Clamp", "End Clamp",
  "Earthing Strip", "Chemical Earthing", "Lightening Arrestor", "Labelling Stickers", "ACDB",
  "Nylon Cable Tie", "PVC Conduit", "UPVC Pipe", "Module Mounting Structure",
  "Lugs", "Ferrules", "Glands", "Isolator", "Fuse", "Breaker", "LT Panel", "VCB", "RMU", "Balance of System (BoS)"
];

const itemSchema = z.object({
  itemName: z.string().min(1, "Item name is required"),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0"),
  unit: z.enum(["Numbers", "Kilograms", "Liters", "Meters", "Sets"], { required_error: "Unit is required" }),
  urgency: z.enum(["High", "Medium", "Low"], { required_error: "Urgency is required" }),
  expectedDate: z.string().min(1, "Expected date is required"),
});

const requirementSchema = z.object({
  siteName: z.string().min(1, "Site is required"),
  items: z.array(itemSchema).min(1, "Add at least one item"),
});

type Site = {
  id: string;
  name: string;
};

type UserProfile = {
  id: string;
  username: string;
  role: string;
  siteManagerId?: string;
  assignedProjectIds?: string[];
};

export default function SubmitRequirementPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

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
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<z.infer<typeof requirementSchema>>({
    resolver: zodResolver(requirementSchema),
    defaultValues: { 
      siteName: "", 
      items: [{ itemName: "", quantity: 0, unit: "Numbers", urgency: "Medium", expectedDate: format(new Date(), 'yyyy-MM-dd') }]
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  const onSubmit = async (values: z.infer<typeof requirementSchema>) => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);
    try {
      const isEngineer = userProfile.role === 'Site Engineer';
      const targetStatus = isEngineer ? "Pending" : (userProfile.role === 'Site Manager' ? "ManagerApproved" : "Approved");
      const siteId = accessibleSites.find(s => s.name === values.siteName)?.id;

      // Site-Specific Manager Lookup (Override Logic)
      const overridesQuery = query(collection(firestore, 'team_mapping_overrides'), and(where('engineerId', '==', user.uid), where('siteId', '==', siteId || '')));
      const overridesSnap = await getDocs(overridesQuery);
      const effectiveSiteManagerId = !overridesSnap.empty ? overridesSnap.docs[0].data().managerId : (userProfile.siteManagerId || null);

      const timelineEntry = {
        action: "Created",
        status: targetStatus,
        remarks: "Requirement submitted for approval.",
        userName: userProfile.username || user.email,
        userId: user.uid,
        timestamp: new Date().toISOString()
      };

      const promises = values.items.map(item => {
        return addDocumentNonBlocking(collection(firestore, 'requirements'), {
          siteId: siteId || null,
          siteName: values.siteName,
          ...item,
          status: targetStatus,
          statusUpdatedBy: userProfile?.username || user.email || "System",
          statusUpdatedAt: serverTimestamp(),
          userId: user.uid,
          userName: userProfile?.username || user.email,
          siteManagerId: effectiveSiteManagerId,
          createdAt: serverTimestamp(),
          timeline: [timelineEntry]
        });
      });

      await Promise.all(promises);

      if (isEngineer && effectiveSiteManagerId) {
        sendNotification(firestore, {
          userId: effectiveSiteManagerId,
          title: "New Site Requirement",
          description: `${userProfile.username} has submitted ${values.items.length} new site requirements for "${values.siteName}".`,
          link: "/requirements/list",
          push: true
        });
      }

      const adminsQuery = query(collection(firestore, 'users'), where('role', '==', 'Admin'));
      const adminDocs = await getDocs(adminsQuery);
      adminDocs.forEach(adminDoc => {
        if (adminDoc.id === user.uid) return;
        sendNotification(firestore, {
          userId: adminDoc.id,
          title: "Site Requirement Logged",
          description: `New requirement (${values.items[0].itemName}...) raised for "${values.siteName}" by ${userProfile.username}.`,
          link: "/requirements/list",
          push: true
        });
      });
      
      toast({ title: "Success", description: `${values.items.length} items submitted and are now ${targetStatus}.` });
      form.reset({ 
        siteName: "", 
        items: [{ itemName: "", quantity: 0, unit: "Numbers", urgency: "Medium", expectedDate: format(new Date(), 'yyyy-MM-dd') }] 
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSpellingSuggestion = (val: string) => {
    if (!val || val.length < 3) return null;
    const lowerVal = val.toLowerCase();
    return COMMON_MATERIALS.find(m => {
      const lowerM = m.toLowerCase();
      return (lowerM.includes(lowerVal) || lowerVal.includes(lowerM)) && lowerM !== lowerVal;
    });
  };

  const filteredSites = accessibleSites.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase()));

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
          <PackagePlus className="h-8 w-8" /> Submit Requirement
        </h1>
        <p className="text-muted-foreground font-medium">Request materials or resources for your site. You can add multiple items.</p>
      </div>

      <Card className="shadow-md border-primary/10 rounded-sm">
        <CardHeader>
          <CardTitle>Material Request Form</CardTitle>
          <CardDescription>Select a site and list all required items below. Requests follow a PtW-style approval flow.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField control={form.control} name="siteName" render={({ field }) => (
                <FormItem className="flex flex-col max-w-md">
                  <FormLabel>Site Name</FormLabel>
                  <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button 
                          variant="outline" 
                          role="combobox" 
                          className={cn("w-full justify-between font-normal rounded-sm h-11", !field.value && "text-muted-foreground")}
                        >
                          {field.value || "Select a site..."}
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

              <Separator />

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
                        <ListPlus className="h-5 w-5 text-primary" /> Item List
                    </h3>
                    <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => append({ itemName: "", quantity: 0, unit: "Numbers", urgency: "Medium", expectedDate: format(new Date(), 'yyyy-MM-dd') })}
                        className="rounded-sm border-primary text-primary hover:bg-primary/5 font-bold"
                    >
                        <Plus className="mr-1.5 h-4 w-4" /> Add Item
                    </Button>
                </div>

                {fields.map((field, index) => {
                  const currentName = form.watch(`items.${index}.itemName`);
                  const suggestion = getSpellingSuggestion(currentName);
                  
                  return (
                    <Card key={field.id} className="relative bg-muted/10 border-dashed rounded-sm overflow-hidden animate-in fade-in">
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
                              <Badge variant="outline" className="rounded-sm font-mono text-[10px] font-black uppercase">Item #{index + 1}</Badge>
                          </div>
                          
                          <FormField control={form.control} name={`items.${index}.itemName`} render={({ field: nameField }) => (
                              <FormItem>
                                  <FormLabel className="text-[10px] font-bold uppercase">Item Name / Description</FormLabel>
                                  <div className="space-y-2">
                                    <FormControl>
                                        <Input 
                                            placeholder="e.g. Solar Module 540Wp..." 
                                            {...nameField} 
                                            className="rounded-sm bg-background h-11" 
                                        />
                                    </FormControl>
                                    {suggestion && (
                                      <div className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-300">
                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 py-1.5 px-3 rounded-sm flex items-center gap-2">
                                          <Sparkles className="h-3 w-3" />
                                          <span className="text-[10px] font-bold uppercase tracking-tight">Did you mean:</span>
                                          <Button 
                                            variant="link" 
                                            type="button"
                                            className="p-0 h-auto text-[11px] font-black underline decoration-dashed underline-offset-4"
                                            onClick={() => form.setValue(`items.${index}.itemName`, suggestion)}
                                          >
                                            {suggestion}
                                          </Button>
                                        </Badge>
                                      </div>
                                    )}
                                  </div>
                                  <FormMessage />
                              </FormItem>
                          )} />

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                                  <FormItem>
                                      <FormLabel className="text-[10px] font-bold uppercase">Qty</FormLabel>
                                      <FormControl>
                                          <Input type="number" step="0.01" placeholder="0.00" {...field} className="rounded-sm bg-background font-mono font-bold" />
                                      </FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )} />

                              <FormField control={form.control} name={`items.${index}.unit`} render={({ field }) => (
                                  <FormItem>
                                      <FormLabel className="text-[10px] font-bold uppercase">Unit</FormLabel>
                                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                                          <FormControl>
                                              <SelectTrigger className="rounded-sm bg-background h-11">
                                                  <SelectValue />
                                              </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                              {["Numbers", "Kilograms", "Liters", "Meters", "Sets"].map(u => (
                                                  <SelectItem key={u} value={u} className="text-sm font-medium">{u}</SelectItem>
                                              ))}
                                          </SelectContent>
                                      </Select>
                                      <FormMessage />
                                  </FormItem>
                              )} />

                              <FormField control={form.control} name={`items.${index}.urgency`} render={({ field }) => (
                                  <FormItem>
                                      <FormLabel className="text-[10px] font-bold uppercase">Urgency</FormLabel>
                                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                                          <FormControl>
                                              <SelectTrigger className="rounded-sm bg-background h-11">
                                                  <SelectValue />
                                              </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                              {["High", "Medium", "Low"].map(u => (
                                                  <SelectItem key={u} value={u} className="text-sm font-medium">{u}</SelectItem>
                                              ))}
                                          </SelectContent>
                                      </Select>
                                      <FormMessage />
                                  </FormItem>
                              )} />

                              <FormField control={form.control} name={`items.${index}.expectedDate`} render={({ field }) => (
                                  <FormItem>
                                      <FormLabel className="text-[10px] font-bold uppercase">Target Date</FormLabel>
                                      <FormControl>
                                          <div className="relative">
                                              <Input type="date" {...field} className="rounded-sm pr-10 bg-background h-11" />
                                              <Calendar className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                                          </div>
                                      </FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )} />
                          </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="flex justify-end gap-4 pt-6 border-t">
                <Button type="submit" className="min-w-[220px] h-14 rounded-sm text-base font-black uppercase tracking-tight shadow-xl" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> DISPATCHING...</> : "Submit Requirements"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
