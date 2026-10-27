
'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { 
  useCollection, 
  useDoc, 
  useMemoFirebase, 
  useUser, 
  updateDocumentNonBlocking, 
  addDocumentNonBlocking, 
  deleteDocumentNonBlocking, 
  setDocumentNonBlocking, 
  useFirebaseApp, 
  useFirestore 
} from '@/firebase';
import { 
  collection, 
  doc, 
  query, 
  where, 
  serverTimestamp, 
  orderBy, 
  or, 
  and, 
  getDoc, 
  increment, 
  arrayUnion, 
  updateDoc, 
  getDocs 
} from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ClipboardList, 
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
  Table as TableIcon,
  Search,
  ChevronsUpDown,
  Check,
  XCircle,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Pencil,
  Layers,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Eye,
  Gavel,
  Save,
  HardHat,
  CircleCheck,
  CircleX,
  ShoppingBag,
  ArrowDownCircle,
  ArrowUpCircle,
  Package,
  HandCoins,
  ExternalLink,
  CreditCard,
  Wallet,
  IndianRupee,
  PieChart,
  AlertCircle,
  Calendar,
  Cpu,
  FilterX,
  PlugZap,
  ShieldAlert,
  FileCheck,
  Upload,
  LayoutGrid
} from 'lucide-react';
import { format, parseISO, differenceInMinutes, endOfDay, isValid, differenceInDays, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { isSuperAdmin } from '@/lib/auth-constants';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
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
} from "@/components/ui/alert-dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { type PageKey, slugifyRole } from '@/lib/access-control';
import { Progress } from '@/components/ui/progress';

type Project = {
  id: string;
  name: string;
  projectCompany: string;
  acCapacity: number;
  dcCapacity: number;
  latitude?: number;
  longitude?: number;
  projectOwnerId?: string;
  projectOwnerName?: string;
  workStatus?: string;
  projectStatus?: string;
  ppaDate?: string;
  financialClosureDate?: string;
  ppaScodDate?: string;
  plannedScodDate?: string;
};

type UserProfile = {
  id: string;
  username: string;
  email: string;
  role: string;
  assignedProjectIds?: string[];
  siteManagerId?: string;
  mobile?: string;
  department?: string;
  customPermissions?: PageKey[];
  ownDataOnly?: boolean;
};

type AccessConfig = {
  id: string;
  allowedPageKeys: PageKey[];
  ownDataOnly?: boolean;
};

type AuditEntry = {
  action: string;
  userName: string;
  timestamp: any;
  details: string;
};

type BoMItem = {
  id: string;
  itemName: string;
  category: string;
  specification: string;
  plannedQuantity: number;
  approvedQuantity?: number;
  unit: string;
  make?: string;
  status?: 'Pending' | 'Approved' | 'Rejected';
  processedByName?: string;
  processedAt?: any;
  remarks?: string;
  subItems?: { name: string; quantityPerSet: number; unit: string }[];
  auditLog?: AuditEntry[];
};

type POItem = {
  bomItemId: string;
  itemName: string;
  quantity: number;
  rate: number;
  gstPercent: number;
  amount: number;
};

type POHistoryEntry = {
  action: string;
  userName: string;
  userId: string;
  timestamp: any;
  details?: string;
};

type PurchaseOrder = {
  id: string;
  poNumber: string;
  siteId: string;
  siteName: string;
  supplierName: string;
  orderDate: string;
  status: string;
  totalAmount: number;
  items: POItem[];
  itemsCount?: number;
  createdAt: any;
  createdByName?: string;
  updatedAt?: any;
  updatedByName?: string;
  processedAt?: any;
  processedByName?: string;
  history?: POHistoryEntry[];
};

type WOItem = {
  description: string;
  quantity: number;
  rate: number;
  gstPercent: number;
  amount: number;
};

type WorkOrder = {
  id: string;
  woNumber: string;
  contractorName: string;
  orderDate: string;
  status: string;
  totalAmount: number;
  items?: WOItem[];
  description: string;
  createdAt: any;
  createdByName?: string;
  updatedAt?: any;
  updatedByName?: string;
  processedAt?: any;
  processedByName?: string;
  history?: POHistoryEntry[];
};

type InventoryItem = {
  id: string;
  itemName: string;
  stockLevel: number;
  utilisedQuantity?: number;
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
  subItems?: { name: string; quantityPerSet: number; unit: string }[];
};

type Payment = {
  id: string;
  siteId: string;
  siteName: string;
  projectCompany?: string;
  paymentAgainst: 'PO' | 'WO';
  referenceId: string;
  payeeId: string;
  payeeName: string;
  referenceNumber: string;
  amount: number;
  paymentType: string;
  paymentMode: string;
  paymentDetails: string;
  proofUrl?: string;
  date: any;
  recordedByName?: string;
  editHistory?: any[];
};

type MaterialUtilisation = {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
  utilisationDate: string;
  remarks: string;
  userName: string;
  createdAt: any;
};

type MappingOverride = {
  id: string;
  engineerId: string;
  siteId: string;
  managerId: string;
};

type POSortKey = 'poNumber' | 'supplier' | 'status' | 'date' | 'total';
type WOSortKey = 'woNumber' | 'contractor' | 'status' | 'date' | 'total';
type BoMSortKey = 'itemName' | 'category' | 'make' | 'status' | 'plannedQuantity' | 'approvedQuantity';
type PaymentSortKey = 'date' | 'payee' | 'amount' | 'reference';

type LiaisoningDocument = {
  url: string;
  name: string;
  storagePath: string;
  uploadedAt: string;
};

type StageData = {
  status: 'Pending' | 'In Progress' | 'Completed';
  remarks: string;
  documents: LiaisoningDocument[];
  subStages?: Record<string, boolean>;
  progressFlags?: string[];
};

type LiaisoningRecord = {
  id: string;
  siteId: string;
  siteName: string;
  status: 'In Progress' | 'Completed';
  completionPercentage: number;
  stages: Record<string, StageData>;
  contractorId?: string;
  contractorName?: string;
};

const UNITS = ["Numbers", "Kilograms", "Liters", "Meters", "Sets", "Bundles", "Pairs", "Drums"];

const MAIN_STAGES = [
  { id: 'loa', label: '1. LOA' },
  { id: 'ppa', label: '2. PPA' },
  { id: 'spv_docs', label: '3. SPV or Company Documents' },
  { id: 'land_acquisition', label: '4. Land Acquisition' },
  { id: 'grid_connectivity', label: '5. Grid Connectivity' },
  { 
    id: 'estimate_approval', 
    label: '6. Estimate – Approval Stages', 
    subStages: [
      { id: 'ae_je', label: 'Approved from AE/JE' },
      { id: 'dyee', label: 'Approved from DYEE' },
      { id: 'ee', label: 'Approved from Executive Engineer' },
      { id: 'circle_office', label: 'Approved from Circle Office' }
    ] 
  },
  { id: 'estimate_sanction', label: '7. Estimate Sanction' },
  { id: 'supervision_testing', label: '8. Supervision & Testing Charges' },
  { id: 'material_inspection', label: '9. Material Inspection' },
  { 
    id: 'work_progress', 
    label: '10. Work Progress',
    flags: [
      { id: 'started', label: 'Started' },
      { id: 'not_started', label: 'Not Started Yet' },
      { id: 'row', label: 'ROW' }
    ]
  },
  { id: 'wcr', label: '11. Work Completion Report (WCR)' },
  { id: 'pre_commissioning', label: '12. Pre-Commissioning' },
  { 
    id: 'format_ii_approval', 
    label: '13. Format II – Approval Stages',
    subStages: [
      { id: 'eet', label: 'EE Testing (EET)' },
      { id: 'om', label: 'Superintending Engineer (O&M)' },
      { id: 'setqa', label: 'SE TQA Approved' }
    ]
  },
  { id: 'ptc', label: '14. Permission to Commission (PTC)' },
  { id: 'clearance', label: '15. Clearance Certificate / Release Order' },
  { id: 'commissioning', label: '16. Commissioning' },
  { id: 'commissioning_certificate', label: '17. Commissioning Certificate upload from SE(O&M) to Single Window Portal' }
];

const formatCapacity = (val: any) => {
  const num = typeof val === 'number' ? val : parseFloat(String(val || 0));
  return isNaN(num) ? "0.000" : num.toFixed(3);
};

const getDaysRemaining = (dateStr?: string) => {
  if (!dateStr) return null;
  const date = parseISO(dateStr);
  if (!isValid(date)) return null;
  const today = startOfDay(new Date());
  return differenceInDays(date, today);
};

const renderDaysBadge = (days: number | null) => {
  if (days === null) return <span className="text-muted-foreground/30 font-bold">—</span>;
  const isOverdue = days < 0;
  const isCritical = days <= 30;
  return (
    <Badge variant="outline" className={cn(
      "font-mono font-black text-[9px] h-4 px-1 rounded-sm border-none shadow-sm block w-fit",
      isOverdue ? "bg-red-500 text-white" : isCritical ? "bg-amber-500 text-white" : "bg-emerald-100 text-emerald-800"
    )}>
      {isOverdue ? `Overdue ${Math.abs(days)}d` : `${days}d Left`}
    </Badge>
  );
};

const formatTimestamp = (ts: any) => {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : (typeof ts === 'string' ? new Date(ts) : ts);
  return format(date, 'dd MMM yy HH:mm');
};

const StatRow = ({ label, value, unit = "", color }: { label: string, value: number | string, unit?: string, color: string }) => {
  const colors = {
    green: "text-green-600 bg-green-50 border-green-100",
    amber: "text-amber-600 bg-amber-50 border-amber-100",
    blue: "text-blue-600 bg-blue-50 border-blue-100",
    primary: "text-primary bg-primary/5 border-primary/10",
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100"
  };
  return (
    <div className={cn("flex items-center justify-between p-3 rounded-sm border", (colors as any)[color])}>
      <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
      <span className="text-lg font-black">{value}{unit}</span>
    </div>
  );
};

