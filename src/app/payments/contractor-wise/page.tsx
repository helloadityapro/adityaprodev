'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, where, orderBy, doc, limit, increment, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  HardHat, 
  Search, 
  FilterX, 
  Building2, 
  ArrowRight, 
  Calendar,
  CreditCard,
  FileText,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Loader2,
  History,
  User,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { isSuperAdmin } from '@/lib/auth-constants';

type Payment = {
  id: string;
  siteId: string;
  siteName: string;
  paymentAgainst: 'WO';
  referenceId: string;
  payeeId: string;
  payeeName: string;
  referenceNumber: string;
  amount: number;
  paymentType: string;
  paymentMode: string;
  paymentDetails: string;
  proofUrl?: string;
  date: any;
  recordedByName?: string;
  editHistory?: any[];
};

type Contractor = { id: string; name: string; gstin: string };
type Site = { id: string; name: string };
type SortKey = 'date' | 'reference' | 'site' | 'amount' | 'type' | 'mode';

export default function ContractorWisePaymentsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [selectedPayeeId, setSelectedPayeeId] = React.useState<string>("all");
  const [selectedSiteId, setSelectedSiteId] = React.useState<string>("all");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isPayeePopoverOpen, setIsPayeePopoverOpen] = React.useState(false);
  const [payeeSearch, setPayeeSearch] = React.useState("");
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });

  const [editingPayment, setEditingPayment] = React.useState<Payment | null>(null);
  const [deletingPayment, setDeletingPayment] = React.useState<Payment | null>(null);
  const [viewHistoryPayment, setViewHistoryPayment] = React.useState<Payment | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  
  const contractorsQuery = useMemoFirebase(() => collection(firestore, 'contractors'), [firestore]);
  const { data: contractors } = useCollection<Contractor>(contractorsQuery);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: sites } = useCollection<Site>(sitesQuery);

  const paymentsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'payments'), where('paymentAgainst', '==', 'WO'), limit(1000));
  }, [firestore]);

  const { data: payments, isLoading } = useCollection<Payment>(paymentsQuery);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3 text-primary" /> : <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  const filteredPayments = React.useMemo(() => {
    if (!payments) return [];
    
    let result = payments.filter(p => {
      const matchesPayee = selectedPayeeId === 'all' || p.payeeId === selectedPayeeId;
      const matchesSite = selectedSiteId === 'all' || p.siteId === selectedSiteId;
      const matchesSearch = p.payeeName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           p.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesPayee && matchesSite && matchesSearch;
    });

    result.sort((a, b) => {
      const { key, direction } = sortConfig;
      let valA: any = ''; let valB: any = '';
      
      if (key === 'date') { valA = a.date?.toDate?.()?.getTime() || 0; valB = b.date?.toDate?.()?.getTime() || 0; }
      else if (key === 'reference') { valA = a.referenceNumber; valB = b.referenceNumber; }
      else if (key === 'site') { valA = a.siteName; valB = b.siteName; }
      else if (key === 'amount') { valA = a.amount; valB = b.amount; }
      else if (key === 'type') { valA = a.paymentType; valB = b.paymentType; }
      else if (key === 'mode') { valA = a.paymentMode; valB = b.paymentMode; }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [payments, selectedPayeeId, selectedSiteId, searchTerm, sortConfig]);

  const handleDelete = async () => {
    if (!deletingPayment) return;
    setIsProcessing(true);
    try {
      const sourceRef = doc(firestore, 'project_wos', deletingPayment.referenceId);
      updateDocumentNonBlocking(sourceRef, {
        paidAmount: increment(-deletingPayment.amount),
        updatedAt: serverTimestamp()
      });
      deleteDocumentNonBlocking(doc(firestore, 'payments', deletingPayment.id));
      toast({ title: 'Record Removed', description: 'Payment deleted and WO balance reconciled.' });
      setDeletingPayment(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPayment || !user) return;
    setIsProcessing(true);

    const formData = new FormData(e.currentTarget);
    const newAmount = parseFloat(formData.get('amount') as string);
    const diff = newAmount - editingPayment.amount;

    try {
      const sourceRef = doc(firestore, 'project_wos', editingPayment.referenceId);
      if (Math.abs(diff) > 0.01) {
        updateDocumentNonBlocking(sourceRef, {
          paidAmount: increment(diff),
          updatedAt: serverTimestamp()
        });
      }

      const editorName = userProfile?.username || user.displayName || user.email || 'Admin';
      const editEntry = {
        action: 'Modified',
        timestamp: new Date().toISOString(),
        userId: user.uid,
        userName: editorName,
        details: `Updated values: Amount ₹${editingPayment.amount}->₹${newAmount}, Mode ${editingPayment.paymentMode}->${formData.get('mode')}, Type ${editingPayment.paymentType}->${formData.get('type')}.`
      };

      updateDocumentNonBlocking(doc(firestore, 'payments', editingPayment.id), {
        amount: newAmount,
        paymentDetails: formData.get('details') as string,
        paymentType: formData.get('type') as string,
        paymentMode: formData.get('mode') as string,
        updatedAt: serverTimestamp(),
        editHistory: arrayUnion(editEntry)
      });

      toast({ title: 'Record Updated', description: 'Changes finalized and balance updated.' });
      setEditingPayment(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 font-black text-primary"><HardHat className="h-8 w-8" /> Contractor-wise Payments</h1>
        <p className="text-muted-foreground font-medium">Review disbursement logs associated with site contractors.</p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
        <div className="flex flex-col gap-1.5 flex-1">
          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Target Contractor</Label>
          <Popover open={isPayeePopoverOpen} onOpenChange={setIsPayeePopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between h-10 rounded-sm bg-background border-primary/10 font-bold">
                {selectedPayeeId === 'all' ? "All Active Contractors" : contractors?.find(c => c.id === selectedPayeeId)?.name}
                <HardHat className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <div className="flex items-center border-b px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <Input placeholder="Search contractors..." className="h-10 border-none" value={payeeSearch} onChange={e => setPayeeSearch(e.target.value)} />
              </div>
              <ScrollArea className="h-[200px]">
                <div className="p-1">
                  <Button variant="ghost" className="w-full justify-start h-9 text-xs font-bold uppercase" onClick={() => { setSelectedPayeeId('all'); setIsPayeePopoverOpen(false); }}>All Contractors</Button>
                  {contractors?.filter(c => c.name.toLowerCase().includes(payeeSearch.toLowerCase())).map(c => (
                    <Button key={c.id} variant="ghost" className="w-full justify-start h-9 text-xs" onClick={() => { setSelectedPayeeId(c.id); setIsPayeePopoverOpen(false); }}>{s.name}</Button>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-col gap-1.5 w-full md:w-64">
          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Project Site (Optional)</Label>
          <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
            <SelectTrigger className="h-10 rounded-sm bg-background border-primary/20 font-bold">
              <SelectValue placeholder="All Sites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs font-bold uppercase">Across All Sites</SelectItem>
              {sites?.map(s => <SelectItem key={s.id} value={s.id} className="text-xs font-medium">{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 w-full md:w-48">
          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Search Ref</Label>
          <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="WO Number..." className="h-10 text-xs font-bold bg-background border-primary/10" />
        </div>
      </div>

      <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('date')}>
                    <div className="flex items-center">Date <SortIcon column="date" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('reference')}>
                    <div className="flex items-center">WO Reference <SortIcon column="reference" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('site')}>
                    <div className="flex items-center">Project Site <SortIcon column="site" /></div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('amount')}>
                    <div className="flex items-center justify-end">Amount Paid <SortIcon column="amount" /></div>
                  </TableHead>
                  <TableHead>Personnel</TableHead>
                  <TableHead className="text-right px-6">Manage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length > 0 ? filteredPayments.map((p) => (
                  <TableRow key={p.id} className="hover:bg-muted/5 transition-colors">
                    <TableCell className="px-6 py-4 font-mono text-[10px] font-bold text-muted-foreground">
                      {p.date ? format(p.date.toDate(), 'dd MMM yy') : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-black text-primary uppercase">{p.referenceNumber}</TableCell>
                    <TableCell className="text-sm font-semibold">{p.siteName}</TableCell>
                    <TableCell className="text-right font-black text-sm font-mono text-foreground">
                      ₹{p.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-primary" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{p.recordedByName || 'System'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground rounded-sm" onClick={() => setViewHistoryPayment(p)} title="View Edit History">
                          <History className="h-4 w-4" />
                        </Button>
                        {p.proofUrl && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" asChild>
                            <a href={p.proofUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                          </Button>
                        )}
                        {isAdmin && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600" onClick={() => setEditingPayment(p)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingPayment(p)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic">No contractor-specific payment logs discovered.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingPayment} onOpenChange={(o) => !o && setEditingPayment(null)}>
        <DialogContent className="max-md rounded-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black text-primary"><Pencil className="h-5 w-5" /> Edit Transaction</DialogTitle>
            <DialogDescription className="text-xs">Updating amount will synchronize the WO balance.</DialogDescription>
          </DialogHeader>
          {editingPayment && (
            <form onSubmit={handleEdit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Amount (₹)</Label>
                <Input name="amount" type="number" step="0.01" defaultValue={editingPayment.amount} required className="font-mono font-bold h-11" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Type</Label>
                  <Select name="type" defaultValue={editingPayment.paymentType}>
                    <SelectTrigger className="h-10 text-xs font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Advance">Advance</SelectItem>
                      <SelectItem value="Part">Part</SelectItem>
                      <SelectItem value="Final">Final</SelectItem>
                      <SelectItem value="Full">Full</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Mode</Label>
                  <Select name="mode" defaultValue={editingPayment.paymentMode}>
                    <SelectTrigger className="h-10 text-xs font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Ref / Notes</Label>
                <Input name="details" defaultValue={editingPayment.paymentDetails} className="h-10 text-xs font-bold" />
              </div>
              <DialogFooter className="pt-4 gap-2">
                <DialogClose asChild><Button variant="outline" className="rounded-sm font-bold uppercase text-[10px] h-11 flex-1">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isProcessing} className="rounded-sm font-black uppercase text-[10px] h-11 flex-1 shadow-lg">
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={!!viewHistoryPayment} onOpenChange={(o) => !o && setViewHistoryPayment(null)}>
        <DialogContent className="max-w-lg rounded-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" /> Lifecycle Audit</DialogTitle>
            <DialogDescription className="text-xs">Audit history for WO Ref: {viewHistoryPayment?.referenceNumber}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] mt-4 pr-4">
            <div className="space-y-6 relative border-l-2 border-muted ml-3 pl-6 py-2">
              <div className="relative">
                <div className="absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <div className="flex flex-col gap-1 text-left">
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-tight">Created — {viewHistoryPayment?.recordedByName || 'System'}</span>
                  <p className="text-[10px] text-muted-foreground font-mono font-bold uppercase">
                    {viewHistoryPayment?.date ? format(viewHistoryPayment.date.toDate(), 'dd MMM yy HH:mm') : '—'}
                  </p>
                  <p className="text-xs italic text-foreground/80 mt-1 leading-relaxed">"Payment entry of ₹{viewHistoryPayment?.amount.toLocaleString()} initialized."</p>
                </div>
              </div>
              {viewHistoryPayment?.editHistory?.map((entry, idx) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                  <div className="flex flex-col gap-1 text-left">
                    <span className="text-xs font-bold text-primary uppercase tracking-tight">{entry.action} — {entry.userName}</span>
                    <p className="text-[10px] text-muted-foreground font-mono font-bold uppercase">
                      {entry.timestamp ? format(new Date(entry.timestamp), 'dd MMM yy HH:mm') : '—'}
                    </p>
                    <p className="text-xs italic text-foreground/80 mt-1 leading-relaxed">"{entry.details}"</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingPayment} onOpenChange={(o) => !o && setDeletingPayment(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive font-black uppercase tracking-tight flex items-center gap-2"><Trash2 className="h-5 w-5" /> Remove Payment Record</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium">
              Permanently remove this payment of <strong>₹{deletingPayment?.amount.toLocaleString()}</strong>? The WO balance will be restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isProcessing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-sm font-bold uppercase text-[10px]">
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
