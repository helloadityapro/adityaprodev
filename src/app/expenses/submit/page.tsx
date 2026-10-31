
'use client';

import * as React from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { 
  useFirestore, 
  useUser, 
  useDoc, 
  useMemoFirebase, 
  useCollection, 
  addDocumentNonBlocking 
} from '@/firebase';
import { collection, doc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
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
  Search, 
  Check, 
  ChevronsUpDown, 
  Receipt,
  X,
  Building2,
  Send,
  CheckCircle2,
  Calendar,
  Fuel
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from '@/lib/utils';
import { Progress } from "@/components/ui/progress";
import { sendNotification } from '@/lib/notifications';
import { format } from 'date-fns';

const expenseItemSchema = z.object({
  category: z.string().min(1, 'Category is required.'),
  description: z.string().min(1, 'Description is required.'),
  date: z.string().min(1, 'Date is required.'),
  kmReading: z.coerce.number().optional().default(0),
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

type FuelRate = {
  rate: number;
  effectiveFrom: string;
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

  const fuelSettingsRef = useMemoFirebase(() => doc(firestore, 'system_settings', 'fuel'), [firestore]);
  const { data: fuelSettings } = useDoc<{ rates: FuelRate[] }>(fuelSettingsRef);

  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<Record<number, number>>({});

  const form = useForm<z.infer<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      title: "",
      type: "Site",
      siteName: "",
      items: [{ category: "", description: "", date: format(new Date(), 'yyyy-MM-dd'), kmReading: 0, amount: 0 }]
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  const watchedItems = useWatch({
    control: form.control,
    name: "items",
  });

  const totalAmount = React.useMemo(() => {
    return (watchedItems || []).reduce((sum, item) => sum + (Number(item?.amount) || 0), 0);
  }, [watchedItems]);

  const getApplicableFuelRate = React.useCallback((date: string) => {
    if (!fuelSettings?.rates || fuelSettings.rates.length === 0) return 0;
    const sorted = [...fuelSettings.rates].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    const applicable = sorted.find(r => date >= r.effectiveFrom);
    return applicable?.rate || sorted[sorted.length - 1].rate || 0;
  }, [fuelSettings]);

  // Handle automatic KM calculation
  React.useEffect(() => {
    watchedItems?.forEach((item, index) => {
      if (item?.category === "Travelling") {
        const rate = getApplicableFuelRate(item.date);
        const km = Number(item.kmReading) || 0;
        const calculatedAmount = (km / 50) * rate;
        const currentAmount = Number(item.amount) || 0;
        
        // Use a threshold to avoid precision issues triggering infinite loops
        if (Math.abs(currentAmount - calculatedAmount) > 0.01) {
          form.setValue(`items.${index}.amount`, parseFloat(calculatedAmount.toFixed(2)));
        }
      }
    });
  }, [watchedItems, getApplicableFuelRate, form]);

  const uploadProof = async (file: File, userId: string, index: number): Promise<string | null> => {
    if (!file) return null;
    const storage = getStorage(firebaseApp);
    const timestamp = Date.now();
    const storagePath = `expenses/${userId}/${timestamp}_item_${index}_${file.name.replace(/\s+/g, '_')}`;
    const storageRef = ref(storage, storagePath);
    
    const uploadTask = uploadBytesResumable(storageRef, file);
    
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(prev => ({ ...prev, [index]: progress }));
        }, 
        (error) => {
          console.error("Proof upload failed:", error);
          reject(error);
        }, 
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(url);
        }
      );
    });
  };

  const onSubmit = async (values: z.infer<typeof expenseSchema>) => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);
    setUploadProgress({});

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

      // Notify Admins
      const adminsQuery = query(collection(firestore, 'users'), where('role', '==', 'Admin'));
      const adminDocs = await getDocs(adminsQuery);
      adminDocs.forEach(adminDoc => {
        if (adminDoc.id === user.uid) return;
        sendNotification(firestore, {
          userId: adminDoc.id,
          title: "New Expense Claim",
          description: `${userProfile.username} submitted an expense claim of ₹${totalAmount.toFixed(2)}.`,
          link: `/expenses/manage`,
          push: true
        });
      });

      setIsSuccess(true);
      toast({ title: 'Expense Submitted', description: 'Your request is pending administrative review.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Submission Error', description: e.message });
    } finally {
      setIsSubmitting(false);
      setUploadProgress({});
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
              Your expense report for <strong className="text-primary font-black">₹{totalAmount.toFixed(2)}</strong> has been received and is awaiting audit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full h-12 text-lg font-semibold rounded-sm shadow-md" onClick={() => router.push('/expenses/list')}>
              View My Expenses
            </Button>
            <Button variant="outline" className="w-full h-11 rounded-sm font-bold" onClick={() => { setIsSuccess(false); form.reset(); setUploadProgress({}); }}>
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
        <h1 className="flex items-center gap-2">
          <Wallet className="h-8 w-8 text-primary" /> New Expense Submission
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
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Site" id="type-site" />
                            <Label htmlFor="type-site" className="font-bold cursor-pointer text-xs uppercase">Project Site</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="General" id="type-general" />
                            <Label htmlFor="type-general" className="font-bold cursor-pointer text-xs uppercase">General Expense</Label>
                          </div>
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
                                onKeyDown={(e) => e.stopPropagation()}
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
                </div>

                <div className="space-y-4">
                  {fields.map((field, index) => {
                    const isTravelling = watchedItems[index]?.category === "Travelling";
                    
                    return (
                      <div key={field.id} className="p-6 border rounded-sm bg-muted/5 relative animate-in fade-in slide-in-from-top-2 duration-300">
                        {fields.length > 1 && (
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="absolute top-2 right-2 h-7 w-7 text-destructive hover:bg-destructive/10 rounded-sm"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                          <div className="md:col-span-2">
                            <FormField
                              control={form.control}
                              name={`items.${index}.date`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-[9px] font-bold uppercase">Date</FormLabel>
                                  <FormControl>
                                    <Input type="date" {...field} className="h-10 bg-background text-[10px]" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className={cn("md:col-span-2")}>
                            <FormField
                              control={form.control}
                              name={`items.${index}.category`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-[9px] font-bold uppercase">Category</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="h-10 bg-background">
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

                          {isTravelling && (
                            <div className="md:col-span-2 animate-in zoom-in-95 duration-200">
                              <FormField
                                control={form.control}
                                name={`items.${index}.kmReading`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-[9px] font-bold uppercase flex items-center gap-1.5 text-primary">
                                      <Fuel className="h-2.5 w-2.5" /> KM Reading
                                    </FormLabel>
                                    <FormControl>
                                      <div className="relative">
                                        <Input type="number" step="0.1" placeholder="KM" {...field} className="h-10 bg-primary/5 font-mono font-bold text-primary pr-8" />
                                        <span className="absolute right-2 top-2.5 text-[8px] font-black opacity-40">KM</span>
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          )}

                          <div className={cn(isTravelling ? "md:col-span-3" : "md:col-span-5")}>
                            <FormField
                              control={form.control}
                              name={`items.${index}.description`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-[9px] font-bold uppercase">Description</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Details..." {...field} className="h-10 bg-background" />
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
                                  <FormLabel className="text-[9px] font-bold uppercase">Amount (₹)</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <span className="absolute left-3 top-2.5 text-muted-foreground text-xs font-bold">₹</span>
                                      <Input 
                                        type="number" 
                                        step="0.01" 
                                        placeholder="0.00" 
                                        {...field} 
                                        readOnly={isTravelling}
                                        className={cn("h-10 rounded-sm bg-background font-mono font-bold pl-7", isTravelling && "bg-muted/20 cursor-not-allowed text-primary")} 
                                      />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="md:col-span-1 flex flex-col justify-end">
                            <FormField
                              control={form.control}
                              name={`items.${index}.localProof`}
                              render={({ field: { value, onChange, ...rest } }) => {
                                const preview = value instanceof File ? URL.createObjectURL(value) : null;
                                return (
                                  <FormItem>
                                    <div className="flex flex-col gap-2">
                                      <input 
                                        type="file" 
                                        accept="image/*" 
                                        className="hidden" 
                                        id={`proof-${index}`} 
                                        onChange={(e) => onChange(e.target.files?.[0])}
                                        {...rest}
                                      />
                                      {preview ? (
                                        <div className="relative">
                                          <div className="relative group h-10 w-full rounded-sm overflow-hidden border bg-background flex items-center justify-center">
                                            <img src={preview} className="h-full w-full object-cover" alt="Preview" />
                                            <div 
                                              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"
                                              onClick={() => onChange(null)}
                                            >
                                              <X className="h-4 w-4 text-white" />
                                            </div>
                                          </div>
                                          {uploadProgress[index] !== undefined && (
                                            <div className="absolute -bottom-4 left-0 right-0 space-y-0.5">
                                              <div className="flex justify-between items-center text-[7px] font-black uppercase text-primary">
                                                <span>Uploading</span>
                                                <span>{Math.round(uploadProgress[index])}%</span>
                                              </div>
                                              <Progress value={uploadProgress[index]} className="h-1 rounded-none" />
                                            </div>
                                          )}
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
                    );
                  })}
                </div>

                <div className="flex justify-center pt-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => append({ category: "", description: "", date: format(new Date(), 'yyyy-MM-dd'), kmReading: 0, amount: 0 })}
                    className="h-10 rounded-sm font-black uppercase text-[10px] tracking-widest border-primary text-primary hover:bg-primary/5 px-8 shadow-sm border-dashed"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Add New Expense Item
                  </Button>
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
                  {isSubmitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> DISPATCHING UPLOADS...</> : <><Send className="mr-2 h-4 w-4" /> SUBMIT FOR AUDIT</>}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
