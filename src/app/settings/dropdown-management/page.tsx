'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { Trash2, SlidersHorizontal, Building2, UserCircle2, ShieldCheck, UserCog, UserPlus, Loader2, Check, Pencil, ChevronsUpDown, X, Search, FilterX, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isSuperAdmin } from '@/lib/auth-constants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

type PtwType = {
  id: string;
  name: string;
  authorizedAdminIds?: string[] | null;
  authorizedAdminId?: string | null; // Keep for legacy compat
  authorizedAdminName?: string;
};

type GenericItem = {
  id: string;
  name: string;
};

type UserProfile = {
    id: string;
    username: string;
    email: string;
    role: string;
};

const genericItemSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
});

const ptwTypeSchema = z.object({
  name: z.string().min(1, 'Type name is required.'),
  authorizedAdminIds: z.array(z.string()).default([]),
});

export default function AdminSettingsPage() {
  const firestore = useFirestore();
  const toastResult = useToast();
  const toast = toastResult.toast;
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const [assigningType, setAssigningType] = React.useState<PtwType | null>(null);
  const [selectedAdminIds, setSelectedAdminIds] = React.useState<string[]>([]);
  const [isAssigning, setIsAssigning] = React.useState(false);

  // Search states for each box
  const [roleSearch, setRoleSearch] = React.useState("");
  const [deptSearch, setDeptSearch] = React.useState("");
  const [ptwSearch, setPtwSearch] = React.useState("");

  React.useEffect(() => {
    if (!isUserLoading && !isProfileLoading && !isAdmin) {
      router.replace('/ptw/raise');
    }
  }, [isUserLoading, isProfileLoading, isAdmin, router]);

  const ptwTypesQuery = useMemoFirebase(() => collection(firestore, 'ptw_types'), [firestore]);
  const { data: ptwTypes, isLoading: ptwTypesLoading } = useCollection<PtwType>(ptwTypesQuery);

  const rolesQuery = useMemoFirebase(() => collection(firestore, 'user_roles'), [firestore]);
  const { data: roles } = useCollection<GenericItem>(rolesQuery);

  const departmentsQuery = useMemoFirebase(() => collection(firestore, 'user_departments'), [firestore]);
  const { data: departments } = useCollection<GenericItem>(departmentsQuery);

  const adminsQuery = useMemoFirebase(() => query(collection(firestore, 'users'), where('role', '==', 'Admin')), [firestore]);
  const { data: admins } = useCollection<UserProfile>(adminsQuery);

  const ptwTypeForm = useForm<z.infer<typeof ptwTypeSchema>>({
    resolver: zodResolver(ptwTypeSchema),
    defaultValues: { name: '', authorizedAdminIds: [] },
  });

  const roleForm = useForm<z.infer<typeof genericItemSchema>>({
    resolver: zodResolver(genericItemSchema),
    defaultValues: { name: '' },
  });

  const departmentForm = useForm<z.infer<typeof genericItemSchema>>({
    resolver: zodResolver(genericItemSchema),
    defaultValues: { name: '' },
  });

  const onPtwTypeSubmit = (values: z.infer<typeof ptwTypeSchema>) => {
    const selectedAdmins = admins?.filter(a => values.authorizedAdminIds.includes(a.id)) || [];
    const adminNames = selectedAdmins.length > 0 
      ? selectedAdmins.map(a => a.username || a.email).join(', ') 
      : 'All Admins';
    
    addDocumentNonBlocking(collection(firestore, 'ptw_types'), {
      name: values.name,
      authorizedAdminIds: values.authorizedAdminIds,
      authorizedAdminName: adminNames
    });
    
    toast({ title: 'Success', description: `New PTW Type "${values.name}" added.` });
    ptwTypeForm.reset({ name: '', authorizedAdminIds: [] });
  };

  const onRoleSubmit = (values: z.infer<typeof genericItemSchema>) => {
    addDocumentNonBlocking(collection(firestore, 'user_roles'), values);
    toast({ title: 'Success', description: 'New Role added.' });
    roleForm.reset();
  };

  const onDepartmentSubmit = (values: z.infer<typeof genericItemSchema>) => {
    addDocumentNonBlocking(collection(firestore, 'user_departments'), values);
    toast({ title: 'Success', description: 'New Department added.' });
    departmentForm.reset();
  };

  const deleteItem = (coll: string, id: string) => {
    deleteDocumentNonBlocking(doc(firestore, coll, id));
    toast({ title: 'Deleted' });
  };

  const handleQuickAssign = async () => {
    if (!assigningType) return;
    setIsAssigning(true);
    try {
      const selectedAdmins = admins?.filter(a => selectedAdminIds.includes(a.id)) || [];
      const adminNames = selectedAdmins.length > 0 
        ? selectedAdmins.map(a => a.username || a.email).join(', ') 
        : 'All Admins';
      
      updateDocumentNonBlocking(doc(firestore, 'ptw_types', assigningType.id), {
        authorizedAdminIds: selectedAdminIds,
        authorizedAdminName: adminNames
      });
      
      toast({ title: 'Approvers Updated', description: `Authorization for ${assigningType.name} updated.` });
      setAssigningType(null);
      setSelectedAdminIds([]);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsAssigning(false);
    }
  };

  const filteredRoles = React.useMemo(() => {
    if (!roles) return [];
    return roles.filter(r => r.name.toLowerCase().includes(roleSearch.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [roles, roleSearch]);

  const filteredDepts = React.useMemo(() => {
    if (!departments) return [];
    return departments.filter(d => d.name.toLowerCase().includes(deptSearch.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [departments, deptSearch]);

  const filteredPtwTypes = React.useMemo(() => {
    if (!ptwTypes) return [];
    return ptwTypes.filter(p => p.name.toLowerCase().includes(ptwSearch.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ptwTypes, ptwSearch]);

  if (isUserLoading || isProfileLoading || ptwTypesLoading) {
    return (
        <div className="space-y-6 animate-pulse">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-[400px] w-full" />
        </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6 md:space-y-8 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-foreground">System Configuration</h1>
        <p className="text-muted-foreground font-medium text-sm">Global settings and organizational dropdown management.</p>
      </div>

      <Tabs defaultValue="org" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-10 rounded-sm max-w-md bg-muted/50 border border-primary/10 p-1 h-11">
          <TabsTrigger value="org" className="flex items-center gap-2 rounded-sm font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Building2 className="h-4 w-4" /> Organization
          </TabsTrigger>
          <TabsTrigger value="configuration" className="flex items-center gap-2 rounded-sm font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <SlidersHorizontal className="h-4 w-4" /> PTW Types
          </TabsTrigger>
        </TabsList>

        <TabsContent value="org" className="space-y-10 animate-in fade-in-50 duration-300 m-0">
          <div className="grid gap-10 lg:grid-cols-2">
            {/* Roles Card */}
            <Card className="rounded-sm border-primary/10 shadow-xl overflow-hidden flex flex-col min-h-[600px]">
              <CardHeader className="bg-primary/5 border-b p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-sm"><UserCircle2 className="h-5 w-5 text-primary" /></div>
                  <div className="space-y-1">
                    <CardTitle className="text-base font-black uppercase tracking-widest">Manage Roles</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase text-muted-foreground">Personnel Designation Registry</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6 flex-1 flex flex-col min-h-0">
                <Form {...roleForm}>
                  <form onSubmit={roleForm.handleSubmit(onRoleSubmit)} className="flex items-start gap-3 p-4 bg-muted/30 border rounded-sm">
                    <FormField
                      control={roleForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="flex-grow">
                          <FormControl><Input placeholder="Enter new designation..." {...field} className="rounded-sm h-11 border-primary/10 font-medium" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="rounded-sm font-black uppercase text-[10px] h-11 px-6 shadow-md">Add Role</Button>
                  </form>
                </Form>

                <div className="space-y-3 flex-1 flex flex-col min-h-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search roles..." 
                      className="pl-10 h-10 rounded-sm bg-muted/20 border-none text-sm"
                      value={roleSearch}
                      onChange={(e) => setRoleSearch(e.target.value)}
                    />
                  </div>
                  
                  <div className="rounded-sm border flex-1 overflow-hidden bg-background">
                    <ScrollArea className="h-full">
                      <Table>
                        <TableHeader className="bg-muted/30 sticky top-0 z-10 shadow-sm">
                          <TableRow>
                            <TableHead className="px-6 text-[10px] font-black uppercase tracking-widest">Designation</TableHead>
                            <TableHead className="text-right px-6 w-20"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRoles.length > 0 ? filteredRoles.map((item) => (
                            <TableRow key={item.id} className="hover:bg-muted/5 transition-colors">
                              <TableCell className="px-6 py-4 font-bold text-sm text-foreground">{item.name}</TableCell>
                              <TableCell className="text-right px-6">
                                <Button variant="ghost" size="icon" className="rounded-sm h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteItem('user_roles', item.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )) : (
                            <TableRow><TableCell colSpan={2} className="h-32 text-center text-muted-foreground italic text-xs uppercase opacity-40">No matches found</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Departments Card */}
            <Card className="rounded-sm border-primary/10 shadow-xl overflow-hidden flex flex-col min-h-[600px]">
              <CardHeader className="bg-primary/5 border-b p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-sm"><Building2 className="h-5 w-5 text-primary" /></div>
                  <div className="space-y-1">
                    <CardTitle className="text-base font-black uppercase tracking-widest">Manage Departments</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase text-muted-foreground">Organizational Verticals</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6 flex-1 flex flex-col min-h-0">
                <Form {...departmentForm}>
                  <form onSubmit={departmentForm.handleSubmit(onDepartmentSubmit)} className="flex items-start gap-3 p-4 bg-muted/30 border rounded-sm">
                    <FormField
                      control={departmentForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="flex-grow">
                          <FormControl><Input placeholder="Enter new department..." {...field} className="rounded-sm h-11 border-primary/10 font-medium" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="rounded-sm font-black uppercase text-[10px] h-11 px-6 shadow-md">Add Dept</Button>
                  </form>
                </Form>

                <div className="space-y-3 flex-1 flex flex-col min-h-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search departments..." 
                      className="pl-10 h-10 rounded-sm bg-muted/20 border-none text-sm"
                      value={deptSearch}
                      onChange={(e) => setDeptSearch(e.target.value)}
                    />
                  </div>
                  
                  <div className="rounded-sm border flex-1 overflow-hidden bg-background">
                    <ScrollArea className="h-full">
                      <Table>
                        <TableHeader className="bg-muted/30 sticky top-0 z-10 shadow-sm">
                          <TableRow>
                            <TableHead className="px-6 text-[10px] font-black uppercase tracking-widest">Department Name</TableHead>
                            <TableHead className="text-right px-6 w-20"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredDepts.length > 0 ? filteredDepts.map((item) => (
                            <TableRow key={item.id} className="hover:bg-muted/5 transition-colors">
                              <TableCell className="px-6 py-4 font-bold text-sm text-foreground">{item.name}</TableCell>
                              <TableCell className="text-right px-6">
                                <Button variant="ghost" size="icon" className="rounded-sm h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteItem('user_departments', item.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )) : (
                            <TableRow><TableCell colSpan={2} className="h-32 text-center text-muted-foreground italic text-xs uppercase opacity-40">No matches found</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="configuration" className="space-y-6 animate-in fade-in-50 duration-300 m-0">
          <Card className="rounded-sm border-primary/10 shadow-xl overflow-hidden flex flex-col min-h-[700px]">
            <CardHeader className="bg-primary/5 border-b p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-sm"><ShieldCheck className="h-5 w-5 text-primary" /></div>
                <div className="space-y-1">
                  <CardTitle className="text-base font-black uppercase tracking-widest">Manage PTW Types & Authorization</CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase text-muted-foreground">Define permit categories and set authorized approvers.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-8 flex-1 flex flex-col min-h-0">
              <Form {...ptwTypeForm}>
                <form onSubmit={ptwTypeForm.handleSubmit(onPtwTypeSubmit)} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end p-6 bg-muted/20 border rounded-sm">
                  <FormField
                    control={ptwTypeForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="md:col-span-5">
                        <FormLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Category Name</FormLabel>
                        <FormControl><Input placeholder="e.g. Hot Work" {...field} className="rounded-sm h-11 border-primary/10" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={ptwTypeForm.control}
                    name="authorizedAdminIds"
                    render={({ field }) => (
                      <FormItem className="md:col-span-5">
                        <FormLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Authorized Approvers</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button variant="outline" role="combobox" className={cn("w-full justify-between font-bold h-11 rounded-sm bg-background border-primary/10", field.value.length === 0 && "text-muted-foreground")}>
                                <span className="truncate">{field.value.length === 0 ? "All Admins (Global)" : `${field.value.length} Admins Selected`}</span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0 rounded-sm shadow-2xl border-none" align="start">
                            <ScrollArea className="h-64">
                              <div className="p-2 space-y-1">
                                {admins?.map(admin => (
                                  <div key={admin.id} className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-sm transition-colors cursor-pointer" onClick={() => {
                                    const next = field.value.includes(admin.id) 
                                      ? field.value.filter(id => id !== admin.id)
                                      : [...field.value, admin.id];
                                    field.onChange(next);
                                  }}>
                                    <Checkbox 
                                      id={`create-admin-${admin.id}`} 
                                      checked={field.value.includes(admin.id)}
                                      onCheckedChange={(checked) => {
                                        const next = checked 
                                          ? [...field.value, admin.id]
                                          : field.value.filter(id => id !== admin.id);
                                        field.onChange(next);
                                      }}
                                    />
                                    <label htmlFor={`create-admin-${admin.id}`} className="text-xs font-bold uppercase cursor-pointer flex-1 py-1">
                                      {admin.username}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="md:col-span-2">
                    <Button type="submit" className="w-full h-11 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-lg">Register Category</Button>
                  </div>
                </form>
              </Form>
              
              <div className="space-y-3 flex-1 flex flex-col min-h-0">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search permit types..." 
                    className="pl-10 h-10 rounded-sm bg-muted/20 border-none text-sm"
                    value={ptwSearch}
                    onChange={(e) => setPtwSearch(e.target.value)}
                  />
                </div>

                <div className="rounded-sm border flex-1 overflow-hidden bg-background">
                  <ScrollArea className="h-full">
                    <Table>
                      <TableHeader className="bg-muted/30 sticky top-0 z-10 shadow-sm">
                        <TableRow>
                          <TableHead className="px-6 text-[10px] font-black uppercase tracking-widest">Permit Type</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest">Designated Approvers</TableHead>
                          <TableHead className="text-right px-6 w-32 font-black uppercase text-[10px] tracking-widest">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPtwTypes.length > 0 ? filteredPtwTypes.map((type) => (
                          <TableRow key={type.id} className="hover:bg-muted/5 transition-colors">
                            <TableCell className="px-6 py-4 font-bold text-sm text-foreground">{type.name}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <UserCog className="h-3.5 w-3.5 text-primary opacity-60" />
                                <span className={cn("text-xs font-bold uppercase tracking-tight", (!type.authorizedAdminIds || type.authorizedAdminIds.length === 0) && "text-primary italic opacity-70")}>
                                  {type.authorizedAdminName || 'All Admins'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right px-6">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" className="rounded-sm h-8 w-8 text-primary hover:bg-primary/10" onClick={() => {
                                  setAssigningType(type);
                                  setSelectedAdminIds(type.authorizedAdminIds || []);
                                }}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="rounded-sm h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteItem('ptw_types', type.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )) : (
                          <TableRow><TableCell colSpan={3} className="h-48 text-center text-muted-foreground italic text-xs uppercase opacity-40">No permit types discovered</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Approver Assignment Dialog */}
      <Dialog open={!!assigningType} onOpenChange={(o) => !o && setAssigningType(null)}>
        <DialogContent className="max-w-md w-[95vw] rounded-sm p-0 border-none shadow-2xl bg-background flex flex-col h-[70vh] sm:h-auto sm:max-h-[90vh]">
          <DialogHeader className="p-6 bg-primary/5 border-b shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-primary rounded-sm"><UserPlus className="h-5 w-5" /></div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Set Authorized Approvers</DialogTitle>
                <DialogDescription className="text-xs font-medium mt-1">Delegating authorization for: {assigningType?.name}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-6 flex-1 overflow-hidden flex flex-col space-y-6">
            <div className="space-y-3 flex-1 flex flex-col min-h-0">
              <Label className="text-[10px] font-black uppercase tracking-widest px-1 text-muted-foreground">Select Designated Administrators</Label>
              <div className="border rounded-sm flex-1 overflow-hidden bg-background shadow-inner">
                <ScrollArea className="h-full">
                  <div className="p-2 space-y-1">
                    {admins?.map(admin => (
                      <div key={admin.id} className={cn(
                        "flex items-center space-x-2 p-3 hover:bg-primary/5 rounded-sm transition-all border-b border-border/10 last:border-0 cursor-pointer",
                        selectedAdminIds.includes(admin.id) && "bg-primary/5 border-primary/10"
                      )} onClick={() => {
                        const next = selectedAdminIds.includes(admin.id)
                          ? selectedAdminIds.filter(id => id !== admin.id)
                          : [...selectedAdminIds, admin.id];
                        setSelectedAdminIds(next);
                      }}>
                        <Checkbox 
                          id={`edit-admin-${admin.id}`} 
                          checked={selectedAdminIds.includes(admin.id)}
                          onCheckedChange={(checked) => {
                            const next = checked 
                              ? [...selectedAdminIds, admin.id]
                              : selectedAdminIds.filter(id => id !== admin.id);
                            setSelectedAdminIds(next);
                          }}
                          className="rounded-full"
                        />
                        <div className="flex flex-col min-w-0">
                          <label htmlFor={`edit-admin-${admin.id}`} className="text-xs font-black uppercase cursor-pointer truncate">{admin.username}</label>
                          <span className="text-[9px] font-mono text-muted-foreground truncate">{admin.email}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              <p className="text-[10px] text-muted-foreground italic font-medium">Uncheck all users to revert to global administrator authorization.</p>
            </div>
          </div>
          <DialogFooter className="p-4 bg-muted/10 border-t gap-3 shrink-0 flex flex-col sm:flex-row">
            <DialogClose asChild><Button variant="outline" className="w-full sm:flex-1 h-11 rounded-sm font-bold uppercase text-[10px] tracking-widest">Cancel</Button></DialogClose>
            <Button 
              disabled={isAssigning} 
              className="w-full sm:flex-1 h-11 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-xl"
              onClick={handleQuickAssign}
            >
              {isAssigning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
