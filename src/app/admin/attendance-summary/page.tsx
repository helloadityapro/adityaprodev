'use client';

import * as React from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { CalendarDays, Search, FileDown, User, Clock, MapPin, CheckCircle2, XCircle, Timer, Loader2, ArrowUpDown, ArrowUp, ArrowDown, FilterX, Users, Building2 } from 'lucide-react';
import { isSuperAdmin } from '@/lib/auth-constants';
import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  userName: string;
  checkInTime: any;
  checkOutTime?: any;
  checkOutType?: string;
  status: 'ongoing' | 'completed';
  date: string;
  checkInLat?: number;
  checkInLng?: number;
  checkOutLat?: number;
  checkOutLng?: number;
};

type SortKey = 'personnel' | 'status' | 'checkIn' | 'checkOut';

export default function AttendanceSummaryPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  const [selectedDate, setSelectedDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [roleFilter, setRoleFilter] = React.useState<string>("all");
  const [deptFilter, setDeptFilter] = React.useState<string>("all");
  const [isExporting, setIsExporting] = React.useState(false);
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'personnel', direction: 'asc' });

  const currentUserProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: currentUserProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(currentUserProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || currentUserProfile?.role === 'Admin' || currentUserProfile?.role === 'Manager - Human Resources';

  React.useEffect(() => {
    if (!isUserLoading && !isProfileLoading && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [isUserLoading, isProfileLoading, isAdmin, router]);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers, isLoading: isUsersLoading } = useCollection<UserProfile>(usersQuery);

  const deptsQuery = useMemoFirebase(() => collection(firestore, 'user_departments'), [firestore]);
  const { data: allDepts } = useCollection<{ name: string }>(deptsQuery);

  const attendanceQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'attendance'), where('date', '==', selectedDate));
  }, [firestore, selectedDate]);
  const { data: attendanceRecords, isLoading: isAttendanceLoading } = useCollection<AttendanceRecord>(attendanceQuery);

  const summaryData = React.useMemo(() => {
    if (!allUsers || !attendanceRecords) return [];

    const data = allUsers
      .filter(u => u.role !== 'Admin' && u.role !== 'Manager - Human Resources') // Only show operations staff
      .map(u => {
        const record = attendanceRecords.find(r => r.userId === u.id);
        return {
          user: u,
          record: record || null,
          status: record ? record.status : 'absent'
        };
      })
      .filter(item => {
        const matchesSearch = item.user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             item.user.email?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
        const matchesRole = roleFilter === 'all' || item.user.role === roleFilter;
        const matchesDept = deptFilter === 'all' || item.user.department === deptFilter;
        
        return matchesSearch && matchesStatus && matchesRole && matchesDept;
      });

    return data.sort((a, b) => {
      const { key, direction } = sortConfig;
      let valA: any = '';
      let valB: any = '';

      if (key === 'personnel') {
        valA = a.user.username.toLowerCase();
        valB = b.user.username.toLowerCase();
      } else if (key === 'status') {
        valA = a.status;
        valB = b.status;
      } else if (key === 'checkIn') {
        valA = a.record?.checkInTime?.toDate?.()?.getTime() || 0;
        valB = b.record?.checkInTime?.toDate?.()?.getTime() || 0;
      } else if (key === 'checkOut') {
        valA = a.record?.checkOutTime?.toDate?.()?.getTime() || (a.status === 'ongoing' ? Infinity : 0);
        valB = b.record?.checkOutTime?.toDate?.()?.getTime() || (b.status === 'ongoing' ? Infinity : 0);
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [allUsers, attendanceRecords, searchTerm, statusFilter, roleFilter, deptFilter, sortConfig]);

  const stats = React.useMemo(() => {
    const total = summaryData.length;
    const present = summaryData.filter(i => i.record).length;
    const ongoing = summaryData.filter(i => i.status === 'ongoing').length;
    const completed = summaryData.filter(i => i.status === 'completed').length;
    return { total, present, absent: total - present, ongoing, completed };
  }, [summaryData]);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setRoleFilter("all");
    setDeptFilter("all");
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4 text-primary" /> : <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
  };

  const handleExport = () => {
    if (summaryData.length === 0) return;
    setIsExporting(true);
    
    const exportData = summaryData.map(item => ({
      'Name': item.user.username,
      'Email': item.user.email,
      'Role': item.user.role,
      'Department': item.user.department || 'N/A',
      'Status': item.status === 'absent' ? 'Absent' : (item.status === 'ongoing' ? 'Ongoing' : 'Completed'),
      'Check-out Method': item.record?.checkOutType || 'Manual',
      'Check-in Time': item.record?.checkInTime ? format(item.record.checkInTime.toDate(), 'HH:mm') : '—',
      'Check-out Time': item.record?.checkOutTime ? format(item.record.checkOutTime.toDate(), 'HH:mm') : (item.status === 'ongoing' ? 'Active' : '—'),
      'Duration': item.record?.checkInTime && item.record?.checkOutTime ? 
        `${Math.floor(differenceInMinutes(item.record.checkOutTime.toDate(), item.record.checkInTime.toDate()) / 60)}h ${differenceInMinutes(item.record.checkOutTime.toDate(), item.record.checkInTime.toDate()) % 60}m` : '—'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance Summary");
    XLSX.writeFile(wb, `Attendance_Summary_${selectedDate}.xlsx`);
    setIsExporting(false);
  };

  if (isProfileLoading || isUsersLoading || isAttendanceLoading || isUserLoading) {
    return (
      <div className="space-y-8 p-4">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            <h1>Daily Attendance Summary</h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium">Cross-organizational overview of personnel presence.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Select Date</Label>
            <Input 
              type="date" 
              className="h-10 rounded-sm font-bold border-primary/20 w-[160px]" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <Button onClick={handleExport} variant="outline" className="h-10 rounded-sm font-bold border-primary text-primary hover:bg-primary/5 shadow-sm px-6">
            <FileDown className="h-4 w-4 mr-2" />
            Export to Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/10 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Total Staff</CardTitle>
            <User className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/10 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Present</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">{stats.present}</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-blue-500/10 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">In Session</CardTitle>
            <Timer className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{stats.ongoing}</div>
          </CardContent>
        </Card>
        <Card className="bg-red-500/5 border-red-500/10 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Absent</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{stats.absent}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-sm border-primary/10 shadow-lg overflow-hidden">
        <CardHeader className="bg-muted/5 border-b py-4">
          <div className="flex flex-col gap-4">
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              Presence Log for {format(parseISO(selectedDate), 'dd MMMM yyyy')}
            </CardTitle>
            
            <div className="flex flex-col md:flex-row md:items-end gap-4">
              <div className="relative flex-1">
                <Label className="text-[9px] font-black uppercase text-muted-foreground mb-1 block">Search Personnel</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Name or email..." 
                    className="pl-8 h-9 rounded-sm border-primary/20 text-xs" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                  />
                </div>
              </div>

              <div className="w-full md:w-48">
                <Label className="text-[9px] font-black uppercase text-muted-foreground mb-1 block">Filter By Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 rounded-sm border-primary/20 text-xs font-bold uppercase tracking-tight">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs font-bold uppercase">All Status</SelectItem>
                    <SelectItem value="absent" className="text-xs font-bold uppercase text-red-600">Absent</SelectItem>
                    <SelectItem value="ongoing" className="text-xs font-bold uppercase text-blue-600">In Session</SelectItem>
                    <SelectItem value="completed" className="text-xs font-bold uppercase text-emerald-600">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full md:w-48">
                <Label className="text-[9px] font-black uppercase text-muted-foreground mb-1 block">Filter By Department</Label>
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="h-9 rounded-sm border-primary/20 text-xs font-bold uppercase tracking-tight">
                    <SelectValue placeholder="All Depts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs font-bold uppercase">All Depts</SelectItem>
                    {allDepts?.map(dept => (
                      <SelectItem key={dept.name} value={dept.name} className="text-xs font-bold uppercase">{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full md:w-48">
                <Label className="text-[9px] font-black uppercase text-muted-foreground mb-1 block">Filter By Role</Label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="h-9 rounded-sm border-primary/20 text-xs font-bold uppercase tracking-tight">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs font-bold uppercase">All Roles</SelectItem>
                    <SelectItem value="Site Manager" className="text-xs font-bold uppercase">Site Manager</SelectItem>
                    <SelectItem value="Site Engineer" className="text-xs font-bold uppercase">Site Engineer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters} 
                className="h-9 px-3 text-muted-foreground hover:text-primary rounded-sm font-bold text-[10px] uppercase tracking-widest"
              >
                <FilterX className="h-3.5 w-3.5 mr-1.5" /> Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead 
                  className="px-6 min-w-[200px] cursor-pointer hover:bg-muted/5 transition-colors"
                  onClick={() => handleSort('personnel')}
                >
                  <div className="flex items-center">
                    Personnel <SortIcon column="personnel" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/5 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status <SortIcon column="status" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/5 transition-colors"
                  onClick={() => handleSort('checkIn')}
                >
                  <div className="flex items-center">
                    Check-in <SortIcon column="checkIn" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/5 transition-colors"
                  onClick={() => handleSort('checkOut')}
                >
                  <div className="flex items-center">
                    Check-out <SortIcon column="checkOut" />
                  </div>
                </TableHead>
                <TableHead className="text-right px-6">Verification Stamps</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaryData.length > 0 ? summaryData.map((item) => (
                <TableRow key={item.user.id} className="hover:bg-muted/5 transition-colors">
                  <TableCell className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-foreground">{item.user.username}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tight">{item.user.role}</span>
                        {item.user.department && (
                          <Badge variant="outline" className="h-3.5 px-1 text-[7px] border-primary/10 text-primary/60 font-bold uppercase">{item.user.department}</Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "text-[9px] font-black uppercase rounded-sm px-2 h-5",
                      item.status === 'absent' ? "bg-red-50 text-red-700 border-red-200" :
                      item.status === 'ongoing' ? "bg-blue-50 text-blue-700 border-blue-200" :
                      "bg-emerald-50 text-emerald-700 border-emerald-200"
                    )}>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-xs font-mono font-bold">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {item.record?.checkInTime ? format(item.record.checkInTime.toDate(), 'HH:mm') : '—'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-xs font-mono font-bold">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {item.record?.checkOutTime ? format(item.record.checkOutTime.toDate(), 'HH:mm') : (item.status === 'ongoing' ? 'Active' : '—')}
                      {item.record?.checkOutType === 'System CheckOut' && (
                        <Badge variant="outline" className="bg-red-50 text-red-600 border-red-100 text-[7px] h-3.5 px-1 font-black uppercase">System</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right px-6">
                    <div className="flex justify-end gap-2">
                      {item.record?.checkInLat && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm text-primary" asChild title="Check-in Location">
                          <a href={`https://www.google.com/maps/search/?api=1&query=${item.record.checkInLat},${item.record.checkInLng}`} target="_blank" rel="noopener noreferrer">
                            <MapPin className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      {item.record?.checkOutLat && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm text-slate-500" asChild title="Check-out Location">
                          <a href={`https://www.google.com/maps/search/?api=1&query=${item.record.checkOutLat},${item.record.checkOutLng}`} target="_blank" rel="noopener noreferrer">
                            <MapPin className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                    No personnel records found matching current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
