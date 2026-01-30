'use client';

import React from "react";
import { useRouter } from "next/navigation";
import { useUser, useDoc, useFirestore, useMemoFirebase, useAuth, setDocumentNonBlocking, useCollection, addDocumentNonBlocking } from "@/firebase";
import { collection, doc } from "firebase/firestore";
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


export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

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
            { name: 'Hot Work' },
            { name: 'Confined Space Entry' },
            { name: 'Electrical (HV & LV)' },
            { name: 'Work at Height' },
            { name: 'Excavation' },
            { name: 'Lifting & Rigging' },
            { name: 'General Work' },
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
    if (sitesCollectionRef && !sitesLoading && sites && sites.length === 0) {
        const defaultSites = [
            { name: 'Nagalwadi', projectCompany: 'Aditya Green Energy', acCapacity: '50 MW', dcCapacity: '60 MWp' },
            { name: 'Mahoba Solar', projectCompany: 'Adani Green Energy', acCapacity: '250 MW', dcCapacity: '300 MWp' },
            { name: 'Pavagada Solar Park', projectCompany: 'Azure Power', acCapacity: '150 MW', dcCapacity: '180 MWp' },
        ];
        defaultSites.forEach(site => {
            addDocumentNonBlocking(sitesCollectionRef, site);
        });
    }
  }, [sites, sitesLoading, sitesCollectionRef]);

  const isAdmin = userProfile?.role === "Admin" || user?.email === 'abhijeet.agepl@gmail.com';
  const userRole = isAdmin ? "Admin" : userProfile?.role || "SiteEngineer";


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
          <MainNav userRole={userRole} />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6">
          <SidebarTrigger />
          <div className="w-full flex-1">
            {/* Can add a search form here if needed */}
          </div>
          <UserNav />
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-muted/40 animate-in fade-in-0 duration-500">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
