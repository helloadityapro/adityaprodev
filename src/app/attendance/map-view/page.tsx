
'use client';

import * as React from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Navigation, Loader2, AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Badge } from '@/components/ui/badge';
import { isSuperAdmin } from '@/lib/auth-constants';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

// Dynamically import the Map component to avoid SSR errors
const MapViewComponent = dynamic(() => import('@/components/attendance-map-view'), { 
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-muted/20 animate-pulse rounded-sm flex flex-col items-center justify-center gap-4 min-h-[500px]">
      <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Initializing Map Engine...</p>
    </div>
  )
});

export default function AttendanceMapPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin' || userProfile?.role === 'Site Manager' || userProfile?.role === 'Manager - Human Resources';

  const activeAttendanceQuery = useMemoFirebase(() => {
    return query(
      collection(firestore, 'attendance'),
      where('status', '==', 'ongoing')
    );
  }, [firestore]);

  const { data: activeUsers, isLoading: isAttendanceLoading } = useCollection<any>(activeAttendanceQuery);

  if (isProfileLoading || isAttendanceLoading) {
    return (
      <div className="space-y-6 h-[calc(100vh-12rem)]">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-full w-full rounded-sm" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive opacity-50" />
        <h2 className="text-xl font-bold uppercase">Restricted Access</h2>
        <p className="text-muted-foreground max-w-xs mx-auto italic font-medium leading-relaxed">
          The Personnel Live Map is a management-level visualization tool. Individual accounts are restricted to history and logging views only.
        </p>
        <Button onClick={() => router.push('/attendance')} variant="outline" className="rounded-sm font-bold border-primary text-primary">Return to Attendance Hub</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col min-h-[calc(100vh-10rem)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Navigation className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-black uppercase tracking-tight">Personnel Live Map</h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium">Real-time GPS visibility for all checked-in site personnel.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 h-9 px-4 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-sm">
            <div className="h-1.5 w-1.5 rounded-full bg-primary mr-2 animate-pulse" />
            {activeUsers?.length || 0} Active Sessions
          </Badge>
        </div>
      </div>

      <Card className="flex-1 rounded-sm border-primary/10 shadow-xl overflow-hidden min-h-[500px]">
        <CardContent className="p-0 h-full relative">
          <MapViewComponent records={activeUsers || []} />
        </CardContent>
      </Card>
    </div>
  );
}
