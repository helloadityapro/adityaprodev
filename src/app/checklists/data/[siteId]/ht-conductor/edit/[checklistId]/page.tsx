'use client';

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { 
  useFirestore, 
  useUser, 
  useDoc, 
  useMemoFirebase, 
  updateDocumentNonBlocking 
} from '@/firebase';
import { doc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { 
  Zap, 
  Loader2, 
  Save, 
  ArrowLeft,
  Pencil,
  Plus,
  Trash2,
  Navigation
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

const spanSchema = z.object({
  label: z.string(),
  distance: z.preprocess((val) => (val === "" ? undefined : val), z.coerce.number().min(0.01, 'Distance required.')),
  remarks: z.string().optional().default(""),
});

const editSchema = z.object({
  poleConfiguration: z.enum(['Two Pole', 'Four Pole']),
  spans: z.array(spanSchema).min(1, 'At least one span distance is required.'),
});

export default function EditHTConductorAuditPage({ params }: { params: Promise<{ siteId: string, checklistId: string }> }) {
  const { siteId, checklistId } = React.use(params);
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const auditRef = useMemoFirebase(() => doc(firestore, 'ht_conductor_checklists', checklistId), [firestore, checklistId]);
  const { data: audit, isLoading: auditLoading } = useDoc<any>(auditRef);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);

  const form = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      poleConfiguration: "Two Pole",
      spans: [],
    }
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "spans"
  });

  React.useEffect(() => {
    if (audit) {
      form.reset({
        poleConfiguration: audit.poleConfiguration || "Two Pole",
        spans: audit.spans || [],
      });
    }
  }, [audit, form]);

  const onSubmit = async (values: z.infer<typeof editSchema>) => {
    if (!user || !userProfile || !audit) return;
    setIsSubmitting(true);

    try {
      const previousValues = {
        poleConfiguration: audit.poleConfiguration,
        spans: audit.spans || [],
      };

      const historyEntry = {
        editedBy: userProfile.username || user.email,
        editedById: user.uid,
        timestamp: new Date().toISOString(),
        previousValues
      };

      updateDocumentNonBlocking(auditRef, {
        poleConfiguration: values.poleConfiguration,
        spans: values.spans,
        status: 'Pending',
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: userProfile.username || user.email,
        editHistory: arrayUnion(historyEntry)
      });

      toast({ 
        title: "Revision Saved", 
        description: "Audit updated and returned to Pending status." 
      });
      
      setTimeout(() => {
        router.back();
      }, 300);

    } catch (e: any) {
      toast({ variant: "destructive", title: "Update Failed", description: e.message });
      setIsSubmitting(false);
    }
  };

  if (auditLoading) return <div className="p-8 space-y-4 max-w-4xl mx-auto"><Skeleton className="h-10 w-48" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.back()} disabled={isSubmitting} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary">
          <ArrowLeft className="mr-2 h-4 w-4" /> Cancel & Return
        </Button>
        <div className="flex items-center gap-3">
           <div className="bg-primary/10 p-2.5 rounded-sm shrink-0"><Pencil className="h-6 w-6 text-primary" /></div>
           <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">Edit Conductor Log</h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{audit?.siteName} • Record Audit</p>
           </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card className="rounded-sm shadow-md border-primary/10">
            <CardHeader className="bg-primary/5 border-b py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <FormField control={form.control} name="poleConfiguration" render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Plant Side Configuration *</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 sm:gap-10 h-11 items-center">
                      <div className="flex items-center space-x-2"><RadioGroupItem value="Four Pole" id="pc-four" /><Label htmlFor="pc-four" className="font-bold cursor-pointer text-xs uppercase">Four Pole</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="Two Pole" id="pc-two" /><Label htmlFor="pc-two" className="font-bold cursor-pointer text-xs uppercase">Two Pole</Label></div>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Navigation className="h-4 w-4 text-primary" /> Span Measurement Audit
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {fields.map((field, index) => (
                  <div key={field.id} className="p-4 sm:p-6 space-y-4 hover:bg-muted/[0.01] transition-colors relative group">
                    <div className="flex flex-col gap-2">
                      <Label className="text-[10px] font-black uppercase tracking-tight text-foreground">{form.watch(`spans.${index}.label`)} *</Label>
                      
                      <div className="flex items-center gap-2">
                        <FormField control={form.control} name={`spans.${index}.distance`} render={({ field }) => (
                          <FormItem className="space-y-0 flex-1 sm:flex-none">
                            <FormControl>
                              <div className="relative">
                                <Input type="number" step="0.01" {...field} className="h-11 w-full sm:w-[160px] rounded-sm font-mono font-bold pl-4 pr-10" />
                                <span className="absolute right-3 top-3 text-[9px] font-black text-muted-foreground uppercase">Mtrs</span>
                              </div>
                            </FormControl>
                          </FormItem>
                        )} />
                        
                        <div className="flex-1">
                          <FormField control={form.control} name={`spans.${index}.remarks`} render={({ field }) => (
                            <FormControl><Input placeholder="Observation (Optional)..." {...field} className="h-11 rounded-sm text-xs" /></FormControl>
                          )} />
                        </div>

                        {index > 0 && (
                          <Button variant="ghost" size="icon" className="h-11 w-11 text-destructive rounded-sm" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-muted/5 border-t">
                <Button type="button" variant="outline" className="w-full h-11 border-dashed rounded-sm font-bold text-primary border-primary/20" onClick={() => append({ label: `Additional Span ${fields.length + 1}`, distance: 0, remarks: "" })}>
                  <Plus className="h-4 w-4 mr-2" /> Add Next Span
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 bg-background/90 backdrop-blur border-t p-4 z-40 md:left-[16rem]">
            <div className="max-w-4xl mx-auto flex items-center justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isSubmitting} className="rounded-sm font-bold uppercase text-[10px] tracking-widest h-12 px-8">Discard</Button>
              <Button type="submit" disabled={isSubmitting} className="rounded-sm font-black uppercase text-[10px] tracking-widest h-12 px-12 shadow-xl shadow-primary/20 flex-1 sm:flex-none">
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing...</> : <><Save className="mr-2 h-4 w-4" /> Save Revision</>}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
