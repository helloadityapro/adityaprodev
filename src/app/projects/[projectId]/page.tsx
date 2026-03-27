'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, updateDocumentNonBlocking, deleteDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, serverTimestamp, orderBy, or, getDoc, increment, arrayUnion } from 'firebase/firestore';
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
  Check,
  XCircle,
  Loader2,
  PackageCheck,
  Truck,
  FilterX,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Pencil,
  Layers,
  ChevronDown,
  ChevronUp,
  Eye,
  ExternalLink,
  Printer,
  Gavel,
  Save,
  HardHat,
  CircleCheck,
  CircleX
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
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

const UNITS = ["Numbers", "Kilograms", "Liters", "Meters", "Sets", "Bundles", "Drums"];

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
  history?: POHistoryEntry[];
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
  subItems?: { name: string; quantityPerSet: number; unit: string }[];
};

type SortKey = 'engineer' | 'manager' | 'sites';
type POSortKey = 'poNumber' | 'supplier' | 'status' | 'date' | 'total';
type WOSortKey = 'woNumber' | 'contractor' | 'status' | 'date' | 'total';
type BoMSortKey = 'itemName' | 'category' | 'status' | 'plannedQuantity' | 'approvedQuantity';

const formatTimestamp = (ts: any) => {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return format(date, 'dd/MM/yyyy HH:mm');
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
  const searchParams = useSearchParams();

  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = React.useState(tabParam || "dashboard");

  React.useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // BoM Filtering/Searching States
  const [bomTableSearch, setBomTableSearch] = React.useState("");
  const [bomStatusFilter, setBomStatusFilter] = React.useState("all");
  const [bomCategoryFilter, setBomCategoryFilter] = React.useState("all");
  const [bomSortConfig, setBomSortConfig] = React.useState<{ key: BoMSortKey; direction: 'asc' | 'desc' }>({ key: 'itemName', direction: 'asc' });

  const [selectedMasterItem, setSelectedMasterItem] = React.useState<MasterItem | null>(null);
  const [isBomItemPopoverOpen, setIsBomItemPopoverOpen] = React.useState(false);
  const [bomItemSearchQuery, setBomItemSearchQuery] = React.useState("");
  
  const [bomActionState, setBomActionState] = React.useState<{ item: BoMItem, type: 'Approved' | 'Rejected' } | null>(null);
  const [woActionState, setWoActionState] = React.useState<{ wo: WorkOrder, type: 'Approved' | 'Rejected' } | null>(null);
  const [isActionProcessing, setIsActionProcessing] = React.useState(false);
  const [expandedBomRows, setExpandedBomRows] = React.useState<Set<string>>(new Set());
  
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

  const projectRef = useMemoFirebase(() => doc(firestore, 'sites', projectId), [firestore, projectId]);
  const { data: project, isLoading: projectLoading } = useDoc<Project>(projectRef);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

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
                           (item.category || "").toLowerCase().includes(bomTableSearch.toLowerCase());
      const matchesStatus = bomStatusFilter === 'all' || item.status === bomStatusFilter;
      const matchesCategory = bomCategoryFilter === 'all' || item.category === bomCategoryFilter;
      
      return matchesSearch && matchesStatus && matchesCategory;
    });

    result.sort((a, b) => {
      const { key, direction } = bomSortConfig;
      let valA: any = a[key] ?? '';
      let valB: any = b[key] ?? '';
      
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [bomItems, bomTableSearch, bomStatusFilter, bomCategoryFilter, bomSortConfig]);

  const bomCategories = React.useMemo(() => {
    if (!bomItems) return [];
    const cats = new Set(bomItems.map(item => item.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [bomItems]);

  const posQuery = useMemoFirebase(() => 
    query(collection(firestore, 'project_pos'), where('siteId', '==', projectId)), 
    [firestore, projectId]
  );
  const { data: purchaseOrders } = useCollection<PurchaseOrder>(posQuery);

  const wosQuery = useMemoFirebase(() => 
    query(collection(firestore, 'project_wos'), where('siteId', '==', projectId)), 
    [firestore, projectId]
  );
  const { data: workOrders } = useCollection<WorkOrder>(wosQuery);

  const inventoryQuery = useMemoFirebase(() => 
    query(collection(firestore, 'project_inventory'), where('siteId', '==', projectId)), 
    [firestore, projectId]
  );
  const { data: inventory } = useCollection<InventoryItem>(inventoryQuery);

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
    siteName ? query(collection(firestore, 'tasks'), where('siteName', '==', siteName)) : null,
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

  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'manager', direction: 'asc' });

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3.5 w-3.5 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3.5 w-3.5 text-primary" /> : <ArrowDown className="ml-2 h-3.5 w-3.5 text-primary" />;
  };

  const handlePOSort = (key: POSortKey) => {
    setPoSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const POSortIcon = ({ column }: { column: POSortKey }) => {
    if (poSortConfig.key !== column) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
    return poSortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4 text-primary" /> : <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
  };

  const handleWOSort = (key: WOSortKey) => {
    setWoSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const WOSortIcon = ({ column }: { column: WOSortKey }) => {
    if (woSortConfig.key !== column) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
    return woSortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4 text-primary" /> : <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
  };

  const handleBoMSort = (key: BoMSortKey) => {
    setBomSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const BoMSortIcon = ({ column }: { column: BoMSortKey }) => {
    if (bomSortConfig.key !== column) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
    return bomSortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4 text-primary" /> : <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
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
      itemName: itemName,
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

  const handleProcessWO = (remarks: string) => {
    if (!woActionState || !userProfile) return;
    setIsActionProcessing(true);
    const logEntry = {
      action: woActionState.type === 'Approved' ? 'Authorized' : 'Rejected',
      userName: userProfile.username || user?.email || 'Admin',
      userId: user?.uid || '',
      timestamp: new Date(),
      details: remarks ? `Remarks: ${remarks}` : 'Processed without specific remarks.'
    };
    const woRef = doc(firestore, 'project_wos', woActionState.wo.id);
    updateDocumentNonBlocking(woRef, {
      status: woActionState.type,
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid || '',
      updatedByName: userProfile.username || user?.email || 'Admin',
      history: arrayUnion(logEntry)
    });
    toast({ 
      title: woActionState.type === 'Approved' ? 'WO Authorized' : 'WO Rejected', 
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

  const handleUpdateStock = async (itemId: string, newStock: number) => {
    updateDocumentNonBlocking(doc(firestore, 'project_inventory', itemId), {
      stockLevel: newStock,
      lastUpdated: serverTimestamp()
    });
    toast({ title: 'Stock Updated' });
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

  const getLogHistory = (item: any) => {
    if (item.history && item.history.length > 0) return item.history;
    const fallback: POHistoryEntry[] = [];
    if (item.createdAt) {
      fallback.push({
        action: 'Created',
        userName: item.createdByName || 'Unknown',
        userId: '',
        timestamp: item.createdAt,
        details: 'Initial order creation'
      });
    }
    if (item.updatedAt) {
      fallback.push({
        action: 'Modified',
        userName: item.updatedByName || 'Unknown',
        userId: '',
        timestamp: item.updatedAt,
        details: 'Order details updated'
      });
    }
    return fallback.sort((a, b) => {
      const da = a.timestamp?.toDate?.()?.getTime() || 0;
      const db = b.timestamp?.toDate?.()?.getTime() || 0;
      return db - da;
    });
  };

  if (projectLoading) return (
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
    <div className="flex flex-col flex-1 h-full -mt-4 lg:-mt-6">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b shadow-sm -mx-4 lg:-mx-6 px-4 lg:px-6 py-4 animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => router.push('/projects/list')} className="h-7 mb-1 -ml-2 text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Projects Management
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
        {/* Performance Metrics Header - Consistent for all tabs */}
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
              <TabsTrigger 
                value="dashboard" 
                className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
              >
                <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" /> Board
              </TabsTrigger>
              <TabsTrigger 
                value="bom" 
                className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
              >
                <ClipboardList className="h-3.5 w-3.5 mr-1.5" /> BoM
              </TabsTrigger>
              <TabsTrigger 
                value="inventory" 
                className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
              >
                <Warehouse className="h-3.5 w-3.5 mr-1.5" /> Stock
              </TabsTrigger>
              <TabsTrigger 
                value="po" 
                className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
              >
                <ShoppingBag className="h-3.5 w-3.5 mr-1.5" /> Purchase Orders
              </TabsTrigger>
              <TabsTrigger 
                value="wo" 
                className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
              >
                <Gavel className="h-3.5 w-3.5 mr-1.5" /> Work Orders
              </TabsTrigger>
              <TabsTrigger 
                value="ptw" 
                className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
              >
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Permits
              </TabsTrigger>
              <TabsTrigger 
                value="dpr" 
                className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
              >
                <TableIcon className="h-3.5 w-3.5 mr-1.5" /> DPR
              </TabsTrigger>
              <TabsTrigger 
                value="logistics" 
                className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" /> Logistics
              </TabsTrigger>
              <TabsTrigger 
                value="tasks" 
                className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
              >
                <CheckSquare className="h-3.5 w-3.5 mr-1.5" /> Tasks
              </TabsTrigger>
              <TabsTrigger 
                value="visits" 
                className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
              >
                <Navigation className="h-3.5 w-3.5 mr-1.5" /> Visits
              </TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

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
                          <TableHead className="px-6 cursor-pointer" onClick={() => handleSort('engineer')}>
                            <div className="flex items-center">Personnel <SortIcon column="engineer" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort('manager')}>
                            <div className="flex items-center">Supervisor <SortIcon column="manager" /></div>
                          </TableHead>
                          <TableHead className="text-center cursor-pointer" onClick={() => handleSort('sites')}>
                            <div className="flex items-center justify-center">Sites <SortIcon column="sites" /></div>
                          </TableHead>
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
                            <TableCell className="text-center">
                              <Badge variant="outline" className="rounded-sm font-mono text-[10px] bg-primary/5 border-primary/20 text-primary">
                                {member.assignedProjectIds?.length || 0}
                              </Badge>
                            </TableCell>
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
                    <StatRow label="Pending Audits" value={permits?.filter((p: any) => p.status === 'Pending' || p.status === 'ManagerApproved').length || 0} color="amber" />
                    <StatRow label="Ongoing Work" value={tasks?.filter((t: any) => t.status !== 'Completed').length || 0} color="blue" />
                    <StatRow label="Total Evidence" value={dprs?.length || 0} color="primary" />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bom" className="space-y-8 mt-6 animate-in fade-in-50 duration-300">
            {(isAdmin || isManager) && (
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
                            <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal h-9 rounded-sm bg-background border-primary/20", !selectedMasterItem && "text-muted-foreground")}>
                              <span className="truncate">{selectedMasterItem ? selectedMasterItem.name : "Choose material..."}</span>
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
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">Specifications / Breakdown Preview</Label>
                        <div className="h-20 p-3 rounded-sm bg-muted/10 border border-primary/5 overflow-auto shadow-inner">
                          {selectedMasterItem ? (
                            <div className="space-y-2">
                              {selectedMasterItem.unit === 'Sets' && selectedMasterItem.subItems && selectedMasterItem.subItems.length > 0 ? (
                                <>
                                  <p className="text-[9px] font-black text-primary uppercase mb-1">Set Composition:</p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
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

            <div className="flex flex-col md:flex-row items-center gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm mb-6">
              <div className="relative w-full flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search BoM items..." className="pl-9 h-10 rounded-sm bg-muted/20 border-none" value={bomTableSearch} onChange={e => setBomTableSearch(e.target.value)} />
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <Select value={bomStatusFilter} onValueChange={setBomStatusFilter}>
                  <SelectTrigger className="w-[140px] h-10 text-[10px] font-bold uppercase tracking-tight rounded-sm border-primary/20">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs font-bold uppercase">All Status</SelectItem>
                    <SelectItem value="Pending" className="text-xs font-bold uppercase">Pending</SelectItem>
                    <SelectItem value="Approved" className="text-xs font-bold uppercase text-green-600">Approved</SelectItem>
                    <SelectItem value="Rejected" className="text-xs font-bold uppercase text-red-600">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={bomCategoryFilter} onValueChange={setBomCategoryFilter}>
                  <SelectTrigger className="w-[140px] h-10 text-[10px] font-bold uppercase rounded-sm border-primary/20">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs font-bold uppercase">All Categories</SelectItem>
                    {bomCategories.map(cat => (
                      <SelectItem key={cat} value={cat} className="text-xs font-bold uppercase">{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => { setBomTableSearch(""); setBomStatusFilter("all"); setBomCategoryFilter("all"); }} className="h-10 w-10 text-muted-foreground rounded-sm">
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
                                <div className="flex flex-col min-w-0">
                                  <span className="font-bold text-sm text-foreground">{item.itemName}</span>
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{item.specification}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell><Badge variant="secondary" className="rounded-sm font-bold text-[9px] uppercase tracking-wider">{item.category || "Uncategorized"}</Badge></TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <Badge variant="outline" className={cn(
                                  "w-fit rounded-sm text-[9px] font-black uppercase px-1.5 h-5",
                                  item.status === 'Approved' ? "bg-green-50 text-green-700 border-green-200" :
                                  item.status === 'Rejected' ? "bg-red-50 text-red-700 border-red-200" :
                                  "bg-yellow-50 text-yellow-700 border-yellow-200"
                                )}>{item.status || 'Pending'}</Badge>
                                {item.processedByName && (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[8px] font-bold text-muted-foreground uppercase">By: {item.processedByName}</span>
                                    {item.remarks && <span className="text-[9px] italic text-muted-foreground line-clamp-1">"{item.remarks}"</span>}
                                  </div>
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
                                {isAdmin && (<Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => setEditingBomItem(item)} title="Edit Item"><Pencil className="h-4 w-4" /></Button>)}
                                {isAdmin && item.status === 'Pending' && (
                                  <><Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 rounded-sm" onClick={() => setBomActionState({ item, type: 'Approved' })} title="Approve"><CheckCircle2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 rounded-sm" onClick={() => setBomActionState({ item, type: 'Rejected' })} title="Reject"><XCircle className="h-4 w-4" /></Button></>
                                )}
                                {(isAdmin || (isManager && item.status === 'Pending')) && (<Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'project_boms', item.id))} title="Delete"><Trash2 className="h-4 w-4" /></Button>)}
                              </div>
                            </TableCell>
                          </TableRow>
                          {expandedBomRows.has(item.id) && item.subItems && (
                            <TableRow className="bg-primary/[0.02]">
                              <TableCell colSpan={6} className="p-0 border-b">
                                <div className="p-4 px-12 space-y-3 animate-in slide-in-from-top-1 duration-200">
                                  <div className="flex items-center gap-2 mb-2"><Layers className="h-3.5 w-3.5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-primary">Component Breakdown for {item.itemName}</span></div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    {item.subItems.map((sub, sIdx) => (
                                      <div key={sIdx} className="p-3 bg-background border border-primary/5 rounded-sm flex flex-col gap-1"><span className="text-xs font-bold">{sub.name}</span><div className="flex items-center justify-between text-[10px]"><span className="text-muted-foreground uppercase font-medium">Per Set: {sub.quantityPerSet} {sub.unit}</span><span className="text-primary font-black uppercase">Total: {(sub.quantityPerSet * (item.approvedQuantity || item.plannedQuantity)).toFixed(2)} {sub.unit}</span></div></div>
                                    ))}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      )) : (
                        <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic text-xs">No records found matching filters.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-8 mt-6 animate-in fade-in-50 duration-300">
            <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
              <CardHeader className="bg-muted/5 border-b py-4">
                <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2"><Warehouse className="h-4 w-4 text-primary" /> Live On-Site Component Stock</CardTitle>
                <CardDescription>Individual tracking for materials and sub-components.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="px-6 min-w-[200px]">Material / Component</TableHead>
                        <TableHead className="text-center">Availability</TableHead>
                        <TableHead>Last Audit</TableHead>
                        <TableHead className="text-right px-6">Manual Adjust</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventory && inventory.length > 0 ? inventory.sort((a, b) => a.itemName.localeCompare(b.itemName)).map(item => (
                        <TableRow key={item.id} className="hover:bg-muted/5">
                          <TableCell className="px-6 py-4 font-bold text-sm">{item.itemName}</TableCell>
                          <TableCell className="text-center"><Badge className="bg-emerald-600 text-white font-mono font-bold rounded-sm px-2 h-6 border-none">{item.stockLevel} {item.unit}</Badge></TableCell>
                          <TableCell className="text-[10px] text-muted-foreground uppercase font-black">{formatTimestamp(item.lastUpdated)}</TableCell>
                          <TableCell className="text-right px-6"><div className="flex justify-end items-center gap-1.5"><Button variant="outline" size="icon" className="h-8 w-8 rounded-sm border-primary/20 text-primary" onClick={() => handleUpdateStock(item.id, Math.max(0, item.stockLevel - 1))}><MinusCircle className="h-4 w-4" /></Button><Button variant="outline" size="icon" className="h-8 w-8 rounded-sm border-primary/20 text-primary" onClick={() => handleUpdateStock(item.id, item.stockLevel + 1)}><PlusCircle className="h-4 w-4" /></Button></div></TableCell>
                        </TableRow>
                      )) : (
                        <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic text-xs">No stock data available. Component-level stock appears as material movements are recorded.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="po" className="mt-6 animate-in fade-in-50 duration-300 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
              <div className="relative w-full md:w-80"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search PO or Supplier" className="pl-8 h-9 rounded-sm border-primary/20 text-xs" value={poSearch} onChange={e => setPoSearch(e.target.value)} /></div>
              <Button asChild className="rounded-sm font-bold shadow-md h-9"><Link href={`/projects/${projectId}/procurement/create`}><Plus className="h-4 w-4 mr-2" /> Create Purchase Order</Link></Button>
            </div>
            <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
              <CardHeader className="bg-muted/5 border-b py-4"><CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2"><ShoppingBag className="h-4 w-4 text-primary" /> Active Purchase Orders</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handlePOSort('poNumber')}><div className="flex items-center">PO Number <POSortIcon column="poNumber" /></div></TableHead>
                        <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handlePOSort('supplier')}><div className="flex items-center">Supplier <POSortIcon column="supplier" /></div></TableHead>
                        <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handlePOSort('date')}><div className="flex items-center">Date <POSortIcon column="date" /></div></TableHead>
                        <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handlePOSort('status')}><div className="flex items-center">Status <POSortIcon column="status" /></div></TableHead>
                        <TableHead className="text-right cursor-pointer hover:text-primary transition-colors" onClick={() => handlePOSort('total')}><div className="flex items-center justify-end">Total Value <POSortIcon column="total" /></div></TableHead>
                        <TableHead>Audit Log</TableHead>
                        <TableHead className="text-right px-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSortedPOs.length > 0 ? filteredSortedPOs.map(po => (
                        <React.Fragment key={po.id}>
                          <TableRow className="hover:bg-muted/5 transition-colors">
                            <TableCell className="px-6 py-4"><div className="flex items-center gap-2"><Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => togglePORow(po.id)}>{expandedPORows.has(po.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button><div className="flex flex-col"><span className="font-mono text-xs font-black text-primary uppercase">{po.poNumber}</span><span className="text-[9px] font-bold text-muted-foreground uppercase">{po.itemsCount || 1} Material(s)</span></div></div></TableCell>
                            <TableCell className="text-sm font-semibold text-foreground">{po.supplierName}</TableCell>
                            <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">{po.orderDate}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[9px] font-black uppercase rounded-sm px-1.5 h-5">{po.status}</Badge></TableCell>
                            <TableCell className="text-right font-black text-sm font-mono text-foreground">₹{po.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell><Popover><PopoverTrigger asChild><Button variant="ghost" size="sm" className="h-8 rounded-sm font-bold text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary"><History className="h-3.5 w-3.5 mr-1.5" /> View Log</Button></PopoverTrigger><PopoverContent className="w-80 p-0 rounded-sm shadow-2xl border-primary/10"><div className="p-3 border-b bg-muted/5"><p className="text-[10px] font-black uppercase tracking-widest text-primary">Audit Log: {po.poNumber}</p></div><ScrollArea className="h-[250px]"><div className="p-4 space-y-4">{getLogHistory(po).map((entry, idx) => (<div key={idx} className="relative pl-4 border-l border-primary/20 pb-4 last:pb-0"><div className="absolute -left-[4.5px] top-1 h-2 w-2 rounded-full bg-primary" /><div className="flex flex-col gap-0.5"><p className="text-[10px] font-black uppercase text-primary leading-none">{entry.action}</p><p className="text-[9px] font-bold text-muted-foreground">{formatTimestamp(entry.timestamp)}</p><div className="flex items-center gap-1 mt-1"><User className="h-2.5 w-2.5 text-muted-foreground/60" /><span className="text-[9px] font-medium">{entry.userName}</span></div>{entry.details && (<p className="text-[9px] italic text-muted-foreground/80 mt-1 leading-tight border-t border-primary/5 pt-1">{entry.details}</p>)}</div></div>))}</div></ScrollArea></PopoverContent></Popover></TableCell>
                            <TableCell className="text-right px-6"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => setViewingPO(po)}><Eye className="h-4 w-4" /></Button>{(isAdmin || isManager) && (<><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 rounded-sm" asChild><Link href={`/projects/${projectId}/procurement/${po.id}/edit`}><Pencil className="h-4 w-4" /></Link></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => setPoToDelete(po)}><Trash2 className="h-4 w-4" /></Button></>)}</div></TableCell>
                          </TableRow>
                          {expandedPORows.has(po.id) && po.items && (<TableRow className="bg-muted/30"><TableCell colSpan={7} className="p-0"><div className="p-4 px-12 space-y-3 animate-in slide-in-from-top-1 duration-200"><div className="flex items-center gap-2 mb-2"><Layers className="h-3.5 w-3.5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-primary">Purchase Breakdown for {po.poNumber}</span></div><div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">{po.items.map((item, iIdx) => (<div key={iIdx} className="p-3 bg-background border border-primary/10 rounded-sm space-y-2 shadow-sm"><div className="flex justify-between items-start"><span className="text-xs font-black text-foreground">{item.itemName}</span><Badge variant="outline" className="h-4 px-1 text-[8px] font-black uppercase">Tax {item.gstPercent}%</Badge></div><div className="grid grid-cols-2 gap-2 border-t pt-2"><div className="flex flex-col"><span className="text-muted-foreground uppercase font-bold text-[8px]">Qty x Rate</span><span className="font-mono font-bold text-[10px]">{item.quantity} x ₹{item.rate.toLocaleString('en-IN')}</span></div><div className="flex flex-col text-right"><span className="text-muted-foreground uppercase font-bold text-[8px]">Subtotal (Incl. GST)</span><span className="text-primary font-black text-[10px]">₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div></div></div>))}</div><div className="flex justify-between items-center pt-2 border-t border-primary/10 mt-2"><span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Aggregate Total (Incl. GST)</span><span className="text-sm font-black text-primary">₹{po.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div></div></TableCell></TableRow>)}
                        </React.Fragment>
                      )) : (
                        <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic text-xs">No POs found in project records.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wo" className="mt-6 animate-in fade-in-50 duration-300 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
              <div className="relative w-full md:w-80"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search WO or Contractor" className="pl-8 h-9 rounded-sm border-primary/20 text-xs" value={woSearch} onChange={e => setWoSearch(e.target.value)} /></div>
              <Button asChild className="rounded-sm font-bold shadow-md h-9"><Link href={`/projects/${projectId}/work-orders/create`}><Plus className="h-4 w-4 mr-2" /> Create Work Order</Link></Button>
            </div>
            <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
              <CardHeader className="bg-muted/5 border-b py-4"><CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2"><Gavel className="h-4 w-4 text-primary" /> Service Work Orders</CardTitle></CardHeader>
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
                            <TableCell className="text-sm font-semibold text-foreground">{wo.contractorName}</TableCell>
                            <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">{wo.orderDate}</TableCell>
                            <TableCell><Badge variant="outline" className={cn("text-[9px] font-black uppercase rounded-sm px-1.5 h-5", wo.status === 'Approved' ? "bg-green-50 text-green-700 border-green-200" : wo.status === 'Rejected' ? "bg-red-50 text-red-700 border-red-200" : "bg-yellow-50 text-yellow-700 border-yellow-200")}>{wo.status || 'Pending'}</Badge></TableCell>
                            <TableCell className="text-right font-black text-sm font-mono text-foreground">₹{wo.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right px-6"><div className="flex justify-end items-center gap-1"><Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => setViewingWO(wo)}><Eye className="h-4 w-4" /></Button>{isAdmin && wo.status === 'Pending' && (<><Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 rounded-sm" onClick={() => setWoActionState({ wo, type: 'Approved' })} title="Approve WO"><CircleCheck className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 rounded-sm" onClick={() => setWoActionState({ wo, type: 'Rejected' })} title="Reject WO"><CircleX className="h-4 w-4" /></Button></>)}{(isAdmin || isManager) && (<><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 rounded-sm" asChild><Link href={`/projects/${projectId}/work-orders/${wo.id}/edit`}><Pencil className="h-4 w-4" /></Link></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => setWoToDelete(wo)}><Trash2 className="h-4 w-4" /></Button></>)}</div></TableCell>
                          </TableRow>
                          {expandedWORows.has(wo.id) && wo.items && wo.items.length > 0 && (<TableRow className="bg-muted/30"><TableCell colSpan={6} className="p-0"><div className="p-4 px-12 space-y-3 animate-in slide-in-from-top-1 duration-200"><div className="flex items-center gap-2 mb-2"><Layers className="h-3.5 w-3.5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-primary">Service Breakdown for {wo.woNumber}</span></div><div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">{wo.items.map((item, iIdx) => (<div key={iIdx} className="p-3 bg-background border border-primary/10 rounded-sm space-y-2 shadow-sm"><div className="flex justify-between items-start"><span className="text-xs font-black text-foreground">{item.description}</span><Badge variant="outline" className="h-4 px-1 text-[8px] font-black uppercase">Tax {item.gstPercent}%</Badge></div><div className="grid grid-cols-2 gap-2 border-t pt-2"><div className="flex flex-col"><span className="text-muted-foreground uppercase font-bold text-[8px]">Qty x Rate</span><span className="font-mono font-bold text-[10px]">{item.quantity} x ₹{item.rate.toLocaleString('en-IN')}</span></div><div className="flex flex-col text-right"><span className="text-muted-foreground uppercase font-bold text-[8px]">Amount (Incl. GST)</span><span className="text-primary font-black text-[10px]">₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div></div></div>))}</div><div className="flex justify-between items-center pt-2 border-t border-primary/10 mt-2"><span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Aggregate Value</span><span className="text-sm font-black text-primary">₹{wo.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div></div></TableCell></TableRow>)}
                        </React.Fragment>
                      )) : (
                        <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic text-xs">No work orders found.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ptw" className="mt-6 animate-in fade-in-50 duration-300">
            <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md">
              <CardHeader className="bg-muted/5 border-b py-4"><CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Compliance Audit: PtWs</CardTitle></CardHeader>
              <CardContent className="p-0">
                {permits && permits.length > 0 ? (
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="px-6">Serial No</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Engineer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead className="text-right px-6">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {permits.sort((a: any, b: any) => (b.requestDate?.toDate?.() || 0) - (a.requestDate?.toDate?.() || 0)).map((permit: any) => (
                        <TableRow key={permit.id} className="hover:bg-muted/5 group"><TableCell className="px-6 py-4 font-mono text-xs font-bold text-primary">{permit.serialNumber || permit.id.slice(0, 8)}</TableCell><TableCell className="text-sm font-semibold">{permit.ptwType}</TableCell><TableCell className="text-xs font-medium">{permit.siteEngineerName || '—'}</TableCell><TableCell><Badge variant="outline" className={cn("text-[9px] font-black uppercase rounded-sm h-5 px-1.5 whitespace-nowrap", permit.status === 'Approved' ? "bg-green-50 text-green-700 border-green-200" : permit.status === 'Rejected' ? "bg-red-50 text-red-700 border-red-200" : "bg-yellow-50 text-yellow-700 border-yellow-200")}>{permit.status}</Badge></TableCell><TableCell className="text-[10px] font-bold text-muted-foreground uppercase whitespace-nowrap">{formatTimestamp(permit.requestDate)}</TableCell><TableCell className="text-right px-6"><Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary rounded-sm"><Link href={`/ptw/list?view=${permit.id}`} title="View Permit Audit Log"><Eye className="h-4 w-4" /></Link></Button></TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-20 text-center text-muted-foreground italic">No permits found for this project.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dpr" className="mt-6 animate-in fade-in-50 duration-300">
            <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md">
              <CardHeader className="bg-muted/5 border-b py-4"><CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Daily Progress Reports</CardTitle></CardHeader>
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
                        <TableRow key={dpr.id} className="hover:bg-muted/5"><TableCell className="px-6 py-4 font-mono text-xs font-bold whitespace-nowrap align-top">{dpr.reportDate}</TableCell><TableCell className="text-xs font-semibold align-top">{dpr.userName}</TableCell><TableCell className="py-4"><div className="space-y-3">{dpr.description.split('\n\n').filter(p => p.trim() !== '').map((para, pIdx, arr) => (<React.Fragment key={pIdx}><p className="text-sm italic text-muted-foreground leading-relaxed">"{para.trim()}"</p>{pIdx < arr.length - 1 && (<div className="h-px bg-primary/10 my-2" />)}</React.Fragment>))}</div></TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-20 text-center text-muted-foreground italic">No reports found for this project.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logistics" className="mt-6 animate-in fade-in-50 duration-300">
            <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md">
              <CardHeader className="bg-muted/5 border-b py-4"><CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2"><ArrowLeftRight className="h-4 w-4 text-primary" /> Material Movement Logs</CardTitle></CardHeader>
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
                        <TableRow key={mov.id} className="hover:bg-muted/5"><TableCell className="px-6 py-4 font-mono text-xs font-bold whitespace-nowrap">{mov.movementDate}</TableCell><TableCell><Badge className={cn("text-[9px] font-black uppercase rounded-sm", mov.movementType === 'Inward' ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800")}>{mov.movementType}</Badge></TableCell><TableCell className="text-sm font-semibold">{mov.itemName}</TableCell><TableCell className="text-xs font-bold text-primary">{mov.quantity} {mov.unit}</TableCell><TableCell className="text-right px-6 text-[10px] font-bold text-muted-foreground uppercase">{mov.sourceOrDestination}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-20 text-center text-muted-foreground italic">No movements found.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="mt-6 animate-in fade-in-50 duration-300">
            <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md">
              <CardHeader className="bg-muted/5 border-b py-4"><CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2"><CheckSquare className="h-4 w-4 text-primary" /> Open Assignments</CardTitle></CardHeader>
              <CardContent className="p-0">
                {tasks && tasks.length > 0 ? (
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="px-6">Title</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Assigned By</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right px-6">Due</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks.map((task: any) => (
                        <TableRow key={task.id} className="hover:bg-muted/5">
                          <TableCell className="px-6 py-4 font-bold text-sm">{task.title}</TableCell>
                          <TableCell className="text-xs font-medium">{task.assignedToName}</TableCell>
                          <TableCell className="text-xs font-medium">{task.assignedByName}</TableCell>
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

          <TabsContent value="visits" className="mt-6 animate-in fade-in-50 duration-300">
            <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md">
              <CardHeader className="bg-muted/5 border-b py-4"><CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2"><Navigation className="h-4 w-4 text-primary" /> Management Presence</CardTitle></CardHeader>
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
                        <TableRow key={visit.id} className="hover:bg-muted/5 group"><TableCell className="px-6 py-4 font-mono text-[10px] font-bold text-muted-foreground">{formatTimestamp(visit.startTime)}</TableCell><TableCell className="text-sm font-bold text-foreground">{visit.managerName}</TableCell><TableCell><Badge variant="secondary" className="text-[9px] font-black uppercase rounded-sm">{visit.purpose || '—'}</Badge></TableCell><TableCell className="text-right px-6"><Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary rounded-sm"><Link href={`/site-visits/${visit.id}`}><ChevronRight className="h-4 w-4" /></Link></Button></TableCell></TableRow>
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

      {/* PO Details Modal */}
      <Dialog open={!!viewingPO} onOpenChange={(o) => !o && setViewingPO(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-none rounded-sm shadow-2xl bg-background flex flex-col h-[90vh]"><DialogHeader className="p-6 bg-primary/5 border-b shrink-0 flex flex-row items-center justify-between space-y-0"><div className="flex items-center gap-3"><div className="bg-primary/10 p-2 rounded-sm"><ShoppingBag className="h-5 w-5 text-primary" /></div><div><DialogTitle className="text-xl font-black uppercase tracking-tight">Purchase Order Audit</DialogTitle><DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{viewingPO?.poNumber}</DialogDescription></div></div><div className="no-print"><Button variant="outline" size="sm" onClick={() => window.print()} className="rounded-sm h-9 border-primary/20 text-primary"><Printer className="h-4 w-4 mr-2" /> Print PO</Button></div></DialogHeader><ScrollArea className="flex-1 bg-background">{viewingPO && (<div className="p-8 space-y-10" id="printable-po-area"><div className="grid grid-cols-1 md:grid-cols-2 gap-8"><div className="space-y-6"><div className="grid grid-cols-2 gap-4"><div className="space-y-1"><Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Supplier / Vendor</Label><p className="text-sm font-black text-foreground">{viewingPO.supplierName}</p></div><div className="space-y-1"><Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Order Date</Label><p className="text-sm font-bold">{viewingPO.orderDate}</p></div></div><div className="grid grid-cols-2 gap-4"><div className="space-y-1"><Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Authorized By</Label><p className="text-sm font-bold">{viewingPO.createdByName || 'N/A'}</p></div><div className="space-y-1"><Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Status</Label><div className="mt-1"><Badge className="rounded-sm h-5 text-[9px] uppercase font-black">{viewingPO.status}</Badge></div></div></div></div><div className="bg-primary/5 rounded-sm border-2 border-primary/10 p-6 flex flex-col justify-center items-center text-center shadow-inner"><span className="text-[10px] font-black uppercase text-primary tracking-widest mb-2">Total PO Value</span><span className="text-4xl font-black tabular-nums text-primary">₹{viewingPO.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div></div><div className="space-y-4"><Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><History className="h-4 w-4 text-primary" /> Itemized Line Items</Label><div className="border rounded-sm overflow-hidden bg-muted/10"><Table><TableHeader className="bg-muted/30"><TableRow><TableHead className="text-[10px] font-black uppercase px-4">Material Description</TableHead><TableHead className="text-[10px] font-black uppercase text-center">Qty</TableHead><TableHead className="text-[10px] font-black uppercase text-right">Rate (₹)</TableHead><TableHead className="text-[10px] font-black uppercase text-center">GST %</TableHead><TableHead className="text-right px-4 text-[10px] font-black uppercase">Line Total (₹)</TableHead></TableRow></TableHeader><TableBody>{viewingPO.items.map((item, idx) => (<TableRow key={idx} className="bg-background"><TableCell className="px-4 text-xs font-bold">{item.itemName}</TableCell><TableCell className="text-center font-mono font-bold text-xs">{item.quantity}</TableCell><TableCell className="text-right font-mono text-xs">₹{item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell><TableCell className="text-center text-xs font-medium">{item.gstPercent}%</TableCell><TableCell className="text-right px-4 font-mono text-xs font-black text-primary">₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell></TableRow>))}</TableBody></Table></div></div></div>)}</ScrollArea><DialogFooter className="p-4 bg-muted/5 border-t gap-3 shrink-0 no-print"><DialogClose asChild><Button variant="outline" className="rounded-sm font-black uppercase text-[10px] h-10 px-8 tracking-widest">Close Audit</Button></DialogClose></DialogFooter></DialogContent>
      </Dialog>

      {/* WO Details Modal */}
      <Dialog open={!!viewingWO} onOpenChange={(o) => !o && setViewingWO(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-none rounded-sm shadow-2xl bg-background flex flex-col h-[90vh]"><DialogHeader className="p-6 bg-primary/5 border-b shrink-0 flex flex-row items-center justify-between space-y-0"><div className="flex items-center gap-3"><div className="bg-primary/10 p-2 rounded-sm"><Gavel className="h-5 w-5 text-primary" /></div><div><DialogTitle className="text-xl font-black uppercase tracking-tight">Work Order Audit</DialogTitle><DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{viewingWO?.woNumber}</DialogDescription></div></div><div className="no-print"><Button variant="outline" size="sm" onClick={() => window.print()} className="rounded-sm h-9 border-primary/20 text-primary"><Printer className="h-4 w-4 mr-2" /> Print WO</Button></div></DialogHeader><ScrollArea className="flex-1 bg-background">{viewingWO && (<div className="p-8 space-y-10" id="printable-wo-area"><div className="grid grid-cols-1 md:grid-cols-2 gap-8"><div className="space-y-6"><div className="grid grid-cols-2 gap-4"><div className="space-y-1"><Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Contractor Partner</Label><p className="text-sm font-black text-foreground">{viewingWO.contractorName}</p></div><div className="space-y-1"><Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Release Date</Label><p className="text-sm font-bold">{viewingWO.orderDate}</p></div></div><div className="grid grid-cols-2 gap-4"><div className="space-y-1"><Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Authorized By</Label><p className="text-sm font-bold">{viewingWO.createdByName || 'N/A'}</p></div><div className="space-y-1"><Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Status</Label><div className="mt-1"><Badge className="rounded-sm h-5 text-[9px] uppercase font-black">{viewingWO.status}</Badge></div></div></div></div><div className="bg-primary/5 rounded-sm border-2 border-primary/10 p-6 flex flex-col justify-center items-center text-center shadow-inner"><span className="text-[10px] font-black uppercase text-primary tracking-widest mb-2">Contract Value</span><span className="text-4xl font-black tabular-nums text-primary">₹{viewingWO.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div></div><div className="space-y-4"><Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Service & Work Item Breakdown</Label>{viewingWO.items && viewingWO.items.length > 0 ? (<div className="border rounded-sm overflow-hidden bg-muted/10"><Table><TableHeader className="bg-muted/30"><TableRow><TableHead className="text-[10px] font-black uppercase px-4">Description</TableHead><TableHead className="text-[10px] font-black uppercase text-center">Qty</TableHead><TableHead className="text-[10px] font-black uppercase text-right">Rate (₹)</TableHead><TableHead className="text-[10px] font-black uppercase text-center">GST %</TableHead><TableHead className="text-right px-4 text-[10px] font-black uppercase">Line Total (₹)</TableHead></TableRow></TableHeader><TableBody>{viewingWO.items.map((item, idx) => (<TableRow key={idx} className="bg-background"><TableCell className="px-4 text-xs font-bold">{item.description}</TableCell><TableCell className="text-center font-mono font-bold text-xs">{item.quantity}</TableCell><TableCell className="text-right font-mono text-xs">₹{item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell><TableCell className="text-center text-xs font-medium">{item.gstPercent}%</TableCell><TableCell className="text-right px-4 font-mono text-xs font-black text-primary">₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell></TableRow>))}</TableBody></Table></div>) : (<div className="p-6 bg-muted/10 rounded-sm border italic leading-relaxed text-sm">{viewingWO.description}</div>)}</div><div className="space-y-4"><Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><History className="h-4 w-4 text-primary" /> Activity Log</Label><div className="border rounded-sm overflow-hidden bg-muted/10"><Table><TableHeader className="bg-muted/30"><TableRow><TableHead className="text-[10px] font-black uppercase px-4">Action</TableHead><TableHead className="text-[10px] font-black uppercase">Personnel</TableHead><TableHead className="text-[10px] font-black uppercase">Timestamp</TableHead><TableHead className="text-right px-4 text-[10px] font-black uppercase">Notes</TableHead></TableRow></TableHeader><TableBody>{getLogHistory(viewingWO).map((entry, idx) => (<TableRow key={idx} className="bg-background"><TableCell className="px-4 text-xs font-bold text-primary uppercase">{entry.action}</TableCell><TableCell className="text-xs font-semibold">{entry.userName}</TableCell><TableCell className="text-[10px] font-mono">{formatTimestamp(entry.timestamp)}</TableCell><TableCell className="text-right px-4 text-[10px] italic">{entry.details}</TableCell></TableRow>))}</TableBody></Table></div></div></div>)}</ScrollArea><DialogFooter className="p-4 bg-muted/5 border-t gap-3 shrink-0 no-print"><DialogClose asChild><Button variant="outline" className="rounded-sm font-black uppercase text-[10px] h-10 px-8 tracking-widest">Close Audit</Button></DialogClose></DialogFooter></DialogContent>
      </Dialog>

      {/* BoM Action Dialog */}
      <Dialog open={!!bomActionState} onOpenChange={(o) => !o && setBomActionState(null)}>
        <DialogContent className="max-w-md rounded-sm"><DialogHeader><DialogTitle className="uppercase tracking-tight font-black">{bomActionState?.type} BoM Item</DialogTitle><DialogDescription>Setting status for "{bomActionState?.item.itemName}"</DialogDescription></DialogHeader><div className="py-6 space-y-4">{bomActionState?.type === 'Approved' && (<div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Authorized Quantity ({bomActionState.item.unit})</Label><input type="number" id="bom-approved-qty" defaultValue={bomActionState.item.plannedQuantity} className="flex h-11 w-full rounded-sm border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm font-mono font-bold" /><p className="text-[9px] text-muted-foreground italic">You can adjust the quantity to be authorized for this site.</p></div>)}<div className="space-y-2"><Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Audit Remarks</Label><Textarea id="bom-remarks" placeholder="Provide reasoning or notes for site records..." className="min-h-[100px] rounded-sm" /></div></div><DialogFooter className="gap-2"><DialogClose asChild><Button variant="outline" className="rounded-sm font-bold h-11 px-6 uppercase text-[10px]">Cancel</Button></DialogClose><Button disabled={isActionProcessing} className={cn("rounded-sm font-black h-11 px-8 uppercase text-[10px] tracking-widest", bomActionState?.type === 'Approved' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700")} onClick={() => { const remarks = (document.getElementById('bom-remarks') as HTMLTextAreaElement)?.value || ""; const approvedQty = bomActionState?.type === 'Approved' ? parseFloat((document.getElementById('bom-approved-qty') as HTMLInputElement)?.value || String(bomActionState.item.plannedQuantity)) : undefined; handleProcessBoM(remarks, approvedQty); }}>{isActionProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : `Confirm ${bomActionState?.type}`}</Button></DialogFooter></DialogContent>
      </Dialog>

      {/* WO Action Dialog */}
      <Dialog open={!!woActionState} onOpenChange={(o) => !o && setWoActionState(null)}>
        <DialogContent className="max-w-md rounded-sm"><DialogHeader><DialogTitle className="uppercase tracking-tight font-black">{woActionState?.type} Work Order</DialogTitle><DialogDescription>Setting status for "{woActionState?.wo.woNumber}"</DialogDescription></DialogHeader><div className="py-6 space-y-4"><div className="space-y-2"><Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Decision Remarks</Label><Textarea id="wo-remarks" placeholder="Provide feedback for the contractor engagement..." className="min-h-[100px] rounded-sm" /></div></div><DialogFooter className="gap-2"><DialogClose asChild><Button variant="outline" className="rounded-sm font-bold h-11 px-6 uppercase text-[10px]">Cancel</Button></DialogClose><Button disabled={isActionProcessing} className={cn("rounded-sm font-black h-11 px-8 uppercase text-[10px] tracking-widest", woActionState?.type === 'Approved' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700")} onClick={() => { const remarks = (document.getElementById('wo-remarks') as HTMLTextAreaElement)?.value || ""; handleProcessWO(remarks); }}>{isActionProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : `Confirm ${woActionState?.type}`}</Button></DialogFooter></DialogContent>
      </Dialog>

      <AlertDialog open={!!poToDelete} onOpenChange={(o) => !o && setPoToDelete(null)}>
        <AlertDialogContent className="rounded-sm"><AlertDialogHeader><AlertDialogTitle>Remove Purchase Order?</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete PO <strong>{poToDelete?.poNumber}</strong>? This action will permanently remove it from organizational procurement records.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeletePO} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-sm font-bold">Delete PO</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!woToDelete} onOpenChange={(o) => !o && setWoToDelete(null)}>
        <AlertDialogContent className="rounded-sm"><AlertDialogHeader><AlertDialogTitle>Remove Work Order?</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete WO <strong>{woToDelete?.woNumber}</strong>? This action will permanently remove it from project service records.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteWO} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-sm font-bold">Delete WO</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      {/* Edit BoM Dialog */}
      <Dialog open={!!editingBomItem} onOpenChange={(o) => !o && setEditingBomItem(null)}>
        <DialogContent className="sm:max-w-md rounded-sm"><DialogHeader><DialogTitle>Edit BoM Item</DialogTitle><DialogDescription>Modify material details. Item will return to <strong>Pending</strong> status for re-approval.</DialogDescription></DialogHeader>{editingBomItem && (<form onSubmit={handleUpdateBoM} className="space-y-4 py-4"><div className="space-y-2"><Label htmlFor="edit-itemName">Item Name</Label><Input id="edit-itemName" name="itemName" defaultValue={editingBomItem.itemName} required className="rounded-sm" /></div><div className="space-y-2"><Label htmlFor="edit-specification">Specification</Label><Textarea id="edit-specification" name="specification" defaultValue={editingBomItem.specification} className="rounded-sm" rows={3} /></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="edit-plannedQty">Planned Quantity</Label><Input id="edit-plannedQty" name="plannedQty" type="number" step="0.01" defaultValue={editingBomItem.plannedQuantity} required className="rounded-sm" /></div><div className="space-y-2"><Label htmlFor="edit-unit">Unit</Label><Select name="unit" defaultValue={editingBomItem.unit}><SelectTrigger className="rounded-sm"><SelectValue placeholder="Select unit" /></SelectTrigger><SelectContent>{UNITS.map(u => (<SelectItem key={u} value={u}>{u}</SelectItem>))}</SelectContent></Select></div></div><DialogFooter className="pt-4 gap-2"><DialogClose asChild><Button variant="outline" className="rounded-sm">Cancel</Button></DialogClose><Button type="submit" className="rounded-sm font-bold">{isUpdatingBom ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save & Request Approval</Button></DialogFooter></form>)}</DialogContent>
      </Dialog>

      {/* BoM Item History Dialog */}
      <Dialog open={!!viewingBomLog} onOpenChange={(o) => !o && setViewingBomLog(null)}>
        <DialogContent className="max-w-lg rounded-sm"><DialogHeader><div className="flex items-center gap-2"><History className="h-5 w-5 text-primary" /><DialogTitle className="uppercase tracking-tight font-black">Activity Log: {viewingBomLog?.itemName}</DialogTitle></div><DialogDescription className="text-xs font-medium">Full lifecycle audit for this BoM line item.</DialogDescription></DialogHeader><ScrollArea className="max-h-[400px] mt-4"><div className="space-y-6 relative border-l-2 border-muted ml-3 pl-6 py-2">{viewingBomLog?.auditLog?.sort((a, b) => { const da = a.timestamp?.toDate?.()?.getTime() || new Date(a.timestamp).getTime(); const db = b.timestamp?.toDate?.()?.getTime() || new Date(b.timestamp).getTime(); return db - da; }).map((entry, idx) => (<div key={idx} className="relative"><div className="absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" /><div className="flex flex-col gap-1 text-left"><div className="flex items-center justify-between gap-4"><span className="text-[10px] font-black text-primary uppercase tracking-wider">{entry.action}</span><span className="text-[9px] font-mono font-bold text-muted-foreground uppercase">{formatTimestamp(entry.timestamp)}</span></div><p className="text-xs font-bold text-foreground flex items-center gap-1.5"><User className="h-3 w-3 opacity-40" /> {entry.userName}</p><p className="text-[11px] italic text-muted-foreground leading-relaxed bg-muted/20 p-2 rounded-sm border border-primary/5 mt-1">"{entry.details}"</p></div></div>))}{(!viewingBomLog?.auditLog || viewingBomLog.auditLog.length === 0) && (<div className="flex flex-col items-center justify-center py-10 opacity-30"><Clock className="h-8 w-8 mb-2" /><p className="text-[10px] font-black uppercase tracking-widest">No activity records found</p></div>)}</div></ScrollArea><DialogFooter className="bg-muted/5 border-t p-4"><DialogClose asChild><Button variant="outline" className="rounded-sm font-bold uppercase text-[10px] h-10 px-8">Close Audit</Button></DialogClose></DialogFooter></DialogContent>
      </Dialog>
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
    <div className={cn("flex items-center justify-between p-3 rounded-sm border", (colors as any)[color])}><span className="text-[10px] font-black uppercase tracking-wider">{label}</span><span className="text-lg font-black">{value}</span></div>
  );
}
