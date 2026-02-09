'use client';

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser, useDoc, useFirestore, useMemoFirebase, useAuth, setDocumentNonBlocking, useCollection, addDocumentNonBlocking } from "@/firebase";
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
import { Loader2 } from "lucide-react";

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

const parseCSVToSites = (csvText: string) => {
    const lines = csvText.trim().split('\n');
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const values = line.split(',').map(v => v.trim().replace(/\r/g, ''));
        if (values.length >= 5 && !isNaN(parseInt(values[0], 10)) && values[2] && values[2].trim() !== '') {
            const entry = {
                projectCompany: values[1],
                name: values[2],
                dcCapacity: values[3],
                acCapacity: values[4],
            };
            data.push(entry);
        }
    }
    return data;
};

const DISPLAYED_NOTIFS_KEY = 'displayedNotifIds';

function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  React.useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const isAdmin = userProfile?.role === "Admin" || user?.email === 'abhijeet.agepl@gmail.com' || user?.email === 'abhijeetsb22@gmail.com';

  React.useEffect(() => {
    if (user && (user.email === 'abhijeet.agepl@gmail.com' || user.email === 'abhijeetsb22@gmail.com') && !isProfileLoading) {
      if (!userProfile || userProfile.role !== 'Admin') {
        const adminUserDoc = {
          id: user.uid,
          username: 'Admin User',
          email: user.email,
          mobile: user.phoneNumber || '0000000000',
          role: 'Admin',
          registrationRequest: false,
          assignedProjectIds: [],
        };
        setDocumentNonBlocking(doc(firestore, "users", user.uid), adminUserDoc, { merge: true });
      }
    }
  }, [user, userProfile, isProfileLoading, firestore]);

  const ptwTypesCollectionRef = useMemoFirebase(() => (user ? collection(firestore, 'ptw_types') : null), [firestore, user]);
  const { data: ptwTypes, isLoading: ptwTypesLoading } = useCollection(ptwTypesCollectionRef);

  React.useEffect(() => {
    // Only admins are allowed to seed the database
    if (isAdmin && ptwTypesCollectionRef && !ptwTypesLoading && ptwTypes && ptwTypes.length === 0) {
        const defaultPtwTypes = [
            { name: 'MMS columns concreting/erection work' },
            { name: 'Cables cutting' },
            { name: 'Trench laying' },
            { name: 'Civil works' },
        ];
        defaultPtwTypes.forEach(type => {
            addDocumentNonBlocking(ptwTypesCollectionRef, type);
        });
    }
  }, [ptwTypes, ptwTypesLoading, ptwTypesCollectionRef, isAdmin]);

  const sitesCollectionRef = useMemoFirebase(() => (user ? collection(firestore, 'sites') : null), [firestore, user]);
  const { data: sites, isLoading: sitesLoading } = useCollection(sitesCollectionRef);

  React.useEffect(() => {
    const seedSites = async () => {
      // Only admins are allowed to seed the database
      if (isAdmin && sitesCollectionRef && !sitesLoading && sites && sites.length === 0) {
          try {
            const response = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vT8JE2-QFEjU_CVprrrBPivhxoygAtkC8S6JFPTK8-R28EL9XuTTv7aJ3Onejmsp55_RQEvF8g7Ku1p/pub?gid=1131066411&single=true&output=csv');
            if (response.ok) {
                const csvText = await response.text();
                const parsedData = parseCSVToSites(csvText);
                parsedData.forEach(site => {
                    addDocumentNonBlocking(sitesCollectionRef, site);
                });
            }
          } catch (error) {
            console.error("Error seeding sites from Google Sheet:", error);
          }
      }
    }
    seedSites();
  }, [sites, sitesLoading, sitesCollectionRef, isAdmin]);

  const userRole = isAdmin ? "Admin" : userProfile?.role || "SiteEngineer";
  
  const ptwQueryForBadge = useMemoFirebase(() => {
    if (userRole === 'Admin' || userRole === 'Supervisor') {
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