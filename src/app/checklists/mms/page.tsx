"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking } from "@/firebase";
import { collection, query, where, getDocs, doc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, 
  Check, 
  ChevronsUpDown, 
  Loader2, 
  LayoutGrid, 
  Building2, 
  ClipboardCheck,
  AlertCircle,
  Save,
  Layers,
  Settings2
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

type Site = {
  id: string;
  name: string;
};

type TableConfig = {
  id: string;
  tableName: string;
  modulesPerTable: number;
};

type BoMItem = {
  id: string;
  itemName: string;
  unit: string;
  subItems?: { name: string; quantityPerSet: number; unit: string }[];
};

type ComponentRow = {
  name: string;
  requiredQty: number;
  installedQty: string;
  unit: string;
};

export default function MmsChecklistPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [selectedSiteId, setSelectedSiteId] = React.useState<string>("");
  const [selectedSiteName, setSelectedSiteName] = React.useState<string>("");
  const [selectedTableId, setSelectedTableId] = React.useState<string>("");
  const [selectedTableName, setSelectedTableName] = React.useState<string>("");
  const [selectedBomId, setSelectedBomId] = React.useState<string>("");
  const [selectedBomName, setSelectedBomName] = React.useState<string>("");
  
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  const [isTablePopoverOpen, setIsTablePopoverOpen] = React.useState(false);
  const [tableSearchQuery, setTableSearchQuery] = React.useState("");
  const [isBomPopoverOpen, setIsBomPopoverOpen] = React.useState(false);
  const [bomSearchQuery, setBomSearchQuery] = React.useState("");

  const [availableTables, setAvailableTables] = React.useState<TableConfig[]>([]);
  const [availableBomConfigs, setAvailableBomConfigs] = React.useState<BoMItem[]>([]);
  const [componentRows, setComponentRows] = React.useState<ComponentRow[]>([]);
  const [generalRemarks, setGeneralRemarks] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);

  // 1. Fetch available data when site changes
  React.useEffect(() => {
    if (selectedSiteId) {
      const fetchData = async () => {
        // Fetch Tables from Master Data
        const tQ = query(collection(firestore, 'table_configurations'), where('siteId', '==', selectedSiteId));
        const tSnap = await getDocs(tQ);
        setAvailableTables(tSnap.docs.map(d => ({ id: d.id, ...d.data() } as TableConfig)));

        // Fetch Approved BoM Configurations
        const bQ = query(
          collection(firestore, 'project_boms'), 
          where('siteId', '==', selectedSiteId), 
          where('category', '==', 'Modules Mounting Structure'),
          where('status', '==', 'Approved')
        );
        const bSnap = await getDocs(bQ);
        setAvailableBomConfigs(bSnap.docs.map(d => ({ id: d.id, ...d.data() } as BoMItem)));
      };
      fetchData();
    } else {
      setAvailableTables([]);
      setAvailableBomConfigs([]);
    }
    setSelectedTableId("");
    setSelectedTableName("");
    setSelectedBomId("");
    setSelectedBomName("");
    setComponentRows([]);
  }, [selectedSiteId, firestore]);

  // 2. Initialize components list when BoM configuration is selected
  React.useEffect(() => {
    if (selectedBomId) {
      const config = availableBomConfigs.find(c => c.id === selectedBomId);
      if (config?.subItems) {
        setComponentRows(config.subItems.map(m => ({
          name: m.name,
          requiredQty: m.quantityPerSet,
          installedQty: "",
          unit: m.unit
        })));
      } else {
        setComponentRows([]);
      }
    }
  }, [selectedBomId, availableBomConfigs]);

  const handleUpdateInstalledQty = (index: number, val: string) => {
    const newRows = [...componentRows];
    newRows[index].installedQty = val;
    setComponentRows(newRows);
  };

  const handleSubmit = async () => {
    if (!selectedSiteId || !selectedTableId || !selectedBomId || !user) {
      toast({ variant: 'destructive', title: 'Selection Missing', description: 'Please complete all selections (Site, Table, and BoM Config).' });
      return;
    }

    // Validation: Check if any installed qty exceeds required
    const overage = componentRows.some(row => parseFloat(row.installedQty) > row.requiredQty);
    if (overage) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Installed quantity cannot exceed required BoM quantity.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await addDocumentNonBlocking(collection(firestore, 'mms_checklists'), {
        siteId: selectedSiteId,
        siteName: selectedSiteName,
        tableId: selectedTableId,
        tableName: selectedTableName,
        bomId: selectedBomId,
        bomName: selectedBomName,
        components: componentRows,
        generalRemarks,
        userId: user.uid,
        userName: userProfile?.username || user.email,
        siteManagerId: userProfile?.siteManagerId || null,
        createdAt: serverTimestamp()
      });

      toast({ title: 'Checklist Saved', description: `Audit for ${selectedTableName} published successfully.` });
      
      // Reset form
      setSelectedTableId("");
      setSelectedTableName("");
      setSelectedBomId("");
      setSelectedBomName("");
      setComponentRows([]);
      setGeneralRemarks("");
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSites = allSites?.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase())) || [];
  const filteredTables = availableTables.filter(t => t.tableName.toLowerCase().includes(tableSearchQuery.toLowerCase()));
  const filteredBomConfigs = availableBomConfigs.filter(b => b.itemName.toLowerCase().includes(bomSearchQuery.toLowerCase()));

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
          <ClipboardCheck className="h-8 w-8" /> Table-Level MMS Checklist
        </h1>
        <p className="text-muted-foreground font-medium">Verify field installations against approved BoM configurations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Selection Card */}
        <Card className="lg:col-span-1 shadow-md border-primary/10 rounded-sm h-fit">
          <CardHeader className="bg-primary/5 border-b py-4">
            <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Route Context
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">1. Select Project Site</Label>
              <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal h-11 rounded-sm", !selectedSiteId && "text-muted-foreground")}>
                    {selectedSiteId ? selectedSiteName : "Choose site..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <Input placeholder="Search sites..." className="h-9 w-full border-none focus-visible:ring-0 px-0 text-sm" value={siteSearchQuery} onChange={e => setSiteSearchQuery(e.target.value)} />
                  </div>
                  <ScrollArea className="h-[200px]">
                    <div className="p-1">
                      {filteredSites.map(site => (
                        <Button key={site.id} type="button" variant="ghost" className="w-full justify-start h-10 text-xs" onClick={() => { setSelectedSiteId(site.id); setSelectedSiteName(site.name); setIsSitePopoverOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4 text-primary", selectedSiteId === site.id ? "opacity-100" : "opacity-0")} />
                          {site.name}
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">2. Select Physical Table</Label>
              <Popover open={isTablePopoverOpen} onOpenChange={setIsTablePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" disabled={!selectedSiteId} role="combobox" className={cn("w-full justify-between font-normal rounded-sm h-11", !selectedTableId && "text-muted-foreground")}>
                    {selectedTableId ? selectedTableName : "Choose table..."}
                    <LayoutGrid className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <Input placeholder="Search tables..." className="h-9 w-full border-none focus-visible:ring-0 px-0 text-sm" value={tableSearchQuery} onChange={e => setTableSearchQuery(e.target.value)} />
                  </div>
                  <ScrollArea className="h-[200px]">
                    <div className="p-1">
                      {filteredTables.length > 0 ? filteredTables.map(table => (
                        <Button key={table.id} type="button" variant="ghost" className="w-full justify-start h-10 text-xs" onClick={() => { setSelectedTableId(table.id); setSelectedTableName(table.tableName); setIsTablePopoverOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4 text-primary", selectedTableId === table.id ? "opacity-100" : "opacity-0")} />
                          <div className="flex flex-col items-start overflow-hidden text-left">
                            <span className="truncate font-bold">{table.tableName}</span>
                            <span className="text-[8px] uppercase text-muted-foreground">{table.modulesPerTable} Modules</span>
                          </div>
                        </Button>
                      )) : (
                        <p className="p-4 text-center text-xs text-muted-foreground italic">No master tables defined.</p>
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">3. BoM Configuration Source</Label>
              <Popover open={isBomPopoverOpen} onOpenChange={setIsBomPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" disabled={!selectedSiteId} role="combobox" className={cn("w-full justify-between font-normal rounded-sm h-11", !selectedBomId && "text-muted-foreground")}>
                    <span className="truncate">{selectedBomId ? selectedBomName : "Select BoM Configuration..."}</span>
                    <Settings2 className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <Input placeholder="Filter BoM items..." className="h-10 w-full border-none focus-visible:ring-0 px-0 text-sm" value={bomSearchQuery} onChange={e => setBomSearchQuery(e.target.value)} />
                  </div>
                  <ScrollArea className="h-[200px]">
                    <div className="p-1">
                      {filteredBomConfigs.length > 0 ? filteredBomConfigs.map(item => (
                        <Button key={item.id} type="button" variant="ghost" className="w-full justify-start h-11 text-xs" onClick={() => { setSelectedBomId(item.id); setSelectedBomName(item.itemName); setIsBomPopoverOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4 text-primary", selectedBomId === item.id ? "opacity-100" : "opacity-0")} />
                          <div className="flex flex-col items-start overflow-hidden text-left">
                            <span className="truncate font-bold">{item.itemName}</span>
                            <span className="text-[8px] uppercase text-muted-foreground">{item.subItems?.length || 0} Components</span>
                          </div>
                        </Button>
                      )) : (
                        <p className="p-4 text-center text-xs text-muted-foreground italic">No approved MMS items in site BoM.</p>
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {/* Components Table Card */}
        <Card className="lg:col-span-2 rounded-sm border-primary/10 shadow-lg animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
          <CardHeader className="bg-muted/5 border-b py-4">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
              <Layers className="h-4 w-4" /> Component Verification Matrix
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {selectedBomId ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow>
                      <TableHead className="px-6 text-[10px] uppercase font-black">Component Name</TableHead>
                      <TableHead className="text-center text-[10px] uppercase font-black">Required Qty</TableHead>
                      <TableHead className="text-right px-6 text-[10px] uppercase font-black">Installed Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {componentRows.length > 0 ? componentRows.map((row, idx) => {
                      const isOverLimit = parseFloat(row.installedQty) > row.requiredQty;
                      return (
                        <TableRow key={idx} className="hover:bg-muted/5 transition-colors">
                          <TableCell className="px-6 py-4 font-bold text-sm">{row.name}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="font-mono h-6 px-2 rounded-sm border-primary/20 text-primary">
                              {row.requiredQty} {row.unit}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <div className="flex flex-col items-end gap-1">
                              <Input 
                                type="number" 
                                step="0.01"
                                placeholder="0.00"
                                value={row.installedQty}
                                onChange={(e) => handleUpdateInstalledQty(idx, e.target.value)}
                                className={cn(
                                  "h-9 w-24 text-right font-mono font-bold rounded-sm bg-background",
                                  isOverLimit && "border-red-500 text-red-600 focus-visible:ring-red-500"
                                )}
                              />
                              {isOverLimit && (
                                <span className="text-[8px] font-black text-red-600 uppercase tracking-tighter">Exceeds Required</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }) : (
                      <TableRow>
                        <TableCell colSpan={3} className="h-32 text-center text-muted-foreground italic text-xs">
                          Selected configuration has no members defined.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-32 flex flex-col items-center justify-center text-center gap-4 text-muted-foreground/30 italic">
                <Settings2 className="h-12 w-12" />
                <p className="text-sm font-bold uppercase tracking-widest">Select BoM Source to Load Components</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedBomId && (
        <Card className="rounded-sm shadow-xl border-primary/10 animate-in slide-in-from-bottom-2 duration-300">
          <CardHeader className="bg-muted/5 border-b py-4">
            <CardTitle className="text-xs font-black uppercase tracking-widest">Verification Summary</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Audit Observations / Remarks</Label>
              <Textarea 
                placeholder="Notes regarding installation quality, torquing status, or structural integrity..." 
                rows={4} 
                value={generalRemarks}
                onChange={(e) => setGeneralRemarks(e.target.value)}
                className="rounded-sm text-sm"
              />
            </div>

            <div className="p-4 bg-amber-50 border border-amber-100 rounded-sm flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 font-medium leading-relaxed italic">
                By publishing this checklist, you certify that the quantities logged reflect the actual physical components installed at the project site.
              </p>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/5 border-t p-6 flex justify-end">
            <Button 
              className="min-w-[200px] h-12 rounded-sm font-black text-lg shadow-xl" 
              onClick={handleSubmit}
              disabled={isSubmitting || componentRows.length === 0}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <><Save className="mr-2 h-4 w-4" /> PUBLISH CHECKLIST</>}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
