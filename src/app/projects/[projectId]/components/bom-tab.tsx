'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  Check, 
  ChevronsUpDown, 
  CheckCircle2, 
  XCircle, 
  History, 
  Pencil, 
  Trash2, 
  Layers, 
  ChevronUp, 
  ChevronDown, 
  Loader2,
  FilterX,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { doc, collection, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { useFirestore, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { BoMItem, MasterItem, UserProfile, BoMSortKey } from '../types';
import { formatTimestamp } from '../utils';

interface BoMTabProps {
  projectId: string;
  siteName: string;
  bomItems: BoMItem[] | null;
  masterItems: MasterItem[] | null;
  userProfile: UserProfile | null;
  user: any;
  isAdmin: boolean;
  isManager: boolean;
  canManageBom: boolean;
}

const UNITS = ["Numbers", "Kilograms", "Liters", "Meters", "Sets", "Bundles", "Pairs", "Drums"];

export function BoMTab({
  projectId,
  siteName,
  bomItems,
  masterItems,
  userProfile,
  user,
  isAdmin,
  isManager,
  canManageBom
}: BoMTabProps) {
  const firestore = useFirestore();
  const [bomTableSearch, setBomTableSearch] = React.useState("");
  const [bomStatusFilter, setBomStatusFilter] = React.useState("all");
  const [bomCategoryFilter, setBomCategoryFilter] = React.useState("all");
  const [bomSortConfig, setBomSortConfig] = React.useState<{ key: BoMSortKey; direction: 'asc' | 'desc' }>({ key: 'itemName', direction: 'asc' });
  const [selectedMasterItem, setSelectedMasterItem] = React.useState<MasterItem | null>(null);
  const [isBomItemPopoverOpen, setIsBomItemPopoverOpen] = React.useState(false);
  const [bomItemSearchQuery, setBomItemSearchQuery] = React.useState("");
  const [expandedBomRows, setExpandedBomRows] = React.useState<Set<string>>(new Set());
  const [editingBomItem, setEditingBomItem] = React.useState<BoMItem | null>(null);
  const [isUpdatingBom, setIsUpdatingBom] = React.useState(false);
  const [viewingBomLog, setViewingBomLog] = React.useState<BoMItem | null>(null);
  const [bomActionState, setBomActionState] = React.useState<{ item: BoMItem, type: 'Approved' | 'Rejected' } | null>(null);
  const [isActionProcessing, setIsActionProcessing] = React.useState(false);

  const filteredSortedBomItems = React.useMemo(() => {
    if (!bomItems) return [];
    let result = bomItems.filter(item => {
      const matchesSearch = (item.itemName || "").toLowerCase().includes(bomTableSearch.toLowerCase()) || 
                           (item.specification || "").toLowerCase().includes(bomTableSearch.toLowerCase()) ||
                           (item.category || "").toLowerCase().includes(bomTableSearch.toLowerCase()) ||
                           (item.make || "").toLowerCase().includes(bomTableSearch.toLowerCase());
      const matchesStatus = bomStatusFilter === 'all' || item.status === bomStatusFilter;
      const matchesCategory = bomCategoryFilter === 'all' || item.category === bomCategoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
    result.sort((a, b) => {
      const { key, direction } = bomSortConfig;
      let valA: any = a[key as keyof BoMItem] ?? '';
      let valB: any = b[key as keyof BoMItem] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [bomItems, bomTableSearch, bomStatusFilter, bomCategoryFilter, bomSortConfig]);

  const handleAddBoM = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const itemName = formData.get('itemName') as string;
    if (!itemName || !selectedMasterItem) return;
    const logEntry = { action: 'Created', userName: userProfile?.username || user?.email || 'Unknown', timestamp: new Date(), details: 'Initial BoM entry submission.' };
    addDocumentNonBlocking(collection(firestore, 'project_boms'), {
      siteId: projectId, siteName, make: selectedMasterItem.make || "Standard",
      itemName: selectedMasterItem.name || itemName, category: selectedMasterItem.category,
      specification: selectedMasterItem.description || "", plannedQuantity: parseFloat(formData.get('qty') as string),
      unit: selectedMasterItem.unit, subItems: selectedMasterItem.subItems || [], status: 'Pending',
      createdAt: serverTimestamp(), auditLog: [logEntry]
    });
    setSelectedMasterItem(null);
    (e.target as HTMLFormElement).reset();
  };

  const handleUpdateBoM = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingBomItem) return;
    setIsUpdatingBom(true);
    const formData = new FormData(e.currentTarget);
    const newName = formData.get('itemName') as string;
    const newQty = parseFloat(formData.get('plannedQty') as string);
    const logEntry = { action: 'Modified', userName: userProfile?.username || user?.email || 'Unknown', timestamp: new Date(), details: `Entry modified. Returned to Pending.` };
    updateDocumentNonBlocking(doc(firestore, 'project_boms', editingBomItem.id), {
      itemName: newName, specification: formData.get('specification') as string,
      plannedQuantity: newQty, unit: formData.get('unit') as string, status: 'Pending',
      updatedAt: serverTimestamp(), auditLog: arrayUnion(logEntry)
    });
    setEditingBomItem(null);
    setIsUpdatingBom(false);
  };

  const handleProcessBoM = (remarks: string, approvedQty?: number) => {
    if (!bomActionState) return;
    setIsActionProcessing(true);
    const logEntry = {
      action: bomActionState.type === 'Approved' ? 'Authorized' : 'Rejected',
      userName: userProfile?.username || user?.email || 'Admin',
      timestamp: new Date(),
      details: remarks ? `Remarks: ${remarks}${approvedQty ? ` (Qty Set: ${approvedQty})` : ''}` : 'Processed.'
    };
    updateDocumentNonBlocking(doc(firestore, 'project_boms', bomActionState.item.id), {
      status: bomActionState.type, remarks, approvedQuantity: approvedQty ?? null,
      processedByName: userProfile?.username || user?.email || 'Admin',
      processedAt: serverTimestamp(), updatedAt: serverTimestamp(), auditLog: arrayUnion(logEntry)
    });
    setIsActionProcessing(false);
    setBomActionState(null);
  };

  const BoMSortIcon = ({ column }: { column: BoMSortKey }) => {
    if (bomSortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return bomSortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3 text-primary" /> : <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  return (
    <div className="space-y-8 mt-6 animate-in fade-in duration-300 text-left">
      {canManageBom && (
        <Card className="rounded-sm border-primary/10 bg-primary/5 shadow-sm">
          <CardHeader className="py-2 border-b bg-muted/10">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Add BoM Entry</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-4">
            <form onSubmit={handleAddBoM} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">Material Item</Label>
                  <Popover open={isBomItemPopoverOpen} onOpenChange={setIsBomItemPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal h-9 rounded-sm bg-background border-primary/10", !selectedMasterItem && "text-muted-foreground")}>
                        <span className="truncate">{selectedMasterItem ? selectedMasterItem.name : "Choose material..."}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <div className="flex items-center border-b px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Input placeholder="Filter items..." className="h-9 w-full border-none focus-visible:ring-0 px-0 text-sm" value={bomItemSearchQuery} onChange={(e) => setBomItemSearchQuery(e.target.value)} />
                      </div>
                      <ScrollArea className="h-[200px]">
                        <div className="p-1">
                          {masterItems?.filter(i => i.name.toLowerCase().includes(bomItemSearchQuery.toLowerCase())).map((item) => (
                            <Button key={item.id} type="button" variant="ghost" className="w-full justify-start text-left font-normal h-11 text-xs mb-0.5" onClick={() => { setSelectedMasterItem(item); setIsBomItemPopoverOpen(false); }}>
                              <div className="flex flex-col items-start min-w-0 text-left">
                                <span className="font-bold truncate w-full text-foreground">{item.name}</span>
                                <span className="text-[8px] uppercase text-muted-foreground">{item.make} • {item.category}</span>
                              </div>
                            </Button>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                  <input type="hidden" name="itemName" value={selectedMasterItem?.name || ""} />
                </div>
                <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">Required Qty & Unit</Label><div className="flex gap-1.5"><Input name="qty" type="number" required placeholder="0" className="h-9 rounded-sm bg-background border-primary/20 text-[10px] font-bold" /><Input readOnly value={selectedMasterItem?.unit || ""} className="w-20 h-9 rounded-sm bg-muted/10 border-primary/10 font-bold text-primary cursor-not-allowed text-[10px]" /></div></div>
                <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">Category (Auto)</Label><Input readOnly value={selectedMasterItem?.category || ""} className="h-9 rounded-sm bg-muted/10 border-primary/10 cursor-not-allowed font-bold text-primary text-[10px]" /></div>
              </div>
              <div className="flex flex-col md:flex-row gap-4 items-start">
                <div className="flex-1 min-w-0 space-y-1.5 w-full">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">Breakdown Preview</Label>
                  <div className="h-20 p-3 rounded-sm bg-muted/10 border border-primary/5 overflow-auto shadow-inner">
                    {selectedMasterItem ? (
                      <div className="space-y-2">
                        {selectedMasterItem.unit === 'Sets' && selectedMasterItem.subItems && selectedMasterItem.subItems.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-left">
                            {selectedMasterItem.subItems.map((sub, idx) => (<div key={idx} className="flex items-center justify-between text-[10px] font-medium border-b border-border/20 pb-0.5"><span className="truncate mr-2">{sub.name}</span><span className="font-bold text-primary shrink-0">{sub.quantityPerSet} {sub.unit}</span></div>))}
                          </div>
                        ) : <p className="text-[11px] italic text-muted-foreground leading-relaxed">"{selectedMasterItem.description || 'No additional specifications provided.'}"</p>}
                      </div>
                    ) : <p className="text-[10px] text-muted-foreground/40 italic flex items-center justify-center h-full">Selection preview will appear here...</p>}
                  </div>
                </div>
                <Button type="submit" className="h-20 md:w-32 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-md mt-auto w-full" disabled={!selectedMasterItem}>Add to BoM</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
        <div className="relative w-full md:w-80"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search materials, make or specs..." className="pl-8 h-9 rounded-sm border-primary/20 text-xs" value={bomTableSearch} onChange={e => setBomTableSearch(e.target.value)} /></div>
        <div className="flex items-center gap-2">
          <Select value={bomStatusFilter} onValueChange={setBomStatusFilter}><SelectTrigger className="w-[140px] h-9 text-[10px] font-bold uppercase rounded-sm border-primary/20"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all" className="text-[10px] font-bold uppercase">All Status</SelectItem><SelectItem value="Pending" className="text-[10px] font-bold uppercase text-amber-600">Pending</SelectItem><SelectItem value="Approved" className="text-[10px] font-bold uppercase text-green-600">Approved</SelectItem><SelectItem value="Rejected" className="text-[10px] font-bold uppercase text-red-600">Rejected</SelectItem></SelectContent></Select>
          <Button variant="ghost" size="icon" onClick={() => { setBomTableSearch(""); setBomStatusFilter("all"); setBomCategoryFilter("all"); }} className="h-9 w-9 text-muted-foreground"><FilterX className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => setBomSortConfig({key: 'itemName', direction: bomSortConfig.direction === 'asc' ? 'desc' : 'asc'})}><div className="flex items-center">Description <BoMSortIcon column="itemName" /></div></TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Make</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Required Qty</TableHead>
                  <TableHead className="text-center">Approved Qty</TableHead>
                  <TableHead className="text-right px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSortedBomItems.length > 0 ? filteredSortedBomItems.map(item => (
                  <React.Fragment key={item.id}>
                    <TableRow className="hover:bg-muted/5 transition-colors group">
                      <TableCell className="px-6 py-4"><div className="flex items-center gap-2">{item.unit === 'Sets' && (<Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => { const n = new Set(expandedBomRows); if(n.has(item.id)) n.delete(item.id); else n.add(item.id); setExpandedBomRows(n); }}>{expandedBomRows.has(item.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button>)}<div className="flex flex-col min-w-0 text-left"><span className="font-bold text-sm text-foreground">{item.itemName}</span><span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{item.specification}</span></div></div></TableCell>
                      <TableCell><Badge variant="secondary" className="rounded-sm font-bold text-[9px] uppercase tracking-wider">{item.category}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className="rounded-sm font-black text-[9px] uppercase border-primary/10 text-primary/70">{item.make}</Badge></TableCell>
                      <TableCell><div className="flex flex-col gap-1"><Badge variant="outline" className={cn("w-fit rounded-sm text-[9px] font-black uppercase px-1.5 h-5", item.status === 'Approved' ? "bg-green-50 text-green-700 border-green-200" : item.status === 'Rejected' ? "bg-red-50 text-red-700 border-red-200" : "bg-yellow-50 text-yellow-700 border-yellow-200")}>{item.status || 'Pending'}</Badge></div></TableCell>
                      <TableCell className="text-center"><div className="font-mono font-bold text-sm text-primary">{item.plannedQuantity}</div><div className="text-[10px] text-muted-foreground uppercase font-medium">{item.unit}</div></TableCell>
                      <TableCell className="text-center">{item.status === 'Approved' ? (<><div className="font-mono font-bold text-sm text-emerald-700">{item.approvedQuantity || item.plannedQuantity}</div><div className="text-[10px] text-emerald-600 uppercase font-medium">{item.unit}</div></>) : <span className="text-[10px] text-muted-foreground/40 italic uppercase font-bold">—</span>}</TableCell>
                      <TableCell className="text-right px-6"><div className="flex justify-end items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground rounded-sm" onClick={() => setViewingBomLog(item)}><History className="h-4 w-4" /></Button>
                        {canManageBom && (<Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm hover:bg-primary/10" onClick={() => setEditingBomItem(item)}><Pencil className="h-4 w-4" /></Button>)}
                        {isAdmin && item.status === 'Pending' && (<><Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 rounded-sm hover:bg-green-50" onClick={() => setBomActionState({ item, type: 'Approved' })}><CheckCircle2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 rounded-sm hover:bg-red-50" onClick={() => setBomActionState({ item, type: 'Rejected' })}><XCircle className="h-4 w-4" /></Button></>)}
                        {(isAdmin || (canManageBom && item.status === 'Pending')) && (<Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'project_boms', item.id))}><Trash2 className="h-4 w-4" /></Button>)}
                      </div></TableCell>
                    </TableRow>
                  </React.Fragment>
                )) : <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic text-xs">Registry empty.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!bomActionState} onOpenChange={(o) => !o && setBomActionState(null)}>
        <DialogContent className="rounded-sm max-md">
          <DialogHeader><DialogTitle>Authorize BoM Item</DialogTitle></DialogHeader>
          <div className="py-6 space-y-4 text-left">
            <Label className="text-xs font-bold">Planned Qty: {bomActionState?.item.plannedQuantity} {bomActionState?.item.unit}</Label>
            {bomActionState?.type === 'Approved' && (<div className="space-y-2 pt-2"><Label>Final Approved Quantity</Label><Input type="number" defaultValue={bomActionState.item.plannedQuantity} id="approved-qty" /></div>)}
            <Label className="text-xs font-bold pt-2 block">Remarks</Label>
            <Textarea id="action-remarks" placeholder="Provide reason..." className="min-h-[120px] rounded-sm" />
          </div>
          <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button className={cn("min-w-[120px]", bomActionState?.type === 'Approved' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700")} disabled={isActionProcessing} onClick={() => handleProcessBoM((document.getElementById('action-remarks') as HTMLTextAreaElement)?.value || "", bomActionState?.type === 'Approved' ? parseFloat((document.getElementById('approved-qty') as HTMLInputElement)?.value || "0") : undefined)}>{isActionProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : `Confirm ${bomActionState?.type}`}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingBomItem} onOpenChange={(o) => !o && setEditingBomItem(null)}>
        <DialogContent className="rounded-sm max-lg w-full text-left">
          <DialogHeader><DialogTitle>Edit BoM Entry</DialogTitle></DialogHeader>
          {editingBomItem && (
            <form onSubmit={handleUpdateBoM} className="space-y-4 py-4 text-left">
              <div className="grid gap-2 text-left"><Label>Item Name</Label><Input name="itemName" defaultValue={editingBomItem.itemName} /></div>
              <div className="grid grid-cols-2 gap-4"><div className="grid gap-2 text-left"><Label>Planned Qty</Label><Input name="plannedQty" type="number" defaultValue={editingBomItem.plannedQuantity} /></div><div className="grid gap-2 text-left"><Label>Unit</Label><Select name="unit" defaultValue={editingBomItem.unit}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div></div>
              <div className="grid gap-2 text-left"><Label>Specification</Label><Textarea name="specification" defaultValue={editingBomItem.specification} /></div>
              <DialogFooter className="pt-4"><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={isUpdatingBom}>{isUpdatingBom ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : 'Update'}</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingBomLog} onOpenChange={(o) => !o && setViewingBomLog(null)}>
        <DialogContent className="rounded-sm max-w-lg">
          <DialogHeader className="text-left"><DialogTitle>BoM Life-cycle Log</DialogTitle></DialogHeader>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-6 relative border-l-2 border-muted ml-3 pl-6 py-2">
              {viewingBomLog?.auditLog?.map((entry, idx) => (<div key={idx} className="relative"><div className="absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" /><div className="flex flex-col gap-1 text-left"><span className="text-xs font-bold text-primary uppercase">{entry.action} — {entry.userName}</span><p className="text-[10px] text-muted-foreground font-mono">{formatTimestamp(entry.timestamp)}</p><p className="text-xs italic leading-relaxed text-foreground/80 mt-1">"{entry.details}"</p></div></div>))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
