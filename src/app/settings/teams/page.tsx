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
  MapPin, 
  PlusCircle, 
  Loader2, 
  Pencil, 
  ShieldCheck, 
  XCircle, 
  Building2, 
  UserCog, 
  History, 
  Plus,
  CheckCircle2,
  X,
  ChevronRight,
  Settings2
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { isSuperAdmin } from "@/lib/auth-constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';

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
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

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
  
  const [isMapping, setIsMapping] = React.useState(false);
  const [isAddingOverride, setIsAddingOverride] = React.useState(false);
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

  const handleRemoveOverride = (id: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'team_mapping_overrides', id));
    toast({ title: 'Override Removed' });
  };

  const handleDeleteMapping = (engId: string) => {
    const ref = doc(firestore, 'users', engId);
    updateDocumentNonBlocking(ref, { siteManagerId: null });
    toast({ title: 'Mapping Removed' });
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

  if (isProfileLoading || usersLoading || sitesLoading || overridesLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-foreground">Teams & Site Access</h1>
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
                {isMapping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />} Create Team Link
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
                {filteredMappings.length > 0 ? filteredMappings.map((eng) => (
                  <TableRow key={eng.id} className="hover:bg-muted/5 group transition-colors">
                    <TableCell className="px-6 py-4 font-bold text-sm text-foreground">
                      {managers.find(m => m.id === eng.siteManagerId)?.username || "Unassigned"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-foreground">{eng.username}</span>
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
                              asChild
                            >
                              <Link href="/settings/site-assignment">
                                <Building2 className="h-3.5 w-3.5 mr-1.5 opacity-60" /> Manage Sites
                              </Link>
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 rounded-sm font-bold text-[10px] uppercase border-amber-200 text-amber-700 hover:bg-amber-50"
                              onClick={() => setOverrideEngineer(eng)}
                            >
                              <ShieldCheck className="h-3.5 w-3.5 mr-1.5 opacity-60" /> Site Overrides
                            </Button>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm"><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => handleDeleteMapping(eng.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={4} className="h-48 text-center text-muted-foreground italic font-medium">No personnel mappings discovered.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
