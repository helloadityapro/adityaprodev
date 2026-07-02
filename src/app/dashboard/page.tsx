'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search, Building2, Zap, ShieldCheck, ListFilter, ArrowRight } from 'lucide-react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { isSuperAdmin } from '@/lib/auth-constants';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

// Define the type for our site data
type SiteData = {
  'Project Company': string;
  'Project name': string;
  'AC Capacity': string;
  'DC Capacity': string;
};

// Simple CSV to JSON parser
const parseCSV = (csvText: string): SiteData[] => {
  const lines = csvText.trim().split('\n');
  const data: SiteData[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values = line.split(',').map(v => v.trim().replace(/\r/g, ''));
    
    if (values.length >= 5 && !isNaN(parseInt(values[0], 10)) && values[2] && values[2].trim() !== '') {
      const entry: SiteData = {
        'Project Company': values[1],
        'Project name': values[2],
        'DC Capacity': values[3],
        'AC Capacity': values[4],
      };
      data.push(entry);
    }
  }
  return data;
};


function DashboardSkeleton() {
    return (
      <div className="animate-pulse space-y-6">
        <div className="flex items-center">
            <Skeleton className="h-9 w-48" />
        </div>
        <Card className="rounded-sm">
            <CardHeader className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                  <Skeleton className="h-11 w-full md:w-80" />
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="space-y-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-none" />
                  ))}
                </div>
            </CardContent>
        </Card>
      </div>
    );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  
  const [sites, setSites] = useState<SiteData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  useEffect(() => {
    if (!isUserLoading && !isProfileLoading && user && !isAdmin) {
      router.replace('/ptw/list');
    }
  }, [user, isUserLoading, isProfileLoading, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchData = async () => {
      try {
        const response = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vT8JE2-QFEjU_CVprrrBPivhxoygAtkC8S6JFPTK8-R28EL9XuTTv7aJ3Onejmsp55_RQEvF8g7Ku1p/pub?gid=1131066411&single=true&output=csv');
        if (!response.ok) {
          throw new Error('Failed to fetch data from Google Sheet.');
        }
        const csvText = await response.text();
        const parsedData = parseCSV(csvText);
        setSites(parsedData);
      } catch (err: any) {
        setError(err.message || 'An error occurred while fetching data.');
      } finally {
        setIsDataLoading(false);
      }
    };

    fetchData();
  }, [isAdmin]);

  const filteredSites = useMemo(() => {
    return sites.filter(site => 
      site['Project Company'].toLowerCase().includes(searchTerm.toLowerCase()) ||
      site['Project name'].toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sites, searchTerm]);

  if (isUserLoading || isProfileLoading || (isAdmin && isDataLoading)) return <DashboardSkeleton />;
  if (!isAdmin) return null;
  if (error) return <div className="p-12 text-center text-destructive font-bold uppercase">{error}</div>;

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl md:text-3xl font-black uppercase tracking-tight text-foreground">Project Master Registry</h1>
        <p className="text-muted-foreground text-[10px] md:text-sm font-medium">Synchronized site metadata from organizational project master.</p>
      </div>

      <Card className="rounded-sm border-primary/10 shadow-lg overflow-hidden">
        <CardHeader className="bg-muted/5 border-b p-4 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-1.5">
              <CardTitle className="text-lg md:text-xl font-black uppercase tracking-tight">Active Deployments</CardTitle>
              <CardDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Master Data Feed : Google Cloud</CardDescription>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-[320px]">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Filter project or client..."
                  className="pl-10 h-11 rounded-sm bg-background border-primary/10 text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Badge variant="outline" className="hidden sm:flex rounded-sm font-black uppercase text-[10px] px-3 h-11 border-primary/20 text-primary bg-primary/5">
                {filteredSites.length} Records
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="md:hidden divide-y">
            {filteredSites.length > 0 ? filteredSites.map((site, index) => (
              <div key={index} className="p-4 space-y-4 hover:bg-muted/5 transition-colors">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-0.5">
                    <h3 className="font-black text-sm text-foreground uppercase tracking-tight leading-tight">{site['Project name']}</h3>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">{site['Project Company']}</p>
                  </div>
                  <div className="p-2 bg-primary/10 rounded-sm text-primary">
                    <Building2 className="h-4 w-4" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted/20 rounded-sm space-y-1">
                    <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest block">AC CAP</span>
                    <div className="flex items-baseline gap-1">
                      <span className="font-black text-xs text-primary">{site['AC Capacity']}</span>
                      <span className="text-[7px] font-bold uppercase opacity-50">MW</span>
                    </div>
                  </div>
                  <div className="p-3 bg-muted/20 rounded-sm space-y-1">
                    <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest block">DC CAP</span>
                    <div className="flex items-baseline gap-1">
                      <span className="font-black text-xs text-amber-600">{site['DC Capacity']}</span>
                      <span className="text-[7px] font-bold uppercase opacity-50">MWP</span>
                    </div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="py-20 text-center text-muted-foreground italic text-xs uppercase font-bold opacity-30">No matches found</div>
            )}
          </div>

          <div className="hidden md:block">
            <ScrollArea className="w-full">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-8 font-black uppercase text-[10px] tracking-widest">Client / Company</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest">Project Description</TableHead>
                    <TableHead className="text-center font-black uppercase text-[10px] tracking-widest">AC Output (MW)</TableHead>
                    <TableHead className="text-center font-black uppercase text-[10px] tracking-widest">DC Peak (MWp)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSites.length > 0 ? (
                    filteredSites.map((site, index) => (
                      <TableRow key={index} className="hover:bg-muted/5 transition-colors group">
                        <TableCell className="px-8 py-5">
                          <span className="font-bold text-xs uppercase tracking-tight text-muted-foreground group-hover:text-foreground transition-colors">{site['Project Company']}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-sm text-primary opacity-40 group-hover:opacity-100 transition-all">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <span className="font-black text-sm text-foreground tracking-tight">{site['Project name']}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="font-mono font-black text-xs bg-primary/5 text-primary border-primary/10 h-7 px-3">
                            {site['AC Capacity']}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="font-mono font-black text-xs bg-amber-50 text-amber-700 border-amber-200 h-7 px-3">
                            {site['DC Capacity']}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-64 text-center text-muted-foreground uppercase font-black text-xs opacity-20 tracking-[0.3em]">
                        {searchTerm ? "Search Results Empty" : "Registry Sync Failure"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
