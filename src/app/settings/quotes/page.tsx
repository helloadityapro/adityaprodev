'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Quote, Plus, Trash2, Loader2, ArrowLeft, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { isSuperAdmin } from '@/lib/auth-constants';

const quoteSchema = z.object({
  text: z.string().min(10, 'Quote must be at least 10 characters.'),
  author: z.string().optional(),
});

type QuoteType = {
  id: string;
  text: string;
  author?: string;
  createdAt: any;
};

export default function QuotesHubPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const quotesQuery = useMemoFirebase(() => query(collection(firestore, 'quotes'), orderBy('createdAt', 'desc')), [firestore]);
  const { data: quotes, isLoading: quotesLoading } = useCollection<QuoteType>(quotesQuery);

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<z.infer<typeof quoteSchema>>({
    resolver: zodResolver(quoteSchema),
    defaultValues: { text: '', author: '' },
  });

  const onSubmit = async (values: z.infer<typeof quoteSchema>) => {
    if (!isAdmin) return;
    setIsSubmitting(true);
    try {
      await addDocumentNonBlocking(collection(firestore, 'quotes'), {
        ...values,
        createdAt: serverTimestamp(),
      });
      toast({ title: 'Quote Added', description: 'Motivational message saved.' });
      form.reset();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    if (!isAdmin) return;
    deleteDocumentNonBlocking(doc(firestore, 'quotes', id));
    toast({ title: 'Quote Removed' });
  };

  if (isUserLoading || isProfileLoading || quotesLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!isAdmin) return null;

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.push('/settings')} className="w-fit mb-2 -ml-2">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings
        </Button>
        <h1 className="flex items-center gap-2">
          <Quote className="h-8 w-8 text-primary" /> Quotes Hub
        </h1>
        <p className="text-muted-foreground">Manage motivational and team-building messages shown during loading.</p>
      </div>

      <Card className="rounded-sm border-primary/10 shadow-lg">
        <CardHeader className="bg-primary/5 border-b">
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Motivational Quote
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="text" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase">Quote Text</FormLabel>
                  <FormControl><Input placeholder="Individual commitment to a group effort..." {...field} className="h-11 rounded-sm" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="author" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase">Author (Optional)</FormLabel>
                  <FormControl><Input placeholder="Vince Lombardi" {...field} className="h-11 rounded-sm" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" disabled={isSubmitting} className="w-full h-11 rounded-sm font-bold uppercase text-[10px] tracking-widest">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Quote"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="rounded-sm border-primary/10 shadow-md overflow-hidden">
        <CardHeader className="bg-muted/5 border-b"><CardTitle className="text-xs uppercase font-bold tracking-widest">Library</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableBody>
              {quotes && quotes.length > 0 ? quotes.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="py-4">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm italic font-medium leading-relaxed">"{q.text}"</p>
                      <span className="text-[10px] font-black uppercase text-primary/60">— {q.author || 'Anonymous'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(q.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell className="h-32 text-center text-muted-foreground italic text-xs">No custom quotes saved.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
