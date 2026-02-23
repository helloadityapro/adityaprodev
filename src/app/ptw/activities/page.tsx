
'use client';

import * as React from "react";
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase";
import { collection, doc, query, where } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, Clock, User, MapPin, FileText, ArrowRight, Eye } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
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

  const { data: userProfile } = useDoc(useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]));
  
  const isAdmin = userProfile?.role === "Admin" || 
                  user?.email === 'abhijeet.agepl@gmail.com' || 
                  user?.email === 'abhijeetsb22@gmail.com' ||
                  user?.email === 'khalil@adityagreenenergy.com' ||
                  user?.email === 'prafulrana143@gmail.com';
  
  const userRole = isAdmin ? "Admin" : (userProfile?.role || "Site Engineer");

  const permitsQuery = useMemoFirebase(() => collection(firestore, 'permits_to_work'), [firestore]);
  const { data: allPermits, isLoading } = useCollection<Permit>(permitsQuery);

  const activities = React.useMemo(() => {
    if (!allPermits || !userRole || !user) return [];

    // Filter permits based on role
    const visiblePermits = allPermits.filter(p => {
      if (userRole === 'Admin') return true;
      if (userRole === 'Site Manager') {
        return p.siteManagerId === user.uid || p.siteEngineerId === user.uid;
      }
      return p.siteEngineerId === user.uid;
    });

    // Flatten timeline entries
    const flattened: any[] = [];
    visiblePermits.forEach(permit => {
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

    // Sort by timestamp descending
    return flattened.sort((a, b) => {
      const dateA = a.timestamp?.toDate?.()?.getTime() || (typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() : 0);
      const dateB = b.timestamp?.toDate?.()?.getTime() || (typeof b.timestamp === 'string' ? new Date(b.timestamp).getTime() : 0);
      return dateB - dateA;
    });
  }, [allPermits, userRole, user]);

  if (isLoading) {
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
        <h1 className="text-3xl font-bold tracking-tight">PtW Activities</h1>
        <p className="text-muted-foreground">Historical log of all permit-related actions and status changes.</p>
      </div>

      <Card className="rounded-sm overflow-hidden">
        <CardContent className="p-0">
          {activities.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Permit ID</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead className="max-w-[200px]">Remarks</TableHead>
                  <TableHead className="text-right">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity, index) => (
                  <TableRow key={`${activity.permitId}-${index}`} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="text-xs font-medium whitespace-nowrap">
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
                    <TableCell className="text-xs max-w-[150px] truncate">
                      {activity.siteName}
                    </TableCell>
                    <TableCell className="text-xs italic text-muted-foreground max-w-[200px] truncate">
                      {activity.remarks || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm" asChild title="View Details">
                        <Link href={`/ptw/list?view=${activity.permitId}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <History className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold">No Activity Found</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                There are no recorded permit activities to display at this time.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
