
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, doc, limit, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  FilterX, 
  Building2, 
  User, 
  Eye, 
  CheckCircle2, 
  X,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Trash2,
  Calendar,
  LayoutGrid,
  Cpu,
  Pencil,
  FileDown
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { isSuperAdmin } from '@/lib/auth-constants';
import Link from 'next/link';
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

type InverterChecklist = {
  id: string;
  siteId: string;
  siteName: string;
  projectCompany?: string;
  inverterNumber: string;
  inverterMake: string;
  inverterRating: string;
  userName: string;
  userId: string;
  status: string;
  createdAt: any;
};

export default function ProjectInverterDataPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = React.use(params);
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  
  const [searchTerm, setSearchTerm] = React.useState("");
  const [deletingRecord, setDeletingRecord] = React.useState<InverterChecklist | null>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const siteRef = useMemoFirebase(() => doc(firestore, 'sites', siteId), [firestore, siteId]);
  const { data: site, isLoading: siteLoading } = useDoc<any>(siteRef);

  const invQuery = useMemoFirebase(() => query(collection(firestore, 'inverter_checklists'), where('siteId', '==', siteId), limit(1000)), [firestore, siteId]);
  const { data: records, isLoading: invLoading } = useCollection<InverterChecklist>(invQuery);

  const filteredRecords = React.useMemo(() => {
    if (!records) return [];
    return records.filter(r => 
      r.inverterNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.inverterMake.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
  }, [records, searchTerm]);

  const handleDelete = () => {
    if (!deletingRecord) return;
    deleteDocumentNonBlocking(doc(firestore, 'inverter_checklists', deletingRecord.id));
    setDeletingRecord(null);
  };

  if (isProfileLoading || siteLoading || invLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="space-y-6 md:space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/checklists/data`)} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Registry
        </Button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h2 className="text-lg md:text-2xl font-black text-foreground uppercase tracking-tight flex items-center gap-2 md:gap-3 leading-none">
              <Cpu className="h-5 w-5 md:h-6 md:w-6 text-primary shrink-0" />
              <span className="truncate">{site?.name} : Inverter Records</span>
            </h2>
            <p className="text-muted-foreground text-[8px] md:text-xs font-bold uppercase tracking-[0.2em]">{site?.projectCompany}</p>
          </div>
          <div className="flex items-center gap-3">
             <Button variant="outline" size="sm" className="h-9 rounded-sm font-black uppercase text-[10px] tracking-widest border-primary/20 text-primary" asChild>
                <Link href={`/checklists/data/${siteId}/inverter/matrix`}>
                  <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> View Matrix
                </Link>
             </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search Inverter #, Make or Auditor..." className="pl-10 h-10 text-sm rounded-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Badge variant="secondary" className="rounded-sm font-black uppercase text-[9px] tracking-widest px-3 h-8 border-none">
          {filteredRecords.length} Audits Found
        </Badge>
      </div>

      <div className="md:hidden space-y-3">
        {filteredRecords.map(record => (
          <Card key={record.id} className="rounded-sm border-primary/5 shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">{record.createdAt ? format(record.createdAt.toDate(), 'dd MMM yy HH:mm') : '—'}</span>
                  <h3 className="font-bold text-sm leading-tight text-foreground truncate">Inv #{record.inverterNumber}</h3>
                </div>
                <Badge variant="outline" className={cn(
                  "text-[8px] font-black uppercase rounded-sm h-5",
                  record.status === 'Approved' ? "bg-green-50 text-green-700 border-green-200" :
                  record.status === 'Rejected' ? "bg-red-50 text-red-700 border-red-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"
                )}>{record.status}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
                <div className="flex items-center gap-1.5"><Building2 className="h-3 w-3" />{record.inverterMake}</div>
                <div className="flex items-center gap-1.5"><Cpu className="h-3 w-3" />{record.inverterRating}</div>
              </div>
              <div className="pt-2 border-t border-primary/5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><User className="h-3.5 w-3.5 text-primary" />{record.userName}</div>
                <div className="flex gap-1">
                  {(isAdmin || record.userId === user?.uid) && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" asChild><Link href={`/checklists/data/${siteId}/inverter/edit/${record.id}`}><Pencil className="h-4 w-4" /></Link></Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" asChild><Link href={`/checklists/data/${siteId}/inverter/view/${record.id}`}><Eye className="h-5 w-5" /></Link></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="hidden md:block rounded-sm border-primary/10 shadow-md overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="px-6">Timestamp</TableHead>
                <TableHead>Inverter #</TableHead>
                <TableHead>Make & Rating</TableHead>
                <TableHead>Auditor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right px-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map(record => (
                <TableRow key={record.id} className="hover:bg-muted/5 transition-colors group cursor-pointer" onClick={() => router.push(`/checklists/data/${siteId}/inverter/view/${record.id}`)}>
                  <TableCell className="px-6 py-4 font-mono text-[10px] font-bold text-muted-foreground">{record.createdAt ? format(record.createdAt.toDate(), 'dd MMM yy HH:mm') : '—'}</TableCell>
                  <TableCell className="font-black text-sm text-primary">{record.inverterNumber}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold">{record.inverterMake}</span>
                      <span className="text-[9px] font-black text-muted-foreground uppercase">{record.inverterRating}</span>
                    </div>
                  </TableCell>
                  <TableCell><div className="flex items-center gap-2 text-xs font-medium"><User className="h-3 w-3 text-primary opacity-50" />{record.userName}</div></TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "rounded-sm text-[9px] font-black uppercase px-1.5 h-5",
                      record.status === 'Approved' ? "bg-green-50 text-green-700 border-green-200" :
                      record.status === 'Rejected' ? "bg-red-50 text-red-700 border-red-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"
                    )}>{record.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right px-6">
                    <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                      {(isAdmin || record.userId === user?.uid) && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" asChild><Link href={`/checklists/data/${siteId}/inverter/edit/${record.id}`}><Pencil className="h-4 w-4" /></Link></Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" asChild><Link href={`/checklists/data/${siteId}/inverter/view/${record.id}`}><Eye className="h-4 w-4" /></Link></Button>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => setDeletingRecord(record)}><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredRecords.length === 0 && (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">No records found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingRecord} onOpenChange={o => !o && setDeletingRecord(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Audit Log?</AlertDialogTitle>
            <AlertDialogDescription>Removing Inverter {deletingRecord?.inverterNumber} audit record. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white rounded-sm" onClick={handleDelete}>Confirm Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
