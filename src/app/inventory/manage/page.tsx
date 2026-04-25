'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, orderBy, where, serverTimestamp, getDocs, writeBatch, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Trash2, 
  Boxes, 
  ChevronDown, 
  ChevronUp, 
  Layers,
  Search,
  FilterX,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Tag,
  Eye,
  Pencil,
  Loader2,
  Save,
  X,
  Sparkles
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { isSuperAdmin } from '@/lib/auth-constants';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { ScrollArea } from '@/components/ui/scroll-area';

const UNITS = ["Numbers", "Kilograms", "Liters", "Meters", "Sets", "Bundles", "Pairs", "Drums"];

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

type SortKey = 'name' | 'category' | 'make' | 'unit';

export default function ManageMasterInventoryPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const [editingItem, setEditingItem] = React.useState<MasterItem | null>(null);
  const [isUpdating, setIsUpdating] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const itemsQuery = useMemoFirebase(() => collection(firestore, 'master_inventory'), [firestore]);
  const { data: items, isLoading: isItemsLoading } = useCollection<MasterItem>(itemsQuery);

  const categoriesQuery = useMemoFirebase(() => collection(firestore, 'inventory_categories'), [firestore]);
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

  const watchName = form.watch('name');

  const suggestion = React.useMemo(() => {
    if (!watchName || watchName.length < 3 || !items || !editingItem) return null;
    const lowerName = watchName.toLowerCase();
    return items.find(item => {
      if (item.id === editingItem.id) return false;
      const lowerExisting = item.name.toLowerCase();
      return (lowerExisting.includes(lowerName) || lowerName.includes(lowerExisting)) && lowerExisting !== lowerName;
    });
  }, [watchName, items, editingItem]);

  React.useEffect(() => {
    if (editingItem) {
      form.reset({
        name: editingItem.name,
        category: editingItem.category,
        unit: editingItem.unit,
        make: editingItem.make,
        description: editingItem.description || '',
        subItems: editingItem.subItems || []
      });
    }
  }, [editingItem, form]);

  const onEditSubmit = async (values: z.infer<typeof itemSchema>) => {
    if (!editingItem) return;
    
    const oldName = editingItem.name;

    // Duplicate check for edit
    const isDuplicate = items?.some(item => 
      item.id !== editingItem.id && item.name.toLowerCase() === values.name.toLowerCase()
    );
    
    if (isDuplicate) {
      form.setError('name', { type: 'manual', message: 'Another material already uses this exact name.' });
      toast({ variant: 'destructive', title: 'Rename Conflict', description: 'Item name must be unique.' });
      return;
    }

    setIsUpdating(true);
    try {
      // 1. Update the Master Inventory Item
      const itemRef = doc(firestore, 'master_inventory', editingItem.id);
      await updateDocumentNonBlocking(itemRef, {
        ...values,
        updatedAt: serverTimestamp(),
      });

      // 2. Cascade Update to project_boms
      const bomsQuery = query(collection(firestore, 'project_boms'), where('itemName', '==', oldName));
      const bomsSnap = await getDocs(bomsQuery);
      
      if (!bomsSnap.empty) {
        const bomBatch = writeBatch(firestore);
        bomsSnap.docs.forEach(bomDoc => {
          bomBatch.update(bomDoc.ref, {
            itemName: values.name,
            category: values.category,
            unit: values.unit,
            make: values.make,
            specification: values.description || "",
            subItems: values.subItems || [],
            updatedAt: serverTimestamp()
          });
        });
        await bomBatch.commit();
      }

      // 3. Cascade Update to project_pos
      // We check all POs (capped at 500 for safety) to see if they contain this item in their array
      const posSnap = await getDocs(query(collection(firestore, 'project_pos'), limit(500)));
      if (!posSnap.empty) {
        const poBatch = writeBatch(firestore);
        let poUpdatedCount = 0;
        posSnap.docs.forEach(poDoc => {
          const poData = poDoc.data();
          let hasMatch = false;
          const newItems = (poData.items || []).map((it: any) => {
            if (it.itemName === oldName) {
              hasMatch = true;
              return { ...it, itemName: values.name };
            }
            return it;
          });

          if (hasMatch) {
            poBatch.update(poDoc.ref, { 
              items: newItems,
              updatedAt: serverTimestamp()
            });
            poUpdatedCount++;
          }
        });
        if (poUpdatedCount > 0) await poBatch.commit();
      }

      toast({ 
        title: 'Item Updated', 
        description: `${values.name} and all dependent BoM/PO records synchronized.` 
      });
      setEditingItem(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3 text-primary" /> : <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  const filteredItems = React.useMemo(() => {
    if (!items) return [];

    let result = items.filter(item => {
      const matchesSearch = 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description || "").toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });

    result.sort((a, b) => {
      const { key, direction } = sortConfig;
      let valA: any = a[key]?.toLowerCase() || '';
      let valB: any = b[key]?.toLowerCase() || '';

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [items, searchTerm, categoryFilter, sortConfig]);

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setCategoryFilter("all");
  };

  if (isUserLoading || isProfileLoading || isItemsLoading) {
    return (
      <div className="space-y-8 p-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2">
            <Boxes className="h-8 w-8 text-primary" /> Master Item Registry
          </h1>
          <p className="text-muted-foreground text-sm font-medium">Define global materials, components, and set-breakdowns for organizational use.</p>
        </div>
        {isAdmin && (
          <Button asChild className="h-11 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-md px-6">
            <Link href="/inventory/manage/add">
              <Plus className="mr-2 h-4 w-4" /> Add New Item
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search name, make, or specs..." 
            className="pl-10 h-10 text-sm rounded-sm border-primary/20 bg-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground hidden sm:block" />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px] h-10 text-xs font-bold uppercase rounded-sm border-primary/20 bg-background">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-bold uppercase">All Categories</SelectItem>
                {categories?.map(cat => (
                  <SelectItem key={cat.name} value={cat.name} className="text-xs font-bold uppercase">{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10 px-3 rounded-sm font-bold text-[10px] uppercase tracking-widest text-muted-foreground">
            <FilterX className="h-3.5 w-3.5 mr-1.5" /> Clear
          </Button>
        </div>
      </div>

      <Card className="rounded-sm border-primary/10 shadow-md overflow-hidden">
        <CardHeader className="bg-muted/5 border-b py-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <Boxes className="h-4 w-4 text-primary" /> Material Catalog
          </CardTitle>
          <Badge variant="outline" className="rounded-sm font-black uppercase text-[10px] bg-primary/5 text-primary border-primary/10">
            {filteredItems.length} Registered Items
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('name')}>
                    <div className="flex items-center">Description <SortIcon column="name" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('category')}>
                    <div className="flex items-center">Category <SortIcon column="category" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('make')}>
                    <div className="flex items-center">Make <SortIcon column="make" /></div>
                  </TableHead>
                  <TableHead className="text-center cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('unit')}>
                    <div className="flex items-center justify-center">Base Unit <SortIcon column="unit" /></div>
                  </TableHead>
                  <TableHead className="text-right px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length > 0 ? filteredItems.map((item) => (
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
                        <div className="flex justify-end items-center gap-1">
                          {isAdmin && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-primary rounded-sm hover:bg-primary/10"
                                onClick={() => setEditingItem(item)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => {
                                deleteDocumentNonBlocking(doc(firestore, 'master_inventory', item.id));
                                toast({ title: 'Item Removed' });
                              }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
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
                      <p className="text-sm font-bold uppercase tracking-widest">No items matching current filters</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(o) => !o && setEditingItem(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 rounded-sm overflow-hidden border-none shadow-2xl bg-background">
          <DialogHeader className="p-6 bg-primary/5 border-b shrink-0">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Edit Material Registry</DialogTitle>
            <DialogDescription className="text-xs font-medium">Modify properties for {editingItem?.name}. Updates will cascade to BoM and PO records.</DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1">
            <div className="p-6">
              <Form {...form}>
                <form id="edit-material-form" onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Item Name / Description</FormLabel>
                        <FormControl><Input placeholder="e.g. Solar Module 540Wp" {...field} className="h-11 rounded-sm" /></FormControl>
                        {suggestion && (
                          <div className="flex items-center gap-2 mt-2 animate-in slide-in-from-left-2 duration-300">
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 py-1.5 px-3 rounded-sm flex items-center gap-2">
                              <Sparkles className="h-3 w-3" />
                              <span className="text-[10px] font-bold uppercase tracking-tight">Similar existing item:</span>
                              <span className="text-[11px] font-black">{suggestion.name}</span>
                            </Badge>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="category" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-11 rounded-sm">
                              <SelectValue placeholder="Select Category" />
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

                    <FormField control={form.control} name="make" render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Make / Brand</FormLabel>
                        <FormControl><Input placeholder="e.g. Adani / Mahindra" {...field} className="h-11 rounded-sm" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Technical Specification</FormLabel>
                        <FormControl><Input placeholder="Details..." {...field} className="h-11 rounded-sm" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {form.watch('unit') === 'Sets' && (
                    <div className="space-y-4 p-4 bg-muted/10 border rounded-sm">
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
                          <div key={field.id} className="grid grid-cols-12 gap-2 items-end bg-background p-2 rounded-sm relative group border shadow-sm">
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="absolute -top-2 -right-2 h-5 w-5 bg-destructive text-white rounded-full z-10" 
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
                </form>
              </Form>
            </div>
          </ScrollArea>

          <DialogFooter className="p-4 bg-muted/10 border-t gap-3 shrink-0 flex flex-col sm:flex-row">
            <DialogClose asChild><Button variant="outline" className="rounded-sm font-bold uppercase text-[10px] h-10 px-6">Cancel</Button></DialogClose>
            <Button onClick={form.handleSubmit(onEditSubmit)} disabled={isUpdating} className="rounded-sm font-black uppercase text-[10px] h-10 px-8 shadow-md">
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, color }: { title: string, value: number, icon: any, color: 'primary' | 'emerald' | 'blue' | 'amber' }) {
  const colors = {
    primary: "bg-primary/5 border-primary/10 text-primary",
    emerald: "bg-emerald-500/5 border-emerald-500/10 text-emerald-600",
    blue: "bg-blue-500/5 border-blue-500/10 text-blue-600",
    amber: "bg-amber-500/5 border-amber-500/10 text-amber-600",
  };

  return (
    <Card className={cn("rounded-sm border shadow-sm", colors[color])}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4">
        <CardTitle className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
        <Icon className="h-3.5 sm:h-4 sm:w-4" />
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0">
        <div className="text-xl sm:text-2xl font-black">{value}</div>
      </CardContent>
    </Card>
  );
}
