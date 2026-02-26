
"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, updateDocumentNonBlocking, deleteDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, or, serverTimestamp, increment, getDoc } from "firebase/firestore";
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

type Task = {
  id: string;
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
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [activeTab, setActiveTab] = React.useState("my-tasks");
  const [actionTask, setActionTask] = React.useState<Task | null>(null);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [deletingTask, setDeletingTask] = React.useState<Task | null>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  // Tasks Query
  const tasksQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const colRef = collection(firestore, 'tasks');
    
    if (isAdmin) return colRef;
    
    // For Managers & Engineers, we use OR query to see tasks assigned TO or BY them
    return query(colRef, or(where('assignedToId', '==', user.uid), where('assignedById', '==', user.uid)));
  }, [firestore, user, userProfile, isAdmin]);

  const { data: tasks, isLoading } = useCollection<Task>(tasksQuery);

  const filteredTasks = React.useMemo(() => {
    if (!tasks) return [];
    
    let list = tasks.filter(task => {
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
  }, [tasks, searchTerm, statusFilter, activeTab, user]);

  const stats = React.useMemo(() => {
    if (!tasks) return { todo: 0, inProgress: 0, completed: 0 };
    const myTasks = tasks.filter(t => t.assignedToId === user?.uid);
    return {
      todo: myTasks.filter(t => t.status === 'To-do').length,
      inProgress: myTasks.filter(t => t.status === 'In Progress').length,
      completed: myTasks.filter(t => t.status === 'Completed').length,
    };
  }, [tasks, user]);

  const handleUpdateStatus = async (remarks: string, nextStatus: Task['status']) => {
    if (!actionTask) return;
    setIsUpdating(true);
    
    const taskRef = doc(firestore, 'tasks', actionTask.id);
    updateDocumentNonBlocking(taskRef, {
        status: nextStatus,
        remarks: remarks || actionTask.remarks || "",
        updatedAt: serverTimestamp()
    });

    // Reward Points Logic for Assignee on Completion
    if (nextStatus === 'Completed') {
        const assigneeDoc = await getDoc(doc(firestore, 'users', actionTask.assignedToId));
        if (assigneeDoc.exists()) {
            const assigneeData = assigneeDoc.data();
            const multiplier = assigneeData.pointsMultiplier || 1;
            const pointsToAdd = 0.1 * multiplier;
            
            updateDocumentNonBlocking(doc(firestore, 'users', actionTask.assignedToId), {
                totalPoints: increment(pointsToAdd)
            });
            
            // Notify Assignee about points
            addDocumentNonBlocking(collection(firestore, 'notifications'), {
                userId: actionTask.assignedToId,
                title: "Points Earned!",
                description: `You earned ${pointsToAdd.toFixed(2)} points for completing task: "${actionTask.title}".`,
                link: `/rewards`,
                read: false,
                createdAt: serverTimestamp(),
            });
        }
    }

    // Notify Assigner
    if (actionTask.assignedById !== user?.uid) {
        addDocumentNonBlocking(collection(firestore, 'notifications'), {
            userId: actionTask.assignedById,
            title: `Task Update: ${nextStatus}`,
            description: `${userProfile?.username || 'Team member'} marked task "${actionTask.title}" as ${nextStatus}.`,
            link: "/tasks/list",
            read: false,
            createdAt: serverTimestamp(),
        });
    }

    toast({ title: "Task Updated", description: `Status changed to ${nextStatus}. Points updated if completed.` });
    setIsUpdating(false);
    setActionTask(null);
  };

  const handleDelete = () => {
    if (!deletingTask) return;
    deleteDocumentNonBlocking(doc(firestore, 'tasks', deletingTask.id));
    toast({ title: "Deleted", description: "Task has been removed." });
    setDeletingTask(null);
  };

  if (isLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <ListTodo className="h-8 w-8" /> Tasks Management
          </h1>
          <p className="text-muted-foreground">Monitor and update site activity assignments.</p>
        </div>
        <Button onClick={() => window.location.href = '/tasks/create'} className="rounded-sm font-bold">
          Assign New Task
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-500/5 border-slate-500/10 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Pending Tasks</CardTitle>
            <Clock className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todo}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Awaiting start</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-blue-500/10 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Ongoing</CardTitle>
            <Loader2 className="h-4 w-4 text-blue-500 animate-spin-slow" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{stats.inProgress}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">Currently in progress</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/10 rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Finished</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{stats.completed}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">Tasks completed</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
            <TabsList className="grid w-full grid-cols-3 md:w-[400px] rounded-sm bg-muted/50">
              <TabsTrigger value="my-tasks" className="rounded-sm text-xs font-bold uppercase tracking-tight">My Tasks</TabsTrigger>
              <TabsTrigger value="assigned-by-me" className="rounded-sm text-xs font-bold uppercase tracking-tight">Assigned By Me</TabsTrigger>
              <TabsTrigger value="all" className="rounded-sm text-xs font-bold uppercase tracking-tight">All Records</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search tasks..." 
                className="pl-9 rounded-sm h-10 border-primary/20"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] rounded-sm h-10 border-primary/20">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="shadow-md border-primary/10 rounded-sm overflow-hidden">
          <CardContent className="p-0">
            {filteredTasks.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-32">Due Date</TableHead>
                    <TableHead>Task & Site</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right px-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => (
                    <TableRow key={task.id} className="hover:bg-muted/5 transition-colors">
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
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <div className="flex flex-col">
                            <span className="text-xs font-bold leading-none">{task.assignedToName}</span>
                            <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter mt-0.5">By: {task.assignedByName}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={task.status} /></TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex justify-end items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-primary hover:bg-primary/10" 
                            onClick={() => setActionTask(task)}
                            title="Update Status"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingTask(task)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-24 text-muted-foreground italic bg-muted/5">
                No tasks found matching your filters.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Task Update Dialog */}
      <Dialog open={!!actionTask} onOpenChange={() => setActionTask(null)}>
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
                <Select defaultValue={actionTask?.status} onValueChange={(val: any) => {
                  const remarks = (document.getElementById('task-remarks') as HTMLTextAreaElement)?.value || "";
                  handleUpdateStatus(remarks, val);
                }}>
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
              handleUpdateStatus(remarks, actionTask?.status as any);
            }}>
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Remarks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
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
