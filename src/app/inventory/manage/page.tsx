'use client';

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Trash2, 
  Loader2, 
  ArrowLeft,
  Boxes,
  AlertCircle,
  Layers,
  ChevronDown,
  ChevronUp,
  Tag,
  Hammer
} from 'lucide-react';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { isSuperAdmin } from '@/lib/auth-constants';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';

const UNITS = ["Numbers", "Kilograms", "Liters", "Meters", "Sets", "Bundles", "Drums"];

const subItemSchema = z.object({
  name: z.string().min(1, 'Part name is required.'),
  quantityPerSet: z.coerce.number().min(0.01, 'Qty required.'),
  unit: z.string().min(1, 'Unit required.'),
});

const itemSchema = z.object({
  name: z.string().min(1, 'Item Name is required.'),
  category: z.string().min(1, 'Category is required.'),
  unit: z.string().min(1, 'Unit is required.'),
  make: z.string().min(1, 'Make/Brand is required.'),
  description: z.string().optional(),
  subItems: z.array(subItemSchema).optional(),
});

type MasterItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  make: string;
  description?: string;
  subItems?: { name: string; quantityPerSet: number; unit: string }[];
  createdAt: any;
};

export default function ManageMasterInventoryPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const itemsQuery = useMemoFirebase(() => 
    query(collection(firestore, 'master_inventory'), orderBy('name', 'asc')), 
    [firestore]
  );
  const { data: items, isLoading: isItemsLoading } = useCollection<MasterItem>(itemsQuery);

  const categoriesQuery = useMemoFirebase(() => 
    query(collection(firestore, 'inventory_categories'), orderBy('name', 'asc')), 
    [firestore]
  );
  const { data: categories } = useCollection<{ name: string }>(categoriesQuery);

  const form = useForm<z.infer<typeof itemSchema>>({
    resolver: zodResolver(itemSchema),
    defaultValues: { 
      name: '', 
      category: '', 
      unit: 'Numbers', 
      make: 'Standard',
      description: '',
      subItems: [] 
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "subItems"
  });

  const watchUnit = form.watch('unit');

  const onSubmit = async (values: z.infer<typeof itemSchema>) => {
    if (!isAdmin) return;
    setIsSubmitting(true);
    try {
      await addDocumentNonBlocking(collection(firestore, 'master_inventory'), {
        ...values,
        createdAt: serverTimestamp(),
      });
      toast({ title: 'Item Added', description: `${values.name} has been added to master registry.` });
      form.reset();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  if (isProfileLoading || isItemsLoading) {
    return (
      <div className="space-y-8 p-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-12 text-center flex flex-col items-center gap-4">
        <AlertCircle className="h-12 w-12 text-destructive opacity-50" />
        <h2 className="text-xl font-bold">Unauthorized Access</h2>
        <p className="text-muted-foreground">Only administrators can manage the master inventory registry.</p>
        <Button variant="outline" asChild><Link href="/inventory">Back to Inventory</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2">
          <Boxes className="h-8 w-8 text-primary" /> Master Item Registry
        </h1>
        <p className="text-muted-foreground text-sm font-medium">Define global materials, components, and set-breakdowns for organizational use.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 rounded-sm border-primary/10 shadow-md h-fit">
          <CardHeader className="bg-primary/5 border-b py-4">
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" /> Register New Item
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Item Name</FormLabel>
                    <FormControl><Input placeholder="e.g. Solar Module 540Wp" {...field} className="h-11 rounded-sm" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-11 rounded-sm">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories?.map(c => <SelectItem key={c.name} value={c.name} className="text-xs font-bold">{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="unit" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Base Unit</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-11 rounded-sm">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {UNITS.map(u => <SelectItem key={u} value={u} className="text-xs font-bold">{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="make" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Make / Brand</FormLabel>
                    <FormControl><Input placeholder="e.g. Adani / Mahindra" {...field} className="h-11 rounded-sm" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {watchUnit === 'Sets' && (
                  <div className="space-y-4 animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between border-b pb-2">
                      <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Component Breakdown</Label>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => append({ name: '', quantityPerSet: 1, unit: 'Numbers' })}
                        className="h-7 text-[9px] font-black uppercase border border-primary/20 hover:bg-primary/10"
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add Part
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {fields.map((field, idx) => (
                        <div key={field.id} className="grid grid-cols-12 gap-2 items-end bg-muted/20 p-2 rounded-sm relative group">
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="absolute -top-2 -right-2 h-5 w-5 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" 
                            onClick={() => remove(idx)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                          <div className="col-span-6">
                            <FormField control={form.control} name={`subItems.${idx}.name`} render={({ field }) => (
                              <Input placeholder="Part name" {...field} className="h-8 text-xs rounded-sm" />
                            )} />
                          </div>
                          <div className="col-span-3">
                            <FormField control={form.control} name={`subItems.${idx}.quantityPerSet`} render={({ field }) => (
                              <Input type="number" step="0.01" {...field} className="h-8 text-xs rounded-sm px-1 text-center" />
                            )} />
                          </div>
                          <div className="col-span-3">
                            <FormField control={form.control} name={`subItems.${idx}.unit`} render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="h-8 text-[10px] rounded-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {UNITS.map(u => <SelectItem key={u} value={u} className="text-[10px]">{u}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full h-12 rounded-sm font-black uppercase text-xs tracking-widest shadow-lg" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Register Item
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 rounded-sm border-primary/10 shadow-md overflow-hidden h-fit">
          <CardHeader className="bg-muted/5 border-b py-4">
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Boxes className="h-4 w-4 text-primary" /> Material Catalog
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-6">Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Make</TableHead>
                    <TableHead className="text-center">Base Unit</TableHead>
                    <TableHead className="text-right px-6">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items && items.length > 0 ? items.map((item) => (
                    <React.Fragment key={item.id}>
                      <TableRow className="hover:bg-muted/5 transition-colors group">
                        <TableCell className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {item.unit === 'Sets' && (
                              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => toggleRow(item.id)}>
                                {expandedRows.has(item.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            )}
                            <div className="flex flex-col">
                              <span className="font-bold text-sm text-foreground">{item.name}</span>
                              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tight">{item.id.slice(0, 8)}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="rounded-sm font-bold text-[9px] uppercase tracking-wider bg-primary/5 text-primary border-primary/10">
                            {item.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-muted-foreground">{item.make}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="rounded-sm text-[9px] font-black uppercase h-5">
                            {item.unit}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'master_inventory', item.id))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedRows.has(item.id) && item.subItems && (
                        <TableRow className="bg-primary/[0.02]">
                          <TableCell colSpan={5} className="p-0 border-b">
                            <div className="p-4 px-12 space-y-3 animate-in slide-in-from-top-1 duration-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Layers className="h-3.5 w-3.5 text-primary" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Component Breakdown</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {item.subItems.map((sub, sIdx) => (
                                  <div key={sIdx} className="p-3 bg-background border border-primary/5 rounded-sm flex flex-col gap-1 shadow-sm">
                                    <span className="text-xs font-bold">{sub.name}</span>
                                    <div className="flex items-center justify-between text-[10px]">
                                      <span className="text-muted-foreground uppercase font-medium">Standard Quantity:</span>
                                      <span className="text-primary font-black uppercase">{sub.quantityPerSet} {sub.unit}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic flex flex-col items-center justify-center gap-2">
                        <Boxes className="h-10 w-10 opacity-20" />
                        <p className="text-sm font-bold uppercase tracking-widest">No items in master registry</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const X = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);
