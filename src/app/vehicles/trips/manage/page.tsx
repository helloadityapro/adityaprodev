'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, orderBy, where, or, serverTimestamp, and, getDocs, writeBatch } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CarFront, 
  Search, 
  FilterX, 
  MapPin, 
  MapPinned,
  ArrowRight, 
  Users, 
  History, 
  Eye, 
  Trash2, 
  Calendar,
  Clock,
  User,
  Navigation,
  FileDown,
  CheckCircle2,
  Timer,
  AlertCircle,
  XCircle,
  Fuel,
  Loader2,
  FileText,
  PlayCircle,
  Flag,
  Smartphone,
  Check,
  HardHat,
  TrendingUp,
  CircleX,
  ListFilter,
  MessageCircle,
  UserCircle2,
  UserCog,
  ArrowLeftRight,
  Maximize2,
  Pencil,
  Plus,
  X,
  PlusCircle,
  UserPlus,
  ChevronsUpDown,
  Save,
  ShieldCheck,
  RotateCcw,
  ListChecks,
  Share2,
  ArrowUp
} from 'lucide-react';
import { format, parse } from 'date-fns';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { isSuperAdmin } from '@/lib/auth-constants';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { sendNotification } from '@/lib/notifications';
import { getPageKeyByPath, type PageKey, slugifyRole } from "@/lib/access-control";

type Assignment = {
  id: string;
  userId: string;
  userName: string;
  driverId?: string;
  driverName?: string;
  vehicleId?: string;
  vehicleDetails?: string;
  vehicleOwnership?: 'Owned' | 'Rented';
  purpose: string;
  siteId?: string;
  pickupLocation: string;
  pickupType: 'Site' | 'Other';
  tripDate: string;
  reportingTime: string;
  destinations: { type: string, location: string, purpose: string }[];
  status: 'Pending' | 'Approved' | 'Ongoing' | 'Completed' | 'Rejected';
  requestDate: any;
  approvalDate?: any;
  startTime?: any;
  endTime?: any;
  startReading?: number;
  startReadingPhoto?: string;
  endReading?: number;
  endReadingPhoto?: string;
  coPassengers?: { id: string, name: string }[];
  intermediateStops?: { type: 'Site' | 'Other', location: string, purpose: string }[];
  dropLocation?: string;
  dropType?: 'Site' | 'Other';
};

type Vehicle = {
  id: string;
  make: string;
  model: string;
  plateNumber: string;
  status: 'Available' | 'Allotted' | 'Ongoing';
  ownership: 'Owned' | 'Rented';
  currentReading: number;
};

type UserProfile = {
  id: string;
  username: string;
  role: string;
  assignedProjectIds?: string[];
  ownDataOnly?: boolean;
  mobile?: string;
  email: string;
};

type AccessConfig = {
  id: string;
  ownDataOnly?: boolean;
};

type Site = {
  id: string;
  name: string;
};

const stopSchema = z.object({
  type: z.enum(['Site', 'Other']),
  location: z.string().min(1, 'Stop location is required.'),
  purpose: z.string().min(1, 'Purpose for this stop is required.'),
});

const editRequestSchema = z.object({
  pickupType: z.enum(['Site', 'Other']),
  pickupLocation: z.string().min(1, 'Pickup location is required.'),
  tripDate: z.string().min(1, 'Trip date is required.'),
  reportingTime: z.string().min(1, 'Reporting time is required.'),
  intermediateStops: z.array(stopSchema).default([]),
  dropType: z.enum(['Site', 'Other']),
  dropLocation: z.string().min(1, 'Drop-off location is required.'),
  purpose: z.string().min(5, 'Purpose must be detailed (min 5 chars).'),
  coPassengers: z.array(z.object({
    id: z.string(),
    name: z.string()
  })).default([]),
});

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

