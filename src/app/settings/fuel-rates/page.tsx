
'use client';

import * as React from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Fuel, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  History, 
  Calendar,
  IndianRupee,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid } from 'date-fns';
import { isSuperAdmin } from '@/lib/auth-constants';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

type FuelRate = {
  rate: number;
  effectiveFrom: string;
};

export default function FuelRatesManagementPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const fuelSettingsRef = useMemoFirebase(() => doc(firestore, 'system_settings', 'fuel'), [firestore]);
  const { data: fuelSettings, isLoading: isSettingsLoading } = useDoc<{ rates: FuelRate[] }>(fuelSettingsRef);

  const [newRate, setNewRate] = React.useState<string>("");
  const [newDate, setNewDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [isSaving, setIsSaving] = React.useState(false);

  const sortedRates = React.useMemo(() => {
    if (!fuelSettings?.rates) return [];
    return [...fuelSettings.rates].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  }, [fuelSettings]);

  const handleAddRate = async () => {
    const rateVal = parseFloat(newRate);
    if (isNaN(rateVal) || rateVal <= 0 || !newDate) {
      toast({ variant: 'destructive', title: 'Invalid Input', description: 'Please provide a valid rate and effective date.' });
      return;
    }

    setIsSaving(true);
    try {
      const currentRates = fuelSettings?.rates || [];
      const updatedRates = [...currentRates, { rate: rateVal, effectiveFrom: newDate }];
      
      await setDocumentNonBlocking(fuelSettingsRef, { 
        rates: updatedRates,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid
      }, { merge: true });

      toast({ title: 'Fuel Rate Registered', description: `₹${rateVal}/L active from ${newDate}.` });
      setNewRate("");
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRate = async (rateToDelete: FuelRate) => {
    try {
      const updatedRates = fuelSettings?.rates?.filter(r => 
        r.rate !== rateToDelete.rate || r.effectiveFrom !== rateToDelete.effectiveFrom
      ) || [];
      
      await setDocumentNonBlocking(fuelSettingsRef, { 
        rates: updatedRates,
        updatedAt: serverTimestamp()
      }, { merge: true });

      toast({ title: 'Rate Removed' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  if (isProfileLoading || isSettingsLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!isAdmin) return <div className="p-20 text-center font-black uppercase text-destructive">Unauthorized Access</div>;

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.push('/settings')} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings
        </Button>
        <h1 className="flex items-center gap-2">
          <Fuel className="h-8 w-8 text-primary" /> Fuel Rate Management
        </h1>
        <p className="text-muted-foreground font-medium">Define historical and current fuel prices for mileage-based expense calculations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="rounded-sm shadow-md border-primary/10 h-fit">
          <CardHeader className="bg-primary/5 border-b py-4">
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" /> Register New Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Effective From Date</Label>
              <div className="relative">
                <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="h-11 font-bold rounded-sm pr-10" />
                <Calendar className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Rate per Litre (₹)</Label>
              <div className="relative">
                <Input type="number" step="0.01" placeholder="e.g. 104.50" value={newRate} onChange={e => setNewRate(e.target.value)} className="h-11 font-mono font-bold text-lg rounded-sm pl-8" />
                <IndianRupee className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <Button onClick={handleAddRate} disabled={isSaving || !newRate || !newDate} className="w-full h-12 rounded-sm font-black uppercase text-xs tracking-widest shadow-xl">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Publish Rate
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
          <CardHeader className="bg-muted/5 border-b py-4">
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <History className="h-4 w-4 text-primary" /> Historical Rates
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6 text-[10px] font-black uppercase tracking-widest">Effective Date</TableHead>
                  <TableHead className="text-center text-[10px] font-black uppercase tracking-widest">Rate (₹/L)</TableHead>
                  <TableHead className="text-right px-6"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRates.length > 0 ? sortedRates.map((r, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/5 transition-colors">
                    <TableCell className="px-6 py-4 font-bold text-sm">
                      {format(parseISO(r.effectiveFrom), 'dd MMM yyyy')}
                      {idx === 0 && <Badge variant="secondary" className="ml-2 bg-emerald-50 text-emerald-700 border-none text-[8px] h-4">Current</Badge>}
                    </TableCell>
                    <TableCell className="text-center font-mono font-black text-primary text-base">₹{r.rate.toFixed(2)}</TableCell>
                    <TableCell className="text-right px-6">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm hover:bg-red-50" onClick={() => handleDeleteRate(r)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={3} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[10px] opacity-20">No rates registered</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="p-6 bg-primary/5 border-2 border-dashed border-primary/10 rounded-sm flex items-start gap-4">
        <ShieldCheck className="h-6 w-6 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
           <h4 className="text-sm font-black uppercase tracking-tight text-primary">Calculation Policy</h4>
           <p className="text-xs font-medium text-muted-foreground leading-relaxed">
             Travelling expenses are calculated using the formula: <span className="font-bold text-foreground">(KM Reading / 50) × Applicable Rate</span>. 
             The system automatically selects the rate that was effective on the date the expense occurred. Changes to these rates will automatically re-calculate pending submissions.
           </p>
        </div>
      </div>
    </div>
  );
}
