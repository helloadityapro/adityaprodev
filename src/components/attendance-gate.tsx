'use client';

import * as React from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc, limit, Timestamp } from 'firebase/firestore';
import { format, isAfter, setHours, setMinutes, parseISO, endOfDay } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useRouter, usePathname } from 'next/navigation';
import { Clock, LogIn } from 'lucide-react';

/**
 * Global component to manage attendance compliance.
 * Handles:
 * 1. Forced check-in redirect if no session exists for today.
 * 2. Check-out reminders after 7:00 PM.
 * 3. Daily 12 AM system reset for stale sessions (Marked as System CheckOut).
 * 4. Sequencing with Birthday Celebration popup.
 */
export function AttendanceGate() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  
  const [showCheckIn, setShowCheckIn] = React.useState(false);
  const [showCheckOut, setShowCheckOut] = React.useState(false);
  const [currentDate, setCurrentDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [isWaitingForBirthday, setIsWaitingForBirthday] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  // Periodic check for date rollover (every 1 minute)
  React.useEffect(() => {
    const interval = setInterval(() => {
      const nowStr = format(new Date(), 'yyyy-MM-dd');
      if (nowStr !== currentDate) {
        setCurrentDate(nowStr);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [currentDate]);

  // Handle birthday sequencing
  React.useEffect(() => {
    if (isProfileLoading || !profile?.dob || !user) return;

    const today = new Date();
    const birthDate = new Date(profile.dob);
    const isBirthday = today.getMonth() === birthDate.getMonth() && today.getDate() === birthDate.getDate();
    const storageKey = `birthday_shown_${user.uid}_${today.getFullYear()}`;
    const hasBeenShown = localStorage.getItem(storageKey);

    if (isBirthday && !hasBeenShown) {
      setIsWaitingForBirthday(true);
    } else {
      setIsWaitingForBirthday(false);
    }
  }, [profile, isProfileLoading, user, currentDate]);

  // Listen for birthday popup completion
  React.useEffect(() => {
    const handleBirthdayFinished = () => {
      setIsWaitingForBirthday(false);
    };
    window.addEventListener('birthday-celebration-finished', handleBirthdayFinished);
    return () => window.removeEventListener('birthday-celebration-finished', handleBirthdayFinished);
  }, []);

  // Today's date reference
  const todayStr = currentDate;

  // Query for ANY ongoing session for this user
  const activeQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'attendance'),
      where('userId', '==', user.uid),
      where('status', '==', 'ongoing'),
      limit(1)
    );
  }, [user, firestore]);

  const { data: activeSessions, isLoading: isActiveLoading } = useCollection(activeQuery);

  // Query to check if user has already completed a session today
  const todayFinishedQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'attendance'),
      where('userId', '==', user.uid),
      where('date', '==', todayStr),
      where('status', '==', 'completed'),
      limit(1)
    );
  }, [user, firestore, todayStr]);

  const { data: todayFinished, isLoading: isFinishedLoading } = useCollection(todayFinishedQuery);

  React.useEffect(() => {
    if (isActiveLoading || isFinishedLoading || !user || isWaitingForBirthday) return;

    // Do not show prompts if already on attendance pages
    if (pathname.startsWith('/attendance')) return;

    const now = new Date();
    // Threshold set to 7 PM (19:00)
    const sevenPm = setMinutes(setHours(new Date(), 19), 0);
    const isAfterSeven = isAfter(now, sevenPm);

    const activeSession = activeSessions?.[0];
    const hasCompletedToday = todayFinished && todayFinished.length > 0;

    // 1. CYCLE RESET (Stale Session Cleanup)
    // If we find an "ongoing" session where the date is NOT today, it means it's a leftover.
    if (activeSession && activeSession.date !== todayStr) {
      const ref = doc(firestore, 'attendance', activeSession.id);
      
      try {
        const sessionDate = parseISO(activeSession.date);
        const dayEnd = endOfDay(sessionDate);

        updateDocumentNonBlocking(ref, {
          status: 'completed',
          checkOutTime: Timestamp.fromDate(dayEnd),
          checkOutLat: activeSession.checkInLat || 0, 
          checkOutLng: activeSession.checkInLng || 0,
          checkOutType: 'System CheckOut',
          remarks: 'System CheckOut: Session automatically closed at end of workday.'
        });
      } catch (e) {
        console.error("Auto-checkout failed", e);
      }
      return;
    }

    // 2. CHECK-IN GATE
    // Prompt if not checked in at all today AND it's before 7 PM
    if (!activeSession && !hasCompletedToday && !isAfterSeven) {
      setShowCheckIn(true);
    }

    // 3. CHECK-OUT PROMPT
    // Prompt if session is ongoing AND it's after 7 PM
    if (activeSession && activeSession.date === todayStr && isAfterSeven) {
      setShowCheckOut(true);
    }
  }, [activeSessions, todayFinished, isActiveLoading, isFinishedLoading, user, todayStr, pathname, firestore, isWaitingForBirthday]);

  return (
    <>
      {/* Check-in Gateway */}
      <Dialog open={showCheckIn} onOpenChange={setShowCheckIn}>
        <DialogContent className="sm:max-w-md rounded-sm border-primary/20 shadow-2xl">
          <DialogHeader className="pt-4">
            <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
              <LogIn className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle className="text-center text-2xl font-black uppercase tracking-tight">Workday Check-in</DialogTitle>
            <DialogDescription className="text-center text-base leading-relaxed">
              Your session has started. Please complete your mandatory <strong>GPS & Profile verification</strong> to continue with site operations.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center pb-4">
            <Button onClick={() => { setShowCheckIn(false); router.push('/attendance/check-in'); }} className="w-full h-14 text-lg font-black rounded-sm shadow-xl">
              Proceed to Check-in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End-of-Day Gateway */}
      <Dialog open={showCheckOut} onOpenChange={setShowCheckOut}>
        <DialogContent className="sm:max-w-md rounded-sm border-amber-200 shadow-2xl bg-amber-50/50">
          <DialogHeader className="pt-4">
            <div className="mx-auto bg-amber-500/10 p-4 rounded-full w-fit mb-4">
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
            <DialogTitle className="text-center text-2xl font-black uppercase tracking-tight text-amber-900">Pending Check-out</DialogTitle>
            <DialogDescription className="text-center text-base leading-relaxed text-amber-800">
              It is past <strong>7:00 PM</strong>. Organizational policy requires a final site verification before concluding your workday.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center pb-4">
            <Button onClick={() => { setShowCheckOut(false); router.push('/attendance/check-out'); }} className="w-full h-14 text-lg font-black rounded-sm shadow-xl bg-slate-900 hover:bg-black">
              Check-out Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
