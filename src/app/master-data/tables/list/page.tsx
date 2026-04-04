
"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, deleteDocumentNonBlocking } from "@/firebase";
import { collection, query, orderBy, doc, limit } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  LayoutGrid, 
  Search, 
  FilterX, 
  Building2, 
  Layers, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  Boxes,
  Plus
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { isSuperAdmin } from "@/lib/auth-constants";

type TableConfig = {
  id: string;
  siteId: string;
  siteName: string;
  tableName: string;
  bomItemId: string;
  configurationType: string;
  modulesPerTable: number;
  members: { name: string; quantityPerSet: number; unit: string }[];
  createdAt: any;
};

export default function TablesDataPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = React.useState("");
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const tablesQuery = useMemoFirebase(() => 
    query(collection(firestore, 'table_configurations'), orderBy('createdAt', 'desc')), 
    [firestore]
  );
  const { data: tables, isLoading } = useCollection<TableConfig>(tablesQuery);

  const filteredTables = React.useMemo(() => {
    if (!tables) return [];
    return tables.filter(t => 
      t.tableName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.configurationType.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [tables, searchTerm]);

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  const handleDelete = (id: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'table_configurations', id));
    toast({ title: 'Record Removed', description: 'Table configuration deleted from registry.' });
  };

  if (isLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
            <LayoutGrid className="h-8 w-8" /> Table Registry
          </h1>
          <p className="text-muted-foreground font-medium">Master list of solar mounting structures defined across project sites.</p>
        </div>
        <Button asChild className="h-10 rounded-sm font-bold shadow-md px-6">
          <Link href="/master-data/tables/add"><Plus className="h-4 w-4 mr-2" /> Add Table Data</Link>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by table, site or configuration..." 
            className="pl-10 h-10 text-sm rounded-sm border-primary/20 bg-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-sm font-black uppercase text-[10px] tracking-widest px-3 h-8 border-none">
            {filteredTables.length} Configs Registered
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
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="px-6">Project Site</TableHead>
                  <TableHead>Table Name</TableHead>
                  <TableHead>Configuration Type</TableHead>
                  <TableHead className="text-center">Modules/Table</TableHead>
                  <TableHead className="text-right px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTables.length > 0 ? filteredTables.map((t) => (
                  <React.Fragment key={t.id}>
                    <TableRow className="hover:bg-muted/5 transition-colors group">
                      <TableCell className="pl-4">
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => toggleRow(t.id)}>
                          {expandedRows.has(t.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-primary/60" />
                          <span className="font-bold text-sm text-foreground">{t.siteName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-sm text-primary">{t.tableName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-sm font-bold text-[9px] uppercase tracking-wider border-primary/20 bg-primary/5 text-primary h-5 px-2">
                          {t.configurationType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="font-mono font-black rounded-sm px-3 h-7 bg-slate-900 text-white border-none shadow-sm">
                          {t.modulesPerTable}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right px-6">
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => handleDelete(t.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(t.id) && (
                      <TableRow className="bg-primary/[0.02]">
                        <TableCell colSpan={6} className="p-0 border-b">
                          <div className="p-6 px-16 space-y-4 animate-in slide-in-from-top-1 duration-200">
                            <div className="flex items-center gap-2 mb-2">
                              <Layers className="h-3.5 w-3.5 text-primary" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-primary">Member Breakdown</span>
                            </div>
                            {t.members && t.members.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {t.members.map((sub, sIdx) => (
                                  <div key={sIdx} className="p-3 bg-background border border-primary/5 rounded-sm flex flex-col gap-1 shadow-sm">
                                    <span className="text-xs font-bold">{sub.name}</span>
                                    <div className="flex items-center justify-between text-[10px]">
                                      <span className="text-muted-foreground uppercase font-medium">Std Quantity:</span>
                                      <span className="text-primary font-black uppercase">{sub.quantityPerSet} {sub.unit}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[10px] text-muted-foreground italic uppercase">No members defined for this configuration</p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic">
                      <div className="flex flex-col items-center gap-2 opacity-40">
                        <Boxes className="h-10 w-10" />
                        <p className="text-sm font-bold uppercase tracking-widest">No table records discovered</p>
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
