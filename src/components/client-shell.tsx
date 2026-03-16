'use client';

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser, useDoc, useMemoFirebase, useAuth, setDocumentNonBlocking, useCollection, useFirestore } from "@/firebase";
import { collection, doc, query, where, serverTimestamp, or, and } from "firebase/firestore";
import UserNav from "@/components/user-nav";
import { MainNav } from "@/components/main-nav";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarTrigger,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UserNotifications } from "@/components/user-notifications";
import { GlobalSearch } from "@/components/global-search";
import { AttendanceGate } from "@/components/attendance-gate";
import { BottomNav } from "@/components/bottom-nav";
import { QuickActions } from "@/components/quick-actions";
import { Loader2, Sun, Moon, ShieldAlert, LogOut, UserX, RefreshCw } from "lucide-react";
import { isSuperAdmin } from "@/lib/auth-constants";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const DISPLAYED_NOTIFS_KEY = 'displayedNotifIds';

type Notification = {
  id: string;
  userId: string;
  title: string;
  description: string;
  link: string;
  read: boolean;
  createdAt: any;
};

/**
 * Global top-loading progress indicator.
 * Shown during page transitions to provide visual feedback.
 */
function TopLoadingBar({ isVisible }: { isVisible: boolean }) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="fixed top-0 left-0 right-0 z-[100] h-1 bg-primary origin-left"
        />
      )}
    </AnimatePresence>
  );
}

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background animate-in fade-in duration-300">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-primary animate-ping" />
          </div>
        </div>
        <p className="text-xs font-black text-muted-foreground tracking-[0.3em] uppercase">Aditya Pro</p>
      </div>
    </div>
  );
}

