
"use client";

import * as React from "react";
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, setDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Coins, UserCog, Search, Save, TrendingUp, Star, Loader2, HardHat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isSuperAdmin } from "@/lib/auth-constants";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type UserProfile = {
  id: string;
  username: string;
  email: string;
  role: string;
  pointsMultiplier?: number;
  totalPoints?: number;
};

type RewardSettings = {
  pointValueInRs?: number;
};

export default function AdminRewardsSettingsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [pointValueInput, setPointValueInput] = React.useState<string>("1");
  const [userSearch, setUserSearch] = React.useState("");
  const [isUpdatingGlobal, setIsUpdatingGlobal] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  React.useEffect(() => {
    if (!isProfileLoading && !isAdmin) {
      router.replace('/ptw/raise');
    }
  }, [isProfileLoading, isAdmin, router]);

  const settingsRef = useMemoFirebase(() => doc(firestore, 'system_settings', 'rewards'), [firestore]);
  const { data: settings } = useDoc<RewardSettings>(settingsRef);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers, isLoading: isUsersLoading } = useCollection<UserProfile>(usersQuery);

  React.useEffect(() => {
    if (settings?.pointValueInRs !== undefined) {
      setPointValueInput(settings.pointValueInRs.toString());
    }
  }, [settings]);

  const handleUpdatePointValue = () => {
    const val = parseFloat(pointValueInput);
    if (isNaN(val) || val <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Value', description: 'Please enter a valid positive number.' });
      return;
    }
    setIsUpdatingGlobal(true);
    setDocumentNonBlocking(settingsRef, { pointValueInRs: val }, { merge: true });
    toast({ title: 'Settings Updated', description: `1 Point is now worth ₹${val}.` });
    setIsUpdatingGlobal(false);
  };

  const handleUpdateUserMultiplier = (userId: string, multiplier: number) => {
    if (isNaN(multiplier) || multiplier < 0.1) return;
    updateDocumentNonBlocking(doc(firestore, 'users', userId), {
      pointsMultiplier: multiplier
    });
    toast({ title: 'Multiplier Updated', description: `Performance X-Factor set to ${multiplier}x.` });
  };

  const filteredUsers = React.useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(u => 
      u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
    ).sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
  }, [allUsers, userSearch]);

  if (isProfileLoading || isUsersLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;

  if (!isAdmin) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
          <Coins className="h-8 w-8 text-amber-600" /> Rewards Administration
        </h1>
        <p className="text-muted-foreground">Configure the points economy and assign performance multipliers.</p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <Card className="md:col-span-1 rounded-sm border-primary/10 shadow-md">
          <CardHeader className="bg-primary/5 border-b">
            <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <CardTitle>Global Point Value</CardTitle>
            </div>
            <CardDescription>Define the monetary value of one reward point.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="point-value" className="text-xs font-bold uppercase tracking-wider">Value in Rupees (₹)</Label>
              <div className="flex gap-2">
                <Input 
                  id="point-value" 
                  type="number" 
                  step="0.1" 
                  value={pointValueInput} 
                  onChange={(e) => setPointValueInput(e.target.value)}
                  className="rounded-sm font-mono font-bold text-lg"
                />
                <Button onClick={handleUpdatePointValue} disabled={isUpdatingGlobal} className="rounded-sm font-bold">
                  {isUpdatingGlobal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Set Value
                </Button>
              </div>
            </div>
            <div className="p-4 bg-muted/30 border border-dashed rounded-sm text-[10px] leading-relaxed italic text-muted-foreground">
                Changes to this value will immediately reflect in all users' Point Bank calculations across the platform.
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 rounded-sm border-amber-500/10 shadow-md overflow-hidden">
          <CardHeader className="bg-amber-500/5 border-b flex flex-row items-center justify-between">
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-amber-500" />
                    <CardTitle>Personnel X-Factors</CardTitle>
                </div>
                <CardDescription>Assign multipliers to top-tier site engineers and managers.</CardDescription>
            </div>
            <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search users..." 
                    className="h-9 pl-8 text-xs rounded-sm bg-background border-primary/10" 
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>User Profile</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-center">Current Points</TableHead>
                  <TableHead className="text-right px-6">X-Factor Multiplier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map(u => (
                  <TableRow key={u.id} className="hover:bg-muted/5 group">
                    <TableCell>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold">{u.username}</span>
                            <span className="text-[10px] text-muted-foreground">{u.email}</span>
                        </div>
                    </TableCell>
                    <TableCell>
                        <Badge variant="secondary" className="text-[10px] rounded-sm uppercase font-bold py-0 h-5">
                            {u.role === 'Site Engineer' ? <HardHat className="h-3 w-3 mr-1" /> : <UserCog className="h-3 w-3 mr-1" />}
                            {u.role}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono text-primary font-bold">
                        {(u.totalPoints || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right px-6">
                        <div className="flex justify-end items-center gap-2">
                            <Input 
                                type="number" 
                                step="0.1" 
                                min="0.1"
                                defaultValue={u.pointsMultiplier || 1.0}
                                className="w-20 h-8 text-right font-bold text-amber-700 bg-amber-50 border-amber-200 rounded-sm"
                                onBlur={(e) => handleUpdateUserMultiplier(u.id, parseFloat(e.target.value))}
                            />
                            <span className="text-xs font-bold text-amber-700">x</span>
                        </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
