'use client';

import * as React from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  Check, 
  ChevronsUpDown, 
  Calendar, 
  User, 
  Clock, 
  Timer,
  CheckCircle2,
  Loader2,
  Navigation,
  Building2,
  ArrowRight,
  Globe,
  AreaChart,
  FileText,
  Eye
} from 'lucide-react';
import { format, startOfDay, endOfDay, parseISO, differenceInMinutes, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { isSuperAdmin } from '@/lib/auth-constants';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';

type UserProfile = {
  id: string;
  username: string;
  email: string;
  role: string;
};

type SiteVisit = {
  id: string;
  siteName: string;
  managerName: string;
  managerId: string;
  startTime: any;
  endTime?: any;
  status: 'ongoing' | 'completed';
  locationType?: 'site' | 'other';
};

export default function SiteVisitsSummaryPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  const [selectedUserId, setSelectedUserId] = React.useState<string>("");
  const [selectedDate, setSelectedDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [customStart, setCustomStart] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [useRange, setUseRange] = React.useState(false);
  
  const [isUserPopoverOpen, setIsUserPopoverOpen] = React.useState(false);
  const [userSearchQuery, setUserSearchQuery] = React.useState("");
  const [isLoadingData, setIsLoadingData] = React.useState(false);
  const [filteredVisits, setFilteredVisits] = React.useState<SiteVisit[]>([]);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: currentUserProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || currentUserProfile?.role === 'Admin';

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers, isLoading: isUsersLoading } = useCollection<UserProfile>(usersQuery);

  const filteredUsersList = React.useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(u => 
      u.username?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearchQuery.toLowerCase())
    );
  }, [allUsers, userSearchQuery]);

  const selectedUserObj = React.useMemo(() => allUsers?.find(u => u.id === selectedUserId), [allUsers, selectedUserId]);

  React.useEffect(() => {
    if (!isUserLoading && !isProfileLoading && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [isUserLoading, isProfileLoading, isAdmin, router]);

  React.useEffect(() => {
    const fetchVisits = async () => {
      if (!selectedUserId) return;
      setIsLoadingData(true);
      
      const start = useRange ? startOfDay(parseISO(customStart)) : startOfDay(parseISO(selectedDate));
      const end = useRange ? endOfDay(parseISO(customEnd)) : endOfDay(parseISO(selectedDate));

      if (!isValid(start) || !isValid(end)) {
        setIsLoadingData(false);
        return;
      }

      try {
        const q = query(
          collection(firestore, 'site_visits'),
          where('managerId', '==', selectedUserId),
          where('status', '==', 'completed')
        );
        
        const snap = await getDocs(q);
        const results = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as SiteVisit))
          .filter(v => {
            const d = v.startTime?.toDate();
            return d && d >= start && d <= end;
          })
          .sort((a, b) => b.startTime.toDate().getTime() - a.startTime.toDate().getTime());
        
        setFilteredVisits(results);
      } catch (e) {
        console.error("Failed to fetch visits", e);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchVisits();
  }, [selectedUserId, selectedDate, customStart, customEnd, useRange, firestore]);

  const summary = React.useMemo(() => {
    const totalVisits = filteredVisits.length;
    let totalMinutes = 0;

    filteredVisits.forEach(v => {
      if (v.startTime && v.endTime) {
        totalMinutes += differenceInMinutes(v.endTime.toDate(), v.startTime.toDate());
      }
    });

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const avgMinutes = totalVisits > 0 ? Math.round(totalMinutes / totalVisits) : 0;
    const avgHours = Math.floor(avgMinutes / 60);
    const avgMins = avgMinutes % 60;

    return {
      totalVisits,
      totalTime: `${hours}h ${mins}m`,
      avgTime: `${avgHours}h ${avgMins}m`
    };
  }, [filteredVisits]);

  if (isProfileLoading || isUsersLoading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-sm shrink-0">
              <AreaChart className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight">Visit Summary Audit</h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Historical performance & presence analytics</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Select Personnel</Label>
            <Popover open={isUserPopoverOpen} onOpenChange={setIsUserPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[240px] justify-between h-10 rounded-sm font-bold border-primary/20 bg-background">
                  {selectedUserId ? selectedUserObj?.username : "Choose Personnel..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[240px] p-0" align="start">
                <div className="flex items-center border-b px-3">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <Input 
                    placeholder="Search name..." 
                    className="h-9 w-full border-none focus-visible:ring-0 px-0 text-xs" 
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                  />
                </div>
                <ScrollArea className="h-[200px]">
                  <div className="p-1">
                    {filteredUsersList.map(u => (
                      <Button
                        key={u.id}
                        variant="ghost"
                        className="w-full justify-start font-bold text-xs rounded-sm h-10 mb-0.5"
                        onClick={() => { setSelectedUserId(u.id); setIsUserPopoverOpen(false); }}
                      >
                        <Check className={cn("mr-2 h-3 w-3 text-primary", selectedUserId === u.id ? "opacity-100" : "opacity-0")} />
                        <div className="flex flex-col items-start overflow-hidden">
                          <span className="truncate">{u.username}</span>
                          <span className="text-[9px] text-muted-foreground uppercase font-black">{u.role}</span>
                        </div>
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Audit Window</Label>
            <div className="flex items-center bg-muted/30 rounded-sm border border-primary/10 p-1 h-10">
              <Button 
                variant={!useRange ? "default" : "ghost"} 
                size="sm" 
                className="h-8 rounded-sm text-[10px] font-black uppercase px-4"
                onClick={() => setUseRange(false)}
              >
                Date
              </Button>
              <Button 
                variant={useRange ? "default" : "ghost"} 
                size="sm" 
                className="h-8 rounded-sm text-[10px] font-black uppercase px-4"
                onClick={() => setUseRange(true)}
              >
                Range
              </Button>
            </div>
          </div>

          {!useRange ? (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Select Date</Label>
              <Input 
                type="date" 
                className="h-10 rounded-sm font-bold border-primary/20 w-[160px] bg-background" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          ) : (
            <div className="flex items-end gap-2 animate-in slide-in-from-right-2 duration-300">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">From</Label>
                <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-10 rounded-sm border-primary/20 bg-background text-xs font-bold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">To</Label>
                <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-10 rounded-sm border-primary/20 bg-background text-xs font-bold" />
              </div>
            </div>
          )}
        </div>
      </div>

      {!selectedUserId ? (
        <div className="flex flex-col items-center justify-center py-32 text-center bg-card border border-dashed rounded-sm border-primary/20">
          <User className="h-16 w-16 text-muted-foreground/20 mb-4" />
          <h3 className="text-xl font-bold">Awaiting Selection</h3>
          <p className="text-muted-foreground max-sm mx-auto mt-2 text-sm font-medium">
            Please select a personnel from the dropdown above to view their field activity analytics.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SummaryCard title="Total Site Visits" value={summary.totalVisits} icon={Navigation} color="blue" description="Completed Sessions" />
            <SummaryCard title="Total Time on Site" value={summary.totalTime} icon={Clock} color="primary" description="Aggregate Presence" />
            <SummaryCard title="Average Time / Visit" value={summary.avgTime} icon={Timer} color="emerald" description="Visit Efficiency" />
          </div>

          <Card className="rounded-sm shadow-xl border-primary/10 overflow-hidden">
            <CardHeader className="bg-muted/5 border-b py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Audit Detail Log
                </CardTitle>
                <Badge variant="outline" className="h-6 px-3 rounded-full font-mono font-black text-[10px] bg-primary/5 text-primary border-primary/10">
                  {filteredVisits.length} Records
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingData ? (
                <div className="p-12 space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : filteredVisits.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="px-6 font-black uppercase text-[10px] tracking-widest h-11">Date & Time</TableHead>
                        <TableHead className="font-black uppercase text-[10px] tracking-widest h-11">Location</TableHead>
                        <TableHead className="font-black uppercase text-[10px] tracking-widest h-11">Purpose</TableHead>
                        <TableHead className="text-center font-black uppercase text-[10px] tracking-widest h-11">Duration</TableHead>
                        <TableHead className="text-right px-6 font-black uppercase text-[10px] tracking-widest h-11">Audit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVisits.map((visit) => (
                        <TableRow key={visit.id} className="hover:bg-muted/5 transition-colors group">
                          <TableCell className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-sm text-foreground">{format(visit.startTime.toDate(), 'dd MMM yyyy')}</span>
                              <span className="text-[10px] font-mono font-black text-muted-foreground uppercase">{format(visit.startTime.toDate(), 'HH:mm')} — {visit.endTime ? format(visit.endTime.toDate(), 'HH:mm') : 'Active'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {visit.locationType === 'other' ? <Globe className="h-3.5 w-3.5 text-primary/40" /> : <Building2 className="h-3.5 w-3.5 text-primary/40" />}
                              <span className="font-bold text-sm text-foreground">{visit.siteName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="rounded-sm text-[9px] font-black uppercase h-5 bg-primary/5 text-primary border-none shadow-sm">{visit.purpose || 'General'}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2 font-black text-xs text-foreground">
                              <Timer className="h-3.5 w-3.5 text-primary/60" />
                              {calculateDurationStr(visit.startTime, visit.endTime)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                              <Link href={`/site-visits/${visit.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-32 text-center text-muted-foreground italic text-xs uppercase font-black tracking-widest opacity-20 leading-relaxed">
                  No completed presence records found for {selectedUserObj?.username} in the selected timeframe.
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, color, description }: { title: string, value: string | number, icon: any, color: 'primary' | 'emerald' | 'blue', description: string }) {
  const colors = {
    primary: "bg-primary/5 border-primary/10 text-primary",
    emerald: "bg-emerald-500/5 border-emerald-500/10 text-emerald-600",
    blue: "bg-blue-500/5 border-blue-500/10 text-blue-600",
  };

  return (
    <Card className={cn("rounded-sm border shadow-sm overflow-hidden group hover:shadow-lg transition-all duration-300", colors[color])}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{title}</CardTitle>
        <div className="p-2 rounded-sm bg-background/50 border border-border/5 group-hover:scale-110 transition-transform">
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        <div className="text-3xl font-black tabular-nums tracking-tighter leading-none mb-1">{value}</div>
        <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-40">{description}</p>
      </CardContent>
    </Card>
  );
}

const calculateDurationStr = (start: any, end: any) => {
  if (!start || !end) return '—';
  const s = start.toDate ? start.toDate() : new Date(start);
  const e = end.toDate ? end.toDate() : new Date(end);
  const totalMinutes = differenceInMinutes(e, s);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${mins}m`;
};
