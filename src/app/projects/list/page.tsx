'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, arrayUnion, arrayRemove, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Briefcase, 
  Search, 
  Building2, 
  ArrowRight, 
  MapPin,
  FilterX,
  Activity,
  HardHat,
  Star,
  Tags,
  ChevronDown,
  Zap,
  ShieldCheck,
  Check,
  LayoutGrid,
  UserCog,
  User as UserIcon,
  CircleCheck,
  Flag,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { isSuperAdmin } from '@/lib/auth-constants';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { slugifyRole, type PageKey } from '@/lib/access-control';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

type Site = {
  id: string;
  name: string;
  projectCompany: string;
  acCapacity: any;
  dcCapacity: any;
  projectType?: 'groundmount' | 'rooftop';
  latitude?: number;
  longitude?: number;
  projectOwnerId?: string;
  projectOwnerName?: string;
  workStatus?: string;
  projectStatus?: string;
};

type AccessConfig = {
  id: string;
  allowedPageKeys: any[];
  ownDataOnly?: boolean;
};

type UserProfile = {
  id: string;
  username: string;
  role: string;
  assignedProjectIds?: string[];
  starredProjectIds?: string[];
  ownDataOnly?: boolean;
};

type MappingOverride = {
  id: string;
  engineerId: string;
  siteId: string;
  managerId: string;
};

const formatCapacity = (val: any) => {
  const num = typeof val === 'number' ? val : parseFloat(String(val || 0));
  return isNaN(num) ? "0.000" : num.toFixed(3);
};

const STATE_STORAGE_KEY = 'adityapro_projects_list_v1';

