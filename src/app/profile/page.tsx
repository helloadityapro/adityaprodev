'use client';

import * as React from 'react';
import { useUser, useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trophy, Star, Award, Coins, MapPin, ShieldCheck, UserCog, TrendingUp, HardHat, Smartphone, Zap, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';

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
            <Skeleton className="h-32 w-full rounded-sm" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
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

  // 4. Fetch manager info if applicable (for engineers)
  const managerRef = useMemoFirebase(() => {
    if (!userProfile?.siteManagerId) return null;
    return doc(firestore, 'users', userProfile.siteManagerId);
  }, [firestore, userProfile?.siteManagerId]);
  const { data: managerProfile } = useDoc<UserProfile>(managerRef);

  // 5. Fetch team members (for managers)
  const teamQuery = useMemoFirebase(() => {
    if (!userProfile || userProfile.role !== 'Site Manager' || !user) return null;
    return query(collection(firestore, 'users'), where('siteManagerId', '==', user.uid));
  }, [firestore, user, userProfile?.role]);
  const { data: teamMembers, isLoading: isTeamLoading } = useCollection<UserProfile>(teamQuery);

  // 6. Fetch all sites to map assigned IDs
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

  if (isAuthLoading || isProfileLoading || isRankLoading || (userProfile?.role === 'Site Manager' && isTeamLoading)) {
    return <ProfilePageSkeleton />;
  }

  if (!userProfile) {
    return <div className="p-8 text-center text-muted-foreground">Could not load user profile. Please sign in again.</div>;
  }

  return (
    <div className="space-y-8">
      {/* Top Hero Section: Horizontal Profile Card */}
      <Card className="rounded-sm border-primary/10 shadow-md overflow-hidden bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-10">
            <Avatar className="h-24 w-24 md:h-32 md:w-32 border-4 border-background ring-4 ring-primary/5 shadow-xl">
              {user?.photoURL && <AvatarImage src={user.photoURL} alt={userProfile.username} data-ai-hint="person face" />}
              <AvatarFallback className="text-4xl font-black bg-primary text-primary-foreground">
                {userProfile.username?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left space-y-4">
              <div className="space-y-1">
                <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">{userProfile.username}</h1>
                <p className="text-muted-foreground font-medium text-lg">{userProfile.email}</p>
              </div>
              
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                <Badge variant="secondary" className="rounded-sm font-bold uppercase text-xs h-7 px-3">
                  {userProfile.role}
                </Badge>
                <Badge variant={userProfile.registrationRequest ? 'destructive' : 'outline'} className="rounded-sm font-bold uppercase text-xs h-7 px-3">
                  {userProfile.registrationRequest ? 'Awaiting Approval' : 'Verified Personnel'}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md pt-2">
                <div className="flex items-center gap-3 p-3 rounded-md bg-background/50 border border-primary/5 shadow-sm">
                  <Smartphone className="h-4 w-4 text-primary" />
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Verified Mobile</span>
                    <span className="font-mono font-bold text-sm">{userProfile.mobile || 'N/A'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-md bg-amber-500/5 border border-amber-500/10 shadow-sm">
                  <Star className="h-4 w-4 text-amber-500" />
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-amber-700 uppercase tracking-widest">Performance X-Factor</span>
                    <span className="font-black text-amber-700 text-sm">{userProfile.pointsMultiplier || 1.0}x</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Performance Section (Refined Personal Stats Bar) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
            <Zap className="h-4 w-4 text-primary fill-primary" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Account Summary</h2>
        </div>
        <Card className="rounded-sm border-primary/10 overflow-hidden shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x border-b">
                <div className="p-6 bg-amber-500/[0.02]">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-amber-600 mb-1">
                            <Trophy className="h-4 w-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Points Bank</span>
                        </div>
                        <div className="text-4xl font-black text-amber-700 tracking-tighter">{userPoints.toFixed(2)}</div>
                        <p className="text-[10px] text-muted-foreground font-medium">Accumulated professional balance</p>
                    </div>
                </div>
                <div className="p-6 bg-green-500/[0.02]">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-green-600 mb-1">
                            <Coins className="h-4 w-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Rewards Value</span>
                        </div>
                        <div className="text-4xl font-black text-green-700 tracking-tighter">₹{monetaryValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        <p className="text-[10px] text-muted-foreground font-medium">Estimated conversion (1 Pt = ₹{pointValue})</p>
                    </div>
                </div>
                <div className="p-6 bg-primary/[0.02]">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-primary mb-1">
                            <Award className="h-4 w-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Global Ranking</span>
                        </div>
                        <div className="text-4xl font-black text-primary tracking-tighter">#{globalRank || '—'}</div>
                        <p className="text-[10px] text-muted-foreground font-medium">Overall platform percentile</p>
                    </div>
                </div>
            </div>
        </Card>
      </div>

      {/* Main Grid for reporting and authorized sites */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8">
          {userProfile.role === 'Site Engineer' && (
            <Card className="rounded-sm border-primary/10 shadow-sm overflow-hidden">
              <CardHeader className="bg-primary/5 py-3 border-b">
                <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-primary">
                  <UserCog className="h-4 w-4" /> Reporting Structure
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {managerProfile ? (
                  <div className="flex items-center gap-4 p-4 rounded-md border bg-card shadow-sm hover:border-primary/30 transition-all cursor-default">
                    <Avatar className="h-12 w-12 border">
                      <AvatarFallback className="text-sm font-bold bg-muted">{managerProfile.username?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">{managerProfile.username}</span>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Assigned Site Manager</span>
                      <span className="text-[10px] text-primary font-mono mt-1">{managerProfile.email}</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 bg-muted/20 border border-dashed rounded-sm text-center">
                    <p className="text-sm text-muted-foreground italic">No manager mapped. Please contact Admin.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {userProfile.role === 'Site Manager' && (
            <Card className="rounded-sm border-primary/10 shadow-sm overflow-hidden">
              <CardHeader className="bg-primary/5 py-3 border-b">
                <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-primary">
                  <Users className="h-4 w-4" /> My Team
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {teamMembers && teamMembers.length > 0 ? (
                  <Table>
                    <TableBody>
                      {teamMembers.map(member => (
                        <TableRow key={member.id} className="hover:bg-muted/5 transition-colors">
                          <TableCell className="py-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 border shadow-sm">
                                <AvatarFallback className="text-xs font-bold bg-muted">{member.username?.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-bold truncate">{member.username}</span>
                                <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">{member.role}</span>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-8 bg-muted/20 border border-dashed rounded-sm text-center m-6">
                    <p className="text-sm text-muted-foreground italic">No engineers currently report to you.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          <Card className="rounded-sm border-amber-500/10 bg-amber-500/5 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Award className="h-5 w-5 text-amber-500" />
              <h3 className="font-bold text-sm uppercase tracking-widest text-amber-700">Rewards Insight</h3>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground/80 font-medium">
              Your professional ranking is determined by the volume and quality of documentation submitted. 
              <strong className="text-amber-700 ml-1">Daily Progress Reports</strong>, <strong className="text-amber-700">Material Logs</strong>, 
              and <strong className="text-amber-700">Permit Accuracy</strong> directly impact your total points balance.
            </p>
          </Card>
        </div>

        <Card className="lg:col-span-2 rounded-sm border-primary/10 overflow-hidden shadow-md">
          <CardHeader className="bg-primary/5 py-3 border-b">
            <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-primary">
              <MapPin className="h-4 w-4" /> Authorized Site Access
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {assignedSites.length > 0 ? (
              <Table>
                <TableBody>
                  {assignedSites.map(site => (
                    <TableRow key={site.id} className="hover:bg-muted/5 transition-colors group">
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border shadow-sm">
                            <AvatarFallback className="text-xs font-bold bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                              <HardHat className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold truncate group-hover:text-primary transition-colors">{site.name}</span>
                            <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">Project Location</span>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-muted/10 rounded-sm border border-dashed m-6">
                <MapPin className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground font-medium">No sites currently assigned to your account.</p>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-tighter">Contact Administration for site mapping</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}