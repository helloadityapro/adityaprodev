
'use client';

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, serverTimestamp, orderBy } from "firebase/firestore";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Check, ChevronsUpDown, Loader2, ClipboardList, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const requirementSchema = z.object({
  siteName: z.string().min(1, "Site is required"),
  description: z.string().min(10, "Requirement details must be at least 10 characters"),
});

export default function RequirementsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const isAdmin = userProfile?.role === 'Admin' || ['abhijeet.agepl@gmail.com', 'abhijeetsb22@gmail.com', 'khalil@adityagreenenergy.com', 'prafulrana143@gmail.com'].includes(user?.email || '');
  const isManager = userProfile?.role === 'Site Manager';

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection(sitesQuery);

  const accessibleSites = React.useMemo(() => {
    if (!allSites || !userProfile) return [];
    if (isAdmin) return allSites;
    const assignedIds = userProfile.assignedProjectIds || [];
    return allSites.filter(s => assignedIds.includes(s.id));
  }, [allSites, userProfile, isAdmin]);

  const reqsQuery = useMemoFirebase(() => {
    if (!user) return null;
    const colRef = collection(firestore, 'requirements');
    if (isAdmin) return query(colRef, orderBy('createdAt', 'desc'));
    if (isManager) return query(colRef, where('siteManagerId', '==', user.uid), orderBy('createdAt', 'desc'));
    return query(colRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
  }, [firestore, user, isAdmin, isManager]);

  const { data: reqs, isLoading: reqsLoading } = useCollection(reqsQuery);

  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<z.infer<typeof requirementSchema>>({
    resolver: zodResolver(requirementSchema),
    defaultValues: { siteName: "", description: "" },
  });

  const onSubmit = async (values: z.infer<typeof requirementSchema>) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await addDocumentNonBlocking(collection(firestore, 'requirements'), {
        ...values,
        status: "Pending",
        userId: user.uid,
        userName: userProfile?.username || user.email,
        siteManagerId: userProfile?.siteManagerId || null,
        createdAt: serverTimestamp(),
      });
      toast({ title: "Submitted", description: "Requirement raised successfully." });
      form.reset({ siteName: "", description: "" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSites = accessibleSites.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase()));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
          <Package className="h-8 w-8" /> Site Requirements
        </h1>
        <p className="text-muted-foreground">Request materials or equipment needed for site operations.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <Card className="lg:col-span-1 shadow-md border-primary/10">
          <CardHeader>
            <CardTitle>New Requirement</CardTitle>
            <CardDescription>Raise a request for your assigned site.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="siteName" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Site Name</FormLabel>
                    <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal rounded-sm", !field.value && "text-muted-foreground")}>
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
                            onKeyDown={(e) => e.stopPropagation()}
                          />
                        </div>
                        <ScrollArea className="h-[200px]">
                          {filteredSites.length > 0 ? filteredSites.map((site) => (
                            <Button key={site.id} type="button" variant="ghost" className="w-full justify-start font-normal text-left" onClick={() => { field.onChange(site.name); setIsSitePopoverOpen(false); }}>
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

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Requirement Details</FormLabel>
                    <FormControl><Textarea placeholder="Specify items, quantities, and urgency..." rows={8} {...field} className="rounded-sm" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <Button type="submit" className="w-full h-11 rounded-sm" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Raising Request...</> : "Raise Request"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-md border-primary/10">
          <CardHeader>
            <CardTitle>Requirement Status</CardTitle>
            <CardDescription>Track the fulfillment of your site requests.</CardDescription>
          </CardHeader>
          <CardContent>
            {reqsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : reqs && reqs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Requirement</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reqs.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium whitespace-nowrap">{req.createdAt ? format(req.createdAt.toDate(), 'dd MMM') : '—'}</TableCell>
                      <TableCell className="font-semibold">{req.siteName}</TableCell>
                      <TableCell className="text-sm truncate max-w-[250px]">{req.description}</TableCell>
                      <TableCell>
                        <Badge variant={req.status === 'Fulfilled' ? 'default' : 'outline'} className="rounded-sm text-[10px] font-bold uppercase">
                          {req.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground italic bg-muted/20 rounded-lg border-2 border-dashed">
                No active requirements found.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
