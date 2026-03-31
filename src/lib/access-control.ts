
/**
 * @fileOverview Definition of all available sidebar pages and their keys.
 * This acts as the source of truth for the User Access Management system.
 */

export type PageKey = 
  | 'reports' 
  | 'documents' 
  | 'lms' 
  | 'rewards' 
  | 'projects' 
  | 'inventory' 
  | 'purchase-orders' 
  | 'work-orders' 
  | 'payments' 
  | 'dpr' 
  | 'tasks' 
  | 'permits' 
  | 'visits' 
  | 'trips' 
  | 'attendance'
  | 'admin-attendance-summary'
  | 'admin-day-report'
  | 'admin-lms'
  | 'admin-dashboard'
  | 'admin-permits'
  | 'admin-vehicles'
  | 'admin-rewards'
  | 'admin-suppliers'
  | 'admin-contractors'
  | 'admin-users'
  | 'admin-teams'
  | 'admin-access'
  | 'admin-settings';

export interface AppPage {
  id: PageKey;
  label: string;
  category: 'Main Hub' | 'Operations' | 'Administration';
  path: string;
}

export const APP_PAGES: AppPage[] = [
  { id: 'reports', label: 'Dashboard (Reports)', category: 'Main Hub', path: '/reports' },
  { id: 'documents', label: 'Documents', category: 'Main Hub', path: '/documents' },
  { id: 'lms', label: 'Learning Hub', category: 'Main Hub', path: '/lms' },
  { id: 'rewards', label: 'Rewards', category: 'Main Hub', path: '/rewards' },
  
  { id: 'projects', label: 'Projects', category: 'Operations', path: '/projects/list' },
  { id: 'inventory', label: 'Inventory', category: 'Operations', path: '/inventory/global' },
  { id: 'purchase-orders', label: 'Purchase Orders', category: 'Operations', path: '/purchase-orders/manage' },
  { id: 'work-orders', label: 'Work Orders', category: 'Operations', path: '/work-orders/manage' },
  { id: 'payments', label: 'Payments', category: 'Operations', path: '/payments/record' },
  { id: 'dpr', label: 'Daily Progress Reports (DPR)', category: 'Operations', path: '/dpr/submit' },
  { id: 'tasks', label: 'Tasks', category: 'Operations', path: '/tasks/list' },
  { id: 'permits', label: 'Permits to Work (PtW)', category: 'Operations', path: '/ptw/list' },
  { id: 'visits', label: 'Site Visits', category: 'Operations', path: '/site-visits/active' },
  { id: 'trips', label: 'Vehicle Trips', category: 'Operations', path: '/vehicles/trips/manage' },
  { id: 'attendance', label: 'Personnel Attendance', category: 'Operations', path: '/attendance' },
  
  { id: 'admin-attendance-summary', label: 'Daily Presence Summary', category: 'Administration', path: '/admin/attendance-summary' },
  { id: 'admin-day-report', label: 'Full Day Audit Report', category: 'Administration', path: '/admin/day-report' },
  { id: 'admin-lms', label: 'LMS Administration', category: 'Administration', path: '/lms/admin' },
  { id: 'admin-dashboard', label: 'Legacy Admin Dashboard', category: 'Administration', path: '/admin/dashboard' },
  { id: 'admin-permits', label: 'Permit Cleanup & Mgt', category: 'Administration', path: '/settings/permits' },
  { id: 'admin-vehicles', label: 'Fleet Registry', category: 'Administration', path: '/vehicles/manage' },
  { id: 'admin-rewards', label: 'Rewards & Rates Setup', category: 'Administration', path: '/settings/rewards' },
  { id: 'admin-suppliers', label: 'Supplier Registry', category: 'Administration', path: '/settings/suppliers' },
  { id: 'admin-contractors', label: 'Contractor Registry', category: 'Administration', path: '/settings/contractors' },
  { id: 'admin-users', label: 'Personnel Directory', category: 'Administration', path: '/settings/users' },
  { id: 'admin-teams', label: 'Reporting & Teams', category: 'Administration', path: '/settings/teams' },
  { id: 'admin-access', label: 'User Access Management', category: 'Administration', path: '/settings/access' },
  { id: 'admin-settings', label: 'System Dropdowns', category: 'Administration', path: '/settings/dropdown-management' },
];

/**
 * Checks if a path belongs to a specific page key.
 */
export function getPageKeyByPath(path: string): PageKey | null {
  // Exact match first
  const match = APP_PAGES.find(p => path === p.path || path.startsWith(p.path + '/'));
  if (match) return match.id;

  // Handle specific operations aliases
  if (path.startsWith('/ptw')) return 'permits';
  if (path.startsWith('/dpr')) return 'dpr';
  if (path.startsWith('/tasks')) return 'tasks';
  if (path.startsWith('/inventory')) return 'inventory';
  if (path.startsWith('/projects')) return 'projects';
  if (path.startsWith('/purchase-orders')) return 'purchase-orders';
  if (path.startsWith('/work-orders')) return 'work-orders';
  if (path.startsWith('/payments')) return 'payments';
  if (path.startsWith('/site-visits')) return 'visits';
  if (path.startsWith('/vehicles')) return 'trips';
  if (path.startsWith('/attendance')) return 'attendance';
  
  return null;
}
