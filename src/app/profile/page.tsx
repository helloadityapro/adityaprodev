'use client';

import * as React from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trophy, Star, Award, Coins, MapPin, ShieldCheck, UserCog, TrendingUp, HardHat } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type UserProfile = {
  id: string;
  username: string;
  email: string;
  role: string;
  mobile: string;
  registrationRequest: boolean;
  totalPoints?: number;
  pointsMultiplier?: number;
  siteManagerId?: string;
  assignedProjectIds?: string[];
};

type RewardSettings = {
  pointValueInRs?: number;
};

type Site = {
  id: string;
  name: string;
};

function ProfilePageSkeleton() {
    return (
        <div className="space-y-8 animate-pulse">
            <div className="flex flex-col gap-2">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-4 w-64" />
            </div>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                <Card className="lg:col-span-1">
                    <CardHeader className="items-center text-center">
                        <Skeleton className="h-24 w-24 rounded-full mb-4" />
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-56" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </CardContent>
                </Card>
                <div className="lg:col-span-2 space-y-8">
                    <div className="grid grid-cols-3 gap-4">
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-32 w-full" />
                    </div>
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        </div>
    );
}

export default function ProfilePage() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();

  // 1. Fetch current user profile
  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  // 2. Fetch global point value
  const settingsRef = useMemoFirebase(() => doc(firestore, 'system_settings', 'rewards'), [firestore]);
  const { data: settings } = useDoc<RewardSettings>(settingsRef);

  // 3. Fetch all users to calculate rank
  const leadersQuery = useMemoFirebase(() => 
    query(collection(firestore, 'users'), orderBy('totalPoints', 'desc')), 
    [firestore]
  );
  const { data: allUsers, isLoading: isRankLoading } = useCollection<UserProfile>(leadersQuery);

  // 4. Fetch manager info if applicable
  const managerRef = useMemoFirebase(() => {
    if (!userProfile?.siteManagerId) return null;
    return doc(firestore, 'users', userProfile.siteManagerId);
  }, [firestore, userProfile?.siteManagerId]);
  const { data: managerProfile } = useDoc<UserProfile>(managerRef);

  // 5. Fetch all sites to map assigned IDs
  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const globalRank = React.useMemo(() => {
    if (!allUsers || !user) return null;
    const index = allUsers.findIndex(u => u.id === user.uid);
    return index !== -1 ? index + 1 : null;
  }, [allUsers, user]);

  const assignedSites = React.useMemo(() => {
    if (!userProfile?.assignedProjectIds || !allSites) return [];
    return allSites.filter(s => userProfile.assignedProjectIds?.includes(s.id));
  }, [userProfile, allSites]);

  const pointValue = settings?.pointValueInRs || 1;
  const userPoints = userProfile?.totalPoints || 0;
  const monetaryValue = userPoints * pointValue;

  if (isAuthLoading || isProfileLoading || isRankLoading) {
    return <ProfilePageSkeleton />;
  }

  if (!userProfile) {
    return <div className="p-8 text-center text-muted-foreground">Could not load user profile. Please sign in again.</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
         <h1 className="text-3xl font-bold tracking-tight text-primary">My Profile</h1>
         <p className="text-muted-foreground">Comprehensive overview of your professional standing and site authorizations.</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column: Core Info */}
        <div className="space-y-8">
            <Card className="rounded-sm border-primary/10 shadow-md">
                <CardHeader className="items-center text-center pb-2">
                    <Avatar className="h-24 w-24 mb-4 border-2 border-primary/20 ring-4 ring-primary/5">
                        {user?.photoURL && <AvatarImage src={user.photoURL} alt={userProfile.username} data-ai-hint="person face" />}
                        <AvatarFallback className="text-3xl font-black bg-primary text-primary-foreground">
                            {userProfile.username?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <CardTitle className="text-2xl font-black tracking-tight">{userProfile.username}</CardTitle>
                    <CardDescription className="font-medium">{userProfile.email}</CardDescription>
                    <div className="flex items-center gap-2 mt-3">
                        <Badge variant="secondary" className="rounded-sm font-bold uppercase text-[10px] h-5 px-2">
                            {userProfile.role}
                        </Badge>
                        <Badge variant={userProfile.registrationRequest ? 'destructive' : 'outline'} className="rounded-sm font-bold uppercase text-[10px] h-5 px-2">
                            {userProfile.registrationRequest ? 'Awaiting Approval' : 'Verified'}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                    <Separator className="bg-primary/5" />
                    <div className="grid gap-4 text-sm">
                        <div className="flex justify-between items-center p-3 rounded-md bg-muted/30">
                            <span className="font-bold text-[10px] uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                <ShieldCheck className="h-3.5 w-3.5" /> Mobile
                            </span>
                            <span className="font-mono font-bold">{userProfile.mobile || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-md bg-muted/30">
                            <span className="font-bold text-[10px] uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                <Star className="h-3.5 w-3.5 text-amber-500" /> Multiplier
                            </span>
                            <span className="font-black text-amber-700">{userProfile.pointsMultiplier || 1.0}x</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {userProfile.role === 'Site Engineer' && (
                <Card className="rounded-sm border-primary/10 shadow-sm overflow-hidden">
                    <CardHeader className="bg-primary/5 py-3 border-b">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                            <UserCog className="h-4 w-4 text-primary" /> Reporting Structure
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {managerProfile ? (
                            <div className="flex items-center gap-4">
                                <Avatar className="h-10 w-10 border">
                                    <AvatarFallback className="text-xs font-bold">{managerProfile.username.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold">{managerProfile.username}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Assigned Site Manager</span>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 bg-muted/20 border border-dashed rounded-sm text-center">
                                <p className="text-xs text-muted-foreground italic">No manager mapped. Please contact Admin.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>

        {/* Right Column: Stats & Sites */}
        <div className="lg:col-span-2 space-y-8">
            {/* Quick Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-amber-500/5 border-amber-500/20 rounded-sm">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase text-amber-700 tracking-widest">Total Points</span>
                            <Trophy className="h-4 w-4 text-amber-500" />
                        </div>
                        <div className="text-3xl font-black text-amber-700">{userPoints.toFixed(2)}</div>
                        <p className="text-[9px] text-muted-foreground mt-1 uppercase font-bold">Accumulated Balance</p>
                    </CardContent>
                </Card>

                <Card className="bg-green-500/5 border-green-500/20 rounded-sm">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase text-green-700 tracking-widest">Rewards Value</span>
                            <Coins className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="text-3xl font-black text-green-700">₹{monetaryValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        <p className="text-[9px] text-muted-foreground mt-1 uppercase font-bold">1 Point = ₹{pointValue}</p>
                    </CardContent>
                </Card>

                <Card className="bg-primary/5 border-primary/20 rounded-sm">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase text-primary tracking-widest">Global Rank</span>
                            <Award className="h-4 w-4 text-primary" />
                        </div>
                        <div className="text-3xl font-black text-primary">#{globalRank || '—'}</div>
                        <p className="text-[9px] text-muted-foreground mt-1 uppercase font-bold">Platform Percentile</p>
                    </CardContent>
                </Card>
            </div>

            {/* Performance Summary Card */}
            <Card className="rounded-sm border-primary/10 overflow-hidden shadow-md">
                <CardHeader className="bg-muted/5 border-b flex flex-row items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-primary" /> Performance & Sites
                        </CardTitle>
                        <CardDescription>Official authorizations and professional rank summary.</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" />
                            <h3 className="font-bold text-sm uppercase tracking-widest">Authorized Site Access</h3>
                        </div>
                        {assignedSites.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {assignedSites.map(site => (
                                    <div key={site.id} className="flex items-center gap-3 p-3 rounded-md border bg-card hover:bg-primary/5 hover:border-primary/20 transition-colors group">
                                        <div className="p-2 bg-muted rounded-sm group-hover:bg-primary/10 transition-colors">
                                            <HardHat className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                                        </div>
                                        <span className="text-sm font-bold truncate">{site.name}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center bg-muted/10 rounded-sm border border-dashed">
                                <MapPin className="h-8 w-8 text-muted-foreground/30 mb-2" />
                                <p className="text-sm text-muted-foreground font-medium">No sites currently assigned to your account.</p>
                                <p className="text-[10px] text-muted-foreground mt-1 uppercase">Contact Administration for site mapping</p>
                            </div>
                        )}
                    </div>

                    <Separator className="opacity-50" />

                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Award className="h-4 w-4 text-amber-500" />
                            <h3 className="font-bold text-sm uppercase tracking-widest">Rewards Insight</h3>
                        </div>
                        <div className="p-4 rounded-sm bg-amber-500/5 border border-amber-500/10">
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                Your professional ranking is determined by the volume and quality of documentation submitted. 
                                <strong className="text-amber-700 ml-1">Daily Progress Reports</strong>, <strong className="text-amber-700">Material Logs</strong>, 
                                and <strong className="text-amber-700">Permit Accuracy</strong> directly impact your points balance.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
