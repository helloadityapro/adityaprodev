
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useCollection, useFirestore, useMemoFirebase, useDoc, useUser, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc, orderBy, getDocs } from 'firebase/firestore';
import { MapPin, User, Mail, Smartphone, ShieldCheck, UserCog, Trophy, Award, HardHat, ExternalLink, ChevronRight, X, UserPlus, Check, ChevronsUpDown, Search, Loader2, Building2, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { isSuperAdmin } from '@/lib/auth-constants';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

type UserProfile = {
  id: string;
  username: string;
  email: string;
  mobile: string;
  role: 'Admin' | 'Site Manager' | 'Site Engineer' | 'Driver';
  department?: 'Projects' | 'O&M';
  assignedProjectIds?: string[];
  siteManagerId?: string;
  totalPoints?: number;
  pointsMultiplier?: number;
};

type Site = {
  id: string;
  name: string;
};

interface ViewUserDialogProps {
  user: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewUserDialog({ user, open, onOpenChange }: ViewUserDialogProps) {
  const firestore = useFirestore();
  const { user: authUser } = useUser();
  const { toast } = useToast();

  const [isMappingMode, setIsMappingMode] = React.useState(false);
  const [selectedManagerId, setSelectedManagerId] = React.useState<string | null>(null);
  const [managerSearchQuery, setManagerSearchQuery] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  const currentUserProfileRef = useMemoFirebase(() => authUser ? doc(firestore, 'users', authUser.uid) : null, [firestore, authUser]);
  const { data: currentUserProfile } = useDoc<UserProfile>(currentUserProfileRef);
  
  const isViewerAdmin = isSuperAdmin(authUser?.email) || currentUserProfile?.role === 'Admin';

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const allUsersQuery = useMemoFirebase(() => query(collection(firestore, 'users'), orderBy('totalPoints', 'desc')), [firestore]);
  const { data: allUsers } = useCollection<UserProfile>(allUsersQuery);

  const engineersQuery = useMemoFirebase(() => {
    if (!user || user.role !== 'Site Manager') return null;
    return query(collection(firestore, 'users'), where('siteManagerId', '==', user.id));
  }, [firestore, user]);
  const { data: mappedEngineers } = useCollection<UserProfile>(engineersQuery);

  const managerRef = useMemoFirebase(() => {
    if (!user || user.role !== 'Site Engineer' || !user.siteManagerId) return null;
    return doc(firestore, 'users', user.siteManagerId);
  }, [firestore, user]);
  const { data: mappedManager } = useDoc<UserProfile>(managerRef);

  const potentialManagers = React.useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(u => u.role === 'Admin' || u.role === 'Site Manager');
  }, [allUsers]);

  const filteredManagers = React.useMemo(() => {
    return potentialManagers.filter(m => 
      (m.username || '').toLowerCase().includes(managerSearchQuery.toLowerCase()) ||
      (m.email || '').toLowerCase().includes(managerSearchQuery.toLowerCase())
    );
  }, [potentialManagers, managerSearchQuery]);

  const globalRank = React.useMemo(() => {
    if (!allUsers || !user) return null;
    const index = allUsers.findIndex(u => u.id === user.id);
    return index !== -1 ? index + 1 : null;
  }, [allUsers, user]);

  const assignedSites = React.useMemo(() => {
    if (!allSites || !user) return [];
    
    // Aggregated site visibility for Managers
    const siteIds = new Set<string>(user.assignedProjectIds || []);
    
    if (user.role === 'Site Manager' && mappedEngineers) {
      mappedEngineers.forEach(member => {
        (member.assignedProjectIds || []).forEach(id => siteIds.add(id));
      });
    }

    return allSites.filter(s => siteIds.has(s.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [user, allSites, mappedEngineers]);

  const syncManagerSites = async (managerId: string) => {
    try {
      const q = query(collection(firestore, 'users'), where('siteManagerId', '==', managerId));
      const snap = await getDocs(q);
      
      const allTeamSites = new Set<string>();
      snap.docs.forEach(d => {
          const data = d.data();
          const sites = data.id === user?.id ? (user.assignedProjectIds || []) : (data.assignedProjectIds || []);
          sites.forEach((id: string) => allTeamSites.add(id));
      });

      const managerRef = doc(firestore, 'users', managerId);
      updateDocumentNonBlocking(managerRef, { assignedProjectIds: Array.from(allTeamSites) });
    } catch (e) {
      console.error("Manager inheritance sync failed", e);
    }
  };

  const handleSaveMapping = async () => {
    if (!user || !selectedManagerId) return;
    setIsSaving(true);
    try {
      const userRef = doc(firestore, 'users', user.id);
      updateDocumentNonBlocking(userRef, { 
        siteManagerId: selectedManagerId,
        role: 'Site Engineer'
      });

      await syncManagerSites(selectedManagerId);
      
      toast({ title: 'Mapping Updated', description: 'Reporting structure updated successfully.' });
      setIsMappingMode(false);
      setSelectedManagerId(null);
      setManagerSearchQuery("");
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  React.useEffect(() => {
    if (!open) {
      setIsMappingMode(false);
      setSelectedManagerId(null);
      setManagerSearchQuery("");
    }
  }, [open]);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[950px] w-[95vw] rounded-sm max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl bg-background">
        <DialogHeader className="p-8 pb-6 shrink-0 text-left space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-4 min-w-0 text-left">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-3xl font-black tracking-tighter text-foreground uppercase">
                    {user.username}
                  </DialogTitle>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="rounded-sm font-black uppercase text-[10px] tracking-widest px-2 h-5 bg-primary/10 text-primary border-none">
                      {user.role}
                    </Badge>
                    {user.department && (
                      <Badge variant="outline" className="rounded-sm font-black uppercase text-[10px] tracking-widest px-2 h-5 border-primary/20 text-primary flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> {user.department}
                      </Badge>
                    )}
                  </div>
                </div>
                <DialogDescription className="text-sm font-medium text-muted-foreground/70">
                  User Profile
                </DialogDescription>
              </div>

              <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <span className="text-xs font-semibold">{user.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Smartphone className="h-3.5 w-3.5" />
                  <span className="text-xs font-semibold">{user.mobile || 'N/A'}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-8 pr-8 shrink-0">
              <div className="text-right space-y-0.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Balance</p>
                <p className="text-2xl font-black text-primary tabular-nums">{(user.totalPoints || 0).toFixed(2)}<span className="text-xs font-bold ml-1 text-muted-foreground/40">pts</span></p>
              </div>
              <Separator orientation="vertical" className="h-8 opacity-20" />
              <div className="text-right space-y-0.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Ranking</p>
                <p className="text-2xl font-black text-amber-600 tabular-nums">#{globalRank || '—'}</p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Separator className="opacity-10" />

        <div className="flex-1 overflow-y-auto bg-background custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-0 h-full">
            <div className="md:col-span-2 border-r border-border/50 p-8 space-y-10">
              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 border-b pb-2 text-left">
                  {user.role === 'Site Manager' ? `Team (${mappedEngineers?.length || 0})` : 
                   user.role === 'Site Engineer' ? 'Site Manager' : 'Hierarchy'}
                </h3>
                {user.role === 'Site Engineer' ? (
                  mappedManager ? (
                    <div className="flex items-center justify-between py-3 border-b border-border/30 px-1 hover:bg-primary/[0.02] transition-colors">
                      <div className="flex items-center gap-3">
                        <UserCog className="h-4 w-4 text-primary" />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold uppercase tracking-tight">{mappedManager.username}</span>
                          <span className="text-[9px] text-muted-foreground font-black uppercase">Site Manager</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-start gap-3 px-1">
                      <div className="text-xs italic text-muted-foreground/60 text-left">No supervisor mapped to this engineer.</div>
                      {isViewerAdmin && (
                        !isMappingMode ? (
                          <Button variant="outline" size="sm" onClick={() => setIsMappingMode(true)} className="h-8 rounded-sm font-bold border-primary/20 text-primary hover:bg-primary/5 px-4 text-[10px] uppercase tracking-wider">
                            <UserPlus className="h-3 w-3 mr-1.5" /> Add Reporting Manager
                          </Button>
                        ) : (
                          <div className="w-full space-y-4 p-4 border rounded-sm bg-primary/5 border-primary/10 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="space-y-3">
                              <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Assign Supervisor</Label>
                              <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-primary opacity-50" />
                                <Input 
                                  placeholder="Search name or email..." 
                                  className="pl-9 h-10 rounded-sm bg-background border-primary/20 text-sm"
                                  value={managerSearchQuery}
                                  onChange={(e) => setManagerSearchQuery(e.target.value)}
                                  autoFocus
                                />
                              </div>
                              
                              {managerSearchQuery.length > 0 && (
                                <div className="border rounded-sm bg-background shadow-md overflow-hidden">
                                  <ScrollArea className="h-[180px]">
                                    <div className="p-1">
                                      {filteredManagers.length > 0 ? (
                                        filteredManagers.map(m => (
                                          <Button 
                                            key={m.id} 
                                            variant="ghost" 
                                            className={cn(
                                              "w-full justify-start h-11 text-xs rounded-sm font-medium border-b border-border/10 last:border-0",
                                              selectedManagerId === m.id && "bg-primary/10 text-primary"
                                            )} 
                                            onClick={() => setSelectedManagerId(m.id)}
                                          >
                                            <Check className={cn("mr-2 h-3.5 w-3.5 text-primary shrink-0", selectedManagerId === m.id ? "opacity-100" : "opacity-0")} />
                                            <div className="flex flex-col items-start overflow-hidden text-left min-w-0">
                                              <span className="truncate font-bold text-foreground">{m.username}</span>
                                              <span className="text-[9px] text-muted-foreground uppercase truncate w-full">{m.email}</span>
                                            </div>
                                          </Button>
                                        ))
                                      ) : (
                                        <p className="p-4 text-center text-[10px] text-muted-foreground italic uppercase font-bold tracking-tighter">No matching supervisors</p>
                                      )}
                                    </div>
                                  </ScrollArea>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex gap-2">
                              <Button size="sm" className="h-10 text-[10px] font-black uppercase tracking-widest flex-1 shadow-md" onClick={handleSaveMapping} disabled={!selectedManagerId || isSaving}>
                                {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <ShieldCheck className="h-3 w-3 mr-1.5" />} Confirm Link
                              </Button>
                              <Button size="sm" variant="ghost" className="h-10 text-[10px] font-bold uppercase tracking-widest" onClick={() => { setIsMappingMode(false); setManagerSearchQuery(""); setSelectedManagerId(null); }} disabled={isSaving}>Cancel</Button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )
                ) : user.role === 'Site Manager' ? (
                  <div className="space-y-px bg-border/20 border border-border/20 rounded-sm overflow-hidden">
                    {mappedEngineers?.map(eng => (
                      <div key={eng.id} className="flex items-center justify-between py-3 px-4 bg-background hover:bg-primary/[0.01] transition-colors">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-foreground truncate">{eng.username}</span>
                          <span className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter">{eng.email}</span>
                        </div>
                        <Badge variant="outline" className="text-[8px] h-4 rounded-sm border-primary/20 text-primary font-black bg-primary/5 px-1.5 uppercase">Engineer</Badge>
                      </div>
                    ))}
                    {!mappedEngineers?.length && (
                      <div className="p-8 text-center flex flex-col items-center gap-4 bg-muted/5">
                        <div className="text-xs italic text-muted-foreground/60 text-left">No personnel currently report to this manager.</div>
                        {isViewerAdmin && (
                          <Button variant="outline" size="sm" asChild className="h-8 rounded-sm font-bold border-primary/20 text-primary hover:bg-primary/5 px-4 text-[10px] uppercase tracking-wider">
                            <Link href="/settings/teams">
                              <UserPlus className="h-3 w-3 mr-1.5" /> Assign Team Members
                            </Link>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ) : user.role === 'Driver' ? (
                  <div className="flex items-center gap-2 px-1">
                    <Truck className="h-4 w-4 text-primary" />
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Organizational Logistics Personnel</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-1">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">System Administration Access</span>
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-3 p-8 bg-muted/[0.02]">
              <div className="space-y-6">
                <div className="border-b pb-2">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 text-left">
                    SITES ({assignedSites.length})
                  </h3>
                </div>
                
                {assignedSites.length > 0 ? (
                  <div className="grid gap-px bg-border/20 border border-border/20 rounded-sm overflow-hidden shadow-sm">
                    {assignedSites.map(site => {
                      const assignedEng = user.role === 'Site Manager' 
                          ? mappedEngineers?.find(eng => eng.assignedProjectIds?.includes(site.id))
                          : null;

                      return (
                        <div key={site.id} className="flex items-center justify-between p-4 bg-background hover:bg-primary/[0.01] transition-colors group">
                          <div className="flex flex-col gap-1 min-w-0 text-left">
                            <span className="font-bold text-sm tracking-tight text-foreground group-hover:text-primary transition-colors">{site.name}</span>
                            {assignedEng && (
                              <div className="flex items-center gap-1.5 text-[9px] font-black text-muted-foreground uppercase">
                                <User className="h-2.5 w-2.5 opacity-50 text-primary" />
                                <span className="opacity-60">Team Lead:</span>
                                <span className="text-foreground/80 font-bold">{assignedEng.username}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-mono text-muted-foreground/40 group-hover:text-primary/40 transition-colors uppercase">{site.id.slice(0, 8)}</span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground/20 group-hover:text-primary transition-all group-hover:translate-x-0.5" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-32 text-center border-2 border-dashed border-border/40 rounded-sm">
                    <MapPin className="h-10 w-10 text-muted-foreground/10 mb-4" />
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Zero Site Assignments</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <Separator className="opacity-10" />

        <div className="p-4 px-8 bg-muted/[0.02] flex justify-end shrink-0">
          <DialogClose asChild>
            <Button type="button" variant="ghost" className="rounded-sm font-black uppercase text-[10px] h-9 px-8 tracking-widest text-muted-foreground hover:text-foreground">
              CLOSE
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
