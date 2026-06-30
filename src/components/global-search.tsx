'use client';

import * as React from 'react';
import { 
  Search, 
  FileText, 
  CheckSquare, 
  ArrowLeftRight, 
  User, 
  MapPin, 
  Loader2, 
  Command as CommandIcon,
  FileCheck,
  Table as TableIcon,
  Tags,
  Check,
  ChevronDown
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, getDocs, limit, doc } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { isSuperAdmin } from '@/lib/auth-constants';
import { ViewUserDialog } from './view-user-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { slugifyRole } from '@/lib/access-control';

type SearchResult = {
  id: string;
  type: 'Permit' | 'Task' | 'Site' | 'User' | 'DPR' | 'Movement';
  title: string;
  subtitle: string;
  link: string;
  siteId?: string;
  userData?: any;
};

type Site = {
  id: string;
  name: string;
  projectCompany: string;
};

type AccessConfig = {
  id: string;
  ownDataOnly?: boolean;
};

type MappingOverride = {
  id: string;
  engineerId: string;
  siteId: string;
  managerId: string;
};

export function GlobalSearch() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [selectedUserForView, setSelectedUserForView] = React.useState<any>(null);
  
  const [selectedGroupIds, setSelectedGroupIds] = React.useState<string[]>([]);

  // DEFERRED DATA FETCHING: Only fetch these when search is actually relevant
  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<AccessConfig>(roleConfigsQuery);

  const sitesQuery = useMemoFirebase(() => query(collection(firestore, 'sites'), limit(1000)), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const groupsQuery = useMemoFirebase(() => collection(firestore, 'site_groups'), [firestore]);
  const { data: groups } = useCollection<any>(groupsQuery);

  const overridesQuery = useMemoFirebase(() => collection(firestore, 'team_mapping_overrides'), [firestore]);
  const { data: allOverrides } = useCollection<MappingOverride>(overridesQuery);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const teamQuery = useMemoFirebase(() => {
    if (!isManager || !user) return null;
    return query(collection(firestore, 'users'), where('siteManagerId', '==', user.uid));
  }, [firestore, user, isManager]);
  const { data: teamMembers } = useCollection<any>(teamQuery);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.addEventListener('keydown', down);
  }, []);

  React.useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2 || selectedGroupIds.length > 0) {
        performSearch(searchQuery.trim().toLowerCase());
      } else {
        setResults([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, selectedGroupIds]);

  const performSearch = async (term: string) => {
    setIsSearching(true);
    
    let allowedSiteIdsFromGroups: Set<string> | null = null;
    if (selectedGroupIds.length > 0 && groups) {
      allowedSiteIdsFromGroups = new Set();
      groups.filter(g => selectedGroupIds.includes(g.id)).forEach(g => {
        g.siteIds?.forEach((id: string) => allowedSiteIdsFromGroups!.add(id));
      });
    }

    const accessibleIds = new Set<string>();
    if (allSites && userProfile) {
      if (isAdmin) {
        allSites.forEach(s => accessibleIds.add(s.id));
      } else {
        const isOwnDataOnly = userProfile.ownDataOnly !== undefined 
          ? userProfile.ownDataOnly 
          : roleConfigs?.find(c => c.id === slugifyRole(userProfile.role || ""))?.ownDataOnly ?? false;

        if (isOwnDataOnly) {
          if (isManager) {
            allOverrides?.filter(o => o.managerId === userProfile.id).forEach(o => accessibleIds.add(o.siteId));
            teamMembers?.forEach(member => {
              (member.assignedProjectIds || []).forEach(sid => {
                const otherOverride = allOverrides?.some(o => o.engineerId === member.id && o.siteId === sid && o.managerId !== userProfile.id);
                if (!otherOverride) accessibleIds.add(sid);
              });
            });
          } else {
            (userProfile.assignedProjectIds || []).forEach(id => accessibleIds.add(id));
          }
        } else {
          allSites.forEach(s => accessibleIds.add(s.id));
        }
      }
    }

    const siteResults: SearchResult[] = [];
    if (allSites) {
      allSites.forEach(s => {
        if (!accessibleIds.has(s.id)) return;
        const matchesGroup = !allowedSiteIdsFromGroups || allowedSiteIdsFromGroups.has(s.id);
        if (!matchesGroup) return;

        if (!term || s.name.toLowerCase().includes(term) || s.projectCompany.toLowerCase().includes(term)) {
          siteResults.push({
            id: s.id,
            type: 'Site',
            title: s.name,
            subtitle: `${s.projectCompany} • Site ID: ${s.id.slice(0, 8)}`,
            link: `/projects/${s.id}`
          });
        }
      });
    }

    setResults(siteResults);

    const searchCollection = async (
      collName: string, 
      type: SearchResult['type'], 
      fields: string[], 
      limitCount: number = 100
    ) => {
      try {
        const q = query(collection(firestore, collName), limit(limitCount));
        const snap = await getDocs(q);
        
        const matches: SearchResult[] = [];
        snap.docs.forEach(d => {
          const data = d.data();
          const siteId = data.siteId;

          if (!isAdmin && siteId && !accessibleIds.has(siteId)) return;
          if (allowedSiteIdsFromGroups && siteId && !allowedSiteIdsFromGroups.has(siteId)) return;

          const isMatch = !term || fields.some(field => {
            const val = data[field];
            return typeof val === 'string' && val.toLowerCase().includes(term);
          }) || d.id.toLowerCase().includes(term);

          if (isMatch) {
            let title = '';
            let subtitle = '';
            let link = '';
            let userData = null;

            switch (type) {
              case 'Permit':
                title = data.serialNumber || `Permit ${d.id.slice(0, 8)}`;
                subtitle = `${data.siteName} • ${data.ptwType}`;
                link = `/ptw/list?view=${d.id}`;
                break;
              case 'Task':
                title = data.title;
                subtitle = `Site: ${data.siteName} • Status: ${data.status}`;
                link = `/tasks/list`;
                break;
              case 'DPR':
                title = `DPR: ${data.siteName}`;
                subtitle = `By: ${data.userName} • ${data.reportDate}`;
                link = `/dpr/list`;
                break;
              case 'Movement':
                title = data.itemName;
                subtitle = `${data.movementType} at ${data.siteName}`;
                link = `/movements/list`;
                break;
              case 'User':
                title = data.username || 'N/A';
                subtitle = `${data.role} • ${data.email}`;
                link = `/settings/users`;
                userData = { id: d.id, ...data };
                break;
            }

            matches.push({ id: d.id, type, title, subtitle, link, userData });
          }
        });

        if (matches.length > 0) {
          setResults(prev => {
            const existingIds = new Set(prev.map(r => r.id));
            const newOnes = matches.filter(m => !existingIds.has(m.id));
            return [...prev, ...newOnes];
          });
        }
      } catch (e) {
        console.error(`Search failed:`, e);
      }
    };

    Promise.allSettled([
      searchCollection('permits_to_work', 'Permit', ['serialNumber', 'siteName', 'ptwType'], 100),
      searchCollection('tasks', 'Task', ['title', 'siteName', 'assignedToName'], 100),
      searchCollection('dprs', 'DPR', ['siteName', 'description', 'userName'], 50),
      searchCollection('material_movements', 'Movement', ['itemName', 'siteName', 'sourceOrDestination'], 50),
      isAdmin && !allowedSiteIdsFromGroups ? searchCollection('users', 'User', ['username', 'email'], 100) : Promise.resolve()
    ]).finally(() => {
      setIsSearching(false);
    });
  };

  const navigateTo = (result: SearchResult) => {
    setIsOpen(false);
    setSearchQuery('');
    setResults([]);
    if (result.type === 'User') setSelectedUserForView(result.userData);
    else router.push(result.link);
  };

  const getTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'Permit': return <FileCheck className="h-4 w-4 text-blue-500" />;
      case 'Task': return <CheckSquare className="h-4 w-4 text-slate-500" />;
      case 'Site': return <MapPin className="h-4 w-4 text-primary" />;
      case 'User': return <User className="h-4 w-4 text-purple-500" />;
      case 'DPR': return <TableIcon className="h-4 w-4 text-amber-500" />;
      case 'Movement': return <ArrowLeftRight className="h-4 w-4 text-emerald-500" />;
      default: return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <>
      <div 
        onClick={() => setIsOpen(true)}
        className="relative w-full max-w-md group cursor-pointer"
      >
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        <div className="flex h-9 w-full rounded-md border border-input bg-muted/50 px-9 py-2 text-xs text-muted-foreground transition-all group-hover:bg-accent group-hover:border-primary/20 items-center justify-between">
          <span className="truncate">
            <span className="hidden xs:inline">Search sites, permits, tasks...</span>
            <span className="xs:hidden">Search...</span>
          </span>
          <kbd className="pointer-none hidden h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">K</span>
          </kbd>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl rounded-sm">
          <DialogHeader className="p-4 border-b bg-muted/5 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              <DialogTitle className="text-sm font-bold uppercase tracking-widest text-primary">Command Center</DialogTitle>
            </div>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 rounded-sm font-black uppercase text-[9px] tracking-widest gap-1.5 border border-primary/10">
                  <Tags className="h-3 w-3" />
                  {selectedGroupIds.length === 0 ? "Global Scope" : `${selectedGroupIds.length} Groups Active`}
                  <ChevronDown className="h-3 w-3 opacity-50 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-0 rounded-sm border-primary/10 shadow-2xl">
                <div className="bg-primary/5 p-3 border-b">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Filter results by group</h3>
                </div>
                <ScrollArea className="h-[200px]">
                  <div className="p-2 space-y-1">
                    {groups?.map(group => (
                      <div 
                        key={group.id} 
                        className={cn(
                          "flex items-center space-x-2 p-2 rounded-sm hover:bg-muted/50 transition-colors cursor-pointer",
                          selectedGroupIds.includes(group.id) && "bg-primary/10"
                        )}
                        onClick={() => setSelectedGroupIds(prev => prev.includes(group.id) ? prev.filter(id => id !== group.id) : [...prev, group.id])}
                      >
                        <Checkbox checked={selectedGroupIds.includes(group.id)} />
                        <span className="text-[11px] font-bold uppercase truncate">{group.name}</span>
                      </div>
                    ))}
                    {(!groups || groups.length === 0) && (
                      <p className="p-4 text-center text-[10px] uppercase font-bold text-muted-foreground opacity-30">No groups registered</p>
                    )}
                  </div>
                </ScrollArea>
                {selectedGroupIds.length > 0 && (
                  <Button variant="ghost" onClick={() => setSelectedGroupIds([])} className="w-full rounded-none h-8 text-[9px] font-black uppercase text-primary border-t">Reset Filter</Button>
                )}
              </PopoverContent>
            </Popover>
          </DialogHeader>
          
          <div className="p-4 bg-background">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder={selectedGroupIds.length > 0 ? "Searching within selected groups..." : "Type to find anything..."} 
                className="pl-10 h-12 text-base rounded-sm border-primary/20 focus-visible:ring-primary/30"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {isSearching && (
                <div className="absolute right-3 top-3.5">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}
            </div>
          </div>

          <ScrollArea className="max-h-[60vh] md:max-h-[450px]">
            {results.length > 0 ? (
              <div className="p-2 space-y-4 pb-6">
                {['Site', 'User', 'Permit', 'Task', 'DPR', 'Movement'].map((category) => {
                  const catResults = results.filter(r => r.type === category);
                  if (catResults.length === 0) return null;

                  return (
                    <div key={category} className="space-y-1">
                      <div className="px-3 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                        <span>{category}s</span>
                        <Badge variant="outline" className="h-4 px-1.5 text-[8px] border-primary/10">{catResults.length}</Badge>
                      </div>
                      <div className="space-y-0.5">
                        {catResults.map((result) => (
                          <button
                            key={result.id}
                            onClick={() => navigateTo(result)}
                            className="w-full flex items-center gap-3 p-3 text-left rounded-sm hover:bg-primary/5 transition-colors group"
                          >
                            <div className="p-2 bg-muted rounded-sm group-hover:bg-primary/10 transition-colors">
                              {getTypeIcon(result.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm truncate group-hover:text-primary transition-colors">{result.title}</p>
                              <p className="text-[10px] text-muted-foreground uppercase font-medium truncate">{result.subtitle}</p>
                            </div>
                            <Badge variant="secondary" className="text-[8px] font-black uppercase rounded-sm bg-muted group-hover:bg-primary group-hover:text-white transition-colors">View</Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (searchQuery.length >= 2 || selectedGroupIds.length > 0) && !isSearching ? (
              <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                <Search className="h-12 w-12 opacity-10 mb-4" />
                <p className="text-sm font-medium">No results found</p>
                <p className="text-[10px] font-bold uppercase mt-2 opacity-50">Try adjusting your keyword or group filter</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground/40">
                <CommandIcon className="h-12 w-12 opacity-10 mb-4" />
                <p className="text-sm font-medium italic">Start typing to search...</p>
              </div>
            )}
          </ScrollArea>

          <div className="p-3 border-t bg-muted/5 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 hidden sm:flex">
            <div className="flex gap-4">
              <span className="flex items-center gap-1"><kbd className="border px-1 rounded bg-background">↵</kbd> Select</span>
              <span className="flex items-center gap-1"><kbd className="border px-1 rounded bg-background">↑↓</kbd> Navigate</span>
            </div>
            <span className="flex items-center gap-1"><kbd className="border px-1 rounded bg-background">ESC</kbd> Close</span>
          </div>
        </DialogContent>
      </Dialog>

      <ViewUserDialog 
        user={selectedUserForView} 
        open={!!selectedUserForView} 
        onOpenChange={(o) => !o && setSelectedUserForView(null)} 
      />
    </>
  );
}
