
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
  ArrowDown
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

type Site = { 
  id: string; 
  name: string; 
  projectCompany?: string; 
};

type SiteSortKey = 'name' | 'company' | 'count';

export default function ChecklistsDataProjectListPage() {
  const firestore = useFirestore();
  const router = useRouter();
  
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  const [siteSortConfig, setSortConfig] = React.useState<{ key: SiteSortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites, isLoading: sitesLoading } = useCollection<Site>(sitesQuery);

  const instQuery = useMemoFirebase(() => collection(firestore, 'installation_checklists'), [firestore]);
  const { data: instRecords, isLoading: instRecordsLoading } = useCollection<any>(instQuery);

  const siteStats = React.useMemo(() => {
    const stats: Record<string, number> = {};
    if (!instRecords) return stats;
    instRecords.forEach(r => {
      if (r.siteId) {
        stats[r.siteId] = (stats[r.siteId] || 0) + 1;
      }
    });
    return stats;
  }, [instRecords]);

  const filteredSortedSites = React.useMemo(() => {
    if (!allSites) return [];
    
    // Requirement: Display only those projects/sites for which at least one checklist has been submitted
    let result = allSites.filter(s => (siteStats[s.id] || 0) > 0);

    // Apply search filter if any
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
      } else if (key === 'count') {
        valA = siteStats[a.id] || 0;
        valB = siteStats[b.id] || 0;
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

  const SiteSortIcon = ({ column }: { column: SiteSortKey }) => {
    if (siteSortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return siteSortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3 text-primary" /> : <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  if (sitesLoading || instRecordsLoading) {
    return (
      <div className="p-4 sm:p-8 space-y-6">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-20 w-full rounded-sm" />
          <Skeleton className="h-20 w-full rounded-sm" />
          <Skeleton className="h-20 w-full rounded-sm" />
        </div>
      </div>
    );
  }

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
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search projects or companies..." 
              className="pl-10 h-10 md:h-11 rounded-sm bg-background border-primary/10 text-sm"
              value={siteSearchQuery}
              onChange={e => setSiteSearchQuery(e.target.value)}
            />
          </div>
          <Badge variant="secondary" className="rounded-sm font-black uppercase text-[8px] md:text-[10px] tracking-widest px-3 h-7 md:h-8 border-none w-fit">
            {filteredSortedSites.length} Active Sites
          </Badge>
        </div>

        {filteredSortedSites.length > 0 ? (
          <>
            <div className="md:hidden space-y-3">
              {filteredSortedSites.map(site => {
                const count = siteStats[site.id] || 0;
                return (
                  <Card 
                    key={site.id} 
                    className="rounded-sm border-primary/10 shadow-sm active:bg-muted/5 transition-colors cursor-pointer"
                    onClick={() => router.push(`/checklists/data/${site.id}`)}
                  >
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-primary/10 rounded-sm text-primary shrink-0">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-sm text-foreground break-words leading-tight">{site.name}</span>
                          <span className="text-[9px] uppercase font-black text-muted-foreground break-words mt-1">{site.projectCompany}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-auto">
                        <Badge variant="outline" className="rounded-sm h-6 px-2 text-[9px] font-bold border-primary/10 bg-primary/5 text-primary">
                          {count}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card className="hidden md:block rounded-sm border-primary/10 shadow-md overflow-hidden">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead 
                        className="px-6 cursor-pointer hover:text-primary transition-colors"
                        onClick={() => handleSiteSort('name')}
                      >
                        <div className="flex items-center">Project Name <SiteSortIcon column="name" /></div>
                      </TableHead>
                      <TableHead 
                        className="hidden md:table-cell cursor-pointer hover:text-primary transition-colors"
                        onClick={() => handleSiteSort('company')}
                      >
                        <div className="flex items-center">Project Company <SiteSortIcon column="company" /></div>
                      </TableHead>
                      <TableHead 
                        className="text-center cursor-pointer hover:text-primary transition-colors"
                        onClick={() => handleSiteSort('count')}
                      >
                        <div className="flex items-center justify-center">Audits Found <SiteSortIcon column="count" /></div>
                      </TableHead>
                      <TableHead className="text-right px-6">Explore</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSortedSites.map(site => {
                      const count = siteStats[site.id] || 0;
                      return (
                        <TableRow 
                          key={site.id} 
                          className="hover:bg-muted/5 cursor-pointer transition-colors group"
                          onClick={() => router.push(`/checklists/data/${site.id}`)}
                        >
                          <TableCell className="px-6 py-4">
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors break-words leading-tight">{site.name}</span>
                              <span className="text-[10px] md:hidden uppercase font-black text-muted-foreground break-words mt-1">{site.projectCompany}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="text-[10px] uppercase font-black text-muted-foreground break-words">{site.projectCompany}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="rounded-sm h-6 px-2 text-[10px] font-bold border-primary/10 bg-primary/5 text-primary">
                              {count}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <div className="flex items-center justify-end gap-3 text-xs font-black text-foreground">
                              <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-all group-hover:translate-x-1" />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed rounded-sm bg-muted/5">
             <ClipboardCheck className="h-12 w-12 text-muted-foreground/20 mb-4" />
             <p className="font-black uppercase tracking-widest text-muted-foreground">No active audit logs discovered</p>
             <p className="text-[10px] text-muted-foreground/60 mt-1 uppercase italic">Sites will appear here as checklists are submitted.</p>
          </div>
        )}
      </div>
    </div>
  );
}
