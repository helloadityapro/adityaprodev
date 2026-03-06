"use client";

import * as React from "react";
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, orderBy, limit, where, or, and, getDocs, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Coins, Award, TrendingUp, Medal, Star, User, Info, History, Eye, X, Loader2, FileCheck, FileText, ArrowLeftRight, CreditCard, Send, MapPin, Clock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSuperAdmin } from "@/lib/auth-constants";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const MIN_REDEEM_VALUE_RS = 500;

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
  dprEngineer?: number;
  taskAssignment?: number;
  taskCompletion?: number;
};

type EarningEntry = {
  id: string;
  type: 'PTW' | 'DPR' | 'Movement';
  title: string;
  site: string;
  date: any;
  basePoints: number;
  multiplier: number;
  finalPoints: number;
  isInherited: boolean;
};

type RedemptionRequest = {
  id: string;
  points: number;
  amountInRs: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
};

function EarningHistoryDialog({ targetUser, open, onOpenChange, settings }: { targetUser: UserProfile | null, open: boolean, onOpenChange: (o: boolean) => void, settings: RewardSettings | null }) {
  const firestore = useFirestore();
  const [entries, setEntries] = React.useState<EarningEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open || !targetUser || !firestore || !settings) return;

    const fetchHistory = async () => {
      setIsLoading(true);
      const history: EarningEntry[] = [];
      const userId = targetUser.id;
      const multiplier = targetUser.pointsMultiplier || 1;

      try {
        // 1. Fetch Permits (Approved only)
        const ptwQuery = query(
          collection(firestore, 'permits_to_work'),
          and(
            where('status', '==', 'Approved'),
            or(where('siteEngineerId', '==', userId), where('siteManagerId', '==', userId))
          )
        );
        const ptwSnap = await getDocs(ptwQuery);
        ptwSnap.forEach(d => {
          const data = d.data();
          const isManager = data.siteManagerId === userId;
          const hasRejection = (data.timeline || []).some((t: any) => t.status === 'Rejected');
          const baseRate = hasRejection ? (settings.ptwWithCorrection || 0.5) : (settings.ptwNoCorrection || 1.0);
          
          history.push({
            id: d.id,
            type: 'PTW',
            title: `Permit ${data.serialNumber}`,
            site: data.siteName,
            date: data.statusChangeDate || data.requestDate,
            basePoints: baseRate,
            multiplier: isManager ? 1 : multiplier,
            finalPoints: isManager ? (baseRate * 0.5) : (baseRate * multiplier),
            isInherited: isManager && data.siteEngineerId !== userId
          });
        });

        // 2. Fetch DPRs
        const dprQuery = query(
          collection(firestore, 'dprs'),
          or(where('userId', '==', userId), where('siteManagerId', '==', userId))
        );
        const dprSnap = await getDocs(dprQuery);
        dprSnap.forEach(d => {
          const data = d.data();
          const isManager = data.siteManagerId === userId;
          const baseRate = 1.0;

          history.push({
            id: d.id,
            type: 'DPR',
            title: `Daily Progress Report`,
            site: data.siteName,
            date: data.createdAt,
            basePoints: baseRate,
            multiplier: isManager ? 1 : multiplier,
            finalPoints: isManager ? 0.25 : (baseRate * multiplier),
            isInherited: isManager && data.userId !== userId
          });
        });

        // 3. Fetch Movements
        const movQuery = query(
          collection(firestore, 'material_movements'),
          or(where('userId', '==', userId), where('siteManagerId', '==', userId))
        );
        const movSnap = await getDocs(movQuery);
        movSnap.forEach(d => {
          const data = d.data();
          const isManager = data.siteManagerId === userId;
          const baseRate = settings.movementEngineer || 0.1;

          history.push({
            id: d.id,
            type: 'Movement',
            title: `Log: ${data.itemName}`,
            site: data.siteName,
            date: data.createdAt,
            basePoints: baseRate,
            multiplier: isManager ? 1 : multiplier,
            finalPoints: isManager ? (baseRate * 0.5) : (baseRate * multiplier),
            isInherited: isManager && data.userId !== userId
          });
        });

        setEntries(history.sort((a, b) => {
          const da = a.date?.toDate?.()?.getTime() || 0;
          const db = b.date?.toDate?.()?.getTime() || 0;
          return db - da;
        }));
      } catch (e) {
        console.error("History fetch failed", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [open, targetUser, firestore, settings]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] h-[85vh] flex flex-col p-0 rounded-sm overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-4 px-6 bg-muted/10 border-b flex flex-row items-center justify-between space-y-0 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <History className="h-4 w-4 text-primary shrink-0" />
            <DialogTitle className="text-sm font-bold truncate tracking-tight uppercase">Earning History : {targetUser?.username}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col bg-background min-h-0">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Synchronizing Logs</p>
            </div>
          ) : entries.length > 0 ? (
            <ScrollArea className="h-full w-full">
              <div className="divide-y divide-border/50">
                {entries.map((entry) => (
                  <div key={entry.id} className="group flex items-center justify-between py-2 px-6 hover:bg-primary/[0.02] transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "h-6 w-6 rounded-[2px] flex items-center justify-center shrink-0",
                        entry.type === 'PTW' ? "bg-blue-500/10 text-blue-600" : 
                        entry.type === 'DPR' ? "bg-amber-500/10 text-amber-600" : 
                        "bg-emerald-500/10 text-emerald-600"
                      )}>
                        {entry.type === 'PTW' && <FileCheck className="h-3 w-3" />}
                        {entry.type === 'DPR' && <FileText className="h-3 w-3" />}
                        {entry.type === 'Movement' && <ArrowLeftRight className="h-3 w-3" />}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-[11px] text-foreground truncate leading-none mb-1 uppercase tracking-tight">{entry.title}</span>
                        <div className="flex items-center gap-2">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1 truncate max-w-[120px]">
                            <MapPin className="h-2 w-2 opacity-50" /> {entry.site}
                          </p>
                          <span className="text-[9px] font-medium text-muted-foreground/40">•</span>
                          <p className="text-[9px] font-medium text-muted-foreground/40 flex items-center gap-1">
                            <Clock className="h-2 w-2 opacity-50" />
                            {entry.date ? format(entry.date.toDate(), 'dd MMM, HH:mm') : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {entry.isInherited ? (
                        <span className="text-[7px] font-black text-amber-700 bg-amber-100 px-1 py-0.5 rounded-sm uppercase tracking-tighter">Inherited</span>
                      ) : entry.multiplier > 1 ? (
                        <span className="text-[7px] font-black text-primary bg-primary/5 px-1 py-0.5 rounded-sm uppercase tracking-tighter">x{entry.multiplier}</span>
                      ) : null}
                      <div className="flex flex-col items-end min-w-[60px]">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-black text-primary tabular-nums">+{entry.finalPoints.toFixed(2)}</span>
                        </div>
                        <span className="text-[9px] font-bold text-green-600 leading-none">
                          ₹{(entry.finalPoints * (settings?.pointValueInRs || 1)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-32 text-center text-muted-foreground/40">
              <History className="h-10 w-10 opacity-10 mb-4" />
              <p className="text-[10px] font-black uppercase tracking-widest">No activity recorded</p>
            </div>
          )}
        </div>

        <div className="p-3 border-t bg-muted/5 flex justify-end shrink-0">
          <DialogClose asChild><Button variant="outline" size="sm" className="rounded-sm font-bold h-8 px-4 text-[10px] uppercase tracking-widest">Close Audit</Button></DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function RewardsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [selectedHistoryUser, setSelectedHistoryUser] = React.useState<UserProfile | null>(null);
  const [isRedeemDialogOpen, setIsRedeemDialogOpen] = React.useState(false);
  const [redeemPoints, setRedeemPoints] = React.useState<string>("");
  const [isRedeeming, setIsRedeeming] = React.useState(false);

  // Fetch current user's profile
  const userRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isUserLoading } = useDoc<UserProfile>(userRef);

  // Fetch global reward settings
  const settingsRef = useMemoFirebase(() => doc(firestore, 'system_settings', 'rewards'), [firestore]);
  const { data: settings } = useDoc<RewardSettings>(settingsRef);

  // Fetch all users for leaderboard without limit
  const leadersQuery = useMemoFirebase(() => 
    query(collection(firestore, 'users'), orderBy('totalPoints', 'desc')), 
    [firestore]
  );
  const { data: leaders, isLoading: isLeadersLoading } = useCollection<UserProfile>(leadersQuery);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const pointValue = settings?.pointValueInRs || 1;
  const userPoints = userProfile?.totalPoints || 0;
  const monetaryValue = userPoints * pointValue;
  
  const canRedeem = monetaryValue >= MIN_REDEEM_VALUE_RS;

  const handleInitiateRedemption = async () => {
    if (!canRedeem) {
      toast({ variant: 'destructive', title: 'Threshold Not Met', description: `A minimum balance of ₹${MIN_REDEEM_VALUE_RS} is required to redeem.` });
      return;
    }

    const pts = parseFloat(redeemPoints);
    if (isNaN(pts) || pts <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Enter a valid point amount.' });
      return;
    }
    if (pts > userPoints) {
      toast({ variant: 'destructive', title: 'Insufficient Balance', description: `You only have ${userPoints.toFixed(2)} points.` });
      return;
    }

    setIsRedeeming(true);
    try {
      await addDocumentNonBlocking(collection(firestore, 'redemption_requests'), {
        userId: user!.uid,
        userName: userProfile!.username,
        points: pts,
        amountInRs: pts * pointValue,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      toast({ title: 'Request Submitted', description: `Your request to redeem ${pts} points (₹${(pts * pointValue).toFixed(2)}) is pending approval.` });
      setIsRedeemDialogOpen(false);
      setRedeemPoints("");
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Submission Failed', description: e.message });
    } finally {
      setIsRedeeming(false);
    }
  };

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <Trophy className="h-8 w-8 text-amber-500" /> Points Bank
          </h1>
          <p className="text-muted-foreground">Track your earned rewards and professional performance ranking.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {userProfile && (
            <Button 
              onClick={() => setSelectedHistoryUser(userProfile)} 
              variant="outline" 
              className="rounded-sm font-bold border-primary text-primary hover:bg-primary/5 h-11 px-6 shadow-sm"
            >
              <History className="mr-2 h-4 w-4" />
              View My History
            </Button>
          )}
          
          <div className="flex items-center gap-2">
            {!canRedeem && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-11 w-11 rounded-sm text-amber-600 hover:bg-amber-50 border border-amber-200 shadow-sm animate-in fade-in zoom-in-95">
                    <Info className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 rounded-sm border-amber-200 bg-amber-50 shadow-xl">
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-amber-800 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" /> Redemption Threshold
                    </p>
                    <p className="text-xs text-amber-700 leading-relaxed font-medium">
                      Redemption is available once your account balance reaches <strong>₹{MIN_REDEEM_VALUE_RS}.00</strong>. 
                      Currently, you have <strong>₹{monetaryValue.toFixed(2)}</strong>. You need <strong>₹{(MIN_REDEEM_VALUE_RS - monetaryValue).toFixed(2)}</strong> more to initiate a request.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <Button 
              onClick={() => setIsRedeemDialogOpen(true)}
              className="rounded-sm font-bold bg-green-600 hover:bg-green-700 h-11 px-6 shadow-md"
              disabled={!canRedeem}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Redeem Points
            </Button>
          </div>
        </div>
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

        <Card className="bg-green-500/5 border-green-500/10 rounded-sm">
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
            <ScrollArea className="w-full">
              <div className="min-w-[700px] pb-2">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-16 text-center">Rank</TableHead>
                      <TableHead>Personnel</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right px-2">Total Points</TableHead>
                      <TableHead className="text-right">Earned Reward</TableHead>
                      {isAdmin && <TableHead className="text-right px-6">Actions</TableHead>}
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
                        <TableCell className="text-right px-2 font-bold text-primary">
                            {(leader.totalPoints || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-green-700">
                            ₹{((leader.totalPoints || 0) * pointValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right px-6">
                            <div className="flex justify-end">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-primary hover:bg-primary/10 rounded-sm"
                                onClick={() => setSelectedHistoryUser(leader)}
                                title="View Earning History"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="space-y-6">
            <Card className="rounded-sm border-primary/10">
                <CardHeader>
                    <CardTitle className="text-xs font-bold uppercase text-primary">Reward Economy Rules</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-3">
                        <div className="flex flex-col gap-1">
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="font-bold text-muted-foreground uppercase">Engineer Submits:</span>
                                <span className="font-black text-primary">100% Points</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="font-bold text-muted-foreground uppercase">Manager Inherits:</span>
                                <Badge className="h-4 text-[9px] bg-amber-100 text-amber-800 border-amber-200">50% Share</Badge>
                            </div>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-medium">PtW (No Correction)</span>
                                <Badge className="bg-green-100 text-green-800 border-green-200">+{settings?.ptwNoCorrection?.toFixed(2) || '1.00'}</Badge>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-medium text-amber-700">PtW (With Correction)</span>
                                <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50">+{settings?.ptwWithCorrection?.toFixed(2) || '0.50'}</Badge>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-medium">Movement Log</span>
                                <Badge className="bg-slate-100 text-slate-800 border-slate-200">+{settings?.movementEngineer?.toFixed(2) || '0.10'}</Badge>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-medium">DPR Submission</span>
                                <Badge className="bg-blue-100 text-blue-800 border-blue-200">+1.00</Badge>
                            </div>
                        </div>
                    </div>
                    <Separator />
                    <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-sm border border-primary/10">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <div className="text-[10px] leading-relaxed italic text-muted-foreground">
                            Engineer points are multiplied by their X-Factor. Manager inheritance is based on the base rate.
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

      {/* Redemption Dialog */}
      <Dialog open={isRedeemDialogOpen} onOpenChange={setIsRedeemDialogOpen}>
        <DialogContent className="max-w-md rounded-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-green-600" />
              Redeem Reward Points
            </DialogTitle>
            <DialogDescription>
              Submit a request to convert your points into rewards. A minimum balance value of ₹{MIN_REDEEM_VALUE_RS} is required.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/30 rounded-sm border space-y-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Available Points</p>
                <p className="text-2xl font-black text-primary font-mono">{userPoints.toFixed(2)}</p>
              </div>
              <div className={cn("p-4 rounded-sm border space-y-1", canRedeem ? "bg-green-50 border-green-100" : "bg-amber-50 border-amber-100")}>
                <p className={cn("text-[10px] font-bold uppercase", canRedeem ? "text-green-700" : "text-amber-700")}>Current Value</p>
                <p className={cn("text-2xl font-black font-mono", canRedeem ? "text-green-700" : "text-amber-700")}>₹{monetaryValue.toFixed(2)}</p>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wider">Points to Redeem</Label>
              <div className="relative">
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  value={redeemPoints} 
                  onChange={(e) => setRedeemPoints(e.target.value)}
                  className="rounded-sm font-mono h-12 text-lg pr-12"
                  disabled={!canRedeem}
                />
                <div className="absolute right-3 top-3 text-xs font-bold text-muted-foreground uppercase">Pts</div>
              </div>
              {redeemPoints && !isNaN(parseFloat(redeemPoints)) && (
                <div className="flex items-center gap-2 text-sm font-bold text-green-700 bg-green-50 p-2 rounded-sm border border-green-100">
                  <TrendingUp className="h-4 w-4" />
                  Redemption Value: ₹{(parseFloat(redeemPoints) * pointValue).toFixed(2)}
                </div>
              )}
            </div>

            {!canRedeem && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-red-800 font-bold uppercase leading-tight">
                  INSUFFICIENT BALANCE VALUE: Minimum ₹{MIN_REDEEM_VALUE_RS}.00 required. You need ₹{(MIN_REDEEM_VALUE_RS - monetaryValue).toFixed(2)} more.
                </p>
              </div>
            )}

            <div className="bg-amber-50 p-3 rounded-sm border border-amber-100 flex items-start gap-2">
              <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-800 leading-relaxed">
                Requests are typically processed within 3-5 business days. Once approved, the equivalent amount will be dispatched via registered channel.
              </p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" className="rounded-sm">Cancel</Button></DialogClose>
            <Button 
              onClick={handleInitiateRedemption} 
              disabled={isRedeeming || !redeemPoints || parseFloat(redeemPoints) <= 0 || parseFloat(redeemPoints) > userPoints || !canRedeem}
              className="rounded-sm font-black bg-green-600 hover:bg-green-700 min-w-[120px]"
            >
              {isRedeeming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EarningHistoryDialog 
        targetUser={selectedHistoryUser} 
        open={!!selectedHistoryUser} 
        onOpenChange={(o) => !o && setSelectedHistoryUser(null)} 
        settings={settings || null}
      />
    </div>
  );
}
