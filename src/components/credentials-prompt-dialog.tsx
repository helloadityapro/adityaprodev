'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUser, useDoc, useFirestore, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert } from 'lucide-react';

const credentialsSchema = z.object({
  dob: z.string().min(1, 'Date of Birth is required'),
  doj: z.string().min(1, 'Date of Joining is required'),
  aadharNumber: z.string().length(12, 'Aadhar Number must be 12 digits'),
  panNumber: z.string().length(10, 'PAN Number must be 10 characters'),
});

/**
 * A dialog component that prompts users to complete their official profile
 * if critical fields are missing. Triggered automatically based on profile state.
 */
export function CredentialsPromptDialog() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: profile, isLoading } = useDoc(userProfileRef);

  const form = useForm<z.infer<typeof credentialsSchema>>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: {
      dob: '',
      doj: '',
      aadharNumber: '',
      panNumber: '',
    },
  });

  React.useEffect(() => {
    if (!isLoading && profile) {
      // Check for missing mandatory official fields
      const isMissing = !profile.dob || !profile.doj || !profile.aadharNumber || !profile.panNumber;
      if (isMissing) {
        form.reset({
          dob: profile.dob || '',
          doj: profile.doj || '',
          aadharNumber: profile.aadharNumber || '',
          panNumber: profile.panNumber || '',
        });
        setOpen(true);
      } else {
        setOpen(false);
      }
    }
  }, [profile, isLoading, form]);

  const onSubmit = async (values: z.infer<typeof credentialsSchema>) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const userRef = doc(firestore, 'users', user.uid);
      
      // Update the user document in the settings/users collection context
      updateDocumentNonBlocking(userRef, {
        ...values,
        panNumber: values.panNumber.toUpperCase(),
        updatedAt: serverTimestamp(),
      });

      toast({ 
        variant: 'success',
        title: 'Credentials Recorded', 
        description: 'Your professional profile has been updated successfully.' 
      });
      setOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    // Prevent manual closing if profile is incomplete to ensure compliance
    const isMissing = profile && (!profile.dob || !profile.doj || !profile.aadharNumber || !profile.panNumber);
    if (isMissing && !isOpen) {
      toast({ 
        variant: 'destructive', 
        title: 'Completion Required', 
        description: 'Please provide the required identification details to proceed.' 
      });
      return;
    }
    setOpen(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md rounded-sm border-primary/20 shadow-2xl">
        <DialogHeader>
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-2">
            <ShieldAlert className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl font-black uppercase tracking-tight">Complete Your Profile</DialogTitle>
          <DialogDescription className="text-center text-xs font-medium leading-relaxed">
            Organizational policy requires all personnel to provide valid identification and date records. Please fill the missing details below.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dob"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Date of Birth</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} className="rounded-sm h-10" disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="doj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Date of Joining</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} className="rounded-sm h-10" disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="aadharNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Aadhar Number (12 Digits)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="0000 0000 0000" 
                      {...field} 
                      maxLength={12} 
                      className="rounded-sm h-10 font-mono font-bold" 
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="panNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">PAN Number (10 Chars)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="ABCDE1234F" 
                      {...field} 
                      maxLength={10} 
                      className="rounded-sm h-10 uppercase font-mono font-bold" 
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button type="submit" className="w-full h-12 font-black uppercase text-xs tracking-widest shadow-xl" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Record official credentials'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function serverTimestamp() {
  return new Date(); // Using standard date for local non-blocking helper compatibility
}
