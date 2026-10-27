
'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, orderBy, serverTimestamp, writeBatch, limit, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  RotateCcw, 
  Trash2, 
  Search, 
  ArrowLeft, 
  Building2, 
  History, 
  User, 
  Calendar, 
  Loader2, 
  AlertCircle,
  ShieldCheck,
  Building
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';
import { useRouter } from 'next/navigation';
import { isSuperAdmin } from '@/lib/auth-constants';
import { cn } from '@/lib/utils';

type ArchivedSite = {
  id: string;
  name: string;
  projectCompany: string;
  acCapacity: number;
  dcCapacity: number;
  deletedAt: any;
  deletedByName: string;
};

export default function RestoreProjectsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState<string | null>(null);
  const [isCleaning, setIsCleaning] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const archivedQuery = useMemoFirebase(() => 
    query(collection(firestore, 'deleted_projects'), orderBy('deletedAt', 'desc'), limit(500)), 
    [firestore]
  );
  const { data: archivedSites, isLoading: isArchivedLoading } = useCollection<ArchivedSite>(archivedQuery);

  const filteredArchived = React.useMemo(() => {
    if (!archivedSites) return [];
    return archivedSites.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.projectCompany.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.deletedByName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [archivedSites, searchTerm]);

  const handleRestore = async (site: ArchivedSite) => {
    setIsProcessing(site.id);
    try {
      const { id, deletedAt, deletedBy, deletedByName, ...data } = site as any;
      const batch = writeBatch(firestore);

      // Move back to sites registry
      batch.set(doc(firestore, 'sites', id), {
        ...data,
        updatedAt: serverTimestamp(),
        restoredAt: serverTimestamp(),
        restoredBy: user?.uid
      });

      // Remove from bin
      batch.delete(doc(firestore, 'deleted_projects', id));

      await batch.commit();
      toast({ title: 'Project Restored', description: `${site.name} is now active in the registry.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Restoration Failed', description: e.message });
    } finally {
      setIsProcessing(null);
    }
  };

  const handlePermanentDelete = async (site: ArchivedSite) => {
    try {
      deleteDocumentNonBlocking(doc(firestore, 'deleted_projects', site.id));
      toast({ title: 'Purged', description: 'Record permanently removed from system.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
    }
  };

  const handleRunPolicyCleanup = async () => {
    if (!archivedSites || archivedSites.length === 0) return;
    setIsCleaning(true);
    try {
      const now = new Date();
      const batch = writeBatch(firestore);
      let count = 0;

      archivedSites.forEach(s => {
        const deletedAt = s.deletedAt?.toDate ? s.deletedAt.toDate() : new Date(s.deletedAt);
        const daysInBin = differenceInDays(now, deletedAt);
        if (daysInBin >= 30) {
          batch.delete(doc(firestore, 'deleted_projects', s.id));
          count++;
        }
      });

      if (count > 0) {
        await batch.commit();
        toast({ title: 'Cleanup Finished', description: `Permanently removed ${count} expired records.` });
      } else {
        toast({ title: 'System Audited', description: 'No records exceed the 30-day archival threshold.' });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Cleanup Failed', description: e.message });
    } finally {
      setIsCleaning(false);
    }
  };

  if (isProfileLoading || isArchivedLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;
  if (!isAdmin) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.push('/settings')} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings
        </Button>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
           <div className="flex items-center gap-3">
              <div className="bg-orange-500/10 p-2.5 rounded-sm shrink-0">
                <RotateCcw className="h-7 w-7 text-orange-600" />
              </div>
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight">Restore Projects</h1>
                <p className="text-muted-foreground text-sm font-medium">Archived site registry. Items are kept for 30 days before permanent removal.</p>
              </div>
           </div>
           <Button variant="outline" onClick={handleRunPolicyCleanup} disabled={isCleaning} className="h-10 rounded-sm font-black uppercase text-[10px] tracking-widest border-orange-200 text-orange-700 hover:bg-orange-50">
              {isCleaning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              Run Policy Cleanup
           </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search archived sites or personnel..." 
            className="pl-10 h-11 text-sm rounded-sm border-primary/20 bg-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Badge variant="outline" className="rounded-sm font-black uppercase text-[10px] tracking-widest px-3 h-10 border-orange-200 text-orange-700 bg-orange-50">
          {filteredArchived.length} Items in Bin
        </Badge>
      </div>

      <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6 font-black uppercase text-[10px] tracking-widest">Archived Site</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Deleted At</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Deleted By</TableHead>
                  <TableHead className="text-center font-black uppercase text-[10px] tracking-widest">Expiration</TableHead>
                  <TableHead className="text-right px-6 font-black uppercase text-[10px] tracking-widest">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredArchived.length > 0 ? filteredArchived.map((site) => {
                  const deletedAt = site.deletedAt?.toDate ? site.deletedAt.toDate() : new Date(site.deletedAt);
                  const daysLeft = 30 - differenceInDays(new Date(), deletedAt);
                  const isExpiringSoon = daysLeft <= 5;

                  return (
                    <TableRow key={site.id} className="hover:bg-muted/5 transition-colors group">
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-black text-sm text-foreground uppercase tracking-tight">{site.name}</span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60 mt-0.5">{site.projectCompany}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-[10px] font-bold text-muted-foreground uppercase">
                        {format(deletedAt, 'dd MMM yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                          <User className="h-3.5 w-3.5 text-orange-600 opacity-40" />
                          {site.deletedByName || 'Admin'}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={cn(
                          "rounded-sm font-black uppercase text-[9px] px-2 h-5",
                          isExpiringSoon ? "bg-red-50 text-red-700 border-red-200 animate-pulse" : "bg-orange-50 text-orange-700 border-orange-200"
                        )}>
                          {daysLeft > 0 ? `${daysLeft} Days Remaining` : 'Expired'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 rounded-sm font-black uppercase text-[10px] tracking-widest border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => handleRestore(site)}
                            disabled={!!isProcessing}
                          >
                            {isProcessing === site.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
                            Restore
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm hover:bg-red-50" onClick={() => handlePermanentDelete(site)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[10px] opacity-20 tracking-[0.3em]">
                       Bin Empty
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="p-6 bg-orange-50/50 border-2 border-dashed border-orange-200 rounded-sm flex items-start gap-4">
        <AlertCircle className="h-6 w-6 text-orange-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-sm font-black uppercase tracking-tight text-orange-900">Restoration Policy</h4>
          <p className="text-xs font-medium text-orange-800/80 leading-relaxed">
            Project data moved to this registry is preserved for a grace period of 30 days. After this threshold, records may be permanently purged by system maintenance or manual cleanup. Restoring a project re-establishes it in the main registry with full data integrity.
          </p>
        </div>
      </div>
    </div>
  );
}
