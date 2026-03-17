'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, serverTimestamp, orderBy, or } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ClipboardList, 
  ShoppingBag, 
  Warehouse, 
  Plus, 
  Trash2, 
  ArrowLeft,
  Building2,
  ShieldCheck,
  FileText,
  CheckCircle2,
  History,
  TrendingUp,
  MapPin,
  PlusCircle,
  MinusCircle,
  Users,
  CheckSquare,
  ArrowLeftRight,
  Navigation,
  Activity,
  FolderOpen,
  UserCog,
  LayoutDashboard,
  Clock,
  User,
  Zap,
  ChevronRight,
  Table as TableIcon,
  Search,
  ChevronsUpDown,
  Check
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { isSuperAdmin } from '@/lib/auth-constants';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Link from 'next/link';

type Project = {
  id: string;
  name: string;
  projectCompany: string;
  acCapacity: number;
  dcCapacity: number;
};

type UserProfile = {
  id: string;
  username: string;
  email: string;
  role: 'Admin' | 'Site Manager' | 'Site Engineer' | 'Driver';
  assignedProjectIds?: string[];
  siteManagerId?: string;
  mobile?: string;
};

type BoMItem = {
  id: string;
  itemName: string;
  specification: string;
  plannedQuantity: number;
  unit: string;
};

type PurchaseOrder = {
  id: string;
  poNumber: string;
  supplierName: string;
  orderDate: string;
  status: string;
  totalAmount: number;
};

type InventoryItem = {
  id: string;
  itemName: string;
  stockLevel: number;
  unit: string;
  lastUpdated: any;
};

type MasterItem = {
  id: string;
  name: string;
  category: string;
  make: string;
  unit: string;
  description?: string;
};

const formatTimestamp = (ts: any) => {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return format(date, 'dd MMM yyyy');
};

const formatCapacity = (val: any) => {
  const num = typeof val === 'number' ? val : parseFloat(String(val || 0));
  return isNaN(num) ? "0.000" : num.toFixed(3);
};

