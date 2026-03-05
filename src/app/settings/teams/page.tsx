'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { UserPlus, Trash2, Users, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronsUpDown, Check, MapPin, PlusCircle, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { isSuperAdmin } from "@/lib/auth-constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

type User = {
  id: string;
  username?: string;
  email?: string;
  role?: 'Admin' | 'Site Manager' | 'Site Engineer';
  siteManagerId?: string | null;
  assignedProjectIds?: string[];
};

type Site = {
  id: string;
  name: string;
  projectCompany: string;
  acCapacity: string;
  dcCapacity: string;
};

type SortKey = 'engineer' | 'manager' | 'sites';

const RESCUE_NAMES = [
  "Shayad Shaikh",
  "Shahabaj Shaikh",
  "Omkar Puri",
  "Abhay Chaudhari",
  "Mahesh Shivpuje",
  "Dnyaneshwar Aglave",
  "Dipak Kshirsagar",
  "Santosh Gulabrao Maghade",
  "Vaibhav Samshette"
].map(n => n.toLowerCase());

export default function TeamMappingPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  React.useEffect(() => {
    if (!isProfileLoading && !isAdmin && !isManager) {
      router.replace('/ptw/raise');
    }
  }, [isProfileLoading, isAdmin, isManager, router]);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const managers = React.useMemo(() => {
    return allUsers?.filter(u => {
      const role = (u.role || '').trim().toLowerCase();
      return role === 'site manager' || role === 'manager';
    }) || [];
  }, [allUsers]);

  const engineers = React.useMemo(() => {
    return allUsers?.filter(u => {
      const role = (u.role || '').trim().toLowerCase();
      const username = (u.username || '').trim().toLowerCase();
      const isEngineerRole = role === 'site engineer' || role === 'engineer';
      const isRescueTarget = RESCUE_NAMES.includes(username);
      return isEngineerRole || isRescueTarget;
    }) || [];
  }, [allUsers]);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites, isLoading: sitesLoading } = useCollection<Site>(sitesQuery);

  const [selectedManagerId, setSelectedManagerId] = React.useState<string | null>(null);
  const [selectedEngineerId, setSelectedEngineerId] = React.useState<string | null>(null);
  const [siteManagementUser, setSiteManagementUser] = React.useState<User | null>(null);
  const [localAssignedSites, setLocalAssignedSites] = React.useState<string[]>([]);
  const [isSavingSites, setIsSavingSites] = React.useState(false);
  const [isMapping, setIsMapping] = React.useState(false);

  // Popover & Search states
  const [isManagerPopoverOpen, setIsManagerPopoverOpen] = React.useState(false);
  const [managerSearchQuery, setManagerSearchQuery] = React.useState("");
  const [isEngineerPopoverOpen, setIsEngineerPopoverOpen] = React.useState(false);
  const [engineerSearchQuery, setEngineerSearchQuery] = React.useState("");
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");

  // Table filter states
  const [tableEngineerSearch, setTableEngineerSearch] = React.useState('');
  const [tableManagerSearch, setTableManagerSearch] = React.useState('');

  // Sort state
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'manager', direction: 'asc' });

  const syncManagerSites = async (managerId: string) => {
    const q = query(collection(firestore, 'users'), where('siteManagerId', '==', managerId));
    const snap = await getDocs(q);
    
    const allEngineerSites = new Set<string>();
    snap.docs.forEach(d => {
        const data = d.data();
        (data.assignedProjectIds || []).forEach((id: string) => allEngineerSites.add(id));
    });

    const managerRef = doc(firestore, 'users', managerId);
    updateDocumentNonBlocking(managerRef, { assignedProjectIds: Array.from(allEngineerSites) });
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

        toast({
            title: 'Team Link Created',
            description: 'Personnel has been mapped and site access synchronized.',
        });
        
        setSelectedEngineerId(null);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Mapping Error', description: e.message });
    } finally {
        setIsMapping(false);
    }
  };

  const handleRemoveMapping = async (engineerId: string) => {
    const engineer = engineers?.find(e => e.id === engineerId);
    const oldManagerId = engineer?.siteManagerId;

    if (!oldManagerId) return;

    try {
        const engineerRef = doc(firestore, 'users', engineerId);
        updateDocumentNonBlocking(engineerRef, { siteManagerId: null });
        await syncManagerSites(oldManagerId);

        toast({
            title: 'Mapping Removed',
            description: 'Personnel moved to unmapped list.',
        });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const handleOpenSiteManagement = (u: User) => {
    setSiteManagementUser(u);
    setLocalAssignedSites(u.assignedProjectIds || []);
    setSiteSearchQuery("");
  };

  const handleRemoveSiteFromLocal = (siteId: string) => {
    setLocalAssignedSites(prev => prev.filter(id => id !== siteId));
  };

  const handleSaveSites = async () => {
    if (!siteManagementUser) return;
    setIsSavingSites(true);

    try {
        const userRef = doc(firestore, 'users', siteManagementUser.id);
        updateDocumentNonBlocking(userRef, { assignedProjectIds: localAssignedSites });

        if (siteManagementUser.role === 'Site Engineer' && siteManagementUser.siteManagerId) {
            await syncManagerSites(siteManagementUser.siteManagerId);
        }

        toast({
            title: 'Sites Updated',
            description: `Access levels updated for ${siteManagementUser.username}.`,
        });
        setSiteManagementUser(null);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
    } finally {
        setIsSavingSites(false);
    }
  };

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const filteredManagers = React.useMemo(() => {
    return managers.filter(m => 
      (m.username || '').toLowerCase().includes(managerSearchQuery.toLowerCase()) ||
      (m.email || '').toLowerCase().includes(managerSearchQuery.toLowerCase())
    );
  }, [managers, managerSearchQuery]);

  const unmappedEngineers = React.useMemo(() => {
    if (!engineers) return [];
    return engineers.filter(e => {
      const hasManager = e.siteManagerId && String(e.siteManagerId).trim() !== "" && String(e.siteManagerId) !== "null";
      return !hasManager;
    });
  }, [engineers]);

  const filteredUnmappedEngineers = React.useMemo(() => {
    return unmappedEngineers.filter(e => 
      (e.username || '').toLowerCase().includes(engineerSearchQuery.toLowerCase()) ||
      (e.email || '').toLowerCase().includes(engineerSearchQuery.toLowerCase())
    );
  }, [unmappedEngineers, engineerSearchQuery]);

  const filteredMappings = React.useMemo(() => {
    if (!engineers || !managers) return [];
    
    return engineers
      .filter(e => {
        if (isAdmin) return e.siteManagerId && String(e.siteManagerId).trim() !== "" && String(e.siteManagerId) !== "null";
        return e.siteManagerId === user?.uid;
      })
      .filter(e => {
        const manager = managers.find(m => m.id === e.siteManagerId);
        const matchesEngineer = (e.username || '').toLowerCase().includes(tableEngineerSearch.toLowerCase());
        const matchesManager = isAdmin ? ((manager?.username || '').toLowerCase().includes(tableManagerSearch.toLowerCase()) ?? false) : true;
        return matchesEngineer && matchesManager;
      })
      .sort((a, b) => {
        const { key, direction } = sortConfig;
        let valA: any = '';
        let valB: any = '';

        if (key === 'engineer') {
            valA = (a.username || '').toLowerCase();
            valB = (b.username || '').toLowerCase();
        } else if (key === 'manager') {
            valA = (managers.find(m => m.id === a.siteManagerId)?.username || '').toLowerCase();
            valB = (managers.find(m => m.id === b.siteManagerId)?.username || '').toLowerCase();
        } else {
            valA = (a.assignedProjectIds?.length || 0);
            valB = (b.assignedProjectIds?.length || 0);
        }

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
      });
  }, [engineers, managers, tableEngineerSearch, tableManagerSearch, sortConfig, isAdmin, user]);

  const availableSitesToAssign = React.useMemo(() => {
    const list = allSites?.filter(site => !localAssignedSites.includes(site.id)) || [];
    return list.filter(site => 
      (site.name || '').toLowerCase().includes(siteSearchQuery.toLowerCase())
    );
  }, [allSites, localAssignedSites, siteSearchQuery]);

  if (isProfileLoading || usersLoading || sitesLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Teams & Site Access</h1>
        <p className="text-muted-foreground">Manage reporting structures and site authorizations. Engineer sites sync to managers automatically.</p>
      </div>

      {isAdmin && (
        <Card className="rounded-sm border-primary/10 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Map Site Engineer to Manager
            </CardTitle>
            <CardDescription>Assign an engineer to a supervisor. Sites assigned to the engineer will sync to the manager.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">Supervisor (Site Manager)</Label>
                <Popover open={isManagerPopoverOpen} onOpenChange={setIsManagerPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between font-normal rounded-sm",
                        !selectedManagerId && "text-muted-foreground"
                      )}
                    >
                      {selectedManagerId
                        ? managers?.find((m) => m.id === selectedManagerId)?.username
                        : "Select Supervisor..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <div className="flex items-center border-b px-3">
                      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                      <Input
                        placeholder="Search managers..."
                        className="h-9 w-full border-none focus-visible:ring-0 px-0 text-sm"
                        value={managerSearchQuery}
                        onChange={(e) => setManagerSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        autoComplete="off"
                      />
                    </div>
                    <ScrollArea className="h-[250px]">
                      <div className="p-1">
                        {filteredManagers.length > 0 ? (
                          filteredManagers.map((m) => (
                            <Button
                              key={m.id}
                              variant="ghost"
                              className="w-full justify-start font-normal"
                              onClick={() => {
                                setSelectedManagerId(m.id);
                                setIsManagerPopoverOpen(false);
                                setManagerSearchQuery("");
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  m.id === selectedManagerId ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {m.username}
                            </Button>
                          ))
                        ) : (
                          <p className="p-4 text-center text-sm text-muted-foreground">No managers found.</p>
                        )}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">Site Engineer</Label>
                <Popover open={isEngineerPopoverOpen} onOpenChange={setIsEngineerPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between font-normal rounded-sm",
                        !selectedEngineerId && "text-muted-foreground"
                      )}
                    >
                      {selectedEngineerId
                        ? engineers?.find((e) => e.id === selectedEngineerId)?.username
                        : "Select Engineer..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <div className="flex items-center border-b px-3">
                      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                      <Input
                        placeholder="Search engineers..."
                        className="h-9 w-full border-none focus-visible:ring-0 px-0 text-sm"
                        value={engineerSearchQuery}
                        onChange={(e) => setEngineerSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        autoComplete="off"
                      />
                    </div>
                    <ScrollArea className="h-[250px]">
                      <div className="p-1">
                        {filteredUnmappedEngineers.length > 0 ? (
                          filteredUnmappedEngineers.map((e) => (
                            <Button
                              key={e.id}
                              variant="ghost"
                              className="w-full justify-start font-normal"
                              onClick={() => {
                                setSelectedEngineerId(e.id);
                                setIsEngineerPopoverOpen(false);
                                setEngineerSearchQuery("");
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  e.id === selectedEngineerId ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col items-start overflow-hidden">
                                <span className="truncate">{e.username}</span>
                                {RESCUE_NAMES.includes((e.username || '').toLowerCase()) && (
                                  <Badge variant="outline" className="text-[8px] h-3 px-1 py-0 border-amber-500 text-amber-700 bg-amber-50 rounded-sm">Rescue Identified</Badge>
                                )}
                              </div>
                            </Button>
                          ))
                        ) : (
                          <p className="p-4 text-center text-sm text-muted-foreground">No available engineers.</p>
                        )}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>

              <Button onClick={handleAssign} disabled={!selectedManagerId || !selectedEngineerId || isMapping} className="rounded-sm font-bold">
                {isMapping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                Create Team Link
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
        <CardHeader className="bg-muted/5 border-b">
          <CardTitle className="text-lg">Organization Teams</CardTitle>
          <CardDescription>View all reporting relationships and manage individual site access levels.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  {isAdmin && (
                    <TableHead className="min-w-[200px]">
                      <div className="flex flex-col gap-2 py-2">
                        <div className="flex items-center cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('manager')}>
                          <span className="text-xs font-bold uppercase tracking-tight">Supervisor</span>
                          <SortIcon column="manager" />
                        </div>
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Filter..."
                            value={tableManagerSearch}
                            onChange={(e) => setTableManagerSearch(e.target.value)}
                            className="h-8 pl-8 text-xs rounded-sm border-primary/10"
                            autoComplete="off"
                          />
                        </div>
                      </div>
                    </TableHead>
                  )}
                  <TableHead className="min-w-[200px]">
                    <div className="flex flex-col gap-2 py-2">
                      <div className="flex items-center cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('engineer')}>
                        <span className="text-xs font-bold uppercase tracking-tight">Engineer Name</span>
                        <SortIcon column="engineer" />
                      </div>
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Filter..."
                          value={tableEngineerSearch}
                          onChange={(e) => setTableEngineerSearch(e.target.value)}
                          className="h-8 pl-8 text-xs rounded-sm border-primary/10"
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  </TableHead>
                  <TableHead className="w-32 align-bottom pb-4 text-center" onClick={() => handleSort('sites')}>
                    <div className="flex items-center justify-center cursor-pointer gap-1">
                        <span className="text-xs font-bold uppercase tracking-tight">Sites</span>
                        <SortIcon column="sites" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right align-bottom pb-4 px-6">
                    <span className="text-xs font-bold uppercase tracking-tight">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMappings.length > 0 ? (
                  filteredMappings.map(e => {
                    const manager = managers?.find(m => m.id === e.siteManagerId);
                    return (
                      <TableRow key={e.id} className="hover:bg-muted/5 group">
                        {isAdmin && <TableCell className="font-bold text-sm px-4">{manager?.username || 'System Admin'}</TableCell>}
                        <TableCell className="px-4">
                            <div className="flex flex-col">
                                <span className="font-semibold">{e.username}</span>
                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">{e.email}</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-center px-4">
                            <Badge variant="outline" className="rounded-sm font-mono text-[10px] bg-primary/5 border-primary/20 text-primary">
                                {e.assignedProjectIds?.length || 0}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <div className="flex justify-end gap-1">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-xs font-bold rounded-sm border-primary/20 hover:bg-primary hover:text-white transition-all"
                                onClick={() => handleOpenSiteManagement(e)}
                            >
                                <MapPin className="h-3.5 w-3.5 mr-1.5" /> Manage Sites
                            </Button>
                            {isAdmin && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => handleRemoveMapping(e.id)}>
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Remove Mapping</span>
                                </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 4 : 3} className="text-center py-24 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <Users className="h-12 w-12 mb-4 opacity-20" />
                        <p className="font-medium italic">No reporting engineers found matching your filters.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Site Management Dialog */}
      <Dialog open={!!siteManagementUser} onOpenChange={(o) => !o && setSiteManagementUser(null)}>
        <DialogContent className="max-w-2xl rounded-sm">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" /> Manage Site Access
                </DialogTitle>
                <DialogDescription>
                    Assign sites to <strong>{siteManagementUser?.username}</strong>. Engineer sites automatically sync to their reporting manager.
                </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
                <div className="flex flex-col gap-3 p-4 bg-primary/5 border border-primary/10 rounded-sm">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Select Site to Add</Label>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search project sites..."
                            className="pl-9 h-10 rounded-sm bg-background border-primary/20"
                            value={siteSearchQuery}
                            onChange={(e) => setSiteSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            autoComplete="off"
                        />
                    </div>
                    
                    {siteSearchQuery && (
                        <div className="border rounded-sm bg-background shadow-sm overflow-hidden">
                            <ScrollArea className="h-[150px]">
                                <div className="p-1">
                                    {availableSitesToAssign.length > 0 ? (
                                        availableSitesToAssign.map((site) => (
                                            <Button
                                                key={site.id}
                                                variant="ghost"
                                                className="w-full justify-start font-normal h-9 text-sm"
                                                onClick={() => {
                                                    setLocalAssignedSites(prev => [...prev, site.id]);
                                                    setSiteSearchQuery("");
                                                }}
                                            >
                                                <PlusCircle className="mr-2 h-4 w-4 text-primary" />
                                                {site.name}
                                            </Button>
                                        ))
                                    ) : (
                                        <p className="p-4 text-center text-xs text-muted-foreground italic">No matching sites found.</p>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider">Authorized Site Access</Label>
                    <div className="rounded-sm border overflow-hidden">
                        <ScrollArea className="h-[250px]">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="text-[10px] uppercase font-bold">Site Name</TableHead>
                                        <TableHead className="text-[10px] uppercase font-bold">Company</TableHead>
                                        <TableHead className="w-16 text-right px-4"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {localAssignedSites.length > 0 ? (
                                        localAssignedSites.map(siteId => {
                                            const site = allSites?.find(s => s.id === siteId);
                                            return (
                                                <TableRow key={siteId} className="hover:bg-muted/5 group">
                                                    <TableCell className="font-semibold text-sm">{site?.name || 'Unknown Site'}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{site?.projectCompany || 'N/A'}</TableCell>
                                                    <TableCell className="text-right px-4">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive rounded-sm" onClick={() => handleRemoveSiteFromLocal(siteId)}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="h-32 text-center text-muted-foreground italic text-sm">
                                                No sites assigned.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                </div>
            </div>

            <DialogFooter className="gap-2 border-t pt-4">
                <DialogClose asChild><Button variant="outline" className="rounded-sm font-bold">Cancel</Button></DialogClose>
                <Button onClick={handleSaveSites} disabled={isSavingSites} className="rounded-sm font-bold min-w-[120px]">
                    {isSavingSites ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Updates
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
