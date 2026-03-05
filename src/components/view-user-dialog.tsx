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
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc, orderBy } from 'firebase/firestore';
import { MapPin, User, Mail, Smartphone, ShieldCheck, UserCog, Trophy, Award, HardHat, ExternalLink, ChevronRight, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

type UserProfile = {
  id: string;
  username: string;
  email: string;
  mobile: string;
  role: 'Admin' | 'Site Manager' | 'Site Engineer';
  assignedProjectIds?: string[];
  siteManagerId?: string;
  totalPoints?: number;
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

  const globalRank = React.useMemo(() => {
    if (!allUsers || !user) return null;
    const index = allUsers.findIndex(u => u.id === user.id);
    return index !== -1 ? index + 1 : null;
  }, [allUsers, user]);

  const assignedSites = React.useMemo(() => {
    if (!user?.assignedProjectIds || !allSites) return [];
    return allSites.filter(s => user.assignedProjectIds?.includes(s.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [user, allSites]);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[950px] w-[95vw] rounded-sm max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl bg-background">
        <DialogHeader className="p-8 pb-6 shrink-0 text-left space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-4 min-w-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-3xl font-black tracking-tighter text-foreground uppercase">
                    {user.username}
                  </DialogTitle>
                  <Badge variant="secondary" className="rounded-sm font-black uppercase text-[10px] tracking-widest px-2 h-5 bg-primary/10 text-primary border-none">
                    {user.role}
                  </Badge>
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
            
            <div className="flex items-center gap-8 pr-8">
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

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-background">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-0 h-full">
            <div className="md:col-span-2 border-r border-border/50 p-8 space-y-10">
              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 border-b pb-2">
                  {user.role === 'Site Manager' ? `Team (${mappedEngineers?.length || 0})` : 
                   user.role === 'Site Engineer' ? 'Reporting Manager' : 'Hierarchy'}
                </h3>
                {user.role === 'Site Engineer' ? (
                  mappedManager ? (
                    <div className="flex items-center gap-3 p-3 rounded-sm border border-primary/10 bg-primary/[0.02]">
                      <UserCog className="h-4 w-4 text-primary" />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold uppercase tracking-tight">{mappedManager.username}</span>
                        <span className="text-[9px] text-muted-foreground font-black uppercase">Reporting Manager</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs italic text-muted-foreground/60 px-1">No supervisor mapped to this engineer.</div>
                  )
                ) : user.role === 'Site Manager' ? (
                  <div className="space-y-1">
                    {mappedEngineers?.map(eng => (
                      <div key={eng.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0 hover:bg-muted/20 px-1 transition-colors">
                        <span className="text-xs font-bold truncate pr-4">{eng.username}</span>
                        <Badge variant="outline" className="text-[8px] h-4 rounded-sm border-muted-foreground/20 text-muted-foreground font-black">ENG</Badge>
                      </div>
                    ))}
                    {!mappedEngineers?.length && <div className="text-xs italic text-muted-foreground/60">No engineers reporting.</div>}
                  </div>
                ) : (
                  <div className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest px-1">System Administration</div>
                )}
              </div>
            </div>

            <div className="md:col-span-3 p-8 bg-muted/[0.02]">
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Authorized Assets</h3>
                  <Badge variant="outline" className="h-5 rounded-full px-2 text-[9px] font-black border-primary/20 text-primary bg-primary/5">{assignedSites.length} LOCATIONS</Badge>
                </div>
                
                {assignedSites.length > 0 ? (
                  <div className="grid gap-px bg-border/20 border border-border/20 rounded-sm overflow-hidden shadow-sm">
                    {assignedSites.map(site => {
                      const assignedEng = user.role === 'Site Manager' 
                          ? mappedEngineers?.find(eng => eng.assignedProjectIds?.includes(site.id))
                          : null;

                      return (
                        <div key={site.id} className="flex items-center justify-between p-4 bg-background hover:bg-primary/[0.01] transition-colors group">
                          <div className="flex flex-col gap-1.5 min-w-0">
                            <span className="font-bold text-sm tracking-tight text-foreground group-hover:text-primary transition-colors">{site.name}</span>
                            {assignedEng && (
                              <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground uppercase font-black">
                                <User className="h-2.5 w-2.5 opacity-50" />
                                <span className="opacity-60">Engineer:</span>
                                <span className="text-foreground/80">{assignedEng.username}</span>
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
              Close Audit
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
