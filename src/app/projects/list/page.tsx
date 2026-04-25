'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, arrayUnion, arrayRemove } from 'firebase/firestore';
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
  Check
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { isSuperAdmin } from '@/lib/auth-constants';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

type Site = {
  id: string;
  name: string;
  projectCompany: string;
  acCapacity: any;
  dcCapacity: any;
};

type AccessConfig = {
  id: string;
  allowedPageKeys: string[];
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

const formatCapacity = (val: any) => {
  const num = typeof val === 'number' ? val : parseFloat(String(val || 0));
  return isNaN(num) ? "0.000" : num.toFixed(3);
};

export default function ProjectsListPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [showStarredOnly, setShowStarredOnly] = React.useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = React.useState<string[]>([]);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<AccessConfig>(roleConfigsQuery);

  const isSuper = isSuperAdmin(user?.email);
  const isAdmin = isSuper || userProfile?.role === 'Admin';

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites, isLoading: sitesLoading } = useCollection<Site>(sitesQuery);

  const groupsQuery = useMemoFirebase(() => collection(firestore, 'site_groups'), [firestore]);
  const { data: groups, isLoading: groupsLoading } = useCollection<any>(groupsQuery);

  const starredIds = React.useMemo(() => new Set(userProfile?.starredProjectIds || []), [userProfile]);

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
    
    const isOwnDataOnly = userProfile.ownDataOnly !== undefined 
      ? userProfile.ownDataOnly 
      : roleConfigs?.find(c => c.id === userProfile.role)?.ownDataOnly ?? false;

    if (isSuper) return allSites;

    let list = allSites;
    if (isOwnDataOnly) {
      const assignedIds = new Set(userProfile.assignedProjectIds || []);
      list = allSites.filter(s => assignedIds.has(s.id));
    }
    
    return list;
  }, [allSites, userProfile, roleConfigs, isSuper]);

  const filteredSites = React.useMemo(() => {
    let result = accessibleSites.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           s.projectCompany.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStarred = !showStarredOnly || starredIds.has(s.id);
      return matchesSearch && matchesStarred;
    });

    // Apply Group Filtering
    if (selectedGroupIds.length > 0) {
      const allowedSiteIds = new Set<string>();
      groups?.filter(g => selectedGroupIds.includes(g.id)).forEach(g => {
        g.siteIds?.forEach((id: string) => allowedSiteIds.add(id));
      });
      result = result.filter(s => allowedSiteIds.has(s.id));
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [accessibleSites, searchTerm, showStarredOnly, starredIds, selectedGroupIds, groups]);

  const summaryStats = React.useMemo(() => {
    return {
      count: filteredSites.length,
      ac: filteredSites.reduce((sum, s) => sum + (parseFloat(String(s.acCapacity || 0)) || 0), 0),
      dc: filteredSites.reduce((sum, s) => sum + (parseFloat(String(s.dcCapacity || 0)) || 0), 0),
    };
  }, [filteredSites]);

  if (isProfileLoading || sitesLoading || groupsLoading) {
    return (
      <div className="space-y-8 p-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
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

      {/* Analytics Bar - Synchronized with /projects/add layout */}
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
            {/* Group Multi-select Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-11 rounded-sm font-bold border-primary/20 text-primary bg-background shadow-sm px-4 gap-1.5 min-w-[160px]">
                  <Tags className="h-4 w-4" />
                  {selectedGroupIds.length === 0 ? "All Groups" : `${selectedGroupIds.length} Groups`}
                  <ChevronDown className="h-3 w-3 opacity-50 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-0 rounded-sm border-primary/10 shadow-2xl overflow-hidden">
                <div className="bg-primary/5 p-3 border-b">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Organizational Groups</h3>
                </div>
                <ScrollArea className="h-[250px]">
                  <div className="p-2 space-y-1">
                    {groups?.sort((a, b) => a.name.localeCompare(b.name)).map(group => (
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
                    {(!groups || groups.length === 0) && (
                      <div className="p-8 text-center text-[10px] font-black uppercase text-muted-foreground opacity-30">No groups registered</div>
                    )}
                  </div>
                </ScrollArea>
                {selectedGroupIds.length > 0 && (
                  <Button variant="ghost" onClick={() => setSelectedGroupIds([])} className="w-full rounded-none h-9 text-[9px] font-black uppercase text-primary border-t hover:bg-primary/5">Clear Selection</Button>
                )}
              </PopoverContent>
            </Popover>

            <Button 
              variant={showStarredOnly ? "default" : "outline"} 
              size="sm" 
              onClick={() => setShowStarredOnly(!showStarredOnly)}
              className={cn(
                "h-11 rounded-sm font-bold uppercase text-[10px] tracking-widest px-6",
                showStarredOnly ? "" : "text-primary border-primary/20 hover:bg-primary/5"
              )}
            >
              <Star className={cn("h-4 w-4 mr-2", showStarredOnly && "fill-current")} />
              {showStarredOnly ? "Starred View Active" : "View Starred"}
            </Button>
            
            <Button variant="ghost" size="icon" onClick={() => { setSearchTerm(""); setShowStarredOnly(false); setSelectedGroupIds([]); }} className="h-11 w-11 text-muted-foreground rounded-sm">
              <FilterX className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-12 text-center"></TableHead>
                    <TableHead className="px-6 font-black uppercase text-[10px] tracking-widest">Project Description</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest">Company</TableHead>
                    <TableHead className="text-center font-black uppercase text-[10px] tracking-widest">AC Capacity</TableHead>
                    <TableHead className="text-center font-black uppercase text-[10px] tracking-widest">DC Capacity</TableHead>
                    <TableHead className="text-right px-6 font-black uppercase text-[10px] tracking-widest">Management</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSites.length > 0 ? filteredSites.map((site) => {
                    const isStarred = starredIds.has(site.id);
                    return (
                      <TableRow key={site.id} className="hover:bg-muted/5 transition-colors group">
                        <TableCell className="text-center pl-4">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-sm hover:bg-primary/5" 
                            onClick={(e) => toggleStar(e, site.id)}
                            title={isStarred ? "Unstar" : "Star"}
                          >
                            <Star className={cn("h-4 w-4 transition-all", isStarred ? "fill-primary text-primary scale-110" : "text-muted-foreground/30 group-hover:text-primary/40")} />
                          </Button>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-sm text-primary">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <span className="font-bold text-sm text-foreground">{site.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-muted-foreground">{site.projectCompany}</TableCell>
                        <TableCell className="text-center font-mono text-xs font-bold text-primary">
                          {formatCapacity(site.acCapacity)} MW
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs font-bold text-amber-600">
                          {formatCapacity(site.dcCapacity)} MWp
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <Button asChild size="sm" className="h-8 rounded-sm font-black text-[10px] uppercase px-4 bg-primary group-hover:bg-primary/90">
                            <Link href={`/projects/${site.id}`}>
                              Manage Site <ArrowRight className="ml-1.5 h-3 w-3" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[10px] opacity-20">No matching projects discovered</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile-Responsive Card List */}
      <div className="md:hidden space-y-4">
        {filteredSites.length > 0 ? filteredSites.map((site) => {
          const isStarred = starredIds.has(site.id);
          return (
            <Card key={site.id} className="border-primary/10 rounded-sm shadow-sm overflow-hidden" onClick={() => router.push(`/projects/${site.id}`)}>
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-primary/10 rounded-sm text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <h3 className="font-bold text-sm leading-tight text-foreground truncate">{site.name}</h3>
                      <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tight truncate">{site.projectCompany}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-sm" 
                      onClick={(e) => toggleStar(e, site.id)}
                    >
                      <Star className={cn("h-5 w-5 transition-all", isStarred ? "fill-primary text-primary scale-110" : "text-muted-foreground/30")} />
                    </Button>
                    <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-2 bg-muted/30 rounded-sm border border-primary/5">
                    <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest mb-0.5">AC Cap</p>
                    <p className="text-xs font-black text-primary font-mono">{formatCapacity(site.acCapacity)} MW</p>
                  </div>
                  <div className="p-2 bg-muted/30 rounded-sm border border-primary/5">
                    <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest mb-0.5">DC Cap</p>
                    <p className="text-xs font-black text-amber-600 font-mono">{formatCapacity(site.dcCapacity)} MWp</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        }) : (
          <div className="text-center py-12 text-muted-foreground italic bg-muted/5 rounded-sm border-2 border-dashed">
            {showStarredOnly ? "You haven't starred any projects yet." : "No projects found matching your search."}
          </div>
        )}
      </div>
    </div>
  );
}
