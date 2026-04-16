"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp, query, increment } from "firebase/firestore";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Search, Check, ChevronsUpDown, Loader2, CheckSquare, Calendar, UserPlus, MessageCircle, CheckCircle2, LayoutGrid, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { isSuperAdmin } from "@/lib/auth-constants";
import { useRouter } from "next/navigation";
import { sendNotification } from "@/lib/notifications";

const taskSchema = z.object({
  taskCategory: z.enum(["Site-related", "Other"], { required_error: "Please select a task category" }),
  siteName: z.string().optional(),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(5, "Description must be at least 5 characters"),
  assignedToId: z.string().min(1, "Please assign a user"),
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

  // Sites query - Global selection allowed for all users
  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  // Users query - Global selection allowed for all users
  const usersQuery = useMemoFirebase(() => {
    return collection(firestore, 'users');
  }, [firestore]);
  const { data: allRegisteredUsers } = useCollection<UserProfile>(usersQuery);

  const accessibleSites = React.useMemo(() => {
    if (!allSites) return [];
    return Array.from(new Map(allSites.map(s => [s.name, s])).values())
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allSites]);

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
      taskCategory: "Site-related",
      siteName: "", 
      title: "",
      description: "",
      assignedToId: "",
      priority: "Medium",
      dueDate: format(new Date(), 'yyyy-MM-dd'),
    },
  });

  const watchCategory = form.watch('taskCategory');

  React.useEffect(() => {
    if (watchCategory === 'Other') {
      form.setValue('siteName', '');
    }
  }, [watchCategory, form]);

  const triggerWhatsApp = (title: string, site: string, mobile?: string) => {
    if (!mobile) {
      toast({ variant: 'destructive', title: 'No Mobile', description: 'Assigned user does not have a mobile number linked for WhatsApp notifications.' });
      return;
    }
    const cleanMobile = mobile.replace(/\D/g, '');
    const formattedMobile = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;
    const message = `Hello, a new task has been assigned to you.\n\nTask: ${title}\nContext: ${site || "General"}\n\nPlease check your Aditya Pro dashboard for details.\nLink: ${window.location.origin}/tasks/list`;
    const url = `https://wa.me/${formattedMobile}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const onSubmit = async (values: z.infer<typeof taskSchema>) => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);
    try {
      const assignedUser = allRegisteredUsers?.find(u => u.id === values.assignedToId);
      const selectedSiteObj = values.siteName ? accessibleSites.find(s => s.name === values.siteName) : null;
      
      const taskData = {
        ...values,
        siteId: selectedSiteObj?.id || "",
        siteName: values.taskCategory === 'Site-related' ? (values.siteName || "Unknown") : "Other",
        assignedToName: assignedUser?.username || assignedUser?.email || "Unknown",
        assignedById: user.uid,
        assignedByName: userProfile.username || user.email || "Unknown",
        status: "To-do",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDocumentNonBlocking(collection(firestore, 'tasks'), taskData);

      // Reward Points Logic for Assigner
      const rate = rewardSettings?.taskAssignment ?? 0.25;
      const multiplier = userProfile.pointsMultiplier || 1;
      updateDocumentNonBlocking(doc(firestore, 'users', user.uid), {
        totalPoints: increment(rate * multiplier)
      });

      // Send Platform and Push Notification
      sendNotification(firestore, {
        userId: values.assignedToId,
        title: "New Task Assigned",
        description: `${userProfile.username} assigned you a new task: "${values.title}" for ${taskData.siteName}.`,
        link: "/tasks/list",
        push: true
      });
      
      setSubmittedTask({
        title: values.title,
        siteName: taskData.siteName,
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
  const filteredUsers = allRegisteredUsers?.filter(u => u.username.toLowerCase().includes(userSearchQuery.toLowerCase()) || u.email.toLowerCase().includes(userSearchQuery.toLowerCase())) || [];

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
              className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg font-semibold rounded-sm shadow-md" 
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
        <h1 className="flex items-center gap-2">
          <CheckSquare className="h-8 w-8" /> Assign New Task
        </h1>
        <p className="text-muted-foreground">Create and delegate work items to any site personnel.</p>
      </div>

      <Card className="shadow-md border-primary/10 rounded-sm">
        <CardHeader>
          <CardTitle>Task Assignment Form</CardTitle>
          <CardDescription>Specify the task context and delegate it to the appropriate personnel.</CardDescription>
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
                            {field.value || "Select any site..."}
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
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Assign To</FormLabel>
                    <Popover open={isUserPopoverOpen} onOpenChange={setIsUserPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button 
                            variant="outline" 
                            role="combobox" 
                            className={cn("w-full justify-between font-normal rounded-sm h-11", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? allRegisteredUsers?.find(u => u.id === field.value)?.username : "Select personnel..."}
                            <UserPlus className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <div className="flex items-center border-b px-3">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <Input 
                            placeholder="Search all personnel..." 
                            className="h-9 w-full border-none focus-visible:ring-0 px-0 text-sm" 
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
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Task Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Conduct module mounting audit" {...field} className="rounded-sm h-11" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Detailed Instructions</FormLabel>
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
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Priority</FormLabel>
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

              <div className="flex justify-end gap-4 pt-4 border-t">
                <Button variant="ghost" type="button" onClick={() => router.back()} className="rounded-sm font-bold">Cancel</Button>
                <Button type="submit" className="min-w-[150px] h-12 rounded-sm font-black uppercase tracking-widest shadow-lg" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> DISPATCHING...</> : "Assign Task"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
