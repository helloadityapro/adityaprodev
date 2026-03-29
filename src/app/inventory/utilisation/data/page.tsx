
"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { collection, query, orderBy, doc, limit } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  History, 
  Search, 
  FilterX, 
  Clock, 
  MapPin, 
  User, 
  PieChart,
  Calendar,
  Building2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

export default function UtilisationDataPage() {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = React.useState("");

  const dataQuery = useMemoFirebase(() => 
    query(collection(firestore, 'material_utilisations'), orderBy('createdAt', 'desc'), limit(500)), 
    [firestore]
  );
  const { data: utilisations, isLoading } = useCollection<Utilisation>(dataQuery);

  const filteredData = React.useMemo(() => {
    if (!utilisations) return [];
    return utilisations.filter(u => 
      u.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.remarks.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [utilisations, searchTerm]);

  if (isLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-[500px] w-full" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
          <History className="h-8 w-8" /> Global Utilisation Data
        </h1>
        <p className="text-muted-foreground font-medium">Historical audit trail of material consumption across organizational project sites.</p>
      </div>

      <div className="relative w-full md:w-96 bg-card p-4 border border-primary/10 rounded-sm shadow-sm flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search consumption logs..." 
            className="pl-10 h-10 text-sm rounded-sm border-primary/20 bg-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSearchTerm("")} className="h-10 w-10 text-muted-foreground rounded-sm">
          <FilterX className="h-4 w-4" />
        </Button>
      </div>

      <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6">Date</TableHead>
                  <TableHead>Project Site</TableHead>
                  <TableHead>Material Consumed</TableHead>
                  <TableHead className="text-center">Quantity</TableHead>
                  <TableHead className="min-w-[200px]">Remarks</TableHead>
                  <TableHead className="text-right px-6">Personnel</TableHead>
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
                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic">No consumption records discovered.</TableCell>
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
