'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, writeBatch, arrayUnion, getDoc, increment } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, AlertCircle, Loader2, Eye, FilterX, Search, ShieldAlert, History, ArrowLeft } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import { isSuperAdmin } from '@/lib/auth-constants';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import Link from 'next/link';

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

  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [deleteDialog, setDeleteDialog] = React.useState<{ open: boolean, targets: string[] }>({ open: false, targets: [] });
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    if (!isProfileLoading && !isAdmin) {
      router.replace('/ptw/raise');
    }
  }, [isProfileLoading, isAdmin, router]);

  const permitsQuery = useMemoFirebase(() => collection(firestore, 'permits_to_work'), [firestore]);
  const { data: permits, isLoading: arePermitsLoading } = useCollection<Permit>(permitsQuery);

  const filteredPermits = React.useMemo(() => {
    if (!permits) return [];
    // Filter out permits hidden by the current user
    const hiddenIds = userProfile?.hiddenPermitIds || [];
    return permits.filter(p => !hiddenIds.includes(p.id))
      .filter(p => 
        p.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.siteName.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => (b.requestDate?.toDate?.() || 0) - (a.requestDate?.toDate?.() || 0));
  }, [permits, userProfile, searchTerm]);

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
      toast({ title: "Hidden Successfully", description: "Selected records hidden from your management view." });
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
      // Points reversal logic for permanent deletion
      for (const id of deleteDialog.targets) {
          const pRef = doc(firestore, 'permits_to_work', id);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
              const pData = pSnap.data() as Permit;
              if (pData.status === 'Approved') {
                  const hasRejection = (pData.timeline || []).some((t: any) => t.status === 'Rejected');
                  const basePoints = hasRejection ? 0.5 : 1.0;
                  
                  // Revert Engineer Points
                  const engRef = doc(firestore, 'users', pData.siteEngineerId);
                  const engSnap = await getDoc(engRef);
                  if (engSnap.exists()) {
                      const m = engSnap.data()?.pointsMultiplier || 1;
                      updateDocumentNonBlocking(engRef, {
                          totalPoints: increment(-(basePoints * m))
                      });
                  }

                  // Revert Manager Points (Inheritance)
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
      toast({ title: "Permanently Removed", description: "Records deleted and all associated points have been reversed." });
      setSelectedIds([]);
      setDeleteDialog({ open: false, targets: [] });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete records.' });
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
        <Button variant="ghost" size="sm" onClick={() => router.push('/settings')} className="w-fit mb-2 -ml-2">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings
        </Button>
        <h1 className="flex items-center gap-2 text-primary">
          <ShieldAlert className="h-8 w-8" /> Permit Management
        </h1>
        <p className="text-muted-foreground font-medium">Cleanup permit requests and manage database health. Points are automatically reversed on permanent deletion.</p>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-muted/40 border rounded-sm shadow-sm">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search serial or site..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="pl-8 h-10 rounded-sm bg-background border-primary/10"
            />
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSearchTerm("")} className="h-10 w-10 text-muted-foreground">
            <FilterX className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Badge className="bg-primary/10 text-primary border-primary/20 h-10 px-4 rounded-sm text-[10px] font-black uppercase tracking-widest">
            {selectedIds.length} Selected
          </Badge>
          <Button 
            variant="destructive" 
            disabled={selectedIds.length === 0} 
            onClick={() => setDeleteDialog({ open: true, targets: selectedIds })}
            className="rounded-sm font-black text-[10px] uppercase h-10 px-6 shadow-md"
          >
            <Trash2 className="h-4 w-4 mr-2" /> Delete Action
          </Button>
        </div>
      </div>

      <Card className="rounded-sm overflow-hidden border-primary/10 shadow-lg">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox 
                    checked={selectedIds.length === filteredPermits.length && filteredPermits.length > 0} 
                    onCheckedChange={toggleSelectAll} 
                  />
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Registry Info</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Site Context</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Submitted On</TableHead>
                <TableHead className="text-right px-6 text-[10px] font-black uppercase tracking-widest">Audit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPermits.length > 0 ? (
                filteredPermits.map((p) => (
                  <TableRow key={p.id} className="hover:bg-muted/5 transition-colors">
                    <TableCell>
                      <Checkbox 
                        checked={selectedIds.includes(p.id)} 
                        onCheckedChange={() => toggleSelect(p.id)} 
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-bold text-primary">{p.serialNumber || p.id.slice(0,8)}</span>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">{p.ptwType}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-sm">{p.siteName}</TableCell>
                    <TableCell>
                        <Badge variant="outline" className={cn(
                          "rounded-sm text-[9px] font-black uppercase px-1.5 h-5",
                          p.status === 'Approved' ? "bg-green-50 text-green-700 border-green-200" :
                          p.status === 'Rejected' ? "bg-red-50 text-red-700 border-red-200" :
                          "bg-yellow-50 text-yellow-700 border-yellow-200"
                        )}>
                          {p.status}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-[10px] font-bold text-muted-foreground font-mono">
                        {p.requestDate ? format(p.requestDate.toDate(), 'dd MMM yy HH:mm') : '—'}
                    </TableCell>
                    <TableCell className="text-right px-6">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" asChild>
                            <Link href={`/ptw/list?view=${p.id}`}><Eye className="h-4 w-4" /></Link>
                          </Button>
                          <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive rounded-sm"
                              onClick={() => setDeleteDialog({ open: true, targets: [p.id] })}
                          >
                              <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic">
                    <div className="flex flex-col items-center gap-2 opacity-40">
                      <History className="h-10 w-10" />
                      <p className="text-sm font-bold uppercase tracking-widest">No matching records</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialog.open} onOpenChange={(o) => !o && setDeleteDialog({ open: false, targets: [] })}>
        <AlertDialogContent className="rounded-sm max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-tight">Process Deletion</AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-medium leading-relaxed">
                Choose the scope of deletion for <strong>{deleteDialog.targets.length} selected permit(s)</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-6">
            <div className="p-4 border rounded-sm bg-primary/5 border-primary/10 flex flex-col gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-tight text-primary">Option 1: Delete for me</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Records will be hidden from your administrative interface but remain active in the database for other users and organizational audits.
                  </p>
                </div>
                <Button variant="outline" className="w-full h-11 font-black text-[10px] uppercase tracking-widest border-primary/30 text-primary hover:bg-primary/10" onClick={handleDeleteForMe} disabled={isDeleting}>
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete for me"}
                </Button>
            </div>
            
            <div className="p-4 border border-red-500/20 rounded-sm bg-red-500/5 flex flex-col gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-tight text-red-700">Option 2: Delete for everyone</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Permanently removes records for all users. <strong className="text-red-700 underline uppercase">Caution:</strong> All associated reward points will be automatically reversed from personnel accounts.
                  </p>
                </div>
                <Button variant="destructive" className="w-full h-11 font-black text-[10px] uppercase tracking-widest shadow-lg" onClick={handleDeleteForEveryone} disabled={isDeleting}>
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete for everyone"}
                </Button>
            </div>
          </div>
          <AlertDialogFooter className="border-t pt-4">
            <AlertDialogCancel className="rounded-sm font-bold uppercase text-[10px] h-10 px-6" disabled={isDeleting}>Cancel Action</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}