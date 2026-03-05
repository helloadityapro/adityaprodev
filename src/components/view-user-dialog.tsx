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
import { MapPin, HardHat, User, Mail, Smartphone, ShieldCheck, FileCheck, UserCog, Trophy, Award, Star } from 'lucide-react';
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

  // Fetch all sites to resolve names
  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  // Fetch all users to calculate global rank based on performance points
  const allUsersQuery = useMemoFirebase(() => query(collection(firestore, 'users'), orderBy('totalPoints', 'desc')), [firestore]);
  const { data: allUsers } = useCollection<UserProfile>(allUsersQuery);

  // If this user is a Site Manager, fetch the engineers assigned to them
  const engineersQuery = useMemoFirebase(() => {
    if (!user || user.role !== 'Site Manager') return null;
    return query(collection(firestore, 'users'), where('siteManagerId', '==', user.id));
  }, [firestore, user]);
  const { data: mappedEngineers } = useCollection<UserProfile>(engineersQuery);

  // If this user is a Site Engineer, fetch their mapped manager's info
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
    return allSites.filter(s => user.assignedProjectIds?.includes(s.id));
  }, [user, allSites]);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[950px] w-[95vw] rounded-sm max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
        <DialogHeader className="p-6 pb-4 shrink-0 bg-background border-b">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2 uppercase tracking-tight">
            <User className="h-6 w-6 text-primary" /> Personnel Audit Profile
          </DialogTitle>
          <DialogDescription>
            High-density view of credentials, performance metrics and operational assignments.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-8 bg-background custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Left Column: Stats and Credentials */}
            <div className="space-y-8">
              <div className="flex items-center gap-4 p-5 rounded-sm bg-muted/30 border border-primary/10">
                <div className="flex flex-col gap-1 flex-1">
                  <p className="text-xl font-black text-foreground uppercase tracking-tight">{user.username}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="rounded-sm font-black uppercase text-[10px] tracking-widest px-2 h-5">
                      {user.role}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end">
                        <Label className="text-[9px] uppercase font-black text-muted-foreground tracking-[0.1em] mb-1">Total Points</Label>
                        <div className="flex items-center gap-1.5 text-primary font-black text-2xl tabular-nums leading-none">
                            {(user.totalPoints || 0).toFixed(2)}
                        </div>
                    </div>
                    <Separator orientation="vertical" className="h-10 bg-primary/10" />
                    <div className="flex flex-col items-end">
                        <Label className="text-[9px] uppercase font-black text-muted-foreground tracking-[0.1em] mb-1">Global Rank</Label>
                        <div className="flex items-center gap-1.5 text-amber-600 font-black text-2xl tabular-nums leading-none">
                            #{globalRank || '—'}
                        </div>
                    </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 p-5 bg-background border rounded-sm shadow-sm">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-primary" /> Primary Email
                  </Label>
                  <p className="text-sm font-bold text-foreground pl-5.5">{user.email}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest flex items-center gap-2">
                    <Smartphone className="h-3.5 w-3.5 text-primary" /> Contact Number
                  </Label>
                  <p className="text-sm font-bold text-foreground pl-5.5">{user.mobile || 'N/A'}</p>
                </div>
              </div>

              <Separator className="bg-primary/5" />

              {/* Reporting Hierarchy Section */}
              {user.role === 'Site Engineer' && (
                <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <UserCog className="h-4 w-4" /> Reporting Hierarchy
                    </Label>
                    {mappedManager ? (
                        <div className="p-4 rounded-sm border bg-card shadow-sm flex items-center gap-4 group hover:border-primary/30 transition-all border-l-4 border-l-primary/40">
                            <div className="bg-primary/10 p-2.5 rounded-sm">
                                <ShieldCheck className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="font-black text-sm uppercase leading-tight">{mappedManager.username}</p>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight mt-0.5">Assigned Site Manager</p>
                            </div>
                        </div>
                    ) : (
                        <div className="p-10 bg-muted/20 border border-dashed rounded-sm text-center">
                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest italic opacity-50">No Supervisor Mapped</p>
                        </div>
                    )}
                </div>
              )}

              {user.role === 'Site Manager' && (
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <HardHat className="h-4 w-4" /> Managed Personnel (Engineers)
                  </Label>
                  {mappedEngineers && mappedEngineers.length > 0 ? (
                    <div className="grid gap-2">
                      {mappedEngineers.map(eng => (
                        <div key={eng.id} className="flex items-center justify-between p-3 rounded-sm border bg-card shadow-sm hover:bg-muted/5 transition-colors group">
                          <div className="flex flex-col">
                            <p className="text-sm font-bold group-hover:text-primary transition-colors">{eng.username}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{eng.email}</p>
                          </div>
                          <Badge variant="outline" className="text-[8px] h-4.5 rounded-sm uppercase font-black border-primary/20 tracking-tighter">Engineer</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-10 bg-muted/20 border border-dashed rounded-sm text-center">
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest italic opacity-50">No Reporting Team Found</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Site Access Analysis */}
            <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Authorized Site Locations
              </Label>
              {assignedSites.length > 0 ? (
                <div className="grid gap-2.5">
                  {assignedSites.map(site => {
                    // Cross-reference mapping for managers to see who is assigned where
                    const assignedEng = user.role === 'Site Manager' 
                        ? mappedEngineers?.find(eng => eng.assignedProjectIds?.includes(site.id))
                        : null;

                    return (
                        <div key={site.id} className="flex items-center justify-between p-4 rounded-sm border bg-card shadow-sm group hover:border-primary/40 transition-all border-l-4 border-l-primary/20">
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className="font-black text-sm truncate uppercase tracking-tight text-foreground group-hover:text-primary transition-colors">{site.name}</span>
                            {assignedEng && (
                                <div className="flex items-center gap-1.5 text-[9px] text-primary uppercase font-black bg-primary/5 px-2 py-0.5 rounded-sm w-fit border border-primary/10">
                                    <User className="h-2.5 w-2.5" />
                                    Team Lead: {assignedEng.username}
                                </div>
                            )}
                          </div>
                          <Badge variant="outline" className="text-[8px] h-4.5 uppercase font-black tracking-tighter opacity-40 shrink-0 group-hover:opacity-100 ml-4 font-mono">
                              {site.id.slice(0, 8)}
                          </Badge>
                        </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-32 text-center bg-muted/5 rounded-sm border-2 border-dashed">
                  <MapPin className="h-12 w-12 text-muted-foreground/10 mb-4" />
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Zero Site Assignments</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t bg-muted/10 flex justify-end shrink-0">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="rounded-sm font-black uppercase text-xs h-10 px-10 border-primary/20 text-primary hover:bg-primary hover:text-white transition-all">
              Close Audit Record
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
