

/**
 * @fileOverview Definition of all available sidebar pages and their keys.
 * This acts as the source of truth for the User Access Management system.
 */

export type PageKey = 
  | 'reports' 
  | 'dashboard-activities'
  | 'documents' 
  | 'lms' 
  | 'rewards' 
  | 'projects' 
  | 'inventory' 
  | 'purchase-orders' 
  | 'work-orders' 
  | 'payments' 
  | 'requirements'
  | 'requisitions'
  | 'dpr' 
  | 'tasks' 
  | 'permits' 
  | 'ptw-dashboard'
  | 'visits' 
  | 'visits-summary'
  | 'trips' 
  | 'attendance'
  | 'attendance-map'
  | 'checklists-installation'
  | 'checklists-ht-line'
  | 'checklists-ht-conductor'
  | 'checklists-inverter'
  | 'checklists-data'
  | 'master-data-tables-add'
  | 'master-data-tables-list'
  | 'admin-attendance-summary'
  | 'admin-attendance-matrix'
  | 'admin-day-report'
  | 'admin-lms'
  | 'admin-dashboard'
  | 'admin-permits'
  | 'admin-vehicles'
  | 'admin-rewards'
  | 'admin-suppliers'
  | 'admin-makes'
  | 'admin-contractors'
  | 'admin-users'
  | 'admin-teams'
  | 'admin-access'
  | 'admin-settings'
  | 'project-tab-dashboard'
  | 'project-tab-bom'
  | 'project-tab-po'
  | 'project-tab-wo'
  | 'project-tab-payments'
  | 'project-tab-inventory'
  | 'project-tab-utilisation'
  | 'project-tab-movements'
  | 'project-tab-ptw'
  | 'project-tab-dpr'
  | 'project-tab-tasks'
  | 'project-tab-visits';

export interface AppPage {
  id: PageKey;
  label: string;
  category: 'Main Hub' | 'Operations' | 'Administration' | 'Project Detail Tabs' | 'Registries' | 'Checklists';
  path: string;
}

export const APP_PAGES: AppPage[] = [
  { id: 'reports', label: 'Dashboard (Reports)', category: 'Main Hub', path: '/reports' },
  { id: 'dashboard-activities', label: 'Activities', category: 'Main Hub', path: '/dashboard/activities' },
  { id: 'documents', label: 'Documents', category: 'Main Hub', path: '/documents' },
  { id: 'lms', label: 'Learning Hub', category: 'Main Hub', path: '/lms' },
  { id: 'rewards', label: 'Rewards', category: 'Main Hub', path: '/rewards' },
  
  { id: 'projects', label: 'Projects', category: 'Operations', path: '/projects/list' },
  { id: 'inventory', label: 'Inventory', category: 'Operations', path: '/inventory/global' },
  { id: 'purchase-orders', label: 'Purchase Orders', category: 'Operations', path: '/purchase-orders/manage' },
  { id: 'work-orders', label: 'Work Orders', category: 'Operations', path: '/work-orders/manage' },
  { id: 'payments', label: 'Payments', category: 'Operations', path: '/payments/record' },
  { id: 'requirements', label: 'Requirements', category: 'Operations', path: '/requirements/submit' },
  { id: 'requisitions', label: 'Material Requisition', category: 'Operations', path: '/requisitions/list' },
  { id: 'dpr', label: 'Daily Progress Reports (DPR)', category: 'Operations', path: '/dpr/submit' },
  { id: 'tasks', label: 'Tasks', category: 'Operations', path: '/tasks/list' },
  { id: 'permits', label: 'Permits to Work (PtW)', category: 'Operations', path: '/ptw/list' },
  { id: 'ptw-dashboard', label: 'PtW Dashboard', category: 'Operations', path: '/ptw/dashboard' },
  { id: 'visits', label: 'Site Visits', category: 'Operations', path: '/site-visits/active' },
  { id: 'visits-summary', label: 'Visit Summary', category: 'Operations', path: '/site-visits/summary' },
  { id: 'trips', label: 'Vehicle Trips', category: 'Operations', path: '/vehicles/trips/manage' },
  { id: 'attendance', label: 'Personnel Attendance', category: 'Operations', path: '/attendance' },
  { id: 'attendance-map', label: 'Personnel Live Map', category: 'Operations', path: '/attendance/map-view' },

  { id: 'admin-suppliers', label: 'Supplier Registry', category: 'Registries', path: '/registries/suppliers' },
  { id: 'admin-contractors', label: 'Contractor Registry', category: 'Registries', path: '/registries/contractors' },
  { id: 'admin-makes', label: 'Makes Registry', category: 'Registries', path: '/registries/makes' },
  { id: 'master-data-tables-add', label: 'Add Tables Data', category: 'Registries', path: '/registries/tables/add' },
  { id: 'master-data-tables-list', label: 'Tables Data', category: 'Registries', path: '/registries/tables/list' },

  { id: 'checklists-installation', label: 'Table Level MMS Checklist', category: 'Checklists', path: '/checklists/installation' },
  { id: 'checklists-ht-line', label: 'HT Line Checklist', category: 'Checklists', path: '/checklists/ht-line' },
  { id: 'checklists-ht-conductor', label: 'HT Conductor Checklist', category: 'Checklists', path: '/checklists/ht-conductor' },
  { id: 'checklists-inverter', label: 'Inverter Checklist', category: 'Checklists', path: '/checklists/inverter' },
  { id: 'checklists-data', label: 'Checklist Data Registry', category: 'Checklists', path: '/checklists/data' },
  
  { id: 'admin-attendance-summary', label: 'Daily Presence Summary', category: 'Administration', path: '/admin/attendance-summary' },
  { id: 'admin-attendance-matrix', label: 'Monthly Attendance Matrix', category: 'Administration', path: '/admin/attendance-summary/matrix' },
  { id: 'admin-day-report', label: 'Full Day Audit Report', category: 'Administration', path: '/admin/day-report' },
  { id: 'admin-lms', label: 'LMS Administration', category: 'Administration', path: '/lms/admin' },
  { id: 'admin-dashboard', label: 'Legacy Admin Dashboard', category: 'Administration', path: '/admin/dashboard' },
  { id: 'admin-permits', label: 'Permit Cleanup & Mgt', category: 'Administration', path: '/settings/permits' },
  { id: 'admin-vehicles', label: 'Fleet Registry', category: 'Administration', path: '/vehicles/manage' },
  { id: 'admin-rewards', label: 'Rewards & Rates Setup', category: 'Administration', path: '/settings/rewards' },
  { id: 'admin-users', label: 'Personnel Directory', category: 'Administration', path: '/settings/users' },
  { id: 'admin-teams', label: 'Reporting & Teams', category: 'Administration', path: '/settings/teams' },
  { id: 'admin-access', label: 'User Access Management', category: 'Administration', path: '/settings/access' },
  { id: 'admin-settings', label: 'System Dropdowns', category: 'Administration', path: '/settings/dropdown-management' },

  // Project Tabs
  { id: 'project-tab-dashboard', label: 'Project: Board', category: 'Project Detail Tabs', path: '' },
  { id: 'project-tab-bom', label: 'Project: BOM', category: 'Project Detail Tabs', path: '' },
  { id: 'project-tab-po', label: 'Project: Purchase Orders', category: 'Project Detail Tabs', path: '' },
  { id: 'project-tab-wo', label: 'Project: Work Orders', category: 'Project Detail Tabs', path: '' },
  { id: 'project-tab-payments', label: 'Project: Payments', category: 'Project Detail Tabs', path: '' },
  { id: 'project-tab-inventory', label: 'Project: Inventory', category: 'Project Detail Tabs', path: '' },
  { id: 'project-tab-utilisation', label: 'Project: Utilisation', category: 'Project Detail Tabs', path: '' },
  { id: 'project-tab-movements', label: 'Project: Movements', category: 'Project Detail Tabs', path: '' },
  { id: 'project-tab-ptw', label: 'Project: Permits', category: 'Project Detail Tabs', path: '' },
  { id: 'project-tab-dpr', label: 'Project: DPR', category: 'Project Detail Tabs', path: '' },
  { id: 'project-tab-tasks', label: 'Project: Tasks', category: 'Project Detail Tabs', path: '' },
  { id: 'project-tab-visits', label: 'Project: Visits', category: 'Project Detail Tabs', path: '' },
];

