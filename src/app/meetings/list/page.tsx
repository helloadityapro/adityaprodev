'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, limit, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  NotebookPen, 
  Search, 
  FilterX, 
  Building2, 
  User, 
  Clock, 
  Calendar, 
  Volume2, 
  ChevronRight, 
  Trash2, 
  Eye, 
  History,
  ShieldAlert,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MessageCircle,
  Activity,
  Plus,
  Check,
  Users,
  LayoutGrid
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { isSuperAdmin } from '@/lib/auth-constants';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

type Meeting = {
  id: string;
  siteId: string;
  siteName: string;
  date: string;
  recordingUrl?: string;
  observations: Record<string, string>;
  customPoints?: { id: string, label: string, value: string }[];
  attendees?: { id: string, name: string }[];
  criticalPoints: string;
  userId: string;
  userName: string;
  createdAt: any;
};

type SortKey = 'date' | 'site' | 'personnel';

const REVIEW_POINTS = [
  { id: 'mms_civil', label: 'MMS Civil-work', category: 'MMS & MODULES INSTALLATION' },
  { id: 'mms_install', label: 'MMS Installation', category: 'MMS & MODULES INSTALLATION' },
  { id: 'module_install', label: 'Modules Installation', category: 'MMS & MODULES INSTALLATION' },
  { id: 'earthing_laying', label: 'Laying & Termination', category: 'EARTHING' },
  { id: 'dc_block_laying', label: 'Trenches, Laying & Termination', category: 'DC BLOCK' },
  { id: 'ac_block_laying', label: 'Trenches, Laying & Termination', category: 'AC BLOCK' },
  { id: 'inverter_install', label: 'Frame erection, Installation and Termination', category: 'INVERTERS' },
  
  // CIVIL WORKS
  { id: 'control_room_civil', label: 'Control Room', category: 'CIVIL WORKS' },
  { id: 'lt_foundation_civil', label: 'LT Panel Foundation', category: 'CIVIL WORKS' },
  { id: 'idt_foundation_civil', label: 'IDT Foundation', category: 'CIVIL WORKS' },
  { id: 'ht_four_pole_civil', label: 'HT Panel Four-Pole Erection', category: 'CIVIL WORKS' },
  { id: 'switchyard_civil', label: 'Switch-yard Civil Work', category: 'CIVIL WORKS' },

  // EQUIPMENT INSTALLATION
  { id: 'lt_panel_install', label: 'LT Panel', category: 'EQUIPMENT INSTALLATION' },
  { id: 'ht_panel_install', label: 'HT Panel', category: 'EQUIPMENT INSTALLATION' },
  { id: 'idt_install', label: 'IDT', category: 'EQUIPMENT INSTALLATION' },
  { id: 'rtcc_install', label: 'RTCC', category: 'EQUIPMENT INSTALLATION' },
  { id: 'scada_install', label: 'SCADA', category: 'EQUIPMENT INSTALLATION' },
  { id: 'rms_wms_install', label: 'RMS/WMS', category: 'EQUIPMENT INSTALLATION' },

  // TRANSMISSION LINE WORKS
  { id: 'poles_erection_tl', label: 'Poles Erection', category: 'Transmission Line Works' },
  { id: 'cable_stringing_tl', label: 'Cable Stringing', category: 'Transmission Line Works' },

  // SUB-STATION WORKS
  { id: 'equip_foundation_ss', label: 'Equipment Foundation', category: 'Sub-Station Works' },
  { id: 'bay_erection_ss', label: 'Bay Erection', category: 'Sub-Station Works' },
  { id: 'ht_panel_install_ss', label: 'HT Panel Installation', category: 'Sub-Station Works' },

  { id: 'others', label: 'Others', category: 'OTHERS' },
];

const CATEGORIES = [
  "MMS & MODULES INSTALLATION",
  "EARTHING",
  "DC BLOCK",
  "AC BLOCK",
  "INVERTERS",
  "CIVIL WORKS",
  "EQUIPMENT INSTALLATION",
  "Transmission Line Works",
  "Sub-Station Works",
  "OTHERS"
];

