"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, serverTimestamp, increment, getDoc, limit } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays, subMonths } from "date-fns";
import { 
  ListTodo, 
  Search, 
  Pencil, 
  Trash2, 
  Loader2, 
  Clock, 
  Calendar, 
  FilterX, 
  CheckCircle2, 
  MapPin, 
  Users, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  Save,
  User,
  CircleCheck,
  CircleX,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  UserCheck
} from "lucide-react";
import { isSuperAdmin } from "@/lib/auth-constants";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "next/navigation";
import { sendNotification } from "@/lib/notifications";
import { slugifyRole } from "@/lib/access-control";

type AssigneeState = {
  userId: string;
  userName: string;
  status: "To-do" | "In Progress" | "Completed" | "Cancelled";
  remarks?: string;
  updatedAt: any;
};

type Task = {
  id: string;
  siteId?: string;
  siteName: string;
  title: string;
  description: string;
  assigneeIds: string[];
  assigneeStates: Record<string, AssigneeState>;
  assignedRoles?: string[];
  assignedIndividualIds?: string[];
  assignedById: string;
  assignedByName: string;
  priority: "Low" | "Medium" | "High";
  status: "To-do" | "In Progress" | "Completed" | "Cancelled";
  dueDate: string;
  createdAt: any;
  updatedAt: any;
  remarks?: string;
};

type RewardSettings = {
  taskCompletion?: number;
};

type AccessConfig = {
  id: string;
  ownDataOnly?: boolean;
};

const STATUS_OPTIONS = ["To-do", "In Progress", "Completed", "Cancelled"] as const;

function PriorityBadge({ priority }: { priority: string }) {
  const config = {
    High: "bg-red-100 text-red-800 border-red-200",
    Medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    Low: "bg-blue-100 text-blue-800 border-blue-200",
  };
  return (
    <Badge variant="outline" className={cn("rounded-sm text-[10px] font-bold uppercase", (config as any)[priority])}>
      {priority}
    </Badge>
  );
}

function StatusBadge({ status, className }: { status: string, className?: string }) {
  const config = {
    "To-do": "bg-slate-100 text-slate-800 border-slate-200",
    "In Progress": "bg-blue-100 text-blue-800 border-blue-200",
    "Completed": "bg-green-100 text-green-800 border-green-200",
    "Cancelled": "bg-red-100 text-red-800 border-red-200",
  };
  return (
    <Badge variant="outline" className={cn("rounded-sm text-[9px] font-bold uppercase", (config as any)[status], className)}>
      {status}
    </Badge>
  );
}

const formatTimestamp = (ts: any) => {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : (typeof ts === 'string' ? new Date(ts) : ts);
  return format(date, 'dd MMM, HH:mm');
};

const getSummarizedAssignees = (task: Task) => {
  if (task.assignedRoles && task.assignedRoles.length > 0) {
    return `All ${task.assignedRoles.join(", ")}s`;
  }
  
  const states = Object.values(task.assigneeStates || {});
  if (states.length === 0) return "Unassigned";
  if (states.length === 1) return states[0].userName;
  if (states.length === 2) return `${states[0].userName}, ${states[1].userName}`;
  return `${states[0].userName}, ${states[1].userName} & ${states.length - 2} others`;
};

