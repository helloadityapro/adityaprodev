'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  HardHat, 
  Search, 
  FilterX, 
  Gavel, 
  Coins, 
  History,
  User,
  ExternalLink,
  Building2,
  Phone,
  Mail,
  MapPin,
  TrendingUp,
  Award
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { isSuperAdmin } from '@/lib/auth-constants';

type Contractor = {
  id: string;
  name: string;
  gstin: string;
  mobile: string;
  email: string;
  address: string;
};

type WorkOrder = {
  id: string;
  contractorId: string;
  totalAmount: number;
  status: string;
};

export default function ContractorSummaryPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = React.useState("");

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const contractorsQuery = useMemoFirebase(() => query(collection(firestore, 'contractors'), orderBy('name', 'asc')), [firestore]);
  const { data: contractors, isLoading: isContractorsLoading } = useCollection<Contractor>(contractorsQuery);

  const wosQuery = useMemoFirebase(() => collection(firestore, 'project_wos'), [firestore]);
  const { data: allWOs, isLoading: isWOsLoading } = useCollection<WorkOrder>(wosQuery);

  const contractorStats = React.useMemo(() => {
    if (!contractors || !allWOs) return [];

    return contractors.map(c => {
      const contractorWOs = allWOs.filter(wo => wo.contractorId === c.id && wo.status !== 'Rejected');
      const totalVolume = contractorWOs.reduce((sum, wo) => sum + (wo.totalAmount || 0), 0);
      return {
        ...c,
        woCount: contractorWOs.length,
        totalVolume,
      };
    }).filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.gstin || '').toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => b.totalVolume - a.totalVolume);
  }, [contractors, allWOs, searchTerm]);

  const aggregateStats = React.useMemo(() => {
    if (!allWOs) return { totalValue: 0, activeContractors: 0 };
    const active = allWOs.filter(w => w.status !== 'Rejected');
    const uniqueContractors = new Set(active.map(w => w.contractorId));
    return {
      totalValue: active.reduce((sum, w) => sum + (w.totalAmount || 0), 0),
      activeContractors: uniqueContractors.size
    };
  }, [allWOs]);

  if (isProfileLoading || isContractorsLoading || isWOsLoading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-[500px] w-full" /></div>;
  }

  if (!isAdmin) {
    return <div className="p-20 text-center text-destructive font-black uppercase">Unauthorized Access</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2"><HardHat className="h-8 w-8 text-primary" /> Contractor Engagement Summary</h1>
        <p className="text-muted-foreground font-medium">Consolidated overview of organizational service spending and partner performance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Total Partners" value={contractors?.length || 0} icon={Users} color="primary" />
        <SummaryCard title="Active Contracts" value={aggregateStats.activeContractors} icon={Gavel} color="emerald" />
        <SummaryCard title="Aggregate Contract Volume" value={aggregateStats.totalValue} icon={TrendingUp} isCurrency color="primary" span={2} />
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by partner or GSTIN..." 
            className="pl-10 h-10 text-sm rounded-sm border-primary/20 bg-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Badge variant="outline" className="rounded-sm font-black uppercase text-[10px] tracking-widest px-3 h-8 border-primary/20 text-primary">
          Ranked by Total Value
        </Badge>
      </div>

      <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6">Contractor Partner</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead className="text-center">WO Count</TableHead>
                  <TableHead className="text-right">Total Contractual Volume</TableHead>
                  <TableHead className="text-right px-6">Profile</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contractorStats.length > 0 ? contractorStats.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/5 transition-colors">
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-foreground">{c.name}</span>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-medium mt-1">
                          <MapPin className="h-3 w-3" /> {c.address || 'Address Not Recorded'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="rounded-sm font-mono text-[10px] uppercase font-bold tracking-wider px-1.5 h-5">
                        {c.gstin || 'NO-GSTIN'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="rounded-full h-6 w-6 p-0 flex items-center justify-center font-bold bg-primary/5 text-primary">
                        {c.woCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-black text-sm font-mono text-primary">
                      ₹{c.totalVolume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm text-muted-foreground hover:text-primary">
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm text-muted-foreground hover:text-primary">
                          <Mail className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic">No contractor metrics available.</TableCell></TableRow>
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
