
'use client';

import * as React from "react";
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase";
import { collection, doc, query, where } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, Clock, User, MapPin, FileText, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";

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
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">PtW Activities</h1>
        <p className="text-muted-foreground">Historical log of all permit-related actions and status changes.</p>
      </div>

      <div className="space-y-4">
        {activities.length > 0 ? (
          activities.map((activity, index) => (
            <Card key={`${activity.permitId}-${index}`} className="rounded-sm border-l-4 border-l-primary hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-bold uppercase rounded-sm border-primary/20 bg-primary/5 text-primary">
                        {activity.action}
                      </Badge>
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(activity.timestamp)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-bold">{activity.userName}</span>
                      <span className="text-muted-foreground">performed action on</span>
                      <Link 
                        href={`/ptw/list?view=${activity.permitId}`}
                        className="font-mono text-primary hover:underline flex items-center gap-1"
                      >
                        {activity.serialNumber}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {activity.siteName}
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {activity.ptwType}
                      </div>
                    </div>

                    {activity.remarks && (
                      <div className="mt-3 p-3 bg-muted/30 rounded-sm border italic text-sm text-foreground/80">
                        "{activity.remarks}"
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed rounded-lg bg-muted/10">
            <History className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold">No Activity Found</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              There are no recorded permit activities to display at this time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