export default function ProjectCommandCenterPage({ params }: { params: Promise<{ projectId: string }> }) {
  const resolvedParams = React.use(params);
  const projectId = resolvedParams.projectId;
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [activeTab, setActiveTab] = React.useState("dashboard");
  const [selectedMasterItem, setSelectedMasterItem] = React.useState<MasterItem | null>(null);
  const [isBomItemPopoverOpen, setIsBomItemPopoverOpen] = React.useState(false);
  const [bomItemSearchQuery, setBomItemSearchQuery] = React.useState("");

  // 1. Core Site Info
  const projectRef = useMemoFirebase(() => doc(firestore, 'sites', projectId), [firestore, projectId]);
  const { data: project, isLoading: projectLoading } = useDoc<Project>(projectRef);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const siteName = project?.name || "";

  // 2. Registries (BoM, PO, Inv, Master Inventory)
  const bomQuery = useMemoFirebase(() => 
    query(collection(firestore, 'project_boms'), where('siteId', '==', projectId)), 
    [firestore, projectId]
  );
  const { data: bomItems } = useCollection<BoMItem>(bomQuery);

  const posQuery = useMemoFirebase(() => 
    query(collection(firestore, 'project_pos'), where('siteId', '==', projectId)), 
    [firestore, projectId]
  );
  const { data: purchaseOrders } = useCollection<PurchaseOrder>(posQuery);

  const inventoryQuery = useMemoFirebase(() => 
    query(collection(firestore, 'project_inventory'), where('siteId', '==', projectId)), 
    [firestore, projectId]
  );
  const { data: inventory } = useCollection<InventoryItem>(inventoryQuery);

  const masterInventoryQuery = useMemoFirebase(() => collection(firestore, 'master_inventory'), [firestore]);
  const { data: masterItems } = useCollection<MasterItem>(masterInventoryQuery);

  // 3. Field Activities
  const ptwQuery = useMemoFirebase(() => 
    siteName ? query(collection(firestore, 'permits_to_work'), where('siteName', '==', siteName)) : null,
    [firestore, siteName]
  );
  const { data: permits } = useCollection(ptwQuery);

  const dprQuery = useMemoFirebase(() => 
    siteName ? query(collection(firestore, 'dprs'), where('siteName', '==', siteName)) : null,
    [firestore, siteName]
  );
  const { data: dprs } = useCollection(dprQuery);

  const taskQuery = useMemoFirebase(() => 
    siteName ? query(collection(firestore, 'tasks'), where('siteName', '==', siteName)) : null,
    [firestore, siteName]
  );
  const { data: tasks } = useCollection(taskQuery);

  const movementQuery = useMemoFirebase(() => 
    siteName ? query(collection(firestore, 'material_movements'), where('siteName', '==', siteName)) : null,
    [firestore, siteName]
  );
  const { data: movements } = useCollection(movementQuery);

  const visitQuery = useMemoFirebase(() => 
    query(collection(firestore, 'site_visits'), where('siteId', '==', projectId)),
    [firestore, projectId]
  );
  const { data: visits } = useCollection(visitQuery);

  // 4. Team Logic
  const allUsersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers, isLoading: teamLoading } = useCollection<UserProfile>(allUsersQuery);

  const siteTeam = React.useMemo(() => {
    if (!allUsers) return [];
    const directTeam = allUsers.filter(u => u.assignedProjectIds?.includes(projectId));
    const managerIds = new Set<string>();
    directTeam.forEach(u => { if (u.siteManagerId) managerIds.add(u.siteManagerId); });
    const linkedManagers = allUsers.filter(u => managerIds.has(u.id));
    const combined = [...directTeam];
    linkedManagers.forEach(m => { if (!combined.find(u => u.id === m.id)) combined.push(m); });
    return combined.sort((a, b) => {
      const h = { 'Admin': 0, 'Site Manager': 1, 'Site Engineer': 2 };
      return (h[a.role] ?? 3) - (h[b.role] ?? 3);
    });
  }, [allUsers, projectId]);

  const filteredMasterItems = React.useMemo(() => {
    if (!masterItems) return [];
    return masterItems.filter(item => 
      item.name.toLowerCase().includes(bomItemSearchQuery.toLowerCase()) ||
      item.make.toLowerCase().includes(bomItemSearchQuery.toLowerCase())
    );
  }, [masterItems, bomItemSearchQuery]);

  const handleAddBoM = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const itemName = formData.get('itemName') as string;
    
    if (!itemName) {
      toast({ variant: 'destructive', title: 'Selection Missing', description: 'Please select a material from the inventory list.' });
      return;
    }

    const item = {
      siteId: projectId,
      itemName: itemName,
      specification: formData.get('spec') as string,
      plannedQuantity: parseFloat(formData.get('qty') as string),
      unit: formData.get('unit') as string,
      createdAt: serverTimestamp()
    };
    
    addDocumentNonBlocking(collection(firestore, 'project_boms'), item);
    toast({ title: 'Item Added' });
    setSelectedMasterItem(null);
    (e.target as HTMLFormElement).reset();
  };

  const handleUpdateStock = async (itemId: string, newStock: number) => {
    updateDocumentNonBlocking(doc(firestore, 'project_inventory', itemId), {
      stockLevel: newStock,
      lastUpdated: serverTimestamp()
    });
    toast({ title: 'Stock Updated' });
  };

  if (projectLoading) return (
    <div className="space-y-8 p-6 animate-pulse">
      <Skeleton className="h-12 w-1/3" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  if (!project) return <div className="p-20 text-center">Project site not found in registry.</div>;

  return (
    <div className="flex flex-col flex-1 h-full -mt-4 lg:-mt-6">
      {/* Sticky Header Section */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b shadow-sm -mx-4 lg:-mx-6 px-4 lg:px-6 py-4 animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => router.push('/projects/list')} className="h-7 mb-1 -ml-2 text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Registry
            </Button>
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-sm shrink-0">
                <Building2 className="h-6 w-6 md:h-7 md:w-7 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-black uppercase tracking-tighter truncate leading-none">{project.name}</h1>
                <p className="text-muted-foreground font-bold text-[10px] md:text-xs flex items-center gap-1.5 mt-1 truncate">
                  {project.projectCompany}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" asChild className="rounded-sm font-bold border-primary/20 text-primary h-9 md:h-10 px-4 bg-background shadow-sm hover:bg-primary/5 transition-all">
              <Link href={`/documents/${projectId}`}>
                <FolderOpen className="mr-2 h-4 w-4" /> Documents Explorer
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-8 pt-6 px-0.5">
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <div className="p-4 bg-primary/5 border border-primary/10 rounded-sm">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">AC Capacity</p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black text-primary">{formatCapacity(project.acCapacity)}</span>
              <span className="text-[8px] font-bold text-muted-foreground uppercase">MW</span>
            </div>
          </div>
          <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-sm">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">DC Capacity</p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black text-amber-700">{formatCapacity(project.dcCapacity)}</span>
              <span className="text-[8px] font-bold text-muted-foreground uppercase">MWp</span>
            </div>
          </div>
          <div className="p-4 bg-muted/30 border rounded-sm">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Audit Score</p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black text-foreground">
                {(permits?.length || 0) + (dprs?.length || 0)}
              </span>
              <Activity className="h-3 w-3 text-primary" />
            </div>
          </div>
          <div className="p-4 bg-muted/30 border rounded-sm">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Team Size</p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black text-foreground">{siteTeam.length}</span>
              <Users className="h-3 w-3 text-primary" />
            </div>
          </div>
          <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-sm hidden lg:block">
            <p className="text-[10px] font-black uppercase text-emerald-700 tracking-widest mb-1">Completion</p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black text-emerald-700">74%</span>
              <TrendingUp className="h-3 w-3 text-emerald-600" />
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <ScrollArea className="w-full">
            <TabsList className="flex w-max min-w-full rounded-sm bg-muted/50 border border-primary/10 p-1 h-11">
              <TabsTrigger value="dashboard" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9">
                <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" /> Board
              </TabsTrigger>
              <TabsTrigger value="bom" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9">
                <ClipboardList className="h-3.5 w-3.5 mr-1.5" /> BoM
              </TabsTrigger>
              <TabsTrigger value="inventory" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9">
                <Warehouse className="h-3.5 w-3.5 mr-1.5" /> Stock
              </TabsTrigger>
              <TabsTrigger value="po" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9">
                <ShoppingBag className="h-3.5 w-3.5 mr-1.5" /> Procurement
              </TabsTrigger>
              <TabsTrigger value="ptw" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9">
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Permits
              </TabsTrigger>
              <TabsTrigger value="dpr" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9">
                <TableIcon className="h-3.5 w-3.5 mr-1.5" /> DPR
              </TabsTrigger>
              <TabsTrigger value="logistics" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9">
                <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" /> Logistics
              </TabsTrigger>
              <TabsTrigger value="tasks" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9">
                <CheckSquare className="h-3.5 w-3.5 mr-1.5" /> Tasks
              </TabsTrigger>
              <TabsTrigger value="visits" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9">
                <Navigation className="h-3.5 w-3.5 mr-1.5" /> Visits
              </TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {/* --- Tab Content: Dashboard --- */}
          <TabsContent value="dashboard" className="space-y-8 mt-6 animate-in fade-in-50 duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Card className="lg:col-span-2 rounded-sm border-primary/10 shadow-md overflow-hidden">
                <CardHeader className="bg-muted/5 border-b py-4">
                  <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" /> Site Personnel Hierarchy
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {teamLoading ? (
                    <div className="p-8 space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
                  ) : siteTeam.length > 0 ? (
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="px-6">Personnel</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Contact</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {siteTeam.map(member => (
                          <TableRow key={member.id} className="hover:bg-muted/5 group">
                            <TableCell className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-sm text-foreground">{member.username}</span>
                                <span className="text-[10px] text-muted-foreground uppercase">{member.email}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn(
                                "rounded-sm text-[9px] font-black uppercase border-primary/20",
                                member.role === 'Site Manager' ? "bg-primary text-white border-none" : "text-primary bg-primary/5"
                              )}>
                                {member.role === 'Site Manager' && <UserCog className="h-2.5 w-2.5 mr-1" />}
                                {member.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-medium font-mono text-muted-foreground">{member.mobile || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-20 text-center text-muted-foreground italic text-sm">No personnel currently mapped to this site.</div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="rounded-sm border-primary/10 shadow-sm overflow-hidden h-full">
                  <CardHeader className="py-4 border-b bg-muted/5">
                    <CardTitle className="text-xs font-bold uppercase tracking-widest">Compliance Health</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <StatRow label="Approved Permits" value={permits?.filter((p: any) => p.status === 'Approved').length || 0} color="green" />
                    <StatRow label="Pending Audits" value={permits?.filter((p: any) => p.status === 'Pending').length || 0} color="amber" />
                    <StatRow label="Ongoing Work" value={tasks?.filter((t: any) => t.status !== 'Completed').length || 0} color="blue" />
                    <StatRow label="Total Evidence" value={dprs?.length || 0} color="primary" />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* --- Tab Content: BoM --- */}
          <TabsContent value="bom" className="space-y-8 mt-6 animate-in fade-in-50 duration-300">
            {isAdmin && (
              <Card className="rounded-sm border-primary/10 bg-primary/5 shadow-sm">
                <CardHeader className="py-4 border-b">
                  <CardTitle className="text-xs font-bold uppercase tracking-widest">Add BoM Entry</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <form onSubmit={handleAddBoM} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                    <div className="md:col-span-4 space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Select From Master Inventory</Label>
                        <Popover open={isBomItemPopoverOpen} onOpenChange={setIsBomItemPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-between font-normal h-10 rounded-sm bg-background border-primary/20">
                              {selectedMasterItem ? selectedMasterItem.name : "Choose material..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <div className="flex items-center border-b px-3">
                              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                              <Input 
                                placeholder="Filter items..." 
                                className="h-9 w-full border-none focus-visible:ring-0 px-0 text-sm" 
                                value={bomItemSearchQuery}
                                onChange={(e) => setBomItemSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.stopPropagation()}
                              />
                            </div>
                            <ScrollArea className="h-[200px]">
                              <div className="p-1">
                                {filteredMasterItems.length > 0 ? (
                                  filteredMasterItems.map((item) => (
                                    <Button
                                      key={item.id}
                                      type="button"
                                      variant="ghost"
                                      className="w-full justify-start text-left font-normal h-11 text-xs mb-0.5"
                                      onClick={() => {
                                        setSelectedMasterItem(item);
                                        setIsBomItemPopoverOpen(false);
                                        setBomItemSearchQuery("");
                                      }}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4 text-primary", selectedMasterItem?.id === item.id ? "opacity-100" : "opacity-0")} />
                                      <div className="flex flex-col items-start min-w-0 text-left">
                                        <span className="font-bold truncate w-full text-foreground text-left">{item.name}</span>
                                        <span className="text-[8px] uppercase text-muted-foreground text-left">{item.make} • {item.category}</span>
                                      </div>
                                    </Button>
                                  ))
                                ) : (
                                  <p className="p-4 text-center text-[10px] uppercase font-bold text-muted-foreground">No matches</p>
                                )}
                              </div>
                            </ScrollArea>
                          </PopoverContent>
                        </Popover>
                        <input type="hidden" name="itemName" value={selectedMasterItem?.name || ""} />
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Target Qty</Label>
                        <div className="flex gap-2">
                          <Input name="qty" type="number" required placeholder="0" className="h-11 rounded-sm bg-background border-primary/20" />
                          <Input 
                            key={`unit-${selectedMasterItem?.id || 'none'}`}
                            name="unit" 
                            placeholder="Unit" 
                            readOnly
                            defaultValue={selectedMasterItem?.unit || ""} 
                            className="w-24 h-11 rounded-sm bg-muted/20 border-primary/10 font-black text-primary cursor-not-allowed" 
                          />
                        </div>
                      </div>
                      <Button type="submit" className="rounded-sm h-11 font-black uppercase text-[10px] tracking-widest w-full shadow-xl" disabled={!selectedMasterItem}>
                        <Plus className="h-4 w-4 mr-2" /> Add to BoM
                      </Button>
                    </div>
                    
                    <div className="md:col-span-8 space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Technical Specifications (Automated)</Label>
                      <Textarea 
                        readOnly
                        key={`spec-${selectedMasterItem?.id || 'none'}`}
                        name="spec" 
                        placeholder="Select an item to view its master specification..." 
                        defaultValue={selectedMasterItem?.description || ""}
                        className="min-h-[160px] rounded-sm bg-muted/10 border-primary/10 cursor-not-allowed resize-none text-sm leading-relaxed italic" 
                      />
                      <p className="text-[9px] text-muted-foreground font-medium italic px-1">Values are pulled directly from the Master Inventory registry to ensure audit compliance.</p>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="px-6">Description</TableHead>
                        <TableHead>Specification</TableHead>
                        <TableHead className="text-center">Target Qty</TableHead>
                        {isAdmin && <TableHead className="text-right px-6">Action</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bomItems && bomItems.length > 0 ? bomItems.map(item => (
                        <TableRow key={item.id} className="hover:bg-muted/5">
                          <TableCell className="px-6 py-4 font-bold text-sm text-foreground">{item.itemName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.specification}</TableCell>
                          <TableCell className="text-center font-mono font-bold text-primary">{item.plannedQuantity} {item.unit}</TableCell>
                          {isAdmin && (
                            <TableCell className="text-right px-6">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'project_boms', item.id))}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      )) : (
                        <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic text-xs">Registry empty.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- Tab Content: Inventory --- */}
          <TabsContent value="inventory" className="space-y-8 mt-6 animate-in fade-in-50 duration-300">
            <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
              <CardHeader className="bg-muted/5 border-b py-4">
                <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <Warehouse className="h-4 w-4 text-primary" /> Live On-Site Stock
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="px-6 min-w-[200px]">Material</TableHead>
                        <TableHead className="text-center">Availability</TableHead>
                        <TableHead>Last Audit</TableHead>
                        <TableHead className="text-right px-6">Manual Adjust</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventory && inventory.length > 0 ? inventory.map(item => (
                        <TableRow key={item.id} className="hover:bg-muted/5">
                          <TableCell className="px-6 py-4 font-bold text-sm">{item.itemName}</TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-emerald-600 text-white font-mono font-bold rounded-sm px-2 h-6 border-none">
                              {item.stockLevel} {item.unit}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[10px] text-muted-foreground uppercase font-black">{formatTimestamp(item.lastUpdated)}</TableCell>
                          <TableCell className="text-right px-6">
                            <div className="flex justify-end items-center gap-1.5">
                              <Button variant="outline" size="icon" className="h-8 w-8 rounded-sm border-primary/20 text-primary" onClick={() => handleUpdateStock(item.id, Math.max(0, item.stockLevel - 1))}>
                                <MinusCircle className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="icon" className="h-8 w-8 rounded-sm border-primary/20 text-primary" onClick={() => handleUpdateStock(item.id, item.stockLevel + 1)}>
                                <PlusCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic text-xs">No stock data available.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- Tab Content: POs --- */}
          <TabsContent value="po" className="mt-6 animate-in fade-in-50 duration-300">
            <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
              <CardHeader className="bg-muted/5 border-b py-4">
                <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-primary" /> Active Purchase Orders
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="px-6">PO Number</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right px-6">Total Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseOrders && purchaseOrders.length > 0 ? purchaseOrders.map(po => (
                        <TableRow key={po.id} className="hover:bg-muted/5">
                          <TableCell className="px-6 py-4 font-mono text-xs font-black text-primary uppercase">{po.poNumber}</TableCell>
                          <TableCell className="text-sm font-bold">{po.supplierName}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[9px] font-black uppercase rounded-sm px-1.5 h-5">{po.status}</Badge></TableCell>
                          <TableCell className="text-right px-6 font-black text-sm font-mono">₹{po.totalAmount.toLocaleString('en-IN')}</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic text-xs">No POs found.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- Tab Content: Permits --- */}
          <TabsContent value="ptw" className="mt-6 animate-in fade-in-50 duration-300">
            <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md">
              <CardHeader className="bg-muted/5 border-b py-4">
                <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Compliance Audit: PtWs
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {permits && permits.length > 0 ? (
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="px-6">Serial No</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right px-6">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {permits.map((permit: any) => (
                        <TableRow key={permit.id} className="hover:bg-muted/5">
                          <TableCell className="px-6 py-4 font-mono text-xs font-bold text-primary">{permit.serialNumber || permit.id.slice(0, 8)}</TableCell>
                          <TableCell className="text-sm font-semibold">{permit.ptwType}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[9px] font-black uppercase rounded-sm h-5">{permit.status}</Badge></TableCell>
                          <TableCell className="text-right px-6">
                            <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary">
                              <Link href={`/ptw/list?view=${permit.id}`}><ChevronRight className="h-4 w-4" /></Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-20 text-center text-muted-foreground italic">No permits found.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- Tab Content: DPR --- */}
          <TabsContent value="dpr" className="mt-6 animate-in fade-in-50 duration-300">
            <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md">
              <CardHeader className="bg-muted/5 border-b py-4">
                <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Daily Progress Reports
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {dprs && dprs.length > 0 ? (
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="px-6">Date</TableHead>
                        <TableHead>Engineer</TableHead>
                        <TableHead className="max-w-[400px]">Update Summary</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dprs.sort((a: any, b: any) => new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime()).map((dpr: any) => (
                        <TableRow key={dpr.id} className="hover:bg-muted/5">
                          <TableCell className="px-6 py-4 font-mono text-xs font-bold whitespace-nowrap">{dpr.reportDate}</TableCell>
                          <TableCell className="text-xs font-semibold">{dpr.userName}</TableCell>
                          <TableCell className="text-sm text-muted-foreground italic line-clamp-2 py-4">"{dpr.description}"</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-20 text-center text-muted-foreground italic">No reports found.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- Tab Content: Logistics --- */}
          <TabsContent value="logistics" className="mt-6 animate-in fade-in-50 duration-300">
            <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md">
              <CardHeader className="bg-muted/5 border-b py-4">
                <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4 text-primary" /> Material Movement Logs
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {movements && movements.length > 0 ? (
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="px-6">Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead className="text-right px-6">Source/Dest</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movements.sort((a: any, b: any) => new Date(b.movementDate).getTime() - new Date(a.movementDate).getTime()).map((mov: any) => (
                        <TableRow key={mov.id} className="hover:bg-muted/5">
                          <TableCell className="px-6 py-4 font-mono text-xs font-bold whitespace-nowrap">{mov.movementDate}</TableCell>
                          <TableCell>
                            <Badge className={cn(
                              "text-[9px] font-black uppercase rounded-sm",
                              mov.movementType === 'Inward' ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                            )}>
                              {mov.movementType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-semibold">{mov.itemName}</TableCell>
                          <TableCell className="text-xs font-bold text-primary">{mov.quantity} {mov.unit}</TableCell>
                          <TableCell className="text-right px-6 text-[10px] font-bold text-muted-foreground uppercase">{mov.sourceOrDestination}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-20 text-center text-muted-foreground italic">No movements found.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- Tab Content: Tasks --- */}
          <TabsContent value="tasks" className="mt-6 animate-in fade-in-50 duration-300">
            <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md">
              <CardHeader className="bg-muted/5 border-b py-4">
                <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-primary" /> Open Assignments
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {tasks && tasks.length > 0 ? (
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="px-6">Title</TableHead>
                        <TableHead>Assignee</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right px-6">Due</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks.map((task: any) => (
                        <TableRow key={task.id} className="hover:bg-muted/5">
                          <TableCell className="px-6 py-4 font-bold text-sm">{task.title}</TableCell>
                          <TableCell className="text-xs font-medium">{task.assignedToName}</TableCell>
                          <TableCell><Badge variant="secondary" className="text-[9px] font-black uppercase rounded-sm">{task.status}</Badge></TableCell>
                          <TableCell className="text-right px-6 text-[10px] font-mono font-black text-muted-foreground">{task.dueDate}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-20 text-center text-muted-foreground italic">No active tasks.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- Tab Content: Visits --- */}
          <TabsContent value="visits" className="mt-6 animate-in fade-in-50 duration-300">
            <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md">
              <CardHeader className="bg-muted/5 border-b py-4">
                <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-primary" /> Management Presence
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {visits && visits.length > 0 ? (
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="px-6">Audit Date</TableHead>
                        <TableHead>Manager</TableHead>
                        <TableHead>Purpose</TableHead>
                        <TableHead className="text-right px-6">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visits.map((visit: any) => (
                        <TableRow key={visit.id} className="hover:bg-muted/5 group">
                          <TableCell className="px-6 py-4 font-mono text-[10px] font-bold text-muted-foreground">{formatTimestamp(visit.startTime)}</TableCell>
                          <TableCell className="text-sm font-bold text-foreground">{visit.managerName}</TableCell>
                          <TableCell><Badge variant="secondary" className="text-[9px] font-black uppercase rounded-sm">{visit.purpose || '—'}</Badge></TableCell>
                          <TableCell className="text-right px-6">
                            <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary rounded-sm">
                              <Link href={`/site-visits/${visit.id}`}><ChevronRight className="h-4 w-4" /></Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-20 text-center text-muted-foreground italic">No audits recorded.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string, value: number, color: string }) {
  const colors = {
    green: "text-green-600 bg-green-50 border-green-100",
    amber: "text-amber-600 bg-amber-50 border-amber-100",
    blue: "text-blue-600 bg-blue-50 border-blue-100",
    primary: "text-primary bg-primary/5 border-primary/10",
  };
  return (
    <div className={cn("flex items-center justify-between p-3 rounded-sm border", (colors as any)[color])}>
      <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
      <span className="text-base font-black">{value}</span>
    </div>
  );
}
