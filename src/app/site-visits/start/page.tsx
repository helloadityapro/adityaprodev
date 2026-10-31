"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp, query, where, getDocs, and } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Search, Check, ChevronsUpDown, Loader2, Navigation, MapPin, Building2, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { isSuperAdmin } from "@/lib/auth-constants";
import { sendNotification } from "@/lib/notifications";

type Site = {
  id: string;
  name: string;
};

type UserProfile = {
  id: string;
  username: string;
  role: string;
  siteManagerId?: string;
  assignedProjectIds?: string[];
  department?: string;
};

type MappingOverride = {
  id: string;
  engineerId: string;
  siteId: string;
  managerId: string;
};

export default function StartSiteVisitPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const [locationType, setLocationType] = React.useState<"site" | "other">("site");
  const [selectedSite, setSelectedSite] = React.useState<Site | null>(null);
  const [customLocation, setCustomLocation] = React.useState("");
  
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  const [isStarting, setIsStarting] = React.useState(false);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const overridesQuery = useMemoFirebase(() => collection(firestore, 'team_mapping_overrides'), [firestore]);
  const { data: allOverrides } = useCollection<MappingOverride>(overridesQuery);

  const teamQuery = useMemoFirebase(() => {
    if (!isManager || !user) return null;
    return query(collection(firestore, 'users'), where('siteManagerId', '==', user.uid));
  }, [firestore, user, isManager]);
  const { data: teamMembers } = useCollection<UserProfile>(teamQuery);

  const accessibleSites = React.useMemo(() => {
    if (!allSites) return [];
    
    // Requirements Update: Display all sites to everyone for starting a visit
    // This allows any personnel to check into a site regardless of their direct assignment
    return Array.from(new Map(allSites.map(s => [s.name, s])).values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allSites]);

  const filteredSites = accessibleSites.filter(s => s.name.toLowerCase().includes(siteSearchQuery.toLowerCase()));

  const getCurrentLocation = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        toast({ variant: 'destructive', title: 'Geolocation Not Supported' });
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => {
          toast({ variant: 'destructive', title: 'Location Error', description: 'Please enable GPS to start a site visit.' });
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const handleStartVisit = async () => {
    if (!user || !userProfile) return;
    
    const finalLocationName = locationType === 'site' ? selectedSite?.name : customLocation.trim();
    const finalSiteId = locationType === 'site' ? selectedSite?.id : 'other';

    if (!finalLocationName) {
      toast({ 
        variant: 'destructive', 
        title: 'Location Required', 
        description: locationType === 'site' ? 'Please select a project site.' : 'Please enter the location name.' 
      });
      return;
    }
    
    setIsStarting(true);
    const location = await getCurrentLocation();
    
    if (!location) {
      setIsStarting(false);
      return;
    }

    try {
      const ongoingQuery = query(
        collection(firestore, 'site_visits'), 
        where('managerId', '==', user.uid), 
        where('status', '==', 'ongoing')
      );
      const ongoingSnap = await getDocs(ongoingQuery);
      
      if (!ongoingSnap.empty) {
        toast({ 
          variant: 'destructive', 
          title: 'Existing Visit Active', 
          description: 'You already have an ongoing visit. Please finish it before starting a new one.' 
        });
        router.push('/site-visits/active');
        return;
      }

      // Resolve Effective Manager (only for project sites)
      let effectiveSiteManagerId = userProfile.siteManagerId || null;
      if (locationType === 'site' && finalSiteId) {
        const overridesQ = query(collection(firestore, 'team_mapping_overrides'), and(where('engineerId', '==', user.uid), where('siteId', '==', finalSiteId)));
        const overridesSnap = await getDocs(overridesQ);
        if (!overridesSnap.empty) {
          effectiveSiteManagerId = overridesSnap.docs[0].data().managerId;
        }
      }

      const visitRef = await addDocumentNonBlocking(collection(firestore, 'site_visits'), {
        siteId: finalSiteId,
        siteName: finalLocationName,
        locationType: locationType,
        managerId: user.uid,
        managerName: userProfile.username || user.email,
        siteManagerId: effectiveSiteManagerId,
        department: userProfile.department || null,
        startTime: serverTimestamp(),
        startLat: location.lat,
        startLng: location.lng,
        status: 'ongoing',
        createdAt: serverTimestamp()
      });

      const adminsQuery = query(collection(firestore, 'users'), where('role', '==', 'Admin'));
      const adminDocs = await getDocs(adminsQuery);
      adminDocs.forEach(adminDoc => {
        sendNotification(firestore, {
          userId: adminDoc.id,
          title: "Site Visit Started",
          description: `${userProfile.username} started a site at "${finalLocationName}".`,
          link: `/site-visits/${visitRef!.id}`,
          push: true
        });
      });

      toast({ title: 'Visit Started', description: `Reporting started for ${finalLocationName}.` });
      router.push('/site-visits/active');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto pb-20 px-2 sm:px-4">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2">
          <Navigation className="h-8 w-8" /> Start Site Visit
        </h1>
        <p className="text-muted-foreground">Initiate a formal site visit report. Your location and time will be captured.</p>
      </div>

      <Card className="shadow-md border-primary/10 rounded-sm">
        <CardHeader>
          <CardTitle>Initiate Presence Audit</CardTitle>
          <CardDescription>
            Specify your current location to begin documenting field activities.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Location Type</Label>
            <RadioGroup 
              value={locationType} 
              onValueChange={(val: any) => setLocationType(val)}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="site" id="type-site" />
                <Label htmlFor="type-site" className="font-bold cursor-pointer flex items-center gap-1.5 text-xs uppercase">
                  <Building2 className="h-3.5 w-3.5 text-primary" /> Project Site
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="other" id="type-other" />
                <Label htmlFor="type-other" className="font-bold cursor-pointer flex items-center gap-1.5 text-xs uppercase">
                  <Globe className="h-3.5 w-3.5 text-primary" /> Other Location
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2 animate-in fade-in duration-300">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {locationType === 'site' ? "Project Name" : "Location Name / Landmark"}
            </Label>
            
            {locationType === 'site' ? (
              <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    role="combobox" 
                    className={cn("w-full justify-between font-normal rounded-sm h-12", !selectedSite && "text-muted-foreground")}
                  >
                    {selectedSite ? selectedSite.name : "Choose a site..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <Input 
                      placeholder="Search sites..." 
                      className="h-9 w-full border-none focus-visible:ring-0 px-0" 
                      value={siteSearchQuery} 
                      onChange={(e) => setSiteSearchQuery(e.target.value)} 
                    />
                  </div>
                  <ScrollArea className="h-[200px]">
                    {filteredSites.length > 0 ? filteredSites.map((site) => (
                      <Button 
                          key={site.id} 
                          type="button" 
                          variant="ghost" 
                          className="w-full justify-start font-normal text-left" 
                          onClick={() => { setSelectedSite(site); setIsSitePopoverOpen(false); }}
                      >
                        <Check className={cn("mr-2 h-4 w-4 shrink-0", selectedSite?.id === site.id ? "opacity-100" : "opacity-0")} />
                        <span className="truncate">{site.name}</span>
                      </Button>
                    )) : (
                      <div className="p-4 text-center text-sm text-muted-foreground italic">No authorized sites found.</div>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            ) : (
              <Input 
                placeholder="e.g. Regional Office, Vendor Factory, Substation..." 
                value={customLocation}
                onChange={e => setCustomLocation(e.target.value)}
                className="h-12 rounded-sm"
              />
            )}
          </div>

          <div className="p-4 bg-primary/5 rounded-sm border border-primary/10 flex items-start gap-3">
            <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <strong>Presence Audit Notice:</strong> Your current GPS position will be stamped to verify your presence at <strong>{locationType === 'site' ? (selectedSite?.name || 'the selected site') : (customLocation || 'the specified location')}</strong>.
            </div>
          </div>

          <Button 
            className="w-full h-14 text-lg font-black rounded-sm shadow-lg shadow-primary/20" 
            disabled={(locationType === 'site' ? !selectedSite : !customLocation.trim()) || isStarting}
            onClick={handleStartVisit}
          >
            {isStarting ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Verifying Position...</>
            ) : (
              <><Navigation className="mr-2 h-5 w-5" /> Start Site Visit</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
