'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Truck, 
  Search, 
  FilterX, 
  ShoppingBag, 
  Coins, 
  History,
  User,
  Users,
  ExternalLink,
  Building2,
  Phone,
  Mail,
  MapPin,
  TrendingUp,
  Award,
  Smartphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { isSuperAdmin } from '@/lib/auth-constants';
import { useRouter } from 'next/navigation';

type Supplier = {
  id: string;
  name: string;
  gstin: string;
  mobile: string;
  email: string;
  address: string;
};

type PurchaseOrder = {
  id: string;
  supplierId: string;
  totalAmount: number;
  status: string;
};

export default function SupplierSummaryPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = React.useState("");

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isProcurement = isAdmin || userProfile?.department === 'Procurement and Supply-chain';

  const suppliersQuery = useMemoFirebase(() => query(collection(firestore, 'suppliers'), orderBy('name', 'asc')), [firestore]);
  const { data: suppliers, isLoading: isSuppliersLoading } = useCollection<Supplier>(suppliersQuery);

  const posQuery = useMemoFirebase(() => collection(firestore, 'project_pos'), [firestore]);
  const { data: allPOs, isLoading: isPOsLoading } = useCollection<PurchaseOrder>(posQuery);

  const supplierStats = React.useMemo(() => {
    if (!suppliers || !allPOs) return [];

    return suppliers.map(s => {
      const supplierPOs = allPOs.filter(po => po.supplierId === s.id && po.status !== 'Cancelled');
      const totalVolume = supplierPOs.reduce((sum, po) => sum + (po.totalAmount || 0), 0);
      return {
        ...s,
        poCount: supplierPOs.length,
        totalVolume,
      };
    }).filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.gstin || '').toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => b.totalVolume - a.totalVolume);
  }, [suppliers, allPOs, searchTerm]);

  const aggregateStats = React.useMemo(() => {
    if (!allPOs) return { totalValue: 0, activeSuppliers: 0 };
    const active = allPOs.filter(p => p.status !== 'Cancelled');
    const uniqueSuppliers = new Set(active.map(p => p.supplierId));
    return {
      totalValue: active.reduce((sum, p) => sum + (p.totalAmount || 0), 0),
      activeSuppliers: uniqueSuppliers.size
    };
  }, [allPOs]);

  if (isProfileLoading || isSuppliersLoading || isPOsLoading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-[500px] w-full" /></div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2"><Truck className="h-8 w-8 text-primary" /> Supplier Engagement Summary</h1>
        <p className="text-muted-foreground font-medium">Consolidated financial overview of organizational spend per material partner.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Total Partners" value={suppliers?.length || 0} icon={Users} color="primary" />
        <SummaryCard title="Active Suppliers" value={aggregateStats.activeSuppliers} icon={Truck} color="emerald" />
        <SummaryCard title="Aggregate Procurement Volume" value={aggregateStats.totalValue} icon={TrendingUp} isCurrency color="primary" span={2} />
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by vendor or GSTIN..." 
            className="pl-10 h-10 text-sm rounded-sm border-primary/20 bg-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Badge variant="outline" className="rounded-sm font-black uppercase text-[10px] tracking-widest px-3 h-8 border-primary/20 text-primary">
          Ranked by Expenditure
        </Badge>
      </div>

      <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6">Vendor Name</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead className="text-center">PO Count</TableHead>
                  <TableHead className="text-right">Total Billing Volume</TableHead>
                  <TableHead className="text-right px-6">Profile</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplierStats.length > 0 ? supplierStats.map((s) => (
                  <TableRow key={s.id} className="hover:bg-muted/5 transition-colors">
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-foreground">{s.name}</span>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-medium mt-1">
                          <MapPin className="h-3 w-3" /> {s.address || 'Location Not Set'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="rounded-sm font-mono text-[10px] uppercase font-bold tracking-wider px-1.5 h-5">
                        {s.gstin || 'NO-GSTIN'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="rounded-full h-6 w-6 p-0 flex items-center justify-center font-bold bg-primary/5 text-primary">
                        {s.poCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-black text-sm font-mono text-primary">
                      ₹{s.totalVolume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm text-muted-foreground hover:text-primary">
                          <Smartphone className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm text-muted-foreground hover:text-primary">
                          <Mail className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic">No supplier metrics available.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, color, isCurrency, span = 1 }: { title: string, value: number, icon: any, color: 'primary' | 'emerald', isCurrency?: boolean, span?: number }) {
  const colors = {
    primary: "bg-primary/5 border-primary/10 text-primary",
    emerald: "bg-emerald-500/5 border-emerald-500/10 text-emerald-600",
  };

  return (
    <Card className={cn("rounded-sm border shadow-sm", colors[color], span > 1 && "md:col-span-2")}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4" />
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className={cn("font-black tabular-nums", span > 1 ? "text-3xl" : "text-2xl")}>
          {isCurrency ? `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : value}
        </div>
      </CardContent>
    </Card>
  );
}
