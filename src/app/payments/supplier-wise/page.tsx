'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Truck, 
  Search, 
  FilterX, 
  Building2, 
  ArrowRight, 
  Calendar,
  CreditCard,
  FileText,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';

type Payment = {
  id: string;
  siteId: string;
  siteName: string;
  paymentAgainst: 'PO';
  payeeId: string;
  payeeName: string;
  referenceNumber: string;
  amount: number;
  paymentType: string;
  paymentMode: string;
  date: any;
  proofUrl?: string;
};

type Supplier = { id: string; name: string; gstin: string };
type Site = { id: string; name: string };

export default function SupplierWisePaymentsPage() {
  const firestore = useFirestore();
  const [selectedPayeeId, setSelectedPayeeId] = React.useState<string>("all");
  const [selectedSiteId, setSelectedSiteId] = React.useState<string>("all");
  
  const [isPayeePopoverOpen, setIsPayeePopoverOpen] = React.useState(false);
  const [payeeSearch, setPayeeSearch] = React.useState("");
  
  const suppliersQuery = useMemoFirebase(() => collection(firestore, 'suppliers'), [firestore]);
  const { data: suppliers } = useCollection<Supplier>(suppliersQuery);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: sites } = useCollection<Site>(sitesQuery);

  const paymentsQuery = useMemoFirebase(() => {
    let q = query(collection(firestore, 'payments'), where('paymentAgainst', '==', 'PO'), orderBy('date', 'desc'), limit(500));
    if (selectedPayeeId !== 'all') {
      q = query(collection(firestore, 'payments'), where('paymentAgainst', '==', 'PO'), where('payeeId', '==', selectedPayeeId), orderBy('date', 'desc'));
    }
    return q;
  }, [firestore, selectedPayeeId]);

  const { data: payments, isLoading } = useCollection<Payment>(paymentsQuery);

  const filteredPayments = React.useMemo(() => {
    if (!payments) return [];
    return payments.filter(p => selectedSiteId === 'all' || p.siteId === selectedSiteId);
  }, [payments, selectedSiteId]);

  if (isLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2"><Truck className="h-8 w-8 text-primary" /> Supplier-wise Payments</h1>
        <p className="text-muted-foreground font-medium">Review disbursement logs associated with material vendors.</p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
        <div className="flex flex-col gap-1.5 flex-1">
          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Target Supplier</Label>
          <Popover open={isPayeePopoverOpen} onOpenChange={setIsPayeePopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between h-10 rounded-sm bg-background">
                {selectedPayeeId === 'all' ? "All Active Suppliers" : suppliers?.find(s => s.id === selectedPayeeId)?.name}
                <Truck className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <div className="flex items-center border-b px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <Input placeholder="Search suppliers..." className="h-10 border-none" value={payeeSearch} onChange={e => setPayeeSearch(e.target.value)} />
              </div>
              <ScrollArea className="h-[200px]">
                <div className="p-1">
                  <Button variant="ghost" className="w-full justify-start h-9 text-xs font-bold uppercase" onClick={() => { setSelectedPayeeId('all'); setIsPayeePopoverOpen(false); }}>All Suppliers</Button>
                  {suppliers?.filter(s => s.name.toLowerCase().includes(payeeSearch.toLowerCase())).map(s => (
                    <Button key={s.id} variant="ghost" className="w-full justify-start h-9 text-xs" onClick={() => { setSelectedPayeeId(s.id); setIsPayeePopoverOpen(false); }}>{s.name}</Button>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-col gap-1.5 w-full md:w-64">
          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Project Site (Optional)</Label>
          <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
            <SelectTrigger className="h-10 rounded-sm bg-background border-primary/20">
              <SelectValue placeholder="All Sites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Across All Sites</SelectItem>
              {sites?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6">Date</TableHead>
                  <TableHead>PO Reference</TableHead>
                  <TableHead>Project Site</TableHead>
                  <TableHead className="text-right">Amount Paid</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right px-6">Audit</TableHead>
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
                      <Badge variant="secondary" className="text-[9px] font-bold uppercase px-1.5 h-5 rounded-sm">{p.paymentType}</Badge>
                    </TableCell>
                    <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">{p.paymentMode}</TableCell>
                    <TableCell className="text-right px-6">
                      {p.proofUrl && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" asChild>
                          <a href={p.proofUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic">No supplier-specific payment logs discovered.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