function handleWhatsAppShare(trip: Assignment) {
  let header = "";
  let body = "";
  const tripUrl = `${window.location.origin}/vehicles/trips/manage?view=${trip.id}`;

  switch (trip.status) {
    case 'Pending':
      header = "\u{1F6A8} *Aditya Pro - New Vehicle Request*";
      body = `*Requester:* ${trip.userName}\n*Trip Date:* ${trip.tripDate}\n*Pickup:* ${trip.pickupLocation}\n*Drop:* ${trip.destinations[trip.destinations.length - 1]?.location}\n*Purpose:* ${trip.purpose}`;
      break;
    case 'Approved':
      header = "\u{2705} *Aditya Pro - Vehicle Allotted*";
      body = `*Requester:* ${trip.userName}\n*Vehicle:* ${trip.vehicleDetails}\n*Driver:* ${trip.driverName}\n*Ownership:* ${trip.vehicleOwnership}\n*Trip Date:* ${trip.tripDate}\n*Ready for departure.*`;
      break;
    case 'Ongoing':
      header = "\u{1F6A6} *Aditya Pro - Trip Ongoing*";
      body = `*Vehicle:* ${trip.vehicleDetails}\n*Driver:* ${trip.driverName}\n*Started At:* ${trip.startTime ? format(trip.startTime.toDate(), 'HH:mm') : 'N/A'}\n*Current Route:* ${trip.pickupLocation} ➔ ${trip.destinations[0]?.location || 'Destination'}`;
      break;
    case 'Completed':
      const distance = (trip.endReading || 0) - (trip.startReading || 0);
      header = "\u{1F3C1} *Aditya Pro - Trip Completed*";
      body = `*Vehicle:* ${trip.vehicleDetails}\n*Personnel:* ${trip.userName}\n*Distance:* ${distance.toFixed(1)} KM\n*Finished At:* ${trip.endTime ? format(trip.endTime.toDate(), 'HH:mm') : 'N/A'}`;
      break;
    case 'Rejected':
      header = "\u{274C} *Aditya Pro - Trip Cancelled*";
      body = `*Request Ref:* ${trip.id.slice(0, 8)}\n*Requester:* ${trip.userName}\n*Site:* ${trip.pickupLocation}\n*The trip request has been revoked.*`;
      break;
    default:
      header = "\u{2139}\u{FE0F} *Aditya Pro - Trip Update*";
      body = `*Status:* ${trip.status}\n*Site:* ${trip.pickupLocation}`;
  }

  const message = `${header}\n\n${body}\n\n*View Audit Log:* ${tripUrl}`;
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

/**
 * Dialog component to edit trip request details.
 */
function EditTripDialog({ 
  assignment, 
  open, 
  onOpenChange, 
  sites, 
  allUsers,
  onSave
}: { 
  assignment: Assignment | null, 
  open: boolean, 
  onOpenChange: (o: boolean) => void,
  sites: Site[],
  allUsers: UserProfile[],
  onSave: (values: z.infer<typeof editRequestSchema>) => Promise<void>
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isPickupPopoverOpen, setIsPickupPopoverOpen] = React.useState(false);
  const [pickupSearchQuery, setPickupSearchQuery] = React.useState("");
  const [openStopPopoverIndex, setOpenStopPopoverIndex] = React.useState<number | null>(null);
  const [stopSearchQuery, setStopSearchQuery] = React.useState("");
  const [isDropPopoverOpen, setIsDropPopoverOpen] = React.useState(false);
  const [dropSearchQuery, setDropSearchQuery] = React.useState("");
  const [isPassengerPopoverOpen, setIsPassengerPopoverOpen] = React.useState(false);
  const [passengerSearchQuery, setPassengerSearchQuery] = React.useState("");

  const form = useForm<z.infer<typeof editRequestSchema>>({
    resolver: zodResolver(editRequestSchema),
    defaultValues: { 
      pickupType: 'Site',
      pickupLocation: '',
      tripDate: '',
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
  const dropType = form.watch('dropType');
  const coPassengers = form.watch('coPassengers');

  React.useEffect(() => {
    if (assignment) {
      form.reset({
        pickupType: assignment.pickupType || 'Site',
        pickupLocation: assignment.pickupLocation || '',
        tripDate: assignment.tripDate || '',
        reportingTime: assignment.reportingTime || '09:00 AM',
        intermediateStops: assignment.intermediateStops || [],
        dropType: assignment.dropType || 'Site',
        dropLocation: assignment.dropLocation || '',
        purpose: assignment.purpose || '',
        coPassengers: assignment.coPassengers || []
      });
    }
  }, [assignment, form]);

  const handleSubmit = async (values: z.infer<typeof editRequestSchema>) => {
    setIsSubmitting(true);
    await onSave(values);
    setIsSubmitting(false);
  };

  const filteredPickupSites = sites.filter(s => s.name.toLowerCase().includes(pickupSearchQuery.toLowerCase()));
  const filteredStopSites = sites.filter(s => s.name.toLowerCase().includes(stopSearchQuery.toLowerCase()));
  const filteredDropSites = sites.filter(s => s.name.toLowerCase().includes(dropSearchQuery.toLowerCase()));
  const filteredPotentialPassengers = allUsers.filter(u => 
    (u.username || '').toLowerCase().includes(passengerSearchQuery.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(passengerSearchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden flex flex-col rounded-sm border-none shadow-2xl bg-background">
        <DialogHeader className="p-6 bg-primary/5 border-b shrink-0">
          <DialogTitle className="text-xl font-black uppercase tracking-tight">Modify Trip Request</DialogTitle>
          <DialogDescription className="text-xs font-medium">Update itinerary and trip metadata for: {assignment?.userName}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1">
          <div className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="tripDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-wider">Trip Date</FormLabel>
                        <FormControl><Input type="date" {...field} className="h-11 rounded-sm" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="reportingTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-wider">Reporting Time (12h)</FormLabel>
                        <FormControl>
                          <div className="flex items-center gap-2">
                            <Input 
                              className="h-11 rounded-sm w-[60px] text-center font-bold" 
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
                              className="h-11 rounded-sm w-[60px] text-center font-bold" 
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
                              <SelectTrigger className="h-11 rounded-sm w-[80px]"><SelectValue /></SelectTrigger>
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

                <div className="space-y-4">
                  <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Route Details</Label>
                  <Card className="rounded-sm border-dashed">
                    <CardContent className="pt-6 space-y-6">
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="pickupType"
                          render={({ field }) => (
                            <FormItem className="space-y-3">
                              <FormLabel className="text-xs font-bold uppercase">Pickup Type</FormLabel>
                              <FormControl>
                                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-6">
                                  <div className="flex items-center space-x-2"><RadioGroupItem value="Site" id="edit-src-site" /><Label htmlFor="edit-src-site" className="text-xs font-bold">Project Site</Label></div>
                                  <div className="flex items-center space-x-2"><RadioGroupItem value="Other" id="edit-src-other" /><Label htmlFor="edit-src-other" className="text-xs font-bold">Other</Label></div>
                                </RadioGroup>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="pickupLocation"
                          render={({ field }) => (
                            <FormItem>
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
                                        <span className="truncate">{field.value || "Select pickup..."}</span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                    <div className="flex items-center border-b px-3"><Search className="mr-2 h-4 w-4 shrink-0 opacity-50" /><Input placeholder="Search sites..." className="h-10 border-none" value={pickupSearchQuery} onChange={e => setPickupSearchQuery(e.target.value)} /></div>
                                    <ScrollArea className="h-[150px]">{filteredPickupSites.map(s => (<Button key={s.id} type="button" variant="ghost" className="w-full justify-start h-9 text-xs" onClick={() => { field.onChange(s.name); setIsPickupPopoverOpen(false); }}>{s.name}</Button>))}</ScrollArea>
                                  </PopoverContent>
                                </Popover>
                              ) : (
                                <FormControl><Input placeholder="Enter pickup address..." {...field} className="h-11 rounded-sm" /></FormControl>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold uppercase">Intermediate Stops</Label>
                          <Button type="button" variant="outline" size="sm" onClick={() => appendStop({ type: 'Site', location: '', purpose: '' })} className="h-7 text-[10px] font-bold"><Plus className="h-3 w-3 mr-1" /> Add Stop</Button>
                        </div>
                        {stopFields.map((field, idx) => (
                          <div key={field.id} className="p-4 border rounded-sm bg-muted/5 space-y-3 relative group">
                            <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-destructive rounded-sm" onClick={() => removeStop(idx)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            <FormField
                              control={form.control}
                              name={`intermediateStops.${idx}.type`}
                              render={({ field: typeField }) => (
                                <RadioGroup onValueChange={typeField.onChange} value={typeField.value} className="flex gap-4 mb-2">
                                  <div className="flex items-center space-x-2"><RadioGroupItem value="Site" id={`stop-${idx}-site`} /><Label htmlFor={`stop-${idx}-site`} className="text-[10px] font-bold">Site</Label></div>
                                  <div className="flex items-center space-x-2"><RadioGroupItem value="Other" id={`stop-${idx}-other`} /><Label htmlFor={`stop-${idx}-other`} className="text-[10px] font-bold">Other</Label></div>
                                </RadioGroup>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`intermediateStops.${idx}.location`}
                              render={({ field: locField }) => (
                                <FormItem>
                                  {form.watch(`intermediateStops.${idx}.type`) === 'Site' ? (
                                    <Popover open={openStopPopoverIndex === idx} onOpenChange={o => setOpenStopPopoverIndex(o ? idx : null)}>
                                      <PopoverTrigger asChild><FormControl><Button variant="outline" className="w-full justify-between h-9 rounded-sm bg-background">{locField.value || "Choose Site..."}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></FormControl></PopoverTrigger>
                                      <PopoverContent className="w-[300px] p-0"><ScrollArea className="h-[150px]">{filteredStopSites.map(s => (<Button key={s.id} type="button" variant="ghost" className="w-full justify-start h-9 text-xs" onClick={() => { locField.onChange(s.name); setOpenStopPopoverIndex(null); }}>{s.name}</Button>))}</ScrollArea></PopoverContent>
                                    </Popover>
                                  ) : (
                                    <FormControl><Input placeholder="Address..." {...locField} className="h-9 rounded-sm bg-background" /></FormControl>
                                  )}
                                </FormItem>
                              )}
                            />
                            <FormField control={form.control} name={`intermediateStops.${idx}.purpose`} render={({ field }) => (<Input placeholder="Purpose of stop..." {...field} className="h-9 rounded-sm bg-background text-xs" />)} />
                          </div>
                        ))}
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="dropType"
                          render={({ field }) => (
                            <FormItem className="space-y-3">
                              <FormLabel className="text-xs font-bold uppercase">Final Drop-off</FormLabel>
                              <FormControl>
                                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-6">
                                  <div className="flex items-center space-x-2"><RadioGroupItem value="Site" id="edit-drop-site" /><Label htmlFor="edit-drop-site" className="text-xs font-bold">Project Site</Label></div>
                                  <div className="flex items-center space-x-2"><RadioGroupItem value="Other" id="edit-drop-other" /><Label htmlFor="edit-drop-other" className="text-xs font-bold">Other</Label></div>
                                </RadioGroup>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="dropLocation"
                          render={({ field }) => (
                            <FormItem>
                              {dropType === 'Site' ? (
                                <Popover open={isDropPopoverOpen} onOpenChange={setIsDropPopoverOpen}>
                                  <PopoverTrigger asChild>
                                    <FormControl><Button variant="outline" className={cn("w-full justify-between font-normal rounded-sm h-11 text-left", !field.value && "text-muted-foreground")}>{field.value || "Select destination..."}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><ScrollArea className="h-[150px]">{filteredDropSites.map(s => (<Button key={s.id} type="button" variant="ghost" className="w-full justify-start h-9 text-xs" onClick={() => { field.onChange(s.name); setIsDropPopoverOpen(false); }}>{s.name}</Button>))}</ScrollArea></PopoverContent>
                                </Popover>
                              ) : (
                                <FormControl><Input placeholder="Enter destination address..." {...field} className="h-11 rounded-sm" /></FormControl>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Co-passengers</Label>
                    <Popover open={isPassengerPopoverOpen} onOpenChange={setIsPassengerPopoverOpen}>
                      <PopoverTrigger asChild><Button variant="outline" size="sm" className="h-7 text-[10px] font-bold"><UserPlus className="h-3 w-3 mr-1" /> Add</Button></PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0" align="end">
                        <div className="flex items-center border-b px-3"><Search className="mr-2 h-4 w-4 shrink-0 opacity-50" /><Input placeholder="Search personnel..." className="h-10 border-none" value={passengerSearchQuery} onChange={e => setPassengerSearchQuery(e.target.value)} /></div>
                        <ScrollArea className="h-[200px]">{filteredPotentialPassengers.map(u => (<Button key={u.id} type="button" variant="ghost" className="w-full justify-start h-10 text-xs" onClick={() => { if(!coPassengers.some(p => p.id === u.id)) { form.setValue('coPassengers', [...coPassengers, { id: u.id, name: u.username }]); } setIsPassengerPopoverOpen(false); }}>{u.username}</Button>))}</ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[40px] p-3 border rounded-sm bg-muted/5">
                    {coPassengers.map(p => (
                      <Badge key={p.id} variant="secondary" className="gap-1.5 h-7 px-2 rounded-sm font-bold text-[10px] uppercase">
                        {p.name}
                        <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => form.setValue('coPassengers', coPassengers.filter(x => x.id !== p.id))} />
                      </Badge>
                    ))}
                    {coPassengers.length === 0 && <span className="text-[10px] font-bold text-muted-foreground/40 italic">No co-passengers added.</span>}
                  </div>
                </div>

                <FormField control={form.control} name="purpose" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider">General Trip Note</FormLabel>
                    <FormControl><Textarea rows={3} placeholder="Describe the trip context..." {...field} className="rounded-sm" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </form>
            </Form>
          </div>
        </ScrollArea>
        <DialogFooter className="p-4 bg-muted/10 border-t gap-3 shrink-0 flex-col sm:flex-row">
          <DialogClose asChild><Button variant="outline" className="rounded-sm font-bold uppercase text-[10px] h-10 px-6">Cancel</Button></DialogClose>
          <Button onClick={form.handleSubmit(handleSubmit)} disabled={isSubmitting} className="rounded-sm font-black uppercase text-[10px] h-10 px-8 shadow-md">
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Applying...</> : <><Save className="h-4 w-4 mr-2" /> Apply Updates</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Dialog to view and share scheduled trips for a specific date.
 */
function ScheduledTripsDialog({ 
  assignments, 
  open, 
  onOpenChange 
}: { 
  assignments: Assignment[], 
  open: boolean, 
  onOpenChange: (o: boolean) => void 
}) {
  const [selectedDate, setSelectedDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  
  const filtered = React.useMemo(() => {
    return assignments.filter(a => {
      const dateMatch = a.tripDate === selectedDate;
      const statusMatch = statusFilter === 'all' ? a.status !== 'Rejected' : a.status === statusFilter;
      return dateMatch && statusMatch;
    });
  }, [assignments, selectedDate, statusFilter]);

  const handleShareOnWhatsApp = () => {
    if (filtered.length === 0) return;
    
    let message = `*Scheduled Trips for ${format(new Date(selectedDate), 'dd MMM yyyy')} (${statusFilter === 'all' ? 'All Active' : statusFilter})*\n\n`;
    
    filtered.forEach((trip, index) => {
      const passengerList = trip.coPassengers && trip.coPassengers.length > 0 
        ? ` (with ${trip.coPassengers.map(p => p.name).join(', ')})` 
        : '';
      const stops = trip.intermediateStops && trip.intermediateStops.length > 0
        ? `\n\u{1F6D1} *Stops:* ${trip.intermediateStops.map(s => s.location).join(', ')}`
        : '';

      message += `*${index + 1}. @${trip.userName}${passengerList}*\n`;
      message += `\u{1F4CD} *Pickup:* ${trip.pickupLocation}\n`;
      message += `\u{1F552} *Reporting:* ${formatTo12Hr(trip.reportingTime)}${stops}\n`;
      message += `\u{1F3C1} *Drop:* ${trip.dropLocation}\n`;
      message += `\u{1F697} *Vehicle:* ${trip.vehicleDetails || 'Pending Allotment'}\n`;
      message += `\u{1F464} *Driver:* ${trip.driverName || 'Pending Designation'}\n`;
      message += `------------------\n\n`;
    });

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 rounded-sm overflow-hidden shadow-2xl bg-background">
        <DialogHeader className="p-6 bg-primary/5 border-b shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-primary" /> Scheduled Trips Overview
              </DialogTitle>
              <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Audit upcoming logistics deployments</DialogDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-32 rounded-sm font-bold text-[10px] uppercase bg-background border-primary/20">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-[10px] font-bold uppercase">All Active</SelectItem>
                  <SelectItem value="Approved" className="text-[10px] font-bold uppercase">Approved</SelectItem>
                  <SelectItem value="Completed" className="text-[10px] font-bold uppercase">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Input 
                type="date" 
                value={selectedDate} 
                onChange={e => setSelectedDate(e.target.value)} 
                className="h-9 w-40 rounded-sm font-bold text-xs bg-background border-primary/20" 
              />
              <Button 
                onClick={handleShareOnWhatsApp} 
                disabled={filtered.length === 0}
                className="h-9 bg-green-600 hover:bg-green-700 text-white font-black uppercase text-[10px] px-4 shadow-md"
              >
                <Share2 className="h-3.5 w-3.5 mr-1.5" /> Share WA
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 bg-muted/10 relative">
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between border-b-2 border-primary/10 pb-2">
              <h3 className="text-sm font-black uppercase tracking-widest text-primary">
                Trips for {format(new Date(selectedDate), 'eeee, dd MMM yyyy')}
              </h3>
              <Badge variant="secondary" className="rounded-full font-black text-[9px] uppercase">{filtered.length} Results</Badge>
            </div>
            
            {filtered.length > 0 ? (
              <div className="grid gap-6">
                {filtered.map((trip, idx) => (
                  <Card key={trip.id} className="rounded-sm border-primary/10 shadow-sm overflow-hidden group">
                    <CardHeader className="bg-background py-3 border-b flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-black text-xs text-primary border border-primary/20">
                          {idx + 1}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-foreground">@{trip.userName}</span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">{formatTo12Hr(trip.reportingTime)}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn(
                        "text-[8px] font-black uppercase h-5 rounded-sm",
                        trip.status === 'Approved' ? "bg-blue-50 text-blue-700 border-blue-200" : 
                        trip.status === 'Ongoing' ? "bg-primary text-white border-none" : 
                        trip.status === 'Completed' ? "bg-green-50 text-green-700 border-green-200" :
                        "bg-yellow-50 text-yellow-700 border-yellow-200"
                      )}>
                        {trip.status}
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-4 bg-background/50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="relative pl-6 border-l-2 border-emerald-500 pb-2">
                            <div className="absolute -left-[7px] top-0 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-background" />
                            <p className="text-[9px] font-black uppercase text-emerald-700 tracking-tighter">Pickup</p>
                            <p className="text-xs font-bold">{trip.pickupLocation}</p>
                          </div>
                          {trip.intermediateStops?.map((stop, sIdx) => (
                            <div key={sIdx} className="relative pl-6 border-l-2 border-primary/30 pb-2">
                              <div className="absolute -left-[7px] top-0 h-3 w-3 rounded-full bg-muted-foreground/30 ring-4 ring-background" />
                              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">Stop #{sIdx + 1}</p>
                              <p className="text-xs font-bold">{stop.location}</p>
                            </div>
                          ))}
                          <div className="relative pl-6 border-l-2 border-primary">
                            <div className="absolute -left-[7px] top-0 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                            <p className="text-[9px] font-black uppercase text-primary tracking-tighter">Final Drop</p>
                            <p className="text-xs font-bold">{trip.dropLocation}</p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="p-3 bg-muted/20 rounded-sm border border-primary/5">
                            <Label className="text-[9px] font-black uppercase text-muted-foreground block mb-2">Fleet Allotment</Label>
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <CarFront className="h-3.5 w-3.5 text-primary" />
                                <span className="text-[11px] font-black uppercase">{trip.vehicleDetails || 'Pending'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <UserCog className="h-3.5 w-3.5 text-primary" />
                                <span className="text-[11px] font-black uppercase">{trip.driverName || 'Pending'}</span>
                              </div>
                            </div>
                          </div>
                          {trip.coPassengers && trip.coPassengers.length > 0 && (
                            <div className="space-y-1.5">
                              <Label className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1.5"><Users className="h-3 w-3" /> Co-passengers</Label>
                              <div className="flex flex-wrap gap-1.5">
                                {trip.coPassengers.map(p => (
                                  <Badge key={p.id} variant="secondary" className="text-[8px] h-4 rounded-sm font-bold bg-muted/50 border-none">{p.name}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
                <Calendar className="h-16 w-16 mb-4" />
                <p className="font-black uppercase tracking-widest text-sm">No {statusFilter === 'all' ? 'active' : statusFilter.toLowerCase()} trips scheduled for this date</p>
              </div>
            )}
          </div>
          <ScrollBar orientation="vertical" />
        </ScrollArea>
        <DialogFooter className="p-4 border-t bg-muted/10 shrink-0">
          <DialogClose asChild><Button variant="outline" className="rounded-sm font-bold uppercase text-[10px] h-10 px-8">Close</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ManageAllTripsPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState("registry");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [approvalTarget, setApprovalState] = React.useState<{ assignment: Assignment, vehicleId: string, driverId: string, rentedDriverDetails: string } | null>(null);
  const [detailsAssignment, setDetailsAssignment] = React.useState<Assignment | null>(null);
  const [editingAssignment, setEditingAssignment] = React.useState<Assignment | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<Assignment | null>(null);
  const [releaseTarget, setReleaseTarget] = React.useState<Vehicle | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isScheduledTripsOpen, setIsScheduledTripsOpen] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<AccessConfig>(roleConfigsQuery);
  
  const isSuper = isSuperAdmin(user?.email);
  const isAdmin = isSuper || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';
  const isHR = userProfile?.role === 'Manager - Human Resources';
  const userRole = isAdmin ? 'admin' : (userProfile?.role ? slugifyRole(userProfile.role) : 'site-engineer');

  const assignmentsQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'vehicle_assignments');
    
    if (isAdmin || isHR) {
      return query(colRef, orderBy('requestDate', 'desc'));
    }

    return query(
      colRef, 
      or(
        where('driverId', '==', user.uid), 
        where('userId', '==', user.uid),
        where('siteManagerId', '==', user.uid)
      )
    );
  }, [firestore, isAdmin, isHR, user, isProfileLoading]);

  const { data: assignments, isLoading: isAssignmentsLoading } = useCollection<Assignment>(assignmentsQuery);

  const vehiclesQuery = useMemoFirebase(() => collection(firestore, 'vehicles'), [firestore]);
  const { data: vehicles, isLoading: isVehiclesLoading } = useCollection<Vehicle>(vehiclesQuery);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers, isLoading: isUsersLoading } = useCollection<UserProfile>(usersQuery);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: sites } = useCollection<Site>(sitesQuery);

  const driversList = React.useMemo(() => allUsers?.filter(u => u.role === 'Driver') || [], [allUsers]);

  const availableVehiclesForAllotment = React.useMemo(() => {
    if (!vehicles) return [];
    return vehicles.filter(v => v.status === 'Available');
  }, [vehicles]);

  React.useEffect(() => {
    const viewId = searchParams.get('view');
    if (viewId && assignments && assignments.length > 0) {
      const found = assignments.find(a => a.id === viewId);
      if (found) {
        setDetailsAssignment(found);
      }
    }
  }, [searchParams, assignments]);

  const handleCloseDetail = () => {
    setDetailsAssignment(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('view');
    const queryStr = params.toString();
    router.replace(`${pathname}${queryStr ? `?${queryStr}` : ''}`);
  };

  const filteredAssignments = React.useMemo(() => {
    if (!assignments || !userProfile) return [];
    
    const isOwnDataOnly = userProfile.ownDataOnly !== undefined 
      ? userProfile.ownDataOnly 
      : roleConfigs?.find(c => c.id === userRole)?.ownDataOnly ?? false;

    let result = assignments;

    if (isOwnDataOnly && !isSuper) {
      const assignedIds = new Set(userProfile.assignedProjectIds || []);
      result = result.filter(trip => {
        if (trip.siteId) return assignedIds.has(trip.siteId);
        return true; 
      });
    }

    return result.filter(trip => {
      const matchesSearch = trip.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trip.pickupLocation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (trip.vehicleDetails || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (trip.driverName || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || trip.status === statusFilter;
      const isQueue = activeTab === 'queue' ? trip.status === 'Pending' : true;
      
      return matchesSearch && matchesStatus && isQueue;
    }).sort((a, b) => {
      const dateA = a.requestDate?.toDate?.()?.getTime() || 0;
      const dateB = b.requestDate?.toDate?.()?.getTime() || 0;
      return dateB - dateA;
    });
  }, [assignments, searchTerm, statusFilter, activeTab, userProfile, roleConfigs, isSuper, userRole]);

  const stats = React.useMemo(() => {
    return {
      total: filteredAssignments.length,
      pending: filteredAssignments.filter(a => a.status === 'Pending').length,
      ongoing: filteredAssignments.filter(a => a.status === 'Ongoing').length,
      completed: filteredAssignments.filter(a => a.status === 'Completed').length,
    };
  }, [filteredAssignments]);

  const handleApprove = async () => {
    if (!approvalTarget?.vehicleId || !approvalTarget?.driverId) {
      toast({ variant: 'destructive', title: 'Selection Required', description: 'Please allot a vehicle and driver.' });
      return;
    }

    const { assignment, vehicleId, driverId, rentedDriverDetails } = approvalTarget;
    const vehicle = vehicles?.find(v => v.id === vehicleId);
    
    let finalDriverId = driverId;
    let finalDriverName = "";

    if (driverId === 'RENTED') {
      finalDriverId = "RENTED";
      finalDriverName = rentedDriverDetails ? `Rented: ${rentedDriverDetails}` : "Rented Driver";
    } else {
      const driver = driversList?.find(d => d.id === driverId);
      finalDriverName = driver?.username || 'Assigned Driver';
    }

    try {
      updateDocumentNonBlocking(doc(firestore, 'vehicle_assignments', assignment.id), {
        status: 'Approved',
        vehicleId,
        vehicleDetails: `${vehicle?.make} ${vehicle?.model} (${vehicle?.plateNumber})`,
        vehicleOwnership: vehicle?.ownership || 'Owned',
        driverId: finalDriverId,
        driverName: finalDriverName,
        approvalDate: serverTimestamp(),
      });

      updateDocumentNonBlocking(doc(firestore, 'vehicles', vehicleId), { status: 'Allotted' });

      // Send Platform and Push Notification to Requester
      sendNotification(firestore, {
        userId: assignment.userId,
        title: "Vehicle Allotted",
        description: `Your trip request for ${assignment.tripDate} has been authorized. Vehicle: ${vehicle?.plateNumber}.`,
        link: `/vehicles/trips/manage?view=${assignment.id}`,
        push: true
      });

      // Send Platform and Push Notification to Driver (if system driver)
      if (finalDriverId !== 'RENTED') {
        sendNotification(firestore, {
          userId: finalDriverId,
          title: "New Trip Assigned",
          description: `You have been assigned a trip for ${assignment.userName} on ${assignment.tripDate}.`,
          link: `/vehicles/trips/manage?view=${assignment.id}`,
          push: true
        });
      }

      toast({ title: 'Trip Authorized', description: 'Resources alloted successfully.' });
      setApprovalState(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const handleSaveEdit = async (values: z.infer<typeof editRequestSchema>) => {
    if (!editingAssignment) return;
    try {
      const combinedDestinations = [
        ...values.intermediateStops,
        { type: values.dropType, location: values.dropLocation, purpose: 'Final Destination' }
      ];

      await updateDocumentNonBlocking(doc(firestore, 'vehicle_assignments', editingAssignment.id), {
        ...values,
        destinations: combinedDestinations,
        updatedAt: serverTimestamp()
      });

      toast({ title: 'Request Updated', description: 'Itinerary changes applied successfully.' });
      setEditingAssignment(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setIsProcessing(true);

    try {
      updateDocumentNonBlocking(doc(firestore, 'vehicle_assignments', cancelTarget.id), {
        status: 'Rejected',
        updatedAt: serverTimestamp(),
        cancelledAt: serverTimestamp(),
        cancelledById: user?.uid
      });

      if (cancelTarget.vehicleId) {
        updateDocumentNonBlocking(doc(firestore, 'vehicles', cancelTarget.vehicleId), {
          status: 'Available'
        });
      }

      toast({ title: 'Trip Cancelled', description: 'The trip request has been revoked.' });
      setCancelTarget(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkAvailable = async () => {
    if (!releaseTarget || !assignments) return;
    setIsProcessing(true);

    try {
      const activeAssignments = assignments.filter(a => a.vehicleId === releaseTarget.id && (a.status === 'Approved' || a.status === 'Ongoing'));
      
      const batch = writeBatch(firestore);
      activeAssignments.forEach(a => {
        batch.update(doc(firestore, 'vehicle_assignments', a.id), {
          status: 'Rejected',
          updatedAt: serverTimestamp(),
          adminRemarks: 'Force-released by system administration.'
        });
      });

      batch.update(doc(firestore, 'vehicles', releaseTarget.id), {
        status: 'Available',
        updatedAt: serverTimestamp()
      });

      await batch.commit();
      toast({ title: 'Vehicle Released', description: `${releaseTarget.plateNumber} is now available for new allotments.` });
      setReleaseTarget(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Operation Failed', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isUserLoading || isProfileLoading || isAssignmentsLoading || isVehiclesLoading || isUsersLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-500px w-full" /></div>;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <MapPinned className="h-6 w-6 text-primary" />
            <h1>Manage Trips</h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium">Trip coordination hub for authorized project itineraries.</p>
        </div>
        
        <div className="flex items-center gap-2">
          {(isAdmin || isManager || isHR) && (
            <Button 
              variant="outline" 
              onClick={() => setIsScheduledTripsOpen(true)}
              className="h-10 rounded-sm font-black uppercase text-[10px] tracking-widest border-primary/20 text-primary hover:bg-primary/5"
            >
              <ListChecks className="h-4 w-4 mr-2" /> Scheduled Trips
            </Button>
          )}
          <Button asChild className="h-10 rounded-sm font-bold shadow-md px-6">
            <Link href="/vehicles/request"><Plus className="h-4 w-4 mr-2" /> Request Vehicle</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <SummaryCard title="Logs Found" value={stats.total} icon={History} color="primary" />
        <SummaryCard title="Awaiting Allotment" value={stats.pending} icon={AlertCircle} color="amber" />
        <SummaryCard title="Active Journeys" value={stats.ongoing} icon={Timer} color="blue" />
        <SummaryCard title="Completed" value={stats.completed} icon={CheckCircle2} color="emerald" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <TabsList className="bg-muted/50 border border-primary/10 rounded-sm p-1 h-10">
            <TabsTrigger value="registry" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-4 sm:px-6 h-8">Trip History</TabsTrigger>
            {(isAdmin || isManager) && (
              <TabsTrigger value="queue" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-4 sm:px-6 h-8 relative">
                Allotment Queue
                {stats.pending > 0 && <Badge className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center p-0 rounded-full bg-red-500 text-[10px] font-black">{stats.pending}</Badge>}
              </TabsTrigger>
            )}
            {(isAdmin || isHR) && (
              <TabsTrigger value="fleet" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-4 sm:px-6 h-8">Fleet Status</TabsTrigger>
            )}
          </TabsList>

          <div className="flex items-center gap-2">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search personnel or location..." 
                className="pl-8 h-9 text-xs rounded-sm border-primary/20" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px] sm:w-[150px] h-9 text-[10px] font-bold uppercase tracking-tight rounded-sm border-primary/20">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-[10px] font-bold uppercase">All Status</SelectItem>
                <SelectItem value="Pending" className="text-[10px] font-bold uppercase">Pending</SelectItem>
                <SelectItem value="Approved" className="text-[10px] font-bold uppercase">Approved</SelectItem>
                <SelectItem value="Ongoing" className="text-[10px] font-bold uppercase">Ongoing</SelectItem>
                <SelectItem value="Completed" className="text-[10px] font-bold uppercase">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="registry" className="animate-in fade-in-50 duration-300">
          <div className="md:hidden space-y-4">
            {filteredAssignments.length > 0 ? filteredAssignments.map((trip) => {
              const isAssignedDriver = trip.driverId === user?.uid;
              const isRequester = trip.userId === user?.uid;
              const canCancel = (isAdmin || isRequester) && (trip.status === 'Pending' || trip.status === 'Approved');
              const canStartTrip = (trip.status === 'Approved') && ((trip.vehicleOwnership === 'Rented' && isRequester) || (trip.vehicleOwnership !== 'Rented' && isAssignedDriver));
              const canEndTrip = (trip.status === 'Ongoing') && ((trip.vehicleOwnership === 'Rented' && isRequester) || (trip.vehicleOwnership !== 'Rented' && isAssignedDriver));

              return (
                <Card key={trip.id} className="border-primary/10 rounded-sm shadow-sm overflow-hidden" onClick={() => setDetailsAssignment(trip)}>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {trip.tripDate ? format(new Date(trip.tripDate), 'dd MMM yy') : '—'}
                        </span>
                        <h3 className="font-bold text-sm text-foreground leading-tight truncate">{trip.userName}</h3>
                      </div>
                      <Badge variant="outline" className={cn(
                        "text-[8px] font-black uppercase rounded-sm px-1.5 h-5",
                        trip.status === 'Pending' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                        trip.status === 'Approved' ? "bg-blue-50 text-blue-700 border-blue-200" :
                        trip.status === 'Ongoing' ? "bg-primary text-white border-none" :
                        trip.status === 'Completed' ? "bg-green-50 text-green-700 border-green-200" :
                        "bg-red-50 text-red-700 border-red-200"
                      )}>
                        {trip.status}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-start gap-2 text-xs font-black text-emerald-700">
                        <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span className="line-clamp-1">{trip.pickupLocation}</span>
                      </div>
                      <div className="flex flex-col gap-1 ml-4 border-l-2 border-primary/10 pl-3">
                        {trip.destinations.map((dest, i) => (
                          <div key={i} className="flex items-center gap-2 text-[10px] font-bold text-primary">
                            <ArrowRight className="h-2.5 w-2.5" />
                            <span className="line-clamp-1">{dest.location}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-primary/5 flex items-center justify-between">
                      {trip.vehicleId ? (
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-foreground truncate max-w-[120px]">{trip.vehicleDetails}</span>
                          <span className="text-[8px] font-black text-muted-foreground uppercase">{trip.driverName}</span>
                        </div>
                      ) : (
                        <span className="text-[9px] font-bold text-muted-foreground/40 uppercase italic">Awaiting Resource</span>
                      )}
                      
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => handleWhatsAppShare(trip)}>
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                        {(isAdmin || isManager) && trip.status === 'Pending' && (
                          <Button size="sm" className="h-8 rounded-sm font-black text-[10px] px-2" onClick={() => setApprovalState({ assignment: trip, vehicleId: "", driverId: "", rentedDriverDetails: "" })}>Allot</Button>
                        )}
                        {canStartTrip && (
                          <Button size="sm" className="h-8 rounded-sm bg-blue-600 text-white font-bold px-3 text-[10px]" asChild><Link href={`/vehicles/trips/${trip.id}/start`}>Start</Link></Button>
                        )}
                        {canEndTrip && (
                          <Button size="sm" className="h-8 rounded-sm bg-red-600 text-white font-bold px-3 text-[10px]" asChild><Link href={`/vehicles/trips/${trip.id}/finish`}>End</Link></Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setDetailsAssignment(trip)}><Eye className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }) : (
              <div className="text-center py-12 text-muted-foreground italic bg-muted/5 rounded-sm border-2 border-dashed">No logs discovered.</div>
            )}
          </div>

          <div className="hidden md:block">
            <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="px-6 min-w-[180px]">Requester</TableHead>
                        <TableHead className="min-w-[250px]">Itinerary</TableHead>
                        <TableHead>Trip Date</TableHead>
                        <TableHead>Fleet Resource</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right px-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAssignments.length > 0 ? filteredAssignments.map((trip) => {
                        const isAssignedDriver = trip.driverId === user?.uid;
                        const isRequester = trip.userId === user?.uid;
                        const canCancel = (isAdmin || isRequester) && (trip.status === 'Pending' || trip.status === 'Approved');
                        const canStartTrip = (trip.status === 'Approved') && ((trip.vehicleOwnership === 'Rented' && isRequester) || (trip.vehicleOwnership !== 'Rented' && isAssignedDriver));
                        const canEndTrip = (trip.status === 'Ongoing') && ((trip.vehicleOwnership === 'Rented' && isRequester) || (trip.vehicleOwnership !== 'Rented' && isAssignedDriver));

                        return (
                          <TableRow key={trip.id} className="hover:bg-muted/5 transition-colors">
                            <TableCell className="px-6 py-4">
                              <div className="flex flex-col gap-1">
                                <span className="font-bold text-sm text-foreground">{trip.userName}</span>
                                {trip.coPassengers && trip.coPassengers.length > 0 && (
                                  <div className="flex items-center gap-1">
                                    <Users className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase">+{trip.coPassengers.length} pax</span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-1.5 text-xs font-black text-emerald-700">
                                  <MapPin className="h-3 w-3" /> {trip.pickupLocation}
                                </div>
                                <div className="flex flex-col gap-1 ml-4 border-l border-primary/10 pl-2">
                                  {trip.destinations.map((dest, i) => (
                                    <div key={i} className="flex items-center gap-2 text-[10px] font-bold text-primary">
                                      <ArrowRight className="h-2.5 w-2.5" /> {dest.location}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                                  <Calendar className="h-3.5 w-3.5 text-primary" />
                                  {trip.tripDate ? format(new Date(trip.tripDate), 'dd MMM yyyy') : '—'}
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase">
                                  <Clock className="h-3 w-3" />
                                  {trip.reportingTime}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {trip.vehicleId ? (
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold">{trip.vehicleDetails}</span>
                                    <Badge variant="secondary" className="h-3.5 px-1 text-[7px] font-black uppercase rounded-sm border-none bg-muted text-muted-foreground">{trip.vehicleOwnership || 'Owned'}</Badge>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground font-black uppercase">{trip.driverName}</span>
                                </div>
                              ) : (
                                <span className="text-[9px] font-bold text-muted-foreground/40 uppercase italic">Awaiting Resource</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn(
                                "text-[8px] font-black uppercase rounded-sm px-1.5 h-5",
                                trip.status === 'Pending' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                                trip.status === 'Approved' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                trip.status === 'Ongoing' ? "bg-primary text-white border-none" :
                                trip.status === 'Completed' ? "bg-green-50 text-green-700 border-green-200" :
                                "bg-red-50 text-red-700 border-red-200"
                              )}>
                                {trip.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right px-6">
                              <div className="flex justify-end items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 rounded-sm hover:bg-green-50" onClick={() => handleWhatsAppShare(trip)} title="Share on WhatsApp"><MessageCircle className="h-4 w-4" /></Button>
                                {(isAdmin || isManager) && trip.status === 'Pending' && (
                                  <Button size="sm" className="h-8 rounded-sm font-black text-[10px] uppercase px-4 shadow-sm" onClick={() => setApprovalState({ assignment: trip, vehicleId: "", driverId: "", rentedDriverDetails: "" })}>Allot Vehicle</Button>
                                )}
                                {(isAdmin || isManager || trip.userId === user?.uid) && trip.status === 'Pending' && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 rounded-sm" onClick={(e) => { e.stopPropagation(); setEditingAssignment(trip); }} title="Edit Request"><Pencil className="h-4 w-4" /></Button>
                                )}
                                {canStartTrip && (
                                  <Button size="sm" className="h-8 rounded-sm bg-blue-600 hover:bg-blue-700 font-bold px-3 text-[10px] uppercase tracking-tight" asChild><Link href={`/vehicles/trips/${trip.id}/start`}><PlayCircle className="h-3.5 w-3.5 mr-1" /> Start</Link></Button>
                                )}
                                {canEndTrip && (
                                  <Button size="sm" className="h-8 rounded-sm bg-red-600 hover:bg-red-700 font-bold px-3 text-[10px] uppercase tracking-tight" asChild><Link href={`/vehicles/trips/${trip.id}/finish`}><Flag className="h-3.5 w-3.5 mr-1" /> End</Link></Button>
                                )}
                                {canCancel && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 rounded-sm" onClick={() => setCancelTarget(trip)}><CircleX className="h-4 w-4" /></Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => setDetailsAssignment(trip)}><Eye className="h-4 w-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      }) : (
                        <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">No logs discovered.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="queue" className="animate-in fade-in-50 duration-300">
          <div className="md:hidden space-y-4">
            {filteredAssignments.filter(a => a.status === 'Pending').length > 0 ? (
              filteredAssignments.filter(a => a.status === 'Pending').map((trip) => (
                <Card key={trip.id} className="border-l-4 border-l-amber-500 border-primary/10 rounded-sm shadow-sm overflow-hidden" onClick={() => setDetailsAssignment(trip)}>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">Request: {trip.requestDate ? format(trip.requestDate.toDate(), 'dd MMM, HH:mm') : '—'}</span>
                        <h3 className="font-bold text-sm text-foreground truncate">{trip.userName}</h3>
                      </div>
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[8px] font-black uppercase rounded-sm h-5">Action Required</Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-primary">
                        <Calendar className="h-3.5 w-3.5" />
                        {trip.tripDate ? format(new Date(trip.tripDate), 'dd MMM yyyy') : '—'} @ {trip.reportingTime}
                      </div>
                      <div className="flex items-start gap-2 text-xs font-medium text-muted-foreground">
                        <MapPinned className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span className="line-clamp-1">{trip.pickupLocation} ➔ {trip.destinations[trip.destinations.length - 1]?.location}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-primary/5 flex justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => handleWhatsAppShare(trip)}><MessageCircle className="h-4 w-4" /></Button>
                      <Button size="sm" className="h-8 rounded-sm font-black text-[10px] px-4" onClick={() => setApprovalState({ assignment: trip, vehicleId: "", driverId: "", rentedDriverDetails: "" })}>Allot Now</Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setDetailsAssignment(trip)}><Eye className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground italic bg-muted/5 rounded-sm border-2 border-dashed">Queue empty.</div>
            )}
          </div>

          <div className="hidden md:block">
            <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="px-6">Requester</TableHead>
                      <TableHead>Itinerary Summary</TableHead>
                      <TableHead>Trip Date</TableHead>
                      <TableHead>Request Date</TableHead>
                      <TableHead className="text-right px-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssignments.filter(a => a.status === 'Pending').length > 0 ? (
                      filteredAssignments.filter(a => a.status === 'Pending').map((trip) => (
                        <TableRow key={trip.id} className="hover:bg-muted/5 transition-colors">
                          <TableCell className="px-6 py-4 font-bold text-sm">{trip.userName}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-1.5 text-xs font-black text-emerald-700">
                                <MapPin className="h-3 w-3" /> {trip.pickupLocation}
                              </div>
                              <div className="flex flex-col gap-1 ml-4 border-l border-primary/10 pl-2">
                                {trip.destinations.map((dest, i) => (
                                  <div key={i} className="flex items-center gap-2 text-[10px] font-bold text-primary">
                                    <ArrowRight className="h-2.5 w-2.5" /> {dest.location}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-bold text-foreground">{trip.tripDate ? format(new Date(trip.tripDate), 'dd MMM yyyy') : '—'}</span>
                              <span className="text-[10px] text-muted-foreground uppercase">{trip.reportingTime}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-[10px] font-mono font-bold text-muted-foreground">
                            {trip.requestDate ? format(trip.requestDate.toDate(), 'dd MMM, HH:mm') : '—'}
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <div className="flex justify-end items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 rounded-sm hover:bg-green-50" onClick={() => handleWhatsAppShare(trip)} title="Share on WhatsApp"><MessageCircle className="h-4 w-4" /></Button>
                              <Button size="sm" className="h-8 rounded-sm font-black text-[10px] uppercase px-4 shadow-sm" onClick={() => setApprovalState({ assignment: trip, vehicleId: "", driverId: "", rentedDriverDetails: "" })}>Allot Vehicle</Button>
                              {(isAdmin || isManager || trip.userId === user?.uid) && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 rounded-sm" onClick={(e) => { e.stopPropagation(); setEditingAssignment(trip); }} title="Edit Request"><Pencil className="h-4 w-4" /></Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 rounded-sm" onClick={() => setCancelTarget(trip)}><CircleX className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic text-xs">Queue empty.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fleet" className="animate-in fade-in-50 duration-300">
          <div className="md:hidden space-y-4">
            {vehicles?.map(v => {
              const activeTrip = assignments?.find(a => a.vehicleId === v.id && (a.status === 'Approved' || a.status === 'Ongoing'));
              const effectiveStatus = activeTrip ? (activeTrip.status === 'Approved' ? 'Allotted' : 'Ongoing') : 'Available';
              return (
                <Card key={v.id} className="border-primary/10 rounded-sm shadow-sm overflow-hidden">
                  <CardHeader className="p-4 bg-muted/5 border-b flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-2">
                      <CarFront className="h-4 w-4 text-primary" />
                      <span className="font-mono text-xs font-black uppercase">{v.plateNumber}</span>
                    </div>
                    <Badge variant="outline" className={cn(
                      "text-[8px] font-black uppercase h-5 px-1.5",
                      effectiveStatus === 'Available' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      effectiveStatus === 'Ongoing' ? "bg-blue-50 text-blue-700 border-blue-200" :
                      "bg-amber-50 text-amber-700 border-amber-200"
                    )}>{effectiveStatus}</Badge>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold">{v.make} {v.model}</span>
                      <span className="text-[9px] text-muted-foreground uppercase font-medium">{v.ownership} Vehicle</span>
                    </div>
                    {activeTrip ? (
                      <div className="space-y-3 pt-3 border-t">
                        <div className="flex items-center gap-2">
                          <UserCircle2 className="h-3.5 w-3.5 text-primary" />
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black uppercase text-muted-foreground leading-none">Personnel</span>
                            <span className="text-[11px] font-bold">{activeTrip.userName}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[8px] font-black uppercase text-muted-foreground leading-none">Itinerary</span>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700">
                            <MapPin className="h-3 w-3" /> {activeTrip.pickupLocation} ➔ {activeTrip.destinations[activeTrip.destinations.length - 1]?.location}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-3 border-t text-center py-2">
                        <span className="text-[9px] font-bold text-muted-foreground/40 uppercase italic">No Active Assignment</span>
                      </div>
                    )}
                  </CardContent>
                  {effectiveStatus !== 'Available' && (
                    <CardFooter className="bg-muted/5 border-t p-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full h-8 text-[10px] font-black uppercase text-amber-700 hover:text-amber-800"
                        onClick={() => setReleaseTarget(v)}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Mark as Available
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              );
            })}
          </div>

          <div className="hidden md:block">
            <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="px-6">Vehicle Identity</TableHead>
                        <TableHead>Ownership</TableHead>
                        <TableHead>Fleet Status</TableHead>
                        <TableHead className="min-w-[200px]">Current Personnel</TableHead>
                        <TableHead className="min-w-[250px]">Current Itinerary</TableHead>
                        <TableHead className="text-right px-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vehicles?.sort((a, b) => a.plateNumber.localeCompare(b.plateNumber)).map(v => {
                        const activeTrip = assignments?.find(a => a.vehicleId === v.id && (a.status === 'Approved' || a.status === 'Ongoing'));
                        const effectiveStatus = activeTrip ? (activeTrip.status === 'Approved' ? 'Allotted' : 'Ongoing') : 'Available';
                        return (
                          <TableRow key={v.id} className="hover:bg-muted/5">
                            <TableCell className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold">{v.make} {v.model}</span>
                                <span className="font-mono text-[10px] font-black text-primary uppercase tracking-widest">{v.plateNumber}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="rounded-sm text-[9px] font-black uppercase px-1.5 h-5">{v.ownership}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn(
                                "text-[9px] font-black uppercase rounded-sm px-2 h-5",
                                effectiveStatus === 'Available' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                effectiveStatus === 'Ongoing' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                "bg-amber-50 text-amber-700 border-amber-200"
                              )}>
                                {effectiveStatus}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {activeTrip ? (
                                <div className="flex items-center gap-2">
                                  <UserCircle2 className="h-4 w-4 text-primary" />
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold">{activeTrip.userName}</span>
                                    <span className="text-[9px] text-muted-foreground font-black uppercase">Driver: {activeTrip.driverName}</span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/40 italic uppercase font-bold">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {activeTrip ? (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-700">
                                    <MapPin className="h-3 w-3" /> {activeTrip.pickupLocation}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary ml-4">
                                    <ArrowRight className="h-2.5 w-2.5" /> {activeTrip.destinations[activeTrip.destinations.length - 1]?.location}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/40 italic uppercase font-bold">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right px-6">
                              {effectiveStatus !== 'Available' && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-8 rounded-sm font-black text-[9px] uppercase border-amber-500/30 text-amber-700 hover:bg-amber-50 shadow-sm"
                                  onClick={() => setReleaseTarget(v)}
                                >
                                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Mark Available
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <EditTripDialog 
        assignment={editingAssignment} 
        open={!!editingAssignment} 
        onOpenChange={(o) => !o && setEditingAssignment(null)} 
        sites={sites || []}
        allUsers={allUsers || []}
        onSave={handleSaveEdit}
      />

      <ScheduledTripsDialog 
        assignments={assignments || []} 
        open={isScheduledTripsOpen} 
        onOpenChange={setIsScheduledTripsOpen} 
      />

      <Dialog open={!!approvalTarget} onOpenChange={(o) => !o && setApprovalState(null)}>
        <DialogContent className="max-w-xl w-[95vw] p-0 overflow-hidden border-none rounded-sm shadow-2xl bg-background">
          <DialogHeader className="p-6 bg-primary/5 border-b shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-sm"><Fuel className="h-5 w-5 text-primary" /></div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Authorize Trip Allotment</DialogTitle>
                <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Requester: {approvalTarget?.assignment?.userName}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            <div className="p-6 space-y-8 text-left">
              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-2">
                  <MapPin className="h-3 w-3" /> Logged Route Itinerary
                </Label>
                <div className="bg-muted/20 border rounded-sm p-4 space-y-4">
                  <div className="relative pl-6 border-l-2 border-emerald-500 pb-2">
                    <div className="absolute -left-[7px] top-0 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-background" />
                    <p className="text-[10px] font-black uppercase text-emerald-700 tracking-tighter">Pickup Location</p>
                    <p className="text-sm font-black">{approvalTarget?.assignment.pickupLocation}</p>
                  </div>
                  {approvalTarget?.assignment.destinations.map((d, i) => (
                    <div key={i} className="relative pl-6 border-l-2 border-primary">
                      <div className="absolute -left-[7px] top-0 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                      <p className="text-[10px] font-black uppercase text-primary tracking-tighter">Destination {i + 1}</p>
                      <p className="text-sm font-black">{d.location}</p>
                      <p className="text-[10px] font-bold text-muted-foreground italic leading-relaxed">"{d.purpose}"</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3 text-left">
                  <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Select Fleet Vehicle</Label>
                  <Select onValueChange={(val) => {
                    const v = vehicles?.find(x => x.id === val);
                    setApprovalState(prev => prev ? { 
                      ...prev, 
                      vehicleId: val, 
                      driverId: v?.ownership === 'Rented' ? 'RENTED' : '' 
                    } : null);
                  }}>
                    <SelectTrigger className="rounded-sm border-primary/20 h-11 font-bold text-sm bg-muted/5">
                      <SelectValue placeholder="Allot Vehicle..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVehiclesForAllotment.map(v => (
                        <SelectItem key={v.id} value={v.id} className="text-xs font-bold">
                          {v.make} {v.model} ({v.plateNumber}) — {v.ownership}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3 text-left">
                  {vehicles?.find(v => v.id === approvalTarget?.vehicleId)?.ownership === 'Rented' ? (
                    <>
                      <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Rented Driver Info (Optional)</Label>
                      <Input 
                        placeholder="Name / Phone..." 
                        className="h-11 font-bold text-sm rounded-sm"
                        value={approvalTarget?.rentedDriverDetails || ""}
                        onChange={(e) => setApprovalState(prev => prev ? { ...prev, rentedDriverDetails: e.target.value } : null)}
                      />
                      <p className="text-[9px] text-muted-foreground italic font-medium">External driver — No system selection required.</p>
                    </>
                  ) : (
                    <>
                      <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Assign System Driver</Label>
                      <Select 
                        disabled={!approvalTarget?.vehicleId}
                        value={approvalTarget?.driverId}
                        onValueChange={(val) => setApprovalState(prev => prev ? { ...prev, driverId: val } : null)}
                      >
                        <SelectTrigger className="rounded-sm border-primary/20 h-11 font-bold text-sm bg-muted/5">
                          <SelectValue placeholder="Designate Driver..." />
                        </SelectTrigger>
                        <SelectContent>
                          {driversList.map(d => (
                            <SelectItem key={d.id} value={d.id} className="text-xs font-bold">{d.username}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-4 bg-muted/5 border-t gap-3 shrink-0 flex-col sm:flex-row">
            <DialogClose asChild><Button variant="outline" className="w-full sm:flex-1 h-11 rounded-sm font-black uppercase text-[10px] tracking-widest">Cancel</Button></DialogClose>
            <Button 
              onClick={handleApprove} 
              className="w-full sm:flex-1 h-11 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-xl bg-primary hover:bg-primary/90" 
              disabled={!approvalTarget?.vehicleId || !approvalTarget?.driverId}
            >
              Confirm Allotment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsAssignment} onOpenChange={(o) => !o && handleCloseDetail()}>
        <DialogContent className="max-w-3xl w-[98vw] h-[92vh] sm:h-[95vh] p-0 overflow-hidden border-none rounded-sm shadow-2xl bg-background">
          <DialogHeader className="p-4 sm:p-6 bg-primary/5 border-b shrink-0 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-sm"><MapPinned className="h-5 w-5 text-primary" /></div>
              <div>
                <DialogTitle className="text-base sm:text-xl font-black uppercase tracking-tight">Trip Audit Log</DialogTitle>
                <DialogDescription className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Request ID: {detailsAssignment?.id.slice(0, 8)}</DialogDescription>
              </div>
            </div>
            {detailsAssignment && (
              <Badge variant="outline" className={cn(
                "text-[8px] sm:text-[9px] font-black uppercase rounded-sm px-1.5 sm:px-2 h-5 sm:h-6",
                detailsAssignment.status === 'Completed' ? "bg-green-100 text-green-800" : 
                detailsAssignment.status === 'Ongoing' ? "bg-primary text-white border-none" : "bg-muted"
              )}>
                {detailsAssignment.status}
              </Badge>
            )}
          </DialogHeader>

          <ScrollArea className="flex-1">
            {detailsAssignment && (
              <div className="p-4 sm:p-8 space-y-10 sm:space-y-12 text-left">
                <section className="space-y-6">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <Navigation className="h-4 w-4 text-primary" />
                    <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-foreground">Trip Itinerary</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6 relative border-l-2 border-primary/10 ml-3 pl-6">
                      <div className="relative">
                        <div className="absolute -left-[31px] top-0 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-background" />
                        <p className="text-[9px] font-black uppercase text-emerald-700 tracking-tighter">Pickup Location</p>
                        <p className="text-sm font-black">{detailsAssignment.pickupLocation}</p>
                        <Badge variant="secondary" className="mt-1 text-[8px] h-4 rounded-sm px-1.5 font-bold uppercase">{detailsAssignment.pickupType}</Badge>
                      </div>
                      {detailsAssignment.destinations.map((dest, idx) => (
                        <div key={idx} className="relative">
                          <div className="absolute -left-[31px] top-0 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                          <p className="text-[9px] font-black uppercase text-primary tracking-tighter">
                            {idx === detailsAssignment.destinations.length - 1 ? 'Final Drop' : `Stop #${idx + 1}`}
                          </p>
                          <p className="text-sm font-black">{dest.location}</p>
                          <p className="text-[10px] font-medium italic text-muted-foreground">"{dest.purpose}"</p>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-4">
                      <div className="p-4 bg-muted/20 border rounded-sm space-y-3">
                        <div className="flex justify-between items-center text-[9px] sm:text-[10px] font-black uppercase text-muted-foreground">
                          <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Trip Date</span>
                          <span className="text-foreground">{detailsAssignment.tripDate}</span>
                        </div>
                        <Separator className="opacity-50" />
                        <div className="flex justify-between items-center text-[9px] sm:text-[10px] font-black uppercase text-muted-foreground">
                          <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> Reporting</span>
                          <span className="text-foreground">{detailsAssignment.reportingTime}</span>
                        </div>
                      </div>
                      <div className="p-4 bg-primary/[0.02] border border-primary/10 rounded-sm">
                        <Label className="text-[9px] font-black uppercase text-primary tracking-widest block mb-2">Trip Purpose</Label>
                        <p className="text-xs font-medium italic text-foreground/80 leading-relaxed">"{detailsAssignment.purpose}"</p>
                      </div>
                    </div>
                  </div>
                </section>
                <section className="space-y-6">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <HardHat className="h-4 w-4 text-primary" />
                    <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-foreground">Fleet & Personnel</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-sm bg-primary/10 flex items-center justify-center text-primary shrink-0"><UserCircle2 className="h-6 w-6" /></div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Requester</span>
                          <span className="text-sm font-black truncate">{detailsAssignment.userName}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-sm bg-muted flex items-center justify-center text-muted-foreground shrink-0"><UserCog className="h-6 w-6" /></div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Assigned Driver</span>
                          <span className="text-sm font-black truncate">{detailsAssignment.driverName || '—'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-sm bg-primary/5 border border-primary/10 flex items-center justify-center text-primary font-black text-xs shrink-0">V</div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Resource</span>
                          <span className="text-sm font-black uppercase truncate">{detailsAssignment.vehicleDetails || 'Allotment Pending'}</span>
                        </div>
                      </div>
                      {detailsAssignment.coPassengers && detailsAssignment.coPassengers.length > 0 && (
                        <div className="p-3 bg-muted/10 border rounded-sm">
                          <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-2">Co-passengers ({detailsAssignment.coPassengers.length})</span>
                          <div className="flex flex-wrap gap-1.5">
                            {detailsAssignment.coPassengers.map((p, i) => (
                              <Badge key={i} variant="outline" className="text-[8px] rounded-full px-2 h-4 border-primary/10 bg-background">{p.name}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
                {(detailsAssignment.status === 'Ongoing' || detailsAssignment.status === 'Completed') && (
                  <section className="space-y-6 pb-10">
                    <div className="flex items-center gap-2 border-b pb-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-foreground">Digital Audit Proof</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                          <PlayCircle className="h-3 w-3" /> Start Verification
                        </Label>
                        <div className="bg-muted/20 border rounded-sm p-4 space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">Odometer Reading</span>
                            <span className="text-lg font-black text-primary font-mono">{detailsAssignment.startReading} KM</span>
                          </div>
                          {detailsAssignment.startReadingPhoto && (
                            <div className="relative aspect-video rounded-sm overflow-hidden border-2 border-primary/5 shadow-md group">
                              <img src={detailsAssignment.startReadingPhoto} className="w-full h-full object-cover" alt="Start Proof" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Maximize2 className="h-6 w-6 text-white" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      {detailsAssignment.status === 'Completed' && (
                        <div className="space-y-4">
                          <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                            <Flag className="h-3 w-3" /> Conclusion Audit
                          </Label>
                          <div className="bg-emerald-50/50 border border-emerald-100 rounded-sm p-4 space-y-4">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold uppercase text-emerald-700">Final Reading</span>
                              <span className="text-lg font-black text-emerald-900 font-mono">{detailsAssignment.endReading} KM</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-emerald-100">
                              <span className="text-[10px] font-bold uppercase text-emerald-700">Total Distance</span>
                              <span className="text-sm font-black text-emerald-900">
                                {((detailsAssignment.endReading || 0) - (detailsAssignment.startReading || 0)).toFixed(1)} KM
                              </span>
                            </div>
                            {detailsAssignment.endReadingPhoto && (
                              <div className="relative aspect-video rounded-sm overflow-hidden border-2 border-emerald-100 shadow-md group">
                                <img src={detailsAssignment.endReadingPhoto} className="w-full h-full object-cover" alt="End Proof" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <Maximize2 className="h-6 w-6 text-white" />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="p-4 bg-muted/5 border-t gap-3 shrink-0 flex-col sm:flex-row">
            {detailsAssignment && (
              <Button 
                variant="outline" 
                className="w-full sm:mr-auto sm:w-auto h-11 rounded-sm font-black uppercase text-[10px] tracking-widest text-green-700 border-green-200 hover:bg-green-50"
                onClick={() => handleWhatsAppShare(detailsAssignment)}
              >
                <MessageCircle className="h-4 w-4 mr-1.5" /> Share WA
              </Button>
            )}
            <DialogClose asChild><Button variant="outline" className="w-full sm:w-auto rounded-sm font-black uppercase text-[10px] h-11 px-8 tracking-widest">Close Audit</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent className="rounded-sm max-w-md w-[95vw]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive font-black uppercase tracking-tight">
              <CircleX className="h-5 w-5" /> Confirm Cancellation
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium leading-relaxed text-left">
              Revoke this trip request? If a vehicle was alloted, it will be returned to the available pool.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 flex-col sm:flex-row">
            <AlertDialogCancel className="rounded-sm font-bold uppercase text-[10px] h-11">Back</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmCancel} 
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-sm font-black uppercase text-[10px] h-11 shadow-lg"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Cancellation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!releaseTarget} onOpenChange={(o) => !o && setReleaseTarget(null)}>
        <AlertDialogContent className="rounded-sm max-w-md w-[95vw]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-700 font-black uppercase tracking-tight">
              <RotateCcw className="h-5 w-5" /> Manual Fleet Release
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium leading-relaxed text-left text-foreground/80">
              Force-release <strong>{releaseTarget?.plateNumber}</strong>? <br/><br/>
              This will <strong>reject any active allotments or ongoing trips</strong> for this vehicle and return it to the Available pool instantly. Use this only for administrative correction.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 flex-col sm:flex-row">
            <AlertDialogCancel className="rounded-sm font-bold uppercase text-[10px] h-11">Back</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleMarkAvailable} 
              disabled={isProcessing}
              className="bg-amber-600 text-white hover:bg-amber-700 rounded-sm font-black uppercase text-[10px] h-11 shadow-lg border-none"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Force Release Asset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, color }: { title: string, value: number, icon: any, color: 'primary' | 'emerald' | 'blue' | 'amber' }) {
  const colors = {
    primary: "bg-primary/5 border-primary/10 text-primary",
    emerald: "bg-emerald-500/5 border-emerald-500/10 text-emerald-600",
    blue: "bg-blue-500/5 border-blue-500/10 text-blue-600",
    amber: "bg-amber-500/5 border-amber-500/10 text-amber-600",
  };

  return (
    <Card className={cn("rounded-sm border shadow-sm", colors[color])}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4">
        <CardTitle className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
        <Icon className="h-3.5 sm:h-4 sm:w-4" />
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0">
        <div className="text-xl sm:text-2xl font-black">{value}</div>
      </CardContent>
    </Card>
  );
}
