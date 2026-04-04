
"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking } from "@/firebase";
import { collection, query, where, getDocs, doc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  CheckCircle2, 
  ClipboardCheck,
  AlertCircle,
  Save
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

type Site = {
  id: string;
  name: string;
};

type TableConfig = {
  id: string;
  tableName: string;
  configurationType: string;
  members: { name: string; quantityPerSet: number; unit: string }[];
};

type ChecklistItem = {
  name: string;
  checked: boolean;
  remarks: string;
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
  
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  const [isTablePopoverOpen, setIsTablePopoverOpen] = React.useState(false);
  const [tableSearchQuery, setTableSearchQuery] = React.useState("");

  const [tableConfigs, setTableConfigs] = React.useState<TableConfig[]>([]);
  const [checklistItems, setChecklistItems] = React.useState<ChecklistItem[]>([]);
  const [generalRemarks, setGeneralRemarks] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);

  // Fetch tables when site changes
  React.useEffect(() => {
    if (selectedSiteId) {
      const fetchTables = async () => {
        const q = query(collection(firestore, 'table_configurations'), where('siteId', '==', selectedSiteId));
        const snap = await getDocs(q);
        const configs = snap.docs.map(d => ({ id: d.id, ...d.data() } as TableConfig));
        setTableConfigs(configs);
      };
      fetchTables();
    } else {
      setTableConfigs([]);
    }
    setSelectedTableId("");
    setSelectedTableName("");
    setChecklistItems([]);
  }, [selectedSiteId, firestore]);

  // Load checklist items when table changes
  React.useEffect(() => {
    if (selectedTableId) {
      const config = tableConfigs.find(c => c.id === selectedTableId);
      if (config?.members) {
        setChecklistItems(config.members.map(m => ({
          name: m.name,
          checked: false,
          remarks: ""
        })));
      }
    }
  }, [selectedTableId, tableConfigs]);

  const handleToggleItem = (index: number) => {
    const newItems = [...checklistItems];
    newItems[index].checked = !newItems[index].checked;
    setChecklistItems(newItems);
  };

  const handleUpdateItemRemarks = (index: number, val: string) => {
    const newItems = [...checklistItems];
    newItems[index].remarks = val;
    setChecklistItems(newItems);
  };

  const handleSubmit = async () => {
    if (!selectedSiteId || !selectedTableId || !user) {
      toast({ variant: 'destructive', title: 'Selection Missing', description: 'Please select a project and a table structure.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await addDocumentNonBlocking(collection(firestore, 'mms_checklists'), {
        siteId: selectedSiteId,
        siteName: selectedSiteName,
        tableId: selectedTableId,
        tableName: selectedTableName,
        items: checklistItems,
        generalRemarks,
        userId: user.uid,
        userName: userProfile?.username || user.email,
        createdAt: serverTimestamp()
      });

      toast({ title: 'Checklist Saved', description: `Inspection for ${selectedTableName} has been recorded.` });
      
      // Reset form
      setSelectedTableId("");
      setSelectedTableName("");
      setChecklistItems([]);
      setGeneralRemarks("");
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSites = allSites?.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase())) || [];
  const filteredTables = tableConfigs.filter(t => t.tableName.toLowerCase().includes(tableSearchQuery.toLowerCase()));

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
          <ClipboardCheck className="h-8 w-8" /> Table Level MMS Checklist
        </h1>
        <p className="text-muted-foreground font-medium">Perform component-level verification for Mounting Structures.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-md border-primary/10 rounded-sm">
          <CardHeader className="bg-primary/5 border-b py-4">
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Selection
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Select Project Site</Label>
              <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal h-11 rounded-sm", !selectedSiteId && "text-muted-foreground")}>
                    {selectedSiteId ? selectedSiteName : "Choose a site..."}
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
                        <Button key={site.id} type="button" variant="ghost" className="w-full justify-start h-10 text-sm" onClick={() => { setSelectedSiteId(site.id); setSelectedSiteName(site.name); setIsSitePopoverOpen(false); }}>
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
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Select Table Structure</Label>
              <Popover open={isTablePopoverOpen} onOpenChange={setIsTablePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" disabled={!selectedSiteId} role="combobox" className={cn("w-full justify-between font-normal h-11 rounded-sm", !selectedTableId && "text-muted-foreground")}>
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
                            <span className="truncate">{table.tableName}</span>
                            <span className="text-[8px] uppercase text-muted-foreground">{table.configurationType}</span>
                          </div>
                        </Button>
                      )) : (
                        <p className="p-4 text-center text-xs text-muted-foreground italic">No tables defined for this site.</p>
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {selectedTableId && (
          <Card className="rounded-sm border-primary/10 shadow-lg animate-in fade-in zoom-in-95 duration-200">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" /> Structure Components
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="p-4 bg-primary/5 border border-primary/10 rounded-sm">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] mb-2">Checklist Verification</p>
                <div className="space-y-4">
                  {checklistItems.map((item, idx) => (
                    <div key={idx} className="space-y-2 p-3 bg-background border rounded-sm shadow-sm transition-all hover:border-primary/30">
                      <div className="flex items-center space-x-3">
                        <Checkbox 
                          id={`check-${idx}`} 
                          checked={item.checked} 
                          onCheckedChange={() => handleToggleItem(idx)}
                          className="h-5 w-5 rounded-sm"
                        />
                        <Label htmlFor={`check-${idx}`} className="text-xs font-bold uppercase cursor-pointer leading-none flex-1">
                          {item.name}
                        </Label>
                      </div>
                      <Input 
                        placeholder="Add remarks for this item..." 
                        value={item.remarks} 
                        onChange={(e) => handleUpdateItemRemarks(idx, e.target.value)}
                        className="h-8 text-[10px] rounded-sm bg-muted/10 border-dashed"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {selectedTableId && (
        <Card className="rounded-sm shadow-xl border-primary/10 animate-in slide-in-from-bottom-2 duration-300">
          <CardHeader className="bg-muted/5 border-b">
            <CardTitle className="text-sm font-black uppercase tracking-widest">Final Conclusion</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Overall Inspection Remarks</Label>
              <Textarea 
                placeholder="Detail any site constraints, damages, or general observations..." 
                rows={4} 
                value={generalRemarks}
                onChange={(e) => setGeneralRemarks(e.target.value)}
                className="rounded-sm text-sm"
              />
            </div>

            <div className="p-4 bg-amber-50 border border-amber-100 rounded-sm flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 font-medium leading-relaxed italic">
                By saving this checklist, you confirm that the verification items have been physically audited at the project site location.
              </p>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/5 border-t p-6 flex justify-end">
            <Button 
              className="min-w-[200px] h-12 rounded-sm font-black text-lg shadow-xl" 
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <><Save className="mr-2 h-5 w-5" /> SAVE CHECKLIST</>}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
