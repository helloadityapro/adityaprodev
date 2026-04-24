'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, orderBy, where, or, and, getDocs, writeBatch, serverTimestamp, arrayUnion } from 'firebase/firestore';
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
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  IndianRupee,
  PieChart
} from 'lucide-react';
import { format, parse, subDays, subMonths, subYears, startOfDay, endOfDay } from 'date-fns';
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

const DISPLAYED_NOTIFS_KEY = 'displayedNotifIds';

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

  const [dateFilter, setDateFilter] = React.useState<string>("7days");
  const [customStart, setCustomStart] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  
  // Viewer States
  const [viewUrl, setViewUrl] = React.useState<string | null>(null);
  const [viewUrls, setViewUrls] = React.useState<string[]>([]);
  const [currentUrlIndex, setCurrentUrlIndex] = React.useState(0);
  const [zoom, setZoom] = React.useState(1);
  const viewerRef = React.useRef<HTMLDivElement>(null);

  const [approvalTarget, setApprovalState] = React.useState<{ assignment: Assignment, vehicleId: string, driverId: string, rentedDriverDetails: string } | null>(null);
  const [detailsAssignment, setDetailsAssignment] = React.useState<Assignment | null>(null);
  const [editingAssignment, setEditingAssignment] = React.useState<Assignment | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<Assignment | null>(null);
  const [forceEndTarget, setForceEndTarget] = React.useState<Assignment | null>(null);
  const [forceEndReading, setForceEndReading] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isScheduledTripsOpen, setIsScheduledTripsOpen] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<AccessConfig>(roleConfigsQuery);
  
  const isSuper = isSuperAdmin(user?.email);
  const isAdmin = isSuper || userProfile?.role === "Admin";
  const isManager = userProfile?.role === "Site Manager";
  const isHR = userProfile?.role === 'Manager - Human Resources';
  const userRoleStr = isAdmin ? 'admin' : (userProfile?.role ? slugifyRole(userProfile.role) : 'site-engineer');

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

  const queryDateRange = React.useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    
    switch (dateFilter) {
      case 'today': return { start: todayStr, end: todayStr };
      case 'yesterday': return { start: format(subDays(today, 1), 'yyyy-MM-dd'), end: format(subDays(today, 1), 'yyyy-MM-dd') };
      case '7days': return { start: format(subDays(today, 7), 'yyyy-MM-dd'), end: todayStr };
      case 'lastMonth': return { start: format(subMonths(today, 1), 'yyyy-MM-dd'), end: todayStr };
      case 'lastYear': return { start: format(subYears(today, 1), 'yyyy-MM-dd'), end: todayStr };
      case 'allTime': return { start: '1970-01-01', end: '2099-12-31' };
      case 'custom': return { start: customStart, end: customEnd };
      default: return { start: format(subDays(today, 7), 'yyyy-MM-dd'), end: todayStr };
    }
  }, [dateFilter, customStart, customEnd]);

  const filteredAssignments = React.useMemo(() => {
    if (!assignments || !userProfile) return [];
    
    const { start, end } = queryDateRange;
    const isOwnDataOnly = userProfile.ownDataOnly !== undefined 
      ? userProfile.ownDataOnly 
      : roleConfigs?.find(c => c.id === userRoleStr)?.ownDataOnly ?? false;

    let result = assignments;

    if (isOwnDataOnly && !isSuper) {
      const assignedIds = new Set(userProfile.assignedProjectIds || []);
      result = result.filter(trip => {
        if (trip.siteId) return assignedIds.has(trip.siteId);
        return true; 
      });
    }

    return result.filter(trip => {
      // Filter by Requested Date as per requirements
      const rDate = trip.requestDate?.toDate?.() || new Date(trip.requestDate);
      const rDateStr = format(rDate, 'yyyy-MM-dd');
      const matchesDate = rDateStr >= start && rDateStr <= end;

      const matchesSearch = trip.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trip.pickupLocation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (trip.vehicleDetails || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (trip.driverName || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || trip.status === statusFilter;
      const isQueue = activeTab === 'queue' ? trip.status === 'Pending' : true;
      
      return matchesSearch && matchesStatus && isQueue && matchesDate;
    }).sort((a, b) => {
      const dateA = a.requestDate?.toDate?.()?.getTime() || 0;
      const dateB = b.requestDate?.toDate?.()?.getTime() || 0;
      return dateB - dateA;
    });
  }, [assignments, searchTerm, statusFilter, activeTab, userProfile, roleConfigs, isSuper, userRoleStr, queryDateRange]);

  const stats = React.useMemo(() => {
    if (!assignments) return { total: 0, pending: 0, ongoing: 0, completed: 0 };
    return {
      total: assignments.length,
      pending: assignments.filter(a => a.status === 'Pending').length,
      ongoing: assignments.filter(a => a.status === 'Ongoing').length,
      completed: assignments.filter(a => a.status === 'Completed').length,
    };
  }, [assignments]);

  const availableVehiclesForAllotment = React.useMemo(() => {
    if (!vehicles) return [];
    const base = vehicles.filter(v => v.status === 'Available');
    if (approvalTarget?.assignment?.vehicleId) {
      const currentV = vehicles.find(v => v.id === approvalTarget.assignment.vehicleId);
      if (currentV && !base.find(v => v.id === currentV.id)) {
        base.push(currentV);
      }
    }
    return base;
  }, [vehicles, approvalTarget]);

  const handleGlobalWhatsAppShare = (trip: Assignment) => {
    let header = "";
    let body = "";
    const tripUrl = `${window.location.origin}/vehicles/trips/manage?view=${trip.id}`;
    
    const driverObj = allUsers?.find(u => u.id === trip.driverId);
    const driverDisplay = trip.driverName 
      ? `${driverObj?.mobile ? `(${driverObj.mobile}) ` : ""}${trip.driverName}` 
      : 'Pending Allotment';

    switch (trip.status) {
      case 'Pending':
        header = "\u{1F6A8} *AdityaPro - New Vehicle Request*";
        body = `*Requester:* ${(trip.userName || '').trim()}\n*Trip Date:* ${trip.tripDate}\n*Pickup:* ${trip.pickupLocation}\n*Drop:* ${trip.dropLocation || trip.destinations[trip.destinations.length - 1]?.location}\n*Purpose:* ${trip.purpose}`;
        break;
      case 'Approved':
        header = "\u{2705} *AdityaPro - Vehicle Allotted*";
        body = `*Requester:* ${(trip.userName || '').trim()}\n*Vehicle:* ${trip.vehicleDetails}\n*Driver:* ${driverDisplay}\n*Ownership:* ${trip.vehicleOwnership}\n*Trip Date:* ${trip.tripDate}\n*Ready for departure.*`;
        break;
      case 'Ongoing':
        header = "\u{1F6A6} *AdityaPro - Trip Ongoing*";
        body = `*Vehicle:* ${trip.vehicleDetails}\n*Driver:* ${driverDisplay}\n*Started At:* ${trip.startTime ? format(trip.startTime.toDate(), 'HH:mm') : 'N/A'}\n*Current Route:* ${trip.pickupLocation} \u{2794} ${trip.dropLocation}`;
        break;
      case 'Completed':
        const distance = (trip.endReading || 0) - (trip.startReading || 0);
        header = "\u{1F3C1} *AdityaPro - Trip Completed*";
        body = `*Vehicle:* ${trip.vehicleDetails}\n*Personnel:* ${trip.userName}\n*Distance:* ${distance.toFixed(1)} KM\n*Finished At:* ${trip.endTime ? format(trip.endTime.toDate(), 'HH:mm') : 'N/A'}`;
        break;
      case 'Rejected':
        header = "\u{274C} *AdityaPro - Trip Cancelled*";
        body = `*Request Ref:* ${trip.id.slice(0, 8)}\n*Requester:* ${trip.userName}\n*Site:* ${trip.pickupLocation}\n*The trip request has been revoked.*`;
        break;
      default:
        header = "\u{2139}\u{FE0F} *AdityaPro - Trip Update*";
        body = `*Status:* ${trip.status}\n*Site:* ${trip.pickupLocation}`;
    }

    const message = `${header}\n\n${body}\n\n*View Audit Log:* ${tripUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
  };

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
      const oldVehicleId = assignment.vehicleId;

      updateDocumentNonBlocking(doc(firestore, 'vehicle_assignments', assignment.id), {
        status: 'Approved',
        vehicleId,
        vehicleDetails: `${vehicle?.make} ${vehicle?.model} (${vehicle?.plateNumber})`,
        vehicleOwnership: vehicle?.ownership || 'Owned',
        driverId: finalDriverId,
        driverName: finalDriverName,
        approvalDate: serverTimestamp(),
      });

      if (oldVehicleId && oldVehicleId !== vehicleId) {
        updateDocumentNonBlocking(doc(firestore, 'vehicles', oldVehicleId), { status: 'Available' });
      }
      updateDocumentNonBlocking(doc(firestore, 'vehicles', vehicleId), { status: 'Allotted' });

      sendNotification(firestore, {
        userId: assignment.userId,
        title: "Vehicle Allotted",
        description: `Your trip request for ${assignment.tripDate} has been authorized. Vehicle: ${vehicle?.plateNumber}.`,
        link: `/vehicles/trips/manage?view=${assignment.id}`,
        push: true
      });

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

  const handleForceEnd = async () => {
    if (!forceEndTarget) return;
    setIsProcessing(true);

    try {
      const readingValue = forceEndReading.trim() !== "" ? parseFloat(forceEndReading) : null;
      
      const updateData: any = {
        status: 'Completed',
        endTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
        adminRemarks: `Trip force-ended by ${userProfile?.username || 'Admin'}.`
      };

      if (readingValue !== null && !isNaN(readingValue)) {
        updateData.endReading = readingValue;
      }

      updateDocumentNonBlocking(doc(firestore, 'vehicle_assignments', forceEndTarget.id), updateData);

      if (forceEndTarget.vehicleId) {
        const vehicleUpdate: any = {
          status: 'Available',
          updatedAt: serverTimestamp()
        };
        if (readingValue !== null && !isNaN(readingValue)) {
          vehicleUpdate.currentReading = readingValue;
        }
        updateDocumentNonBlocking(doc(firestore, 'vehicles', forceEndTarget.vehicleId), vehicleUpdate);
      }

      toast({ title: 'Trip Terminated', description: 'The journey has been closed and the vehicle released.' });
      setForceEndTarget(null);
      setForceEndReading("");
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveEdit = async (values: z.infer<typeof editRequestSchema>) => {
    if (!editingAssignment) return;
    try {
      const combinedDestinations = [
        ...values.intermediateStops,
        { type: values.dropType, location: values.dropLocation, purpose: 'Final Destination' }
      ];

      const assignmentRef = doc(firestore, 'vehicle_assignments', editingAssignment.id);
      updateDocumentNonBlocking(assignmentRef, {
        ...values,
        destinations: combinedDestinations,
        updatedAt: serverTimestamp(),
      });

      toast({ title: 'Request Updated', description: 'Trip details have been modified.' });
      setEditingAssignment(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
    }
  };

  const handleCloseDetail = () => {
    setDetailsAssignment(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('view');
    router.replace(`${pathname}?${params.toString()}`);
  };

  const openViewer = (url: string, trip: Assignment) => {
    const urls = [trip.startReadingPhoto, trip.endReadingPhoto].filter(Boolean) as string[];
    const index = urls.indexOf(url);
    setViewUrls(urls);
    setCurrentUrlIndex(index >= 0 ? index : 0);
    setViewUrl(url);
    setZoom(1);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setDateFilter("7days");
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
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
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        <SummaryCard title="Logs Found" value={stats.total} icon={History} color="primary" />
        <SummaryCard title="Awaiting Allotment" value={stats.pending} icon={AlertCircle} color="amber" />
        <SummaryCard title="Active Journeys" value={stats.ongoing} icon={Timer} color="blue" />
        <SummaryCard title="Completed" value={stats.completed} icon={CheckCircle2} color="emerald" />
      </div>

      <div className="flex flex-col gap-4 bg-card p-3 md:p-4 border border-primary/10 rounded-sm shadow-sm no-print">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Search Logs (Filters by Request Date)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search personnel, plate, site..." 
                className="pl-10 h-11 rounded-sm bg-background border-primary/10 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Request Window</Label>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="h-11 rounded-sm border-primary/20 bg-background font-bold text-xs uppercase">
                <Calendar className="h-4 w-4 mr-2 opacity-50" />
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today" className="text-xs font-bold uppercase">Today</SelectItem>
                <SelectItem value="yesterday" className="text-xs font-bold uppercase">Yesterday</SelectItem>
                <SelectItem value="7days" className="text-xs font-bold uppercase">Last 7 Days</SelectItem>
                <SelectItem value="lastMonth" className="text-xs font-bold uppercase">Last Month</SelectItem>
                <SelectItem value="lastYear" className="text-xs font-bold uppercase">Last Year</SelectItem>
                <SelectItem value="allTime" className="text-xs font-bold uppercase">All Time</SelectItem>
                <SelectItem value="custom" className="text-xs font-bold uppercase text-primary">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            {dateFilter === 'custom' ? (
              <div className="flex-1 flex gap-2 animate-in fade-in zoom-in-95 duration-200">
                <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-11 rounded-sm border-primary/20 text-xs" />
                <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-11 rounded-sm border-primary/20 text-xs" />
              </div>
            ) : (
              <div className="flex-1" />
            )}
            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-sm text-muted-foreground border border-transparent hover:border-primary/10" onClick={clearFilters}>
              <FilterX className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
            <TabsList className="bg-muted/50 border border-primary/10 rounded-sm p-1 h-10">
              <TabsTrigger value="registry" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-4 sm:px-6 h-8">Trip History</TabsTrigger>
              {(isAdmin || isManager) && (
                <TabsTrigger value="queue" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-4 sm:px-6 h-8 relative">
                  Allotment Queue
                  {stats.pending > 0 && <Badge className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center p-0 rounded-full bg-red-500 text-[10px] font-black">{stats.pending}</Badge>}
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9 text-[10px] font-bold uppercase tracking-tight rounded-sm border-primary/20">
                <SelectValue placeholder="Status Filter" />
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
      </div>

      <div className="mt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsContent value="registry" className="animate-in fade-in-50 duration-300 m-0">
            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {filteredAssignments.length > 0 ? filteredAssignments.map((trip) => (
                <TripMobileCard 
                  key={trip.id} 
                  trip={trip} 
                  user={user} 
                  isAdmin={isAdmin} 
                  isHR={isHR} 
                  isManager={isManager}
                  allUsers={allUsers}
                  onDetails={setDetailsAssignment}
                  onEdit={setEditingAssignment}
                  onCancel={setCancelTarget}
                  onForceEnd={setForceEndTarget}
                  onAllot={setApprovalState}
                  onWhatsApp={handleGlobalWhatsAppShare}
                />
              )) : (
                <div className="text-center py-12 text-muted-foreground italic text-xs bg-card border border-dashed rounded-sm">No trip records found for this period.</div>
              )}
            </div>

            {/* Desktop Table View */}
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
                          <TableHead className="text-right px-6 min-w-[220px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAssignments.length > 0 ? filteredAssignments.map((trip) => (
                          <TripTableRow 
                            key={trip.id} 
                            trip={trip} 
                            user={user} 
                            isAdmin={isAdmin} 
                            isHR={isHR} 
                            isManager={isManager}
                            allUsers={allUsers}
                            onDetails={setDetailsAssignment}
                            onEdit={setEditingAssignment}
                            onCancel={setCancelTarget}
                            onForceEnd={setForceEndTarget}
                            onAllot={setApprovalState}
                            onWhatsApp={handleGlobalWhatsAppShare}
                          />
                        )) : (
                          <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic text-xs">No records found for this period.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="queue" className="animate-in fade-in-50 duration-300 m-0">
            <div className="md:hidden space-y-4">
              {filteredAssignments.filter(a => a.status === 'Pending').length > 0 ? filteredAssignments.filter(a => a.status === 'Pending').map((trip) => (
                <TripMobileCard 
                  key={trip.id} 
                  trip={trip} 
                  user={user} 
                  isAdmin={isAdmin} 
                  isHR={isHR} 
                  isManager={isManager}
                  allUsers={allUsers}
                  onDetails={setDetailsAssignment}
                  onEdit={setEditingAssignment}
                  onCancel={setCancelTarget}
                  onForceEnd={setForceEndTarget}
                  onAllot={setApprovalState}
                  onWhatsApp={handleGlobalWhatsAppShare}
                />
              )) : (
                <div className="text-center py-12 text-muted-foreground italic text-xs bg-card border border-dashed rounded-sm">Queue empty for this period.</div>
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
                          <TableHead>Request Date</TableHead>
                          <TableHead className="text-right px-6 min-w-[220px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAssignments.filter(a => a.status === 'Pending').length > 0 ? (
                          filteredAssignments.filter(a => a.status === 'Pending').map((trip) => (
                            <TripTableRow 
                              key={trip.id} 
                              trip={trip} 
                              user={user} 
                              isAdmin={isAdmin} 
                              isHR={isHR} 
                              isManager={isManager}
                              allUsers={allUsers}
                              onDetails={setDetailsAssignment}
                              onEdit={setEditingAssignment}
                              onCancel={setCancelTarget}
                              onForceEnd={setForceEndTarget}
                              onAllot={setApprovalState}
                              onWhatsApp={handleGlobalWhatsAppShare}
                              isQueueView
                            />
                          ))
                        ) : (
                          <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic text-xs">Queue empty for this period.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <EditTripDialog assignment={editingAssignment} open={!!editingAssignment} onOpenChange={(o) => !o && setEditingAssignment(null)} sites={sites || []} allUsers={allUsers || []} onSave={handleSaveEdit} />
      <ScheduledTripsDialog assignments={assignments || []} allUsers={allUsers || []} open={isScheduledTripsOpen} onOpenChange={setIsScheduledTripsOpen} />

      <Dialog open={!!approvalTarget} onOpenChange={(o) => !o && setApprovalState(null)}>
        <DialogContent className="max-w-xl w-[95vw] p-0 overflow-hidden border-none rounded-sm shadow-2xl bg-background flex flex-col h-[80vh] sm:h-auto max-h-[90vh]">
          <DialogHeader className="p-6 bg-primary/5 border-b shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-sm"><Fuel className="h-5 w-5 text-primary" /></div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Authorize Trip Allotment</DialogTitle>
                <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Requester: {approvalTarget?.assignment?.userName}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8 text-left">
              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-2"><MapPin className="h-3 w-3" /> Logged Route Itinerary</Label>
                <div className="bg-muted/20 border rounded-sm p-4 space-y-4">
                  <div className="relative pl-6 border-l-2 border-emerald-500 pb-2"><div className="absolute -left-[7px] top-0 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-background" /><p className="text-[9px] font-black uppercase text-emerald-700 tracking-tighter">Pickup</p><p className="text-sm font-black">{approvalTarget?.assignment.pickupLocation}</p></div>
                  {approvalTarget?.assignment.intermediateStops?.map((d, i) => (<div key={i} className="relative pl-6 border-l-2 border-primary pb-2"><div className="absolute -left-[7px] top-0 h-3 w-3 rounded-full bg-primary ring-4 ring-background" /><p className="text-[9px] font-black uppercase text-primary tracking-tighter">Stop #{i + 1}</p><p className="text-sm font-black">{d.location}</p></div>))}
                  <div className="relative pl-6 border-l-2 border-emerald-500"><div className="absolute -left-[7px] top-0 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-background" /><p className="text-[9px] font-black uppercase text-emerald-700 tracking-tighter">Final Drop</p><p className="text-sm font-black">{approvalTarget?.assignment.dropLocation}</p></div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Select Fleet Vehicle</Label>
                  <Select onValueChange={(val) => { const v = vehicles?.find(x => x.id === val); setApprovalState(prev => prev ? { ...prev, vehicleId: val, driverId: v?.ownership === 'Rented' ? 'RENTED' : '' } : null); }} value={approvalTarget?.vehicleId}>
                    <SelectTrigger className="rounded-sm border-primary/20 h-11 font-bold text-sm bg-muted/5"><SelectValue placeholder="Allot Vehicle..." /></SelectTrigger>
                    <SelectContent>{availableVehiclesForAllotment.map(v => (<SelectItem key={v.id} value={v.id} className="text-xs font-bold">{v.make} {v.model} ({v.plateNumber})</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  {vehicles?.find(v => v.id === approvalTarget?.vehicleId)?.ownership === 'Rented' ? (
                    <><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Rented Driver Info</Label><Input placeholder="Name / Phone..." className="h-11 font-bold text-sm rounded-sm" value={approvalTarget?.rentedDriverDetails || ""} onChange={(e) => setApprovalState(prev => prev ? { ...prev, rentedDriverDetails: e.target.value } : null)} /></>
                  ) : (
                    <><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Assign System Driver</Label><Select disabled={!approvalTarget?.vehicleId} value={approvalTarget?.driverId} onValueChange={(val) => setApprovalState(prev => prev ? { ...prev, driverId: val } : null)}><SelectTrigger className="rounded-sm border-primary/20 h-11 font-bold text-sm bg-muted/5"><SelectValue placeholder="Designate Driver..." /></SelectTrigger><SelectContent>{driversList.map(d => (<SelectItem key={d.id} value={d.id} className="text-xs font-bold">{d.username}</SelectItem>))}</SelectContent></Select></>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 bg-muted/5 border-t gap-3 shrink-0 flex flex-col sm:flex-row">
            <DialogClose asChild><Button variant="outline" className="w-full sm:flex-1 h-11 rounded-sm font-black uppercase text-[10px] tracking-widest">Cancel</Button></DialogClose>
            <Button onClick={handleApprove} className="w-full sm:flex-1 h-11 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-xl" disabled={!approvalTarget?.vehicleId || !approvalTarget?.driverId}>Confirm Allotment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsAssignment} onOpenChange={(o) => !o && handleCloseDetail()}>
        <DialogContent className="max-w-3xl w-[98vw] h-[95vh] p-0 overflow-hidden border-none rounded-sm shadow-2xl bg-background flex flex-col">
          <DialogHeader className="p-4 sm:p-6 bg-primary/5 border-b shrink-0 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3"><div className="bg-primary/10 p-2 rounded-sm"><MapPinned className="h-5 w-5 text-primary" /></div><div><DialogTitle className="text-base sm:text-xl font-black uppercase tracking-tight">Trip Audit Log</DialogTitle><DialogDescription className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">ID: {detailsAssignment?.id.slice(0, 8)}</DialogDescription></div></div>
            {detailsAssignment && <Badge variant="outline" className={cn("text-[8px] sm:text-[9px] font-black uppercase rounded-sm px-1.5 h-5 sm:h-6", detailsAssignment.status === 'Completed' ? "bg-green-100 text-green-800" : detailsAssignment.status === 'Ongoing' ? "bg-primary text-white border-none" : "bg-muted")}>{detailsAssignment.status}</Badge>}
          </DialogHeader>
          <ScrollArea className="flex-1 p-4 sm:p-8 space-y-10 sm:space-y-12">
            {detailsAssignment && (
              <>
                <section className="space-y-6">
                  <div className="flex items-center gap-2 border-b pb-2"><Navigation className="h-4 w-4 text-primary" /><h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em]">Itinerary</h3></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6 relative border-l-2 border-primary/10 ml-3 pl-6">
                      <div className="relative"><div className="absolute -left-[31px] top-0 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-background" /><p className="text-[9px] font-black uppercase text-emerald-700 tracking-tighter">Pickup</p><p className="text-sm font-black">{detailsAssignment.pickupLocation}</p></div>
                      {detailsAssignment.intermediateStops?.map((dest, idx) => (<div key={idx} className="relative"><div className="absolute -left-[31px] top-0 h-3 w-3 rounded-full bg-primary ring-4 ring-background" /><p className="text-[9px] font-black uppercase text-primary tracking-tighter">Stop #{idx + 1}</p><p className="text-sm font-black">{dest.location}</p></div>))}
                      <div className="relative"><div className="absolute -left-[31px] top-0 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-background" /><p className="text-[9px] font-black uppercase text-emerald-700 tracking-tighter">Final Drop</p><p className="text-sm font-black">{detailsAssignment.dropLocation}</p></div>
                    </div>
                    <div className="space-y-4">
                      <div className="p-4 bg-muted/20 border rounded-sm space-y-3"><div className="flex justify-between items-center text-[9px] font-black uppercase text-muted-foreground"><span>Date</span><span className="text-foreground">{detailsAssignment.tripDate}</span></div><Separator className="opacity-50" /><div className="flex justify-between items-center text-[9px] font-black uppercase text-muted-foreground"><span>Reporting</span><span className="text-foreground">{detailsAssignment.reportingTime}</span></div></div>
                      <div className="p-4 bg-primary/[0.02] border border-primary/10 rounded-sm"><Label className="text-[9px] font-black uppercase text-primary tracking-widest block mb-2">Purpose</Label><p className="text-xs font-medium italic text-foreground/80 leading-relaxed">"{detailsAssignment.purpose}"</p></div>
                    </div>
                  </div>
                </section>

                <section className="space-y-6">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <Users className="h-4 w-4 text-primary" />
                    <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em]">Personnel & Fleet Audit</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Fleet Assignment</Label>
                      <div className="p-4 bg-muted/20 border rounded-sm space-y-3">
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="uppercase text-muted-foreground">Vehicle</span>
                          <div className="flex items-center gap-2">
                            <span className="text-foreground">{detailsAssignment.vehicleDetails || 'Pending Allotment'}</span>
                            {detailsAssignment.vehicleOwnership && (
                              <Badge variant="outline" className="text-[8px] h-4 px-1 text-primary border-primary/20 font-black uppercase">{detailsAssignment.vehicleOwnership}</Badge>
                            )}
                          </div>
                        </div>
                        <Separator className="opacity-50" />
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="uppercase text-muted-foreground">Driver</span>
                          <span className="text-foreground">{detailsAssignment.driverName || 'Pending Allotment'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Co-passengers</Label>
                      <div className="min-h-[80px] p-4 bg-muted/20 border rounded-sm flex flex-wrap gap-2 items-start content-start">
                        {detailsAssignment.coPassengers && detailsAssignment.coPassengers.length > 0 ? (
                          detailsAssignment.coPassengers.map((p, pIdx) => (
                            <Badge key={pIdx} variant="secondary" className="rounded-sm font-bold text-[10px] bg-background border border-primary/5">
                              <User className="h-2.5 w-2.5 mr-1 text-primary/60" /> {p.name}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-[10px] text-muted-foreground/40 italic font-bold uppercase w-full text-center mt-4">No co-passengers logged</p>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {(detailsAssignment.status === 'Ongoing' || detailsAssignment.status === 'Completed') && (
                  <section className="space-y-6">
                    <div className="flex items-center gap-2 border-b pb-2"><ShieldCheck className="h-4 w-4 text-primary" /><h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em]">Digital Audit Proof</h3></div>
                    
                    {detailsAssignment.status === 'Completed' && (
                      <div className="p-4 bg-primary/5 border border-primary/10 rounded-sm flex items-center justify-between shadow-inner animate-in fade-in slide-in-from-top-1 duration-500">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Total Travelled Today</span>
                        </div>
                        <div className="text-xl font-black text-primary font-mono tabular-nums">
                          {((detailsAssignment.endReading || 0) - (detailsAssignment.startReading || 0)).toFixed(1)} <span className="text-[10px] uppercase font-bold text-muted-foreground ml-1">KM</span>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><PlayCircle className="h-3 w-3" /> Start</Label>
                        <div className="bg-muted/20 border rounded-sm p-4 space-y-4">
                          <div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase text-muted-foreground">Odometer</span><span className="text-lg font-black text-primary font-mono">{detailsAssignment.startReading} KM</span></div>
                          {detailsAssignment.startReadingPhoto && (<div className="relative aspect-video rounded-sm overflow-hidden border cursor-pointer" onClick={() => openViewer(detailsAssignment.startReadingPhoto!, detailsAssignment)}><img src={detailsAssignment.startReadingPhoto} className="w-full h-full object-cover" alt="Start" /></div>)}
                        </div>
                      </div>
                      {detailsAssignment.status === 'Completed' && (
                        <div className="space-y-4">
                          <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Flag className="h-3 w-3" /> Conclusion</Label>
                          <div className="bg-emerald-50/50 border border-emerald-100 rounded-sm p-4 space-y-4">
                            <div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase text-emerald-700">Final Reading</span><span className="text-lg font-black text-emerald-900 font-mono">{detailsAssignment.endReading} KM</span></div>
                            {detailsAssignment.endReadingPhoto && (<div className="relative aspect-video rounded-sm overflow-hidden border border-emerald-100 cursor-pointer" onClick={() => openViewer(detailsAssignment.endReadingPhoto!, detailsAssignment)}><img src={detailsAssignment.endReadingPhoto} className="w-full h-full object-cover" alt="End" /></div>)}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </>
            )}
          </ScrollArea>
          <DialogFooter className="p-3 sm:p-4 bg-muted/5 border-t gap-2 sm:gap-3 shrink-0 no-print"><DialogClose asChild><Button variant="outline" className="w-full sm:w-auto rounded-sm font-black uppercase text-[10px] h-11 px-8 tracking-widest">Close Audit</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewUrl} onOpenChange={(o) => { if(!o) { setZoom(1); setViewUrl(null); setViewUrls([]); } }}>
        <DialogContent className="max-w-[95vw] h-[90vh] p-0 border-none bg-black flex flex-col items-center justify-center rounded-sm overflow-hidden shadow-2xl">
          <div className="absolute top-4 left-4 flex gap-2 z-50"><Button variant="secondary" size="icon" className="h-10 w-10 rounded-full bg-white/10 text-white border-none" onClick={(e) => { e.stopPropagation(); setZoom(prev => Math.min(prev + 0.25, 4)); }}><ZoomIn className="h-4 w-4" /></Button><Button variant="secondary" size="icon" className="h-10 w-10 rounded-full bg-white/10 text-white border-none" onClick={(e) => { e.stopPropagation(); setZoom(prev => Math.max(prev - 0.25, 0.5)); }}><ZoomOut className="h-4 w-4" /></Button><Button variant="secondary" size="icon" className="h-10 w-10 rounded-full bg-white/10 text-white border-none" onClick={(e) => { e.stopPropagation(); setZoom(1); }}><RotateCcw className="h-5 w-5" /></Button></div>
          <div className="relative w-full h-full overflow-auto p-4 flex"><div ref={viewerRef} className={cn("m-auto transition-transform duration-200", zoom > 1 ? "cursor-move" : "cursor-default")} style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>{viewUrl && <img src={viewUrl} className="max-w-full max-h-[85vh] object-contain shadow-2xl" alt="Evidence" />}</div></div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent className="rounded-sm max-md w-[95vw]"><AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2 text-destructive font-black uppercase tracking-tight"><CircleX className="h-5 w-5" /> Confirm Cancellation</AlertDialogTitle><AlertDialogDescription className="text-sm font-medium">Revoke this trip request? This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-sm font-bold uppercase text-[10px] h-11">Back</AlertDialogCancel><AlertDialogAction onClick={handleConfirmCancel} disabled={isProcessing} className="bg-destructive text-white hover:bg-destructive/90 rounded-sm font-black uppercase text-[10px] h-11 shadow-lg">{isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Cancellation"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!forceEndTarget} onOpenChange={(o) => !o && setForceEndTarget(null)}>
        <AlertDialogContent className="rounded-sm max-md w-[95vw]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive font-black uppercase tracking-tight">
              <Flag className="h-5 w-5" /> Force End Journey
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium">
              You are terminating the trip for <strong>{forceEndTarget?.userName}</strong>. This will release the vehicle <strong>{forceEndTarget?.vehicleDetails}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-3 text-left">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Final Odometer Reading (Optional)</Label>
            <Input 
              type="number" 
              placeholder="Enter KM reading if known..." 
              value={forceEndReading}
              onChange={(e) => setForceEndReading(e.target.value)}
              className="h-11 rounded-sm font-mono font-bold"
            />
            <p className="text-[9px] text-muted-foreground italic">Leaving this blank will preserve the vehicle's current reading.</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm font-bold uppercase text-[10px] h-11">Back</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleForceEnd} 
              disabled={isProcessing} 
              className="bg-red-600 text-white hover:bg-red-700 rounded-sm font-black uppercase text-[10px] h-11 shadow-lg"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Termination"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Functional component for a desktop table row.
 */
function TripTableRow({ trip, user, isAdmin, isHR, isManager, allUsers, onDetails, onEdit, onCancel, onForceEnd, onAllot, onWhatsApp, isQueueView = false }: any) {
  const isAssignedDriver = trip.driverId === user?.uid;
  const isRequester = trip.userId === user?.uid;
  const canCancel = (isAdmin || isRequester) && (trip.status === 'Pending' || trip.status === 'Approved');
  const canStartTrip = (trip.status === 'Approved') && ((trip.vehicleOwnership === 'Rented' && isRequester) || (trip.vehicleOwnership !== 'Rented' && isAssignedDriver));
  const canEndTrip = (trip.status === 'Ongoing') && ((trip.vehicleOwnership === 'Rented' && isRequester) || (trip.vehicleOwnership !== 'Rented' && isAssignedDriver));
  const canForceEnd = (isAdmin || isHR) && trip.status === 'Ongoing';

  return (
    <TableRow className="hover:bg-muted/5 transition-colors group">
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
        <TripItinerary trip={trip} />
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            {trip.tripDate ? format(new Date(trip.tripDate), 'dd MMM yy') : '—'}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase">
            <Clock className="h-3 w-3" />
            {trip.reportingTime}
          </div>
        </div>
      </TableCell>
      {!isQueueView && (
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
      )}
      {isQueueView && (
        <TableCell className="text-[10px] font-mono font-bold text-muted-foreground">
          {trip.requestDate ? format(trip.requestDate.toDate(), 'dd MMM, HH:mm') : '—'}
        </TableCell>
      )}
      {!isQueueView && (
        <TableCell>
          <Badge variant="outline" className={cn(
            "text-[8px] font-black uppercase rounded-sm px-1.5 h-5",
            trip.status === 'Pending' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
            trip.status === 'Approved' ? "bg-blue-50 text-blue-700 border-blue-200" :
            trip.status === 'Ongoing' ? "bg-primary text-white border-none" :
            trip.status === 'Completed' ? "bg-green-50 text-green-700 border-green-200" :
            "bg-red-50 text-red-700 border-red-200"
          )}>{trip.status}</Badge>
        </TableCell>
      )}
      <TableCell className="text-right px-6 whitespace-nowrap">
        <div className="flex justify-end items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 rounded-sm hover:bg-green-50" onClick={() => onWhatsApp(trip)} title="Share on WhatsApp"><MessageCircle className="h-4 w-4" /></Button>
          {(isAdmin || isHR) && trip.status === 'Approved' && (
            <Button size="sm" variant="outline" className="h-8 rounded-sm font-black text-[10px] uppercase px-4 border-primary/20 text-primary hover:bg-primary/5" onClick={() => onAllot({ assignment: trip, vehicleId: trip.vehicleId || "", driverId: trip.driverId || "", rentedDriverDetails: trip.driverName?.startsWith('Rented: ') ? trip.driverName.replace('Rented: ', '') : "" })}>Change Allotment</Button>
          )}
          {(isAdmin || isManager) && trip.status === 'Pending' && (
            <Button size="sm" className="h-8 rounded-sm font-black text-[10px] uppercase px-4 shadow-sm" onClick={() => onAllot({ assignment: trip, vehicleId: "", driverId: "", rentedDriverDetails: "" })}>Allot Vehicle</Button>
          )}
          {(isAdmin || isManager || trip.userId === user?.uid) && trip.status === 'Pending' && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 rounded-sm" onClick={() => onEdit(trip)} title="Edit Request"><Pencil className="h-4 w-4" /></Button>
          )}
          {canStartTrip && (
            <Button size="sm" className="h-8 rounded-sm bg-blue-600 hover:bg-blue-700 font-bold px-3 text-[10px] uppercase tracking-tight" asChild><Link href={`/vehicles/trips/${trip.id}/start`}><PlayCircle className="h-3.5 w-3.5 mr-1" /> Start</Link></Button>
          )}
          {canEndTrip && (
            <Button size="sm" className="h-8 rounded-sm bg-red-600 hover:bg-red-700 font-bold px-3 text-[10px] uppercase tracking-tight" asChild><Link href={`/vehicles/trips/${trip.id}/finish`}><Flag className="h-3.5 w-3.5 mr-1" /> End</Link></Button>
          )}
          {canForceEnd && (
            <Button size="sm" variant="destructive" className="h-8 rounded-sm font-black text-[10px] uppercase px-4 shadow-sm" onClick={() => onForceEnd(trip)}>Force End</Button>
          )}
          {canCancel && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 rounded-sm" onClick={() => onCancel(trip)} title="Cancel Trip"><CircleX className="h-4 w-4" /></Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => onDetails(trip)} title="View Details"><Eye className="h-4 w-4" /></Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * Functional component for a mobile card.
 */
function TripMobileCard({ trip, user, isAdmin, isHR, isManager, onDetails, onEdit, onCancel, onForceEnd, onAllot, onWhatsApp }: any) {
  const isAssignedDriver = trip.driverId === user?.uid;
  const isRequester = trip.userId === user?.uid;
  const canCancel = (isAdmin || isRequester) && (trip.status === 'Pending' || trip.status === 'Approved');
  const canStartTrip = (trip.status === 'Approved') && ((trip.vehicleOwnership === 'Rented' && isRequester) || (trip.vehicleOwnership !== 'Rented' && isAssignedDriver));
  const canEndTrip = (trip.status === 'Ongoing') && ((trip.vehicleOwnership === 'Rented' && isRequester) || (trip.vehicleOwnership !== 'Rented' && isAssignedDriver));
  const canForceEnd = (isAdmin || isHR) && trip.status === 'Ongoing';

  return (
    <Card className="border-primary/10 rounded-sm shadow-sm overflow-hidden" onClick={() => onDetails(trip)}>
      <CardContent className="p-4 space-y-4">
        <div className="flex justify-between items-start gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {trip.tripDate ? format(new Date(trip.tripDate), 'dd MMM yy') : '—'}
              <span className="mx-1">•</span>
              <Clock className="h-3 w-3" />
              {trip.reportingTime}
            </span>
            <h3 className="font-bold text-sm leading-tight text-foreground truncate">{trip.userName}</h3>
          </div>
          <Badge variant="outline" className={cn(
            "text-[8px] font-black uppercase rounded-sm px-1.5 h-5 shrink-0",
            trip.status === 'Pending' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
            trip.status === 'Approved' ? "bg-blue-50 text-blue-700 border-blue-200" :
            trip.status === 'Ongoing' ? "bg-primary text-white border-none" :
            trip.status === 'Completed' ? "bg-green-50 text-green-700 border-green-200" :
            "bg-red-50 text-red-700 border-red-200"
          )}>{trip.status}</Badge>
        </div>

        <TripItinerary trip={trip} />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Fleet Resource</p>
            {trip.vehicleId ? (
              <div className="flex flex-col">
                <span className="text-xs font-bold truncate">{trip.vehicleDetails}</span>
                <span className="text-[9px] font-black text-primary uppercase">{trip.driverName}</span>
              </div>
            ) : <span className="text-[10px] text-muted-foreground/40 italic uppercase font-bold">Awaiting Resource</span>}
          </div>
          <div className="space-y-1">
            <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Passengers</p>
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold text-foreground">
                {trip.coPassengers && trip.coPassengers.length > 0 ? `+${trip.coPassengers.length} personnel` : 'Requester Only'}
              </span>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-primary/5 flex flex-wrap justify-end items-center gap-2" onClick={e => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => onWhatsApp(trip)}><MessageCircle className="h-4 w-4" /></Button>
          {(isAdmin || isHR) && trip.status === 'Approved' && (
            <Button size="sm" variant="outline" className="h-8 rounded-sm font-black text-[9px] uppercase border-primary/20 text-primary" onClick={() => onAllot({ assignment: trip, vehicleId: trip.vehicleId || "", driverId: trip.driverId || "", rentedDriverDetails: trip.driverName?.startsWith('Rented: ') ? trip.driverName.replace('Rented: ', '') : "" })}>Re-allot</Button>
          )}
          {(isAdmin || isManager) && trip.status === 'Pending' && (
            <Button size="sm" className="h-8 rounded-sm font-black text-[9px] uppercase" onClick={() => onAllot({ assignment: trip, vehicleId: "", driverId: "", rentedDriverDetails: "" })}>Allot Vehicle</Button>
          )}
          {(isAdmin || isManager || trip.userId === user?.uid) && trip.status === 'Pending' && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600" onClick={() => onEdit(trip)}><Pencil className="h-4 w-4" /></Button>
          )}
          {canStartTrip && (
            <Button size="sm" className="h-8 rounded-sm bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 text-[10px] uppercase" asChild><Link href={`/vehicles/trips/${trip.id}/start`}><PlayCircle className="h-3.5 w-3.5 mr-1" /> Start</Link></Button>
          )}
          {canEndTrip && (
            <Button size="sm" className="h-8 rounded-sm bg-red-600 hover:bg-red-700 text-white font-bold px-3 text-[10px] uppercase" asChild><Link href={`/vehicles/trips/${trip.id}/finish`}><Flag className="h-3.5 w-3.5 mr-1" /> End</Link></Button>
          )}
          {canForceEnd && (
            <Button size="sm" variant="destructive" className="h-8 rounded-sm font-black text-[9px] uppercase px-4 shadow-sm" onClick={() => onForceEnd(trip)}>Force End</Button>
          )}
          {canCancel && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => onCancel(trip)}><CircleX className="h-4 w-4" /></Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => onDetails(trip)}><Eye className="h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Functional component for trip itinerary visualization.
 */
function TripItinerary({ trip }: { trip: Assignment }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-xs font-black text-emerald-700">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{trip.pickupLocation}</span>
      </div>
      {trip.intermediateStops && trip.intermediateStops.length > 0 && (
        <div className="flex flex-col gap-1 ml-4 border-l-2 border-primary/10 pl-3">
          {trip.intermediateStops.map((dest, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px] font-bold text-primary">
              <ArrowRight className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{dest.location}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5 text-xs font-black text-emerald-700 ml-4">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{trip.dropLocation}</span>
      </div>
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
      <DialogContent className="max-w-3xl max-h-[95vh] h-[90vh] p-0 overflow-hidden flex flex-col rounded-sm border-none shadow-2xl bg-background">
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
                        <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Trip Date</FormLabel>
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
                        <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reporting Time (12h)</FormLabel>
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
                                        <CheckCircle2 className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                    <div className="flex items-center border-b px-3"><Search className="mr-2 h-4 w-4 shrink-0 opacity-50" /><Input placeholder="Search sites..." className="h-10 w-full border-none focus-visible:ring-0 px-0 text-sm" value={pickupSearchQuery} onChange={e => setPickupSearchQuery(e.target.value)} /></div>
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
                          <Label className="text-xs font-bold uppercase text-muted-foreground">Intermediate Stops</Label>
                          <Button type="button" variant="outline" size="sm" onClick={() => appendStop({ type: 'Site', location: '', purpose: '' })} className="h-7 text-[10px] font-bold"><Plus className="h-3.5 w-3.5 mr-1" /> Add Stop</Button>
                        </div>
                        {stopFields.map((field, idx) => (
                          <div key={field.id} className="p-4 border rounded-sm bg-muted/5 space-y-3 relative group">
                            <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-destructive rounded-sm" onClick={() => removeStop(idx)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            <FormField
                              control={form.control}
                              name={`intermediateStops.${idx}.type`}
                              render={({ field: typeField }) => (
                                <RadioGroup onValueChange={typeField.onChange} value={typeField.value} className="flex gap-4 mb-2">
                                  <div className="flex items-center space-x-2"><RadioGroupItem value="Site" id={`stop-${index}-site`} /><Label htmlFor={`stop-${index}-site`} className="text-[10px] font-bold">Site</Label></div>
                                  <div className="flex items-center space-x-2"><RadioGroupItem value="Other" id={`stop-${index}-other`} /><Label htmlFor={`stop-${index}-other`} className="text-[10px] font-bold">Other</Label></div>
                                </RadioGroup>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`intermediateStops.${idx}.location`}
                              render={({ field: locField }) => (
                                <FormItem className="flex flex-col">
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
                                <FormControl><Input placeholder="Enter final destination address..." {...field} className="h-11 rounded-sm" /></FormControl>
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
                        <div className="flex items-center border-b px-3"><Search className="mr-2 h-4 w-4 shrink-0 opacity-50" /><Input placeholder="Search personnel..." className="h-10 w-full border-none focus-visible:ring-0 px-0 text-sm" value={passengerSearchQuery} onChange={e => setPassengerSearchQuery(e.target.value)} /></div>
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
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">General Trip Note</FormLabel>
                    <FormControl><Textarea rows={3} placeholder="Describe the trip context..." {...field} className="rounded-sm" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </form>
            </Form>
          </div>
        </ScrollArea>
        <DialogFooter className="p-4 bg-muted/10 border-t gap-3 shrink-0 flex flex-col sm:flex-row">
          <DialogClose asChild><Button variant="outline" className="rounded-sm font-bold uppercase text-[10px] h-10 px-6">Cancel</Button></DialogClose>
          <Button onClick={form.handleSubmit(handleSubmit)} disabled={isSubmitting} className="rounded-sm font-black uppercase text-[10px] h-10 px-8 shadow-md">
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Applying...</> : <><Save className="h-4 w-4 mr-2" /> Apply Updates</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduledTripsDialog({ 
  assignments, 
  allUsers,
  open, 
  onOpenChange 
}: { 
  assignments: Assignment[], 
  allUsers: UserProfile[],
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
    
    const formattedDate = format(new Date(selectedDate), 'dd MMM yyyy');
    const statusInfo = statusFilter === 'all' ? 'All Active' : statusFilter;
    let message = `*AdityaPro - Scheduled Trips for ${formattedDate} (${statusInfo})*\n\n`;
    
    filtered.forEach((trip, index) => {
      const passengerList = trip.coPassengers && trip.coPassengers.length > 0 
        ? ` (with ${trip.coPassengers.map(p => (p.name || '').trim()).join(', ')})` 
        : '';
      
      const stops = trip.intermediateStops && trip.intermediateStops.length > 0
        ? `\n\u{1F6D1} *Stops:* ${trip.intermediateStops.map(s => s.location).join(', ')}`
        : '';

      const driverObj = allUsers?.find(u => u.id === trip.driverId);
      const driverInfo = trip.driverName 
        ? `${driverObj?.mobile ? `(${driverObj.mobile}) ` : ""}${trip.driverName}` 
        : 'Pending Allotment';

      message += `*${index + 1}. ${(trip.userName || '').trim()}${passengerList}*\n`;
      message += `\u{1F552} *Reporting:* ${formatTo12Hr(trip.reportingTime)}${stops}\n`;
      message += `\u{1F4CD} *Pickup:* ${trip.pickupLocation}\n`;
      message += `\u{1F3C1} *Drop:* ${trip.dropLocation}\n`;
      message += `\u{1F697} *Vehicle:* ${trip.vehicleDetails || 'Pending Allotment'}\n`;
      message += `\u{1F464} *Driver:* ${driverInfo}\n`;
      message += `------------------\n\n`;
    });

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] h-[80vh] flex flex-col p-0 rounded-sm overflow-hidden shadow-2xl bg-background">
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

        <ScrollArea className="flex-1 bg-muted/10">
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
                          <span className="font-bold text-sm text-foreground">{trip.userName}</span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">{formatTo12Hr(trip.reportingTime)}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn(
                        "text-[8px] font-black uppercase h-5 rounded-sm",
                        trip.status === 'Approved' ? "bg-blue-50 text-blue-700 border-blue-200" : 
                        trip.status === 'Ongoing' ? "bg-primary text-white border-none" : 
                        trip.status === 'Completed' ? "bg-green-50 text-green-700 border-green-200" :
                        "bg-yellow-50 text-yellow-700 border-yellow-200"
                      )}>{trip.status}</Badge>
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
                          <div className="relative pl-6 border-l-2 border-emerald-500">
                            <div className="absolute -left-[7px] top-0 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-background" />
                            <p className="text-[9px] font-black uppercase text-emerald-700 tracking-tighter">Final Drop</p>
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
                              <Label className="text-[9px] font-black uppercase text-muted-foreground flex items-gap-1.5"><Users className="h-3 w-3" /> Co-passengers</Label>
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
        </ScrollArea>
        <DialogFooter className="p-4 border-t bg-muted/10 shrink-0">
          <DialogClose asChild><Button variant="outline" className="rounded-sm font-bold uppercase text-[10px] h-10 px-8">Close</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
