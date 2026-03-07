
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
import { useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { Fuel, Loader2, Send, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

const requestSchema = z.object({
  purpose: z.string().min(5, 'Purpose must be detailed (min 5 chars).'),
  destination: z.string().min(3, 'Destination is required.'),
});

export default function RequestVehiclePage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);

  const form = useForm<z.infer<typeof requestSchema>>({
    resolver: zodResolver(requestSchema),
    defaultValues: { purpose: '', destination: '' },
  });

  const onSubmit = async (values: z.infer<typeof requestSchema>) => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);
    try {
      await addDocumentNonBlocking(collection(firestore, 'vehicle_assignments'), {
        userId: user.uid,
        userName: userProfile.username || user.email,
        purpose: values.purpose,
        destination: values.destination,
        status: 'Pending',
        requestDate: serverTimestamp(),
      });
      setIsSuccess(true);
      toast({ title: 'Request Sent', description: 'Administrative approval required.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full animate-in fade-in zoom-in-95 duration-300">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-primary/10 p-4 rounded-full">
                <CheckCircle2 className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Request Logged</CardTitle>
            <CardDescription className="text-base">
              Your vehicle allotment request has been submitted for Admin approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full rounded-sm font-bold h-11" onClick={() => router.push('/vehicles/assigned')}>
              Track Request Status
            </Button>
            <Button variant="ghost" className="w-full rounded-sm" onClick={() => setIsSuccess(false)}>
              Request Another Trip
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2">
          <Fuel className="h-8 w-8" /> Request Vehicle Allotment
        </h1>
        <p className="text-muted-foreground font-medium">Specify trip details for administrative review.</p>
      </div>

      <Card className="rounded-sm shadow-md border-primary/10">
        <CardHeader>
          <CardTitle>Trip Information</CardTitle>
          <CardDescription>A vehicle and driver will be assigned upon approval.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField control={form.control} name="destination" render={({ field }) => (
                <FormItem>
                  <FormLabel>Travel Destination</FormLabel>
                  <FormControl><Input placeholder="e.g. Pune Office / Shahapur Site" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="purpose" render={({ field }) => (
                <FormItem>
                  <FormLabel>Detailed Purpose of Trip</FormLabel>
                  <FormControl><Textarea rows={4} placeholder="Reason for requiring organizational transport..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="pt-4 border-t flex justify-end">
                <Button type="submit" disabled={isSubmitting} className="rounded-sm font-black h-12 px-10 shadow-lg">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  SEND FOR APPROVAL
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
