'use client';

import * as React from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, orderBy, doc, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Search, 
  FilterX, 
  Building2, 
  Calendar, 
  User, 
  ClipboardCheck, 
  LayoutGrid, 
  Eye, 
  ChevronRight, 
  ShieldCheck, 
  CheckCircle2, 
  X,
  Building,
  History,
  ImageIcon,
  Maximize2,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { isSuperAdmin } from '@/lib/auth-constants';

type Site = { id: string; name: string; projectCompany?: string };

type MMSChecklist = {
  id: string;
  siteId: string;
  siteName: string;
  tableName: string;
  userName: string;
  createdAt: any;
  components: { name: string; requiredQty: number; installedQty: string; unit: string }[];
  generalRemarks: string;
};

type InstallationChecklist = {
  id: string;
  siteId: string;
  siteName: string;
  tableNumber: string;
  userName: string;
  createdAt: any;
  checks: { label: string; remarks: string; photoUrl: string | null }[];
  otherRemarks: string;
  otherPhotoUrl?: string;
  customerRepPresent: boolean;
  customerRepName?: string;
};

export default function ChecklistsDataPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  
  const [selectedSiteId, setSelectedSiteId] = React.useState<string>("all");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");

  const [viewingMms, setViewingMms] = React.useState<MMSChecklist | null>(null);
  const [viewingInstallation, setViewingInstallation] = React.useState<InstallationChecklist | null>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const mmsQuery = useMemoFirebase(() => {
    const q = query(collection(firestore, 'mms_checklists'), orderBy('createdAt', 'desc'), limit(1000));
    return q;
  }, [firestore]);
  const { data: mmsRecords, isLoading: mmsLoading } = useCollection<MMSChecklist>(mmsQuery);

  const instQuery = useMemoFirebase(() => {
    const q = query(collection(firestore, 'installation_checklists'), orderBy('createdAt', 'desc'), limit(1000));
    return q;
  }, [firestore]);
  const { data: instRecords, isLoading: instLoading } = useCollection<InstallationChecklist>(instQuery);

  const filteredMms = React.useMemo(() => {
    if (!mmsRecords) return [];
    return mmsRecords.filter(r => {
      const matchesSite = selectedSiteId === 'all' || r.siteId === selectedSiteId;
      const matchesSearch = r.siteName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           r.tableName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           r.userName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSite && matchesSearch;
    });
  }, [mmsRecords, selectedSiteId, searchTerm]);

  const filteredInst = React.useMemo(() => {
    if (!instRecords) return [];
    return instRecords.filter(r => {
      const matchesSite = selectedSiteId === 'all' || r.siteId === selectedSiteId;
      const matchesSearch = r.siteName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           r.tableNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           r.userName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSite && matchesSearch;
    });
  }, [instRecords, selectedSiteId, searchTerm]);

  const siteStats = React.useMemo(() => {
    const stats: Record<string, { mms: number, inst: number }> = {};
    mmsRecords?.forEach(r => {
      if (!stats[r.siteId]) stats[r.siteId] = { mms: 0, inst: 0 };
      stats[r.siteId].mms++;
    });
    instRecords?.forEach(r => {
      if (!stats[r.siteId]) stats[r.siteId] = { mms: 0, inst: 0 };
      stats[r.siteId].inst++;
    });
    return stats;
  }, [mmsRecords, instRecords]);

  if (isProfileLoading || mmsLoading || instLoading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;
  }

  const selectedSiteObj = allSites?.find(s => s.id === selectedSiteId);

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
          <ClipboardCheck className="h-8 w-8" /> Checklist Registry
        </h1>
        <p className="text-muted-foreground font-medium">Project-wise quality audit and verification logs.</p>
      </div>

      {selectedSiteId === 'all' ? (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search projects..." 
                className="pl-10 h-11 rounded-sm bg-background border-primary/10 text-sm"
                value={siteSearchQuery}
                onChange={e => setSiteSearchQuery(e.target.value)}
              />
            </div>
            <Badge variant="secondary" className="rounded-sm font-black uppercase text-[10px] tracking-widest px-3 h-8 border-none">
              {allSites?.length || 0} Sites Registered
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allSites?.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase())).map(site => {
              const stats = siteStats[site.id] || { mms: 0, inst: 0 };
              const total = stats.mms + stats.inst;

              return (
                <Card 
                  key={site.id} 
                  className="hover:shadow-md transition-all cursor-pointer group border-primary/10 rounded-sm overflow-hidden h-full flex flex-col"
                  onClick={() => setSelectedSiteId(site.id)}
                >
                  <CardHeader className="bg-primary/5 py-4 border-b flex flex-row items-start justify-between space-y-0">
                    <div className="space-y-1 min-w-0">
                      <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors truncate pr-2" title={site.name}>
                        {site.name}
                      </CardTitle>
                      {site.projectCompany && (
                        <CardDescription className="text-[10px] uppercase font-black text-muted-foreground truncate">{site.projectCompany}</CardDescription>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0 shrink-0" />
                  </CardHeader>
                  <CardContent className="pt-4 flex-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-2.5 bg-muted/20 rounded-sm border border-primary/5 flex flex-col gap-0.5">
                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">MMS Audits</span>
                        <span className="text-base font-black text-primary">{stats.mms}</span>
                      </div>
                      <div className="p-2.5 bg-muted/20 rounded-sm border border-primary/5 flex flex-col gap-0.5">
                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">Inst. Audits</span>
                        <span className="text-base font-black text-primary">{stats.inst}</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-muted/5 border-t p-3">
                    <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest flex items-center gap-1.5">
                      <History className="h-3 w-3" /> Total Records: {total}
                    </p>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setSelectedSiteId('all'); setSearchTerm(""); }} 
                className="h-7 mb-1 -ml-2 text-muted-foreground hover:text-primary"
              >
                <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Back to Project List
              </Button>
              <h2 className="text-2xl font-black text-foreground uppercase tracking-tight flex items-center gap-3">
                <Building2 className="h-6 w-6 text-primary" />
                {selectedSiteObj?.name}
              </h2>
              <p className="text-muted-foreground text-xs font-bold uppercase tracking-[0.2em]">{selectedSiteObj?.projectCompany}</p>
            </div>
            
            <div className="flex items-center gap-3">
               <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search site specific audits..." 
                    className="pl-9 h-9 rounded-sm bg-background border-primary/10 text-xs"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
               </div>
               <Button variant="ghost" size="icon" onClick={() => setSearchTerm("")} className="h-9 w-9 text-muted-foreground">
                  <FilterX className="h-4 w-4" />
               </Button>
            </div>
          </div>

          <Tabs defaultValue="mms" className="w-full">
            <TabsList className="bg-muted/50 border border-primary/10 rounded-sm p-1 h-12 max-w-md mb-6">
              <TabsTrigger value="mms" className="rounded-sm font-bold text-[10px] uppercase tracking-widest h-10 px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shadow-sm flex items-center gap-2">
                <LayoutGrid className="h-3.5 w-3.5" /> Table Level MMS
              </TabsTrigger>
              <TabsTrigger value="inst" className="rounded-sm font-bold text-[10px] uppercase tracking-widest h-10 px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shadow-sm flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5" /> Module Installation
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mms" className="animate-in fade-in slide-in-from-top-2 duration-300">
              <Card className="rounded-sm border-primary/10 shadow-md overflow-hidden">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="px-6">Date & Time</TableHead>
                        <TableHead>Table Ref</TableHead>
                        <TableHead>Personnel</TableHead>
                        <TableHead className="text-right px-6">Review</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMms.length > 0 ? filteredMms.map((record) => (
                        <TableRow key={record.id} className="hover:bg-muted/5 transition-colors group">
                          <TableCell className="px-6 py-4 font-mono text-[10px] font-bold text-muted-foreground">
                            {record.createdAt ? format(record.createdAt.toDate(), 'dd MMM yy HH:mm') : '—'}
                          </TableCell>
                          <TableCell><Badge variant="secondary" className="rounded-sm font-black text-[10px] uppercase bg-primary/5 text-primary border-primary/10">{record.tableName}</Badge></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-xs font-medium">
                              <User className="h-3 w-3 text-primary opacity-50" />
                              {record.userName}
                            </div>
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setViewingMms(record)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic text-sm">No MMS audits found for this project.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="inst" className="animate-in fade-in slide-in-from-top-2 duration-300">
              <Card className="rounded-sm border-primary/10 shadow-md overflow-hidden">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="px-6">Date & Time</TableHead>
                        <TableHead>Table Ref</TableHead>
                        <TableHead>Personnel</TableHead>
                        <TableHead className="text-right px-6">Review</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInst.length > 0 ? filteredInst.map((record) => (
                        <TableRow key={record.id} className="hover:bg-muted/5 transition-colors group">
                          <TableCell className="px-6 py-4 font-mono text-[10px] font-bold text-muted-foreground">
                            {record.createdAt ? format(record.createdAt.toDate(), 'dd MMM yy HH:mm') : '—'}
                          </TableCell>
                          <TableCell><Badge variant="secondary" className="rounded-sm font-black text-[10px] uppercase bg-primary/5 text-primary border-primary/10">{record.tableNumber}</Badge></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-xs font-medium">
                              <User className="h-3 w-3 text-primary opacity-50" />
                              {record.userName}
                            </div>
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setViewingInstallation(record)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic text-sm">No installation audits found for this project.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Detail Dialogs */}
      <Dialog open={!!viewingMms} onOpenChange={(o) => !o && setViewingMms(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden border-none rounded-sm shadow-2xl bg-background flex flex-col">
          <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-sm"><LayoutGrid className="h-5 w-5 text-primary" /></div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">MMS Audit Details</DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{viewingMms?.siteName} • {viewingMms?.tableName}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] p-8 space-y-8">
            <div className="grid grid-cols-2 gap-8 text-left">
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Auditor</Label><p className="text-sm font-bold">{viewingMms?.userName}</p></div>
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Date Published</Label><p className="text-sm font-bold">{viewingMms?.createdAt ? format(viewingMms.createdAt.toDate(), 'dd MMMM yyyy, HH:mm') : '—'}</p></div>
            </div>
            
            <Separator />

            <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Verified Component Quantities</Label>
              <div className="border rounded-sm overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="text-[9px] font-black uppercase px-4">Component</TableHead>
                      <TableHead className="text-center text-[9px] font-black uppercase">Req. Qty</TableHead>
                      <TableHead className="text-right text-[9px] font-black uppercase px-4">Inst. Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingMms?.components.map((comp, idx) => (
                      <TableRow key={idx} className="bg-background">
                        <TableCell className="px-4 font-bold text-xs">{comp.name}</TableCell>
                        <TableCell className="text-center font-mono text-xs opacity-60">{comp.requiredQty} {comp.unit}</TableCell>
                        <TableCell className="text-right px-4 font-mono font-black text-xs text-primary">{comp.installedQty} {comp.unit}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="p-4 bg-muted/20 border rounded-sm">
              <Label className="text-[10px] font-black uppercase text-muted-foreground block mb-2 tracking-widest">Auditor Remarks</Label>
              <p className="text-xs font-medium italic leading-relaxed">"{viewingMms?.generalRemarks || 'No additional remarks provided.'}"</p>
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 bg-muted/5 border-t"><DialogClose asChild><Button variant="outline" className="rounded-sm font-black uppercase text-[10px] h-10 px-8 w-full sm:w-auto">Close Registry</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingInstallation} onOpenChange={(o) => !o && setViewingInstallation(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-none rounded-sm shadow-2xl bg-background flex flex-col h-[90vh]">
          <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-sm"><ShieldCheck className="h-5 w-5 text-primary" /></div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Installation Audit Summary</DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{viewingInstallation?.siteName} • Table {viewingInstallation?.tableNumber}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="p-8 space-y-10 text-left">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground">Personnel</Label><p className="text-xs font-bold">{viewingInstallation?.userName}</p></div>
                <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground">Status</Label><div><Badge className="bg-green-600 text-white font-black uppercase text-[8px] border-none px-2 h-5">Verified</Badge></div></div>
                <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground">Customer Present</Label><p className="text-xs font-bold">{viewingInstallation?.customerRepPresent ? `Yes (${viewingInstallation.customerRepName})` : 'No'}</p></div>
                <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground">Timestamp</Label><p className="text-xs font-mono font-bold">{viewingInstallation?.createdAt ? format(viewingInstallation.createdAt.toDate(), 'dd MMM yy, HH:mm') : '—'}</p></div>
              </div>

              <Separator />

              <div className="space-y-6">
                <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Verification Points Proof</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {viewingInstallation?.checks.map((check, idx) => (
                    <div key={idx} className="space-y-3 p-4 border rounded-sm bg-muted/5 group">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-11 font-black uppercase text-foreground">{check.label}</span>
                        <Badge variant="outline" className="h-4 px-1.5 text-[7px] font-black uppercase bg-white border-primary/20 text-primary">Requirement</Badge>
                      </div>
                      <div className="flex gap-4">
                        {check.photoUrl ? (
                          <div className="relative aspect-video w-32 rounded-sm overflow-hidden border shadow-sm shrink-0 bg-muted">
                            <img src={check.photoUrl} className="w-full h-full object-cover" alt={check.label} />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Maximize2 className="h-4 w-4 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-32 aspect-video bg-muted/50 border border-dashed rounded-sm flex items-center justify-center text-[8px] font-bold text-muted-foreground uppercase opacity-40 shrink-0">No Photo</div>
                        )}
                        <p className="text-xs italic text-muted-foreground leading-relaxed">"{check.remarks || 'No specific observations recorded.'}"</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {viewingInstallation?.otherRemarks && (
                <div className="p-6 bg-primary/5 border rounded-sm space-y-4">
                  <div className="flex flex-col md:flex-row gap-8">
                    {viewingInstallation.otherPhotoUrl && (
                      <div className="w-full md:w-64 aspect-video rounded-sm overflow-hidden border shadow-lg bg-muted shrink-0">
                        <img src={viewingInstallation.otherPhotoUrl} className="w-full h-full object-cover" alt="Supplementary Proof" />
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <Label className="text-[9px] font-black uppercase text-primary tracking-widest">Supplementary Observations</Label>
                      <p className="text-sm font-medium leading-relaxed italic text-foreground/80">"{viewingInstallation.otherRemarks}"</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 bg-muted/5 border-t"><DialogClose asChild><Button variant="outline" className="rounded-sm font-black uppercase text-[10px] h-11 px-8 w-full sm:w-auto">Close Audit Log</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
