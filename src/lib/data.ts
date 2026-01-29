export type Project = {
  id: string;
  name: string;
  site: string;
  status: 'In Progress' | 'Completed' | 'On Hold';
  manager: string;
  startDate: string;
};

export const mockProjects: Project[] = [
  { id: 'PROJ-001', name: 'Tower A Construction', site: 'North Site', status: 'In Progress', manager: 'Alice Johnson', startDate: '2023-01-15' },
  { id: 'PROJ-002', name: 'Pipeline Maintenance', site: 'West Site', status: 'In Progress', manager: 'Bob Williams', startDate: '2023-02-20' },
  { id: 'PROJ-003', name: 'Electrical Retrofitting', site: 'East Site', status: 'Completed', manager: 'Charlie Brown', startDate: '2023-03-10' },
  { id: 'PROJ-004', name: 'Foundation Work', site: 'North Site', status: 'On Hold', manager: 'Alice Johnson', startDate: '2023-04-05' },
  { id: 'PROJ-005', name: 'HVAC Installation', site: 'South Site', status: 'In Progress', manager: 'David Green', startDate: '2023-05-01' },
];

export type Permit = {
  id: string;
  site: string;
  ptwType: 'Hot Work' | 'Confined Space' | 'Electrical' | 'Excavation' | 'Confined Space Entry' | 'Electrical Work' | 'Work at Height';
  description: string;
  requestedBy: string;
  requestDate: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Corrected';
};

export const mockPermits: Permit[] = [
  { id: 'PTW-001', site: 'North Site', ptwType: 'Hot Work', description: 'Welding on level 3', requestedBy: 'Engineer Eve', requestDate: '2023-06-01', status: 'Approved' },
  { id: 'PTW-002', site: 'West Site', ptwType: 'Confined Space', description: 'Tank inspection', requestedBy: 'Engineer Frank', requestDate: '2023-06-02', status: 'Pending' },
  { id: 'PTW-003', site: 'East Site', ptwType: 'Electrical', description: 'Panel upgrade', requestedBy: 'Engineer Grace', requestDate: '2023-06-02', status: 'Rejected' },
  { id: 'PTW-004', site: 'North Site', ptwType: 'Excavation', description: 'Trench for new pipes', requestedBy: 'Engineer Eve', requestDate: '2023-06-03', status: 'Pending' },
  { id: 'PTW-005', site: 'South Site', ptwType: 'Work at Height', description: 'Facade cleaning', requestedBy: 'Engineer Frank', requestDate: '2023-06-04', status: 'Corrected' },
];

export type User = {
  id: string;
  username: string;
  email: string;
  mobile: string;
  role: 'Admin' | 'Supervisor' | 'Site Engineer';
  status: 'Active' | 'Pending';
  avatarUrl: string;
};

export const mockUsers: User[] = [
  { id: 'USR-001', username: 'Admin User', email: 'admin@permitflow.com', mobile: '+111111111', role: 'Admin', status: 'Active', avatarUrl: 'https://picsum.photos/seed/10/40/40' },
  { id: 'USR-002', username: 'Supervisor Sam', email: 'supervisor@permitflow.com', mobile: '+222222222', role: 'Supervisor', status: 'Active', avatarUrl: 'https://picsum.photos/seed/11/40/40' },
  { id: 'USR-003', username: 'Engineer Eve', email: 'engineer.eve@permitflow.com', mobile: '+333333333', role: 'Site Engineer', status: 'Active', avatarUrl: 'https://picsum.photos/seed/12/40/40' },
  { id: 'USR-004', username: 'Pending Pete', email: 'pete@example.com', mobile: '+444444444', role: 'Site Engineer', status: 'Pending', avatarUrl: 'https://picsum.photos/seed/13/40/40' },
];

export const mockSites = ['North Site', 'South Site', 'East Site', 'West Site', 'Central Hub'];
export const mockPtwTypes = ['Hot Work', 'Confined Space Entry', 'Electrical Work', 'Work at Height', 'Excavation', 'Lifting Operations'];
