'use client';

import * as React from 'react';
import { 
  useFirestore, 
  useUser, 
  useDoc, 
  useMemoFirebase, 
  useCollection, 
  updateDocumentNonBlocking,
  addDocumentNonBlocking
} from '@/firebase';
import { collection, query, where, doc, limit, serverTimestamp } from 'firebase/firestore';
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
  ShieldCheck,
  MessageCircle,
  CreditCard,
  Clock
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

type ExpenseItem = {
  category: string;
  description: string;
  amount: number;
  proofUrl?: string;
};

type ExpenseReport = {
  id: string;
  userId: string;
  userName: string;
  title: string;
  type: 'Site' | 'General';
  siteName: string;
  totalAmount: number;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Paid';
  items: ExpenseItem[];
  remarks?: string;
  createdAt: any;
  paymentDetails?: {
    transactionId: string;
    paymentDate: any;
    paidBy: string;
  };
};

export default function ManageExpensesPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [selectedReport, setSelectedReport] = React.useState<ExpenseReport | null>(null);
  const [decisionState, setDecisionState] = React.useState<{ report: ExpenseReport, targetStatus: string } | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  // Simplified query: Removed 'orderBy' to prevent index requirement issues in prototypes
  const expensesQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'expenses');
    
    if (isAdmin) {
      return query(colRef, limit(150));
    }
    return query(colRef, where('userId', '==', user.uid), limit(100));
  }, [firestore, isAdmin, user, isProfileLoading]);

  const { data: rawExpenses, isLoading: isExpensesLoading } = useCollection<ExpenseReport>(expensesQuery);

  // In-memory sorting for robust results without manual composite index setup
  const expenses = React.useMemo(() => {
    if (!rawExpenses) return [];
    return [...rawExpenses].sort((a, b) => {
      const da = a.createdAt?.toDate?.()?.getTime() || 0;
      const db = b.createdAt?.toDate?.()?.getTime() || 0;
      return db - da;
    });
  }, [rawExpenses]);

  const handleDecision = async (remarks: string) => {
    if (!decisionState || !user) return;
    setIsProcessing(true);

    try {
      const reportRef = doc(firestore, 'expenses', decisionState.report.id);
      updateDocumentNonBlocking(reportRef, {
        status: decisionState.targetStatus,
        remarks: remarks,
        processedAt: serverTimestamp(),
        processedBy: user.uid,
        processedByName: userProfile.username || user.email
      });

      // Notify User
      addDocumentNonBlocking(collection(firestore, 'notifications'), {
        userId: decisionState.report.userId,
        title: `Expense Status: ${decisionStatusToTitle(decisionState.targetStatus)}`,
        description: `Your report "${decisionState.report.title}" has been ${decisionState.targetStatus.toLowerCase()}. Remarks: ${remarks}`,
        link: `/expenses/manage`,
        read: false,
        createdAt: serverTimestamp(),
      });

      toast({ title: 'Success', description: `Report updated to ${decisionState.targetStatus}.` });
      setDecisionState(null);
      setSelectedReport(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const decisionStatusToTitle = (status: string) => {
    if (status === 'Approved') return 'Authorized';
    if (status === 'Rejected') return 'Returned';
    return status;
  };

  const filteredExpenses = React.useMemo(() => {
    return expenses.filter(e => {
      const matchesSearch = e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.siteName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [expenses, searchTerm, statusFilter]);

  if (isProfileLoading || isExpensesLoading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1>{isAdmin ? "Manage All Expenses" : "My Expense History"}</h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium">Monitoring and authorization of organizational expenditures.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search report, site or user..." 
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
              <SelectItem value="all" className="text-xs font-bold">All Status</SelectItem>
              <SelectItem value="Pending" className="text-xs font-bold">Pending</SelectItem>
              <SelectItem value="Approved" className="text-xs font-bold text-green-600">Approved</SelectItem>
              <SelectItem value="Rejected" className="text-xs font-bold text-red-600">Rejected</SelectItem>
              <SelectItem value="Paid" className="text-xs font-bold text-emerald-600">Paid</SelectItem>
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
                  <TableHead className="px-6">Submission Info</TableHead>
                  <TableHead>Report Title</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right px-6">Audit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.length > 0 ? filteredExpenses.map((expense) => (
                  <TableRow key={expense.id} className="hover:bg-muted/5 transition-colors cursor-pointer" onClick={() => setSelectedReport(expense)}>
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                          <UserIcon className="h-3.5 w-3.5 text-primary" />
                          {expense.userName}
                        </div>
                        <div className="text-[9px] font-mono font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          {expense.createdAt ? format(expense.createdAt.toDate(), 'dd MMM yyyy') : '—'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-sm text-foreground truncate max-w-[200px]">{expense.title}</span>
                        <div className="flex items-center gap-1 text-[9px] font-black uppercase text-muted-foreground">
                          <Building2 className="h-3 w-3" /> {expense.siteName}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-black text-primary text-sm font-mono">
                      ₹{expense.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "text-[8px] font-black uppercase rounded-sm px-1.5 h-5",
                        expense.status === 'Pending' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                        expense.status === 'Approved' ? "bg-green-50 text-green-700 border-green-200" :
                        expense.status === 'Paid' ? "bg-emerald-500 text-white border-none" :
                        "bg-red-50 text-red-700 border-red-200"
                      )}>
                        {expense.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm"><Eye className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">No expense reports found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Audit Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={(o) => !o && setSelectedReport(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden border-none rounded-sm shadow-2xl bg-background">
          <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-sm"><Wallet className="h-5 w-5 text-primary" /></div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Expense Audit Log</DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Requester: {selectedReport?.userName}</DialogDescription>
              </div>
            </div>
            {selectedReport && (
              <Badge variant="outline" className={cn(
                "text-[9px] font-black uppercase rounded-sm px-2 h-6",
                selectedReport.status === 'Paid' ? "bg-emerald-500 text-white border-none" : "border-primary/20"
              )}>
                {selectedReport.status}
              </Badge>
            )}
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            {selectedReport && (
              <div className="p-8 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Report Title</Label>
                      <p className="text-lg font-black text-foreground leading-tight">{selectedReport.title}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Allocation</Label>
                      <div className="flex items-center gap-2 text-sm font-bold text-primary">
                        <Building2 className="h-4 w-4" /> {selectedReport.siteName}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-primary/5 rounded-sm border-2 border-primary/10 p-6 flex flex-col justify-center items-center text-center shadow-inner">
                    <span className="text-[10px] font-black uppercase text-primary tracking-widest mb-2">Aggregate Total</span>
                    <span className="text-4xl font-black tabular-nums text-primary">₹{selectedReport.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" /> Breakdown
                  </Label>
                  <div className="border rounded-sm overflow-hidden bg-muted/10">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="text-[10px] font-black uppercase px-4">Category</TableHead>
                          <TableHead className="text-[10px] font-black uppercase">Description</TableHead>
                          <TableHead className="text-[10px] font-black uppercase">Amount</TableHead>
                          <TableHead className="text-right px-4 text-[10px] font-black uppercase">Proof</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedReport.items.map((item, idx) => (
                          <TableRow key={idx} className="bg-background">
                            <TableCell className="px-4">
                              <Badge variant="secondary" className="text-[8px] h-4 px-1 rounded-sm uppercase font-bold">{item.category}</Badge>
                            </TableCell>
                            <TableCell className="text-xs font-semibold">{item.description}</TableCell>
                            <TableCell className="font-mono text-xs font-bold text-primary">₹{item.amount.toFixed(2)}</TableCell>
                            <TableCell className="text-right px-4">
                              {item.proofUrl ? (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-primary rounded-sm" asChild>
                                  <a href={item.proofUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
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

                {selectedReport.status === 'Paid' && selectedReport.paymentDetails && (
                  <div className="p-6 bg-emerald-50 border-2 border-emerald-100 rounded-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <CreditCard className="h-4 w-4" />
                      <Label className="text-[10px] font-black uppercase tracking-widest">Payment Confirmation</Label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <p className="text-[8px] font-bold text-emerald-600/60 uppercase">Transaction ID / UTR No.</p>
                        <p className="text-sm font-black font-mono text-emerald-900">{selectedReport.paymentDetails.transactionId}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[8px] font-bold text-emerald-600/60 uppercase">Payment Date</p>
                        <p className="text-sm font-black text-emerald-900 flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5" />
                          {selectedReport.paymentDetails.paymentDate ? format(selectedReport.paymentDetails.paymentDate.toDate(), 'dd MMMM yyyy') : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedReport.remarks && (
                  <div className="p-6 bg-red-50 border-2 border-red-100 rounded-sm space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-red-700">Audit Remarks</Label>
                    <p className="text-sm font-medium italic leading-relaxed text-red-900">"{selectedReport.remarks}"</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="p-4 bg-muted/5 border-t gap-3 shrink-0">
            {isAdmin && selectedReport?.status === 'Pending' && (
              <div className="flex gap-2 w-full justify-end">
                <Button className="h-10 rounded-sm font-black uppercase text-[10px] tracking-widest bg-green-600 hover:bg-green-700 px-6" onClick={() => setDecisionState({ report: selectedReport, targetStatus: 'Approved' })}>Approve</Button>
                <Button variant="destructive" className="h-10 rounded-sm font-black uppercase text-[10px] tracking-widest px-6" onClick={() => setDecisionState({ report: selectedReport, targetStatus: 'Rejected' })}>Reject</Button>
              </div>
            )}
            <DialogClose asChild><Button variant="outline" className="rounded-sm font-black uppercase text-[10px] h-10 px-8 tracking-widest">Close Audit</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog open={!!decisionState} onOpenChange={() => setDecisionState(null)}>
        <DialogContent className="rounded-sm max-w-md">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-tight font-black">Confirm {decisionState?.targetStatus}</DialogTitle>
            <DialogDescription>Provide feedback for this organizational expenditure audit.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Remarks / Observations</Label>
              <Textarea id="audit-remarks" placeholder="Explain the decision for organizational records..." className="min-h-[120px] rounded-sm" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild><Button variant="ghost" className="rounded-sm font-bold h-11 px-6 uppercase text-[10px]">Cancel</Button></DialogClose>
            <Button 
              disabled={isProcessing} 
              className={cn("rounded-sm font-black h-11 px-8 uppercase text-[10px] tracking-widest", decisionState?.targetStatus === 'Rejected' ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90")}
              onClick={() => {
                const remarks = (document.getElementById('audit-remarks') as HTMLTextAreaElement)?.value || "";
                handleDecision(remarks);
              }}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm decision'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}