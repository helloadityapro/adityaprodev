
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking, useCollection } from '@/firebase';
import { collection, doc, serverTimestamp, query, where } from 'firebase/firestore';
import { Fuel, Loader2, Send, CheckCircle2, Building2, Globe, Search, ChevronsUpDown, Check, ArrowRight, Users, UserPlus, X, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { isSuperAdmin } from '@/lib/auth-constants';
import { Badge } from '@/components/ui/badge';

const requestSchema = z.object({
  pickupType: z.enum(['Site', 'Other'], { required_error: 'Please select a pickup type.' }),
  pickupLocation: z.string().min(1, 'Pickup location is required.'),
  destinationType: z.enum(['Site', 'Other'], { required_error: 'Please select a destination type.' }),
  destination: z.string().min(1, 'Destination is required.'),
  purpose: z.string().min(5, 'Purpose must be detailed (min 5 chars).'),
  coPassengers: z.array(z.object({
    id: z.string(),
    name: z.string()
  })).default([]),
});

type Site = {
  id: string;
  name: string;
};

type UserProfile = {
  id: string;
  username: string;
  email: string;
  role: string;
  siteManagerId?: string;
  assignedProjectIds?: string[];
};

export default function RequestVehiclePage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  // Fetch Sites
  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  // Fetch Users for Co-passengers
  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers } = useCollection<UserProfile>(usersQuery);

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

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  
  const [isPickupPopoverOpen, setIsPickupPopoverOpen] = React.useState(false);
  const [pickupSearchQuery, setPickupSearchQuery] = React.useState("");
  
  const [isDestPopoverOpen, setIsDestPopoverOpen] = React.useState(false);
  const [destSearchQuery, setDestSearchQuery] = React.useState("");

  const [isPassengerPopoverOpen, setIsPassengerPopoverOpen] = React.useState(false);
  const [passengerSearchQuery, setPassengerSearchQuery] = React.useState("");

  const form = useForm<z.infer<typeof requestSchema>>({
    resolver: zodResolver(requestSchema),
    defaultValues: { 
      pickupType: 'Site',
      pickupLocation: '',
      destinationType: 'Site',
      destination: '',
      purpose: '',
      coPassengers: []
    },
  });

  const pickupType = form.watch('pickupType');
  const destinationType = form.watch('destinationType');
  const coPassengers = form.watch('coPassengers');

  const onSubmit = async (values: z.infer<typeof requestSchema>) => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);
    try {
      await addDocumentNonBlocking(collection(firestore, 'vehicle_assignments'), {
        userId: user.uid,
        userName: userProfile.username || user.email,
        pickupLocation: values.pickupLocation,
        pickupType: values.pickupType,
        destination: values.destination,
        destinationType: values.destinationType,
        purpose: values.purpose,
        coPassengers: values.coPassengers,
        status: 'Pending',
        requestDate: serverTimestamp(),
      });
      setIsSuccess(true);
      toast({ title: 'Request Sent', description: 'Administrative approval required.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addPassenger = (u: UserProfile) => {
    if (u.id === user?.uid) {
      toast({ variant: 'destructive', title: 'Action Denied', description: 'You are the requester by default.' });
      return;
    }
    if (coPassengers.some(p => p.id === u.id)) {
      toast({ variant: 'destructive', title: 'Duplicate', description: 'Personnel already added.' });
      return;
    }
    form.setValue('coPassengers', [...coPassengers, { id: u.id, name: u.username || u.email }]);
    setIsPassengerPopoverOpen(false);
    setPassengerSearchQuery("");
  };

  const removePassenger = (id: string) => {
    form.setValue('coPassengers', coPassengers.filter(p => p.id !== id));
  };

  const filteredPickupSites = accessibleSites.filter(s => 
    s.name.toLowerCase().includes(pickupSearchQuery.toLowerCase())
  );

  const filteredDestSites = accessibleSites.filter(s => 
    s.name.toLowerCase().includes(destSearchQuery.toLowerCase())
  );

  const filteredPotentialPassengers = allUsers?.filter(u => 
    (u.username || '').toLowerCase().includes(passengerSearchQuery.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(passengerSearchQuery.toLowerCase())
  ) || [];

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full animate-in fade-in zoom-in-95 duration-300">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-primary/10 p-4 rounded-full">
                <CheckCircle2 className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Request Logged</CardTitle>
            <CardDescription className="text-base">
              Your vehicle allotment request has been submitted for Admin approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full rounded-sm font-bold h-11" onClick={() => router.push('/vehicles/assigned')}>
              Track Request Status
            </Button>
            <Button variant="ghost" className="w-full rounded-sm" onClick={() => {
              setIsSuccess(false);
              form.reset();
            }}>
              Request Another Trip
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2">
          <Fuel className="h-8 w-8" /> Request Vehicle Allotment
        </h1>
        <p className="text-muted-foreground font-medium">Specify route and trip details for administrative review.</p>
      </div>

      <Card className="rounded-sm shadow-md border-primary/10">
        <CardHeader>
          <CardTitle>Trip Information</CardTitle>
          <CardDescription>A vehicle and driver will be assigned upon approval.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
              {/* Pickup Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary border border-primary/20">1</div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Pickup Location</h3>
                </div>
                
                <FormField
                  control={form.control}
                  name="pickupType"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormControl>
                        <RadioGroup
                          onValueChange={(val) => {
                            field.onChange(val);
                            form.setValue('pickupLocation', '');
                          }}
                          defaultValue={field.value}
                          className="flex gap-6"
                        >
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl><RadioGroupItem value="Site" /></FormControl>
                            <FormLabel className="font-bold cursor-pointer flex items-center gap-1.5 text-xs">
                              <Building2 className="h-3.5 w-3.5 text-primary" /> Project Site
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl><RadioGroupItem value="Other" /></FormControl>
                            <FormLabel className="font-bold cursor-pointer flex items-center gap-1.5 text-xs">
                              <Globe className="h-3.5 w-3.5 text-primary" /> Other
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pickupLocation"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      {pickupType === 'Site' ? (
                        <Popover open={isPickupPopoverOpen} onOpenChange={setIsPickupPopoverOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between font-normal rounded-sm h-11",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value || "Select pickup site..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <div className="flex items-center border-b px-3">
                              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                              <Input
                                placeholder="Search sites..."
                                className="h-10 w-full border-none focus-visible:ring-0 px-0 text-sm"
                                value={pickupSearchQuery}
                                onChange={(e) => setPickupSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.stopPropagation()}
                              />
                            </div>
                            <ScrollArea className="h-[200px]">
                              <div className="p-1">
                                {filteredPickupSites.length > 0 ? (
                                  filteredPickupSites.map((site) => (
                                    <Button
                                      key={site.id}
                                      type="button"
                                      variant="ghost"
                                      className="w-full justify-start font-normal h-10 text-sm"
                                      onClick={() => {
                                        field.onChange(site.name);
                                        setIsPickupPopoverOpen(false);
                                        setPickupSearchQuery("");
                                      }}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4 text-primary", site.name === field.value ? "opacity-100" : "opacity-0")} />
                                      {site.name}
                                    </Button>
                                  ))
                                ) : (
                                  <p className="p-4 text-center text-xs text-muted-foreground italic">No matching sites found.</p>
                                )}
                              </div>
                            </ScrollArea>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <FormControl>
                          <Input placeholder="Enter pickup address/landmark..." {...field} className="h-11 rounded-sm" />
                        </FormControl>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Destination Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary border border-primary/20">2</div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Destination To</h3>
                </div>

                <FormField
                  control={form.control}
                  name="destinationType"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormControl>
                        <RadioGroup
                          onValueChange={(val) => {
                            field.onChange(val);
                            form.setValue('destination', '');
                          }}
                          defaultValue={field.value}
                          className="flex gap-6"
                        >
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl><RadioGroupItem value="Site" /></FormControl>
                            <FormLabel className="font-bold cursor-pointer flex items-center gap-1.5 text-xs">
                              <Building2 className="h-3.5 w-3.5 text-primary" /> Project Site
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl><RadioGroupItem value="Other" /></FormControl>
                            <FormLabel className="font-bold cursor-pointer flex items-center gap-1.5 text-xs">
                              <Globe className="h-3.5 w-3.5 text-primary" /> Other
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="destination"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      {destinationType === 'Site' ? (
                        <Popover open={isDestPopoverOpen} onOpenChange={setIsDestPopoverOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between font-normal rounded-sm h-11",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value || "Select destination site..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <div className="flex items-center border-b px-3">
                              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                              <Input
                                placeholder="Search sites..."
                                className="h-10 w-full border-none focus-visible:ring-0 px-0 text-sm"
                                value={destSearchQuery}
                                onChange={(e) => setDestSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.stopPropagation()}
                              />
                            </div>
                            <ScrollArea className="h-[200px]">
                              <div className="p-1">
                                {filteredDestSites.length > 0 ? (
                                  filteredDestSites.map((site) => (
                                    <Button
                                      key={site.id}
                                      type="button"
                                      variant="ghost"
                                      className="w-full justify-start font-normal h-10 text-sm"
                                      onClick={() => {
                                        field.onChange(site.name);
                                        setIsDestPopoverOpen(false);
                                        setDestSearchQuery("");
                                      }}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4 text-primary", site.name === field.value ? "opacity-100" : "opacity-0")} />
                                      {site.name}
                                    </Button>
                                  ))
                                ) : (
                                  <p className="p-4 text-center text-xs text-muted-foreground italic">No matching sites found.</p>
                                )}
                              </div>
                            </ScrollArea>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <FormControl>
                          <Input placeholder="Enter destination address..." {...field} className="h-11 rounded-sm" />
                        </FormControl>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Co-passengers Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary border border-primary/20">3</div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Co-passengers</h3>
                  </div>
                  <Popover open={isPassengerPopoverOpen} onOpenChange={setIsPassengerPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 rounded-sm font-bold border-primary text-primary hover:bg-primary/5">
                        <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Add Person
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="end">
                      <div className="flex items-center border-b px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Input
                          placeholder="Search personnel..."
                          className="h-10 w-full border-none focus-visible:ring-0 px-0 text-xs"
                          value={passengerSearchQuery}
                          onChange={(e) => setPassengerSearchQuery(e.target.value)}
                        />
                      </div>
                      <ScrollArea className="h-[200px]">
                        <div className="p-1">
                          {filteredPotentialPassengers.length > 0 ? (
                            filteredPotentialPassengers.map((u) => (
                              <Button
                                key={u.id}
                                variant="ghost"
                                className="w-full justify-start font-normal h-10 text-xs"
                                onClick={() => addPassenger(u)}
                              >
                                <div className="flex flex-col items-start overflow-hidden">
                                  <span className="truncate font-bold">{u.username}</span>
                                  <span className="text-[9px] text-muted-foreground uppercase">{u.role}</span>
                                </div>
                              </Button>
                            ))
                          ) : (
                            <p className="p-4 text-center text-xs text-muted-foreground italic">No results found.</p>
                          )}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="min-h-[60px] p-4 border border-dashed rounded-sm bg-muted/10 flex flex-wrap gap-2 items-center">
                  {coPassengers.length > 0 ? (
                    coPassengers.map(p => (
                      <Badge key={p.id} variant="secondary" className="pl-3 pr-1 py-1 h-8 rounded-sm gap-2 flex items-center font-bold text-xs">
                        <Users className="h-3 w-3 text-primary opacity-60" />
                        {p.name}
                        <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive" onClick={() => removePassenger(p.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))
                  ) : (
                    <p className="text-[10px] uppercase font-black text-muted-foreground/40 tracking-widest text-center w-full">No co-passengers added</p>
                  )}
                </div>
              </div>

              {/* Purpose Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary border border-primary/20">4</div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Purpose</h3>
                </div>
                <FormField control={form.control} name="purpose" render={({ field }) => (
                  <FormItem>
                    <FormControl><Textarea rows={4} placeholder="Reason for requiring organizational transport..." {...field} className="rounded-sm" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="pt-4 border-t flex justify-end">
                <Button type="submit" disabled={isSubmitting} className="rounded-sm font-black h-12 px-10 shadow-lg">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  SEND FOR APPROVAL
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
