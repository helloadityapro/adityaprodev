'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  useCollection, 
  useDoc, 
  useMemoFirebase, 
  useUser, 
  useFirestore 
} from '@/firebase';
import { 
  collection, 
  doc, 
  query, 
  where, 
  orderBy, 
  or, 
  and, 
  limit
} from 'firebase/firestore';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Building2, 
  ArrowLeft,
  LayoutDashboard,
  PlugZap,
  ClipboardList,
  ShoppingBag,
  Gavel,
  IndianRupee,
  Warehouse,
  PieChart,
  ArrowLeftRight,
  ShieldCheck,
  Table as TableIcon,
  CheckSquare,
  Navigation,
  FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { type PageKey, slugifyRole } from '@/lib/access-control';
import { isSuperAdmin } from '@/lib/auth-constants';

// Types & Utils
import { Project, UserProfile, MappingOverride, DataItem, BoMItem, PurchaseOrder, WorkOrder, Payment, InventoryItem, MasterItem, MaterialUtilisation, LiaisoningRecord } from './types';
import { formatCapacity } from './utils';

// Tab Components
import { SiteDashboard } from './components/site-dashboard';
import { LiaisoningTab } from './components/liaisoning-tab';
import { BoMTab } from './components/bom-tab';
import { POTab } from './components/po-tab';
import { WOTab } from './components/wo-tab';
import { PaymentsTab } from './components/payments-tab';
import { InventoryTab } from './components/inventory-tab';
import { UtilisationTab } from './components/utilisation-tab';
import { MovementsTab } from './components/movements-tab';
import { PermitsTab } from './components/permits-tab';
import { DPRTab } from './components/dpr-tab';
import { TasksTab } from './components/tasks-tab';
import { VisitsTab } from './components/visits-tab';

