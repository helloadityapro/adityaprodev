
"use client";

import * as React from "react";
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, orderBy, limit, where, or, and, getDocs, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Coins, Award, TrendingUp, Medal, Star, User, Info, History, Eye, X, Loader2, FileCheck, FileText, ArrowLeftRight, CreditCard, Send, MapPin, Clock, AlertCircle, Search, FileDown, CircleHelp } from "lucide-react";
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
import * as XLSX from 'xlsx';
import { sendNotification } from "@/lib/notifications";

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
  movementManager?: number;
  dprEngineer?: number;
  dprManager?: number;
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
      <DialogContent className="max-w-xl max-h-[85vh] h-[85vh] flex flex-col p-0 rounded-sm overflow-hidden border-none shadow-2xl bg-background">
        <DialogHeader className="p-4 px-6 bg-muted/10 border-b flex flex-row items-center justify-between space-y-0 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <History className="h-4 w-4 text-primary shrink-0" />
            <DialogTitle className="text-sm font-bold truncate tracking-tight uppercase">History : {targetUser?.username}</DialogTitle>
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
                  <div key={entry.id} className="group flex items-center justify-between py-2.5 px-4 md:px-6 hover:bg-primary/[0.02] transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "h-7 w-7 rounded-sm flex items-center justify-center shrink-0",
                        entry.type === 'PTW' ? "bg-blue-500/10 text-blue-600" : 
                        entry.type === 'DPR' ? "bg-amber-500/10 text-amber-600" : 
                        "bg-emerald-500/10 text-emerald-600"
                      )}>
                        {entry.type === 'PTW' && <FileCheck className="h-4 w-4" />}
                        {entry.type === 'DPR' && <FileText className="h-4 w-4" />}
                        {entry.type === 'Movement' && <ArrowLeftRight className="h-4 w-4" />}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-[11px] text-foreground truncate leading-none mb-1 uppercase tracking-tight">{entry.title}</span>
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1 truncate max-w-[150px]">
                            <MapPin className="h-2 w-2 opacity-50" /> {entry.site}
                          </p>
                          <p className="text-[9px] font-medium text-muted-foreground/60 flex items-center gap-1">
                            <Clock className="h-2 w-2 opacity-50" />
                            {entry.date ? format(entry.date.toDate(), 'dd MMM yyyy, HH:mm') : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <div className="flex flex-col items-end min-w-[60px]">
                        <span className="text-xs font-black text-primary tabular-nums">+{entry.finalPoints.toFixed(2)}</span>
                        <span className="text-[9px] font-bold text-green-600 leading-none">₹{(entry.finalPoints * (settings?.pointValueInRs || 1)).toFixed(2)}</span>
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
          <DialogClose asChild><Button variant="outline" size="sm" className="rounded-sm font-bold h-9 px-6 text-[10px] uppercase tracking-widest w-full xs:w-auto">Close</Button></DialogClose>
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
  const [searchTerm, setSearchTerm] = React.useState("");

  const userRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isUserLoading } = useDoc<UserProfile>(userRef);

  const settingsRef = useMemoFirebase(() => doc(firestore, 'system_settings', 'rewards'), [firestore]);
  const { data: settings } = useDoc<RewardSettings>(settingsRef);

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

  const filteredLeaders = React.useMemo(() => {
    if (!leaders) return [];
    return leaders.filter(l => 
      l.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [leaders, searchTerm]);

  const handleExportLeaderboard = () => {
    if (!filteredLeaders || filteredLeaders.length === 0) return;
    
    const exportData = filteredLeaders.map((leader, index) => ({
      'Rank': index + 1,
      'Name': leader.username,
      'Email': leader.email,
      'Role': leader.role,
      'Points': leader.totalPoints?.toFixed(2) || '0.00',
      'Value (INR)': ((leader.totalPoints || 0) * pointValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leaderboard");
    XLSX.writeFile(wb, `AdityaPro_Leaderboard_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

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
      await sendNotification(firestore, {
        userId: user!.uid,
        title: "Redemption Request Pending",
        description: `Your request to redeem ${pts} points (₹${(pts * pointValue).toFixed(2)}) has been logged.`,
        link: "/rewards",
        push: false // In-app only for self
      });

      // Special notification for Admins
      const adminEmails = ['khalil@adityagreenenergy.com'];
      const usersSnap = await getDocs(query(collection(firestore, 'users'), where('role', '==', 'Admin')));
      usersSnap.forEach(adminDoc => {
        sendNotification(firestore, {
          userId: adminDoc.id,
          title: "New Redemption Request",
          description: `${userProfile?.username} requested a payout of ₹${(pts * pointValue).toFixed(2)}.`,
          link: "/settings/rewards",
          push: true
        });
      });

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
        <div className="grid gap-4 grid-cols-3">
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Trophy className="h-8 w-8 text-amber-500" /> Rewards
          </h1>
          <p className="text-muted-foreground text-sm">Track your earned rewards and performance ranking.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full h-11 w-11 text-primary hover:bg-primary/5 border border-primary/10">
                <CircleHelp className="h-6 w-6" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[calc(100vw-2rem)] xs:w-[350px] p-0 rounded-sm border-primary/10 bg-white shadow-2xl overflow-hidden">
              <div className="bg-primary/5 p-4 border-b">
                <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                  <Star className="h-3.5 w-3.5 fill-primary" /> Reward Point System
                </h3>
              </div>
              <ScrollArea className="max-h-[400px]">
                <div className="p-5 space-y-6">
                  <section className="space-y-3">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest border-l-2 border-blue-500 pl-2">Operations</p>
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-foreground">PtW Submission</span>
                        <span className="text-primary">1.0 Pts</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-medium italic opacity-70 border-b border-dashed pb-1">
                        <span className="text-muted-foreground pl-2">If correction required</span>
                        <span className="text-primary">0.5 Pts</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-foreground">DPR Log</span>
                        <span className="text-primary">1.0 Pts</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-foreground">Material Movement</span>
                        <span className="text-primary">0.1 Pts</span>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest border-l-2 border-amber-500 pl-2">Assignments</p>
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-foreground">Task Assignment</span>
                        <span className="text-primary">0.25 Pts</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-foreground">Task Completion</span>
                        <span className="text-primary">0.25 Pts</span>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest border-l-2 border-emerald-500 pl-2">Supervisors</p>
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-sm">
                      <p className="text-[10px] text-emerald-800 leading-relaxed font-medium">
                        Managers receive <strong className="text-emerald-950">50% Inheritance</strong> of the base points earned by their reporting engineers for PtW and Movements.
                      </p>
                    </div>
                  </section>

                  <section className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-sm">
                      <TrendingUp className="h-4 w-4 text-amber-600 shrink-0" />
                      <p className="text-[10px] text-amber-800 font-bold uppercase leading-snug">
                        Multipliers (X-Factor) are applied to base engineer points based on seniority.
                      </p>
                    </div>
                  </section>
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>

          {userProfile && (
            <Button 
              onClick={() => setSelectedHistoryUser(userProfile)} 
              variant="outline" 
              className="flex-1 sm:flex-none rounded-sm font-bold border-primary text-primary hover:bg-primary/5 h-11 px-4 text-xs uppercase"
            >
              <History className="mr-2 h-4 w-4" /> History
            </Button>
          )}
          
          <div className="flex items-center gap-2 flex-1 sm:flex-none">
            <Button 
              onClick={() => setIsRedeemDialogOpen(true)}
              className="flex-1 rounded-sm font-bold bg-green-600 hover:bg-green-700 h-11 px-4 text-xs uppercase shadow-md"
              disabled={!canRedeem}
            >
              <CreditCard className="mr-2 h-4 w-4" /> Redeem
            </Button>
            {!canRedeem && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-11 w-10 rounded-sm text-muted-foreground shrink-0">
                    <Info className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[calc(100vw-2rem)] xs:w-80 rounded-sm border-primary/10 bg-white shadow-xl">
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" /> Redemption Threshold
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                      Redemption is available once your account balance reaches <strong>₹{MIN_REDEEM_VALUE_RS}.00</strong>.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card className="bg-amber-500/5 border-amber-500/20 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-2 sm:p-6">
            <CardTitle className="text-[8px] sm:text-[10px] font-black uppercase text-amber-600 tracking-widest">Total Points</CardTitle>
            <Star className="h-3 w-3 sm:h-4 sm:w-4 text-amber-500 fill-amber-500" />
          </CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0">
            <div className="text-lg sm:text-3xl font-black text-amber-700 tabular-nums">{userPoints.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card className="bg-green-500/5 border-green-500/10 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-2 sm:p-6">
            <CardTitle className="text-[8px] sm:text-[10px] font-black uppercase text-green-600 tracking-widest">Value</CardTitle>
            <Coins className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
          </CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0">
            <div className="text-lg sm:text-3xl font-black text-green-700 tabular-nums">₹{monetaryValue.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</div>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-2 sm:p-6">
            <CardTitle className="text-[8px] sm:text-[10px] font-black uppercase text-primary tracking-widest">Rank</CardTitle>
            <Award className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0">
            <div className="text-lg sm:text-3xl font-black text-primary tabular-nums">
              #{leaders && user ? (leaders.findIndex(l => l.id === user.uid) !== -1 ? leaders.findIndex(l => l.id === user.uid) + 1 : '—') : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md">
        <CardHeader className="bg-muted/5 border-b flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Medal className="h-5 w-5 text-amber-500" /> Leaderboard
                </CardTitle>
                <CardDescription className="text-xs">Top contributors across the organization.</CardDescription>
            </div>
            {isAdmin && (
              <Button onClick={handleExportLeaderboard} variant="outline" size="sm" className="h-8 rounded-sm font-bold border-primary text-primary hover:bg-primary/5 hidden sm:flex">
                <FileDown className="h-4 w-4 mr-2" /> Export
              </Button>
            )}
          </div>
          <div className="relative w-full">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                  placeholder="Filter personnel..." 
                  className="pl-9 h-10 text-sm rounded-sm border-primary/20 bg-background" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
              />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="md:hidden divide-y divide-border/50">
            {filteredLeaders.length > 0 ? filteredLeaders.map((leader, index) => {
              const actualRank = leaders?.findIndex(l => l.id === leader.id) ?? index;
              const isMe = leader.id === user?.uid;
              
              return (
                <div 
                  key={leader.id} 
                  className={cn("p-4 flex items-center justify-between transition-colors", isMe && "bg-primary/[0.03]")}
                  onClick={() => isAdmin && setSelectedHistoryUser(leader)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 text-center font-black text-xs shrink-0">
                      {actualRank === 0 ? <Trophy className="h-5 w-5 text-amber-500 mx-auto" /> : 
                       actualRank === 1 ? <Medal className="h-5 w-5 text-slate-400 mx-auto" /> :
                       actualRank === 2 ? <Medal className="h-5 w-5 text-amber-700 mx-auto" /> :
                       actualRank + 1}
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-8 w-8 border shrink-0">
                        <AvatarFallback className="text-[10px] font-black uppercase">{leader.username?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className={cn("text-xs truncate font-bold", isMe && "text-primary")}>{leader.username}</span>
                        <span className="text-[9px] text-muted-foreground uppercase font-black tracking-tight truncate">{leader.role}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex flex-col shrink-0 ml-4">
                    <span className="text-xs font-black text-primary tabular-nums">
                      {leader.totalPoints?.toFixed(2) || '0.00'}
                    </span>
                    <span className="text-[10px] font-black text-green-700 leading-none mt-1">
                      ₹{((leader.totalPoints || 0) * pointValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              );
            }) : (
              <div className="p-12 text-center text-muted-foreground italic text-sm">No results found.</div>
            )}
          </div>

          <div className="hidden md:block">
            <ScrollArea className="w-full">
              <div className="min-w-full">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-14 text-center px-2">Rank</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                      <TableHead className="text-right px-6">Value (INR)</TableHead>
                      {isAdmin && <TableHead className="w-14 text-right pr-4"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeaders.map((leader, index) => {
                      const actualRank = leaders?.findIndex(l => l.id === leader.id) ?? index;
                      const isMe = leader.id === user?.uid;
                      
                      return (
                        <TableRow key={leader.id} className={cn("hover:bg-muted/5 transition-colors", isMe && "bg-primary/[0.03]")}>
                          <TableCell className="text-center px-2 font-black text-xs">
                              {actualRank === 0 ? <Trophy className="h-5 w-5 text-amber-500 mx-auto" /> : 
                               actualRank === 1 ? <Medal className="h-5 w-5 text-slate-400 mx-auto" /> :
                               actualRank === 2 ? <Medal className="h-5 w-5 text-amber-700 mx-auto" /> :
                               actualRank + 1}
                          </TableCell>
                          <TableCell className="max-w-[150px] md:max-w-none">
                              <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8 border shrink-0">
                                      <AvatarFallback className="text-[10px] font-black uppercase">{leader.username?.charAt(0)}</AvatarFallback>
                                  </Avatar>
                                  <div className="flex flex-col min-w-0">
                                      <span className={cn("text-xs truncate", isMe ? "font-black" : "font-bold")}>{leader.username}</span>
                                      <span className="text-[9px] text-muted-foreground uppercase font-black tracking-tight truncate">{leader.role}</span>
                                  </div>
                              </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-black text-xs text-primary">
                              {leader.totalPoints?.toFixed(2) || '0.00'}
                          </TableCell>
                          <TableCell className="text-right font-black text-xs text-green-700 px-6">
                              ₹{((leader.totalPoints || 0) * pointValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right pr-4">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => setSelectedHistoryUser(leader)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isRedeemDialogOpen} onOpenChange={setIsRedeemDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-sm p-6 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="text-left space-y-2">
            <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
              <CreditCard className="h-6 w-6 text-green-600" />
              Redeem Rewards
            </DialogTitle>
            <DialogDescription className="text-xs font-medium leading-relaxed">
              Convert your points balance into official rewards. Min balance value: ₹{MIN_REDEEM_VALUE_RS}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-muted/20 rounded-sm border space-y-1">
                <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Points</p>
                <p className="text-2xl font-black text-primary tabular-nums">{userPoints.toFixed(2)}</p>
              </div>
              <div className={cn("p-4 rounded-sm border space-y-1", canRedeem ? "bg-green-50 border-green-100" : "bg-amber-50 border-amber-100")}>
                <p className={cn("text-[9px] font-black uppercase tracking-widest", canRedeem ? "text-green-700" : "text-amber-700")}>Value</p>
                <p className={cn("text-2xl font-black tabular-nums", canRedeem ? "text-green-700" : "text-amber-700")}>₹{monetaryValue.toFixed(2)}</p>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Amount to Redeem</Label>
              <div className="relative">
                <Input 
                  type="number" 
                  placeholder="Enter point amount..." 
                  value={redeemPoints} 
                  onChange={(e) => setRedeemPoints(e.target.value)} 
                  className="rounded-sm font-black h-14 text-xl px-4 pr-14 focus-visible:ring-primary/20"
                  disabled={!canRedeem}
                />
                <div className="absolute right-4 top-4.5 font-black text-muted-foreground/40 text-xs">PTS</div>
              </div>
            </div>

            {!canRedeem && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-sm flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                <p className="text-[10px] text-red-800 font-bold uppercase leading-snug">
                  Threshold Not Met: You need ₹{(MIN_REDEEM_VALUE_RS - monetaryValue).toFixed(2)} more to unlock redemption.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-3">
            <DialogClose asChild><Button variant="outline" className="w-full sm:flex-1 h-12 font-bold uppercase text-xs rounded-sm">Cancel</Button></DialogClose>
            <Button 
              onClick={handleInitiateRedemption} 
              disabled={isRedeeming || !redeemPoints || parseFloat(redeemPoints) <= 0 || parseFloat(redeemPoints) > userPoints || !canRedeem}
              className="w-full sm:flex-1 h-12 font-black uppercase text-xs rounded-sm bg-green-600 hover:bg-green-700 shadow-lg"
            >
              {isRedeeming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="mr-2 h-4 w-4 mr-2" />}
              Submit
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
