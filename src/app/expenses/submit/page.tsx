
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
  useCollection, 
  addDocumentNonBlocking, 
  useFirebaseApp 
} from '@/firebase';
import { collection, doc, serverTimestamp, query, where } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { 
  Wallet, 
  Plus, 
  Trash2, 
  Loader2, 
  FileUp, 
  Image as ImageIcon, 
  Search, 
  Check, 
  ChevronsUpDown, 
  Receipt,
  X,
  Building2,
  Calendar as CalendarIcon,
  Send,
  CheckCircle2,
  MessageCircle,
  IndianRupee
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const expenseItemSchema = z.object({
  category: z.string().min(1, 'Category is required.'),
  description: z.string().min(1, 'Description is required.'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
  localProof: z.any().optional(),
});

const expenseSchema = z.object({
  title: z.string().min(3, 'Title is required.'),
  type: z.enum(['Site', 'General']),
  siteName: z.string().optional(),
  items: z.array(expenseItemSchema).min(1, 'At least one item required.'),
});

type Site = {
  id: string;
  name: string;
};

type GenericItem = {
  id: string;
  name: string;
};

export default function SubmitExpensePage() {
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const categoriesQuery = useMemoFirebase(() => collection(firestore, 'expense_categories'), [firestore]);
  const { data: categories } = useCollection<GenericItem>(categoriesQuery);

  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);

  const form = useForm<z.infer<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      title: "",
      type: "Site",
      siteName: "",
      items: [{ category: "", description: "", amount: 0 }]
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  const totalAmount = form.watch('items').reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const uploadProof = async (file: File, userId: string, index: number): Promise<string | null> => {
    if (!file) return null;
    const storage = getStorage(firebaseApp);
    const timestamp = Date.now();
    const storagePath = `expenses/${userId}/${timestamp}_item_${index}_${file.name.replace(/\s+/g, '_')}`;
    const storageRef = ref(storage, storagePath);
    
    const uploadTask = uploadBytesResumable(storageRef, file);
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed', null, reject, async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(url);
      });
    });
  };

  const onSubmit = async (values: z.infer<typeof expenseSchema>) => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);

    try {
      const processedItems = await Promise.all(values.items.map(async (item, idx) => {
        let proofUrl = null;
        if (item.localProof instanceof File) {
          proofUrl = await uploadProof(item.localProof, user.uid, idx);
        }
        const { localProof, ...rest } = item;
        return { ...rest, proofUrl };
      }));

      await addDocumentNonBlocking(collection(firestore, 'expenses'), {
        userId: user.uid,
        userName: userProfile.username || user.email,
        title: values.title,
        type: values.type,
        siteName: values.type === 'Site' ? values.siteName : 'General',
        items: processedItems,
        totalAmount,
        status: 'Pending',
        createdAt: serverTimestamp(),
      });

      setIsSuccess(true);
      toast({ title: 'Expense Submitted', description: 'Your request is pending HR review.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSites = allSites?.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase())) || [];

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full animate-in fade-in zoom-in-95 duration-300 rounded-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-primary/10 p-4 rounded-full">
                <CheckCircle2 className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold uppercase tracking-tight">Report Logged</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              Your expense report for <strong className="text-primary font-black">₹{totalAmount.toFixed(2)}</strong> has been received and is awaiting HR audit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full h-12 text-lg font-semibold rounded-sm shadow-md" onClick={() => router.push('/expenses/manage')}>
              View My Expenses
            </Button>
            <Button variant="outline" className="w-full h-11 rounded-sm font-bold" onClick={() => { setIsSuccess(false); form.reset(); }}>
              Submit New
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
          <Wallet className="h-8 w-8" /> New Expense Submission
        </h1>
        <p className="text-muted-foreground font-medium">Log official purchases or payments for organizational audit.</p>
      </div>

      <Card className="rounded-sm shadow-lg border-primary/10">
        <CardHeader className="bg-muted/5 border-b">
          <CardTitle className="text-sm font-bold uppercase tracking-widest">Report Context</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Report Summary / Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Travel Reimbursement Feb 2026" {...field} className="h-11 rounded-sm" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Expense Made For</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex gap-6 h-11 items-center"
                        >
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl><RadioGroupItem value="Site" /></FormControl>
                            <FormLabel className="font-bold cursor-pointer text-xs uppercase">Project Site</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl><RadioGroupItem value="General" /></FormControl>
                            <FormLabel className="font-bold cursor-pointer text-xs uppercase">General Expense</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch('type') === 'Site' && (
                  <FormField
                    control={form.control}
                    name="siteName"
                    render={({ field }) => (
                      <FormItem className="flex flex-col md:col-span-2">
                        <FormLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Linked Project Site</FormLabel>
                        <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between font-normal rounded-sm h-11",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value || "Select site..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <div className="flex items-center border-b px-3">
                              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                              <Input
                                placeholder="Search sites..."
                                className="h-10 w-full border-none focus-visible:ring-0 px-0 text-sm"
                                value={siteSearchQuery}
                                onChange={(e) => setSiteSearchQuery(e.target.value)}
                              />
                            </div>
                            <ScrollArea className="h-[200px]">
                              <div className="p-1">
                                {filteredSites.map((site) => (
                                  <Button
                                    key={site.id}
                                    type="button"
                                    variant="ghost"
                                    className="w-full justify-start font-normal h-10 text-sm"
                                    onClick={() => {
                                      field.onChange(site.name);
                                      setIsSitePopoverOpen(false);
                                      setSiteSearchQuery("");
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4 text-primary", site.name === field.value ? "opacity-100" : "opacity-0")} />
                                    {site.name}
                                  </Button>
                                ))}
                              </div>
                            </ScrollArea>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Line Items</h3>
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => append({ category: "", description: "", amount: 0 })}
                    className="h-8 rounded-sm font-bold border-primary text-primary hover:bg-primary/5"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Line
                  </Button>
                </div>

                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="p-6 border rounded-sm bg-muted/5 relative animate-in fade-in slide-in-from-top-2 duration-300">
                      {fields.length > 1 && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="absolute top-2 right-2 h-7 w-7 text-destructive hover:bg-destructive/10 rounded-sm"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        <div className="md:col-span-3">
                          <FormField
                            control={form.control}
                            name={`items.${index}.category`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Category</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="h-10 rounded-sm bg-background">
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {categories?.map(cat => (
                                      <SelectItem key={cat.id} value={cat.name} className="text-xs font-bold">{cat.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="md:col-span-5">
                          <FormField
                            control={form.control}
                            name={`items.${index}.description`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Description</FormLabel>
                                <FormControl>
                                  <Input placeholder="What was this spent on?" {...field} className="h-10 rounded-sm bg-background" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="md:col-span-2">
                          <FormField
                            control={form.control}
                            name={`items.${index}.amount`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Amount (₹)</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-bold">₹</span>
                                    <Input 
                                      type="number" 
                                      step="0.01" 
                                      placeholder="0.00" 
                                      {...field} 
                                      className="h-10 rounded-sm bg-background font-mono pl-7" 
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="md:col-span-2 flex flex-col justify-end">
                          <FormField
                            control={form.control}
                            name={`items.${index}.localProof`}
                            render={({ field: { value, onChange, ...rest } }) => {
                              const preview = value instanceof File ? URL.createObjectURL(value) : null;
                              return (
                                <FormItem>
                                  <div className="flex flex-col items-center gap-2">
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      className="hidden" 
                                      id={`proof-${index}`} 
                                      onChange={(e) => onChange(e.target.files?.[0])}
                                      {...rest}
                                    />
                                    {preview ? (
                                      <div className="relative group h-10 w-full rounded-sm overflow-hidden border">
                                        <img src={preview} className="h-full w-full object-cover" alt="Preview" />
                                        <div 
                                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"
                                          onClick={() => onChange(null)}
                                        >
                                          <X className="h-4 w-4 text-white" />
                                        </div>
                                      </div>
                                    ) : (
                                      <Button asChild variant="outline" size="icon" className="w-full h-10 border-dashed rounded-sm text-primary hover:bg-primary/5 cursor-pointer">
                                        <label htmlFor={`proof-${index}`}>
                                          <FileUp className="h-4 w-4" />
                                        </label>
                                      </Button>
                                    )}
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              );
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 bg-primary/5 rounded-sm border border-primary/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-1">Total Report Amount</span>
                    <span className="text-3xl font-black text-primary tabular-nums">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <Button 
                  type="submit" 
                  disabled={isSubmitting || totalAmount <= 0} 
                  className="w-full sm:w-auto h-12 px-10 font-black text-lg rounded-sm shadow-xl"
                >
                  {isSubmitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> SUBMITTING...</> : <><Send className="mr-2 h-4 w-4" /> SUBMIT FOR AUDIT</>}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
