
"use client";

import * as React from "react";
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, setDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
import { collection, doc, increment, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Coins, UserCog, Search, Save, TrendingUp, Star, Loader2, HardHat, Settings2, RotateCcw, Plus, Minus, ShieldCheck, History, CheckCircle2, XCircle } from "lucide-react";
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
import { cn } from "@/lib/utils";

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

type PointRequest = {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  type: 'adjust' | 'clear';
  requestedById: string;
  requestedByName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
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
  const [isSubmittingRequest, setIsSubmittingRequest] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isSuperAdminUser = user?.email === 'khalil@adityagreenenergy.com';

  React.useEffect(() => {
    if (!isUserLoading && !isProfileLoading && !isAdmin) {
      router.replace('/ptw/raise');
    }
  }, [isUserLoading, isProfileLoading, isAdmin, router]);

  const settingsRef = useMemoFirebase(() => doc(firestore, 'system_settings', 'rewards'), [firestore]);
  const { data: settings } = useDoc<RewardSettings>(settingsRef);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers, isLoading: isUsersLoading } = useCollection<UserProfile>(usersQuery);

  const requestsQuery = useMemoFirebase(() => collection(firestore, 'point_adjustment_requests'), [firestore]);
  const { data: allRequests, isLoading: isRequestsLoading } = useCollection<PointRequest>(requestsQuery);

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

  const handleInitiateRequest = async (type: 'adjust' | 'clear') => {
    if (!selectedUserForPoints || !user || !userProfile) return;
    
    let amount = 0;
    if (type === 'adjust') {
      amount = parseFloat(adjustmentValue);
      if (isNaN(amount) || amount === 0) {
        toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Enter a non-zero number to adjust.' });
        return;
      }
    }

    setIsSubmittingRequest(true);
    try {
      await addDocumentNonBlocking(collection(firestore, 'point_adjustment_requests'), {
        userId: selectedUserForPoints.id,
        userName: selectedUserForPoints.username,
        amount: amount,
        type: type,
        requestedById: user.uid,
        requestedByName: userProfile.username || user.email || 'Admin',
        status: 'pending',
        createdAt: serverTimestamp()
      });

      toast({ 
        title: 'Request Logged', 
        description: `Adjustment for ${selectedUserForPoints.username} submitted for Super Admin approval.` 
      });
      setSelectedUserForPoints(null);
      setAdjustmentValue("");
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Request Failed', description: e.message });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleProcessRequest = async (req: PointRequest, action: 'approved' | 'rejected') => {
    if (!isSuperAdminUser || !user) return;

    try {
      const reqRef = doc(firestore, 'point_adjustment_requests', req.id);
      
      if (action === 'approved') {
        const userRef = doc(firestore, 'users', req.userId);
        if (req.type === 'clear') {
          updateDocumentNonBlocking(userRef, { totalPoints: 0 });
        } else {
          updateDocumentNonBlocking(userRef, { totalPoints: increment(req.amount) });
        }

        // Notify Target User
        addDocumentNonBlocking(collection(firestore, 'notifications'), {
          userId: req.userId,
          title: "Account Balance Adjusted",
          description: req.type === 'clear' ? "Your points balance has been reset to zero by administration." : `Your points balance was manually adjusted by ${Math.abs(req.amount).toFixed(2)} points.`,
          link: "/rewards",
          read: false,
          createdAt: serverTimestamp(),
        });
      }

      updateDocumentNonBlocking(reqRef, {
        status: action,
        processedAt: serverTimestamp(),
        processedById: user.uid
      });

      toast({ title: `Request ${action}`, description: `The point adjustment has been ${action}.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const pendingRequests = React.useMemo(() => {
    return allRequests?.filter(r => r.status === 'pending').sort((a, b) => {
      const da = a.createdAt?.toDate?.()?.getTime() || 0;
      const db = b.createdAt?.toDate?.()?.getTime() || 0;
      return db - da;
    }) || [];
  }, [allRequests]);

  const filteredUsers = React.useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(u => 
      u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
    ).sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
  }, [allUsers, userSearch]);

  if (isProfileLoading || isUsersLoading || isRequestsLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;

  if (!isAdmin) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
          <Coins className="h-8 w-8 text-amber-600" /> Rewards Administration
        </h1>
        <p className="text-muted-foreground">Configure the points economy and process manual performance adjustments.</p>
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

      {pendingRequests.length > 0 && (
        <Card className="w-full rounded-sm border-red-500/20 shadow-md overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
          <CardHeader className="bg-red-500/5 border-b flex flex-row items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-red-600" />
                <CardTitle className="text-red-700">Pending Approvals</CardTitle>
              </div>
              <CardDescription>Actions requiring Super Admin (khalil@adityagreenenergy.com) authorization.</CardDescription>
            </div>
            <Badge variant="destructive" className="rounded-sm h-6 px-3">{pendingRequests.length} Pending</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Target Personnel</TableHead>
                  <TableHead>Action Details</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead className="text-right px-6">Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map(req => (
                  <TableRow key={req.id}>
                    <TableCell>
                      <span className="font-bold text-sm">{req.userName}</span>
                    </TableCell>
                    <TableCell>
                      {req.type === 'clear' ? (
                        <Badge variant="outline" className="text-[10px] uppercase font-bold border-red-200 text-red-700 bg-red-50">Clear Balance</Badge>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("text-[10px] font-bold uppercase", req.amount > 0 ? "border-green-200 text-green-700 bg-green-50" : "border-amber-200 text-amber-700 bg-amber-50")}>
                            {req.amount > 0 ? `+${req.amount}` : req.amount} Points
                          </Badge>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">{req.requestedByName}</span>
                        <span className="text-[9px] text-muted-foreground uppercase">{req.createdAt ? format(req.createdAt.toDate(), 'dd MMM HH:mm') : 'N/A'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      {isSuperAdminUser ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="h-8 text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleProcessRequest(req, 'approved')}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleProcessRequest(req, 'rejected')}>
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">Waiting for Super Admin</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card className="w-full rounded-sm border-amber-500/10 shadow-md overflow-hidden">
        <CardHeader className="bg-amber-500/5 border-b flex flex-row items-center justify-between">
          <div className="space-y-1">
              <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-500" />
                  <CardTitle>Personnel X-Factors</CardTitle>
              </div>
              <CardDescription>Assign multipliers and initiate point adjustment requests.</CardDescription>
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
              Modifying points for <strong>{selectedUserForPoints?.username}</strong>. All requests require Super Admin approval.
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
                  onClick={() => handleInitiateRequest('adjust')}
                  disabled={isSubmittingRequest || !adjustmentValue}
                >
                  {isSubmittingRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : parseFloat(adjustmentValue) < 0 ? <Minus className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Submit
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground italic">Use negative numbers to deduct points.</p>
            </div>

            <div className="pt-4 border-t">
              <Button 
                variant="outline" 
                className="w-full rounded-sm font-bold border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all h-11"
                onClick={() => handleInitiateRequest('clear')}
                disabled={isSubmittingRequest}
              >
                {isSubmittingRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                Clear All Points (Request Reset)
              </Button>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" className="rounded-sm">Cancel</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
