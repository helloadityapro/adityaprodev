'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
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
  X
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { isSuperAdmin } from "@/lib/auth-constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const isManager = userProfile?.role === 'Site Manager';

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
        toast({ title: 'Global Manager Set', description: 'Default reporting line established.' });
        setSelectedEngineerId(null);
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

  const filteredMappings = React.useMemo(() => {
    if (!engineers || !managers) return [];
    
    return engineers
      .filter(e => {
        if (isAdmin) return e.siteManagerId;
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
        let valA: any = ''; let valB: any = '';

        if (key === 'engineer') { valA = (a.username || '').toLowerCase(); valB = (b.username || '').toLowerCase(); }
        else if (key === 'manager') { valA = (managers.find(m => m.id === a.siteManagerId)?.username || '').toLowerCase(); valB = (managers.find(m => m.id === b.siteManagerId)?.username || '').toLowerCase(); }
        else { valA = (a.assignedProjectIds?.length || 0); valB = (b.assignedProjectIds?.length || 0); }

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
      });
  }, [engineers, managers, tableEngineerSearch, tableManagerSearch, sortConfig, isAdmin, user]);

  if (isProfileLoading || usersLoading || sitesLoading || overridesLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Teams & Reporting</h1>
        <p className="text-muted-foreground">Manage global reporting structures and site-specific manager overrides.</p>
      </div>

      {isAdmin && (
        <Card className="rounded-sm border-primary/10 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Define Global Supervisor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">Default Manager</Label>
                <Popover open={isManagerPopoverOpen} onOpenChange={setIsManagerPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between h-10 rounded-sm bg-background border-primary/10">
                      {selectedManagerId ? managers?.find(m => m.id === selectedManagerId)?.username : "Select Manager..."}
                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <div className="flex items-center border-b px-3"><Search className="mr-2 h-4 w-4 shrink-0 opacity-50" /><Input placeholder="Search..." className="h-9 border-none focus-visible:ring-0" value={managerSearchQuery} onChange={e => setManagerSearchQuery(e.target.value)} /></div>
                    <ScrollArea className="h-[200px]"><div className="p-1">{managers.filter(m => m.username?.toLowerCase().includes(managerSearchQuery.toLowerCase())).map(m => (<Button key={m.id} variant="ghost" className="w-full justify-start h-9 text-xs" onClick={() => { setSelectedManagerId(m.id); setIsManagerPopoverOpen(false); }}>{m.username}</Button>))}</div></ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">Engineer</Label>
                <Popover open={isEngineerPopoverOpen} onOpenChange={setIsEngineerPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between h-10 rounded-sm bg-background border-primary/10">
                      {selectedEngineerId ? engineers?.find(e => e.id === selectedEngineerId)?.username : "Select Engineer..."}
                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <div className="flex items-center border-b px-3"><Search className="mr-2 h-4 w-4 shrink-0 opacity-50" /><Input placeholder="Search..." className="h-9 border-none focus-visible:ring-0" value={engineerSearchQuery} onChange={e => setEngineerSearchQuery(e.target.value)} /></div>
                    <ScrollArea className="h-[200px]"><div className="p-1">{engineers.filter(e => e.username?.toLowerCase().includes(engineerSearchQuery.toLowerCase())).map(e => (<Button key={e.id} variant="ghost" className="w-full justify-start h-9 text-xs" onClick={() => { setSelectedEngineerId(e.id); setIsEngineerPopoverOpen(false); }}>{e.username}</Button>))}</div></ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>
              <Button onClick={handleAssign} disabled={!selectedManagerId || !selectedEngineerId || isMapping} className="rounded-sm font-bold">
                {isMapping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Establish Mapping
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                {isAdmin && <TableHead>Global Supervisor</TableHead>}
                <TableHead>Engineer Name</TableHead>
                <TableHead className="text-center">Sites</TableHead>
                <TableHead className="text-right px-6">Special Routing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMappings.map(e => (
                <TableRow key={e.id}>
                  {isAdmin && <TableCell className="font-bold text-sm">{managers.find(m => m.id === e.siteManagerId)?.username}</TableCell>}
                  <TableCell className="font-semibold">{e.username}</TableCell>
                  <TableCell className="text-center"><Badge variant="outline">{e.assignedProjectIds?.length || 0}</Badge></TableCell>
                  <TableCell className="text-right px-6">
                    <Button variant="outline" size="sm" className="h-8 rounded-sm font-bold border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => setOverrideEngineer(e)}>
                      <Building2 className="h-3.5 w-3.5 mr-1.5" /> Site Overrides
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Override Dialog */}
      <Dialog open={!!overrideEngineer} onOpenChange={(o) => !o && setOverrideEngineer(null)}>
        <DialogContent className="max-w-2xl rounded-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-amber-600" /> Site-specific Manager Mapping</DialogTitle>
            <DialogDescription>Define manager overrides for <strong>{overrideEngineer?.username}</strong> per project location.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-sm space-y-4">
              <Label className="text-[10px] font-black uppercase text-amber-800 tracking-widest">New Site-wise Allocation</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold">Target Site</Label>
                  <Select value={newOverrideSiteId} onValueChange={setNewOverrideSiteId}>
                    <SelectTrigger className="h-10 bg-white"><SelectValue placeholder="Choose Site..." /></SelectTrigger>
                    <SelectContent>
                      {allSites?.filter(s => overrideEngineer?.assignedProjectIds?.includes(s.id)).map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold">Designated Manager</Label>
                  <Select value={newOverrideManagerId} onValueChange={setNewOverrideManagerId}>
                    <SelectTrigger className="h-10 bg-white"><SelectValue placeholder="Choose Manager..." /></SelectTrigger>
                    <SelectContent>
                      {managers.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.username}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleAddOverride} disabled={!newOverrideSiteId || !newOverrideManagerId || isAddingOverride} className="w-full bg-amber-600 hover:bg-amber-700">
                {isAddingOverride ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />} Establish Site-wise Mapping
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">Active Overrides</Label>
              <div className="border rounded-sm">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="text-[10px] uppercase">Project Site</TableHead>
                      <TableHead className="text-[10px] uppercase">Mapped Manager</TableHead>
                      <TableHead className="text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overrides?.filter(o => o.engineerId === overrideEngineer?.id).map(o => (
                      <TableRow key={o.id}>
                        <TableCell className="text-xs font-bold">{allSites?.find(s => s.id === o.siteId)?.name || 'Unknown Site'}</TableCell>
                        <TableCell className="text-xs">{managers.find(m => m.id === o.managerId)?.username || 'Unknown Manager'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoveOverride(o.id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!overrides?.some(o => o.engineerId === overrideEngineer?.id) && (
                      <TableRow><TableCell colSpan={3} className="h-20 text-center text-xs text-muted-foreground italic">No site-specific overrides defined. Global default active.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          <DialogFooter><DialogClose asChild><Button variant="outline" className="rounded-sm font-bold uppercase text-[10px]">Close</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
