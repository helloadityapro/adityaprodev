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
      <DialogContent className="sm:max-w-md rounded-sm border-primary/10 shadow-2xl overflow-hidden bg-background">
        <DialogHeader className="pt-8 pb-4 flex flex-col items-center text-center sm:text-center">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 12 }}
            className="mx-auto bg-amber-500/10 p-5 rounded-full w-fit mb-6 relative"
          >
            <Cake className="h-12 w-12 text-amber-600" />
            <motion.div 
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute -top-1 -right-1"
            >
              <Sparkles className="h-6 w-6 text-primary fill-primary" />
            </motion.div>
          </motion.div>
          
          <DialogTitle className="text-5xl text-foreground font-script normal-case py-2 text-center w-full">
            Happy Birthday!
          </DialogTitle>
          <DialogDescription className="text-lg font-bold text-primary mt-2 text-center">
            {profile?.username}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 text-center space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium leading-relaxed text-muted-foreground italic">
              "Warmest wishes on your special day! Your hard work and dedication continue to light up our projects."
            </p>
          </div>

          <div className="py-4 border-y border-border/50">
            <p className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.3em] mb-1">Wishes from</p>
            <p className="text-xs font-black text-primary uppercase tracking-widest">Team Aditya</p>
            <p className="text-[10px] font-bold text-muted-foreground mt-0.5">Aditya Green Energy Private Limited</p>
          </div>
        </div>

        <DialogFooter className="p-6 pt-2">
          <Button 
            onClick={handleClose} 
            className="w-full h-12 font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20"
          >
            <PartyPopper className="mr-2 h-4 w-4" />
            Thank You
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
