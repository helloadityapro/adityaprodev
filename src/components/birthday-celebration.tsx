'use client';

import * as React from 'react';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Cake, PartyPopper, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';

/**
 * Component that displays a celebratory birthday popup if it's the user's birthday.
 * Uses local storage to ensure it only appears once on the actual day.
 * Sequences with the AttendanceGate via a custom event.
 */
export function BirthdayCelebration() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isOpen, setIsOpen] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: profile, isLoading } = useDoc<any>(userProfileRef);

  // Extract only the first name for a more personal greeting
  const firstName = React.useMemo(() => {
    if (!profile?.username) return '';
    return profile.username.trim().split(' ')[0];
  }, [profile?.username]);

  React.useEffect(() => {
    if (isLoading || !profile?.dob || !user) return;

    const checkBirthday = () => {
      const today = new Date();
      const birthDate = new Date(profile.dob);
      
      // Compare month and day
      const isBirthday = 
        today.getMonth() === birthDate.getMonth() && 
        today.getDate() === birthDate.getDate();

      if (isBirthday) {
        const storageKey = `birthday_shown_${user.uid}_${today.getFullYear()}`;
        const hasBeenShown = localStorage.getItem(storageKey);

        if (!hasBeenShown) {
          setIsOpen(true);
          triggerConfetti();
        }
      }
    };

    checkBirthday();
  }, [profile, isLoading, user]);

  const triggerConfetti = () => {
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  const handleClose = () => {
    if (user && profile?.dob) {
      const today = new Date();
      const storageKey = `birthday_shown_${user.uid}_${today.getFullYear()}`;
      localStorage.setItem(storageKey, 'true');
    }
    setIsOpen(false);
    // Dispatch event to notify AttendanceGate that it can now show its popup
    window.dispatchEvent(new Event('birthday-celebration-finished'));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if(!open) handleClose(); }}>
      <DialogContent className="sm:max-w-md rounded-sm border-primary/10 shadow-2xl overflow-hidden bg-background p-0">
        <DialogHeader className="pt-6 pb-2 flex flex-col items-center text-center px-6">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 12 }}
            className="mx-auto bg-amber-500/10 p-3 rounded-full w-fit mb-3 relative"
          >
            <Cake className="h-10 w-10 text-amber-600" />
            <motion.div 
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute -top-1 -right-1"
            >
              <Sparkles className="h-5 w-5 text-primary fill-primary" />
            </motion.div>
          </motion.div>
          
          <DialogTitle className="text-4xl sm:text-5xl text-foreground font-script normal-case py-1 text-center w-full">
            Happy Birthday!
          </DialogTitle>
          <DialogDescription className="text-xl sm:text-2xl font-black text-primary mt-1 text-center uppercase tracking-tight">
            {firstName}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-2 text-center space-y-4">
          <div className="space-y-0.5">
            <p className="text-xs sm:text-sm font-bold leading-relaxed text-muted-foreground italic">You bring the energy.</p>
            <p className="text-xs sm:text-sm font-bold leading-relaxed text-muted-foreground italic">Today, we celebrate YOU.</p>
            <p className="text-xs sm:text-sm font-bold leading-relaxed text-muted-foreground italic">A special day for a special you.</p>
            <p className="text-xs sm:text-sm font-bold leading-relaxed text-muted-foreground italic">Wishing you happiness today and success all year long.</p>
          </div>

          <div className="py-2 border-y border-border/50">
            <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-[0.3em] mb-0.5">Wishes from</p>
            <p className="text-[11px] font-black text-primary uppercase tracking-widest">Team Aditya</p>
            <p className="text-[9px] font-bold text-muted-foreground">Aditya Green Energy Private Limited</p>
          </div>
        </div>

        <DialogFooter className="p-4 pt-2 px-6 pb-6">
          <Button 
            onClick={handleClose} 
            className="w-full h-11 font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20"
          >
            <PartyPopper className="mr-2 h-4 w-4" />
            Thank You
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
