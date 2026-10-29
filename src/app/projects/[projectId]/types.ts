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

export type Meeting = {
  id: string;
  siteId: string;
  siteName: string;
  date: string;
  observations: Record<string, string>;
  criticalPoints: string;
  userId: string;
  userName: string;
  attendees?: { id: string, name: string }[];
  createdAt: any;
};

export type ChecklistRecord = {
  id: string;
  siteId: string;
  siteName: string;
  userName: string;
  createdAt: any;
  status: string;
  type: 'MMS' | 'Inverter' | 'HT Line' | 'HT Conductor' | 'Module Breakage';
  reference?: string;
};

export type DataItem = any;

export type POSortKey = 'poNumber' | 'site' | 'supplier' | 'status' | 'date' | 'total' | 'createdBy' | 'createdAt';
export type WOSortKey = 'woNumber' | 'contractor' | 'status' | 'date' | 'total';
export type BoMSortKey = 'itemName' | 'category' | 'make' | 'status' | 'plannedQuantity' | 'approvedQuantity';
export type PaymentSortKey = 'date' | 'payee' | 'amount' | 'reference';

export const MAIN_STAGES = [
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