export default function ProjectsListPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();

  const [activeTab, setActiveTab] = React.useState<string>("groundmount");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [showStarredOnly, setShowStarredOnly] = React.useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = React.useState<string[]>([]);

  // Column Filter States
  const [nameFilter, setNameFilter] = React.useState("");
  const [companyFilter, setCompanyFilter] = React.useState("");
  const [ownerFilter, setOwnerFilter] = React.useState("");
  const [workStatusFilter, setWorkStatusFilter] = React.useState("all");
  const [projectStatusFilter, setProjectStatusFilter] = React.useState("all");
  const [teamFilter, setTeamFilter] = React.useState("");

  // Sorting State
  const [sortConfig, setSortConfig] = React.useState<{ key: string | null; direction: 'asc' | 'desc' }>({ 
    key: 'name', 
    direction: 'asc' 
  });

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const roleConfigsQuery = useMemoFirebase(() => user ? collection(firestore, 'system_settings', 'access', 'roles') : null, [firestore, user]);
  const { data: roleConfigs } = useCollection<AccessConfig>(roleConfigsQuery);

  const isSuper = isSuperAdmin(user?.email);
  const isAdmin = isSuper || userProfile?.role === "Admin";
  const isManager = userProfile?.role === "Site Manager";
  const userRoleStr = isAdmin ? 'admin' : (userProfile?.role ? slugifyRole(userProfile.role) : 'site-engineer');

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites, isLoading: sitesLoading } = useCollection<Site>(sitesQuery);

  const groupsQuery = useMemoFirebase(() => collection(firestore, 'site_groups'), [firestore]);
  const { data: groups, isLoading: groupsLoading } = useCollection<any>(groupsQuery);

  const overridesQuery = useMemoFirebase(() => collection(firestore, 'team_mapping_overrides'), [firestore]);
  const { data: allOverrides, isLoading: overridesLoading } = useCollection<MappingOverride>(overridesQuery);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers } = useCollection<UserProfile>(usersQuery);

  const teamQuery = useMemoFirebase(() => {
    if (!isManager || !user) return null;
    return query(collection(firestore, 'users'), where('siteManagerId', '==', user.uid));
  }, [firestore, user, isManager]);
  const { data: teamMembers } = useCollection<UserProfile>(teamQuery);

  const starredIds = React.useMemo(() => new Set(userProfile?.starredProjectIds || []), [userProfile]);

  // STATE PRESERVATION LOGIC
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const navEntries = window.performance.getEntriesByType('navigation');
    const isReload = navEntries.length > 0 && (navEntries[0] as any).type === 'reload';
    
    if (isReload) {
      sessionStorage.removeItem(STATE_STORAGE_KEY);
      return;
    }

    const saved = sessionStorage.getItem(STATE_STORAGE_KEY);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.activeTab) setActiveTab(state.activeTab);
        if (state.searchTerm) setSearchTerm(state.searchTerm);
        if (state.showStarredOnly !== undefined) setShowStarredOnly(state.showStarredOnly);
        if (state.selectedGroupIds) setSelectedGroupIds(state.selectedGroupIds);
        if (state.sortConfig) setSortConfig(state.sortConfig);
        
        if (state.scrollPosition) {
          setTimeout(() => {
            window.scrollTo({ top: state.scrollPosition, behavior: 'instant' });
          }, 150);
        }
      } catch (e) {
        console.error("State restoration error:", e);
      }
    }
  }, []);

  React.useEffect(() => {
    const saveState = () => {
      const state = {
        activeTab,
        searchTerm,
        showStarredOnly,
        selectedGroupIds,
        sortConfig,
        scrollPosition: window.scrollY
      };
      sessionStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
    };

    saveState();

    const handleScroll = () => {
      try {
        const current = JSON.parse(sessionStorage.getItem(STATE_STORAGE_KEY) || '{}');
        current.scrollPosition = window.scrollY;
        sessionStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(current));
      } catch (e) {}
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeTab, searchTerm, showStarredOnly, selectedGroupIds, sortConfig]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-1 h-3 w-3 text-primary" /> : <ArrowDown className="ml-1 h-3 w-3 text-primary" />;
  };

  const toggleStar = (e: React.MouseEvent, siteId: string) => {
    e.stopPropagation();
    if (!user) return;
    
    const isStarred = starredIds.has(siteId);
    const ref = doc(firestore, 'users', user.uid);
    
    updateDocumentNonBlocking(ref, {
      starredProjectIds: isStarred ? arrayRemove(siteId) : arrayUnion(siteId)
    });
  };

  const accessibleSites = React.useMemo(() => {
    if (!allSites || !userProfile) return [];
    if (isSuper || isAdmin) return allSites;
    
    const roleId = userProfile.role ? slugifyRole(userProfile.role) : 'none';
    const isOwnDataOnly = userProfile.ownDataOnly !== undefined 
      ? userProfile.ownDataOnly 
      : roleConfigs?.find(c => c.id === roleId)?.ownDataOnly ?? false;

    if (!isOwnDataOnly) return allSites;

    const siteIds = new Set<string>();

    if (isManager) {
      allOverrides?.filter(o => o.managerId === userProfile.id).forEach(o => siteIds.add(o.siteId));
      if (teamMembers) {
        teamMembers.forEach(member => {
          (member.assignedProjectIds || []).forEach(sid => {
            const hasOtherOverride = allOverrides?.some(o => o.engineerId === member.id && o.siteId === sid && o.managerId !== userProfile.id);
            if (!hasOtherOverride) siteIds.add(sid);
          });
        });
      }
    } else {
      (userProfile.assignedProjectIds || []).forEach(id => siteIds.add(id));
    }
    
    return allSites.filter(s => siteIds.has(s.id));
  }, [allSites, userProfile, roleConfigs, isSuper, isAdmin, isManager, teamMembers, allOverrides]);

  const filteredSites = React.useMemo(() => {
    let result = accessibleSites.filter(s => {
      const type = s.projectType || 'groundmount';
      return type === activeTab;
    });

    result = result.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           s.projectCompany.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStarred = !showStarredOnly || starredIds.has(s.id);
      
      const matchesNameFilter = s.name.toLowerCase().includes(nameFilter.toLowerCase());
      const matchesCompanyFilter = s.projectCompany.toLowerCase().includes(companyFilter.toLowerCase());
      const matchesOwnerFilter = (s.projectOwnerName || '').toLowerCase().includes(ownerFilter.toLowerCase());
      const matchesWorkStatusFilter = workStatusFilter === 'all' || s.workStatus === workStatusFilter;
      const matchesProjectStatusFilter = projectStatusFilter === 'all' || s.projectStatus === projectStatusFilter;
      
      const team = allUsers?.filter(u => u.assignedProjectIds?.includes(s.id)) || [];
      const teamNames = team.map(u => u.username.toLowerCase()).join(' ');
      const matchesTeamFilter = teamNames.includes(teamFilter.toLowerCase());

      return matchesSearch && matchesStarred && matchesNameFilter && matchesCompanyFilter && matchesOwnerFilter && matchesWorkStatusFilter && matchesProjectStatusFilter && matchesTeamFilter;
    });

    if (selectedGroupIds.length > 0) {
      const allowedSiteIds = new Set<string>();
      groups?.filter(g => selectedGroupIds.includes(g.id)).forEach(g => {
        g.siteIds?.forEach((id: string) => allowedSiteIds.add(id));
      });
      result = result.filter(s => allowedSiteIds.has(s.id));
    }

    // Advanced Sorting Logic
    result.sort((a, b) => {
      const { key, direction } = sortConfig;
      if (!key) return 0;

      let valA: any = '';
      let valB: any = '';

      if (key === 'team') {
        const teamA = allUsers?.filter(u => u.assignedProjectIds?.includes(a.id)) || [];
        const teamB = allUsers?.filter(u => u.assignedProjectIds?.includes(b.id)) || [];
        valA = teamA.length;
        valB = teamB.length;
      } else {
        valA = a[key as keyof Site] ?? '';
        valB = b[key as keyof Site] ?? '';
      }

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [accessibleSites, searchTerm, showStarredOnly, starredIds, selectedGroupIds, groups, activeTab, nameFilter, companyFilter, ownerFilter, workStatusFilter, projectStatusFilter, teamFilter, allUsers, sortConfig]);

  const summaryStats = React.useMemo(() => {
    return {
      count: filteredSites.length,
      ac: filteredSites.reduce((sum, s) => sum + (parseFloat(String(s.acCapacity || 0)) || 0), 0),
      dc: filteredSites.reduce((sum, s) => sum + (parseFloat(String(s.dcCapacity || 0)) || 0), 0),
    };
  }, [filteredSites]);

  const clearAllFilters = () => {
    setSearchTerm("");
    setShowStarredOnly(false);
    setSelectedGroupIds([]);
    setNameFilter("");
    setCompanyFilter("");
    setOwnerFilter("");
    setWorkStatusFilter("all");
    setProjectStatusFilter("all");
    setTeamFilter("");
    setSortConfig({ key: 'name', direction: 'asc' });
  };

  if (isProfileLoading || sitesLoading || groupsLoading || overridesLoading) {
    return (
      <div className="space-y-8 p-4 sm:p-8">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-24 w-full rounded-sm" />
          <Skeleton className="h-24 w-full rounded-sm" />
          <Skeleton className="h-24 w-full rounded-sm" />
        </div>
        <Skeleton className="h-96 w-full rounded-sm" />
      </div>
    );
  }

  const countLabel = showStarredOnly ? 'Starred Projects' : (selectedGroupIds.length > 0 ? 'Filtered Sites' : 'Projects Authorized');

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2">
          <Briefcase className="h-8 w-8 text-primary" /> Project Management
        </h1>
        <p className="text-muted-foreground text-sm font-medium">Monitoring site assets, Bill of Materials, and inventory compliance.</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-muted/50 border border-primary/10 rounded-sm p-1 h-11 max-w-md mb-8">
          <TabsTrigger value="groundmount" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
            <LayoutGrid className="h-3.5 w-3.5 mr-2" /> Groundmount
          </TabsTrigger>
          <TabsTrigger value="rooftop" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
            <Building2 className="h-3.5 w-3.5 mr-2" /> Rooftop
          </TabsTrigger>
        </TabsList>

        <TabsContent value="groundmount" className="space-y-8 m-0 animate-in fade-in-50 duration-300">
          {renderSummaryAndTable()}
        </TabsContent>

        <TabsContent value="rooftop" className="space-y-8 m-0 animate-in fade-in-50 duration-300">
          {renderSummaryAndTable()}
        </TabsContent>
      </Tabs>
    </div>
  );

  function renderSummaryAndTable() {
    return (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in slide-in-from-top-2 duration-300">
          <div className="p-4 bg-primary/5 border border-primary/10 rounded-sm flex items-center justify-between shadow-sm">
            <div className="space-y-0.5">
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">{countLabel}</p>
              <p className="text-2xl font-black text-primary leading-none">{summaryStats.count}</p>
              <p className="text-[8px] font-bold text-primary/60 uppercase">Active Locations</p>
            </div>
            <Building2 className="h-8 w-8 text-primary/10" />
          </div>
          <div className="p-4 bg-primary/5 border border-primary/10 rounded-sm flex items-center justify-between shadow-sm">
            <div className="space-y-0.5">
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Agg. AC Capacity</p>
              <p className="text-2xl font-black text-primary leading-none">{formatCapacity(summaryStats.ac)}</p>
              <p className="text-[8px] font-bold text-primary/60 uppercase">Megawatts (MW)</p>
            </div>
            <Zap className="h-8 w-8 text-primary/10" />
          </div>
          <div className="p-4 bg-primary/5 border border-primary/10 rounded-sm flex items-center justify-between shadow-sm">
            <div className="space-y-0.5">
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Agg. DC Capacity</p>
              <p className="text-2xl font-black text-primary leading-none">{formatCapacity(summaryStats.dc)}</p>
              <p className="text-[8px] font-bold text-primary/60 uppercase">Megawatts Peak (MWp)</p>
            </div>
            <ShieldCheck className="h-8 w-8 text-primary/10" />
          </div>
        </div>

        <div className="flex flex-col gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center gap-4 w-full">
            <div className="relative flex-1 md:w-96">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search project or company..." 
                className="pl-10 h-11 rounded-sm border-primary/20 bg-background"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-11 rounded-sm font-bold border-primary/20 text-primary bg-background shadow-sm px-4 gap-1.5 min-w-[160px]">
                    <Tags className="h-4 w-4" />
                    {selectedGroupIds.length === 0 ? "All Groups" : `${selectedGroupIds.length} Groups`}
                    <ChevronDown className="h-3 w-3 opacity-50 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-0 rounded-sm border-primary/10 shadow-2xl overflow-hidden">
                  <div className="bg-primary/5 p-3 border-b">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Organizational Groups</h3>
                  </div>
                  <ScrollArea className="h-[200px]">
                    <div className="p-2 space-y-1">
                      {groups?.map((group: any) => (
                        <div 
                          key={group.id} 
                          className={cn(
                            "flex items-center space-x-2 p-2 rounded-sm hover:bg-muted/50 transition-colors cursor-pointer",
                            selectedGroupIds.includes(group.id) && "bg-primary/10"
                          )}
                          onClick={() => setSelectedGroupIds(prev => prev.includes(group.id) ? prev.filter(id => id !== group.id) : [...prev, group.id])}
                        >
                          <Checkbox checked={selectedGroupIds.includes(group.id)} />
                          <span className="text-xs font-bold uppercase truncate">{group.name}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              <Button 
                variant={showStarredOnly ? "default" : "outline"} 
                size="sm" 
                onClick={() => setShowStarredOnly(!showStarredOnly)}
                className={cn("h-11 rounded-sm font-bold px-6", showStarredOnly ? "" : "text-primary border-primary/20 hover:bg-primary/5")}
              >
                <Star className={cn("h-4 w-4 mr-2", showStarredOnly && "fill-current")} />
                {showStarredOnly ? "Starred Projects" : "View Starred"}
              </Button>
              
              <Button variant="ghost" size="icon" onClick={clearAllFilters} className="h-11 w-11 text-muted-foreground rounded-sm">
                <FilterX className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile-Responsive Card List */}
        <div className="md:hidden space-y-4">
          {filteredSites.length > 0 ? filteredSites.map((site) => {
            const isStarred = starredIds.has(site.id);
            const team = allUsers?.filter(u => u.assignedProjectIds?.includes(site.id)) || [];
            const siteManagers = team.filter(u => u.role === 'Site Manager').map(u => u.username);
            const siteEngineers = team.filter(u => u.role === 'Site Engineer').map(u => u.username);

            return (
              <Card 
                key={site.id} 
                className="rounded-sm border-primary/10 shadow-sm active:bg-muted/5 transition-colors cursor-pointer"
                onClick={() => router.push(`/projects/${site.id}`)}
              >
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-primary/10 rounded-sm text-primary shrink-0">
                        {activeTab === 'rooftop' ? <Building2 className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-sm text-foreground break-words leading-tight">{site.name}</span>
                        <span className="text-[10px] uppercase font-black text-muted-foreground break-words mt-1">{site.projectCompany}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2" onClick={(e) => toggleStar(e, site.id)}>
                      <Star className={cn("h-4 w-4 transition-all", isStarred ? "fill-primary text-primary" : "text-muted-foreground/30")} />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border rounded-sm p-2 bg-muted/5">
                    <div className="space-y-1">
                      <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Project Owner</p>
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <UserIcon className="h-3 w-3 text-primary/40" />
                        {site.projectOwnerName || "Unassigned"}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Work Status</p>
                      <Badge variant="outline" className={cn(
                        "text-[8px] h-5 rounded-sm uppercase font-black border-primary/10",
                        site.workStatus === 'Completed' ? "bg-green-50 text-green-700 border-green-200" :
                        site.workStatus === 'Cancelled' ? "bg-red-50 text-red-700 border-red-200" :
                        site.workStatus === 'Yet to Start' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                        "bg-blue-50 text-blue-700"
                      )}>
                        {site.workStatus || "In Progress"}
                      </Badge>
                    </div>
                  </div>

                  {site.latitude && site.longitude && (
                    <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-muted-foreground/60 px-1">
                      <MapPin className="h-3 w-3" /> {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2.5 bg-muted/20 rounded-sm space-y-1">
                      <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest block">AC CAP</span>
                      <div className="flex items-baseline gap-1">
                        <span className="font-black text-xs text-primary">{formatCapacity(site.acCapacity)}</span>
                        <span className="text-[7px] font-bold uppercase opacity-50">MW</span>
                      </div>
                    </div>
                    <div className="p-2.5 bg-muted/20 rounded-sm space-y-1">
                      <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest block">DC CAP</span>
                      <div className="flex items-baseline gap-1">
                        <span className="font-black text-xs text-amber-600">{formatCapacity(site.dcCapacity)}</span>
                        <span className="text-[7px] font-bold uppercase opacity-50">MWp</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-primary/5 pt-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Site Management</span>
                      <div className="flex flex-wrap gap-1">
                        {siteManagers.length > 0 ? siteManagers.map(m => (
                          <Badge key={m} variant="secondary" className="h-4 px-1 text-[7px] font-black bg-primary/5 text-primary border-none uppercase truncate">{m}</Badge>
                        )) : <span className="text-[9px] text-muted-foreground/30 italic">No Manager Assigned</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Engineering Team</span>
                      <div className="flex flex-wrap gap-1">
                        {siteEngineers.length > 0 ? siteEngineers.map(e => (
                          <Badge key={e} variant="outline" className="h-4 px-1 text-[7px] font-bold text-muted-foreground/80 border-border uppercase truncate">{e}</Badge>
                        )) : <span className="text-[9px] text-muted-foreground/30 italic">No Engineers Assigned</span>}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-primary/5 flex justify-between items-center">
                    <Badge variant="outline" className={cn(
                      "text-[8px] h-4 font-black uppercase rounded-sm px-1.5 border-none",
                      site.projectStatus === 'close' ? "bg-slate-900 text-white" : "bg-primary text-white"
                    )}>
                      {site.projectStatus || "open"}
                    </Badge>
                    <Button variant="ghost" size="sm" className="h-8 rounded-sm text-primary text-[10px] font-bold uppercase tracking-widest">
                      Manage Site <ArrowRight className="ml-1.5 h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          }) : (
            <div className="py-20 text-center text-muted-foreground italic text-xs uppercase font-bold opacity-30 border-2 border-dashed rounded-sm">
              No matching projects discovered
            </div>
          )}
        </div>

        <div className="hidden md:block">
          <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30 sticky top-0 z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="w-12 text-center"></TableHead>
                      <TableHead className="px-6 min-w-[220px]">
                        <div className="flex items-center justify-between gap-2">
                           <div className="flex items-center cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('name')}>
                             <span className="font-black uppercase text-[10px] tracking-widest">Project Name</span>
                             <SortIcon column="name" />
                           </div>
                           <Popover>
                             <PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><Filter className={cn("h-3 w-3", nameFilter ? "text-primary" : "text-muted-foreground/40")} /></Button></PopoverTrigger>
                             <PopoverContent className="w-64 p-3" align="start">
                               <div className="space-y-2 text-left">
                                 <Label className="text-[10px] font-black uppercase">Filter Name</Label>
                                 <Input placeholder="Enter name..." value={nameFilter} onChange={e => setNameFilter(e.target.value)} className="h-8 text-xs" />
                                 {nameFilter && <Button variant="ghost" size="sm" onClick={() => setNameFilter("")} className="h-7 w-full text-[10px] font-bold uppercase">Clear</Button>}
                               </div>
                             </PopoverContent>
                           </Popover>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center justify-between gap-2">
                           <div className="flex items-center cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('projectCompany')}>
                             <span className="font-black uppercase text-[10px] tracking-widest">Company</span>
                             <SortIcon column="projectCompany" />
                           </div>
                           <Popover>
                             <PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><Filter className={cn("h-3 w-3", companyFilter ? "text-primary" : "text-muted-foreground/40")} /></Button></PopoverTrigger>
                             <PopoverContent className="w-64 p-3" align="start">
                               <div className="space-y-2 text-left">
                                 <Label className="text-[10px] font-black uppercase">Filter Company</Label>
                                 <Input placeholder="Enter company..." value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className="h-8 text-xs" />
                                 {companyFilter && <Button variant="ghost" size="sm" onClick={() => setCompanyFilter("")} className="h-7 w-full text-[10px] font-bold uppercase">Clear</Button>}
                               </div>
                             </PopoverContent>
                           </Popover>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-2">
                           <div className="flex items-center justify-center cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('projectOwnerName')}>
                             <span className="font-black uppercase text-[10px] tracking-widest">Owner</span>
                             <SortIcon column="projectOwnerName" />
                           </div>
                           <Popover>
                             <PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><Filter className={cn("h-3 w-3", ownerFilter ? "text-primary" : "text-muted-foreground/40")} /></Button></PopoverTrigger>
                             <PopoverContent className="w-64 p-3" align="center">
                               <div className="space-y-2 text-left">
                                 <Label className="text-[10px] font-black uppercase">Filter Owner</Label>
                                 <Input placeholder="Enter name..." value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} className="h-8 text-xs" />
                                 {ownerFilter && <Button variant="ghost" size="sm" onClick={() => setOwnerFilter("")} className="h-7 w-full text-[10px] font-bold uppercase">Clear</Button>}
                               </div>
                             </PopoverContent>
                           </Popover>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-2">
                           <div className="flex items-center justify-center cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('workStatus')}>
                             <span className="font-black uppercase text-[10px] tracking-widest">Work Status</span>
                             <SortIcon column="workStatus" />
                           </div>
                           <Popover>
                             <PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><Filter className={cn("h-3 w-3", workStatusFilter !== 'all' ? "text-primary" : "text-muted-foreground/40")} /></Button></PopoverTrigger>
                             <PopoverContent className="w-64 p-3" align="center">
                               <div className="space-y-2 text-left">
                                 <Label className="text-[10px] font-black uppercase">Filter Work Status</Label>
                                 <Select value={workStatusFilter} onValueChange={setWorkStatusFilter}>
                                    <SelectTrigger className="h-8 text-xs font-bold"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all" className="text-xs">All Status</SelectItem>
                                      <SelectItem value="Yet to Start" className="text-xs">Yet to Start</SelectItem>
                                      <SelectItem value="Work in progress" className="text-xs">Work in Progress</SelectItem>
                                      <SelectItem value="Completed" className="text-xs">Completed</SelectItem>
                                      <SelectItem value="Cancelled" className="text-xs">Cancelled</SelectItem>
                                    </SelectContent>
                                 </Select>
                               </div>
                             </PopoverContent>
                           </Popover>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-2">
                           <div className="flex items-center justify-center cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('projectStatus')}>
                             <span className="font-black uppercase text-[10px] tracking-widest">Lifecycle</span>
                             <SortIcon column="projectStatus" />
                           </div>
                           <Popover>
                             <PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><Filter className={cn("h-3 w-3", projectStatusFilter !== 'all' ? "text-primary" : "text-muted-foreground/40")} /></Button></PopoverTrigger>
                             <PopoverContent className="w-64 p-3" align="center">
                               <div className="space-y-2 text-left">
                                 <Label className="text-[10px] font-black uppercase">Filter Registry Status</Label>
                                 <Select value={projectStatusFilter} onValueChange={setProjectStatusFilter}>
                                    <SelectTrigger className="h-8 text-xs font-bold"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all" className="text-xs">All Status</SelectItem>
                                      <SelectItem value="open" className="text-xs">Open</SelectItem>
                                      <SelectItem value="close" className="text-xs">Close</SelectItem>
                                    </SelectContent>
                                 </Select>
                               </div>
                             </PopoverContent>
                           </Popover>
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[160px]">
                        <div className="flex items-center justify-between gap-2">
                           <div className="flex items-center cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('team')}>
                             <span className="font-black uppercase text-[10px] tracking-widest">Team</span>
                             <SortIcon column="team" />
                           </div>
                           <Popover>
                             <PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><Filter className={cn("h-3 w-3", teamFilter ? "text-primary" : "text-muted-foreground/40")} /></Button></PopoverTrigger>
                             <PopoverContent className="w-64 p-3" align="start">
                               <div className="space-y-2 text-left">
                                 <Label className="text-[10px] font-black uppercase">Filter Team Member</Label>
                                 <Input placeholder="Enter username..." value={teamFilter} onChange={e => setTeamFilter(e.target.value)} className="h-8 text-xs" />
                                 {teamFilter && <Button variant="ghost" size="sm" onClick={() => setTeamFilter("")} className="h-7 w-full text-[10px] font-bold uppercase">Clear</Button>}
                               </div>
                             </PopoverContent>
                           </Popover>
                        </div>
                      </TableHead>
                      <TableHead className="text-center font-black uppercase text-[10px] tracking-widest">
                        <div className="flex items-center justify-center cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('acCapacity')}>
                          AC (MW) <SortIcon column="acCapacity" />
                        </div>
                      </TableHead>
                      <TableHead className="text-center font-black uppercase text-[10px] tracking-widest">
                        <div className="flex items-center justify-center cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('dcCapacity')}>
                          DC (MWp) <SortIcon column="dcCapacity" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right px-6 font-black uppercase text-[10px] tracking-widest">Manage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSites.length > 0 ? filteredSites.map((site) => {
                      const isStarred = starredIds.has(site.id);
                      const team = allUsers?.filter(u => u.assignedProjectIds?.includes(site.id)) || [];
                      const siteManagers = team.filter(u => u.role === 'Site Manager').map(u => u.username);
                      const siteEngineers = team.filter(u => u.role === 'Site Engineer').map(u => u.username);

                      return (
                        <TableRow key={site.id} className="hover:bg-muted/5 transition-colors group">
                          <TableCell className="text-center pl-4">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => toggleStar(e, site.id)}>
                              <Star className={cn("h-4 w-4 transition-all", isStarred ? "fill-primary text-primary scale-110" : "text-muted-foreground/30")} />
                            </Button>
                          </TableCell>
                          <TableCell className="px-6 py-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="p-2 bg-primary/10 rounded-sm text-primary shrink-0">
                                {activeTab === 'rooftop' ? <Building2 className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                              </div>
                              <span className="font-bold text-sm text-foreground break-words leading-tight">{site.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60 truncate block">{site.projectCompany}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-foreground">
                               <UserIcon className="h-3 w-3 text-primary/40" />
                               {site.projectOwnerName || "—"}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={cn(
                              "text-[8px] h-5 rounded-sm uppercase font-black border-primary/10",
                              site.workStatus === 'Completed' ? "bg-green-50 text-green-700 border-green-200" :
                              site.workStatus === 'Cancelled' ? "bg-red-50 text-red-700 border-red-200" :
                              site.workStatus === 'Yet to Start' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                              "bg-blue-50 text-blue-700"
                            )}>
                              {site.workStatus || "In Progress"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                             <Badge variant="outline" className={cn(
                               "text-[8px] h-5 font-black uppercase rounded-sm px-1.5 border-none shadow-sm",
                               site.projectStatus === 'close' ? "bg-slate-900 text-white" : "bg-primary text-white"
                             )}>
                               {site.projectStatus || "open"}
                             </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 max-w-[150px]">
                                <div className="flex flex-wrap gap-1">
                                    {siteManagers.map(m => (
                                        <Badge key={m} variant="secondary" className="h-4 px-1 text-[7px] font-black bg-primary/5 text-primary border-none uppercase truncate">{m}</Badge>
                                    ))}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {siteEngineers.map(e => (
                                        <Badge key={e} variant="outline" className="h-4 px-1 text-[7px] font-bold text-muted-foreground border-border uppercase truncate">{e}</Badge>
                                    ))}
                                </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs font-bold text-primary">{formatCapacity(site.acCapacity)}</TableCell>
                          <TableCell className="text-center font-mono text-xs font-bold text-amber-600">{formatCapacity(site.dcCapacity)}</TableCell>
                          <TableCell className="text-right px-6"><Button asChild size="sm" className="h-8 rounded-sm font-black text-[10px] uppercase px-4 bg-primary"><Link href={`/projects/${site.id}`}>Manage Site <ArrowRight className="ml-1.5 h-3 w-3" /></Link></Button></TableCell>
                        </TableRow>
                      );
                    }) : <TableRow><TableCell colSpan={10} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[10px] opacity-20">No matching projects discovered</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }
}
