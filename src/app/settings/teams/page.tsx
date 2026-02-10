'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { UserPlus, Trash2, Users, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

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

  // Filter states
  const [engineerSearch, setEngineerSearch] = React.useState('');
  const [managerSearch, setManagerSearch] = React.useState('');

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

  const filteredMappings = React.useMemo(() => {
    if (!engineers || !managers) return [];
    
    return engineers
      .filter(e => e.siteManagerId)
      .filter(e => {
        const manager = managers.find(m => m.id === e.siteManagerId);
        const matchesEngineer = e.username.toLowerCase().includes(engineerSearch.toLowerCase());
        const matchesManager = manager?.username.toLowerCase().includes(managerSearch.toLowerCase()) ?? false;
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
  }, [engineers, managers, engineerSearch, managerSearch, sortConfig]);

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

  const unmappedEngineers = engineers?.filter(e => !e.siteManagerId) || [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
      <p className="text-muted-foreground">Assign Site Engineers to Site Managers for PTW approvals.</p>

      <Card>
        <CardHeader>
          <CardTitle>Map Engineer to Manager</CardTitle>
          <CardDescription>Select a manager and then an engineer to create a mapping.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label>Site Manager</Label>
              <Select value={selectedManagerId || ''} onValueChange={setSelectedManagerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a Manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers?.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Site Engineer</Label>
              <Select value={selectedEngineerId || ''} onValueChange={setSelectedEngineerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an Engineer" />
                </SelectTrigger>
                <SelectContent>
                  {unmappedEngineers.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          <CardTitle>Current Mappings</CardTitle>
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
                          value={managerSearch}
                          onChange={(e) => setManagerSearch(e.target.value)}
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
                          value={engineerSearch}
                          onChange={(e) => setEngineerSearch(e.target.value)}
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