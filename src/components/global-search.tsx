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
  FileCheck
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit, or, orderBy, startAt, endAt, doc } from 'firebase/firestore';
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
import { Button } from './ui/button';
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
  const { data: userProfile } = useDoc(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  // Shortcut key listener
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

  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    if (val.trim().length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const term = val.toLowerCase();
    const searchResults: SearchResult[] = [];

    try {
      // 1. Search Sites
      const sitesSnap = await getDocs(collection(firestore, 'sites'));
      sitesSnap.docs.forEach(d => {
        const data = d.data();
        if (data.name?.toLowerCase().includes(term) || data.projectCompany?.toLowerCase().includes(term)) {
          searchResults.push({
            id: d.id,
            type: 'Site',
            title: data.name,
            subtitle: data.projectCompany,
            link: `/documents/${d.id}`
          });
        }
      });

      // 2. Search Permits (Increased limit for better discovery)
      const permitsSnap = await getDocs(query(collection(firestore, 'permits_to_work'), limit(100)));
      permitsSnap.docs.forEach(d => {
        const data = d.data();
        if (data.serialNumber?.toLowerCase().includes(term) || data.siteName?.toLowerCase().includes(term)) {
          searchResults.push({
            id: d.id,
            type: 'Permit',
            title: data.serialNumber || `Permit ${d.id.slice(0, 8)}`,
            subtitle: `${data.siteName} • ${data.ptwType}`,
            link: `/ptw/list?view=${d.id}`
          });
        }
      });

      // 3. Search Tasks (Increased limit for better discovery)
      const tasksSnap = await getDocs(query(collection(firestore, 'tasks'), limit(100)));
      tasksSnap.docs.forEach(d => {
        const data = d.data();
        if (data.title?.toLowerCase().includes(term) || data.siteName?.toLowerCase().includes(term)) {
          searchResults.push({
            id: d.id,
            type: 'Task',
            title: data.title,
            subtitle: `Task at ${data.siteName} • ${data.status}`,
            link: `/tasks/list`
          });
        }
      });

      // 4. Search Users (Personnel search enabled for all logged in users)
      // Increased limit to 500 to ensure almost all personnel are searchable in memory
      const usersSnap = await getDocs(query(collection(firestore, 'users'), limit(500)));
      usersSnap.docs.forEach(d => {
        const data = d.data();
        if (data.username?.toLowerCase().includes(term) || data.email?.toLowerCase().includes(term)) {
          searchResults.push({
            id: d.id,
            type: 'User',
            title: data.username || 'N/A',
            subtitle: `${data.role} • ${data.email}`,
            link: `/settings/users`,
            userData: { id: d.id, ...data }
          });
        }
      });

      setResults(searchResults.slice(0, 50));
    } catch (e) {
      console.error("Search failed", e);
    } finally {
      setIsSearching(false);
    }
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
      default: return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <>
      <div 
        onClick={() => setIsOpen(true)}
        className="relative w-full max-w-[200px] lg:max-w-md group cursor-pointer"
      >
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        <div className="flex h-9 w-full rounded-sm border border-input bg-muted/50 px-9 py-2 text-xs text-muted-foreground transition-all group-hover:bg-accent group-hover:border-primary/20 items-center justify-between">
          <span>Search everything...</span>
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
              <DialogTitle className="text-sm font-bold uppercase tracking-widest text-primary">Global Platform Search</DialogTitle>
            </div>
          </DialogHeader>
          
          <div className="p-4 bg-background">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="Search by serial, site, name or email..." 
                className="pl-10 h-12 text-lg rounded-sm border-primary/20 focus-visible:ring-primary/30"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                autoFocus
              />
              {isSearching && (
                <div className="absolute right-3 top-3.5">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}
            </div>
          </div>

          <ScrollArea className="max-h-[450px]">
            {results.length > 0 ? (
              <div className="p-2 space-y-4 pb-6">
                {['Site', 'User', 'Permit', 'Task'].map((category) => {
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
                <p className="text-sm font-medium">No records found for "{searchQuery}"</p>
                <p className="text-xs uppercase font-bold tracking-tighter mt-1">Try searching for a Site Name or Serial Number</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground/40 italic">
                <CommandIcon className="h-12 w-12 opacity-10 mb-4" />
                <p className="text-sm font-medium">Start typing to search across Aditya Pro...</p>
              </div>
            )}
          </ScrollArea>

          <div className="p-3 border-t bg-muted/5 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
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
