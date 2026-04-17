'use client';

import * as React from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc, limit, Timestamp, arrayUnion, getDoc } from 'firebase/firestore';
import { format, isAfter, setHours, setMinutes, parseISO, endOfDay, isBefore } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useRouter, usePathname } from 'next/navigation';
import { Clock, LogIn } from 'lucide-react';

/**
 * Global component to manage attendance compliance and background tracking.
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
      
      if (now.getHours() === 23 && now.getMinutes() === 59 && now.getSeconds() >= 45) {
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

  /**
   * BACKGROUND TRACKING LOGIC
   * Captures location every 10 minutes during an active session.
   */
  React.useEffect(() => {
    if (!user || !activeSessions || activeSessions.length === 0) return;
    const session = activeSessions[0];
    if (session.date !== todayStr) return;

    const trackLocation = () => {
      if (!navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        const sessionRef = doc(firestore, 'attendance', session.id);

        // Fetch fresh data to check if we've moved significantly
        const snap = await getDoc(sessionRef);
        const data = snap.data();
        const lastPoints = data?.trackingPoints || [];
        const lastPoint = lastPoints[lastPoints.length - 1];

        const hasMoved = !lastPoint || 
          Math.abs(lastPoint.lat - lat) > 0.0001 || 
          Math.abs(lastPoint.lng - lng) > 0.0001;

        if (hasMoved) {
          updateDocumentNonBlocking(sessionRef, {
            trackingPoints: arrayUnion({
              lat,
              lng,
              timestamp: new Date().toISOString()
            }),
            lastUpdated: serverTimestamp()
          });
        }
      }, (err) => console.warn("Background tracking error:", err), {
        enableHighAccuracy: true,
        timeout: 15000
      });
    };

    // Initial track and then every 10 mins
    trackLocation();
    const interval = setInterval(trackLocation, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, activeSessions, todayStr, firestore]);

  React.useEffect(() => {
    if (isActiveLoading || isFinishedLoading || !user || isWaitingForCelebration) return;
    if (pathname.startsWith('/attendance')) return;

    const now = new Date();
    const activeSession = activeSessions?.[0];
    const hasCompletedToday = todayFinished && todayFinished.length > 0;

    if (activeSession && activeSession.date !== todayStr) {
      const ref = doc(firestore, 'attendance', activeSession.id);
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
      return;
    }

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

    const isLateNight = now.getHours() >= 19;
    if (!activeSession && !hasCompletedToday && !isLateNight) {
      setShowCheckIn(true);
    }

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
