'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking, useCollection } from '@/firebase';
import { collection, doc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
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
  ListChecks,
  Users,
  User,
  X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

const REVIEW_POINTS = [
  { id: 'mms', label: 'Module Mounting Structure' },
  { id: 'mcr', label: 'Main Control Room' },
  { id: 'earthing', label: 'Earthing' },
  { id: 'acCable', label: 'AC Cable' },
  { id: 'dcCable', label: 'DC Cable' },
  { id: 'stringInverter', label: 'String Inverter' },
  { id: 'ltPanel', label: 'LT Panel' },
  { id: 'transformer', label: 'Transformer' },
  { id: 'rmuVcb', label: 'RMU/VCB' },
  { id: 'poleStructure', label: 'Four Pole/Two Pole Structure' },
  { id: 'modules', label: 'Modules' },
  { id: 'htLine', label: 'HT Line' },
  { id: 'others', label: 'Others' },
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

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<any>(sitesQuery);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers } = useCollection<any>(usersQuery);

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
        customPoints: [], // Maintained for legacy compatibility
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
              Return to Dashboard
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
          <div className="bg-primary/10 p-2 rounded-sm"><ListChecks className="h-6 w-6 text-primary" /></div>
          Start Review Meeting
        </h1>
        <p className="text-muted-foreground text-sm font-medium">Document site progress and record collaborative discussions.</p>
      </div>

      <div className="space-y-8">
        {/* Site Selection */}
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
                  <Button variant="outline" className="w-full justify-between h-12 rounded-sm font-bold border-primary/20 text-left">
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

        {/* Attendees Selection */}
        <Card className="rounded-sm shadow-md border-primary/10">
          <CardHeader className="py-4 border-b bg-muted/5">
            <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Attendees / Participants
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Select Personnel Available in Meeting</Label>
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
                      placeholder="Search personnel..." 
                      className="h-10 border-none text-sm bg-transparent focus-visible:ring-0" 
                      value={attendeeSearch} 
                      onChange={e => setAttendeeSearch(e.target.value)} 
                    />
                  </div>
                  <ScrollArea className="h-[250px]">
                    <div className="p-1">
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
                  <Badge key={a.id} variant="secondary" className="pl-2 pr-1 h-7 rounded-sm gap-1.5 flex items-center font-bold text-[10px] bg-primary/5 text-primary border border-primary/10">
                    <User className="h-3 w-3" />
                    <span className="truncate max-w-[120px]">{a.name}</span>
                    <X className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors" onClick={(e) => { e.stopPropagation(); setAttendees(prev => prev.filter(x => x.id !== a.id)); }} />
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Review Points */}
        <Card className="rounded-sm shadow-md border-primary/10 overflow-hidden">
          <CardHeader className="bg-primary/5 border-b py-4">
            <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" /> Technical Review Points
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {REVIEW_POINTS.map((point) => (
                <div key={point.id} className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-start hover:bg-muted/[0.01] transition-colors">
                  <Label className="md:col-span-4 text-xs font-black uppercase text-foreground pt-3 tracking-tight">{point.label}</Label>
                  <div className="md:col-span-8">
                    <Textarea 
                      placeholder="Status / Observation..." 
                      value={observations[point.id] || ""}
                      onChange={(e) => setObservations({ ...observations, [point.id]: e.target.value })}
                      className="rounded-sm bg-muted/5 border-primary/5 min-h-[60px] text-xs font-medium"
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Critical Points */}
        <Card className="rounded-sm shadow-md border-primary/10">
          <CardHeader className="bg-red-500/5 border-b py-4">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-red-700 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-600" /> Critical Points Observed
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Textarea 
              placeholder="List major concerns, blockers or high-priority findings..." 
              rows={6}
              value={criticalPoints}
              onChange={e => setCriticalPoints(e.target.value)}
              className="rounded-sm border-red-500/10 focus-visible:ring-red-500/20 text-sm font-medium"
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <Button 
            variant="outline" 
            onClick={() => router.back()} 
            className="flex-1 h-12 rounded-sm font-bold uppercase text-[10px] tracking-widest"
            disabled={isSubmitting}
          >
            Cancel Meeting
          </Button>
          <Button 
            onClick={handleSaveMeeting} 
            disabled={isSubmitting || !siteId}
            className="flex-[2] h-12 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Meeting Record
          </Button>
        </div>
      </div>
    </div>
  );
}
