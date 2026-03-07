"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp, query, where, increment, getDoc } from "firebase/firestore";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Check, ChevronsUpDown, Loader2, CheckSquare, Calendar, UserPlus, MessageCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { isSuperAdmin } from "@/lib/auth-constants";
import { useRouter } from "next/navigation";

const taskSchema = z.object({
  siteName: z.string().min(1, "Site is required"),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(5, "Description must be at least 5 characters"),
  assignedToId: z.string().min(1, "Please assign a user"),
  priority: z.enum(["Low", "Medium", "High"], { required_error: "Priority is required" }),
  dueDate: z.string().min(1, "Due date is required"),
});

type Site = {
  id: string;
  name: string;
};

type UserProfile = {
  id: string;
  username: string;
  email: string;
  role: string;
  mobile?: string;
  siteManagerId?: string;
  assignedProjectIds?: string[];
  pointsMultiplier?: number;
};

type RewardSettings = {
  taskAssignment?: number;
};

export default function CreateTaskPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  // Sites query
  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  // Users query: Admins see all, Managers see team, Engineers see all for collaboration
  const usersQuery = useMemoFirebase(() => {
    const colRef = collection(firestore, 'users');
    if (isAdmin) return colRef;
    if (isManager) return query(colRef, where('siteManagerId', '==', user?.uid));
    // Engineers can assign tasks to any registered personnel
    return colRef;
  }, [firestore, isAdmin, isManager, user]);
  const { data: teamUsers } = useCollection<UserProfile>(usersQuery);

  // Fetch team members for managers to aggregate sites
  const teamQuery = useMemoFirebase(() => {
    if (!isManager || !user) return null;
    return query(collection(firestore, 'users'), where('siteManagerId', '==', user.uid));
  }, [firestore, user, isManager]);
  const { data: teamMembers } = useCollection<UserProfile>(teamQuery);

  const accessibleSites = React.useMemo(() => {
    if (!allSites || !userProfile) return [];
    if (isAdmin) {
        return Array.from(new Map(allSites.map(s => [s.name, s])).values());
    }
    
    // Aggregated site visibility for Managers
    const assignedIds = new Set<string>(userProfile.assignedProjectIds || []);
    if (isManager && teamMembers) {
      teamMembers.forEach(member => {
        (member.assignedProjectIds || []).forEach(id => assignedIds.add(id));
      });
    }

    const filtered = allSites.filter(s => assignedIds.has(s.id));
    return Array.from(new Map(filtered.map(s => [s.name, s])).values());
  }, [allSites, userProfile, isAdmin, isManager, teamMembers]);

  const settingsRef = useMemoFirebase(() => doc(firestore, 'system_settings', 'rewards'), [firestore]);
  const { data: rewardSettings } = useDoc<RewardSettings>(settingsRef);

  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  const [isUserPopoverOpen, setIsUserPopoverOpen] = React.useState(false);
  const [userSearchQuery, setUserSearchQuery] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [submittedTask, setSubmittedTask] = React.useState<{ title: string, siteName: string, assigneeName: string, assigneeMobile?: string } | null>(null);

  const form = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: { 
      siteName: "", 
      title: "",
      description: "",
      assignedToId: "",
      priority: "Medium",
      dueDate: format(new Date(), 'yyyy-MM-dd'),
    },
  });

  const triggerWhatsApp = (title: string, site: string, mobile?: string) => {
    if (!mobile) {
      toast({ variant: 'destructive', title: 'No Mobile', description: 'Assigned user does not have a mobile number linked for WhatsApp notifications.' });
      return;
    }
    const cleanMobile = mobile.replace(/\D/g, '');
    const formattedMobile = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;
    const message = `Hello, a new task has been assigned to you.\n\nTask: ${title}\nSite: ${site}\n\nPlease check your Aditya Pro dashboard for details.\nLink: ${window.location.origin}/tasks/list`;
    const url = `https://wa.me/${formattedMobile}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const onSubmit = async (values: z.infer<typeof taskSchema>) => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);
    try {
      const assignedUser = teamUsers?.find(u => u.id === values.assignedToId);
      
      const taskData = {
        ...values,
        assignedToName: assignedUser?.username || assignedUser?.email || "Unknown",
        assignedById: user.uid,
        assignedByName: userProfile.username || user.email || "Unknown",
        status: "To-do",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      addDocumentNonBlocking(collection(firestore, 'tasks'), taskData);

      // Reward Points Logic for Assigner
      const rate = rewardSettings?.taskAssignment ?? 0.1;
      const multiplier = userProfile.pointsMultiplier || 1;
      updateDocumentNonBlocking(doc(firestore, 'users', user.uid), {
        totalPoints: increment(rate * multiplier)
      });

      // Notify Assignee via platform notifications
      addDocumentNonBlocking(collection(firestore, 'notifications'), {
        userId: values.assignedToId,
        title: "New Task Assigned",
        description: `${userProfile.username} assigned you a new task: "${values.title}" for site ${values.siteName}.`,
        link: "/tasks/list",
        read: false,
        createdAt: serverTimestamp(),
      });
      
      setSubmittedTask({
        title: values.title,
        siteName: values.siteName,
        assigneeName: assignedUser?.username || "Personnel",
        assigneeMobile: assignedUser?.mobile
      });
      setIsSubmitted(true);
      setIsSubmitting(false);
      toast({ title: "Task Assigned", description: "The task has been successfully created. Points updated." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
      setIsSubmitting(false);
    }
  };

  const filteredSites = accessibleSites.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase()));
  const filteredUsers = teamUsers?.filter(u => u.username.toLowerCase().includes(userSearchQuery.toLowerCase()) || u.email.toLowerCase().includes(userSearchQuery.toLowerCase())) || [];

  if (isSubmitted && submittedTask) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full animate-in fade-in zoom-in-95 duration-300">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-primary/10 p-4 rounded-full">
                <CheckCircle2 className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Task Assigned</CardTitle>
            <CardDescription className="text-base">
              The task <strong className="text-primary">"{submittedTask.title}"</strong> has been successfully delegated to {submittedTask.assigneeName}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg font-semibold rounded-sm" 
              onClick={() => triggerWhatsApp(submittedTask.title, submittedTask.siteName, submittedTask.assigneeMobile)}
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              Notify via WhatsApp
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-11 rounded-sm" onClick={() => router.push('/tasks/list')}>
                View Task List
              </Button>
              <Button variant="secondary" className="h-11 rounded-sm" onClick={() => {
                setIsSubmitted(false);
                setSubmittedTask(null);
                form.reset();
              }}>
                Assign Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
          <CheckSquare className="h-8 w-8" /> Assign New Task
        </h1>
        <p className="text-muted-foreground">Create and delegate work items to site personnel.</p>
      </div>

      <Card className="shadow-md border-primary/10 rounded-sm">
        <CardHeader>
          <CardTitle>Task Assignment Form</CardTitle>
          <CardDescription>Fill in the details to assign a task.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="siteName" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Project Site</FormLabel>
                    <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button 
                            variant="outline" 
                            role="combobox" 
                            className={cn("w-full justify-between font-normal rounded-sm", !field.value && "text-muted-foreground")}
                          >
                            {field.value || "Select site..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <div className="flex items-center border-b px-3">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <Input 
                            placeholder="Search sites..." 
                            className="h-9 w-full border-none focus-visible:ring-0 px-0" 
                            value={siteSearchQuery} 
                            onChange={(e) => setSiteSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                          />
                        </div>
                        <ScrollArea className="h-[200px]">
                          {filteredSites.length > 0 ? filteredSites.map((site) => (
                            <Button 
                                key={site.id} 
                                type="button" 
                                variant="ghost" 
                                className="w-full justify-start font-normal text-left" 
                                onClick={() => { field.onChange(site.name); setIsSitePopoverOpen(false); }}
                            >
                              <Check className={cn("mr-2 h-4 w-4 shrink-0", site.name === field.value ? "opacity-100" : "opacity-0")} />
                              <span className="truncate">{site.name}</span>
                            </Button>
                          )) : (
                            <div className="p-4 text-center text-sm text-muted-foreground">No sites found.</div>
                          )}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="assignedToId" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Assign To</FormLabel>
                    <Popover open={isUserPopoverOpen} onOpenChange={setIsUserPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button 
                            variant="outline" 
                            role="combobox" 
                            className={cn("w-full justify-between font-normal rounded-sm", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? teamUsers?.find(u => u.id === field.value)?.username : "Select personnel..."}
                            <UserPlus className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <div className="flex items-center border-b px-3">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <Input 
                            placeholder="Search personnel..." 
                            className="h-9 w-full border-none focus-visible:ring-0 px-0" 
                            value={userSearchQuery} 
                            onChange={(e) => setUserSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                          />
                        </div>
                        <ScrollArea className="h-[200px]">
                          {filteredUsers.length > 0 ? filteredUsers.map((u) => (
                            <Button 
                                key={u.id} 
                                type="button" 
                                variant="ghost" 
                                className="w-full justify-start font-normal text-left" 
                                onClick={() => { field.onChange(u.id); setIsUserPopoverOpen(false); }}
                            >
                              <Check className={cn("mr-2 h-4 w-4 shrink-0", u.id === field.value ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col">
                                <span className="truncate">{u.username}</span>
                                <span className="text-[10px] text-muted-foreground">{u.role}</span>
                              </div>
                            </Button>
                          )) : (
                            <div className="p-4 text-center text-sm text-muted-foreground">No personnel found.</div>
                          )}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Conduct module mounting audit" {...field} className="rounded-sm" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Detailed Instructions</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Explain exactly what needs to be done..." 
                      rows={4} 
                      {...field} 
                      className="rounded-sm" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-sm">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="dueDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type="date" {...field} className="rounded-sm pr-10" />
                        <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t">
                <Button variant="ghost" type="button" onClick={() => router.back()}>Cancel</Button>
                <Button type="submit" className="min-w-[150px] h-11 rounded-sm text-lg font-semibold" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Assigning...</> : "Assign Task"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
