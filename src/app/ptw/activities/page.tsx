
"use client";

import * as React from "react";
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase";
import { collection, doc, query, where, or } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, Clock, User, MapPin, FileText, ArrowRight, Eye, Search, Calendar, FilterX, FileCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays, subMonths, subYears } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { isSuperAdmin } from "@/lib/auth-constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TimelineEntry = {
  status: string;
  timestamp: any;
  userId: string;
  userName: string;
  remarks: string;
  action: string;
  submissionIndex?: number;
};

type Permit = {
  id: string;
  serialNumber?: string;
  siteName: string;
  ptwType: string;
  siteEngineerId: string;
  siteManagerId?: string;
  timeline?: TimelineEntry[];
};

const formatTimestamp = (ts: any) => {
  if (!ts) return 'N/A';
  const date = ts.toDate ? ts.toDate() : (typeof ts === 'string' ? new Date(ts) : ts);
  return format(date, 'dd MMM yyyy HH:mm');
};

export default function PtwActivitiesPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [dateFilter, setDateFilter] = React.useState<string>("7days");
  const [customStart, setCustomStart] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === "Admin";
  const userRole = isAdmin ? "Admin" : (userProfile?.role || "Site Engineer");

  const permitsQuery = useMemoFirebase(() => {
    if (!userRole || !user || isProfileLoading) return null;
    const colRef = collection(firestore, 'permits_to_work');
    if (userRole === 'Admin') return colRef;
    if (userRole === 'Site Manager') {
      return query(colRef, or(where('siteManagerId', '==', user.uid), where('siteEngineerId', '==', user.uid)));
    }
    return query(colRef, where('siteEngineerId', '==', user.uid));
  }, [firestore, userRole, user, isProfileLoading]);

  const { data: allPermits, isLoading } = useCollection<Permit>(permitsQuery);

  const queryDateRange = React.useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    
    switch (dateFilter) {
      case 'today':
        return { start: todayStr, end: todayStr };
      case 'yesterday':
        const yesterday = format(subDays(today, 1), 'yyyy-MM-dd');
        return { start: yesterday, end: yesterday };
      case '7days':
        return { start: format(subDays(today, 7), 'yyyy-MM-dd'), end: todayStr };
      case 'lastMonth':
        return { start: format(subMonths(today, 1), 'yyyy-MM-dd'), end: todayStr };
      case 'lastYear':
        return { start: format(subYears(today, 1), 'yyyy-MM-dd'), end: todayStr };
      case 'allTime':
        return { start: '1970-01-01', end: '2099-12-31' };
      case 'custom':
        return { start: customStart, end: customEnd };
      default:
        return { start: format(subDays(today, 7), 'yyyy-MM-dd'), end: todayStr };
    }
  }, [dateFilter, customStart, customEnd]);

  const filteredActivities = React.useMemo(() => {
    if (!allPermits) return [];

    const { start, end } = queryDateRange;

    // Flatten timeline entries
    const flattened: any[] = [];
    allPermits.forEach(permit => {
      if (permit.timeline) {
        permit.timeline.forEach(entry => {
          flattened.push({
            ...entry,
            permitId: permit.id,
            serialNumber: permit.serialNumber || permit.id.slice(0, 8),
            siteName: permit.siteName,
            ptwType: permit.ptwType
          });
        });
      }
    });

    // Filtering logic
    const filtered = flattened.filter(activity => {
      const activityDate = activity.timestamp?.toDate?.() || new Date(activity.timestamp);
      const activityDateStr = format(activityDate, 'yyyy-MM-dd');
      
      const matchesSearch = 
        activity.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (activity.remarks || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.action.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDate = activityDateStr >= start && activityDateStr <= end;

      return matchesSearch && matchesDate;
    });

    // Sort by timestamp descending
    return filtered.sort((a, b) => {
      const dateA = a.timestamp?.toDate?.()?.getTime() || (typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() : 0);
      const dateB = b.timestamp?.toDate?.()?.getTime() || (typeof b.timestamp === 'string' ? new Date(b.timestamp).getTime() : 0);
      return dateB - dateA;
    });
  }, [allPermits, searchTerm, queryDateRange]);

  const clearFilters = () => {
    setSearchTerm("");
    setDateFilter("7days");
  };

  if (isLoading || isProfileLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1>PtW Activities</h1>
        <p className="text-muted-foreground text-sm font-medium">Historical log of all permit-related actions and status changes.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4 items-end bg-card p-3 md:p-4 border border-primary/10 rounded-sm shadow-sm no-print">
        <div className="md:col-span-2 space-y-1">
          <Label className="text-[9px] md:text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Search Activities</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
            <Input 
              placeholder="Search serial, site or user..." 
              className="pl-8 h-9 md:h-10 rounded-sm border-primary/20 text-xs md:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="space-y-1">
          <Label className="text-[9px] md:text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Time Range</Label>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="h-9 md:h-10 rounded-sm border-primary/20 bg-background font-bold text-xs uppercase">
              <Calendar className="h-3.5 w-3.5 mr-2 opacity-50" />
              <SelectValue placeholder="Select Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today" className="text-xs font-bold uppercase">Today</SelectItem>
              <SelectItem value="yesterday" className="text-xs font-bold uppercase">Yesterday</SelectItem>
              <SelectItem value="7days" className="text-xs font-bold uppercase">Last 7 Days</SelectItem>
              <SelectItem value="lastMonth" className="text-xs font-bold uppercase">Last Month</SelectItem>
              <SelectItem value="lastYear" className="text-xs font-bold uppercase">Last Year</SelectItem>
              <SelectItem value="allTime" className="text-xs font-bold uppercase">All Time</SelectItem>
              <SelectItem value="custom" className="text-xs font-bold uppercase text-primary">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end gap-2">
          {dateFilter === 'custom' ? (
            <div className="flex-1 flex gap-2 animate-in fade-in zoom-in-95">
              <div className="flex-1 space-y-1">
                <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-9 md:h-10 rounded-sm border-primary/20 text-[10px] md:text-sm" />
              </div>
              <div className="flex-1 space-y-1">
                <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-9 md:h-10 rounded-sm border-primary/20 text-[10px] md:text-sm" />
              </div>
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10 rounded-sm text-muted-foreground" onClick={clearFilters} title="Clear Filters">
            <FilterX className="h-3.5 w-3.5 md:h-4 md:w-4" />
          </Button>
        </div>
      </div>

      <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md">
        <CardContent className="p-0">
          {filteredActivities.length > 0 ? (
            <>
              {/* Mobile Card List View */}
              <div className="md:hidden divide-y divide-border/50">
                {filteredActivities.map((activity, index) => (
                  <div key={`${activity.permitId}-${index}`} className="p-4 space-y-3 bg-card hover:bg-muted/5 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">
                          {formatTimestamp(activity.timestamp)}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[8px] font-black uppercase rounded-sm border-primary/20 bg-primary/5 text-primary whitespace-nowrap">
                            {activity.action}
                          </Badge>
                          <Link 
                            href={`/ptw/list?view=${activity.permitId}`}
                            className="font-mono text-[10px] font-bold text-primary hover:underline truncate"
                          >
                            {activity.serialNumber}
                          </Link>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm -mr-2 shrink-0" asChild>
                        <Link href={`/ptw/list?view=${activity.permitId}`}>
                          <Eye className="h-4 w-4 text-primary" />
                        </Link>
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-bold text-sm text-foreground leading-tight line-clamp-2">{activity.siteName}</h3>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                        <User className="h-3 w-3 text-primary" />
                        <span>{activity.userName}</span>
                      </div>
                    </div>

                    {activity.remarks && (
                      <p className="text-xs italic text-muted-foreground leading-relaxed bg-muted/30 p-2 rounded-sm border border-primary/5">
                        "{activity.remarks}"
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="px-6 font-black uppercase text-[10px] tracking-widest">Date & Time</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest">User</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest">Action</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest">Permit ID</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest">Site</TableHead>
                      <TableHead className="max-w-[200px] font-black uppercase text-[10px] tracking-widest">Remarks</TableHead>
                      <TableHead className="text-right px-6 font-black uppercase text-[10px] tracking-widest">View</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredActivities.map((activity, index) => (
                      <TableRow key={`${activity.permitId}-${index}`} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="px-6 text-xs font-medium whitespace-nowrap">
                          {formatTimestamp(activity.timestamp)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-semibold text-sm">{activity.userName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-bold uppercase rounded-sm border-primary/20 bg-primary/5 text-primary whitespace-nowrap">
                            {activity.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Link 
                            href={`/ptw/list?view=${activity.permitId}`}
                            className="font-mono text-xs text-primary hover:underline"
                          >
                            {activity.serialNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate font-medium">
                          {activity.siteName}
                        </TableCell>
                        <TableCell className="text-xs italic text-muted-foreground max-w-[200px] truncate">
                          {activity.remarks || "—"}
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm" asChild title="View Details">
                            <Link href={`/ptw/list?view=${activity.permitId}`}>
                              <Eye className="h-4 w-4 text-primary" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <History className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold">No Activity Found</h3>
              <p className="text-muted-foreground max-sm mx-auto">
                No activities recorded for the selected time range.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
