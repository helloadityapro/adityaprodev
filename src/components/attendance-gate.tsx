'use client';

import * as React from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc, limit, Timestamp } from 'firebase/firestore';
import { format, isAfter, setHours, setMinutes, parseISO, endOfDay, isBefore } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useRouter, usePathname } from 'next/navigation';
import { Clock, LogIn } from 'lucide-react';

/**
 * Global component to manage attendance compliance.
 */
export function AttendanceGate() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  
  const [showCheckIn, setShowCheckIn] = React.useState(false);
  const [showCheckOut, setShowCheckOut] = React.useState(false);
  const [currentDate, setCurrentDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [isWaitingForCelebration, setIsWaitingForCelebration] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  // Periodic check for date rollover (every 30 seconds)
  React.useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const nowStr = format(now, 'yyyy-MM-dd');
      
      // Handle mid-day to end-of-day transition (23:59 check)
      if (now.getHours() === 23 && now.getMinutes() === 59 && now.getSeconds() >= 45) {
        // Trigger a force sync for active sessions at the absolute end of day
        window.dispatchEvent(new Event('end-of-day-sync'));
      }

      if (nowStr !== currentDate) {
        setCurrentDate(nowStr);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [currentDate]);

  // Handle celebration sequencing
  React.useEffect(() => {
    if (isProfileLoading || !user) return;

    const today = new Date();
    
    let birthdayWaiting = false;
    if (profile?.dob) {
      const birthDate = new Date(profile.dob);
      const isBirthday = today.getMonth() === birthDate.getMonth() && today.getDate() === birthDate.getDate();
      const bStorageKey = `birthday_shown_${user.uid}_${today.getFullYear()}`;
      if (isBirthday && !localStorage.getItem(bStorageKey)) birthdayWaiting = true;
    }

    let anniversaryWaiting = false;
    if (profile?.doj) {
      const joinDate = new Date(profile.doj);
      const isAnniversary = today.getMonth() === joinDate.getMonth() && today.getDate() === joinDate.getDate();
      const years = today.getFullYear() - joinDate.getFullYear();
      const aStorageKey = `anniversary_shown_${user.uid}_${today.getFullYear()}`;
      if (isAnniversary && years > 0 && !localStorage.getItem(aStorageKey)) anniversaryWaiting = true;
    }

    setIsWaitingForCelebration(birthdayWaiting || anniversaryWaiting);
  }, [profile, isProfileLoading, user, currentDate]);

  React.useEffect(() => {
    const handleFinished = () => setIsWaitingForCelebration(false);
    window.addEventListener('birthday-celebration-finished', handleFinished);
    window.addEventListener('anniversary-celebration-finished', handleFinished);
    return () => {
      window.removeEventListener('birthday-celebration-finished', handleFinished);
      window.removeEventListener('anniversary-celebration-finished', handleFinished);
    };
  }, []);

  const todayStr = currentDate;

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
    if (isActiveLoading || isFinishedLoading || !user || isWaitingForCelebration) return;
    if (pathname.startsWith('/attendance')) return;

    const now = new Date();
    const activeSession = activeSessions?.[0];
    const hasCompletedToday = todayFinished && todayFinished.length > 0;

    // 1. CYCLE RESET (Force end stale sessions immediately)
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
          remarks: 'System CheckOut: Automatic cycle reset at start of new day.'
        });
      } catch (e) {
        console.error("Auto-checkout failed", e);
      }
      return;
    }

    // 2. END-OF-DAY AUTO CLOSE (If session is still open at 23:59)
    if (activeSession && activeSession.date === todayStr) {
      const isEndOfDay = now.getHours() === 23 && now.getMinutes() >= 59;
      if (isEndOfDay) {
        const ref = doc(firestore, 'attendance', activeSession.id);
        updateDocumentNonBlocking(ref, {
          status: 'completed',
          checkOutTime: serverTimestamp(),
          checkOutLat: activeSession.checkInLat || 0,
          checkOutLng: activeSession.checkInLng || 0,
          checkOutType: 'System CheckOut',
          remarks: 'System CheckOut: Automatically closed at end of day.'
        });
        return;
      }
    }

    // 3. CHECK-IN GATE
    const isLateNight = now.getHours() >= 19; // No check-in prompt after 7 PM for today
    if (!activeSession && !hasCompletedToday && !isLateNight) {
      setShowCheckIn(true);
    }

    // 4. CHECK-OUT PROMPT (Gentle reminder after 7 PM)
    if (activeSession && activeSession.date === todayStr && now.getHours() >= 19) {
      setShowCheckOut(true);
    }
  }, [activeSessions, todayFinished, isActiveLoading, isFinishedLoading, user, todayStr, pathname, firestore, isWaitingForCelebration]);

  return (
    <>
      <Dialog open={showCheckIn} onOpenChange={setShowCheckIn}>
        <DialogContent className="sm:max-w-md rounded-sm border-primary/20 shadow-2xl">
          <DialogHeader className="pt-4 text-center">
            <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
              <LogIn className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Check-in Reminder!</DialogTitle>
            <DialogDescription className="text-base leading-relaxed">
              Please capture verification to start your workday.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center pb-4">
            <Button onClick={() => { setShowCheckIn(false); router.push('/attendance/check-in'); }} className="w-full h-14 text-lg font-black rounded-sm">
              Proceed to Check-in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCheckOut} onOpenChange={setShowCheckOut}>
        <DialogContent className="sm:max-w-md rounded-sm border-amber-200 shadow-2xl bg-amber-50/50">
          <DialogHeader className="pt-4 text-center text-amber-900">
            <div className="mx-auto bg-amber-500/10 p-4 rounded-full w-fit mb-4">
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Check-Out Reminder!</DialogTitle>
            <DialogDescription className="text-base leading-relaxed text-amber-800">
              Your session is still active. Please capture final verification to conclude your workday.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center pb-4">
            <Button onClick={() => { setShowCheckOut(false); router.push('/attendance/check-out'); }} className="w-full h-14 text-lg font-black rounded-sm bg-slate-900">
              Proceed to Check-Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function serverTimestamp() {
    return Timestamp.now();
}
