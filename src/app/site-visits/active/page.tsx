
"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { collection, doc, query, where, or, and, updateDoc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, Navigation, ArrowRight, Timer, HardHat, User, Building2, Globe, RefreshCw, XCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { isSuperAdmin } from "@/lib/auth-constants";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type SiteVisit = {
  id: string;
  siteName: string;
  managerName: string;
  managerId: string;
  siteManagerId?: string;
  department?: string;
  startTime: any;
  startLat: number;
  startLng: number;
  status: 'ongoing' | 'completed' | 'pending_upload';
  locationType?: 'site' | 'other';
};

export default function ActiveSiteVisitsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const visitsQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'site_visits');
    
    // Admins monitor all ongoing and syncing visits
    if (isAdmin) {
      return query(colRef, where('status', 'in', ['ongoing', 'pending_upload']));
    }

    // Managers see their own and their team's active visits
    if (isManager) {
        return query(
            colRef,
            and(
              where('status', 'in', ['ongoing', 'pending_upload']),
              or(where('managerId', '==', user.uid), where('siteManagerId', '==', user.uid))
            )
        );
    }
    
    // Engineers only see their own active visits
    return query(
      colRef,
      and(
        where('managerId', '==', user.uid),
        where('status', 'in', ['ongoing', 'pending_upload'])
      )
    );
  }, [firestore, user, isAdmin, isManager, isProfileLoading]);

  const { data: visits, isLoading } = useCollection<SiteVisit>(visitsQuery);

  const sortedVisits = React.useMemo(() => {
    if (!visits) return [];
    return [...visits].sort((a, b) => {
      const timeA = a.startTime?.toDate?.()?.getTime() || 0;
      const timeB = b.startTime?.toDate?.()?.getTime() || 0;
      return timeB - timeA;
    });
  }, [visits]);

  const handleForceFinalize = async (vId: string) => {
    try {
      await updateDoc(doc(firestore, 'site_visits', vId), {
        status: 'completed',
        updatedAt: serverTimestamp()
      });
      toast({ title: 'Report Finalized', description: 'Media synchronization terminated. Report has been marked as complete.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
    }
  };

  if (isLoading || isProfileLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2">
          <Navigation className="h-8 w-8" /> {isAdmin ? "Global Active Presence" : (isManager ? "Team Active Presence" : "My Active Presence")}
        </h1>
        <p className="text-muted-foreground text-sm font-medium">
          {isAdmin ? "Monitoring all ongoing field and site visits across the organization." : (isManager ? "Ongoing activities for you and your assigned engineering team." : "Manage your current ongoing field presence.")}
        </p>
      </div>

      {sortedVisits && sortedVisits.length > 0 ? (
        <div className="grid gap-6">
          {sortedVisits.map((visit) => {
            const isSite = visit.locationType !== 'other';
            const isSyncing = visit.status === 'pending_upload';

            return (
              <Card key={visit.id} className={cn("border-l-4 shadow-md overflow-hidden animate-in fade-in slide-in-from-left-4 duration-500", isSyncing ? "border-l-blue-400 opacity-80" : "border-l-primary")}>
                <CardHeader className="bg-primary/5 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={cn("text-[9px] h-6 font-black uppercase rounded-sm border-none bg-slate-900 text-white flex items-center gap-1.5 px-2.5 shadow-sm")}>
                        {isSite ? <Building2 className="h-3 w-3" /> : <Globe className="h-3 w-3" />} 
                        {isSite ? "Project Site" : "Other Location"}
                      </Badge>
                      {isSyncing ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 animate-pulse font-bold uppercase text-[10px] tracking-widest rounded-sm h-6 px-3">
                          <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" /> Syncing Media...
                        </Badge>
                      ) : (
                        <Badge className="bg-primary text-white font-bold uppercase text-[10px] tracking-widest rounded-sm h-6 px-3 border-none">Active</Badge>
                      )}
                      <div className="flex items-center text-xs text-muted-foreground gap-1 ml-2">
                        <Clock className="h-3 w-3" />
                        Started {formatDistanceToNow(visit.startTime?.toDate() || new Date(), { addSuffix: true })}
                      </div>
                    </div>
                    {!isSyncing && (
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase">
                        <Timer className="h-3 w-3 animate-pulse" />
                        In progress
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex flex-col gap-1">
                    <CardTitle className="text-2xl font-black text-foreground">{visit.siteName}</CardTitle>
                    <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      {visit.managerName} {visit.managerId === user?.uid && "(You)"}
                      {visit.department && (
                        <Badge variant="outline" className="ml-1 text-[8px] h-4 font-black uppercase border-primary/20 text-primary bg-primary/5 rounded-sm px-1.5">
                          {visit.department}
                        </Badge>
                      )}
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
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Entry Position</span>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          <span className="font-mono text-xs">{visit.startLat.toFixed(5)}, {visit.startLng.toFixed(5)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-muted/30 p-4 rounded-sm border border-dashed flex flex-col justify-center items-center text-center gap-2">
                      <HardHat className="h-8 w-8 text-primary/40" />
                      <p className="text-xs text-muted-foreground italic font-medium leading-relaxed">
                        {isSyncing 
                          ? "This report has been finalized. Attachments are currently being synchronized to the organizational archives."
                          : visit.managerId === user?.uid 
                            ? `Continue documenting your ${isSite ? 'site' : 'field'} activities. You can save progress multiple times.`
                            : `Personnel is currently active at ${visit.siteName}.`}
                      </p>
                    </div>
                  </div>
                </CardContent>
                {((visit.managerId === user?.uid && !isSyncing) || (isSyncing && (visit.managerId === user?.uid || isAdmin))) && (
                  <CardFooter className="bg-muted/10 border-t p-4">
                    {isSyncing ? (
                      <Button 
                        variant="destructive"
                        className="w-full h-12 text-sm font-black rounded-sm shadow-md" 
                        onClick={() => handleForceFinalize(visit.id)}
                      >
                        <XCircle className="mr-2 h-4 w-4" /> End Sync & Finalize Report
                      </Button>
                    ) : (
                      <Button 
                        className="w-full h-12 text-lg font-black rounded-sm shadow-md" 
                        onClick={() => router.push(`/site-visits/${visit.id}/finish`)}
                      >
                        Continue {isSite ? 'Visit' : 'Visit'} <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    )}
                  </CardFooter>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-card border border-dashed rounded-sm border-primary/20">
          <Navigation className="h-16 w-16 text-muted-foreground/20 mb-4" />
          <h3 className="text-xl font-bold">No Active Presence</h3>
          <p className="text-muted-foreground max-sm mx-auto mt-2">
            {isAdmin 
              ? "There are currently no personnel active at any location." 
              : "You are not currently active at any site. Click 'Check-in' when you arrive at a location."}
          </p>
          <Button onClick={() => router.push('/site-visits/start')} className="mt-6 font-bold h-11 px-8 rounded-sm">
            Check-in to Location
          </Button>
        </div>
      )}
    </div>
  );
}
