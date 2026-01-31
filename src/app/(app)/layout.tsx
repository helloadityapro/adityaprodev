
'use client';

import React from "react";
import { useRouter } from "next/navigation";
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

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" role="status">
          <span className="sr-only">Loading...</span>
        </div>
        <p className="text-lg font-medium text-muted-foreground">Loading...</p>
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


export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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

  // Bootstrap/self-heal the primary admin user
  React.useEffect(() => {
    if (user && user.email === 'abhijeet.agepl@gmail.com' && !isProfileLoading) {
      if (!userProfile || userProfile.role !== 'Admin') {
        const adminUserDoc = {
          id: user.uid,
          username: 'Admin User', // Default username
          email: user.email,
          mobile: user.phoneNumber || '0000000000',
          role: 'Admin',
          registrationRequest: false, // Pre-approved
          assignedProjectIds: [],
        };
        setDocumentNonBlocking(doc(firestore, "users", user.uid), adminUserDoc, { merge: true });
      }
    }
  }, [user, userProfile, isProfileLoading, firestore]);

  // Seed PTW Types if the collection is empty
  const ptwTypesCollectionRef = useMemoFirebase(() => collection(firestore, 'ptw_types'), [firestore]);
  const { data: ptwTypes, isLoading: ptwTypesLoading } = useCollection(ptwTypesCollectionRef);

  React.useEffect(() => {
    if (ptwTypesCollectionRef && !ptwTypesLoading && ptwTypes && ptwTypes.length === 0) {
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
  }, [ptwTypes, ptwTypesLoading, ptwTypesCollectionRef]);

  // Seed Sites if the collection is empty
  const sitesCollectionRef = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: sites, isLoading: sitesLoading } = useCollection(sitesCollectionRef);

  React.useEffect(() => {
    const seedSites = async () => {
      if (sitesCollectionRef && !sitesLoading && sites && sites.length === 0) {
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
  }, [sites, sitesLoading, sitesCollectionRef]);

  const isAdmin = userProfile?.role === "Admin" || user?.email === 'abhijeet.agepl@gmail.com';
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

  // --- Pop-up notifications for Site Engineers ---
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


  // Use state to manage displayed notifications, initialized from sessionStorage
  const [displayedNotifIds, setDisplayedNotifIds] = React.useState<Set<string>>(new Set());

  // Load displayed IDs from sessionStorage on component mount (client-side only)
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

  // Check for registration approval but allow admin email through
  if (userProfile && userProfile.registrationRequest && user?.email !== 'abhijeet.agepl@gmail.com') {
     return (
      <div className="flex flex-col min-h-screen items-center justify-center text-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Registration Pending</h1>
          <p className="text-muted-foreground">Your account is awaiting admin approval.</p>
        </div>
        <Button onClick={() => auth.signOut()}>Sign Out</Button>
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
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6">
          <SidebarTrigger />
          <div className="w-full flex-1">
            {/* Can add a search form here if needed */}
          </div>
          <UserNotifications />
          <UserNav />
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-muted/40 animate-in fade-in-0 duration-500">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
