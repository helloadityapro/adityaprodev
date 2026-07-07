'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, getDocs, writeBatch, serverTimestamp, arrayUnion, getDoc, and } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  UserPlus, 
  Trash2, 
  Users, 
  Search, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  ChevronsUpDown, 
  Check, 
  Building2, 
  PlusCircle, 
  Loader2, 
  Pencil, 
  ShieldCheck, 
  XCircle, 
  UserCog, 
  History, 
  Plus,
  CheckCircle2,
  X,
  ChevronRight,
  Settings2,
  MapPin,
  Save,
  Truck,
  RefreshCw,
  MoreVertical,
  Mail,
  User as UserIcon,
  Tags,
  LayoutGrid,
  FilterX,
  Database,
  Workflow,
  ListChecks
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { isSuperAdmin } from "@/lib/auth-constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
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
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { slugifyRole } from '@/lib/access-control';

type User = {
  id: string;
  username?: string;
  email?: string;
  role?: 'Admin' | 'Site Manager' | 'Site Engineer' | 'Driver';
  siteManagerId?: string | null;
  assignedProjectIds?: string[];
};

type Site = {
  id: string;
  name: string;
  projectCompany: string;
};

type MappingOverride = {
  id: string;
  engineerId: string;
  siteId: string;
  managerId: string;
};

type SiteGroup = {
  id: string;
  name: string;
  siteIds: string[];
};

type SortKey = 'engineer' | 'manager' | 'sites';

