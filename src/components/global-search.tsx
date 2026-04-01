'use client';

import * as React from 'react';
import { 
  Search, 
  FileText, 
  CheckSquare, 
  Package, 
  ArrowLeftRight, 
  User, 
  MapPin, 
  Loader2, 
  Command as CommandIcon,
  X,
  FileCheck,
  Table as TableIcon,
  TrendingUp
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, getDocs, limit, doc, orderBy } from 'firebase/firestore';
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

type SearchResult = {
  id: string;
  type: 'Permit' | 'Task' | 'Site' | 'User' | 'DPR' | 'Movement';
  title: string;
  subtitle: string;
  link: string;
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

export function GlobalSearch() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [selectedUserForView, setSelectedUserForView] = React.useState<any>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<AccessConfig>(roleConfigsQuery);

  // Pre-fetch all sites for instant searching and guaranteed visibility
  // We use a high limit to ensure "all sites" are indeed captured in the index
  const sitesQuery = useMemoFirebase(() => query(collection(firestore, 'sites'), limit(1000)), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  // Keyboard shortcut listener
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Debounced search trigger
  React.useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        performSearch(searchQuery.trim().toLowerCase());
      } else {
        setResults([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen]);

  /**
   * Perform search across local index (Sites) and remote collections (Permits, Tasks, etc.)
   */
  const performSearch = async (term: string) => {
    setIsSearching(true);
    
    // 1. Instant local search for Sites (Guarantees visibility of all authorized sites)
    const siteResults: SearchResult[] = [];
    if (allSites && userProfile) {
      const isOwnDataOnly = userProfile.ownDataOnly !== undefined 
        ? userProfile.ownDataOnly 
        : roleConfigs?.find(c => c.id === userProfile.role)?.ownDataOnly ?? false;

      const assignedIds = new Set(userProfile.assignedProjectIds || []);

      allSites.forEach(s => {
        // Apply Data Sovereignty Access Control
        const isAuthorized = isAdmin || !isOwnDataOnly || assignedIds.has(s.id);
        if (!isAuthorized) return;

        if (s.name.toLowerCase().includes(term) || s.projectCompany.toLowerCase().includes(term)) {
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

    // 2. Fetch results from more dynamic/growing collections
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
          
          // Apply Access Control for non-admins if data sovereignty is active
          if (!isAdmin && userProfile) {
            const isOwnDataOnly = userProfile.ownDataOnly !== undefined 
              ? userProfile.ownDataOnly 
              : roleConfigs?.find(c => c.id === userProfile.role)?.ownDataOnly ?? false;

            if (isOwnDataOnly) {
              const siteId = data.siteId;
              const assignedIds = new Set(userProfile.assignedProjectIds || []);
              if (siteId && !assignedIds.has(siteId)) return;
            }
          }

          const isMatch = fields.some(field => {
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
                subtitle = `${data.siteName} • ${data.ptwType} • ${data.status}`;
                link = `/ptw/list?view=${d.id}`;
                break;
              case 'Task':
                title = data.title;
                subtitle = `Site: ${data.siteName} • Status: ${data.status}`;
                link = `/tasks/list`;
                break;
              case 'DPR':
                title = `DPR: ${data.siteName}`;
                subtitle = `By: ${data.userName} • Date: ${data.reportDate || 'N/A'}`;
                link = `/dpr/list`;
                break;
              case 'Movement':
                title = data.itemName;
                subtitle = `${data.movementType} at ${data.siteName} • ${data.quantity} ${data.unit}`;
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
        console.error(`Search failed in ${collName}:`, e);
      }
    };

    // Parallel search for speed
    Promise.allSettled([
      searchCollection('permits_to_work', 'Permit', ['serialNumber', 'siteName', 'ptwType'], 150),
      searchCollection('tasks', 'Task', ['title', 'siteName', 'assignedToName'], 100),
      searchCollection('dprs', 'DPR', ['siteName', 'description', 'userName'], 50),
      searchCollection('material_movements', 'Movement', ['itemName', 'siteName', 'sourceOrDestination'], 50),
      isAdmin ? searchCollection('users', 'User', ['username', 'email'], 200) : Promise.resolve()
    ]).finally(() => {
      setIsSearching(false);
    });
  };

  const navigateTo = (result: SearchResult) => {
    setIsOpen(false);
    setSearchQuery('');
    setResults([]);
    
    if (result.type === 'User') {
      setSelectedUserForView(result.userData);
    } else {
      router.push(result.link);
    }
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
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl rounded-sm">
          <DialogHeader className="p-4 border-b bg-muted/5">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              <DialogTitle className="text-sm font-bold uppercase tracking-widest text-primary">Global Search</DialogTitle>
            </div>
          </DialogHeader>
          
          <div className="p-4 bg-background">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="Type to find anything..." 
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
            ) : searchQuery.length >= 2 && !isSearching ? (
              <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                <Search className="h-12 w-12 opacity-10 mb-4" />
                <p className="text-sm font-medium">No results found</p>
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
