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
import { Car, Loader2, Save, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isSuperAdmin } from '@/lib/auth-constants';

const vehicleSchema = z.object({
  make: z.string().min(1, 'Make is required (e.g. Tata, Mahindra).'),
  model: z.string().min(1, 'Model is required.'),
  plateNumber: z.string().min(4, 'Registration number is required.'),
  ownership: z.enum(['Owned', 'Rented']),
  currentReading: z.coerce.number().min(0, 'Odometer reading cannot be negative.'),
});

export default function AddVehiclePage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<z.infer<typeof vehicleSchema>>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: { make: '', model: '', plateNumber: '', ownership: 'Owned', currentReading: 0 },
  });

  const onSubmit = async (values: z.infer<typeof vehicleSchema>) => {
    setIsSubmitting(true);
    try {
      await addDocumentNonBlocking(collection(firestore, 'vehicles'), {
        ...values,
        status: 'Available',
        createdAt: serverTimestamp(),
      });
      toast({ title: 'Vehicle Registered', description: `${values.make} ${values.model} added to fleet.` });
      router.push('/vehicles/manage');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAdmin && user) {
    return <div className="p-12 text-center text-destructive font-black uppercase">Unauthorized Access</div>;
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="w-fit mb-2 -ml-2">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <h1 className="flex items-center gap-2">
          <Car className="h-8 w-8" /> Register New Vehicle
        </h1>
        <p className="text-muted-foreground font-medium">Add a new owned or rented vehicle to the organizational registry.</p>
      </div>

      <Card className="rounded-sm shadow-md border-primary/10">
        <CardHeader>
          <CardTitle>Vehicle Details</CardTitle>
          <CardDescription>All fields are mandatory for fleet tracking.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="make" render={({ field }) => (
                  <FormItem><FormLabel>Make / Brand</FormLabel><FormControl><Input placeholder="e.g. Mahindra" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="model" render={({ field }) => (
                  <FormItem><FormLabel>Model</FormLabel><FormControl><Input placeholder="e.g. Bolero" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="plateNumber" render={({ field }) => (
                  <FormItem><FormLabel>Registration Number</FormLabel><FormControl><Input placeholder="e.g. MH 12 AB 1234" {...field} className="font-mono uppercase" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="ownership" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ownership Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Owned">Company Owned</SelectItem>
                        <SelectItem value="Rented">Rented / Vendor</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="currentReading" render={({ field }) => (
                <FormItem>
                  <FormLabel>Starting Odometer Reading (km)</FormLabel>
                  <FormControl><Input type="number" {...field} className="font-mono" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="pt-4 border-t flex justify-end">
                <Button type="submit" disabled={isSubmitting} className="rounded-sm font-bold min-w-[150px] h-11">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Register Vehicle
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}