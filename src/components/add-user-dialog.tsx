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
import { useFirestore, setDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { doc, serverTimestamp, collection } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import { ScrollArea } from '@/components/ui/scroll-area';
import { slugifyRole } from '@/lib/access-control';

const addUserSchema = z.object({
  username: z.string().min(1, 'Username is required.'),
  email: z.string().email('Invalid email address.'),
  mobile: z.string().min(1, 'Mobile number is required.'),
  role: z.string().min(1, 'Role is required'),
  department: z.string().min(1, 'Department is required'),
  dob: z.string().min(1, "Date of Birth is required."),
  doj: z.string().min(1, "Date of Joining is required."),
  aadharNumber: z.string().min(12, "Aadhar Number must be 12 digits.").max(12, "Aadhar Number must be 12 digits."),
  panNumber: z.string().min(10, "PAN Number must be 10 characters.").max(10, "PAN Number must be 10 characters."),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddUserDialog({ open, onOpenChange }: AddUserDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const rolesQuery = useMemoFirebase(() => collection(firestore, 'user_roles'), [firestore]);
  const { data: roles } = useCollection<{ name: string }>(rolesQuery);

  const deptsQuery = useMemoFirebase(() => collection(firestore, 'user_departments'), [firestore]);
  const { data: departments } = useCollection<{ name: string }>(deptsQuery);

  const form = useForm<z.infer<typeof addUserSchema>>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      username: '',
      email: '',
      mobile: '',
      password: '',
      role: '',
      department: '',
      dob: '',
      doj: '',
      aadharNumber: '',
      panNumber: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof addUserSchema>) => {
    setIsSubmitting(true);
    const tempAppName = `temp-user-creation-${Date.now()}`;
    const tempApp = initializeApp(firebaseConfig, tempAppName);
    const tempAuth = getAuth(tempApp);

    try {
      const userCredential = await createUserWithEmailAndPassword(tempAuth, values.email, values.password);
      const user = userCredential.user;

      const userDoc = {
        id: user.uid,
        username: values.username,
        email: values.email,
        mobile: values.mobile,
        role: values.role,
        roleId: slugifyRole(values.role),
        department: values.department,
        dob: values.dob,
        doj: values.doj,
        aadharNumber: values.aadharNumber,
        panNumber: values.panNumber,
        registrationRequest: false,
        totalPoints: 0,
        pointsMultiplier: 1,
        assignedProjectIds: [],
        createdAt: serverTimestamp(),
      };

      setDocumentNonBlocking(doc(firestore, 'users', user.uid), userDoc, { merge: true });

      toast({
        title: 'User Created',
        description: `User ${values.username} has been created successfully.`,
      });
      form.reset();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Uh oh! Something went wrong.',
        description: error.message || 'Could not create user.',
      });
    } finally {
      await deleteApp(tempApp);
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
      <DialogContent className="sm:max-w-[500px] rounded-sm max-h-[90vh] flex flex-col p-0 border-none shadow-2xl">
        <DialogHeader className="p-6 pb-0 shrink-0">
          <DialogTitle className="text-xl font-black uppercase tracking-tight">Manual Enrollment</DialogTitle>
          <DialogDescription className="text-xs font-medium">
            Provision a new organizational account. The profile will be active immediately.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0 p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} className="rounded-sm h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email Address</FormLabel>
                    <FormControl>
                      <Input placeholder="m@example.com" {...field} className="rounded-sm h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mobile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contact Number</FormLabel>
                    <FormControl>
                      <Input placeholder="8989898989" {...field} className="rounded-sm h-11" />
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
                          <SelectTrigger className="rounded-sm h-11">
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
                          <SelectTrigger className="rounded-sm h-11">
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dob"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Date of Birth</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="rounded-sm h-11" />
                      </FormControl>
                      <FormMessage />
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
                        <Input type="date" {...field} className="rounded-sm h-11" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="aadharNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Aadhar Number (12 Digits)</FormLabel>
                      <FormControl>
                        <Input placeholder="12-digit number" {...field} className="rounded-sm h-11 font-mono" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="panNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">PAN Number</FormLabel>
                      <FormControl>
                        <Input placeholder="10-character code" {...field} className="rounded-sm h-11 uppercase font-mono" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Initial Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} className="rounded-sm h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </ScrollArea>
        <DialogFooter className="p-6 border-t gap-2 flex flex-col sm:flex-row shrink-0 bg-muted/5">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="rounded-sm font-bold uppercase text-[10px] tracking-widest h-11 flex-1">
            Cancel
          </Button>
          <Button type="button" onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting} className="rounded-sm font-black uppercase text-[10px] px-6 h-11 flex-1 shadow-lg">
            {isSubmitting ? 'Provisioning...' : 'Add Personnel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}