export default function ProjectCommandCenterPage({ params }: { params: Promise<{ projectId: string }> }) {
  const resolvedParams = React.use(params);
  const projectId = resolvedParams.projectId;
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = React.useState(tabParam || "dashboard");

  const [searchTerm, setSearchTerm] = React.useState("");
  const [bomTableSearch, setBomTableSearch] = React.useState("");
  const [bomStatusFilter, setBomStatusFilter] = React.useState("all");
  const [bomCategoryFilter, setBomCategoryFilter] = React.useState("all");
  const [bomSortConfig, setBomSortConfig] = React.useState<{ key: BoMSortKey; direction: 'asc' | 'desc' }>({ key: 'itemName', direction: 'asc' });

  const [selectedMasterItem, setSelectedMasterItem] = React.useState<MasterItem | null>(null);
  const [isBomItemPopoverOpen, setIsBomItemPopoverOpen] = React.useState(false);
  const [bomItemSearchQuery, setBomItemSearchQuery] = React.useState("");
  
  const [bomActionState, setBomActionState] = React.useState<{ item: BoMItem, type: 'Approved' | 'Rejected' } | null>(null);
  const [poActionState, setPoActionState] = React.useState<{ po: PurchaseOrder, type: 'Accepted' | 'Rejected' } | null>(null);
  const [woActionState, setWoActionState] = React.useState<{ wo: WorkOrder, type: 'Accepted' | 'Rejected' } | null>(null);
  const [isActionProcessing, setIsActionProcessing] = React.useState(false);
  const [expandedBomRows, setExpandedBomRows] = React.useState<Set<string>>(new Set());
  const [expandedInvRows, setExpandedInvRows] = React.useState<Set<string>>(new Set());
  
  const [editingBomItem, setEditingBomItem] = React.useState<BoMItem | null>(null);
  const [isUpdatingBom, setIsUpdatingBom] = React.useState(false);
  const [viewingBomLog, setViewingBomLog] = React.useState<BoMItem | null>(null);

  const [poSearch, setPoSearch] = React.useState("");
  const [poSortConfig, setPoSortConfig] = React.useState<{ key: POSortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [poToDelete, setPoToDelete] = React.useState<PurchaseOrder | null>(null);
  const [expandedPORows, setExpandedPORows] = React.useState<Set<string>>(new Set());
  const [viewingPO, setViewingPO] = React.useState<PurchaseOrder | null>(null);

  const [woSearch, setWoSearch] = React.useState("");
  const [woSortConfig, setWoSortConfig] = React.useState<{ key: WOSortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [woToDelete, setWoToDelete] = React.useState<WorkOrder | null>(null);
  const [expandedWORows, setExpandedWORows] = React.useState<Set<string>>(new Set());
  const [viewingWO, setViewingWO] = React.useState<WorkOrder | null>(null);

  const [paymentSearch, setPaymentSearch] = React.useState("");
  const [paymentSortConfig, setPaymentSortConfig] = React.useState<{ key: PaymentSortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [viewingPayment, setViewingPayment] = React.useState<Payment | null>(null);

  const [activeStageId, setActiveStageId] = React.useState<string>('loa');
  const [uploadingStageId, setUploadingStageId] = React.useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [isContractorPopoverOpen, setIsContractorPopoverOpen] = React.useState(false);
  const [contractorSearch, setContractorSearch] = React.useState("");

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const roleConfigsQuery = useMemoFirebase(() => user ? collection(firestore, 'system_settings', 'access', 'roles') : null, [firestore, user]);
  const { data: roleConfigs } = useCollection<AccessConfig>(roleConfigsQuery);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const hasPermission = React.useCallback((key: PageKey) => {
    if (isAdmin) return true;
    if (!userProfile) return false;
    const allowedKeys = userProfile.customPermissions 
      ? new Set(userProfile.customPermissions) 
      : new Set(roleConfigs?.find(c => c.id === slugifyRole(userProfile.role || ""))?.allowedPageKeys || []);
    return allowedKeys.has(key);
  }, [userProfile, roleConfigs, isAdmin]);

  const canManageBom = isAdmin || isManager || (hasPermission('project-tab-bom') && hasPermission('inventory'));

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

    const roleName = userProfile.role || "none";
    const allowedKeys = userProfile.customPermissions 
      ? new Set(userProfile.customPermissions) 
      : new Set(roleConfigs?.find(c => c.id === slugifyRole(roleName))?.allowedPageKeys || []);

    if (allowedKeys.size === 0) return ALL_TABS;

    return ALL_TABS.filter(tab => {
      if (allowedKeys.has(tab.key as PageKey)) return true;
      if (tab.id === 'po' && allowedKeys.has('purchase-orders')) return true;
      if (tab.id === 'wo' && allowedKeys.has('work-orders')) return true;
      if (tab.id === 'bom' && allowedKeys.has('projects')) return true;
      if (tab.id === 'inventory' && allowedKeys.has('inventory')) return true;
      if (tab.id === 'utilisation' && allowedKeys.has('inventory')) return true;
      if (tab.id === 'movements' && allowedKeys.has('inventory')) return true;
      if (tab.id === 'ptw' && allowedKeys.has('permits')) return true;
      if (tab.id === 'dpr' && allowedKeys.has('dpr')) return true;
      if (tab.id === 'tasks' && allowedKeys.has('tasks')) return true;
      if (tab.id === 'visits' && allowedKeys.has('visits')) return true;
      if (tab.id === 'payments' && allowedKeys.has('payments')) return true;
      if (tab.id === 'liaisoning' && allowedKeys.has('liaisoning')) return true;

      return false;
    });
  }, [user, userProfile, isProfileLoading, roleConfigs, ALL_TABS]);

  const projectRef = useMemoFirebase(() => doc(firestore, 'sites', projectId), [firestore, projectId]);
  const { data: project, isLoading: projectLoading } = useDoc<Project>(projectRef);

  const siteName = project?.name || "";

  const bomQuery = useMemoFirebase(() => 
    query(collection(firestore, 'project_boms'), where('siteId', '==', projectId)), 
    [firestore, projectId]
  );
  const { data: bomItems } = useCollection<BoMItem>(bomQuery);

  const filteredSortedBomItems = React.useMemo(() => {
    if (!bomItems) return [];
    
    let result = bomItems.filter(item => {
      const matchesSearch = item.itemName.toLowerCase().includes(bomTableSearch.toLowerCase()) || 
                           (item.specification || "").toLowerCase().includes(bomTableSearch.toLowerCase()) ||
                           (item.category || "").toLowerCase().includes(bomTableSearch.toLowerCase()) ||
                           (item.make || "").toLowerCase().includes(bomTableSearch.toLowerCase());
      const matchesStatus = bomStatusFilter === 'all' || item.status === bomStatusFilter;
      const matchesCategory = bomCategoryFilter === 'all' || item.category === bomCategoryFilter;
      
      return matchesSearch && matchesStatus && matchesCategory;
    });

    result.sort((a, b) => {
      const { key, direction } = bomSortConfig;
      let valA: any = a[key as keyof BoMItem] ?? '';
      let valB: any = b[key as keyof BoMItem] ?? '';
      
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [bomItems, bomTableSearch, bomStatusFilter, bomCategoryFilter, bomSortConfig]);

  const posQuery = useMemoFirebase(() => {
    if (!siteName) return null;
    return query(
      collection(firestore, 'project_pos'), 
      or(
        where('siteId', '==', projectId),
        where('siteName', '==', siteName)
      )
    );
  }, [firestore, projectId, siteName]);
  const { data: purchaseOrders } = useCollection<PurchaseOrder>(posQuery);

  const wosQuery = useMemoFirebase(() => 
    query(collection(firestore, 'project_wos'), where('siteId', '==', projectId)), 
    [firestore, projectId]
  );
  const { data: workOrders } = useCollection<WorkOrder>(wosQuery);

  const paymentsQuery = useMemoFirebase(() => 
    query(collection(firestore, 'payments'), where('siteId', '==', projectId)), 
    [firestore, projectId]
  );
  const { data: payments } = useCollection<Payment>(paymentsQuery);

  const filteredSortedPayments = React.useMemo(() => {
    if (!payments) return [];
    
    let result = payments.filter(p => 
      p.payeeName.toLowerCase().includes(paymentSearch.toLowerCase()) || 
      p.referenceNumber.toLowerCase().includes(paymentSearch.toLowerCase()) ||
      p.paymentDetails.toLowerCase().includes(paymentSearch.toLowerCase())
    );

    result.sort((a, b) => {
      const { key, direction } = paymentSortConfig;
      let valA: any = ''; let valB: any = '';
      if (key === 'date') { valA = a.date?.toDate?.()?.getTime() || 0; valB = b.date?.toDate?.()?.getTime() || 0; }
      else if (key === 'payee') { valA = a.payeeName.toLowerCase(); valB = b.payeeName.toLowerCase(); }
      else if (key === 'amount') { valA = a.amount; valB = b.amount; }
      else if (key === 'reference') { valA = a.referenceNumber.toLowerCase(); valB = b.referenceNumber.toLowerCase(); }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [payments, paymentSearch, paymentSortConfig]);

  const inventoryQuery = useMemoFirebase(() => 
    query(collection(firestore, 'project_inventory'), where('siteId', '==', projectId)), 
    [firestore, projectId]
  );
  const { data: inventory } = useCollection<InventoryItem>(inventoryQuery);

  const utilisationQuery = useMemoFirebase(() => 
    query(collection(firestore, 'material_utilisations'), where('siteId', '==', projectId)), 
    [firestore, projectId]
  );
  const { data: utilisations } = useCollection<MaterialUtilisation>(utilisationQuery);

  const filteredUtilisations = React.useMemo(() => {
    if (!utilisations) return [];
    return utilisations.filter(u => 
      u.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.remarks.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a: any, b: any) => {
      const da = a.createdAt?.toDate?.()?.getTime() || 0;
      const db = b.createdAt?.toDate?.()?.getTime() || 0;
      return db - da;
    });
  }, [utilisations, searchTerm]);

  const masterInventoryQuery = useMemoFirebase(() => collection(firestore, 'master_inventory'), [firestore]);
  const { data: masterItems } = useCollection<MasterItem>(masterInventoryQuery);

  const ptwQuery = useMemoFirebase(() => 
    query(collection(firestore, 'permits_to_work'), where('siteId', '==', projectId)),
    [firestore, projectId]
  );
  const { data: permits } = useCollection(ptwQuery);

  const dprQuery = useMemoFirebase(() => 
    query(collection(firestore, 'dprs'), where('siteId', '==', projectId)),
    [firestore, projectId]
  );
  const { data: dprs } = useCollection(dprQuery);

  const taskQuery = useMemoFirebase(() => 
    query(collection(firestore, 'tasks'), where('siteName', '==', siteName)),
    [firestore, siteName]
  );
  const { data: tasks } = useCollection(taskQuery);

  const movementQuery = useMemoFirebase(() => 
    query(collection(firestore, 'material_movements'), where('siteId', '==', projectId)),
    [firestore, projectId]
  );
  const { data: movements } = useCollection(movementQuery);

  const visitQuery = useMemoFirebase(() => 
    query(collection(firestore, 'site_visits'), where('siteId', '==', projectId)),
    [firestore, projectId]
  );
  const { data: visits } = useCollection(visitQuery);

  const liaisonRef = useMemoFirebase(() => doc(firestore, 'liaisoning_records', projectId), [firestore, projectId]);
  const { data: liaisonRecord } = useDoc<LiaisoningRecord>(liaisonRef);

  const contractorsQuery = useMemoFirebase(() => collection(firestore, 'contractors'), [firestore]);
  const { data: allContractors } = useCollection<any>(contractorsQuery);

  const allUsersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers, isLoading: teamLoading } = useCollection<UserProfile>(allUsersQuery);

  const overridesQuery = useMemoFirebase(() => 
    query(collection(firestore, 'team_mapping_overrides'), where('siteId', '==', projectId)), 
    [firestore, projectId]
  );
  const { data: siteOverrides } = useCollection<MappingOverride>(overridesQuery);

  const siteTeam = React.useMemo(() => {
    if (!allUsers) return [];
    
    const assignedEngineersAndOthers = allUsers.filter(u => 
      u.assignedProjectIds?.includes(projectId) && 
      u.role !== 'Admin' && u.role !== 'Site Manager'
    );
    
    const effectiveSupervisorIds = new Set<string>();
    assignedEngineersAndOthers.forEach(u => {
      const override = siteOverrides?.find(o => o.engineerId === u.id);
      if (override) {
        effectiveSupervisorIds.add(override.managerId);
      } else if (u.siteManagerId) {
        effectiveSupervisorIds.add(u.siteManagerId);
      }
    });

    const effectiveSupervisors = allUsers.filter(u => effectiveSupervisorIds.has(u.id));
    
    const combined = [...assignedEngineersAndOthers];
    effectiveSupervisors.forEach(m => { 
        if (!combined.find(u => u.id === m.id)) combined.push(m); 
    });
    
    return combined.sort((a, b) => {
      const h: any = { 'Admin': 0, 'Site Manager': 1, 'Site Engineer': 2, 'Driver': 3 };
      return (h[a.role] ?? 4) - (h[b.role] ?? 4);
    });
  }, [allUsers, projectId, siteOverrides]);

  const filteredMasterItems = React.useMemo(() => {
    if (!masterItems) return [];
    return masterItems.filter(item => 
      item.name.toLowerCase().includes(bomItemSearchQuery.toLowerCase()) ||
      item.make.toLowerCase().includes(bomItemSearchQuery.toLowerCase())
    );
  }, [masterItems, bomItemSearchQuery]);

  const filteredSortedPOs = React.useMemo(() => {
    if (!purchaseOrders) return [];
    
    let result = purchaseOrders.filter(po => 
      po.poNumber.toLowerCase().includes(poSearch.toLowerCase()) ||
      po.supplierName.toLowerCase().includes(poSearch.toLowerCase())
    );

    result.sort((a, b) => {
      const { key, direction } = poSortConfig;
      let valA: any = ''; let valB: any = '';
      if (key === 'poNumber') { valA = a.poNumber; valB = b.poNumber; }
      else if (key === 'supplier') { valA = a.supplierName; valB = b.supplierName; }
      else if (key === 'status') { valA = a.status; valB = b.status; }
      else if (key === 'date') { valA = new Date(a.orderDate).getTime(); valB = new Date(b.orderDate).getTime(); }
      else if (key === 'total') { valA = a.totalAmount || 0; valB = b.totalAmount || 0; }
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [purchaseOrders, poSearch, poSortConfig]);

  const filteredSortedWOs = React.useMemo(() => {
    if (!workOrders) return [];
    let result = workOrders.filter(wo => 
      wo.woNumber.toLowerCase().includes(woSearch.toLowerCase()) ||
      wo.contractorName.toLowerCase().includes(woSearch.toLowerCase())
    );
    result.sort((a, b) => {
      const { key, direction } = woSortConfig;
      let valA: any = ''; let valB: any = '';
      if (key === 'woNumber') { valA = a.woNumber; valB = b.woNumber; }
      else if (key === 'contractor') { valA = a.contractorName; valB = b.contractorName; }
      else if (key === 'status') { valA = a.status; valB = b.status; }
      else if (key === 'date') { valA = new Date(a.orderDate).getTime(); valB = new Date(b.orderDate).getTime(); }
      else if (key === 'total') { valA = a.totalAmount || 0; valB = b.totalAmount || 0; }
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [workOrders, woSearch, woSortConfig]);

  const handleLiaisonInitialize = async () => {
    if (!project) return;
    const initialStages: Record<string, StageData> = {};
    MAIN_STAGES.forEach(s => {
      const stageObj: any = { status: 'Pending', remarks: "", documents: [] };
      if (s.subStages) stageObj.subStages = s.subStages.reduce((acc: any, ss) => ({ ...acc, [ss.id]: false }), {});
      if (s.flags) stageObj.progressFlags = [];
      initialStages[s.id] = stageObj;
    });
    await setDocumentNonBlocking(liaisonRef, {
      id: projectId, siteId: projectId, siteName: project.name,
      status: 'In Progress', completionPercentage: 0, stages: initialStages,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: user?.uid
    }, { merge: true });
  };

  const handleUpdateLiaisonStage = async (stageId: string, updates: Partial<StageData>) => {
    if (!liaisonRecord) return;
    const updatedStages = { ...liaisonRecord.stages };
    updatedStages[stageId] = { ...updatedStages[stageId], ...updates };
    const completed = Object.values(updatedStages).filter(s => s.status === 'Completed').length;
    const completion = Math.round((completed / MAIN_STAGES.length) * 100);
    updateDocumentNonBlocking(liaisonRef, {
      stages: updatedStages, completionPercentage: completion,
      status: completion === 100 ? 'Completed' : 'In Progress',
      updatedAt: serverTimestamp(), updatedBy: user?.uid
    });
  };

  const handleLiaisonUploadDoc = async (stageId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !liaisonRecord) return;
    setUploadingStageId(stageId);
    setUploadProgress(0);
    try {
      const storage = getStorage(firebaseApp);
      const timestamp = Date.now();
      const storagePath = `liaisoning/${projectId}/${stageId}/${timestamp}_${file.name.replace(/\s+/g, '_')}`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);
      uploadTask.on('state_changed', 
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        (err) => { toast({ variant: 'destructive', title: 'Upload Failed', description: err.message }); setUploadingStageId(null); },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          const newDoc: LiaisoningDocument = { url, name: file.name, storagePath, uploadedAt: new Date().toISOString() };
          const updatedStages = { ...liaisonRecord.stages };
          if (updatedStages[stageId]) {
            updatedStages[stageId].documents = [...(updatedStages[stageId].documents || []), newDoc];
            updateDocumentNonBlocking(liaisonRef, { stages: updatedStages, updatedAt: serverTimestamp() });
            toast({ title: 'Document Uploaded' });
          }
          setUploadingStageId(null);
          setUploadProgress(0);
        }
      );
    } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); setUploadingStageId(null); }
  };

  const handleLiaisonDeleteDoc = async (stageId: string, docToDelete: LiaisoningDocument) => {
    if (!liaisonRecord) return;
    try {
      const storage = getStorage(firebaseApp);
      await deleteObject(ref(storage, docToDelete.storagePath)).catch(e => console.warn("Storage removal failed", e));
      const updatedStages = { ...liaisonRecord.stages };
      if (updatedStages[stageId]) {
        updatedStages[stageId].documents = (updatedStages[stageId].documents || []).filter(d => d.url !== docToDelete.url);
        updateDocumentNonBlocking(liaisonRef, { stages: updatedStages, updatedAt: serverTimestamp() });
        toast({ title: 'Document Removed' });
      }
    } catch (e: any) { toast({ variant: 'destructive', title: 'Delete Failed', description: e.message }); }
  };

  const handleAssignLiaisonContractor = async (contractor: any) => {
    if (!liaisonRecord) return;
    try {
      await updateDocumentNonBlocking(liaisonRef, { contractorId: contractor.id, contractorName: contractor.name, updatedAt: serverTimestamp() });
      toast({ title: 'Contractor Assigned', description: `${contractor.name} linked to this site tracker.` });
      setIsContractorPopoverOpen(false);
      setContractorSearch("");
    } catch (e: any) { toast({ variant: 'destructive', title: 'Assignment Failed', description: e.message }); }
  };

  const handlePOSort = (key: POSortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const POSortIcon = ({ column, config }: { column: POSortKey, config: any }) => {
    if (config.key !== column) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
    return config.direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3 text-primary" /> : <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  const handleWOSort = (key: WOSortKey) => {
    setWoSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const WOSortIcon = ({ column }: { column: WOSortKey }) => {
    if (woSortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return woSortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3 text-primary" /> : <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  const handleBoMSort = (key: BoMSortKey) => {
    setBomSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const BoMSortIcon = ({ column }: { column: BoMSortKey }) => {
    if (bomSortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return bomSortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3 text-primary" /> : <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  const handlePaymentSort = (key: PaymentSortKey) => {
    setPaymentSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const PaymentSortIcon = ({ column }: { column: PaymentSortKey }) => {
    if (paymentSortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return paymentSortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3 text-primary" /> : <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  const handleAddBoM = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const itemName = formData.get('itemName') as string;
    if (!itemName || !selectedMasterItem) {
      toast({ variant: 'destructive', title: 'Selection Missing', description: 'Please select a material from the inventory list.' });
      return;
    }
    const logEntry = {
      action: 'Created',
      userName: userProfile?.username || user?.email || 'Unknown',
      timestamp: new Date(),
      details: 'Initial BoM entry submission.'
    };
    const item = {
      siteId: projectId,
      siteName: siteName,
      make: selectedMasterItem.make || "Standard",
      category: selectedMasterItem.category,
      specification: selectedMasterItem.description || "",
      plannedQuantity: parseFloat(formData.get('qty') as string),
      unit: selectedMasterItem.unit,
      subItems: selectedMasterItem.subItems || [],
      status: 'Pending',
      createdAt: serverTimestamp(),
      auditLog: [logEntry]
    };
    addDocumentNonBlocking(collection(firestore, 'project_boms'), item);
    toast({ title: 'Item Logged', description: 'BoM entry submitted for administrative approval.' });
    setSelectedMasterItem(null);
    (e.target as HTMLFormElement).reset();
  };

  const handleProcessBoM = (remarks: string, approvedQty?: number) => {
    if (!bomActionState || !userProfile) return;
    setIsActionProcessing(true);
    const logEntry = {
      action: bomActionState.type === 'Approved' ? 'Authorized' : 'Rejected',
      userName: userProfile.username || user?.email || 'Admin',
      timestamp: new Date(),
      details: remarks ? `Remarks: ${remarks}${approvedQty ? ` (Qty Set: ${approvedQty})` : ''}` : 'Processed without specific remarks.'
    };
    const bomRef = doc(firestore, 'project_boms', bomActionState.item.id);
    updateDocumentNonBlocking(bomRef, {
      status: bomActionState.type,
      remarks: remarks,
      approvedQuantity: approvedQty ?? null,
      processedByName: userProfile.username || user?.email || 'Admin',
      processedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      auditLog: arrayUnion(logEntry)
    });
    toast({ 
      title: bomActionState.type === 'Approved' ? 'Item Authorized' : 'Item Rejected', 
      description: `BoM record updated for ${bomActionState.item.itemName}.` 
    });
    setIsActionProcessing(false);
    setBomActionState(null);
  };

  const handleProcessPO = (remarks: string) => {
    if (!poActionState || !userProfile) return;
    setIsActionProcessing(true);
    const logEntry = {
      action: poActionState.type === 'Accepted' ? 'Accepted' : 'Rejected',
      userName: userProfile.username || user?.email || 'Admin',
      userId: user?.uid || '',
      timestamp: new Date(),
      details: remarks ? `Remarks: ${remarks}` : 'Processed without specific remarks.'
    };
    const poRef = doc(firestore, 'project_pos', poActionState.po.id);
    updateDocumentNonBlocking(poRef, {
      status: poActionState.type,
      adminRemarks: remarks,
      processedByName: userProfile.username || user?.email || 'Admin',
      processedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      history: arrayUnion(logEntry)
    });
    toast({ 
      title: poActionState.type === 'Accepted' ? 'PO Accepted' : 'PO Rejected', 
      description: `Purchase Order ${poActionState.po.poNumber} has been updated.` 
    });
    setIsActionProcessing(false);
    setPoActionState(null);
  };

  const handleProcessWO = (remarks: string) => {
    if (!woActionState || !userProfile) return;
    setIsActionProcessing(true);
    const logEntry = {
      action: woActionState.type === 'Accepted' ? 'Accepted' : 'Rejected',
      userName: userProfile.username || user?.email || 'Admin',
      userId: user?.uid || '',
      timestamp: new Date(),
      details: remarks ? `Remarks: ${remarks}` : 'Processed without specific remarks.'
    };
    const woRef = doc(firestore, 'project_wos', woActionState.wo.id);
    updateDocumentNonBlocking(woRef, {
      status: woActionState.type,
      adminRemarks: remarks,
      processedByName: userProfile.username || user?.email || 'Admin',
      processedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid || '',
      updatedByName: userProfile.username || user?.email || 'Admin',
      history: arrayUnion(logEntry)
    });
    toast({ 
      title: woActionState.type === 'Accepted' ? 'WO Accepted' : 'WO Rejected', 
      description: `Work Order ${woActionState.wo.woNumber} has been updated.` 
    });
    setIsActionProcessing(false);
    setWoActionState(null);
  };

  const handleUpdateBoM = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingBomItem) return;
    setIsUpdatingBom(true);
    const formData = new FormData(e.currentTarget);
    const newName = formData.get('itemName') as string;
    const newQty = parseFloat(formData.get('plannedQty') as string);
    const logEntry = {
      action: 'Modified',
      userName: userProfile?.username || user?.email || 'Unknown',
      timestamp: new Date(),
      details: `Entry modified (${newName}, ${newQty} ${formData.get('unit')}). Returned to Pending for re-approval.`
    };
    const updateData = {
      itemName: newName,
      specification: formData.get('specification') as string,
      plannedQuantity: newQty,
      unit: formData.get('unit') as string,
      status: 'Pending',
      updatedAt: serverTimestamp(),
      auditLog: arrayUnion(logEntry)
    };
    try {
      updateDocumentNonBlocking(doc(firestore, 'project_boms', editingBomItem.id), updateData);
      toast({ title: 'Item Updated', description: 'BoM entry modified and returned to Pending for approval.' });
      setEditingBomItem(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsUpdatingBom(false);
    }
  };

  const toggleBomRow = (id: string) => {
    const newSet = new Set(expandedBomRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedBomRows(newSet);
  };

  const toggleInvRow = (id: string) => {
    const newSet = new Set(expandedInvRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedInvRows(newSet);
  };

  const toggleSelectMasterItem = (item: MasterItem) => {
    setSelectedMasterItem(item);
    setIsBomItemPopoverOpen(false);
    setBomItemSearchQuery("");
  };

  const togglePORow = (id: string) => {
    const newSet = new Set(expandedPORows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedPORows(newSet);
  };

  const toggleWORow = (id: string) => {
    const newSet = new Set(expandedWORows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedWORows(newSet);
  };

  const handleDeletePO = async () => {
    if (!poToDelete) return;
    try {
      await deleteDocumentNonBlocking(doc(firestore, 'project_pos', poToDelete.id));
      toast({ title: 'PO Removed', description: 'Purchase Order has been deleted from site records.' });
      setPoToDelete(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
    }
  };

  const handleDeleteWO = async () => {
    if (!woToDelete) return;
    try {
      await deleteDocumentNonBlocking(doc(firestore, 'project_wos', woToDelete.id));
      toast({ title: 'WO Removed', description: 'Work Order has been deleted from site records.' });
      setWoToDelete(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
    }
  };

  const handleClosePOWO = () => {
    setViewingPO(null);
    setViewingWO(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('view');
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const handleDeletePOInTab = (e: React.MouseEvent, po: PurchaseOrder) => {
    e.stopPropagation();
    setPoToDelete(po);
  };

  const handleDeleteWOInTab = (e: React.MouseEvent, wo: WorkOrder) => {
    e.stopPropagation();
    setWoToDelete(wo);
  };

  if (projectLoading || isProfileLoading) return (
    <div className="space-y-8 p-6 animate-pulse">
      <Skeleton className="h-12 w-1/3" />
      <div className="grid grid-cols-4 gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-[500px] w-full" />
    </div>
  );

  if (!project) return <div className="p-20 text-center">Project site not found in registry.</div>;

  return (
    <>
      <div className="flex flex-col flex-1 h-full -mt-4 lg:-mt-6">
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b shadow-sm -mx-4 lg:-mx-6 px-4 lg:px-6 py-4 animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1 min-w-0 text-left">
              <Button variant="ghost" size="sm" onClick={() => router.push('/projects/list')} className="h-7 mb-1 -ml-2 text-muted-foreground hover:text-primary transition-colors">
                <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Back to Projects Management
              </Button>
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-sm shrink-0">
                  <Building2 className="h-6 w-6 md:h-7 md:w-7 text-primary" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl md:text-2xl font-black uppercase tracking-tighter truncate leading-none">{project.name}</h1>
                  <p className="text-muted-foreground font-bold text-[10px] md:text-xs flex items-center gap-2 mt-1 truncate">
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
              <p className="text-[10px] font-black uppercase text-emerald-700 tracking-widest mb-1">Liaisoning Progress</p>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-black text-emerald-700">{liaisonRecord?.completionPercentage || 0}%</span>
                <TrendingUp className="h-3 w-3 text-emerald-600" />
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <ScrollArea className="w-full">
              <TabsList className="flex w-max min-w-full rounded-sm bg-muted/50 border border-primary/10 p-1 h-11">
                {authorizedTabs.map(tab => (
                  <TabsTrigger 
                    key={tab.id}
                    value={tab.id} 
                    className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
                  >
                    <tab.icon className="h-3.5 w-3.5 mr-1.5" /> {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            <TabsContent value="dashboard" className="space-y-8 mt-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2 rounded-sm border-primary/10 shadow-md overflow-hidden">
                  <CardHeader className="bg-muted/5 border-b py-4 text-left">
                    <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" /> Site Personnel Hierarchy
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {teamLoading ? (
                      <div className="p-8 space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
                    ) : (
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow>
                            <TableHead className="px-6 font-black uppercase text-[10px] tracking-widest">Personnel</TableHead>
                            <TableHead className="font-black uppercase text-[10px] tracking-widest">Supervisor</TableHead>
                            <TableHead className="text-center font-black uppercase text-[10px] tracking-widest">Sites</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {project.projectOwnerName && (
                            <TableRow className="bg-primary/[0.03] hover:bg-primary/[0.05] transition-colors border-b-2">
                              <TableCell className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-background rounded-full border shadow-sm shrink-0">
                                    <User className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex flex-col text-left">
                                    <span className="font-black text-sm text-primary uppercase">{project.projectOwnerName}</span>
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Authority Holder</span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className="rounded-sm text-[9px] font-black uppercase bg-primary text-white border-none h-5 px-2">
                                  Project Owner
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="rounded-sm font-mono text-[10px] bg-primary/5 border-primary/20 text-primary">—</Badge>
                              </TableCell>
                            </TableRow>
                          )}
                          {siteTeam.length > 0 ? siteTeam.map(member => {
                            const override = siteOverrides?.find(o => o.engineerId === member.id);
                            const effectiveManagerId = override ? override.managerId : member.siteManagerId;
                            const manager = allUsers?.find(m => m.id === effectiveManagerId);
                            
                            return (
                              <TableRow key={member.id} className="hover:bg-muted/5 group transition-colors">
                                <TableCell className="px-6 py-4">
                                  <div className="flex flex-col text-left">
                                    <span className="font-bold text-sm text-foreground">{member.username}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase">{member.email}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1 text-left">
                                        <Badge variant="outline" className={cn(
                                            "w-fit rounded-sm text-[9px] font-black uppercase border-primary/20",
                                            member.role === 'Site Manager' ? "bg-primary text-white border-none" : "text-primary bg-primary/5"
                                        )}>
                                            {member.role === 'Site Manager' && <UserCog className="h-2.5 w-2.5 mr-1" />}
                                            {member.role}
                                        </Badge>
                                        <div className="flex flex-col pl-1">
                                            <span className="text-[10px] font-bold text-foreground">
                                                {manager?.username || (member.role === 'Site Engineer' ? 'Unassigned' : '—')}
                                            </span>
                                            {override && (
                                                <Badge variant="outline" className="w-fit text-[7px] h-3 px-1 mt-0.5 border-amber-200 text-amber-700 bg-amber-50 font-black uppercase">Site Override</Badge>
                                            )}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className="rounded-sm font-mono text-[10px] bg-primary/5 border-primary/20 text-primary">
                                    {member.assignedProjectIds?.length || 0}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          }) : !project.projectOwnerName && (
                            <TableRow>
                              <TableCell colSpan={3} className="p-20 text-center text-muted-foreground italic text-sm">No personnel currently mapped to this site.</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Card className="rounded-sm border-primary/10 shadow-sm overflow-hidden h-fit">
                    <CardHeader className="py-4 border-b bg-muted/5 text-left">
                      <CardTitle className="text-xs font-bold uppercase tracking-widest">LIFECYCLE AND SHOW ALL PROJECT DATES</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6 text-left">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Work Status</Label>
                          <div>
                            <Badge variant="outline" className={cn(
                              "text-[8px] font-black uppercase rounded-sm px-1.5 h-5",
                              project.workStatus === 'Completed' ? "bg-green-50 text-green-700 border-green-200" :
                              project.workStatus === 'Cancelled' ? "bg-red-50 text-red-700 border-red-200" :
                              project.workStatus === 'Yet to Start' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                              "bg-blue-50 text-blue-700 border-blue-200"
                            )}>
                              {project.workStatus || "In Progress"}
                            </Badge>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Project Status</Label>
                          <div>
                            <Badge variant="outline" className={cn(
                              "text-[8px] font-black uppercase h-5 px-1.5 border-none",
                              project.projectStatus === 'close' ? "bg-slate-900 text-white" : "bg-primary text-white"
                            )}>
                              {project.projectStatus || "open"}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <Separator className="opacity-10" />

                      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                        <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest px-1">PPA Date</Label>
                          <p className="text-xs font-bold font-mono">{project.ppaDate ? format(parseISO(project.ppaDate), 'dd MMM yyyy') : '—'}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest px-1">Fin. Closure</Label>
                          <p className="text-xs font-bold font-mono">{project.financialClosureDate ? format(parseISO(project.financialClosureDate), 'dd MMM yyyy') : '—'}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase text-primary tracking-widest px-1">PPA SCOD</Label>
                          <div className="space-y-1">
                            <p className="text-xs font-black font-mono text-primary">{project.ppaScodDate ? format(parseISO(project.ppaScodDate), 'dd MMM yyyy') : '—'}</p>
                            {renderDaysBadge(getDaysRemaining(project.ppaScodDate))}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase text-foreground tracking-widest px-1">Planned SCOD</Label>
                          <div className="space-y-1">
                            <p className="text-xs font-black font-mono text-foreground">{project.plannedScodDate ? format(parseISO(project.plannedScodDate), 'dd MMM yyyy') : '—'}</p>
                            {renderDaysBadge(getDaysRemaining(project.plannedScodDate))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-sm border-primary/10 shadow-sm overflow-hidden h-fit">
                    <CardHeader className="py-4 border-b bg-muted/5 text-left">
                      <CardTitle className="text-xs font-bold uppercase tracking-widest">Compliance Health</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <StatRow label="Liaisoning Progress" value={liaisonRecord?.completionPercentage || 0} unit="%" color="emerald" />
                      <StatRow label="Approved Permits" value={permits?.filter((p: any) => p.status === 'Approved').length || 0} color="green" />
                      <StatRow label="Pending Audits" value={permits?.filter((p: any) => p.status === 'Pending' || p.status === 'ManagerApproved').length || 0} color="amber" />
                      <StatRow label="Ongoing Work" value={tasks?.filter((t: any) => t.status !== 'Completed').length || 0} color="blue" />
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="liaisoning" className="mt-6 animate-in fade-in duration-300">
              {!liaisonRecord ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                  <PlugZap className="h-16 w-16 text-primary/20" />
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold uppercase tracking-tight">No Liaisoning Profile</h2>
                    <p className="text-muted-foreground text-sm max-w-xs mx-auto">Progress tracking hasn't been initialized for this site.</p>
                  </div>
                  <Button onClick={handleLiaisonInitialize} className="rounded-sm font-black h-12 px-10 shadow-lg">Initialize Tracker</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 pb-20">
                  <Card className="lg:col-span-4 rounded-sm border-primary/10 shadow-md h-fit overflow-hidden text-left">
                    <CardHeader className="bg-muted/5 border-b py-4">
                      <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
                        <LayoutGrid className="h-3.5 w-3.5 text-primary" /> Approval Milestones
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-[60vh]">
                        <div className="divide-y">
                          {MAIN_STAGES.map((s, idx) => {
                            const stageData = liaisonRecord.stages?.[s.id] || { status: 'Pending', documents: [] };
                            const isDone = stageData.status === 'Completed';
                            const isActive = activeStageId === s.id;
                            return (
                              <button 
                                key={s.id} 
                                onClick={() => setActiveStageId(s.id)}
                                className={cn("w-full flex items-start gap-4 p-4 text-left transition-all group", isActive ? "bg-primary/5 ring-1 ring-inset ring-primary/10" : "hover:bg-muted/5")}
                              >
                                <div className={cn("h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-2 mt-0.5 transition-colors", isDone ? "bg-green-50 border-green-500 text-white" : isActive ? "border-primary text-primary bg-primary/10 animate-pulse" : "border-muted text-muted-foreground")}>
                                  {isDone ? <Check className="h-3.5 w-3.5" /> : <span className="text-[10px] font-black">{idx + 1}</span>}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className={cn("text-[11px] font-bold uppercase tracking-tight block truncate", isActive ? "text-primary" : "text-foreground")}>{s.label}</span>
                                  <Badge variant="outline" className={cn("h-4 text-[7px] font-black uppercase px-1.5 border-none rounded-sm mt-1", isDone ? "bg-green-50 text-green-700" : stageData.status === 'In Progress' ? "bg-blue-50 text-blue-700" : "bg-muted text-muted-foreground/50")}>{stageData.status}</Badge>
                                </div>
                                <ChevronRight className={cn("h-4 w-4 mt-2 shrink-0 transition-all", isActive ? "text-primary opacity-100 translate-x-1" : "opacity-0")} />
                              </button>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  <div className="lg:col-span-8 space-y-6">
                    <Card className="rounded-sm border-primary/10 shadow-lg overflow-hidden h-full flex flex-col text-left">
                      <CardHeader className="bg-primary/5 border-b p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-1">
                          <CardTitle className="text-xl font-black uppercase tracking-tight text-foreground">{MAIN_STAGES.find(s => s.id === activeStageId)?.label}</CardTitle>
                          <CardDescription className="text-[10px] font-bold text-muted-foreground uppercase">Milestone Audit & compliance Records</CardDescription>
                        </div>
                        <div className="flex flex-col items-start md:items-end gap-2 w-full md:w-auto">
                          <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest px-1">Stage Status</Label>
                          <Select 
                            value={liaisonRecord.stages[activeStageId]?.status} 
                            onValueChange={(val: any) => handleUpdateLiaisonStage(activeStageId, { status: val })}
                          >
                            <SelectTrigger className="h-10 w-full md:w-[180px] rounded-sm font-black uppercase text-[10px] tracking-widest bg-background border-primary/20 shadow-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pending" className="text-[10px] font-bold uppercase">Pending</SelectItem>
                              <SelectItem value="In Progress" className="text-[10px] font-bold uppercase text-blue-600">In Progress</SelectItem>
                              <SelectItem value="Completed" className="text-[10px] font-bold uppercase text-green-600">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 md:p-8 flex-1 space-y-10">
                        <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Stage Observations & Audit Remarks</Label>
                          <Textarea 
                            placeholder="Record specific findings or blockers for this stage..."
                            className="min-h-[140px] rounded-sm text-sm italic font-medium leading-relaxed bg-muted/[0.02] shadow-inner"
                            value={liaisonRecord.stages[activeStageId]?.remarks || ""}
                            onChange={e => handleUpdateLiaisonStage(activeStageId, { remarks: e.target.value })}
                          />
                        </div>

                        <div className="space-y-6">
                          <div className="flex items-center justify-between border-b pb-2 px-1">
                             <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Upload className="h-4 w-4" /> Compliance Documentation</Label>
                             <label className="cursor-pointer">
                                <Button variant="outline" size="sm" asChild className="h-9 rounded-sm font-black text-[10px] uppercase border-primary/20 text-primary shadow-sm hover:bg-primary/5">
                                  <span><Plus className="h-4 w-4 mr-1" /> Add File</span>
                                </Button>
                                <input type="file" className="hidden" onChange={e => handleLiaisonUploadDoc(activeStageId, e)} />
                             </label>
                          </div>

                          {uploadingStageId === activeStageId && (
                            <div className="p-4 border rounded-sm bg-primary/5 space-y-2 animate-in fade-in duration-300">
                               <div className="flex justify-between items-center text-[10px] font-black uppercase text-primary">
                                  <span>Uploading Please Wait...</span>
                                  <span>{Math.round(uploadProgress)}%</span>
                               </div>
                               <Progress value={uploadProgress} className="h-1.5 rounded-none" />
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {liaisonRecord.stages[activeStageId]?.documents?.map((doc, dIdx) => (
                              <div key={dIdx} className="group p-4 border rounded-sm bg-background hover:border-primary/30 transition-all flex items-center justify-between shadow-sm">
                                 <div className="flex items-center gap-3 min-w-0">
                                    <div className="p-2 bg-muted rounded-sm text-primary group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                                       <FileText className="h-5 w-5" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                       <span className="text-xs font-black truncate max-w-[150px] uppercase tracking-tight leading-tight" title={doc.name}>{doc.name}</span>
                                       <span className="text-[8px] font-bold text-muted-foreground/60 mt-0.5">{format(new Date(doc.uploadedAt), 'dd MMM yyyy')}</span>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-primary rounded-sm hover:bg-primary/10" asChild title="Open">
                                       <a href={doc.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive rounded-sm hover:bg-red-50" onClick={() => handleLiaisonDeleteDoc(activeStageId, doc)} title="Delete">
                                       <Trash2 className="h-4 w-4" />
                                    </Button>
                                 </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="bom" className="space-y-8 mt-6 animate-in fade-in duration-300 text-left">
              {canManageBom && (
                <Card className="rounded-sm border-primary/10 bg-primary/5 shadow-sm">
                  <CardHeader className="py-2 border-b bg-muted/10">
                    <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Add BoM Entry</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-4">
                    <form onSubmit={handleAddBoM} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="md:col-span-2 space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">Material Item</Label>
                          <Popover open={isBomItemPopoverOpen} onOpenChange={setIsBomItemPopoverOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal h-9 rounded-sm bg-background border-primary/10", !selectedMasterItem && "text-muted-foreground")}>
                                  <span className="truncate">{selectedMasterItem ? selectedMasterItem.name : "Choose material..."}</span>
                                  <CheckCircle2 className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
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
                                        onClick={() => toggleSelectMasterItem(item)}
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
                        
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">Required Qty & Unit</Label>
                          <div className="flex gap-1.5">
                            <Input name="qty" type="number" required placeholder="0" className="h-9 rounded-sm bg-background border-primary/20 text-[10px] font-bold" />
                            <Input 
                              key={`unit-${selectedMasterItem?.id || 'none'}`}
                              name="unit" 
                              placeholder="Unit" 
                              readOnly
                              defaultValue={selectedMasterItem?.unit || ""} 
                              className="w-20 h-9 rounded-sm bg-muted/10 border-primary/10 font-bold text-primary cursor-not-allowed text-[10px]" 
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">Category (Auto)</Label>
                          <Input 
                            readOnly
                            key={`cat-field-${selectedMasterItem?.id || 'none'}`}
                            placeholder="Category..."
                            defaultValue={selectedMasterItem?.category || ""}
                            className="h-9 rounded-sm bg-muted/10 border-primary/10 cursor-not-allowed font-bold text-primary text-[10px]"
                          />
                        </div>
                      </div>
                      
                      <div className="flex flex-col md:flex-row gap-4 items-start">
                        <div className="flex-1 min-w-0 space-y-1.5 w-full">
                          <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">Breakdown Preview</Label>
                          <div className="h-20 p-3 rounded-sm bg-muted/10 border border-primary/5 overflow-auto shadow-inner">
                            {selectedMasterItem ? (
                              <div className="space-y-2">
                                {selectedMasterItem.unit === 'Sets' && selectedMasterItem.subItems && selectedMasterItem.subItems.length > 0 ? (
                                  <>
                                    <p className="text-[9px] font-black text-primary uppercase mb-1">Set Composition:</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-left">
                                      {selectedMasterItem.subItems.map((sub, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-[10px] font-medium border-b border-border/20 pb-0.5">
                                          <span className="truncate mr-2">{sub.name}</span>
                                          <span className="font-bold text-primary shrink-0">{sub.quantityPerSet} {sub.unit}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-[11px] italic text-muted-foreground leading-relaxed">"{selectedMasterItem.description || 'No additional specifications provided.'}"</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-[10px] text-muted-foreground/40 italic flex items-center justify-center h-full">Selection preview will appear here...</p>
                            )}
                          </div>
                        </div>
                        <Button type="submit" className="h-20 md:w-32 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-md mt-auto w-full" disabled={!selectedMasterItem}>
                          <Plus className="h-4 w-4 mr-1.5" /> Log to BoM
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search materials, make or specs..." 
                    className="pl-8 h-9 rounded-sm border-primary/20 text-xs" 
                    value={bomTableSearch} 
                    onChange={e => setBomTableSearch(e.target.value)} 
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Select value={bomStatusFilter} onValueChange={setBomStatusFilter}>
                    <SelectTrigger className="w-[140px] h-9 text-[10px] font-bold uppercase tracking-tight rounded-sm border-primary/20">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-[10px] font-bold uppercase">All Status</SelectItem>
                      <SelectItem value="Pending" className="text-[10px] font-bold uppercase text-amber-600">Pending</SelectItem>
                      <SelectItem value="Approved" className="text-[10px] font-bold uppercase text-green-600">Approved</SelectItem>
                      <SelectItem value="Rejected" className="text-[10px] font-bold uppercase text-red-600">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => { setBomTableSearch(""); setBomStatusFilter("all"); setBomCategoryFilter("all"); }} 
                    className="h-9 w-9 text-muted-foreground"
                  >
                    <FilterX className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handleBoMSort('itemName')}>
                            <div className="flex items-center">Description <BoMSortIcon column="itemName" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleBoMSort('category')}>
                            <div className="flex items-center">Category <BoMSortIcon column="category" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleBoMSort('make')}>
                            <div className="flex items-center">Make <BoMSortIcon column="make" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleBoMSort('status')}>
                            <div className="flex items-center">Status <BoMSortIcon column="status" /></div>
                          </TableHead>
                          <TableHead className="text-center cursor-pointer hover:text-primary transition-colors" onClick={() => handleBoMSort('plannedQuantity')}>
                            <div className="flex items-center justify-center">Required Qty <BoMSortIcon column="plannedQuantity" /></div>
                          </TableHead>
                          <TableHead className="text-center cursor-pointer hover:text-primary transition-colors" onClick={() => handleBoMSort('approvedQuantity')}>
                            <div className="flex items-center justify-center">Approved Qty <BoMSortIcon column="approvedQuantity" /></div>
                          </TableHead>
                          <TableHead className="text-right px-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSortedBomItems.length > 0 ? filteredSortedBomItems.map(item => (
                          <React.Fragment key={item.id}>
                            <TableRow className="hover:bg-muted/5 transition-colors group">
                              <TableCell className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  {item.unit === 'Sets' && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => toggleBomRow(item.id)}>
                                      {expandedBomRows.has(item.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </Button>
                                  )}
                                  <div className="flex flex-col min-w-0 text-left">
                                    <span className="font-bold text-sm text-foreground">{item.itemName}</span>
                                    <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{item.specification}</span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell><Badge variant="secondary" className="rounded-sm font-bold text-[9px] uppercase tracking-wider">{item.category || "Uncategorized"}</Badge></TableCell>
                              <TableCell><Badge variant="outline" className="rounded-sm font-black text-[9px] uppercase border-primary/10 text-primary/70">{item.make || "Standard"}</Badge></TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <Badge variant="outline" className={cn(
                                    "w-fit rounded-sm text-[9px] font-black uppercase px-1.5 h-5",
                                    item.status === 'Approved' ? "bg-green-50 text-green-700 border-green-200" :
                                    item.status === 'Rejected' ? "bg-red-50 text-red-700 border-red-200" :
                                    "bg-yellow-50 text-yellow-700 border-yellow-200"
                                  )}>{item.status || 'Pending'}</Badge>
                                  {item.processedByName && (item.status === 'Approved' || item.status === 'Rejected') && (
                                    <span className="text-[8px] font-bold text-muted-foreground uppercase">By: {item.processedByName}</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="font-mono font-bold text-sm text-primary">{item.plannedQuantity}</div>
                                <div className="text-[10px] text-muted-foreground uppercase font-medium">{item.unit}</div>
                              </TableCell>
                              <TableCell className="text-center">
                                {item.status === 'Approved' ? (
                                  <>
                                    <div className="font-mono font-bold text-sm text-emerald-700">{item.approvedQuantity || item.plannedQuantity}</div>
                                    <div className="text-[10px] text-emerald-600 uppercase font-medium">{item.unit}</div>
                                  </>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground/40 italic uppercase font-bold">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right px-6">
                                <div className="flex justify-end items-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground rounded-sm" onClick={() => setViewingBomLog(item)} title="View Log"><History className="h-4 w-4" /></Button>
                                  {canManageBom && (<Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm hover:bg-primary/10" onClick={() => setEditingBomItem(item)} title="Edit Item"><Pencil className="h-4 w-4" /></Button>)}
                                  {isAdmin && item.status === 'Pending' && (
                                    <><Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 rounded-sm hover:bg-green-50" onClick={() => setBomActionState({ item, type: 'Approved' })} title="Approve"><CheckCircle2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 rounded-sm hover:bg-red-50" onClick={() => setBomActionState({ item, type: 'Rejected' })} title="Reject"><XCircle className="h-4 w-4" /></Button></>
                                  )}
                                  {(isAdmin || (canManageBom && item.status === 'Pending')) && (<Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm hover:bg-red-50" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'project_boms', item.id))} title="Delete"><Trash2 className="h-4 w-4" /></Button>)}
                                </div>
                              </TableCell>
                            </TableRow>
                            {expandedBomRows.has(item.id) && item.subItems && (
                              <TableRow className="bg-primary/[0.02]">
                                <TableCell colSpan={7} className="p-0 border-b">
                                  <div className="p-4 px-12 space-y-3 animate-in slide-in-from-top-1 duration-200 text-left"><div className="flex items-center gap-2 mb-2"><Layers className="h-3.5 w-3.5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-primary">Component Breakdown for {item.itemName}</span></div><div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">{item.subItems.map((sub, sIdx) => (<div key={sIdx} className="p-3 bg-background border border-primary/5 rounded-sm flex flex-col gap-1"><span className="text-xs font-bold">{sub.name}</span><div className="flex items-center justify-between text-[10px]"><span className="text-muted-foreground uppercase font-medium">Per Set: {sub.quantityPerSet} {sub.unit}</span><span className="text-primary font-black uppercase">Total: {(sub.quantityPerSet * (item.approvedQuantity || item.plannedQuantity)).toFixed(2)} {sub.unit}</span></div></div>))}</div></div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        )) : (
                          <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic text-xs">No records found matching filters.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="po" className="mt-6 animate-in fade-in duration-300 transition-all space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
                <div className="relative w-full md:w-80"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search PO or Supplier" className="pl-8 h-9 rounded-sm border-primary/20 text-xs" value={poSearch} onChange={e => setPoSearch(e.target.value)} /></div>
                <Button asChild className="rounded-sm font-bold shadow-md h-9"><Link href={`/purchase-orders/create?siteId=${projectId}`}><Plus className="h-4 w-4 mr-2" /> Create PO</Link></Button>
              </div>
              <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handlePOSort('poNumber')}><div className="flex items-center">PO Number <POSortIcon column="poNumber" config={poSortConfig} /></div></TableHead>
                          <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handlePOSort('supplier')}><div className="flex items-center">Supplier <POSortIcon column="supplier" config={poSortConfig} /></div></TableHead>
                          <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handlePOSort('date')}><div className="flex items-center">Date <POSortIcon column="date" config={poSortConfig} /></div></TableHead>
                          <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handlePOSort('status')}><div className="flex items-center">Status <POSortIcon column="status" config={poSortConfig} /></div></TableHead>
                          <TableHead className="text-right cursor-pointer hover:text-primary transition-colors" onClick={() => handlePOSort('total')}><div className="flex items-center justify-end">Total Value <POSortIcon column="total" config={poSortConfig} /></div></TableHead>
                          <TableHead className="text-right px-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSortedPOs.length > 0 ? filteredSortedPOs.map(po => (
                          <React.Fragment key={po.id}>
                            <TableRow className="hover:bg-muted/5 transition-colors">
                              <TableCell className="px-6 py-4"><div className="flex items-center gap-2"><Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={(e) => { e.stopPropagation(); togglePORow(po.id); }}>{expandedPORows.has(po.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button><span className="font-mono text-xs font-black text-primary uppercase">{po.poNumber}</span></div></TableCell>
                              <TableCell className="text-sm font-semibold text-foreground text-left">{po.supplierName}</TableCell>
                              <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">{po.orderDate}</TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <Badge variant="outline" className={cn(
                                    "text-[8px] font-black uppercase rounded-sm px-1.5 h-5",
                                    po.status === 'Accepted' ? "bg-green-50 text-green-700 border-green-200" :
                                    po.status === 'Rejected' ? "bg-red-50 text-red-700 border-red-200" :
                                    po.status === 'Pending' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                                    "bg-muted text-muted-foreground"
                                  )}>{po.status || 'Pending'}</Badge>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-black text-sm font-mono text-foreground">₹{po.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-right px-6"><div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => setViewingPO(po)}><Eye className="h-4 w-4" /></Button>
                                {isAdmin && po.status === 'Pending' && (
                                  <div className="flex gap-1 ml-2">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 rounded-sm hover:bg-green-50" onClick={() => setPoActionState({ po, type: 'Accepted' })} title="Accept PO">
                                      <CircleCheck className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 rounded-sm hover:bg-red-50" onClick={() => setPoActionState({ po, type: 'Rejected' })} title="Reject PO">
                                      <CircleX className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                                {(isAdmin || isManager) && (<><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 rounded-sm" asChild><Link href={`/projects/${projectId}/procurement/${po.id}/edit`}><Pencil className="h-4 w-4" /></Link></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => setPoToDelete(po)}><Trash2 className="h-4 w-4" /></Button></>)}
                              </div></TableCell>
                            </TableRow>
                            {expandedPORows.has(po.id) && po.items && (<TableRow className="bg-muted/30"><TableCell colSpan={7} className="p-0"><div className="p-4 px-12 space-y-3 animate-in slide-in-from-top-1 duration-200 text-left"><div className="flex items-center gap-2 mb-2"><Layers className="h-3.5 w-3.5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-primary">Breakdown for {po.poNumber}</span></div><div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">{po.items.map((item, iIdx) => (<div key={iIdx} className="p-3 bg-background border border-primary/10 rounded-sm space-y-2 shadow-sm"><div className="flex justify-between items-start"><span className="text-xs font-black text-foreground">{item.itemName}</span><Badge variant="outline" className="h-4 px-1 text-[8px] font-black uppercase">Tax {item.gstPercent}%</Badge></div><div className="grid grid-cols-2 gap-2 border-t pt-2"><div className="flex flex-col"><span className="text-muted-foreground uppercase font-bold text-[8px]">Qty x Rate</span><span className="font-mono font-bold text-[10px]">{item.quantity} x ₹{item.rate.toLocaleString('en-IN')}</span></div><div className="flex flex-col text-right"><span className="text-muted-foreground uppercase font-bold text-[8px]">Subtotal</span><span className="text-primary font-black text-[10px]">₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div></div></div>))}</div></div></TableCell></TableRow>)}
                          </React.Fragment>
                        )) : (
                          <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic text-xs">No POs found.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="wo" className="mt-6 animate-in fade-in duration-300 transition-all space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
                <div className="relative w-full md:w-80"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search WO or Contractor" className="pl-8 h-9 rounded-sm border-primary/20 text-xs" value={woSearch} onChange={e => setWoSearch(e.target.value)} /></div>
                <Button asChild className="rounded-sm font-bold shadow-md h-9"><Link href={`/projects/${projectId}/work-orders/create`}><Plus className="h-4 w-4 mr-2" /> Create WO</Link></Button>
              </div>
              <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handleWOSort('woNumber')}><div className="flex items-center">WO Number <WOSortIcon column="woNumber" /></div></TableHead>
                          <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleWOSort('contractor')}><div className="flex items-center">Contractor <WOSortIcon column="contractor" /></div></TableHead>
                          <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleWOSort('date')}><div className="flex items-center">Date <WOSortIcon column="date" /></div></TableHead>
                          <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleWOSort('status')}><div className="flex items-center">Status <WOSortIcon column="status" /></div></TableHead>
                          <TableHead className="text-right cursor-pointer hover:text-primary transition-colors" onClick={() => handleWOSort('total')}><div className="flex items-center justify-end">Contract Value <WOSortIcon column="total" /></div></TableHead>
                          <TableHead className="text-right px-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSortedWOs.length > 0 ? filteredSortedWOs.map(wo => (
                          <React.Fragment key={wo.id}>
                            <TableRow className="hover:bg-muted/5 transition-colors">
                              <TableCell className="px-6 py-4"><div className="flex items-center gap-2"><Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => toggleWORow(wo.id)}>{expandedWORows.has(wo.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button><span className="font-mono text-xs font-black text-primary uppercase">{wo.woNumber}</span></div></TableCell>
                              <TableCell className="text-sm font-semibold text-foreground text-left">{wo.contractorName}</TableCell>
                              <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">{wo.orderDate}</TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <Badge variant="outline" className={cn(
                                    "text-[8px] font-black uppercase rounded-sm px-1.5 h-5",
                                    wo.status === 'Accepted' ? "bg-green-50 text-green-700 border-green-200" :
                                    wo.status === 'Rejected' ? "bg-red-50 text-red-700 border-red-200" :
                                    wo.status === 'Pending' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                                    "bg-muted text-muted-foreground"
                                  )}>{wo.status || 'Pending'}</Badge>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-black text-sm font-mono text-foreground">₹{wo.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-right px-6"><div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => setViewingWO(wo)}><Eye className="h-4 w-4" /></Button>
                                {isAdmin && wo.status === 'Pending' && (
                                  <div className="flex gap-1 ml-2">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 rounded-sm hover:bg-green-50" onClick={() => setWoActionState({ wo, type: 'Accepted' })} title="Accept WO">
                                      <CircleCheck className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 rounded-sm hover:bg-red-50" onClick={() => setWoActionState({ wo, type: 'Rejected' })} title="Reject WO">
                                      <CircleX className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                                {(isAdmin || isManager) && (<><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 rounded-sm" asChild><Link href={`/projects/${projectId}/work-orders/${wo.id}/edit`}><Pencil className="h-4 w-4" /></Link></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => setWoToDelete(wo)}><Trash2 className="h-4 w-4" /></Button></>)}
                              </div></TableCell>
                            </TableRow>
                            {expandedWORows.has(wo.id) && wo.items && wo.items.length > 0 && (<TableRow className="bg-muted/30"><TableCell colSpan={7} className="p-0"><div className="p-4 px-12 space-y-3 animate-in slide-in-from-top-1 duration-200 text-left"><div className="flex items-center gap-2 mb-2"><Layers className="h-3.5 w-3.5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-primary">Service Breakdown for {wo.woNumber}</span></div><div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">{wo.items.map((item, iIdx) => (<div key={iIdx} className="p-3 bg-background border border-primary/10 rounded-sm space-y-2 shadow-sm"><div className="flex justify-between items-start"><span className="text-xs font-black text-foreground">{item.description}</span><Badge variant="outline" className="h-4 px-1 text-[8px] font-black uppercase">Tax {item.gstPercent}%</Badge></div><div className="grid grid-cols-2 gap-2 border-t pt-2"><div className="flex flex-col"><span className="text-muted-foreground uppercase font-bold text-[8px]">Qty x Rate</span><span className="font-mono font-bold text-[10px]">{item.quantity} x ₹{item.rate.toLocaleString('en-IN')}</span></div><div className="flex flex-col text-right"><span className="text-muted-foreground uppercase font-bold text-[8px]">Amount</span><span className="text-primary font-black text-[10px]">₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div></div></div>))}</div></div></TableCell></TableRow>)}
                          </React.Fragment>
                        )) : (
                          <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic text-xs">No work orders found.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payments" className="mt-6 animate-in fade-in duration-300 transition-all space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search payments..." 
                    className="pl-8 h-9 rounded-sm border-primary/20 text-xs" 
                    value={paymentSearch} 
                    onChange={e => setPaymentSearch(e.target.value)} 
                  />
                </div>
                <Button asChild className="rounded-sm font-bold shadow-md h-9">
                  <Link href={`/payments/record`}><Plus className="h-4 w-4 mr-2" /> Record New Payment</Link>
                </Button>
              </div>
              <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handlePaymentSort('date')}>
                            <div className="flex items-center">Date & Time <PaymentSortIcon column="date" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handlePaymentSort('payee')}>
                            <div className="flex items-center">Paid to <PaymentSortIcon column="payee" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handlePaymentSort('reference')}>
                            <div className="flex items-center">Reference <PaymentSortIcon column="reference" /></div>
                          </TableHead>
                          <TableHead className="text-right cursor-pointer hover:text-primary transition-colors" onClick={() => handlePaymentSort('amount')}>
                            <div className="flex items-center justify-end">Amount <PaymentSortIcon column="amount" /></div>
                          </TableHead>
                          <TableHead>Mode</TableHead>
                          <TableHead className="text-right px-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSortedPayments.length > 0 ? filteredSortedPayments.map(p => (
                          <TableRow key={p.id} className="hover:bg-muted/5 transition-colors">
                            <TableCell className="px-6 py-4 font-mono text-[10px] font-bold text-muted-foreground uppercase">
                              {p.date ? format(p.date.toDate(), 'dd MMM yy HH:mm') : '—'}
                            </TableCell>
                            <TableCell className="text-sm font-bold text-foreground text-left">{p.payeeName}</TableCell>
                            <TableCell>
                              <div className="flex flex-col text-left">
                                <span className="font-mono text-xs font-black text-primary uppercase">{p.referenceNumber}</span>
                                <span className="text-[8px] font-bold text-muted-foreground uppercase">{p.paymentAgainst}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-black text-sm font-mono text-foreground">
                              ₹{p.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-[9px] font-bold uppercase py-0 px-1.5 h-4">{p.paymentMode}</Badge>
                            </TableCell>
                            <TableCell className="text-right px-6">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => setViewingPayment(p)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )) : (
                          <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic text-xs">No payment records found.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="inventory" className="space-y-8 mt-6 animate-in fade-in duration-300">
              <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden text-left">
                <CardHeader className="bg-muted/5 border-b py-4">
                  <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2"><Warehouse className="h-4 w-4 text-primary" /> On-Site Inventory Registry</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="px-6 min-w-[250px]">Material / Component</TableHead>
                          <TableHead>Make</TableHead>
                          <TableHead className="text-center">Total Received Stock</TableHead>
                          <TableHead className="text-center">Utilised Stock</TableHead>
                          <TableHead className="text-center">Available Stock</TableHead>
                          <TableHead className="text-right px-6">Logs</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inventory && inventory.length > 0 ? inventory.map(invRecord => {
                          const bomItem = bomItems?.find(i => i.itemName === invRecord.itemName && i.status === 'Approved');
                          const itemMovements = movements?.filter((m: any) => m.itemName === invRecord.itemName) || [];
                          const itemUtilisations = utilisations?.filter((u: any) => u.itemName === invRecord.itemName) || [];
                          const utilised = invRecord.utilisedQuantity || 0;
                          const available = invRecord.stockLevel;
                          const total = utilised + available;

                          return (
                            <React.Fragment key={invRecord.id}>
                              <TableRow className="hover:bg-muted/5 transition-colors group">
                                <TableCell className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => toggleInvRow(invRecord.id)}>
                                      {expandedInvRows.has(invRecord.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </Button>
                                    <div className="flex flex-col gap-0.5">
                                      <span className="font-bold text-sm text-foreground">{invRecord.itemName}</span>
                                      <span className="text-[10px] text-muted-foreground line-clamp-1">{bomItem?.specification || 'Site Allocated Asset'}</span>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className="rounded-sm text-[9px] font-black uppercase bg-primary/5 text-primary border-primary/10">
                                    {bomItem?.make || 'Standard'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className="font-mono font-bold rounded-sm px-3 h-7 bg-primary/5 text-primary border-primary/10">
                                    {total} {invRecord.unit}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="secondary" className="font-mono font-bold rounded-sm px-3 h-7 bg-amber-100 text-amber-800 border-amber-200">
                                    {utilised} {invRecord.unit}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge className={cn(
                                    "font-mono font-bold rounded-sm px-3 h-7 border-none shadow-sm",
                                    available > 0 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
                                  )}>
                                    {available} {invRecord.unit}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right px-6">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => toggleInvRow(invRecord.id)}>
                                    {expandedInvRows.has(invRecord.id) ? <ChevronUp className="h-4 w-4" /> : <History className="h-4 w-4" />}
                                  </Button>
                                </TableCell>
                              </TableRow>
                              {expandedInvRows.has(invRecord.id) && (
                                <TableRow className="bg-primary/[0.01]">
                                  <TableCell colSpan={6} className="p-0 border-b">
                                    <div className="p-6 px-12 animate-in slide-in-from-top-1 duration-200 space-y-8 text-left">
                                      <div className="space-y-4">
                                        <div className="flex items-center gap-2 mb-2">
                                          <History className="h-3.5 w-3.5 text-primary" />
                                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Movement History</span>
                                        </div>
                                        {itemMovements.length > 0 ? (
                                          <div className="grid gap-2">
                                            {itemMovements.sort((a: any, b: any) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0)).map((m: any) => (
                                              <div key={m.id} className="flex items-center justify-between p-3 bg-background border rounded-sm text-[11px] shadow-sm">
                                                <div className="flex items-center gap-4">
                                                  <Badge variant="outline" className={cn("text-[8px] font-black h-5 px-1.5 uppercase", m.movementType === 'Inward' ? "bg-green-50 text-green-700 border-green-200" : "bg-blue-50 text-blue-700 border-blue-200")}>
                                                    {m.movementType === 'Inward' ? <ArrowDownCircle className="h-2.5 w-2.5 mr-1" /> : <ArrowUpCircle className="h-2.5 w-2.5 mr-1" />}
                                                    {m.movementType}
                                                  </Badge>
                                                  <div className="flex flex-col">
                                                    <span className="font-bold text-foreground">Qty: {m.quantity} {m.unit}</span>
                                                    <span className="text-[9px] text-muted-foreground uppercase">{m.movementType === 'Inward' ? 'From' : 'To'}: {m.sourceOrDestination}</span>
                                                  </div>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                  <span className="font-bold text-muted-foreground uppercase text-[9px]">{m.userName}</span>
                                                  <span className="text-[9px] text-muted-foreground/60">{m.movementDate}</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-[10px] text-center text-muted-foreground italic uppercase">No material movements logged.</p>
                                        )}
                                      </div>

                                      <div className="space-y-4">
                                        <div className="flex items-center gap-2 mb-2">
                                          <History className="h-3.5 w-3.5 text-amber-600" />
                                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">Utilisation History</span>
                                        </div>
                                        {itemUtilisations.length > 0 ? (
                                          <div className="grid gap-2">
                                            {itemUtilisations.sort((a: any, b: any) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0)).map((u: any) => (
                                              <div key={u.id} className="flex items-center justify-between p-3 bg-background border rounded-sm text-[11px] shadow-sm">
                                                <div className="flex items-center gap-4">
                                                  <Badge variant="outline" className="text-[8px] font-black h-5 px-1.5 uppercase bg-amber-50 text-amber-700 border-amber-200">
                                                    <PieChart className="h-2.5 w-2.5 mr-1" />
                                                    Utilised
                                                  </Badge>
                                                  <div className="flex flex-col">
                                                    <span className="font-bold text-foreground">Qty: {u.quantity} {u.unit}</span>
                                                    <span className="text-[9px] text-muted-foreground italic leading-tight">"{u.remarks}"</span>
                                                  </div>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                  <span className="font-bold text-muted-foreground uppercase text-[9px]">{u.userName}</span>
                                                  <span className="text-[9px] text-muted-foreground/60">{u.utilisationDate}</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-[10px] text-center text-muted-foreground italic uppercase">No material consumption logged.</p>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          );
                        }) : (
                          <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic">No site stock recorded.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="utilisation" className="mt-6 animate-in fade-in duration-300">
              <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden text-left">
                <CardHeader className="bg-muted/5 border-b py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PieChart className="h-4 w-4 text-primary" />
                      <CardTitle className="text-sm font-bold uppercase tracking-widest">Material Utilisation Logs</CardTitle>
                    </div>
                    <Button size="sm" className="h-8 rounded-sm font-black text-[10px] uppercase" asChild><Link href="/inventory/utilisation/record"><Plus className="h-3.5 w-3.5 mr-1.5" /> Record Utilisation</Link></Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {filteredUtilisations && filteredUtilisations.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow>
                            <TableHead className="px-6">Date</TableHead>
                            <TableHead>Material / Component</TableHead>
                            <TableHead className="text-center">Quantity Consumed</TableHead>
                            <TableHead>Personnel</TableHead>
                            <TableHead className="text-right px-6">Audit Remarks</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredUtilisations.map((u: any) => (
                            <TableRow key={u.id} className="hover:bg-muted/5 transition-colors">
                              <TableCell className="px-6 py-4 font-mono text-xs font-bold text-muted-foreground uppercase whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="h-3 w-3" />
                                  {u.utilisationDate}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col text-left">
                                  <span className="font-bold text-sm text-foreground">{u.itemName}</span>
                                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Inventory Consumption</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary" className="font-mono font-bold rounded-sm px-2 bg-amber-50 text-amber-700 border-amber-200">
                                  {u.quantity} {u.unit}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase text-left">
                                  <User className="h-3 w-3 text-primary" />
                                  {u.userName}
                                </div>
                              </TableCell>
                              <TableCell className="text-right px-6 text-[10px] font-medium text-muted-foreground italic max-w-[250px] truncate" title={u.remarks}>
                                "{u.remarks}"
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="p-20 text-center text-muted-foreground italic flex flex-col items-center gap-2 opacity-40">
                      <PieChart className="h-10 w-10" />
                      <p className="text-sm font-bold uppercase tracking-widest">No consumption records discovered</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="movements" className="mt-6 animate-in fade-in duration-300">
              <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md text-left">
                <CardHeader className="bg-muted/5 border-b py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowLeftRight className="h-4 w-4 text-primary" />
                      <CardTitle className="text-sm font-bold uppercase tracking-widest">Material Movement Logs</CardTitle>
                    </div>
                    <Button size="sm" className="h-8 rounded-sm font-black text-[10px] uppercase" asChild><Link href="/inventory/record"><Plus className="h-3.5 w-3.5 mr-1.5" /> Record Movement</Link></Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {movements && movements.length > 0 ? (
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="px-6">Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-center">Quantity</TableHead>
                          <TableHead className="text-right px-6">Source/Dest</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movements.sort((a: any, b: any) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0)).map((mov: any) => (
                          <TableRow key={mov.id} className="hover:bg-muted/5">
                            <TableCell className="px-6 py-4 font-mono text-xs font-bold whitespace-nowrap uppercase">{mov.movementDate}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("text-[9px] font-black uppercase rounded-sm h-5 px-1.5", mov.movementType === 'Inward' ? "bg-green-50 text-green-700 border-green-200" : "bg-blue-50 text-blue-700 border-blue-200")}>
                                {mov.movementType}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm font-semibold text-left">{mov.itemName}</TableCell>
                            <TableCell className="text-center text-xs font-bold text-primary">{mov.quantity} {mov.unit}</TableCell>
                            <TableCell className="text-right px-6 text-[10px] font-bold text-muted-foreground uppercase">{mov.sourceOrDestination}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-20 text-center text-muted-foreground italic">No movements recorded.</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ptw" className="mt-6 animate-in fade-in duration-300 transition-all">
              <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md text-left">
                <CardContent className="p-0">
                  {permits && permits.length > 0 ? (
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="px-6">Serial No</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Engineer</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right px-6">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {permits.sort((a: any, b: any) => (b.requestDate?.toDate?.() || 0) - (a.requestDate?.toDate?.() || 0)).map((permit: any) => (
                          <TableRow key={permit.id} className="hover:bg-muted/5">
                            <TableCell className="px-6 py-4 font-mono text-xs font-bold text-primary uppercase">{permit.serialNumber || permit.id.slice(0, 8)}</TableCell>
                            <TableCell className="text-sm font-semibold text-left">{permit.ptwType}</TableCell>
                            <TableCell className="text-xs font-medium text-left">{permit.siteEngineerName || '—'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("text-[9px] font-black uppercase rounded-sm h-5 px-1.5", permit.status === 'Approved' ? "bg-green-50 text-green-700 border-green-200" : permit.status === 'Rejected' ? "bg-red-50 text-red-700 border-red-200" : permit.status === 'Pending' ? "bg-yellow-50 text-yellow-700 border-yellow-200" : permit.status === 'ManagerApproved' ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-muted text-muted-foreground")}>{permit.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right px-6"><Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary rounded-sm"><Link href={`/ptw/list?view=${permit.id}`}><Eye className="h-4 w-4" /></Link></Button></TableCell>
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

            <TabsContent value="dpr" className="mt-6 animate-in fade-in duration-300 transition-all">
              <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md text-left">
                <CardContent className="p-0">
                  {dprs && dprs.length > 0 ? (
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="px-6">Date</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead className="min-w-[400px]">Activity & Update</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dprs.sort((a: any, b: any) => new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime()).map((dpr: any) => (
                          <TableRow key={dpr.id} className="hover:bg-muted/5"><TableCell className="px-6 py-4 font-mono text-xs font-bold uppercase">{dpr.reportDate}</TableCell><TableCell className="text-xs font-semibold">{dpr.userName}</TableCell><TableCell className="py-4"><div className="text-sm italic text-muted-foreground">"{dpr.description}"</div></TableCell></TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-20 text-center text-muted-foreground italic">No reports found.</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tasks" className="mt-6 animate-in fade-in duration-300 transition-all">
              <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md text-left">
                <CardContent className="p-0">
                  {tasks && tasks.length > 0 ? (
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="px-6">Title</TableHead>
                          <TableHead>Assigned To</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right px-6">Due</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tasks.map((task: any) => (
                          <TableRow key={task.id} className="hover:bg-muted/5">
                            <TableCell className="px-6 py-4 font-bold text-sm text-left">{task.title}</TableCell>
                            <TableCell className="text-xs font-medium text-left">{task.assignedToName}</TableCell>
                            <TableCell><Badge variant="secondary" className="text-[9px] font-black uppercase rounded-sm">{task.status}</Badge></TableCell>
                            <TableCell className="text-right px-6 text-[10px] font-mono font-black text-muted-foreground uppercase">{task.dueDate}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-20 text-center text-muted-foreground italic">No tasks.</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="visits" className="mt-6 animate-in fade-in duration-300 transition-all">
              <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md text-left">
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
                            <TableCell className="px-6 py-4 font-mono text-[10px] font-bold text-muted-foreground uppercase">{formatTimestamp(visit.startTime)}</TableCell>
                            <TableCell className="text-sm font-bold text-foreground text-left">{visit.managerName}</TableCell>
                            <TableCell><Badge variant="secondary" className="text-[9px] font-black uppercase rounded-sm">{visit.purpose || '—'}</Badge></TableCell>
                            <TableCell className="text-right px-6"><Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary rounded-sm"><Link href={`/site-visits/${visit.id}`}><ChevronRight className="h-4 w-4" /></Link></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-20 text-center text-muted-foreground italic">No audits.</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Global Dialogs and Modals */}
        <Dialog open={!!bomActionState} onOpenChange={(o) => !o && setBomActionState(null)}>
          <DialogContent className="rounded-sm max-md">
            <DialogHeader>
              <DialogTitle>Authorize BoM Item</DialogTitle>
              <DialogDescription>Set status for {bomActionState?.item.itemName}.</DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-4">
              <div className="space-y-2 text-left">
                <Label className="text-xs font-bold">Planned Qty: {bomActionState?.item.plannedQuantity} {bomActionState?.item.unit}</Label>
                {bomActionState?.type === 'Approved' && (
                  <div className="space-y-2 pt-2">
                    <Label>Final Approved Quantity</Label>
                    <Input type="number" defaultValue={bomActionState.item.plannedQuantity} id="approved-qty" />
                  </div>
                )}
                <Label className="text-xs font-bold pt-2 block">Remarks</Label>
                <Textarea id="action-remarks" placeholder="Provide reason..." className="min-h-[120px] rounded-sm" />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button 
                className={cn("min-w-[120px]", bomActionState?.type === 'Approved' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700")}
                disabled={isActionProcessing}
                onClick={() => {
                  const remarks = (document.getElementById('action-remarks') as HTMLTextAreaElement)?.value || "";
                  const approvedQty = bomActionState?.type === 'Approved' ? parseFloat((document.getElementById('approved-qty') as HTMLInputElement)?.value || "0") : undefined;
                  handleProcessBoM(remarks, approvedQty);
                }}
              >
                {isActionProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : `Confirm ${bomActionState?.type}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!poActionState} onOpenChange={(o) => !o && setPoActionState(null)}>
          <DialogContent className="rounded-sm max-md">
            <DialogHeader>
              <DialogTitle>Authorize Purchase Order</DialogTitle>
              <DialogDescription>Decide approval for {poActionState?.po.poNumber}.</DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-4">
              <div className="space-y-2 text-left">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Decision Remarks</Label>
                <Textarea id="po-action-remarks-global" placeholder="Provide reason for decision..." className="min-h-[120px] rounded-sm" />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button 
                className={cn("min-w-[120px]", poActionState?.type === 'Accepted' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700")}
                disabled={isActionProcessing}
                onClick={() => {
                  const remarks = (document.getElementById('po-action-remarks-global') as HTMLTextAreaElement)?.value || "";
                  handleProcessPO(remarks);
                }}
              >
                {isActionProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : `Confirm ${poActionState?.type}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!woActionState} onOpenChange={(o) => !o && setWoActionState(null)}>
          <DialogContent className="rounded-sm max-md">
            <DialogHeader>
              <DialogTitle>Authorize Work Order</DialogTitle>
              <DialogDescription>Decide approval for {woActionState?.wo.woNumber}.</DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-4">
              <div className="space-y-2 text-left">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Decision Remarks</Label>
                <Textarea id="wo-action-remarks-global" placeholder="Provide reason for decision..." className="min-h-[120px] rounded-sm" />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" className="rounded-sm font-bold uppercase text-[10px]">Cancel</Button></DialogClose>
              <Button 
                className={cn("min-w-[120px]", woActionState?.type === 'Accepted' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700")}
                disabled={isActionProcessing}
                onClick={() => {
                  const remarks = (document.getElementById('wo-action-remarks-global') as HTMLTextAreaElement)?.value || "";
                  handleProcessWO(remarks);
                }}
              >
                {isActionProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : `Confirm ${woActionState?.type}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editingBomItem} onOpenChange={(o) => !o && setEditingBomItem(null)}>
          <DialogContent className="rounded-sm max-lg w-full text-left">
            <DialogHeader><DialogTitle>Edit BoM Entry</DialogTitle></DialogHeader>
            {editingBomItem && (
              <form onSubmit={handleUpdateBoM} className="space-y-4 py-4 text-left">
                <div className="grid gap-2 text-left"><Label>Item Name</Label><Input name="itemName" defaultValue={editingBomItem.itemName} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2 text-left"><Label>Planned Qty</Label><Input name="plannedQty" type="number" defaultValue={editingBomItem.plannedQuantity} /></div>
                  <div className="grid gap-2 text-left"><Label>Unit</Label><Select name="unit" defaultValue={editingBomItem.unit}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="grid gap-2 text-left"><Label>Specification</Label><Textarea name="specification" defaultValue={editingBomItem.specification} /></div>
                <DialogFooter className="pt-4">
                  <DialogClose asChild><Button variant="outline" className="rounded-sm">Cancel</Button></DialogClose>
                  <Button type="submit" className="rounded-sm font-bold" disabled={isUpdatingBom}>{isUpdatingBom ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : 'Update'}</Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewingBomLog} onOpenChange={(o) => !o && setViewingBomLog(null)}>
          <DialogContent className="rounded-sm max-w-lg">
            <DialogHeader className="text-left"><DialogTitle>BoM Life-cycle Log</DialogTitle></DialogHeader>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-6 relative border-l-2 border-muted ml-3 pl-6 py-2">
                {viewingBomLog?.auditLog?.map((entry, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                    <div className="flex flex-col gap-1 text-left">
                      <span className="text-xs font-bold text-primary uppercase">{entry.action} — {entry.userName}</span>
                      <p className="text-[10px] text-muted-foreground font-mono">{formatTimestamp(entry.timestamp)}</p>
                      <p className="text-xs italic leading-relaxed text-foreground/80 mt-1">"{entry.details}"</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewingPO} onOpenChange={(o) => !o && handleClosePOWO()}>
          <DialogContent className="max-w-3xl p-0 overflow-hidden border-none shadow-2xl bg-background flex flex-col h-[90vh]">
            <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 text-left">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-sm"><ShoppingBag className="h-5 w-5 text-primary" /></div>
                <div><DialogTitle className="text-xl font-black uppercase tracking-tight">PO Detail Audit</DialogTitle><DialogDescription className="text-xs font-bold text-muted-foreground">{viewingPO?.poNumber}</DialogDescription></div>
              </div>
            </DialogHeader>
            <ScrollArea className="flex-1">
              {viewingPO && (
                <div className="p-8 space-y-10 text-left">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-muted-foreground">Supplier</Label><p className="text-sm font-bold">{viewingPO.supplierName}</p></div>
                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-muted-foreground">Date</Label><p className="text-sm font-bold">{viewingPO.orderDate}</p></div>
                  </div>
                  <Separator />
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Material Breakdown</Label>
                    <div className="border rounded-sm overflow-hidden"><Table><TableHeader className="bg-muted/30"><TableRow><TableHead className="text-[10px] font-black uppercase">Item</TableHead><TableHead className="text-[10px] font-black uppercase text-center">Qty</TableHead><TableHead className="text-[10px] font-black uppercase text-center">Rate</TableHead><TableHead className="text-right text-[10px] font-black uppercase">Total</TableHead></TableRow></TableHeader><TableBody>{viewingPO.items.map((item, idx) => (<TableRow key={idx}><TableCell className="text-xs font-bold">{item.itemName}</TableCell><TableCell className="text-xs font-mono text-center">{item.quantity}</TableCell><TableCell className="text-xs font-mono text-center">₹{item.rate.toLocaleString()}</TableCell><TableCell className="text-right font-mono font-black text-xs text-primary">₹{item.amount.toLocaleString()}</TableCell></TableRow>))}</TableBody></Table></div>
                  </div>
                  <div className="bg-primary/5 p-6 rounded-sm border-2 border-primary/10 flex flex-col items-center gap-2"><span className="text-[10px] font-black uppercase text-primary tracking-widest">Aggregate PO Value</span><span className="text-4xl font-black text-primary">₹{viewingPO.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                </div>
              )}
            </ScrollArea>
            <DialogFooter className="p-4 bg-muted/5 border-t"><DialogClose asChild><Button variant="outline" className="rounded-sm font-black uppercase text-[10px] h-10 px-8">Close Audit</Button></DialogClose></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewingWO} onOpenChange={(o) => !o && handleClosePOWO()}>
          <DialogContent className="max-w-3xl p-0 overflow-hidden border-none shadow-2xl bg-background flex flex-col h-[90vh]">
            <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 text-left">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-sm"><Gavel className="h-5 w-5 text-primary" /></div>
                <div><DialogTitle className="text-xl font-black uppercase tracking-tight">WO Detail Audit</DialogTitle><DialogDescription className="text-xs font-bold text-muted-foreground">{viewingWO?.woNumber}</DialogDescription></div>
              </div>
            </DialogHeader>
            <ScrollArea className="flex-1 p-8 space-y-10 text-left">
              {viewingWO && (
                <>
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-muted-foreground">Contractor</Label><p className="text-sm font-bold">{viewingWO.contractorName}</p></div>
                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-muted-foreground">Date</Label><p className="text-sm font-bold">{viewingWO.orderDate}</p></div>
                  </div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">Scope of Work</Label><div className="p-4 bg-muted/20 border rounded-sm text-sm italic">"{viewingWO.description}"</div></div>
                  {viewingWO.items && viewingWO.items.length > 0 && (
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Service Breakdown</Label>
                      <div className="border rounded-sm overflow-hidden"><Table><TableHeader className="bg-muted/30"><TableRow><TableHead className="text-[10px] font-black uppercase">Service</TableHead><TableHead className="text-[10px] font-black uppercase text-center">Qty</TableHead><TableHead className="text-[10px] font-black uppercase text-center">Rate</TableHead><TableHead className="text-right text-[10px] font-black uppercase">Total</TableHead></TableRow></TableHeader><TableBody>{viewingWO.items.map((item, idx) => (<TableRow key={idx}><TableCell className="text-xs font-bold">{item.description}</TableCell><TableCell className="text-xs font-mono text-center">{item.quantity}</TableCell><TableCell className="text-xs font-mono text-center">₹{item.rate.toLocaleString()}</TableCell><TableCell className="text-right font-mono font-black text-xs text-primary">₹{item.amount.toLocaleString()}</TableCell></TableRow>))}</TableBody></Table></div>
                    </div>
                  )}
                  <div className="bg-primary/5 p-6 rounded-sm border-2 border-primary/10 flex flex-col items-center gap-2"><span className="text-[10px] font-black uppercase text-primary tracking-widest">Total Contract Value</span><span className="text-4xl font-black text-primary">₹{viewingWO.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                </>
              )}
            </ScrollArea>
            <DialogFooter className="p-4 bg-muted/5 border-t"><DialogClose asChild><Button variant="outline" className="rounded-sm font-black uppercase text-[10px] h-10 px-8">Close Audit</Button></DialogClose></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewingPayment} onOpenChange={(o) => !o && setViewingPayment(null)}>
          <DialogContent className="max-w-3xl p-0 overflow-hidden border-none shadow-2xl bg-background flex flex-col h-fit">
            <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 flex flex-row items-center justify-between space-y-0 text-left">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-sm"><IndianRupee className="h-5 w-5 text-primary" /></div>
                <div><DialogTitle className="text-xl font-black uppercase tracking-tight">Payment Audit Log</DialogTitle><DialogDescription className="text-[10px] font-bold text-muted-foreground">Ref: {viewingPayment?.referenceNumber}</DialogDescription></div>
              </div>
            </DialogHeader>
            <ScrollArea className="max-h-[75vh]">
              {viewingPayment && (
                <div className="p-8 space-y-10 text-left">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-muted-foreground">Paid to</Label><p className="text-lg font-black text-foreground">{viewingPayment.payeeName}</p></div>
                      <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-muted-foreground">Details</Label><p className="text-sm font-medium">{viewingPayment.paymentDetails}</p></div>
                    </div>
                    <div className="bg-primary/5 rounded-sm border-2 border-primary/10 p-6 flex flex-col justify-center items-center text-center shadow-inner">
                      <span className="text-[10px] font-black uppercase text-primary tracking-widest mb-2">Transaction Value</span>
                      <span className="text-4xl font-black tabular-nums text-primary">₹{viewingPayment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  {viewingPayment.proofUrl && (<div className="pt-4 border-t"><Button variant="outline" className="rounded-sm font-bold" asChild><a href={viewingPayment.proofUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> View Proof</a></Button></div>)}
                </div>
              )}
            </ScrollArea>
            <DialogFooter className="p-4 bg-muted/5 border-t"><DialogClose asChild><Button variant="outline" className="rounded-sm font-black uppercase text-[10px] h-10 px-8 tracking-widest">Close Audit</Button></DialogClose></DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!poToDelete} onOpenChange={(o) => !o && setPoToDelete(null)}>
          <AlertDialogContent className="rounded-sm">
            <AlertDialogHeader className="text-left"><AlertDialogTitle>Delete PO?</AlertDialogTitle><AlertDialogDescription>This will remove purchase order <strong>{poToDelete?.poNumber}</strong> from site records.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeletePO} className="bg-destructive text-destructive-foreground">Confirm Delete</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!woToDelete} onOpenChange={(o) => !o && setWoToDelete(null)}>
          <AlertDialogContent className="rounded-sm">
            <AlertDialogHeader className="text-left"><AlertDialogTitle>Delete WO?</AlertDialogTitle><AlertDialogDescription>This will remove work order <strong>{woToDelete?.woNumber}</strong> from site records.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteWO} className="bg-destructive text-destructive-foreground">Confirm Delete</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}

function SummaryCard({ title, value, icon: Icon, color, description, isLoading }: { title: string, value: number | string, icon: any, color: string, description?: string, isLoading?: boolean }) {
  const colors = {
    green: "text-green-600 bg-green-50 border-green-100",
    amber: "text-amber-600 bg-amber-50 border-amber-100",
    blue: "text-blue-600 bg-blue-50 border-blue-100",
    primary: "text-primary bg-primary/5 border-primary/10",
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100"
  };
  return (
    <Card className={cn("rounded-sm border shadow-sm", (colors as any)[color])}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4">
        <CardTitle className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
        <Icon className="h-3.5 sm:h-4 sm:w-4" />
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0 text-left">
        {isLoading ? <Skeleton className="h-8 w-12 bg-muted" /> : <div className="text-xl sm:text-2xl font-black">{value}</div>}
      </CardContent>
    </Card>
  );
}
