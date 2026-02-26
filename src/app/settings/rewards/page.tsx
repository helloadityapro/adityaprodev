
"use client";

import * as React from "react";
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, setDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
import { collection, doc, increment, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Coins, UserCog, Search, Save, TrendingUp, Star, Loader2, HardHat, Settings2, RotateCcw, Plus, Minus, ShieldCheck, History, CheckCircle2, XCircle, LayoutGrid, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isSuperAdmin } from "@/lib/auth-constants";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
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
import { ScrollArea } from "@/components/ui/scroll-area";

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
  ptwNoCorrection?: number;
  ptwWithCorrection?: number;
  movementEngineer?: number;
  movementManager?: number;
  dprEngineer?: number;
  dprManager?: number;
  taskAssignment?: number;
  taskCompletion?: number;
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
  const [isUpdatingRates, setIsUpdatingRates] = React.useState(false);
  
  // Manual Point Adjustment States
  const [selectedUserForPoints, setSelectedUserForPoints] = React.useState<UserProfile | null>(null);
  const [adjustmentValue, setAdjustmentValue] = React.useState<string>("");
  const [isSubmittingRequest, setIsSubmittingRequest] = React.useState(false);

  // Rate States
  const [rates, setRates] = React.useState<Partial<RewardSettings>>({
    ptwNoCorrection: 1.0,
    ptwWithCorrection: 0.5,
    movementEngineer: 0.1,
    movementManager: 0.05,
    dprEngineer: 0.1,
    dprManager: 0.05,
    taskAssignment: 0.1,
    taskCompletion: 0.1
  });

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
    if (settings) {
      if (settings.pointValueInRs !== undefined) setPointValueInput(settings.pointValueInRs.toString());
      setRates({
        ptwNoCorrection: settings.ptwNoCorrection ?? 1.0,
        ptwWithCorrection: settings.ptwWithCorrection ?? 0.5,
        movementEngineer: settings.movementEngineer ?? 0.1,
        movementManager: settings.movementManager ?? 0.05,
        dprEngineer: settings.dprEngineer ?? 0.1,
        dprManager: settings.dprManager ?? 0.05,
        taskAssignment: settings.taskAssignment ?? 0.1,
        taskCompletion: settings.taskCompletion ?? 0.1
      });
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

  const handleUpdateRates = () => {
    setIsUpdatingRates(true);
    setDocumentNonBlocking(settingsRef, { ...rates }, { merge: true });
    toast({ title: 'Reward Rates Updated', description: 'New activity point values are now active across the platform.' });
    setIsUpdatingRates(false);
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

  if (isProfileLoading || isUsersLoading || isRequestsLoading || isUserLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;

  if (!isAdmin) return null;

  return (
    <div className="space-y-8 pb-20 max-w-5xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
          <Coins className="h-8 w-8 text-amber-600" /> Rewards Administration
        </h1>
        <p className="text-muted-foreground">Configure the points economy and process manual performance adjustments.</p>
      </div>

      <div className="flex flex-col gap-8">
        {/* Section 1: Global Point Value */}
        <Card className="w-full rounded-sm border-primary/10 shadow-md">
          <CardHeader className="bg-primary/5 border-b py-4">
            <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <CardTitle>Global Point Value</CardTitle>
            </div>
            <CardDescription>Define the monetary value of one reward point.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="point-value" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Value in Rupees (₹)</Label>
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
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Activity Reward Rates */}
        <Card className="w-full rounded-sm border-amber-500/10 shadow-md">
          <CardHeader className="bg-amber-500/5 border-b py-4">
            <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-600" />
                <CardTitle>Activity Reward Rates</CardTitle>
            </div>
            <CardDescription>Set how many points are awarded for specific site actions.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-primary border-b pb-1">Permit to Work</h3>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold">PtW (No Correction)</Label>
                  <Input type="number" step="0.05" value={rates.ptwNoCorrection} onChange={e => setRates({...rates, ptwNoCorrection: parseFloat(e.target.value)})} className="h-9 rounded-sm font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold">PtW (With Correction)</Label>
                  <Input type="number" step="0.05" value={rates.ptwWithCorrection} onChange={e => setRates({...rates, ptwWithCorrection: parseFloat(e.target.value)})} className="h-9 rounded-sm font-mono" />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-primary border-b pb-1">Documentation</h3>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold">DPR (Engineer)</Label>
                  <Input type="number" step="0.01" value={rates.dprEngineer} onChange={e => setRates({...rates, dprEngineer: parseFloat(e.target.value)})} className="h-9 rounded-sm font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold">DPR (Manager)</Label>
                  <Input type="number" step="0.01" value={rates.dprManager} onChange={e => setRates({...rates, dprManager: parseFloat(e.target.value)})} className="h-9 rounded-sm font-mono" />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-primary border-b pb-1">Materials</h3>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold">Movement (Engineer)</Label>
                  <Input type="number" step="0.01" value={rates.movementEngineer} onChange={e => setRates({...rates, movementEngineer: parseFloat(e.target.value)})} className="h-9 rounded-sm font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold">Movement (Manager)</Label>
                  <Input type="number" step="0.01" value={rates.movementManager} onChange={e => setRates({...rates, movementManager: parseFloat(e.target.value)})} className="h-9 rounded-sm font-mono" />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-primary border-b pb-1">Tasks</h3>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold">Assignment (Assigner)</Label>
                  <Input type="number" step="0.01" value={rates.taskAssignment} onChange={e => setRates({...rates, taskAssignment: parseFloat(e.target.value)})} className="h-9 rounded-sm font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold">Completion (Assignee)</Label>
                  <Input type="number" step="0.01" value={rates.taskCompletion} onChange={e => setRates({...rates, taskCompletion: parseFloat(e.target.value)})} className="h-9 rounded-sm font-mono" />
                </div>
              </div>
            </div>
            <Button onClick={handleUpdateRates} disabled={isUpdatingRates} className="w-full rounded-sm font-bold h-11 bg-primary hover:bg-primary/90">
              {isUpdatingRates ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Update Reward Economy
            </Button>
          </CardContent>
        </Card>

        {/* Section 3: Approvals Required (Conditional) */}
        {pendingRequests.length > 0 && (
          <Card className="w-full rounded-sm border-red-500/20 shadow-md overflow-hidden">
            <CardHeader className="bg-red-500/5 border-b flex flex-row items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-red-600" />
                  <CardTitle className="text-red-700">Manual Adjustments Awaiting Approval</CardTitle>
                </div>
                <CardDescription>Sensitive performance adjustments requiring Super Admin oversight.</CardDescription>
              </div>
              <Badge variant="destructive" className="rounded-sm">{pendingRequests.length} Pending</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[250px]">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="px-6">Personnel</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className="text-right px-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRequests.map(req => (
                      <TableRow key={req.id}>
                        <TableCell className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">{req.userName}</span>
                            <span className="text-[10px] uppercase text-muted-foreground">Requested By {req.requestedByName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {req.type === 'clear' ? (
                            <Badge variant="outline" className="text-[9px] uppercase border-red-200 text-red-700">Clear Balance</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] uppercase border-blue-200 text-blue-700">Adjustment</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={cn("font-mono font-bold", req.amount >= 0 ? "text-green-600" : "text-red-600")}>
                            {req.amount > 0 ? `+${req.amount.toFixed(2)}` : req.amount.toFixed(2)} Pts
                          </span>
                        </TableCell>
                        <TableCell className="text-right px-6">
                          {isSuperAdminUser ? (
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-50" onClick={() => handleProcessRequest(req, 'approved')}><CheckCircle2 className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => handleProcessRequest(req, 'rejected')}><XCircle className="h-4 w-4" /></Button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">Awaiting Super Admin...</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Section 4: Personnel Performance */}
        <Card className="w-full rounded-sm border-primary/10 shadow-md overflow-hidden">
          <CardHeader className="bg-muted/5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-primary" />
                    <CardTitle>Personnel Performance Scoreboard</CardTitle>
                </div>
                <CardDescription>Assign performance multipliers (X-Factors) and trigger manual adjustments.</CardDescription>
            </div>
            <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search personnel..." className="h-10 pl-9 text-sm rounded-sm" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-6">User</TableHead>
                    <TableHead className="text-center">Current Points</TableHead>
                    <TableHead className="text-center">X-Factor (Multiplier)</TableHead>
                    <TableHead className="text-right px-6">Management</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(u => (
                    <TableRow key={u.id} className="hover:bg-muted/5 transition-colors">
                      <TableCell className="px-6">
                          <div className="flex flex-col">
                              <span className="font-bold text-sm">{u.username}</span>
                              <span className="text-[10px] text-muted-foreground uppercase tracking-tight">{u.role}</span>
                          </div>
                      </TableCell>
                      <TableCell className="text-center font-mono font-black text-primary">{(u.totalPoints || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Input 
                                type="number" step="0.1" min="0.1" defaultValue={u.pointsMultiplier || 1.0}
                                className="w-16 h-8 text-center font-bold text-amber-700 bg-amber-50 border-amber-200 rounded-sm text-xs"
                                onBlur={(e) => handleUpdateUserMultiplier(u.id, parseFloat(e.target.value))}
                            />
                            <span className="text-xs font-bold text-muted-foreground">x</span>
                          </div>
                      </TableCell>
                      <TableCell className="text-right px-6">
                          <Button variant="outline" size="sm" className="h-8 rounded-sm text-xs font-bold border-primary/20 hover:bg-primary hover:text-white transition-all" onClick={() => setSelectedUserForPoints(u)}>
                            <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Adjust
                          </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Manual Adjustment Dialog */}
      <Dialog open={!!selectedUserForPoints} onOpenChange={(o) => !o && setSelectedUserForPoints(null)}>
        <DialogContent className="max-w-md rounded-sm">
          <DialogHeader>
            <DialogTitle>Manual Point Adjustment</DialogTitle>
            <DialogDescription>Modifying points for <strong>{selectedUserForPoints?.username}</strong>. Adjustments will be logged for approval.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-6">
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-sm border border-dashed">
              <span className="text-xs font-bold uppercase text-muted-foreground">Current Balance</span>
              <span className="text-xl font-black text-primary font-mono">{(selectedUserForPoints?.totalPoints || 0).toFixed(2)} Pts</span>
            </div>
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wider">Adjustment Amount</Label>
              <div className="flex gap-2">
                <Input 
                  type="number" 
                  step="0.1" 
                  placeholder="e.g. +5.0 or -2.5" 
                  value={adjustmentValue} 
                  onChange={(e) => setAdjustmentValue(e.target.value)} 
                  className="rounded-sm font-mono h-11" 
                />
                <Button className="rounded-sm font-bold px-6 h-11" onClick={() => handleInitiateRequest('adjust')} disabled={isSubmittingRequest || !adjustmentValue}>
                  {isSubmittingRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Log
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground italic">Positive values award points, negative values deduct them.</p>
            </div>
            <div className="pt-4 border-t">
              <Button variant="outline" className="w-full rounded-sm font-bold border-destructive text-destructive hover:bg-destructive hover:text-white transition-all h-11" onClick={() => handleInitiateRequest('clear')} disabled={isSubmittingRequest}>
                {isSubmittingRequest ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                Request Total Balance Reset
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
