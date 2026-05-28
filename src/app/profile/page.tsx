'use client';

import * as React from 'react';
import { useUser, useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trophy, Star, Award, Coins, MapPin, ShieldCheck, UserCog, TrendingUp, HardHat, Smartphone, Zap, Users, Calendar, Fingerprint, CreditCard, ChevronRight, Building2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import Link from 'next/link';

type UserProfile = {
  id: string;
  username: string;
  email: string;
  role: string;
  mobile: string;
  dob?: string;
  doj?: string;
  aadharNumber?: string;
  panNumber?: string;
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

type MappingOverride = {
  id: string;
  engineerId: string;
  siteId: string;
  managerId: string;
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

  // 3. Fetch all users to calculate rank and resolve managers
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

  // 6. Fetch all site-specific overrides
  const overridesQuery = useMemoFirebase(() => collection(firestore, 'team_mapping_overrides'), [firestore]);
  const { data: allOverrides } = useCollection<MappingOverride>(overridesQuery);

  // 7. Fetch all sites to map assigned IDs
  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const globalRank = React.useMemo(() => {
    if (!allUsers || !user) return null;
    const index = allUsers.findIndex(u => u.id === user.uid);
    return index !== -1 ? index + 1 : null;
  }, [allUsers, user]);

  const assignedSites = React.useMemo(() => {
    if (!allSites || !userProfile) return [];
    
    // Strict Sovereignty Calculation
    const siteIds = new Set<string>();

    if (userProfile.role === 'Site Manager') {
      // 1. Sites where this manager is an explicit override
      allOverrides?.filter(o => o.managerId === userProfile.id).forEach(o => {
        siteIds.add(o.siteId);
      });

      // 2. Sites where this manager is the default supervisor for an engineer
      // AND that engineer has NO site-specific override pointing to someone else
      if (teamMembers) {
        teamMembers.forEach(member => {
          (member.assignedProjectIds || []).forEach(sid => {
            const hasOtherOverride = allOverrides?.some(o => o.engineerId === member.id && o.siteId === sid && o.managerId !== userProfile.id);
            if (!hasOtherOverride) {
              siteIds.add(sid);
            }
          });
        });
      }
    } else {
      // Engineers just see their direct assignments
      (userProfile.assignedProjectIds || []).forEach(id => siteIds.add(id));
    }

    return allSites.filter(s => siteIds.has(s.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [userProfile, allSites, teamMembers, allOverrides]);

  const userOverrides = React.useMemo(() => {
    if (!allOverrides || !user) return [];
    return allOverrides.filter(o => o.engineerId === user.uid);
  }, [allOverrides, user]);

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
    <div className="space-y-8 pb-20">
      {/* Top Hero Section */}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Credentials Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
                <ShieldCheck className="h-4 w-4 text-primary fill-primary" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Official Credentials</h2>
            </div>
            <Card className="rounded-sm border-primary/10 overflow-hidden shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="bg-muted/10 w-1/3 py-4 px-6">
                        <div className="flex items-center gap-3">
                          <Calendar className="h-4 w-4 text-primary" />
                          <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Date of Birth</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-6 font-bold text-sm">
                        {userProfile.dob ? format(new Date(userProfile.dob), 'dd MMMM yyyy') : '—'}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="bg-muted/10 py-4 px-6">
                        <div className="flex items-center gap-3">
                          <Calendar className="h-4 w-4 text-primary" />
                          <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Date of Joining</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-6 font-bold text-sm">
                        {userProfile.doj ? format(new Date(userProfile.doj), 'dd MMMM yyyy') : '—'}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="bg-muted/10 py-4 px-6">
                        <div className="flex items-center gap-3">
                          <Fingerprint className="h-4 w-4 text-primary" />
                          <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Aadhar Number</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-6 font-mono font-bold text-sm">
                        {userProfile.aadharNumber || '—'}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="bg-muted/10 py-4 px-6">
                        <div className="flex items-center gap-3">
                          <CreditCard className="h-4 w-4 text-primary" />
                          <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">PAN Number</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-6 font-mono font-bold text-sm uppercase">
                        {userProfile.panNumber || '—'}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Performance Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
                <Zap className="h-4 w-4 text-primary fill-primary" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Performance Summary</h2>
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
                        </div>
                    </div>
                    <div className="p-6 bg-green-500/[0.02]">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-green-600 mb-1">
                                <Coins className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Rewards Value</span>
                            </div>
                            <div className="text-4xl font-black text-green-700 tracking-tighter">₹{monetaryValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        </div>
                    </div>
                    <div className="p-6 bg-primary/[0.02]">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-primary mb-1">
                                <Award className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Global Rank</span>
                            </div>
                            <div className="text-4xl font-black text-primary tracking-tighter">#{globalRank || '—'}</div>
                        </div>
                    </div>
                </div>
            </Card>
          </div>
        </div>

        <div className="space-y-8">
          {/* Hierarchy Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
                <UserCog className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Team & Supervisors</h2>
            </div>
            <Card className="rounded-sm border-primary/10 shadow-sm overflow-hidden">
                <CardHeader className="bg-primary/5 py-3 border-b">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Primary Manager</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {managerProfile ? (
                        <div className="py-4 px-6 flex items-center gap-3">
                            <Avatar className="h-10 w-10 border shadow-sm">
                                <AvatarFallback className="text-xs font-bold bg-muted">{managerProfile.username?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-bold truncate">{managerProfile.username}</span>
                                <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">Main Reporting Supervisor</span>
                            </div>
                        </div>
                    ) : (
                        <div className="p-8 text-center"><p className="text-xs italic text-muted-foreground">No global manager assigned.</p></div>
                    )}
                </CardContent>

                {userOverrides && userOverrides.length > 0 && (
                    <div className="border-t">
                        <div className="bg-amber-500/5 px-6 py-2 border-b">
                            <span className="text-[8px] font-black uppercase tracking-widest text-amber-700">Site Specific Supervisors</span>
                        </div>
                        <div className="divide-y max-h-[200px] overflow-y-auto">
                            {userOverrides.map(override => {
                                const site = allSites?.find(s => s.id === override.siteId);
                                const manager = allUsers?.find(u => u.id === override.managerId);
                                return (
                                    <div key={override.id} className="py-2.5 px-6 flex items-center justify-between hover:bg-muted/5 transition-colors">
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[10px] font-black text-foreground truncate">{site?.name || 'Unknown Site'}</span>
                                            <span className="text-[9px] font-bold text-primary uppercase">{manager?.username || 'Specific Manager'}</span>
                                        </div>
                                        <Badge variant="outline" className="text-[7px] font-black uppercase h-3 px-1 border-amber-200 text-amber-700 bg-amber-50">Specific</Badge>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </Card>

            {userProfile.role === 'Site Manager' && teamMembers && teamMembers.length > 0 && (
                <Card className="rounded-sm border-primary/10 shadow-sm overflow-hidden">
                    <CardHeader className="bg-primary/5 py-3 border-b">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Direct Team Members</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y max-h-[300px] overflow-y-auto">
                            {teamMembers.map(member => (
                                <div key={member.id} className="py-3 px-6 flex items-center gap-3 hover:bg-muted/5 transition-colors">
                                    <Avatar className="h-8 w-8 border shadow-sm">
                                        <AvatarFallback className="text-[10px] font-bold bg-muted">{member.username?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-xs font-bold truncate">{member.username}</span>
                                        <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-tight">{member.role}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
          </div>

          {/* Assigned Projects Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
                <MapPin className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Project Access</h2>
            </div>
            <Card className="rounded-sm border-primary/10 overflow-hidden shadow-md">
                <CardContent className="p-0">
                    {assignedSites.length > 0 ? (
                        <div className="divide-y max-h-[350px] overflow-y-auto">
                            {assignedSites.map(site => (
                                <Link key={site.id} href={`/projects/${site.id}`} className="py-3 px-6 flex items-center justify-between hover:bg-muted/5 transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <Building2 className="h-3.5 w-3.5 text-primary opacity-40 group-hover:opacity-100 transition-opacity" />
                                        <span className="text-xs font-bold truncate group-hover:text-primary transition-colors">{site.name}</span>
                                    </div>
                                    <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary transition-all" />
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="p-10 text-center italic text-xs text-muted-foreground uppercase tracking-widest font-bold opacity-30">No site assignments active.</div>
                    )}
                </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
