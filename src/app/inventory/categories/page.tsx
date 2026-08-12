
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
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
  Tag,
  AlertCircle
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

const categorySchema = z.object({
  name: z.string().min(1, 'Category Name is required.'),
});

type Category = {
  id: string;
  name: string;
  createdAt: any;
};

export default function ManageCategoriesPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isPurchaseDept = userProfile?.department === 'Purchase & Supply Chain' || userProfile?.department === 'Procurement and Supply-chain';
  const canManage = isAdmin || isPurchaseDept;

  const categoriesQuery = useMemoFirebase(() => 
    query(collection(firestore, 'inventory_categories'), orderBy('name', 'asc')), 
    [firestore]
  );
  const { data: categories, isLoading: isCategoriesLoading } = useCollection<Category>(categoriesQuery);

  const form = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '' },
  });

  const onSubmit = async (values: z.infer<typeof categorySchema>) => {
    if (!canManage) return;
    setIsSubmitting(true);
    try {
      await addDocumentNonBlocking(collection(firestore, 'inventory_categories'), {
        ...values,
        createdAt: serverTimestamp(),
      });
      toast({ title: 'Category Added', description: `${values.name} has been added to categories.` });
      form.reset();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    if (!canManage) return;
    deleteDocumentNonBlocking(doc(firestore, 'inventory_categories', id));
    toast({ title: 'Category Removed' });
  };

  if (isProfileLoading || isCategoriesLoading) {
    return (
      <div className="space-y-8 p-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="p-12 text-center flex flex-col items-center gap-4">
        <AlertCircle className="h-12 w-12 text-destructive opacity-50" />
        <h2 className="text-xl font-bold">Unauthorized Access</h2>
        <p className="text-muted-foreground">Only authorized personnel can manage inventory categories.</p>
        <Button variant="outline" asChild><Link href="/inventory">Back to Inventory</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" asChild className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary">
          <Link href="/inventory/manage"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Inventory</Link>
        </Button>
        <h1 className="flex items-center gap-2">
          <Tag className="h-8 w-8 text-primary" /> Product Categories
        </h1>
        <p className="text-muted-foreground text-sm font-medium">Define and organize product groups for consistent inventory classification.</p>
      </div>

      <div className="space-y-8">
        <Card className="rounded-sm border-primary/10 shadow-md h-fit max-w-md">
          <CardHeader className="bg-primary/5 border-b py-4">
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" /> Add Category
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category Name</FormLabel>
                    <FormControl><Input placeholder="e.g. Solar Modules" {...field} className="h-11 rounded-sm focus-visible:ring-primary/20" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full h-11 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-lg" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Category"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="rounded-sm border-primary/10 shadow-md overflow-hidden">
          <CardHeader className="bg-muted/5 border-b py-4">
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" /> Active Categories
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6">Name</TableHead>
                  <TableHead className="text-right px-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories && categories.length > 0 ? categories.map((cat) => (
                  <TableRow key={cat.id} className="hover:bg-muted/5 transition-colors">
                    <TableCell className="px-6 py-4 font-bold text-sm text-foreground">{cat.name}</TableCell>
                    <TableCell className="text-right px-6">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => handleDelete(cat.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={2} className="h-32 text-center text-muted-foreground italic text-xs">No categories defined.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
