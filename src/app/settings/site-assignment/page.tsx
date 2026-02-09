'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { MapPin, Trash2, Loader2, PlusCircle } from 'lucide-react';

type User = {
  id: string;
  username: string;
  email: string;
  role: 'Admin' | 'Site Manager' | 'Site Engineer';
  siteManagerId?: string;
  assignedProjectIds?: string[];
};

type Site = {
  id: string;
  name: string;
};

export default function SiteAssignmentPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const isAdmin = userProfile?.role === 'Admin' || 
                  user?.email === 'abhijeet.agepl@gmail.com' || 
                  user?.email === 'abhijeetsb22@gmail.com' ||
                  user?.email === 'khalil@adityagreenenergy.com';
  
  const isManager = userProfile?.role === 'Site Manager';

  React.useEffect(() => {
    if (!isProfileLoading && !isAdmin && !isManager) {
      router.replace('/ptw/raise');
    }
  }, [isProfileLoading, isAdmin, isManager, router]);

  // Fetch all sites
  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: sites, isLoading: sitesLoading } = useCollection<Site>(sitesQuery);

  // Fetch users based on role
  const usersQuery = useMemoFirebase(() => {
    if (isAdmin) return collection(firestore, 'users');
    if (isManager) return query(collection(firestore, 'users'), where('siteManagerId', '==', user?.uid));
    return null;
  }, [firestore, isAdmin, isManager, user]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);
  const [selectedSiteToAdd, setSelectedSiteToAdd] = React.useState<string | null>(null);
  const selectedUser = React.useMemo(() => users?.find(u => u.id === selectedUserId), [users, selectedUserId]);
  const [localAssignedSites, setLocalAssignedSites] = React.useState<string[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (selectedUser) {
      setLocalAssignedSites(selectedUser.assignedProjectIds || []);
    } else {
      setLocalAssignedSites([]);
    }
  }, [selectedUser]);

  const handleAddSite = () => {
    if (!selectedSiteToAdd) return;
    if (localAssignedSites.includes(selectedSiteToAdd)) {
        toast({ title: 'Already Assigned', description: 'This site is already assigned to the user.', variant: 'destructive' });
        return;
    }
    setLocalAssignedSites(prev => [...prev, selectedSiteToAdd]);
    setSelectedSiteToAdd(null);
  };

  const handleRemoveSite = (siteId: string) => {
    setLocalAssignedSites(prev => prev.filter(id => id !== siteId));
  };

  const handleSave = () => {
    if (!selectedUserId) return;
    setIsSaving(true);

    const userRef = doc(firestore, 'users', selectedUserId);
    updateDocumentNonBlocking(userRef, { assignedProjectIds: localAssignedSites });

    toast({
      title: 'Sites Assigned',
      description: `Sites have been successfully updated for ${selectedUser?.username}.`,
      variant: 'success',
    });
    setIsSaving(false);
  };

  if (isProfileLoading || sitesLoading || usersLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAdmin && !isManager) return null;

  const filteredUsers = users?.filter(u => {
      if (isAdmin) return u.role !== 'Admin' || u.id === user?.uid;
      return u.role === 'Site Engineer';
  }) || [];

  // Filter out sites that are already assigned for the "Add" dropdown
  const availableSitesToAssign = sites?.filter(site => !localAssignedSites.includes(site.id)) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Assign Sites</h1>
        <p className="text-muted-foreground">Manage which sites are accessible to specific users.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select User</CardTitle>
          <CardDescription>
            {isAdmin ? "Select any user to manage their site access." : "Select one of your engineers to manage their site access."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md space-y-2">
            <Label>User</Label>
            <Select value={selectedUserId || ''} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a User" />
              </SelectTrigger>
              <SelectContent>
                {filteredUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.username} ({u.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedUserId && (
        <Card className="animate-in fade-in slide-in-from-top-4 duration-300">
          <CardHeader>
            <CardTitle>Site Access for {selectedUser?.username}</CardTitle>
            <CardDescription>Add new sites or remove existing ones from this user's access list.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col sm:flex-row items-end gap-4 p-4 border rounded-lg bg-muted/20">
              <div className="flex-1 space-y-2 w-full">
                <Label>Add New Site</Label>
                <Select value={selectedSiteToAdd || ''} onValueChange={setSelectedSiteToAdd}>
                  <SelectTrigger>
                    <SelectValue placeholder={availableSitesToAssign.length > 0 ? "Select a site to add" : "No more sites available"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSitesToAssign.map(site => (
                      <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddSite} disabled={!selectedSiteToAdd} className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Site
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-lg font-semibold">Assigned Sites</Label>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Site Name</TableHead>
                      <TableHead className="w-[100px] text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {localAssignedSites.length > 0 ? (
                      localAssignedSites.map(siteId => {
                        const site = sites?.find(s => s.id === siteId);
                        return (
                          <TableRow key={siteId}>
                            <TableCell className="font-medium">{site?.name || 'Unknown Site'}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleRemoveSite(siteId)}>
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Remove</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2} className="h-24 text-center text-muted-foreground italic">
                          No sites assigned to this user yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            
            <div className="flex justify-end pt-4">
                <Button onClick={handleSave} disabled={isSaving} size="lg">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Assignment
                </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
