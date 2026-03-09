
'use client';

import * as React from 'react';
import { 
  useFirestore, 
  useUser, 
  useDoc, 
  useMemoFirebase, 
  useCollection, 
  updateDocumentNonBlocking 
} from '@/firebase';
import { collection, query, where, orderBy, doc, limit, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Wallet, 
  Search, 
  FilterX, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  History, 
  User as UserIcon, 
  Calendar, 
  Building2, 
  ExternalLink,
  Loader2,
  FileText,
  AlertCircle,
  MoreHorizontal,
  ChevronRight,
  Receipt
} from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { isSuperAdmin } from '@/lib/auth-constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

type ExpenseItem = {
  description: string;
  amount: number;
  date: string;
  receiptUrl?: string;
};

type ExpenseClaim = {
  id: string;
  userId: string;
  userName: string;
  title: string;
  siteName: string;
  totalAmount: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  items: ExpenseItem[];
  createdAt: any;
  adminRemarks?: string;
  processedAt?: any;
};

type UserProfile = {
  id: string;
  username: string;
  role: string;
};

export default function ExpensesListPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [selectedClaim, setSelectedClaim] = React.useState<ExpenseClaim | null>(null);
  const [actionState, setActionState] = React.useState<{ claim: ExpenseClaim, type: 'Approved' | 'Rejected' } | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);
  
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const expensesQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'expenses');
    
    if (isAdmin) {
      return query(colRef, orderBy('createdAt', 'desc'), limit(100));
    }
    return query(colRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(50));
  }, [firestore, isAdmin, user, isProfileLoading]);

  const { data: claims, isLoading: isClaimsLoading } = useCollection<ExpenseClaim>(expensesQuery);

  const handleAction = async (remarks: string) => {
    if (!actionState) return;
    setIsProcessing(true);

    try {
      const claimRef = doc(firestore, 'expenses', actionState.claim.id);
      await updateDocumentNonBlocking(claimRef, {
        status: actionState.type,
        adminRemarks: remarks,
        processedAt: serverTimestamp(),
        adminId: user?.uid,
      });

      // Notify User
      await addDocumentNonBlocking(collection(firestore, 'notifications'), {
        userId: actionState.claim.userId,
        title: `Expense Claim ${actionState.type}`,
        description: `Your claim "${actionState.claim.title}" was ${actionState.type.toLowerCase()}. Remarks: ${remarks}`,
        link: "/expenses/list",
        read: false,
        createdAt: serverTimestamp(),
      });

      toast({ title: `Claim ${actionState.type}`, description: 'The expense record has been updated.' });
      setActionState(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredClaims = React.useMemo(() => {
    if (!claims) return [];
    return claims.filter(c => {
      const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.siteName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [claims, searchTerm, statusFilter]);

  if (isProfileLoading || isClaimsLoading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-black tracking-tight uppercase">{isAdmin ? "All Organizational Expenses" : "My Expense History"}</h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium">Tracking and auditing payments, purchases and reimbursements.</p>
        </div>
        <Button onClick={() => router.push('/expenses/submit')} className="h-10 rounded-sm font-bold shadow-md px-6">
          <Plus className="h-4 w-4 mr-2" /> New Expense Claim
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search claim, personnel or site..." 
            className="pl-10 h-10 text-sm rounded-sm border-primary/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-10 text-xs font-bold uppercase tracking-tight rounded-sm border-primary/20">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs font-bold">All Claims</SelectItem>
              <SelectItem value="Pending" className="text-xs font-bold">Pending</SelectItem>
              <SelectItem value="Approved" className="text-xs font-bold text-green-600">Approved</SelectItem>
              <SelectItem value="Rejected" className="text-xs font-bold text-red-600">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={() => { setSearchTerm(""); setStatusFilter("all"); }} className="h-10 w-10 text-muted-foreground rounded-sm">
            <FilterX className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6 min-w-[150px]">Date & Personnel</TableHead>
                  <TableHead className="min-w-[200px]">Claim Summary</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Site / Context</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClaims.length > 0 ? filteredClaims.map((claim) => (
                  <TableRow key={claim.id} className="hover:bg-muted/5 transition-colors cursor-pointer" onClick={() => setSelectedClaim(claim)}>
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          {claim.createdAt ? format(claim.createdAt.toDate(), 'dd MMM yyyy') : '—'}
                        </div>
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-3.5 w-3.5 text-primary" />
                          <span className="font-bold text-sm text-foreground">{claim.userName}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-sm leading-tight text-foreground">{claim.title}</span>
                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">{claim.items.length} Expense Item(s)</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-black text-primary text-sm font-mono">
                      ₹{claim.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5" />
                        {claim.siteName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "text-[8px] font-black uppercase rounded-sm px-1.5 h-5",
                        claim.status === 'Pending' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                        claim.status === 'Approved' ? "bg-green-50 text-green-700 border-green-200" :
                        "bg-red-50 text-red-700 border-red-200"
                      )}>
                        {claim.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                        {isAdmin && claim.status === 'Pending' && (
                          <div className="flex gap-1">
                            <Button size="sm" className="h-8 rounded-sm bg-green-600 hover:bg-green-700 font-bold px-3" onClick={() => setActionState({ claim, type: 'Approved' })}>
                              Approve
                            </Button>
                            <Button size="sm" variant="destructive" className="h-8 rounded-sm font-bold px-3" onClick={() => setActionState({ claim, type: 'Rejected' })}>
                              Reject
                            </Button>
                          </div>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => setSelectedClaim(claim)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">No expense claims found matching filters.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Claim Detail Modal */}
      <Dialog open={!!selectedClaim} onOpenChange={(o) => !o && setSelectedClaim(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden border-none rounded-sm shadow-2xl bg-background">
          <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-sm"><Wallet className="h-5 w-5 text-primary" /></div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Expense Audit Log</DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Submitted by {selectedClaim?.userName}</DialogDescription>
              </div>
            </div>
            {selectedClaim && (
              <Badge variant="outline" className={cn(
                "text-[9px] font-black uppercase rounded-sm px-2 h-6",
                selectedClaim.status === 'Approved' ? "bg-green-100 text-green-800" : 
                selectedClaim.status === 'Pending' ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"
              )}>
                {selectedClaim.status}
              </Badge>
            )}
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            {selectedClaim && (
              <div className="p-8 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Claim Title</Label>
                      <p className="text-lg font-black text-foreground leading-tight">{selectedClaim.title}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Context / Site</Label>
                      <div className="flex items-center gap-2 text-sm font-bold text-primary">
                        <Building2 className="h-4 w-4" />
                        {selectedClaim.siteName}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-primary/5 rounded-sm border-2 border-primary/10 p-6 flex flex-col justify-center items-center text-center shadow-inner">
                    <span className="text-[10px] font-black uppercase text-primary tracking-widest leading-none mb-2">Total Amount Requested</span>
                    <span className="text-4xl font-black tabular-nums text-primary">₹{selectedClaim.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" /> Breakdown of Expenses
                  </Label>
                  <div className="border rounded-sm overflow-hidden bg-muted/10">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="text-[10px] font-black uppercase px-4">Date</TableHead>
                          <TableHead className="text-[10px] font-black uppercase">Description</TableHead>
                          <TableHead className="text-[10px] font-black uppercase">Amount</TableHead>
                          <TableHead className="text-right px-4 text-[10px] font-black uppercase">Voucher</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedClaim.items.map((item, idx) => (
                          <TableRow key={idx} className="bg-background">
                            <TableCell className="px-4 font-mono text-[10px] font-bold text-muted-foreground">{item.date}</TableCell>
                            <TableCell className="text-xs font-semibold leading-relaxed">{item.description}</TableCell>
                            <TableCell className="font-mono text-xs font-bold text-primary">₹{item.amount.toFixed(2)}</TableCell>
                            <TableCell className="text-right px-4">
                              {item.receiptUrl ? (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-primary rounded-sm" asChild>
                                  <a href={item.receiptUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                                </Button>
                              ) : (
                                <span className="text-[8px] font-black uppercase text-muted-foreground/30 italic">No File</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {(selectedClaim.adminRemarks || selectedClaim.status !== 'Pending') && (
                  <div className={cn(
                    "p-6 rounded-sm border-2 space-y-2",
                    selectedClaim.status === 'Approved' ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"
                  )}>
                    <Label className={cn(
                      "text-[10px] font-black uppercase tracking-widest",
                      selectedClaim.status === 'Approved' ? "text-green-700" : "text-red-700"
                    )}>Reviewer Remarks</Label>
                    <p className="text-sm font-medium italic leading-relaxed text-foreground/80">
                      "{selectedClaim.adminRemarks || 'The request was processed without specific remarks.'}"
                    </p>
                    {selectedClaim.processedAt && (
                      <p className="text-[9px] font-bold opacity-40 uppercase pt-2">
                        Processed on {format(selectedClaim.processedAt.toDate(), 'dd MMM yyyy, HH:mm')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="p-4 bg-muted/5 border-t gap-3 shrink-0">
            {isAdmin && selectedClaim?.status === 'Pending' && (
              <div className="flex flex-1 gap-2">
                <Button className="h-10 rounded-sm font-black uppercase text-[10px] tracking-widest bg-green-600 hover:bg-green-700 px-6" onClick={() => { setSelectedClaim(null); setActionState({ claim: selectedClaim!, type: 'Approved' }); }}>Approve Claim</Button>
                <Button variant="destructive" className="h-10 rounded-sm font-black uppercase text-[10px] tracking-widest px-6" onClick={() => { setSelectedClaim(null); setActionState({ claim: selectedClaim!, type: 'Rejected' }); }}>Reject Claim</Button>
              </div>
            )}
            <DialogClose asChild><Button variant="outline" className="rounded-sm font-black uppercase text-[10px] h-10 px-8 tracking-widest">Close Audit</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Decision Modal */}
      <Dialog open={!!actionState} onOpenChange={() => setActionState(null)}>
        <DialogContent className="rounded-sm max-w-md">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-tight font-black">{actionState?.type} Claim</DialogTitle>
            <DialogDescription>Setting final status for "{actionState?.claim.title}"</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="p-4 bg-muted/30 border-2 border-dashed rounded-sm text-center">
              <span className="text-xs font-bold text-muted-foreground uppercase block mb-1">Total Requested Amount</span>
              <span className="text-2xl font-black text-primary">₹{actionState?.claim.totalAmount.toLocaleString()}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-remarks" className="text-xs font-bold uppercase text-muted-foreground">Internal Decision Remarks</Label>
              <Textarea 
                id="admin-remarks" 
                placeholder="Briefly explain approval/rejection for personnel records..." 
                className="min-h-[100px] rounded-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild><Button variant="ghost" className="rounded-sm font-bold h-11 px-6 uppercase text-[10px]">Cancel</Button></DialogClose>
            <Button 
              disabled={isProcessing} 
              className={cn("rounded-sm font-black h-11 px-8 uppercase text-[10px] tracking-widest", actionState?.type === 'Approved' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700")}
              onClick={() => {
                const remarks = (document.getElementById('admin-remarks') as HTMLTextAreaElement)?.value || "";
                handleAction(remarks);
              }}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : `Confirm ${actionState?.type}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
