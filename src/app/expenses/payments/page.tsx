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
  Landmark, 
  Search, 
  History, 
  User as UserIcon, 
  Building2, 
  CheckCircle2, 
  ArrowRight,
  Loader2,
  Calendar,
  Send
} from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isSuperAdmin } from '@/lib/auth-constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

type ExpenseReport = {
  id: string;
  userId: string;
  userName: string;
  title: string;
  siteName: string;
  totalAmount: number;
  status: 'Approved' | 'Paid';
  paymentDetails?: {
    transactionId: string;
    paymentDate: any;
    paidBy: string;
  };
  createdAt: any;
};

export default function AccountPaymentsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedReport, setSelectedReport] = React.useState<ExpenseReport | null>(null);
  const [transactionId, setTransactionId] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isAccountDept = userProfile?.department === 'Account';

  // Simplified query: Removed 'orderBy' to prevent "disappearing" results due to missing indices
  const approvedQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'expenses');
    if (!isAdmin && !isAccountDept) return null;
    return query(colRef, where('status', 'in', ['Approved', 'Paid']), limit(150));
  }, [firestore, isAdmin, isAccountDept, user, isProfileLoading]);

  const { data: rawExpenses, isLoading: isExpensesLoading } = useCollection<ExpenseReport>(approvedQuery);

  // In-memory sorting for reliability
  const expenses = React.useMemo(() => {
    if (!rawExpenses) return [];
    return [...rawExpenses].sort((a, b) => {
      const da = a.createdAt?.toDate?.()?.getTime() || 0;
      const db = b.createdAt?.toDate?.()?.getTime() || 0;
      return db - da;
    });
  }, [rawExpenses]);

  const handleRecordPayment = async () => {
    if (!selectedReport || !transactionId || !user) return;
    setIsProcessing(true);

    try {
      const reportRef = doc(firestore, 'expenses', selectedReport.id);
      await updateDocumentNonBlocking(reportRef, {
        status: 'Paid',
        paymentDetails: {
          transactionId: transactionId,
          paymentDate: new Date(),
          paidBy: userProfile.username || user.email
        },
        updatedAt: serverTimestamp()
      });

      // Notify User
      addDocumentNonBlocking(collection(firestore, 'notifications'), {
        userId: selectedReport.userId,
        title: "Expense Reimbursed",
        description: `Payment for "${selectedReport.title}" has been processed. Trans ID: ${transactionId}`,
        link: "/rewards",
        read: false,
        createdAt: serverTimestamp(),
      });

      toast({ title: 'Payment Recorded', description: 'Transaction details published successfully.' });
      setSelectedReport(null);
      setTransactionId("");
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredExpenses = React.useMemo(() => {
    return expenses.filter(e => 
      e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.paymentDetails?.transactionId || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [expenses, searchTerm]);

  if (isProfileLoading || isExpensesLoading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!isAdmin && !isAccountDept) {
    return <div className="p-20 text-center text-destructive font-black uppercase tracking-widest">Unauthorized Access: Account Department Credentials Required</div>;
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2">
          <Landmark className="h-8 w-8 text-primary" /> Payment Disbursement
        </h1>
        <p className="text-muted-foreground text-sm font-medium">Record and track organizational reimbursements for approved reports.</p>
      </div>

      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search by personnel, site or trans ID..." 
          className="pl-10 h-11 text-sm rounded-sm border-primary/20"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6">Personnel</TableHead>
                  <TableHead>Approved Amount</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead>Audit Info</TableHead>
                  <TableHead className="text-right px-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.length > 0 ? filteredExpenses.map((expense) => (
                  <TableRow key={expense.id} className="hover:bg-muted/5 transition-colors">
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-foreground">{expense.userName}</span>
                        <span className="text-[9px] font-black uppercase text-muted-foreground leading-none mt-1">{expense.siteName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-black text-primary text-sm font-mono">
                      ₹{expense.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={expense.status === 'Paid' ? 'default' : 'outline'} className={cn(
                        "text-[8px] font-black uppercase rounded-sm px-1.5 h-5",
                        expense.status === 'Paid' ? "bg-emerald-500 text-white" : "bg-blue-50 text-blue-700 border-blue-200"
                      )}>
                        {expense.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {expense.status === 'Paid' ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase leading-none">UTR: {expense.paymentDetails?.transactionId}</span>
                          <span className="text-[8px] font-medium text-muted-foreground/60">{expense.paymentDetails?.paymentDate ? format(expense.paymentDetails.paymentDate.toDate(), 'dd MMM yy') : '—'}</span>
                        </div>
                      ) : (
                        <span className="text-[9px] font-black uppercase text-muted-foreground/40 italic">Awaiting Payout</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right px-6">
                      {expense.status === 'Approved' ? (
                        <Button size="sm" className="h-8 rounded-sm font-black text-[10px] uppercase px-4 bg-emerald-600 hover:bg-emerald-700 shadow-md" onClick={() => setSelectedReport(expense)}>
                          Process Payment
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setSelectedReport(expense)}><History className="h-4 w-4" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">No approved reports awaiting payment found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Payment Recording Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={(o) => !o && setSelectedReport(null)}>
        <DialogContent className="max-w-md rounded-sm p-0 overflow-hidden border-none shadow-2xl bg-background">
          <DialogHeader className="p-6 bg-emerald-500/10 border-b">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/20 p-2 rounded-sm"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight text-emerald-900">Record Payout</DialogTitle>
                <DialogDescription className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Amount: ₹{selectedReport?.totalAmount.toFixed(2)}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="p-6 space-y-6">
            <div className="space-y-4 p-4 border rounded-sm bg-muted/5">
              <div className="flex justify-between items-center text-[10px] font-black uppercase text-muted-foreground">
                <span>Beneficiary</span>
                <span className="text-foreground">{selectedReport?.userName}</span>
              </div>
              <Separator className="opacity-50" />
              <div className="flex justify-between items-center text-[10px] font-black uppercase text-muted-foreground">
                <span>Description</span>
                <span className="text-foreground max-w-[200px] truncate">{selectedReport?.title}</span>
              </div>
            </div>

            {selectedReport?.status === 'Approved' ? (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Transaction Reference / UTR No.</Label>
                <input 
                  placeholder="Enter reference number..." 
                  className="flex h-12 w-full rounded-sm border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm font-mono font-bold"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-4 p-4 bg-primary/5 border border-primary/10 rounded-sm">
                <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Disbursement Record</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase">Reference</p>
                    <p className="text-xs font-black font-mono">{selectedReport?.paymentDetails?.transactionId}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase">Processed By</p>
                    <p className="text-xs font-black">{selectedReport?.paymentDetails?.paidBy}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 bg-muted/5 border-t gap-3">
            <DialogClose asChild><Button variant="outline" className="rounded-sm font-black uppercase text-[10px] h-10 px-6 tracking-widest">Cancel</Button></DialogClose>
            {selectedReport?.status === 'Approved' && (
              <Button 
                onClick={handleRecordPayment} 
                className="rounded-sm font-black uppercase text-[10px] h-10 px-8 tracking-widest shadow-xl bg-emerald-600 hover:bg-emerald-700" 
                disabled={isProcessing || !transactionId}
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Publish Payment
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}