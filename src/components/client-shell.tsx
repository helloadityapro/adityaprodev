'use client';

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser, useDoc, useMemoFirebase, useAuth, setDocumentNonBlocking, useCollection, useFirestore } from "@/firebase";
import { collection, doc, query, where, serverTimestamp, or, and, getDocs } from "firebase/firestore";
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
import { BirthdayCelebration } from "@/components/birthday-celebration";
import { BottomNav } from "@/components/bottom-nav";
import { QuickActions } from "@/components/quick-actions";
import { CredentialsPromptDialog } from "@/components/credentials-prompt-dialog";
import { Loader2, Sun, Moon, ShieldAlert, LogOut, UserX, RefreshCw, Lock } from "lucide-react";
import { isSuperAdmin } from "@/lib/auth-constants";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { getPageKeyByPath, type PageKey } from "@/lib/access-control";

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

type AccessConfig = {
  id: string;
  allowedPageKeys: PageKey[];
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
  const [quote, setQuote] = React.useState("");
  const firestore = useFirestore();

  React.useEffect(() => {
    const fetchQuote = async () => {
      const defaultQuotes = [
        "Individual commitment to a group effort—that is what makes a team work.",
        "Unity is strength... when there is teamwork and collaboration, wonderful things can be achieved.",
        "Coming together is a beginning. Keeping together is progress. Working together is success.",
        "Alone we can do so little; together we can do so much."
      ];

      try {
        const snap = await getDocs(collection(firestore, 'quotes'));
        const dbQuotes = snap.docs.map(d => d.data().text);
        const combined = dbQuotes.length > 0 ? dbQuotes : defaultQuotes;
        setQuote(combined[Math.floor(Math.random() * combined.length)]);
      } catch (e) {
        setQuote(defaultQuotes[Math.floor(Math.random() * defaultQuotes.length)]);
      }
    };
    fetchQuote();
  }, [firestore]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background animate-in fade-in duration-300 px-6">
      <div className="flex flex-col items-center gap-8 max-w-md w-full text-center">
        <div className="relative scale-125">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-primary animate-ping" />
          </div>
        </div>
        
        <AnimatePresence mode="wait">
          {quote && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <p className="text-sm font-medium italic text-muted-foreground leading-relaxed">
                "{quote}"
              </p>
              <div className="h-0.5 w-12 bg-primary/20 mx-auto rounded-full" />
              <p className="text-[10px] font-black text-primary/40 uppercase tracking-[0.3em]">Aditya Pro</p>
            </motion.div>
          )}
        </AnimatePresence>
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

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const roleConfigsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'system_settings', 'access', 'roles');
  }, [firestore, user]);
  const { data: roleConfigs } = useCollection<AccessConfig>(roleConfigsQuery);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === "Admin";

  const isBirthday = React.useMemo(() => {
    if (!userProfile?.dob) return false;
    const today = new Date();
    const birthDate = new Date(userProfile.dob);
    return today.getMonth() === birthDate.getMonth() && today.getDate() === birthDate.getDate();
  }, [userProfile?.dob]);

  const handleBirthdayClick = () => {
    window.dispatchEvent(new Event('trigger-birthday-celebration'));
  };

  // Dynamic Access Gate (Inline Visibility Control)
  const isAuthorized = React.useMemo(() => {
    if (isAuthPage || isSuperAdmin(user?.email) || userProfile?.role === 'Admin') return true;
    if (isUserLoading || isProfileLoading || !userProfile) return true; // Wait for data before restricting

    const pageKey = getPageKeyByPath(pathname);
    if (!pageKey) return true; // Path not in controlled registry (e.g. /profile)

    const allowedKeys = userProfile.customPermissions 
      ? new Set(userProfile.customPermissions) 
      : new Set(roleConfigs?.find(c => c.id === userProfile.role)?.allowedPageKeys || []);

    // If no policy is defined yet, default to open for prototype usability
    if (allowedKeys.size === 0) return true; 
    
    return allowedKeys.has(pageKey);
  }, [user, userProfile, isUserLoading, isProfileLoading, pathname, isAuthPage, roleConfigs]);

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
                             (user.email === 'khalil@adityagreenenergy.com' && userProfile.username !== 'Khalil Choudhary');
      
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
        }

        if (!userProfile) {
          updateData.createdAt = serverTimestamp();
          if (!updateData.username) {
            updateData.username = user.displayName || user.email?.split('@')[0] || 'Admin';
          }
          data.mobile = user.phoneNumber || 'N/A';
          updateData.assignedProjectIds = [];
          updateData.totalPoints = 0;
          updateData.pointsMultiplier = 1;
        }

        setDocumentNonBlocking(doc(firestore, "users", user.uid), updateData, { merge: true });
      }
    }
  }, [user, userProfile, isProfileLoading, firestore]);

  const userRole = isAdmin ? "Admin" : userProfile?.role || "Site Engineer";
  const userDepartment = userProfile?.department || "";
  
  const ptwQueryForBadge = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'permits_to_work');
    
    if (userRole === 'Admin') {
      return query(colRef, where('status', '==', 'ManagerApproved'));
    }
    
    if (userRole === 'Site Manager') {
      return query(
        colRef, 
        and(
          where('status', '==', 'Pending'),
          where('siteManagerId', '==', user.uid)
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
    if (!user) return;

    const initNotifications = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const perm = await LocalNotifications.checkPermissions();
          if (perm.display !== 'granted') {
            await LocalNotifications.requestPermissions();
          }
          
          if (Capacitor.getPlatform() === 'android') {
            await LocalNotifications.createChannel({
              id: 'aditya-pro-alerts',
              name: 'Aditya Pro Alerts',
              description: 'Critical alerts for permits, tasks, and site activities',
              importance: 5,
              visibility: 1,
              vibration: true,
            });
          }
        } catch (err) {
          console.warn("Failed to initialize native notifications:", err);
        }
      } 
      else if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          Notification.requestPermission();
        }
      }
    };
    initNotifications();
  }, [user]);

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
      if (notifications && user) {
          const newDisplayedIds = new Set(displayedNotifIds);
          let wasUpdated = false;
          
          notifications.forEach(notif => {
              if (!notif.read && !displayedNotifIds.has(notif.id)) {
                  toast({ 
                    title: notif.title, 
                    description: notif.description, 
                    variant: notif.title.includes('Approved') ? 'success' : notif.title.includes('Rejected') ? 'destructive' : 'default' 
                  });

                  if (Capacitor.isNativePlatform()) {
                    LocalNotifications.schedule({
                      notifications: [
                        {
                          title: notif.title,
                          body: notif.description,
                          id: parseInt(notif.id.replace(/\D/g, '').slice(-8)) || Math.floor(Math.random() * 1000000),
                          channelId: 'aditya-pro-alerts',
                          smallIcon: 'ic_stat_icon_config_sample',
                          extra: {
                            link: notif.link
                          }
                        }
                      ]
                    }).catch(err => console.error("Scheduling error:", err));
                  } 
                  else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                    new Notification(notif.title, { body: notif.description });
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
  }, [notifications, user, toast, displayedNotifIds]);

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
        <div className="flex flex-col gap-3 w-full max-xs">
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
            <span className="text-lg font-black tracking-tighter text-primary uppercase">AdityaPro</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <MainNav userRole={userRole} userDepartment={userDepartment} pendingPtwCount={pendingPtwCount} />
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
              {isBirthday && (
                <Button 
                  variant="ghost" 
                  onClick={handleBirthdayClick}
                  className="h-8 px-2 sm:px-3 text-xs font-black uppercase text-amber-600 hover:bg-amber-50 rounded-sm animate-in fade-in zoom-in duration-500"
                >
                  <span className="mr-1">🎉</span> Happy Birthday!
                </Button>
              )}
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
            <BirthdayCelebration />
            <CredentialsPromptDialog />
            {isAuthorized ? children : (
              <div className="flex flex-col items-center justify-center py-32 text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="bg-destructive/5 p-6 rounded-full mb-6 border border-destructive/10">
                  <Lock className="h-12 w-12 text-destructive opacity-60" />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight">Access Restricted</h2>
                <p className="text-muted-foreground max-sm mt-2 font-medium">
                  Your organizational account does not have authorization to view this module. Please contact administration for access keys.
                </p>
                <Button variant="outline" onClick={() => router.push('/rewards')} className="mt-8 rounded-sm font-bold uppercase text-xs tracking-widest px-8">
                  Return to Hub
                </Button>
              </div>
            )}
          </div>
        </div>
        <BottomNav />
      </SidebarInset>
    </SidebarProvider>
  );
}
