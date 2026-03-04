
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, doc, query, where, limit } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export default function AttendanceBasePage() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const activeAttendanceQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'attendance'),
      where('userId', '==', user.uid),
      where('status', '==', 'ongoing'),
      limit(1)
    );
  }, [firestore, user]);

  const { data: activeAttendance, isLoading: isAttendanceLoading } = useCollection(activeAttendanceQuery);

  useEffect(() => {
    if (!isUserLoading && !isAttendanceLoading && user) {
      if (activeAttendance && activeAttendance.length > 0) {
        router.replace('/attendance/check-out');
      } else {
        router.replace('/attendance/check-in');
      }
    }
  }, [user, isUserLoading, isAttendanceLoading, activeAttendance, router]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Checking Attendance Status...</p>
    </div>
  );
}
