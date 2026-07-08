'use client';

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp, query, increment, where, getDocs } from "firebase/firestore";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Search, Check, ChevronsUpDown, Loader2, CheckSquare, Calendar, UserPlus, CheckCircle2, LayoutGrid, Globe, Users, Plus, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { isSuperAdmin } from "@/lib/auth-constants";
import { useRouter } from "next/navigation";
import { sendNotification } from "@/lib/notifications";
import { slugifyRole } from "@/lib/access-control";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

const taskSchema = z.object({
  taskCategory: z.enum(["Site-related", "Other"], { required_error: "Please select a task category" }),
  siteName: z.string().optional(),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(5, "Description must be at least 5 characters"),
  assignedUserIds: z.array(z.string()).default([]),
  assignedRoles: z.array(z.string()).default([]),
  priority: z.enum(["Low", "Medium", "High"], { required_error: "Priority is required" }),
  dueDate: z.string().min(1, "Due date is required"),
}).refine((data) => {
  if (data.taskCategory === "Site-related" && (!data.siteName || data.siteName.trim() === "")) {
    return false;
  }
  return true;
}, {
  message: "Site selection is mandatory for site-related tasks",
  path: ["siteName"],
}).refine((data) => {
  return data.assignedUserIds.length > 0 || data.assignedRoles.length > 0;
}, {
  message: "Assign at least one user or role",
  path: ["assignedUserIds"],
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
  ownDataOnly?: boolean;
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
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<any>(roleConfigsQuery);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allRegisteredUsers } = useCollection<UserProfile>(usersQuery);

  const rolesQuery = useMemoFirebase(() => collection(firestore, 'user_roles'), [firestore]);
  const { data: availableRoles } = useCollection<{ name: string }>(rolesQuery);

  const accessibleSites = React.useMemo(() => {
    if (!allSites || !userProfile) return [];
    if (isAdmin) return Array.from(new Map(allSites.map(s => [s.name, s])).values()).sort((a, b) => a.name.localeCompare(b.name));
    
    const roleId = userProfile.role ? slugifyRole(userProfile.role) : 'none';
    const isOwnDataOnly = userProfile.ownDataOnly !== undefined 
      ? userProfile.ownDataOnly 
      : roleConfigs?.find(c => c.id === roleId)?.ownDataOnly ?? false;

    if (!isOwnDataOnly) return Array.from(new Map(allSites.map(s => [s.name, s])).values()).sort((a, b) => a.name.localeCompare(b.name));

    const siteIds = new Set<string>(userProfile.assignedProjectIds || []);
    const filtered = allSites.filter(s => siteIds.has(s.id));
    return Array.from(new Map(filtered.map(s => [s.name, s])).values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allSites, userProfile, isAdmin, roleConfigs]);

  const settingsRef = useMemoFirebase(() => doc(firestore, 'system_settings', 'rewards'), [firestore]);
  const { data: rewardSettings } = useDoc<RewardSettings>(settingsRef);

  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  const [isUserPopoverOpen, setIsUserPopoverOpen] = React.useState(false);
  const [userSearchQuery, setUserSearchQuery] = React.useState("");
  const [isRolePopoverOpen, setIsRolePopoverOpen] = React.useState(false);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [submittedTask, setSubmittedTask] = React.useState<{ title: string, siteName: string, count: number } | null>(null);

  const form = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: { 
      taskCategory: "Site-related",
      siteName: "", 
      title: "",
      description: "",
      assignedUserIds: [],
      assignedRoles: [],
      priority: "Medium",
      dueDate: format(new Date(), 'yyyy-MM-dd'),
    },
  });

  const watchCategory = form.watch('taskCategory');
  const watchedUsers = form.watch('assignedUserIds');
  const watchedRoles = form.watch('assignedRoles');

  React.useEffect(() => {
    if (watchCategory === 'Other') {
      form.setValue('siteName', '');
    }
  }, [watchCategory, form]);

  const onSubmit = async (values: z.infer<typeof taskSchema>) => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);
    try {
      // Resolve final set of assignees from roles and individual IDs
      const roleUsers = allRegisteredUsers?.filter(u => values.assignedRoles.includes(u.role || "")) || [];
      const individualUsers = allRegisteredUsers?.filter(u => values.assignedUserIds.includes(u.id)) || [];
      
      const assigneeMap = new Map<string, UserProfile>();
      [...roleUsers, ...individualUsers].forEach(u => assigneeMap.set(u.id, u));
      const finalAssigneesList = Array.from(assigneeMap.values());

      if (finalAssigneesList.length === 0) {
        toast({ variant: "destructive", title: "Assignment Error", description: "No valid personnel found for selection." });
        setIsSubmitting(false);
        return;
      }

      const selectedSiteObj = values.siteName ? accessibleSites.find(s => s.name === values.siteName) : null;
      
      const assigneeStates: Record<string, any> = {};
      finalAssigneesList.forEach(a => {
        assigneeStates[a.id] = {
          userId: a.id,
          userName: a.username || a.email || "Unknown",
          status: "To-do",
          updatedAt: new Date().toISOString(),
          remarks: ""
        };
      });

      const taskData = {
        taskCategory: values.taskCategory,
        siteId: selectedSiteObj?.id || "",
        siteName: values.taskCategory === 'Site-related' ? (values.siteName || "Unknown") : "Other",
        title: values.title,
        description: values.description,
        priority: values.priority,
        dueDate: values.dueDate,
        
        // Multi-assignee fields
        assigneeIds: finalAssigneesList.map(a => a.id),
        assigneeStates: assigneeStates,
        
        assignedById: user.uid,
        assignedByName: userProfile.username || user.email || "Unknown",
        status: "To-do",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDocumentNonBlocking(collection(firestore, 'tasks'), taskData);

      const rate = rewardSettings?.taskAssignment ?? 0.25;
      const multiplier = userProfile.pointsMultiplier || 1;
      updateDocumentNonBlocking(doc(firestore, 'users', user.uid), {
        totalPoints: increment(rate * multiplier)
      });

      finalAssigneesList.forEach(assignee => {
        sendNotification(firestore, {
          userId: assignee.id,
          title: "New Task Assigned",
          description: `${userProfile.username} assigned you a new task: "${values.title}" for ${taskData.siteName}.`,
          link: "/tasks/list",
          push: true
        });
      });

      setSubmittedTask({
        title: values.title,
        siteName: taskData.siteName,
        count: finalAssigneesList.length
      });
      setIsSubmitted(true);
      toast({ title: "Task Assigned", description: `Task delegated to ${finalAssigneesList.length} personnel.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSites = accessibleSites.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase()));
  const filteredUsers = allRegisteredUsers?.filter(u => u.username.toLowerCase().includes(userSearchQuery.toLowerCase()) || u.email.toLowerCase().includes(userSearchQuery.toLowerCase())) || [];

  if (isProfileLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;

  if (isSubmitted && submittedTask) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full animate-in fade-in zoom-in-95 duration-300 rounded-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-primary/10 p-4 rounded-full">
                <CheckCircle2 className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Task Distributed</CardTitle>
            <CardDescription className="text-base">
              The task <strong className="text-primary">"{submittedTask.title}"</strong> has been successfully assigned to {submittedTask.count} personnel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full h-11 rounded-sm font-bold" onClick={() => router.push('/tasks/list')}>
              View Task Board
            </Button>
            <Button className="w-full h-11 rounded-sm font-bold" onClick={() => {
              setIsSubmitted(false);
              setSubmittedTask(null);
              form.reset();
            }}>
              Assign Another Task
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2">
          <CheckSquare className="h-8 w-8 text-primary" /> Assign New Task
        </h1>
        <p className="text-muted-foreground">Delegate work items to specific personnel or entire roles.</p>
      </div>

      <Card className="shadow-md border-primary/10 rounded-sm">
        <CardHeader>
          <CardTitle>Multi-User Task Form</CardTitle>
          <CardDescription>Select project context and specify assignees by individual selection or role.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="taskCategory"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Classification</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex gap-6 h-11 items-center"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Site-related" id="cat-site" />
                          <Label htmlFor="cat-site" className="font-bold cursor-pointer flex items-center gap-1.5 text-xs uppercase">
                            <LayoutGrid className="h-3.5 w-3.5 text-primary" /> Site-related
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Other" id="cat-other" />
                          <Label htmlFor="cat-other" className="font-bold cursor-pointer flex items-center gap-1.5 text-xs uppercase">
                            <Globe className="h-3.5 w-3.5 text-slate-500" /> Other
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="siteName" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className={cn("text-[10px] font-bold uppercase tracking-wider", watchCategory === 'Other' ? "text-muted-foreground/30" : "text-muted-foreground")}>
                      Project Site
                    </FormLabel>
                    <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button 
                            variant="outline" 
                            role="combobox" 
                            disabled={watchCategory === 'Other'}
                            className={cn(
                              "w-full justify-between font-normal rounded-sm h-11", 
                              !field.value && "text-muted-foreground",
                              watchCategory === 'Other' && "opacity-50 grayscale bg-muted"
                            )}
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
                            className="h-9 w-full border-none focus-visible:ring-0 px-0 text-sm" 
                            value={siteSearchQuery} 
                            onChange={(e) => setSiteSearchQuery(e.target.value)} 
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
                            <div className="p-4 text-center text-sm text-muted-foreground italic">No authorized sites found.</div>
                          )}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="dueDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Due Date</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type="date" {...field} className="rounded-sm pr-10 h-11" />
                        <Calendar className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Assign To (Multiple Targets)</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-1.5">
                      <Label className="text-[9px] font-bold uppercase text-muted-foreground">Target Roles</Label>
                      <Popover open={isRolePopoverOpen} onOpenChange={setIsRolePopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-between font-normal rounded-sm h-11", watchedRoles.length === 0 && "text-muted-foreground")}>
                            <span className="truncate">{watchedRoles.length > 0 ? `${watchedRoles.length} Roles Selected` : "Select Roles..."}</span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <ScrollArea className="h-[200px]">
                            <div className="p-2 space-y-1">
                              {availableRoles?.map((role) => (
                                <div 
                                  key={role.name} 
                                  className={cn(
                                    "flex items-center space-x-2 p-2.5 rounded-sm hover:bg-primary/5 transition-colors cursor-pointer group",
                                    watchedRoles.includes(role.name) && "bg-primary/5"
                                  )}
                                  onClick={() => {
                                    const next = watchedRoles.includes(role.name) ? watchedRoles.filter(r => r !== role.name) : [...watchedRoles, role.name];
                                    form.setValue('assignedRoles', next);
                                  }}
                                >
                                  <Checkbox checked={watchedRoles.includes(role.name)} className="rounded-full" />
                                  <span className={cn("text-xs font-bold uppercase transition-colors", watchedRoles.includes(role.name) ? "text-primary" : "text-foreground")}>{role.name}</span>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                   </div>

                   <div className="space-y-1.5">
                      <Label className="text-[9px] font-bold uppercase text-muted-foreground">Target Individuals</Label>
                      <Popover open={isUserPopoverOpen} onOpenChange={setIsUserPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-between font-normal rounded-sm h-11", watchedUsers.length === 0 && "text-muted-foreground")}>
                            <span className="truncate">{watchedUsers.length > 0 ? `${watchedUsers.length} Personnel Selected` : "Choose Personnel..."}</span>
                            <UserPlus className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <div className="flex items-center border-b px-3 bg-muted/20">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <Input placeholder="Search personnel..." className="h-10 w-full border-none focus-visible:ring-0 px-0 text-xs bg-transparent" value={userSearchQuery} onChange={e => setUserSearchQuery(e.target.value)} />
                          </div>
                          <ScrollArea className="h-[250px]">
                            <div className="p-2 space-y-1">
                              {filteredUsers.map(u => (
                                <div 
                                  key={u.id} 
                                  className={cn(
                                    "flex items-center space-x-3 p-2.5 rounded-sm hover:bg-primary/5 transition-colors cursor-pointer group",
                                    watchedUsers.includes(u.id) && "bg-primary/5"
                                  )}
                                  onClick={() => {
                                    const next = watchedUsers.includes(u.id) ? watchedUsers.filter(id => id !== u.id) : [...watchedUsers, u.id];
                                    form.setValue('assignedUserIds', next);
                                  }}
                                >
                                  <Checkbox checked={watchedUsers.includes(u.id)} className="rounded-full" />
                                  <div className="flex flex-col min-w-0">
                                    <span className={cn("text-xs font-bold truncate transition-colors", watchedUsers.includes(u.id) ? "text-primary" : "text-foreground")}>{u.username}</span>
                                    <span className="text-[8px] text-muted-foreground uppercase font-black tracking-tight">{u.role}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                   </div>
                </div>
                <FormMessage />
              </div>

              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Task Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Quality audit for block A" {...field} className="rounded-sm h-11" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description & Deliverables</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Detail the work requirements..." 
                      rows={5} 
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
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Priority Level</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-sm h-11">
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
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t">
                <Button variant="ghost" type="button" onClick={() => router.back()} className="rounded-sm font-bold">Cancel</Button>
                <Button type="submit" className="min-w-[220px] h-12 rounded-sm font-black uppercase tracking-widest shadow-lg" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> DISPATCHING...</> : "Distribute Task"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
