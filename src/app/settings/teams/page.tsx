'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, getDocs, writeBatch, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
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
  Save
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

type SortKey = 'engineer' | 'manager' | 'sites';

export default function TeamMappingPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const overridesQuery = useMemoFirebase(() => collection(firestore, 'team_mapping_overrides'), [firestore]);
  const { data: overrides, isLoading: overridesLoading } = useCollection<MappingOverride>(overridesQuery);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites, isLoading: sitesLoading } = useCollection<Site>(sitesQuery);

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
  
  // Site Access Dialog States
  const [siteAccessUser, setSiteAccessUser] = React.useState<User | null>(null);
  const [localSiteIds, setLocalSiteIds] = React.useState<string[]>([]);
  const [siteSearch, setSiteSearch] = React.useState("");
  const [isSiteSearchOpen, setIsSiteSearchOpen] = React.useState(false);

  const [isMapping, setIsMapping] = React.useState(false);
  const [isAddingOverride, setIsAddingOverride] = React.useState(false);
  const [isUpdatingLink, setIsUpdatingLink] = React.useState(false);
  const [isUpdatingSites, setIsUpdatingSites] = React.useState(false);
  const [newOverrideSiteId, setNewOverrideSiteId] = React.useState<string | "">("");
  const [newOverrideManagerId, setNewOverrideManagerId] = React.useState<string | "">("");

  // Search/Popover States
  const [isManagerPopoverOpen, setIsManagerPopoverOpen] = React.useState(false);
  const [managerSearchQuery, setManagerSearchQuery] = React.useState("");
  const [isEngineerPopoverOpen, setIsEngineerPopoverOpen] = React.useState(false);
  const [engineerSearchQuery, setEngineerSearchQuery] = React.useState("");

  // Table filter states
  const [tableEngineerSearch, setTableEngineerSearch] = React.useState('');
  const [tableManagerSearch, setTableManagerSearch] = React.useState('');

  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'manager', direction: 'asc' });

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
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
      const userRef = doc(firestore, 'users', editingLinkUser.id);
      updateDocumentNonBlocking(userRef, {
        siteManagerId: editManagerId,
        updatedAt: serverTimestamp()
      });
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
      toast({ title: 'Override Created', description: 'Site-specific manager assigned.' });
      setNewOverrideSiteId("");
      setNewOverrideManagerId("");
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsAddingOverride(false);
    }
  };

  const syncManagerSites = async (managerId: string, updatedEngineerId: string, updatedEngineerSites: string[]) => {
    try {
      const q = query(collection(firestore, 'users'), where('siteManagerId', '==', managerId));
      const snap = await getDocs(q);
      
      const allTeamSites = new Set<string>();
      snap.docs.forEach(d => {
          const data = d.data();
          const sites = data.id === updatedEngineerId ? updatedEngineerSites : (data.assignedProjectIds || []);
          sites.forEach((id: string) => allTeamSites.add(id));
      });

      const managerRef = doc(firestore, 'users', managerId);
      updateDocumentNonBlocking(managerRef, { assignedProjectIds: Array.from(allTeamSites) });
    } catch (e) {
      console.error("Manager inheritance sync failed", e);
    }
  };

  const handleSaveSiteAccess = async () => {
    if (!siteAccessUser) return;
    setIsUpdatingSites(true);
    try {
      const userRef = doc(firestore, 'users', siteAccessUser.id);
      updateDocumentNonBlocking(userRef, { assignedProjectIds: localSiteIds });

      if (siteAccessUser.role === 'Site Engineer' && siteAccessUser.siteManagerId) {
        await syncManagerSites(siteAccessUser.siteManagerId, siteAccessUser.id, localSiteIds);
      }

      toast({ title: 'Access Updated', description: `Site permissions for ${siteAccessUser.username} saved.` });
      setSiteAccessUser(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
    } finally {
      setIsUpdatingSites(false);
    }
  };

  const handleRemoveOverride = (id: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'team_mapping_overrides', id));
    toast({ title: 'Override Removed' });
  };

  const handleConfirmDeleteMapping = () => {
    if (!userToDelete) return;
    const ref = doc(firestore, 'users', userToDelete.id);
    updateDocumentNonBlocking(ref, { siteManagerId: null });
    toast({ title: 'Mapping Removed', description: `Default reporting line for ${userToDelete.username} has been removed.` });
    setUserToDelete(null);
  };

  const filteredMappings = React.useMemo(() => {
    if (!engineers || !managers) return [];
    
    return engineers
      .filter(e => {
        const manager = managers.find(m => m.id === e.siteManagerId);
        const matchesEngineer = (e.username || '').toLowerCase().includes(tableEngineerSearch.toLowerCase());
        const matchesManager = (manager?.username || '').toLowerCase().includes(tableManagerSearch.toLowerCase());
        return matchesEngineer && matchesManager;
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
  }, [engineers, managers, tableEngineerSearch, tableManagerSearch, sortConfig]);

  const availableSitesToAllot = React.useMemo(() => {
    if (!allSites) return [];
    return allSites.filter(s => 
      !localSiteIds.includes(s.id) && 
      s.name.toLowerCase().includes(siteSearch.toLowerCase())
    );
  }, [allSites, localSiteIds, siteSearch]);

  const handleOpenSiteAccess = (user: User) => {
    setSiteAccessUser(user);
    setLocalSiteIds(user.assignedProjectIds || []);
    setSiteSearch("");
  };

  if (isProfileLoading || usersLoading || sitesLoading || overridesLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-foreground uppercase">Teams & Site Access</h1>
        <p className="text-muted-foreground font-medium">Manage reporting structures and site authorizations. Engineer sites sync to managers automatically.</p>
      </div>

      <Card className="rounded-sm border-primary/10 bg-primary/[0.02] shadow-sm">
        <CardHeader className="py-4">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <h2 className="text-[10px] font-black uppercase text-primary tracking-widest">Map Site Engineer to Manager</h2>
          </div>
          <CardDescription className="text-xs font-medium">Assign an engineer to a supervisor. Sites assigned to the engineer will sync to the manager.</CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
            <div className="lg:col-span-4 space-y-2">
              <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">Supervisor (Site Manager)</Label>
              <Popover open={isManagerPopoverOpen} onOpenChange={setIsManagerPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between h-11 rounded-sm bg-background border-primary/10 font-bold text-xs uppercase tracking-tight">
                    {selectedManagerId ? managers?.find(m => m.id === selectedManagerId)?.username : "Select Supervisor..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
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
              <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">Site Engineer</Label>
              <Popover open={isEngineerPopoverOpen} onOpenChange={setIsEngineerPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between h-11 rounded-sm bg-background border-primary/10 font-bold text-xs uppercase tracking-tight">
                    {selectedEngineerId ? engineers?.find(e => e.id === selectedEngineerId)?.username : "Select Engineer..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
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

      <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
        <CardHeader className="bg-muted/5 border-b py-6">
          <CardTitle className="text-xl font-black uppercase tracking-tight">Organization Teams</CardTitle>
          <CardDescription className="text-xs font-medium">View all reporting relationships and manage individual site access levels.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6 min-w-[200px]">
                    <div className="flex flex-col gap-2 py-2">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleSort('manager')}>
                            <span className="text-[10px] font-black uppercase tracking-widest">Supervisor</span>
                            {sortConfig.key === 'manager' && (sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                            <Input placeholder="Filter..." className="h-8 pl-7 text-[10px] rounded-sm bg-background border-primary/10" value={tableManagerSearch} onChange={e => setTableManagerSearch(e.target.value)} />
                        </div>
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[200px]">
                    <div className="flex flex-col gap-2 py-2">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleSort('engineer')}>
                            <span className="text-[10px] font-black uppercase tracking-widest">Engineer Name</span>
                            {sortConfig.key === 'engineer' && (sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                            <Input placeholder="Filter..." className="h-8 pl-7 text-[10px] rounded-sm bg-background border-primary/10" value={tableEngineerSearch} onChange={e => setTableEngineerSearch(e.target.value)} />
                        </div>
                    </div>
                  </TableHead>
                  <TableHead className="text-center w-24">
                    <div className="flex items-center justify-center gap-1 cursor-pointer py-2" onClick={() => handleSort('sites')}>
                        <span className="text-[10px] font-black uppercase tracking-widest">Sites</span>
                        {sortConfig.key === 'sites' && (sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </div>
                  </TableHead>
                  <TableHead className="text-right px-6 font-black uppercase text-[10px] tracking-widest">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMappings.length > 0 ? filteredMappings.map((eng) => {
                  const hasOverrides = overrides?.some(o => o.engineerId === eng.id);
                  return (
                    <TableRow key={eng.id} className="hover:bg-muted/5 group transition-colors">
                      <TableCell className="px-6 py-4 font-bold text-sm text-foreground">
                        {managers.find(m => m.id === eng.siteManagerId)?.username || "Unassigned"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">{eng.username}</span>
                            {hasOverrides && (
                              <Badge variant="outline" className="text-[7px] h-3 px-1 border-amber-200 text-amber-700 bg-amber-50 font-black uppercase">Site-Specific</Badge>
                            )}
                          </div>
                          <span className="text-[9px] font-medium text-muted-foreground truncate max-w-[180px]">{eng.email}</span>
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
                                <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Site Overrides
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
                  <TableRow><TableCell colSpan={4} className="h-48 text-center text-muted-foreground italic font-medium">No personnel mappings discovered.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Team Link Dialog */}
      <Dialog open={!!editingLinkUser} onOpenChange={(o) => !o && setEditingLinkUser(null)}>
        <DialogContent className="max-w-md w-[95vw] rounded-xl p-0 border-none shadow-2xl bg-white animate-in zoom-in-95 duration-200">
          <DialogHeader className="p-6 pb-2 shrink-0 text-left space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-primary rounded-lg">
                <Pencil className="h-5 w-5" />
              </div>
              <DialogTitle className="text-xl font-black tracking-tight text-slate-900">Edit Team Link</DialogTitle>
            </div>
            <DialogDescription className="text-xs font-medium text-slate-500 leading-relaxed">
              Reassign <strong className="text-slate-700">{editingLinkUser?.username}</strong> to a different supervisor.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="space-y-3 text-left">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Assign New Supervisor</Label>
              <div className="relative group">
                <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="Search name or email..." 
                  className="h-12 pl-10 rounded-lg border-slate-200 bg-slate-50/30 focus-visible:ring-primary/20 text-sm font-medium"
                  value={editManagerSearch}
                  onChange={e => setEditManagerSearch(e.target.value)}
                />
              </div>

              <div className="border rounded-lg overflow-hidden bg-white shadow-inner">
                <ScrollArea className="h-[220px]">
                  <div className="divide-y divide-slate-50">
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
                          editManagerId === m.id ? "bg-blue-50" : "hover:bg-slate-50"
                        )}
                      >
                        <div className="h-8 w-8 flex items-center justify-center shrink-0">
                          {editManagerId === m.id ? (
                            <Check className="h-4 w-4 text-primary" />
                          ) : (
                            <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className={cn("text-sm font-bold truncate leading-tight", editManagerId === m.id ? "text-primary" : "text-slate-700")}>{m.username}</span>
                          <span className="text-[10px] font-mono text-slate-400 uppercase truncate mt-0.5">{m.email}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>

          <div className="p-6 bg-slate-50/50 border-t flex items-center justify-between gap-4">
            <DialogClose asChild>
              <Button variant="outline" className="flex-1 rounded-lg font-bold text-slate-600 border-slate-200 h-11 bg-white hover:bg-white hover:text-slate-900 transition-colors">
                Cancel
              </Button>
            </DialogClose>
            <Button 
              disabled={!editManagerId || isUpdatingLink} 
              onClick={handleUpdateLink}
              className="flex-1 rounded-lg font-bold h-11 bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98]"
            >
              {isUpdatingLink ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Site Access Dialog */}
      <Dialog open={!!siteAccessUser} onOpenChange={(o) => !o && setSiteAccessUser(null)}>
        <DialogContent className="max-w-2xl w-[95vw] rounded-xl p-0 border-none shadow-2xl bg-white animate-in zoom-in-95 duration-200">
          <DialogHeader className="p-6 pb-2 shrink-0 text-left space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-primary rounded-lg">
                <MapPin className="h-5 w-5" />
              </div>
              <DialogTitle className="text-xl font-black tracking-tight text-slate-900">Manage Site Access</DialogTitle>
            </div>
            <DialogDescription className="text-xs font-medium text-slate-500 leading-relaxed">
              Assign sites to <strong className="text-slate-700">{siteAccessUser?.username}</strong>. Engineer sites automatically sync to their reporting manager.
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-6 space-y-8 flex-1 overflow-hidden flex flex-col">
            {/* Search Site Bar */}
            <div className="p-5 bg-blue-50/40 border border-blue-100 rounded-xl space-y-3 shrink-0">
              <Label className="text-[10px] font-black uppercase text-blue-600/80 tracking-widest px-1">Select Site to Add</Label>
              <Popover open={isSiteSearchOpen} onOpenChange={setIsSiteSearchOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    role="combobox" 
                    className={cn(
                      "w-full justify-between h-12 rounded-lg border-slate-200 bg-white font-medium text-sm text-left shadow-sm",
                      "hover:bg-slate-50 hover:border-primary/30 transition-all px-4"
                    )}
                  >
                    <span className="truncate">Select project site...</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-lg shadow-2xl border-slate-200" align="start">
                  <div className="flex items-center border-b px-3 py-2 bg-slate-50/50">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-primary" />
                    <Input 
                      placeholder="Search project sites..." 
                      className="h-9 w-full border-none focus-visible:ring-0 bg-transparent px-0 text-sm font-medium"
                      value={siteSearch}
                      onChange={e => setSiteSearch(e.target.value)}
                    />
                  </div>
                  <ScrollArea className="h-[220px]">
                    <div className="p-1">
                      {availableSitesToAllot.length > 0 ? availableSitesToAllot.map(site => (
                        <Button 
                          key={site.id} 
                          variant="ghost" 
                          className="w-full justify-start h-auto py-3 px-4 text-left rounded-md mb-0.5 hover:bg-blue-50 hover:text-primary group"
                          onClick={() => {
                            setLocalSiteIds(prev => [...prev, site.id]);
                            setSiteSearch("");
                            setIsSiteSearchOpen(false);
                          }}
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-sm truncate">{site.name}</span>
                            <span className="text-[10px] uppercase font-bold opacity-50 truncate group-hover:opacity-100">{site.projectCompany}</span>
                          </div>
                        </Button>
                      )) : (
                        <div className="p-8 text-center text-xs font-medium text-slate-400 italic">No available sites discovered</div>
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>

            {/* List of Authorized Sites */}
            <div className="space-y-3 flex-1 flex flex-col min-h-0">
              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1 shrink-0">Authorized Site Access</Label>
              <div className="border rounded-xl flex-1 flex flex-col overflow-hidden bg-white shadow-inner">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-10">
                    <TableRow className="hover:bg-transparent border-b-slate-100">
                      <TableHead className="text-[9px] font-black uppercase text-slate-400 h-9 px-5">Site Name</TableHead>
                      <TableHead className="text-[9px] font-black uppercase text-slate-400 h-9">Company</TableHead>
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
                          <TableRow key={sid} className="hover:bg-slate-50 transition-colors border-b-slate-50 last:border-0 group">
                            <TableCell className="px-5 py-4 font-black text-[13px] text-slate-800">{site?.name || '—'}</TableCell>
                            <TableCell className="text-xs font-medium text-slate-400">{site?.projectCompany || '—'}</TableCell>
                            <TableCell className="text-right pr-5">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                                onClick={() => setLocalSiteIds(prev => prev.filter(id => id !== sid))}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      }) : (
                        <TableRow>
                          <TableCell colSpan={3} className="h-40 text-center text-xs font-medium text-slate-400 italic">No project sites assigned to this account.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          </div>

          <div className="p-6 bg-slate-50/50 border-t flex items-center justify-between gap-4 shrink-0">
            <DialogClose asChild>
              <Button variant="outline" className="flex-1 rounded-lg font-bold text-slate-600 border-slate-200 h-11 bg-white hover:bg-white hover:text-slate-900">
                Cancel
              </Button>
            </DialogClose>
            <Button 
              disabled={isUpdatingSites} 
              onClick={handleSaveSiteAccess}
              className="flex-1 rounded-lg font-bold h-11 bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98]"
            >
              {isUpdatingSites ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Updates
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Override Dialog */}
      <Dialog open={!!overrideEngineer} onOpenChange={(o) => !o && setOverrideEngineer(null)}>
        <DialogContent className="max-w-2xl rounded-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black tracking-tight"><Building2 className="h-5 w-5 text-amber-600" /> Site-specific Manager Overrides</DialogTitle>
            <DialogDescription className="text-xs font-medium">Assign alternative reporting managers for <strong>{overrideEngineer?.username}</strong> per project site.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-sm space-y-4 shadow-inner">
              <Label className="text-[10px] font-black uppercase text-amber-800 tracking-[0.2em]">New Allocation Override</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase font-black text-muted-foreground">Target Project Site</Label>
                  <Select value={newOverrideSiteId} onValueChange={setNewOverrideSiteId}>
                    <SelectTrigger className="h-10 bg-white border-amber-200"><SelectValue placeholder="Choose Site..." /></SelectTrigger>
                    <SelectContent>
                      {allSites?.filter(s => overrideEngineer?.assignedProjectIds?.includes(s.id)).map(s => (
                        <SelectItem key={s.id} value={s.id} className="text-xs font-bold">{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase font-black text-muted-foreground">Designated Manager</Label>
                  <Select value={newOverrideManagerId} onValueChange={setNewOverrideManagerId}>
                    <SelectTrigger className="h-10 bg-white border-amber-200"><SelectValue placeholder="Choose Manager..." /></SelectTrigger>
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

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest px-1">Active Site Overrides</Label>
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
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemoveOverride(o.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!overrides?.some(o => o.engineerId === overrideEngineer?.id) && (
                      <TableRow><TableCell colSpan={3} className="h-20 text-center text-xs text-muted-foreground italic font-medium uppercase opacity-40">No site-specific overrides defined.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 bg-muted/5 border-t"><DialogClose asChild><Button variant="outline" className="rounded-sm font-black uppercase text-[10px] h-10 px-8">Close Manager</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Mapping Confirmation */}
      <AlertDialog open={!!userToDelete} onOpenChange={(o) => !o && setUserToDelete(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2 font-black uppercase tracking-tight">
              <Trash2 className="h-5 w-5" /> Remove Reporting Line
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium leading-relaxed">
              Are you sure you want to remove the default supervisor mapping for <strong>{userToDelete?.username}</strong>? This user will become unassigned until a new link is created.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteMapping} className="bg-destructive text-white hover:bg-destructive/90 rounded-sm font-bold uppercase text-[10px]">
              Confirm Removal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
