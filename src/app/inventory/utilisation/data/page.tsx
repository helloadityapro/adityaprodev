"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { collection, query, orderBy, doc, limit } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { 
  History, 
  Search, 
  FilterX, 
  Clock, 
  MapPin, 
  User, 
  PieChart,
  Calendar,
  Building2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ListFilter,
  FileDown
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';

type Utilisation = {
  id: string;
  siteName: string;
  itemName: string;
  quantity: number;
  unit: string;
  utilisationDate: string;
  remarks: string;
  userName: string;
  createdAt: any;
};

type SortKey = 'date' | 'site' | 'item' | 'quantity' | 'personnel';

export default function UtilisationDataPage() {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [siteFilter, setSiteFilter] = React.useState("all");
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ 
    key: 'date', 
    direction: 'desc' 
  });

  const dataQuery = useMemoFirebase(() => 
    query(collection(firestore, 'material_utilisations'), orderBy('createdAt', 'desc'), limit(500)), 
    [firestore]
  );
  const { data: utilisations, isLoading } = useCollection<Utilisation>(dataQuery);

  const uniqueSites = React.useMemo(() => {
    if (!utilisations) return [];
    return Array.from(new Set(utilisations.map(u => u.siteName))).sort();
  }, [utilisations]);

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

  const filteredData = React.useMemo(() => {
    if (!utilisations) return [];
    
    let result = utilisations.filter(u => 
      u.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.remarks.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (siteFilter !== 'all') {
      result = result.filter(u => u.siteName === siteFilter);
    }

    result.sort((a, b) => {
      const { key, direction } = sortConfig;
      let valA: any = '';
      let valB: any = '';

      if (key === 'date') {
        valA = new Date(a.utilisationDate).getTime();
        valB = new Date(b.utilisationDate).getTime();
      } else if (key === 'site') {
        valA = a.siteName.toLowerCase();
        valB = b.siteName.toLowerCase();
      } else if (key === 'item') {
        valA = a.itemName.toLowerCase();
        valB = b.itemName.toLowerCase();
      } else if (key === 'quantity') {
        valA = a.quantity;
        valB = b.quantity;
      } else if (key === 'personnel') {
        valA = a.userName.toLowerCase();
        valB = b.userName.toLowerCase();
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [utilisations, searchTerm, siteFilter, sortConfig]);

  const handleExport = () => {
    if (filteredData.length === 0) return;
    
    const exportData = filteredData.map(u => ({
      'Date': u.utilisationDate,
      'Project Site': u.siteName,
      'Material Consumed': u.itemName,
      'Quantity': u.quantity,
      'Unit': u.unit,
      'Remarks': u.remarks,
      'Personnel': u.userName,
      'Log Timestamp': u.createdAt ? format(u.createdAt.toDate(), 'dd/MM/yyyy HH:mm:ss') : 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Material Utilisations");
    XLSX.writeFile(wb, `Material_Utilisations_Registry_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSiteFilter("all");
  };

  if (isLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-[500px] w-full" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
            <History className="h-8 w-8" /> Global Utilisation Data
          </h1>
          <p className="text-muted-foreground font-medium">Historical audit trail of material consumption across organizational project sites.</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="h-10 rounded-sm font-bold border-primary text-primary hover:bg-primary/5 shadow-sm px-6">
          <FileDown className="h-4 w-4 mr-2" />
          Export to Excel
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search material or personnel..." 
            className="pl-10 h-10 text-sm rounded-sm border-primary/20 bg-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={siteFilter} onValueChange={setSiteFilter}>
            <SelectTrigger className="w-[180px] h-10 text-xs font-bold uppercase rounded-sm border-primary/20 bg-background">
              <ListFilter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs font-bold uppercase">All Projects</SelectItem>
              {uniqueSites.map(site => (
                <SelectItem key={site} value={site} className="text-xs font-bold uppercase">{site}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Badge variant="outline" className="rounded-sm font-black uppercase text-[10px] tracking-widest px-3 h-10 border-primary/20 text-primary bg-primary/5">
            {filteredData.length} Records Found
          </Badge>

          <Button variant="ghost" size="icon" onClick={clearFilters} className="h-10 w-10 text-muted-foreground rounded-sm">
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
                  <TableHead 
                    className="px-6 cursor-pointer hover:text-primary transition-colors"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center">Date <SortIcon column="date" /></div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:text-primary transition-colors"
                    onClick={() => handleSort('site')}
                  >
                    <div className="flex items-center">Project Site <SortIcon column="site" /></div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:text-primary transition-colors"
                    onClick={() => handleSort('item')}
                  >
                    <div className="flex items-center">Material Consumed <SortIcon column="item" /></div>
                  </TableHead>
                  <TableHead 
                    className="text-center cursor-pointer hover:text-primary transition-colors"
                    onClick={() => handleSort('quantity')}
                  >
                    <div className="flex items-center justify-center">Quantity <SortIcon column="quantity" /></div>
                  </TableHead>
                  <TableHead className="min-w-[200px]">Remarks</TableHead>
                  <TableHead 
                    className="text-right px-6 cursor-pointer hover:text-primary transition-colors"
                    onClick={() => handleSort('personnel')}
                  >
                    <div className="flex items-center justify-end">Personnel <SortIcon column="personnel" /></div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length > 0 ? filteredData.map((u) => (
                  <TableRow key={u.id} className="hover:bg-muted/5 transition-colors">
                    <TableCell className="px-6 py-4 font-mono text-xs font-bold text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        {u.utilisationDate}
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-sm text-foreground">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3 w-3 text-primary" />
                        {u.siteName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{u.itemName}</span>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">Inventory Consumption</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-mono font-bold rounded-sm px-2 bg-amber-50 text-amber-700 border-amber-200">
                        {u.quantity} {u.unit}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs italic text-muted-foreground max-w-[250px] truncate" title={u.remarks}>
                      "{u.remarks}"
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex items-center justify-end gap-2 text-xs font-bold text-muted-foreground uppercase">
                        <User className="h-3 w-3 text-primary" />
                        {u.userName}
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic">
                      <div className="flex flex-col items-center gap-2 opacity-40">
                        <PieChart className="h-10 w-10" />
                        <p className="text-sm font-bold uppercase tracking-widest">No consumption records discovered</p>
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
