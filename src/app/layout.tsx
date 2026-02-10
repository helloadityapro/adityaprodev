
'use client';

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser, useDoc, useFirestore, useMemoFirebase, useAuth, setDocumentNonBlocking, useCollection } from "@/firebase";
import { collection, doc, query, where } from "firebase/firestore";
import UserNav from "@/components/user-nav";
import AppLogo from "@/components/app-logo";
import { MainNav } from "@/components/main-nav";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UserNotifications } from "@/components/user-notifications";
import { Toaster } from '@/components/ui/toaster';
import './globals.css';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { Loader2, Sun, Moon } from "lucide-react";

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

const DISPLAYED_NOTIFS_KEY = 'displayedNotifIds';

function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');

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
      localStorage.setItem('theme', 'light');
    }
  };

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const SUPER_ADMIN_EMAILS = [
    'abhijeet.agepl@gmail.com',
    'abhijeetsb22@gmail.com',
    'khalil@adityagreenenergy.com',
    'prafulrana143@gmail.com'
  ];

  const isAdmin = userProfile?.role === "Admin" || (user?.email && SUPER_ADMIN_EMAILS.includes(user.email));

  React.useEffect(() => {
    if (user && user.email && SUPER_ADMIN_EMAILS.includes(user.email) && !isProfileLoading) {
      const needsInitialization = !userProfile || userProfile.role !== 'Admin' || userProfile.registrationRequest === true;
      
      if (needsInitialization) {
        const updateData: any = {
          id: user.uid,
          email: user.email,
          role: 'Admin',
          registrationRequest: false,
          assignedProjectIds: userProfile?.assignedProjectIds || [],
        };
        
        if (!userProfile?.username) {
          updateData.username = user.displayName || 'Admin User';
        }
        if (!userProfile?.mobile) {
          updateData.mobile = user.phoneNumber || '0000000000';
        }

        setDocumentNonBlocking(doc(firestore, "users", user.uid), updateData, { merge: true });
      }
    }
  }, [user, userProfile, isProfileLoading, firestore]);

  const userRole = isAdmin ? "Admin" : userProfile?.role || "Site Engineer";
  
  const ptwQueryForBadge = useMemoFirebase(() => {
    if (userRole === 'Admin' || userRole === 'Site Manager') {
      return query(
        collection(firestore, 'permits_to_work'),
        where('isNew', '==', true)
      );
    }
    return null;
  }, [firestore, userRole]);
  const { data: permitsForBadge } = useCollection(ptwQueryForBadge);

  const pendingPtwCount = React.useMemo(() => {
    if (!permitsForBadge) return 0;
    return permitsForBadge.length;
  }, [permitsForBadge]);

  const notificationsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
        collection(firestore, 'notifications'), 
        where('userId', '==', user.uid)
    );
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
      if (storedIds) {
        setDisplayedNotifIds(new Set(JSON.parse(storedIds)));
      }
    } catch (e) {
      console.error("Could not parse sessionStorage for notifications:", e);
    }
  }, []);

  React.useEffect(() => {
      if (notifications) {
          const newDisplayedIds = new Set(displayedNotifIds);
          let wasUpdated = false;

          notifications.forEach(notif => {
              if (!notif.read && !displayedNotifIds.has(notif.id)) {
                  let variant: 'default' | 'destructive' | 'success' = 'default';
                  if (notif.title.includes('Approved')) {
                    variant = 'success';
                  } else if (notif.title.includes('Rejected')) {
                    variant = 'destructive';
                  }

                  toast({
                      title: notif.title,
                      description: notif.description,
                      variant,
                  });
                  newDisplayedIds.add(notif.id);
                  wasUpdated = true;
              }
          });

          if (wasUpdated) {
              setDisplayedNotifIds(newDisplayedIds);
              try {
                sessionStorage.setItem(DISPLAYED_NOTIFS_KEY, JSON.stringify(Array.from(newDisplayedIds)));
              } catch(e) {
                console.error("Could not update sessionStorage for notifications:", e);
              }
          }
      }
  }, [notifications, toast, displayedNotifIds]);


  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/login');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) {
    return <FullPageLoader />;
  }

  if (userProfile && userProfile.registrationRequest && !isAdmin) {
     return (
      <div className="flex flex-col min-h-screen items-center justify-center text-center gap-6 p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Registration Pending</h1>
          <p className="text-muted-foreground">Your account is awaiting administrator approval. You will be notified once approved.</p>
        </div>
        <Button variant="outline" onClick={() => auth.signOut()}>Sign Out</Button>
      </div>
    );
  }


  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <AppLogo />
        </SidebarHeader>
        <SidebarContent>
          <MainNav userRole={userRole} pendingPtwCount={pendingPtwCount} />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6 sticky top-0 z-10">
          <SidebarTrigger />
          <div className="w-full flex-1">
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8 rounded-full"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </Button>
          <UserNotifications />
          <UserNav />
        </header>
        <main 
          key={pathname}
          className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-muted/40 animate-in fade-in slide-in-from-bottom-2 duration-500"
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/forgot-password';
  
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Aditya Pro</title>
        <meta name="description" content="A platform for managing Permits to Work." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased selection:bg-primary/20">
        <FirebaseClientProvider>
          {isAuthPage ? children : <AppShell>{children}</AppShell>}
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
