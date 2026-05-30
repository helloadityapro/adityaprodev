"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  CircleCheck, 
  Clock, 
  CircleX, 
  Eye, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  History, 
  User, 
  ExternalLink, 
  Printer, 
  FileText, 
  MessageCircle, 
  Paperclip, 
  ImageIcon, 
  Film, 
  MapPin, 
  Maximize2, 
  X, 
  FolderArchive, 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  PlayCircle, 
  FileCheck,
  RefreshCw,
  Calendar,
  Building2,
  Navigation,
  HardHat,
  TrendingUp,
  Fuel,
  FilterX,
  Check,
  ChevronsUpDown,
  Loader2,
  ShieldCheck,
  Activity,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, serverTimestamp, arrayUnion, getDoc, increment, or, and, getDocs } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subDays, subMonths, subYears } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { isSuperAdmin } from "@/lib/auth-constants";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { sendNotification } from "@/lib/notifications";
import { slugifyRole } from '@/lib/access-control';

type Attachment = { 
  url: string; 
  contentType: string; 
  name: string; 
  submissionIndex?: number;
  timestamp?: string;
};

type TimelineEntry = {
  status: string;
  timestamp: any;
  userId: string;
  userName: string;
  userRole?: string;
  remarks: string;
  action: string;
  submissionIndex?: number;
};

type Permit = {
  id: string;
  siteId: string;
  serialNumber?: string;
  siteName: string;
  ptwType: string;
  descriptionOfWork: string;
  status: 'Pending' | 'ManagerApproved' | 'Approved' | 'Rejected';
  siteEngineerId: string;
  siteEngineerName?: string;
  siteManagerId?: string;
  authorizedAdminId?: string;
  authorizedAdminIds?: string[];
  adminId?: string;
  requestDate: any;
  statusChangeDate?: any;
  attachments?: Attachment[];
  commentsAndRemarks?: string;
  timeline?: TimelineEntry[];
  latitude?: number;
  longitude?: number;
};

type RewardSettings = {
  pointValueInRs?: number;
  ptwNoCorrection?: number;
  ptwWithCorrection?: number;
};

type AccessConfig = {
  id: string;
  ownDataOnly?: boolean;
};

type MappingOverride = {
  id: string;
  engineerId: string;
  siteId: string;
  managerId: string;
};

type SortKey = 'serialNumber' | 'ptwType' | 'siteName' | 'requestDate' | 'status';

function StatusBadge({ permit, className }: { permit: Permit, className?: string }) {
  const firestore = useFirestore();
  const managerRef = useMemoFirebase(() => (permit.status === 'Pending' && permit.siteManagerId) ? doc(firestore, 'users', permit.siteManagerId) : null, [firestore, permit.siteManagerId, permit.status]);
  const { data: managerProfile } = useDoc(managerRef);

  const statusConfig = {
    Pending: { 
      label: managerProfile ? `With ${managerProfile.username}` : 'Pending Manager', 
      className: 'bg-yellow-50 text-yellow-700 border-yellow-200' 
    },
    ManagerApproved: { 
      label: 'Forwarded to Admin', 
      className: 'bg-blue-50 text-blue-700 border-blue-200' 
    },
    Approved: { label: 'Final Approved', className: 'bg-green-50 text-green-700 border-green-200' },
    Rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-200' },
  };
  const config = (statusConfig as any)[permit.status] || statusConfig.Pending;
  return (
    <Badge variant="outline" className={cn("flex items-center gap-1.5 text-[10px] font-semibold whitespace-nowrap border rounded-sm h-5 px-2", config.className, className)}>
      {config.label}
    </Badge>
  );
}

function WhatsAppUpdateEngineer({ permit }: { permit: Permit }) {
    const firestore = useFirestore();
    const { data: engineerProfile } = useDoc(useMemoFirebase(() => doc(firestore, 'users', permit.siteEngineerId), [firestore, permit.siteEngineerId]));
    
    const triggerWhatsApp = () => {
        if (!engineerProfile?.mobile) return;
        const cleanMobile = engineerProfile.mobile.replace(/\D/g, '');
        const formattedMobile = cleanMobile.length === 10 ? `91${cleanMobile}` : (cleanMobile.startsWith('91') ? cleanMobile : `91${cleanMobile}`);
        const lastEntry = [...(permit.timeline || [])].sort((a, b) => (b.timestamp?.toDate?.() || 0) - (a.timestamp?.toDate?.() || 0))[0];
        const message = `Aditya Pro Update:\nPermit: ${permit.serialNumber}\nSite: ${permit.siteName}\nStatus: ${permit.status}\nRemarks: ${lastEntry?.remarks || "None"}\nLink: ${window.location.origin}/ptw/list?view=${permit.id}`;
        window.open(`https://wa.me/${formattedMobile}?text=${encodeURIComponent(message)}`, '_blank');
    };

    if (!engineerProfile?.mobile) return null;
    return <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 rounded-sm" onClick={(e) => { e.stopPropagation(); triggerWhatsApp(); }} title="Notify via WhatsApp"><MessageCircle className="h-4 w-4" /></Button>;
}

const formatTimestamp = (ts: any) => {
  if (!ts) return 'N/A';
  const date = ts.toDate ? ts.toDate() : (typeof ts === 'string' ? new Date(ts) : ts);
  return format(date, 'dd MMM yyyy HH:mm');
};

const isVideo = (file: Attachment) => {
  if (file.contentType?.startsWith('video/')) return true;
  const name = (file.name || "").toLowerCase();
  return name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.webm') || name.endsWith('.ogg');
};

