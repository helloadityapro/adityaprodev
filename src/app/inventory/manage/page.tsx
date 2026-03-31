
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Trash2, 
  Boxes, 
  ChevronDown, 
  ChevronUp, 
  Layers,
  Search,
  FilterX,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Tag,
  Eye
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { isSuperAdmin } from '@/lib/auth-constants';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type MasterItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  make: string;
  description?: string;
  subItems?: { name: string; quantityPerSet: number; unit: string }[];
  createdAt: any;
};

type SortKey = 'name' | 'category' | 'make' | 'unit';

export default function ManageMasterInventoryPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const itemsQuery = useMemoFirebase(() => collection(firestore, 'master_inventory'), [firestore]);
  const { data: items, isLoading: isItemsLoading } = useCollection<MasterItem>(itemsQuery);

  const categoriesQuery = useMemoFirebase(() => collection(firestore, 'inventory_categories'), [firestore]);
  const { data: categories } = useCollection<{ name: string }>(categoriesQuery);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3.5 w-3.5 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3.5 w-3.5 text-primary" /> : <ArrowDown className="ml-2 h-3.5 w-3.5 text-primary" />;
  };

  const filteredItems = React.useMemo(() => {
    if (!items) return [];

    let result = items.filter(item => {
      const matchesSearch = 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description || "").toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });

    result.sort((a, b) => {
      const { key, direction } = sortConfig;
      let valA: any = a[key]?.toLowerCase() || '';
      let valB: any = b[key]?.toLowerCase() || '';

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [items, searchTerm, categoryFilter, sortConfig]);

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setCategoryFilter("all");
  };

  if (isUserLoading || isProfileLoading || isItemsLoading) {
    return (
      <div className="space-y-8 p-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2">
            <Boxes className="h-8 w-8 text-primary" /> Master Item Registry
          </h1>
          <p className="text-muted-foreground text-sm font-medium">Define global materials, components, and set-breakdowns for organizational use.</p>
        </div>
        {isAdmin && (
          <Button asChild className="h-11 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-md px-6">
            <Link href="/inventory/manage/add">
              <Plus className="mr-2 h-4 w-4" /> Add New Item
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search name, make, or specs..." 
            className="pl-10 h-10 text-sm rounded-sm border-primary/20 bg-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground hidden sm:block" />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px] h-10 text-xs font-bold uppercase rounded-sm border-primary/20 bg-background">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-bold uppercase">All Categories</SelectItem>
                {categories?.map(cat => (
                  <SelectItem key={cat.name} value={cat.name} className="text-xs font-bold uppercase">{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10 px-3 rounded-sm font-bold text-[10px] uppercase tracking-widest text-muted-foreground">
            <FilterX className="h-3.5 w-3.5 mr-1.5" /> Clear
          </Button>
        </div>
      </div>

      <Card className="rounded-sm border-primary/10 shadow-md overflow-hidden">
        <CardHeader className="bg-muted/5 border-b py-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <Boxes className="h-4 w-4 text-primary" /> Material Catalog
          </CardTitle>
          <Badge variant="outline" className="rounded-sm font-black uppercase text-[10px] bg-primary/5 text-primary border-primary/10">
            {filteredItems.length} Registered Items
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('name')}>
                    <div className="flex items-center">Description <SortIcon column="name" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('category')}>
                    <div className="flex items-center">Category <SortIcon column="category" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('make')}>
                    <div className="flex items-center">Make <SortIcon column="make" /></div>
                  </TableHead>
                  <TableHead className="text-center cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('unit')}>
                    <div className="flex items-center justify-center">Base Unit <SortIcon column="unit" /></div>
                  </TableHead>
                  {isAdmin && <TableHead className="text-right px-6">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length > 0 ? filteredItems.map((item) => (
                  <React.Fragment key={item.id}>
                    <TableRow className="hover:bg-muted/5 transition-colors group">
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {item.unit === 'Sets' && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => toggleRow(item.id)}>
                              {expandedRows.has(item.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          )}
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-foreground">{item.name}</span>
                            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tight">{item.id.slice(0, 8)}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-sm font-bold text-[9px] uppercase tracking-wider bg-primary/5 text-primary border-primary/10">
                          {item.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-muted-foreground">{item.make}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="rounded-sm text-[9px] font-black uppercase h-5">
                          {item.unit}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right px-6">
                          <div className="flex justify-end items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => {
                              deleteDocumentNonBlocking(doc(firestore, 'master_inventory', item.id));
                              toast({ title: 'Item Removed' });
                            }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                    {expandedRows.has(item.id) && item.subItems && (
                      <TableRow className="bg-primary/[0.02]">
                        <TableCell colSpan={isAdmin ? 5 : 4} className="p-0 border-b">
                          <div className="p-4 px-12 space-y-3 animate-in slide-in-from-top-1 duration-200">
                            <div className="flex items-center gap-2 mb-2">
                              <Layers className="h-3.5 w-3.5 text-primary" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-primary">Component Breakdown</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                              {item.subItems.map((sub, sIdx) => (
                                <div key={sIdx} className="p-3 bg-background border border-primary/5 rounded-sm flex flex-col gap-1 shadow-sm">
                                  <span className="text-xs font-bold">{sub.name}</span>
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-muted-foreground uppercase font-medium">Standard Quantity:</span>
                                    <span className="text-primary font-black uppercase">{sub.quantityPerSet} {sub.unit}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )) : (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 5 : 4} className="h-48 text-center text-muted-foreground italic flex flex-col items-center justify-center gap-2">
                      <Boxes className="h-10 w-10 opacity-20" />
                      <p className="text-sm font-bold uppercase tracking-widest">No items matching current filters</p>
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
