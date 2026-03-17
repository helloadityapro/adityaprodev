
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Boxes, 
  Plus, 
  Search, 
  FilterX, 
  Loader2, 
  Package, 
  Tag,
  Settings2
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter, 
  DialogClose 
} from '@/components/ui/dialog';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { isSuperAdmin } from '@/lib/auth-constants';
import Link from 'next/link';

const itemSchema = z.object({
  name: z.string().min(1, 'Item Name is required.'),
  category: z.string().min(1, 'Category is required.'),
  description: z.string().optional(),
  unit: z.string().min(1, 'Unit of Measurement is required.'),
  make: z.string().min(1, 'Make or OEM is required.'),
});

type MasterItem = {
  id: string;
  name: string;
  category: string;
  description?: string;
  unit: string;
  make: string;
  createdAt: any;
};

type Category = {
  id: string;
  name: string;
};

export default function MasterInventoryPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const inventoryQuery = useMemoFirebase(() => 
    query(collection(firestore, 'master_inventory'), orderBy('createdAt', 'desc')), 
    [firestore]
  );
  const { data: items, isLoading: isItemsLoading } = useCollection<MasterItem>(inventoryQuery);

  const categoriesQuery = useMemoFirebase(() => 
    query(collection(firestore, 'inventory_categories'), orderBy('name', 'asc')), 
    [firestore]
  );
  const { data: categories } = useCollection<Category>(categoriesQuery);

  const form = useForm<z.infer<typeof itemSchema>>({
    resolver: zodResolver(itemSchema),
    defaultValues: { name: '', category: '', description: '', unit: '', make: '' },
  });

  const onSubmit = async (values: z.infer<typeof itemSchema>) => {
    setIsSubmitting(true);
    try {
      await addDocumentNonBlocking(collection(firestore, 'master_inventory'), {
        ...values,
        createdAt: serverTimestamp(),
        createdBy: user?.uid,
        createdByName: userProfile?.username || user?.email
      });
      toast({ title: 'Item Registered', description: `${values.name} has been added to the master inventory.` });
      form.reset();
      setIsAddDialogOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = React.useMemo(() => {
    if (!items) return [];
    return items.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm]);

  if (isProfileLoading || isItemsLoading) {
    return (
      <div className="space-y-8 p-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Boxes className="h-6 w-6 text-primary" />
            <h1>Master Inventory</h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium">Centralized organizational registry of assets and materials.</p>
        </div>
        <div className="flex items-center gap-2">
          {(isAdmin || isManager) && (
            <Button variant="outline" asChild className="h-10 rounded-sm font-bold border-primary/20 text-primary">
              <Link href="/inventory/categories"><Tag className="h-4 w-4 mr-2" /> Manage Categories</Link>
            </Button>
          )}
          {(isAdmin || isManager) && (
            <Button onClick={() => setIsAddDialogOpen(true)} className="h-10 rounded-sm font-bold shadow-md px-6">
              <Plus className="h-4 w-4 mr-2" /> Add New Item
            </Button>
          )}
        </div>
      </div>

      <div className="bg-card p-4 border border-primary/10 rounded-sm shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name, OEM, category..." 
            className="pl-10 h-10 text-sm rounded-sm border-primary/20 bg-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-sm font-black uppercase text-[10px] tracking-widest px-3 h-8 border-primary/20 text-primary">
            {filteredItems.length} Registered Items
          </Badge>
          <Button variant="ghost" size="icon" onClick={() => setSearchTerm("")} className="h-10 w-10 text-muted-foreground rounded-sm">
            <FilterX className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6 min-w-[200px]">Item Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Make / OEM</TableHead>
                  <TableHead className="text-center">UoM</TableHead>
                  <TableHead className="min-w-[300px]">Specification / Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length > 0 ? filteredItems.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/5 transition-colors group">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-sm text-primary">
                          <Package className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-sm text-foreground">{item.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-sm font-bold text-[9px] uppercase tracking-wider text-muted-foreground border-muted-foreground/20">
                        {item.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="rounded-sm font-bold text-[10px] uppercase tracking-tight py-0.5 px-2">
                        {item.make}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-black text-[10px] text-muted-foreground uppercase tracking-widest">
                      {item.unit}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground leading-relaxed italic">
                      {item.description || "No detailed description provided."}
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic">
                      <div className="flex flex-col items-center gap-2 opacity-40">
                        <Boxes className="h-10 w-10" />
                        <p className="text-sm font-bold uppercase tracking-widest">Registry empty</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-sm p-0 overflow-hidden border-none shadow-2xl bg-background">
          <DialogHeader className="p-6 bg-primary/5 border-b">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-sm"><Plus className="h-5 w-5 text-primary" /></div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Register Master Item</DialogTitle>
                <DialogDescription className="text-xs font-medium">Add a new item type to the organizational asset catalog.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Name of the Item</FormLabel>
                    <FormControl><Input placeholder="e.g. Solar Module 540Wp" {...field} className="h-11 rounded-sm focus-visible:ring-primary/20" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Item Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11 rounded-sm focus-visible:ring-primary/20">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories?.length ? categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.name} className="text-xs font-bold">{cat.name}</SelectItem>
                        )) : (
                          <div className="p-2 text-center text-[10px] uppercase font-bold text-muted-foreground">No categories defined</div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="make" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Make or OEM</FormLabel>
                      <FormControl><Input placeholder="e.g. Waaree, Adani" {...field} className="h-11 rounded-sm focus-visible:ring-primary/20" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="unit" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Unit of Measurement</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-11 rounded-sm focus-visible:ring-primary/20">
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {["Numbers", "Kilograms", "Liters", "Meters", "Sets", "Bundles", "Drums"].map(u => (
                            <SelectItem key={u} value={u} className="text-xs font-bold">{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Item Description</FormLabel>
                    <FormControl><Textarea placeholder="Technical specifications, dimensions, or material grade..." {...field} className="rounded-sm focus-visible:ring-primary/20 min-h-[100px]" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <DialogFooter className="pt-4 border-t gap-2">
                  <DialogClose asChild><Button variant="outline" className="flex-1 h-11 rounded-sm font-bold uppercase text-[10px] tracking-widest">Cancel</Button></DialogClose>
                  <Button type="submit" className="flex-1 h-11 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-lg" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Register Item"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
