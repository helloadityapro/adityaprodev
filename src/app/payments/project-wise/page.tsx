'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Building2, 
  Search, 
  FilterX, 
  ArrowRight, 
  Calendar,
  CreditCard,
  FileText,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

type Payment = {
  id: string;
  siteId: string;
  siteName: string;
  paymentAgainst: 'PO' | 'WO';
  payeeName: string;
  referenceNumber: string;
  amount: number;
  paymentType: string;
  paymentMode: string;
  paymentDetails: string;
  proofUrl?: string;
  date: any;
};

type Site = { id: string; name: string };

export default function ProjectWisePaymentsPage() {
  const firestore = useFirestore();
  const [selectedSiteId, setSelectedSiteId] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearch, setSiteSearch] = React.useState("");

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: sites } = useCollection<Site>(sitesQuery);

  const paymentsQuery = useMemoFirebase(() => {
    let q = query(collection(firestore, 'payments'), orderBy('date', 'desc'), limit(500));
    if (selectedSiteId !== 'all') {
      q = query(collection(firestore, 'payments'), where('siteId', '==', selectedSiteId), orderBy('date', 'desc'));
    }
    return q;
  }, [firestore, selectedSiteId]);

  const { data: payments, isLoading } = useCollection<Payment>(paymentsQuery);

  const filteredPayments = React.useMemo(() => {
    if (!payments) return [];
    return payments.filter(p => typeFilter === 'all' || p.paymentAgainst === typeFilter);
  }, [payments, typeFilter]);

  if (isLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2"><Building2 className="h-8 w-8 text-primary" /> Project-wise Payments</h1>
        <p className="text-muted-foreground font-medium">Audit historical disbursements filtered by project location.</p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
        <div className="flex flex-col gap-1.5 flex-1">
          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Filter by Site</Label>
          <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between h-10 rounded-sm bg-background">
                {selectedSiteId === 'all' ? "All Active Projects" : sites?.find(s => s.id === selectedSiteId)?.name}
                <Building2 className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <div className="flex items-center border-b px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <Input placeholder="Search sites..." className="h-10 border-none" value={siteSearch} onChange={e => setSiteSearch(e.target.value)} />
              </div>
              <ScrollArea className="h-[200px]">
                <div className="p-1">
                  <Button variant="ghost" className="w-full justify-start h-9 text-xs font-bold uppercase" onClick={() => { setSelectedSiteId('all'); setIsSitePopoverOpen(false); }}>All Active Projects</Button>
                  {sites?.filter(s => s.name.toLowerCase().includes(siteSearch.toLowerCase())).map(s => (
                    <Button key={s.id} variant="ghost" className="w-full justify-start h-9 text-xs" onClick={() => { setSelectedSiteId(s.id); setIsSitePopoverOpen(false); }}>{s.name}</Button>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-col gap-1.5 w-full md:w-48">
          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Payment Type</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-10 rounded-sm bg-background border-primary/20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Records</SelectItem>
              <SelectItem value="PO">Against PO</SelectItem>
              <SelectItem value="WO">Against WO</SelectItem>
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
                  <TableHead>Reference</TableHead>
                  <TableHead>Payee (Supplier/Contractor)</TableHead>
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
                      {p.date ? format(p.date.toDate(), 'dd MMM yy, HH:mm') : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-black text-primary uppercase">{p.referenceNumber}</span>
                        <Badge variant="outline" className="w-fit text-[8px] h-4 px-1 rounded-sm mt-1">{p.paymentAgainst}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-semibold">{p.payeeName}</TableCell>
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
                  <TableRow><TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic">No payment logs found for this project.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
