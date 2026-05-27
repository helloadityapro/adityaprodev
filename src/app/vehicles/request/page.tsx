'use client';

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { 
  useFirestore, 
  useUser, 
  useDoc, 
  useMemoFirebase, 
  addDocumentNonBlocking, 
  useCollection 
} from '@/firebase';
import { collection, doc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { 
  Fuel, 
  Loader2, 
  Send, 
  CheckCircle2, 
  Building2, 
  Globe, 
  Search, 
  ChevronsUpDown, 
  Check, 
  ArrowRight, 
  Users, 
  UserPlus, 
  X, 
  Trash2, 
  Plus, 
  MapPinned, 
  MessageCircle, 
  History, 
  UserCheck,
  RefreshCcw,
  Calendar,
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { isSuperAdmin } from '@/lib/auth-constants';
import { Badge } from '@/components/ui/badge';
import { format, parse } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sendNotification } from '@/lib/notifications';

const stopSchema = z.object({
  type: z.enum(['Site', 'Other'], { required_error: 'Please select a stop type.' }),
  location: z.string().min(1, 'Stop location is required.'),
  purpose: z.string().min(1, 'Purpose for this stop is required.'),
});

const requestSchema = z.object({
  pickupType: z.enum(['Site', 'Other'], { required_error: 'Please select a pickup type.' }),
  pickupLocation: z.string().min(1, 'Pickup location is required.'),
  tripDate: z.string().min(1, 'Trip date is required.'),
  reportingTime: z.string().min(1, 'Reporting time is required.'),
  intermediateStops: z.array(stopSchema).default([]),
  dropType: z.enum(['Site', 'Other'], { required_error: 'Please select a drop-off type.' }),
  dropLocation: z.string().min(1, 'Drop-off location is required.'),
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

const formatTo12Hr = (time?: string) => {
  if (!time) return '';
  if (time.toLowerCase().includes('am') || time.toLowerCase().includes('pm')) return time;
  try {
    const date = parse(time, 'HH:mm', new Date());
    return format(date, 'hh:mm a');
  } catch (e) {
    return time;
  }
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

  const accessibleSites = React.useMemo(() => {
    if (!allSites) return [];
    return Array.from(new Map(allSites.map(s => [s.name, s])).values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allSites]);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [submittedData, setSubmittedData] = React.useState<any>(null);
  
  const [isPickupPopoverOpen, setIsPickupPopoverOpen] = React.useState(false);
  const [pickupSearchQuery, setPickupSearchQuery] = React.useState("");
  
  const [openStopPopoverIndex, setOpenStopPopoverIndex] = React.useState<number | null>(null);
  const [stopSearchQuery, setStopSearchQuery] = React.useState("");

  const [isDropPopoverOpen, setIsDropPopoverOpen] = React.useState(false);
  const [dropSearchQuery, setDropSearchQuery] = React.useState("");

  const [isPassengerPopoverOpen, setIsPassengerPopoverOpen] = React.useState(false);
  const [passengerSearchQuery, setPassengerSearchQuery] = React.useState("");

  const form = useForm<z.infer<typeof requestSchema>>({
    resolver: zodResolver(requestSchema),
    defaultValues: { 
      pickupType: 'Site',
      pickupLocation: '',
      tripDate: format(new Date(), 'yyyy-MM-dd'),
      reportingTime: '09:00 AM',
      intermediateStops: [],
      dropType: 'Site',
      dropLocation: '',
      purpose: '',
      coPassengers: []
    },
  });

  const { fields: stopFields, append: appendStop, remove: removeStop } = useFieldArray({
    control: form.control,
    name: "intermediateStops"
  });

  const pickupType = form.watch('pickupType');
  const pickupLocation = form.watch('pickupLocation');
  const dropType = form.watch('dropType');
  const coPassengers = form.watch('coPassengers');

  const makeRoundTrip = () => {
    form.setValue('dropType', pickupType);
    form.setValue('dropLocation', pickupLocation);
    toast({ title: 'Return Trip Set', description: 'Final drop-off point matched to pickup location.' });
  };

  const onSubmit = async (values: z.infer<typeof requestSchema>) => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);
    try {
      const combinedDestinations = [
        ...values.intermediateStops,
        { type: values.dropType, location: values.dropLocation, purpose: 'Final Destination' }
      ];

      const assignmentRef = await addDocumentNonBlocking(collection(firestore, 'vehicle_assignments'), {
        userId: user.uid,
        userName: userProfile.username || user.email,
        siteManagerId: userProfile.siteManagerId || null,
        pickupLocation: values.pickupLocation,
        pickupType: values.pickupType,
        tripDate: values.tripDate,
        reportingTime: values.reportingTime,
        intermediateStops: values.intermediateStops,
        dropLocation: values.dropLocation,
        dropType: values.dropType,
        destinations: combinedDestinations,
        purpose: values.purpose,
        coPassengers: values.coPassengers,
        status: 'Pending',
        requestDate: serverTimestamp(),
      });

      // Notify Manager
      if (userProfile.siteManagerId) {
        sendNotification(firestore, {
          userId: userProfile.siteManagerId,
          title: "New Vehicle Request",
          description: `${userProfile.username} requested a vehicle for ${values.tripDate}.`,
          link: "/vehicles/trips/manage",
          push: true
        });
      }

      // Notify All Admins
      const adminsQuery = query(collection(firestore, 'users'), where('role', '==', 'Admin'));
      const adminDocs = await getDocs(adminsQuery);
      adminDocs.forEach(adminDoc => {
        if (adminDoc.id === user.uid || adminDoc.id === userProfile.siteManagerId) return;
        sendNotification(firestore, {
          userId: adminDoc.id,
          title: "Vehicle Request Logged",
          description: `Trip Date: ${values.tripDate} • By: ${userProfile.username}`,
          link: "/vehicles/trips/manage",
        });
      });

      setSubmittedData({ ...values, destinations: combinedDestinations });
      setIsSuccess(true);
      toast({ title: 'Request Sent', description: 'Administrative approval required.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerWhatsApp = () => {
    if (!submittedData) return;
    const formattedTime = formatTo12Hr(submittedData.reportingTime);
    const stopsText = submittedData.intermediateStops.length > 0 
      ? `\n*Intermediate Stops:*\n${submittedData.intermediateStops.map((d: any, i: number) => `${i + 1}. ${d.location} (${d.purpose})`).join('\n')}`
      : '';
    const passengerList = submittedData.coPassengers.length > 0 
      ? `\n*Co-passengers:* ${submittedData.coPassengers.map((p: any) => p.name).join(', ')}`
      : '';
    const message = `*Aditya Pro - Vehicle Allotment Request*\n\n*Requester:* ${userProfile?.username || user?.email}\n*Trip Date:* ${format(new Date(submittedData.tripDate), 'dd MMM yyyy')}\n*Pickup:* ${submittedData.pickupLocation}\n*Reporting Time:* ${formattedTime}${stopsText}\n*Final Drop:* ${submittedData.dropLocation}${passengerList}\n\n*General Purpose:* ${submittedData.purpose}\n\n_Note: Request is pending approval in the system._`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
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

  const addExternalPassenger = () => {
    const name = passengerSearchQuery.trim();
    if (!name) return;
    const newId = `ext_${Date.now()}`;
    form.setValue('coPassengers', [...coPassengers, { id: newId, name: `${name} (Ext)` }]);
    setIsPassengerPopoverOpen(false);
    setPassengerSearchQuery("");
  };

  const removePassenger = (id: string) => {
    form.setValue('coPassengers', coPassengers.filter(p => p.id !== id));
  };

  const filteredPickupSites = accessibleSites.filter(s => s.name.toLowerCase().includes(pickupSearchQuery.toLowerCase()));
  const filteredStopSites = accessibleSites.filter(s => s.name.toLowerCase().includes(stopSearchQuery.toLowerCase()));
  const filteredDropSites = accessibleSites.filter(s => s.name.toLowerCase().includes(dropSearchQuery.toLowerCase()));
  const filteredPotentialPassengers = allUsers?.filter(u => (u.username || '').toLowerCase().includes(passengerSearchQuery.toLowerCase()) || (u.email || '').toLowerCase().includes(passengerSearchQuery.toLowerCase())) || [];

  if (isSuccess && submittedData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="max-w-md w-full animate-in fade-in zoom-in-95 duration-300">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><div className="bg-primary/10 p-4 rounded-full"><CheckCircle2 className="h-12 w-12 text-primary" /></div></div>
            <CardTitle className="text-xl sm:text-2xl font-bold">Request Submitted</CardTitle>
            <CardDescription className="text-sm sm:text-base leading-relaxed">
              Your trip request for <strong>{format(new Date(submittedData.tripDate), 'dd MMM yyyy')}</strong> has been logged and is awaiting allotment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg font-semibold rounded-sm shadow-md" onClick={triggerWhatsApp}>
              <MessageCircle className="mr-2 h-5 w-5" /> Share on WhatsApp
            </Button>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button variant="outline" className="h-11 rounded-sm" onClick={() => router.push('/vehicles/trips/manage')}>Trip History</Button>
              <Button variant="secondary" className="h-11 rounded-sm" onClick={() => { setIsSuccess(false); setSubmittedData(null); form.reset(); }}>Request New</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-24 px-2 sm:px-4">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl sm:text-2xl">
          <Fuel className="h-6 w-6 sm:h-8 w-8 text-primary" /> Request Allotment
        </h1>
        <p className="text-muted-foreground text-xs sm:text-sm font-medium">Specify route and trip details for administrative review.</p>
      </div>

      <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
        <CardContent className="pt-6 px-4 sm:px-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Step 1: Schedule */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary border border-primary/20 shrink-0">1</div>
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-foreground">Trip Schedule</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tripDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-wider">Trip Date</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input type="date" {...field} className="h-11 rounded-sm pr-10" />
                            <Calendar className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reportingTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-wider">Reporting Time</FormLabel>
                        <FormControl>
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <Input 
                              className="h-11 rounded-sm w-full text-center font-bold" 
                              placeholder="HH"
                              maxLength={2}
                              value={field.value?.split(':')[0] || "09"}
                              onChange={(e) => {
                                const h = e.target.value.replace(/\D/g, '').slice(0, 2);
                                field.onChange(`${h}:${field.value?.split(':')[1]?.split(' ')[0] || "00"} ${field.value?.split(' ')[1] || "AM"}`);
                              }}
                            />
                            <span className="font-bold">:</span>
                            <Input 
                              className="h-11 rounded-sm w-full text-center font-bold" 
                              placeholder="MM"
                              maxLength={2}
                              value={field.value?.split(':')[1]?.split(' ')[0] || "00"}
                              onChange={(e) => {
                                const m = e.target.value.replace(/\D/g, '').slice(0, 2);
                                field.onChange(`${field.value?.split(':')[0] || "09"}:${m} ${field.value?.split(' ')[1] || "AM"}`);
                              }}
                            />
                            <Select 
                              value={field.value?.split(' ')[1] || "AM"} 
                              onValueChange={(p) => field.onChange(`${field.value?.split(':')[0] || "09"}:${field.value?.split(':')[1]?.split(' ')[0] || "00"} ${p}`)}
                            >
                              <SelectTrigger className="h-11 rounded-sm w-full min-w-[70px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AM">AM</SelectItem>
                                <SelectItem value="PM">PM</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Step 2: Pickup */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary border border-primary/20 shrink-0">2</div>
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-foreground">Pickup Point</h3>
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
                          className="flex gap-4 sm:gap-6"
                        >
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl><RadioGroupItem value="Site" /></FormControl>
                            <FormLabel className="font-bold cursor-pointer flex items-center gap-1.5 text-[11px] sm:text-xs">
                              <Building2 className="h-3.5 w-3.5 text-primary" /> Project Site
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl><RadioGroupItem value="Other" /></FormControl>
                            <FormLabel className="font-bold cursor-pointer flex items-center gap-1.5 text-[11px] sm:text-xs">
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
                      <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pickup Address / Site Name</FormLabel>
                      {pickupType === 'Site' ? (
                        <Popover open={isPickupPopoverOpen} onOpenChange={setIsPickupPopoverOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between font-normal rounded-sm h-11 text-left",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <span className="truncate">{field.value || "Select pickup site..."}</span>
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
                                      className="w-full justify-start font-normal h-10 text-xs"
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

              {/* Step 3: Intermediate Stops */}
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary border border-primary/20 shrink-0">3</div>
                    <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-foreground">Intermediate Stops</h3>
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => appendStop({ type: 'Site', location: '', purpose: '' })}
                    className="h-8 rounded-sm font-bold border-primary text-primary hover:bg-primary/5 px-3"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                  </Button>
                </div>

                <div className="space-y-4">
                  {stopFields.map((field, index) => (
                    <div key={field.id} className="p-4 border rounded-sm bg-muted/5 space-y-4 relative group animate-in slide-in-from-top-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[9px] font-bold uppercase rounded-sm border-primary/20 text-primary">Stop #{index + 1}</Badge>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-destructive rounded-sm"
                          onClick={() => removeStop(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <FormField
                        control={form.control}
                        name={`intermediateStops.${index}.type`}
                        render={({ field }) => (
                          <RadioGroup
                            onValueChange={(val) => {
                              field.onChange(val);
                              form.setValue(`intermediateStops.${index}.location`, '');
                            }}
                            defaultValue={field.value}
                            className="flex gap-4"
                          >
                            <div className="flex items-center space-x-2"><RadioGroupItem value="Site" id={`stop-${index}-site`} /><Label htmlFor={`stop-${index}-site`} className="text-[11px] font-bold cursor-pointer">Project Site</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="Other" id={`stop-${index}-other`} /><Label htmlFor={`stop-${index}-other`} className="text-[11px] font-bold cursor-pointer">Other</Label></div>
                          </RadioGroup>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`intermediateStops.${index}.location`}
                        render={({ field: locField }) => (
                          <FormItem className="flex flex-col">
                            {form.watch(`intermediateStops.${index}.type`) === 'Site' ? (
                              <Popover 
                                open={openStopPopoverIndex === index} 
                                onOpenChange={(open) => setOpenStopPopoverIndex(open ? index : null)}
                              >
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      className={cn(
                                        "w-full justify-between font-normal rounded-sm h-10 bg-background text-left",
                                        !locField.value && "text-muted-foreground"
                                      )}
                                    >
                                      <span className="truncate">{locField.value || "Select destination site..."}</span>
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
                                      value={stopSearchQuery}
                                      onChange={(e) => setStopSearchQuery(e.target.value)}
                                    />
                                  </div>
                                  <ScrollArea className="h-[200px]">
                                    <div className="p-1">
                                      {filteredStopSites.map((site) => (
                                        <Button
                                          key={site.id}
                                          type="button"
                                          variant="ghost"
                                          className="w-full justify-start font-normal h-10 text-xs"
                                          onClick={() => {
                                            locField.onChange(site.name);
                                            setOpenStopPopoverIndex(null);
                                            setStopSearchQuery("");
                                          }}
                                        >
                                          <Check className={cn("mr-2 h-4 w-4 text-primary", site.name === locField.value ? "opacity-100" : "opacity-0")} />
                                          {site.name}
                                        </Button>
                                      ))}
                                    </div>
                                  </ScrollArea>
                                </PopoverContent>
                              </Popover>
                            ) : (
                              <FormControl>
                                <Input placeholder="Enter destination address..." {...locField} className="h-10 rounded-sm bg-background" />
                              </FormControl>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`intermediateStops.${index}.purpose`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="Purpose of stop..." {...field} className="h-10 rounded-sm bg-background text-xs" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ))}
                  {stopFields.length === 0 && (
                    <div className="p-6 border border-dashed rounded-sm text-center bg-muted/5">
                      <p className="text-[11px] text-muted-foreground italic">Add any intermediate stops required for this journey.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 4: Final Drop-off */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary border border-primary/20 shrink-0">4</div>
                    <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-foreground">Final Drop-off</h3>
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={makeRoundTrip}
                    disabled={!pickupLocation}
                    className="h-8 rounded-sm font-bold text-primary hover:bg-primary/5 border border-primary/10 w-full sm:w-auto"
                  >
                    <RefreshCcw className="h-3 w-3 mr-1.5" /> Set as Round Trip
                  </Button>
                </div>

                <FormField
                  control={form.control}
                  name="dropType"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormControl>
                        <RadioGroup
                          onValueChange={(val) => {
                            field.onChange(val);
                            form.setValue('dropLocation', '');
                          }}
                          value={field.value}
                          className="flex gap-4 sm:gap-6"
                        >
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl><RadioGroupItem value="Site" /></FormControl>
                            <FormLabel className="font-bold cursor-pointer flex items-center gap-1.5 text-[11px] sm:text-xs">
                              <Building2 className="h-3.5 w-3.5 text-primary" /> Project Site
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl><RadioGroupItem value="Other" /></FormControl>
                            <FormLabel className="font-bold cursor-pointer flex items-center gap-1.5 text-[11px] sm:text-xs">
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
                  name="dropLocation"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      {dropType === 'Site' ? (
                        <Popover open={isDropPopoverOpen} onOpenChange={setIsDropPopoverOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between font-normal rounded-sm h-11 text-left",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <span className="truncate">{field.value || "Select final destination..."}</span>
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
                                value={dropSearchQuery}
                                onChange={(e) => setDropSearchQuery(e.target.value)}
                              />
                            </div>
                            <ScrollArea className="h-[200px]">
                              <div className="p-1">
                                {filteredDropSites.map((site) => (
                                  <Button
                                    key={site.id}
                                    type="button"
                                    variant="ghost"
                                    className="w-full justify-start font-normal h-10 text-xs"
                                    onClick={() => {
                                      field.onChange(site.name);
                                      setIsDropPopoverOpen(false);
                                      setDropSearchQuery("");
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4 text-primary", site.name === field.value ? "opacity-100" : "opacity-0")} />
                                    {site.name}
                                  </Button>
                                ))}
                              </div>
                            </ScrollArea>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <FormControl>
                          <Input placeholder="Enter final destination address..." {...field} className="h-11 rounded-sm" />
                        </FormControl>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Step 5: Co-passengers */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary border border-primary/20 shrink-0">5</div>
                    <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-foreground">Co-passengers</h3>
                  </div>
                  <Popover open={isPassengerPopoverOpen} onOpenChange={setIsPassengerPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 rounded-sm font-bold border-primary text-primary hover:bg-primary/5 px-3">
                        <UserPlus className="h-3.5 w-3.5 mr-1" /> Add
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] sm:w-[300px] p-0" align="end">
                      <div className="flex items-center border-b px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Input
                          placeholder="Search or type name..."
                          className="h-10 w-full border-none focus-visible:ring-0 px-0 text-sm"
                          value={passengerSearchQuery}
                          onChange={(e) => setPassengerSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addExternalPassenger())}
                        />
                      </div>
                      <ScrollArea className="h-[200px]">
                        <div className="p-1">
                          {passengerSearchQuery.trim() !== "" && (
                            <Button variant="ghost" className="w-full justify-start h-11 mb-1 bg-primary/5 text-primary" onClick={addExternalPassenger}>
                              <UserCheck className="mr-2 h-4 w-4" />
                              <span className="text-xs font-black uppercase truncate">Add "{passengerSearchQuery}"</span>
                            </Button>
                          )}
                          {filteredPotentialPassengers.map((u) => (
                            <Button key={u.id} type="button" variant="ghost" className="w-full justify-start font-normal h-10 text-xs" onClick={() => addPassenger(u)}>
                              <div className="flex flex-col items-start overflow-hidden text-left">
                                <span className="truncate font-bold w-full">{u.username}</span>
                                <span className="text-[9px] text-muted-foreground uppercase">{u.role}</span>
                              </div>
                            </Button>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="min-h-[60px] p-3 sm:p-4 border border-dashed rounded-sm bg-muted/10 flex flex-wrap gap-2 items-center">
                  {coPassengers.length > 0 ? (
                    coPassengers.map(p => (
                      <Badge key={p.id} variant="secondary" className="pl-2.5 pr-1 py-1 h-8 rounded-sm gap-1.5 flex items-center font-bold text-[11px] bg-background border border-primary/10">
                        <Users className="h-3 w-3 text-primary/60" />
                        <span className="truncate max-w-[100px]">{p.name}</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removePassenger(p.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))
                  ) : (
                    <p className="text-[10px] uppercase font-black text-muted-foreground/30 tracking-widest text-center w-full">No co-passengers added</p>
                  )}
                </div>
              </div>

              {/* Step 6: Purpose */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary border border-primary/20 shrink-0">6</div>
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-foreground">General Trip Note</h3>
                </div>
                <FormField control={form.control} name="purpose" render={({ field }) => (
                  <FormItem>
                    <FormControl><Textarea rows={4} placeholder="Describe the trip context, official work requirements or special instructions..." {...field} className="rounded-sm text-sm" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="pt-6 border-t flex flex-col sm:flex-row justify-end gap-4">
                <Button type="button" variant="ghost" className="rounded-sm font-bold order-2 sm:order-1" onClick={() => router.back()}>Cancel Request</Button>
                <Button type="submit" disabled={isSubmitting} className="rounded-sm font-black h-12 px-10 shadow-lg order-1 sm:order-2">
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> DISPATCHING...</> : <><Send className="mr-2 h-4 w-4" /> SEND FOR APPROVAL</>}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
