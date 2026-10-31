
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
  Clock,
  Fuel
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
import { sendNotification } from '@/lib/notifications';

type ExpenseItem = {
  category: string;
  description: string;
  date: string;
  kmReading?: number;
  amount: number;
  proofUrl?: string;
};

type ApprovalEntry = {
  adminId: string;
  adminName: string;
  timestamp: string;
  remarks: string;
};

type ExpenseReport = {
  id: string;
  userId: string;
  userName: string;
  title: string;
  type: 'Site' | 'General';
  siteName: string;
  totalAmount: number;
  status: 'Pending' | 'FirstApproved' | 'Approved' | 'Rejected' | 'Paid';
  items: ExpenseItem[];
  remarks?: string;
  createdAt: any;
  approvals?: ApprovalEntry[];
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

  const expensesQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'expenses');
    
    if (isAdmin) {
      return query(colRef, limit(150));
    }
    return query(colRef, where('userId', '==', user.uid), limit(100));
  }, [firestore, isAdmin, user, isProfileLoading]);

  const { data: rawExpenses, isLoading: isExpensesLoading } = useCollection<ExpenseReport>(expensesQuery);

  const expenses = React.useMemo(() => {
    if (!rawExpenses) return [];
    return [...rawExpenses].sort((a, b) => {
      const da = a.createdAt?.toDate?.()?.getTime() || 0;
      const db = b.createdAt?.toDate?.()?.getTime() || 0;
      return db - da;
    });
  }, [rawExpenses]);

  const handleDecision = async (remarks: string) => {
    if (!decisionState || !user || !userProfile) return;
    setIsProcessing(true);

    try {
      const reportRef = doc(firestore, 'expenses', decisionState.report.id);
      
      if (decisionState.targetStatus === 'Rejected') {
        updateDocumentNonBlocking(reportRef, {
          status: 'Rejected',
          remarks: remarks,
          processedAt: serverTimestamp(),
          processedBy: user.uid,
          processedByName: userProfile.username || user.email
        });

        sendNotification(firestore, {
          userId: decisionState.report.userId,
          title: `Expense Rejected`,
          description: `Your report "${decisionState.report.title}" has been rejected. Remarks: ${remarks}`,
          link: `/expenses/list?view=${decisionState.report.id}`,
          push: true,
        });
      } else {
        const currentApprovals = decisionState.report.approvals || [];
        
        if (currentApprovals.some(a => a.adminId === user.uid)) {
          toast({ variant: 'destructive', title: 'Already Approved', description: 'You have already authorized this request.' });
          setIsProcessing(false);
          return;
        }

        const newApproval: ApprovalEntry = {
          adminId: user.uid,
          adminName: userProfile.username || user.email || 'Admin',
          timestamp: new Date().toISOString(),
          remarks: remarks
        };

        const nextApprovals = [...currentApprovals, newApproval];
        const isFullyApproved = nextApprovals.length >= 2;

        updateDocumentNonBlocking(reportRef, {
          status: isFullyApproved ? 'Approved' : 'FirstApproved',
          approvals: nextApprovals,
          remarks: remarks,
          processedAt: serverTimestamp(),
          processedBy: user.uid,
          processedByName: userProfile.username || user.email
        });

        sendNotification(firestore, {
          userId: decisionState.report.userId,
          title: isFullyApproved ? 'Expense Fully Approved' : 'Expense Level 1 Approved',
          description: isFullyApproved 
            ? `Your report "${decisionState.report.title}" has received final approval.` 
            : `Level 1 approval received for "${decisionState.report.title}". Awaiting second administrator audit.`,
          link: `/expenses/list?view=${decisionState.report.id}`,
          push: true,
        });
      }

      toast({ title: 'Success', description: `Audit decision recorded.` });
      setDecisionState(null);
      setSelectedReport(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsProcessing(false);
    }
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
      <div className="flex flex-col gap-1">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <h1>{isAdmin ? "Manage All Expenses" : "My Expense History"}</h1>
            </div>
            <p className="text-muted-foreground text-sm font-medium">Monitoring and authorization of organizational expenditures.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm no-print">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search report, site or user..." 
            className="pl-10 h-10 text-sm rounded-sm border-primary/20 bg-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-10 text-xs font-bold uppercase tracking-tight rounded-sm border-primary/20 bg-background">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs font-bold">All Status</SelectItem>
              <SelectItem value="Pending" className="text-xs font-bold">Pending</SelectItem>
              <SelectItem value="FirstApproved" className="text-xs font-bold text-indigo-600">1/2 Approved</SelectItem>
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
                {filteredExpenses.length > 0 ? filteredExpenses.map((expense) => {
                  const hasApproved = expense.approvals?.some(a => a.adminId === user?.uid);
                  
                  return (
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
                          expense.status === 'FirstApproved' ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                          expense.status === 'Approved' ? "bg-green-50 text-green-700 border-green-200" :
                          expense.status === 'Paid' ? "bg-emerald-500 text-white border-none" :
                          "bg-red-50 text-red-700 border-red-200"
                        )}>
                          {expense.status === 'FirstApproved' ? '1/2 Approved' : expense.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                          {isAdmin && (expense.status === 'Pending' || (expense.status === 'FirstApproved' && !hasApproved)) && (
                            <div className="flex gap-1 mr-2">
                               <Button size="sm" className="h-8 rounded-sm bg-green-600 hover:bg-green-700 font-bold px-3" onClick={() => setDecisionState({ report: expense, targetStatus: 'Approved' })}>
                                  {expense.status === 'FirstApproved' ? 'Final Approve' : 'Approve'}
                               </Button>
                               <Button size="sm" variant="destructive" className="h-8 rounded-sm font-bold px-3" onClick={() => setDecisionState({ report: expense, targetStatus: 'Rejected' })}>
                                  Reject
                               </Button>
                            </div>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm"><Eye className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">No expense reports found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedReport} onOpenChange={(o) => !o && setSelectedReport(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-none rounded-sm shadow-2xl bg-background flex flex-col h-[90vh]">
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
                {selectedReport.status === 'FirstApproved' ? '1/2 Approved' : selectedReport.status}
              </Badge>
            )}
          </DialogHeader>

          <ScrollArea className="flex-1">
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

                {selectedReport.approvals && selectedReport.approvals.length > 0 && (
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" /> Approval Trail
                    </Label>
                    <div className="space-y-3">
                      {selectedReport.approvals.map((approval, idx) => (
                        <div key={idx} className="p-4 rounded-sm border-2 bg-green-50 border-green-100 space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase text-green-700">Audit Level {idx + 1}</span>
                              <span className="text-sm font-bold text-green-900">{approval.adminName}</span>
                            </div>
                            <span className="text-[9px] font-mono font-bold text-green-600/60 uppercase">
                              {format(new Date(approval.timestamp), 'dd MMM yyyy, HH:mm')}
                            </span>
                          </div>
                          <p className="text-xs font-medium italic text-green-800 leading-relaxed">
                            "{approval.remarks || 'No remarks provided.'}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" /> Breakdown
                  </Label>
                  <div className="border rounded-sm overflow-hidden bg-muted/10">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="text-[10px] font-black uppercase px-4">Date</TableHead>
                          <TableHead className="text-[10px] font-black uppercase">Category</TableHead>
                          <TableHead className="text-[10px] font-black uppercase">Description</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-center">Reading</TableHead>
                          <TableHead className="text-[10px] font-black uppercase">Amount</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase px-4">Proof</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedReport.items.map((item, idx) => (
                          <TableRow key={idx} className="bg-background">
                            <TableCell className="px-4 font-mono text-[10px] font-bold text-muted-foreground">{item.date}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-[8px] h-4 px-1 rounded-sm uppercase font-bold">{item.category}</Badge>
                            </TableCell>
                            <TableCell className="text-xs font-semibold">{item.description}</TableCell>
                            <TableCell className="text-center">
                              {item.category === 'Travelling' && item.kmReading ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-[10px] font-black text-primary">{item.kmReading} KM</span>
                                </div>
                              ) : '—'}
                            </TableCell>
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

                {selectedReport.remarks && selectedReport.status === 'Rejected' && (
                  <div className="p-6 bg-red-50 border-2 border-red-100 rounded-sm space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-red-700">Rejection Remarks</Label>
                    <p className="text-sm font-medium italic leading-relaxed text-red-900">"{selectedReport.remarks}"</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="p-4 bg-muted/5 border-t gap-3 shrink-0">
            {isAdmin && (selectedReport?.status === 'Pending' || selectedReport?.status === 'FirstApproved') && (
              <div className="flex gap-2 w-full justify-end">
                <Button 
                  className="h-10 rounded-sm font-black uppercase text-[10px] tracking-widest bg-green-600 hover:bg-green-700 px-8" 
                  onClick={() => { setDecisionState({ report: selectedReport!, targetStatus: 'Approved' }); setSelectedReport(null); }}
                  disabled={selectedReport.approvals?.some(a => a.adminId === user?.uid)}
                >
                  {selectedReport.status === 'FirstApproved' ? 'Final Approve' : 'Approve'}
                </Button>
                <Button variant="destructive" className="h-10 rounded-sm font-black uppercase text-[10px] tracking-widest px-8" onClick={() => { setDecisionState({ report: selectedReport!, targetStatus: 'Rejected' }); setSelectedReport(null); }}>Reject</Button>
              </div>
            )}
            <DialogClose asChild><Button variant="outline" className="rounded-sm font-black uppercase text-[10px] h-10 px-8 tracking-widest">Close Audit</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!decisionState} onOpenChange={() => setDecisionState(null)}>
        <DialogContent className="rounded-sm max-md">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-tight font-black">Confirm {decisionState?.targetStatus === 'Approved' ? (decisionState.report.status === 'FirstApproved' ? 'Final Approval' : 'Level 1 Approval') : 'Rejection'}</DialogTitle>
            <DialogDescription>Provide feedback for this organizational expenditure audit.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Remarks / Observations</Label>
              <Textarea id="audit-remarks" placeholder="Explain the decision for organizational records..." className="min-h-[120px] rounded-sm" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild><Button variant="outline" className="rounded-sm font-bold h-11 px-6 uppercase text-[10px]">Cancel</Button></DialogClose>
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

function SummaryCard({ title, value, icon: Icon, color }: { title: string, value: number, icon: any, color: 'primary' | 'emerald' | 'blue' | 'amber' }) {
  const colors = {
    primary: "bg-primary/5 border-primary/10 text-primary",
    emerald: "bg-emerald-500/5 border-emerald-500/10 text-emerald-600",
    blue: "bg-blue-500/5 border-blue-500/10 text-blue-600",
    amber: "bg-amber-500/5 border-amber-500/10 text-amber-600",
  };

  return (
    <Card className={cn("rounded-sm border shadow-sm", colors[color])}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4">
        <CardTitle className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
        <Icon className="h-3.5 sm:h-4 sm:w-4" />
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0">
        <div className="text-xl sm:text-2xl font-black">{value}</div>
      </CardContent>
    </Card>
  );
}