/**
 * Checks if a path belongs to a specific page key.
 */
export function getPageKeyByPath(path: string): PageKey | null {
  // 1. Check exact matches or path prefixes from APP_PAGES first
  const match = APP_PAGES.find(p => p.id !== undefined && p.path !== '' && (path === p.path || path.startsWith(p.path + '/')));
  if (match) return match.id;

  // 2. Explicit aliases for operational modules that have multiple entry points
  if (path.startsWith('/ptw')) {
    if (path.includes('/dashboard')) return 'ptw-dashboard';
    return 'permits';
  }
  if (path.startsWith('/dpr')) return 'dpr';
  if (path.startsWith('/tasks')) return 'tasks';
  if (path.startsWith('/inventory')) return 'inventory';
  if (path.startsWith('/projects')) return 'projects';
  if (path.startsWith('/purchase-orders')) return 'purchase-orders';
  if (path.startsWith('/work-orders')) return 'work-orders';
  if (path.startsWith('/payments')) return 'payments';
  if (path.startsWith('/requirements')) return 'requirements';
  if (path.startsWith('/requisitions')) return 'requisitions';
  if (path.startsWith('/site-visits')) {
    if (path.includes('/summary')) return 'visits-summary';
    return 'visits';
  }
  if (path.startsWith('/attendance')) return 'attendance';
  if (path.startsWith('/checklists/installation')) return 'checklists-installation';
  if (path.startsWith('/checklists/ht-line')) return 'checklists-ht-line';
  if (path.startsWith('/checklists/ht-conductor')) return 'checklists-ht-conductor';
  if (path.startsWith('/checklists/inverter')) return 'checklists-inverter';
  if (path.startsWith('/checklists/data')) return 'checklists-data';
  if (path.startsWith('/registries/tables')) {
    if (path.includes('/add')) return 'master-data-tables-add';
    if (path.includes('/list')) return 'master-data-tables-list';
  }
  if (path.startsWith('/registries/suppliers')) return 'admin-suppliers';
  if (path.startsWith('/registries/contractors')) return 'admin-contractors';
  if (path.startsWith('/registries/makes')) return 'admin-makes';
  
  // 3. Vehicles specific (Handling both management and requests under 'trips' key)
  if (path.startsWith('/vehicles/trips') || path.startsWith('/vehicles/request')) return 'trips';
  if (path.startsWith('/vehicles/manage')) return 'admin-vehicles';
  
  return null;
}

/**
 * Normalizes a role string into a stable identifier for use as a Firestore document ID.
 * This prevents slashes and special characters from breaking path resolutions in security rules.
 */
export function slugifyRole(role: string): string {
  return role
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word characters (except spaces and hyphens)
    .replace(/[\s_]+/g, '-')  // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}
