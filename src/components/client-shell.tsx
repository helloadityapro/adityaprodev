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
import { QuickActions } from "@/components/quick-actions";
import { GlobalSearch } from "@/components/global-search";
import { Loader2, Sun, Moon, ShieldAlert, LogOut, UserX, AlertCircle, RefreshCw } from "lucide-react";
import { isSuperAdmin } from "@/lib/auth-constants";

const DISPLAYED_NOTIFS_KEY = 'displayedNotifIds';

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background animate-in fade-in duration-300">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground tracking-widest uppercase">Initializing Aditya Pro</p>
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

  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/forgot-password';

  React.useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
      setTheme('dark');
    } else {
      document.documentElement.classList.remove('dark');
      setTheme('light');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      setTheme('light');
    }
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

      const needsBootstrap = !userProfile || userProfile.role !== 'Admin' || userProfile.registrationRequest === true || (user.email === 'khalil@adityagreenenergy.com' && userProfile.username !== 'Khalil Choudhary');
      
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
          if (user.email !== 'khalil@adityagreenenergy.com') {
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

  React.useEffect(() => {
    try {
      const storedIds = sessionStorage.getItem(DISPLAYED_NOTIFS_KEY);
      if (storedIds) setDisplayedNotifIds(new Set(JSON.parse(storedIds)));
    } catch (e) {}
  }, []);

  React.useEffect(() => {
      if (notifications) {
          const newDisplayedIds = new Set(displayedNotifIds);
          let wasUpdated = false;
          notifications.forEach(notif => {
              if (!notif.read && !displayedNotifIds.has(notif.id)) {
                  toast({ title: notif.title, description: notif.description, variant: notif.title.includes('Approved') ? 'success' : notif.title.includes('Rejected') ? 'destructive' : 'default' });
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
        <h1 className="mb-2 text-3xl font-black uppercase tracking-tight text-destructive">Profile Not Found</h1>
        <p className="mb-8 max-w-md text-muted-foreground text-lg leading-relaxed">
          Your account is authenticated, but your professional profile could not be found in the database. 
          This happens if your data was cleared or registration was not completed.
        </p>
        <div className="flex flex-col gap-3 w-full max-xs">
          <Button onClick={() => router.push('/register')} className="w-full font-black h-12 text-lg shadow-md rounded-sm">
            <RefreshCw className="mr-2 h-5 w-5" /> Restore Profile
          </Button>
          <Button variant="ghost" onClick={() => auth.signOut()} className="w-full flex items-center justify-center gap-2 font-semibold">
            <LogOut className="h-4 w-4" /> Sign Out & Re-login
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
        <p className="text-muted-foreground max-w-sm text-lg">Your account has been created successfully but is currently awaiting administrative approval.</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button variant="outline" onClick={() => auth.signOut()} className="rounded-sm font-bold h-11">Sign Out & Exit</Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider className="h-full overflow-hidden">
      <Sidebar>
        <SidebarHeader className="px-6 py-4 border-b">
          <span className="text-sm font-bold tracking-widest text-primary uppercase">Aditya Pro</span>
        </SidebarHeader>
        <SidebarContent>
          <MainNav userRole={userRole} pendingPtwCount={pendingPtwCount} />
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="flex flex-col h-full overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-background px-4 lg:px-6 z-10">
          <SidebarTrigger />
          <div className="flex-1 max-w-md">
            <GlobalSearch />
          </div>
          <div className="flex-1" />
          <QuickActions />
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
            {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </Button>
          <UserNotifications />
          <UserNav />
        </header>
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-muted/40">
          <div className="flex flex-col gap-4 p-4 lg:gap-6 lg:p-6 min-h-full">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