export default function TeamMappingPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [activeTab, setActiveTab] = React.useState("mapping");

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const overridesQuery = useMemoFirebase(() => collection(firestore, 'team_mapping_overrides'), [firestore]);
  const { data: overrides, isLoading: overridesLoading } = useCollection<MappingOverride>(overridesQuery);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites, isLoading: sitesLoading } = useCollection<Site>(sitesQuery);

  const groupsQuery = useMemoFirebase(() => collection(firestore, 'site_groups'), [firestore]);
  const { data: siteGroups } = useCollection<SiteGroup>(groupsQuery);

  const managers = React.useMemo(() => {
    return allUsers?.filter(u => u.role === 'Site Manager' || u.role === 'Admin') || [];
  }, [allUsers]);

  const engineers = React.useMemo(() => {
    return allUsers?.filter(u => u.role === 'Site Engineer') || [];
  }, [allUsers]);

  const [selectedManagerId, setSelectedManagerId] = React.useState<string | null>(null);
  const [selectedEngineerId, setSelectedEngineerId] = React.useState<string | null>(null);
  const [overrideEngineer, setOverrideEngineer] = React.useState<User | null>(null);
  const [editingLinkUser, setEditingLinkUser] = React.useState<User | null>(null);
  const [editManagerId, setEditManagerId] = React.useState<string | null>(null);
  const [editManagerSearch, setEditManagerSearch] = React.useState("");
  const [userToDelete, setUserToDelete] = React.useState<User | null>(null);
  
  const [assignUser, setAssignUser] = React.useState<User | null>(null);
  const [assignUserSearch, setAssignUserSearch] = React.useState("");
  const [isAssignUserPopoverOpen, setIsAssignUserPopoverOpen] = React.useState(false);
  const [localSiteIds, setLocalSiteIds] = React.useState<string[]>([]);
  const [siteSearch, setSiteSearch] = React.useState("");
  const [isSiteSearchOpen, setIsSiteSearchOpen] = React.useState(false);

  const [isMapping, setIsMapping] = React.useState(false);
  const [isAddingOverride, setIsAddingOverride] = React.useState(false);
  const [isUpdatingLink, setIsUpdatingLink] = React.useState(false);
  const [isUpdatingSites, setIsUpdatingSites] = React.useState(false);
  const [isReconciling, setIsReconciling] = React.useState(false);
  const [newOverrideSiteId, setNewOverrideSiteId] = React.useState<string | "">("");
  const [newOverrideManagerId, setNewOverrideManagerId] = React.useState<string | "">("");

  const [isManagerPopoverOpen, setIsManagerPopoverOpen] = React.useState(false);
  const [managerSearchQuery, setManagerSearchQuery] = React.useState("");
  const [isEngineerPopoverOpen, setIsEngineerPopoverOpen] = React.useState(false);
  const [engineerSearchQuery, setEngineerSearchQuery] = React.useState("");

  const [tableEngineerSearch, setTableEngineerSearch] = React.useState('');
  const [tableManagerSearch, setTableManagerSearch] = React.useState('');
  const [tableSiteSearch, setTableSiteSearch] = React.useState('');

  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'manager', direction: 'asc' });

  const syncManagerSites = async (managerId: string) => {
    try {
      const q = query(collection(firestore, 'users'), where('siteManagerId', '==', managerId));
      const snap = await getDocs(q);
      
      const allTeamSites = new Set<string>();
      snap.docs.forEach(d => {
          const data = d.data();
          const sites = data.assignedProjectIds || [];
          sites.forEach((id: string) => {
            const hasOtherOverride = overrides?.some(o => o.engineerId === d.id && o.siteId === id && o.managerId !== managerId);
            if (!hasOtherOverride) {
              allTeamSites.add(id);
            }
          });
      });

      const ovQ = query(collection(firestore, 'team_mapping_overrides'), where('managerId', '==', managerId));
      const ovSnap = await getDocs(ovQ);
      ovSnap.docs.forEach(d => allTeamSites.add(d.data().siteId));

      const managerRef = doc(firestore, 'users', managerId);
      updateDocumentNonBlocking(managerRef, { assignedProjectIds: Array.from(allTeamSites) });
    } catch (e) {
      console.error("Manager inheritance sync failed", e);
    }
  };

  const handleRecconcileAllAccess = async () => {
    if (!isAdmin || !allUsers || !overrides) return;
    setIsReconciling(true);
    try {
        const managersList = allUsers.filter(u => u.role === 'Admin' || u.role === 'Site Manager');
        for (const manager of managersList) {
            await syncManagerSites(manager.id);
        }
        toast({ title: 'Global Access Synced', description: 'All reporting lines and overrides have been reconciled.' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Sync Failed', description: e.message });
    } finally {
        setIsReconciling(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedManagerId || !selectedEngineerId) return;
    setIsMapping(true);

    try {
        const engineerRef = doc(firestore, 'users', selectedEngineerId);
        updateDocumentNonBlocking(engineerRef, { 
          siteManagerId: selectedManagerId,
          role: 'Site Engineer'
        });
        
        await syncManagerSites(selectedManagerId);
        
        toast({ title: 'Team Link Created', description: 'Default reporting line established.' });
        setSelectedEngineerId(null);
        setSelectedManagerId(null);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsMapping(false);
    }
  };

  const handleUpdateLink = async () => {
    if (!editingLinkUser || !editManagerId) return;
    setIsUpdatingLink(true);
    try {
      const oldManagerId = editingLinkUser.siteManagerId;
      const userRef = doc(firestore, 'users', editingLinkUser.id);
      updateDocumentNonBlocking(userRef, {
        siteManagerId: editManagerId,
        updatedAt: serverTimestamp()
      });

      await syncManagerSites(editManagerId);
      if (oldManagerId) await syncManagerSites(oldManagerId);

      toast({ title: 'Mapping Updated', description: `Reporting line for ${editingLinkUser.username} has been changed.` });
      setEditingLinkUser(null);
      setEditManagerId(null);
      setEditManagerSearch("");
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
    } finally {
      setIsUpdatingLink(false);
    }
  };

  const handleAddOverride = async () => {
    if (!overrideEngineer || !newOverrideSiteId || !newOverrideManagerId) return;
    setIsAddingOverride(true);
    try {
      await addDocumentNonBlocking(collection(firestore, 'team_mapping_overrides'), {
        engineerId: overrideEngineer.id,
        siteId: newOverrideSiteId,
        managerId: newOverrideManagerId,
        createdAt: serverTimestamp()
      });

      await syncManagerSites(newOverrideManagerId);
      if (overrideEngineer.siteManagerId) await syncManagerSites(overrideEngineer.siteManagerId);

      toast({ title: 'Override Created', description: 'Site-specific manager assigned.' });
      setNewOverrideSiteId("");
      setNewOverrideManagerId("");
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsAddingOverride(false);
    }
  };

  const handleSaveSiteAccess = async () => {
    if (!assignUser) return;
    setIsUpdatingSites(true);
    try {
      const userRef = doc(firestore, 'users', assignUser.id);
      updateDocumentNonBlocking(userRef, { assignedProjectIds: localSiteIds });

      if (assignUser.role === 'Site Engineer' && assignUser.siteManagerId) {
        await syncManagerSites(assignUser.siteManagerId);
      }

      toast({ title: 'Access Updated', description: `Site permissions for ${assignUser.username} saved.` });
      setAssignUser(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
    } finally {
      setIsUpdatingSites(false);
    }
  };

  const handleAddGroupSites = (groupId: string) => {
    const group = siteGroups?.find(g => g.id === groupId);
    if (!group) return;
    
    const newIds = new Set([...localSiteIds, ...group.siteIds]);
    setLocalSiteIds(Array.from(newIds));
    toast({ title: 'Group Sites Added', description: `Imported ${group.siteIds.length} locations from "${group.name}".` });
  };

  const handleRemoveOverride = async (override: MappingOverride) => {
    try {
      deleteDocumentNonBlocking(doc(firestore, 'team_mapping_overrides', override.id));
      await syncManagerSites(override.managerId);
      const eng = allUsers?.find(u => u.id === override.engineerId);
      if (eng?.siteManagerId) await syncManagerSites(eng.siteManagerId);
      toast({ title: 'Override Removed' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const handleConfirmDeleteMapping = async () => {
    if (!userToDelete) return;
    try {
      const oldManagerId = userToDelete.siteManagerId;
      const ref = doc(firestore, 'users', userToDelete.id);
      updateDocumentNonBlocking(ref, { siteManagerId: null });
      if (oldManagerId) await syncManagerSites(oldManagerId);
      toast({ title: 'Mapping Removed', description: `Default reporting line for ${userToDelete.username} has been removed.` });
      setUserToDelete(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const filteredMappings = React.useMemo(() => {
    if (!engineers || !managers) return [];
    
    return engineers
      .filter(e => {
        const manager = managers.find(m => m.id === e.siteManagerId);
        const matchesEngineer = (e.username || '').toLowerCase().includes(tableEngineerSearch.toLowerCase());
        const matchesManager = (manager?.username || '').toLowerCase().includes(tableManagerSearch.toLowerCase());
        const engineerSites = e.assignedProjectIds?.map(sid => allSites?.find(s => s.id === sid)?.name || '') || [];
        const matchesSite = tableSiteSearch === '' || engineerSites.some(name => name.toLowerCase().includes(tableSiteSearch.toLowerCase()));
        
        return matchesEngineer && matchesManager && matchesSite;
      })
      .sort((a, b) => {
        const { key, direction } = sortConfig;
        let valA: any = ''; let valB: any = '';

        if (key === 'engineer') { valA = (a.username || '').toLowerCase(); valB = (b.username || '').toLowerCase(); }
        else if (key === 'manager') { valA = (managers.find(m => m.id === a.siteManagerId)?.username || '').toLowerCase(); valB = (managers.find(m => m.id === b.siteManagerId)?.username || '').toLowerCase(); }
        else { valA = (a.assignedProjectIds?.length || 0); valB = (b.assignedProjectIds?.length || 0); }

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
      });
  }, [engineers, managers, allSites, tableEngineerSearch, tableManagerSearch, tableSiteSearch, sortConfig]);

  const filteredUsersForAssign = React.useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(u => 
      (u.username || '').toLowerCase().includes(assignUserSearch.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(assignUserSearch.toLowerCase())
    ).sort((a, b) => (a.username || "").localeCompare(b.username || ""));
  }, [allUsers, assignUserSearch]);

  const availableSitesToAllot = React.useMemo(() => {
    if (!allSites) return [];
    return allSites.filter(s => 
      !localSiteIds.includes(s.id) && 
      s.name.toLowerCase().includes(siteSearch.toLowerCase())
    );
  }, [allSites, localSiteIds, siteSearch]);

  const handleOpenSiteAccess = (user: User) => {
    setAssignUser(user);
    setLocalSiteIds(user.assignedProjectIds || []);
    setSiteSearch("");
  };

  if (isProfileLoading || usersLoading || sitesLoading || overridesLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;

  if (!isAdmin) return null;

  return (
    <div className="space-y-6 md:space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl md:text-3xl font-black tracking-tight text-foreground uppercase">Teams & Site Access</h1>
            <p className="text-muted-foreground font-medium text-xs md:text-sm">Manage reporting structures and site authorizations.</p>
          </div>
          <Button variant="outline" onClick={handleRecconcileAllAccess} disabled={isReconciling} className="h-10 rounded-sm font-black uppercase text-[10px] tracking-widest border-primary/20 text-primary">
            {isReconciling ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            Reconcile All Access
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/50 border border-primary/10 rounded-sm p-1 h-11 mb-8 max-w-lg">
          <TabsTrigger value="mapping" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Workflow className="h-3.5 w-3.5 mr-1.5" /> Reporting Lines
          </TabsTrigger>
          <TabsTrigger value="assign" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <MapPin className="h-3.5 w-3.5 mr-1.5" /> Assign Sites
          </TabsTrigger>
          <TabsTrigger value="directory" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="h-3.5 w-3.5 mr-1.5" /> Site Directory
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mapping" className="space-y-8 m-0 animate-in fade-in duration-300">
          <Card className="rounded-sm border-primary/10 bg-primary/[0.02] shadow-sm">
            <CardHeader className="py-4 px-4 sm:px-6 border-b bg-muted/10">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                <h2 className="text-[10px] font-black uppercase text-primary tracking-widest leading-none">Map Site Engineer to Manager</h2>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pb-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
                <div className="lg:col-span-4 space-y-2">
                  <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter px-1">Supervisor (Site Manager)</Label>
                  <Popover open={isManagerPopoverOpen} onOpenChange={setIsManagerPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between h-11 rounded-sm bg-background border-primary/10 font-bold text-xs uppercase tracking-tight">
                        <span className="truncate">{selectedManagerId ? managers?.find(m => m.id === selectedManagerId)?.username : "Select Supervisor..."}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <div className="flex items-center border-b px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Input placeholder="Search managers..." className="h-10 border-none focus-visible:ring-0 text-xs" value={managerSearchQuery} onChange={e => setManagerSearchQuery(e.target.value)} />
                      </div>
                      <ScrollArea className="h-[200px]">
                        <div className="p-1">
                          {managers.filter(m => m.username?.toLowerCase().includes(managerSearchQuery.toLowerCase())).map(m => (
                            <Button key={m.id} variant="ghost" className="w-full justify-start h-10 text-xs font-bold uppercase" onClick={() => { setSelectedManagerId(m.id); setIsManagerPopoverOpen(false); }}>
                              {m.username}
                            </Button>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="lg:col-span-4 space-y-2">
                  <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter px-1">Site Engineer</Label>
                  <Popover open={isEngineerPopoverOpen} onOpenChange={setIsEngineerPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between h-11 rounded-sm bg-background border-primary/10 font-bold text-xs uppercase tracking-tight">
                        <span className="truncate">{selectedEngineerId ? engineers?.find(e => e.id === selectedEngineerId)?.username : "Select Engineer..."}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <div className="flex items-center border-b px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Input placeholder="Search engineers..." className="h-10 border-none focus-visible:ring-0 text-xs" value={engineerSearchQuery} onChange={e => setEngineerSearchQuery(e.target.value)} />
                      </div>
                      <ScrollArea className="h-[200px]">
                        <div className="p-1">
                          {engineers.filter(e => e.username?.toLowerCase().includes(engineerSearchQuery.toLowerCase())).map(e => (
                            <Button key={e.id} variant="ghost" className="w-full justify-start h-10 text-xs font-bold uppercase" onClick={() => { setSelectedEngineerId(e.id); setIsEngineerPopoverOpen(false); }}>
                              {e.username}
                            </Button>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="lg:col-span-4">
                  <Button onClick={handleAssign} disabled={!selectedManagerId || !selectedEngineerId || isMapping} className="w-full h-11 rounded-sm font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">
                    {isMapping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Create Team Link
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assign" className="space-y-8 m-0 animate-in fade-in duration-300">
          <Card className="rounded-sm border-primary/10 shadow-md">
            <CardHeader className="bg-muted/5 border-b p-6">
              <CardTitle className="text-lg font-black uppercase tracking-tight">Centralized Site Assignment</CardTitle>
              <CardDescription>Grant any user access to specific project sites or entire groups.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="max-w-md space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Choose Personnel</Label>
                  <Popover open={isAssignUserPopoverOpen} onOpenChange={setIsAssignUserPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between h-11 rounded-sm bg-background border-primary/10 font-bold text-xs uppercase">
                        <div className="flex items-center gap-2 truncate">
                          <UserIcon className="h-3.5 w-3.5 text-primary opacity-60" />
                          <span className="truncate">{assignUser ? assignUser.username : "Select User..."}</span>
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-sm shadow-2xl border-primary/10">
                      <div className="flex items-center border-b px-3 bg-muted/20">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Input placeholder="Search name or email..." className="h-10 w-full border-none focus-visible:ring-0 text-xs bg-transparent" value={assignUserSearch} onChange={e => setAssignUserSearch(e.target.value)} />
                      </div>
                      <ScrollArea className="h-[250px]">
                        <div className="p-1">
                          {filteredUsersForAssign.map(u => (
                            <Button key={u.id} variant="ghost" className="w-full justify-start h-auto py-2.5 px-3 mb-0.5 text-xs text-left" onClick={() => { setAssignUser(u); setLocalSiteIds(u.assignedProjectIds || []); setIsAssignUserPopoverOpen(false); }}>
                              <div className="flex flex-col items-start min-w-0">
                                <span className="font-bold truncate">{u.username}</span>
                                <span className="text-[9px] text-muted-foreground uppercase">{u.role}</span>
                              </div>
                            </Button>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {assignUser && (
                <div className="mt-8 space-y-10 animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Select Sites */}
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2 px-1">
                        <PlusCircle className="h-3.5 w-3.5" /> Authorize Individuals
                      </Label>
                      <div className="p-4 bg-muted/20 border rounded-sm space-y-4">
                        <Popover open={isSiteSearchOpen} onOpenChange={setIsSiteSearchOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-between h-11 font-bold text-xs uppercase border-primary/10 bg-background">
                              Add specific site...
                              <ChevronsUpDown className="ml-2 h-4 w-4 opacity-30" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <div className="flex items-center border-b px-3">
                              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                              <Input placeholder="Filter sites..." className="h-10 w-full border-none focus-visible:ring-0 text-xs" value={siteSearch} onChange={e => setSiteSearch(e.target.value)} />
                            </div>
                            <ScrollArea className="h-[200px]">
                              {availableSitesToAllot.map(s => (
                                <Button key={s.id} variant="ghost" className="w-full justify-start h-10 text-xs text-left" onClick={() => { setLocalSiteIds(prev => [...prev, s.id]); setIsSiteSearchOpen(false); }}>{s.name}</Button>
                              ))}
                            </ScrollArea>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* Select Groups */}
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2 px-1">
                        <Tags className="h-3.5 w-3.5" /> Authorize by Group
                      </Label>
                      <div className="p-4 bg-primary/[0.02] border border-primary/10 rounded-sm space-y-4">
                        <Select onValueChange={handleAddGroupSites}>
                          <SelectTrigger className="h-11 font-bold text-xs uppercase border-primary/20 bg-background">
                            <SelectValue placeholder="Add all sites from group..." />
                          </SelectTrigger>
                          <SelectContent>
                            {siteGroups?.map(g => (
                              <SelectItem key={g.id} value={g.id} className="text-xs font-bold">{g.name} ({g.siteIds?.length || 0} sites)</SelectItem>
                            ))}
                            {(!siteGroups || siteGroups.length === 0) && <SelectItem value="none" disabled>No groups defined</SelectItem>}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                       <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">
                        Current Access Registry ({localSiteIds.length})
                       </Label>
                       <Button variant="ghost" size="sm" className="h-7 text-[9px] font-black uppercase text-destructive" onClick={() => setLocalSiteIds([])}>Clear All</Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                       {localSiteIds.length > 0 ? localSiteIds.map(sid => {
                         const site = allSites?.find(s => s.id === sid);
                         return (
                           <div key={sid} className="p-3 bg-muted/20 border rounded-sm flex items-center justify-between group hover:border-primary/30 transition-all">
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-bold truncate">{site?.name || "Unknown"}</span>
                                <span className="text-[8px] font-black uppercase text-muted-foreground/60">{site?.projectCompany || "—"}</span>
                              </div>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all" onClick={() => setLocalSiteIds(prev => prev.filter(id => id !== sid))}>
                                <X className="h-3 w-3" />
                              </Button>
                           </div>
                         );
                       }) : (
                         <div className="col-span-full py-12 text-center text-[10px] font-black uppercase text-muted-foreground/30 italic tracking-widest">
                            No site authorizations active for this personnel
                         </div>
                       )}
                    </div>
                  </div>

                  <div className="pt-8 border-t flex justify-end">
                     <Button onClick={handleSaveSiteAccess} disabled={isUpdatingSites} className="h-14 min-w-[280px] font-black uppercase tracking-widest text-[11px] shadow-xl shadow-primary/20">
                        {isUpdatingSites ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
                        Save Site Authorizations
                     </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="directory" className="space-y-8 m-0 animate-in fade-in duration-300">
          <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
            <CardHeader className="bg-muted/5 border-b p-4 md:p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <CardTitle className="text-lg md:text-xl font-black uppercase tracking-tight">Organization Directory</CardTitle>
                    <CardDescription className="text-xs font-medium">Reporting structures and individual site access registry.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="h-9 px-4 rounded-sm font-black text-[10px] uppercase border-primary/10 bg-primary/5 text-primary">
                        {filteredMappings.length} Active Mappings
                    </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                 <div className="relative group">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                        placeholder="Filter Supervisor..." 
                        className="h-9 pl-8 text-[11px] font-bold rounded-sm border-primary/10" 
                        value={tableManagerSearch} 
                        onChange={e => setTableManagerSearch(e.target.value)} 
                    />
                 </div>
                 <div className="relative group">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                        placeholder="Filter Engineer..." 
                        className="h-9 pl-8 text-[11px] font-bold rounded-sm border-primary/10" 
                        value={tableEngineerSearch} 
                        onChange={e => setTableEngineerSearch(e.target.value)} 
                    />
                 </div>
                 <div className="relative group">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                        placeholder="Filter by Site..." 
                        className="h-9 pl-8 text-[11px] font-bold rounded-sm border-primary/10" 
                        value={tableSiteSearch} 
                        onChange={e => setTableSiteSearch(e.target.value)} 
                    />
                 </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="hidden md:block">
                <Table>
                  <TableHeader className="bg-muted/30 sticky top-0 z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="px-6 min-w-[220px]">
                        <div className="flex items-center gap-2 cursor-pointer py-4" onClick={() => handleSort('manager')}>
                            <span className="text-[10px] font-black uppercase tracking-widest">Supervisor Hierarchy</span>
                            {sortConfig.key === 'manager' && (sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[200px]">
                        <div className="flex items-center gap-2 cursor-pointer py-4" onClick={() => handleSort('engineer')}>
                            <span className="text-[10px] font-black uppercase tracking-widest">Engineer Name</span>
                            {sortConfig.key === 'engineer' && (sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[250px]">
                        <span className="text-[10px] font-black uppercase tracking-widest">Site Names</span>
                      </TableHead>
                      <TableHead className="text-center w-24">
                        <div className="flex items-center justify-center gap-1 cursor-pointer py-4" onClick={() => handleSort('sites')}>
                            <span className="text-[10px] font-black uppercase tracking-widest">Sites</span>
                            {sortConfig.key === 'sites' && (sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                        </div>
                      </TableHead>
                      <TableHead className="text-right px-6 font-black uppercase text-[10px] tracking-widest">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMappings.length > 0 ? filteredMappings.map((eng) => {
                      const hasOverrides = overrides?.filter(o => o.engineerId === eng.id) || [];
                      const defaultManager = managers.find(m => m.id === eng.siteManagerId);

                      return (
                        <TableRow key={eng.id} className="hover:bg-muted/5 group transition-colors">
                          <TableCell className="px-6 py-4">
                            <div className="flex flex-col gap-2">
                              <div className="flex flex-col">
                                <span className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter">Default Supervisor</span>
                                <span className="font-bold text-sm text-foreground">{defaultManager?.username || "Unassigned"}</span>
                              </div>
                              
                              {hasOverrides.length > 0 && (
                                <div className="flex flex-col gap-1 mt-1">
                                   <span className="text-[8px] font-black text-amber-600 uppercase tracking-tighter">Site Specific</span>
                                   {hasOverrides.map(o => {
                                     const site = allSites?.find(s => s.id === o.siteId);
                                     const mgr = managers.find(m => m.id === o.managerId);
                                     return (
                                       <div key={o.id} className="flex items-center gap-1.5 text-[10px] bg-amber-500/5 p-1 rounded-sm border border-amber-500/10">
                                          <MapPin className="h-2.5 w-2.5 text-amber-600" />
                                          <span className="font-black text-amber-800">{site?.name}:</span>
                                          <span className="font-medium text-foreground">{mgr?.username}</span>
                                       </div>
                                     );
                                   })}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-foreground">{eng.username}</span>
                                {hasOverrides.length > 0 && (
                                  <Badge variant="outline" className="text-[7px] h-3 px-1 border-amber-200 text-amber-700 bg-amber-50 font-black uppercase">Site Specific</Badge>
                                )}
                              </div>
                              <span className="text-[9px] font-medium text-muted-foreground truncate max-w-[180px]">{eng.email}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[250px]">
                              {eng.assignedProjectIds?.length ? eng.assignedProjectIds.map(sid => {
                                const site = allSites?.find(s => s.id === sid);
                                return (
                                  <Badge key={sid} variant="outline" className="text-[8px] h-4 px-1.5 border-primary/10 bg-primary/5 text-primary/70 font-bold uppercase whitespace-nowrap">
                                    {site?.name || 'Unknown Site'}
                                  </Badge>
                                );
                              }) : (
                                <span className="text-[10px] text-muted-foreground/30 italic uppercase font-bold">No Sites</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="h-6 w-6 p-0 flex items-center justify-center rounded-sm font-mono font-black text-[10px] bg-primary/5 text-primary border-primary/20">
                              {eng.assignedProjectIds?.length || 0}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <div className="flex justify-end items-center gap-2">
                              <div className="flex gap-2 mr-2">
                                 <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 rounded-sm font-bold text-[10px] uppercase border-primary/20 text-primary hover:bg-primary/5"
                                    onClick={() => handleOpenSiteAccess(eng)}
                                  >
                                    <Building2 className="h-3.5 w-3.5 mr-1.5" /> Manage Sites
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 rounded-sm font-bold text-[10px] uppercase border-amber-200 text-amber-700 hover:bg-amber-50"
                                    onClick={() => setOverrideEngineer(eng)}
                                  >
                                    <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Site Specific
                                  </Button>
                              </div>
                              <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm hover:bg-primary/10" onClick={() => setEditingLinkUser(eng)} title="Edit Team Link">
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm hover:bg-destructive/10" onClick={() => setUserToDelete(eng)} title="Remove Mapping">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }) : (
                      <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic font-medium">No personnel mappings discovered.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Shared Dialogs */}
      <Dialog open={!!editingLinkUser} onOpenChange={(o) => !o && setEditingLinkUser(null)}>
        <DialogContent className="max-w-md w-[95vw] rounded-sm p-0 border-none shadow-2xl bg-background flex flex-col h-[80vh] sm:h-auto max-h-[90vh]">
          <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 text-left space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-primary rounded-sm">
                <Pencil className="h-5 w-5" />
              </div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Edit Team Link</DialogTitle>
            </div>
            <DialogDescription className="text-xs font-medium leading-relaxed">
              Reassign <strong className="text-foreground">{editingLinkUser?.username}</strong> to a different supervisor.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-6 flex-1 overflow-hidden flex flex-col">
            <div className="space-y-3 text-left shrink-0">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Assign New Supervisor</Label>
              <div className="relative group">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="Search name or email..." 
                  className="h-10 pl-9 rounded-sm border-primary/20 bg-background focus-visible:ring-primary/20 text-sm font-medium"
                  value={editManagerSearch}
                  onChange={e => setEditManagerSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="border rounded-sm overflow-hidden flex-1 flex flex-col bg-background shadow-inner">
                <ScrollArea className="flex-1">
                  <div className="divide-y">
                    {managers.filter(m => 
                      m.username?.toLowerCase().includes(editManagerSearch.toLowerCase()) || 
                      m.email?.toLowerCase().includes(editManagerSearch.toLowerCase())
                    ).map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setEditManagerId(m.id)}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 text-left transition-all",
                          editManagerId === m.id ? "bg-primary/5" : "hover:bg-muted/5"
                        )}
                      >
                        <div className="h-8 w-8 flex items-center justify-center shrink-0">
                          {editManagerId === m.id ? (
                            <Check className="h-4 w-4 text-primary" />
                          ) : (
                            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className={cn("text-sm font-bold truncate leading-tight", editManagerId === m.id ? "text-primary" : "text-foreground")}>{m.username}</span>
                          <span className="text-[10px] font-mono text-muted-foreground uppercase truncate mt-0.5">{m.email}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
            </div>
          </div>

          <DialogFooter className="p-4 bg-muted/5 border-t flex items-center justify-between gap-3 shrink-0 flex-col sm:flex-row">
            <DialogClose asChild>
              <Button variant="outline" className="w-full sm:flex-1 rounded-sm font-bold uppercase text-[10px] h-11 tracking-widest">
                Cancel
              </Button>
            </DialogClose>
            <Button 
              disabled={!editManagerId || isUpdatingLink} 
              onClick={handleUpdateLink}
              className="w-full sm:flex-1 rounded-sm font-black uppercase text-[10px] h-11 shadow-lg tracking-widest"
            >
              {isUpdatingLink ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assignUser} onOpenChange={(o) => !o && setAssignUser(null)}>
        <DialogContent className="max-w-2xl w-[95vw] rounded-sm p-0 overflow-hidden border-none shadow-2xl bg-background h-[95vh] sm:h-auto sm:max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 pb-2 shrink-0 text-left space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 text-primary rounded-sm">
                <MapPin className="h-5 w-5" />
              </div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Manage Site Access</DialogTitle>
            </div>
            <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 leading-relaxed">
              Assign sites to <strong className="text-foreground">{assignUser?.username}</strong>. Engineer sites automatically sync to their reporting manager.
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-6 space-y-6 flex-1 overflow-hidden flex flex-col">
            <div className="p-4 bg-primary/[0.03] border border-primary/10 rounded-sm space-y-3 shrink-0">
              <Label className="text-[10px] font-black uppercase text-primary/80 tracking-widest px-1">Select Site to Add</Label>
              <Popover open={isSiteSearchOpen} onOpenChange={setIsSiteSearchOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    role="combobox" 
                    className={cn(
                      "w-full justify-between h-11 rounded-sm border-primary/20 bg-background font-bold text-xs text-left",
                      "hover:bg-primary/5 transition-all px-4"
                    )}
                  >
                    <span className="truncate">Search project site...</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-sm shadow-2xl border-primary/10" align="start">
                  <div className="flex items-center border-b px-3 py-2 bg-muted/20">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-primary" />
                    <Input 
                      placeholder="Search sites..." 
                      className="h-8 w-full border-none focus-visible:ring-0 bg-transparent px-0 text-sm font-medium"
                      value={siteSearch}
                      onChange={e => setSiteSearch(e.target.value)}
                    />
                  </div>
                  <ScrollArea className="h-[200px]">
                    <div className="p-1">
                      {availableSitesToAllot.length > 0 ? availableSitesToAllot.map(site => (
                        <Button 
                          key={site.id} 
                          variant="ghost" 
                          className="w-full justify-start h-auto py-2.5 px-3 text-left rounded-sm mb-0.5 hover:bg-primary/5 hover:text-primary group"
                          onClick={() => {
                            setLocalSiteIds(prev => [...prev, site.id]);
                            setSiteSearch("");
                            setIsSiteSearchOpen(false);
                          }}
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-sm truncate">{site.name}</span>
                            <span className="text-[9px] uppercase font-bold opacity-50 truncate group-hover:opacity-100">{site.projectCompany}</span>
                          </div>
                        </Button>
                      )) : (
                        <div className="p-8 text-center text-[10px] font-black uppercase text-muted-foreground/40 italic leading-relaxed">No available sites discovered</div>
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2 flex-1 flex flex-col min-h-0">
              <Label className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest px-1 shrink-0">Authorized Site Access</Label>
              <div className="border rounded-sm flex-1 flex flex-col overflow-hidden bg-background shadow-inner">
                <Table>
                  <TableHeader className="bg-muted/30 sticky top-0 z-10">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[9px] font-black uppercase tracking-widest h-9 px-5">Site Name</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest h-9">Company</TableHead>
                      <TableHead className="w-12 h-9"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="h-0"><TableCell colSpan={3} className="p-0 h-0 border-none"></TableCell></TableRow>
                  </TableBody>
                </Table>
                <ScrollArea className="flex-1">
                  <Table>
                    <TableBody>
                      {localSiteIds.length > 0 ? localSiteIds.map(sid => {
                        const site = allSites?.find(s => s.id === sid);
                        return (
                          <TableRow key={sid} className="hover:bg-muted/5 transition-colors border-b-border/30 last:border-0 group">
                            <TableCell className="px-5 py-3 font-bold text-sm">{site?.name || '—'}</TableCell>
                            <TableCell className="text-[10px] font-medium text-muted-foreground uppercase">{site?.projectCompany || '—'}</TableCell>
                            <TableCell className="text-right pr-5">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-sm"
                                onClick={() => setLocalSiteIds(prev => prev.filter(id => id !== sid))}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      }) : (
                        <TableRow>
                          <TableCell colSpan={3} className="h-40 text-center text-xs font-medium text-muted-foreground/40 italic uppercase font-bold tracking-widest">No project sites assigned</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-muted/5 border-t flex items-center justify-between gap-3 shrink-0 flex-col sm:flex-row">
            <DialogClose asChild>
              <Button variant="outline" className="w-full sm:flex-1 rounded-sm font-bold uppercase text-[10px] h-11 tracking-widest">
                Cancel
              </Button>
            </DialogClose>
            <Button 
              disabled={isUpdatingSites} 
              onClick={handleSaveSiteAccess}
              className="w-full sm:flex-1 rounded-sm font-black uppercase text-[10px] h-11 shadow-lg tracking-widest"
            >
              {isUpdatingSites ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Updates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!overrideEngineer} onOpenChange={(o) => !o && setOverrideEngineer(null)}>
        <DialogContent className="max-w-2xl w-[95vw] rounded-sm p-0 overflow-hidden border-none shadow-2xl bg-background h-[90vh] sm:h-auto sm:max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 text-left">
            <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-amber-600" />
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Site Specific Overrides</DialogTitle>
            </div>
            <DialogDescription className="text-xs font-medium mt-1">Assign alternative reporting managers for <strong>{overrideEngineer?.username}</strong> per project site.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-sm space-y-4 shadow-inner">
                <Label className="text-[10px] font-black uppercase text-amber-800 tracking-[0.2em]">New Allocation Override</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[9px] uppercase font-black text-muted-foreground">Target Project Site</Label>
                    <Select value={newOverrideSiteId} onValueChange={setNewOverrideSiteId}>
                      <SelectTrigger className="h-10 bg-background border-amber-200"><SelectValue placeholder="Choose Site..." /></SelectTrigger>
                      <SelectContent>
                        {allSites?.filter(s => overrideEngineer?.assignedProjectIds?.includes(s.id)).map(s => (
                          <SelectItem key={s.id} value={s.id} className="text-xs font-bold">{s.name}</SelectItem>
                        ))}
                        {!allSites?.some(s => overrideEngineer?.assignedProjectIds?.includes(s.id)) && <SelectItem value="none" disabled>No assigned sites</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] uppercase font-black text-muted-foreground">Designated Manager</Label>
                    <Select value={newOverrideManagerId} onValueChange={setNewOverrideManagerId}>
                      <SelectTrigger className="h-10 bg-background border-amber-200"><SelectValue placeholder="Choose Manager..." /></SelectTrigger>
                      <SelectContent>
                        {managers.map(m => (
                          <SelectItem key={m.id} value={m.id} className="text-xs font-bold">{m.username}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleAddOverride} disabled={!newOverrideSiteId || !newOverrideManagerId || isAddingOverride} className="w-full bg-amber-600 hover:bg-amber-700 h-11 font-black uppercase text-[10px] tracking-widest shadow-md">
                  {isAddingOverride ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />} Establish Mapping Override
                </Button>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest px-1 text-muted-foreground/60">Active Site Specific Mappings</Label>
                <div className="border rounded-sm overflow-hidden bg-background shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest h-9 px-4">Project Location</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest h-9">Mapped Manager</TableHead>
                        <TableHead className="text-right h-9"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overrides?.filter(o => o.engineerId === overrideEngineer?.id).map(o => (
                        <TableRow key={o.id} className="group hover:bg-muted/5 transition-colors">
                          <TableCell className="text-xs font-bold py-3 px-4">{allSites?.find(s => s.id === o.siteId)?.name || 'Unknown Site'}</TableCell>
                          <TableCell className="text-xs font-semibold text-primary">{managers.find(m => m.id === o.managerId)?.username || 'Unknown Manager'}</TableCell>
                          <TableCell className="text-right pr-4">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={() => handleRemoveOverride(o)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!overrides?.some(o => o.engineerId === overrideEngineer?.id) && (
                        <TableRow><TableCell colSpan={3} className="h-20 text-center text-xs text-muted-foreground italic font-medium uppercase opacity-40">No site-specific mappings defined.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 bg-muted/5 border-t shrink-0"><DialogClose asChild><Button variant="outline" className="w-full sm:w-auto rounded-sm font-black uppercase text-[10px] h-11 px-8 tracking-widest">Close Manager</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!userToDelete} onOpenChange={(o) => !o && setUserToDelete(null)}>
        <AlertDialogContent className="rounded-sm max-md w-[95vw]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2 font-black uppercase tracking-tight">
              <Trash2 className="h-5 w-5" /> Remove Reporting Line
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium leading-relaxed">
              Are you sure you want to remove the default supervisor mapping for <strong>{userToDelete?.username}</strong>? This user will become unassigned until a new link is created.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="rounded-sm font-bold uppercase text-[10px] h-11 sm:flex-1">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteMapping} className="bg-destructive text-white hover:bg-destructive/90 rounded-sm font-bold uppercase text-[10px] h-11 sm:flex-1">
              Confirm Removal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortIcon({ column, config }: { column: SortKey, config: { key: SortKey; direction: 'asc' | 'desc' } }) {
  if (config.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
  return config.direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3 text-primary" /> : <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
}
