
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
import { Loader2, Sun, Moon, ShieldAlert, LogOut } from "lucide-react";
import { isSuperAdmin } from "@/lib/auth-constants";

const DISPLAYED_NOTIFS_KEY = 'displayedNotifIds';

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background animate-in fade-in duration-300">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground tracking-widest uppercase">Initializing</p>
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

  // Redirection Logic
  React.useEffect(() => {
    if (!isUserLoading && !user && !isAuthPage) {
      router.replace('/login');
    }
  }, [isUserLoading, user, isAuthPage, router]);

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

  // Bootstrap logic for Super Admins
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
  const { data: unsortedNotifications } = useCollection(notificationsQuery);

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
        <ShieldAlert className="mb-4 h-12 w-12 text-destructive" />
        <h1 className="mb-2 text-2xl font-bold tracking-tight">User doesn't exist</h1>
        <p className="mb-6 max-w-sm text-muted-foreground">
          User doesn't exist, please register to login
        </p>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <Button onClick={() => { auth.signOut().then(() => router.replace('/register')) }} className="w-full font-bold">
            Register to login
          </Button>
          <Button variant="ghost" onClick={() => auth.signOut()} className="w-full flex items-center gap-2">
            <LogOut className="h-4 w-4" /> Sign Out
          </Button>
        </div>
      </div>
    );
  }

  if (userProfile?.registrationRequest && !isAdmin) {
     return (
      <div className="flex flex-col min-h-screen items-center justify-center text-center gap-6 p-4">
        <h1 className="text-2xl font-bold">Registration Pending</h1>
        <p className="text-muted-foreground">Account awaiting approval.</p>
        <Button variant="outline" onClick={() => auth.signOut()}>Sign Out</Button>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="px-6 py-4 border-b">
          <span className="text-sm font-bold tracking-widest text-primary uppercase">Aditya Pro</span>
        </SidebarHeader>
        <SidebarContent>
          <MainNav userRole={userRole} pendingPtwCount={pendingPtwCount} />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6 sticky top-0 z-10">
          <SidebarTrigger />
          <div className="flex-1" />
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
            {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </Button>
          <UserNotifications />
          <UserNav />
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-muted/40">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
