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
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, orderBy } from 'firebase/firestore';
import { Trash2, SlidersHorizontal, Building2, UserCircle2, ShieldCheck, UserCog, UserPlus, Loader2, Check, Pencil, ChevronsUpDown, X, Search, FilterX, Save, Cpu, Zap } from 'lucide-react';
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
  authorizedAdminId?: string | null;
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
  const { toast } = useToast();
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const [roleSearch, setRoleSearch] = React.useState("");
  const [deptSearch, setDeptSearch] = React.useState("");
  const [ptwSearch, setPtwSearch] = React.useState("");
  const [invMakeSearch, setInvMakeSearch] = React.useState("");
  const [invRatingSearch, setInvRatingSearch] = React.useState("");

  const ptwTypesQuery = useMemoFirebase(() => collection(firestore, 'ptw_types'), [firestore]);
  const { data: ptwTypes, isLoading: ptwTypesLoading } = useCollection<PtwType>(ptwTypesQuery);

  const rolesQuery = useMemoFirebase(() => collection(firestore, 'user_roles'), [firestore]);
  const { data: roles } = useCollection<GenericItem>(rolesQuery);

  const departmentsQuery = useMemoFirebase(() => collection(firestore, 'user_departments'), [firestore]);
  const { data: departments } = useCollection<GenericItem>(departmentsQuery);

  const invMakesQuery = useMemoFirebase(() => collection(firestore, 'inverter_makes'), [firestore]);
  const { data: invMakes } = useCollection<GenericItem>(invMakesQuery);

  const invRatingsQuery = useMemoFirebase(() => collection(firestore, 'inverter_ratings'), [firestore]);
  const { data: invRatings } = useCollection<GenericItem>(invRatingsQuery);

  const adminsQuery = useMemoFirebase(() => query(collection(firestore, 'users'), where('role', '==', 'Admin')), [firestore]);
  const { data: admins } = useCollection<UserProfile>(adminsQuery);

  const ptwTypeForm = useForm<z.infer<typeof ptwTypeSchema>>({ resolver: zodResolver(ptwTypeSchema), defaultValues: { name: '', authorizedAdminIds: [] } });
  const roleForm = useForm<z.infer<typeof genericItemSchema>>({ resolver: zodResolver(genericItemSchema), defaultValues: { name: '' } });
  const departmentForm = useForm<z.infer<typeof genericItemSchema>>({ resolver: zodResolver(genericItemSchema), defaultValues: { name: '' } });
  const invMakeForm = useForm<z.infer<typeof genericItemSchema>>({ resolver: zodResolver(genericItemSchema), defaultValues: { name: '' } });
  const invRatingForm = useForm<z.infer<typeof genericItemSchema>>({ resolver: zodResolver(genericItemSchema), defaultValues: { name: '' } });

  const filteredRoles = React.useMemo(() => {
    if (!roles) return [];
    return roles.filter(i => i.name.toLowerCase().includes(roleSearch.toLowerCase()));
  }, [roles, roleSearch]);

  const filteredDepts = React.useMemo(() => {
    if (!departments) return [];
    return departments.filter(i => i.name.toLowerCase().includes(deptSearch.toLowerCase()));
  }, [departments, deptSearch]);

  const filteredPtwTypes = React.useMemo(() => {
    if (!ptwTypes) return [];
    return ptwTypes.filter(i => i.name.toLowerCase().includes(ptwSearch.toLowerCase()));
  }, [ptwTypes, ptwSearch]);

  const handleGenericSubmit = async (coll: string, values: any, form: any) => {
    addDocumentNonBlocking(collection(firestore, coll), values);
    toast({ title: 'Success', description: 'Entry added.' });
    form.reset();
  };

  const onPtwTypeSubmit = (values: z.infer<typeof ptwTypeSchema>) => {
    const selectedAdmins = admins?.filter(a => values.authorizedAdminIds.includes(a.id)) || [];
    const adminNames = selectedAdmins.length > 0 ? selectedAdmins.map(a => a.username || a.email).join(', ') : 'All Admins';
    addDocumentNonBlocking(collection(firestore, 'ptw_types'), { name: values.name, authorizedAdminIds: values.authorizedAdminIds, authorizedAdminName: adminNames });
    toast({ title: 'Success', description: 'PTW Type added.' });
    ptwTypeForm.reset({ name: '', authorizedAdminIds: [] });
  };

  const deleteItem = (coll: string, id: string) => {
    deleteDocumentNonBlocking(doc(firestore, coll, id));
    toast({ title: 'Deleted' });
  };

  if (isUserLoading || isProfileLoading || ptwTypesLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;
  if (!isAdmin) return null;

  return (
    <div className="space-y-6 md:space-y-8 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-foreground">System Configuration</h1>
        <p className="text-muted-foreground font-medium text-sm">Global settings and organizational dropdown management.</p>
      </div>

      <Tabs defaultValue="org" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-10 rounded-sm max-w-xl bg-muted/50 border border-primary/10 p-1 h-11">
          <TabsTrigger value="org" className="flex items-center gap-2 rounded-sm font-black text-[10px] uppercase tracking-widest"><Building2 className="h-4 w-4" /> Organization</TabsTrigger>
          <TabsTrigger value="inverter" className="flex items-center gap-2 rounded-sm font-black text-[10px] uppercase tracking-widest"><Cpu className="h-4 w-4" /> Inverters</TabsTrigger>
          <TabsTrigger value="ptw" className="flex items-center gap-2 rounded-sm font-black text-[10px] uppercase tracking-widest"><SlidersHorizontal className="h-4 w-4" /> PTW Setup</TabsTrigger>
        </TabsList>

        <TabsContent value="org" className="space-y-10 m-0"><div className="grid gap-10 lg:grid-cols-2">
          <Card className="rounded-sm border-primary/10 shadow-md flex flex-col min-h-[500px]">
            <CardHeader className="bg-primary/5 border-b p-6 flex flex-row items-center gap-3"><UserCircle2 className="h-5 w-5 text-primary" /><CardTitle className="text-sm font-black uppercase tracking-widest">Personnel Roles</CardTitle></CardHeader>
            <CardContent className="p-6 space-y-6">
              <Form {...roleForm}><form onSubmit={roleForm.handleSubmit(v => handleGenericSubmit('user_roles', v, roleForm))} className="flex gap-2"><FormField control={roleForm.control} name="name" render={({field}) => <Input {...field} placeholder="Designation name..." className="h-10" />} /><Button type="submit" className="h-10 px-6 font-black uppercase text-[10px]">Add</Button></form></Form>
              <div className="flex flex-col gap-3 flex-1"><Input placeholder="Filter..." className="h-9 text-xs" value={roleSearch} onChange={e => setRoleSearch(e.target.value)} />
              <ScrollArea className="h-[300px] border rounded-sm"><Table><TableBody>{filteredRoles.map(i => (<TableRow key={i.id}><TableCell className="font-bold text-xs">{i.name}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => deleteItem('user_roles', i.id)}><Trash2 className="h-3.5 w-3.5"/></Button></TableCell></TableRow>))}</TableBody></Table></ScrollArea></div>
            </CardContent>
          </Card>
          <Card className="rounded-sm border-primary/10 shadow-md flex flex-col min-h-[500px]">
            <CardHeader className="bg-primary/5 border-b p-6 flex flex-row items-center gap-3"><Building2 className="h-5 w-5 text-primary" /><CardTitle className="text-sm font-black uppercase tracking-widest">Departments</CardTitle></CardHeader>
            <CardContent className="p-6 space-y-6">
              <Form {...departmentForm}><form onSubmit={departmentForm.handleSubmit(v => handleGenericSubmit('user_departments', v, departmentForm))} className="flex gap-2"><FormField control={departmentForm.control} name="name" render={({field}) => <Input {...field} placeholder="Dept name..." className="h-10" />} /><Button type="submit" className="h-10 px-6 font-black uppercase text-[10px]">Add</Button></form></Form>
              <div className="flex flex-col gap-3 flex-1"><Input placeholder="Filter..." className="h-9 text-xs" value={deptSearch} onChange={e => setDeptSearch(e.target.value)} />
              <ScrollArea className="h-[300px] border rounded-sm"><Table><TableBody>{filteredDepts.map(i => (<TableRow key={i.id}><TableCell className="font-bold text-xs">{i.name}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => deleteItem('user_departments', i.id)}><Trash2 className="h-3.5 w-3.5"/></Button></TableCell></TableRow>))}</TableBody></Table></ScrollArea></div>
            </CardContent>
          </Card>
        </div></TabsContent>

        <TabsContent value="inverter" className="space-y-10 m-0"><div className="grid gap-10 lg:grid-cols-2">
          <Card className="rounded-sm border-primary/10 shadow-md flex flex-col min-h-[500px]">
            <CardHeader className="bg-primary/5 border-b p-6 flex flex-row items-center gap-3"><Cpu className="h-5 w-5 text-primary" /><CardTitle className="text-sm font-black uppercase tracking-widest">Inverter Manufacturers</CardTitle></CardHeader>
            <CardContent className="p-6 space-y-6">
              <Form {...invMakeForm}><form onSubmit={invMakeForm.handleSubmit(v => handleGenericSubmit('inverter_makes', v, invMakeForm))} className="flex gap-2"><FormField control={invMakeForm.control} name="name" render={({field}) => <Input {...field} placeholder="Manufacturer name..." className="h-10" />} /><Button type="submit" className="h-10 px-6 font-black uppercase text-[10px]">Add</Button></form></Form>
              <div className="flex flex-col gap-3 flex-1"><Input placeholder="Filter..." className="h-9 text-xs" value={invMakeSearch} onChange={e => setInvMakeSearch(e.target.value)} />
              <ScrollArea className="h-[300px] border rounded-sm"><Table><TableBody>{invMakes?.filter(m => m.name.toLowerCase().includes(invMakeSearch.toLowerCase())).map(i => (<TableRow key={i.id}><TableCell className="font-bold text-xs">{i.name}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => deleteItem('inverter_makes', i.id)}><Trash2 className="h-3.5 w-3.5"/></Button></TableCell></TableRow>))}</TableBody></Table></ScrollArea></div>
            </CardContent>
          </Card>
          <Card className="rounded-sm border-primary/10 shadow-md flex flex-col min-h-[500px]">
            <CardHeader className="bg-primary/5 border-b p-6 flex flex-row items-center gap-3"><Zap className="h-5 w-5 text-primary" /><CardTitle className="text-sm font-black uppercase tracking-widest">Inverter Ratings</CardTitle></CardHeader>
            <CardContent className="p-6 space-y-6">
              <Form {...invRatingForm}><form onSubmit={invRatingForm.handleSubmit(v => handleGenericSubmit('inverter_ratings', v, invRatingForm))} className="flex gap-2"><FormField control={invRatingForm.control} name="name" render={({field}) => <Input {...field} placeholder="e.g. 300 kVA" className="h-10" />} /><Button type="submit" className="h-10 px-6 font-black uppercase text-[10px]">Add</Button></form></Form>
              <div className="flex flex-col gap-3 flex-1"><Input placeholder="Filter..." className="h-9 text-xs" value={invRatingSearch} onChange={e => setInvRatingSearch(e.target.value)} />
              <ScrollArea className="h-[300px] border rounded-sm"><Table><TableBody>{invRatings?.filter(r => r.name.toLowerCase().includes(invRatingSearch.toLowerCase())).map(i => (<TableRow key={i.id}><TableCell className="font-bold text-xs">{i.name}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => deleteItem('inverter_ratings', i.id)}><Trash2 className="h-3.5 w-3.5"/></Button></TableCell></TableRow>))}</TableBody></Table></ScrollArea></div>
            </CardContent>
          </Card>
        </div></TabsContent>

        <TabsContent value="ptw" className="m-0"><Card className="rounded-sm border-primary/10 shadow-xl overflow-hidden min-h-[600px]"><CardHeader className="bg-primary/5 border-b p-6 flex flex-row items-center gap-3"><ShieldCheck className="h-5 w-5 text-primary" /><CardTitle className="text-sm font-black uppercase tracking-widest">Manage PTW Types</CardTitle></CardHeader>
        <CardContent className="p-6 space-y-8">
          <Form {...ptwTypeForm}><form onSubmit={ptwTypeForm.handleSubmit(onPtwTypeSubmit)} className="flex gap-4 p-6 bg-muted/20 border rounded-sm items-end"><FormField control={ptwTypeForm.control} name="name" render={({field}) => <FormItem className="flex-1"><FormLabel className="text-[10px] font-black uppercase">Type Name</FormLabel><FormControl><Input {...field} className="h-10"/></FormControl></FormItem>} /><Button type="submit" className="h-10 px-10 font-black uppercase text-[10px]">Add PTW Category</Button></form></Form>
          <div className="space-y-3"><Input placeholder="Search types..." className="h-9 text-xs" value={ptwSearch} onChange={e => setPtwSearch(e.target.value)} />
          <div className="border rounded-sm overflow-hidden"><Table><TableHeader className="bg-muted/30"><TableRow><TableHead className="px-6 text-[10px] font-black uppercase">Type Name</TableHead><TableHead className="text-right px-6"></TableHead></TableRow></TableHeader><TableBody>{filteredPtwTypes.map(i => (<TableRow key={i.id}><TableCell className="px-6 py-4 font-bold">{i.name}</TableCell><TableCell className="text-right pr-6"><Button variant="ghost" size="icon" onClick={() => deleteItem('ptw_types', i.id)}><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>))}</TableBody></Table></div></div>
        </CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}
