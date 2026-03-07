
"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { collection, doc, query, where, orderBy, or, and } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, Navigation, ArrowRight, Timer, HardHat, AlertCircle, User } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { isSuperAdmin } from "@/lib/auth-constants";

type SiteVisit = {
  id: string;
  siteName: string;
  managerName: string;
  managerId: string;
  siteManagerId?: string;
  startTime: any;
  startLat: number;
  startLng: number;
  status: 'ongoing' | 'completed';
};

export default function ActiveSiteVisitsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const visitsQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'site_visits');
    
    if (isAdmin) {
      return query(colRef, where('status', '==', 'ongoing'));
    }

    if (isManager) {
        return query(
            colRef,
            and(
                where('status', '==', 'ongoing'),
                or(where('managerId', '==', user.uid), where('siteManagerId', '==', user.uid))
            )
        );
    }
    
    return query(
      colRef,
      where('managerId', '==', user.uid),
      where('status', '==', 'ongoing')
    );
  }, [firestore, user, isAdmin, isManager, isProfileLoading]);

  const { data: visits, isLoading } = useCollection<SiteVisit>(visitsQuery);

  if (isLoading || isProfileLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
          <Navigation className="h-8 w-8" /> {isAdmin ? "Global Active Presence" : (isManager ? "Team Active Presence" : "My Active Site Presence")}
        </h1>
        <p className="text-muted-foreground">
          {isAdmin ? "Monitoring all ongoing site visits across the organization." : (isManager ? "Ongoing site activities for you and your assigned engineering team." : "Manage your current ongoing site visit.")}
        </p>
      </div>

      {visits && visits.length > 0 ? (
        <div className="grid gap-6">
          {visits.map((visit) => (
            <Card key={visit.id} className="border-l-4 border-l-primary shadow-md overflow-hidden animate-in fade-in slide-in-from-left-4 duration-500">
              <CardHeader className="bg-primary/5 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary text-white font-bold uppercase text-[10px] tracking-widest rounded-sm">Ongoing</Badge>
                    <div className="flex items-center text-xs text-muted-foreground gap-1">
                      <Clock className="h-3 w-3" />
                      Started {formatDistanceToNow(visit.startTime?.toDate() || new Date(), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase">
                    <Timer className="h-3 w-3 animate-pulse" />
                    Visit in progress
                  </div>
                </div>
                <div className="mt-2 flex flex-col gap-1">
                  <CardTitle className="text-2xl font-black text-foreground">{visit.siteName}</CardTitle>
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    {visit.managerName} {visit.managerId === user?.uid && "(You)"}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Start Time</span>
                      <span className="font-bold text-sm">{visit.startTime ? format(visit.startTime.toDate(), 'dd MMM yyyy, HH:mm') : '—'}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Entry Location</span>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        <span className="font-mono text-xs">{visit.startLat.toFixed(5)}, {visit.startLng.toFixed(5)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-sm border border-dashed flex flex-col justify-center items-center text-center gap-2">
                    <HardHat className="h-8 w-8 text-primary/40" />
                    <p className="text-xs text-muted-foreground italic font-medium leading-relaxed">
                      {visit.managerId === user?.uid 
                        ? "Please finish the visit report before leaving the site premises to capture end coordinates correctly."
                        : `Personnel is currently performing site activities at ${visit.siteName}.`}
                    </p>
                  </div>
                </div>
              </CardContent>
              {visit.managerId === user?.uid && (
                <CardFooter className="bg-muted/10 border-t p-4">
                  <Button 
                    className="w-full h-12 text-lg font-black rounded-sm shadow-md" 
                    onClick={() => router.push(`/site-visits/${visit.id}/finish`)}
                  >
                    Complete Visit Report <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-card border border-dashed rounded-sm border-primary/20">
          <Navigation className="h-16 w-16 text-muted-foreground/20 mb-4" />
          <h3 className="text-xl font-bold">No Active Visits</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mt-2">
            {isAdmin 
              ? "There are currently no personnel logged in at any project site." 
              : "You are not currently logged in at any site. Click 'Start Visit' when you arrive at a project location."}
          </p>
          <Button onClick={() => router.push('/site-visits/start')} className="mt-6 font-bold h-11 px-8 rounded-sm">
            Check-in to Site
          </Button>
        </div>
      )}
    </div>
  );
}