export default function MeetingsListPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [viewingMeeting, setViewingMeeting] = React.useState<Meeting | null>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);
  
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const meetingsQuery = useMemoFirebase(() => {
    if (!user || isProfileLoading) return null;
    const colRef = collection(firestore, 'meetings');
    if (isAdmin || isManager) return query(colRef, orderBy('createdAt', 'desc'), limit(500));
    return query(colRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(200));
  }, [firestore, isAdmin, isManager, user, isProfileLoading]);

  const { data: meetings, isLoading: isMeetingsLoading } = useCollection<Meeting>(meetingsQuery);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3 text-primary" /> : <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  const filteredMeetings = React.useMemo(() => {
    if (!meetings) return [];
    let result = meetings.filter(m => 
      m.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.criticalPoints.toLowerCase().includes(searchTerm.toLowerCase())
    );

    result.sort((a, b) => {
      const { key, direction } = sortConfig;
      let valA: any = ''; let valB: any = '';
      if (key === 'date') { valA = a.createdAt?.toDate?.()?.getTime() || 0; valB = b.createdAt?.toDate?.()?.getTime() || 0; }
      else if (key === 'site') { valA = a.siteName.toLowerCase(); valB = b.siteName.toLowerCase(); }
      else if (key === 'personnel') { valA = a.userName.toLowerCase(); valB = b.userName.toLowerCase(); }
      
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [meetings, searchTerm, sortConfig]);

  const handleDelete = (id: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'meetings', id));
  };

  if (isProfileLoading || isMeetingsLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-1">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="flex items-center gap-2 text-primary font-black uppercase tracking-tight">
              <NotebookPen className="h-8 w-8" /> Meetings Registry
            </h1>
            <p className="text-muted-foreground font-medium">Archived on-site review meetings and technical discussions.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="h-11 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-md px-6">
              <Link href="/meetings/matrix"><LayoutGrid className="mr-2 h-4 w-4" /> Matrix View</Link>
            </Button>
            <Button asChild className="h-11 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-md px-8">
              <Link href="/meetings/start"><Plus className="mr-2 h-4 w-4" /> Start New Meeting</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm no-print">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search site, personnel or findings..." 
            className="pl-10 h-10 text-sm rounded-sm border-primary/20 bg-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-sm font-black uppercase text-[10px] tracking-widest px-3 h-10 border-primary/20 text-primary bg-primary/5">
            {filteredMeetings.length} Records Indexed
          </Badge>
          <Button variant="ghost" size="icon" onClick={() => setSearchTerm("")} className="h-10 w-10 text-muted-foreground rounded-sm">
            <FilterX className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-4">
        {filteredMeetings.length > 0 ? filteredMeetings.map((m) => (
          <Card key={m.id} className="border-primary/10 rounded-sm shadow-sm overflow-hidden" onClick={() => setViewingMeeting(m)}>
            <CardContent className="p-4 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono font-black text-primary uppercase">{m.date}</span>
                  <h3 className="font-bold text-sm leading-tight text-foreground">{m.siteName}</h3>
                </div>
                {m.recordingUrl && <Badge variant="secondary" className="h-5 px-1.5 bg-primary/10 text-primary border-none"><Volume2 className="h-3 w-3" /></Badge>}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                  <User className="h-3.5 w-3.5 text-primary/40" /> {m.userName}
                </div>
                <div className="p-2 bg-red-50/50 border border-red-100 rounded-sm text-[10px] text-red-900 font-medium italic line-clamp-2">
                  "{m.criticalPoints || 'No critical points logged.'}"
                </div>
              </div>
              <div className="pt-2 border-t border-primary/5 flex justify-end gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm"><Eye className="h-4 w-4" /></Button>
                {(isAdmin || m.userId === user?.uid) && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}><Trash2 className="h-4 w-4" /> </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )) : (
          <div className="p-12 text-center text-muted-foreground italic border-2 border-dashed rounded-sm opacity-30 uppercase font-black text-[10px] tracking-widest">No meeting records discovered</div>
        )}
      </div>

      {/* Desktop View */}
      <div className="hidden md:block">
        <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('date')}>
                    <div className="flex items-center">Date & Time <SortIcon column="date" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('site')}>
                    <div className="flex items-center">Project Site <SortIcon column="site" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('personnel')}>
                    <div className="flex items-center">Personnel <SortIcon column="personnel" /></div>
                  </TableHead>
                  <TableHead>Critical Observations</TableHead>
                  <TableHead className="text-center">Audio</TableHead>
                  <TableHead className="text-right px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMeetings.map((m) => (
                  <TableRow key={m.id} className="hover:bg-muted/5 transition-colors group cursor-pointer" onClick={() => setViewingMeeting(m)}>
                    <TableCell className="px-6 py-4 font-mono text-[10px] font-bold text-muted-foreground uppercase">{m.date}</TableCell>
                    <TableCell><div className="flex items-center gap-2 font-bold text-sm text-foreground"><Building2 className="h-3.5 w-3.5 text-primary opacity-40" />{m.siteName}</div></TableCell>
                    <TableCell><div className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><User className="h-3.5 w-3.5 text-primary opacity-40" />{m.userName}</div></TableCell>
                    <TableCell className="max-w-[250px] truncate text-xs font-medium text-red-700 italic" title={m.criticalPoints}>"{m.criticalPoints || 'None logged.'}"</TableCell>
                    <TableCell className="text-center">{m.recordingUrl ? <Badge variant="secondary" className="h-5 px-1.5 bg-primary/10 text-primary border-none"><Volume2 className="h-3 w-3" /></Badge> : '—'}</TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"><Eye className="h-4 w-4" /></Button>
                        {(isAdmin || m.userId === user?.uid) && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}><Trash2 className="h-4 w-4" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Meeting Detail Dialog */}
      <Dialog open={!!viewingMeeting} onOpenChange={(o) => !o && setViewingMeeting(null)}>
        <DialogContent className="max-w-4xl w-[95vw] p-0 overflow-hidden border-none shadow-2xl bg-background flex flex-col h-[90vh]">
          <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-sm"><NotebookPen className="h-5 w-5 text-primary" /></div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Review Meeting Audit</DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{viewingMeeting?.date} • {viewingMeeting?.siteName}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1">
            {viewingMeeting && (
              <div className="p-8 space-y-10 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Site Location</Label>
                      <p className="text-lg font-black text-foreground leading-tight flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary/40" />
                        {viewingMeeting.siteName}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Meeting Lead</Label>
                      <p className="text-sm font-bold flex items-center gap-2">
                        <User className="h-4 w-4 text-primary opacity-40" />
                        {viewingMeeting.userName}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-900 rounded-sm p-6 flex flex-col justify-center gap-4 shadow-xl text-white">
                    <div className="flex items-center justify-between">
                       <Label className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Voice Recording</Label>
                       <Volume2 className="h-4 w-4 text-primary/40" />
                    </div>
                    {viewingMeeting.recordingUrl ? (
                      <audio src={viewingMeeting.recordingUrl} controls className="w-full h-10 accent-primary" />
                    ) : (
                      <p className="text-[10px] italic text-white/30 uppercase font-black text-center py-2 tracking-widest">No audio captured during this session</p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b-2 border-primary/10 pb-2">
                    <Users className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-primary">Meeting Attendees</h3>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {viewingMeeting.attendees && viewingMeeting.attendees.length > 0 ? viewingMeeting.attendees.map((a: any) => (
                      <Badge key={a.id} variant="outline" className="rounded-sm font-bold text-[10px] bg-background border-primary/10 py-1.5 px-3 flex items-center gap-2">
                        <User className="h-3 w-3 text-primary/40" />
                        {a.name}
                      </Badge>
                    )) : (
                      <p className="text-[10px] italic text-muted-foreground/40 uppercase font-black tracking-widest">No additional attendees recorded.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-2 border-b-2 border-primary/10 pb-2">
                    <History className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-primary">Technical Review Protocol</h3>
                  </div>
                  <div className="space-y-8">
                    {CATEGORIES.map(category => (
                      <div key={category} className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60">{category}</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {REVIEW_POINTS.filter(p => p.category === category).map(p => (
                            <div key={p.id} className="p-4 border rounded-sm bg-muted/5 space-y-2 group hover:bg-primary/[0.01] transition-all">
                              <div className="flex items-center gap-2 text-[9px] font-black uppercase text-muted-foreground/60">
                                 <Check className="h-3 w-3 text-primary opacity-30 group-hover:opacity-100" />
                                 {p.label}
                              </div>
                              <p className="text-xs font-medium leading-relaxed italic text-foreground/80">
                                {viewingMeeting.observations[p.id] ? `"${viewingMeeting.observations[p.id]}"` : "No specific observations logged."}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b-2 border-red-500/20 pb-2">
                    <ShieldAlert className="h-4 w-4 text-red-600" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-red-700">Critical Observations Registry</h3>
                  </div>
                  <div className="p-6 bg-red-50/50 border-2 border-red-100 rounded-sm text-sm font-medium leading-relaxed italic text-red-950">
                    "{viewingMeeting.criticalPoints || 'Zero critical blockers identified during this meeting.'}"
                  </div>
                </div>

                <div className="pt-8 border-t flex flex-col gap-2">
                   <p className="text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-30 text-center">End of Review Document • Aditya Pro Compliance Engine</p>
                </div>
              </div>
            )}
          </ScrollArea>
          <DialogFooter className="p-4 bg-muted/5 border-t shrink-0">
            <DialogClose asChild><Button variant="outline" className="w-full sm:w-auto rounded-sm font-black uppercase text-[10px] h-11 px-10 tracking-widest">Close Audit</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
