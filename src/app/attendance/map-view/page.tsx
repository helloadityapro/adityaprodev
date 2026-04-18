'use client';

import * as React from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Navigation, Loader2, AlertCircle, Search, Check, ChevronsUpDown, FilterX, MapPin } from 'lucide-react';
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

  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [focusedId, setFocusedId] = React.useState<string | null>(null);

  // Location search states
  const [locSearchQuery, setLocSearchQuery] = React.useState("");
  const [isLocSearchOpen, setIsLocSearchOpen] = React.useState(false);
  const [locResults, setLocResults] = React.useState<any[]>([]);
  const [isLocSearching, setIsLocSearching] = React.useState(false);
  const [flyToLocation, setFlyToLocation] = React.useState<{ lat: number, lng: number } | null>(null);

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

  const filteredPersonnel = React.useMemo(() => {
    if (!todayRecords) return [];
    return todayRecords.filter(r => 
      r.userName?.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => (a.userName || "").localeCompare(b.userName || ""));
  }, [todayRecords, searchQuery]);

  // Location search function
  const handleLocationSearch = async (query: string) => {
    setLocSearchQuery(query);
    if (query.trim().length < 3) {
      setLocResults([]);
      return;
    }

    setIsLocSearching(true);
    try {
      // Using OSM Nominatim API for free geocoding
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
    // Reset focused personnel to avoid map confusion
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
              {canViewAll ? "Personnel Live Map" : "My Location Audit"}
            </h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium">
            {canViewAll 
              ? "Real-time GPS visibility for today's recorded site presence across the organization." 
              : "View your verified GPS check-in location and tracking for today."}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Location Search Popover */}
          <Popover open={isLocSearchOpen} onOpenChange={setIsLocSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 w-[240px] justify-between font-bold rounded-sm border-primary/20 bg-background shadow-sm">
                <div className="flex items-center gap-2 truncate">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="truncate">{locSearchQuery || "Search Places..."}</span>
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

          {/* Personnel Search Popover */}
          {canViewAll && (
            <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-10 w-[240px] justify-between font-bold rounded-sm border-primary/20 bg-background shadow-sm">
                  <div className="flex items-center gap-2 truncate">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{focusedId ? todayRecords?.find(r => r.id === focusedId)?.userName : "Search Personnel..."}</span>
                  </div>
                  <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[240px] p-0" align="end">
                <div className="flex items-center border-b px-3 py-2">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <Input 
                    placeholder="Filter by name..." 
                    className="h-8 border-none focus-visible:ring-0 px-0 text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
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
                          setFlyToLocation(null); // Reset location search focus
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4 text-primary", focusedId === person.id ? "opacity-100" : "opacity-0")} />
                        <div className="flex flex-col items-start min-w-0">
                          <span className="font-bold truncate">{person.userName}</span>
                          <span className="text-[9px] font-medium text-muted-foreground uppercase">{person.status}</span>
                        </div>
                      </Button>
                    )) : (
                      <div className="p-8 text-center text-[10px] font-black uppercase text-muted-foreground italic">No matches for today</div>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          )}

          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 h-10 px-4 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-sm">
            <div className="h-1.5 w-1.5 rounded-full bg-primary mr-2 animate-pulse" />
            {canViewAll ? `${todayRecords?.length || 0} Logs for Today` : "Private Identity Verified"}
          </Badge>
        </div>
      </div>

      <Card className="flex-1 rounded-sm border-primary/10 shadow-xl overflow-hidden min-h-[500px]">
        <CardContent className="p-0 h-full relative">
          <MapViewComponent 
            records={todayRecords || []} 
            focusedId={focusedId} 
            flyToLocation={flyToLocation}
          />
        </CardContent>
      </Card>
    </div>
  );
}