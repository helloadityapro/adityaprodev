
"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { PackageCheck, Search, FilterX, Building2, Layers, Boxes, Clock, PieChart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type InventoryItem = {
  id: string;
  siteId: string;
  siteName: string;
  itemName: string;
  stockLevel: number;
  utilisedQuantity?: number;
  unit: string;
  lastUpdated: any;
};

const formatTimestamp = (ts: any) => {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return format(date, 'dd MMM yyyy, HH:mm');
};

export default function GlobalInventoryPage() {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = React.useState("");

  const inventoryQuery = useMemoFirebase(() => 
    query(collection(firestore, 'project_inventory'), orderBy('siteName', 'asc')), 
    [firestore]
  );
  const { data: inventory, isLoading } = useCollection<InventoryItem>(inventoryQuery);

  const filteredInventory = React.useMemo(() => {
    if (!inventory) return [];
    return inventory.filter(item => 
      item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.siteName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [inventory, searchTerm]);

  if (isLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-[500px] w-full" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
          <PackageCheck className="h-8 w-8" /> Global Inventory
        </h1>
        <p className="text-muted-foreground font-medium">Real-time component-level stock availability and utilisation across all project sites.</p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by material or project site..." 
            className="pl-10 h-10 text-sm rounded-sm border-primary/20 bg-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-sm font-black uppercase text-[10px] tracking-widest px-3 h-8 border-primary/20 text-primary">
            {filteredInventory.length} Stock Records
          </Badge>
          <Button variant="ghost" size="icon" onClick={() => setSearchTerm("")} className="h-10 w-10 text-muted-foreground rounded-sm">
            <FilterX className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6 min-w-[200px]">Project Site</TableHead>
                  <TableHead className="min-w-[250px]">Material / Component</TableHead>
                  <TableHead className="text-center">Available Stock</TableHead>
                  <TableHead className="text-center">Utilised Qty</TableHead>
                  <TableHead className="text-right px-6">Last Update</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInventory.length > 0 ? filteredInventory.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/5 transition-colors group">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-sm text-primary">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-sm text-foreground">{item.siteName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-foreground">{item.itemName}</span>
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Site Allocated Asset</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn(
                        "font-mono font-bold rounded-sm px-3 h-7 border-none shadow-sm",
                        item.stockLevel > 0 ? "bg-emerald-600 text-white" : "bg-red-500 text-white"
                      )}>
                        {item.stockLevel} {item.unit}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-mono font-bold rounded-sm px-3 h-7 bg-amber-100 text-amber-800 border-amber-200">
                        <PieChart className="h-3 w-3 mr-1.5 opacity-60" />
                        {item.utilisedQuantity || 0} {item.unit}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-muted-foreground uppercase">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(item.lastUpdated)}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic">
                      <div className="flex flex-col items-center gap-2 opacity-40">
                        <Boxes className="h-10 w-10" />
                        <p className="text-sm font-bold uppercase tracking-widest">No stock records found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
