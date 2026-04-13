
'use client';

import * as React from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, doc, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  format, 
  getDaysInMonth, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isAfter, 
  parse, 
  startOfDay,
  addMonths,
  subMonths
} from 'date-fns';
import { 
  ArrowLeft, 
  Check, 
  X, 
  Star, 
  AlertCircle, 
  Plane, 
  ChevronLeft, 
  ChevronRight, 
  Info,
  Search,
  RefreshCw,
  FileDown
} from 'lucide-react';
import { isSuperAdmin } from '@/lib/auth-constants';
import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';

type UserProfile = {
  id: string;
  username: string;
  email: string;
  role: string;
  department: string;
};

type AttendanceRecord = {
  id: string;
  userId: string;
  date: string;
  status: 'ongoing' | 'completed';
  checkInTime?: any;
  checkOutTime?: any;
};

export default function AttendanceMatrixPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [searchTerm, setSearchTerm] = React.useState("");

  const currentUserProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: currentUserProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(currentUserProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || currentUserProfile?.role === 'Admin' || currentUserProfile?.role === 'Manager - Human Resources';

  React.useEffect(() => {
    if (!isUserLoading && !isProfileLoading && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [isUserLoading, isProfileLoading, isAdmin, router]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers, isLoading: isUsersLoading } = useCollection<UserProfile>(usersQuery);

  const attendanceQuery = useMemoFirebase(() => {
    return query(
      collection(firestore, 'attendance'),
      where('date', '>=', format(monthStart, 'yyyy-MM-dd')),
      where('date', '<=', format(monthEnd, 'yyyy-MM-dd'))
    );
  }, [firestore, currentDate]);
  const { data: monthAttendance, isLoading: isAttendanceLoading } = useCollection<AttendanceRecord>(attendanceQuery);

  const filteredUsers = React.useMemo(() => {
    if (!allUsers) return [];
    return allUsers
      .filter(u => 
        u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.username.localeCompare(b.username));
  }, [allUsers, searchTerm]);

  const handlePrevMonth = () => setCurrentDate(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));

  const handleExport = () => {
    if (!filteredUsers || !monthAttendance) return;

    const exportData = filteredUsers.map(u => {
      const row: any = { 'Employee': u.username, 'Role': u.role };
      let presentCount = 0;
      daysInMonth.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const record = monthAttendance.find(a => a.userId === u.id && a.date === dateStr);
        if (record) {
          row[format(day, 'dd')] = '✔';
          presentCount++;
        } else if (isAfter(day, startOfDay(new Date()))) {
          row[format(day, 'dd')] = '-';
        } else {
          row[format(day, 'dd')] = '✖';
        }
      });
      row['Total'] = `${presentCount} / ${daysInMonth.length}`;
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance Matrix");
    XLSX.writeFile(wb, `Attendance_Matrix_${format(currentDate, 'MMM_yyyy')}.xlsx`);
  };

  if (isProfileLoading || isUsersLoading || isAttendanceLoading || isUserLoading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-[600px] w-full" /></div>;
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={() => router.push('/admin/attendance-summary')} className="h-7 mb-1 -ml-2 text-muted-foreground hover:text-primary">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Summary
          </Button>
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-black uppercase tracking-tight">Monthly Attendance Matrix</h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium">Cross-personnel presence grid for {format(currentDate, 'MMMM yyyy')}.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-muted/50 rounded-sm border border-primary/10 p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="px-4 text-xs font-black uppercase tracking-widest">{format(currentDate, 'MMMM yyyy')}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Filter personnel..." 
              className="pl-8 h-10 rounded-sm border-primary/20 text-xs" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          <Button onClick={handleExport} variant="outline" className="h-10 rounded-sm font-bold border-primary text-primary hover:bg-primary/5 px-6">
            <FileDown className="h-4 w-4 mr-2" /> Export
          </Button>
        </div>
      </div>

      {/* Matrix Legend */}
      <div className="flex flex-wrap items-center gap-6 p-4 bg-muted/20 border border-dashed rounded-sm text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        <span className="text-foreground">Legends:</span>
        <div className="flex items-center gap-1.5 text-blue-600"><Check className="h-3.5 w-3.5" /> Present</div>
        <div className="flex items-center gap-1.5 text-slate-400"><X className="h-3.5 w-3.5" /> Absent</div>
        <div className="flex items-center gap-1.5 text-amber-500"><Star className="h-3.5 w-3.5 fill-amber-500" /> Holiday</div>
        <div className="flex items-center gap-1.5 text-blue-500"><AlertCircle className="h-3.5 w-3.5" /> Late</div>
        <div className="flex items-center gap-1.5 text-red-500"><Plane className="h-3.5 w-3.5" /> On Leave</div>
        <div className="ml-auto flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-primary/20" /> Current Date</div>
      </div>

      <Card className="rounded-sm border-primary/10 shadow-xl overflow-hidden">
        <CardContent className="p-0">
          <div className="relative h-[70vh] overflow-auto custom-scrollbar">
            <table className="w-full border-collapse border-spacing-0 text-[10px]">
              <thead className="sticky top-0 z-30 bg-muted/95 backdrop-blur-md shadow-sm">
                <tr>
                  <th className="sticky left-0 z-40 bg-muted px-6 py-4 border-b border-r text-left min-w-[220px] font-black uppercase tracking-widest text-muted-foreground">
                    Employee
                  </th>
                  {daysInMonth.map(day => {
                    const isToday = isSameDay(day, new Date());
                    return (
                      <th 
                        key={day.toString()} 
                        className={cn(
                          "px-2 py-3 border-b text-center min-w-[40px] transition-colors",
                          isToday && "bg-primary/10 ring-1 ring-primary/20"
                        )}
                      >
                        <div className="flex flex-col items-center">
                          <span className="font-mono text-xs font-black">{format(day, 'dd')}</span>
                          <span className="text-[8px] font-bold text-muted-foreground uppercase">{format(day, 'EEE')}</span>
                        </div>
                      </th>
                    );
                  })}
                  <th className="sticky right-0 z-40 bg-muted px-6 py-4 border-b border-l text-center font-black uppercase tracking-widest text-muted-foreground">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length > 0 ? filteredUsers.map((u) => {
                  let presentCount = 0;
                  return (
                    <tr key={u.id} className="hover:bg-muted/5 transition-colors border-b last:border-0 group">
                      <td className="sticky left-0 z-20 bg-background group-hover:bg-muted/5 px-6 py-3 border-r flex items-center gap-3 transition-colors">
                        <Avatar className="h-8 w-8 rounded-sm shadow-sm">
                          <AvatarFallback className="text-[10px] font-black bg-primary/5 text-primary">
                            {u.username?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-sm text-foreground truncate">{u.username}</span>
                          <span className="text-[9px] text-muted-foreground uppercase font-black truncate">{u.role}</span>
                        </div>
                      </td>
                      {daysInMonth.map(day => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const record = monthAttendance?.find(a => a.userId === u.id && a.date === dateStr);
                        const isToday = isSameDay(day, new Date());
                        const isFuture = isAfter(day, startOfDay(new Date()));
                        
                        if (record) presentCount++;

                        return (
                          <td 
                            key={day.toString()} 
                            className={cn(
                              "px-1 py-3 text-center transition-colors",
                              isToday && "bg-primary/[0.02]"
                            )}
                          >
                            <TooltipProvider delayDuration={0}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex justify-center">
                                    {record ? (
                                      <Check className="h-4 w-4 text-blue-600 animate-in zoom-in duration-300" />
                                    ) : isFuture ? (
                                      <span className="text-muted-foreground/30 font-bold">—</span>
                                    ) : (
                                      <X className="h-4 w-4 text-slate-300 opacity-50" />
                                    )}
                                  </div>
                                </TooltipTrigger>
                                {record && (
                                  <TooltipContent className="rounded-sm bg-slate-900 border-none text-white p-3 shadow-2xl">
                                    <div className="space-y-1.5">
                                      <p className="text-[10px] font-black uppercase text-primary tracking-widest border-b border-white/10 pb-1">{u.username}</p>
                                      <div className="flex items-center justify-between gap-4">
                                        <span className="text-[9px] font-bold text-white/60">Log:</span>
                                        <span className="text-[10px] font-mono font-bold text-emerald-400">{record.status}</span>
                                      </div>
                                      <div className="flex items-center justify-between gap-4">
                                        <span className="text-[9px] font-bold text-white/60">In:</span>
                                        <span className="text-[10px] font-mono font-bold">{record.checkInTime ? format(record.checkInTime.toDate(), 'HH:mm') : '—'}</span>
                                      </div>
                                      <div className="flex items-center justify-between gap-4">
                                        <span className="text-[9px] font-bold text-white/60">Out:</span>
                                        <span className="text-[10px] font-mono font-bold">{record.checkOutTime ? format(record.checkOutTime.toDate(), 'HH:mm') : (record.status === 'ongoing' ? 'Active' : '—')}</span>
                                      </div>
                                    </div>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          </td>
                        );
                      })}
                      <td className="sticky right-0 z-20 bg-background group-hover:bg-muted/5 px-6 py-3 border-l text-center transition-colors">
                        <Badge variant="outline" className="h-6 px-3 rounded-full font-mono font-black text-[10px] bg-primary/5 text-primary border-primary/20 shadow-sm">
                          {presentCount} / {daysInMonth.length}
                        </Badge>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={daysInMonth.length + 2} className="h-64 text-center text-muted-foreground italic text-sm">
                      No personnel records discovered for this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
