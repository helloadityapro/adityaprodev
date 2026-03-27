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
  Eye,
  Gavel,
  Save,
  HardHat,
  CircleCheck,
  CircleX,
  ShoppingBag,
  ArrowDownCircle,
  ArrowUpCircle,
  Package
} from 'lucide-react';
import { format } from 'date-fns';
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
              <TabsTrigger value="dashboard" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
                <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" /> BOARD
              </TabsTrigger>
              <TabsTrigger value="bom" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
                <ClipboardList className="h-3.5 w-3.5 mr-1.5" /> BOM
              </TabsTrigger>
              <TabsTrigger value="po" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
                <ShoppingBag className="h-3.5 w-3.5 mr-1.5" /> PURCHASE ORDERS
              </TabsTrigger>
              <TabsTrigger value="wo" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
                <Gavel className="h-3.5 w-3.5 mr-1.5" /> WORK ORDERS
              </TabsTrigger>
              <TabsTrigger value="inventory" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
                <Warehouse className="h-3.5 w-3.5 mr-1.5" /> INVENTORY
              </TabsTrigger>
              <TabsTrigger value="movements" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
                <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" /> MOVEMENTS
              </TabsTrigger>
              <TabsTrigger value="ptw" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> PERMITS
              </TabsTrigger>
              <TabsTrigger value="dpr" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
                <TableIcon className="h-3.5 w-3.5 mr-1.5" /> DPR
              </TabsTrigger>
              <TabsTrigger value="tasks" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
                <CheckSquare className="h-3.5 w-3.5 mr-1.5" /> TASKS
              </TabsTrigger>
              <TabsTrigger value="visits" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
                <Navigation className="h-3.5 w-3.5 mr-1.5" /> VISITS
              </TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <TabsContent value="dashboard" className="space-y-8 mt-6 animate-in fade-in-50 duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Card className="lg:col-span-2 rounded-sm border-primary/10 shadow-md overflow-hidden">
                <CardHeader className="bg-muted/5 border-b py-4">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
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
                              <CheckCircle2 className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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

          <TabsContent value="inventory" className="space-y-8 mt-6 animate-in fade-in-50 duration-300">
            <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
              <CardHeader className="bg-muted/5 border-b py-4">
                <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2"><Warehouse className="h-4 w-4 text-primary" /> On-Site Inventory Registry</CardTitle>
                <CardDescription>Comprehensive tracking of authorized materials and their current stock levels.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="px-6 min-w-[250px]">Item & Description</TableHead>
                        <TableHead>Make</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead className="text-center">Approved Qty</TableHead>
                        <TableHead className="text-center">Available Qty</TableHead>
                        <TableHead className="text-right px-6">Logs</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bomItems?.filter(i => i.status === 'Approved').map(bomItem => {
                        const invRecord = inventory?.find(inv => inv.itemName === bomItem.itemName);
                        const pos = purchaseOrders?.filter(po => po.items.some(pi => pi.bomItemId === bomItem.id)) || [];
                        const suppliers = Array.from(new Set(pos.map(p => p.supplierName))).join(', ') || '—';
                        const itemMovements = movements?.filter(m => m.itemName === bomItem.itemName) || [];

                        return (
                          <React.Fragment key={bomItem.id}>
                            <TableRow className="hover:bg-muted/5 transition-colors group">
                              <TableCell className="px-6 py-4">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-bold text-sm text-foreground">{bomItem.itemName}</span>
                                  <span className="text-[10px] text-muted-foreground line-clamp-1">{bomItem.specification}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="rounded-sm text-[9px] font-black uppercase bg-primary/5 text-primary border-primary/10">
                                  {bomItem.make || masterItems?.find(m => m.name === bomItem.itemName)?.make || 'Standard'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs font-medium text-muted-foreground truncate max-w-[150px]" title={suppliers}>{suppliers}</TableCell>
                              <TableCell className="text-center">
                                <div className="font-mono font-bold text-sm text-foreground">{bomItem.approvedQuantity || bomItem.plannedQuantity}</div>
                                <div className="text-[10px] text-muted-foreground uppercase font-medium">{bomItem.unit}</div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className={cn(
                                  "font-mono font-bold rounded-sm px-3 h-7 border-none shadow-sm",
                                  (invRecord?.stockLevel || 0) > 0 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
                                )}>
                                  {invRecord?.stockLevel || 0} {bomItem.unit}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right px-6">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => toggleInvRow(bomItem.id)}>
                                  {expandedInvRows.has(bomItem.id) ? <ChevronUp className="h-4 w-4" /> : <History className="h-4 w-4" />}
                                </Button>
                              </TableCell>
                            </TableRow>
                            {expandedInvRows.has(bomItem.id) && (
                              <TableRow className="bg-primary/[0.01]">
                                <TableCell colSpan={6} className="p-0 border-b">
                                  <div className="p-6 px-12 animate-in slide-in-from-top-1 duration-200">
                                    <div className="flex items-center gap-2 mb-4">
                                      <History className="h-3.5 w-3.5 text-primary" />
                                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Movement History: {bomItem.itemName}</span>
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
                                            <div className="flex items-center gap-4 text-right">
                                              <div className="flex flex-col items-end">
                                                <span className="font-bold text-muted-foreground uppercase text-[9px]">{m.userName}</span>
                                                <span className="text-[9px] text-muted-foreground/60">{m.movementDate}</span>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="p-8 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/10 rounded-sm border border-dashed">No material movements logged for this item.</div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                      {(!bomItems || bomItems.filter(i => i.status === 'Approved').length === 0) && (
                        <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic flex flex-col items-center justify-center gap-3">
                          <Package className="h-10 w-10 opacity-20" />
                          <p className="text-sm font-bold uppercase tracking-widest">No Approved BoM Items Discovered</p>
                        </TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="movements" className="mt-6 animate-in fade-in-50 duration-300">
            <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md">
              <CardHeader className="bg-muted/5 border-b py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2"><ArrowLeftRight className="h-4 w-4 text-primary" /> Material Movement Logs</CardTitle>
                  <Button size="sm" className="h-8 rounded-sm font-black text-[10px] uppercase" asChild><Link href="/inventory/record"><Plus className="h-3 w-3 mr-1.5" /> Record Movement</Link></Button>
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
                          <TableCell className="px-6 py-4 font-mono text-xs font-bold whitespace-nowrap">{mov.movementDate}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("text-[9px] font-black uppercase rounded-sm h-5 px-1.5", mov.movementType === 'Inward' ? "bg-green-50 text-green-700 border-green-200" : "bg-blue-50 text-blue-700 border-blue-200")}>
                              {mov.movementType === 'Inward' ? <ArrowDownCircle className="h-2.5 w-2.5 mr-1" /> : <ArrowUpCircle className="h-2.5 w-2.5 mr-1" />}
                              {mov.movementType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-semibold">{mov.itemName}</TableCell>
                          <TableCell className="text-center text-xs font-bold text-primary">{mov.quantity} {mov.unit}</TableCell>
                          <TableCell className="text-right px-6 text-[10px] font-bold text-muted-foreground uppercase">{mov.sourceOrDestination}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-20 text-center text-muted-foreground italic">No movements recorded for this project yet.</div>
                )}
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
              <CardHeader className="bg-muted/5 border-b py-4"><CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2"><Navigation className="h-4 w-4 text-primary" /> Manager Visit Audit</CardTitle></CardHeader>
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

      {/* Decision Dialog for BoM items */}
      <Dialog open={!!bomActionState} onOpenChange={(o) => !o && setBomActionState(null)}>
        <DialogContent className="rounded-sm max-w-md">
          <DialogHeader>
            <DialogTitle>Authorize BoM Item</DialogTitle>
            <DialogDescription>Set status for {bomActionState?.item.itemName}. Authorized items enable material movement logging.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold">Planned Qty: {bomActionState?.item.plannedQuantity} {bomActionState?.item.unit}</Label>
              {bomActionState?.type === 'Approved' && (
                <div className="space-y-2 pt-2">
                  <Label>Final Approved Quantity</Label>
                  <Input 
                    type="number" 
                    defaultValue={bomActionState.item.plannedQuantity} 
                    id="approved-qty"
                    className="rounded-sm" 
                  />
                </div>
              )}
              <Label className="text-xs font-bold pt-2 block">Remarks</Label>
              <Textarea id="action-remarks" placeholder="Provide justification or comments..." className="min-h-[100px] rounded-sm" />
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

      {/* Edit BoM Dialog */}
      <Dialog open={!!editingBomItem} onOpenChange={(o) => !o && setEditingBomItem(null)}>
        <DialogContent className="rounded-sm max-lg w-full">
          <DialogHeader>
            <DialogTitle>Edit BoM Entry</DialogTitle>
            <DialogDescription>Modify planned materials for {siteName}.</DialogDescription>
          </DialogHeader>
          {editingBomItem && (
            <form onSubmit={handleUpdateBoM} className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label>Item Name</Label>
                <Input name="itemName" defaultValue={editingBomItem.itemName} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Planned Qty</Label>
                  <Input name="plannedQty" type="number" defaultValue={editingBomItem.plannedQuantity} />
                </div>
                <div className="grid gap-2">
                  <Label>Unit</Label>
                  <Select name="unit" defaultValue={editingBomItem.unit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Specification</Label>
                <Textarea name="specification" defaultValue={editingBomItem.specification} />
              </div>
              <DialogFooter className="pt-4">
                <DialogClose asChild><Button variant="outline" className="rounded-sm">Cancel</Button></DialogClose>
                <Button type="submit" className="rounded-sm font-bold" disabled={isUpdatingBom}>{isUpdatingBom ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : 'Update & Re-Submit'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* BoM Audit Log Dialog */}
      <Dialog open={!!viewingBomLog} onOpenChange={(o) => !o && setViewingBomLog(null)}>
        <DialogContent className="rounded-sm max-w-lg">
          <DialogHeader>
            <DialogTitle>BoM Life-cycle Log</DialogTitle>
            <DialogDescription>Historical changes for {viewingBomLog?.itemName}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-6 relative border-l-2 border-muted ml-3 pl-6 py-2">
              {viewingBomLog?.auditLog?.map((entry, idx) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                  <div className="flex flex-col gap-1 text-left">
                    <span className="text-xs font-bold text-primary uppercase tracking-tight">{entry.action} — {entry.userName}</span>
                    <p className="text-[10px] text-muted-foreground font-mono font-bold uppercase">{formatTimestamp(entry.timestamp)}</p>
                    <p className="text-xs italic leading-relaxed text-foreground/80 mt-1">"{entry.details}"</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Decision Dialog for Work Orders */}
      <Dialog open={!!woActionState} onOpenChange={(o) => !o && setWoActionState(null)}>
        <DialogContent className="rounded-sm max-w-md">
          <DialogHeader>
            <DialogTitle>Authorize Work Order</DialogTitle>
            <DialogDescription>Process approval for WO {woActionState?.wo.woNumber}.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Decision Remarks</Label>
              <Textarea id="wo-action-remarks" placeholder="Enter comments for the contractor/engineer..." className="min-h-[100px] rounded-sm" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button 
              className={cn("min-w-[120px]", woActionState?.type === 'Approved' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700")}
              disabled={isActionProcessing}
              onClick={() => {
                const remarks = (document.getElementById('wo-action-remarks') as HTMLTextAreaElement)?.value || "";
                handleProcessWO(remarks);
              }}
            >
              {isActionProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : `Confirm ${woActionState?.type}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!poToDelete} onOpenChange={(o) => !o && setPoToDelete(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader><AlertDialogTitle>Delete PO?</AlertDialogTitle><AlertDialogDescription>This will remove purchase order <strong>{poToDelete?.poNumber}</strong> from site records.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeletePO} className="bg-destructive text-destructive-foreground">Confirm Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!woToDelete} onOpenChange={(o) => !o && setWoToDelete(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader><AlertDialogTitle>Delete WO?</AlertDialogTitle><AlertDialogDescription>This will remove work order <strong>{woToDelete?.woNumber}</strong> from site records.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteWO} className="bg-destructive text-destructive-foreground">Confirm Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

const UNITS = ["Numbers", "Kilograms", "Liters", "Meters", "Sets", "Bundles", "Drums"];
