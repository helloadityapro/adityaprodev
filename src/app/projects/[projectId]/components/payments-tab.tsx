'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Plus, Eye, ArrowUpDown, ArrowUp, ArrowDown, IndianRupee } from 'lucide-react';
import { format } from 'date-fns';
import { doc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Payment, PaymentSortKey } from '../types';

interface PaymentsTabProps {
  projectId: string;
  payments: Payment[] | null;
}

export function PaymentsTab({ projectId, payments }: PaymentsTabProps) {
  const [paymentSearch, setPaymentSearch] = React.useState("");
  const [paymentSortConfig, setPaymentSortConfig] = React.useState<{ key: PaymentSortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [viewingPayment, setViewingPayment] = React.useState<Payment | null>(null);

  const filteredSortedPayments = React.useMemo(() => {
    if (!payments) return [];
    let result = payments.filter(p => p.payeeName.toLowerCase().includes(paymentSearch.toLowerCase()) || p.referenceNumber.toLowerCase().includes(paymentSearch.toLowerCase()));
    result.sort((a, b) => {
      const { key, direction } = paymentSortConfig;
      let valA: any = ''; let valB: any = '';
      if (key === 'date') { valA = a.date?.toDate?.()?.getTime() || 0; valB = b.date?.toDate?.()?.getTime() || 0; }
      else if (key === 'payee') { valA = a.payeeName.toLowerCase(); valB = b.payeeName.toLowerCase(); }
      else if (key === 'amount') { valA = a.amount; valB = b.amount; }
      else if (key === 'reference') { valA = a.referenceNumber.toLowerCase(); valB = b.referenceNumber.toLowerCase(); }
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [payments, paymentSearch, paymentSortConfig]);

  const PaymentSortIcon = ({ column }: { column: PaymentSortKey }) => {
    if (paymentSortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return paymentSortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3 text-primary" /> : <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  return (
    <div className="mt-6 animate-in fade-in duration-300 transition-all space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
        <div className="relative w-full md:w-80"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search payments..." className="pl-8 h-9 rounded-sm border-primary/20 text-xs" value={paymentSearch} onChange={e => setPaymentSearch(e.target.value)} /></div>
        <Button asChild className="rounded-sm font-bold shadow-md h-9"><Link href={`/payments/record`}><Plus className="h-4 w-4 mr-2" /> Record New Payment</Link></Button>
      </div>
      <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handlePaymentSort('date')}><div className="flex items-center">Date & Time <PaymentSortIcon column="date" /></div></TableHead>
                <TableHead>Paid to</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Mode</TableHead><TableHead className="text-right px-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSortedPayments.map(p => (
                <TableRow key={p.id} className="hover:bg-muted/5 transition-colors">
                  <TableCell className="px-6 py-4 font-mono text-[10px] font-bold text-muted-foreground">{p.date ? format(p.date.toDate(), 'dd MMM yy HH:mm') : '—'}</TableCell>
                  <TableCell className="text-sm font-bold">{p.payeeName}</TableCell>
                  <TableCell><div className="flex flex-col"><span className="font-mono text-xs font-black text-primary uppercase">{p.referenceNumber}</span><span className="text-[8px] font-bold text-muted-foreground uppercase">{p.paymentAgainst}</span></div></TableCell>
                  <TableCell className="text-right font-black text-sm font-mono text-foreground">₹{p.amount.toLocaleString('en-IN')}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[9px] font-bold uppercase h-4">{p.paymentMode}</Badge></TableCell>
                  <TableCell className="text-right px-6"><Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => setViewingPayment(p)}><Eye className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {/* Payment detail logic can go here or remain in main page if complex */}
    </div>
  );

  function handlePaymentSort(key: PaymentSortKey) {
    setPaymentSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  }
}
