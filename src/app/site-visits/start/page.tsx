"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Check, ChevronsUpDown, Loader2, Navigation, MapPin, AlertCircle, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isSuperAdmin } from "@/lib/auth-constants";

type Site = {
  id: string;
  name: string;
};

export default function StartSiteVisitPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<Site>(sitesQuery);

  const [selectedSite, setSelectedSite] = React.useState<Site | null>(null);
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");
  const [isStarting, setIsStarting] = React.useState(false);

  const accessibleSites = React.useMemo(() => {
    if (!allSites || !userProfile) return [];
    // Admins and Super Admins can visit any site in the registry
    if (isAdmin) return allSites;
    
    const assignedIds = userProfile.assignedProjectIds || [];
    return allSites.filter(s => assignedIds.includes(s.id));
  }, [allSites, userProfile, isAdmin]);

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
    if (!user || !userProfile || !selectedSite) return;
    
    setIsStarting(true);
    const location = await getCurrentLocation();
    
    if (!location) {
      setIsStarting(false);
      return;
    }

    try {
      // Check for existing ongoing visits for the current user
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

      await addDocumentNonBlocking(collection(firestore, 'site_visits'), {
        siteId: selectedSite.id,
        siteName: selectedSite.name,
        managerId: user.uid,
        managerName: userProfile.username || user.email,
        siteManagerId: userProfile.siteManagerId || null,
        department: userProfile.department || null,
        startTime: serverTimestamp(),
        startLat: location.lat,
        startLng: location.lng,
        status: 'ongoing',
        createdAt: serverTimestamp()
      });

      toast({ title: 'Visit Started', description: `Reporting started for ${selectedSite.name}.` });
      router.push('/site-visits/active');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2">
          <Navigation className="h-8 w-8" /> Start Site Visit
        </h1>
        <p className="text-muted-foreground">Initiate a formal site visit report. Your location and time will be captured.</p>
      </div>

      <Card className="shadow-md border-primary/10 rounded-sm">
        <CardHeader>
          <CardTitle>Initiate Field Presence</CardTitle>
          <CardDescription>
            Select your current location from {isAdmin ? "the organizational registry" : "your assigned project sites"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Select Project Site</Label>
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
                    <div className="p-4 text-center text-sm text-muted-foreground italic">No {isAdmin ? "" : "authorized"} sites found.</div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>

          <div className="p-4 bg-primary/5 rounded-sm border border-primary/10 flex items-start gap-3">
            <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <strong>Geofencing Notice:</strong> By clicking Start Visit, the system will verify your current GPS location and record the start time. Ensure GPS is enabled on your device.
            </div>
          </div>

          <Button 
            className="w-full h-14 text-lg font-black rounded-sm shadow-lg shadow-primary/20" 
            disabled={!selectedSite || isStarting}
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
