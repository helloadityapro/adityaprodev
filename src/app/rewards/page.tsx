
"use client";

import * as React from "react";
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase";
import { collection, doc, query, orderBy, limit } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Coins, Award, TrendingUp, Medal, Star, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

type UserProfile = {
  id: string;
  username: string;
  email: string;
  role: string;
  totalPoints?: number;
  pointsMultiplier?: number;
};

type RewardSettings = {
  pointValueInRs?: number;
  ptwNoCorrection?: number;
  ptwWithCorrection?: number;
  movementEngineer?: number;
  movementManager?: number;
  dprEngineer?: number;
  dprManager?: number;
  taskAssignment?: number;
  taskCompletion?: number;
};

export default function RewardsPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  // Fetch current user's profile
  const userRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isUserLoading } = useDoc<UserProfile>(userRef);

  // Fetch global reward settings
  const settingsRef = useMemoFirebase(() => doc(firestore, 'system_settings', 'rewards'), [firestore]);
  const { data: settings } = useDoc<RewardSettings>(settingsRef);

  // Fetch top scorers for leaderboard
  const leadersQuery = useMemoFirebase(() => 
    query(collection(firestore, 'users'), orderBy('totalPoints', 'desc'), limit(10)), 
    [firestore]
  );
  const { data: leaders, isLoading: isLeadersLoading } = useCollection<UserProfile>(leadersQuery);

  const pointValue = settings?.pointValueInRs || 1;
  const userPoints = userProfile?.totalPoints || 0;
  const monetaryValue = userPoints * pointValue;

  if (isUserLoading || isLeadersLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
          <Trophy className="h-8 w-8 text-amber-500" /> Points Bank
        </h1>
        <p className="text-muted-foreground">Track your earned rewards and professional performance ranking.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-amber-500/5 border-amber-500/20 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-amber-600">Total Points</CardTitle>
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-amber-700">{userPoints.toFixed(2)}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold uppercase tracking-wider">Accumulated Balance</p>
          </CardContent>
        </Card>

        <Card className="bg-green-500/5 border-green-500/20 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-green-600">Estimated Value</CardTitle>
            <Coins className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-green-700">₹{monetaryValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold uppercase tracking-wider">1 Point = ₹{pointValue}</p>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-primary">Global Rank</CardTitle>
            <Award className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-primary">
              #{leaders && user ? (leaders.findIndex(l => l.id === user.uid) !== -1 ? leaders.findIndex(l => l.id === user.uid) + 1 : '—') : '—'}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold uppercase tracking-wider">Platform Percentile</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 rounded-sm overflow-hidden border-primary/10">
          <CardHeader className="bg-muted/5 border-b">
            <div className="flex items-center gap-2">
                <Medal className="h-5 w-5 text-amber-500" />
                <CardTitle>Performance Scoreboard</CardTitle>
            </div>
            <CardDescription>Top contributors based on site documentation and activity logs.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-16 text-center">Rank</TableHead>
                  <TableHead>Personnel</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right px-2">Total Points</TableHead>
                  <TableHead className="text-right px-6">Earned Reward</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaders?.map((leader, index) => (
                  <TableRow key={leader.id} className={cn("hover:bg-muted/5 transition-colors", leader.id === user?.uid && "bg-primary/5 font-bold")}>
                    <TableCell className="text-center font-mono">
                        {index === 0 ? <Trophy className="h-5 w-5 text-amber-500 mx-auto" /> : 
                         index === 1 ? <Medal className="h-5 w-5 text-slate-400 mx-auto" /> :
                         index === 2 ? <Medal className="h-5 w-5 text-amber-700 mx-auto" /> :
                         index + 1}
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 border">
                                <AvatarFallback className="text-[10px]">{leader.username?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <span className="text-sm">{leader.username}</span>
                                <span className="text-[9px] text-muted-foreground uppercase">{leader.email}</span>
                            </div>
                        </div>
                    </TableCell>
                    <TableCell>
                        <Badge variant="outline" className="text-[10px] rounded-sm py-0 h-5 font-bold uppercase border-primary/20">
                            {leader.role}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right px-2 font-mono text-primary">
                        {(leader.totalPoints || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right px-6 font-bold text-green-700">
                        ₹{((leader.totalPoints || 0) * pointValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
            <Card className="rounded-sm border-primary/10">
                <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase text-primary">Current Points System</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-medium">PtW (No Correction)</span>
                            <Badge className="bg-green-100 text-green-800 border-green-200">+{settings?.ptwNoCorrection?.toFixed(2) || '1.00'}</Badge>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-medium">PtW (With Correction)</span>
                            <Badge className="bg-blue-100 text-blue-800 border-blue-200">+{settings?.ptwWithCorrection?.toFixed(2) || '0.50'}</Badge>
                        </div>
                        <Separator className="my-1 opacity-50" />
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-medium">Movement Log (Engineer)</span>
                            <Badge className="bg-slate-100 text-slate-800 border-slate-200">+{settings?.movementEngineer?.toFixed(2) || '0.10'}</Badge>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-medium">Movement Log (Manager)</span>
                            <Badge className="bg-slate-50 text-slate-600 border-slate-100">+{settings?.movementManager?.toFixed(2) || '0.05'}</Badge>
                        </div>
                        <Separator className="my-1 opacity-50" />
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-medium">DPR Submission (Engineer)</span>
                            <Badge className="bg-slate-100 text-slate-800 border-slate-200">+{settings?.dprEngineer?.toFixed(2) || '0.10'}</Badge>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-medium">DPR Submission (Manager)</span>
                            <Badge className="bg-slate-50 text-slate-600 border-slate-100">+{settings?.dprManager?.toFixed(2) || '0.05'}</Badge>
                        </div>
                        <Separator className="my-1 opacity-50" />
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-medium">Task Assignment (Assigner)</span>
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200">+{settings?.taskAssignment?.toFixed(2) || '0.10'}</Badge>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-medium">Task Completion (Assignee)</span>
                            <Badge className="bg-green-100 text-green-800 border-green-200">+{settings?.taskCompletion?.toFixed(2) || '0.10'}</Badge>
                        </div>
                    </div>
                    <Separator />
                    <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-sm border border-primary/10">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <div className="text-[10px] leading-relaxed italic text-muted-foreground">
                            Rewards are dynamically adjusted by project administration based on site documentation goals.
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="rounded-sm border-amber-500/20 bg-amber-500/5">
                <CardHeader>
                    <CardTitle className="text-xs font-bold uppercase text-amber-700">Account Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Multiplier (X-Factor)</span>
                        <span className="font-bold text-amber-700">{userProfile?.pointsMultiplier || 1.0}x</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Verification Rank</span>
                        <span className="font-bold text-amber-700">Active Holder</span>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
