'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Building2, 
  ChevronRight, 
  ClipboardCheck, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  LayoutGrid,
  Cpu,
  Zap
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

type Site = { 
  id: string; 
  name: string; 
  projectCompany?: string; 
};

type SiteSortKey = 'name' | 'company' | 'total';

export default function ChecklistsDataProjectListPage() {
  const firestore = useFirestore();
  const router = useRouter();
  
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  const [siteSortConfig, setSortConfig] = React.useState<{ key: SiteSortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites, isLoading: sitesLoading } = useCollection<Site>(sitesQuery);

  const mmsQuery = useMemoFirebase(() => collection(firestore, 'installation_checklists'), [firestore]);
  const { data: mmsRecords } = useCollection<any>(mmsQuery);

  const inverterQuery = useMemoFirebase(() => collection(firestore, 'inverter_checklists'), [firestore]);
  const { data: inverterRecords } = useCollection<any>(inverterQuery);

  // Note: HT Line checklist collection will be integrated once defined in backend schema.
  
  const siteStats = React.useMemo(() => {
    const stats: Record<string, { mms: number; inverter: number; htLine: number; total: number }> = {};
    
    // Initialize stats for all sites to avoid undefined access
    allSites?.forEach(s => {
      stats[s.id] = { mms: 0, inverter: 0, htLine: 0, total: 0 };
    });

    mmsRecords?.forEach(r => {
      if (r.siteId && stats[r.siteId]) {
        stats[r.siteId].mms++;
        stats[r.siteId].total++;
      }
    });

    inverterRecords?.forEach(r => {
      if (r.siteId && stats[r.siteId]) {
        stats[r.siteId].inverter++;
        stats[r.siteId].total++;
      }
    });

    return stats;
  }, [mmsRecords, inverterRecords, allSites]);

  const filteredSortedSites = React.useMemo(() => {
    if (!allSites) return [];
    
    let result = allSites.filter(s => (siteStats[s.id]?.total || 0) > 0);

    if (siteSearchQuery.trim() !== "") {
      result = result.filter(s => 
        s.name.toLowerCase().includes(siteSearchQuery.toLowerCase()) ||
        (s.projectCompany || '').toLowerCase().includes(siteSearchQuery.toLowerCase())
      );
    }

    result.sort((a, b) => {
      const { key, direction } = siteSortConfig;
      let valA: any = '';
      let valB: any = '';

      if (key === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (key === 'company') {
        valA = (a.projectCompany || '').toLowerCase();
        valB = (b.projectCompany || '').toLowerCase();
      } else if (key === 'total') {
        valA = siteStats[a.id]?.total || 0;
        valB = siteStats[b.id]?.total || 0;
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [allSites, siteSearchQuery, siteSortConfig, siteStats]);

  const handleSiteSort = (key: SiteSortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: SiteSortKey }) => {
    if (siteSortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return siteSortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3 text-primary" /> : <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  if (sitesLoading) return <div className="p-8 space-y-6"><Skeleton className="h-10 w-64" /><div className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div></div>;

  return (
    <div className="space-y-6 md:space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
          <ClipboardCheck className="h-6 w-6" /> Quality Data Registry
        </h1>
        <p className="text-muted-foreground text-[10px] md:text-xs font-medium">Select a project to review historical audit logs and compliance data.</p>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-3 md:p-4 border border-primary/10 rounded-sm shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search projects or companies..." className="pl-10 h-11 rounded-sm bg-background border-primary/10 text-sm" value={siteSearchQuery} onChange={e => setSiteSearchQuery(e.target.value)} />
          </div>
          <Badge variant="secondary" className="rounded-sm font-black uppercase text-[8px] md:text-[10px] tracking-widest px-3 h-7 md:h-8 border-none w-fit">
            {filteredSortedSites.length} Active Sites
          </Badge>
        </div>

        {/* Mobile-Responsive Grid View */}
        <div className="md:hidden space-y-4">
          {filteredSortedSites.length > 0 ? filteredSortedSites.map(site => (
            <Card key={site.id} className="rounded-sm border-primary/10 shadow-sm active:bg-muted/5 cursor-pointer" onClick={() => router.push(`/checklists/data/${site.id}`)}>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-primary/10 rounded-sm text-primary shrink-0"><Building2 className="h-5 w-5" /></div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-sm text-foreground break-words leading-tight">{site.name}</span>
                      <span className="text-[9px] uppercase font-black text-muted-foreground mt-1">{site.projectCompany}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
                </div>
                
                <div className="grid grid-cols-3 gap-2 border-t pt-3">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">MMS</span>
                    <Badge variant="outline" className="h-6 px-1.5 font-bold text-[10px] border-primary/10 bg-primary/5 text-primary">
                      {siteStats[site.id]?.mms || 0}
                    </Badge>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Inverter</span>
                    <Badge variant="outline" className="h-6 px-1.5 font-bold text-[10px] border-primary/10 bg-primary/5 text-primary">
                      {siteStats[site.id]?.inverter || 0}
                    </Badge>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">HT Line</span>
                    <Badge variant="outline" className="h-6 px-1.5 font-bold text-[10px] border-primary/10 bg-primary/5 text-primary">
                      {siteStats[site.id]?.htLine || 0}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )) : (
            <div className="py-20 text-center text-muted-foreground italic text-xs uppercase font-bold opacity-30 border border-dashed rounded-sm">No matching projects found</div>
          )}
        </div>

        {/* Desktop Enhanced Tabular View */}
        <Card className="hidden md:block rounded-sm border-primary/10 shadow-md overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSiteSort('name')}>
                      <div className="flex items-center">Project Name <SortIcon column="name" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSiteSort('company')}>
                      <div className="flex items-center">Project Company <SortIcon column="company" /></div>
                    </TableHead>
                    <TableHead className="text-center font-black uppercase text-[10px] tracking-widest">
                      <div className="flex items-center justify-center gap-1.5">
                        <LayoutGrid className="h-3.5 w-3.5" /> MMS
                      </div>
                    </TableHead>
                    <TableHead className="text-center font-black uppercase text-[10px] tracking-widest">
                      <div className="flex items-center justify-center gap-1.5">
                        <Cpu className="h-3.5 w-3.5" /> Inverter
                      </div>
                    </TableHead>
                    <TableHead className="text-center font-black uppercase text-[10px] tracking-widest">
                      <div className="flex items-center justify-center gap-1.5">
                        <Zap className="h-3.5 w-3.5" /> HT Line
                      </div>
                    </TableHead>
                    <TableHead className="text-center cursor-pointer hover:text-primary transition-colors" onClick={() => handleSiteSort('total')}>
                      <div className="flex items-center justify-center">Total Audits <SortIcon column="total" /></div>
                    </TableHead>
                    <TableHead className="text-right px-6">Explore</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSortedSites.map(site => (
                    <TableRow key={site.id} className="hover:bg-muted/5 cursor-pointer group" onClick={() => router.push(`/checklists/data/${site.id}`)}>
                      <TableCell className="px-6 py-4"><span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{site.name}</span></TableCell>
                      <TableCell><span className="text-[10px] uppercase font-black text-muted-foreground">{site.projectCompany}</span></TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="rounded-sm h-6 px-2 text-[10px] font-bold border-primary/10 bg-primary/5 text-primary/60">
                          {siteStats[site.id]?.mms || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="rounded-sm h-6 px-2 text-[10px] font-bold border-primary/10 bg-primary/5 text-primary/60">
                          {siteStats[site.id]?.inverter || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="rounded-sm h-6 px-2 text-[10px] font-bold border-primary/10 bg-primary/5 text-primary/60">
                          {siteStats[site.id]?.htLine || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="default" className="rounded-sm h-6 px-3 text-[10px] font-black border-none shadow-sm">
                          {siteStats[site.id]?.total || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right px-6"><ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-all group-hover:translate-x-1 ml-auto" /></TableCell>
                    </TableRow>
                  ))}
                  {filteredSortedSites.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[10px] opacity-20">No matching projects found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
