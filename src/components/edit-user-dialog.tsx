'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, updateDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection } from 'firebase/firestore';

const editUserSchema = z.object({
  username: z.string().min(1, 'Username is required.'),
  mobile: z.string().min(1, 'Mobile number is required.'),
  role: z.string().min(1, 'Role is required'),
  department: z.string().min(1, 'Department is required'),
});

type User = {
  id: string;
  username?: string;
  email?: string;
  mobile?: string;
  role?: string;
  department?: string;
};

interface EditUserDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const rolesQuery = useMemoFirebase(() => collection(firestore, 'user_roles'), [firestore]);
  const { data: roles } = useCollection<{ name: string }>(rolesQuery);

  const deptsQuery = useMemoFirebase(() => collection(firestore, 'user_departments'), [firestore]);
  const { data: departments } = useCollection<{ name: string }>(deptsQuery);

  const form = useForm<z.infer<typeof editUserSchema>>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      username: '',
      mobile: '',
      role: '',
      department: '',
    }
  });

  React.useEffect(() => {
    if (user) {
      form.reset({
        username: user.username || '',
        mobile: user.mobile || '',
        role: user.role || '',
        department: user.department || '',
      });
    }
  }, [user, form]);

  const onSubmit = async (values: z.infer<typeof editUserSchema>) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const userRef = doc(firestore, 'users', user.id);
      updateDocumentNonBlocking(userRef, values);

      toast({
        title: 'User Updated',
        description: `User ${values.username} has been updated successfully.`,
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Could not update user.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(isOpen);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-sm">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight">Edit Credentials</DialogTitle>
          <DialogDescription className="text-xs font-medium">
            Modify the professional profile for {user?.username}.
          </DialogDescription>
        </DialogHeader>
        {user && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5 py-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Full Name</FormLabel>
                    <FormControl>
                      <Input {...field} className="rounded-sm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground opacity-50">Email (Identity Locked)</FormLabel>
                <Input readOnly disabled value={user.email || 'N/A'} className="rounded-sm bg-muted/20" />
              </FormItem>
              <FormField
                control={form.control}
                name="mobile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contact Number</FormLabel>
                    <FormControl>
                      <Input {...field} className="rounded-sm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-sm">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {roles?.length ? roles.map(r => (
                            <SelectItem key={r.id} value={r.name} className="text-xs font-bold">{r.name}</SelectItem>
                          )) : (
                            <>
                              <SelectItem value="Site Engineer">Site Engineer</SelectItem>
                              <SelectItem value="Site Manager">Site Manager</SelectItem>
                              <SelectItem value="Driver">Driver</SelectItem>
                              <SelectItem value="Admin">Admin</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dept</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-sm">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments?.length ? departments.map(d => (
                            <SelectItem key={d.id} value={d.name} className="text-xs font-bold">{d.name}</SelectItem>
                          )) : (
                            <>
                              <SelectItem value="Projects">Projects</SelectItem>
                              <SelectItem value="O&M">O&M</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter className="gap-2 border-t pt-4">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="rounded-sm font-bold uppercase text-[10px]">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="rounded-sm font-black uppercase text-[10px] px-6">
                  {isSubmitting ? 'Saving...' : 'Confirm Changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
