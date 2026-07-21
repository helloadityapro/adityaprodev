'use client';

import * as React from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, or, serverTimestamp, increment, getDoc, and, limit, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format, subDays, subMonths, subYears } from 'date-fns';
import { 
  FileText, 
  Search, 
  Pencil, 
  Trash2, 
  Loader2, 
  Clock, 
  Calendar, 
  FilterX, 
  MessageCircle, 
  User, 
  Building2, 
  Globe, 
  ImageIcon, 
  Film, 
  Maximize2, 
  PlayCircle, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Download, 
  FileImage, 
  Share2,
  Tags,
  ChevronDown,
  Check,
  ArrowRight
} from 'lucide-react';
import { isSuperAdmin } from '@/lib/auth-constants';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { slugifyRole } from '@/lib/access-control';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';

type Attachment = {
  url: string;
  name: string;
  contentType: string;
};

type DPR = {
  id: string;
  siteId: string;
  siteName: string;
  reportDate: string;
  description: string;
  userId: string;
  userName: string;
  siteManagerId: string | null;
  createdAt: any;
  editedBy?: string;
  editedAt?: any;
  dprType?: 'site' | 'other';
  attachments?: Attachment[];
};

type AccessConfig = {
  id: string;
  ownDataOnly?: boolean;
};

