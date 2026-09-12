'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking, useCollection } from '@/firebase';
import { collection, doc, serverTimestamp, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Save, 
  Building2, 
  CheckCircle2, 
  Loader2, 
  ShieldAlert,
  ArrowLeft,
  Search,
  ChevronsUpDown,
  Check,
  NotebookPen,
  Users,
  User,
  X,
  History,
  ChevronDown,
  ChevronUp,
  Plus,
  UserPlus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const REVIEW_POINTS = [
  { id: 'mms_civil', label: 'MMS Civil-work' },
  { id: 'mms_install', label: 'MMS Installation' },
  { id: 'module_install', label: 'Modules Installation' },
  { id: 'earthing_laying', label: 'Laying & Termination' },
  { id: 'dc_block_laying', label: 'Trenches, Laying & Termination' },
  { id: 'ac_block_laying', label: 'Trenches, Laying & Termination' },
  { id: 'inverter_install', label: 'Frame erection, Installation and Termination' },
  { id: 'others', label: 'Others' },
];

const REVIEW_SECTIONS = [
  {
    title: "MMS & MODULES INSTALLATION",
    points: ['mms_civil', 'mms_install', 'module_install']
  },
  {
    title: "AC-DC WORKS",
    isHeaderOnly: true
  },
  {
    title: "EARTHING",
    points: ['earthing_laying'],
    indent: true
  },
  {
    title: "DC BLOCK",
    points: ['dc_block_laying'],
    indent: true
  },
  {
    title: "AC BLOCK",
    points: ['ac_block_laying'],
    indent: true
  },
  {
    title: "INVERTERS",
    points: ['inverter_install'],
    indent: true
  },
  {
    title: "OTHERS ITEMS",
    points: ['others']
  }
];

export default function StartMeetingPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [siteId, setSiteId] = React.useState("");
  const [siteName, setSiteName] = React.useState("");
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearch, setSiteSearch] = React.useState("");

  const [attendees, setAttendees] = React.useState<{ id: string, name: string }[]>([]);
  const [attendeeSearch, setAttendeeSearch] = React.useState("");

  const [observations, setObservations] = React.useState<Record<string, string>>({});
  const [criticalPoints, setCriticalPoints] = React.useState("");
  
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [expandedHistory, setExpandedHistory] = React.useState<Record<string, boolean>>({});

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<any>(sitesQuery);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers } = useCollection<any>(usersQuery);

  // Fetch historical meetings for the selected site
  const historicalMeetingsQuery = useMemoFirebase(() => {
    if (!siteId) return null;
    return query(
      collection(firestore, 'meetings'),
      where('siteId', '==', siteId)
    );
  }, [firestore, siteId]);

  const { data: rawPreviousMeetings, isLoading: isHistoryLoading } = useCollection<any>(historicalMeetingsQuery);

  const previousMeetings = React.useMemo(() => {
    if (!rawPreviousMeetings) return [];
    return [...rawPreviousMeetings].sort((a, b) => {
      const getT = (item: any) => {
        if (item.createdAt?.toDate) return item.createdAt.toDate().getTime();
        if (item.createdAt instanceof Date) return item.createdAt.getTime();
        if (typeof item.date === 'string') return new Date(item.date).getTime();
        return 0;
      };
      return getT(b) - getT(a);
    });
  }, [rawPreviousMeetings]);

  const handleSaveMeeting = async () => {
    if (!user || !userProfile || !siteId) {
      toast({ variant: 'destructive', title: 'Site Required', description: 'Please select a project site.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await addDocumentNonBlocking(collection(firestore, 'meetings'), {
        siteId,
        siteName,
        date: format(new Date(), 'yyyy-MM-dd HH:mm'),
        observations,
        customPoints: [], 
        criticalPoints,
        attendees,
        recordingUrl: "", 
        userId: user.uid,
        userName: userProfile.username || user.email,
        createdAt: serverTimestamp()
      });

      setIsSuccess(true);
      toast({ title: 'Meeting Saved', description: 'Site review record archived successfully.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addExternalAttendee = () => {
    const name = attendeeSearch.trim();
    if (!name) return;
    const newId = `ext_${Date.now()}`;
    setAttendees(prev => [...prev, { id: newId, name: `${name} (Ext)` }]);
    setAttendeeSearch("");
  };

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4 animate-in fade-in zoom-in-95 duration-500">
        <Card className="max-w-md w-full rounded-sm shadow-2xl border-emerald-500/20">
          <CardHeader className="text-center pt-8">
            <div className="flex justify-center mb-6">
              <div className="bg-emerald-500/10 p-6 rounded-full"><CheckCircle2 className="h-16 w-16 text-emerald-600" /></div>
            </div>
            <CardTitle className="text-2xl font-black uppercase tracking-tight text-foreground">Meeting Archived</CardTitle>
            <CardDescription className="text-base font-medium text-muted-foreground mt-2 text-center">
              Review meeting for <strong>{siteName}</strong> has been successfully documented.
            </CardDescription>
          </CardHeader>
          <CardFooter className="space-y-4 pb-8 px-8 flex flex-col">
            <Button className="w-full h-12 text-sm font-black uppercase tracking-widest shadow-lg" onClick={() => router.push("/meetings/list")}>
              View Meetings Data
            </Button>
            <Button variant="ghost" className="w-full h-10 text-[10px] font-black uppercase text-muted-foreground" onClick={() => router.push("/dashboard")}>
              Go to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-24 px-2 sm:px-4 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <button onClick={() => router.back()} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 text-sm font-medium">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="flex items-center gap-3 text-2xl md:text-3xl font-black uppercase tracking-tight">
          <div className="bg-primary/10 p-2 rounded-sm"><NotebookPen className="h-6 w-6 text-primary" /></div>
          Start Review Meeting
        </h1>
        <p className="text-muted-foreground text-sm font-medium">Document site progress and record collaborative discussions.</p>
      </div>

      <div className="space-y-8">
        <Card className="rounded-sm shadow-md border-primary/10">
          <CardHeader className="py-4 border-b bg-muted/5">
            <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Site Context
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Select Project Site</Label>
              <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className={cn("w-full justify-between h-12 rounded-sm font-bold border-primary/20 text-left", !siteId && "text-muted-foreground")}>
                    <span className="truncate">{siteName || "Choose site..."}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-2xl">
                  <div className="flex items-center border-b px-3 bg-muted/20">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <Input 
                      placeholder="Search sites..." 
                      className="h-10 border-none text-sm bg-transparent focus-visible:ring-0" 
                      value={siteSearch} 
                      onChange={e => setSiteSearch(e.target.value)} 
                    />
                  </div>
                  <ScrollArea className="h-[200px]">
                    <div className="p-1">
                      {allSites?.filter((s: any) => s.name.toLowerCase().includes(siteSearch.toLowerCase())).map((s: any) => (
                        <Button key={s.id} type="button" variant="ghost" className="w-full justify-start h-10 text-xs font-bold uppercase text-left" onClick={() => { setSiteId(s.id); setSiteName(s.name); setIsSitePopoverOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4 text-primary", siteId === s.id ? "opacity-100" : "opacity-0")} />
                          {s.name}
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-sm shadow-md border-primary/10">
          <CardHeader className="py-4 border-b bg-muted/5">
            <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Attendees / Participants
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Select or Add Participants</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between h-12 rounded-sm font-bold border-primary/20 text-left">
                    <span className="truncate">
                      {attendees.length === 0 ? "Select Attendees..." : `${attendees.length} Personnel Selected`}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-2xl">
                  <div className="flex items-center border-b px-3 bg-muted/20">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <Input 
                      placeholder="Search or type new name..." 
                      className="h-10 border-none text-sm bg-transparent focus-visible:ring-0" 
                      value={attendeeSearch} 
                      onChange={e => setAttendeeSearch(e.target.value)} 
                    />
                  </div>
                  <ScrollArea className="h-[250px]">
                    <div className="p-1">
                      {attendeeSearch.trim() !== "" && (
                        <Button 
                          variant="ghost" 
                          className="w-full justify-start h-11 mb-1 bg-primary/5 text-primary rounded-sm border-b" 
                          onClick={addExternalAttendee}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          <span className="text-xs font-black uppercase truncate">Add "{attendeeSearch}" (External)</span>
                        </Button>
                      )}
                      {allUsers?.filter((u: any) => u.username?.toLowerCase().includes(attendeeSearch.toLowerCase())).map((u: any) => {
                        const isSelected = attendees.some(a => a.id === u.id);
                        return (
                          <div 
                            key={u.id} 
                            className={cn(
                              "flex items-center space-x-3 p-3 rounded-sm hover:bg-primary/5 transition-colors cursor-pointer group",
                              isSelected && "bg-primary/5"
                            )}
                            onClick={() => {
                              if (isSelected) {
                                setAttendees(prev => prev.filter(a => a.id !== u.id));
                              } else {
                                setAttendees(prev => [...prev, { id: u.id, name: u.username }]);
                              }
                            }}
                          >
                            <Checkbox checked={isSelected} className="rounded-[4px]" />
                            <div className="flex flex-col min-w-0">
                              <span className={cn("text-xs font-bold truncate transition-colors", isSelected ? "text-primary" : "text-foreground")}>{u.username}</span>
                              <span className="text-[8px] text-muted-foreground uppercase font-black tracking-tighter opacity-60">{u.role}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>
            
            {attendees.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {attendees.map(a => (
                  <Badge key={a.id} variant="secondary" className="pl-2.5 pr-1 h-7 rounded-sm gap-1.5 flex items-center font-bold text-[10px] bg-primary/5 text-primary border border-primary/10">
                    <User className="h-3 w-3 text-primary/40" />
                    <span className="truncate max-w-[120px]">{a.name}</span>
                    <X className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors" onClick={(e) => { e.stopPropagation(); setAttendees(prev => prev.filter(x => x.id !== a.id)); }} />
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
          <CardHeader className="bg-primary/5 border-b py-4">
            <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <NotebookPen className="h-4 w-4 text-primary" /> Technical Review Protocol
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y">
            {REVIEW_SECTIONS.map((section, sIdx) => (
              <div key={sIdx} className={cn("p-4 sm:p-6 space-y-6", section.indent && "pl-8 sm:pl-12 bg-muted/[0.01]")}>
                <div className="flex items-center gap-2 border-b border-primary/10 pb-2">
                   <h3 className={cn("font-black uppercase tracking-widest", section.indent ? "text-[10px] text-primary/70" : "text-sm text-primary")}>
                    {section.title}
                   </h3>
                </div>
                
                <div className="space-y-6">
                  {section.points?.map(pointId => {
                    const point = REVIEW_POINTS.find(p => p.id === pointId);
                    if (!point) return null;

                    const pointHistory = previousMeetings?.filter((m: any) => m.observations && m.observations[point.id]) || [];
                    const latest = pointHistory[0];
                    const isExpanded = expandedHistory[point.id];

                    return (
                      <div key={point.id} className="space-y-4 group">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                          <div className="md:col-span-4 pt-3 text-left">
                            <Label className="text-xs font-black uppercase text-foreground tracking-tight">{point.label}</Label>
                          </div>
                          
                          <div className="md:col-span-8">
                            <Textarea 
                              placeholder="Enter status / observation..." 
                              value={observations[point.id] || ""}
                              onChange={(e) => setObservations({ ...observations, [point.id]: e.target.value })}
                              className="rounded-sm bg-background border-primary/10 min-h-[100px] text-sm font-medium shadow-sm focus-visible:ring-primary/20"
                            />
                          </div>
                        </div>

                        {siteId && (
                          <div className="space-y-3 animate-in fade-in duration-500 pt-2 w-full">
                            <div className="flex items-center justify-between border-t border-dashed pt-4">
                                <div className="flex items-center gap-2">
                                  <History className="h-3.5 w-3.5 text-primary opacity-40" />
                                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Historical Context</Label>
                                </div>
                                {pointHistory.length > 1 && (
                                  <Button 
                                    type="button" 
                                    variant="link" 
                                    size="sm" 
                                    className="h-auto p-0 text-[10px] font-bold uppercase tracking-tight text-primary/60 hover:text-primary"
                                    onClick={() => setExpandedHistory(prev => ({...prev, [point.id]: !isExpanded}))}
                                  >
                                    {isExpanded ? "Collapse History" : `Expand Audit Trail (${pointHistory.length})`}
                                  </Button>
                                )}
                            </div>

                            <div className="space-y-2">
                                {isHistoryLoading ? (
                                  <Skeleton className="h-14 w-full bg-muted/20 rounded-sm" />
                                ) : pointHistory.length > 0 ? (
                                  <>
                                    {!isExpanded ? (
                                      <div className="p-4 rounded-sm bg-muted/20 border border-border/50 text-[11px] italic text-muted-foreground shadow-inner text-left w-full">
                                          <div className="flex justify-between items-center mb-1.5">
                                            <span className="font-black text-[9px] uppercase not-italic text-foreground/40">{latest.userName}</span>
                                            <span className="font-mono text-[9px] not-italic opacity-50">{latest.date}</span>
                                          </div>
                                          <p className="leading-relaxed whitespace-pre-wrap">"{latest.observations[point.id]}"</p>
                                      </div>
                                    ) : (
                                      <div className="space-y-2 animate-in slide-in-from-top-1 duration-300 w-full">
                                          {pointHistory.map((h, hIdx) => (
                                            <div key={h.id} className={cn(
                                              "p-4 rounded-sm border text-[11px] italic text-left w-full",
                                              hIdx === 0 ? "bg-primary/5 border-primary/10 text-primary/80" : "bg-muted/10 border-border/40 text-muted-foreground"
                                            )}>
                                              <div className="flex justify-between items-center mb-1.5">
                                                <span className="font-black text-[9px] uppercase not-italic text-foreground/40">{h.userName}</span>
                                                <span className="font-mono text-[9px] not-italic opacity-50">{h.date}</span>
                                              </div>
                                              <p className="leading-relaxed whitespace-pre-wrap">"{h.observations[point.id]}"</p>
                                            </div>
                                          ))}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="p-4 rounded-sm bg-muted/5 border border-dashed text-[10px] text-muted-foreground/30 italic text-center uppercase font-bold tracking-tighter w-full">
                                      No previous history discovered for this point.
                                  </div>
                                )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-sm shadow-md border-primary/10">
          <CardHeader className="bg-red-500/5 border-b py-4">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-red-700 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-600" /> Critical Observations Registry
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Textarea 
              placeholder="List major concerns, blockers or high-priority findings requiring immediate attention..." 
              rows={6}
              value={criticalPoints}
              onChange={e => setCriticalPoints(e.target.value)}
              className="rounded-sm border-red-500/10 focus-visible:ring-red-500/20 text-sm font-medium"
            />
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 sm:pt-8">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => router.back()} 
            className="rounded-sm font-bold h-12 sm:w-32 order-2 sm:order-1"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveMeeting} 
            disabled={isSubmitting || !siteId}
            className="flex-1 sm:flex-none sm:min-w-[200px] h-12 rounded-sm font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 order-1 sm:order-2"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Meeting Record
          </Button>
        </div>
      </div>
    </div>
  );
}
