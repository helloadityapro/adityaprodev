
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ClipboardList, 
  ShoppingBag, 
  Warehouse, 
  Plus, 
  Trash2, 
  ArrowLeft,
  Building2,
  AlertCircle,
  FileText,
  CheckCircle2,
  History,
  TrendingUp,
  MapPin,
  PlusCircle,
  MinusCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { isSuperAdmin } from '@/lib/auth-constants';
import Link from 'next/link';

type Project = {
  id: string;
  name: string;
  projectCompany: string;
};

type BoMItem = {
  id: string;
  itemName: string;
  specification: string;
  plannedQuantity: number;
  unit: string;
};

type PurchaseOrder = {
  id: string;
  poNumber: string;
  supplierName: string;
  orderDate: string;
  status: string;
  totalAmount: number;
};

type InventoryItem = {
  id: string;
  itemName: string;
  stockLevel: number;
  unit: string;
  lastUpdated: any;
};

export default function ProjectDetailsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = React.use(params);
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [activeTab, setActiveTab] = React.useState("bom");

  // 1. Fetch Project Details
  const projectRef = useMemoFirebase(() => doc(firestore, 'sites', projectId), [firestore, projectId]);
  const { data: project, isLoading: projectLoading } = useDoc<Project>(projectRef);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  // 2. Fetch BoM Items
  const bomQuery = useMemoFirebase(() => 
    query(collection(firestore, 'project_boms'), where('siteId', '==', projectId)), 
    [firestore, projectId]
  );
  const { data: bomItems, isLoading: bomLoading } = useCollection<BoMItem>(bomQuery);

  // 3. Fetch Purchase Orders
  const posQuery = useMemoFirebase(() => 
    query(collection(firestore, 'project_pos'), where('siteId', '==', projectId)), 
    [firestore, projectId]
  );
  const { data: purchaseOrders, isLoading: posLoading } = useCollection<PurchaseOrder>(posQuery);

  // 4. Fetch Inventory
  const inventoryQuery = useMemoFirebase(() => 
    query(collection(firestore, 'project_inventory'), where('siteId', '==', projectId)), 
    [firestore, projectId]
  );
  const { data: inventory, isLoading: invLoading } = useCollection<InventoryItem>(inventoryQuery);

  const handleAddBoM = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const item = {
      siteId: projectId,
      itemName: formData.get('itemName') as string,
      specification: formData.get('spec') as string,
      plannedQuantity: parseFloat(formData.get('qty') as string),
      unit: formData.get('unit') as string,
      createdAt: serverTimestamp()
    };

    addDocumentNonBlocking(collection(firestore, 'project_boms'), item);
    toast({ title: 'Item Added to BoM' });
    (e.target as HTMLFormElement).reset();
  };

  const handleUpdateStock = async (itemId: string, newStock: number) => {
    updateDocumentNonBlocking(doc(firestore, 'project_inventory', itemId), {
      stockLevel: newStock,
      lastUpdated: serverTimestamp()
    });
    toast({ title: 'Inventory Updated' });
  };

  if (projectLoading) return (
    <div className="space-y-8 p-6 animate-pulse">
      <Skeleton className="h-12 w-1/3" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  if (!project) return <div className="p-20 text-center">Project site not found in registry.</div>;

  return (
    <div className="space-y-8 pb-20 px-2 sm:px-4">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.push('/projects/list')} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Registry
        </Button>
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-sm"><Building2 className="h-8 w-8 text-primary" /></div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter">{project.name}</h1>
            <p className="text-muted-foreground font-bold text-xs sm:text-sm">{project.projectCompany}</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8 rounded-sm bg-muted/50 border border-primary/10 p-1">
          <TabsTrigger value="bom" className="rounded-sm font-bold text-[10px] uppercase tracking-widest py-2">
            <ClipboardList className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" /> BoM
          </TabsTrigger>
          <TabsTrigger value="po" className="rounded-sm font-bold text-[10px] uppercase tracking-widest py-2">
            <ShoppingBag className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" /> POs
          </TabsTrigger>
          <TabsTrigger value="inventory" className="rounded-sm font-bold text-[10px] uppercase tracking-widest py-2">
            <Warehouse className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" /> Inventory
          </TabsTrigger>
        </TabsList>

        {/* --- BoM Content --- */}
        <TabsContent value="bom" className="space-y-8 animate-in fade-in-50 duration-300">
          {isAdmin && (
            <Card className="rounded-sm border-primary/10 bg-primary/5 shadow-sm">
              <CardHeader className="py-4 border-b">
                <CardTitle className="text-xs sm:text-sm font-bold uppercase tracking-widest">Register BoM Item</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleAddBoM} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                  <div className="space-y-2 col-span-1 md:col-span-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Material Name</Label>
                    <Input name="itemName" required placeholder="e.g. Solar Module 540Wp" className="h-10 rounded-sm bg-background" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Specification</Label>
                    <Input name="spec" placeholder="e.g. Mono PERC" className="h-10 rounded-sm bg-background" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Planned Quantity</Label>
                    <div className="flex gap-2">
                      <Input name="qty" type="number" required className="h-10 rounded-sm bg-background" />
                      <Input name="unit" placeholder="Unit" className="w-24 h-10 rounded-sm bg-background" />
                    </div>
                  </div>
                  <Button type="submit" className="rounded-sm h-10 font-bold w-full">
                    <Plus className="h-4 w-4 mr-2" /> Add to BoM
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-xs sm:text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" /> Bill of Materials Registry
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="px-6 min-w-[200px]">Description</TableHead>
                      <TableHead>Specification</TableHead>
                      <TableHead className="text-center">Target Qty</TableHead>
                      <TableHead className="text-right px-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bomItems && bomItems.length > 0 ? bomItems.map(item => (
                      <TableRow key={item.id} className="hover:bg-muted/5 transition-colors">
                        <TableCell className="px-6 py-4">
                          <span className="font-bold text-sm">{item.itemName}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.specification}</TableCell>
                        <TableCell className="text-center font-mono font-bold text-primary whitespace-nowrap">
                          {item.plannedQuantity} {item.unit}
                        </TableCell>
                        <TableCell className="text-right px-6">
                          {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'project_boms', item.id))}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic text-xs">
                          No Bill of Materials items defined for this project.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Purchase Orders Content --- */}
        <TabsContent value="po" className="space-y-8 animate-in fade-in-50 duration-300">
          <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
            <CardHeader className="bg-muted/5 border-b py-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="text-xs sm:text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-primary" /> Active Purchase Orders
                </CardTitle>
                {isAdmin && (
                  <Button size="sm" className="h-8 rounded-sm font-bold text-[10px] uppercase" asChild>
                    <Link href="/settings/suppliers">Manage Suppliers</Link>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="px-6">PO Number</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right px-6">Total Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseOrders && purchaseOrders.length > 0 ? purchaseOrders.map(po => (
                      <TableRow key={po.id} className="hover:bg-muted/5 transition-colors">
                        <TableCell className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-mono text-xs font-black text-primary uppercase">{po.poNumber}</span>
                            <span className="text-[9px] text-muted-foreground font-bold">{po.orderDate}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-bold text-foreground">{po.supplierName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            "text-[9px] font-black uppercase rounded-sm px-1.5 h-5",
                            po.status === 'Open' ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-green-50 text-green-700 border-green-200"
                          )}>{po.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right px-6 font-black text-sm font-mono">
                          ₹{po.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic text-xs">
                          No purchase orders linked to this project site.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Inventory Content --- */}
        <TabsContent value="inventory" className="space-y-8 animate-in fade-in-50 duration-300">
          <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-xs sm:text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-primary" /> Live On-Site Stock
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="px-6 min-w-[200px]">Material</TableHead>
                      <TableHead className="text-center">Availability</TableHead>
                      <TableHead>Last Audit</TableHead>
                      <TableHead className="text-right px-6">Manual Adjust</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory && inventory.length > 0 ? inventory.map(item => (
                      <TableRow key={item.id} className="hover:bg-muted/5 transition-colors">
                        <TableCell className="px-6 py-4">
                          <span className="font-bold text-sm">{item.itemName}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-emerald-600 text-white font-mono font-bold rounded-sm border-none px-2 h-6">
                            {item.stockLevel} {item.unit}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">
                          {item.lastUpdated ? format(item.lastUpdated.toDate(), 'dd MMM HH:mm') : '—'}
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <div className="flex justify-end items-center gap-1.5">
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-8 w-8 rounded-sm border-primary/20 text-primary hover:bg-primary hover:text-white transition-all" 
                              onClick={() => handleUpdateStock(item.id, Math.max(0, item.stockLevel - 1))}
                            >
                              <MinusCircle className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-8 w-8 rounded-sm border-primary/20 text-primary hover:bg-primary hover:text-white transition-all" 
                              onClick={() => handleUpdateStock(item.id, item.stockLevel + 1)}
                            >
                              <PlusCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic text-xs">
                          Inventory records for this site have not been initialized.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
