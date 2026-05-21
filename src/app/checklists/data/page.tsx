
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
  User, 
  ClipboardCheck, 
  LayoutGrid, 
  Eye, 
  ChevronRight, 
  ShieldCheck, 
  CheckCircle2, 
  X,
  History,
  ImageIcon,
  Maximize2,
  ArrowLeft,
  Film,
  FileText,
  PlayCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { isSuperAdmin } from '@/lib/auth-constants';
import { ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react';

type Site = { id: string; name: string; projectCompany?: string };

type Attachment = {
  url: string;
  contentType: string;
  name: string;
};

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
  checks: { label: string; remarks: string; attachments?: Attachment[] }[];
  otherRemarks: string;
  otherAttachments?: Attachment[];
  customerRepPresent: boolean;
  customerRepName?: string;
};

export default function ChecklistsDataPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  
  const [selectedSiteId, setSelectedSiteId] = React.useState<string>("all");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");

  const [viewingMms, setViewingMms] = React.useState<MMSChecklist | null>(null);
  const [viewingInstallation, setViewingInstallation] = React.useState<InstallationChecklist | null>(null);
  
  // High-fidelity media viewer state
  const [viewFile, setViewFile] = React.useState<Attachment | null>(null);
  const [viewFiles, setViewFiles] = React.useState<Attachment[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = React.useState(0);
  const [zoom, setZoom] = React.useState(1);
  const viewerRef = React.useRef<HTMLDivElement>(null);

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

  const openViewer = (file: Attachment, gallery: Attachment[]) => {
    const mediaFiles = gallery.filter(a => a.contentType?.startsWith('image/') || a.contentType?.startsWith('video/'));
    const index = mediaFiles.findIndex(a => a.url === file.url);
    setViewFiles(mediaFiles);
    setCurrentFileIndex(index >= 0 ? index : 0);
    setViewFile(file);
    setZoom(1);
  };

  const isVideo = (file: Attachment) => file.contentType?.startsWith('video/');

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

          <Card className="rounded-sm border-primary/10 shadow-md overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-6">Project Name</TableHead>
                    <TableHead className="hidden md:table-cell">Project Company</TableHead>
                    <TableHead className="text-center">MMS Audits</TableHead>
                    <TableHead className="text-center">Inst. Audits</TableHead>
                    <TableHead className="text-right px-6">Total Records</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allSites?.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase())).map(site => {
                    const stats = siteStats[site.id] || { mms: 0, inst: 0 };
                    const total = stats.mms + stats.inst;
                    return (
                      <TableRow 
                        key={site.id} 
                        className="hover:bg-muted/5 cursor-pointer transition-colors group"
                        onClick={() => setSelectedSiteId(site.id)}
                      >
                        <TableCell className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{site.name}</span>
                            <span className="text-[10px] md:hidden uppercase font-black text-muted-foreground">{site.projectCompany}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-[10px] uppercase font-black text-muted-foreground">{site.projectCompany}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="rounded-sm h-6 px-2 text-[10px] font-bold border-primary/10 bg-primary/5 text-primary">
                            {stats.mms}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="rounded-sm h-6 px-2 text-[10px] font-bold border-primary/10 bg-primary/5 text-primary">
                            {stats.inst}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <div className="flex items-center justify-end gap-3 text-xs font-black text-foreground">
                            {total}
                            <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-all group-hover:translate-x-1" />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {allSites?.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase())).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">No projects found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setViewingMms(record)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic text-sm">No MMS audits found.</TableCell></TableRow>
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
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setViewingInstallation(record)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic text-sm">No installation audits found.</TableCell></TableRow>
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
                <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Verification Points Feed
                </Label>
                <div className="flex flex-col gap-6">
                  {viewingInstallation?.checks.map((check, idx) => (
                    <div key={idx} className="flex flex-col gap-4 p-5 border rounded-sm bg-muted/5 group transition-colors hover:border-primary/20">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-black uppercase text-foreground">{check.label}</span>
                          <Badge variant="outline" className="h-3.5 px-1.5 text-[6px] font-black uppercase bg-white border-primary/20 text-primary">Requirement</Badge>
                        </div>
                        <p className="text-xs italic text-muted-foreground leading-relaxed">
                          "{check.remarks || 'No specific observations recorded.'}"
                        </p>
                      </div>
                      
                      {check.attachments && check.attachments.length > 0 ? (
                        <div className="flex flex-wrap gap-3">
                          {check.attachments.map((file, fIdx) => (
                            <div 
                              key={fIdx} 
                              className="relative aspect-video w-32 sm:w-40 rounded-sm overflow-hidden border shadow-sm shrink-0 bg-muted cursor-pointer"
                              onClick={() => openViewer(file, check.attachments!)}
                            >
                              {isVideo(file) ? (
                                <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                                  <Film className="h-8 w-8 text-white opacity-40" />
                                  <PlayCircle className="absolute h-8 w-8 text-white" />
                                </div>
                              ) : (
                                <img src={file.url} className="w-full h-full object-cover" alt={file.name} />
                              )}
                              <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Maximize2 className="h-4 w-4 text-white" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="w-fit px-4 h-8 bg-muted/50 border border-dashed rounded-sm flex items-center justify-center text-[8px] font-bold text-muted-foreground uppercase opacity-40">No Media Evidence</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {viewingInstallation?.otherRemarks && (
                <div className="p-6 bg-primary/5 border rounded-sm space-y-6">
                   <div className="space-y-2">
                      <Label className="text-[9px] font-black uppercase text-primary tracking-widest">Supplementary Observations</Label>
                      <p className="text-sm font-medium leading-relaxed italic text-foreground/80">"{viewingInstallation.otherRemarks}"</p>
                    </div>

                    {viewingInstallation.otherAttachments && viewingInstallation.otherAttachments.length > 0 && (
                       <div className="flex flex-wrap gap-4">
                          {viewingInstallation.otherAttachments.map((file, idx) => (
                            <div 
                              key={idx} 
                              className="relative aspect-video w-32 sm:w-48 rounded-sm overflow-hidden border shadow-lg bg-muted shrink-0 cursor-pointer"
                              onClick={() => openViewer(file, viewingInstallation.otherAttachments!)}
                            >
                              {isVideo(file) ? (
                                <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                                  <Film className="h-10 w-10 text-white opacity-40" />
                                  <PlayCircle className="absolute h-10 w-10 text-white" />
                                </div>
                              ) : (
                                <img src={file.url} className="w-full h-full object-cover" alt="Supplementary" />
                              )}
                              <div className="absolute top-2 right-2 p-1 bg-black/40 rounded-sm">
                                <Maximize2 className="h-3 w-3 text-white" />
                              </div>
                            </div>
                          ))}
                       </div>
                    )}
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 bg-muted/5 border-t"><DialogClose asChild><Button variant="outline" className="rounded-sm font-black uppercase text-[10px] h-11 px-8 w-full sm:w-auto">Close Audit Log</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media Gallery Overlay */}
      <Dialog open={!!viewFile} onOpenChange={(o) => { if(!o) { setZoom(1); setViewFile(null); setViewFiles([]); } }}>
        <DialogContent className="max-w-[95vw] h-[90vh] p-0 border-none bg-black flex flex-col items-center justify-center rounded-sm overflow-hidden shadow-2xl">
          <div className="absolute top-4 left-4 flex gap-2 z-50">
            <Button variant="secondary" size="icon" className="h-10 w-10 rounded-full bg-white/10 text-white border-none" onClick={() => setZoom(prev => Math.min(prev + 0.25, 4))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon" className="h-10 w-10 rounded-full bg-white/10 text-white border-none" onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.5))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon" className="h-10 w-10 rounded-full bg-white/10 text-white border-none" onClick={() => setZoom(1)}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          {viewFiles.length > 1 && (
            <>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50">
                <Button variant="secondary" size="icon" className="h-12 w-12 rounded-full bg-white/10 text-white border-none shadow-2xl" onClick={(e) => { 
                  e.stopPropagation();
                  const prevIdx = (currentFileIndex - 1 + viewFiles.length) % viewFiles.length;
                  setCurrentFileIndex(prevIdx);
                  setViewFile(viewFiles[prevIdx]);
                  setZoom(1);
                }}>
                  <ChevronLeft className="h-8 w-8" />
                </Button>
              </div>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 z-50">
                <Button variant="secondary" size="icon" className="h-12 w-12 rounded-full bg-white/10 text-white border-none shadow-2xl" onClick={(e) => { 
                  e.stopPropagation();
                  const nextIdx = (currentFileIndex + 1) % viewFiles.length;
                  setCurrentFileIndex(nextIdx);
                  setViewFile(viewFiles[nextIdx]);
                  setZoom(1);
                }}>
                  <ChevronRightIcon className="h-8 w-8" />
                </Button>
              </div>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
                <Badge variant="outline" className="bg-black/40 text-white border-none px-3 py-1 rounded-full font-mono text-xs">
                  {currentFileIndex + 1} / {viewFiles.length}
                </Badge>
              </div>
            </>
          )}
          
          <div className="relative w-full h-full overflow-auto p-4 flex">
            <div 
              ref={viewerRef}
              className={cn(
                "m-auto transition-transform duration-200",
                zoom > 1 ? "cursor-move" : "cursor-default"
              )}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
            >
              {viewFile && (
                isVideo(viewFile) ? (
                  <video src={viewFile.url} controls autoPlay className="max-w-full max-h-[85vh] shadow-2xl" />
                ) : (
                  <img src={viewFile.url} className="max-w-full max-h-[85vh] object-contain shadow-2xl" alt="Audit Evidence" />
                )
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
