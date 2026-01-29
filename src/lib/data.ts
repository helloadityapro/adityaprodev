export type Project = {
  id: string;
  name: string;
  site: string;
  status: 'In Progress' | 'Completed' | 'On Hold';
  manager: string;
  startDate: string;
};

export const mockProjects: Project[] = [];

export type Permit = {
  id: string;
  site: string;
  ptwType: 'Hot Work' | 'Confined Space' | 'Electrical' | 'Excavation' | 'Confined Space Entry' | 'Electrical Work' | 'Work at Height';
  description: string;
  requestedBy: string;
  requestDate: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Corrected';
};

export const mockPermits: Permit[] = [];

export type User = {
  id: string;
  username: string;
  email: string;
  mobile: string;
  role: 'Admin' | 'Supervisor' | 'Site Engineer';
  status: 'Active' | 'Pending';
  avatarUrl: string;
};

export const mockUsers: User[] = [];

export const mockSites: string[] = [];
export const mockPtwTypes: string[] = [];
