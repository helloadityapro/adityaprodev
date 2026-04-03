
"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, serverTimestamp, increment, getDoc, limit } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ListTodo, Search, Pencil, Trash2, Loader2, Clock, Calendar, FilterX, CheckCircle2, AlertCircle, User, MapPin, MoreHorizontal, ArrowRight } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "next/navigation";
import { sendNotification } from "@/lib/notifications";

type Task = {
  id: string;
  siteId?: string;
  siteName: string;
  title: string;
  description: string;
  assignedToId: string;
  assignedToName: string;
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

function StatusBadge({ status }: { status: string }) {
  const config = {
    "To-do": "bg-slate-100 text-slate-800 border-slate-200",
    "In Progress": "bg-blue-100 text-blue-800 border-blue-200",
    "Completed": "bg-green-100 text-green-800 border-green-200",
    "Cancelled": "bg-red-100 text-red-800 border-red-200",
  };
  return (
    <Badge variant="outline" className={cn("rounded-sm text-[10px] font-bold uppercase", (config as any)[status])}>
      {status}
    </Badge>
  );
}

export default function TaskListPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [activeTab, setActiveTab] = React.useState("all");
  
  const [actionTask, setActionTask] = React.useState<Task | null>(null);
  const [pendingStatus, setPendingStatus] = React.useState<Task['status'] | "">("");
  
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [deletingTask, setDeletingTask] = React.useState<Task | null>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<AccessConfig>(roleConfigsQuery);

  const isSuper = isSuperAdmin(user?.email);
  const isAdmin = isSuper || userProfile?.role === 'Admin';

  const tasksQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    return query(collection(firestore, 'tasks'), limit(1000));
  }, [firestore, user, userProfile]);

  const { data: tasks, isLoading } = useCollection<Task>(tasksQuery);

  const settingsRef = useMemoFirebase(() => doc(firestore, 'system_settings', 'rewards'), [firestore]);
  const { data: rewardSettings } = useDoc<RewardSettings>(settingsRef);

  const filteredTasks = React.useMemo(() => {
    if (!tasks || !userProfile) return [];
    
    let list = tasks;

    if (!isAdmin) {
      list = list.filter(task => 
        task.assignedToId === user?.uid || task.assignedById === user?.uid
      );
    }

    const isOwnDataOnly = userProfile.ownDataOnly !== undefined 
      ? userProfile.ownDataOnly 
      : roleConfigs?.find(c => c.id === userProfile.role)?.ownDataOnly ?? false;

    if (isOwnDataOnly && !isSuper) {
      const assignedIds = new Set(userProfile.assignedProjectIds || []);
      list = list.filter(task => {
        if (!task.siteId) return true;
        return assignedIds.has(task.siteId);
      });
    }

    list = list.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.assignedToName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      
      const matchesTab = activeTab === 'all' || 
        (activeTab === 'my-tasks' && task.assignedToId === user?.uid) ||
        (activeTab === 'assigned-by-me' && task.assignedById === user?.uid);

      return matchesSearch && matchesStatus && matchesTab;
    });

    return list.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
        const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
        return dateB - dateA;
    });
  }, [tasks, searchTerm, statusFilter, activeTab, user, userProfile, roleConfigs, isSuper, isAdmin]);

  const stats = React.useMemo(() => {
    const myTasks = filteredTasks.filter(t => t.assignedToId === user?.uid);
    return {
      todo: myTasks.filter(t => t.status === 'To-do').length,
      inProgress: myTasks.filter(t => t.status === 'In Progress').length,
      completed: myTasks.filter(t => t.status === 'Completed').length,
    };
  }, [filteredTasks, user]);

  const handleUpdateStatus = async (remarks: string) => {
    if (!actionTask || !pendingStatus) return;
    setIsUpdating(true);
    
    const nextStatus = pendingStatus;

    if (actionTask.status === 'Completed' && nextStatus === 'Completed') {
        setActionTask(null);
        setIsUpdating(false);
        return;
    }

    const taskRef = doc(firestore, 'tasks', actionTask.id);
    updateDocumentNonBlocking(taskRef, {
        status: nextStatus,
        remarks: remarks || actionTask.remarks || "",
        updatedAt: serverTimestamp()
    });

    if (nextStatus === 'Completed' && actionTask.status !== 'Completed') {
        const assigneeRef = doc(firestore, 'users', actionTask.assignedToId);
        const assigneeDoc = await getDoc(assigneeRef);
        if (assigneeDoc.exists()) {
            const assigneeData = assigneeDoc.data();
            const multiplier = assigneeData.pointsMultiplier || 1;
            const rate = rewardSettings?.taskCompletion ?? 0.25;
            const pointsToAdd = rate * multiplier;
            
            updateDocumentNonBlocking(assigneeRef, {
                totalPoints: increment(pointsToAdd)
            });
            
            sendNotification(firestore, {
                userId: actionTask.assignedToId,
                title: "Points Earned!",
                description: `You earned ${pointsToAdd.toFixed(2)} points for completing task: "${actionTask.title}".`,
                link: `/rewards`,
                push: true
            });
        }
    }

    if (actionTask.assignedById !== user?.uid) {
        sendNotification(firestore, {
            userId: actionTask.assignedById,
            title: `Task Update: ${nextStatus}`,
            description: `${userProfile?.username || 'Team member'} marked task "${actionTask.title}" as ${nextStatus}.`,
            link: "/tasks/list",
            push: true
        });
    }

    toast({ title: "Task Updated", description: `Status changed to ${nextStatus}. Points updated if applicable.` });
    setIsUpdating(false);
    setActionTask(null);
    setPendingStatus("");
  };

  const handleDelete = async () => {
    if (!deletingTask || !firestore) return;
    deleteDocumentNonBlocking(doc(firestore, 'tasks', deletingTask.id));
    toast({ title: "Deleted", description: "Task record removed." });
    setDeletingTask(null);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
  };

  if (isLoading || isProfileLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2">
            <ListTodo className="h-8 w-8" /> Tasks Audit
          </h1>
          <p className="text-muted-foreground text-sm font-medium">Monitor and update authorized site activity assignments.</p>
        </div>
        <Button onClick={() => router.push('/tasks/create')} className="rounded-sm font-bold shadow-md">
          Assign New Task
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card className="bg-slate-500/5 border-slate-500/10 rounded-sm">
          <CardHeader className="p-2 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-[8px] sm:text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Pending</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 pt-0">
            <div className="text-base sm:text-2xl font-black">{stats.todo}</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-blue-500/10 rounded-sm">
          <CardHeader className="p-2 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-[8px] sm:text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Ongoing</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 pt-0">
            <div className="text-base sm:text-2xl font-black text-blue-700">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/10 rounded-sm">
          <CardHeader className="p-2 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-[8px] sm:text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Finished</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 pt-0">
            <div className="text-base sm:text-2xl font-black text-green-700">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-3 md:p-4 border border-primary/10 rounded-sm shadow-sm">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
            <TabsList className="grid w-full grid-cols-3 md:w-[400px] rounded-sm bg-muted/50 h-9 p-1">
              <TabsTrigger value="all" className="rounded-sm text-[10px] font-bold uppercase tracking-tight">All Records</TabsTrigger>
              <TabsTrigger value="my-tasks" className="rounded-sm text-[10px] font-bold uppercase tracking-tight">Assigned To Me</TabsTrigger>
              <TabsTrigger value="assigned-by-me" className="rounded-sm text-[10px] font-bold uppercase tracking-tight">Assigned By Me</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search..." 
                className="pl-9 h-9 rounded-sm border-primary/20 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px] rounded-sm h-9 border-primary/20 text-xs font-bold uppercase">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-bold">All Status</SelectItem>
                {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="text-xs font-medium">{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-sm" onClick={clearFilters} title="Clear Filters">
              <FilterX className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </Button>
          </div>
        </div>

        <div className="md:hidden space-y-4">
          {filteredTasks.length > 0 ? filteredTasks.map((task) => (
            <Card key={task.id} className="border-primary/10 rounded-sm shadow-sm overflow-hidden" onClick={() => { setActionTask(task); setPendingStatus(task.status); }}>
              <CardContent className="p-4 space-y-4">
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
                  <PriorityBadge priority={task.priority} />
                </div>

                <div className="pt-2 border-t border-primary/5 flex items-center justify-between">
                  <div className="grid grid-cols-2 gap-4 flex-1">
                    <div className="flex flex-col">
                      <span className="text-[8px] text-muted-foreground uppercase font-black tracking-tighter">Assigned To</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <User className="h-2.5 w-2.5 text-primary" />
                        <span className="text-[10px] font-bold truncate">{task.assignedToName}</span>
                      </div>
                    </div>
                    <div className="flex flex-col border-l pl-4 border-primary/5">
                      <span className="text-[8px] text-muted-foreground uppercase font-black tracking-tighter">Assigned By</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <User className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className="text-[10px] font-bold truncate">{task.assignedByName}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0 ml-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                    {isAdmin && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={(e) => { e.stopPropagation(); setDeletingTask(task); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )) : (
            <div className="text-center py-12 text-muted-foreground italic bg-muted/5 rounded-sm border-2 border-dashed">
              No tasks found matching criteria.
            </div>
          )}
        </div>

        <div className="hidden md:block">
          <Card className="shadow-md border-primary/10 rounded-sm overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-32">Due Date</TableHead>
                    <TableHead>Task & Site</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Assigned By</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right px-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => (
                    <TableRow key={task.id} className="hover:bg-muted/5 transition-colors cursor-pointer" onClick={() => { setActionTask(task); setPendingStatus(task.status); }}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Due By</span>
                          <span className="font-mono text-sm font-bold text-primary">{format(new Date(task.dueDate), 'dd MMM yy')}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-sm leading-tight">{task.title}</span>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                            <MapPin className="h-3 w-3" /> {task.siteName}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><PriorityBadge priority={task.priority} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-bold">{task.assignedToName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium">{task.assignedByName}</span>
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={task.status} /></TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex justify-end items-center gap-1" onClick={e => e.stopPropagation()}>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-primary hover:bg-primary/10 rounded-sm" 
                            onClick={() => { setActionTask(task); setPendingStatus(task.status); }}
                            title="Update Status"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => setDeletingTask(task)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
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

      <Dialog open={!!actionTask} onOpenChange={() => { setActionTask(null); setPendingStatus(""); }}>
        <DialogContent className="rounded-sm max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Task Status</DialogTitle>
            <DialogDescription>
              Record progress for: <strong>{actionTask?.title}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Description</Label>
              <p className="text-sm p-3 bg-muted/20 border rounded-sm italic">"{actionTask?.description}"</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Current Status</Label>
                <div className="mt-1"><StatusBadge status={actionTask?.status || "To-do"} /></div>
              </div>
              <div className="space-y-2">
                <Label>Set New Status</Label>
                <Select value={pendingStatus} onValueChange={(val: any) => setPendingStatus(val)}>
                  <SelectTrigger className="rounded-sm h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-remarks">Update Remarks / Progress Note</Label>
              <Textarea 
                id="task-remarks" 
                placeholder="Briefly explain current progress or issues..." 
                defaultValue={actionTask?.remarks}
                className="rounded-sm" 
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" className="rounded-sm">Cancel</Button></DialogClose>
            <Button className="rounded-sm" onClick={() => {
              const remarks = (document.getElementById('task-remarks') as HTMLTextAreaElement)?.value || "";
              handleUpdateStatus(remarks);
            }}>
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Remarks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingTask} onOpenChange={(o) => !o && setDeletingTask(null)}>
        <AlertDialogContent className="rounded-sm">
            <AlertDialogHeader>
                <AlertDialogTitle>Remove Task?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete task <strong>{deletingTask?.title}</strong>. This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete Task
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