export default function TaskListPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [activeTab, setActiveTab] = React.useState("all");
  const [dateFilter, setDateFilter] = React.useState<string>("7days");
  
  const [actionTask, setActionTask] = React.useState<Task | null>(null);
  const [selectedUpdateUserId, setSelectedUpdateUserId] = React.useState<string>("");
  const [pendingStatus, setPendingStatus] = React.useState<Task['status'] | "">("");
  
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [deletingTask, setDeletingTask] = React.useState<Task | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = React.useState<Set<string>>(new Set());

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<AccessConfig>(roleConfigsQuery);

  const isSuper = isSuperAdmin(user?.email);
  const isAdmin = isSuper || userProfile?.role === 'Admin';
  const userRoleStr = isAdmin ? 'admin' : (userProfile?.role ? userProfile.role.toLowerCase().replace(/\s+/g, '-') : 'site-engineer');

  const tasksQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    return query(collection(firestore, 'tasks'), limit(1000));
  }, [firestore, user, userProfile]);

  const { data: tasks, isLoading } = useCollection<Task>(tasksQuery);

  const settingsRef = useMemoFirebase(() => doc(firestore, 'system_settings', 'rewards'), [firestore]);
  const { data: rewardSettings } = useDoc<RewardSettings>(settingsRef);

  const toggleExpand = (id: string) => {
    const next = new Set(expandedTaskIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedTaskIds(next);
  };

  const queryDateRange = React.useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    
    switch (dateFilter) {
      case 'today': return { start: todayStr, end: todayStr };
      case 'yesterday': return { start: format(subDays(today, 1), 'yyyy-MM-dd'), end: format(subDays(today, 1), 'yyyy-MM-dd') };
      case '7days': return { start: format(subDays(today, 7), 'yyyy-MM-dd'), end: todayStr };
      case 'lastMonth': return { start: format(subMonths(today, 1), 'yyyy-MM-dd'), end: todayStr };
      default: return { start: format(subDays(today, 7), 'yyyy-MM-dd'), end: todayStr };
    }
  }, [dateFilter]);

  const filteredTasks = React.useMemo(() => {
    if (!tasks || !userProfile) return [];
    
    const { start, end } = queryDateRange;
    let list = tasks;

    if (!isAdmin) {
      list = list.filter(task => 
        (task.assigneeIds || []).includes(user?.uid || "") || task.assignedById === user?.uid
      );
    }

    const isOwnDataOnly = userProfile.ownDataOnly !== undefined 
      ? userProfile.ownDataOnly 
      : roleConfigs?.find(c => c.id === userRoleStr)?.ownDataOnly ?? false;

    if (isOwnDataOnly && !isSuper) {
      const assignedIds = new Set(userProfile.assignedProjectIds || []);
      list = list.filter(task => {
        if ((task.assigneeIds || []).includes(user?.uid || "") || task.assignedById === user?.uid) return true;
        if (!task.siteId) return true;
        return assignedIds.has(task.siteId);
      });
    }

    list = list.filter(task => {
      const tDate = task.createdAt?.toDate?.() || new Date(task.createdAt);
      const tDateStr = format(tDate, 'yyyy-MM-dd');

      const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.assigneeIds || []).some(id => task.assigneeStates?.[id]?.userName.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      
      const matchesTab = activeTab === 'all' || 
        (activeTab === 'my-tasks' && (task.assigneeIds || []).includes(user?.uid || "")) ||
        (activeTab === 'assigned-by-me' && task.assignedById === user?.uid);

      const matchesDate = tDateStr >= start && tDateStr <= end;

      return matchesSearch && matchesDate && matchesStatus && matchesTab;
    });

    return list.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
        const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
        return dateB - dateA;
    });
  }, [tasks, searchTerm, statusFilter, activeTab, user, userProfile, roleConfigs, isSuper, isAdmin, queryDateRange, userRoleStr]);

  const handleUpdateStatus = async (remarks: string) => {
    if (!actionTask || !pendingStatus) return;
    setIsUpdating(true);
    
    const targetUserId = selectedUpdateUserId || user?.uid;
    if (!targetUserId) return;

    const taskRef = doc(firestore, 'tasks', actionTask.id);
    const newStates = { ...(actionTask.assigneeStates || {}) };
    
    const wasCompleted = newStates[targetUserId]?.status === 'Completed';
    const isNowCompleted = pendingStatus === 'Completed';

    newStates[targetUserId] = {
        ...newStates[targetUserId],
        userId: targetUserId,
        status: pendingStatus as any,
        remarks: remarks || "",
        updatedAt: new Date().toISOString()
    };

    const allStates = Object.values(newStates);
    let overallStatus: Task['status'] = "In Progress";
    if (allStates.every(s => s.status === 'Completed')) overallStatus = "Completed";
    else if (allStates.every(s => s.status === 'To-do')) overallStatus = "To-do";
    else if (allStates.every(s => s.status === 'Cancelled')) overallStatus = "Cancelled";

    updateDocumentNonBlocking(taskRef, {
        assigneeStates: newStates,
        status: overallStatus,
        updatedAt: serverTimestamp()
    });

    if (isNowCompleted && !wasCompleted) {
        const assigneeRef = doc(firestore, 'users', targetUserId);
        const assigneeDoc = await getDoc(assigneeRef);
        if (assigneeDoc.exists()) {
            const multiplier = assigneeDoc.data().pointsMultiplier || 1;
            const rate = rewardSettings?.taskCompletion ?? 0.25;
            updateDocumentNonBlocking(assigneeRef, { totalPoints: increment(rate * multiplier) });
        }
    }

    toast({ title: "Progress Recorded", description: `Internal status updated for ${newStates[targetUserId]?.userName}.` });
    setIsUpdating(false);
    setActionTask(null);
  };

  const handleDelete = async () => {
    if (!deletingTask || !firestore) return;
    deleteDocumentNonBlocking(doc(firestore, 'tasks', deletingTask.id));
    toast({ title: "Deleted", description: "Task record removed." });
    setDeletingTask(null);
  };

  if (isLoading || isProfileLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2">
            <ListTodo className="h-8 w-8 text-primary" /> Task Board
          </h1>
          <p className="text-muted-foreground text-sm font-medium">Monitor and update site activity assignments.</p>
        </div>
        <Button onClick={() => router.push('/tasks/create')} className="rounded-sm font-bold shadow-md">
          Assign New Task
        </Button>
      </div>

      <div className="flex flex-col gap-4 bg-card p-3 md:p-4 border border-primary/10 rounded-sm shadow-sm no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
            <TabsList className="grid w-full grid-cols-3 md:w-[400px] rounded-sm bg-muted/50 h-9 p-1">
              <TabsTrigger value="all" className="rounded-sm text-[10px] font-bold uppercase tracking-tight">All Tasks</TabsTrigger>
              <TabsTrigger value="my-tasks" className="rounded-sm text-[10px] font-bold uppercase tracking-tight">My Tasks</TabsTrigger>
              <TabsTrigger value="assigned-by-me" className="rounded-sm text-[10px] font-bold uppercase tracking-tight">Assigned By Me</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search title or personnel..." 
                className="pl-9 h-9 rounded-sm border-primary/20 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="md:hidden space-y-4">
        {filteredTasks.length > 0 ? filteredTasks.map((task) => (
          <Card key={task.id} className="border-primary/10 rounded-sm shadow-sm overflow-hidden" onClick={() => toggleExpand(task.id)}>
            <CardContent className="p-4 space-y-4 text-left">
              <div className="flex justify-between items-start gap-4">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Due {format(new Date(task.dueDate), 'dd MMM yy')}</span>
                  <h3 className="font-bold text-sm leading-tight text-foreground truncate">{task.title}</h3>
                </div>
                <StatusBadge status={task.status} />
              </div>
              
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                  <MapPin className="h-3 w-3 text-primary/60" />
                  <span>{task.siteName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={task.priority} />
                  <Badge variant="secondary" className="text-[8px] font-black h-5 px-1.5 uppercase rounded-sm bg-primary/5 text-primary border-none">
                    {getSummarizedAssignees(task)}
                  </Badge>
                </div>
              </div>

              {expandedTaskIds.has(task.id) && (
                 <div className="pt-4 border-t space-y-4 animate-in slide-in-from-top-1">
                    {Object.values(task.assigneeStates || {}).map(s => (
                      <div key={s.userId} className="p-3 bg-muted/20 border rounded-sm space-y-2">
                         <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-foreground">{s.userName}</span>
                            <StatusBadge status={s.status} className="h-4 px-1 text-[7px]" />
                         </div>
                         {s.remarks && <p className="text-[10px] italic text-muted-foreground leading-snug">"{s.remarks}"</p>}
                      </div>
                    ))}
                 </div>
              )}

              <div className="pt-2 border-t border-primary/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">By {task.assignedByName}</span>
                </div>
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  {((task.assigneeIds || []).includes(user?.uid || "") || isAdmin || task.assignedById === user?.uid) && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => { 
                      setActionTask(task); 
                      const targetId = (task.assigneeIds || []).includes(user?.uid || "") ? user?.uid : (task.assigneeIds[0] || "");
                      setSelectedUpdateUserId(targetId || "");
                      setPendingStatus(task.assigneeStates?.[targetId || ""]?.status || "To-do");
                    }}><Pencil className="h-4 w-4" /></Button>
                  )}
                  {isAdmin && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => setDeletingTask(task)}><Trash2 className="h-4 w-4" /></Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )) : <div className="text-center py-12 text-muted-foreground italic">No tasks found.</div>}
      </div>

      <div className="hidden md:block">
        <Card className="shadow-md border-primary/10 rounded-sm overflow-hidden">
          <CardContent className="p-0 text-left">
            <ScrollArea className="h-[600px] w-full">
              <Table>
                <TableHeader className="bg-muted/30 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="w-32">Due Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assignees</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned By</TableHead>
                    <TableHead className="text-right px-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.length > 0 ? filteredTasks.map((task) => {
                    const assignees = Object.values(task.assigneeStates || {});
                    const completedCount = assignees.filter(s => s.status === 'Completed').length;
                    
                    return (
                      <React.Fragment key={task.id}>
                        <TableRow className="hover:bg-muted/5 transition-colors cursor-pointer" onClick={() => toggleExpand(task.id)}>
                          <TableCell className="pl-4">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm">
                              {expandedTaskIds.has(task.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs font-bold text-primary">{format(new Date(task.dueDate), 'dd MMM yy')}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-sm text-foreground">{task.title}</span>
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                                <MapPin className="h-3 w-3 text-primary/40" /> {task.siteName}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell><PriorityBadge priority={task.priority} /></TableCell>
                          <TableCell>
                            <span className="text-xs font-bold text-foreground">
                              {getSummarizedAssignees(task)}
                            </span>
                          </TableCell>
                          <TableCell><StatusBadge status={task.status} /></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <UserCheck className="h-3.5 w-3.5 text-primary opacity-60" />
                              <span className="text-[10px] font-black uppercase text-muted-foreground">{task.assignedByName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <div className="flex justify-end items-center gap-1" onClick={e => e.stopPropagation()}>
                              {((task.assigneeIds || []).includes(user?.uid || "") || isAdmin || task.assignedById === user?.uid) && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-primary hover:bg-primary/10 rounded-sm" 
                                  onClick={() => { 
                                    setActionTask(task); 
                                    const targetId = (task.assigneeIds || []).includes(user?.uid || "") ? user?.uid : (task.assigneeIds[0] || "");
                                    setSelectedUpdateUserId(targetId || "");
                                    setPendingStatus(task.assigneeStates?.[targetId || ""]?.status || "To-do");
                                  }}
                                  title="Record Progress"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {isAdmin && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => setDeletingTask(task)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedTaskIds.has(task.id) && (
                          <TableRow className="bg-primary/[0.01]">
                            <TableCell colSpan={8} className="p-0 border-b">
                              <div className="p-6 px-20 space-y-6 animate-in slide-in-from-top-1 duration-200 text-left">
                                <div className="flex items-center gap-2 border-b pb-2">
                                  <ShieldCheck className="h-4 w-4 text-primary" />
                                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Task Allotment Breakdown</h4>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                  {Object.values(task.assigneeStates || {}).map((s) => (
                                    <Card key={s.userId} className="rounded-sm shadow-sm border-primary/5">
                                      <CardHeader className="p-3 bg-muted/10 border-b flex flex-row items-center justify-between space-y-0">
                                        <div className="flex items-center gap-2">
                                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center font-black text-[10px] text-primary">{s.userName.charAt(0).toUpperCase()}</div>
                                          <span className="font-bold text-xs">{s.userName}</span>
                                        </div>
                                        <StatusBadge status={s.status} className="h-4 px-1 text-[8px]" />
                                      </CardHeader>
                                      <CardContent className="p-3 space-y-3">
                                        <div className="flex flex-col gap-1">
                                          <span className="text-[8px] font-black uppercase text-muted-foreground tracking-tighter">Personnel Status</span>
                                          <p className="text-[11px] font-medium leading-relaxed italic text-foreground/80">
                                            "{s.remarks || 'Awaiting update...'}"
                                          </p>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  }) : (
                    <TableRow>
                      <TableCell colSpan={8} className="h-40 text-center italic text-muted-foreground uppercase font-black text-[11px] opacity-20 tracking-[0.2em]">
                        No tasks recorded for this selection
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!actionTask} onOpenChange={() => { setActionTask(null); setPendingStatus(""); setSelectedUpdateUserId(""); }}>
        <DialogContent className="rounded-sm max-w-lg">
          <DialogHeader className="p-0 border-b pb-4">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Record Task Progress</DialogTitle>
            <DialogDescription className="text-xs font-medium">
              Updating audit log for: <strong className="text-primary">{actionTask?.title}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4 text-left">
            {(isAdmin || actionTask?.assignedById === user?.uid) ? (
               <div className="space-y-2 p-4 border rounded-sm bg-primary/5 border-primary/10">
                  <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Select Personnel to Audit</Label>
                  <Select value={selectedUpdateUserId} onValueChange={(val) => {
                    setSelectedUpdateUserId(val);
                    setPendingStatus(actionTask?.assigneeStates?.[val]?.status || "To-do");
                  }}>
                    <SelectTrigger className="h-11 rounded-sm bg-background">
                      <SelectValue placeholder="Target Member..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(actionTask?.assigneeStates || {}).map(s => (
                        <SelectItem key={s.userId} value={s.userId} className="text-xs font-bold">{s.userName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
               </div>
            ) : (
              <div className="p-4 bg-primary/5 rounded-sm flex items-center gap-3">
                <User className="h-5 w-5 text-primary" />
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase text-muted-foreground">Self Audit</span>
                  <span className="text-sm font-black">{userProfile?.username}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Current State</Label>
                <div className="mt-1">
                  <StatusBadge status={actionTask?.assigneeStates?.[selectedUpdateUserId || user?.uid || ""]?.status || "To-do"} className="h-8 px-3" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Update To</Label>
                <Select value={pendingStatus} onValueChange={(val: any) => setPendingStatus(val)}>
                  <SelectTrigger className="rounded-sm h-11 border-primary/20 bg-background font-bold text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt} className="text-xs font-bold">{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground" htmlFor="task-remarks">Progress Report / Findings</Label>
              <Textarea 
                id="task-remarks" 
                placeholder="Detail current accomplishments or blockers..." 
                defaultValue={actionTask?.assigneeStates?.[selectedUpdateUserId || user?.uid || ""]?.remarks}
                className="rounded-sm min-h-[120px]" 
              />
            </div>
          </div>
          <DialogFooter className="bg-muted/10 p-6 -mx-6 -mb-6 border-t gap-3 flex flex-col sm:flex-row">
            <DialogClose asChild><Button variant="outline" className="rounded-sm font-bold uppercase text-[10px] h-11 tracking-widest">Cancel</Button></DialogClose>
            <Button 
              className="rounded-sm font-black uppercase text-[10px] h-11 tracking-widest px-8 shadow-lg shadow-primary/20" 
              onClick={() => {
                const remarks = (document.getElementById('task-remarks') as HTMLTextAreaElement)?.value || "";
                handleUpdateStatus(remarks);
              }}
              disabled={isUpdating || !pendingStatus}
            >
              {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Publish Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingTask} onOpenChange={(o) => !o && setDeletingTask(null)}>
        <AlertDialogContent className="rounded-sm max-md w-[95vw]">
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-destructive font-black uppercase tracking-tight">
                  <Trash2 className="h-5 w-5" /> Purge Task Record
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm font-medium leading-relaxed">
                    Permanently delete <strong>{deletingTask?.title}</strong>? This removes all assignee history and progress logs.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="rounded-sm font-bold uppercase text-[10px] h-11">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90 rounded-sm font-bold uppercase text-[10px] h-11 shadow-lg">
                    Confirm Removal
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function subDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

function subMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
}