export default function ProjectCommandCenterPage({ params }: { params: Promise<{ projectId: string }> }) {
  const resolvedParams = React.use(params);
  const projectId = resolvedParams.projectId;
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = React.useState(tabParam || "dashboard");

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<any>(roleConfigsQuery);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const ALL_TABS = React.useMemo(() => [
    { id: "dashboard", key: "project-tab-dashboard", label: "BOARD", icon: LayoutDashboard },
    { id: "liaisoning", key: "project-tab-liaisoning", label: "LIAISONING", icon: PlugZap },
    { id: "bom", key: "project-tab-bom", label: "BOM", icon: ClipboardList },
    { id: "po", key: "project-tab-po", label: "PURCHASE ORDERS", icon: ShoppingBag },
    { id: "wo", key: "project-tab-wo", label: "WORK ORDERS", icon: Gavel },
    { id: "payments", key: "project-tab-payments", label: "PAYMENTS", icon: IndianRupee },
    { id: "inventory", key: "project-tab-inventory", label: "INVENTORY", icon: Warehouse },
    { id: "utilisation", key: "project-tab-utilisation", label: "UTILISATION", icon: PieChart },
    { id: "movements", key: "project-tab-movements", label: "MOVEMENTS", icon: ArrowLeftRight },
    { id: "ptw", key: "project-tab-ptw", label: "PERMITS", icon: ShieldCheck },
    { id: "dpr", key: "project-tab-dpr", label: "DPR", icon: TableIcon },
    { id: "tasks", key: "project-tab-tasks", label: "TASKS", icon: CheckSquare },
    { id: "visits", key: "project-tab-visits", label: "VISITS", icon: Navigation },
  ], []);

  const authorizedTabs = React.useMemo(() => {
    if (!user || isProfileLoading || !userProfile) return [];
    if (isSuperAdmin(user.email)) return ALL_TABS;
    const roleId = userProfile.role ? slugifyRole(userProfile.role) : 'none';
    const allowedKeys = userProfile.customPermissions ? new Set(userProfile.customPermissions) : new Set(roleConfigs?.find((c: any) => c.id === roleId)?.allowedPageKeys || []);
    if (allowedKeys.size === 0) return ALL_TABS;
    return ALL_TABS.filter(tab => allowedKeys.has(tab.key as PageKey));
  }, [user, userProfile, isProfileLoading, roleConfigs, ALL_TABS]);

  const projectRef = useMemoFirebase(() => doc(firestore, 'sites', projectId), [firestore, projectId]);
  const { data: project, isLoading: projectLoading } = useDoc<Project>(projectRef);
  const siteName = project?.name || "";

  // Queries
  const bomQuery = useMemoFirebase(() => query(collection(firestore, 'project_boms'), where('siteId', '==', projectId)), [firestore, projectId]);
  const { data: bomItems } = useCollection<BoMItem>(bomQuery);

  const posQuery = useMemoFirebase(() => siteName ? query(collection(firestore, 'project_pos'), or(where('siteId', '==', projectId), where('siteName', '==', siteName))) : null, [firestore, projectId, siteName]);
  const { data: purchaseOrders } = useCollection<PurchaseOrder>(posQuery);

  const wosQuery = useMemoFirebase(() => query(collection(firestore, 'project_wos'), where('siteId', '==', projectId)), [firestore, projectId]);
  const { data: workOrders } = useCollection<WorkOrder>(wosQuery);

  const paymentsQuery = useMemoFirebase(() => query(collection(firestore, 'payments'), where('siteId', '==', projectId)), [firestore, projectId]);
  const { data: payments } = useCollection<Payment>(paymentsQuery);

  const inventoryQuery = useMemoFirebase(() => query(collection(firestore, 'project_inventory'), where('siteId', '==', projectId)), [firestore, projectId]);
  const { data: inventory } = useCollection<InventoryItem>(inventoryQuery);

  const utilisationQuery = useMemoFirebase(() => query(collection(firestore, 'material_utilisations'), where('siteId', '==', projectId)), [firestore, projectId]);
  const { data: utilisations } = useCollection<MaterialUtilisation>(utilisationQuery);

  const movementQuery = useMemoFirebase(() => siteName ? query(collection(firestore, 'material_movements'), or(where('siteId', '==', projectId), and(where('sourceOrDestinationType', '==', 'Site'), where('sourceOrDestination', '==', siteName)))) : null, [firestore, projectId, siteName]);
  const { data: rawMovements } = useCollection<DataItem>(movementQuery);
  const movements = React.useMemo(() => {
    if (!rawMovements || !siteName) return [];
    return rawMovements.map(m => (m.siteId !== projectId && m.sourceOrDestinationType === 'Site' && m.sourceOrDestination === siteName) ? { ...m, movementType: m.movementType === 'Inward' ? 'Outward' : 'Inward', sourceOrDestination: m.siteName } : m);
  }, [rawMovements, projectId, siteName]);

  const ptwQuery = useMemoFirebase(() => query(collection(firestore, 'permits_to_work'), where('siteId', '==', projectId)), [firestore, projectId]);
  const { data: permits } = useCollection(ptwQuery);

  const dprQuery = useMemoFirebase(() => query(collection(firestore, 'dprs'), where('siteId', '==', projectId)), [firestore, projectId]);
  const { data: dprs } = useCollection(dprQuery);

  const taskQuery = useMemoFirebase(() => siteName ? query(collection(firestore, 'tasks'), where('siteName', '==', siteName)) : null, [firestore, siteName]);
  const { data: tasks } = useCollection(taskQuery);

  const visitQuery = useMemoFirebase(() => query(collection(firestore, 'site_visits'), where('siteId', '==', projectId)), [firestore, projectId]);
  const { data: visits } = useCollection(visitQuery);

  const liaisonRef = useMemoFirebase(() => doc(firestore, 'liaisoning_records', projectId), [firestore, projectId]);
  const { data: liaisonRecord } = useDoc<LiaisoningRecord>(liaisonRef);

  const allUsersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers } = useCollection<UserProfile>(allUsersQuery);

  const contractorsQuery = useMemoFirebase(() => collection(firestore, 'contractors'), [firestore]);
  const { data: allContractors } = useCollection<any>(contractorsQuery);

  const masterInventoryQuery = useMemoFirebase(() => collection(firestore, 'master_inventory'), [firestore]);
  const { data: masterItems } = useCollection<MasterItem>(masterInventoryQuery);

  const overridesQuery = useMemoFirebase(() => query(collection(firestore, 'team_mapping_overrides'), where('siteId', '==', projectId)), [firestore, projectId]);
  const { data: siteOverrides } = useCollection<MappingOverride>(overridesQuery);

  const siteTeam = React.useMemo(() => {
    if (!allUsers) return [];
    const assigned = allUsers.filter(u => u.assignedProjectIds?.includes(projectId) && u.role !== 'Admin' && u.role !== 'Site Manager');
    const supIds = new Set<string>();
    assigned.forEach(u => supIds.add(siteOverrides?.find(o => o.engineerId === u.id)?.managerId || u.siteManagerId || ""));
    const supervisors = allUsers.filter(u => supIds.has(u.id));
    const combined = [...assigned];
    supervisors.forEach(m => { if (!combined.find(u => u.id === m.id)) combined.push(m); });
    return combined.sort((a, b) => { const h: any = { 'Admin': 0, 'Site Manager': 1, 'Site Engineer': 2, 'Driver': 3 }; return (h[a.role] ?? 4) - (h[b.role] ?? 4); });
  }, [allUsers, projectId, siteOverrides]);

  const canManageBom = isAdmin || isManager || (authorizedTabs.some(t => t.id === 'bom') && authorizedTabs.some(t => t.id === 'inventory'));

  if (projectLoading || isProfileLoading) return (
    <div className="space-y-8 p-6 animate-pulse">
      <Skeleton className="h-12 w-1/3" /><div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div><Skeleton className="h-[500px] w-full" />
    </div>
  );

  if (!project) return <div className="p-20 text-center">Project site not found in registry.</div>;

  return (
    <div className="flex flex-col flex-1 h-full -mt-4 lg:-mt-6">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b shadow-sm -mx-4 lg:-mx-6 px-4 lg:px-6 py-4 animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0 text-left">
            <Button variant="ghost" size="sm" onClick={() => router.push('/projects/list')} className="h-7 mb-1 -ml-2 text-muted-foreground hover:text-primary transition-colors"><ArrowLeft className="mr-2 h-3.5 w-3.5" /> Back to Projects Management</Button>
            <div className="flex items-center gap-3"><div className="bg-primary/10 p-2 rounded-sm shrink-0"><Building2 className="h-6 w-6 md:h-7 md:w-7 text-primary" /></div><div className="min-w-0"><h1 className="text-xl md:text-2xl font-black uppercase tracking-tighter truncate leading-none">{project.name}</h1><p className="text-muted-foreground font-bold text-[10px] md:text-xs flex items-center gap-2 mt-1 truncate">{project.projectCompany}</p></div></div>
          </div>
          <div className="flex items-center gap-2 shrink-0"><Button variant="outline" size="sm" asChild className="rounded-sm font-bold border-primary/20 text-primary h-9 md:h-10 px-4 bg-background shadow-sm hover:bg-primary/5 transition-all"><Link href={`/documents/${projectId}`}><FolderOpen className="mr-2 h-4 w-4" /> Documents Explorer</Link></Button></div>
        </div>
      </div>

      <div className="flex-1 space-y-8 pt-6 px-0.5">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <StatBox label="AC Capacity" value={formatCapacity(project.acCapacity)} unit="MW" color="primary" />
          <StatBox label="DC Capacity" value={formatCapacity(project.dcCapacity)} unit="MWp" color="amber" />
          <StatBox label="Audit Score" value={(permits?.length || 0) + (dprs?.length || 0)} icon={Activity} color="primary" />
          <StatBox label="Team Size" value={siteTeam.length} icon={Users} color="primary" />
          <StatBox label="Liaisoning" value={`${liaisonRecord?.completionPercentage || 0}%`} icon={TrendingUp} color="emerald" hideMobile />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <ScrollArea className="w-full">
            <TabsList className="flex w-max min-w-full rounded-sm bg-muted/50 border border-primary/10 p-1 h-11">
              {authorizedTabs.map(tab => (
                <TabsTrigger key={tab.id} value={tab.id} className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
                  <tab.icon className="h-3.5 w-3.5 mr-1.5" /> {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <TabsContent value="dashboard"><SiteDashboard project={project} siteTeam={siteTeam} allUsers={allUsers} siteOverrides={siteOverrides} permitsCount={permits?.filter((p:any) => p.status === 'Approved').length || 0} dprsCount={dprs?.length || 0} visitsCount={visits?.filter((v:any) => v.status !== 'completed').length || 0} tasksCount={tasks?.filter((t:any) => t.status !== 'Completed').length || 0} liaisonCompletion={liaisonRecord?.completionPercentage || 0} /></TabsContent>
          <TabsContent value="liaisoning"><LiaisoningTab projectId={projectId} project={project} liaisonRecord={liaisonRecord || null} allContractors={allContractors} userProfile={userProfile} user={user} /></TabsContent>
          <TabsContent value="bom"><BoMTab projectId={projectId} siteName={siteName} bomItems={bomItems} masterItems={masterItems} userProfile={userProfile} user={user} isAdmin={isAdmin} isManager={isManager} canManageBom={canManageBom} /></TabsContent>
          <TabsContent value="po"><POTab projectId={projectId} purchaseOrders={purchaseOrders} userProfile={userProfile} isAdmin={isAdmin} /></TabsContent>
          <TabsContent value="wo"><WOTab projectId={projectId} workOrders={workOrders} userProfile={userProfile} isAdmin={isAdmin} /></TabsContent>
          <TabsContent value="payments"><PaymentsTab projectId={projectId} payments={payments} /></TabsContent>
          <TabsContent value="inventory"><InventoryTab inventory={inventory} bomItems={bomItems} movements={movements} utilisations={utilisations} /></TabsContent>
          <TabsContent value="utilisation"><UtilisationTab utilisations={utilisations} /></TabsContent>
          <TabsContent value="movements"><MovementsTab movements={movements} /></TabsContent>
          <TabsContent value="ptw"><PermitsTab permits={permits} /></TabsContent>
          <TabsContent value="dpr"><DPRTab dprs={dprs} /></TabsContent>
          <TabsContent value="tasks"><TasksTab tasks={tasks} /></TabsContent>
          <TabsContent value="visits"><VisitsTab visits={visits} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatBox({ label, value, unit, icon: Icon, color, hideMobile }: { label: string, value: any, unit?: string, icon?: any, color: string, hideMobile?: boolean }) {
  const colorMap: any = { primary: "bg-primary/5 border-primary/10 text-primary", amber: "bg-amber-500/5 border-amber-500/10 text-amber-700", emerald: "bg-emerald-500/5 border-emerald-500/10 text-emerald-700" };
  return (
    <div className={cn("p-4 rounded-sm border", colorMap[color], hideMobile && "hidden lg:block")}>
      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-black">{value}</span>
        {unit && <span className="text-[8px] font-bold text-muted-foreground uppercase">{unit}</span>}
        {Icon && <Icon className="h-3 w-3 opacity-40 ml-1" />}
      </div>
    </div>
  );
}
