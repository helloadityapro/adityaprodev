'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { UserPlus, Trash2, Users, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronsUpDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type User = {
  id: string;
  username: string;
  email: string;
  role: 'Admin' | 'Site Manager' | 'Site Engineer';
  siteManagerId?: string;
};

type SortKey = 'engineer' | 'manager';

export default function TeamMappingPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const isAdmin = userProfile?.role === 'Admin' || 
                  user?.email === 'abhijeet.agepl@gmail.com' || 
                  user?.email === 'abhijeetsb22@gmail.com' ||
                  user?.email === 'khalil@adityagreenenergy.com' ||
                  user?.email === 'prafulrana143@gmail.com';

  React.useEffect(() => {
    if (!isProfileLoading && !isAdmin) {
      router.replace('/ptw/raise');
    }
  }, [isProfileLoading, isAdmin, router]);

  const managersQuery = useMemoFirebase(() => query(collection(firestore, 'users'), where('role', '==', 'Site Manager')), [firestore]);
  const { data: managers, isLoading: managersLoading } = useCollection<User>(managersQuery);

  const engineersQuery = useMemoFirebase(() => query(collection(firestore, 'users'), where('role', '==', 'Site Engineer')), [firestore]);
  const { data: engineers, isLoading: engineersLoading } = useCollection<User>(engineersQuery);

  const [selectedManagerId, setSelectedManagerId] = React.useState<string | null>(null);
  const [selectedEngineerId, setSelectedEngineerId] = React.useState<string | null>(null);

  // Popover & Search states
  const [isManagerPopoverOpen, setIsManagerPopoverOpen] = React.useState(false);
  const [managerSearchQuery, setManagerSearchQuery] = React.useState("");
  const [isEngineerPopoverOpen, setIsEngineerPopoverOpen] = React.useState(false);
  const [engineerSearchQuery, setEngineerSearchQuery] = React.useState("");

  // Table filter states
  const [tableEngineerSearch, setTableEngineerSearch] = React.useState('');
  const [tableManagerSearch, setTableManagerSearch] = React.useState('');

  // Sort state
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'manager', direction: 'asc' });

  const handleAssign = () => {
    if (!selectedManagerId || !selectedEngineerId) return;

    const engineerRef = doc(firestore, 'users', selectedEngineerId);
    updateDocumentNonBlocking(engineerRef, { siteManagerId: selectedManagerId });

    toast({
      title: 'Engineer Assigned',
      description: 'The site engineer has been successfully mapped to the manager.',
    });
    
    setSelectedEngineerId(null);
  };

  const handleRemoveMapping = (engineerId: string) => {
    const engineerRef = doc(firestore, 'users', engineerId);
    updateDocumentNonBlocking(engineerRef, { siteManagerId: null });

    toast({
      title: 'Mapping Removed',
      description: 'The engineer mapping has been cleared.',
    });
  };

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const filteredManagers = React.useMemo(() => {
    if (!managers) return [];
    return managers.filter(m => 
      m.username.toLowerCase().includes(managerSearchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(managerSearchQuery.toLowerCase())
    );
  }, [managers, managerSearchQuery]);

  const unmappedEngineers = React.useMemo(() => {
    if (!engineers) return [];
    return engineers.filter(e => !e.siteManagerId);
  }, [engineers]);

  const filteredUnmappedEngineers = React.useMemo(() => {
    return unmappedEngineers.filter(e => 
      e.username.toLowerCase().includes(engineerSearchQuery.toLowerCase()) ||
      e.email.toLowerCase().includes(engineerSearchQuery.toLowerCase())
    );
  }, [unmappedEngineers, engineerSearchQuery]);

  const filteredMappings = React.useMemo(() => {
    if (!engineers || !managers) return [];
    
    return engineers
      .filter(e => e.siteManagerId)
      .filter(e => {
        const manager = managers.find(m => m.id === e.siteManagerId);
        const matchesEngineer = (e.username || '').toLowerCase().includes(tableEngineerSearch.toLowerCase());
        const matchesManager = manager?.username.toLowerCase().includes(tableManagerSearch.toLowerCase()) ?? false;
        return matchesEngineer && matchesManager;
      })
      .sort((a, b) => {
        const { key, direction } = sortConfig;
        let valA = '';
        let valB = '';

        if (key === 'engineer') {
            valA = (a.username || '').toLowerCase();
            valB = (b.username || '').toLowerCase();
        } else {
            valA = (managers.find(m => m.id === a.siteManagerId)?.username || '').toLowerCase();
            valB = (managers.find(m => m.id === b.siteManagerId)?.username || '').toLowerCase();
        }

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
      });
  }, [engineers, managers, tableEngineerSearch, tableManagerSearch, sortConfig]);

  if (isProfileLoading || managersLoading || engineersLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
      <p className="text-muted-foreground">Assign Site Engineers to Site Managers for PTW approvals.</p>

      <Card>
        <CardHeader>
          <CardTitle>Assign Site Engineer to Site Manager</CardTitle>
          <CardDescription>Select a manager and then an engineer to assign and make a team.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label>Site Manager</Label>
              <Popover open={isManagerPopoverOpen} onOpenChange={setIsManagerPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      "w-full justify-between font-normal",
                      !selectedManagerId && "text-muted-foreground"
                    )}
                  >
                    {selectedManagerId
                      ? managers?.find((m) => m.id === selectedManagerId)?.username
                      : "Select a Manager..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <Input
                      placeholder="Search managers..."
                      className="h-9 w-full border-none focus-visible:ring-0 px-0 text-sm"
                      value={managerSearchQuery}
                      onChange={(e) => setManagerSearchQuery(e.target.value)}
                    />
                  </div>
                  <ScrollArea className="h-[250px]">
                    <div className="p-1">
                      {filteredManagers.length > 0 ? (
                        filteredManagers.map((m) => (
                          <Button
                            key={m.id}
                            variant="ghost"
                            className="w-full justify-start font-normal"
                            onClick={() => {
                              setSelectedManagerId(m.id);
                              setIsManagerPopoverOpen(false);
                              setManagerSearchQuery("");
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                m.id === selectedManagerId ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {m.username}
                          </Button>
                        ))
                      ) : (
                        <p className="p-4 text-center text-sm text-muted-foreground">No manager found.</p>
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label>Site Engineer</Label>
              <Popover open={isEngineerPopoverOpen} onOpenChange={setIsEngineerPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      "w-full justify-between font-normal",
                      !selectedEngineerId && "text-muted-foreground"
                    )}
                  >
                    {selectedEngineerId
                      ? engineers?.find((e) => e.id === selectedEngineerId)?.username
                      : "Select an Engineer..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <Input
                      placeholder="Search unmapped engineers..."
                      className="h-9 w-full border-none focus-visible:ring-0 px-0 text-sm"
                      value={engineerSearchQuery}
                      onChange={(e) => setEngineerSearchQuery(e.target.value)}
                    />
                  </div>
                  <ScrollArea className="h-[250px]">
                    <div className="p-1">
                      {filteredUnmappedEngineers.length > 0 ? (
                        filteredUnmappedEngineers.map((e) => (
                          <Button
                            key={e.id}
                            variant="ghost"
                            className="w-full justify-start font-normal"
                            onClick={() => {
                              setSelectedEngineerId(e.id);
                              setIsEngineerPopoverOpen(false);
                              setEngineerSearchQuery("");
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                e.id === selectedEngineerId ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {e.username}
                          </Button>
                        ))
                      ) : (
                        <p className="p-4 text-center text-sm text-muted-foreground">No unmapped engineers found.</p>
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>

            <Button onClick={handleAssign} disabled={!selectedManagerId || !selectedEngineerId}>
              <UserPlus className="mr-2 h-4 w-4" />
              Assign Mapping
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Teams</CardTitle>
          <CardDescription>A list of all engineers and their assigned managers.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">
                    <div className="flex flex-col gap-2 py-2">
                      <div className="flex items-center cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('manager')}>
                        <span>Assigned Manager</span>
                        <SortIcon column="manager" />
                      </div>
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Filter managers..."
                          value={tableManagerSearch}
                          onChange={(e) => setTableManagerSearch(e.target.value)}
                          className="h-8 pl-8 text-xs"
                        />
                      </div>
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[200px]">
                    <div className="flex flex-col gap-2 py-2">
                      <div className="flex items-center cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('engineer')}>
                        <span>Engineer Name</span>
                        <SortIcon column="engineer" />
                      </div>
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Filter engineers..."
                          value={tableEngineerSearch}
                          onChange={(e) => setTableEngineerSearch(e.target.value)}
                          className="h-8 pl-8 text-xs"
                        />
                      </div>
                    </div>
                  </TableHead>
                  <TableHead className="text-right align-bottom pb-4 px-4">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMappings.length > 0 ? (
                  filteredMappings.map(e => {
                    const manager = managers?.find(m => m.id === e.siteManagerId);
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium px-4">{manager?.username || 'Unknown Manager'}</TableCell>
                        <TableCell className="px-4">{e.username || 'Unknown Engineer'}</TableCell>
                        <TableCell className="text-right px-4">
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveMapping(e.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                            <span className="sr-only">Remove</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <Users className="h-12 w-12 mb-4 opacity-20" />
                        <p>No engineer mappings found matching your filters.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
