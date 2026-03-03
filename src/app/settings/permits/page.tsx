
'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, writeBatch, arrayUnion, getDoc, increment } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { format } from 'date-fns';
import { isSuperAdmin } from '@/lib/auth-constants';

type Permit = {
  id: string;
  serialNumber?: string;
  siteName: string;
  ptwType: string;
  status: string;
  siteEngineerId: string;
  siteManagerId?: string;
  timeline?: any[];
  requestDate: any;
};

type UserProfile = {
    id: string;
    username: string;
    role: string;
    hiddenPermitIds?: string[];
};

export default function PermitManagementPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  React.useEffect(() => {
    if (!isProfileLoading && !isAdmin) {
      router.replace('/ptw/raise');
    }
  }, [isProfileLoading, isAdmin, router]);

  const permitsQuery = useMemoFirebase(() => collection(firestore, 'permits_to_work'), [firestore]);
  const { data: permits, isLoading: arePermitsLoading } = useCollection<Permit>(permitsQuery);

  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [deleteDialog, setDeleteDialog] = React.useState<{ open: boolean, targets: string[] }>({ open: false, targets: [] });
  const [isDeleting, setIsDeleting] = React.useState(false);

  const filteredPermits = React.useMemo(() => {
    if (!permits) return [];
    // Filter out permits hidden by the current user
    const hiddenIds = userProfile?.hiddenPermitIds || [];
    return permits.filter(p => !hiddenIds.includes(p.id));
  }, [permits, userProfile]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredPermits.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPermits.map(p => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleDeleteForMe = async () => {
    if (!user || deleteDialog.targets.length === 0) return;
    setIsDeleting(true);
    try {
      const userRef = doc(firestore, 'users', user.uid);
      updateDocumentNonBlocking(userRef, {
        hiddenPermitIds: arrayUnion(...deleteDialog.targets)
      });
      toast({ title: "Hidden Successfully", description: "Selected requests hidden from your view." });
      setSelectedIds([]);
      setDeleteDialog({ open: false, targets: [] });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not hide requests.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteForEveryone = async () => {
    if (!firestore || deleteDialog.targets.length === 0) return;
    setIsDeleting(true);
    try {
      // Point reversal logic
      for (const id of deleteDialog.targets) {
          const pRef = doc(firestore, 'permits_to_work', id);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
              const pData = pSnap.data() as Permit;
              if (pData.status === 'Approved') {
                  const hasRejection = (pData.timeline || []).some((t: any) => t.status === 'Rejected');
                  const basePoints = hasRejection ? 0.5 : 1.0;
                  
                  // Revert Engineer
                  const engRef = doc(firestore, 'users', pData.siteEngineerId);
                  const engSnap = await getDoc(engRef);
                  if (engSnap.exists()) {
                      const m = engSnap.data()?.pointsMultiplier || 1;
                      updateDocumentNonBlocking(engRef, {
                          totalPoints: increment(-(basePoints * m))
                      });
                  }

                  // Revert Manager
                  if (pData.siteManagerId) {
                      updateDocumentNonBlocking(doc(firestore, 'users', pData.siteManagerId), {
                          totalPoints: increment(-(basePoints * 0.5))
                      });
                  }
              }
          }
      }

      const batch = writeBatch(firestore);
      deleteDialog.targets.forEach(id => {
        batch.delete(doc(firestore, 'permits_to_work', id));
      });
      await batch.commit();
      toast({ title: "Permanently Deleted", description: "Selected requests deleted and points reversed." });
      setSelectedIds([]);
      setDeleteDialog({ open: false, targets: [] });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete requests.' });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isProfileLoading || arePermitsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Permit Management</h1>
        <p className="text-muted-foreground">Cleanup requests and manage administrative visibility. Point rewards are reversed on deletion.</p>
      </div>

      <div className="flex items-center justify-between gap-4 p-4 bg-muted/40 border rounded-sm">
        <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{selectedIds.length} requests selected</span>
        </div>
        <Button 
            variant="destructive" 
            disabled={selectedIds.length === 0} 
            onClick={() => setDeleteDialog({ open: true, targets: selectedIds })}
            className="rounded-sm"
        >
            <Trash2 className="h-4 w-4 mr-2" /> Delete Selected
        </Button>
      </div>

      <Card className="rounded-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox 
                    checked={selectedIds.length === filteredPermits.length && filteredPermits.length > 0} 
                    onCheckedChange={toggleSelectAll} 
                  />
                </TableHead>
                <TableHead>Serial No</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPermits.length > 0 ? (
                filteredPermits.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedIds.includes(p.id)} 
                        onCheckedChange={() => toggleSelect(p.id)} 
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.serialNumber || p.id.slice(0,8)}</TableCell>
                    <TableCell>{p.siteName}</TableCell>
                    <TableCell>{p.ptwType}</TableCell>
                    <TableCell>
                        <Badge variant="outline" className="rounded-sm text-[10px] font-bold uppercase">{p.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                        {p.requestDate ? format(p.requestDate.toDate(), 'dd/MM/yyyy HH:mm') : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive hover:bg-destructive/10 rounded-sm"
                            onClick={() => setDeleteDialog({ open: true, targets: [p.id] })}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground italic">
                    No permit requests found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialog.open} onOpenChange={(o) => !o && setDeleteDialog({ open: false, targets: [] })}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteDialog.targets.length > 1 ? 'Requests' : 'Request'}</AlertDialogTitle>
            <AlertDialogDescription>
                Choose how you want to handle the deletion of these records. Points will be reversed for all users if deleted for everyone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <div className="flex flex-col gap-1 p-3 border rounded-sm bg-accent/30">
                <p className="text-sm font-bold">Delete for me</p>
                <p className="text-xs text-muted-foreground">Only hides these requests from your administration dashboard. Engineers and Managers can still see them.</p>
                <Button variant="outline" className="mt-2 w-full rounded-sm" onClick={handleDeleteForMe} disabled={isDeleting}>
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete for me"}
                </Button>
            </div>
            <div className="flex flex-col gap-1 p-3 border border-destructive/20 rounded-sm bg-destructive/5">
                <p className="text-sm font-bold text-destructive">Delete for everyone</p>
                <p className="text-xs text-muted-foreground">Permanently removes these records from the database for all users and reverses reward points. This action cannot be undone.</p>
                <Button variant="destructive" className="mt-2 w-full rounded-sm" onClick={handleDeleteForEveryone} disabled={isDeleting}>
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete for everyone"}
                </Button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm" disabled={isDeleting}>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