const isImage = (file: Attachment) => {
  if (file.contentType?.startsWith('image/')) return true;
  const name = (file.name || "").toLowerCase();
  return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.gif') || name.endsWith('.webp');
};

export default function PtwListPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [userFilter, setUserFilter] = React.useState('all');
  const [siteFilter, setSiteFilter] = React.useState('all');
  const [dateFilter, setDateFilter] = React.useState<string>("7days");
  const [customStart, setCustomStart] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  
  const [isUserPopoverOpen, setIsUserPopoverOpen] = React.useState(false);
  const [userSearchQuery, setUserSearchQuery] = React.useState("");
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");

  const [actionState, setActionState] = React.useState<{ permit: Permit, status: 'Approved' | 'Rejected' | 'ManagerApproved' } | null>(null);
  const [detailsPermit, setDetailsPermit] = React.useState<Permit | null>(null);
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'requestDate', direction: 'desc' });
  
  const [viewFile, setViewFile] = React.useState<Attachment | null>(null);
  const [viewFiles, setViewFiles] = React.useState<Attachment[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = React.useState(0);
  
  // Gallery Engine State
  const [scale, setScale] = React.useState(1);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [startPan, setStartPan] = React.useState({ x: 0, y: 0 });
  
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mediaRef = React.useRef<HTMLDivElement>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  
  const isSuper = isSuperAdmin(user?.email);
  const isAdmin = isSuper || userProfile?.role === "Admin";
  const userRole = isAdmin ? "Admin" : userProfile?.role || "Site Engineer";
  const isManager = userProfile?.role === "Site Manager";

  const permitsQuery = useMemoFirebase(() => {
    if (!userRole || !user || isProfileLoading) return null;
    const colRef = collection(firestore, 'permits_to_work');
    if (isAdmin) return colRef;
    if (userRole === 'Site Manager') {
      return query(colRef, or(where('siteManagerId', '==', user.uid), where('siteEngineerId', '==', user.uid)));
    }
    return query(colRef, where('siteEngineerId', '==', user.uid));
  }, [firestore, userRole, user, isProfileLoading, isAdmin]);

  const { data: permits, isLoading } = useCollection<Permit>(permitsQuery);
  const { data: rewardSettings } = useDoc<RewardSettings>(useMemoFirebase(() => doc(firestore, 'system_settings', 'rewards'), [firestore]));

  const usersQuery = useMemoFirebase(() => isAdmin ? query(collection(firestore, 'users'), where('role', '==', 'Site Engineer')) : null, [firestore, isAdmin]);
  const { data: engineers } = useCollection<{ username: string, id: string }>(usersQuery);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<{ name: string, id: string, projectCompany: string }>(sitesQuery);

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<AccessConfig>(roleConfigsQuery);

  const overridesQuery = useMemoFirebase(() => collection(firestore, 'team_mapping_overrides'), [firestore]);
  const { data: allOverrides } = useCollection<MappingOverride>(overridesQuery);

  const teamQuery = useMemoFirebase(() => {
    if (!isManager || !user) return null;
    return query(collection(firestore, 'users'), where('siteManagerId', '==', user.uid));
  }, [firestore, user, isManager]);
  const { data: teamMembers } = useCollection<UserProfile>(teamQuery);

  const accessibleSiteIds = React.useMemo(() => {
    const ids = new Set<string>();
    if (!userProfile || !allSites) return ids;
    if (isAdmin) {
      allSites.forEach(s => ids.add(s.id));
      return ids;
    }

    const roleId = userProfile.role ? slugifyRole(userProfile.role) : 'none';
    const isOwnDataOnly = userProfile.ownDataOnly !== undefined 
      ? userProfile.ownDataOnly 
      : roleConfigs?.find(c => c.id === roleId)?.ownDataOnly ?? false;

    if (!isOwnDataOnly) {
      allSites.forEach(s => ids.add(s.id));
      return ids;
    }

    if (isManager) {
      allOverrides?.filter(o => o.managerId === userProfile.id).forEach(o => ids.add(o.siteId));
      teamMembers?.forEach(member => {
        (member.assignedProjectIds || []).forEach(sid => {
          const hasOtherOverride = allOverrides?.some(o => o.engineerId === member.id && o.siteId === sid && o.managerId !== userProfile.id);
          if (!hasOtherOverride) ids.add(sid);
        });
      });
    } else {
      (userProfile.assignedProjectIds || []).forEach(id => ids.add(id));
    }
    return ids;
  }, [userProfile, isAdmin, allSites, roleConfigs, isManager, allOverrides, teamMembers]);

  const queryDateRange = React.useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    
    switch (dateFilter) {
      case 'today':
        return { start: todayStr, end: todayStr };
      case 'yesterday':
        const yesterday = format(subDays(today, 1), 'yyyy-MM-dd');
        return { start: yesterday, end: yesterday };
      case '7days':
        return { start: format(subDays(today, 7), 'yyyy-MM-dd'), end: todayStr };
      case 'lastMonth':
        return { start: format(subMonths(today, 1), 'yyyy-MM-dd'), end: todayStr };
      case 'lastYear':
        return { start: format(subYears(today, 1), 'yyyy-MM-dd'), end: todayStr };
      case 'allTime':
        return { start: '1970-01-01', end: '2099-12-31' };
      case 'custom':
        return { start: customStart, end: customEnd };
      default:
        return { start: format(subDays(today, 7), 'yyyy-MM-dd'), end: todayStr };
    }
  }, [dateFilter, customStart, customEnd]);

  const filteredPermits = React.useMemo(() => {
    if (!permits || !userProfile) return [];
    
    const hiddenIds = userProfile.hiddenPermitIds || [];
    let list = permits.filter(p => !hiddenIds.includes(p.id));

    // Dynamic Sovereignty Filtering
    const roleId = userProfile.role ? slugifyRole(userProfile.role) : 'none';
    const isOwnDataOnly = userProfile.ownDataOnly !== undefined 
      ? userProfile.ownDataOnly 
      : roleConfigs?.find(c => c.id === roleId)?.ownDataOnly ?? false;

    if (isOwnDataOnly && !isSuper) {
      list = list.filter(p => accessibleSiteIds.has(p.siteId));
    }

    const { start, end } = queryDateRange;

    return list.filter(p => {
        const pDate = p.requestDate?.toDate?.() || new Date(p.requestDate);
        const pDateStr = format(pDate, 'yyyy-MM-dd');

        const matchesStatus = statusFilter === 'all' ? true : p.status === statusFilter;
        const matchesUser = userFilter === 'all' ? true : p.siteEngineerId === userFilter;
        const matchesSite = siteFilter === 'all' ? true : p.siteName === siteFilter;
        const matchesSearch = p.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             p.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             p.siteEngineerName?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDate = pDateStr >= start && pDateStr <= end;

        return matchesStatus && matchesSearch && matchesUser && matchesSite && matchesDate;
      })
      .sort((a, b) => {
        const { key, direction } = sortConfig;
        let valA: any = a[key] || '';
        let valB: any = b[key] || '';
        if (key === 'requestDate') {
          valA = a.requestDate?.toDate?.().getTime() || 0;
          valB = b.requestDate?.toDate?.().getTime() || 0;
        }
        return direction === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
      });
  }, [permits, statusFilter, userFilter, siteFilter, searchTerm, sortConfig, userProfile, isSuper, queryDateRange, roleConfigs, accessibleSiteIds]);

  const stats = React.useMemo(() => {
    return {
      total: filteredPermits.length,
      pending: filteredPermits.filter(p => p.status === 'Pending' || p.status === 'ManagerApproved').length,
      approved: filteredPermits.filter(p => p.status === 'Approved').length,
    };
  }, [filteredPermits]);

  const filteredEngineersList = React.useMemo(() => {
    if (!engineers) return [];
    return engineers.filter(eng => 
      eng.username.toLowerCase().includes(userSearchQuery.toLowerCase())
    );
  }, [engineers, userSearchQuery]);

  const filteredSitesListForFilter = React.useMemo(() => {
    if (!allSites) return [];
    return allSites.filter(site => 
      site.name.toLowerCase().includes(siteSearchQuery.toLowerCase())
    );
  }, [allSites, siteSearchQuery]);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3 text-primary" /> : <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  const handleAction = async (permit: Permit, targetStatus: Permit['status'], remarks: string) => {
    if (!user || !userProfile) return;
    
    const permitRef = doc(firestore, "permits_to_work", permit.id);
    const pSnap = await getDoc(permitRef);
    if (!pSnap.exists()) return;
    const freshPermitData = pSnap.data() as Permit;
    
    if (freshPermitData.status === 'Approved' || freshPermitData.status === 'Rejected') {
        toast({ variant: 'destructive', title: 'Action Invalid', description: 'This permit has already been finalized.' });
        return;
    }

    const currentSubmission = Math.max(1, ...(permit.attachments?.map(a => a.submissionIndex || 0) || []));

    const timelineEntry: TimelineEntry = {
      status: targetStatus,
      timestamp: new Date(),
      userId: user.uid,
      userName: userProfile.username || user.email || 'System',
      userRole: userProfile.role || userRole,
      remarks: remarks,
      action: targetStatus === 'Rejected' ? `Rejected` : (targetStatus === 'ManagerApproved' ? 'Approved by Manager' : 'Final Approval'),
      submissionIndex: currentSubmission
    };

    updateDocumentNonBlocking(permitRef, {
      status: targetStatus,
      statusChangeDate: serverTimestamp(),
      timeline: arrayUnion({ ...timelineEntry, timestamp: new Date() }),
      ...(userProfile.role === 'Site Manager' && permit.status === 'Pending' ? { siteManagerId: user.uid } : {}),
      ...(isAdmin ? { adminId: user.uid } : {})
    });

    if (targetStatus === 'Approved') {
        const engineerRef = doc(firestore, 'users', permit.siteEngineerId);
        const engineerDoc = await getDoc(engineerRef);
        if (engineerDoc.exists()) {
            const multiplier = engineerDoc.data()?.pointsMultiplier || 1;
            const hasRejection = (permit.timeline || []).some(t => t.status === 'Rejected');
            const baseRate = hasRejection ? (rewardSettings?.ptwWithCorrection ?? 0.5) : (rewardSettings?.ptwNoCorrection ?? 1.0);
            updateDocumentNonBlocking(engineerRef, { totalPoints: increment(baseRate * multiplier) });
            if (permit.siteManagerId) {
                const managerRef = doc(firestore, 'users', permit.siteManagerId);
                updateDocumentNonBlocking(managerRef, { totalPoints: increment(baseRate * 0.5) });
            }
        }
    }

    sendNotification(firestore, {
      userId: permit.siteEngineerId,
      title: `Permit Update: ${targetStatus}`,
      description: `Permit ${permit.serialNumber} is now ${targetStatus}.`,
      link: `/ptw/list?view=${permit.id}`,
      push: true
    });

    // Notify Admins
    const adminsQuery = query(collection(firestore, 'users'), where('role', '==', 'Admin'));
    const adminDocs = await getDocs(adminsQuery);
    adminDocs.forEach(adminDoc => {
      sendNotification(firestore, {
        userId: adminDoc.id,
        title: "Permit Status Updated",
        description: `Permit ${permit.serialNumber} (${permit.siteName}) was updated to ${targetStatus} by ${userProfile.username}.`,
        link: `/ptw/list?view=${permit.id}`,
        push: true
      });
    });

    toast({ title: "Updated", description: `Permit status set to ${targetStatus}.` });
  };

  const openViewer = (file: Attachment, allAttachments: Attachment[]) => {
    const mediaFiles = allAttachments.filter(a => isImage(a) || isVideo(a));
    const index = mediaFiles.findIndex(a => a.url === file.url);
    setViewFiles(mediaFiles);
    setCurrentFileIndex(index >= 0 ? index : 0);
    setViewFile(file);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const nextFile = () => {
    if (viewFiles.length <= 1) return;
    const nextIdx = (currentFileIndex + 1) % viewFiles.length;
    setCurrentFileIndex(nextIdx);
    setViewFile(viewFiles[nextIdx]);
    resetViewer();
  };

  const prevFile = () => {
    if (viewFiles.length <= 1) return;
    const prevIdx = (currentFileIndex - 1 + viewFiles.length) % viewFiles.length;
    setCurrentFileIndex(prevIdx);
    setViewFile(viewFiles[prevIdx]);
    resetViewer();
  };

  const resetViewer = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (isVideo(viewFile!)) return;
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    const newScale = Math.min(Math.max(scale + delta, 1), 4);
    setScale(newScale);
    if (newScale === 1) setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1 || isVideo(viewFile!)) return;
    setIsDragging(true);
    setStartPan({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    const newX = e.clientX - startPan.x;
    const newY = e.clientY - startPan.y;
    
    // Improved clamping logic
    const limitX = Math.max(0, (window.innerWidth * scale - window.innerWidth) / 2);
    const limitY = Math.max(0, (window.innerHeight * scale - window.innerHeight) / 2);

    setPosition({
      x: Math.min(Math.max(newX, -limitX), limitX),
      y: Math.min(Math.max(newY, -limitY), limitY)
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleDoubleClick = () => {
    if (isVideo(viewFile!)) return;
    if (scale > 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2);
    }
  };

  const handleCloseDetails = () => {
    setDetailsPermit(null);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setDateFilter("7days");
  };

  if (isLoading || isProfileLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1>PtW Audit</h1>
        <p className="text-muted-foreground text-sm font-medium">Compliance monitoring and permit authorization hub.</p>
      </div>

      <div className="grid gap-2 grid-cols-3 sm:gap-4">
        <Card className="bg-primary/5 border-primary/10 rounded-sm">
          <CardHeader className="p-2 sm:p-4 pb-1 sm:pb-2"><CardTitle className="text-[8px] sm:text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Filtered Total</CardTitle></CardHeader>
          <CardContent className="p-2 sm:p-4 pt-0 font-black text-base sm:text-2xl">{stats.total}</CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/10 rounded-sm">
          <CardHeader className="p-2 sm:p-4 pb-1 sm:pb-2"><CardTitle className="text-[8px] sm:text-[10px] font-bold uppercase text-amber-600 tracking-widest">Pending</CardTitle></CardHeader>
          <CardContent className="p-2 sm:p-4 pt-0 font-black text-base sm:text-2xl text-amber-700">{stats.pending}</CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/10 rounded-sm">
          <CardHeader className="p-2 sm:p-4 pb-1 sm:pb-2"><CardTitle className="text-[8px] sm:text-[10px] font-bold uppercase text-green-600 tracking-widest">Approved</CardTitle></CardHeader>
          <CardContent className="p-2 sm:p-4 pt-0 font-black text-base sm:text-2xl text-green-700">{stats.approved}</CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 bg-card p-3 sm:p-4 border rounded-sm shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
          <div className="relative w-full md:col-span-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by serial or site..." className="pl-9 h-10 rounded-sm bg-muted/20 border-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          
          <div className="space-y-1">
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="h-10 rounded-sm border-primary/20 bg-background font-bold text-[10px] sm:text-xs uppercase">
                <Calendar className="h-3.5 w-3.5 mr-2 opacity-50" />
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today" className="text-xs font-bold uppercase">Today</SelectItem>
                <SelectItem value="yesterday" className="text-xs font-bold uppercase">Yesterday</SelectItem>
                <SelectItem value="7days" className="text-xs font-bold uppercase">Last 7 Days</SelectItem>
                <SelectItem value="lastMonth" className="text-xs font-bold uppercase">Last Month</SelectItem>
                <SelectItem value="lastYear" className="text-xs font-bold uppercase">Last Year</SelectItem>
                <SelectItem value="allTime" className="text-xs font-bold uppercase">All Time</SelectItem>
                <SelectItem value="custom" className="text-xs font-bold uppercase text-primary">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            {dateFilter === 'custom' ? (
              <div className="flex-1 flex gap-2 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex-1 space-y-1">
                  <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-10 rounded-sm border-primary/20 text-[10px]" />
                </div>
                <div className="flex-1 space-y-1">
                  <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-10 rounded-sm border-primary/20 text-[10px]" />
                </div>
              </div>
            ) : (
              <div className="flex-1" />
            )}
            <Button variant="ghost" size="icon" onClick={clearFilters} className="h-10 w-10 text-muted-foreground rounded-sm border border-transparent hover:border-primary/10">
              <FilterX className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 w-full no-wrap">
            <Popover open={isUserPopoverOpen} onOpenChange={setIsUserPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="flex-1 h-10 text-xs font-bold uppercase tracking-tight rounded-sm border-primary/20 justify-between">
                  <span className="truncate">{userFilter === 'all' ? "All Engineers" : engineers?.find(e => e.id === userFilter)?.username || "Filter Personnel"}</span>
                  <ChevronsUpDown className="ml-2 h-3 w-3 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[240px] p-0" align="start">
                <div className="flex items-center border-b px-3">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <Input placeholder="Search engineers..." className="h-9 w-full border-none focus-visible:ring-0 px-0 text-xs" value={userSearchQuery} onChange={(e) => setUserSearchQuery(e.target.value)} />
                </div>
                <ScrollArea className="h-[200px]">
                  <div className="p-1">
                    <Button variant="ghost" className="w-full justify-start font-bold text-xs rounded-sm h-9" onClick={() => { setUserFilter('all'); setIsUserPopoverOpen(false); setUserSearchQuery(""); }}>
                      <Check className={cn("mr-2 h-3 w-3", userFilter === 'all' ? "opacity-100" : "opacity-0")} />
                      All Engineers
                    </Button>
                    {filteredEngineersList.map(eng => (
                      <Button key={eng.id} variant="ghost" className="w-full justify-start font-medium text-xs rounded-sm h-9" onClick={() => { setUserFilter(eng.id); setIsUserPopoverOpen(false); setUserSearchQuery(""); }}>
                        <Check className={cn("mr-2 h-3 w-3", userFilter === eng.id ? "opacity-100" : "opacity-0")} />
                        {eng.username}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="flex-1 h-10 text-xs font-bold uppercase tracking-tight rounded-sm border-primary/20 justify-between">
                  <span className="truncate">{siteFilter === 'all' ? "All Sites" : siteFilter}</span>
                  <ChevronsUpDown className="ml-2 h-3 w-3 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[240px] p-0" align="start">
                <div className="flex items-center border-b px-3">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <Input placeholder="Search sites..." className="h-9 w-full border-none focus-visible:ring-0 px-0 text-xs" value={siteSearchQuery} onChange={(e) => setSiteSearchQuery(e.target.value)} />
                </div>
                <ScrollArea className="h-[200px]">
                  <div className="p-1">
                    <Button variant="ghost" className="w-full justify-start font-bold text-xs rounded-sm h-9" onClick={() => { setSiteFilter('all'); setIsSitePopoverOpen(false); setSiteSearchQuery(""); }}>
                      <Check className={cn("mr-2 h-3 w-3", siteFilter === 'all' ? "opacity-100" : "opacity-0")} />
                      All Sites
                    </Button>
                    {filteredSitesListForFilter.map(site => (
                      <Button key={site.id} variant="ghost" className="w-full justify-start font-medium text-xs rounded-sm h-9" onClick={() => { setSiteFilter(site.name); setIsSitePopoverOpen(false); setSiteSearchQuery(""); }}>
                        <Check className={cn("mr-2 h-4 w-4 text-primary", siteFilter === site.name ? "opacity-100" : "opacity-0")} />
                        {site.name}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 no-print">
          {[{ id: 'all', label: 'All Status' }, { id: 'Pending', label: 'Pending Manager' }, { id: 'ManagerApproved', label: 'Pending Admin' }, { id: 'Approved', label: 'Approved' }, { id: 'Rejected', label: 'Rejected' }].map(s => (
            <Badge key={s.id} variant={statusFilter === s.id ? 'default' : 'outline'} className="cursor-pointer font-bold text-[10px] h-7 px-2 sm:h-8 sm:px-4 rounded-sm border-primary/20" onClick={() => setStatusFilter(s.id)}>{s.label}</Badge>
          ))}
        </div>
      </div>

      <div className="md:hidden space-y-4">
        {filteredPermits.length > 0 ? filteredPermits.map(permit => (
          <Card key={permit.id} className="border-primary/10 rounded-sm shadow-sm overflow-hidden" onClick={() => setDetailsPermit(permit)}>
            <CardContent className="p-4 space-y-4">
              <div className="flex justify-between items-start gap-4">
                <div className="flex flex-col gap-1 min-w-0"><span className="font-mono text-[10px] font-bold text-primary truncate">{permit.serialNumber || permit.id.slice(0, 8)}</span><h3 className="font-bold text-sm leading-tight text-foreground line-clamp-2">{permit.siteName}</h3></div>
                <StatusBadge permit={permit} className="shrink-0" />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-primary/60" /><span>{permit.ptwType}</span></div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-tight"><Calendar className="h-3.5 w-3.5" />{formatTimestamp(permit.requestDate)}</div>
              </div>
              <div className="pt-2 border-t border-primary/5 flex justify-end items-center gap-2">
                <WhatsAppUpdateEngineer permit={permit} />
                {permit.status === 'Rejected' && (
                  <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-amber-600 rounded-sm" title="Resubmit">
                    <Link href={`/ptw/raise?correct=${permit.id}`} onClick={(e) => e.stopPropagation()}>
                      <RefreshCw className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={(e) => { e.stopPropagation(); setDetailsPermit(permit); }}>
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )) : <div className="text-center py-12 text-muted-foreground italic bg-muted/5 rounded-sm border-2 border-dashed">No records found for selected filters.</div>}
      </div>

      <div className="hidden md:block">
        <Card className="rounded-sm overflow-hidden border-primary/10">
          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <div className="min-w-[800px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="px-6 cursor-pointer hover:bg-muted/5" onClick={() => handleSort('serialNumber')}><div className="flex items-center">Serial & Site <SortIcon column="serialNumber" /></div></TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/5" onClick={() => handleSort('ptwType')}><div className="flex items-center">Type <SortIcon column="ptwType" /></div></TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/5" onClick={() => handleSort('status')}><div className="flex items-center">Status <SortIcon column="status" /></div></TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/5" onClick={() => handleSort('requestDate')}><div className="flex items-center">Request Date <SortIcon column="requestDate" /></div></TableHead>
                      <TableHead className="text-right px-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPermits.map(permit => (
                      <TableRow key={permit.id} className="hover:bg-muted/5 cursor-pointer" onClick={() => setDetailsPermit(permit)}>
                        <TableCell><div className="flex flex-col gap-0.5"><span className="font-mono text-[10px] font-bold text-primary">{permit.serialNumber || permit.id.slice(0, 8)}</span><span className="font-bold text-sm truncate max-w-[180px]">{permit.siteName}</span></div></TableCell>
                        <TableCell className="text-xs font-semibold">{permit.ptwType}</TableCell>
                        <TableCell><StatusBadge permit={permit} /></TableCell>
                        <TableCell className="text-[10px] font-bold text-muted-foreground">{formatTimestamp(permit.requestDate)}</TableCell>
                        <TableCell className="text-right px-6">
                          <div className="flex justify-end gap-1">
                            <WhatsAppUpdateEngineer permit={permit} />
                            {permit.status === 'Rejected' && (
                              <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-amber-600 rounded-sm" title="Resubmit with Corrections">
                                <Link href={`/ptw/raise?correct=${permit.id}`} onClick={(e) => e.stopPropagation()}>
                                  <RefreshCw className="h-4 w-4" />
                                </Link>
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={(e) => { e.stopPropagation(); setDetailsPermit(permit); }} title="View Details">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!actionState} onOpenChange={() => setActionState(null)}>
        <DialogContent className="max-w-md w-[95vw] rounded-sm p-6">
          <DialogHeader className="text-left space-y-2"><DialogTitle className="text-xl font-black tracking-tight">Process Decision</DialogTitle><DialogDescription className="text-xs font-medium">Process permit {actionState?.permit?.serialNumber}</DialogDescription></DialogHeader>
          <div className="py-6 space-y-2"><Label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Action Remarks</Label><Textarea id="action-remarks" placeholder="Provide feedback or justification..." className="min-h-[120px] rounded-sm" /></div>
          <DialogFooter className="flex flex-col sm:flex-row gap-3"><DialogClose asChild><Button variant="outline" className="w-full sm:flex-1 h-12 font-bold rounded-sm text-xs">Cancel</Button></DialogClose><Button className={cn("w-full sm:flex-1 h-12 font-bold rounded-sm text-xs", actionState?.status === 'Rejected' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white')} onClick={() => { const remarks = (document.getElementById('action-remarks') as HTMLTextAreaElement)?.value || ""; if (remarks.trim()) { handleAction(actionState!.permit, actionState!.status as any, remarks); setActionState(null); } else { toast({ variant: 'destructive', title: 'Remarks Required' }); } }}>Confirm {actionState?.status === 'Rejected' ? 'Rejection' : 'Approval'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsPermit} onOpenChange={(o) => !o && handleCloseDetails()}>
        <DialogContent className="max-w-4xl w-[98vw] h-[92vh] sm:h-[95vh] p-0 border-none rounded-sm overflow-hidden flex flex-col shadow-2xl bg-background">
          <DialogHeader className="p-4 sm:p-6 bg-primary/5 border-b shrink-0 flex flex-row items-center justify-between space-y-0"><div className="flex items-center gap-3"><div className="bg-primary/10 p-2 rounded-sm"><FileText className="h-5 w-5 text-primary" /></div><div><DialogTitle className="text-base sm:text-lg font-black tracking-tight text-foreground uppercase">Permit Audit Log</DialogTitle><DialogDescription className="text-[10px] font-bold text-muted-foreground">{detailsPermit?.serialNumber}</DialogDescription></div></div></DialogHeader>
          <ScrollArea className="flex-1 bg-background">
            {detailsPermit && (
              <div id="printable-permit-area" className="p-4 sm:p-8 space-y-8 sm:space-y-12 pb-20">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 p-3 sm:p-4 bg-muted/20 border rounded-sm"><div className="space-y-1 min-w-0"><Label className="text-[8px] sm:text-[9px] font-black uppercase text-muted-foreground tracking-widest">Site Name</Label><p className="text-[11px] sm:text-xs font-bold truncate">{detailsPermit.siteName}</p></div><div className="space-y-1 min-w-0"><Label className="text-[8px] sm:text-[9px] font-black uppercase text-muted-foreground tracking-widest">PtW Type</Label><p className="text-[11px] sm:text-xs font-bold truncate">{detailsPermit.ptwType}</p></div><div className="space-y-1"><Label className="text-[8px] sm:text-[9px] font-black uppercase text-muted-foreground tracking-widest">Status</Label><div><StatusBadge permit={detailsPermit} /></div></div><div className="space-y-1"><Label className="text-[8px] sm:text-[9px] font-black uppercase text-muted-foreground tracking-widest">Submitted</Label><p className="text-[10px] sm:text-xs font-mono font-bold text-muted-foreground">{formatTimestamp(detailsPermit.requestDate)}</p></div></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10"><div className="space-y-6 sm:space-y-8"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4"><div className="p-3 sm:p-4 bg-card border rounded-sm shadow-sm flex items-center gap-3"><div className="p-2 bg-primary/10 rounded-full text-primary"><User className="h-3.5 w-3.5" /></div><div className="flex flex-col"><Label className="text-[8px] sm:text-[9px] font-black uppercase text-muted-foreground tracking-widest">Raised By</Label><p className="text-[11px] sm:text-xs font-black">{detailsPermit.siteEngineerName || 'N/A'}</p></div></div><div className="p-3 sm:p-4 bg-card border rounded-sm shadow-sm flex items-center gap-3"><div className="p-2 bg-green-500/10 rounded-full text-green-600"><ShieldCheck className="h-3.5 w-3.5" /></div><div className="flex flex-col"><Label className="text-[8px] sm:text-[9px] font-black uppercase text-muted-foreground tracking-widest">Approved By</Label><p className="text-[11px] sm:text-xs font-black">{detailsPermit.timeline?.find(t => t.status === 'Approved')?.userName || detailsPermit.timeline?.find(t => t.status === 'ManagerApproved')?.userName || 'Awaiting'}</p></div></div></div><div className="space-y-2"><Label className="text-[8px] sm:text-[9px] font-black uppercase text-primary tracking-[0.2em] flex items-center gap-2"><FileText className="h-3 w-3" /> Work Description</Label><div className="p-4 sm:p-6 bg-primary/[0.02] border-2 border-primary/5 rounded-sm text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-medium italic shadow-inner">"{detailsPermit.descriptionOfWork}"</div></div></div><div className="space-y-6 sm:space-y-8"><div className="space-y-2"><Label className="text-[8px] sm:text-[9px] font-black uppercase text-primary tracking-[0.2em] flex items-center gap-2"><MapPin className="h-3 w-3" /> Verified GPS Coordinates</Label>{detailsPermit.latitude ? (<div className="p-3 sm:p-4 bg-primary/5 border-2 border-primary/10 rounded-sm flex items-center justify-between shadow-sm group hover:border-primary/30 transition-all"><div className="flex flex-col gap-0.5"><span className="text-[8px] sm:text-[9px] font-black text-muted-foreground uppercase tracking-tighter">Site Position Stamped</span><span className="font-mono text-[10px] sm:text-xs font-black text-primary">{detailsPermit.latitude.toFixed(6)}, {detailsPermit.longitude?.toFixed(6)}</span></div><Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 rounded-sm no-print border-primary/20 bg-white text-primary" asChild><a href={`https://www.google.com/maps/search/?api=1&query=${detailsPermit.latitude},${detailsPermit.longitude}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></a></Button></div>) : (<div className="p-4 bg-muted/20 border border-dashed rounded-sm text-center"><p className="text-xs italic text-muted-foreground font-medium">GPS location data not attached.</p></div>)}</div></div></div>
                <Separator />
                <div className="space-y-4 sm:space-y-6"><div className="flex items-center gap-2"><Paperclip className="h-3.5 w-3.5 text-primary" /><h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-foreground">Attachments</h3></div>{detailsPermit.attachments && detailsPermit.attachments.length > 0 ? (<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">{detailsPermit.attachments.map((file, idx) => (<div key={idx} className="group relative aspect-square rounded-sm overflow-hidden border bg-muted flex flex-col items-center justify-center">{isImage(file) ? (<><img src={file.url} alt={file.name} className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105" onClick={() => openViewer(file, detailsPermit.attachments!)}/><div className="absolute inset-0 bg-black/40 group-hover:opacity-100 flex items-center justify-center pointer-events-none"><Maximize2 className="h-5 w-5 text-white" /></div><div className="absolute bottom-0 left-0 right-0 p-1 bg-black/60 text-white text-[7px] font-bold uppercase truncate text-center">{file.name}</div></>) : isVideo(file) ? (<div className="relative w-full h-full bg-slate-900 flex flex-col items-center justify-center cursor-pointer group" onClick={() => openViewer(file, detailsPermit.attachments!)}><Film className="h-8 w-8 sm:h-10 sm:w-10 text-white opacity-40" /><div className="absolute inset-0 bg-black/40 group-hover:opacity-100 transition-opacity flex items-center justify-center"><PlayCircle className="h-6 w-6 sm:h-8 sm:w-8 text-white" /></div><div className="absolute bottom-0 left-0 right-0 p-1 bg-black/60 text-white text-[7px] font-bold uppercase truncate text-center">Video: {file.name}</div></div>) : (<div className="flex flex-col items-center justify-between p-2 h-full w-full bg-background border"><div className="flex-1 flex flex-col items-center justify-center gap-1.5"><FileText className={cn("h-6 w-6 sm:h-8 sm:w-8", file.contentType?.includes('pdf') ? "text-red-500" : "text-blue-500")} /><span className="text-[7px] sm:text-[8px] font-bold uppercase text-center line-clamp-2">{file.name}</span></div><Button variant="secondary" size="sm" className="w-full h-5 sm:h-6 text-[7px] sm:text-[8px] font-bold uppercase rounded-none mt-1" asChild><a href={file.url} target="_blank" rel="noopener noreferrer">View File</a></Button></div>)}</div>))}</div>) : (<div className="p-8 sm:p-12 text-center border-2 border-dashed rounded-sm bg-muted/5"><ImageIcon className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/20 mx-auto mb-2 sm:mb-3" /><p className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-widest italic">No files attached to this permit.</p></div>)}</div>
                <Separator />
                <div className="space-y-4 sm:space-y-6"><h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2"><History className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />History</h3><div className="relative border-l-2 border-muted ml-3 pl-4 sm:pl-6 space-y-6 sm:space-y-8">{[...(detailsPermit.timeline || [])].sort((a, b) => (b.timestamp?.toDate?.() || 0) - (a.timestamp?.toDate?.() || 0)).map((entry, idx) => (<div key={idx} className="relative"><div className="absolute -left-[25px] sm:-left-[31px] top-1 h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-primary ring-4 ring-background" /><div className="flex flex-col gap-1 sm:gap-1.5"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4"><span className="text-[10px] sm:text-xs font-bold uppercase tracking-tight text-primary leading-tight">{entry.action} — {entry.userName}</span><span className="text-[8px] font-mono font-bold text-muted-foreground uppercase">{formatTimestamp(entry.timestamp)}</span></div><p className="text-xs sm:text-sm italic font-medium leading-relaxed opacity-80">"{entry.remarks}"</p></div></div>))}</div></div>
              </div>
            )}
          </ScrollArea>
          <DialogFooter className="p-3 sm:p-4 bg-muted/5 border-t gap-2 sm:gap-3 shrink-0 no-print">
            {detailsPermit && detailsPermit.status !== 'Approved' && detailsPermit.status !== 'Rejected' && (
              <>
                {((userRole === 'Site Manager' && detailsPermit.status === 'Pending' && detailsPermit.siteManagerId === user?.uid) || 
                  (isAdmin && detailsPermit.status === 'ManagerApproved' && (!detailsPermit.authorizedAdminIds || detailsPermit.authorizedAdminIds.length === 0 || detailsPermit.authorizedAdminIds.includes(user?.uid) || detailsPermit.authorizedAdminId === user?.uid || isSuper))) && (
                  <div className="flex-1 flex gap-2">
                    <Button className="flex-1 h-10 sm:h-12 rounded-sm font-bold text-[10px] sm:text-xs bg-green-600 hover:bg-green-700 text-white shadow-lg" onClick={() => { setDetailsPermit(null); setActionState({ permit: detailsPermit, status: isAdmin && detailsPermit.status === 'ManagerApproved' ? 'Approved' : 'ManagerApproved' }); }}>Approve</Button>
                    <Button variant="destructive" className="flex-1 h-10 sm:h-12 rounded-sm font-bold text-[10px] sm:text-xs shadow-lg" onClick={() => { setDetailsPermit(null); setActionState({ permit: detailsPermit, status: 'Rejected' }); }}>Reject</Button>
                  </div>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modern High-Fidelity Media Viewer Overlay */}
      <Dialog open={!!viewFile} onOpenChange={(o) => { if(!o) { resetViewer(); setViewFile(null); setViewFiles([]); } }}>
        <DialogContent className="max-w-[95vw] h-[90vh] p-0 border-none bg-black/95 flex flex-col items-center justify-center rounded-sm overflow-hidden shadow-2xl">
          <DialogHeader className="sr-only"><DialogTitle>Media Audit</DialogTitle><DialogDescription>Visual evidence review</DialogDescription></DialogHeader>
          
          {/* Top Toolbar */}
          <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent no-print">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-1.5 rounded-sm"><ImageIcon className="h-4 w-4 text-white" /></div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-white uppercase tracking-widest truncate max-w-[150px] sm:max-w-xs">{viewFile?.name}</span>
                <span className="text-[8px] font-bold text-white/60 uppercase">{currentFileIndex + 1} of {viewFiles.length} </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-white/5 hover:bg-white/20 text-white border-none" onClick={() => setScale(prev => Math.min(prev + 0.5, 4))}><ZoomIn className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-white/5 hover:bg-white/20 text-white border-none" onClick={() => { setScale(prev => Math.max(prev - 0.5, 1)); if(scale <= 1) setPosition({x:0,y:0}); }}><ZoomOut className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-white/5 hover:bg-white/20 text-white border-none" onClick={resetViewer}><RotateCcw className="h-4 w-4" /></Button>
              <Separator orientation="vertical" className="h-6 bg-white/20 mx-2" />
              <DialogClose asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-white/10 hover:bg-red-500 text-white border-none transition-colors"><X className="h-5 w-5" /></Button></DialogClose>
            </div>
          </div>

          {/* Navigation Controls */}
          {viewFiles.length > 1 && (
            <>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50 no-print">
                <Button variant="secondary" size="icon" className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white border-none shadow-2xl backdrop-blur-md" onClick={(e) => { e.stopPropagation(); prevFile(); }}><ChevronLeft className="h-8 w-8" /></Button>
              </div>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 z-50 no-print">
                <Button variant="secondary" size="icon" className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white border-none shadow-2xl backdrop-blur-md" onClick={(e) => { e.stopPropagation(); nextFile(); }}><ChevronRight className="h-8 w-8" /></Button>
              </div>
            </>
          )}

          {/* Canvas Engine */}
          <div 
            ref={containerRef}
            className={cn(
              "relative w-full h-full flex items-center justify-center overflow-hidden touch-none",
              scale > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
            )}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
          >
            <div 
              ref={mediaRef}
              className={cn(
                "transition-transform duration-200 ease-out will-change-transform flex items-center justify-center select-none pointer-events-none w-fit h-fit",
                isDragging && "transition-none"
              )}
              style={{ 
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              }}
            >
              {viewFile && (
                isVideo(viewFile) ? (
                  <div className="pointer-events-auto">
                    <video 
                      src={viewFile.url} 
                      controls 
                      autoPlay 
                      className="max-w-[90vw] max-h-[80vh] shadow-2xl rounded-sm" 
                    />
                  </div>
                ) : (
                  <img 
                    src={viewFile.url} 
                    className="max-w-[90vw] max-h-[80vh] object-contain shadow-2xl rounded-sm pointer-events-none" 
                    alt="Evidence View" 
                    draggable={false}
                  />
                )
              )}
            </div>
          </div>

          {/* Footer Metadata */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent flex flex-col items-center gap-2 no-print">
            <div className="flex gap-1">
              {viewFiles.map((_, i) => (
                <div key={i} className={cn("h-1 w-4 rounded-full transition-all", i === currentFileIndex ? "bg-primary w-8" : "bg-white/20")} />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