export default function DPRListPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  
  const [searchTerm, setSearchTerm] = React.useState("");
  const [dateFilter, setDateFilter] = React.useState<string>("7days");
  const [activeTab, setActiveTab] = React.useState<string>("site");
  const [customStart, setCustomStart] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedGroupIds, setSelectedGroupIds] = React.useState<string[]>([]);
  
  const [editingDpr, setEditingDpr] = React.useState<DPR | null>(null);
  const [deletingDpr, setDeletingDpr] = React.useState<DPR | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // Viewer State
  const [viewUrl, setViewUrl] = React.useState<string | null>(null);
  const [viewUrls, setViewUrls] = React.useState<string[]>([]);
  const [currentUrlIndex, setCurrentUrlIndex] = React.useState(0);
  const [scale, setScale] = React.useState(1);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [startPan, setStartPan] = React.useState({ x: 0, y: 0 });
  
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mediaRef = React.useRef<HTMLDivElement>(null);
  const viewerRef = React.useRef<HTMLDivElement>(null);

  // Persistence logic for active tab
  React.useEffect(() => {
    const savedTab = localStorage.getItem('dprActiveTab');
    if (savedTab && (savedTab === 'site' || savedTab === 'other')) {
      setActiveTab(savedTab);
    }
  }, []);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    localStorage.setItem('dprActiveTab', val);
  };

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<AccessConfig>(roleConfigsQuery);

  const siteGroupsQuery = useMemoFirebase(() => collection(firestore, 'site_groups'), [firestore]);
  const { data: siteGroups } = useCollection<any>(siteGroupsQuery);

  const isSuper = isSuperAdmin(user?.email);
  const isAdmin = isSuper || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';
  const userRoleStr = isAdmin ? 'admin' : (userProfile?.role ? slugifyRole(userProfile.role) : 'site-engineer');

  const dprsQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const colRef = collection(firestore, 'dprs');
    
    if (isAdmin) return colRef;
    
    if (isManager) {
        return query(
            colRef, 
            or(where('userId', '==', user.uid), where('siteManagerId', '==', user.uid))
        );
    }
    
    return query(colRef, where('userId', '==', user.uid));
  }, [firestore, user, userProfile, isAdmin, isManager]);

  const { data: dprs, isLoading: dprsLoading } = useCollection<DPR>(dprsQuery);

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

  const sortedAndFilteredDprs = React.useMemo(() => {
    if (!dprs || !userProfile) return [];
    
    const isOwnDataOnly = userProfile.ownDataOnly !== undefined 
      ? userProfile.ownDataOnly 
      : roleConfigs?.find(c => c.id === userRoleStr)?.ownDataOnly ?? false;

    const { start, end } = queryDateRange;
    let result = dprs;

    if (isOwnDataOnly && !isSuper) {
      const assignedIds = new Set(userProfile.assignedProjectIds || []);
      result = result.filter(dpr => {
        if (dpr.dprType === 'other') return true;
        return assignedIds.has(dpr.siteId);
      });
    }

    // Site Group Filter
    if (selectedGroupIds.length > 0 && activeTab === 'site' && siteGroups) {
      const allowedSiteIds = new Set<string>();
      siteGroups.filter(g => selectedGroupIds.includes(g.id)).forEach(g => {
        g.siteIds?.forEach((id: string) => allowedSiteIds.add(id));
      });
      result = result.filter(dpr => allowedSiteIds.has(dpr.siteId));
    }

    result = result.filter(dpr => {
      const matchesTab = (dpr.dprType || 'site') === activeTab;
      if (!matchesTab) return false;

      const matchesSearch = dpr.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (dpr.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        dpr.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDate = dpr.reportDate >= start && dpr.reportDate <= end;
      
      return matchesSearch && matchesDate;
    });

    return result.sort((a, b) => {
        const dateA = new Date(a.reportDate || (a.createdAt?.toDate?.() || 0)).getTime();
        const dateB = new Date(b.reportDate || (b.createdAt?.toDate?.() || 0)).getTime();
        return dateB - dateA;
    });
  }, [dprs, searchTerm, queryDateRange, userProfile, roleConfigs, isSuper, activeTab, userRoleStr, selectedGroupIds, siteGroups]);

  const handleDelete = async () => {
    if (!deletingDpr || !firestore) return;

    try {
        const engineerId = deletingDpr.userId;
        const managerId = deletingDpr.siteManagerId;

        const engRef = doc(firestore, 'users', engineerId);
        const engSnap = await getDoc(engRef);
        const multiplier = engSnap.exists() ? engSnap.data()?.pointsMultiplier || 1 : 1;
        
        updateDocumentNonBlocking(engRef, {
            totalPoints: increment(-(1.0 * multiplier))
        });

        if (managerId) {
            updateDocumentNonBlocking(doc(firestore, 'users', managerId), {
                totalPoints: increment(-0.25)
            });
        }

        deleteDocumentNonBlocking(doc(firestore, 'dprs', deletingDpr.id));
        toast({ title: "Deleted", description: "Report and associated points have been removed." });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not complete deletion logic.' });
    } finally {
        setDeletingDpr(null);
    }
  };

  const handleEditSave = () => {
    if (!editingDpr || !editingDpr.description.trim() || !userProfile) return;
    setIsSaving(true);
    updateDocumentNonBlocking(doc(firestore, 'dprs', editingDpr.id), {
        description: editingDpr.description,
        reportDate: editingDpr.reportDate,
        editedBy: userProfile.username || user?.email || "Unknown",
        editedAt: serverTimestamp()
    });
    toast({ title: "Updated", description: "Report has been updated successfully." });
    setIsSaving(false);
    setEditingDpr(null);
  };

  const handleWhatsAppShare = (dpr: DPR) => {
    const message = `*Aditya Pro - Daily Progress Report*\n\n*Site:* ${dpr.siteName}\n*Date:* ${format(new Date(dpr.reportDate), 'dd MMM yyyy')}\n*Submitted By:* ${dpr.userName}\n\n*Activities:*\n${dpr.description}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const clearFilters = () => {
    setSearchTerm("");
    setDateFilter("7days");
    setSelectedGroupIds([]);
  };

  const isVideoUrl = (url: string) => {
    const lowUrl = url.toLowerCase();
    return lowUrl.includes('.mp4') || lowUrl.includes('.mov') || lowUrl.includes('.webm') || lowUrl.includes('.ogg');
  };

  const resetViewer = () => { 
    setScale(1); 
    setPosition({ x: 0, y: 0 }); 
  };

  const openViewer = (url: string, dpr: DPR) => {
    const urls = dpr.attachments?.map(a => a.url) || [];
    const index = urls.indexOf(url);
    setViewUrls(urls);
    setCurrentUrlIndex(index >= 0 ? index : 0);
    setViewUrl(url);
    resetViewer();
  };

  const nextUrl = () => {
    if (viewUrls.length <= 1) return;
    const nextIdx = (currentUrlIndex + 1) % viewUrls.length;
    setCurrentUrlIndex(nextIdx);
    setViewUrl(viewUrls[nextIdx]);
    resetViewer();
  };

  const prevUrl = () => {
    if (viewUrls.length <= 1) return;
    const prevIdx = (currentUrlIndex - 1 + viewUrls.length) % viewUrls.length;
    setCurrentUrlIndex(prevIdx);
    setViewUrl(viewUrls[prevIdx]);
    resetViewer();
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!viewUrl || isVideoUrl(viewUrl)) return;
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    const newScale = Math.min(Math.max(scale + delta, 1), 4);
    setScale(newScale);
    if (newScale === 1) setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1 || (viewUrl && isVideoUrl(viewUrl))) return;
    setIsDragging(true);
    setStartPan({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    const newX = e.clientX - startPan.x;
    const newY = e.clientY - startPan.y;
    const limitX = Math.max(0, (window.innerWidth * scale - window.innerWidth) / 2);
    const limitY = Math.max(0, (window.innerHeight * scale - window.innerHeight) / 2);
    setPosition({ x: Math.min(Math.max(newX, -limitX), limitX), y: Math.min(Math.max(newY, -limitY), limitY) });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleDoubleClick = () => {
    if (viewUrl && isVideoUrl(viewUrl)) return;
    if (scale > 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2);
    }
  };

  function renderTable() {
    return (
      <>
        {/* Mobile Card Layout */}
        <div className="md:hidden divide-y">
          {sortedAndFilteredDprs.length > 0 ? sortedAndFilteredDprs.map((dpr) => (
            <div key={dpr.id} className="p-4 space-y-3 bg-card hover:bg-muted/5 transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">
                    {dpr.reportDate ? format(new Date(dpr.reportDate), 'dd MMM yyyy') : '—'}
                  </span>
                  <h3 className="font-bold text-sm leading-tight text-foreground truncate">{dpr.siteName}</h3>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <Badge variant="outline" className="text-[8px] font-black uppercase rounded-sm border-primary/20 text-primary">
                    DPR
                  </Badge>
                  <div className="flex gap-1.5">
                    {dpr.attachments?.some(a => isVideoUrl(a.url)) && <Film className="h-3 w-3 text-primary/40" />}
                    {dpr.attachments?.some(a => !isVideoUrl(a.url)) && <ImageIcon className="h-3 w-3 text-primary/40" />}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                <User className="h-3 w-3 text-primary" />
                <span>{dpr.userName}</span>
              </div>

              <div className="space-y-2">
                {dpr.description.split('\n\n').filter(p => p.trim() !== '').map((para, pIdx) => (
                  <p key={pIdx} className="text-xs italic text-primary leading-relaxed line-clamp-3">
                    "{para.trim()}"
                  </p>
                ))}
              </div>

              {dpr.attachments && dpr.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {dpr.attachments.map((att, attIdx) => (
                    <div key={attIdx} className="relative w-12 h-12 rounded-sm overflow-hidden border bg-muted cursor-pointer" onClick={() => openViewer(att.url, dpr)}>
                      {isVideoUrl(att.url) ? (
                        <div className="w-full h-full flex items-center justify-center bg-slate-900"><Film className="h-4 w-4 text-white/40" /></div>
                      ) : (
                        <img src={att.url} className="w-full h-full object-cover" alt="Audit" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {dpr.editedBy && (
                <div className="flex items-center gap-1.5 text-[9px] text-primary/70 font-medium bg-primary/5 p-1.5 rounded-sm">
                  <Clock className="h-2.5 w-2.5" />
                  <span>Edited by {dpr.editedBy} on {dpr.editedAt ? format(dpr.editedAt.toDate(), 'dd MMM HH:mm') : '—'}</span>
                </div>
              )}

              <div className="pt-2 border-t flex justify-end items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 rounded-sm" onClick={(e) => { e.stopPropagation(); handleWhatsAppShare(dpr); }} title="Push to WhatsApp">
                  <MessageCircle className="h-4 w-4" />
                </Button>
                {dpr.userId === user?.uid && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => setEditingDpr(dpr)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {(dpr.userId === user?.uid || dpr.siteManagerId === user?.uid || isAdmin) && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => setDeletingDpr(dpr)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )) : (
            <div className="p-12 text-center text-muted-foreground italic text-sm">No records found.</div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-32">Date</TableHead>
                <TableHead>Location / Site</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="min-w-[300px]">Update & Activity</TableHead>
                <TableHead>Attachments</TableHead>
                <TableHead className="text-right px-6 no-print">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAndFilteredDprs.length > 0 ? sortedAndFilteredDprs.map((dpr) => (
                <TableRow key={dpr.id} className="hover:bg-muted/5">
                  <TableCell className="font-medium whitespace-nowrap">
                      {dpr.reportDate ? format(new Date(dpr.reportDate), 'dd MMM yyyy') : '—'}
                  </TableCell>
                  <TableCell className="font-semibold">{dpr.siteName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div className="font-medium text-foreground">{dpr.userName || '—'}</div>
                  </TableCell>
                  <TableCell className="max-w-md py-4">
                      <div className="space-y-3 mb-3">
                          {dpr.description.split('\n\n').filter(p => p.trim() !== '').map((para, pIdx, arr) => (
                              <React.Fragment key={pIdx}>
                                  <p className="text-sm italic text-primary leading-relaxed">
                                      "{para.trim()}"
                                  </p>
                                  {pIdx < arr.length - 1 && (
                                      <div className="h-px bg-primary/10 my-2" />
                                  )}
                              </React.Fragment>
                          ))}
                      </div>
                      {dpr.editedBy && (
                          <div className="flex items-center gap-1.5 text-[10px] text-primary/70 font-medium border-t border-primary/5 pt-2">
                              <span className="bg-primary/10 px-1 rounded">Edited</span>
                              <span>by {dpr.editedBy}</span>
                              {dpr.editedAt && (
                                  <span className="text-muted-foreground/60 flex items-center gap-1">
                                      <Clock className="h-2.5 w-2.5" />
                                      {format(dpr.editedAt.toDate(), 'dd MMM HH:mm')}
                                  </span>
                              )}
                          </div>
                      )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5 w-24">
                      {dpr.attachments?.map((att, idx) => (
                        <div key={idx} className="relative w-8 h-8 rounded-sm overflow-hidden border bg-muted cursor-pointer hover:border-primary/50 transition-colors" onClick={() => openViewer(att.url, dpr)}>
                           {isVideoUrl(att.url) ? <Film className="w-full h-full p-1.5 text-primary/40" /> : <img src={att.url} className="w-full h-full object-cover" alt="DPR Proof" />}
                        </div>
                      ))}
                      {(!dpr.attachments || dpr.attachments.length === 0) && <span className="text-[10px] italic text-muted-foreground/30">None</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right px-6 no-print">
                      <div className="flex justify-end items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-50" onClick={() => handleWhatsAppShare(dpr)} title="Share on WhatsApp">
                              <Share2 className="h-4 w-4" />
                          </Button>
                          {dpr.userId === user?.uid && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setEditingDpr(dpr)}>
                                  <Pencil className="h-4 w-4" />
                              </Button>
                          )}
                          {(dpr.userId === user?.uid || dpr.siteManagerId === user?.uid || isAdmin) && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingDpr(dpr)}>
                                  <Trash2 className="h-4 w-4" />
                              </Button>
                          )}
                      </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic text-xs">No records found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1 no-print">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" /> DPR Data Registry
          </h1>
          <p className="text-muted-foreground text-sm font-medium">Historical log of all progress updates across authorized locations.</p>
        </div>
      </div>

      <div className="bg-card p-3 border rounded-sm shadow-sm no-print">
        <div className="flex flex-wrap items-end gap-2 md:gap-3">
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest px-1">Search Records</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input 
                placeholder="Search site, user or update..." 
                className="pl-8 h-9 text-xs rounded-sm border-primary/10 bg-background"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="w-[110px] sm:w-[130px] space-y-1.5">
            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest px-1">Groups</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  disabled={activeTab !== 'site'}
                  className={cn(
                    "w-full justify-between h-9 rounded-sm border-primary/20 bg-background font-bold text-[10px] uppercase px-2",
                    selectedGroupIds.length > 0 && "border-primary text-primary"
                  )}
                >
                  <div className="flex items-center gap-1 truncate">
                    <Tags className="h-3.5 w-3.5 opacity-50" />
                    <span className="truncate">
                      {selectedGroupIds.length === 0 ? "All" : `${selectedGroupIds.length}`}
                    </span>
                  </div>
                  <ChevronDown className="h-3 w-3 opacity-50 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-0 rounded-sm border-primary/10 shadow-2xl overflow-hidden">
                <div className="bg-primary/5 p-3 border-b">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Organizational Groups</h3>
                </div>
                <ScrollArea className="h-[250px]">
                  <div className="p-2 space-y-1">
                    {siteGroups?.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || "")).map((group: any) => (
                      <div 
                        key={group.id} 
                        className={cn(
                          "flex items-center space-x-2 p-2 rounded-sm hover:bg-muted/50 transition-colors cursor-pointer",
                          selectedGroupIds.includes(group.id) && "bg-primary/10"
                        )}
                        onClick={() => setSelectedGroupIds(prev => prev.includes(group.id) ? prev.filter(id => id !== group.id) : [...prev, group.id])}
                      >
                        <Checkbox checked={selectedGroupIds.includes(group.id)} onCheckedChange={() => {}} />
                        <span className="text-xs font-bold uppercase truncate">{group.name}</span>
                      </div>
                    ))}
                    {(!siteGroups || siteGroups.length === 0) && (
                      <p className="p-4 text-center text-[10px] uppercase font-bold text-muted-foreground opacity-30">No groups registered</p>
                    )}
                  </div>
                </ScrollArea>
                {selectedGroupIds.length > 0 && (
                  <Button variant="ghost" onClick={() => setSelectedGroupIds([])} className="w-full rounded-none h-8 text-[9px] font-black uppercase text-primary border-t">Reset Filter</Button>
                )}
              </PopoverContent>
            </Popover>
          </div>

          <div className="w-[110px] sm:w-[140px] space-y-1.5">
            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest px-1">Time</Label>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="h-9 rounded-sm border-primary/20 bg-background font-bold text-[10px] uppercase">
                <Calendar className="h-3.5 w-3.5 mr-1.5 opacity-50" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today" className="text-[10px] font-bold uppercase">Today</SelectItem>
                <SelectItem value="yesterday" className="text-[10px] font-bold uppercase">Yesterday</SelectItem>
                <SelectItem value="7days" className="text-[10px] font-bold uppercase">7 Days</SelectItem>
                <SelectItem value="lastMonth" className="text-[10px] font-bold uppercase">Month</SelectItem>
                <SelectItem value="lastYear" className="text-[10px] font-bold uppercase">Year</SelectItem>
                <SelectItem value="allTime" className="text-[10px] font-bold uppercase">All</SelectItem>
                <SelectItem value="custom" className="text-[10px] font-bold uppercase text-primary">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-sm text-muted-foreground border border-transparent hover:border-primary/10 shrink-0" onClick={clearFilters} title="Clear Filters">
            <FilterX className="h-4 w-4" />
          </Button>
        </div>

        {dateFilter === 'custom' && (
           <div className="flex items-center gap-3 pt-3 border-t border-border/50 mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
             <div className="flex-1 space-y-1">
                <Label className="text-[9px] font-black uppercase text-primary tracking-widest px-1">Start Range</Label>
                <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-8 text-[10px] rounded-sm border-primary/20" />
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground mt-4 shrink-0" />
              <div className="flex-1 space-y-1">
                <Label className="text-[9px] font-black uppercase text-primary tracking-widest px-1">End Range</Label>
                <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-8 text-[10px] rounded-sm border-primary/20" />
              </div>
           </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-muted/50 border border-primary/10 rounded-sm p-1 h-11 mb-6">
          <TabsTrigger value="site" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
            <Building2 className="h-3.5 w-3.5 mr-2" /> Projects
          </TabsTrigger>
          <TabsTrigger value="other" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
            <Globe className="h-3.5 w-3.5 mr-2" /> Others
          </TabsTrigger>
        </TabsList>

        <Card className="shadow-md border-primary/10 rounded-sm overflow-hidden">
          <CardHeader className="border-b bg-muted/5 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-sm font-bold uppercase tracking-widest">{activeTab === 'site' ? 'Project Site Reports' : 'Other Work Reports'}</CardTitle>
                <CardDescription className="text-[10px] font-medium uppercase opacity-60">
                  {queryDateRange.start} to {queryDateRange.end}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="h-6 px-3 rounded-full font-black text-[10px] bg-primary/5 text-primary border-primary/10">
                {sortedAndFilteredDprs.length} Records
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {dprsLoading ? (
              <div className="p-6 space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <TabsContent value="site" className="m-0 animate-in fade-in-50 duration-300">
                {renderTable()}
              </TabsContent>
            )}
            {!dprsLoading && (
              <TabsContent value="other" className="m-0 animate-in fade-in-50 duration-300">
                {renderTable()}
              </TabsContent>
            )}
          </CardContent>
        </Card>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editingDpr} onOpenChange={(o) => !o && setEditingDpr(null)}>
        <DialogContent className="rounded-sm max-w-lg">
            <DialogHeader>
                <DialogTitle>Edit Daily Progress Report</DialogTitle>
                <DialogDescription>Update the details for your site report at {editingDpr?.siteName}.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label>Report Date</Label>
                    <Input type="date" value={editingDpr?.reportDate || ""} onChange={(e) => setEditingDpr(prev => prev ? { ...prev, reportDate: e.target.value } : null)} />
                </div>
                <div className="space-y-2">
                    <Label>Today's Update</Label>
                    <Textarea 
                        rows={6} 
                        value={editingDpr?.description || ""} 
                        onChange={(e) => setEditingDpr(prev => prev ? { ...prev, description: e.target.value } : null)} 
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setEditingDpr(null)} disabled={isSaving}>Cancel</Button>
                <Button onClick={handleEditSave} disabled={isSaving || !editingDpr?.description.trim()}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingDpr} onOpenChange={(o) => !o && setDeletingDpr(null)}>
        <AlertDialogContent className="rounded-sm">
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the progress report for <strong>{deletingDpr?.siteName}</strong> on {deletingDpr?.reportDate} and reverse any reward points earned.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete Permanently
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Media Viewer Dialog */}
      <Dialog open={!!viewUrl} onOpenChange={(o) => { if(!o) { resetViewer(); setViewUrl(null); setViewUrls([]); } }}>
        <DialogContent className="max-w-[95vw] h-[90vh] p-0 border-none bg-black/95 flex flex-col items-center justify-center rounded-sm overflow-hidden shadow-2xl">
          <DialogHeader className="sr-only"><DialogTitle>Audit Media Viewer</DialogTitle></DialogHeader>
          <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent no-print">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-1.5 rounded-sm"><ImageIcon className="h-4 w-4 text-white" /></div>
              <span className="text-[10px] font-black text-white uppercase tracking-widest truncate max-w-[150px]">Attachments</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white" onClick={() => setScale(prev => Math.min(prev + 0.5, 4))}><ZoomIn className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white" onClick={() => { setScale(prev => Math.max(prev - 0.5, 1)); if(scale <= 1) setPosition({x:0,y:0}); }}><ZoomOut className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white" onClick={resetViewer}><RotateCcw className="h-5 w-5" /></Button>
              <Separator orientation="vertical" className="h-6 bg-white/20 mx-2" />
              <DialogClose asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-red-500"><X className="h-6 w-6" /></Button></DialogClose>
            </div>
          </div>
          {viewUrls.length > 1 && (
            <>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50">
                <Button variant="secondary" size="icon" className="h-12 w-12 rounded-full bg-white/10 text-white" onClick={(e) => { e.stopPropagation(); prevUrl(); }}><ChevronLeft className="h-8 w-8" /></Button>
              </div>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 z-50">
                <Button variant="secondary" size="icon" className="h-12 w-12 rounded-full bg-white/10 text-white" onClick={(e) => { e.stopPropagation(); nextUrl(); }}><ChevronRight className="h-8 w-8" /></Button>
              </div>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
                <Badge variant="outline" className="bg-black/40 text-white border-none px-3 py-1 rounded-full font-mono text-xs">
                  {currentUrlIndex + 1} / {viewUrls.length}
                </Badge>
              </div>
            </>
          )}
          <div ref={containerRef} className={cn("relative w-full h-full flex items-center justify-center overflow-hidden touch-none", scale > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default")} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onDoubleClick={handleDoubleClick}>
            <div ref={mediaRef} className={cn("transition-transform duration-200 ease-out will-change-transform flex items-center justify-center select-none pointer-events-none w-fit h-fit", isDragging && "transition-none")} style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}>
              {viewUrl && (
                isVideoUrl(viewUrl) ? (
                  <div className="pointer-events-auto"><video src={viewUrl} controls autoPlay className="max-w-[90vw] max-h-[80vh] shadow-2xl rounded-sm" /></div>
                ) : (
                  <img src={viewUrl} className="max-w-[90vw] max-h-[80vh] object-contain shadow-2xl rounded-sm pointer-events-none" alt="Attachments" draggable={false} />
                )
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}