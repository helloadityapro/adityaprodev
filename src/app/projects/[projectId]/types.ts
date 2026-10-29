import { PageKey } from '@/lib/access-control';

export type Attachment = {
  url: string;
  name: string;
  contentType: string;
};

export type AuditEntry = {
  action: string;
  userName: string;
  timestamp: any;
  details: string;
};

export type POHistoryEntry = {
  action: string;
  userName: string;
  userId: string;
  timestamp: any;
  details?: string;
};

export type UserProfile = {
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
  pointsMultiplier?: number;
};

export type Project = {
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

export type BoMItem = {
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

export type POItem = {
  bomItemId: string;
  itemName: string;
  quantity: number;
  rate: number;
  gstPercent: number;
  amount: number;
};

export type PurchaseOrder = {
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

export type WOItem = {
  description: string;
  quantity: number;
  rate: number;
  gstPercent: number;
  amount: number;
};

export type WorkOrder = {
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
  projectCompany?: string;
  siteName?: string;
};

export type InventoryItem = {
  id: string;
  itemName: string;
  stockLevel: number;
  utilisedQuantity?: number;
  unit: string;
  lastUpdated: any;
};

export type Payment = {
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

export type MasterItem = {
  id: string;
  name: string;
  category: string;
  make: string;
  unit: string;
  description?: string;
  subItems?: { name: string; quantityPerSet: number; unit: string }[];
};

export type MaterialUtilisation = {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
  utilisationDate: string;
  remarks: string;
  userName: string;
  createdAt: any;
};

export type LiaisoningDocument = {
  url: string;
  name: string;
  storagePath: string;
  uploadedAt: string;
};

export type StageData = {
  status: 'Pending' | 'In Progress' | 'Completed';
  remarks: string;
  documents: LiaisoningDocument[];
  subStages?: Record<string, boolean>;
  progressFlags?: string[];
};

export type LiaisoningRecord = {
  id: string;
  siteId: string;
  siteName: string;
  status: 'In Progress' | 'Completed';
  completionPercentage: number;
  stages: Record<string, StageData>;
  contractorId?: string;
  contractorName?: string;
};

export type MappingOverride = {
  id: string;
  engineerId: string;
  siteId: string;
  managerId: string;
};

export type DataItem = any;

export type POSortKey = 'poNumber' | 'supplier' | 'status' | 'date' | 'total';
export type WOSortKey = 'woNumber' | 'contractor' | 'status' | 'date' | 'total';
export type BoMSortKey = 'itemName' | 'category' | 'make' | 'status' | 'plannedQuantity' | 'approvedQuantity';
export type PaymentSortKey = 'date' | 'payee' | 'amount' | 'reference';
