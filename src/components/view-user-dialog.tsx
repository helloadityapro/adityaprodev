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
import { collection, query, where, doc } from 'firebase/firestore';
import { MapPin, HardHat, User, Mail, Smartphone, ShieldCheck, FileCheck, UserCog } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

type UserProfile = {
  id: string;
  username: string;
  email: string;
  mobile: string;
  role: 'Admin' | 'Site Manager' | 'Site Engineer';
  assignedProjectIds?: string[];
  siteManagerId?: string;
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

  // Fetch count of PTWs raised by this user
  const userPermitsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'permits_to_work'), where('siteEngineerId', '==', user.id));
  }, [firestore, user]);
  const { data: userPermits } = useCollection(userPermitsQuery);

  const assignedSites = React.useMemo(() => {
    if (!user?.assignedProjectIds || !allSites) return [];
    return allSites.filter(s => user.assignedProjectIds?.includes(s.id));
  }, [user, allSites]);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-sm max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <User className="h-6 w-6 text-primary" /> User Profile
          </DialogTitle>
          <DialogDescription>
            Detailed view of user credentials and operational assignments.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6 pt-4">
          <div className="space-y-6">
            <div className="grid gap-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 border">
                <div className="flex flex-col gap-1 flex-1">
                  <p className="text-xl font-bold text-foreground">{user.username}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary" className="rounded-sm font-bold uppercase text-[10px]">
                      {user.role}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <Label className="text-[9px] uppercase font-bold text-muted-foreground">PtWs Raised</Label>
                    <Badge variant="outline" className="rounded-sm font-mono flex items-center gap-1.5 py-1">
                        <FileCheck className="h-3 w-3 text-primary" />
                        {userPermits?.length || 0}
                    </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest flex items-center gap-1.5">
                    <Mail className="h-3 w-3" /> Email Address
                  </Label>
                  <p className="text-sm font-medium pl-4.5">{user.email}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest flex items-center gap-1.5">
                    <Smartphone className="h-3 w-3" /> Mobile Number
                  </Label>
                  <p className="text-sm font-medium pl-4.5">{user.mobile || 'N/A'}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Mapped Manager for Engineers */}
            {user.role === 'Site Engineer' && (
                <>
                    <div className="space-y-4">
                        <Label className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                            <UserCog className="h-4 w-4" /> Reporting To
                        </Label>
                        {mappedManager ? (
                            <div className="p-3 rounded-md border bg-card text-sm font-medium shadow-sm flex items-center gap-3">
                                <div className="bg-primary/10 p-2 rounded-full">
                                    <ShieldCheck className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <p className="font-bold">{mappedManager.username}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Site Manager</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm italic text-muted-foreground bg-muted/20 p-4 rounded-md border border-dashed text-center">
                                No manager assigned to this engineer.
                            </p>
                        )}
                    </div>
                    <Separator />
                </>
            )}

            <div className="space-y-4">
              <Label className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Assigned Sites
              </Label>
              {assignedSites.length > 0 ? (
                <div className="grid gap-2">
                  {assignedSites.map(site => (
                    <div key={site.id} className="flex items-center justify-between p-3 rounded-md border bg-card text-sm font-medium shadow-sm">
                      {site.name}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm italic text-muted-foreground bg-muted/20 p-4 rounded-md border border-dashed text-center">
                  No sites currently assigned to this user.
                </p>
              )}
            </div>

            {user.role === 'Site Manager' && (
              <div className="space-y-4">
                <Label className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                  <HardHat className="h-4 w-4" /> Mapped Engineers
                </Label>
                {mappedEngineers && mappedEngineers.length > 0 ? (
                  <div className="grid gap-2">
                    {mappedEngineers.map(eng => (
                      <div key={eng.id} className="flex flex-col p-3 rounded-md border bg-card shadow-sm">
                        <p className="text-sm font-bold">{eng.username}</p>
                        <p className="text-[10px] text-muted-foreground">{eng.email}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm italic text-muted-foreground bg-muted/20 p-4 rounded-md border border-dashed text-center">
                    No engineers are mapped to this manager yet.
                  </p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-6 border-t bg-muted/10 flex justify-end">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="rounded-sm">Close Profile</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
