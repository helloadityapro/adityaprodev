"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { collection, query, orderBy, doc, limit, where } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { 
  History, 
  Search, 
  FilterX, 
  Clock, 
  MapPin, 
  User, 
  PieChart,
  Calendar,
  Building2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ListFilter,
  FileDown
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';
import { isSuperAdmin } from "@/lib/auth-constants";
import { slugifyRole } from "@/lib/access-control";

type Utilisation = {
  id: string;
  siteId: string;
  siteName: string;
  itemName: string;
  quantity: number;
  unit: string;
  utilisationDate: string;
  remarks: string;
  userName: string;
  createdAt: any;
};

type UserProfile = {
  id: string;
  username: string;
  role: string;
  siteManagerId?: string;
  assignedProjectIds?: string[];
  ownDataOnly?: boolean;
};

type AccessConfig = {
  id: string;
  ownDataOnly?: boolean;
};

type MappingOverride = {
  id: string;
  engineerId: string;
  siteId: string;
  managerId: string;
};

type SortKey = 'date' | 'site' | 'item' | 'quantity' | 'personnel';

export default function UtilisationDataPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [siteFilter, setSiteFilter] = React.useState("all");
  const [dateFilter, setDateFilter] = React.useState<string>("7days");
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ 
    key: 'date', 
    direction: 'desc' 
  });

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<AccessConfig>(roleConfigsQuery);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites } = useCollection<{ name: string, id: string }>(sitesQuery);

  const overridesQuery = useMemoFirebase(() => collection(firestore, 'team_mapping_overrides'), [firestore]);
  const { data: allOverrides } = useCollection<MappingOverride>(overridesQuery);

  const isSuper = isSuperAdmin(user?.email);
  const isAdmin = isSuper || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const teamQuery = useMemoFirebase(() => {
    if (!isManager || !user) return null;
    return query(collection(firestore, 'users'), where('siteManagerId', '==', user.uid));
  }, [firestore, user, isManager]);
  const { data: teamMembers } = useCollection<any>(teamQuery);

  const accessibleSites = React.useMemo(() => {
    if (!allSites || !userProfile) return [];
    if (isAdmin) return allSites;
    
    const roleId = userProfile.role ? slugifyRole(userProfile.role) : 'none';
    const isOwnDataOnly = userProfile.ownDataOnly !== undefined 
      ? userProfile.ownDataOnly 
      : roleConfigs?.find(c => c.id === roleId)?.ownDataOnly ?? false;

    if (!isOwnDataOnly) return allSites;

    const siteIds = new Set<string>();
    if (isManager) {
      allOverrides?.filter(o => o.managerId === userProfile.id).forEach(o => siteIds.add(o.siteId));
      teamMembers?.forEach(member => {
        (member.assignedProjectIds || []).forEach(sid => {
          const hasOtherOverride = allOverrides?.some(o => o.engineerId === member.id && o.siteId === sid && o.managerId !== userProfile.id);
          if (!hasOtherOverride) siteIds.add(sid);
        });
      });
    } else {
      (userProfile.assignedProjectIds || []).forEach(id => siteIds.add(id));
    }
    return allSites.filter(s => siteIds.has(s.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [allSites, userProfile, roleConfigs, isAdmin, isManager, teamMembers, allOverrides]);

  const accessibleSiteIds = React.useMemo(() => new Set(accessibleSites.map(s => s.id)), [accessibleSites]);

  const dataQuery = useMemoFirebase(() => 
    query(collection(firestore, 'material_utilisations'), orderBy('createdAt', 'desc'), limit(1000)), 
    [firestore]
  );
  const { data: utilisations, isLoading } = useCollection<Utilisation>(dataQuery);

  const queryDateRange = React.useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    switch (dateFilter) {
      case 'today': return { start: todayStr, end: todayStr };
      case 'yesterday': return { start: format(subDays(today, 1), 'yyyy-MM-dd'), end: format(subDays(today, 1), 'yyyy-MM-dd') };
      case '7days': return { start: format(subDays(today, 7), 'yyyy-MM-dd'), end: todayStr };
      case 'lastMonth': return { start: format(subMonths(today, 1), 'yyyy-MM-dd'), end: todayStr };
      default: return { start: format(subDays(today, 7), 'yyyy-MM-dd'), end: todayStr };
    }
  }, [dateFilter]);

  const filteredData = React.useMemo(() => {
    if (!utilisations || !userProfile) return [];
    
    let result = utilisations;

    if (!isAdmin) {
      result = result.filter(u => accessibleSiteIds.has(u.siteId) || u.userId === user?.uid);
    }

    const { start, end } = queryDateRange;

    result = result.filter(u => {
      const uDate = u.createdAt?.toDate?.() || new Date(u.createdAt);
      const uDateStr = format(uDate, 'yyyy-MM-dd');
      const matchesSearch = u.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.remarks.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDate = uDateStr >= start && uDateStr <= end;
      const matchesSite = siteFilter === 'all' || u.siteName === siteFilter;
      return matchesSearch && matchesDate && matchesSite;
    });

    result.sort((a, b) => {
      const { key, direction } = sortConfig;
      let valA: any = ''; let valB: any = '';
      if (key === 'date') { valA = new Date(a.utilisationDate).getTime(); valB = new Date(b.utilisationDate).getTime(); }
      else if (key === 'site') { valA = a.siteName.toLowerCase(); valB = b.siteName.toLowerCase(); }
      else if (key === 'item') { valA = a.itemName.toLowerCase(); valB = b.itemName.toLowerCase(); }
      else if (key === 'quantity') { valA = a.quantity; valB = b.quantity; }
      else if (key === 'personnel') { valA = a.userName.toLowerCase(); valB = b.userName.toLowerCase(); }
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [utilisations, searchTerm, siteFilter, sortConfig, isAdmin, accessibleSiteIds, user, queryDateRange]);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3.5 w-3.5 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3.5 w-3.5 text-primary" /> : <ArrowDown className="ml-2 h-3.5 w-3.5 text-primary" />;
  };

  const handleExport = () => {
    if (filteredData.length === 0) return;
    const exportData = filteredData.map(u => ({
      'Date': u.utilisationDate,
      'Project Site': u.siteName,
      'Material Consumed': u.itemName,
      'Quantity': u.quantity,
      'Unit': u.unit,
      'Remarks': u.remarks,
      'Personnel': u.userName,
      'Log Timestamp': u.createdAt ? format(u.createdAt.toDate(), 'dd/MM/yyyy HH:mm:ss') : 'N/A'
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Utilisations");
    XLSX.writeFile(wb, `Material_Utilisations_Registry_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSiteFilter("all");
    setDateFilter("7days");
  };

  if (isLoading || isProfileLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-[500px] w-full" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2 uppercase">
            <History className="h-8 w-8" /> Global Utilisation Data
          </h1>
          <p className="text-muted-foreground font-medium">Historical audit trail of material consumption across authorized project sites.</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="h-10 rounded-sm font-bold border-primary text-primary hover:bg-primary/5 shadow-sm px-6">
          <FileDown className="h-4 w-4 mr-2" />
          Export to Excel
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." className="pl-10 h-10 text-sm rounded-sm border-primary/20 bg-background" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[140px] h-10 text-xs font-bold uppercase rounded-sm border-primary/20 bg-background"><Calendar className="h-3.5 w-3.5 mr-2 opacity-50" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today" className="text-xs font-bold uppercase">Today</SelectItem>
              <SelectItem value="yesterday" className="text-xs font-bold uppercase">Yesterday</SelectItem>
              <SelectItem value="7days" className="text-xs font-bold uppercase">Last 7 Days</SelectItem>
              <SelectItem value="lastMonth" className="text-xs font-bold uppercase">Last Month</SelectItem>
            </SelectContent>
          </Select>
          <Select value={siteFilter} onValueChange={setSiteFilter}>
            <SelectTrigger className="w-[180px] h-10 text-xs font-bold uppercase rounded-sm border-primary/20 bg-background">
              <Building2 className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All Sites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs font-bold uppercase">All Accessible Sites</SelectItem>
              {accessibleSites.map(site => (
                <SelectItem key={site.id} value={site.name} className="text-xs font-bold uppercase">{site.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={clearFilters} className="h-10 w-10 text-muted-foreground rounded-sm"><FilterX className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card className="rounded-sm shadow-lg border-primary/10 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('date')}>
                    <div className="flex items-center">Date <SortIcon column="date" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('site')}>
                    <div className="flex items-center">Project Site <SortIcon column="site" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('item')}>
                    <div className="flex items-center">Material Consumed <SortIcon column="item" /></div>
                  </TableHead>
                  <TableHead className="text-center cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('quantity')}>
                    <div className="flex items-center justify-center">Quantity <SortIcon column="quantity" /></div>
                  </TableHead>
                  <TableHead className="min-w-[200px]">Remarks</TableHead>
                  <TableHead className="text-right px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('personnel')}>
                    <div className="flex items-center justify-end">Personnel <SortIcon column="personnel" /></div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length > 0 ? filteredData.map((u) => (
                  <TableRow key={u.id} className="hover:bg-muted/5 transition-colors">
                    <TableCell className="px-6 py-4 font-mono text-xs font-bold text-muted-foreground whitespace-nowrap"><div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />{u.utilisationDate}</div></TableCell>
                    <TableCell className="font-bold text-sm text-foreground"><div className="flex items-center gap-2"><Building2 className="h-3 w-3 text-primary" />{u.siteName}</div></TableCell>
                    <TableCell><div className="flex flex-col"><span className="font-bold text-sm">{u.itemName}</span><span className="text-[9px] font-bold text-muted-foreground uppercase">Inventory Consumption</span></div></TableCell>
                    <TableCell className="text-center"><Badge variant="secondary" className="font-mono font-bold rounded-sm px-2 bg-amber-50 text-amber-700 border-amber-200">{u.quantity} {u.unit}</Badge></TableCell>
                    <TableCell className="text-xs italic text-muted-foreground max-w-[250px] truncate" title={u.remarks}>"{u.remarks}"</TableCell>
                    <TableCell className="text-right px-6"><div className="flex items-center justify-end gap-2 text-xs font-bold text-muted-foreground uppercase"><User className="h-3 w-3 text-primary" />{u.userName}</div></TableCell>
                  </TableRow>
                )) : <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic">No consumption records discovered</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}