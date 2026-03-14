'use client';

import * as React from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, getDocs, doc, Timestamp, orderBy, limit } from 'firebase/firestore';
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
  Printer, 
  User, 
  Clock, 
  MapPin, 
  Navigation, 
  FileText, 
  ArrowLeftRight, 
  ShieldCheck, 
  Timer,
  Camera,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Loader2,
  Users,
  Briefcase
} from 'lucide-react';
import { format, startOfDay, endOfDay, parseISO, differenceInMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { isSuperAdmin } from '@/lib/auth-constants';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type UserProfile = {
  id: string;
  username: string;
  email: string;
  role: string;
};

export default function AdminDayReportPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  const [selectedUserId, setSelectedUserId] = React.useState<string>("");
  const [selectedDate, setSelectedDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [isUserPopoverOpen, setIsUserPopoverOpen] = React.useState(false);
  const [userSearchQuery, setUserSearchQuery] = React.useState("");
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [reportData, setReportData] = React.useState<any>(null);

  const currentUserProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: currentUserProfile, isLoading: isProfileLoading } = useDoc(currentUserProfileRef);

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

  const fetchReport = async () => {
    if (!selectedUserId || !selectedDate) return;
    setIsGenerating(true);
    setReportData(null);

    const start = startOfDay(parseISO(selectedDate));
    const end = endOfDay(parseISO(selectedDate));
    const isManager = selectedUserObj?.role === 'Site Manager';

    try {
      // 1. Primary User Data
      const attQuery = query(
        collection(firestore, 'attendance'),
        where('userId', '==', selectedUserId),
        where('date', '==', selectedDate)
      );
      const attSnap = await getDocs(attQuery);
      const attendance = attSnap.docs.map(d => ({ id: d.id, ...d.data() }))[0];

      const visitsQuery = query(
        collection(firestore, 'site_visits'),
        where('managerId', '==', selectedUserId)
      );
      const visitsSnap = await getDocs(visitsQuery);
      const visits = visitsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((v: any) => {
          const d = v.startTime?.toDate();
          return d && d >= start && d <= end;
        });

      const dprsQuery = query(
        collection(firestore, 'dprs'),
        where('userId', '==', selectedUserId),
        where('reportDate', '==', selectedDate)
      );
      const dprsSnap = await getDocs(dprsQuery);
      const dprs = dprsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const movsQuery = query(
        collection(firestore, 'material_movements'),
        where('userId', '==', selectedUserId),
        where('movementDate', '==', selectedDate)
      );
      const movsSnap = await getDocs(movsQuery);
      const movements = movsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const ptwQuery = query(
        collection(firestore, 'permits_to_work'),
        where('siteEngineerId', '==', selectedUserId)
      );
      const ptwSnap = await getDocs(ptwQuery);
      const permits = ptwSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((p: any) => {
          const d = p.requestDate?.toDate();
          return d && d >= start && d <= end;
        });

      // 2. Team Data (if user is a Manager)
      let teamData = null;
      if (isManager) {
        const teamAttQuery = query(
          collection(firestore, 'attendance'),
          where('siteManagerId', '==', selectedUserId),
          where('date', '==', selectedDate)
        );
        const teamAttSnap = await getDocs(teamAttQuery);
        const teamAttendance = teamAttSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const teamVisitsQuery = query(
          collection(firestore, 'site_visits'),
          where('siteManagerId', '==', selectedUserId)
        );
        const teamVisitsSnap = await getDocs(teamVisitsQuery);
        const teamVisits = teamVisitsSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((v: any) => {
            const d = v.startTime?.toDate();
            // Only include team members, exclude the manager themselves (already in 'visits')
            return d && d >= start && d <= end && v.managerId !== selectedUserId;
          });

        const teamDprsQuery = query(
          collection(firestore, 'dprs'),
          where('siteManagerId', '==', selectedUserId),
          where('reportDate', '==', selectedDate)
        );
        const teamDprsSnap = await getDocs(teamDprsQuery);
        const teamDprs = teamDprsSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((d: any) => d.userId !== selectedUserId);

        const teamMovsQuery = query(
          collection(firestore, 'material_movements'),
          where('siteManagerId', '==', selectedUserId),
          where('movementDate', '==', selectedDate)
        );
        const teamMovsSnap = await getDocs(teamMovsQuery);
        const teamMovements = teamMovsSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((m: any) => m.userId !== selectedUserId);

        const teamPtwQuery = query(
          collection(firestore, 'permits_to_work'),
          where('siteManagerId', '==', selectedUserId)
        );
        const teamPtwSnap = await getDocs(teamPtwQuery);
        const teamPermits = teamPtwSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((p: any) => {
            const d = p.requestDate?.toDate();
            return d && d >= start && d <= end && p.siteEngineerId !== selectedUserId;
          });

        teamData = {
          attendance: teamAttendance,
          visits: teamVisits,
          dprs: teamDprs,
          movements: teamMovements,
          permits: teamPermits
        };
      }

      setReportData({
        attendance,
        visits,
        dprs,
        movements,
        permits,
        team: teamData
      });
    } catch (error) {
      console.error("Report generation failed", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  if (isProfileLoading || isUsersLoading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 no-print">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <h1>Daily Activity Audit</h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium">Consolidated timeline of personnel site presence and documentation.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">SELECT USER</Label>
            <Popover open={isUserPopoverOpen} onOpenChange={setIsUserPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[240px] justify-between h-10 rounded-sm font-bold border-primary/20">
                  {selectedUserId ? selectedUserObj?.username : "Select User..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[240px] p-0" align="start">
                <div className="flex items-center border-b px-3">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <Input 
                    placeholder="Search users..." 
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
                        className="w-full justify-start font-medium text-xs rounded-sm h-9"
                        onClick={() => { setSelectedUserId(u.id); setIsUserPopoverOpen(false); }}
                      >
                        <Check className={cn("mr-2 h-3 w-3", selectedUserId === u.id ? "opacity-100" : "opacity-0")} />
                        <div className="flex flex-col items-start overflow-hidden">
                          <span className="truncate">{u.username}</span>
                          <span className="text-[9px] text-muted-foreground uppercase">{u.role}</span>
                        </div>
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Report Date</Label>
            <Input 
              type="date" 
              className="h-10 rounded-sm font-bold border-primary/20 w-[160px]" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <Button onClick={fetchReport} disabled={!selectedUserId || isGenerating} className="h-10 px-6 rounded-sm font-bold shadow-md">
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileCheck className="h-4 w-4 mr-2" />}
            Generate Report
          </Button>
        </div>
      </div>

      {reportData ? (
        <div id="printable-report-area" className="animate-in fade-in slide-in-from-top-4 duration-500">
          <Card className="rounded-sm shadow-xl overflow-hidden border-primary/10">
            <CardHeader className="bg-primary/5 border-b p-8 flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary h-6 text-[10px] uppercase font-black px-3 rounded-sm shadow-sm">Official Activity Audit</Badge>
                  <span className="text-xs font-mono text-muted-foreground font-bold uppercase tracking-widest">
                    ID: {selectedUserId.slice(0, 8)}-{format(parseISO(selectedDate), 'yyyyMMdd')}
                  </span>
                </div>
                <h2 className="text-4xl font-black tracking-tight leading-none text-foreground">{selectedUserObj?.username}</h2>
                <div className="flex flex-wrap gap-4 text-sm font-bold text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    Role: {selectedUserObj?.role}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Date: {format(parseISO(selectedDate), 'eeee, dd MMM yyyy')}
                  </div>
                </div>
              </div>
              <Button onClick={handlePrint} variant="outline" className="rounded-sm font-bold border-primary text-primary no-print h-11 px-6 bg-white shadow-sm hover:bg-primary/5">
                <Printer className="h-4 w-4 mr-2" />
                Print Activity Report
              </Button>
            </CardHeader>

            <CardContent className="p-8 space-y-12">
              {/* Primary User Attendance Log Section */}
              <section className="space-y-6">
                <div className="flex items-center gap-3 border-b-2 border-primary/10 pb-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-black uppercase tracking-tight">Workday Presence Audit</h3>
                </div>
                
                {reportData.attendance ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-sm">
                          <p className="text-[10px] font-black uppercase text-emerald-700 tracking-widest mb-1">Check-in Time</p>
                          <p className="text-2xl font-black text-emerald-900">
                            {reportData.attendance.checkInTime ? format(reportData.attendance.checkInTime.toDate(), 'HH:mm') : '—'}
                          </p>
                          <div className="flex items-center gap-1 mt-2 text-emerald-600 font-mono text-[10px] font-bold">
                            <MapPin className="h-3 w-3" />
                            {reportData.attendance.checkInLat?.toFixed(5)}, {reportData.attendance.checkInLng?.toFixed(5)}
                          </div>
                        </div>
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-sm">
                          <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest mb-1">Check-out Time</p>
                          <div className="flex items-center gap-2">
                            <p className="text-2xl font-black text-slate-900">
                              {reportData.attendance.checkOutTime ? format(reportData.attendance.checkOutTime.toDate(), 'HH:mm') : 'Ongoing'}
                            </p>
                            {reportData.attendance.checkOutType === 'System Check Out' && (
                              <Badge variant="destructive" className="h-5 rounded-sm text-[8px] font-black uppercase">System Check Out</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-2 text-slate-500 font-mono text-[10px] font-bold">
                            <MapPin className="h-3 w-3" /> {reportData.attendance.checkOutLat ? `${reportData.attendance.checkOutLat.toFixed(5)}, ${reportData.attendance.checkOutLng?.toFixed(5)}` : 'N/A'}
                          </div>
                        </div>
                      </div>
                      <div className="p-4 bg-primary/5 rounded-sm border border-primary/10 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase text-primary tracking-widest">Total Duration</p>
                          <div className="flex items-center gap-2 text-lg font-black text-primary mt-1">
                            <Timer className="h-5 w-5" />
                            {reportData.attendance.checkInTime && reportData.attendance.checkOutTime 
                              ? `${Math.floor(differenceInMinutes(reportData.attendance.checkOutTime.toDate(), reportData.attendance.checkInTime.toDate()) / 60)}h ${differenceInMinutes(reportData.attendance.checkOutTime.toDate(), reportData.attendance.checkInTime.toDate()) % 60}m`
                              : 'Session in progress'}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 px-1">
                          <Camera className="h-3 w-3" /> Entry Verification
                        </Label>
                        {reportData.attendance.checkInSelfieUrl ? (
                          <img src={reportData.attendance.checkInSelfieUrl} className="aspect-video w-full object-cover rounded-sm border shadow-sm" alt="Check-in" />
                        ) : <div className="aspect-video bg-muted/20 rounded-sm border-2 border-dashed flex items-center justify-center text-[10px] text-muted-foreground uppercase font-bold">No Entry Selfie</div>}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 px-1">
                          <Camera className="h-3 w-3" /> Exit Verification
                        </Label>
                        {reportData.attendance.checkOutSelfieUrl ? (
                          <img src={reportData.attendance.checkOutSelfieUrl} className="aspect-video w-full object-cover rounded-sm border shadow-sm" alt="Check-out" />
                        ) : <div className="aspect-video bg-muted/20 rounded-sm border-2 border-dashed flex items-center justify-center text-[10px] text-muted-foreground uppercase font-bold">{reportData.attendance.checkOutType === 'System Check Out' ? 'Auto System Closure' : 'No Exit Selfie'}</div>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-12 text-center border-2 border-dashed rounded-sm bg-muted/5 flex flex-col items-center gap-3">
                    <AlertCircle className="h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest italic">No attendance records found for this user on the selected date.</p>
                  </div>
                )}
              </section>

              <Separator className="bg-primary/5" />

              {/* Site Visits Section */}
              <section className="space-y-6">
                <div className="flex items-center gap-3 border-b-2 border-primary/10 pb-2">
                  <Navigation className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-black uppercase tracking-tight">Active Site Visits Audit</h3>
                </div>
                
                {reportData.visits.length > 0 ? (
                  <div className="grid gap-6">
                    {reportData.visits.map((visit: any) => (
                      <Card key={visit.id} className="rounded-sm border-primary/5 shadow-sm overflow-hidden bg-primary/[0.01]">
                        <div className="p-6 flex flex-col md:flex-row gap-8">
                          <div className="md:w-1/3 space-y-4">
                            {visit.selfieUrl ? (
                              <div className="relative aspect-video rounded-sm overflow-hidden border shadow-md">
                                <img src={visit.selfieUrl} className="w-full h-full object-cover" alt="Visit Verification" />
                                <Badge className="absolute bottom-2 left-2 text-[8px] bg-black/60 border-none rounded-sm uppercase font-black">Audit Selfie</Badge>
                              </div>
                            ) : <div className="aspect-video bg-muted/30 rounded-sm border-2 border-dashed flex items-center justify-center text-xs font-bold uppercase text-muted-foreground">Selfie Missing</div>}
                            
                            <div className="space-y-2 p-3 bg-white rounded-sm border border-primary/5">
                              <p className="text-[10px] font-black uppercase text-muted-foreground">GPS Location Stamped</p>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2 text-[11px] font-mono font-bold text-primary">
                                  <MapPin className="h-3 w-3" /> {visit.startLat.toFixed(5)}, {visit.startLng.toFixed(5)}
                                </div>
                                {visit.endLat && (
                                  <div className="flex items-center gap-2 text-[11px] font-mono font-bold text-slate-500">
                                    <MapPin className="h-3 w-3" /> {visit.endLat.toFixed(5)}, {visit.endLng.toFixed(5)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex-1 space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-2xl font-black text-foreground">{visit.siteName}</h4>
                              <Badge variant="secondary" className="rounded-sm font-black uppercase text-[10px] tracking-widest">{visit.purpose}</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-bold text-muted-foreground uppercase tracking-tighter text-[10px]">Start Time</span>
                                <span className="font-black text-primary">{format(visit.startTime.toDate(), 'HH:mm')}</span>
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <span className="font-bold text-muted-foreground uppercase tracking-tighter text-[10px]">End Time</span>
                                <span className="font-black text-primary">{visit.endTime ? format(visit.endTime.toDate(), 'HH:mm') : 'In progress'}</span>
                              </div>
                            </div>
                            <Separator />
                            <div className="space-y-2">
                              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Visit Narrative</p>
                              <p className="text-sm italic leading-relaxed text-foreground/80">"{visit.details}"</p>
                            </div>
                            {visit.customerAvailable && (
                              <div className="p-3 bg-green-50 border border-green-100 rounded-sm text-green-800 text-xs font-bold flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4" /> Met Customer: {visit.customerNames}
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center text-muted-foreground italic border-2 border-dashed rounded-sm uppercase font-bold tracking-widest text-xs opacity-40">No site visits recorded today.</div>
                )}
              </section>

              {/* TEAM ACTIVITY SECTION - Shown only for Managers */}
              {reportData.team && (
                <>
                  <Separator className="bg-primary/5 h-1" />
                  <section className="space-y-8 py-4">
                    <div className="flex items-center gap-3 border-b-2 border-amber-500/20 pb-2">
                      <Users className="h-6 w-6 text-amber-600" />
                      <div className="flex flex-col">
                        <h3 className="text-2xl font-black uppercase tracking-tight text-amber-900 leading-tight">Reporting Team Activity Overview</h3>
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">Aggregated data for all Site Engineers reporting to {selectedUserObj?.username}</p>
                      </div>
                    </div>

                    <div className="grid gap-8">
                      {/* Team Presence Summary Table */}
                      <Card className="rounded-sm border-amber-500/10 shadow-sm overflow-hidden">
                        <CardHeader className="bg-amber-500/5 py-3 flex flex-row items-center gap-2">
                          <Clock className="h-4 w-4 text-amber-700" />
                          <CardTitle className="text-xs font-black uppercase tracking-widest text-amber-900">Personnel Presence Snapshot</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <Table>
                            <TableHeader className="bg-muted/30">
                              <TableRow>
                                <TableHead className="px-6 text-[10px] font-black uppercase">Engineer</TableHead>
                                <TableHead className="text-[10px] font-black uppercase">Check-in</TableHead>
                                <TableHead className="text-[10px] font-black uppercase">Check-out</TableHead>
                                <TableHead className="text-[10px] font-black uppercase">Status</TableHead>
                                <TableHead className="text-right px-6 text-[10px] font-black uppercase">Verification</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {reportData.team.attendance.length > 0 ? reportData.team.attendance.map((att: any) => (
                                <TableRow key={att.id}>
                                  <TableCell className="px-6 font-bold text-xs">{att.userName}</TableCell>
                                  <TableCell className="text-xs font-mono font-bold text-primary">{att.checkInTime ? format(att.checkInTime.toDate(), 'HH:mm') : '—'}</TableCell>
                                  <TableCell className="text-xs font-mono font-bold text-primary">
                                    {att.checkOutTime ? format(att.checkOutTime.toDate(), 'HH:mm') : 'Active'}
                                    {att.checkOutType === 'System Check Out' && (
                                      <Badge variant="outline" className="ml-1 bg-red-50 text-red-600 border-red-100 text-[7px] h-3.5 px-1 font-black uppercase">Auto</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={cn("text-[8px] font-black uppercase rounded-sm px-1.5 h-4", att.status === 'ongoing' ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-green-50 text-green-700 border-green-200")}>
                                      {att.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right px-6">
                                    <div className="flex justify-end gap-1.5">
                                      {att.checkInSelfieUrl && (
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-amber-600"><Camera className="h-3.5 w-3.5" /></Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-64 p-0">
                                            <img src={att.checkInSelfieUrl} className="w-full aspect-video object-cover" alt="Entry Verification" />
                                          </PopoverContent>
                                        </Popover>
                                      )}
                                      {att.checkInLat && (
                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-primary" asChild>
                                          <a href={`https://www.google.com/maps/search/?api=1&query=${att.checkInLat},${att.checkInLng}`} target="_blank" rel="noopener noreferrer"><MapPin className="h-3.5 w-3.5" /></a>
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )) : (
                                <TableRow>
                                  <TableCell colSpan={5} className="h-20 text-center text-xs italic text-muted-foreground uppercase font-bold">No team presence logged today.</TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Team Progress Reports */}
                        <div className="space-y-4">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-amber-800 flex items-center gap-2 px-1">
                            <FileText className="h-4 w-4" /> Team Progress logs (DPR)
                          </Label>
                          <div className="space-y-3">
                            {reportData.team.dprs.length > 0 ? reportData.team.dprs.map((dpr: any) => (
                              <div key={dpr.id} className="p-4 bg-amber-50/50 border border-amber-100 rounded-sm">
                                <div className="flex justify-between items-start mb-2">
                                  <p className="text-xs font-black uppercase text-amber-900">{dpr.userName}</p>
                                  <Badge variant="outline" className="text-[8px] h-4 rounded-sm border-amber-200">{dpr.siteName}</Badge>
                                </div>
                                <p className="text-xs leading-relaxed italic text-muted-foreground">"{dpr.description}"</p>
                              </div>
                            )) : <p className="text-[10px] font-bold text-muted-foreground uppercase italic px-1 opacity-50">No team progress logs recorded.</p>}
                          </div>
                        </div>

                        {/* Team Site Visits */}
                        <div className="space-y-4">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-amber-800 flex items-center gap-2 px-1">
                            <Navigation className="h-4 w-4" /> Team Site Activity (Visits)
                          </Label>
                          <div className="space-y-3">
                            {reportData.team.visits.length > 0 ? reportData.team.visits.map((visit: any) => (
                              <div key={visit.id} className="p-4 bg-amber-50/50 border border-amber-100 rounded-sm flex items-center justify-between">
                                <div className="space-y-1">
                                  <p className="text-xs font-black uppercase text-amber-900">{visit.managerName}</p>
                                  <p className="text-[10px] font-bold text-muted-foreground">{visit.siteName} • {visit.purpose}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-mono font-black text-amber-700">{format(visit.startTime.toDate(), 'HH:mm')}</p>
                                  <p className="text-[8px] font-black uppercase text-muted-foreground">{visit.status}</p>
                                </div>
                              </div>
                            )) : <p className="text-[10px] font-bold text-muted-foreground uppercase italic px-1 opacity-50">No team site visits recorded.</p>}
                          </div>
                        </div>

                        {/* Team Logistics & Permits */}
                        <div className="space-y-4 lg:col-span-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-amber-800 flex items-center gap-2 px-1">
                            <Briefcase className="h-4 w-4" /> Combined Team Operations (Logistics & Permits)
                          </Label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Team Movements */}
                            <div className="space-y-2">
                              {reportData.team.movements.length > 0 ? reportData.team.movements.map((mov: any) => (
                                <div key={mov.id} className="p-3 border rounded-sm bg-white flex items-center justify-between text-[11px]">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-amber-900">{mov.userName} recorded {mov.movementType}</span>
                                    <span className="text-[9px] text-muted-foreground uppercase">{mov.itemName} ({mov.siteName})</span>
                                  </div>
                                  <Badge className="h-4 text-[8px] font-black rounded-sm">{mov.quantity} {mov.unit}</Badge>
                                </div>
                              )) : null}
                            </div>
                            {/* Team Permits */}
                            <div className="space-y-2">
                              {reportData.team.permits.length > 0 ? reportData.team.permits.map((p: any) => (
                                <div key={p.id} className="p-3 border rounded-sm bg-white flex items-center justify-between text-[11px]">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-amber-900">{p.siteEngineerName} raised permit</span>
                                    <span className="text-[9px] text-muted-foreground uppercase">{p.serialNumber} ({p.siteName})</span>
                                  </div>
                                  <Badge variant="outline" className="h-4 text-[8px] font-black rounded-sm border-amber-200">{p.status}</Badge>
                                </div>
                              )) : null}
                            </div>
                            {reportData.team.movements.length === 0 && reportData.team.permits.length === 0 && (
                              <div className="col-span-2 py-8 text-center text-[10px] font-bold text-muted-foreground uppercase italic opacity-50">No team logistics or permit activities.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                </>
              )}

              <Separator className="bg-primary/5" />

              {/* Documentation Section (Primary User) */}
              <section className="space-y-6">
                <div className="flex items-center gap-3 border-b-2 border-primary/10 pb-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-black uppercase tracking-tight">Personal Documentation Audit (DPR / Materials / Permits)</h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* DPR Activity */}
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 px-1">
                      <FileText className="h-4 w-4" /> Daily Progress Reports
                    </Label>
                    {reportData.dprs.length > 0 ? (
                      <div className="space-y-3">
                        {reportData.dprs.map((dpr: any) => (
                          <div key={dpr.id} className="p-4 bg-muted/20 border rounded-sm">
                            <p className="text-xs font-black uppercase text-primary mb-2">{dpr.siteName}</p>
                            <p className="text-sm leading-relaxed italic line-clamp-3">"{dpr.description}"</p>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-muted-foreground italic px-1">No DPR submissions.</p>}
                  </div>

                  {/* Material Movement Activity */}
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 px-1">
                      <ArrowLeftRight className="h-4 w-4" /> Material Logs
                    </Label>
                    {reportData.movements.length > 0 ? (
                      <div className="space-y-3">
                        {reportData.movements.map((mov: any) => (
                          <div key={mov.id} className="p-4 bg-muted/20 border rounded-sm flex items-center justify-between gap-4">
                            <div className="space-y-1 overflow-hidden">
                              <p className="text-sm font-bold truncate">{mov.itemName}</p>
                              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tight">{mov.siteName} • {mov.movementType}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-lg font-black text-primary">{mov.quantity}</p>
                              <p className="text-[9px] font-bold text-muted-foreground uppercase">{mov.unit}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-muted-foreground italic px-1">No material movement logs.</p>}
                  </div>

                  {/* Permit Activity */}
                  <div className="space-y-4 lg:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 px-1">
                      <ShieldCheck className="h-4 w-4" /> Permit Activity (New Requests)
                    </Label>
                    {reportData.permits.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {reportData.permits.map((p: any) => (
                          <div key={p.id} className="p-4 bg-muted/20 border rounded-sm flex items-start gap-4">
                            <div className="p-2 bg-primary/10 rounded-sm">
                              <FileCheck className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 space-y-1">
                              <p className="text-xs font-mono font-bold text-primary">{p.serialNumber}</p>
                              <p className="text-sm font-bold leading-tight">{p.ptwType}</p>
                              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">{p.siteName}</p>
                            </div>
                            <Badge variant="outline" className="rounded-sm text-[9px] h-5 px-1.5 uppercase font-bold">{p.status}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-muted-foreground italic px-1">No new permit requests raised.</p>}
                  </div>
                </div>
              </section>
            </CardContent>
            
            <Separator />
            
            <div className="p-8 flex flex-col items-center justify-center text-center gap-2 bg-muted/5">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">End of Official Audit Record</p>
              <p className="text-[8px] text-muted-foreground/40 font-mono">Generated by Aditya Pro Audit Engine on {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
            </div>
          </Card>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-32 text-center bg-card border border-dashed rounded-sm border-primary/20 no-print">
          <FileText className="h-16 w-16 text-muted-foreground/20 mb-4" />
          <h3 className="text-xl font-bold">Ready to Audit</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mt-2">
            Select a personnel and date from the controls above to generate a consolidated activity report.
          </p>
        </div>
      )}
    </div>
  );
}