'use client';

import * as React from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp, query, getDocs, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Loader2, 
  ArrowLeft,
  Boxes,
  AlertCircle,
  Save,
  X,
  Sparkles
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

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
  make: string;
};

export default function AddMasterItemPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const categoriesQuery = useMemoFirebase(() => 
    collection(firestore, 'inventory_categories'), 
    [firestore]
  );
  const { data: categories } = useCollection<{ name: string }>(categoriesQuery);

  const masterItemsQuery = useMemoFirebase(() => collection(firestore, 'master_inventory'), [firestore]);
  const { data: existingItems } = useCollection<MasterItem>(masterItemsQuery);

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
  const watchName = form.watch('name');

  const suggestion = React.useMemo(() => {
    if (!watchName || watchName.length < 3 || !existingItems) return null;
    const lowerName = watchName.toLowerCase();
    return existingItems.find(item => {
      const lowerExisting = item.name.toLowerCase();
      return (lowerExisting.includes(lowerName) || lowerName.includes(lowerExisting)) && lowerExisting !== lowerName;
    });
  }, [watchName, existingItems]);

  const onSubmit = async (values: z.infer<typeof itemSchema>) => {
    if (!isAdmin) return;
    
    // Duplicate check: Verify if Name AND Make match an existing item
    const isDuplicate = existingItems?.some(item => 
      item.name.toLowerCase() === values.name.toLowerCase() &&
      item.make?.toLowerCase() === values.make.toLowerCase()
    );
    
    if (isDuplicate) {
      form.setError('name', { type: 'manual', message: 'A material with this exact name and make already exists.' });
      toast({ variant: 'destructive', title: 'Duplicate Item', description: 'This combination of name and make is already in use.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await addDocumentNonBlocking(collection(firestore, 'master_inventory'), {
        ...values,
        createdAt: serverTimestamp(),
      });
      toast({ title: 'Item Registered', description: `${values.name} added to catalog.` });
      router.push('/inventory/manage');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
      setIsSubmitting(false);
    }
  };

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="space-y-8 p-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 max-w-3xl mx-auto">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" asChild className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary">
          <Link href="/inventory/manage"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Registry</Link>
        </Button>
        <h1 className="flex items-center gap-2">
          <Plus className="h-8 w-8 text-primary" /> Register Master Item
        </h1>
        <p className="text-muted-foreground font-medium">Add a new material or component set to the global organizational catalog.</p>
      </div>

      <Card className="rounded-sm border-primary/10 shadow-lg">
        <CardHeader className="bg-primary/5 border-b py-4">
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            Material Details
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
              </div>

              {watchUnit === 'Sets' && (
                <div className="space-y-4 p-4 bg-muted/10 border rounded-sm animate-in zoom-in-95 duration-200">
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
                          className="absolute -top-2 -right-2 h-5 w-5 bg-destructive text-white rounded-full" 
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
                    {fields.length === 0 && (
                      <p className="text-center py-4 text-[10px] uppercase font-bold text-muted-foreground/40">No components defined for this set</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4 border-t">
                <Button type="button" variant="ghost" asChild className="flex-1 rounded-sm font-bold h-12 uppercase text-xs tracking-widest">
                  <Link href="/inventory/manage">Cancel</Link>
                </Button>
                <Button type="submit" className="flex-1 h-12 rounded-sm font-black uppercase text-xs tracking-widest shadow-xl" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Register Item
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
