'use client';

import * as React from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Navigation, Loader2, AlertCircle, Search, Check, ChevronsUpDown, FilterX, MapPin, Building2, Filter, Layers } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Badge } from '@/components/ui/badge';
import { isSuperAdmin } from '@/lib/auth-constants';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

// Dynamically import the Map component to avoid SSR errors
const MapViewComponent = dynamic(() => import('@/components/attendance-map-view'), { 
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-muted/20 animate-pulse rounded-sm flex flex-col items-center justify-center gap-4 min-h-[500px]">
      <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Initializing Map Engine...</p>
    </div>
  )
});

export default function AttendanceMapPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();

  const [searchQuery, setSearchTerm] = React.useState("");
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [focusedId, setFocusedId] = React.useState<string | null>(null);

  // Visibility states - Only show users by default
  const [showUsers, setShowUsers] = React.useState(true);
  const [showUserNames, setShowUserNames] = React.useState(false);
  const [showSites, setShowSites] = React.useState(false);
  const [showSiteNames, setShowSiteNames] = React.useState(false);

  // Location search states
  const [locSearchQuery, setLocSearchQuery] = React.useState("");
  const [isLocSearchOpen, setIsLocSearchOpen] = React.useState(false);
  const [locResults, setLocResults] = React.useState<any[]>([]);
  const [isLocSearching, setIsLocSearching] = React.useState(false);
  const [flyToLocation, setFlyToLocation] = React.useState<{ lat: number, lng: number } | null>(null);

  // Site filter states
  const [siteFilter, setSiteFilter] = React.useState<string>("All Sites");
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchInput, setSiteSearchInput] = React.useState("");

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  // Authority check: Only Admin and HR can view everyone.
  const canViewAll = isSuperAdmin(user?.email) || userProfile?.role === 'Admin' || userProfile?.role === 'Manager - Human Resources';

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const attendanceQuery = useMemoFirebase(() => {
    if (!user) return null;
    const colRef = collection(firestore, 'attendance');
    
    if (canViewAll) {
      return query(
        colRef,
        where('date', '==', todayStr)
      );
    }
    
    // Non-Admin/HR users only see their own log for today
    return query(
      colRef,
      where('date', '==', todayStr),
      where('userId', '==', user.uid)
    );
  }, [firestore, todayStr, canViewAll, user]);

  const { data: todayRecords, isLoading: isAttendanceLoading } = useCollection<any>(attendanceQuery);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<any>(sitesQuery);

  const accessibleSites = React.useMemo(() => {
    if (!allSites || !userProfile) return [];
    if (isAdminOrHR()) return allSites;
    
    const assignedIds = new Set(userProfile.assignedProjectIds || []);
    return allSites.filter((s: any) => assignedIds.has(s.id));
  }, [allSites, userProfile]);

  function isAdminOrHR() {
    return isSuperAdmin(user?.email) || userProfile?.role === 'Admin' || userProfile?.role === 'Manager - Human Resources';
  }

  const filteredPersonnel = React.useMemo(() => {
    if (!todayRecords) return [];
    return todayRecords.filter(r => {
      const matchesSearch = r.userName?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSite = siteFilter === "All Sites" || r.siteName === siteFilter;
      return matchesSearch && matchesSite;
    }).sort((a, b) => (a.userName || "").localeCompare(b.userName || ""));
  }, [todayRecords, searchQuery, siteFilter]);

  const filteredSitesForDropdown = React.useMemo(() => {
    if (!accessibleSites) return [];
    return accessibleSites.filter((s: any) => s.name.toLowerCase().includes(siteSearchInput.toLowerCase()));
  }, [accessibleSites, siteSearchInput]);

  // Location search function
  const handleLocationSearch = async (query: string) => {
    setLocSearchQuery(query);
    if (query.trim().length < 3) {
      setLocResults([]);
      return;
    }

    setIsLocSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
        {
          headers: {
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent': 'AdityaPro-MapSearch/1.0'
          }
        }
      );
      const data = await response.json();
      setLocResults(data);
    } catch (error) {
      console.error("Location search failed", error);
    } finally {
      setIsLocSearching(false);
    }
  };

  const handleSelectLocation = (loc: any) => {
    setFlyToLocation({
      lat: parseFloat(loc.lat),
      lng: parseFloat(loc.lon)
    });
    setLocSearchQuery(loc.display_name);
    setIsLocSearchOpen(false);
    setFocusedId(null);
  };

  const handleSelectSite = (site: any) => {
    setSiteFilter(site.name);
    if (site.latitude && site.longitude) {
      setFlyToLocation({
        lat: site.latitude,
        lng: site.longitude
      });
    }
    setIsSitePopoverOpen(false);
    setFocusedId(null);
  };

  const clearAllFilters = () => {
    setSiteFilter("All Sites");
    setSearchTerm("");
    setLocSearchQuery("");
    setFlyToLocation(null);
    setFocusedId(null);
  };

  if (isProfileLoading || isAttendanceLoading) {
    return (
      <div className="space-y-6 h-[calc(100vh-12rem)]">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-full w-full rounded-sm" />
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col min-h-[calc(100vh-10rem)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Navigation className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-black uppercase tracking-tight">
              {canViewAll ? "Map View" : "My Location Audit"}
            </h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium">
            {canViewAll 
              ? "Visibility for today's recorded site presence across the organization." 
              : "View your verified GPS check-in location and tracking for today."}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 pb-1 sm:pb-0">
          {/* Layer Visibility Toggles */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 rounded-sm border-primary/20 text-primary bg-background shadow-sm shrink-0">
                <Layers className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-4 rounded-sm border-primary/10 shadow-2xl">
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Display Layers</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="toggle-users" checked={showUsers} onCheckedChange={(val) => setShowUsers(!!val)} />
                    <Label htmlFor="toggle-users" className="text-xs font-bold uppercase tracking-tight cursor-pointer">Show User Pins</Label>
                  </div>
                  <div className="flex items-center space-x-2 pl-6">
                    <Checkbox id="toggle-user-names" checked={showUserNames} onCheckedChange={(val) => setShowUserNames(!!val)} disabled={!showUsers} />
                    <Label htmlFor="toggle-user-names" className={cn("text-[10px] font-bold uppercase tracking-tight cursor-pointer", !showUsers && "opacity-40")}>Show User Names</Label>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex items-center space-x-2">
                    <Checkbox id="toggle-sites" checked={showSites} onCheckedChange={(val) => setShowSites(!!val)} />
                    <Label htmlFor="toggle-sites" className="text-xs font-bold uppercase tracking-tight cursor-pointer">Show Site Pins</Label>
                  </div>
                  <div className="flex items-center space-x-2 pl-6">
                    <Checkbox id="toggle-site-names" checked={showSiteNames} onCheckedChange={(val) => setShowSiteNames(!!val)} disabled={!showSites} />
                    <Label htmlFor="toggle-site-names" className={cn("text-[10px] font-bold uppercase tracking-tight cursor-pointer", !showSites && "opacity-40")}>Show Site Names</Label>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Location Search Popover */}
          <Popover open={isLocSearchOpen} onOpenChange={setIsLocSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 w-[180px] justify-between font-bold rounded-sm border-primary/20 bg-background shadow-sm shrink-0">
                <div className="flex items-center gap-2 truncate">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="truncate">{locSearchQuery || "Places..."}</span>
                </div>
                <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="end">
              <div className="flex items-center border-b px-3 py-2">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <Input 
                  placeholder="Enter city, village, etc..." 
                  className="h-8 border-none focus-visible:ring-0 px-0 text-sm"
                  value={locSearchQuery}
                  onChange={(e) => handleLocationSearch(e.target.value)}
                />
              </div>
              <ScrollArea className="h-[250px]">
                <div className="p-1">
                  {isLocSearching ? (
                    <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary opacity-20" /></div>
                  ) : locResults.length > 0 ? locResults.map((loc, idx) => (
                    <Button
                      key={idx}
                      variant="ghost"
                      className="w-full justify-start h-auto text-xs rounded-sm px-3 py-2 mb-0.5"
                      onClick={() => handleSelectLocation(loc)}
                    >
                      <div className="flex flex-col items-start min-w-0 text-left">
                        <span className="font-bold truncate w-full">{loc.display_name.split(',')[0]}</span>
                        <span className="text-[9px] font-medium text-muted-foreground line-clamp-1">{loc.display_name}</span>
                      </div>
                    </Button>
                  )) : (
                    <div className="p-8 text-center text-[10px] font-black uppercase text-muted-foreground italic">
                      {locSearchQuery.length >= 3 ? "No places found" : "Type 3+ chars to search"}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>

          {/* Site Search Popover */}
          <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 w-[180px] justify-between font-bold rounded-sm border-primary/20 bg-background shadow-sm shrink-0">
                <div className="flex items-center gap-2 truncate">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="truncate">{siteFilter === "All Sites" ? "Sites..." : siteFilter}</span>
                </div>
                <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="end">
              <div className="flex items-center border-b px-3 py-2">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <Input 
                  placeholder="Filter by site name..." 
                  className="h-8 border-none focus-visible:ring-0 px-0 text-sm"
                  value={siteSearchInput}
                  onChange={(e) => setSiteSearchInput(e.target.value)}
                />
              </div>
              <ScrollArea className="h-[250px]">
                <div className="p-1">
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-10 text-xs rounded-sm px-3 mb-0.5"
                    onClick={() => { setSiteFilter("All Sites"); setIsSitePopoverOpen(false); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4 text-primary", siteFilter === "All Sites" ? "opacity-100" : "opacity-0")} />
                    All Sites
                  </Button>
                  {filteredSitesForDropdown.map((s: any) => (
                    <Button
                      key={s.id}
                      variant="ghost"
                      className="w-full justify-start h-10 text-xs rounded-sm px-3 mb-0.5"
                      onClick={() => handleSelectSite(s)}
                    >
                      <Check className={cn("mr-2 h-4 w-4 text-primary", siteFilter === s.name ? "opacity-100" : "opacity-0")} />
                      <div className="flex flex-col items-start overflow-hidden text-left">
                        <span className="font-bold truncate w-full">{s.name}</span>
                        <span className="text-[9px] text-muted-foreground uppercase">{s.projectCompany}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>

          {/* Personnel Search Popover */}
          {canViewAll && (
            <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-10 w-[180px] justify-between font-bold rounded-sm border-primary/20 bg-background shadow-sm shrink-0">
                  <div className="flex items-center gap-2 truncate">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{focusedId ? todayRecords?.find((r: any) => r.id === focusedId)?.userName : "Personnel..."}</span>
                  </div>
                  <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="end">
                <div className="flex items-center border-b px-3 py-2">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <Input 
                    placeholder="Filter by name..." 
                    className="h-8 border-none focus-visible:ring-0 px-0 text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <ScrollArea className="h-[250px]">
                  <div className="p-1">
                    {filteredPersonnel.length > 0 ? filteredPersonnel.map(person => (
                      <Button
                        key={person.id}
                        variant="ghost"
                        className="w-full justify-start h-10 text-xs rounded-sm px-3 mb-0.5"
                        onClick={() => {
                          setFocusedId(person.id);
                          setIsSearchOpen(false);
                          setFlyToLocation(null);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4 text-primary", focusedId === person.id ? "opacity-100" : "opacity-0")} />
                        <div className="flex flex-col items-start min-w-0">
                          <span className="font-bold truncate">{person.userName}</span>
                          <span className="text-[9px] font-medium text-muted-foreground uppercase">{person.status}</span>
                        </div>
                      </Button>
                    )) : (
                      <div className="p-8 text-center text-[10px] font-black uppercase text-muted-foreground italic">No matches matching filters</div>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          )}

          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 h-10 px-4 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-sm shrink-0">
            <div className="h-1.5 w-1.5 rounded-full bg-primary mr-2 animate-pulse" />
            {canViewAll ? `${filteredPersonnel.length} Logs` : "Identity Verified"}
          </Badge>

          <Button variant="ghost" size="icon" onClick={clearAllFilters} className="h-10 w-10 text-muted-foreground shrink-0 rounded-sm">
            <FilterX className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="flex-1 rounded-sm border-primary/10 shadow-xl overflow-hidden min-h-[500px]">
        <CardContent className="p-0 h-full relative">
          <MapViewComponent 
            records={filteredPersonnel} 
            focusedId={focusedId} 
            flyToLocation={flyToLocation}
            sites={accessibleSites || []}
            visibility={{
              showUsers,
              showUserNames,
              showSites,
              showSiteNames
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
