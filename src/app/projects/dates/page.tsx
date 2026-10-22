'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Calendar, 
  Search, 
  Building2, 
  ChevronRight, 
  History,
  Pencil,
  Save,
  Loader2,
  Clock,
  AlertCircle,
  CalendarDays,
  FilterX,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ArrowRight
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { format, differenceInDays, startOfDay, parseISO, isValid } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { isSuperAdmin } from '@/lib/auth-constants';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

type Site = {
  id: string;
  name: string;
  projectCompany: string;
  projectType: 'groundmount' | 'rooftop';
  ppaDate?: string;
  financialClosureDate?: string;
  ppaScodDate?: string;
  plannedScodDate?: string;
};

type SortKey = 'name' | 'company' | 'ppaDate' | 'financialClosureDate' | 'ppaScodDate' | 'plannedScodDate';

export default function ProjectDatesPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = React.useState("");
  const [editingSite, setEditingSite] = React.useState<Site | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites, isLoading: sitesLoading } = useCollection<Site>(sitesQuery);

  const filteredSites = React.useMemo(() => {
    if (!allSites) return [];
    
    // Policy: Only display groundmount projects for chronological milestone tracking
    let result = allSites.filter(s => s.projectType === 'groundmount');

    if (searchTerm.trim()) {
      result = result.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.projectCompany.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    result.sort((a, b) => {
      const { key, direction } = sortConfig;
      let valA: any = a[key] || '';
      let valB: any = b[key] || '';
      
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [allSites, searchTerm, sortConfig]);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3.5 w-3.5 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3.5 w-3.5 text-primary" /> : <ArrowDown className="ml-2 h-3.5 w-3.5 text-primary" />;
  };

  const getDaysRemaining = (dateStr?: string) => {
    if (!dateStr) return null;
    const date = parseISO(dateStr);
    if (!isValid(date)) return null;
    const today = startOfDay(new Date());
    return differenceInDays(date, today);
  };

  const renderDaysBadge = (days: number | null) => {
    if (days === null) return <span className="text-muted-foreground/30 font-bold">—</span>;
    
    const isOverdue = days < 0;
    const isCritical = days <= 30;

    return (
      <Badge variant="outline" className={cn(
        "font-mono font-black text-[10px] h-6 px-2 rounded-sm border-none shadow-sm",
        isOverdue ? "bg-red-500 text-white" : isCritical ? "bg-amber-500 text-white" : "bg-emerald-100 text-emerald-800"
      )}>
        {isOverdue ? `Overdue ${Math.abs(days)}d` : `${days} Days Left`}
      </Badge>
    );
  };

  const handleSaveDates = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingSite) return;
    setIsSaving(true);

    const formData = new FormData(e.currentTarget);
    const updates = {
      ppaDate: formData.get('ppaDate') as string,
      financialClosureDate: formData.get('financialClosureDate') as string,
      ppaScodDate: formData.get('ppaScodDate') as string,
      plannedScodDate: formData.get('plannedScodDate') as string,
      updatedAt: serverTimestamp()
    };

    try {
      await updateDocumentNonBlocking(doc(firestore, 'sites', editingSite.id), updates);
      toast({ title: 'Milestones Updated', description: `Dates synchronized for ${editingSite.name}.` });
      setEditingSite(null);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (isProfileLoading || sitesLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="space-y-6 md:space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl md:text-3xl font-black uppercase tracking-tight text-foreground flex items-center gap-3">
          <CalendarDays className="h-8 w-8 text-primary" /> Chronological Milestones
        </h1>
        <p className="text-muted-foreground text-sm font-medium">Tracking contractual and internal SCOD timelines for utility scale projects.</p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm no-print">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search project or company..." 
            className="pl-10 h-10 text-sm rounded-sm border-primary/20 bg-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
           <Badge variant="outline" className="rounded-sm font-black uppercase text-[10px] tracking-widest px-3 h-10 border-primary/20 text-primary bg-primary/5">
              {filteredSites.length} Groundmount Sites
           </Badge>
           <Button variant="ghost" size="icon" onClick={() => setSearchTerm("")} className="h-10 w-10 text-muted-foreground rounded-sm border border-transparent hover:border-primary/10">
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
                  <TableHead className="px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('name')}>
                    <div className="flex items-center">Project Name <SortIcon column="name" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('ppaDate')}>
                    <div className="flex items-center">PPA Date <SortIcon column="ppaDate" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('financialClosureDate')}>
                    <div className="flex items-center">Financial Closure <SortIcon column="financialClosureDate" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('ppaScodDate')}>
                    <div className="flex items-center">PPA SCOD <SortIcon column="ppaScodDate" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('plannedScodDate')}>
                    <div className="flex items-center">Planned SCOD <SortIcon column="plannedScodDate" /></div>
                  </TableHead>
                  <TableHead className="text-center font-black uppercase text-[10px] tracking-widest bg-primary/[0.03]">Days to PPA SCOD</TableHead>
                  <TableHead className="text-center font-black uppercase text-[10px] tracking-widest bg-primary/[0.03]">Days to P SCOD</TableHead>
                  <TableHead className="text-right px-6 font-black uppercase text-[10px] tracking-widest">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSites.length > 0 ? filteredSites.map((site) => (
                  <TableRow key={site.id} className="hover:bg-muted/5 transition-colors">
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-black text-sm text-foreground capitalize tracking-tight">{site.name}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60 mt-0.5">{site.projectCompany}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-muted-foreground whitespace-nowrap">
                      {site.ppaDate ? format(parseISO(site.ppaDate), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-muted-foreground whitespace-nowrap">
                      {site.financialClosureDate ? format(parseISO(site.financialClosureDate), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-black text-primary whitespace-nowrap">
                      {site.ppaScodDate ? format(parseISO(site.ppaScodDate), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-black text-foreground whitespace-nowrap">
                      {site.plannedScodDate ? format(parseISO(site.plannedScodDate), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-center bg-primary/[0.01]">
                      {renderDaysBadge(getDaysRemaining(site.ppaScodDate))}
                    </TableCell>
                    <TableCell className="text-center bg-primary/[0.01]">
                      {renderDaysBadge(getDaysRemaining(site.plannedScodDate))}
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm hover:bg-primary/10 transition-all" onClick={() => setEditingSite(site)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[10px] opacity-20 tracking-[0.3em]">
                      No groundmount projects in registry
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Milestone Dialog */}
      <Dialog open={!!editingSite} onOpenChange={(o) => !o && setEditingSite(null)}>
        <DialogContent className="sm:max-w-md rounded-sm p-0 overflow-hidden border-none shadow-2xl bg-background">
          <DialogHeader className="p-6 bg-primary/5 border-b">
            <div className="flex items-center gap-3">
               <div className="bg-primary/10 p-2 rounded-sm shrink-0"><History className="h-5 w-5 text-primary" /></div>
               <div className="text-left">
                  <DialogTitle className="text-xl font-black uppercase tracking-tight leading-none">Modify Milestones</DialogTitle>
                  <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{editingSite?.name}</DialogDescription>
               </div>
            </div>
          </DialogHeader>

          {editingSite && (
            <form onSubmit={handleSaveDates} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">PPA Date</Label>
                  <Input name="ppaDate" type="date" defaultValue={editingSite.ppaDate} className="h-10 font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Financial Closure</Label>
                  <Input name="financialClosureDate" type="date" defaultValue={editingSite.financialClosureDate} className="h-10 font-bold" />
                </div>
              </div>

              <Separator className="opacity-10" />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-primary tracking-widest">PPA SCOD (Contract)</Label>
                  <Input name="ppaScodDate" type="date" defaultValue={editingSite.ppaScodDate} className="h-10 font-black border-primary/20" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-foreground tracking-widest">Planned SCOD (Internal)</Label>
                  <Input name="plannedScodDate" type="date" defaultValue={editingSite.plannedScodDate} className="h-10 font-black" />
                </div>
              </div>

              <div className="p-4 bg-muted/20 border rounded-sm flex items-start gap-3">
                 <AlertCircle className="h-5 w-5 text-muted-foreground opacity-40 shrink-0 mt-0.5" />
                 <p className="text-[11px] font-medium text-muted-foreground leading-relaxed italic">
                   Note: Updating SCOD milestones will immediately recalculate the "Days Left" countdowns across the global organizational registry.
                 </p>
              </div>

              <DialogFooter className="pt-4 gap-3 flex flex-col sm:flex-row">
                <DialogClose asChild><Button variant="outline" className="rounded-sm font-bold uppercase text-[10px] h-11 flex-1">Discard</Button></DialogClose>
                <Button type="submit" disabled={isSaving} className="rounded-sm font-black uppercase text-[10px] h-11 shadow-lg flex-1">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Finalize Dates
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
