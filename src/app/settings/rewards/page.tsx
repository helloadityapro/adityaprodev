"use client";

import * as React from "react";
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, setDocumentNonBlocking } from "@/firebase";
import { collection, doc, increment } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Coins, UserCog, Search, Save, TrendingUp, Star, Loader2, HardHat, Settings2, RotateCcw, Plus, Minus, ShieldCheck, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isSuperAdmin } from "@/lib/auth-constants";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "@/components/ui/dialog";
import { initiatePointsOtp, verifyPointsOtp } from "@/ai/flows/otp-flows";

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
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [pointValueInput, setPointValueInput] = React.useState<string>("1");
  const [userSearch, setUserSearch] = React.useState("");
  const [isUpdatingGlobal, setIsUpdatingGlobal] = React.useState(false);
  
  // Manual Point Adjustment States
  const [selectedUserForPoints, setSelectedUserForPoints] = React.useState<UserProfile | null>(null);
  const [adjustmentValue, setAdjustmentValue] = React.useState<string>("");
  const [pendingActionType, setPendingActionType] = React.useState<'adjust' | 'clear' | null>(null);
  
  // 2FA States
  const [isOtpDialogOpen, setIsOtpDialogOpen] = React.useState(false);
  const [otpCode, setOtpCode] = React.useState("");
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isInitiatingOtp, setIsInitiatingOtp] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  React.useEffect(() => {
    if (!isUserLoading && !isProfileLoading && !isAdmin) {
      router.replace('/ptw/raise');
    }
  }, [isUserLoading, isProfileLoading, isAdmin, router]);

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

  const handleInitiateManualAdjustment = (type: 'adjust' | 'clear') => {
    if (!selectedUserForPoints) return;
    
    if (type === 'adjust') {
      const val = parseFloat(adjustmentValue);
      if (isNaN(val) || val === 0) {
        toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Enter a non-zero number to adjust.' });
        return;
      }
    }

    setPendingActionType(type);
    start2FA();
  };

  const start2FA = async () => {
    setIsInitiatingOtp(true);
    const res = await initiatePointsOtp();
    if (res.success) {
      toast({ title: 'Security OTP Requested', description: res.message });
      setIsOtpDialogOpen(true);
    } else {
      toast({ variant: 'destructive', title: 'Action Blocked', description: res.message });
    }
    setIsInitiatingOtp(false);
  };

  const handleVerifyAndExecute = async () => {
    if (otpCode.length !== 6) return;
    setIsVerifying(true);
    
    const verifyRes = await verifyPointsOtp(otpCode);
    if (verifyRes.success) {
      executeManualPointAdjustment();
      setIsOtpDialogOpen(false);
      setOtpCode("");
    } else {
      toast({ variant: 'destructive', title: 'Verification Failed', description: verifyRes.message });
    }
    setIsVerifying(false);
  };

  const executeManualPointAdjustment = () => {
    if (!selectedUserForPoints || !pendingActionType) return;

    const userRef = doc(firestore, 'users', selectedUserForPoints.id);

    if (pendingActionType === 'clear') {
      updateDocumentNonBlocking(userRef, { totalPoints: 0 });
      toast({ variant: 'success', title: 'Points Cleared', description: `Balance reset to zero for ${selectedUserForPoints.username}.` });
    } else {
      const val = parseFloat(adjustmentValue);
      updateDocumentNonBlocking(userRef, { totalPoints: increment(val) });
      toast({ 
        variant: 'success',
        title: val > 0 ? 'Points Added' : 'Points Deducted', 
        description: `${Math.abs(val)} points ${val > 0 ? 'added to' : 'deducted from'} ${selectedUserForPoints.username}'s account.` 
      });
    }

    setSelectedUserForPoints(null);
    setAdjustmentValue("");
    setPendingActionType(null);
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

      <Card className="w-full rounded-sm border-primary/10 shadow-md">
        <CardHeader className="bg-primary/5 border-b py-4">
          <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle>Global Point Value</CardTitle>
          </div>
          <CardDescription>Define the monetary value of one reward point.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1 space-y-2 w-full">
              <Label htmlFor="point-value" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Value in Rupees (₹)</Label>
              <div className="flex gap-2">
                <Input 
                  id="point-value" 
                  type="number" 
                  step="0.1" 
                  value={pointValueInput} 
                  onChange={(e) => setPointValueInput(e.target.value)}
                  className="rounded-sm font-mono font-bold text-lg h-11"
                />
                <Button onClick={handleUpdatePointValue} disabled={isUpdatingGlobal} className="rounded-sm font-bold h-11 px-8">
                  {isUpdatingGlobal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Set Value
                </Button>
              </div>
            </div>
            <div className="flex-1 p-4 bg-muted/30 border border-dashed rounded-sm text-xs leading-relaxed italic text-muted-foreground">
                <span className="font-bold text-primary mr-1">Note:</span>
                Changes to this value will immediately reflect in all users' Point Bank calculations across the entire platform.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full rounded-sm border-amber-500/10 shadow-md overflow-hidden">
        <CardHeader className="bg-amber-500/5 border-b flex flex-row items-center justify-between">
          <div className="space-y-1">
              <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-500" />
                  <CardTitle>Personnel X-Factors</CardTitle>
              </div>
              <CardDescription>Assign multipliers and manually adjust point balances.</CardDescription>
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
                <TableHead className="text-center">X-Factor</TableHead>
                <TableHead className="text-right px-6">Actions</TableHead>
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
                  <TableCell className="text-center">
                      <div className="flex justify-center items-center gap-1">
                          <Input 
                              type="number" 
                              step="0.1" 
                              min="0.1"
                              defaultValue={u.pointsMultiplier || 1.0}
                              className="w-16 h-7 text-right font-bold text-amber-700 bg-amber-50 border-amber-200 rounded-sm text-xs"
                              onBlur={(e) => handleUpdateUserMultiplier(u.id, parseFloat(e.target.value))}
                          />
                          <span className="text-[10px] font-bold text-amber-700">x</span>
                      </div>
                  </TableCell>
                  <TableCell className="text-right px-6">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-[10px] font-bold rounded-sm border-primary/20 hover:bg-primary/5"
                        onClick={() => setSelectedUserForPoints(u)}
                      >
                        <Settings2 className="h-3 w-3 mr-1" /> Adjust Points
                      </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Manual Adjustment Dialog */}
      <Dialog open={!!selectedUserForPoints} onOpenChange={(o) => !o && setSelectedUserForPoints(null)}>
        <DialogContent className="max-w-md rounded-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" /> Manual Point Adjustment
            </DialogTitle>
            <DialogDescription>
              Modifying points for <strong>{selectedUserForPoints?.username}</strong>. Secure authorization is required.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6 space-y-6">
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-sm border border-dashed">
              <span className="text-xs font-bold uppercase text-muted-foreground">Current Balance</span>
              <span className="text-xl font-black text-primary font-mono">{(selectedUserForPoints?.totalPoints || 0).toFixed(2)}</span>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wider">Adjustment Amount</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input 
                    type="number" 
                    step="0.1"
                    placeholder="Enter amount (e.g. 5 or -5)"
                    value={adjustmentValue}
                    onChange={(e) => setAdjustmentValue(e.target.value)}
                    className="rounded-sm font-mono h-11"
                  />
                </div>
                <Button 
                  className="rounded-sm font-bold px-6 h-11"
                  onClick={() => handleInitiateManualAdjustment('adjust')}
                  disabled={isInitiatingOtp || !adjustmentValue}
                >
                  {isInitiatingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : parseFloat(adjustmentValue) < 0 ? <Minus className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Apply
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground italic">Use negative numbers to deduct points.</p>
            </div>

            <div className="pt-4 border-t">
              <Button 
                variant="outline" 
                className="w-full rounded-sm font-bold border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all h-11"
                onClick={() => handleInitiateManualAdjustment('clear')}
                disabled={isInitiatingOtp}
              >
                {isInitiatingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                Clear All Points (Reset to 0)
              </Button>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" className="rounded-sm">Cancel</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OTP Verification Dialog */}
      <Dialog open={isOtpDialogOpen} onOpenChange={(o) => !o && setIsOtpDialogOpen(false)}>
        <DialogContent className="max-w-md rounded-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <ShieldCheck className="h-5 w-5" /> Authorize Transaction
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-sm text-muted-foreground">
                <span>A 6-digit security code has been sent to <strong>khalil@adityagreenenergy.com</strong>. Enter it below to authorize this point modification.</span>
                <span className="block mt-2 text-xs font-semibold text-primary">Note: Check server console logs for the code during this prototype phase.</span>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2 text-center">
              <Label htmlFor="otp-input" className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Security Code</Label>
              <Input 
                id="otp-input" 
                placeholder="000000" 
                maxLength={6} 
                className="text-center text-3xl font-mono tracking-[0.5em] h-16 rounded-sm bg-muted/30 border-2 focus-visible:ring-primary" 
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-sm" onClick={() => setIsOtpDialogOpen(false)}>Cancel</Button>
            <Button 
              className="rounded-sm font-bold flex-1 h-11" 
              disabled={otpCode.length !== 6 || isVerifying}
              onClick={handleVerifyAndExecute}
            >
              {isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <><KeyRound className="mr-2 h-4 w-4" /> Confirm & Process</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
