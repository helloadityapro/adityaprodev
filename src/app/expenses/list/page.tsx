'use client';

import * as React from 'react';
import { 
  useFirestore, 
  useUser, 
  useDoc, 
  useMemoFirebase, 
  useCollection, 
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
  useFirebaseApp
} from '@/firebase';
import { collection, query, where, doc, limit, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
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
  Plus,
  MessageCircle,
  Pencil,
  Trash2,
  X,
  FileUp,
  Save,
  ChevronsUpDown,
  Check,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from '@/components/ui/scroll-area';
import { sendNotification } from '@/lib/notifications';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const expenseItemSchema = z.object({
  category: z.string().min(1, 'Category is required.'),
  description: z.string().min(1, 'Description is required.'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
  receiptUrl: z.string().optional(),
  localFile: z.any().optional(),
});

const editExpenseSchema = z.object({
  title: z.string().min(3, 'Title is required.'),
  siteName: z.string().min(1, 'Site is required.'),
  items: z.array(expenseItemSchema).min(1, 'At least one item required.'),
});

type ExpenseItem = z.infer<typeof expenseItemSchema>;

type ApprovalEntry = {
  adminId: string;
  adminName: string;
  timestamp: string;
  remarks: string;
};

type ExpenseSubmission = {
  id: string;
  userId: string;
  userName: string;
  title: string;
  siteName: string;
  totalAmount: number;
  status: 'Pending' | 'FirstApproved' | 'Approved' | 'Rejected' | 'Paid';
  items: ExpenseItem[];
  createdAt: any;
  adminRemarks?: string;
  processedAt?: any;
  approvals?: ApprovalEntry[];
};

type UserProfile = {
  id: string;
  username: string;
  role: string;
};

export default function ExpensesListPage() {
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [selectedExpense, setSelectedExpense] = React.useState<ExpenseSubmission | null>(null);
  const [actionState, setActionState] = React.useState<{ expense: ExpenseSubmission, type: 'Approved' | 'Rejected' } | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [deletingExpense, setDeletingExpense] = React.useState<ExpenseSubmission | null>(null);
  const [editingExpense, setEditingExpense] = React.useState<ExpenseSubmission | null>(null);

  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  const [uploadProgress, setUploadProgress] = React.useState<Record<number, number>>({});

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);
  
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<{ name: string; id: string }>(sitesQuery);

  const categoriesQuery = useMemoFirebase(() => collection(firestore, 'expense_categories'), [firestore]);
  const { data: categories } = useCollection<{ name: string; id: string }>(categoriesQuery);

  const expensesQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'expenses');
    
    if (isAdmin) {
      return query(colRef, limit(150));
    }
    return query(colRef, where('userId', '==', user.uid), limit(100));
  }, [firestore, isAdmin, user, isProfileLoading]);

  const { data: expenses, isLoading: isExpensesLoading } = useCollection<ExpenseSubmission>(expensesQuery);

  const editForm = useForm<z.infer<typeof editExpenseSchema>>({
    resolver: zodResolver(editExpenseSchema),
  });

  const { fields, append, remove } = useFieldArray({
    control: editForm.control,
    name: "items"
  });

  const watchedItems = useWatch({
    control: editForm.control,
    name: "items",
  }) || [];

  React.useEffect(() => {
    if (editingExpense) {
      editForm.reset({
        title: editingExpense.title,
        siteName: editingExpense.siteName,
        items: editingExpense.items.map(item => ({
          ...item,
          localFile: null
        }))
      });
    }
  }, [editingExpense, editForm]);

  // Handle deep link via URL view parameter
  React.useEffect(() => {
    const viewId = searchParams.get('view');
    if (viewId && expenses && expenses.length > 0) {
      const found = expenses.find(e => e.id === viewId);
      if (found) {
        setSelectedExpense(found);
      }
    }
  }, [searchParams, expenses]);

  const handleCloseDetail = () => {
    setSelectedExpense(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('view');
    const queryStr = params.toString();
    router.replace(`${pathname}${queryStr ? `?${queryStr}` : ''}`);
  };

  const handleAction = async (remarks: string) => {
    if (!actionState || !user || !userProfile) return;
    setIsProcessing(true);

    try {
      const expenseRef = doc(firestore, 'expenses', actionState.expense.id);
      
      if (actionState.type === 'Rejected') {
        updateDocumentNonBlocking(expenseRef, {
          status: 'Rejected',
          adminRemarks: remarks,
          processedAt: serverTimestamp(),
          processedById: user.uid,
          processedByName: userProfile.username
        });

        sendNotification(firestore, {
          userId: actionState.expense.userId,
          title: `Expense Rejected`,
          description: `Your submission "${actionState.expense.title}" was rejected. Remarks: ${remarks}`,
          link: `/expenses/list?view=${actionState.expense.id}`,
          push: true,
        });
      } else {
        // Dual Approval Logic
        const currentApprovals = actionState.expense.approvals || [];
        
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

        updateDocumentNonBlocking(expenseRef, {
          status: isFullyApproved ? 'Approved' : 'FirstApproved',
          approvals: nextApprovals,
          adminRemarks: remarks,
          processedAt: serverTimestamp(),
          processedById: user.uid,
          processedByName: userProfile.username,
        });

        sendNotification(firestore, {
          userId: actionState.expense.userId,
          title: isFullyApproved ? 'Expense Fully Approved' : 'Expense Level 1 Approved',
          description: isFullyApproved 
            ? `Your submission "${actionState.expense.title}" has received final approval.` 
            : `Level 1 approval received for "${actionState.expense.title}". Awaiting second administrator audit.`,
          link: `/expenses/list?view=${actionState.expense.id}`,
          push: true,
        });
      }

      toast({ title: 'Success', description: 'Action recorded in the audit trail.' });
      setActionState(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!deletingExpense) return;
    setIsProcessing(true);
    try {
      deleteDocumentNonBlocking(doc(firestore, 'expenses', deletingExpense.id));
      toast({ title: 'Record Removed', description: 'The expense submission has been deleted.' });
      setDeletingExpense(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const uploadFile = async (file: File, userId: string, index: number): Promise<string | null> => {
    if (!file) return null;
    const storage = getStorage(firebaseApp);
    const timestamp = Date.now();
    const storagePath = `expenses/${userId}/${timestamp}_edit_${index}_${file.name.replace(/\s+/g, '_')}`;
    const storageRef = ref(storage, storagePath);
    
    const uploadTask = uploadBytesResumable(storageRef, file);
    
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(prev => ({ ...prev, [index]: progress }));
        }, 
        reject, 
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(url);
        }
      );
    });
  };

  const onEditSubmit = async (values: z.infer<typeof editExpenseSchema>) => {
    if (!editingExpense || !user) return;
    setIsProcessing(true);
    setUploadProgress({});

    try {
      const processedItems = await Promise.all(values.items.map(async (item, idx) => {
        let finalUrl = item.receiptUrl || "";
        if (item.localFile instanceof File) {
          const uploadedUrl = await uploadFile(item.localFile, user.uid, idx);
          if (uploadedUrl) finalUrl = uploadedUrl;
        }
        const { localFile, ...rest } = item;
        return { ...rest, receiptUrl: finalUrl };
      }));

      const totalAmount = processedItems.reduce((sum, i) => sum + i.amount, 0);

      updateDocumentNonBlocking(doc(firestore, 'expenses', editingExpense.id), {
        title: values.title,
        siteName: values.siteName,
        items: processedItems,
        totalAmount,
        updatedAt: serverTimestamp(),
      });

      toast({ title: 'Submission Updated', description: 'Changes saved successfully.' });
      setEditingExpense(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
    } finally {
      setIsProcessing(false);
      setUploadProgress({});
    }
  };

  const triggerWhatsApp = (expense: ExpenseSubmission) => {
    const itemsList = expense.items.map(item => `- [${item.category}] ${item.description}: ₹${item.amount.toFixed(2)}`).join('\n');
    const message = `*Aditya Pro - New Expense Submission*\n\n*Title:* ${expense.title}\n*Site:* ${expense.siteName}\n*Total:* ₹${expense.totalAmount.toFixed(2)}\n\n*Items:*\n${itemsList}\n\n*Submitted By:* ${expense.userName}\n\n*Review Link:* ${window.location.origin}/expenses/list?view=${expense.id}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const filteredExpenses = React.useMemo(() => {
    if (!expenses) return [];
    
    // Sort in memory to avoid index requirements
    const sorted = [...expenses].sort((a, b) => {
      const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
      const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
      return dateB - dateA;
    });

    return sorted.filter(e => {
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
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            <h1>{isAdmin ? "Organization Expenses" : "My Expense History"}</h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium">Tracking and auditing organizational payments and purchases.</p>
        </div>
        <Button onClick={() => router.push('/expenses/submit')} className="h-10 rounded-sm font-bold shadow-md px-6">
          <Plus className="h-4 w-4 mr-2" /> New Expense Submission
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm no-print">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search personnel or site..." 
            className="pl-10 h-10 text-sm rounded-sm border-primary/20 bg-background"
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
              <SelectItem value="all" className="text-xs font-bold">All Submissions</SelectItem>
              <SelectItem value="Pending" className="text-xs font-bold">Pending</SelectItem>
              <SelectItem value="FirstApproved" className="text-xs font-bold text-indigo-600">1/2 Approved</SelectItem>
              <SelectItem value="Approved" className="text-xs font-bold text-green-600">Final Approved</SelectItem>
              <SelectItem value="Rejected" className="text-xs font-bold text-red-600">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={() => { setSearchTerm(""); setStatusFilter("all"); }} className="h-10 w-10 text-muted-foreground rounded-sm">
            <FilterX className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mobile-Responsive Card List */}
      <div className="md:hidden space-y-4">
        {filteredExpenses.length > 0 ? filteredExpenses.map((expense) => {
          const canDelete = isAdmin || expense.userId === user?.uid;
          const canEdit = expense.userId === user?.uid && expense.status === 'Pending';
          
          return (
            <Card key={expense.id} className="border-primary/10 rounded-sm shadow-sm overflow-hidden" onClick={() => setSelectedExpense(expense)}>
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">{expense.createdAt ? format(expense.createdAt.toDate(), 'dd MMM yyyy') : '—'}</span>
                    <h3 className="font-bold text-sm leading-tight text-foreground truncate">{expense.title}</h3>
                  </div>
                  <Badge variant="outline" className={cn(
                    "text-[8px] font-black uppercase rounded-sm px-1.5 h-5",
                    expense.status === 'Pending' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                    expense.status === 'FirstApproved' ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                    expense.status === 'Approved' ? "bg-green-50 text-green-700 border-green-200" :
                    "bg-red-50 text-red-700 border-red-200"
                  )}>
                    {expense.status === 'FirstApproved' ? '1/2 Approved' : expense.status}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" />
                    {expense.siteName}
                  </div>
                  <span className="font-black text-primary text-sm font-mono">₹{expense.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="pt-2 border-t border-primary/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserIcon className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-bold text-muted-foreground">{expense.userName}</span>
                  </div>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 rounded-sm" onClick={() => triggerWhatsApp(expense)}>
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => setSelectedExpense(expense)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canEdit && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => setEditingExpense(expense)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => setDeletingExpense(expense)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        }) : (
          <div className="text-center py-12 text-muted-foreground italic bg-muted/5 border-2 border-dashed rounded-sm">
            No expense submissions found.
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-6 min-w-[150px]">Date & Personnel</TableHead>
                    <TableHead className="min-w-[200px]">Submission Summary</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Site Context</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right px-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense) => {
                    const canDelete = isAdmin || expense.userId === user?.uid;
                    const canEdit = expense.userId === user?.uid && expense.status === 'Pending';
                    const hasApproved = expense.approvals?.some(a => a.adminId === user?.uid);

                    return (
                      <TableRow key={expense.id} className="hover:bg-muted/5 transition-colors cursor-pointer" onClick={() => setSelectedExpense(expense)}>
                        <TableCell className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                              <Calendar className="h-3 w-3" />
                              {expense.createdAt ? format(expense.createdAt.toDate(), 'dd MMM yyyy') : '—'}
                            </div>
                            <div className="flex items-center gap-2">
                              <UserIcon className="h-3.5 w-3.5 text-primary" />
                              <span className="font-bold text-sm text-foreground">{expense.userName}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-sm leading-tight text-foreground">{expense.title}</span>
                            <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">{expense.items.length} Items Logged</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-black text-primary text-sm font-mono">
                          ₹{expense.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <Building2 className="h-3.5 w-3.5" />
                            {expense.siteName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            "text-[8px] font-black uppercase rounded-sm px-1.5 h-5",
                            expense.status === 'Pending' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                            expense.status === 'FirstApproved' ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                            expense.status === 'Approved' ? "bg-green-50 text-green-700 border-green-200" :
                            "bg-red-50 text-red-700 border-red-200"
                          )}>
                            {expense.status === 'FirstApproved' ? '1/2 Approved' : expense.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-50 rounded-sm" onClick={() => triggerWhatsApp(expense)} title="Push to WhatsApp">
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                            {isAdmin && (expense.status === 'Pending' || (expense.status === 'FirstApproved' && !hasApproved)) && (
                              <div className="flex gap-1">
                                <Button size="sm" className="h-8 rounded-sm bg-green-600 hover:bg-green-700 font-bold px-3" onClick={() => setActionState({ expense, type: 'Approved' })}>
                                  Approve
                                </Button>
                                <Button size="sm" variant="destructive" className="h-8 rounded-sm font-bold px-3" onClick={() => setActionState({ expense, type: 'Rejected' })}>
                                  Reject
                                </Button>
                              </div>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => setSelectedExpense(expense)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canEdit && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => setEditingExpense(expense)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => setDeletingExpense(expense)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selectedExpense} onOpenChange={(o) => !o && handleCloseDetail()}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden border-none rounded-sm shadow-2xl bg-background">
          <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-sm"><Wallet className="h-5 w-5 text-primary" /></div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Expense Audit Log</DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Submitted by {selectedExpense?.userName}</DialogDescription>
              </div>
            </div>
            {selectedExpense && (
              <Badge variant="outline" className={cn(
                "text-[9px] font-black uppercase rounded-sm px-2 h-6",
                selectedExpense.status === 'Approved' ? "bg-green-100 text-green-800" : 
                selectedExpense.status === 'Pending' ? "bg-yellow-100 text-yellow-800" : 
                selectedExpense.status === 'FirstApproved' ? "bg-indigo-100 text-indigo-800" : "bg-red-100 text-red-800"
              )}>
                {selectedExpense.status === 'FirstApproved' ? '1/2 Approved' : selectedExpense.status}
              </Badge>
            )}
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            {selectedExpense && (
              <div className="p-8 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Description</Label>
                      <p className="text-lg font-black text-foreground leading-tight">{selectedExpense.title}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Linked Site</Label>
                      <div className="flex items-center gap-2 text-sm font-bold text-primary">
                        <Building2 className="h-4 w-4" />
                        {selectedExpense.siteName}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-primary/5 rounded-sm border-2 border-primary/10 p-6 flex flex-col justify-center items-center text-center shadow-inner">
                    <span className="text-[10px] font-black uppercase text-primary tracking-widest mb-2">Aggregate Total</span>
                    <span className="text-4xl font-black tabular-nums text-primary">₹{selectedExpense.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* Approval Trail */}
                {selectedExpense.approvals && selectedExpense.approvals.length > 0 && (
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" /> Approval Trail
                    </Label>
                    <div className="space-y-3">
                      {selectedExpense.approvals.map((approval, idx) => (
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
                      {selectedExpense.status === 'FirstApproved' && (
                        <div className="p-4 border-2 border-dashed border-indigo-200 rounded-sm flex items-center gap-3 bg-indigo-50/30">
                          <Clock className="h-5 w-5 text-indigo-600" />
                          <p className="text-[10px] font-black uppercase text-indigo-700">Awaiting Second Administrator Authorization</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" /> Items Breakdown
                  </Label>
                  <div className="border rounded-sm overflow-hidden bg-muted/10">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="text-[10px] font-black uppercase px-4">Date</TableHead>
                          <TableHead className="text-[10px] font-black uppercase">Category</TableHead>
                          <TableHead className="text-[10px] font-black uppercase">Note</TableHead>
                          <TableHead className="text-[10px] font-black uppercase">Amount</TableHead>
                          <TableHead className="text-right px-4 text-[10px] font-black uppercase">Receipt</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedExpense.items.map((item, idx) => (
                          <TableRow key={idx} className="bg-background">
                            <TableCell className="px-4 font-mono text-[10px] font-bold text-muted-foreground">{item.date}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-[8px] h-4 px-1 rounded-sm uppercase font-bold">{item.category}</Badge>
                            </TableCell>
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

                {selectedExpense.status === 'Rejected' && selectedExpense.adminRemarks && (
                  <div className="p-6 rounded-sm border-2 bg-red-50 border-red-100 space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-red-700">Rejection Remarks</Label>
                    <p className="text-sm font-medium italic leading-relaxed text-foreground/80">
                      "{selectedExpense.adminRemarks}"
                    </p>
                    {selectedExpense.processedAt && (
                      <p className="text-[9px] font-bold opacity-40 uppercase pt-2">
                        Updated on {format(selectedExpense.processedAt.toDate(), 'dd MMM yyyy, HH:mm')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="p-4 bg-muted/5 border-t gap-3 shrink-0">
            {selectedExpense && (
              <Button 
                variant="outline" 
                className="mr-auto h-10 rounded-sm font-black uppercase text-[10px] tracking-widest text-green-700 border-green-200 hover:bg-green-50"
                onClick={() => triggerWhatsApp(selectedExpense)}
              >
                <MessageCircle className="h-4 w-4 mr-1.5" /> Share WA
              </Button>
            )}
            {isAdmin && (selectedExpense?.status === 'Pending' || selectedExpense?.status === 'FirstApproved') && (
              <div className="flex gap-2">
                <Button 
                  className="h-10 rounded-sm font-black uppercase text-[10px] tracking-widest bg-green-600 hover:bg-green-700 px-6" 
                  onClick={() => { setActionState({ expense: selectedExpense!, type: 'Approved' }); setSelectedExpense(null); }}
                  disabled={selectedExpense.approvals?.some(a => a.adminId === user?.uid)}
                >
                  {selectedExpense.status === 'FirstApproved' ? 'Final Approve' : 'Approve'}
                </Button>
                <Button variant="destructive" className="h-10 rounded-sm font-black uppercase text-[10px] tracking-widest px-6" onClick={() => { setActionState({ expense: selectedExpense!, type: 'Rejected' }); setSelectedExpense(null); }}>Reject</Button>
              </div>
            )}
            <DialogClose asChild><Button variant="outline" className="rounded-sm font-black uppercase text-[10px] h-10 px-8 tracking-widest">Close Audit</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Modal */}
      <Dialog open={!!actionState} onOpenChange={() => setActionState(null)}>
        <DialogContent className="rounded-sm max-md">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-tight font-black">{actionState?.type === 'Approved' ? (actionState.expense.status === 'FirstApproved' ? 'Final Approval' : 'Level 1 Approval') : 'Reject Submission'}</DialogTitle>
            <DialogDescription>Setting status for "{actionState?.expense.title}"</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Admin Feedback / Audit Remarks</Label>
              <Textarea 
                id="admin-remarks" 
                placeholder="Explain decision for personnel records..." 
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingExpense} onOpenChange={(o) => !o && setDeletingExpense(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase tracking-tight flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Remove Submission
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium leading-relaxed">
              Are you sure you want to permanently delete the expense claim for <strong>{deletingExpense?.title}</strong>? This action cannot be reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-sm font-bold uppercase text-[10px] h-10 px-6">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteExpense} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-sm font-black uppercase text-[10px] h-10 px-8 shadow-lg"
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Confirm Deletion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingExpense} onOpenChange={(o) => !o && setEditingExpense(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-none rounded-sm shadow-2xl bg-background flex flex-col h-[90vh]">
          <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-sm"><Pencil className="h-5 w-5 text-primary" /></div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Edit Expense Report</DialogTitle>
                <DialogDescription className="text-xs font-bold text-muted-foreground uppercase">Ref ID: {editingExpense?.id.slice(0, 8)}</DialogDescription>
              </div>
            </div>
            <DialogClose asChild><Button variant="ghost" size="icon" className="rounded-full"><X className="h-5 w-5" /></Button></DialogClose>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-6 sm:p-8">
                <Form {...editForm}>
                  <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-10 pb-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={editForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Report Title</FormLabel>
                            <FormControl><Input placeholder="Summary..." {...field} className="h-11 rounded-sm" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={editForm.control}
                        name="siteName"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Project Site</FormLabel>
                            <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal h-11 rounded-sm", !field.value && "text-muted-foreground")}>
                                    {field.value || "Select site..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-[300px] p-0 shadow-xl" align="start">
                                <div className="flex items-center border-b px-3">
                                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                  <Input placeholder="Search sites..." className="h-10 border-none focus-visible:ring-0 text-sm" value={siteSearchQuery} onChange={e => setSiteSearchQuery(e.target.value)} />
                                </div>
                                <ScrollArea className="h-[200px]">
                                  <div className="p-1">
                                    {allSites?.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase())).map(s => (
                                      <Button key={s.id} variant="ghost" className="w-full justify-start h-10 text-xs font-bold uppercase" onClick={() => { field.onChange(s.name); setIsSitePopoverOpen(false); }}>{s.name}</Button>
                                    ))}
                                  </div>
                                </ScrollArea>
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b pb-2 px-1">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Plus className="h-4 w-4" /> Expense Items</Label>
                        <Button type="button" variant="outline" size="sm" onClick={() => append({ category: "", description: "", amount: 0 })} className="h-8 rounded-sm font-bold border-primary text-primary">Add Line</Button>
                      </div>

                      <div className="space-y-4">
                        {fields.map((field, index) => (
                          <div key={field.id} className="p-6 border rounded-sm bg-muted/5 relative group animate-in fade-in slide-in-from-top-2">
                            {fields.length > 1 && (
                              <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 text-destructive" onClick={() => remove(index)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                              <div className="md:col-span-3">
                                <FormField control={editForm.control} name={`items.${index}.category`} render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-[9px] font-bold uppercase">Category</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl><SelectTrigger className="h-10 bg-background"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                      <SelectContent>{categories?.map(c => <SelectItem key={c.id} value={c.name} className="text-xs">{c.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                  </FormItem>
                                )} />
                              </div>
                              <div className="md:col-span-5">
                                <FormField control={editForm.control} name={`items.${index}.description`} render={({ field }) => (
                                  <FormItem><FormLabel className="text-[9px] font-bold uppercase">Description</FormLabel><FormControl><Input placeholder="Notes..." {...field} className="h-10 bg-background" /></FormControl></FormItem>
                                )} />
                              </div>
                              <div className="md:col-span-2">
                                <FormField control={editForm.control} name={`items.${index}.amount`} render={({ field }) => (
                                  <FormItem><FormLabel className="text-[9px] font-bold uppercase">Amount</FormLabel><FormControl><div className="relative"><Input type="number" step="0.01" {...field} className="h-10 pl-6 font-mono font-bold" /><span className="absolute left-2 top-2.5 text-muted-foreground text-xs">₹</span></div></FormControl></FormItem>
                                )} />
                              </div>
                              <div className="md:col-span-2 flex flex-col justify-end">
                                <FormField control={editForm.control} name={`items.${index}.localFile`} render={({ field: { value, onChange, ...rest } }) => {
                                  const preview = value instanceof File ? URL.createObjectURL(value) : (watchedItems[index]?.receiptUrl || null);
                                  return (
                                    <FormItem className="space-y-0">
                                      <div className="flex flex-col gap-2">
                                        <input type="file" className="hidden" id={`edit-proof-${index}`} onChange={e => onChange(e.target.files?.[0])} {...rest} />
                                        {preview ? (
                                          <div className="relative group/thumb h-10 rounded-sm overflow-hidden border bg-background flex items-center justify-center">
                                            {watchedItems[index]?.receiptUrl && !(value instanceof File) ? (
                                              <Badge variant="secondary" className="h-7 text-[8px] font-black uppercase">Stored Doc</Badge>
                                            ) : (
                                              <img src={preview} className="h-full w-full object-cover" alt="Thumb" />
                                            )}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center cursor-pointer" onClick={() => { onChange(null); if(!value) editForm.setValue(`items.${index}.receiptUrl`, ""); }}>
                                               <X className="h-4 w-4 text-white" />
                                            </div>
                                          </div>
                                        ) : (
                                          <Button asChild variant="outline" size="icon" className="w-full h-10 border-dashed rounded-sm text-primary hover:bg-primary/5 cursor-pointer">
                                            <label htmlFor={`edit-proof-${index}`}><FileUp className="h-4 w-4" /></label>
                                          </Button>
                                        )}
                                      </div>
                                    </FormItem>
                                  );
                                }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </form>
                </Form>
              </div>
            </ScrollArea>
          </div>

          <DialogFooter className="p-6 bg-muted/10 border-t gap-3 shrink-0 flex flex-col sm:flex-row">
            <DialogClose asChild><Button variant="outline" className="rounded-sm font-bold h-12 uppercase text-[10px] tracking-widest px-8">Discard</Button></DialogClose>
            <Button onClick={editForm.handleSubmit(onEditSubmit)} disabled={isProcessing} className="rounded-sm font-black uppercase text-[10px] h-12 px-12 tracking-widest shadow-xl">
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Update Submission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, color }: { title: string, value: number, icon: any, color: 'primary' | 'emerald' | 'blue' | 'red' }) {
  const colors = {
    primary: "bg-primary/5 border-primary/10 text-primary",
    emerald: "bg-emerald-500/5 border-emerald-500/10 text-emerald-600",
    blue: "bg-blue-500/5 border-blue-500/10 text-blue-600",
    red: "bg-red-500/5 border-red-500/10 text-red-600",
  };

  return (
    <Card className={cn("rounded-sm border shadow-sm", colors[color])}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
        <CardTitle className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
        <Icon className="h-3.5 sm:h-4 sm:w-4" />
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0">
        <div className="text-xl sm:text-2xl font-black">{value}</div>
      </CardContent>
    </Card>
  );
}
