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
  Star
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { isSuperAdmin } from '@/lib/auth-constants';
import { cn } from '@/lib/utils';

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

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<AccessConfig>(roleConfigsQuery);

  const isSuper = isSuperAdmin(user?.email);
  const isAdmin = isSuper || userProfile?.role === 'Admin';

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites, isLoading: sitesLoading } = useCollection<Site>(sitesQuery);

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

    // Super Admins bypass data sovereignty
    if (isSuper) return allSites;

    let list = allSites;
    if (isOwnDataOnly) {
      const assignedIds = new Set(userProfile.assignedProjectIds || []);
      list = allSites.filter(s => assignedIds.has(s.id));
    }
    
    return list;
  }, [allSites, userProfile, roleConfigs, isSuper]);

  const filteredSites = React.useMemo(() => {
    return accessibleSites
      .filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             s.projectCompany.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStarred = !showStarredOnly || starredIds.has(s.id);
        return matchesSearch && matchesStarred;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [accessibleSites, searchTerm, showStarredOnly, starredIds]);

  if (isProfileLoading || sitesLoading) {
    return (
      <div className="space-y-8 p-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2">
          <Briefcase className="h-8 w-8 text-primary" /> Project Management
        </h1>
        <p className="text-muted-foreground text-sm font-medium">Monitoring site assets, Bill of Materials, and inventory compliance.</p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
        <div className="flex items-center gap-3 flex-1 w-full md:w-auto">
          <div className="relative flex-1 md:w-96">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search project or company..." 
              className="pl-10 h-10 text-sm rounded-sm border-primary/20 bg-background"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button 
            variant={showStarredOnly ? "default" : "outline"} 
            size="sm" 
            onClick={() => setShowStarredOnly(!showStarredOnly)}
            className={cn(
              "h-10 rounded-sm font-bold uppercase text-[10px] tracking-widest px-4",
              showStarredOnly ? "" : "text-primary border-primary/20 hover:bg-primary/5"
            )}
          >
            <Star className={cn("h-3.5 w-3.5 mr-1.5", showStarredOnly && "fill-current")} />
            {showStarredOnly ? "Starred Only" : "View Starred"}
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-sm font-black uppercase text-[10px] tracking-widest px-3 h-8 border-none">
            {filteredSites.length} {showStarredOnly ? 'Starred Projects' : 'Projects Authorized'}
          </Badge>
          <Button variant="ghost" size="icon" onClick={() => { setSearchTerm(""); setShowStarredOnly(false); }} className="h-10 w-10 text-muted-foreground rounded-sm">
            <FilterX className="h-4 w-4" />
          </Button>
        </div>
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

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-12 text-center"></TableHead>
                    <TableHead className="px-6">Project Name</TableHead>
                    <TableHead>Parent Company</TableHead>
                    <TableHead className="text-center">AC Capacity</TableHead>
                    <TableHead className="text-center">DC Capacity</TableHead>
                    <TableHead className="text-right px-6">Management</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSites.map((site) => {
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
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