export function ClientShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');
  const [isNavigating, setIsNavigating] = React.useState(false);

  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/forgot-password';

  // Handle route change state for top loader
  React.useEffect(() => {
    setIsNavigating(true);
    const timer = setTimeout(() => setIsNavigating(false), 400);
    return () => clearTimeout(timer);
  }, [pathname]);

  React.useEffect(() => {
    const syncThemeState = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setTheme(isDark ? 'dark' : 'light');
    };

    syncThemeState();
    window.addEventListener('theme-change', syncThemeState);
    return () => window.removeEventListener('theme-change', syncThemeState);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    window.dispatchEvent(new Event('theme-change'));
  };

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === "Admin";

  React.useEffect(() => {
    if (!isUserLoading && !user && !isAuthPage) {
      router.replace('/login');
    }
  }, [isUserLoading, user, isAuthPage, router]);

  React.useEffect(() => {
    if (user && !isProfileLoading) {
      if (!isSuperAdmin(user.email)) return;

      const needsBootstrap = !userProfile || 
                             userProfile.role !== 'Admin' || 
                             userProfile.registrationRequest === true || 
                             (user.email === 'khalil@adityagreenenergy.com' && userProfile.username !== 'Khalil Choudhary') ||
                             (user.email === 'prafulrana143@gmail.com' && userProfile.username !== 'Praful Upadhaye');
      
      if (needsBootstrap) {
        const updateData: any = {
          id: user.uid,
          email: user.email,
          role: 'Admin',
          registrationRequest: false,
          totalPoints: userProfile?.totalPoints ?? 0,
          pointsMultiplier: userProfile?.pointsMultiplier ?? 1,
          updatedAt: serverTimestamp(),
        };

        if (user.email === 'khalil@adityagreenenergy.com') {
          updateData.username = 'Khalil Choudhary';
        } else if (user.email === 'prafulrana143@gmail.com') {
          updateData.username = 'Praful Upadhaye';
        }

        if (!userProfile) {
          updateData.createdAt = serverTimestamp();
          if (!updateData.username) {
            updateData.username = user.displayName || user.email?.split('@')[0] || 'Admin';
          }
          updateData.mobile = user.phoneNumber || 'N/A';
          updateData.assignedProjectIds = [];
          updateData.totalPoints = 0;
          updateData.pointsMultiplier = 1;
        }

        setDocumentNonBlocking(doc(firestore, "users", user.uid), updateData, { merge: true });
      }
    }
  }, [user, userProfile, isProfileLoading, firestore]);

  const userRole = isAdmin ? "Admin" : userProfile?.role || "Site Engineer";
  
  const ptwQueryForBadge = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'permits_to_work');
    
    if (userRole === 'Admin') {
      return query(colRef, where('status', '==', 'Pending'));
    }
    
    if (userRole === 'Site Manager') {
      return query(
        colRef, 
        and(
          where('status', '==', 'Pending'),
          or(where('siteManagerId', '==', user.uid), where('siteEngineerId', '==', user.uid))
        )
      );
    }
    
    return null;
  }, [firestore, userRole, user, isProfileLoading]);
  
  const { data: permitsForBadge } = useCollection(ptwQueryForBadge);

  const pendingPtwCount = React.useMemo(() => permitsForBadge?.length || 0, [permitsForBadge]);

  const notificationsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'notifications'), where('userId', '==', user.uid));
  }, [user, firestore]);
  const { data: unsortedNotifications } = useCollection<Notification>(notificationsQuery);

  const notifications = React.useMemo(() => {
    if (!unsortedNotifications) return null;
    return [...unsortedNotifications].sort((a, b) => {
      const dateA = a.createdAt?.toDate?.().getTime() || 0;
      const dateB = b.createdAt?.toDate?.().getTime() || 0;
      return dateB - dateA;
    });
  }, [unsortedNotifications]);

  const [displayedNotifIds, setDisplayedNotifIds] = React.useState<Set<string>>(new Set());

  // Request native notification permissions
  React.useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      LocalNotifications.requestPermissions();
    }
  }, []);

  // Handle notification click routing
  React.useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const listener = LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        const link = action.notification.extra?.link;
        if (link) {
          router.push(link);
        }
      });
      return () => {
        listener.remove();
      };
    }
  }, [router]);

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DISPLAYED_NOTIFS_KEY);
      if (raw && raw.trim().length > 0) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setDisplayedNotifIds(new Set(parsed));
        }
      }
    } catch (e) {
      console.warn("Failed to parse displayed notifications from session storage", e);
    }
  }, []);

  React.useEffect(() => {
      if (notifications) {
          const newDisplayedIds = new Set(displayedNotifIds);
          let wasUpdated = false;
          notifications.forEach(notif => {
              if (!notif.read && !displayedNotifIds.has(notif.id)) {
                  // Show in-app toast
                  toast({ 
                    title: notif.title, 
                    description: notif.description, 
                    variant: notif.title.includes('Approved') ? 'success' : notif.title.includes('Rejected') ? 'destructive' : 'default' 
                  });

                  // Trigger native system notification if on mobile
                  if (Capacitor.isNativePlatform()) {
                    LocalNotifications.schedule({
                      notifications: [
                        {
                          title: notif.title,
                          body: notif.description,
                          id: parseInt(notif.id.replace(/\D/g, '').slice(-8)) || Math.floor(Math.random() * 1000000),
                          extra: {
                            link: notif.link
                          }
                        }
                      ]
                    });
                  }

                  newDisplayedIds.add(notif.id);
                  wasUpdated = true;
              }
          });
          if (wasUpdated) {
              setDisplayedNotifIds(newDisplayedIds);
              sessionStorage.setItem(DISPLAYED_NOTIFS_KEY, JSON.stringify(Array.from(newDisplayedIds)));
          }
      }
  }, [notifications, toast, displayedNotifIds]);

  if (isAuthPage) return <>{children}</>;

  if (isUserLoading || !user) {
    return <FullPageLoader />;
  }

  if (isProfileLoading) return <FullPageLoader />;

  if (!userProfile && !isSuperAdmin(user.email)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
        <div className="bg-destructive/10 p-6 rounded-full mb-6">
          <UserX className="h-16 w-16 text-destructive opacity-80" />
        </div>
        <h1 className="mb-2">Profile Not Found</h1>
        <p className="mb-8 max-w-md text-muted-foreground text-lg leading-relaxed">
          Your account is authenticated, but your professional profile could not be found in the database.
        </p>
        <div className="flex flex-col gap-3 w-full max-xs">
          <Button onClick={() => router.push('/register')} className="w-full font-black h-12 text-lg shadow-md rounded-sm">
            <RefreshCw className="mr-2 h-5 w-5" /> Restore Profile
          </Button>
          <Button variant="ghost" onClick={() => auth.signOut()} className="w-full flex items-center justify-center gap-2 font-semibold">
            <LogOut className="h-4 w-4" /> Sign Out
          </Button>
        </div>
      </div>
    );
  }

  if (userProfile?.registrationRequest && !isAdmin) {
     return (
      <div className="flex flex-col min-h-screen items-center justify-center text-center gap-6 p-4 bg-muted/30">
        <div className="bg-yellow-500/10 p-6 rounded-full">
          <ShieldAlert className="h-16 w-16 text-yellow-600 opacity-80" />
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight">Authorization Pending</h1>
        <p className="text-muted-foreground max-sm text-lg leading-relaxed">Your account is awaiting administrative approval. You will be notified via email once your profile is verified.</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button variant="outline" onClick={() => auth.signOut()} className="rounded-sm font-bold h-11">Sign Out & Exit</Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider className="h-screen overflow-hidden">
      <TopLoadingBar isVisible={isNavigating} />
      <Sidebar>
        <SidebarHeader className="px-6 py-4 border-b">
          <div className="flex items-baseline gap-0.5">
            <span className="text-lg font-black tracking-tighter text-primary uppercase">Aditya</span>
            <span className="text-xs font-light tracking-[0.3em] text-muted-foreground uppercase ml-1">Pro</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <MainNav userRole={userRole} pendingPtwCount={pendingPtwCount} />
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="flex flex-col h-full overflow-hidden relative">
        <header className="flex flex-col shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-30 sticky top-0 pt-safe">
          <div className="flex h-14 items-center gap-2 px-3 lg:px-6">
            <SidebarTrigger className="h-9 w-9" />
            <div className="flex-1 min-w-0">
              <GlobalSearch />
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <div className="hidden md:flex">
                <QuickActions />
              </div>
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full h-8 w-8">
                {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
              <UserNotifications />
              <UserNav />
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-muted/40">
          <div className="flex flex-col gap-4 p-4 lg:gap-6 lg:p-6 min-h-full pb-36 md:pb-6 relative">
            <AttendanceGate />
            {children}
          </div>
        </div>
        <BottomNav />
      </SidebarInset>
    </SidebarProvider>
  );
}
